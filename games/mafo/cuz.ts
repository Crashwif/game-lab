/**
 * Cuz: Junior's cousin, the player, in a webbed lawn chair at the left of the kitchen, seen side on, a beer in hand
 * and a cooler by his chair. As the multiplier climbs he armours up: sunglasses at 2×, oven mitts at 3.2×, a
 * motorcycle helmet at 6× and a fire extinguisher in his lap at 15×. An accepted cash-out is him going to get ice:
 * he stands, takes the cooler, walks out through the living room and the front door, down the steps and crouches
 * behind the pickup. At the crash, unless he has gone, the blast throws him across the yard still in the chair.
 * Every pose is a closed form of the round's numbers and the clocks the scene passes in; nothing here reads or
 * changes the committed outcome.
 */
import { CHAIR, DOOR, HIDE, STEPS, TRAILER } from './layout';
import { blit, blob, box, ink, INK, limb, poly } from './ink';
import { type Joint, solveLimb, walkingFoot } from './kinematics';
import { clamp, mix, smoothstep } from './motion';
import { drawBeerCan } from './still';

const SKIN = '#f2c9a2';
const FLANNEL = '#b8352c';
const DENIM = '#3f5f8f';
const CAMO = '#5f6a3a';
const THIGH = 76;
const SHIN = 80;
const UPPER = 42;
const FORE = 40;
/** Seated hip and the standing hip height above the floor. */
const SEAT_HIP = { x: CHAIR.x - 18, y: CHAIR.seat - 8 } as const;
const WALK_V = 430;
const STRIDE = 66;

/** The gear he has on: keyed to the displayed multiplier, so a late entry dresses him the same. */
export interface Gear { shades: boolean; mitts: boolean; helmet: boolean; extinguisher: boolean }
export const gearAt = (multiplier: number): Gear => ({ shades: multiplier >= 2, mitts: multiplier >= 3.2, helmet: multiplier >= 6, extinguisher: multiplier >= 15 });

// ─── The walk out ───────────────────────────────────────────────────────────────────────────────────────────────
/** The exit's beats, in seconds since the cash-out was confirmed. */
export const EXIT_AT = { stand: 0.45, turn: 0.55, door: 1.75, out: 2.05, steps: 2.6, hide: 3.3, crouched: 3.65 } as const;
const DOOR_X = (DOOR.x0 + DOOR.x1) / 2;
const STEP_X = (STEPS.x0 + STEPS.x1) / 2;
/** How far he has walked by `e` seconds into the exit (a ramp up to walking pace, never a jump). */
function walked(e: number): number {
  const t = Math.max(0, e - EXIT_AT.turn);
  const tau = 0.18;
  return WALK_V * (t - tau * (1 - Math.exp(-t / tau)));
}
const INSIDE_RUN = SEAT_HIP.x - DOOR_X;
const STEPS_RUN = 160;
const YARD_RUN = DOOR_X - HIDE.x;

/** Where his hip is on the walk out and which way he faces: x, ground y, facing (1 right, −1 left). */
export function exitSpot(e: number): { x: number; ground: number; facing: number; walked: number; phase: 'seated' | 'inside' | 'steps' | 'yard' | 'hid' } {
  if (e < EXIT_AT.turn) return { x: SEAT_HIP.x, ground: TRAILER.floor, facing: 1, walked: 0, phase: e < EXIT_AT.stand * 0.5 ? 'seated' : 'inside' };
  const w = walked(e);
  if (w < INSIDE_RUN) return { x: SEAT_HIP.x - w, ground: TRAILER.floor, facing: -1, walked: w, phase: 'inside' };
  if (w < INSIDE_RUN + STEPS_RUN) {
    // Out of the doorway and down the steps, toward us.
    const k = (w - INSIDE_RUN) / STEPS_RUN;
    return { x: mix(DOOR_X, STEP_X - 20, k), ground: mix(TRAILER.floor, TRAILER.ground + 12, k), facing: -1, walked: w, phase: 'steps' };
  }
  const yard = Math.min(YARD_RUN, w - INSIDE_RUN - STEPS_RUN);
  const done = w - INSIDE_RUN - STEPS_RUN >= YARD_RUN;
  return { x: mix(STEP_X - 20, HIDE.x, yard / YARD_RUN), ground: mix(TRAILER.ground + 12, HIDE.ground, yard / YARD_RUN), facing: -1, walked: Math.min(w, INSIDE_RUN + STEPS_RUN + YARD_RUN), phase: done ? 'hid' : 'yard' };
}
/** Seconds into the exit when he is crouched behind the truck. */
export const EXIT_DONE = (() => {
  for (let e = 0; e < 12; e += 0.01) if (exitSpot(e).phase === 'hid') return e + 0.3;
  return 6;
})();
/** The front door's swing for the walk out: open as he reaches it, shut behind him. */
export const doorAt = (e: number | null): number => {
  if (e === null) return 0;
  const spot = exitSpot(e);
  const reach = INSIDE_RUN - 80;
  const w = spot.walked;
  return smoothstep(reach, reach + 60, w) * (1 - smoothstep(INSIDE_RUN + STEPS_RUN + 40, INSIDE_RUN + STEPS_RUN + 160, w));
};

// ─── Pose ───────────────────────────────────────────────────────────────────────────────────────────────────────
export interface CuzPose {
  hip: Joint;
  shoulder: Joint;
  head: Joint;
  /** 1 facing right (at Junior), −1 facing left (walking out). */
  facing: number;
  feet: [Joint, Joint];
  knees: [Joint, Joint] | null;
  /** The near hand (the beer or the cooler) and the far hand. */
  near: Joint;
  far: Joint;
  sip: number;
  cooler: boolean;
  crouch: number;
  talk: number;
}

export interface CuzDrive {
  time: number;
  tension: number;
  multiplier: number;
  /** Seconds since his accepted exit, or null while he sits. */
  exit: number | null;
  /** How hard he is talking, 0..1. */
  talking: number;
  /** A sip of his beer: 0..1 through the sip, or −1. */
  sip: number;
  /** Seconds since the boom while crouched behind the truck (he ducks, then peeks), or −1. */
  duck: number;
}

/** His pose: seated (a nervous jiggle that grows), standing, walking, or crouched behind the truck. */
export function cuzPose(d: CuzDrive): CuzPose {
  const e = d.exit;
  const jiggle = Math.sin(d.time * (6 + 10 * d.tension)) * 1.6 * d.tension;
  if (e === null || e < EXIT_AT.stand * 0.5) {
    const hip = { x: SEAT_HIP.x, y: SEAT_HIP.y };
    const lean = -6 + 10 * d.tension;
    const shoulder = { x: hip.x - 8 + lean * 0.3, y: hip.y - 100 };
    const head = { x: shoulder.x + 10 + lean * 0.4, y: shoulder.y - 38 };
    const knee = { x: hip.x + THIGH, y: hip.y - 4 };
    const foot = { x: knee.x + 14 + jiggle, y: TRAILER.floor - 4 };
    const sip = clamp(d.sip, 0, 1);
    const lift = sip > 0 ? Math.sin(Math.PI * sip) : 0;
    const near = { x: mix(hip.x + 50, head.x + 16, lift), y: mix(hip.y - 20, head.y + 14, lift) };
    return { hip, shoulder, head, facing: 1, feet: [foot, { x: foot.x - 8, y: foot.y }], knees: [knee, { x: knee.x - 6, y: knee.y }], near, far: { x: hip.x + 18, y: hip.y - 34 }, sip: lift, cooler: false, crouch: 0, talk: d.talking };
  }
  const spot = exitSpot(e);
  const rise = smoothstep(EXIT_AT.stand * 0.3, EXIT_AT.stand, e);
  const hidK = smoothstep(EXIT_DONE - 0.35, EXIT_DONE, e);
  const duck = d.duck >= 0 ? smoothstep(0, 0.12, d.duck) * (1 - smoothstep(2.6, 3.1, d.duck)) : 0;
  const crouch = Math.max(hidK * 0.5, duck);
  const ground = spot.ground;
  const standY = ground - THIGH - SHIN + 6;
  const hipY = mix(mix(SEAT_HIP.y, standY, rise), ground - 70, crouch);
  const hip = { x: spot.x, y: hipY };
  const facing = rise < 0.5 && e < EXIT_AT.turn ? 1 : spot.facing;
  const lean = facing * (spot.phase === 'inside' || spot.phase === 'yard' ? 8 : 2) + facing * 20 * crouch;
  const shoulder = { x: hip.x + lean, y: hip.y - 100 + 28 * crouch };
  const head = { x: shoulder.x + facing * (8 + 14 * crouch), y: shoulder.y - 38 + 6 * crouch };
  // Feet: planted while standing, the gait while walking.
  const dist = spot.walked;
  const a = walkingFoot(dist, STRIDE, 0, 12);
  const b = walkingFoot(dist, STRIDE, 0.5, 12);
  const walking = spot.phase === 'inside' || spot.phase === 'yard' || spot.phase === 'steps';
  const feet: [Joint, Joint] = walking
    ? [{ x: hip.x - facing * a.x, y: ground + a.y }, { x: hip.x - facing * b.x, y: ground + b.y }]
    : [{ x: hip.x + facing * (10 + 24 * crouch), y: ground }, { x: hip.x - facing * (10 + 10 * crouch), y: ground }];
  const swing = walking ? Math.sin((dist / STRIDE) * Math.PI * 2) : 0;
  const near = { x: shoulder.x + facing * 18 + swing * 10, y: shoulder.y + 70 };
  const far = crouch > 0.5 ? { x: shoulder.x + facing * 44, y: shoulder.y + 10 - 20 * duck } : { x: shoulder.x - swing * 10, y: shoulder.y + 74 };
  return { hip, shoulder, head, facing, feet, knees: null, near, far, sip: 0, cooler: e > EXIT_AT.stand * 0.6, crouch, talk: d.talking };
}

/** Whether he is behind the living room's front wall (drawn before it), out in the yard, or in the kitchen. */
export function cuzLayer(e: number | null): 'kitchen' | 'behind' | 'outside' {
  if (e === null) return 'kitchen';
  const spot = exitSpot(e);
  if (spot.phase === 'steps' || spot.phase === 'yard' || spot.phase === 'hid') return 'outside';
  return spot.x < -20 ? 'behind' : 'kitchen';
}

// ─── Drawing ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The webbed lawn chair: an aluminium frame and green and white webbing. Drawn at its seat's front-left. */
export function drawChair(ctx: CanvasRenderingContext2D, x: number, seat: number, angle = 0): void {
  ctx.save();
  ctx.translate(x, seat);
  ctx.rotate(angle);
  ctx.translate(-x, -seat);
  // Painted once at its place in the kitchen, then moved with the transform.
  ctx.translate(x - CHAIR.x, seat - CHAIR.seat);
  blit(ctx, 'chair', CHAIR.x - 90, CHAIR.seat - 134, 170, TRAILER.floor - CHAIR.seat + 140, (g) => chair(g, CHAIR.x, CHAIR.seat));
  ctx.restore();
}
function chair(ctx: CanvasRenderingContext2D, x: number, seat: number): void {
  ctx.save();
  const x0 = x - 52;
  const x1 = x + 52;
  // Back legs and back.
  ink(ctx, 4, '#a9afb6');
  ctx.beginPath();
  ctx.moveTo(x0 + 4, seat);
  ctx.lineTo(x0 - 6, TRAILER.floor);
  ctx.moveTo(x1 - 4, seat);
  ctx.lineTo(x1 + 4, TRAILER.floor);
  ctx.moveTo(x0, seat);
  ctx.lineTo(x0 - 18, seat - 110);
  ctx.stroke();
  // Webbing: the back and the seat.
  for (let i = 0; i < 5; i += 1) {
    const c = i % 2 ? '#f2f0e8' : '#3f8f4f';
    poly(ctx, [x0 - 3 - i * 3.4, seat - 18 - i * 20, x0 + 6 - i * 3.4, seat - 18 - i * 20, x0 + 3 - (i + 1) * 3.4, seat - 34 - i * 20, x0 - 6 - (i + 1) * 3.4, seat - 34 - i * 20], c, 1.2);
  }
  for (let i = 0; i < 5; i += 1) box(ctx, x0 + i * 20, seat - 6, 18, 10, 2, i % 2 ? '#f2f0e8' : '#3f8f4f', 1.2);
  // The armrest.
  ink(ctx, 4, '#a9afb6');
  ctx.beginPath();
  ctx.moveTo(x0 - 10, seat - 44);
  ctx.lineTo(x1 - 12, seat - 44);
  ctx.lineTo(x1 - 8, seat);
  ctx.stroke();
  ctx.restore();
}

/** The cooler by the chair (or in his hand). */
export function drawCooler(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  box(ctx, x - 30, y - 40, 60, 40, 6, '#c8372d', 2.5);
  box(ctx, x - 32, y - 46, 64, 10, 4, '#f4efe2', 2.2);
  box(ctx, x - 10, y - 52, 20, 6, 2, '#f4efe2', 1.8);
}

/** The head, side on: a backwards camo cap (or the helmet), the eye (or the shades), a goatee, the mouth. */
function head(ctx: CanvasRenderingContext2D, p: CuzPose, gear: Gear, time: number, soot = 0): void {
  const { x, y } = p.head;
  const f = p.facing;
  const r = 22;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(f, 1);
  if (gear.helmet) {
    // The helmet: a big shell with a smoked visor up front.
    blob(ctx, 0, 0, r + 9, r + 8, '#1f6fd0', 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-8, -14, 10, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    poly(ctx, [4, -12, r + 10, -10, r + 8, 12, 4, 10], 'rgba(30, 30, 40, 0.85)', 2);
    // A straw through the visor, into the beer.
    ink(ctx, 2, '#ffd23f');
    ctx.beginPath();
    ctx.moveTo(r + 6, 6);
    ctx.lineTo(r + 22, 24);
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Mullet? No: a ponytail out the back of the cap.
  blob(ctx, -r + 2, 10, 7, 12, '#7a5a34', 2);
  blob(ctx, 0, 0, r, r, soot > 0.5 ? '#3a302a' : SKIN, 2.5);
  // Nose, ear, goatee.
  blob(ctx, r - 1, 4, 6, 5, soot > 0.5 ? '#3a302a' : SKIN, 2);
  blob(ctx, -4, 2, 5, 7, SKIN, 1.8);
  poly(ctx, [r - 12, 16, r - 2, 15, r - 6, 30], '#7a5a34', 1.8);
  // The eye, or the shades.
  if (gear.shades) {
    box(ctx, 6, -9, 18, 9, 3, '#15131c', 2);
    ink(ctx, 2, '#15131c');
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(-6, -4);
    ctx.stroke();
  } else {
    blob(ctx, 12, -4, 4, 4, '#fbf8f2', 1.4);
    blob(ctx, 13.5, -4, 1.8, 1.8, INK, 0);
  }
  // The mouth: a line, open when he talks.
  const open = p.talk > 0.1 ? 2 + 3 * Math.abs(Math.sin(time * 12)) : 0;
  ctx.fillStyle = '#5a2228';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.ellipse(r - 8, 13, 5, 1 + open, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The cap, backwards: the bill out over his neck.
  ctx.fillStyle = CAMO;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-r - 2, -2);
  ctx.quadraticCurveTo(-r, -r - 6, 2, -r - 6);
  ctx.quadraticCurveTo(r + 2, -r - 4, r + 2, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [bx, by] of [[-8, -16], [6, -20], [-2, -8]] as const) blob(ctx, bx, by, 5, 3, '#3d4426', 0);
  poly(ctx, [-r - 2, -6, -r - 22, -2, -r - 20, 4, -r, 2], CAMO, 2.2);
  if (soot > 0) {
    ctx.fillStyle = `rgba(30, 24, 22, ${0.6 * soot})`;
    ctx.beginPath();
    ctx.ellipse(4, 4, r - 2, r - 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A hand: a plain one, or a quilted oven mitt. */
function hand(ctx: CanvasRenderingContext2D, at: Joint, mitt: boolean): void {
  if (mitt) {
    box(ctx, at.x - 11, at.y - 10, 22, 20, 8, '#e04b3a', 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(at.x - 8, at.y - 2, 16, 2);
  } else blob(ctx, at.x, at.y, 7, 6.5, SKIN, 2);
}

/** Cuz, whole: legs, torso, arms, head, his beer, the cooler on the walk, the gear. */
export function drawCuz(ctx: CanvasRenderingContext2D, p: CuzPose, gear: Gear, time: number, soot = 0): void {
  const f = p.facing;
  // The far arm first.
  const farRoot = { x: p.shoulder.x - f * 4, y: p.shoulder.y + 6 };
  const farArm = solveLimb(farRoot, p.far, UPPER, FORE, f);
  limb(ctx, [farRoot, farArm.joint, farArm.end], 11, '#d9ae8a', 2.2);
  hand(ctx, farArm.end, gear.mitts);
  // Legs: seated (thighs out, shins down) or standing and walking (two-bone to the feet).
  for (let i = 0; i < 2; i += 1) {
    const hipJ = { x: p.hip.x + (i === 0 ? 4 : -4) * f, y: p.hip.y + 4 };
    const foot = p.feet[i]!;
    let knee: Joint;
    let end: Joint;
    if (p.knees) {
      knee = p.knees[i]!;
      end = foot;
    } else {
      const s = solveLimb(hipJ, foot, THIGH, SHIN, -f);
      knee = s.joint;
      end = s.end;
    }
    limb(ctx, [hipJ, knee, end], 19, i === 0 ? DENIM : '#36547e', 2.5);
    box(ctx, end.x - 12 + f * 6, end.y - 8, 26, 12, 5, '#f2f2ee', 2);
  }
  // Torso: the flannel with its sleeves torn off, over a white tee.
  ctx.save();
  const mid = { x: (p.hip.x + p.shoulder.x) / 2, y: (p.hip.y + p.shoulder.y) / 2 };
  const ang = Math.atan2(p.shoulder.y - p.hip.y, p.shoulder.x - p.hip.x) + Math.PI / 2;
  ctx.translate(mid.x, mid.y);
  ctx.rotate(ang);
  const len = Math.hypot(p.shoulder.x - p.hip.x, p.shoulder.y - p.hip.y);
  box(ctx, -22, -len / 2 - 6, 44, len + 16, 14, FLANNEL, 2.5);
  ctx.fillStyle = 'rgba(30, 20, 20, 0.35)';
  for (let k = -2; k <= 2; k += 1) ctx.fillRect(k * 9 - 1, -len / 2, 2.5, len + 6);
  ctx.fillRect(-22, -len / 4, 44, 3);
  ctx.fillRect(-22, len / 5, 44, 3);
  box(ctx, -8 * f, -len / 2 - 6, 16, 18, 4, '#f2efe6', 1.8);
  ctx.restore();
  // The extinguisher in his lap from 15×.
  if (gear.extinguisher && p.knees) {
    box(ctx, p.hip.x + 18, p.hip.y - 70, 22, 60, 8, '#d8302a', 2.2);
    box(ctx, p.hip.x + 22, p.hip.y - 82, 14, 12, 2, '#2a2a2a', 1.8);
  }
  // The near arm: the beer (seated), the cooler (walking out).
  const nearRoot = { x: p.shoulder.x + f * 4, y: p.shoulder.y + 8 };
  const nearArm = solveLimb(nearRoot, p.near, UPPER, FORE, -f);
  limb(ctx, [nearRoot, nearArm.joint, nearArm.end], 12, SKIN, 2.4);
  if (p.cooler) drawCooler(ctx, nearArm.end.x + f * 4, nearArm.end.y + 40);
  else drawBeerCan(ctx, nearArm.end.x + f * 2, nearArm.end.y - 6, p.sip * -1.2 * f, 0.9);
  hand(ctx, nearArm.end, gear.mitts);
  head(ctx, p, gear, time, soot);
}

/** The YOU tag over his head, and after the exit what he did. */
export function drawYouTag(ctx: CanvasRenderingContext2D, at: Joint, text: string, colour: string): void {
  ctx.save();
  ctx.font = '900 13px Impact, "Arial Black", sans-serif';
  const w = ctx.measureText(text).width + 14;
  box(ctx, at.x - w / 2, at.y - 30, w, 20, 6, colour, 2);
  ctx.fillStyle = '#0c1022';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, at.x, at.y - 19.5);
  poly(ctx, [at.x - 6, at.y - 10.5, at.x + 6, at.y - 10.5, at.x, at.y - 3], colour, 2);
  ctx.restore();
}

// ─── The blast ──────────────────────────────────────────────────────────────────────────────────────────────────
/** Where the chair (with him in it) comes down in the yard, by the landing slot the scene picks. */
const SPOTS = [{ x: 170, y: 990 }, { x: 1190, y: 960 }, { x: 600, y: 1050 }] as const;
const CHAIR_T = 1.45;
/** The chair's flight after the boom, ending upright with a bounce; `slot` picks the spot. */
export function chairFlight(slot: number, u: number): { x: number; y: number; angle: number; landed: boolean } {
  const spot = SPOTS[slot % SPOTS.length]!;
  const x0 = CHAIR.x;
  const y0 = CHAIR.seat;
  if (u < CHAIR_T) {
    const k = u / CHAIR_T;
    const apex = -700;
    // A parabola from the seat through the apex height to the spot.
    const y = mix(y0, spot.y, k) - 4 * (mix(y0, spot.y, 0.5) - apex) * k * (1 - k);
    return { x: mix(x0, spot.x, k), y, angle: Math.sin(k * Math.PI) * (slot % 2 ? 2.4 : -2.4) * (1 - k) + 0, landed: false };
  }
  const t = u - CHAIR_T;
  const bounce = Math.abs(Math.sin(t * 9)) * 50 * Math.exp(-t * 5);
  return { x: spot.x, y: spot.y - bounce, angle: Math.sin(t * 9) * 0.12 * Math.exp(-t * 4), landed: true };
}
export const CHAIR_LAND = CHAIR_T;
/** Where the chair comes down, for framing the aftermath. */
export const chairLanding = (slot: number): { x: number; y: number } => SPOTS[slot % SPOTS.length]!;
/** Cuz in the chair, flying or landed, sooty, beer still in hand. */
export function drawCuzFlying(ctx: CanvasRenderingContext2D, slot: number, u: number, gear: Gear, time: number, talk: number): Joint {
  const fl = chairFlight(slot, u);
  ctx.save();
  ctx.translate(fl.x - CHAIR.x, fl.y - CHAIR.seat);
  ctx.translate(CHAIR.x, CHAIR.seat);
  ctx.rotate(fl.angle);
  ctx.translate(-CHAIR.x, -CHAIR.seat);
  drawChair(ctx, CHAIR.x, CHAIR.seat);
  const p = cuzPose({ time, tension: 0, multiplier: 1, exit: null, talking: talk, sip: -1, duck: -1 });
  drawCuz(ctx, p, gear, time, smoothstep(0, 0.3, u));
  ctx.restore();
  return { x: fl.x - CHAIR.x + p.head.x, y: fl.y - CHAIR.seat + p.head.y };
}
