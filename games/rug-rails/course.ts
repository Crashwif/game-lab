/**
 * The course: the three lanes the runner sprints down, what the generator lays on them, the runner's own
 * physics (lanes, jumps, slides, ramps and train roofs), the pickups, the collisions and what each costs
 * the bag, and the copy-trading bot that steers until the player does. All of it is presentation and a
 * skill score: the round's outcome comes from the room, and nothing here can move it or a credit.
 *
 * Distances are in lane widths. The camera sits at z = 0 looking down the track; the runner is at RUNNER_Z
 * and everything else scrolls toward the camera at the course's speed, which follows the multiplier.
 */
import type { Commands } from './input';
import { type Spring, clamp, mulberry32, settleSpring, spring, stepSpring } from './motion';

export const RUNNER_Z = 1.6;
/** How far ahead the course is laid and drawn. */
export const FAR = 34;
/** The roof of a subway car, which a ramp takes the runner onto. */
export const ROOF = 1;
/** How long a ramp climbs to the roof. */
export const RAMP = 1.4;
/** Half the width an obstacle takes of its lane. */
export const HALF = 0.45;

export type Lane = -1 | 0 | 1;
export const LANES: readonly Lane[] = [-1, 0, 1];

export type ObstacleKind = 'wall' | 'gate' | 'rug' | 'train';
export interface Obstacle {
  kind: ObstacleKind;
  lane: Lane;
  /** The near end, in lane widths ahead of the camera. */
  z: number;
  length: number;
  /** A train with a ramp at its near end, which the runner runs up onto the roof. */
  ramp: boolean;
  /** Knocked through: it collides no more and draws broken. */
  hit: boolean;
  hitAge: number;
  seed: number;
}

/** `slip` is a SLIPPAGE puddle on the floor: steering goes loose for a moment. */
export type PickupKind = 'cope' | 'wagmi' | 'lambo' | 'honey' | 'magnet' | 'double' | 'slip';
export interface Pickup {
  kind: PickupKind;
  /** Lateral position in lane widths; a magnet pulls a coin off its lane. */
  x: number;
  z: number;
  h: number;
  /** Draw order: a coin on a roof draws right after its train. */
  sortZ: number;
  taken: boolean;
  /** Seconds since it was taken, for the pop. */
  age: number;
  seed: number;
}

/** What each coin adds to the bag. */
export const COIN_VALUE: Record<PickupKind, number> = { cope: 1, wagmi: 5, lambo: 25, honey: 0, magnet: 0, double: 0, slip: 0 };
/** How long a power-up lasts. */
export const POWER_S = 6;
/** Every this many coins in a row pays a bonus of the same size. */
export const STREAK_STEP = 25;

export interface Runner {
  lane: Lane;
  /** Lateral position, springing to the lane. */
  x: Spring;
  h: number;
  vh: number;
  /** The surface under the runner: the rails, a ramp or a roof. */
  ground: number;
  /** Seconds left in the slide. */
  slide: number;
  /** Seconds left in the stumble after a light hit. */
  stumble: number;
  /** Seconds left flat on the rails after a heavy hit. */
  down: number;
  /** After a hit nothing else counts for this long. */
  grace: number;
  /** The stride cycle: two footfalls a cycle, advanced by the distance run. */
  stride: number;
  air: number;
  /** Seconds a jump or slide press stays buffered, and the coyote time left after running off a roof. */
  jumpBuf: number;
  slideBuf: number;
  coyote: number;
  /** One lane command (-1 or 1) held through a knockdown, or 0. */
  queued: number;
  /** Seconds of loose steering left after a SLIPPAGE puddle. */
  slip: number;
  /** The car a head-on knockdown rolled the runner away from: it does not collide while the runner is down. */
  dodge: Obstacle | null;
}

/** What happened this step, for the scene's sound and captions; counts and flags last one frame. */
export interface WorldEvents {
  coins: number;
  value: number;
  lambo: boolean;
  honey: boolean;
  magnet: boolean;
  double: boolean;
  jump: boolean;
  slide: boolean;
  swerve: boolean;
  land: boolean;
  stumble: boolean;
  /** The stumble was a car or wall clipped from the side mid-swerve. */
  swipe: boolean;
  heavy: boolean;
  audit: boolean;
  slip: boolean;
  /** The streak that just paid a bonus, or 0. */
  streak: number;
  /** Coins that flew out of the bag this step. */
  spill: number;
  step: boolean;
  /** The power-up that just ran out. */
  expired: 'magnet' | 'double' | null;
}

export interface World {
  time: number;
  runner: Runner;
  obstacles: Obstacle[];
  pickups: Pickup[];
  /** Where the generator lays the next pattern. */
  zNext: number;
  /** The lane the generator last left open, so consecutive blockers keep a path one swerve reaches. */
  lastFree: Lane;
  rand: () => number;
  speed: Spring;
  /** Lane widths travelled this round. */
  distance: number;
  bag: number;
  /** Coins taken since the last hit. */
  streak: number;
  /** How close the Taxman is, 0 to 1: a hit brings him in, and at 1 he takes the bag. */
  heat: number;
  magnet: number;
  double: number;
  /** Seconds since the Taxman's grab, or -1. */
  audit: number;
  /** The bot keeps its own generator, so the course never depends on how often it was consulted. */
  bot: { clock: number; late: number; blind: boolean; rand: () => number };
  events: WorldEvents;
}

export interface Drive {
  /** The round is running: steering, pickups and collisions are live only then. */
  running: boolean;
  /** The round's displayed multiplier; patterns are laid with the curve's value where they will meet the runner. */
  multiplier: number;
  /** Seconds the round has run: with the multiplier, it gives the room's own pace, never a compiled-in curve. */
  seconds?: number;
  /** The runner is off the rails (hovering after a cash-out, or fallen): no steering, no pickups, no collisions. */
  off: boolean;
}

const BASE_SPEED = 5.6;
const SPEED_RISE = 0.55;
export const MAX_SPEED = 16;
const GRAVITY = 12;
const JUMP_V = 3.95;
const SLAM_V = -9;
const SLIDE_S = 0.55;
const STUMBLE_S = 0.5;
const DOWN_S = 0.9;
const GRACE_S = 1;
const HEAT_PER_HIT = 0.6;
const HEAT_DECAY = 0.3;
const RUNNER_HEIGHT = 0.85;
const SLIDE_HEIGHT = 0.4;
/** Half the runner's depth and width (about the drawn frog's), for overlap. */
const REACH = 0.22;
const WIDTH = 0.2;
const COIN_GAP = 0.7;
const BUFFER_S = 0.15;
const COYOTE_S = 0.1;
const SLIP_S = 1;
/** The physics never steps more than this, so a slow frame cannot carry the runner through a wall or a coin. */
const SUBSTEP_S = 1 / 120;

const noEvents = (): WorldEvents => ({ coins: 0, value: 0, lambo: false, honey: false, magnet: false, double: false, jump: false, slide: false, swerve: false, land: false, stumble: false, swipe: false, heavy: false, audit: false, slip: false, streak: 0, spill: 0, step: false, expired: null });

function makeRunner(): Runner {
  return { lane: 0, x: spring(0), h: 0, vh: 0, ground: 0, slide: 0, stumble: 0, down: 0, grace: 0, stride: 0, air: 0, jumpBuf: 0, slideBuf: 0, coyote: 0, queued: 0, slip: 0, dodge: null };
}

export function createWorld(seed: number): World {
  const w: World = {
    time: 0, runner: makeRunner(), obstacles: [], pickups: [], zNext: 0, lastFree: 0, rand: mulberry32(seed), speed: spring(0), distance: 0,
    bag: 0, streak: 0, heat: 0, magnet: 0, double: 0, audit: -1, bot: { clock: 0, late: 0, blind: false, rand: mulberry32(seed) }, events: noEvents(),
  };
  resetWorld(w, seed);
  return w;
}

/** A fresh course for a new round: an open stretch out of the station, then the generator takes over. */
export function resetWorld(w: World, seed: number, multiplier = 1): void {
  w.rand = mulberry32(seed);
  w.time = 0;
  w.runner = makeRunner();
  w.obstacles = [];
  w.pickups = [];
  w.lastFree = 0;
  settleSpring(w.speed, 0);
  w.distance = 0;
  w.bag = 0;
  w.streak = 0;
  w.heat = 0;
  w.magnet = 0;
  w.double = 0;
  w.audit = -1;
  w.bot = { clock: 0, late: 0, blind: false, rand: mulberry32(seed ^ 0x5bd1e995) };
  w.events = noEvents();
  w.zNext = RUNNER_Z + 9;
  coinLine(w, 0, RUNNER_Z + 3.5, RUNNER_Z + 7.5);
  while (w.zNext < FAR + 6) lay(w, multiplier);
}

/** The speed the course runs at for a multiplier: brisk at 1×, capped well before the number goes vertical. */
export const speedFor = (multiplier: number): number => Math.min(MAX_SPEED, BASE_SPEED * (1 + SPEED_RISE * Math.log2(Math.max(1, multiplier))));

/** Lane widths a stride cycle covers: longer strides as the course speeds up, so the cadence keeps rising too. */
const strideLength = (v: number): number => 2.4 + 0.13 * v;

/** Joins a round already running: the course is up to speed and the runner is mid-sprint. */
export function settleRunning(w: World, multiplier: number, elapsedS: number): void {
  const v = speedFor(multiplier);
  settleSpring(w.speed, v);
  w.distance = elapsedS * v * 0.8;
  w.runner.stride = w.distance / strideLength(v);
}

// ---- The generator --------------------------------------------------------------------------------------

function coinLine(w: World, x: number, from: number, to: number, h = 0.15, kind: PickupKind = 'cope', sortZ?: number): Pickup[] {
  const out: Pickup[] = [];
  for (let z = from; z <= to + 1e-6; z += COIN_GAP) {
    const p: Pickup = { kind, x, z, h, sortZ: sortZ ?? z, taken: false, age: 0, seed: w.rand() };
    w.pickups.push(p);
    out.push(p);
  }
  return out;
}

/** Five coins in an arc over a wall: a jump's reward. */
function coinArc(w: World, lane: Lane, at: number): void {
  for (let i = -2; i <= 2; i += 1) {
    const z = at + i * 0.5;
    w.pickups.push({ kind: i === 0 ? 'wagmi' : 'cope', x: lane, z, h: 0.22 + 0.45 * (1 - (i / 2.4) ** 2), sortZ: z, taken: false, age: 0, seed: w.rand() });
  }
}

/** A SLIPPAGE puddle flat on the floor of a lane: run through it and the steering goes loose; jump it and nothing happens. */
function puddle(w: World, lane: Lane, z: number): void {
  w.pickups.push({ kind: 'slip', x: lane, z, h: 0.01, sortZ: z + 0.4, taken: false, age: 0, seed: w.rand() });
}

function obstacle(w: World, kind: ObstacleKind, lane: Lane, z: number, length: number, ramp = false): Obstacle {
  const o: Obstacle = { kind, lane, z, length, ramp, hit: false, hitAge: 0, seed: w.rand() };
  w.obstacles.push(o);
  return o;
}

const pickLane = (r: () => number, from: readonly Lane[] = LANES): Lane => from[Math.floor(r() * from.length)]!;
const nearest = (lanes: readonly Lane[], to: Lane): Lane => [...lanes].sort((a, b) => Math.abs(a - to) - Math.abs(b - to) || a - b)[0]!;

/**
 * The lanes a blocker pattern shuts, leaving a path: with two shut, the open lane is within one swerve of
 * the last open lane; with one shut, whichever open lane is nearest becomes the last open lane.
 */
function block(w: World, count: number): { shut: Lane[]; open: Lane } {
  const r = w.rand;
  if (count >= 2) {
    const candidates = LANES.filter((l) => Math.abs(l - w.lastFree) <= 1);
    const open = pickLane(r, candidates);
    w.lastFree = open;
    return { shut: LANES.filter((l) => l !== open), open };
  }
  const shutLane = pickLane(r);
  const open = nearest(LANES.filter((l) => l !== shutLane), w.lastFree);
  w.lastFree = open;
  return { shut: [shutLane], open };
}

/**
 * Lays the next pattern at zNext: obstacles, the coins that reward getting past them, a trap or a power-up. Its
 * difficulty is the tension (1 - 1/x) of the room's public curve at the moment the pattern reaches the runner,
 * from the multiplier now, the course speed and the pace in decades per second: a forecast of the display, never of
 * the crash point. With no pace yet (before the curve can be measured) it uses the multiplier now.
 */
/** The room's pace in decades per second, read off the display (x = 10^(pace·t) on an exponential curve). */
export const paceOf = (multiplier: number, seconds = 0): number => seconds > 0.5 && multiplier > 1.001 ? Math.log10(multiplier) / seconds : 0;

function lay(w: World, multiplier: number, pace = 0): void {
  const r = w.rand;
  const z = w.zNext;
  const v = Math.max(BASE_SPEED, w.speed.x);
  const tension = 1 - 1 / (Math.max(1, multiplier) * 10 ** ((z - RUNNER_Z) / Math.max(v, speedFor(multiplier)) * pace));
  const pick = r();
  let length = 0.4;
  if (pick < 0.2) {
    // Sell walls to jump: one, or two side by side once the round heats up.
    const count = r() < 0.35 + 0.45 * tension ? 2 : 1;
    const lanes = [...LANES].sort(() => r() - 0.5).slice(0, count) as Lane[];
    for (const lane of lanes) obstacle(w, 'wall', lane, z, 0.35);
    coinArc(w, lanes[0]!, z + 0.15);
    const open = LANES.filter((l) => !lanes.includes(l));
    if (open.length) coinLine(w, pickLane(r, open), z - 1, z + 1.4);
    length = 0.35;
  } else if (pick < 0.36) {
    // KYC gates to slide under, with the coins low beneath them.
    const count = r() < 0.3 + 0.4 * tension ? 2 : 1;
    const lanes = [...LANES].sort(() => r() - 0.5).slice(0, count) as Lane[];
    for (const lane of lanes) obstacle(w, 'gate', lane, z, 0.3);
    const under = coinLine(w, lanes[0]!, z - 0.7, z + 1.2, 0.12);
    if (r() < 0.15 && under[1]) under[1].kind = 'lambo';
    length = 0.3;
  } else if (pick < 0.54) {
    // Rolled-up rugs: nothing gets over or under one, so a lane stays open within a swerve.
    const { shut, open } = block(w, tension > 0.12 && r() < 0.45 ? 2 : 1);
    for (const lane of shut) obstacle(w, 'rug', lane, z, 0.7);
    coinLine(w, open, z - 1.2, z + 1.6, 0.15, r() < 0.3 ? 'wagmi' : 'cope');
    // Sometimes the way out is slippery.
    if (r() < 0.12 + 0.2 * tension) puddle(w, open, z + 2.3);
    length = 0.7;
  } else if (pick < 0.78) {
    // The Exit Scam Express: a ramped car is a road to the roof and its coins, an unramped one a wall.
    const { shut, open } = block(w, tension > 0.12 && r() < 0.5 ? 2 : 1);
    const trainLength = 5 + r() * 4;
    for (const lane of shut) {
      const ramp = r() < 0.65;
      const train = obstacle(w, 'train', lane, z, trainLength, ramp);
      if (ramp) {
        const roof = coinLine(w, lane, z + 1.4, z + trainLength - 0.7, ROOF + 0.15, 'cope', train.z - 0.01);
        if (roof.length) roof[roof.length - 1]!.kind = 'wagmi';
      }
    }
    if (r() < 0.5) {
      obstacle(w, 'wall', open, z + trainLength * 0.5, 0.35);
      coinArc(w, open, z + trainLength * 0.5 + 0.15);
    } else coinLine(w, open, z - 0.5, z + trainLength * 0.6);
    length = trainLength;
  } else if (pick < 0.9) {
    // A zigzag of coins across the lanes; sometimes one of them is a honeypot.
    let lane: Lane = w.lastFree;
    let at = z;
    for (let segment = 0; segment < 3; segment += 1) {
      if (segment === 0 && r() < 0.25) puddle(w, lane, at + 0.9);
      const coins = coinLine(w, lane, at, at + 1.8);
      if (segment === 1 && r() < 0.3 + 0.35 * tension && coins[1]) coins[1].kind = 'honey';
      if (segment === 2 && r() < 0.25 && coins[coins.length - 1]) coins[coins.length - 1]!.kind = 'lambo';
      at += 2.5;
      const next = clamp(lane + (r() < 0.5 ? -1 : 1), -1, 1) as Lane;
      lane = next === lane ? (clamp(lane - 1, -1, 1) as Lane) : next;
    }
    w.lastFree = lane;
    length = 7.5;
  } else {
    // A power-up, half the time behind a wall.
    const lane = pickLane(r);
    if (r() < 0.5) obstacle(w, 'wall', lane, z - 1.1, 0.35);
    w.pickups.push({ kind: r() < 0.5 ? 'magnet' : 'double', x: lane, z, h: 0.3, sortZ: z, taken: false, age: 0, seed: r() });
    length = 0.4;
  }
  const gap = Math.max(2.4, 0.42 * v) * (0.8 + 0.4 * r()) + (1 - tension) * 1.2;
  w.zNext = z + length + gap;
}

// ---- The step ----------------------------------------------------------------------------------------------

interface Contact { ground: number; heavy: Obstacle | null; light: Obstacle | null; side: Obstacle | null }

/**
 * Where the rails (or a ramp, or a roof) are under the runner, and the obstacle it ran into, if any. An obstacle
 * whose near end is already behind the runner, met off-centre, was entered from the side mid-swerve: a swipe.
 */
function contact(w: World): Contact {
  const r = w.runner;
  const top = r.h + (r.slide > 0 ? SLIDE_HEIGHT : RUNNER_HEIGHT);
  const out: Contact = { ground: 0, heavy: null, light: null, side: null };
  for (const o of w.obstacles) {
    const dx = Math.abs(r.x.x - o.lane);
    if (o.hit || dx > WIDTH + HALF || (o === r.dodge && r.down > 0)) continue;
    const near = o.kind === 'train' && o.ramp ? o.z - RAMP : o.z;
    if (near > RUNNER_Z + REACH || o.z + o.length < RUNNER_Z - REACH) continue;
    const side = near < RUNNER_Z - REACH && dx > 0.15;
    switch (o.kind) {
      case 'wall':
        if (r.h < 0.3) out[side ? 'side' : 'light'] = o;
        break;
      case 'gate':
        if (top > 0.5) out[side ? 'side' : 'light'] = o;
        break;
      case 'rug':
        out[side ? 'side' : 'heavy'] = o;
        break;
      case 'train': {
        const g = o.ramp && RUNNER_Z < o.z ? ROOF * clamp((RUNNER_Z - (o.z - RAMP)) / RAMP, 0, 1) : ROOF;
        if (r.h >= g - 0.3) out.ground = Math.max(out.ground, g);
        else out[side ? 'side' : 'heavy'] = o;
        break;
      }
    }
  }
  return out;
}

function spill(w: World, coins: number): void {
  const n = Math.min(w.bag, Math.max(0, Math.round(coins)));
  w.bag -= n;
  w.events.spill += n;
}

/** A light hit: a quarter of the bag spills, the course stutters and the Taxman closes in. */
function hitLight(w: World, o: Obstacle | null): void {
  const r = w.runner;
  if (o) o.hit = true;
  spill(w, Math.max(Math.min(w.bag, 3), Math.ceil(w.bag * 0.25)));
  w.streak = 0;
  r.stumble = STUMBLE_S;
  r.grace = GRACE_S;
  w.speed.x *= 0.75;
  w.heat += HEAT_PER_HIT;
  w.events.stumble = true;
  if (w.heat >= 1) {
    // Two stumbles close together: the Taxman catches up and takes the whole bag.
    w.heat = 1;
    w.audit = 0;
    spill(w, w.bag);
    w.events.audit = true;
  }
}

/** Clipped a car or a wall from the side mid-swerve: bounced back to the lane beside it, and a stumble unless in grace. */
function swipe(w: World, o: Obstacle): void {
  const r = w.runner;
  const back = clamp(o.lane + ((r.x.x - o.lane || -r.x.v) < 0 ? -1 : 1), -1, 1) as Lane;
  if (back !== r.lane) {
    r.lane = back;
    r.x.v *= -0.3;
  }
  if (r.grace > 0 || r.down > 0) return;
  hitLight(w, null);
  w.events.swipe = true;
}

/**
 * Head-on into a rug or a car: the whole bag goes, the course all but stops and the runner rolls. A car has no
 * broken drawing, so the roll carries the runner into a safe lane beside it; with none, the car glitches out.
 */
function hitHeavy(w: World, o: Obstacle): void {
  const r = w.runner;
  const aside = o.kind === 'train' ? LANES.filter((l) => Math.abs(l - o.lane) === 1 && laneSafe(w, l, 2)).sort((a, b) => Math.abs(a - r.x.x) - Math.abs(b - r.x.x))[0] : undefined;
  if (aside === undefined) o.hit = true;
  else {
    r.lane = aside;
    r.dodge = o;
  }
  spill(w, w.bag);
  w.streak = 0;
  r.down = DOWN_S;
  r.grace = GRACE_S + 0.5;
  r.slide = 0;
  r.queued = 0;
  settleSpring(w.speed, w.speed.x * 0.3);
  w.heat = Math.min(1, w.heat + 0.5);
  w.events.heavy = true;
}

function take(w: World, p: Pickup): void {
  p.taken = true;
  p.age = 0;
  const e = w.events;
  switch (p.kind) {
    case 'honey':
      spill(w, Math.ceil(w.bag * 0.2));
      w.streak = 0;
      e.honey = true;
      return;
    case 'magnet':
      w.magnet = POWER_S;
      e.magnet = true;
      return;
    case 'double':
      w.double = POWER_S;
      e.double = true;
      return;
    case 'slip':
      w.runner.slip = SLIP_S;
      e.slip = true;
      return;
    default: {
      const value = COIN_VALUE[p.kind] * (w.double > 0 ? 2 : 1);
      w.bag += value;
      w.streak += 1;
      e.coins += 1;
      e.value += value;
      if (p.kind === 'lambo') e.lambo = true;
      if (w.streak % STREAK_STEP === 0) {
        w.bag += STREAK_STEP;
        e.streak = w.streak;
      }
    }
  }
}

const NO_COMMANDS: Commands = { left: false, right: false, jump: false, slide: false };

/**
 * Advances the course by `dt` seconds with the runner's commands, in substeps no longer than SUBSTEP_S so a slow
 * frame steps the same course as a fast one; the events of every substep add up for the frame.
 */
export function stepWorld(w: World, cmd: Commands, drive: Drive, dt: number): void {
  w.events = noEvents();
  const n = Math.max(1, Math.ceil(dt / SUBSTEP_S - 1e-9));
  for (let i = 0; i < n; i += 1) substep(w, i ? NO_COMMANDS : cmd, drive, dt / n);
}

function substep(w: World, cmd: Commands, drive: Drive, dt: number): void {
  const e = w.events;
  const r = w.runner;
  w.time += dt;
  stepSpring(w.speed, drive.running ? speedFor(drive.multiplier) : 0, drive.running ? 2.2 : 6, 1, dt);
  const move = Math.max(0, w.speed.x) * dt;
  w.distance += move;
  for (const o of w.obstacles) {
    o.z -= move;
    if (o.hit) o.hitAge += dt;
  }
  for (const p of w.pickups) {
    p.z -= move;
    p.sortZ -= move;
    if (p.taken) p.age += dt;
  }
  w.obstacles = w.obstacles.filter((o) => o.z + o.length > 0.5);
  w.pickups = w.pickups.filter((p) => p.z > 0.6 && (!p.taken || p.age < 0.4));
  w.zNext -= move;
  while (w.zNext < FAR + 6) lay(w, drive.multiplier, paceOf(drive.multiplier, drive.seconds));

  // Timers.
  r.slide = Math.max(0, r.slide - dt);
  r.stumble = Math.max(0, r.stumble - dt);
  r.down = Math.max(0, r.down - dt);
  r.grace = Math.max(0, r.grace - dt);
  r.slip = Math.max(0, r.slip - dt);
  if (r.down <= 0) r.dodge = null;
  w.heat = Math.max(0, w.heat - HEAT_DECAY * dt);
  if (w.audit >= 0) w.audit += dt;
  if (w.audit > 2) w.audit = -1;
  if (w.magnet > 0) {
    w.magnet -= dt;
    if (w.magnet <= 0) e.expired = 'magnet';
  }
  if (w.double > 0) {
    w.double -= dt;
    if (w.double <= 0) e.expired = 'double';
  }

  // Steering, unless the runner is down or off the rails. A jump or slide pressed a moment early (in the air, or at
  // the end of a knockdown) is buffered; a jump just after running off a roof still counts; one lane command
  // waits out a knockdown.
  const live = drive.running && !drive.off;
  const steering = live && r.down <= 0;
  const onGround = r.h <= r.ground + 0.02;
  if (cmd.jump) r.jumpBuf = BUFFER_S;
  if (cmd.slide) r.slideBuf = BUFFER_S;
  const turn = (cmd.right ? 1 : 0) - (cmd.left ? 1 : 0);
  if (live && !steering && turn) r.queued = turn;
  if (steering) {
    const lane = clamp(r.lane + (turn || r.queued), -1, 1) as Lane;
    r.queued = 0;
    if (lane !== r.lane) {
      r.lane = lane;
      e.swerve = true;
    }
    if (r.jumpBuf > 0 && (onGround || r.coyote > 0)) {
      r.vh = JUMP_V;
      r.slide = 0;
      r.jumpBuf = r.coyote = 0;
      e.jump = true;
    }
    if (r.slideBuf > 0) {
      // In the air a slide slams the runner down; on the ground it ducks.
      if (!onGround) r.vh = Math.min(r.vh, SLAM_V);
      r.slide = SLIDE_S;
      r.slideBuf = 0;
      e.slide = true;
    }
  }
  r.jumpBuf = Math.max(0, r.jumpBuf - dt);
  r.slideBuf = Math.max(0, r.slideBuf - dt);
  // A SLIPPAGE puddle loosens the lane spring: the swerve overshoots and wobbles back.
  stepSpring(r.x, r.lane, 16, r.slip > 0 ? 0.35 : 0.78, dt);

  // Gravity and the surface: the rails, or the ramp or roof under the runner. Exact for constant gravity.
  r.h += r.vh * dt - 0.5 * GRAVITY * dt * dt;
  r.vh -= GRAVITY * dt;
  const hit = contact(w);
  r.ground = drive.off ? Math.min(r.ground, hit.ground) : hit.ground;
  if (r.h <= r.ground) {
    if (r.vh < -1.5 && r.air > 0.12) e.land = true;
    r.h = r.ground;
    r.vh = 0;
    r.air = 0;
    r.coyote = COYOTE_S;
  } else {
    r.air += dt;
    r.coyote = Math.max(0, r.coyote - dt);
  }
  if (r.h < -6) r.h = -6;

  // Collisions, only while the round runs: a side swipe bounces back, a knocked obstacle stays knocked, and a
  // hit in grace costs nothing (a car is only knocked when run through square).
  if (live) {
    const struck = hit.heavy ?? hit.light;
    if (hit.side) swipe(w, hit.side);
    else if (struck && (r.grace > 0 || r.down > 0)) {
      if (struck.kind !== 'train' || Math.abs(r.x.x - struck.lane) < 0.3) struck.hit = true;
    } else if (hit.heavy) hitHeavy(w, hit.heavy);
    else if (hit.light) hitLight(w, hit.light);
  }

  // Pickups: what the runner touches, and what the magnet pulls in.
  if (live && r.down <= 0) {
    const pull = 1 - Math.exp(-9 * dt);
    for (const p of w.pickups) {
      if (p.taken) continue;
      const coin = COIN_VALUE[p.kind] > 0;
      if (w.magnet > 0 && coin && p.z > 0.8 && p.z < 7 && Math.abs(p.x - r.x.x) < 2.2) {
        p.x += (r.x.x - p.x) * pull;
        p.h += (r.h + 0.3 - p.h) * pull;
      }
      if (Math.abs(p.z - RUNNER_Z) < 0.36 && Math.abs(p.x - r.x.x) < 0.55 && Math.abs(p.h - (r.h + 0.25)) < 0.55) take(w, p);
    }
  }

  // The stride follows the distance run, so the feet keep pace with the rails as the course speeds up or slows
  // to a stop after the crash; standing, the feet settle flat.
  if (!drive.off && w.speed.x > 0.3 && onGround && r.slide <= 0 && r.down <= 0) {
    const before = Math.floor(r.stride * 2);
    r.stride += move / strideLength(w.speed.x);
    if (Math.floor(r.stride * 2) !== before) e.step = true;
  } else if (onGround && w.speed.x <= 0.3) r.stride += (Math.round(r.stride * 2) / 2 - r.stride) * (1 - Math.exp(-6 * dt));
}

// ---- The copy-trading bot --------------------------------------------------------------------------------

const empty = (): Commands => ({ left: false, right: false, jump: false, slide: false });

/** Whether a lane can be entered now and run for `horizon` lane widths without meeting a blocker. */
function laneSafe(w: World, lane: Lane, horizon: number): boolean {
  const r = w.runner;
  for (const o of w.obstacles) {
    if (o.hit || o.lane !== lane) continue;
    if (o.kind === 'train') {
      // Beside a car's body a swerve into it is a wall, unless the runner is already up on a roof.
      const beside = o.z < RUNNER_Z + 0.4 && o.z + o.length > RUNNER_Z - 0.4;
      if (beside && r.h < ROOF - 0.25) return false;
      if (!o.ramp && o.z > RUNNER_Z && o.z < RUNNER_Z + horizon) return false;
    } else if (o.kind === 'rug' && o.z > RUNNER_Z - 0.5 && o.z < RUNNER_Z + horizon) return false;
  }
  return true;
}

/** The coins a lane offers within `horizon`, less any honeypot on it. */
function laneValue(w: World, lane: Lane, horizon: number): number {
  let value = 0;
  for (const p of w.pickups) {
    if (p.taken || Math.round(p.x) !== lane || p.z < RUNNER_Z || p.z > RUNNER_Z + horizon) continue;
    value += p.kind === 'honey' ? -8 : p.kind === 'slip' ? -4 : p.kind === 'magnet' || p.kind === 'double' ? 6 : COIN_VALUE[p.kind];
  }
  return value;
}

/**
 * Steers like a mid trader: it reads the lane ahead every tenth of a second, jumps and slides a little
 * late, chases coins, and every so often looks at its phone and runs straight into a sell wall.
 */
export function autopilot(w: World, dt: number): Commands {
  const cmd = empty();
  const r = w.runner;
  w.bot.clock -= dt;
  if (w.bot.clock > 0) return cmd;
  w.bot.clock = 0.1;
  w.bot.late = w.bot.rand() * 0.14;
  // One look at the phone costs one wall: the hit (which takes that wall out of the threats) ends it.
  if (r.stumble > 0 || r.down > 0) w.bot.blind = false;
  const v = Math.max(3, w.speed.x);
  const horizon = clamp(v * 1.1, 4, 12);
  let threat: Obstacle | null = null;
  for (const o of w.obstacles) {
    if (o.hit || Math.abs(o.lane - r.lane) > 0 || o.z + o.length < RUNNER_Z || o.z > RUNNER_Z + horizon) continue;
    if (o.kind === 'train' && (o.ramp || o.z < RUNNER_Z)) continue;
    if (!threat || o.z < threat.z) threat = o;
  }
  const swerveTo = (lane: Lane) => {
    if (lane < r.lane) cmd.left = true;
    else if (lane > r.lane) cmd.right = true;
  };
  if (threat) {
    const tt = (threat.z - RUNNER_Z) / v;
    if (threat.kind === 'wall' || threat.kind === 'gate') {
      if (tt < 0.36) w.bot.blind = w.bot.blind || w.bot.rand() < 0.02;
      if (tt < 0.22 + w.bot.late && !w.bot.blind) {
        if (threat.kind === 'wall') cmd.jump = true;
        else cmd.slide = true;
      }
      if (threat.z < RUNNER_Z) w.bot.blind = false;
    } else if (tt < 0.75 + w.bot.late) {
      const options = LANES.filter((l) => l !== r.lane && Math.abs(l - r.lane) === 1 && laneSafe(w, l, horizon));
      if (options.length) swerveTo(options.sort((a, b) => laneValue(w, b, horizon) - laneValue(w, a, horizon))[0]!);
      else {
        const any = LANES.filter((l) => l !== r.lane && laneSafe(w, l, 2));
        if (any.length) swerveTo(any[0]!);
      }
    }
    return cmd;
  }
  // A honeypot on the line ahead: hop over it, most of the time.
  const honey = w.pickups.find((p) => !p.taken && p.kind === 'honey' && Math.round(p.x) === r.lane && p.z > RUNNER_Z && p.z < RUNNER_Z + v * 0.3);
  if (honey && w.bot.rand() < 0.75 && r.h <= r.ground + 0.02) {
    cmd.jump = true;
    return cmd;
  }
  // Nothing in the way: drift to the richer lane beside this one when it is clear.
  const here = laneValue(w, r.lane, horizon);
  const better = LANES.filter((l) => Math.abs(l - r.lane) === 1 && laneSafe(w, l, horizon)).map((l) => ({ lane: l, value: laneValue(w, l, horizon) })).sort((a, b) => b.value - a.value)[0];
  if (better && better.value > here + 2 && r.h <= r.ground + 0.02) swerveTo(better.lane);
  return cmd;
}
