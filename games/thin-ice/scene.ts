import { portrait } from './portrait';
/**
 * Composes Thin Ice from the room state: the winter sky and aurora, the far
 * shore, the scrolling lake with its cracks and trails, the skater and her
 * reflection, the shatter, then the HUD. All motion is stepped here with the
 * real frame time, and nothing drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { type EngineDrive, type EngineState, createEngine, drawEngine, engineLine, settleEngine, stepEngine } from './engine';
import { FORESHORTEN, ICE_FAR_Y, type IceState, type Point, addTrail, createIce, drawBagholders, drawCracks, drawIce, drawShatter, drawThinning, journeyDistance, refreezeIce, resetIce, settleJourney, shatterIce, spawnCrack, spawnRacer, stepBagholders, stepIce } from './ice';
import { clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type SkaterDrive, type SkaterState, brace, createSkater, drawSkater, footScreen, headForShore, iceBroke, iceScale, iceY, rearBlade, rejoinSkater, settleSkater, settleSwimming, stepScarf, stepSkater } from './skater';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a break missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake and twinkle. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const H = 540;
const SKATER_SCREEN_X = 330;
const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The widest the multiplier readout grows: a huge number narrows rather than running into the caption. */
const READOUT_MAX_WIDTH = 300;
/** Clear space the caption keeps from the readout on its right and from the edge on its left. */
const HUD_GAP = 24;
/** How far past the spot where she climbs out the exit sign stands, in world px. */
const EXIT_AHEAD = 66;
/** The multipliers a milestone stinger plays at: the caption ladder. */
const RUNGS = [1.3, 1.7, 2.5, 4, 7, 12, 25];
/**
 * The near misses, between the rungs so the opening seconds get a beat every two or so: a crack races across the
 * ice at her and runs out of steam just short of her blades. Keyed to the multiplier only; past 45 s, every 9 s.
 */
const NEAR_MISSES = [1.15, 1.5, 2, 3, 5, 9, 18];
const RACE_S = 0.32;
/**
 * The break's choreography: the ice snaps round her with a creak and she brakes hard (BRAKE_S) and braces; it gives
 * way a few frames later (the fuse), the picture holds for a hit-stop with the camera punched in on the hole, and
 * the plunge runs slow before time catches up.
 */
const FUSE_S = 0.14;
const BRAKE_S = 0.08;
const FREEZE_S = 0.15;
const PUNCH_HOLD_S = 0.3;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
/** Who skates on after her exit, translucent, so the round still has someone to liquidate. */
const GHOSTS = ['NEXT LONG', 'EXIT LIQUIDITY', 'LATE APE', 'ANON @ 100X'];
const CONFETTI = ['#ff4d6d', '#7cf67c', '#8fd3ff', '#ffe27a', '#c084fc'];
type Outcome = 'rekt' | 'called' | 'crack';
type Secured = { x100: number; payout: number | null };
type Flake = { x: number; y: number; r: number; k: number };
interface Particle { kind: 'spray' | 'breath' | 'splash' | 'bubble' | 'confetti'; x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour?: string }

/** The width of the black border memeText strokes round lettering of this size; half of it shows outside the glyphs. */
const border = (size: number): number => Math.max(3, size * 0.13);

/** Meme caption lettering: heavy, white, black-bordered. */
function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = border(size);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THE LAKE KEEPS GOING", "NEW CRACK, SAME CONFIDENCE", "THE DRONE NEEDS A RECHARGE", "ANOTHER LAP ON THIN ICE", "NO BRAKES, JUST SKATES", "FROZEN ASSETS TOUR", "THE SHORE IS A RUMOUR", "STILL MAKING TRACKS"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'LIQUIDATED' : outcome === 'called' ? 'DODGED THE LIQUIDATION' : 'ANOTHER ONE FOR THE ICE';
  if (view.phase !== 'running') return 'WEN LEVERAGE?';
  if (secured) {
    // Taking profit is a jeet move, and the right one: the joke runs on as the round carries on without her.
    const regret = multiplier / (secured.x100 / 100);
    return regret < 1.2 ? 'CLOSED THE LONG. NOT A JEET' : regret < 2 ? 'NOT A JEET (IS A JEET)' : regret < 4 ? 'PROFIT IS STILL PROFIT' : 'SLEEPS FINE TONIGHT';
  }
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (multiplier < 1.3) return 'SKATING ON 100X';
  if (multiplier < 1.7) return 'LIQUIDITY IS THIN';
  if (multiplier < 2.5) return 'MARGIN IS VIBES';
  if (multiplier < 4) return 'THINNER THAN MY MARGIN';
  if (multiplier < 7) return 'FROZEN ASSETS BELOW';
  if (multiplier < 12) return 'LIQUIDATION PRICE: HERE';
  if (multiplier < 25) return 'ADDING MORE LEVERAGE';
  return 'SHE IS UNLIQUIDATABLE';
}

function drawSky(ctx: CanvasRenderingContext2D, time: number, stars: Flake[], reduced: boolean): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ICE_FAR_Y);
  sky.addColorStop(0, '#0b1a3a');
  sky.addColorStop(0.55, '#24406f');
  sky.addColorStop(1, '#7d9cc7');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, ICE_FAR_Y);
  ctx.fillStyle = '#ffffff';
  for (const [i, s] of stars.entries()) {
    ctx.globalAlpha = reduced ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.k + i));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Aurora: three ribbons that drift and breathe.
  for (const [k, colour] of [[0, '80, 230, 160'], [1, '120, 200, 255'], [2, '190, 120, 255']] as const) {
    const base = 40 + k * 32;
    const band = ctx.createLinearGradient(0, base - 20, 0, base + 70);
    band.addColorStop(0, `rgba(${colour}, 0)`);
    band.addColorStop(0.4, `rgba(${colour}, ${0.22 + 0.08 * Math.sin(time * 0.5 + k)})`);
    band.addColorStop(1, `rgba(${colour}, 0)`);
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.moveTo(-20, base - 20);
    for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, base - 20 + Math.sin(x / 140 + time * 0.3 + k * 1.7) * 26 + Math.sin(x / 55 - time * 0.2) * 8);
    for (let x = W + 20; x >= -20; x -= 20) ctx.lineTo(x, base + 70 + Math.sin(x / 140 + time * 0.3 + k * 1.7) * 26 + Math.sin(x / 55 - time * 0.2) * 8);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(830, 68, 20, 830, 68, 90);
  glow.addColorStop(0, 'rgba(255, 244, 214, 0.35)');
  glow.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(830, 68, 90, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f7f0d8';
  ctx.beginPath(); ctx.arc(830, 68, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e4dabd';
  for (const [dx, dy, r] of [[-8, -6, 5], [9, 7, 4], [4, -11, 2.5]] as const) { ctx.beginPath(); ctx.arc(830 + dx, 68 + dy, r, 0, Math.PI * 2); ctx.fill(); }
}

function drawMountains(ctx: CanvasRenderingContext2D, cameraX: number): void {
  for (const [parallax, colour, base, amp, seed] of [[0.06, '#2a4474', 140, 60, 1], [0.12, '#35548b', 168, 42, 7]] as const) {
    const shift = cameraX * parallax;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-40, ICE_FAR_Y);
    for (let x = -40; x <= W + 40; x += 30) {
      const wx = x + shift;
      const i = Math.floor(wx / 90);
      const t = (wx - i * 90) / 90;
      const h0 = noise(i * 3.7 + seed) * amp;
      const h1 = noise((i + 1) * 3.7 + seed) * amp;
      const peak = Math.abs(t - 0.5) < 0.5 ? (h0 + (h1 - h0) * t) : h0;
      ctx.lineTo(x, base + amp - peak - Math.abs(Math.sin(t * Math.PI)) * amp * 0.5);
    }
    ctx.lineTo(W + 40, ICE_FAR_Y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShore(ctx: CanvasRenderingContext2D, cameraX: number): void {
  const shift = cameraX * 0.3;
  ctx.fillStyle = '#eef4fa';
  ctx.beginPath();
  ctx.moveTo(-20, 212);
  for (let x = -20; x <= W + 20; x += 40) ctx.lineTo(x, 206 + Math.sin((x + shift) / 120) * 4 + noise(Math.floor((x + shift) / 40)) * 4);
  ctx.lineTo(W + 20, ICE_FAR_Y + 2);
  ctx.lineTo(-20, ICE_FAR_Y + 2);
  ctx.closePath();
  ctx.fill();
  // Trees repeat along the whole shore: pick the indices that fall on screen for this scroll.
  const first = Math.floor(shift / 78) - 2;
  for (let i = first; i < first + 16; i += 1) {
    const wx = i * 78 + noise(i * 2.9) * 40;
    const sx = wx - shift;
    if (sx < -60 || sx > W + 60) continue;
    const size = 26 + noise(i * 1.7) * 30;
    const baseY = 214 + noise(i * 4.3) * 12;
    ctx.fillStyle = '#1f4d3a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (let tier = 0; tier < 3; tier += 1) {
      const ty = baseY - tier * size * 0.32;
      const tw = size * (0.55 - tier * 0.13);
      ctx.beginPath(); ctx.moveTo(sx - tw, ty); ctx.lineTo(sx, ty - size * 0.5); ctx.lineTo(sx + tw, ty); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#f4f8fc';
    ctx.beginPath(); ctx.moveTo(sx - size * 0.16, baseY - size * 0.64 - size * 0.42); ctx.lineTo(sx, baseY - size * 0.64 - size * 0.5); ctx.lineTo(sx + size * 0.16, baseY - size * 0.64 - size * 0.42); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(60, 90, 130, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, ICE_FAR_Y + 1); ctx.lineTo(W, ICE_FAR_Y + 1); ctx.stroke();
}

/** The signpost where she climbs out, at the far shore's scale; `pop` springs it up out of the snow. */
function drawExitSign(ctx: CanvasRenderingContext2D, x: number, pop: number): void {
  ctx.save();
  ctx.translate(x, ICE_FAR_Y - 4);
  ctx.rotate(-0.05);
  ctx.scale(0.58 * pop, 0.58 * pop);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -58); ctx.stroke();
  ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 5; ctx.stroke();
  // An arrow-cut plank, pointing on along the shore.
  ctx.fillStyle = '#9c6b3a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-46, -92); ctx.lineTo(40, -92); ctx.lineTo(56, -70); ctx.lineTo(40, -48); ctx.lineTo(-46, -48); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4f8fc';
  ctx.beginPath(); ctx.moveTo(-48, -91); ctx.quadraticCurveTo(-30, -101, -12, -93); ctx.quadraticCurveTo(8, -99, 24, -93); ctx.quadraticCurveTo(34, -97, 41, -91); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff4d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 18px ${MEME_FONT}`;
  ctx.fillText('EXIT', -1, -72, 80);
  ctx.font = `900 16px ${MEME_FONT}`;
  ctx.fillText('LIQUIDITY', -1, -54, 80);
  ctx.restore();
}

/** A small label pointing down at someone on the ice: YOU over her when you are in, the ghost's name over it. */
function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, k: number, colour: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.font = `900 14px ${MEME_FONT}`;
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(20, 24, 36, 0.88)';
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-w / 2, -21, w, 18, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, -3.5); ctx.lineTo(0, 2); ctx.lineTo(5, -3.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -11.5);
  ctx.restore();
}

/**
 * Her liquidation price, which the engine lasers onto the ice a stride ahead of her: a dashed red line across her
 * path, closing in with the tension.
 */
function drawLiqLine(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, alpha: number, from: Point): void {
  const top = y - 30 * scale;
  const bottom = y + 24 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255, 60, 80, 0.09)';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(x, top); ctx.lineTo(x, bottom); ctx.closePath(); ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(120, 10, 30, 0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  ctx.strokeStyle = '#ff4d6d';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `900 ${Math.round(13 * scale)}px ${MEME_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ff4d6d';
  ctx.fillText('LIQ PRICE', x + 6, bottom - 2);
  ctx.restore();
}

/** Where the multiplier readout's lettering starts on the left: it grows leftward from x 930 as the number gets longer. */
function readoutLeft(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = `900 66px ${MEME_FONT}`;
  return 930 - Math.min(READOUT_MAX_WIDTH, ctx.measureText(text).width) - border(66) / 2;
}

function drawReadout(ctx: CanvasRenderingContext2D, view: SceneView, text: string, dead: boolean): void {
  const colour = dead ? '#ff4d6d' : view.phase === 'running' ? '#ffffff' : '#ffe08a';
  ctx.save();
  if (view.phase !== 'running' && !dead) ctx.globalAlpha = 0.85;
  memeText(ctx, text, 930, 80, 66, colour, 'right', READOUT_MAX_WIDTH);
  ctx.restore();
}

/**
 * The caption, centred on x 430 while it fits there. A long multiplier pushes it left to stay clear of the
 * readout, and only once it reaches the left edge does it narrow; `scale` is its pop.
 */
function drawCaption(ctx: CanvasRenderingContext2D, caption: string, scale: number, readoutAt: number): void {
  ctx.font = `900 46px ${MEME_FONT}`;
  const edge = border(46) / 2;
  const right = readoutAt - HUD_GAP;
  const width = Math.min(560, ctx.measureText(caption).width, (right - HUD_GAP) / scale - 2 * edge);
  ctx.save();
  ctx.translate(Math.min(430, right - scale * (width / 2 + edge)), 68);
  ctx.scale(scale, scale);
  memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', width);
  ctx.restore();
}

/** The top of a skater's head on screen, from the neck drawSkater returns and her lean: where a tag points. */
const headTop = (neck: Point, lean: number, scale: number): Point => ({ x: neck.x + (7 * Math.cos(lean) + 31 * Math.sin(lean)) * scale, y: neck.y + (7 * Math.sin(lean) - 31 * Math.cos(lean)) * scale });

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });
  const ice: IceState = createIce();
  const skater: SkaterState = createSkater();
  const engine: EngineState = createEngine();
  const camera = spring(-SKATER_SCREEN_X);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const exitSign = spring(0);
  /** The camera's punch into the hole. */
  const punch = spring(0);
  /** The YOU tag over her while you have a bet on, the LIQ PRICE line while the long is open, and the ghost. */
  const you = spring(0);
  const liq = spring(0);
  const ghostFade = spring(0);
  const stars: Flake[] = Array.from({ length: 60 }, (_, i) => ({ x: noise(i * 3.1) * W, y: 6 + noise(i * 7.7) * 150, r: 0.6 + noise(i * 1.3) * 1.4, k: 1 + noise(i * 5.9) * 2 }));
  const flakes: Flake[] = Array.from({ length: 90 }, (_, i) => ({ x: noise(i * 2.3) * W, y: noise(i * 4.1) * H, r: 1 + noise(i * 6.7) * 2, k: 0.5 + noise(i * 8.9) }));
  let particles: Particle[] = [];
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  /** The last outcome word and exit badge, kept so they spring away at the next round instead of vanishing. */
  let word: Outcome = 'rekt';
  let badged: Secured | null = null;
  let caption = '';
  let breathClock = 0;
  /** World x of the exit sign, set where she climbs onto the bank; `exitUp` keeps it up until the next round. */
  let exitAt: number | null = null;
  let exitUp = false;
  /** Seconds until the ice gives after it snaps (-1 with no break pending), and where it snapped. */
  let fuse = -1;
  let fuseAt: Point = { x: 0, y: 0 };
  let freeze = 0;
  let slow = 0;
  let slowRate = SLOW_RATE;
  let punchHold = 0;
  /** Sound gates: the splash once someone is in, the bubbles, the whistle for the bank, the survivors' gasp, the drone's siren. */
  let splashed = false;
  let bubbleClock = 0;
  let onBank = false;
  let gasped = false;
  let sirenIn = -1;
  let scarfPlaced = false;
  let scarfX = 0;
  /** Where this round's distance counts from. */
  let startX = 0;
  /** Near misses already raced this round, and scene seconds until the racing crack runs out of steam (-1: none). */
  let nearSeen = 0;
  let nearIn = -1;
  /** How far ahead of her the liquidation price rides, in world px. */
  let liqGap = 150;
  /** The bagholders' reach and her thinning ice, eased so they sink back or fade rather than snap at a phase edge. */
  let handTension = 0;
  let thinHer = 1;
  /**
   * The next long: after her exit a translucent skater carries on along her line, so the crash still has someone to
   * take. `victim` is whoever is out on the ice when it snaps: her, the ghost, or nobody (it breaks where she left it).
   */
  let ghost: SkaterState | null = null;
  let ghostSpeed = 0;
  let ghostName = -1;
  let ghostCanvas: HTMLCanvasElement | null = null;
  let sinceExit = 0;
  let victim: SkaterState | null = null;

  function emit(p: Particle): void {
    if (particles.length > 500) particles.shift();
    particles.push(p);
  }

  const onTheIce = (s: SkaterState): boolean => s.mode === 'skating' || s.mode === 'idle' || (s.mode === 'toShore' && s.depth.x < 0.95);
  const nearCount = (multiplier: number, seconds: number): number => NEAR_MISSES.filter((m) => multiplier >= m).length + (seconds >= 45 ? 1 + Math.floor((seconds - 45) / 9) : 0);

  /** The ice goes where it snapped: the hole, the floes, the outcome, and the beats round it. */
  function shatter(view: SceneView): void {
    shatterIce(ice, fuseAt.x, fuseAt.y, view.currentX100, false);
    outcome = view.stake === null ? 'crack' : secured ? 'called' : 'rekt';
    iceBroke(skater);
    if (ghost !== null && victim === ghost) iceBroke(ghost);
    shake = 1;
    pop.v = 16;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
      slowRate = SLOW_RATE;
      // The camera snaps in on the hole for the hit-stop, holds, then eases back out.
      punch.x = 0.85;
      punch.v = 0;
      punchHold = FREEZE_S + PUNCH_HOLD_S;
    }
    audio.crash('shatter');
    sirenIn = 0.8;
  }

  /** The ghost, composed off-screen so it lies over the lake as one translucent, frost-tinted figure, its name over it. */
  function drawGhost(ctx: CanvasRenderingContext2D, g: SkaterState, cameraX: number, alpha: number, dt: number): void {
    const depth = clamp(g.depth.x, 0, 1);
    const scale = iceScale(depth) * 1.18;
    const x = g.x - cameraX;
    const y = iceY(depth);
    if (x < -140 || x > W + 140 || typeof document === 'undefined') return;
    const res = clamp(Math.ceil(Math.abs(ctx.getTransform().a) * 2) / 2, 1, 3); // in steps, so a punch-in does not resize it every frame
    ghostCanvas ??= document.createElement('canvas');
    if (ghostCanvas.width !== Math.ceil(300 * res) || ghostCanvas.height !== Math.ceil(260 * res)) {
      ghostCanvas.width = Math.ceil(300 * res);
      ghostCanvas.height = Math.ceil(260 * res);
    }
    const gc = ghostCanvas.getContext('2d')!;
    gc.setTransform(1, 0, 0, 1, 0, 0);
    gc.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
    gc.setTransform(res, 0, 0, res, 0, 0);
    const at = { x: 170, y: 214, scale };
    const wet = g.mode === 'plunge' || g.mode === 'swimming';
    gc.save();
    if (wet) { gc.beginPath(); gc.rect(0, 0, 300, at.y + 4 * scale); gc.clip(); }
    const neck = drawSkater(gc, g, at, true);
    gc.restore();
    if (dt > 0) stepScarf(g, neck, dt);
    gc.globalCompositeOperation = 'source-atop';
    gc.fillStyle = 'rgba(175, 220, 255, 0.55)';
    gc.fillRect(0, 0, 300, 260);
    gc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = 0.5 * alpha;
    ctx.drawImage(ghostCanvas, x - at.x, y - at.y, 300, 260);
    ctx.restore();
    if (wet) {
      ctx.strokeStyle = `rgba(200, 225, 255, ${0.5 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 4 * scale, 30 * scale, 9 * scale, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const top = headTop({ x: neck.x - at.x + x, y: neck.y - at.y + y }, g.lean.x, scale);
    ctx.save();
    ctx.globalAlpha = 0.8 * alpha;
    drawTag(ctx, GHOSTS[Math.max(0, ghostName)]!, top.x, top.y - 6 * scale, 0.9 * scale, '#bfe0ff');
    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number, close = false): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the plunge runs slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * slowRate;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // Tension sweeps most of its range across 1×–3×, where nearly every round is played (0.33 at 1.5×, 0.5 at 2×,
    // 0.67 at 3×, 0.9 at 10×); the log-based growth keeps her speed and the crack bursts changing in long rounds.
    const growth = Math.log2(multiplier);
    const tension = 1 - 1 / multiplier;
    const fear = clamp((tension - 0.08) / 0.8, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) audio.cashout();
    }
    const drive: SkaterDrive = { speed: running ? 120 + 220 * (1 - Math.exp(-growth / 2)) : 0, fear };

    // Phase edges: joining late, the break, and a fresh lake for the next round.
    if (previous === null) {
      // A round met part-way through settles into place: out on the ice, or already on the bank once her exit
      // was accepted. One met after the crash then breaks through the same edge as a watched one, which keeps
      // an old crash quiet and takes the outcome from the player's bet.
      const live = running || crashed;
      settleSkater(skater, live, live && secured !== null, drive);
      if (live) {
        skater.x = journeyDistance(view.elapsed / 1000, growth);
        // Where she left the ice, if she is already on the bank: the break goes there when no one else is out on it.
        skater.lastIce.x = skater.x;
        settleJourney(ice, skater.x, iceY(skater.depth.x), tension, view.elapsed / 1000);
      }
      // The camera is a critically damped spring at ω 3, so it trails a skater at speed v by 2v/3: start it there.
      camera.x = skater.x - SKATER_SCREEN_X - (skater.speed * 2) / 3;
      camera.v = skater.speed;
      if (secured) {
        settleSpring(badge, 1);
        sinceExit = 10;
      }
      if (skater.mode === 'shore') {
        exitAt = skater.x + EXIT_AHEAD;
        exitUp = true;
        settleSpring(exitSign, 1);
        onBank = true;
      }
      settleSpring(you, view.stake !== null ? 1 : 0);
      nearSeen = running ? nearCount(multiplier, view.elapsed / 1000) : 0;
      liqGap = mix(150, 48, tension);
      if (running && !secured) settleSpring(liq, 1);
      handTension = running ? tension : 0;
      settleEngine(engine, { seconds: view.elapsed / 1000, running, crashed: false, tension, safe: skater.mode === 'shore' || skater.mode === 'toShore', holeX: null, clearOf: null, line: engineLine(crashed ? 'running' : view.phase, multiplier, secured ? secured.x100 / 100 : null, null, view.stake === null) });
      previous = crashed ? 'running' : view.phase;
    }
    if (view.phase !== previous) {
      if (crashed && !ice.shattered && fuse < 0) {
        const quiet = view.crashAge > 1500;
        // An exit accepted while no running frame was drawn (a hidden tab) still gets her off the ice.
        if (secured) headForShore(skater);
        // Whoever is out on the ice takes the break: her, or after her exit the next long if it is in the picture.
        const ghostIn = ghost !== null && ghost.mode === 'skating' && Math.abs(ghost.x - camera.x - W / 2) < W / 2 - 60;
        victim = onTheIce(skater) ? skater : ghostIn && !quiet ? ghost : null;
        // A skater out on the ice brakes hard through the fuse, so it snaps where she will stop. Her exit already in,
        // she is carving away: it snaps in her wake, about half a second behind her, and she gets clear across the floes.
        const ahead = quiet || !victim ? 0 : BRAKE_S * (1 - Math.exp(-FUSE_S / BRAKE_S));
        fuseAt = !victim ? { ...skater.lastIce }
          : victim.mode === 'toShore' ? { x: victim.x - victim.speed * 0.45, y: iceY(clamp(victim.depth.x - victim.depth.v * 0.45, 0, 1)) + 10 }
          : { x: victim.x + victim.speed * ahead, y: iceY(victim.depth.x) };
        if (quiet) {
          shatterIce(ice, fuseAt.x, fuseAt.y, view.currentX100, true);
          outcome = view.stake === null ? 'crack' : secured ? 'called' : 'rekt';
          iceBroke(skater);
          pop.x = 1;
          if (skater.mode === 'plunge') settleSwimming(skater);
          if (skater.mode === 'shore' && exitAt === null) {
            exitAt = skater.x + EXIT_AHEAD;
            exitUp = true;
            settleSpring(exitSign, 1);
          }
          splashed = true;
          onBank = skater.mode === 'shore';
          gasped = true;
          audio.crash('shatter', true);
        } else {
          // The ice snaps all round them first: a ring of cracks and a creak, then it gives a few frames later.
          fuse = FUSE_S;
          slow = 0;
          nearIn = -1;
          if (victim) brace(victim);
          for (let i = 0; i < 7; i += 1) {
            const a = (i / 7) * Math.PI * 2;
            spawnCrack(ice, fuseAt.x + Math.cos(a) * 34, fuseAt.y + Math.sin(a) * 34 * FORESHORTEN, 1, view.currentX100 * 0.01 + i * 3);
          }
          for (const c of ice.cracks.slice(-14)) c.growth = Math.max(c.growth, 0.4);
          audio.fx('creak', 1.5);
        }
      }
      if (view.phase === 'betting') {
        // The next round: the lake refreezes over the break, she heads back out to her mark, the sign goes down.
        refreezeIce(ice);
        rejoinSkater(skater);
        outcome = null;
        secured = null;
        exitUp = false;
        fuse = -1;
        freeze = slow = punchHold = 0;
        splashed = false;
        onBank = false;
        gasped = false;
        sirenIn = -1;
        startX = skater.x;
        nearSeen = 0;
        nearIn = -1;
        sinceExit = 0;
        victim = null;
      }
      if (running) {
        if (ice.refreezing) resetIce(ice);
        if (skater.mode === 'idle') skater.mode = 'skating';
      }
      previous = view.phase;
    }
    if (fuse >= 0) {
      fuse -= real;
      if (fuse < 0 && !ice.shattered) shatter(view);
    }
    audio.update(view.phase, tension);
    if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    if (secured && running && (skater.mode === 'skating' || skater.mode === 'idle')) headForShore(skater);

    stepSkater(skater, drive, dt);
    // After her exit the next long skates on along her line, in from the left edge, lap after lap until the round ends;
    // it wraps far enough off-screen that its thinning patch goes with it.
    if (secured) sinceExit += dt;
    if (secured && running && ghost === null && sinceExit > 0.4) {
      ghost = createSkater();
      ghost.mode = 'skating';
      ghost.x = camera.x - 160;
      ghost.speed = drive.speed;
      ghostName = (ghostName + 1) % GHOSTS.length;
    }
    if (ghost) {
      if (running) ghostSpeed = drive.speed;
      stepSkater(ghost, { speed: ghostSpeed, fear }, dt);
      if (running && ghost.mode === 'skating' && ghost.x - camera.x > W + 160) {
        ghost.x = camera.x - 160;
        ghostName = (ghostName + 1) % GHOSTS.length;
      }
      // One the ice missed fades from the picture with the round; one it took stays in the hole until the next.
      stepSpring(ghostFade, running || (crashed && victim === ghost) ? 1 : 0, 6, 1, dt);
      if (!running && ghostFade.x < 0.02) ghost = null;
    }
    if (skater.mode === 'shore' && exitAt === null) {
      exitAt = skater.x + EXIT_AHEAD;
      exitUp = true;
    }
    stepSpring(exitSign, exitUp ? 1 : 0, exitUp ? 12 : 8, exitUp ? 0.45 : 1, dt);
    if (!exitUp && exitSign.x < 0.02) exitAt = null;
    // The camera follows her; once she is safe it pans only as far as it must to keep the break in the picture too.
    let follow = skater.x - SKATER_SCREEN_X;
    if (ice.shattered && !ice.refreezing && (skater.mode === 'shore' || skater.mode === 'toShore')) follow = clamp(clamp(follow, ice.shatterAt.x - 640, ice.shatterAt.x - 260), skater.x - 860, skater.x - 100);
    stepSpring(camera, follow, 3, 1, dt);
    const cameraX = camera.x;
    const depth = clamp(skater.depth.x, 0, 1);
    // She steps up onto the bank as she reaches it, rather than jumping up at the switch.
    const place = { x: skater.x - cameraX, y: iceY(depth) - 6 * smoothstep(0.93, 1, depth), scale: iceScale(depth) * 1.18 };
    const onIce = onTheIce(skater);
    /** Whoever is out on the ice for the cracks and the bagholders: her, or the next long after her exit. */
    const out = onIce ? skater : ghost !== null && ghost.mode === 'skating' ? ghost : null;
    // The bank: a whistle and a burst of confetti as she climbs out, once.
    if (skater.mode === 'shore' && !onBank) {
      onBank = true;
      audio.fx('whistle', 0.9);
      for (let i = 0; i < 40; i += 1) {
        const a = -Math.PI * (0.15 + noise(i * 1.9) * 0.7);
        const sp = 90 + noise(i * 2.7) * 200;
        emit({ kind: 'confetti', x: skater.x + (noise(i * 3.3) - 0.5) * 30, y: place.y - 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2.5, age: 0, life: 1.3 + noise(i) * 0.6, colour: CONFETTI[i % CONFETTI.length] });
      }
    }
    // The splash lands when whoever went in does, a few frames after the ice goes.
    const diver = victim !== null && (victim.mode === 'plunge' || victim.mode === 'swimming') ? victim : null;
    if (!splashed && diver && diver.mode === 'plunge' && diver.plunge > 16) {
      splashed = true;
      audio.fx('splash', 1);
      const at = { x: diver.x, y: iceY(clamp(diver.depth.x, 0, 1)) };
      for (let i = 0; i < 26; i += 1) {
        const a = -Math.PI * (0.2 + noise(i * 1.7) * 0.6);
        const sp = 120 + noise(i * 2.3) * 260;
        emit({ kind: 'splash', x: at.x + (noise(i * 3.1) - 0.5) * 40, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + noise(i * 4.7) * 3, age: 0, life: 0.7 + noise(i) * 0.4 });
      }
    }
    // Skates hiss on each push off the back foot.
    if (running && skater.events.push === 0 && onIce && skater.speed > 40) audio.fx('hiss', 0.25 + 0.4 * tension);
    bubbleClock -= dt;
    if (diver && diver.mode === 'swimming' && bubbleClock <= 0) {
      bubbleClock = 0.9 + noise(time) * 0.5;
      audio.fx('bubble', 0.5 + noise(time * 3) * 0.6);
    }

    // Trails, spray and breath.
    if (onIce && skater.speed > 20) {
      for (const which of [0, 1] as const) {
        const foot = footScreen(skater, which, place.x, place.y, place.scale);
        if (foot.onIce) addTrail(ice, which, { x: foot.x + cameraX, y: foot.y });
      }
    }
    if (skater.events.push >= 0 && onIce && skater.speed > 40) {
      const foot = footScreen(skater, skater.events.push as 0 | 1, place.x, place.y, place.scale);
      for (let i = 0; i < 7; i += 1) {
        emit({ kind: 'spray', x: foot.x + cameraX, y: foot.y, vx: -60 - noise(time * 7 + i) * 140, vy: -40 - noise(time * 11 + i) * 90, r: 1.2 + noise(time * 13 + i) * 1.6, age: 0, life: 0.45 + noise(i) * 0.3 });
      }
    }
    breathClock += dt;
    if (skater.mode === 'idle' && breathClock > 2.6) {
      breathClock = 0;
      emit({ kind: 'breath', x: skater.x + 14 * place.scale, y: place.y - 62 * place.scale, vx: 12, vy: -8, r: 3, age: 0, life: 1.6 });
    }
    if (diver && diver.mode === 'swimming' && noise(Math.floor(time * 6)) > 0.6 && breathClock > 0.35) {
      breathClock = 0;
      emit({ kind: 'bubble', x: diver.x + (noise(time) - 0.5) * 30, y: iceY(clamp(diver.depth.x, 0, 1)) + 4, vx: 0, vy: -20, r: 1.5 + noise(time * 3) * 2, age: 0, life: 1.2 });
    }
    for (const p of particles) {
      p.age += dt;
      if (p.kind === 'spray' || p.kind === 'splash') { p.vy += 500 * dt; p.vx *= Math.exp(-1.5 * dt); }
      if (p.kind === 'confetti') { p.vy += 260 * dt; p.vx *= Math.exp(-1.2 * dt); }
      if (p.kind === 'breath') { p.r += 6 * dt; p.vy -= 4 * dt; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.age < p.life);

    // Near misses: a crack races in at her from behind and runs out of steam just short of her back blade.
    if (running) {
      const due = nearCount(multiplier, view.elapsed / 1000);
      if (due > nearSeen) {
        nearSeen = due;
        if (!secured && skater.mode === 'skating' && fuse < 0 && !ice.shattered) {
          const y = iceY(depth);
          const end = skater.x + skater.speed * RACE_S + rearBlade(skater, RACE_S) * place.scale - 10;
          spawnRacer(ice, { x: end - 200 - 80 * tension, y: y + 44 }, { x: end, y: y + 2 }, RACE_S, 2.2 + 1.6 * tension, due * 7.31 + 0.5);
          nearIn = RACE_S;
          audio.fx('creak', 0.8 + 0.6 * tension);
        }
      }
    }
    if (nearIn >= 0) {
      nearIn -= dt;
      if (nearIn < 0 && fuse < 0 && !ice.shattered) {
        // It stops short: she flinches, and the moment hangs for a beat.
        skater.brace.v += 9;
        skater.lean.v -= 1.2;
        if (!reduced) {
          slow = 0.12;
          slowRate = 0.35;
        }
        audio.fx('heartbeat', 0.8);
      }
    }
    // The ice keeps failing round whoever is out on it, or where she left it, creaking while you are still in.
    if (running && !ice.shattered) {
      ice.crackClock += dt;
      const interval = mix(2, 0.5, tension);
      while (ice.crackClock > interval) {
        ice.crackClock -= interval;
        const at = out ? { x: out.x, y: iceY(out.depth.x) } : skater.lastIce;
        const count = 1 + Math.floor(tension * 2) + Math.min(2, Math.floor(growth / 4));
        for (let i = 0; i < count; i += 1) spawnCrack(ice, at.x + (noise(time * 5 + i) - 0.5) * 70, at.y + (noise(time * 9 + i) - 0.5) * 26, tension, time * 31 + i * 7);
        if (!secured) audio.fx('creak', 0.3 + 0.6 * tension);
      }
    }
    // The bagholders thaw and reach for whoever skates over them; after the break a few come up on the floes.
    handTension += ((running || fuse >= 0 ? tension : 0) - handTension) * (1 - Math.exp(-dt * 4));
    thinHer += ((secured ? 0 : 1) - thinHer) * (1 - Math.exp(-dt / 0.6));
    if (running && out) stepBagholders(ice, cameraX, out.x, tension, dt);
    stepIce(ice, cameraX, dt);
    if (ice.events.surfaced && !gasped) {
      gasped = true;
      audio.fx('gasp', 0.8);
    }
    // The liquidation engine: it closes in with the tension, backs off when she is safe, and hovers over the hole.
    const engineDrive: EngineDrive = {
      seconds: view.elapsed / 1000,
      running, crashed: ice.shattered && !ice.refreezing, tension: running ? tension : 0,
      safe: (skater.mode === 'shore' || skater.mode === 'toShore') && !(ghost !== null && victim === ghost),
      // Where the hole settles on screen once the camera has caught up, so the drone picks its side once.
      holeX: ice.shattered ? ice.shatterAt.x - follow : null,
      clearOf: ghost !== null && victim === ghost ? skater.x - follow : null,
      line: engineLine(fuse >= 0 ? 'running' : view.phase, multiplier, secured ? secured.x100 / 100 : null, outcome, view.stake === null),
    };
    if (stepEngine(engine, engineDrive, dt) && (running || crashed)) audio.fx('beep', outcome ? 0.6 : 0.8 + 0.5 * tension);
    if (sirenIn >= 0) {
      sirenIn -= real;
      if (sirenIn < 0) audio.fx('siren', 0.45);
    }
    // Her liquidation price rides a stride ahead while the long is open, closing in with the tension; at the crash
    // it catches her.
    stepSpring(liq, (running && !secured && skater.mode === 'skating') || (fuse >= 0 && skater.braced) ? 1 : 0, 10, 1, dt);
    liqGap += ((fuse >= 0 || ice.shattered ? 0 : mix(150, 48, tension)) - liqGap) * (1 - Math.exp(-dt * (fuse >= 0 ? 30 : 4)));

    if (outcome) word = outcome;
    if (secured) badged = secured;
    stepSpring(pop, outcome ? 1 : 0, 16, outcome ? 0.45 : 1, dt);
    stepSpring(badge, secured ? 1 : 0, 14, secured ? 0.5 : 1, dt);
    punchHold -= real;
    stepSpring(punch, punchHold > 0 ? 1 : 0, punchHold > 0 ? 14 : 4, punchHold > 0 ? 0.7 : 1, dt);
    stepSpring(you, view.stake !== null ? 1 : 0, 10, 0.6, dt);
    // Through the fuse the round is over but she is still up: the HUD keeps reading as running until the ice goes.
    const shown: SceneView = fuse >= 0 ? { ...view, phase: 'running' } : view;
    const nextCaption = captionFor(shown, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 8 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    if (!reduced && punch.x > 0.005 && ice.shattered) {
      // The camera punches in on the hole and eases back out.
      const k = 1 + 0.1 * clamp(punch.x, 0, 1.2);
      const px = clamp(ice.shatterAt.x - cameraX, 0, W);
      const py = ice.shatterAt.y;
      ctx.translate(px, py);
      ctx.scale(k, k);
      ctx.translate(-px, -py);
    }
    drawSky(ctx, time, stars, reduced);
    drawMountains(ctx, cameraX);
    drawShore(ctx, cameraX);
    if (exitAt !== null && exitSign.x > 0.02) drawExitSign(ctx, exitAt - cameraX, clamp(exitSign.x, 0, 1.3));
    drawIce(ctx, ice, cameraX, time);
    drawBagholders(ctx, ice, cameraX, time, handTension);
    if (running && !ice.shattered) {
      const her = onIce ? place : { x: skater.lastIce.x - cameraX, y: skater.lastIce.y };
      if (thinHer > 0.01) drawThinning(ctx, her.x, her.y, tension, time, thinHer);
      if (ghost !== null && ghost.mode === 'skating') drawThinning(ctx, ghost.x - cameraX, iceY(ghost.depth.x), tension, time, ghostFade.x);
    }
    drawCracks(ctx, ice, cameraX);
    if (liq.x > 0.02) drawLiqLine(ctx, place.x + liqGap, place.y, place.scale, clamp(liq.x, 0, 1), { x: engine.x.x - 34, y: engine.y.x + 12 });
    // The break stays on the lake even when it happens right by the bank.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, ICE_FAR_Y, W + 40, H - ICE_FAR_Y + 20);
    ctx.clip();
    drawShatter(ctx, ice, cameraX, time);
    ctx.restore();
    // Reflection glides under her while she is out on the dry ice.
    const dry = 1 - clamp(skater.plunge / 12, 0, 1);
    if (onIce && depth < 0.95 && dry > 0.01) {
      ctx.save();
      ctx.globalAlpha = 0.22 * dry;
      ctx.translate(0, place.y);
      ctx.scale(1, -0.5);
      ctx.translate(0, -place.y);
      drawSkater(ctx, skater, place, false);
      ctx.restore();
    }
    const inWater = skater.mode === 'plunge' || skater.mode === 'swimming' || skater.plunge > 0.5;
    if (inWater) {
      // Only what is above the water line shows; the hole's water is already under her.
      ctx.save();
      ctx.beginPath();
      ctx.rect(-20, -20, W + 40, place.y + 4 * place.scale + 20);
      ctx.clip();
    }
    const neck = drawSkater(ctx, skater, place, true);
    if (inWater) {
      ctx.restore();
      ctx.strokeStyle = `rgba(200, 225, 255, ${0.55 * clamp(skater.plunge / 20, 0, 1)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(place.x, place.y + 4 * place.scale, 30 * place.scale, 9 * place.scale, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // The scarf trails in her own frame: a camera pan carries it along with her rather than stretching it out behind.
    for (const link of skater.scarf) link.x += place.x - scarfX;
    scarfX = place.x;
    // The scarf is placed on the first frame and then only stepped with real time, so a hit-stop holds it too.
    if (!scarfPlaced || dt > 0) {
      stepScarf(skater, neck, scarfPlaced ? dt : 0);
      scarfPlaced = true;
    }
    if (ghost !== null && ghostFade.x > 0.02) drawGhost(ctx, ghost, cameraX, clamp(ghostFade.x, 0, 1), dt);
    // You are her while you have a bet on; a spectator just watches someone else's long.
    // Up on the shore the badge says whose exit it was, and her tag would only crowd it.
    if (you.x > 0.03 && skater.mode !== 'shore' && skater.mode !== 'toShore') {
      const top = headTop(neck, skater.lean.x, place.scale);
      drawTag(ctx, 'YOU', top.x, top.y - 6 * place.scale, clamp(you.x, 0, 1.2) * place.scale, '#ffe27a');
    }
    for (const p of particles) {
      const k = 1 - p.age / p.life;
      const sx = p.x - cameraX;
      if (p.kind === 'breath') { ctx.globalAlpha = k * 0.45; ctx.fillStyle = '#ffffff'; }
      else if (p.kind === 'bubble') { ctx.globalAlpha = k * 0.8; ctx.fillStyle = '#dff1ff'; }
      else if (p.kind === 'confetti') {
        ctx.globalAlpha = Math.min(1, k * 1.8);
        ctx.fillStyle = p.colour ?? '#ffffff';
        ctx.save(); ctx.translate(sx, p.y); ctx.rotate(p.age * 9 + p.x); ctx.fillRect(-3, -2, 6, 4); ctx.restore();
        continue;
      }
      else { ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.kind === 'splash' ? '#bfe0ff' : '#ffffff'; }
      ctx.beginPath(); ctx.arc(sx, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (pop.x > 0.02) {
      // REKT if it was you; DODGED once your exit was in; CRACK! for a spectator.
      const text = word === 'rekt' ? 'REKT' : word === 'called' ? 'DODGED!' : 'CRACK!';
      ctx.font = `900 92px ${MEME_FONT}`;
      const half = (ctx.measureText(text).width / 2) * 1.3 + 16;
      const { x, y } = ice.shatterAt;
      ctx.save();
      // Above the break when there is room (clear of the survivors' signs), below it when the break is up by the bank,
      // and always whole on screen. A dodge goes low over the near floes, clear of the distance: she is up on the bank,
      // or carving clear above.
      const low = y >= 350 && word === 'called';
      ctx.translate(clamp(x - cameraX, low ? half + 60 : half, W - half), y < 350 ? y + 150 : low ? Math.min(H - 50, y + 75) : y - 140);
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 92, word === 'rekt' ? '#ff4d6d' : word === 'called' ? '#7cf67c' : '#ffe27a', 'center');
      ctx.restore();
    }
    // The drone over the word: its verdict stays readable while it flies round to the side.
    drawEngine(ctx, engine, engineDrive, reduced);
    // Snow in screen space, drifting against the skating direction.
    ctx.fillStyle = '#ffffff';
    for (const f of flakes) {
      const x = (((f.x + time * 12 * f.k - cameraX * 0.05 * f.k) % W) + W) % W;
      const y = (f.y + time * (18 + f.r * 12)) % H;
      ctx.globalAlpha = 0.35 + 0.35 * f.k;
      ctx.beginPath(); ctx.arc(x, y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // HUD in screen space. The readout is measured first so the caption can keep clear of it.
    const readout = `${multiplier.toFixed(2)}×`;
    if (caption) drawCaption(ctx, caption, 1 + 0.1 * captionPop.x, readoutLeft(ctx, readout));
    if (badged && badge.x > 0.02) {
      const text = `${badged.payout !== null ? `+${badged.payout} · ` : ''}${(badged.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(430, 114 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.03);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    drawReadout(ctx, shown, readout, outcome !== null);
    // This round's distance: from where she set off, not the session's running total.
    memeText(ctx, `${Math.max(0, Math.round((skater.x - startX) / 10))} M`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
  }

  return { draw: portrait(draw, 'THIN ICE', () => ({ x: Math.max(0, Math.min(480, skater.x - camera.x - 240)), y: 120, w: 480, h: 365 }), v => captionFor(v, Math.max(1, v.currentX100 / 100), outcome, secured)) };
}
