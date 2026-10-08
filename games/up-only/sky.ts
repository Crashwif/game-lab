/**
 * The chart the shiba flies through: the candles the generator lays and the gaps between them, the coins,
 * the traps and the power-ups, his own physics (a flap against gravity, the support line below and the
 * resistance line above), what a clipped candle costs the bag, the FUD that gathers behind him, and the
 * copy-trading bot that flaps until the player does. All of it is presentation and a skill score: the
 * round's outcome comes from the room, and nothing here can move it or a credit.
 *
 * Distances are picture px. The chart scrolls left past the shiba, who flies at BIRD_X.
 */
import { type Spring, clamp, mix, mulberry32, settleSpring, spring, stepSpring } from './motion';

export const W = 960;
export const H = 540;
export const BIRD_X = 250;
/** The support line: the floor of the chart. */
export const FLOOR = 470;
/** The resistance line: its ceiling. */
export const CEILING = 52;
export const BIRD_R = 22;
export const CANDLE_W = 62;
/** Where the shiba rests on the launchpad before the round. */
export const PAD_Y = 396;
/** How far past the right edge the chart is laid: just off screen, so a gap is cut for the multiplier it meets. */
const AHEAD = 120;

export interface Candle {
  /** The body's centre. */
  x: number;
  /** The gap's centre and height: the green candle stands below it, the red one hangs above. */
  gapY: number;
  gapH: number;
  seed: number;
  /** Clipped: it collides no more and draws cracked. */
  hit: boolean;
  hitAge: number;
  /** Smashed through by the rocket: it draws in pieces. */
  smashed: boolean;
  /** Seconds since the rug pull flipped it red and let it fall, or -1. */
  rugged: number;
}

export type PickupKind = 'cope' | 'wagmi' | 'lambo' | 'honey' | 'magnet' | 'rocket';
export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  taken: boolean;
  /** Seconds since it was taken, for the pop. */
  age: number;
  seed: number;
}

/** What each coin adds to the bag. */
export const COIN_VALUE: Record<PickupKind, number> = { cope: 1, wagmi: 5, lambo: 25, honey: 0, magnet: 0, rocket: 0 };
export const POWER_S = { magnet: 6, rocket: 5 } as const;
/** Every this many coins in a row pays a bonus of the same size. */
export const STREAK_STEP = 25;

export interface Bird {
  y: number;
  vy: number;
  /** Nose up or down with the climb, springing. */
  tilt: Spring;
  /** Seconds left spinning after a clip. */
  stun: number;
  /** After a hit nothing else counts for this long. */
  grace: number;
  /** A flap pressed in the last moment of a spin, played as soon as it ends. */
  queued: boolean;
  /** Seconds since the last flap, for the wing beat. */
  flapAge: number;
  wing: Spring;
  wingLag: Spring;
  feather: Spring;
}

/** What happened this step, for the scene's sound and captions; counts and flags last one frame. */
export interface WorldEvents {
  coins: number;
  value: number;
  lambo: boolean;
  honey: boolean;
  magnet: boolean;
  rocket: boolean;
  flap: boolean;
  wick: boolean;
  floor: boolean;
  ceiling: boolean;
  /** The FUD struck: the whole bag went. */
  fud: boolean;
  smash: boolean;
  /** The streak that just paid a bonus, or 0. */
  streak: number;
  /** Coins that flew out of the bag this step. */
  spill: number;
  expired: 'magnet' | 'rocket' | null;
}

export interface World {
  time: number;
  bird: Bird;
  candles: Candle[];
  pickups: Pickup[];
  /** Where the generator lays the next candle. */
  xNext: number;
  lastGapY: number;
  rand: () => number;
  speed: Spring;
  /** Px of chart flown this round. */
  distance: number;
  bag: number;
  /** Coins taken since the last hit. */
  streak: number;
  /** How close the FUD is, 0 to 1: a hit brings it in, and at 1 it strikes. */
  heat: number;
  magnet: number;
  rocket: number;
  /** Seconds since the FUD struck, or -1. */
  fud: number;
  /** The bot's next look at the chart, how late it reads it, and how long it is staring at its phone. */
  bot: { clock: number; late: number; blind: number };
  /** The bot's own dice, so its polling never reshapes the course. */
  botRand: () => number;
  events: WorldEvents;
}

export interface Drive {
  running: boolean;
  /** The room's multiplier: the speed, and each new gap cut for the multiplier it will arrive at. */
  multiplier: number;
  /** Seconds the round has run: with the multiplier, it gives the room's own pace, never a compiled-in curve. */
  seconds?: number;
  /** The shiba is off the chart (on the jet, or fallen through the floor): no flaps, no pickups, no collisions. */
  off: boolean;
  /** Off the chart but still in the air (the moments before the floor goes, or waiting for the jet): flaps and gravity only. */
  glide?: boolean;
  /** While gliding, the height he holds with flaps of his own, his wings damped, until the jet is under him. */
  hover?: number;
}

const BASE_SPEED = 215;
const SPEED_RISE = 0.5;
export const MAX_SPEED = 520;
export const GRAVITY = 1650;
const FLAP_V = -470;
const MAX_FALL = 720;
const STUN_S = 0.45;
const GRACE_S = 1;
const HEAT_PER_HIT = 0.6;
const HEAT_DECAY = 0.28;
/** The collider: his head, where the eye goes, not the tips of the hat, the tail or the legs. */
const HEAD = { x: 10, y: -6 };
const HEAD_R = 18;

const noEvents = (): WorldEvents => ({ coins: 0, value: 0, lambo: false, honey: false, magnet: false, rocket: false, flap: false, wick: false, floor: false, ceiling: false, fud: false, smash: false, streak: 0, spill: 0, expired: null });

const makeBird = (): Bird => ({ y: PAD_Y, vy: 0, tilt: spring(0), stun: 0, grace: 0, queued: false, flapAge: 9, wing: spring(0), wingLag: spring(0), feather: spring(0) });

export function createWorld(seed: number): World {
  const w: World = {
    time: 0, bird: makeBird(), candles: [], pickups: [], xNext: 0, lastGapY: 270, rand: mulberry32(seed), speed: spring(0), distance: 0,
    bag: 0, streak: 0, heat: 0, magnet: 0, rocket: 0, fud: -1, bot: { clock: 0, late: 0, blind: 0 }, botRand: mulberry32(seed), events: noEvents(),
  };
  resetWorld(w, seed);
  return w;
}

/** A fresh chart for a new round: an open stretch off the launchpad, then the generator takes over. */
export function resetWorld(w: World, seed: number): void {
  w.rand = mulberry32(seed);
  w.botRand = mulberry32(seed ^ 0x5bd1e995);
  w.time = 0;
  w.bird = makeBird();
  w.candles = [];
  w.pickups = [];
  w.lastGapY = 270;
  settleSpring(w.speed, 0);
  w.distance = 0;
  w.bag = 0;
  w.streak = 0;
  w.heat = 0;
  w.magnet = 0;
  w.rocket = 0;
  w.fud = -1;
  w.bot = { clock: 0, late: 0, blind: 0 };
  w.events = noEvents();
  w.xNext = BIRD_X + 560;
  for (let i = 0; i < 5; i += 1) w.pickups.push({ kind: 'cope', x: BIRD_X + 200 + i * 52, y: 300 - Math.sin(i / 4 * Math.PI) * 60, taken: false, age: 0, seed: w.rand() });
  while (w.xNext < W + AHEAD) lay(w, 0);
}

/** The speed the chart scrolls at for a multiplier: brisk at 1×, capped well before the number goes vertical. */
export const speedFor = (multiplier: number): number => Math.min(MAX_SPEED, BASE_SPEED * (1 + SPEED_RISE * Math.log2(Math.max(1, multiplier))));

/** Joins a round already running: the chart is up to speed, cut for this multiplier, and the shiba mid-flight. */
export function settleRunning(w: World, multiplier: number, elapsedS: number): void {
  const v = speedFor(multiplier);
  settleSpring(w.speed, v);
  w.distance = elapsedS * v * 0.8;
  w.bird.y = 280;
  w.candles = [];
  w.pickups = [];
  w.xNext = BIRD_X + 320;
  while (w.xNext < W + AHEAD) lay(w, 1 - 1 / Math.max(1, multiplier));
}

/**
 * How tight to cut a gap laid at `x`: the multiplier it will meet the shiba at if the round is still going, read
 * off the room's public curve (its pace measured from the multiplier and the seconds run, x = 10^(pace·t)), never
 * the crash point. 1.5× is 0.33, 2× 0.5, 3× 0.67. Before the pace can be measured it uses the multiplier now.
 */
const arrival = (w: World, drive: Drive, x: number): number => {
  const eta = (x - BIRD_X) / Math.max(w.speed.x, speedFor(drive.multiplier) * 0.7, 1);
  const pace = (drive.seconds ?? 0) > 0.5 && drive.multiplier > 1.001 ? Math.log10(drive.multiplier) / drive.seconds! : 0;
  return 1 - 1 / (Math.max(1, drive.multiplier) * 10 ** (eta * pace));
};

// ---- The generator --------------------------------------------------------------------------------------

function pickup(w: World, kind: PickupKind, x: number, y: number): Pickup {
  const p: Pickup = { kind, x, y, taken: false, age: 0, seed: w.rand() };
  w.pickups.push(p);
  return p;
}

/** Lays the next candle at xNext with the coins in its gap, and whatever sits in the open before the one after. */
function lay(w: World, tension: number): void {
  const r = w.rand;
  const x = w.xNext;
  const gapH = mix(205, 130, tension) + (r() - 0.5) * 20;
  const low = CEILING + 36 + gapH / 2;
  const high = FLOOR - 36 - gapH / 2;
  const gapY = clamp(w.lastGapY + (r() - 0.5) * 300, low, high);
  w.lastGapY = gapY;
  w.candles.push({ x, gapY, gapH, seed: r(), hit: false, hitAge: 0, smashed: false, rugged: -1 });
  // Three coins down the middle of the gap; the middle one is worth more, the top one sometimes a lambo.
  pickup(w, r() < 0.08 ? 'lambo' : 'cope', x, gapY - 30);
  pickup(w, r() < 0.35 ? 'wagmi' : 'cope', x, gapY);
  pickup(w, 'cope', x, gapY + 30);
  const spacing = mix(300, 220, tension) + (r() - 0.5) * 60;
  const xm = x + spacing / 2;
  const ym = CEILING + 70 + r() * (FLOOR - CEILING - 140);
  const roll = r();
  if (roll < 0.55) {
    for (let i = 0; i < 5; i += 1) pickup(w, i === 2 && r() < 0.3 ? 'wagmi' : 'cope', xm - 60 + i * 30, ym - Math.sin((i / 4) * Math.PI) * 34);
  } else if (roll < 0.75 && tension > 0.05) {
    pickup(w, 'honey', xm, ym);
  } else if (roll < 0.9) {
    pickup(w, r() < 0.5 ? 'magnet' : 'rocket', xm, ym);
  }
  w.xNext = x + spacing;
}

// ---- The step ----------------------------------------------------------------------------------------------

function spill(w: World, coins: number): void {
  const n = Math.min(w.bag, Math.max(0, Math.round(coins)));
  w.bag -= n;
  w.events.spill += n;
}

/** A clip on a candle, the support or the resistance: a quarter of the bag and the FUD a step closer. */
function hit(w: World, what: 'wick' | 'floor' | 'ceiling'): void {
  const b = w.bird;
  if (b.grace > 0) return;
  spill(w, Math.max(Math.min(w.bag, 3), Math.ceil(w.bag * 0.25)));
  w.streak = 0;
  b.stun = STUN_S;
  b.grace = GRACE_S;
  w.heat += HEAT_PER_HIT;
  w.events[what] = true;
  if (w.heat >= 1) {
    // Two clips close together: the FUD strikes and the whole bag goes.
    w.heat = 1;
    w.fud = 0;
    spill(w, w.bag);
    w.events.fud = true;
  }
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
      w.magnet = POWER_S.magnet;
      e.magnet = true;
      return;
    case 'rocket':
      w.rocket = POWER_S.rocket;
      e.rocket = true;
      return;
    default: {
      const value = COIN_VALUE[p.kind];
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

/** Advances the chart by `dt` seconds with the shiba's flaps. */
export function stepWorld(w: World, flaps: number, drive: Drive, dt: number): void {
  const e = (w.events = noEvents());
  const b = w.bird;
  w.time += dt;
  stepSpring(w.speed, drive.running ? speedFor(drive.multiplier) : 0, drive.running ? 2.2 : 6, 1, dt);
  const move = Math.max(0, w.speed.x) * dt;
  w.distance += move;
  for (const c of w.candles) {
    c.x -= move;
    if (c.hit || c.smashed) c.hitAge += dt;
    if (c.rugged >= 0) c.rugged += dt;
  }
  for (const p of w.pickups) {
    p.x -= move;
    if (p.taken) p.age += dt;
  }
  w.candles = w.candles.filter((c) => c.x > -160);
  w.pickups = w.pickups.filter((p) => p.x > -60 && (!p.taken || p.age < 0.4));
  w.xNext -= move;
  while (w.xNext < W + AHEAD) lay(w, drive.running ? arrival(w, drive, w.xNext) : 0);

  // Timers.
  b.stun = Math.max(0, b.stun - dt);
  b.grace = Math.max(0, b.grace - dt);
  b.flapAge += dt;
  w.heat = Math.max(0, w.heat - HEAT_DECAY * (w.rocket > 0 ? 2.5 : 1) * dt);
  if (w.fud >= 0) w.fud += dt;
  if (w.fud > 2) w.fud = -1;
  if (w.magnet > 0) {
    w.magnet -= dt;
    if (w.magnet <= 0) e.expired = 'magnet';
  }
  if (w.rocket > 0) {
    w.rocket -= dt;
    if (w.rocket <= 0) e.expired = 'rocket';
  }

  const flying = drive.running && !drive.off;
  const airborne = flying || drive.glide === true;
  if (airborne) {
    // A flap pressed in the last 0.12 s of a spin is kept and played the moment it ends.
    if (flaps > 0 && b.stun > 0 && b.stun <= 0.12) b.queued = true;
    if (!flying && drive.hover !== undefined && b.y > drive.hover && b.vy > -40) flaps = 1;
    if ((flaps > 0 || b.queued) && b.stun <= 0) {
      b.vy = FLAP_V;
      b.flapAge = 0;
      b.queued = false;
      e.flap = true;
    }
    if (!flying && drive.hover !== undefined) {
      // Holding station for the jet: gravity against a damped beat (rate 8), stepped exactly.
      const k = 8, terminal = GRAVITY / k, decay = Math.exp(-k * dt);
      b.y += terminal * dt + ((b.vy - terminal) * (1 - decay)) / k;
      b.vy = terminal + (b.vy - terminal) * decay;
    } else {
      // Exact for constant gravity, so a flap rises the same 67 px at any frame rate.
      const v0 = b.vy;
      b.vy = Math.min(MAX_FALL, v0 + GRAVITY * dt);
      b.y += ((v0 + b.vy) / 2) * dt;
    }
  }
  if (flying) {
    if (b.y + BIRD_R > FLOOR) {
      b.y = FLOOR - BIRD_R;
      if (b.vy > 0) b.vy = -380;
      hit(w, 'floor');
    }
    if (b.y - BIRD_R < CEILING) {
      b.y = CEILING + BIRD_R;
      b.vy = Math.max(b.vy, 120);
      hit(w, 'ceiling');
    }
    // A candle body touching his head: a circle of HEAD_R ahead of and above his centre, turning with the tilt.
    const t = b.tilt.x, hx = BIRD_X + HEAD.x * Math.cos(t) - HEAD.y * Math.sin(t), hy = b.y + HEAD.x * Math.sin(t) + HEAD.y * Math.cos(t);
    const touches = (top: number, bottom: number, cx: number) => Math.hypot(hx - clamp(hx, cx - CANDLE_W / 2, cx + CANDLE_W / 2), hy - clamp(hy, top, bottom)) < HEAD_R;
    for (const c of w.candles) {
      if (c.hit || c.smashed || c.rugged >= 0 || Math.abs(c.x - hx) > CANDLE_W / 2 + HEAD_R) continue;
      if (!touches(CEILING, c.gapY - c.gapH / 2, c.x) && !touches(c.gapY + c.gapH / 2, FLOOR, c.x)) continue;
      if (w.rocket > 0) {
        c.smashed = true;
        c.hitAge = 0;
        e.smash = true;
      } else if (b.grace > 0) {
        c.hit = true;
      } else {
        hit(w, 'wick');
        c.hit = true;
        c.hitAge = 0;
      }
    }
    for (const p of w.pickups) {
      if (p.taken) continue;
      const coin = COIN_VALUE[p.kind] > 0;
      if (w.magnet > 0 && coin && p.x > BIRD_X - 20 && p.x < BIRD_X + 260) {
        p.y += (b.y - p.y) * (1 - Math.exp(-8 * dt));
        p.x += (BIRD_X - p.x) * (1 - Math.exp(-4 * dt));
      }
      if (Math.hypot(p.x - BIRD_X, p.y - b.y) < BIRD_R + 18) take(w, p);
    }
  } else if (drive.glide) {
    // Nothing collides off the chart: the launchpad or the support holds him, the resistance caps him.
    const ground = w.distance < 110 ? PAD_Y : FLOOR - BIRD_R;
    if (b.y > ground) {
      b.y = ground;
      b.vy = Math.min(0, b.vy);
    }
    if (b.y < CEILING + BIRD_R) {
      b.y = CEILING + BIRD_R;
      b.vy = Math.max(0, b.vy);
    }
  } else if (!drive.running && !drive.off) {
    // On the launchpad: at rest, nose level.
    b.y = PAD_Y;
    b.vy = 0;
  }
  // Repeated input changes the flight impulse immediately; the visible bones retain
  // their current position/velocity while following the next power stroke.
  const easeWing = (t: number) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
  const target = b.flapAge < .12 ? easeWing(b.flapAge / .12) : 1 - easeWing((b.flapAge - .12) / .32);
  stepSpring(b.wing, target, 38, .85, dt);
  stepSpring(b.wingLag, b.wing.x, 42, .9, dt);
  stepSpring(b.feather, b.wingLag.x, 36, .9, dt);
  stepSpring(b.tilt, airborne ? clamp(b.vy / 600, -0.5, 0.9) : 0, 9, 0.8, dt);
}

// ---- The copy-trading bot --------------------------------------------------------------------------------

/**
 * Flaps like a mid trader: it reads the next gap fourteen times a second, aims the bottom of its hop a little
 * under the middle and a little late, chases power-ups and coin arcs when the way is clear, hops over
 * honeypots most of the time, and every so often stares at its phone into a candle. It rolls its own dice,
 * so the course is the same whoever flaps and at any frame rate.
 */
export function autopilot(w: World, dt: number): number {
  const b = w.bird;
  w.bot.clock -= dt;
  w.bot.blind = Math.max(0, w.bot.blind - dt);
  if (w.bot.clock > 0) return 0;
  w.bot.clock = 0.07;
  w.bot.late = w.botRand() * 16;
  // Every so often it looks at its phone for a third of a second, which is how it meets a candle.
  if (w.bot.blind <= 0 && w.botRand() < 0.004) w.bot.blind = 0.35;
  const next = w.candles.filter((c) => c.rugged < 0 && c.x + CANDLE_W / 2 > BIRD_X - 4).sort((a, c) => a.x - c.x)[0];
  let target = next ? next.gapY + 16 : 260;
  const clear = !next || next.x - BIRD_X > 240;
  if (clear) {
    // Nothing to thread: take the richer of the coins and power-ups in reach.
    const near = w.pickups.filter((p) => !p.taken && p.kind !== 'honey' && p.x > BIRD_X + 20 && p.x < BIRD_X + 230 && (!next || p.x < next.x - CANDLE_W)).sort((a, c) => (COIN_VALUE[c.kind] || 8) - (COIN_VALUE[a.kind] || 8))[0];
    if (near) target = near.y;
  }
  const honey = w.pickups.find((p) => !p.taken && p.kind === 'honey' && p.x > BIRD_X && p.x < BIRD_X + 170 && Math.abs(p.y - b.y) < 60);
  if (honey && w.botRand() < 0.8) target = Math.min(target, honey.y - 80);
  target = clamp(target, CEILING + 60, FLOOR - 50);
  if (w.bot.blind > 0) return 0;
  return b.y > target + w.bot.late && b.vy > -90 ? 1 : 0;
}
