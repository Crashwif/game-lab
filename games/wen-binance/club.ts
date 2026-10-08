/**
 * The club front: THE EXCHANGE marquee with its hype meter and a sign that
 * flickers between LISTING SOON and DELISTING and sheds its letters one at
 * a time as the hype climbs (LISTING SOON, LIST NG S ON), the doors on
 * springs that shake with the bass and crack open on the dance floor, the
 * bouncer with his INSIDERS ONLY clipboard, the suits he waves past, the
 * LISTING FEE plaque by the door, the scalper hawking FAST-TRACK LISTING
 * tickets in the foreground, the taxi for an accepted exit, and the crash:
 * sell the news. Nothing here changes the outcome.
 */
import { type Spring, clamp, fract, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const W = 960;
export const H = 540;
/** The pavement line the queue stands on. */
export const GROUND = 470;
export const DOOR = { x: 640, y: 236, w: 130, h: GROUND - 236 } as const;
export const BOUNCER_X = 600;
/** Where the taxi pulls up for your coin. */
export const KERB = 330;
export type Point = { x: number; y: number };
/** The marquee box and the baseline of its sign. */
const MARQUEE = { x: 540, y: 78, w: 380, h: 96 } as const;
const SIGN_Y = MARQUEE.y + 76;
const SIGN_SIZE = 22;
/**
 * The sign's letters, and the multiplier each one works loose at and drops at: the first two inside the first
 * dozen seconds, then further apart so a long round keeps shedding (the rest hold on until the crash).
 */
const SIGN_TEXT = 'LISTING SOON';
const SIGN_DROPS: Record<number, [number, number]> = { 4: [1.35, 1.8], 9: [1.6, 2.3], 2: [2.6, 3.6], 11: [4.5, 7], 6: [9, 14], 0: [25, 50], 10: [100, 200] };
/** Glyph widths for the sign before a canvas has measured the real font. */
const GLYPH_GUESS: Record<string, number> = { I: 7, L: 11, S: 12, T: 12, N: 14, G: 14, O: 14, D: 14, E: 12, ' ': 6 };
/** Crash seconds (slowed by the hit-stop) at which the DELISTED sign, the house lights and the sign flip land: all inside the 2 s crash hold. */
const DELISTED_AT = 0.75;
const LIGHTS_AT = 0.85;
const FLIP_AT = 1.1;
/** The multiplier the doors first crack at, and the ones the handles rattle at as if the doors were opening (they are not). */
const AJAR_X = 2.33;
const FAKEOUTS = [1.9, 2.75, 4.2];
/** How far the doors stand open in a running round: cracked from 2.33x, wider through the climb, and wider still on a slow log driver for long rounds. */
const ajarAt = (m: number, time: number): number => (m >= AJAR_X ? 0.08 + 0.22 * smoothstep(0.57, 0.9, 1 - 1 / m) + 0.15 * clamp(Math.log10(m) / 3, 0, 1) + 0.05 * Math.sin(time * 1.3) : 0);
/** Stride lengths in local units: a walk (planted 60% of the cycle) and a run (38%, with a flight phase). */
const WALK = 110;
const RUN = 180;

/** A letter of the sign: lit in place, hanging loose from one corner, falling, or lying on the pavement. */
export interface Letter {
  ch: string;
  /** Its left edge from the marquee's centre, and its width, as last laid out. */
  x: number;
  w: number;
  state: 'fixed' | 'loose' | 'falling' | 'down';
  /** The corner it hangs from (-1 left, 1 right) and the swing about it. */
  side: number;
  swing: Spring;
  /** In the world once it falls. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  angle: number;
  va: number;
  landY: number;
  /** Seconds of the crash at which it goes, once everything goes. */
  dropAt: number;
  seed: number;
}

interface Ticket { x: number; y: number; vx: number; vy: number; angle: number; va: number; age: number }

/**
 * The scalper: off, patrolling the foreground with his board, or running for it. `v` eases toward the way he
 * is heading, so he slows, squashes through the turn and sets off again; his feet step on `walked`.
 */
export interface Scalper { x: number; v: number; walked: number; dir: number; mode: 'off' | 'hawking' | 'fleeing'; bubble: string; bubbleAge: number; bubbleAt: number; tickets: Ticket[] }

const SCALPER_LINES = ['psst. skip the line?', 'fast-track tix, cash only', 'tier 1 listing, trust me', 'i know the bouncer', '2 tix left (there are 400)', 'price goes up next candle', 'my cousin is the exchange', 'no refunds, no receipts', 'the fee? that is the fee'];

export interface Suit {
  x: number;
  /** Walking speed in px/s; negative runs left (leaving with the bag). `speed` eases toward it. */
  vx: number;
  speed: number;
  /** Distance covered in px: it drives the feet, so they never skate. */
  walked: number;
  bag: boolean;
  seed: number;
  /** Depth 0..1: drawn smaller and higher when further back on the dance floor. */
  depth: number;
  entering: boolean;
  gone: boolean;
}

export interface Club {
  time: number;
  /** Doors ajar 0..1. */
  doors: Spring;
  /** Bass thump 0..1, driven each beat. */
  thump: Spring;
  lookDown: Spring;
  headShake: Spring;
  wave: Spring;
  signFlip: Spring;
  lights: Spring;
  /** The half-beat last kicked on the score's grid. */
  half: number;
  /** The marquee bulbs' chase, integrated so its speed can climb without the pattern jumping. */
  chase: number;
  /** The displayed multiplier, for what the hype drives directly (the dancers slipping out the back). */
  mult: number;
  /** The doors have cracked this round; fake-out rattles used so far. */
  cracked: boolean;
  fakes: number;
  /** The NO JEETS poster flashing as your coin leaves the line, 1 down to 0. */
  jeet: number;
  suits: Suit[];
  /** Flicker state for the marquee text: 0 LISTING SOON, 1 LISTING, 2 DELISTING. */
  flicker: number;
  crashed: boolean;
  crashAge: number;
  taxiX: Spring;
  taxi: boolean;
  /** Suits waved past so far. */
  waved: number;
  strobe: number;
  letters: Letter[];
  /** The sign's glyph widths, measured on the first draw. */
  glyphs: Record<string, number>;
  scalper: Scalper;
  /** The listing fee on the plaque and the scalper's ticket price, from the multiplier. */
  fee: number;
  /** The bouncer's recoil when the doors burst. */
  flinch: Spring;
  /** The handles jiggle on the fuse between the crash frame and the doors bursting. */
  rattle: number;
  /** What happened this step, for the scene's sound and the line: `kick` is the bass hit's strength, 0 for none. */
  events: { enter: boolean; shake: boolean; letterLoose: boolean; letterDrop: boolean; letterDown: boolean; ajar: boolean; fake: boolean; kick: number };
}

function createLetters(): Letter[] {
  return Array.from(SIGN_TEXT, (ch, i) => ({ ch, x: 0, w: GLYPH_GUESS[ch] ?? 12, state: 'fixed' as const, side: noise(i * 3.3) > 0.5 ? 1 : -1, swing: spring(0), px: 0, py: 0, vx: 0, vy: 0, angle: 0, va: 0, landY: GROUND + 6 + noise(i * 7.1) * 26, dropAt: Infinity, seed: noise(i * 5.7) }));
}

const noEvents = (): Club['events'] => ({ enter: false, shake: false, letterLoose: false, letterDrop: false, letterDown: false, ajar: false, fake: false, kick: 0 });

export function createClub(): Club {
  return {
    time: 0, doors: spring(0), thump: spring(0), lookDown: spring(0), headShake: spring(0), wave: spring(0), signFlip: spring(0), lights: spring(0), half: -1, chase: 0, mult: 1, cracked: false, fakes: 0, jeet: 0, suits: [], flicker: 0, crashed: false, crashAge: 0, taxiX: spring(W + 260), taxi: false, waved: 0, strobe: 0,
    letters: createLetters(), glyphs: {}, scalper: { x: -60, v: 0, walked: 0, dir: 1, mode: 'off', bubble: '', bubbleAge: 10, bubbleAt: 0, tickets: [] }, fee: 5, flinch: spring(0), rattle: 0, events: noEvents(),
  };
}

export function resetClub(c: Club): void {
  settleSpring(c.doors, 0);
  settleSpring(c.thump, 0);
  settleSpring(c.lookDown, 0);
  settleSpring(c.headShake, 0);
  settleSpring(c.wave, 0);
  settleSpring(c.signFlip, 0);
  settleSpring(c.lights, 0);
  c.suits = [];
  c.flicker = 0;
  c.crashed = false;
  c.crashAge = 0;
  settleSpring(c.taxiX, W + 260);
  c.taxi = false;
  c.waved = 0;
  c.strobe = 0;
  c.mult = 1;
  c.cracked = false;
  c.fakes = 0;
  c.jeet = 0;
  c.letters = createLetters();
  // The scalper walks off on his own if he was still around.
  if (c.scalper.mode !== 'off') c.scalper.mode = 'fleeing';
  c.scalper.tickets = [];
  c.fee = 5;
  settleSpring(c.flinch, 0);
  c.rattle = 0;
}

/** Lays the sign's letters out about the marquee's centre with the widths known so far. */
function layoutLetters(c: Club): void {
  const widthOf = (ch: string): number => c.glyphs[ch] ?? GLYPH_GUESS[ch] ?? 12;
  const total = c.letters.reduce((sum, l) => sum + widthOf(l.ch), 0);
  let x = -total / 2;
  for (const l of c.letters) {
    l.x = x;
    l.w = widthOf(l.ch);
    x += l.w;
  }
}

/** A letter lets go of the marquee. */
function dropLetter(c: Club, l: Letter): void {
  l.state = 'falling';
  l.px = MARQUEE.x + MARQUEE.w / 2 + l.x;
  l.py = SIGN_Y - 6;
  // Letters drift in toward the doorway, so none ends up under the readout or on the bouncer's head.
  l.vx = (l.x < 0 ? 1 : -1) * (20 + 70 * l.seed);
  l.vy = -60;
  l.angle = l.swing.x;
  l.va = (l.seed - 0.5) * 9;
  c.events.letterDrop = true;
}

/** Joins a round already in progress: the suits already inside are inside, and the letters the hype has shaken off are on the pavement. */
export function settleClub(c: Club, waved: number, multiplier = 1): void {
  c.waved = waved;
  c.mult = multiplier;
  layoutLetters(c);
  for (const [i, l] of c.letters.entries()) {
    const drops = SIGN_DROPS[i];
    if (!drops) continue;
    if (multiplier >= drops[1]) {
      l.state = 'down';
      l.px = MARQUEE.x + MARQUEE.w / 2 + l.x + (l.x < 0 ? 1 : -1) * (30 + 60 * l.seed);
      l.py = l.landY;
      l.angle = (l.seed - 0.5) * 2.4;
    } else if (multiplier >= drops[0]) {
      l.state = 'loose';
      settleSpring(l.swing, l.side * 0.42);
    }
  }
  // Beats already past stay past: no rattle or creak replays for a round joined late.
  c.fakes = FAKEOUTS.filter((x) => multiplier >= x).length;
  c.cracked = multiplier >= AJAR_X;
  settleSpring(c.doors, ajarAt(multiplier, c.time));
  if (multiplier > SCALPER_X) {
    const sc = c.scalper;
    sc.mode = 'hawking'; sc.x = 180 + 100 * noise(waved * 2.1); sc.dir = 1; sc.v = 48 + 30 * (1 - 1 / multiplier); sc.bubbleAt = c.time + 1.5;
  }
}

/** The multiplier the scalper shows up at (about 3 s in), and his size: small enough that his beanie stays under the line's faces. */
const SCALPER_X = 1.25;
const SCALPER_SCALE = 0.66;

/** A milestone: another suit power-walks up and is waved straight past the rope. */
export function waveSuit(c: Club, index: number): void {
  c.waved += 1;
  const vx = 125 + 15 * noise(index * 3.7);
  c.suits.push({ x: -60, vx, speed: vx, walked: 0, bag: false, seed: index * 17 + 5, depth: 0, entering: true, gone: false });
}

/** Your coin steps out of the line: the NO JEETS poster lights up. */
export function jeetClub(c: Club): void {
  c.jeet = 1;
}

/** The taxi pulls up for your coin. `quiet` parks it at the kerb already, for an exit that already happened. */
export function callTaxi(c: Club, quiet = false): void {
  c.taxi = true;
  if (quiet) settleSpring(c.taxiX, KERB);
  // A taxi with a meter is a witness: the scalper makes himself scarce.
  scarper(c, quiet);
}

/** The scalper runs for it, dropping the tickets. */
function scarper(c: Club, quiet: boolean): void {
  const sc = c.scalper;
  if (sc.mode !== 'hawking') return;
  if (quiet) { sc.mode = 'off'; sc.x = -60; return; }
  sc.mode = 'fleeing';
  sc.bubbleAge = 10;
  const rng = mulberry32(Math.floor(sc.x * 13));
  for (let i = 0; i < 8; i += 1) sc.tickets.push({ x: sc.x + (rng() - 0.5) * 30, y: H - 90, vx: (rng() - 0.5) * 160, vy: -120 - rng() * 140, angle: rng() * 6, va: (rng() - 0.5) * 10, age: 0 });
}

/** The crash frame: the fuse before the doors burst, the handles rattling, the strobe starting. */
export function armClub(c: Club): void {
  c.rattle = 1;
  c.strobe = 1;
}

/** Sell the news. `quiet` skips the effects for a crash that already happened. */
export function crashClub(c: Club, seed: number, quiet: boolean): void {
  if (c.crashed) return;
  c.crashed = true;
  c.crashAge = quiet ? 10 : 0;
  const rng = mulberry32(seed);
  const count = 7 + Math.floor(rng() * 5);
  for (let i = 0; i < count; i += 1) {
    // They burst out of the doorway at a third of their speed and get up to a run with the bags.
    const vx = -(220 + rng() * 100);
    c.suits.push({ x: DOOR.x + 20 + rng() * 60, vx, speed: vx * 0.3, walked: rng() * 40, bag: true, seed: Math.floor(rng() * 1000), depth: 0, entering: false, gone: false });
  }
  scarper(c, quiet);
  c.rattle = 0;
  if (quiet) {
    settleSpring(c.doors, 1);
    settleSpring(c.signFlip, 1);
    settleSpring(c.lights, 1);
    for (const s of c.suits) s.gone = true;
    c.suits = [];
    layoutLetters(c);
    for (const l of c.letters) {
      if (l.state === 'down') continue;
      l.state = 'down';
      l.px = MARQUEE.x + MARQUEE.w / 2 + l.x + (l.x < 0 ? 1 : -1) * (30 + 60 * l.seed);
      l.py = l.landY;
      l.angle = (l.seed - 0.5) * 2.4;
    }
    return;
  }
  c.strobe = 1;
  c.doors.v = 12;
  c.flinch.v = 14;
  // Every letter still up lets go, one after another.
  let n = 0;
  for (const l of c.letters) {
    if (l.state === 'fixed' || l.state === 'loose') { l.dropAt = 0.1 + n * 0.07; n += 1; }
  }
}

/** `beat` counts beats of the score (128 BPM) on the scene's clock; `tension` is the scene's 1 - 1/x. */
export interface ClubDrive { running: boolean; tension: number; multiplier: number; reduced: boolean; beat: number }

export function stepClub(c: Club, drive: ClubDrive, dt: number): void {
  c.time += dt;
  const t = drive.tension;
  const m = drive.multiplier;
  c.mult = m;
  c.events = noEvents();
  if (drive.running) c.fee = 5 * m;
  // The bass rides the score's grid: a kick every beat, harder with the hype, and on the half-beats too past 2x.
  // Behind closed doors before the round it is a muffled thud; the crash pulled the record, so nothing after it.
  const half = Math.floor(drive.beat * 2);
  if (half !== c.half && !c.crashed) {
    const down = half % 2 === 0;
    c.half = half;
    const kick = !drive.running ? (down ? 3 : 0) : down ? 6 + 14 * t : t > 0.5 ? 2 + 8 * t : 0;
    if (kick > 0) { c.thump.v += kick; c.events.kick = kick; }
  }
  stepSpring(c.thump, 0, 18, 0.5, dt);
  stepSpring(c.flinch, 0, 9, 0.4, dt);
  if (c.rattle > 0) c.rattle = Math.max(0, c.rattle - dt / 0.3);
  if (c.jeet > 0) c.jeet = Math.max(0, c.jeet - dt / 1.6);
  if (!drive.reduced) c.chase += dt * (3 + 8 * t);
  // The handles rattle as if the doors were finally opening. They are not.
  if (drive.running && !c.crashed && c.fakes < FAKEOUTS.length && m >= FAKEOUTS[c.fakes]!) { c.fakes += 1; c.rattle = 2; c.events.fake = true; }
  // The sign: letters work loose with the hype, swing on the bass and drop; after the crash, all of them.
  for (const [i, l] of c.letters.entries()) {
    const drops = SIGN_DROPS[i];
    if (l.state === 'fixed' && !c.crashed && drive.running) {
      if (drops && m >= drops[0]) { l.state = 'loose'; l.swing.v += 4 * l.side; c.events.letterLoose = true; }
    } else if (l.state === 'loose') {
      if (!c.crashed && drive.running && drops && m >= drops[1]) dropLetter(c, l);
      else {
        if (c.events.kick) l.swing.v += 0.22 * c.events.kick * (noise(Math.floor(c.time * 3) + i) > 0.5 ? 1 : -1);
        stepSpring(l.swing, l.side * 0.42, 4, 0.14, dt);
      }
    }
    if ((l.state === 'fixed' || l.state === 'loose') && c.crashed && c.crashAge >= l.dropAt) dropLetter(c, l);
    if (l.state === 'falling') {
      l.vy += 1100 * dt;
      l.px += l.vx * dt;
      l.py += l.vy * dt;
      l.angle += l.va * dt;
      if (l.py >= l.landY) {
        l.py = l.landY;
        c.events.letterDown = true;
        if (l.vy > 120) { l.vy = -l.vy * 0.3; l.vx *= 0.6; l.va = -l.va * 0.5; }
        else { l.state = 'down'; l.vy = 0; l.vx = 0; l.va = 0; }
      }
    }
  }
  // Suits walking: arrivals power-walk to the door, step up into it and go in; leavers run left with the bags.
  let waving = false;
  let letIn = false;
  for (const s of c.suits) {
    if (s.gone) continue;
    s.speed += (s.vx - s.speed) * (1 - Math.exp(-dt * 9));
    if (s.entering) {
      if (s.depth === 0) s.x += s.speed * dt;
      s.walked += (s.depth === 0 ? s.speed : 55) * dt;
      waving ||= s.x > BOUNCER_X - 150 && s.x < BOUNCER_X + 30;
      letIn ||= s.x > BOUNCER_X - 40 && s.depth < 0.7;
      if (s.x > DOOR.x + DOOR.w / 2) { if (s.depth === 0) c.events.enter = true; s.depth = Math.min(1, s.depth + dt * 1.6); if (s.depth >= 1) s.gone = true; }
    } else {
      s.x += s.speed * dt;
      s.walked -= s.speed * dt;
      if (s.x < -80) s.gone = true;
    }
  }
  c.suits = c.suits.filter((s) => !s.gone);
  if (c.crashed) {
    c.crashAge += dt;
    stepSpring(c.doors, 1, 6, 0.75, dt);
    stepSpring(c.signFlip, c.crashAge > FLIP_AT ? 1 : 0, 9, 0.7, dt);
    stepSpring(c.lights, c.crashAge > LIGHTS_AT ? 1 : 0, 5, 0.9, dt);
    c.flicker = c.crashAge > FLIP_AT ? 2 : 1;
    if (c.strobe > 0) c.strobe = Math.max(0, c.strobe - dt / 1.2);
    stepSpring(c.lookDown, 0, 8, 0.8, dt);
    stepSpring(c.wave, 0, 6, 0.6, dt);
    stepSpring(c.headShake, 0, 10, 0.4, dt);
  } else {
    // The doors crack at 2.33x and the gap keeps growing through a long round; a suit being let in swings them wide.
    const ajar = drive.running ? ajarAt(m, c.time) : 0;
    if (ajar > 0 && !c.cracked) { c.cracked = true; c.events.ajar = true; }
    stepSpring(c.doors, letIn ? Math.max(ajar, 0.55) : ajar, 5, 0.6, dt);
    stepSpring(c.signFlip, 0, 9, 0.7, dt);
    stepSpring(c.lights, 0, 5, 0.9, dt);
    // The bouncer checks his clipboard a second or so in, then more often the higher it goes.
    const checking = drive.running && ((m >= 1.1 && m < 1.2) || (t > 0.25 && noise(Math.floor(c.time * 0.5)) < 0.15 + 0.75 * t));
    stepSpring(c.lookDown, checking ? 1 : 0, 6, 0.8, dt);
    if (drive.running && t > 0.45 && Math.floor(c.time * 2) !== Math.floor((c.time - dt) * 2) && noise(Math.floor(c.time * 2) * 1.7) > 0.8) { c.headShake.v += 30; c.events.shake = true; }
    stepSpring(c.headShake, 0, 14, 0.35, dt);
    stepSpring(c.wave, waving ? 1 : 0, 7, 0.6, dt);
    // Marquee flicker between LISTING SOON, LISTING (from 1.43x) and DELISTING (from 2.2x).
    const slot = Math.floor(c.time * 6);
    const n = noise(slot * 2.3);
    c.flicker = drive.reduced || !drive.running ? 0 : t > 0.55 && n > 1 - 0.35 * (t - 0.55) / 0.45 ? 2 : t > 0.3 && n > 0.85 ? 1 : 0;
  }
  if (c.taxi) stepSpring(c.taxiX, KERB, 3.2, 0.85, dt);
  else settleSpring(c.taxiX, W + 260);
  // The scalper: in from the left once there is a line worth working, back and forth in front of it, off at a run.
  const sc = c.scalper;
  if (sc.mode === 'off' && drive.running && !c.crashed && !c.taxi && m > SCALPER_X) { sc.mode = 'hawking'; sc.x = -60; sc.dir = 1; sc.v = 0; sc.bubbleAt = c.time + 1.2; }
  if (sc.mode === 'hawking') {
    if (!drive.running && !c.crashed) scarper(c, false);
    if (sc.x > 300) sc.dir = -1;
    if (sc.x < 170 && sc.dir < 0) sc.dir = 1;
    sc.bubbleAge += dt;
    if (c.time >= sc.bubbleAt) {
      sc.bubble = SCALPER_LINES[Math.floor(noise(Math.floor(c.time * 9.1)) * SCALPER_LINES.length)]!;
      sc.bubbleAge = 0;
      sc.bubbleAt = c.time + mix(5.5, 2.6, t) * (0.8 + 0.4 * noise(c.time));
    }
  }
  if (sc.mode !== 'off') {
    // Velocity eases toward where he is heading (about 0.3 s), so he slows into a turn and bolts without a pop.
    const target = sc.mode === 'fleeing' ? -270 : sc.dir * (48 + 30 * t);
    sc.v += (target - sc.v) * (1 - Math.exp(-dt * (sc.mode === 'fleeing' ? 8 : 6)));
    sc.x += sc.v * dt;
    sc.walked += Math.abs(sc.v) * dt;
    if (sc.mode === 'fleeing' && sc.x < -80) sc.mode = 'off';
  }
  for (const k of sc.tickets) { k.age += dt; k.vy += 300 * dt; k.vx *= Math.exp(-dt * 1.5); k.x += k.vx * dt; k.y += k.vy * dt; k.angle += k.va * dt; }
  sc.tickets = sc.tickets.filter((k) => k.age < 1.6);
}

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return {
    x: root.x + (dx / distance) * along - (dy / distance) * bend,
    y: root.y + (dy / distance) * along + (dx / distance) * bend,
  };
}

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): Point {
  const joint = bendJoint(a, b, upper, lower, side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(joint.x, joint.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(joint.x, joint.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  return joint;
}

/** A price that fits a plaque however long the round runs: 950, 12.5K, 3.1M, 40.0B, then powers of ten. */
export function compact(n: number, digits: number): string {
  if (n < 1000) return n.toFixed(digits);
  const tier = Math.min(4, Math.floor(Math.log10(n) / 3));
  return n >= 1e15 ? n.toExponential(1).replace('e+', 'e') : `${(n / 1000 ** tier).toFixed(1)}${'KMBT'[tier - 1]}`;
}

function memeSmall(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center', maxWidth?: number): void {
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, size * (fill === INK ? 0.04 : 0.12)); ctx.strokeStyle = fill === INK ? '#f7f3e8' : INK; ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill; ctx.fillText(text, x, y, maxWidth);
}

/** A foot on a distance-driven cycle: planted for `duty` of it, sliding back exactly with the ground, then lifted forward. */
function gaitFoot(cycle: number, side: number, len: number, duty: number, lift: number): Point {
  const p = fract(cycle + (side > 0 ? 0.5 : 0)), s = smoothstep(duty, 1, p);
  return { x: (duty / 2 - p + s) * len, y: -Math.sin(Math.PI * s) * lift };
}

/**
 * Two legs (40 + 36, knees forward; local +x is the way he faces) stepping on `walked` px of world distance at
 * `scale`, so the planted foot keeps pace with the pavement at any speed. Returns the stride cycle and the body's
 * bob (up at mid-stance, down as the weight changes feet) for the torso to follow.
 */
function walkLegs(ctx: CanvasRenderingContext2D, walked: number, scale: number, run: boolean, hip: number, colour: string, width: number): { cycle: number; bob: number } {
  const len = run ? RUN : WALK, duty = run ? 0.38 : 0.6;
  const cycle = walked / (len * scale);
  const bob = -1.5 * Math.cos(4 * Math.PI * (fract(cycle) - duty / 2));
  for (const side of [-1, 1]) {
    const f = gaitFoot(cycle, side, len, duty, run ? 16 : 11);
    const foot = { x: side * 9 + f.x, y: f.y };
    limb(ctx, { x: side * 8, y: hip + bob }, foot, 40, 36, -1, width, colour);
    ctx.fillStyle = '#111114'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 3, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  return { cycle, bob };
}

/** A man in a suit, walking or running on `walked` px; the arms and coat tails follow the stride, the bag lags it. */
export function drawSuit(ctx: CanvasRenderingContext2D, x: number, footY: number, walked: number, bag: boolean, seed: number, scale = 1, facing = 1, run = false): void {
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(scale * facing, scale);
  ctx.lineJoin = 'round';
  const tie = ['#c1121f', '#1d4ed8', '#f4c20d', '#0f766e'][Math.floor(noise(seed * 1.3) * 4)]!;
  const gait = walkLegs(ctx, walked, scale, run, -68, '#23232b', 12);
  const stride = gait.cycle * Math.PI * 2;
  ctx.translate(0, gait.bob);
  const tail = Math.sin(stride) * 8;
  ctx.fillStyle = '#1a1a20';
  ctx.beginPath(); ctx.moveTo(-12, -68); ctx.quadraticCurveTo(-24 - tail, -28, -6 - tail, -4); ctx.lineTo(0, -8); ctx.quadraticCurveTo(-10, -30, -4, -68); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12, -68); ctx.quadraticCurveTo(24 + tail, -28, 6 + tail, -4); ctx.lineTo(0, -8); ctx.quadraticCurveTo(10, -30, 4, -68); ctx.fill();
  ctx.fillStyle = '#2b2b33'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-24, -122, 48, 64, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath(); ctx.moveTo(-8, -122); ctx.lineTo(0, -92); ctx.lineTo(8, -122); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tie;
  ctx.beginPath(); ctx.moveTo(-3, -118); ctx.lineTo(3, -118); ctx.lineTo(2, -92); ctx.lineTo(0, -86); ctx.lineTo(-2, -92); ctx.closePath(); ctx.fill();
  const swing = Math.sin(stride);
  // The arm opposite the forward foot leads.
  const leftHand = { x: -34 - swing * 12, y: -66 };
  const rightHand = { x: 34 + swing * 12, y: -64 };
  limb(ctx, { x: -22, y: -112 }, leftHand, 30, 28, 1, 11, '#2b2b33');
  limb(ctx, { x: 22, y: -112 }, rightHand, 30, 28, 1, 11, '#2b2b33');
  if (bag) {
    const lag = Math.sin(stride - 0.6) * 14;
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rightHand.x - 4, rightHand.y + 2);
    ctx.quadraticCurveTo(rightHand.x - 16 + lag, rightHand.y + 28, rightHand.x + 2 + lag, rightHand.y + 42);
    ctx.quadraticCurveTo(rightHand.x + 30 + lag * 0.4, rightHand.y + 34, rightHand.x + 12, rightHand.y + 4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c'; ctx.font = '900 16px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', rightHand.x + 6 + lag * 0.35, rightHand.y + 28);
  }
  const skin = noise(seed * 2.1) > 0.5 ? '#f3dccb' : '#c68e6a';
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -142, 17, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-12, -166, 26, 6); ctx.fillRect(2, -166, 12, 6);
  ctx.beginPath(); ctx.arc(6, -146, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBouncer(ctx: CanvasRenderingContext2D, c: Club): void {
  ctx.save();
  ctx.translate(BOUNCER_X, GROUND);
  ctx.lineJoin = 'round';
  const thump = c.thump.x * 3;
  const flinch = clamp(c.flinch.x, -0.5, 1.5);
  ctx.translate(Math.sin(c.time * 1.4) * 2 - 10 * flinch, -thump * 0.4);
  ctx.rotate(-0.08 * flinch);
  // Legs and a wide stance, knees out.
  limb(ctx, { x: -18, y: -84 }, { x: -32, y: 0 }, 48, 44, 1, 18, '#151519');
  limb(ctx, { x: 18, y: -84 }, { x: 32, y: 0 }, 48, 44, -1, 18, '#151519');
  ctx.fillStyle = '#111114'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(-34, 4, 14, 5, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(34, 4, 14, 5, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // A very wide torso.
  ctx.fillStyle = '#151519'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.roundRect(-46, -168, 92, 92, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a'; ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SECURITY', 0, -100);
  // Left arm holds the clipboard; it rises as he checks it.
  const look = clamp(c.lookDown.x, 0, 1);
  const hand = { x: -56 + 28 * look, y: -108 - 34 * look };
  limb(ctx, { x: -44, y: -150 }, hand, 32, 28, hand.y >= -150 ? 1 : -1, 16, '#151519');
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(-0.4 + 0.5 * look);
  ctx.fillStyle = '#8b5a2b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-16, -22, 32, 44, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f7f3e8';
  ctx.fillRect(-12, -16, 24, 34);
  ctx.fillStyle = '#c1121f'; ctx.font = '900 6px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('INSIDERS', 0, -8);
  ctx.fillText('ONLY', 0, -2);
  ctx.strokeStyle = '#9a9aa8'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(-9, 4 + i * 5); ctx.lineTo(9 - (i % 2) * 5, 4 + i * 5); ctx.stroke(); }
  ctx.fillStyle = '#c1121f';
  if (c.crashed) { ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('NOPE', 0, 15); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-8, -26, 16, 8, 2); ctx.stroke();
  ctx.restore();
  // Right arm waves a suit through or stays folded. As the hand passes the shoulder the elbow swings from above the
  // forearm to under it through a moment of pointing at the camera, rather than flipping over in one frame.
  const wave = clamp(c.wave.x, 0, 1);
  const waveHand = { x: 48 + 36 * wave, y: -118 - 46 * wave };
  limb(ctx, { x: 44, y: -150 }, waveHand, 32, 28, clamp((-150 - waveHand.y) / 8, -1, 1), 16, '#151519');
  if (wave > 0.3) { ctx.fillStyle = '#c68e6a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(waveHand.x, waveHand.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  // Head with an earpiece, shades, a head-shake.
  ctx.save();
  ctx.translate(0, -186 + 14 * look);
  ctx.rotate(Math.sin(c.time * 26) * 0.08 * clamp(c.headShake.x, 0, 1) * (c.headShake.x > 0.05 ? 1 : 0) + 0.25 * look);
  ctx.fillStyle = '#c68e6a'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.roundRect(-22, -22, 44, 44, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-20, -8, 40, 10);
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(22, -4); ctx.quadraticCurveTo(32, 6, 24, 24); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(8, 12); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawTaxi(ctx: CanvasRenderingContext2D, x: number, time: number, moving: boolean): void {
  ctx.save();
  ctx.translate(x, GROUND + 48);
  const bob = moving ? Math.sin(time * 30) * 1.2 : 0;
  ctx.translate(0, bob);
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 6, 120, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4c20d'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.roundRect(-118, -38, 236, 40, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-80, -38); ctx.lineTo(-56, -72); ctx.lineTo(50, -72); ctx.lineTo(76, -38); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8fd3ff';
  ctx.beginPath(); ctx.moveTo(-70, -40); ctx.lineTo(-52, -66); ctx.lineTo(-6, -66); ctx.lineTo(-6, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -40); ctx.lineTo(4, -66); ctx.lineTo(46, -66); ctx.lineTo(66, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-30, -84, 60, 14);
  ctx.fillStyle = '#ffe27a'; ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('TAXI', 0, -73);
  for (const wx of [-70, 70]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(wx, 2, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9aa8'; ctx.beginPath(); ctx.arc(wx, 2, 8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-118, -30, 236, 6);
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.roundRect(-124, -30, 10, 12, 3); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  // Driver, one arm on the wheel.
  ctx.fillStyle = '#c68e6a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-30, -54, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(-36, -56, 12, 3);
  limb(ctx, { x: -22, y: -46 }, { x: -2, y: -34 + Math.sin(time * 2.2) * 2 }, 14, 12, 1, 5, '#c68e6a');
  if (!moving) {
    ctx.save();
    ctx.translate(78, -36);
    ctx.rotate(-0.55);
    ctx.fillStyle = '#e0ac00'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(0, 0, 34, 36, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The building, the marquee, the doors and what is behind them, the bouncer. */
export function drawClubBack(ctx: CanvasRenderingContext2D, c: Club, tension: number, reduced: boolean): void {

  const thump = clamp(c.thump.x, 0, 1);
  // Night sky and the brick front.
  const sky = ctx.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0, '#070a1c'); sky.addColorStop(1, '#1a1440');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2a2140';
  ctx.fillRect(0, 60, W, GROUND - 60);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let y = 70; y < GROUND; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let y = 70, r = 0; y < GROUND; y += 22, r += 1) for (let x = (r % 2) * 30; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); }
  ctx.fillStyle = '#1f1a33';
  ctx.fillRect(0, 60, W, 12);
  // Neon glow that pulses with the beat.
  const glow = reduced ? 0.4 : 0.25 + 0.5 * thump;
  const neon = ctx.createRadialGradient(DOOR.x + DOOR.w / 2, 140, 20, DOOR.x + DOOR.w / 2, 140, 520);
  neon.addColorStop(0, `rgba(255, 70, 200, ${0.35 * glow + 0.1})`);
  neon.addColorStop(1, 'rgba(255, 70, 200, 0)');
  ctx.fillStyle = neon; ctx.fillRect(0, 0, W, H);
  // Posters on the wall: LISTING PARTY, and one that has been torn.
  ctx.save();
  ctx.translate(140, 150);
  ctx.rotate(-0.04);
  ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-70, -50, 140, 100, 4); ctx.fill(); ctx.stroke();
  memeSmall(ctx, 'LISTING', 0, -12, 28, '#c1121f');
  memeSmall(ctx, 'PARTY', 0, 22, 28, '#c1121f');
  ctx.fillStyle = '#ffffff'; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('tonight · maybe', 0, 40);
  ctx.restore();
  ctx.save();
  ctx.translate(330, 130);
  // It flashes red and rattles on its tape as your coin walks out on the line (lit steadily under reduced motion).
  const jeet = c.jeet > 0 && (reduced || Math.floor(c.jeet * 14) % 2 === 0) ? 1 : 0;
  ctx.rotate(0.06 + (reduced ? 0 : 0.05 * c.jeet * Math.sin(c.time * 30)));
  ctx.scale(1 + 0.08 * c.jeet, 1 + 0.08 * c.jeet);
  ctx.fillStyle = jeet ? '#ff4d6d' : '#e7e7ef'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-50, -40); ctx.lineTo(50, -40); ctx.lineTo(50, 10); ctx.lineTo(20, 40); ctx.lineTo(-20, 20); ctx.lineTo(-50, 36); ctx.closePath(); ctx.fill(); ctx.stroke();
  memeSmall(ctx, 'NO JEETS', 0, 0, 20, jeet ? '#ffffff' : INK);
  ctx.restore();
  // The marquee.
  const mq = MARQUEE;
  ctx.save();
  ctx.translate(0, thump * (reduced ? 0 : 2));
  ctx.fillStyle = '#12101f'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(mq.x, mq.y, mq.w, mq.h, 10); ctx.fill(); ctx.stroke();
  const bulbs = 22;
  for (let i = 0; i < bulbs; i += 1) {
    const on = reduced ? i % 2 === 0 : (i + Math.floor(c.chase)) % 3 !== 0;
    ctx.fillStyle = on ? '#ffe27a' : '#5a5040';
    for (const y of [mq.y + 8, mq.y + mq.h - 8]) { ctx.beginPath(); ctx.arc(mq.x + 12 + (i * (mq.w - 24)) / (bulbs - 1), y, 4, 0, Math.PI * 2); ctx.fill(); }
  }
  memeSmall(ctx, 'THE EXCHANGE', mq.x + mq.w / 2, mq.y + 44, 34, '#ff5d9e');
  drawSign(ctx, c, reduced);
  ctx.restore();
  // Hype meter under the marquee.
  ctx.fillStyle = '#12101f'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(mq.x + 40, mq.y + mq.h + 10, mq.w - 80, 16, 8); ctx.fill(); ctx.stroke();
  const fill = c.crashed ? Math.max(0, 1 - c.crashAge / 1.2) * tension : tension;
  if (fill > 0.01) {
    const g = ctx.createLinearGradient(mq.x + 40, 0, mq.x + mq.w - 40, 0);
    g.addColorStop(0, '#8fd3ff'); g.addColorStop(1, '#ff5d9e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(mq.x + 40, mq.y + mq.h + 10, (mq.w - 80) * fill, 16, 8); ctx.fill();
  }
  ctx.fillStyle = '#ffffff'; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('HYPE', mq.x + mq.w / 2, mq.y + mq.h + 22);
  // Speakers either side of the door, cones pumping with the beat.
  for (const sx of [DOOR.x - 60, DOOR.x + DOOR.w + 60]) {
    ctx.fillStyle = '#151519'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(sx - 30, GROUND - 130, 60, 130, 6); ctx.fill(); ctx.stroke();
    for (const cy of [GROUND - 96, GROUND - 40]) {
      ctx.fillStyle = '#2b2b33'; ctx.beginPath(); ctx.arc(sx, cy, 20 + thump * 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3d3d48'; ctx.beginPath(); ctx.arc(sx, cy, 8 + thump * 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The doorway: dance floor behind, lit or empty.
  ctx.save();
  ctx.beginPath(); ctx.rect(DOOR.x, DOOR.y, DOOR.w, DOOR.h); ctx.clip();
  const lights = clamp(c.lights.x, 0, 1);
  ctx.fillStyle = lights > 0.5 ? '#e9e4f0' : '#0a0716';
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  if (lights < 0.95) {
    ctx.globalAlpha = 1 - lights;
    const hues = [300, 200, 120, 40];
    for (let i = 0; i < 4; i += 1) {
      const a = c.time * (1.5 + i * 0.4) + i;
      const lx = DOOR.x + DOOR.w / 2 + Math.sin(a) * 50;
      const beam = ctx.createRadialGradient(lx, DOOR.y + 40, 4, lx, DOOR.y + 40, 130);
      const on = reduced ? 0.5 : 0.35 + 0.5 * thump;
      beam.addColorStop(0, `hsla(${hues[i]}, 90%, 60%, ${on})`); beam.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = beam; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    }
    // Disco ball.
    ctx.fillStyle = '#c9c9d4'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(DOOR.x + DOOR.w / 2, DOOR.y + 26, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(DOOR.x + DOOR.w / 2 - 12 + ((i * 5 + Math.floor(c.time * 8)) % 24), DOOR.y + 18 + (i % 3) * 6, 3, 3);
    // Silhouettes of the suits inside: dancing, then slipping out of the back exit one by one from about 3.5x,
    // the one nearest it first, each over a 1.6x stretch of the multiplier (so about 6 s), and gone once there.
    const exit = DOOR.x + DOOR.w - 8;
    const lm = Math.log(c.mult);
    const leaving = smoothstep(Math.log(3.3), Math.log(4), lm);
    for (let i = 0; i < 6; i += 1) {
      const base = DOOR.x + 18 + i * 19;
      const from = Math.log(3.5) + (5 - i) * Math.log(1.45);
      const go = smoothstep(from, from + Math.log(1.6), lm);
      if (go >= 1) continue;
      const sx = mix(base, exit, go);
      const bounce = (1 - go) * Math.abs(Math.sin(c.time * 6 + i)) * 8 + go * Math.abs(Math.sin(c.time * 9 + i)) * 2;
      const sy = DOOR.y + DOOR.h - 30 - bounce;
      ctx.fillStyle = `rgba(0,0,0,${0.85 * (1 - smoothstep(0.75, 1, go))})`;
      ctx.beginPath(); ctx.arc(sx, sy - 24, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(sx - 6, sy - 18, 12, 20);
    }
    if (leaving > 0.05) {
      ctx.fillStyle = `rgba(124, 246, 124, ${leaving})`;
      ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BACK EXIT →', DOOR.x + DOOR.w / 2, DOOR.y + 60);
    }
    ctx.globalAlpha = 1;
  }
  if (lights > 0.05) {
    // Lights on: the empty club, a mop bucket, a chair on a table.
    ctx.globalAlpha = lights;
    ctx.fillStyle = '#e9e4f0'; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    ctx.fillStyle = '#cfc7dc'; ctx.fillRect(DOOR.x, DOOR.y + DOOR.h - 40, DOOR.w, 40);
    ctx.strokeStyle = '#9a9aa8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(DOOR.x + 20, DOOR.y + DOOR.h - 90, 60, 8, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(DOOR.x + 26, DOOR.y + DOOR.h - 82); ctx.lineTo(DOOR.x + 26, DOOR.y + DOOR.h - 40); ctx.moveTo(DOOR.x + 74, DOOR.y + DOOR.h - 82); ctx.lineTo(DOOR.x + 74, DOOR.y + DOOR.h - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(DOOR.x + 34, DOOR.y + DOOR.h - 90); ctx.lineTo(DOOR.x + 40, DOOR.y + DOOR.h - 130); ctx.lineTo(DOOR.x + 66, DOOR.y + DOOR.h - 130); ctx.lineTo(DOOR.x + 66, DOOR.y + DOOR.h - 90); ctx.stroke();
    ctx.fillStyle = '#4a4a55';
    ctx.beginPath(); ctx.roundRect(DOOR.x + 96, DOOR.y + DOOR.h - 66, 22, 26, 3); ctx.fill();
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(DOOR.x + 106, DOOR.y + DOOR.h - 66); ctx.lineTo(DOOR.x + 112, DOOR.y + DOOR.h - 150); ctx.stroke();
    ctx.fillStyle = '#9a9aa8'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('nobody home', DOOR.x + DOOR.w / 2, DOOR.y + 40);
    ctx.globalAlpha = 1;
  }
  // Suits deep in the doorway (entering ones fade back).
  for (const s of c.suits) if (s.entering && s.depth > 0) { ctx.globalAlpha = 1 - s.depth; drawSuit(ctx, DOOR.x + DOOR.w / 2, GROUND + 4 - 24 * s.depth, s.walked, false, s.seed, 0.66 * (1 - 0.3 * s.depth)); ctx.globalAlpha = 1; }
  ctx.restore();
  // The doors themselves, ajar by `doors`, jittering with the bass.
  const open = clamp(c.doors.x, 0, 1);
  const jitter = reduced ? 0 : Math.sin(c.time * 40) * (1.5 * thump + 4 * Math.min(1, c.rattle)) * (1 - open);
  for (const side of [0, 1]) {
    const hinge = side === 0 ? DOOR.x : DOOR.x + DOOR.w;
    const dir = side === 0 ? 1 : -1;
    const width = (DOOR.w / 2) * (1 - open * 0.92) - Math.abs(jitter);
    ctx.fillStyle = '#4a1d6b'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.rect(Math.min(hinge, hinge + dir * width), DOOR.y, Math.abs(width), DOOR.h); ctx.fill(); ctx.stroke();
    if (width > 20) {
      ctx.fillStyle = '#7cf67c';
      ctx.beginPath(); ctx.arc(hinge + dir * (width - 12), DOOR.y + DOOR.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
      ctx.strokeRect(Math.min(hinge + dir * 10, hinge + dir * (width - 10)), DOOR.y + 20, Math.abs(width) - 20, DOOR.h - 60);
    }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.strokeRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  // The sign on a post by the door: GUEST LIST, flipped to DELISTED.
  const flip = clamp(c.signFlip.x, 0, 1);
  ctx.save();
  ctx.translate(DOOR.x + DOOR.w + 26, GROUND - 150);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 150); ctx.stroke();
  ctx.scale(Math.abs(Math.cos(flip * Math.PI)) + 0.02, 1);
  ctx.fillStyle = flip > 0.5 ? '#ff4d6d' : '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-34, -22, 68, 44, 5); ctx.fill(); ctx.stroke();
  memeSmall(ctx, flip > 0.5 ? 'DELISTED' : 'GUEST LIST', 0, 5, 13, flip > 0.5 ? '#ffffff' : INK);
  ctx.restore();
  drawBouncer(ctx, c);
  // Pavement.
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#2b2b36';
  ctx.fillRect(0, GROUND + 30, W, 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x - 30, H); ctx.stroke(); }
  // Puddle reflecting the neon.
  ctx.fillStyle = `rgba(255, 70, 200, ${0.12 + 0.12 * thump})`;
  ctx.beginPath(); ctx.ellipse(430, GROUND + 50, 120, 12, 0, 0, Math.PI * 2); ctx.fill();
  // The listing fee plaque on the wall by the door: it goes up while you wait.
  ctx.save();
  ctx.translate(880, 252);
  ctx.rotate(0.03);
  ctx.fillStyle = '#d4af37'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-52, -22, 104, 44, 5); ctx.fill(); ctx.stroke();
  memeSmall(ctx, c.crashed ? 'REFUNDS' : 'LISTING FEE', 0, -4, 12, INK);
  memeSmall(ctx, c.crashed ? 'NO' : `${compact(c.fee, 0)} BTC`, 0, 14, 15, c.crashed ? '#c1121f' : '#5c3d00', 'center', 94);
  ctx.restore();
  // The letters off the sign, in the air and on the pavement, over everything but the queue.
  for (const l of c.letters) {
    if (l.state !== 'falling' && l.state !== 'down') continue;
    ctx.save();
    ctx.translate(l.px, l.py);
    ctx.rotate(l.angle);
    glyph(ctx, l.ch, 0, 0, l.state === 'down' ? '#4a4356' : '#7a6f8a');
    ctx.restore();
  }
}

/** One letter of the sign, its left edge at `x` on baseline `y`. */
function glyph(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, fill: string): void {
  ctx.font = `900 ${SIGN_SIZE}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, SIGN_SIZE * 0.12); ctx.strokeStyle = INK; ctx.strokeText(ch, x, y);
  ctx.fillStyle = fill; ctx.fillText(ch, x, y);
}

/** The sign, letter by letter: lit, flickering, hanging loose, or gone; DELISTED once the crash has cleared it. */
function drawSign(ctx: CanvasRenderingContext2D, c: Club, reduced: boolean): void {
  const cx = MARQUEE.x + MARQUEE.w / 2;
  if (c.crashed && c.crashAge > DELISTED_AT) {
    // It stutters on for half a second, unless motion is reduced.
    const on = reduced || c.crashAge > DELISTED_AT + 0.5 || Math.floor(c.crashAge * 12) % 3 !== 0;
    memeSmall(ctx, 'DELISTED', cx, SIGN_Y, SIGN_SIZE, on ? '#ff4d6d' : '#5a2030');
    return;
  }
  ctx.font = `900 ${SIGN_SIZE}px Impact, "Arial Black", sans-serif`;
  if (!('L' in c.glyphs)) for (const ch of 'LISTINGSOONDE ') c.glyphs[ch] = ctx.measureText(ch).width;
  layoutLetters(c);
  const flicker = c.flicker;
  const dark = '#3a3548';
  if (flicker === 2 && !c.crashed) glyph(ctx, 'DE', cx + c.letters[0]!.x - c.glyphs['D']! - c.glyphs['E']!, SIGN_Y, '#ff4d6d');
  for (const [i, l] of c.letters.entries()) {
    if (l.state === 'falling' || l.state === 'down') continue;
    const soon = i > 7;
    const colour = c.crashed ? dark : soon && flicker > 0 ? dark : flicker === 2 ? '#ff4d6d' : flicker === 1 ? '#7cf67c' : '#8fd3ff';
    const x = cx + l.x;
    if (l.state === 'loose') {
      // Hanging from one top corner, dimmer, swinging on the bass.
      const pivotX = x + (l.side > 0 ? l.w : 0);
      ctx.save();
      ctx.translate(pivotX, SIGN_Y - 16);
      ctx.rotate(clamp(l.swing.x, -1.2, 1.2));
      glyph(ctx, l.ch, x - pivotX, 16, c.crashed ? dark : '#5a7a99');
      ctx.restore();
    } else glyph(ctx, l.ch, x, SIGN_Y, colour);
  }
}

/** The scalper in the foreground: long coat, beanie, shades, a sandwich board of FAST-TRACK LISTING tickets. */
function drawScalper(ctx: CanvasRenderingContext2D, c: Club): void {
  const sc = c.scalper;
  for (const k of sc.tickets) {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.angle);
    ctx.globalAlpha = clamp(1.6 - k.age, 0, 1);
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-9, -5, 18, 10, 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (sc.mode === 'off') return;
  const fleeing = sc.mode === 'fleeing';
  // He faces the way he moves and squashes thin through a turn, so the flip reads as turning on the spot.
  const facing = (sc.v < 0 || (sc.v === 0 && sc.dir < 0) ? -1 : 1) * mix(0.3, 1, smoothstep(0, 28, Math.abs(sc.v)));
  const footY = H - 6;
  ctx.save();
  ctx.translate(sc.x, footY);
  ctx.scale(SCALPER_SCALE * facing, SCALPER_SCALE);
  ctx.lineJoin = 'round';
  const gait = walkLegs(ctx, sc.walked, SCALPER_SCALE, fleeing, -68, '#2f2f38', 11);
  const stride = gait.cycle * Math.PI * 2;
  ctx.translate(0, gait.bob);
  // A long coat with the tails lagging the step.
  const tail = Math.sin(stride) * 6;
  ctx.fillStyle = '#4b5320'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-26, -128); ctx.lineTo(26, -128); ctx.lineTo(30 + tail, -40); ctx.lineTo(-30 + tail, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
  // The ticket hand up, the other in the pocket.
  const fan = { x: 40, y: -150 - (fleeing ? -30 : Math.sin(c.time * 5) * 6) };
  limb(ctx, { x: 22, y: -118 }, fan, 30, 28, -1, 10, '#4b5320');
  limb(ctx, { x: -22, y: -118 }, { x: -30, y: -70 }, 30, 28, 1, 10, '#4b5320');
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(fan.x, fan.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (!fleeing) {
    for (let i = -1; i <= 1; i += 1) {
      ctx.save(); ctx.translate(fan.x, fan.y - 4); ctx.rotate(-0.5 + i * 0.35);
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.roundRect(-6, -26, 12, 26, 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  // Head: beanie, shades, a stub of a cigar.
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -150, 17, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath(); ctx.moveTo(-19, -160); ctx.quadraticCurveTo(0, -186, 19, -160); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(-14, -156, 12, 6); ctx.fillRect(2, -156, 12, 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, -138); ctx.lineTo(8, -140); ctx.stroke();
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, -140); ctx.lineTo(18, -142); ctx.stroke();
  ctx.restore();
  // The sandwich board, never mirrored, hung off the shoulders.
  ctx.save();
  ctx.translate(sc.x, footY + gait.bob * SCALPER_SCALE);
  ctx.scale(SCALPER_SCALE, SCALPER_SCALE);
  ctx.rotate(fleeing ? Math.sin(stride) * 0.08 : 0);
  ctx.fillStyle = '#f7f3e8'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-34, -112, 68, 70, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-24, -112); ctx.lineTo(-16, -128); ctx.moveTo(24, -112); ctx.lineTo(16, -128); ctx.stroke();
  memeSmall(ctx, 'FAST-TRACK', 0, -92, 12, '#c1121f');
  memeSmall(ctx, 'LISTING TIX', 0, -76, 12, INK);
  memeSmall(ctx, `${compact(0.5 * (c.fee / 5) ** 2, 1)} BTC`, 0, -54, 15, '#c1121f', 'center', 60);
  ctx.restore();
  // His pitch.
  if (!fleeing && sc.bubbleAge < 2.4) {
    const alpha = sc.bubbleAge < 0.2 ? sc.bubbleAge / 0.2 : sc.bubbleAge > 2 ? (2.4 - sc.bubbleAge) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 12px system-ui, sans-serif';
    const w = ctx.measureText(sc.bubble).width + 18;
    // Off to his right at hood height, under the line's faces; the tail points back at his head.
    const bx = clamp(sc.x + 46 + w / 2, w / 2 + 6, W - w / 2 - 6);
    const by = footY - 96;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(bx - w / 2, by - 24, w, 24, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - w / 2 + 2, by - 16); ctx.lineTo(sc.x + 16, by - 10); ctx.lineTo(bx - w / 2 + 2, by - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(sc.bubble, bx, by - 8);
    ctx.restore();
  }
}

/** Suits walking along the front, the taxi, the strobe: drawn over the queue. */
export function drawClubFront(ctx: CanvasRenderingContext2D, c: Club, reduced: boolean): void {
  for (const s of c.suits) {
    // Arrivals cut across the front of the line and step up to the doorway; leavers step down out of it at a run.
    if (s.entering) { if (s.depth === 0) drawSuit(ctx, s.x, GROUND + 52 - 48 * smoothstep(BOUNCER_X - 20, DOOR.x + DOOR.w / 2, s.x), s.walked, false, s.seed, 0.66); }
    else drawSuit(ctx, s.x, GROUND + 34 * smoothstep(DOOR.x + 60, DOOR.x - 20, s.x), s.walked, s.bag, s.seed, 0.7, -1, true);
  }
  drawScalper(ctx, c);
  if (c.taxi || c.taxiX.x < W + 200) drawTaxi(ctx, c.taxiX.x, c.time, Math.abs(c.taxiX.v) > 8);
  if (c.strobe > 0 && !reduced && Math.floor(c.time * 18) % 2 === 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * c.strobe})`; ctx.fillRect(0, 0, W, H); }
}

/** Repeated admission checks provide anticipation and relief after the original suit waves. */
export function drawLateCheckpoint(ctx: CanvasRenderingContext2D, seconds: number, reduced: boolean): void {
  if (seconds < 45) return;
  const phase = (seconds - 45) % 18 / 18;
  const open = reduced ? 0.35 : Math.pow(Math.max(0, Math.sin(phase * Math.PI * 2)), 2);
  ctx.save(); ctx.translate(DOOR.x - 46, DOOR.y + DOOR.h - 34);
  ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-92 * (1 - open), -72 * open); ctx.stroke();
  ctx.fillStyle = '#f7f4ea'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-138, -132 - open * 12, 132, 42, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a2545'; ctx.font = '900 17px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(phase < 0.5 ? 'CHECKING LIST' : 'CHECK AGAIN', -72, -106 - open * 12, 122);
  ctx.restore();
}
