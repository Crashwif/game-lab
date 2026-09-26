/**
 * The frog squad, the sergeant's phone, and your frog's dive back
 * into the trench. Bodies stay whole.
 */
import { advanceOf, ridgeY } from './field';
import { clamp } from './motion';

export const INK = '#1c1f26';

export type FrogMode = 'march' | 'dive' | 'safe' | 'flung';

export interface Squad {
  mode: FrogMode;
  age: number;
  youX: number;
  youY: number;
  vy: number;
  flung: boolean[];
  crashed: boolean;
  safe: boolean;
}

export function createSquad(): Squad {
  return { mode: 'march', age: 0, youX: 220, youY: 460, vy: 0, flung: [false, false, false, false], crashed: false, safe: false };
}

export function resetSquad(s: Squad): void {
  Object.assign(s, createSquad());
}

export function diveBack(s: Squad): void {
  if (s.mode === 'march') {
    s.mode = 'dive';
    s.age = 0;
  }
}

export function hitSquad(s: Squad, quiet: boolean, safe: boolean): void {
  if (s.crashed) return;
  s.crashed = true;
  s.safe = safe;
  if (safe) {
    s.mode = 'safe';
    s.youX = 160;
    s.youY = 470;
  } else if (quiet) {
    s.mode = 'flung';
    s.youX = 180;
    s.youY = 470;
    s.flung = [true, true, true, true];
  } else s.mode = 'flung';
}

export function stepSquad(s: Squad, multiplier: number, running: boolean, dt: number): void {
  s.age += dt;
  const adv = advanceOf(multiplier);
  if (s.mode === 'march' && running) {
    s.youX = 200 + adv * 280;
    s.youY = ridgeY(s.youX, adv) + 36 + Math.sin(s.age * 8) * 3;
  }
  if (s.mode === 'dive') {
    s.youX += (140 - s.youX) * clamp(dt * 3, 0, 1);
    s.youY += (478 - s.youY) * clamp(dt * 4, 0, 1);
    if (Math.abs(s.youX - 140) < 8) s.mode = 'safe';
  }
  if (s.mode === 'flung' && !s.safe) {
    s.vy += 500 * dt;
    s.youY += s.vy * dt;
    s.youX -= 40 * dt;
    if (s.youY > 470) {
      s.youY = 470;
      s.vy = 0;
    }
  }
}

function frog(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, cigar: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#6fbf4a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5a4632';
  ctx.beginPath();
  ctx.ellipse(0, -10, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-4, -1, 1.6, 0, Math.PI * 2);
  ctx.arc(4, -1, 1.6, 0, Math.PI * 2);
  ctx.fill();
  if (cigar) {
    ctx.strokeStyle = '#c47a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 3);
    ctx.lineTo(16, 1);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSquad(ctx: CanvasRenderingContext2D, s: Squad, multiplier: number, time: number): void {
  const adv = advanceOf(multiplier);
  const mates = [0, 1, 2, 3];
  mates.forEach((i) => {
    const x = (s.crashed && !s.safe ? 160 + i * 36 : 240 + i * 48 + adv * 220);
    const y = s.crashed && !s.safe ? 468 : ridgeY(x, adv) + 40 + Math.sin(time * 8 + i) * 2;
    frog(ctx, x, y, 0.9, false);
  });
  frog(ctx, s.youX, s.youY, 1.15, s.mode === 'safe');
  if (s.mode === 'safe' || s.mode === 'dive') {
    ctx.fillStyle = '#f0c14a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(s.youX + 16, s.youY - 8, 14, 10);
    ctx.strokeRect(s.youX + 16, s.youY - 8, 14, 10);
  }
  // Sergeant in the trench with the field phone.
  ctx.save();
  ctx.translate(70, 455);
  frog(ctx, 0, 0, 1, false);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(18, -6, 16, 10);
  ctx.strokeRect(18, -6, 16, 10);
  ctx.fillStyle = multiplier > 6 || s.crashed ? '#ff4d6d' : '#39ff8a';
  ctx.font = '700 8px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(s.crashed ? 'DEV SOLD' : multiplier > 6 ? 'DIP?' : 'HOLD', 18, 16);
  ctx.restore();
  // Rats and jeets running back once the whistles get close.
  if (adv > 0.45 && !s.crashed) {
    const rx = ((time * 80) % 400);
    ctx.fillStyle = '#6a6258';
    ctx.beginPath();
    ctx.ellipse(500 - rx, 490, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
