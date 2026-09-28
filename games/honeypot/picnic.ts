/**
 * The picnic: the bear whose paw is in the jar, the guests who lean in
 * and stick, the hive, the swarm and the beekeeper who leaves with it.
 */
import { JAR, surfaceY } from './jar';
import { clamp, settleSpring, spring, stepSpring, type Spring } from './motion';

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

export interface Picnic {
  bear: Bear;
  guests: Guest[];
  bees: Bee[];
  keeperX: number;
  hiveX: number;
  leaving: boolean;
  puddle: number;
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
  };
}

export function resetPicnic(p: Picnic): void {
  const fresh = createPicnic();
  p.bear = fresh.bear;
  p.guests = fresh.guests;
  p.bees = fresh.bees;
  p.keeperX = fresh.keeperX;
  p.hiveX = fresh.hiveX;
  p.leaving = false;
  p.puddle = 0.2;
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
  if (quiet) {
    p.keeperX = 1040;
    p.hiveX = 1000;
    p.puddle = 1;
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
  const bear = p.bear;
  bear.age += dt;
  stepSpring(bear.shades, bear.mode === 'walking' || bear.mode === 'gone' ? 1 : 0, 12, 0.6, dt);
  if (bear.mode === 'pulling') {
    bear.paw = Math.min(1, bear.paw + dt * 0.9);
    if (bear.paw >= 1) {
      bear.mode = 'walking';
      bear.age = 0;
    }
  }
  if (bear.mode === 'walking') {
    bear.x -= 120 * dt;
    if (bear.x < -60) bear.mode = 'gone';
  }
  if (bear.mode === 'trapped') bear.paw = Math.max(0, bear.paw - dt);
  for (const guest of p.guests) {
    const want = drive.multiplier >= guest.at ? 1 : 0.05;
    stepSpring(guest.lean, guest.stuck ? 1 : want, 4, 0.8, dt);
  }
  p.puddle = clamp(p.puddle + dt * (drive.running ? 0.04 + drive.tension * 0.08 : 0), 0.2, 1);
  for (const bee of p.bees) bee.angle += dt * bee.speed * (p.leaving ? 3 : 1 + drive.tension * 2) * (drive.reduced ? 0.2 : 1);
  if (p.leaving) {
    p.keeperX += 70 * dt;
    p.hiveX += (p.keeperX + 30 - p.hiveX) * clamp(dt * 3, 0, 1);
  }
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
  // Legs.
  ctx.strokeStyle = FUR;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-16, -16);
  ctx.lineTo(-18, 8);
  ctx.moveTo(16, -16);
  ctx.lineTo(20, 8);
  ctx.stroke();
  ctx.restore();
  // Arm to the paw. The jar is drawn later, so the paw reads as inside it.
  ctx.strokeStyle = FUR;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bear.x + 30, 390);
  ctx.quadraticCurveTo((bear.x + paw.x) / 2, paw.y - 30, paw.x, paw.y);
  ctx.stroke();
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
  drawBear(ctx, p, level, time);
  ctx.save();
  ctx.translate(p.keeperX, 430);
    ctx.fillStyle = '#f7f7f2';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.ellipse(0, -50, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath();
    ctx.arc(0, -78, 16, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(-14, -86, 28, 8);
  ctx.restore();
}
