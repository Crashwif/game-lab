/**
 * The rigs: the shiba in his wif hat with the wings he was not born with and the bag on his back, and the
 * private jet that collects him when he cashes out. A few ellipses and strokes posed from the sky's state
 * (the beat of a flap, the tilt of a dive, the spin of a clip, the rocket's flame, the fall through the
 * floor); nothing here touches the outcome.
 */
import { CYAN, GOLD, INK, MONO, PINK, ellipse, line, panel, poly, text } from './art';
import { clamp } from './motion';
import type { Drip } from './stash';

export interface ShibaPose {
  x: number;
  y: number;
  /** Nose up (negative) or down, in radians. */
  tilt: number;
  /** Seconds since the last flap: the wings beat down then up. */
  flapAge: number;
  stun: number;
  /** The bag's drawn size follows the coins with a little lag. */
  bag: number;
  drip: ReadonlySet<Drip>;
  rocket: boolean;
  magnet: boolean;
  /** Falling through the floor, 0 to 1. */
  fall: number;
  /** Struck by the FUD, 0 to 1 while the flash lasts. */
  struck: number;
  time: number;
  reduced: boolean;
}

const FUR = '#e0a35a';
const FUR_DARK = '#b8783a';
const CREAM = '#fff1d6';
const HAT = '#ff7ab6';
const HAT_DARK = '#d94f8f';

/** The bag's radius in rig px for a bag of `coins`: it swells, but never past the dog. */
export const bagRadius = (coins: number): number => 12 + 16 * clamp(Math.log10(1 + Math.max(0, coins)) / 3.4, 0, 1);

/** Smooth power stroke and eased recovery, with zero velocity at each reversal. */
export function wingBeat(age: number): number {
  const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
  return age < .12 ? smooth(age / .12) : 1 - smooth((age - .12) / .32);
}
export function wingJoints(age: number) {
  const beat = wingBeat(age), delayed = wingBeat(Math.max(0, age - .045));
  const shoulder = { x: 0, y: 0 }, a = -2.45 + beat * 1.5;
  const elbow = { x: Math.cos(a) * 25, y: Math.sin(a) * 25 };
  const b = a + .4 + (delayed - beat) * .9;
  const wrist = { x: elbow.x + Math.cos(b) * 23, y: elbow.y + Math.sin(b) * 23 };
  return { shoulder, elbow, wrist, feather: wingBeat(Math.max(0, age - .08)) - beat };
}
function wing(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, scale: number, shade: string): void {
  const { elbow: e, wrist: w, feather } = wingJoints(age);
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(e.x - 4, e.y - 10, w.x, w.y - 5);
  for (let i = 0; i < 4; i += 1) {
    const t = i / 4;
    ctx.lineTo(w.x + (e.x - w.x) * t - 5 + feather * 6, w.y + (e.y - w.y) * t + 12 - i);
    ctx.lineTo(w.x + (e.x - w.x) * (t + .2), w.y + (e.y - w.y) * (t + .2) + 5);
  }
  ctx.quadraticCurveTo(e.x + 4, e.y + 8, 0, 0); ctx.closePath();
  ctx.fillStyle = shade; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  line(ctx, [[0, 0], [e.x, e.y], [w.x, w.y]], '#d9d2c4', 1.5);
  ctx.restore();
}

export function drawShiba(ctx: CanvasRenderingContext2D, p: ShibaPose): void {
  // The wings beat down over the first tenth of a second after a flap and glide back up.
  const age = p.reduced ? .44 : p.flapAge;
  const follow = p.reduced ? 0 : wingBeat(Math.max(0, age - .06)) - wingBeat(age);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.fall > 0 && !p.reduced) ctx.rotate(p.fall * 7);
  else if (p.stun > 0 && !p.reduced) ctx.rotate(Math.sin(p.time * 30) * 0.5);
  else ctx.rotate(p.tilt);
  if (p.rocket && !p.reduced) ctx.translate(Math.sin(p.time * 60) * 1.5, Math.cos(p.time * 47) * 1.5);
  // The rocket's flame, behind him.
  if (p.rocket) {
    const flick = p.reduced ? 1 : 0.85 + Math.sin(p.time * 40) * 0.15;
    poly(ctx, [[-30, -8], [-78 * flick, 0], [-30, 8]], '#ffaf42');
    poly(ctx, [[-30, -4], [-56 * flick, 0], [-30, 4]], '#fff6c8');
  }
  // The far wing, the tail, the body, the near wing.
  wing(ctx, -6, -14, Math.max(0, age - .018), 0.75, '#c9c2b8');
  ctx.beginPath();
  ctx.arc(-34, -6, 12, Math.PI * 0.6, Math.PI * 2.2);
  ctx.strokeStyle = FUR;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-34, -6, 17.5, Math.PI * 0.6, Math.PI * 2.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-34, -6, 6.5, Math.PI * 0.6, Math.PI * 2.2);
  ctx.stroke();
  ellipse(ctx, 0, 0, 30, 21, FUR, INK, 2.5);
  ellipse(ctx, 6, 8, 20, 11, CREAM);
  // Legs tucked under.
  for (const dx of [-12, 8]) {
    line(ctx, [[dx, 14], [dx - 3, 26]], FUR_DARK, 7);
    ellipse(ctx, dx - 3, 27, 5, 3.5, CREAM, INK, 1.5);
  }
  // The bag on his back.
  const r = bagRadius(p.bag);
  ctx.save();
  ctx.translate(-8, -26);
  ctx.rotate(0.2 + follow * .22);
  ellipse(ctx, 0, 0, r, r * 0.96, '#a8642a', '#6e3f14', 2.5);
  ellipse(ctx, 0, -r * 0.92, r * 0.4, r * 0.2, '#6e3f14', INK, 1.5);
  text(ctx, '$', 0, r * 0.06, r * 1.2, '#f7e2a0', 'center');
  ctx.restore();
  wing(ctx, 2, -12, age, 1, '#fff');
  // The head, the snout, the ears and the wif hat.
  ellipse(ctx, 20, -14, 20, 19, FUR, INK, 2.5);
  ellipse(ctx, 34, -8, 11, 8, CREAM, INK, 2);
  ellipse(ctx, 42, -11, 4, 3.2, INK);
  line(ctx, [[36, -4], [40, -1]], INK, 2);
  ellipse(ctx, 27, -6, 4, 2.5, '#f7b5a0');
  poly(ctx, [[5, -28], [10, -44], [18, -30]], FUR, INK, 2);
  poly(ctx, [[22, -30], [30, -46], [36, -28]], FUR, INK, 2);
  ctx.save(); ctx.translate(20, -30); ctx.rotate(follow * .12); ctx.translate(-20, 30);
  ctx.beginPath();
  ctx.arc(20, -30, 19, Math.PI, 0);
  ctx.fillStyle = HAT;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  panel(ctx, 0, -34, 40, 9, HAT_DARK, INK, 3, 2);
  ellipse(ctx, 20, -50, 6, 6, '#fff', INK, 2);
  if (p.drip.has('crown')) poly(ctx, [[8, -52], [12, -64], [16, -54], [20, -66], [24, -54], [28, -64], [32, -52]], GOLD, '#8a6a00', 2);
  ctx.restore();
  // The eye: a squint, shades when earned, lasers when really earned.
  if (p.drip.has('shades')) {
    panel(ctx, 14, -22, 26, 10, INK, undefined, 2);
    line(ctx, [[14, -19], [4, -21]], INK, 3);
  } else {
    ellipse(ctx, 26, -18, 3.5, 3.5, INK);
    ellipse(ctx, 27, -19, 1.2, 1.2, '#fff');
    line(ctx, [[19, -24], [31, -25]], INK, 2);
  }
  if (p.drip.has('lasers')) {
    ctx.save();
    ctx.globalAlpha = p.reduced ? 0.6 : 0.5 + Math.sin(p.time * 20) * 0.2;
    line(ctx, [[27, -19], [700, -19 - 60 * p.tilt]], '#ff2d55', 8);
    line(ctx, [[27, -19], [700, -19 - 60 * p.tilt]], '#fff0f3', 2.5);
    ctx.restore();
  }
  if (p.drip.has('chain')) {
    ctx.beginPath();
    ctx.arc(14, -6, 14, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.stroke();
    ellipse(ctx, 14, 9, 5, 5, GOLD, '#8a6a00', 1.5);
    text(ctx, '$', 14, 9.5, 7, '#6b4a00', 'center');
  }
  if (p.magnet) {
    ctx.beginPath();
    ctx.ellipse(6, -8, 60, 50, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(95, 242, 230, 0.65)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = p.reduced ? 0 : -p.time * 60;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (p.struck > 0) {
    ctx.globalAlpha = p.struck;
    ellipse(ctx, 0, -6, 46, 40, 'rgba(255, 245, 180, 0.6)');
  }
  ctx.restore();
}

export interface JetPose {
  x: number;
  y: number;
  time: number;
  /** Banking, in radians. */
  bank: number;
  reduced: boolean;
}

/** The private jet: a white fuselage, a swept wing, engines under the tail and the name of the airline. */
export function drawJet(ctx: CanvasRenderingContext2D, p: JetPose): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.bank);
  const glow = p.reduced ? 1 : 0.8 + Math.sin(p.time * 30) * 0.2;
  for (const dy of [-6, 8]) {
    poly(ctx, [[-70, dy - 4], [-118 * glow, dy], [-70, dy + 4]], `rgba(95, 242, 230, ${0.6 * glow})`);
  }
  poly(ctx, [[-20, 6], [-40, 34], [20, 34], [46, 6]], '#c9d4e2', INK, 2);
  ellipse(ctx, 0, 0, 84, 16, '#f4f7fb', INK, 2.5);
  poly(ctx, [[-84, -2], [-96, -30], [-70, -30], [-52, -4]], '#f4f7fb', INK, 2);
  for (const dy of [-6, 8]) panel(ctx, -76, dy - 5, 22, 10, '#8a94b8', INK, 4, 1.5);
  for (let i = 0; i < 5; i += 1) ellipse(ctx, -30 + i * 18, -5, 4, 4, '#1d2440', '#8a94b8', 1);
  poly(ctx, [[62, -8], [84, 0], [62, 8]], '#1d2440');
  text(ctx, 'EXIT LIQUIDITY AIR', -2, 5, 7, '#3b4a6b', 'center', 100, MONO);
  ctx.restore();
  void CYAN;
  void PINK;
}
