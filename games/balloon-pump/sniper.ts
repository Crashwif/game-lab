/**
 * The SEC intern in the bush: the reason the balloon pops. Once the balloon is
 * up he peeks out of the shrubbery, ducks back (probably nothing), then rises
 * with a slingshot and draws it back one ratchet notch per milestone (the
 * anticipation the crash pays off), trembling as the pull gets long. He fires
 * on the crash: the stone crosses to the balloon in a few frames, then the
 * burst plays. Nothing here changes the committed outcome: he only ever fires
 * when the server says the round is over.
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type Point, bendJoint } from './pumper';

const INK = '#1c1f26';
const SKIN = '#f3dccb';
const JACKET = '#26364a';
const BUSH = { x: 886, y: 446 } as const;
/** His head when fully up, and how far below that he crouches out of sight. */
const HEAD = { x: BUSH.x + 4, y: 356 } as const;
const HIDE = 84;
/** The shoulders, the arm bones, and the cheek he draws the pouch back to. */
const FORE_SHOULDER = { x: HEAD.x - 22, y: HEAD.y + 34 };
const DRAW_SHOULDER = { x: HEAD.x + 22, y: HEAD.y + 36 };
const BONE = 24;
const REACH = 2 * BONE - 2;
const CHEEK = { x: HEAD.x + 16, y: HEAD.y + 10 };
/** The multiplier rungs (as log2) that each click the slingshot back a notch. */
const NOTCHES = [1.5, 2, 3, 5].map(Math.log2);
/** Rungs where he stirs the bush: before the peek, the peek, the duck, the rise. */
const RUSTLES = [0.12, 0.2, 0.34, 0.42];
export const FLIGHT_S = 0.12;
/** The intern is drawn this much larger about the foot of the bush, so his gear reads from across the lawn. */
const SCALE = 1.3;
/** A point of the intern's own drawing in scene coordinates. */
const world = (p: Point): Point => ({ x: BUSH.x + (p.x - BUSH.x) * SCALE, y: BUSH.y + (p.y - BUSH.y) * SCALE });
const CHEEK_WORLD = world(CHEEK);

export interface Sniper {
  /** 0 hidden in the bush .. 1 up and aiming. */
  rise: Spring;
  /** 0 slack .. 1 fully drawn. */
  draw: Spring;
  /** 0 the pouch in his hand .. 1 snapped forward to the fork after the shot. */
  snap: Spring;
  aim: Spring;
  /** The bush shaking as he moves in it. */
  rustle: Spring;
  /** The stone in flight: from the pouch (in his own drawing, so it leaves with him as he pops up) to the balloon, 0 .. 1; -1 none. */
  flight: number;
  from: Point;
  to: Point;
  fired: boolean;
  tongue: Spring;
  time: number;
  /** Seconds to the next fidget in the bush between rounds, and how many so far (seeding the next gap). */
  lurk: number;
  fidgets: number;
  /** 0..1 long-round strain (10× to 1000×): a shakier hold. */
  strain: number;
  /** Drops the bush shake and the tremble for reduced motion. */
  reduced: boolean;
  /** The draw thresholds crossed this step (for a ratchet sound). */
  events: { notch: boolean; up: boolean };
  notches: number;
  rustles: number;
}

export function createSniper(reduced = false): Sniper {
  return {
    rise: spring(0), draw: spring(0), snap: spring(0), aim: spring(Math.PI), rustle: spring(0), flight: -1, from: { ...CHEEK }, to: { ...CHEEK_WORLD },
    fired: false, tongue: spring(0), time: 0, lurk: 1.2, fidgets: 0, strain: 0, reduced, events: { notch: false, up: false }, notches: 0, rustles: 0,
  };
}

/** A new round: he sinks back into the bush on his own spring rather than vanishing. */
export function resetSniper(s: Sniper): void {
  settleSpring(s.tongue, 0);
  s.flight = -1;
  s.fired = false;
  s.notches = 0;
  s.rustles = 0;
}

export interface SniperDrive {
  /** log2 of the multiplier. */
  growth: number;
  running: boolean;
  /** Betting: he fidgets in the bush. */
  ready?: boolean;
  /** 0..1 long-round strain (10× to 1000×). */
  strain: number;
  /** The balloon's centre, which he aims at; null once it is gone. */
  target: Point | null;
}

/** How far up he is: a peek at 1.15×, a duck back at 1.27× (probably nothing), then all the way up from 1.34× to 1.47×. */
function upFor(growth: number): number {
  const peek = 0.42 * smoothstep(0.2, 0.3, growth) * (1 - smoothstep(0.34, 0.39, growth));
  return Math.max(peek, smoothstep(0.42, 0.56, growth));
}
/** The pull once he is up, 1 - x^-1.1: half drawn at 2×, 70% at 3×, still creeping at 10×. */
const drawFor = (growth: number): number => (1 - 2 ** (-1.1 * growth)) * smoothstep(0.42, 0.56, growth);
const crossed = (rungs: number[], growth: number): number => rungs.filter((g) => growth >= g).length;

/** Jumps to the pose a round already under way calls for. */
export function settleSniper(s: Sniper, drive: SniperDrive): void {
  settleSpring(s.rise, drive.running ? upFor(drive.growth) : 0);
  settleSpring(s.draw, drive.running ? drawFor(drive.growth) : 0);
  s.notches = drive.running ? crossed(NOTCHES, drive.growth) : 0;
  s.rustles = drive.running ? crossed(RUSTLES, drive.growth) : 0;
  s.strain = drive.strain;
  if (drive.target) settleSpring(s.aim, Math.atan2(drive.target.y - CHEEK_WORLD.y, drive.target.x - CHEEK_WORLD.x));
}

export function stepSniper(s: Sniper, drive: SniperDrive, dt: number): void {
  s.time += dt;
  const live = drive.running && !s.fired;
  const wasUp = s.rise.x > 0.5;
  stepSpring(s.rise, live ? upFor(drive.growth) : s.fired ? 0.55 : 0, 6, 0.55, dt);
  s.events.up = live && !wasUp && s.rise.x > 0.5;
  stepSpring(s.draw, live ? drawFor(drive.growth) : 0, 4, 0.9, dt);
  const notches = live ? crossed(NOTCHES, drive.growth) : 0;
  s.events.notch = notches > s.notches;
  // Each notch clicks the pouch back a touch further and shakes the leaves.
  if (s.events.notch) { s.draw.v += 0.9; s.rustle.v += 10; }
  s.notches = notches;
  const rustles = live ? crossed(RUSTLES, drive.growth) : 0;
  if (rustles > s.rustles) s.rustle.v += 30;
  s.rustles = rustles;
  if (drive.ready) {
    s.lurk -= dt;
    if (s.lurk <= 0) { s.rustle.v += 22; s.fidgets += 1; s.lurk += 1.9 + 1.4 * noise(s.fidgets); }
  } else s.lurk = 1.2;
  s.strain = drive.strain;
  if (drive.target) {
    // Steer to the nearest equivalent angle, so a balloon crossing straight left never swings him the long way round.
    const turn = Math.atan2(drive.target.y - CHEEK_WORLD.y, drive.target.x - CHEEK_WORLD.x) - s.aim.x;
    stepSpring(s.aim, s.aim.x + Math.atan2(Math.sin(turn), Math.cos(turn)), 5, 0.8, dt);
  }
  stepSpring(s.snap, s.fired ? 1 : 0, 30, 0.35, dt);
  stepSpring(s.rustle, 0, 24, 0.2, dt);
  stepSpring(s.tongue, s.draw.x > 0.5 && !s.fired ? 1 : 0, 8, 0.8, dt);
  if (s.flight >= 0) {
    s.flight += dt / FLIGHT_S;
    if (s.flight >= 1) s.flight = -1;
  }
}

const drop = (s: Sniper): number => HIDE * (1 - clamp(s.rise.x, 0, 1.1));

/** The shot: the stone leaves the pouch for `target`, and he pops up out of the bush with it. */
export function fire(s: Sniper, target: Point): void {
  s.from = sling(s).pouch;
  s.fired = true;
  s.to = target;
  s.flight = 0;
  // Just enough to bring him up to full height from wherever he crouched, before he ducks back to half.
  s.rise.v = Math.max(s.rise.v, 1.5 + 7.5 * (1 - clamp(s.rise.x, 0, 1)));
  s.rustle.v += 28;
}

/** The largest step along `dir` from `from`, up to `t`, that keeps a hand within reach of `root`. */
function within(root: Point, from: Point, dir: Point, t: number): number {
  const ox = from.x - root.x;
  const oy = from.y - root.y;
  const b = ox * dir.x + oy * dir.y;
  const disc = b * b - ox * ox - oy * oy + REACH * REACH;
  return disc > 0 ? Math.min(t, -b + Math.sqrt(disc)) : t;
}

/**
 * The slingshot in his own drawing at full rise, laid along the aim through his cheek so the pouch, the fork
 * and the balloon line up: the fork arm pushes out as he draws, and the drawing hand comes back to the cheek.
 */
function sling(s: Sniper) {
  const dir = { x: Math.cos(s.aim.x), y: Math.sin(s.aim.x) };
  const up = { x: -dir.y, y: dir.x };
  const draw = clamp(s.draw.x, 0, 1);
  const along = (p: Point, t: number): Point => ({ x: p.x + dir.x * t, y: p.y + dir.y * t });
  const stem = { x: CHEEK.x - up.x * 19, y: CHEEK.y - up.y * 19 };
  const reach = within(FORE_SHOULDER, stem, dir, mix(58, 74, draw));
  const gap = along(CHEEK, reach);
  const grip = along(stem, reach);
  const hand = along(CHEEK, within(DRAW_SHOULDER, CHEEK, dir, mix(26, 0, draw)));
  const held = along(hand, -4);
  const snap = clamp(s.snap.x, -0.2, 1.3);
  const pouch = { x: mix(held.x, gap.x + dir.x * 4, snap), y: mix(held.y, gap.y + dir.y * 4, snap) };
  return { dir, up, gap, grip, hand, pouch };
}

/** A lumpy bush blob; `dx` shifts it without changing its outline, which is keyed to `x`. */
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, dx = 0): void {
  ctx.fillStyle = colour;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    const rr = r * (0.85 + 0.15 * noise(i * 3.7 + x));
    const px = x + dx + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.8;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** How far the leaves are pushed aside: a little for the back of the bush, more for the front. */
const shake = (s: Sniper): number => (s.reduced ? 0 : 5 * s.rustle.x);

/** The back of the bush: drawn before the intern. */
export function drawBushBack(ctx: CanvasRenderingContext2D, s: Sniper): void {
  const k = shake(s);
  blob(ctx, BUSH.x + 20, BUSH.y - 34, 40, '#2f7a4d', k * 0.6);
  blob(ctx, BUSH.x - 26, BUSH.y - 26, 34, '#2b6f46', -k * 0.5);
}

/** One arm: a sleeve to the elbow, a cuff, and a hand at `end`. */
function arm(ctx: CanvasRenderingContext2D, root: Point, end: Point, side: number): void {
  const elbow = bendJoint(root, end, BONE, BONE, side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(root.x, root.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(end.x, end.y); ctx.stroke();
  ctx.strokeStyle = JACKET;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(end.x, end.y, 4.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

/** The intern and his slingshot, then the front of the bush over his legs. */
export function drawSniper(ctx: CanvasRenderingContext2D, s: Sniper): void {
  const rise = clamp(s.rise.x, 0, 1.1);
  if (rise > 0.02) {
    const tremble = s.fired || s.reduced ? 0 : s.draw.x * s.draw.x * (1 + 0.6 * s.strain);
    const jx = (noise(Math.floor(s.time * 31)) - 0.5) * 5 * tremble;
    const jy = (noise(Math.floor(s.time * 29) + 7) - 0.5) * 4 * tremble;
    ctx.save();
    // Below the lawn he is under the ground, not in front of it.
    ctx.beginPath();
    ctx.rect(BUSH.x - 200, 0, 400, BUSH.y);
    ctx.clip();
    ctx.translate(BUSH.x, BUSH.y);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-BUSH.x, -BUSH.y);
    ctx.translate(jx, drop(s) + jy);
    const head = HEAD;
    // Shoulders and torso peeking out.
    ctx.fillStyle = JACKET;
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
    ctx.moveTo(head.x - 11, head.y + 21);
    ctx.lineTo(head.x - 5, head.y + 28);
    ctx.moveTo(head.x + 11, head.y + 21);
    ctx.lineTo(head.x + 5, head.y + 28);
    ctx.stroke();
    ctx.fillStyle = '#f7f4ea';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(head.x - 16, head.y + 27, 32, 16, 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '900 6.5px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c62828';
    ctx.fillText('WELLS', head.x, head.y + 31.5, 28);
    ctx.fillStyle = INK;
    ctx.fillText('NOTICE', head.x, head.y + 38, 28);
    // The head, the cap and the face: eyes narrowed down the shot, tongue out with the effort.
    ctx.fillStyle = SKIN;
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
    // The slingshot: the fork held out at arm's length toward the balloon, the bands back to the pouch at his cheek.
    const { dir, up, gap, grip, hand, pouch } = sling(s);
    const crotch = { x: gap.x - up.x * 10, y: gap.y - up.y * 10 };
    const tipA = { x: gap.x + dir.x * 6, y: gap.y + dir.y * 6 };
    const tipB = { x: gap.x - dir.x * 6, y: gap.y - dir.y * 6 };
    arm(ctx, FORE_SHOULDER, grip, -1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(crotch.x - up.x * 13, crotch.y - up.y * 13);
    ctx.lineTo(crotch.x, crotch.y);
    ctx.lineTo(tipA.x, tipA.y);
    ctx.moveTo(crotch.x, crotch.y);
    ctx.lineTo(tipB.x, tipB.y);
    ctx.stroke();
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(grip.x, grip.y, 4.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Bands, sagging while slack, the pouch and the stone.
    const sag = 5 * (1 - clamp(s.draw.x, 0, 1));
    ctx.strokeStyle = '#c9a15c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const tip of [tipA, tipB]) {
      ctx.moveTo(tip.x, tip.y);
      ctx.quadraticCurveTo((tip.x + pouch.x) / 2, (tip.y + pouch.y) / 2 + sag, pouch.x, pouch.y);
    }
    ctx.stroke();
    ctx.fillStyle = '#4b3a2c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(pouch.x, pouch.y, 6, 4.5, s.aim.x, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (s.flight < 0 && !s.fired) {
      ctx.fillStyle = '#9aa3ad';
      ctx.beginPath();
      ctx.arc(pouch.x, pouch.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // The drawing arm, elbow out, pinching the pouch.
    arm(ctx, DRAW_SHOULDER, hand, 1);
    ctx.restore();
  }
  const k = shake(s);
  blob(ctx, BUSH.x, BUSH.y - 14, 46, '#3f8a5a', k);
  blob(ctx, BUSH.x + 44, BUSH.y - 8, 30, '#4a9a66', -k * 0.7);
  blob(ctx, BUSH.x - 44, BUSH.y - 10, 28, '#3a8455', k * 0.8);
}

/** The stone in the air, drawn over the balloon it is about to hit. */
export function drawStone(ctx: CanvasRenderingContext2D, s: Sniper): void {
  if (s.flight >= 0) {
    const t = s.flight;
    const from = world({ x: s.from.x, y: s.from.y + drop(s) });
    const x = mix(from.x, s.to.x, t);
    const y = mix(from.y, s.to.y, t) - 18 * Math.sin(Math.PI * t);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mix(from.x, s.to.x, Math.max(0, t - 0.25)), mix(from.y, s.to.y, Math.max(0, t - 0.25)));
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
