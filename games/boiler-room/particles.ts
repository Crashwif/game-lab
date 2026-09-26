/**
 * Layered particles: steam and smoke that swell and drift, sparks and embers
 * from the fire, coal off the shovel, soot, and the rivets and valve cap that
 * fly at the blow-out. Layer 0 draws behind the machinery, layer 1 in front of
 * everything but the HUD.
 */
import { noise } from './motion';

export type Layer = 0 | 1;
export type Kind = 'steam' | 'smoke' | 'spark' | 'ember' | 'coal' | 'soot' | 'rivet' | 'cap';

export interface Particle {
  kind: Kind;
  layer: Layer;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
  angle: number;
  spin: number;
  tone: number;
}

export interface Particles {
  list: Particle[];
}

export const FLOOR_Y = 470;
const MAX = 900;

export const createParticles = (): Particles => ({ list: [] });

export function emit(ps: Particles, p: Omit<Particle, 'age'>): void {
  if (ps.list.length >= MAX) ps.list.shift();
  ps.list.push({ ...p, age: 0 });
}

/** A cloud of steam leaving a point along a direction, fanned out a little. */
export function puff(ps: Particles, x: number, y: number, dirX: number, dirY: number, speed: number, count: number, size: number, life: number, layer: Layer, seed: number): void {
  for (let i = 0; i < count; i += 1) {
    const n = seed + i * 1.7;
    const spread = (noise(n) - 0.5) * 0.9;
    const s = speed * (0.5 + noise(n + 1));
    const cs = Math.cos(spread);
    const sn = Math.sin(spread);
    emit(ps, {
      kind: 'steam', layer,
      x: x + (noise(n + 2) - 0.5) * 8, y: y + (noise(n + 3) - 0.5) * 8,
      vx: (dirX * cs - dirY * sn) * s, vy: (dirX * sn + dirY * cs) * s,
      r: size * (0.6 + noise(n + 4) * 0.8), life: life * (0.7 + noise(n + 5) * 0.6), angle: 0, spin: 0, tone: noise(n + 6),
    });
  }
}

export function sparks(ps: Particles, x: number, y: number, count: number, speed: number, seed: number, layer: Layer = 1): void {
  for (let i = 0; i < count; i += 1) {
    const n = seed + i * 2.3;
    const a = -Math.PI * (0.15 + noise(n) * 0.7);
    const s = speed * (0.4 + noise(n + 1));
    emit(ps, { kind: 'spark', layer, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.5 + noise(n + 2) * 1.8, life: 0.35 + noise(n + 3) * 0.5, angle: 0, spin: 0, tone: noise(n + 4) });
  }
}

export function stepParticles(ps: Particles, dt: number, draught: number): void {
  for (const p of ps.list) {
    p.age += dt;
    switch (p.kind) {
      case 'steam':
        p.r += 26 * dt;
        p.vy -= 28 * dt;
        p.vx += draught * dt;
        p.vx *= Math.exp(-1.2 * dt);
        p.vy *= Math.exp(-1.2 * dt);
        break;
      case 'smoke':
        p.r += 13 * dt;
        p.vy -= 10 * dt;
        p.vx += (draught - 6) * dt;
        p.vx *= Math.exp(-0.6 * dt);
        break;
      case 'spark':
        p.vy += 420 * dt;
        p.vx *= Math.exp(-0.8 * dt);
        break;
      case 'ember':
        p.vy -= 45 * dt;
        p.vx += Math.sin(p.age * 9 + p.tone * 10) * 40 * dt;
        break;
      case 'coal':
        p.vy += 700 * dt;
        p.angle += p.spin * dt;
        break;
      case 'soot':
        p.vy -= 6 * dt;
        p.vx += Math.sin(p.age * 3 + p.tone * 7) * 12 * dt;
        break;
      case 'rivet':
      case 'cap':
        p.vy += 800 * dt;
        p.angle += p.spin * dt;
        if (p.y > FLOOR_Y - p.r && p.vy > 0) {
          p.y = FLOOR_Y - p.r;
          p.vy = -p.vy * 0.35;
          p.vx *= 0.6;
          p.spin *= 0.5;
        }
        break;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  ps.list = ps.list.filter((p) => p.age < p.life);
}

export function drawParticles(ctx: CanvasRenderingContext2D, ps: Particles, layer: Layer): void {
  ctx.save();
  for (const p of ps.list) {
    if (p.layer !== layer) continue;
    const k = 1 - p.age / p.life;
    switch (p.kind) {
      case 'steam':
        ctx.globalAlpha = k * 0.5 * (0.7 + 0.3 * p.tone);
        ctx.fillStyle = '#f4f6f8';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        break;
      case 'smoke':
        ctx.globalAlpha = k * 0.4;
        ctx.fillStyle = '#5f636c';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        break;
      case 'spark':
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.fillStyle = p.tone > 0.5 ? '#ffd27a' : '#ff8c42';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        break;
      case 'ember':
        ctx.globalAlpha = k;
        ctx.fillStyle = '#ff6a2a';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        break;
      case 'coal':
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#1b1b1f';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillRect(-4, -3, 8, 6); ctx.restore();
        break;
      case 'soot':
        ctx.globalAlpha = k * 0.6;
        ctx.fillStyle = '#26262b';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        break;
      case 'rivet':
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#c9a44a';
        ctx.strokeStyle = '#1c1f26';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 'cap':
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.fillStyle = '#c9a44a'; ctx.strokeStyle = '#1c1f26'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-11, -8, 22, 16, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-16, -8); ctx.lineTo(16, -8); ctx.stroke();
        ctx.restore();
        break;
    }
  }
  ctx.restore();
}
