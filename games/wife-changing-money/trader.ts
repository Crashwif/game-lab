/**
 * The degen at the kitchen table: a hunched seated rig lit by the laptop,
 * the lid closing, the tiptoe up the stairs, and the caught pose.
 * Nothing here chooses the round outcome.
 */
import { DESK, KEYBOARD_HANDS, LAPTOP } from './kitchen';
import { clamp, mix, noise, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const SKIN = '#f3dccb';
const ease = (n: number): number => { const u = clamp(n, 0, 1); return u * u * (3 - 2 * u); };

type Point = { x: number; y: number };

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

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): Point {
  const joint = bendJoint(a, b, upper, lower, side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 4;
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

export type TraderMode = 'hunch' | 'closing' | 'sneak' | 'upstairs' | 'caught';

export interface Trader {
  mode: TraderMode;
  modeAge: number;
  x: number;
  y: number;
  lid: Spring;
  shades: Spring;
  sweat: number;
  /** The jump in his chair when she is on the stairs: kicked negative (up), rings back down. */
  jolt: Spring;
  /** The nervous bob's phase, integrated so its rate can follow the fear without jumping. */
  bob: number;
  /** Where his head is turned: −1 down at the phone, +1 over his shoulder at the stairs. */
  look: Spring;
  lookAt: number;
  lookT: number;
  /** The listening freeze (an act, the first thump), eased so the bob and the typing fade out instead of cutting. */
  hush: number;
  hushT: number;
  /** The elbow jab that sends the mug off the counter: 1 at the jab, run down over 0.4 s. */
  jab: number;
  /** His exit pace: he scurries once the stairs light up behind him. */
  rush: number;
}

export interface TraderDrive {
  running: boolean;
  fear: number;
  leaving: boolean;
  time: number;
  /** An act's listening beat: he stops typing and holds still. */
  listening?: boolean;
  /** The round is over and she is up: a sneak still on the stairs hurries. */
  hurry?: boolean;
}

export function createTrader(): Trader {
  return { mode: 'hunch', modeAge: 0, x: DESK.x, y: DESK.y, lid: spring(0.06), shades: spring(0), sweat: 0, jolt: spring(0), bob: 0, look: spring(0), lookAt: 0, lookT: 0, hush: 0, hushT: 0, jab: 0, rush: 1 };
}

export function resetTrader(t: Trader): void {
  t.mode = 'hunch';
  t.modeAge = 0;
  t.x = DESK.x;
  t.y = DESK.y;
  t.lid.x = 0.06;
  t.lid.v = 0;
  t.shades.x = 0;
  t.shades.v = 0;
  t.sweat = 0;
  t.jolt.x = 0;
  t.jolt.v = 0;
  t.look.x = t.look.v = t.lookAt = t.lookT = 0;
  t.hush = t.hushT = t.jab = 0;
  t.rush = 1;
}

/** Snaps to an end pose the scene did not see him reach: upstairs after a cash-out, or caught at the desk. */
export function snapTrader(t: Trader, where: 'upstairs' | 'caught'): void {
  t.mode = where;
  t.modeAge = 8;
  t.lid.x = where === 'upstairs' ? 1 : 0.04;
  t.lid.v = 0;
  t.shades.x = where === 'upstairs' ? 1 : 0;
  t.shades.v = 0;
  t.jolt.x = 0;
  t.jolt.v = 0;
  // Caught, he freezes in shock: the nervous bob and the typing stop.
  t.hush = where === 'caught' ? 1 : 0;
  t.hushT = t.jab = t.lookT = 0;
  if (where === 'upstairs') {
    t.x = 1000;
    t.y = 150;
  } else {
    t.x = DESK.x;
    t.y = DESK.y;
  }
}

/** The caught frame: he leaves the chair for a moment and lands back in it. */
export function joltTrader(t: Trader): void {
  t.jolt.v = -16;
}

/** What he reacts to at the desk: her texts (a look down at the phone), the ceiling, the stairs, the mug his elbow sends off. */
export function cueTrader(t: Trader, cue: 'text' | 'thump' | 'flicker' | 'stairs' | 'mug'): void {
  if (t.mode !== 'hunch') return;
  if (cue === 'text') { t.lookAt = -1; t.lookT = 0.7; return; }
  if (cue === 'mug') { t.jab = 1; t.lookAt = -1; t.lookT = 0.6; return; }
  t.lookAt = 1;
  t.lookT = cue === 'flicker' ? 1.2 : cue === 'stairs' ? 0.8 : 0.6;
  if (cue === 'flicker') t.hushT = 1.3;
  if (cue !== 'stairs') t.jolt.v = cue === 'flicker' ? -5 : -4;
}

/** The climb starts from rest and never stops: it eases in, then carries its pace onto the landing and off the right edge. */
const CLIMB_S = 2.3, CLIMB_IN = 0.35, CLIMB_V = 168 / (CLIMB_S * (1 - CLIMB_IN / 2)), LANDING_A = 60;
const LANDING_S = (-CLIMB_V + Math.sqrt(CLIMB_V * CLIMB_V + 2 * LANDING_A * 108)) / LANDING_A;
/** From the chair to off the top of the stairs: once it has run he is upstairs, out of the frame. */
export const EXIT_S = 2.05 + CLIMB_S + LANDING_S;

/** Floor travel precedes ascent. The stair edge is x=700+(470-y)/2. */
export function exitPose(age: number): Point {
  if (age < .25) return { x: DESK.x, y: DESK.y + 22 * clamp(age / .25, 0, 1) };
  const floor = ease((age - .25) / 1.8);
  if (floor < 1) return { x: DESK.x + (724 - DESK.x) * floor, y: 470 };
  const u = (age - 2.05) / CLIMB_S;
  if (u < 1) {
    const ascent = u < CLIMB_IN ? u * u / (2 * CLIMB_IN) / (1 - CLIMB_IN / 2) : (u - CLIMB_IN / 2) / (1 - CLIMB_IN / 2);
    return { x: 724 + 168 * ascent, y: 470 - 320 * ascent };
  }
  const walk = age - 2.05 - CLIMB_S;
  return { x: 892 + CLIMB_V * walk + LANDING_A * walk * walk / 2, y: 150 };
}
/** A planted foot keeps its world-space tread until the next swing. */
export function traderFoot(age: number, side: number): Point {
  const root = exitPose(age), stride = 24;
  const distance = Math.max(0, root.x - DESK.x);
  const phase = ((distance / stride + (side > 0 ? .5 : 0)) % 1 + 1) % 1;
  const anchor = root.x - phase * stride + stride * .29 + side * 4;
  const ground = (x: number): number => x < 725 ? 470 : Math.max(150, 420 - Math.floor((x - 725) / 20) * 40);
  if (age < .25) return { x: DESK.x + side * 14, y: mix(DESK.y, 470, ease(age / .25)) };
  const u = clamp((phase - .58) / .42, 0, 1), swing = ease(u);
  const foot = phase < .58 ? { x: anchor, y: ground(anchor) }
    : { x: mix(anchor, anchor + stride, swing), y: mix(ground(anchor), ground(anchor + stride), swing) - 14 * Math.sin(Math.PI * u) ** 2 };
  // The first cycle must emerge from the soles used during the seated unfold.
  const enter = ease(distance / 26);
  return { x: mix(DESK.x + side * 14, foot.x, enter), y: mix(470, foot.y, enter) };
}
/** Keep both soles reachable with the small rig's proportions; the pelvis follows support on the stairs. */
export function traderStance(t: Trader): { rootY: number; feet: Point[]; hipY: number; upper: number; lower: number } {
  const walking = t.mode === 'sneak';
  const unfold = walking ? ease(t.modeAge / .25) : 0;
  // Seated thighs point into depth, then unfold into the walking plane.
  const projection = mix(.58, 1, unfold), upper = 28 * projection, lower = 26 * projection;
  const hipY = -26 - 16 * unfold;
  const feet = [-1, 1].map(side => walking ? traderFoot(t.modeAge, side) : { x: t.x + side * 14, y: t.y - 2 });
  let rootY = t.y;
  if (walking) {
    let floor = -Infinity, ceiling = Infinity;
    feet.forEach((foot, i) => {
      const side = i ? 1 : -1, dx = foot.x - t.x - side * 8;
      const reach = Math.sqrt(Math.max(0, (upper + lower - .01) ** 2 - dx * dx));
      floor = Math.max(floor, foot.y - reach); ceiling = Math.min(ceiling, foot.y + reach);
    });
    rootY = clamp(t.y + hipY, floor, ceiling) - hipY;
  }
  return { rootY, feet, hipY, upper, lower };
}

export function typingHands(x: number, y: number, offsetY: number, tap: number): Point[] {
  return KEYBOARD_HANDS.map((p, i) => ({ x: p.x - x, y: p.y - y - offsetY - Math.max(0, i ? -tap : tap) }));
}
export function stepTrader(t: Trader, drive: TraderDrive, dt: number): void {
  if (drive.leaving && t.mode === 'hunch') {
    t.mode = 'closing';
    t.modeAge = 0;
  }
  // Once the stairs light up behind him he scurries; the gait is distance-driven, so the feet keep up.
  t.rush += ((drive.hurry && t.mode === 'sneak' ? 1.7 : 1) - t.rush) * (1 - Math.exp(-5 * dt));
  t.modeAge += dt * (t.mode === 'sneak' ? t.rush : 1);
  stepSpring(t.jolt, 0, 12, 0.4, dt);
  const open = t.mode === 'hunch' || t.mode === 'caught';
  // The hand reaches the lid before it comes down, so SOLD shows for a beat first.
  stepSpring(t.lid, open || (t.mode === 'closing' && t.modeAge < 0.26) ? 0.05 : 1, 9, 0.72, dt);
  stepSpring(t.shades, t.mode === 'sneak' || t.mode === 'upstairs' ? 1 : 0, 14, 0.55, dt);
  t.sweat = drive.running ? clamp(t.sweat + dt * (drive.fear > 0.55 ? 0.35 : -0.2), 0, 1) : t.sweat * Math.exp(-1.2 * dt);
  t.bob += dt * (5 + drive.fear * 8);
  t.lookT = Math.max(0, t.lookT - dt);
  t.hushT = Math.max(0, t.hushT - dt);
  t.jab = Math.max(0, t.jab - dt / 0.4);
  // Caught, he stares at the stairs; otherwise a cue turns his head for a moment and it comes back to the screen.
  stepSpring(t.look, t.mode === 'caught' ? 0.8 : t.mode === 'hunch' && t.lookT > 0 ? t.lookAt : 0, 14, 0.7, dt);
  const hushed = t.mode === 'caught' || (t.mode === 'hunch' && (drive.listening === true || t.hushT > 0));
  t.hush += ((hushed ? 1 : 0) - t.hush) * (1 - Math.exp(-8 * dt));
  if (t.mode === 'closing' && t.lid.x > 0.9 && t.modeAge > 0.42) {
    t.mode = 'sneak';
    t.modeAge = 0;
  }
  if (t.mode === 'sneak') {
    const pose = exitPose(t.modeAge);
    t.x = pose.x; t.y = pose.y;
    if (t.modeAge >= EXIT_S) t.mode = 'upstairs';
  }
}

function face(ctx: CanvasRenderingContext2D, mood: 'focus' | 'shock' | 'shh', glow: 'green' | 'red' | 'off', twitch: number, shades: number): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = glow === 'green' ? '#c6efd0' : glow === 'red' ? '#f0c2c6' : SKIN;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = '#3a2a24';
  ctx.beginPath();
  ctx.ellipse(0, -16, 15, 8, 0, Math.PI, 0);
  ctx.fill();
  const eye = mood === 'shock' ? 3.4 : mood === 'focus' ? 1.5 : 2;
  ctx.fillStyle = INK;
  for (const ex of [-6, 5]) {
    ctx.beginPath();
    ctx.ellipse(ex + twitch, -2, 2.1, eye, 0, 0, Math.PI * 2);
    ctx.fill();
    if (glow === 'green') {
      ctx.fillStyle = '#39ff8a';
      ctx.fillRect(ex + twitch - 1, -3, 2, 2);
      ctx.fillStyle = INK;
    }
  }
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (mood === 'shock') ctx.ellipse(0, 8, 4, 5, 0, 0, Math.PI * 2);
  else if (mood === 'shh') { ctx.moveTo(-4, 7); ctx.quadraticCurveTo(0, 4, 4, 7); }
  else { ctx.moveTo(-4, 7); ctx.lineTo(4, 7); }
  ctx.stroke();
  if (shades > 0.04) {
    const dy = -22 * (1 - shades);
    ctx.fillStyle = INK;
    ctx.fillRect(-12, -6 + dy, 10, 6);
    ctx.fillRect(1, -6 + dy, 10, 6);
    ctx.fillRect(-2, -4 + dy, 3, 2);
  }
}

/** Draws the trader at his feet. The chair and laptop belong to the kitchen. */
export function drawTrader(ctx: CanvasRenderingContext2D, t: Trader, glow: 'green' | 'red' | 'off', time: number, fear: number): void {
  if (t.mode === 'upstairs') return;
  const typing = t.mode === 'hunch' || t.mode === 'caught';
  const closing = t.mode === 'closing';
  const sneaking = t.mode === 'sneak';
  const unfold = sneaking ? ease(t.modeAge / .25) : 0;
  const hunch = typing ? 1 : closing ? 1 - ease(t.modeAge / .5) : 0;
  const still = 1 - t.hush;
  const bob = Math.sin(t.bob) * (2 + fear * 3) * hunch * still;
  const twitch = t.look.x * 2.5 + (t.mode === 'caught' || t.hush > 0.5 ? 0 : fear > 0.62 && noise(Math.floor(time * 9)) > 0.72 ? 1.6 : 0);
  const stance = traderStance(t);
  ctx.save();
  ctx.translate(t.x, stance.rootY + bob + t.jolt.x * 12);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Feet remain in world axes while the character traverses the floor and stairs.
  const lean = 16 * hunch;
  // Knees under the gown. On the stairs the lifted foot leads.
  for (const side of [-1, 1]) {
    const worldFoot = stance.feet[side < 0 ? 0 : 1]!;
    const foot = { x: worldFoot.x - t.x, y: worldFoot.y - stance.rootY - (sneaking ? bob + t.jolt.x * 12 : 0) };
    // Seated, the knees splay toward the viewer; standing to walk right, both knees point forward.
    limb(ctx, { x: side * 8, y: stance.hipY }, foot, stance.upper, stance.lower, side < 0 ? mix(1, -1, unfold) : -1, 7, SKIN);
    ctx.fillStyle = '#6d4a3a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y + 2, 10, 4, side * -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.translate(0, -16 * unfold);
  // Gown, hunched over the keyboard. The laptop is drawn later and covers his hands.
  ctx.fillStyle = '#3d4d73';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(lean * 0.3, -36, 28, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  limb(ctx, { x: lean * 0.15, y: -50 }, { x: lean, y: -64 }, 10, 9, 1, 6, SKIN);
  if (sneaking) {
    const k = ease(t.modeAge / .25);
    const shush = { x: mix(LAPTOP.x + LAPTOP.w - t.x, 18, k), y: mix(LAPTOP.y + 8 - t.y + 16 * unfold, -86, k) };
    limb(ctx, { x: 8, y: -52 }, shush, 26, 24, -1, 5, SKIN);
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(shush.x, shush.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const swing = { x: mix(KEYBOARD_HANDS[0]!.x - t.x, -24 + Math.sin((t.x - DESK.x) / 24 * Math.PI) * 4, k), y: mix(KEYBOARD_HANDS[0]!.y - t.y + 16 * unfold, -22, k) };
    limb(ctx, { x: -12, y: -48 }, swing, 26, 24, 1, 5, SKIN);
  } else {
    const tap = Math.sin(time * 16) * (t.mode === 'caught' ? 0 : 1.5 * still);
    const [left, right] = typingHands(t.x, t.y, bob + t.jolt.x * 12, typing ? tap : 0) as [Point, Point];
    if (t.jab > 0) {
      // The elbow jab: the hand pulls up to the chest and the elbow goes out sideways into the mug.
      const k = Math.sin(Math.PI * (1 - t.jab));
      left.x = mix(left.x, -22, k);
      left.y = mix(left.y, -64, k);
    }
    if (closing) {
      const contact = ease(t.modeAge / .16);
      right.x = mix(right.x, LAPTOP.x + LAPTOP.w - 1.6 * t.lid.x - t.x, contact);
      right.y = mix(right.y, LAPTOP.y + 8 - LAPTOP.h * .2 * (1 - t.lid.x) - t.y - bob - t.jolt.x * 12, contact);
    }
    limb(ctx, { x: -14, y: -46 }, left, 26, 24, -1, 6, '#3d4d73');
    limb(ctx, { x: 14, y: -46 }, right, 26, 24, -1, 6, '#3d4d73');
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(left.x, left.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(right.x, right.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // The head turns on its own: down to the phone, over the shoulder to the stairs.
  const look = t.look.x;
  ctx.translate(lean + look * 3, -78 - 6 * hunch + Math.max(0, -look) * 3);
  ctx.rotate((t.mode === 'caught' ? -0.2 : 0) + look * (look < 0 ? 0.16 : 0.1));
  face(ctx, t.mode === 'caught' ? 'shock' : t.mode === 'sneak' || t.hush > 0.5 ? 'shh' : 'focus', glow, twitch, t.shades.x);
  if (t.sweat > 0.2 && t.mode !== 'sneak') {
    const drop = ((time * 40) % 28);
    ctx.globalAlpha = clamp(1 - drop / 28, 0, 0.8) * t.sweat;
    ctx.fillStyle = '#9fd7ff';
    ctx.beginPath();
    ctx.ellipse(14, -8 + drop * 0.4, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
