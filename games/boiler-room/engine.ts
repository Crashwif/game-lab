/**
 * The boiler and the engine it drives. The crank turns at a speed set by the
 * multiplier; an exact slider-crank moves the crosshead and piston, the
 * flywheel runs a belt to a fan, and a flyball governor lifts its weights as
 * the speed rises. Pressure moves the gauge, feeds the fire, flutters the
 * safety valve, pops rivets into leaks at milestones, groans in fake-outs,
 * prints a banknote or more on every chuff, and at the crash blows the valve
 * clean off.
 */
import { type Spring, clamp, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type Particles, TAGS, emit, puff, sparks } from './particles';

export const FLOOR_Y = 470;
const INK = '#1c1f26';
const IRON = '#4b4f5a';
const IRON_DARK = '#33363f';
const IRON_LIGHT = '#6a6f7a';
const BRASS = '#c9a44a';
const BRASS_DARK = '#8f6f23';
const PLATE_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The maker's plate: on the first barrel panel, clear of the seams, the gauge and the leak spots. */
const PLATE = { x: 346, y: 188, w: 66, h: 40 };

/** Multipliers at which another seam gives way; past the last, one more every ×1.6, re-bursting the old seams. */
export const LEAK_AT = [1.5, 1.9, 2.4, 3.1, 4.2, 6, 9];
/** Multipliers at which the boiler groans, spikes the needle and settles again: fake-outs keyed to the multiplier only. */
export const SCARE_AT = [1.8, 2.7, 3.9, 5.8, 8.8];
const LEAK_SPOTS = [
  { x: 340, y: 176, dx: 0.2, dy: -1 }, { x: 420, y: 324, dx: -0.3, dy: 1 }, { x: 500, y: 176, dx: -0.2, dy: -1 },
  { x: 580, y: 324, dx: 0.4, dy: 1 }, { x: 268, y: 250, dx: -1, dy: -0.2 }, { x: 642, y: 250, dx: 1, dy: -0.3 }, { x: 460, y: 176, dx: 0, dy: -1 },
];
export const DOME = { x: 560, y: 175 };
export const VALVE = { x: 560, y: 128 };
export const DOOR = { x: 336, y: 405 };
const CRANK = { x: 885, y: 395 };
const CRANK_R = 38;
const ROD = 150;
const GUIDE_Y = 310;
const TAU = Math.PI * 2;
/** Crank angles of the dead centres. The guide line runs 85 px above the crank, so they fall at 49° and 207°, not 0° and 180°. */
const DEAD = [0.862, 3.611];
/** The exhaust stack's mouth, where the chuffs and the printed money come out. */
const STACK = { x: 612, y: 258 };
const FAN = { x: 860, y: 120, r: 20 };
const GOVERNOR = { x: 660, y: 218 };

export interface EngineDrive {
  running: boolean;
  crashed: boolean;
  /** 0..1 boiler pressure the multiplier calls for. */
  pressure: number;
  multiplier: number;
  /** The crash has been called and the valve is about to go: needle slammed, valve chattering. */
  fuse: boolean;
}

export interface EngineState {
  time: number;
  theta: number;
  omega: number;
  pressure: number;
  needle: Spring;
  flame: number;
  leaks: number;
  valve: Spring;
  lamp: Spring;
  blown: boolean;
  blowAge: number;
  smokeClock: number;
  leakClock: number;
  emberClock: number;
  /** Whether a round is on (running, or crashing until the valve goes), and its multiplier: the patches and the gauge's cracks follow them. */
  live: boolean;
  multiplier: number;
  /** The valve's flutter phase, integrated so its rate can follow the pressure. */
  chatter: number;
  ventClock: number;
  /** Banknotes owed to the next chuff. */
  notes: number;
  scares: number;
  /** The latest scare, decaying from 1. */
  scare: number;
  /** The new valve cap dropping into its seat after a blow-out, from 1 to 0. */
  capDrop: number;
  /** Belt dash offset, integrated at a speed capped below what the frame rate can show. */
  belt: number;
  /** A smoothed frame time, for blurring what turns too fast to show. */
  frame: number;
  events: { reversal: boolean; leak: number; scare: boolean };
}

export function createEngine(): EngineState {
  return {
    time: 0, theta: 0, omega: 0, pressure: 0, needle: spring(0), flame: 0.15, leaks: 0, valve: spring(0), lamp: spring(0), blown: false, blowAge: 0, smokeClock: 0, leakClock: 0, emberClock: 0,
    live: false, multiplier: 1, chatter: 0, ventClock: 0, notes: 0, scares: 0, scare: 0, capDrop: 0, belt: 0, frame: 1 / 60, events: { reversal: false, leak: -1, scare: false },
  };
}

/** How many seams have given at a multiplier: the listed ones, then one more every ×1.6 so long rounds keep popping. */
export function leakCount(multiplier: number): number {
  const n = LEAK_AT.filter((m) => multiplier >= m).length;
  return n < LEAK_AT.length ? n : n + Math.floor(Math.log(multiplier / LEAK_AT[n - 1]!) / Math.log(1.6));
}

/** Dead centres passed by a crank angle: each one is a piston reversal and a chuff. */
function strokes(theta: number): number {
  const turn = Math.floor(theta / TAU);
  const a = theta - turn * TAU;
  return turn * 2 + (a >= DEAD[0]! ? 1 : 0) + (a >= DEAD[1]! ? 1 : 0);
}

export function resetEngine(e: EngineState): void {
  e.pressure = 0;
  settleSpring(e.needle, 0);
  e.flame = 0.15;
  e.leaks = 0;
  e.scares = 0;
  e.scare = 0;
  e.notes = 0;
  settleSpring(e.valve, 0);
  // A blown valve gets a new cap, dropped into its seat rather than popping back.
  if (e.blown) e.capDrop = 1;
  e.blown = false;
  e.blowAge = 0;
}

/** Jumps to the running state a late joiner would see. */
export function settleEngine(e: EngineState, drive: EngineDrive): void {
  e.pressure = drive.pressure;
  settleSpring(e.needle, drive.pressure);
  e.omega = targetOmega(drive);
  e.live = drive.running || drive.crashed;
  e.multiplier = drive.multiplier;
  e.leaks = drive.running ? leakCount(drive.multiplier) : 0;
  e.scares = drive.running ? SCARE_AT.filter((m) => drive.multiplier >= m).length : 0;
  e.flame = drive.running ? 0.35 + 0.65 * drive.pressure : 0.15;
  settleSpring(e.valve, smoothstep(0.25, 0.75, drive.pressure));
}

function targetOmega(drive: EngineDrive): number {
  if (drive.crashed) return 0;
  if (!drive.running) return 1.1;
  const growth = Math.log2(Math.max(1, drive.multiplier));
  return Math.PI * 2 * (0.6 + 2.8 * (1 - Math.exp(-growth / 2)));
}

export function stepEngine(e: EngineState, drive: EngineDrive, ps: Particles, dt: number): void {
  e.time += dt;
  e.live = drive.running || drive.crashed;
  e.multiplier = drive.multiplier;
  if (dt > 0) e.frame += (dt - e.frame) * (1 - Math.exp(-dt / 0.25));
  e.events.reversal = false;
  e.events.leak = -1;
  e.events.scare = false;
  const tau = drive.crashed ? 2.4 : 1.2;
  e.omega += (targetOmega(drive) - e.omega) * (1 - Math.exp(-dt / tau));
  const before = strokes(e.theta);
  e.theta += e.omega * dt;
  // The belt's dashes run at surface speed until a frame could carry them half a gap, then hold there.
  e.belt = (e.belt + Math.min(e.omega * 68, 12 / Math.max(1 / 240, e.frame)) * dt) % 28;
  const after = strokes(e.theta);
  if (after > before) {
    e.events.reversal = true;
    // Exhaust: a chuff of steam out of the cylinder's stack at each dead centre.
    const strength = drive.running ? 0.5 + e.pressure : 0.3;
    puff(ps, STACK.x, 272, -0.25, -1, 90 * strength, 3 + Math.round(3 * strength), 7 + 6 * strength, 0.9, 1, e.theta * 10);
    e.lamp.v += (after % 2 ? 1 : -1) * 0.12 * e.pressure * e.pressure;
    // The money printer prints: a banknote a chuff at the start, more as the multiplier doubles.
    if (drive.running && !e.blown) {
      e.notes += Math.min(8, 1 + 1.2 * Math.log2(Math.max(1, drive.multiplier)));
      for (let i = 0; e.notes >= 1; i += 1) {
        e.notes -= 1;
        const n = e.theta * 7.3 + i * 3.1;
        emit(ps, { kind: 'note', layer: 1, x: STACK.x + (noise(n) - 0.5) * 10, y: STACK.y, vx: -30 + (noise(n + 1) - 0.5) * 170, vy: -230 - noise(n + 2) * 150, r: 1, life: 1.7 + noise(n + 3) * 0.6, angle: (noise(n + 4) - 0.5) * 1.6, spin: (noise(n + 5) - 0.5) * 7, tone: noise(n + 6) });
      }
    }
  }
  const relief = e.time > 45 && drive.running ? Math.pow(Math.max(0, Math.sin((e.time - 45) * Math.PI / 18)), 4) : 0;
  const pressureTarget = e.blown ? 0 : drive.pressure * (1 - relief * 0.24);
  e.pressure += (pressureTarget - e.pressure) * (1 - Math.exp(-dt / (e.blown ? 0.45 : 0.6)));
  e.scare *= Math.exp(-dt / 0.35);
  // The fuse slams the needle past the stop; otherwise it follows the pressure, kicked up by a scare.
  if (drive.fuse && !e.blown) stepSpring(e.needle, 1.12, 34, 0.45, dt);
  else stepSpring(e.needle, e.pressure + 0.2 * e.scare, e.blown ? 3 : 6, e.blown ? 0.3 : 0.8, dt);
  e.flame += ((drive.running ? 0.35 + 0.65 * e.pressure : e.blown ? 0.05 : 0.15) - e.flame) * (1 - Math.exp(-dt / 0.8));
  // The safety valve starts to flutter from about 1.33× and lifts fully by 4×, chattering faster as the pressure climbs.
  e.chatter += dt * (14 + 36 * e.pressure + (drive.fuse ? 50 : 0));
  stepSpring(e.valve, e.blown ? 0 : drive.fuse ? 1.4 : smoothstep(0.25, 0.75, e.pressure) + 0.7 * e.scare, 8, 0.7, dt);
  stepSpring(e.lamp, 0, 4, 0.08, dt);
  e.capDrop = Math.max(0, e.capDrop - dt / 0.35);

  if (drive.running && !e.blown) {
    const count = leakCount(drive.multiplier);
    if (count > e.leaks) {
      e.events.leak = e.leaks;
      const spot = LEAK_SPOTS[e.leaks % LEAK_SPOTS.length]!;
      emit(ps, { kind: 'rivet', layer: 1, x: spot.x, y: spot.y, vx: spot.dx * 260 + (noise(e.leaks) - 0.5) * 120, vy: spot.dy * 260 - 120, r: 3.5, life: 3, angle: 0, spin: 12, tone: 0 });
      sparks(ps, spot.x, spot.y, 8, 220, e.leaks * 9);
      puff(ps, spot.x, spot.y, spot.dx, spot.dy, 220, 10, 9, 0.8, 1, e.leaks * 31);
      // The seam hisses a word as it goes.
      emit(ps, { kind: 'tag', layer: 1, x: clamp(spot.x + spot.dx * 34, 300, 640), y: spot.y + (spot.dy < 0 ? -22 : 22), vx: spot.dx * 30, vy: -35, r: 22, life: 1.4, angle: (noise(e.leaks * 3) - 0.5) * 0.3, spin: 0, tone: e.leaks % TAGS.length });
      e.leaks = count;
    }
    const scares = SCARE_AT.filter((m) => drive.multiplier >= m).length;
    if (scares > e.scares) {
      // A groan: the needle jumps, the valve spits, the lamp swings, and then it all settles. Probably nothing.
      e.scares = scares;
      e.scare = 1;
      e.events.scare = true;
      e.needle.v += 1.6;
      e.lamp.v += 0.25;
      puff(ps, VALVE.x, VALVE.y - 14, 0, -1, 420, 8, 12, 0.9, 1, scares * 17);
    }
  }
  // Leaks hiss steadily, harder at a seam that has burst again.
  e.leakClock += dt;
  while (e.leakClock > 0.05) {
    e.leakClock -= 0.05;
    for (let i = 0; i < Math.min(e.leaks, LEAK_SPOTS.length) && !e.blown; i += 1) {
      if (e.time > 45 && i === Math.floor((e.time - 45) / 18) % LEAK_SPOTS.length && relief > 0.2) continue;
      const spot = LEAK_SPOTS[i]!;
      const hard = 1 + 0.35 * Math.min(3, Math.floor((e.leaks - 1 - i) / LEAK_SPOTS.length));
      puff(ps, spot.x, spot.y, spot.dx, spot.dy, (150 + 120 * e.pressure) * hard, 1, (4 + 4 * e.pressure) * hard, 0.55, 1, e.time * 97 + i * 13);
    }
    if (e.blown && e.blowAge < 3.2) {
      const k = 1 - e.blowAge / 3.2;
      puff(ps, DOME.x, DOME.y - 20, (noise(e.time * 71) - 0.5) * 0.6, -1, 420 * k + 80, 2, 22 + 30 * k, 2.2, e.blowAge < 1.2 ? 1 : 0, e.time * 89);
      puff(ps, 640, 150, 1, -0.3, 300 * k + 60, 1, 14, 1.6, 1, e.time * 41);
    }
  }
  // The valve vents in puffs as often as it is open.
  if (!e.blown && e.valve.x > 0.04) {
    e.ventClock += dt * (3 + 26 * Math.min(1.4, e.valve.x));
    for (let i = 0; e.ventClock >= 1; i += 1) {
      e.ventClock -= 1;
      const v = Math.min(1.4, e.valve.x);
      puff(ps, VALVE.x, VALVE.y - 12 - valveLift(e), 0, -1, 200 + 200 * v, 1, 5 + 9 * v, 0.8, 1, e.time * 53 + i * 5);
    }
  }
  // Chimney smoke thickens with the fire; embers drift from the door.
  e.smokeClock += dt;
  const smokeEvery = 0.16 / (0.35 + e.flame);
  while (e.smokeClock > smokeEvery) {
    e.smokeClock -= smokeEvery;
    emit(ps, { kind: 'smoke', layer: 1, x: 313 + (noise(e.time * 13) - 0.5) * 14, y: 66, vx: -10 - noise(e.time * 7) * 25, vy: -45 - 40 * e.flame, r: 9 + 8 * e.flame, life: 2.4, angle: 0, spin: 0, tone: noise(e.time * 3) });
  }
  e.emberClock += dt;
  const emberEvery = 0.5 / (0.2 + e.flame * 2);
  while (e.emberClock > emberEvery) {
    e.emberClock -= emberEvery;
    emit(ps, { kind: 'ember', layer: 1, x: DOOR.x + (noise(e.time * 17) - 0.5) * 40, y: DOOR.y + 20, vx: (noise(e.time * 19) - 0.5) * 30, vy: -40 - 60 * e.flame, r: 1.5 + noise(e.time * 23) * 1.5, life: 0.9, angle: 0, spin: 0, tone: noise(e.time * 29) });
  }
  if (e.blown) e.blowAge += dt;
}

/** The safety valve lets go: cap and rivets fly, the room fills with steam. */
export function blowEngine(e: EngineState, ps: Particles, seed: number, quiet: boolean): void {
  e.blown = true;
  e.blowAge = quiet ? 10 : 0;
  e.leaks = 0;
  e.scare = 0;
  e.needle.v -= 8;
  if (quiet) { e.pressure = 0; settleSpring(e.needle, 0); return; }
  const n = seed * 0.001;
  emit(ps, { kind: 'cap', layer: 1, x: VALVE.x, y: VALVE.y - 8, vx: (noise(n) - 0.5) * 240, vy: -760, r: 10, life: 5, angle: 0, spin: 9 + noise(n + 1) * 10, tone: 0 });
  for (let i = 0; i < 9; i += 1) {
    const a = -Math.PI * (0.1 + noise(n + i) * 0.8);
    const s = 300 + noise(n + i + 0.5) * 320;
    emit(ps, { kind: 'rivet', layer: 1, x: DOME.x + (noise(n + i + 0.2) - 0.5) * 200, y: 180, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 3.5, life: 4, angle: 0, spin: 14, tone: 0 });
  }
  puff(ps, DOME.x, DOME.y - 30, 0, -1, 520, 26, 46, 2.6, 1, seed);
  puff(ps, DOME.x, DOME.y - 30, 0, -1, 380, 26, 60, 3.4, 0, seed + 7);
  puff(ps, 300, 250, -1, -0.4, 320, 12, 36, 2.4, 0, seed + 11);
  puff(ps, 640, 150, 1, -0.3, 340, 12, 30, 2.2, 1, seed + 13);
  sparks(ps, DOME.x, DOME.y - 10, 40, 420, seed + 17);
  for (let i = 0; i < 24; i += 1) {
    emit(ps, { kind: 'soot', layer: 1, x: DOME.x + (noise(n + i * 3) - 0.5) * 120, y: 170, vx: (noise(n + i * 3 + 1) - 0.5) * 260, vy: -100 - noise(n + i * 3 + 2) * 300, r: 2 + noise(n + i * 3 + 3) * 3, life: 3 + noise(n + i) * 2, angle: 0, spin: 0, tone: noise(n + i) });
  }
}

export interface Linkage {
  pin: { x: number; y: number };
  crosshead: number;
  piston: number;
}

export function linkage(e: EngineState): Linkage {
  const pin = { x: CRANK.x + Math.cos(e.theta) * CRANK_R, y: CRANK.y + Math.sin(e.theta) * CRANK_R };
  const dy = pin.y - GUIDE_Y;
  const crosshead = pin.x - Math.sqrt(Math.max(0, ROD * ROD - dy * dy));
  // The piston sits 109 behind the crosshead, so its 95 px stroke stays inside the 108 px bore.
  return { pin, crosshead, piston: crosshead - 109 };
}

/** How far the safety valve's cap stands off its seat: the lift, with the chatter riding on it. */
function valveLift(e: EngineState): number {
  const v = Math.max(0, e.valve.x);
  return v * (5 + 2.4 * Math.sin(e.chatter) * Math.min(1, v * 1.5));
}

function rivets(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, step: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(1, Math.round(Math.hypot(dx, dy) / step));
  ctx.fillStyle = IRON_LIGHT;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    ctx.beginPath(); ctx.arc(x0 + dx * t, y0 + dy * t, 2.2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawGauge(ctx: CanvasRenderingContext2D, e: EngineState): void {
  const cx = 455;
  const cy = 250;
  ctx.beginPath(); ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.fillStyle = BRASS; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 37, 0, Math.PI * 2);
  ctx.fillStyle = e.blown ? '#e8e2d2' : '#f6f1e2'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  // Amber from 1.8×, red from 3×: the needle reads 1 − 1/x, so the zones arrive while most rounds are still alive.
  ctx.beginPath(); ctx.arc(cx, cy, 30, -2.35 + 3.4 * 0.45, -2.35 + 3.4 * 0.67);
  ctx.strokeStyle = '#f2a33a'; ctx.lineWidth = 7; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 30, -2.35 + 3.4 * 0.67, 1.05);
  ctx.strokeStyle = '#e63946'; ctx.stroke();
  ctx.strokeStyle = INK;
  for (let i = 0; i <= 10; i += 1) {
    const a = -2.35 + 0.34 * i;
    ctx.lineWidth = i % 5 === 0 ? 2.2 : 1.2;
    const inner = i % 5 === 0 ? 25 : 29;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner); ctx.lineTo(cx + Math.cos(a) * 33, cy + Math.sin(a) * 33); ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('APY', cx, cy + 20);
  const jitter = e.blown ? 0 : Math.sin(e.time * 41) * 0.05 * e.pressure * e.pressure + (noise(Math.floor(e.time * 17)) - 0.5) * 0.06 * e.pressure;
  const a = -2.35 + 3.4 * clamp(e.needle.x, -0.05, 1.05) + jitter;
  ctx.strokeStyle = '#d62839'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6); ctx.lineTo(cx + Math.cos(a) * 31, cy + Math.sin(a) * 31); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  // The glass cracks a little more with each half decade a long round climbs past 30×, and all the way at the blow-out.
  const cracks = e.blown ? CRACKS.length : e.live ? clamp(Math.floor(Math.log10(Math.max(1, e.multiplier)) * 2) - 2, 0, CRACKS.length) : 0;
  if (cracks > 0) {
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of CRACKS.slice(0, cracks)) { ctx.moveTo(cx + x0, cy + y0); ctx.lineTo(cx + x1, cy + y1); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath(); ctx.ellipse(cx - 12, cy - 16, 14, 8, -0.6, 0, Math.PI * 2); ctx.fill();
}

const CRACKS = [[-20, -30, -8, -12], [-8, -12, -16, 4], [12, -28, 6, -14], [-16, 4, 2, 18], [6, -14, 22, -2], [2, 18, 12, 30]] as const;

/** The riveted brass maker's plate: what this boiler really is. */
function drawNameplate(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = PLATE;
  ctx.fillStyle = BRASS; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 240, 190, 0.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 4, y + 2.5); ctx.lineTo(x + w - 4, y + 2.5); ctx.stroke();
  ctx.fillStyle = BRASS_DARK;
  for (const [rx, ry] of [[x + 4.5, y + 5], [x + w - 4.5, y + 5], [x + 4.5, y + h - 5], [x + w - 4.5, y + h - 5]] as const) {
    ctx.beginPath(); ctx.arc(rx, ry, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#3b2c0c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `9.5px ${PLATE_FONT}`;
  ctx.fillText('MONEY PRINTER', x + w / 2, y + 19, w - 6);
  ctx.fillStyle = BRASS_DARK;
  ctx.fillRect(x + 12, y + 23, w - 24, 1);
  ctx.fillStyle = '#3b2c0c';
  ctx.font = `6.3px ${PLATE_FONT}`;
  ctx.fillText('MODEL BRRR-3000', x + w / 2, y + 33, w - 16);
}

function drawFire(ctx: CanvasRenderingContext2D, e: EngineState): void {
  const { x, y } = DOOR;
  const flame = clamp(e.flame, 0, 1.2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - 32, y + 44); ctx.lineTo(x - 32, y - 10); ctx.arc(x, y - 10, 32, Math.PI, Math.PI * 2); ctx.lineTo(x + 32, y + 44); ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#2a1410';
  ctx.fillRect(x - 40, y - 50, 80, 100);
  const glow = ctx.createRadialGradient(x, y + 30, 4, x, y + 30, 60);
  glow.addColorStop(0, `rgba(255, 140, 40, ${0.9 * flame})`);
  glow.addColorStop(1, 'rgba(255, 60, 10, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 40, y - 50, 80, 100);
  for (let i = 0; i < 5; i += 1) {
    const fx = x - 22 + i * 11;
    const h = (18 + 34 * flame) * (0.7 + 0.3 * Math.sin(e.time * (7 + i) + i * 1.7));
    const lean = Math.sin(e.time * 5 + i) * 5;
    const tongue = ctx.createLinearGradient(0, y + 40, 0, y + 40 - h);
    tongue.addColorStop(0, '#ff4d1a'); tongue.addColorStop(0.6, '#ff9a2e'); tongue.addColorStop(1, '#ffe07a');
    ctx.fillStyle = tongue;
    ctx.beginPath();
    ctx.moveTo(fx - 7, y + 42);
    ctx.quadraticCurveTo(fx - 8 + lean, y + 42 - h * 0.5, fx + lean, y + 42 - h);
    ctx.quadraticCurveTo(fx + 8 + lean, y + 42 - h * 0.5, fx + 7, y + 42);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#1b1b1f';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(x - 28 + i * 10, y + 36 + (i % 2) * 3, 9, 6);
  ctx.restore();
}

export function drawBoiler(ctx: CanvasRenderingContext2D, e: EngineState): void {
  ctx.lineJoin = 'round';
  // Chimney.
  ctx.fillStyle = IRON_DARK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.rect(296, 68, 34, 120); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(290, 60, 46, 12); ctx.fill(); ctx.stroke();
  // Firebox base with bricks and the door.
  ctx.fillStyle = '#5a3a33';
  ctx.beginPath(); ctx.rect(280, 322, 350, FLOOR_Y - 322); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.45)';
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 7; row += 1) {
    const y = 336 + row * 20;
    ctx.beginPath(); ctx.moveTo(280, y); ctx.lineTo(630, y); ctx.stroke();
    for (let x = 280 + (row % 2) * 22; x < 630; x += 44) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 20); ctx.stroke(); }
  }
  drawFire(ctx, e);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(DOOR.x - 34, DOOR.y + 46); ctx.lineTo(DOOR.x - 34, DOOR.y - 10); ctx.arc(DOOR.x, DOOR.y - 10, 34, Math.PI, Math.PI * 2); ctx.lineTo(DOOR.x + 34, DOOR.y + 46); ctx.stroke();
  ctx.strokeStyle = IRON_LIGHT;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = IRON;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(DOOR.x - 44, DOOR.y + 46, 88, 10, 2); ctx.fill(); ctx.stroke();
  // Boiler barrel.
  const barrel = ctx.createLinearGradient(0, 175, 0, 325);
  barrel.addColorStop(0, IRON_LIGHT); barrel.addColorStop(0.35, IRON); barrel.addColorStop(1, IRON_DARK);
  ctx.fillStyle = barrel;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(270, 175, 370, 150, 60); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = IRON_DARK;
  ctx.lineWidth = 3;
  for (const x of [340, 420, 500, 580]) { ctx.beginPath(); ctx.moveTo(x, 178); ctx.lineTo(x, 322); ctx.stroke(); rivets(ctx, x, 186, x, 314, 16); }
  rivets(ctx, 300, 182, 610, 182, 24);
  rivets(ctx, 300, 318, 610, 318, 24);
  drawNameplate(ctx);
  // Steam dome and the safety valve.
  ctx.fillStyle = IRON;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(DOME.x, DOME.y + 4, 32, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = BRASS;
  ctx.beginPath(); ctx.roundRect(VALVE.x - 9, VALVE.y, 18, 46, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = BRASS_DARK;
  ctx.fillRect(VALVE.x - 11, VALVE.y + 30, 22, 5);
  if (!e.blown) {
    const lift = valveLift(e) + 60 * e.capDrop * e.capDrop;
    ctx.save();
    ctx.globalAlpha = 1 - e.capDrop;
    ctx.fillStyle = BRASS;
    ctx.beginPath(); ctx.roundRect(VALVE.x - 12, VALVE.y - 9 - lift, 24, 10, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a1420'; ctx.font = `8px ${PLATE_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RUG', VALVE.x, VALVE.y - 3.5 - lift);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(VALVE.x, VALVE.y - 4 - lift); ctx.lineTo(VALVE.x + 40, VALVE.y - 14 - lift); ctx.stroke();
    ctx.fillStyle = IRON_DARK;
    ctx.beginPath(); ctx.arc(VALVE.x + 40, VALVE.y - 14 - lift, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath(); ctx.ellipse(VALVE.x, VALVE.y - 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Steam pipe to the cylinder, with its stop valve.
  ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(DOME.x + 20, 152); ctx.lineTo(700, 152); ctx.lineTo(700, 268); ctx.stroke();
  ctx.strokeStyle = IRON; ctx.lineWidth = 11; ctx.stroke();
  ctx.strokeStyle = IRON_LIGHT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(DOME.x + 20, 148); ctx.lineTo(700, 148); ctx.stroke();
  ctx.fillStyle = '#b8323f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(640, 130, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(640, 142); ctx.lineTo(640, 152); ctx.stroke();
  for (let i = 0; i < 4; i += 1) { const a = e.theta * 0.1 + (i * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(640, 130); ctx.lineTo(640 + Math.cos(a) * 10, 130 + Math.sin(a) * 10); ctx.stroke(); }
  drawGauge(ctx, e);
}

export function drawMachine(ctx: CanvasRenderingContext2D, e: EngineState): void {
  const link = linkage(e);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Belt from the flywheel to the fan pulley (external tangents), with dashes showing its speed.
  const D = Math.hypot(FAN.x - CRANK.x, FAN.y - CRANK.y);
  const ux = (FAN.x - CRANK.x) / D;
  const uy = (FAN.y - CRANK.y) / D;
  const beta = Math.asin((68 - FAN.r) / D);
  const dash = e.belt;
  // Past about 8 px a frame the dashes fade toward a plain belt, so they never strobe backwards.
  const fast = smoothstep(8, 12, Math.abs(e.omega) * 68 * e.frame);
  for (const s of [-1, 1]) {
    const a = Math.atan2(uy, ux) + s * (Math.PI / 2 - beta);
    const mx = Math.cos(a);
    const my = Math.sin(a);
    const x0 = CRANK.x + 68 * mx;
    const y0 = CRANK.y + 68 * my;
    const x1 = FAN.x + FAN.r * mx;
    const y1 = FAN.y + FAN.r * my;
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#6f5a46'; ctx.lineWidth = 3;
    ctx.globalAlpha = fast;
    ctx.stroke();
    ctx.globalAlpha = 1 - 0.6 * fast;
    ctx.strokeStyle = '#8a6a4a';
    ctx.setLineDash([12, 16]);
    ctx.lineDashOffset = s * dash * -1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  // Fan pulley, guard and blades.
  ctx.fillStyle = IRON; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(FAN.x, FAN.y, FAN.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(FAN.x, FAN.y, 30, 0, Math.PI * 2); ctx.strokeStyle = IRON_LIGHT; ctx.lineWidth = 3; ctx.stroke();
  const fanAngle = e.theta * (68 / FAN.r);
  // Four blades repeat every 90°, so past 20° a frame they cross-fade into a blurred disc before they can seem to turn backwards.
  const fanBlur = smoothstep(0.35, 0.52, Math.abs(e.omega) * (68 / FAN.r) * e.frame);
  ctx.fillStyle = '#9aa3ad';
  ctx.globalAlpha = 1 - fanBlur;
  for (let i = 0; i < 4 && fanBlur < 1; i += 1) {
    const a = fanAngle + (i * Math.PI) / 2;
    ctx.save(); ctx.translate(FAN.x, FAN.y); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(14, 0, 13, 5, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 0.55 * fanBlur;
  ctx.beginPath(); ctx.arc(FAN.x, FAN.y, 26, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(FAN.x, FAN.y, 5, 0, Math.PI * 2); ctx.fill();
  // Cylinder with a cutaway showing the piston, and the crosshead guide.
  ctx.fillStyle = IRON; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(596, 280, 120, 60, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = IRON_DARK;
  ctx.beginPath(); ctx.roundRect(602, 292, 108, 36, 4); ctx.fill();
  ctx.fillStyle = '#b8bec8';
  ctx.beginPath(); ctx.roundRect(link.piston - 5, 294, 10, 32, 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(link.piston + 4, GUIDE_Y); ctx.lineTo(link.crosshead, GUIDE_Y); ctx.stroke();
  ctx.strokeStyle = '#d0d5dc'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = IRON_LIGHT; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(596, 268, 26, 12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(716, 294, 100, 6, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(716, 320, 100, 6, 2); ctx.fill(); ctx.stroke();
  // Exhaust stack on the cylinder.
  ctx.fillStyle = IRON_DARK;
  ctx.beginPath(); ctx.rect(605, 256, 14, 26); ctx.fill(); ctx.stroke();
  // Flywheel behind the connecting rod.
  ctx.strokeStyle = INK; ctx.lineWidth = 18;
  ctx.beginPath(); ctx.arc(CRANK.x, CRANK.y, 68, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = IRON; ctx.lineWidth = 12; ctx.stroke();
  // Six spokes repeat every 60°: at low frame rates and high speed they blur the same way the fan does.
  const spokeBlur = smoothstep(0.3, 0.46, Math.abs(e.omega) * e.frame);
  ctx.globalAlpha = 1 - spokeBlur;
  ctx.strokeStyle = INK; ctx.lineWidth = 7;
  for (let i = 0; i < 6 && spokeBlur < 1; i += 1) {
    const a = e.theta + (i * Math.PI) / 3;
    ctx.beginPath(); ctx.moveTo(CRANK.x + Math.cos(a) * 12, CRANK.y + Math.sin(a) * 12); ctx.lineTo(CRANK.x + Math.cos(a) * 60, CRANK.y + Math.sin(a) * 60); ctx.stroke();
  }
  ctx.strokeStyle = IRON_LIGHT; ctx.lineWidth = 3;
  for (let i = 0; i < 6 && spokeBlur < 1; i += 1) {
    const a = e.theta + (i * Math.PI) / 3;
    ctx.beginPath(); ctx.moveTo(CRANK.x + Math.cos(a) * 12, CRANK.y + Math.sin(a) * 12); ctx.lineTo(CRANK.x + Math.cos(a) * 60, CRANK.y + Math.sin(a) * 60); ctx.stroke();
  }
  ctx.globalAlpha = 0.45 * spokeBlur;
  ctx.fillStyle = IRON_LIGHT;
  ctx.beginPath(); ctx.arc(CRANK.x, CRANK.y, 60, 0, Math.PI * 2); ctx.arc(CRANK.x, CRANK.y, 12, 0, Math.PI * 2, true); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = IRON_DARK; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(CRANK.x, CRANK.y, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Crank web, connecting rod and crosshead.
  ctx.strokeStyle = INK; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(CRANK.x, CRANK.y); ctx.lineTo(link.pin.x, link.pin.y); ctx.stroke();
  ctx.strokeStyle = IRON_LIGHT; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(link.crosshead, GUIDE_Y); ctx.lineTo(link.pin.x, link.pin.y); ctx.stroke();
  ctx.strokeStyle = '#8f96a3'; ctx.lineWidth = 8; ctx.stroke();
  ctx.fillStyle = IRON; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(link.crosshead - 12, GUIDE_Y - 12, 24, 24, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = BRASS;
  ctx.beginPath(); ctx.arc(link.pin.x, link.pin.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(link.crosshead, GUIDE_Y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Flyball governor on the cylinder: the weights lift with speed.
  const alpha = 0.25 + 0.95 * smoothstep(2, 20, e.omega);
  const spin = e.theta * 2;
  const arm = 34;
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(GOVERNOR.x, 280); ctx.lineTo(GOVERNOR.x, GOVERNOR.y - 14); ctx.stroke();
  ctx.strokeStyle = BRASS; ctx.lineWidth = 2.5; ctx.stroke();
  const sleeveY = GOVERNOR.y + 2 * arm * Math.cos(alpha) - 6;
  const balls = [-1, 1].map((s) => ({ s, x: GOVERNOR.x + s * arm * Math.sin(alpha) * Math.cos(spin), y: GOVERNOR.y + arm * Math.cos(alpha), depth: s * Math.sin(spin) }));
  balls.sort((a, b) => a.depth - b.depth);
  for (const b of balls) {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(GOVERNOR.x, GOVERNOR.y); ctx.lineTo(b.x, b.y); ctx.lineTo(GOVERNOR.x, sleeveY); ctx.stroke();
    ctx.fillStyle = b.depth > 0 ? BRASS : BRASS_DARK;
    ctx.beginPath(); ctx.arc(b.x, b.y, 6.5 * (0.85 + 0.15 * b.depth), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = IRON_LIGHT; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(GOVERNOR.x - 7, sleeveY - 4, 14, 8, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(GOVERNOR.x, GOVERNOR.y - 14, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

/** Mechanical patches take turns sealing one seam, then slipping under load. Only while a round runs. */
export function drawMaintenance(ctx: CanvasRenderingContext2D, e: EngineState): void {
  if (!e.live || e.time < 45 || e.blown) return;
  const cycle = (e.time - 45) / 18;
  const site = LEAK_SPOTS[Math.floor(cycle) % LEAK_SPOTS.length]!;
  const close = Math.pow(Math.max(0, Math.sin(cycle * Math.PI)), 4);
  ctx.save(); ctx.translate(site.x, site.y); ctx.rotate((1 - close) * 0.55);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = '#af7949';
  ctx.fillRect(-18, -12 - (1 - close) * 14, 36, 24); ctx.strokeRect(-18, -12 - (1 - close) * 14, 36, 24);
  ctx.fillStyle = '#2b1d10'; ctx.font = `11px ${PLATE_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SAFU', 0, 1 - (1 - close) * 14, 30);
  ctx.restore();
}
