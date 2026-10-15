/**
 * The man in black on his BMX: a side-view rig facing right. The wheels and the crank turn with distance
 * (never time), the legs pedal on two-bone IK from the hip to the pedals, the far hand holds the bars and
 * the near hand points the gun at the reticle, solved in screen space. Lean, squat, nod and recoil are
 * springs; `riderPose` is pure, so a late entry or a replay draws the same frame. Nothing here knows about
 * the round: the scene decides where the bike is, how high it hops and what it is aiming at.
 */
import { type Joint, solveLimb } from './kinematics';
import { type Spring, clamp, mix, settleSpring, spring, stepSpring } from './motion';

/** Bike geometry in bike px: the origin is the road under the bottom bracket; y runs up as negative. */
export const WHEEL = 24;
export const REAR: Joint = { x: -46, y: -24 };
export const FRONT: Joint = { x: 50, y: -24 };
export const BB: Joint = { x: -6, y: -28 };
const SEAT: Joint = { x: -24, y: -66 };
const HEAD_TUBE_TOP: Joint = { x: 32, y: -74 };
const HEAD_TUBE_BOTTOM: Joint = { x: 40, y: -54 };
export const GRIP: Joint = { x: 28, y: -96 };
const HIP: Joint = { x: -12, y: -78 };
const SHOULDER: Joint = { x: 14, y: -116 };
const HEAD: Joint = { x: 30, y: -134 };
export const UPPER_LEG = 34, LOWER_LEG = 34, UPPER_ARM = 24, LOWER_ARM = 24;
/** The chainring turns the wheel this many times per crank turn. */
export const GEAR = 2.75;
export const CRANK = 15;
export const GUN_LENGTH = 17;
/** The gun arm reaches this far from the shoulder: a little short of straight, so the elbow keeps a bend. */
export const REACH = 44;

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
  kneeL: Joint; footL: Joint; kneeR: Joint; footR: Joint;
  /** The gun's hand, its angle, and the muzzle; null with both hands on the bars. */
  gun: { x: number; y: number; angle: number; flip: boolean } | null;
  muzzle: Joint | null;
  /** Where the eyes look, as a unit vector. */
  look: Joint;
  squat: number;
}

export function createRider(): RiderRig {
  return { time: 0, lean: spring(0), squat: spring(0), nod: spring(0), kick: spring(0), air: false, events: { land: false } };
}

const leanFor = (drive: RiderDrive): number => (drive.hop > 0 ? -0.6 : clamp(drive.speed / 350, 0, 1) * 0.35);

export function settleRider(rig: RiderRig, drive: RiderDrive): void {
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
  const lean = leanFor(drive);
  stepSpring(rig.lean, lean, 11, 0.7, dt);
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

export function riderPose(rig: RiderRig, drive: RiderDrive, frame: Frame): Pose {
  const wheel = drive.distance / WHEEL;
  const crank = wheel / GEAR;
  const lean = rig.lean.x;
  const squat = clamp(rig.squat.x, -4, 12);
  const nod = rig.nod.x;
  // The upper body sits back on a hop and forward with speed; the hip dips into a landing.
  const hip: Joint = { x: HIP.x - lean * 6, y: HIP.y + squat };
  const shoulder: Joint = { x: SHOULDER.x - lean * 14, y: SHOULDER.y + squat * 0.8 + Math.abs(lean) * 4 };
  const head: Joint = { x: HEAD.x - nod * 16, y: HEAD.y + squat * 0.7 + Math.abs(nod) * 5 };
  // The feet on the pedals; the near (right) crank is at `crank`, the far one half a turn on.
  const pedalR: Joint = { x: BB.x + CRANK * Math.cos(crank), y: BB.y + CRANK * Math.sin(crank) };
  const pedalL: Joint = { x: BB.x - CRANK * Math.cos(crank), y: BB.y - CRANK * Math.sin(crank) };
  const legR = solveLimb(hip, pedalR, UPPER_LEG, LOWER_LEG, 1);
  const legL = solveLimb(hip, pedalL, UPPER_LEG, LOWER_LEG, 1);
  // The far hand holds the bars, elbow back and out.
  const armL = solveLimb(shoulder, GRIP, UPPER_ARM, LOWER_ARM, -1);
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
    const armR = solveLimb(shoulder, { x: GRIP.x + 3, y: GRIP.y + 1 }, UPPER_ARM, LOWER_ARM, -1);
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
  black: '#0b0b10', cloth: '#15151c', rim: '#3d4150', chrome: '#c6ccd8', tire: '#1d1d22', tread: '#4a4a52', frame: '#2a1f3d', frameLight: '#5e4b86',
  skin: '#d9a582', eye: '#f6f6f8', pupil: '#0b0b10', gold: '#f2c14e', sole: '#e9e9ec', red: '#ff3b4f',
} as const;

function line(ctx: CanvasRenderingContext2D, a: Joint, b: Joint, width: number, color: string, cap: CanvasLineCap = 'round'): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** A limb as two strokes with a dark rim so black cloth reads against a dark street. */
function limb(ctx: CanvasRenderingContext2D, a: Joint, b: Joint, c: Joint, width: number): void {
  ctx.lineJoin = 'round';
  line(ctx, a, b, width + 3, INK.rim);
  line(ctx, b, c, width + 3, INK.rim);
  line(ctx, a, b, width, INK.cloth);
  line(ctx, b, c, width, INK.cloth);
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

/** The frame, bars, fork, chainring and chain, and the pedals and cranks. The wheels draw separately so a crash can shed them. */
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
  line(ctx, bb, pedal, 3.5, near ? INK.chrome : INK.rim);
  ctx.save();
  ctx.translate(pedal.x, pedal.y);
  ctx.rotate(pose.frame.angle);
  ctx.fillStyle = near ? INK.black : INK.rim;
  ctx.fillRect(-6, -1.5, 12, 3);
  ctx.restore();
}

export function drawWheels(ctx: CanvasRenderingContext2D, pose: Pose, blur: number): void {
  wheel(ctx, pose, REAR, blur);
  wheel(ctx, pose, FRONT, blur);
}

function shoe(ctx: CanvasRenderingContext2D, foot: Joint, angle: number): void {
  ctx.save();
  ctx.translate(foot.x, foot.y);
  ctx.rotate(angle);
  ctx.fillStyle = INK.sole;
  ctx.fillRect(-8, 1, 17, 3);
  ctx.fillStyle = INK.cloth;
  ctx.beginPath();
  ctx.moveTo(-8, 1); ctx.lineTo(-7, -5); ctx.lineTo(3, -6); ctx.lineTo(9, -1); ctx.lineTo(9, 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function glove(ctx: CanvasRenderingContext2D, hand: Joint): void {
  ctx.fillStyle = INK.cloth;
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 4.2, 0, Math.PI * 2);
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

/** The man in black, around the bike: far limbs first, then the bike's frame, the body, the near limbs and the gun. */
export function drawRider(ctx: CanvasRenderingContext2D, pose: Pose, look: RiderLook): void {
  const a = pose.frame.angle;
  // Far leg and far arm, behind everything.
  const bike = look.bike !== false;
  limb(ctx, pose.hip, pose.kneeL, pose.footL, 9);
  shoe(ctx, pose.footL, a + 0.15);
  if (bike) drawCrank(ctx, pose, false);
  limb(ctx, pose.shoulder, pose.elbowL, pose.handL, 7);
  glove(ctx, pose.handL);
  if (bike) drawFrame(ctx, pose);
  // The backpack, the hoodie, the chain and the hood.
  const dir = { x: pose.shoulder.x - pose.hip.x, y: pose.shoulder.y - pose.hip.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const n = { x: -dir.y / len, y: dir.x / len };
  const back = { x: pose.shoulder.x + n.x * 9, y: pose.shoulder.y + n.y * 9 };
  ctx.fillStyle = INK.black;
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(back.x - dir.x * 0.25, back.y - dir.y * 0.25, 9, 15, Math.atan2(dir.y, dir.x) + Math.PI / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK.cloth;
  ctx.beginPath();
  ctx.moveTo(pose.hip.x + n.x * 11, pose.hip.y + n.y * 11);
  ctx.lineTo(pose.shoulder.x + n.x * 15, pose.shoulder.y + n.y * 15);
  ctx.lineTo(pose.shoulder.x - n.x * 13, pose.shoulder.y - n.y * 13);
  ctx.lineTo(pose.hip.x - n.x * 10, pose.hip.y - n.y * 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // A gold chain, because of course.
  ctx.strokeStyle = INK.gold;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(pose.shoulder.x - n.x * 9, pose.shoulder.y - n.y * 9 + 2);
  ctx.quadraticCurveTo(pose.shoulder.x - n.x * 4 + dir.x * 0.02, pose.shoulder.y - n.y * 2 + 12, pose.shoulder.x + n.x * 3, pose.shoulder.y + n.y * 3 + 6);
  ctx.stroke();
  // The hood behind the head, then the balaclava and its eyes.
  const h = pose.head;
  ctx.fillStyle = INK.cloth;
  ctx.strokeStyle = INK.rim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pose.shoulder.x - 8, pose.shoulder.y + 2);
  ctx.quadraticCurveTo(h.x - 20, h.y - 12, h.x - 5, h.y - 19);
  ctx.quadraticCurveTo(h.x + 11, h.y - 22, h.x + 16, h.y - 7);
  ctx.lineTo(pose.shoulder.x + 12, pose.shoulder.y + 4);
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
    ctx.fillRect(back.x - 4, back.y - 2, 8, 4);
  }
  // Near leg, near crank and the gun arm in front.
  limb(ctx, pose.hip, pose.kneeR, pose.footR, 9);
  shoe(ctx, pose.footR, a + 0.15);
  if (bike) drawCrank(ctx, pose, true);
  limb(ctx, pose.shoulder, pose.elbowR, pose.handR, 7);
  glove(ctx, pose.handR);
  if (pose.gun) drawGun(ctx, pose.gun, look.flash);
}

/** The shadow under the bike, flatter and fainter the higher it hops. */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, groundY: number, hop: number, night: number): void {
  const lift = clamp(hop / 40, 0, 1);
  ctx.fillStyle = `rgba(0, 0, 0, ${mix(0.35, 0.12, lift) * mix(1, 0.6, night)})`;
  ctx.beginPath();
  ctx.ellipse(x + 2, groundY + 3, 62 * mix(1, 0.75, lift), 5 * mix(1, 0.6, lift), 0, 0, Math.PI * 2);
  ctx.fill();
}
