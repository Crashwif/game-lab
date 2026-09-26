/**
 * The pool party. Fans multiply with the multiplier. The water drains
 * on the crash. Your fan can still walk out.
 */
import { clamp, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';

export interface Party {
  water: Spring;
  fanX: number;
  leaving: boolean;
  gone: boolean;
  pops: number;
  crashed: boolean;
}

export function createParty(): Party {
  return { water: spring(1), fanX: 180, leaving: false, gone: false, pops: 0, crashed: false };
}

export function resetParty(p: Party): void {
  const next = createParty();
  Object.assign(p, next);
  p.water = next.water;
}

export function leaveParty(p: Party): void {
  p.leaving = true;
}

export function drainParty(p: Party, quiet: boolean): void {
  if (p.crashed) return;
  p.crashed = true;
  if (quiet) p.water.x = 0.05;
}

export function fanCount(multiplier: number): number {
  return clamp(Math.round(3 + Math.log2(Math.max(1, multiplier)) * 3), 3, 16);
}

export function followerCount(multiplier: number): number {
  return Math.floor(4000 * Math.pow(Math.max(1, multiplier), 1.3));
}

export function stepParty(p: Party, multiplier: number, dt: number): void {
  const target = p.crashed ? 0.08 : 1;
  stepSpring(p.water, target, 2.4, 0.85, dt);
  p.pops = Math.floor(Math.log2(Math.max(1, multiplier)));
  if (p.leaving) {
    p.fanX += 140 * dt;
    if (p.fanX > 980) p.gone = true;
  }
}

export function drawParty(ctx: CanvasRenderingContext2D, p: Party, multiplier: number, time: number): void {
  ctx.fillStyle = '#6f8f4a';
  ctx.fillRect(0, 340, 960, 200);
  // Pool.
  ctx.fillStyle = '#d7e4ea';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(360, 430, 150, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(360, 430, 140, 40, 0, 0, Math.PI * 2);
  ctx.clip();
  const level = clamp(p.water.x, 0, 1);
  ctx.fillStyle = '#3aa0d8';
  ctx.fillRect(200, 430 - level * 36, 320, 80);
  ctx.restore();
  const n = fanCount(multiplier);
  for (let i = 0; i < n; i += 1) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = 250 + col * 40;
    const y = 410 + row * 18;
    const inWater = p.water.x > 0.4 && row === 0;
    ctx.fillStyle = ['#e63946', '#3b82f6', '#f2c14e', '#7cf67c'][i % 4]!;
    ctx.beginPath();
    ctx.arc(x, inWater ? y : y - (1 - p.water.x) * 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Champagne pops at milestones.
  for (let i = 0; i < p.pops; i += 1) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(300 + i * 28, 360 + Math.sin(time * 4 + i) * 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (!p.gone) {
    ctx.save();
    ctx.translate(p.fanX, 480);
    ctx.fillStyle = '#f3dccb';
    ctx.beginPath();
    ctx.arc(0, -28, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = p.leaving ? '#d5fb6d' : '#3b82f6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 0);
    ctx.stroke();
    if (p.leaving) {
      ctx.fillStyle = '#f7f4ea';
      ctx.fillRect(8, -16, 10, 8);
    }
    ctx.restore();
  }
  ctx.fillStyle = '#fff';
  ctx.font = '900 22px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${followerCount(multiplier).toLocaleString('en-US')} FANS`, 24, 380);
}
