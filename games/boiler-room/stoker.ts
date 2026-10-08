/**
 * The stoker: the player's stand-in at the firebox. He shovels coal in a
 * cycle whose pace follows the multiplier, both hands on the shovel through
 * two-bone arms, his weight shifting into each throw, the torso and head
 * trailing on springs. An accepted exit sends him behind the blast shield
 * with his goggles down; a blow-out with him still at the door slams him into
 * the shield he never got behind, and he gets up again for the next round.
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { FLOOR_Y } from './engine';

export type StokerMode = 'idle' | 'stoking' | 'running' | 'sheltered' | 'blasted' | 'floored' | 'getup';
type Point = { x: number; y: number };
/** Hands and feet relative to the hip, in the body's own (unrotated) frame. */
type Limbs = { back: Point; front: Point; footL: Point; footR: Point };

/** Where the blast shield stands; he crouches behind it. */
export const SHIELD = { x: 84, top: 326, width: 58 };
/** Where a blow-out leaves him: slammed into the shield's face and slumped at its foot, the X eyes in view. */
export const SLUMP = { x: 128, y: FLOOR_Y - 24, angle: -0.32 };
const HOME_X = 176;
const HIP_Y = 380;
/** Seconds to get up and collect the shovel when the next round's betting opens. */
const GETUP = 0.8;
/** How far into the get-up he is bent over the shovel: down and back up within its first 0.72 s. */
const stoop = (age: number): number => Math.sin(Math.PI * clamp(age / (GETUP * 0.9), 0, 1));
/** The dropped shovel's fixed physics step, so it bounces and settles the same way at any frame rate. */
const DROP_STEP = 1 / 240;
const INK = '#1c1f26';
const SKIN = '#f3dccb';
const SKIN_SHADE = '#e0bda7';
const SHIRT = '#c9ccd1';
const TROUSERS = '#3a3f4a';
const CAP = '#6b6f78';
const MEME_FONT = 'Impact, "Arial Black", sans-serif';

/** Solves a two-bone limb with a fixed endpoint and a consistent bend direction. */
function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + dx / distance * along - dy / distance * bend, y: root.y + dy / distance * along + dx / distance * bend };
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export interface StokerDrive {
  /** Shovel cycles per second while stoking. */
  rate: number;
  fear: number;
  pressure: number;
}

export interface StokerState {
  mode: StokerMode;
  /** Round time: the elapsed time while running, so fatigue and sweat replay the same. */
  time: number;
  /** His own clock for blinks and brow wipes. It never resets, so they keep coming in every phase. */
  clock: number;
  modeAge: number;
  x: number;
  phase: number;
  lean: Spring;
  nod: Spring;
  crouch: Spring;
  goggles: Spring;
  wipe: Spring;
  wipeAt: number;
  eyeOpen: Spring;
  mouthOpen: Spring;
  mouthCurve: Spring;
  brow: Spring;
  blinkAt: number;
  fall: { x: number; y: number; vx: number; vy: number; angle: number; spin: number };
  /** Where a get-up starts: his hip, its angle, and whether he was down on the floor. */
  from?: { x: number; y: number; angle: number; lying: boolean };
  shovelDropped: boolean;
  drop?: { x: number; y: number; angle: number; vx: number; vy: number; spin: number; rest: boolean; tip: number; acc: number; floor: boolean };
  rate: number;
  fear: number;
  /** A startle from a boiler scare or the fuse, decaying from 1. */
  flinch: number;
  soot: number;
  /** Blow-out soot over the whole face, dusted off as he gets up. */
  char: number;
  /** The viewer has a stake this round: his cap says YOU. */
  you: boolean;
  /** The limbs last drawn, and the pose a new mode blends out of. */
  limbs?: Limbs;
  limbsFrom?: Limbs;
  events: { throw: boolean; slam: boolean; land: boolean };
}

export function createStoker(): StokerState {
  return {
    mode: 'idle', time: 0, clock: 0, modeAge: 0, x: HOME_X, phase: 0.95, lean: spring(0), nod: spring(0), crouch: spring(0), goggles: spring(0), wipe: spring(0), wipeAt: 3,
    eyeOpen: spring(1), mouthOpen: spring(0.05), mouthCurve: spring(0.2), brow: spring(0), blinkAt: 2.4,
    fall: { x: HOME_X, y: HIP_Y, vx: 0, vy: 0, angle: 0, spin: 0 }, shovelDropped: false, rate: 0, fear: 0, flinch: 0, soot: 0, char: 0, you: false, events: { throw: false, slam: false, land: false },
  };
}

function setMode(s: StokerState, mode: StokerMode): void {
  s.mode = mode;
  s.modeAge = 0;
  s.limbsFrom = s.limbs;
}

export function resetStoker(s: StokerState): void {
  setMode(s, 'idle');
  s.x = HOME_X;
  s.phase = 0.95;
  settleSpring(s.lean, 0);
  settleSpring(s.nod, 0);
  settleSpring(s.crouch, 0);
  settleSpring(s.goggles, 0);
  settleSpring(s.wipe, 0);
  s.shovelDropped = false;
  s.drop = s.from = s.limbs = s.limbsFrom = undefined;
  s.rate = s.flinch = s.soot = s.char = 0;
}

const slumped = () => ({ x: SLUMP.x, y: SLUMP.y, vx: 0, vy: 0, angle: SLUMP.angle, spin: 0 });

/**
 * Jumps to the state a late joiner would see: stoking with the soot the
 * pressure has given him, behind the shield once his exit was accepted, or
 * slumped by a blow-out he stayed for.
 */
export function settleStoker(s: StokerState, running: boolean, crashed: boolean, sheltered: boolean, pressure: number): void {
  resetStoker(s);
  s.soot = clamp(pressure * 0.4, 0, 1);
  if (sheltered && (running || crashed)) {
    setMode(s, 'sheltered');
    s.x = SHIELD.x;
    s.shovelDropped = true;
    settleSpring(s.crouch, 1);
    settleSpring(s.goggles, 1);
  } else if (crashed) {
    setMode(s, 'floored');
    s.fall = slumped();
    s.soot = s.char = 1;
    s.shovelDropped = true;
  } else if (running) {
    setMode(s, 'stoking');
  }
}

/** The round is running: back to work, the hands blending out of a brow wipe rather than jumping to the shovel. */
export function startStoking(s: StokerState): void {
  if (s.mode === 'idle') setMode(s, 'stoking');
}

/** The exit was accepted: drop the shovel and get behind the shield. */
export function callShield(s: StokerState): void {
  if (s.mode !== 'stoking' && s.mode !== 'idle') return;
  releaseShovel(s);
  setMode(s, 'running');
}

/** A groan from the boiler, or the fuse: he flinches. */
export function startle(s: StokerState): void {
  s.flinch = 1;
}

/** The valve blew. */
export function blastStoker(s: StokerState, quiet: boolean): void {
  if (s.mode === 'stoking' || s.mode === 'idle' || s.mode === 'getup') {
    const { hip } = bodyFrame(s);
    if (!quiet) {
      // The blast knocks the shovel out of his hands too, tumbling back the way he goes.
      const drop = releaseShovel(s);
      drop.vx -= 60; drop.vy -= 120; drop.spin += 3;
    }
    s.shovelDropped = true;
    s.soot = s.char = 1;
    if (quiet) {
      setMode(s, 'floored');
      s.fall = slumped();
    } else {
      // The soot hits him with the blast wave, a moment after the bang.
      s.char = 0;
      // Thrown back and up from where his hip is, tipping backwards on the way to the shield.
      setMode(s, 'blasted');
      s.fall = { x: hip.x, y: hip.y, vx: -350, vy: -240, angle: 0, spin: -2.5 };
    }
  } else if (s.mode === 'running') {
    // The accepted exit keeps its run trajectory through the blast.
    s.crouch.v += 3;
  } else if (s.mode === 'sheltered') {
    s.crouch.v += 6;
  }
}

/** The next round's betting: he gets up, or comes out from behind the shield, and picks the shovel back up. */
export function standUp(s: StokerState): void {
  if (s.mode === 'idle' || s.mode === 'getup') return;
  if (s.mode === 'stoking') { setMode(s, 'idle'); return; }
  const lying = s.mode === 'floored' || s.mode === 'blasted';
  s.from = lying ? { x: s.fall.x, y: s.fall.y, angle: wrap(s.fall.angle), lying } : { x: s.x, y: HIP_Y, angle: 0, lying };
  s.phase = 0.95;
  s.shovelDropped = false;
  setMode(s, 'getup');
}

/** Whether he is drawn in front of the shield: thrown into it, slumped against it, or getting up from there. */
export function inFrontOfShield(s: StokerState): boolean {
  return s.mode === 'blasted' || s.mode === 'floored' || (s.mode === 'getup' && s.from?.lying === true);
}

/** The swing of the shovel through the cycle: up to the door with a little follow-through, a beat there, and back. */
function swingOf(phase: number): number {
  return smoothstep(0.24, 0.64, phase) * (1 - smoothstep(0.72, 1, phase)) + 0.06 * Math.sin(Math.PI * clamp((phase - 0.58) / 0.18, 0, 1));
}

/** Shovel geometry through the cycle: where the blade and the grip are, the blade's tip, and whether coal is on it. */
export const SHOVEL_LENGTH = 122;
export function shovelPose(u: number): { blade: Point; grip: Point; tip: number; carrying: boolean } {
  const phase = ((u % 1) + 1) % 1;
  const swing = swingOf(phase);
  // Drive the blade into the pile along the shaft and tilt it to dig, then flick it over at the door.
  const scoop = Math.sin(Math.PI * clamp(phase / 0.24, 0, 1));
  const flick = smoothstep(0.58, 0.66, phase) * (1 - smoothstep(0.7, 0.92, phase));
  const angle = mix(2.15, 0.45, swing);
  const thrust = 12 * scoop;
  const grip = { x: 200 + 22 * swing + Math.cos(angle) * thrust, y: 340 - 24 * Math.sin(Math.min(1, swing) * Math.PI) + Math.sin(angle) * thrust };
  return { grip, blade: { x: grip.x + Math.cos(angle) * SHOVEL_LENGTH, y: grip.y + Math.sin(angle) * SHOVEL_LENGTH }, tip: 0.7 * flick - 0.3 * scoop, carrying: phase >= 0.2 && phase < 0.62 };
}

/** The body's part in the cycle: the weight shifts back to the pile and forward into the throw, with a dip and a lean back to wind it up. */
function sway(u: number): { shift: number; dip: number; lean: number } {
  const phase = ((u % 1) + 1) % 1;
  const windup = Math.sin(Math.PI * clamp((phase - 0.12) / 0.22, 0, 1));
  return { shift: mix(-7, 9, swingOf(phase)), dip: 8 * windup, lean: -0.1 * windup };
}

/** Where his hip is and how far the whole body is turned about it. */
function bodyFrame(s: StokerState): { hip: Point; angle: number } {
  const crouch = clamp(s.crouch.x, 0, 1.1);
  if (s.mode === 'floored' || s.mode === 'blasted') return { hip: { x: s.fall.x, y: s.fall.y }, angle: s.fall.angle };
  const sw = sway(s.phase);
  if (s.mode === 'getup' && s.from) {
    const k = smoothstep(0, GETUP, s.modeAge);
    // Stooping for the shovel never sinks him below where he sat.
    return { hip: { x: s.x + sw.shift * k, y: Math.min(SLUMP.y, mix(s.from.y, HIP_Y, k) + crouch * 46) }, angle: s.from.angle * (1 - smoothstep(0, GETUP * 0.85, s.modeAge)) };
  }
  // Holding the shovel he sways with it; letting go to run, the sway eases out.
  const held = s.mode === 'stoking' || s.mode === 'idle' ? 1 : s.mode === 'running' ? 1 - smoothstep(0, 0.3, s.modeAge) : 0;
  return { hip: { x: s.x + sw.shift * held, y: HIP_Y + crouch * 46 + sw.dip * held }, angle: 0 };
}

function releaseShovel(s: StokerState): NonNullable<StokerState['drop']> {
  const a = shovelPose(s.phase), b = shovelPose(s.phase + s.rate * 0.001);
  const angle = Math.atan2(a.blade.y - a.grip.y, a.blade.x - a.grip.x);
  const next = Math.atan2(b.blade.y - b.grip.y, b.blade.x - b.grip.x);
  s.drop = { x: a.grip.x, y: a.grip.y, angle, vx: (b.grip.x - a.grip.x) * 1000, vy: (b.grip.y - a.grip.y) * 1000, spin: wrap(next - angle) * 1000, rest: false, tip: a.tip, acc: 0, floor: false };
  s.shovelDropped = true;
  return s.drop;
}
/** How far a shovel lying flat tilts so the grip and the blade both rest on the floor. */
const FLAT = Math.asin(5 / SHOVEL_LENGTH);
export function droppedShovel(s: StokerState): { grip: Point; blade: Point } {
  const d = s.drop;
  const grip = d ? { x: d.x, y: d.y } : { x: 190, y: FLOOR_Y - 10 };
  const angle = d?.angle ?? -FLAT;
  return { grip, blade: { x: grip.x + Math.cos(angle) * SHOVEL_LENGTH, y: grip.y + Math.sin(angle) * SHOVEL_LENGTH } };
}
/**
 * One fixed step of the dropped shovel: it flies, then the end on the floor pivots where it lies while gravity
 * tips the rest over it, and when the other end comes down it bounces or, once slow, lies flat.
 */
function stepDrop(drop: NonNullable<StokerState['drop']>, h: number): void {
  // How far the blade's edge hangs below the grip's: the lower end is the one that meets the floor.
  const a0 = drop.angle, hang0 = Math.sin(a0) * SHOVEL_LENGTH + 5;
  drop.vy += 900 * h; drop.x += drop.vx * h; drop.y += drop.vy * h; drop.angle += drop.spin * h;
  // It turns about its balance point (toward the heavy blade) in the air and about whichever end is on the floor; the
  // grip is the shape's origin, so turning about any other point moves the grip around it.
  const pivot = !drop.floor ? 0.6 * SHOVEL_LENGTH : hang0 > 0 ? SHOVEL_LENGTH : 0;
  drop.x += (Math.cos(a0) - Math.cos(drop.angle)) * pivot;
  drop.y += (Math.sin(a0) - Math.sin(drop.angle)) * pivot;
  const hang = Math.sin(drop.angle) * SHOVEL_LENGTH + 5, penetration = drop.y + 8 + Math.max(0, hang) - (FLOOR_Y - 2);
  if (penetration <= 0) {
    if (penetration < -2) drop.floor = false;
    return;
  }
  drop.y -= penetration;
  drop.floor = true;
  // A clatter on the floor knocks most of the spin out of it.
  if (drop.vy > 60) drop.spin *= 0.4;
  drop.vy = -Math.abs(drop.vy) * 0.22; drop.vx *= Math.exp(-60 * h);
  if (hang > 0 !== hang0 > 0) {
    // The raised end has come down as well: it bounces, and once that is slow the shovel lies flat.
    const bounce = Math.abs(drop.spin) > 2;
    drop.angle = bounce ? a0 : a0 + wrap((Math.cos(a0) > 0 ? -FLAT : Math.PI + FLAT) - a0);
    drop.y = FLOOR_Y - 10 - Math.max(0, Math.sin(drop.angle) * SHOVEL_LENGTH + 5);
    if (bounce) drop.spin *= -0.3;
    else { drop.rest = true; drop.spin = drop.vx = drop.vy = 0; }
    return;
  }
  // Gravity tips it over the end on the floor; it never balances there, even straight up.
  const lean = Math.cos(drop.angle);
  drop.spin += (lean + (lean < 0 ? -0.3 : 0.3)) * (hang > 0 ? -18 : 18) * h;
  drop.spin *= Math.exp(-1.5 * h);
}
export function runFoot(distance: number, side: number): Point {
  const step = 46, p = ((distance / step + (side > 0 ? 0.5 : 0)) % 1 + 1) % 1;
  const swing = clamp((p - 0.6) / 0.4, 0, 1);
  return { x: (p - swing * swing * (3 - 2 * swing) - (side > 0 ? 0.5 : 0)) * step, y: -Math.sin(Math.PI * swing) * 16 };
}

/** Thrown by the blast: flies back, slams into the shield's face, slides down it and slumps at its foot. */
function fly(s: StokerState, dt: number): void {
  const f = s.fall;
  const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
  const turn = spring();
  for (let i = 0; i < steps && s.mode === 'blasted'; i += 1) {
    const pinned = f.x <= SLUMP.x;
    f.vy += 900 * h;
    f.x = Math.max(SLUMP.x, f.x + f.vx * h);
    f.y += f.vy * h;
    if (!pinned && f.x <= SLUMP.x) {
      // The shield takes the hit: his flight stops dead and he starts to slide.
      f.vx = 0;
      f.vy *= 0.3;
      f.spin *= 0.4;
      s.events.slam = true;
    }
    if (pinned) {
      turn.x = f.angle; turn.v = f.spin;
      stepSpring(turn, SLUMP.angle, 10.5, 0.48, h);
      f.angle = turn.x; f.spin = turn.v;
    } else f.angle += f.spin * h;
    if (f.y >= SLUMP.y) {
      f.y = SLUMP.y;
      if (f.vy > 160) { s.events.land = true; f.vy = -f.vy * 0.15; } else { f.vy = 0; setMode(s, 'floored'); }
    }
  }
}

type Mood = 'calm' | 'nervous' | 'panic' | 'shock' | 'smug' | 'dazed';
const FACES: Record<Mood, { eye: number; open: number; curve: number; brow: number }> = {
  calm: { eye: 1, open: 0.05, curve: 0.25, brow: 0 },
  nervous: { eye: 1.1, open: 0.12, curve: -0.25, brow: 0.6 },
  panic: { eye: 1.35, open: 0.55, curve: -0.55, brow: 1 },
  shock: { eye: 1.7, open: 1, curve: 0.05, brow: 1 },
  smug: { eye: 0.75, open: 0.08, curve: 0.75, brow: -0.4 },
  dazed: { eye: 0.6, open: 0.3, curve: -0.3, brow: 0.4 },
};

export function stepStoker(s: StokerState, drive: StokerDrive, dt: number): void {
  s.rate = drive.rate;
  const drop = s.drop;
  if (drop) drop.tip *= Math.exp(-dt / 0.12);
  if (drop && !drop.rest) {
    drop.acc += dt;
    while (drop.acc >= DROP_STEP - 1e-9 && !drop.rest) { drop.acc -= DROP_STEP; stepDrop(drop, DROP_STEP); }
  }
  s.time += dt;
  s.clock += dt;
  s.modeAge += dt;
  s.fear = drive.fear;
  s.flinch = Math.max(0, s.flinch - dt / 0.7);
  s.events.throw = s.events.slam = s.events.land = false;
  const u0 = s.phase - Math.floor(s.phase);
  let leanTarget = 0;
  let nodTarget = 0;
  switch (s.mode) {
    case 'stoking': {
      // Work, catch a breath, and brace against another pressure surge.
      const fatigue = s.time > 45 ? Math.pow(Math.max(0, Math.sin((s.time - 45) * Math.PI / 15)), 6) : 0;
      s.phase += drive.rate * (1 - fatigue * 0.78) * dt;
      s.wipe.v += fatigue * dt * 2;
      const u = s.phase - Math.floor(s.phase);
      if ((u0 < 0.62 && u >= 0.62) || (u < u0 && u >= 0.62)) s.events.throw = true;
      const pose = shovelPose(u);
      leanTarget = clamp((pose.blade.x - s.x) / 420, -0.3, 0.45) + sway(u).lean - 0.16 * s.flinch;
      nodTarget = leanTarget * 0.5;
      s.soot = clamp(s.soot + (drive.pressure * 0.4 - s.soot) * dt * 0.3, 0, 1);
      break;
    }
    case 'idle': {
      // Rest the phase at the top of the cycle and wipe the brow now and then.
      const rest = Math.ceil(s.phase - 1e-9) - 0.05;
      if (s.phase < rest) s.phase = Math.min(rest, s.phase + 0.8 * dt);
      if (s.clock > s.wipeAt) { s.wipe.v += 9; s.wipeAt = s.clock + 4 + noise(s.wipeAt) * 4; }
      nodTarget = Math.sin(s.clock * 1.5) * 0.04 - 0.08 * s.flinch;
      break;
    }
    case 'running': {
      const k = clamp(s.modeAge / 0.55, 0, 1);
      s.x = mix(HOME_X, SHIELD.x, k * k * (3 - 2 * k));
      leanTarget = -0.18;
      if (k >= 1) setMode(s, 'sheltered');
      break;
    }
    case 'sheltered':
      s.x = SHIELD.x;
      break;
    case 'blasted':
      s.char = Math.min(1, s.char + dt / 0.2);
      fly(s, dt);
      break;
    case 'floored': {
      const turn = { x: s.fall.angle, v: s.fall.spin };
      stepSpring(turn, SLUMP.angle, 10.5, 0.48, dt);
      s.fall.angle = turn.x; s.fall.spin = turn.v;
      nodTarget = 0.25 + Math.sin(s.clock * 1.3) * 0.05;
      break;
    }
    case 'getup': {
      if (!s.from) { setMode(s, 'idle'); break; }
      s.x = mix(s.from.x, HOME_X, smoothstep(0, GETUP, s.modeAge));
      // He stoops to the shovel on the floor, gets both hands on it, and straightens up with it.
      leanTarget = 1.2 * stoop(s.modeAge);
      s.char = Math.max(0, s.char - dt / GETUP);
      s.soot = Math.max(0, s.soot - dt / GETUP);
      if (s.modeAge >= GETUP) { setMode(s, 'idle'); s.from = s.drop = undefined; }
      break;
    }
  }
  stepSpring(s.lean, leanTarget, 14, 0.7, dt);
  stepSpring(s.nod, nodTarget, 9, 0.45, dt);
  stepSpring(s.crouch, s.mode === 'sheltered' ? 1 : s.mode === 'getup' ? 0.8 * stoop(s.modeAge) : 0, 10, 0.6, dt);
  stepSpring(s.goggles, s.mode === 'sheltered' ? 1 : 0, 12, 0.5, dt);
  stepSpring(s.wipe, 0, 3.5, 0.9, dt);
  const startled = s.flinch > 0.35 && (s.mode === 'stoking' || s.mode === 'idle');
  const mood: Mood = s.mode === 'floored' ? 'dazed' : s.mode === 'blasted' ? 'shock' : s.mode === 'sheltered' || s.mode === 'running' ? 'smug'
    : s.mode === 'getup' ? (!s.from?.lying ? 'smug' : s.modeAge < 0.45 ? 'dazed' : 'calm') : startled ? 'shock' : drive.fear > 0.62 ? 'panic' : drive.fear > 0.25 ? 'nervous' : 'calm';
  const face = FACES[mood];
  const blinking = s.clock > s.blinkAt && s.clock < s.blinkAt + 0.13;
  if (s.clock >= s.blinkAt + 0.13) s.blinkAt = s.clock + 2.2 + 2.6 * noise(s.blinkAt);
  stepSpring(s.eyeOpen, blinking && mood !== 'shock' ? 0.08 : face.eye, 26, 0.9, dt);
  stepSpring(s.mouthOpen, face.open, 14, 0.8, dt);
  stepSpring(s.mouthCurve, face.curve, 10, 0.8, dt);
  stepSpring(s.brow, face.brow, 12, 0.75, dt);
}

/** World position of the shovel blade while he holds it, for the coal he throws. */
export function bladePoint(s: StokerState): Point {
  return shovelPose(s.phase - Math.floor(s.phase)).blade;
}

export function drawShield(ctx: CanvasRenderingContext2D): void {
  const x = SHIELD.x;
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#3a3f4a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - SHIELD.width / 2, SHIELD.top, SHIELD.width, FLOOR_Y - SHIELD.top - 8, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6a6f7a';
  for (let y = SHIELD.top + 10; y < FLOOR_Y - 14; y += 16) {
    ctx.beginPath(); ctx.arc(x - SHIELD.width / 2 + 7, y, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + SHIELD.width / 2 - 7, y, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.roundRect(x - 14, SHIELD.top + 16, 28, 14, 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2;
  for (const bx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x + bx, SHIELD.top + 17); ctx.lineTo(x + bx, SHIELD.top + 29); ctx.stroke(); }
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  for (const wx of [-18, 18]) { ctx.beginPath(); ctx.arc(x + wx, FLOOR_Y - 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#e63946';
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFF', x, SHIELD.top + 52);
  ctx.fillText('SHORE', x, SHIELD.top + 63);
}

function drawShovel(ctx: CanvasRenderingContext2D, grip: Point, blade: Point, tip: number, carrying: boolean): void {
  const dx = blade.x - grip.x;
  const dy = blade.y - grip.y;
  const len = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.lineTo(blade.x - (dx / len) * 12, blade.y - (dy / len) * 12); ctx.stroke();
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#5a3d24'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.save(); ctx.translate(grip.x, grip.y); ctx.rotate(angle);
  ctx.beginPath(); ctx.roundRect(-10, -8, 12, 16, 4); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(blade.x, blade.y);
  ctx.rotate(angle + tip * 1.1);
  ctx.fillStyle = '#8f96a3'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-16, -11); ctx.lineTo(14, -13); ctx.lineTo(18, 13); ctx.lineTo(-16, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (carrying) {
    ctx.fillStyle = '#1b1b1f';
    for (const [cx, cy, r] of [[-4, -4, 6], [5, -6, 5], [1, 2, 6], [9, 1, 4]] as const) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

export function drawShovelOnFloor(ctx: CanvasRenderingContext2D, s: StokerState): void {
  const pose = droppedShovel(s);
  drawShovel(ctx, pose.grip, pose.blade, s.drop?.tip ?? 0, false);
}

/** How long a new mode takes to blend the hands and feet out of the last one's pose. */
const BLEND: Record<StokerMode, number> = { idle: 0.25, stoking: 0.2, running: 0.2, sheltered: 0.25, blasted: 0.08, floored: 0.3, getup: 0.3 };

export function drawStoker(ctx: CanvasRenderingContext2D, s: StokerState): void {
  const crouch = clamp(s.crouch.x, 0, 1.1);
  const floored = s.mode === 'floored';
  const blasted = s.mode === 'blasted';
  const lyingUp = s.mode === 'getup' && s.from?.lying === true;
  const { hip, angle } = bodyFrame(s);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // World points (the floor, the shovel, the shield) into the body's turned frame, relative to the hip.
  const rel = (p: Point): Point => ({ x: (p.x - hip.x) * cos + (p.y - hip.y) * sin, y: (p.y - hip.y) * cos - (p.x - hip.x) * sin });
  const local = (p: Point): Point => { const r = rel(p); return { x: hip.x + r.x, y: hip.y + r.y }; };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (angle !== 0) { ctx.translate(hip.x, hip.y); ctx.rotate(angle); ctx.translate(-hip.x, -hip.y); }
  const lean = s.lean.x;
  const torso = 98 - crouch * 30;
  const shoulder: Point = { x: hip.x + Math.sin(lean) * torso, y: hip.y - Math.cos(lean) * torso };
  const headRot = lean * 0.6 + s.nod.x;
  const head: Point = { x: shoulder.x + Math.sin(headRot) * 44, y: shoulder.y - Math.cos(headRot) * 44 };

  // The shovel in his hands, in world space: on its cycle, or coming up off the floor as he gets up.
  let shovel: { grip: Point; blade: Point; tip: number; carrying: boolean } | null = null;
  if (s.mode === 'stoking' || s.mode === 'idle') shovel = shovelPose(s.phase);
  else if (s.mode === 'getup') {
    const rest = shovelPose(s.phase), floor = droppedShovel(s), k = smoothstep(0.5, 0.95, s.modeAge / GETUP);
    const a0 = Math.atan2(floor.blade.y - floor.grip.y, floor.blade.x - floor.grip.x);
    const a = a0 + wrap(Math.atan2(rest.blade.y - rest.grip.y, rest.blade.x - rest.grip.x) - a0) * k;
    const grip = lerp(floor.grip, rest.grip, k);
    shovel = { grip, blade: { x: grip.x + Math.cos(a) * SHOVEL_LENGTH, y: grip.y + Math.sin(a) * SHOVEL_LENGTH }, tip: rest.tip * k, carrying: false };
  }
  // Where the hands and feet want to be in this mode, relative to the hip in the body frame.
  const stand = (x: number, lift: Point = { x: 0, y: 0 }): Point => rel({ x: x + lift.x, y: FLOOR_Y - 2 + lift.y });
  let target: Limbs;
  if (shovel) {
    let back = lerp(shovel.grip, shovel.blade, 0.12);
    if (s.mode === 'idle') back = lerp(back, { x: head.x + 8, y: head.y - 20 }, clamp(s.wipe.x, 0, 1));
    let footL = stand(s.x - 38), footR = stand(s.x + 40);
    if (s.mode === 'getup' && s.from) {
      if (s.from.lying) {
        // Draw the feet in under him from where they lay, the near one lifting as it comes.
        const k = smoothstep(0, 0.65, s.modeAge / GETUP);
        footL = rel(lerp({ x: s.from.x + 60, y: FLOOR_Y - 5 }, { x: s.x - 38, y: FLOOR_Y - 2 - 12 * Math.sin(Math.PI * k) }, k));
        footR = rel(lerp({ x: s.from.x + 88, y: FLOOR_Y - 7 }, { x: s.x + 40, y: FLOOR_Y - 2 }, k));
      } else {
        // Walking back from the shield: feet planted by the distance covered, mirrored for the walk to the right.
        const d = Math.abs(s.x - s.from.x), l = runFoot(d, -1), r = runFoot(d, 1);
        footL = stand(s.x - 38, { x: -l.x, y: l.y }); footR = stand(s.x + 40, { x: -r.x, y: r.y });
      }
    }
    target = { back: rel(back), front: rel(lerp(shovel.grip, shovel.blade, 0.4)), footL, footR };
  } else if (s.mode === 'running') {
    const l = runFoot(HOME_X - s.x, -1), r = runFoot(HOME_X - s.x, 1);
    target = { back: { x: -30, y: -64 }, front: { x: 46, y: -54 }, footL: stand(s.x - 38, l), footR: stand(s.x + 40, r) };
  } else if (s.mode === 'sheltered') {
    target = { back: rel({ x: SHIELD.x - 12, y: SHIELD.top + 2 }), front: rel({ x: SHIELD.x + 14, y: SHIELD.top + 2 }), footL: stand(s.x - 38), footR: stand(s.x + 40) };
  } else if (blasted) {
    target = { back: { x: -30, y: -100 }, front: { x: 46, y: -90 }, footL: { x: -34, y: 60 }, footR: { x: 36, y: 58 } };
  } else {
    // Slumped: one hand on the floor, one in his lap, legs out along the floor.
    target = { back: rel({ x: hip.x - 18, y: FLOOR_Y - 9 }), front: rel({ x: hip.x + 40, y: hip.y - 6 }), footL: rel({ x: hip.x + 60, y: FLOOR_Y - 5 }), footR: rel({ x: hip.x + 88, y: FLOOR_Y - 7 }) };
  }
  const k = s.limbsFrom ? smoothstep(0, BLEND[s.mode], s.modeAge) : 1;
  const from = s.limbsFrom;
  const limbs: Limbs = from && k < 1 ? { back: lerp(from.back, target.back, k), front: lerp(from.front, target.front, k), footL: lerp(from.footL, target.footL, k), footR: lerp(from.footR, target.footR, k) } : target;
  s.limbs = limbs;
  const at = (p: Point): Point => ({ x: hip.x + p.x, y: hip.y + p.y });
  // Boots stay level with the floor whenever they are on it, whatever the body's angle.
  const bootTilt = floored || lyingUp ? -angle : 0;

  function segment(a: Point, b: Point, width: number, colour: string) {
    ctx.strokeStyle = colour; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  /** Draws a two-bone limb toward `end`, stopping at full reach rather than stretching, and returns where it ends. */
  function limb(root: Point, end: Point, upper: number, lower: number, side: number, width: number, colour: string): { joint: Point; end: Point } {
    const d = Math.hypot(end.x - root.x, end.y - root.y), max = upper + lower - 0.5;
    const tip = d > max ? lerp(root, end, max / d) : end;
    const joint = bendJoint(root, tip, upper, lower, side);
    segment(root, joint, width + 5, INK); segment(joint, tip, width + 5, INK);
    segment(root, joint, width, colour); segment(joint, tip, width, colour);
    return { joint, end: tip };
  }
  function boot(foot: Point) {
    ctx.save(); ctx.translate(foot.x, foot.y); ctx.rotate(bootTilt);
    ctx.fillStyle = '#3b2a1e'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-12, -6, 34, 12, [5, 7, 7, 5]); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function hand(point: Point, radius: number, colour: string) {
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = colour; ctx.fill();
  }
  // Legs and boots, then the back arm behind the body.
  boot(limb({ x: hip.x - 8, y: hip.y }, at(limbs.footL), 50, 50, -1, 22, '#2f343d').end);
  boot(limb({ x: hip.x + 8, y: hip.y }, at(limbs.footR), 50, 50, -1, 24, TROUSERS).end);
  const backShoulder = { x: shoulder.x - 10, y: shoulder.y + 6 };
  hand(limb(backShoulder, at(limbs.back), 56, 60, 1, 15, SKIN_SHADE).end, 8.5, SKIN_SHADE);
  // Torso, shirt and braces.
  segment(hip, shoulder, 58, INK);
  segment({ x: hip.x + (shoulder.x - hip.x) * 0.05, y: hip.y + (shoulder.y - hip.y) * 0.05 }, shoulder, 52, SHIRT);
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 5;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hip.x + side * 16, hip.y - 4); ctx.lineTo(shoulder.x + side * 12, shoulder.y + 8); ctx.stroke(); }
  segment({ x: hip.x - 26, y: hip.y }, { x: hip.x + 26, y: hip.y }, 9, '#241f1f');
  segment(shoulder, head, 24, INK);
  segment(shoulder, head, 19, SKIN);
  // Head: skull, soot, face, cap, goggles.
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(headRot);
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 34, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = SKIN; ctx.fill();
  const soot = clamp(s.soot, 0, 1);
  if (soot > 0.02) {
    ctx.fillStyle = `rgba(30, 28, 30, ${soot * 0.45})`;
    ctx.beginPath(); ctx.ellipse(-12, 12, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(18, 18, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();
  }
  if (s.char > 0.02) {
    ctx.fillStyle = `rgba(30, 28, 30, ${0.85 * clamp(s.char, 0, 1)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 27, 33, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(-23, 3, 7, 9, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = SKIN; ctx.fill();
  const eyes = [{ x: 5, y: -7 }, { x: 20, y: -8 }];
  const eyeOpen = Math.max(0.08, s.eyeOpen.x);
  const brow = s.brow.x;
  const knockedOut = floored || (lyingUp && s.modeAge < 0.3);
  for (const eye of eyes) {
    ctx.beginPath(); ctx.ellipse(eye.x, eye.y, 6, 6 * Math.min(1.3, knockedOut ? 1 : eyeOpen), 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    if (knockedOut) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(eye.x - 3, eye.y - 3); ctx.lineTo(eye.x + 3, eye.y + 3); ctx.moveTo(eye.x + 3, eye.y - 3); ctx.lineTo(eye.x - 3, eye.y + 3); ctx.stroke();
    } else {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(eye.x + 2, eye.y + 0.5, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-3, -18 + 1.5 * brow); ctx.lineTo(13, -18 - 5 * brow); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13, -19 - 5 * brow); ctx.lineTo(29, -19 + 1.5 * brow); ctx.stroke();
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(29, 9); ctx.lineTo(22, 12); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(29, 9); ctx.lineTo(22, 12); ctx.stroke();
  const open = clamp(s.mouthOpen.x, 0, 1);
  const curve = s.mouthCurve.x;
  ctx.globalAlpha = clamp(1 - open * 3, 0, 1);
  ctx.beginPath(); ctx.moveTo(6, 19 - curve * 3); ctx.quadraticCurveTo(15, 19 + curve * 9, 24, 19 - curve * 3); ctx.stroke();
  ctx.globalAlpha = 1;
  if (open > 0.12) {
    ctx.beginPath(); ctx.ellipse(15, 21 + 2 * open, 5 + 6 * open, 2 + 9 * open, 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#3a1420'; ctx.fill();
  }
  // Sweat as the pressure climbs.
  const drops = s.mode === 'stoking' ? (s.fear > 0.8 ? 3 : s.fear > 0.55 ? 2 : s.fear > 0.3 ? 1 : 0) : 0;
  const sites = [{ x: -12, y: -14 }, { x: 30, y: -20 }, { x: -6, y: 8 }];
  for (let i = 0; i < drops; i += 1) {
    const p = (s.time / 1.1 + i * 0.37) % 1;
    const site = sites[i]!;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(site.x, site.y + 24 * p * p, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Flat cap with the goggles parked on it, or pulled down over the eyes.
  ctx.fillStyle = CAP; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-30, -18); ctx.quadraticCurveTo(-26, -46, 2, -46); ctx.quadraticCurveTo(28, -46, 30, -22); ctx.lineTo(38, -18); ctx.lineTo(-30, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4f535c';
  ctx.beginPath(); ctx.moveTo(30, -22); ctx.lineTo(44, -18); ctx.lineTo(30, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (s.you) {
    // A staked viewer's stand-in: his cap says so.
    ctx.font = `11px ${MEME_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffe27a'; ctx.fillText('YOU', -13, -22);
  }
  const gy = mix(-36, -8, clamp(s.goggles.x, 0, 1));
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-24, gy); ctx.lineTo(30, gy); ctx.stroke();
  for (const gx of [5, 20]) {
    ctx.beginPath(); ctx.arc(gx, gy, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = s.goggles.x > 0.5 ? 'rgba(20, 24, 30, 0.92)' : 'rgba(150, 200, 230, 0.55)'; ctx.fill();
    ctx.strokeStyle = '#b8862b'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  }
  // Seeing stars while he is down.
  const stars = floored ? smoothstep(0.15, 0.5, s.modeAge) : lyingUp ? 1 - smoothstep(0, 0.35, s.modeAge) : 0;
  if (stars > 0.01) {
    ctx.globalAlpha = stars;
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      const a = s.clock * 3.2 + i * 2.09, x = Math.cos(a) * 30, y = -58 + Math.sin(a) * 8;
      ctx.beginPath();
      for (let j = 0; j < 8; j += 1) { const r = j % 2 ? 2.2 : 6.5, b = (j * Math.PI) / 4; ctx.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Shovel and the front arm over it.
  if (shovel) drawShovel(ctx, local(shovel.grip), local(shovel.blade), shovel.tip, s.mode === 'stoking' && shovel.carrying);
  const frontShoulder = { x: shoulder.x + 10, y: shoulder.y + 2 };
  const front = limb(frontShoulder, at(limbs.front), 56, 60, 1, 17, SKIN);
  segment(frontShoulder, lerp(frontShoulder, front.joint, 0.3), 24, INK);
  segment(frontShoulder, lerp(frontShoulder, front.joint, 0.3), 20, SHIRT);
  hand(front.end, 9.5, SKIN);
  ctx.restore();
}
