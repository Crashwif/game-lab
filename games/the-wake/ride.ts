/**
 * The crash after an exit, played small: the back seat of the rideshare, over the cousin's shoulder, where the
 * wake is still streaming on their phone. The parlor is drawn into the phone's screen by the caller; this
 * file draws the car around it, the street going by, the cousin's head and hands, the sandwich and the candle.
 * Presentation only.
 */
import { blob, box, ink, INK, label, limb, poly } from './ink';
import { clamp, mix, noise } from './motion';
import { flame, glow } from './parlor';

/** Where the phone's screen sits once the camera has pulled back into the car. */
export const SCREEN = { x: 572, y: 270, w: 512, h: 288 } as const;

/** The transform that maps the 960 × 540 parlor into the screen at pull-back `k` (0 full frame, 1 in the phone). */
export function screenTransform(k: number): { x: number; y: number; s: number } {
  const s = mix(1, SCREEN.w / 960, k);
  return { x: mix(0, SCREEN.x - SCREEN.w / 2, k), y: mix(0, SCREEN.y - SCREEN.h / 2, k), s };
}

/** The car interior, drawn first, behind the screen. */
export function drawCarBehind(ctx: CanvasRenderingContext2D, k: number, amb: number): void {
  if (k <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.4, 0, 1);
  ctx.fillStyle = '#1a1820';
  ctx.fillRect(0, 0, 960, 540);
  // The side window: dusk, and the street going past.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 40);
  ctx.lineTo(250, 70);
  ctx.lineTo(270, 250);
  ctx.lineTo(0, 300);
  ctx.closePath();
  ctx.clip();
  const sky = ctx.createLinearGradient(0, 40, 0, 300);
  sky.addColorStop(0, '#5a4f7a');
  sky.addColorStop(1, '#e9a46a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 40, 280, 260);
  for (let i = 0; i < 7; i += 1) {
    const x = ((i * 63 - amb * 260) % 440 + 440) % 440 - 90;
    const h = 60 + noise(i * 3.3) * 90;
    ctx.fillStyle = i % 2 ? '#2b2638' : '#352f45';
    ctx.fillRect(x, 300 - h, 50 + noise(i) * 30, h);
    ctx.fillStyle = 'rgba(255, 210, 140, 0.8)';
    for (let w = 0; w < 4; w += 1) ctx.fillRect(x + 8 + (w % 2) * 18, 300 - h + 14 + Math.floor(w / 2) * 22, 6, 8);
  }
  for (let i = 0; i < 4; i += 1) {
    const x = ((i * 140 - amb * 700) % 560 + 560) % 560 - 120;
    ctx.fillStyle = 'rgba(255, 240, 200, 0.5)';
    ctx.fillRect(x, 150 + i * 9, 90, 2);
  }
  ctx.restore();
  ink(ctx, 6);
  ctx.strokeStyle = '#0d0c10';
  ctx.beginPath();
  ctx.moveTo(0, 40);
  ctx.lineTo(250, 70);
  ctx.lineTo(270, 250);
  ctx.lineTo(0, 300);
  ctx.stroke();
  // The front seats' backs and headrests ahead of us.
  box(ctx, 300, 330, 300, 260, 30, '#2a2730', 3);
  box(ctx, 660, 300, 300, 290, 30, '#2a2730', 3);
  box(ctx, 760, 210, 120, 90, 24, '#2f2c36', 3);
  ctx.restore();
}

/** The phone's bezel round the screen, the LIVE badge, and the cousin in front: head, shoulder, hands, sandwich, candle. */
export function drawCarFront(ctx: CanvasRenderingContext2D, k: number, amb: number, viewers: number): void {
  if (k <= 0.01) return;
  const { x, y, w, h } = SCREEN;
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.4, 0, 1);
  // Bezel.
  ctx.fillStyle = '#0e0e12';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(x - w / 2 - 16, y - h / 2 - 14, w + 32, h + 28, 26);
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 6);
  ctx.fill('evenodd');
  ctx.stroke();
  blob(ctx, x - w / 2 - 8, y, 3, 14, '#202026', 0);
  // LIVE.
  box(ctx, x - w / 2 + 10, y - h / 2 + 10, 50, 18, 4, '#e0313f', 2);
  label(ctx, 'LIVE', x - w / 2 + 35, y - h / 2 + 19.5, 11, '#ffffff', 900);
  box(ctx, x - w / 2 + 66, y - h / 2 + 10, 196, 18, 4, 'rgba(0,0,0,0.55)', 0);
  label(ctx, `GERALD’S WAKE · ${viewers} watching`, x - w / 2 + 164, y - h / 2 + 19.5, 10, '#ffffff', 700, 188);
  // The hands at the phone's lower corners.
  for (const side of [-1, 1]) blob(ctx, x + side * (w / 2 + 6), y + h / 2 - 8, 20, 26, '#c9a07c', 2.5, side * 0.3);
  // The cousin over whose shoulder we watch: back of the head, the shades' arm, the jacket.
  ctx.fillStyle = '#2e2f3a';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-20, 560);
  ctx.lineTo(-10, 430);
  ctx.quadraticCurveTo(40, 370, 170, 380);
  ctx.quadraticCurveTo(260, 392, 300, 470);
  ctx.lineTo(320, 560);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The back of the head: hair, the nape and one ear, the shades' arm over it.
  ctx.fillStyle = '#c9a07c';
  ink(ctx, 3);
  ctx.fillRect(110, 360, 80, 40);
  ctx.strokeRect(110, 360, 80, 40);
  blob(ctx, 238, 300, 15, 24, '#c9a07c', 2.5);
  blob(ctx, 150, 290, 92, 100, '#3a2a24', 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const dx of [-40, -10, 22, 50]) {
    ctx.moveTo(150 + dx, 200);
    ctx.quadraticCurveTo(150 + dx * 1.2, 290, 150 + dx * 0.9, 372);
  }
  ctx.stroke();
  ctx.fillStyle = '#c9a07c';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(96, 372);
  ctx.quadraticCurveTo(150, 392, 206, 372);
  ctx.lineTo(196, 400);
  ctx.lineTo(106, 400);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ink(ctx, 6);
  ctx.beginPath();
  ctx.moveTo(236, 288);
  ctx.lineTo(286, 280);
  ctx.stroke();
  // The second sandwich, bitten, on its way.
  ctx.save();
  ctx.translate(318, 452 + Math.sin(amb * 1.7) * 4);
  ctx.rotate(-0.4);
  poly(ctx, [-34, 26, 34, 26, 0, -34], '#f2dca6', 3);
  ctx.fillStyle = '#7fb069';
  ctx.fillRect(-28, 14, 56, 5);
  ctx.fillStyle = '#1a1820';
  ctx.beginPath();
  ctx.arc(2, -32, 11, 0, Math.PI * 2);
  ctx.arc(14, -20, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  limb(ctx, [{ x: 250, y: 560 }, { x: 290, y: 500 }, { x: 304, y: 470 }], 30, '#2e2f3a', 3);
  blob(ctx, 306, 470, 18, 16, '#c9a07c', 2.5);
  // The commemorative candle on the seat, still warm.
  box(ctx, 880, 470, 26, 46, 4, '#f3ead6', 2.5);
  box(ctx, 882, 486, 22, 14, 2, '#5b7fa6', 1.5);
  flame(ctx, 893, 470, amb, 2);
  glow(ctx, 893, 460, 60, [255, 190, 110], 0.35);
  ctx.fillStyle = INK;
  ctx.restore();
}
