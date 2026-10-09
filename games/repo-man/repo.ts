/**
 * The repossession itself: Gary's job queue (each rung he passes adds a job: walk to the item, take it, carry it
 * to the flatbed, heave it onto the stack), the stack's physics (a lean spring every landing kicks, the truck's
 * suspension sagging under the load, a squash per item), the supercar's hook, lift and winch, the checklist, the
 * exit (the hook comes off, everything flies home, Gary sits on the tailgate) and the crash (Gary takes the
 * front door and drives away with it). Poses are computed here from the job clocks; drawing lives elsewhere.
 * Everything keys off the displayed multiplier and the round's clocks; nothing here reads or changes the outcome.
 */
import type { Effect } from './audio';
import { type ItemId, JOBS, type JobKind } from './lines';
import { clamp, mix, mulberry32, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

/** Gary's sidewalk, where he walks; the flatbed's deck; the supercar on the driveway apron. */
export const LANE_Y = 474;
export const IDLE_X = 382;
export const CAB_X = 128;
export const DOOR_X = 540;
export const DECK_Y = 462;
export const DECK_FRONT = 152;
export const DECK_TAIL = 352;
export const LEVER = { x: 344, y: 436 } as const;
export const APRON_X = 362;
export const APRON_Y = 508;
export const CAR_LEN = 196;
export const SIT_X = 338;
export const POST = { x: 610, y: 480 } as const;
/** Gary steps out from behind the cab and walks to his spot in this long. */
export const ARRIVE_S = 1.7;

const SPEED = 250;
const HEAVY = 175;
const TOSS_S = 0.75;
const WINCH_S = 2.4;

export interface Pose { x: number; y: number; rot: number }
interface ItemSpec { h: number; weight: number; home: Pose }

/** Each item's height, its weight on the deck, and where it lives on the set. */
export const ITEMS: Record<ItemId, ItemSpec> = {
  hose: { h: 18, weight: 1, home: { x: 456, y: 392, rot: 0 } },
  tv: { h: 42, weight: 2, home: { x: 386, y: 338, rot: 0 } },
  bike: { h: 46, weight: 2, home: { x: 668, y: 401, rot: 0 } },
  fridge: { h: 80, weight: 4, home: { x: 454, y: 352, rot: 0 } },
  mailbox: { h: 24, weight: 1, home: { x: 610, y: 438, rot: 0 } },
  numbers: { h: 18, weight: 1, home: { x: 594, y: 343, rot: 0 } },
  porch: { h: 34, weight: 5, home: { x: 541, y: 401, rot: 0 } },
  gutter: { h: 10, weight: 2, home: { x: 540, y: 192, rot: 0 } },
};
export const ORDER: ItemId[] = ['hose', 'tv', 'bike', 'fridge', 'mailbox', 'numbers', 'porch', 'gutter'];

/**
 * Where each item lands, in landing order: the hose and the mailbox on the supercar's rear deck, the TV on its roof
 * with the fridge standing on the TV, the bike lying on the hood with the house numbers on the bike, the porch
 * balanced on the fridge like a tray and the gutters across the top, longer than the truck. Centres, bottoms on
 * whatever is under them.
 */
export const SLOTS: Record<ItemId, Pose> = {
  hose: { x: 334, y: 418, rot: 0.2 },
  tv: { x: 268, y: 391, rot: -0.03 },
  bike: { x: 196, y: 414, rot: -0.2 },
  fridge: { x: 264, y: 330, rot: 0.02 },
  mailbox: { x: 330, y: 398, rot: 0.12 },
  numbers: { x: 192, y: 384, rot: -0.18 },
  porch: { x: 262, y: 273, rot: 0.03 },
  gutter: { x: 250, y: 251, rot: -0.02 },
};

interface Spec { pick: number | null; work: number; item?: ItemId; finish: 'toss' | 'winch' | null; heavy?: boolean }
const SPEC: Record<JobKind, Spec> = {
  hook: { pick: null, work: 1.1, finish: null },
  opener: { pick: null, work: 1.6, finish: null },
  lift: { pick: null, work: 1.3, finish: null },
  load: { pick: null, work: 3.2, finish: null },
  wave: { pick: null, work: 1.9, finish: null },
  note: { pick: null, work: 1.0, finish: null },
  hose: { pick: 436, work: 1.2, item: 'hose', finish: 'toss' },
  tv: { pick: 412, work: 1.25, item: 'tv', finish: 'toss' },
  bike: { pick: 640, work: 1.9, item: 'bike', finish: 'toss' },
  fridge: { pick: 548, work: 1.3, item: 'fridge', finish: 'toss', heavy: true },
  mailbox: { pick: 590, work: 0.8, item: 'mailbox', finish: 'toss' },
  numbers: { pick: 576, work: 1.6, item: 'numbers', finish: 'toss' },
  porch: { pick: 476, work: 1.0, item: 'porch', finish: 'winch' },
  qr: { pick: 528, work: 1.7, finish: null },
  gutter: { pick: 350, work: 1.1, item: 'gutter', finish: 'toss' },
  vest: { pick: 590, work: 2.3, finish: null },
};

export interface Timing { from: number; pick: number; out: number; work: number; back: number; finish: number; total: number }
const walkTime = (a: number, b: number, speed: number): number => (Math.abs(b - a) < 1 ? 0 : 0.25 + Math.abs(b - a) / speed);
export function timing(kind: JobKind, from: number): Timing {
  const s = SPEC[kind];
  const pick = s.pick ?? IDLE_X;
  const out = walkTime(from, pick, SPEED);
  const back = s.pick === null ? 0 : walkTime(pick, IDLE_X, s.heavy ? HEAVY : SPEED);
  const finish = s.finish === 'toss' ? TOSS_S : s.finish === 'winch' ? WINCH_S : 0;
  return { from, pick, out, work: s.work, back, finish, total: out + s.work + back + finish };
}

export interface Act {
  kind: JobKind | 'idle' | 'arrive' | 'cab' | 'exit' | 'crash' | 'sit';
  phase: 'out' | 'work' | 'back' | 'finish' | 'idle' | string;
  /** Progress 0..1 and seconds within the phase. */
  u: number;
  t: number;
  x: number;
  face: 1 | -1;
  /** 0..1: how fast Gary is walking. */
  moving: number;
  item: ItemId | 'door' | null;
  /** How far up out of sight behind the cab (1 = gone). */
  hidden: number;
}

export interface Entry { text: string; done: boolean; open: boolean; age: number }
export interface Returning { id: ItemId; from: Pose; start: number }
export interface ExitState { age: number; from: number; face: 1 | -1; loaded: number; tilted: number; hooked: boolean; lifted: number; returning: Returning[] }
export interface CrashTimes { arrive: number; pull: number; atCab: number; stow: number; drive: number; dark: number }
export interface CrashState { age: number; from: number; face: 1 | -1; dodged: boolean; dropped: ItemId | null; dropX: number; loaded: boolean; hooked: boolean; times: CrashTimes; screws: { vx: number; vy: number; spin: number }[]; sway: number }

export interface Repo {
  next: number;
  queue: number[];
  job: { index: number; age: number; time: Timing } | null;
  done: boolean[];
  stacked: ItemId[];
  /** Seconds since the round started running (Gary's walk from the cab); large on a late entry. */
  runAge: number;
  x: number;
  walk: number;
  act: Act;
  lean: Spring;
  sag: Spring;
  squash: Record<ItemId, Spring>;
  entries: Entry[];
  events: [Effect, number][];
  exit: ExitState | null;
  crash: CrashState | null;
  /** The house shuddering on its slab: seconds since the last kick, and how hard. */
  shudder: number;
  shudderAmp: number;
}

const restAct = (): Act => ({ kind: 'cab', phase: 'idle', u: 0, t: 0, x: CAB_X, face: 1, moving: 0, item: null, hidden: 1 });

export function createRepo(): Repo {
  const squash = {} as Record<ItemId, Spring>;
  for (const id of ORDER) squash[id] = spring(0);
  return {
    next: 0, queue: [], job: null, done: JOBS.map(() => false), stacked: [], runAge: 0, x: CAB_X, walk: 0, act: restAct(),
    lean: spring(0), sag: spring(0), squash, entries: [{ text: 'The vibe', done: false, open: true, age: 9 }], events: [],
    exit: null, crash: null, shudder: 99, shudderAmp: 0,
  };
}

export function resetRepo(r: Repo): void {
  Object.assign(r, createRepo());
}

const MAX_ENTRIES = 40;
export function addEntry(r: Repo, text: string, done: boolean, open = false): void {
  r.entries.push({ text, done, open, age: done ? 9 : 0 });
  if (r.entries.length > MAX_ENTRIES) r.entries.splice(0, r.entries.length - MAX_ENTRIES);
}
function tickEntry(r: Repo, text: string | undefined, live: boolean): void {
  if (!text) return;
  for (let i = r.entries.length - 1; i >= 0; i -= 1) {
    const e = r.entries[i]!;
    if (e.text === text && !e.done) {
      e.done = true;
      e.age = 0;
      if (live) r.events.push(['tick', 0.55]);
      return;
    }
  }
}
const jobIndex = (kind: JobKind): number => JOBS.findIndex((j) => j.kind === kind);
/** Whether the job of this kind is done this round. */
export const jobDone = (r: Repo, kind: JobKind): boolean => r.done[jobIndex(kind)] === true;
const HOOK = jobIndex('hook');
const LIFT = jobIndex('lift');
const LOAD = jobIndex('load');

/** Settles a fresh scene into a round already at `multiplier`: every job below it done, the pile built, Gary at his spot. */
export function settleRepo(r: Repo, multiplier: number, elapsed: number): void {
  resetRepo(r);
  r.runAge = Math.max(ARRIVE_S, elapsed);
  r.x = IDLE_X;
  while (r.next < JOBS.length && multiplier >= JOBS[r.next]!.at) {
    const j = JOBS[r.next]!;
    r.done[r.next] = true;
    if (j.entry) addEntry(r, j.entry, !j.open, j.open);
    const item = SPEC[j.kind].item;
    if (item) r.stacked.push(item);
    r.next += 1;
  }
  if (r.done[LOAD]) tickEntry(r, JOBS[HOOK]!.entry, false);
  settleSpring(r.sag, sagFor(r));
  r.act = idleAct(0);
}

const sagFor = (r: Repo): number => Math.min(7, r.stacked.reduce((s, id) => s + ITEMS[id].weight, 0) * 0.35 + (r.done[LOAD] ? 2 : 0));

/** Cue times within a job, relative to its start. */
function cues(kind: JobKind, t: Timing): [number, Effect, number][] {
  const w = t.out;
  const f = t.out + t.work + t.back;
  switch (kind) {
    case 'hook': return [[w + 0.75, 'clang', 0.9]];
    case 'opener': return [[w + 0.45, 'whoosh', 0.25], [w + 0.9, 'click', 0.3]];
    case 'lift': return [[w + 0.2, 'ratchet', 0.6], [w + 0.65, 'beep', 0.5], [w + 0.9, 'beep', 0.35]];
    case 'load': return [[0.15, 'ratchet', 0.6], [0.7, 'ratchet', 0.7], [1.5, 'ratchet', 0.7], [2.5, 'thud', 0.5]];
    case 'hose': return [[w + 0.2, 'squeak', 0.3], [f + 0.25, 'whoosh', 0.35]];
    case 'tv': return [[w + 0.3, 'click', 0.5], [w + 0.5, 'pop', 0.8], [f + 0.25, 'whoosh', 0.35]];
    case 'bike': return [[w + 0.3, 'click', 0.3], [w + 1.05, 'pop', 0.6], [f + 0.25, 'whoosh', 0.35]];
    case 'fridge': return [[w + 0.05, 'door', 0.5], [w + 0.6, 'squeak', 0.4], [f + 0.25, 'whoosh', 0.4]];
    case 'mailbox': return [[w + 0.3, 'pop', 0.6], [f + 0.25, 'whoosh', 0.35]];
    case 'numbers': return [[w + 0.3, 'clang', 0.25], [w + 0.55, 'clang', 0.25], [w + 0.8, 'clang', 0.25], [w + 1.25, 'pop', 0.3], [f + 0.25, 'whoosh', 0.35]];
    case 'porch': return [[w + 0.7, 'clang', 0.6], [f + 0.1, 'ratchet', 0.7], [f + 0.35, 'creak', 0.9], [f + 1.1, 'ratchet', 0.7]];
    case 'qr': return [[w + 0.65, 'beep', 0.7]];
    case 'gutter': return [[w + 0.3, 'creak', 0.7], [f + 0.25, 'whoosh', 0.4]];
    case 'vest': return [[w + 0.4, 'whoosh', 0.3]];
    case 'note': return [[0.1, 'click', 0.2]];
    default: return [];
  }
}

export interface RepoDrive {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  multiplier: number;
  /** Running, no crash, no exit: the checklist advances. */
  live: boolean;
  /** Cues may fire (not a settle, not a muted aftermath). */
  loud: boolean;
  crashAge: number;
}

export function stepRepo(r: Repo, d: RepoDrive, dt: number): void {
  r.events = [];
  for (const e of r.entries) e.age += dt;
  r.shudder += dt;
  if (d.phase === 'running' || d.phase === 'crashed') r.runAge += dt;
  if (d.live) {
    while (r.next < JOBS.length && d.multiplier >= JOBS[r.next]!.at) {
      const j = JOBS[r.next]!;
      r.queue.push(r.next);
      if (j.entry) {
        addEntry(r, j.entry, false, j.open);
        if (d.loud) r.events.push(['click', 0.2]);
      }
      r.next += 1;
    }
    // Behind on the list, Gary works faster; far behind, the oldest job is simply done.
    while (r.queue.length > 5) finishJob(r, r.queue.shift()!, false);
    if (!r.job && r.queue.length > 0 && r.runAge >= ARRIVE_S) {
      const index = r.queue.shift()!;
      r.job = { index, age: 0, time: timing(JOBS[index]!.kind, r.x) };
    }
    if (r.job) {
      const before = r.job.age;
      r.job.age += dt * (1 + 0.3 * r.queue.length);
      if (d.loud) for (const [at, fx, k] of cues(JOBS[r.job.index]!.kind, r.job.time)) if (before < at && r.job.age >= at) r.events.push([fx, k]);
      if (r.job.age >= r.job.time.total) {
        const index = r.job.index;
        r.job = null;
        finishJob(r, index, d.loud);
      }
    }
  }
  if (r.exit) r.exit.age += dt;
  if (r.crash) r.crash.age = d.crashAge / 1000;
  // The pile: a lean every landing kicks, the deck sagging under the load, each item's squash.
  stepSpring(r.lean, 0, 7, 0.22, dt);
  stepSpring(r.sag, sagFor(r), 11, 0.3, dt);
  for (const id of ORDER) stepSpring(r.squash[id], 0, 18, 0.35, dt);
  const act = computeAct(r, d);
  r.walk += Math.abs(act.x - r.x);
  r.x = act.x;
  r.act = act;
}

function finishJob(r: Repo, index: number, loud: boolean): void {
  const j = JOBS[index]!;
  r.done[index] = true;
  const item = SPEC[j.kind].item;
  if (item) {
    r.stacked.push(item);
    const w = ITEMS[item].weight;
    r.squash[item].v = -3.5;
    r.lean.v += (index % 2 === 0 ? 1 : -1) * (14 + 6 * w);
    r.sag.v += 18 + 8 * w;
    if (loud) r.events.push(['thud', 0.35 + 0.08 * w]);
  }
  if (j.kind === 'load') {
    r.sag.v += 40;
    tickEntry(r, JOBS[HOOK]!.entry, loud);
  }
  if (!j.open) tickEntry(r, j.entry, loud);
}

// ─── Gary's act ──────────────────────────────────────────────────────────────────────────────────────────────

const ease = (t: number): number => smoothstep(0, 1, t);
function walkX(a: number, b: number, t: number, d: number): { x: number; moving: number } {
  if (d <= 0) return { x: b, moving: 0 };
  const u = clamp(t / d, 0, 1);
  return { x: mix(a, b, ease(u)), moving: Math.sin(Math.PI * u) > 0.05 ? clamp(6 * u * (1 - u) * 1.2, 0, 1) : 0 };
}
const faceTo = (a: number, b: number, fallback: 1 | -1): 1 | -1 => (Math.abs(b - a) < 1 ? fallback : b > a ? 1 : -1);

function idleAct(t: number): Act {
  return { kind: 'idle', phase: 'idle', u: 0, t, x: IDLE_X, face: 1, moving: 0, item: null, hidden: 0 };
}

function jobAct(r: Repo): Act {
  const job = r.job!;
  const kind = JOBS[job.index]!.kind;
  const s = SPEC[kind];
  const tm = job.time;
  const t = job.age;
  const item = s.item ?? null;
  if (t < tm.out) {
    const w = walkX(tm.from, tm.pick, t, tm.out);
    return { kind, phase: 'out', u: t / tm.out, t, x: w.x, face: faceTo(tm.from, tm.pick, 1), moving: w.moving, item, hidden: 0 };
  }
  const workFace: 1 | -1 = kind === 'gutter' || kind === 'load' || kind === 'lift' || kind === 'hook' ? -1 : 1;
  if (t < tm.out + tm.work) {
    const tt = t - tm.out;
    return { kind, phase: 'work', u: tt / tm.work, t: tt, x: tm.pick, face: workFace, moving: 0, item, hidden: 0 };
  }
  if (t < tm.out + tm.work + tm.back) {
    const tt = t - tm.out - tm.work;
    const w = walkX(tm.pick, IDLE_X, tt, tm.back);
    return { kind, phase: 'back', u: tt / tm.back, t: tt, x: w.x, face: faceTo(tm.pick, IDLE_X, -1), moving: w.moving, item, hidden: 0 };
  }
  const tt = t - tm.out - tm.work - tm.back;
  return { kind, phase: 'finish', u: tm.finish > 0 ? tt / tm.finish : 1, t: tt, x: IDLE_X, face: -1, moving: 0, item, hidden: 0 };
}

function arriveAct(t: number): Act {
  const from = CAB_X + 14;
  const out = walkTime(from, IDLE_X, SPEED);
  const step = clamp((t - 0.15) / 0.45, 0, 1);
  const w = walkX(from, IDLE_X, t - 0.5, out);
  return { kind: 'arrive', phase: 'out', u: clamp(t / ARRIVE_S, 0, 1), t, x: w.x, face: 1, moving: w.moving, item: null, hidden: 1 - ease(step) };
}

/** The exit, in seconds after it: Gary turns to the house, the degen arrives, the hook, the handshake, the referral code, the tailgate. */
export const EXIT = { meet: 3.0, unhook: 3.6, hookOff: 4.0, shake: 4.3, shakeEnd: 5.9, write: 6.2, writeEnd: 8.0, walk: 8.1, sit: 9.0, sat: 9.5 } as const;
function exitAct(r: Repo): Act {
  const e = r.exit!;
  const t = e.age;
  if (t < 1.4) {
    const w = walkX(e.from, IDLE_X, t, Math.max(0.01, walkTime(e.from, IDLE_X, SPEED)));
    return { kind: 'exit', phase: 'turn', u: t / 1.4, t, x: w.x, face: w.moving > 0.05 ? faceTo(e.from, IDLE_X, e.face) : 1, moving: w.moving, item: null, hidden: 0 };
  }
  if (t < EXIT.unhook) return { kind: 'exit', phase: 'listen', u: (t - 1.4) / (EXIT.unhook - 1.4), t: t - 1.4, x: IDLE_X, face: 1, moving: 0, item: null, hidden: 0 };
  if (t < EXIT.shake) return { kind: 'exit', phase: 'unhook', u: (t - EXIT.unhook) / (EXIT.shake - EXIT.unhook), t: t - EXIT.unhook, x: IDLE_X, face: -1, moving: 0, item: null, hidden: 0 };
  if (t < EXIT.shakeEnd) return { kind: 'exit', phase: 'shake', u: (t - EXIT.shake) / (EXIT.shakeEnd - EXIT.shake), t: t - EXIT.shake, x: IDLE_X, face: 1, moving: 0, item: null, hidden: 0 };
  if (t < EXIT.walk) return { kind: 'exit', phase: 'write', u: (t - EXIT.shakeEnd) / (EXIT.walk - EXIT.shakeEnd), t: t - EXIT.shakeEnd, x: IDLE_X, face: 1, moving: 0, item: null, hidden: 0 };
  if (t < EXIT.sit) {
    const w = walkX(IDLE_X, SIT_X, t - EXIT.walk, EXIT.sit - EXIT.walk);
    return { kind: 'exit', phase: 'walk', u: (t - EXIT.walk) / (EXIT.sit - EXIT.walk), t: t - EXIT.walk, x: w.x, face: -1, moving: w.moving, item: null, hidden: 0 };
  }
  return { kind: 'sit', phase: t < EXIT.sat ? 'sitting' : 'sat', u: clamp((t - EXIT.sit) / (EXIT.sat - EXIT.sit), 0, 1), t: t - EXIT.sit, x: SIT_X, face: 1, moving: 0, item: null, hidden: 0 };
}

const CAB_SEAT = 104;
/**
 * The crash is front-loaded so it finishes inside a short live crash hold: Gary stands still for the beacons and
 * the chart going red (0.45 s), walks to the door, pulls it off by about 1.2 s, carries it to the cab, and the
 * truck pulls away by about 3.2 s; the bedroom goes dark by about 4.5 s. Everything is keyed to the crash clock.
 */
export const CRASH_WALK = 0.45;
const PULL_S = 0.4;
function crashTimes(from: number): CrashTimes {
  const arrive = CRASH_WALK + Math.max(0.55, Math.abs(DOOR_X - 22 - from) / 420);
  const pull = Math.max(1.2, arrive + 0.05);
  const atCab = pull + PULL_S + Math.max(0.5, Math.abs(DOOR_X - 22 - (CAB_SEAT + 30)) / 400);
  const stow = atCab + 0.4;
  const drive = stow + 0.2;
  return { arrive, pull, atCab, stow, drive, dark: Math.max(4.4, drive + 1.3) };
}

function crashAct(r: Repo): Act {
  const c = r.crash!;
  const t = c.age;
  const T = c.times;
  const fromCab = c.from <= CAB_X + 15;
  if (t < CRASH_WALK) return { kind: 'crash', phase: 'still', u: t / CRASH_WALK, t, x: c.from, face: c.face, moving: 0, item: null, hidden: fromCab ? 1 : 0 };
  if (t < T.arrive) {
    const tt = t - CRASH_WALK;
    const d = T.arrive - CRASH_WALK;
    const w = walkX(c.from, DOOR_X - 22, tt, d);
    return { kind: 'crash', phase: 'walk', u: tt / d, t: tt, x: w.x, face: faceTo(c.from, DOOR_X, 1), moving: w.moving, item: null, hidden: fromCab ? 1 - ease(clamp(tt / 0.25, 0, 1)) : 0 };
  }
  if (t < T.pull + PULL_S) return { kind: 'crash', phase: 'pull', u: clamp((t - T.pull) / PULL_S, 0, 1), t: t - T.pull, x: DOOR_X - 22, face: 1, moving: 0, item: t >= T.pull + 0.15 ? 'door' : null, hidden: 0 };
  if (t < T.atCab) {
    const tt = t - T.pull - PULL_S;
    const d = T.atCab - T.pull - PULL_S;
    const w = walkX(DOOR_X - 22, CAB_SEAT + 30, tt, d);
    return { kind: 'crash', phase: 'carry', u: tt / d, t: tt, x: w.x, face: -1, moving: w.moving, item: 'door', hidden: 0 };
  }
  if (t < T.stow) {
    // Into the cab: he folds down out of sight behind it while the door goes in ahead of him.
    const s = clamp((t - T.atCab) / (T.stow - T.atCab), 0, 1);
    return { kind: 'crash', phase: 'stow', u: s, t: t - T.atCab, x: mix(CAB_SEAT + 30, CAB_SEAT + 4, ease(s)), face: -1, moving: 0, item: 'door', hidden: smoothstep(0.2, 0.9, s) };
  }
  return { kind: 'cab', phase: 'drive', u: 1, t: t - T.stow, x: CAB_SEAT, face: -1, moving: 0, item: null, hidden: 1 };
}

function computeAct(r: Repo, d: RepoDrive): Act {
  if (d.phase === 'waiting' || d.phase === 'betting') return restAct();
  if (r.crash && !r.crash.dodged) return crashAct(r);
  if (r.exit) return exitAct(r);
  if (r.runAge < ARRIVE_S) return arriveAct(r.runAge);
  if (r.job) return jobAct(r);
  return idleAct(r.runAge);
}

// ─── The supercar, the door, the truck ─────────────────────────────────────────────────────────────────────────

export interface CarState {
  /** The hook's travel from the deck tail to the frame (1 = on). */
  hook: number;
  /** The front up an inch. */
  lift: number;
  /** Winched from the apron (0) onto the deck (1); the deck's tilt while it happens. */
  load: number;
  tilt: number;
  /** The alarm's two chirps (0..1 flash), and its little LED. */
  chirp: number;
  alarm: boolean;
  towed: boolean;
}

const jobProgress = (r: Repo, index: number): { u: number; t: number } | null => {
  if (!r.job || r.job.index !== index) return null;
  const tm = r.job.time;
  return { u: clamp((r.job.age - tm.out) / tm.work, 0, 1), t: r.job.age - tm.out };
};

export function carState(r: Repo): CarState {
  let hook = r.done[HOOK] ? 1 : 0;
  let lift = r.done[LIFT] ? 1 : 0;
  let load = r.done[LOAD] ? 1 : 0;
  let tilt = 0;
  let chirp = 0;
  const h = jobProgress(r, HOOK);
  if (h) hook = smoothstep(0.2, 0.72, h.u);
  const l = jobProgress(r, LIFT);
  if (l) {
    lift = smoothstep(0.15, 0.5, l.u);
    const c = l.t - 0.65;
    chirp = (c > 0 && c < 0.12) || (c > 0.25 && c < 0.37) ? 1 : 0;
  }
  const w = jobProgress(r, LOAD);
  if (w) {
    tilt = smoothstep(0, 0.5, w.t) * (1 - smoothstep(2.5, 3.1, w.t));
    load = smoothstep(0.45, 2.45, w.t);
  }
  if (r.crash && !r.crash.dodged) {
    load = r.crash.loaded ? 1 : 0;
    tilt = 0;
    hook = r.crash.hooked || r.crash.loaded ? 1 : 0;
  }
  if (r.exit) {
    const t = r.exit.age;
    const e = r.exit;
    const off = smoothstep(EXIT.hookOff - 0.1, EXIT.hookOff + 0.3, t);
    hook = (e.hooked ? 1 : 0) * (1 - off);
    lift = e.lifted * (1 - smoothstep(EXIT.hookOff, EXIT.hookOff + 0.5, t));
    load = e.loaded * (1 - smoothstep(4.5, 6.0, t));
    // A deck caught mid-tilt stays down until the car has rolled back off it.
    tilt = Math.max(e.tilted, e.loaded > 0 ? smoothstep(4.1, 4.5, t) : 0) * (1 - smoothstep(6.0, 6.5, t));
    chirp = 0;
  }
  return { hook, lift, load, tilt, chirp, alarm: !r.done[LIFT] && !l, towed: !!r.crash && !r.crash.dodged && r.crash.hooked && !r.crash.loaded };
}

/** How far the truck has pulled away (negative x) at the crash. */
export function truckDX(r: Repo): number {
  if (!r.crash || r.crash.dodged) return 0;
  const t = r.crash.age - r.crash.times.drive;
  return t > 0 ? -0.5 * 320 * t * t : 0;
}
/** The pile leaning back as the truck pulls away: a closed-form step response, so a late entry agrees. */
function driveLean(r: Repo): number {
  if (!r.crash || r.crash.dodged) return 0;
  const t = r.crash.age - r.crash.times.drive;
  return t > 0 ? r.crash.sway * (1 - Math.cos(6 * t) * Math.exp(-1.8 * t)) : 0;
}

/** The three hinge screws: popped at the pull, a closed-form fall onto the porch, seeded from the crash point. */
export function screwViews(r: Repo): { x: number; y: number; rot: number }[] {
  const c = r.crash;
  if (!c || c.dodged || c.age < c.times.pull) return [];
  const t = c.age - c.times.pull;
  return c.screws.map((s, i) => {
    const x0 = 516;
    const y0 = 332 + i * 26;
    const floor = 414 + i * 3;
    // Time to land: y0 + vy t + 450 t² = floor.
    const land = (-s.vy + Math.sqrt(s.vy * s.vy + 4 * 450 * (floor - y0))) / (2 * 450);
    const u = Math.min(t, land);
    return { x: x0 + s.vx * u, y: y0 + s.vy * u + 450 * u * u, rot: s.spin * u };
  });
}

export interface DoorView { state: 'hinged' | 'held' | 'cab'; open: number; x: number; y: number; rot: number }
/** The front door: open for the fridge and the degen, off its hinges at the crash, riding shotgun after. */
export function doorView(r: Repo): DoorView {
  let open = 0;
  const f = jobProgress(r, jobIndex('fridge'));
  if (f) open = smoothstep(0, 0.2, f.u) * (1 - smoothstep(0.85, 1, f.u));
  if (r.exit) open = smoothstep(1.5, 1.65, r.exit.age) * (1 - smoothstep(3.4, 3.9, r.exit.age));
  if (r.crash && !r.crash.dodged) {
    const c = r.crash;
    const T = c.times;
    const t = c.age;
    if (t >= T.pull) {
      const a = r.act;
      if (t < T.atCab) {
        const pull = clamp((t - T.pull) / 0.3, 0, 1);
        const hx = a.x + a.face * 22;
        return { state: 'held', open: 0, x: mix(DOOR_X, hx, ease(pull)), y: mix(361, LANE_Y - 50, ease(pull)), rot: mix(0, -0.12 * a.face, pull) };
      }
      const s = clamp((t - T.atCab) / (T.stow - T.atCab), 0, 1);
      return { state: s < 1 ? 'held' : 'cab', open: 0, x: mix(CAB_SEAT + 8, CAB_SEAT + 30, 1 - ease(s)) + truckDX(r), y: mix(LANE_Y - 50, 424, ease(s)), rot: 0 };
    }
  }
  return { state: 'hinged', open, x: DOOR_X, y: 361, rot: 0 };
}

// ─── Items ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface ItemView { id: ItemId; x: number; y: number; rot: number; squash: number; layer: 'held' | 'air' | 'stack' | 'ground'; count: number }
export interface Items { views: ItemView[]; home: Record<ItemId, boolean>; numbersLeft: number; tvDark: boolean; tvPull: number; fridgeGone: boolean; bow: number; postit: boolean }

/** Where a carried item rides relative to Gary. */
function carry(id: ItemId, x: number, face: number): Pose {
  switch (id) {
    case 'hose': return { x: x - face * 2, y: LANE_Y - 100, rot: 0.25 * face };
    case 'tv': return { x: x + face * 26, y: LANE_Y - 84, rot: 0 };
    case 'bike': return { x: x + face * 42, y: LANE_Y - 23, rot: 0 };
    case 'fridge': return { x: x + face * 30, y: LANE_Y - 46, rot: -0.2 * face };
    case 'mailbox': return { x: x + face * 16, y: LANE_Y - 74, rot: 0.1 * face };
    case 'numbers': return { x: x + face * 24, y: LANE_Y - 78, rot: 0 };
    case 'porch': return { x: x + face * 40, y: LANE_Y - 30, rot: 0 };
    case 'gutter': return { x: x - face * 60, y: LANE_Y - 110, rot: 0.03 * face };
  }
}

/** A thrown arc from `a` to `b`: up to `lift` above the higher end. */
function arc(a: Pose, b: Pose, u: number, lift: number, spin = 0): Pose {
  const k = ease(u);
  const apex = Math.min(a.y, b.y) - lift;
  const x = mix(a.x, b.x, k);
  const y = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * apex + k * k * b.y;
  return { x, y, rot: mix(a.rot, b.rot, k) + Math.sin(Math.PI * k) * spin };
}

function stackPose(r: Repo, id: ItemId, dx: number, lean: number): Pose {
  const s = SLOTS[id];
  const height = DECK_Y - s.y;
  return { x: s.x + dx + (r.lean.x + lean) * height / 100, y: s.y + r.sag.x * 0.6, rot: s.rot + (r.lean.x + lean) * 0.003 };
}

/** Every item's pose this frame: at home (drawn by the house), held, in the air, on the pile or dropped on the lawn. */
export function items(r: Repo): Items {
  const out: Items = { views: [], home: { hose: true, tv: true, bike: true, fridge: true, mailbox: true, numbers: true, porch: true, gutter: true }, numbersLeft: 3, tvDark: false, tvPull: 0, fridgeGone: false, bow: 0, postit: false };
  const dx = truckDX(r);
  const lean = driveLean(r);
  const squash = (id: ItemId): number => r.squash[id].x;
  const exit = r.exit;
  for (const id of r.stacked) {
    out.home[id] = false;
    if (id === 'numbers') out.numbersLeft = 0;
    if (id === 'tv') out.tvDark = true;
    if (id === 'fridge') out.fridgeGone = true;
    if (id === 'bike') out.bow = 1;
    if (exit) continue;
    const p = stackPose(r, id, dx, lean);
    out.views.push({ id, ...p, squash: squash(id), layer: 'stack', count: 3 });
  }
  if (r.done[jobIndex('numbers')]) out.postit = true;
  if (exit) {
    // Everything flies home, staggered, then the house has it all back.
    for (const ret of exit.returning) {
      const u = clamp((exit.age - ret.start) / 0.8, 0, 1);
      if (u >= 1) {
        out.home[ret.id] = true;
        continue;
      }
      out.home[ret.id] = false;
      const p = u <= 0 ? ret.from : arc(ret.from, ITEMS[ret.id].home, u, 70, ret.id === 'gutter' ? 0 : 0.6);
      out.views.push({ id: ret.id, ...p, squash: 0, layer: u <= 0 ? 'stack' : 'air', count: 3 });
      if (ret.id === 'numbers') out.numbersLeft = 0;
      if (ret.id === 'tv') out.tvDark = true;
      if (ret.id === 'fridge') out.fridgeGone = true;
    }
    for (const id of ORDER) if (out.home[id]) {
      if (id === 'numbers') out.numbersLeft = 3;
      if (id === 'fridge') out.fridgeGone = false;
    }
    out.bow = out.home.bike && exit.returning.some((x) => x.id === 'bike') ? 1 : out.bow;
    return out;
  }
  if (r.crash && !r.crash.dodged && r.crash.dropped) {
    const id = r.crash.dropped;
    out.home[id] = false;
    out.views.push({ id, x: r.crash.dropX, y: LANE_Y - ITEMS[id].h / 2 + 2, rot: 0, squash: 0, layer: 'ground', count: 3 });
    if (id === 'numbers') out.numbersLeft = 0;
    if (id === 'tv') out.tvDark = true;
    if (id === 'fridge') out.fridgeGone = true;
    if (id === 'bike') out.bow = 1;
  }
  const job = r.job;
  if (job && !r.crash) {
    const kind = JOBS[job.index]!.kind;
    const a = r.act;
    const id = SPEC[kind].item;
    if (id) {
      const v = jobItem(r, id, a);
      if (v) {
        out.home[id] = false;
        out.views.push(v);
      }
      if (id === 'numbers' && a.phase === 'work') out.numbersLeft = 3 - Math.min(3, Math.floor(clamp((a.u - 0.1) / 0.16, 0, 3)));
      else if (id === 'numbers') out.numbersLeft = a.phase === 'out' ? 3 : 0;
      if (id === 'numbers' && (a.phase !== 'out' && (a.phase !== 'work' || a.u > 0.75))) out.postit = true;
      if (id === 'tv') {
        out.tvDark = a.phase !== 'out' && (a.phase !== 'work' || a.u > 0.22);
        out.tvPull = a.phase === 'work' ? smoothstep(0.32, 0.42, a.u) * (1 - smoothstep(0.42, 0.55, a.u)) : 0;
      }
      if (id === 'fridge') out.fridgeGone = a.phase !== 'out';
      if (id === 'bike') out.bow = a.phase === 'out' ? 0 : a.phase === 'work' ? smoothstep(0.5, 0.62, a.u) : 1;
    }
  }
  return out;
}

function jobItem(r: Repo, id: ItemId, a: Act): ItemView | null {
  const home = ITEMS[id].home;
  const view = (p: Pose, layer: ItemView['layer'], count = 3): ItemView => ({ id, ...p, squash: 0, layer, count });
  if (a.phase === 'out') return null;
  if (a.phase === 'work') {
    const hold = carry(id, a.x, a.face);
    switch (id) {
      case 'hose': return view(lerpPose(home, hold, smoothstep(0.2, 0.95, a.u)), 'held');
      case 'tv': return a.u < 0.42 ? null : view(arc({ ...home, x: home.x + 3 }, hold, smoothstep(0.42, 0.95, a.u), 18), 'held');
      case 'bike': return a.u < 0.66 ? null : view(lerpPose(home, hold, smoothstep(0.66, 1, a.u)), 'held');
      case 'fridge': return a.u < 0.22 ? view({ x: DOOR_X + 6, y: 364, rot: 0 }, 'ground') : view(lerpPose({ x: DOOR_X + 6, y: 364, rot: 0 }, hold, smoothstep(0.22, 0.85, a.u)), 'held');
      case 'mailbox': return a.u < 0.3 ? null : view(arc(home, hold, smoothstep(0.3, 0.9, a.u), 10), 'held');
      case 'numbers': return a.u < 0.26 ? null : view(hold, 'held', Math.min(3, Math.floor(clamp((a.u - 0.1) / 0.16, 0, 3))));
      case 'porch': return null;
      case 'gutter': return a.u < 0.25 ? null : view(lerpPose(home, hold, smoothstep(0.25, 0.9, a.u)), 'held');
    }
  }
  const hold = carry(id, a.x, a.face);
  if (a.phase === 'back') return id === 'porch' ? null : view(hold, 'held');
  // The finish: a heave and a toss onto the pile, or the winch dragging the porch across the lawn and up.
  const slot = stackPose(r, id, 0, 0);
  if (id === 'porch') {
    const u = clamp(a.t / WINCH_S, 0, 1);
    const mid: Pose = { x: 420, y: 458, rot: -0.05 };
    if (u < 0.55) return view(lerpPose(home, mid, smoothstep(0, 0.55, u)), 'air');
    return view(arc(mid, slot, smoothstep(0.55, 1, u), 40), 'air');
  }
  const up: Pose = { x: a.x - 6, y: LANE_Y - 150, rot: hold.rot * 0.5 };
  if (a.t < 0.25) return view(lerpPose(hold, up, ease(a.t / 0.25)), 'held');
  return view(arc(up, slot, clamp((a.t - 0.25) / 0.5, 0, 1), 46, id === 'gutter' ? 0 : -0.7), 'air');
}
const lerpPose = (a: Pose, b: Pose, u: number): Pose => ({ x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), rot: mix(a.rot, b.rot, u) });

// ─── The exit and the crash ─────────────────────────────────────────────────────────────────────────────────

/** The accepted exit: Gary drops the list, the hook comes off, everything flies home. `live` plays it from the top. */
export function exitRepo(r: Repo, live: boolean): void {
  const now = items(r);
  const car = carState(r);
  const returning: Returning[] = [];
  // Whatever is in Gary's hands goes back first, then the pile from the top down.
  const loose = now.views.filter((v) => v.layer !== 'stack');
  for (const v of loose) returning.push({ id: v.id, from: { x: v.x, y: v.y, rot: v.rot }, start: 0.5 });
  const pile = now.views.filter((v) => v.layer === 'stack').reverse();
  pile.forEach((v, k) => returning.push({ id: v.id, from: { x: v.x, y: v.y, rot: v.rot }, start: 4.5 + k * 0.32 }));
  r.exit = { age: live ? 0 : 99, from: r.x, face: r.act.face, loaded: car.load, tilted: car.tilt, hooked: car.hook > 0.5, lifted: car.lift, returning };
  r.job = null;
  r.queue = [];
  if (!live) {
    r.x = SIT_X;
    r.act = exitAct(r);
  }
}

/** The crash: the beacons, then Gary takes the front door. A dodged crash keeps Gary on the tailgate. */
export function crashRepo(r: Repo, x100: number, dodged: boolean, crashAge: number): void {
  const rand = mulberry32(x100 * 7 + 11);
  let dropped: ItemId | null = null;
  let loaded = r.done[LOAD];
  const hooked = r.done[HOOK] || (r.job?.index === HOOK && (r.job.age - r.job.time.out) / r.job.time.work > 0.5);
  if (!dodged && r.job) {
    // Whatever was mid-air lands; whatever was in Gary's hands goes down on the lawn where he stands.
    const kind = JOBS[r.job.index]!.kind;
    const id = SPEC[kind].item;
    const a = r.act;
    if (kind === 'load') loaded = carState(r).load > 0.5;
    if (id) {
      if (a.phase === 'finish') {
        r.stacked.push(id);
        r.done[r.job.index] = true;
      } else if (a.phase === 'back' || (a.phase === 'work' && jobItem(r, id, a) !== null)) dropped = id;
    }
    r.job = null;
  }
  r.queue = [];
  const from = r.x;
  r.crash = {
    age: crashAge, from, face: r.act.face, dodged, dropped, dropX: clamp(from + r.act.face * 28, 200, 760), loaded, hooked: hooked || loaded,
    times: crashTimes(from),
    // The hinge screws that pop out when the door comes off, and how hard the pile sways as he pulls away.
    screws: [0, 1, 2].map(() => ({ vx: -90 + rand() * 130, vy: -170 + rand() * 90, spin: (rand() - 0.5) * 30 })),
    sway: 8 + rand() * 5,
  };
}

export interface DegenOut { x: number; y: number; face: 1 | -1; run: number; walk: number; mode: 'door' | 'run' | 'stand' | 'shake'; t: number; scale: number }
/** The degen outside after the exit: out of the door at 1.6 s, across the lawn in his socks, then beside Gary. */
export function degenOut(r: Repo): DegenOut | null {
  const e = r.exit;
  if (!e || e.age < 1.62) return null;
  const t = e.age;
  const meetX = IDLE_X + 70;
  const from = { x: DOOR_X + 4, y: 418 };
  const to = { x: meetX, y: LANE_Y };
  const u = clamp((t - 1.62) / (EXIT.meet - 1.62), 0, 1);
  const k = smoothstep(0, 1, u) * 0.4 + u * 0.6;
  const x = mix(from.x, to.x, k);
  const y = mix(from.y, to.y, k);
  const scale = mix(0.86, 1, clamp((y - 404) / (LANE_Y - 404), 0, 1));
  const dist = Math.hypot(to.x - from.x, to.y - from.y) * k;
  const mode = u < 1 ? (t < 1.8 ? 'door' : 'run') : t >= EXIT.shake && t < EXIT.shakeEnd ? 'shake' : 'stand';
  return { x, y, face: u < 1 ? -1 : -1, run: u < 1 ? 1 : 0, walk: dist, mode, t, scale };
}

/** Kicks the house into a shudder on its slab (the structure at 60×, and every overtime item). */
export function shudderHouse(r: Repo, amp: number): void {
  r.shudder = 0;
  r.shudderAmp = amp;
}
export const houseShake = (r: Repo): number => (r.shudder < 3 ? r.shudderAmp * Math.sin(r.shudder * 34) * Math.exp(-r.shudder * 2.6) : 0);
