/**
 * The SEC intern in the bush: the reason the balloon pops. He rises out of the
 * shrubbery once the pump has something to aim at, draws a slingshot back
 * further and further with the multiplier (the anticipation the crash pays
 * off), trembles near the top, and fires on the crash. The stone crosses to
 * the balloon in a few frames, then the burst plays. Nothing here changes the
 * committed outcome: he only ever fires when the server says the round is over.
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import type { Point } from './pumper';

const INK = '#1c1f26';
const BUSH = { x: 886, y: 446 } as const;
/** Where the fork of the slingshot sits when he is fully up. */
const FORK = { x: 862, y: 372 } as const;
/** How far the pouch pulls back at full draw, and how long the stone is in the air. */
const PULL = 46;
export const FLIGHT_S = 0.12;
/** The intern is drawn this much larger about the foot of the bush, so his gear reads from across the lawn. */
const SCALE = 1.3;
/** A point of the intern's own drawing in scene coordinates. */
const world = (p: Point): Point => ({ x: BUSH.x + (p.x - BUSH.x) * SCALE, y: BUSH.y + (p.y - BUSH.y) * SCALE });
const FORK_WORLD = world(FORK);

export interface Sniper {
  /** 0 hidden in the bush .. 1 up and aiming. */
  rise: Spring;
  /** 0 slack .. 1 fully drawn. */
  draw: Spring;
  /** 1 while the bands snap forward after the shot. */
  snap: Spring;
  aim: Spring;
  /** The stone in flight: from the pouch to the balloon, 0 .. 1; -1 none. */
  flight: number;
  from: Point;
  to: Point;
  fired: boolean;
  tongue: Spring;
  time: number;
  /** The draw thresholds crossed this step (for a ratchet sound). */
  events: { notch: boolean; up: boolean };
  notches: number;
}

export function createSniper(): Sniper {
  return { rise: spring(0), draw: spring(0), snap: spring(0), aim: spring(-1.2), flight: -1, from: { ...FORK }, to: { ...FORK }, fired: false, tongue: spring(0), time: 0, events: { notch: false, up: false }, notches: 0 };
}

export function resetSniper(s: Sniper): void {
  settleSpring(s.rise, 0);
  settleSpring(s.draw, 0);
  settleSpring(s.snap, 0);
  settleSpring(s.tongue, 0);
  s.flight = -1;
  s.fired = false;
  s.notches = 0;
}

export interface SniperDrive {
  /** log2 of the multiplier. */
  growth: number;
  running: boolean;
  /** The balloon's centre, which he aims at; null once it is gone. */
  target: Point | null;
}

/** Jumps to the pose a round already under way calls for. */
export function settleSniper(s: Sniper, drive: SniperDrive): void {
  const up = drive.running ? smoothstep(0.6, 1.1, drive.growth) : 0;
  settleSpring(s.rise, up);
  settleSpring(s.draw, drive.running ? smoothstep(0.9, 3.6, drive.growth) : 0);
  s.notches = Math.floor(s.draw.x * 4);
  if (drive.target) settleSpring(s.aim, Math.atan2(drive.target.y - FORK_WORLD.y, drive.target.x - FORK_WORLD.x));
}

export function stepSniper(s: Sniper, drive: SniperDrive, dt: number): void {
  s.time += dt;
  const up = drive.running && !s.fired ? smoothstep(0.6, 1.1, drive.growth) : s.fired ? 0.55 : 0;
  const wasUp = s.rise.x > 0.5;
  stepSpring(s.rise, up, 6, 0.55, dt);
  s.events.up = !wasUp && s.rise.x > 0.5;
  const draw = drive.running && !s.fired ? smoothstep(0.9, 3.6, drive.growth) : 0;
  stepSpring(s.draw, draw, 4, 0.9, dt);
  const notches = Math.floor(clamp(s.draw.x, 0, 0.999) * 4);
  s.events.notch = notches > s.notches;
  s.notches = notches;
  if (drive.target) {
    const angle = Math.atan2(drive.target.y - FORK_WORLD.y, drive.target.x - FORK_WORLD.x);
    stepSpring(s.aim, angle, 5, 0.8, dt);
  }
  stepSpring(s.snap, 0, 30, 0.35, dt);
  stepSpring(s.tongue, s.draw.x > 0.5 && !s.fired ? 1 : 0, 8, 0.8, dt);
  if (s.flight >= 0) {
    s.flight += dt / FLIGHT_S;
    if (s.flight >= 1) s.flight = -1;
  }
}

/** The shot: the stone leaves the pouch for `target`. */
export function fire(s: Sniper, target: Point): void {
  s.fired = true;
  s.from = world(pouch(s));
  s.to = target;
  s.flight = 0;
  s.snap.v = 40;
  settleSpring(s.draw, 0);
}

function pouch(s: Sniper): Point {
  const back = s.aim.x + Math.PI;
  const d = 6 + PULL * clamp(s.draw.x, 0, 1);
  return { x: FORK.x + Math.cos(back) * d, y: FORK.y + Math.sin(back) * d - 40 * (1 - s.rise.x) };
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    const rr = r * (0.85 + 0.15 * noise(i * 3.7 + x));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.8;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** The back of the bush: drawn before the intern. */
export function drawBushBack(ctx: CanvasRenderingContext2D): void {
  blob(ctx, BUSH.x + 20, BUSH.y - 34, 40, '#2f7a4d');
  blob(ctx, BUSH.x - 26, BUSH.y - 26, 34, '#2b6f46');
}

/** The intern and his slingshot, then the front of the bush over his legs. */
export function drawSniper(ctx: CanvasRenderingContext2D, s: Sniper): void {
  const rise = clamp(s.rise.x, 0, 1.1);
  if (rise > 0.02) {
    const drop = 40 * (1 - rise);
    const tremble = s.draw.x * s.draw.x * (s.fired ? 0 : 1);
    const jx = (noise(Math.floor(s.time * 31)) - 0.5) * 5 * tremble;
    const jy = (noise(Math.floor(s.time * 29) + 7) - 0.5) * 4 * tremble;
    ctx.save();
    ctx.translate(BUSH.x, BUSH.y);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-BUSH.x, -BUSH.y);
    ctx.translate(jx, drop + jy);
    const head = { x: BUSH.x + 4, y: 356 };
    // Shoulders and torso peeking out.
    ctx.fillStyle = '#26364a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(head.x - 26, head.y + 20, 52, 60, 10);
    ctx.fill();
    ctx.stroke();
    // A lanyard, so everyone knows he is here on business.
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(head.x - 12, head.y + 22);
    ctx.lineTo(head.x, head.y + 48);
    ctx.lineTo(head.x + 12, head.y + 22);
    ctx.stroke();
    ctx.fillStyle = '#f2f2f2';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(head.x - 8, head.y + 46, 16, 11, 2);
    ctx.fill();
    ctx.stroke();
    // The head, the cap and the face: eyes narrowed down the shot, tongue out with the effort.
    ctx.fillStyle = '#f3dccb';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1b3a6b';
    ctx.beginPath();
    ctx.arc(head.x, head.y - 2, 21, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(head.x - 36, head.y - 8, 34, 8, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 9px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SEC', head.x, head.y - 12);
    const squint = 1 - 0.6 * clamp(s.draw.x, 0, 1);
    ctx.fillStyle = INK;
    for (const ex of [-8, 6]) {
      ctx.beginPath();
      ctx.ellipse(head.x + ex, head.y + 2, 3, 3.5 * squint + 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(head.x - 6, head.y + 10);
    ctx.quadraticCurveTo(head.x, head.y + 8 + 4 * s.tongue.x, head.x + 5, head.y + 10);
    ctx.stroke();
    if (s.tongue.x > 0.1) {
      ctx.fillStyle = '#ff6f8f';
      ctx.beginPath();
      ctx.ellipse(head.x + 1, head.y + 12 + 3 * s.tongue.x, 4 * s.tongue.x, 5 * s.tongue.x, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // The slingshot: a Y fork held out toward the balloon, bands back to the pouch in the other hand.
    const fork = { x: FORK.x, y: FORK.y };
    const aim = s.aim.x;
    const across = { x: -Math.sin(aim), y: Math.cos(aim) };
    const tipA = { x: fork.x + across.x * 11, y: fork.y + across.y * 11 };
    const tipB = { x: fork.x - across.x * 11, y: fork.y - across.y * 11 };
    const p = pouch({ ...s, rise: spring(1) });
    const snapped = { x: mix(p.x, fork.x + Math.cos(aim) * 8, clamp(s.snap.x, 0, 1)), y: mix(p.y, fork.y + Math.sin(aim) * 8, clamp(s.snap.x, 0, 1)) };
    // Arm to the fork.
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(head.x - 22, head.y + 34);
    ctx.lineTo(fork.x + 4, fork.y + 16);
    ctx.stroke();
    ctx.strokeStyle = '#f3dccb';
    ctx.lineWidth = 5.5;
    ctx.stroke();
    // The fork.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(fork.x + 2, fork.y + 18);
    ctx.lineTo(fork.x, fork.y);
    ctx.lineTo(tipA.x, tipA.y);
    ctx.moveTo(fork.x, fork.y);
    ctx.lineTo(tipB.x, tipB.y);
    ctx.stroke();
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Bands, the pouch and the stone.
    ctx.strokeStyle = '#c9a15c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tipA.x, tipA.y);
    ctx.lineTo(snapped.x, snapped.y);
    ctx.moveTo(tipB.x, tipB.y);
    ctx.lineTo(snapped.x, snapped.y);
    ctx.stroke();
    // The drawing hand and its arm.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(head.x + 22, head.y + 36);
    ctx.lineTo(snapped.x + 6, snapped.y + 4);
    ctx.stroke();
    ctx.strokeStyle = '#f3dccb';
    ctx.lineWidth = 5.5;
    ctx.stroke();
    ctx.fillStyle = '#4b3a2c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(snapped.x, snapped.y, 6, 4.5, aim, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (s.flight < 0 && !s.fired) {
      ctx.fillStyle = '#9aa3ad';
      ctx.beginPath();
      ctx.arc(snapped.x, snapped.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  blob(ctx, BUSH.x, BUSH.y - 14, 46, '#3f8a5a');
  blob(ctx, BUSH.x + 44, BUSH.y - 8, 30, '#4a9a66');
  blob(ctx, BUSH.x - 44, BUSH.y - 10, 28, '#3a8455');
}

/** The stone in the air, drawn over the balloon it is about to hit. */
export function drawStone(ctx: CanvasRenderingContext2D, s: Sniper): void {
  if (s.flight >= 0) {
    const t = s.flight;
    const x = mix(s.from.x, s.to.x, t);
    const y = mix(s.from.y, s.to.y, t) - 18 * Math.sin(Math.PI * t);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mix(s.from.x, s.to.x, Math.max(0, t - 0.25)), mix(s.from.y, s.to.y, Math.max(0, t - 0.25)));
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#9aa3ad';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
