/**
 * Degen General: the bed, the draining bag, the doctor, the roommate
 * behind the curtain, and the walk out. Comedy only.
 */
import { clamp, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const SKIN = '#f3dccb';

export type PatientMode = 'bed' | 'up' | 'walk' | 'gone' | 'flat';

export interface Ward {
  mode: PatientMode;
  age: number;
  x: number;
  bag: Spring;
  hold: boolean;
  curtain: Spring;
  roommateX: number;
  roommateGone: boolean;
  wilt: Spring;
  sheet: Spring;
  crashed: boolean;
  crashT: number;
  safe: boolean;
}

export function createWard(): Ward {
  return {
    mode: 'bed', age: 0, x: 430, bag: spring(1), hold: false, curtain: spring(0),
    roommateX: 820, roommateGone: false, wilt: spring(0), sheet: spring(0),
    crashed: false, crashT: 0, safe: false,
  };
}

export function resetWard(w: Ward): void {
  const next = createWard();
  Object.assign(w, next);
  w.bag = next.bag;
  w.curtain = next.curtain;
  w.wilt = next.wilt;
  w.sheet = next.sheet;
}

export function discharge(w: Ward): void {
  if (w.mode === 'bed') {
    w.mode = 'up';
    w.age = 0;
    w.hold = true;
  }
}

export function flatlineWard(w: Ward, quiet: boolean, safe: boolean): void {
  if (w.crashed) return;
  w.crashed = true;
  w.safe = safe;
  if (safe) {
    w.mode = 'gone';
    w.x = 1040;
  } else w.mode = 'flat';
  if (quiet) {
    w.crashT = 3;
    w.sheet.x = safe ? 0 : 1;
    w.bag.x = safe ? w.bag.x : 0.05;
    w.roommateGone = true;
    w.roommateX = 1100;
    w.curtain.x = 1;
    w.wilt.x = 1;
  }
}

export interface WardDrive { running: boolean; multiplier: number; fear: number; }

export function bagTarget(multiplier: number): number {
  return clamp(1 - Math.log2(Math.max(1, multiplier)) / 3.6, 0.08, 1);
}

export function stepWard(w: Ward, drive: WardDrive, dt: number): void {
  w.age += dt;
  w.crashT += w.crashed ? dt : 0;
  const drain = w.crashed && !w.safe ? 0.05 : w.hold ? w.bag.x : bagTarget(drive.multiplier);
  stepSpring(w.bag, drain, 3.5, 0.9, dt);
  stepSpring(w.wilt, drive.fear, 2, 0.9, dt);
  const open = drive.multiplier >= 8 || w.crashed ? 1 : drive.fear * 0.3;
  stepSpring(w.curtain, open, 4, 0.8, dt);
  stepSpring(w.sheet, w.mode === 'flat' ? 1 : 0, 4, 0.8, dt);
  if ((drive.multiplier >= 8 || w.crashed) && !w.roommateGone) {
    w.roommateX += 90 * dt;
    if (w.roommateX > 1040) w.roommateGone = true;
  }
  if (w.mode === 'up' && w.age > 0.45) {
    w.mode = 'walk';
    w.age = 0;
  }
  if (w.mode === 'walk') {
    w.x += 120 * dt;
    if (w.x > 1000) w.mode = 'gone';
  }
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function drawPerson(ctx: CanvasRenderingContext2D, suit: boolean, pupils: number, flat: boolean): void {
  ctx.fillStyle = suit ? '#1d3354' : '#d7ebe8';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.ellipse(0, -28, 22, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -64, 16, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a2a24';
  ctx.beginPath();
  ctx.ellipse(0, -76, 15, 7, 0, Math.PI, 0);
  ctx.fill();
  const eye = flat ? 1.2 : 2 + pupils;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(-6, -64, 2, eye, 0, 0, Math.PI * 2);
  ctx.ellipse(6, -64, 2, eye, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (flat) ctx.moveTo(-4, -54), ctx.lineTo(4, -54);
  else { ctx.moveTo(-3, -54); ctx.quadraticCurveTo(0, -50, 4, -54); }
  ctx.stroke();
  if (suit) {
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-2, -40, 4, 16);
  }
}

export function drawWard(ctx: CanvasRenderingContext2D, w: Ward, multiplier: number, time: number): void {
  ctx.fillStyle = '#e7f3ef';
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#c9ddd8';
  ctx.fillRect(0, 0, 960, 300);
  // Window.
  ctx.fillStyle = '#9fd0ea';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(40, 70, 120, 80, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a211c';
  ctx.fillRect(0, 430, 960, 110);
  // Bed.
  ctx.fillStyle = '#f7f4ea';
  ctx.beginPath();
  ctx.roundRect(300, 360, 280, 36, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8aa8a4';
  ctx.fillRect(292, 348, 16, 80);
  ctx.fillRect(572, 348, 16, 80);
  // Flowers, wilting.
  ctx.save();
  ctx.translate(250, 340);
  ctx.rotate(w.wilt.x * 0.8);
  ctx.strokeStyle = '#3d8a4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(0, -20);
  ctx.stroke();
  ctx.fillStyle = w.wilt.x > 0.6 ? '#b9a48a' : '#e05a7a';
  ctx.beginPath();
  ctx.arc(0, -26, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // IV stand and bag.
  const label = w.crashed && !w.safe ? 'RUGGED' : multiplier >= 6 ? 'COPIUM' : 'HOPIUM';
  ctx.strokeStyle = '#9aa7b2';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(640, 430);
  ctx.lineTo(640, 150);
  ctx.lineTo(690, 150);
  ctx.stroke();
  const fill = clamp(w.bag.x, 0, 1);
  ctx.fillStyle = label === 'RUGGED' ? '#ffb4c2' : label === 'COPIUM' ? '#c7b4ff' : '#d5fb6d';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(656, 168, 52, 78, 6);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(658, 170 + (1 - fill) * 72, 48, fill * 72);
  ctx.clip();
  ctx.fillStyle = label === 'RUGGED' ? '#ff4d6d' : label === 'COPIUM' ? '#7c5cff' : '#8adf3a';
  ctx.fillRect(658, 170, 48, 74);
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.font = '900 10px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 682, 212);
  // Tube toward the bed while he is still in it.
  if (w.mode === 'bed' || w.mode === 'flat') {
    ctx.strokeStyle = '#d7dde6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(682, 246);
    ctx.quadraticCurveTo(560, 300, 470, 360);
    ctx.stroke();
  }
  // Patient.
  if (w.mode !== 'gone') {
    ctx.save();
    ctx.translate(w.mode === 'bed' || w.mode === 'flat' ? 460 : w.x, w.mode === 'walk' || w.mode === 'up' ? 430 : 390);
    const pupils = clamp((multiplier - 3) / 10, 0, 1.4);
    drawPerson(ctx, w.mode === 'walk' || w.mode === 'up', pupils, w.mode === 'flat');
    if ((w.mode === 'walk' || w.mode === 'up') && !w.crashed) {
      ctx.fillStyle = '#d5fb6d';
      ctx.beginPath();
      ctx.ellipse(28, -90, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = '700 8px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAINS', 28, -86);
      ctx.strokeStyle = '#888';
      ctx.beginPath();
      ctx.moveTo(28, -70);
      ctx.lineTo(10, -50);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Sheet over the laptop and the patient on the flatline.
  if (w.sheet.x > 0.02) {
    ctx.globalAlpha = clamp(w.sheet.x, 0, 1);
    ctx.fillStyle = '#f4f7fb';
    ctx.beginPath();
    ctx.moveTo(320, 390);
    ctx.quadraticCurveTo(460, 330, 600, 390);
    ctx.lineTo(590, 410);
    ctx.lineTo(330, 410);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Roommate and curtain.
  if (!w.roommateGone) {
    ctx.save();
    ctx.translate(w.roommateX, 400);
    ctx.fillStyle = '#f7f4ea';
    ctx.fillRect(-40, -10, 80, 16);
    ctx.strokeRect(-40, -10, 80, 16);
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(0, -24, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 1 - w.curtain.x * 0.85;
  ctx.fillStyle = '#7ec8c0';
  ctx.fillRect(760, 160, 70, 280);
  ctx.restore();
  // Doctor.
  ctx.save();
  ctx.translate(720, 430);
  ctx.fillStyle = '#f7f7f2';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(0, -40, 18, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -78, 12, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(16, -36, 36, 28);
  ctx.strokeRect(16, -36, 36, 28);
  ctx.fillStyle = INK;
  ctx.font = '700 8px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const note = w.crashed && !w.safe ? 'TIME' : multiplier < 2 ? 'STABLE' : multiplier < 5 ? 'ELEVATED' : multiplier < 8 ? 'FEVER' : 'COPIUM';
  ctx.fillText(note, 20, -18);
  ctx.restore();
}
