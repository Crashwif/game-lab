/**
 * The shill video's set: a garage behind a beach cloth, the influencer,
 * the rented Lambo, the wallet monitor, the tow and the sponsor card.
 * The cloth, the sticker and the truck are presentation. They never
 * move the committed crash point.
 */
import { clamp, settleSpring, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
export const VIDEO_W = 590;
export const VIDEO_H = 332;
const SKIN = '#f3dccb';
/** Where the tow truck parks after the crash, and how far it hauls the Lambo out. */
const TOW_PARKED = 340;
const HAULED = 260;

/** How far the RENTAL sticker has peeled, and where the tow truck waits, at a given tension. */
const peel = (tension: number): number => clamp(tension * 1.15, 0, 1);
const towWaiting = (tension: number): number => 640 - tension * 40;

export interface Studio {
  tear: number;
  fall: Spring;
  sticker: Spring;
  truck: Spring;
  pull: number;
  sponsor: Spring;
  crashed: boolean;
  crashT: number;
  soldFlash: number;
}

export interface StudioDrive {
  running: boolean;
  tension: number;
  time: number;
}

export function createStudio(): Studio {
  return {
    tear: 0,
    fall: spring(0),
    sticker: spring(0),
    truck: spring(640),
    pull: 0,
    sponsor: spring(0),
    crashed: false,
    crashT: 0,
    soldFlash: 0,
  };
}

export function resetStudio(s: Studio): void {
  s.tear = 0;
  s.fall.x = 0;
  s.fall.v = 0;
  s.sticker.x = 0;
  s.sticker.v = 0;
  s.truck.x = 640;
  s.truck.v = 0;
  s.pull = 0;
  s.sponsor.x = 0;
  s.sponsor.v = 0;
  s.crashed = false;
  s.crashT = 0;
  s.soldFlash = 0;
}

/** Jumps the props to where the tension has them, for a stretch of the round the scene did not draw. */
export function settleStudio(s: Studio, tension: number): void {
  s.tear = tension;
  settleSpring(s.sticker, peel(tension));
  settleSpring(s.truck, towWaiting(tension));
}

/** The reveal. `quiet` (a crash that happened off screen) opens on its aftermath: no SOLD flash, nothing moving. */
export function endStudio(s: Studio, quiet: boolean): void {
  if (s.crashed) return;
  s.crashed = true;
  if (quiet) {
    // The tear and the sticker follow the tension, so they stay where the round left them.
    s.crashT = 3;
    settleSpring(s.fall, 1);
    settleSpring(s.truck, TOW_PARKED);
    s.pull = HAULED;
    settleSpring(s.sponsor, 1);
  } else {
    s.soldFlash = 1;
    s.fall.v = 2;
    s.sponsor.v = 6;
  }
}

export function stepStudio(s: Studio, drive: StudioDrive, dt: number): void {
  s.crashT += s.crashed ? dt : 0;
  s.soldFlash = Math.max(0, s.soldFlash - dt * 1.4);
  s.tear = drive.tension;
  stepSpring(s.sticker, peel(drive.tension), 5, 0.8, dt);
  stepSpring(s.fall, s.crashed ? 1 : 0, 3.2, 0.85, dt);
  const truckTarget = s.crashed ? TOW_PARKED : towWaiting(drive.tension);
  stepSpring(s.truck, truckTarget, s.crashed ? 4 : 6, 0.9, dt);
  if (s.crashed && s.truck.x < 430) s.pull = Math.min(HAULED, s.pull + 90 * dt);
  stepSpring(s.sponsor, s.crashed ? 1 : 0, 10, 0.55, dt);
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function drawGarage(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#3a3e44';
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  ctx.fillStyle = '#2c3036';
  ctx.fillRect(0, 250, VIDEO_W, 82);
  ctx.strokeStyle = '#50565e';
  ctx.lineWidth = 2;
  for (let x = 0; x < VIDEO_W; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 250);
    ctx.lineTo(x + 18, VIDEO_H);
    ctx.stroke();
  }
  ctx.fillStyle = '#5c4636';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(18, 196, 70, 54, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e7d7b8';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOODIES', 53, 226);
  ctx.fillStyle = '#2f6b3a';
  ctx.beginPath();
  ctx.ellipse(120, 214, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1d3d22';
  ctx.beginPath();
  ctx.moveTo(120, 214);
  ctx.lineTo(120, 188);
  ctx.stroke();
}

function drawBeach(ctx: CanvasRenderingContext2D, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0, '#79c7ff');
  sky.addColorStop(1, '#d8f1ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIDEO_W, 230);
  ctx.fillStyle = '#f0d7a2';
  ctx.fillRect(0, 210, VIDEO_W, 122);
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(500, 70, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2f7a3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(80, 230);
  ctx.quadraticCurveTo(70, 150, 40, 120);
  ctx.moveTo(80, 180);
  ctx.quadraticCurveTo(120, 150, 130, 170);
  ctx.stroke();
  ctx.fillStyle = '#2f7a3a';
  ctx.beginPath();
  ctx.ellipse(48, 108, 28, 12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // A wave so the cloth is obviously a loop.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= VIDEO_W; x += 12) {
    const y = 228 + Math.sin(x * 0.04 + time) * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawLambo(ctx: CanvasRenderingContext2D, x: number, sticker: number): void {
  ctx.save();
  ctx.translate(x, 236);
  ctx.fillStyle = '#c6f135';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-78, 10);
  ctx.lineTo(-70, -16);
  ctx.lineTo(-30, -22);
  ctx.lineTo(10, -40);
  ctx.lineTo(54, -40);
  ctx.lineTo(78, -16);
  ctx.lineTo(84, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c2420';
  ctx.beginPath();
  ctx.moveTo(-8, -36);
  ctx.lineTo(48, -36);
  ctx.lineTo(66, -18);
  ctx.lineTo(-24, -18);
  ctx.closePath();
  ctx.fill();
  for (const wx of [-46, 48]) {
    ctx.beginPath();
    ctx.arc(wx, 12, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1b1f';
    ctx.fill();
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(10, -8);
  ctx.rotate(sticker * 0.9);
  ctx.translate(0, -sticker * 26);
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(-22, -8, 44, 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-22, -8, 44, 16);
  ctx.fillStyle = '#c0392b';
  ctx.font = '900 10px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RENTAL', 0, 4);
  ctx.restore();
  if (sticker > 0.15) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.lineTo(4, -8 - sticker * 20);
    ctx.moveTo(16, -6);
    ctx.lineTo(14, -6 - sticker * 16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawInfluencer(ctx: CanvasRenderingContext2D, tension: number, time: number, crashed: boolean): void {
  const flap = Math.abs(Math.sin(time * (5 + tension * 22)));
  const nod = Math.sin(time * (2 + tension * 3)) * (2 + tension * 3);
  const shake = crashed ? 0 : tension > 0.55 ? Math.sin(time * 40) * 3 * tension : 0;
  ctx.save();
  ctx.translate(214, 292 + nod * 0.2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Hoodie body.
  ctx.fillStyle = '#22262e';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(0, -36, 32, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d5fb6d';
  ctx.beginPath();
  ctx.arc(-6, -48, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '900 8px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↑', -6, -45);
  // Mic.
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, -40);
  ctx.lineTo(18, -28);
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.fillRect(16, -30, 6, 8);
  // Pointing arm, shaking at the wrist.
  ctx.strokeStyle = '#22262e';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(20, -40);
  ctx.lineTo(78 + shake, -58);
  ctx.stroke();
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(78 + shake, -58);
  ctx.lineTo(96 + shake, -64);
  ctx.stroke();
  // Head.
  ctx.translate(0, -78);
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ink(ctx, 2.2);
  ctx.stroke();
  ctx.fillStyle = '#2a211c';
  ctx.beginPath();
  ctx.ellipse(0, -16, 16, 8, 0, Math.PI, 0);
  ctx.fill();
  // Shades with the tow lights living in the lenses.
  ctx.fillStyle = '#111';
  ctx.fillRect(-14, -6, 12, 8);
  ctx.fillRect(2, -6, 12, 8);
  if (tension > 0.4) {
    const blink = Math.sin(time * 18) > 0;
    ctx.fillStyle = blink ? '#ff3b3b' : '#3b7cff';
    ctx.fillRect(-12, -4, 4, 3);
    ctx.fillStyle = blink ? '#3b7cff' : '#ff3b3b';
    ctx.fillRect(8, -4, 4, 3);
  }
  ctx.fillStyle = '#6b2a2a';
  ctx.beginPath();
  ctx.ellipse(0, 8, 5, 2 + flap * 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMonitor(ctx: CanvasRenderingContext2D, tension: number, crashed: boolean, flash: number): void {
  ctx.save();
  ctx.translate(28, 176);
  ctx.fillStyle = '#14181e';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(0, 0, 150, 96, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#07140c';
  ctx.fillRect(6, 6, 138, 78);
  const pending = clamp(Math.floor(tension * 4), 0, 4);
  for (let i = 0; i < 4; i += 1) {
    const sold = crashed;
    const pendingRow = !sold && i >= 4 - pending && pending > 0;
    ctx.fillStyle = sold ? '#ff4d6d' : pendingRow ? '#ffe08a' : '#39ff8a';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    const label = sold ? 'SOLD' : pendingRow ? 'PENDING SELL' : `BUY  +${(0.4 + i * 0.3).toFixed(2)}`;
    ctx.fillText(label, 12, 24 + i * 16);
  }
  if (flash > 0.02) {
    ctx.globalAlpha = flash * 0.45;
    ctx.fillStyle = '#fff';
    ctx.fillRect(6, 6, 138, 78);
  }
  ctx.restore();
}

function drawTow(ctx: CanvasRenderingContext2D, x: number, time: number): void {
  ctx.save();
  ctx.translate(x, 248);
  ctx.fillStyle = '#f0b429';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(-46, -28, 70, 32, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a3038';
  ctx.fillRect(-38, -24, 22, 14);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(8, -36, 28, 10);
  const blink = Math.sin(time * 16) > 0;
  ctx.fillStyle = blink ? '#ff3b3b' : '#3b7cff';
  ctx.fillRect(12, -34, 8, 6);
  ctx.fillStyle = blink ? '#3b7cff' : '#ff3b3b';
  ctx.fillRect(24, -34, 8, 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-46, -8);
  ctx.lineTo(-78, 4);
  ctx.stroke();
  for (const wx of [-20, 28]) {
    ctx.beginPath();
    ctx.arc(wx, 8, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1b1f';
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStudio(ctx: CanvasRenderingContext2D, s: Studio, tension: number, time: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIDEO_W, VIDEO_H);
  ctx.clip();
  drawGarage(ctx);
  // The beach is a cloth. The edges tear back to the garage, then the cloth falls.
  const bite = 8 + s.tear * 54;
  ctx.save();
  ctx.translate(s.fall.x * 30, s.fall.x * 380);
  ctx.rotate(s.fall.x * 0.2);
  ctx.beginPath();
  ctx.moveTo(bite, bite * 0.6);
  ctx.lineTo(VIDEO_W * 0.3, bite * 0.2);
  ctx.lineTo(VIDEO_W * 0.55, bite);
  ctx.lineTo(VIDEO_W - bite, bite * 0.35);
  ctx.lineTo(VIDEO_W - bite * 0.5, VIDEO_H * 0.45);
  ctx.lineTo(VIDEO_W - bite, VIDEO_H - bite);
  ctx.lineTo(VIDEO_W * 0.6, VIDEO_H - bite * 0.4);
  ctx.lineTo(bite * 1.2, VIDEO_H - bite * 0.7);
  ctx.lineTo(bite * 0.4, VIDEO_H * 0.5);
  ctx.closePath();
  ctx.clip();
  drawBeach(ctx, time);
  ctx.restore();
  drawLambo(ctx, 400 + s.pull, s.sticker.x);
  if (s.crashed || s.truck.x < 630) drawTow(ctx, s.truck.x, time);
  drawInfluencer(ctx, tension, time, s.crashed);
  drawMonitor(ctx, tension, s.crashed, s.soldFlash);
  if (s.sponsor.x > 0.04) {
    ctx.save();
    ctx.translate(300, 150);
    const scale = clamp(s.sponsor.x, 0, 1.15);
    ctx.scale(scale, scale);
    ctx.rotate(-0.06);
    ctx.fillStyle = '#111';
    ink(ctx, 4);
    ctx.beginPath();
    ctx.roundRect(-120, -46, 240, 92, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d5fb6d';
    ctx.font = '900 32px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOONJUICE', 0, -4);
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('PAID IN FULL', 0, 22);
    ctx.restore();
  }
  // Scanlines.
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 0; y < VIDEO_H; y += 4) ctx.fillRect(0, y, VIDEO_W, 1);
  ctx.restore();
}
