/**
 * The ward at Degen General: the bed and the patient sitting up with his
 * laptop, the IV stand whose HOPIUM bag drains on the multiplier curve, the
 * doctor and the clipboard whose notes get worse, the flowers that wilt, the
 * roommate behind the curtain who flatlines first, the discharge walk and,
 * at the crash, the sheet over the laptop and the time of death. Nothing
 * here changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const WARD = { x: 0, y: 0, w: 640, h: 540 } as const;
export type Point = { x: number; y: number };

export type BagLabel = 'HOPIUM' | 'COPIUM' | 'RUGGED';
export type PatientMode = 'bed' | 'unplugging' | 'dressing' | 'walking' | 'gone';

interface Drop { y: number; age: number }
interface Petal { x: number; y: number; vx: number; vy: number; rot: number; age: number }

export interface Ward {
  time: number;
  lean: Spring;
  twitch: Spring;
  pupil: Spring;
  typing: Spring;
  blinkAt: number;
  eyeOpen: Spring;
  /** 1 full, 0 empty. */
  level: Spring;
  label: BagLabel;
  swap: Spring;
  drops: Drop[];
  nextDrop: number;
  doctorLean: Spring;
  doctorPen: Spring;
  noteIndex: number;
  wilt: Spring;
  petals: Petal[];
  curtain: Spring;
  roommateGone: Spring;
  roommateFlat: boolean;
  patient: { mode: PatientMode; x: number; modeAge: number; suit: Spring; balloon: Spring };
  dead: boolean;
  deadAge: number;
  sheet: Spring;
  deathX100: number;
  shock: Spring;
  lights: number;
}

const NOTES = ['stable, ish', 'asked for more', 'refuses to sell', 'pupils dilated', 'talking about lambos', 'vitals unstable', 'family notified', 'DNR: do not rug'];

export function createWard(): Ward {
  return {
    time: 0, lean: spring(0), twitch: spring(0), pupil: spring(0), typing: spring(0), blinkAt: 2, eyeOpen: spring(1),
    level: spring(1), label: 'HOPIUM', swap: spring(0), drops: [], nextDrop: 0,
    doctorLean: spring(0), doctorPen: spring(0), noteIndex: 0, wilt: spring(0), petals: [],
    curtain: spring(0), roommateGone: spring(0), roommateFlat: false,
    patient: { mode: 'bed', x: 300, modeAge: 0, suit: spring(0), balloon: spring(0) },
    dead: false, deadAge: 0, sheet: spring(0), deathX100: 100, shock: spring(0), lights: 0,
  };
}

export function resetWard(w: Ward): void {
  settleSpring(w.lean, 0); settleSpring(w.twitch, 0); settleSpring(w.pupil, 0); settleSpring(w.typing, 0); settleSpring(w.eyeOpen, 1);
  settleSpring(w.level, 1); w.label = 'HOPIUM'; settleSpring(w.swap, 0); w.drops = []; w.nextDrop = 0;
  settleSpring(w.doctorLean, 0); settleSpring(w.doctorPen, 0); w.noteIndex = 0; settleSpring(w.wilt, 0); w.petals = [];
  settleSpring(w.curtain, 0); settleSpring(w.roommateGone, 0); w.roommateFlat = false;
  w.patient = { mode: 'bed', x: 300, modeAge: 0, suit: spring(0), balloon: spring(0) };
  w.dead = false; w.deadAge = 0; settleSpring(w.sheet, 0); w.deathX100 = 100; settleSpring(w.shock, 0); w.lights = 0;
}

/** Jumps the slow states to where a round already is (a reconnect mid-round). */
export function settleWard(w: Ward, tension: number, doses: number): void {
  settleSpring(w.level, 1 - clamp(tension, 0, 1) * 0.95);
  settleSpring(w.wilt, clamp(tension * 1.4 - 0.2, 0, 1));
  w.noteIndex = Math.min(NOTES.length - 1, doses);
  if (tension > 0.55) { w.roommateFlat = true; settleSpring(w.roommateGone, 1); settleSpring(w.curtain, 1); }
  if (doses >= 4) { w.label = 'COPIUM'; settleSpring(w.swap, 0); }
}

/** A dose milestone: the patient twitches and leans in, the doctor writes, the nurse may swap the bag. */
export function dose(w: Ward, index: number): void {
  w.twitch.v += 14;
  w.lean.v += 6;
  w.doctorPen.v += 12;
  w.noteIndex = Math.min(NOTES.length - 1, index);
  if (index >= 4 && w.label === 'HOPIUM') { w.label = 'COPIUM'; w.swap.v += 10; }
}

/** The accepted exit: the drip is pulled and the patient gets dressed. */
export function discharge(w: Ward): void {
  if (w.patient.mode === 'bed' && !w.dead) { w.patient.mode = 'unplugging'; w.patient.modeAge = 0; }
}

/** The flatline. `quiet` skips the effects for a crash that already happened. */
export function flatline(w: Ward, crashX100: number, quiet: boolean): void {
  if (w.dead) return;
  w.dead = true;
  w.deathX100 = crashX100;
  w.deadAge = quiet ? 10 : 0;
  w.label = 'RUGGED';
  w.drops = [];
  const rng = mulberry32(crashX100);
  w.lights = 0.3 + rng() * 0.4;
  if (quiet) { settleSpring(w.sheet, 1); settleSpring(w.level, 0); settleSpring(w.doctorLean, 1); return; }
  w.shock.v += 8;
  w.twitch.v += 20;
}

export interface WardDrive { running: boolean; tension: number; multiplier: number; reduced: boolean }

export function stepWard(w: Ward, drive: WardDrive, dt: number): void {
  w.time += dt;
  const t = drive.tension;
  const alive = !w.dead && w.patient.mode === 'bed';
  stepSpring(w.lean, alive && drive.running ? 0.3 + 0.7 * t : 0, 6, 0.6, dt);
  stepSpring(w.twitch, 0, 14, 0.25, dt);
  stepSpring(w.pupil, alive && drive.running ? t : w.dead ? 1 : 0, 4, 0.9, dt);
  stepSpring(w.typing, alive && drive.running ? 1 : 0, 8, 0.8, dt);
  const blinking = w.time > w.blinkAt && w.time < w.blinkAt + 0.12;
  if (w.time >= w.blinkAt + 0.12) w.blinkAt = w.time + 1.5 + 3 * noise(w.blinkAt) * (1 - 0.6 * t);
  stepSpring(w.eyeOpen, w.dead ? 0.05 : blinking ? 0.1 : 1 + 0.4 * t, 24, 0.9, dt);
  stepSpring(w.level, w.dead ? 0 : drive.running && alive ? 1 - t * 0.95 : w.level.x, 3, 1, dt);
  stepSpring(w.swap, 0, 8, 0.5, dt);
  if (drive.running && alive && w.time > w.nextDrop) {
    w.nextDrop = w.time + mix(0.9, 0.12, t);
    w.drops.push({ y: 0, age: 0 });
  }
  for (const d of w.drops) { d.age += dt; d.y += (60 + 120 * d.age) * dt; }
  w.drops = w.drops.filter((d) => d.y < 130);
  stepSpring(w.doctorLean, w.dead ? 1 : drive.running ? 0.5 * t : 0, 5, 0.8, dt);
  stepSpring(w.doctorPen, 0, 10, 0.4, dt);
  stepSpring(w.wilt, drive.running || w.dead ? clamp(t * 1.4 - 0.2, 0, 1) + (w.dead ? 1 : 0) : w.wilt.x, 2, 1, dt);
  if ((drive.running || w.dead) && w.wilt.x > 0.3 && noise(Math.floor(w.time * 6) * 1.7) > 0.85 - 0.3 * w.wilt.x && w.petals.length < 24) {
    w.petals.push({ x: 560 + noise(w.time * 9) * 30, y: 236, vx: (noise(w.time * 5) - 0.5) * 20, vy: 10, rot: noise(w.time) * 6, age: 0 });
  }
  for (const p of w.petals) { p.age += dt; p.x += p.vx * dt + Math.sin(p.age * 4) * 12 * dt; p.y += (p.vy + 40 * p.age) * dt; p.rot += dt * 2; }
  w.petals = w.petals.filter((p) => p.y < 400);
  if (!w.roommateFlat && drive.running && t > 0.55) w.roommateFlat = true;
  stepSpring(w.curtain, w.roommateFlat ? 1 : 0, 3, 0.9, dt);
  stepSpring(w.roommateGone, w.roommateFlat && w.curtain.x > 0.8 ? 1 : 0, 2.5, 1, dt);
  const p = w.patient;
  p.modeAge += dt;
  if (p.mode === 'unplugging' && p.modeAge > 0.8) { p.mode = 'dressing'; p.modeAge = 0; }
  if (p.mode === 'dressing' && p.modeAge > 0.9) { p.mode = 'walking'; p.modeAge = 0; }
  if (p.mode === 'walking') { p.x += 150 * dt; if (p.x > WARD.w + 80) { p.mode = 'gone'; p.modeAge = 0; } }
  stepSpring(p.suit, p.mode === 'dressing' || p.mode === 'walking' || p.mode === 'gone' ? 1 : 0, 10, 0.5, dt);
  stepSpring(p.balloon, p.mode === 'walking' || p.mode === 'gone' ? 1 : 0, 6, 0.6, dt);
  if (w.dead) {
    w.deadAge += dt;
    stepSpring(w.sheet, w.deadAge > 1.2 ? 1 : 0, 6, 0.9, dt);
    stepSpring(w.shock, w.deadAge < 2 ? 1 : 0, 8, 0.8, dt);
  }
}

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, colour: string): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width + 5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
}

function memeSmall(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center'): void {
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.12); ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

/** The IV stand and the bag, its level and its label, the drip line to the arm. */
function drawDrip(ctx: CanvasRenderingContext2D, w: Ward, tension: number): void {
  const x = 150;
  ctx.save();
  ctx.lineJoin = 'round';
  // Stand.
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, 470); ctx.stroke();
  ctx.strokeStyle = '#9aa7b5'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 6;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, 460); ctx.lineTo(x + side * 30, 478); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 30, 118); ctx.lineTo(x + 30, 118); ctx.stroke();
  // Bag, shaken when the nurse swaps it.
  const swap = clamp(w.swap.x, -1, 1);
  ctx.save();
  ctx.translate(x, 122 + Math.abs(swap) * 10);
  ctx.rotate(swap * 0.2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke();
  const bw = 62, bh = 110;
  ctx.fillStyle = 'rgba(230, 240, 245, 0.75)';
  ctx.beginPath(); ctx.roundRect(-bw / 2, 12, bw, bh, 12); ctx.fill();
  const level = clamp(w.level.x, 0, 1);
  const colour = w.label === 'HOPIUM' ? '#7cf67c' : w.label === 'COPIUM' ? '#8fd3ff' : '#ff4d6d';
  ctx.save();
  ctx.beginPath(); ctx.roundRect(-bw / 2, 12, bw, bh, 12); ctx.clip();
  const top = 12 + bh * (1 - level);
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.moveTo(-bw / 2, top + Math.sin(w.time * 3) * 2); ctx.quadraticCurveTo(0, top - 3 + Math.sin(w.time * 4) * 2, bw / 2, top + Math.cos(w.time * 3) * 2); ctx.lineTo(bw / 2, 12 + bh); ctx.lineTo(-bw / 2, 12 + bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-bw / 2 + 6, 20, 6, bh - 16);
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-bw / 2, 12, bw, bh, 12); ctx.stroke();
  // Label.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(-bw / 2 + 6, 50, bw - 12, 34, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = w.label === 'RUGGED' ? '#ff4d6d' : INK;
  ctx.font = '900 13px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(w.label, 0, 66);
  ctx.font = '700 8px system-ui, sans-serif'; ctx.fillStyle = INK;
  ctx.fillText(w.label === 'RUGGED' ? '0 mg · discontinued' : `${Math.round(level * 1000)} mg · ${w.label === 'HOPIUM' ? 'as needed' : 'when it dips'}`, 0, 78);
  // Drip chamber and drops.
  ctx.fillStyle = 'rgba(230, 240, 245, 0.8)';
  ctx.beginPath(); ctx.roundRect(-9, 12 + bh + 4, 18, 30, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = colour;
  for (const d of w.drops) if (d.y < 28) { ctx.beginPath(); ctx.arc(0, 12 + bh + 8 + d.y, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // Line to the arm.
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x, 280); ctx.quadraticCurveTo(x + 10, 360, 236, 356); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
  void tension;
}

/** The doctor at the foot of the bed with the clipboard. */
function drawDoctor(ctx: CanvasRenderingContext2D, w: Ward): void {
  const lean = clamp(w.doctorLean.x, 0, 1);
  const pen = clamp(w.doctorPen.x, -1, 1);
  ctx.save();
  ctx.translate(520, 470);
  ctx.rotate(-0.12 * lean);
  ctx.lineJoin = 'round';
  // Legs and coat.
  for (const side of [-1, 1]) limb(ctx, { x: side * 12, y: -90 }, { x: side * 14, y: 0 }, 14, '#3d5f8f');
  ctx.fillStyle = '#f4f7fb'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-40, -100); ctx.lineTo(-44, -220); ctx.lineTo(44, -220); ctx.lineTo(40, -100); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28,31,38,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -215); ctx.lineTo(0, -110); ctx.stroke();
  ctx.fillStyle = '#7cf67c'; ctx.beginPath(); ctx.roundRect(-34, -200, 24, 10, 2); ctx.fill();
  // Stethoscope.
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-16, -216); ctx.quadraticCurveTo(-20, -170, 6, -160); ctx.stroke();
  ctx.fillStyle = '#9aa7b5'; ctx.beginPath(); ctx.arc(8, -158, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Arms and the clipboard.
  limb(ctx, { x: -40, y: -205 }, { x: -46, y: -150 }, 14, '#f4f7fb');
  limb(ctx, { x: 40, y: -205 }, { x: 20 + pen * 3, y: -150 }, 14, '#f4f7fb');
  ctx.save();
  ctx.translate(-14, -150); ctx.rotate(-0.25);
  ctx.fillStyle = '#c9a26b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-34, -30, 68, 80, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-29, -22, 58, 66, 2); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-14, -36, 28, 12, 3); ctx.fill();
  ctx.fillStyle = '#e63946'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('CHART', -25, -10);
  ctx.fillStyle = INK; ctx.font = '600 8px system-ui, sans-serif';
  for (let i = 0; i <= Math.min(w.noteIndex, 4); i += 1) {
    const idx = Math.max(0, w.noteIndex - 4) + i;
    ctx.fillStyle = idx >= 5 ? '#e63946' : INK;
    ctx.fillText(`· ${NOTES[idx] ?? ''}`, -25, 2 + i * 9, 54);
  }
  if (w.dead) { ctx.fillStyle = '#e63946'; ctx.font = '900 10px Impact, "Arial Black", sans-serif'; ctx.fillText(`TOD ${(w.deathX100 / 100).toFixed(2)}×`, -25, 42); }
  ctx.restore();
  // Pen hand.
  ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(20 + pen * 3, -150, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#2b2b30'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(18 + pen * 3, -156); ctx.lineTo(4 + pen * 6, -170); ctx.stroke();
  // Head.
  const hy = -246;
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 24, 27, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6b6b70';
  ctx.beginPath(); ctx.moveTo(-25, hy - 6); ctx.quadraticCurveTo(-20, hy - 34, 0, hy - 32); ctx.quadraticCurveTo(22, hy - 34, 25, hy - 6); ctx.quadraticCurveTo(0, hy - 18, -25, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Glasses and a mouth that flattens with the lean.
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.strokeRect(-18, hy - 6, 14, 10); ctx.strokeRect(4, hy - 6, 14, 10);
  ctx.beginPath(); ctx.moveTo(-4, hy - 1); ctx.lineTo(4, hy - 1); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-11, hy - 1, 2, 0, Math.PI * 2); ctx.arc(11, hy - 1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-8, hy + 14); ctx.quadraticCurveTo(0, hy + 14 - 6 * lean, 8, hy + 14); ctx.stroke();
  if (w.dead && w.deadAge > 1.5) {
    ctx.save(); ctx.translate(-70, hy - 50); ctx.rotate(-0.06);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-72, -22, 144, 40, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, 18); ctx.lineTo(44, 30); ctx.lineTo(48, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('time of death', 0, -6);
    ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.fillStyle = '#e63946';
    ctx.fillText(`${(w.deathX100 / 100).toFixed(2)}×`, 0, 11);
    ctx.restore();
  }
  ctx.restore();
}

/** The roommate's bed behind the curtain, and the curtain itself. */
function drawRoommate(ctx: CanvasRenderingContext2D, w: Ward): void {
  const gone = clamp(w.roommateGone.x, 0, 1);
  const curtain = clamp(w.curtain.x, 0, 1);
  ctx.save();
  // Bed, wheeled out to the left when gone.
  ctx.translate(-260 * gone, 0);
  ctx.fillStyle = '#c7d3dd'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(40, 196, 150, 34, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(46, 186, 138, 16, 4); ctx.fill(); ctx.stroke();
  if (gone > 0.05) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(52, 186); ctx.quadraticCurveTo(110, 150, 178, 186); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else {
    // Roommate's head on the pillow.
    ctx.fillStyle = '#e0bda7';
    ctx.beginPath(); ctx.arc(70, 180, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    if (w.roommateFlat) { ctx.beginPath(); ctx.moveTo(64, 177); ctx.lineTo(70, 181); ctx.moveTo(70, 177); ctx.lineTo(64, 181); ctx.moveTo(72, 177); ctx.lineTo(78, 181); ctx.moveTo(78, 177); ctx.lineTo(72, 181); ctx.stroke(); }
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(66, 178, 1.6, 0, Math.PI * 2); ctx.arc(74, 178, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const wx of [58, 176]) { ctx.fillStyle = '#4a5560'; ctx.beginPath(); ctx.arc(wx, 236, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // Small monitor over the roommate that reads a beat, then flat.
  ctx.fillStyle = '#0d1418'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(196, 140, 52, 30, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = w.roommateFlat ? '#ff4d6d' : '#7cf67c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(200, 156);
  for (let i = 0; i <= 44; i += 1) { const ph = ((w.time * 1.2) + i / 44) % 1; const spike = w.roommateFlat ? 0 : ph > 0.45 && ph < 0.55 ? Math.sin((ph - 0.45) * Math.PI * 10) * 8 : 0; ctx.lineTo(200 + i, 156 - spike); }
  ctx.stroke();
  // Curtain rail and curtain, drawn closed with the tension.
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(20, 120); ctx.lineTo(280, 120); ctx.stroke();
  const width = 28 + 232 * curtain;
  ctx.save();
  ctx.translate(20, 122);
  ctx.fillStyle = '#7fb8a4'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 0);
  const folds = 8;
  for (let i = 0; i <= folds; i += 1) { const fx = (width / folds) * i; ctx.lineTo(fx, i % 2 ? 6 : 0); }
  ctx.lineTo(width, 220);
  for (let i = folds; i >= 0; i -= 1) { const fx = (width / folds) * i; ctx.lineTo(fx, 220 + (i % 2 ? 10 : 0)); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28,31,38,0.2)'; ctx.lineWidth = 2;
  for (let i = 1; i < folds; i += 1) { const fx = (width / folds) * i; ctx.beginPath(); ctx.moveTo(fx, 4); ctx.lineTo(fx, 222); ctx.stroke(); }
  ctx.restore();
}

/** The patient in bed with the laptop, or dressing, or walking out. */
function drawPatient(ctx: CanvasRenderingContext2D, w: Ward, tension: number): void {
  const p = w.patient;
  if (p.mode === 'gone') return;
  const inBed = p.mode === 'bed' || p.mode === 'unplugging';
  const suit = clamp(p.suit.x, 0, 1);
  const lean = clamp(w.lean.x, 0, 1.2);
  const twitch = clamp(w.twitch.x, -1, 1.5);
  const shock = clamp(w.shock.x, 0, 1);
  const dead = w.dead;
  ctx.save();
  if (inBed) ctx.translate(300, 380 - lean * 8 + twitch * 3);
  else { ctx.translate(p.x, 470); if (p.mode === 'walking') ctx.translate(0, -Math.abs(Math.sin(w.time * 10)) * 5); }
  ctx.lineJoin = 'round';
  const gown = suit > 0.5 ? '#2b2b30' : '#bfe0ec';
  const skin = '#f3dccb';
  if (inBed) {
    // Legs under the sheet: a lump.
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(60, -40, 180, -10); ctx.lineTo(180, 20); ctx.lineTo(-30, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Torso, leaning toward the laptop.
    ctx.save();
    ctx.rotate(0.18 * lean);
    ctx.fillStyle = gown;
    ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-50, -100, -20, -118); ctx.lineTo(24, -118); ctx.quadraticCurveTo(52, -100, 48, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(28,31,38,0.15)';
    for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.arc(-24 + i * 16, -60 + (i % 2) * 20, 3, 0, Math.PI * 2); ctx.fill(); }
    // Laptop on the lap, lid glow.
    ctx.save();
    ctx.translate(70, -12);
    ctx.fillStyle = '#3a3f4a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-40, -4, 80, 10, 3); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(-0.2);
    ctx.beginPath(); ctx.roundRect(-38, -66, 76, 62, 3); ctx.fill(); ctx.stroke();
    if (!(dead && w.sheet.x > 0.5)) {
      ctx.fillStyle = dead ? '#3a1420' : '#0f1b22';
      ctx.fillRect(-34, -62, 68, 54);
      // The chart on the screen, or the drop.
      ctx.strokeStyle = dead ? '#ff4d6d' : '#7cf67c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-32, -12);
      for (let i = 0; i <= 12; i += 1) { const fx = -32 + i * 5.3; const climb = dead ? (i < 9 ? i * 3.6 : 32 - (i - 9) * 14) : i * (1.4 + 3 * tension) + Math.sin(i * 2.3) * 2; ctx.lineTo(fx, -12 - clamp(climb, -6, 46)); }
      ctx.stroke();
      ctx.fillStyle = dead ? '#ff4d6d' : '#ffffff'; ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(dead ? '$HOPE  -100%' : '$HOPE', -31, -52);
    }
    ctx.restore();
    ctx.restore();
    // Arms: one typing on the laptop, one with the line in it.
    const type = clamp(w.typing.x, 0, 1) * (dead ? 0 : 1);
    const tap = Math.sin(w.time * (10 + 14 * tension)) * 4 * type;
    limb(ctx, { x: 40, y: -90 }, { x: 74, y: -30 + tap }, 15, gown);
    limb(ctx, { x: -40, y: -90 }, { x: -64, y: -24 }, 15, gown);
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(-64, -24, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(74, -30 + tap, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Cannula tape.
    ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.roundRect(-72, -34, 16, 8, 2); ctx.fill(); ctx.stroke();
    if (p.mode === 'unplugging') { const k = smoothstep(0, 0.6, p.modeAge); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(-140 * k - 30, -70 - 20 * k, 72, 22, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('UNPLUGGED', -140 * k + 6, -55 - 20 * k); }
    ctx.restore();
  } else {
    // Standing: legs, the suit, the balloon.
    const stride = p.mode === 'walking' ? w.time * 10 : 0;
    for (const side of [-1, 1]) { const lift = Math.max(0, Math.sin(stride + (side > 0 ? Math.PI : 0))) * 14; limb(ctx, { x: side * 12, y: -90 }, { x: side * 16, y: -lift }, 15, suit > 0.5 ? '#2b2b30' : '#bfe0ec'); }
    ctx.fillStyle = gown; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-44, -90); ctx.quadraticCurveTo(-48, -190, -18, -208); ctx.lineTo(18, -208); ctx.quadraticCurveTo(48, -190, 44, -90); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (suit > 0.5) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-14, -206); ctx.lineTo(0, -150); ctx.lineTo(14, -206); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(-5, -204); ctx.lineTo(5, -204); ctx.lineTo(3, -150); ctx.lineTo(-3, -150); ctx.closePath(); ctx.fill(); }
    limb(ctx, { x: -40, y: -190 }, { x: -52, y: -110 }, 15, gown);
    const balloon = clamp(p.balloon.x, 0, 1);
    limb(ctx, { x: 40, y: -190 }, { x: 60, y: -230 * balloon - 110 * (1 - balloon) }, 15, gown);
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(-52, -110, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(60, -230 * balloon - 110 * (1 - balloon), 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (balloon > 0.05) {
      const by = -230 - 120 * balloon + Math.sin(w.time * 2) * 6;
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(60, -230 * balloon - 110 * (1 - balloon)); ctx.quadraticCurveTo(70, by + 60, 66, by + 40); ctx.stroke();
      ctx.fillStyle = '#7cf67c'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(66, by, 34 * balloon, 42 * balloon, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (balloon > 0.7) memeSmall(ctx, 'GAINS', 66, by + 7, 18, '#ffffff');
    }
  }
  // Head: big pupils that grow with the hopium, sunken with the death.
  const hy = inBed ? -150 - lean * 6 : -236;
  ctx.save();
  if (inBed) ctx.translate(lean * 18, 0);
  ctx.fillStyle = dead ? '#dcd3cf' : skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 36, 40, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b1d14';
  ctx.beginPath(); ctx.moveTo(-38, hy - 4); ctx.quadraticCurveTo(-36, hy - 52, 0, hy - 50); ctx.quadraticCurveTo(38, hy - 52, 38, hy - 4); ctx.quadraticCurveTo(24, hy - 36, 0, hy - 30); ctx.quadraticCurveTo(-24, hy - 36, -38, hy - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (suit > 0.5) { ctx.fillStyle = INK; ctx.fillRect(-26, hy - 10, 20, 9); ctx.fillRect(6, hy - 10, 20, 9); ctx.fillRect(-6, hy - 8, 12, 3); }
  else {
    const open = clamp(w.eyeOpen.x, 0.05, 1.4);
    const pupil = clamp(w.pupil.x, 0, 1);
    for (const ex of [-14, 14]) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(ex, hy - 4, 9, 11 * open, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (dead && w.deadAge > 0.3) { ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(ex - 5, hy - 9); ctx.lineTo(ex + 5, hy + 1); ctx.moveTo(ex + 5, hy - 9); ctx.lineTo(ex - 5, hy + 1); ctx.stroke(); }
      else if (open > 0.3) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + lean * 2, hy - 3, 2.5 + 6 * pupil, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - 2, hy - 6, 1.6, 0, Math.PI * 2); ctx.fill(); }
    }
    // Bags under the eyes with the tension.
    ctx.strokeStyle = `rgba(90, 60, 120, ${0.3 + 0.5 * tension})`; ctx.lineWidth = 2;
    for (const ex of [-14, 14]) { ctx.beginPath(); ctx.moveTo(ex - 7, hy + 8); ctx.quadraticCurveTo(ex, hy + 13 + 3 * tension, ex + 7, hy + 8); ctx.stroke(); }
  }
  // Brows and mouth.
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  const raise = suit > 0.5 ? 4 : 2 + 6 * tension + 6 * shock;
  ctx.beginPath(); ctx.moveTo(-22, hy - 20 - raise * 0.4); ctx.lineTo(-7, hy - 22 - raise); ctx.moveTo(7, hy - 22 - raise); ctx.lineTo(22, hy - 20 - raise * 0.4); ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (dead) { ctx.moveTo(-8, hy + 20); ctx.lineTo(8, hy + 20); }
  else if (suit > 0.5) { ctx.moveTo(-10, hy + 16); ctx.quadraticCurveTo(0, hy + 26, 10, hy + 16); }
  else if (shock > 0.4 || tension > 0.8) { ctx.ellipse(0, hy + 20, 5 + 3 * shock, 7 + 4 * shock, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else { ctx.moveTo(-9, hy + 18); ctx.quadraticCurveTo(0, hy + 18 + 8 * (0.5 - tension), 9, hy + 18); }
  ctx.stroke();
  // Sweat at high tension.
  if (!dead && suit < 0.5 && tension > 0.5) { ctx.fillStyle = '#8fd3ff'; const dy = (w.time * 30) % 24; ctx.beginPath(); ctx.ellipse(34, hy - 20 + dy, 3, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.restore();
}

/** The whole ward, clipped to its frame. */
export function drawWard(ctx: CanvasRenderingContext2D, w: Ward, tension: number, reduced: boolean): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(WARD.x, WARD.y, WARD.w, WARD.h); ctx.clip();
  // Wall, dado rail, floor; the lights flicker at the crash.
  const flicker = w.dead && !reduced && w.deadAge < 1.2 ? (noise(Math.floor(w.time * 24)) > 0.5 ? 1 : 0.7) : 1;
  ctx.fillStyle = `rgb(${Math.round(214 * flicker)}, ${Math.round(232 * flicker)}, ${Math.round(228 * flicker)})`;
  ctx.fillRect(0, 0, WARD.w, WARD.h);
  ctx.fillStyle = `rgb(${Math.round(150 * flicker)}, ${Math.round(196 * flicker)}, ${Math.round(186 * flicker)})`;
  ctx.fillRect(0, 300, WARD.w, 240);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(WARD.w, 300); ctx.stroke();
  ctx.fillStyle = `rgb(${Math.round(196 * flicker)}, ${Math.round(210 * flicker)}, ${Math.round(214 * flicker)})`;
  ctx.fillRect(0, 480, WARD.w, 60);
  ctx.beginPath(); ctx.moveTo(0, 480); ctx.lineTo(WARD.w, 480); ctx.stroke();
  // Ceiling light strip.
  ctx.fillStyle = `rgba(255, 255, 240, ${0.8 * flicker})`;
  ctx.beginPath(); ctx.roundRect(200, 14, 240, 14, 6); ctx.fill(); ctx.stroke();
  // Ward sign and the poster.
  ctx.fillStyle = '#1f6f8b';
  ctx.beginPath(); ctx.roundRect(340, 50, 220, 40, 4); ctx.fill(); ctx.stroke();
  memeSmall(ctx, 'DEGEN GENERAL · WARD 420', 450, 78, 16, '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(360, 110, 120, 90, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946'; ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WASH YOUR', 420, 140); ctx.fillText('HANDS', 420, 158);
  ctx.fillStyle = INK; ctx.font = '700 9px system-ui, sans-serif';
  ctx.fillText('(paper or diamond)', 420, 178);
  // Window with the night outside.
  ctx.fillStyle = '#0f2a3e';
  ctx.beginPath(); ctx.roundRect(500, 110, 120, 130, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(590, 140, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(560, 110); ctx.lineTo(560, 240); ctx.moveTo(500, 175); ctx.lineTo(620, 175); ctx.stroke();
  // Flowers on the sill that wilt.
  const wilt = clamp(w.wilt.x, 0, 1);
  ctx.fillStyle = '#9aa7b5';
  ctx.beginPath(); ctx.roundRect(548, 240, 36, 26, 4); ctx.fill(); ctx.stroke();
  for (const [i, fx] of [556, 566, 576].entries()) {
    const droop = wilt * (0.6 + 0.3 * noise(i * 3));
    ctx.strokeStyle = wilt > 0.6 ? '#7a6a3a' : '#2e8b57'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(fx, 240); ctx.quadraticCurveTo(fx + 8 * droop, 224, fx + 14 * droop, 214 + 22 * droop); ctx.stroke();
    ctx.fillStyle = wilt > 0.6 ? '#a68a5a' : ['#ff5d9e', '#ffe27a', '#8fd3ff'][i]!;
    ctx.beginPath(); ctx.arc(fx + 14 * droop, 212 + 22 * droop, 6 - 2 * wilt, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  }
  for (const p of w.petals) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#c9a26b'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  drawRoommate(ctx, w);
  // The bed.
  ctx.fillStyle = '#c7d3dd'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(220, 390, 290, 70, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a5560';
  ctx.beginPath(); ctx.roundRect(214, 300, 16, 160, 4); ctx.fill(); ctx.stroke();
  for (const wx of [240, 494]) { ctx.beginPath(); ctx.arc(wx, 466, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(232, 330, 60, 40, 8); ctx.fill(); ctx.stroke();
  drawPatient(ctx, w, tension);
  // Blanket over the legs, drawn after the patient.
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  if (w.patient.mode === 'bed' || w.patient.mode === 'unplugging') { ctx.beginPath(); ctx.moveTo(330, 372); ctx.quadraticCurveTo(400, 350, 508, 376); ctx.lineTo(508, 392); ctx.lineTo(330, 392); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // The sheet over the laptop at the end.
  const sheet = clamp(w.sheet.x, 0, 1);
  if (sheet > 0.02) {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(320, 400); ctx.quadraticCurveTo(330, 330 - 40 * sheet, 372, 316 - 30 * sheet); ctx.quadraticCurveTo(410, 300 - 40 * sheet, 430, 340 - 20 * sheet); ctx.lineTo(440, 400); ctx.closePath();
    ctx.globalAlpha = sheet; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawDrip(ctx, w, tension);
  drawDoctor(ctx, w);
  // The lights dim on the death.
  if (w.dead && w.lights > 0) { ctx.fillStyle = `rgba(10, 20, 30, ${w.lights * smoothstep(0.8, 2.2, w.deadAge)})`; ctx.fillRect(0, 0, WARD.w, WARD.h); }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.strokeRect(WARD.x, WARD.y, WARD.w, WARD.h);
}
