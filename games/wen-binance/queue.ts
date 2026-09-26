/**
 * The velvet-rope queue. It advances with the multiplier. Suits are
 * waved past. Your coin can still leave in the taxi.
 */
import { clamp } from './motion';

export const INK = '#1c1f26';

export interface Queue {
  youX: number;
  leaving: boolean;
  gone: boolean;
  poured: number;
  crashed: boolean;
}

export function createQueue(): Queue {
  return { youX: 300, leaving: false, gone: false, poured: 0, crashed: false };
}

export function resetQueue(q: Queue): void {
  Object.assign(q, createQueue());
}

export function leaveQueue(q: Queue): void {
  q.leaving = true;
}

export function sellNews(q: Queue, quiet: boolean): void {
  if (q.crashed) return;
  q.crashed = true;
  if (quiet) q.poured = 1;
}

export function suitCount(multiplier: number): number {
  return clamp(Math.floor(Math.log2(Math.max(1, multiplier))), 0, 8);
}

export function stepQueue(q: Queue, multiplier: number, dt: number): void {
  const adv = clamp(Math.log2(Math.max(1, multiplier)) * 18, 0, 120);
  if (!q.leaving && !q.crashed) q.youX = 300 + adv * 0.15;
  if (q.leaving && !q.gone) {
    q.youX -= 140 * dt;
    if (q.youX < 150) q.gone = true;
  }
  if (q.crashed) q.poured = Math.min(1, q.poured + dt * 0.8);
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, you: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = you ? '#d5fb6d' : '#f0c14a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -16, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a241c';
  ctx.beginPath();
  ctx.ellipse(0, -22, 13, 6, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = you ? '#1d3354' : '#5a4632';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.restore();
}

export function drawQueue(ctx: CanvasRenderingContext2D, q: Queue, multiplier: number): void {
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(250, 470);
  ctx.lineTo(250, 400);
  ctx.lineTo(430, 400);
  ctx.stroke();
  const n = clamp(6 + Math.floor(Math.log2(Math.max(1, multiplier))), 6, 12);
  for (let i = 1; i < n; i += 1) {
    coin(ctx, q.youX - i * 28, 470, false);
  }
  if (!q.gone) coin(ctx, q.leaving ? q.youX : q.youX, 470, true);
  // Suits waved past, then pouring out.
  const suits = q.crashed ? Math.round(4 + q.poured * 4) : suitCount(multiplier);
  for (let i = 0; i < suits; i += 1) {
    const x = q.crashed ? 520 - q.poured * (40 + i * 18) : 470 + i * 8;
    ctx.fillStyle = '#1d3354';
    ctx.fillRect(x, 390, 14, 28);
    ctx.strokeRect(x, 390, 14, 28);
    ctx.fillStyle = '#f3dccb';
    ctx.beginPath();
    ctx.arc(x + 7, 384, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
