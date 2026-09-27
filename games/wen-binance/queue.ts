/**
 * The velvet-rope queue: a line of coins in hoodies that shuffles toward the
 * bouncer on the multiplier curve, sways to the bass, mutters, and turns and
 * runs when the news sells. Your coin stands in the middle of it and can step
 * out to the taxi. Nothing here changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { BOUNCER_X, GROUND, INK, W } from './club';

/** The multipliers at which the bouncer waves another suit past the rope. */
export const SUITS = [1.5, 2, 3, 4.5, 6.5, 9, 13, 18, 25, 35];
const COUNT = 9;
const YOU = 4;
const SPACING = 62;
const HEAD_START = 250;
const HEAD_END = BOUNCER_X - 80;

interface Bubble { index: number; text: string; age: number; life: number }

export interface Queue {
  time: number;
  /** Progress of the line toward the rope, 0..1 on the curve. */
  advance: Spring;
  bounce: Spring;
  suits: number;
  bubbles: Bubble[];
  mode: 'queued' | 'stepping' | 'gone';
  youX: Spring;
  shades: Spring;
  panic: boolean;
  panicAge: number;
  runSeeds: number[];
  /** The coin at the head walks into the empty club after the crash. */
  headIn: Spring;
}

export function createQueue(): Queue {
  return { time: 0, advance: spring(0), bounce: spring(0), suits: 0, bubbles: [], mode: 'queued', youX: spring(0), shades: spring(0), panic: false, panicAge: 0, runSeeds: [], headIn: spring(0) };
}

export function resetQueue(q: Queue): void {
  settleSpring(q.advance, 0);
  settleSpring(q.bounce, 0);
  q.suits = 0;
  q.bubbles = [];
  q.mode = 'queued';
  settleSpring(q.youX, 0);
  settleSpring(q.shades, 0);
  q.panic = false;
  q.panicAge = 0;
  q.runSeeds = [];
  settleSpring(q.headIn, 0);
}

function progress(multiplier: number): number {
  return clamp(Math.log2(Math.max(1, multiplier)) / 4.2, 0, 1);
}

/** Joins a round in progress: the line is already where the multiplier put it. */
export function settleQueue(q: Queue, multiplier: number): void {
  settleSpring(q.advance, progress(multiplier));
  q.suits = SUITS.filter((m) => multiplier >= m).length;
}

/** Your coin steps out of the line toward the taxi. */
export function leaveQueue(q: Queue): void {
  if (q.mode !== 'queued') return;
  q.mode = 'stepping';
  q.shades.v = 6;
}

/** Sell the news: the line turns and runs. */
export function panicQueue(q: Queue, seed: number, quiet: boolean): void {
  if (q.panic) return;
  q.panic = true;
  q.panicAge = quiet ? 10 : 0;
  const rng = mulberry32(seed + 99);
  q.runSeeds = Array.from({ length: COUNT }, () => rng());
  if (quiet) settleSpring(q.headIn, 1);
}

export interface QueueDrive { running: boolean; multiplier: number; tension: number; thump: number }

const MUTTER = {
  calm: ['wen listing', 'gm', 'heard the dev is based', 'is this the line?', 'lfg'],
  edgy: ['insiders again', 'why is he checking', 'the bass is loud', 'wen listing tho', 'those suits skipped'],
  scared: ['sell the news?', 'the suits are leaving', 'is that DELISTING', 'my bag is heavy', 'should we go'],
} as const;

/** Steps the line; returns true when a new suit milestone was reached. */
export function stepQueue(q: Queue, drive: QueueDrive, dt: number): boolean {
  q.time += dt;
  stepSpring(q.advance, drive.running ? progress(drive.multiplier) : q.panic ? q.advance.x : 0, 2.5, 0.9, dt);
  stepSpring(q.bounce, 0, 16, 0.4, dt);
  if (drive.thump > 0.6 && q.bounce.v < 1) q.bounce.v += 4 + 8 * drive.tension;
  let reached = false;
  if (drive.running) {
    const due = SUITS.filter((m) => drive.multiplier >= m).length;
    if (due > q.suits) { q.suits = due; reached = true; }
    // Muttering in the line.
    const slot = Math.floor(q.time * 1.5);
    if (slot !== Math.floor((q.time - dt) * 1.5) && noise(slot * 3.3) > 0.45 - 0.2 * drive.tension && q.bubbles.length < 3) {
      const pool = drive.tension > 0.65 ? MUTTER.scared : drive.tension > 0.3 ? MUTTER.edgy : MUTTER.calm;
      const index = Math.floor(noise(slot * 7.7) * COUNT);
      if (index !== YOU || q.mode === 'queued') q.bubbles.push({ index, text: pool[Math.floor(noise(slot * 5.1) * pool.length)]!, age: 0, life: 2.2 });
    }
  }
  for (const b of q.bubbles) b.age += dt;
  q.bubbles = q.bubbles.filter((b) => b.age < b.life);
  if (q.mode === 'stepping') {
    stepSpring(q.youX, 1, 4, 0.9, dt);
    if (q.youX.x > 0.98) q.mode = 'gone';
  }
  stepSpring(q.shades, q.mode === 'queued' ? 0 : 1, 10, 0.6, dt);
  if (q.panic) {
    q.panicAge += dt;
    q.bubbles = [];
    stepSpring(q.headIn, q.panicAge > 1.4 ? 1 : 0, 3, 0.9, dt);
  }
  return reached;
}

function coinX(q: Queue, i: number): number {
  const head = mix(HEAD_START, HEAD_END, clamp(q.advance.x, 0, 1));
  return head - i * SPACING;
}

type Mood = 'calm' | 'hype' | 'worried' | 'shock';
type Point = { x: number; y: number };

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + (dx / distance) * along - (dy / distance) * bend, y: root.y + (dy / distance) * along + (dx / distance) * bend };
}

function bone(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): void {
  const joint = bendJoint(a, b, upper, lower, side);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width + 4;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, footY: number, seed: number, bob: number, mood: Mood, you: boolean, shades: number, stride: number, facing = 1, time = 0): void {
  ctx.save();
  ctx.translate(x, footY - bob);
  ctx.scale(facing, 1);
  ctx.rotate(Math.sin(time * 1.4 + seed) * (stride > 0 ? 0.02 : 0.045));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hue = you ? 48 : Math.floor(noise(seed * 4.1) * 360);
  const hood = you ? '#ffe27a' : `hsl(${hue}, 55%, 45%)`;
  const face = you ? '#ffd23f' : `hsl(${hue}, 80%, 65%)`;
  const idle = time * 1.3 + seed;
  for (const side of [-1, 1]) {
    const phase = (stride > 0 ? stride : idle) + (side > 0 ? Math.PI : 0);
    const amp = stride > 0 ? 1 : 0.28;
    const lift = Math.max(0, Math.sin(phase)) * 13 * amp;
    const reach = Math.cos(phase) * 9 * amp;
    const foot = { x: side * 10 + reach, y: -lift };
    bone(ctx, { x: side * 8, y: -36 }, foot, 24, 22, foot.y >= -36 ? -side : side, 9, '#2b2b36');
    ctx.fillStyle = '#1b1b22'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 2, 6.5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // Hoodie body.
  ctx.fillStyle = hood; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-24, -74, 48, 46, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.roundRect(-14, -50, 28, 16, 4); ctx.fill();
  // Arms in the pockets, up when hyped, swinging opposite the feet when they run.
  const up = mood === 'hype' ? 1 : mood === 'shock' ? 0.45 : 0;
  for (const side of [-1, 1]) {
    const phase = (stride > 0 ? stride : idle) + (side > 0 ? 0 : Math.PI);
    const swing = stride > 0 ? Math.sin(phase) * 8 : Math.sin(phase) * 2;
    const hand = { x: side * (22 + 10 * up) + swing * 0.35, y: -40 - 54 * up + (up ? 0 : swing * 0.4) };
    bone(ctx, { x: side * 18, y: -66 }, hand, 22, 20, hand.y >= -66 ? -side : side, 8, hood);
  }
  // The coin head inside the hood, lagging the shoulders.
  ctx.save();
  ctx.translate(-Math.sin(stride || idle) * 3, Math.sin(time * 2 + seed) * 1);
  ctx.fillStyle = hood;
  ctx.beginPath(); ctx.arc(0, -96, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(0, -96, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -96, 17, 0, Math.PI * 2); ctx.stroke();
  // Face.
  ctx.fillStyle = INK;
  const eyeH = mood === 'shock' ? 5 : mood === 'worried' ? 2 : 3;
  for (const ex of [-8, 8]) { ctx.beginPath(); ctx.ellipse(ex, -100, 2.6, eyeH, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (mood === 'hype') { ctx.ellipse(0, -88, 6, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (mood === 'shock') { ctx.ellipse(0, -86, 4, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (mood === 'worried') { ctx.moveTo(-6, -86); ctx.quadraticCurveTo(0, -91, 6, -86); }
  else { ctx.moveTo(-6, -89); ctx.quadraticCurveTo(0, -84, 6, -89); }
  ctx.stroke();
  if (mood === 'worried') { ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.ellipse(14, -106, 3, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  if (shades > 0.02) { const dy = -30 * (1 - shades); ctx.fillStyle = INK; ctx.fillRect(-15, -104 + dy, 12, 7); ctx.fillRect(3, -104 + dy, 12, 7); ctx.fillRect(-3, -103 + dy, 6, 2); }
  ctx.restore();
  if (you) {
    // The bag lags the step, hung off the right side.
    const swing = Math.sin((stride > 0 ? stride : time * 2) - 0.6) * 10;
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(20, -48);
    ctx.quadraticCurveTo(6 + swing, -22, 32 + swing, -12);
    ctx.quadraticCurveTo(56 + swing * 0.45, -16, 44 + swing * 0.2, -50);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c'; ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', 34 + swing * 0.35, -26);
  }
  ctx.restore();
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 24, w, 24, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 8); ctx.lineTo(x + 6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y - 8);
  ctx.restore();
}

/** The rope, the line and your coin wherever he is. */
export function drawQueue(ctx: CanvasRenderingContext2D, q: Queue, tension: number, finished: boolean, cheerful: boolean, taxiX: number): void {
  // Velvet rope posts along the pavement edge, behind the coins.
  const posts = 7;
  ctx.lineJoin = 'round';
  for (let i = 0; i < posts; i += 1) {
    const px = 40 + (i * (HEAD_END + 40 - 40)) / (posts - 1);
    if (i > 0) {
      const prev = 40 + ((i - 1) * (HEAD_END + 40 - 40)) / (posts - 1);
      const droop = 18 + 10 * tension + Math.sin(q.time * 2.4 + i) * (3 + 5 * tension);
      ctx.strokeStyle = INK; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(prev, GROUND - 40); ctx.quadraticCurveTo((prev + px) / 2, GROUND - 40 + droop, px, GROUND - 40); ctx.stroke();
      ctx.strokeStyle = '#c1121f'; ctx.lineWidth = 5; ctx.stroke();
    }
  }
  for (let i = 0; i < posts; i += 1) {
    const px = 40 + (i * (HEAD_END + 40 - 40)) / (posts - 1);
    ctx.fillStyle = '#d4af37'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(px - 4, GROUND - 48, 8, 50, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(px, GROUND + 2, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, GROUND - 50, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // The coins, back to front so the head of the line is in front.
  const panic = q.panic ? smoothstep(0, 0.5, q.panicAge) : 0;
  for (let i = COUNT - 1; i >= 0; i -= 1) {
    const you = i === YOU;
    if (you && q.mode !== 'queued') continue;
    let x = coinX(q, i);
    let stride = 0;
    let facing = 1;
    let footY = GROUND + 6;
    if (q.panic && i !== 0) {
      const speed = 220 + 200 * (q.runSeeds[i] ?? 0.5);
      x -= Math.max(0, q.panicAge - 0.3 - (q.runSeeds[i] ?? 0) * 0.5) * speed;
      stride = q.time * 13 + i;
      facing = -1;
      if (x < -80) continue;
    } else if (q.panic && i === 0) {
      // The head of the line is finally let in, to nobody.
      const inward = clamp(q.headIn.x, 0, 1);
      x = mix(x, 705, inward);
      footY = mix(GROUND + 6, GROUND - 4, inward);
      stride = inward > 0.02 && inward < 0.98 ? q.time * 10 : 0;
      ctx.save();
      if (inward > 0.3) ctx.globalAlpha = 1 - smoothstep(0.3, 1, inward) * 0.7;
      const scale = 1 - 0.25 * inward;
      ctx.translate(x, footY); ctx.scale(scale, scale); ctx.translate(-x, -footY);
      drawCoin(ctx, x, footY, i, 0, 'worried', false, 0, stride, 1, q.time);
      ctx.restore();
      continue;
    }
    const sway = Math.sin(q.time * 1.6 + i * 1.1) * 3 * (1 - panic);
    const bob = (q.bounce.x > 0 ? Math.max(0, q.bounce.x) * 6 * Math.max(0, Math.sin(i * 0.9 + 1)) : 0) + (finished && cheerful && you ? 0 : 0);
    const mood: Mood = q.panic ? 'shock' : finished ? (cheerful ? 'calm' : 'shock') : tension > 0.7 ? 'worried' : tension > 0.35 && noise(i * 2.2 + Math.floor(q.time * 0.5)) > 0.5 ? 'hype' : 'calm';
    drawCoin(ctx, x + sway, footY, i, bob, mood, you, 0, stride, facing, q.time);
  }
  for (const b of q.bubbles) {
    if (b.index === YOU && q.mode !== 'queued') continue;
    const alpha = b.age < 0.2 ? b.age / 0.2 : b.age > b.life - 0.4 ? (b.life - b.age) / 0.4 : 1;
    bubble(ctx, coinX(q, b.index) + Math.sin(q.time * 1.6 + b.index * 1.1) * 3, GROUND - 134, b.text, alpha);
  }
  // Your coin leaving: steps out in front of the rope and over to the taxi.
  if (q.mode !== 'queued') {
    const k = clamp(q.youX.x, 0, 1);
    const from = coinX(q, YOU);
    const to = Math.min(taxiX - 60, W - 40);
    const x = mix(from, to, smoothstep(0, 1, k));
    const y = mix(GROUND + 6, GROUND + 42, smoothstep(0, 0.3, k));
    const stride = q.mode === 'stepping' ? q.time * 11 : 0;
    drawCoin(ctx, x, y, YOU, q.mode === 'gone' ? Math.abs(Math.sin(q.time * 3)) * 3 : 0, 'hype', true, clamp(q.shades.x, 0, 1), stride, from > to ? -1 : 1, q.time);
    if (q.mode === 'gone') {
      ctx.save(); ctx.translate(x, y - 150);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(-52, -14, 104, 26, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('LEFT THE QUEUE', 0, 5);
      ctx.restore();
    }
  }
}
