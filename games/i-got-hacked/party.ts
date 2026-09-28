/**
 * The pool party on the lawn: fans that fill in on the multiplier curve and
 * lean with the tension, the pool whose water drains at the crash, the
 * follower ticker, champagne pops at each milestone, and your fan, the one
 * who can leave: a towel, a walk off to the rental Lambo, NOT HACKED.
 * Nothing here changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, STAGE } from './mansion';

export const POOL = { x: 250, y: 372, w: 520, h: 130 } as const;
export const POPS = [1.4, 1.9, 2.6, 3.6, 5, 7.5, 12, 20, 34];
/** The follower ticker in the top-right corner; the scene keeps its captions clear of it. */
export const TICKER = { x: 700, y: 14, w: 246, h: 74 } as const;
const MEME_FONT = 'Impact, "Arial Black", sans-serif';

export type FanMode = 'partying' | 'towel' | 'walking' | 'gone';

interface Fan { x: number; y: number; seed: number; inPool: boolean; arrive: number; scale: number }
interface Cork { x: number; y: number; vx: number; vy: number; age: number; life: number; colour: string; size: number }

export interface Party {
  time: number;
  fans: Fan[];
  wanted: number;
  /** Milestones reached so far, and the next one: Infinity once all of them have popped. */
  popIndex: number;
  nextPop: number;
  fill: Spring;
  water: Spring;
  lean: Spring;
  drained: boolean;
  cheer: Spring;
  sulk: Spring;
  corks: Cork[];
  you: { mode: FanMode; x: number; modeAge: number; towel: Spring };
  followers: Spring;
}

const FAN_SLOTS: Array<{ x: number; y: number; inPool: boolean }> = [];
{
  const rng = mulberry32(11);
  for (let i = 0; i < 26; i += 1) {
    const inPool = i % 3 !== 0;
    FAN_SLOTS.push({ x: inPool ? POOL.x + 40 + rng() * (POOL.w - 80) : 200 + rng() * 620, y: inPool ? POOL.y + 40 + rng() * (POOL.h - 60) : POOL.y - 24 + rng() * 14, inPool });
  }
  FAN_SLOTS.sort((a, b) => a.y - b.y);
}

export function createParty(): Party {
  return { time: 0, fans: [], wanted: 3, popIndex: 0, nextPop: POPS[0]!, fill: spring(0), water: spring(1), lean: spring(0), drained: false, cheer: spring(0), sulk: spring(0), corks: [], you: { mode: 'partying', x: 480, modeAge: 0, towel: spring(0) }, followers: spring(12_400) };
}

export function resetParty(p: Party): void {
  p.fans = [];
  p.wanted = 3;
  p.popIndex = 0;
  p.nextPop = POPS[0]!;
  settleSpring(p.fill, 0);
  settleSpring(p.water, 1);
  settleSpring(p.lean, 0);
  p.drained = false;
  settleSpring(p.cheer, 0);
  settleSpring(p.sulk, 0);
  p.corks = [];
  p.you = { mode: 'partying', x: 480, modeAge: 0, towel: spring(0) };
  settleSpring(p.followers, 12_400);
}

/** Jumps the party to where a multiplier already is. */
export function settleParty(p: Party, multiplier: number): void {
  while (p.popIndex < POPS.length && multiplier >= p.nextPop) { p.popIndex += 1; p.nextPop = POPS[p.popIndex] ?? Infinity; }
  p.wanted = fansFor(multiplier);
  while (p.fans.length < p.wanted) arrive(p, 10);
  settleSpring(p.fill, fillFor(p, multiplier));
  settleSpring(p.followers, followersFor(multiplier));
}

/** How far the milestone bar is from the last pop to the next; full once every pop has gone. */
function fillFor(p: Party, multiplier: number): number {
  if (!Number.isFinite(p.nextPop)) return 1;
  const previous = p.popIndex === 0 ? 1 : POPS[p.popIndex - 1]!;
  return clamp((multiplier - previous) / (p.nextPop - previous), 0, 1);
}

function fansFor(multiplier: number): number { return Math.min(FAN_SLOTS.length, 3 + Math.round(6 * Math.log2(Math.max(1, multiplier)))); }
export function followersFor(multiplier: number): number { return Math.round(12_400 + 400_000 * (Math.pow(Math.max(1, multiplier), 1.4) - 1)); }

function arrive(p: Party, age: number): void {
  const slot = FAN_SLOTS[p.fans.length]!;
  p.fans.push({ x: slot.x, y: slot.y, seed: p.fans.length, inPool: slot.inPool, arrive: age, scale: slot.inPool ? 0.5 : 0.6 });
}

/** Your fan leaves the party. `gone` skips the walk for a cash-out made before this scene started. */
export function leaveParty(p: Party, gone = false): void {
  if (p.you.mode !== 'partying') return;
  if (gone) { p.you = { mode: 'gone', x: STAGE.w + 60, modeAge: 10, towel: spring(1) }; return; }
  p.you.mode = 'towel'; p.you.modeAge = 0;
}

/** The pool drains. `quiet` skips the effects for a crash that already happened. */
export function drainParty(p: Party, seed: number, cheerful: boolean, quiet: boolean): void {
  p.drained = true;
  if (cheerful) settleSpring(p.cheer, 1); else settleSpring(p.sulk, 1);
  if (quiet) { settleSpring(p.water, 0); return; }
  const rng = mulberry32(seed);
  for (let i = 0; i < 12; i += 1) p.corks.push({ x: POOL.x + rng() * POOL.w, y: POOL.y + 20, vx: (rng() - 0.5) * 80, vy: -60 - rng() * 80, age: 0, life: 1.2 + rng() * 0.6, colour: '#8fd3ff', size: 3 + rng() * 4 });
}

/** A milestone: the corks fly. */
function pop(p: Party, index: number, reduced: boolean): void {
  if (reduced) return;
  const rng = mulberry32(index * 131 + 7);
  const x = POOL.x + rng() * POOL.w;
  for (let i = 0; i < 18; i += 1) p.corks.push({ x, y: POOL.y - 10, vx: (rng() - 0.5) * 240, vy: -160 - rng() * 160, age: 0, life: 1 + rng() * 0.8, colour: ['#ffe27a', '#ffffff', '#ff9db0', '#7cf67c'][i % 4]!, size: 2 + rng() * 4 });
}

export interface PartyDrive { running: boolean; multiplier: number; tension: number; reduced: boolean }

/** Returns true on the frame a milestone is reached. */
export function stepParty(p: Party, drive: PartyDrive, dt: number): boolean {
  p.time += dt;
  let reached = false;
  if (drive.running && !p.drained) {
    p.wanted = fansFor(drive.multiplier);
    if (p.fans.length < p.wanted && noise(Math.floor(p.time * 6)) > 0.3) arrive(p, 0);
    if (drive.multiplier >= p.nextPop) {
      p.popIndex += 1;
      p.nextPop = POPS[p.popIndex] ?? Infinity;
      reached = true;
      pop(p, p.popIndex, drive.reduced);
    }
  }
  for (const f of p.fans) f.arrive += dt;
  stepSpring(p.fill, p.drained ? 0 : fillFor(p, drive.multiplier), 8, 0.9, dt);
  stepSpring(p.water, p.drained ? 0 : 1, 1.6, 1, dt);
  stepSpring(p.lean, p.drained ? 0 : drive.running ? drive.tension : 0, 3, 0.8, dt);
  stepSpring(p.followers, p.drained ? p.followers.x * (1 - dt * 0.4) : followersFor(drive.multiplier), 4, 1, dt);
  for (const c of p.corks) { c.age += dt; c.x += c.vx * dt; c.vy += 420 * dt; c.y += c.vy * dt; }
  p.corks = p.corks.filter((c) => c.age < c.life);
  const y = p.you;
  y.modeAge += dt;
  if (y.mode === 'towel' && y.modeAge > 0.9) { y.mode = 'walking'; y.modeAge = 0; }
  if (y.mode === 'walking') { y.x += 190 * dt; if (y.x > STAGE.w + 60) { y.mode = 'gone'; y.modeAge = 0; } }
  stepSpring(y.towel, y.mode !== 'partying' ? 1 : 0, 12, 0.5, dt);
  return reached;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left', maxWidth?: number): void {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

type Mood = 'calm' | 'hype' | 'sulk' | 'shock';
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
  ctx.strokeStyle = INK; ctx.lineWidth = width + 5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawFan(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, scale: number, bob: number, lean: number, mood: Mood, inWater: number, special: boolean, towel: number, stride: number): void {
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(scale, scale);
  ctx.rotate(lean * 0.12 * (noise(seed * 1.9) > 0.5 ? 1 : -1));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const tone = noise(seed * 3.3);
  const skin = tone > 0.66 ? '#f3dccb' : tone > 0.33 ? '#e0bda7' : '#c68e6a';
  const swim = special ? '#ffe27a' : ['#e63946', '#3b82f6', '#2e8b57', '#7c3aed', '#ff7ab8'][Math.floor(noise(seed * 7.1) * 5)]!;
  const swimming = inWater > 0.5;
  if (!swimming) {
    for (const side of [-1, 1]) {
      const phase = stride + (side > 0 ? Math.PI : 0);
      const stepping = stride !== 0;
      const lift = stepping ? Math.max(0, Math.sin(phase)) * 14 : 0;
      const reach = stepping ? Math.cos(phase) * 10 : 0;
      const foot = { x: side * 10 + reach, y: 16 - lift };
      bone(ctx, { x: side * 8, y: -34 }, foot, 30, 28, foot.y >= -34 ? -side : side, 11, skin);
      ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 2, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  // Arms up when hyped, folded on the head when sulking, a crawl in the pool, a drink otherwise.
  const crawl = swimming ? Math.sin(stride) : 0;
  const hand = mood === 'sulk' ? { x: 4, y: -78 }
    : mood === 'hype' ? { x: 36, y: -102 }
    : swimming ? { x: 40, y: -18 - 36 * Math.max(0, crawl) }
    : { x: 28, y: -66 };
  bone(ctx, { x: 16, y: -46 }, hand, 30, 28, hand.y >= -46 ? -1 : 1, 10, skin);
  const other = mood === 'hype' ? { x: -34, y: -102 } : swimming ? { x: -40, y: -18 - 36 * Math.max(0, -crawl) } : mood === 'sulk' ? { x: -4, y: -78 } : null;
  if (other) bone(ctx, { x: -16, y: -46 }, other, 30, 28, other.y >= -46 ? 1 : -1, 10, skin);
  if (mood === 'hype') {
    ctx.save(); ctx.translate(hand.x, hand.y - 8); ctx.rotate(-0.3);
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-6, -14, 12, 20, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c'; ctx.fillRect(-4, -11, 8, 12);
    ctx.restore();
  } else if ((mood === 'calm' || mood === 'shock') && !swimming) {
    ctx.fillStyle = '#ffb36b'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hand.x - 8, hand.y - 6); ctx.lineTo(hand.x + 8, hand.y - 6); ctx.lineTo(hand.x + 5, hand.y - 30); ctx.lineTo(hand.x - 5, hand.y - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hand.x + 2, hand.y - 30); ctx.lineTo(hand.x + 8, hand.y - 44); ctx.stroke();
  }
  const hidden = swimming ? 30 : 0;
  ctx.fillStyle = swim; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-20, -40, 40, 44 - hidden, 8); ctx.fill(); ctx.stroke();
  if (towel > 0.02) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-26, -44, 52 * towel, 30, 6); ctx.fill(); ctx.stroke(); }
  const sulk = mood === 'sulk' ? 1 : 0;
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0, -58 + sulk * 10, 16, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Hair lags the step.
  ctx.fillStyle = ['#3a2a1e', '#fff1b8', '#1b1b1f', '#c94b6c'][Math.floor(noise(seed * 4.4) * 4)]!;
  ctx.save();
  ctx.translate(Math.sin(stride || seed) * 2, 0);
  ctx.beginPath(); ctx.ellipse(0, -70 + sulk * 10, 16, 8, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (!sulk) {
    ctx.fillStyle = INK;
    for (const ex of [-6, 6]) { ctx.beginPath(); ctx.ellipse(ex, -62, 2.2, mood === 'shock' ? 4 : 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (mood === 'hype') { ctx.ellipse(0, -50, 5, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else if (mood === 'shock') { ctx.ellipse(0, -49, 4, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else { ctx.moveTo(-5, -51); ctx.quadraticCurveTo(0, -47, 5, -51); }
    ctx.stroke();
    if (towel > 0.5) { ctx.fillStyle = INK; ctx.fillRect(-12, -66, 9, 6); ctx.fillRect(3, -66, 9, 6); ctx.fillRect(-3, -65, 6, 2); }
  }
  if (special && towel < 0.5) { ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-22, -104, 44, 16, 4); ctx.fill(); ctx.stroke(); label(ctx, 'YOU', 0, -92, 10, INK, 'center'); }
  ctx.restore();
}

/** The lawn, the pool, the fans and your fan; then the corks. */
export function drawParty(ctx: CanvasRenderingContext2D, p: Party, tension: number, finished: boolean, cheerful: boolean, reduced: boolean): void {
  // Lawn.
  const lawn = ctx.createLinearGradient(0, 290, 0, STAGE.h);
  lawn.addColorStop(0, '#5cb85c'); lawn.addColorStop(1, '#2f8a3e');
  ctx.fillStyle = lawn; ctx.fillRect(0, 290, STAGE.w, STAGE.h - 290);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 12; i += 1) ctx.fillRect(i * 90 + 20, 300, 40, STAGE.h - 300);
  // Pool: coping, then the basin and the water at its current level.
  ctx.fillStyle = '#e9e2d3'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(POOL.x - 14, POOL.y - 14, POOL.w + 28, POOL.h + 28, 30); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b9dff0';
  ctx.beginPath(); ctx.roundRect(POOL.x, POOL.y, POOL.w, POOL.h, 24); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28,31,38,0.15)'; ctx.lineWidth = 2;
  for (let i = 1; i < 8; i += 1) { ctx.beginPath(); ctx.moveTo(POOL.x + i * POOL.w / 8, POOL.y + 4); ctx.lineTo(POOL.x + i * POOL.w / 8, POOL.y + POOL.h - 4); ctx.stroke(); }
  const water = clamp(p.water.x, 0, 1);
  if (water > 0.02) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(POOL.x, POOL.y, POOL.w, POOL.h, 24); ctx.clip();
    const top = POOL.y + POOL.h * (1 - water) * 0.6;
    ctx.fillStyle = 'rgba(64, 170, 230, 0.85)';
    ctx.fillRect(POOL.x, top, POOL.w, POOL.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const y = top + 14 + i * 22;
      const ox = (p.time * (16 + i * 5) + i * 20) % 50;
      ctx.beginPath();
      for (let x = POOL.x - 50 + ox; x < POOL.x + POOL.w; x += 50) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 12, y - 3 - 2 * tension, x + 25, y); }
      ctx.stroke();
    }
    // A pool float.
    const fx = POOL.x + 80 + Math.sin(p.time * 0.5) * 20; const fy = top + 30;
    ctx.fillStyle = '#ff7ab8'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(fx, fy, 30, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b9dff0'; ctx.beginPath(); ctx.ellipse(fx, fy, 14, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (p.drained && water < 0.3) { label(ctx, 'POOL CLOSED', POOL.x + POOL.w / 2, POOL.y + POOL.h - 16, 12, '#7a7a86', 'center'); ctx.fillStyle = '#6a8a6a'; ctx.beginPath(); ctx.arc(POOL.x + POOL.w / 2, POOL.y + POOL.h / 2 + 10, 8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
  // Fans, back to front.
  const cheer = finished ? 0.1 : 0.25 + 0.75 * tension;
  const lean = clamp(p.lean.x, 0, 1);
  for (const f of p.fans) {
    const k = smoothstep(0, 0.5, f.arrive);
    const bob = reduced ? 0 : Math.max(0, Math.sin(p.time * (3 + 6 * cheer) + f.seed * 0.9)) * 7 * cheer + (finished && cheerful ? Math.max(0, Math.sin(p.time * 10 + f.seed)) * 10 : 0);
    const mood: Mood = finished ? (cheerful ? 'hype' : p.sulk.x > 0.5 ? 'sulk' : 'shock') : cheer > 0.7 ? 'hype' : 'calm';
    const inWater = f.inPool ? water : 0;
    const y = f.inPool ? f.y + (1 - water) * 18 : f.y;
    const paddle = f.inPool && !finished && !reduced ? p.time * (5 + 4 * cheer) + f.seed : 0;
    ctx.save();
    ctx.globalAlpha = k;
    drawFan(ctx, f.x, y, f.seed, f.scale * (0.6 + 0.4 * k), bob, lean, mood, inWater, false, 0, paddle);
    ctx.restore();
  }
  // Your fan, front row centre.
  const y = p.you;
  const mood: Mood = finished ? (cheerful ? 'hype' : p.sulk.x > 0.5 ? 'sulk' : 'shock') : cheer > 0.7 ? 'hype' : 'calm';
  if (y.mode === 'partying') {
    const bob = reduced ? 0 : Math.max(0, Math.sin(p.time * (3 + 6 * cheer) + 2)) * 7 * cheer;
    drawFan(ctx, 480, POOL.y + POOL.h + 26, 99, 0.7, bob, lean, finished && !cheerful ? 'sulk' : mood, 0, true, 0, 0);
  } else if (y.mode === 'towel') {
    drawFan(ctx, 480, POOL.y + POOL.h + 26, 99, 0.7, 0, 0, 'calm', 0, true, clamp(y.towel.x, 0, 1), 0);
    ctx.save(); ctx.translate(480, POOL.y + POOL.h - 60);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-44, -12, 88, 22, 6); ctx.fill(); ctx.stroke();
    label(ctx, 'NOT HACKED', 0, 4, 11, INK, 'center');
    ctx.restore();
  } else if (y.mode === 'walking') {
    drawFan(ctx, y.x, POOL.y + POOL.h + 26, 99, 0.7, 4, 0, 'hype', 0, true, 1, p.time * 12);
  }
  // The rental Lambo waiting at the right edge once your fan leaves.
  if (y.mode === 'walking' || y.mode === 'gone') {
    const k = y.mode === 'gone' ? Math.max(0, 1 - y.modeAge * 0.8) : 1;
    const cx = mix(STAGE.w + 120, STAGE.w - 90, k);
    ctx.save();
    ctx.translate(cx, STAGE.h - 30);
    ctx.fillStyle = '#ff9f1c'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(-84, -22); ctx.lineTo(-40, -28); ctx.lineTo(-10, -48); ctx.lineTo(50, -48); ctx.lineTo(80, -26); ctx.lineTo(90, -20); ctx.lineTo(90, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7fd3ff'; ctx.beginPath(); ctx.moveTo(-6, -44); ctx.lineTo(46, -44); ctx.lineTo(70, -28); ctx.lineTo(-30, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; for (const wx of [-50, 50]) { ctx.beginPath(); ctx.arc(wx, 2, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9aa8'; ctx.beginPath(); ctx.arc(wx, 2, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = INK; }
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-30, -20, 60, 12, 3); ctx.fill(); ctx.stroke();
    label(ctx, 'RENTAL · DAY 1', 0, -11, 8, INK, 'center');
    ctx.restore();
  }
  for (const c of p.corks) { ctx.globalAlpha = 1 - c.age / c.life; ctx.fillStyle = c.colour; ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}

/** The follower ticker and the milestone bar in the top-right corner. */
export function drawTicker(ctx: CanvasRenderingContext2D, p: Party, multiplier: number): void {
  const box = TICKER;
  ctx.save();
  ctx.fillStyle = 'rgba(16, 18, 24, 0.85)'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(box.x + 22, box.y + 22, 10, 0, Math.PI * 2); ctx.fill();
  label(ctx, 'famous_official', box.x + 40, box.y + 20, 12, '#ffffff');
  // The count shares rows with the handle, so it never runs back into it (only a wide fallback font gets close).
  const room = box.w - 52 - ctx.measureText('famous_official').width - 8;
  label(ctx, p.drained ? 'under review' : 'verified', box.x + 40, box.y + 34, 10, p.drained ? '#ff4d6d' : '#8fd3ff');
  const followers = Math.max(0, Math.round(p.followers.x));
  const text = followers >= 1e9 ? `${(followers / 1e9).toFixed(2)}B` : followers >= 1_000_000 ? `${(followers / 1_000_000).toFixed(2)}M` : followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : `${followers}`;
  ctx.fillStyle = p.drained ? '#ff4d6d' : '#7cf67c'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.font = `900 22px ${MEME_FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.strokeText(text, box.x + box.w - 12, box.y + 30, room); ctx.fillText(text, box.x + box.w - 12, box.y + 30, room);
  label(ctx, 'followers', box.x + box.w - 12, box.y + 42, 9, '#c9c9d4', 'right');
  // Milestone bar.
  const fill = clamp(p.fill.x, 0, 1);
  label(ctx, p.drained ? 'PARTY OVER' : Number.isFinite(p.nextPop) ? `NEXT POP AT ${p.nextPop.toFixed(1)}×` : 'ALL POPS', box.x + 12, box.y + 60, 10, p.drained ? '#ff4d6d' : '#ffffff');
  label(ctx, `${multiplier.toFixed(2)}×`, box.x + box.w - 12, box.y + 60, 10, '#7cf67c', 'right');
  ctx.fillStyle = '#3a3a48';
  ctx.beginPath(); ctx.roundRect(box.x + 12, box.y + 64, box.w - 24, 6, 3); ctx.fill();
  const g = ctx.createLinearGradient(box.x + 12, 0, box.x + box.w - 12, 0);
  g.addColorStop(0, '#ff7ab8'); g.addColorStop(1, '#ffe27a');
  ctx.fillStyle = g;
  if (fill > 0.01) { ctx.beginPath(); ctx.roundRect(box.x + 12, box.y + 64, (box.w - 24) * fill, 6, 3); ctx.fill(); }
  ctx.restore();
}
