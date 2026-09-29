/**
 * Canvas 2D stand-in for browsers without WebGL2: the same launch from the
 * side, so a round is never blank. The rocket climbs from a flat earth
 * toward a moon with a face that grows with the multiplier, holders drop
 * off it, and the crash tips the moon over.
 */
import { H, INK, W } from './hud';
import { clamp, mulberry32, smoothstep } from './motion';

const DOTS = Array.from({ length: 40 }, (_, i) => {
  const random = mulberry32(i + 11);
  return { a: random() * Math.PI * 2, y: random(), quit: 1.1 + Math.pow(random(), 2) * 9, phase: random() * 6.28 };
});

export function drawFallback(ctx: CanvasRenderingContext2D, multiplier: number, running: boolean, crashAge: number | null, time: number, bailed: boolean): void {
  const growth = clamp(Math.log2(multiplier) / 5, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgb(${Math.round(30 - 26 * growth)},${Math.round(90 - 84 * growth)},${Math.round(200 - 180 * growth)})`);
  g.addColorStop(1, `rgb(${Math.round(120 - 100 * growth)},${Math.round(170 - 150 * growth)},${Math.round(230 - 200 * growth)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // The flat earth: a plate that sinks and shrinks as the rocket climbs.
  const plateY = H - 60 + growth * 90;
  ctx.fillStyle = '#2c6bd6';
  ctx.beginPath();
  ctx.ellipse(W / 2, plateY, 420 - growth * 200, 26 - growth * 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f4f8ff';
  ctx.lineWidth = 6;
  ctx.stroke();
  // The moon, growing, with a face.
  const tipped = crashAge !== null ? smoothstep(0.4, 1.4, crashAge) : 0;
  const moonR = 26 + 140 * growth;
  const moonX = W - 140;
  const moonY = 110 + tipped * 260;
  ctx.save();
  ctx.translate(moonX, moonY);
  ctx.rotate(tipped * 1.4);
  ctx.fillStyle = '#d6d3cc';
  ctx.beginPath();
  ctx.arc(0, 0, moonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a19d97';
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.cos(i * 2.1) * moonR * 0.5, Math.sin(i * 1.7) * moonR * 0.5, moonR * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  if (multiplier >= 2.4 || crashAge !== null) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-moonR * 0.28, -moonR * 0.12, moonR * 0.16, moonR * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(moonR * 0.28, -moonR * 0.12, moonR * 0.16, moonR * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-moonR * 0.32, -moonR * 0.1, moonR * 0.06, 0, Math.PI * 2);
    ctx.arc(moonR * 0.24, -moonR * 0.1, moonR * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, moonR * 0.05);
    ctx.beginPath();
    ctx.arc(0, moonR * 0.15, moonR * 0.3, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
  // The rocket.
  const climb = running || crashAge !== null ? growth : 0;
  const fall = crashAge !== null ? Math.min(1, crashAge * crashAge * 0.5) : 0;
  const x = 300 + climb * 200;
  const y = H - 130 - climb * 300 + fall * 500;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.25 + fall * 2.2);
  if (running && crashAge === null) {
    ctx.fillStyle = `rgba(255,${160 + Math.round(60 * Math.sin(time * 40))},60,0.9)`;
    ctx.beginPath();
    ctx.moveTo(-10, 40);
    ctx.lineTo(0, 70 + 20 * Math.sin(time * 33));
    ctx.lineTo(10, 40);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#f2f3f6';
  ctx.beginPath();
  ctx.roundRect(-12, -40, 24, 80, 6);
  ctx.fill();
  ctx.fillStyle = '#e0323c';
  ctx.beginPath();
  ctx.moveTo(-12, -40);
  ctx.lineTo(0, -66);
  ctx.lineTo(12, -40);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, 20);
  ctx.lineTo(-26, 44);
  ctx.lineTo(-12, 40);
  ctx.moveTo(12, 20);
  ctx.lineTo(26, 44);
  ctx.lineTo(12, 40);
  ctx.fill();
  for (const dot of DOTS) {
    if ((running || crashAge !== null) && multiplier >= dot.quit) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(Math.cos(dot.a) * 11, -30 + dot.y * 60, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!bailed) {
    ctx.fillStyle = '#c9f76b';
    ctx.beginPath();
    ctx.arc(13, -10, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
  if (bailed) {
    const px = x - 60 - time * 5;
    const py = y + 80;
    ctx.fillStyle = '#c9f76b';
    ctx.beginPath();
    ctx.arc(px, py - 30, 22, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(px - 22, py - 30);
    ctx.lineTo(px, py);
    ctx.lineTo(px + 22, py - 30);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py + 6, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
