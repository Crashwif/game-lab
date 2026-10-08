/**
 * Canvas 2D stand-in for browsers without WebGL2: the same race from the side,
 * so a round is never blank. The pack swims right toward the egg, thins with
 * the multiplier, and the crash drops the latex wall in front of it.
 */
import { H, INK, W } from './hud';
import { clamp, mulberry32, smoothstep } from './motion';

const DOTS = Array.from({ length: 60 }, (_, i) => {
  const random = mulberry32(i + 1);
  return { x: random(), y: random(), quit: 1.1 + Math.pow(random(), 2) * 8, phase: random() * 6.28 };
});

function tadpole(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, colour: string, size = 1): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2 * size;
  ctx.beginPath();
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    const px = x - 8 * size - t * 34 * size;
    const py = y + Math.sin(t * 9 - phase) * 5 * t * size;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * size, 6 * size, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawFallback(ctx: CanvasRenderingContext2D, multiplier: number, running: boolean, crashAge: number | null, time: number, banked: boolean, beanie: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a0716');
  g.addColorStop(0.5, '#8a1d3a');
  g.addColorStop(1, '#3a0716');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const growth = clamp(Math.log2(multiplier) / 3.5, 0, 1);
  const eggR = 40 + 120 * growth;
  const eggX = W - 90 + 40 * (1 - growth);
  ctx.fillStyle = '#fff2e8';
  ctx.beginPath();
  ctx.arc(eggX, H / 2, eggR, 0, Math.PI * 2);
  ctx.fill();
  const raced = running || crashAge !== null;
  for (const dot of DOTS) {
    if (raced && multiplier >= dot.quit) continue;
    const x = 120 + dot.x * 480 + (raced ? growth * 120 : 0);
    tadpole(ctx, x, 150 + dot.y * 240, time * 9 + dot.phase, 'rgba(255,248,240,0.85)');
  }
  if (!banked) {
    const x = 380 + growth * 260 - (crashAge !== null ? smoothstep(0, 0.4, crashAge) * 30 : 0);
    tadpole(ctx, x, H / 2, time * 12, '#ffffff', 1.5);
    // The beanie is yours only with a stake: a spectator follows a plain swimmer.
    if (beanie) {
      ctx.fillStyle = '#d5fb6d';
      ctx.beginPath();
      ctx.arc(x, H / 2 - 8, 9, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  if (crashAge !== null) {
    const k = smoothstep(0, 0.3, crashAge);
    ctx.fillStyle = `rgba(255,160,185,${0.55 * k})`;
    ctx.fillRect(eggX - eggR - 70, 0, 26, H);
  }
}
