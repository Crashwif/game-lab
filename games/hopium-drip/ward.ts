/**
 * The ward at Degen General: the bed and the patient sitting up with his
 * laptop, the IV stand whose HOPIUM bag drains on the multiplier curve, the
 * doctor and the clipboard whose notes get worse, the flowers that wilt, the
 * roommate behind the curtain who flatlines first, the discharge walk and,
 * at the crash, the sheet over the laptop and the time of death. Nothing
 * here changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const WARD = { x: 0, y: 0, w: 640, h: 540 } as const;
export type Point = { x: number; y: number };

export type BagLabel = 'HOPIUM' | 'COPIUM' | 'RUGGED';
export type PatientMode = 'bed' | 'unplugging' | 'dressing' | 'walking' | 'gone';
/** What happened this step, for the scene's sound and camera: each is true for one frame. */
export interface WardEvents { roommate: boolean; wife: boolean; wifeLeave: boolean; walk: boolean; cart: boolean; clear: boolean; zap: boolean; tod: boolean }

/** The resuscitation, in seconds after the flatline: two CLEARs and shocks, the paddles down, the sheet, the time of death. */
const SHOCKS = [1.15, 2.05] as const;
const CLEAR_LEAD = 0.35;
const PADDLES_DOWN = 2.8;
const SHEET_AT = 3.1;
export const TOD_AT = 3.5;
/** Where the crash cart parks by the bed, and where it waits off the right edge. */
const CART_IN = 596;
const CART_OUT = 730;
/** Where the wife stands, and where she waits outside the door. */
const WIFE_X = 72;
const WIFE_OUT = -90;

interface Drop { y: number; age: number }
interface Petal { x: number; y: number; vx: number; vy: number; rot: number; age: number }

export interface Ward {
  time: number;
  lean: Spring;
  twitch: Spring;
  pupil: Spring;
  typing: Spring;
  blinkAt: number;
  eyeOpen: Spring;
  /** 1 full, 0 empty. */
  level: Spring;
  refill: number;
  label: BagLabel;
  swap: Spring;
  drops: Drop[];
  nextDrop: number;
  doctorLean: Spring;
  doctorPen: Spring;
  /** The latest note on the chart; -1 until the first dose. */
  noteIndex: number;
  wilt: Spring;
  petals: Petal[];
  curtain: Spring;
  roommateGone: Spring;
  roommateFlat: boolean;
  patient: { mode: PatientMode; x: number; modeAge: number; suit: Spring; balloon: Spring };
  dead: boolean;
  deadAge: number;
  sheet: Spring;
  deathX100: number;
  shock: Spring;
  lights: number;
  /** The crash cart (in past 4×, or with the crash), the paddles in the doctor's hands, his lunge at the laptop, the clipboard he drops. */
  cartX: Spring;
  cartIn: boolean;
  paddles: Spring;
  lunge: Spring;
  clipDrop: Spring;
  /** Shocks given, and how long since the last CLEAR and the last zap. */
  shocks: number;
  clearAge: number;
  zapAge: number;
  clearPop: Spring;
  /** The wife at the door with the papers: where she stands, whether she has come in, what the papers say and for how long. */
  wifeX: Spring;
  wifeIn: boolean;
  wifeMood: 'papers' | 'signed' | 'nvm';
  moodAge: number;
  events: WardEvents;
}

/** One per dose, short enough to sit inside the clipboard: the first lands with the first dose, the ninth with the ninth. */
const NOTES = ['stable-ish', 'wants more', "won't sell", 'pupils wide', 'said lambo', 'wants 100x', 'sold kidney', 'call wife bf', 'DNR: HODL'];
const REFILL_NOTES = ['new IV bag', 'still typing', 'more charts', 'nurse on loop', 'shift change', 'chart allergy'];

export function createWard(): Ward {
  return {
    time: 0, lean: spring(0), twitch: spring(0), pupil: spring(0), typing: spring(0), blinkAt: 2, eyeOpen: spring(1),
    level: spring(1), refill: 0, label: 'HOPIUM', swap: spring(0), drops: [], nextDrop: 0,
    doctorLean: spring(0), doctorPen: spring(0), noteIndex: -1, wilt: spring(0), petals: [],
    curtain: spring(0), roommateGone: spring(0), roommateFlat: false,
    patient: { mode: 'bed', x: 300, modeAge: 0, suit: spring(0), balloon: spring(0) },
    dead: false, deadAge: 0, sheet: spring(0), deathX100: 100, shock: spring(0), lights: 0,
    cartX: spring(CART_OUT), cartIn: false, paddles: spring(0), lunge: spring(0), clipDrop: spring(0),
    shocks: 0, clearAge: 9, zapAge: 9, clearPop: spring(0),
    wifeX: spring(WIFE_OUT), wifeIn: false, wifeMood: 'papers', moodAge: 9,
    events: { roommate: false, wife: false, wifeLeave: false, walk: false, cart: false, clear: false, zap: false, tod: false },
  };
}

export function resetWard(w: Ward): void {
  settleSpring(w.lean, 0); settleSpring(w.twitch, 0); settleSpring(w.pupil, 0); settleSpring(w.typing, 0); settleSpring(w.eyeOpen, 1);
  settleSpring(w.level, 1); w.refill = 0; w.label = 'HOPIUM'; settleSpring(w.swap, 0); w.drops = []; w.nextDrop = 0;
  settleSpring(w.doctorLean, 0); settleSpring(w.doctorPen, 0); w.noteIndex = -1; settleSpring(w.wilt, 0); w.petals = [];
  settleSpring(w.curtain, 0); settleSpring(w.roommateGone, 0); w.roommateFlat = false;
  w.patient = { mode: 'bed', x: 300, modeAge: 0, suit: spring(0), balloon: spring(0) };
  w.dead = false; w.deadAge = 0; settleSpring(w.sheet, 0); w.deathX100 = 100; settleSpring(w.shock, 0); w.lights = 0;
  settleSpring(w.cartX, CART_OUT); w.cartIn = false; settleSpring(w.paddles, 0); settleSpring(w.lunge, 0); settleSpring(w.clipDrop, 0);
  w.shocks = 0; w.clearAge = 9; w.zapAge = 9; settleSpring(w.clearPop, 0);
  settleSpring(w.wifeX, WIFE_OUT); w.wifeIn = false; w.wifeMood = 'papers'; w.moodAge = 9;
}

/** Jumps the ward to where a running round already is, for a round met late (a reconnect mid-round). */
export function settleWard(w: Ward, tension: number, doses: number): void {
  const t = clamp(tension, 0, 1);
  settleSpring(w.lean, 0.3 + 0.7 * t); settleSpring(w.pupil, t); settleSpring(w.typing, 1); settleSpring(w.doctorLean, 0.5 * t);
  settleSpring(w.level, 1 - t * 0.95);
  settleSpring(w.wilt, clamp(tension * 1.4 - 0.2, 0, 1));
  w.noteIndex = doses - 1;
  if (tension > 0.55) { w.roommateFlat = true; settleSpring(w.roommateGone, 1); settleSpring(w.curtain, 1); }
  if (doses >= 4) { w.label = 'COPIUM'; settleSpring(w.swap, 0); }
  if (tension > 0.6) { w.cartIn = true; settleSpring(w.cartX, CART_IN); }
  if (tension >= 0.7) { w.wifeIn = true; settleSpring(w.wifeX, WIFE_X); }
}

/** A dose milestone: the patient twitches and leans in, the doctor writes, the nurse may swap the bag. */
export function dose(w: Ward, index: number): void {
  w.twitch.v += 14;
  w.lean.v += 6;
  w.doctorPen.v += 12;
  w.noteIndex = index - 1;
  if (index > NOTES.length) { w.refill = 1; w.swap.v += 10; }
  if (index >= 4 && w.label === 'HOPIUM') { w.label = 'COPIUM'; w.swap.v += 10; }
}

/** The accepted exit: the drip is pulled and the patient gets dressed. */
export function discharge(w: Ward): void {
  if (w.patient.mode === 'bed' && !w.dead) { w.patient.mode = 'unplugging'; w.patient.modeAge = 0; }
}

/** An exit accepted before the ward saw it: the patient has already walked out, suit and balloon and all. */
export function settleDischarge(w: Ward): void {
  if (!w.dead) w.patient = { mode: 'gone', x: WARD.w + 80, modeAge: 0, suit: spring(1), balloon: spring(1) };
}

/** The flatline. `quiet`, for a crash that already happened, skips the effects and settles into the aftermath. */
export function flatline(w: Ward, crashX100: number, quiet: boolean): void {
  if (w.dead) return;
  w.dead = true;
  w.deathX100 = crashX100;
  w.deadAge = quiet ? 10 : 0;
  w.label = 'RUGGED';
  w.drops = [];
  const rng = mulberry32(crashX100);
  w.lights = 0.3 + rng() * 0.4;
  if (quiet) {
    settleSpring(w.sheet, 1); settleSpring(w.level, 0); settleSpring(w.doctorLean, 1);
    settleSpring(w.lean, 0); settleSpring(w.typing, 0); settleSpring(w.pupil, 1); settleSpring(w.eyeOpen, 0.05); settleSpring(w.wilt, 1);
    // The resuscitation already happened: the cart is by the bed, the paddles are down, the clipboard is on the floor.
    w.cartIn = true; settleSpring(w.cartX, CART_IN); settleSpring(w.clipDrop, 1); w.shocks = SHOCKS.length;
    if (w.wifeIn) w.wifeMood = 'signed';
    return;
  }
  w.shock.v += 8;
  w.twitch.v += 20;
}

export interface WardDrive { running: boolean; tension: number; multiplier: number; reduced: boolean }

export function stepWard(w: Ward, drive: WardDrive, dt: number): void {
  const e = w.events;
  e.roommate = e.wife = e.wifeLeave = e.walk = e.cart = e.clear = e.zap = e.tod = false;
  w.time += dt;
  const t = drive.tension;
  const alive = !w.dead && w.patient.mode === 'bed';
  stepSpring(w.lean, alive && drive.running ? 0.3 + 0.7 * t : 0, 6, 0.6, dt);
  stepSpring(w.twitch, 0, 14, 0.25, dt);
  stepSpring(w.pupil, alive && drive.running ? t : w.dead ? 1 : 0, 4, 0.9, dt);
  stepSpring(w.typing, alive && drive.running ? 1 : 0, 8, 0.8, dt);
  const blinking = w.time > w.blinkAt && w.time < w.blinkAt + 0.12;
  if (w.time >= w.blinkAt + 0.12) w.blinkAt = w.time + 1.5 + 3 * noise(w.blinkAt) * (1 - 0.6 * t);
  stepSpring(w.eyeOpen, w.dead ? 0.05 : blinking ? 0.1 : 1 + 0.4 * t, 24, 0.9, dt);
  if (drive.running && alive) w.refill = Math.max(0, w.refill - dt / 10);
  stepSpring(w.level, w.dead ? 0 : drive.running && alive ? Math.max(1 - t * 0.95, w.refill) : w.level.x, 3, 1, dt);
  stepSpring(w.swap, 0, 8, 0.5, dt);
  if (drive.running && alive && w.time > w.nextDrop) {
    w.nextDrop = w.time + mix(0.9, 0.12, t);
    w.drops.push({ y: 0, age: 0 });
  }
  for (const d of w.drops) { d.age += dt; d.y += (60 + 120 * d.age) * dt; }
  w.drops = w.drops.filter((d) => d.y < 130);
  stepSpring(w.doctorLean, w.dead ? 1 : drive.running ? 0.5 * t : 0, 5, 0.8, dt);
  stepSpring(w.doctorPen, 0, 10, 0.4, dt);
  stepSpring(w.wilt, drive.running || w.dead ? clamp(t * 1.4 - 0.2, 0, 1) + (w.dead ? 1 : 0) : w.wilt.x, 2, 1, dt);
  if ((drive.running || w.dead) && w.wilt.x > 0.3 && noise(Math.floor(w.time * 6) * 1.7) > 0.85 - 0.3 * w.wilt.x && w.petals.length < 24) {
    w.petals.push({ x: 560 + noise(w.time * 9) * 30, y: 236, vx: (noise(w.time * 5) - 0.5) * 20, vy: 10, rot: noise(w.time) * 6, age: 0 });
  }
  for (const p of w.petals) { p.age += dt; p.x += p.vx * dt + Math.sin(p.age * 4) * 12 * dt; p.y += (p.vy + 40 * p.age) * dt; p.rot += dt * 2; }
  w.petals = w.petals.filter((p) => p.y < 400);
  if (!w.roommateFlat && drive.running && t > 0.55) { w.roommateFlat = true; e.roommate = true; }
  stepSpring(w.curtain, w.roommateFlat ? 1 : 0, 3, 0.9, dt);
  stepSpring(w.roommateGone, w.roommateFlat && w.curtain.x > 0.8 ? 1 : 0, 2.5, 1, dt);
  const p = w.patient;
  p.modeAge += dt;
  if (p.mode === 'unplugging' && p.modeAge > 0.8) { p.mode = 'dressing'; p.modeAge = 0; }
  if (p.mode === 'dressing' && p.modeAge > 0.9) { p.mode = 'walking'; p.modeAge = 0; }
  if (p.mode === 'walking') { p.x += 150 * dt; if (p.x > WARD.w + 80) { p.mode = 'gone'; p.modeAge = 0; e.walk = true; } }
  stepSpring(p.suit, p.mode === 'dressing' || p.mode === 'walking' || p.mode === 'gone' ? 1 : 0, 10, 0.5, dt);
  stepSpring(p.balloon, p.mode === 'walking' || p.mode === 'gone' ? 1 : 0, 6, 0.6, dt);
  // The crash cart rolls in past 4× "just in case", or with the crash if it is not there yet; it overshoots and settles.
  if (!w.cartIn && ((drive.running && alive && t > 0.6) || w.dead)) { w.cartIn = true; e.cart = true; }
  stepSpring(w.cartX, w.cartIn ? CART_IN : CART_OUT, 5, 0.55, dt);
  // The wife comes in past 5× with the papers, signs them at the death, and lets it go if he walks out.
  if (!w.wifeIn && drive.running && alive && t >= 0.7) { w.wifeIn = true; e.wife = true; w.moodAge = 0; }
  w.moodAge += dt;
  const walkedOut = p.mode === 'dressing' || p.mode === 'walking' || p.mode === 'gone';
  if (w.wifeIn && walkedOut && w.wifeMood === 'papers') { w.wifeMood = 'nvm'; w.moodAge = 0; e.wifeLeave = true; }
  const wifeHere = w.wifeIn && !(w.wifeMood === 'nvm' && w.moodAge > 1.3);
  stepSpring(w.wifeX, wifeHere ? WIFE_X : WIFE_OUT, 4, 0.75, dt);
  w.clearAge += dt;
  w.zapAge += dt;
  if (w.dead) {
    const was = w.deadAge;
    w.deadAge += dt;
    const crossed = (at: number): boolean => was <= at && w.deadAge > at;
    // The resuscitation: the paddles come up, CLEAR, a shock, CLEAR, a shock, then the sheet and the time of death.
    for (const at of SHOCKS) {
      if (crossed(at - CLEAR_LEAD)) { w.clearAge = 0; w.clearPop.v = 12; e.clear = true; }
      if (crossed(at)) { w.shocks += 1; w.zapAge = 0; w.twitch.v += 26; w.lean.v += 9; w.eyeOpen.v += 20; e.zap = true; }
    }
    if (crossed(TOD_AT)) e.tod = true;
    if (w.wifeIn && crossed(0.6)) { w.wifeMood = 'signed'; w.moodAge = 0; }
    const working = w.deadAge > 0.45 && w.deadAge < PADDLES_DOWN;
    stepSpring(w.paddles, working ? 1 : 0, 9, 0.6, dt);
    stepSpring(w.lunge, working && w.deadAge > 0.8 ? 1 : 0, 7, 0.55, dt);
    stepSpring(w.clipDrop, 1, 6, 1, dt);
    stepSpring(w.sheet, w.deadAge > SHEET_AT ? 1 : 0, 6, 0.9, dt);
    stepSpring(w.shock, w.deadAge < PADDLES_DOWN ? 1 : 0, 8, 0.8, dt);
  } else {
    stepSpring(w.paddles, 0, 9, 0.6, dt);
    stepSpring(w.lunge, 0, 7, 0.55, dt);
    stepSpring(w.clipDrop, 0, 6, 1, dt);
  }
  stepSpring(w.clearPop, 0, 12, 0.4, dt);
}

/** Two-bone joint. Longer bones than the reach make the knee or elbow stick out; `side` picks the direction. */
function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return {
    x: root.x + (dx / distance) * along - (dy / distance) * bend,
    y: root.y + (dy / distance) * along + (dx / distance) * bend,
  };
}

/** Strokes a two-bone limb and returns the joint so a tube or a string can meet it. */
function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): Point {
  const joint = bendJoint(a, b, upper, lower, side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(joint.x, joint.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(joint.x, joint.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  return joint;
}

function memeSmall(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center'): void {
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.12); ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

/** The IV stand and the bag, its level and its label, the drip line to the arm. */
function drawDrip(ctx: CanvasRenderingContext2D, w: Ward, tension: number): void {
  const x = 150;
  ctx.save();
  ctx.lineJoin = 'round';
  // Stand.
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, 470); ctx.stroke();
  ctx.strokeStyle = '#9aa7b5'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 6;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, 460); ctx.lineTo(x + side * 30, 478); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 30, 118); ctx.lineTo(x + 30, 118); ctx.stroke();
  // Bag, shaken when the nurse swaps it.
  const swap = clamp(w.swap.x, -1, 1);
  ctx.save();
  ctx.translate(x, 122 + Math.abs(swap) * 10);
  ctx.rotate(swap * 0.2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke();
  const bw = 62, bh = 110;
  ctx.fillStyle = 'rgba(230, 240, 245, 0.75)';
  ctx.beginPath(); ctx.roundRect(-bw / 2, 12, bw, bh, 12); ctx.fill();
  const level = clamp(w.level.x, 0, 1);
  const colour = w.label === 'HOPIUM' ? '#7cf67c' : w.label === 'COPIUM' ? '#8fd3ff' : '#ff4d6d';
  ctx.save();
  ctx.beginPath(); ctx.roundRect(-bw / 2, 12, bw, bh, 12); ctx.clip();
  const top = 12 + bh * (1 - level);
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.moveTo(-bw / 2, top + Math.sin(w.time * 3) * 2); ctx.quadraticCurveTo(0, top - 3 + Math.sin(w.time * 4) * 2, bw / 2, top + Math.cos(w.time * 3) * 2); ctx.lineTo(bw / 2, 12 + bh); ctx.lineTo(-bw / 2, 12 + bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-bw / 2 + 6, 20, 6, bh - 16);
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-bw / 2, 12, bw, bh, 12); ctx.stroke();
  // Label.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(-bw / 2 + 6, 50, bw - 12, 34, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = w.label === 'RUGGED' ? '#ff4d6d' : INK;
  ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(w.label, 0, 64);
  ctx.font = '700 8px system-ui, sans-serif'; ctx.fillStyle = INK;
  const dose = w.label === 'RUGGED' ? '0 mg' : `${Math.round(level * 1000)} mg`;
  const hint = w.label === 'RUGGED' ? 'empty' : w.label === 'HOPIUM' ? 'as needed' : 'if it dips';
  ctx.fillText(dose, 0, 73);
  ctx.fillText(hint, 0, 81);
  // Drip chamber and drops.
  ctx.fillStyle = 'rgba(230, 240, 245, 0.8)';
  ctx.beginPath(); ctx.roundRect(-9, 12 + bh + 4, 18, 30, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = colour;
  for (const d of w.drops) if (d.y < 28) {
    ctx.save();
    ctx.translate(0, 12 + bh + 8 + d.y);
    ctx.scale(0.65, 1.45);
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(3.4, 0, 0, 4); ctx.quadraticCurveTo(-3.4, 0, 0, -4); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // Line follows the cannula elbow, and sags between drips.
  const arm = cannula(w, tension);
  const elbow = arm?.elbow ?? { x: 210, y: 330 };
  const hand = arm?.hand ?? { x: 236, y: 356 };
  const sag = Math.sin(w.time * 2.4) * 7;
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, 280); ctx.quadraticCurveTo((x + elbow.x) / 2, (280 + elbow.y) / 2 + 26 + sag, elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}

/** The cannula arm in ward space, matching the bed pose so the drip can meet the elbow. */
function cannula(w: Ward, tension: number): { elbow: Point; hand: Point } | null {
  const p = w.patient;
  if (p.mode !== 'bed' && p.mode !== 'unplugging') return null;
  const lean = clamp(w.lean.x, 0, 1.2);
  const twitch = clamp(w.twitch.x, -1, 1.5);
  const heave = w.dead ? 0 : Math.sin(w.time * (3.2 + 9 * tension));
  const ox = 300;
  const oy = 380 - lean * 8 + twitch * 3;
  const rot = 0.18 * lean;
  const sx = 1 + 0.015 * heave;
  const sy = 1 + 0.04 * heave;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const map = (pt: Point): Point => {
    const x = pt.x * sx;
    const y = pt.y * sy;
    return { x: ox + x * c - y * s, y: oy + x * s + y * c };
  };
  const hand = { x: -64, y: -24 };
  return { elbow: map(bendJoint({ x: -22, y: -96 }, hand, 50, 46, 1)), hand: map(hand) };
}

/** The clipboard with the chart's notes: in the doctor's hand, or where he dropped it. */
function drawClipboard(ctx: CanvasRenderingContext2D, w: Ward, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#c9a26b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-34, -30, 68, 80, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-29, -22, 58, 66, 2); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-14, -36, 28, 12, 3); ctx.fill();
  ctx.fillStyle = '#e63946'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('CHART', -25, -10);
  ctx.fillStyle = INK; ctx.font = '600 8px system-ui, sans-serif';
  // The last five notes, or four once the time of death takes the bottom line. They stop short of the pen hand.
  const tod = w.dead && w.deadAge > TOD_AT;
  const last = tod ? 3 : 4;
  for (let i = 0; i <= Math.min(w.noteIndex, last); i += 1) {
    const idx = Math.max(0, w.noteIndex - last) + i;
    ctx.fillStyle = idx >= 5 ? '#e63946' : INK;
    ctx.fillText(`· ${NOTES[idx] ?? REFILL_NOTES[(idx - NOTES.length) % REFILL_NOTES.length] ?? ''}`, -27, 2 + i * 9, 50);
  }
  if (tod) { ctx.fillStyle = '#e63946'; ctx.font = '900 10px Impact, "Arial Black", sans-serif'; ctx.fillText(`TOD ${(w.deathX100 / 100).toFixed(2)}×`, -25, 42); }
  ctx.restore();
}

/** One defibrillator paddle in a hand: the plate, the grip, and the charge light. */
function drawPaddle(ctx: CanvasRenderingContext2D, x: number, y: number, up: number, charged: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5 * up);
  ctx.fillStyle = '#3a3f4a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-6, -4, 12, 30, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9d6dc';
  ctx.beginPath(); ctx.roundRect(-16, -36, 32, 34, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = charged ? '#ff4d6d' : '#7a1f28';
  ctx.beginPath(); ctx.arc(0, -2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.font = '900 7px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('BUY', 0, -24); ctx.fillText('THE DIP', 0, -14);
  ctx.restore();
}

/** The crash cart by the bed: a red cabinet on wheels with the defibrillator on top and the cables to the paddles. */
function drawCart(ctx: CanvasRenderingContext2D, w: Ward, charged: boolean): void {
  const x = w.cartX.x;
  if (x > WARD.w + 60) return;
  ctx.save();
  ctx.translate(x, 470);
  ctx.lineJoin = 'round';
  for (const wx of [-24, 24]) { ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(wx, 2, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#c8323f'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-34, -70, 68, 66, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28,31,38,0.35)'; ctx.lineWidth = 2;
  for (const dy of [-48, -26]) { ctx.beginPath(); ctx.moveTo(-30, dy); ctx.lineTo(30, dy); ctx.stroke(); }
  ctx.fillStyle = '#ffe27a'; ctx.font = '900 10px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('BUY THE DIP', 0, -55);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 7px system-ui, sans-serif';
  ctx.fillText('CRASH CART', 0, -34);
  ctx.fillText('(1 use left)', 0, -12);
  // The unit on top: a screen that reads the charge.
  ctx.fillStyle = '#d7dde8'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-28, -96, 56, 26, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = charged ? '#ff4d6d' : '#0f1b22';
  ctx.beginPath(); ctx.roundRect(-22, -91, 30, 16, 2); ctx.fill();
  ctx.fillStyle = charged ? '#ffffff' : '#7cf67c'; ctx.font = '900 8px Impact, "Arial Black", sans-serif';
  ctx.fillText(charged ? 'CHARGED' : '200 J', -7, -80);
  ctx.fillStyle = charged ? '#ffe27a' : '#3a3f4a'; ctx.beginPath(); ctx.arc(18, -83, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** The wife at the door with the papers: arms folded round an envelope, a tapping foot, and the stamp once it is over. */
function drawWife(ctx: CanvasRenderingContext2D, w: Ward): void {
  const x = w.wifeX.x;
  if (x < WIFE_OUT + 10) return;
  ctx.save();
  ctx.translate(x, 470);
  ctx.lineJoin = 'round';
  const skin = '#e7c3a5';
  const tap = w.wifeMood === 'papers' ? Math.max(0, Math.sin(w.time * 7)) * 5 : 0;
  // Legs and shoes; the near foot taps.
  for (const side of [-1, 1]) {
    const lift = side > 0 ? tap : 0;
    limb(ctx, { x: side * 9, y: -80 }, { x: side * 11, y: -lift }, 46, 42, -side, 12, skin);
    ctx.fillStyle = '#5a1e5a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(side * 11, 3 - lift, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // Dress.
  ctx.fillStyle = '#7b2d8b'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-36, -76); ctx.lineTo(36, -76); ctx.lineTo(24, -160); ctx.lineTo(-24, -160); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Arms folded across, holding the envelope.
  limb(ctx, { x: -22, y: -152 }, { x: 18, y: -118 }, 30, 28, 1, 11, skin);
  limb(ctx, { x: 22, y: -152 }, { x: -18, y: -122 }, 30, 28, -1, 11, skin);
  // The envelope.
  ctx.save();
  ctx.translate(0, -126); ctx.rotate(-0.12);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-30, -12, 60, 24, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946'; ctx.font = '900 8px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  if (w.wifeMood === 'signed') {
    // The stamp takes the envelope; the title shrinks to its corner.
    ctx.font = '900 6px Impact, "Arial Black", sans-serif';
    ctx.fillText('DIVORCE PAPERS', 0, -5);
    ctx.rotate(-0.2);
    ctx.strokeStyle = '#e63946'; ctx.lineWidth = 2;
    ctx.strokeRect(-22, -2, 44, 13);
    ctx.font = '900 10px Impact, "Arial Black", sans-serif';
    ctx.fillText('SIGNED', 0, 8);
  } else {
    ctx.fillText('DIVORCE', 0, -2); ctx.fillText('PAPERS', 0, 8);
  }
  ctx.restore();
  // Head, bun, brows.
  const hy = -190;
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 22, 25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2418';
  ctx.beginPath(); ctx.moveTo(-23, hy - 6); ctx.quadraticCurveTo(-20, hy - 32, 0, hy - 30); ctx.quadraticCurveTo(20, hy - 32, 23, hy - 6); ctx.quadraticCurveTo(0, hy - 16, -23, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, hy - 32, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-8, hy - 2, 2.2, 0, Math.PI * 2); ctx.arc(8, hy - 2, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  const nvm = w.wifeMood === 'nvm';
  ctx.beginPath();
  if (nvm) { ctx.moveTo(-14, hy - 12); ctx.lineTo(-4, hy - 10); ctx.moveTo(4, hy - 10); ctx.lineTo(14, hy - 12); }
  else { ctx.moveTo(-14, hy - 14); ctx.lineTo(-4, hy - 9); ctx.moveTo(4, hy - 9); ctx.lineTo(14, hy - 14); }
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (nvm) ctx.arc(0, hy + 8, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  else { ctx.moveTo(-7, hy + 12); ctx.lineTo(7, hy + 12); }
  ctx.stroke();
  // Earrings, and what she says.
  ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(-21, hy + 6, 2.5, 0, Math.PI * 2); ctx.arc(21, hy + 6, 2.5, 0, Math.PI * 2); ctx.fill();
  if (w.moodAge < 1.6 && (w.wifeMood === 'nvm' || (w.wifeMood === 'papers' && w.wifeIn))) {
    const text = w.wifeMood === 'nvm' ? 'nvm, love u' : 'sign here.';
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.font = '700 11px system-ui, sans-serif';
    const bw = ctx.measureText(text).width + 18;
    ctx.beginPath(); ctx.roundRect(-bw / 2 + 10, hy - 68, bw, 24, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, hy - 44); ctx.lineTo(16, hy - 44); ctx.lineTo(8, hy - 34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText(text, 10, hy - 52);
  }
  ctx.restore();
}

/** The doctor at the foot of the bed with the clipboard, or lunging at the laptop with the paddles. Returns the paddles' positions when they are up. */
function drawDoctor(ctx: CanvasRenderingContext2D, w: Ward): Point[] {
  const lean = clamp(w.doctorLean.x, 0, 1);
  const pen = clamp(w.doctorPen.x, -1, 1);
  const up = clamp(w.paddles.x, 0, 1.1);
  const lunge = clamp(w.lunge.x, 0, 1.1);
  const charged = up > 0.6;
  const paddles: Point[] = [];
  ctx.save();
  ctx.translate(520 - 45 * lunge, 470);
  ctx.rotate(-0.12 * lean - 0.16 * lunge);
  ctx.translate(Math.sin(w.time * 1.3) * 2, 0);
  ctx.lineJoin = 'round';
  // Legs, shoes, and a coat hem that shifts as he leans in to write.
  for (const side of [-1, 1]) {
    const plant = Math.sin(w.time * 1.3) * side * 2;
    limb(ctx, { x: side * 12, y: -90 }, { x: side * 16 + plant, y: 0 }, 52, 48, -side, 14, '#3d5f8f');
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(side * 16 + plant, 3, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  const hem = Math.sin(w.time * 1.7) * (3 + 4 * lean);
  ctx.fillStyle = '#f4f7fb'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-44, -220); ctx.lineTo(44, -220); ctx.lineTo(42, -108);
  ctx.quadraticCurveTo(18, -90 + hem, 0, -102 - hem);
  ctx.quadraticCurveTo(-18, -90 - hem, -42, -108);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28,31,38,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -215); ctx.lineTo(0, -118); ctx.stroke();
  ctx.fillStyle = '#7cf67c'; ctx.beginPath(); ctx.roundRect(-34, -200, 24, 10, 2); ctx.fill();
  // Stethoscope, swinging off the lean.
  const sway = Math.sin(w.time * 2.1) * 5 * (0.35 + lean);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-16, -216); ctx.quadraticCurveTo(-20 + sway, -170, 6 + sway * 0.45, -160); ctx.stroke();
  ctx.fillStyle = '#9aa7b5'; ctx.beginPath(); ctx.arc(8 + sway * 0.45, -158, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Arms: on the clipboard, or out to the laptop with the paddles.
  const leftHand = { x: mix(-46, -62, up), y: mix(-150, -142, up) };
  const rightHand = { x: mix(20 + pen * 3, -6, up), y: mix(-150, -152, up) };
  limb(ctx, { x: -40, y: -205 }, leftHand, 36, 34, 1, 14, '#f4f7fb');
  limb(ctx, { x: 40, y: -205 }, rightHand, 36, 34, -1, 14, '#f4f7fb');
  if (w.clipDrop.x < 0.02) drawClipboard(ctx, w, -14, -150, -0.25);
  if (up > 0.05) {
    const m = ctx.getTransform();
    for (const hand of [leftHand, rightHand]) {
      drawPaddle(ctx, hand.x, hand.y, up, charged);
      const pt = m.transformPoint(new DOMPoint(hand.x, hand.y));
      paddles.push({ x: pt.x, y: pt.y });
    }
  }
  // Hands (the pen only while he is writing).
  ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(rightHand.x, rightHand.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (up > 0.05) { ctx.beginPath(); ctx.arc(leftHand.x, leftHand.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  if (up < 0.3) {
    ctx.strokeStyle = '#2b2b30'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(18 + pen * 3, -156); ctx.lineTo(4 + pen * 6, -170); ctx.stroke();
  }
  // Head.
  const hy = -246;
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 24, 27, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6b6b70';
  ctx.beginPath(); ctx.moveTo(-25, hy - 6); ctx.quadraticCurveTo(-20, hy - 34, 0, hy - 32); ctx.quadraticCurveTo(22, hy - 34, 25, hy - 6); ctx.quadraticCurveTo(0, hy - 18, -25, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Glasses and a mouth that flattens with the lean.
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.strokeRect(-18, hy - 6, 14, 10); ctx.strokeRect(4, hy - 6, 14, 10);
  ctx.beginPath(); ctx.moveTo(-4, hy - 1); ctx.lineTo(4, hy - 1); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-11, hy - 1, 2, 0, Math.PI * 2); ctx.arc(11, hy - 1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (up > 0.5) { ctx.ellipse(0, hy + 16, 5, 6 + 3 * clamp(w.clearPop.x, 0, 1), 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else { ctx.moveTo(-8, hy + 14); ctx.quadraticCurveTo(0, hy + 14 - 6 * lean, 8, hy + 14); }
  ctx.stroke();
  if (w.dead && w.deadAge > TOD_AT) {
    ctx.save(); ctx.translate(-70, hy - 50); ctx.rotate(-0.06);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-72, -22, 144, 40, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, 18); ctx.lineTo(44, 30); ctx.lineTo(48, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('time of death', 0, -6);
    ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.fillStyle = '#e63946';
    ctx.fillText(`${(w.deathX100 / 100).toFixed(2)}×`, 0, 11);
    ctx.restore();
  }
  ctx.restore();
  return paddles;
}

/** The roommate's bed behind the curtain, and the curtain itself. */
function drawRoommate(ctx: CanvasRenderingContext2D, w: Ward): void {
  const gone = clamp(w.roommateGone.x, 0, 1);
  const curtain = clamp(w.curtain.x, 0, 1);
  ctx.save();
  // Bed, wheeled out to the left when gone.
  ctx.translate(-260 * gone, 0);
  ctx.fillStyle = '#c7d3dd'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(40, 196, 150, 34, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(46, 186, 138, 16, 4); ctx.fill(); ctx.stroke();
  if (gone > 0.05) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(52, 186); ctx.quadraticCurveTo(110, 150, 178, 186); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else {
    // Roommate's head on the pillow.
    ctx.fillStyle = '#e0bda7';
    ctx.beginPath(); ctx.arc(70, 180, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    if (w.roommateFlat) { ctx.beginPath(); ctx.moveTo(64, 177); ctx.lineTo(70, 181); ctx.moveTo(70, 177); ctx.lineTo(64, 181); ctx.moveTo(72, 177); ctx.lineTo(78, 181); ctx.moveTo(78, 177); ctx.lineTo(72, 181); ctx.stroke(); }
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(66, 178, 1.6, 0, Math.PI * 2); ctx.arc(74, 178, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const wx of [58, 176]) { ctx.fillStyle = '#4a5560'; ctx.beginPath(); ctx.arc(wx, 236, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // Small monitor over the roommate that reads a beat, then flat.
  ctx.fillStyle = '#0d1418'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(196, 140, 52, 30, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = w.roommateFlat ? '#ff4d6d' : '#7cf67c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(200, 156);
  for (let i = 0; i <= 44; i += 1) { const ph = ((w.time * 1.2) + i / 44) % 1; const spike = w.roommateFlat ? 0 : ph > 0.45 && ph < 0.55 ? Math.sin((ph - 0.45) * Math.PI * 10) * 8 : 0; ctx.lineTo(200 + i, 156 - spike); }
  ctx.stroke();
  // Curtain rail and curtain, drawn closed with the tension.
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(20, 120); ctx.lineTo(280, 120); ctx.stroke();
  const width = 28 + 232 * curtain;
  ctx.save();
  ctx.translate(20, 122);
  ctx.fillStyle = '#7fb8a4'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 0);
  const folds = 8;
  for (let i = 0; i <= folds; i += 1) { const fx = (width / folds) * i; ctx.lineTo(fx, i % 2 ? 6 : 0); }
  ctx.lineTo(width, 220);
  for (let i = folds; i >= 0; i -= 1) { const fx = (width / folds) * i; ctx.lineTo(fx, 220 + (i % 2 ? 10 : 0)); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28,31,38,0.2)'; ctx.lineWidth = 2;
  for (let i = 1; i < folds; i += 1) { const fx = (width / folds) * i; ctx.beginPath(); ctx.moveTo(fx, 4); ctx.lineTo(fx, 222); ctx.stroke(); }
  ctx.restore();
}

/** The patient in bed with the laptop, or dressing, or walking out. */
function drawPatient(ctx: CanvasRenderingContext2D, w: Ward, tension: number): void {
  const p = w.patient;
  if (p.mode === 'gone') return;
  const inBed = p.mode === 'bed' || p.mode === 'unplugging';
  const suit = clamp(p.suit.x, 0, 1);
  const lean = clamp(w.lean.x, 0, 1.2);
  const twitch = clamp(w.twitch.x, -1, 1.5);
  const shock = clamp(w.shock.x, 0, 1);
  const dead = w.dead;
  ctx.save();
  if (inBed) ctx.translate(300, 380 - lean * 8 + twitch * 3);
  else { ctx.translate(p.x, 470); if (p.mode === 'walking') ctx.translate(0, -Math.abs(Math.sin(w.time * 10)) * 5); }
  ctx.lineJoin = 'round';
  const gown = suit > 0.5 ? '#2b2b30' : '#bfe0ec';
  const skin = '#f3dccb';
  if (inBed) {
    // Legs under the sheet: a lump.
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(60, -40, 180, -10); ctx.lineTo(180, 20); ctx.lineTo(-30, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Torso, leaning toward the laptop.
    ctx.save();
    ctx.rotate(0.18 * lean);
    const heave = dead ? 0 : Math.sin(w.time * (3.2 + 9 * tension));
    ctx.scale(1 + 0.015 * heave, 1 + 0.04 * heave);
    ctx.fillStyle = gown;
    ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-50, -100, -20, -118); ctx.lineTo(24, -118); ctx.quadraticCurveTo(52, -100, 48, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(28,31,38,0.15)';
    for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.arc(-24 + i * 16, -60 + (i % 2) * 20, 3, 0, Math.PI * 2); ctx.fill(); }
    // Laptop on the lap, lid glow.
    ctx.save();
    ctx.translate(70, -12);
    ctx.fillStyle = '#3a3f4a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-40, -4, 80, 10, 3); ctx.fill(); ctx.stroke();
    const typingNow = clamp(w.typing.x, 0, 1) * (dead ? 0 : 1);
    ctx.fillStyle = '#23272e';
    for (let i = 0; i < 7; i += 1) {
      const down = typingNow > 0.2 && Math.sin(w.time * (12 + 10 * tension) + i * 1.7) > 0.55 ? 1.6 : 0;
      ctx.fillRect(-32 + i * 9, -2 + down, 6, 2);
    }
    ctx.save(); ctx.rotate(-0.2);
    ctx.beginPath(); ctx.roundRect(-38, -66, 76, 62, 3); ctx.fill(); ctx.stroke();
    if (!(dead && w.sheet.x > 0.5)) {
      ctx.fillStyle = dead ? '#3a1420' : '#0f1b22';
      ctx.fillRect(-34, -62, 68, 54);
      // The chart on the screen, or the drop.
      ctx.strokeStyle = dead ? '#ff4d6d' : '#7cf67c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-32, -12);
      for (let i = 0; i <= 12; i += 1) { const fx = -32 + i * 5.3; const climb = dead ? (i < 9 ? i * 3.6 : 32 - (i - 9) * 14) : i * (1.4 + 3 * tension) + Math.sin(i * 2.3) * 2; ctx.lineTo(fx, -12 - clamp(climb, -6, 46)); }
      ctx.stroke();
      ctx.fillStyle = dead ? '#ff4d6d' : '#ffffff'; ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(dead ? '$HOPE  -100%' : '$HOPE', -31, -52);
    }
    ctx.restore();
    ctx.restore();
    // Arms: one typing on the laptop, one with the line in it.
    const type = clamp(w.typing.x, 0, 1) * (dead ? 0 : 1);
    const tap = Math.sin(w.time * (10 + 14 * tension)) * 4 * type;
    const tapHand = { x: 74, y: -30 + tap };
    limb(ctx, { x: 22, y: -96 }, tapHand, 50, 46, tapHand.y >= -96 ? -1 : 1, 15, gown);
    const ivHand = { x: -64, y: -24 };
    const ivElbow = limb(ctx, { x: -22, y: -96 }, ivHand, 50, 46, ivHand.y >= -96 ? 1 : -1, 15, gown);
    const line = w.label === 'HOPIUM' ? '#7cf67c' : w.label === 'COPIUM' ? '#8fd3ff' : '#ff4d6d';
    ctx.strokeStyle = line; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ivElbow.x, ivElbow.y); ctx.lineTo(ivHand.x, ivHand.y); ctx.stroke();
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ivHand.x, ivHand.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(tapHand.x, tapHand.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Cannula tape.
    ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.roundRect(-74, -32, 18, 9, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '900 6px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HODL', -65, -25);
    if (p.mode === 'unplugging') { const k = smoothstep(0, 0.6, p.modeAge); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(-140 * k - 30, -70 - 20 * k, 72, 22, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('UNPLUGGED', -140 * k + 6, -55 - 20 * k); }
    ctx.restore();
  } else {
    // Standing: knees that lift, a hem that lags the step, the balloon string in the hand.
    const stride = p.mode === 'walking' ? w.time * 10 : w.time * 1.4;
    const walking = p.mode === 'walking' ? 1 : 0.18;
    const trouser = suit > 0.5 ? '#2b2b30' : '#bfe0ec';
    for (const side of [-1, 1]) {
      const phase = stride + (side > 0 ? Math.PI : 0);
      const lift = Math.max(0, Math.sin(phase)) * 16 * walking;
      const reach = Math.cos(phase) * 12 * walking;
      limb(ctx, { x: side * 10, y: -96 }, { x: side * 12 + reach, y: -lift }, 54, 50, -side, 15, trouser);
      ctx.fillStyle = suit > 0.5 ? '#111114' : skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(side * 12 + reach, 3 - lift, 10, 4.5, reach * 0.02, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const hem = Math.sin(w.time * (p.mode === 'walking' ? 8 : 2.2)) * (p.mode === 'walking' ? 8 : 2);
    ctx.fillStyle = gown; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-44, -100); ctx.quadraticCurveTo(-48, -190, -18, -208); ctx.lineTo(18, -208); ctx.quadraticCurveTo(48, -190, 44, -100);
    ctx.quadraticCurveTo(16, -78 + hem, 0, -88 - hem); ctx.quadraticCurveTo(-16, -78 - hem, -44, -100);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (suit > 0.5) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-14, -206); ctx.lineTo(0, -150); ctx.lineTo(14, -206); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(-5, -204); ctx.lineTo(5, -204); ctx.lineTo(3, -150); ctx.lineTo(-3, -150); ctx.closePath(); ctx.fill(); }
    const offHand = { x: -52 + Math.sin(w.time * 2) * 4, y: -108 };
    limb(ctx, { x: -28, y: -176 }, offHand, 46, 42, offHand.y >= -176 ? 1 : -1, 15, gown);
    const balloon = clamp(p.balloon.x, 0, 1);
    const stringY = -230 * balloon - 110 * (1 - balloon) + Math.sin(w.time * 3) * 8 * balloon;
    limb(ctx, { x: 28, y: -176 }, { x: 60, y: stringY }, 46, 42, stringY >= -176 ? -1 : 1, 15, gown);
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(offHand.x, offHand.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(60, stringY, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (balloon > 0.05) {
      const by = -230 - 120 * balloon + Math.sin(w.time * 2) * 6;
      const lag = Math.sin(w.time * 3) * 10 * balloon;
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(60, stringY); ctx.quadraticCurveTo(78 + lag, (stringY + by) / 2, 66, by + 40); ctx.stroke();
      ctx.fillStyle = '#7cf67c'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(66, by, 34 * balloon, 42 * balloon, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (balloon > 0.7) memeSmall(ctx, 'GAINS', 66, by + 7, 18, '#ffffff');
    }
  }
  // Head: big pupils that grow with the hopium, sunken with the death.
  const hy = inBed ? -150 - lean * 6 : -236;
  ctx.save();
  if (inBed) ctx.translate(lean * 18, 0);
  ctx.fillStyle = dead ? '#dcd3cf' : skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 36, 40, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b1d14';
  ctx.beginPath(); ctx.moveTo(-38, hy - 4); ctx.quadraticCurveTo(-36, hy - 52, 0, hy - 50); ctx.quadraticCurveTo(38, hy - 52, 38, hy - 4); ctx.quadraticCurveTo(24, hy - 36, 0, hy - 30); ctx.quadraticCurveTo(-24, hy - 36, -38, hy - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (suit > 0.5) { ctx.fillStyle = INK; ctx.fillRect(-26, hy - 10, 20, 9); ctx.fillRect(6, hy - 10, 20, 9); ctx.fillRect(-6, hy - 8, 12, 3); }
  else {
    const open = clamp(w.eyeOpen.x, 0.05, 1.4);
    const pupil = clamp(w.pupil.x, 0, 1);
    for (const ex of [-14, 14]) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(ex, hy - 4, 9, 11 * open, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (dead && w.deadAge > 0.3) { ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(ex - 5, hy - 9); ctx.lineTo(ex + 5, hy + 1); ctx.moveTo(ex + 5, hy - 9); ctx.lineTo(ex - 5, hy + 1); ctx.stroke(); }
      else if (open > 0.3) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + lean * 2, hy - 3, 2.5 + 6 * pupil, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - 2, hy - 6, 1.6, 0, Math.PI * 2); ctx.fill(); }
    }
    // Bags under the eyes with the tension.
    ctx.strokeStyle = `rgba(90, 60, 120, ${0.3 + 0.5 * tension})`; ctx.lineWidth = 2;
    for (const ex of [-14, 14]) { ctx.beginPath(); ctx.moveTo(ex - 7, hy + 8); ctx.quadraticCurveTo(ex, hy + 13 + 3 * tension, ex + 7, hy + 8); ctx.stroke(); }
  }
  // Brows and mouth.
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  const raise = suit > 0.5 ? 4 : 2 + 6 * tension + 6 * shock;
  ctx.beginPath(); ctx.moveTo(-22, hy - 20 - raise * 0.4); ctx.lineTo(-7, hy - 22 - raise); ctx.moveTo(7, hy - 22 - raise); ctx.lineTo(22, hy - 20 - raise * 0.4); ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (dead) { ctx.moveTo(-8, hy + 20); ctx.lineTo(8, hy + 20); }
  else if (suit > 0.5) { ctx.moveTo(-10, hy + 16); ctx.quadraticCurveTo(0, hy + 26, 10, hy + 16); }
  else if (shock > 0.4 || tension > 0.8) { ctx.ellipse(0, hy + 20, 5 + 3 * shock, 7 + 4 * shock, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else { ctx.moveTo(-9, hy + 18); ctx.quadraticCurveTo(0, hy + 18 + 8 * (0.5 - tension), 9, hy + 18); }
  ctx.stroke();
  // Sweat at high tension.
  if (!dead && suit < 0.5 && tension > 0.5) { ctx.fillStyle = '#8fd3ff'; const dy = (w.time * 30) % 24; ctx.beginPath(); ctx.ellipse(34, hy - 20 + dy, 3, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.restore();
}

/** The whole ward, clipped to its frame. */
export function drawWard(ctx: CanvasRenderingContext2D, w: Ward, tension: number, reduced: boolean): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(WARD.x, WARD.y, WARD.w, WARD.h); ctx.clip();
  // Wall, dado rail, floor; the lights flicker at the crash.
  const flicker = w.dead && !reduced && w.deadAge < 1.2 ? (noise(Math.floor(w.time * 24)) > 0.5 ? 1 : 0.7) : 1;
  ctx.fillStyle = `rgb(${Math.round(214 * flicker)}, ${Math.round(232 * flicker)}, ${Math.round(228 * flicker)})`;
  ctx.fillRect(0, 0, WARD.w, WARD.h);
  ctx.fillStyle = `rgb(${Math.round(150 * flicker)}, ${Math.round(196 * flicker)}, ${Math.round(186 * flicker)})`;
  ctx.fillRect(0, 300, WARD.w, 240);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(WARD.w, 300); ctx.stroke();
  ctx.fillStyle = `rgb(${Math.round(196 * flicker)}, ${Math.round(210 * flicker)}, ${Math.round(214 * flicker)})`;
  ctx.fillRect(0, 480, WARD.w, 60);
  ctx.beginPath(); ctx.moveTo(0, 480); ctx.lineTo(WARD.w, 480); ctx.stroke();
  // Ceiling light strip.
  ctx.fillStyle = `rgba(255, 255, 240, ${0.8 * flicker})`;
  ctx.beginPath(); ctx.roundRect(200, 14, 240, 14, 6); ctx.fill(); ctx.stroke();
  // Ward sign and the poster.
  ctx.fillStyle = '#1f6f8b';
  ctx.beginPath(); ctx.roundRect(340, 50, 220, 40, 4); ctx.fill(); ctx.stroke();
  memeSmall(ctx, 'DEGEN GENERAL · WARD 420', 450, 78, 16, '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(360, 110, 120, 90, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946'; ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WASH YOUR', 420, 140); ctx.fillText('HANDS', 420, 158);
  ctx.fillStyle = INK; ctx.font = '700 9px system-ui, sans-serif';
  ctx.fillText('(paper or diamond)', 420, 178);
  // Window with the night outside.
  ctx.fillStyle = '#0f2a3e';
  ctx.beginPath(); ctx.roundRect(500, 110, 120, 130, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(590, 140, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(560, 110); ctx.lineTo(560, 240); ctx.moveTo(500, 175); ctx.lineTo(620, 175); ctx.stroke();
  // Flowers on the sill that wilt.
  const wilt = clamp(w.wilt.x, 0, 1);
  ctx.fillStyle = '#9aa7b5';
  ctx.beginPath(); ctx.roundRect(548, 240, 36, 26, 4); ctx.fill(); ctx.stroke();
  for (const [i, fx] of [556, 566, 576].entries()) {
    const droop = wilt * (0.6 + 0.3 * noise(i * 3));
    ctx.strokeStyle = wilt > 0.6 ? '#7a6a3a' : '#2e8b57'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(fx, 240); ctx.quadraticCurveTo(fx + 8 * droop, 224, fx + 14 * droop, 214 + 22 * droop); ctx.stroke();
    ctx.fillStyle = wilt > 0.6 ? '#a68a5a' : ['#ff5d9e', '#ffe27a', '#8fd3ff'][i]!;
    ctx.beginPath(); ctx.arc(fx + 14 * droop, 212 + 22 * droop, 6 - 2 * wilt, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  }
  for (const p of w.petals) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#c9a26b'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  drawRoommate(ctx, w);
  // The bed.
  ctx.fillStyle = '#c7d3dd'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(220, 390, 290, 70, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a5560';
  ctx.beginPath(); ctx.roundRect(214, 300, 16, 160, 4); ctx.fill(); ctx.stroke();
  for (const wx of [240, 494]) { ctx.beginPath(); ctx.arc(wx, 466, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(232, 330, 60, 40, 8); ctx.fill(); ctx.stroke();
  drawPatient(ctx, w, tension);
  // Blanket over the legs, drawn after the patient.
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  if (w.patient.mode === 'bed' || w.patient.mode === 'unplugging') { ctx.beginPath(); ctx.moveTo(330, 372); ctx.quadraticCurveTo(400, 350, 508, 376); ctx.lineTo(508, 392); ctx.lineTo(330, 392); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // The sheet over the laptop at the end.
  const sheet = clamp(w.sheet.x, 0, 1);
  if (sheet > 0.02) {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(320, 400); ctx.quadraticCurveTo(330, 330 - 40 * sheet, 372, 316 - 30 * sheet); ctx.quadraticCurveTo(410, 300 - 40 * sheet, 430, 340 - 20 * sheet); ctx.lineTo(440, 400); ctx.closePath();
    ctx.globalAlpha = sheet; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawDrip(ctx, w, tension);
  const charged = w.paddles.x > 0.6;
  drawCart(ctx, w, charged);
  const paddles = drawDoctor(ctx, w);
  // The clipboard he dropped: it falls from his hand to the floor by the bed.
  const drop = clamp(w.clipDrop.x, 0, 1);
  if (drop >= 0.02) {
    const k = smoothstep(0, 1, drop);
    drawClipboard(ctx, w, mix(498, 440, k), mix(322, 466, k * k), mix(-0.25, -1.35, k));
  }
  // The cables from the cart to the paddles, and the shock itself: bolts between the paddles and round the laptop.
  if (paddles.length === 2) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const p of paddles) { ctx.beginPath(); ctx.moveTo(w.cartX.x - 10, 386); ctx.quadraticCurveTo((p.x + w.cartX.x) / 2, 430 + Math.sin(w.time * 3) * 6, p.x, p.y); ctx.stroke(); }
    if (w.zapAge < 0.22 && !reduced) {
      const k = 1 - w.zapAge / 0.22;
      ctx.strokeStyle = `rgba(255, 226, 122, ${k})`; ctx.lineWidth = 3; ctx.lineJoin = 'miter';
      const [a, b] = paddles as [Point, Point];
      for (let j = 0; j < 3; j += 1) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y);
        for (let i = 1; i < 6; i += 1) { const u = i / 6; ctx.lineTo(mix(a.x, b.x, u) + (noise(i * 3.1 + j * 7 + Math.floor(w.time * 40)) - 0.5) * 26, mix(a.y, b.y, u) + (noise(i * 5.3 + j * 11 + Math.floor(w.time * 40)) - 0.5) * 26); }
        ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.fillStyle = `rgba(255, 255, 240, ${0.35 * k})`; ctx.beginPath(); ctx.arc(385, 345, 70, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (w.clearAge < 0.7 && w.dead) {
    ctx.save();
    ctx.translate(540, 300); ctx.rotate(-0.08);
    const k = 1 + 0.25 * clamp(w.clearPop.x, 0, 1.2);
    ctx.scale(k, k);
    ctx.globalAlpha = w.clearAge > 0.5 ? 1 - (w.clearAge - 0.5) / 0.2 : 1;
    memeSmall(ctx, 'CLEAR!', 0, 0, 40, '#ffe27a');
    ctx.restore();
  }
  drawWife(ctx, w);
  // The white of the shock, then the lights dim once the time is called.
  if (w.dead && w.zapAge < 0.1 && !reduced) { ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (1 - w.zapAge / 0.1)})`; ctx.fillRect(0, 0, WARD.w, WARD.h); }
  if (w.dead && w.lights > 0) { ctx.fillStyle = `rgba(10, 20, 30, ${w.lights * smoothstep(TOD_AT - 0.3, TOD_AT + 1.2, w.deadAge)})`; ctx.fillRect(0, 0, WARD.w, WARD.h); }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.strokeRect(WARD.x, WARD.y, WARD.w, WARD.h);
}
