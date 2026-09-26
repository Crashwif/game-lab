/**
 * The mansion balcony, the fictional star, the yacht and the phone.
 * No likeness of a real person: a cartoon in a bathrobe.
 */
import { clamp, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const SKIN = '#f3dccb';

export interface Mansion {
  yachtX: Spring;
  shrug: number;
  crashed: boolean;
  crashT: number;
  prX: number;
}

export function createMansion(): Mansion {
  return { yachtX: spring(90), shrug: 0, crashed: false, crashT: 0, prX: 980 };
}

export function resetMansion(m: Mansion): void {
  const next = createMansion();
  Object.assign(m, next);
  m.yachtX = next.yachtX;
}

export function hackPost(m: Mansion, quiet: boolean): void {
  if (m.crashed) return;
  m.crashed = true;
  if (quiet) {
    m.crashT = 3;
    m.yachtX.x = -80;
    m.shrug = 1;
    m.prX = 760;
  }
}

export function stepMansion(m: Mansion, multiplier: number, dt: number): void {
  m.crashT += m.crashed ? dt : 0;
  const grow = Math.log2(Math.max(1, multiplier));
  const target = m.crashed ? -120 : 80 + grow * 28;
  stepSpring(m.yachtX, target, 2.2, 0.9, dt);
  if (m.crashed) m.shrug = Math.min(1, m.shrug + dt * 2);
  if (multiplier > 7 || m.crashed) m.prX += (760 - m.prX) * clamp(dt * 1.5, 0, 1);
}

export function drawMansion(ctx: CanvasRenderingContext2D, m: Mansion, multiplier: number, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 280);
  sky.addColorStop(0, '#1a2744');
  sky.addColorStop(1, '#e7a07a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#3d6f8a';
  ctx.fillRect(0, 250, 420, 90);
  // Yacht.
  ctx.save();
  ctx.translate(m.yachtX.x, 270);
  ctx.fillStyle = '#f7f4ea';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-40, 10);
  ctx.lineTo(50, 10);
  ctx.lineTo(36, 24);
  ctx.lineTo(-28, 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-10, -8, 28, 18);
  ctx.strokeRect(-10, -8, 28, 18);
  ctx.restore();
  // House.
  ctx.fillStyle = '#f3e6d4';
  ctx.fillRect(430, 150, 360, 230);
  ctx.strokeRect(430, 150, 360, 230);
  ctx.fillStyle = '#6b4226';
  ctx.beginPath();
  ctx.moveTo(410, 160);
  ctx.lineTo(610, 90);
  ctx.lineTo(810, 160);
  ctx.fill();
  ctx.stroke();
  // Balcony.
  ctx.fillStyle = '#d7c4a8';
  ctx.fillRect(500, 250, 200, 16);
  ctx.strokeRect(500, 250, 200, 16);
  // Star. Generic bathrobe, shades, no portrait.
  ctx.save();
  ctx.translate(600, 248);
  ctx.rotate(m.shrug * 0.08);
  ctx.fillStyle = '#f7f4ea';
  ctx.beginPath();
  ctx.ellipse(0, -30, 26, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -72, 16, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.fillRect(-12, -76, 10, 6);
  ctx.fillRect(2, -76, 10, 6);
  ctx.fillStyle = '#e6c56a';
  ctx.fillRect(16, -20, 22, 36);
  ctx.strokeRect(16, -20, 22, 36);
  ctx.fillStyle = '#07140c';
  ctx.fillRect(19, -14, 16, 18);
  ctx.fillStyle = m.crashed ? '#ff4d6d' : '#39ff8a';
  ctx.font = '700 7px ui-monospace, monospace';
  ctx.textAlign = 'center';
  const draft = m.crashed ? 'HACKED' : multiplier > 5 ? 'hacked?' : 'GM';
  ctx.fillText(draft, 27, -2);
  ctx.restore();
  // Manager whisper.
  if (multiplier > 2) {
    ctx.fillStyle = '#1d3354';
    ctx.beginPath();
    ctx.ellipse(540, 230, 12, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(multiplier > 8 ? 'post it' : 'whisper', 500, 200);
  }
  // PR team at the gate.
  if (m.prX < 960) {
    ctx.save();
    ctx.translate(m.prX, 400);
    ctx.fillStyle = '#222';
    ctx.fillRect(-14, -40, 28, 36);
    ctx.strokeRect(-14, -40, 28, 36);
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(0, -50, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
