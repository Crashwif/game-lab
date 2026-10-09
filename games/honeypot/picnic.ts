/**
 * The picnic: the bear whose paw is in the jar, the guests who lean in
 * and stick, the hive with its lure sign, the swarm and the beekeeper (the
 * dev) who leaves with it.
 */
import { AUDIT_AT, JAR, tracked } from './jar';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const FUR = '#8d5a32';
const MUZZLE = '#f0d2a8';

export type BearMode = 'stuck' | 'pulling' | 'walking' | 'gone' | 'trapped';

export interface Bear {
  mode: BearMode;
  age: number;
  x: number;
  /** Signed speed in px/s, carried from the scramble along the crate through the drop into the stroll. */
  vx: number;
  paw: number;
  shades: Spring;
  baseY: number;
  fallV: number;
  landing: Spring;
  /** Ground covered, which places the feet so they plant instead of skating; `gait` blends the walk in and out. */
  walked: number;
  gait: number;
  /** A tug on the stuck paw (kicked, rings back), the seconds to the next one, a startle at the lid, the breathing. */
  tug: Spring;
  tugIn: number;
  flinch: Spring;
  breath: number;
}

export interface Guest {
  kind: 'raccoon' | 'frog' | 'goose';
  /** Where it sits, and the puddle's edge it creeps to as it leans in (and sticks to). */
  home: number;
  edge: number;
  at: number;
  lean: Spring;
  stuck: boolean;
  line: string;
  /** The idle sniff's phase and its own rate in Hz. */
  sniff: number;
  rate: number;
}

interface Bee { angle: number; orbit: number; speed: number; size: number; wob: number; rate: number; }
/** A honey drop flung off the freed paw. */
interface Drop { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; }
/** A line said out loud: by guest 0..2, or 3 the auditor. */
interface Say { who: number; text: string; age: number; }

export type FoxMode = 'away' | 'in' | 'stamping' | 'out' | 'gone';

/** The auditor: a fox in a suit who walks in from 1.5×, stamps the jar and leaves at 2.3×. */
export interface Fox {
  mode: FoxMode;
  x: number;
  /** Signed speed in px/s. */
  vx: number;
  walked: number;
  /** 1 facing left (in, at the jar), -1 facing right (on the way out); the turn squashes through 0. */
  face: Spring;
  /** The stamp arm along its path: 0 hanging, 1 raised (the wind-up), 2 on the glass. */
  arm: Spring;
  age: number;
  stamped: boolean;
}

/** The dev's texts to the bear's phone, by multiplier. */
export const TEXTS: { at: number; text: string }[] = [
  { at: 1.3, text: 'DEV: trust me bro' },
  { at: 1.66, text: 'DEV: the lid is a feature' },
  { at: 2.5, text: 'DEV: sell tax is love' },
  { at: 3.5, text: 'DEV: sell button wen? soon™' },
];
const LAST_TEXT = 'DEV left the chat';
const FOLLOWUPS = ['DEV: another audit incoming', 'DEV: lid upgrade pending', 'DEV: bees are the roadmap', 'DEV: withdrawals soon™', 'DEV: sticky hands win', 'DEV: support is on lunch'];
/** Where the fox stands to reach the jar, where he steps in from, and where he is out of sight. */
const FOX_STAND = 655;
const FOX_START = 1030;
const FOX_OFF = 1040;
const FOX_SPEED = 200;
const FOX_ACCEL = 900;
const FOX_STRIDE = 44;
/** He walks in from this multiplier, stamps from this one (or on arrival), and leaves at this one. */
const FOX_IN = 1.5;
const FOX_STAMP = 1.72;
const FOX_OUT = 2.3;
/** Where his slam lands on the room's curve (about 0.9 s after he reaches the jar), for a round met late. */
const FOX_SLAM = 1.87;
const BEAR_STRIDE = 40;
/** Where the bear's middle clears the crate's left edge (354) and he drops, and the grass he lands on. */
const CRATE_EDGE = 342;
const GROUND = 430;
const DROP_CAP = 30;
const SAY_LIFE = 2.6;

export interface Picnic {
  bear: Bear;
  guests: Guest[];
  bees: Bee[];
  /** The swarm's middle and spread, eased so it never jumps (to the jar at the crash, out on a patrol). */
  swarm: { x: number; y: number; spread: number };
  keeperX: number;
  hiveX: number;
  leaving: boolean;
  puddle: number;
  fox: Fox;
  phone: { shake: Spring; count: number; age: number; last: boolean; followup: number };
  drops: Drop[];
  says: Say[];
  flies: number;
  events: { stamp: boolean; msg: boolean; pawFree: boolean; guest: boolean; tug: boolean };
}

export function createPicnic(): Picnic {
  const rand = mulberry32(5);
  return {
    bear: { mode: 'stuck', age: 0, x: 420, vx: 0, paw: 0, shades: spring(0), baseY: 280, fallV: 0, landing: spring(0), walked: 0, gait: 0, tug: spring(0), tugIn: 2.2, flinch: spring(0), breath: 0 },
    guests: [
      { kind: 'raccoon', home: 262, edge: 372, at: 1.13, lean: spring(0), stuck: false, line: 'ser, is this safe?', sniff: 0, rate: 2.1 },
      // Pepe hops in just after the auditor's stamp, beside him rather than behind his walk in.
      { kind: 'frog', home: 805, edge: 740, at: 1.9, lean: spring(0), stuck: false, line: 'few understand', sniff: 1, rate: 1.3 },
      { kind: 'goose', home: 905, edge: 850, at: 2.6, lean: spring(0), stuck: false, line: 'bought the top', sniff: 2, rate: 0.85 },
    ],
    // Each bee its own speed and a radial wobble at its own rate, so the swarm never moves as one rigid ring.
    bees: Array.from({ length: 28 }, (_, i) => ({
      angle: i * 0.7,
      orbit: 36 + (i % 5) * 16,
      speed: 0.7 + rand() * 0.9,
      size: 3 + (i % 3),
      wob: rand() * 6.3,
      rate: Math.PI * 2 * (0.7 + rand() * 0.6),
    })),
    swarm: { x: 168, y: 230, spread: 1 },
    keeperX: 40,
    hiveX: 168,
    leaving: false,
    puddle: 0.2,
    fox: { mode: 'away', x: FOX_OFF, vx: 0, walked: 0, face: spring(1), arm: spring(0), age: 0, stamped: false },
    phone: { shake: spring(0), count: 0, age: 9, last: false, followup: -1 },
    drops: [],
    says: [],
    flies: 0,
    events: { stamp: false, msg: false, pawFree: false, guest: false, tug: false },
  };
}

export function resetPicnic(p: Picnic): void {
  Object.assign(p, createPicnic());
}

/** The bear who got out: paw free, shades on, off the blanket. */
function leaveBear(bear: Bear): void {
  bear.mode = 'gone';
  bear.x = -80;
  bear.paw = 1; bear.baseY = GROUND;
  bear.shades.x = 1;
}

export function pullPaw(p: Picnic): void {
  if (p.bear.mode === 'stuck') {
    p.bear.mode = 'pulling';
    p.bear.age = 0;
    // The yank: he leans back hard before the paw gives.
    p.bear.tug.v += 12;
  }
}

/** The lid lurched: the stuck bear startles. */
export function startle(p: Picnic): void {
  if (p.bear.mode === 'stuck') p.bear.flinch.v += 7;
}

function say(p: Picnic, who: number, text: string): void {
  p.says = p.says.filter((s) => s.who !== who);
  p.says.push({ who, text, age: 0 });
}

export function trapPicnic(p: Picnic, quiet: boolean, escaped: boolean): void {
  p.leaving = true;
  if (!escaped && p.bear.mode !== 'gone' && p.bear.mode !== 'walking') {
    p.bear.mode = 'trapped';
    p.bear.age = 0;
  }
  for (const guest of p.guests) if (guest.lean.x > 0.35) guest.stuck = true;
  // Lines in the air fade out under the crash rather than vanish.
  for (const s of p.says) s.age = Math.max(s.age, SAY_LIFE - 0.3);
  // The auditor, if he is still here, remembers another appointment.
  if (p.fox.mode === 'in' || p.fox.mode === 'stamping') p.fox.mode = 'out';
  p.flies = 5;
  // The last text.
  p.phone.last = true;
  p.phone.age = quiet ? 9 : 0;
  if (!quiet) p.phone.shake.v = 8;
  if (quiet) {
    p.keeperX = 1040;
    p.hiveX = 1000;
    p.puddle = 1;
    p.fox.mode = 'gone';
    p.fox.x = FOX_OFF;
    p.says = [];
    Object.assign(p.swarm, { x: JAR.cx, y: 300, spread: 1.4 });
    if (escaped) leaveBear(p.bear);
  }
}

/**
 * Jumps the picnic to where a round that has run `seconds` to this multiplier has it: the guests leaning in, the
 * puddle spread, and a bear who has already cashed out gone. For a round met late rather than watched.
 */
export function settlePicnic(p: Picnic, multiplier: number, tension: number, seconds: number, escaped: boolean): void {
  for (const guest of p.guests) settleSpring(guest.lean, multiplier >= guest.at ? 1 : 0.05);
  // The spread rate is 0.03 + 0.05 × tension, and on the room's curve 1 - 1/x integrates to this.
  p.puddle = clamp(0.2 + seconds * 0.08 - tension * 0.65, 0.2, 1);
  if (escaped) leaveBear(p.bear);
  p.bear.tugIn = 0.6;
  const patrol = seconds > 45 ? Math.max(0, Math.sin((seconds - 45) * Math.PI / 12)) : 0;
  Object.assign(p.swarm, { x: mix(p.hiveX, JAR.cx, patrol), y: mix(230, JAR.top - 18, patrol), spread: 1 });
  // The auditor where the multiplier has him: walking in, at the jar, stamped, or gone.
  const fox = p.fox;
  if (multiplier >= FOX_OUT) {
    fox.mode = 'gone';
    fox.x = FOX_OFF;
    fox.stamped = true;
  } else if (multiplier >= FOX_STAMP) {
    // At the jar: his mark on the glass once the slam has landed, otherwise the wind-up still to come.
    fox.mode = 'stamping';
    fox.x = FOX_STAND;
    fox.stamped = multiplier >= FOX_SLAM;
    fox.age = fox.stamped ? 3 : 0;
  } else if (multiplier >= FOX_IN) {
    fox.mode = 'in';
    fox.x = Math.max(FOX_STAND, FOX_START - FOX_SPEED * 30 * Math.log10(multiplier / FOX_IN));
    fox.vx = fox.x > FOX_STAND ? -FOX_SPEED : 0;
  }
  // The texts already read, the dev's follow-ups (every 8 s after the last scripted one at about 16 s) included, with
  // the next one a few seconds off.
  p.phone.count = TEXTS.filter((t) => multiplier >= t.at).length;
  p.phone.followup = p.phone.count === TEXTS.length ? Math.floor(Math.max(0, seconds - 16.3) / 8) - 1 : -1;
  p.phone.age = 4;
}

/** Whether the jar already carries the auditor's mark, for a round met late. */
export function auditDone(p: Picnic): boolean {
  return p.fox.stamped;
}

/** `round` is the running round's seconds (0 outside one). */
export interface PicnicDrive { running: boolean; multiplier: number; tension: number; level: number; round?: number; }

/**
 * A foot's offset from its rest for a body moving toward +x, from the ground covered: planted (sliding back under
 * the body) for 58% of the cycle, then swung forward, leaving and landing at the ground's speed.
 */
function stepFoot(distance: number, stride: number, offset: number, lift: number): Point {
  const phase = ((distance / stride + offset) % 1 + 1) % 1;
  const half = stride * 0.29;
  if (phase < 0.58) return { x: half - phase * stride, y: 0 };
  const u = (phase - 0.58) / 0.42;
  return { x: -half - u * stride * 0.42 + stride * u * u * (3 - 2 * u), y: -lift * Math.sin(Math.PI * u) ** 2 };
}

export function pawPoint(p: Picnic, level: number): { x: number; y: number } {
  void level;
  const t = p.bear.paw;
  // A tug lifts the stuck paw up the neck (about 8 px), fading out as the pull draws it clear.
  const tug = p.bear.tug.x * 13 * (1 - t / 0.3);
  if (t <= 0.3) return { x: mix(JAR.cx - 30, 490, t / 0.3) - 0.6 * tug, y: mix(JAR.top + 20, 250, t / 0.3) - 0.8 * tug };
  return { x: p.bear.x + mix(70, 40, (t - 0.3) / 0.7), y: bearBaseY(p) - 30 };
}

export function stepPicnic(p: Picnic, drive: PicnicDrive, dt: number): void {
  p.events = { stamp: false, msg: false, pawFree: false, guest: false, tug: false };
  const bear = p.bear;
  bear.age += dt;
  if (bear.mode === 'pulling') {
    // The pull eases in, so the paw tears free with a snap rather than sliding out: the honey flies, the jar rings.
    const was = bear.paw;
    bear.paw = Math.min(1, bear.paw + dt * (0.5 + bear.paw * 1.2));
    if (was < 0.3 && bear.paw >= 0.3) {
      p.events.pawFree = true;
      flingHoney(p, pawPoint(p, drive.level));
    }
  }
  // Free, he scrambles back along the crate, steps off its edge carrying his speed, lands and strolls off.
  const free = bear.mode === 'walking' || bear.mode === 'pulling' && bear.paw >= 0.3;
  const air = free && bear.baseY < GROUND && (bear.x < CRATE_EDGE || bear.baseY > 280);
  if (air) {
    bear.baseY += bear.fallV * dt + 0.5 * 900 * dt * dt; bear.fallV += 900 * dt;
    if (bear.baseY >= GROUND) { bear.baseY = GROUND; bear.fallV = 0; bear.landing.v = 12; }
  } else if (free) {
    const down = bear.baseY >= GROUND;
    bear.vx += ((down ? -90 : -150) - bear.vx) * (1 - Math.exp(-(down ? 5 : 12) * dt));
    bear.walked -= bear.vx * dt;
  }
  if (free) bear.x += bear.vx * dt;
  bear.gait += ((free && !air ? 1 : 0) - bear.gait) * (1 - Math.exp(-12 * dt));
  if (bear.mode === 'pulling' && bear.paw >= 1 && bear.baseY >= GROUND) { bear.mode = 'walking'; bear.age = 0; }
  if (bear.mode === 'walking' && bear.x < -60) bear.mode = 'gone';
  stepSpring(bear.shades, free || bear.mode === 'gone' ? 1 : 0, 12, 0.6, dt);
  stepSpring(bear.landing, 0, 14, 0.6, dt);
  if (bear.mode === 'trapped') bear.paw = Math.max(0, bear.paw - dt);
  // Stuck, he keeps trying: a tug every 3 s at the start, every 0.7 s as the tension tops out.
  if (bear.mode === 'stuck' && drive.running) {
    bear.tugIn -= dt;
    if (bear.tugIn <= 0) {
      bear.tugIn += mix(3, 0.7, drive.tension);
      bear.tug.v += 9;
      p.events.tug = true;
    }
  }
  stepSpring(bear.tug, 0, 9, 0.35, dt);
  stepSpring(bear.flinch, 0, 10, 0.4, dt);
  bear.breath += dt * (1.6 + 3.5 * drive.tension) * (1);
  const slow = 1;
  for (const [i, guest] of p.guests.entries()) {
    const want = drive.multiplier >= guest.at ? 1 : 0.05;
    const was = guest.lean.x > 0.5;
    stepSpring(guest.lean, guest.stuck ? 1 : want, 4, 0.8, dt);
    if (!was && guest.lean.x > 0.5 && drive.running) {
      p.events.guest = true;
      say(p, i, guest.line);
    }
    guest.sniff += dt * Math.PI * 2 * guest.rate * (guest.stuck ? 2.2 : 1 + drive.tension * 0.8) * slow;
  }
  p.puddle = clamp(p.puddle + dt * (drive.running ? 0.03 + drive.tension * 0.05 : 0), 0.2, 1);
  for (const bee of p.bees) {
    bee.angle += dt * bee.speed * (p.leaving ? 3 : 1 + drive.tension * 2) * (1);
    bee.wob += dt * bee.rate * slow;
  }
  if (p.leaving) {
    p.keeperX += 70 * dt;
    p.hiveX += (p.keeperX + 30 - p.hiveX) * (1 - Math.exp(-3 * dt));
  }
  // The swarm drifts to the jar at the crash (and on a long round's patrols) instead of jumping there.
  const round = drive.round ?? 0;
  const patrol = !p.leaving && round > 45 ? Math.max(0, Math.sin((round - 45) * Math.PI / 12)) : 0;
  const ease = 1 - Math.exp(-4 * dt);
  const swarm = p.swarm;
  swarm.x += ((p.leaving ? JAR.cx : mix(p.hiveX, JAR.cx, patrol)) - swarm.x) * ease;
  swarm.y += ((p.leaving ? 300 : mix(230, JAR.top - 18, patrol)) - swarm.y) * ease;
  swarm.spread += ((p.leaving ? 1.4 : 1) - swarm.spread) * ease;
  for (const s of p.says) s.age += dt;
  p.says = p.says.filter((s) => s.age < SAY_LIFE);
  stepFox(p, drive, dt);
  // The phone: a text from the dev at each of its multipliers, the phone buzzing on the blanket.
  const phone = p.phone;
  phone.age += dt;
  const count = TEXTS.filter((t) => drive.multiplier >= t.at).length;
  if (drive.running && !p.leaving && count > phone.count) {
    phone.count = count;
    phone.age = 0;
    phone.shake.v = 8;
    p.events.msg = true;
  }
  // The dev keeps posting, and the auditor returns, however long the room keeps running.
  if (drive.running && !p.leaving && count === TEXTS.length && phone.age >= 8) {
    phone.followup += 1;
    phone.age = 0;
    phone.shake.v = 8;
    p.events.msg = true;
    if (phone.followup % 3 === 0 && p.fox.mode === 'gone') {
      p.fox.mode = 'away';
      p.fox.stamped = false;
      p.fox.x = FOX_OFF;
    }
  }
  stepSpring(phone.shake, 0, 30, 0.2, dt);
  for (const d of p.drops) {
    d.age += dt;
    d.vy += 900 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
  }
  p.drops = p.drops.filter((d) => d.age < d.life);
}

/** Honey off the freed paw, a capped handful of drops. */
function flingHoney(p: Picnic, at: { x: number; y: number }): void {
  const rand = mulberry32(11);
  for (let i = 0; i < DROP_CAP; i += 1) {
    const a = -Math.PI * 0.9 + rand() * Math.PI * 0.8;
    const speed = 120 + rand() * 260;
    p.drops.push({ x: at.x, y: at.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, life: 0.5 + rand() * 0.5, r: 2 + rand() * 3 });
  }
}

/**
 * The auditor's round: in from the right at 1.5×, easing to a stop at the jar, the wind-up (arm raised over 0.45 s
 * and held), the slam on the glass at 0.75 s, the mark, then a turn and out to the right at 2.3×. He only ever
 * stamps; nothing he does touches the round.
 */
function stepFox(p: Picnic, drive: PicnicDrive, dt: number): void {
  const fox = p.fox;
  fox.age += dt;
  if (fox.mode === 'away' && drive.running && drive.multiplier >= FOX_IN) {
    Object.assign(fox, { mode: 'in', age: 0, x: FOX_START, vx: 0 });
  }
  stepSpring(fox.face, fox.mode === 'out' ? -1 : 1, 16, 0.85, dt);
  if (fox.mode === 'in') {
    // Up to speed in about 0.2 s, and braking so he stops on his mark rather than snapping to it.
    fox.vx = -Math.min(FOX_SPEED, -fox.vx + FOX_ACCEL * dt, Math.sqrt(2 * FOX_ACCEL * Math.max(0, fox.x - FOX_STAND)));
    fox.x = Math.max(FOX_STAND, fox.x + fox.vx * dt);
    if (fox.x <= FOX_STAND + 0.5) {
      fox.x = FOX_STAND;
      fox.vx = 0;
      if (drive.running && drive.multiplier >= FOX_STAMP) {
        fox.mode = 'stamping';
        fox.age = 0;
        say(p, 3, 'tokensniffer: 100/100');
      }
    }
  } else if (fox.mode === 'out') {
    // He stops and turns (called away mid-stride, he brakes first), then walks off to the right.
    const want = fox.face.x < 0.2 ? FOX_SPEED + 30 : 0;
    fox.vx += clamp(want - fox.vx, -2 * FOX_ACCEL * dt, FOX_ACCEL * dt);
    fox.x += fox.vx * dt;
    if (fox.x > FOX_OFF) fox.mode = 'gone';
  }
  fox.walked += Math.abs(fox.vx) * dt;
  let arm = 0;
  if (fox.mode === 'stamping') {
    // Up and held (anticipation), then down hard; the mark lands as the arm reaches the glass.
    arm = fox.age < 0.75 ? 1 : fox.age < 1.35 ? 2 : 0;
    if (fox.stamped && drive.running && drive.multiplier >= FOX_OUT && fox.age > 1.6) {
      fox.mode = 'out';
      fox.age = 0;
    }
  }
  stepSpring(fox.arm, arm, arm === 2 ? 16 : 10, arm === 2 ? 0.45 : 0.8, dt);
  if (arm === 2 && fox.arm.x >= 2) {
    fox.arm.x = 2; fox.arm.v = Math.min(0, fox.arm.v);
    if (!fox.stamped) { fox.stamped = true; p.events.stamp = true; }
  }
}

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

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): void {
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
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

export function drawBackground(ctx: CanvasRenderingContext2D, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, '#8fd0ff');
  sky.addColorStop(1, '#e7f6c9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(90, 80, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#67a85a';
  ctx.fillRect(0, 400, 960, 140);
  // Tree.
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(70, 250, 18, 160);
  ctx.fillStyle = '#2f7a3a';
  ctx.beginPath();
  ctx.arc(78, 230, 48, 0, Math.PI * 2);
  ctx.fill();
  // Blanket.
  const squares = 10;
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < squares; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f2efe4' : '#e05a4f';
      ctx.fillRect(250 + x * 28, 430 + y * 18, 28, 18);
    }
  }
  void time;
}

/** The lure: a hand-painted board on a stake between the hive's stump and the blanket, under the bees' orbit. */
function drawLureSign(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(220, 404);
  ctx.rotate(-0.05);
  ctx.fillStyle = '#6b4226';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.rect(-3, -54, 6, 58);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9a95f';
  ctx.beginPath();
  ctx.roundRect(-38, -102, 76, 50, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(107, 66, 38, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-34, -77);
  ctx.lineTo(34, -77);
  ctx.stroke();
  tracked(ctx, 'FREE HONEY', 0, -86, 11, '#c0392b');
  tracked(ctx, 'NO RUG', 0, -72, 11, INK);
  tracked(ctx, 'TRUST', 0, -58, 11, INK);
  ctx.restore();
}

/**
 * The body's offset from its feet: leaning back on a tug, breathing faster with the tension while stuck, the gait's
 * bob (up at mid-stance) once he walks, and a shiver that comes in over 0.3 s once he is trapped.
 */
function bearShift(p: Picnic, time: number): { dx: number; bob: number } {
  const b = p.bear;
  let bob = -b.gait * 2.5 * (0.5 - 0.5 * Math.cos(Math.PI * 4 * b.walked / BEAR_STRIDE));
  if (b.mode === 'stuck') bob += Math.sin(b.breath) * 0.9;
  if (b.mode === 'trapped') bob += Math.sin(time * 28) * 2 * clamp(b.age / 0.3, 0, 1);
  return { dx: -7 * b.tug.x, bob };
}

export function drawBear(ctx: CanvasRenderingContext2D, p: Picnic, level: number, time: number, tension = 0): void {
  const bear = p.bear;
  if (bear.mode === 'gone') return;
  void level;
  const { dx, bob } = bearShift(p, time);
  // Held until the paw tears out of the neck, so the fear lasts through the yank and lets go with the snap.
  const held = bear.mode === 'stuck' || bear.mode === 'trapped' || bear.mode === 'pulling' && bear.paw < 0.3;
  // Fear widens the eyes and the mouth from about 1.3×; a tug clenches the mouth; the lid's lurch startles them wider.
  const fear = held ? clamp(smoothstep(0.15, 0.75, tension) + bear.flinch.x * 0.5 + (bear.mode === 'trapped' ? 1 : 0), 0, 1.3) : 0;
  const strain = held ? clamp(bear.tug.x * 1.6, 0, 1) : 0;
  ctx.save();
  ctx.translate(bear.x + dx, bearBaseY(p) + bob);
  ink(ctx, 3);
  ctx.fillStyle = FUR;
  ctx.beginPath();
  ctx.ellipse(0, -40, 46, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Ears and head.
  ctx.beginPath();
  ctx.arc(-18, -92, 12, 0, Math.PI * 2);
  ctx.arc(18, -92, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -78, 28, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = MUZZLE;
  ctx.beginPath();
  ctx.ellipse(0, -68, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  if (fear > 0.05) {
    // The whites and the worried brows fade in rather than appearing at a threshold.
    ctx.globalAlpha = clamp((fear - 0.05) / 0.25, 0, 1);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-2, -71, 1.5 + 2 * fear, 0, Math.PI * 2);
    ctx.arc(6, -71, 1.5 + 2 * fear, 0, Math.PI * 2);
    ctx.fill();
    // Worried brows, the inner ends lifting.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -76 - fear);
    ctx.lineTo(-1, -79 - 3 * fear);
    ctx.moveTo(6, -79 - 3 * fear);
    ctx.lineTo(13, -76 - fear);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-2, -70, 2, 0, Math.PI * 2);
  ctx.arc(6, -70, 2, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 3);
  ctx.beginPath();
  if (bear.mode === 'trapped') ctx.ellipse(2, -62, 4, 6, 0, 0, Math.PI * 2);
  else ctx.ellipse(2, -62, 4 + 2 * strain, mix(2 + 2 * fear, 1, strain), 0, 0, Math.PI * 2);
  ctx.stroke();
  // Sweat from about 1.45×, more of it by 2.2×.
  const sweat = held ? smoothstep(0.3, 0.55, tension) * 3 : 0;
  for (let i = 0; i < sweat; i += 1) {
    const u = (time * 0.8 + i * 0.37) % 1;
    ctx.globalAlpha = Math.min(1, sweat - i) * (1 - u);
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.ellipse(i === 1 ? 25 : i * 4 - 25, -92 + i * 5 + u * 22, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ink(ctx, 3);
  // Bucket hat.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.ellipse(0, -96, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-16, -112, 32, 16, 4);
  ctx.fill();
  ctx.stroke();
  if (bear.shades.x > 0.05) {
    const dy = -18 * (1 - bear.shades.x);
    ctx.fillStyle = '#111';
    ctx.fillRect(-16, -82 + dy, 12, 7);
    ctx.fillRect(2, -82 + dy, 12, 7);
  }
  // Feet placed by the ground covered (he walks left), each planted while the body passes over it; standing, the
  // knees point out, walking they swing round to point the way he goes.
  for (const side of [-1, 1]) {
    const step = stepFoot(bear.walked, BEAR_STRIDE, side > 0 ? 0.5 : 0, 8);
    const foot = { x: side * mix(18, 13, bear.gait) - step.x * bear.gait - dx, y: 8 + step.y * bear.gait - p.bear.landing.x * 4 - bob };
    limb(ctx, { x: side * 12, y: -16 }, foot, 16, 15, mix(-side, 1, bear.gait), 8, FUR);
    ctx.fillStyle = FUR;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y + 2, 8, 4, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  if (bear.mode === 'walking' || bear.mode === 'pulling' && bear.paw >= 0.3) {
    // A little jar under the arm, the one he actually got out with.
    ctx.fillStyle = '#f0b030';
    ctx.beginPath();
    ctx.roundRect(bear.x + 24, bearBaseY(p) + bob - 30, 22, 26, 4);
    ctx.fill();
    ctx.stroke();
  }
}
/** The mouth stays reachable without changing the length of either arm bone. */
export function bearBaseY(p: Picnic): number {
  return p.bear.baseY + p.bear.landing.x * 4;
}
export function bearReach(p: Picnic, level: number, time = 0): { shoulder: Point; paw: Point; elbow: Point } {
  const { dx, bob } = bearShift(p, time);
  const shoulder = { x: p.bear.x + dx + 26, y: bearBaseY(p) - 30 + bob };
  const paw = pawPoint(p, level);
  return { shoulder, paw, elbow: bendJoint(shoulder, paw, 56, 56, -1) };
}

/** Draw between the rear honey and front glass, so the trapped paw remains visible. */
export function drawBearReach(ctx: CanvasRenderingContext2D, p: Picnic, level: number, time = 0): void {
  if (p.bear.mode === 'gone') return;
  const { shoulder, paw } = bearReach(p, level, time);
  limb(ctx, shoulder, paw, 56, 56, -1, 10, FUR);
  ctx.fillStyle = MUZZLE;
  ink(ctx, 2);
  ctx.beginPath(); ctx.ellipse(paw.x, paw.y, 12, 8, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

/** Where a guest is: from its seat to the puddle's edge as it leans in. */
function guestX(g: Guest): number {
  return mix(g.home, g.edge, clamp((g.lean.x - 0.05) / 0.95, 0, 1));
}

function drawGuest(ctx: CanvasRenderingContext2D, guest: Guest): void {
  // Drawn facing +x and mirrored to face the jar; it tips toward the jar about its feet.
  const dir = Math.sign(JAR.cx - guest.home);
  const lean = clamp(guest.lean.x, 0, 1.2);
  // Hops on the way to the puddle, as many as the distance takes, ending on the ground.
  const u = clamp((guest.lean.x - 0.05) / 0.95, 0, 1);
  const hop = guest.stuck ? 0 : Math.abs(Math.sin(Math.PI * Math.max(1, Math.round(Math.abs(guest.edge - guest.home) / 34)) * u)) * 6;
  const s = Math.sin(guest.sniff);
  ctx.save();
  ctx.translate(guestX(guest), 455 - lean * 10 - hop);
  ctx.rotate(dir * (lean * 0.35 + (guest.stuck ? s * 0.06 : 0)));
  ctx.scale(1.7 * dir, 1.7);
  ink(ctx, 2);
  if (guest.kind === 'frog') {
    // Pepe: the throat pumps, the lids sit heavy, the lips are his.
    ctx.fillStyle = '#6fbf4a';
    ctx.beginPath();
    ctx.ellipse(0, -16, 16, 12 + s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-10, -28, 7, 0, Math.PI * 2);
    ctx.arc(10, -28, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-9, -27, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(11, -27, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-7, -27, 1.8, 0, Math.PI * 2);
    ctx.arc(13, -27, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b5523b';
    ctx.beginPath();
    ctx.ellipse(4, -10, 10, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (guest.kind === 'goose') {
    // The neck bobs.
    const hx = 6 + s * 1.2, hy = -36 + Math.abs(s) * 1.5;
    ctx.strokeStyle = '#f4f4f4';
    ctx.fillStyle = '#f7f7f7';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0, -18, hx - 6, hy + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(hx, hy, 10, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f0a020';
    ctx.beginPath();
    ctx.moveTo(hx + 8, hy);
    ctx.lineTo(hx + 22, hy + 4);
    ctx.lineTo(hx + 8, hy + 6);
    ctx.fill();
  } else {
    // The raccoon's nose twitches; the ringed tail flicks.
    const n = s * 1.1;
    ctx.fillStyle = '#6d6a66';
    ctx.save();
    ctx.translate(-16, -10);
    ctx.rotate(-0.5 + s * 0.12);
    ctx.beginPath();
    ctx.ellipse(-9, 0, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    for (const r of [-14, -6]) ctx.fillRect(r, -4.5, 3, 9);
    ctx.restore();
    ctx.fillStyle = '#6d6a66';
    ctx.beginPath();
    ctx.arc(2, -29, 4, 0, Math.PI * 2);
    ctx.moveTo(17, -29);
    ctx.arc(13, -29, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -14, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(8 + n * 0.4, -22, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath();
    ctx.ellipse(10 + n, -18, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (guest.stuck) {
    ctx.fillStyle = '#c9842a';
    ctx.beginPath();
    ctx.ellipse(16, 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A speech bubble with its tail down to (x, y + 18), kept on screen. */
function bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number, dark: boolean): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 12px system-ui, sans-serif';
  const width = Math.min(200, ctx.measureText(text).width + 16);
  const cx = clamp(x, width / 2 + 8, 952 - width / 2);
  ctx.translate(cx, y);
  ctx.fillStyle = dark ? '#3a3f4a' : '#ffffff';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.roundRect(-width / 2, -11, width, 22, 8);
  ctx.moveTo(x - cx - 6, 11);
  ctx.lineTo(x - cx, 18);
  ctx.lineTo(x - cx + 6, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark ? '#f4f7fb' : INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0, width - 16);
  ctx.restore();
}

/** The honey off the freed paw, the dev's texts, and what the guests and the auditor say, over everything (the jar included). */
export function drawFront(ctx: CanvasRenderingContext2D, p: Picnic): void {
  ctx.fillStyle = '#f0b030';
  for (const d of p.drops) {
    ctx.globalAlpha = clamp(1 - d.age / d.life, 0, 1);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const phone = p.phone;
  const text = phone.last ? LAST_TEXT : phone.followup >= 0 ? FOLLOWUPS[phone.followup % FOLLOWUPS.length]! : phone.count > 0 ? TEXTS[phone.count - 1]!.text : null;
  const rise = clamp(phone.age / 0.25, 0, 1);
  if (text !== null) bubble(ctx, text, 392, 452 - (1 - rise) * 8, rise, phone.last);
  for (const s of p.says) {
    const rise = clamp(s.age / 0.2, 0, 1);
    const alpha = rise * clamp((SAY_LIFE - s.age) / 0.35, 0, 1);
    const guest = p.guests[s.who];
    const x = guest ? guestX(guest) : p.fox.x - 4;
    const y = guest ? [384, 376, 350][s.who]! : 292;
    bubble(ctx, s.text, x, y - (1 - rise) * 8, alpha, false);
  }
}

/** The stamp face reaches AUDIT_AT with unchanged 40px arm bones. */
export function foxArmPose(fox: Fox, bob = 0) {
  const u = clamp(fox.arm.x, 0, 2), x = fox.x;
  const shoulder = { x: x - 12, y: 362 - bob }, hang = { x: x - 26, y: 396 - bob }, up = { x: x - 44, y: 298 - bob };
  const slam = { x: AUDIT_AT.x + 28, y: AUDIT_AT.y };
  const target = u < 1 ? { x: mix(hang.x, up.x, u), y: mix(hang.y, up.y, u) } : { x: mix(up.x, slam.x, u - 1), y: mix(up.y, slam.y, u - 1) };
  const distance = Math.hypot(target.x - shoulder.x, target.y - shoulder.y), reach = Math.min(1, 79.9 / Math.max(0.001, distance));
  const hand = { x: mix(shoulder.x, target.x, reach), y: mix(shoulder.y, target.y, reach) };
  const angle = u < 1 ? -0.4 * u : mix(-0.4, -Math.PI / 2, u - 1);
  return { shoulder, hand, elbow: bendJoint(shoulder, hand, 40, 40, 1), angle, face: { x: hand.x + Math.sin(angle) * 28, y: hand.y - Math.cos(angle) * 28 } };
}

/** The auditor at his feet: suit, tie, briefcase, and the stamp arm on its path to the glass. Drawn over the jar, so the stamp lands on the glass rather than behind the honey. */
export function drawFox(ctx: CanvasRenderingContext2D, p: Picnic): void {
  const fox = p.fox;
  if (fox.mode === 'away' || fox.mode === 'gone') return;
  const x = fox.x;
  // The walk blends in with his speed: a slight crouch, a bob up at mid-stance, feet placed by the ground covered.
  const w = smoothstep(0, 60, Math.abs(fox.vx));
  const bob = w * 1.5 * (0.5 - 0.5 * Math.cos(Math.PI * 4 * fox.walked / FOX_STRIDE));
  const crouch = w * 4;
  ctx.save();
  // Drawn facing left; the turn to leave mirrors him about his middle, the stamp arm with him (never past full width,
  // where the turn's overshoot would stretch his bones).
  ctx.translate(x, 0);
  ctx.scale(clamp(fox.face.x, -1, 1), 1);
  ctx.translate(-x, 0);
  ctx.save();
  ctx.translate(x, 430 - bob + crouch);
  ink(ctx, 2.5);
  // Legs in suit trousers, the knees bending the way he faces.
  for (const side of [-1, 1]) {
    const step = stepFoot(fox.walked, FOX_STRIDE, side > 0 ? 0.5 : 0, 7);
    const foot = { x: side * mix(9, 3, w) - step.x * w, y: 4 + bob - crouch + step.y * w };
    limb(ctx, { x: side * 6, y: -30 }, foot, 18, 17, 1, 6, '#3a3f47');
    ctx.fillStyle = '#1c1f26';
    ctx.beginPath();
    ctx.ellipse(foot.x - 2, foot.y + 3, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Jacket, shirt, tie.
  ctx.fillStyle = '#3a3f47';
  ctx.beginPath();
  ctx.roundRect(-17, -76, 34, 50, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.moveTo(-6, -76);
  ctx.lineTo(6, -76);
  ctx.lineTo(0, -50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-3, -74);
  ctx.lineTo(3, -74);
  ctx.lineTo(1, -52);
  ctx.lineTo(-1, -52);
  ctx.closePath();
  ctx.fill();
  // Briefcase in the far hand, its score on the side, the lettering kept the right way round when he turns.
  ctx.fillStyle = '#6b4226';
  ctx.beginPath();
  ctx.roundRect(6, -50, 30, 22, 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(21, -41);
  ctx.scale(fox.face.x < 0 ? -1 : 1, 1);
  tracked(ctx, 'AUDIT', 0, 0, 7, '#f0c14a', undefined, 26);
  tracked(ctx, '100/100', 0, 9, 7, '#9fe08a', undefined, 26);
  ctx.restore();
  // Head: pointed ears, orange, white muzzle, a tiny pair of glasses.
  ctx.fillStyle = '#e07a2e';
  ctx.beginPath();
  ctx.moveTo(-16, -92);
  ctx.lineTo(-10, -112);
  ctx.lineTo(-2, -94);
  ctx.moveTo(16, -92);
  ctx.lineTo(10, -112);
  ctx.lineTo(2, -94);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -88, 18, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7f1e4';
  ctx.beginPath();
  ctx.ellipse(-9, -82, 9, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-16, -83, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-4, -92, 4, 0, Math.PI * 2);
  ctx.moveTo(1, -92);
  ctx.lineTo(4, -92);
  ctx.arc(8, -92, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // The stamp arm: hanging, raised, or on the glass, in scene coordinates so it reaches the jar.
  const { shoulder, hand, angle } = foxArmPose(fox, bob - crouch);
  limb(ctx, shoulder, hand, 40, 40, 1, 7, '#3a3f47');
  // The stamp itself: a handle and a rubber base, angled to the glass.
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  ctx.fillStyle = '#e07a2e';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6b4226';
  ctx.beginPath();
  ctx.roundRect(-5, -22, 10, 22, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2f7a3a';
  ctx.beginPath();
  ctx.roundRect(-14, -28, 28, 8, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** The bear's phone face up on the blanket, buzzing with the dev's texts (their bubbles go on in the front layer). */
function drawPhone(ctx: CanvasRenderingContext2D, p: Picnic): void {
  const phone = p.phone;
  const shake = phone.shake.x;
  ctx.save();
  ctx.translate(392 + Math.sin(shake * 40) * 2 * Math.min(1, Math.abs(shake)), 484);
  ctx.rotate(0.35 + shake * 0.08);
  ctx.fillStyle = '#17191e';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(-10, -18, 20, 36, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = phone.age < 0.6 ? '#dff6ff' : '#8fd0ff';
  ctx.fillRect(-7, -14, 14, 26);
  ctx.restore();
}

/** The flies that find the dev once the honey has gone bad. */
function drawFlies(ctx: CanvasRenderingContext2D, p: Picnic, time: number): void {
  if (p.flies <= 0 || p.keeperX > 990) return;
  ctx.fillStyle = '#1c1f26';
  for (let i = 0; i < p.flies; i += 1) {
    const a = time * (5 + i) + i * 1.3;
    const jx = (noise(Math.floor(time * 20) + i * 7) - 0.5) * 8;
    const jy = (noise(Math.floor(time * 17) + i * 3) - 0.5) * 8;
    const x = p.keeperX + Math.cos(a) * (18 + i * 5) + jx;
    const y = 360 + Math.sin(a * 1.3) * 16 + jy;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawPicnic(ctx: CanvasRenderingContext2D, p: Picnic, level: number, time: number, tension: number): void {
  drawBackground(ctx, time);
  // Puddle of honey on the blanket. Guests stick to this, not to each other.
  ctx.fillStyle = `rgba(240, 176, 48, ${0.35 + p.puddle * 0.4})`;
  ctx.beginPath();
  ctx.ellipse(560, 470, 70 + p.puddle * 80, 16 + p.puddle * 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hive on the stump, until the beekeeper takes it.
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(p.hiveX - 8, 300, 16, 50);
  ctx.fillStyle = '#f0c14a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(p.hiveX, 250, 28, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#a87420';
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(p.hiveX - 20, 250 + i * 12);
    ctx.lineTo(p.hiveX + 20, 250 + i * 12);
    ctx.stroke();
  }
  drawLureSign(ctx);
  // The swarm grows with the tension, each new bee fading in rather than popping; each one wobbles off its ring.
  const count = 8 + tension * 20;
  const { x: sx, y: sy, spread } = p.swarm;
  for (let i = 0; i < Math.min(count, p.bees.length); i += 1) {
    const bee = p.bees[i]!;
    const size = bee.size * clamp(count - i, 0, 1);
    const r = (bee.orbit + Math.sin(bee.wob) * 6) * spread;
    const x = sx + Math.cos(bee.angle) * r;
    const y = sy + Math.sin(bee.angle) * r * 0.55 + Math.sin(bee.wob * 1.7 + i) * 3;
    ctx.save();
    ctx.translate(x, y);
    // Nose along its path round the ring.
    ctx.rotate(Math.atan2(Math.cos(bee.angle) * 0.55, -Math.sin(bee.angle)));
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-size, -2, size * 2, 4);
    ctx.fillStyle = '#222';
    ctx.fillRect(-2, -2, 3, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(-3, -6);
    ctx.moveTo(0, -2);
    ctx.lineTo(3, -6);
    ctx.stroke();
    ctx.restore();
  }
  drawPhone(ctx, p);
  ctx.fillStyle = '#8b613b'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.fillRect(354, 294, 130, 137); ctx.strokeRect(354, 294, 130, 137);
  ctx.beginPath(); ctx.moveTo(360, 300); ctx.lineTo(478, 425); ctx.moveTo(478, 300); ctx.lineTo(360, 425); ctx.stroke();
  // The guests sit in front of the crate's foot.
  for (const guest of p.guests) drawGuest(ctx, guest);
  drawBear(ctx, p, level, time, tension);
  ctx.save();
  ctx.translate(p.keeperX, 430);
    ctx.fillStyle = '#f7f7f2';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.ellipse(0, -50, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // The beekeeper is the dev: it is stencilled on the suit.
    tracked(ctx, 'DEV', 0, -45, 12, '#3a3f47');
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath();
    ctx.arc(0, -78, 16, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(-14, -86, 28, 8);
  ctx.restore();
  drawFlies(ctx, p, time);
}
