/**
 * The paramedic: from 8× he wheels a stretcher in from the right and
 * waits by the cooler, checking his watch, and at the burst he rolls it
 * over to the curler. A crash met late finds him already parked there.
 * Nothing here changes the outcome.
 */
import { endurance } from './endurance';
import { type Spring, clamp, settleSpring, spring, stepSpring } from './motion';
import { INK, type Point } from './gym';

/** The displayed multiplier from which he waits at the door. */
export const MEDIC_AT = 8;
const OFF_X = 1120;
const WAIT_X = 852;
const ARRIVE_X = 690;
/** His feet, a step further back on the floor than the curler's. */
const FEET_Y = 470;

export type MedicMode = 'off' | 'waiting' | 'arriving';

export interface Medic {
  time: number;
  mode: MedicMode;
  x: Spring;
  /** The arm with the watch coming up. */
  watch: Spring;
  /** The stretcher's bounce as it rolls. */
  bounce: Spring;
  events: { enter: boolean };
}

export function createMedic(): Medic {
  return { time: 0, mode: 'off', x: spring(OFF_X), watch: spring(0), bounce: spring(0), events: { enter: false } };
}

export function resetMedic(m: Medic): void {
  m.mode = 'off';
  settleSpring(m.x, OFF_X);
  settleSpring(m.watch, 0);
  settleSpring(m.bounce, 0);
}

const targetX = (mode: MedicMode): number => (mode === 'off' ? OFF_X : mode === 'waiting' ? WAIT_X : ARRIVE_X);

/** Jumps to where a round met late has him: waiting if the number got there, beside the curler if it has crashed. */
export function settleMedic(m: Medic, multiplier: number, crashed: boolean): void {
  m.mode = multiplier >= MEDIC_AT ? (crashed ? 'arriving' : 'waiting') : 'off';
  settleSpring(m.x, targetX(m.mode));
}

/** The burst: he rolls the stretcher over, if he was there. */
export function summonMedic(m: Medic): void {
  if (m.mode === 'waiting') { m.mode = 'arriving'; m.bounce.v += 6; }
}

export interface MedicDrive { seconds?: number; running: boolean; multiplier: number }

export function stepMedic(m: Medic, drive: MedicDrive, dt: number): void {
  m.time += dt;
  m.events = { enter: false };
  if (m.mode === 'off' && drive.running && drive.multiplier >= MEDIC_AT) { m.mode = 'waiting'; m.events.enter = true; m.bounce.v += 6; }
  const act = endurance(drive.seconds ?? 0);
  const prepare = drive.running && m.mode === 'waiting' ? act.effort * (act.act === 3 ? 68 : act.act === 4 ? 110 : 0) : 0;
  stepSpring(m.x, targetX(m.mode) - prepare, m.mode === 'arriving' ? 3.5 : 2.5, 0.85, dt);
  const rolling = Math.abs(m.x.v) > 20;
  stepSpring(m.bounce, rolling ? 0.5 + 0.5 * Math.sin(m.time * 18) : 0, 12, 0.5, dt);
  stepSpring(m.watch, m.mode === 'waiting' && !rolling && Math.floor(m.time * 0.45) % 2 === 1 ? 1 : 0, 6, 0.7, dt);
}

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, colour: string): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width + 5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
}

export function drawMedic(ctx: CanvasRenderingContext2D, m: Medic): void {
  if (m.x.x > OFF_X - 20) return;
  const x = m.x.x;
  const bounce = clamp(m.bounce.x, 0, 1);
  const watch = clamp(m.watch.x, 0, 1);
  ctx.save();
  ctx.translate(x, FEET_Y);
  ctx.scale(0.8, 0.8);
  ctx.lineJoin = 'round';
  // The stretcher to his left: wheels, a folding frame, the board with its blanket, a little light on the rail.
  ctx.save();
  ctx.translate(0, -bounce * 3);
  for (const wx of [-120, -40]) { ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(wx, -8, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#8d99ae'; ctx.beginPath(); ctx.arc(wx, -8, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-120, -8); ctx.lineTo(-44, -60); ctx.moveTo(-40, -8); ctx.lineTo(-116, -60); ctx.stroke();
  ctx.strokeStyle = '#8d99ae'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-136, -68, 122, 12, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.roundRect(-126, -76, 80, 10, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(-40, -78, 22, 12, 3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, -62); ctx.lineTo(4, -62); ctx.stroke();
  ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.roundRect(-134, -84, 10, 7, 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  // Him: hi-vis, green trousers, a cap, one hand on the handle, the other checking the time.
  for (const side of [-1, 1]) {
    const walking = Math.abs(m.x.v) > 5;
    const phase = ((m.time * 1.3 + (side > 0 ? .5 : 0)) % 1);
    const lift = walking && phase > .6 ? Math.sin((phase - .6) / .4 * Math.PI) * 12 : 0;
    limb(ctx, { x: side * 10, y: -74 }, { x: side * 12, y: -lift }, 15, '#2e8b57');
    ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(side * 12 - 12, -6 - lift, 24, 10, 4); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#ffd60a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-28, -140, 56, 70, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8d99ae';
  ctx.fillRect(-28, -118, 56, 6); ctx.fillRect(-28, -100, 56, 6);
  ctx.fillStyle = '#2e8b57';
  ctx.fillRect(-4, -134, 8, 20); ctx.fillRect(-10, -128, 20, 8);
  const skin = '#e0bda7';
  limb(ctx, { x: -28, y: -128 }, { x: 4, y: -62 - bounce * 3 }, 13, skin);
  const hand = { x: 28 + 6 * watch, y: -96 - 34 * watch };
  limb(ctx, { x: 28, y: -128 }, hand, 13, skin);
  ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.roundRect(hand.x - 8, hand.y - 4, 14, 8, 3); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  // Head, cap, a flat mouth: he has seen this before.
  const hy = -166;
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 21, 25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2e8b57';
  ctx.beginPath(); ctx.arc(0, hy - 12, 22, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-24, hy - 16, 48, 7, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (const ex of [-8, 8]) { ctx.beginPath(); ctx.ellipse(ex, hy - 2, 4.5, 3.5 - 1.5 * watch, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, hy - 1 + 2 * watch, 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-7, hy + 12); ctx.lineTo(7, hy + 12); ctx.stroke();
  // The clipboard on the blanket.
  ctx.restore();
}
