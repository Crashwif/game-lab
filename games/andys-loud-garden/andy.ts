/**
 * Andy: a rig built from shapes. The hip carries a torso segment, the head sits
 * on it through its own lag spring, two-bone arms and legs solve toward hand
 * and foot targets, and the floppy ears, the watering can, the sweat and the
 * harvest basket all trail the body on springs of their own. The scene tells
 * the rig what he is doing (idle, watering, harvest, busted); the room's
 * outcome decides that, never the rig.
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export type Point = { x: number; y: number };
export type AndyMode = 'idle' | 'watering' | 'harvest' | 'busted';

export interface AndyDrive {
  mode: AndyMode;
  /** World x under his hips; the scene walks him off with it. */
  x: number;
  /** Ground y under his feet. */
  ground: number;
  /** 0..1 how loud the garden has got: how fast he waters and how nervous he is. */
  growth: number;
  /** Where the water should land, and where the trouble will come from (world). */
  bed: Point;
  street: Point;
}

export interface AndyRig {
  mode: AndyMode;
  time: number;
  modeAge: number;
  x: number;
  vx: number;
  /** 1 facing the garden, -1 facing home; the turn passes through 0. */
  facing: Spring;
  /** Walk cycle in strides, and the watering cycle in pours. */
  stride: number;
  pour: number;
  /** Body follow-through: forward lean, head nod, knee bend, a startled hop. */
  lean: Spring;
  nod: Spring;
  crouch: Spring;
  hop: Spring;
  /** 0 can at his side .. 1 can out over the bed; the can's tilt; hands up. */
  reach: Spring;
  tilt: Spring;
  raise: Spring;
  /** Ear angles relative to the head. */
  ears: [Spring, Spring];
  headPrev: Point | null;
  headV: Point;
  shades: Spring;
  basket: Spring;
  eyeOpen: Spring;
  mouthOpen: Spring;
  mouthCurve: Spring;
  brow: Spring;
  blinkAt: number;
  /** 0 looking at the viewer .. 1 looking at `gazeAt`. */
  gazeWeight: Spring;
  gazeAt: Point;
  glanceUntil: number;
  nextGlance: number;
  /** The can once it has left his hand. */
  can: { held: boolean; x: number; y: number; vx: number; vy: number; angle: number; spin: number; rest: number };
  drops: { x: number; y: number; vx: number; vy: number; age: number }[];
  /** Edges seen in the last step: a pour began; a foot landed; the can left his hand; the can hit the ground. */
  events: { pour: boolean; step: boolean; drop: boolean; land: boolean };
}

export interface AndyView {
  head: Point;
  /** The spout's rose while he pours, with the direction the water leaves it and how hard. */
  spout: Point | null;
  spoutDir: Point;
  flow: number;
}

const INK = '#2a1f3a';
const YELLOW = '#f7c422';
const YELLOW_SHADE = '#d99e13';
const TEE = '#f6ead2';
const TEE_SHADE = '#dccbb0';
const TEAL = '#2f8f8c';
const TEAL_DARK = '#226d6c';
const BRASS = '#f0c04a';
const BOOT = '#7b3fa0';
const BOOT_DARK = '#5a2b79';
const CAN = '#9fd9b6';
const CAN_SHADE = '#6fb08d';
const WATER = '#9fe3ef';
const BASKET = '#b9803f';
const BASKET_DARK = '#8a5a2a';

const HIP_Y = -92;
const TORSO = 58;
const LEG = 50;
const ARM = 42;
/** Ground covered by one stride cycle, in px. */
const STRIDE = 90;

/** Solves a two-bone limb with a fixed endpoint and a consistent bend direction. */
export function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + dx / distance * along - dy / distance * bend, y: root.y + dy / distance * along + dx / distance * bend };
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const add = (a: Point, dx: number, dy: number): Point => ({ x: a.x + dx, y: a.y + dy });
const rot = (p: Point, a: number): Point => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

export function createAndy(x: number): AndyRig {
  return {
    mode: 'idle', time: 0, modeAge: 0, x, vx: 0, facing: spring(1), stride: 0, pour: 0,
    lean: spring(0), nod: spring(0), crouch: spring(0), hop: spring(0), reach: spring(0), tilt: spring(0), raise: spring(0),
    ears: [spring(0), spring(0)], headPrev: null, headV: { x: 0, y: 0 }, shades: spring(0), basket: spring(0),
    eyeOpen: spring(1), mouthOpen: spring(0.1), mouthCurve: spring(0.6), brow: spring(0), blinkAt: 2.1,
    gazeWeight: spring(0), gazeAt: { x: 0, y: 0 }, glanceUntil: 0, nextGlance: 1.5,
    can: { held: true, x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, rest: 0 }, drops: [],
    events: { pour: false, step: false, drop: false, land: false },
  };
}

/** One watering cycle: the can tips over the bed, holds the pour with a wobble, then rights itself for a breath. */
function pourCurve(phase: number): number {
  const u = phase - Math.floor(phase);
  if (u < 0.18) return smoothstep(0, 1, u / 0.18);
  if (u < 0.72) return 1 - 0.08 * Math.sin((u - 0.18) / 0.54 * Math.PI * 3);
  return 1 - smoothstep(0, 1, (u - 0.72) / 0.28);
}

/** A foot through one stride, hip-relative: planted and sliding back, then swung forward with a lift. */
function strideFoot(u: number): Point {
  u -= Math.floor(u);
  if (u < 0.58) return { x: mix(27, -27, u / 0.58), y: 0 };
  const t = (u - 0.58) / 0.42;
  return { x: mix(-27, 27, smoothstep(0, 1, t)), y: -18 * Math.sin(Math.PI * t) };
}

type Mood = 'calm' | 'keen' | 'nervous' | 'panic' | 'shock' | 'caught' | 'smug';
const FACES: Record<Mood, { eye: number; lid: number; open: number; curve: number; brow: number }> = {
  calm: { eye: 1, lid: 0.42, open: 0.12, curve: 0.6, brow: 0 },
  keen: { eye: 1.05, lid: 0.3, open: 0.3, curve: 0.8, brow: -0.2 },
  nervous: { eye: 1.1, lid: 0.18, open: 0.2, curve: 0.2, brow: 0.6 },
  panic: { eye: 1.3, lid: 0.05, open: 0.45, curve: -0.3, brow: 1 },
  shock: { eye: 1.7, lid: 0, open: 1, curve: -0.1, brow: 1 },
  caught: { eye: 1.35, lid: 0.08, open: 0.5, curve: -0.7, brow: 0.9 },
  smug: { eye: 0.85, lid: 0.5, open: 0.15, curve: 0.9, brow: -0.5 },
};

interface Pose {
  hip: Point;
  torsoAngle: number;
  shoulder: Point;
  head: Point;
  headRot: number;
  backFoot: Point;
  frontFoot: Point;
  backHand: Point;
  frontHand: Point;
  backSide: number;
  /** Head-local to rig-local. */
  toLocal: (lx: number, ly: number) => Point;
}

/** The pose the springs describe, in rig-local coordinates: x along his facing, y up from the ground. */
function computePose(rig: AndyRig): Pose {
  const t = rig.time;
  const reach = rig.reach.x;
  const raise = clamp(rig.raise.x, 0, 1.3);
  const lean = rig.lean.x;
  const crouch = rig.crouch.x;
  const walking = rig.mode === 'harvest' ? clamp(Math.abs(rig.vx) / 60, 0, 1) : 0;
  const idle = rig.mode === 'idle' || (rig.mode === 'harvest' && walking < 0.05) ? 1 : 0;
  const breathe = Math.sin(t * 1.5) * 1.8 * idle;
  const sway = Math.sin(t * 0.7) * 3 * idle;
  const u = rig.stride - Math.floor(rig.stride);
  const bob = walking * -3.5 * (0.5 + 0.5 * Math.cos(Math.PI * 2 * (u - 0.3) * 2));
  const tremble = rig.mode === 'busted' ? Math.exp(-rig.modeAge * 1.3) * Math.sin(t * 38) * 2.5 : 0;

  const hip = { x: sway + 10 * lean - 6 * raise, y: HIP_Y + 16 * crouch + rig.hop.x + breathe + bob };
  const torsoAngle = 0.08 + 0.5 * lean - 0.3 * raise + 0.14 * walking;
  const shoulder = add(hip, Math.sin(torsoAngle) * TORSO, -Math.cos(torsoAngle) * TORSO);
  const headRot = torsoAngle * 0.5 + rig.nod.x;
  const head = add(shoulder, Math.sin(headRot) * 46, -Math.cos(headRot) * 46);
  const toLocal = (lx: number, ly: number): Point => ({ x: head.x + lx * Math.cos(headRot) - ly * Math.sin(headRot), y: head.y + lx * Math.sin(headRot) + ly * Math.cos(headRot) });

  // Feet: a stance that widens into the pour, spreads for the startle and strides for the walk home.
  const standBack = { x: mix(-22, -36, Math.max(reach, raise)) + sway * 0.3, y: 0 };
  const standFront = { x: mix(20, 34, Math.max(reach, raise)) + sway * 0.3, y: 0 };
  const walkBack = add(strideFoot(rig.stride + 0.5), hip.x, 0);
  const walkFront = add(strideFoot(rig.stride), hip.x, 0);
  const backFoot = lerp(standBack, walkBack, walking);
  const frontFoot = lerp(standFront, walkFront, walking);

  // Hands: the can hand reaches out over the bed, the free hand rests on the hip, both fly up when caught.
  const frontShoulder = add(shoulder, 8, 4);
  const backShoulder = add(shoulder, -10, 6);
  const swing = Math.sin(rig.stride * Math.PI * 2) * 16 * walking;
  const frontRest = add(frontShoulder, 24 + swing * 0.3, 60 - idle * 2 + Math.sin(t * 1.5) * 1.5 * idle);
  const frontPour = add(frontShoulder, 60, 26 + Math.sin(t * 2.3) * 2);
  const frontUp = add(frontShoulder, 62 + tremble, -54);
  const backRest = add(backShoulder, -22 + swing, 58 + Math.sin(t * 1.5 + 1) * 1.5 * idle);
  const base = rot({ x: -8, y: 40 }, rig.tilt.x);
  const support = add(frontPour, base.x, base.y);
  const backUp = add(backShoulder, -60 - tremble, -50);
  const frontHand = lerp(lerp(frontRest, frontPour, reach), frontUp, raise);
  const backHand = lerp(lerp(backRest, support, reach), backUp, raise);
  return { hip, torsoAngle, shoulder, head, headRot, backFoot, frontFoot, backHand, frontHand, backSide: mix(1, -1, raise), toLocal };
}

/** The can's grip-local coordinates: its body hangs under the grip, the spout leaves to the right. */
const SPOUT_TIP = { x: 50, y: -8 };
const SPOUT_ROOT = { x: 18, y: 16 };

function enterMode(rig: AndyRig, mode: AndyMode, pose: Pose, drive: AndyDrive): void {
  rig.mode = mode;
  rig.modeAge = 0;
  if (mode === 'idle') {
    rig.can.held = true;
    rig.drops.length = 0;
    rig.stride = 0;
    rig.pour = 0;
    settleSpring(rig.facing, 1);
    settleSpring(rig.raise, 0);
    settleSpring(rig.crouch, 0);
    settleSpring(rig.hop, 0);
    settleSpring(rig.shades, 0);
    settleSpring(rig.basket, 0);
    return;
  }
  if (mode === 'busted' || mode === 'harvest') {
    if (rig.can.held) {
      const grip = worldPoint(rig, pose.frontHand, drive.ground);
      const toss = mode === 'busted' ? 1 : 0.45;
      rig.can = { held: false, x: grip.x, y: grip.y, vx: (60 + 40 * toss) * rig.facing.x, vy: -220 * toss - 40, angle: rig.tilt.x * rig.facing.x, spin: 7 * toss * rig.facing.x, rest: 0 };
      rig.events.drop = true;
    }
  }
  if (mode === 'busted') {
    rig.hop.v = -420;
    rig.raise.v = 6;
    const head = worldPoint(rig, pose.head, drive.ground);
    for (let i = 0; i < 7; i += 1) {
      const a = -2.6 + i * 0.37;
      rig.drops.push({ x: head.x + Math.cos(a) * 40, y: head.y + Math.sin(a) * 30, vx: Math.cos(a) * (140 + noise(i) * 80), vy: Math.sin(a) * 160 - 90, age: 0 });
    }
  }
}

function worldPoint(rig: AndyRig, p: Point, ground: number): Point {
  return { x: rig.x + p.x * rig.facing.x, y: ground + p.y };
}

/**
 * Jumps to the pose the drive calls for, for a round met late: hands already up with the can on the
 * ground after a bust, or shades on and the basket in hand after an accepted exit.
 */
export function settleAndy(rig: AndyRig, drive: AndyDrive): void {
  rig.x = drive.x;
  rig.vx = 0;
  rig.mode = drive.mode;
  rig.modeAge = 5;
  rig.drops.length = 0;
  rig.headPrev = null;
  settleSpring(rig.facing, drive.mode === 'harvest' ? -1 : 1);
  settleSpring(rig.lean, drive.mode === 'watering' ? 0.7 : 0);
  settleSpring(rig.nod, 0);
  settleSpring(rig.crouch, drive.mode === 'busted' ? 1 : 0);
  settleSpring(rig.hop, 0);
  settleSpring(rig.reach, drive.mode === 'watering' ? 1 : 0);
  settleSpring(rig.tilt, drive.mode === 'watering' ? 1.05 : 0);
  settleSpring(rig.raise, drive.mode === 'busted' ? 1 : 0);
  settleSpring(rig.shades, drive.mode === 'harvest' ? 1 : 0);
  settleSpring(rig.basket, drive.mode === 'harvest' ? 1 : 0);
  settleSpring(rig.ears[0], 0);
  settleSpring(rig.ears[1], 0);
  settleSpring(rig.gazeWeight, drive.mode === 'idle' ? 0 : 1);
  rig.gazeAt = drive.mode === 'busted' ? drive.street : drive.bed;
  rig.pour = drive.mode === 'watering' ? 0.4 : 0;
  rig.can = drive.mode === 'idle' || drive.mode === 'watering'
    ? { held: true, x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, rest: 0 }
    : { held: false, x: drive.x + 54, y: drive.ground - 12, vx: 0, vy: 0, angle: Math.PI / 2, spin: 0, rest: 2 };
  const face = FACES[moodOf(rig, drive)];
  settleSpring(rig.eyeOpen, face.eye);
  settleSpring(rig.mouthOpen, face.open);
  settleSpring(rig.mouthCurve, face.curve);
  settleSpring(rig.brow, face.brow);
}

function moodOf(rig: AndyRig, drive: AndyDrive): Mood {
  const fear = clamp((drive.growth - 0.3) / 0.55, 0, 1);
  switch (rig.mode) {
    case 'busted': return rig.modeAge < 1.1 ? 'shock' : 'caught';
    case 'harvest': return 'smug';
    case 'watering': return fear > 0.7 ? 'panic' : fear > 0.3 ? 'nervous' : 'keen';
    default: return 'calm';
  }
}

export function stepAndy(rig: AndyRig, drive: AndyDrive, dt: number, reduced: boolean): void {
  rig.events.pour = false;
  rig.events.step = false;
  rig.events.drop = false;
  rig.events.land = false;
  const pose = computePose(rig);
  if (drive.mode !== rig.mode) enterMode(rig, drive.mode, pose, drive);
  if (dt <= 0) return;
  const go = (s: Spring, target: number, omega: number, zeta: number): Spring => reduced ? settleSpring(s, target) : stepSpring(s, target, omega, zeta, dt);
  rig.time += reduced ? 0 : dt;
  rig.modeAge += dt;
  rig.vx = (drive.x - rig.x) / dt;
  rig.x = drive.x;
  const t = rig.time;
  const fear = clamp((drive.growth - 0.3) / 0.55, 0, 1);

  // What each spring is asked for by the mode.
  let lean = 0;
  let reach = 0;
  let tilt = 0;
  let raise = 0;
  let crouch = 0;
  let gaze = 0;
  let gazeAt = drive.bed;
  switch (rig.mode) {
    case 'idle': {
      tilt = Math.sin(t * 1.1) * 0.05;
      if (t > rig.nextGlance) { rig.glanceUntil = t + 1.4 + noise(rig.nextGlance) * 1.2; rig.nextGlance = rig.glanceUntil + 2 + noise(rig.nextGlance + 3) * 3; }
      gaze = t < rig.glanceUntil ? 1 : 0;
      gazeAt = drive.bed;
      break;
    }
    case 'watering': {
      const before = rig.pour;
      const rate = reduced ? 0 : 0.42 + drive.growth * 0.5;
      rig.pour += rate * dt;
      const u0 = before - Math.floor(before);
      const u1 = rig.pour - Math.floor(rig.pour);
      if ((u0 < 0.12 && u1 >= 0.12) || (u1 < u0 && u1 >= 0.12)) { rig.events.pour = true; rig.nod.v += 0.9; }
      const pour = reduced ? 0.85 : pourCurve(rig.pour);
      reach = 0.6 + 0.4 * pour;
      tilt = 0.25 + 0.85 * pour + fear * Math.sin(t * 23) * 0.04;
      lean = 0.35 + 0.5 * pour;
      // A glance over his shoulder at the street, more often as the garden gets louder.
      if (fear > 0.25 && t > rig.nextGlance) { rig.glanceUntil = t + 0.55 + fear * 0.5; rig.nextGlance = rig.glanceUntil + 1.2 + (1 - fear) * 3 + noise(rig.nextGlance) * 1.5; }
      const glancing = t < rig.glanceUntil && fear > 0.25;
      gaze = 1;
      gazeAt = glancing ? drive.street : drive.bed;
      break;
    }
    case 'harvest': {
      const walking = clamp(Math.abs(rig.vx) / 60, 0, 1);
      const before = rig.stride;
      if (!reduced) rig.stride += (Math.abs(rig.vx) / STRIDE) * dt;
      // A foot lands when its swing wraps; the other foot runs half a stride behind.
      for (const offset of [0, 0.5]) {
        const a = (before + offset) % 1;
        const b = (rig.stride + offset) % 1;
        if (b < a) { rig.events.step = true; rig.nod.v += 0.6; }
      }
      lean = 0.1 * walking;
      gaze = 1;
      gazeAt = { x: drive.x - 400 * (rig.facing.x < 0 ? 1 : -1), y: drive.ground - 120 };
      break;
    }
    case 'busted': {
      raise = 1;
      crouch = rig.modeAge < 0.4 ? 1 : 0.55;
      lean = -0.15;
      gaze = 1;
      gazeAt = drive.street;
      break;
    }
  }
  go(rig.lean, lean, 14, 0.6);
  go(rig.reach, reach, 12, 0.6);
  go(rig.tilt, tilt, 16, 0.5);
  go(rig.raise, raise, 20, 0.35);
  go(rig.crouch, crouch, 18, 0.5);
  go(rig.hop, 0, 16, 0.5);
  go(rig.nod, 0.05 * lean + (gazeAt === drive.street ? 0.12 : 0), 11, 0.35);
  go(rig.facing, rig.mode === 'harvest' && rig.modeAge > 0.5 ? -1 : 1, 7, 0.9);
  go(rig.shades, rig.mode === 'harvest' ? 1 : 0, 12, 0.5);
  go(rig.basket, rig.mode === 'harvest' && rig.modeAge > 0.25 ? 1 : 0, 14, 0.45);
  rig.gazeAt = gazeAt;
  go(rig.gazeWeight, gaze, 9, 0.8);

  // The face.
  const mood = moodOf(rig, drive);
  const face = FACES[mood];
  const blinking = t > rig.blinkAt && t < rig.blinkAt + 0.12;
  if (t >= rig.blinkAt + 0.12) rig.blinkAt = t + 2 + 2.8 * noise(rig.blinkAt);
  go(rig.eyeOpen, blinking && mood !== 'shock' ? 0.06 : face.eye, 28, 0.9);
  go(rig.mouthOpen, face.open + (rig.mode === 'watering' ? Math.max(0, Math.sin(t * 2.6)) * 0.15 : 0), 14, 0.8);
  go(rig.mouthCurve, face.curve, 10, 0.8);
  go(rig.brow, face.brow, 12, 0.75);

  // Ears: pendulums on the head that lag its motion and stream behind a walk.
  const after = computePose(rig);
  const head = worldPoint(rig, after.head, drive.ground);
  if (rig.headPrev) rig.headV = { x: (head.x - rig.headPrev.x) / dt, y: (head.y - rig.headPrev.y) / dt };
  rig.headPrev = head;
  // Forward motion streams both ears back; a dropping head throws them up. The back ear hangs down and
  // back, so up is a larger angle for it and a smaller one for the ear flopped over the brow.
  const streamBack = clamp(rig.headV.x * rig.facing.x * 0.004, -0.5, 0.5);
  const lift = clamp(-rig.headV.y * 0.0025, -0.4, 0.4);
  go(rig.ears[0], -0.15 + streamBack * 0.8 - lift - after.headRot * 0.5, 13, 0.22);
  go(rig.ears[1], 0.1 - streamBack * 1.1 + lift * 1.3 - after.headRot * 0.5, 15, 0.2);

  // The dropped can and the flung sweat.
  if (!rig.can.held) {
    const can = rig.can;
    if (can.rest < 1.5) {
      can.vy += 1500 * dt;
      can.x += can.vx * dt;
      can.y += can.vy * dt;
      can.angle += can.spin * dt;
      const low = drive.ground - 10;
      if (can.y > low) {
        can.y = low;
        if (can.vy > 60) { if (can.vy > 200) rig.events.land = true; can.vy *= -0.32; can.vx *= 0.6; can.spin = -can.spin * 0.5; } else { can.vy = 0; can.vx *= 0.85; can.rest += dt; }
      }
      if (can.vy === 0 && can.y >= low - 0.01) {
        const lying = can.angle > 0 ? Math.PI / 2 : -Math.PI / 2;
        can.angle += (lying - can.angle) * (1 - Math.exp(-dt * 8));
        can.spin = 0;
      }
    }
  }
  for (const drop of rig.drops) {
    drop.age += dt;
    drop.vy += 900 * dt;
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
  }
  if (rig.drops.length && rig.drops[0]!.age > 1.1) rig.drops.length = 0;
}

/** Draws him and reports where the water leaves the can. */
export function drawAndy(ctx: CanvasRenderingContext2D, rig: AndyRig, drive: AndyDrive): AndyView {
  const t = rig.time;
  const pose = computePose(rig);
  const { hip, torsoAngle, shoulder, head, headRot, backFoot, frontFoot, backHand, frontHand, backSide, toLocal } = pose;
  const facing = rig.facing.x;
  const flip = Math.abs(facing) < 0.12 ? 0.12 * Math.sign(facing || 1) : facing;
  const raise = clamp(rig.raise.x, 0, 1.3);
  const mood = moodOf(rig, drive);

  function segment(a: Point, b: Point, width: number, color: string): void {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function disc(p: Point, rx: number, ry: number, color: string, outline = 0): void {
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    if (outline) { ctx.strokeStyle = INK; ctx.lineWidth = outline; ctx.stroke(); }
    ctx.fillStyle = color; ctx.fill();
  }
  function limb(root: Point, end: Point, upper: number, lower: number, side: number, width: number, color: string, shade: string): Point {
    const joint = bendJoint(root, end, upper, lower, side);
    segment(root, joint, width + 6, INK); segment(joint, end, width + 6, INK);
    segment(root, joint, width, shade); segment(joint, end, width, color);
    return joint;
  }
  function boot(foot: Point, lift: number): void {
    ctx.save(); ctx.translate(foot.x, foot.y); ctx.rotate(-lift * 0.5);
    ctx.beginPath(); ctx.moveTo(-14, -22); ctx.lineTo(13, -22); ctx.lineTo(15, -8); ctx.quadraticCurveTo(30, -6, 30, 2); ctx.quadraticCurveTo(28, 8, 18, 8); ctx.lineTo(-13, 8); ctx.quadraticCurveTo(-18, 6, -17, -2); ctx.closePath();
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = BOOT; ctx.fill();
    ctx.fillStyle = BOOT_DARK; ctx.fillRect(-14, -24, 27, 6);
    segment({ x: -12, y: 4 }, { x: 26, y: 4 }, 3, BOOT_DARK);
    ctx.restore();
  }
  function hand(p: Point, open: number, color: string): void {
    disc(p, 10, 9.5, color, 3);
    ctx.strokeStyle = YELLOW_SHADE; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i += 1) {
      const a = -2.4 + i * 0.55 - (1 - open) * 1.2;
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3); ctx.lineTo(p.x + Math.cos(a) * (6 + 8 * open), p.y + Math.sin(a) * (6 + 8 * open)); ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(rig.x, drive.ground);
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.scale(flip, 1);
  // Ground shadow under the feet.
  ctx.fillStyle = 'rgba(24, 58, 57, 0.3)';
  ctx.beginPath(); ctx.ellipse((backFoot.x + frontFoot.x) / 2, 5, 58 + Math.abs(frontFoot.x - backFoot.x) * 0.3, 9, 0, 0, Math.PI * 2); ctx.fill();

  // Back leg and arm, then the torso over them.
  const backHip = add(hip, -9, 2);
  const frontHip = add(hip, 9, 0);
  limb(backHip, add(backFoot, 0, -10), LEG, LEG, -1, 24, TEAL_DARK, TEAL_DARK);
  boot(backFoot, clamp(-backFoot.y / 16, 0, 1));
  const backShoulder = add(shoulder, -10, 6);
  // The far arm hangs behind the body, reaches across it to steady the can, and comes up beside the face when caught.
  const backLayer: 'behind' | 'across' | 'raised' = raise > 0.5 ? 'raised' : rig.reach.x > 0.5 ? 'across' : 'behind';
  const backArm = (): void => {
    const joint = limb(backShoulder, backHand, ARM, ARM, backSide, 15, YELLOW_SHADE, TEE_SHADE);
    segment(backShoulder, lerp(backShoulder, joint, 0.45), 23, INK);
    segment(backShoulder, lerp(backShoulder, joint, 0.45), 18, TEE_SHADE);
    hand(backHand, raise, YELLOW_SHADE);
  };
  if (backLayer === 'behind') backArm();

  ctx.save();
  ctx.translate(hip.x, hip.y); ctx.rotate(torsoAngle);
  ctx.beginPath(); ctx.roundRect(-33, -TORSO - 10, 66, TORSO + 24, [26, 26, 20, 20]);
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke(); ctx.fillStyle = TEE; ctx.fill();
  // Overalls: bib, straps and the buttons that catch the light.
  ctx.beginPath(); ctx.roundRect(-33, -TORSO + 18, 66, TORSO - 2, [12, 12, 20, 20]);
  ctx.fillStyle = TEAL; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-16, -TORSO + 4, 32, 22, 4); ctx.fillStyle = TEAL_DARK; ctx.fill();
  segment({ x: -12, y: -TORSO + 8 }, { x: -14, y: -TORSO - 8 }, 7, TEAL_DARK);
  segment({ x: 12, y: -TORSO + 8 }, { x: 14, y: -TORSO - 8 }, 7, TEAL_DARK);
  for (const bx of [-12, 12]) { disc({ x: bx, y: -TORSO + 9 }, 3.6, 3.6, BRASS, 1.5); }
  segment({ x: -8, y: -TORSO + 30 }, { x: 8, y: -TORSO + 30 }, 1.5, TEAL_DARK);
  ctx.restore();

  limb(frontHip, add(frontFoot, 0, -10), LEG, LEG, -1, 26, TEAL, TEAL);
  boot(frontFoot, clamp(-frontFoot.y / 16, 0, 1));
  disc(hip, 28, 18, TEAL, 3.5);
  if (backLayer === 'across') backArm();

  // The head: ears behind it, the skull and muzzle as one outline, then the face.
  ctx.save();
  ctx.translate(head.x, head.y); ctx.rotate(headRot);
  drawEar(ctx, { x: -30, y: -34 }, rig.ears[0].x + 2.25, 78, 36, t);
  ctx.beginPath(); ctx.ellipse(0, 0, 50, 45, 0, 0, Math.PI * 2); ctx.ellipse(34, 12, 34, 25, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
  ctx.fillStyle = YELLOW; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 50, 45, 0, 0, Math.PI * 2); ctx.ellipse(34, 12, 34, 25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = YELLOW_SHADE;
  ctx.beginPath(); ctx.ellipse(22, 30, 36, 9, 0.1, 0, Math.PI); ctx.fill();
  drawEar(ctx, { x: -24, y: -44 }, rig.ears[1].x + 0.42, 52, 34, t + 1);
  drawFace(ctx, rig, mood, headRot, toLocal, drive);
  ctx.restore();
  if (backLayer === 'raised') backArm();

  // Front arm and whatever it holds: the can, or the harvest basket.
  const frontShoulder = add(shoulder, 8, 4);
  const elbow = limb(frontShoulder, frontHand, ARM, ARM, 1, 16, YELLOW, TEE);
  segment(frontShoulder, lerp(frontShoulder, elbow, 0.45), 25, INK);
  segment(frontShoulder, lerp(frontShoulder, elbow, 0.45), 20, TEE);
  let spout: Point | null = null;
  let spoutDir = { x: 1, y: 0 };
  let flow = 0;
  if (rig.can.held) {
    ctx.save(); ctx.translate(frontHand.x, frontHand.y); ctx.rotate(rig.tilt.x);
    drawCan(ctx, rig.tilt.x);
    ctx.restore();
    flow = clamp((rig.tilt.x - 0.55) / 0.5, 0, 1);
    if (flow > 0) {
      const tipOffset = rot(SPOUT_TIP, rig.tilt.x);
      spout = worldPoint(rig, add(frontHand, tipOffset.x, tipOffset.y), drive.ground);
      const dir = rot({ x: 1, y: -0.35 }, rig.tilt.x);
      spoutDir = { x: dir.x * flip, y: dir.y };
    }
  }
  const basket = clamp(rig.basket.x, 0, 1.15);
  if (basket > 0.02) {
    ctx.save(); ctx.translate(frontHand.x, frontHand.y); ctx.scale(basket, basket);
    ctx.rotate(Math.sin(t * 2.2) * 0.05 + rig.vx * 0.0006 * flip);
    drawBasket(ctx, t);
    ctx.restore();
  }
  hand(frontHand, raise, YELLOW);
  ctx.restore();

  // The can where it fell, in world space, and the sweat flung off at the bust.
  if (!rig.can.held) {
    ctx.save(); ctx.translate(rig.can.x - rig.x, rig.can.y - drive.ground); ctx.rotate(rig.can.angle);
    drawCan(ctx, rig.can.angle);
    ctx.restore();
  }
  ctx.restore();
  if (rig.drops.length) {
    for (const drop of rig.drops) {
      ctx.globalAlpha = clamp(1 - drop.age / 1.1, 0, 1);
      drawDrop(ctx, drop.x, drop.y, 4.5, Math.atan2(drop.vy, drop.vx) + Math.PI / 2);
    }
    ctx.globalAlpha = 1;
  }
  return { head: worldPoint(rig, head, drive.ground), spout, spoutDir, flow };
}

function drawEar(ctx: CanvasRenderingContext2D, pivot: Point, angle: number, length: number, width: number, t: number): void {
  ctx.save(); ctx.translate(pivot.x, pivot.y); ctx.rotate(angle);
  const wobble = Math.sin(t * 3) * 0.02;
  ctx.beginPath();
  ctx.moveTo(0, -width * 0.4);
  ctx.quadraticCurveTo(length * 0.5, -width * 0.75 + wobble * length, length * 0.86, -width * 0.45);
  ctx.quadraticCurveTo(length * 1.16, 0, length * 0.86, width * 0.5);
  ctx.quadraticCurveTo(length * 0.5, width * 0.8, 0, width * 0.4);
  ctx.closePath();
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.fillStyle = YELLOW; ctx.fill();
  ctx.fillStyle = YELLOW_SHADE;
  ctx.beginPath(); ctx.ellipse(length * 0.72, width * 0.08, length * 0.2, width * 0.24, 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, -r * 1.8); ctx.lineTo(r, 0); ctx.arc(0, 0.5, r, -0.3, Math.PI + 0.3); ctx.closePath();
  ctx.fillStyle = WATER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
}

function drawFace(ctx: CanvasRenderingContext2D, rig: AndyRig, mood: Mood, headRot: number, toLocal: (lx: number, ly: number) => Point, drive: AndyDrive): void {
  const t = rig.time;
  const face = FACES[mood];
  const eyeOpen = Math.max(0.06, rig.eyeOpen.x);
  const lid = face.lid;
  const eyes = [{ x: 4, y: -12, rx: 13, ry: 15 }, { x: 31, y: -17, rx: 12, ry: 14 }];
  // Pupils drift toward what he is looking at, in head space; the viewer when nothing holds his eye.
  const weight = clamp(rig.gazeWeight.x, 0, 1);
  const headWorld = (lx: number, ly: number): Point => { const p = toLocal(lx, ly); return { x: rig.x + p.x * rig.facing.x, y: drive.ground + p.y }; };
  for (const eye of eyes) {
    const world = headWorld(eye.x, eye.y);
    const gx = (rig.gazeAt.x - world.x) * Math.sign(rig.facing.x || 1);
    const gy = rig.gazeAt.y - world.y;
    const gd = Math.max(1, Math.hypot(gx, gy));
    const lx = (gx * Math.cos(-headRot) - gy * Math.sin(-headRot)) / gd;
    const ly = (gx * Math.sin(-headRot) + gy * Math.cos(-headRot)) / gd;
    const scale = Math.min(1.4, face.eye);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(eye.x, eye.y, eye.rx * scale, eye.ry * scale * eyeOpen, 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fffdf5'; ctx.fill();
    ctx.clip();
    const px = eye.x + 3 + lx * 4.5 * weight;
    const py = eye.y + 1 + ly * 4 * weight;
    ctx.beginPath(); ctx.arc(px, py, 7.5 * scale, 0, Math.PI * 2); ctx.fillStyle = '#3c7ad6'; ctx.fill();
    ctx.beginPath(); ctx.arc(px + 0.5, py + 0.5, 4 * scale, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(px - 2.5, py - 3, 1.8, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    // The heavy half lid that gives him the look.
    const drop = eye.ry * scale * eyeOpen * 2 * lid * (0.85 + 0.15 * Math.sin(t * 0.9));
    ctx.fillStyle = YELLOW;
    ctx.fillRect(eye.x - eye.rx * 2, eye.y - eye.ry * 2, eye.rx * 4, eye.ry * 2 - eye.ry * scale * eyeOpen + drop);
    if (drop > 1) {
      ctx.beginPath(); ctx.moveTo(eye.x - eye.rx * scale, eye.y - eye.ry * scale * eyeOpen + drop); ctx.lineTo(eye.x + eye.rx * scale, eye.y - eye.ry * scale * eyeOpen + drop);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.restore();
  }
  // Brows: inner ends rise with worry, drop with smugness.
  const brow = rig.brow.x;
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -29 + 2 * brow); ctx.lineTo(13, -33 - 6 * brow); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, -35 - 5 * brow); ctx.lineTo(42, -31 + 2 * brow); ctx.stroke();
  // Nostrils on the muzzle.
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(58, -4, 2.6, 1.8, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(64, 1, 2.2, 1.6, 0.4, 0, Math.PI * 2); ctx.fill();
  // The grin: a wide mouth across the muzzle whose corners curl with the mood and whose jaw drops when he yelps.
  const open = clamp(rig.mouthOpen.x, 0, 1);
  const curve = rig.mouthCurve.x;
  const a = { x: 2, y: 14 };
  const b = { x: 60, y: 6 };
  const topCtl = { x: 32, y: 10 - curve * 8 + open * 4 };
  const bottomCtl = { x: 30, y: 24 + 30 * open + curve * 10 };
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(topCtl.x, topCtl.y, b.x, b.y); ctx.quadraticCurveTo(bottomCtl.x, bottomCtl.y, a.x, a.y); ctx.closePath();
  ctx.fillStyle = '#8a1b2b'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath(); ctx.moveTo(a.x - 5, a.y - 12); ctx.lineTo(b.x + 5, b.y - 12); ctx.lineTo(b.x + 5, b.y + 1 + open * 2); ctx.quadraticCurveTo(32, 14 - curve * 5 + open * 6, a.x - 5, a.y + 2 + open * 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d9cfc0'; ctx.lineWidth = 1.2;
  for (let i = 1; i < 6; i += 1) { const x = a.x + (b.x - a.x) * i / 6; ctx.beginPath(); ctx.moveTo(x, a.y + (b.y - a.y) * i / 6 - 10); ctx.lineTo(x, a.y + (b.y - a.y) * i / 6 + 6); ctx.stroke(); }
  if (open > 0.3) { ctx.fillStyle = '#e4607a'; ctx.beginPath(); ctx.ellipse(30, 22 + 24 * open, 16, 7 + 6 * open, -0.1, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(topCtl.x, topCtl.y, b.x, b.y); ctx.quadraticCurveTo(bottomCtl.x, bottomCtl.y, a.x, a.y); ctx.closePath(); ctx.stroke();
  // Sweat slides down the face as the garden gets loud; shock flings it (the rig's drops) instead.
  const drops = mood === 'nervous' ? 1 : mood === 'panic' ? 3 : mood === 'caught' ? 2 : 0;
  const sites = [{ x: -22, y: -30 }, { x: 44, y: -36 }, { x: -14, y: 6 }];
  for (let i = 0; i < drops; i += 1) {
    const p = (t / 1.1 + i * 0.37) % 1;
    const site = sites[i]!;
    ctx.globalAlpha = 1 - p * p;
    drawDrop(ctx, site.x, site.y + 26 * p * p, 3.6, 0);
  }
  ctx.globalAlpha = 1;
  // Deal-with-it shades drop in from above once the harvest is his.
  const shades = clamp(rig.shades.x, 0, 1.1);
  if (shades > 0.02) {
    const dy = -140 * (1 - shades);
    ctx.fillStyle = INK;
    for (const eye of eyes) {
      ctx.fillRect(eye.x - 15, eye.y - 11 + dy, 30, 12);
      ctx.fillRect(eye.x - 12, eye.y + 1 + dy, 24, 6);
      ctx.fillRect(eye.x - 8, eye.y + 7 + dy, 16, 3);
    }
    ctx.fillRect(eyes[0]!.x + 14, eyes[0]!.y - 12 + dy, 6, 4);
    ctx.fillRect(-52, eyes[0]!.y - 8 + dy, 38, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const eye of eyes) ctx.fillRect(eye.x - 12, eye.y - 8 + dy, 9, 3);
  }
}

/** The mint watering can in grip-local coordinates: the hand holds the top handle at the origin. */
function drawCan(ctx: CanvasRenderingContext2D, tilt: number): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  // Spout, with the rose at its tip.
  ctx.beginPath(); ctx.moveTo(SPOUT_ROOT.x, SPOUT_ROOT.y + 6); ctx.lineTo(SPOUT_TIP.x - 4, SPOUT_TIP.y + 4); ctx.lineTo(SPOUT_TIP.x - 1, SPOUT_TIP.y - 4); ctx.lineTo(SPOUT_ROOT.x, SPOUT_ROOT.y - 4); ctx.closePath();
  ctx.fillStyle = CAN_SHADE; ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(SPOUT_TIP.x - 1, SPOUT_TIP.y); ctx.rotate(-0.4);
  ctx.beginPath(); ctx.ellipse(0, 0, 5, 9, 0, 0, Math.PI * 2); ctx.fillStyle = CAN_SHADE; ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.arc(1, i * 4.5, 1.1, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // Body with a water line that tips with the can, and the rim.
  ctx.beginPath(); ctx.roundRect(-20, 6, 40, 36, [5, 5, 9, 9]);
  ctx.fillStyle = CAN; ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.roundRect(-20, 6, 40, 36, [5, 5, 9, 9]); ctx.clip();
  ctx.fillStyle = CAN_SHADE; ctx.globalAlpha = 0.55;
  ctx.save(); ctx.translate(0, 26); ctx.rotate(-tilt); ctx.fillRect(-60, 2, 120, 60); ctx.restore();
  ctx.globalAlpha = 1; ctx.restore();
  ctx.fillStyle = CAN_SHADE; ctx.fillRect(-20, 6, 40, 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(20, 12); ctx.stroke();
  // Top handle the hand grips, and the back handle.
  ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(0, 8, 14, Math.PI, 0); ctx.stroke();
  ctx.lineWidth = 4.5; ctx.strokeStyle = CAN_SHADE; ctx.beginPath(); ctx.arc(0, 8, 14, Math.PI, 0); ctx.stroke();
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(-22, 24, 11, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = CAN_SHADE; ctx.beginPath(); ctx.arc(-22, 24, 11, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
}

/** The harvest basket, hung from the hand at the origin, leaves peeking out. */
function drawBasket(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 26, 24, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.strokeStyle = BASKET_DARK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 26, 24, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  for (let i = 0; i < 3; i += 1) {
    const a = -0.5 + i * 0.5 + Math.sin(t * 2 + i) * 0.08;
    ctx.save(); ctx.translate(-6 + i * 8, 12); ctx.rotate(a);
    for (let f = -2; f <= 2; f += 1) {
      ctx.save(); ctx.rotate(f * 0.42);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, -12, 0, -24 + Math.abs(f) * 4); ctx.quadraticCurveTo(5, -12, 0, 0);
      ctx.fillStyle = f % 2 ? '#7fc45f' : '#9ad964'; ctx.fill(); ctx.strokeStyle = '#173f35'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(-26, 12); ctx.lineTo(26, 12); ctx.lineTo(20, 40); ctx.quadraticCurveTo(0, 46, -20, 40); ctx.closePath();
  ctx.fillStyle = BASKET; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.strokeStyle = BASKET_DARK; ctx.lineWidth = 1.6;
  for (let y = 18; y < 40; y += 6) { ctx.beginPath(); ctx.moveTo(-25 + (y - 12) * 0.2, y); ctx.lineTo(25 - (y - 12) * 0.2, y); ctx.stroke(); }
  for (let x = -18; x <= 18; x += 9) { ctx.beginPath(); ctx.moveTo(x, 13); ctx.lineTo(x * 0.8, 41); ctx.stroke(); }
  ctx.fillStyle = BASKET_DARK; ctx.fillRect(-27, 9, 54, 5);
}

/**
 * The water from the rose: a few streams on a parabola from the spout to the soil, droplets running
 * down them and a splash where they land.
 */
export function drawStream(ctx: CanvasRenderingContext2D, view: AndyView, ground: number, t: number): void {
  if (!view.spout || view.flow <= 0) return;
  const { spout, spoutDir, flow } = view;
  const g = 1100;
  ctx.save();
  ctx.lineCap = 'round';
  for (let s = -1; s <= 1; s += 1) {
    const a = Math.atan2(spoutDir.y, spoutDir.x) + s * 0.1;
    const speed = 150 * flow + 30 - Math.abs(s) * 18;
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    const fall = Math.max(1, ground - 6 - spout.y);
    const total = (-vy + Math.sqrt(vy * vy + 2 * g * fall)) / g;
    ctx.strokeStyle = s === 0 ? WATER : 'rgba(159, 227, 239, 0.7)';
    ctx.lineWidth = s === 0 ? 4 : 2.2;
    ctx.beginPath();
    for (let i = 0; i <= 14; i += 1) {
      const u = total * i / 14;
      const x = spout.x + vx * u;
      const y = spout.y + vy * u + 0.5 * g * u * u;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = 0.55 + 0.45 * flow;
    ctx.stroke();
    for (let i = 0; i < 5; i += 1) {
      const u = total * (((t * 2.2 + i / 5 + s * 0.13) % 1 + 1) % 1);
      const x = spout.x + vx * u;
      const y = spout.y + vy * u + 0.5 * g * u * u;
      drawDrop(ctx, x, y, 2.6, Math.atan2(vy + g * u, vx) + Math.PI / 2);
    }
    if (s === 0) {
      const lx = spout.x + vx * total;
      ctx.globalAlpha = 0.8 * flow;
      for (let i = 0; i < 4; i += 1) {
        const p = ((t * 3 + i * 0.25) % 1 + 1) % 1;
        drawDrop(ctx, lx - 14 + i * 9 + (i % 2 ? 6 : -6) * p, ground - 6 - 18 * Math.sin(Math.PI * p), 2, 0);
      }
      ctx.globalAlpha = 0.35 * flow;
      ctx.fillStyle = '#4e7f93';
      ctx.beginPath(); ctx.ellipse(lx, ground - 4, 16 + 6 * flow, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
