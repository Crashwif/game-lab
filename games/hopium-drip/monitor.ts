/**
 * The bedside monitor. The trace is the displayed multiplier drawn as a
 * heartbeat. The flatline is presentation of a crash that already happened.
 */
import { clamp, noise } from './motion';

export const INK = '#1c1f26';

export function doseCount(multiplier: number): number {
  return clamp(Math.round(Math.log2(Math.max(1, multiplier)) * 2), 0, 12);
}

/** Draws the monitor in its own box at x,y. */
export function drawMonitor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  multiplier: number,
  crashed: boolean,
  crashT: number,
  time: number,
  reduced: boolean,
): void {
  const w = 210;
  const h = 130;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#101418';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#07140c';
  ctx.fillRect(8, 8, w - 16, h - 28);
  const speed = 1.2 + Math.log2(Math.max(1, multiplier)) * 1.4;
  ctx.beginPath();
  const n = 48;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const phase = ((time * speed + t) % 1 + 1) % 1;
    let py = 58;
    if (crashed) {
      if (crashT < 0.45) py = 58 + (noise(i * 3 + Math.floor(crashT * 20)) - 0.5) * 36;
      else py = 78;
    } else if (phase > 0.55 && phase < 0.72) {
      const u = (phase - 0.55) / 0.17;
      py = 58 - Math.sin(u * Math.PI) * (22 + Math.log2(multiplier) * 8);
    }
    const px = 14 + t * (w - 28);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = crashed && crashT > 0.45 ? '#ff4d6d' : '#39ff8a';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = crashed ? '#ff4d6d' : '#9ad7ff';
  ctx.font = '700 12px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(crashed ? 'FLATLINE' : `HR ${Math.round(60 + Math.log2(multiplier) * 28)}`, 12, h - 8);
  ctx.textAlign = 'right';
  ctx.fillText(`DOSE ${doseCount(multiplier)}`, w - 12, h - 8);
  if (!reduced && !crashed && Math.sin(time * speed * 6) > 0.92) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#39ff8a';
    ctx.fillRect(8, 8, w - 16, h - 28);
  }
  ctx.restore();
}
