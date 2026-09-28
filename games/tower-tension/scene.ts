/**
 * Composes Tower Tension from the room state: a camera that pans and zooms
 * with the stack, a sky that darkens with altitude, the crane, the tower and
 * its worker, then the HUD. All motion is stepped here with the real frame
 * time, and nothing drawn here changes the committed outcome.
 */
import { type CraneState, createCrane, drawCrane, drawPile, loadPose, resetCrane, settleCrane, stepCrane } from './crane';
import { clamp, fract, gust, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { FLOOR_H, GROUND_Y, TOWER_X, type TowerState, collapseTower, createTower, drawDebris, drawDust, drawTower, dropLoad, floorCount, landFloor, resetTower, stepTower, towerHeight, towerTopY } from './tower';
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
/** Floors placed per doubling of the multiplier: one every 1.9 s of a running round. */
const FLOORS_PER_DOUBLING = 6;
/** Camera centre that puts the ground at screen y 500 at scale 1. */
const GROUND_CAM_Y = GROUND_Y - 230;
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

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'SHOULD HAVE TAKEN THE LIFT' : outcome === 'called' ? 'CALLED IT' : 'NOT STONKS';
  if (view.phase !== 'running') return 'WEN BUILD?';
  if (secured) return 'DEAL WITH IT';
  if (multiplier < 1.3) return 'BREAKING GROUND';
  if (multiplier < 1.7) return 'NUMBER GO UP';
  if (multiplier < 2.5) return 'HODL';
  if (multiplier < 4) return 'SKY IS THE LIMIT';
  if (multiplier < 7) return 'WEN PENTHOUSE';
  if (multiplier < 12) return 'DIAMOND HANDS';
  if (multiplier < 25) return 'TO THE MOON';
  return 'THIS IS FINE';
}

/** World to screen for a layer: parallax below 1 makes it scroll slower than the tower. */
function worldTransform(ctx: CanvasRenderingContext2D, camY: number, scale: number, parallax = 1): void {
  const layerCam = GROUND_CAM_Y + (camY - GROUND_CAM_Y) * parallax;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -layerCam);
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
  ctx.fillRect(-1200, GROUND_Y, 3400, 2200);
  ctx.fillStyle = '#5b5f66';
  ctx.fillRect(-1200, GROUND_Y, 3400, 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-1200, GROUND_Y); ctx.lineTo(2200, GROUND_Y); ctx.stroke();
  ctx.strokeStyle = '#d7d2c4';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath(); ctx.moveTo(-1200, GROUND_Y + 62); ctx.lineTo(2200, GROUND_Y + 62); ctx.stroke();
  ctx.setLineDash([]);
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

function drawReadout(ctx: CanvasRenderingContext2D, view: SceneView, text: string, dead: boolean): void {
  const colour = dead ? '#ff4d6d' : view.phase === 'running' ? '#ffffff' : '#ffe08a';
  ctx.save();
  if (view.phase !== 'running' && !dead) ctx.globalAlpha = 0.85;
  memeText(ctx, text, 930, 80, 66, colour, 'right', READOUT_MAX_W);
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const tower: TowerState = createTower();
  const crane: CraneState = createCrane();
  const worker: WorkerState = createWorker();
  const cam = { y: spring(GROUND_CAM_Y), scale: spring(1) };
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const stars: Star[] = Array.from({ length: 70 }, (_, i) => ({ x: -500 + noise(i * 3.1) * 2000, y: GROUND_Y - 600 - noise(i * 7.7) * 1900, r: 0.8 + noise(i * 1.3) * 1.6, k: 1 + noise(i * 5.9) * 2 }));
  const clouds: Cloud[] = Array.from({ length: 9 }, (_, i) => ({ x: noise(i * 2.3) * 2600, y: GROUND_Y - 240 - noise(i * 4.1) * 760, w: 70 + noise(i * 6.7) * 90, speed: 4 + noise(i * 8.9) * 7 }));
  const far: Building[] = Array.from({ length: 44 }, (_, i) => ({ x: -800 + i * 64 + noise(i) * 18, w: 34 + noise(i + 0.5) * 36, h: 90 + noise(i + 0.7) * 200 }));
  const near: Building[] = Array.from({ length: 40 }, (_, i) => ({ x: -800 + i * 72 + noise(i + 11) * 22, w: 40 + noise(i + 11.5) * 40, h: 50 + noise(i + 11.7) * 130 }));
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';

  function cameraTarget(): { y: number; s: number } {
    const inFall = tower.collapsed && tower.fallAge < 2.6;
    const height = tower.collapsed ? (inFall ? tower.fallHeight : 0) : towerHeight(tower);
    let s = clamp(430 / (height + 270), 0.5, 1);
    let y: number;
    if (worker.mode === 'boarding' || worker.mode === 'riding') {
      s = Math.max(s, 0.85);
      y = worker.cage.y - 80;
    } else if (worker.mode === 'safe' && worker.modeAge < 1.8) {
      s = 1;
      y = GROUND_CAM_Y;
    } else if (inFall) {
      y = GROUND_Y - tower.fallHeight * 0.45;
    } else {
      y = towerTopY(tower) + 120 / s;
    }
    return { y: Math.min(y, GROUND_Y - 230 / s), s };
  }

  function settleCamera(): void {
    const target = cameraTarget();
    settleSpring(cam.y, target.y);
    settleSpring(cam.scale, target.s);
  }

  /**
   * The crash: the joints let go, the block on the hook falls with them, and the worker falls or rides clear.
   * `quiet` lays it all out as it ended, for a collapse the scene did not see happen.
   */
  function collapse(view: SceneView, quiet: boolean): void {
    collapseTower(tower, view.currentX100, quiet);
    if (crane.holding) {
      dropLoad(tower, loadPose(crane), crane.trolley.v, Math.floor(crane.phase) % 4, quiet);
      crane.holding = false;
    }
    outcome = view.stake === null ? 'timber' : secured ? 'called' : 'rekt';
    // An exit accepted since the last frame still counts: the cage has just reached him.
    if (secured && worker.mode === 'top') {
      callHoist(worker);
      worker.cage.y = worker.y;
    }
    towerFell(worker, tower, tower.rod.dir, quiet);
    if (!quiet) {
      shake = 1;
      pop.v = 16;
      return;
    }
    // The crane has long since climbed back down to the empty site, and the camera with it.
    settleCrane(crane, crane.phase, towerTopY(tower));
    crane.holding = false;
    settleCamera();
    pop.x = 1;
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const fear = clamp((growth - 0.35) / 2.8, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
    const progress = running || crashed ? FLOORS_PER_DOUBLING * growth : 0;

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
      if (crashed) collapse(view, true);
      settleCamera();
      settleSpring(badge, secured ? 1 : 0);
    } else if (view.phase !== previous) {
      if (crashed && !tower.collapsed) {
        // Floors a hidden tab missed go up first, so the rubble matches the crash point.
        while (floorCount(tower) < Math.floor(progress)) landFloor(tower, 0, 0, true);
        collapse(view, view.crashAge > 1500);
      }
      if (view.phase === 'betting') {
        resetTower(tower);
        resetCrane(crane);
        resetWorker(worker);
        outcome = null;
        secured = null;
      }
      previous = view.phase;
    }
    if (secured && worker.mode === 'top' && running) callHoist(worker);

    // Wind grows with the stack; the crane places a floor each time the count ticks over.
    const wind = gust(time) * (60 + 1.8 * Math.min(30, floorCount(tower)));
    if (running) {
      stepCrane(crane, progress, towerTopY(tower), wind, dt);
      if (crane.events.release) {
        landFloor(tower, crane.drop.offset, crane.drop.velocity);
        if (!reduced) shake = Math.max(shake, 0.22);
      }
      while (floorCount(tower) < Math.floor(progress)) landFloor(tower, 0, 0, true);
    } else {
      // Idle between rounds, and after a collapse the crane climbs back down to the empty site.
      stepCrane(crane, crane.phase, towerTopY(tower), wind * 0.3, dt);
    }
    stepTower(tower, running ? wind : wind * 0.5, dt);
    const load = loadPose(crane);
    const landing: Landing | null = running && crane.holding && fract(crane.phase) >= 0.86 ? { x: load.x, topY: load.y - FLOOR_H / 2 } : null;
    stepWorker(worker, tower, fear, landing, dt);

    const target = cameraTarget();
    stepSpring(cam.y, target.y, 2.4, 1, dt);
    stepSpring(cam.scale, target.s, 2.4, 1, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    const s = cam.scale.x;
    const camY = cam.y.x;
    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    drawSky(ctx, camY, s, time, stars, reduced);
    drawSkyline(ctx, camY, s, far, 0.35, 'rgba(95, 125, 175, 0.45)');
    drawClouds(ctx, camY, s, clouds, time);
    drawSkyline(ctx, camY, s, near, 0.6, 'rgba(48, 70, 118, 0.72)');
    ctx.save();
    worldTransform(ctx, camY, s);
    drawGround(ctx);
    drawPile(ctx);
    drawCrane(ctx, crane);
    drawTower(ctx, tower);
    const grounded = worker.mode === 'falling' || worker.mode === 'down';
    drawCage(ctx, worker, false);
    if (!grounded) drawWorker(ctx, worker);
    drawCage(ctx, worker, true);
    drawDebris(ctx, tower);
    if (grounded) drawWorker(ctx, worker);
    drawDust(ctx, tower);
    ctx.restore();
    if (outcome && pop.x > 0.02) {
      const sx = W / 2 + (TOWER_X - W / 2) * s;
      const sy = clamp(H / 2 + (GROUND_Y - tower.fallHeight * 0.5 - camY) * s, 130, 420);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, outcome === 'rekt' ? 'REKT' : 'TIMBER!', 0, 0, 92, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

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
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(430, 114 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.03);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    drawReadout(ctx, view, readout, outcome !== null);
    const floors = tower.collapsed ? tower.debris.length : floorCount(tower);
    memeText(ctx, `${floors} ${floors === 1 ? 'FLOOR' : 'FLOORS'}`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
  }

  return { draw };
}
