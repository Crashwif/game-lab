/**
 * The man in black on his BMX: a side-view rig facing right. The wheels and the crank turn with distance
 * (never time), the legs pedal on two-bone IK from the hips to ankles held just above the pedals, the far
 * hand holds the bars with the elbow out and the near hand points the gun at the reticle, solved in screen
 * space. He sits on the slammed saddle at rest and rises into a crouch over the bottom bracket as he gets
 * going. Stance, lean, squat, nod and recoil are springs; `riderPose` is pure, so a late entry or a replay
 * draws the same frame. Nothing here knows about the round: the scene decides where the bike is, how high
 * it hops and what it is aiming at.
 */
import { type Joint, solveLimb } from './kinematics';
import { type Spring, clamp, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';

/** Bike geometry in bike px: the origin is the road under the bottom bracket; y runs up as negative. */
export const WHEEL = 24;
export const REAR: Joint = { x: -46, y: -24 };
export const FRONT: Joint = { x: 50, y: -24 };
export const BB: Joint = { x: -6, y: -28 };
const SEAT: Joint = { x: -22, y: -60 };
const HEAD_TUBE_TOP: Joint = { x: 34, y: -70 };
const HEAD_TUBE_BOTTOM: Joint = { x: 42, y: -50 };
export const GRIP: Joint = { x: 40, y: -98 };
/** Seated on the saddle at rest; up in a crouch over the bottom bracket at speed. */
const SEATED = { hip: { x: -16, y: -70 }, shoulder: { x: 14, y: -116 }, head: { x: 32, y: -134 } };
const CROUCH = { hip: { x: -2, y: -88 }, shoulder: { x: 26, y: -126 }, head: { x: 42, y: -140 } };
export const UPPER_LEG = 36, LOWER_LEG = 36, UPPER_ARM = 22, LOWER_ARM = 22;
/** The ankle sits here relative to the pedal spindle, so the ball of the foot is on the pedal. */
export const ANKLE: Joint = { x: -3, y: -7 };
/** The far hip and far shoulder sit a little behind and below the near ones, for depth. */
export const FAR_HIP: Joint = { x: -3, y: 1 };
export const FAR_SHOULDER: Joint = { x: -4, y: 2 };
/** The chainring turns the wheel this many times per crank turn. */
export const GEAR = 2.75;
export const CRANK = 15;
export const GUN_LENGTH = 17;
/** The gun arm reaches this far from the shoulder: short of straight, so the elbow keeps a bend. */
export const REACH = 40;

export interface RiderDrive {
  distance: number;
  speed: number;
  /** Height off the road, px, and progress through the hop. */
  hop: number;
  hopU: number;
  /** The reticle on screen, or null for both hands on the bars. */
  aim: Joint | null;
}
export interface RiderRig {
  time: number;
  /** 0 seated, 1 crouched over the pedals. */
  stance: Spring;
  lean: Spring;
  squat: Spring;
  nod: Spring;
  kick: Spring;
  air: boolean;
  events: { land: boolean };
}
/** Where the bike's ground point is on screen and how the whole bike tilts. */
export interface Frame { x: number; y: number; angle: number }
export interface Pose {
  frame: Frame;
  wheel: number;
  crank: number;
  hip: Joint; shoulder: Joint; head: Joint;
  elbowL: Joint; handL: Joint; elbowR: Joint; handR: Joint;
  /** Knees and ankles; the shoes hang off the ankles onto the pedals. */
  kneeL: Joint; footL: Joint; kneeR: Joint; footR: Joint;
  /** The gun's hand, its angle, and the muzzle; null with both hands on the bars. */
  gun: { x: number; y: number; angle: number; flip: boolean } | null;
  muzzle: Joint | null;
  /** Where the eyes look, as a unit vector. */
  look: Joint;
  squat: number;
}

export function createRider(): RiderRig {
  return { time: 0, stance: spring(0), lean: spring(0), squat: spring(0), nod: spring(0), kick: spring(0), air: false, events: { land: false } };
}

const stanceFor = (drive: RiderDrive): number => smoothstep(20, 150, drive.speed);
const leanFor = (drive: RiderDrive): number => (drive.hop > 0 ? -0.6 : clamp(drive.speed / 350, 0, 1) * 0.35);

export function settleRider(rig: RiderRig, drive: RiderDrive): void {
  settleSpring(rig.stance, stanceFor(drive));
  settleSpring(rig.lean, leanFor(drive));
  settleSpring(rig.squat, 0);
  settleSpring(rig.nod, leanFor(drive));
  settleSpring(rig.kick, 0);
  rig.air = drive.hop > 0;
  rig.events.land = false;
}

export function stepRider(rig: RiderRig, drive: RiderDrive, dt: number): void {
  rig.events.land = false;
  if (dt <= 0) return;
  rig.time += dt;
  const air = drive.hop > 0;
  if (rig.air && !air) {
    // Landing: the rider squats into the pedals and the head dips after him.
    rig.squat.v += 70;
    rig.nod.v += 3;
    rig.events.land = true;
  }
  rig.air = air;
  stepSpring(rig.stance, stanceFor(drive), 4, 1, dt);
  stepSpring(rig.lean, leanFor(drive), 11, 0.7, dt);
  stepSpring(rig.squat, 0, 16, 0.5, dt);
  stepSpring(rig.nod, rig.lean.x, 13, 0.4, dt);
  stepSpring(rig.kick, 0, 26, 0.55, dt);
}

/** A shot: the gun arm kicks up and the body jerks. */
export function recoilRider(rig: RiderRig): void {
  rig.kick.v += 15;
  rig.nod.v -= 1.2;
}

/** Bike px to screen px through the frame: a rotation about the ground point, then a translation. */
export function toScreen(frame: Frame, p: Joint): Joint {
  const c = Math.cos(frame.angle), s = Math.sin(frame.angle);
  return { x: frame.x + p.x * c - p.y * s, y: frame.y + p.x * s + p.y * c };
}

/** The pedal spindle for a crank angle, in bike px. */
export const pedalAt = (crank: number): Joint => ({ x: BB.x + CRANK * Math.cos(crank), y: BB.y + CRANK * Math.sin(crank) });

export function riderPose(rig: RiderRig, drive: RiderDrive, frame: Frame): Pose {
  const wheel = drive.distance / WHEEL;
  const crank = wheel / GEAR;
  const stance = clamp(rig.stance.x, 0, 1);
  const lean = rig.lean.x;
  const squat = clamp(rig.squat.x, -4, 12);
  const nod = rig.nod.x;
  // Standing on the pedals rocks the hips a little with each stroke.
  const rock = stance * 1.5 * Math.sin(crank * 2);
  const hip: Joint = { x: mix(SEATED.hip.x, CROUCH.hip.x, stance) - lean * 5, y: mix(SEATED.hip.y, CROUCH.hip.y, stance) + squat + rock };
  const shoulder: Joint = { x: mix(SEATED.shoulder.x, CROUCH.shoulder.x, stance) - lean * 12, y: mix(SEATED.shoulder.y, CROUCH.shoulder.y, stance) + squat * 0.8 + rock * 0.6 + Math.abs(lean) * 4 };
  const head: Joint = { x: mix(SEATED.head.x, CROUCH.head.x, stance) - nod * 14, y: mix(SEATED.head.y, CROUCH.head.y, stance) + squat * 0.7 + rock * 0.5 + Math.abs(nod) * 5 };
  // The ankles ride just above the pedals; the near (right) crank is at `crank`, the far one half a turn on.
  const pedalR = pedalAt(crank);
  const pedalL = pedalAt(crank + Math.PI);
  // The solver bends toward the leg line's right-hand side, so a downward leg needs a negative pole for a forward knee.
  const legR = solveLimb(hip, { x: pedalR.x + ANKLE.x, y: pedalR.y + ANKLE.y }, UPPER_LEG, LOWER_LEG, -1);
  const legL = solveLimb({ x: hip.x + FAR_HIP.x, y: hip.y + FAR_HIP.y }, { x: pedalL.x + ANKLE.x, y: pedalL.y + ANKLE.y }, UPPER_LEG, LOWER_LEG, -1);
  // The far hand holds the bars, elbow back and out.
  const armL = solveLimb({ x: shoulder.x + FAR_SHOULDER.x, y: shoulder.y + FAR_SHOULDER.y }, GRIP, UPPER_ARM, LOWER_ARM, 1);
  const S = toScreen(frame, shoulder);
  let gun: Pose['gun'] = null;
  let muzzle: Joint | null = null;
  let elbowR: Joint, handR: Joint;
  let look: Joint = { x: 1, y: 0 };
  if (drive.aim) {
    // The near hand points the gun at the reticle, in screen space; the recoil kicks the arm up and back.
    let dx = drive.aim.x - S.x, dy = drive.aim.y - S.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
    look = { x: dx, y: dy };
    const up = dx >= 0 ? -1 : 1;
    const kick = clamp(rig.kick.x, -1, 1.5);
    const angle = Math.atan2(dy, dx) + up * kick * 0.38;
    const reach = REACH - kick * 5;
    const target: Joint = { x: S.x + Math.cos(angle) * reach, y: S.y + Math.sin(angle) * reach };
    const arm = solveLimb(S, target, UPPER_ARM, LOWER_ARM, 1);
    elbowR = arm.joint;
    handR = arm.end;
    const flip = dx < 0;
    gun = { x: handR.x, y: handR.y, angle, flip };
    muzzle = { x: handR.x + Math.cos(angle) * GUN_LENGTH, y: handR.y + Math.sin(angle) * GUN_LENGTH };
  } else {
    const armR = solveLimb(shoulder, { x: GRIP.x + 2, y: GRIP.y + 1 }, UPPER_ARM, LOWER_ARM, 1);
    elbowR = toScreen(frame, armR.joint);
    handR = toScreen(frame, armR.end);
  }
  return {
    frame, wheel, crank,
    hip: toScreen(frame, hip), shoulder: S, head: toScreen(frame, head),
    elbowL: toScreen(frame, armL.joint), handL: toScreen(frame, armL.end), elbowR, handR,
    kneeL: toScreen(frame, legL.joint), footL: toScreen(frame, legL.end), kneeR: toScreen(frame, legR.joint), footR: toScreen(frame, legR.end),
    gun, muzzle, look, squat,
  };
}

// ---- Drawing ---------------------------------------------------------------------------------------------------

export const INK = {
  black: '#0b0b10', cloth: '#16161e', clothFar: '#0e0e14', rim: '#454a5a', rimFar: '#2a2d39', chrome: '#c6ccd8', tire: '#1d1d22', tread: '#4a4a52', frame: '#2a1f3d', frameLight: '#5e4b86',
  skin: '#d9a582', eye: '#f6f6f8', pupil: '#0b0b10', gold: '#f2c14e', sole: '#e9e9ec', red: '#ff3b4f',
} as const;
interface Side { fill: string; rim: string }
const NEAR: Side = { fill: INK.cloth, rim: INK.rim };
const FAR: Side = { fill: INK.clothFar, rim: INK.rimFar };

function line(ctx: CanvasRenderingContext2D, a: Joint, b: Joint, width: number, color: string, cap: CanvasLineCap = 'round'): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** A tapered bone from `a` (width `wa`) to `b` (width `wb`) with round ends. */
function bonePath(ctx: CanvasRenderingContext2D, a: Joint, b: Joint, wa: number, wb: number): void {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * wa / 2, a.y + ny * wa / 2);
  ctx.lineTo(b.x + nx * wb / 2, b.y + ny * wb / 2);
  ctx.arc(b.x, b.y, wb / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(a.x - nx * wa / 2, a.y - ny * wa / 2);
  ctx.arc(a.x, a.y, wa / 2, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
}

/** A limb as two tapered bones with a dark rim all round, so black cloth reads against a dark street. */
function limb(ctx: CanvasRenderingContext2D, a: Joint, b: Joint, c: Joint, widths: [number, number, number], side: Side): void {
  ctx.fillStyle = side.rim;
  bonePath(ctx, a, b, widths[0] + 3, widths[1] + 3); ctx.fill();
  bonePath(ctx, b, c, widths[1] + 3, widths[2] + 3); ctx.fill();
  ctx.fillStyle = side.fill;
  bonePath(ctx, a, b, widths[0], widths[1]); ctx.fill();
  bonePath(ctx, b, c, widths[1], widths[2]); ctx.fill();
  // The joint's cap, a shade lighter, so the knee or elbow reads as a bend.
  ctx.fillStyle = side.rim;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(b.x, b.y, widths[1] * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function wheel(ctx: CanvasRenderingContext2D, pose: Pose, axle: Joint, blur: number): void {
  const c = toScreen(pose.frame, axle);
  ctx.save();
  ctx.translate(c.x, c.y);
  if (blur > 0) {
    ctx.strokeStyle = `rgba(200, 205, 215, ${0.25 * blur})`;
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-WHEEL - 6 - k * 9, -8 + k * 8);
      ctx.lineTo(-WHEEL - 26 - k * 12, -8 + k * 8);
      ctx.stroke();
    }
  }
  ctx.rotate(pose.frame.angle + pose.wheel);
  ctx.fillStyle = INK.tire;
  ctx.beginPath();
  ctx.arc(0, 0, WHEEL, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.tread;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([2.5, 3]);
  ctx.beginPath();
  ctx.arc(0, 0, WHEEL - 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK.black;
  ctx.beginPath();
  ctx.arc(0, 0, WHEEL - 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.chrome;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, WHEEL - 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = blur > 0.5 ? 0.55 : 1;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
    ctx.lineTo(Math.cos(a) * (WHEEL - 5), Math.sin(a) * (WHEEL - 5));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK.chrome;
  ctx.beginPath();
  ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The frame, bars, fork, chainring and chain. The wheels and cranks draw separately so a crash can shed them. */
export function drawFrame(ctx: CanvasRenderingContext2D, pose: Pose): void {
  const T = (p: Joint) => toScreen(pose.frame, p);
  ctx.lineJoin = 'round';
  // Tubes: a dark purple frame with a light edge.
  const tubes: [Joint, Joint][] = [[SEAT, HEAD_TUBE_TOP], [BB, HEAD_TUBE_BOTTOM], [BB, SEAT], [BB, REAR], [SEAT, REAR], [HEAD_TUBE_TOP, HEAD_TUBE_BOTTOM], [HEAD_TUBE_BOTTOM, FRONT]];
  for (const [a, b] of tubes) line(ctx, T(a), T(b), 5.5, INK.frameLight);
  for (const [a, b] of tubes) line(ctx, T(a), T(b), 3.5, INK.frame);
  // Tall bars with a crossbar and the grips.
  const stem: Joint = { x: HEAD_TUBE_TOP.x - 2, y: HEAD_TUBE_TOP.y - 4 };
  const barTop: Joint = { x: GRIP.x + 1, y: GRIP.y + 2 };
  line(ctx, T(stem), T(barTop), 3, INK.chrome);
  line(ctx, T({ x: barTop.x - 6, y: barTop.y + 10 }), T({ x: barTop.x + 6, y: barTop.y + 10 }), 2, INK.chrome);
  line(ctx, T({ x: GRIP.x - 4, y: GRIP.y }), T({ x: GRIP.x + 5, y: GRIP.y }), 5, INK.black);
  // The slammed saddle.
  const seat = T({ x: SEAT.x - 1, y: SEAT.y - 3 });
  ctx.save();
  ctx.translate(seat.x, seat.y);
  ctx.rotate(pose.frame.angle);
  ctx.fillStyle = INK.black;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Chainring, sprocket and the chain between them, in the crank's plane.
  const bb = T(BB), rear = T(REAR);
  ctx.strokeStyle = INK.chrome;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bb.x, bb.y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rear.x, rear.y, 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bb.x - 1, bb.y - 10); ctx.lineTo(rear.x, rear.y - 4.5);
  ctx.moveTo(bb.x - 1, bb.y + 10); ctx.lineTo(rear.x, rear.y + 4.5);
  ctx.stroke();
}

export function drawCrank(ctx: CanvasRenderingContext2D, pose: Pose, near: boolean): void {
  const bb = toScreen(pose.frame, BB);
  const a = pose.crank + (near ? 0 : Math.PI) + pose.frame.angle;
  const pedal: Joint = { x: bb.x + Math.cos(a) * CRANK, y: bb.y + Math.sin(a) * CRANK };
  line(ctx, bb, pedal, 3.5, near ? INK.chrome : INK.rimFar);
  ctx.save();
  ctx.translate(pedal.x, pedal.y);
  ctx.rotate(pose.frame.angle);
  ctx.fillStyle = near ? INK.black : INK.rimFar;
  ctx.fillRect(-6, -1.5, 12, 3);
  ctx.restore();
}

export function drawWheels(ctx: CanvasRenderingContext2D, pose: Pose, blur: number): void {
  wheel(ctx, pose, REAR, blur);
  wheel(ctx, pose, FRONT, blur);
}

/** A sneaker hanging off the ankle onto the pedal: heel back, toe forward, a white sole. */
function shoe(ctx: CanvasRenderingContext2D, ankle: Joint, angle: number, side: Side): void {
  ctx.save();
  ctx.translate(ankle.x, ankle.y);
  ctx.rotate(angle);
  ctx.fillStyle = side.rim;
  ctx.beginPath();
  ctx.moveTo(-9, -3); ctx.lineTo(-9, 8); ctx.lineTo(13, 9); ctx.lineTo(13, 4); ctx.lineTo(5, -3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = side.fill;
  ctx.beginPath();
  ctx.moveTo(-7, -2); ctx.lineTo(-7, 6); ctx.lineTo(11, 7); ctx.lineTo(11, 4); ctx.lineTo(4, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = side === NEAR ? INK.sole : '#9a9aa2';
  ctx.beginPath();
  ctx.moveTo(-8, 5); ctx.lineTo(12, 6); ctx.lineTo(12, 8.5); ctx.lineTo(-8, 7.5);
  ctx.closePath();
  ctx.fill();
  // Laces.
  ctx.strokeStyle = side.rim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, 0); ctx.lineTo(3, 1); ctx.moveTo(-1, 2); ctx.lineTo(4, 3);
  ctx.stroke();
  ctx.restore();
}

function glove(ctx: CanvasRenderingContext2D, hand: Joint, side: Side): void {
  ctx.fillStyle = side.fill;
  ctx.strokeStyle = side.rim;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawGun(ctx: CanvasRenderingContext2D, gun: NonNullable<Pose['gun']>, flash: number): void {
  ctx.save();
  ctx.translate(gun.x, gun.y);
  ctx.rotate(gun.angle);
  if (gun.flip) ctx.scale(1, -1);
  // A generic nine: slide, frame, grip, trigger guard. The legal team insists it is not a Glock.
  ctx.fillStyle = INK.black;
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.rect(-4, -5, GUN_LENGTH + 4, 5.5);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3, 0.5); ctx.lineTo(4, 0.5); ctx.lineTo(1, 9); ctx.lineTo(-6, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(5, 3, 3, 0, Math.PI);
  ctx.stroke();
  if (flash > 0) {
    const r = 8 + 10 * flash;
    const g = ctx.createRadialGradient(GUN_LENGTH + 4, -2, 0, GUN_LENGTH + 4, -2, r);
    g.addColorStop(0, `rgba(255, 255, 220, ${flash})`);
    g.addColorStop(0.5, `rgba(255, 190, 60, ${0.8 * flash})`);
    g.addColorStop(1, 'rgba(255, 120, 20, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(GUN_LENGTH, -2);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(GUN_LENGTH + 4 + Math.cos(a) * rr, -2 + Math.sin(a) * rr * 0.8);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export interface RiderLook { blur: number; flash: number; decoy: boolean; blink: number; tilt: number; /** False for a figure off the bike: no frame, no cranks. */ bike?: boolean }

/** The foot's tilt through the stroke: toes down past the bottom, heel down over the top. */
const ankling = (crank: number): number => 0.22 * Math.sin(crank) + 0.08;

/** The man in black, around the bike: far limbs first, then the bike's frame, the body, the near limbs and the gun. */
export function drawRider(ctx: CanvasRenderingContext2D, pose: Pose, look: RiderLook): void {
  const a = pose.frame.angle;
  const bike = look.bike !== false;
  // Far leg and far arm, behind everything.
  limb(ctx, { x: pose.hip.x + FAR_HIP.x, y: pose.hip.y + FAR_HIP.y }, pose.kneeL, pose.footL, [13, 10, 7], FAR);
  shoe(ctx, pose.footL, a + (bike ? ankling(pose.crank + Math.PI) : 0.2), FAR);
  if (bike) drawCrank(ctx, pose, false);
  limb(ctx, { x: pose.shoulder.x + FAR_SHOULDER.x, y: pose.shoulder.y + FAR_SHOULDER.y }, pose.elbowL, pose.handL, [9, 7, 6], FAR);
  glove(ctx, pose.handL, FAR);
  if (bike) drawFrame(ctx, pose);
  // The body: hips narrower than the shoulders, leaning into the bars.
  const dir = { x: pose.shoulder.x - pose.hip.x, y: pose.shoulder.y - pose.hip.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len, uy = dir.y / len;
  // `n` points to the rider's front.
  const n = { x: -uy, y: ux };
  const P = (along: number, across: number): Joint => ({ x: pose.hip.x + ux * along + n.x * across, y: pose.hip.y + uy * along + n.y * across });
  // The backpack on his back.
  ctx.fillStyle = INK.black;
  ctx.strokeStyle = INK.rimFar;
  ctx.lineWidth = 1.5;
  const pack = P(len * 0.55, -14);
  ctx.beginPath();
  ctx.ellipse(pack.x, pack.y, 9, 15, Math.atan2(uy, ux) + Math.PI / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The hoodie.
  ctx.fillStyle = INK.cloth;
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1.5;
  const hipBack = P(-4, -10), hipFront = P(-2, 9), shFront = P(len + 2, 13), shBack = P(len + 1, -13);
  ctx.beginPath();
  ctx.moveTo(hipBack.x, hipBack.y);
  ctx.quadraticCurveTo(P(len * 0.5, -15).x, P(len * 0.5, -15).y, shBack.x, shBack.y);
  ctx.lineTo(shFront.x, shFront.y);
  ctx.quadraticCurveTo(P(len * 0.45, 13).x, P(len * 0.45, 13).y, hipFront.x, hipFront.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The kangaroo pocket and the drawstrings.
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1;
  const p1 = P(len * 0.18, 9), p2 = P(len * 0.42, 11);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  for (const k of [-2, 3]) {
    const s0 = P(len - 4, k), s1 = P(len - 16, k + 4);
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    ctx.quadraticCurveTo(s0.x + 2, s0.y + 6, s1.x, s1.y);
    ctx.stroke();
  }
  // A gold chain, because of course.
  ctx.strokeStyle = INK.gold;
  ctx.lineWidth = 1.4;
  const c0 = P(len - 2, -6), c1 = P(len - 14, 4), c2 = P(len - 1, 10);
  ctx.beginPath();
  ctx.moveTo(c0.x, c0.y);
  ctx.quadraticCurveTo(c1.x, c1.y, c2.x, c2.y);
  ctx.stroke();
  // The neck, the hood behind the head, then the balaclava and its eyes.
  const h = pose.head;
  const neck = P(len + 6, 2);
  line(ctx, P(len, 0), neck, 9, INK.cloth);
  ctx.fillStyle = INK.cloth;
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(shBack.x - 2, shBack.y + 2);
  ctx.quadraticCurveTo(h.x - 22, h.y - 8, h.x - 6, h.y - 19);
  ctx.quadraticCurveTo(h.x + 12, h.y - 23, h.x + 17, h.y - 6);
  ctx.lineTo(shFront.x + 4, shFront.y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK.black;
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, 13, 14, a, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The eye slit: white eyes that follow the reticle, and blink.
  const lx = pose.look.x, ly = pose.look.y;
  const open = 1 - look.blink;
  ctx.fillStyle = '#2a2a33';
  ctx.beginPath();
  ctx.ellipse(h.x + 3, h.y - 2, 9.5, 3.4 * Math.max(0.25, open), a, 0, Math.PI * 2);
  ctx.fill();
  for (const ex of [-1.5, 7.5]) {
    const cx = h.x + ex + lx * 1.2, cy = h.y - 2 + ly * 0.6;
    ctx.fillStyle = INK.eye;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 2.6, 2.2 * open + 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK.pupil;
    ctx.beginPath();
    ctx.arc(cx + lx * 1.1, cy + ly * 0.8, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.decoy) {
    // The decoy is identical. That is the point. He does have a sticker.
    ctx.fillStyle = INK.red;
    ctx.fillRect(pack.x - 4, pack.y - 2, 8, 4);
  }
  // Near leg, near crank and the gun arm in front.
  limb(ctx, pose.hip, pose.kneeR, pose.footR, [14, 11, 8], NEAR);
  shoe(ctx, pose.footR, a + (bike ? ankling(pose.crank) : 0.2), NEAR);
  if (bike) drawCrank(ctx, pose, true);
  limb(ctx, pose.shoulder, pose.elbowR, pose.handR, [10, 8, 6], NEAR);
  if (pose.gun) drawGun(ctx, pose.gun, look.flash);
  glove(ctx, pose.handR, NEAR);
}

/** The shadow under the bike, flatter and fainter the higher it hops. */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, groundY: number, hop: number, night: number): void {
  const lift = clamp(hop / 40, 0, 1);
  ctx.fillStyle = `rgba(0, 0, 0, ${mix(0.35, 0.12, lift) * mix(1, 0.6, night)})`;
  ctx.beginPath();
  ctx.ellipse(x + 2, groundY + 3, 62 * mix(1, 0.75, lift), 5 * mix(1, 0.6, lift), 0, 0, Math.PI * 2);
  ctx.fill();
}
