/**
 * The picnic: the bear whose paw is in the jar, the guests who lean in
 * and stick, the hive with its lure sign, the swarm and the beekeeper (the
 * dev) who leaves with it.
 */
import { AUDIT_AT, JAR, surfaceY, tracked } from './jar';
import { clamp, mix, mulberry32, noise, settleSpring, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const FUR = '#8d5a32';
const MUZZLE = '#f0d2a8';

export type BearMode = 'stuck' | 'pulling' | 'walking' | 'gone' | 'trapped';

export interface Bear {
  mode: BearMode;
  age: number;
  x: number;
  paw: number;
  shades: Spring;
}

export interface Guest {
  kind: 'raccoon' | 'frog' | 'goose';
  x: number;
  at: number;
  lean: Spring;
  stuck: boolean;
}

interface Bee { angle: number; orbit: number; speed: number; size: number; }
/** A honey drop flung off the freed paw. */
interface Drop { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; }

export type FoxMode = 'away' | 'in' | 'stamping' | 'out' | 'gone';

/** The auditor: a fox in a suit who walks in before 3×, stamps the jar at 3× and leaves. */
export interface Fox {
  mode: FoxMode;
  x: number;
  /** The stamp arm along its path: 0 hanging, 1 raised (the wind-up), 2 on the glass. */
  arm: Spring;
  age: number;
  stamped: boolean;
  stride: number;
}

/** The dev's texts to the bear's phone, by multiplier. */
export const TEXTS: { at: number; text: string }[] = [
  { at: 4, text: 'DEV: trust me bro' },
  { at: 6, text: 'DEV: the lid is a feature' },
  { at: 9, text: 'DEV: sell tax is love' },
  { at: 14, text: 'DEV: wen? soon™' },
];
const LAST_TEXT = 'DEV left the chat';
/** Where the fox stands to reach the jar, and where he waits off screen. */
const FOX_STAND = 655;
const FOX_OFF = 1040;
/** He walks in from this multiplier, stamps from this one, and leaves at this one. */
const FOX_IN = 2.4;
const FOX_STAMP = 3;
const FOX_OUT = 3.6;
const DROP_CAP = 30;

export interface Picnic {
  bear: Bear;
  guests: Guest[];
  bees: Bee[];
  keeperX: number;
  hiveX: number;
  leaving: boolean;
  puddle: number;
  fox: Fox;
  phone: { shake: Spring; count: number; age: number; last: boolean };
  drops: Drop[];
  flies: number;
  events: { stamp: boolean; msg: boolean; pawFree: boolean; guest: boolean };
}

export function createPicnic(): Picnic {
  return {
    bear: { mode: 'stuck', age: 0, x: 300, paw: 0, shades: spring(0) },
    guests: [
      { kind: 'raccoon', x: 210, at: 2.2, lean: spring(0), stuck: false },
      { kind: 'frog', x: 700, at: 4.2, lean: spring(0), stuck: false },
      { kind: 'goose', x: 800, at: 8, lean: spring(0), stuck: false },
    ],
    bees: Array.from({ length: 28 }, (_, i) => ({
      angle: i * 0.7,
      orbit: 36 + (i % 5) * 16,
      speed: 0.8 + (i % 4) * 0.35,
      size: 3 + (i % 3),
    })),
    keeperX: 40,
    hiveX: 168,
    leaving: false,
    puddle: 0.2,
    fox: { mode: 'away', x: FOX_OFF, arm: spring(0), age: 0, stamped: false, stride: 0 },
    phone: { shake: spring(0), count: 0, age: 9, last: false },
    drops: [],
    flies: 0,
    events: { stamp: false, msg: false, pawFree: false, guest: false },
  };
}

export function resetPicnic(p: Picnic): void {
  Object.assign(p, createPicnic());
}

/** The bear who got out: paw free, shades on, off the blanket. */
function leaveBear(bear: Bear): void {
  bear.mode = 'gone';
  bear.x = -80;
  bear.paw = 1;
  bear.shades.x = 1;
}

export function pullPaw(p: Picnic): void {
  if (p.bear.mode === 'stuck') {
    p.bear.mode = 'pulling';
    p.bear.age = 0;
  }
}

export function trapPicnic(p: Picnic, quiet: boolean, escaped: boolean): void {
  p.leaving = true;
  if (!escaped && p.bear.mode !== 'gone' && p.bear.mode !== 'walking') p.bear.mode = 'trapped';
  for (const guest of p.guests) if (guest.lean.x > 0.35) guest.stuck = true;
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
    if (escaped) leaveBear(p.bear);
  }
}

/**
 * Jumps the picnic to where a round that has run `seconds` to this multiplier has it: the guests leaning in, the
 * puddle spread, and a bear who has already cashed out gone. For a round met late rather than watched.
 */
export function settlePicnic(p: Picnic, multiplier: number, tension: number, seconds: number, escaped: boolean): void {
  for (const guest of p.guests) settleSpring(guest.lean, multiplier >= guest.at ? 1 : 0.05);
  // The tension climbs in step with time, so on average the puddle has spread at the rate for half the tension it has now.
  p.puddle = clamp(0.2 + seconds * (0.04 + tension * 0.04), 0.2, 1);
  if (escaped) leaveBear(p.bear);
  // The auditor where the multiplier has him: not yet, standing by, stamped, or gone.
  const fox = p.fox;
  if (multiplier >= FOX_OUT) {
    fox.mode = 'gone';
    fox.x = FOX_OFF;
    fox.stamped = true;
  } else if (multiplier >= FOX_STAMP) {
    fox.mode = 'stamping';
    fox.x = FOX_STAND;
    fox.stamped = true;
    fox.age = 3;
  } else if (multiplier >= FOX_IN) {
    fox.mode = 'in';
    fox.x = FOX_STAND;
  }
  p.phone.count = TEXTS.filter((t) => multiplier >= t.at).length;
  p.phone.age = 9;
}

/** Whether the jar already carries the auditor's mark, for a round met late. */
export function auditDone(p: Picnic): boolean {
  return p.fox.stamped;
}

/** `reduced` (prefers-reduced-motion) slows the swarm. */
export interface PicnicDrive { running: boolean; multiplier: number; tension: number; level: number; reduced: boolean; }

export function pawPoint(p: Picnic, level: number): { x: number; y: number } {
  const inside = { x: JAR.cx - 10, y: surfaceY(level) + 16 };
  const free = { x: p.bear.x + 70, y: 400 };
  const t = p.bear.paw;
  return { x: inside.x + (free.x - inside.x) * t, y: inside.y + (free.y - inside.y) * t };
}

export function stepPicnic(p: Picnic, drive: PicnicDrive, dt: number): void {
  p.events = { stamp: false, msg: false, pawFree: false, guest: false };
  const bear = p.bear;
  bear.age += dt;
  stepSpring(bear.shades, bear.mode === 'walking' || bear.mode === 'gone' ? 1 : 0, 12, 0.6, dt);
  if (bear.mode === 'pulling') {
    // The pull eases in, so the paw tears free with a snap rather than sliding out.
    bear.paw = Math.min(1, bear.paw + dt * (0.5 + bear.paw * 1.2));
    if (bear.paw >= 1) {
      bear.mode = 'walking';
      bear.age = 0;
      p.events.pawFree = true;
      flingHoney(p, pawPoint(p, drive.level));
    }
  }
  if (bear.mode === 'walking') {
    bear.x -= 120 * dt;
    if (bear.x < -60) bear.mode = 'gone';
  }
  if (bear.mode === 'trapped') bear.paw = Math.max(0, bear.paw - dt);
  for (const guest of p.guests) {
    const want = drive.multiplier >= guest.at ? 1 : 0.05;
    const was = guest.lean.x > 0.5;
    stepSpring(guest.lean, guest.stuck ? 1 : want, 4, 0.8, dt);
    if (!was && guest.lean.x > 0.5 && drive.running) p.events.guest = true;
  }
  p.puddle = clamp(p.puddle + dt * (drive.running ? 0.04 + drive.tension * 0.08 : 0), 0.2, 1);
  for (const bee of p.bees) bee.angle += dt * bee.speed * (p.leaving ? 3 : 1 + drive.tension * 2) * (drive.reduced ? 0.2 : 1);
  if (p.leaving) {
    p.keeperX += 70 * dt;
    p.hiveX += (p.keeperX + 30 - p.hiveX) * clamp(dt * 3, 0, 1);
  }
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
 * The auditor's round: in from the right before 3×, the wind-up (arm raised and held), the slam on the glass at 3×,
 * the mark, and out to the right at 3.6×. He only ever stamps; nothing he does touches the round.
 */
function stepFox(p: Picnic, drive: PicnicDrive, dt: number): void {
  const fox = p.fox;
  fox.age += dt;
  const walking = fox.mode === 'in' && fox.x > FOX_STAND + 1 || fox.mode === 'out';
  fox.stride = walking ? fox.stride + dt * 11 : 0;
  if (fox.mode === 'away' && drive.running && drive.multiplier >= FOX_IN) {
    fox.mode = 'in';
    fox.age = 0;
  }
  if (fox.mode === 'in') {
    fox.x = Math.max(FOX_STAND, fox.x - 170 * dt);
    if (fox.x <= FOX_STAND + 1 && drive.running && drive.multiplier >= FOX_STAMP) {
      fox.mode = 'stamping';
      fox.age = 0;
    }
  }
  let arm = 0;
  if (fox.mode === 'stamping') {
    // Up and held (anticipation), then down hard; the mark lands as the arm reaches the glass.
    arm = fox.age < 0.5 ? 1 : fox.age < 1.3 ? 2 : 0;
    if (!fox.stamped && fox.arm.x > 1.82) {
      fox.stamped = true;
      p.events.stamp = true;
    }
    if (fox.stamped && drive.running && drive.multiplier >= FOX_OUT && fox.age > 1.6) {
      fox.mode = 'out';
      fox.age = 0;
    }
  }
  stepSpring(fox.arm, arm, arm === 2 ? 16 : 6, arm === 2 ? 0.45 : 0.7, dt);
  if (fox.mode === 'out') {
    fox.x += 220 * dt;
    if (fox.x > FOX_OFF) fox.mode = 'gone';
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

function drawBear(ctx: CanvasRenderingContext2D, p: Picnic, level: number, time: number): void {
  const bear = p.bear;
  if (bear.mode === 'gone') return;
  const paw = pawPoint(p, level);
  const bob = bear.mode === 'walking' ? Math.sin(bear.age * 12) * 3 : bear.mode === 'trapped' ? Math.sin(time * 28) * 2 : 0;
  ctx.save();
  ctx.translate(bear.x, 430 + bob);
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
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-2, -70, 2, 0, Math.PI * 2);
  ctx.arc(6, -70, 2, 0, Math.PI * 2);
  ctx.fill();
  const mouth = bear.mode === 'trapped' ? 6 : 2;
  ctx.beginPath();
  ctx.ellipse(2, -62, 4, mouth, 0, 0, Math.PI * 2);
  ctx.stroke();
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
  const walking = bear.mode === 'walking';
  const stride = walking ? bear.age * 10 : 0;
  for (const side of [-1, 1]) {
    const phase = stride + (side > 0 ? Math.PI : 0);
    const lift = walking ? Math.max(0, Math.sin(phase)) * 8 : 0;
    const reach = walking ? -Math.cos(phase) * 6 : 0;
    const foot = { x: side * 18 + reach, y: 8 - lift };
    limb(ctx, { x: side * 12, y: -16 }, foot, 16, 15, foot.y >= -16 ? -side : side, 8, FUR);
    ctx.fillStyle = FUR;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y + 2, 8, 4, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  // Two-bone reach into the jar. The jar is drawn later, so the paw reads as inside it.
  const shoulder = { x: bear.x + 26, y: 400 + bob };
  const span = Math.hypot(paw.x - shoulder.x, paw.y - shoulder.y);
  const bone = Math.max(24, span * 0.54);
  // Elbow sags under the reach instead of spearing up over the jar.
  limb(ctx, shoulder, paw, bone, bone, paw.y < shoulder.y ? 1 : -1, 10, FUR);
  ctx.fillStyle = MUZZLE;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(paw.x, paw.y, 12, 8, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (bear.mode === 'walking') {
    // A little jar under the arm, the one he actually got out with.
    ctx.fillStyle = '#f0b030';
    ctx.beginPath();
    ctx.roundRect(bear.x + 24, 400, 22, 26, 4);
    ctx.fill();
    ctx.stroke();
  }
}

function drawGuest(ctx: CanvasRenderingContext2D, guest: Guest, time: number): void {
  const lean = guest.lean.x * 36;
  const y = 455 - lean * 0.3;
  ctx.save();
  ctx.translate(guest.x + lean * 0.3, y);
  ctx.scale(1.7, 1.7);
  ctx.rotate(-guest.lean.x * 0.35);
  ink(ctx, 2);
  if (guest.kind === 'frog') {
    ctx.fillStyle = '#6fbf4a';
    ctx.beginPath();
    ctx.ellipse(0, -16, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-10, -28, 7, 0, Math.PI * 2);
    ctx.arc(10, -28, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (guest.kind === 'goose') {
    ctx.strokeStyle = '#f4f4f4';
    ctx.fillStyle = '#f7f7f7';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -30);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(6, -36, 10, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f0a020';
    ctx.beginPath();
    ctx.moveTo(14, -36);
    ctx.lineTo(28, -32);
    ctx.lineTo(14, -30);
    ctx.fill();
  } else {
    ctx.fillStyle = '#6d6a66';
    ctx.beginPath();
    ctx.ellipse(0, -14, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(8, -22, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath();
    ctx.ellipse(10, -18, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (guest.stuck) {
    ctx.fillStyle = '#c9842a';
    ctx.beginPath();
    ctx.ellipse(16, 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  void time;
}

/** The auditor at his feet: suit, tie, briefcase, and the stamp arm on its path to the glass. Drawn over the jar, so the stamp lands on the glass rather than behind the honey. */
export function drawFox(ctx: CanvasRenderingContext2D, p: Picnic): void {
  const fox = p.fox;
  if (fox.mode === 'away' || fox.mode === 'gone') return;
  const x = fox.x;
  const bob = fox.stride > 0 ? Math.abs(Math.sin(fox.stride)) * 3 : 0;
  ctx.save();
  ctx.translate(x, 430 - bob);
  ink(ctx, 2.5);
  // Legs in suit trousers.
  for (const side of [-1, 1]) {
    const phase = fox.stride + (side > 0 ? Math.PI : 0);
    const lift = fox.stride > 0 ? Math.max(0, Math.sin(phase)) * 7 : 0;
    const reach = fox.stride > 0 ? -Math.cos(phase) * 6 : 0;
    const foot = { x: side * 9 + reach, y: 4 - lift };
    limb(ctx, { x: side * 6, y: -30 }, foot, 18, 17, foot.y >= -30 ? -side : side, 6, '#3a3f47');
    ctx.fillStyle = '#1c1f26';
    ctx.beginPath();
    ctx.ellipse(foot.x + 2, foot.y + 3, 7, 3, 0, 0, Math.PI * 2);
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
  // Briefcase in the far hand.
  ctx.fillStyle = '#6b4226';
  ctx.beginPath();
  ctx.roundRect(8, -46, 22, 16, 2);
  ctx.fill();
  ctx.stroke();
  tracked(ctx, 'AUDIT', 19, -35, 7, '#f0c14a');
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
  const u = clamp(fox.arm.x, -0.2, 2.25);
  const shoulder = { x: x - 12, y: 430 - bob - 68 };
  const hang = { x: x - 26, y: 430 - bob - 34 };
  const up = { x: x - 44, y: 430 - bob - 132 };
  const slam = { x: AUDIT_AT.x + 44, y: AUDIT_AT.y };
  const hand = u < 1 ? { x: mix(hang.x, up.x, u), y: mix(hang.y, up.y, u) } : { x: mix(up.x, slam.x, u - 1), y: mix(up.y, slam.y, u - 1) };
  const span = Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y);
  const bone = Math.max(22, span * 0.53);
  limb(ctx, shoulder, hand, bone, bone, 1, 7, '#3a3f47');
  // The stamp itself: a handle and a rubber base, angled to the glass.
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(u < 1 ? -0.4 * u : -0.4 + (u - 1) * 1.2);
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
}

/** The bear's phone face up on the blanket, buzzing with the dev's texts. */
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
  const text = phone.last ? LAST_TEXT : phone.count > 0 ? TEXTS[phone.count - 1]!.text : null;
  if (text === null) return;
  const rise = clamp(phone.age / 0.25, 0, 1);
  ctx.save();
  ctx.globalAlpha = rise;
  ctx.translate(392, 452 - (1 - rise) * 8);
  ctx.font = '700 12px system-ui, sans-serif';
  const width = Math.min(200, ctx.measureText(text).width + 16);
  ctx.fillStyle = phone.last ? '#3a3f4a' : '#ffffff';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.roundRect(-width / 2, -11, width, 22, 8);
  ctx.moveTo(-6, 11);
  ctx.lineTo(0, 18);
  ctx.lineTo(6, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = phone.last ? '#f4f7fb' : INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0, width - 16);
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
  const count = Math.round(8 + tension * 20);
  for (let i = 0; i < count; i += 1) {
    const bee = p.bees[i % p.bees.length]!;
    const homeX = p.leaving ? JAR.cx : p.hiveX;
    const homeY = p.leaving ? 300 : 230;
    const x = homeX + Math.cos(bee.angle) * bee.orbit * (p.leaving ? 1.4 : 1);
    const y = homeY + Math.sin(bee.angle) * bee.orbit * 0.55;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bee.angle);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-bee.size, -2, bee.size * 2, 4);
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
  for (const guest of p.guests) drawGuest(ctx, guest, time);
  drawPhone(ctx, p);
  drawBear(ctx, p, level, time);
  // Honey off the paw.
  ctx.fillStyle = '#f0b030';
  for (const d of p.drops) {
    ctx.globalAlpha = clamp(1 - d.age / d.life, 0, 1);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
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
