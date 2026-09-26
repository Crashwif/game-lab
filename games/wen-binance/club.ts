/**
 * The fictional nightclub THE EXCHANGE. The marquee, the doors and the
 * bass follow the displayed multiplier. No exchange branding.
 */
import { clamp, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';

export interface Club {
  doors: Spring;
  crashed: boolean;
  crashT: number;
  taxiX: number;
  taxiOn: boolean;
  sign: 'soon' | 'listed' | 'delisted';
}

export function createClub(): Club {
  return { doors: spring(0), crashed: false, crashT: 0, taxiX: -180, taxiOn: false, sign: 'soon' };
}

export function resetClub(c: Club): void {
  const next = createClub();
  Object.assign(c, next);
  c.doors = next.doors;
}

export function callTaxi(c: Club): void {
  c.taxiOn = true;
}

export function openClub(c: Club, quiet: boolean): void {
  if (c.crashed) return;
  c.crashed = true;
  c.sign = 'listed';
  if (quiet) {
    c.crashT = 2;
    c.doors.x = 1;
    c.sign = 'delisted';
  }
}

export function stepClub(c: Club, tension: number, dt: number): void {
  c.crashT += c.crashed ? dt : 0;
  const target = c.crashed ? 1 : tension * 0.45;
  stepSpring(c.doors, target, 5, 0.7, dt);
  if (c.crashed && c.crashT > 0.6) c.sign = 'delisted';
  if (c.taxiOn) c.taxiX = Math.min(120, c.taxiX + 160 * dt);
}

export function marquee(c: Club, multiplier: number): string {
  if (c.sign === 'delisted') return 'DELISTED';
  if (c.sign === 'listed') return 'LISTED';
  if (multiplier > 8) return 'LISTING?';
  return 'LISTING SOON';
}

export function drawClub(ctx: CanvasRenderingContext2D, c: Club, multiplier: number, tension: number, time: number, reduced: boolean): number {
  const bass = reduced ? 0 : Math.sin(time * (10 + tension * 24)) * tension * 4;
  ctx.save();
  ctx.translate(0, bass);
  ctx.fillStyle = '#12141c';
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#2a241c';
  ctx.fillRect(0, 430, 960, 110);
  // Facade.
  ctx.fillStyle = '#1c1a24';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(300, 90, 360, 340);
  ctx.strokeRect(300, 90, 360, 340);
  // Marquee.
  const flicker = !reduced && c.sign !== 'soon' && Math.sin(time * 18) > 0 ? 0.55 : 1;
  ctx.globalAlpha = flicker;
  ctx.fillStyle = '#f0c14a';
  ctx.fillRect(320, 110, 320, 54);
  ctx.strokeRect(320, 110, 320, 54);
  ctx.fillStyle = INK;
  ctx.font = '900 22px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE EXCHANGE', 480, 134);
  ctx.font = '700 16px Impact, sans-serif';
  ctx.fillText(marquee(c, multiplier), 480, 156);
  ctx.globalAlpha = 1;
  // Hype meter.
  const hype = clamp(Math.log2(Math.max(1, multiplier)) / 4, 0, 1);
  ctx.fillStyle = '#333';
  ctx.fillRect(340, 176, 280, 10);
  ctx.fillStyle = '#ff4d6d';
  ctx.fillRect(340, 176, 280 * hype, 10);
  // Doors. They open outward by the spring.
  const open = c.doors.x * 70;
  ctx.fillStyle = c.crashed && c.sign === 'delisted' ? '#f7f4ea' : '#3a1030';
  ctx.fillRect(420, 210, 120, 220);
  ctx.save();
  ctx.translate(420, 210);
  ctx.fillStyle = '#4a2040';
  ctx.fillRect(-open, 0, 60, 220);
  ctx.strokeRect(-open, 0, 60, 220);
  ctx.fillRect(60 + open, 0, 60, 220);
  ctx.strokeRect(60 + open, 0, 60, 220);
  ctx.restore();
  // Bouncer.
  ctx.save();
  ctx.translate(360, 400);
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(0, -36, 22, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f3dccb';
  ctx.beginPath();
  ctx.ellipse(0, -74, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const look = tension > 0.4 ? 4 : 0;
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(16, -30 + look, 22, 16);
  ctx.strokeRect(16, -30 + look, 22, 16);
  ctx.restore();
  ctx.restore();
  if (c.taxiOn) {
    ctx.save();
    ctx.translate(c.taxiX, 455);
    ctx.fillStyle = '#f0c14a';
    ctx.fillRect(0, -28, 70, 26);
    ctx.strokeRect(0, -28, 70, 26);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(16, 0, 8, 0, Math.PI * 2);
    ctx.arc(54, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return bass;
}
