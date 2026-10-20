/**
 * The city as a shooting course: the ride's distance and speed from the displayed multiplier, Flock
 * cameras laid ahead from this round's local seed, the gun (a magazine, a reload, a point-and-click hit
 * test), the cameras that read him when they pass unshot, and the aimbot that shoots until the player
 * does. Nothing here reads a stake, a payout or the crash point, and nothing here can end the ride: a
 * camera that reads him costs a streak and some dignity, never the round. Only the backend's crash puts
 * the police on him (cops.ts draws that).
 *
 * Coordinates: x runs along the road in px, with the rider's bottom bracket at `world.distance`; on screen
 * the rider stays at RIDER_X and the city scrolls past. Cameras have a fixed screen height. The reticle
 * lives in the 960 × 540 canvas space, where the hit test happens.
 */
export type CamKind = 'pole' | 'lamp' | 'signal' | 'ring' | 'speed' | 'trailer' | 'bird';
export type CamState = 'live' | 'dead' | 'read';

export interface Cam {
  id: number;
  kind: CamKind;
  seg: number;
  /** Where it stands along the road; a bird's x is where it was at `t0`, flying at `vx` since. */
  x: number;
  /** The height of the lens on screen. */
  y: number;
  /** The hit radius around the lens. */
  r: number;
  hp: number;
  hits: number;
  state: CamState;
  /** Seconds since it resolved. */
  age: number;
  variant: number;
  vx: number;
  t0: number;
  /** The aimbot's free trial aims wide of this one. */
  lazy: boolean;
}

/** A bullet hole where a shot missed, in world px. */
export interface Hole { x: number; y: number; age: number }

export interface World {
  seed: number;
  time: number;
  /** The bottom bracket, px along the road. */
  distance: number;
  speed: number;
  /** The next segment to lay. */
  seg: number;
  cams: Cam[];
  holes: Hole[];
  /** The reticle, canvas px. */
  aim: { x: number; y: number };
  ammo: number;
  /** Seconds of reload left, and until the next shot may fire. */
  reloading: number;
  cooldown: number;
  /** Seconds the cruisers lunge closer after a camera reads him. Presentation only. */
  alert: number;
  deflocked: number;
  seen: number;
  shots: number;
  landed: number;
  streak: number;
  best: number;
  birds: number;
  /** The aimbot: its target, the seconds until it looks again, how long it has had this target and how often it has fired at it. */
  bot: { target: number | null; replan: number; sinceTarget: number; fired: number };
}

/** What the round's multiplier lends the ride: speed in px/s, heat = 1 − 1/x, deep = log10(x) / 3. Never an outcome. */
export interface Drive { speed: number; heat: number; deep: number; x: number }
/** The gun this frame: a pointer position to aim at, held aim keys, shots asked for and a reload, and whether the player has the gun. */
export interface Trigger { aim: { x: number; y: number } | null; move: { x: number; y: number }; fire: number; reload: boolean; manual: boolean }

export type EventType = 'shot' | 'hit' | 'miss' | 'read' | 'reload' | 'empty' | 'bird';
export interface CityEvent {
  type: EventType;
  id: number;
  kind?: CamKind;
  /** Where on the canvas. */
  x: number;
  y: number;
  /** Hits: whether that was the last of it, and whether it was about to pass. */
  killed?: boolean;
  close?: boolean;
}

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const smooth = (n: number): number => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };

/** Where the rider's bottom bracket sits on screen, and the road under the wheels. */
export const RIDER_X = 300;
export const GROUND = 452;
/** Poles stand on the sidewalk behind the road. */
export const SIDEWALK = 438;
/** The city is laid in segments of this many px; each lays a lot, maybe a camera, maybe a pothole. */
export const SEG = 300;
const FIRST = 520;
const AHEAD = 1500;
const BEHIND = 700;
export const MAG = 8;
export const RELOAD_S = 0.9;
const RATE_S = 0.13;
/** Keys move the reticle this fast, px/s. */
const KEY_SPEED = 560;
export const BASE_SPEED = 190;
export const TOP_SPEED = 350;
/** The push-off from the kerb takes this long. */
const PUSH_S = 1;
const REST: Drive = { speed: 0, heat: 0, deep: 0, x: 1 };
/** The lens height and hit radius of each kind of camera. */
export const HEAD: Readonly<Record<CamKind, { y: number; r: number; hp: number }>> = {
  pole: { y: 298, r: 17, hp: 1 },
  lamp: { y: 232, r: 16, hp: 1 },
  signal: { y: 262, r: 16, hp: 1 },
  ring: { y: 394, r: 11, hp: 1 },
  speed: { y: 338, r: 19, hp: 1 },
  trailer: { y: 318, r: 27, hp: 3 },
  bird: { y: 215, r: 14, hp: 1 },
};
/** A pothole this far ahead of the wheels starts the bunny hop, which lasts this many px. */
export const HOP_LEAD = 70;
export const HOP_LEN = 150;
export const HOP_HEIGHT = 34;

/** Hash only the segment and this round's local seed; never read a backend seed or a future result. */
export function noise(n: number, seed = 0): number {
  let x = Math.imul((n + Math.imul(seed, 0x9e3779b1)) ^ 0x45d9f3b, 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Riding speed for a multiplier: 190 px/s at 1×, 270 at 2×, 316 at 3×, capped at 350 from about 4×. */
export const rideSpeed = (x: number): number => Math.min(TOP_SPEED, BASE_SPEED * (1 + 0.42 * Math.log2(Math.max(1, x))));

/** The drive at a multiplier and round time, with the push-off from the kerb. */
export function driveAt(x100: number, elapsed: number): Drive {
  const x = Math.max(1, x100 / 100);
  return { speed: rideSpeed(x) * smooth(elapsed / (PUSH_S * 1000)), heat: 1 - 1 / x, deep: clamp(Math.log10(x) / 3, 0, 1), x };
}

/** Distance after `seconds` on the shared 10×-per-30 s curve: 190T + kT² until the cap, less the push-off. */
export function rideDistance(seconds: number): number {
  const t = Math.max(0, seconds);
  const k = BASE_SPEED * 0.42 * Math.log2(10) / 30;
  const cap = (TOP_SPEED - BASE_SPEED) / k;
  const a = Math.min(t, cap);
  const u = Math.min(1, t / PUSH_S);
  return BASE_SPEED * a + k * a * a / 2 + TOP_SPEED * Math.max(0, t - cap) - BASE_SPEED * PUSH_S * (u - u * u * u + u * u * u * u / 2);
}

/** Where a camera is on screen now; birds keep flying. */
export function camScreen(c: Cam, world: World): { x: number; y: number } {
  if (c.kind === 'bird') {
    const t = world.time - c.t0;
    return { x: RIDER_X + c.x + c.vx * t - world.distance, y: c.y + Math.sin(t * 5 + c.variant * 9) * 9 };
  }
  return { x: RIDER_X + c.x - world.distance, y: c.y };
}

// ---- The scenery, a pure function of the segment --------------------------------------------------------------

export type LotStyle = 'strip' | 'house' | 'warehouse' | 'church' | 'gas' | 'lot' | 'bank';
export interface Lot {
  seg: number;
  x: number;
  style: LotStyle;
  /** Which sign the storefront wears, which billboard copy, which street item stands at the kerb. */
  sign: number;
  billboard: number;
  item: number;
  /** A pothole in the road at this x, or none. */
  pothole: number | null;
  variant: number;
}

export function lotFor(seg: number, seed: number): Lot {
  const n = (k: number) => noise(seg * 32 + k, seed);
  const styles: LotStyle[] = ['strip', 'house', 'warehouse', 'church', 'gas', 'lot', 'bank', 'strip', 'house', 'strip'];
  const x = FIRST + seg * SEG - 360;
  return {
    seg, x, style: seg < 0 ? 'lot' : styles[Math.floor(n(9) * styles.length)]!,
    sign: Math.floor(n(10) * 1000), billboard: seg % 5 === 2 ? Math.floor(n(11) * 1000) : -1, item: Math.floor(n(12) * 9),
    pothole: seg >= 1 && n(20) < 0.42 ? x + 70 + 160 * n(21) : null, variant: n(13),
  };
}

/** The bunny hop over a pothole, a pure function of distance: 0 on the ground, up to HOP_HEIGHT px in the air. */
export function hopAt(distance: number, seed: number): { h: number; u: number } {
  const seg = Math.floor((distance - FIRST + 360) / SEG);
  for (let s = seg - 1; s <= seg + 1; s++) {
    const lot = lotFor(s, seed);
    if (lot.pothole === null) continue;
    const u = (distance - (lot.pothole - HOP_LEAD)) / HOP_LEN;
    if (u > 0 && u < 1) return { h: 4 * HOP_HEIGHT * u * (1 - u), u };
  }
  return { h: 0, u: 0 };
}

export function createWorld(elapsed = 0, seed = 0, drive: Drive = REST): World {
  const distance = rideDistance(elapsed / 1000);
  const world: World = {
    seed, time: elapsed / 1000, distance, speed: drive.speed,
    seg: Math.max(0, Math.floor((distance - FIRST + 360) / SEG) - 1),
    cams: [], holes: [], aim: { x: 600, y: 300 }, ammo: MAG, reloading: 0, cooldown: 0, alert: 0,
    deflocked: 0, seen: 0, shots: 0, landed: 0, streak: 0, best: 0, birds: 0,
    bot: { target: null, replan: 0, sinceTarget: 0, fired: 0 },
  };
  lay(world, drive);
  // A late arrival never finds a camera reading him at the kerb, and hears no cue for what already passed.
  for (const c of world.cams) if (camScreen(c, world).x < RIDER_X + 40) { c.state = 'read'; c.age = 9; }
  return world;
}

type Weighted = readonly [CamKind, number];
/** What the city mounts at a multiplier: poles from the start, lamps from 1.15×, rings from 1.3×, signal arms from 1.5×, speed cameras from 1.8×. */
function mounts(x: number, seg: number): Weighted[] {
  if (seg < 2) return [['pole', 1]];
  const kinds: Weighted[] = [['pole', 4]];
  if (x >= 1.15) kinds.push(['lamp', 3]);
  if (x >= 1.3) kinds.push(['ring', 2]);
  if (x >= 1.5) kinds.push(['signal', 2]);
  if (x >= 1.8) kinds.push(['speed', 2]);
  return kinds;
}

function choose(kinds: Weighted[], r: number): CamKind {
  const total = kinds.reduce((sum, [, w]) => sum + w, 0);
  let at = r * total;
  for (const [kind, w] of kinds) { if (at < w) return kind; at -= w; }
  return kinds[kinds.length - 1]![0];
}

function lay(world: World, drive: Drive): void {
  while (FIRST + world.seg * SEG < world.distance + AHEAD) laySegment(world, drive);
}

function laySegment(world: World, drive: Drive): void {
  const s = world.seg++;
  const n = (k: number) => noise(s * 32 + k, world.seed);
  const base = FIRST + s * SEG;
  const x = Math.max(1, drive.x);
  // Half of all rounds end before 2×, so the first segments always carry a camera and the pairs come after.
  let count: number;
  if (s < 2) count = 1;
  else if (x < 1.3) count = n(1) < 0.78 ? 1 : 0;
  else if (x < 2) count = n(1) < 0.85 ? 1 : 0;
  else if (x < 4) count = n(1) < 0.3 ? 2 : 1;
  else count = n(1) < 0.5 ? 2 : 1;
  const trailer = x >= 2.5 && s % 7 === 4;
  if (trailer) count = 1;
  for (let i = 0; i < count; i++) {
    const kind: CamKind = trailer ? 'trailer' : choose(mounts(x, s), n(2 + i));
    const head = HEAD[kind];
    const id = s * 8 + i;
    world.cams.push({
      id, kind, seg: s, x: base + (count === 1 ? 40 + n(4) * 140 : i * 150 + n(4 + i) * 40), y: head.y, r: head.r, hp: head.hp, hits: 0,
      state: 'live', age: 0, variant: n(6 + i), vx: 0, t0: 0,
      // The aimbot looks at its phone for about one camera in seven, after the first few.
      lazy: s >= 3 && noise(id * 7 + 3, world.seed ^ 0x5bd1e995) < 0.14,
    });
  }
  // A government pigeon now and then from 1.2×, flying in against the ride and over the rooftops.
  if (x >= 1.2 && s >= 3 && n(7) < 0.18) {
    world.cams.push({
      id: s * 8 + 7, kind: 'bird', seg: s, x: base + 200, y: HEAD.bird.y + (n(8) - 0.5) * 70, r: HEAD.bird.r, hp: 1, hits: 0,
      state: 'live', age: 0, variant: n(9), vx: -(40 + 60 * n(8)), t0: world.time, lazy: n(10) < 0.5,
    });
  }
  world.cams = world.cams.slice(-60);
}

/** The aimbot: the soonest camera to pass that is still ahead of the muzzle, or the phone when there is none. */
function aimbot(world: World, dt: number, muzzle: { x: number; y: number }): { fire: boolean } {
  const bot = world.bot;
  bot.replan -= dt;
  bot.sinceTarget += dt;
  if (bot.replan <= 0) {
    bot.replan = 0.08;
    let best: Cam | null = null;
    let bestX = Infinity;
    for (const c of world.cams) {
      if (c.state !== 'live') continue;
      const p = camScreen(c, world);
      if (p.x < muzzle.x + 34 || p.x > 935 || p.y < 10) continue;
      if (p.x < bestX) { best = c; bestX = p.x; }
    }
    if (best && best.id !== bot.target) { bot.sinceTarget = 0; bot.fired = 0; }
    bot.target = best ? best.id : null;
  }
  const target = bot.target === null ? null : world.cams.find(c => c.id === bot.target && c.state === 'live') ?? null;
  let want = { x: 620, y: 290 };
  if (target) {
    const p = camScreen(target, world);
    // The free trial aims wide of the lazy ones and takes a moment to react to a new target.
    want = target.lazy ? { x: p.x + 46, y: p.y - 40 } : p;
    if (bot.sinceTarget < 0.18) want = { x: world.aim.x, y: world.aim.y };
  }
  const rate = target ? 1300 : 420;
  const dx = want.x - world.aim.x, dy = want.y - world.aim.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.min(dist, rate * dt);
  if (dist > 0) { world.aim.x += dx / dist * step; world.aim.y += dy / dist * step; }
  if (!target) return { fire: false };
  const p = camScreen(target, world);
  const off = Math.hypot(world.aim.x - p.x, world.aim.y - p.y);
  // Two wide shots at a lazy one, then it is left to read him.
  return { fire: off < (target.lazy ? 80 : 9) && dist < 12 && world.ammo > 0 && world.reloading <= 0 && (!target.lazy || bot.fired < 2) };
}

/** The first live camera within reach of the reticle, nearest the reticle. */
export function targetAt(world: World, aim: { x: number; y: number }): Cam | null {
  let best: Cam | null = null;
  let bestD = Infinity;
  for (const c of world.cams) {
    if (c.state !== 'live') continue;
    const p = camScreen(c, world);
    const d = Math.hypot(aim.x - p.x, aim.y - p.y);
    if (d < c.r + 7 && d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function shoot(world: World, events: CityEvent[], muzzle: { x: number; y: number }): void {
  world.ammo--;
  world.shots++;
  world.cooldown = RATE_S;
  const aim = world.aim;
  events.push({ type: 'shot', id: world.shots, x: muzzle.x, y: muzzle.y });
  const c = targetAt(world, aim);
  if (c) {
    const p = camScreen(c, world);
    c.hp--;
    c.hits++;
    world.landed++;
    const killed = c.hp <= 0;
    if (killed) {
      c.state = 'dead';
      c.age = 0;
      if (c.kind === 'bird') world.birds++;
      else {
        world.deflocked++;
        world.streak++;
        world.best = Math.max(world.best, world.streak);
      }
      events.push({ type: c.kind === 'bird' ? 'bird' : 'hit', id: c.id, kind: c.kind, x: p.x, y: p.y, killed, close: p.x < RIDER_X + 90 });
    } else events.push({ type: 'hit', id: c.id, kind: c.kind, x: p.x, y: p.y, killed: false });
  } else {
    world.holes.push({ x: aim.x - RIDER_X + world.distance, y: aim.y, age: 0 });
    world.holes = world.holes.slice(-24);
    events.push({ type: 'miss', id: world.shots, x: aim.x, y: aim.y });
  }
  if (world.ammo <= 0) {
    world.reloading = RELOAD_S;
    events.push({ type: 'reload', id: world.shots, x: muzzle.x, y: muzzle.y });
  }
}

export function stepWorld(world: World, dt: number, trigger: Trigger, drive: Drive = REST, muzzle: { x: number; y: number } = { x: RIDER_X + 30, y: GROUND - 110 }): CityEvent[] {
  const events: CityEvent[] = [];
  dt = clamp(dt, 0, 0.05);
  if (dt <= 0) return events;
  world.time += dt;
  world.cooldown = Math.max(0, world.cooldown - dt);
  world.alert = Math.max(0, world.alert - dt);
  if (world.reloading > 0) {
    world.reloading -= dt;
    if (world.reloading <= 0) { world.reloading = 0; world.ammo = MAG; }
  }

  // The ride: the game owns the travel. Speed eases toward the drive.
  world.speed += (drive.speed - world.speed) * (1 - Math.exp(-2.4 * dt));
  world.distance += world.speed * dt;
  lay(world, drive);

  // The gun: the player's pointer and keys, or the aimbot until the player takes it.
  let fire = 0;
  if (trigger.manual) {
    if (trigger.aim) { world.aim.x = trigger.aim.x; world.aim.y = trigger.aim.y; }
    world.aim.x += trigger.move.x * KEY_SPEED * dt;
    world.aim.y += trigger.move.y * KEY_SPEED * dt;
    fire = trigger.fire;
    if (trigger.reload && world.ammo < MAG && world.reloading <= 0) {
      world.reloading = RELOAD_S;
      events.push({ type: 'reload', id: world.shots, x: muzzle.x, y: muzzle.y });
    }
  } else fire = aimbot(world, dt, muzzle).fire ? 1 : 0;
  world.aim.x = clamp(world.aim.x, 8, 952);
  world.aim.y = clamp(world.aim.y, 8, 532);
  for (let i = 0; i < Math.min(fire, 2); i++) {
    if (world.reloading > 0) { if (i === 0) events.push({ type: 'empty', id: world.shots, x: muzzle.x, y: muzzle.y }); break; }
    if (world.cooldown > 0) break;
    if (world.ammo <= 0) { world.reloading = RELOAD_S; events.push({ type: 'empty', id: world.shots, x: muzzle.x, y: muzzle.y }); break; }
    shoot(world, events, muzzle);
    if (!trigger.manual) world.bot.fired++;
  }

  // Cameras that pass unshot read him; birds just fly on.
  for (const c of world.cams) {
    if (c.state !== 'live') { c.age += dt; continue; }
    const p = camScreen(c, world);
    if (c.kind === 'bird') continue;
    if (p.x < RIDER_X - 36) {
      c.state = 'read';
      c.age = 0;
      world.seen++;
      world.streak = 0;
      world.alert = 1.4;
      events.push({ type: 'read', id: c.id, kind: c.kind, x: p.x, y: p.y });
    }
  }
  for (const h of world.holes) h.age += dt;
  const behind = world.distance - BEHIND;
  world.cams = world.cams.filter(c => (c.kind === 'bird' ? camScreen(c, world).x > -60 && (c.state === 'live' || c.age < 2) : c.x > behind)).slice(-60);
  world.holes = world.holes.filter(h => h.x > behind && h.age < 20).slice(-24);
  return events;
}
