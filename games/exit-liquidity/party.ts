/**
 * The party: holders who cannonball in and bob on tubes, your degen on the
 * flamingo, the DJ, and the dev on his lounger with the chain round his
 * wrist. An accepted exit paddles you to the ladder and onto a lounger with
 * a towel and shades; the rug pull spins everyone still floating down the
 * drain and leaves one sad Wojak in the puddle.
 */
import { type Spring, clamp, mix, noise, settleSpring, spring, stepSpring } from './motion';
import { DRAIN, INK, LADDER_X, POOL, type PoolState, drainPull, splash, surfaceY } from './pool';

const SKIN = '#f3dccb';
const TUBES = ['#ff5d9e', '#7cf67c', '#ffe27a', '#8fd3ff', '#c084fc'];
export const DEV_LOUNGER = { x: 872, y: POOL.top - 4 };
export const SAFE_LOUNGER = { x: 78, y: POOL.top - 4 };

export type HolderMode = 'jumping' | 'floating' | 'sucked' | 'gone' | 'puddle';
export interface Holder { x: number; y: number; tube: string; tone: number; phase: number; mode: HolderMode; t: number; fromX: number; toX: number; spin: number; scale: number }
export type AvatarMode = 'floating' | 'paddling' | 'climbing' | 'walking' | 'lounging' | 'sucked' | 'puddle';
export type DevMode = 'lounging' | 'standing' | 'leaving';

export interface PartyState {
  time: number;
  holders: Holder[];
  avatar: { mode: AvatarMode; x: number; y: number; modeAge: number; spin: number; scale: number; shades: Spring; fear: number };
  dev: { mode: DevMode; x: number; modeAge: number; grin: Spring; yank: Spring };
  whaleFlash: number;
  rng: () => number;
  events: { splash: { x: number; y: number } | null };
}

export function createParty(): PartyState {
  return {
    time: 0, holders: [], avatar: { mode: 'floating', x: 480, y: 420, modeAge: 0, spin: 0, scale: 1, shades: spring(0), fear: 0 },
    dev: { mode: 'lounging', x: DEV_LOUNGER.x, modeAge: 0, grin: spring(0), yank: spring(0) }, whaleFlash: 0,
    rng: () => 0.5, events: { splash: null },
  };
}

export function resetParty(p: PartyState, seed: number): void {
  let a = seed >>> 0;
  p.rng = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  p.holders = [];
  p.avatar = { mode: 'floating', x: 480, y: 420, modeAge: 0, spin: 0, scale: 1, shades: spring(0), fear: 0 };
  p.dev = { mode: 'lounging', x: DEV_LOUNGER.x, modeAge: 0, grin: spring(0), yank: spring(0) };
  p.whaleFlash = 0;
}

/** The exit was accepted: paddle for the ladder. */
export function leavePool(p: PartyState): void {
  if (p.avatar.mode === 'floating') { p.avatar.mode = 'paddling'; p.avatar.modeAge = 0; }
}

/** The plug is out. */
export function rugPulled(p: PartyState, quiet: boolean): void {
  p.dev.mode = 'standing';
  p.dev.modeAge = 0;
  p.dev.yank.v += 30;
  for (const h of p.holders) if (h.mode === 'floating' || h.mode === 'jumping') h.mode = quiet ? 'gone' : 'sucked';
  const a = p.avatar;
  if (a.mode === 'floating' || a.mode === 'paddling') { a.mode = quiet ? 'puddle' : 'sucked'; a.modeAge = 0; }
  else if (a.mode === 'climbing') { a.mode = 'walking'; a.modeAge = 0; a.y = POOL.top - 30; }
  if (quiet) { a.x = DRAIN.x - 30; a.y = POOL.floor - 6; }
  else {
    // Someone is left behind in the puddle: the avatar if he stayed, otherwise a random holder.
    if (a.mode !== 'sucked') {
      const stay = p.holders.filter((h) => h.mode === 'sucked');
      if (stay.length) { const h = stay[Math.floor(p.rng() * stay.length)]!; h.mode = 'puddle'; h.x = DRAIN.x - 40 + p.rng() * 20; }
    }
  }
}

export function stepParty(p: PartyState, pool: PoolState, growth: number, running: boolean, fear: number, dt: number): void {
  p.time += dt;
  p.events.splash = null;
  const a = p.avatar;
  a.modeAge += dt;
  a.fear = fear;
  const want = Math.min(22, 2 + Math.floor(growth * 5));
  if (running && !pool.draining && p.holders.filter((h) => h.mode !== 'gone').length < want && !p.holders.some((h) => h.mode === 'jumping')) {
    p.holders.push({ x: 840, y: POOL.top - 30, tube: TUBES[Math.floor(p.rng() * TUBES.length)]!, tone: p.rng(), phase: p.rng() * 6.3, mode: 'jumping', t: 0, fromX: 840, toX: 230 + p.rng() * 520, spin: 0, scale: 1 });
  }
  for (const h of p.holders) {
    switch (h.mode) {
      case 'jumping': {
        h.t += dt / 0.9;
        const t = clamp(h.t, 0, 1);
        h.x = mix(h.fromX, h.toX, t);
        h.y = mix(POOL.top - 30, surfaceY(pool, h.toX) - 4, t) - Math.sin(t * Math.PI) * 110;
        if (h.t >= 1) { h.mode = 'floating'; splash(pool, h.x, surfaceY(pool, h.x), 12, 200); p.events.splash = { x: h.x, y: h.y }; }
        break;
      }
      case 'floating':
        h.x += Math.sin(p.time * 0.5 + h.phase) * 6 * dt;
        h.x = clamp(h.x, POOL.left + 30, POOL.right - 30);
        h.y = surfaceY(pool, h.x) - 4 + Math.sin(p.time * 2 + h.phase) * 2;
        break;
      case 'sucked': {
        const pull = drainPull(pool, h.x);
        h.x += (DRAIN.x - h.x) * pull * 2.2 * dt;
        h.y = surfaceY(pool, h.x) - 4;
        h.spin += pull * 9 * dt;
        if (Math.abs(h.x - DRAIN.x) < 40 && pool.drained > 0.2) h.scale = Math.max(0, h.scale - dt * 1.6);
        if (h.scale <= 0.02) h.mode = 'gone';
        break;
      }
      case 'puddle':
        h.y = POOL.floor - 6;
        break;
      case 'gone':
        break;
    }
  }
  switch (a.mode) {
    case 'floating':
      a.x = 480 + Math.sin(p.time * 0.4) * 10;
      a.y = surfaceY(pool, a.x) - 6;
      break;
    case 'paddling':
      a.x = Math.max(LADDER_X + 22, a.x - 230 * dt);
      a.y = surfaceY(pool, a.x) - 6;
      if (a.x <= LADDER_X + 22) { a.mode = 'climbing'; a.modeAge = 0; }
      break;
    case 'climbing': {
      const k = clamp(a.modeAge / 0.9, 0, 1);
      a.x = LADDER_X;
      a.y = mix(surfaceY(pool, LADDER_X) - 6, POOL.top - 30, k);
      if (k >= 1) { a.mode = 'walking'; a.modeAge = 0; }
      break;
    }
    case 'walking': {
      a.y = POOL.top - 30;
      a.x = Math.max(SAFE_LOUNGER.x, a.x - 150 * dt);
      if (a.x <= SAFE_LOUNGER.x) { a.mode = 'lounging'; a.modeAge = 0; }
      break;
    }
    case 'lounging':
      a.x = SAFE_LOUNGER.x;
      a.y = POOL.top - 26;
      stepSpring(a.shades, 1, 12, 0.5, dt);
      break;
    case 'sucked': {
      const pull = drainPull(pool, a.x);
      a.x += (DRAIN.x - a.x) * pull * 2 * dt;
      a.y = surfaceY(pool, a.x) - 6;
      a.spin += pull * 8 * dt;
      if (Math.abs(a.x - DRAIN.x) < 40 && pool.drained > 0.25) a.scale = Math.max(0, a.scale - dt * 1.4);
      if (a.scale <= 0.02) { a.mode = 'puddle'; a.modeAge = 0; a.scale = 1; a.spin = 0; a.x = DRAIN.x - 30; }
      break;
    }
    case 'puddle':
      a.y = POOL.floor - 6;
      break;
  }
  const d = p.dev;
  d.modeAge += dt;
  stepSpring(d.grin, d.mode === 'lounging' ? clamp(growth / 3.3, 0, 1) : 1, 3, 0.8, dt);
  stepSpring(d.yank, 0, 8, 0.5, dt);
  if (d.mode === 'standing' && d.modeAge > 0.9) { d.mode = 'leaving'; d.modeAge = 0; }
  if (d.mode === 'leaving') d.x += 150 * dt;
  p.whaleFlash = pool.whale.active && pool.whale.t < 1.5 ? 1 : Math.max(0, p.whaleFlash - dt * 1.5);
}

/** The dev's wrist, where the chain ends. */
export function devWrist(p: PartyState): { x: number; y: number } {
  const d = p.dev;
  if (d.mode === 'lounging') return { x: d.x - 34, y: DEV_LOUNGER.y - 28 + d.yank.x * 0 };
  return { x: d.x - 26, y: DEV_LOUNGER.y - 62 - clamp(d.yank.x, 0, 30) };
}

interface WojakLook { tone: number; mood: 'calm' | 'nervous' | 'panic' | 'smug' | 'sad' | 'shock'; shades: number; scale: number; spin: number }

/** Head and shoulders of a Wojak, facing left toward the pool centre or right. */
export function drawWojakBust(ctx: CanvasRenderingContext2D, x: number, y: number, look: WojakLook, facing: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(look.spin);
  ctx.scale(look.scale * facing, look.scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Shoulders.
  ctx.fillStyle = look.tone > 0.66 ? '#e63946' : look.tone > 0.33 ? '#3b82f6' : '#f2c14e';
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-16, -6, 32, 16, 6); ctx.fill(); ctx.stroke();
  // Head.
  ctx.beginPath(); ctx.ellipse(0, -20, 12, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN; ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  const open = look.mood === 'shock' || look.mood === 'panic' ? 1.5 : look.mood === 'sad' ? 0.6 : 1;
  for (const ex of [2, 8]) { ctx.beginPath(); ctx.ellipse(ex, -23, 1.8, 1.8 * open, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  const brow = look.mood === 'nervous' || look.mood === 'panic' || look.mood === 'sad' ? 1 : look.mood === 'smug' ? -0.6 : 0;
  ctx.beginPath(); ctx.moveTo(-1, -28 + brow); ctx.lineTo(4, -28 - 2 * brow); ctx.moveTo(6, -28 - 2 * brow); ctx.lineTo(11, -28 + brow); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -21); ctx.lineTo(12, -16); ctx.lineTo(8, -15); ctx.stroke();
  ctx.beginPath();
  if (look.mood === 'shock' || look.mood === 'panic') { ctx.ellipse(6, -10, 3, 3.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (look.mood === 'sad') { ctx.moveTo(2, -9); ctx.quadraticCurveTo(6, -13, 10, -9); }
  else if (look.mood === 'smug') { ctx.moveTo(2, -11); ctx.quadraticCurveTo(7, -6, 11, -12); }
  else { ctx.moveTo(2, -10); ctx.quadraticCurveTo(6, -8 + (look.mood === 'nervous' ? -2 : 0), 10, -10); }
  ctx.stroke();
  if (look.shades > 0.02) {
    const dy = -30 * (1 - look.shades);
    ctx.fillStyle = INK;
    ctx.fillRect(-1, -26 + dy, 6, 4);
    ctx.fillRect(6, -26 + dy, 6, 4);
    ctx.fillRect(5, -25 + dy, 1.5, 1.5);
  }
  ctx.restore();
}

function drawTube(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, scale: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.ellipse(0, 4, 24, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 8; ctx.stroke();
  ctx.restore();
}

function drawFlamingo(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ff7eb3'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, 6, 38, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-50, -30, -42, -46); ctx.quadraticCurveTo(-36, -58, -26, -50); ctx.lineTo(-24, -40); ctx.quadraticCurveTo(-34, -30, -22, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.moveTo(-26, -50); ctx.lineTo(-14, -46); ctx.lineTo(-26, -42); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-34, -50, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-33.5, -50, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLounger(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string): void {
  ctx.fillStyle = colour; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(x - 44, y - 16, 88, 12, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 44, y - 12); ctx.lineTo(x - 56, y - 44); ctx.lineTo(x - 30, y - 40); ctx.lineTo(x - 24, y - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  for (const dx of [-36, 36]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 4); ctx.lineTo(x + dx, y + 6); ctx.stroke(); }
}

export function drawDeckProps(ctx: CanvasRenderingContext2D, p: PartyState, beat: number): void {
  // DJ booth at the back of the pool with pulsing speakers.
  const DJ_X = 485;
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(DJ_X - 55, POOL.top - 60, 110, 52, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff5d9e';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LP', DJ_X, POOL.top - 30);
  for (const sx of [DJ_X - 41, DJ_X + 41]) {
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath(); ctx.roundRect(sx - 12, POOL.top - 112, 24, 48, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a5560';
    ctx.beginPath(); ctx.arc(sx, POOL.top - 92, 8 + beat * 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, POOL.top - 72, 5 + beat * 2, 0, Math.PI * 2); ctx.fill();
  }
  drawWojakBust(ctx, DJ_X, POOL.top - 66 + Math.sin(p.time * 8) * 2 * (0.3 + beat), { tone: 0.5, mood: 'smug', shades: 1, scale: 1, spin: 0 }, 1);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(DJ_X, POOL.top - 88, 13, Math.PI, Math.PI * 2); ctx.stroke();
  // Loungers: the dev's and the safe one.
  drawLounger(ctx, DEV_LOUNGER.x, DEV_LOUNGER.y, '#f2c14e');
  drawLounger(ctx, SAFE_LOUNGER.x, SAFE_LOUNGER.y, '#8fd3ff');
}

export function drawHoldersBehind(ctx: CanvasRenderingContext2D, p: PartyState, pool: PoolState): void {
  // Tubes and bodies float on the water; the water is drawn between this layer and the fronts.
  for (const h of p.holders) {
    if (h.mode === 'gone' || h.mode === 'puddle') continue;
    drawTube(ctx, h.x, h.y, h.tube, h.scale, h.spin);
  }
  const a = p.avatar;
  if (a.mode === 'floating' || a.mode === 'paddling' || a.mode === 'sucked') drawFlamingo(ctx, a.x, a.y, a.scale, a.spin);
  void pool;
}

export function drawFigures(ctx: CanvasRenderingContext2D, p: PartyState, pool: PoolState, fear: number): void {
  const mood = (f: number): WojakLook['mood'] => (f > 0.62 ? 'panic' : f > 0.25 ? 'nervous' : 'calm');
  for (const h of p.holders) {
    if (h.mode === 'gone') continue;
    const look: WojakLook = { tone: h.tone, mood: h.mode === 'sucked' ? 'shock' : h.mode === 'puddle' ? 'sad' : h.mode === 'jumping' ? 'smug' : mood(fear), shades: 0, scale: h.scale, spin: h.spin };
    drawWojakBust(ctx, h.x, h.y - 8, look, h.x > 480 ? -1 : 1);
    if (h.mode === 'puddle') {
      ctx.fillStyle = 'rgba(102, 224, 163, 0.6)';
      ctx.beginPath(); ctx.ellipse(h.x, POOL.floor - 3, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  const a = p.avatar;
  const aMood: WojakLook['mood'] = a.mode === 'sucked' ? 'shock' : a.mode === 'puddle' ? 'sad' : a.mode === 'lounging' || a.mode === 'walking' || a.mode === 'climbing' || a.mode === 'paddling' ? 'smug' : mood(fear);
  if (a.mode === 'puddle') {
    ctx.fillStyle = 'rgba(102, 224, 163, 0.6)';
    ctx.beginPath(); ctx.ellipse(a.x, POOL.floor - 3, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  drawWojakBust(ctx, a.x, a.y - 10, { tone: 0.9, mood: aMood, shades: clamp(a.shades.x, 0, 1), scale: a.mode === 'sucked' ? a.scale : 1.15, spin: a.spin }, 1);
  if (a.mode === 'lounging') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(a.x + 14, a.y - 30, 12, 16, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5d9e';
    ctx.fillRect(a.x + 15, a.y - 22, 10, 7);
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.roundRect(a.x - 40, a.y - 8, 26, 8, 2); ctx.fill(); ctx.stroke();
  }
  // The dev: lounging with the chain, then standing to yank it, then strolling off with the bag.
  const d = p.dev;
  const grin = clamp(d.grin.x, 0, 1);
  const devY = d.mode === 'lounging' ? DEV_LOUNGER.y - 26 : DEV_LOUNGER.y - 44;
  drawWojakBust(ctx, d.x, devY, { tone: 0.2, mood: d.mode === 'lounging' ? (grin > 0.5 ? 'smug' : 'calm') : 'smug', shades: 1, scale: 1.15, spin: d.mode === 'lounging' ? -0.25 : 0 }, -1);
  if (d.mode !== 'lounging') {
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(d.x + 14, devY - 2); ctx.quadraticCurveTo(d.x + 40, devY - 8, d.x + 40, devY + 18); ctx.quadraticCurveTo(d.x + 30, devY + 30, d.x + 16, devY + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c';
    ctx.font = '900 11px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', d.x + 30, devY + 14);
  }
  if (p.whaleFlash > 0) {
    ctx.globalAlpha = Math.min(1, p.whaleFlash);
    ctx.font = '900 30px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = INK;
    ctx.strokeText('WHALE ALERT', pool.whale.x, pool.level - 90);
    ctx.fillStyle = '#8fd3ff';
    ctx.fillText('WHALE ALERT', pool.whale.x, pool.level - 90);
    ctx.globalAlpha = 1;
  }
  void noise;
  void settleSpring;
}
