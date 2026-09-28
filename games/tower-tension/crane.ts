/**
 * The tower crane. One floor per cycle: the hook drops to the pile, lifts a
 * block, the trolley runs out along the jib, the block is lowered onto the
 * stack and released. The block hangs as a real pendulum under the hook, so
 * every trolley start and stop leaves it swinging and it lands a little off
 * centre; that swing is what rocks the tower. The crane climbs with the stack.
 */
import { type Spring, clamp, fract, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { FLOOR_H, GROUND_Y, TOWER_X, drawBlock } from './tower';

export const CRANE_X = 250;
export const PILE_X = 340;
export const JIB_TIP = TOWER_X + 110;
export const PILE_BLOCKS = 3;
/** Shortest cable, hook tucked under the trolley. */
const HOOK_MIN = 46;
/** Hook to the centre of the hanging block (sling plus half a floor). */
const LOAD_DROP = FLOOR_H / 2 + 16;
const GRAVITY = 900;
const INK = '#1c1f26';
const YELLOW = '#f4b400';
const YELLOW_DARK = '#b8860b';

export interface CraneState {
  /** Continuous floor count; the fraction is the position in the cycle. */
  phase: number;
  trolley: Spring;
  cable: Spring;
  /** World y of the jib. */
  jibY: Spring;
  swing: number;
  swingV: number;
  holding: boolean;
  /** The counterweight's swing on its chains (radians): lightly damped, so every jolt keeps it going. */
  weight: Spring;
  /** What the last released block carried into the stack. */
  drop: { offset: number; velocity: number };
  events: { release: boolean; touchdown: boolean; pickup: boolean };
}

export function createCrane(): CraneState {
  return { phase: 0, trolley: spring(PILE_X), cable: spring(HOOK_MIN), jibY: spring(GROUND_Y - 210), swing: 0, swingV: 0, holding: false, weight: spring(0), drop: { offset: 0, velocity: 0 }, events: { release: false, touchdown: false, pickup: false } };
}

export function resetCrane(c: CraneState): void {
  c.phase = 0;
  settleSpring(c.trolley, PILE_X);
  settleSpring(c.cable, HOOK_MIN);
  c.swing = 0;
  c.swingV = 0;
  c.holding = false;
  settleSpring(c.weight, 0);
  c.events = { release: false, touchdown: false, pickup: false };
}

/** A jolt to the counterweight: a landed floor, a pickup, the collapse. */
export function jolt(c: CraneState, strength: number): void {
  c.weight.v += strength;
}

/** The jib stays a fixed clearance above the stack. */
export const jibTargetY = (topY: number): number => Math.min(GROUND_Y - 210, topY - 150);

function trolleyTarget(phase: number): number {
  const u = fract(phase);
  // The first cycle has nothing to come back from: the trolley waits over the pile.
  if (phase < 0.25) return PILE_X;
  if (u < 0.25) return mix(TOWER_X, PILE_X, smoothstep(0, 0.25, u));
  if (u < 0.35) return PILE_X;
  if (u < 0.65) return mix(PILE_X, TOWER_X, smoothstep(0.35, 0.65, u));
  return TOWER_X;
}

function cableTarget(phase: number, jibY: number, topY: number): number {
  const u = fract(phase);
  const pileLen = GROUND_Y - (PILE_BLOCKS + 0.5) * FLOOR_H - LOAD_DROP - jibY;
  const setLen = topY - FLOOR_H / 2 - LOAD_DROP - jibY;
  if (phase < 0.1) return HOOK_MIN;
  if (u < 0.1) return mix(setLen + FLOOR_H, HOOK_MIN, smoothstep(0, 0.1, u));
  if (u < 0.25) return mix(HOOK_MIN, pileLen, smoothstep(0.1, 0.25, u));
  if (u < 0.35) return mix(pileLen, HOOK_MIN, smoothstep(0.25, 0.35, u));
  if (u < 0.65) return HOOK_MIN;
  if (u < 0.97) return mix(HOOK_MIN, setLen, smoothstep(0.65, 0.97, u));
  return setLen;
}

/** Jumps the crane to a point in its cycle (joining a round late). */
export function settleCrane(c: CraneState, phase: number, topY: number): void {
  c.phase = phase;
  const u = fract(phase);
  settleSpring(c.jibY, jibTargetY(topY));
  settleSpring(c.trolley, trolleyTarget(phase));
  settleSpring(c.cable, cableTarget(phase, c.jibY.x, topY));
  c.holding = u >= 0.25;
  c.swing = 0;
  c.swingV = 0;
  settleSpring(c.weight, 0);
}

/**
 * Advances the cycle to `phase` (the continuous floor count while running;
 * held still otherwise). `topY` is the current top surface the block lands on.
 * `tension` (0..1) is how hard the counterweight answers the wind and the trolley.
 */
export function stepCrane(c: CraneState, phase: number, topY: number, wind: number, dt: number, tension = 0): void {
  const before = c.phase;
  c.phase = phase;
  const u0 = fract(before);
  const u = fract(phase);
  const wrapped = Math.floor(phase) > Math.floor(before);
  c.events.pickup = (u0 < 0.25 && u >= 0.25) || (wrapped && u >= 0.25);
  c.events.touchdown = (u0 < 0.97 && u >= 0.97) || (wrapped && u >= 0.97);
  c.events.release = wrapped && c.holding;
  if (c.events.pickup) c.holding = true;

  stepSpring(c.jibY, jibTargetY(topY), 3, 1, dt);
  const v0 = c.trolley.v;
  stepSpring(c.trolley, trolleyTarget(phase), 5, 1, dt);
  const accel = clamp(dt > 0 ? (c.trolley.v - v0) / dt : 0, -400, 400);
  stepSpring(c.cable, cableTarget(phase, c.jibY.x, topY + (u < 0.1 ? FLOOR_H : 0)), 12, 0.9, dt);

  // The load is a pendulum under the trolley; wind and trolley acceleration swing it.
  const length = Math.max(30, c.cable.x + LOAD_DROP);
  let left = dt;
  while (left > 0) {
    const h = Math.min(1 / 240, left);
    left -= h;
    const a = -(GRAVITY / length) * Math.sin(c.swing) - (0.4 * accel / length) * Math.cos(c.swing) - 1.6 * c.swingV + (wind * 0.15) / length;
    c.swingV += a * h;
    c.swing += c.swingV * h;
    if (Math.abs(c.swing) > 0.35) { c.swing = Math.sign(c.swing) * 0.35; c.swingV *= -0.2; }
  }
  if (c.events.release) {
    c.drop = { offset: clamp(c.trolley.x + Math.sin(c.swing) * length - TOWER_X, -14, 14), velocity: clamp(c.trolley.v + Math.cos(c.swing) * length * c.swingV, -60, 60) };
    c.holding = false;
    c.swingV *= 0.3;
  }
  // The counterweight hangs on short chains: the wind leans it, the trolley's starts and stops kick it, and
  // with the tension it swings ever wider, barely damped, until it is throwing itself about up there.
  c.weight.v += (-accel * 0.0025) * (0.1 + tension * 1.2) * dt * 8;
  stepSpring(c.weight, wind * 0.0012 * (0.15 + tension * 1.85), 5, 0.06, dt);
  c.weight.x = clamp(c.weight.x, -0.55, 0.55);
}

/** World position of the hanging block's centre and its angle. */
export function loadPose(c: CraneState): { x: number; y: number; angle: number } {
  const length = c.cable.x + LOAD_DROP;
  return { x: c.trolley.x + Math.sin(c.swing) * length, y: c.jibY.x + Math.cos(c.swing) * length, angle: c.swing };
}

function lattice(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, step: number): void {
  // Two chords with a zigzag between them, for the mast and the jib.
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * width;
  const ny = (dx / len) * width;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0 + nx, y0 + ny); ctx.lineTo(x1 + nx, y1 + ny); ctx.moveTo(x0 - nx, y0 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.stroke();
  ctx.strokeStyle = YELLOW;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = YELLOW_DARK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  const count = Math.max(1, Math.floor(len / step));
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const side = i % 2 ? 1 : -1;
    if (i === 0) ctx.moveTo(px + nx * side, py + ny * side);
    else ctx.lineTo(px + nx * side, py + ny * side);
  }
  ctx.stroke();
}

export function drawPile(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < PILE_BLOCKS; i += 1) {
    ctx.save();
    ctx.translate(PILE_X + (i % 2 ? 4 : -3), GROUND_Y - (i + 0.5) * FLOOR_H);
    drawBlock(ctx, (i + 2) % 4);
    ctx.restore();
  }
}

export function drawCrane(ctx: CanvasRenderingContext2D, c: CraneState): void {
  const jibY = c.jibY.x;
  ctx.lineJoin = 'round';
  // Mast from a concrete foot up to the slewing unit.
  ctx.fillStyle = '#9aa0a8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(CRANE_X - 26, GROUND_Y - 12, 52, 16, 3); ctx.fill(); ctx.stroke();
  lattice(ctx, CRANE_X, GROUND_Y - 10, CRANE_X, jibY + 6, 11, 22);
  // Counter-jib with its weight on two chains, the main jib, and the apex ties.
  lattice(ctx, CRANE_X - 100, jibY - 6, JIB_TIP, jibY - 6, 6, 24);
  ctx.save();
  ctx.translate(CRANE_X - 87, jibY - 2);
  ctx.rotate(c.weight.x);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-12, 10); ctx.moveTo(12, 0); ctx.lineTo(12, 10); ctx.stroke();
  ctx.fillStyle = '#6f757d';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-17, 10, 34, 22, 3); ctx.fill(); ctx.stroke();
  // What really holds the jib up.
  ctx.fillStyle = YELLOW;
  ctx.font = '900 13px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('100X', 0, 21.5, 30);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CRANE_X, jibY - 62); ctx.lineTo(JIB_TIP - 6, jibY - 12);
  ctx.moveTo(CRANE_X, jibY - 62); ctx.lineTo(CRANE_X - 96, jibY - 12);
  ctx.stroke();
  ctx.fillStyle = YELLOW;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(CRANE_X - 9, jibY - 12); ctx.lineTo(CRANE_X, jibY - 66); ctx.lineTo(CRANE_X + 9, jibY - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Cab.
  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.roundRect(CRANE_X + 8, jibY - 4, 30, 22, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9fd3ff';
  ctx.fillRect(CRANE_X + 22, jibY, 12, 10);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(JIB_TIP - 14, jibY - 14, 14, 5);
  // Trolley, cable, hook.
  const hookY = jibY + c.cable.x;
  ctx.fillStyle = '#3a4350';
  ctx.beginPath(); ctx.roundRect(c.trolley.x - 9, jibY - 2, 18, 11, 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(c.trolley.x, jibY + 8); ctx.lineTo(c.trolley.x, hookY); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c.trolley.x, hookY + 6, 6, -Math.PI / 2, Math.PI * 0.9); ctx.stroke();
  if (c.holding) {
    const load = loadPose(c);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c.trolley.x, hookY + 8);
    ctx.lineTo(load.x + Math.cos(load.angle) * -40 - Math.sin(load.angle) * -FLOOR_H / 2, load.y + Math.sin(load.angle) * -40 + Math.cos(load.angle) * -FLOOR_H / 2);
    ctx.moveTo(c.trolley.x, hookY + 8);
    ctx.lineTo(load.x + Math.cos(load.angle) * 40 - Math.sin(load.angle) * -FLOOR_H / 2, load.y + Math.sin(load.angle) * 40 + Math.cos(load.angle) * -FLOOR_H / 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(load.x, load.y);
    ctx.rotate(load.angle);
    drawBlock(ctx, Math.floor(c.phase) % 4);
    ctx.restore();
  }
}
