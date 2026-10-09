/**
 * The party: holders who run in and cannonball off the rim and bob on tubes,
 * each cracking on their own nerve, your degen on the flamingo, the DJ, the
 * dev on his lounger with the chain round his wrist (he tugs it on a pulse
 * and fakes a yank or two), and the AIRDROP helicopter that tips fresh
 * degens into the pool at the milestones. An accepted exit paddles you to
 * the ladder and onto a lounger
 * with a towel and shades, to a burst of confetti; the rug pull spins everyone
 * still floating down the drain, leaves one sad Wojak in the puddle, and the
 * dev takes a selfie with the empty pool before he strolls off with the bag.
 * An empty lifeguard chair on the near deck has warned everyone: NO LIFEGUARD
 * (HE SOLD).
 */
import { type Spring, clamp, fract, gust, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { DRAIN, INK, LADDER_X, POOL, type PoolState, drainPull, splash, surfaceY, tensionFor } from './pool';

const SKIN = '#f3dccb';
const TUBES = ['#ff5d9e', '#7cf67c', '#ffe27a', '#8fd3ff', '#c084fc'];
export const DEV_LOUNGER = { x: 872, y: POOL.top - 4 };
export const SAFE_LOUNGER = { x: 78, y: POOL.top - 4 };
/** The lifeguard chair on the near deck, left of the pool. */
const CHAIR = { x: 76, top: 322, seat: 352, foot: 478 };
/** The helicopter's height, speed, run and the x at which it tips each degen out. */
export const HELI = { y: 152, speed: 225, from: -170, to: 1130, drops: [345, 485, 625] };
/** How many holders the multiplier has drawn into the pool so far, and the most the pool takes with the airdrops. */
const crowdFor = (growth: number): number => Math.min(22, 2 + Math.floor(growth * 5));
const MAX_HOLDERS = 30;
const CONFETTI = 36;
/** The dev sits up across about 1.05x-3.3x of the tension (1 - 1/x): a fifth of the way at 1.3x, three quarters at 2x. */
const leanFor = (tension: number): number => smoothstep(0.05, 0.7, tension);
/** Each holder's own nerve (0 calm, 1 nervous, 2 panic): the twitchier ones crack from about 1.2x, the steadiest near 4x. */
const nerveFor = (tension: number, tone: number): number => { const f = tension + (tone - 0.5) * 0.3; return f > 0.62 ? 2 : f > 0.3 ? 1 : 0; };
/** The deck under a runner's feet, the rim standing 6 px proud of it, and the height a carried tube rides at over the deck. */
const DECK = POOL.top - 4;
const groundAt = (x: number): number => DECK - 6 * smoothstep(138, 154, x) * smoothstep(822, 806, x);
const DECK_Y = POOL.top - 36;
/** A cannonball: the run in along the far deck behind the dev, the crouch on the rim and the time in the air. */
const RUN_S = 0.45;
const CROUCH_S = 0.12;
const AIR_S = 0.9;
const TAKEOFF_X = 794;
/** A fresh flamingo's drop into the pool between rounds. */
const DROP_S = 0.6;
const TAU = Math.PI * 2;
const wrap = (a: number): number => a - Math.round(a / TAU) * TAU;

export type HolderMode = 'jumping' | 'floating' | 'leaving' | 'sucked' | 'gone' | 'puddle' | 'fading';
export interface Holder {
  x: number; y: number; tube: string; tone: number; phase: number; mode: HolderMode; t: number; fromX: number; toX: number; fromY: number; spin: number; scale: number; airdropped: boolean;
  /** Nerve reached so far (it only climbs), seconds since the last glance at the dev and since landing, and the eased facing. */
  mood: number; glance: number; land: number; face: number;
  /** Depth row, the bust's eased lift for it, distance walked on the deck, a stranded holder left in the puddle, and a runner the rug pull caught on the deck. */
  row: number; rise: number; walk: number; stuck: boolean; deck: boolean;
  /** A jeer as you paddle off, and the seconds since it started (negative while it waits). */
  say: string; sayAt: number;
}
export type AvatarMode = 'floating' | 'paddling' | 'climbing' | 'walking' | 'lounging' | 'sucked' | 'puddle';
export type DevMode = 'lounging' | 'standing' | 'selfie' | 'leaving' | 'returning';
export interface Confetti { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour: string; spin: number }
/** A limb end relative to the body, with the side its middle joint bends to (-1..1, passing through straight). */
type End = { x: number; y: number; b: number };
export interface Avatar {
  mode: AvatarMode; x: number; y: number; modeAge: number; spin: number; scale: number; shades: Spring; fear: number;
  climbFrom?: { x: number; y: number };
  /** Distance paddled or walked, which drives the strokes and the feet. */
  walk: number;
  /** You hopping onto the flamingo (it stays empty for a spectator), seconds since it dropped in, and the eased facing. */
  seat: Spring; enter: number; face: number;
  /** The limb ends a mode change blends from. */
  from: End[] | null;
}

export interface PartyState {
  /** A decorative clock that never jumps; `elapsed` is the round's own time in seconds. */
  time: number;
  elapsed: number;
  tension: number;
  /** False for a spectator: the flamingo floats empty and nobody is labelled YOU. */
  player: boolean;
  holders: Holder[];
  avatar: Avatar;
  /** The last round's avatar fading out while a fresh flamingo drops in. */
  ghost: Avatar | null;
  ghostAge: number;
  /** Your flamingo once you climb out: it bobs off from the ladder, and the drain takes it with everyone else. */
  floatie: { x: number; spin: number; scale: number; alpha: number; fading: boolean; age: number } | null;
  /**
   * The dev: `lean` sits him up with the chain in his fist as the tension grows, `tug` twitches the chain on the beat of the
   * tension, `fake` is the seconds since a fake yank (and `quip` what he says), `up` blends him from the lounger to his feet,
   * `face` turns him round for the selfie (-1 faces the pool), `phone` raises the selfie stick, and `talk` fades `line` in and out.
   */
  dev: { mode: DevMode; x: number; modeAge: number; grin: Spring; yank: Spring; lean: Spring; phone: Spring; tug: Spring; fake: number; quip: string; line: string; talk: number; face: number; up: number; flash: number; snapped: boolean };
  /** The AIRDROP helicopter: crossing while active, with the passes it still owes. */
  heli: { active: boolean; x: number; drops: number; pending: number };
  /** The NO LIFEGUARD sign's swing, in radians. */
  sign: Spring;
  confetti: Confetti[];
  whaleFlash: number;
  rng: () => number;
  events: { splash: { x: number; y: number; big: boolean } | null; heli: boolean; drop: boolean; shutter: boolean };
}

const freshDev = (): PartyState['dev'] => ({ mode: 'lounging', x: DEV_LOUNGER.x, modeAge: 0, grin: spring(0), yank: spring(0), lean: spring(0), phone: spring(0), tug: spring(0), fake: 9, quip: '', line: '', talk: 0, face: -1, up: 0, flash: 0, snapped: false });
const freshAvatar = (enter: number): Avatar => ({ mode: 'floating', x: 480, y: 420, modeAge: 0, spin: 0, scale: 1, shades: spring(0), fear: 0, walk: 0, seat: spring(0), enter, face: 1, from: null });

function newHolder(p: PartyState, x: number, y: number, mode: HolderMode, airdropped: boolean, toX: number): Holder {
  return { x, y, tube: TUBES[Math.floor(p.rng() * TUBES.length)]!, tone: p.rng(), phase: p.rng() * 6.3, mode, t: 0, fromX: x, toX, fromY: y, spin: 0, scale: 1, airdropped, mood: 0, glance: 9, land: 9, face: x > 480 ? -1 : 1, row: 0, rise: 0, walk: 0, stuck: false, deck: false, say: '', sayAt: 9 };
}

/** How far a leaver has climbed out over the far wall; a runner caught on the deck never went in. */
const climbOut = (h: Holder): number => (h.deck ? 1 : smoothstep(POOL.right - 30, POOL.right + 20, h.x));

export function createParty(): PartyState {
  return {
    time: 0, elapsed: 0, tension: 0, player: true, holders: [], avatar: freshAvatar(9), ghost: null, ghostAge: 0, floatie: null,
    dev: freshDev(), heli: { active: false, x: HELI.from, drops: 0, pending: 0 }, sign: spring(0), confetti: [], whaleFlash: 0, rng: () => 0.5, events: { splash: null, heli: false, drop: false, shutter: false },
  };
}

/**
 * A new round. `carry` keeps the yard continuous between rounds: whatever the drain left fades out, the last avatar fades
 * while a fresh flamingo drops in, the dev strolls back to his lounger and the helicopter finishes its exit.
 */
export function resetParty(p: PartyState, seed: number, carry = false): void {
  let a = seed >>> 0;
  p.rng = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  p.whaleFlash = 0;
  if (!carry) {
    p.holders = [];
    p.avatar = freshAvatar(9);
    p.ghost = null;
    p.floatie = null;
    p.dev = freshDev();
    p.heli = { active: false, x: HELI.from, drops: 0, pending: 0 };
    settleSpring(p.sign, 0);
    p.confetti = [];
    return;
  }
  for (const h of p.holders) if (h.mode !== 'leaving' && h.mode !== 'gone') { h.mode = 'fading'; h.t = 0; }
  p.holders = p.holders.filter((h) => h.mode !== 'gone');
  if (p.avatar.mode !== 'floating') { p.ghost = p.avatar; p.ghostAge = 0; p.avatar = freshAvatar(0); }
  if (p.floatie) p.floatie.fading = true;
  const d = p.dev;
  if (d.mode !== 'lounging') { d.mode = 'returning'; d.modeAge = 0; d.x = Math.min(d.x, 1000); }
  d.fake = 9;
  d.snapped = false;
  p.heli.pending = 0;
  p.heli.drops = HELI.drops.length;
}

function setMode(a: Avatar, mode: AvatarMode): void {
  a.from = rigNow(a);
  a.mode = mode;
  a.modeAge = 0;
}

/** The exit was accepted: paddle for the ladder, while the two nearest holders call it. */
export function leavePool(p: PartyState): void {
  const a = p.avatar;
  if (a.mode !== 'floating') return;
  setMode(a, 'paddling');
  const near = p.holders.filter((h) => h.mode === 'floating').sort((m, n) => Math.abs(m.x - a.x) - Math.abs(n.x - a.x)).slice(0, 2);
  near.forEach((h, i) => { h.say = i ? 'paper hands' : 'jeet'; h.sayAt = -0.15 - 0.5 * i; });
}

/** A burst of confetti (capped) from a point: the cash-out's beat. */
export function celebrate(p: PartyState, x: number, y: number): void {
  for (let i = 0; i < CONFETTI; i += 1) {
    p.confetti.push({ x, y, vx: (p.rng() - 0.5) * 300, vy: -140 - p.rng() * 220, r: 2 + p.rng() * 3, age: 0, life: 1.1 + p.rng() * 0.7, colour: ['#7cf67c', '#ffe27a', '#ff5d9e', '#8fd3ff'][i % 4]!, spin: p.rng() * 6 });
  }
}

/** A milestone: the helicopter owes the pool a pass (it launches on the next step, once any pass under way is over). */
export function airdrop(p: PartyState): void {
  p.heli.pending += 1;
}

/** One link wound tighter: the dev's wrist twitches on the chain (2 for a full notch). */
export function devTug(p: PartyState, strength: number): void {
  p.dev.tug.v += 150 * strength;
}

const FAKE_LINES = ['jk', 'relax ser', 'jk jk', 'just stretching'];
/** A fake-out: he snaps the chain taut, the plug lifts, the crowd flinches, and he lets it go slack again. */
export function devFake(p: PartyState, index: number): void {
  const d = p.dev;
  if (d.mode !== 'lounging') return;
  d.fake = 0;
  d.quip = FAKE_LINES[index % FAKE_LINES.length]!;
  for (const h of p.holders) if (h.mode === 'floating') h.glance = -0.08 - 0.12 * h.tone;
  p.sign.v += 2;
}
/** How hard a fake yank is pulling right now, 0..1: a snap. */
export const fakePull = (p: PartyState): number => smoothstep(0, 0.07, p.dev.fake) * (1 - smoothstep(0.3, 0.75, p.dev.fake));

/** Straight onto the safe lounger, shades on: an exit met late. */
function lounge(a: Avatar): void {
  a.mode = 'lounging';
  a.modeAge = 0;
  a.from = null;
  a.x = SAFE_LOUNGER.x;
  a.y = POOL.top - 26;
  settleSpring(a.shades, 1);
}

/** A round met late: the crowd the multiplier has drawn so far, already afloat, the dev sat up to match, and the avatar out on the lounger if the exit is in. */
export function settleParty(p: PartyState, pool: PoolState, growth: number, out: boolean): void {
  const tension = tensionFor(growth);
  for (let i = 0; i < crowdFor(growth); i += 1) {
    const x = 230 + p.rng() * 520;
    const h = newHolder(p, x, surfaceY(pool, x) - 4, 'floating', false, x);
    h.mood = nerveFor(tension, h.tone);
    h.row = i % 3;
    h.rise = h.row * 7;
    p.holders.push(h);
  }
  settleSpring(p.dev.lean, leanFor(tension));
  settleSpring(p.dev.grin, tension);
  if (out) lounge(p.avatar);
}

/** The crash frame: the dev is on his feet yanking the chain before the plug gives (the pull lands a few frames later). */
export function devYank(p: PartyState): void {
  const d = p.dev;
  if (d.mode !== 'lounging') return;
  d.mode = 'standing';
  d.modeAge = 0;
  d.yank.v += 30;
}

/** The plug is out. `quiet` is a rug pull met late: everyone lands where the loud one would have left them. */
export function rugPulled(p: PartyState, quiet: boolean): void {
  const d = p.dev;
  if (quiet) { d.mode = 'leaving'; d.modeAge = 0; d.x = DEV_LOUNGER.x + 150; d.snapped = true; d.up = 1; }
  else devYank(p);
  const floating = p.holders.filter((h) => h.mode === 'floating');
  for (const h of p.holders) {
    if (h.mode === 'floating') h.mode = quiet ? 'gone' : 'sucked';
    // A runner still on the deck thinks better of it and turns back along it (its stride mirrored, so a planted foot stays
    // put); one in the air lands in the drain's pull.
    else if (h.mode === 'jumping' && (quiet || (!h.airdropped && h.t < RUN_S + CROUCH_S))) { h.mode = quiet ? 'gone' : 'leaving'; h.t = 0; h.deck = true; h.walk = 16 - h.walk; h.fromY = h.y; }
  }
  // Only a floater goes down the drain. Paddling or climbing, the avatar has cashed out and carries on to the lounger.
  const a = p.avatar;
  if (a.mode === 'floating') {
    if (quiet) { a.mode = 'puddle'; a.modeAge = 0; a.from = null; a.x = DRAIN.x - 30; a.y = POOL.floor - 6; }
    else setMode(a, 'sucked');
  } else if (quiet && a.mode !== 'lounging') lounge(a);
  // Someone is left behind in the puddle: you if you stayed in, otherwise one of the holders, stranded as the water goes.
  if (!(p.player && (a.mode === 'sucked' || a.mode === 'puddle')) && floating.length) {
    const h = floating[Math.floor(p.rng() * floating.length)]!;
    h.stuck = true;
    if (quiet) { h.mode = 'puddle'; h.x = DRAIN.x - 40 + p.rng() * 20; h.y = POOL.floor - 6; }
  }
  p.heli.pending = 0;
}

function land(p: PartyState, pool: PoolState, k: Holder, big: boolean): void {
  k.mode = pool.draining ? 'sucked' : 'floating';
  k.spin = 0;
  k.land = 0;
  splash(pool, k.x, surfaceY(pool, k.x), big ? 18 : 12, big ? 280 : 200);
  p.events.splash = { x: k.x, y: k.y, big };
}

/** `tension` is the round's 1 - 1/x; `growth` (log2 x) paces the slower, long-round content: the crowd and the helicopter. */
export function stepParty(p: PartyState, pool: PoolState, growth: number, running: boolean, tension: number, dt: number): void {
  p.time += dt;
  p.tension = tension;
  p.events.splash = null;
  p.events.heli = p.events.drop = p.events.shutter = false;
  const a = p.avatar;
  a.modeAge += dt;
  a.fear = tension;
  const want = crowdFor(growth);
  if (running && !pool.draining && p.holders.length < MAX_HOLDERS && p.holders.filter((h) => !h.airdropped && h.mode !== 'gone').length < want && !p.holders.some((h) => h.mode === 'jumping' && !h.airdropped)) {
    // The next one runs in along the far deck from off the right edge.
    p.holders.push(newHolder(p, 990, DECK_Y, 'jumping', false, 230 + p.rng() * 520));
  }
  // The helicopter: launches a pass it owes, tips a degen out at each drop mark, and leaves off the right.
  const h = p.heli;
  if (!h.active && h.pending > 0 && running && !pool.draining) {
    h.active = true;
    h.x = HELI.from;
    h.drops = 0;
    h.pending -= 1;
    p.events.heli = true;
    if (p.holders.length >= MAX_HOLDERS) {
      // A full pool: the three floating nearest the far side swim out and leave by the deck, freeing slots for the drops.
      for (const guest of p.holders.filter((k) => k.mode === 'floating').sort((m, n) => n.x - m.x).slice(0, 3)) { guest.mode = 'leaving'; guest.t = 0; }
    }
  }
  if (h.active) {
    // Once the plug is out the pilot wants no part of it and leaves at full throttle.
    h.x += HELI.speed * (pool.draining ? 2.6 : 1) * dt;
    if (h.drops < HELI.drops.length && h.x >= HELI.drops[h.drops]!) {
      const open = running && !pool.draining;
      const slot = p.holders.length < MAX_HOLDERS ? null : p.holders.find((k) => k.mode === 'gone');
      // A full pool holds the drop until a leaving guest's slot is free; past the far end the pass gives it up.
      if (!open || slot !== undefined || h.x > POOL.right - 100) {
        if (open && slot !== undefined) {
          const fromX = h.x + 8;
          // Each keeps some of the helicopter's way as it falls, so the drops spread across the pool rather than pile up behind.
          const jumper = newHolder(p, fromX, HELI.y + 24, 'jumping', true, clamp(fromX + 70 + (p.rng() - 0.5) * 80, POOL.left + 40, POOL.right - 40));
          if (slot) Object.assign(slot, jumper); else p.holders.push(jumper);
          if (h.drops === 0) p.events.drop = true;
        }
        h.drops += 1;
      }
    }
    if (h.x > HELI.to) h.active = false;
  }
  for (const [i, k] of p.holders.entries()) {
    k.row = i % 3;
    k.glance += dt;
    k.land += dt;
    k.sayAt += dt;
    switch (k.mode) {
      case 'jumping': {
        if (k.airdropped) {
          // Straight down out of the helicopter, flailing, into a bigger splash.
          k.t += dt / 0.8;
          const t = clamp(k.t, 0, 1);
          k.x = mix(k.fromX, k.toX, t);
          k.y = mix(k.fromY, surfaceY(pool, k.toX) - 4, t * t);
          k.spin = t * 6.3 * (k.toX > k.fromX ? 1 : -1);
          if (k.t >= 1) land(p, pool, k, true);
          break;
        }
        // The run in along the deck (easing to a stop at the rim), a crouch, then a tucked cannonball arc.
        k.t += dt;
        if (k.t < RUN_S) {
          const x = mix(k.fromX, TAKEOFF_X, 1 - (1 - k.t / RUN_S) ** 2);
          k.walk += k.x - x;
          k.x = x;
          k.y = DECK_Y + groundAt(x) - DECK;
        } else if (k.t < RUN_S + CROUCH_S) {
          k.x = TAKEOFF_X;
          k.y = DECK_Y - 6 + 5 * smoothstep(0, CROUCH_S, k.t - RUN_S);
        } else {
          const u = clamp((k.t - RUN_S - CROUCH_S) / AIR_S, 0, 1);
          k.x = mix(TAKEOFF_X, k.toX, u);
          k.y = mix(DECK_Y - 1, surfaceY(pool, k.toX) - 4, u) - Math.sin(u * Math.PI) * 110;
          k.spin = -0.45 * Math.sin(u * Math.PI);
          if (u >= 1) land(p, pool, k, false);
        }
        break;
      }
      case 'floating': {
        k.x += Math.sin(p.time * 0.5 + k.phase) * 6 * dt;
        k.x = clamp(k.x, POOL.left + 30, POOL.right - 30);
        k.y = surfaceY(pool, k.x) - 4 + Math.sin(p.time * 2 + k.phase) * 2;
        // Each cracks on their own nerve, and glances at the dev when they do.
        const nerve = nerveFor(tension, k.tone);
        if (nerve > k.mood) { k.mood = nerve; k.glance = 0; }
        break;
      }
      case 'leaving': {
        // Swims for the far wall, climbs out and jogs off along the deck, picking up speed as it sets off.
        k.t += dt;
        const out = climbOut(k), v = mix(260, 200, out) * smoothstep(-0.05, 0.3, k.t);
        k.x += v * dt;
        k.walk += v * dt;
        // A runner turning back on the deck straightens up out of any crouch.
        const deckY = DECK_Y + groundAt(k.x) - DECK;
        k.y = k.deck ? mix(k.fromY, deckY, smoothstep(0, 0.15, k.t)) : mix(surfaceY(pool, Math.min(k.x, POOL.right - 30)) - 4, deckY, out);
        if (k.x > 990) k.mode = 'gone';
        break;
      }
      case 'sucked': {
        const pull = drainPull(pool, k.x);
        k.x += ((k.stuck ? DRAIN.x - 40 : DRAIN.x) - k.x) * pull * 2.2 * dt;
        k.y = surfaceY(pool, k.x) - 4;
        k.spin += pull * 9 * dt * (k.stuck ? 1 - pool.drained : 1);
        if (k.stuck) { if (pool.drained >= 0.9) k.mode = 'puddle'; break; }
        if (Math.abs(k.x - DRAIN.x) < 40 && pool.drained > 0.2) k.scale = Math.max(0, k.scale - dt * 1.6);
        if (k.scale <= 0.02) k.mode = 'gone';
        break;
      }
      case 'puddle':
        // Settles onto the floor as the last of the water goes, turning upright.
        k.y += (POOL.floor - 6 - k.y) * (1 - Math.exp(-8 * dt));
        k.spin = wrap(k.spin) * Math.exp(-6 * dt);
        break;
      case 'fading':
        k.t += dt;
        if (k.t > 0.35) k.mode = 'gone';
        break;
      case 'gone':
        break;
    }
    const glancing = k.mode === 'floating' && k.glance >= 0 && k.glance < 0.75;
    const face = k.mode === 'leaving' ? 1 : k.mode === 'jumping' && !k.airdropped ? -1 : glancing ? 1 : k.x > 480 ? -1 : 1;
    k.face += clamp(face - k.face, -dt * 13, dt * 13);
    k.rise += ((k.mode === 'floating' ? k.row * 7 : 0) - k.rise) * (1 - Math.exp(-8 * dt));
  }
  a.enter += dt;
  if (a.enter >= DROP_S && a.enter - dt < DROP_S) { splash(pool, a.x, surfaceY(pool, a.x), 14, 240); p.events.splash = { x: a.x, y: a.y, big: true }; }
  stepSpring(a.seat, p.player ? 1 : 0, 11, 0.5, dt);
  a.face += clamp((a.mode === 'walking' ? -1 : 1) - a.face, -dt * 13, dt * 13);
  switch (a.mode) {
    case 'floating':
      a.x = 480 + Math.sin(p.time * 0.4) * 10;
      a.y = surfaceY(pool, a.x) - 6;
      break;
    case 'paddling': {
      // The strokes ramp up, then ease into the ladder.
      const v = Math.min(230 * smoothstep(-0.05, 0.3, a.modeAge), Math.max(40, (a.x - LADDER_X - 22) * 6));
      const x = Math.max(LADDER_X + 22, a.x - v * dt);
      a.walk += a.x - x;
      a.x = x;
      a.y = surfaceY(pool, a.x) - 6;
      if (a.x <= LADDER_X + 22) { a.climbFrom = { x: a.x, y: a.y }; setMode(a, 'climbing'); p.floatie = { x: a.x, spin: 0, scale: 1, alpha: 1, fading: false, age: 0 }; }
      break;
    }
    case 'climbing': {
      const from = a.climbFrom ?? { x: a.x, y: a.y };
      a.x = mix(from.x, LADDER_X, smoothstep(0, 0.35, a.modeAge));
      a.y = Math.max(POOL.top - 30, from.y - climbRise(a.modeAge));
      if (a.y <= POOL.top - 30) { setMode(a, 'walking'); a.walk = 0; }
      break;
    }
    case 'walking': {
      // Off the ladder and onto the lounger, easing in and out; the feet are driven by the distance walked.
      const v = Math.min(150 * smoothstep(-0.05, 0.25, a.modeAge), Math.max(30, (a.x - SAFE_LOUNGER.x) * 6));
      const x = Math.max(SAFE_LOUNGER.x, a.x - v * dt);
      a.y = POOL.top - 30;
      a.walk += a.x - x;
      a.x = x;
      if (a.x <= SAFE_LOUNGER.x) setMode(a, 'lounging');
      break;
    }
    case 'lounging':
      a.x = SAFE_LOUNGER.x;
      a.y = mix(POOL.top - 30, POOL.top - 26, smoothstep(0, 0.25, a.modeAge));
      stepSpring(a.shades, 1, 12, 0.5, dt);
      break;
    case 'sucked': {
      // The flamingo spins toward the drain and deflates down it; whoever rode it is left in the puddle.
      const pull = drainPull(pool, a.x);
      a.x += (DRAIN.x - 30 - a.x) * pull * 2 * dt;
      a.y = surfaceY(pool, a.x) - 6;
      a.spin += pull * 8 * dt * (1 - pool.drained);
      if (pool.drained > 0.3) a.scale = Math.max(0, a.scale - dt * 1.4);
      if (pool.drained >= 0.9) setMode(a, 'puddle');
      break;
    }
    case 'puddle':
      a.y += (POOL.floor - 6 - a.y) * (1 - Math.exp(-8 * dt));
      a.spin = wrap(a.spin) * Math.exp(-6 * dt);
      break;
  }
  if (p.ghost && (p.ghostAge += dt) > 0.35) p.ghost = null;
  const f = p.floatie;
  if (f) {
    f.age += dt;
    if (pool.draining) {
      const pull = drainPull(pool, f.x);
      f.x += (DRAIN.x - f.x) * pull * 2.2 * dt;
      f.spin += pull * 8 * dt;
      if (Math.abs(f.x - DRAIN.x) < 40 && pool.drained > 0.2) f.scale = Math.max(0, f.scale - dt * 1.6);
    } else f.x = Math.min(POOL.right - 60, f.x + 8 * smoothstep(0, 1, f.age) * dt);
    if (f.fading) f.alpha -= dt / 0.35;
    if (f.alpha <= 0 || f.scale <= 0.02) p.floatie = null;
  }
  // The dev: sits up with the chain wound round his fist as the number climbs (the wind-up the pull pays off),
  // yanks it, then steps to the rim for a selfie with the empty pool before he strolls off with the bag.
  const d = p.dev;
  d.modeAge += dt;
  d.fake += dt;
  d.up = clamp(d.up + dt * (d.mode === 'lounging' ? -4 : 9), 0, 1);
  stepSpring(d.lean, d.mode === 'lounging' && running ? leanFor(tension) : 0, 4, 0.7, dt);
  stepSpring(d.grin, d.mode === 'lounging' ? tension : 1, 3, 0.8, dt);
  stepSpring(d.yank, 0, 8, 0.5, dt);
  stepSpring(d.tug, 0, 28, 0.45, dt);
  // Paced so the gloat, the selfie and its flash all land inside the two-second crashed phase.
  if (d.mode === 'standing' && d.modeAge > 0.6) { d.mode = 'selfie'; d.modeAge = 0; }
  if (d.mode === 'selfie') {
    d.x += (DEV_LOUNGER.x - 30 - d.x) * (1 - Math.exp(-dt * 6));
    stepSpring(d.phone, d.modeAge > 0.1 ? 1 : 0, 9, 0.45, dt);
    if (d.modeAge >= 0.6 && !d.snapped) { d.snapped = true; d.flash = 1; p.events.shutter = true; }
    if (d.modeAge > 1.3) { d.mode = 'leaving'; d.modeAge = 0; }
  } else stepSpring(d.phone, 0, 9, 0.6, dt);
  d.flash = Math.max(0, d.flash - dt / 0.35);
  if (d.mode === 'leaving') d.x += 150 * smoothstep(0, 0.3, d.modeAge) * dt;
  if (d.mode === 'returning') {
    // Back to his lounger for the next round, easing to a stop before he lies down.
    const v = Math.min(150 * smoothstep(-0.05, 0.3, d.modeAge), Math.max(25, Math.abs(d.x - DEV_LOUNGER.x) * 6)) * dt;
    d.x = d.x > DEV_LOUNGER.x ? Math.max(DEV_LOUNGER.x, d.x - v) : Math.min(DEV_LOUNGER.x, d.x + v);
    if (d.x === DEV_LOUNGER.x) { d.mode = 'lounging'; d.modeAge = 0; }
  }
  // He turns round for the selfie and back again, and his lines fade in and out rather than pop.
  d.face += clamp((d.mode === 'selfie' ? 1 : -1) - d.face, -dt * 13, dt * 13);
  const say = d.mode === 'selfie' ? 'say RUGGED' : (d.mode === 'standing' || d.mode === 'leaving') && d.x < 960 + 16 ? 'thx for the liquidity' : d.mode === 'lounging' && d.fake > 0.3 && d.fake < 1.5 ? d.quip : '';
  if (say) d.line = say;
  d.talk = clamp(d.talk + (say ? dt : -dt) / 0.15, 0, 1);
  p.whaleFlash = pool.whale.active && pool.whale.t < 1.5 ? 1 : Math.max(0, p.whaleFlash - dt * 1.5);
  // The lifeguard sign swings with the breeze and gets knocked by every splash.
  if (p.events.splash) p.sign.v += (p.events.splash.big ? 2.4 : 1.2) * (p.rng() > 0.5 ? 1 : -1);
  stepSpring(p.sign, gust(p.time, 2) * 0.05 * (0.3 + p.tension), 6, 0.2, dt);
  for (const c of p.confetti) {
    c.age += dt;
    c.vy += 420 * dt;
    c.vx *= Math.exp(-1.5 * dt);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }
  p.confetti = p.confetti.filter((c) => c.age < c.life);
}

/**
 * A speech bubble whose tail points down at (x, y). The box stays on the canvas, so near an edge the tail
 * slides along its bottom instead of the box running off.
 */
function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 18;
  const left = clamp(x - w / 2, 8, 952 - w);
  const tail = clamp(x, left + 12, left + w - 12);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(left, y - 24, w, 24, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tail - 6, y); ctx.lineTo(tail, y + 8); ctx.lineTo(tail + 6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, left + w / 2, y - 8);
  ctx.restore();
}

/** A shared world-space pose keeps the chain, fist and fixed-length arm on one socket. */
export function devArmPose(p: PartyState) {
  const d = p.dev, lean = clamp(d.lean.x, 0, 1), lounging = d.mode === 'lounging', up = smoothstep(0, 1, d.up);
  const tremble = lounging ? lean * lean * smoothstep(0.4, 0.85, p.tension) : 0;
  const jx = (noise(Math.floor(p.time * 31)) - 0.5) * 4 * tremble;
  const jy = (noise(Math.floor(p.time * 29) + 7) - 0.5) * 3 * tremble;
  // A fake yank snaps the wrist up and back; each tug twitches it toward him. Getting up blends the lounger pose into his feet.
  const fake = lounging ? fakePull(p) : 0, tug = d.tug.x;
  const body = { x: d.x + jx + 4 * fake, y: mix(DEV_LOUNGER.y - 26 - 20 * lean, DEV_LOUNGER.y - 44, up) + jy - 6 * fake };
  const spin = (-0.25 + 0.5 * lean) * (1 - up);
  const shoulder = { x: body.x - 10 * Math.cos(spin), y: body.y - 10 * Math.sin(spin) };
  const wrist = {
    x: mix(d.x - 36 - 22 * lean + tug + 14 * fake, d.x - 26, up) + jx,
    y: mix(DEV_LOUNGER.y - 28 - 34 * lean - 0.4 * tug - 28 * fake, DEV_LOUNGER.y - 62 - clamp(d.yank.x, 0, 30), up) + jy,
  };
  const dx = wrist.x - shoulder.x, dy = wrist.y - shoulder.y, reach = Math.hypot(dx, dy);
  const along = (34 * 34 - 36 * 36 + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, 34 * 34 - along * along));
  const elbow = { x: shoulder.x + dx / reach * along - dy / reach * bend, y: shoulder.y + dy / reach * along + dx / reach * bend };
  return { body, spin, shoulder, elbow, wrist };
}
/** Use the same rail spacing and rung origin as the pool foreground. */
export function ladderContact(side: number, y: number): { x: number; y: number } {
  const first = POOL.top - 10;
  return { x: LADDER_X + side * 7, y: clamp(first + Math.round((y - first) / 18) * 18, first, first + 7 * 18) };
}

export function devWrist(p: PartyState): { x: number; y: number } {
  return devArmPose(p).wrist;
}

interface WojakLook { tone: number; mood: 'calm' | 'nervous' | 'panic' | 'smug' | 'sad' | 'shock'; shades: number; scale: number; spin: number }

/** Head and shoulders of a Wojak, facing left toward the pool centre or right. */
export function drawWojakBust(ctx: CanvasRenderingContext2D, x: number, y: number, look: WojakLook, facing: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(look.spin);
  // A turn flips through a narrowed bust rather than vanishing edge-on.
  ctx.scale(look.scale * (facing < 0 ? -1 : 1) * Math.max(0.3, Math.abs(facing)), look.scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Shoulders.
  ctx.fillStyle = look.tone > 0.66 ? '#e63946' : look.tone > 0.33 ? '#3b82f6' : '#f2c14e';
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-16, -6, 32, 16, 6); ctx.fill(); ctx.stroke();
  // Head.
  ctx.beginPath(); ctx.ellipse(0, -20, 12, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN; ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  const open = look.mood === 'shock' || look.mood === 'panic' ? 1.5 : look.mood === 'sad' ? 0.6 : 1;
  for (const ex of [2, 8]) { ctx.beginPath(); ctx.ellipse(ex, -23, 1.8, 1.8 * open, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  const brow = look.mood === 'nervous' || look.mood === 'panic' || look.mood === 'sad' ? 1 : look.mood === 'smug' ? -0.6 : 0;
  ctx.beginPath(); ctx.moveTo(-1, -28 + brow); ctx.lineTo(4, -28 - 2 * brow); ctx.moveTo(6, -28 - 2 * brow); ctx.lineTo(11, -28 + brow); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -21); ctx.lineTo(12, -16); ctx.lineTo(8, -15); ctx.stroke();
  ctx.beginPath();
  if (look.mood === 'shock' || look.mood === 'panic') { ctx.ellipse(6, -10, 3, 3.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (look.mood === 'sad') { ctx.moveTo(2, -9); ctx.quadraticCurveTo(6, -13, 10, -9); }
  else if (look.mood === 'smug') { ctx.moveTo(2, -11); ctx.quadraticCurveTo(7, -6, 11, -12); }
  else { ctx.moveTo(2, -10); ctx.quadraticCurveTo(6, -8 + (look.mood === 'nervous' ? -2 : 0), 10, -10); }
  ctx.stroke();
  if (look.shades > 0.02) {
    const dy = -30 * (1 - look.shades);
    ctx.fillStyle = INK;
    ctx.fillRect(-1, -26 + dy, 6, 4);
    ctx.fillRect(6, -26 + dy, 6, 4);
    ctx.fillRect(5, -25 + dy, 1.5, 1.5);
  }
  ctx.restore();
}

/** A rubber ring; `squash` (0..1) flattens it for the landing. */
function drawTube(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, scale: number, spin: number, squash = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale * (1 + 0.2 * squash), scale * (1 - 0.2 * squash));
  ctx.strokeStyle = INK; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.ellipse(0, 4, 24, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 8; ctx.stroke();
  ctx.restore();
}

function drawFlamingo(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ff7eb3'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, 6, 38, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-50, -30, -42, -46); ctx.quadraticCurveTo(-36, -58, -26, -50); ctx.lineTo(-24, -40); ctx.quadraticCurveTo(-34, -30, -22, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.moveTo(-26, -50); ctx.lineTo(-14, -46); ctx.lineTo(-26, -42); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-34, -50, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-33.5, -50, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLounger(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string): void {
  ctx.fillStyle = colour; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(x - 44, y - 16, 88, 12, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 44, y - 12); ctx.lineTo(x - 56, y - 44); ctx.lineTo(x - 30, y - 40); ctx.lineTo(x - 24, y - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  for (const dx of [-36, 36]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 4); ctx.lineTo(x + dx, y + 6); ctx.stroke(); }
}

/** The empty lifeguard chair on the near deck, with its sign swinging under the seat. */
function drawLifeguardChair(ctx: CanvasRenderingContext2D, p: PartyState): void {
  const { x, top, seat, foot } = CHAIR;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Posts, braces and the little ladder up the right post.
  ctx.strokeStyle = INK; ctx.lineWidth = 7;
  for (const dx of [-26, 26]) { ctx.beginPath(); ctx.moveTo(x + dx, foot); ctx.lineTo(x + dx, seat); ctx.stroke(); }
  ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 4;
  for (const dx of [-26, 26]) { ctx.beginPath(); ctx.moveTo(x + dx, foot); ctx.lineTo(x + dx, seat); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 26, foot - 30); ctx.lineTo(x + 26, seat + 40); ctx.moveTo(x + 26, foot - 30); ctx.lineTo(x - 26, seat + 40); ctx.stroke();
  for (let y = seat + 30; y < foot - 8; y += 16) { ctx.beginPath(); ctx.moveTo(x + 26, y); ctx.lineTo(x + 44, y); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x + 44, seat + 22); ctx.lineTo(x + 44, foot); ctx.stroke();
  // The seat with its red and white stripe, and the backrest.
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x - 32, seat - 2, 64, 20, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 28, seat + 4, 56, 7);
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.roundRect(x - 30, top, 60, seat - top + 2, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('LIFEGUARD', x, (top + seat) / 2 + 1, 54);
  // The sign hangs from the seat on two strings and swings about the seat's underside.
  ctx.translate(x, seat + 18);
  ctx.rotate(clamp(p.sign.x, -0.35, 0.35));
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-30, 16); ctx.moveTo(22, 0); ctx.lineTo(30, 16); ctx.stroke();
  ctx.fillStyle = '#fbf8f1'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-38, 16, 76, 34, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.fillText('NO LIFEGUARD', 0, 27, 70);
  ctx.fillStyle = INK;
  ctx.font = '900 11px Impact, "Arial Black", sans-serif';
  ctx.fillText('(HE SOLD)', 0, 41, 70);
  ctx.restore();
}

export function drawDeckProps(ctx: CanvasRenderingContext2D, p: PartyState, beat: number): void {
  // DJ booth at the back of the pool with pulsing speakers.
  const DJ_X = 485;
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(DJ_X - 55, POOL.top - 60, 110, 52, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff5d9e';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LP', DJ_X, POOL.top - 30);
  for (const sx of [DJ_X - 41, DJ_X + 41]) {
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath(); ctx.roundRect(sx - 12, POOL.top - 112, 24, 48, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a5560';
    ctx.beginPath(); ctx.arc(sx, POOL.top - 92, 8 + beat * 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, POOL.top - 72, 5 + beat * 2, 0, Math.PI * 2); ctx.fill();
  }
  drawWojakBust(ctx, DJ_X, POOL.top - 66 - 3 * beat, { tone: 0.5, mood: 'smug', shades: 1, scale: 1, spin: 0 }, 1);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(DJ_X, POOL.top - 88, 13, Math.PI, Math.PI * 2); ctx.stroke();
  // Loungers: the dev's and the safe one, and the lifeguard chair nobody is in.
  drawLounger(ctx, DEV_LOUNGER.x, DEV_LOUNGER.y, '#f2c14e');
  drawLounger(ctx, SAFE_LOUNGER.x, SAFE_LOUNGER.y, '#8fd3ff');
  drawLifeguardChair(ctx, p);
}

/** The AIRDROP helicopter across the sunset, with a degen in the door, drawn between the sky and the pool. */
export function drawHelicopter(ctx: CanvasRenderingContext2D, p: PartyState): void {
  const h = p.heli;
  if (!h.active) return;
  const y = HELI.y + Math.sin(p.time * 3) * 3;
  ctx.save();
  ctx.translate(h.x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // The banner on a rope off the tail, fluttering.
  const bx = -128;
  const flutter = Math.sin(p.time * 9) * 3;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-62, 0); ctx.quadraticCurveTo(-90, 6, bx + 40, 4 + flutter); ctx.stroke();
  ctx.fillStyle = '#ffe27a'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx - 40, -6 - flutter); ctx.lineTo(bx + 40, -6 + flutter); ctx.lineTo(bx + 40, 14 + flutter); ctx.lineTo(bx - 40, 14 - flutter); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 13px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('AIRDROP', bx, 4, 72);
  // Tail boom and its rotor.
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-70, -6, 52, 11, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-66, -6); ctx.lineTo(-62, -20); ctx.lineTo(-54, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3;
  const tail = Math.sin(p.time * 41);
  ctx.beginPath(); ctx.moveTo(-64, -14 - 10 * tail); ctx.lineTo(-64, -14 + 10 * tail); ctx.stroke();
  // Skids.
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-30, 30); ctx.lineTo(30, 30); ctx.moveTo(-18, 18); ctx.lineTo(-18, 30); ctx.moveTo(18, 18); ctx.lineTo(18, 30); ctx.stroke();
  // Body, the open door with a degen leaning out, and the cockpit glass.
  ctx.fillStyle = '#3b82f6'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 2, 38, 21, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.roundRect(-16, -8, 22, 24, 3); ctx.fill(); ctx.stroke();
  drawWojakBust(ctx, -3, 12, { tone: 0.1, mood: 'smug', shades: 1, scale: 0.7, spin: 0 }, 1);
  ctx.fillStyle = 'rgba(200, 240, 255, 0.85)';
  ctx.beginPath(); ctx.ellipse(20, -4, 15, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Mast and the main rotor: a blurred disc and the spinning blades.
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(0, -30); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath(); ctx.ellipse(0, -30, 62, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  {
    const b = Math.cos(p.time * 38);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-62 * b, -30); ctx.lineTo(62 * b, -30); ctx.stroke();
  }
  ctx.restore();
}

/** A holder in or under the water draws its legs and ring behind the water; a runner or a leaver on the deck draws them in front. */
const inWater = (h: Holder): boolean => h.mode === 'floating' || h.mode === 'sucked' || h.mode === 'puddle' || h.mode === 'fading' || (h.mode === 'leaving' && !h.deck && h.x < POOL.right);
const holderAlpha = (h: Holder): number => (h.mode === 'fading' ? clamp(1 - h.t / 0.35, 0, 1) : 1);
/** Back rows first, then left to right, so a nearer bust always overlaps a farther one. */
const byDepth = (p: PartyState): Holder[] => p.holders.filter((h) => h.mode !== 'gone').sort((m, n) => n.row - m.row || m.x - n.x);
/** The flamingo's fall from above into a fresh round. */
const dropY = (a: Avatar): number => (a.enter < DROP_S ? -460 * (1 - (a.enter / DROP_S) ** 2) : 0);

/** Two equal bones from root to end with the middle joint bent to side `b`; an end out of reach falls short rather than stretch. */
function limb(ctx: CanvasRenderingContext2D, rx: number, ry: number, ex: number, ey: number, len: number, b: number): void {
  let dx = ex - rx, dy = ey - ry;
  const d = Math.max(0.001, Math.hypot(dx, dy));
  if (d > 2 * len) { dx *= 2 * len / d; dy *= 2 * len / d; }
  const dd = Math.min(d, 2 * len), h = Math.sqrt(Math.max(0, len * len - dd * dd / 4)) * b;
  ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + dx / 2 - dy / dd * h, ry + dy / 2 + dx / dd * h); ctx.lineTo(rx + dx, ry + dy); ctx.stroke();
}

/** A foot's lead along the direction of travel and its lift, from the distance walked: a planted foot stays put on the ground. */
function gait(dist: number, stride: number, side: number): { dx: number; lift: number } {
  const u = fract(dist / stride + (side > 0 ? 0.5 : 0));
  return u < 0.5 ? { dx: stride / 4 - u * stride, lift: 0 } : { dx: (u - 0.75) * stride, lift: Math.sin((u - 0.5) * TAU) };
}

/** A holder's stubby legs below the ring, in its own rotated frame: running, crouched, tucked, flailing, jogging or dangling. */
function drawHolderBody(ctx: CanvasRenderingContext2D, p: PartyState, h: Holder): void {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.spin);
  ctx.scale(h.scale, h.scale);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ground = groundAt(h.x) - h.y;
  for (const s of [-1, 1]) {
    let fx = s * 5 + Math.sin(p.time * 1.5 + h.phase + s) * 3, fy = 30, b = 1;
    if (h.mode === 'jumping' && h.airdropped) { fx = s * 8 + Math.sin(h.t * 24 + s * 2) * 4; fy = 28 + Math.cos(h.t * 24 + s) * 3; b = s; }
    else if (h.mode === 'jumping' && h.t < RUN_S + CROUCH_S) { const g = gait(h.walk, 32, s); fx = s * 4 - g.dx; fy = ground - 4 * g.lift; }
    else if (h.mode === 'jumping') {
      const u = clamp((h.t - RUN_S - CROUCH_S) / AIR_S, 0, 1), tuck = smoothstep(0, 0.2, u) * (1 - smoothstep(0.8, 1, u));
      fx = mix(s * 5, -6 + 2 * s, tuck); fy = mix(28, 17, tuck);
    } else if (h.mode === 'leaving') {
      // The knees swing through straight as a swimmer climbs out, or turn with a runner heading back.
      const g = gait(h.walk, 32, s), out = climbOut(h);
      fx = mix(fx, s * 4 + g.dx, out); fy = mix(fy, ground - 4 * g.lift, out); b = h.deck ? -h.face : 1 - 2 * out;
    } else if (h.mode !== 'floating') continue;
    limb(ctx, s * 5, 14, fx, fy, 10, b);
  }
  ctx.restore();
  drawTube(ctx, h.x, h.y, h.tube, h.scale, h.spin, Math.max(0, 1 - h.land / 0.12));
}

export function drawHoldersBehind(ctx: CanvasRenderingContext2D, p: PartyState, pool: PoolState): void {
  // Rings and dangling legs float on and under the water; the water is drawn between this layer and the fronts.
  for (const h of byDepth(p)) {
    if (!inWater(h)) continue;
    ctx.globalAlpha = holderAlpha(h);
    drawHolderBody(ctx, p, h);
  }
  for (const a of [p.ghost, p.avatar]) {
    if (!a || !(a.mode === 'floating' || a.mode === 'paddling' || a.mode === 'sucked')) continue;
    ctx.globalAlpha = a === p.ghost ? clamp(1 - p.ghostAge / 0.35, 0, 1) : 1;
    drawFlamingo(ctx, a.x, a.y + dropY(a), a.scale, a.spin);
  }
  const f = p.floatie;
  if (f) {
    ctx.globalAlpha = clamp(f.alpha, 0, 1);
    // It rides where you left it and only then starts to bob.
    drawFlamingo(ctx, f.x, surfaceY(pool, f.x) - 6 + Math.sin(f.age * 2.3) * 1.5, f.scale, f.spin);
  }
  ctx.globalAlpha = 1;
}

/** The cash-out confetti, over everything in the yard. */
export function drawConfetti(ctx: CanvasRenderingContext2D, p: PartyState): void {
  for (const c of p.confetti) {
    ctx.globalAlpha = clamp(1.5 * (1 - c.age / c.life), 0, 1);
    ctx.fillStyle = c.colour;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.spin + c.age * 5);
    ctx.fillRect(-c.r, -c.r * 0.5, c.r * 2, c.r);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** How far the climb has risen: 72 px/s after the 0.35 s reach for the ladder, easing up to speed. */
const climbRise = (age: number): number => { const t = Math.max(0, age - 0.35); return 72 * (t - 0.12 * (1 - Math.exp(-t / 0.12))); };
/** Each limb's rung band about the body (relative to its start), chosen so all four share one rung phase: hands above the shoulders, feet below the hips. */
const CLIMB_BAND = { hand: [-34.5, -25.5], foot: [6, 15] };

/** A support contact stays on its rung while the opposite limb reaches; the body rises a rung per quarter second. */
export function climbContact(a: Avatar, side: number, hand: boolean): { x: number; y: number } {
  const from = a.climbFrom ?? { x: a.x, y: a.y };
  const offset = (side > 0 ? 0.5 : 0) + (hand ? 0.25 : 0);
  // The body starts anywhere between rungs: shift every limb's clock by the same residual so each works within its band.
  const base = from.y + 24, residual = ladderContact(-1, base).y - base;
  const clock = climbRise(a.modeAge) / 18 + offset + residual / 18;
  const cycle = Math.floor(clock), reach = smoothstep(0.55, 1, clock - cycle);
  const start = from.y + CLIMB_BAND[hand ? 'hand' : 'foot'][side > 0 ? 1 : 0]! + 18 * offset + residual;
  const first = POOL.top - 10;
  return { x: LADDER_X + side * 7 + side * Math.sin(Math.PI * reach) * 6, y: clamp(start - 18 * (cycle + reach), hand ? first - 14 : first, first + 7 * 18) };
}

const ARM = 15;
const LEG = 16;
/** Shoulder and hip sockets on the avatar's bust (scale 1.15): arms then legs, left then right. */
const ROOTS = [{ x: -14, y: -12 }, { x: 14, y: -12 }, { x: -6, y: 1 }, { x: 6, y: 1 }];

/** Where each limb reaches in the avatar's mode, relative to the body; a limb that is put away sits at its socket. */
function avatarRig(a: Avatar): End[] {
  const rig = ROOTS.map((r) => ({ x: r.x, y: r.y, b: 1 }));
  for (const [i, s] of [-1, 1].entries()) {
    const arm = rig[i]!, leg = rig[i + 2]!;
    if (a.mode === 'paddling') {
      const ph = a.walk / 230 * 8 + (s > 0 ? Math.PI : 0);
      Object.assign(arm, { x: s * (20 + 6 * Math.sin(ph)), y: 2 + 7 * Math.cos(ph), b: -s });
    } else if (a.mode === 'climbing') {
      const hand = climbContact(a, s, true), foot = climbContact(a, s, false);
      Object.assign(arm, { x: hand.x - a.x, y: hand.y - a.y, b: s });
      Object.assign(leg, { x: foot.x - a.x, y: foot.y - a.y, b: -s });
    } else if (a.mode === 'walking') {
      // Feet planted on the rim, then the deck a step lower, and the arms swinging against them.
      const g = gait(a.walk, 46, s), fx = a.x + s * 4 - g.dx;
      Object.assign(leg, { x: fx - a.x, y: groundAt(fx) - 6 * g.lift - a.y, b: 1 });
      Object.assign(arm, { x: s * 17 + 0.6 * g.dx, y: 6, b: -s });
    } else if (a.mode === 'lounging') {
      Object.assign(leg, { x: 22 + 3 * s, y: 4, b: -1 });
      if (s > 0) Object.assign(arm, { x: 20, y: -18, b: 1 });
    }
  }
  return rig;
}

/** The rig as drawn: a mode change blends from the old limb ends over a quarter second, so nothing pops. */
function rigNow(a: Avatar): End[] {
  const rig = avatarRig(a), w = smoothstep(0, 0.25, a.modeAge), from = a.from;
  return from && w < 1 ? rig.map((e, i) => ({ x: mix(from[i]!.x, e.x, w), y: mix(from[i]!.y, e.y, w), b: mix(from[i]!.b, e.b, w) })) : rig;
}

const MOODS: WojakLook['mood'][] = ['calm', 'nervous', 'panic'];

/** Your degen: limbs, bust (once you have hopped on), the YOU tag, and the lounger kit once you are out. */
function drawAvatar(ctx: CanvasRenderingContext2D, a: Avatar): void {
  const seat = clamp(a.seat.x, 0, 1.3), y = a.y + dropY(a);
  if (seat < 0.02) return;
  if (a.mode === 'puddle') {
    ctx.fillStyle = 'rgba(102, 224, 163, 0.6)';
    ctx.beginPath(); ctx.ellipse(a.x, POOL.floor - 3, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  rigNow(a).forEach((e, i) => { const r = ROOTS[i]!; if (Math.hypot(e.x - r.x, e.y - r.y) > 1) limb(ctx, a.x + r.x, a.y + r.y, a.x + e.x, a.y + e.y, i < 2 ? ARM : LEG, e.b); });
  const mood: WojakLook['mood'] = a.mode === 'sucked' ? 'shock' : a.mode === 'puddle' ? 'sad' : a.mode === 'floating' ? MOODS[nerveFor(a.fear, 0.5)]! : 'smug';
  drawWojakBust(ctx, a.x, y - 10, { tone: 0.9, mood, shades: clamp(a.shades.x, 0, 1), scale: 1.15 * Math.min(1, seat), spin: a.spin }, a.face);
  // The tag steps left of the POOL RULES board while you are up on the deck.
  const lx = a.mode === 'climbing' || a.mode === 'walking' ? Math.min(a.x, 158) : a.x;
  ctx.save(); ctx.globalAlpha *= clamp(seat, 0, 1); ctx.font = '900 16px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f6ff8f'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeText('YOU', lx, y - 58); ctx.fillText('YOU', lx, y - 58); ctx.restore();
  if (a.mode === 'lounging') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(a.x + 14, a.y - 30, 12, 16, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5d9e';
    ctx.fillRect(a.x + 15, a.y - 22, 10, 7);
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.roundRect(a.x - 40, a.y - 8, 26, 8, 2); ctx.fill(); ctx.stroke();
  }
}

export function drawFigures(ctx: CanvasRenderingContext2D, p: PartyState, pool: PoolState): void {
  const order = byDepth(p);
  for (const h of order) {
    ctx.globalAlpha = holderAlpha(h);
    if (!inWater(h)) drawHolderBody(ctx, p, h);
    const mood: WojakLook['mood'] = h.mode === 'sucked' ? 'shock' : h.mode === 'puddle' || h.mode === 'fading' ? 'sad' : h.mode === 'jumping' ? (h.airdropped ? 'panic' : 'smug') : h.mode === 'leaving' ? 'smug' : MOODS[h.mood]!;
    // A flinch as each one cracks, the dip of a landing, and in very long rounds a slow wave through the crowd.
    const hop = h.glance > 0 && h.glance < 0.3 ? Math.sin(Math.PI * h.glance / 0.3) * 4 : 0;
    const dip = Math.max(0, 1 - h.land / 0.12) * 3;
    const ripple = p.elapsed > 45 && !pool.draining && h.mode === 'floating' ? Math.max(0, Math.sin(p.time * 0.52 - h.row - h.x * 0.006)) * 6 : 0;
    drawWojakBust(ctx, h.x, h.y - 8 - h.rise - ripple - hop + dip, { tone: h.tone, mood, shades: 0, scale: h.scale, spin: h.spin }, h.face);
    if (h.mode === 'puddle') {
      ctx.fillStyle = 'rgba(102, 224, 163, 0.6)';
      ctx.beginPath(); ctx.ellipse(h.x, POOL.floor - 3, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (p.ghost) {
    ctx.globalAlpha = clamp(1 - p.ghostAge / 0.35, 0, 1);
    drawAvatar(ctx, p.ghost);
  }
  ctx.globalAlpha = 1;
  drawAvatar(ctx, p.avatar);
  // The dev: lounging with the chain (sitting up and trembling as the number climbs), standing to yank it, the
  // selfie with the empty pool, then strolling off with the bag.
  const d = p.dev;
  const grin = clamp(d.grin.x, 0, 1);
  const lean = clamp(d.lean.x, 0, 1);
  const lounging = d.mode === 'lounging';
  const { body, spin, shoulder, elbow, wrist } = devArmPose(p);
  const devY = body.y;
  // The smirk lands with the DEV IS SMILING caption at 4x.
  drawWojakBust(ctx, body.x, body.y, { tone: 0.2, mood: !lounging || grin > 0.75 || d.fake < 1.5 ? 'smug' : 'calm', shades: 1, scale: 1.15, spin }, d.face);
  ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(wrist.x, wrist.y); ctx.stroke();
  ctx.strokeStyle = SKIN; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = SKIN; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(wrist.x, wrist.y, 5.5 + 1.5 * lean, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (d.up > 0.02) {
    // The bag: at his side once he is up, set down on the deck as he turns for the selfie and picked up as he turns back,
    // and stowed as he lies down again.
    const k = (d.face + 1) / 2, bx = d.x - 70 * k, by = devY + 10 * k;
    ctx.globalAlpha = d.up;
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(bx + 14, by - 2); ctx.quadraticCurveTo(bx + 40, by - 8, bx + 40, by + 18); ctx.quadraticCurveTo(bx + 30, by + 30, bx + 16, by + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c';
    ctx.font = '900 11px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', bx + 30, by + 14);
    ctx.globalAlpha = 1;
  }
  if (d.phone.x > 0.02) {
    // The selfie stick out to the right (it folds away as he turns back), and the flash.
    const k = Math.min(d.phone.x, 1.2);
    const px = d.x + 18 + 30 * k;
    const py = devY - 8 - 26 * k;
    ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(d.x + 12, devY + 2); ctx.lineTo(px - 4, py + 8); ctx.stroke();
    ctx.strokeStyle = SKIN; ctx.lineWidth = 5; ctx.stroke();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-6, -12, 12, 24, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = d.flash > 0.5 ? '#ffffff' : '#8fd3ff';
    ctx.fillRect(-4, -9, 8, 16);
    ctx.restore();
    if (d.flash > 0.02) {
      const g = ctx.createRadialGradient(px, py, 4, px, py, 110);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * d.flash * d.flash})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - 110, py - 110, 220, 220);
    }
  }
  // He gloats from the moment he is on his feet until his head is off the right edge; a fake yank gets its own line.
  if (d.talk > 0.01) bubble(ctx, d.x - 4, devY - 50, d.line, d.talk);
  // The two nearest holders call your exit as you paddle off.
  // A jeer near you rides up over your YOU tag rather than cover it.
  for (const h of order) if (h.say && h.mode === 'floating' && h.sayAt > 0 && h.sayAt < 1.4) bubble(ctx, h.x, h.y - 52 - h.rise - 24 * smoothstep(100, 60, Math.abs(h.x - p.avatar.x)), h.say, clamp(Math.min(h.sayAt, 1.4 - h.sayAt) / 0.12, 0, 1));
  if (p.whaleFlash > 0) {
    ctx.globalAlpha = Math.min(1, p.whaleFlash);
    ctx.font = '900 30px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = INK;
    ctx.strokeText('WHALE ALERT', pool.whale.x, pool.level - 90);
    ctx.fillStyle = '#8fd3ff';
    ctx.fillText('WHALE ALERT', pool.whale.x, pool.level - 90);
    ctx.globalAlpha = 1;
  }
}
