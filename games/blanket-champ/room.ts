/**
 * The bedroom: the bed, the duvet and everything on it or near it. Nothing
 * under the duvet is ever drawn; expressive heads and kicking feet frame
 * the blanket's movement. The joke lives in their reactions and in
 * the room reacting to it: the headboard knocking the wall, the lamp
 * wobbling, the glass walking off the nightstand, the cat leaving, the
 * neighbour's fist, the buckling bed legs, the wall TV tuned to DEGEN NEWS
 * with a BREAKING headline for every stage, and finally the arm that flops
 * out with a thumbs-up while the cat comes back holding a tiny NGMI sign.
 */
import { free } from '@crashwif/crash-math';
import { type Spring, clamp, mix, noise, settleSpring, spring, stepSpring } from './motion';
import { drawFeet, drawReaction, drawSleepers, sleeperBob, sleeperFeet, type SleeperPose } from './sleepers';

export const FLOOR_Y = 470;
export const BED = { left: 210, right: 700, top: 362, headX: 214, footX: 690 };
export const INK = '#1c1f26';
/** Where the glass starts on the nightstand, and past where it goes over the edge. */
const GLASS_X = 158;
const GLASS_EDGE = 190;
/** Where the cat sits on the dresser, where it is out of the picture, and how fast it leaves (from 2×). */
const CAT_X = 806;
const CAT_GONE = 1000;
const CAT_SPEED = 140;
/** How long after the finish the cat is back with its sign. */
const CAT_BACK_S = 1.3;
/** The TV on the wall where the poster used to be, and the window (narrowed to leave the wall beside it to the bookie's board). */
export const TV = { x: 18, y: 22, w: 96, h: 86 };
export const WINDOW = { x: 740, y: 60, w: 120, h: 130 };

/** Beats per second of the quilt at `growth` (log2 of the multiplier). */
const tempoAt = (growth: number): number => 0.8 + 2.2 * (1 - Math.exp(-growth / 2));
/** How far the glass walks on one beat. */
const walkPerBeat = (tension: number): number => 1.5 + 3 * tension;
const cracksAt = (multiplier: number): number => clamp((multiplier - 1.5) / 6, 0, 1);

export interface Puff { kind: 'puff' | 'confetti'; x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour: string }

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
  /** The cat is walking back in after the finish, sign up. */
  catBack: boolean;
  catSign: Spring;
  catSignText: string;
  fist: Spring;
  fistSeen: boolean;
  legs: Spring;
  wallCracks: number;
  finished: boolean;
  finishAge: number;
  armOut: Spring;
  thumb: Spring;
  /** The TV's two-line headline, and how far it has slid in (1 in place). */
  headline: [string, string];
  slide: Spring;
  /** 1, or 0 under reduced motion: the champ's tremble near the top. */
  motion: number;
  puffs: Puff[];
  events: { beat: boolean; glassFell: boolean; catLeft: boolean; fist: boolean; catBack: boolean };
}

const noEvents = (): RoomState['events'] => ({ beat: false, glassFell: false, catLeft: false, fist: false, catBack: false });

export function createRoom(motion = 1): RoomState {
  return { time: 0, beatPhase: 0, tempo: 0, tension: 0, lump: spring(0.6), headboard: spring(0), lamp: spring(0), glassX: GLASS_X, glassFallen: false, glassFall: { y: 0, vy: 0, done: false }, catX: CAT_X, catGone: false, catBack: false, catSign: spring(0), catSignText: 'NGMI', fist: spring(0), fistSeen: false, legs: spring(0), wallCracks: 0, finished: false, finishAge: 0, armOut: spring(0), thumb: spring(0), headline: ['TONIGHT:', 'THE MAIN EVENT'], slide: spring(1), motion, puffs: [], events: noEvents() };
}

export function resetRoom(r: RoomState): void {
  r.beatPhase = 0;
  settleSpring(r.lump, 0.6);
  settleSpring(r.headboard, 0);
  settleSpring(r.lamp, 0);
  r.glassX = GLASS_X;
  r.glassFallen = false;
  r.glassFall = { y: 0, vy: 0, done: false };
  r.catX = CAT_X;
  r.catGone = false;
  r.catBack = false;
  settleSpring(r.catSign, 0);
  settleSpring(r.fist, 0);
  r.fistSeen = false;
  settleSpring(r.legs, 0);
  r.wallCracks = 0;
  r.finished = false;
  r.finishAge = 0;
  settleSpring(r.armOut, 0);
  settleSpring(r.thumb, 0);
  r.puffs = [];
}

/** A new headline: it slides in from the right of the screen. Returns whether it changed. */
export function setHeadline(r: RoomState, lines: [string, string]): boolean {
  if (r.headline[0] === lines[0] && r.headline[1] === lines[1]) return false;
  r.headline = lines;
  r.slide.x = 0;
  r.slide.v = 0;
  return true;
}

export function stepRoom(r: RoomState, growth: number, running: boolean, dt: number): void {
  r.time += dt;
  r.events = noEvents();
  const multiplier = Math.pow(2, growth);
  r.tension = clamp(growth / 3.3, 0, 1);
  r.tempo = running && !r.finished ? tempoAt(growth) : 0;
  if (r.tempo > 0) {
    const before = r.beatPhase;
    r.beatPhase += r.tempo * dt;
    if (Math.floor(r.beatPhase) > Math.floor(before)) {
      r.events.beat = true;
      r.headboard.v += 3 + 6 * r.tension;
      r.lamp.v += (Math.floor(r.beatPhase) % 2 ? 1 : -1) * (0.6 + 1.6 * r.tension);
      if (!r.glassFallen) r.glassX += walkPerBeat(r.tension);
      if (multiplier >= 4) r.fist.v += 40;
    }
  }
  // The lump breathes with the beat; after the finish it lies flat.
  const target = r.finished ? 0.08 : running ? 0.55 + (0.45 + 0.4 * r.tension) * (0.5 - 0.5 * Math.cos(r.beatPhase * Math.PI * 2)) : 0.6 + Math.sin(r.time * 1.2) * 0.03;
  stepSpring(r.lump, target, r.finished ? 9 : 30, r.finished ? 0.5 : 0.9, dt);
  stepSpring(r.headboard, 0, 18, 0.35, dt);
  stepSpring(r.lamp, 0, 5, 0.12, dt);
  stepSpring(r.fist, running && multiplier >= 4 ? 12 : 0, 6, 0.6, dt);
  if (!r.fistSeen && r.fist.x > 6) { r.fistSeen = true; r.events.fist = true; }
  stepSpring(r.legs, running && multiplier >= 6 ? 1 : 0, 3, 0.6, dt);
  stepSpring(r.slide, 1, 9, 0.6, dt);
  r.wallCracks = running ? cracksAt(multiplier) : r.wallCracks;
  if (!r.glassFallen && r.glassX > GLASS_EDGE) {
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
    r.catX += CAT_SPEED * dt;
    if (r.catX > CAT_GONE) { r.catGone = true; r.events.catLeft = true; }
  }
  if (r.finished) {
    r.finishAge += dt;
    stepSpring(r.armOut, 1, 6, 0.5, dt);
    stepSpring(r.thumb, r.finishAge > 0.9 ? 1 : 0, 10, 0.4, dt);
    // The cat is back, sign first: from the door if it left, or the sign just goes up where it sat.
    if (r.finishAge > CAT_BACK_S && r.catGone && !r.catBack) { r.catBack = true; r.catGone = false; r.catX = CAT_GONE; r.events.catBack = true; }
    if (r.catBack && r.catX > CAT_X) r.catX = Math.max(CAT_X, r.catX - CAT_SPEED * 1.4 * dt);
  }
  stepSpring(r.catSign, r.finished && r.finishAge > CAT_BACK_S ? 1 : 0, 8, 0.4, dt);
  for (const p of r.puffs) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'puff') { p.r += 14 * dt; p.vy -= 20 * dt; }
    else p.vy += 30 * dt;
  }
  r.puffs = r.puffs.filter((p) => p.age < p.life);
}

/**
 * Puts the props where a round that has reached `multiplier` leaves them, for a round met late: a fresh scene
 * mid-round or after the crash, or a frame after the tab was hidden. The glass and the cat only move on, so a
 * round already drawn keeps what it showed. Nothing fires: no beat, no falling glass, no shake.
 */
export function settleRoom(r: RoomState, multiplier: number, running: boolean): void {
  const ms = Math.log(Math.max(1, multiplier)) / free.GROWTH_RATE_PER_MS;
  // The glass walks a step on each beat: count the beats along the curve, a tenth of a second at a time.
  let beats = 0;
  let x = GLASS_X;
  for (let t = 0; t < ms && x <= GLASS_EDGE; t += 100) {
    const growth = (t * free.GROWTH_RATE_PER_MS) / Math.LN2;
    const before = beats;
    beats += tempoAt(growth) * 0.1;
    if (Math.floor(beats) > Math.floor(before)) x += walkPerBeat(clamp(growth / 3.3, 0, 1));
  }
  if (!r.glassFallen && x > GLASS_EDGE) {
    r.glassFallen = true;
    r.glassFall = { y: 70, vy: 0, done: true };
  } else if (!r.glassFallen) r.glassX = Math.max(r.glassX, x);
  // The cat heads for the door once the number passes 2×.
  const catX = CAT_X + (CAT_SPEED * Math.max(0, ms - Math.log(2) / free.GROWTH_RATE_PER_MS)) / 1000;
  if (catX > CAT_GONE) r.catGone = true;
  else r.catX = Math.max(r.catX, catX);
  r.wallCracks = Math.max(r.wallCracks, cracksAt(multiplier));
  settleSpring(r.fist, running && multiplier >= 4 ? 12 : 0);
  r.fistSeen = running && multiplier >= 4;
  settleSpring(r.legs, running && multiplier >= 6 ? 1 : 0);
  settleSpring(r.slide, 1);
}

/** The champ finishes. `sign` is what the cat's placard says about it. */
export function finishRoom(r: RoomState, quiet: boolean, legendary: boolean, sign: string): void {
  r.finished = true;
  r.finishAge = quiet ? 10 : 0;
  r.tempo = 0;
  r.catSignText = sign;
  if (quiet) {
    settleSpring(r.armOut, 1);
    settleSpring(r.thumb, 1);
    settleSpring(r.lump, 0.08);
    settleSpring(r.catSign, 1);
    r.catGone = false;
    r.catBack = true;
    r.catX = CAT_X;
    return;
  }
  for (let i = 0; i < 12; i += 1) {
    const n = i * 1.7;
    r.puffs.push({ kind: 'puff', x: 450 + (noise(n) - 0.5) * 120, y: 300, vx: (noise(n + 1) - 0.5) * 60, vy: -30 - noise(n + 2) * 40, r: 6 + noise(n + 3) * 8, age: 0, life: 1.2 + noise(n + 4) * 0.6, colour: '#ffffff' });
  }
  if (legendary) {
    for (let i = 0; i < 40; i += 1) {
      const n = i * 2.3;
      r.puffs.push({ kind: 'confetti', x: noise(n) * 960, y: -10, vx: (noise(n + 1) - 0.5) * 40, vy: 60 + noise(n + 2) * 90, r: 2 + noise(n + 3) * 3, age: 0, life: 3 + noise(n + 4) * 2, colour: ['#ff4d6d', '#7cf67c', '#8fd3ff', '#ffe27a'][i % 4]! });
    }
  }
}

/** The wall TV: DEGEN NEWS, an anchor, and the BREAKING lower third with the headline sliding in. It ends above the crowd's signs. */
function drawTV(ctx: CanvasRenderingContext2D, r: RoomState): void {
  const { x, y, w, h } = TV;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.stroke();
  const sx = x + 6;
  const sy = y + 6;
  const sw = w - 12;
  const sh = h - 12;
  ctx.fillStyle = '#243b6b';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.save();
  ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
  // The studio: a desk, an anchor with a tie, a globe, and the channel bug.
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath(); ctx.arc(sx + 66, sy + 20, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(sx + 66, sy + 20, 10, 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(sx + 20, sy + 26, 26, 16, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f3dccb';
  ctx.beginPath(); ctx.ellipse(sx + 33, sy + 17, 9.5, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(sx + 30, sy + 16, 1.4, 0, Math.PI * 2); ctx.arc(sx + 36, sy + 16, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(sx + 30, sy + 22); ctx.lineTo(sx + 36, sy + 22); ctx.stroke();
  ctx.fillStyle = '#5a3a22';
  ctx.beginPath(); ctx.ellipse(sx + 33, sy + 9, 10, 5, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.moveTo(sx + 31, sy + 28); ctx.lineTo(sx + 35, sy + 28); ctx.lineTo(sx + 33, sy + 37); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5b6b8a';
  ctx.fillRect(sx, sy + 34, sw, 5);
  // The channel bug and the BREAKING lower third.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '900 8px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('DEGEN NEWS', sx + 3, sy + 9);
  ctx.fillStyle = Math.floor(r.time * 2) % 2 || r.motion === 0 ? '#e63946' : '#7a1a24';
  ctx.beginPath(); ctx.arc(sx + sw - 7, sy + 6, 2.5, 0, Math.PI * 2); ctx.fill();
  const ly = sy + sh - 36;
  ctx.fillStyle = '#e63946';
  ctx.fillRect(sx, ly, sw, 11);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 9px Impact, "Arial Black", sans-serif';
  ctx.fillText(r.finished ? 'BREAKING' : r.tempo > 0 ? 'LIVE' : 'COMING UP', sx + 4, ly + 9);
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(sx, ly + 11, sw, 25);
  const slide = (1 - clamp(r.slide.x, 0, 1)) * (sw + 10);
  ctx.fillStyle = INK;
  ctx.font = '900 10px Impact, "Arial Black", sans-serif';
  ctx.fillText(r.headline[0], sx + 4 + slide, ly + 21, sw - 8);
  ctx.fillText(r.headline[1], sx + 4 + slide, ly + 32, sw - 8);
  ctx.restore();
  // Screen glare.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw * 0.5, sy); ctx.lineTo(sx, sy + sh * 0.6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawWall(ctx: CanvasRenderingContext2D, r: RoomState): void {
  ctx.fillStyle = '#5b6b8a';
  ctx.fillRect(0, 0, 960, FLOOR_Y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let x = 0; x < 960; x += 48) ctx.fillRect(x, 0, 22, FLOOR_Y);
  // Window with the night outside, and later the fire brigade.
  ctx.fillStyle = '#1b2440';
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i += 1) { ctx.beginPath(); ctx.arc(WINDOW.x + 10 + noise(i) * (WINDOW.w - 20), WINDOW.y + 10 + noise(i * 2.7) * (WINDOW.h - 20), 1.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f7f0d8';
  ctx.beginPath(); ctx.arc(WINDOW.x + 92, 96, 14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(WINDOW.x + WINDOW.w / 2, WINDOW.y); ctx.lineTo(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h); ctx.moveTo(WINDOW.x, 125); ctx.lineTo(WINDOW.x + WINDOW.w, 125); ctx.stroke();
  drawTV(ctx, r);
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

/** The cat on the dresser: leaving tail-first from 2×, back after the finish with a placard held up in one paw. */
function drawCat(ctx: CanvasRenderingContext2D, r: RoomState): void {
  const leaving = !r.catBack && r.catX > CAT_X + 1;
  const walking = leaving || (r.catBack && r.catX > CAT_X + 1);
  const bob = walking ? Math.abs(Math.sin(r.time * 14)) * 3 : 0;
  ctx.save();
  ctx.translate(r.catX, 384 - bob);
  if (leaving) ctx.scale(-1, 1);
  ctx.fillStyle = '#3a3a3a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, -12, 24, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-20, -22, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-28, -28); ctx.lineTo(-26, -40); ctx.lineTo(-19, -30); ctx.moveTo(-14, -30); ctx.lineTo(-11, -40); ctx.lineTo(-8, -29); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, -14); ctx.quadraticCurveTo(44, -20 + Math.sin(r.time * 3) * 8, 40, -40); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.arc(-24, -24, 1.8, 0, Math.PI * 2); ctx.arc(-17, -24, 1.8, 0, Math.PI * 2); ctx.fill();
  const sign = clamp(r.catSign.x, 0, 1.2);
  if (sign > 0.02) {
    // The placard comes up on a stick from behind the head, wobbling with the walk.
    ctx.save();
    ctx.translate(-6, -30);
    ctx.rotate(-0.15 + Math.sin(r.time * 4) * 0.06 - (1 - Math.min(sign, 1)) * 0.8);
    const up = 30 * sign;
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -up); ctx.stroke();
    ctx.fillStyle = '#fbf8f1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-20, -up - 18, 40, 18, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 11px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(r.catSignText, 0, -up - 9, 36);
    ctx.restore();
  }
  ctx.restore();
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
  if (!r.catGone) drawCat(ctx, r);
}

/** Pillows and faces, feet tucked behind the quilt, then the gripping hand and finish. */
export function drawBed(ctx: CanvasRenderingContext2D, r: RoomState): void {
  const legs = clamp(r.legs.x, 0, 1);
  const tilt = legs * 0.05;
  const pose: SleeperPose = {
    time: r.time, beat: r.beatPhase * Math.PI * 2, tension: r.tension,
    lift: clamp(r.lump.x, 0, 1.3) - 0.6,
    active: r.tempo > 0, finished: r.finished, rest: r.finished ? clamp(r.finishAge * 1.8, 0, 1) : 0,
    tremble: r.motion * (r.tempo > 0 ? clamp((r.tension - 0.62) / 0.38, 0, 1) : 0),
  };
  ctx.save();
  ctx.fillStyle = 'rgba(28, 31, 38, 0.18)';
  ctx.beginPath(); ctx.ellipse(467, FLOOR_Y - 1, 263, 17, 0, 0, Math.PI * 2); ctx.fill();
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
  // Connect the headboard grip to the shoulder tucked behind the pillow.
  ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(275, 356); ctx.quadraticCurveTo(237, 334, BED.headX + 9, 282 - knock * 0.5); ctx.stroke();
  ctx.strokeStyle = '#f3dccb'; ctx.lineWidth = 11; ctx.stroke();
  drawSleepers(ctx, pose);
  const feet = sleeperFeet(pose);
  drawFeet(ctx, feet);
  // A shoulder tuck, broad moving quilt and hanging hem connect heads to feet.
  const h = 33 + 66 * clamp(r.lump.x, 0, 1.3);
  const peakX = 440 + pose.lift * 8;
  const champBob = sleeperBob(pose, false);
  const partnerBob = sleeperBob(pose, true);
  const firstTuck = feet[0]!.tuck;
  const lastTuck = feet[feet.length - 1]!.tuck;
  const hemX = Math.max(BED.right - 16, lastTuck.x + 7);
  const quilt = new Path2D();
  quilt.moveTo(BED.left + 12, BED.top + 10);
  quilt.quadraticCurveTo(276, BED.top + 18 + champBob, 305, BED.top - 17 + champBob);
  quilt.quadraticCurveTo(326, BED.top - 12 + partnerBob, 354, BED.top - 41 + partnerBob);
  quilt.bezierCurveTo(383, BED.top - h, peakX - 24, BED.top - h, peakX, BED.top - h);
  quilt.bezierCurveTo(peakX + 51, BED.top - h, 502, BED.top - h * 0.65, 540, BED.top - h * 0.64);
  quilt.bezierCurveTo(584, BED.top - h * 0.82, firstTuck.x - 30, firstTuck.y - 16, firstTuck.x, firstTuck.y);
  // The drape follows each ankle so a kick never leaves a detached foot or exposed leg end.
  let previousTuck = firstTuck;
  for (let i = 1; i < feet.length; i += 1) {
    const tuck = feet[i]!.tuck;
    // A farther ankle is already covered by the drape over the foot in front of it.
    if (tuck.x <= previousTuck.x) continue;
    quilt.bezierCurveTo(mix(previousTuck.x, tuck.x, 0.6), previousTuck.y + 4, tuck.x, tuck.y - 4, tuck.x, tuck.y);
    previousTuck = tuck;
  }
  quilt.quadraticCurveTo(lastTuck.x + 10, lastTuck.y + 15, hemX, BED.top + 25);
  quilt.bezierCurveTo(594, BED.top + 43, 390, BED.top + 45, 278, BED.top + 29);
  quilt.quadraticCurveTo(244, BED.top + 28, BED.left + 12, BED.top + 10);
  quilt.closePath();
  const fabric = ctx.createLinearGradient(0, BED.top - h, 0, BED.top + 43);
  fabric.addColorStop(0, '#aebfe8'); fabric.addColorStop(0.55, '#819bd0'); fabric.addColorStop(1, '#536fab');
  ctx.fillStyle = fabric; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.fill(quilt); ctx.stroke(quilt);
  ctx.save(); ctx.clip(quilt);
  // Quilting follows the volume; a bright turned-over edge identifies the opening.
  ctx.strokeStyle = 'rgba(38, 57, 102, 0.3)'; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    const fx = 312 + i * 48;
    ctx.beginPath(); ctx.moveTo(fx, BED.top + 39);
    ctx.bezierCurveTo(fx + 25, BED.top + 2, fx - 24, BED.top - h * 0.65, fx + 12, BED.top - h - 8); ctx.stroke();
  }
  for (const offset of [0, 25, 50]) {
    ctx.beginPath(); ctx.moveTo(282, BED.top - 13 + offset);
    ctx.bezierCurveTo(394, BED.top - h * 0.7 + offset, 529, BED.top - h * 0.55 + offset, hemX, BED.top - 12 + offset); ctx.stroke();
  }
  ctx.strokeStyle = '#dae4fb'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(223, BED.top + 10);
  ctx.quadraticCurveTo(276, BED.top + 18 + champBob, 305, BED.top - 17 + champBob);
  ctx.quadraticCurveTo(326, BED.top - 12 + partnerBob, 354, BED.top - 41 + partnerBob); ctx.stroke();
  ctx.strokeStyle = 'rgba(231, 239, 255, 0.65)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(285, BED.top + 23);
  ctx.bezierCurveTo(390, BED.top + 39, 595, BED.top + 37, hemX - 7, BED.top + 21); ctx.stroke();
  ctx.restore();
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
  drawReaction(ctx, pose);
  ctx.restore();
  for (const p of r.puffs) {
    ctx.globalAlpha = (1 - p.age / p.life) * (p.kind === 'puff' ? 0.6 : 1);
    ctx.fillStyle = p.colour;
    if (p.kind === 'confetti') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.age * 3 + p.vx);
      ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore();
    } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
