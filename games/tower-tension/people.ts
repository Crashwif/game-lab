/**
 * Tiny Wojaks: the residents leaning out of Ponzi Towers' windows, the same
 * people falling with the floors, and the presale queue at the sales office.
 * Everything is drawn in a local frame a couple of dozen px tall so the
 * callers can scale, tilt and fling them with whatever they stand on.
 */
import { clamp } from './motion';

const INK = '#1c1f26';
const SKIN = '#f3dccb';
export const SHIRTS = ['#3b82f6', '#e63946', '#7cf67c', '#f4c542', '#c084fc', '#f97316'] as const;
export const shirt = (tone: number): string => SHIRTS[Math.floor(clamp(tone, 0, 0.999) * SHIRTS.length)]!;

/** meh: the default sad Wojak; hype: phone out, mouth open with joy; panic: screaming; out: X eyes. */
export type Mood = 'meh' | 'hype' | 'panic' | 'out';

/** The face on a head of radius `r` centred on the origin. */
export function drawWojakFace(ctx: CanvasRenderingContext2D, mood: Mood, r: number): void {
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.1;
  const e = r * 0.42;
  if (mood === 'out') {
    for (const ex of [-e, e]) { ctx.beginPath(); ctx.moveTo(ex - 1.4, -1.6); ctx.lineTo(ex + 1.4, 1.2); ctx.moveTo(ex + 1.4, -1.6); ctx.lineTo(ex - 1.4, 1.2); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, r * 0.5, 1.2, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  ctx.fillStyle = INK;
  for (const ex of [-e, e]) { ctx.beginPath(); ctx.arc(ex, -r * 0.1, mood === 'panic' ? 1.1 : 0.8, 0, Math.PI * 2); ctx.fill(); }
  // Brows: up in the middle for the sad default, high and wide in a panic.
  ctx.beginPath();
  if (mood === 'panic') { ctx.moveTo(-e - 1.5, -r * 0.62); ctx.lineTo(-e + 1.2, -r * 0.5); ctx.moveTo(e + 1.5, -r * 0.62); ctx.lineTo(e - 1.2, -r * 0.5); }
  else { ctx.moveTo(-e - 1.5, -r * 0.42); ctx.lineTo(-e + 1, -r * 0.55); ctx.moveTo(e + 1.5, -r * 0.42); ctx.lineTo(e - 1, -r * 0.55); }
  ctx.stroke();
  if (mood === 'panic') {
    ctx.fillStyle = '#3a1420';
    ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.3, r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (mood === 'hype') {
    ctx.fillStyle = '#3a1420';
    ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.36, r * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.5); ctx.quadraticCurveTo(0, r * 0.28, r * 0.3, r * 0.5); ctx.stroke();
  }
}

/**
 * Head and shoulders leaning out of a window, the sill at the origin. `wave` is the angle of the raised arm
 * (0 straight up), swung by the caller; `arms` 1 puts both hands up.
 */
export function drawWojakBust(ctx: CanvasRenderingContext2D, mood: Mood, wave: number, tone: number, arms = 0): void {
  ctx.lineCap = 'round';
  ctx.fillStyle = shirt(tone);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-5.5, -6, 11, 7, 2); ctx.fill(); ctx.stroke();
  // The far arm up when both go up; the near arm waves.
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = INK;
  const left = clamp(arms, 0, 1);
  ctx.beginPath(); ctx.moveTo(-4.5, -4); ctx.lineTo(-4.5 - 4 + 2 * left, -4 - 9 * left + 1); ctx.stroke();
  ctx.strokeStyle = SKIN; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(4.5, -4); ctx.lineTo(4.5 + Math.sin(wave) * 9, -4 - Math.cos(wave) * 9); ctx.stroke();
  ctx.strokeStyle = SKIN; ctx.lineWidth = 2; ctx.stroke();
  ctx.save();
  ctx.translate(0, -10);
  drawWojakFace(ctx, mood, 4.4);
  ctx.restore();
}

/**
 * A whole tiny Wojak standing on the origin, about 26 px tall. `arms` 0 hangs them, 1 throws them up; `walk`
 * swings the legs (radians); `phone` puts one out in front of the face.
 */
export function drawWojak(ctx: CanvasRenderingContext2D, mood: Mood, arms: number, walk: number, tone: number, phone = false): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const leg = (x0: number, x1: number) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(x0, -11); ctx.lineTo(x1, 0); ctx.stroke();
    ctx.strokeStyle = '#2f3f5c'; ctx.lineWidth = 2.6; ctx.stroke();
  };
  leg(-2.5, -3 - Math.sin(walk) * 4);
  leg(2.5, 3 + Math.sin(walk) * 4);
  ctx.fillStyle = shirt(tone);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-5, -21, 10, 11, 2); ctx.fill(); ctx.stroke();
  const up = clamp(arms, 0, 1);
  for (const side of [-1, 1]) {
    const hx = side * (6 + 3 * up);
    const hy = -14 - 14 * up + (side > 0 && phone ? 2 : 0);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(side * 4, -19); ctx.lineTo(phone && side > 0 ? 3 : hx, phone && side > 0 ? -25 : hy); ctx.stroke();
    ctx.strokeStyle = SKIN; ctx.lineWidth = 2; ctx.stroke();
  }
  if (phone) {
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath(); ctx.roundRect(2, -31, 5, 8, 1); ctx.fill();
    ctx.fillStyle = '#7cf67c';
    ctx.fillRect(3, -30, 3, 5);
  }
  ctx.save();
  ctx.translate(0, -26);
  drawWojakFace(ctx, mood, 4.6);
  ctx.restore();
}
