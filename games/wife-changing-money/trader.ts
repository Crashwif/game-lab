/**
 * The degen at the kitchen table: a hunched seated rig lit by the laptop,
 * the lid closing, the tiptoe up the stairs, and the caught pose.
 * Nothing here chooses the round outcome.
 */
import { DESK } from './kitchen';
import { clamp, noise, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const SKIN = '#f3dccb';

export type TraderMode = 'hunch' | 'closing' | 'sneak' | 'upstairs' | 'caught';

export interface Trader {
  mode: TraderMode;
  modeAge: number;
  x: number;
  y: number;
  lid: Spring;
  shades: Spring;
  sweat: number;
}

export interface TraderDrive {
  running: boolean;
  fear: number;
  leaving: boolean;
  time: number;
}

export function createTrader(): Trader {
  return { mode: 'hunch', modeAge: 0, x: DESK.x, y: DESK.y, lid: spring(0.06), shades: spring(0), sweat: 0 };
}

export function resetTrader(t: Trader): void {
  t.mode = 'hunch';
  t.modeAge = 0;
  t.x = DESK.x;
  t.y = DESK.y;
  t.lid.x = 0.06;
  t.lid.v = 0;
  t.shades.x = 0;
  t.shades.v = 0;
  t.sweat = 0;
}

/** Snaps to an end pose the scene did not see him reach: upstairs after a cash-out, or caught at the desk. */
export function snapTrader(t: Trader, where: 'upstairs' | 'caught'): void {
  t.mode = where;
  t.modeAge = 8;
  t.lid.x = where === 'upstairs' ? 1 : 0.04;
  t.lid.v = 0;
  t.shades.x = where === 'upstairs' ? 1 : 0;
  t.shades.v = 0;
  if (where === 'upstairs') {
    t.x = 890;
    t.y = 118;
  } else {
    t.x = DESK.x;
    t.y = DESK.y;
  }
}

function moveToward(value: number, target: number, speed: number, dt: number): number {
  const delta = target - value;
  const step = speed * dt;
  if (Math.abs(delta) <= step) return target;
  return value + Math.sign(delta) * step;
}

export function stepTrader(t: Trader, drive: TraderDrive, dt: number): void {
  if (drive.leaving && t.mode === 'hunch') {
    t.mode = 'closing';
    t.modeAge = 0;
  }
  t.modeAge += dt;
  const open = t.mode === 'hunch' || t.mode === 'caught';
  stepSpring(t.lid, open ? 0.05 : 1, 9, 0.72, dt);
  stepSpring(t.shades, t.mode === 'sneak' || t.mode === 'upstairs' ? 1 : 0, 14, 0.55, dt);
  t.sweat = drive.running ? clamp(t.sweat + dt * (drive.fear > 0.4 ? 0.35 : -0.2), 0, 1) : t.sweat * 0.98;
  if (t.mode === 'closing' && t.lid.x > 0.9 && t.modeAge > 0.42) {
    t.mode = 'sneak';
    t.modeAge = 0;
  }
  if (t.mode === 'sneak') {
    t.x = moveToward(t.x, 900, 150, dt);
    t.y = moveToward(t.y, 110, 120, dt);
    if (t.x > 870 && t.y < 140) t.mode = 'upstairs';
  }
}

function face(ctx: CanvasRenderingContext2D, mood: 'focus' | 'shock' | 'shh', glow: 'green' | 'red' | 'off', twitch: number, shades: number): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = glow === 'green' ? '#c6efd0' : glow === 'red' ? '#f0c2c6' : SKIN;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = '#3a2a24';
  ctx.beginPath();
  ctx.ellipse(0, -16, 15, 8, 0, Math.PI, 0);
  ctx.fill();
  const eye = mood === 'shock' ? 3.4 : mood === 'focus' ? 1.5 : 2;
  ctx.fillStyle = INK;
  for (const ex of [-6, 5]) {
    ctx.beginPath();
    ctx.ellipse(ex + twitch, -2, 2.1, eye, 0, 0, Math.PI * 2);
    ctx.fill();
    if (glow === 'green') {
      ctx.fillStyle = '#39ff8a';
      ctx.fillRect(ex + twitch - 1, -3, 2, 2);
      ctx.fillStyle = INK;
    }
  }
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (mood === 'shock') ctx.ellipse(0, 8, 4, 5, 0, 0, Math.PI * 2);
  else if (mood === 'shh') { ctx.moveTo(-4, 7); ctx.quadraticCurveTo(0, 4, 4, 7); }
  else { ctx.moveTo(-4, 7); ctx.lineTo(4, 7); }
  ctx.stroke();
  if (shades > 0.04) {
    const dy = -22 * (1 - shades);
    ctx.fillStyle = INK;
    ctx.fillRect(-12, -6 + dy, 10, 6);
    ctx.fillRect(1, -6 + dy, 10, 6);
    ctx.fillRect(-2, -4 + dy, 3, 2);
  }
}

/** Draws the trader at his feet. The chair and laptop belong to the kitchen. */
export function drawTrader(ctx: CanvasRenderingContext2D, t: Trader, glow: 'green' | 'red' | 'off', time: number, fear: number): void {
  if (t.mode === 'upstairs') return;
  const typing = t.mode === 'hunch' || t.mode === 'caught';
  const bob = typing ? Math.sin(time * (5 + fear * 8)) * (2 + fear * 3) : Math.sin(t.modeAge * 14) * 2;
  const twitch = t.mode === 'caught' ? 0 : fear > 0.55 && noise(Math.floor(time * 9)) > 0.72 ? 1.6 : 0;
  ctx.save();
  ctx.translate(t.x, t.y + bob);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (t.mode === 'sneak') ctx.rotate(-0.55);
  const lean = typing ? 16 : 0;
  // Gown, hunched over the keyboard. The laptop is drawn later and covers his hands.
  ctx.fillStyle = '#3d4d73';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(lean * 0.3, -36, 28, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(lean * 0.15, -48);
  ctx.lineTo(lean, -62);
  ctx.stroke();
  // Slippers.
  ctx.fillStyle = '#6d4a3a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-14, -2, 10, 4, 0.2, 0, Math.PI * 2);
  ctx.ellipse(14, -2, 10, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#3d4d73';
  ctx.lineWidth = 6;
  if (t.mode === 'sneak') {
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(4, -70);
    ctx.lineTo(16, -96);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, -108);
    ctx.lineTo(20, -92);
    ctx.stroke();
  } else {
    const hand = Math.sin(time * 16) * (t.mode === 'caught' ? 0 : 3);
    ctx.beginPath();
    ctx.moveTo(-8, -48);
    ctx.quadraticCurveTo(-30, -30, -36, -6 + hand);
    ctx.moveTo(10, -46);
    ctx.quadraticCurveTo(34, -28, 40, -4 - hand);
    ctx.stroke();
  }
  ctx.translate(lean, typing ? -84 : -78);
  if (t.mode === 'caught') ctx.rotate(-0.2);
  face(ctx, t.mode === 'caught' ? 'shock' : t.mode === 'sneak' ? 'shh' : 'focus', glow, twitch, t.shades.x);
  if (t.sweat > 0.2 && t.mode !== 'sneak') {
    const drop = ((time * 40) % 28);
    ctx.globalAlpha = clamp(1 - drop / 28, 0, 0.8) * t.sweat;
    ctx.fillStyle = '#9fd7ff';
    ctx.beginPath();
    ctx.ellipse(14, -8 + drop * 0.4, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
