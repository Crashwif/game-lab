/**
 * The sales office: a cabin under the developer's billboard with a PRE-SALE
 * banner whose APY climbs with the multiplier, an OPEN sign, and a queue of
 * buyers that gets longer the higher the tower goes. Every floor the crane
 * lands sells a unit: the front of the queue goes in, SOLD floats up, and
 * someone new joins at the back. The collapse scatters the queue (the office
 * still flips its sign to SOLD OUT), and an accepted exit sells the penthouse
 * with confetti. Nothing here changes the committed outcome.
 */
import { type Spring, clamp, noise, settleSpring, spring, stepSpring } from './motion';
import { type Mood, drawWojak } from './people';
import { GROUND_Y } from './tower';

const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The cabin's left edge and width, under the billboard; the door is on the left, so the queue runs off to the left. */
export const OFFICE_X = 58;
export const OFFICE_W = 114;
/** Short enough that the roof clears the billboard above it. */
const OFFICE_H = 40;
const DOOR_X = OFFICE_X + 9;
const QUEUE_GAP = 22;
const MAX_QUEUE = 7;
const MAX_CONFETTI = 40;
const CONFETTI_COLOURS = ['#ff4d6d', '#7cf67c', '#8fd3ff', '#ffe27a', '#c084fc'];

interface Queuer {
  x: number;
  tone: number;
  phase: number;
  fleeing: boolean;
  vx: number;
  phone: boolean;
}

/** A stamp on the cabin wall: it pops in on a spring and fades where it is, never drifting up over the billboard. */
interface Floater { text: string; x: number; y: number; age: number; life: number; colour: string; size: number; pop: Spring }
interface Confetti { x: number; y: number; vx: number; vy: number; angle: number; spin: number; colour: string; age: number; life: number }

export interface OfficeState {
  queue: Queuer[];
  floaters: Floater[];
  confetti: Confetti[];
  /** OPEN, or CLOSED once the tower is down. */
  open: boolean;
  soldOut: boolean;
  penthouseSold: boolean;
  /** The banner's pop when its number grows a digit, and the OPEN sign's swing. */
  bannerPop: Spring;
  signSwing: Spring;
  digits: number;
  units: number;
  time: number;
}

export interface OfficeDrive {
  running: boolean;
  /** log2 of the multiplier, and the tension 0..1. */
  growth: number;
  tension: number;
}

export function createOffice(): OfficeState {
  return { queue: [], floaters: [], confetti: [], open: true, soldOut: false, penthouseSold: false, bannerPop: spring(0), signSwing: spring(0), digits: 0, units: 0, time: 0 };
}

export function resetOffice(o: OfficeState): void {
  o.queue = [];
  o.floaters = [];
  o.confetti = [];
  o.open = true;
  o.soldOut = false;
  o.penthouseSold = false;
  settleSpring(o.bannerPop, 0);
  settleSpring(o.signSwing, 0);
  o.digits = 0;
  o.units = 0;
}

/** Where the nth person in the queue stands. */
const slot = (i: number): number => DOOR_X - 16 - i * QUEUE_GAP;

/** How many are queueing for a multiplier this far along: one idler between rounds, up to seven at the top. */
function wanted(drive: OfficeDrive): number {
  return drive.running ? Math.min(MAX_QUEUE, 1 + Math.floor(drive.growth * 2.2)) : 1;
}

function join(o: OfficeState, fromFar: boolean): void {
  const i = o.queue.length;
  const n = o.units * 7 + i;
  o.queue.push({ x: fromFar ? slot(i) - 120 - noise(n) * 60 : slot(i), tone: noise(n * 1.3), phase: noise(n * 2.1) * Math.PI * 2, fleeing: false, vx: 0, phone: noise(n * 3.7) > 0.45 });
}

/** The state a round already under way calls for: the queue in place, or gone if the tower is down. */
export function settleOffice(o: OfficeState, drive: OfficeDrive, crashed: boolean): void {
  resetOffice(o);
  if (crashed) {
    o.open = false;
    o.soldOut = true;
    return;
  }
  for (let i = 0; i < wanted(drive); i += 1) join(o, false);
  o.digits = apyText(drive.growth).length;
}

/** The floor price's APY, in a font that never fits it: 420% at the start, six figures by the stratosphere. */
function apyText(growth: number): string {
  const apy = Math.round(420 * Math.pow(2, growth * 2));
  if (apy >= 1e6) return `${(apy / 1e6).toFixed(1)}M%`;
  return `${apy.toLocaleString('en-US')}%`;
}

export function stepOffice(o: OfficeState, drive: OfficeDrive, dt: number): void {
  o.time += dt;
  if (o.open) {
    const target = wanted(drive);
    while (o.queue.filter((q) => !q.fleeing).length < target) join(o, drive.running);
    const digits = apyText(drive.growth).length;
    if (digits !== o.digits) {
      if (o.digits) o.bannerPop.v = 7;
      o.digits = digits;
    }
  }
  let i = 0;
  for (const q of o.queue) {
    if (q.fleeing) {
      q.x += q.vx * dt;
      continue;
    }
    const target = slot(i);
    i += 1;
    const step = 90 * dt;
    q.x += clamp(target - q.x, -step, step);
  }
  o.queue = o.queue.filter((q) => q.x > -700);
  for (const f of o.floaters) {
    f.age += dt;
    stepSpring(f.pop, 1, 16, 0.4, dt);
  }
  o.floaters = o.floaters.filter((f) => f.age < f.life);
  for (const c of o.confetti) {
    c.age += dt;
    c.vy += 260 * dt;
    c.vx *= Math.exp(-1.4 * dt);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.angle += c.spin * dt;
  }
  o.confetti = o.confetti.filter((c) => c.age < c.life && c.y < GROUND_Y + 2);
  stepSpring(o.bannerPop, 0, 12, 0.35, dt);
  stepSpring(o.signSwing, 0, 6, 0.25, dt);
}

function stamp(o: OfficeState, text: string, x: number, y: number, colour: string, size: number): void {
  if (o.floaters.length >= 3) o.floaters.shift();
  const pop = spring(0);
  pop.v = 18;
  o.floaters.push({ text, x, y, age: 0, life: 1.6, colour, size, pop });
}

/** A floor landed: the front of the queue buys it. True when someone actually went in. */
export function sellUnit(o: OfficeState): boolean {
  if (!o.open) return false;
  const front = o.queue.findIndex((q) => !q.fleeing);
  if (front < 0 || o.queue[front]!.x > slot(0) + 4) return false;
  o.queue.splice(front, 1);
  o.units += 1;
  stamp(o, 'SOLD', DOOR_X + 8, GROUND_Y - 14, '#ffe27a', 15);
  o.signSwing.v += 3;
  return true;
}

/** The accepted exit: the penthouse goes to the next guy, and the office celebrates like it was their idea. */
export function sellPenthouse(o: OfficeState): void {
  if (o.penthouseSold) return;
  o.penthouseSold = true;
  stamp(o, 'PENTHOUSE SOLD', OFFICE_X + OFFICE_W / 2, GROUND_Y - 12, '#7cf67c', 16);
  o.signSwing.v += 5;
  for (let i = 0; i < MAX_CONFETTI; i += 1) {
    const n = i * 1.37 + o.time;
    o.confetti.push({
      x: OFFICE_X + OFFICE_W / 2 + (noise(n) - 0.5) * 40, y: GROUND_Y - OFFICE_H,
      vx: (noise(n + 1) - 0.5) * 260, vy: -120 - noise(n + 2) * 220,
      angle: noise(n + 3) * Math.PI, spin: (noise(n + 4) - 0.5) * 14, colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]!, age: 0, life: 1.6 + noise(n + 5) * 0.8,
    });
  }
}

/** The collapse: the queue runs for it, the sign flips. `quiet` is a crash the scene did not watch: nobody left to run. */
export function scatterQueue(o: OfficeState, quiet: boolean): void {
  o.open = false;
  o.soldOut = true;
  if (quiet) {
    o.queue = [];
    return;
  }
  o.signSwing.v += 8;
  for (const [i, q] of o.queue.entries()) {
    q.fleeing = true;
    // Staggered from the back, away from the tower, the front runners the slowest so they trip over each other.
    q.vx = -(170 + noise(i * 2.3 + o.units) * 150 + i * 18);
  }
  stamp(o, 'SOLD OUT', OFFICE_X + OFFICE_W / 2, GROUND_Y - 12, '#ff9db0', 16);
}

export function drawOffice(ctx: CanvasRenderingContext2D, o: OfficeState, drive: OfficeDrive): void {
  const x = OFFICE_X;
  const top = GROUND_Y - OFFICE_H;
  ctx.lineJoin = 'round';
  // The cabin: a portakabin with a flat roof, the banner across its wall, a door on the queue's side and a
  // window with a suit in it.
  ctx.fillStyle = '#e9e4d6';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, top, OFFICE_W, OFFICE_H, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4b5563';
  ctx.beginPath(); ctx.roundRect(x - 4, top - 5, OFFICE_W + 8, 7, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a4a24';
  ctx.beginPath(); ctx.roundRect(x + 6, top + 17, 16, OFFICE_H - 17, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.arc(x + 19, top + 30, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9fd3ff';
  ctx.beginPath(); ctx.rect(x + 62, top + 18, 40, 16); ctx.fill(); ctx.stroke();
  // The salesman in the window: a suit, a red tie, a grin that never moves.
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 63, top + 19, 38, 14); ctx.clip();
  ctx.fillStyle = '#26364a';
  ctx.beginPath(); ctx.roundRect(x + 72, top + 28, 20, 14, 3); ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(x + 81, top + 29, 2.5, 6);
  ctx.fillStyle = '#f3dccb';
  ctx.beginPath(); ctx.arc(x + 82, top + 24, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(x + 80, top + 23, 0.9, 0, Math.PI * 2); ctx.arc(x + 84.5, top + 23, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x + 79, top + 26); ctx.quadraticCurveTo(x + 82, top + 28.5, x + 85.5, top + 26); ctx.stroke();
  ctx.restore();
  // The OPEN/CLOSED sign on a hook by the door, swinging on every sale.
  ctx.save();
  ctx.translate(x + 41, top + 19);
  ctx.rotate(clamp(o.signSwing.x, -0.6, 0.6) * 0.5);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, -4); ctx.lineTo(6, 0); ctx.stroke();
  ctx.fillStyle = o.open ? '#2fbf71' : '#e63946';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.roundRect(-14, 0, 28, 12, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 9px ${MEME_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.open ? 'OPEN' : 'CLOSED', 0, 6.5, 26);
  ctx.restore();
  // The banner across the wall: PRE-SALE and an APY nobody checked.
  const pop = 1 + 0.12 * o.bannerPop.x;
  ctx.save();
  ctx.translate(x + OFFICE_W / 2, top + 9);
  ctx.scale(pop, pop);
  ctx.fillStyle = o.soldOut ? '#7d1d2b' : '#e63946';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-OFFICE_W / 2 - 5, -7, OFFICE_W + 10, 14, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.font = `900 11px ${MEME_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.soldOut ? 'SOLD OUT · NOT OUR PROBLEM' : `PRE-SALE · ${apyText(drive.growth)} APY`, 0, 0.5, OFFICE_W + 4);
  ctx.restore();
  // Rope and stanchions the queue stands behind.
  const count = o.queue.filter((q) => !q.fleeing).length;
  if (count > 1 && o.open) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (let i = 0; i <= count; i += 2) {
      const px = slot(i) + QUEUE_GAP / 2 + 2;
      ctx.beginPath(); ctx.moveTo(px, GROUND_Y); ctx.lineTo(px, GROUND_Y - 18); ctx.stroke();
    }
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(slot(0) + QUEUE_GAP / 2 + 2, GROUND_Y - 17);
    for (let i = 2; i <= count; i += 2) ctx.quadraticCurveTo(slot(i - 1) + QUEUE_GAP / 2 + 2, GROUND_Y - 12, slot(i) + QUEUE_GAP / 2 + 2, GROUND_Y - 17);
    ctx.stroke();
  }
  // The queue: bobbing on their phones, and the further up the tower goes the more they bounce.
  for (const [i, q] of o.queue.entries()) {
    ctx.save();
    ctx.translate(q.x, GROUND_Y);
    const bounce = q.fleeing ? Math.abs(Math.sin(o.time * 16 + q.phase)) * 4 : Math.abs(Math.sin(o.time * (2 + 6 * drive.tension) + q.phase)) * (1 + 4 * drive.tension);
    ctx.translate(0, -bounce);
    const mood: Mood = q.fleeing ? 'panic' : drive.tension > 0.5 && (i + o.units) % 2 === 0 ? 'hype' : 'meh';
    const walk = q.fleeing ? Math.sin(o.time * 22 + q.phase) * 1.1 : 0;
    drawWojak(ctx, mood, q.fleeing ? 1 : drive.tension > 0.7 ? 0.35 : 0, walk, q.tone, !q.fleeing && q.phone);
    ctx.restore();
  }
  for (const c of o.confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.globalAlpha = clamp(1.5 * (1 - c.age / c.life), 0, 1);
    ctx.fillStyle = c.colour;
    ctx.fillRect(-3, -2, 6, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const f of o.floaters) {
    const k = f.age / f.life;
    ctx.save();
    ctx.globalAlpha = clamp(1.8 * (1 - k), 0, 1);
    ctx.translate(f.x, f.y);
    ctx.rotate(-0.1);
    const scale = clamp(f.pop.x, 0, 1.4);
    ctx.scale(scale, scale);
    ctx.font = `900 ${f.size}px ${MEME_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText(f.text, 0, 0, OFFICE_W);
    ctx.fillStyle = f.colour;
    ctx.fillText(f.text, 0, 0, OFFICE_W);
    ctx.restore();
  }
}
