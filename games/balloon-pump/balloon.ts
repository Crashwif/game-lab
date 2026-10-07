/**
 * The balloon: a buoyant body on a tether. It lies limp by the hose until the
 * first strokes lift it, then floats and sways on its own springs, puffs with
 * every gulp of air, and finally shreds into a seeded burst that scatters the
 * same way in a replay as it did live.
 */
import { type Spring, clamp, mix, mulberry32, settleSpring, smoothstep, spring, stepSpring } from './motion';
import type { Point } from './pumper';

/** Where the hose ends and the balloon is tied on. */
export const TETHER: Point = { x: 682, y: 434 };
const NECK = 16;
/** Tether angle of a limp balloon lying on the grass. */
const LIE_ANGLE = 1.32;
const GROUND = 446;
const INK = '#1c1f26';
const BASE = '#ff5d9e';
const DEEP = '#d8306f';
const THIN = '#ffa8cc';
const THIN_DEEP = '#f07ab0';
const LIGHT = '#ffe1ec';
/** The coin's ticker ink: a darker pink than the rubber, so it reads as printed on it. */
const TICKER = '#c2185b';
const TICKER_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';

interface Shred { x: number; y: number; vx: number; vy: number; angle: number; spin: number; length: number; bend: number; width: number; life: number; age: number; tone: number }
interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number }

export interface BalloonDrive {
  /** Resting radius the multiplier calls for. */
  radius: number;
  tug?: number;
  /** 0..1 dread on its face. */
  fear: number;
  /** 0..1 how thin the rubber is stretched (colour and shine). */
  stretch: number;
  /** A gulp of air arrived from the hose this step. */
  inflow: boolean;
}

export interface BalloonState {
  time: number;
  alive: boolean;
  burstAge: number;
  burstAt: Point;
  burstRadius: number;
  stretch: number;
  radius: Spring;
  /** Short-lived extra radius from a gulp of air. */
  puff: Spring;
  /** Squash and stretch: positive is wider than tall. */
  jiggle: Spring;
  /** Tether angle from upright; LIE_ANGLE is on the ground. */
  sway: Spring;
  /** 0 limp on the ground .. 1 floating. */
  rise: Spring;
  eyeOpen: Spring;
  mouthOpen: Spring;
  brow: Spring;
  shreds: Shred[];
  puffs: Puff[];
  /** The torn remains wobbling on the tether. */
  flap: Spring;
}

export function createBalloon(): BalloonState {
  return {
    time: 0, alive: true, burstAge: 0, burstAt: { ...TETHER }, burstRadius: 40, stretch: 0,
    radius: spring(36), puff: spring(0), jiggle: spring(0), sway: spring(LIE_ANGLE), rise: spring(0),
    eyeOpen: spring(1), mouthOpen: spring(0), brow: spring(0), shreds: [], puffs: [], flap: spring(0),
  };
}

/** A fresh balloon, limp on the ground by the hose. */
export function resetBalloon(b: BalloonState): void {
  b.alive = true;
  b.burstAge = 0;
  b.shreds = [];
  b.puffs = [];
  b.stretch = 0;
  settleSpring(b.radius, 36);
  settleSpring(b.puff, 0);
  settleSpring(b.jiggle, 0);
  settleSpring(b.sway, LIE_ANGLE);
  settleSpring(b.rise, 0);
  settleSpring(b.eyeOpen, 1);
  settleSpring(b.mouthOpen, 0);
  settleSpring(b.brow, 0);
  settleSpring(b.flap, 0);
}

const riseFor = (radius: number): number => smoothstep(42, 60, radius);
const breeze = (t: number): number => 0.07 * Math.sin(t * 0.6) + 0.04 * Math.sin(t * 1.7 + 1);
const restAngle = (rise: number, t: number): number => mix(LIE_ANGLE, breeze(t), rise);

/** Jumps straight to the state the drive calls for, for a first frame mid-round. */
export function settleBalloon(b: BalloonState, drive: BalloonDrive): void {
  settleSpring(b.radius, drive.radius);
  const rise = riseFor(drive.radius);
  settleSpring(b.rise, rise);
  settleSpring(b.sway, restAngle(rise, b.time));
  settleSpring(b.eyeOpen, 1 + 0.9 * drive.fear);
  settleSpring(b.mouthOpen, Math.pow(drive.fear, 1.5));
  settleSpring(b.brow, drive.fear);
  b.stretch = drive.stretch;
}

export function stepBalloon(b: BalloonState, drive: BalloonDrive, dt: number): void {
  b.time += dt;
  if (b.alive) {
    b.stretch = drive.stretch;
    stepSpring(b.radius, drive.radius, 7, 0.95, dt);
    const radius = Math.max(8, b.radius.x);
    if (drive.inflow) {
      // A gulp of air: the balloon swells past its size, stretches, and gets nudged away from the pump.
      b.puff.v += 70 * Math.sqrt(radius / 60);
      b.jiggle.v += 1.6;
      b.sway.v += 0.1 * (40 / radius) * clamp(b.rise.x, 0, 1);
    }
    stepSpring(b.puff, 0, 11, 0.32, dt);
    stepSpring(b.jiggle, 0, 13, 0.16, dt);
    stepSpring(b.rise, riseFor(radius), 3.2, 0.7, dt);
    const rise = clamp(b.rise.x, 0, 1);
    // A bigger balloon swings slower; a floating one is barely damped by the air.
    stepSpring(b.sway, restAngle(rise, b.time) + (drive.tug ?? 0), clamp(4 * Math.sqrt(40 / radius), 1.6, 6), mix(0.75, 0.13, rise), dt);
    stepSpring(b.eyeOpen, 1 + 0.9 * drive.fear, 9, 0.85, dt);
    stepSpring(b.mouthOpen, Math.pow(drive.fear, 1.5), 9, 0.85, dt);
    stepSpring(b.brow, drive.fear, 9, 0.85, dt);
    return;
  }
  b.burstAge += dt;
  stepSpring(b.flap, 0, 6, 0.12, dt);
  const drag = Math.exp(-1.8 * dt);
  for (const s of b.shreds) {
    s.age += dt;
    s.vy += 1000 * dt;
    s.vx *= drag;
    s.vy *= drag;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.spin * dt;
    s.spin *= Math.exp(-1.2 * dt);
    if (s.y > GROUND - 2 && s.vy > 0) { s.y = GROUND - 2; s.vy *= -0.3; s.vx *= 0.7; s.spin *= 0.5; }
  }
  b.shreds = b.shreds.filter((s) => s.age < s.life);
  const puffDrag = Math.exp(-3 * dt);
  for (const p of b.puffs) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r += 55 * dt;
    p.vx *= puffDrag;
    p.vy *= puffDrag;
  }
  b.puffs = b.puffs.filter((p) => p.age < 0.7);
}

export interface BalloonGeometry {
  centre: Point;
  rx: number;
  ry: number;
  angle: number;
  /** Tether to centre. */
  length: number;
  radius: number;
  tug?: number;
  rise: number;
}

/** The balloon's current shape in world space: centre, semi-axes, tether angle. */
export function balloonGeometry(b: BalloonState): BalloonGeometry {
  const rise = clamp(b.rise.x, 0, 1);
  let radius = Math.max(8, b.radius.x + b.puff.x);
  const j = clamp(b.jiggle.x, -0.35, 0.45);
  let rx = radius * (0.9 + 0.5 * j) * mix(1.12, 1, rise);
  let ry = radius * (1.06 - 0.45 * j) * mix(0.72, 1, rise);
  // Keep the full silhouette below the headline even on the biggest round and an extra pump pulse.
  // Fitting both axes also contains a rotated balloon; its face and tether use this same geometry.
  const fit = Math.min(1, (TETHER.y - 110 - NECK) / (2 * Math.max(rx, ry)));
  radius *= fit;
  rx *= fit;
  ry *= fit;
  const angle = b.sway.x;
  const length = ry + NECK;
  return { centre: { x: TETHER.x + Math.sin(angle) * length, y: TETHER.y - Math.cos(angle) * length }, rx, ry, angle, length, radius, rise };
}

/** Bursts the balloon into shreds; `quiet` skips the effects for a burst that already happened. */
export function burstBalloon(b: BalloonState, seed: number, quiet: boolean): void {
  const g = balloonGeometry(b);
  b.alive = false;
  b.burstAge = quiet ? 10 : 0;
  b.burstAt = g.centre;
  b.burstRadius = g.radius;
  b.shreds = [];
  b.puffs = [];
  if (quiet) return;
  const rng = mulberry32(seed);
  const cos = Math.cos(g.angle);
  const sin = Math.sin(g.angle);
  for (let i = 0; i < 28; i += 1) {
    const a = (i / 28) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const lx = g.rx * Math.cos(a);
    const ly = -g.length + g.ry * Math.sin(a);
    const nx = Math.cos(a) * cos - Math.sin(a) * sin;
    const ny = Math.cos(a) * sin + Math.sin(a) * cos;
    const speed = 240 + rng() * 420;
    const side = (rng() - 0.5) * 180;
    b.shreds.push({
      x: TETHER.x + lx * cos - ly * sin, y: TETHER.y + lx * sin + ly * cos,
      vx: nx * speed - ny * side, vy: ny * speed + nx * side - 110,
      angle: a + g.angle + (rng() - 0.5), spin: (rng() - 0.5) * 22,
      length: 12 + rng() * 26, bend: (rng() - 0.5) * 14, width: 3.5 + rng() * 4,
      life: 1.5 + rng() * 0.8, age: 0, tone: rng(),
    });
  }
  for (let i = 0; i < 10; i += 1) {
    const a = rng() * Math.PI * 2;
    const s = 110 + rng() * 170;
    b.puffs.push({ x: g.centre.x, y: g.centre.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, r: 8 + rng() * 16, age: rng() * 0.1 });
  }
  b.flap.v = 14;
}

const channel = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16);
function mixColour(a: string, b: string, t: number): string {
  const r = Math.round(mix(channel(a, 1), channel(b, 1), t));
  const g = Math.round(mix(channel(a, 3), channel(b, 3), t));
  const bl = Math.round(mix(channel(a, 5), channel(b, 5), t));
  return `rgb(${r}, ${g}, ${bl})`;
}

export function drawBalloonShadow(ctx: CanvasRenderingContext2D, b: BalloonState): void {
  if (!b.alive) return;
  const g = balloonGeometry(b);
  const height = clamp((GROUND - g.centre.y) / 260, 0, 1);
  ctx.fillStyle = `rgba(20, 40, 30, ${0.2 - 0.1 * height})`;
  ctx.beginPath();
  ctx.ellipse(g.centre.x + 6, GROUND + 6, g.rx * (0.95 - 0.3 * height), 9 + g.rx * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
}

function balloonPath(ctx: CanvasRenderingContext2D, rx: number, ry: number, cy: number): void {
  ctx.beginPath();
  ctx.moveTo(0, cy - ry);
  ctx.bezierCurveTo(rx * 0.56, cy - ry, rx, cy - ry * 0.52, rx, cy + ry * 0.02);
  ctx.bezierCurveTo(rx, cy + ry * 0.58, rx * 0.5, cy + ry * 0.94, 7, cy + ry);
  ctx.lineTo(-7, cy + ry);
  ctx.bezierCurveTo(-rx * 0.5, cy + ry * 0.94, -rx, cy + ry * 0.58, -rx, cy + ry * 0.02);
  ctx.bezierCurveTo(-rx, cy - ry * 0.52, -rx * 0.56, cy - ry, 0, cy - ry);
  ctx.closePath();
}

export function drawBalloon(ctx: CanvasRenderingContext2D, b: BalloonState): void {
  if (!b.alive) {
    drawRemains(ctx, b);
    return;
  }
  const g = balloonGeometry(b);
  const { rx, ry } = g;
  const cy = -g.length;
  const base = mixColour(BASE, THIN, b.stretch * 0.55);
  const deep = mixColour(DEEP, THIN_DEEP, b.stretch * 0.55);
  ctx.save();
  ctx.translate(TETHER.x, TETHER.y);
  ctx.rotate(g.angle);
  ctx.lineJoin = 'round';
  // Neck and knot.
  ctx.fillStyle = deep;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-7, cy + ry - 2); ctx.lineTo(7, cy + ry - 2); ctx.lineTo(4, -1); ctx.lineTo(-4, -1); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -3, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Body: thinner, paler rubber as it stretches.
  const fill = ctx.createRadialGradient(-rx * 0.35, cy - ry * 0.35, Math.min(rx, ry) * 0.05, 0, cy, Math.max(rx, ry) * 1.35);
  fill.addColorStop(0, LIGHT);
  fill.addColorStop(0.28, base);
  fill.addColorStop(1, deep);
  balloonPath(ctx, rx, ry, cy);
  ctx.globalAlpha = 1 - 0.08 * b.stretch;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(110, 25, 60, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
  const shine = `rgba(255, 255, 255, ${0.5 + 0.3 * b.stretch})`;
  ctx.fillStyle = shine;
  ctx.beginPath(); ctx.ellipse(-rx * 0.42, cy - ry * 0.42, rx * 0.16, ry * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
  drawTicker(ctx, b, g, cy);
  ctx.fillStyle = shine;
  ctx.beginPath(); ctx.arc(-rx * 0.22, cy - ry * 0.68, rx * 0.06, 0, Math.PI * 2); ctx.fill();
  drawFace(ctx, b, rx, ry, cy);
  ctx.restore();
}

/**
 * The coin's ticker printed across the forehead, in the balloon's frame: it grows with the
 * radius, squashes and stretches with the rubber, and widens as the rubber thins, so a limp balloon wears it small.
 */
function drawTicker(ctx: CanvasRenderingContext2D, b: BalloonState, g: BalloonGeometry, cy: number): void {
  ctx.save();
  ctx.translate(0, cy - g.ry * 0.52);
  ctx.scale((g.rx / g.radius) * (0.8 + 0.32 * b.stretch), g.ry / g.radius);
  ctx.font = `900 ${g.radius * 0.3}px ${TICKER_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = TICKER;
  ctx.fillText('$HOTAIR', 0, 0);
  ctx.restore();
}

/** The balloon's face, in the balloon's frame: calm, then worried, then screaming. */
function drawFace(ctx: CanvasRenderingContext2D, b: BalloonState, rx: number, ry: number, cy: number): void {
  const fear = clamp(b.brow.x, 0, 1);
  const eyeOpen = clamp(b.eyeOpen.x, 0.2, 2);
  const open = clamp(b.mouthOpen.x, 0, 1);
  const eyeY = cy - ry * 0.12;
  const eyeR = rx * 0.11;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const ex = side * rx * 0.3;
    ctx.beginPath(); ctx.ellipse(ex, eyeY, eyeR, Math.min(eyeR * 1.5, eyeR * eyeOpen), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, rx * 0.035); ctx.stroke();
    const pupil = eyeR * (0.45 - 0.2 * fear);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(ex - eyeR * 0.25, eyeY + eyeR * 0.15, pupil, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ex - eyeR * 0.35, eyeY - eyeR * 0.05, pupil * 0.35, 0, Math.PI * 2); ctx.fill();
    // Worried brows rise toward the middle.
    const by = eyeY - eyeR * 1.7;
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, rx * 0.045);
    ctx.beginPath(); ctx.moveTo(ex + side * eyeR * 1.2, by + fear * eyeR * 0.3); ctx.lineTo(ex - side * eyeR * 0.9, by - fear * eyeR * 0.9); ctx.stroke();
  }
  const my = cy + ry * 0.3;
  const half = rx * 0.22;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, rx * 0.04);
  ctx.globalAlpha = clamp(1 - open * 3, 0, 1);
  ctx.beginPath(); ctx.moveTo(-half, my); ctx.quadraticCurveTo(0, my + rx * 0.16 * (1 - fear * 2.5), half, my); ctx.stroke();
  ctx.globalAlpha = 1;
  if (open > 0.12) {
    ctx.beginPath(); ctx.ellipse(0, my + ry * 0.05 * open, rx * (0.08 + 0.2 * open), ry * (0.04 + 0.22 * open), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.stroke();
  }
  const drops = fear > 0.85 ? 3 : fear > 0.6 ? 2 : fear > 0.35 ? 1 : 0;
  for (let i = 0; i < drops; i += 1) {
    const p = (b.time / 1.3 + i * 0.41) % 1;
    const a = -1.1 + 1.3 * p;
    const dx = rx * 0.96 * Math.cos(a) * (i % 2 ? -1 : 1);
    const dy = cy + ry * 0.96 * Math.sin(a);
    const r = Math.max(3, rx * 0.07);
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.moveTo(dx, dy - r * 1.7); ctx.lineTo(dx + r, dy); ctx.arc(dx, dy + r * 0.3, r, -0.3, Math.PI + 0.3); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** After the burst: escaping air, the shockwave and flash, flying shreds, and what is left on the tether. */
function drawRemains(ctx: CanvasRenderingContext2D, b: BalloonState): void {
  const age = b.burstAge;
  const at = b.burstAt;
  for (const p of b.puffs) {
    ctx.globalAlpha = 0.5 * (1 - p.age / 0.7);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (age < 0.5) {
    const k = age / 0.5;
    ctx.strokeStyle = `rgba(255, 210, 225, ${0.6 * (1 - k)})`;
    ctx.lineWidth = 1 + 9 * (1 - k);
    ctx.beginPath(); ctx.arc(at.x, at.y, b.burstRadius * 0.6 + 480 * (1 - (1 - k) * (1 - k)), 0, Math.PI * 2); ctx.stroke();
  }
  if (age < 0.09) {
    ctx.fillStyle = `rgba(255, 255, 255, ${1 - age / 0.09})`;
    ctx.beginPath(); ctx.arc(at.x, at.y, b.burstRadius * 1.5 * (1 + age * 6), 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (const s of b.shreds) {
    ctx.globalAlpha = clamp((s.life - s.age) / 0.5, 0, 1);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.strokeStyle = INK; ctx.lineWidth = s.width + 3;
    ctx.beginPath(); ctx.moveTo(-s.length / 2, 0); ctx.quadraticCurveTo(0, s.bend, s.length / 2, 0); ctx.stroke();
    ctx.strokeStyle = mixColour(DEEP, BASE, s.tone); ctx.lineWidth = s.width; ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(TETHER.x, TETHER.y);
  ctx.rotate(0.9 + b.flap.x * 0.5);
  ctx.fillStyle = DEEP; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-9, -12); ctx.lineTo(-3, -22); ctx.lineTo(2, -14); ctx.lineTo(9, -27); ctx.lineTo(10, -9); ctx.lineTo(6, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -2, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
