/**
 * Memo: a landscaper with a leaf blower, running from the quota. The rig state and its springs, the pose
 * solver (two-bone limbs from world targets, a distance-driven gait), the modes (idle, run, cone, exit,
 * caught), the stumble, the face, the blower, the hat and the drawing. Everything here presents the round
 * the shell supplies; nothing reads, predicts or changes its outcome.
 */
import { INK, box, clamp, ease, line, noise, oval, shape, text } from './drawing';
import { type Spring, mix, settleSpring, spring, stepSpring } from './motion';

/** The sidewalk surface his feet stand on, and where he runs on screen. */
export const GROUND = 462;
export const HERO_X = 300;

export interface Point { x: number; y: number }
export interface Limb { root: Point; joint: Point; end: Point }

/** The law-of-cosines two-bone solver: both bone lengths are exact for every target, reachable or not. */
export function solveLimb(root: Point, target: Point, upper: number, lower: number, side: number): Limb {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const distance = Math.hypot(dx, dy);
  const direction = distance > 1e-8 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 1 };
  const reach = clamp(distance, Math.abs(upper - lower) + 0.001, upper + lower - 0.001);
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * (side < 0 ? -1 : 1);
  return {
    root,
    joint: { x: root.x + direction.x * along - direction.y * bend, y: root.y + direction.y * along + direction.x * bend },
    end: { x: root.x + direction.x * reach, y: root.y + direction.y * reach },
  };
}

/**
 * A foot by gait phase (in cycles) for a body moving toward `dir` (+1 right, −1 left): through the stance
 * half it slides back exactly as far as the body moves on, so it holds still on the ground; then it swings
 * forward with a lift. `x` is relative to the hip.
 */
export function gait(phase: number, stride: number, offset: number, lift: number, dir = 1) {
  const u = ((phase + offset) % 1 + 1) % 1;
  if (u < 0.5) return { x: dir * (stride / 4 - u * stride), lift: 0 };
  const s = (u - 0.5) * 2;
  return { x: dir * (-stride / 4 + ease(s) * stride / 2), lift: Math.sin(Math.PI * s) * lift };
}

export const strideFor = (speed: number) => clamp(speed * 0.22, 46, 100);

export type MemoMode = 'idle' | 'run' | 'cone' | 'mow' | 'exit' | 'caught';
export interface MemoDrive {
  mode: MemoMode;
  /** How fast the sidewalk goes by, px/s; his feet keep up with it. */
  speed: number;
  /** Nerves, 0..1. */
  tension: number;
  /** Something is looking: he glances over his shoulder. */
  alarm: number;
  /** Seconds into the exit or the raid. */
  age: number;
  chain: boolean;
  tejana: boolean;
}
interface Loose { off: boolean; x: number; y: number; vx: number; vy: number; rot: number; vr: number }
export interface MemoRig {
  x: number;
  time: number;
  /** Gait phase in cycles; the integral of speed / stride. */
  phase: number;
  stride: number;
  plants: number;
  bob: Spring; lean: Spring; crouch: Spring; cone: Spring; glance: Spring; lids: Spring;
  handsUp: Spring; phone: Spring; shades: Spring; bag: Spring; trip: Spring; idleSway: Spring; mow: Spring;
  /** Seconds into a stumble; −1 when he is on his feet. */
  stumble: number;
  hat: Loose;
  blower: Loose;
  nextBlink: number;
  events: { step: boolean; cone: boolean; trip: boolean; recovered: boolean; land: boolean };
}

/** The exit, in seconds after the accepted self-deportation. */
export const EXIT = { phone: 0.35, tap: 1.35, cash: 1.55, bag: 2.4, walk: 3.0, gone: 8 } as const;
const STUMBLE_S = 1.0;

const loose = (): Loose => ({ off: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0 });

export function createMemo(x = HERO_X): MemoRig {
  return {
    x, time: 0, phase: 0.3, stride: 60, plants: 0,
    bob: spring(0), lean: spring(0), crouch: spring(0), cone: spring(0), glance: spring(0), lids: spring(0),
    handsUp: spring(0), phone: spring(0), shades: spring(0), bag: spring(0), trip: spring(0), idleSway: spring(0), mow: spring(0),
    stumble: -1, hat: loose(), blower: loose(), nextBlink: 2.5,
    events: { step: false, cone: false, trip: false, recovered: false, land: false },
  };
}

export function resetMemo(rig: MemoRig): void {
  const fresh = createMemo(HERO_X);
  Object.assign(rig, fresh);
}

/** Begin a stumble (a spotted sweep): he trips, rolls, and the hat flies. Nothing else changes. */
export function stumble(rig: MemoRig): void {
  if (rig.stumble >= 0) return;
  rig.stumble = 0;
  rig.events.trip = true;
  rig.hat = { off: true, x: rig.x + 2, y: GROUND - 150, vx: 170, vy: -380, rot: 0, vr: 7 };
}

/** The crash knocks the blower out of his hands. */
export function dropBlower(rig: MemoRig, x: number, y: number, settled = false): void {
  if (rig.blower.off) return;
  rig.blower = settled ? { off: true, x: x + 46, y: GROUND - 9, vx: 0, vy: 0, rot: 0.35, vr: 0 } : { off: true, x, y, vx: 110, vy: -260, rot: 0, vr: 5 };
}

const targets = (rig: MemoRig, drive: MemoDrive) => {
  const m = drive.mode;
  const coned = m === 'cone' ? 1 : 0;
  const caught = m === 'caught' && drive.age >= 0 ? 1 : 0;
  const exit = m === 'exit';
  return {
    crouch: coned,
    cone: coned,
    handsUp: caught,
    phone: exit && drive.age >= EXIT.phone && drive.age < EXIT.bag ? 1 : 0,
    bag: exit && drive.age >= EXIT.bag ? 1 : 0,
    shades: exit && drive.age >= EXIT.cash ? 1 : 0,
    glance: clamp(drive.alarm) * (m === 'run' || m === 'cone' ? 1 : 0),
    mow: m === 'mow' ? 1 : 0,
    lean: 0,
  };
};

/** Jump straight to the pose the drive calls for: the first frame, a late entry, a missed edge. */
export function settleMemo(rig: MemoRig, drive: MemoDrive, travel = 0): void {
  const t = targets(rig, drive);
  settleSpring(rig.crouch, t.crouch); settleSpring(rig.cone, t.cone); settleSpring(rig.handsUp, t.handsUp);
  settleSpring(rig.phone, t.phone); settleSpring(rig.bag, t.bag); settleSpring(rig.shades, t.shades);
  settleSpring(rig.glance, t.glance); settleSpring(rig.lean, 0); settleSpring(rig.bob, 0); settleSpring(rig.trip, 0);
  settleSpring(rig.lids, 0); settleSpring(rig.idleSway, 0); settleSpring(rig.mow, t.mow);
  rig.stride = strideFor(Math.max(1, drive.speed));
  rig.phase = travel / rig.stride + 0.3;
  rig.plants = Math.floor(2 * rig.phase);
  rig.stumble = -1;
  rig.hat.off = false;
  rig.x = HERO_X + (drive.mode === 'exit' && drive.age > EXIT.walk ? 150 * (drive.age - EXIT.walk) : 0);
  if (drive.mode === 'caught') dropBlower(rig, rig.x, GROUND - 60, true);
  else rig.blower.off = false;
}

function fall(l: Loose, dt: number, scroll: number, floor: number): boolean {
  if (!l.off) return false;
  l.x += (l.vx - scroll) * dt;
  l.y += l.vy * dt;
  l.vy += 1300 * dt;
  l.rot += l.vr * dt;
  if (l.y >= floor) {
    const landed = l.vy > 60;
    l.y = floor;
    l.vy = l.vy > 80 ? -l.vy * 0.28 : 0;
    l.vx *= 0.4; l.vr *= 0.3;
    return landed;
  }
  return false;
}

export function stepMemo(rig: MemoRig, drive: MemoDrive, dt: number): void {
  rig.events = { step: false, cone: false, trip: false, recovered: false, land: false };
  if (dt <= 0) return;
  rig.time += dt;
  const t = targets(rig, drive);
  const m = drive.mode;
  const walking = m === 'exit' && drive.age >= EXIT.walk;
  const moving = (m === 'run' || m === 'cone' || m === 'mow') && rig.stumble < 0 ? 1 : walking ? 1 : 0;
  // Mowing walks in place behind the mower at its own pace; the sod goes by under him.
  const speed = walking ? 150 : m === 'mow' ? 90 : m === 'run' || m === 'cone' ? drive.speed : 0;
  // The stride follows the pace without jumping the gait: the phase is the integral of speed / stride.
  rig.stride += (strideFor(Math.max(1, speed)) * (m === 'cone' ? 0.55 : 1) - rig.stride) * (1 - Math.exp(-6 * dt));
  if (moving && speed > 1) {
    rig.phase += speed / rig.stride * dt;
    const plants = Math.floor(2 * rig.phase);
    if (plants !== rig.plants) rig.events.step = true;
    rig.plants = plants;
  }
  if (walking) rig.x += 150 * dt;
  // Stumble: trip, roll, recover, hat back on.
  if (rig.stumble >= 0) {
    const was = rig.stumble;
    rig.stumble += dt;
    if (was < 0.72 && rig.stumble >= 0.72) { rig.events.recovered = true; rig.hat.off = false; }
    if (rig.stumble >= STUMBLE_S) rig.stumble = -1;
  }
  const tripping = rig.stumble >= 0 && rig.stumble < 0.3 ? 1 : 0;
  stepSpring(rig.trip, tripping, 18, 0.7, dt);
  const prevCone = rig.cone.x;
  stepSpring(rig.crouch, t.crouch, 16, 0.75, dt);
  stepSpring(rig.cone, t.cone, 15, 0.42, dt);
  if (t.cone === 1 && prevCone < 0.5 && rig.cone.x >= 0.5) rig.events.cone = true;
  stepSpring(rig.handsUp, t.handsUp, 22, 0.55, dt);
  stepSpring(rig.phone, t.phone, 12, 0.6, dt);
  stepSpring(rig.bag, t.bag, 11, 0.5, dt);
  stepSpring(rig.shades, t.shades, 14, 0.5, dt);
  stepSpring(rig.glance, t.glance, 9, 0.7, dt);
  stepSpring(rig.mow, t.mow, 14, 0.6, dt);
  // Lean chases the acceleration of the pace; bob rides the stride.
  const leanTarget = m === 'caught' ? -0.12 : 0;
  stepSpring(rig.lean, leanTarget, 10, 0.8, dt);
  const bobTarget = moving && speed > 1 ? Math.abs(Math.sin(Math.PI * 2 * rig.phase)) * (2 + 4 * clamp(speed / 420)) : 0;
  stepSpring(rig.bob, bobTarget, 30, 1, dt);
  stepSpring(rig.idleSway, m === 'idle' ? Math.sin(rig.time * 1.4) : 0, 4, 1, dt);
  // Blinks, scheduled by noise, quicker when nervous.
  if (rig.time >= rig.nextBlink) { rig.lids.x = 1; rig.nextBlink = rig.time + 1.6 + noise(rig.time * 3.3) * 3 * (1 - 0.5 * drive.tension); }
  stepSpring(rig.lids, 0, 26, 1, dt);
  // Loose things fall through the world, which goes by at the pace.
  if (fall(rig.hat, dt, moving ? speed : 0, GROUND - 5)) rig.events.land = true;
  if (fall(rig.blower, dt, 0, GROUND - 9)) rig.events.land = true;
}

export interface MemoPose {
  hip: Point; shoulder: Point; head: Point; lean: number; crouch: number; cone: number; roll: number; glance: number;
  legs: [Limb, Limb]; arms: [Limb, Limb];
  blower: { x: number; y: number; rot: number; held: boolean };
  nozzle: Point;
  hat: { x: number; y: number; rot: number; on: boolean };
  phone: number; shades: number; bag: number; handsUp: number; trip: number; speedF: number; mow: number;
  mode: MemoMode;
}

/** Pure: springs and clocks to joints. The IK is solved here; the drawing only strokes what it gets. */
export function memoPose(rig: MemoRig, drive: MemoDrive): MemoPose {
  const m = drive.mode;
  const speedF = clamp((m === 'exit' && drive.age >= EXIT.walk ? 150 : m === 'mow' ? 90 : m === 'run' || m === 'cone' ? drive.speed : 0) / 420);
  const mow = clamp(rig.mow.x);
  const crouch = clamp(rig.crouch.x);
  const trip = clamp(rig.trip.x);
  const roll = rig.stumble >= 0.25 && rig.stumble < 0.75 ? Math.PI * 2 * ease((rig.stumble - 0.25) / 0.5) : 0;
  const handsUp = clamp(rig.handsUp.x);
  const phone = clamp(rig.phone.x);
  const bag = clamp(rig.bag.x);
  const glance = clamp(rig.glance.x) * (1 - crouch);
  const lean = 0.17 * speedF * (1 - crouch) + rig.lean.x + 0.6 * trip + 0.45 * crouch - 0.08 * handsUp;
  const tall = mix(58, 22, crouch) - (rig.stumble >= 0.25 && rig.stumble < 0.75 ? 16 : 0);
  const hip: Point = { x: rig.x + 3 * crouch + rig.idleSway.x * 3, y: GROUND - tall + rig.bob.x };
  const torso = 46 * (1 - 0.3 * crouch);
  const shoulder: Point = { x: hip.x + torso * Math.sin(lean), y: hip.y - torso * Math.cos(lean) };
  const head: Point = { x: shoulder.x + 5 * Math.cos(lean) + 26 * Math.sin(lean) - 6 * glance, y: shoulder.y + 5 * Math.sin(lean) - 26 * Math.cos(lean) + 3 * crouch };
  // Feet: the gait while he moves, planted under him while he stands, tucked through the roll.
  const lift = 8 + 11 * speedF;
  const stride = rig.stride;
  const moving = (m === 'run' || m === 'cone' || m === 'mow' || (m === 'exit' && drive.age >= EXIT.walk)) && rig.stumble < 0;
  const back = moving ? gait(rig.phase, stride, 0.5, lift) : { x: -9 + 4 * handsUp, lift: 0 };
  const front = moving ? gait(rig.phase, stride, 0, lift) : { x: 10 + 4 * handsUp, lift: 0 };
  const tuck = roll > 0 ? 1 : 0;
  const feet: [Point, Point] = [
    { x: mix(hip.x + back.x, hip.x - 8, Math.max(crouch * 0.6, tuck)), y: mix(GROUND - back.lift, hip.y + 16, tuck) },
    { x: mix(hip.x + front.x, hip.x + 10, Math.max(crouch * 0.6, tuck)), y: mix(GROUND - front.lift, hip.y + 16, tuck) },
  ];
  const legs: [Limb, Limb] = [solveLimb({ x: hip.x - 5, y: hip.y }, feet[0], 31, 31, -1), solveLimb({ x: hip.x + 5, y: hip.y }, feet[1], 31, 31, -1)];
  // Hands: the front one on the blower, the back one swinging; the modes pull them elsewhere.
  const sb: Point = { x: shoulder.x - 4, y: shoulder.y + 6 };
  const sf: Point = { x: shoulder.x + 4, y: shoulder.y + 6 };
  const swing = Math.sin(Math.PI * 2 * rig.phase);
  let backHand: Point = moving ? { x: sb.x - 8 - 20 * swing * (0.4 + 0.6 * speedF), y: sb.y + 30 - 6 * Math.abs(Math.cos(Math.PI * 2 * rig.phase)) * speedF } : { x: sb.x - 5, y: sb.y + 36 };
  let frontHand: Point = { x: hip.x + 24, y: hip.y - 4 + 6 * speedF };
  if (m === 'idle') frontHand = { x: hip.x + 20, y: hip.y + 2 };
  const pull = (a: Point, b: Point, k: number): Point => ({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k) });
  backHand = pull(backHand, { x: hip.x - 12, y: hip.y + 20 }, crouch);
  frontHand = pull(frontHand, { x: hip.x + 8, y: hip.y + 22 }, crouch);
  backHand = pull(backHand, { x: shoulder.x - 18, y: shoulder.y - 40 }, handsUp);
  frontHand = pull(frontHand, { x: shoulder.x + 16, y: shoulder.y - 44 }, handsUp);
  frontHand = pull(frontHand, { x: head.x + 14, y: head.y + 4 }, phone);
  backHand = pull(backHand, { x: hip.x - 16, y: hip.y + 4 }, bag);
  if (m === 'exit' && drive.age >= EXIT.bag) frontHand = pull(frontHand, { x: shoulder.x + 10, y: shoulder.y - 8 }, bag);
  // Both hands on the mower handle while he does the lawn.
  backHand = pull(backHand, { x: hip.x + 24, y: hip.y - 12 }, mow);
  frontHand = pull(frontHand, { x: hip.x + 32, y: hip.y - 6 }, mow);
  if (tuck) { backHand = { x: shoulder.x - 10, y: shoulder.y + 18 }; frontHand = { x: shoulder.x + 12, y: shoulder.y + 18 }; }
  const arms: [Limb, Limb] = [solveLimb(sb, backHand, 24, 24, 1), solveLimb(sf, frontHand, 24, 24, 1)];
  // The blower hangs from the front hand, rides his shoulder on the way out, or lies where it fell.
  const held = !rig.blower.off;
  const onShoulder = Math.max(m === 'exit' && drive.age >= EXIT.bag ? bag : 0, mow);
  const hand = arms[1].end;
  const blower = held
    ? { x: mix(hand.x + 4, shoulder.x - 2, onShoulder), y: mix(hand.y + 10, shoulder.y - 12, onShoulder), rot: mix(lean * 0.6 + 0.12 - 0.3 * phone, -1.25, onShoulder), held: true }
    : { x: rig.blower.x, y: rig.blower.y, rot: rig.blower.rot, held: false };
  const nozzle: Point = { x: blower.x - 56 * Math.cos(blower.rot) + 12 * Math.sin(blower.rot), y: blower.y - 56 * Math.sin(blower.rot) - 12 * Math.cos(blower.rot) };
  const hat = rig.hat.off ? { x: rig.hat.x, y: rig.hat.y, rot: rig.hat.rot, on: false } : { x: head.x - 1, y: head.y - 17, rot: lean * 0.5 - 0.15 * glance, on: true };
  return { hip, shoulder, head, lean, crouch, cone: clamp(rig.cone.x, 0, 1.3), roll, glance, legs, arms, blower, nozzle, hat, phone, shades: clamp(rig.shades.x), bag, handsUp, trip, speedF, mow, mode: m };
}

const SKIN = '#c98a5b', SKIN_DARK = '#a86f44', SHIRT = '#4d7fd1', SHIRT_DARK = '#3b62a8', VEST = '#ff9f1c', JEANS = '#3b4f8a', JEANS_DARK = '#2e3d6b', BOOT = '#7a4f2a';

export function drawBlower(c: CanvasRenderingContext2D, x: number, y: number, rot: number, blowing: number): void {
  c.save(); c.translate(x, y); c.rotate(rot);
  // The tube runs back and down from the housing; the nozzle flares.
  line(c, [[-8, 2], [-40, 8], [-56, 12]], INK, 13);
  line(c, [[-8, 2], [-40, 8], [-56, 12]], '#2f2f3a', 9);
  shape(c, [[-62, 4], [-52, 6], [-52, 18], [-62, 20]], '#2f2f3a', 3);
  oval(c, 0, 0, 17, 15, '#e8571d', 3);
  oval(c, 2, 0, 8, 7, '#3b3b47', 2);
  if (blowing > 0.01) { c.save(); c.globalAlpha = blowing; oval(c, 2, 0, 5 + 2 * Math.sin(Date.now() / 25), 4.5, '#ffd29a'); c.restore(); }
  box(c, -14, -24, 26, 10, '#f3a53a', 4, 3);
  line(c, [[-10, -19], [-10, -12]], INK, 4);
  c.restore();
}

function hatOn(c: CanvasRenderingContext2D, tejana: boolean) {
  if (tejana) {
    shape(c, [[-34, 4], [-30, -2], [-12, 0], [12, 0], [30, -2], [34, 4], [20, 7], [-20, 7]], '#f0dcb0', 3);
    box(c, -17, -20, 34, 22, '#f0dcb0', 8, 3);
    line(c, [[-14, -16], [0, -22], [14, -16]], '#c9ad7b', 3);
    box(c, -17, -3, 34, 5, '#7a4f2a', 2, 2);
  } else {
    oval(c, 0, 2, 26, 7, '#d9c38a', 3);
    box(c, -18, -19, 36, 22, '#d9c38a', 7, 3);
    box(c, -18, -5, 36, 6, '#7a8c5a', 2, 2);
  }
}

/** Draws him and returns the pose, so the scene can hang things on his head, hand and nozzle. */
export function drawMemo(c: CanvasRenderingContext2D, rig: MemoRig, drive: MemoDrive, time: number): MemoPose {
  const p = memoPose(rig, drive);
  const { hip, shoulder, head, lean } = p;
  c.save();
  if (p.roll !== 0) {
    const cx = hip.x, cy = hip.y - 8;
    const sq = 1 + 0.12 * Math.sin(p.roll);
    c.translate(cx, cy); c.rotate(p.roll); c.scale(sq, 1 / sq); c.translate(-cx, -cy);
  }
  oval(c, hip.x + 2, GROUND + 5, 30 * (1 - 0.3 * p.crouch), 6, '#15142b55');
  const limb = (l: Limb, color: string, width: number) => line(c, [[l.root.x, l.root.y], [l.joint.x, l.joint.y], [l.end.x, l.end.y]], color, width);
  const boot = (f: Point, back: boolean) => { c.save(); c.translate(f.x, f.y); box(c, -13, -8, 27, 11, back ? '#5f3d20' : BOOT, 4, 3); box(c, -13, 0, 27, 4, '#2d2a33', 2, 1); c.restore(); };
  // Back leg and arm, inked wide then coloured.
  limb(p.legs[0], INK, 16); limb(p.legs[0], JEANS_DARK, 11); boot(p.legs[0].end, true);
  limb(p.arms[0], INK, 14); limb(p.arms[0], SHIRT_DARK, 9); oval(c, p.arms[0].end.x, p.arms[0].end.y, 7, 7, SKIN_DARK, 2.5);
  // Torso: a plaid flannel under the hi-vis vest.
  c.save(); c.translate(hip.x, hip.y); c.rotate(lean);
  const th = 46 * (1 - 0.3 * p.crouch);
  box(c, -16, -th - 6, 32, th + 8, SHIRT, 9, 3);
  line(c, [[-16, -th + 8], [16, -th + 8]], SHIRT_DARK, 2); line(c, [[-4, -th - 4], [-4, 0]], SHIRT_DARK, 2);
  box(c, -18, -th - 4, 36, th * 0.92, VEST, 8, 3);
  line(c, [[-18, -th + 14], [18, -th + 14]], '#dfe6ec', 5); line(c, [[-18, -th + 28], [18, -th + 28]], '#dfe6ec', 5);
  line(c, [[-6, -th - 4], [-6, -th + 40]], '#1e1a2b88', 2);
  if (drive.chain) { c.beginPath(); c.strokeStyle = '#ffd34d'; c.lineWidth = 3; c.moveTo(-10, -th - 2); c.quadraticCurveTo(0, -th + 18, 10, -th - 2); c.stroke(); oval(c, 0, -th + 9, 4, 4, '#ffd34d', 1.5); }
  c.restore();
  if (p.blower.held) drawBlower(c, p.blower.x, p.blower.y, p.blower.rot, p.mode === 'run' && rig.stumble < 0 ? 1 : 0);
  // Front leg and arm.
  limb(p.legs[1], INK, 16); limb(p.legs[1], JEANS, 11); boot(p.legs[1].end, false);
  limb(p.arms[1], INK, 14); limb(p.arms[1], SHIRT, 9); oval(c, p.arms[1].end.x, p.arms[1].end.y, 7, 7, SKIN, 2.5);
  // The mower, when he is doing her lawn: the handle runs from his hands to the deck.
  if (p.mow > 0.01) {
    c.save(); c.globalAlpha = ease(p.mow); const mx = hip.x + 56, my = GROUND;
    line(c, [[p.arms[1].end.x, p.arms[1].end.y], [mx - 8, my - 18]], INK, 9); line(c, [[p.arms[1].end.x, p.arms[1].end.y], [mx - 8, my - 18]], '#b8bcc8', 5);
    box(c, mx - 22, my - 24, 46, 16, '#c2321e', 4, 3); box(c, mx - 10, my - 32, 14, 8, '#2d2a33', 2, 2);
    for (const w of [-14, 16]) { oval(c, mx + w, my - 6, 7, 7, '#1d2130', 2.5); oval(c, mx + w, my - 6, 2.5, 2.5, '#8e98a0', 1); }
    c.restore();
  }
  // The suitcase in the back hand on the way out.
  if (p.bag > 0.01) {
    const h = p.arms[0].end; c.save(); c.globalAlpha = ease(p.bag); c.translate(h.x, h.y + 4);
    box(c, -14, 0, 28, 36, '#8a5a3c', 4, 3); box(c, -5, -4, 10, 6, '#5a3a24', 2, 2); box(c, -9, 10, 10, 8, '#f3d35a', 1, 1.5); box(c, 2, 20, 9, 7, '#6fc1e4', 1, 1.5); c.restore();
  }
  // Head.
  c.save(); c.translate(head.x, head.y); c.rotate(lean * 0.35);
  const g = p.glance;
  oval(c, 0, 0, 20, 22, SKIN, 3);
  oval(c, -17 + 4 * g, 2, 4, 5, SKIN_DARK, 2);
  // Eyes look ahead, or back over the shoulder.
  const wide = 1 + 0.35 * drive.tension + (p.mode === 'caught' ? 0.5 : 0);
  const ex = 6 - 15 * g, ey = -4;
  for (const dx of [0, 10]) {
    oval(c, ex + dx - 4 * g, ey, 5 * wide, 5.5 * wide, '#fff8ec', 2);
    oval(c, ex + dx - 4 * g + (g > 0.5 ? -2 : 1.5), ey + 0.5, 2.2, 2.6, INK);
    c.save(); c.globalAlpha = clamp(rig.lids.x); oval(c, ex + dx - 4 * g, ey, 5.2 * wide, 5.7 * wide, SKIN); c.restore();
  }
  const brow = 0.5 * drive.tension + (p.mode === 'caught' ? 0.6 : 0);
  line(c, [[ex - 6, ey - 9 + 3 * brow], [ex + 3, ey - 10 - 2 * brow]], INK, 3);
  line(c, [[ex + 7, ey - 10 - 2 * brow], [ex + 16, ey - 9 + 3 * brow]], INK, 3);
  if (p.shades > 0.01) { c.save(); c.globalAlpha = p.shades; box(c, ex - 7, ey - 6, 12, 10, '#141420', 3, 2); box(c, ex + 7, ey - 6, 12, 10, '#141420', 3, 2); line(c, [[ex + 5, ey - 2], [ex + 7, ey - 2]], INK, 2); c.restore(); }
  // Nose, mustache, mouth.
  oval(c, ex + 6, ey + 8, 4, 3, SKIN_DARK, 2);
  shape(c, [[ex - 6, ey + 12], [ex + 6, ey + 10], [ex + 18, ey + 12], [ex + 14, ey + 17], [ex + 6, ey + 15], [ex - 2, ey + 17]], '#2b1d16', 2);
  if (p.mode === 'caught') oval(c, ex + 6, ey + 20, 5, 4 + 3 * p.handsUp, '#5a1d2a', 2);
  else if (p.mode === 'exit' && drive.age >= EXIT.cash) { c.beginPath(); c.strokeStyle = INK; c.lineWidth = 3; c.arc(ex + 6, ey + 16, 7, 0.2, Math.PI - 0.2); c.stroke(); }
  else if (drive.tension > 0.55) line(c, [[ex - 1, ey + 21], [ex + 3, ey + 19], [ex + 8, ey + 21], [ex + 13, ey + 19]], INK, 3);
  else line(c, [[ex, ey + 20], [ex + 11, ey + 20]], INK, 3);
  // Sweat when it gets loud.
  if (drive.tension > 0.42 && p.mode !== 'exit') {
    const k = (drive.tension - 0.42) / 0.58;
    for (let i = 0; i < 2 + Math.floor(k * 2); i++) {
      const u = ((time * (0.9 + 0.3 * i) + i * 0.37) % 1);
      c.save(); c.globalAlpha = 0.9 * (1 - u); oval(c, 20 + i * 4 - 2 * g, -14 + u * 26, 2.5, 4, '#9fd8ff', 1.5); c.restore();
    }
  }
  // The hat sits on his head unless it is flying.
  if (p.hat.on && p.cone < 0.6) { c.save(); c.translate(-1, -17); c.rotate(-0.15 * g); hatOn(c, drive.tejana); c.restore(); }
  c.restore();
  if (!p.hat.on) { c.save(); c.translate(p.hat.x, p.hat.y); c.rotate(p.hat.rot); hatOn(c, drive.tejana); c.restore(); }
  // Cone mode: a traffic cone over him, two eyes through the slit.
  if (p.cone > 0.01) {
    const s = p.cone;
    c.save(); c.globalAlpha = clamp(s * 3); c.translate(hip.x + 2, GROUND); c.scale(s, s);
    oval(c, 0, 2, 44, 8, '#15142b55');
    box(c, -46, -8, 92, 12, '#2d2a33', 4, 3);
    shape(c, [[-36, -6], [-9, -124], [9, -124], [36, -6]], '#ff6a1f', 3);
    shape(c, [[-29, -36], [-22, -66], [22, -66], [29, -36]], '#f4f4f0', 0);
    shape(c, [[-17, -84], [-13, -102], [13, -102], [17, -84]], '#f4f4f0', 0);
    shape(c, [[-24, -57], [-22, -62], [22, -62], [24, -57]], '#1e1a2b', 0);
    for (const dx of [-7, 7]) { oval(c, dx, -60, 4, 2.6, '#fff8ec', 1); oval(c, dx + 1, -60, 1.6, 1.6, INK); }
    c.restore();
  }
  c.restore();
  return p;
}
