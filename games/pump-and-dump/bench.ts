/**
 * The bench, seen from the feet: the lifter's face between his arms, the
 * bar across the frame with the plates edge-on at both ends, the rack, and
 * the spotter standing behind his head on his phone. Reps cycle with the
 * multiplier, plates arrive from the edge of the frame at milestones, the
 * bar bends and shakes, the face reddens and grits. An accepted exit racks
 * the bar and sits him up to flex; the spotter takes the bench. The crash
 * drops the bar on whoever is under it and sends the plates rolling.
 */
import { endurance } from './endurance';
import { type Spring, clamp, fract, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, type Point, SKIN } from './gym';

export const BAR = { left: 196, right: 764, top: 296, chest: 404, rack: 282, sleeve: 300 } as const;
const UPRIGHT = { left: 296, right: 664, base: 398, top: 234 } as const;
const HEAD: Point = { x: 480, y: 372 };
const PLATE_COLOURS = ['#e63946', '#3b82f6', '#ffd60a', '#2e8b57', '#f8f8f8', '#e63946', '#3b82f6', '#ffd60a'];
/** Displayed multipliers at which the next pair of plates goes on. */
export const PLATE_AT = [1.3, 1.7, 2.2, 3, 4, 5.5, 7.5, 10];
/** Every plate is a memecoin: the ticker the arm calls out as it slides each one on. */
const TICKERS = ['$PUMP', '$GYATT', '$HOPIUM', '$NATTY', '$RIZZ', '$SPOTME', '$EGOLIFT', '$SPINE'];
const FLOOR = 522;
/** Where the spotter's syringe comes to rest: the floor behind the bench, at his feet. */
const SYRINGE_FLOOR = 408;

export type Who = 'chad' | 'bro';
export type Mode = 'idle' | 'lifting' | 'racking' | 'sitting' | 'swap';

interface Plate { side: -1 | 1; index: number; x: number; y: number; vx: number; vy: number; spin: number; angle: number; loose: boolean; gone: boolean }
/** The spotter's syringe: tucked behind his ear, working its way out with the load, out and rolling at the crash. */
interface Syringe { peek: Spring; out: boolean; x: number; y: number; vx: number; vy: number; angle: number; spin: number; settled: boolean }

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
  act: number;
  effort: number;
  dumped: boolean;
  hitLifter: Who | null;
  dumpAge: number;
  hands: Spring;
  shades: Spring;
  spotHands: Spring;
  chadX: Spring;
  grunt: Spring;
  /** The rack's jolt when the bar lands. */
  jolt: Spring;
  /** The bar is on its way down and has not landed yet. */
  impactPending: boolean;
  syringe: Syringe;
  /** What happened this step; `bounce` counts plates that hit the floor hard. */
  events: { rep: boolean; plate: boolean; racked: boolean; swapped: boolean; impact: boolean; bounce: number };
}

const freshSyringe = (): Syringe => ({ peek: spring(0), out: false, x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, settled: false });
const noEvents = (): Bench['events'] => ({ rep: false, plate: false, racked: false, swapped: false, impact: false, bounce: 0 });

export function createBench(): Bench {
  return { time: 0, mode: 'idle', modeAge: 0, onBench: 'chad', phase: 0, act: 0, effort: 0, barY: spring(BAR.rack), plates: [], arrival: null, nextPlate: 0, tension: 0, dumped: false, hitLifter: null, dumpAge: 0, hands: spring(1), shades: spring(0), spotHands: spring(0), chadX: spring(480), grunt: spring(0), jolt: spring(0), impactPending: false, syringe: freshSyringe(), events: noEvents() };
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
  b.hitLifter = null;
  b.dumpAge = 0;
  settleSpring(b.hands, 1);
  settleSpring(b.shades, 0);
  settleSpring(b.spotHands, 0);
  settleSpring(b.chadX, 480);
  settleSpring(b.grunt, 0);
  settleSpring(b.jolt, 0);
  b.impactPending = false;
  b.syringe = freshSyringe();
}

function addPlates(b: Bench, index: number, quiet: boolean): void {
  for (const side of [-1, 1] as const) b.plates.push({ side, index, x: plateX(side, index), y: 0, vx: 0, vy: 0, spin: 0, angle: 0, loose: false, gone: false });
  b.nextPlate = index + 1;
  if (!quiet) b.arrival = { side: index % 2 ? 1 : -1, index, age: 0 };
}

const plateX = (side: -1 | 1, index: number): number => (side < 0 ? BAR.sleeve - 12 - index * 13 : BAR.right - (BAR.sleeve - BAR.left) + 12 + index * 13);

/**
 * Jumps straight to the state a multiplier calls for, for a round met late: the bar loaded to the number and,
 * once the exit is in (`racked`), already handed over, the spotter lifting and the chad flexing at the side.
 */
export function settleBench(b: Bench, multiplier: number, racked: boolean): void {
  b.mode = 'lifting';
  settleSpring(b.barY, BAR.top);
  while (b.nextPlate < PLATE_AT.length && multiplier >= PLATE_AT[b.nextPlate]!) addPlates(b, b.nextPlate, true);
  b.arrival = null;
  if (racked) {
    b.onBench = 'bro';
    settleSpring(b.chadX, 790);
    settleSpring(b.shades, 1);
  }
}

/** The exit was accepted: rack it, sit up, hand the bench over. */
export function rackBar(b: Bench): void {
  if (b.mode === 'lifting' && b.onBench === 'chad') { b.mode = 'racking'; b.modeAge = 0; }
}

/** The bar comes down. `quiet` skips the effects for a crash that already happened. */
export function dumpBar(b: Bench, seed: number, quiet: boolean): void {
  if (b.dumped) return;
  if (b.mode === 'idle') { b.mode = 'lifting'; b.modeAge = 0; }
  b.hitLifter = b.onBench === 'bro' ? 'bro' : b.mode === 'lifting' ? 'chad' : null;
  b.dumped = true;
  b.dumpAge = quiet ? 10 : 0;
  b.impactPending = !quiet;
  b.arrival = null;
  const syringePose = benchFigurePose(b, 'bro'), peek = clamp(b.syringe.peek.x, 0, 1);
  const syringeFrom = figurePoint(syringePose, { x: HEAD.x + 22 + 12 * peek, y: HEAD.y - syringePose.rise * 68 - 4 - 8 * peek + Math.sin(b.time * 27) * 1.5 * peek });
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
  // The syringe leaves the spotter's ear (or rolls out from under the bench if he is the one under the bar):
  // out and bouncing, or already lying where it stopped for a crash met late. Drawn after the plates so their scatter keeps its seed.
  const s = b.syringe;
  s.out = true;
  settleSpring(s.peek, 0);
  if (quiet) { s.x = 604; s.y = SYRINGE_FLOOR; s.vx = 0; s.vy = 0; s.angle = 0; s.spin = 0; s.settled = true; }
  else if (b.onBench === 'chad') { s.x = syringeFrom.x; s.y = syringeFrom.y; s.vx = 150 + rng() * 80; s.vy = -120 - rng() * 80; s.angle = -0.6; s.spin = 8 + rng() * 5; s.settled = false; }
  else { s.x = syringeFrom.x; s.y = syringeFrom.y; s.vx = 120 + rng() * 60; s.vy = -60; s.angle = 0.4; s.spin = 6; s.settled = false; }
}

export interface BenchDrive { running: boolean; multiplier: number; growth: number; tension: number; seconds?: number }

export function stepBench(b: Bench, drive: BenchDrive, dt: number): void {
  b.time += dt;
  b.modeAge += dt;
  b.tension = drive.tension;
  const act = endurance(drive.seconds ?? 0); b.act = act.act; b.effort = drive.running ? act.effort : 0;
  b.events = noEvents();
  if (b.mode === 'idle' && drive.running) { b.mode = 'lifting'; b.modeAge = 0; b.phase = 0; }
  if (b.mode === 'racking' && b.modeAge > 0.7) { b.mode = 'sitting'; b.modeAge = 0; b.events.racked = true; }
  if (b.mode === 'sitting' && b.modeAge > 2.2) { b.mode = 'swap'; b.modeAge = 0; b.onBench = 'bro'; b.events.swapped = true; }
  if (b.mode === 'swap' && b.modeAge > 0.5) { b.mode = 'lifting'; b.modeAge = 0; }
  const lifting = b.mode === 'lifting' && !b.dumped;
  if (lifting && drive.running) {
    const before = b.phase;
    const rate = 0.45 + 0.65 * (1 - Math.exp(-drive.growth / 2.2));
    b.phase += rate * (1 - b.effort * (b.act === 2 ? .72 : .22)) * dt;
    if (fract(before) < 0.5 && (fract(b.phase) >= 0.5 || Math.floor(b.phase) > Math.floor(before))) { b.events.rep = true; b.grunt.v += 8; }
    // Plates the number passed while no frame was drawn (a hidden tab) go straight on; only the latest is carried in.
    while (b.nextPlate + 1 < PLATE_AT.length && drive.multiplier >= PLATE_AT[b.nextPlate + 1]!) { addPlates(b, b.nextPlate, true); b.arrival = null; }
    if (b.nextPlate < PLATE_AT.length && drive.multiplier >= PLATE_AT[b.nextPlate]! && !b.arrival) { addPlates(b, b.nextPlate, false); b.events.plate = true; }
  }
  if (b.arrival) { b.arrival.age += dt; if (b.arrival.age > 1) b.arrival = null; }
  // Where the bar wants to be.
  // A controlled descent followed by a quicker press, both with zero endpoint velocity.
  const cycle = fract(b.phase);
  const rep = cycle < .62 ? smoothstep(0, .62, cycle) : 1 - smoothstep(.62, 1, cycle);
  const repY = mix(BAR.top, BAR.chest, b.act === 2 ? mix(rep, .08, b.effort * .9) : rep);
  const target = b.dumped ? BAR.chest + 34 : b.mode === 'idle' || b.mode === 'sitting' || (b.mode === 'racking' && b.modeAge > 0.3) ? BAR.rack : b.mode === 'swap' ? BAR.top : b.mode === 'racking' ? BAR.top : repY;
  stepSpring(b.barY, target, b.dumped ? 9 : b.mode === 'lifting' ? 26 : 8, b.dumped ? 0.3 : 0.9, dt);
  stepSpring(b.hands, b.dumped && b.dumpAge > 0.25 ? 0 : 1, 10, 0.7, dt);
  stepSpring(b.shades, b.mode === 'sitting' || b.mode === 'swap' || (b.mode === 'lifting' && b.onBench === 'bro') ? 1 : 0, 12, 0.5, dt);
  stepSpring(b.spotHands, !b.dumped && b.onBench === 'chad' && (b.mode === 'racking' || (b.mode === 'lifting' && drive.tension > 0.55)) ? 1 : 0, 6, 0.8, dt);
  stepSpring(b.chadX, (b.mode === 'sitting' && b.modeAge > 1.05) || b.mode === 'swap' || (b.mode === 'lifting' && b.onBench === 'bro') ? 790 : 480, 5, 0.9, dt);
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
      if (p.y > floorAt - BAR.chest - 34 && p.vy > 0) { p.y = floorAt - BAR.chest - 34; p.vy *= -0.35; p.vx *= 0.9; p.spin *= 0.8; if (p.vy < -60) b.events.bounce += 1; }
      if (p.x < -80 || p.x > 1040) p.gone = true;
    }
    // The bar lands: the moment the drop's hit-stop, the shake and the stinger hang on.
    if (b.impactPending && (b.barY.x >= BAR.chest + 26 || b.dumpAge > 0.45)) { b.impactPending = false; b.events.impact = true; b.jolt.v += 12; }
  }
  stepSpring(b.jolt, 0, 20, 0.28, dt);
  // Anticipation: the syringe works its way out from behind the spotter's ear as the load climbs, then flies at the crash.
  const s = b.syringe;
  stepSpring(s.peek, !b.dumped && b.mode === 'lifting' && b.onBench === 'chad' ? smoothstep(0.3, 0.9, drive.tension) : 0, 4, 0.8, dt);
  if (s.out && !s.settled) {
    s.vy += 900 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.spin * dt;
    if (s.y >= SYRINGE_FLOOR) {
      s.y = SYRINGE_FLOOR;
      if (s.vy > 90) { s.vy *= -0.3; s.vx *= 0.8; s.spin *= 0.5; }
      else { s.vy = 0; s.spin = 0; s.angle = 0; s.vx *= Math.exp(-2.2 * dt); if (Math.abs(s.vx) < 6) { s.vx = 0; s.settled = true; } }
    }
  }
}

/** Bar height at a given x along the bent bar. */
function barAt(b: Bench, x: number): number {
  const plates = b.plates.filter((p) => !p.loose).length / 2;
  const sag = (2 + 3 * plates + (b.act === 3 ? b.effort * 15 : 0)) * (b.mode === 'idle' || b.mode === 'sitting' ? 0.3 : 1);
  const t = (x - BAR.left) / (BAR.right - BAR.left);
  const bend = sag * (4 * (t - 0.5) * (t - 0.5));
  const lifting = b.mode === 'lifting' && !b.dumped;
  const tremor = lifting ? Math.sin(b.time * 31) * (0.4 + 5 * b.tension * b.tension) : 0;
  const tilt = lifting ? (Math.sin(b.time * 9.7) * 9 * b.tension + (b.act === 1 ? b.effort * 22 : b.act === 4 ? -b.effort * 18 : 0)) * (t - .5) * 2 : 0;
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

/** A syringe: plunger, barrel with something yellow in it, a red label, the needle. */
function drawSyringe(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(27, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(232, 242, 255, 0.92)';
  ctx.beginPath(); ctx.roundRect(-14, -5, 28, 10, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd60a'; ctx.fillRect(-11, -3, 13, 6);
  ctx.fillStyle = '#e63946'; ctx.fillRect(3, -5, 8, 10);
  ctx.fillStyle = '#2b2b30';
  ctx.beginPath(); ctx.roundRect(-25, -2.5, 12, 5, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-28, -6.5, 4, 13, 1.5); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function skinFor(who: Who, tension: number): string {
  const t = clamp(tension, 0, 1);
  const r = Math.round(mix(243, 226, t));
  const g = Math.round(mix(220, 92, t));
  const bl = Math.round(mix(203, 84, t));
  return who === 'chad' ? `rgb(${r}, ${g}, ${bl})` : `rgb(${Math.round(mix(224, 226, t))}, ${Math.round(mix(189, 100, t))}, ${Math.round(mix(167, 90, t))})`;
}

/** The face of whoever is on the bench, looking up at the bar. */
function drawLyingFace(ctx: CanvasRenderingContext2D, b: Bench, who: Who, tension: number, ko: boolean, relaxed = false): void {
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
  } else if (t > 0.35 || (b.mode === 'lifting' && !relaxed)) {
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
  if (b.grunt.x > 0.05 && t > 0.3 && !ko && !relaxed) {
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

export interface BenchFigurePose { x: number; footY: number; scale: number; rise: number; narrow: number; grip: number; flex: number; phone: number }
export function benchFigurePose(b: Bench, who: Who): BenchFigurePose {
  if (who === 'chad') {
    const up = b.onBench === 'bro' ? 1 : b.mode === 'sitting' ? smoothstep(0, .7, b.modeAge) : 0;
    return { x: b.chadX.x, footY: FLOOR, scale: 1, rise: up, narrow: mix(1, .7, up), grip: clamp(b.hands.x, 0, 1) * (1 - up), flex: up, phone: 0 };
  }
  const aboard = b.onBench !== 'bro' ? 0 : b.mode === 'swap' ? smoothstep(0, .5, b.modeAge) : 1;
  return { x: 480, footY: mix(UPRIGHT.base, FLOOR, aboard), scale: mix(.78, 1, aboard), rise: .35 * (1 - aboard), narrow: mix(.55, 1, aboard), grip: aboard * clamp(b.hands.x, 0, 1), flex: 0, phone: 1 - aboard };
}
const figurePoint = (pose: BenchFigurePose, p: Point): Point => ({ x: pose.x + (p.x - 480) * pose.scale, y: pose.footY + (p.y - FLOOR) * pose.scale });
/** The rendered elbow, wrist and fingers all consume this one endpoint. */
export function benchArmPose(b: Bench, who: Who, side: -1 | 1) {
  const pose = benchFigurePose(b, who);
  const shoulder = { x: 480 + side * 70 * pose.narrow, y: 398 - pose.rise * 68 };
  const off = { x: 480 + side * mix(120, 98, pose.flex), y: mix(470, 300, pose.flex) };
  const phone = { x: 480 + side * 10, y: shoulder.y + 35 };
  const spot = who === 'bro' ? clamp(b.spotHands.x, 0, 1) * pose.phone : 0;
  const worldGrip = { x: 480 + side * 88, y: barAt(b, 480 + side * 88) };
  const onBar = { x: 480 + (worldGrip.x - pose.x) / pose.scale, y: FLOOR + (worldGrip.y - pose.footY) / pose.scale };
  let hand = { x: mix(off.x, phone.x, pose.phone), y: mix(off.y, phone.y, pose.phone) };
  hand = { x: mix(hand.x, onBar.x, Math.max(pose.grip, spot)), y: mix(hand.y, onBar.y, Math.max(pose.grip, spot)) };
  const length = who === 'chad' ? 84 : 72;
  const distance = Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y);
  if (distance > length * 2 - .01) { const k = (length * 2 - .01) / distance; hand = { x: shoulder.x + (hand.x - shoulder.x) * k, y: shoulder.y + (hand.y - shoulder.y) * k }; }
  const elbow = bendJoint(shoulder, hand, length, length, side);
  return { shoulder: figurePoint(pose, shoulder), elbow: figurePoint(pose, elbow), hand: figurePoint(pose, hand), scale: pose.scale, grip: pose.grip };
}
function drawBenchFigure(ctx: CanvasRenderingContext2D, b: Bench, who: Who): void {
  const pose = benchFigurePose(b, who);
  const ko = b.hitLifter === who && b.dumpAge > .2;
  const effort = b.tension * (1 - pose.flex) * (1 - pose.phone);
  const skin = skinFor(who, ko ? .1 : effort);
  ctx.save(); ctx.translate(pose.x, pose.footY); ctx.scale(pose.scale, pose.scale); ctx.translate(-480, -FLOOR);
  const rise = pose.rise * 68;
  const shoulderY = 398 - rise;
  const half = 82 * pose.narrow;
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(458, 380 - rise, 44, 30, 8); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(0, -rise);
  if (who === 'bro' && !b.syringe.out) { const peek = clamp(b.syringe.peek.x, 0, 1); drawSyringe(ctx, HEAD.x + 22 + 12 * peek, HEAD.y - 4 - 8 * peek + Math.sin(b.time * 27) * 1.5 * peek, -.6 - .3 * peek, .85); }
  drawLyingFace(ctx, b, who, effort, ko, pose.flex > .1 || pose.phone > .1);
  if (who === 'chad' && pose.flex > 0 && b.shades.x > .02) {
    const y = HEAD.y - 90 * (1 - clamp(b.shades.x, 0, 1)); ctx.fillStyle = INK;
    for (const ex of [-11, 11]) { ctx.fillRect(HEAD.x + ex - 9, y - 14, 18, 11); }
    ctx.fillRect(HEAD.x - 3, y - 11, 6, 3);
  }
  ctx.restore();
  ctx.fillStyle = who === 'chad' ? skin : '#3b82f6';
  ctx.beginPath(); ctx.moveTo(480 - half, shoulderY); ctx.quadraticCurveTo(480, shoulderY - 12, 480 + half, shoulderY); ctx.lineTo(480 + 60 * pose.narrow, 470); ctx.lineTo(480 - 60 * pose.narrow, 470); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (who === 'chad') {
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(480 + side * 35 * pose.narrow, 420 - rise * .8, 40 * pose.narrow, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(28,31,38,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(480, 446 - rise * .4); ctx.lineTo(480, 466); ctx.stroke();
  }
  for (const side of [-1, 1]) {
    const hip = { x: 480 + side * 30 * pose.narrow, y: 472 };
    const knee = { x: 480 + side * mix(74, 42, pose.rise), y: mix(452, 482, pose.rise) };
    const foot = { x: 480 + side * 90, y: FLOOR };
    limb(ctx, hip, knee, 40 * pose.narrow, who === 'chad' ? '#e63946' : '#2b2b30'); limb(ctx, knee, foot, 26, skin);
    ctx.fillStyle = '#f6f6f6'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(foot.x - 24, foot.y - 12, 48, 30, 10); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  for (const side of [-1, 1] as const) {
    const arm = benchArmPose(b, who, side);
    limb(ctx, arm.shoulder, arm.elbow, 30 * arm.scale, skin); limb(ctx, arm.elbow, arm.hand, 24 * arm.scale, skin);
  }
}
function drawBenchHands(ctx: CanvasRenderingContext2D, b: Bench, who: Who): void {
  const pose = benchFigurePose(b, who);
  const skin = skinFor(who, b.hitLifter === who ? .1 : b.tension * (1 - pose.flex) * (1 - pose.phone));
  if (who === 'bro' && !b.dumped && pose.phone > .001) {
    const left = benchArmPose(b, who, -1).hand, right = benchArmPose(b, who, 1).hand;
    ctx.save(); ctx.globalAlpha *= pose.phone * (1 - clamp(b.spotHands.x, 0, 1));
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect((left.x + right.x) / 2 - 11 * pose.scale, (left.y + right.y) / 2 - 16 * pose.scale, 22 * pose.scale, 32 * pose.scale, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2e8b57'; ctx.fillRect((left.x + right.x) / 2 - 7 * pose.scale, (left.y + right.y) / 2 - 11 * pose.scale, 14 * pose.scale, 22 * pose.scale); ctx.restore();
  }
  for (const side of [-1, 1] as const) {
    const { hand, scale, grip } = benchArmPose(b, who, side);
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(hand.x - 13 * scale, hand.y - 9 * scale, 26 * scale, 22 * scale, 8 * scale); ctx.fill(); ctx.stroke();
    if (grip > .05) { ctx.strokeStyle = `rgba(28,31,38,${.45 * grip})`; ctx.lineWidth = 1.5; for (const offset of [-5, 2, 8]) { ctx.beginPath(); ctx.moveTo(hand.x + offset * scale, hand.y - 4 * scale); ctx.lineTo(hand.x + offset * scale, hand.y + 10 * scale); ctx.stroke(); } }
  }
}

/** Everything on and around the bench, back to front. `chalk` reports where a chalk puff belongs this frame. */
export function drawBench(ctx: CanvasRenderingContext2D, b: Bench): void {
  const barY = b.barY.x;
  const who = b.onBench;
  const lifting = b.mode === 'lifting' || b.mode === 'swap';
  // One rig per person, including the walk to the side and the spotter's descent onto the pad.
  if (who === 'chad') { drawBenchFigure(ctx, b, 'bro'); drawBenchHands(ctx, b, 'bro'); }
  if (who === 'bro') { drawBenchFigure(ctx, b, 'chad'); drawBenchHands(ctx, b, 'chad'); }
  // Rack uprights and hooks, jolted when the bar lands.
  const jolt = clamp(b.jolt.x, -1, 1);
  ctx.save();
  ctx.translate(0, jolt * 4);
  for (const x of [UPRIGHT.left, UPRIGHT.right]) {
    ctx.fillStyle = '#4a4a55'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - 9, UPRIGHT.top, 18, UPRIGHT.base - UPRIGHT.top, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x - 30, UPRIGHT.base - 6, 60, 12, 4); ctx.fill(); ctx.stroke();
    const inner = x < 480 ? 1 : -1;
    ctx.beginPath(); ctx.roundRect(x < 480 ? x + 6 : x - 26, BAR.rack - 4, 20, 22, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.roundRect(x + inner * 8 + (inner < 0 ? -12 : 0), BAR.rack + 8, 12, 10, 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // The syringe, out: bouncing across the floor in front of the rack, then lying there with its label.
  if (b.syringe.out) {
    const s = b.syringe;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.ellipse(s.x, SYRINGE_FLOOR + 6, 26, 4, 0, 0, Math.PI * 2); ctx.fill();
    drawSyringe(ctx, s.x, s.y, s.angle, 1.15);
    if (s.settled) {
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.font = '900 13px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.strokeText('DEFINITELY CREATINE', s.x + 10, s.y - 16); ctx.fillText('DEFINITELY CREATINE', s.x + 10, s.y - 16);
    }
  }
  // Bench: far half.
  ctx.fillStyle = '#7a1a24'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(444, 388); ctx.lineTo(516, 388); ctx.lineTo(534, 440); ctx.lineTo(426, 440); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a4a55';
  ctx.beginPath(); ctx.roundRect(470, 400, 20, 120, 3); ctx.fill(); ctx.stroke();
  drawBenchFigure(ctx, b, who);
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
  // Fingers share the exact endpoint used by the forearm throughout release.
  drawBenchHands(ctx, b, who);
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
    const ticker = `+ ${TICKERS[a.index % TICKERS.length]!}`;
    ctx.strokeText(ticker, hx, hy - 60); ctx.fillText(ticker, hx, hy - 60);
    ctx.globalAlpha = 1;
  }
  // Near end of the bench occludes the planted thighs.
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
