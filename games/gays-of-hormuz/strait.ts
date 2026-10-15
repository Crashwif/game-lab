/**
 * The Strait of Hormuz as a dodging course: the helm, hazards laid in rows from this round's local seed and
 * the displayed multiplier, collisions, rescues and the first mate's autopilot. Nothing here reads a stake,
 * a payout or the crash point, and nothing here can sink the ship: a hit costs guests, speed and dignity,
 * never the round. Only the backend's crash sinks the SS Sashay (ship.ts draws that).
 *
 * Coordinates: x runs east along the strait in px at zoom 1, with the ship's midship at `world.distance`;
 * depth runs from 0 (the far lane, Iran's side) to 1 (the near lane, Oman's side). Every hazard in a row
 * meets the hull at the same distance, the row's contact, so the rows are independent: the helm only has
 * to be somewhere clear when a row arrives, and can move freely between rows.
 */
export type HazardKind = 'mine' | 'missile' | 'drone' | 'boat';
export type PickupKind = 'guest' | 'disco';
export type Resolution = 'live' | 'hit' | 'miss' | 'blocked';

export interface Hazard {
  id: number;
  kind: HazardKind;
  row: number;
  /** The ship's distance when this hazard meets the hull. */
  contact: number;
  /** Mines: where they float. Missiles and drones: where they land. Boats: where they meet the bow. */
  x: number;
  /** Current depth: missiles take aim at launch, homing drones and boats follow the ship until they commit. */
  d: number;
  home: number;
  /** Missiles and drones: the strike point along the hull, px from midship. */
  at: number;
  /** Missiles and drones: how far before contact they launch. Boats: their speed as a share of the ship's. */
  lead: number;
  homing: boolean;
  state: Resolution;
  /** Seconds since it resolved. */
  age: number;
  variant: number;
  /** One-shot flags: the launch or arrival cue, the lock-on warning, and a hazard the first mate misses. */
  announced: boolean;
  warned: boolean;
  ignored: boolean;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  contact: number;
  x: number;
  d: number;
  /** Guests aboard the floatie. */
  count: number;
  variant: number;
  taken: boolean;
  missed: boolean;
  age: number;
}

/** A guest knocked off by a hit: they bob on a floatie where they landed while the ship sails on. */
export interface Overboard { x: number; d: number; age: number; variant: number }
/** A scorch mark on the hull, in hull px from midship. */
export interface Scar { local: number; y: number; age: number }

export interface World {
  seed: number;
  time: number;
  /** Midship, px along the strait. */
  distance: number;
  speed: number;
  depth: number;
  /** Depth units a second. */
  lateral: number;
  /** The next row to lay. */
  row: number;
  hazards: Hazard[];
  pickups: Pickup[];
  overboard: Overboard[];
  scars: Scar[];
  /** Seconds of disco shield left, and of the hit's slowdown. */
  shield: number;
  shaken: number;
  guests: number;
  rescued: number;
  lost: number;
  dodged: number;
  hits: number;
  close: number;
  /** The first mate's chosen depth and the seconds until they look again. */
  aim: number;
  replan: number;
}

/** What the round's multiplier lends the voyage: speed in px/s, heat = 1 − 1/x, deep = log10(x) / 3. Never an outcome. */
export interface Drive { speed: number; heat: number; deep: number; x: number }
/** The helm this frame: held keys or buttons (−1 port, toward Iran; +1 starboard, toward Oman), or a dragged depth. */
export interface Helm { steer: number; target: number | null; manual: boolean }

export type EventType = 'launch' | 'arrive' | 'warn' | 'hit' | 'block' | 'miss' | 'close' | 'rescue' | 'disco';
export interface StraitEvent {
  type: EventType;
  id: number;
  kind?: HazardKind;
  /** Where it happened: px along the strait and depth. */
  x: number;
  d: number;
  /** Hits: guests knocked overboard, and the strike point along the hull. */
  lost?: number;
  local?: number;
  count?: number;
}

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const smooth = (n: number): number => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };

/** Half the hull's length at the near lane, px; it scales with depth like everything else on the water. */
export const HALF = 150;
/** Half the hull's beam, in depth units. */
export const BEAM = 0.065;
export const RADIUS: Readonly<Record<HazardKind, number>> = { mine: 0.04, missile: 0.05, drone: 0.045, boat: 0.045 };
export const DEPTH_MIN = 0.03;
export const DEPTH_MAX = 0.97;
/** Full rudder moves the ship this many depth units a second; it answers the helm at this rate. */
const LATERAL = 0.8;
const LATERAL_RATE = 7;
/** Rows of hazards meet the hull every ROW px of sailing. */
export const ROW = 330;
const FIRST = 640;
const AHEAD = 1800;
const BEHIND = 900;
/** The depths a row lays its hazards on; a row never fills more than three, so two always stay clear. */
export const SLOTS = [0.12, 0.31, 0.5, 0.69, 0.88] as const;
/** Homing drones and boats stop following this long before they arrive, so a late dodge always works. */
export const COMMIT_S = 0.95;
const HOMING = 0.24;
const HOMING_SPAN = 0.3;
/** Drones launch this far ahead and fly in over the last part of it; boats appear this far off the bow. */
export const DRONE_SHOW = 0.45;
const BOAT_SHOW = 760;

export const BASE_SPEED = 170;
export const TOP_SPEED = 320;
/** The engines take this long to bring her up to speed from the start line. */
const PUSH_S = 1.2;
const REST: Drive = { speed: 0, heat: 0, deep: 0, x: 1 };

/** Everything on the water is drawn smaller toward the far lane. */
export const depthScale = (d: number): number => 0.84 + 0.16 * d;

/** Hash only the row and this round's local seed; never read a backend seed or a future result. */
export function noise(n: number, seed = 0): number {
  let x = Math.imul((n + Math.imul(seed, 0x9e3779b1)) ^ 0x45d9f3b, 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Sailing speed for a multiplier: 170 px/s at 1×, 246 at 2×, 291 at 3×, capped at 320 from about 3.6×. */
export const sailSpeed = (x: number): number => Math.min(TOP_SPEED, BASE_SPEED * (1 + 0.45 * Math.log2(Math.max(1, x))));

/** The drive at a multiplier and round time, with the engines' push-off from the start line. */
export function driveAt(x100: number, elapsed: number): Drive {
  const x = Math.max(1, x100 / 100);
  return { speed: sailSpeed(x) * smooth(elapsed / (PUSH_S * 1000)), heat: 1 - 1 / x, deep: clamp(Math.log10(x) / 3, 0, 1), x };
}

/** Distance after `seconds` on the shared 10×-per-30 s curve: 170T + 4.2T² until the cap, less the push-off. */
export function straitDistance(seconds: number): number {
  const t = Math.max(0, seconds);
  const k = BASE_SPEED * 0.45 * Math.log2(10) / 30;
  const cap = (TOP_SPEED - BASE_SPEED) / k;
  const a = Math.min(t, cap);
  const u = Math.min(1, t / PUSH_S);
  return BASE_SPEED * a + k * a * a / 2 + TOP_SPEED * Math.max(0, t - cap) - BASE_SPEED * PUSH_S * (u - u * u * u + u * u * u * u / 2);
}

/** How far a missile or drone is through its flight: 0 at launch, 1 at the hull. Driven by distance, never time. */
export const strikeProgress = (h: Hazard, distance: number): number => 1 - (h.contact - distance) / h.lead;

/** A boat runs at a share of the ship's speed, so its position is a function of the distance left to its contact. */
export const boatX = (h: Hazard, distance: number): number => h.x + h.lead * (h.contact - distance);

/** Where a hazard is on the water now, px along the strait. */
export function hazardX(h: Hazard, distance: number): number {
  return h.kind === 'boat' ? boatX(h, distance) : h.x;
}

export function hull(world: World): { stern: number; bow: number; half: number } {
  const half = HALF * depthScale(world.depth);
  return { stern: world.distance - half, bow: world.distance + half, half };
}

export function createWorld(elapsed = 0, seed = 0, drive: Drive = REST): World {
  const distance = straitDistance(elapsed / 1000);
  const world: World = {
    seed, time: elapsed / 1000, distance, speed: drive.speed, depth: 0.5, lateral: 0,
    row: Math.max(0, Math.ceil((distance - FIRST - 420) / ROW)),
    hazards: [], pickups: [], overboard: [], scars: [], shield: 0, shaken: 0,
    guests: 0, rescued: 0, lost: 0, dodged: 0, hits: 0, close: 0, aim: 0.5, replan: 0,
  };
  lay(world, drive);
  // A late arrival never collides with what was already at the hull, and replays no launch cue.
  for (const h of world.hazards) {
    if (h.contact < distance + 420) { h.state = 'miss'; h.age = 9; }
    if (h.kind === 'missile') h.announced = strikeProgress(h, distance) > 0;
    if (h.kind === 'drone') h.announced = strikeProgress(h, distance) > DRONE_SHOW;
    if (h.kind === 'boat') h.announced = boatX(h, distance) - distance < BOAT_SHOW;
  }
  for (const p of world.pickups) if (p.contact < distance + 420) p.missed = true;
  return world;
}

type Weighted = readonly [HazardKind, number];
/** What the strait throws at a multiplier: mines from the start, missiles from 1.2×, boats from 1.5×, drones from 1.9×. */
function arsenal(x: number, row: number): Weighted[] {
  if (row < 2) return [['mine', 1]];
  const kinds: Weighted[] = [['mine', 3]];
  if (x >= 1.2) kinds.push(['missile', 3]);
  if (x >= 1.5) kinds.push(['boat', 2]);
  if (x >= 1.9) kinds.push(['drone', 2]);
  return kinds;
}

function choose(kinds: Weighted[], r: number): HazardKind {
  const total = kinds.reduce((sum, [, w]) => sum + w, 0);
  let at = r * total;
  for (const [kind, w] of kinds) { if (at < w) return kind; at -= w; }
  return kinds[kinds.length - 1]![0];
}

function lay(world: World, drive: Drive): void {
  while (FIRST + world.row * ROW < world.distance + AHEAD) layRow(world, drive);
}

function layRow(world: World, drive: Drive): void {
  const r = world.row++;
  const n = (k: number) => noise(r * 32 + k, world.seed);
  const contact = FIRST + r * ROW + (n(0) - 0.5) * 60;
  const x = Math.max(1, drive.x);
  // Half of all rounds end before 2×, so the rows thicken through 1×–3× and keep two clear slots after.
  let count: number;
  if (r < 2) count = n(1) < 0.7 ? 1 : 0;
  else if (x < 1.3) count = n(1) < 0.8 ? 1 : 0;
  else if (x < 2) count = n(1) < 0.35 ? 2 : 1;
  else if (x < 3) count = n(1) < 0.6 ? 2 : 1;
  else if (x < 6) count = n(1) < 0.3 ? 3 : 2;
  else count = n(1) < 0.55 ? 3 : 2;
  const order = [0, 1, 2, 3, 4].sort((a, b) => n(10 + a) - n(10 + b));
  const kinds = arsenal(x, r);
  for (let i = 0; i < count; i++) {
    const kind = choose(kinds, n(20 + i));
    const d = SLOTS[order[i]!]! + (n(30 + i) - 0.5) * 0.04;
    const variant = n(40 + i);
    const id = r * 8 + i;
    const s = depthScale(d);
    const hazard: Hazard = {
      id, kind, row: r, contact, x: contact, d, home: d, at: 0, lead: 1, homing: false, state: 'live', age: 0, variant,
      announced: false, warned: false,
      // The first mate looks at their phone for about one hazard in seven, after the first few rows.
      ignored: r >= 3 && noise(id * 7 + 3, world.seed ^ 0x5bd1e995) < 0.14,
    };
    if (kind === 'mine') hazard.x = contact + HALF * s + 8;
    else if (kind === 'boat') {
      hazard.x = contact + HALF * s + 18;
      hazard.lead = 0.45 + 0.25 * n(50 + i);
      hazard.homing = count <= 2;
    } else {
      hazard.at = (n(50 + i) - 0.5) * 170;
      hazard.x = contact + hazard.at;
      hazard.lead = kind === 'missile' ? 820 + 160 * n(60 + i) : 980 + 140 * n(60 + i);
      hazard.homing = kind === 'drone' && count <= 2;
    }
    world.hazards.push(hazard);
  }
  // Castaways on pool floaties wait in a clear slot; every ninth row from 1.3× a disco ball floats in another.
  const free = order.slice(count);
  if (free.length > 0 && n(5) < 0.6) {
    const d = SLOTS[free[0]!]! + (n(6) - 0.5) * 0.03;
    const variant = n(7);
    world.pickups.push({ id: r * 4, kind: 'guest', contact, x: contact + HALF * depthScale(d) + 6, d, count: variant < 0.2 ? 3 : variant < 0.45 ? 2 : 1, variant, taken: false, missed: false, age: 0 });
  }
  if (free.length > 1 && x >= 1.3 && r % 9 === 6) {
    const d = SLOTS[free[1]!]!;
    world.pickups.push({ id: r * 4 + 1, kind: 'disco', contact, x: contact + HALF * depthScale(d) + 6, d, count: 0, variant: n(8), taken: false, missed: false, age: 0 });
  }
}

/** The first mate: steer for the clear depth nearest the course that the next rows leave open, picking up castaways on the way. */
function autopilot(world: World, dt: number): number {
  world.replan -= dt;
  if (world.replan > 0) return world.aim;
  world.replan = 0.1;
  const speed = Math.max(60, world.speed);
  const threats: { d: number; r: number; t: number }[] = [];
  for (const h of world.hazards) {
    if (h.state !== 'live' || h.ignored) continue;
    const t = (h.contact - world.distance) / speed;
    if (t < -0.05 || t > 2.6) continue;
    threats.push({ d: h.d, r: BEAM + RADIUS[h.kind] + 0.035, t: Math.max(0, t) });
  }
  const lures: { d: number; t: number; worth: number }[] = [];
  for (const p of world.pickups) {
    if (p.taken || p.missed) continue;
    const t = (p.contact - world.distance) / speed;
    if (t > 0 && t < 2.6) lures.push({ d: p.d, t, worth: p.kind === 'disco' ? 1.1 : 0.45 });
  }
  let best = world.depth;
  let bestCost = Infinity;
  for (let k = 0; k <= 45; k++) {
    const c = 0.05 + k * 0.02;
    const travel = Math.abs(c - world.depth) / 0.65 + 0.12;
    let cost = Math.abs(c - world.depth) * 0.5 + (c - 0.5) ** 2 * 0.2 + (Math.abs(c - world.aim) > 0.03 ? 0.06 : 0);
    for (const th of threats) {
      if (Math.abs(c - th.d) < th.r) cost += th.t < 1.3 ? 12 : 6;
      if (travel > th.t) {
        // Short of time: where the ship will be when this row arrives, still on its way to c.
        const at = world.depth + Math.sign(c - world.depth) * 0.65 * Math.max(0, th.t - 0.12);
        if (Math.abs(at - th.d) < th.r) cost += 10;
      }
    }
    for (const lure of lures) if (Math.abs(c - lure.d) < 0.05 && travel < lure.t) cost -= lure.worth;
    if (cost < bestCost) { bestCost = cost; best = c; }
  }
  world.aim = best;
  return best;
}

export function stepWorld(world: World, dt: number, helm: Helm, drive: Drive = REST): StraitEvent[] {
  const events: StraitEvent[] = [];
  dt = clamp(dt, 0, 0.05);
  if (dt <= 0) return events;
  world.time += dt;
  world.shield = Math.max(0, world.shield - dt);
  world.shaken = Math.max(0, world.shaken - dt);

  // The helm: the player's keys, buttons or drag, or the first mate until the player takes it.
  let steer = 0;
  if (!helm.manual) steer = clamp((autopilot(world, dt) - world.depth) * 6, -1, 1);
  else if (helm.steer !== 0) steer = clamp(helm.steer, -1, 1);
  else if (helm.target !== null) steer = clamp((helm.target - world.depth) * 7, -1, 1);
  if (world.shaken > 0) steer *= 0.55;
  world.lateral += (steer * LATERAL - world.lateral) * (1 - Math.exp(-LATERAL_RATE * dt));
  world.depth += world.lateral * dt;
  if (world.depth < DEPTH_MIN || world.depth > DEPTH_MAX) {
    world.depth = clamp(world.depth, DEPTH_MIN, DEPTH_MAX);
    world.lateral = 0;
  }

  // Speed eases toward the drive: a hit bites quickly, the engines take a couple of seconds to recover.
  const want = drive.speed * (world.shaken > 0 ? 0.6 : 1);
  world.speed += (want - world.speed) * (1 - Math.exp(-(want < world.speed ? 8 : 2.2) * dt));
  world.distance += world.speed * dt;
  lay(world, drive);

  const { stern, bow, half } = hull(world);
  const speed = Math.max(60, world.speed);
  for (const h of world.hazards) {
    if (h.state !== 'live') {
      h.age += dt;
      // Whatever slipped past the bow is shouldered aside by the hull, never detonated by it.
      if ((h.kind === 'mine' || h.kind === 'boat') && h.state === 'miss') {
        const x = hazardX(h, world.distance);
        const r = BEAM + RADIUS[h.kind];
        if (x > stern - 20 && x < bow + 20 && Math.abs(h.d - world.depth) < r) h.d = world.depth + (h.d >= world.depth ? r : -r);
      }
      continue;
    }
    const rem = h.contact - world.distance;
    if (h.kind === 'missile' && !h.announced && rem <= h.lead) {
      // Launch from the coast: the battery takes aim at where the ship is now.
      h.announced = true;
      h.d = clamp(world.depth + (h.variant - 0.5) * 0.08, 0.06, 0.94);
      events.push({ type: 'launch', id: h.id, kind: h.kind, x: h.x, d: h.d });
    }
    if (h.kind === 'drone' && !h.announced && strikeProgress(h, world.distance) >= DRONE_SHOW) {
      h.announced = true;
      events.push({ type: 'arrive', id: h.id, kind: h.kind, x: h.x, d: h.d });
    }
    if (h.kind === 'boat' && !h.announced && boatX(h, world.distance) - world.distance < BOAT_SHOW) {
      h.announced = true;
      events.push({ type: 'arrive', id: h.id, kind: h.kind, x: boatX(h, world.distance), d: h.d });
    }
    // Homing drones and boats follow the ship's depth until they commit.
    if (h.homing && rem / speed > COMMIT_S && (h.kind === 'boat' || strikeProgress(h, world.distance) > 0)) {
      const step = HOMING * dt;
      h.d = clamp(h.d + clamp(world.depth - h.d, -step, step), Math.max(0.06, h.home - HOMING_SPAN), Math.min(0.94, h.home + HOMING_SPAN));
    }
    const r = BEAM + RADIUS[h.kind];
    const gap = Math.abs(h.d - world.depth);
    if (!h.warned && h.kind !== 'mine' && rem / speed < 1.4 && gap < r) {
      h.warned = true;
      events.push({ type: 'warn', id: h.id, kind: h.kind, x: h.x, d: h.d });
    }
    if (rem > 0) continue;
    // Contact: the row reaches the hull.
    const local = h.kind === 'missile' || h.kind === 'drone' ? h.at : half - 8;
    const x = world.distance + local;
    h.age = 0;
    if (gap < r) {
      if (world.shield > 0) {
        h.state = 'blocked';
        events.push({ type: 'block', id: h.id, kind: h.kind, x, d: h.d, local });
      } else {
        h.state = 'hit';
        world.hits++;
        world.shaken = 0.9;
        const lost = world.guests > 0 ? Math.max(1, Math.ceil(world.guests * 0.2)) : 0;
        world.guests -= lost;
        world.lost += lost;
        for (let i = 0; i < Math.min(lost, 4); i++) {
          const side = noise(h.id * 5 + i, world.seed) < 0.5 ? -1 : 1;
          world.overboard.push({ x: x + (i - 1.5) * 24, d: clamp(world.depth + side * (0.1 + 0.03 * i), -0.05, 1.08), age: 0, variant: noise(h.id * 9 + i, world.seed) });
        }
        world.scars.push({ local: clamp(local, -half + 12, half - 16) / depthScale(world.depth), y: h.kind === 'drone' ? -84 : h.kind === 'missile' ? -66 : -24, age: 0 });
        events.push({ type: 'hit', id: h.id, kind: h.kind, x, d: h.d, lost, local });
      }
    } else {
      h.state = 'miss';
      world.dodged++;
      if (gap < r + 0.09) {
        world.close++;
        events.push({ type: 'close', id: h.id, kind: h.kind, x: hazardX(h, world.distance), d: h.d });
      }
      // Missiles and drones that miss go into the water beside the hull.
      if (h.kind === 'missile' || h.kind === 'drone') events.push({ type: 'miss', id: h.id, kind: h.kind, x: h.x, d: h.d });
    }
  }

  for (const p of world.pickups) {
    if (p.taken || p.missed) { p.age += dt; continue; }
    if (p.contact - world.distance > 0) continue;
    if (Math.abs(p.d - world.depth) < BEAM + 0.06) {
      p.taken = true;
      p.age = 0;
      if (p.kind === 'disco') {
        world.shield = 6;
        events.push({ type: 'disco', id: p.id, x: p.x, d: p.d });
      } else {
        world.guests += p.count;
        world.rescued += p.count;
        events.push({ type: 'rescue', id: p.id, x: p.x, d: p.d, count: p.count });
      }
    } else p.missed = true;
  }

  for (const o of world.overboard) o.age += dt;
  for (const scar of world.scars) scar.age += dt;
  const behind = world.distance - BEHIND;
  world.hazards = world.hazards.filter(h => (h.kind === 'mine' || h.kind === 'boat' ? hazardX(h, world.distance) > behind : h.state === 'live' || h.age < 1.5)).slice(-80);
  world.pickups = world.pickups.filter(p => p.x > behind && !(p.taken && p.age > 1.2)).slice(-40);
  world.overboard = world.overboard.filter(o => o.x > behind && o.age < 14).slice(-14);
  world.scars = world.scars.filter(s => s.age < 16).slice(-5);
  return events;
}
