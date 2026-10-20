/**
 * The skater: a side-view stride rig. Each stroke pushes off the back skate
 * and glides on the front one, the arms swing opposite, the torso leans into
 * the speed and a scarf trails on a chain of eased links. Strokes follow the
 * distance she covers, so the blades never stroke in place. An accepted exit
 * carves her toward the far shore; the crash catches her braking, then drops
 * her through the ice to bob up on her own buoyancy.
 */
import { type Spring, clamp, fract, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { ICE_FAR_Y, ICE_NEAR_Y, type Point } from './ice';

export type SkaterMode = 'idle' | 'skating' | 'toShore' | 'shore' | 'plunge' | 'swimming';
/** Depth across the lake, 0 at the near bank and 1 at the far shore; where she skates. */
export const HOME_DEPTH = 0.24;
const INK = '#1c1f26';
const SKIN = '#f3dccb';
const SKIN_SHADE = '#e0bda7';
const JACKET = '#e63946';
const JACKET_DARK = '#b8283f';
const TROUSERS = '#2b3a55';

/** World px covered per full stroke cycle, a little longer at speed. */
const strideLength = (speed: number): number => 165 + 25 * clamp((speed - 120) / 200, 0, 1);
/** How high she floats in the hole (px below the ice) once the plunge has spent itself. */
const FLOAT = 52;

/** Screen y of the ice under a depth, and how big things there look. */
export const iceY = (depth: number): number => ICE_NEAR_Y - 8 - depth * (ICE_NEAR_Y - 8 - ICE_FAR_Y);
export const iceScale = (depth: number): number => 1 - 0.42 * depth;

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

export interface SkaterDrive {
  /** World speed she is asked to hold. */
  speed: number;
  fear: number;
}

export interface SkaterState {
  mode: SkaterMode;
  time: number;
  modeAge: number;
  /** World x. */
  x: number;
  depth: Spring;
  speed: number;
  stride: number;
  lean: Spring;
  scarf: Point[];
  eyeOpen: Spring;
  mouthOpen: Spring;
  mouthCurve: Spring;
  brow: Spring;
  blinkAt: number;
  shades: Spring;
  wave: Spring;
  plunge: number;
  plungeV: number;
  fear: number;
  /** She felt the ice go: brakes hard, crouches and throws her arms out until it gives. */
  braced: boolean;
  brace: Spring;
  /** Last world position on the ice: where the break happens if she is safe on the bank. */
  lastIce: Point;
  events: { push: -1 | 0 | 1 };
}

export function createSkater(): SkaterState {
  return {
    mode: 'idle', time: 0, modeAge: 0, x: 0, depth: spring(HOME_DEPTH), speed: 0, stride: 0, lean: spring(0.05),
    scarf: Array.from({ length: 6 }, (_, i) => ({ x: 320 - i * 10, y: 380 })),
    eyeOpen: spring(1), mouthOpen: spring(0.05), mouthCurve: spring(0.25), brow: spring(0), blinkAt: 2.4, shades: spring(0), wave: spring(0),
    plunge: 0, plungeV: 0, fear: 0, braced: false, brace: spring(0), lastIce: { x: 0, y: iceY(HOME_DEPTH) }, events: { push: -1 },
  };
}

function setMode(s: SkaterState, mode: SkaterMode): void {
  s.mode = mode;
  s.modeAge = 0;
}

export function resetSkater(s: SkaterState): void {
  setMode(s, 'idle');
  settleSpring(s.depth, HOME_DEPTH);
  s.speed = 0;
  settleSpring(s.lean, 0.05);
  settleSpring(s.shades, 0);
  settleSpring(s.wave, 0);
  s.plunge = 0;
  s.plungeV = 0;
  s.braced = false;
  settleSpring(s.brace, 0);
  s.lastIce = { x: s.x, y: iceY(HOME_DEPTH) };
}

/** A new round: she heads back out to her mark, down off the bank or up out of the water, rather than jumping there. */
export function rejoinSkater(s: SkaterState): void {
  setMode(s, 'idle');
  s.braced = false;
  s.lastIce = { x: s.x, y: iceY(HOME_DEPTH) };
}

/** A crash met late: already floating in the hole, past the dunk. */
export function settleSwimming(s: SkaterState): void {
  setMode(s, 'swimming');
  s.modeAge = 2;
  s.plunge = FLOAT;
  s.plungeV = 0;
  s.speed = 0;
  s.braced = false;
  settleSpring(s.brace, 0);
}

/**
 * Jumps to the state a late joiner would see: out on the ice at the asked speed (`out`), or already on the
 * bank in her shades once her exit was accepted (`safe`). A crash she was out for is then iceBroke's to play.
 */
export function settleSkater(s: SkaterState, out: boolean, safe: boolean, drive: SkaterDrive): void {
  resetSkater(s);
  if (safe) {
    setMode(s, 'shore');
    s.modeAge = 2.5; // past the wave she gives on reaching the bank
    settleSpring(s.depth, 1);
    settleSpring(s.lean, 0);
    settleSpring(s.shades, 1);
    settleSpring(s.wave, 0.2);
    s.lastIce = { x: s.x, y: iceY(0.95) };
  } else if (out) {
    setMode(s, 'skating');
    s.speed = drive.speed;
    settleSpring(s.lean, 0.1 + 0.3 * clamp(drive.speed / 320, 0, 1));
  }
}

/** The exit was accepted: carve for the shore. */
export function headForShore(s: SkaterState): void {
  if (s.mode === 'skating' || s.mode === 'idle') setMode(s, 'toShore');
}

/** The ice snapped round her: she brakes and braces for the few frames before it gives. */
export function brace(s: SkaterState): void {
  if (s.mode === 'skating' || s.mode === 'idle') s.braced = true;
}

/** The ice gave way: what is left of her speed carries into the plunge. */
export function iceBroke(s: SkaterState): void {
  if (s.mode === 'skating' || s.mode === 'idle') {
    setMode(s, 'plunge');
    s.plungeV = 40;
    s.braced = false;
  } else if (s.mode === 'toShore') {
    // Accepted exits remain safe; finish the visible carve instead of teleporting to shore.
    s.wave.v += 1;
  } else if (s.mode === 'shore') {
    s.wave.v += 6;
  }
}

/** Foot position through the stride, in hip-relative units: glide under the hip, push out behind, swing forward. */
export function legPose(u: number): { x: number; y: number; onIce: boolean } {
  u = fract(u);
  if (u < 0.45) return { x: mix(8, -8, u / 0.45), y: 52, onIce: true };
  if (u < 0.65) {
    const t = smoothstep(0, 1, (u - 0.45) / 0.2);
    return { x: mix(-8, -40, t), y: 52, onIce: true };
  }
  const t = (u - 0.65) / 0.35;
  return { x: mix(-40, 8, smoothstep(0, 1, t)), y: 52 - 16 * Math.sin(Math.PI * t), onIce: false };
}

/** Where her rearmost blade's heel will be `seconds` from now at her current speed, relative to her hip, in her own units. */
export function rearBlade(s: SkaterState, seconds: number): number {
  const u = s.stride + (s.speed * seconds) / strideLength(s.speed);
  return Math.min(legPose(u).x, legPose(u + 0.5).x) - 10;
}

type Mood = 'calm' | 'nervous' | 'panic' | 'shock' | 'smug' | 'cold';
const FACES: Record<Mood, { eye: number; open: number; curve: number; brow: number }> = {
  calm: { eye: 1, open: 0.05, curve: 0.3, brow: 0 },
  nervous: { eye: 1.1, open: 0.12, curve: -0.25, brow: 0.6 },
  panic: { eye: 1.35, open: 0.55, curve: -0.55, brow: 1 },
  shock: { eye: 1.7, open: 1, curve: 0.05, brow: 1 },
  smug: { eye: 0.75, open: 0.08, curve: 0.75, brow: -0.4 },
  cold: { eye: 0.9, open: 0.25, curve: -0.6, brow: 0.8 },
};

/**
 * For standing still: a foot still in the air finishes its swing and comes down, so both blades are on the ice. Only
 * forward, so a stroke never plays backward.
 */
function standStride(s: SkaterState, dt: number): void {
  const u = fract(s.stride);
  const down = u < 0.15 || (u >= 0.5 && u < 0.65);
  s.stride += ((down ? s.stride : s.stride - u + (u < 0.5 ? 0.5 : 1)) - s.stride) * (1 - Math.exp(-dt * 5));
}

/** Steps the plunge depth as a spring, so the water catches her rather than stopping her dead. */
function floatTo(s: SkaterState, target: number, omega: number, zeta: number, dt: number): void {
  const body = { x: s.plunge, v: s.plungeV };
  stepSpring(body, target, omega, zeta, dt);
  s.plunge = body.x;
  s.plungeV = body.v;
}

export function stepSkater(s: SkaterState, drive: SkaterDrive, dt: number): void {
  s.time += dt;
  s.modeAge += dt;
  s.fear = drive.fear;
  s.events.push = -1;
  const before = s.stride;
  const speedNorm = clamp(s.speed / 320, 0, 1);
  switch (s.mode) {
    case 'idle':
      // Between rounds she drifts back to her mark: down off the bank, or up out of the refreezing hole.
      s.speed *= Math.exp(-dt / 0.3);
      stepSpring(s.depth, HOME_DEPTH, 2.4, 1, dt);
      floatTo(s, 0, 4.5, 1, dt);
      stepSpring(s.shades, 0, 10, 1, dt);
      stepSpring(s.wave, 0, 6, 1, dt);
      stepSpring(s.lean, (s.braced ? -0.12 : 0.05) + Math.sin(s.time * 1.3) * 0.02, 6, 0.8, dt);
      standStride(s, dt);
      break;
    case 'skating':
      // Speed eases in over a few tenths of a second; braced, she stops almost dead in the fuse.
      s.speed += ((s.braced ? 0 : drive.speed) - s.speed) * (1 - Math.exp(-dt / (s.braced ? 0.08 : 0.4)));
      s.stride += (s.speed * dt) / strideLength(s.speed);
      s.x += s.speed * dt;
      stepSpring(s.lean, s.braced ? -0.12 : 0.1 + 0.3 * speedNorm, s.braced ? 20 : 8, 0.7, dt);
      s.lastIce = { x: s.x, y: iceY(s.depth.x) };
      break;
    case 'toShore':
      s.speed += (0 - s.speed) * (1 - Math.exp(-dt / 1.4));
      s.stride += (s.speed * dt) / strideLength(s.speed);
      s.x += s.speed * dt;
      stepSpring(s.depth, 1, 1.3, 1, dt);
      stepSpring(s.lean, 0.08, 8, 0.7, dt);
      if (s.depth.x < 0.95) s.lastIce = { x: s.x, y: iceY(s.depth.x) };
      if (s.depth.x >= 0.97) setMode(s, 'shore');
      break;
    case 'shore':
      s.speed *= Math.exp(-dt / 0.25);
      s.x += s.speed * dt;
      standStride(s, dt);
      stepSpring(s.depth, 1, 4, 1, dt);
      stepSpring(s.lean, 0, 8, 0.7, dt);
      stepSpring(s.shades, 1, 12, 0.5, dt);
      stepSpring(s.wave, s.modeAge < 2.5 ? 1 : 0.2 + Math.sin(s.time * 1.5) * 0.15, 6, 0.6, dt);
      break;
    case 'plunge':
      // What speed the brake left her carries on into the water and dies away there.
      s.speed *= Math.exp(-dt / 0.3);
      s.x += s.speed * dt;
      s.plungeV += 600 * dt;
      s.plunge += s.plungeV * dt;
      stepSpring(s.lean, -0.1, 8, 0.7, dt);
      if (s.plunge >= 40) setMode(s, 'swimming');
      break;
    case 'swimming':
      // Buoyancy: the dunk overshoots under, she bobs back up, and the shivering bob fades in once she settles.
      s.speed *= Math.exp(-dt / 0.3);
      s.x += s.speed * dt;
      floatTo(s, FLOAT + Math.sin(s.modeAge * 3) * 3 * smoothstep(0.6, 1.6, s.modeAge), 7, 0.35, dt);
      stepSpring(s.lean, Math.sin(s.time * 14) * 0.04, 10, 0.5, dt);
      break;
  }
  stepSpring(s.brace, s.braced ? 1 : 0, s.braced ? 30 : 8, s.braced ? 0.7 : 1, dt);
  // A push is the stroke passing 0.45 going forward (a wrap counts); a stroke that holds or settles pushes nothing.
  if (s.stride > before) {
    const u0 = fract(before);
    const u1 = fract(s.stride);
    if ((u0 < 0.45 && u1 >= 0.45) || (u1 < u0 && u1 >= 0.45)) { s.events.push = 0; s.lean.v += 0.5; }
    const v0 = fract(before + 0.5);
    const v1 = fract(s.stride + 0.5);
    if ((v0 < 0.45 && v1 >= 0.45) || (v1 < v0 && v1 >= 0.45)) { s.events.push = 1; s.lean.v += 0.5; }
  }

  const mood: Mood = s.mode === 'plunge' || s.braced ? 'shock' : s.mode === 'swimming' ? (s.modeAge < 1.4 ? 'shock' : 'cold') : s.mode === 'shore' || s.mode === 'toShore' ? 'smug' : drive.fear > 0.62 ? 'panic' : drive.fear > 0.25 ? 'nervous' : 'calm';
  const face = FACES[mood];
  const blinking = s.time > s.blinkAt && s.time < s.blinkAt + 0.13;
  if (s.time >= s.blinkAt + 0.13) s.blinkAt = s.time + 2.2 + 2.6 * noise(s.blinkAt);
  stepSpring(s.eyeOpen, blinking && mood !== 'shock' ? 0.08 : face.eye, 26, 0.9, dt);
  stepSpring(s.mouthOpen, face.open, 14, 0.8, dt);
  stepSpring(s.mouthCurve, face.curve, 10, 0.8, dt);
  stepSpring(s.brow, face.brow, 12, 0.75, dt);
}

/** How far she is into the water pose: eased in over the first instant of the plunge, eased out as she climbs out. */
export function wetness(s: SkaterState): number {
  if (s.mode === 'plunge') return smoothstep(0, 0.12, s.modeAge);
  return s.mode === 'swimming' ? 1 : clamp(s.plunge / 40, 0, 1);
}

/** Contacts stay in the ice frame; only the pelvis bobs above them. Braced, both blades plant in a wide crouch. */
export function skaterFooting(s: SkaterState) {
  const inWater = s.mode === 'plunge' || s.mode === 'swimming';
  const wet = wetness(s);
  const braced = clamp(s.brace.x, 0, 1);
  const legs = [legPose(s.stride), legPose(s.stride + 0.5)];
  const order = legs[0]!.x < legs[1]!.x ? [0, 1] : [1, 0];
  // Only a full brace plants the blades: a flinch (a near miss) moves her arms and hips but never slides a skate.
  const planted = smoothstep(0.5, 1, braced);
  const feet = legs.map((p, i) => {
    const plant = i === order[1] ? 14 : -20;
    const dry = { x: mix(p.x, plant, planted), y: mix(p.y - 52, 0, planted) };
    const tucked = i === 0 ? { x: -14, y: -12 } : { x: 12, y: -8 };
    return { x: mix(dry.x, tucked.x, wet), y: mix(dry.y, tucked.y, wet) };
  });
  let hipY = -52 - 3 * Math.abs(Math.sin(Math.PI * 2 * s.stride)) * clamp(s.speed / 320, 0, 1) + 12 * braced;
  // Lower the pelvis as needed rather than lengthening the shin at full extension.
  for (const [depth, i] of order.entries()) {
    const dx = feet[i]!.x - (depth === 0 ? -4 : 4);
    hipY = Math.max(hipY, feet[i]!.y - Math.sqrt(Math.max(1, 67.9 ** 2 - dx * dx)));
  }
  return { hip: { x: 0, y: hipY }, feet, order, legs, inWater };
}

/** Where a foot is on screen, for spray and trails; `which` is 0 or 1. */
export function footScreen(s: SkaterState, which: 0 | 1, screenX: number, screenY: number, scale: number): { x: number; y: number; onIce: boolean } {
  const pose = skaterFooting(s);
  const foot = pose.feet[which]!;
  return { x: screenX + foot.x * scale, y: screenY + (foot.y + s.plunge) * scale, onIce: !pose.inWater && pose.legs[which]!.onIce };
}

/** Advances the scarf links after the body has been placed, so they trail the neck. */
export function stepScarf(s: SkaterState, neck: Point, dt: number): void {
  const speedNorm = clamp(s.speed / 320, 0, 1);
  let prev = neck;
  for (let i = 0; i < s.scarf.length; i += 1) {
    const link = s.scarf[i]!;
    const target = { x: prev.x - 9 - 7 * speedNorm, y: prev.y + 2.5 - 1.5 * speedNorm + Math.sin(s.time * 11 + i * 1.3) * (1 + 2 * speedNorm) };
    const k = 1 - Math.exp(-dt * (22 - i * 2));
    if (dt === 0 || Math.hypot(link.x - target.x, link.y - target.y) > 200) { link.x = target.x; link.y = target.y; }
    else { link.x += (target.x - link.x) * k; link.y += (target.y - link.y) * k; }
    prev = link;
  }
}

export interface SkaterPlacement { x: number; y: number; scale: number }

/** Draws her at a screen position; returns the neck position for the scarf. */
export function drawSkater(ctx: CanvasRenderingContext2D, s: SkaterState, at: SkaterPlacement, withScarf: boolean): Point {
  const speedNorm = clamp(s.speed / 320, 0, 1);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(at.scale, at.scale);
  ctx.translate(0, s.plunge);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const { hip, feet, order } = skaterFooting(s);
  function segment(a: Point, b: Point, width: number, colour: string) {
    ctx.strokeStyle = colour; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function limb(root: Point, end: Point, upper: number, lower: number, side: number, width: number, colour: string): Point {
    const joint = bendJoint(root, end, upper, lower, side);
    segment(root, joint, width + 4, INK); segment(joint, end, width + 4, INK);
    segment(root, joint, width, colour); segment(joint, end, width, colour);
    return joint;
  }
  function skate(foot: Point, back: boolean) {
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(foot.x - 9, foot.y - 9, 20, 11, [3, 6, 4, 3]); ctx.fill(); ctx.stroke();
    segment({ x: foot.x - 10, y: foot.y + 3 }, { x: foot.x + 12, y: foot.y + 3 }, 2.5, back ? '#9aa3ad' : '#d0d5dc');
  }
  // Legs in the unleaned frame so the skates stay on the ice; the far leg first.
  for (const i of order) {
    const foot = feet[i]!;
    const back = i === order[0];
    limb({ x: hip.x + (back ? -4 : 4), y: hip.y }, foot, 34, 34, -1, back ? 11 : 13, back ? '#22304a' : TROUSERS);
    skate(foot, back);
  }
  // Torso leans into the speed.
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(s.lean.x);
  const shoulder: Point = { x: 0, y: -44 };
  const swing = Math.sin(Math.PI * 2 * s.stride) * (0.45 + 0.55 * speedNorm);
  const wave = clamp(s.wave.x, 0, 1);
  // Dry arms swing with the stroke, braced arms are thrown out for balance, wet ones flail overhead; blended between.
  const wet = wetness(s);
  const braced = clamp(s.brace.x, 0, 1);
  const pose = (dry: Point, out: Point, flail: Point): Point => ({ x: mix(mix(dry.x, out.x, braced), flail.x, wet), y: mix(mix(dry.y, out.y, braced), flail.y, wet) });
  const handBack = pose({ x: -30 * swing, y: -22 + 10 * swing }, { x: -38, y: -54 }, { x: -26 - Math.sin(s.time * 9) * 6, y: -70 });
  const handFront = pose({ x: mix(30 * swing, 26, wave), y: mix(-22 - 10 * swing, -72, wave) }, { x: 40, y: -58 }, { x: 28 + Math.cos(s.time * 9) * 6, y: -68 });
  limb({ x: -3, y: -40 }, handBack, 24, 24, 1, 9, JACKET_DARK);
  segment({ x: 0, y: 0 }, shoulder, 30, INK);
  segment({ x: 0, y: -3 }, shoulder, 26, JACKET);
  ctx.strokeStyle = JACKET_DARK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-2, -38); ctx.stroke();
  segment(shoulder, { x: 4, y: -58 }, 12, INK);
  segment(shoulder, { x: 4, y: -58 }, 9, SKIN);
  // Head: hair, earmuffs, face.
  const head: Point = { x: 5, y: -66 };
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(-s.lean.x * 0.5);
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 15, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = SKIN; ctx.fill();
  ctx.fillStyle = '#6b3f23';
  ctx.beginPath(); ctx.ellipse(-2, -9, 13, 7, -0.2, Math.PI, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, -6); ctx.quadraticCurveTo(-22, 6, -12, 14); ctx.lineTo(-11, -4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-10, -14); ctx.quadraticCurveTo(0, -20, 10, -14); ctx.stroke();
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath(); ctx.arc(-11, -2, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const eyes = [{ x: 3, y: -3 }, { x: 9, y: -3.5 }];
  const eyeOpen = Math.max(0.08, s.eyeOpen.x);
  for (const eye of eyes) {
    ctx.beginPath(); ctx.ellipse(eye.x, eye.y, 2.6, 2.6 * Math.min(1.3, eyeOpen), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(eye.x + 0.8, eye.y + 0.3, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  const brow = s.brow.x;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -7 + brow * 0.6); ctx.lineTo(6, -7.5 - brow * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7, -8 - brow * 2); ctx.lineTo(12, -7.5 + brow * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(13, 3); ctx.lineTo(10, 4.5); ctx.stroke();
  const open = clamp(s.mouthOpen.x, 0, 1);
  const curve = s.mouthCurve.x;
  ctx.globalAlpha = clamp(1 - open * 3, 0, 1);
  ctx.beginPath(); ctx.moveTo(3, 8 - curve * 1.5); ctx.quadraticCurveTo(7, 8 + curve * 4, 11, 8 - curve * 1.5); ctx.stroke();
  ctx.globalAlpha = 1;
  if (open > 0.12) {
    ctx.beginPath(); ctx.ellipse(7, 9 + open, 2.2 + 2.5 * open, 1 + 4 * open, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.stroke();
  }
  if (s.mode === 'skating' && s.fear > 0.3) {
    const p = (s.time / 1.1) % 1;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(-6, -8 + 12 * p * p, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const shades = clamp(s.shades.x, 0, 1);
  if (shades > 0.02) {
    const dy = -40 * (1 - shades);
    ctx.fillStyle = INK;
    ctx.fillRect(0, -6 + dy, 6, 4);
    ctx.fillRect(7, -6 + dy, 6, 4);
    ctx.fillRect(-2, -5 + dy, 3, 1.5);
  }
  ctx.restore();
  ctx.restore();
  // Front arm over the torso, in the leaned frame.
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(s.lean.x);
  const elbow = limb({ x: 3, y: -40 }, handFront, 24, 24, 1, 10, JACKET);
  void elbow;
  for (const [hand, colour] of [[handBack, SKIN_SHADE], [handFront, SKIN]] as const) {
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = colour; ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  // The neck in screen space, for the scarf.
  const cos = Math.cos(s.lean.x);
  const sin = Math.sin(s.lean.x);
  const neckLocal = { x: -2, y: -50 };
  const neck = { x: at.x + (hip.x + neckLocal.x * cos - neckLocal.y * sin) * at.scale, y: at.y + (hip.y + s.plunge + neckLocal.x * sin + neckLocal.y * cos) * at.scale };
  if (withScarf && s.scarf.length) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 8 * at.scale;
    ctx.beginPath(); ctx.moveTo(neck.x, neck.y); for (const l of s.scarf) ctx.lineTo(l.x, l.y); ctx.stroke();
    ctx.strokeStyle = '#e63946'; ctx.lineWidth = 5 * at.scale; ctx.stroke();
    ctx.strokeStyle = '#f4f4f4'; ctx.setLineDash([7 * at.scale, 6 * at.scale]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  return neck;
}
