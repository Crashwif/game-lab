/**
 * The liquidity pool, as a pool: a cutaway of the water body whose level
 * rises with the multiplier and turns murkier, a surface that sloshes
 * harder as the tension grows, a whale that surfaces under the crowd, a
 * plug on a chain, and the rug pull: the plug pops, the water funnels down
 * the drain and takes everyone still floating with it.
 */
import { clamp, mix, mulberry32, smoothstep } from './motion';

export const POOL = { left: 160, right: 800, top: 300, floor: 505 };
export const DRAIN = { x: 760, y: 500 };
export const LADDER_X = 176;
export const INK = '#1c1f26';

export interface Splash { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; bubble: boolean }

export interface PoolState {
  time: number;
  level: number;
  fill: number;
  tension: number;
  slosh: number;
  murk: number;
  whale: { active: boolean; t: number; x: number; nextAt: number };
  draining: boolean;
  /** Seconds since the plug popped, and how far the drain has run, 0..1 (it carries on closing the funnel through the refill). */
  drainAge: number;
  drained: number;
  /** How far the plug is out: 1 the moment it pops, easing back to 0 as the next round reseats it. */
  plug: number;
  /** The dev's fake yank lifting the plug a little, 0..1 (set by the scene). */
  lift: number;
  splashes: Splash[];
  rng: () => number;
}

export function createPool(): PoolState {
  return { time: 0, level: POOL.floor - 0.35 * (POOL.floor - 320), fill: 0.35, tension: 0, slosh: 2, murk: 0, whale: { active: false, t: 0, x: 480, nextAt: 0 }, draining: false, drainAge: 0, drained: 0, plug: 0, lift: 0, splashes: [], rng: mulberry32(3) };
}

/** A new round refills from whatever the drain left (the level, slosh, murk and the drain's funnel ease back rather than snap). */
export function resetPool(p: PoolState): void {
  if (p.draining) p.fill = p.fill * (1 - p.drained) + 0.02 * p.drained;
  p.whale = { active: false, t: 0, x: 480, nextAt: 0 };
  p.draining = false;
  p.lift = 0;
}

export const fillFor = (growth: number): number => 0.35 + 0.65 * (1 - Math.exp(-growth / 2));
/** The round's tension, 1 - 1/x: a third at 1.5x, half at 2x, two thirds at 3x. */
export const tensionFor = (growth: number): number => 1 - Math.pow(2, -growth);

/** A round met late: the water already at the multiplier's level, tension and murk. */
export function settlePool(p: PoolState, growth: number): void {
  p.fill = fillFor(growth);
  p.level = POOL.floor - p.fill * (POOL.floor - 320);
  p.tension = tensionFor(growth);
  p.murk = p.tension;
  p.slosh = 2 + 9 * p.tension;
}

/** Screen y of the surface at x, including the slosh and the funnel while draining. */
export function surfaceY(p: PoolState, x: number): number {
  const amp = p.slosh;
  let y = p.level + Math.sin(x / 70 + p.time * 2.1) * amp + Math.sin(x / 31 - p.time * 3.3) * amp * 0.4;
  // The drain funnel (it closes as the last of the water goes, or as the refill starts), and the dimple a fake yank opens.
  const funnel = 60 * clamp(p.drainAge / 0.6, 0, 1) * (1 - p.drained) + 12 * p.lift;
  if (funnel > 0) {
    const d = Math.abs(x - DRAIN.x);
    y += Math.exp(-(d * d) / (2 * 120 * 120)) * funnel;
  }
  if (p.whale.active) {
    const k = Math.sin(clamp(p.whale.t / 3.2, 0, 1) * Math.PI);
    const d = x - p.whale.x;
    y -= Math.max(0, 1 - (d * d) / (150 * 150)) * 46 * k;
  }
  return Math.min(y, POOL.floor - 2);
}

export function splash(p: PoolState, x: number, y: number, count: number, strength: number): void {
  for (let i = 0; i < count; i += 1) {
    const a = -Math.PI * (0.2 + p.rng() * 0.6);
    const s = strength * (0.4 + p.rng());
    p.splashes.push({ x: x + (p.rng() - 0.5) * 20, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 2 + p.rng() * 3, age: 0, life: 0.6 + p.rng() * 0.4, bubble: false });
  }
}

/** `running` holds the round's level: the scene keeps it true through the yank's fuse, so the water only drops once the plug is out. */
export function stepPool(p: PoolState, growth: number, running: boolean, dt: number): void {
  p.time += dt;
  p.tension = tensionFor(growth);
  p.slosh += (2 + 9 * p.tension - p.slosh) * (1 - Math.exp(-dt / 0.5));
  if (!p.draining) {
    p.plug = Math.max(0, p.plug - dt * 2);
    // A drain still running when the next round starts closes at its own pace while the pool refills.
    p.drained = Math.min(1, p.drained + dt / 1.3);
    if (p.lift > 0.4 && Math.floor(p.time * 25) !== Math.floor((p.time - dt) * 25)) {
      p.splashes.push({ x: DRAIN.x + (p.rng() - 0.5) * 30, y: DRAIN.y - 14, vx: (p.rng() - 0.5) * 20, vy: -60 - p.rng() * 50, r: 2 + p.rng() * 2, age: 0, life: 0.7, bubble: true });
    }
    const target = running ? fillFor(growth) : 0.35;
    p.fill += (target - p.fill) * (1 - Math.exp(-dt / 0.8));
    p.level = POOL.floor - p.fill * (POOL.floor - 320);
    p.murk += (p.tension - p.murk) * (1 - Math.exp(-dt / 2));
    const multiplier = Math.pow(2, growth);
    if (running && multiplier >= 5 && !p.whale.active && p.time > p.whale.nextAt) {
      p.whale = { active: true, t: 0, x: 380 + p.rng() * 260, nextAt: p.time + 14 };
    }
    if (p.whale.active) {
      p.whale.t += dt;
      if (p.whale.t > 3.2) p.whale.active = false;
    }
  } else {
    // Fast enough that the pool is nearly empty inside the two-second crashed phase.
    p.drainAge += dt;
    p.drained = clamp((p.drainAge - 0.2) / 1.3, 0, 1);
    // It drains to a puddle, starting from the level the plug left (no step as it pops).
    p.level = POOL.floor - (p.fill * (1 - p.drained) + 0.02 * p.drained) * (POOL.floor - 320);
    p.whale.active = false;
    if (p.drained < 1 && Math.floor(p.time * 20) !== Math.floor((p.time - dt) * 20)) {
      p.splashes.push({ x: DRAIN.x + (p.rng() - 0.5) * 60, y: p.level + 10, vx: (p.rng() - 0.5) * 20, vy: -40 - p.rng() * 40, r: 2 + p.rng() * 3, age: 0, life: 0.8, bubble: true });
    }
  }
  for (const s of p.splashes) {
    s.age += dt;
    if (!s.bubble) s.vy += 700 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  p.splashes = p.splashes.filter((s) => s.age < s.life);
}

/** The dev pulls the plug. */
export function pullPlug(p: PoolState, seed: number, quiet: boolean): void {
  p.rng = mulberry32(seed);
  p.draining = true;
  p.plug = 1;
  p.drainAge = quiet ? 10 : 0;
  p.drained = quiet ? 1 : 0;
  if (!quiet) splash(p, DRAIN.x, p.level, 16, 260);
}

/** How strongly the drain pulls at a point while draining: 0..1, and the direction. */
export function drainPull(p: PoolState, x: number): number {
  if (!p.draining) return 0;
  const k = clamp((p.drainAge - 0.1) / 1.2, 0, 1);
  const d = clamp(1 - Math.abs(x - DRAIN.x) / 700, 0, 1);
  return k * (0.4 + 0.6 * d);
}

function waterColour(p: PoolState, alpha: number): string {
  const r = Math.round(mix(102, 122, p.murk));
  const g = Math.round(mix(224, 170, p.murk));
  const b = Math.round(mix(163, 80, p.murk));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function drawPoolBack(ctx: CanvasRenderingContext2D): void {
  // Far wall tiles and the floor.
  ctx.fillStyle = '#bfe3ef';
  ctx.fillRect(POOL.left, POOL.top, POOL.right - POOL.left, POOL.floor - POOL.top);
  ctx.strokeStyle = 'rgba(80, 130, 160, 0.35)';
  ctx.lineWidth = 1.5;
  for (let x = POOL.left; x <= POOL.right; x += 32) { ctx.beginPath(); ctx.moveTo(x, POOL.top); ctx.lineTo(x, POOL.floor); ctx.stroke(); }
  for (let y = POOL.top; y <= POOL.floor; y += 32) { ctx.beginPath(); ctx.moveTo(POOL.left, y); ctx.lineTo(POOL.right, y); ctx.stroke(); }
  ctx.fillStyle = '#a9d3e2';
  ctx.fillRect(POOL.left, POOL.floor - 8, POOL.right - POOL.left, 8);
  // Drain grate.
  ctx.fillStyle = '#4a5560';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(DRAIN.x, DRAIN.y, 22, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#2b333b';
  for (const dx of [-12, -4, 4, 12]) { ctx.beginPath(); ctx.moveTo(DRAIN.x + dx, DRAIN.y - 5); ctx.lineTo(DRAIN.x + dx, DRAIN.y + 5); ctx.stroke(); }
}

/** The water body up to the surface; things drawn after this float on it. */
export function drawWater(ctx: CanvasRenderingContext2D, p: PoolState): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(POOL.left, POOL.floor);
  for (let x = POOL.left; x <= POOL.right; x += 8) ctx.lineTo(x, surfaceY(p, x));
  ctx.lineTo(POOL.right, POOL.floor);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, p.level - 40, 0, POOL.floor);
  body.addColorStop(0, waterColour(p, 0.78));
  body.addColorStop(1, waterColour(p, 0.95));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();
  // Caustic ripples and the whale's shadow.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const y = p.level + 20 + i * 22;
    ctx.beginPath();
    for (let x = POOL.left; x <= POOL.right; x += 10) ctx.lineTo(x, y + Math.sin(x / 40 + p.time * 1.5 + i) * 4);
    ctx.stroke();
  }
  if (p.whale.active) {
    const k = Math.sin(clamp(p.whale.t / 3.2, 0, 1) * Math.PI);
    const wy = POOL.floor + 40 - k * (POOL.floor + 40 - (p.level + 30));
    ctx.save();
    ctx.translate(p.whale.x, wy);
    ctx.fillStyle = '#1d3f6e';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-150, 20); ctx.quadraticCurveTo(-140, -50, -20, -52); ctx.quadraticCurveTo(80, -54, 120, -10); ctx.lineTo(150, -32); ctx.lineTo(160, 6); ctx.lineTo(130, 4); ctx.quadraticCurveTo(80, 30, -20, 28); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-95, -22, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(-94, -22, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.moveTo(-60 + i * 8, -54 - k * (10 + i * 6)); ctx.lineTo(-60 + i * 8, -50); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
  // Surface line and foam.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = POOL.left; x <= POOL.right; x += 8) { const y = surfaceY(p, x); if (x === POOL.left) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  if (p.drainAge > 0 && p.drained < 1) {
    // The whirl fades with the funnel instead of vanishing when the pool empties or refills.
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * Math.min(1, 4 * (1 - p.drained))})`;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 4; i += 1) {
      const r = 20 + i * 24;
      ctx.beginPath(); ctx.ellipse(DRAIN.x, surfaceY(p, DRAIN.x) + i * 4, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  for (const s of p.splashes) {
    ctx.globalAlpha = (1 - s.age / s.life) * (s.bubble ? 0.7 : 1);
    ctx.fillStyle = s.bubble ? '#e8fff0' : '#dffbe8';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The near rim, the ladder, and the plug with its chain to the dev's wrist. */
export function drawPoolFront(ctx: CanvasRenderingContext2D, p: PoolState, wrist: { x: number; y: number }): void {
  ctx.fillStyle = '#e9e2d0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(POOL.left - 14, POOL.top - 10, POOL.right - POOL.left + 28, 14, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d5cdb8';
  ctx.fillRect(POOL.left - 14, POOL.top + 2, 14, POOL.floor - POOL.top);
  ctx.fillRect(POOL.right, POOL.top + 2, 14, POOL.floor - POOL.top);
  ctx.strokeStyle = '#c9d1d9';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const dx of [-7, 7]) { ctx.beginPath(); ctx.moveTo(LADDER_X + dx, POOL.top - 24); ctx.lineTo(LADDER_X + dx, POOL.top + 120); ctx.stroke(); }
  ctx.lineWidth = 3;
  for (let y = POOL.top - 10; y < POOL.top + 120; y += 18) { ctx.beginPath(); ctx.moveTo(LADDER_X - 7, y); ctx.lineTo(LADDER_X + 7, y); ctx.stroke(); }
  // The chain from the plug up the wall to the dev, sagging when nobody is pulling; a fake yank lifts the plug a little.
  const plug = smoothstep(0, 1, p.plug);
  const anchor = { x: DRAIN.x + 60 * plug, y: mix(DRAIN.y - 8 - 7 * p.lift, POOL.floor - 30, plug) };
  const sag = (1 - p.tension) * 60 * (1 - plug) * (1 - p.lift);
  ctx.strokeStyle = '#8a929c';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.quadraticCurveTo((anchor.x + wrist.x) / 2 + 10, Math.max(anchor.y, wrist.y) + sag, wrist.x, wrist.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(anchor.x, anchor.y - 1 + plug);
  ctx.rotate(0.8 * plug);
  ctx.fillStyle = '#b8323f';
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-12, -5, 24, 10, 3); ctx.fill(); ctx.stroke();
  ctx.restore();
}
