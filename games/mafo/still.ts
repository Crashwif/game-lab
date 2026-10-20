/**
 * The contraption on Junior's counter: Mamaw's turkey fryer on a burner stand, its lid bungeed down and duct-taped
 * at the seam, a canoe paddle stirring through a hole in the lid, a funnel, a jiggler valve, a pressure gauge on a
 * pipe (swapped for a bigger one every time it pins), a sight tube that shows the brew, a copper coil that drips
 * blue rock candy into a mason jar, the jugs, his beer, and the propane tank on the floor with its hose. The brew's
 * colour and glow, the pressure, the rattle, the steam and the jars all follow the displayed multiplier and the
 * round clock; none of it reads or changes the committed outcome.
 */
import { BEER, COIL, FAN, FUNNEL, GAUGE, JAR, JIGGLER, JUGS, KNOB, PIVOT, POT, STAND, TANK } from './layout';
import { blit, blob, box, ink, INK, label, limb, poly, sprite } from './ink';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

// ─── The brew ───────────────────────────────────────────────────────────────────────────────────────────────────
const BREW_STOPS: [t: number, r: number, g: number, b: number][] = [
  [0, 107, 79, 42],
  [0.25, 125, 143, 46],
  [0.42, 63, 174, 106],
  [0.55, 43, 179, 168],
  [0.67, 58, 140, 255],
  [0.82, 47, 107, 255],
  [1, 120, 214, 255],
];
/** The brew's colour at this tension: creek water through swamp and antifreeze to country blue. */
export function brewRgb(tension: number): [number, number, number] {
  const t = clamp(tension, 0, 1);
  for (let i = 1; i < BREW_STOPS.length; i += 1) {
    const [t1, r1, g1, b1] = BREW_STOPS[i]!;
    if (t <= t1) {
      const [t0, r0, g0, b0] = BREW_STOPS[i - 1]!;
      const u = (t - t0) / (t1 - t0);
      return [mix(r0, r1, u), mix(g0, g1, u), mix(b0, b1, u)];
    }
  }
  const last = BREW_STOPS[BREW_STOPS.length - 1]!;
  return [last[1], last[2], last[3]];
}
export const rgba = ([r, g, b]: readonly number[], a = 1): string => `rgba(${Math.round(r!)}, ${Math.round(g!)}, ${Math.round(b!)}, ${a})`;
/** How hard the brew glows: from about 2× it starts to light the room, and long rounds keep it climbing. */
export const glowAt = (tension: number, depth: number): number => clamp(smoothstep(0.45, 0.95, tension) * 0.75 + depth * 0.45, 0, 1.2);

// ─── Pressure, gauges and jars ──────────────────────────────────────────────────────────────────────────────────
export const psiAt = (multiplier: number): number => Math.round(15 * multiplier);
/** Each gauge reads ten times the last; the first is a tire gauge that tops out at 60. */
export const gaugeMax = (level: number): number => 60 * 10 ** level;
/** The gauge the multiplier calls for: a new one every time the last would pin (4×, 40×, 400×…). */
export const gaugeLevelAt = (multiplier: number): number => (multiplier < 4 ? 0 : Math.floor(Math.log10(multiplier / 4) + 1e-9) + 1);
/** Jars of blue rock candy, fractional: a little over two per doubling. */
export const jarsAt = (multiplier: number): number => Math.max(0, 2.2 * Math.log2(Math.max(1, multiplier)));
const GAUGE_NAMES = ['TIRE', 'WATER HEATER', 'SUBMARINE', 'NASA', 'VOLCANO', 'GOD'];
export const gaugeName = (level: number): string => GAUGE_NAMES[level] ?? `GOD ×${10 ** (level - GAUGE_NAMES.length + 1)}`;
const gaugeRadius = (level: number): number => 22 + 5 * Math.min(level, 5);
const short = (n: number): string => (n >= 1e9 ? `${Math.round(n / 1e9)}B` : n >= 1e6 ? `${Math.round(n / 1e6)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

// ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface StillDrive {
  time: number;
  tension: number;
  /** A slow driver for long rounds: 0 at 1×, 1 at 1,000×. */
  depth: number;
  multiplier: number;
  /** The round is running and nothing has gone wrong yet. */
  running: boolean;
  /** Choreography seconds since the crash, or −1. */
  crash: number;
  /** Junior's hand is on the paddle. */
  held: boolean;
}

interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; tint: number }

export interface Still {
  /** The burner: lit once the show starts; its level (turned up on cue) and a flare that dies away. */
  lit: boolean;
  flame: Spring;
  flare: number;
  /** The paddle's stir phase (integrated, so a change of rate never jumps) and its swing amplitude. */
  stir: number;
  amp: Spring;
  /** The jiggler's phase and the lid's rattle phase. */
  jiggle: number;
  rattle: number;
  /** The gauge on the pipe now, and seconds since it was mounted (for the pop) or yanked (for the old one's flight). */
  level: number;
  mounted: number;
  yanked: number;
  /** Whole jars finished, and the jar the drip is filling. */
  jars: number;
  puffs: Puff[];
  spawn: number;
  serial: number;
  events: { jar: boolean; jiggle: boolean; hiss: boolean; bubble: boolean };
}

export function createStill(): Still {
  return { lit: false, flame: spring(0), flare: 0, stir: 0, amp: spring(0.05), jiggle: 0, rattle: 0, level: 0, mounted: 99, yanked: 99, jars: 0, puffs: [], spawn: 0, serial: 0, events: { jar: false, jiggle: false, hiss: false, bubble: false } };
}

export function resetStill(s: Still): void {
  s.lit = false;
  settleSpring(s.flame, 0);
  s.flare = 0;
  s.stir = 0;
  settleSpring(s.amp, 0.05);
  s.jiggle = s.rattle = 0;
  s.level = 0;
  s.mounted = s.yanked = 99;
  s.jars = 0;
  s.puffs = [];
  s.spawn = 0;
}

/** The burner catches: a whump of flame that settles to a steady blue. */
export function ignite(s: Still): void {
  s.lit = true;
  s.flare = 1;
}
/** Junior cranks the knob: the flame jumps and stays a notch higher. */
export function turnUp(s: Still): void {
  s.flare = Math.max(s.flare, 0.8);
}
/** The old gauge comes off the pipe and flies over his shoulder. */
export function yankGauge(s: Still): void {
  s.yanked = 0;
}
/** The bigger gauge goes on. */
export function mountGauge(s: Still): void {
  s.level += 1;
  s.mounted = 0;
}

/** The flame the show calls for: off until lit, then up with the tension. */
const flameTarget = (s: Still, d: StillDrive): number => (!s.lit ? 0 : 0.55 + 0.45 * d.tension + 0.25 * d.depth);

/** Jumps into a round already under way: lit, the gauge and the jars the multiplier calls for, steam pre-rolled. */
export function settleStill(s: Still, d: StillDrive): void {
  const going = d.running || d.crash >= 0;
  s.lit = going;
  settleSpring(s.flame, flameTarget(s, d));
  s.level = going ? gaugeLevelAt(d.multiplier) : 0;
  s.jars = going ? Math.floor(jarsAt(d.multiplier)) : 0;
  settleSpring(s.amp, d.held ? 0.2 + 0.1 * d.tension : 0.05);
  s.puffs = [];
  if (going && d.crash < 0) for (let i = 0; i < 90; i += 1) stepPuffs(s, d, 1 / 30);
}

export function stepStill(s: Still, d: StillDrive, dt: number): void {
  s.events = { jar: false, jiggle: false, hiss: false, bubble: false };
  const frozen = d.crash >= 0;
  s.mounted += dt;
  s.yanked += dt;
  s.flare = Math.max(0, s.flare - dt * 1.4);
  stepSpring(s.flame, frozen ? s.flame.x : flameTarget(s, d), 3, 1, dt);
  if (frozen) return;
  // The paddle: a stir that quickens with the tension; let go, it wobbles to a stop on its own.
  stepSpring(s.amp, d.held && s.lit ? 0.2 + 0.1 * d.tension : 0.03, 5, 0.6, dt);
  s.stir += dt * Math.PI * 2 * (s.lit ? 0.45 + 1.1 * d.tension : 0.2);
  // The jiggler rocks faster with the pressure; each tip is a tick.
  if (s.lit && d.running) {
    const before = Math.floor(s.jiggle / Math.PI);
    s.jiggle += dt * Math.PI * 2 * (0.8 + 7 * d.tension);
    if (Math.floor(s.jiggle / Math.PI) > before) s.events.jiggle = true;
    s.rattle += dt * (14 + 26 * d.tension);
  }
  if (d.running && s.lit) {
    const jars = Math.floor(jarsAt(d.multiplier));
    if (jars > s.jars) {
      s.jars = jars;
      s.events.jar = true;
    }
  }
  stepPuffs(s, d, dt);
}

function stepPuffs(s: Still, d: StillDrive, dt: number): void {
  if (s.lit && d.crash < 0) {
    s.spawn += dt * (2 + 7 * d.tension + 3 * d.depth);
    while (s.spawn >= 1) {
      s.spawn -= 1;
      const r = mulberry32(++s.serial * 977 + 13);
      const where = r();
      // Steam leaks along the seam's right side and round the paddle; past 2× it jets, always away from his face.
      const jet = d.tension > 0.5 && r() < 0.2 + 0.25 * d.tension;
      let x = POT.x - 10 + where * (POT.rx + 6);
      let y = POT.rim - 6;
      if (where < 0.2) [x, y] = [PIVOT.x + 4, PIVOT.y - 4];
      if (jet) s.events.hiss = true;
      s.puffs.push({ x, y, vx: jet ? 110 + 120 * r() : 10 + 20 * r(), vy: jet ? -40 - 30 * r() : -45 - 25 * r(), r: 4 + 4 * r(), age: 0, life: 1.4 + 1.2 * r(), tint: r() });
      if (r() < 0.3) s.events.bubble = true;
    }
  }
  for (const p of s.puffs) {
    p.age += dt;
    // Rising, slowing, drawn toward the fan in the window as it climbs.
    const pull = smoothstep(220, 120, p.y);
    p.vx += ((FAN.x - p.x) * 0.9 * pull - p.vx * 0.9) * dt;
    p.vy += (-26 - p.vy) * 1.2 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r += dt * (9 + 6 * d.tension);
  }
  s.puffs = s.puffs.filter((p) => p.age < p.life && Math.hypot(p.x - FAN.x, p.y - FAN.y) > FAN.r * 0.6);
  if (s.puffs.length > 40) s.puffs.splice(0, s.puffs.length - 40);
}

// ─── The paddle ─────────────────────────────────────────────────────────────────────────────────────────────────
/** How far above the lid the paddle's shaft reaches, and where his hand grips it. */
const SHAFT = 150;
export const GRIP = 30;
/** The paddle's lean (side to side) and tip (toward the camera) at this moment; frozen at the crash. */
function paddleAngles(s: Still): { lean: number; tip: number } {
  const a = clamp(s.amp.x, 0, 0.4);
  return { lean: a * Math.sin(s.stir), tip: a * Math.cos(s.stir) };
}
/** A point `d` up the paddle's shaft from the pivot. */
export function paddleAt(s: Still, d: number): { x: number; y: number } {
  const { lean, tip } = paddleAngles(s);
  return { x: PIVOT.x + Math.sin(lean) * d, y: PIVOT.y - Math.cos(lean) * Math.cos(tip) * d };
}

// ─── Drawing ────────────────────────────────────────────────────────────────────────────────────────────────────
const ALU = '#c3c8cf';
const ALU_DARK = '#8b929b';
const COPPER = '#c9733a';
const TAPE = '#a7abb0';

function flames(ctx: CanvasRenderingContext2D, s: Still, d: StillDrive): void {
  const level = clamp(s.flame.x + s.flare * 0.9, 0, 2.2);
  if (level < 0.02) return;
  const t = d.time;
  const tallest = (16 + 22 * level) * 1.55;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, STAND.top + 6, 0, STAND.top + 6 - tallest);
  g.addColorStop(0, 'rgba(90, 150, 255, 0.9)');
  g.addColorStop(0.55, 'rgba(120, 190, 255, 0.55)');
  g.addColorStop(1, 'rgba(255, 220, 160, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const x = POT.x - POT.rx + 8 + i * ((POT.rx * 2 - 16) / 8);
    const lick = (16 + 22 * level) * (0.75 + 0.25 * Math.sin(t * 17 + i * 2.3) + 0.15 * noise(Math.floor(t * 20) + i * 7));
    const edge = i === 0 || i === 8 ? 1.4 : 1;
    ctx.moveTo(x - 6, STAND.top + 6);
    ctx.quadraticCurveTo(x - 4, STAND.top - lick * 0.5 * edge, x + Math.sin(t * 9 + i) * 3, STAND.top + 6 - lick * edge);
    ctx.quadraticCurveTo(x + 4, STAND.top - lick * 0.5 * edge, x + 6, STAND.top + 6);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

/** The burner stand: a ring on three legs, its knob, and the hose from the tank. */
function stand(ctx: CanvasRenderingContext2D, s: Still): void {
  ink(ctx, 4, '#2b2622');
  for (const dx of [-POT.rx + 6, 0, POT.rx - 6]) {
    ctx.beginPath();
    ctx.moveTo(POT.x + dx, STAND.top + 2);
    ctx.lineTo(POT.x + dx * 1.12, STAND.bottom);
    ctx.stroke();
  }
  box(ctx, POT.x - POT.rx - 6, STAND.top + 2, POT.rx * 2 + 12, 6, 2, '#3a332d', 2);
  // The knob on the regulator, turned up with the flame.
  blob(ctx, KNOB.x, KNOB.y, 7, 7, '#b0302a', 2);
  ctx.save();
  ctx.translate(KNOB.x, KNOB.y);
  ctx.rotate(-1.2 + 1.6 * clamp(s.flame.x, 0, 1.5));
  ink(ctx, 2.2, '#f4efe2');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -6);
  ctx.stroke();
  ctx.restore();
}

/** The hose from the tank's valve to the regulator: an outlined curve that sags. */
export function drawHose(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(from.x - 10, from.y - 60, to.x + 60, to.y + 70, to.x, to.y);
  ink(ctx, 9);
  ctx.stroke();
  ctx.strokeStyle = '#2c2c30';
  ctx.lineWidth = 5;
  ctx.stroke();
}

/** The gauge face at (x, y) with radius r, reading `f` of its range (above 1 it pins and shakes). */
export function drawGauge(ctx: CanvasRenderingContext2D, x: number, y: number, level: number, f: number, time: number, cracked = 0, scale = 1): void {
  const r = gaugeRadius(level) * scale;
  ctx.save();
  ctx.translate(x, y);
  blob(ctx, 0, 0, r + 4 * scale, r + 4 * scale, level >= 3 ? '#d6b04c' : '#5b6068', 2.5);
  blob(ctx, 0, 0, r, r, '#f8f4e8', 1.5);
  // The red zone and the ticks: a 270° sweep from bottom left to bottom right.
  const a0 = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  ctx.strokeStyle = '#d8423a';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, a0 + sweep * 0.78, a0 + sweep);
  ctx.stroke();
  ctx.strokeStyle = INK;
  for (const major of [false, true]) {
    ctx.lineWidth = major ? 1.6 * scale : 0.9 * scale;
    ctx.beginPath();
    for (let i = 0; i <= 10; i += 1) {
      if ((i % 5 === 0) !== major) continue;
      const a = a0 + (sweep * i) / 10;
      ctx.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
      ctx.lineTo(Math.cos(a) * r * (major ? 0.66 : 0.74), Math.sin(a) * r * (major ? 0.66 : 0.74));
    }
    ctx.stroke();
  }
  const max = gaugeMax(level);
  label(ctx, '0', Math.cos(a0) * r * 0.5, Math.sin(a0) * r * 0.5, 7 * scale * (r / 24), INK, 700);
  label(ctx, short(max), Math.cos(a0 + sweep) * r * 0.48, Math.sin(a0 + sweep) * r * 0.5, 7 * scale * (r / 24), INK, 700);
  label(ctx, 'PSI', 0, r * 0.32, 6 * (r / 24) * scale, '#6a6a70', 800);
  label(ctx, gaugeName(level), 0, r * 0.62, 5.2 * (r / 24) * scale, '#b0302a', 900, r * 1.4);
  // The needle: pinned past full, shaking against the stop.
  const pinned = f >= 1;
  const shake = pinned ? Math.sin(time * 61) * 0.05 + Math.sin(time * 37) * 0.03 : 0;
  const a = a0 + sweep * clamp(f, 0, 1.02) + shake;
  ink(ctx, 2.2 * scale, '#c5221b');
  ctx.beginPath();
  ctx.moveTo(-Math.cos(a) * r * 0.16, -Math.sin(a) * r * 0.16);
  ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
  ctx.stroke();
  blob(ctx, 0, 0, 2.6 * scale, 2.6 * scale, INK, 0);
  // The glass, and its crack.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.35, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
  if (cracked > 0) {
    ink(ctx, 1.2 * scale, 'rgba(30, 30, 40, 0.85)');
    const rng = mulberry32(77);
    for (let k = 0; k < 6; k += 1) {
      const ang = rng() * Math.PI * 2;
      const len = r * (0.4 + 0.6 * rng()) * clamp(cracked, 0, 1);
      ctx.beginPath();
      ctx.moveTo(r * 0.15, -r * 0.1);
      ctx.lineTo(r * 0.15 + Math.cos(ang) * len * 0.5 + (rng() - 0.5) * 4, -r * 0.1 + Math.sin(ang) * len * 0.5);
      ctx.lineTo(r * 0.15 + Math.cos(ang) * len, -r * 0.1 + Math.sin(ang) * len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The fraction of its range the mounted gauge reads; pinned (≥ 1) while a swap is due. */
const gaugeFraction = (s: Still, multiplier: number): number => psiAt(multiplier) / gaugeMax(s.level);

/**
 * The pot and everything on it: the flames under it, the stand, the body with the sight tube, the lid (bulging
 * and rattling with the pressure) with its bungees, tape, funnel, jiggler and gauge pipe, the coil, and the paddle's
 * shaft up out of the lid. The hand that grips the shaft is drawn over this by the rig.
 */
export function drawPot(ctx: CanvasRenderingContext2D, s: Still, d: StillDrive, multiplier: number, cracked: number): void {
  const t = d.time;
  const pressure = s.lit ? d.tension : 0;
  const brew = brewRgb(d.tension);
  const glow = s.lit ? glowAt(d.tension, d.depth) : 0;
  flames(ctx, s, d);
  stand(ctx, s);
  const top = POT.rim;
  blit(ctx, 'pot', POT.x - POT.rx - 4, top - 4, POT.rx * 2 + 8, POT.base - top + 14, potBody);
  // The sight tube: aquarium tubing taped on, showing the brew's level and colour.
  const tx = POT.x - 44;
  const level = 0.68 + 0.04 * Math.sin(t * 3) * pressure;
  ctx.fillStyle = rgba(brew, 0.95);
  ctx.fillRect(tx - 3, top + 12 + 62 * (1 - level), 6, 62 * level);
  if (glow > 0.05) {
    ctx.fillStyle = `rgba(200, 240, 255, ${0.5 * glow})`;
    ctx.fillRect(tx - 1, top + 14 + 62 * (1 - level), 2, 60 * level);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  for (let i = 0; i < 3; i += 1) {
    const by = top + 74 - fractionOf(t * (0.6 + 1.8 * pressure) + i / 3) * 56 * level;
    ctx.moveTo(tx + Math.sin(t * 5 + i) * 1.2 + 1.4, by);
    ctx.arc(tx + Math.sin(t * 5 + i) * 1.2, by, 1.4, 0, Math.PI * 2);
  }
  ctx.fill();
  for (const y of [top + 14, top + 70]) box(ctx, tx - 9, y - 4, 18, 8, 1.5, TAPE, 1.5);
  drawLid(ctx, s, d, multiplier, cracked, brew, glow, pressure);
}

/** The pot's body: aluminium, scorched at the base, MAMAW'S in marker, the sight tube's empty glass. */
function potBody(ctx: CanvasRenderingContext2D): void {
  const top = POT.rim;
  const g = ctx.createLinearGradient(POT.x - POT.rx, 0, POT.x + POT.rx, 0);
  g.addColorStop(0, '#9aa1aa');
  g.addColorStop(0.35, '#e3e6ea');
  g.addColorStop(0.7, ALU);
  g.addColorStop(1, '#7d848d');
  ctx.fillStyle = g;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(POT.x - POT.rx, top);
  ctx.lineTo(POT.x - POT.rx + 2, POT.base - 6);
  ctx.quadraticCurveTo(POT.x, POT.base + 6, POT.x + POT.rx - 2, POT.base - 6);
  ctx.lineTo(POT.x + POT.rx, top);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(40, 30, 20, 0.35)';
  ctx.beginPath();
  ctx.ellipse(POT.x, POT.base - 8, POT.rx - 4, 12, 0, 0, Math.PI);
  ctx.fill();
  // MAMAW'S in marker on the side.
  label(ctx, "MAMAW'S", POT.x + 22, top + 42, 11, '#2a2a33', 900);
  label(ctx, 'DO NOT TOUCH', POT.x + 22, top + 56, 7, '#2a2a33', 800);
  box(ctx, POT.x - 49, top + 10, 10, 66, 5, 'rgba(230, 240, 255, 0.5)', 1.8);
}

/** The lid and everything on it, the coil, the gauge and the paddle: all of it moves. */
function drawLid(ctx: CanvasRenderingContext2D, s: Still, d: StillDrive, multiplier: number, cracked: number, brew: [number, number, number], glow: number, pressure: number): void {
  const t = d.time;
  const top = POT.rim;
  // The lid: domed with the pressure, rattling, bungeed to the stand's legs.
  const rattle = s.lit && d.running ? Math.sin(s.rattle) * (0.4 + 2.6 * pressure * pressure) : 0;
  const dome = 6 + 12 * pressure + 4 * d.depth;
  const ly = top - 4 + rattle;
  // Bungee cords: hook on the handle, hook on the leg, thinner as they stretch.
  for (const side of [-1, 1]) {
    const hx = POT.x + side * (POT.rx + 10);
    const stretch = 1 + 0.5 * pressure;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, ly + 2);
    ctx.quadraticCurveTo(hx + side * 10, (ly + STAND.top) / 2, POT.x + side * (POT.rx - 4), STAND.top + 6);
    ink(ctx, 6 / stretch + 2);
    ctx.stroke();
    ctx.strokeStyle = side < 0 ? '#e0402e' : '#2f7fe0';
    ctx.lineWidth = 6 / stretch;
    ctx.stroke();
  }
  // Seam glow: the brew lights the gap under the lid.
  if (glow > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(brew, 0.7 * glow);
    ctx.beginPath();
    ctx.ellipse(POT.x, top, POT.rx + 6, 5 + 3 * glow, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = ALU;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(POT.x - POT.rx - 6, ly);
  ctx.quadraticCurveTo(POT.x, ly - dome * 2, POT.x + POT.rx + 6, ly);
  ctx.quadraticCurveTo(POT.x, ly + 7, POT.x - POT.rx - 6, ly);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Handles, and duct tape across the seam.
  for (const side of [-1, 1]) box(ctx, POT.x + side * (POT.rx + 6) - 6, ly - 3, 12, 6, 3, ALU_DARK, 2);
  for (const dx of [-48, -8, 36]) {
    ctx.save();
    ctx.translate(POT.x + dx, ly + 2);
    ctx.rotate(0.12);
    box(ctx, -7, -9, 14, 18, 1.5, TAPE, 1.5);
    ctx.restore();
  }
  // The funnel, the jiggler on its nozzle, the gauge pipe.
  // The funnel, taped low on the pot's side, its hose into the bottom.
  limb(ctx, [{ x: FUNNEL.x, y: FUNNEL.y + 12 }, { x: FUNNEL.x + 8, y: FUNNEL.y + 22 }, { x: POT.x - POT.rx + 4, y: FUNNEL.y + 14 }], 5, '#d8d0b0', 1.8);
  poly(ctx, [FUNNEL.x - 15, FUNNEL.y - 16, FUNNEL.x + 15, FUNNEL.y - 16, FUNNEL.x + 3, FUNNEL.y + 2, FUNNEL.x + 3, FUNNEL.y + 14, FUNNEL.x - 3, FUNNEL.y + 14, FUNNEL.x - 3, FUNNEL.y + 2], '#e9d24a', 2);
  box(ctx, FUNNEL.x - 8, FUNNEL.y + 2, 16, 8, 1.5, TAPE, 1.4);
  ctx.save();
  ctx.translate(JIGGLER.x, JIGGLER.y - dome * 0.9 + rattle);
  box(ctx, -2.5, -8, 5, 9, 1, ALU_DARK, 1.5);
  ctx.rotate(s.lit && d.running ? Math.sin(s.jiggle) * (0.15 + 0.4 * pressure) : 0);
  box(ctx, -6, -16, 12, 9, 3, '#3a3d44', 1.8);
  ctx.restore();
  box(ctx, GAUGE.x - 3, GAUGE.y + 8, 6, GAUGE.pipe - GAUGE.y - 6 - dome * 0.6 + rattle, 1, ALU_DARK, 1.8);
  box(ctx, GAUGE.x - 7, GAUGE.y + 22, 14, 7, 1.5, TAPE, 1.5);

  // The coil: copper from the pot's shoulder, three turns down to the spout over the jar.
  coil(ctx, glow, brew, t, pressure, s.lit && d.crash < 0);

  // The gauge: the old one tumbling away after a yank, the new one popping on.
  const pop = s.mounted < 0.5 ? 1 + 0.35 * Math.sin(s.mounted * 18) * Math.exp(-s.mounted * 7) : 1;
  const shown = s.yanked < s.mounted ? null : s.level;
  if (shown !== null) drawGauge(ctx, GAUGE.x, GAUGE.y + rattle - dome * 0.6, shown, gaugeFraction(s, multiplier), t, cracked, pop);
  if (s.yanked < 1.2 && s.level >= 0) {
    // Over his shoulder: up and back to the left, spinning.
    const u = s.yanked;
    const gx = GAUGE.x - 260 * u;
    const gy = GAUGE.y - 160 * u + 420 * u * u;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(-u * 9);
    drawGauge(ctx, 0, 0, Math.max(0, s.level - (s.yanked < s.mounted ? 0 : 1)), 1.02, t, 0, 0.9);
    ctx.restore();
  }

  // The paddle: the shaft up out of the hole in the lid, a strip of tape round the hole.
  const top2 = paddleAt(s, SHAFT);
  const base = paddleAt(s, -10);
  limb(ctx, [base, top2], 9, '#c79a5c', 2.2);
  const grip = paddleAt(s, SHAFT + 16);
  limb(ctx, [top2, grip], 13, '#b88848', 2.2);
  box(ctx, PIVOT.x - 11, PIVOT.y - 4 - dome * 0.5 + rattle, 22, 8, 2, TAPE, 1.6);
}

const fractionOf = (v: number): number => v - Math.floor(v);

function coil(ctx: CanvasRenderingContext2D, glow: number, brew: [number, number, number], t: number, pressure: number, dripping: boolean): void {
  const pts: { x: number; y: number }[] = [];
  const x0 = COIL.from.x;
  const y0 = COIL.from.y;
  for (let i = 0; i <= 48; i += 1) {
    const u = i / 48;
    const turn = u * Math.PI * 2 * 3;
    const cx = mix(x0 + 30, COIL.spout.x + 4, u);
    const cy = mix(y0 - 4, COIL.spout.y - 14, u);
    pts.push({ x: cx + Math.cos(turn) * 16 * smoothstep(0, 0.12, u) * (1 - smoothstep(0.88, 1, u)), y: cy + Math.sin(turn) * 6 });
  }
  limb(ctx, [{ x: x0, y: y0 }, { x: x0 + 18, y: y0 - 6 }, pts[0]!], 5, COPPER, 2);
  limb(ctx, pts, 5, COPPER, 2);
  limb(ctx, [pts[pts.length - 1]!, { x: COIL.spout.x, y: COIL.spout.y }], 5, COPPER, 2);
  // Highlights.
  ctx.strokeStyle = 'rgba(255, 210, 160, 0.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!;
    if (i === 0) ctx.moveTo(p.x - 1, p.y - 1.5);
    else ctx.lineTo(p.x - 1, p.y - 1.5);
  }
  ctx.stroke();
  // The drip: blue drops from the spout into the jar, faster with the pressure.
  if (dripping) {
    const rate = 0.8 + 3.5 * pressure;
    for (let k = 0; k < 2; k += 1) {
      const u = fractionOf(t * rate + k * 0.5);
      const y = COIL.spout.y + 4 + u * (JAR.base - JAR.h * 0.3 - COIL.spout.y);
      blob(ctx, COIL.spout.x, y, 2.2, 3 + 2 * u, rgba(brew, 0.95), 1);
    }
  }
  if (glow > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(brew, 0.25 * glow);
    ctx.beginPath();
    ctx.arc(COIL.spout.x, COIL.spout.y + 20, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** A mason jar at (x, base) filled `fill` with blue rock candy that glows with the brew. */
function drawJarAt(ctx: CanvasRenderingContext2D, x: number, base: number, fill: number, glow: number, w: number = JAR.w, h: number = JAR.h): void {
  const top = base - h;
  // The candy: little blue rocks stacked to the fill line.
  if (fill > 0.01) {
    const level = base - 4 - (h - 12) * clamp(fill, 0, 1);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 3, top + 6, w - 6, h - 9, 5);
    ctx.clip();
    ctx.fillStyle = '#3d8cff';
    ctx.fillRect(x - w / 2, level, w, base - level);
    // The rocks, as two batched paths (light and dark facets).
    const rng = mulberry32(Math.round(x * 13));
    const facets: [Path2D | null, Path2D | null] = typeof Path2D === 'undefined' ? [null, null] : [new Path2D(), new Path2D()];
    for (let i = 0; i < 18; i += 1) {
      const cx = x - w / 2 + 4 + rng() * (w - 8);
      const cy = level + 3 + rng() * Math.max(1, base - level - 6);
      const p = facets[rng() < 0.5 ? 0 : 1];
      if (!p) continue;
      p.moveTo(cx, cy - 3);
      p.lineTo(cx + 3, cy);
      p.lineTo(cx, cy + 3);
      p.lineTo(cx - 3, cy);
      p.closePath();
    }
    if (facets[0] && facets[1]) {
      ctx.fillStyle = '#9fe0ff';
      ctx.fill(facets[0]);
      ctx.fillStyle = '#1f5fd6';
      ctx.fill(facets[1]);
    }
    if (glow > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(110, 200, 255, ${0.35 * glow})`;
      ctx.fillRect(x - w / 2, level, w, base - level);
    }
    ctx.restore();
  }
  // The glass and its lid ring.
  ctx.fillStyle = 'rgba(220, 240, 255, 0.18)';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top + 4, w, h - 4, 7);
  ctx.fill();
  ctx.stroke();
  box(ctx, x - w / 2 + 3, top, w - 6, 7, 2, '#c8b55a', 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x - w / 2 + 5, top + 10, 3, h - 20);
}

/** A finished jar on the shelf: painted once, stamped wherever one stands. */
export function drawShelfJar(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number): void {
  const made = sprite(ctx, `jar-${w}x${h}`, -w / 2 - 3, -h - 3, w + 6, h + 6, (g) => drawJarAt(g, 0, 0, 1, 0, w, h));
  if (made) ctx.drawImage(made.canvas, x - w / 2 - 3, base - h - 3, w + 6, h + 6);
  else drawJarAt(ctx, x, base, 1, 0, w, h);
}

/** The jar under the drip, filling toward the next one. */
export function drawJar(ctx: CanvasRenderingContext2D, s: Still, d: StillDrive): void {
  const fill = s.lit ? fractionOf(jarsAt(d.multiplier)) : 0;
  drawJarAt(ctx, JAR.x, JAR.base, fill, glowAt(d.tension, d.depth));
}

export type JugKind = 'xxx' | 'mystery';
/** The jug's mouth relative to its handle (a loop on its left shoulder), before any tilt. */
const MOUTH = { x: 18, y: -12 } as const;
/**
 * A jug drawn from the handle on its left shoulder at (x, y), tilted by `tilt` radians (positive pours to the
 * right): the body hangs right of and below the handle, so a pour keeps the jug in front of his chest.
 */
export function drawJug(ctx: CanvasRenderingContext2D, kind: JugKind, x: number, y: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const fill = kind === 'xxx' ? '#e9e1c9' : '#6a8f3b';
  // Body.
  ctx.fillStyle = fill;
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(12, -4);
  ctx.quadraticCurveTo(-4, 6, -2, 30);
  ctx.lineTo(-2, 52);
  ctx.quadraticCurveTo(18, 61, 38, 52);
  ctx.lineTo(38, 30);
  ctx.quadraticCurveTo(40, 6, 24, -4);
  ctx.lineTo(24, -10);
  ctx.lineTo(12, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The finger loop on the shoulder, and the cork.
  ink(ctx, 3.2);
  ctx.beginPath();
  ctx.arc(4, 4, 6.5, Math.PI * 0.75, Math.PI * 2.05);
  ctx.stroke();
  box(ctx, 13, -17, 10, 8, 2, '#a6773f', 1.6);
  if (kind === 'xxx') label(ctx, 'XXX', 18, 32, 13, '#2a2a2a', 900);
  else {
    box(ctx, 4, 22, 28, 20, 2, '#f1e8c8', 1.4);
    label(ctx, '???', 18, 30, 9, '#6a2a2a', 900);
    label(ctx, 'MYSTERY', 18, 38, 5, '#2a2a2a', 900);
  }
  ctx.restore();
}
/** Where a jug's mouth is, held by its handle at (x, y) with `tilt`. */
export function spoutOf(x: number, y: number, tilt: number): { x: number; y: number } {
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  return { x: x + MOUTH.x * c - MOUTH.y * sn, y: y + MOUTH.x * sn + MOUTH.y * c };
}
/** Where the hand must be for the jug's mouth to sit at `mouth` with `tilt`. */
export function handForSpout(mouth: { x: number; y: number }, tilt: number): { x: number; y: number } {
  const at = spoutOf(0, 0, tilt);
  return { x: mouth.x - at.x, y: mouth.y - at.y };
}
/** Where each jug's handle is as it stands on the counter. */
export const jugHome = (kind: JugKind): { x: number; y: number } => ({ x: JUGS[kind].x - 18, y: JUGS[kind].y - 54 });

/** His beer: a can in a camo koozie, its centre at (x, y), tilted. */
export function drawBeerCan(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);
  box(ctx, -8, -15, 16, 30, 3, '#c9cdd2', 2);
  box(ctx, -9, -8, 18, 22, 3, '#59633a', 2);
  for (const [bx, by] of [[-5, -3], [3, 4], [-3, 9]] as const) blob(ctx, bx, by, 3, 2, '#3d4426', 0);
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(-6, -14, 12, 2);
  ctx.restore();
}
export const BEER_HOME = { x: BEER.x, y: BEER.y - 15 } as const;

/** The propane tank: white, rusty at the foot, a frost line that climbs with the draw, the valve and its collar. */
export function drawTank(ctx: CanvasRenderingContext2D, x: number, base: number, frost: number, angle = 0, flame = 0): void {
  const h = TANK.base - TANK.top;
  const r = TANK.r;
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(angle);
  if (flame > 0.01) {
    // The valve has gone: a jet out of the top.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -h - 10, 0, -h - 10 - 160 * flame);
    g.addColorStop(0, 'rgba(255, 250, 220, 0.95)');
    g.addColorStop(0.3, 'rgba(120, 190, 255, 0.85)');
    g.addColorStop(1, 'rgba(60, 90, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-9, -h - 8);
    ctx.quadraticCurveTo(0, -h - 10 - 200 * flame, 9, -h - 8);
    ctx.fill();
    ctx.restore();
  }
  // Foot ring.
  box(ctx, -r + 6, -12, r * 2 - 12, 12, 3, '#c9c4b8', 2);
  // Body.
  ctx.fillStyle = '#f2efe6';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-r, -12);
  ctx.lineTo(-r, -h + r * 0.8);
  ctx.quadraticCurveTo(-r, -h + 6, 0, -h + 6);
  ctx.quadraticCurveTo(r, -h + 6, r, -h + r * 0.8);
  ctx.lineTo(r, -12);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Frost from the foot up, and rust.
  if (frost > 0.02) {
    ctx.fillStyle = 'rgba(220, 240, 255, 0.85)';
    const fy = -12 - (h - 30) * clamp(frost, 0, 1);
    ctx.beginPath();
    ctx.moveTo(-r, -12);
    for (let i = 0; i <= 8; i += 1) ctx.lineTo(-r + (i * 2 * r) / 8, fy + Math.sin(i * 2.1) * 3);
    ctx.lineTo(r, -12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(150, 80, 30, 0.35)';
  ctx.fillRect(-r, -30, r * 2, 18);
  ctx.restore();
  ctx.stroke();
  // The weld seam and the label.
  ink(ctx, 1.5, 'rgba(0,0,0,0.3)');
  ctx.beginPath();
  ctx.moveTo(-r, -h / 2);
  ctx.lineTo(r, -h / 2);
  ctx.stroke();
  box(ctx, -r + 8, -h / 2 + 8, r * 2 - 16, 24, 2, '#d8423a', 1.5);
  label(ctx, 'FLAMMABLE', 0, -h / 2 + 16, 8, '#fff', 900, r * 2 - 20);
  label(ctx, 'NO SMOKING', 0, -h / 2 + 26, 6, '#fff', 800, r * 2 - 20);
  // Collar and valve.
  poly(ctx, [-r * 0.7, -h + 10, -r * 0.6, -h - 10, r * 0.6, -h - 10, r * 0.7, -h + 10], '#e4ded0', 2);
  if (flame <= 0.01) {
    box(ctx, -5, -h - 18, 10, 12, 2, '#b8a14a', 1.8);
    blob(ctx, 0, -h - 20, 9, 4, '#3c7ed6', 1.8);
  }
  ctx.restore();
}
/** The tank's valve in the world, where the hose leaves it. */
export const TANK_VALVE = { x: TANK.x + 6, y: TANK.top - 10 } as const;
/** How far the frost has climbed: the faster the draw, the higher. */
export const frostAt = (tension: number, lit: boolean): number => (lit ? smoothstep(0.2, 0.95, tension) * 0.85 : 0);

/** The steam, tinted by the brew: drawn over the pot and the wall, sucked toward the fan. */
export function drawSteam(ctx: CanvasRenderingContext2D, s: Still, d: StillDrive): void {
  const brew = brewRgb(d.tension);
  for (const p of s.puffs) {
    const u = p.age / p.life;
    const a = (u < 0.15 ? u / 0.15 : 1 - smoothstep(0.35, 1, u)) * (0.2 + 0.14 * d.tension);
    const tint = 0.35 + 0.5 * p.tint * d.tension;
    const c: [number, number, number] = [mix(235, brew[0], tint), mix(238, brew[1], tint), mix(240, brew[2], tint)];
    ctx.fillStyle = rgba(c, a);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

