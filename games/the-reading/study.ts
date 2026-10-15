/**
 * The study: a wood-panelled room at four in the afternoon with rain on the window. Grandma's portrait over
 * the fireplace (her eyes are a two-dot rig with a look-at target), her armchair by the fire, the coffee table
 * with the WHEN paperweight, Gerald the deer head on his stud, the A PLACE FOR EVERYTHING sampler with a doily
 * on one pin over the rest of the sentence, the hunting cabinet, the kitchen door with the freezer humming
 * behind it, and the long mahogany table. The crash takes the walls off panel by panel around Gerald.
 * Presentation only: everything here follows the displayed multiplier, the round clock and the crash age.
 */
import { blit, blob, box, ink, INK, label, poly, sprite } from './ink';
import { clamp, fract, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

// ---- Layout, in the 960 × 540 frame ------------------------------------------------------------------------

export const FLOOR_Y = 330;
export const TABLE = { x0: 396, x1: 892, back: 352, front: 404, apron: 424, foot: 480 } as const;
export const WINDOW = { x: 14, y: 66, w: 102, h: 172 } as const;
export const CHIMNEY = { x0: 128, x1: 312 } as const;
export const PORTRAIT = { x: 138, y: 58, w: 164, h: 148 } as const;
/** Grandma's eyes in the painting. */
export const EYES = { l: { x: 209, y: 111 }, r: { x: 231, y: 111 } } as const;
/** The fire's base centre, inside the fireplace. */
export const HEARTH = { x: 220, y: 326 } as const;
export const GERALD = { x: 665, y: 126 } as const;
export const STUD = { x0: 657, x1: 673 } as const;
export const SAMPLER = { x: 732, y: 88, w: 116, h: 114 } as const;
/** The doily's one pin. */
export const PIN = { x: 790, y: 140 } as const;
export const CABINET = { x: 728, y: 214, w: 124, h: 116 } as const;
export const DOORWAY = { x: 872, y: 148 } as const;
export const FREEZER = { x: 888, y: 168, w: 62, h: 162 } as const;
export const COFFEE = { x: 62, y: 452, w: 240, h: 30 } as const;
/** Where the WHEN paperweight sits on the envelope. */
export const WHEN = { x: 140, y: 462 } as const;

/**
 * The crash, in seconds of the scene's crash clock: when each of the README's beats lands. Front-loaded for the
 * live hold (the next betting phase comes about 2 s after the crash, and the scene plays the rest as an encore):
 * beats 1 to 4 inside 2 s, every beat by 5 s, the final image complete at `end`.
 */
export const BEATS = { chart: 0, will: 0.25, filing: 0.35, stamp: 0.5, doily: 1.0, eyes: 1.6, freezer: 2.2, tear: 2.7, walls: 2.9, studs: 4.3, pop: 4.4, rain: 4.8, receipt: 4.9, blink: 5.0, dark: 5.0, end: 6.0 } as const;
/** The COLLATERAL stamps land this far apart, item by item. */
export const STAMP_GAP = 0.07;

// ---- State -----------------------------------------------------------------------------------------------

interface Panel { x: number; y: number; w: number; h: number; at: number; vx: number; vy: number; spin: number }
interface StudFall { x: number; at: number; side: number }

export interface Study {
  /** Grandma's pupils, −1..1 on each axis, chasing the look-at target. */
  eyeX: Spring;
  eyeY: Spring;
  /** The doily: its swing on the pin, and an inch of drift with the tension. */
  swing: Spring;
  drift: Spring;
  /** The kitchen's drawer slams: an integrated phase, a slam owed to the reading, the door's rattle. */
  slamPhase: number;
  slamDue: number;
  slamAge: number;
  slams: number;
  rattle: Spring;
  /** The tag hung on Gerald's antler at item six, and on the freezer at item thirteen. */
  geraldTag: Spring;
  freezerTag: Spring;
  samplerTag: Spring;
  humClock: number;
  /** The seeded panel removal, built once per crash point. */
  seed: number;
  panels: Panel[];
  studs: StudFall[];
  events: { slam: boolean; hum: boolean };
}

export function createStudy(): Study {
  return {
    eyeX: spring(-0.3), eyeY: spring(0.2), swing: spring(0), drift: spring(0), slamPhase: 0, slamDue: -1, slamAge: 9, slams: 0, rattle: spring(0),
    geraldTag: spring(0), freezerTag: spring(0), samplerTag: spring(0), humClock: 0, seed: -1, panels: [], studs: [], events: { slam: false, hum: false },
  };
}

export function resetStudy(s: Study): void {
  settleSpring(s.eyeX, -0.3);
  settleSpring(s.eyeY, 0.2);
  settleSpring(s.swing, 0);
  settleSpring(s.drift, 0);
  settleSpring(s.rattle, 0);
  settleSpring(s.geraldTag, 0);
  settleSpring(s.freezerTag, 0);
  settleSpring(s.samplerTag, 0);
  s.slamPhase = 0;
  s.slamDue = -1;
  s.slamAge = 9;
  s.humClock = 0;
}

export interface StudyDrive {
  time: number;
  tension: number;
  depth: number;
  multiplier: number;
  running: boolean;
  /** Seconds since the crash, or −1 before it. */
  crash: number;
  seed: number;
  /** Where Grandma looks, in the frame, or null to read along with Peterson. */
  look: { x: number; y: number } | null;
  /** The recovery phrase hunt is on in the kitchen. */
  hunting: boolean;
}

/** The fire burns lower as the estate melts and is out at high tension; it pops once more at the crash. */
export const fireLevel = (d: Pick<StudyDrive, 'tension' | 'crash'>): number => {
  const live = 1 - smoothstep(0.1, 0.86, d.tension) * 0.96;
  return d.crash < 0 ? live : live * (1 - smoothstep(BEATS.pop - 0.4, BEATS.pop + 0.3, d.crash));
};
/** Rain on the window: heavier with the tension, stopping at the end of the crash. */
export const rainLevel = (d: Pick<StudyDrive, 'tension' | 'crash'>): number => (0.45 + 0.55 * d.tension) * (d.crash < 0 ? 1 : 1 - smoothstep(BEATS.rain, BEATS.rain + 0.7, d.crash));
/** The room goes dark at the very end. */
export const darkness = (d: Pick<StudyDrive, 'tension' | 'crash' | 'depth'>): number => (d.crash < 0 ? 0.1 * d.tension + 0.12 * d.depth : 0.16 + 0.62 * smoothstep(BEATS.dark, BEATS.dark + 0.9, d.crash));
/** The freezer's door, 0 shut to 1 swung wide, unattended. */
export const freezerOpen = (crash: number): number => (crash < BEATS.freezer ? 0 : clamp(1.15 * smoothstep(0, 0.55, crash - BEATS.freezer) - 0.15 * Math.exp(-6 * Math.max(0, crash - BEATS.freezer - 0.55)) * Math.sin(Math.max(0, crash - BEATS.freezer - 0.55) * 14), 0, 1.1));

/** Advances the set; returns the drawer slam and the freezer hiss as one-frame events. */
export function stepStudy(s: Study, d: StudyDrive, dt: number): void {
  s.events = { slam: false, hum: false };
  // Grandma's eyes: a quick saccade toward the target, then a hold. Closed at the crash (drawn from crash age).
  const tx = d.look ? clamp((d.look.x - 220) / 260, -1, 1) : 0.15;
  const ty = d.look ? clamp((d.look.y - 111) / 220, -1, 1) : 0.75;
  stepSpring(s.eyeX, tx, 16, 0.82, dt);
  stepSpring(s.eyeY, ty, 16, 0.82, dt);
  // The doily: a draught from the window sways it; the tension slides it an inch along the pin.
  stepSpring(s.swing, 0.05 * Math.sin(d.time * 0.7) + 0.04 * Math.sin(d.time * 1.9 + 1) * (0.4 + d.tension), 3.2, 0.25, dt);
  stepSpring(s.drift, d.crash < 0 ? 8 * smoothstep(0.05, 0.85, d.tension) + 2 * d.depth : s.drift.x, 1.4, 0.9, dt);
  stepSpring(s.rattle, 0, 22, 0.25, dt);
  // The hunt for the recovery phrase: drawers slam in the kitchen, keeping time with the reading.
  s.slamAge += dt;
  if (d.hunting && d.running && d.crash < 0) {
    s.slamPhase += dt * (0.22 + 0.42 * d.tension);
    let slam = false;
    if (s.slamPhase >= 1) {
      s.slamPhase -= Math.floor(s.slamPhase);
      slam = true;
    }
    if (s.slamDue >= 0) {
      s.slamDue -= dt;
      if (s.slamDue < 0) slam = true;
    }
    if (slam && s.slamAge > 0.5) {
      s.slamAge = 0;
      s.slams += 1;
      s.rattle.v += 9;
      s.events.slam = true;
    }
  } else s.slamDue = -1;
  // The freezer hums louder with the tension; now and then it hisses.
  if (d.running && d.crash < 0) {
    s.humClock += dt * (0.08 + 0.12 * d.tension);
    if (s.humClock >= 1) {
      s.humClock -= 1;
      s.events.hum = true;
    }
  }
  for (const tag of [s.geraldTag, s.freezerTag, s.samplerTag]) stepSpring(tag, tag.x > 0.01 || tag.v !== 0 ? 1 : 0, 9, 0.35, dt);
  if (d.crash >= 0 && s.seed !== d.seed) buildCrash(s, d.seed);
}

/** A slam owed to a line just read: it lands a beat later. */
export const slamOnLine = (s: Study): void => {
  if (s.slamDue < 0) s.slamDue = 0.35;
};

/** Settles the eyes, the doily and the tags for a scene that missed the start of the round. */
export function settleStudy(s: Study, d: StudyDrive, tags: { gerald: boolean; freezer: boolean; sampler: boolean }): void {
  const tx = d.look ? clamp((d.look.x - 220) / 260, -1, 1) : 0.15;
  const ty = d.look ? clamp((d.look.y - 111) / 220, -1, 1) : 0.75;
  settleSpring(s.eyeX, tx);
  settleSpring(s.eyeY, ty);
  settleSpring(s.drift, 8 * smoothstep(0.05, 0.85, d.tension) + 2 * d.depth);
  settleSpring(s.geraldTag, tags.gerald ? 1 : 0);
  settleSpring(s.freezerTag, tags.freezer ? 1 : 0);
  settleSpring(s.samplerTag, tags.sampler ? 1 : 0);
  if (d.crash >= 0) buildCrash(s, d.seed);
}

/** Hangs a tag (it swings in on a spring). */
export const hangTag = (tag: Spring): void => {
  if (tag.x < 0.02) tag.v = 7;
};

// ---- The walls coming off: seeded from the crash point -----------------------------------------------------

const COLUMNS: readonly [number, number][] = [[0, 64], [64, 128], [312, 384], [384, 456], [456, 528], [528, 600], [600, STUD.x0], [STUD.x1, 740], [740, 806], [806, 862], [862, 960]];
const ROWS: readonly [number, number][] = [[0, 110], [110, 220], [220, FLOOR_Y]];
const STUD_XS = [64, 384, 456, 528, 600, 740, 806, 862];

function buildCrash(s: Study, seed: number): void {
  s.seed = seed;
  const r = mulberry32(seed * 7 + 11);
  s.panels = [];
  for (const [x0, x1] of COLUMNS) {
    for (const [y0, y1] of ROWS) {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // Furthest from Gerald go first; the panels around him go last.
      const near = 1 - clamp(Math.hypot(cx - GERALD.x, (cy - GERALD.y) * 1.4) / 640, 0, 1);
      s.panels.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, at: BEATS.walls + 0.8 * near + 0.45 * r(), vx: (cx < GERALD.x ? -1 : 1) * (60 + 160 * r()), vy: -(140 + 200 * r()), spin: (r() - 0.5) * 5 });
    }
  }
  s.studs = STUD_XS.map((x) => ({ x, at: BEATS.studs + 0.4 * r(), side: r() < 0.5 ? -1 : 1 }));
}

/** How far the wall panels have come off: 0 intact, 1 all gone (for lighting and the rain). */
export function wallsGone(crash: number): number {
  return crash < 0 ? 0 : smoothstep(BEATS.walls, BEATS.walls + 2.4, crash);
}

// ---- Drawing: the static room, cached ------------------------------------------------------------------------

const WOOD = { base: '#4f2c1d', panel: '#5e3524', dark: '#341b11', light: '#7c4a30', grain: 'rgba(40, 18, 8, 0.35)', rail: '#43251a' } as const;

function raisedPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  ctx.fillStyle = WOOD.dark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = WOOD.panel;
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  // Bevels: lit from the window on the left.
  ctx.fillStyle = WOOD.light;
  ctx.fillRect(x + 3, y + 3, 3, h - 6);
  ctx.fillRect(x + 3, y + 3, w - 6, 2);
  ctx.fillStyle = 'rgba(20, 8, 4, 0.45)';
  ctx.fillRect(x + w - 6, y + 3, 3, h - 6);
  ctx.fillRect(x + 3, y + h - 5, w - 6, 2);
  ctx.strokeStyle = WOOD.grain;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const gx = x + 10 + (w - 20) * noise(seed + i * 3.7);
    ctx.beginPath();
    ctx.moveTo(gx, y + 8);
    ctx.bezierCurveTo(gx + 6, y + h * 0.3, gx - 6, y + h * 0.6, gx + 3, y + h - 8);
    ctx.stroke();
  }
}

function paintWalls(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = WOOD.base;
  ctx.fillRect(0, 0, 960, FLOOR_Y);
  // Upper panels between stiles, the chair rail, the wainscot below.
  let seed = 1;
  for (let x = -10; x < 960; x += 74) {
    raisedPanel(ctx, x + 8, 30, 58, 158, seed++);
    raisedPanel(ctx, x + 8, 222, 58, 88, seed++);
  }
  ctx.fillStyle = WOOD.rail;
  ctx.fillRect(0, 0, 960, 18);
  ctx.fillStyle = WOOD.light;
  ctx.fillRect(0, 18, 960, 3);
  ctx.fillStyle = WOOD.dark;
  ctx.fillRect(0, 21, 960, 3);
  ctx.fillStyle = WOOD.rail;
  ctx.fillRect(0, 196, 960, 16);
  ctx.fillStyle = WOOD.light;
  ctx.fillRect(0, 196, 960, 3);
  ctx.fillStyle = WOOD.dark;
  ctx.fillRect(0, 209, 960, 3);
  ctx.fillStyle = '#2b160d';
  ctx.fillRect(0, 316, 960, 14);
  ctx.fillStyle = WOOD.light;
  ctx.fillRect(0, 316, 960, 2);
  // The sconces: brass, with small cream shades. Their glow is drawn live.
  for (const sx of [348, 598]) {
    box(ctx, sx - 6, 150, 12, 22, 4, '#a8843c', 2);
    ctx.strokeStyle = '#a8843c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, 160);
    ctx.quadraticCurveTo(sx, 140, sx, 132);
    ctx.stroke();
    poly(ctx, [sx - 13, 132, sx + 13, 132, sx + 9, 112, sx - 9, 112], '#f3dfb0', 2);
  }
}

function paintWindow(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = WINDOW;
  box(ctx, x - 8, y - 8, w + 16, h + 16, 3, '#6a4029', 2.5);
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#5f7385');
  sky.addColorStop(1, '#93a4b0');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // A wet garden: a line of trees and a hedge in the rain.
  ctx.fillStyle = '#3e4d52';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.62);
  for (let i = 0; i <= 8; i += 1) ctx.lineTo(x + (w * i) / 8, y + h * 0.56 - 14 * noise(i * 2.3) - (i % 2) * 6);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f3c3c';
  ctx.fillRect(x, y + h * 0.82, w, h * 0.18);
  // Mullions.
  ctx.fillStyle = '#6a4029';
  ctx.fillRect(x + w / 2 - 3, y, 6, h);
  ctx.fillRect(x, y + h / 3 - 2, w, 4);
  ctx.fillRect(x, y + (2 * h) / 3 - 2, w, 4);
  ink(ctx, 2.5);
  ctx.strokeRect(x, y, w, h);
  box(ctx, x - 12, y + h + 6, w + 24, 8, 2, '#7a4a30', 2);
  // Heavy curtains, tied back.
  for (const side of [-1, 1]) {
    const cx = side < 0 ? x - 6 : x + w + 6;
    ctx.fillStyle = '#2f4a3a';
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(cx - 12 * side, y - 14);
    ctx.lineTo(cx + 22 * side, y - 14);
    ctx.quadraticCurveTo(cx + 10 * side, y + h * 0.45, cx + 6 * side, y + h * 0.62);
    ctx.quadraticCurveTo(cx + 18 * side, y + h * 0.85, cx + 12 * side, y + h + 40);
    ctx.lineTo(cx - 12 * side, y + h + 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#223829';
    ctx.lineWidth = 2;
    for (const k of [0.3, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(cx + (-12 + 30 * k) * side, y - 10);
      ctx.quadraticCurveTo(cx + 6 * side, y + h * 0.55, cx + (-6 + 22 * k) * side, y + h + 36);
      ctx.stroke();
    }
    box(ctx, cx - 4 + 4 * side, y + h * 0.6, 14, 6, 3, '#c9a14a', 1.5);
  }
  box(ctx, x - 26, y - 20, w + 52, 8, 3, '#a8843c', 2);
}

function paintSampler(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = SAMPLER;
  box(ctx, x - 7, y - 7, w + 14, h + 14, 3, '#7a4a2a', 2.5);
  ctx.fillStyle = '#efe5cc';
  ctx.fillRect(x, y, w, h);
  ink(ctx, 1.5);
  ctx.strokeRect(x, y, w, h);
  // A cross-stitch border.
  ctx.fillStyle = '#9b2f3a';
  for (let i = 0; i < 19; i += 1) {
    ctx.fillRect(x + 4 + i * 6, y + 4, 3, 3);
    ctx.fillRect(x + 4 + i * 6, y + h - 7, 3, 3);
  }
  ctx.fillStyle = '#4c7a4a';
  for (let i = 0; i < 17; i += 1) {
    ctx.fillRect(x + 4, y + 10 + i * 6, 3, 3);
    ctx.fillRect(x + w - 7, y + 10 + i * 6, 3, 3);
  }
  // The full sentence; the doily covers the second half until the crash.
  const cx = x + w / 2;
  label(ctx, 'A PLACE FOR', cx, y + 22, 12, '#7a2430', 800, w - 18);
  label(ctx, 'EVERYTHING,', cx, y + 38, 12, '#7a2430', 800, w - 18);
  label(ctx, 'AND EVERYTHING', cx, y + 64, 11, '#2f5a33', 800, w - 24);
  label(ctx, 'IS COLLATERAL.', cx, y + 80, 11, '#2f5a33', 800, w - 24);
  // A stitched house and two hearts at the foot.
  ctx.fillStyle = '#9b2f3a';
  ctx.fillRect(cx - 7, y + 95, 14, 9);
  ctx.beginPath();
  ctx.moveTo(cx - 10, y + 96);
  ctx.lineTo(cx, y + 88);
  ctx.lineTo(cx + 10, y + 96);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + s * 30 - 2, y + 96, 2.6, 0, Math.PI * 2);
    ctx.arc(cx + s * 30 + 2, y + 96, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + s * 30 - 5, y + 97);
    ctx.lineTo(cx + s * 30, y + 103);
    ctx.lineTo(cx + s * 30 + 5, y + 97);
    ctx.fill();
  }
}

function paintCabinet(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = CABINET;
  box(ctx, x, y, w, h, 3, '#3e2216', 2.5);
  box(ctx, x - 4, y - 6, w + 8, 9, 2, '#5a3020', 2);
  for (let i = 0; i < 2; i += 1) {
    const gx = x + 8 + i * (w / 2 - 4);
    const gw = w / 2 - 12;
    box(ctx, gx, y + 10, gw, h - 26, 2, '#2c3a40', 2);
    ctx.fillStyle = 'rgba(190, 220, 230, 0.16)';
    ctx.beginPath();
    ctx.moveTo(gx + 4, y + 14);
    ctx.lineTo(gx + 14, y + 14);
    ctx.lineTo(gx + 4, y + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9a14a';
    ctx.fillRect(gx + (i === 0 ? gw - 5 : 2), y + h / 2 - 8, 3, 10);
  }
  // Inside: a duck decoy, a brass horn, a flask and a plaid cap.
  blob(ctx, x + 30, y + 70, 15, 8, '#7a5a3a', 1.5);
  blob(ctx, x + 42, y + 62, 6, 6, '#2f5a3a', 1.5);
  poly(ctx, [x + 47, y + 62, x + 54, y + 64, x + 47, y + 65], '#d8a040', 1);
  ctx.strokeStyle = '#c9a14a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 92, y + 52, 13, Math.PI * 0.9, Math.PI * 2.1);
  ctx.stroke();
  box(ctx, x + 84, y + 70, 12, 18, 3, '#9aa3a8', 1.5);
  blob(ctx, x + 30, y + 34, 13, 7, '#8a3a3a', 1.5);
  ctx.strokeStyle = '#3a1a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 33);
  ctx.lineTo(x + 42, y + 33);
  ctx.moveTo(x + 30, y + 27);
  ctx.lineTo(x + 30, y + 41);
  ctx.stroke();
  // On top: a second decoy, keeping watch.
  blob(ctx, x + 34, y - 12, 18, 9, '#8a6a42', 2);
  blob(ctx, x + 50, y - 22, 7, 7, '#2f5a3a', 2);
  poly(ctx, [x + 56, y - 22, x + 64, y - 19, x + 56, y - 18], '#d8a040', 1.5);
}

function paintKitchen(ctx: CanvasRenderingContext2D): void {
  const x = DOORWAY.x;
  const y = DOORWAY.y;
  // The kitchen beyond: mint tiles, a checker floor, a light that is always on.
  ctx.fillStyle = '#c6d8c4';
  ctx.fillRect(x, y, 960 - x, FLOOR_Y - y);
  ctx.strokeStyle = 'rgba(90, 120, 95, 0.35)';
  ctx.lineWidth = 1;
  for (let ty = y + 12; ty < FLOOR_Y; ty += 12) {
    ctx.beginPath();
    ctx.moveTo(x, ty);
    ctx.lineTo(960, ty);
    ctx.stroke();
  }
  for (let tx = x + 10; tx < 960; tx += 12) {
    ctx.beginPath();
    ctx.moveTo(tx, y);
    ctx.lineTo(tx, FLOOR_Y);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 ? '#e8e2d4' : '#5a6070';
    ctx.fillRect(x + i * 12, FLOOR_Y - 12, 12, 12);
  }
  // A counter edge with a drawer front, just in view.
  box(ctx, 944, 238, 30, 60, 2, '#d8cfb8', 2);
  ctx.fillStyle = INK;
  ctx.fillRect(948, 256, 8, 3);
  // The casing.
  ctx.fillStyle = '#6a4029';
  ctx.fillRect(x - 12, y - 12, 12, FLOOR_Y - y + 12);
  ctx.fillRect(x - 12, y - 12, 960 - x + 12, 12);
  ink(ctx, 2.5);
  ctx.strokeRect(x - 12, y - 12, 980 - x, FLOOR_Y - y + 12);
  ctx.strokeRect(x, y, 980 - x, FLOOR_Y - y);
}

function paintChimney(ctx: CanvasRenderingContext2D): void {
  const { x0, x1 } = CHIMNEY;
  // The chimney breast stands proud of the panelling: lighter, with a shadow down its right side.
  ctx.fillStyle = '#663c2a';
  ctx.fillRect(x0, 0, x1 - x0, FLOOR_Y);
  ctx.fillStyle = 'rgba(20, 8, 4, 0.4)';
  ctx.fillRect(x1, 0, 8, FLOOR_Y);
  ctx.fillStyle = 'rgba(255, 220, 180, 0.12)';
  ctx.fillRect(x0, 0, 6, FLOOR_Y);
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x0, 0);
  ctx.lineTo(x0, FLOOR_Y);
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, FLOOR_Y);
  ctx.stroke();
  raisedPanel(ctx, x0 + 14, 218, x1 - x0 - 28, 6, 90);
  // The marble surround and the arched opening.
  box(ctx, 140, 222, 160, FLOOR_Y - 222, 2, '#d9cfbc', 2.5);
  ctx.strokeStyle = 'rgba(120, 110, 100, 0.45)';
  ctx.lineWidth = 1;
  for (const [ax, ay, bx, by] of [[146, 232, 170, 262], [282, 236, 296, 300], [150, 290, 160, 326]] as const) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2 + 6, (ay + by) / 2, bx, by);
    ctx.stroke();
  }
  ctx.fillStyle = '#140b08';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(168, FLOOR_Y);
  ctx.lineTo(168, 266);
  ctx.quadraticCurveTo(220, 236, 272, 266);
  ctx.lineTo(272, FLOOR_Y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Firebrick at the back, sooted at the top.
  ctx.strokeStyle = 'rgba(120, 50, 30, 0.5)';
  ctx.lineWidth = 1;
  for (let by = 270; by < FLOOR_Y; by += 9) {
    ctx.beginPath();
    ctx.moveTo(180, by);
    ctx.lineTo(260, by);
    ctx.stroke();
  }
  // The mantel shelf.
  box(ctx, 118, 208, 204, 14, 2, '#3b2015', 2.5);
  ctx.fillStyle = '#7a4a30';
  ctx.fillRect(120, 209, 200, 3);
  // The hearth slab.
  box(ctx, 128, FLOOR_Y - 2, 184, 16, 2, '#8a8078', 2.5);
  // The grate and two logs.
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(186, 318);
  ctx.lineTo(254, 318);
  for (let gx = 190; gx <= 250; gx += 12) {
    ctx.moveTo(gx, 318);
    ctx.lineTo(gx - 2, 328);
  }
  ctx.stroke();
  box(ctx, 188, 306, 66, 11, 5, '#4a2c1c', 2);
  box(ctx, 196, 298, 52, 10, 5, '#5a3622', 2);
  // On the mantel: a carriage clock, a candlestick, a china dog.
  box(ctx, 140, 186, 22, 22, 3, '#a8843c', 2);
  blob(ctx, 151, 197, 7, 7, '#f6efe0', 1.5);
  box(ctx, 286, 176, 8, 32, 2, '#c9a14a', 1.5);
  box(ctx, 288, 166, 4, 12, 1, '#f6efe0', 1.2);
  blob(ctx, 270, 200, 8, 8, '#f6efe0', 1.5);
  blob(ctx, 266, 191, 5, 5, '#f6efe0', 1.5);
}

/** Grandma, in oils: everything but her eyes, which are drawn live. */
function paintPortrait(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = PORTRAIT;
  // A gilt frame with corner ornaments.
  box(ctx, x, y, w, h, 4, '#c9a14a', 3);
  box(ctx, x + 6, y + 6, w - 12, h - 12, 2, '#8a6a2a', 2);
  for (const [cx, cy] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]] as const) blob(ctx, cx, cy, 7, 7, '#e0bc5a', 2);
  const ix = x + 12;
  const iy = y + 12;
  const iw = w - 24;
  const ih = h - 24;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  const bg = ctx.createRadialGradient(220, 112, 10, 220, 120, 100);
  bg.addColorStop(0, '#56664a');
  bg.addColorStop(1, '#1f281e');
  ctx.fillStyle = bg;
  ctx.fillRect(ix, iy, iw, ih);
  // The cardigan, cable-knit, over a blouse.
  ctx.fillStyle = '#7d5c9c';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(160, 200);
  ctx.quadraticCurveTo(164, 152, 196, 144);
  ctx.lineTo(244, 144);
  ctx.quadraticCurveTo(276, 152, 280, 200);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#644684';
  ctx.lineWidth = 1.5;
  for (const cx of [176, 186, 254, 264]) {
    for (let cy = 156; cy < 196; cy += 7) {
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy);
      ctx.quadraticCurveTo(cx, cy + 4, cx + 3, cy);
      ctx.stroke();
    }
  }
  poly(ctx, [204, 144, 236, 144, 226, 166, 214, 166], '#f2ead8', 1.5);
  // Neck and head; silver curls and a bun.
  ctx.fillStyle = '#efcdb2';
  ctx.fillRect(212, 130, 16, 16);
  blob(ctx, 220, 112, 22, 26, '#f1d0b5', 2);
  ctx.fillStyle = '#e6e2da';
  ink(ctx, 1.5);
  for (const [cx, cy, r] of [[220, 80, 10], [204, 88, 9], [236, 88, 9], [198, 100, 7], [242, 100, 7], [210, 84, 8], [230, 84, 8], [196, 112, 5], [244, 112, 5]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Cheeks, the nose, a small knowing mouth.
  ctx.fillStyle = 'rgba(220, 110, 110, 0.35)';
  blob(ctx, 205, 124, 5, 3, 'rgba(220, 110, 110, 0.35)', 0);
  blob(ctx, 235, 124, 5, 3, 'rgba(220, 110, 110, 0.35)', 0);
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(220, 114);
  ctx.quadraticCurveTo(224, 122, 219, 123);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(213, 129);
  ctx.quadraticCurveTo(220, 133, 228, 128);
  ctx.stroke();
  // The glasses' chain, looping down to the cardigan.
  ctx.strokeStyle = '#d8b860';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(199, 110);
  ctx.quadraticCurveTo(194, 150, 220, 158);
  ctx.quadraticCurveTo(246, 150, 241, 110);
  ctx.stroke();
  // The chart, held up: candles, one circled in red pen.
  box(ctx, 196, 154, 48, 32, 1, '#fbf6ea', 1.5);
  const candles = [[0, 4, 9], [1, 6, 4], [2, 2, 10], [3, 7, 3], [4, 1, 12]] as const;
  for (const [i, top, len] of candles) {
    ctx.fillStyle = i === 3 ? '#c8303a' : '#3a8a4a';
    ctx.fillRect(202 + i * 8, 160 + top, 4, len);
    ctx.fillRect(203.5 + i * 8, 158 + top, 1, len + 4);
  }
  ctx.strokeStyle = '#d62030';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(228, 170, 7, 10, 0.2, 0, Math.PI * 2);
  ctx.stroke();
  blob(ctx, 198, 184, 5, 4, '#f1d0b5', 1.5);
  blob(ctx, 242, 184, 5, 4, '#f1d0b5', 1.5);
  // Varnish: a soft sheen across the canvas.
  ctx.fillStyle = 'rgba(255, 245, 220, 0.07)';
  ctx.beginPath();
  ctx.moveTo(ix, iy + 20);
  ctx.lineTo(ix + 40, iy);
  ctx.lineTo(ix + 80, iy);
  ctx.lineTo(ix, iy + 70);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // A brass plate.
  box(ctx, 196, y + h - 12, 48, 9, 2, '#e0bc5a', 1.5);
  label(ctx, 'M. HOLDERN', 220, y + h - 7.5, 6, '#4a3410', 800, 44);
}

function paintFloor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#3b2416';
  ctx.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);
  ctx.strokeStyle = '#2a170d';
  ctx.lineWidth = 1.5;
  let row = 0;
  for (let y = FLOOR_Y + 10; y < 540; y += 10 + row * 1.6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
    for (let x = (row * 97) % 180; x < 960; x += 180) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 10 + row * 1.6);
      ctx.stroke();
    }
    row += 1;
  }
  // The rug under the table: deep red, a gold border, a navy medallion.
  poly(ctx, [338, 366, 946, 366, 990, 540, 296, 540], '#6e2029', 2.5);
  poly(ctx, [350, 374, 934, 374, 972, 532, 312, 532], null, 0);
  ctx.strokeStyle = '#b08a40';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#2f2a4a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(362, 382);
  ctx.lineTo(922, 382);
  ctx.lineTo(956, 524);
  ctx.lineTo(326, 524);
  ctx.closePath();
  ctx.stroke();
  blob(ctx, 640, 470, 120, 34, '#2f2a4a', 0);
  blob(ctx, 640, 470, 84, 22, '#8a3040', 0);
  ctx.fillStyle = '#b08a40';
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(640 + Math.cos(a) * 102, 470 + Math.sin(a) * 28, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, FLOOR_Y, 960, 6);
}

function paintRoom(ctx: CanvasRenderingContext2D): void {
  paintWalls(ctx);
  paintWindow(ctx);
  paintSampler(ctx);
  paintCabinet(ctx);
  paintKitchen(ctx);
  paintFloor(ctx);
  paintChimney(ctx);
  paintPortrait(ctx);
  // The vignette that holds the picture together, baked into the room.
  const g = ctx.createRadialGradient(520, 300, 220, 520, 300, 640);
  g.addColorStop(0, 'rgba(10, 4, 2, 0)');
  g.addColorStop(1, 'rgba(10, 4, 2, 0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 540);
}

const roomSprite = (ctx: CanvasRenderingContext2D) => sprite(ctx, 'room', 0, 0, 960, 540, paintRoom);

// ---- Drawing: what moves ---------------------------------------------------------------------------------------

/** The rainy garden behind the walls, seen once they come off. */
function drawOutside(ctx: CanvasRenderingContext2D, d: StudyDrive): void {
  const dusk = smoothstep(BEATS.rain, BEATS.dark + 1, d.crash);
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  sky.addColorStop(0, mixColour([62, 76, 92], [18, 22, 34], dusk));
  sky.addColorStop(1, mixColour([120, 136, 148], [34, 40, 52], dusk));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, FLOOR_Y);
  ctx.fillStyle = mixColour([46, 60, 62], [14, 18, 22], dusk);
  ctx.beginPath();
  ctx.moveTo(0, 250);
  for (let i = 0; i <= 24; i += 1) ctx.lineTo(i * 40, 236 - 30 * noise(i * 1.7) - (i % 3) * 8);
  ctx.lineTo(960, FLOOR_Y);
  ctx.lineTo(0, FLOOR_Y);
  ctx.closePath();
  ctx.fill();
}

function mixColour(a: readonly number[], b: readonly number[], t: number): string {
  return `rgb(${Math.round(mix(a[0]!, b[0]!, t))}, ${Math.round(mix(a[1]!, b[1]!, t))}, ${Math.round(mix(a[2]!, b[2]!, t))})`;
}

function drawStud(ctx: CanvasRenderingContext2D, x: number, angle: number): void {
  ctx.save();
  ctx.translate(x, FLOOR_Y);
  ctx.rotate(angle);
  box(ctx, -6, -FLOOR_Y, 12, FLOOR_Y, 1, '#b08a5a', 2);
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-1, -FLOOR_Y + 10);
  ctx.lineTo(1, -20);
  ctx.stroke();
  ctx.restore();
}

/** The back wall: whole from the cache, or coming off panel by panel after the crash. */
function drawWalls(ctx: CanvasRenderingContext2D, s: Study, d: StudyDrive): void {
  const room = roomSprite(ctx);
  const started = d.crash >= BEATS.walls && s.panels.length > 0;
  if (!started) {
    if (room) ctx.drawImage(room.canvas, 0, 0, 960, 540);
    else paintRoom(ctx);
    return;
  }
  drawOutside(ctx, d);
  // The framing behind the panels, then the studs falling, all but Gerald's.
  ctx.fillStyle = '#9a7448';
  ctx.fillRect(0, FLOOR_Y - 8, 960, 8);
  for (const st of s.studs) {
    const u = Math.max(0, d.crash - st.at);
    drawStud(ctx, st.x, st.side * Math.min(Math.PI / 2, 2.4 * u * u));
  }
  drawStud(ctx, (STUD.x0 + STUD.x1) / 2, 0);
  if (!room) return;
  const cache = room.canvas;
  const k = room.scale;
  // The floor and the chimney breast stay.
  ctx.drawImage(cache, 0, FLOOR_Y * k, 960 * k, (540 - FLOOR_Y) * k, 0, FLOOR_Y, 960, 540 - FLOOR_Y);
  ctx.drawImage(cache, (CHIMNEY.x0 - 10) * k, 0, (CHIMNEY.x1 - CHIMNEY.x0 + 28) * k, FLOOR_Y * k, CHIMNEY.x0 - 10, 0, CHIMNEY.x1 - CHIMNEY.x0 + 28, FLOOR_Y);
  for (const p of s.panels) {
    const u = d.crash - p.at;
    if (u < 0) {
      ctx.drawImage(cache, p.x * k, p.y * k, p.w * k, p.h * k, p.x, p.y, p.w, p.h);
      continue;
    }
    if (u > 1.45) continue;
    // A shudder on the nails, then off it goes, turning and shrinking into the weather.
    const shake = u < 0.22 ? Math.sin(u * 90) * 2 : 0;
    const f = Math.max(0, u - 0.22);
    const away = Math.max(0.25, 1 - 0.55 * f);
    ctx.save();
    ctx.globalAlpha = clamp(1 - f / 1.2, 0, 1);
    ctx.translate(p.x + p.w / 2 + shake + p.vx * f, p.y + p.h / 2 + p.vy * f + 420 * f * f);
    ctx.rotate(p.spin * f);
    ctx.scale(away, away);
    ctx.drawImage(cache, p.x * k, p.y * k, p.w * k, p.h * k, -p.w / 2, -p.h / 2, p.w, p.h);
    ink(ctx, 2);
    ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
}

function drawFire(ctx: CanvasRenderingContext2D, d: StudyDrive, level: number): void {
  const t = d.time;
  // Embers glow on as long as there is anything left.
  const ember = clamp(level * 1.4 + 0.15 * (d.crash < 0 ? 1 : 1 - smoothstep(BEATS.pop, BEATS.pop + 1, d.crash)), 0, 1);
  if (ember > 0.01) {
    ctx.fillStyle = `rgba(255, ${Math.round(80 + 60 * level)}, 30, ${0.5 * ember})`;
    ctx.fillRect(192, 304, 58, 3);
    ctx.fillRect(200, 297, 44, 2);
  }
  if (level > 0.02) {
    const tongues = [[-24, 0.8, 0], [-10, 1.1, 1.3], [4, 1.25, 2.1], [18, 1, 3.4], [28, 0.7, 4.2]] as const;
    for (const [layer, colour, k] of [[0, '#e8501a', 1], [1, '#ffa630', 0.72], [2, '#ffe9a0', 0.42]] as const) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      for (const [dx, hgt, seed] of tongues) {
        const flick = 0.75 + 0.25 * Math.sin(t * (7 + seed) + seed * 3) + 0.15 * Math.sin(t * 13.1 + seed);
        const hh = 46 * hgt * flick * level * k;
        const bx = HEARTH.x + dx * (1 - layer * 0.18);
        const sway = 4 * Math.sin(t * 3.1 + seed) * level;
        ctx.moveTo(bx - 9 * k - 2, 304);
        ctx.quadraticCurveTo(bx - 8 * k, 304 - hh * 0.55, bx + sway, 304 - hh);
        ctx.quadraticCurveTo(bx + 8 * k, 304 - hh * 0.55, bx + 9 * k + 2, 304);
      }
      ctx.fill();
    }
    // Sparks rising: a few, on a clock, no state.
    ctx.fillStyle = '#ffd36b';
    for (let i = 0; i < 5; i += 1) {
      const u = fract(t * (0.5 + 0.13 * i) + i * 0.37);
      if (u * 60 > 46 * level + 10) continue;
      ctx.fillRect(HEARTH.x - 20 + 40 * noise(i * 9.1 + Math.floor(t * (0.5 + 0.13 * i) + i * 0.37)), 300 - u * 60, 2, 2);
    }
  } else if (d.crash < 0 || d.crash < BEATS.pop + 2) {
    // Out: a thread of smoke.
    ctx.strokeStyle = 'rgba(190, 190, 200, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(220, 298);
    for (let i = 1; i <= 6; i += 1) ctx.lineTo(220 + 7 * Math.sin(t * 1.6 + i * 0.9), 298 - i * 10);
    ctx.stroke();
  }
  // The last pop at the crash: one bright burst of sparks.
  if (d.crash >= BEATS.pop && d.crash < BEATS.pop + 0.8) {
    const u = d.crash - BEATS.pop;
    const r = mulberry32(d.seed * 3 + 5);
    ctx.fillStyle = `rgba(255, 210, 110, ${1 - u / 0.8})`;
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI * (0.15 + 0.7 * r());
      const v = 60 + 90 * r();
      ctx.fillRect(HEARTH.x + Math.cos(a) * v * u, 304 + Math.sin(a) * v * u + 120 * u * u, 3, 3);
    }
  }
}

/** Grandma's eyes: two dots behind her glasses with a look-at target; at the crash, they close. */
function drawEyes(ctx: CanvasRenderingContext2D, s: Study, d: StudyDrive): void {
  const close = d.crash < 0 ? 0 : smoothstep(BEATS.eyes, BEATS.eyes + 0.35, d.crash);
  for (const e of [EYES.l, EYES.r]) {
    blob(ctx, e.x, e.y, 5, 4.4 * (1 - close) + 0.01, '#fbf8f0', 1.2);
    if (close < 0.9) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(e.x + clamp(s.eyeX.x, -1.2, 1.2) * 2.6, e.y + clamp(s.eyeY.x, -1, 1) * 1.8 * (1 - close), 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // The lid comes down, then the lashes.
    if (close > 0.01) {
      ctx.fillStyle = '#e8c2a6';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 5.5, 4.8, 0, Math.PI, Math.PI + Math.PI * close);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 5.5, 4.8, 0, Math.PI, 0);
      ctx.save();
      ctx.clip();
      ctx.fillRect(e.x - 6, e.y - 6, 12, 10.5 * close);
      ctx.restore();
      ink(ctx, 1.4);
      ctx.beginPath();
      ctx.moveTo(e.x - 5, e.y - 4.4 + 8.8 * close * 0.55);
      ctx.quadraticCurveTo(e.x, e.y - 3 + 8 * close, e.x + 5, e.y - 4.4 + 8.8 * close * 0.55);
      ctx.stroke();
    }
    // Gold rims.
    ctx.strokeStyle = '#d8b860';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(EYES.l.x + 8, EYES.l.y);
  ctx.quadraticCurveTo(220, EYES.l.y - 3, EYES.r.x - 8, EYES.r.y);
  ctx.stroke();
}

/** The doily: a cloth on one pin over the end of the sentence, which falls at the crash. */
/** Where the doily comes to rest: on the table, in front of the empty chair. A place for everything. */
const DOILY_LANDS = { x: 712, y: TABLE.back + 12, at: 0.8 } as const;

function drawDoily(ctx: CanvasRenderingContext2D, s: Study, d: StudyDrive, landed: boolean): void {
  const falling = d.crash >= BEATS.doily;
  const u = falling ? d.crash - BEATS.doily : 0;
  if (landed !== (falling && u >= DOILY_LANDS.at * 0.7)) return;
  const drift = s.drift.x;
  let cx = PIN.x + drift;
  let cy = PIN.y + 24;
  let angle = s.swing.x;
  let flutter = 0;
  if (falling) {
    // Off the pin: it drops, rocking like a leaf, and settles flat on the table.
    const v = Math.min(u, DOILY_LANDS.at) / DOILY_LANDS.at;
    cx = mix(cx, DOILY_LANDS.x, v) + 22 * Math.sin(u * 6) * (1 - v);
    cy = mix(cy, DOILY_LANDS.y, v * v);
    angle = 0.5 * Math.sin(u * 7) * (1 - v);
    flutter = 1 - v;
  }
  ctx.save();
  ctx.translate(falling ? cx : PIN.x + drift, falling ? cy : PIN.y);
  ctx.rotate(angle);
  if (!falling) ctx.translate(0, 24);
  const squash = falling && u >= DOILY_LANDS.at ? 0.42 : 1 - 0.35 * flutter * Math.abs(Math.sin(u * 9));
  ctx.scale(1, squash);
  blit(ctx, 'doily', -60, -30, 120, 60, paintLace);
  ctx.restore();
  if (!falling) blob(ctx, PIN.x + drift, PIN.y, 2.6, 2.6, '#c9a14a', 1.2);
  else if (u < 1.2) blob(ctx, PIN.x, PIN.y, 2.6, 2.6, '#c9a14a', 1.2);
}

/** The lace itself, at its own origin. */
function paintLace(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#f7f3ea';
  ink(ctx, 1.8);
  ctx.beginPath();
  for (let i = 0; i <= 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const r = 1 + 0.07 * Math.cos(a * 14);
    const px = Math.cos(a) * 54 * r;
    const py = Math.sin(a) * 24 * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#d9d0bd';
  ctx.lineWidth = 1;
  for (const k of [0.7, 0.45]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 54 * k, 24 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#d9d0bd';
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 46, Math.sin(a) * 19, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A paper tag on a string: ITEM 6 on Gerald's antler, ITEM 13 on the freezer, ITEM 5 on the sampler. */
function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, t: Spring, time: number): void {
  const k = clamp(t.x, 0, 1.3);
  if (k < 0.02) return;
  const sway = 0.12 * Math.sin(time * 1.7 + x) + (1 - clamp(t.x, 0, 1)) * 0.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.scale(k, k);
  ctx.strokeStyle = '#e8dcc0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 12);
  ctx.stroke();
  box(ctx, -16, 12, 32, 13, 2, '#f3e3b8', 1.5);
  label(ctx, text, 0, 18.5, 7.5, '#7a2430', 900, 30);
  ctx.restore();
}

/** Gerald's plaque and antlers, painted once. */
function paintGeraldBack(ctx: CanvasRenderingContext2D): void {
  const { x, y } = GERALD;
  ctx.fillStyle = '#3e2214';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 30);
  ctx.quadraticCurveTo(x, y - 40, x + 30, y - 30);
  ctx.lineTo(x + 28, y + 18);
  ctx.quadraticCurveTo(x, y + 34, x - 28, y + 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Antlers: bone-white tines.
  for (const side of [-1, 1]) {
    const pts = [[x + side * 10, y - 20], [x + side * 26, y - 48], [x + side * 44, y - 66], [x + side * 62, y - 70]] as const;
    ctx.lineCap = 'round';
    for (const [w, c] of [[8, INK], [5, '#eadfc4']] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.moveTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[1][0] + side * 2, pts[1][1] - 22);
      ctx.moveTo(pts[2][0], pts[2][1]);
      ctx.lineTo(pts[2][0] - side * 4, pts[2][1] - 20);
      ctx.moveTo(pts[1][0] + side * 8, pts[1][1] - 10);
      ctx.lineTo(pts[1][0] + side * 24, pts[1][1] - 14);
      ctx.stroke();
    }
  }
}

/** Gerald's long face, toward us: pale muzzle, dark nose, the white blaze. */
function paintGeraldFace(ctx: CanvasRenderingContext2D): void {
  const { x, y } = GERALD;
  ctx.fillStyle = '#8a5a34';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 16);
  ctx.quadraticCurveTo(x - 26, y + 14, x - 12, y + 48);
  ctx.quadraticCurveTo(x, y + 58, x + 12, y + 48);
  ctx.quadraticCurveTo(x + 26, y + 14, x + 22, y - 16);
  ctx.quadraticCurveTo(x, y - 30, x - 22, y - 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  blob(ctx, x, y + 40, 13, 13, '#c89a6a', 2);
  blob(ctx, x, y + 46, 8, 5, '#2a1a14', 2);
  ctx.fillStyle = '#f2e8d8';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 14);
  ctx.lineTo(x, y + 2);
  ctx.lineTo(x + 6, y - 14);
  ctx.closePath();
  ctx.fill();
  for (const side of [-1, 1]) blob(ctx, x + side * 13, y + 6, 6, 6, '#1a1210', 2);
}

/** Gerald: tired eyes, twitching ears, on his stud. He blinks once at the very end. */
function drawGerald(ctx: CanvasRenderingContext2D, s: Study, d: StudyDrive): void {
  const { x, y } = GERALD;
  const t = d.time;
  const droop = 0.12 + 0.3 * d.depth;
  blit(ctx, 'gerald-back', x - 76, y - 98, 152, 136, paintGeraldBack);
  // Ears: an occasional tired twitch, drooping as the round goes long.
  for (const side of [-1, 1]) {
    const twitch = Math.max(0, Math.sin(t * 0.9 + side * 2) - 0.96) * 6;
    ctx.save();
    ctx.translate(x + side * 22, y - 8);
    ctx.rotate(side * (0.5 + droop) + twitch * 0.25 * side);
    blob(ctx, side * 14, 0, 16, 7, '#8a5a34', 2.2);
    blob(ctx, side * 14, 0, 10, 3.5, '#d8a88a', 0);
    ctx.restore();
  }
  blit(ctx, 'gerald-face', x - 30, y - 34, 60, 96, paintGeraldFace);
  // Eyes: glassy, half-lidded; one blink at the end.
  const blink = d.crash >= BEATS.blink && d.crash < BEATS.blink + 0.32 ? Math.sin(((d.crash - BEATS.blink) / 0.32) * Math.PI) : 0;
  for (const side of [-1, 1]) {
    const ex = x + side * 13;
    const ey = y + 6;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(ex - 3 + side, ey - 3, 2, 2);
    const lid = clamp(0.45 + 0.15 * d.depth + 0.55 * blink, 0, 1);
    ctx.fillStyle = '#7a4c2c';
    ctx.fillRect(ex - 7, ey - 7, 14, 14 * lid);
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(ex - 7, ey - 7 + 14 * lid);
    ctx.lineTo(ex + 7, ey - 7 + 14 * lid - side * 1.5);
    ctx.stroke();
  }
  drawTag(ctx, x - 44, y - 66, 'ITEM 6', s.geraldTag, t);
}

/** The freezer at the kitchen door: hum lines, the light that is on, and, at the crash, the dip on ice. */
function drawFreezer(ctx: CanvasRenderingContext2D, s: Study, d: StudyDrive): void {
  const { x, y, w, h } = FREEZER;
  const t = d.time;
  const hum = d.crash < 0 ? 0.25 + 0.75 * d.tension : 0.2;
  const jitter = d.crash < 0 ? Math.sin(t * 61) * 0.6 * d.tension : 0;
  const open = freezerOpen(d.crash);
  ctx.save();
  ctx.translate(jitter, 0);
  // The cabinet body and, once open, the cold inside: ice trays of frozen red chart lines.
  box(ctx, x, y, w, h, 7, '#e9e5da', 2.5);
  if (open > 0.02) {
    box(ctx, x + 5, y + 6, w - 10, h - 12, 4, '#cfe8f4', 2);
    for (let i = 0; i < 4; i += 1) {
      const ty = y + 22 + i * 34;
      ctx.fillStyle = '#9fc6dc';
      ctx.fillRect(x + 6, ty + 18, w - 12, 3);
      box(ctx, x + 10, ty, w - 20, 16, 2, '#e8f6fc', 1.5);
      ctx.strokeStyle = '#a8cfe2';
      ctx.lineWidth = 1;
      for (let c = 1; c < 4; c += 1) {
        ctx.beginPath();
        ctx.moveTo(x + 10 + (c * (w - 20)) / 4, ty);
        ctx.lineTo(x + 10 + (c * (w - 20)) / 4, ty + 16);
        ctx.stroke();
      }
      // The dip, in red pen, frozen solid.
      ctx.strokeStyle = '#d42a36';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 12, ty + 4);
      ctx.lineTo(x + 20, ty + 6);
      ctx.lineTo(x + 26, ty + 3);
      ctx.lineTo(x + 32, ty + 13);
      ctx.lineTo(x + 40, ty + 11);
      ctx.lineTo(x + 48, ty + 15);
      ctx.stroke();
    }
  } else {
    // The door seal and the handle; the light on top is on.
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 54);
    ctx.lineTo(x + w - 4, y + 54);
    ctx.stroke();
    box(ctx, x + w - 12, y + 18, 5, 26, 2, '#b8bcc0', 1.5);
    box(ctx, x + w - 12, y + 70, 5, 46, 2, '#b8bcc0', 1.5);
  }
  const led = d.crash < 0 ? 0.75 + 0.25 * Math.sin(t * 2) : 1;
  blob(ctx, x + 10, y + 10, 3, 3, `rgba(90, 230, 120, ${led})`, 1);
  ctx.restore();
  // The door, swinging toward us on its left hinge and past it.
  if (open > 0.02) {
    const a = open * Math.PI * 0.62;
    const span = w * Math.cos(a);
    const depth = w * Math.sin(a) * 0.22;
    const hx = x;
    const fill = span >= 0 ? '#e9e5da' : '#dfe6ea';
    poly(ctx, [hx, y, hx + span, y - depth, hx + span, y + h + depth, hx, y + h], fill, 2.5);
    if (span < 0) {
      // The door's inside: shelves with more trays.
      ctx.strokeStyle = '#a8c4d4';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(hx, y + (h * i) / 4);
        ctx.lineTo(hx + span, y + (h * i) / 4 + depth * 0.2);
        ctx.stroke();
      }
    }
    // Cold light and a breath of mist rolling out.
    ctx.fillStyle = `rgba(200, 235, 255, ${0.18 * clamp(open, 0, 1)})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + 20, FLOOR_Y + 40);
    ctx.lineTo(x - 120, FLOOR_Y + 60);
    ctx.closePath();
    ctx.fill();
    const u = d.crash - BEATS.freezer;
    ctx.fillStyle = 'rgba(235, 245, 255, 0.35)';
    for (let i = 0; i < 6; i += 1) {
      const m = fract(u * 0.35 + i / 6);
      blob(ctx, x + 20 - m * 70 + 10 * Math.sin(i * 2 + u), y + h - 10 + m * 18, 10 + 16 * m, 5 + 6 * m, `rgba(235, 245, 255, ${0.35 * (1 - m)})`, 0);
    }
  } else if (d.crash < 0) {
    // The hum: wavy lines off its left side, growing with the tension.
    ctx.strokeStyle = `rgba(230, 240, 255, ${0.25 + 0.45 * hum})`;
    ctx.lineWidth = 1.5;
    const n = 2 + Math.round(2 * hum);
    for (let i = 0; i < n; i += 1) {
      const ox = x - 6 - i * 5;
      ctx.beginPath();
      for (let j = 0; j <= 6; j += 1) {
        const py = y + 60 + j * 8;
        const px = ox + Math.sin(t * 9 + j * 1.3 + i) * (1 + 2.2 * hum);
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  drawTag(ctx, x + 18, y + 26, 'ITEM 13', s.freezerTag, t);
}

/** The kitchen door's leaf, which rattles on every slam, and the slam itself. */
function drawKitchenDoor(ctx: CanvasRenderingContext2D, s: Study, d: StudyDrive): void {
  const r = clamp(s.rattle.x, -1.5, 1.5) * 2.5;
  poly(ctx, [DOORWAY.x - 2 + r, DOORWAY.y + 2, DOORWAY.x + 10 + r, DOORWAY.y - 6, DOORWAY.x + 10 + r, FLOOR_Y + 4, DOORWAY.x - 2 + r, FLOOR_Y], '#5a3020', 2.5);
  if (s.slamAge < 0.5 && d.crash < 0) {
    const u = s.slamAge / 0.5;
    const k = 0.8 + 0.5 * Math.exp(-u * 8);
    ctx.save();
    ctx.globalAlpha = 1 - u * u;
    ctx.translate(924, 252 - u * 10);
    ctx.rotate(-0.18 + (s.slams % 2) * 0.3);
    ctx.scale(k, k);
    ctx.font = '900 18px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.strokeText('SLAM', 0, 0);
    ctx.fillStyle = '#ffd36b';
    ctx.fillText('SLAM', 0, 0);
    ctx.restore();
  }
}

/** The window's rain: running streaks on the glass and lines falling outside. */
function drawWindowRain(ctx: CanvasRenderingContext2D, d: StudyDrive): void {
  const { x, y, w, h } = WINDOW;
  const rain = rainLevel(d);
  if (rain < 0.02) return;
  const t = d.time;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = `rgba(220, 232, 240, ${0.35 * rain})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const n = Math.round(10 + 16 * rain);
  for (let i = 0; i < n; i += 1) {
    const u = fract(t * (1.4 + 0.3 * noise(i)) + noise(i * 3.3));
    const rx = x + w * noise(i * 7.7 + Math.floor(t * (1.4 + 0.3 * noise(i)) + noise(i * 3.3)));
    const ry = y + u * (h + 20) - 10;
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 3, ry + 9);
  }
  ctx.stroke();
  // Drops running down the glass, leaving streaks.
  ctx.strokeStyle = `rgba(230, 240, 250, ${0.5 * rain})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i += 1) {
    const speed = 0.12 + 0.08 * noise(i * 5.1);
    const u = fract(t * speed + noise(i * 2.9));
    const rx = x + 8 + (w - 16) * noise(i * 4.4 + 1);
    const ry = y + u * h;
    ctx.beginPath();
    ctx.moveTo(rx, Math.max(y, ry - 26));
    ctx.quadraticCurveTo(rx + 2 * Math.sin(i + u * 6), ry - 12, rx, ry);
    ctx.stroke();
    ctx.fillStyle = `rgba(240, 248, 255, ${0.7 * rain})`;
    ctx.beginPath();
    ctx.arc(rx, ry, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Her armchair by the fire: warm at first, cold once the fire is out. */
export function drawArmchair(ctx: CanvasRenderingContext2D, d: StudyDrive): void {
  const cold = 1 - clamp(fireLevel(d) * 1.6, 0, 1);
  const fabric = mixColour([168, 92, 96], [118, 104, 128], cold);
  // The wing back, angled to the fire; the seat cushion; the arm.
  poly(ctx, [10, 268, 72, 258, 98, 286, 100, 380, 8, 392], fabric, 2.5);
  ctx.strokeStyle = 'rgba(60, 20, 30, 0.4)';
  ctx.lineWidth = 2;
  for (const fx of [30, 52, 74]) {
    ctx.beginPath();
    ctx.moveTo(fx, 272);
    ctx.lineTo(fx + 2, 380);
    ctx.stroke();
  }
  poly(ctx, [4, 372, 120, 360, 138, 396, 12, 414], fabric, 2.5);
  poly(ctx, [96, 300, 132, 306, 138, 396, 102, 392], mixColour([150, 78, 84], [104, 92, 116], cold), 2.5);
  blob(ctx, 116, 306, 18, 9, mixColour([180, 102, 108], [128, 116, 140], cold), 2.5);
  // Little feet.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(18, 412);
  ctx.lineTo(16, 438);
  ctx.moveTo(126, 398);
  ctx.lineTo(128, 428);
  ctx.stroke();
  // The granny-square throw over the back.
  const squares = ['#e8b84a', '#5aa0a8', '#c85a6a', '#7aa85a', '#e8e0cc'];
  for (let i = 0; i < 8; i += 1) {
    const sx = 18 + (i % 4) * 17;
    const sy = 280 + Math.floor(i / 4) * 17 + (i % 4) * 2;
    box(ctx, sx, sy, 16, 16, 2, squares[(i * 3) % squares.length]!, 1.5);
    box(ctx, sx + 5, sy + 5, 6, 6, 1, squares[(i * 3 + 2) % squares.length]!, 0);
  }
  // Still warm: a shimmer over the seat. Cold: frost.
  if (cold < 0.6) {
    ctx.strokeStyle = `rgba(255, 200, 140, ${0.35 * (1 - cold / 0.6)})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      for (let j = 0; j <= 5; j += 1) {
        const px = 40 + i * 22 + 3 * Math.sin(d.time * 3 + j + i);
        const py = 366 - j * 7 - fract(d.time * 0.4 + i * 0.3) * 8;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  if (cold > 0.4) {
    ctx.fillStyle = `rgba(220, 240, 255, ${0.8 * smoothstep(0.4, 1, cold)})`;
    for (let i = 0; i < 9; i += 1) {
      const fx = 20 + 100 * noise(i * 3.1);
      const fy = 300 + 100 * noise(i * 5.3);
      const tw = 0.6 + 0.4 * Math.sin(d.time * 2 + i);
      ctx.fillRect(fx - 3 * tw, fy - 0.6, 6 * tw, 1.2);
      ctx.fillRect(fx - 0.6, fy - 3 * tw, 1.2, 6 * tw);
    }
  }
}

/** Everything behind the family: the walls (or the weather), the fireplace, Grandma, Gerald, the kitchen. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, s: Study, d: StudyDrive): void {
  drawWalls(ctx, s, d);
  const gone = wallsGone(d.crash);
  if (d.crash < BEATS.walls || s.panels.every((p) => d.crash < p.at || p.x > WINDOW.x + WINDOW.w)) drawWindowRain(ctx, d);
  drawFire(ctx, d, fireLevel(d));
  drawEyes(ctx, s, d);
  // The sampler's tag and the doily: only while the sampler's panels are up, or the doily is already down.
  const samplerUp = d.crash < BEATS.walls || s.panels.some((p) => p.x >= 740 && p.x < 862 && p.y < 220 && d.crash < p.at);
  if (samplerUp) drawTag(ctx, SAMPLER.x + 4, SAMPLER.y - 4, 'ITEM 5', s.samplerTag, d.time);
  if (samplerUp || d.crash >= BEATS.doily) drawDoily(ctx, s, d, false);
  drawGerald(ctx, s, d);
  drawFreezer(ctx, s, d);
  if (gone < 0.5) drawKitchenDoor(ctx, s, d);
  // The sconces' warm pools of light, dimming at the end.
  const lamp = d.crash < 0 ? 1 : 1 - smoothstep(BEATS.walls, BEATS.walls + 1.2, d.crash);
  if (lamp > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sx of [348, 598]) {
      ctx.fillStyle = `rgba(255, 190, 110, ${0.1 * lamp})`;
      ctx.beginPath();
      ctx.ellipse(sx, 124, 46, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 220, 160, ${0.14 * lamp})`;
      ctx.beginPath();
      ctx.ellipse(sx, 122, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** The doily once it is down on the table, drawn over the table top. */
export function drawFallenDoily(ctx: CanvasRenderingContext2D, s: Study, d: StudyDrive): void {
  if (d.crash >= BEATS.doily) drawDoily(ctx, s, d, true);
}

/** The mahogany table: its top, apron and legs (the items and hands go on top of it). */
export function drawTable(ctx: CanvasRenderingContext2D): void {
  blit(ctx, 'table', TABLE.x0 - 14, TABLE.back - 6, TABLE.x1 - TABLE.x0 + 28, TABLE.foot - TABLE.back + 18, paintTable);
}

function paintTable(ctx: CanvasRenderingContext2D): void {
  const { x0, x1, back, front, apron, foot } = TABLE;
  // Legs first, then the apron, then the top with a polished sheen.
  for (const lx of [x0 + 18, x1 - 18, (x0 + x1) / 2]) {
    box(ctx, lx - 8, apron - 4, 16, foot - apron + 4, 3, '#3a1c10', 2.5);
    blob(ctx, lx, foot - 2, 10, 4, '#2a140a', 2);
  }
  box(ctx, x0 + 4, front - 2, x1 - x0 - 8, apron - front + 2, 2, '#4a2414', 2.5);
  ctx.fillStyle = 'rgba(255, 210, 160, 0.08)';
  ctx.fillRect(x0 + 8, front + 3, x1 - x0 - 16, 3);
  poly(ctx, [x0 + 10, back, x1 - 10, back, x1, front, x0, front], '#6a2e18', 2.5);
  ctx.fillStyle = 'rgba(255, 220, 180, 0.1)';
  ctx.beginPath();
  ctx.moveTo(x0 + 40, back + 6);
  ctx.lineTo(x1 - 120, back + 6);
  ctx.lineTo(x1 - 140, back + 16);
  ctx.lineTo(x0 + 30, back + 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(x0 + 2, front - 5, x1 - x0 - 4, 4);
  // A lace runner down the middle.
  ctx.fillStyle = 'rgba(245, 238, 222, 0.5)';
  ctx.beginPath();
  ctx.moveTo(x0 + 60, back + 18);
  ctx.lineTo(x1 - 60, back + 18);
  ctx.lineTo(x1 - 56, back + 34);
  ctx.lineTo(x0 + 56, back + 34);
  ctx.closePath();
  ctx.fill();
}

/** The coffee table in the foreground: the envelope under the WHEN paperweight and a cup of tea gone cold. */
export function drawCoffeeTable(ctx: CanvasRenderingContext2D, d: StudyDrive, stamp: number): void {
  const { x, y, w, h } = COFFEE;
  for (const lx of [x + 16, x + w - 16]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(lx, y + h);
    ctx.lineTo(lx + (lx < x + w / 2 ? -4 : 4), 532);
    ctx.stroke();
    ctx.strokeStyle = '#4a2414';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  box(ctx, x, y + h - 6, w, 12, 3, '#4a2414', 2.5);
  poly(ctx, [x + 10, y, x + w - 10, y, x + w, y + h, x, y + h], '#6a3420', 2.5);
  ctx.fillStyle = 'rgba(255, 220, 180, 0.1)';
  ctx.fillRect(x + 20, y + 5, w - 60, 3);
  // The envelope and the paperweight that reads WHEN.
  ctx.save();
  ctx.translate(WHEN.x, WHEN.y);
  ctx.rotate(-0.08);
  box(ctx, -34, -6, 68, 22, 2, '#b8864e', 2);
  ctx.strokeStyle = '#8a5e30';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-34, -6);
  ctx.lineTo(0, 7);
  ctx.lineTo(34, -6);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(200, 230, 240, 0.55)';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(WHEN.x + 4, WHEN.y + 2, 20, 12, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(WHEN.x + 24, WHEN.y + 6);
  ctx.lineTo(WHEN.x - 16, WHEN.y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  label(ctx, 'WHEN', WHEN.x + 4, WHEN.y - 1, 9, '#2a3a48', 900, 34);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(WHEN.x - 8, WHEN.y - 8, 6, 2);
  // Her teacup.
  blob(ctx, 250, y + 14, 16, 5, '#f3efe6', 2);
  box(ctx, 241, y - 2, 18, 14, 4, '#f3efe6', 2);
  blob(ctx, 250, y - 1, 8, 2.5, '#a86a3a', 1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(262, y + 5, 4, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  if (d.crash < 0 && fireLevel(d) > 0.3) {
    ctx.strokeStyle = 'rgba(240, 240, 240, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(248, y - 4);
    ctx.quadraticCurveTo(244 + 4 * Math.sin(d.time * 2), y - 14, 250, y - 24);
    ctx.stroke();
  }
  if (stamp > 0) collateralStamp(ctx, WHEN.x + 4, WHEN.y + 2, -0.15, stamp);
}

/** The lawyer's COLLATERAL stamp, slammed on with a pop: `k` is seconds since it landed. */
export function collateralStamp(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, k: number): void {
  const s = 1 + 0.7 * Math.exp(-k * 14);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp(k * 10, 0, 1);
  ctx.strokeStyle = '#d42a36';
  ctx.lineWidth = 2;
  ctx.strokeRect(-33, -8, 66, 16);
  ctx.fillStyle = 'rgba(255, 240, 240, 0.55)';
  ctx.fillRect(-33, -8, 66, 16);
  label(ctx, 'COLLATERAL', 0, 0.5, 10, '#d42a36', 900, 62);
  ctx.restore();
}

/** Light: the fire's warm pool, the window's grey, and the dark at the end. */
let glowSprite: HTMLCanvasElement | null = null;
/** The fire's warm pool, painted once into a sprite and laid on with the fire's strength. */
function glow(): HTMLCanvasElement | null {
  if (glowSprite || typeof document === 'undefined') return glowSprite;
  const c = document.createElement('canvas');
  c.width = 260;
  c.height = 220;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(130, 120, 6, 130, 130, 130);
  grad.addColorStop(0, 'rgba(255, 140, 50, 0.34)');
  grad.addColorStop(0.5, 'rgba(255, 110, 40, 0.1)');
  grad.addColorStop(1, 'rgba(255, 110, 40, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 260, 220);
  glowSprite = c;
  return c;
}

export function drawLighting(ctx: CanvasRenderingContext2D, d: StudyDrive): void {
  const fire = fireLevel(d);
  ctx.save();
  const sprite = glow();
  if (fire > 0.02 && sprite) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(fire * (0.9 + 0.1 * Math.sin(d.time * 9) * Math.sin(d.time * 5.3)), 0, 1);
    ctx.drawImage(sprite, HEARTH.x - 200, 300 - 170, 400, 340);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // The afternoon cools as the fire goes: a blue-grey veil, then the dark.
  const cool = 0.16 * (1 - fire) + darkness(d);
  if (cool > 0.03) {
    ctx.fillStyle = `rgba(14, 20, 38, ${clamp(cool, 0, 0.82)})`;
    ctx.fillRect(0, 0, 960, 540);
  }
  ctx.restore();
}

/** Rain over everything once the walls are off, until it stops. */
export function drawOpenRain(ctx: CanvasRenderingContext2D, d: StudyDrive): void {
  const open = wallsGone(d.crash);
  const rain = rainLevel(d) * open;
  if (rain < 0.02) return;
  ctx.strokeStyle = `rgba(200, 215, 230, ${0.4 * rain})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 70; i += 1) {
    const speed = 1.1 + 0.4 * noise(i * 1.3);
    const cycle = d.time * speed + noise(i * 2.1);
    const u = fract(cycle);
    const rx = 960 * noise(i * 5.7 + Math.floor(cycle));
    const ry = u * 600 - 40;
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 4, ry + 16);
  }
  ctx.stroke();
}

/** The hallway the player watches from after walking out: the study seen small through its door. */
export const HALL = { cx: 456, cy: 250, k: 0.5 } as const;
export function drawHallway(ctx: CanvasRenderingContext2D, k: number, time: number): void {
  // The door opening is the room's frame scaled by `k` about the hall's centre.
  const ox0 = HALL.cx - 480 * k;
  const oy0 = HALL.cy - 270 * k;
  const ox1 = HALL.cx + 480 * k;
  const oy1 = HALL.cy + 270 * k;
  ctx.save();
  ctx.fillStyle = '#28322c';
  ctx.beginPath();
  ctx.rect(0, 0, 960, 540);
  ctx.rect(ox1, oy0, ox0 - ox1, oy1 - oy0);
  ctx.fill('evenodd');
  // Striped hall paper, a picture rail, a runner on the boards.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 960, 540);
  ctx.rect(ox1, oy0, ox0 - ox1, oy1 - oy0);
  ctx.clip('evenodd');
  ctx.fillStyle = 'rgba(70, 92, 76, 0.6)';
  for (let x = 0; x < 960; x += 28) ctx.fillRect(x, 0, 12, 440);
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(0, 440, 960, 100);
  poly(ctx, [ox0 + 30 * k, oy1, ox1 - 30 * k, oy1, 760, 540, 150, 540], '#6e2029', 0);
  ctx.fillStyle = '#5a3020';
  ctx.fillRect(0, 430, 960, 12);
  // A coat stand with Grandma's raincoat and hat, and a console with a lamp.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(70, 470);
  ctx.lineTo(70, 180);
  ctx.moveTo(38, 474);
  ctx.lineTo(70, 452);
  ctx.lineTo(102, 474);
  ctx.moveTo(52, 190);
  ctx.lineTo(88, 190);
  ctx.stroke();
  poly(ctx, [56, 196, 84, 196, 98, 330, 42, 330], '#c8b048', 2.5);
  ctx.strokeStyle = '#a89038';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 200);
  ctx.lineTo(70, 326);
  ctx.stroke();
  blob(ctx, 70, 176, 22, 7, '#5a4a3a', 2.2);
  blob(ctx, 70, 168, 12, 9, '#5a4a3a', 2.2);
  box(ctx, 820, 330, 110, 14, 3, '#4a2414', 2.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(832, 344);
  ctx.lineTo(832, 436);
  ctx.moveTo(918, 344);
  ctx.lineTo(918, 436);
  ctx.stroke();
  box(ctx, 864, 290, 8, 40, 2, '#a8843c', 2);
  poly(ctx, [848, 292, 888, 292, 880, 262, 856, 262], '#f3dfb0', 2.5);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255, 200, 120, ${0.1 + 0.02 * Math.sin(time * 3)})`;
  ctx.beginPath();
  ctx.ellipse(868, 290, 90, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The door casing.
  ctx.strokeStyle = '#d8cfb8';
  ctx.lineWidth = 12;
  ctx.strokeRect(ox0 - 6, oy0 - 6, ox1 - ox0 + 12, oy1 - oy0 + 12);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(ox0 - 12, oy0 - 12, ox1 - ox0 + 24, oy1 - oy0 + 24);
  ctx.strokeRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
  ctx.restore();
}
