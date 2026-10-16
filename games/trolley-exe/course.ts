/**
 * The course: the forks laid out ahead on the distance the trolley has run, the lever at each one, who stands on
 * each branch, the machine that throws the switch until the player does, and what happens as the trolley passes.
 * All of it is presentation and a moral ledger: the backend's crash ends the round whatever the switches said,
 * and no fork reads or predicts the crash point.
 */
import { type Kind, bodiesOf } from './cast';
import type { Commands, Side } from './input';
import { type Dilemma, LADDER, OVERTIME_AUTO, OVERTIME_PROMPTS, OVERTIME_YOU, POOL } from './lines';

export const TROLLEY_X = 300;
/** The distance at which the first fork splits, then the spacing between splits. */
export const FIRST_FORK = 640;
export const SPACING = 600;
/** A fork's geometry along the distance: the split curve, the run where the branches lie, the merge curve. */
export const SPLIT = 110;
export const RUN = 210;
export const MERGE = 110;
export const FORK_LEN = SPLIT + RUN + MERGE;
/** The branches' height above and below the line. */
export const DY: Record<Side, number> = { up: -86, down: 60 };
/** The machine throws its switch about this far before the split, give or take its reaction. */
const DECIDE_AHEAD = 150;
/** Pixels per second: a crawl at 1×, hurrying as the tension climbs. */
export const speedFor = (tension: number): number => 80 + 200 * Math.min(1, Math.max(0, tension));

export interface Fork {
  index: number;
  /** The distance of the split. */
  at: number;
  dilemma: Dilemma;
  lever: Side | null;
  setBy: 'you' | 'auto' | null;
  /** The lever is locked once the trolley reaches the split. */
  locked: boolean;
  resolved: boolean;
  /** Who has fallen, by branch, by position. */
  dead: Record<Side, boolean[]>;
  /** The branch the machine would take, decided when the fork is laid so polling never changes it. */
  botPick: Side;
  botAt: number;
}
export interface LedgerEntry {
  index: number;
  prompt: string;
  side: Side;
  by: 'you' | 'auto';
  bodies: number;
  caption: string;
}
export interface WorldEvents {
  /** Forks the trolley cleared this frame, in order. */
  resolved: Fork[];
  /** Forks whose lever locked this frame. */
  locked: Fork[];
  hits: number;
  /** A switch thrown this frame by the player or the machine. */
  thrown: { fork: Fork; by: 'you' | 'auto' } | null;
}
export interface World {
  seed: number;
  distance: number;
  speed: number;
  forks: Fork[];
  ledger: LedgerEntry[];
  bodies: number;
  yours: number;
  autos: number;
  /** How the player's own switches compare: fewer bodies than the other branch, more, or the same. */
  fewer: number;
  more: number;
  same: number;
  bot: { rand: () => number };
  /** The side the last locked switch sent the trolley: a hand that holds the lever without throwing it keeps it. */
  lastSide: Side;
  events: WorldEvents;
  /** The crash's lunge: how far past the crash distance the trolley has run. */
  crashRun: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A deterministic 0..1 from two integers. */
export function noise(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const noEvents = (): WorldEvents => ({ resolved: [], locked: [], hits: 0, thrown: null });
const fill = (text: string, up: string, down: string, n: number): string => text.replace('{up}', up).replace('{down}', down).replace('{n}', String(n));

/** The fork at `index`: the ladder while it lasts, then a pair composed from the cast, the same for a seed. */
export function dilemmaFor(index: number, seed: number): Dilemma {
  if (index < LADDER.length) return LADDER[index]!;
  const k = index - LADDER.length;
  const a = POOL[Math.floor(noise(k * 3 + 1, seed) * POOL.length)]!;
  let b = POOL[Math.floor(noise(k * 3 + 2, seed) * POOL.length)]!;
  if (b === a) b = POOL[(POOL.indexOf(a) + 1 + Math.floor(noise(k * 3 + 5, seed) * (POOL.length - 1))) % POOL.length]!;
  const na = a.counts[Math.floor(noise(k * 3 + 3, seed) * a.counts.length)]!;
  const nb = b.counts[Math.floor(noise(k * 3 + 4, seed) * b.counts.length)]!;
  const up: Kind[] = Array.from({ length: na }, () => a.kind);
  const down: Kind[] = Array.from({ length: nb }, () => b.kind);
  const name = (entry: (typeof POOL)[number], n: number) => `${n === 1 ? 'one' : n === 3 ? 'three' : 'five'} ${n === 1 ? entry.one : entry.many} ${entry.tag}`;
  const upName = name(a, na);
  const downName = name(b, nb);
  const pick = <T,>(items: T[], salt: number): T => items[Math.floor(noise(k * 7 + salt, seed) * items.length)]!;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    prompt: cap(fill(pick(OVERTIME_PROMPTS, 11), upName, downName, index + 1)),
    up, down,
    you: { up: cap(fill(pick(OVERTIME_YOU.up, 12), upName, downName, index + 1)), down: cap(fill(pick(OVERTIME_YOU.down, 13), upName, downName, index + 1)) },
    auto: { up: cap(fill(pick(OVERTIME_AUTO.up, 14), upName, downName, index + 1)), down: cap(fill(pick(OVERTIME_AUTO.down, 15), upName, downName, index + 1)) },
  };
}

/** The machine's doctrine: the branch with fewer bodies, and when they tie, whichever its coin says; one fork in eight it misreads the card. */
function botChoice(d: Dilemma, index: number, seed: number): Side {
  const up = bodiesOf(d.up), down = bodiesOf(d.down);
  const coin = noise(index * 5 + 9, seed);
  let side: Side = up < down ? 'up' : down < up ? 'down' : coin < 0.5 ? 'up' : 'down';
  if (noise(index * 5 + 10, seed) < 0.125) side = side === 'up' ? 'down' : 'up';
  return side;
}

function layFork(w: World, index: number): Fork {
  const dilemma = dilemmaFor(index, w.seed);
  return {
    index, at: FIRST_FORK + index * SPACING, dilemma, lever: null, setBy: null, locked: false, resolved: false,
    dead: { up: dilemma.up.map(() => false), down: dilemma.down.map(() => false) },
    botPick: botChoice(dilemma, index, w.seed),
    botAt: DECIDE_AHEAD * (0.7 + 0.6 * noise(index * 5 + 11, w.seed)),
  };
}

/** Keeps forks laid out to a screen and a half ahead; old ones are kept for the ledger and drop off the back. */
function ensureForks(w: World): void {
  while (w.forks.length === 0 || w.forks[w.forks.length - 1]!.at < w.distance + 1600) w.forks.push(layFork(w, w.forks.length === 0 ? 0 : w.forks[w.forks.length - 1]!.index + 1));
  while (w.forks.length > 2 && w.forks[0]!.at + FORK_LEN < w.distance - 900 && w.forks[1]!.resolved) w.forks.shift();
}

export function createWorld(seed: number): World {
  const w: World = { seed, distance: 0, speed: 0, forks: [], ledger: [], bodies: 0, yours: 0, autos: 0, fewer: 0, more: 0, same: 0, bot: { rand: mulberry32(seed ^ 0x5bd1e995) }, lastSide: 'up', events: noEvents(), crashRun: 0 };
  resetWorld(w, seed);
  return w;
}
export function resetWorld(w: World, seed: number): void {
  w.seed = seed;
  w.distance = 0;
  w.speed = 0;
  w.forks = [];
  w.ledger = [];
  w.bodies = w.yours = w.autos = w.fewer = w.more = w.same = 0;
  w.bot = { rand: mulberry32(seed ^ 0x5bd1e995) };
  w.lastSide = 'up';
  w.events = noEvents();
  w.crashRun = 0;
  ensureForks(w);
}

/** The next fork whose lever can still be thrown. */
export const nextFork = (w: World): Fork | null => w.forks.find((f) => !f.locked) ?? null;
/** The fork the trolley is inside, if any. */
export const currentFork = (w: World): Fork | null => w.forks.find((f) => w.distance >= f.at && w.distance < f.at + FORK_LEN) ?? null;

/** Where a branch sits above or below the line at `progress` through a fork (0 at the split, 1 at the merge). */
export function branchOffset(progress: number, side: Side): number {
  const dy = DY[side];
  const p = progress * FORK_LEN;
  if (p <= 0 || p >= FORK_LEN) return 0;
  if (p < SPLIT) {
    const t = p / SPLIT;
    return dy * t * t * (3 - 2 * t);
  }
  if (p < SPLIT + RUN) return dy;
  const t = (p - SPLIT - RUN) / MERGE;
  return dy * (1 - t * t * (3 - 2 * t));
}
/** The trolley's offset from the line and its heading, from the fork it is inside and the lever that fork locked on. */
export function trolleyOffset(w: World): { dy: number; angle: number } {
  const f = currentFork(w);
  if (!f || !f.lever) return { dy: 0, angle: 0 };
  const p = (w.distance - f.at) / FORK_LEN;
  const dy = branchOffset(p, f.lever);
  const ahead = branchOffset(Math.min(1, p + 6 / FORK_LEN), f.lever);
  return { dy, angle: Math.atan2(ahead - dy, 6) };
}
/** Where the people on a branch stand along the distance. */
export function standAt(f: Fork, side: Side): number[] {
  const n = f.dilemma[side].length;
  return Array.from({ length: n }, (_, i) => f.at + SPLIT + (RUN * (i + 1)) / (n + 1));
}

/** Throws the next fork's switch. */
export function throwLever(w: World, side: Side, by: 'you' | 'auto'): Fork | null {
  const f = nextFork(w);
  if (!f) return null;
  f.lever = side;
  f.setBy = by;
  w.events.thrown = { fork: f, by };
  return f;
}

/** Locks a fork's lever at the split. Unthrown, it is the machine's pick, or, in a hand that holds it, the side it already pointed. */
function lock(w: World, f: Fork, manual: boolean): void {
  if (f.lever === null) {
    f.lever = manual ? w.lastSide : f.botPick;
    f.setBy = manual ? 'you' : 'auto';
  }
  w.lastSide = f.lever;
  f.locked = true;
  w.events.locked.push(f);
}

function resolve(w: World, f: Fork): void {
  f.resolved = true;
  const side = f.lever ?? f.botPick;
  const by = f.setBy ?? 'auto';
  const taken = bodiesOf(f.dilemma[side]);
  const other = bodiesOf(f.dilemma[side === 'up' ? 'down' : 'up']);
  w.bodies += taken;
  if (by === 'you') {
    w.yours += taken;
    if (taken < other) w.fewer += 1;
    else if (taken > other) w.more += 1;
    else w.same += 1;
  } else w.autos += taken;
  w.ledger.push({ index: f.index, prompt: f.dilemma.prompt, side, by, bodies: taken, caption: captionOf(f, side) });
  if (w.ledger.length > 40) w.ledger.shift();
  w.events.resolved.push(f);
}
import { caption } from './cast';
const captionOf = (f: Fork, side: Side): string => caption(f.dilemma[side]);

export interface Drive {
  running: boolean;
  tension: number;
  /** The crash's lunge: the trolley runs on fast and takes both branches of whatever is ahead. */
  crashing: boolean;
  /** Whose hand the commands come from, and whether a hand holds the lever at all. */
  by: 'you' | 'auto';
  manual: boolean;
}

/** Advances the course by `dt` seconds. Switches thrown this frame apply before the trolley moves. */
export function stepWorld(w: World, cmd: Commands, drive: Drive, dt: number): void {
  w.events = noEvents();
  if (cmd.up) throwLever(w, 'up', drive.by);
  else if (cmd.down) throwLever(w, 'down', drive.by);
  if (drive.crashing) {
    const v = 900;
    w.distance += v * dt;
    w.crashRun += v * dt;
    w.speed = v;
    for (const f of w.forks) {
      if (w.distance < f.at) continue;
      if (!f.locked) lock(w, f, drive.manual);
      for (const side of ['up', 'down'] as Side[]) standAt(f, side).forEach((x, i) => {
        if (!f.dead[side][i] && w.distance >= x - 10) {
          f.dead[side][i] = true;
          w.events.hits += 1;
        }
      });
    }
    return;
  }
  if (!drive.running) {
    w.speed = 0;
    return;
  }
  w.speed = speedFor(drive.tension);
  const step = Math.min(dt, 1 / 30);
  let left = dt;
  while (left > 1e-6) {
    const h = Math.min(step, left);
    left -= h;
    w.distance += w.speed * h;
    ensureForks(w);
    for (const f of w.forks) {
      if (f.resolved) continue;
      if (!f.locked && w.distance >= f.at - 2) lock(w, f, drive.manual);
      if (f.locked && f.lever) {
        standAt(f, f.lever).forEach((x, i) => {
          if (!f.dead[f.lever!][i] && w.distance >= x - 10) {
            f.dead[f.lever!][i] = true;
            w.events.hits += 1;
          }
        });
        if (w.distance >= f.at + FORK_LEN - 30) resolve(w, f);
      }
    }
  }
}

/** The machine's hand: it throws the next switch a little before the split, at the branch it decided when the fork was laid. */
export function autopilot(w: World): Commands {
  const cmd: Commands = { up: false, down: false };
  const f = nextFork(w);
  if (!f || f.lever !== null) return cmd;
  if (w.distance >= f.at - f.botAt) cmd[f.botPick] = true;
  return cmd;
}

/**
 * The distance run after `seconds` at `multiplier`, in closed form, for a scene that missed the start: the
 * multiplier is taken to have grown exponentially, so the tension is 1 − m^(−t/S) and the speed integrates.
 */
export function distanceAt(seconds: number, multiplier: number): number {
  const S = Math.max(0, seconds);
  const m = Math.max(1.0001, multiplier);
  const tensionIntegral = S - (S * (1 - 1 / m)) / Math.log(m);
  return 80 * S + 200 * tensionIntegral;
}

/** Settles a fresh course into a round already `seconds` in: the forks behind count as the machine's, with their fallen. */
export function settleRunning(w: World, multiplier: number, seconds: number): void {
  w.distance = distanceAt(seconds, multiplier);
  ensureForks(w);
  for (const f of w.forks) {
    if (w.distance < f.at - 2) break;
    lock(w, f, false);
    standAt(f, f.lever!).forEach((x, i) => { if (w.distance >= x - 10) f.dead[f.lever!][i] = true; });
    if (w.distance >= f.at + FORK_LEN - 30) resolve(w, f);
  }
  w.events = noEvents();
}

/** The player's standing from their own switches. */
export function alignment(w: World): string {
  const thrown = w.fewer + w.more + w.same;
  if (thrown === 0) return w.ledger.length ? 'DELEGATED' : 'UNTESTED';
  if (w.fewer > w.more) return 'UTILITARIAN';
  if (w.more > w.fewer) return 'SENTIMENTAL';
  return 'UNDECIDED';
}
