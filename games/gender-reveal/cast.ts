/**
 * The party: Sheila with the clipboard, the walkie and the megaphone; Tanner in jorts with his sunglasses on a
 * lanyard and Destiny in her MAMA TO BE sash, either side of the box; Grandpa Hal in his lawn chair with the
 * key; Grandma Pauline and Grandma Bev, a mirrored profile pair gripping one plate; Kyle in scrubs under the
 * dessert table, then on a stool behind it with a headset, then over the back fence; Uncle Dale over the fence
 * line; Worker 2 behind the bounce house, then in a hazmat suit; the folding-chair semicircle seen from behind;
 * and the player's plus-one, nearest the side gate, who on an accepted cash-out takes the last slice and leaves
 * through the gate. Everyone breathes, blinks and looks on their own seeded clock; reactions ride springs with
 * their own frequencies; arms that hold or reach are two-bone IK. Rigs and drawing only; nothing here picks or
 * changes the outcome.
 */
import { blob, box, cached, INK, ink, label, layer, limb, lines, poly } from './ink';
import { solveLimb, walkingFoot } from './kinematics';
import { clamp, fract, mix, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';
import { AT } from './lines';
import { drawSlice, FENCE_TOP, PLATE, TABLE } from './yard';

type P = { x: number; y: number };

// ─── Where everyone is ──────────────────────────────────────────────────────────────────────────────────────
export const SHEILA = { x: 262, y: 432, s: 1 } as const;
export const TANNER = { x: 376, y: 414, s: 0.96 } as const;
export const DESTINY = { x: 568, y: 414, s: 0.94 } as const;
export const HAL = { x: 118, y: 452 } as const;
export const PAULINE = { x: 730, y: 450, s: 0.88 } as const;
export const BEV = { x: 834, y: 450, s: 0.88 } as const;
const KYLE_STOOL = { x: 664, y: TABLE.top } as const;
const KYLE_UNDER = { x: 600, y: 412 } as const;
export const DALE = { x: 290, y: FENCE_TOP } as const;
const WORKER_PEEK = { x: 884, y: 298 } as const;
const WORKER_SUIT = { x: 934, y: 392 } as const;
export const YOU_SEAT = { x: 878, y: 452 } as const;
const YOU = { x: YOU_SEAT.x, y: YOU_SEAT.y, s: 1, hair: '#2a3b4a', shirt: '#e0a83a', style: 9 };
/** The folding chairs, seen from behind: head positions, scale, and the relative in each. */
const CROWD = [
  { x: 64, y: 452, s: 0.92, hair: '#d8d2c8', shirt: '#8aa7c9', style: 1 },
  { x: 202, y: 474, s: 1, hair: '#3a2a24', shirt: '#e8a0a0', style: 2 },
  { x: 334, y: 492, s: 1.06, hair: '#a0522d', shirt: '#7fbf8f', style: 3 },
  { x: 612, y: 492, s: 1.06, hair: '#1c1420', shirt: '#c9a0dc', style: 4 },
  { x: 748, y: 474, s: 1, hair: '#8a6a4a', shirt: '#f2c46b', style: 0 },
] as const;

const SKIN = { sheila: '#f3d2b5', tanner: '#f0c8a4', destiny: '#d9a27e', hal: '#f1cfb6', pauline: '#f6dcc8', bev: '#e8b998', kyle: '#c98e68', dale: '#efbf9a', worker: '#8d5a3c', you: '#e8b998' } as const;

// ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────
interface Actor {
  seed: number;
  lookX: Spring;
  lookY: Spring;
  /** A take: a jolt of the head when something lands, on a fast spring. */
  kick: Spring;
  /** Slower secondary motion: a lean that lags behind the take. */
  lean: Spring;
}
const actor = (seed: number): Actor => ({ seed, lookX: spring(0), lookY: spring(0), kick: spring(0), lean: spring(0) });

export interface Cast {
  sheila: Actor;
  tanner: Actor;
  destiny: Actor;
  hal: Actor;
  pauline: Actor;
  bev: Actor;
  kyle: Actor;
  dale: Actor;
  worker: Actor;
  crowd: Actor[];
  you: Actor;
  /** Sheila's megaphone up (0..1), Tanner's mic up, Hal's key fist, Kyle up from under the table, Dale up over the fence, Worker 2's peek. */
  megaphone: Spring;
  mic: Spring;
  key: Spring;
  sleep: Spring;
  kyleOut: Spring;
  kyleUp: Spring;
  daleUp: Spring;
  peek: Spring;
  /** The keychain tag's swing, a pendulum on Hal's fist. */
  tag: Spring;
  /** The crowd's gasp and the crash jolt. */
  gasp: Spring;
}

export function createCast(): Cast {
  return {
    sheila: actor(1.3), tanner: actor(2.7), destiny: actor(4.1), hal: actor(5.9), pauline: actor(7.3), bev: actor(8.8), kyle: actor(10.2), dale: actor(11.6), worker: actor(13.1),
    crowd: CROWD.map((_, i) => actor(20 + i * 3.3)), you: actor(40.5),
    megaphone: spring(0), mic: spring(0), key: spring(0), sleep: spring(0), kyleOut: spring(0), kyleUp: spring(0), daleUp: spring(0), peek: spring(0), tag: spring(0), gasp: spring(0),
  };
}

export function resetCast(c: Cast): void {
  Object.assign(c, createCast());
}

export interface CastDrive {
  running: boolean;
  crashed: boolean;
  tension: number;
  multiplier: number;
  time: number;
  /** Seconds since a beat, or -1. */
  beat: (name: string) => number;
  /** How hard `who` is talking (0..1), and who said the newest live line. */
  talk: (who: string) => number;
  speaker: string | null;
  /** Lines said this frame (their speakers), for the takes. */
  said: string[];
  /** Seconds of crash (warped), or -1. */
  crashT: number;
  /** Seconds since the plus-one's exit was confirmed, or -1. */
  exitAge: number;
  /** The player is in the round (the plus-one wears the +1 YOU tag). */
  playing: boolean;
}

/** Where each speaker's face is right now, for their bubble and everyone's eyes. */
export function headOf(c: Cast, who: string, d: Pick<CastDrive, 'beat' | 'crashT' | 'exitAge' | 'time'>): P {
  switch (who) {
    case 'sheila': return { x: SHEILA.x, y: SHEILA.y - 150 * SHEILA.s };
    case 'tanner': return { x: TANNER.x, y: TANNER.y - 150 * TANNER.s };
    case 'destiny': return { x: DESTINY.x, y: DESTINY.y - 150 * DESTINY.s };
    case 'hal': return { x: HAL.x + 4, y: HAL.y - 118 + 10 * clamp(c.sleep.x, 0, 1) };
    case 'pauline': return grannyAt(PAULINE, 1, d.beat('grandmas'));
    case 'bev': return grannyAt(BEV, -1, d.beat('grandmas'));
    case 'kyle': return kyleHead(c, d.crashT);
    case 'dale': return { x: DALE.x, y: DALE.y - 22 };
    case 'worker': return c.peek.x > 1.5 ? { x: WORKER_SUIT.x, y: WORKER_SUIT.y - 126 } : { x: WORKER_PEEK.x, y: WORKER_PEEK.y };
    case 'crowd': return { x: 470, y: 470 };
    case 'you': return youAt(d.exitAge).head;
    default: return { x: 790, y: 210 };
  }
}

function grannyAt(at: { x: number; y: number; s: number }, side: number, age: number): P {
  const walk = clamp(age / 2.2, 0, 1);
  const from = side > 0 ? at.x - 120 : at.x + 190;
  const x = age < 0 ? from : mix(from, at.x, smoothstep(0, 1, walk));
  return { x, y: at.y - 146 * at.s };
}

function kyleHead(c: Cast, crashT: number): P {
  if (crashT >= 0) {
    const j = kyleJump(c, crashT);
    return { x: j.x, y: j.y - 40 };
  }
  const up = clamp(c.kyleUp.x, 0, 1);
  const under = { x: KYLE_UNDER.x - 12 * clamp(c.kyleOut.x, 0, 1), y: KYLE_UNDER.y - 6 };
  return { x: mix(under.x, KYLE_STOOL.x, up), y: mix(under.y, KYLE_STOOL.y - 76, up) };
}

/** Kyle's route over the back fence at the crash: off the stool (or out from under the cloth), up, over, gone. */
function kyleJump(c: Cast, crashT: number): P & { gone: number; over: boolean } {
  const up = clamp(c.kyleUp.x, 0, 1) > 0.5;
  const start = up ? { x: KYLE_STOOL.x, y: KYLE_STOOL.y - 30 } : { x: KYLE_UNDER.x - 14, y: KYLE_UNDER.y };
  const t = clamp((crashT - AT.kyle) / AT.kyleFor, 0, 1);
  const x = mix(start.x, 596, t);
  const apex = FENCE_TOP - 46;
  const y = t < 0.6 ? mix(start.y, apex, Math.sin((t / 0.6) * Math.PI / 2)) : apex + (t - 0.6) / 0.4 * 170;
  return { x, y, gone: t, over: t > 0.6 };
}

// ─── Stepping ──────────────────────────────────────────────────────────────────────────────────────────────
const CHART: P = { x: 770, y: 200 };

function stepLook(a: Actor, from: P, target: P, dt: number, omega = 9): void {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  stepSpring(a.lookX, clamp(dx / len, -1, 1), omega, 0.8, dt);
  stepSpring(a.lookY, clamp(dy / len, -1, 1) * 0.8, omega, 0.8, dt);
}

export function stepCast(c: Cast, d: CastDrive, dt: number): void {
  const live = d.running && !d.crashed;
  const on = (b: string) => d.beat(b) >= 0;
  stepSpring(c.megaphone, d.talk('sheila') > 0.05 || (d.crashT >= 0.1 && d.crashT < 1.2) ? 1 : 0, 10, 0.55, dt);
  stepSpring(c.mic, on('mic') && !d.crashed ? 1 : 0, 8, 0.6, dt);
  stepSpring(c.key, on('key') && !(d.crashT > AT.flask) ? 1 : 0, 7, 0.5, dt);
  stepSpring(c.sleep, on('asleep') && !(d.crashT > AT.halWake) ? 1 : 0, d.crashT > 0 ? 9 : 1.6, 0.9, dt);
  // Kyle: under the cloth, peeking out from 2.2× (out while he talks, ducking back between), up on the stool at 8×.
  const peekOut = on('kyle') && !on('live') && (d.talk('kyle') > 0 || fract(d.time / 5.2 + 0.3) < 0.62);
  stepSpring(c.kyleOut, peekOut || (d.crashT >= 0 && d.crashT < AT.kyle) ? 1 : 0, 7, 0.55, dt);
  stepSpring(c.kyleUp, on('live') ? 1 : 0, 4, 0.75, dt);
  stepSpring(c.daleUp, on('dale') ? 1 : 0, 5, 0.55, dt);
  // Worker 2 surfaces behind the bounce house more often as the tension rises; in the hazmat suit he stays up.
  const surf = 0.5 + 0.5 * Math.sin(d.time * 0.55 + 1.3 * Math.sin(d.time * 0.21));
  const peeking = d.talk('worker') > 0 || (live && surf > 1.02 - 0.75 * d.tension) || (d.crashT >= 0 && d.crashT < 3);
  stepSpring(c.peek, on('hazmat') ? 2 : peeking ? 1 : 0, 5, 0.6, dt);
  stepSpring(c.tag, Math.sin(d.time * 1.1) * 0.15, 6, 0.12, dt);
  stepSpring(c.gasp, 0, 7, 0.5, dt);
  if (d.beat('spill') >= 0 && d.beat('spill') < dt * 1.5) c.gasp.v += 18;

  // Takes: whoever is spoken to, or near the line, jolts; the speaker leans in.
  for (const who of d.said) {
    const target = (c as unknown as Record<string, Actor>)[who];
    if (target && 'kick' in target) target.lean.v += 2.5;
    for (const a of [c.tanner, c.destiny, c.sheila, c.pauline, c.bev, c.hal]) if (a !== target) a.kick.v += 4 + 4 * noise(a.seed + d.time);
    for (const a of c.crowd) a.kick.v += 3 * noise(a.seed + d.time);
  }
  if (d.crashT >= 0 && d.crashT < dt * 1.5) {
    for (const a of [c.tanner, c.destiny, c.sheila, c.pauline, c.bev, c.hal, ...c.crowd]) a.kick.v -= 30;
    c.gasp.v += 25;
  }
  for (const a of [c.sheila, c.tanner, c.destiny, c.hal, c.pauline, c.bev, c.kyle, c.dale, c.worker, c.you, ...c.crowd]) {
    stepSpring(a.kick, 0, 16 + (a.seed % 3), 0.35, dt);
    stepSpring(a.lean, 0, 5 + (a.seed % 2), 0.6, dt);
  }

  // Eyes: on whoever is talking; Tanner and Destiny drift to the chart as the tension rises (their eyes are the market).
  const speakerAt = d.speaker ? headOf(c, d.speaker, d) : { x: 480, y: 470 };
  const market = (seed: number) => clamp((0.5 + 0.5 * Math.sin(d.time * 0.45 + seed)) * 1.5 - (1.05 - d.tension), 0, 1) > 0.25;
  const lookFor = (who: string, a: Actor, at: P, own: P | null = null) => {
    let target = d.speaker && d.speaker !== who ? speakerAt : own ?? { x: 480, y: 500 };
    if ((who === 'tanner' || who === 'destiny') && live && market(a.seed) && d.talk(who) < 0.5) target = CHART;
    if (d.crashT >= 0) target = crashGaze(who, d.crashT, c);
    stepLook(a, at, target, dt);
  };
  lookFor('sheila', c.sheila, headOf(c, 'sheila', d), { x: 470, y: 480 });
  lookFor('tanner', c.tanner, headOf(c, 'tanner', d), headOf(c, 'destiny', d));
  lookFor('destiny', c.destiny, headOf(c, 'destiny', d), headOf(c, 'tanner', d));
  lookFor('hal', c.hal, headOf(c, 'hal', d));
  stepLook(c.pauline, headOf(c, 'pauline', d), headOf(c, 'bev', d), dt);
  stepLook(c.bev, headOf(c, 'bev', d), headOf(c, 'pauline', d), dt);
  stepLook(c.kyle, headOf(c, 'kyle', d), on('live') ? { x: 640, y: 400 } : headOf(c, 'destiny', d), dt);
  stepLook(c.dale, headOf(c, 'dale', d), { x: 470, y: 380 }, dt);
  stepLook(c.worker, headOf(c, 'worker', d), { x: 650, y: 330 }, dt);
  for (let i = 0; i < c.crowd.length; i += 1) {
    const a = c.crowd[i]!;
    const at = CROWD[i]!;
    stepLook(a, at, d.crashT >= 0 ? { x: 470, y: 320 } : speakerAt, dt, 4 + i * 0.4);
  }
}

/** Who looks where during the crash: at the box, then Destiny at the receipt, at Tanner; Tanner at Kyle's stool. */
function crashGaze(who: string, t: number, c: Cast): P {
  if (who === 'destiny') return t < AT.receipt ? { x: 470, y: 330 } : t < AT.look ? { x: 600, y: 360 } : { x: TANNER.x, y: TANNER.y - 150 * TANNER.s };
  if (who === 'tanner') return t < AT.stool ? { x: 470, y: 330 } : c.kyleUp.x > 0.5 ? { x: KYLE_STOOL.x, y: KYLE_STOOL.y - 20 } : { x: KYLE_UNDER.x, y: KYLE_UNDER.y };
  if (who === 'hal') return t < AT.flask ? { x: 470, y: 330 } : { x: HAL.x - 30, y: HAL.y - 80 };
  return { x: 470, y: 320 };
}

/** Settles springs into a round already under way (no takes, no gasp). */
export function settleCast(c: Cast, d: CastDrive): void {
  const on = (b: string) => d.beat(b) >= 0;
  settleSpring(c.mic, on('mic') && !d.crashed ? 1 : 0);
  settleSpring(c.key, on('key') && !(d.crashT > AT.flask) ? 1 : 0);
  settleSpring(c.sleep, on('asleep') && !(d.crashT > AT.halWake) ? 1 : 0);
  settleSpring(c.kyleUp, on('live') ? 1 : 0);
  settleSpring(c.kyleOut, on('kyle') && !on('live') ? 1 : 0);
  settleSpring(c.daleUp, on('dale') ? 1 : 0);
  settleSpring(c.peek, on('hazmat') ? 2 : 0);
}

// ─── Drawing helpers ───────────────────────────────────────────────────────────────────────────────────────
export interface Face { lookX: number; lookY: number; blink: boolean; mouth: number; smile: number; brow: number; worry: number; sweat: number; lids?: number }

const blinking = (a: Actor, time: number): boolean => fract(time / (3.1 + (a.seed % 1.7)) + a.seed * 0.37) < 0.035;

/** Eyes, brows, nose and mouth, the head's centre at the origin. */
function features(ctx: CanvasRenderingContext2D, f: Face, o: { eyeX: number; eyeY: number; eyeR: number; mouthY: number; mouthW: number; lashes?: boolean; glasses?: string; skin: string }): void {
  for (const side of [-1, 1]) {
    const ex = side * o.eyeX;
    const open = f.blink ? 0.08 : clamp(1 - (f.lids ?? 0), 0.08, 1.15);
    blob(ctx, ex, o.eyeY, o.eyeR, o.eyeR * open, '#ffffff', 1.6);
    if (open > 0.2) {
      blob(ctx, ex + f.lookX * o.eyeR * 0.45, o.eyeY + f.lookY * o.eyeR * 0.4 * open, o.eyeR * 0.48, o.eyeR * 0.48, INK, 0);
      blob(ctx, ex + f.lookX * o.eyeR * 0.45 - 1, o.eyeY + f.lookY * o.eyeR * 0.4 * open - 1.2, 1, 1, '#ffffff', 0);
    }
    if (o.lashes) {
      ink(ctx, 1.4);
      ctx.beginPath();
      ctx.moveTo(ex + side * o.eyeR * 0.7, o.eyeY - o.eyeR * open * 0.7);
      ctx.lineTo(ex + side * (o.eyeR + 3), o.eyeY - o.eyeR * open - 2);
      ctx.stroke();
    }
    // The brow: raised with surprise, the inner end up with worry, down with anger.
    const by = o.eyeY - o.eyeR - 4 - 3 * f.brow;
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(ex - side * o.eyeR * 0.9, by + 3 * f.brow * 0 - 4 * f.worry + (f.brow < 0 ? -3 * f.brow : 0));
    ctx.lineTo(ex + side * o.eyeR * 0.9, by + 1);
    ctx.stroke();
  }
  if (o.glasses) {
    ctx.strokeStyle = o.glasses;
    ctx.lineWidth = 1.8;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * o.eyeX, o.eyeY, o.eyeR + 3, o.eyeR + 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-o.eyeX + o.eyeR + 3, o.eyeY);
    ctx.lineTo(o.eyeX - o.eyeR - 3, o.eyeY);
    ctx.stroke();
  }
  // The nose.
  ctx.strokeStyle = 'rgba(29, 20, 24, 0.6)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, o.eyeY + 3);
  ctx.quadraticCurveTo(3, o.mouthY - 6, -1, o.mouthY - 5);
  ctx.stroke();
  // The mouth: a curve with the smile, an opening while talking.
  const w = o.mouthW;
  if (f.mouth > 0.06) {
    ctx.fillStyle = '#6a2430';
    ink(ctx, 1.8);
    ctx.beginPath();
    ctx.moveTo(-w / 2, o.mouthY);
    ctx.quadraticCurveTo(0, o.mouthY - 2 - 2 * f.smile, w / 2, o.mouthY);
    ctx.quadraticCurveTo(0, o.mouthY + 3 + 9 * f.mouth + 3 * f.smile, -w / 2, o.mouthY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(-w / 2, o.mouthY - 1.5 * f.smile);
    ctx.quadraticCurveTo(0, o.mouthY + 5 * f.smile, w / 2, o.mouthY - 1.5 * f.smile);
    ctx.stroke();
  }
  if (f.sweat > 0.05) {
    ctx.fillStyle = `rgba(120, 190, 255, ${clamp(f.sweat, 0, 1)})`;
    ink(ctx, 1);
    ctx.beginPath();
    ctx.moveTo(o.eyeX + o.eyeR + 6, o.eyeY - 8);
    ctx.quadraticCurveTo(o.eyeX + o.eyeR + 10, o.eyeY - 1, o.eyeX + o.eyeR + 6, o.eyeY + 1);
    ctx.quadraticCurveTo(o.eyeX + o.eyeR + 2, o.eyeY - 1, o.eyeX + o.eyeR + 6, o.eyeY - 8);
    ctx.fill();
    ctx.stroke();
  }
}

/** An arm by two-bone IK: the sleeve, the forearm, the hand. Returns the hand. */
function arm(ctx: CanvasRenderingContext2D, shoulder: P, target: P, sleeve: string, skin: string, pole: number, upper = 34, lower = 32, width = 10, longSleeve = false): P {
  const { joint, end } = solveLimb(shoulder, target, upper, lower, pole);
  limb(ctx, [shoulder, joint], width + 1, sleeve);
  limb(ctx, [joint, end], width - 1, longSleeve ? sleeve : skin);
  blob(ctx, end.x, end.y, width * 0.62, width * 0.62, skin, 2);
  return end;
}

/** A standing torso facing us, from the hips to the shoulders, with a breath. */
function torso(ctx: CanvasRenderingContext2D, top: string, breathe: number, shoulder = 22, hip = 17, height = 50): void {
  ctx.fillStyle = top;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-hip, -74);
  ctx.quadraticCurveTo(-shoulder - 3, -96, -shoulder, -74 - height * breathe);
  ctx.quadraticCurveTo(0, -78 - height * breathe - 4, shoulder, -74 - height * breathe);
  ctx.quadraticCurveTo(shoulder + 3, -96, hip, -74);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function legs(ctx: CanvasRenderingContext2D, colour: string, shoes: string, skin: string | null, spread = 9, cut = 0): void {
  for (const side of [-1, 1]) {
    limb(ctx, [{ x: side * 9, y: -76 }, { x: side * spread, y: -8 }], 13, colour);
    if (skin && cut > 0) limb(ctx, [{ x: side * (spread - 1), y: -76 + cut }, { x: side * spread, y: -8 }], 10, skin);
    blob(ctx, side * (spread + 3), -4, 9, 5, shoes, 2);
  }
}

// ─── Bodies: the parts below the neck that only breathe, painted once ─────────────────────────────────────
const bodies = { sheila: layer(), tanner: layer(), destiny: layer(), hal: layer(), halShirt: layer(), chairs: layer() };
const dresses = layer();

function paintSheilaBody(ctx: CanvasRenderingContext2D): void {
  blob(ctx, 0, 0, 30, 6, 'rgba(30, 60, 30, 0.25)', 0);
  legs(ctx, '#d8c49a', '#ffffff', SKIN.sheila, 9, 44);
  torso(ctx, '#2c3e66', 1, 23, 19);
  // The belt, the walkie on it with its antenna.
  ctx.fillStyle = '#5a3324';
  ctx.fillRect(-19, -80, 38, 6);
  box(ctx, 12, -92, 10, 18, 2, '#2b2b33', 1.8);
  lines(ctx, [[19, -92, 19, -104]], INK, 2);
  // The lanyard and the EVENT LEAD badge.
  lines(ctx, [[-9, -122, -2, -100, 5, -122]], '#f59ac0', 2.5);
  box(ctx, -9, -101, 14, 10, 1.5, '#ffffff', 1.5);
  label(ctx, 'LEAD', -2, -96, 5, '#2c3e66', 900);
}

function paintTannerBody(ctx: CanvasRenderingContext2D): void {
  blob(ctx, 0, 0, 30, 6, 'rgba(30, 60, 30, 0.25)', 0);
  // Jorts, frayed, over the knees; white socks and sneakers.
  for (const side of [-1, 1]) {
    limb(ctx, [{ x: side * 10, y: -40 }, { x: side * 10, y: -8 }], 11, SKIN.tanner);
    blob(ctx, side * 13, -4, 10, 5, '#ffffff', 2);
  }
  poly(ctx, [-20, -82, 20, -82, 23, -38, 3, -38, 0, -60, -3, -38, -23, -38], '#6d8fc4', 2.5);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i += 1) {
    const fx = -22 + i * 3 + (i > 3 ? 20 : 0);
    ctx.beginPath();
    ctx.moveTo(fx, -38);
    ctx.lineTo(fx + 0.5, -34);
    ctx.stroke();
  }
  torso(ctx, '#7fd1b9', 1, 25, 20, 48);
  poly(ctx, [-10, -121, 0, -112, 10, -121, 6, -125, -6, -125], '#5fb89e', 2);
}

function paintDestinyBody(ctx: CanvasRenderingContext2D): void {
  blob(ctx, 0, 0, 28, 6, 'rgba(30, 60, 30, 0.25)', 0);
  for (const side of [-1, 1]) {
    limb(ctx, [{ x: side * 8, y: -40 }, { x: side * 8, y: -8 }], 10, SKIN.destiny);
    blob(ctx, side * 10, -4, 8, 4.5, '#f2e6d0', 2);
  }
}

function paintDestinyDress(ctx: CanvasRenderingContext2D): void {
  // The sundress, flaring to the knee.
  ctx.fillStyle = '#e9dcf7';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-18, -118);
  ctx.quadraticCurveTo(-22, -90, -18, -84);
  ctx.quadraticCurveTo(-32, -60, -34, -40);
  ctx.quadraticCurveTo(0, -34, 34, -40);
  ctx.quadraticCurveTo(32, -60, 18, -84);
  ctx.quadraticCurveTo(22, -90, 18, -118);
  ctx.quadraticCurveTo(0, -112, -18, -118);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(245, 154, 192, 0.6)';
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.arc(-20 + (i * 37) % 40, -70 + (i * 23) % 30, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // The sash: MAMA TO BE, shoulder to hip.
  ctx.save();
  ctx.translate(0, -96);
  ctx.rotate(0.62);
  box(ctx, -36, -7, 72, 14, 1, '#f59ac0', 2);
  label(ctx, 'MAMA TO BE', 0, 0.5, 9, '#ffffff', 900, 66);
  ctx.restore();
}

function paintHalBody(ctx: CanvasRenderingContext2D): void {
  // The lawn chair: aluminium frame, green and white webbing.
  blob(ctx, 0, 0, 44, 7, 'rgba(30, 60, 30, 0.25)', 0);
  lines(ctx, [[-34, 0, -30, -96], [34, 0, 30, -96], [-36, -48, 36, -48]], '#b8bcc6', 4);
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#3f9a5a';
    ctx.fillRect(-30, -94 + i * 8, 60, 6);
  }
  // Seated: khaki shorts, knees toward us, knee socks and sandals.
  for (const side of [-1, 1]) {
    limb(ctx, [{ x: side * 12, y: -46 }, { x: side * 16, y: -30 }], 16, '#c9b48a');
    limb(ctx, [{ x: side * 16, y: -28 }, { x: side * 17, y: -6 }], 10, '#ffffff');
    blob(ctx, side * 18, -3, 9, 4.5, '#6b4a2b', 2);
  }
}

function paintHalShirt(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(0, -44);
  ctx.scale(1, 0.92);
  torso(ctx, '#c0563f', 1, 24, 21, 46);
  ctx.restore();
  ctx.strokeStyle = 'rgba(80, 20, 20, 0.35)';
  ctx.lineWidth = 2;
  for (const yy of [-70, -82, -94]) {
    ctx.beginPath();
    ctx.moveTo(-18, yy);
    ctx.lineTo(18, yy);
    ctx.stroke();
  }
}

// ─── Sheila ────────────────────────────────────────────────────────────────────────────────────────────────
export function drawSheila(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive, secured: boolean): void {
  const a = c.sheila;
  const t = d.time;
  const talk = d.talk('sheila');
  const breathe = 1 + 0.02 * Math.sin(t * 1.7 + a.seed);
  const mega = clamp(c.megaphone.x, 0, 1.1);
  ctx.save();
  ctx.translate(SHEILA.x + Math.sin(t * 0.6 + a.seed) * 1.5 + a.lean.x * 2, SHEILA.y);
  ctx.scale(SHEILA.s, SHEILA.s);
  // The body breathes as one painted piece; the walkie's light blinks on top of it.
  ctx.save();
  ctx.scale(1, breathe);
  cached(ctx, bodies.sheila, -40, -130, 80, 138, paintSheilaBody, SHEILA.s);
  ctx.restore();
  ctx.fillStyle = noise(Math.floor(t * 3)) > 0.5 ? '#7cf67c' : '#2f6f3f';
  ctx.fillRect(14, -89 * breathe, 3, 2);
  const sh = -124 * breathe;
  // The clipboard, in her left arm (our right), the pen in her fingers.
  const clip = { x: 18, y: -96 + Math.sin(t * 2.3) * 1.2 };
  ctx.save();
  ctx.translate(clip.x, clip.y);
  ctx.rotate(-0.12);
  box(ctx, -15, -22, 32, 42, 3, '#b08a5a', 2.2);
  box(ctx, -12, -17, 26, 34, 1, '#ffffff', 1);
  box(ctx, -5, -25, 12, 6, 2, '#c0c0c8', 1.5);
  if (c.key.x < 0.4 && d.beat('key') < 0) {
    // The box key on its DEV keychain, clipped to the programme until it is handed to Hal.
    lines(ctx, [[6, -22, 10 + Math.sin(t * 2.1) * 1.5, -8]], '#8a8a96', 1.2);
    box(ctx, 4 + Math.sin(t * 2.1) * 1.5, -8, 13, 8, 2, '#e8323f', 1.2);
    label(ctx, 'DEV', 10.5 + Math.sin(t * 2.1) * 1.5, -4, 5, '#ffffff', 900);
  }
  if (secured) {
    label(ctx, 'ATTENDANCE:', 1, -8, 5.2, '#c0283e', 900, 25);
    label(ctx, 'PENDING', 1, -1, 6.5, '#c0283e', 900, 25);
  } else {
    ctx.fillStyle = 'rgba(40, 40, 60, 0.5)';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(-9, -12 + i * 6, i % 2 ? 14 : 19, 1.6);
  }
  ctx.restore();
  arm(ctx, { x: 21, y: sh + 4 }, { x: clip.x - 4, y: clip.y + 6 }, '#2c3e66', SKIN.sheila, -1, 30, 28, 10);
  // The megaphone hand: at her side, then up to her mouth for every programme item.
  const rest = { x: -30, y: -78 + Math.sin(t * 1.3 + a.seed) * 2 };
  const up = { x: -26, y: -128 };
  const hand = { x: mix(rest.x, up.x, mega), y: mix(rest.y, up.y, mega) };
  const end = arm(ctx, { x: -21, y: sh + 4 }, hand, '#2c3e66', SKIN.sheila, 1, 30, 30, 10);
  // Her head, the helmet hair, the visor, the readers on a chain.
  const hy = -150 + clamp(a.kick.x, -3, 3) * 1.2;
  ctx.save();
  ctx.translate(0, hy);
  ctx.rotate(a.lean.x * 0.04 + Math.sin(t * 0.8 + a.seed) * 0.02);
  blob(ctx, 0, 0, 23, 24, SKIN.sheila);
  ctx.fillStyle = '#d6c08a';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-26, 8);
  ctx.quadraticCurveTo(-30, -26, 0, -27);
  ctx.quadraticCurveTo(30, -26, 26, 8);
  ctx.quadraticCurveTo(22, -8, 14, -12);
  ctx.quadraticCurveTo(0, -6, -14, -12);
  ctx.quadraticCurveTo(-22, -8, -26, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The visor.
  ctx.fillStyle = '#f59ac0';
  ctx.beginPath();
  ctx.ellipse(0, -14, 27, 6, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(27, -12);
  ctx.quadraticCurveTo(10, -2, 0, -2);
  ctx.quadraticCurveTo(-10, -2, -27, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const tense = d.tension;
  features(ctx, { lookX: c.sheila.lookX.x, lookY: c.sheila.lookY.x, blink: blinking(a, t), mouth: talk * Math.abs(Math.sin(t * 13)), smile: -0.3 - 0.4 * tense, brow: -0.6 - 0.4 * tense, worry: 0, sweat: smoothstep(0.6, 0.95, tense) }, { eyeX: 9, eyeY: 2, eyeR: 4.5, mouthY: 14, mouthW: 11, glasses: '#7a3a5a', skin: SKIN.sheila });
  ctx.strokeStyle = '#c99a3c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-16, 4);
  ctx.quadraticCurveTo(-20, 22, -8, 28);
  ctx.moveTo(16, 4);
  ctx.quadraticCurveTo(20, 22, 8, 28);
  ctx.stroke();
  ctx.restore();
  // The megaphone: hanging at her side, then up at the corner of her mouth, its bell out to the side.
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(mix(Math.PI / 2 + 0.35, Math.PI + 0.22, mega));
  ctx.translate(-6, 0);
  poly(ctx, [-4, -6, 24, -15, 24, 15, -4, 6], '#f5f1e8');
  ctx.fillStyle = '#e8323f';
  ctx.fillRect(6, -9, 4, 18);
  blob(ctx, 24, 0, 4, 15, '#d8d2c4', 2);
  box(ctx, 0, 4, 6, 11, 2, '#2b2b33', 1.5);
  ctx.restore();
  if (mega > 0.6 && talk > 0.1) {
    // The feedback, drawn as it sounds.
    ctx.strokeStyle = 'rgba(29, 20, 24, 0.55)';
    ctx.lineWidth = 2;
    for (const r of [8, 14, 20]) {
      ctx.beginPath();
      ctx.arc(end.x - 34, end.y - 6, r + (t * 30) % 6, Math.PI * 0.75, Math.PI * 1.25);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ─── Tanner and Destiny ─────────────────────────────────────────────────────────────────────────────────────
export function drawTanner(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const a = c.tanner;
  const t = d.time;
  const talk = d.talk('tanner');
  const breathe = 1 + 0.02 * Math.sin(t * 1.5 + a.seed);
  const phone = d.beat('phone');
  const ringing = phone >= 0 && phone < 2.2 && !d.crashed;
  ctx.save();
  ctx.translate(TANNER.x + Math.sin(t * 0.7 + a.seed) * 2 + a.lean.x * 2, TANNER.y);
  ctx.scale(TANNER.s, TANNER.s);
  ctx.save();
  ctx.scale(1, breathe);
  cached(ctx, bodies.tanner, -40, -128, 80, 136, paintTannerBody, TANNER.s);
  ctx.restore();
  // The sunglasses on a lanyard, bouncing on his chest.
  const sh = -122 * breathe;
  ctx.strokeStyle = '#e8323f';
  ctx.lineWidth = 1.8;
  const bounce = Math.sin(t * 2 + a.seed) * 1.5 + a.kick.x * 0.5;
  ctx.beginPath();
  ctx.moveTo(-11, sh + 2);
  ctx.quadraticCurveTo(-8, sh + 20, 0, sh + 24 + bounce);
  ctx.quadraticCurveTo(8, sh + 20, 11, sh + 2);
  ctx.stroke();
  ctx.fillStyle = '#1c1420';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 6, sh + 26 + bounce, 5.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The mic in his right hand (our left), up at his mouth when he talks; the phone in the other at 5×.
  const mic = clamp(c.mic.x, 0, 1.1);
  const micHand = { x: mix(-30, -14, mic * (0.4 + 0.6 * clamp(talk * 3, 0, 1))), y: mix(-80, -132, mic * (0.5 + 0.5 * clamp(talk * 3, 0, 1))) };
  const mh = arm(ctx, { x: -24, y: sh + 4 }, micHand, '#7fd1b9', SKIN.tanner, 1, 30, 30, 11);
  if (mic > 0.1) {
    ctx.save();
    ctx.translate(mh.x, mh.y);
    ctx.rotate(-0.5);
    box(ctx, -3, -2, 6, 20, 2, '#2b2b33', 1.5);
    blob(ctx, 0, -6, 6, 7, '#9aa0ad', 2);
    ctx.restore();
  }
  const ph = ringing ? smoothstep(0, 0.3, phone) * (1 - smoothstep(1.7, 2.2, phone)) : 0;
  const crashHold = d.crashT >= AT.stool ? 1 : 0;
  const offHand = { x: mix(30, 26, ph) + crashHold * -4, y: mix(-80, -112, ph) + Math.sin(t * 1.9 + a.seed) * 2 - crashHold * 6 };
  const oh = arm(ctx, { x: 24, y: sh + 4 }, offHand, '#7fd1b9', SKIN.tanner, -1, 30, 30, 11);
  if (ph > 0.05) {
    // The boss calls; he declines without looking (the thumb taps red at 1.2 s).
    const buzz = phone < 1.2 ? Math.sin(t * 70) * 1.5 : 0;
    ctx.save();
    ctx.translate(oh.x + buzz, oh.y - 6);
    ctx.rotate(0.15);
    box(ctx, -7, -12, 14, 24, 3, '#1d1d24', 1.8);
    ctx.fillStyle = phone < 1.2 ? '#7cf67c' : '#e8323f';
    ctx.fillRect(-5, -9, 10, 15);
    label(ctx, phone < 1.2 ? 'BOSS' : 'X', 0, -2, 5, '#1d1d24', 900);
    ctx.restore();
    if (phone < 1.2) {
      ctx.strokeStyle = '#1d1d24';
      ctx.lineWidth = 1.5;
      for (const r of [14, 19]) {
        ctx.beginPath();
        ctx.arc(oh.x, oh.y - 6, r, -0.6, 0.6);
        ctx.stroke();
      }
    }
  }
  // The head: swoopy blond hair, a big grin with blessings in it.
  const hy = -150 + clamp(a.kick.x, -3, 3) * 1.2;
  ctx.save();
  ctx.translate(0, hy);
  ctx.rotate(Math.sin(t * 0.9 + a.seed) * 0.03 + a.lean.x * 0.04);
  blob(ctx, 0, 0, 23, 25, SKIN.tanner);
  for (const side of [-1, 1]) blob(ctx, side * 23, 4, 4, 6, SKIN.tanner, 2);
  ctx.fillStyle = '#e8c35a';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-24, -2);
  ctx.quadraticCurveTo(-28, -30, 2, -30);
  ctx.quadraticCurveTo(30, -32, 34, -18);
  ctx.quadraticCurveTo(22, -20, 22, -10);
  ctx.quadraticCurveTo(6, -18, -12, -10);
  ctx.quadraticCurveTo(-20, -8, -24, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const tense = d.tension;
  const blessed = d.crashT >= AT.blessed ? 0.2 : 0.8 - 0.4 * tense;
  features(ctx, { lookX: a.lookX.x, lookY: a.lookY.x, blink: blinking(a, t), mouth: talk * Math.abs(Math.sin(t * 12)), smile: d.crashed && d.crashT < AT.blessed ? -0.6 : blessed, brow: d.crashed ? 0.8 : 0.3 * tense, worry: d.crashed ? 0.8 : 0.4 * tense, sweat: smoothstep(0.5, 0.9, tense) }, { eyeX: 9, eyeY: 0, eyeR: 5, mouthY: 13, mouthW: 15, skin: SKIN.tanner });
  ctx.restore();
  ctx.restore();
}

export function drawDestiny(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const a = c.destiny;
  const t = d.time;
  const talk = d.talk('destiny');
  const breathe = 1 + 0.02 * Math.sin(t * 1.6 + a.seed);
  const spill = d.beat('spill');
  ctx.save();
  ctx.translate(DESTINY.x + Math.sin(t * 0.65 + a.seed) * 2 + a.lean.x * 2, DESTINY.y);
  ctx.scale(DESTINY.s, DESTINY.s);
  cached(ctx, bodies.destiny, -32, -46, 64, 54, paintDestinyBody, DESTINY.s);
  // The long hair behind her.
  const hy = -150 + clamp(a.kick.x, -3, 3) * 1.2;
  ctx.fillStyle = '#4a2c1e';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-26, hy - 8);
  ctx.quadraticCurveTo(-36, hy + 50, -24, hy + 72);
  ctx.lineTo(24, hy + 72);
  ctx.quadraticCurveTo(36, hy + 50, 26, hy - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.scale(1, breathe);
  cached(ctx, dresses, -42, -126, 84, 92, paintDestinyDress, DESTINY.s);
  ctx.restore();
  const sh = -118 * breathe;
  // Hands: clasped in front (the smile is a negotiation), one up when she talks, to her mouth at the spill,
  // a receipt held up to read at the crash.
  const spilling = spill >= 0 && spill < 3 && !d.crashed;
  const reading = d.crashT >= AT.receipt;
  const gest = clamp(talk * 2, 0, 1);
  const left = reading ? { x: -10, y: -112 } : spilling ? { x: -8, y: -142 } : { x: mix(-6, -30, gest), y: mix(-78, -104, gest) + Math.sin(t * 6) * 3 * gest };
  const right = reading ? { x: 12, y: -112 } : spilling ? { x: 8, y: -140 } : { x: 6, y: -78 + Math.sin(t * 1.2 + 2) };
  arm(ctx, { x: -18, y: sh + 4 }, left, SKIN.destiny, SKIN.destiny, 1, 29, 28, 9);
  arm(ctx, { x: 18, y: sh + 4 }, right, SKIN.destiny, SKIN.destiny, -1, 29, 28, 9);
  if (reading) {
    ctx.save();
    ctx.translate(1, -122);
    ctx.rotate(-0.05);
    box(ctx, -10, -14, 20, 26, 1, '#fffdf6', 1.5);
    ctx.fillStyle = 'rgba(60, 60, 70, 0.6)';
    for (let k = 0; k < 5; k += 1) ctx.fillRect(-7, -10 + k * 4.5, k === 4 ? 14 : 8 + (k % 2) * 5, 1.4);
    ctx.restore();
  }
  // The head: the smile, negotiated; her eyes on the market.
  ctx.save();
  ctx.translate(0, hy);
  ctx.rotate(Math.sin(t * 0.85 + a.seed) * 0.03 - a.lean.x * 0.04);
  blob(ctx, 0, 0, 22, 24, SKIN.destiny);
  ctx.fillStyle = '#4a2c1e';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-25, 10);
  ctx.quadraticCurveTo(-30, -30, 0, -28);
  ctx.quadraticCurveTo(30, -30, 25, 10);
  ctx.quadraticCurveTo(20, -10, 4, -16);
  ctx.quadraticCurveTo(-14, -6, -25, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  blob(ctx, 18, -22, 6, 5, '#f59ac0', 1.8);
  const tense = d.tension;
  // The negotiated smile: wide, then a twitch at the corner every few seconds.
  const twitch = fract(t / 3.7 + 0.2) < 0.08 ? 1 : 0;
  const smile = d.crashed ? (d.crashT > AT.look ? -0.8 : -0.2) : 0.75 - 0.5 * tense - 0.5 * twitch;
  features(ctx, { lookX: a.lookX.x, lookY: reading && d.crashT < AT.look ? 0.9 : a.lookY.x, blink: blinking(a, t), mouth: spilling ? 0.8 : talk * Math.abs(Math.sin(t * 12.5)), smile, brow: d.crashT > AT.look ? -0.8 : 0.2 * tense, worry: 0.5 * tense, sweat: smoothstep(0.65, 0.95, tense), lids: d.crashT > AT.look ? 0.45 : 0 }, { eyeX: 9, eyeY: 1, eyeR: 5, mouthY: 13, mouthW: 13, lashes: true, skin: SKIN.destiny });
  ctx.fillStyle = 'rgba(240, 120, 140, 0.3)';
  ctx.beginPath();
  ctx.arc(-14, 9, 4, 0, Math.PI * 2);
  ctx.arc(14, 9, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ─── Grandpa Hal ────────────────────────────────────────────────────────────────────────────────────────────
export function drawHal(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const a = c.hal;
  const t = d.time;
  const sleep = clamp(c.sleep.x, 0, 1);
  const key = clamp(c.key.x, 0, 1.1);
  const talk = d.talk('hal');
  ctx.save();
  ctx.translate(HAL.x, HAL.y);
  const breathe = 1 + (0.02 + 0.03 * sleep) * Math.sin(t * (1.4 - 0.6 * sleep) + a.seed);
  cached(ctx, bodies.hal, -48, -102, 96, 112, paintHalBody);
  ctx.save();
  ctx.translate(0, -44);
  ctx.scale(1, breathe);
  ctx.translate(0, 44);
  cached(ctx, bodies.halShirt, -30, -96, 60, 56, paintHalShirt);
  ctx.restore();
  const sh = -44 - (74 + 46 * breathe) * 0.92 + 74 * 0.92;
  // The key: up in a vice grip from 1.5×, sinking to his lap as he sleeps; at the crash, into his own flask.
  const flaskT = d.crashT >= 0 && key < 0.5 && d.beat('key') >= 0 ? d.crashT : -1;
  const fist = { x: mix(26, 30, key) - 6 * sleep, y: mix(-50, -104, key * (1 - 0.6 * sleep)) + Math.sin(t * 9) * 0.6 * key * (1 - sleep) };
  const other = { x: -26, y: -50 };
  let flask: P | null = null;
  if (flaskT >= AT.flask) {
    // The flask comes out, the key opens it, he drinks.
    const sip = smoothstep(AT.sip, AT.sip + 0.5, flaskT);
    flask = { x: mix(-6, -2, sip), y: mix(-82, -112, sip) };
    other.x = flask.x - 4;
    other.y = flask.y + 6;
    fist.x = mix(10, 2, smoothstep(AT.flask, AT.flask + 0.5, flaskT));
    fist.y = mix(-86, -96, smoothstep(AT.flask, AT.flask + 0.5, flaskT)) + (flaskT > AT.flask + 0.5 && flaskT < AT.flaskOpen ? Math.sin(flaskT * 40) * 2 : 0);
    if (sip > 0) {
      fist.x = 24;
      fist.y = -58;
    }
  }
  arm(ctx, { x: -22, y: sh + 4 }, other, '#c0563f', SKIN.hal, 1, 28, 27, 10);
  const fh = arm(ctx, { x: 22, y: sh + 4 }, fist, '#c0563f', SKIN.hal, -1, 28, 27, 11);
  if (key > 0.2 || (flaskT >= AT.flask && flaskT < AT.flaskOpen + 0.1)) {
    // The key and its DEV keychain, the tag swinging like a pendulum.
    ctx.save();
    ctx.translate(fh.x, fh.y);
    // The key, held up blade first, gold.
    ctx.save();
    ctx.rotate(-0.7);
    ctx.fillStyle = '#e8c048';
    ink(ctx, 1.6);
    ctx.beginPath();
    ctx.rect(-2, -22, 4, 16);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(2, -20, 4, 3);
    ctx.rect(2, -15, 3, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.rotate(clamp(c.tag.x, -0.8, 0.8));
    lines(ctx, [[0, 4, 0, 12]], '#8a8a96', 1.2);
    box(ctx, -8, 12, 16, 9, 2, '#e8323f', 1.5);
    label(ctx, 'DEV', 0, 16.5, 6, '#ffffff', 900);
    ctx.restore();
  }
  if (flask) {
    ctx.save();
    ctx.translate(flask.x, flask.y);
    ctx.rotate(smoothstep(AT.sip, AT.sip + 0.5, flaskT) * -0.9);
    box(ctx, -8, -12, 16, 22, 4, '#b8bcc6', 2);
    if (flaskT < AT.flaskOpen) box(ctx, -3, -16, 6, 5, 1, '#8a8a96', 1.5);
    ctx.restore();
    if (flaskT >= AT.flaskOpen && flaskT < AT.flaskOpen + 0.8) {
      // The cap, flipping off.
      const u = flaskT - AT.flaskOpen;
      blob(ctx, flask.x - 30 * u, flask.y - 16 - 80 * u + 200 * u * u, 3, 2.5, '#8a8a96', 1.5);
    }
  }
  // The head: big glasses, a white moustache, the cap that says VETERAN (of something).
  ctx.save();
  const nod = sleep * (0.35 + 0.05 * Math.sin(t * 1.1));
  ctx.translate(4, -118 + 10 * sleep + clamp(a.kick.x, -3, 3));
  ctx.rotate(nod + Math.sin(t * 0.5 + a.seed) * 0.03);
  blob(ctx, 0, 0, 21, 22, SKIN.hal);
  for (const side of [-1, 1]) blob(ctx, side * 21, 3, 4, 6, SKIN.hal, 2);
  const startled = d.crashT >= 0 && d.crashT < AT.flask ? 1 : 0;
  features(ctx, { lookX: a.lookX.x, lookY: a.lookY.x, blink: blinking(a, t), lids: sleep > 0.5 ? 1 : key > 0.5 ? 0.35 : 0, mouth: sleep > 0.6 ? 0.35 + 0.15 * Math.sin(t * 1.4) : talk * Math.abs(Math.sin(t * 11)) + 0.6 * startled, smile: -0.4, brow: startled ? 1 : -0.7 * key, worry: 0, sweat: 0 }, { eyeX: 8, eyeY: -1, eyeR: 4, mouthY: 14, mouthW: 10, glasses: '#3b2f2f', skin: SKIN.hal });
  ctx.fillStyle = '#f2f0ea';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(-12, 10);
  ctx.quadraticCurveTo(0, 4, 12, 10);
  ctx.quadraticCurveTo(6, 14, 0, 11);
  ctx.quadraticCurveTo(-6, 14, -12, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#26324f';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-23, -8);
  ctx.quadraticCurveTo(-24, -30, 0, -30);
  ctx.quadraticCurveTo(24, -30, 23, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-4, -8, 26, 5, 0, 0, Math.PI);
  ctx.fill();
  ctx.stroke();
  label(ctx, 'VETERAN', 0, -18, 7, '#e0c06a', 900, 38);
  ctx.restore();
  // Asleep: z's rising.
  if (sleep > 0.5) {
    for (let i = 0; i < 2; i += 1) {
      const u = fract(t * 0.35 + i / 2);
      ctx.globalAlpha = (1 - u) * sleep;
      memeZ(ctx, 30 + u * 18 + i * 3, -140 - u * 40, 10 + u * 8);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function memeZ(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText('z', x, y);
  ctx.fillStyle = '#3b5f9a';
  ctx.fillText('z', x, y);
}

// ─── Grandma Pauline and Grandma Bev: a mirrored stalemate in profile ───────────────────────────────────────
export function drawGrandmas(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const age = d.beat('grandmas');
  if (age < 0) return;
  // The plate moves a hair between them: a tug of war that never resolves.
  const tug = Math.sin(d.time * 1.15) * (1.5 + 3 * d.tension) * (d.crashed ? 0.4 : 1);
  granny(ctx, c.pauline, PAULINE, 1, age, tug, d, { skin: SKIN.pauline, hair: '#e9e2f0', cardigan: '#b79ad8', skirt: '#6f5a8a', bun: false });
  granny(ctx, c.bev, BEV, -1, age, tug, d, { skin: SKIN.bev, hair: '#b8b4ae', cardigan: '#4fa59a', skirt: '#2f5d5a', bun: true });
}

function granny(ctx: CanvasRenderingContext2D, a: Actor, at: { x: number; y: number; s: number }, side: number, age: number, tug: number, d: CastDrive, look: { skin: string; hair: string; cardigan: string; skirt: string; bun: boolean }): void {
  const t = d.time;
  const walk = clamp(age / 2.2, 0, 1);
  const from = side > 0 ? at.x - 120 : at.x + 190;
  const x = mix(from, at.x, smoothstep(0, 1, walk));
  const walking = walk < 1;
  const dist = Math.abs(x - from) / at.s;
  ctx.save();
  ctx.translate(x, at.y);
  ctx.scale(at.s * side, at.s);
  blob(ctx, 0, 0, 26, 5, 'rgba(30, 60, 30, 0.25)', 0);
  // Legs: a short shuffle in, then planted. The gait is driven by distance, so it starts from standing.
  for (const k of [0, 0.5]) {
    const foot = walking ? walkingFoot(dist, 34, k, 7) : { x: (k ? -5 : 5), y: 0 };
    const hip = { x: k ? -3 : 3, y: -64 };
    const ankle = { x: foot.x, y: foot.y - 6 };
    const { joint } = solveLimb(hip, ankle, 30, 30, -1);
    limb(ctx, [hip, joint, ankle], 9, k ? '#e9cdb3' : look.skin);
    blob(ctx, ankle.x + 5, ankle.y + 3, 8, 4, '#3b2f2f', 2);
  }
  // The skirt and the cardigan, hunched forward toward the plate; the hunch deepens with the tension.
  const hunch = 0.05 + 0.08 * d.tension + 0.03 * Math.sin(t * 0.9 + a.seed) + (walking ? 0 : tug * 0.012 * side);
  ctx.save();
  ctx.translate(0, -64);
  ctx.rotate(hunch);
  poly(ctx, [-16, 0, 16, 0, 20, 32, -18, 32], look.skirt);
  ctx.fillStyle = look.cardigan;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-15, 4);
  ctx.quadraticCurveTo(-20, -30, -8, -56);
  ctx.quadraticCurveTo(8, -62, 16, -50);
  ctx.quadraticCurveTo(22, -20, 15, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(12, -40 + i * 12, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // The gripping arm: both on the one plate, pulled a hair by the tug.
  const shoulder = { x: 6 + Math.sin(hunch) * 50, y: -64 - Math.cos(hunch) * 50 };
  const plate = { x: ((PLATE.x - side * 12 + tug) - x) / (at.s * side), y: (PLATE.y - at.y) / at.s };
  const grip = walking ? { x: 14, y: -56 + Math.sin(dist * 0.2) * 3 } : plate;
  arm(ctx, shoulder, grip, look.cardigan, look.skin, -1, 27, 26, 9, true);
  // The head in profile, the eyes locked on the other grandmother.
  ctx.save();
  ctx.translate(shoulder.x + 6, shoulder.y - 20 + clamp(a.kick.x, -2, 2));
  ctx.rotate(-hunch * 0.6);
  blob(ctx, 0, 0, 17, 18, look.skin, 2.2);
  // The nose, toward the other one; the ear at the back.
  ctx.fillStyle = look.skin;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(15, -4);
  ctx.quadraticCurveTo(24, 2, 15, 6);
  ctx.fill();
  ctx.stroke();
  blob(ctx, -8, 2, 3.5, 5, look.skin, 1.8);
  // Hair: a white perm, or a grey bun.
  ctx.fillStyle = look.hair;
  ink(ctx, 2.2);
  ctx.beginPath();
  if (look.bun) {
    ctx.moveTo(14, -8);
    ctx.quadraticCurveTo(8, -22, -8, -18);
    ctx.quadraticCurveTo(-20, -12, -18, 8);
    ctx.quadraticCurveTo(-12, -2, -6, -6);
    ctx.quadraticCurveTo(4, -8, 14, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    blob(ctx, -18, -14, 8, 8, look.hair, 2.2);
  } else {
    for (const [cx, cy] of [[-12, -10], [-2, -16], [9, -14], [-16, 0], [-14, 9]] as const) {
      ctx.moveTo(cx + 8, cy);
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }
  // The eye: narrowed, the pupil hard on her rival; the brow down.
  const stare = d.crashed ? 0.4 : 0.55;
  ctx.fillStyle = '#ffffff';
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.ellipse(8, -3, 4, 4 * (blinking(a, t) ? 0.1 : stare), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  blob(ctx, 10, -3, 1.8, 1.8, INK, 0);
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(3, -11);
  ctx.lineTo(13, -7);
  ctx.stroke();
  if (look.bun) {
    ctx.strokeStyle = '#7a3a5a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.lineTo(14, -9);
    ctx.lineTo(15, -1);
    ctx.lineTo(4, 1);
    ctx.closePath();
    ctx.stroke();
  }
  // The mouth: pursed, or saying her piece.
  const talk = d.talk(side > 0 ? 'pauline' : 'bev');
  ctx.fillStyle = '#6a2430';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.ellipse(11, 9, 3, 1 + 3.5 * talk * Math.abs(Math.sin(t * 12)), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (d.tension > 0.6) {
    blob(ctx, -2, -10 + fract(t * 0.4 + a.seed) * 14, 1.8, 2.6, 'rgba(120, 190, 255, 0.85)', 0);
  }
  ctx.restore();
  ctx.restore();
}

// ─── Kyle ──────────────────────────────────────────────────────────────────────────────────────────────────
/** Kyle on his stool behind the dessert table (drawn before the table), from 8×. */
export function drawKyleBehind(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const up = clamp(c.kyleUp.x, 0, 1);
  if (d.crashT >= AT.kyle && clamp(c.kyleUp.x, 0, 1) < 0.3) return;
  // The stool's back over the table edge, abandoned or not.
  if (up > 0.3) {
    lines(ctx, [[KYLE_STOOL.x - 12, KYLE_STOOL.y, KYLE_STOOL.x - 12, KYLE_STOOL.y - 34], [KYLE_STOOL.x + 12, KYLE_STOOL.y, KYLE_STOOL.x + 12, KYLE_STOOL.y - 34]], INK, 3);
    box(ctx, KYLE_STOOL.x - 18, KYLE_STOOL.y - 44, 36, 12, 5, '#d8494f', 2.2);
  }
  if (up < 0.05 || d.crashT >= AT.kyle) return;
  const t = d.time;
  const a = c.kyle;
  ctx.save();
  ctx.translate(KYLE_STOOL.x, KYLE_STOOL.y + 70 + (1 - up) * 80);
  // Scrubs, the headset, a calm face: he is working.
  torso(ctx, '#3fa59a', 1 + 0.02 * Math.sin(t * 1.4 + a.seed), 21, 18, 44);
  ctx.translate(0, 0);
  const sh = -74 - 44;
  poly(ctx, [-8, sh + 1, 0, sh + 10, 8, sh + 1], '#2f8a80', 2);
  // Typing: the hands over the laptop, quick.
  for (const side of [-1, 1]) {
    const tap = Math.abs(Math.sin(t * 13 + side)) * 3;
    arm(ctx, { x: side * 19, y: sh + 4 }, { x: side * 12, y: -76 - tap }, '#3fa59a', SKIN.kyle, side, 26, 24, 9);
  }
  drawKyleHead(ctx, c, d, 0, -146, true);
  ctx.restore();
}

function drawKyleHead(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive, x: number, y: number, headset: boolean): void {
  const a = c.kyle;
  const t = d.time;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.7 + a.seed) * 0.03);
  blob(ctx, 0, 0, 21, 23, SKIN.kyle);
  // The surgical cap.
  ctx.fillStyle = '#3fa59a';
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(-23, -2);
  ctx.quadraticCurveTo(-24, -30, 0, -29);
  ctx.quadraticCurveTo(24, -30, 23, -2);
  ctx.quadraticCurveTo(0, -10, -23, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(-12 + i * 8, -18 + (i % 2) * 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const talk = d.talk('kyle');
  features(ctx, { lookX: a.lookX.x, lookY: a.lookY.x, blink: blinking(a, t), lids: 0.35, mouth: talk * Math.abs(Math.sin(t * 11)), smile: 0.45, brow: 0, worry: 0, sweat: 0 }, { eyeX: 8, eyeY: 1, eyeR: 4.2, mouthY: 13, mouthW: 11, skin: SKIN.kyle });
  // Stubble.
  ctx.fillStyle = 'rgba(40, 20, 10, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 14, 7, 0, 0, Math.PI);
  ctx.fill();
  if (headset) {
    ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -4, 25, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    blob(ctx, -23, 2, 5, 7, '#2b2b33', 1.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-22, 8);
    ctx.quadraticCurveTo(-18, 18, -6, 16);
    ctx.stroke();
    blob(ctx, -6, 16, 2.5, 2.5, '#e8323f', 1);
  }
  ctx.restore();
}

/** The open laptop on the table in front of him, its back to us. */
export function drawLaptop(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const up = clamp(c.kyleUp.x, 0, 1);
  if (up < 0.4 || d.crashT >= AT.kyle) return;
  ctx.save();
  ctx.translate(KYLE_STOOL.x, TABLE.top - 2);
  poly(ctx, [-22, 0, 22, 0, 20, -28, -20, -28], '#c8ccd6');
  blob(ctx, 0, -14, 6, 6, '#ffffff', 1.5);
  box(ctx, -14, -24, 14, 7, 2, '#e8323f', 1.2);
  label(ctx, 'DEV', -7, -20.5, 5.5, '#ffffff', 900);
  ctx.restore();
}

/** Kyle under the cloth: his sneakers out the end, and from 2.2× his head out from under the corner. */
export function drawKyleUnder(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const up = clamp(c.kyleUp.x, 0, 1);
  if (up > 0.5 || d.crashT >= AT.kyle) return;
  // Scrub legs and sneakers sticking out under the hem.
  for (const k of [0, 1]) {
    limb(ctx, [{ x: TABLE.x + 34 + k * 18, y: TABLE.front - 2 }, { x: TABLE.x + 30 + k * 18, y: TABLE.front + 6 }], 9, '#3fa59a');
    blob(ctx, TABLE.x + 30 + k * 18, TABLE.front + 8, 9, 4.5, '#5a6b8a', 2);
  }
  const out = clamp(c.kyleOut.x, 0, 1.1);
  if (out < 0.05) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(KYLE_UNDER.x - 60, KYLE_UNDER.y - 60, 64, 120);
  ctx.clip();
  drawKyleHead(ctx, c, d, KYLE_UNDER.x + 20 - 30 * out, KYLE_UNDER.y - 4, false);
  ctx.restore();
}

/** Kyle at the crash: up and over the back fence with the laptop bag, gone. */
export function drawKyleJump(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  if (d.crashT < AT.kyle) return;
  const j = kyleJump(c, d.crashT);
  if (j.gone >= 1) return;
  ctx.save();
  if (j.over) {
    // Behind the fence now: only what is above the top rail shows.
    ctx.beginPath();
    ctx.rect(0, 0, 960, FENCE_TOP + 2);
    ctx.clip();
  }
  ctx.translate(j.x, j.y);
  ctx.rotate(-0.3 + j.gone * 0.6);
  // A scrubs body mid-leap, legs tucked, the bag on his back.
  limb(ctx, [{ x: -6, y: 0 }, { x: -18, y: 12 }, { x: -10, y: 26 }], 11, '#3fa59a');
  limb(ctx, [{ x: 6, y: 0 }, { x: 18, y: 6 }, { x: 22, y: 22 }], 11, '#3fa59a');
  box(ctx, -18, -44, 36, 46, 10, '#3fa59a', 2.5);
  box(ctx, -26, -40, 14, 26, 4, '#2b2b33', 2);
  limb(ctx, [{ x: 14, y: -38 }, { x: 30, y: -54 }], 9, '#3fa59a');
  drawKyleHead(ctx, c, d, 2, -62, false);
  ctx.restore();
}

// ─── Uncle Dale over the fence; Worker 2 ────────────────────────────────────────────────────────────────────
export function drawDale(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const up = clamp(c.daleUp.x, 0, 1.15);
  if (up < 0.02) return;
  const a = c.dale;
  const t = d.time;
  const talk = d.talk('dale');
  const yell = clamp(talk * 2, 0, 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(DALE.x - 60, 0, 120, FENCE_TOP + 1);
  ctx.clip();
  ctx.translate(DALE.x + Math.sin(t * 0.6 + a.seed) * 2, DALE.y + (1 - up) * 70);
  // A palm-print shirt (a different shirt), the camo cap, the shades on the cap.
  box(ctx, -30, -6, 60, 30, 10, '#f08a3a', 2.5);
  ctx.fillStyle = '#3f8a4a';
  for (const [lx, ly] of [[-18, 4], [4, 10], [20, 0]] as const) {
    ctx.beginPath();
    ctx.ellipse(lx, ly, 6, 2.5, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(0, -26 + clamp(a.kick.x, -2, 2) - yell * 3);
  blob(ctx, 0, 0, 20, 21, SKIN.dale);
  features(ctx, { lookX: a.lookX.x, lookY: a.lookY.x, blink: blinking(a, t), mouth: yell * (0.7 + 0.3 * Math.abs(Math.sin(t * 9))), smile: 0.3, brow: 0.6 * yell, worry: 0, sweat: 0 }, { eyeX: 7.5, eyeY: 0, eyeR: 4, mouthY: 12, mouthW: 12, skin: SKIN.dale });
  blob(ctx, 0, 17, 6, 4, 'rgba(80, 50, 30, 0.45)', 0);
  ctx.fillStyle = '#6b7a4a';
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(-21, -6);
  ctx.quadraticCurveTo(-22, -28, 0, -27);
  ctx.quadraticCurveTo(22, -28, 21, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4a5a32';
  for (const [bx, by] of [[-10, -16], [6, -20], [10, -10]] as const) {
    ctx.beginPath();
    ctx.ellipse(bx, by, 5, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#6b7a4a';
  ctx.beginPath();
  ctx.ellipse(6, -6, 22, 4.5, 0, 0, Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c1420';
  ctx.fillRect(-12, -24, 10, 5);
  ctx.fillRect(2, -24, 10, 5);
  ctx.restore();
  ctx.restore();
  // His forearms on the top rail, one cupped at his mouth when he yells.
  ctx.save();
  ctx.translate(DALE.x, DALE.y + (1 - up) * 70);
  if (up > 0.5) {
    limb(ctx, [{ x: -26, y: 4 }, { x: -6, y: 2 }], 10, SKIN.dale);
    if (yell > 0.1) limb(ctx, [{ x: 24, y: 4 }, { x: 18, y: -14 }, { x: 10, y: -16 }], 10, SKIN.dale);
    else limb(ctx, [{ x: 26, y: 4 }, { x: 6, y: 2 }], 10, SKIN.dale);
  }
  ctx.restore();
}

export function drawWorker(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive, front: boolean): void {
  const p = c.peek.x;
  const suit = p > 1.5;
  if (front !== suit) return;
  const t = d.time;
  const a = c.worker;
  if (!suit) {
    // Behind the bounce house: up to the shoulders, a hard hat and a hi-vis vest.
    const up = clamp(p, 0, 1);
    if (up < 0.03) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(WORKER_PEEK.x - 40, 200, 80, 140);
    ctx.clip();
    ctx.translate(WORKER_PEEK.x, WORKER_PEEK.y + (1 - up) * 50);
    box(ctx, -22, 10, 44, 40, 10, '#f2d12a', 2.5);
    ctx.fillStyle = '#c0c0c8';
    ctx.fillRect(-22, 22, 44, 4);
    workerHead(ctx, a, t, false, d.talk('worker'));
    ctx.restore();
    return;
  }
  // In the hazmat suit by the gate, holding the extinguisher pointed at the grass. It is never used.
  ctx.save();
  ctx.translate(WORKER_SUIT.x + Math.sin(t * 0.5 + a.seed), WORKER_SUIT.y);
  ctx.scale(0.86, 0.86);
  blob(ctx, 0, 0, 26, 5, 'rgba(30, 60, 30, 0.25)', 0);
  legs(ctx, '#f2d12a', '#2b2b33', null, 10);
  torso(ctx, '#f2d12a', 1 + 0.02 * Math.sin(t * 1.3), 24, 20, 48);
  label(ctx, 'WORKER 2', 0, -100, 7, '#1c1420', 900, 40);
  const sh = -74 - 48;
  const hand = { x: 12, y: -76 };
  arm(ctx, { x: -22, y: sh + 4 }, { x: 4, y: -78 }, '#f2d12a', '#2b2b33', 1, 28, 28, 11, true);
  arm(ctx, { x: 22, y: sh + 4 }, hand, '#f2d12a', '#2b2b33', -1, 28, 28, 11, true);
  ctx.save();
  ctx.translate(10, -70);
  box(ctx, -7, -6, 14, 34, 5, '#e8323f', 2);
  box(ctx, -4, -12, 8, 7, 2, '#2b2b33', 1.5);
  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(2, -10);
  ctx.quadraticCurveTo(14, -4, 10, 30);
  ctx.stroke();
  ctx.restore();
  ctx.translate(0, -146);
  workerHead(ctx, a, t, true, d.talk('worker'));
  ctx.restore();
}

function workerHead(ctx: CanvasRenderingContext2D, a: Actor, t: number, hood: boolean, talk: number): void {
  if (hood) {
    blob(ctx, 0, 0, 26, 27, '#f2d12a');
    box(ctx, -17, -12, 34, 26, 8, '#bfe6f7', 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-12, -9, 6, 18);
    ctx.save();
    ctx.translate(0, 2);
    ctx.scale(0.75, 0.75);
    blob(ctx, 0, 0, 18, 18, SKIN.worker, 1.5);
    features(ctx, { lookX: a.lookX.x, lookY: a.lookY.x, blink: blinking(a, t), mouth: talk * Math.abs(Math.sin(t * 10)), smile: 0.1, brow: 0, worry: 0, sweat: 0 }, { eyeX: 7, eyeY: 0, eyeR: 3.8, mouthY: 10, mouthW: 9, skin: SKIN.worker });
    ctx.restore();
    blob(ctx, -22, 14, 6, 6, '#2b2b33', 1.5);
    return;
  }
  blob(ctx, 0, 0, 18, 19, SKIN.worker);
  features(ctx, { lookX: a.lookX.x, lookY: a.lookY.x, blink: blinking(a, t), mouth: talk * Math.abs(Math.sin(t * 10)), smile: 0, brow: 0.2, worry: 0, sweat: 0 }, { eyeX: 7, eyeY: 0, eyeR: 3.8, mouthY: 10, mouthW: 9, skin: SKIN.worker });
  ctx.fillStyle = '#ffd23a';
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(-22, -6);
  ctx.quadraticCurveTo(-20, -28, 0, -28);
  ctx.quadraticCurveTo(20, -28, 22, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-25, -8, 50, 4);
  ctx.strokeRect(-25, -8, 50, 4);
}

// ─── The folding chairs and the plus-one ────────────────────────────────────────────────────────────────────
function foldingChairBack(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  lines(ctx, [[-26, 0, -24, 80], [26, 0, 24, 80]], '#6f7480', 4);
  box(ctx, -28, 4, 56, 22, 5, '#9aa0ad', 2.5);
  ctx.restore();
}

type Seat = { x: number; y: number; s: number; hair: string; shirt: string; style: number };
const backs = [0, 1, 2, 3, 4, 5].map(() => layer());
const heads = [0, 1, 2, 3, 4, 5].map(() => layer());

function paintBack(ctx: CanvasRenderingContext2D, at: Seat): void {
  ctx.fillStyle = at.shirt;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-34, 70);
  ctx.quadraticCurveTo(-36, 26, -14, 22);
  ctx.lineTo(14, 22);
  ctx.quadraticCurveTo(36, 26, 34, 70);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function paintHead(ctx: CanvasRenderingContext2D, at: Seat): void {
  blob(ctx, 0, 0, 20, 22, at.hair);
  if (at.style === 1) {
    // Bald on top with a fringe.
    blob(ctx, 0, -6, 15, 14, '#efc7a8', 2);
  } else if (at.style === 2) {
    blob(ctx, 0, -22, 10, 9, at.hair, 2);
  } else if (at.style === 4) {
    // A sun hat.
    blob(ctx, 0, -10, 32, 8, '#f2e3b3', 2);
    blob(ctx, 0, -16, 17, 12, '#f2e3b3', 2);
    ctx.fillStyle = '#f59ac0';
    ctx.fillRect(-16, -14, 32, 4);
  } else if (at.style === 0) {
    // A backwards cap.
    blob(ctx, 0, -10, 19, 13, '#3b5f9a', 2);
    box(ctx, -8, -2, 16, 7, 3, '#3b5f9a', 2);
  } else if (at.style === 9) {
    // The plus-one's beanie.
    blob(ctx, 0, -10, 21, 15, '#2f6f6a', 2.4);
    box(ctx, -21, -4, 42, 7, 3, '#25595a', 2);
  }
}

/** A seated relative from behind (painted once and breathing): shoulders, the back of the head turning toward whoever talks, a phone up late in the round. */
function relative(ctx: CanvasRenderingContext2D, a: Actor, at: Seat, id: number, d: CastDrive, gasp: number): void {
  const t = d.time;
  ctx.save();
  ctx.translate(at.x + Math.sin(t * 0.5 + a.seed) * 1.5, at.y + 4 * clamp(-a.kick.x / 10, -1, 1) - gasp * 4);
  ctx.scale(at.s, at.s);
  const breathe = Math.sin(t * 1.5 + a.seed) * 1.2;
  ctx.save();
  ctx.translate(0, 70);
  ctx.scale(1, 1 + breathe / 48);
  ctx.translate(0, -70);
  cached(ctx, backs[id]!, -40, 18, 80, 56, (c) => paintBack(c, at), at.s);
  ctx.restore();
  // A phone up, filming, as the round runs long (phones were supposed to be away).
  const filming = (d.multiplier > 6 + at.style * 3 && at.style % 2 === 0) || (d.crashT > 0.8 && at.style !== 1 && at.style !== 9);
  if (filming) {
    const px = at.style % 2 ? -20 : 22;
    limb(ctx, [{ x: px * 0.8, y: 30 }, { x: px, y: -22 }], 9, at.shirt);
    box(ctx, px - 8, -44, 16, 26, 3, '#1d1d24', 2);
    ctx.fillStyle = '#9fd2f5';
    ctx.fillRect(px - 6, -42, 12, 20);
  }
  // The back of the head turns toward whoever is talking: the ear on the far side shows.
  const turn = clamp(a.lookX.x, -1, 1);
  ctx.translate(turn * 3, -6 - breathe * 0.5);
  blob(ctx, -turn * 18, 6, 5, 7, '#efc7a8', 2);
  cached(ctx, heads[id]!, -36, -32, 72, 58, (c) => paintHead(c, at), at.s);
  ctx.restore();
}

/** The folding-chair semicircle from behind: the relatives, the plus-one while seated, then every chair back. */
export function drawCrowd(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const gasp = clamp(c.gasp.x, -1, 1.5);
  for (let i = 0; i < CROWD.length; i += 1) relative(ctx, c.crowd[i]!, CROWD[i]!, i, d, gasp);
  const seated = youAt(d.exitAge).mode === 'seated';
  if (seated) relative(ctx, c.you, YOU, 5, d, gasp);
  cached(ctx, bodies.chairs, 0, 440, 960, 100, paintChairs);
  if (seated && d.playing) youTag(ctx, YOU_SEAT.x, YOU_SEAT.y - 48, d.time);
}

function paintChairs(ctx: CanvasRenderingContext2D): void {
  for (const at of CROWD) foldingChairBack(ctx, at.x, at.y + 46 * at.s, at.s);
  foldingChairBack(ctx, YOU_SEAT.x, YOU_SEAT.y + 46, 1);
}

/** The plus-one's place on the exit: seated, standing, walking to the plate, reaching, walking to the gate, gone. */
export function youAt(exitAge: number): { feet: P; head: P; s: number; mode: 'seated' | 'up' | 'walk' | 'reach' | 'gate' | 'gone'; dist: number; alpha: number } {
  const seat = { x: YOU_SEAT.x, y: 506 };
  const plate = { x: PLATE.x + 8, y: 452 };
  const kerb = { x: 902, y: 392 };
  const gate = { x: 936, y: 328 };
  const scaleAt = (y: number) => mix(0.7, 1, clamp((y - 320) / 190, 0, 1));
  const at = (p: P, mode: ReturnType<typeof youAt>['mode'], dist: number, alpha = 1) => {
    const s = scaleAt(p.y);
    return { feet: p, head: { x: p.x, y: p.y - 112 * s }, s, mode, dist, alpha };
  };
  if (exitAge < 0) return { feet: seat, head: { x: YOU_SEAT.x, y: YOU_SEAT.y }, s: 1, mode: 'seated', dist: 0, alpha: 1 };
  if (exitAge < 0.6) return at(seat, 'up', 0);
  const d1 = Math.hypot(plate.x - seat.x, plate.y - seat.y);
  if (exitAge < 2.3) {
    const u = smoothstep(0, 1, (exitAge - 0.6) / 1.7);
    return at({ x: mix(seat.x, plate.x, u), y: mix(seat.y, plate.y, u) }, 'walk', d1 * u);
  }
  if (exitAge < 3.5) return at(plate, 'reach', d1);
  const d2 = Math.hypot(kerb.x - plate.x, kerb.y - plate.y);
  const d3 = Math.hypot(gate.x - kerb.x, gate.y - kerb.y);
  if (exitAge < 6.2) {
    const u = (exitAge - 3.5) / 2.7;
    const along = smoothstep(0, 1, u) * (d2 + d3);
    const p = along < d2 ? { x: mix(plate.x, kerb.x, along / d2), y: mix(plate.y, kerb.y, along / d2) } : { x: mix(kerb.x, gate.x, (along - d2) / d3), y: mix(kerb.y, gate.y, (along - d2) / d3) };
    return at(p, 'walk', d1 + along);
  }
  if (exitAge < 7) {
    const u = (exitAge - 6.2) / 0.8;
    return at({ x: gate.x + 14 * u, y: gate.y - 6 * u }, 'gate', d1 + d2 + d3 + 20 * u, 1 - smoothstep(0.3, 1, u));
  }
  return at(gate, 'gone', 0, 0);
}

/** The gate's swing for the exit: open as the plus-one reaches it, shut behind them. */
export function gateFor(exitAge: number): number {
  if (exitAge < 0) return 0;
  return smoothstep(5.7, 6.3, exitAge) * (1 - smoothstep(6.9, 7.3, exitAge));
}

function youTag(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.sin(time * 3) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  box(ctx, -22, -11, 44, 18, 6, '#f7a8c8', 2);
  poly(ctx, [-5, 7, 5, 7, 0, 13], '#f7a8c8', 2);
  ctx.fillStyle = '#f7a8c8';
  ctx.fillRect(-4, 5, 8, 3);
  label(ctx, '+1 YOU', 0, -2, 10, '#1c1420', 900);
  ctx.restore();
}

/** The plus-one on their feet: back to us, napkin burrito in hand once the slice is taken. */
export function drawYouWalking(ctx: CanvasRenderingContext2D, d: CastDrive): void {
  const p = youAt(d.exitAge);
  if (p.mode === 'seated' || p.mode === 'gone') return;
  const t = d.time;
  const rise = p.mode === 'up' ? smoothstep(0, 0.6, d.exitAge) : 1;
  const walking = p.mode === 'walk' || p.mode === 'gate';
  const carrying = d.exitAge >= 3.2;
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.translate(p.feet.x, p.feet.y);
  ctx.scale(p.s, p.s);
  ctx.translate(0, (1 - rise) * 40);
  blob(ctx, 0, 0, 24, 5, 'rgba(30, 60, 30, 0.25)', 0);
  // Legs from behind: the gait by distance, each foot lifting in turn.
  const bob = walking ? Math.abs(Math.sin(p.dist / 34 * Math.PI)) * -3 : 0;
  for (const k of [0, 0.5]) {
    const side = k ? 1 : -1;
    const f = walking ? walkingFoot(p.dist, 34, k, 8) : { x: 0, y: 0 };
    const foot = { x: side * 8, y: -f.x * 0.25 + f.y };
    limb(ctx, [{ x: side * 8, y: -60 + bob }, { x: foot.x, y: foot.y - 6 }], 12, '#3b4a6b');
    blob(ctx, foot.x, foot.y - 3, 8, 5, '#f2f2f2', 2);
  }
  // The hoodie from behind, the hood down.
  ctx.translate(0, bob);
  ctx.fillStyle = '#e0a83a';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-19, -58);
  ctx.quadraticCurveTo(-26, -90, -20, -104);
  ctx.quadraticCurveTo(0, -110, 20, -104);
  ctx.quadraticCurveTo(26, -90, 19, -58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  blob(ctx, 0, -100, 14, 7, '#c8902a', 2);
  // Arms: swinging on the walk; at the plate the right one reaches forward (up the picture) for the slice.
  const reach = p.mode === 'reach' ? Math.sin(clamp((d.exitAge - 2.3) / 1.2, 0, 1) * Math.PI) : 0;
  const swing = walking ? Math.sin(p.dist / 34 * Math.PI) * 6 : 0;
  const plateLocal = { x: (PLATE.x - p.feet.x) / p.s, y: (PLATE.y - 4 - p.feet.y) / p.s };
  const right = { x: mix(24, plateLocal.x, reach), y: mix(-62 - swing, plateLocal.y, reach) };
  const left = carrying ? { x: -14, y: -78 } : { x: -24, y: -62 + swing };
  arm(ctx, { x: -18, y: -98 }, left, '#e0a83a', SKIN.you, 1, 26, 24, 10, true);
  const rh = arm(ctx, { x: 18, y: -98 }, right, '#e0a83a', SKIN.you, -1, 26 + 30 * reach, 24 + 30 * reach, 10, true);
  if (d.exitAge >= 2.9 && d.exitAge < 3.2) drawSlice(ctx, rh.x, rh.y - 4, 0.9);
  if (carrying) {
    // The slice in a napkin, rolled like a burrito.
    ctx.save();
    ctx.translate(-14, -84);
    ctx.rotate(-0.5);
    box(ctx, -12, -6, 24, 12, 6, '#fde3ee', 2);
    lines(ctx, [[-4, -6, -2, 6], [4, -6, 6, 6]], 'rgba(200, 120, 150, 0.6)', 1);
    ctx.restore();
  }
  // The back of the head, the beanie.
  blob(ctx, 0, -120, 17, 18, '#2a3b4a');
  blob(ctx, 0, -128, 18, 12, '#2f6f6a', 2.4);
  box(ctx, -18, -124, 36, 6, 3, '#25595a', 2);
  ctx.restore();
  if (p.mode !== 'gate' && d.playing) youTag(ctx, p.head.x, p.head.y - 40 * p.s, t);
}

/** The picture-in-picture after the exit: the plus-one beyond the side gate, cake in hand; the reveal heard small. */
export function drawOutside(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number, crashT: number): void {
  ctx.save();
  ctx.translate(x, y);
  box(ctx, -4, -4, w + 8, h + 8, 8, '#1c1420', 0);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.fillStyle = '#9fd8f5';
  ctx.fillRect(0, 0, w, h);
  // The fence from the street side, the yard's commotion above it.
  ctx.fillStyle = '#b77a48';
  ctx.fillRect(0, h * 0.28, w, h * 0.4);
  ctx.strokeStyle = 'rgba(80, 40, 20, 0.4)';
  ctx.lineWidth = 1;
  for (let px = 0; px < w; px += 12) {
    ctx.beginPath();
    ctx.moveTo(px, h * 0.28);
    ctx.lineTo(px, h * 0.68);
    ctx.stroke();
  }
  if (crashT >= 0) {
    // The detonation, small: a red puff over the fence, a few receipts drifting over.
    for (let i = 0; i < 6; i += 1) {
      const u = crashT - i * 0.1;
      if (u <= 0) continue;
      const r = 8 + 22 * (1 - Math.exp(-u));
      blob(ctx, w * 0.3 + i * 14, h * 0.28 - r * 0.6 - u * 4, r, r, `rgba(232, 70, 90, ${0.55 * Math.exp(-0.25 * u)})`, 0);
    }
    for (let i = 0; i < 4; i += 1) {
      const u = crashT - 0.5 - i * 0.2;
      if (u <= 0) continue;
      ctx.fillStyle = '#fffdf6';
      ctx.fillRect(w * 0.25 + i * 22 + Math.sin(u * 3 + i) * 6, h * 0.12 + ((u * 18) % (h * 0.7)), 5, 7);
    }
    if (crashT < 1.2) label(ctx, '*boom*', w * 0.36, h * 0.16, 11, '#c0283e', 900);
  }
  // The sidewalk.
  ctx.fillStyle = '#d9d4c8';
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
  // The plus-one, facing us now, chewing.
  const cx = w * 0.7;
  const cy = h * 0.9;
  const chew = Math.abs(Math.sin(time * 6));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.62, 0.62);
  box(ctx, -24, -64, 48, 68, 12, '#e0a83a', 2.5);
  blob(ctx, 0, -86, 20, 21, SKIN.you);
  blob(ctx, 0, -100, 20, 12, '#2f6f6a', 2.4);
  box(ctx, -20, -98, 40, 6, 3, '#25595a', 2);
  features(ctx, { lookX: 0.3, lookY: 0, blink: fract(time / 3.3) < 0.04, lids: 0.45, mouth: 0, smile: 0.7, brow: 0.2, worry: 0, sweat: 0 }, { eyeX: 7, eyeY: -88, eyeR: 4, mouthY: -76 + chew, mouthW: 11, skin: SKIN.you });
  blob(ctx, 11, -78, 4 + chew * 1.5, 3.5 + chew, SKIN.you, 1.5);
  limb(ctx, [{ x: 16, y: -50 }, { x: 22, y: -70 }], 10, '#e0a83a');
  ctx.save();
  ctx.translate(22, -76);
  ctx.rotate(-0.8);
  box(ctx, -12, -6, 24, 12, 6, '#fde3ee', 2);
  ctx.restore();
  ctx.restore();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, w, h);
  ink(ctx, 2);
  ctx.strokeRect(-1.5, -1.5, w + 3, h + 3);
  box(ctx, 6, 6, 118, 15, 4, '#1c1420', 0);
  label(ctx, 'BEYOND THE SIDE GATE', 65, 14, 9, '#ffffff', 900, 112);
  ctx.restore();
}
