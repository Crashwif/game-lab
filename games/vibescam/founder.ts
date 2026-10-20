/**
 * The founder: a vibe coder on his launch stream, seated at the desk facing the camera in a backwards cap, a
 * headset with a mic boom and a $VIBE hoodie. He types (a tap phase that quickens with the tension), talks with
 * his hands when he has a line, smacks the SHIP IT button on every feature, sweats, twitches, stops blinking and
 * grins wider as the number climbs. At the crash the choreography is a closed-form function of the crash clock:
 * the stare, the sticker peel, the smack, the shades, the chair rolled left to grab the LP bag, standing, and the
 * walk out through the door. Rig and drawing only; nothing here reads or changes the committed outcome.
 */
import { BAG, BEATS, BUTTON, CAM, CHAIR, DESK, KEYBOARD, SCOOT_X, drawBag, bulgeAt } from './den';
import { blob, box, ink, INK, label, limb, poly } from './ink';
import { type Joint, solveLimb, walkingFoot } from './kinematics';
import { clamp, mix, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

const SKIN = '#f1d2b6';
const HOODIE = '#262c48';
const CAP = '#ff4fd8';
const ARM_UPPER = 34;
const ARM_LOWER = 34;
const THIGH = 66;
const SHIN = 68;
export const FLOOR = 404;
/** The walk out: top speed in px/s and the stride of one gait cycle. */
const WALK_V = 150;
const STRIDE = 46;
/** How long the smack gesture takes, and the moment in it when the hand meets the button. */
const SMACK_S = 0.5;
const SMACK_HIT = 0.56;

export type Look = 'camera' | 'screen' | 'button' | 'chat' | 'bag';

export interface Founder {
  /** Where he is (local x): at the chair, rolled left for the bag, then walking out. */
  x: number;
  /** The torso's sideways lean and its forward slump toward the camera. */
  lean: Spring;
  slump: Spring;
  /** The head's lag behind the torso. */
  nod: Spring;
  /** The pupils, −1..1 on each axis. */
  lookX: Spring;
  lookY: Spring;
  /** The grin, 0 flat to 1 the full founder; the brows' worry. */
  grin: Spring;
  brow: Spring;
  /** The gesture hand (screen right) up off the keyboard, talking. */
  gesture: Spring;
  /** The smack gesture's progress, −1 idle, else 0..1. */
  smack: number;
  /** The sunglasses, 0 off to 1 on. */
  shades: Spring;
  /** The nervous bob and the typing taps, as integrated phases. */
  bob: number;
  taps: number;
  /** Sweat level and the eye twitch's level, eased. */
  sweat: number;
  twitch: number;
  /** Blinks: the countdown to the next, the blink in progress, how many so far (the chat notices when they stop). */
  blinkIn: number;
  blink: number;
  /** The gait's distance walked, for the footfall events. */
  stepsSeen: number;
  events: { key: boolean; smack: boolean; step: boolean };
}

export interface FounderDrive {
  time: number;
  tension: number;
  depth: number;
  running: boolean;
  multiplier: number;
  /** Seconds since the crash, or −1 before it. */
  crash: number;
  /** How hard he is talking right now (the script's `talking`), 0..1. */
  talking: number;
  /** Where he looks between lines. */
  look: Look;
  /** He types while the round runs and nobody is talking. */
  typing: boolean;
}

export function createFounder(): Founder {
  return { x: CHAIR.x, lean: spring(0), slump: spring(0), nod: spring(0), lookX: spring(0), lookY: spring(0.2), grin: spring(0.2), brow: spring(0), gesture: spring(0), smack: -1, shades: spring(0), bob: 0, taps: 0, sweat: 0, twitch: 0, blinkIn: 1.4, blink: 0, stepsSeen: 0, events: { key: false, smack: false, step: false } };
}

export function resetFounder(f: Founder): void {
  f.x = CHAIR.x;
  for (const s of [f.lean, f.slump, f.nod, f.lookX, f.brow, f.gesture, f.shades]) settleSpring(s, 0);
  settleSpring(f.lookY, 0.2);
  settleSpring(f.grin, 0.2);
  f.smack = -1;
  f.sweat = f.twitch = 0;
  f.blinkIn = 1.4;
  f.blink = 0;
  f.stepsSeen = 0;
}

/** Starts a smack of the SHIP IT button, if his hand is free. */
export function smackButton(f: Founder): void {
  if (f.smack < 0) f.smack = 0;
}

// ---- The crash choreography, closed-form on the crash clock ---------------------------------------------------------

/** Where he is on the floor at crash clock `c`: at the chair, rolled left for the bag, then walking out. */
export function xAt(c: number): number {
  if (c < BEATS.bag - 0.1) return CHAIR.x;
  const scoot = smoothstep(BEATS.bag - 0.1, BEATS.bag + 0.25, c);
  if (c < BEATS.walk) return mix(CHAIR.x, SCOOT_X, scoot);
  // The walk starts from rest and reaches top speed within a quarter second.
  const t = c - BEATS.walk;
  const tau = 0.2;
  return SCOOT_X + WALK_V * (t - tau * (1 - Math.exp(-t / tau)));
}
/** The distance walked at crash clock `c`, for the gait and the bag's swing. */
export const walkedAt = (c: number): number => Math.max(0, xAt(c) - SCOOT_X);
/** Standing, 0 seated to 1 upright. */
export const riseAt = (c: number): number => (c < 0 ? 0 : smoothstep(BEATS.rise, BEATS.rise + 0.35, c));
/** Turned to profile, facing the door. */
const turnAt = (c: number): number => (c < 0 ? 0 : smoothstep(BEATS.rise + 0.1, BEATS.walk + 0.1, c));
/** Stooped to the bag: up and back as he rises. */
const stoopAt = (c: number): number => (c < 0 ? 0 : smoothstep(BEATS.bag, BEATS.bag + 0.3, c) * (1 - smoothstep(BEATS.bag + 0.3, BEATS.rise + 0.1, c)));
/** The bag is in his hand from the grab until he is gone. */
export const carriesBag = (c: number): boolean => c >= BEATS.bag + 0.3;
/** Out of the frame. */
export const goneAt = (c: number): boolean => xAt(c) > CAM.w + 40;
/** Where the chair is: it stays where he rolled it. */
export const chairXAt = (c: number): number => (c < BEATS.bag - 0.1 ? CHAIR.x : mix(CHAIR.x, SCOOT_X, smoothstep(BEATS.bag - 0.1, BEATS.bag + 0.25, c)));
/** How far the chair is pushed back as he stands. */
export const pushedBackAt = (c: number): number => riseAt(c);

/** The eyes' targets, −1..1. */
function lookTarget(look: Look): { x: number; y: number } {
  switch (look) {
    case 'screen': return { x: -0.25, y: 0.35 };
    case 'button': return { x: 0.75, y: 0.8 };
    case 'chat': return { x: 0.8, y: 0.1 };
    case 'bag': return { x: -0.9, y: 0.9 };
    default: return { x: 0, y: 0.15 };
  }
}

/** The torso's lean and slump the drive calls for: the tension's hunch, the smack, and the crash's beats. */
function postureAt(d: FounderDrive, smacking: number): { lean: number; slump: number } {
  const c = d.crash;
  if (c < 0) return { lean: 24 * smacking, slump: d.running ? 0.3 + 0.5 * d.tension : 0.1 };
  if (c < BEATS.peel) return { lean: 0, slump: -0.4 };
  if (c < BEATS.smack + 0.3) return { lean: 22, slump: 0.4 };
  if (c < BEATS.bag) return { lean: 0, slump: -0.3 };
  return { lean: -26 * stoopAt(c), slump: 0.9 * stoopAt(c) };
}

export function settleFounder(f: Founder, d: FounderDrive): void {
  const c = d.crash;
  f.x = c < 0 ? CHAIR.x : xAt(c);
  const posture = postureAt(d, 0);
  settleSpring(f.lean, posture.lean);
  settleSpring(f.slump, posture.slump);
  settleSpring(f.nod, 0);
  const look = lookTarget(c >= 0 ? 'camera' : d.look);
  settleSpring(f.lookX, look.x);
  settleSpring(f.lookY, look.y);
  settleSpring(f.grin, c >= BEATS.smack ? 1 : 0.2 + 0.8 * d.tension);
  settleSpring(f.brow, c >= 0 ? 0 : 0.6 * d.tension);
  settleSpring(f.gesture, 0);
  settleSpring(f.shades, c >= BEATS.shades + 0.3 ? 1 : 0);
  f.smack = -1;
  f.sweat = c >= 0 ? 0 : smoothstep(0.45, 0.95, d.tension);
  f.twitch = c >= 0 ? 0 : smoothstep(0.6, 0.95, d.tension);
  f.stepsSeen = Math.floor(walkedAt(Math.max(0, c)) / (STRIDE / 2));
}

export function stepFounder(f: Founder, d: FounderDrive, dt: number): void {
  f.events = { key: false, smack: false, step: false };
  const c = d.crash;
  const crashed = c >= 0;
  f.x = crashed ? xAt(c) : CHAIR.x;

  // The smack: a wind-up, the hit, a short hold, back to the keys. The contact frame is an event.
  if (f.smack >= 0) {
    const before = f.smack;
    f.smack += dt / SMACK_S;
    if (before < SMACK_HIT && f.smack >= SMACK_HIT) f.events.smack = true;
    if (f.smack >= 1) f.smack = -1;
  }
  const smacking = f.smack >= 0 ? Math.sin(Math.PI * clamp(f.smack, 0, 1)) : 0;

  // Posture: the slump forward grows with the tension; the lean follows the hand to the button, the bag, the door.
  const posture = postureAt(d, smacking);
  stepSpring(f.lean, posture.lean, 16, 0.75, dt);
  stepSpring(f.slump, posture.slump, 6, 0.9, dt);
  stepSpring(f.nod, f.lean.v * 0.004, 12, 0.4, dt);

  // The eyes: a line turns him to the camera; the smack and the crash's peel to the button; otherwise the drive.
  let look: Look = d.look;
  if (d.talking > 0.2) look = 'camera';
  if (smacking > 0.2) look = 'button';
  if (crashed) look = c < BEATS.peel ? 'camera' : c < BEATS.smack + 0.25 ? 'button' : c < BEATS.bag ? 'camera' : c < BEATS.rise ? 'bag' : 'chat';
  const target = lookTarget(look);
  stepSpring(f.lookX, target.x, 18, 0.8, dt);
  stepSpring(f.lookY, target.y, 18, 0.8, dt);

  // The face: the grin widens with the number, the brows worry, the sweat and the twitch arrive late.
  stepSpring(f.grin, crashed ? (c < BEATS.peel ? 0 : 1) : 0.2 + 0.8 * d.tension + 0.15 * d.talking, 8, 0.8, dt);
  stepSpring(f.brow, crashed ? (c < BEATS.peel ? 1 : 0) : 0.6 * d.tension, 7, 0.85, dt);
  const sweatTarget = crashed ? 0 : smoothstep(0.45, 0.95, d.tension);
  f.sweat += (sweatTarget - f.sweat) * (1 - Math.exp(-2 * dt));
  const twitchTarget = crashed ? 0 : smoothstep(0.6, 0.95, d.tension);
  f.twitch += (twitchTarget - f.twitch) * (1 - Math.exp(-3 * dt));

  // Blinks come every second or two, stretch out as the tension climbs, and stop past 0.75 (the chat notices).
  if (f.blink > 0) f.blink = Math.max(0, f.blink - dt);
  else {
    f.blinkIn -= dt;
    if (f.blinkIn <= 0) {
      const stopped = !crashed && d.tension > 0.75;
      if (!stopped) f.blink = 0.12;
      f.blinkIn = 1.2 + 2.8 * d.tension + noise(d.time * 3.7) * 1.5;
    }
  }

  // Gesture: the free hand lifts to talk, drops to type.
  stepSpring(f.gesture, !crashed && d.talking > 0.15 && smacking < 0.1 ? 1 : 0, 10, 0.7, dt);
  stepSpring(f.shades, crashed && c >= BEATS.shades + 0.12 ? 1 : 0, 12, 0.6, dt);

  // The nervous bob and the typing, integrated so their rates can change without a jump.
  const quiet = crashed || !d.running;
  f.bob += dt * (quiet ? 1.5 : 4 + 7 * d.tension);
  const typing = d.typing && !crashed && smacking < 0.1 && f.gesture.x < 0.5;
  if (typing) {
    const before = Math.floor(f.taps / Math.PI);
    f.taps += dt * (7 + 10 * d.tension);
    if (Math.floor(f.taps / Math.PI) > before) f.events.key = true;
  }

  // Footfalls on the way out.
  if (crashed && c >= BEATS.walk) {
    const steps = Math.floor(walkedAt(c) / (STRIDE / 2));
    if (steps > f.stepsSeen && !goneAt(c)) f.events.step = true;
    f.stepsSeen = steps;
  }
}

// ---- Pose ------------------------------------------------------------------------------------------------------------

export interface FounderPose {
  x: number;
  hip: Joint;
  shoulderL: Joint;
  shoulderR: Joint;
  head: Joint;
  headR: number;
  /** Hand targets, resolved to reachable ends when drawn. */
  handL: Joint;
  handR: Joint;
  /** 0 seated to 1 upright; 0 facing us to 1 facing the door. */
  rise: number;
  turn: number;
  stoop: number;
  /** The seated knees and the walking feet. */
  feet: [Joint, Joint];
  carrying: boolean;
  gone: boolean;
  smacking: number;
}

/** His hands' rest on the keys: the screen-left hand at the left of the keyboard, the right hand at the right. */
const keyHand = (side: -1 | 1, tap: number): Joint => ({ x: KEYBOARD.x + (side < 0 ? 28 : KEYBOARD.w - 28), y: KEYBOARD.y + 1 - Math.max(0, tap) * 3 });

export function founderPose(f: Founder, d: FounderDrive): FounderPose {
  const c = d.crash;
  const rise = riseAt(c);
  const turn = turnAt(c);
  const stoop = stoopAt(c);
  const gone = c >= 0 && goneAt(c);
  const bob = Math.sin(f.bob) * (1.6 + 2.6 * d.tension) * (1 - rise) * (c < 0 ? 1 : 0.3);
  const hipY = mix(CHAIR.seat, FLOOR - THIGH - SHIN + 8, rise);
  const hip: Joint = { x: f.x, y: hipY };
  const slump = clamp(f.slump.x, -0.5, 1);
  const torsoH = 68 - 6 * slump - 26 * stoop;
  const lean = f.lean.x;
  const shoulderY = hip.y - torsoH + bob + 10 * stoop;
  const halfW = 36 * mix(1, 0.55, turn);
  const shoulderL: Joint = { x: f.x + lean * 0.8 - halfW, y: shoulderY };
  const shoulderR: Joint = { x: f.x + lean * 0.8 + halfW, y: shoulderY };
  const head: Joint = { x: f.x + lean + f.nod.x * 10 + 6 * turn, y: shoulderY - 40 + 3 * slump + f.nod.x * 2 };

  // Hands.
  const tapL = Math.sin(f.taps);
  const tapR = Math.sin(f.taps + Math.PI);
  let handL = keyHand(-1, tapL);
  let handR = keyHand(1, tapR);
  const smacking = f.smack >= 0 ? clamp(f.smack, 0, 1) : 0;
  if (f.smack >= 0) {
    // Wind up above the button, come down on it, hold, and return to the keys.
    const up = Math.sin(Math.PI * clamp(smacking / SMACK_HIT, 0, 1));
    const over = smoothstep(0, 0.35, smacking);
    const back = smoothstep(0.78, 1, smacking);
    const target = { x: mix(handR.x, BUTTON.x, over), y: mix(handR.y, BUTTON.y - 12, over) - 46 * up * (smacking < SMACK_HIT ? 1 : 0) };
    handR = { x: mix(target.x, handR.x, back), y: mix(target.y, handR.y, back) };
  } else if (f.gesture.x > 0.02) {
    // Talking with the free hand: palm up toward the camera, wobbling with the line.
    const g = clamp(f.gesture.x, 0, 1.2);
    const wob = Math.sin(d.time * 6.5) * 6 * d.talking;
    handR = { x: mix(handR.x, f.x + 54 + wob, g), y: mix(handR.y, shoulderY + 20 - Math.abs(wob), g) };
  }
  if (c >= 0) {
    if (c < BEATS.peel) {
      handL = keyHand(-1, 0);
      handR = keyHand(1, 0);
    } else if (c < BEATS.smack) {
      // Pinch the sticker's corner and peel it away, then rise over the button for the smack.
      const peel = smoothstep(BEATS.peel, BEATS.peel + 0.3, c);
      const raise = smoothstep(BEATS.smack - 0.2, BEATS.smack - 0.02, c);
      handR = { x: BUTTON.x + 14 + 20 * peel - 30 * raise, y: BUTTON.y - 20 - 24 * peel - 30 * raise };
      handL = keyHand(-1, 0);
    } else if (c < BEATS.shades) {
      // The hand on the button, held.
      handR = { x: BUTTON.x, y: BUTTON.y - 12 + 3 };
      handL = keyHand(-1, 0);
    } else if (c < BEATS.bag) {
      // Shades on with the left hand; the right hand comes off the button to the desk.
      const on = smoothstep(BEATS.shades, BEATS.shades + 0.3, c) * (1 - smoothstep(BEATS.shades + 0.3, BEATS.shades + 0.4, c));
      handL = { x: mix(keyHand(-1, 0).x, head.x - 12, on), y: mix(keyHand(-1, 0).y, head.y + 2, on) };
      handR = { x: BUTTON.x - 20, y: DESK.top + 2 };
    } else {
      // Down to the bag's handles with the left hand; standing, both hands hang; walking, the arms swing.
      const grab = smoothstep(BEATS.bag + 0.05, BEATS.bag + 0.3, c);
      const bagHandle: Joint = { x: BAG.x + 4, y: BAG.y - 48 - 12 * bulgeAt(d.multiplier) };
      if (!carriesBag(c)) {
        handL = { x: mix(keyHand(-1, 0).x, bagHandle.x, grab), y: mix(keyHand(-1, 0).y, bagHandle.y, grab) };
        handR = { x: f.x + 30, y: DESK.top - 6 };
      } else {
        const swing = Math.sin((walkedAt(c) / STRIDE) * Math.PI * 2);
        handL = { x: f.x - 10 * turn + 14 * swing * turn, y: hip.y + 30 - 20 * (1 - rise) };
        handR = { x: f.x + 16 + 10 * turn - 14 * swing * turn, y: hip.y + 26 };
      }
    }
  }

  // Legs: seated knees toward us; on the walk, a distance-driven gait.
  let feet: [Joint, Joint] = [{ x: f.x - 26, y: FLOOR }, { x: f.x + 26, y: FLOOR }];
  if (c >= BEATS.walk) {
    const dist = walkedAt(c);
    const a = walkingFoot(dist, STRIDE, 0, 12);
    const b = walkingFoot(dist, STRIDE, 0.5, 12);
    feet = [{ x: f.x + a.x, y: FLOOR + a.y }, { x: f.x + b.x, y: FLOOR + b.y }];
  } else if (rise > 0) {
    feet = [{ x: mix(f.x - 26, f.x - 8, rise), y: FLOOR }, { x: mix(f.x + 26, f.x + 8, rise), y: FLOOR }];
  }
  return { x: f.x, hip, shoulderL, shoulderR, head, headR: 28, handL, handR, rise, turn, stoop, feet, carrying: c >= 0 && carriesBag(c), gone, smacking };
}

// ---- Drawing ---------------------------------------------------------------------------------------------------------

function cap(ctx: CanvasRenderingContext2D, head: Joint, r: number, turn: number): void {
  // A backwards cap: the dome, the band at the brow, and the bill out the back (to the left as he faces the door).
  ctx.save();
  ctx.translate(head.x, head.y);
  blob(ctx, 0, -r * 0.78, r * 1.0, r * 0.5, CAP, 2.5);
  box(ctx, -r * 1.02, -r * 0.62, r * 2.04, 8, 3, '#d13db5', 2.5);
  // The bill, behind the head, poking out.
  const billX = -r * 0.9 - 10 * turn;
  poly(ctx, [billX, -r * 0.66, billX - 16, -r * 0.6, billX - 14, -r * 0.46, billX + 4, -r * 0.5], '#d13db5', 2.5);
  label(ctx, 'V', 0, -r * 0.9, 11, '#fff', 900);
  ctx.restore();
}

function headset(ctx: CanvasRenderingContext2D, head: Joint, r: number, turn: number, talking: number): void {
  ctx.save();
  ctx.translate(head.x, head.y);
  // The band over the cap and the cups at the ears.
  ink(ctx, 5, '#15131c');
  ctx.beginPath();
  ctx.arc(0, -4, r + 4, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  for (const side of [-1, 1]) blob(ctx, side * (r + 2) * (1 - 0.3 * turn * (side < 0 ? 1 : 0)), 2, 7, 9, '#15131c', 2.5);
  blob(ctx, -(r + 2), 2, 3.5, 4.5, CAP, 1.4);
  // The mic boom from the left cup to the mouth; it jiggles with the voice.
  ink(ctx, 3, '#15131c');
  ctx.beginPath();
  ctx.moveTo(-(r + 2), 8);
  ctx.quadraticCurveTo(-r * 0.7, r * 0.75, -8 + 2 * Math.sin(talking * 30), r * 0.72 + talking * 1.5);
  ctx.stroke();
  blob(ctx, -8 + 2 * Math.sin(talking * 30), r * 0.72 + talking * 1.5, 4, 3, '#2a2733', 1.8);
  ctx.restore();
}

/** The face: eyes with pupils on the look, bags under them that deepen with the tension, brows, the grin, sweat. */
function face(ctx: CanvasRenderingContext2D, f: Founder, d: FounderDrive, p: FounderPose, lights: number): void {
  const r = p.headR;
  const c = d.crash;
  const crashed = c >= 0;
  ctx.save();
  ctx.translate(p.head.x, p.head.y);
  // Skin tinted by the screen (green while it runs, red after), dim in the dark.
  const tint = crashed ? 'rgba(255, 70, 80, 0.16)' : `rgba(110, 255, 160, ${0.05 + 0.1 * d.tension})`;
  blob(ctx, 0, 0, r, r * 1.06, SKIN, 2.5);
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 1.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  for (const side of [-1, 1]) blob(ctx, side * r * 0.98, 2, 5, 7, SKIN, 2);
  // Stubble.
  ctx.fillStyle = 'rgba(60, 40, 40, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.7, r * 0.62, r * 0.32, 0, 0, Math.PI);
  ctx.fill();
  const look = { x: clamp(f.lookX.x, -1, 1) + 0.4 * p.turn, y: clamp(f.lookY.x, -1, 1) };
  const blink = f.blink > 0 ? 1 : 0;
  const twitch = f.twitch > 0.05 && noise(Math.floor(d.time * 12) * 1.3) > 0.78 ? f.twitch : 0;
  const wide = crashed && c < BEATS.peel ? 1 : 0;
  for (const side of [-1, 1]) {
    const ex = side * 10.5 + 2 * p.turn;
    const ey = 1;
    // The bags under the eyes: he has not slept.
    ctx.fillStyle = `rgba(90, 60, 110, ${0.18 + 0.3 * d.tension})`;
    ctx.beginPath();
    ctx.ellipse(ex, ey + 6, 7, 3.5 + 1.5 * d.tension, 0, 0, Math.PI);
    ctx.fill();
    const open = blink ? 0.1 : 1 + 0.35 * wide - (side > 0 ? 0.55 * twitch : 0);
    blob(ctx, ex, ey, 6.4, 6.4 * open + 0.3, '#fbf8f2', 1.8);
    if (open > 0.3) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + look.x * 2.6, ey + look.y * 2.4 * open, 2.9 - 0.8 * wide, 0, Math.PI * 2);
      ctx.fill();
      // A glint of the ring light.
      if (lights > 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${0.9 * lights})`;
        ctx.beginPath();
        ctx.arc(ex + look.x * 2.6 - 1.2, ey + look.y * 2.4 - 1.2, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Brows: worry lifts the inner ends; the crash's stare lifts both.
    const worry = clamp(f.brow.x, 0, 1);
    ink(ctx, 2.8);
    ctx.beginPath();
    ctx.moveTo(ex - side * 7, ey - 9 - 3 * wide);
    ctx.lineTo(ex + side * 6, ey - 8 + 4 * worry - 3 * wide + (side > 0 ? -2 * twitch : 0));
    ctx.stroke();
  }
  // Sunglasses drop in from above.
  const shades = clamp(f.shades.x, 0, 1);
  if (shades > 0.03) {
    ctx.save();
    ctx.translate(2 * p.turn, 1 - 22 * (1 - shades));
    ctx.globalAlpha = shades;
    box(ctx, -19, -6, 16, 11, 3, '#15131c', 2);
    box(ctx, 3, -6, 16, 11, 3, '#15131c', 2);
    ctx.fillStyle = INK;
    ctx.fillRect(-3, -3, 6, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-16, -4, 5, 2);
    ctx.fillRect(6, -4, 5, 2);
    ctx.restore();
  }
  // The grin: wider with the number, open with the voice; a small o for the stare.
  const grin = clamp(f.grin.x, 0, 1.1);
  const open = wide ? 0.5 : d.talking * 0.8;
  ctx.fillStyle = '#6a2a30';
  ink(ctx, 2);
  ctx.beginPath();
  if (wide) {
    ctx.ellipse(0, 15, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    const w = 8 + 9 * grin;
    ctx.moveTo(-w, 13 - 2 * grin);
    ctx.quadraticCurveTo(0, 15 + 7 * grin + open * 8, w, 13 - 2 * grin);
    if (open > 0.08 || grin > 0.6) ctx.quadraticCurveTo(0, 14 + open * 2, -w, 13 - 2 * grin);
    ctx.closePath();
    if (open > 0.08 || grin > 0.6) ctx.fill();
    ctx.stroke();
    if (grin > 0.6) {
      // Teeth.
      ctx.fillStyle = '#fbf8f2';
      ctx.beginPath();
      ctx.moveTo(-w + 3, 14 - 2 * grin);
      ctx.quadraticCurveTo(0, 16 + 3 * grin, w - 3, 14 - 2 * grin);
      ctx.lineTo(w - 3, 16 - 2 * grin + 2 * (grin - 0.6));
      ctx.quadraticCurveTo(0, 18 + 2 * grin, -w + 3, 16 - 2 * grin + 2 * (grin - 0.6));
      ctx.closePath();
      ctx.fill();
    }
  }
  // Sweat: drops slide down the temples.
  if (f.sweat > 0.05) {
    ctx.fillStyle = `rgba(160, 220, 255, ${0.85 * f.sweat})`;
    for (const [side, speed, off] of [[-1, 34, 0], [1, 41, 9], [-1, 27, 17]] as const) {
      const fall = ((d.time * speed + off) % 30) / 30;
      if (fall > f.sweat * 1.3) continue;
      const sx = side * (r * 0.78 - 2 * fall);
      const sy = -14 + fall * 26;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 1.8, 2.8 + fall, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The body below the head, and the head: drawn before the desk (the arms come after it). */
export function drawFounderBody(ctx: CanvasRenderingContext2D, f: Founder, d: FounderDrive, p: FounderPose, lights: number): void {
  if (p.gone) return;
  const c = d.crash;
  ctx.save();
  // Legs: seated, the knees point at us; walking, two-bone legs on the gait.
  const hipY = p.hip.y;
  if (c >= BEATS.rise) {
    const unfold = p.rise;
    for (const [i, foot] of p.feet.entries()) {
      const side = i === 0 ? -1 : 1;
      const root: Joint = { x: p.x + side * mix(14, 6, p.turn), y: hipY + 4 };
      const { joint, end } = solveLimb(root, foot, THIGH * mix(0.55, 1, unfold), SHIN * mix(0.95, 1, unfold), -1);
      limb(ctx, [root, joint, end], 13, '#2d2a3f', 2.5);
      blob(ctx, end.x + 4, end.y - 2, 11, 5, '#f3f1ea', 2);
    }
  } else {
    for (const side of [-1, 1]) {
      const knee: Joint = { x: p.x + side * 22, y: 340 };
      const foot: Joint = { x: p.x + side * 26, y: FLOOR - 3 };
      limb(ctx, [{ x: p.x + side * 14, y: 312 }, knee, foot], 13, '#2d2a3f', 2.5);
      blob(ctx, foot.x + side * 3, foot.y + 1, 11, 5, '#f3f1ea', 2);
    }
  }
  // The hoodie's torso, hips to shoulders, with the lean and the slump.
  const hw = 32 * mix(1, 0.6, p.turn);
  const sw = (p.shoulderR.x - p.shoulderL.x) / 2 + 4;
  const cx = (p.shoulderL.x + p.shoulderR.x) / 2;
  poly(ctx, [p.x - hw, hipY + 6, p.x + hw, hipY + 6, cx + sw, p.shoulderL.y + 6, cx + sw * 0.9, p.shoulderL.y - 8, cx - sw * 0.9, p.shoulderL.y - 8, cx - sw, p.shoulderL.y + 6], HOODIE, 2.5);
  // The hood behind the neck, the drawstrings, the logo.
  blob(ctx, cx, p.shoulderL.y - 2, sw * 0.7, 14, '#1d2238', 2.5);
  ink(ctx, 2, '#c9c4b8');
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 8, p.shoulderL.y + 4);
    ctx.lineTo(cx + s * 10 + f.lean.v * 0.02, p.shoulderL.y + 26);
    ctx.stroke();
  }
  if (p.turn < 0.5) {
    ctx.save();
    ctx.globalAlpha = 1 - 2 * p.turn;
    label(ctx, '$VIBE', cx, p.shoulderL.y + 36, 11, CAP, 900, sw * 1.4);
    ctx.restore();
  }
  // Neck and head.
  blob(ctx, p.head.x, p.head.y + 26, 9, 10, SKIN, 2.5);
  face(ctx, f, d, p, lights);
  cap(ctx, p.head, p.headR, p.turn);
  headset(ctx, p.head, p.headR, p.turn, d.talking);
  ctx.restore();
}

/** The arms, hands and the bag in hand: drawn over the desk so the hands rest on the keys. */
export function drawFounderArms(ctx: CanvasRenderingContext2D, f: Founder, d: FounderDrive, p: FounderPose): void {
  if (p.gone) return;
  const arms: [Joint, Joint, number][] = [[p.shoulderL, p.handL, 1], [p.shoulderR, p.handR, -1]];
  for (const [shoulder, target, pole] of arms) {
    const { joint, end } = solveLimb(shoulder, target, ARM_UPPER, ARM_LOWER, pole);
    limb(ctx, [shoulder, joint, end], 12, HOODIE, 2.5);
    // The cuff and the hand.
    blob(ctx, mix(joint.x, end.x, 0.82), mix(joint.y, end.y, 0.82), 6.5, 6.5, '#1d2238', 2);
    blob(ctx, end.x, end.y, 7, 6.5, SKIN, 2.2);
    if (pole === 1 && p.carrying) {
      // The bag hangs from the hand, swinging with the stride.
      const swing = d.crash >= BEATS.walk ? Math.sin((walkedAt(d.crash) / STRIDE) * Math.PI * 2) * 0.25 : 0;
      drawBag(ctx, end.x + 2, end.y + 60, bulgeAt(d.multiplier), swing);
    }
  }
}

/** Where the bubble's tail should point: his mouth. */
export const mouthOf = (p: FounderPose): Joint => ({ x: p.head.x, y: p.head.y + 15 });

