/**
 * The bedroom: the bed, the duvet and everything on it or near it. Nothing
 * under the duvet is ever drawn; the joke lives in the lump's tempo and in
 * the room reacting to it: the headboard knocking the wall, the lamp
 * wobbling, the glass walking off the nightstand, the cat leaving, the
 * neighbour's fist, the buckling bed legs, and finally the arm that flops
 * out with a thumbs-up.
 */
import { type Spring, clamp, mix, noise, settleSpring, spring, stepSpring } from './motion';

export const FLOOR_Y = 470;
export const BED = { left: 210, right: 700, top: 362, headX: 214, footX: 690 };
export const INK = '#1c1f26';

export interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour: string }

export interface RoomState {
  time: number;
  beatPhase: number;
  tempo: number;
  tension: number;
  lump: Spring;
  headboard: Spring;
  lamp: Spring;
  glassX: number;
  glassFallen: boolean;
  glassFall: { y: number; vy: number; done: boolean };
  catX: number;
  catGone: boolean;
  fist: Spring;
  legs: Spring;
  wallCracks: number;
  finished: boolean;
  finishAge: number;
  armOut: Spring;
  thumb: Spring;
  puffs: Puff[];
  events: { beat: boolean; glassFell: boolean; catLeft: boolean; fist: boolean };
}

export function createRoom(): RoomState {
  return { time: 0, beatPhase: 0, tempo: 0, tension: 0, lump: spring(0.6), headboard: spring(0), lamp: spring(0), glassX: 158, glassFallen: false, glassFall: { y: 0, vy: 0, done: false }, catX: 806, catGone: false, fist: spring(0), legs: spring(0), wallCracks: 0, finished: false, finishAge: 0, armOut: spring(0), thumb: spring(0), puffs: [], events: { beat: false, glassFell: false, catLeft: false, fist: false } };
}

export function resetRoom(r: RoomState): void {
  r.beatPhase = 0;
  settleSpring(r.lump, 0.6);
  settleSpring(r.headboard, 0);
  settleSpring(r.lamp, 0);
  r.glassX = 158;
  r.glassFallen = false;
  r.glassFall = { y: 0, vy: 0, done: false };
  r.catX = 806;
  r.catGone = false;
  settleSpring(r.fist, 0);
  settleSpring(r.legs, 0);
  r.wallCracks = 0;
  r.finished = false;
  r.finishAge = 0;
  settleSpring(r.armOut, 0);
  settleSpring(r.thumb, 0);
  r.puffs = [];
}

export function stepRoom(r: RoomState, growth: number, running: boolean, dt: number): void {
  r.time += dt;
  r.events = { beat: false, glassFell: false, catLeft: false, fist: false };
  const multiplier = Math.pow(2, growth);
  r.tension = clamp(growth / 3.3, 0, 1);
  r.tempo = running && !r.finished ? 0.8 + 2.2 * (1 - Math.exp(-growth / 2)) : 0;
  if (r.tempo > 0) {
    const before = r.beatPhase;
    r.beatPhase += r.tempo * dt;
    if (Math.floor(r.beatPhase) > Math.floor(before)) {
      r.events.beat = true;
      r.headboard.v += 3 + 6 * r.tension;
      r.lamp.v += (Math.floor(r.beatPhase) % 2 ? 1 : -1) * (0.6 + 1.6 * r.tension);
      if (!r.glassFallen) r.glassX += 1.5 + 3 * r.tension;
      if (multiplier >= 4) r.fist.v += 40;
    }
  }
  // The lump breathes with the beat; after the finish it lies flat.
  const target = r.finished ? 0.08 : running ? 0.55 + (0.45 + 0.4 * r.tension) * (0.5 - 0.5 * Math.cos(r.beatPhase * Math.PI * 2)) : 0.6 + Math.sin(r.time * 1.2) * 0.03;
  stepSpring(r.lump, target, r.finished ? 9 : 30, r.finished ? 0.5 : 0.9, dt);
  stepSpring(r.headboard, 0, 18, 0.35, dt);
  stepSpring(r.lamp, 0, 5, 0.12, dt);
  stepSpring(r.fist, running && multiplier >= 4 ? 12 : 0, 6, 0.6, dt);
  stepSpring(r.legs, running && multiplier >= 6 ? 1 : 0, 3, 0.6, dt);
  r.wallCracks = running ? clamp((multiplier - 1.5) / 6, 0, 1) : r.wallCracks;
  if (!r.glassFallen && r.glassX > 190) {
    r.glassFallen = true;
    r.events.glassFell = true;
    r.glassFall = { y: 0, vy: 0, done: false };
  }
  if (r.glassFallen && !r.glassFall.done) {
    r.glassFall.vy += 900 * dt;
    r.glassFall.y += r.glassFall.vy * dt;
    if (r.glassFall.y > 70) { r.glassFall.y = 70; r.glassFall.done = true; }
  }
  if (running && multiplier >= 2 && !r.catGone) {
    r.catX += 140 * dt;
    if (r.catX > 1000) { r.catGone = true; r.events.catLeft = true; }
  }
  if (r.finished) {
    r.finishAge += dt;
    stepSpring(r.armOut, 1, 6, 0.5, dt);
    stepSpring(r.thumb, r.finishAge > 0.9 ? 1 : 0, 10, 0.4, dt);
  }
  for (const p of r.puffs) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 14 * dt; p.vy -= 20 * dt; }
  r.puffs = r.puffs.filter((p) => p.age < p.life);
}

/** The champ finishes. */
export function finishRoom(r: RoomState, quiet: boolean, legendary: boolean): void {
  r.finished = true;
  r.finishAge = quiet ? 10 : 0;
  r.tempo = 0;
  if (quiet) { settleSpring(r.armOut, 1); settleSpring(r.thumb, 1); settleSpring(r.lump, 0.08); return; }
  for (let i = 0; i < 12; i += 1) {
    const n = i * 1.7;
    r.puffs.push({ x: 450 + (noise(n) - 0.5) * 120, y: 300, vx: (noise(n + 1) - 0.5) * 60, vy: -30 - noise(n + 2) * 40, r: 6 + noise(n + 3) * 8, age: 0, life: 1.2 + noise(n + 4) * 0.6, colour: '#ffffff' });
  }
  if (legendary) {
    for (let i = 0; i < 60; i += 1) {
      const n = i * 2.3;
      r.puffs.push({ x: noise(n) * 960, y: -10, vx: (noise(n + 1) - 0.5) * 40, vy: 60 + noise(n + 2) * 90, r: 2 + noise(n + 3) * 3, age: 0, life: 3 + noise(n + 4) * 2, colour: ['#ff4d6d', '#7cf67c', '#8fd3ff', '#ffe27a'][i % 4]! });
    }
  }
}

export function drawWall(ctx: CanvasRenderingContext2D, r: RoomState): void {
  ctx.fillStyle = '#5b6b8a';
  ctx.fillRect(0, 0, 960, FLOOR_Y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let x = 0; x < 960; x += 48) ctx.fillRect(x, 0, 22, FLOOR_Y);
  // Window with the night outside, and later the fire brigade.
  ctx.fillStyle = '#1b2440';
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(740, 60, 150, 130, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i += 1) { ctx.beginPath(); ctx.arc(752 + noise(i) * 126, 70 + noise(i * 2.7) * 110, 1.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f7f0d8';
  ctx.beginPath(); ctx.arc(850, 96, 16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(815, 60); ctx.lineTo(815, 190); ctx.moveTo(740, 125); ctx.lineTo(890, 125); ctx.stroke();
  // Poster.
  ctx.fillStyle = '#14213d';
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(18, 28, 96, 124, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.font = '900 15px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TO THE', 66, 54);
  ctx.fillText('MOON', 66, 72);
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.moveTo(66, 82); ctx.lineTo(80, 118); ctx.lineTo(66, 136); ctx.lineTo(52, 118); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffb703';
  ctx.beginPath(); ctx.moveTo(58, 136); ctx.lineTo(66, 148); ctx.lineTo(74, 136); ctx.closePath(); ctx.fill();
  // Cracks spreading from the headboard.
  if (r.wallCracks > 0.02) {
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.7)';
    ctx.lineWidth = 2;
    const n = Math.floor(r.wallCracks * 6);
    for (let i = 0; i < n; i += 1) {
      ctx.beginPath();
      let x = BED.headX + 6;
      let y = 300 - i * 12;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s += 1) { x -= 12 + noise(i * 7 + s) * 16; y -= 6 + (noise(i * 3 + s) - 0.3) * 24; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  // The neighbour's fist through the wall.
  const fist = clamp(r.fist.x, 0, 20);
  if (fist > 0.5) {
    ctx.save();
    ctx.translate(560, 96);
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(-4, -26); ctx.lineTo(14, -14); ctx.lineTo(30, -24); ctx.lineTo(34, 8); ctx.lineTo(18, 26); ctx.lineTo(-6, 22); ctx.lineTo(-20, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-10, -18 + fist * 0.4, 36 + fist * 1.2, 36, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(40 + fist * 1.2, -46, 130, 34, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 14px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KEEP IT DOWN!', 105 + fist * 1.2, -24);
    ctx.restore();
  }
}

export function drawFloorAndFurniture(ctx: CanvasRenderingContext2D, r: RoomState): void {
  ctx.fillStyle = '#8b6b4a';
  ctx.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);
  ctx.strokeStyle = 'rgba(60, 40, 25, 0.4)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 960; x += 80) { ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x, 540); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(960, FLOOR_Y); ctx.stroke();
  // Nightstand, lamp on a wobble, the walking glass.
  ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(108, 398, 84, FLOOR_Y - 398, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6a44';
  ctx.beginPath(); ctx.roundRect(116, 410, 68, 22, 2); ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.translate(140, 398);
  ctx.rotate(clamp(r.lamp.x, -0.6, 0.6) * 0.15);
  ctx.fillStyle = '#c9a44a';
  ctx.beginPath(); ctx.roundRect(-4, -46, 8, 46, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath(); ctx.moveTo(-26, -46); ctx.lineTo(-16, -80); ctx.lineTo(16, -80); ctx.lineTo(26, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (!r.glassFallen || !r.glassFall.done) {
    const gx = r.glassFallen ? 196 + r.glassFall.y * 0.3 : r.glassX;
    const gy = 398 + (r.glassFallen ? r.glassFall.y : 0);
    ctx.save();
    ctx.translate(gx, gy);
    if (r.glassFallen) ctx.rotate(r.glassFall.y * 0.03);
    ctx.fillStyle = 'rgba(200, 230, 255, 0.7)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-7, -22, 14, 22, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(120, 190, 255, 0.8)';
    ctx.fillRect(-6, -12 + Math.sin(r.time * 12) * 1.5 * r.tension, 12, 11);
    ctx.restore();
  } else {
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.9)'; ctx.lineWidth = 2;
    for (const [dx, dy] of [[0, 0], [10, 3], [-8, 5], [16, -2]] as const) { ctx.beginPath(); ctx.moveTo(210 + dx, FLOOR_Y - 2 + dy); ctx.lineTo(216 + dx, FLOOR_Y - 8 + dy); ctx.lineTo(220 + dx, FLOOR_Y - 1 + dy); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120, 190, 255, 0.5)';
    ctx.beginPath(); ctx.ellipse(214, FLOOR_Y - 1, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Dresser and the cat.
  ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(730, 384, 160, FLOOR_Y - 384, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6a44';
  for (const y of [396, 424]) { ctx.beginPath(); ctx.roundRect(742, y, 136, 20, 2); ctx.fill(); ctx.stroke(); }
  if (!r.catGone) {
    ctx.save();
    ctx.translate(r.catX, 384);
    ctx.fillStyle = '#3a3a3a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, -12, 24, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-20, -22, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28, -28); ctx.lineTo(-26, -40); ctx.lineTo(-19, -30); ctx.moveTo(-14, -30); ctx.lineTo(-11, -40); ctx.lineTo(-8, -29); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, -14); ctx.quadraticCurveTo(44, -20 + Math.sin(r.time * 3) * 8, 40, -40); ctx.stroke();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.arc(-24, -24, 1.8, 0, Math.PI * 2); ctx.arc(-17, -24, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** The bed frame, the duvet lump, the feet, the hand on the headboard, and the arm out at the finish. */
export function drawBed(ctx: CanvasRenderingContext2D, r: RoomState): void {
  const legs = clamp(r.legs.x, 0, 1);
  const tilt = legs * 0.05;
  ctx.save();
  ctx.translate(BED.footX, FLOOR_Y);
  ctx.rotate(-tilt);
  ctx.translate(-BED.footX, -FLOOR_Y);
  ctx.lineJoin = 'round';
  // Frame and legs (the head end buckles).
  ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(BED.left - 6, BED.top + 26, BED.right - BED.left + 12, 30, 4); ctx.fill(); ctx.stroke();
  for (const lx of [BED.left + 8, BED.right - 14]) {
    ctx.save();
    if (lx < 400) { ctx.translate(lx + 6, BED.top + 56); ctx.rotate(-legs * 0.5); ctx.translate(-(lx + 6), -(BED.top + 56)); }
    ctx.beginPath(); ctx.roundRect(lx, BED.top + 54, 12, FLOOR_Y - BED.top - 54, 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Headboard knocks the wall.
  const knock = clamp(r.headboard.x, -1, 8);
  ctx.save();
  ctx.translate(BED.headX, FLOOR_Y);
  ctx.rotate(-knock * 0.02);
  ctx.translate(-BED.headX, -FLOOR_Y);
  ctx.fillStyle = '#7a5230';
  ctx.beginPath(); ctx.roundRect(BED.headX - 12, 262, 22, BED.top + 30 - 262, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6a44';
  for (const y of [280, 306, 332]) { ctx.beginPath(); ctx.roundRect(BED.headX - 8, y, 14, 16, 2); ctx.fill(); }
  ctx.restore();
  // Mattress and sheet.
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath(); ctx.roundRect(BED.left, BED.top, BED.right - BED.left, 30, 6); ctx.fill(); ctx.stroke();
  // The duvet: a lump whose top follows the beat, with folds that shift.
  const h = 40 + 90 * clamp(r.lump.x, 0, 1.3);
  const peakX = 440 + Math.sin(r.beatPhase * Math.PI * 2) * 6;
  ctx.fillStyle = '#7b9acc';
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(BED.left + 10, BED.top + 4);
  ctx.bezierCurveTo(300, BED.top - h * 0.55, peakX - 70, BED.top - h, peakX, BED.top - h);
  ctx.bezierCurveTo(peakX + 90, BED.top - h, 600, BED.top - h * 0.5, 650, BED.top - 20);
  ctx.lineTo(BED.right - 8, BED.top + 4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const fx = 300 + i * 70 + Math.sin(r.beatPhase * Math.PI * 2 + i) * 6;
    ctx.beginPath();
    ctx.moveTo(fx, BED.top + 2);
    ctx.quadraticCurveTo(fx + 12, BED.top - h * 0.5 * (0.6 + 0.4 * noise(i)), fx + 30 + Math.sin(r.time * 2 + i) * 4, BED.top - h * (0.55 + 0.35 * noise(i * 2)));
    ctx.stroke();
  }
  // Feet at the foot of the bed: socks and bare toes, bouncing with the beat.
  const bounce = Math.max(0, Math.sin(r.beatPhase * Math.PI * 2)) * 6 * (r.tempo > 0 ? 1 : 0);
  ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  for (const [fx, fy] of [[650, BED.top - 16 - bounce], [668, BED.top - 12 - bounce * 0.7]] as const) {
    ctx.beginPath(); ctx.ellipse(fx, fy, 9, 14, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let t = 0; t < 3; t += 1) { ctx.beginPath(); ctx.arc(fx - 6 + t * 5, fy - 13, 2.2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = '#e63946';
  for (const [fx, fy] of [[628, BED.top - 26 - bounce * 0.5], [640, BED.top - 30 - bounce * 0.4]] as const) {
    ctx.beginPath(); ctx.ellipse(fx, fy, 8, 13, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fx - 6, fy - 4, 12, 3);
    ctx.fillStyle = '#e63946';
  }
  // The champ's hand gripping the headboard: knuckles go white with the tension.
  const grip = mix(0.15, 1, r.tension);
  const hx = BED.headX + 4;
  const hy = 268 - knock * 0.5;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.fillStyle = `rgb(${Math.round(mix(243, 255, grip))}, ${Math.round(mix(220, 245, grip))}, ${Math.round(mix(203, 238, grip))})`;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-8, -2, 30, 22, 6); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.roundRect(-4 + i * 7, -10 - grip * 2, 6, 12, 3); ctx.fill(); ctx.stroke(); }
  if (r.tension > 0.3 && !r.finished) {
    const p = (r.time / 1.2) % 1;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(26, 6 + p * 20, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // At the finish an arm flops over the side and, after a beat, gives a thumbs-up.
  const arm = clamp(r.armOut.x, 0, 1.1);
  if (arm > 0.02) {
    const thumb = clamp(r.thumb.x, 0, 1.1);
    ctx.strokeStyle = INK; ctx.lineWidth = 17; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(470, BED.top - 6); ctx.quadraticCurveTo(500, BED.top + 10 + arm * 30, 520 + arm * 10, BED.top + 40 + arm * 40 - thumb * 60); ctx.stroke();
    ctx.strokeStyle = '#f3dccb'; ctx.lineWidth = 12; ctx.stroke();
    ctx.save();
    ctx.translate(520 + arm * 10, BED.top + 40 + arm * 40 - thumb * 60);
    ctx.rotate(-thumb * 1.4);
    ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-9, -8, 20, 20, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-3, -22, 8, 16, 4); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  for (const p of r.puffs) {
    ctx.globalAlpha = (1 - p.age / p.life) * (p.colour === '#ffffff' ? 0.6 : 1);
    ctx.fillStyle = p.colour;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
