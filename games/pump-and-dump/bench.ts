/**
 * The bench, seen from the feet: the lifter's face between his arms, the
 * bar across the frame with the plates edge-on at both ends, the rack, and
 * the spotter standing behind his head on his phone. Reps cycle with the
 * multiplier, plates arrive from the edge of the frame at milestones, the
 * bar bends and shakes, the face reddens and grits. An accepted exit racks
 * the bar and sits him up to flex; the spotter takes the bench. The crash
 * drops the bar on whoever is under it and sends the plates rolling.
 */
import { type Spring, clamp, fract, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, type Point, SKIN } from './gym';

export const BAR = { left: 196, right: 764, top: 296, chest: 404, rack: 282, sleeve: 300 } as const;
const UPRIGHT = { left: 296, right: 664, base: 398, top: 234 } as const;
const HEAD: Point = { x: 480, y: 372 };
const PLATE_COLOURS = ['#e63946', '#3b82f6', '#ffd60a', '#2e8b57', '#f8f8f8', '#e63946', '#3b82f6', '#ffd60a'];
/** Displayed multipliers at which the next pair of plates goes on. */
export const PLATE_AT = [1.3, 1.7, 2.2, 3, 4, 5.5, 7.5, 10];
const FLOOR = 522;

export type Who = 'chad' | 'bro';
export type Mode = 'idle' | 'lifting' | 'racking' | 'sitting' | 'swap';

interface Plate { side: -1 | 1; index: number; x: number; y: number; vx: number; vy: number; spin: number; angle: number; loose: boolean; gone: boolean }

export interface Bench {
  time: number;
  mode: Mode;
  modeAge: number;
  onBench: Who;
  /** Rep position in cycles. */
  phase: number;
  barY: Spring;
  plates: Plate[];
  arrival: { side: -1 | 1; index: number; age: number } | null;
  nextPlate: number;
  tension: number;
  dumped: boolean;
  dumpAge: number;
  hands: Spring;
  shades: Spring;
  spotHands: Spring;
  chadX: Spring;
  grunt: Spring;
  events: { rep: boolean; plate: boolean; racked: boolean; swapped: boolean };
}

export function createBench(): Bench {
  return { time: 0, mode: 'idle', modeAge: 0, onBench: 'chad', phase: 0, barY: spring(BAR.rack), plates: [], arrival: null, nextPlate: 0, tension: 0, dumped: false, dumpAge: 0, hands: spring(1), shades: spring(0), spotHands: spring(0), chadX: spring(480), grunt: spring(0), events: { rep: false, plate: false, racked: false, swapped: false } };
}

export function resetBench(b: Bench): void {
  b.mode = 'idle';
  b.modeAge = 0;
  b.onBench = 'chad';
  b.phase = 0;
  settleSpring(b.barY, BAR.rack);
  b.plates = [];
  b.arrival = null;
  b.nextPlate = 0;
  b.dumped = false;
  b.dumpAge = 0;
  settleSpring(b.hands, 1);
  settleSpring(b.shades, 0);
  settleSpring(b.spotHands, 0);
  settleSpring(b.chadX, 480);
  settleSpring(b.grunt, 0);
}

function addPlates(b: Bench, index: number, quiet: boolean): void {
  for (const side of [-1, 1] as const) b.plates.push({ side, index, x: plateX(side, index), y: 0, vx: 0, vy: 0, spin: 0, angle: 0, loose: false, gone: false });
  b.nextPlate = index + 1;
  if (!quiet) b.arrival = { side: index % 2 ? 1 : -1, index, age: 0 };
}

const plateX = (side: -1 | 1, index: number): number => (side < 0 ? BAR.sleeve - 12 - index * 13 : BAR.right - (BAR.sleeve - BAR.left) + 12 + index * 13);

/** Jumps straight to the state a multiplier calls for, for a first frame mid-round. */
export function settleBench(b: Bench, multiplier: number): void {
  b.mode = 'lifting';
  settleSpring(b.barY, BAR.top);
  while (b.nextPlate < PLATE_AT.length && multiplier >= PLATE_AT[b.nextPlate]!) addPlates(b, b.nextPlate, true);
  b.arrival = null;
}

/** The exit was accepted: rack it, sit up, hand the bench over. */
export function rackBar(b: Bench): void {
  if (b.mode === 'lifting' && b.onBench === 'chad') { b.mode = 'racking'; b.modeAge = 0; }
}

/** The bar comes down. `quiet` skips the effects for a crash that already happened. */
export function dumpBar(b: Bench, seed: number, quiet: boolean): void {
  if (b.dumped) return;
  if (b.mode !== 'lifting') {
    // Caught between poses: jump to whoever would be under the bar so there is someone to drop it on.
    const wasIdle = b.mode === 'idle';
    b.onBench = wasIdle ? 'chad' : 'bro';
    b.mode = 'lifting';
    b.modeAge = 0;
    if (!wasIdle) { settleSpring(b.chadX, 790); settleSpring(b.barY, BAR.chest); }
  }
  b.dumped = true;
  b.dumpAge = quiet ? 10 : 0;
  b.arrival = null;
  settleSpring(b.spotHands, 0);
  const rng = mulberry32(seed);
  for (const p of b.plates) {
    p.loose = true;
    p.vx = p.side * (160 + rng() * 260);
    p.vy = -80 - rng() * 220;
    p.spin = p.side * (4 + rng() * 6);
    if (quiet) p.gone = true;
  }
  if (quiet) { settleSpring(b.barY, BAR.chest + 34); settleSpring(b.hands, 0); }
  else b.barY.v += 500;
}

export interface BenchDrive { running: boolean; multiplier: number; growth: number; tension: number }

export function stepBench(b: Bench, drive: BenchDrive, dt: number): void {
  b.time += dt;
  b.modeAge += dt;
  b.tension = drive.tension;
  b.events = { rep: false, plate: false, racked: false, swapped: false };
  if (b.mode === 'idle' && drive.running) { b.mode = 'lifting'; b.modeAge = 0; b.phase = 0; }
  if (b.mode === 'racking' && b.modeAge > 0.7) { b.mode = 'sitting'; b.modeAge = 0; b.events.racked = true; }
  if (b.mode === 'sitting' && b.modeAge > 2.2) { b.mode = 'swap'; b.modeAge = 0; b.onBench = 'bro'; b.events.swapped = true; }
  if (b.mode === 'swap' && b.modeAge > 0.5) { b.mode = 'lifting'; b.modeAge = 0; }
  const lifting = b.mode === 'lifting' && !b.dumped;
  if (lifting && drive.running) {
    const before = b.phase;
    const rate = 0.45 + 0.65 * (1 - Math.exp(-drive.growth / 2.2));
    b.phase += rate * dt;
    if (fract(before) < 0.5 && (fract(b.phase) >= 0.5 || Math.floor(b.phase) > Math.floor(before))) { b.events.rep = true; b.grunt.v += 8; }
    if (b.nextPlate < PLATE_AT.length && drive.multiplier >= PLATE_AT[b.nextPlate]! && !b.arrival) { addPlates(b, b.nextPlate, false); b.events.plate = true; }
  }
  if (b.arrival) { b.arrival.age += dt; if (b.arrival.age > 1) b.arrival = null; }
  // Where the bar wants to be.
  const repY = mix(BAR.top, BAR.chest, 0.5 - 0.5 * Math.cos(b.phase * Math.PI * 2));
  const target = b.dumped ? BAR.chest + 34 : b.mode === 'idle' || b.mode === 'sitting' || (b.mode === 'racking' && b.modeAge > 0.3) ? BAR.rack : b.mode === 'swap' ? BAR.top : b.mode === 'racking' ? BAR.top : repY;
  stepSpring(b.barY, target, b.dumped ? 9 : b.mode === 'lifting' ? 26 : 8, b.dumped ? 0.3 : 0.9, dt);
  stepSpring(b.hands, b.dumped && b.dumpAge > 0.25 ? 0 : 1, 10, 0.7, dt);
  stepSpring(b.shades, b.mode === 'sitting' || b.mode === 'swap' || (b.mode === 'lifting' && b.onBench === 'bro') ? 1 : 0, 12, 0.5, dt);
  stepSpring(b.spotHands, !b.dumped && b.onBench === 'chad' && (b.mode === 'racking' || (b.mode === 'lifting' && drive.tension > 0.55)) ? 1 : 0, 6, 0.8, dt);
  stepSpring(b.chadX, b.mode === 'swap' || (b.mode === 'lifting' && b.onBench === 'bro') ? 790 : 480, 5, 0.9, dt);
  stepSpring(b.grunt, 0, 10, 0.5, dt);
  if (b.dumped) {
    b.dumpAge += dt;
    for (const p of b.plates) {
      if (!p.loose || p.gone) continue;
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      const floorAt = FLOOR - 44;
      if (p.y > floorAt - BAR.chest - 34 && p.vy > 0) { p.y = floorAt - BAR.chest - 34; p.vy *= -0.35; p.vx *= 0.9; p.spin *= 0.8; }
      if (p.x < -80 || p.x > 1040) p.gone = true;
    }
  }
}

/** Bar height at a given x along the bent bar. */
function barAt(b: Bench, x: number): number {
  const plates = b.plates.filter((p) => !p.loose).length / 2;
  const sag = (2 + 3 * plates) * (b.mode === 'idle' || b.mode === 'sitting' ? 0.3 : 1);
  const t = (x - BAR.left) / (BAR.right - BAR.left);
  const bend = sag * (4 * (t - 0.5) * (t - 0.5));
  const lifting = b.mode === 'lifting' && !b.dumped;
  const tremor = lifting ? Math.sin(b.time * 31) * (0.4 + 5 * b.tension * b.tension) : 0;
  const tilt = lifting ? Math.sin(b.time * 9.7) * 9 * b.tension * (t - 0.5) * 2 : 0;
  return b.barY.x + bend + tremor + tilt;
}

function limb(ctx: CanvasRenderingContext2D, a: Point, bpt: Point, width: number, colour: string): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width + 5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bpt.x, bpt.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
}

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + dx / distance * along - dy / distance * bend, y: root.y + dy / distance * along + dx / distance * bend };
}

function skinFor(who: Who, tension: number): string {
  const t = clamp(tension, 0, 1);
  const r = Math.round(mix(243, 226, t));
  const g = Math.round(mix(220, 92, t));
  const bl = Math.round(mix(203, 84, t));
  return who === 'chad' ? `rgb(${r}, ${g}, ${bl})` : `rgb(${Math.round(mix(224, 226, t))}, ${Math.round(mix(189, 100, t))}, ${Math.round(mix(167, 90, t))})`;
}

/** The face of whoever is on the bench, looking up at the bar. */
function drawLyingFace(ctx: CanvasRenderingContext2D, b: Bench, who: Who, tension: number, ko: boolean): void {
  const t = clamp(tension, 0, 1);
  ctx.save();
  ctx.translate(HEAD.x, HEAD.y);
  ctx.lineJoin = 'round';
  const skin = skinFor(who, ko ? 0.1 : t);
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  if (who === 'chad') {
    ctx.beginPath(); ctx.moveTo(-30, -10); ctx.quadraticCurveTo(-32, -34, 0, -34); ctx.quadraticCurveTo(32, -34, 30, -10); ctx.lineTo(28, 20); ctx.quadraticCurveTo(26, 34, 0, 36); ctx.quadraticCurveTo(-26, 34, -28, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(28, 31, 38, 0.3)';
    ctx.beginPath(); ctx.moveTo(-26, 16); ctx.quadraticCurveTo(-24, 32, 0, 34); ctx.quadraticCurveTo(24, 32, 26, 16); ctx.lineTo(24, 10); ctx.quadraticCurveTo(0, 22, -24, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.ellipse(0, -28, 30, 10, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.arc(0, -16, 27, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-29, -20, 58, 8, 3); ctx.fill(); ctx.stroke();
  }
  // Veins at the temples.
  const veins = ko ? 0 : t > 0.8 ? 3 : t > 0.55 ? 2 : t > 0.3 ? 1 : 0;
  ctx.strokeStyle = 'rgba(120, 40, 160, 0.8)'; ctx.lineWidth = 2;
  for (let i = 0; i < veins; i += 1) {
    const sx = i === 0 ? -22 : i === 1 ? 22 : -8;
    const sy = i === 2 ? -26 : -14;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 3, sy - 6); ctx.lineTo(sx - 1, sy - 11); ctx.lineTo(sx + 3, sy - 16); ctx.stroke();
  }
  // Eyes bulge with the load; X eyes when out.
  const eyeOpen = ko ? 1 : 1 + 0.6 * t;
  for (const ex of [-11, 11]) {
    if (ko) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ex - 5, -14); ctx.lineTo(ex + 5, -4); ctx.moveTo(ex + 5, -14); ctx.lineTo(ex - 5, -4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(ex, -9, 6, 6 * eyeOpen, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = who === 'chad' ? INK : '#3b82f6';
      ctx.beginPath(); ctx.arc(ex, -12 + 2 * t, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Brows knit hard on a chad, lift on a bro.
  const brow = who === 'chad' ? 0.5 + 0.5 * t : t - 0.3;
  ctx.strokeStyle = INK; ctx.lineWidth = who === 'chad' ? 4 : 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, -20 + 3 * brow); ctx.lineTo(-4, -19 - 5 * brow); ctx.moveTo(4, -19 - 5 * brow); ctx.lineTo(20, -20 + 3 * brow); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 6); ctx.lineTo(-2, 7); ctx.stroke();
  // Mouth: a grin, then gritted teeth, then the tongue out.
  if (ko) {
    ctx.beginPath(); ctx.ellipse(0, 18, 7, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7a9e'; ctx.beginPath(); ctx.ellipse(3, 24, 5, 7, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (t > 0.35 || b.mode === 'lifting') {
    const w = 8 + 8 * t;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(-w, 12, w * 2, 9 + 4 * t, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.6)'; ctx.lineWidth = 1.5;
    for (let x = -w + 4; x < w; x += 4) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 21 + 4 * t); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.moveTo(-8, 16); ctx.quadraticCurveTo(0, 22, 8, 16); ctx.stroke();
  }
  // Oil on the forehead, sweat flying.
  ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.4 * t})`;
  ctx.beginPath(); ctx.ellipse(-10, -24, 8, 3, -0.3, 0, Math.PI * 2); ctx.fill();
  const drops = ko ? 0 : t > 0.8 ? 4 : t > 0.55 ? 2 : t > 0.3 ? 1 : 0;
  for (let i = 0; i < drops; i += 1) {
    const p = fract(b.time / 0.9 + i * 0.27);
    const side = i % 2 ? 1 : -1;
    const x = side * (30 + 30 * p);
    const y = -10 + 34 * p * p;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (b.grunt.x > 0.05 && t > 0.3 && !ko) {
    ctx.save();
    ctx.translate(46, -30);
    ctx.scale(1 + 0.3 * b.grunt.x, 1 + 0.3 * b.grunt.x);
    ctx.globalAlpha = clamp(b.grunt.x, 0, 1);
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.font = '900 18px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeText('HNNG', 0, 0); ctx.fillText('HNNG', 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/** A standing figure: the spotter at the head of the bench, or the chad admiring himself at the side. */
export function drawStanding(ctx: CanvasRenderingContext2D, b: Bench, who: Who, x: number, footY: number, scale: number, pose: 'phone' | 'spot' | 'shock' | 'flex' | 'thumbs' | 'lie', barY: number): void {
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const skin = who === 'chad' ? SKIN : '#e0bda7';
  const shirt = who === 'chad' ? skin : '#3b82f6';
  const wobble = pose === 'shock' ? Math.sin(b.time * 30) * 2 : 0;
  ctx.translate(wobble, 0);
  for (const side of [-1, 1]) {
    limb(ctx, { x: side * 12, y: -76 }, { x: side * 14, y: 0 }, 16, who === 'chad' ? '#e63946' : '#2b2b30');
    ctx.fillStyle = '#f6f6f6'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(side * 14 - 13, -6, 26, 10, 4); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = shirt; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  const w = who === 'chad' ? 40 : 30;
  ctx.beginPath(); ctx.roundRect(-w, -142, w * 2, 72, 12); ctx.fill(); ctx.stroke();
  if (who === 'chad') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath(); ctx.ellipse(-18, -122, 12, 7, 0, 0, Math.PI * 2); ctx.ellipse(18, -122, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -112); ctx.lineTo(0, -76); ctx.moveTo(-14, -100); ctx.lineTo(14, -100); ctx.moveTo(-14, -88); ctx.lineTo(14, -88); ctx.stroke();
  }
  const shoulder = (side: number): Point => ({ x: side * w, y: -130 });
  if (pose === 'flex' || pose === 'thumbs') {
    for (const side of [-1, 1]) {
      const s = shoulder(side);
      const elbow = { x: side * (w + 44), y: -128 };
      const fist = pose === 'flex' || side < 0 ? { x: side * (w + 34), y: -176 } : { x: side * (w + 50), y: -170 };
      limb(ctx, s, elbow, 22, skin);
      limb(ctx, elbow, fist, 18, skin);
      ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(side * (w + 26), -146, 16, 11, side * -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'; ctx.beginPath(); ctx.ellipse(side * (w + 22), -150, 6, 3, side * -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(fist.x, fist.y, 10, 0, Math.PI * 2); ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
      if (pose === 'thumbs' && side > 0) { ctx.beginPath(); ctx.roundRect(fist.x - 4, fist.y - 24, 8, 16, 4); ctx.fill(); ctx.stroke(); }
    }
  } else if (pose === 'shock') {
    for (const side of [-1, 1]) { limb(ctx, shoulder(side), { x: side * 22, y: -180 }, 14, skin); }
  } else if (pose === 'spot') {
    for (const side of [-1, 1]) { limb(ctx, shoulder(side), { x: side * 46, y: (barY - footY) / scale + 14 }, 14, skin); ctx.beginPath(); ctx.arc(side * 46, (barY - footY) / scale + 14, 9, 0, Math.PI * 2); ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke(); }
  } else {
    // On the phone: both hands in front, head down.
    for (const side of [-1, 1]) limb(ctx, shoulder(side), { x: side * 10, y: -104 }, 14, skin);
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-11, -122, 22, 32, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2e8b57';
    ctx.beginPath(); ctx.moveTo(-8, -98); ctx.lineTo(-3, -106); ctx.lineTo(1, -101); ctx.lineTo(8, -114); ctx.lineTo(8, -96); ctx.lineTo(-8, -96); ctx.closePath(); ctx.fill();
  }
  // Head.
  const hy = -170;
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  if (who === 'chad') {
    ctx.beginPath(); ctx.moveTo(-24, hy - 16); ctx.quadraticCurveTo(-26, hy - 40, 0, hy - 40); ctx.quadraticCurveTo(26, hy - 40, 24, hy - 16); ctx.lineTo(22, hy + 14); ctx.quadraticCurveTo(20, hy + 28, 0, hy + 30); ctx.quadraticCurveTo(-20, hy + 28, -22, hy + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(28, 31, 38, 0.3)';
    ctx.beginPath(); ctx.moveTo(-20, hy + 10); ctx.quadraticCurveTo(-18, hy + 26, 0, hy + 28); ctx.quadraticCurveTo(18, hy + 26, 20, hy + 10); ctx.lineTo(18, hy + 6); ctx.quadraticCurveTo(0, hy + 16, -18, hy + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.ellipse(0, hy - 34, 24, 9, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(0, hy, 22, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.arc(0, hy - 14, 22, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-24, hy - 18, 48, 7, 3); ctx.fill(); ctx.stroke();
  }
  const down = pose === 'phone' ? 1 : 0;
  const shock = pose === 'shock';
  for (const ex of [-8, 8]) {
    ctx.beginPath(); ctx.ellipse(ex, hy - 4 + 4 * down, 4.5, shock ? 7 : 4.5 - 1.5 * down, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, hy - 3 + 5 * down, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = who === 'chad' ? 3.5 : 2.5;
  ctx.beginPath(); ctx.moveTo(-15, hy - 14); ctx.lineTo(-3, hy - 13 - (who === 'chad' ? 4 : 0)); ctx.moveTo(3, hy - 13 - (who === 'chad' ? 4 : 0)); ctx.lineTo(15, hy - 14); ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (shock) { ctx.ellipse(0, hy + 12, 5, 7, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (pose === 'flex' || pose === 'thumbs') { ctx.moveTo(-9, hy + 8); ctx.quadraticCurveTo(0, hy + 16, 9, hy + 8); }
  else { ctx.moveTo(-6, hy + 10); ctx.lineTo(6, hy + 10); }
  ctx.stroke();
  const shades = clamp(b.shades.x, 0, 1);
  if (who === 'chad' && shades > 0.02 && (pose === 'flex' || pose === 'thumbs')) {
    const dy = -90 * (1 - shades);
    ctx.fillStyle = INK;
    for (const ex of [-8, 8]) { ctx.fillRect(ex - 8, hy - 9 + dy, 16, 8); ctx.fillRect(ex - 6, hy - 1 + dy, 12, 4); }
    ctx.fillRect(-2, hy - 7 + dy, 4, 3);
  }
  ctx.restore();
  void noise;
}

/** Everything on and around the bench, back to front. `chalk` reports where a chalk puff belongs this frame. */
export function drawBench(ctx: CanvasRenderingContext2D, b: Bench): void {
  const barY = b.barY.x;
  const who = b.onBench;
  const lifting = b.mode === 'lifting' || b.mode === 'swap';
  // The spotter behind the head (or nobody, once he is on the bench), then the chad at the side.
  if (who === 'chad' && b.mode !== 'sitting') {
    const pose = b.dumped ? 'shock' : b.spotHands.x > 0.5 ? 'spot' : 'phone';
    drawStanding(ctx, b, 'bro', 480, UPRIGHT.base, 0.78, pose, barAt(b, 480));
  }
  if (who === 'bro' || b.mode === 'swap') {
    drawStanding(ctx, b, 'chad', b.chadX.x, UPRIGHT.base + 60, 0.9, b.dumped ? 'thumbs' : 'flex', barY);
  }
  // Rack uprights and hooks.
  for (const x of [UPRIGHT.left, UPRIGHT.right]) {
    ctx.fillStyle = '#4a4a55'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - 9, UPRIGHT.top, 18, UPRIGHT.base - UPRIGHT.top, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x - 30, UPRIGHT.base - 6, 60, 12, 4); ctx.fill(); ctx.stroke();
    const inner = x < 480 ? 1 : -1;
    ctx.beginPath(); ctx.roundRect(x < 480 ? x + 6 : x - 26, BAR.rack - 4, 20, 22, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.roundRect(x + inner * 8 + (inner < 0 ? -12 : 0), BAR.rack + 8, 12, 10, 2); ctx.fill(); ctx.stroke();
  }
  // Bench: far half.
  ctx.fillStyle = '#7a1a24'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(444, 388); ctx.lineTo(516, 388); ctx.lineTo(534, 440); ctx.lineTo(426, 440); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a4a55';
  ctx.beginPath(); ctx.roundRect(470, 400, 20, 120, 3); ctx.fill(); ctx.stroke();
  if (b.mode === 'sitting') {
    // Sat up to flex: a front-facing upper body over the far end of the bench, legs still forward.
    drawStanding(ctx, b, 'chad', 480, 470, 0.95, 'flex', barY);
  } else {
    // Lying: head, shoulders, pecs, abs.
    const t = b.tension;
    const skin = skinFor(who, b.dumped ? 0.1 : t);
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(458, 380, 44, 30, 8); ctx.fill(); ctx.stroke();
    drawLyingFace(ctx, b, who, t, b.dumped && b.dumpAge > 0.2);
    ctx.fillStyle = who === 'chad' ? skin : '#3b82f6';
    ctx.beginPath(); ctx.moveTo(398, 398); ctx.quadraticCurveTo(480, 386, 562, 398); ctx.lineTo(540, 470); ctx.lineTo(420, 470); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (who === 'chad') {
      for (const cx of [445, 515]) {
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, 420, 40, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.45 * t})`;
        ctx.beginPath(); ctx.ellipse(cx - 12, 410, 14, 6, -0.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(28, 31, 38, 0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(480, 446); ctx.lineTo(480, 470); ctx.moveTo(452, 452); ctx.lineTo(508, 452); ctx.moveTo(456, 462); ctx.lineTo(504, 462); ctx.stroke();
    }
  }
  // Arms up to the bar (hands slide off when dumped).
  const hands = clamp(b.hands.x, 0, 1);
  const skinArm = skinFor(who, b.dumped ? 0.1 : b.tension);
  const shoulderY = b.mode === 'sitting' ? 340 : 398;
  if (b.mode !== 'sitting') {
    for (const side of [-1, 1] as const) {
      const shoulder = { x: 480 + side * 70, y: shoulderY };
      const onBar = { x: 480 + side * 88, y: barAt(b, 480 + side * 88) };
      const off = { x: 480 + side * 120, y: 470 };
      const hand = { x: mix(off.x, onBar.x, hands), y: mix(off.y, onBar.y, hands) };
      const elbow = bendJoint(shoulder, hand, 84, 84, side);
      limb(ctx, shoulder, elbow, 30, skinArm);
      limb(ctx, elbow, hand, 24, skinArm);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + 0.4 * b.tension})`;
      ctx.beginPath(); ctx.ellipse(mix(shoulder.x, elbow.x, 0.5) - side * 6, mix(shoulder.y, elbow.y, 0.5) - 8, 12, 5, side * 0.6, 0, Math.PI * 2); ctx.fill();
      if (hands < 0.5) { ctx.beginPath(); ctx.arc(hand.x, hand.y, 11, 0, Math.PI * 2); ctx.fillStyle = skinArm; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke(); }
    }
  }
  // The bar, bent by the load.
  ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(BAR.left, barAt(b, BAR.left));
  for (let x = BAR.left + 16; x <= BAR.right; x += 16) ctx.lineTo(x, barAt(b, x));
  ctx.stroke();
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(BAR.left + 10, barAt(b, BAR.left + 10) - 3);
  for (let x = BAR.left + 26; x <= BAR.right - 10; x += 16) ctx.lineTo(x, barAt(b, x) - 3);
  ctx.stroke();
  // Knurling hints where the hands go.
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.4)'; ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) for (let i = -14; i <= 14; i += 5) { const x = 480 + side * 88 + i; ctx.beginPath(); ctx.moveTo(x, barAt(b, x) - 4); ctx.lineTo(x, barAt(b, x) + 4); ctx.stroke(); }
  // Hands on the bar.
  if (b.mode !== 'sitting' && hands >= 0.5) {
    for (const side of [-1, 1]) {
      const x = 480 + side * 88;
      ctx.beginPath(); ctx.roundRect(x - 13, barAt(b, x) - 9, 26, 22, 8); ctx.fillStyle = skinArm; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(28, 31, 38, 0.45)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(x - 7 + i * 6, barAt(b, x) - 4); ctx.lineTo(x - 7 + i * 6, barAt(b, x) + 8); ctx.stroke(); }
    }
  }
  // Plates edge-on, on the bar or flying off it.
  for (const p of b.plates) {
    if (p.gone) continue;
    const onBar = !p.loose;
    const x = onBar ? p.x : p.x;
    const y = onBar ? barAt(b, x) : barAt(b, plateX(p.side, p.index)) + p.y;
    const colour = PLATE_COLOURS[p.index]!;
    const h = p.index === 4 ? 66 : 88;
    ctx.save();
    ctx.translate(x, y);
    if (!onBar) ctx.rotate(p.angle);
    ctx.fillStyle = colour; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-6, -h / 2, 12, h, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(-4, -h / 2 + 4, 3, h - 8);
    ctx.fillStyle = INK;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
  // Collars at the ends.
  for (const x of [BAR.left + 6, BAR.right - 6]) { ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 5, barAt(b, x) - 11, 10, 22, 3); ctx.fill(); ctx.stroke(); }
  // The arm from off-screen sliding a plate on.
  if (b.arrival) {
    const a = b.arrival;
    const k = smoothstep(0, 0.45, a.age) * (1 - smoothstep(0.65, 1, a.age));
    const edgeX = a.side < 0 ? -40 : 1000;
    const slotX = plateX(a.side, a.index);
    const hx = mix(edgeX, slotX + a.side * -14, k);
    const hy = barAt(b, slotX) + 40;
    limb(ctx, { x: edgeX, y: hy + 30 }, { x: hx, y: hy }, 22, '#c68e6a');
    ctx.beginPath(); ctx.arc(hx, hy, 13, 0, Math.PI * 2); ctx.fillStyle = '#c68e6a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    if (a.age < 0.5) {
      ctx.save();
      ctx.translate(hx + a.side * 14, hy - 40);
      ctx.fillStyle = PLATE_COLOURS[a.index]!; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(-6, -44, 12, 88, 3); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.font = '900 18px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.globalAlpha = k;
    ctx.strokeText('+ PLATE', hx, hy - 60); ctx.fillText('+ PLATE', hx, hy - 60);
    ctx.globalAlpha = 1;
  }
  // Legs toward the camera, then the near end of the bench.
  const shorts = who === 'chad' ? '#e63946' : '#2b2b30';
  const legSkin = who === 'chad' ? skinFor('chad', 0) : '#e0bda7';
  for (const side of [-1, 1] as const) {
    const hip = { x: 480 + side * 30, y: 472 };
    const knee = { x: 480 + side * 74, y: 452 };
    const foot = { x: 480 + side * 90, y: FLOOR };
    limb(ctx, hip, knee, 40, shorts);
    limb(ctx, knee, foot, 30, legSkin);
    ctx.fillStyle = '#f6f6f6'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(foot.x - 24, foot.y - 12, 48, 30, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.roundRect(foot.x - 18, foot.y - 4, 36, 6, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.5)'; ctx.lineWidth = 2;
    for (const yy of [8, 13]) { ctx.beginPath(); ctx.moveTo(foot.x - 16, foot.y + yy); ctx.lineTo(foot.x + 16, foot.y + yy); ctx.stroke(); }
  }
  ctx.fillStyle = '#7a1a24'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(426, 468); ctx.lineTo(534, 468); ctx.lineTo(548, 520); ctx.lineTo(412, 520); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath(); ctx.moveTo(436, 474); ctx.lineTo(524, 474); ctx.lineTo(530, 490); ctx.lineTo(430, 490); ctx.closePath(); ctx.fill();
  // The spotter's dropped phone at the crash.
  if (b.dumped && who === 'chad' && b.dumpAge > 0.3) {
    ctx.save();
    ctx.translate(430, UPRIGHT.base + 6);
    ctx.rotate(0.8);
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-8, -14, 16, 26, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(0, -2); ctx.lineTo(3, -6); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

export const benchHead = (): Point => HEAD;
