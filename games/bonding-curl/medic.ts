/**
 * The paramedic. From 1.5× his siren washes the right of the gym red and
 * blue, at 2× he peeks in behind his stretcher, and at 3× he wheels it in
 * and parks by the cooler, checking his watch. At the burst he rolls it
 * over to the curler, and a burst that beats him to it has him sprint in
 * from outside. His feet step by the distance he covers, so they never
 * skate. A crash met late finds him already beside the curler. Nothing
 * here changes the outcome.
 */
import { endurance } from './endurance';
import { type Spring, clamp, footAt, settleSpring, spring, stepSpring } from './motion';
import { INK, type Point } from './gym';

/** The displayed multipliers at which his siren glows at the door, he peeks in, and he parks by the cooler. */
export const MEDIC_GLOW = 1.5;
export const MEDIC_PEEK = 2;
export const MEDIC_AT = 3;
const OFF_X = 1120;
const PEEK_X = 990;
const WAIT_X = 852;
const ARRIVE_X = 690;
/** His feet, a step further back on the floor than the curler's. */
const FEET_Y = 470;
const SCALE = 0.8;
/** Hip to sole, in his own units. */
const LEG = 74;
/** How far he leans round the door frame to peek, in radians. */
const PEEK_LEAN = 0.35;
/** One step, in pixels on the floor. */
const STRIDE = 40;

export type MedicMode = 'off' | 'peek' | 'waiting' | 'arriving';

export interface Medic {
  time: number;
  mode: MedicMode;
  x: Spring;
  /** The arm with the watch coming up. */
  watch: Spring;
  /** The stretcher's bounce as it rolls. */
  bounce: Spring;
  /** Leaning in round the door frame for a peek. */
  lean: Spring;
  /** The siren's wash on the wall: `lit` once it has started this round. */
  glow: Spring;
  lit: boolean;
  /** Distance rolled, signed: it turns the wheels and drives his steps, so either way he walks his feet stay put. */
  rolled: number;
  /** How high his steps lift, 0 standing to 1 striding, eased so they start and stop over a few tenths. */
  walk: number;
  parked: boolean;
  events: { glow: boolean; peek: boolean; enter: boolean; parked: boolean };
}

export function createMedic(): Medic {
  return { time: 0, mode: 'off', x: spring(OFF_X), watch: spring(0), bounce: spring(0), lean: spring(0), glow: spring(0), lit: false, rolled: 0, walk: 0, parked: false, events: { glow: false, peek: false, enter: false, parked: false } };
}

export function resetMedic(m: Medic): void {
  m.mode = 'off';
  m.lit = false;
  m.parked = false;
  m.walk = 0;
  settleSpring(m.x, OFF_X);
  settleSpring(m.watch, 0);
  settleSpring(m.bounce, 0);
  settleSpring(m.lean, 0);
  settleSpring(m.glow, 0);
}

const targetX = (mode: MedicMode): number => (mode === 'off' ? OFF_X : mode === 'peek' ? PEEK_X : mode === 'waiting' ? WAIT_X : ARRIVE_X);

/** Jumps to where a round met late has him: by the stage the number reached, or beside the curler once it has crashed. */
export function settleMedic(m: Medic, multiplier: number, crashed: boolean): void {
  m.mode = crashed ? 'arriving' : multiplier >= MEDIC_AT ? 'waiting' : multiplier >= MEDIC_PEEK ? 'peek' : 'off';
  m.lit = crashed || multiplier >= MEDIC_GLOW;
  m.parked = m.mode === 'waiting';
  m.walk = 0;
  settleSpring(m.x, targetX(m.mode));
  settleSpring(m.lean, m.mode === 'peek' ? PEEK_LEAN : 0);
  settleSpring(m.glow, m.lit ? 1 : 0);
}

/** The burst: he rolls the stretcher over. Returns true when he wasn't parked and has to sprint in. */
export function summonMedic(m: Medic): boolean {
  if (m.mode === 'arriving') return false;
  const sprint = m.mode !== 'waiting';
  m.mode = 'arriving';
  m.lit = true;
  m.bounce.v += 6;
  return sprint;
}

export interface MedicDrive { seconds?: number; running: boolean; multiplier: number }

export function stepMedic(m: Medic, drive: MedicDrive, dt: number): void {
  m.time += dt;
  m.events = { glow: false, peek: false, enter: false, parked: false };
  if (drive.running) {
    if (!m.lit && drive.multiplier >= MEDIC_GLOW) { m.lit = true; m.events.glow = true; }
    if (m.mode === 'off' && drive.multiplier >= MEDIC_PEEK) { m.mode = 'peek'; m.events.peek = true; }
    if ((m.mode === 'off' || m.mode === 'peek') && drive.multiplier >= MEDIC_AT) { m.mode = 'waiting'; m.events.enter = true; m.bounce.v += 6; }
  }
  const act = endurance(drive.seconds ?? 0);
  const prepare = drive.running && m.mode === 'waiting' ? act.effort * (act.act === 3 ? 68 : act.act === 4 ? 110 : 0) : 0;
  const before = m.x.x;
  stepSpring(m.x, targetX(m.mode) - prepare, m.mode === 'arriving' ? 4 : m.mode === 'peek' ? 3 : 2.5, 0.85, dt);
  const moved = m.x.x - before;
  const speed = dt > 0 ? Math.abs(moved) / dt : 0;
  m.rolled += moved;
  m.walk += ((speed > 12 ? 1 : 0) - m.walk) * (1 - Math.exp(-dt / 0.12));
  if (m.mode === 'waiting' && !m.parked && Math.abs(m.x.x - WAIT_X) < 24) { m.parked = true; m.events.parked = true; }
  stepSpring(m.lean, m.mode === 'peek' ? PEEK_LEAN : 0, 6, 0.6, dt);
  stepSpring(m.glow, m.lit ? 1 : 0, 2.5, 1, dt);
  const rolling = speed > 20;
  stepSpring(m.bounce, rolling ? 0.5 + 0.5 * Math.sin(m.rolled * 0.35) : 0, 12, 0.5, dt);
  stepSpring(m.watch, m.mode === 'waiting' && !rolling && Math.floor(m.time * 0.45) % 2 === 1 ? 1 : 0, 6, 0.7, dt);
}

/** The ambulance outside: a red and blue wash from the door on the right; one steady colour when motion is reduced. */
export function drawSirenGlow(ctx: CanvasRenderingContext2D, m: Medic, steady: boolean): void {
  const k = clamp(m.glow.x, 0, 1);
  if (k < 0.02) return;
  const red = steady ? 0.5 : 0.5 + 0.5 * Math.sin(m.time * 7);
  for (const [colour, w] of [['255, 40, 70', red], ['60, 120, 255', 1 - red]] as const) {
    const wash = ctx.createRadialGradient(960, 250, 10, 960, 250, 340);
    wash.addColorStop(0, `rgba(${colour}, ${0.34 * k * w})`);
    wash.addColorStop(1, `rgba(${colour}, 0)`);
    ctx.fillStyle = wash;
    ctx.fillRect(600, 0, 360, 540);
  }
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
  const peek = clamp(m.lean.x / PEEK_LEAN, 0, 1);
  ctx.save();
  ctx.translate(x, FEET_Y);
  ctx.scale(SCALE, SCALE);
  ctx.lineJoin = 'round';
  // The stretcher to his left: wheels that turn with the distance rolled, a folding frame, the board with its
  // blanket, a little light on the rail.
  ctx.save();
  ctx.translate(0, -bounce * 3);
  const turn = m.rolled / (9 * SCALE);
  for (const wx of [-120, -40]) {
    ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(wx, -8, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#8d99ae'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + Math.cos(turn) * 7, -8 + Math.sin(turn) * 7); ctx.lineTo(wx - Math.cos(turn) * 7, -8 - Math.sin(turn) * 7); ctx.stroke();
    ctx.fillStyle = '#8d99ae'; ctx.beginPath(); ctx.arc(wx, -8, 3, 0, Math.PI * 2); ctx.fill();
  }
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
  // Him: hi-vis, green trousers, a cap, one hand on the handle, the other checking the time. He leans from the
  // soles to peek round the door.
  ctx.rotate(-m.lean.x);
  // His steps follow the distance rolled: a foot bearing his weight stays put on the floor while the other swings
  // ahead with a lift that eases in and out as he starts and stops. The hips sink as the planted leg slants, so
  // it never stretches.
  const feet = [-1, 1].map((side) => { const f = footAt(m.rolled / (2 * STRIDE) + (side > 0 ? 0.75 : 0.25), STRIDE / SCALE, 12); return { side, dx: f.dx, lift: f.lift * m.walk }; });
  const lean = Math.max(0, ...feet.filter((f) => f.lift < 0.5).map((f) => Math.abs(f.dx)));
  const drop = LEG - Math.sqrt(LEG * LEG - Math.min(lean, LEG * 0.6) ** 2);
  for (const { side, dx, lift } of feet) {
    limb(ctx, { x: side * 10, y: -LEG + drop }, { x: side * 12 + dx, y: -lift }, 15, '#2e8b57');
    ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(side * 12 + dx - 12, -6 - lift, 24, 10, 4); ctx.fill(); ctx.stroke();
  }
  ctx.translate(0, drop);
  ctx.fillStyle = '#ffd60a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-28, -140, 56, 70, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8d99ae';
  ctx.fillRect(-28, -118, 56, 6); ctx.fillRect(-28, -100, 56, 6);
  ctx.fillStyle = '#2e8b57';
  ctx.fillRect(-4, -134, 8, 20); ctx.fillRect(-10, -128, 20, 8);
  const skin = '#e0bda7';
  // The handle stays on the stretcher, which neither leans nor sinks with him; peeking, he lets go of it.
  const hy0 = -62 - bounce * 3, c = Math.cos(m.lean.x), sn = Math.sin(m.lean.x);
  const grip = { x: 4 * c - hy0 * sn, y: 4 * sn + hy0 * c - drop };
  limb(ctx, { x: -28, y: -128 }, { x: grip.x + (-30 - grip.x) * peek, y: grip.y + (-68 - grip.y) * peek }, 13, skin);
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
  ctx.restore();
}
