/**
 * Everyone in the lift. The suit is the one holding it in: his face goes
 * from pale to red to purple, his cheeks puff, his knees buckle and his
 * whole body trembles with the multiplier. The passengers squeeze in at
 * milestones from a fixed roster, glance at him as the air changes, and at
 * the crash react in their own ways: the pug faints, the wig lifts, the
 * nun crosses herself, the whale blows. Each says a line on the way in, and
 * up to four speak up after the release. Nothing here changes the outcome.
 */
import { solveLimb, stepFoot } from './kinematics';
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export type Point = { x: number; y: number };
export const INK = '#1c1f26';
const SKIN = '#f3dccb';
const SKIN_SHADE = '#e0bda7';

export type Kind = 'chad' | 'grandma' | 'wif' | 'mev' | 'karen' | 'bro' | 'nun' | 'whale' | 'bride' | 'pizza';
/**
 * Who squeezes in at which displayed multiplier, where they end up standing, and the multiplier at which each of them
 * smells it: their eyes start turning to him from `notice / 1.25`, and at `notice` they sniff and say so. The MEV bot
 * front-runs Karen through the same doors.
 */
export const ROSTER: { at: number; notice: number; kind: Kind; x: number; depth: number }[] = [
  { at: 1.25, notice: 1.6, kind: 'chad', x: 616, depth: 0.25 }, { at: 1.55, notice: 1.8, kind: 'grandma', x: 296, depth: 0.3 },
  { at: 1.9, notice: 2.05, kind: 'wif', x: 548, depth: 0.92 }, { at: 2.4, notice: 2.8, kind: 'mev', x: 238, depth: 0.1 },
  { at: 2.4, notice: 2.6, kind: 'karen', x: 386, depth: 0.96 }, { at: 3, notice: 3.25, kind: 'bro', x: 690, depth: 0.78 },
  { at: 3.8, notice: 4.1, kind: 'nun', x: 250, depth: 0.68 }, { at: 4.8, notice: 5.2, kind: 'whale', x: 640, depth: 0.5 },
  { at: 6.2, notice: 6.7, kind: 'bride', x: 726, depth: 0.12 }, { at: 8, notice: 8.6, kind: 'pizza', x: 330, depth: 0.52 },
];
/** The plaque's limit: over it from the fourth arrival (2.4×), while ON BOARD keeps climbing. */
export const MAX_PERSONS = 4;
/** Where the back doors meet the floor. */
export const DOOR: Point = { x: 480, y: 420 };

export const depthScale = (depth: number): number => mix(1, 0.74, clamp(depth, 0, 1.25));
export const depthFloor = (depth: number): number => mix(468, 424, clamp(depth, 0, 1.25));

export type Mood = 'calm' | 'sniff' | 'disgust';

export interface Passenger {
  kind: Kind;
  slot: number;
  x: number;
  depth: number;
  /** 0 at the door .. 1 in place. */
  progress: number;
  age: number;
  seed: number;
  mood: Mood;
  /** 0 .. 1 how far their eyes (and their quirk: the pug's nose, Karen's phone, the bro's camera, the bouquet) have turned to him. */
  turn: number;
  noticed: boolean;
  /** Ground covered in rider space, which drives the steps; how much of a stride is in the legs (eased with speed); which way they step. */
  walk: number;
  gait: number;
  dir: number;
  /** The tension, which grows their idle sway and breathing into a fidget. */
  fidget: number;
  /** Grandma's wig, the pug, a phone flash, the nun's hand: only some are used per kind. */
  wig: Spring;
  faint: Spring;
  flash: number;
  spout: Spring;
}

/** What each of them says on the way in, when they smell it, at the release, and to pass the time in a long round. */
const ARRIVAL_LINES: Record<Kind, string> = {
  chad: 'gm. up only', grandma: 'is this the DAO meeting', wif: 'wif', mev: 'front-ran you', karen: 'i need to speak to the dev', bro: "chat we're live, aping in",
  nun: 'bless this bull run', whale: 'make room, i am the market', bride: 'late. he has my seed phrase', pizza: 'pizza for floor 69, paid in btc',
};
const NOTICE_LINES: Record<Kind, string> = {
  chad: 'who aped in here', grandma: 'the pug smells a rug', wif: '*sniff* ...wif', mev: 'sandwich detected', karen: 'who approved this tx', bro: "chat, he's cooking",
  nun: "forgive him, he's leveraged", whale: 'smells like exit liquidity', bride: 'not on my wedding day', pizza: "that's NOT the pizza",
};
const CRASH_LINES: Record<Kind, string> = {
  chad: 'bro that was a rug', grandma: 'my wig!!', wif: '...wif?', mev: 'i got sandwiched', karen: "I'M CALLING THE SEC", bro: 'chat he rugged us',
  nun: 'lord have mercy', whale: 'i got liquidated', bride: 'ON MY DRESS', pizza: 'extra cheese??',
};
const OVERTIME_LINES: Record<Kind, string> = {
  chad: 'diamond hands, wet eyes', grandma: 'the DAO meeting started an hour ago', wif: 'wif... still here', mev: 'mempool is congested', karen: 'i opened a support ticket',
  bro: 'chat we are STILL live', nun: 'grant us ventilation', whale: 'this lift needs liquidity', bride: 'the cake is melting', pizza: 'the gas cost more than the pizza',
};
/** How high above the feet each kind's head (hat, veil, antenna or blowhole included) reaches, in rider space. */
const HEAD_TOP: Record<Kind, number> = { chad: -192, grandma: -206, wif: -218, mev: -122, karen: -200, bro: -202, nun: -208, whale: -242, bride: -204, pizza: -200 };
const LINE_LIFE = 2.2;

/** A speech bubble: `delay` counts down before it shows, then `age` runs to LINE_LIFE. Its place is fixed the first time it is drawn. */
export interface Line { who: Passenger; text: string; delay: number; age: number; box: { dx: number; dy: number; w: number } | null }

export interface Crowd {
  list: Passenger[];
  next: number;
  /** 0..1 everyone shoved toward the middle by the whale. */
  squeeze: Spring;
  /** Seconds the doors stay open after an arrival. */
  doorTimer: number;
  chatterClock: number;
  chatterIndex: number;
  lines: Line[];
  events: { arrived: Kind | null };
}

export function createCrowd(): Crowd {
  return { list: [], next: 0, squeeze: spring(0), doorTimer: 0, chatterClock: 0, chatterIndex: 0, lines: [], events: { arrived: null } };
}

export function resetCrowd(c: Crowd): void {
  c.list = [];
  c.next = 0;
  settleSpring(c.squeeze, 0);
  c.doorTimer = 0;
  c.chatterClock = c.chatterIndex = 0;
  c.lines = [];
}

/**
 * The release, seen live: up to four of the riders already in the cabin, picked from the crash seed, speak up
 * one after another, 0.2 to 0.65 s apart, so the first ones land inside the two seconds the crash is on screen.
 */
export function crashLines(c: Crowd, seed: number): void {
  // Whatever they were about to say goes unsaid, and whatever they were saying fades out under the release.
  c.lines = c.lines.filter((l) => l.delay <= 0);
  for (const l of c.lines) l.age = Math.max(l.age, LINE_LIFE - 0.4 * Math.min(1, l.age / 0.2));
  const rng = mulberry32(seed * 31 + 7);
  const inside = c.list.filter((p) => p.depth <= 1).map((p) => ({ p, k: rng() })).sort((a, b) => a.k - b.k).slice(0, 4);
  let at = 0;
  for (const { p } of inside) {
    at += 0.2 + 0.45 * rng();
    c.lines.push({ who: p, text: CRASH_LINES[p.kind], delay: at, age: 0, box: null });
  }
}

export const persons = (c: Crowd): number => c.list.length + 1;

/** Lets roster entry `index` in through the back doors. The seed skips the bot, so everyone keeps the look they had before it joined. */
export function admit(c: Crowd, index: number, quiet: boolean): void {
  const r = ROSTER[index]!;
  const seed = r.kind === 'mev' ? 0.5 : c.list.filter((p) => p.kind !== 'mev').length * 7.3 + 1;
  c.list.push({ kind: r.kind, slot: index, x: quiet ? r.x : DOOR.x, depth: quiet ? r.depth : 1.2, progress: quiet ? 1 : 0, age: 0, seed, mood: 'calm', turn: 0, noticed: false, walk: 0, gait: 0, dir: Math.sign(r.x - DOOR.x) || 1, fidget: 0, wig: spring(0), faint: spring(0), flash: 0, spout: spring(0) });
  if (!quiet) { c.doorTimer = 1.1; c.events.arrived = r.kind; }
}

/** Where a passenger stands once in: everyone but the whale and the bot (it got there first) is shoved toward the middle by `squeeze`. */
function placeX(p: Passenger, squeeze: number): number {
  const x = ROSTER[p.slot]!.x;
  return p.kind === 'whale' || p.kind === 'mev' ? x : 480 + (x - 480) * mix(1, 0.84, squeeze);
}

/** Jumps straight to the crowd a multiplier calls for, for a first frame mid-round: everyone in place, the ones who have smelt it already looking. */
export function settleCrowd(c: Crowd, multiplier: number): void {
  while (c.next < ROSTER.length && multiplier >= ROSTER[c.next]!.at) { admit(c, c.next, true); c.next += 1; }
  settleSpring(c.squeeze, c.list.some((p) => p.kind === 'whale') ? 1 : 0);
  for (const p of c.list) {
    const r = ROSTER[p.slot]!;
    p.x = placeX(p, c.squeeze.x);
    p.noticed = multiplier >= r.notice;
    p.mood = p.noticed ? 'sniff' : 'calm';
    p.turn = smoothstep(r.notice / 1.25, r.notice, multiplier);
  }
}

/** Jumps everyone's crash reaction to where it ends, for a crash that already happened. Nobody is still talking. */
export function settleCrash(c: Crowd): void {
  c.lines = [];
  for (const p of c.list) {
    p.turn = 1;
    if (p.kind === 'grandma') { settleSpring(p.wig, 1); settleSpring(p.faint, 1); }
    if (p.kind === 'whale') settleSpring(p.spout, 1);
  }
}

export interface CrowdDrive { running: boolean; multiplier: number; tension: number; suitX: number; gassed: boolean; gasAge: number }

export function stepCrowd(c: Crowd, drive: CrowdDrive, dt: number): void {
  c.events.arrived = null;
  if (drive.running && c.next < ROSTER.length && drive.multiplier >= ROSTER[c.next]!.at && c.doorTimer <= 0) {
    // Everyone due at the same floor comes through the same doors: the bot is first in and first to speak.
    const at = ROSTER[c.next]!.at;
    for (let delay = 0; c.next < ROSTER.length && ROSTER[c.next]!.at === at; delay += 0.7) {
      admit(c, c.next, false);
      c.next += 1;
      const who = c.list[c.list.length - 1]!;
      c.lines.push({ who, text: ARRIVAL_LINES[who.kind], delay, age: 0, box: null });
    }
  }
  // Once the lift is full, the existing riders keep reacting without adding more overlapping bodies.
  if (drive.running && !drive.gassed && c.next === ROSTER.length) {
    c.chatterClock += dt;
    if (c.chatterClock >= 7) {
      c.chatterClock %= 7;
      const who = c.list[c.chatterIndex++ % c.list.length]!;
      c.lines.push({ who, text: OVERTIME_LINES[who.kind], delay: 0, age: 0, box: null });
    }
  }
  for (const l of c.lines) { if (l.delay > 0) l.delay -= dt; else l.age += dt; }
  // One bubble per speaker: a line that has started replaces whatever that speaker was still saying.
  c.lines = c.lines.filter((l) => l.age < LINE_LIFE && !c.lines.some((o) => o !== l && o.who === l.who && o.delay <= 0 && l.delay <= 0 && o.age < l.age));
  c.doorTimer = Math.max(0, c.doorTimer - dt);
  stepSpring(c.squeeze, c.list.some((p) => p.kind === 'whale' && p.progress > 0.6) ? 1 : 0, 4, 0.7, dt);
  const squeeze = clamp(c.squeeze.x, 0, 1);
  for (const p of c.list) {
    p.age += dt;
    const r = ROSTER[p.slot]!;
    const targetX = placeX(p, squeeze);
    const fromX = p.x;
    const fromY = depthFloor(p.depth);
    if (p.progress < 1) {
      // The bot zips in at twice the pace of anyone else.
      p.progress = Math.min(1, p.progress + dt / (p.kind === 'mev' ? 0.45 : 0.85));
      const k = smoothstep(0, 1, p.progress);
      p.x = mix(DOOR.x, targetX, k);
      p.depth = mix(1.2, r.depth, k);
    } else {
      p.x += (targetX - p.x) * (1 - Math.exp(-dt * 4));
    }
    // The feet follow the ground covered, on the way in and in the whale's shove alike, and the stride eases in and out with the speed.
    const moved = Math.hypot(p.x - fromX, depthFloor(p.depth) - fromY) / depthScale(p.depth);
    p.walk += moved;
    if (dt > 0) {
      if (moved / dt > 6) p.dir = Math.sign(p.x - fromX) || p.dir;
      p.gait += (clamp(moved / dt / 30, 0, 1) - p.gait) * (1 - Math.exp(-dt * 10));
    }
    // Each of them smells it at their own number: the eyes turn first, then the sniff, the quirk and a line once they are in place.
    p.fidget = drive.tension;
    const smelt = drive.running && drive.multiplier >= r.notice;
    // Eased, so an arm, a phone or a bouquet never jumps into place when the release turns every head at once.
    const look = drive.gassed ? 1 : drive.running ? smoothstep(r.notice / 1.25, r.notice, drive.multiplier) : 0;
    p.turn += (look - p.turn) * (1 - Math.exp(-dt / 0.15));
    p.mood = drive.gassed ? 'disgust' : smelt ? 'sniff' : 'calm';
    if (smelt && !drive.gassed && !p.noticed && p.progress >= 1) {
      p.noticed = true;
      // After whatever they are still saying.
      const busy = c.lines.find((l) => l.who === p);
      c.lines.push({ who: p, text: NOTICE_LINES[p.kind], delay: busy ? Math.max(0, busy.delay) + LINE_LIFE - busy.age + 0.1 : 0.15, age: 0, box: null });
    }
    if (drive.gassed) {
      if (p.kind === 'grandma') stepSpring(p.wig, 1, 9, 0.35, dt);
      if (p.kind === 'grandma') stepSpring(p.faint, drive.gasAge > 0.35 ? 1 : 0, 7, 0.6, dt);
      if (p.kind === 'whale') stepSpring(p.spout, drive.gasAge > 0.2 ? 1 : 0, 6, 0.5, dt);
      if (p.kind === 'bro') p.flash = drive.gasAge > 0.5 && drive.gasAge < 0.62 ? 1 : 0;
    } else {
      settleSpring(p.wig, 0);
      settleSpring(p.faint, 0);
      settleSpring(p.spout, 0);
      p.flash = 0;
    }
  }
  void drive.suitX;
}

export type SuitMode = 'idle' | 'holding' | 'leaving' | 'gone' | 'released';

export interface Suit {
  exitFrom: Point;
  mode: SuitMode;
  modeAge: number;
  time: number;
  x: number;
  depth: number;
  tension: number;
  /** The strain he shows (the tension, eased) and how much he is holding at all (0 .. 1), so nothing snaps when he lets go or gets off. */
  strain: number;
  hold: number;
  /** The clench's running phase: it quickens with the strain without ever jumping. */
  clench: number;
  cheeks: Spring;
  shades: Spring;
  blush: Spring;
  eyeOpen: Spring;
  blinkAt: number;
  stride: number;
}

const SUIT_HOME: Point = { x: 452, y: 0.36 };

export function createSuit(): Suit {
  return { exitFrom: { ...SUIT_HOME }, mode: 'idle', modeAge: 0, time: 0, x: SUIT_HOME.x, depth: SUIT_HOME.y, tension: 0, strain: 0, hold: 0, clench: 0, cheeks: spring(0), shades: spring(0), blush: spring(0), eyeOpen: spring(1), blinkAt: 2, stride: 0 };
}

export function resetSuit(s: Suit): void {
  s.mode = 'idle';
  s.modeAge = 0;
  s.x = SUIT_HOME.x;
  s.depth = SUIT_HOME.y;
  s.strain = s.hold = 0;
  settleSpring(s.cheeks, 0);
  settleSpring(s.shades, 0);
  settleSpring(s.blush, 0);
}

/** Jumps straight to the suit a round in progress calls for, for a first frame mid-round: holding it in, or already off at his floor. */
export function settleSuit(s: Suit, tension: number, squeeze: number, off: boolean): void {
  if (off) {
    s.mode = 'gone';
    s.modeAge = 10;
    s.x = DOOR.x;
    s.depth = 1.18;
    s.strain = s.hold = 0;
    settleSpring(s.shades, 1);
  } else {
    s.mode = 'holding';
    s.x = SUIT_HOME.x - 36 * squeeze;
    s.tension = s.strain = tension;
    s.hold = 1;
    settleSpring(s.cheeks, 0.35 + 0.65 * tension);
  }
}

/** The exit was accepted: this is his floor. */
export function leaveLift(s: Suit): void {
  if (s.mode === 'holding' || s.mode === 'idle') { s.exitFrom = { x: s.x, y: s.depth }; s.mode = 'leaving'; s.modeAge = 0; s.stride = 0; }
}

/** The crash caught him inside. */
export function releaseSuit(s: Suit, quiet: boolean): void {
  if (s.mode === 'gone' || s.mode === 'leaving') return;
  s.mode = 'released';
  s.modeAge = quiet ? 10 : 0;
  if (quiet) { s.strain = s.hold = 0; settleSpring(s.cheeks, 0); settleSpring(s.blush, 1); }
}

export interface SuitDrive { running: boolean; tension: number; squeeze: number }

export function stepSuit(s: Suit, drive: SuitDrive, dt: number): void {
  s.time += dt;
  s.modeAge += dt;
  s.tension = drive.tension;
  if (s.mode === 'idle' && drive.running) { s.mode = 'holding'; s.modeAge = 0; }
  if (s.mode === 'leaving') {
    const k = smoothstep(0, 1, Math.min(1, s.modeAge / 0.9));
    s.x = mix(s.exitFrom.x, DOOR.x, k);
    s.depth = mix(s.exitFrom.y, 1.18, k);
    s.stride = Math.hypot(s.x - s.exitFrom.x, depthFloor(s.depth) - depthFloor(s.exitFrom.y));
    if (s.modeAge >= 0.9) { s.mode = 'gone'; s.modeAge = 0; }
  } else if (s.mode !== 'gone') {
    const home = SUIT_HOME.x - 36 * drive.squeeze;
    s.x += (home - s.x) * (1 - Math.exp(-dt * 4));
  }
  const holding = s.mode === 'holding';
  // The strain eases in and out (quicker at the release), and the clench's rate rises from 1 to 2.5 a second with it.
  const ease = 1 - Math.exp(-dt / (s.mode === 'released' ? 0.18 : 0.3));
  s.strain += ((holding ? drive.tension : 0) - s.strain) * ease;
  s.hold += ((holding ? 1 : 0) - s.hold) * ease;
  s.clench = (s.clench + dt * Math.PI * 2 * mix(1, 2.5, s.strain)) % (Math.PI * 2);
  stepSpring(s.cheeks, holding ? 0.35 + 0.65 * drive.tension : 0, s.mode === 'released' ? 18 : 6, s.mode === 'released' ? 0.4 : 0.8, dt);
  stepSpring(s.shades, s.mode === 'gone' && s.modeAge > 0.25 ? 1 : 0, 12, 0.5, dt);
  stepSpring(s.blush, s.mode === 'released' && s.modeAge > 0.7 ? 1 : 0, 5, 0.8, dt);
  const blinking = s.time > s.blinkAt && s.time < s.blinkAt + 0.12;
  if (s.time >= s.blinkAt + 0.12) s.blinkAt = s.time + 2 + 3 * noise(s.blinkAt);
  const relief = s.mode === 'released' && s.modeAge < 0.7;
  stepSpring(s.eyeOpen, relief ? 0.05 : blinking ? 0.08 : holding ? 1 - 0.75 * drive.tension : 1, 24, 0.9, dt);
}

/** Skin colour from pale to red to purple as he holds it. */
function suitSkin(t: number): string {
  const stops: [number, number, number][] = [[243, 220, 203], [232, 96, 96], [150, 70, 160]];
  const [a, b, k] = t < 0.55 ? [stops[0]!, stops[1]!, t / 0.55] : [stops[1]!, stops[2]!, (t - 0.55) / 0.45];
  return `rgb(${Math.round(mix(a[0], b[0], k))}, ${Math.round(mix(a[1], b[1], k))}, ${Math.round(mix(a[2], b[2], k))})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, line = 2.5): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = line; ctx.stroke();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, line = 2.5): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (line > 0) { ctx.strokeStyle = INK; ctx.lineWidth = line; ctx.stroke(); }
}

function line(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, width: number, colour: string): void {
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
}

/** A limb with an ink border. */
function limb(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, width: number, colour: string): void {
  line(ctx, ax, ay, bx, by, width + 4, INK);
  line(ctx, ax, ay, bx, by, width, colour);
}

interface Face { eyeOpen: number; gaze: number; brow: number; mouth: 'smile' | 'flat' | 'o' | 'grim' | 'wavy' | 'tight' | 'whistle' | 'x'; skin: string; blush?: number; cheeks?: number; sweat?: number; vein?: number; nose?: boolean }

/** A head at (0, -158) in rider space. */
function drawHead(ctx: CanvasRenderingContext2D, face: Face, time: number, rx = 22, ry = 26): void {
  const hy = -158;
  ellipse(ctx, 0, hy, rx, ry, face.skin, 2.5);
  // Ears.
  ellipse(ctx, -rx, hy + 2, 5, 7, face.skin, 2);
  ellipse(ctx, rx, hy + 2, 5, 7, face.skin, 2);
  const cheeks = face.cheeks ?? 0;
  if (cheeks > 0.02) {
    ellipse(ctx, -rx * 0.62, hy + 8, 6 + 9 * cheeks, 5 + 8 * cheeks, face.skin, 2);
    ellipse(ctx, rx * 0.62, hy + 8, 6 + 9 * cheeks, 5 + 8 * cheeks, face.skin, 2);
  }
  if ((face.blush ?? 0) > 0.02) {
    ctx.fillStyle = `rgba(255, 90, 120, ${0.45 * face.blush!})`;
    ctx.beginPath(); ctx.ellipse(-11, hy + 8, 7, 4, 0, 0, Math.PI * 2); ctx.ellipse(11, hy + 8, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (face.mouth === 'x') {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    for (const ex of [-8, 8]) { ctx.beginPath(); ctx.moveTo(ex - 4, hy - 8); ctx.lineTo(ex + 4, hy); ctx.moveTo(ex + 4, hy - 8); ctx.lineTo(ex - 4, hy); ctx.stroke(); }
  } else {
    for (const ex of [-8, 8]) {
      ctx.beginPath(); ctx.ellipse(ex, hy - 4, 5, 5 * clamp(face.eyeOpen, 0.08, 1.4), 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
      if (face.eyeOpen > 0.2) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + 2.4 * face.gaze, hy - 3, 2.2, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // Brows: positive knits them, negative lifts them.
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, hy - 13 + 2 * face.brow); ctx.lineTo(-3, hy - 12 - 4 * face.brow); ctx.moveTo(3, hy - 12 - 4 * face.brow); ctx.lineTo(14, hy - 13 + 2 * face.brow); ctx.stroke();
  if (face.nose !== false) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1, hy - 2); ctx.lineTo(4, hy + 5); ctx.lineTo(-1, hy + 6); ctx.stroke(); }
  if ((face.vein ?? 0) > 0.02) {
    ctx.strokeStyle = `rgba(120, 40, 160, ${face.vein!})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, hy - 22); ctx.lineTo(13, hy - 17); ctx.lineTo(9, hy - 13); ctx.lineTo(14, hy - 9); ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  const my = hy + 13;
  ctx.beginPath();
  switch (face.mouth) {
    case 'smile': ctx.moveTo(-7, my); ctx.quadraticCurveTo(0, my + 6, 7, my); ctx.stroke(); break;
    case 'flat': ctx.moveTo(-6, my + 1); ctx.lineTo(6, my + 1); ctx.stroke(); break;
    case 'tight': ctx.moveTo(-8, my + 1); ctx.lineTo(8, my + 1); ctx.lineWidth = 3.2; ctx.stroke(); break;
    case 'grim': ctx.moveTo(-7, my + 3); ctx.quadraticCurveTo(0, my - 4, 7, my + 3); ctx.stroke(); break;
    case 'wavy': ctx.moveTo(-9, my); for (let i = 1; i <= 6; i += 1) ctx.lineTo(-9 + i * 3, my + (i % 2 ? -2.5 : 2.5) + Math.sin(time * 16 + i) * 0.8); ctx.stroke(); break;
    case 'o': ctx.ellipse(0, my + 2, 5, 7, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.stroke(); break;
    case 'whistle': ctx.ellipse(3, my + 2, 3, 3.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.stroke(); break;
    case 'x': ctx.moveTo(-6, my + 3); ctx.quadraticCurveTo(0, my - 3, 6, my + 3); ctx.stroke(); break;
  }
  const sweat = face.sweat ?? 0;
  const sites = [[-20, -178], [20, -182], [-14, -150]] as const;
  for (let i = 0; i < sweat; i += 1) {
    const p = (time / 1.1 + i * 0.37) % 1;
    const [sx, sy] = sites[i]!;
    const y = sy + 24 * p * p;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.moveTo(sx, y - 6); ctx.lineTo(sx + 3.5, y); ctx.arc(sx, y + 1, 3.5, -0.3, Math.PI + 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Legs from the hips to the soles, which stay on the floor. `buckle` (the clench) drops the hips and sets the feet apart so
 * the knees press together without crossing; `walk` is the ground covered in rider space and `weight` how much of a stride is
 * in it. `knees` is 'in' (knock-kneed) or the way the rider faces (1 right, -1 left); either way the bend never flips side.
 */
function drawLegs(ctx: CanvasRenderingContext2D, colour: string, buckle: number, walk: number, direction = 1, weight = 1, knees: 'in' | number = direction): void {
  for (const side of [-1, 1]) {
    const step = weight > 0.001 ? stepFoot(walk, 44, side > 0 ? .5 : 0, 10) : { x: 0, y: 0 };
    const hip = { x: side * 10, y: -72 + buckle * 6 };
    const foot = { x: side * (12 + 12 * buckle) + step.x * direction * weight, y: step.y * weight };
    const knee = solveLimb(hip, foot, 37, 36, knees === 'in' ? side : -knees).joint;
    limb(ctx, hip.x, hip.y, knee.x, knee.y, 14, colour);
    limb(ctx, knee.x, knee.y, foot.x, foot.y, 13, colour);
    roundRect(ctx, foot.x - 12, foot.y - 6, 24, 9, 4, '#2b2b30', 2);
  }
}

function drawShades(ctx: CanvasRenderingContext2D, k: number): void {
  if (k < 0.02) return;
  const dy = -90 * (1 - k);
  ctx.fillStyle = INK;
  for (const ex of [-8, 8]) { ctx.fillRect(ex - 8, -168 + dy, 16, 8); ctx.fillRect(ex - 6, -160 + dy, 12, 4); }
  ctx.fillRect(-2, -166 + dy, 4, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const ex of [-8, 8]) ctx.fillRect(ex - 6, -166 + dy, 5, 2);
}

/** Two green wisps curling up from a nose at (x, y), drifting toward -x. */
function wisps(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.strokeStyle = 'rgba(120, 200, 100, 0.8)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i += 1) { const p = (time * 1.4 + i * 0.5) % 1; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.moveTo(x - p * 8, y - p * 10); ctx.quadraticCurveTo(x - 4 - p * 8, y - 4 - p * 10, x - 2 - p * 8, y - 8 - p * 10); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

/** The pug on its leash, at grandma's feet; it sniffs first, then faints. */
function drawPug(ctx: CanvasRenderingContext2D, mood: Mood, faint: number, time: number): void {
  ctx.save();
  ctx.translate(38, 0);
  ctx.rotate(-faint * Math.PI * 0.5);
  ctx.translate(0, faint * 6);
  ellipse(ctx, 0, -14, 16, 11, '#d8b78f');
  ellipse(ctx, -14, -24, 11, 10, '#d8b78f');
  ellipse(ctx, -17, -26, 6, 5, '#3a2a22', 1.5);
  for (const side of [-1, 1]) { ellipse(ctx, -14 + side * 9, -32, 3.5, 5, '#3a2a22', 1.5); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(14, -20, 5, 0, Math.PI * 1.5); ctx.stroke();
  for (const side of [-1, 1]) line(ctx, side * 6, -6, side * 7, 0, 5, '#c9a67c');
  if (faint > 0.5) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    for (const ex of [-18, -11]) { ctx.beginPath(); ctx.moveTo(ex - 2, -30); ctx.lineTo(ex + 2, -26); ctx.moveTo(ex + 2, -30); ctx.lineTo(ex - 2, -26); ctx.stroke(); }
  } else {
    const wide = mood === 'sniff' ? 1.3 : 1;
    for (const ex of [-18, -11]) { ctx.beginPath(); ctx.arc(ex, -28, 2.6 * wide, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + (mood === 'sniff' ? 1.2 : 0), -28, 1.4, 0, Math.PI * 2); ctx.fill(); }
    if (mood === 'sniff') wisps(ctx, -22, -26, time);
  }
  ctx.restore();
}

/** Draws one passenger in rider space: feet at the origin, facing the viewer. */
export function drawPassenger(ctx: CanvasRenderingContext2D, p: Passenger, gazeX: number, time: number): void {
  const s = depthScale(p.depth);
  ctx.save();
  ctx.translate(p.x, depthFloor(p.depth));
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(20, 24, 30, 0.18)';
  ctx.beginPath(); ctx.ellipse(0, 2, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
  {
    // Nobody stands frozen: a slow sway about the soles and a breath, each their own pace, growing into a fidget as the air goes.
    const amp = 1 + 2 * p.fidget;
    ctx.rotate((Math.sin(time * (0.6 + 0.4 * noise(p.seed)) + p.seed) * 1.5 * amp) / 190);
    ctx.scale(1, 1 + 0.012 * amp * Math.sin(time * (1.5 + 0.6 * noise(p.seed + 2)) + p.seed * 2));
  }
  const stride = p.walk;
  const gaitWeight = p.gait;
  const direction = p.dir;
  const facing = Math.sign(ROSTER[p.slot]!.x - DOOR.x) || 1;
  // The eyes come round as they start to smell it; `act` brings in each kind's quirk.
  const gaze = clamp((gazeX - p.x) / 120, -1, 1) * p.turn;
  const act = smoothstep(0.55, 1, p.turn);
  const mood = p.mood;
  const base: Face = { eyeOpen: mood === 'disgust' ? 1.25 : 1, gaze, brow: mood === 'disgust' ? 0.9 : mood === 'sniff' ? 0.4 : 0, mouth: mood === 'disgust' ? 'grim' : mood === 'sniff' ? 'flat' : 'smile', skin: SKIN };
  const seedTone = noise(p.seed * 3.3);
  const skin = seedTone > 0.66 ? SKIN : seedTone > 0.33 ? '#e0bda7' : '#c68e6a';
  base.skin = skin;
  // Keep soles on the cabin floor; knee flex carries the weight shift.
  switch (p.kind) {
    case 'chad': {
      drawLegs(ctx, '#3d5f8f', 0, stride, direction, gaitWeight, facing);
      roundRect(ctx, -30, -136, 60, 66, 10, '#f2f2f2');
      // Crossed arms.
      limb(ctx, -30, -120, 22, -100, 15, skin);
      limb(ctx, 30, -120, -22, -96, 15, skin);
      drawHead(ctx, { ...base, mouth: mood === 'disgust' ? 'grim' : 'flat', brow: 0.6 }, time, 23, 26);
      // A jaw for days, and a nose pinched at the crash.
      ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-22, -152); ctx.lineTo(-20, -132); ctx.lineTo(20, -132); ctx.lineTo(22, -152); ctx.stroke();
      ctx.fillStyle = 'rgba(28, 31, 38, 0.35)';
      ctx.beginPath(); ctx.moveTo(-18, -140); ctx.lineTo(-16, -133); ctx.lineTo(16, -133); ctx.lineTo(18, -140); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b2b30';
      ctx.beginPath(); ctx.ellipse(0, -180, 24, 8, 0, Math.PI, Math.PI * 2); ctx.fill();
      if (mood === 'disgust') { limb(ctx, 30, -120, 6, -150, 12, skin); ellipse(ctx, 4, -152, 6, 6, skin, 2); }
      if (mood === 'sniff') wisps(ctx, -4, -152, time);
      break;
    }
    case 'grandma': {
      drawLegs(ctx, '#d9c7b8', 0, stride, direction, gaitWeight, facing);
      roundRect(ctx, -32, -138, 64, 72, 14, '#b56ba0');
      ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.arc(-20 + (i % 3) * 20, -122 + Math.floor(i / 3) * 26, 3.5, 0, Math.PI * 2); ctx.fill(); }
      limb(ctx, -30, -124, -44, -76, 11, skin);
      limb(ctx, 30, -124, 40, -74, 11, skin);
      line(ctx, 40, -74, 44, 0, 4, '#7a5230');
      drawHead(ctx, { ...base, mouth: mood === 'disgust' ? 'o' : 'smile', eyeOpen: mood === 'disgust' ? 1.4 : 0.9 }, time);
      // Glasses.
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-8, -162, 7, 0, Math.PI * 2); ctx.arc(8, -162, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1, -162); ctx.lineTo(1, -162); ctx.stroke();
      // The wig: a grey bun that lifts clean off at the crash.
      const lift = clamp(p.wig.x, 0, 1) * 60;
      ellipse(ctx, 0, -180 - lift, 24, 11, '#d5d5d5');
      ellipse(ctx, 0, -192 - lift, 11, 9, '#d5d5d5');
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-44, -76); ctx.lineTo(38 + 0, -8); ctx.stroke();
      // The pug smells it before she does.
      drawPug(ctx, mood === 'calm' && p.turn > 0.5 ? 'sniff' : mood, clamp(p.faint.x, 0, 1), time);
      break;
    }
    case 'wif': {
      // A Shiba in the pink wif hat.
      drawLegs(ctx, '#e9a552', 0, stride, direction, gaitWeight, facing);
      roundRect(ctx, -28, -132, 56, 62, 12, '#e9a552');
      ellipse(ctx, 0, -104, 14, 18, '#fbe9cf', 0);
      limb(ctx, -28, -118, -36, -80, 12, '#e9a552');
      limb(ctx, 28, -118, 30, -84, 12, '#e9a552');
      roundRect(ctx, 22, -100, 16, 24, 3, '#2b2b30', 2);
      ellipse(ctx, 0, -158, 26, 24, '#e9a552');
      ellipse(ctx, 0, -148, 15, 11, '#fbe9cf', 0);
      // The ears go flat as it smells it.
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * 10, -178); ctx.lineTo(side * mix(24, 36, act), mix(-200, -186, act)); ctx.lineTo(side * 26, -172); ctx.closePath();
        ctx.fillStyle = '#e9a552'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      }
      const wide = mood === 'disgust' ? 1.4 : 1;
      for (const ex of [-9, 9]) { ellipse(ctx, ex, -162, 3.5, 3.5 * wide, INK, 0); }
      ellipse(ctx, 0, -150, 4, 3, INK, 0);
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); if (mood === 'disgust') { ctx.moveTo(-6, -142); ctx.lineTo(6, -142); } else { ctx.moveTo(-6, -144); ctx.quadraticCurveTo(0, -139, 6, -144); } ctx.stroke();
      if (mood !== 'disgust') { ctx.fillStyle = '#ff7ab8'; ctx.beginPath(); ctx.ellipse(3, -140, 4, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      // The hat.
      ctx.save();
      ctx.beginPath(); ctx.rect(-40, -215, 80, 40); ctx.clip();
      ellipse(ctx, 0, -178, 28, 24, '#ff7ab8');
      ctx.restore();
      roundRect(ctx, -30, -181, 60, 12, 5, '#ffb3d6');
      ellipse(ctx, 6, -204, 8, 8, '#ffdbea');
      break;
    }
    case 'mev': {
      // The MEV bot: a box on one wheel with a ticker for a face. It front-runs the door and leaves a streak behind it.
      if (p.gait > 0.05) {
        ctx.strokeStyle = `rgba(124, 246, 124, ${0.55 * p.gait})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const sy of [-44, -64, -84]) { ctx.beginPath(); ctx.moveTo(-direction * 32, sy); ctx.lineTo(-direction * (32 + 56 * p.gait), sy); ctx.stroke(); }
      }
      ellipse(ctx, 0, -12, 12, 12, '#2b2b30');
      ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2;
      // The spoke turns with the ground covered, the way it rolls.
      const roll = (facing * p.walk) / 12;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(Math.cos(roll) * 9, -12 + Math.sin(roll) * 9); ctx.stroke();
      line(ctx, 0, -24, 0, -32, 8, INK);
      limb(ctx, -24, -72, mix(-38, -30, act), mix(-52, -94, act), 6, '#9aa3ad');
      limb(ctx, 24, -72, 38, -52, 6, '#9aa3ad');
      roundRect(ctx, -26, -98, 52, 68, 8, '#59606e');
      roundRect(ctx, -19, -92, 38, 26, 4, '#10151c', 2);
      ctx.fillStyle = mood === 'disgust' ? '#ff4d6d' : mood === 'sniff' ? '#ffb703' : '#7cf67c';
      if (mood === 'disgust') { ctx.font = '900 13px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('x  x', 0, -73); }
      else for (const ex of [-11, 4]) ctx.fillRect(ex + 3 * gaze, -84 + (mood === 'sniff' ? 3 : 0), 7, mood === 'sniff' ? 3 : 6);
      ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#7cf67c'; ctx.fillText('MEV', 0, -44);
      line(ctx, 12, -98, 16, -112, 2.5, INK);
      ellipse(ctx, 16, -115, 3.5, 3.5, mood !== 'calm' && Math.floor(time * 4) % 2 === 0 ? '#ff4d6d' : '#ffe27a', 1.5);
      break;
    }
    case 'karen': {
      drawLegs(ctx, '#1f2a44', 0, stride, direction, gaitWeight, facing);
      roundRect(ctx, -28, -136, 56, 66, 10, '#e3a1c7');
      limb(ctx, -28, -122, -40, -92, 12, skin);
      limb(ctx, -40, -92, -22, -78, 12, skin);
      // She glares, and the phone comes up to her ear: she would like to speak to the dev.
      drawHead(ctx, { ...base, mouth: mood === 'disgust' ? 'o' : 'grim', brow: mix(0.8, 1.1, act), eyeOpen: mood === 'disgust' ? 1.5 : mix(1, 0.5, act) }, time);
      // The asymmetric bob.
      ctx.fillStyle = '#f2d16b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-26, -160); ctx.quadraticCurveTo(-24, -196, 0, -190); ctx.quadraticCurveTo(26, -196, 28, -160); ctx.lineTo(30, -146); ctx.lineTo(20, -146); ctx.lineTo(18, -168); ctx.quadraticCurveTo(4, -176, -16, -170); ctx.lineTo(-22, -150); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd166';
      for (const ex of [-24, 24]) { ctx.beginPath(); ctx.arc(ex, -146, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      const hand = { x: mix(36, 31, act), y: mix(-96, -146, act) };
      limb(ctx, 28, -122, hand.x, hand.y, 12, skin);
      roundRect(ctx, hand.x - 8, hand.y - 18, 14, 22, 3, '#2b2b30', 2);
      break;
    }
    case 'bro': {
      drawLegs(ctx, '#4a4a55', 0, stride, direction, gaitWeight, facing);
      roundRect(ctx, -29, -136, 58, 66, 10, '#7c3aed');
      limb(ctx, -29, -122, -36, -84, 12, '#7c3aed');
      // Phone held up, filming.
      limb(ctx, 29, -122, 40, -160, 12, '#7c3aed');
      // Something is happening: the phone turns to landscape.
      ctx.save(); ctx.translate(41, -172); ctx.rotate(-act * Math.PI / 2);
      roundRect(ctx, -9, -16, 18, 32, 4, '#1b1b1f', 2);
      ctx.fillStyle = mood === 'disgust' || (Math.floor(time * 2) % 2 === 0) ? '#e63946' : '#6b1c24';
      ctx.beginPath(); ctx.arc(0, -10, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (p.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(41, -172, 40, 0, Math.PI * 2); ctx.fill(); }
      drawHead(ctx, { ...base, mouth: mood === 'disgust' ? 'o' : 'smile' }, time);
      // Backwards cap.
      ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -176, 22, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      roundRect(ctx, -24, -180, 48, 7, 3, '#e63946', 2);
      roundRect(ctx, -34, -181, 14, 6, 3, '#e63946', 2);
      break;
    }
    case 'nun': {
      drawLegs(ctx, '#1b1b1f', 0, stride, direction, gaitWeight, facing);
      ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-26, -136); ctx.lineTo(26, -136); ctx.lineTo(36, -4); ctx.lineTo(-36, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
      roundRect(ctx, -12, -136, 24, 26, 3, '#ffffff', 2);
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(-1.5, -126, 3, 12); ctx.fillRect(-5, -122, 10, 3);
      // Hands folded; once she smells it she crosses herself now and then, and keeps at it after the release.
      const beat = Math.floor(time * 1.6) % 7;
      const cross = mood === 'disgust' ? (Math.floor(time * 3) % 4) : mood === 'sniff' && beat < 4 ? beat : -1;
      const hand = cross < 0 ? { x: 0, y: -84 } : [{ x: 0, y: -160 }, { x: 0, y: -110 }, { x: -22, y: -130 }, { x: 22, y: -130 }][cross]!;
      limb(ctx, -26, -124, hand.x - 6, hand.y, 11, '#1b1b1f');
      limb(ctx, 26, -124, hand.x + 6, hand.y, 11, '#1b1b1f');
      ellipse(ctx, hand.x, hand.y, 8, 7, skin, 2);
      drawHead(ctx, { ...base, mouth: mood === 'disgust' ? 'o' : 'smile', brow: mood === 'disgust' ? -0.8 : -0.2, eyeOpen: mood === 'disgust' ? 1.5 : 0.9 }, time, 20, 24);
      // Coif and veil.
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-24, -150); ctx.quadraticCurveTo(-26, -196, 0, -196); ctx.quadraticCurveTo(26, -196, 24, -150); ctx.lineTo(18, -150); ctx.quadraticCurveTo(18, -186, 0, -186); ctx.quadraticCurveTo(-18, -186, -18, -150); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1b1b1f';
      ctx.beginPath(); ctx.moveTo(-26, -160); ctx.quadraticCurveTo(-30, -204, 0, -204); ctx.quadraticCurveTo(30, -204, 26, -160); ctx.lineTo(30, -140); ctx.lineTo(24, -140); ctx.lineTo(24, -162); ctx.quadraticCurveTo(22, -194, 0, -194); ctx.quadraticCurveTo(-22, -194, -24, -162); ctx.lineTo(-24, -140); ctx.lineTo(-30, -140); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'whale': {
      drawLegs(ctx, '#2b2b30', 0, stride, direction, gaitWeight, facing);
      roundRect(ctx, -60, -150, 120, 80, 18, '#2b2b30');
      roundRect(ctx, -14, -150, 28, 60, 4, '#ffffff', 2);
      ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-5, -148); ctx.lineTo(5, -148); ctx.lineTo(3, -100); ctx.lineTo(0, -94); ctx.lineTo(-3, -100); ctx.closePath(); ctx.fill(); ctx.stroke();
      limb(ctx, -60, -132, -72, -80, 16, '#2b2b30');
      limb(ctx, 60, -132, 72, -80, 16, '#2b2b30');
      ellipse(ctx, -72, -76, 9, 8, '#5b8fd6', 2);
      ellipse(ctx, 72, -76, 9, 8, '#5b8fd6', 2);
      // The head: a blue whale, baleen grin, one small eye, a blowhole that goes at the crash.
      ellipse(ctx, 0, -190, 70, 48, '#4f86c6');
      ctx.fillStyle = '#c8dcf0';
      ctx.beginPath(); ctx.ellipse(0, -166, 60, 18, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(28, 31, 38, 0.5)'; ctx.lineWidth = 1.5;
      for (let i = -50; i <= 50; i += 10) { ctx.beginPath(); ctx.moveTo(i, -166); ctx.lineTo(i, -152 + Math.abs(i) * 0.2); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); if (mood === 'disgust') { ctx.moveTo(-40, -164); ctx.quadraticCurveTo(0, -176, 40, -164); } else { ctx.moveTo(-46, -170); ctx.quadraticCurveTo(0, -150, 46, -170); } ctx.stroke();
      ellipse(ctx, 34, -198, 5, mood === 'disgust' ? 7 : mood === 'sniff' ? 3.6 : 5, '#ffffff', 1.6);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(35 + gaze * 1.5, -197, 2.4, 0, Math.PI * 2); ctx.fill();
      const spout = clamp(p.spout.x, 0, 1);
      if (spout > 0.02) {
        ctx.strokeStyle = 'rgba(160, 220, 255, 0.85)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (const a of [-0.35, 0, 0.35]) { ctx.beginPath(); ctx.moveTo(-6, -234); ctx.quadraticCurveTo(-6 + Math.sin(a) * 30 * spout, -234 - 40 * spout, -6 + Math.sin(a) * 50 * spout, -234 - 60 * spout); ctx.stroke(); }
      }
      break;
    }
    case 'bride': {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-22, -136); ctx.lineTo(22, -136); ctx.lineTo(46, 0); ctx.lineTo(-46, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(28, 31, 38, 0.25)'; ctx.lineWidth = 1.5;
      for (const x of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(x * 0.5, -120); ctx.lineTo(x * 1.8, -4); ctx.stroke(); }
      // The bouquet, which comes up under her nose once she smells it: drawn over the face only once it is clear of the chin.
      const raise = act * 52;
      const bouquet = (): void => {
        limb(ctx, -22, -124, -16, -86 - raise, 11, skin);
        limb(ctx, 22, -124, 16, -86 - raise, 11, skin);
        for (const [bx, by, c] of [[-8, -92, '#e63946'], [0, -98, '#ff7ab8'], [8, -92, '#ffe27a'], [-3, -86, '#e63946'], [5, -84, '#ff7ab8']] as const) { ellipse(ctx, bx, by - raise, 6, 6, c, 1.5); }
      };
      if (act < 0.5) bouquet();
      drawHead(ctx, { ...base, mouth: mood === 'disgust' ? 'o' : 'smile', eyeOpen: mood === 'disgust' ? 1.5 : 1.1, brow: mood === 'disgust' ? -0.9 : -0.3 }, time);
      // Veil and tiara.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-24, -178); ctx.quadraticCurveTo(-44, -140, -36, -80); ctx.lineTo(-24, -84); ctx.lineTo(-22, -160); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(24, -178); ctx.quadraticCurveTo(44, -140, 36, -80); ctx.lineTo(24, -84); ctx.lineTo(22, -160); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3a22';
      ctx.beginPath(); ctx.ellipse(0, -180, 24, 12, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, -186); ctx.lineTo(-8, -198); ctx.lineTo(-2, -188); ctx.lineTo(4, -200); ctx.lineTo(10, -188); ctx.lineTo(14, -186); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (act >= 0.5) bouquet();
      break;
    }
    case 'pizza': {
      drawLegs(ctx, '#2f6f4f', 0, stride, direction, gaitWeight, facing);
      roundRect(ctx, -28, -136, 56, 66, 10, '#e63946');
      // Boxes stacked up past the head.
      limb(ctx, -28, -122, -30, -104, 12, '#e63946');
      limb(ctx, 28, -122, 30, -104, 12, '#e63946');
      for (let i = 0; i < 6; i += 1) roundRect(ctx, -34, -116 - i * 16 + Math.sin(time * 3 + i) * (mood === 'disgust' ? 3 : mood === 'sniff' ? 1.6 : 0.6), 68, 15, 2, i % 2 ? '#f0d9a8' : '#e8c98f', 2);
      ctx.fillStyle = '#e63946'; ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('HOT', 0, -152);
      drawHead(ctx, { ...base, mouth: mood === 'disgust' ? 'grim' : 'flat' }, time);
      roundRect(ctx, -24, -186, 48, 12, 4, '#e63946', 2);
      roundRect(ctx, -6, -196, 12, 12, 3, '#e63946', 2);
      break;
    }
  }
  ctx.restore();
}

export interface SuitView { head: Point; visible: boolean }

/** The suit in rider space, with the trembling, the clench, the buckle, the colour and the cheeks. */
export function drawSuit(ctx: CanvasRenderingContext2D, s: Suit, time: number): SuitView {
  const scale = depthScale(s.depth);
  const holding = s.mode === 'holding';
  const t = s.strain;
  // A tremble from the first floor that hardens with the strain, and eases out with his hold instead of stopping dead.
  // It shakes him from the hips up; his soles stay planted.
  const tremble = (0.8 + 2.4 * t) * s.hold;
  const shake = { x: Math.sin(time * 47) * tremble, y: Math.cos(time * 53) * tremble * 0.4 };
  const x = s.x;
  const y = depthFloor(s.depth);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(20, 24, 30, 0.18)';
  ctx.beginPath(); ctx.ellipse(0, 2, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
  // The clench: a squeeze about the soles, once a second at first and two and a half by the end.
  { const q = 0.03 * s.hold * (0.35 + 0.65 * t) * Math.max(0, Math.sin(s.clench)) ** 2; ctx.scale(1 + q, 1 - q); }
  // He steps only on his way out; standing, holding or letting go, his feet stay where they are.
  const walking = s.mode === 'leaving';
  // Knees together, feet apart and hips down as he strains; the upper body sinks further, over the tops of his legs.
  drawLegs(ctx, '#3a3f4f', t, walking ? s.stride / scale : 0, 1, walking ? Math.sin(Math.PI * clamp(s.modeAge / .9, 0, 1)) : 0, 'in');
  ctx.translate(shake.x, 14 * t + shake.y);
  roundRect(ctx, -30, -138, 60, 70, 10, '#4a5068');
  roundRect(ctx, -10, -138, 20, 44, 3, '#ffffff', 2);
  ctx.fillStyle = '#c0392b'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, -136); ctx.lineTo(4, -136); ctx.lineTo(3, -102); ctx.lineTo(0, -96); ctx.lineTo(-3, -102); ctx.closePath(); ctx.fill(); ctx.stroke();
  const released = s.mode === 'released';
  const gone = s.mode === 'gone';
  if (released && s.modeAge > 0.7) {
    // Hands behind the back, innocent.
    limb(ctx, -30, -124, -36, -96, 12, '#4a5068');
    limb(ctx, 30, -124, 36, -96, 12, '#4a5068');
  } else if (gone) {
    limb(ctx, -30, -124, -38, -84, 12, '#4a5068');
    limb(ctx, 30, -124, 44, -150, 12, '#4a5068');
    ellipse(ctx, 46, -156, 8, 8, SKIN, 2);
    roundRect(ctx, 42, -176, 8, 16, 4, SKIN, 2);
  } else {
    // One hand on the belly, the briefcase in the other.
    limb(ctx, -30, -124, -38, -80, 12, '#4a5068');
    limb(ctx, 30, -124, 14, -94, 12, '#4a5068');
    ellipse(ctx, 12, -92, 8, 7, SKIN, 2);
    ellipse(ctx, -38, -78, 7, 7, SKIN, 2);
    roundRect(ctx, -52, -72, 30, 24, 3, '#7a5230');
    roundRect(ctx, -42, -78, 10, 6, 2, '#7a5230', 2);
  }
  const face: Face = {
    eyeOpen: clamp(s.eyeOpen.x, 0.05, 1.4),
    gaze: released ? (s.modeAge > 0.7 ? 1 : 0) : 0,
    brow: released ? (s.modeAge > 0.7 ? -0.6 : -0.9) : mix(gone ? -0.3 : 0, 0.2 + 0.8 * t, s.hold),
    mouth: holding ? (t > 0.7 ? 'wavy' : 'tight') : released ? (s.modeAge > 0.7 ? 'whistle' : 'smile') : gone ? 'smile' : 'flat',
    // The colour drains with the strain, at the release or on the way out, rather than switching back.
    skin: suitSkin(clamp(t, 0, 1)),
    blush: clamp(s.blush.x, 0, 1),
    cheeks: clamp(s.cheeks.x, 0, 1.2),
    sweat: t > 0.8 ? 3 : t > 0.55 ? 2 : t > 0.3 ? 1 : 0,
    vein: clamp((t - 0.7) / 0.3, 0, 1),
  };
  drawHead(ctx, face, time);
  // Combover.
  ctx.fillStyle = '#5a3a22'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-22, -172); ctx.quadraticCurveTo(-10, -190, 12, -184); ctx.quadraticCurveTo(22, -180, 22, -170); ctx.quadraticCurveTo(6, -178, -20, -166); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (released && s.modeAge > 0.9) {
    // A whistled note.
    const p = (time * 0.8) % 1;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = INK;
    ctx.font = '900 16px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('♪', 26 + p * 10, -178 - p * 26);
    ctx.globalAlpha = 1;
  }
  drawShades(ctx, clamp(s.shades.x, 0, 1));
  ctx.restore();
  void SKIN_SHADE;
  return { head: { x: x + shake.x * scale, y: y + (shake.y + 14 * t - 158) * scale }, visible: true };
}

export interface Box { x: number; y: number; w: number; h: number }

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The screen box of a rider's face, which a bubble must not cover: the whale's whole head is his face, the bot's is a screen on its chest. */
function faceBox(x: number, depth: number, kind: Kind | null): Box {
  const s = depthScale(depth);
  const [y, w, h] = kind === 'whale' ? [190, 70, 48] : kind === 'mev' ? [79, 22, 16] : [158, 26, 28];
  return { x: x - w * s, y: depthFloor(depth) - (y + h) * s, w: w * 2 * s, h: h * 2 * s };
}

/**
 * The speech bubbles, over the riders and the air. Each sits just above its speaker's head, where drawPassenger
 * puts it (slot x, depth scale and floor, the cabin's bounce), and on its first frame it steps sideways or up out
 * of anything it would cover: the other bubbles, the faces, the indicator and plaque, and `avoid` (the outcome
 * stamp). It stays inside `area` (across the cabin, below the caption band).
 */
export function drawLines(ctx: CanvasRenderingContext2D, c: Crowd, suit: Suit, bounce: number, area: { left: number; right: number; top: number }, avoid: Box[]): void {
  const faces: { who: Passenger | null; box: Box }[] = c.list.map((p) => ({ who: p, box: faceBox(p.x, p.depth, p.kind) }));
  if (suit.mode !== 'gone') {
    // His face sinks with the strain.
    const box = faceBox(suit.x, suit.depth, null);
    box.y += 14 * suit.strain * depthScale(suit.depth);
    faces.push({ who: null, box });
  }
  const fixed: Box[] = [{ x: 420, y: 84 + bounce, w: 120, h: 26 }, { x: 262, y: 130 + bounce, w: 94, h: 44 }, ...avoid];
  const placed: Box[] = [];
  ctx.save();
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.lineJoin = 'round';
  // The bubbles already in place go first, so a new one steps clear of every one of them, whenever its line was queued.
  for (const l of [...c.lines].sort((a, b) => Number(!a.box) - Number(!b.box))) {
    if (l.delay > 0) continue;
    const p = l.who;
    const s = depthScale(p.depth);
    // Above the wig once it has lifted and the spout once it blows, at their full height so the bubble does not ride their springs.
    const lift = p.kind === 'grandma' && p.wig.x > 0.02 ? -60 : p.kind === 'whale' && p.spout.x > 0.02 ? -56 : 0;
    const anchor = { x: p.x, y: depthFloor(p.depth) + (HEAD_TOP[p.kind] + lift) * s + bounce };
    if (anchor.x < 0 || anchor.x > 960 || anchor.y < 0 || anchor.y > 540) continue;
    if (!l.box) {
      const w = ctx.measureText(l.text).width + 18;
      const obstacles = [...placed, ...fixed, ...faces.filter((f) => f.who !== p).map((f) => f.box)];
      // The nearest clear spot to straight above the head, searching sideways and up; climbing costs a little more than sliding.
      let best = { left: clamp(anchor.x - w / 2, area.left, area.right - w), bottom: anchor.y - 8 };
      let bestCost = Infinity;
      for (let bottom = anchor.y - 8; bottom - 24 >= area.top; bottom -= 14) {
        for (const dx of [0, -24, 24, -48, 48, -80, 80, -120, 120, -170, 170]) {
          const left = clamp(anchor.x - w / 2 + dx, area.left, area.right - w);
          const cost = Math.abs(left + w / 2 - anchor.x) + 1.2 * (anchor.y - 8 - bottom);
          const room = { x: left - 3, y: bottom - 27, w: w + 6, h: 30 };
          if (cost < bestCost && !obstacles.some((o) => overlaps(room, o))) { best = { left, bottom }; bestCost = cost; }
        }
      }
      l.box = { dx: best.left - anchor.x, dy: best.bottom - anchor.y, w };
    }
    const w = l.box.w;
    const left = clamp(anchor.x + l.box.dx, area.left, area.right - w);
    const bottom = Math.max(area.top + 24, anchor.y + l.box.dy);
    placed.push({ x: left, y: bottom - 24, w, h: 24 });
    const tail = clamp(anchor.x, left + 12, left + w - 12);
    ctx.globalAlpha = l.age < 0.2 ? l.age / 0.2 : l.age > LINE_LIFE - 0.4 ? (LINE_LIFE - l.age) / 0.4 : 1;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(left, bottom - 24, w, 24, 8); ctx.fill(); ctx.stroke();
    // A short tail toward the speaker, even when the bubble had to move: run all the way down it would be a spike across the crowd.
    ctx.beginPath(); ctx.moveTo(tail - 6, bottom); ctx.lineTo(tail + clamp((anchor.x - tail) * 0.3, -6, 6), Math.min(anchor.y, bottom + 9)); ctx.lineTo(tail + 6, bottom); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(l.text, left + w / 2, bottom - 8);
  }
  ctx.restore();
}
