/**
 * The ward at Degen General: the bed and the patient sitting up with his
 * laptop, the IV stand whose HOPIUM bag drains on the multiplier curve, the
 * doctor and the clipboard whose notes get worse, the flowers that wilt, the
 * roommate behind the curtain who flatlines first, the discharge walk and,
 * at the crash, the sheet over the laptop and the time of death. Nothing
 * here changes the outcome.
 */
import { walkingFoot } from './kinematics';
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const WARD = { x: 0, y: 0, w: 640, h: 540 } as const;
export type Point = { x: number; y: number };

export type BagLabel = 'HOPIUM' | 'COPIUM' | 'RUGGED';
export type PatientMode = 'bed' | 'unplugging' | 'dressing' | 'walking' | 'gone';
/** What happened this step, for the scene's sound and camera: each is true for one frame. */
export interface WardEvents { hi: boolean; curtain: boolean; watch: boolean; roommate: boolean; wheel: boolean; wife: boolean; wifeLeave: boolean; walk: boolean; cart: boolean; clear: boolean; zap: boolean; tod: boolean; shrug: boolean }

/** Tension from the displayed multiplier: a third at 1.5×, half at 2×, two thirds at 3×, so the early climb is felt. */
export const tensionAt = (multiplier: number): number => 1 - 1 / Math.max(1, multiplier);
/**
 * Where the ward's story lands on the displayed multiplier (never the outcome): the roommate's wagmi, the
 * curtain, the doctor's watch, the roommate's flatline and his bed wheeled out, the crash cart, the wife.
 */
export const BEAT = { hi: 1.2, curtain: 1.6, watch: 2.05, flat: 2.2, wheel: 2.45, cart: 2.8, wife: 3.5 } as const;
/** How far the curtain is drawn round the roommate while he races, before he is wheeled out. */
const CURTAIN_HALF = 0.62;
/**
 * The resuscitation, in seconds after the flatline: two CLEARs and shocks, the paddles down, the sheet, the
 * time of death. Each shock's hit-stop costs about a quarter second of real time, so the call lands near 1.6 s.
 */
const SHOCKS = [0.42, 0.82] as const;
const CLEAR_LEAD = 0.22;
const PADDLES_DOWN = 0.98;
const SHEET_AT = 1.02;
export const TOD_AT = 1.08;
/** Where the crash cart parks by the bed, and where it waits off the right edge. */
const CART_IN = 596;
const CART_OUT = 730;
/** Where the wife stands, and where she waits outside the door. */
const WIFE_X = 72;
const WIFE_OUT = -90;
/** Her stride lands her in double support (both feet down) at her spot, and her gait runs backward as she leaves. */
const WIFE_STRIDE = (WIFE_X - WIFE_OUT) / 3.54;

interface Drop { y: number; age: number }
interface Petal { x: number; y: number; vx: number; vy: number; rot: number; age: number }

export interface Ward {
  time: number;
  /** Integrated phases of the breathing, the keys, the typing hand and the roommate's beat, so a changing rate never jumps them. */
  heave: number;
  keys: number;
  tapPhase: number;
  roomPhase: number;
  /** Seconds since the roommate's wagmi, the doctor's watch check and the roommate's flatline; -1 until each happens. */
  hiAge: number;
  watchAge: number;
  roomAge: number;
  curtainDrawn: boolean;
  wheeled: boolean;
  watch: Spring;
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
  /** A crash after the discharge: nobody to shock, so the doctor shrugs. */
  dodged: boolean;
  shrug: Spring;
  deadAge: number;
  sheet: Spring;
  deathX100: number;
  shock: Spring;
  lights: number;
  /** The crash cart (in past 2.8×, or with the crash), the paddles in the doctor's hands, his lunge at the laptop, the clipboard he drops. */
  cartX: Spring;
  cartIn: boolean;
  paddles: Spring;
  lunge: Spring;
  clipDrop: Spring;
  clipOrigin: Point;
  clipAngle: number;
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
    time: 0, heave: 0, keys: 0, tapPhase: 0, roomPhase: 0, hiAge: -1, watchAge: -1, roomAge: -1, curtainDrawn: false, wheeled: false, watch: spring(0),
    lean: spring(0), twitch: spring(0), pupil: spring(0), typing: spring(0), blinkAt: 2, eyeOpen: spring(1),
    level: spring(1), refill: 0, label: 'HOPIUM', swap: spring(0), drops: [], nextDrop: 0,
    doctorLean: spring(0), doctorPen: spring(0), noteIndex: -1, wilt: spring(0), petals: [],
    curtain: spring(0), roommateGone: spring(0), roommateFlat: false,
    patient: { mode: 'bed', x: 300, modeAge: 0, suit: spring(0), balloon: spring(0) },
    dead: false, dodged: false, shrug: spring(0), deadAge: 0, sheet: spring(0), deathX100: 100, shock: spring(0), lights: 0,
    cartX: spring(CART_OUT), cartIn: false, paddles: spring(0), lunge: spring(0), clipDrop: spring(0), clipOrigin: { x: 506, y: 320 }, clipAngle: -.25,
    shocks: 0, clearAge: 9, zapAge: 9, clearPop: spring(0),
    wifeX: spring(WIFE_OUT), wifeIn: false, wifeMood: 'papers', moodAge: 9,
    events: { hi: false, curtain: false, watch: false, roommate: false, wheel: false, wife: false, wifeLeave: false, walk: false, cart: false, clear: false, zap: false, tod: false, shrug: false },
  };
}

export function resetWard(w: Ward): void {
  settleSpring(w.lean, 0); settleSpring(w.twitch, 0); settleSpring(w.pupil, 0); settleSpring(w.typing, 0); settleSpring(w.eyeOpen, 1);
  settleSpring(w.level, 1); w.refill = 0; w.label = 'HOPIUM'; settleSpring(w.swap, 0); w.drops = []; w.nextDrop = 0;
  settleSpring(w.doctorLean, 0); settleSpring(w.doctorPen, 0); w.noteIndex = -1; settleSpring(w.wilt, 0); w.petals = [];
  settleSpring(w.curtain, 0); settleSpring(w.roommateGone, 0); w.roommateFlat = false;
  w.hiAge = w.watchAge = w.roomAge = -1; w.curtainDrawn = w.wheeled = false; settleSpring(w.watch, 0);
  w.patient = { mode: 'bed', x: 300, modeAge: 0, suit: spring(0), balloon: spring(0) };
  w.dead = w.dodged = false; settleSpring(w.shrug, 0); w.deadAge = 0; settleSpring(w.sheet, 0); w.deathX100 = 100; settleSpring(w.shock, 0); w.lights = 0;
  settleSpring(w.cartX, CART_OUT); w.cartIn = false; settleSpring(w.paddles, 0); settleSpring(w.lunge, 0); settleSpring(w.clipDrop, 0);
  w.shocks = 0; w.clearAge = 9; w.zapAge = 9; settleSpring(w.clearPop, 0);
  settleSpring(w.wifeX, WIFE_OUT); w.wifeIn = false; w.wifeMood = 'papers'; w.moodAge = 9;
}

/** The flowers start to droop past 1.33× and are spent by 8×. */
const wiltAt = (tension: number): number => clamp((tension - 0.25) * 1.6, 0, 1);

/** Jumps the ward to where a running round already is, for a round met late (a reconnect mid-round): the beats it missed are spent. */
export function settleWard(w: Ward, multiplier: number, doses: number): void {
  const t = tensionAt(multiplier);
  settleSpring(w.lean, 0.3 + 0.7 * t); settleSpring(w.pupil, t); settleSpring(w.typing, 1); settleSpring(w.doctorLean, 0.5 * t);
  settleSpring(w.level, 1 - t * 0.95);
  settleSpring(w.wilt, wiltAt(t));
  w.noteIndex = doses - 1;
  if (multiplier >= BEAT.hi) w.hiAge = 9;
  if (multiplier >= BEAT.watch) w.watchAge = 9;
  w.curtainDrawn = multiplier >= BEAT.curtain;
  if (multiplier >= BEAT.flat) { w.roommateFlat = true; w.roomAge = 9; }
  w.wheeled = multiplier >= BEAT.wheel;
  settleSpring(w.curtain, w.curtainDrawn && !w.wheeled ? CURTAIN_HALF : 0); settleSpring(w.roommateGone, w.wheeled ? 1 : 0);
  if (doses >= 4) { w.label = 'COPIUM'; settleSpring(w.swap, 0); }
  if (multiplier >= BEAT.cart) { w.cartIn = true; settleSpring(w.cartX, CART_IN); }
  if (multiplier >= BEAT.wife) { w.wifeIn = true; settleSpring(w.wifeX, WIFE_X); }
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
  w.clipOrigin = doctorPoint(w, { x: -14, y: -150 });
  w.clipAngle = -.25 + doctorFrame(w).angle;
  w.dead = true;
  // Discharged before the rug: nobody in the bed to shock.
  w.dodged = w.patient.mode !== 'bed';
  w.deathX100 = crashX100;
  w.deadAge = quiet ? 10 : 0;
  w.label = 'RUGGED';
  const rng = mulberry32(crashX100);
  w.lights = 0.3 + rng() * 0.4;
  if (quiet) {
    settleSpring(w.level, 0); settleSpring(w.wilt, 1);
    if (w.dodged) { settleSpring(w.shrug, 0.25); return; }
    settleSpring(w.sheet, 1); settleSpring(w.doctorLean, 1);
    settleSpring(w.lean, 0); settleSpring(w.typing, 0); settleSpring(w.pupil, 1); settleSpring(w.eyeOpen, 0.05);
    // The resuscitation already happened: the cart is by the bed, the paddles are down, the clipboard is on the floor.
    w.cartIn = true; settleSpring(w.cartX, CART_IN); settleSpring(w.clipDrop, 1); w.shocks = SHOCKS.length;
    if (w.wifeIn) w.wifeMood = 'signed';
    return;
  }
  if (w.dodged) return;
  w.shock.v += 8;
  w.twitch.v += 20;
}

/** How far the drip, the sheet and the laptop lid have come off: 0 in bed, 1 once he is up. */
export function unplugged(w: Ward): number {
  const p = w.patient;
  return p.mode === 'bed' ? 0 : p.mode === 'unplugging' ? smoothstep(0.05, 0.75, p.modeAge) : 1;
}

/** The patient's breathing from the integrated heave phase: stilled by death, faded out as he gets up. */
const breath = (w: Ward): number => (w.dead && !w.dodged ? 0 : Math.sin(w.heave) * (1 - unplugged(w)));

/** How far into his stride the patient is on the way out: 0 standing, 1 at full walking speed after 0.35 s. */
const pace = (p: Ward['patient']): number => (p.mode === 'walking' ? smoothstep(0, 0.35, p.modeAge) : 0);

/** Walks a body toward `target` at up to `top` px/s, ramping speed in and out with `accel` so the feet keep up. */
function walkTo(s: Spring, target: number, top: number, accel: number, dt: number): void {
  const gap = target - s.x;
  const want = Math.sign(gap) * Math.min(top, Math.sqrt(2 * accel * Math.abs(gap)));
  s.v += clamp(want - s.v, -accel * dt, accel * dt);
  s.x += s.v * dt;
  if (Math.abs(target - s.x) < 0.5 && Math.abs(s.v) < 8) settleSpring(s, target);
}

export interface WardDrive { running: boolean; tension: number; multiplier: number; reduced: boolean }

export function stepWard(w: Ward, drive: WardDrive, dt: number): void {
  const e = w.events;
  for (const key in e) e[key as keyof WardEvents] = false;
  const previousTime = w.time;
  w.time += dt;
  const t = drive.tension;
  const x = drive.multiplier;
  const alive = !w.dead && w.patient.mode === 'bed';
  const dead = w.dead && !w.dodged;
  w.heave += dt * (3.2 + 9 * t);
  w.keys += dt * (12 + 10 * t);
  w.tapPhase += dt * (10 + 14 * t);
  stepSpring(w.lean, alive && drive.running ? 0.3 + 0.7 * t : 0, 6, 0.6, dt);
  stepSpring(w.twitch, 0, 14, 0.25, dt);
  stepSpring(w.pupil, alive && drive.running ? t : dead ? 1 : 0, 4, 0.9, dt);
  stepSpring(w.typing, alive && drive.running ? 1 : 0, 8, 0.8, dt);
  const blinking = w.time > w.blinkAt && w.time < w.blinkAt + 0.12;
  if (w.time >= w.blinkAt + 0.12) w.blinkAt = w.time + 1.5 + 3 * noise(w.blinkAt) * (1 - 0.6 * t);
  stepSpring(w.eyeOpen, dead ? 0.05 : blinking ? 0.1 : 1 + 0.4 * t, 24, 0.9, dt);
  if (drive.running && alive) w.refill = Math.max(0, w.refill - dt / 10);
  stepSpring(w.level, w.dead ? 0 : drive.running && alive ? Math.max(1 - t * 0.95, w.refill) : w.level.x, 3, 1, dt);
  stepSpring(w.swap, 0, 8, 0.5, dt);
  if (drive.running && alive && w.time > w.nextDrop) {
    w.nextDrop = w.time + mix(0.9, 0.12, t);
    w.drops.push({ y: 0, age: 0 });
  }
  for (const d of w.drops) { d.age += dt; d.y += (60 + 120 * d.age) * dt; }
  w.drops = w.drops.filter((d) => d.y < 130);
  stepSpring(w.doctorLean, dead ? 1 : drive.running ? 0.5 * t : 0, 5, 0.8, dt);
  stepSpring(w.doctorPen, 0, 10, 0.4, dt);
  stepSpring(w.wilt, drive.running || w.dead ? wiltAt(t) + (w.dead ? 1 : 0) : w.wilt.x, 2, 1, dt);
  if ((drive.running || w.dead) && !drive.reduced && w.wilt.x > .3) {
    for (let tick = Math.floor(previousTime * 6 + 1e-9) + 1; tick <= Math.floor((w.time + 1e-9) * 6); tick++) {
      if (noise(tick * 1.7) <= .85 - .3 * w.wilt.x || w.petals.length >= 24) continue;
      w.petals.push({ x: 560 + noise(tick * 9) * 30, y: 236, vx: (noise(tick * 5) - .5) * 20, vy: 10, rot: noise(tick) * 6, age: 0 });
    }
  }
  for (const p of w.petals) { p.age += dt; p.x += p.vx * dt + Math.sin(p.age * 4) * 12 * dt; p.y += (p.vy + 40 * p.age) * dt; p.rot += dt * 2; }
  w.petals = w.petals.filter((p) => p.y < 400);
  // The roommate's story, on the multiplier: wagmi, the curtain while his beat races, the flatline, the bed wheeled out.
  const go = drive.running && !w.dead;
  if (go && w.hiAge < 0 && x >= BEAT.hi) { w.hiAge = 0; e.hi = true; }
  if (go && !w.curtainDrawn && x >= BEAT.curtain) { w.curtainDrawn = true; e.curtain = true; }
  if (go && !w.roommateFlat && x >= BEAT.flat) { w.roommateFlat = true; w.roomAge = 0; e.roommate = true; }
  if (go && !w.wheeled && x >= BEAT.wheel) { w.wheeled = true; e.wheel = true; }
  // The doctor's fake-out: he checks his watch as if he were timing something.
  if (go && alive && w.watchAge < 0 && x >= BEAT.watch) { w.watchAge = 0; e.watch = true; }
  for (const key of ['hiAge', 'watchAge', 'roomAge'] as const) if (w[key] >= 0) w[key] += dt;
  stepSpring(w.watch, w.watchAge >= 0 && w.watchAge < 1.4 && !w.dead ? 1 : 0, 10, 0.7, dt);
  if (!w.roommateFlat) w.roomPhase += dt * (w.curtainDrawn ? mix(1.4, 3.2, clamp((x - BEAT.curtain) / (BEAT.flat - BEAT.curtain), 0, 1)) : 1.2);
  stepSpring(w.curtain, w.curtainDrawn && !w.wheeled ? CURTAIN_HALF : 0, 3, 0.9, dt);
  // His bed rolls out once the curtain is back, so the wheel-out is seen.
  stepSpring(w.roommateGone, w.wheeled && w.curtain.x < 0.25 ? 1 : 0, 2.2, 1, dt);
  const p = w.patient;
  p.modeAge += dt;
  if (p.mode === 'unplugging' && p.modeAge > 0.8) { p.mode = 'dressing'; p.modeAge = 0; }
  if (p.mode === 'dressing' && p.modeAge > 0.9) { p.mode = 'walking'; p.modeAge = 0; }
  // The walk out ramps up to speed; the feet follow the distance, so they never skate.
  if (p.mode === 'walking') { p.x += 150 * pace(p) * dt; if (p.x > WARD.w + 80) { p.mode = 'gone'; p.modeAge = 0; e.walk = true; } }
  stepSpring(p.suit, p.mode === 'dressing' || p.mode === 'walking' || p.mode === 'gone' ? 1 : 0, 10, 0.5, dt);
  stepSpring(p.balloon, p.mode === 'walking' || p.mode === 'gone' ? 1 : 0, 6, 0.6, dt);
  // The crash cart rolls in past 2.8× "just in case", or rushes in with the crash if it is not there yet, so it is
  // by the bed as the paddles come up; it overshoots and settles.
  if (!w.cartIn && ((go && alive && x >= BEAT.cart) || dead)) { w.cartIn = true; e.cart = true; }
  stepSpring(w.cartX, w.cartIn ? CART_IN : CART_OUT, dead ? 10 : 5, 0.55, dt);
  // The wife walks in past 3.5× with the papers, signs them at the death, and lets it go if he walks out.
  if (!w.wifeIn && go && alive && x >= BEAT.wife) { w.wifeIn = true; e.wife = true; w.moodAge = 0; }
  w.moodAge += dt;
  const walkedOut = p.mode === 'dressing' || p.mode === 'walking' || p.mode === 'gone';
  if (w.wifeIn && walkedOut && w.wifeMood === 'papers') { w.wifeMood = 'nvm'; w.moodAge = 0; e.wifeLeave = true; }
  const wifeHere = w.wifeIn && !(w.wifeMood === 'nvm' && w.moodAge > 1.3);
  walkTo(w.wifeX, wifeHere ? WIFE_X : WIFE_OUT, 110, 360, dt);
  w.clearAge += dt;
  w.zapAge += dt;
  if (w.dead) {
    const was = w.deadAge;
    w.deadAge += dt;
    const crossed = (at: number): boolean => was <= at && w.deadAge > at;
    if (w.dodged) {
      // Discharged against medical advice: the doctor shrugs at the empty bed.
      if (crossed(0.1)) e.shrug = true;
      stepSpring(w.shrug, w.deadAge > 0.1 ? (w.deadAge < 1.7 ? 1 : 0.25) : 0, 9, 0.45, dt);
    } else {
      // The resuscitation: the paddles come up, CLEAR, a shock, CLEAR, a shock, then the sheet and the time of death.
      for (const at of SHOCKS) {
        if (crossed(at - CLEAR_LEAD)) { w.clearAge = 0; w.clearPop.v = 12; e.clear = true; }
        if (crossed(at)) { w.shocks += 1; w.zapAge = 0; w.twitch.v += 26; w.lean.v += 9; w.eyeOpen.v += 20; e.zap = true; }
      }
      if (crossed(TOD_AT)) e.tod = true;
      if (w.wifeIn && crossed(0.3)) { w.wifeMood = 'signed'; w.moodAge = 0; }
    }
    const working = !w.dodged && w.deadAge > 0.04 && w.deadAge < PADDLES_DOWN;
    stepSpring(w.paddles, working ? 1 : 0, 11, 0.6, dt);
    stepSpring(w.lunge, working && w.deadAge > 0.14 ? 1 : 0, 12, 0.6, dt);
    stepSpring(w.clipDrop, w.dodged ? 0 : 1, 7, 1, dt);
    stepSpring(w.sheet, !w.dodged && w.deadAge > SHEET_AT ? 1 : 0, 7, 0.9, dt);
    stepSpring(w.shock, !w.dodged && w.deadAge < PADDLES_DOWN ? 1 : 0, 8, 0.8, dt);
  } else {
    stepSpring(w.paddles, 0, 9, 0.6, dt);
    stepSpring(w.lunge, 0, 7, 0.55, dt);
    stepSpring(w.clipDrop, 0, 6, 1, dt);
    stepSpring(w.shrug, 0, 9, 0.8, dt);
  }
  stepSpring(w.clearPop, 0, 12, 0.4, dt);
}

/**
 * Two-bone joint. Longer bones than the reach make the knee or elbow stick out; `side` picks the direction, and a
 * fraction of it foreshortens the bend, as a knee turned toward the viewer.
 */
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
function drawDrip(ctx: CanvasRenderingContext2D, w: Ward): void {
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
  // Line follows the cannula elbow and sags between drips; pulled out, it drops and hangs off the stand.
  const arm = cannula(w);
  const off = unplugged(w);
  const hang = { x: 176, y: 404 };
  const elbow = arm ? { x: mix(arm.elbow.x, hang.x, off), y: mix(arm.elbow.y, hang.y, off) } : hang;
  const hand = arm ? { x: mix(arm.hand.x, hang.x + 8, off), y: mix(arm.hand.y, hang.y + 24, off) } : { x: hang.x + 8, y: hang.y + 24 };
  const sag = Math.sin(w.time * 2.4) * 7;
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, 280); ctx.quadraticCurveTo((x + elbow.x) / 2, (280 + elbow.y) / 2 + 26 + sag, elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}

/** The cannula arm in ward space, matching the bed pose so the drip can meet the elbow. */
function cannula(w: Ward): { elbow: Point; hand: Point } | null {
  const p = w.patient;
  if (p.mode !== 'bed' && p.mode !== 'unplugging') return null;
  const lean = clamp(w.lean.x, 0, 1.2);
  const twitch = clamp(w.twitch.x, -1, 1.5);
  const heave = breath(w);
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
  const tod = w.dead && !w.dodged && w.deadAge > TOD_AT;
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
  // She walks in and out on her own feet (the stride follows her position, so a planted foot never skates), then taps one.
  const tap = w.wifeMood === 'papers' ? Math.max(0, Math.sin(w.time * 7)) * 5 * (1 - smoothstep(0, 30, Math.abs(w.wifeX.v))) : 0;
  for (const side of [-1, 1]) {
    const step = walkingFoot(x - WIFE_OUT, WIFE_STRIDE, side > 0 ? .5 : 0, 10);
    const foot = { x: side * 11 + step.x, y: step.y - (side > 0 ? tap : 0) };
    limb(ctx, { x: side * 9, y: -80 }, foot, 41, 40, -side, 12, skin);
    ctx.fillStyle = '#5a1e5a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 3, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
  // She says it once she is through the door (about 1.2 s into her walk), not while she is still off screen.
  if (w.wifeMood === 'nvm' ? w.moodAge < 1.6 : w.wifeMood === 'papers' && w.wifeIn && w.moodAge > 1.2 && w.moodAge < 3.2) {
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

/** A white speech bubble centred on (x, y), its tail toward (tx, ty); the caller writes the text. */
function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, tx: number, ty: number): void {
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  const bx = clamp(tx, x - width / 2 + 10, x + width / 2 - 16);
  const by = ty > y ? y + height / 2 : y - height / 2;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + 12, by); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(x - width / 2, y - height / 2, width, height, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + 1.5, by); ctx.lineTo(bx + 10.5, by); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
}

/**
 * The doctor's frame: his hips at (x, y), the torso leaning by `angle` about them, the idle sway. The lunge
 * drops and leans the body over a planted back foot instead of sliding the whole rig.
 */
function doctorFrame(w: Ward): { x: number; y: number; angle: number; sway: number } {
  const lunge = clamp(w.lunge.x, 0, 1.1);
  return { x: 520 - 36 * lunge, y: 380 + 12 * lunge, angle: -.12 * clamp(w.doctorLean.x, 0, 1) - .26 * lunge, sway: Math.sin(w.time * 1.3) * 2 };
}

/** Maps rig points (feet at the origin) into ward coordinates exactly once; never reads the device transform. */
export function doctorPoint(w: Ward, point: Point, inverse = false): Point {
  const f = doctorFrame(w), c = Math.cos(f.angle), s = Math.sin(f.angle);
  if (inverse) { const dx = point.x - f.x, dy = point.y - f.y; return { x: c * dx + s * dy - f.sway, y: -s * dx + c * dy - 90 }; }
  const px = point.x + f.sway, py = point.y + 90;
  return { x: f.x + c * px - s * py, y: f.y + s * px + c * py };
}

/** The doctor at the foot of the bed with the clipboard, or lunging at the laptop with the paddles. Returns the paddles' positions when they are up. */
function drawDoctor(ctx: CanvasRenderingContext2D, w: Ward): Point[] {
  const lean = clamp(w.doctorLean.x, 0, 1);
  const pen = clamp(w.doctorPen.x, -1, 1);
  const up = clamp(w.paddles.x, 0, 1.1);
  const step = clamp(w.lunge.x, 0, 1);
  const watch = clamp(w.watch.x, 0, 1.1);
  const shrug = clamp(w.shrug.x, 0, 1.2);
  const charged = up > 0.6;
  const paddles: Point[] = [];
  ctx.save();
  ctx.lineJoin = 'round';
  // Legs in ward space: the back foot stays planted through the lunge while the front foot steps in, so neither skates.
  for (const side of [-1, 1]) {
    const foot = side > 0 ? { x: 534, y: 468 } : { x: 504 - 44 * step, y: 468 - 12 * Math.sin(Math.PI * step) };
    limb(ctx, doctorPoint(w, { x: side * 12, y: -90 }), foot, 46, 45, -side, 14, '#3d5f8f');
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(foot.x - 2, foot.y + 3, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  const frame = doctorFrame(w);
  ctx.translate(frame.x, frame.y);
  ctx.rotate(frame.angle);
  ctx.translate(frame.sway, 90);
  // The coat hem shifts as he leans in to write.
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
  // Arms: on the clipboard, the right wrist up in front of him for the watch, out in a shrug, or out to the laptop with the paddles.
  const shoulder = -205 - 7 * shrug;
  const write = { x: mix(mix(20 + pen * 3, -10, watch), 60, shrug), y: mix(mix(-150, -198, watch), -150, shrug) };
  const leftHand = { x: mix(-46 - 8 * shrug, -74, up), y: mix(-150 + 4 * shrug, -170, up) };
  const rightHand = { x: mix(write.x, -20, up), y: mix(write.y, -176, up) };
  limb(ctx, { x: -40, y: shoulder }, leftHand, 36, 34, 1, 14, '#f4f7fb');
  const elbow = limb(ctx, { x: 40, y: shoulder }, rightHand, 36, 34, -1, 14, '#f4f7fb');
  if (w.clipDrop.x < 0.02) drawClipboard(ctx, w, leftHand.x + 32, leftHand.y, -0.25 - 0.3 * shrug);
  if (up > 0.05) {
    for (const hand of [leftHand, rightHand]) {
      drawPaddle(ctx, hand.x, hand.y, up, charged);
      paddles.push(doctorPoint(w, hand));
    }
  }
  // Hands (the pen only while he is writing), and the watch on the right wrist.
  ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(rightHand.x, rightHand.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (up > 0.05 || shrug > 0.05) { ctx.beginPath(); ctx.arc(leftHand.x, leftHand.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  if (up < 0.5) {
    const k = 13 / Math.max(1, Math.hypot(elbow.x - rightHand.x, elbow.y - rightHand.y));
    ctx.fillStyle = '#ffe27a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(rightHand.x + (elbow.x - rightHand.x) * k, rightHand.y + (elbow.y - rightHand.y) * k, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  if (up < 0.3 && watch < 0.3 && shrug < 0.3) {
    ctx.strokeStyle = '#2b2b30'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(18 + pen * 3, -156); ctx.lineTo(4 + pen * 6, -170); ctx.stroke();
  }
  // Head.
  const hy = -246;
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 24, 27, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6b6b70';
  ctx.beginPath(); ctx.moveTo(-25, hy - 6); ctx.quadraticCurveTo(-20, hy - 34, 0, hy - 32); ctx.quadraticCurveTo(22, hy - 34, 25, hy - 6); ctx.quadraticCurveTo(0, hy - 18, -25, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Glasses (eyes down to the watch) and a mouth that flattens with the lean; brows up for the shrug.
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.strokeRect(-18, hy - 6, 14, 10); ctx.strokeRect(4, hy - 6, 14, 10);
  ctx.beginPath(); ctx.moveTo(-4, hy - 1); ctx.lineTo(4, hy - 1); ctx.stroke();
  if (shrug > 0.05) { ctx.beginPath(); ctx.moveTo(-17, hy - 10 - 5 * shrug); ctx.lineTo(-6, hy - 12 - 6 * shrug); ctx.moveTo(6, hy - 12 - 6 * shrug); ctx.lineTo(17, hy - 10 - 5 * shrug); ctx.stroke(); }
  ctx.fillStyle = INK;
  const look = 2 * clamp(watch, 0, 1);
  ctx.beginPath(); ctx.arc(-11 - look, hy - 1 + look, 2, 0, Math.PI * 2); ctx.arc(11 - look, hy - 1 + look, 2, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (up > 0.5) { ctx.ellipse(0, hy + 16, 5, 6 + 3 * clamp(w.clearPop.x, 0, 1), 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (shrug > 0.3) { ctx.moveTo(-8, hy + 15); ctx.quadraticCurveTo(-3, hy + 11, 0, hy + 15); ctx.quadraticCurveTo(3, hy + 19, 8, hy + 14); }
  else { ctx.moveTo(-8, hy + 14); ctx.quadraticCurveTo(0, hy + 14 - 6 * lean, 8, hy + 14); }
  ctx.stroke();
  if (w.watchAge > 0.3 && w.watchAge < 1.5 && !w.dead) {
    bubble(ctx, -66, hy - 46, 84, 26, -18, hy - 20);
    ctx.font = '700 12px system-ui, sans-serif'; ctx.fillText('not yet...', -66, hy - 42);
  }
  if (w.dead && w.dodged && w.deadAge > 0.25) {
    bubble(ctx, -96, hy - 30, 150, 50, -24, hy - 8);
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText('discharged against', -96, hy - 38); ctx.fillText('medical advice', -96, hy - 26);
    ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.fillStyle = '#2e8b57'; ctx.fillText('(paper hands)', -96, hy - 13);
  } else if (w.dead && w.deadAge > TOD_AT) {
    bubble(ctx, -70, hy - 50, 144, 40, -22, hy - 20);
    ctx.font = '700 11px system-ui, sans-serif'; ctx.fillText('time of death', -70, hy - 56);
    ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.fillStyle = '#e63946';
    ctx.fillText(`${(w.deathX100 / 100).toFixed(2)}×`, -70, hy - 39);
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
  // Behind the curtain the sheet goes over him once he flatlines; it is wheeled out that way.
  if (w.roomAge > 0.6) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(52, 186); ctx.quadraticCurveTo(110, 150, 178, 186); ctx.closePath(); ctx.fill(); ctx.stroke(); }
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
  // Small monitor over the roommate that reads a beat, races amber behind the curtain, then goes flat.
  ctx.fillStyle = '#0d1418'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(196, 140, 52, 30, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = w.roommateFlat ? '#ff4d6d' : w.curtainDrawn ? '#ffe27a' : '#7cf67c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(200, 156);
  for (let i = 0; i <= 44; i += 1) { const ph = (w.roomPhase + i / 44) % 1; const spike = w.roommateFlat ? 0 : ph > 0.45 && ph < 0.55 ? Math.sin((ph - 0.45) * Math.PI * 10) * 8 : 0; ctx.lineTo(200 + i, 156 - spike); }
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
  // What he says before the curtain, and what his monitor says after it.
  if (w.hiAge >= 0 && w.hiAge < 2.6 && w.curtain.x < 0.25 && !w.dead) { bubble(ctx, 66, 136, 76, 22, 70, 165); ctx.font = '700 11px system-ui, sans-serif'; ctx.fillText('wagmi bro', 66, 140); }
  if (w.roomAge >= 0 && w.roomAge < 1.8) { bubble(ctx, 222, 98, 78, 22, 222, 138); ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.fillStyle = '#e63946'; ctx.fillText('BEEEEEEP', 222, 103); }
}

/** The sheet over his legs, folded back toward the foot of the bed by `off`. */
function drawSheet(ctx: CanvasRenderingContext2D, off: number): void {
  const k = 1 - 0.78 * off, fx = (x: number): number => 180 - (180 - x) * k;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(fx(-30), 0); ctx.quadraticCurveTo(fx(60), -40 + 12 * off, 180, -10 - 4 * off); ctx.lineTo(180, 20); ctx.lineTo(fx(-30), 20); ctx.closePath(); ctx.fill(); ctx.stroke();
}

/** The laptop on its base, the lid open by `open` (1 open, near 0 shut) about the hinge, the chart on the screen. */
function drawLaptop(ctx: CanvasRenderingContext2D, w: Ward, tension: number, open: number): void {
  const dead = w.dead && !w.dodged;
  ctx.fillStyle = '#3a3f4a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-40, -4, 80, 10, 3); ctx.fill(); ctx.stroke();
  const typingNow = clamp(w.typing.x, 0, 1) * (dead ? 0 : 1);
  ctx.fillStyle = '#23272e';
  for (let i = 0; i < 7; i += 1) {
    const down = typingNow > 0.2 && Math.sin(w.keys + i * 1.7) > 0.55 ? 1.6 : 0;
    ctx.fillRect(-32 + i * 9, -2 + down, 6, 2);
  }
  const h = 62 * open;
  ctx.save(); ctx.rotate(-0.2 * open);
  ctx.beginPath(); ctx.roundRect(-38, -4 - h, 76, h, Math.min(3, h / 2)); ctx.fill(); ctx.stroke();
  if (open > 0.15 && !(dead && w.sheet.x > 0.5)) {
    // The screen squashes with the lid as it shuts.
    ctx.translate(0, -4); ctx.scale(1, open); ctx.translate(0, 4);
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
}

/**
 * His legs from the hips: stretched along the mattress with the knees a little up, under the sheet (`stand` 0),
 * then swung down to stand and walk. Both knees point up in bed; the left one turns out as he stands, through
 * facing us (its bend shrinks to nothing and grows on the other side), so it never flips through the mattress.
 */
function legs(ctx: CanvasRenderingContext2D, w: Ward, stand: number, suit: number): void {
  const p = w.patient;
  const trouser = suit > 0.5 ? '#2b2b30' : '#bfe0ec';
  for (const side of [-1, 1]) {
    const step = p.mode === 'walking' ? walkingFoot(p.x - 300, 74, side > 0 ? .5 : 0, 16) : { x: 0, y: 0 };
    const foot = { x: mix(106 + side * 10, side * 12, stand) + step.x, y: mix(14, 0, stand) + step.y };
    limb(ctx, { x: side * 10, y: -96 + 86 * (1 - stand) }, foot, 57, 54, side > 0 ? -1 : mix(-1, 1, stand), 15, trouser);
    ctx.fillStyle = suit > 0.5 ? '#111114' : '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 3, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

/** The patient in bed with the laptop, or dressing, or walking out. */
function drawPatient(ctx: CanvasRenderingContext2D, w: Ward, tension: number): void {
  const p = w.patient;
  if (p.mode === 'gone') return;
  const inBed = p.mode === 'bed' || p.mode === 'unplugging';
  const stand = inBed ? 0 : p.mode === 'dressing' ? smoothstep(0, .9, p.modeAge) : 1;
  const unfold = 86 * (1 - stand);
  const suit = clamp(p.suit.x, 0, 1);
  const lean = clamp(w.lean.x, 0, 1.2);
  const twitch = clamp(w.twitch.x, -1, 1.5);
  const shock = clamp(w.shock.x, 0, 1);
  const dead = w.dead && !w.dodged;
  ctx.save();
  if (inBed) ctx.translate(300, 380 - lean * 8 + twitch * 3);
  else ctx.translate(p.x, mix(380 - lean * 8 + twitch * 3, 470, stand));
  ctx.lineJoin = 'round';
  const gown = suit > 0.5 ? '#2b2b30' : '#bfe0ec';
  const skin = '#f3dccb';
  const off = unplugged(w);
  if (inBed) {
    // Legs under the sheet: a lump, folded back toward the foot of the bed as he unplugs, showing the legs he stands on.
    if (off > 0) legs(ctx, w, 0, suit);
    drawSheet(ctx, off);
    // Torso, leaning toward the laptop.
    ctx.save();
    ctx.rotate(0.18 * lean);
    const heave = breath(w);
    ctx.scale(1 + 0.015 * heave, 1 + 0.04 * heave);
    ctx.fillStyle = gown;
    ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-50, -100, -20, -118); ctx.lineTo(24, -118); ctx.quadraticCurveTo(52, -100, 48, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(28,31,38,0.15)';
    for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.arc(-24 + i * 16, -60 + (i % 2) * 20, 3, 0, Math.PI * 2); ctx.fill(); }
    // Laptop on the lap; he shuts the lid as he unplugs.
    ctx.save();
    ctx.translate(70, -12);
    drawLaptop(ctx, w, tension, 1 - 0.92 * off);
    ctx.restore();
    // Arms: one typing on the laptop, one with the line in it.
    const type = clamp(w.typing.x, 0, 1) * (dead ? 0 : 1);
    const tap = Math.sin(w.tapPhase) * 4 * type;
    const tapHand = { x: 74, y: -30 + tap };
    limb(ctx, { x: 22, y: -96 }, tapHand, 50, 46, -1, 15, gown);
    const ivHand = { x: -64, y: -24 };
    const ivElbow = limb(ctx, { x: -22, y: -96 }, ivHand, 50, 46, 1, 15, gown);
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
    legs(ctx, w, stand, suit);
    ctx.save(); ctx.translate(0, unfold);
    // The hem sways where he stands and swings once a step on the way out, blended over the walk's ramp.
    const gait = pace(p);
    const hem = Math.sin(w.time * 2.2) * 2 * (1 - gait) + Math.sin((p.x - 300) * 0.17) * 8 * gait;
    ctx.fillStyle = gown; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-44, -100); ctx.quadraticCurveTo(-48, -190, -18, -208); ctx.lineTo(18, -208); ctx.quadraticCurveTo(48, -190, 44, -100);
    ctx.quadraticCurveTo(16, -78 + hem, 0, -88 - hem); ctx.quadraticCurveTo(-16, -78 - hem, -44, -100);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (suit > 0.5) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-14, -206); ctx.lineTo(0, -150); ctx.lineTo(14, -206); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(-5, -204); ctx.lineTo(5, -204); ctx.lineTo(3, -150); ctx.lineTo(-3, -150); ctx.closePath(); ctx.fill(); }
    const offHand = { x: -52 + Math.sin(w.time * 2) * 4, y: -108 };
    limb(ctx, { x: -28, y: -176 }, offHand, 46, 42, 1, 15, gown);
    const balloon = clamp(p.balloon.x, 0, 1);
    const stringY = -230 * balloon - 110 * (1 - balloon) + Math.sin(w.time * 3) * 8 * balloon;
    // The elbow stays below the shoulder-to-hand line as the hand rises past the shoulder, so it never flips.
    limb(ctx, { x: 28, y: -176 }, { x: 60, y: stringY }, 46, 42, 1, 15, gown);
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
  if (!inBed) ctx.restore();
  // Head: big pupils that grow with the hopium, sunken with the death.
  const hy = mix(-150 - lean * 6, -236, stand);
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
  const off = unplugged(w);
  // The bed.
  ctx.fillStyle = '#c7d3dd'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(220, 390, 290, 70, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a5560';
  ctx.beginPath(); ctx.roundRect(214, 300, 16, 160, 4); ctx.fill(); ctx.stroke();
  for (const wx of [240, 494]) { ctx.beginPath(); ctx.arc(wx, 466, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(232, 330, 60, 40, 8); ctx.fill(); ctx.stroke();
  // Once he is up, the folded sheet and the shut laptop stay on the bed behind him.
  if (off >= 1) {
    ctx.save(); ctx.translate(300, 380); drawSheet(ctx, 1); ctx.translate(70, -12); drawLaptop(ctx, w, tension, 0.08); ctx.restore();
  }
  // Up and walking, he passes in front of the doctor on his way out.
  const out = w.patient.mode === 'walking' || w.patient.mode === 'gone';
  if (!out) drawPatient(ctx, w, tension);
  // Blanket over the legs, drawn after the patient, folded to the foot of the bed as he gets up.
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  const fold = 1 - 0.8 * off, bx = (x: number): number => 508 - (508 - x) * fold;
  ctx.beginPath(); ctx.moveTo(bx(330), 372 + 4 * off); ctx.quadraticCurveTo(bx(400), 350 + 8 * off, 508, 376); ctx.lineTo(508, 392); ctx.lineTo(bx(330), 392); ctx.closePath(); ctx.fill(); ctx.stroke();
  // The sheet over the laptop at the end.
  const sheet = clamp(w.sheet.x, 0, 1);
  if (sheet > 0.02) {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(320, 400); ctx.quadraticCurveTo(330, 330 - 40 * sheet, 372, 316 - 30 * sheet); ctx.quadraticCurveTo(410, 300 - 40 * sheet, 430, 340 - 20 * sheet); ctx.lineTo(440, 400); ctx.closePath();
    ctx.globalAlpha = sheet; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawDrip(ctx, w);
  const charged = w.paddles.x > 0.6;
  drawCart(ctx, w, charged);
  const paddles = drawDoctor(ctx, w);
  if (out) drawPatient(ctx, w, tension);
  // The clipboard he dropped: it falls from his hand to the floor by the bed.
  const drop = clamp(w.clipDrop.x, 0, 1);
  if (drop >= 0.02) {
    const k = smoothstep(0, 1, drop);
    drawClipboard(ctx, w, mix(w.clipOrigin.x, 440, k), mix(w.clipOrigin.y, 466, k * k), mix(w.clipAngle, -1.35, k));
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
  // Each CLEAR! holds through its shock and is gone before the next one, so the two read as two shouts.
  if (w.clearAge < 0.36 && w.dead) {
    ctx.save();
    ctx.translate(540, 300); ctx.rotate(-0.08);
    const k = 1 + 0.25 * clamp(w.clearPop.x, 0, 1.2);
    ctx.scale(k, k);
    ctx.globalAlpha = w.clearAge > 0.26 ? 1 - (w.clearAge - 0.26) / 0.1 : 1;
    memeSmall(ctx, 'CLEAR!', 0, 0, 40, '#ffe27a');
    ctx.restore();
  }
  drawWife(ctx, w);
  // The lights dim once the time is called (the white of the shock is the scene's, timed in real time).
  if (w.dead && !w.dodged && w.lights > 0) { ctx.fillStyle = `rgba(10, 20, 30, ${w.lights * smoothstep(TOD_AT - 0.3, TOD_AT + 1.2, w.deadAge)})`; ctx.fillRect(0, 0, WARD.w, WARD.h); }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.strokeRect(WARD.x, WARD.y, WARD.w, WARD.h);
}
