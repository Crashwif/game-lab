/**
 * Junior, the cook: behind the counter facing the camera in a trucker cap that says CHEMIST, swim goggles, a
 * stained tank top under a KISS THE COOK apron, yellow dish gloves, a mullet and a horseshoe moustache, with a
 * cigarette behind his ear. His left hand (screen right) stirs the turkey fryer with the canoe paddle; his right
 * is free for the jugs, his beer, the phone and talking with. Every gesture is a closed-form path over its own
 * clock, started by a line's beat or an idle scheduler; the arms are two-bone IK to those targets. At the crash
 * the last bad idea (hold my beer, a cigarette, a sneeze, a tap on the gauge) plays on the crash clock, then he
 * flies: a ballistic arc to the pool, the truck bed or the tree (or up into a saucer's beam), and the landing,
 * the cough, the cap and the line are all closed forms of that clock. Presentation only: nothing here reads or
 * changes the committed outcome.
 */
import { BEER, FUNNEL, GAUGE, JUNIOR, KNOB, POOL, TREE, TRUCK } from './layout';
import { blob, box, ink, INK, label, limb, poly } from './ink';
import { type Joint, solveLimb } from './kinematics';
import { clamp, mix, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';
import { BEER_HOME, drawBeerCan, drawJug, GRIP, handForSpout, jugHome, type JugKind, paddleAt, spoutOf, type Still } from './still';

const SKIN = '#f0c39a';
const SUNBURN = '#e9a17d';
const GLOVE = '#ffd23f';
const GLOVE_DARK = '#d9a91a';
const TANK = '#f1ece0';
const APRON = '#c43a32';
const HAIR = '#6b4423';
const CAP_RED = '#c5221b';
export const UPPER = 58;
export const LOWER = 56;

export type Look = 'camera' | 'pot' | 'gauge' | 'cuz' | 'window' | 'jugs';
export type Trigger = 'beer' | 'smoke' | 'sneeze' | 'tap' | 'ignite';
export type Landing = 'pool' | 'truck' | 'tree' | 'ufo';
type FreeKind = 'sip' | 'pour' | 'goggles' | 'wipe' | 'point' | 'phone';
type StirKind = 'tap' | 'swap' | 'turnup' | 'ignite';

interface Gesture<K> { kind: K; t: number; dur: number; from: Joint; jug?: JugKind }

export interface JuniorDrive {
  time: number;
  tension: number;
  depth: number;
  multiplier: number;
  /** The round is running and has not crashed. */
  running: boolean;
  /** Choreography seconds since the crash, or −1. */
  crash: number;
  /** How hard he is talking (the script's `talking`), 0..1. */
  talking: number;
  look: Look;
  /** The crash's last bad idea and where he comes down, once crashed. */
  trigger: Trigger | null;
  landing: Landing | null;
}

export interface Junior {
  lean: Spring;
  nod: Spring;
  turn: Spring;
  lookX: Spring;
  lookY: Spring;
  grin: Spring;
  brow: Spring;
  /** The free hand lifted to talk with. */
  talkArm: Spring;
  /** Goggles: 0 up on the cap, 1 down over his eyes. */
  goggles: Spring;
  bob: number;
  breath: number;
  flush: number;
  sweat: number;
  blinkIn: number;
  blink: number;
  free: Gesture<FreeKind> | null;
  stir: Gesture<StirKind> | null;
  /** The last hands drawn, so an interrupting gesture starts where the hand is. */
  lastFree: Joint;
  lastStir: Joint;
  events: { tap: boolean; yank: boolean; mount: boolean; turn: boolean; ignite: boolean; glug: boolean; sip: boolean; ring: boolean; goggles: boolean };
}

const DURATION: Record<FreeKind | StirKind, number> = { sip: 2.2, pour: 2.8, goggles: 1, wipe: 1.2, point: 1.3, phone: 5.2, tap: 1.5, swap: 2.4, turnup: 1.3, ignite: 1.4 };

export function createJunior(): Junior {
  return {
    lean: spring(0), nod: spring(0), turn: spring(0), lookX: spring(0), lookY: spring(0.1), grin: spring(0.3), brow: spring(0), talkArm: spring(0), goggles: spring(0),
    bob: 0, breath: 0, flush: 0, sweat: 0, blinkIn: 1.6, blink: 0, free: null, stir: null,
    lastFree: freeRest(), lastStir: { x: KNOB.x, y: KNOB.y }, events: blankEvents(),
  };
}
const blankEvents = (): Junior['events'] => ({ tap: false, yank: false, mount: false, turn: false, ignite: false, glug: false, sip: false, ring: false, goggles: false });

export function resetJunior(j: Junior): void {
  for (const s of [j.lean, j.nod, j.turn, j.lookX, j.brow, j.talkArm, j.goggles]) settleSpring(s, 0);
  settleSpring(j.lookY, 0.1);
  settleSpring(j.grin, 0.3);
  j.bob = j.breath = j.flush = j.sweat = 0;
  j.blinkIn = 1.6;
  j.blink = 0;
  j.free = j.stir = null;
}

/** Starts a free-hand gesture (an idle one never cuts a beat's gesture short). */
export function gestureFree(j: Junior, kind: FreeKind, jug?: JugKind, idle = false): void {
  if (j.free && (idle || j.free.kind === 'phone' || j.free.kind === 'pour')) return;
  j.free = { kind, t: 0, dur: DURATION[kind], from: { ...j.lastFree }, jug };
}
/** Starts a stirring-hand gesture: the paddle is let go and wobbles on its own until the hand comes back. */
export function gestureStir(j: Junior, kind: StirKind): void {
  if (j.stir && j.stir.kind === 'swap') return;
  j.stir = { kind, t: 0, dur: DURATION[kind], from: { ...j.lastStir } };
}
/** Hangs up early (the call is over). */
export function hangUp(j: Junior): void {
  if (j.free?.kind === 'phone' && j.free.t < j.free.dur - 0.8) j.free.t = j.free.dur - 0.8;
}
/** Whether the stirring hand is on the paddle. */
export const holding = (j: Junior, d: JuniorDrive): boolean => d.crash < 0 ? j.stir === null && d.running : !(d.trigger === 'tap' || d.trigger === 'ignite');
export const freeBusy = (j: Junior): boolean => j.free !== null;

// ─── The crash clock ────────────────────────────────────────────────────────────────────────────────────────────
/** The crash's beats, in choreography seconds: the trigger, the cut outside, the blast. */
export const CUT = 0.42;
export const BOOM = 0.55;
/** Where each landing is, how long the flight takes and how high it goes. */
const LANDINGS: Record<Exclude<Landing, 'ufo'>, { x: number; y: number; t: number; apex: number }> = {
  pool: { x: POOL.x - 10, y: POOL.y - 20, t: 1.75, apex: -800 },
  truck: { x: TRUCK.x1 - 120, y: TRUCK.ground - 150, t: 1.6, apex: -660 },
  tree: { x: TREE.branch.x - 10, y: TREE.branch.y + 74, t: 1.55, apex: -560 },
};
const LAUNCH = { x: JUNIOR.x, y: 300 };
const G = 2400;
/** Seconds after the boom he lands (or reaches the saucer). */
export const landTime = (landing: Landing): number => (landing === 'ufo' ? 1.2 : LANDINGS[landing].t);
/** After landing: he sits up, coughs a smoke ring, his cap comes down, and he has a word. */
export const AFTER = { sit: 0.45, cough: 0.75, cap: 1.05, line: 1.25 } as const;

/** His body in flight at `u` seconds after the boom: position and spin. Ballistic, closed form. */
export function flightAt(landing: Landing, u: number): { x: number; y: number; spin: number; landed: boolean } {
  if (landing === 'ufo') {
    // Straight up into the beam, slowing as it takes him.
    const k = smoothstep(0, 1.2, u);
    return { x: mix(LAUNCH.x, 900, k), y: mix(LAUNCH.y, -1080, 1 - (1 - k) ** 2), spin: u * 3, landed: u >= 1.2 };
  }
  const l = LANDINGS[landing];
  const t = clamp(u, 0, l.t);
  // vy from the apex, then the time to fall to the landing; vx spreads the distance over the flight.
  const vy = -Math.sqrt(2 * G * (LAUNCH.y - l.apex));
  const a = 0.5 * G;
  // Solve y(T) = l.y with the given vy for the flight's own duration, then scale time so it lasts l.t.
  const T = (-vy + Math.sqrt(vy * vy + 4 * a * (l.y - LAUNCH.y))) / (2 * a);
  const s = (t / l.t) * T;
  const x = mix(LAUNCH.x, l.x, t / l.t);
  const y = LAUNCH.y + vy * s + a * s * s;
  return { x, y, spin: t * 7.5, landed: u >= l.t };
}

// ─── Stepping ───────────────────────────────────────────────────────────────────────────────────────────────────
function lookTarget(look: Look): { x: number; y: number } {
  switch (look) {
    case 'pot': return { x: 0.55, y: 0.65 };
    case 'gauge': return { x: 0.9, y: -0.2 };
    case 'cuz': return { x: -1, y: 0.45 };
    case 'window': return { x: 1, y: -0.35 };
    case 'jugs': return { x: -0.7, y: 0.8 };
    default: return { x: 0, y: 0.1 };
  }
}

export function settleJunior(j: Junior, d: JuniorDrive, gogglesDown: boolean): void {
  resetJunior(j);
  settleSpring(j.goggles, gogglesDown ? 1 : 0);
  settleSpring(j.grin, 0.3 + 0.7 * d.tension);
  settleSpring(j.brow, 0.5 * d.tension);
  j.sweat = smoothstep(0.4, 0.9, d.tension);
  j.flush = smoothstep(0.3, 0.95, d.tension);
  const look = lookTarget(d.crash >= 0 ? 'camera' : d.look);
  settleSpring(j.lookX, look.x);
  settleSpring(j.lookY, look.y);
}

export function stepJunior(j: Junior, d: JuniorDrive, dt: number, gogglesDown: boolean): void {
  j.events = blankEvents();
  const crashed = d.crash >= 0;
  // Gestures run on their own clocks; their beats are events for the scene's cues and props.
  if (j.free) {
    const g = j.free;
    const before = g.t / g.dur;
    g.t += dt;
    const u = g.t / g.dur;
    const crossed = (at: number) => before < at && u >= at;
    if (g.kind === 'pour' && crossed(0.47)) j.events.glug = true;
    if (g.kind === 'sip' && crossed(0.45)) j.events.sip = true;
    if (g.kind === 'phone' && crossed(0.02)) j.events.ring = true;
    if (g.kind === 'goggles' && crossed(0.5)) j.events.goggles = true;
    if (u >= 1) j.free = null;
  }
  if (j.stir) {
    const g = j.stir;
    const before = g.t / g.dur;
    g.t += dt;
    const u = g.t / g.dur;
    const crossed = (at: number) => before < at && u >= at;
    if (g.kind === 'tap' && (crossed(0.36) || crossed(0.48) || crossed(0.6))) j.events.tap = true;
    if (g.kind === 'swap' && crossed(0.26)) j.events.yank = true;
    if (g.kind === 'swap' && crossed(0.66)) j.events.mount = true;
    if (g.kind === 'turnup' && crossed(0.45)) j.events.turn = true;
    if (g.kind === 'ignite' && crossed(0.5)) j.events.ignite = true;
    if (u >= 1) j.stir = null;
  }
  if (crashed) {
    j.free = j.stir = null;
  }
  stepSpring(j.goggles, gogglesDown || (j.free?.kind === 'goggles' && j.free.t / j.free.dur > 0.5) ? 1 : 0, 14, 0.6, dt);

  // Posture: a stir-driven sway, a nervous bob that quickens, a breath.
  j.bob += dt * (crashed ? 0 : 2 + 6 * d.tension);
  j.breath += dt * 1.6;
  const sway = crashed ? 0 : 6 * Math.sin(j.bob * 0.5) * (0.4 + d.tension);
  stepSpring(j.lean, sway + (j.free?.kind === 'pour' ? -6 : 0), 10, 0.8, dt);
  stepSpring(j.nod, j.lean.v * 0.02 + d.talking * Math.sin(d.time * 9) * 0.6, 14, 0.4, dt);

  // Eyes and head: a line turns him to the camera; a gesture to its work; the crash to us, wide.
  let look: Look = d.look;
  if (d.talking > 0.25) look = 'camera';
  if (j.free?.kind === 'pour') look = 'pot';
  if (j.stir?.kind === 'tap' || j.stir?.kind === 'swap') look = 'gauge';
  if (j.stir?.kind === 'turnup' || j.stir?.kind === 'ignite') look = 'pot';
  if (crashed) look = d.trigger === 'tap' ? 'gauge' : d.trigger === 'beer' ? 'cuz' : 'camera';
  const target = lookTarget(look);
  stepSpring(j.lookX, target.x, 16, 0.8, dt);
  stepSpring(j.lookY, target.y, 16, 0.8, dt);
  stepSpring(j.turn, clamp(target.x, -1, 1) * 0.6, 8, 0.85, dt);
  stepSpring(j.grin, crashed ? 0 : 0.3 + 0.7 * d.tension + 0.2 * d.talking, 8, 0.8, dt);
  stepSpring(j.brow, crashed ? 1 : 0.5 * d.tension, 7, 0.85, dt);
  stepSpring(j.talkArm, !crashed && d.talking > 0.15 && !j.free ? 1 : 0, 9, 0.7, dt);
  j.sweat += ((crashed ? j.sweat : smoothstep(0.4, 0.9, d.tension)) - j.sweat) * (1 - Math.exp(-2 * dt));
  j.flush += ((crashed ? j.flush : smoothstep(0.3, 0.95, d.tension)) - j.flush) * (1 - Math.exp(-1.5 * dt));
  if (j.blink > 0) j.blink = Math.max(0, j.blink - dt);
  else if ((j.blinkIn -= dt) <= 0) {
    j.blink = 0.12;
    j.blinkIn = 1.8 + 2.4 * noise(d.time * 3.1);
  }
}

// ─── Pose ───────────────────────────────────────────────────────────────────────────────────────────────────────
export interface JuniorPose {
  hip: Joint;
  neck: Joint;
  head: Joint;
  shoulderL: Joint;
  shoulderR: Joint;
  /** Hand targets: the free hand (screen left) and the stirring hand (screen right). */
  free: Joint;
  stirHand: Joint;
  /** What the free hand holds. */
  holds: { beer: number; jug: JugKind | null; tilt: number; phone: boolean; cig: number; lighter: number; gauge: boolean; point: boolean };
  /** The head's tilt back (a sip, a sneeze) and the mouth's shape. */
  tilt: number;
  mouth: 'grin' | 'talk' | 'o' | 'sip' | 'sneeze' | 'smoke';
  wide: number;
}

/** The funnel's mouth, and how far the jug tips to pour into it. */
const FUNNEL_MOUTH = { x: FUNNEL.x + 2, y: FUNNEL.y - 24 } as const;
const POUR_TILT = 1.25;
/** Where the free hand rests: on the counter's edge by his beer. */
const freeRest = (): Joint => ({ x: BEER.x - 6, y: BEER.y - 4 });
const ear = (head: Joint): Joint => ({ x: head.x - 30, y: head.y + 2 });
const mouthPoint = (head: Joint): Joint => ({ x: head.x, y: head.y + 22 });
const ease = (u: number, a: number, b: number): number => smoothstep(a, b, u);
const lerpJ = (a: Joint, b: Joint, t: number): Joint => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
/** A path through keyframes [u, point]: eased between consecutive keys. */
function path(u: number, keys: readonly [number, Joint][]): Joint {
  if (u <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i += 1) {
    const [u1, p1] = keys[i]!;
    if (u <= u1) {
      const [u0, p0] = keys[i - 1]!;
      return lerpJ(p0, p1, smoothstep(u0, u1, u));
    }
  }
  return keys[keys.length - 1]![1];
}

export function juniorPose(j: Junior, d: JuniorDrive, still: Still): JuniorPose {
  const c = d.crash;
  const crashed = c >= 0;
  const breathe = Math.sin(j.breath) * 1.5;
  const bob = Math.sin(j.bob) * (crashed ? 0 : 1 + 1.5 * d.tension);
  const hip: Joint = { x: JUNIOR.x, y: JUNIOR.hip };
  const lean = j.lean.x;
  let tilt = 0;
  const shoulderY = JUNIOR.shoulder + bob + breathe * 0.5;
  const cx = JUNIOR.x + lean;
  const neck: Joint = { x: cx, y: shoulderY - 12 };
  let head: Joint = { x: cx + lean * 0.3 + j.nod.x * 4 + j.turn.x * 3, y: JUNIOR.head + bob + j.nod.x * 2 };
  const shoulderL: Joint = { x: cx - 56, y: shoulderY + 4 };
  const shoulderR: Joint = { x: cx + 56, y: shoulderY + 4 };
  const holds: JuniorPose['holds'] = { beer: 0, jug: null, tilt: 0, phone: false, cig: 0, lighter: 0, gauge: false, point: false };
  let mouth: JuniorPose['mouth'] = d.talking > 0.1 ? 'talk' : 'grin';
  let wide = 0;

  // The free hand: resting, talking, or a gesture's path.
  const rest = freeRest();
  const talkWob = Math.sin(d.time * 6.2) * 7 * d.talking;
  const talkHand: Joint = { x: cx - 84 + talkWob, y: shoulderY + 36 - Math.abs(talkWob) * 0.5 };
  let free = lerpJ(rest, talkHand, clamp(j.talkArm.x, 0, 1.1));
  const g = j.free;
  if (g && !crashed) {
    const u = clamp(g.t / g.dur, 0, 1);
    const from = g.from;
    switch (g.kind) {
      case 'sip': {
        const can = { x: BEER_HOME.x, y: BEER_HOME.y };
        const lip = { x: head.x - 12, y: head.y + 26 };
        free = path(u, [[0, from], [0.18, can], [0.38, lip], [0.7, lip], [0.88, can], [1, rest]]);
        holds.beer = u > 0.17 && u < 0.89 ? 1 : 0;
        holds.tilt = -1.6 * ease(u, 0.38, 0.48) * (1 - ease(u, 0.62, 0.72));
        tilt = 0.18 * ease(u, 0.38, 0.5) * (1 - ease(u, 0.6, 0.72));
        if (u > 0.4 && u < 0.68) mouth = 'sip';
        break;
      }
      case 'pour': {
        const kind = g.jug ?? 'xxx';
        const home = jugHome(kind);
        // Tipped by its shoulder loop so the mouth sits over the funnel and the jug stays in front of his chest.
        const over = handForSpout(FUNNEL_MOUTH, POUR_TILT);
        const lift = { x: over.x - 24, y: over.y + 12 };
        free = path(u, [[0, from], [0.16, home], [0.32, lift], [0.46, over], [0.74, over], [0.86, home], [1, rest]]);
        holds.jug = u > 0.15 && u < 0.87 ? kind : null;
        holds.tilt = POUR_TILT * ease(u, 0.34, 0.48) * (1 - ease(u, 0.72, 0.84));
        break;
      }
      case 'goggles': {
        const brim = { x: head.x - 4, y: head.y - 34 };
        const eyes = { x: head.x - 6, y: head.y - 6 };
        free = path(u, [[0, from], [0.3, brim], [0.6, eyes], [1, rest]]);
        break;
      }
      case 'wipe': {
        const a = { x: head.x - 40, y: head.y - 14 };
        const b = { x: head.x + 26, y: head.y - 18 };
        free = path(u, [[0, from], [0.3, a], [0.62, b], [1, rest]]);
        break;
      }
      case 'point': {
        const at = { x: cx - 70, y: shoulderY - 2 };
        free = path(u, [[0, from], [0.25, at], [0.75, { x: at.x - 4, y: at.y + 2 }], [1, rest]]);
        holds.point = u > 0.2 && u < 0.8;
        break;
      }
      case 'phone': {
        const pocket = { x: cx - 20, y: shoulderY + 70 };
        const at = { x: ear(head).x + 4, y: ear(head).y + 6 };
        free = path(u, [[0, from], [0.06, pocket], [0.14, at], [0.86, at], [0.94, pocket], [1, rest]]);
        holds.phone = u > 0.06 && u < 0.94;
        break;
      }
    }
  }

  // The stirring hand: on the paddle's grip, or a gesture's path.
  const grip = paddleAt(still, GRIP);
  let stirHand = grip;
  const s = j.stir;
  if (s && !crashed) {
    const u = clamp(s.t / s.dur, 0, 1);
    const from = s.from;
    const face = { x: GAUGE.x - 6, y: GAUGE.y + 2 };
    switch (s.kind) {
      case 'tap': {
        const peck = (at: number) => 8 * Math.exp(-((u - at) ** 2) / 0.0012);
        const near = { x: face.x - 8, y: face.y + 6 };
        stirHand = path(u, [[0, from], [0.25, near], [0.72, near], [1, grip]]);
        if (u > 0.25 && u < 0.72) stirHand = { x: stirHand.x + 6 - peck(0.36) - peck(0.48) - peck(0.6), y: stirHand.y };
        holds.point = false;
        break;
      }
      case 'swap': {
        const toss = { x: shoulderR.x - 10, y: shoulderR.y - 70 };
        const below = { x: GAUGE.x + 40, y: 330 };
        stirHand = path(u, [[0, from], [0.2, face], [0.3, { x: face.x, y: face.y - 22 }], [0.38, toss], [0.5, below], [0.62, face], [0.66, face], [0.82, { x: face.x - 2, y: face.y + 4 }], [1, grip]]);
        holds.gauge = u > 0.5 && u < 0.66;
        // A screw-in twist after it seats.
        if (u > 0.66 && u < 0.82) stirHand = { x: stirHand.x + Math.sin(u * 60) * 3, y: stirHand.y };
        break;
      }
      case 'turnup':
      case 'ignite': {
        const knob = { x: KNOB.x + 2, y: KNOB.y - 4 };
        stirHand = path(u, [[0, from], [0.3, knob], [0.62, { x: knob.x + 3, y: knob.y + 2 }], [1, grip]]);
        break;
      }
    }
  }

  // The crash's last bad idea, on the choreography clock, until the cut outside.
  if (crashed) {
    wide = ease(c, 0, 0.08);
    mouth = 'o';
    const t = d.trigger;
    if (t === 'beer') {
      // "Cuz. Hold my beer." He holds it out to the cousin.
      const out = { x: cx - 100, y: shoulderY + 8 };
      free = path(c, [[0, rest], [0.06, BEER_HOME], [0.22, out]]);
      holds.beer = c > 0.05 ? 1 : 0;
      mouth = c > 0.04 && c < 0.3 ? 'talk' : 'o';
    } else if (t === 'smoke') {
      const lip = mouthPoint(head);
      free = path(c, [[0, rest], [0.08, ear(head)], [0.16, { x: lip.x - 8, y: lip.y + 4 }], [0.24, { x: lip.x - 14, y: lip.y + 8 }]]);
      holds.cig = c > 0.08 ? 1 : 0;
      holds.lighter = c > 0.22 ? 1 : 0;
      mouth = 'smoke';
    } else if (t === 'sneeze') {
      tilt = 0.28 * ease(c, 0.02, 0.26) - 0.5 * ease(c, 0.3, 0.34);
      mouth = c < 0.3 ? 'o' : 'sneeze';
      free = path(c, [[0, rest], [0.3, { x: head.x - 20, y: head.y + 30 }]]);
    } else if (t === 'tap') {
      const face = { x: GAUGE.x - 14, y: GAUGE.y + 8 };
      const peck = (at: number) => 8 * Math.exp(-((c - at) ** 2) / 0.0006);
      stirHand = path(c, [[0, grip], [0.12, face]]);
      stirHand = { x: stirHand.x - peck(0.18) - peck(0.3), y: stirHand.y };
    } else if (t === 'ignite') {
      stirHand = { x: KNOB.x + 2, y: KNOB.y - 4 };
    }
    head = { x: head.x, y: head.y - 4 * wide };
  }
  return { hip, neck, head, shoulderL, shoulderR, free, stirHand, holds, tilt, mouth, wide };
}

// ─── Drawing ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The trucker cap: a white foam front that says CHEMIST, red mesh, a curved bill; goggles parked on it or not. */
function cap(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number, goggles: number, soot = 0): void {
  // Mesh at the sides and back.
  blob(ctx, x, y - r * 0.72, r * 1.05, r * 0.62, CAP_RED, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  for (let i = -3; i <= 3; i += 1) for (let k = 0; k < 2; k += 1) ctx.rect(x + i * 8 - 1, y - r * 1.0 + k * 8, 2, 2);
  ctx.fill();
  // The foam front panel.
  ctx.fillStyle = soot > 0.5 ? '#6a6660' : '#f2efe6';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.82 + turn * 4, y - r * 0.42);
  ctx.quadraticCurveTo(x - r * 0.8 + turn * 4, y - r * 1.38, x + turn * 4, y - r * 1.4);
  ctx.quadraticCurveTo(x + r * 0.8 + turn * 4, y - r * 1.38, x + r * 0.82 + turn * 4, y - r * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  label(ctx, 'CHEMIST', x + turn * 4, y - r * 0.78, 8.5, CAP_RED, 900, r * 1.45);
  // The bill: a curved band at the brow.
  ctx.fillStyle = CAP_RED;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - r * 1.18 + turn * 6, y - r * 0.4);
  ctx.quadraticCurveTo(x + turn * 6, y - r * 0.72, x + r * 1.18 + turn * 6, y - r * 0.4);
  ctx.quadraticCurveTo(x + turn * 6, y - r * 0.12, x - r * 1.18 + turn * 6, y - r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Goggles parked on the cap.
  if (goggles < 0.5) {
    const gy = y - r * 1.36;
    ink(ctx, 3, '#2f6fd6');
    ctx.beginPath();
    ctx.moveTo(x - r * 1.0, gy + 4);
    ctx.lineTo(x + r * 1.0, gy + 4);
    ctx.stroke();
    for (const side of [-1, 1]) blob(ctx, x + side * 11 + turn * 4, gy + 4, 9, 7.5, 'rgba(190, 225, 255, 0.85)', 2.2);
  }
}

/**
 * The head: the mullet's sides under the cap, the face (eyes, goggles, brows, the nose, the moustache, the mouth),
 * sweat, the flush, the cigarette behind his ear, the cap. Soot after the blast.
 */
function drawHead(ctx: CanvasRenderingContext2D, j: Junior, d: JuniorDrive, p: Pick<JuniorPose, 'head' | 'tilt' | 'mouth' | 'wide' | 'holds'>, opts: { soot?: number; capOn?: boolean; frazzle?: number } = {}): void {
  const r = JUNIOR.headR;
  const { x, y } = p.head;
  const soot = opts.soot ?? 0;
  const turn = clamp(j.turn.x, -1, 1);
  const g = clamp(j.goggles.x, 0, 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-p.tilt * 0.4);
  ctx.translate(-x, -y);
  // Ears.
  for (const side of [-1, 1]) blob(ctx, x + side * (r + 1) - turn * 3, y + 3, 6, 9, SKIN, 2.2);
  // The face: a dome with jowls.
  ctx.fillStyle = soot > 0.5 ? '#3a302a' : SKIN;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - r, y - 6);
  ctx.quadraticCurveTo(x - r, y - r - 4, x, y - r - 4);
  ctx.quadraticCurveTo(x + r, y - r - 4, x + r, y - 6);
  ctx.quadraticCurveTo(x + r + 4, y + r * 0.7, x, y + r + 4);
  ctx.quadraticCurveTo(x - r - 4, y + r * 0.7, x - r, y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Stubble and the flush.
  ctx.fillStyle = 'rgba(70, 60, 70, 0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.6, r * 0.8, r * 0.42, 0, 0, Math.PI);
  ctx.fill();
  const flush = 0.18 + 0.4 * j.flush;
  ctx.fillStyle = `rgba(230, 90, 80, ${soot > 0.5 ? 0 : flush})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 18 + turn * 3, y + 10, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sideburns (the business end of the mullet).
  ctx.fillStyle = HAIR;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * (r - 1), y - 14);
    ctx.lineTo(x + side * (r + 1), y + 8);
    ctx.lineTo(x + side * (r - 7), y + 6);
    ctx.lineTo(x + side * (r - 7), y - 14);
    ctx.closePath();
    ctx.fill();
  }
  // Eyes: small and close set; behind the goggles, magnified. Wide at the crash; shut in a blink or a sneeze.
  const look = { x: clamp(j.lookX.x, -1, 1), y: clamp(j.lookY.x, -1, 1) };
  const shut = j.blink > 0 || p.mouth === 'sneeze';
  const mag = 1 + 0.45 * g;
  for (const side of [-1, 1]) {
    const ex = x + side * 11 + turn * 4;
    const ey = y - 2;
    if (shut) {
      ink(ctx, 2.2);
      ctx.beginPath();
      ctx.moveTo(ex - 5, ey);
      ctx.quadraticCurveTo(ex, ey + 3, ex + 5, ey);
      ctx.stroke();
    } else {
      const w = (4.6 + 2 * p.wide) * mag;
      blob(ctx, ex, ey, w, w * 0.9, '#fbf8f2', 1.6);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + look.x * 1.8 * mag, ey + look.y * 1.5 * mag, (2.2 - 0.6 * p.wide) * mag, 0, Math.PI * 2);
      ctx.fill();
    }
    // Goggles down over the eyes.
    if (g > 0.5) {
      blob(ctx, ex, ey, 10, 9, 'rgba(180, 220, 255, 0.35)', 2.4);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(ex - 6, ey - 6, 3, 3);
    }
    // Brows: bushy; worry pulls the inner ends up; the crash lifts both.
    const worry = clamp(j.brow.x, 0, 1);
    ink(ctx, 4, HAIR);
    ctx.beginPath();
    ctx.moveTo(ex - side * 8, ey - 10 - 4 * p.wide + (g > 0.5 ? -4 : 0));
    ctx.lineTo(ex + side * 7, ey - 9 - 5 * worry - 4 * p.wide + (g > 0.5 ? -4 : 0));
    ctx.stroke();
  }
  if (g > 0.5) {
    ink(ctx, 3, '#2f6fd6');
    ctx.beginPath();
    ctx.moveTo(x - r, y - 4);
    ctx.lineTo(x - 21 + turn * 4, y - 3);
    ctx.moveTo(x - 1 + turn * 4, y - 3);
    ctx.lineTo(x + 1 + turn * 4, y - 3);
    ctx.moveTo(x + 21 + turn * 4, y - 3);
    ctx.lineTo(x + r, y - 4);
    ctx.stroke();
  }
  // The nose: bulbous, red at the tip.
  blob(ctx, x + turn * 5, y + 10, 7.5, 7, '#eeb08a', 2);
  blob(ctx, x + turn * 5 + 1, y + 12, 3, 2.4, 'rgba(220, 80, 70, 0.5)', 0);
  // The mouth under the moustache.
  const mx = x + turn * 4;
  const my = y + 24;
  const grin = clamp(j.grin.x, 0, 1.2);
  ctx.fillStyle = '#5a2228';
  ink(ctx, 2);
  if (p.mouth === 'o') {
    blob(ctx, mx, my + 2, 5, 6.5, '#5a2228', 2);
  } else if (p.mouth === 'sneeze') {
    blob(ctx, mx, my + 3, 9, 7, '#5a2228', 2);
  } else if (p.mouth === 'talk') {
    const open = 2 + 6 * Math.abs(Math.sin(d.time * 11)) * clamp(d.talking, 0, 1);
    blob(ctx, mx, my + 1, 10 + 3 * grin, open, '#5a2228', 2);
    ctx.fillStyle = '#fbf8f2';
    ctx.fillRect(mx - 8, my - open + 1.5, 16, 2.5);
  } else if (p.mouth === 'sip') {
    blob(ctx, mx, my, 4, 3, '#5a2228', 2);
  } else {
    // The grin, with a gap where a tooth was.
    const w = 9 + 7 * grin;
    ctx.beginPath();
    ctx.moveTo(mx - w, my - 1);
    ctx.quadraticCurveTo(mx, my + 6 + 6 * grin, mx + w, my - 1);
    ctx.quadraticCurveTo(mx, my + 2, mx - w, my - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (grin > 0.35) {
      ctx.fillStyle = '#fbf8f2';
      ctx.beginPath();
      ctx.moveTo(mx - w + 3, my);
      ctx.quadraticCurveTo(mx, my + 4, mx + w - 3, my);
      ctx.lineTo(mx + w - 4, my + 2);
      ctx.quadraticCurveTo(mx, my + 6, mx - w + 4, my + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5a2228';
      ctx.fillRect(mx + 2, my + 0.5, 3, 4);
    }
  }
  // The horseshoe moustache.
  ctx.fillStyle = HAIR;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(mx - 15, my - 4);
  ctx.quadraticCurveTo(mx, my - 12, mx + 15, my - 4);
  ctx.lineTo(mx + 15, my + 12);
  ctx.lineTo(mx + 10, my + 12);
  ctx.lineTo(mx + 9, my);
  ctx.quadraticCurveTo(mx, my - 4, mx - 9, my);
  ctx.lineTo(mx - 10, my + 12);
  ctx.lineTo(mx - 15, my + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The cigarette: behind his ear, or in his mouth.
  if (p.holds.cig <= 0) {
    ctx.save();
    ctx.translate(x - r - 3 - turn * 3, y - 8);
    ctx.rotate(-0.5);
    box(ctx, -2, -10, 4, 18, 1.5, '#f4f1ea', 1.4);
    ctx.fillStyle = '#d68a3c';
    ctx.fillRect(-2, 4, 4, 4);
    ctx.restore();
  } else if (p.mouth === 'smoke') {
    box(ctx, mx - 22, my + 1, 18, 4, 1.5, '#f4f1ea', 1.4);
    if (p.holds.lighter > 0) blob(ctx, mx - 24, my + 3, 2.4, 2.4, '#ff7a2a', 0);
  }
  // Sweat at the temples.
  if (j.sweat > 0.05 && soot < 0.5) {
    ctx.fillStyle = `rgba(160, 220, 255, ${0.85 * j.sweat})`;
    for (const [side, speed, off] of [[-1, 31, 0], [1, 38, 11], [1, 27, 20]] as const) {
      const fall = ((d.time * speed + off) % 34) / 34;
      if (fall > j.sweat * 1.2) continue;
      ctx.beginPath();
      ctx.ellipse(x + side * (r - 6), y - 16 + fall * 30, 2, 3 + fall, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Soot: a blackened face with white eyes and a hairdo blown straight back, smoking.
  if (soot > 0) {
    ctx.fillStyle = `rgba(30, 24, 22, ${0.7 * soot})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r - 1, r + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const side of [-1, 1]) {
      blob(ctx, x + side * 11, y - 2, 5.5, 5, '#fbf8f2', 1.4);
      blob(ctx, x + side * 11, y - 2, 2, 2, INK, 0);
    }
  }
  if (opts.capOn !== false) cap(ctx, x, y, r, turn, g, soot);
  else if ((opts.frazzle ?? 0) > 0) {
    // The mullet stands straight up, smoking.
    const f = opts.frazzle ?? 0;
    ctx.fillStyle = '#2a1d14';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(x - r + 2, y - r * 0.5);
    for (let i = 0; i <= 8; i += 1) {
      const a = Math.PI + (i / 8) * Math.PI;
      const len = r * (1 + 0.5 * f * (0.7 + 0.3 * Math.sin(i * 2.7)));
      ctx.lineTo(x + Math.cos(a) * len, y - r * 0.3 + Math.sin(a) * len);
    }
    ctx.lineTo(x + r - 2, y - r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** The mullet's party in the back: long hair behind his neck, out over his shoulders (drawn before the body). */
function mullet(ctx: CanvasRenderingContext2D, head: Joint, sway: number): void {
  ctx.fillStyle = HAIR;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(head.x - 32, head.y - 6);
  ctx.quadraticCurveTo(head.x - 50 + sway, head.y + 40, head.x - 44 + sway * 1.4, head.y + 66);
  ctx.lineTo(head.x - 30, head.y + 58);
  ctx.lineTo(head.x - 18, head.y + 66);
  ctx.lineTo(head.x + 18, head.y + 66);
  ctx.lineTo(head.x + 30, head.y + 58);
  ctx.lineTo(head.x + 44 + sway * 1.4, head.y + 66);
  ctx.quadraticCurveTo(head.x + 50 + sway, head.y + 40, head.x + 32, head.y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** The torso: tank top, sunburnt shoulders, the apron over the gut (KISS THE COOK), and the neck. */
function torso(ctx: CanvasRenderingContext2D, j: Junior, p: JuniorPose, scorch = 0): void {
  const sy = p.shoulderL.y;
  const cx = (p.shoulderL.x + p.shoulderR.x) / 2;
  // The body: shoulders down to a gut that rests on the counter.
  ctx.fillStyle = SUNBURN;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(p.shoulderL.x - 6, sy + 8);
  ctx.quadraticCurveTo(cx, sy - 16, p.shoulderR.x + 6, sy + 8);
  ctx.quadraticCurveTo(p.shoulderR.x + 26, sy + 80, p.hip.x + 70, p.hip.y + 10);
  ctx.lineTo(p.hip.x - 70, p.hip.y + 10);
  ctx.quadraticCurveTo(p.shoulderL.x - 26, sy + 80, p.shoulderL.x - 6, sy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The tank top: straps over pale shoulders, the body below the armholes.
  ctx.fillStyle = TANK;
  ctx.beginPath();
  ctx.moveTo(cx - 34, sy - 6);
  ctx.lineTo(cx - 20, sy - 6);
  ctx.quadraticCurveTo(cx, sy + 18, cx + 20, sy - 6);
  ctx.lineTo(cx + 34, sy - 6);
  ctx.quadraticCurveTo(cx + 40, sy + 30, p.shoulderR.x + 18, sy + 50);
  ctx.quadraticCurveTo(p.shoulderR.x + 26, sy + 96, p.hip.x + 66, p.hip.y + 8);
  ctx.lineTo(p.hip.x - 66, p.hip.y + 8);
  ctx.quadraticCurveTo(p.shoulderL.x - 26, sy + 96, p.shoulderL.x - 18, sy + 50);
  ctx.quadraticCurveTo(cx - 40, sy + 30, cx - 34, sy - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Sweat under the arms; a blue splash from an earlier batch.
  ctx.fillStyle = `rgba(214, 186, 80, ${0.2 + 0.4 * j.sweat})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 48, sy + 52, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The neck, thick.
  box(ctx, p.neck.x - 15, p.head.y + 20, 30, sy - p.head.y - 14, 8, SKIN, 2.5);
  // The apron: a bib on a neck strap, over the gut, with its legend.
  ctx.fillStyle = APRON;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(cx - 30, sy + 26);
  ctx.lineTo(cx + 30, sy + 26);
  ctx.quadraticCurveTo(cx + 74, sy + 70, cx + 70, p.hip.y + 30);
  ctx.lineTo(cx - 70, p.hip.y + 30);
  ctx.quadraticCurveTo(cx - 74, sy + 70, cx - 30, sy + 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ink(ctx, 3, APRON);
  ctx.beginPath();
  ctx.moveTo(cx - 26, sy + 28);
  ctx.lineTo(p.neck.x - 12, sy - 4);
  ctx.moveTo(cx + 26, sy + 28);
  ctx.lineTo(p.neck.x + 12, sy - 4);
  ctx.stroke();
  // The legend; after the blast the COOK has burnt off.
  label(ctx, 'KISS THE', cx, sy + 52, 13, '#fbf6ea', 900, 96);
  if (scorch < 0.5) label(ctx, 'COOK', cx, sy + 70, 17, '#fbf6ea', 900, 96);
  else {
    ctx.fillStyle = '#2a1d14';
    ctx.beginPath();
    ctx.moveTo(cx - 44, sy + 62);
    for (let i = 0; i <= 8; i += 1) ctx.lineTo(cx - 44 + i * 11, sy + 62 + (i % 2 ? 8 : 0));
    ctx.lineTo(cx + 44, p.hip.y + 30);
    ctx.lineTo(cx - 44, p.hip.y + 30);
    ctx.closePath();
    ctx.fill();
  }
  // The flip phone's pocket.
  box(ctx, cx + 10, sy + 80, 30, 22, 3, '#a8302a', 2);
}

/** Behind the counter: the hair, the body and the head (the arms come after the counter and the pot). */
export function drawJuniorBody(ctx: CanvasRenderingContext2D, j: Junior, d: JuniorDrive, p: JuniorPose): void {
  mullet(ctx, p.head, j.lean.x * 0.2);
  torso(ctx, j, p);
  drawHead(ctx, j, d, p);
}

/** A yellow dish glove at `end`, pointing along the forearm from `wrist`: a fist, a grip, a point or a thumbs-up. */
function glove(ctx: CanvasRenderingContext2D, wrist: Joint, end: Joint, shape: 'open' | 'fist' | 'point' | 'thumb' = 'open'): void {
  const a = Math.atan2(end.y - wrist.y, end.x - wrist.x);
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(a);
  if (shape === 'thumb') {
    blob(ctx, 0, 0, 10, 9, GLOVE, 2.2);
    box(ctx, -4, -20, 8, 16, 4, GLOVE, 2.2);
  } else if (shape === 'point') {
    blob(ctx, 0, 0, 9.5, 8.5, GLOVE, 2.2);
    blob(ctx, 10, -2, 6, 4, GLOVE, 2);
  } else {
    blob(ctx, 2, 0, shape === 'fist' ? 9.5 : 11, 8.5, GLOVE, 2.2);
    blob(ctx, -2, -7, 4.5, 3.5, GLOVE, 1.8);
    if (shape === 'fist') {
      ink(ctx, 1.4, GLOVE_DARK);
      ctx.beginPath();
      ctx.moveTo(4, -6);
      ctx.lineTo(4, 6);
      ctx.moveTo(8, -5);
      ctx.lineTo(8, 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** One arm: sunburnt upper arm, the glove's long cuff on the forearm, the hand. Returns the hand's solved end. */
function arm(ctx: CanvasRenderingContext2D, shoulder: Joint, target: Joint, pole: number, shape: 'open' | 'fist' | 'point' | 'thumb'): Joint {
  const { joint, end } = solveLimb(shoulder, target, UPPER, LOWER, pole);
  limb(ctx, [shoulder, joint], 17, SUNBURN, 2.5);
  const cuff = { x: mix(joint.x, end.x, 0.42), y: mix(joint.y, end.y, 0.42) };
  limb(ctx, [joint, cuff], 14, SUNBURN, 2.5);
  limb(ctx, [cuff, end], 15, GLOVE, 2.5);
  blob(ctx, cuff.x, cuff.y, 9, 9, GLOVE_DARK, 2);
  glove(ctx, cuff, end, shape);
  return end;
}

/**
 * The arms over the counter: the stirring hand closed on the paddle (or at its gesture), the free hand with
 * whatever it holds (the beer, a jug pouring into the funnel, the flip phone, a cigarette and lighter, the new
 * gauge). Returns where the jug's spout is when it pours, for the stream.
 */
export function drawJuniorArms(ctx: CanvasRenderingContext2D, j: Junior, d: JuniorDrive, p: JuniorPose, still: Still): { spout: Joint | null } {
  const onPaddle = !j.stir && d.running && d.crash < 0;
  const stirEnd = arm(ctx, p.shoulderR, p.stirHand, -1, onPaddle || (d.crash >= 0 && d.trigger !== 'tap' && d.trigger !== 'ignite') ? 'fist' : d.crash >= 0 ? 'point' : j.stir?.kind === 'tap' ? 'point' : 'open');
  if (p.holds.gauge) {
    ctx.save();
    ctx.translate(stirEnd.x + 8, stirEnd.y - 14);
    blob(ctx, 0, 0, 24 + 5 * Math.min(still.level + 1, 5), 24 + 5 * Math.min(still.level + 1, 5), '#5b6068', 2.5);
    blob(ctx, 0, 0, 20 + 5 * Math.min(still.level + 1, 5), 20 + 5 * Math.min(still.level + 1, 5), '#f8f4e8', 1.5);
    ctx.restore();
  }
  j.lastStir = stirEnd;
  // The free hand.
  let shape: 'open' | 'fist' | 'point' | 'thumb' = 'open';
  if (p.holds.beer || p.holds.jug || p.holds.phone || p.holds.cig) shape = 'fist';
  if (p.holds.point) shape = 'point';
  const freeEnd = arm(ctx, p.shoulderL, p.free, 1, shape);
  j.lastFree = freeEnd;
  let spout: Joint | null = null;
  if (p.holds.beer) drawBeerCan(ctx, freeEnd.x + 2, freeEnd.y - 4, p.holds.tilt, d.crash >= 0 ? 1.3 : 1);
  if (p.holds.jug) {
    drawJug(ctx, p.holds.jug, freeEnd.x, freeEnd.y, p.holds.tilt);
    if (p.holds.tilt > POUR_TILT * 0.9) spout = spoutOf(freeEnd.x, freeEnd.y, p.holds.tilt);
  }
  if (p.holds.phone) {
    ctx.save();
    ctx.translate(freeEnd.x + 6, freeEnd.y - 10);
    ctx.rotate(-0.3);
    box(ctx, -7, -16, 14, 30, 3, '#3a3d44', 2);
    box(ctx, -5, -13, 10, 10, 2, '#9fd2ff', 1.2);
    ctx.restore();
  }
  if (p.holds.lighter > 0) {
    box(ctx, freeEnd.x - 4, freeEnd.y - 14, 8, 14, 2, '#d8423a', 1.6);
    const flick = d.crash >= 0 ? ease(d.crash, 0.24, 0.3) : 1;
    if (flick > 0) blob(ctx, freeEnd.x, freeEnd.y - 22, 3 * flick, 6 * flick, '#ffb347', 1.2);
  }
  return { spout };
}

/** The jug's pour: a stream from its mouth into the funnel. */
export function drawPour(ctx: CanvasRenderingContext2D, spout: Joint, colour: string): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(spout.x, spout.y);
  ctx.quadraticCurveTo(spout.x + 4, spout.y + 6, FUNNEL.x, FUNNEL.y - 10);
  ctx.stroke();
}

// ─── After the blast ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Junior after the boom: tumbling through the air, then in the pool, the truck bed or the tree, sooty, the
 * mullet standing up and smoking, the apron burnt to KISS THE. Everything is a closed form of `u`, the seconds
 * since the boom, so a late entry draws exactly what a live viewer saw.
 */
export function drawJuniorFlying(ctx: CanvasRenderingContext2D, j: Junior, d: JuniorDrive, landing: Landing, u: number): void {
  const f = flightAt(landing, u);
  if (landing === 'ufo' && f.landed) return;
  const T = landTime(landing);
  const after = u - T;
  ctx.save();
  if (!f.landed) {
    // Tumbling: arms and legs flailing round the body's spin.
    ctx.translate(f.x, f.y);
    ctx.rotate(f.spin);
    drawRagdoll(ctx, j, d, u);
    ctx.restore();
    return;
  }
  const sit = smoothstep(0, AFTER.sit, after);
  const capOn = after >= AFTER.cap;
  const thumb = after >= AFTER.line;
  if (landing === 'pool') {
    // Sat in the kiddie pool, legs over the rim, a splash going up and coming down.
    seated(ctx, j, d, { x: POOL.x - 10, y: POOL.y - 6 }, -0.25 * (1 - sit), capOn, thumb, after);
  } else if (landing === 'truck') {
    // In the truck bed: boots up first, then he sits up over the rail.
    seated(ctx, j, d, { x: TRUCK.x1 - 120, y: TRUCK.ground - 200 + 60 * (1 - sit) }, -1.2 * (1 - sit), capOn, thumb, after);
  } else if (landing === 'tree') {
    // Hung on the branch by his tank top, swinging down to rest.
    const swing = 0.5 * Math.exp(-after * 2.2) * Math.cos(after * 5.5);
    ctx.translate(TREE.branch.x - 10, TREE.branch.y + 6);
    ctx.rotate(swing);
    hanging(ctx, j, d, capOn, thumb, after);
  }
  ctx.restore();
}

/** The body, drawn about its middle, limbs flailing on the clock (for the flight and for the debris camera). */
function drawRagdoll(ctx: CanvasRenderingContext2D, j: Junior, d: JuniorDrive, u: number): void {
  const flail = (k: number) => Math.sin(u * 19 + k) * 0.7;
  // Legs: jorts and white rubber boots.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 18, 30);
    ctx.rotate(side * 0.4 + flail(side * 2));
    limb(ctx, [{ x: 0, y: 0 }, { x: 0, y: 36 }], 24, '#4f6f9c', 2.5);
    limb(ctx, [{ x: 0, y: 36 }, { x: 0, y: 70 }], 20, SUNBURN, 2.5);
    box(ctx, -12, 64, 26, 30, 6, '#f2f2ee', 2.5);
    ctx.restore();
  }
  // Arms.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 50, -60);
    ctx.rotate(side * (2.2 + flail(side * 3 + 1)));
    limb(ctx, [{ x: 0, y: 0 }, { x: 0, y: 50 }], 16, SUNBURN, 2.5);
    limb(ctx, [{ x: 0, y: 50 }, { x: 0, y: 96 }], 15, GLOVE, 2.5);
    blob(ctx, 0, 100, 10, 9, GLOVE, 2.2);
    ctx.restore();
  }
  // Torso in tatters, the apron burnt.
  blob(ctx, 0, -10, 62, 64, '#5a5048', 2.5);
  poly(ctx, [-44, -40, 44, -40, 52, 30, 28, 22, 10, 40, -12, 26, -34, 40, -52, 30], APRON, 2.5);
  label(ctx, 'KISS THE', 0, -16, 12, '#fbf6ea', 900, 80);
  const pose = { head: { x: 0, y: -92 }, tilt: 0, mouth: 'o' as const, wide: 1, holds: { beer: 0, jug: null, tilt: 0, phone: false, cig: 0, lighter: 0, gauge: false, point: false } };
  drawHead(ctx, j, d, pose, { soot: 1, capOn: false, frazzle: 1 });
}

/** Sitting (in the pool or the bed): legs out, arms on the rim; a thumbs-up for the line. */
function seated(ctx: CanvasRenderingContext2D, j: Junior, d: JuniorDrive, at: Joint, lean: number, capOn: boolean, thumb: boolean, after: number): void {
  ctx.translate(at.x, at.y);
  ctx.rotate(lean);
  // Legs out in front, boots up.
  for (const side of [-1, 1]) {
    limb(ctx, [{ x: side * 16, y: 0 }, { x: side * 30 + 60, y: -10 }], 24, '#4f6f9c', 2.5);
    limb(ctx, [{ x: side * 30 + 60, y: -10 }, { x: side * 30 + 96, y: -30 }], 20, SUNBURN, 2.5);
    ctx.save();
    ctx.translate(side * 30 + 100, -40);
    ctx.rotate(-0.6);
    box(ctx, -12, -18, 26, 30, 6, '#f2f2ee', 2.5);
    ctx.restore();
  }
  // Torso and head, sooty.
  blob(ctx, 0, -60, 60, 62, '#5a5048', 2.5);
  poly(ctx, [-42, -92, 42, -92, 50, -30, 24, -38, 6, -20, -16, -34, -36, -22, -50, -30], APRON, 2.5);
  label(ctx, 'KISS THE', 0, -66, 12, '#fbf6ea', 900, 80);
  const arm1 = thumb ? [{ x: -50, y: -100 }, { x: -86, y: -130 }, { x: -96, y: -176 }] : [{ x: -50, y: -100 }, { x: -96, y: -80 }, { x: -130, y: -60 }];
  limb(ctx, arm1, 16, SUNBURN, 2.5);
  glove(ctx, arm1[1]!, arm1[2]!, thumb ? 'thumb' : 'open');
  limb(ctx, [{ x: 50, y: -100 }, { x: 98, y: -80 }, { x: 132, y: -62 }], 16, SUNBURN, 2.5);
  glove(ctx, { x: 98, y: -80 }, { x: 132, y: -62 }, 'open');
  const capY = capOn ? 0 : 1;
  const pose = { head: { x: 0, y: -140 }, tilt: 0, mouth: (after > 1.6 && after < 2.6 ? 'talk' : 'grin') as 'talk' | 'grin', wide: 0, holds: { beer: 0, jug: null, tilt: 0, phone: false, cig: 0, lighter: 0, gauge: false, point: false } };
  drawHead(ctx, j, { ...d, talking: after > 1.3 && after < 2.4 ? 0.8 : 0 }, pose, { soot: 1, capOn: capY === 0, frazzle: 1 });
}

/** Hanging from the branch by the tank top's straps, boots dangling. */
function hanging(ctx: CanvasRenderingContext2D, j: Junior, d: JuniorDrive, capOn: boolean, thumb: boolean, after: number): void {
  // The straps up to the branch.
  ink(ctx, 4, '#d8d2c2');
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-20, 40);
  ctx.moveTo(14, 0);
  ctx.lineTo(20, 40);
  ctx.stroke();
  ctx.translate(0, 150);
  for (const side of [-1, 1]) {
    limb(ctx, [{ x: side * 18, y: 40 }, { x: side * 20, y: 80 }, { x: side * 18, y: 118 }], 22, side < 0 ? '#4f6f9c' : '#4f6f9c', 2.5);
    box(ctx, side * 18 - 13, 112, 26, 30, 6, '#f2f2ee', 2.5);
  }
  blob(ctx, 0, -10, 60, 62, '#5a5048', 2.5);
  poly(ctx, [-42, -42, 42, -42, 50, 22, 24, 14, 6, 32, -16, 18, -36, 30, -50, 22], APRON, 2.5);
  label(ctx, 'KISS THE', 0, -16, 12, '#fbf6ea', 900, 80);
  const armL = thumb ? [{ x: -50, y: -50 }, { x: -82, y: -80 }, { x: -92, y: -124 }] : [{ x: -50, y: -50 }, { x: -60, y: 2 }, { x: -64, y: 50 }];
  limb(ctx, armL, 16, SUNBURN, 2.5);
  glove(ctx, armL[1]!, armL[2]!, thumb ? 'thumb' : 'open');
  limb(ctx, [{ x: 50, y: -50 }, { x: 60, y: 2 }, { x: 64, y: 50 }], 16, SUNBURN, 2.5);
  glove(ctx, { x: 60, y: 2 }, { x: 64, y: 50 }, 'open');
  const pose = { head: { x: 0, y: -90 }, tilt: 0, mouth: (after > 1.3 && after < 2.4 ? 'talk' : 'grin') as 'talk' | 'grin', wide: 0, holds: { beer: 0, jug: null, tilt: 0, phone: false, cig: 0, lighter: 0, gauge: false, point: false } };
  drawHead(ctx, j, { ...d, talking: after > 1.3 && after < 2.4 ? 0.8 : 0 }, pose, { soot: 1, capOn, frazzle: 1 });
}

/** Where his mouth is in the world after the blast, for his line's bubble. */
export function landedMouth(landing: Landing, u: number): Joint {
  const f = flightAt(landing, u);
  if (!f.landed) return { x: f.x, y: f.y - 90 };
  if (landing === 'pool') return { x: POOL.x - 10, y: POOL.y - 6 - 118 };
  if (landing === 'truck') return { x: TRUCK.x1 - 120, y: TRUCK.ground - 200 - 118 };
  if (landing === 'tree') return { x: TREE.branch.x - 10, y: TREE.branch.y + 6 + 150 - 68 };
  return { x: 900, y: -1100 };
}
/** Where his cap is, flying off at the boom and drifting down to land on his head at AFTER.cap. */
export function capAt(landing: Landing, u: number): { x: number; y: number; spin: number } | null {
  const T = landTime(landing);
  const head = landedMouth(landing, T + 1);
  const end = { x: head.x, y: head.y - 46 };
  const total = T + AFTER.cap;
  if (u >= total) return null;
  const k = u / total;
  // Up and out, then a leaf's drift down onto his head.
  const start = { x: LAUNCH.x + 40, y: LAUNCH.y - 120 };
  const top = { x: mix(start.x, end.x, 0.5) + 160, y: Math.min(start.y, end.y) - 700 };
  const a = mix(mix(start.x, top.x, k), mix(top.x, end.x, k), k);
  const b = mix(mix(start.y, top.y, k), mix(top.y, end.y, k), k);
  return { x: a + Math.sin(u * 4) * 40 * (1 - k), y: b, spin: Math.sin(u * 3) * 0.8 };
}
/** The cap on its own, in the air. */
export function drawCapAlone(ctx: CanvasRenderingContext2D, at: { x: number; y: number; spin: number }): void {
  ctx.save();
  ctx.translate(at.x, at.y + 40);
  ctx.rotate(at.spin);
  cap(ctx, 0, 0, JUNIOR.headR, 0, 0, 0.6);
  ctx.restore();
}
