/**
 * Composes Tower Tension from the room state: a camera that pans and zooms
 * with the stack, a sky that darkens with altitude, the crane, the tower and
 * its worker, then the HUD. All motion is stepped here with the real frame
 * time, and nothing drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { type CraneState, createCrane, drawCrane, jolt, loadPose, resetCrane, settleCrane, stepCrane, takeLoad } from './crane';
import { clamp, fract, gust, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type OfficeDrive, type OfficeState, createOffice, drawOffice, resetOffice, scatterQueue, sellPenthouse, sellUnit, settleOffice, stepOffice } from './office';
import { FLOOR_H, FLOOR_W, GROUND_Y, TOWER_X, type TowerState, collapseTower, collapseCamera, runningCameraFrame, createTower, drawBubble, drawDebris, drawDust, drawFallers, drawTower, dropLoad, floorCount, landFloor, lurch, offsetAtY, resetTower, slopeAt, stepTower, topOffset, topVelocity, towerHeight, towerTopY } from './tower';
import { type Fleet, createFleet, drawFleet, resetFleet, scatterFleet, settleFleet, stepFleet, unloadTruck } from './truck';
import { type Landing, type WorkerState, callHoist, createWorker, drawCage, drawWorker, resetWorker, settleSafe, stepWorker, towerFell } from './worker';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a collapse missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, flicker and twinkle. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const H = 540;
const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The widest the multiplier readout draws; a longer number condenses to fit. */
const READOUT_MAX_W = 300;
/** Floors placed per doubling of the multiplier: one every 3 s of a running round at the platform's pace. */
const FLOORS_PER_DOUBLING = 3;
/** Camera centre that puts the ground at screen y 500 at scale 1. */
const GROUND_CAM_Y = GROUND_Y - 230;
/** The multipliers a milestone stinger plays at: the caption ladder. */
const RUNGS = [1.3, 1.7, 2.5, 4, 7, 12, 25];
/**
 * The fake-outs: at these multipliers the stack lurches, the slab coughs dust and the worker calls it probably
 * nothing. Keyed to the multiplier only, so they say nothing about where the round ends.
 */
const LURCHES = [1.8, 2.6, 4.2, 7.5, 15, 40, 120, 400, 1500, 6000, 25000, 1e5];
/**
 * The collapse's choreography: the base gives with a lurch and a creak, the joints let go a few frames later
 * (the fuse), the picture holds for a hit-stop while the camera punches in 10%, and the first fall runs slow
 * before time catches up and the camera eases back out.
 */
const FUSE_S = 0.14;
const FREEZE_S = 0.15;
const PUNCH_S = 0.3;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
type Outcome = 'rekt' | 'called' | 'timber';
type Secured = { x100: number; payout: number | null };
type Star = { x: number; y: number; r: number; k: number };
type Cloud = { x: number; y: number; w: number; speed: number };
type Building = { x: number; w: number; h: number };

/** Sky colour by altitude above the ground, from a hazy horizon to the edge of space. */
const RAMP: [number, [number, number, number]][] = [[-300, [223, 241, 255]], [0, [191, 227, 255]], [350, [120, 189, 242]], [800, [63, 120, 194]], [1300, [29, 47, 107]], [2200, [10, 15, 46]]];
function skyColour(altitude: number): string {
  let i = 0;
  while (i < RAMP.length - 2 && altitude > RAMP[i + 1]![0]) i += 1;
  const [a0, c0] = RAMP[i]!;
  const [a1, c1] = RAMP[i + 1]!;
  const t = clamp((altitude - a0) / (a1 - a0), 0, 1);
  return `rgb(${Math.round(mix(c0[0], c1[0], t))}, ${Math.round(mix(c0[1], c1[1], t))}, ${Math.round(mix(c0[2], c1[2], t))})`;
}

/** Meme caption lettering: heavy, white, black-bordered. */
function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THE ELEVATOR NEEDS A MAP", "ANOTHER FLOOR, ANOTHER PRESALE", "PENTHOUSE ABOVE THE CLOUDS", "THE CRANE WORKS OVERTIME", "FOUNDATION: STILL VIBES", "NEW FLOOR JUST DROPPED", "THE INSPECTOR LEFT THE CHAT", "VERTICAL URBAN SPRAWL"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null, bare: boolean): string {
  if (outcome) return bare ? 'RUGGED AT FOUNDATION' : outcome === 'rekt' ? 'THERE IS NO FLOOR' : outcome === 'called' ? 'SOLD THE PENTHOUSE' : 'BAILOUT DENIED';
  if (view.phase !== 'running') return 'WEN PRESALE?';
  if (secured) {
    // The regret ladder: how far it ran after you sold. You were right anyway.
    const after = multiplier / (secured.x100 / 100);
    return after < 1.25 ? 'SOLD TO THE NEXT GUY' : after < 2 ? 'JEETED WITH PROFIT' : after < 4 ? 'THE NEXT GUY IS UP BIG' : 'PROFIT IS PROFIT';
  }
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (multiplier < 1.3) return 'PRESALE IS LIVE';
  if (multiplier < 1.7) return 'FLOOR PRICE UP';
  if (multiplier < 2.5) return 'BUILT ON VIBES';
  if (multiplier < 4) return 'PONZI BUT VERTICAL';
  if (multiplier < 7) return 'WEN PENTHOUSE';
  if (multiplier < 12) return 'INSPECTOR WAS PAID';
  if (multiplier < 25) return 'LEVERAGED THE BASEMENT';
  return 'TOO BIG TO FAIL';
}

/** World to screen for a layer: parallax below 1 makes it scroll slower than the tower. */
function worldTransform(ctx: CanvasRenderingContext2D, camY: number, scale: number, parallax = 1, camX = W / 2): void {
  const layerCam = GROUND_CAM_Y + (camY - GROUND_CAM_Y) * parallax;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-camX, -layerCam);
}

function drawSky(ctx: CanvasRenderingContext2D, camY: number, scale: number, time: number, stars: Star[], reduced: boolean): void {
  const altitudeAt = (sy: number): number => GROUND_Y - (camY + (sy - H / 2) / scale);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  for (const f of [0, 0.25, 0.5, 0.75, 1]) sky.addColorStop(f, skyColour(altitudeAt(f * H)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (altitudeAt(0) < 450) return;
  ctx.save();
  worldTransform(ctx, camY, scale, 0.45);
  ctx.fillStyle = '#ffffff';
  for (const s of stars) {
    const a = smoothstep(450, 1100, GROUND_Y - s.y) * (reduced ? 0.8 : 0.5 + 0.5 * Math.sin(time * s.k + s.x));
    if (a < 0.03) continue;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.save();
  worldTransform(ctx, camY, scale, 0.6);
  const my = GROUND_Y - 1150;
  const glow = ctx.createRadialGradient(900, my, 30, 900, my, 130);
  glow.addColorStop(0, 'rgba(255, 244, 214, 0.35)');
  glow.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(900, my, 130, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f7f0d8';
  ctx.beginPath(); ctx.arc(900, my, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e4dabd';
  for (const [dx, dy, r] of [[-14, -10, 8], [16, 12, 6], [8, -18, 4]] as const) { ctx.beginPath(); ctx.arc(900 + dx, my + dy, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawSkyline(ctx: CanvasRenderingContext2D, camY: number, scale: number, buildings: Building[], parallax: number, colour: string): void {
  ctx.save();
  worldTransform(ctx, camY, scale, parallax);
  ctx.fillStyle = colour;
  for (const b of buildings) ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h + 40);
  ctx.restore();
}

function drawClouds(ctx: CanvasRenderingContext2D, camY: number, scale: number, clouds: Cloud[], time: number): void {
  ctx.save();
  worldTransform(ctx, camY, scale, 0.8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (const c of clouds) {
    const x = -800 + ((c.x + time * c.speed) % 2600);
    for (const [dx, dy, rw, rh] of [[0, 0, c.w, c.w * 0.32], [-c.w * 0.5, 6, c.w * 0.55, c.w * 0.22], [c.w * 0.45, 4, c.w * 0.6, c.w * 0.25]] as const) {
      ctx.beginPath(); ctx.ellipse(x + dx, c.y + dy, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#7c8189';
  ctx.fillRect(-20000, GROUND_Y, 40000, 40000);
  ctx.fillStyle = '#5b5f66';
  ctx.fillRect(-20000, GROUND_Y, 40000, 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-20000, GROUND_Y); ctx.lineTo(20000, GROUND_Y); ctx.stroke();
  ctx.strokeStyle = '#d7d2c4';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath(); ctx.moveTo(-20000, GROUND_Y + 62); ctx.lineTo(20000, GROUND_Y + 62); ctx.stroke();
  ctx.setLineDash([]);
  // The developer's billboard, up on posts behind the site fence.
  ctx.fillStyle = '#9aa0a8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (const x of [48, 172]) { ctx.beginPath(); ctx.rect(x - 3, GROUND_Y - 50, 6, 50); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#1f2a4d';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(10, GROUND_Y - 118, 200, 70, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#d4a93a';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(15, GROUND_Y - 113, 190, 60, 2); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f4c542';
  ctx.font = `900 28px ${MEME_FONT}`;
  ctx.fillText('PONZI TOWERS', 110, GROUND_Y - 80, 176);
  ctx.fillStyle = '#d4a93a';
  ctx.fillRect(40, GROUND_Y - 74, 140, 1.5);
  ctx.fillStyle = '#f4f1e8';
  ctx.font = `900 11px ${MEME_FONT}`;
  ctx.fillText('LUXURY CONDOS · PAY IN $FLOOR', 110, GROUND_Y - 59, 176);
  // Somebody's sticker on the corner.
  ctx.save();
  ctx.translate(196, GROUND_Y - 112);
  ctx.rotate(0.2);
  ctx.fillStyle = '#fff3b0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-23, -9, 46, 18, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.font = `900 7.5px ${MEME_FONT}`;
  ctx.fillText('AUDITED BY', 0, -1.5, 42);
  ctx.fillText('MY COUSIN', 0, 6.5, 42);
  ctx.restore();
  // Site fence on the left, a cone and a barrier on the right.
  ctx.strokeStyle = '#c9d1d9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = -300; x <= 160; x += 40) { ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y - 34); }
  ctx.moveTo(-300, GROUND_Y - 30); ctx.lineTo(160, GROUND_Y - 30);
  ctx.moveTo(-300, GROUND_Y - 14); ctx.lineTo(160, GROUND_Y - 14);
  ctx.stroke();
  ctx.fillStyle = '#ff7a1a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(450, GROUND_Y - 26); ctx.lineTo(462, GROUND_Y); ctx.lineTo(438, GROUND_Y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(444, GROUND_Y - 13, 12, 4);
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.roundRect(790, GROUND_Y - 22, 70, 14, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (const x of [800, 824, 848]) ctx.fillRect(x, GROUND_Y - 20, 8, 10);
  ctx.beginPath(); ctx.moveTo(796, GROUND_Y - 8); ctx.lineTo(792, GROUND_Y); ctx.moveTo(854, GROUND_Y - 8); ctx.lineTo(858, GROUND_Y); ctx.stroke();
}

/** A name tag over the worker's head: YOU when it is your stake up there, ANON when you are watching. */
function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, ui: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(ui, ui);
  ctx.font = `900 12px ${MEME_FONT}`;
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -24, w, 17, 5);
  ctx.moveTo(-5, -7); ctx.lineTo(0, 0); ctx.lineTo(5, -7);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, -8.5); ctx.lineTo(0, -2); ctx.lineTo(4, -8.5); ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -15);
  ctx.restore();
}

function drawReadout(ctx: CanvasRenderingContext2D, view: SceneView, text: string, dead: boolean): void {
  const colour = dead ? '#ff4d6d' : view.phase === 'running' ? '#ffffff' : '#ffe08a';
  ctx.save();
  if (view.phase !== 'running' && !dead) ctx.globalAlpha = 0.85;
  memeText(ctx, text, 930, 80, 66, colour, 'right', READOUT_MAX_W);
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'trap', crash: 'boom' });
  const tower: TowerState = createTower();
  const crane: CraneState = createCrane();
  const worker: WorkerState = createWorker();
  const office: OfficeState = createOffice();
  const fleet: Fleet = createFleet();
  const cam = { x: spring(W / 2), y: spring(GROUND_CAM_Y), scale: spring(1) };
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the collapse, and how much longer it holds there (real seconds). */
  const punch = spring(0);
  let punchHold = 0;
  /** The floors-since-you-sold counter's pop. */
  const jeetPop = spring(0);
  let jeeted = 0;
  const stars: Star[] = Array.from({ length: 70 }, (_, i) => ({ x: -500 + noise(i * 3.1) * 2000, y: GROUND_Y - 600 - noise(i * 7.7) * 1900, r: 0.8 + noise(i * 1.3) * 1.6, k: 1 + noise(i * 5.9) * 2 }));
  const clouds: Cloud[] = Array.from({ length: 9 }, (_, i) => ({ x: noise(i * 2.3) * 2600, y: GROUND_Y - 240 - noise(i * 4.1) * 760, w: 70 + noise(i * 6.7) * 90, speed: 4 + noise(i * 8.9) * 7 }));
  const far: Building[] = Array.from({ length: 44 }, (_, i) => ({ x: -800 + i * 64 + noise(i) * 18, w: 34 + noise(i + 0.5) * 36, h: 90 + noise(i + 0.7) * 200 }));
  const near: Building[] = Array.from({ length: 40 }, (_, i) => ({ x: -800 + i * 72 + noise(i + 11) * 22, w: 40 + noise(i + 11.5) * 40, h: 50 + noise(i + 11.7) * 130 }));
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  /** The crash came before the first floor was up; the word the collapse pops, kept while it shrinks away. */
  let bare = false;
  let popText = '';
  let secured: Secured | null = null;
  /** The last round's exit, its badge shrinking away and its tape fading with the rubble as the next round opens. */
  let lastExit: Secured | null = null;
  let caption = '';
  /** Fake-outs played this round, and the worker's speech bubble. */
  let lurched = 0;
  let say: { text: string; age: number } | null = null;
  /** Seconds until the joints let go after the base gives; -1 with no collapse pending. */
  let fuse = -1;
  let freeze = 0;
  let slow = 0;
  /** Sound gates: the sway's creak (the way it last moved and where it turned), the collapse's screams and thuds, the hoist's mode edges. */
  let creakClock = 0;
  let swayDir = 0;
  let swayAt = 0;
  let screams = 0;
  let screamClock = 0;
  let thudClock = 0;
  let thuds = 0;
  let workerMode = worker.mode;

  function cameraTarget(): { x: number; y: number; s: number } {
    if (tower.collapsed) return collapseCamera(tower);
    const height = towerHeight(tower);
    let { x, s } = runningCameraFrame(tower, clamp(430 / (height + 270), 0.5, 1));
    let y: number;
    if (worker.mode === 'boarding' || worker.mode === 'rescuing' || worker.mode === 'riding') {
      s = Math.max(s, 0.85);
      x = worker.cage.x;
      y = worker.cage.y - 80;
    } else if (worker.mode === 'safe' && worker.modeAge < 1.8) {
      s = 1;
      x = W / 2;
      y = GROUND_CAM_Y;
    } else {
      y = towerTopY(tower) + 80 / s;
    }
    return { x, y: Math.min(y, GROUND_Y - 230 / s), s };
  }

  function settleCamera(): void {
    const target = cameraTarget();
    settleSpring(cam.x, target.x);
    settleSpring(cam.y, target.y);
    settleSpring(cam.scale, target.s);
  }

  /**
   * The crash: the joints let go, the block on the hook falls with them, and the worker falls or rides clear.
   * `quiet` lays it all out as it ended, for a collapse the scene did not see happen.
   */
  function collapse(view: SceneView, quiet: boolean): void {
    const inheritedVelocity = topVelocity(tower);
    bare = floorCount(tower) === 0;
    collapseTower(tower, view.currentX100, quiet);
    if (crane.holding) {
      dropLoad(tower, loadPose(crane), crane.trolley.v, Math.floor(crane.phase) % 4, quiet);
      crane.holding = false;
    }
    outcome = view.stake === null ? 'timber' : secured ? 'called' : 'rekt';
    popText = outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'DODGED!' : bare ? 'RUGGED' : 'TIMBER!';
    say = null;
    // An exit accepted since the last frame still counts: the emergency transfer reaches him.
    if (secured && worker.mode === 'top') {
      callHoist(worker);
    }
    towerFell(worker, tower, tower.rod.dir, quiet, inheritedVelocity);
    scatterQueue(office, quiet);
    if (quiet) scatterFleet(fleet, true);
    if (!quiet) {
      shake = 1;
      pop.v = 16;
      jolt(crane, 2.5 * tower.rod.dir);
      if (!reduced) {
        freeze = FREEZE_S;
        slow = SLOW_S;
        punchHold = FREEZE_S + PUNCH_S;
      }
      audio.crash('boom');
      screams = 0;
      screamClock = 0;
      thuds = 0;
      thudClock = 0;
      if (tower.debris.some((d) => d.residents.length)) {
        audio.fx('scream', 1);
        screams = 1;
        screamClock = 0.45;
      }
      return;
    }
    // The crane has long since climbed back down to the empty site, and the camera with it.
    settleCrane(crane, crane.phase, towerTopY(tower));
    crane.holding = false;
    settleCamera();
    pop.x = 1;
    audio.crash('boom', true);
  }

  /**
   * Green tape across the storey you sold at, with the price, riding the stack's bend; once the tower is down it
   * hangs in the air where that floor was, and `fade` (below 1) takes it away with the rubble.
   */
  function drawExitTape(ctx: CanvasRenderingContext2D, floor: number, x100: number, ui: number, fade = 1): void {
    const dodged = tower.collapsed || fade < 1;
    const standing = !dodged && floor <= floorCount(tower);
    const y = GROUND_Y - floor * FLOOR_H + (standing ? tower.thud.x : 0);
    const x = TOWER_X + (standing ? offsetAtY(tower, y) : 0);
    const half = FLOOR_W / 2 + 14;
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.translate(x, y);
    ctx.rotate(standing && floor > 0 ? slopeAt(tower, floor - 1) : 0);
    ctx.lineCap = 'round';
    ctx.setLineDash(standing ? [] : [12, 7]);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-half, 1); ctx.lineTo(half, -1); ctx.stroke();
    ctx.strokeStyle = '#7cf67c';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(-half - 4, 0);
    ctx.scale(ui, ui);
    ctx.font = `900 12px ${MEME_FONT}`;
    const text = `${dodged ? 'FLOOR YOU DODGED' : 'YOU SOLD HERE'} · ${(x100 / 100).toFixed(2)}×`;
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = '#7cf67c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-w, -9, w, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, -w / 2, 0.5);
    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the fall runs slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    // The tension runs 0.33 at 1.5×, 0.5 at 2× and 0.67 at 3×, where nearly every round is played; the fear works
    // the residents and the worker up from about 1.7× and has them screaming by 3×. Long rounds keep changing on
    // the floor count (`growth`): the height, the sway, the queue and the APY.
    const tension = 1 - 1 / multiplier;
    const fear = clamp((tension - 0.12) / 0.75, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      jeeted = 0;
      if (running) audio.cashout();
    }
    const progress = running || crashed ? FLOORS_PER_DOUBLING * growth : 0;
    const officeDrive: OfficeDrive = { running, growth: running || crashed ? growth : 0, tension: running ? tension : 0 };

    // Phase edges: joining late, the collapse, and a fresh site for the next round.
    if (previous === null) {
      // A page that joins mid-round, or a fresh scene for a round first seen after its betting, settles
      // straight into what the view says rather than replaying what it missed.
      previous = view.phase;
      for (let i = 0; i < Math.floor(progress); i += 1) landFloor(tower, 0, 0, true);
      settleCrane(crane, progress, towerTopY(tower));
      resetWorker(worker);
      worker.y = worker.lastSurface = towerTopY(tower);
      if (secured) settleSafe(worker);
      settleOffice(office, officeDrive, crashed);
      settleFleet(fleet, progress, running);
      if (secured) sellPenthouse(office);
      office.confetti = [];
      office.floaters = [];
      if (crashed) collapse(view, true);
      settleCamera();
      settleSpring(badge, secured ? 1 : 0);
      lurched = LURCHES.filter((r) => running && multiplier >= r).length;
      workerMode = worker.mode;
    } else if (view.phase !== previous) {
      if (crashed && !tower.collapsed && fuse < 0) {
        // Floors a hidden tab missed go up first, so the rubble matches the crash point.
        while (floorCount(tower) < Math.floor(progress)) landFloor(tower, 0, 0, true);
        if (view.crashAge > 1500) collapse(view, true);
        else {
          // The base gives first: a lurch and a creak, then the joints let go a few frames later.
          fuse = FUSE_S;
          tower.thud.v += 160;
          jolt(crane, -1.2);
          audio.fx('creak', 1.4);
          // The drivers see it go before it falls.
          scatterFleet(fleet, false);
        }
      }
      if (view.phase === 'betting') {
        resetTower(tower);
        resetCrane(crane);
        resetWorker(worker);
        resetOffice(office);
        // The first floor's truck drives in from just beyond the right of the view.
        resetFleet(fleet, cam.x.x + W / 2 / cam.scale.x);
        outcome = null;
        lastExit = secured;
        secured = null;
        fuse = -1;
        freeze = slow = 0;
        lurched = 0;
        say = null;
        workerMode = worker.mode;
      }
      previous = view.phase;
    }
    if (fuse >= 0) {
      fuse -= real;
      if (fuse < 0 && !tower.collapsed) collapse(view, false);
    }
    audio.update(view.phase, tension);
    if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    if (secured && worker.mode === 'top' && running) callHoist(worker);

    // Wind grows with the stack; the crane places a floor each time the count ticks over, taking each off the
    // truck that brought it and setting it where the top has swayed to.
    const breeze = gust(time);
    const wind = breeze * (60 + 3.6 * Math.min(15, floorCount(tower)));
    stepFleet(fleet, progress, running, dt);
    if (fleet.events.parked) audio.fx('hiss', 0.35);
    if (fleet.events.pulled) audio.fx('engine', 0.4);
    if (fleet.events.bolted) audio.fx('engine', 1);
    if (running) {
      stepCrane(crane, progress, towerTopY(tower), wind, dt, tension, topOffset(tower), topVelocity(tower));
      if (crane.events.pickup) {
        const bed = unloadTruck(fleet, Math.floor(crane.phase));
        if (bed) takeLoad(crane, bed.x, bed.y);
      }
      if (crane.events.release) {
        landFloor(tower, crane.drop.offset, crane.drop.velocity);
        if (!reduced) shake = Math.max(shake, 0.22);
        jolt(crane, 0.9 + 1.6 * tension);
        audio.fx('thud', 0.6 + 0.5 * tension);
        // Every floor that lands is a unit sold: the front of the queue goes in.
        if (sellUnit(office)) audio.fx('kaching', 0.7);
      }
      if (crane.events.pickup) audio.fx('ratchet', 0.55);
      while (floorCount(tower) < Math.floor(progress)) landFloor(tower, 0, 0, true);
    } else {
      // Idle between rounds, and after a collapse the crane climbs back down to the empty site.
      stepCrane(crane, crane.phase, towerTopY(tower), wind * 0.3, dt, tension * 0.5);
    }
    // The fake-outs: the stack lurches the way it leans and the worker calls it probably nothing (or, sold and
    // clear, is glad he did).
    if (running && fuse < 0 && lurched < LURCHES.length && multiplier >= LURCHES[lurched]!) {
      while (lurched < LURCHES.length && multiplier >= LURCHES[lurched]!) lurched += 1;
      if (floorCount(tower)) {
        const dir = topOffset(tower) >= 0 ? 1 : -1;
        lurch(tower, dir, 45 + 45 * tension);
        jolt(crane, 1.2 * dir);
        if (!reduced) shake = Math.max(shake, 0.4);
        audio.fx('creak', 1.1);
        audio.fx('gasp', 0.5);
        const text = worker.mode === 'top' ? 'PROBABLY NOTHING' : worker.mode === 'safe' ? 'GLAD I SOLD' : '';
        if (text) say = { text, age: 0 };
      }
    }
    // Through the fuse the stack is still up and still swaying.
    const live = running || fuse >= 0;
    stepTower(tower, running ? breeze : breeze * 0.5, dt, live ? tension : 0, live ? fear : 0);
    stepOffice(office, officeDrive, dt);
    // The stack creaks as it turns at the end of each sway, louder the further it went, and more often the worse it
    // gets; quieter once your exit is in.
    creakClock -= dt;
    if (running && !tower.collapsed && floorCount(tower)) {
      const v = topVelocity(tower);
      const dir = Math.abs(v) > 2 ? Math.sign(v) : swayDir;
      if (dir !== swayDir) {
        const reach = Math.abs(topOffset(tower) - swayAt) / 2;
        if (swayDir !== 0 && creakClock <= 0 && reach > 3) {
          audio.fx('creak', clamp(0.25 + reach / 30, 0.25, 1.2) * (secured ? 0.5 : 1));
          creakClock = mix(1.4, 0.35, tension);
        }
        swayDir = dir;
        swayAt = topOffset(tower);
      }
    }
    // The collapse's rumble: the first hard landings thud, and the residents scream as the floors let go.
    thudClock -= real;
    if (tower.events.hits && thuds < 8 && thudClock <= 0) {
      thuds += 1;
      thudClock = 0.12;
      audio.fx('thud', 0.9 - thuds * 0.06);
    }
    screamClock -= real;
    if (tower.events.ejected && screams < 4 && screamClock <= 0) {
      screams += 1;
      screamClock = 0.4;
      audio.fx('scream', 0.85 - screams * 0.12);
    }
    const load = loadPose(crane);
    // He steps onto the incoming block once its top is within a hop of where he stands.
    const landing: Landing | null = running && crane.holding && fract(crane.phase) >= 0.75 && towerTopY(tower) - (load.y - FLOOR_H / 2) <= 48 ? { x: load.x, topY: load.y - FLOOR_H / 2 } : null;
    stepWorker(worker, tower, fear, landing, dt);
    if (worker.mode !== workerMode) {
      // The hoist's beats: the cage arrives with a ding, and the ride ends with the penthouse's money.
      if (worker.mode === 'boarding') audio.fx('ding', 1.1);
      if (worker.mode === 'safe' && workerMode === 'riding') {
        sellPenthouse(office);
        audio.fx('kaching', 1.2);
      }
      workerMode = worker.mode;
    }

    // The camera eases over to frame the collapse (it holds through the hit-stop) and follows the debris down.
    const target = cameraTarget();
    const follow = tower.collapsed ? 4.5 : 0;
    stepSpring(cam.x, target.x, follow || 3, 1, dt);
    stepSpring(cam.y, target.y, follow || 2.4, 1, dt);
    stepSpring(cam.scale, target.s, follow || 2.4, 1, dt);
    // The stamp and the caption are the HUD's: they slam in on real time, over the frozen frame.
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, real);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    // The punch runs on real time, so it lands on the frozen frame.
    punchHold -= real;
    stepSpring(punch, punchHold > 0 ? 1 : 0, punchHold > 0 ? 26 : 5, punchHold > 0 ? 0.8 : 1, real);
    if (say && (say.age += dt) > 1.7) say = null;
    // Your exit floor, and the floors stacked on it since (held once the tower is down).
    const exit = secured ?? lastExit;
    const exitFloor = exit ? Math.floor(FLOORS_PER_DOUBLING * Math.log2(Math.max(1, exit.x100 / 100))) : 0;
    if (secured && !outcome) {
      const since = Math.max(0, floorCount(tower) - exitFloor);
      if (since > jeeted) jeetPop.v = 7;
      jeeted = since;
    }
    stepSpring(jeetPop, 0, 12, 0.4, dt);
    // Through the fuse the round is over but the stack is still up: the HUD keeps reading as running until it falls.
    const shown: SceneView = fuse >= 0 ? { ...view, phase: 'running' } : view;
    const nextCaption = captionFor(shown, multiplier, outcome, secured, bare);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, real);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    const s = cam.scale.x;
    const camY = cam.y.x;
    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the tipping stack and eases back out.
      const k = 1 + 0.1 * clamp(punch.x, 0, 1.2);
      const px = W / 2 + (TOWER_X - cam.x.x) * s;
      const py = H / 2 + (GROUND_Y - tower.fallHeight * 0.4 - camY) * s;
      ctx.translate(px, py);
      ctx.scale(k, k);
      ctx.translate(-px, -py);
    }
    drawSky(ctx, camY, s, time, stars, reduced);
    drawSkyline(ctx, camY, s, far, 0.35, 'rgba(95, 125, 175, 0.45)');
    drawClouds(ctx, camY, s, clouds, time);
    drawSkyline(ctx, camY, s, near, 0.6, 'rgba(48, 70, 118, 0.72)');
    ctx.save();
    worldTransform(ctx, camY, s, 1, cam.x.x);
    drawGround(ctx);
    drawFleet(ctx, fleet);
    drawOffice(ctx, office, officeDrive);
    drawCrane(ctx, crane);
    // The base cracks from the first floors, and the fear shows in the windows.
    const ui = clamp(1 / s, 1, 1.8);
    drawTower(ctx, tower, live ? fear : 0, live ? smoothstep(0.1, 0.8, tension) : 0, ui);
    if (secured && !tower.collapsed) drawExitTape(ctx, exitFloor, secured.x100, ui);
    const grounded = worker.mode === 'falling' || worker.mode === 'down';
    drawCage(ctx, worker, false);
    if (!grounded) drawWorker(ctx, worker);
    drawCage(ctx, worker, true);
    drawDebris(ctx, tower);
    drawFallers(ctx, tower, time);
    if (grounded) drawWorker(ctx, worker);
    drawDust(ctx, tower);
    // Once the tower is down the tape hangs in the air over the wreck, and goes with it.
    if (secured && tower.collapsed) drawExitTape(ctx, exitFloor, secured.x100, ui);
    else if (lastExit && tower.fade > 0) drawExitTape(ctx, exitFloor, lastExit.x100, ui, tower.fade);
    // Whose worker it is, and what he has to say for himself.
    const headY = worker.y - (grounded ? 58 : 66);
    drawTag(ctx, view.stake === null ? 'ANON' : 'YOU', worker.x, headY, view.stake === null ? '#c9d1d9' : '#ffe27a', ui);
    if (say) drawBubble(ctx, say.text, worker.x - 14, headY - 4, -1, Math.min(say.age / 0.12, (1.7 - say.age) / 0.3), ui);
    ctx.restore();
    if (popText && pop.x > 0.02) {
      const sx = W / 2 + (TOWER_X - cam.x.x) * s;
      let sy = H / 2 + (GROUND_Y - tower.fallHeight * 0.5 - camY) * s;
      // Dodged, the stamp sits above the floor you dodged so the tape still reads, also as it shrinks away.
      const dodged = popText === 'DODGED!';
      if (dodged) sy = Math.min(sy, H / 2 + (GROUND_Y - exitFloor * FLOOR_H - camY) * s - 60);
      sy = clamp(sy, dodged ? 170 : 130, 420);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, popText, 0, 0, 92, popText === 'REKT' ? '#ff4d6d' : popText === 'DODGED!' ? '#7cf67c' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    // A close view preserves the worker's grip and the foundation while the main camera shows the height.
    if (!tower.collapsed && floorCount(tower) > 24) {
      const foundation = Math.floor(view.elapsed / 14000) % 2 === 1;
      ctx.save(); ctx.beginPath(); ctx.roundRect(22, 104, 188, 162, 10); ctx.clip();
      ctx.fillStyle = '#203754'; ctx.fillRect(22, 104, 188, 162);
      ctx.translate(116, 234); ctx.scale(foundation ? 1.2 : 1.7, foundation ? 1.2 : 1.7);
      ctx.translate(-(foundation ? TOWER_X : worker.x), -(foundation ? GROUND_Y : worker.y));
      if (!foundation) drawCrane(ctx, crane);
      drawTower(ctx, tower, fear, smoothstep(0.1, 0.8, tension));
      if (!foundation) drawWorker(ctx, worker);
      ctx.restore();
      memeText(ctx, foundation ? 'FOUNDATION' : 'ROOFTOP', 116, 126, 16, '#ffe27a', 'center', 168);
    }

    // HUD in screen space. The readout grows leftward from x 930, so the caption centred on 430 narrows to
    // keep 24 px clear of it however long the number gets.
    const readout = `${multiplier.toFixed(2)}×`;
    ctx.font = `900 66px ${MEME_FONT}`;
    const readoutW = Math.min(READOUT_MAX_W, ctx.measureText(readout).width);
    if (caption) {
      ctx.save();
      ctx.translate(430, 68);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', Math.min(560, (2 * (930 - readoutW - 24 - 430)) / k));
      ctx.restore();
    }
    if (exit && badge.x > 0.02) {
      const text = `${exit.payout !== null ? `+${exit.payout} · ` : ''}${(exit.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(430, 114 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.03);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
      if (jeeted > 0) {
        // The regret counter: every floor the next guy has stacked on the one you sold.
        ctx.save();
        ctx.translate(430, 146);
        const j = (1 + 0.15 * jeetPop.x) * clamp(badge.x, 0, 1);
        ctx.scale(j, j);
        memeText(ctx, `+${jeeted} FLOOR${jeeted > 1 ? 'S' : ''} SINCE YOU JEETED`, 0, 0, 20, '#d9f7d4', 'center');
        ctx.restore();
      }
    }
    drawReadout(ctx, shown, readout, outcome !== null);
    // The floor count is the floor price, and a collapsed tower has none. It sits on the concrete strip under the
    // ground line (screen y 500), clear of the sales office and its queue.
    memeText(ctx, `FLOOR PRICE: ${tower.collapsed ? 0 : floorCount(tower)}`, 26, 526, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left', 260);
  }

  return { draw };
}
