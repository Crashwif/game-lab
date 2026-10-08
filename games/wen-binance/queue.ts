/**
 * The velvet-rope queue: a line of coins in hoodies that shuffles toward the
 * bouncer on the multiplier curve, one half-step at a time from the front of
 * the line back, bobs to the bass a beat apart, mutters, and turns and runs
 * when the news sells. Your coin stands in the middle of it and can step out
 * to the taxi, to cries of JEET. Nothing here changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { BOUNCER_X, GROUND, INK, KERB } from './club';

/** The multipliers at which the bouncer waves another suit past the rope. */
export const SUITS = [1.5, 2, 3, 4.5, 6.5, 9, 13, 18, 25, 35];
const COUNT = 9;
const YOU = 4;
const SPACING = 62;
/** Far enough right that your coin starts whole on screen; the rest of the line trails off the left edge. */
const HEAD_START = 300;
const HEAD_END = BOUNCER_X - 80;
/** One shuffle forward: half a stride (16 px), so both feet are planted between shuffles. */
const STEP = 16 / (HEAD_END - HEAD_START);
/** How far behind the coin in front each coin starts its shuffle, in progress (about 0.15 s on the curve). */
const LAG = 0.004;

interface Bubble { index: number; text: string; age: number; life: number; loud?: boolean }
interface Confetti { x: number; y: number; vx: number; vy: number; age: number; life: number; colour: string; size: number }

export interface Queue {
  time: number;
  /** Each coin's progress toward the rope, 0..1 on the curve, in shuffles. */
  line: Spring[];
  /** Each coin's bob on the bass, and the seconds until its next kick lands (-1 for none) with that kick's strength. */
  hop: Spring[];
  hopIn: number[];
  hopKick: number;
  /** Each coin's hands, 0 in the pockets to 1 in the air: eased, so a change of mood never snaps the arms. */
  arms: Spring[];
  suits: number;
  bubbles: Bubble[];
  mode: 'queued' | 'stepping' | 'gone';
  youX: Spring;
  exitFrom: number;
  shades: Spring;
  panic: boolean;
  panicAge: number;
  runSeeds: number[];
  /** The coin at the head walks into the empty club after the crash. */
  headIn: Spring;
  /** The burst over your coin as he steps out of the line. */
  confetti: Confetti[];
  /** Seconds left of the neighbours (`pointers`) pointing at your coin as he leaves, and of the line hoping the doors are opening. */
  jeer: number;
  pointers: number[];
  hope: number;
}

export function createQueue(): Queue {
  const each = <T>(f: () => T): T[] => Array.from({ length: COUNT }, f);
  return { time: 0, line: each(() => spring(0)), hop: each(() => spring(0)), hopIn: each(() => -1), hopKick: 0, arms: each(() => spring(0)), suits: 0, bubbles: [], mode: 'queued', youX: spring(0), exitFrom: HEAD_START - YOU * SPACING, shades: spring(0), panic: false, panicAge: 0, runSeeds: [], headIn: spring(0), confetti: [], jeer: 0, pointers: [], hope: 0 };
}

export function resetQueue(q: Queue): void {
  for (const s of q.line) settleSpring(s, 0);
  for (const s of q.hop) settleSpring(s, 0);
  for (const s of q.arms) settleSpring(s, 0);
  q.hopIn.fill(-1);
  q.suits = 0;
  q.jeer = 0;
  q.hope = 0;
  q.bubbles = [];
  q.mode = 'queued';
  settleSpring(q.youX, 0);
  settleSpring(q.shades, 0);
  q.panic = false;
  q.panicAge = 0;
  q.runSeeds = [];
  settleSpring(q.headIn, 0);
  q.confetti = [];
}

function progress(multiplier: number): number {
  return clamp(Math.log2(Math.max(1, multiplier)) / 4.2, 0, 1);
}

/**
 * Where coin `i` is headed: the line's progress in whole shuffles (one about every 2.8 s), each coin starting its
 * shuffle a moment after the one in front, so a ripple runs down the line.
 */
const shuffleTo = (multiplier: number, i: number): number => Math.max(0, Math.floor((progress(multiplier) - i * LAG) / STEP) * STEP);

/** Joins a round in progress: the line is already where the multiplier put it. */
export function settleQueue(q: Queue, multiplier: number): void {
  for (const [i, s] of q.line.entries()) settleSpring(s, shuffleTo(multiplier, i));
  q.suits = SUITS.filter((m) => multiplier >= m).length;
}

/** Your coin steps out of the line toward the taxi. `quiet` puts him by the taxi already, for an exit that already happened. */
export function leaveQueue(q: Queue, quiet = false, reduced = false): void {
  if (q.mode !== 'queued') return;
  q.exitFrom = coinX(q, YOU);
  if (quiet) {
    q.mode = 'gone';
    settleSpring(q.youX, 1);
    settleSpring(q.shades, 1);
    return;
  }
  q.mode = 'stepping';
  q.shades.v = 6;
  // The neighbours point and call it: the coin in front, and the one behind if he is on screen (else the next in
  // front, who points without a word so the two calls never overlap).
  q.jeer = 1.8;
  const [front, back] = (q.pointers = jeerers(q));
  q.bubbles = [{ index: front!, text: 'paper hands!!', age: 0, life: 1.9, loud: true }];
  if (back! > YOU) q.bubbles.push({ index: back!, text: 'JEET!', age: -0.25, life: 1.65, loud: true });
  // Confetti over your coin: the one who left with the bag. Capped, and skipped under reduced motion.
  if (reduced) return;
  const rng = mulberry32(42);
  const x = coinX(q, YOU);
  for (let i = 0; i < 36; i += 1) q.confetti.push({ x: x + (rng() - 0.5) * 30, y: GROUND - 110, vx: (rng() - 0.5) * 320, vy: -160 - rng() * 220, age: 0, life: 1 + rng() * 0.8, colour: ['#7cf67c', '#ffe27a', '#ffffff', '#ff5d9e'][i % 4]!, size: 2.5 + rng() * 3.5 });
}

/** The two neighbours who call your coin out as he leaves. */
const jeerers = (q: Queue): number[] => [YOU - 1, coinX(q, YOU + 1) > -6 ? YOU + 1 : YOU - 2];

/** The handles rattled: for a second the line thinks it is going in. */
export function hopeQueue(q: Queue, seed: number): void {
  if (q.mode !== 'queued' && q.mode !== 'stepping') return;
  q.hope = 1.3;
  const index = Math.floor(noise(seed * 3.1) * 3);
  if (q.bubbles.every((b) => Math.abs(bubbleAt(q, b.index) - bubbleAt(q, index)) >= BUBBLE_MAX + 16)) q.bubbles.push({ index, text: ["it's opening!!", 'we are so back', 'LISTING??'][Math.floor(noise(seed * 5.3) * 3)]!, age: 0, life: 1.6 });
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

/** `kick` is the bass hit landing this step (0 for none). */
export interface QueueDrive { running: boolean; multiplier: number; tension: number; kick?: number }

const MUTTER = {
  calm: ['wen listing', 'gm', 'heard the dev is based', 'is this the line?', 'lfg', 'my cousin works here', 'tier 1 or bust'],
  edgy: ['insiders again', 'why is he checking', 'the bass is loud', 'wen listing tho', 'those suits skipped', 'listing fee is HOW much', 'did the vc skip us'],
  scared: ['sell the news?', 'the suits are leaving', 'is that DELISTING', 'my bag is heavy', 'should we go', "they're dumping on us", 'it was priced in'],
} as const;

/** Wider than the widest mutter's bubble. A new line waits until a bubble that wide could not touch a live one. */
const BUBBLE_MAX = 184;
/** Where a bubble that wide sits for coin `i`, pushed off the canvas edge and the bouncer as `bubble` does. */
const bubbleAt = (q: Queue, i: number): number => clamp(coinX(q, i), BUBBLE_MAX / 2 + 6, BOUNCER_X - 50 - BUBBLE_MAX / 2);

/** Steps the line; returns true when a new suit milestone was reached. */
export function stepQueue(q: Queue, drive: QueueDrive, dt: number): boolean {
  q.time += dt;
  // Each shuffle is a critically damped half-step of about 0.6 s; a crashed line stays where it was.
  for (const [i, s] of q.line.entries()) stepSpring(s, drive.running ? shuffleTo(drive.multiplier, i) : q.panic ? s.x : 0, 7, 1, dt);
  // The bass reaches each coin up to 90 ms late, and some feel it more than others.
  if (drive.kick) { q.hopKick = drive.kick; for (let i = 0; i < COUNT; i += 1) q.hopIn[i] = 0.09 * noise(i + 0.5); }
  for (const [i, h] of q.hop.entries()) {
    const wait = q.hopIn[i]!;
    if (wait >= 0) { q.hopIn[i] = wait - dt; if (wait - dt < 0 && h.v < 1) h.v += q.hopKick * (0.6 + 0.4 * noise(i * 3 + 0.7)); }
    stepSpring(h, 0, 16, 0.4, dt);
  }
  q.jeer = Math.max(0, q.jeer - dt);
  q.hope = Math.max(0, q.hope - dt);
  for (const [i, a] of q.arms.entries()) {
    const up = q.panic ? (i === 0 ? 0 : 0.45) : i === YOU && q.mode !== 'queued' ? 1 : moodOf(q, i, drive.tension) === 'hype' ? 1 : 0;
    stepSpring(a, up, 14, 0.7, dt);
  }
  let reached = false;
  if (drive.running) {
    const due = SUITS.filter((m) => drive.multiplier >= m).length;
    if (due > q.suits) { q.suits = due; reached = true; }
    // Muttering in the line.
    const slot = Math.floor(q.time * 1.5);
    if (slot !== Math.floor((q.time - dt) * 1.5) && noise(slot * 3.3) > 0.45 - 0.2 * drive.tension && q.bubbles.length < 3) {
      const pool = drive.tension > 0.65 ? MUTTER.scared : drive.tension > 0.3 ? MUTTER.edgy : MUTTER.calm;
      const index = Math.floor(noise(slot * 7.7) * COUNT);
      const room = coinX(q, index) >= 0 && q.bubbles.every((b) => Math.abs(bubbleAt(q, b.index) - bubbleAt(q, index)) >= BUBBLE_MAX + 16);
      if (room && (index !== YOU || q.mode === 'queued')) q.bubbles.push({ index, text: pool[Math.floor(noise(slot * 5.1) * pool.length)]!, age: 0, life: 2.2 });
    }
  }
  for (const b of q.bubbles) b.age += dt;
  q.bubbles = q.bubbles.filter((b) => b.age < b.life);
  if (q.mode === 'stepping') {
    stepSpring(q.youX, 1, 4, 1, dt);
    if (q.youX.x > 0.999) { q.mode = 'gone'; settleSpring(q.youX, 1); }
  }
  stepSpring(q.shades, q.mode === 'queued' ? 0 : 1, 10, 0.6, dt);
  if (q.panic) {
    q.panicAge += dt;
    q.bubbles = [];
    stepSpring(q.headIn, q.panicAge > 0.8 ? 1 : 0, 4, 0.9, dt);
  }
  for (const k of q.confetti) { k.age += dt; k.x += k.vx * dt; k.vy += 460 * dt; k.y += k.vy * dt; k.vx *= Math.exp(-dt * 1.2); }
  q.confetti = q.confetti.filter((k) => k.age < k.life);
  return reached;
}

function coinX(q: Queue, i: number): number {
  return mix(HEAD_START, HEAD_END, clamp(q.line[i]!.x, 0, 1)) - i * SPACING;
}

/** The boarding point is fixed on the pavement, independent of the approaching taxi. */
export function exitPosition(q: Queue): number { return mix(q.exitFrom, KERB - 60, smoothstep(0, 1, clamp(q.youX.x, 0, 1))); }

type Mood = 'calm' | 'hype' | 'worried' | 'shock';
type Point = { x: number; y: number };

/** Coin `i`'s mood in a running line: each has its own breaking point between about 2.4x and 5x, and a rattle of the doors gets their hopes up. */
function moodOf(q: Queue, i: number, tension: number): Mood {
  const worried = tension > 0.58 + 0.22 * noise(i * 2.9 + 0.3);
  return q.hope > 0 && !worried ? 'hype' : worried ? 'worried' : tension > 0.3 && noise(i * 2.2 + Math.floor(q.time * 0.5)) > 0.5 ? 'hype' : 'calm';
}

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

/**
 * A coin in a hoodie. `stride` is distance walked in px (the feet step on it); `gait` 0..1 is how much the arms,
 * head and bag follow the walk instead of the idle sway; `point` -1..1 throws an arm out toward the world's left
 * or right.
 */
function drawCoin(ctx: CanvasRenderingContext2D, x: number, footY: number, seed: number, bob: number, mood: Mood, you: boolean, shades: number, stride: number, facing = 1, time = 0, gait = 0, point = 0, raise = -1): void {
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(facing, 1);
  // Feet remain planted; the torso can shift its weight above them.
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hue = you ? 48 : Math.floor(noise(seed * 4.1) * 360);
  const hood = you ? '#ffe27a' : `hsl(${hue}, 55%, 45%)`;
  const face = you ? '#ffd23f' : `hsl(${hue}, 80%, 65%)`;
  const idle = time * 1.3 + seed;
  const cyc = (stride / 32) * Math.PI * 2;
  for (const side of [-1, 1]) {
    const phase = ((stride / 32 + (side > 0 ? 0.5 : 0)) % 1 + 1) % 1, swing = smoothstep(0.6, 1, phase);
    const foot = { x: side * 10 + (0.3 - phase + swing) * 32, y: -Math.sin(Math.PI * swing) * 13 };
    bone(ctx, { x: side * 8, y: -36 - bob }, foot, 24, 22, foot.y >= -36 ? -side : side, 9, '#2b2b36');
    ctx.fillStyle = '#1b1b22'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 2, 6.5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.translate((1 - gait) * Math.sin(time * 1.4 + seed) * 2, -bob);
  // Hoodie body.
  ctx.fillStyle = hood; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-24, -74, 48, 46, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.roundRect(-14, -50, 28, 16, 4); ctx.fill();
  // Arms in the pockets, up when hyped, swinging opposite the feet as they walk; one thrown out to point.
  const up = raise >= 0 ? clamp(raise, 0, 1.1) : mood === 'hype' ? 1 : mood === 'shock' ? 0.45 : 0;
  const aim = point * facing;
  for (const side of [-1, 1]) {
    const phase = side > 0 ? 0 : Math.PI;
    const swing = gait * Math.sin(cyc + phase) * 8 + (1 - gait) * Math.sin(idle + phase) * 2;
    let hand = { x: side * (22 + 10 * up) + swing * 0.35, y: -40 - 54 * up + (1 - Math.min(1, up)) * swing * 0.4 };
    if (aim * side > 0) { const k = Math.abs(aim); hand = { x: mix(hand.x, side * 54, k), y: mix(hand.y, -82, k) }; }
    // The elbow rides above the forearm up to the shocked pose and under it once the hand is raised; in between it
    // swings through (pointing at the camera for a moment) instead of flipping over in one frame.
    bone(ctx, { x: side * 18, y: -66 }, hand, 22, 20, side * clamp((-72 - hand.y) / 5, -1, 1), 8, hood);
  }
  // The coin head inside the hood, lagging the shoulders.
  ctx.save();
  ctx.translate(-(gait * Math.sin(cyc) + (1 - gait) * Math.sin(idle)) * 3, Math.sin(time * 2 + seed) * 1);
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
    const swing = (gait * Math.sin(cyc - 0.6) + (1 - gait) * Math.sin(time * 2 - 0.6)) * 10;
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

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, alpha: number, loud = false): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = loud ? '900 15px Impact, "Arial Black", sans-serif' : '700 12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 18;
  // The box stays between the canvas edge and the bouncer's clipboard; the tail still points at the coin.
  const cx = clamp(x, w / 2 + 6, BOUNCER_X - 50 - w / 2);
  const tx = clamp(x, cx - w / 2 + 12, cx + w / 2 - 12);
  ctx.fillStyle = loud ? '#ffe27a' : '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, y - 24, w, 24, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx - 6, y); ctx.lineTo(tx, y + 8); ctx.lineTo(tx + 6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = loud ? '#c1121f' : INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, cx, y - (loud ? 6 : 8));
  ctx.restore();
}

/** The rope, the line and your coin wherever he is; `staked` tags your coin YOU for a player (never for a spectator). */
export function drawQueue(ctx: CanvasRenderingContext2D, q: Queue, tension: number, finished: boolean, cheerful: boolean, staked = false): void {
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
  const exitX = q.mode === 'queued' ? 0 : exitPosition(q);
  const jeer = smoothstep(0, 0.15, 1.8 - q.jeer) * smoothstep(0, 0.4, q.jeer);
  for (let i = COUNT - 1; i >= 0; i -= 1) {
    const you = i === YOU;
    if (you && q.mode !== 'queued') continue;
    let x = coinX(q, i);
    let stride = x - (HEAD_START - i * SPACING);
    // A shuffle peaks at about 40 px/s: the arms join in as the coin gets moving.
    let gait = clamp(Math.abs(q.line[i]!.v) * (HEAD_END - HEAD_START) / 40, 0, 1);
    let facing = 1;
    let footY = GROUND + 6;
    if (q.panic && i !== 0) {
      // Each coin turns (squashing through it) and gets up to its run over 0.2 s, rather than snapping to speed.
      const speed = 220 + 200 * (q.runSeeds[i] ?? 0.5);
      const run = q.panicAge - 0.3 - (q.runSeeds[i] ?? 0) * 0.5;
      const turn = mix(1, -1, smoothstep(-0.18, 0.02, run));
      const from = x;
      x -= run > 0 ? speed * (run - 0.2 + 0.2 * Math.exp(-run / 0.2)) : 0;
      stride += from - x;
      gait = smoothstep(0, 0.2, run);
      facing = Math.sign(turn || -1) * mix(0.25, 1, Math.abs(turn));
      if (x < -80) continue;
    } else if (q.panic && i === 0) {
      // The head of the line is finally let in, to nobody.
      const inward = clamp(q.headIn.x, 0, 1);
      x = mix(x, 705, inward);
      footY = mix(GROUND + 6, GROUND - 4, inward);
      stride = x - HEAD_START;
      ctx.save();
      if (inward > 0.3) ctx.globalAlpha = 1 - smoothstep(0.3, 1, inward) * 0.7;
      const scale = 1 - 0.25 * inward;
      ctx.translate(x, footY); ctx.scale(scale, scale); ctx.translate(-x, -footY);
      drawCoin(ctx, x, footY, i, 0, 'worried', false, 0, stride, 1, q.time, clamp(Math.abs(q.headIn.v) * 3, 0, 1));
      ctx.restore();
      continue;
    }
    const bob = Math.max(0, q.hop[i]!.x) * 6;
    const mood: Mood = q.panic ? 'shock' : finished ? (cheerful ? 'calm' : 'shock') : moodOf(q, i, tension);
    const point = !q.panic && q.pointers.includes(i) ? clamp((exitX - x) / 30, -1, 1) * jeer : 0;
    drawCoin(ctx, x, footY, i, bob, mood, you, 0, stride, facing, q.time, gait, point, q.arms[i]!.x);
    if (you && staked && !finished && q.bubbles.every((b) => b.index !== YOU)) {
      // Your coin, for a player only: a small gold tag over the hood.
      const ty = footY - bob - 136;
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(x - 20, ty - 13, 40, 17, 5); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, ty + 4); ctx.lineTo(x, ty + 10); ctx.lineTo(x + 6, ty + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('YOU', x, ty + 1);
    }
  }
  for (const b of q.bubbles) {
    if (b.age < 0 || (b.index === YOU && q.mode !== 'queued')) continue;
    const alpha = b.age < 0.2 ? b.age / 0.2 : b.age > b.life - 0.4 ? (b.life - b.age) / 0.4 : 1;
    const bx = coinX(q, b.index) + Math.sin(q.time * 1.6 + b.index * 1.1) * 3;
    if (bx < 0) continue;
    bubble(ctx, bx, GROUND - 134, b.text, alpha, b.loud);
  }
  // Your coin leaving: steps out in front of the rope and over to the taxi.
  if (q.mode !== 'queued') {
    const k = clamp(q.youX.x, 0, 1);
    const from = q.exitFrom, to = KERB - 60;
    const y = mix(GROUND + 6, GROUND + 42, smoothstep(0, 0.3, k));
    const stride = from - (HEAD_START - YOU * SPACING) + Math.abs(exitX - from);
    drawCoin(ctx, exitX, y, YOU, q.mode === 'gone' ? Math.abs(Math.sin(q.time * 3)) * 3 : 0, 'hype', true, clamp(q.shades.x, 0, 1), stride, from > to + 8 ? -1 : 1, q.time, clamp(Math.abs(q.youX.v) * 2, 0, 1), 0, q.arms[YOU]!.x);
    if (q.mode === 'gone') {
      ctx.save(); ctx.translate(exitX, y - 150);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(-52, -14, 104, 26, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TOOK PROFITS', 0, 5);
      ctx.restore();
    }
  }
  for (const k of q.confetti) { ctx.globalAlpha = 1 - k.age / k.life; ctx.fillStyle = k.colour; ctx.beginPath(); ctx.arc(k.x, k.y, k.size, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
