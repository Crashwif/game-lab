/**
 * The jar: glass, a filling honey volume, drips, a lid that screws itself
 * shut, honey strings, and the sell-tax label. The level follows the
 * displayed multiplier. It does not decide the crash.
 */
import { clamp, mix, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
export const JAR = { cx: 548, top: 132, w: 188, h: 252 };

export function sellTax(multiplier: number): number {
  if (multiplier < 1.6) return 1;
  if (multiplier < 2.4) return 5;
  if (multiplier < 3.6) return 12;
  if (multiplier < 5.5) return 28;
  if (multiplier < 8) return 49;
  if (multiplier < 12) return 69;
  if (multiplier < 18) return 86;
  return 99;
}

export function honeyLevel(multiplier: number): number {
  const growth = Math.log2(Math.max(1, multiplier));
  return clamp(0.16 + 0.8 * (1 - Math.exp(-growth / 2.3)), 0.16, 0.97);
}

/** Y of the honey surface for a fill in 0..1 (0 empty). */
export function surfaceY(level: number): number {
  return JAR.top + JAR.h - 18 - level * (JAR.h - 40);
}

export interface StringBit { x: number; y: number; life: number; age: number; }

export interface JarState {
  level: Spring;
  angle: number;
  shut: Spring;
  glue: Spring;
  crashed: boolean;
  tax: number;
  taxFlash: number;
  strings: StringBit[];
  drip: number;
}

export function createJar(): JarState {
  return { level: spring(0.16), angle: 0, shut: spring(0), glue: spring(0), crashed: false, tax: 1, taxFlash: 0, strings: [], drip: 0 };
}

export function resetJar(j: JarState): void {
  j.level.x = 0.16;
  j.level.v = 0;
  j.angle = 0;
  j.shut.x = 0;
  j.shut.v = 0;
  j.glue.x = 0;
  j.glue.v = 0;
  j.crashed = false;
  j.tax = 1;
  j.taxFlash = 0;
  j.strings = [];
  j.drip = 0;
}

export function shutJar(j: JarState, quiet: boolean): void {
  if (j.crashed) return;
  j.crashed = true;
  if (quiet) {
    j.shut.x = 1;
    j.glue.x = 1;
    j.level.x = Math.max(j.level.x, 0.86);
    j.angle = 0.2;
  } else j.shut.v = 3;
}

export interface JarDrive { running: boolean; multiplier: number; tension: number; pulling: boolean; pawX: number; pawY: number; }

export function stepJar(j: JarState, drive: JarDrive, dt: number): void {
  stepSpring(j.level, j.crashed ? Math.max(j.level.x, honeyLevel(drive.multiplier)) : honeyLevel(drive.multiplier), 4, 0.9, dt);
  if (!j.crashed && drive.running) j.angle += dt * (0.5 + drive.tension * 7);
  if (j.crashed) j.angle += dt * 14 * (1 - j.shut.x);
  stepSpring(j.shut, j.crashed ? 1 : clamp(drive.tension * 0.35, 0, 0.35), 6, 0.7, dt);
  stepSpring(j.glue, j.crashed ? 1 : 0, 2.4, 0.9, dt);
  const tax = sellTax(drive.multiplier);
  if (tax !== j.tax) {
    j.tax = tax;
    j.taxFlash = 1;
  }
  j.taxFlash = Math.max(0, j.taxFlash - dt * 1.6);
  j.drip += dt * (0.4 + drive.tension);
  if (drive.pulling) {
    j.strings.push({ x: drive.pawX, y: drive.pawY, life: 0.45, age: 0 });
    if (j.strings.length > 18) j.strings.shift();
  }
  for (const s of j.strings) s.age += dt;
  j.strings = j.strings.filter((s) => s.age < s.life);
}

function ink(ctx: CanvasRenderingContext2D, width = 3): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Impact's sidebearings are narrower than the ink, so the label needs tracking. */
function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, font = `900 ${size}px Impact, "Arial Black", sans-serif`): void {
  ctx.save();
  ctx.font = font;
  ctx.letterSpacing = `${Math.max(1, Math.round(size * 0.14))}px`;
  ctx.fillStyle = fill;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function honeyColor(glue: number): string {
  const r = Math.round(mix(240, 150, glue));
  const g = Math.round(mix(176, 110, glue));
  const b = Math.round(mix(48, 48, glue));
  return `rgb(${r},${g},${b})`;
}

export function drawJar(ctx: CanvasRenderingContext2D, j: JarState, time: number): void {
  const { cx, top, w, h } = JAR;
  const left = cx - w / 2;
  const level = clamp(j.level.x, 0, 1);
  const ySurf = surfaceY(level);
  const color = honeyColor(j.glue.x);
  // Glass body.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, top + 16, w, h - 10, 18);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(left, top, w, h);
  // Honey.
  ctx.fillStyle = color;
  ctx.fillRect(left, ySurf, w, top + h - ySurf);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, ySurf, w * 0.42, 8 + Math.sin(time * 3) * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bubbles.
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 6; i += 1) {
    const bx = cx - 50 + ((i * 37) % 100);
    const by = ySurf + 20 + ((i * 53 + time * 30) % Math.max(20, top + h - ySurf - 24));
    ctx.beginPath();
    ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ink(ctx, 4);
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.roundRect(left, top + 16, w, h - 10, 18);
  ctx.stroke();
  // Highlight.
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(left + 16, top + 40);
  ctx.lineTo(left + 16, top + h - 30);
  ctx.stroke();
  // Neck and lip.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(cx - 58, top + 4, 116, 28, 8);
  ctx.fill();
  ctx.stroke();
  // Drips once the jar is getting full.
  if (level > 0.62) {
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i += 1) {
      const phase = (j.drip + i * 0.33) % 1;
      const dy = phase * 90;
      ctx.globalAlpha = 1 - phase;
      ctx.beginPath();
      ctx.ellipse(cx + 70, top + 30 + dy, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Label.
  ctx.fillStyle = '#fff8e8';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(cx - 62, top + 78, 124, 70, 6);
  ctx.fill();
  ctx.stroke();
  tracked(ctx, '$POT', cx, top + 104, 20, INK);
  ctx.save();
  ctx.translate(cx, top + 128);
  const pop = 1 + j.taxFlash * 0.25;
  ctx.scale(pop, pop);
  tracked(ctx, `SELL TAX ${j.tax}%`, 0, 0, 13, j.tax >= 49 ? '#c0392b' : INK);
  ctx.restore();
  tracked(ctx, 'BUY TAX 0%', cx, top + 142, 10, '#6b7280', '700 10px system-ui, sans-serif');
  drawLid(ctx, j);
  if (j.shut.x > 0.72 && j.crashed) drawStamp(ctx, j.shut.x);
  // Strings back to the surface.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const s of j.strings) {
    ctx.globalAlpha = 1 - s.age / s.life;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo((s.x + cx) / 2, s.y + 20, cx, ySurf);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawLid(ctx: CanvasRenderingContext2D, j: JarState): void {
  const { cx, top, w } = JAR;
  const shut = clamp(j.shut.x, 0, 1);
  // Open: a disc tipped up behind the lip. Shut: it sits flat across the mouth.
  ctx.save();
  ctx.translate(cx, top + 8 + shut * 6);
  ctx.rotate(j.angle * (1 - shut));
  ctx.scale(1, 0.35 + shut * 0.65);
  ctx.fillStyle = j.crashed ? '#5c3218' : '#c9842a';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(0, -18 * (1 - shut), w * 0.38, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f8e7b0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, -18 * (1 - shut));
  ctx.lineTo(22, -18 * (1 - shut));
  ctx.stroke();
  ctx.restore();
}

function drawStamp(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.save();
  ctx.translate(JAR.cx, JAR.top + 214);
  ctx.rotate(-0.18);
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 6;
  ctx.strokeRect(-78, -22, 156, 44);
  tracked(ctx, "CAN'T SELL", 0, 0, 18, '#c0392b');
  ctx.restore();
}
