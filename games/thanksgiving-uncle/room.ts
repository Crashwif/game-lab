/**
 * The dining room of Thanksgiving Uncle: sage walls with the gallery wall and the IN THIS HOUSE poster, the
 * sideboard with the smart speaker and the monstera, the DAYS SINCE POLITICS sign, the window onto the
 * driveway with Rick's truck and his dog at the wheel, the farmhouse table and the dinner, the conversation
 * and its speech bubbles, and the crash: the wall giving way, the truck coming in, the turkey on the hood and
 * the debris. Drawn on a 960 × 540 canvas; presentation only, nothing here picks or changes the outcome.
 */
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
export const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
const BUBBLE_FONT = '600 17px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
/** The table: a trapezoid in perspective, its far edge behind the family's plates. */
export const TABLE = { far: 330, near: 474, farLeft: 236, farRight: 728, nearLeft: 150, nearRight: 814 } as const;
/** The window onto the driveway, and where the truck's bumper sits in it, parked. */
const WINDOW = { x: 690, y: 60, w: 210, h: 172 } as const;
const PARKED = { x: 800, y: 226, scale: 0.5 } as const;
/** Where the truck ends up once it is in the room, where Dale backs it to with the rug, and its hood in its own frame. */
const CRASHED = { x: 836, y: 446, scale: 1.12 } as const;
const BACKED = { x: 868, y: 420, scale: 1 } as const;
const HOOD = { x: -27, y: -129 } as const;
/** How far the parked truck inches up the driveway over a long round, and when Dale throws it in reverse. */
const CREEP = { y: 18, scale: 0.12 } as const;
const REVERSE_AT = 0.75;
/** The dining-room rug under the table and Rick's chair: far edge, near edge. */
const RUG = { far: 428, near: 534, farLeft: 176, farRight: 784, nearLeft: 120, nearRight: 840 } as const;
/** The turkey's platter, and the smart speaker. */
const PLATTER = { x: 482, y: 366 } as const;
const SPEAKER = { x: 92, y: 300 } as const;
const SIGN = { x: 482, y: 94 } as const;

export type Who = 'rick' | 'dad' | 'niece' | 'echo' | 'gran' | 'dale';
/** A line of the conversation; `cap` becomes the HUD caption when it is said, `film` brings the niece's phone up. */
export interface Line { at: number; who: Who; text: string; price?: number; cap?: string; film?: boolean }
/**
 * The conversation, keyed to the multiplier: Rick, the conspiracy uncle with a dog coin, goes further every time,
 * the family answers from the tote bag, and the smart speaker on the sideboard mishears him and orders things.
 * Once Grandma has said grace, nobody speaks.
 */
export const LINES: Line[] = [
  { at: 1.04, who: 'rick', text: 'this turkey’s got hormones in it. that’s why it’s confused', cap: 'THIS TURKEY’S GOT HORMONES' },
  { at: 1.18, who: 'dad', text: 'it’s heritage, Rick. from the co-op' },
  { at: 1.32, who: 'rick', text: 'co-op. so it’s communist', cap: 'THE TURKEY IS COMMUNIST' },
  { at: 1.48, who: 'niece', text: 'it’s a dead bird either way. like your podcast' },
  { at: 1.68, who: 'rick', text: 'birds aren’t real, sweetheart. they replaced them in ’86', cap: 'BIRDS AREN’T REAL' },
  { at: 1.9, who: 'echo', text: 'ordering: 40 lb of birdseed', price: 38, cap: 'ALEXA IS ORDERING THINGS' },
  { at: 2.2, who: 'rick', text: 'the moon landing was filmed in Ohio. the Ohio landing was real', cap: 'THE MOON LANDING WAS IN OHIO' },
  { at: 2.55, who: 'dad', text: 'okay. let’s keep it civil. we did a land acknowledgment', cap: 'KEEP IT CIVIL' },
  { at: 2.9, who: 'rick', text: 'the gravy is 5G', cap: 'THE GRAVY IS 5G' },
  { at: 3.35, who: 'niece', text: 'I’m filming this', film: true, cap: 'SHE’S FILMING' },
  { at: 3.8, who: 'rick', text: 'I did my own research. on the gravy. it’s a thread', cap: 'HE DID HIS OWN RESEARCH' },
  { at: 4.4, who: 'dad', text: 'that’s a dog whistle, Rick' },
  { at: 5, who: 'rick', text: 'Dale IS a dog, Kevin', cap: 'DALE IS A DOG, KEVIN' },
  { at: 5.7, who: 'niece', text: 'uncle rick is a microaggression' },
  { at: 6.5, who: 'rick', text: 'the pilgrims were crypto. $DALE is the new mayflower', cap: 'THE PILGRIMS WERE CRYPTO' },
  { at: 7.2, who: 'dad', text: 'RICK.', cap: 'RICK.' },
  { at: 8, who: 'echo', text: 'ordering: Faraday cage, large', price: 219 },
  { at: 9, who: 'rick', text: 'chemtrails are why the pie’s dry', cap: 'CHEMTRAILS DRIED THE PIE' },
  { at: 10, who: 'rick', text: 'the deep state took my gun. and my hair', cap: 'THE DEEP STATE TOOK HIS HAIR' },
  { at: 11, who: 'echo', text: 'ordering: 200 cans of beans, bunker size', price: 480, cap: 'ALEXA IS PREPPING' },
  { at: 12.5, who: 'niece', text: 'this is going on TikTok. and my thesis', cap: 'GOING ON TIKTOK' },
  { at: 14.5, who: 'rick', text: 'the stuffing is a psyop. the oat milk made the cat gay', cap: 'THE STUFFING IS A PSYOP' },
  { at: 17, who: 'dad', text: 'we’re doing a dry thanksgiving. in solidarity' },
  { at: 20, who: 'rick', text: 'with WHO, Kevin', cap: 'WITH WHO, KEVIN' },
  { at: 24, who: 'rick', text: 'wake up. the yams are in on it', cap: 'THE YAMS ARE IN ON IT' },
  { at: 29, who: 'niece', text: 'I’m a communist, uncle rick. dad pays my phone' },
  { at: 36, who: 'rick', text: 'Dale knows. Dale’s unvaxxed. Dale’s seen things', cap: 'DALE HAS SEEN THINGS' },
  { at: 45, who: 'echo', text: 'ordering: horse paste, family size', price: 60 },
  { at: 54, who: 'rick', text: 'I’m running for school board. on a platform of no', cap: 'SCHOOL BOARD CANDIDATE' },
  { at: 73, who: 'dad', text: 'I have a podcast too, Rick. it’s about grief. and sourdough' },
  { at: 100, who: 'rick', text: 'the cranberry sauce is a hologram', cap: 'THE SAUCE IS A HOLOGRAM' },
  { at: 140, who: 'rick', text: 'ask your dad what he did in 2008' },
  { at: 200, who: 'rick', text: 'I’m just asking questions', cap: 'JUST ASKING QUESTIONS' },
  { at: 316, who: 'rick', text: 'the questions are also asking questions', cap: 'FULL TINFOIL' },
  { at: 540, who: 'echo', text: 'ordering: one (1) school board', price: 9999 },
  { at: 1000, who: 'rick', text: 'Dale’s running too. as a write-in', cap: 'DALE FOR SCHOOL BOARD' },
];
const SECONDS: Omit<Line, 'at'>[] = [
  { who: 'dad', text: 'we have moved on to leftovers, Rick' },
  { who: 'rick', text: 'exactly. who decides what gets left over', cap: 'WHO DECIDES THE LEFTOVERS' },
  { who: 'echo', text: 'reordering: aluminum foil, industrial roll', price: 24 },
  { who: 'niece', text: 'part two just passed part one. ratio' },
  { who: 'rick', text: 'the algorithm fears my potato research' },
  { who: 'dad', text: 'Dale is still in the truck' },
  { who: 'rick', text: 'Dale is an independent journalist. with a substack', cap: 'DALE HAS A SUBSTACK' },
  { who: 'echo', text: 'ordering: dog podcast microphone', price: 49 },
  { who: 'niece', text: 'Grandma is pretending to be asleep' },
  { who: 'rick', text: 'the nap goes all the way to the top', cap: 'FULL TINFOIL' },
];
/** Where each speaker's bubble sits and where its tail points. */
const BUBBLE_AT: Record<Who, { x: number; y: number; tail: { x: number; y: number }; width: number }> = {
  rick: { x: 356, y: 400, tail: { x: 562, y: 404 }, width: 280 },
  dad: { x: 300, y: 134, tail: { x: 350, y: 176 }, width: 230 },
  niece: { x: 672, y: 134, tail: { x: 622, y: 176 }, width: 230 },
  echo: { x: 118, y: 212, tail: { x: SPEAKER.x + 6, y: SPEAKER.y - 34 }, width: 190 },
  gran: { x: 290, y: 176, tail: { x: 208, y: 250 }, width: 150 },
  dale: { x: 860, y: 176, tail: { x: 806, y: 134 }, width: 90 },
};

export interface Bubble { who: Who; text: string; age: number; life: number; pop: Spring }
export type BitKind = 'drywall' | 'splinter' | 'glass' | 'poster' | 'frame' | 'shard' | 'leaf';
export interface Bit { x: number; y: number; vx: number; vy: number; rot: number; vr: number; r: number; kind: BitKind; color: string; floor: number; rest: boolean; hits: number }
export interface Puff { x: number; y: number; r: number; vx: number; vy: number; age: number; life: number; color: string; grow: number }
/**
 * The truck. Parked, Dale gets worked up with the tension (`agitation`) and his first beats are keyed to the
 * multiplier (`beats`: the headlights at 1.5×, a WOOF at 2×, a rev at 2.5×); `perk` is the time since Rick last
 * spoke, which pricks his ears; `phase` is his integrated bob; `creep` is how far he has inched up the driveway.
 */
interface Truck { state: 'parked' | 'crashing' | 'in'; x: Spring; y: Spring; scale: Spring; lights: boolean; revClock: number; exhaust: Puff[]; bark: number; agitation: number; beats: number; blink: number; perk: number; phase: number; creep: number; reversing: boolean }
/** The turkey in flight, in room coordinates; once landed, `x` is its offset along the hood. */
interface Turkey { x: number; y: number; rot: number; vx: number; vy: number; flying: boolean; landed: boolean }
interface Queued { at: number; who: Who; text: string }

export interface Room {
  truck: Truck;
  turkey: Turkey;
  bubbles: Bubble[];
  nextLine: number;
  secondsClock: number;
  secondsLine: number;
  /** Lines scheduled to follow an event (grace, the crash), by the queue's own clock. */
  queue: Queued[];
  queueT: number;
  bits: Bit[];
  puffs: Puff[];
  /** What the speaker has ordered so far, in dollars. */
  cart: number;
  /** The light ring: lit for a moment after Rick says something. */
  listening: number;
  /** DAYS SINCE POLITICS: 3 until Rick opens his mouth, −1 deep into a long round; the flip's progress. */
  days: number;
  shownDays: number;
  flip: number;
  /** The monstera's droop and the candle's flame. */
  droop: Spring;
  candle: boolean;
  /** The caption of the last captioned line said, and whether the niece has said she is filming. */
  caption: string;
  filming: boolean;
  /** The rug under the table, yanked toward the truck as Dale reverses: 0 in place, 1 pulled. */
  rug: Spring;
  /** The pie, out of the kitchen once grace has held: 0 still in the kitchen, 1 on the table. */
  pie: Spring;
  crashed: boolean;
  harmless: boolean;
  crashT: number;
  flash: number;
  /** She has said grace: no more lines, the dog settles. */
  holding: boolean;
  events: { line: Line | null; listen: boolean; order: boolean; rev: boolean; bark: boolean; blink: boolean; flip: boolean; wall: boolean; landed: number; turkey: boolean; pie: boolean };
}

function noEvents(): Room['events'] {
  return { line: null, listen: false, order: false, rev: false, bark: false, blink: false, flip: false, wall: false, landed: 0, turkey: false, pie: false };
}

function fresh(): Room {
  return {
    truck: { state: 'parked', x: spring(PARKED.x), y: spring(PARKED.y), scale: spring(PARKED.scale), lights: false, revClock: 0, exhaust: [], bark: 0, agitation: 0, beats: 0, blink: 0, perk: 9, phase: 0, creep: 0, reversing: false },
    turkey: { x: PLATTER.x, y: PLATTER.y, rot: 0, vx: 0, vy: 0, flying: false, landed: false },
    bubbles: [],
    nextLine: 0,
    secondsClock: 0,
    secondsLine: 0,
    queue: [],
    queueT: 0,
    bits: [],
    puffs: [],
    cart: 0,
    listening: 0,
    days: 3,
    shownDays: 3,
    flip: 0,
    droop: spring(0),
    candle: true,
    caption: '',
    filming: false,
    rug: spring(0),
    pie: spring(0),
    crashed: false,
    harmless: false,
    crashT: 0,
    flash: 0,
    holding: false,
    events: noEvents(),
  };
}

export const createRoom = (): Room => fresh();
export function resetRoom(r: Room): void {
  Object.assign(r, fresh());
}

export interface RoomDrive {
  running: boolean;
  multiplier: number;
  tension: number;
  time: number;
}

/** The slow, log-paced driver for long rounds: 0 at 1×, a third at 10×, all the way at 1000×. */
const depth = (multiplier: number): number => clamp(Math.log10(Math.max(1, multiplier)) / 3, 0, 1);
const droopFor = (tension: number, multiplier: number): number => smoothstep(0.15, 0.85, tension) + 0.35 * depth(multiplier);
const agitationFor = (tension: number): number => smoothstep(0.2, 0.85, tension);
const beatsAt = (multiplier: number): number => (multiplier >= 2.5 ? 3 : multiplier >= 2 ? 2 : multiplier >= 1.5 ? 1 : 0);

function say(r: Room, who: Who, text: string, life = who === 'rick' ? 5.5 : who === 'dale' ? 1.2 : 3.2): void {
  for (const b of r.bubbles) if (b.who === who && b.age < b.life) b.life = Math.min(b.life, b.age + 0.12);
  r.bubbles.push({ who, text, age: 0, life, pop: spring(0.6) });
}

/** A line outside the multiplier ladder (the regret after a cash-out), spoken now. */
export function aside(r: Room, who: Who, text: string): void {
  say(r, who, text);
  r.events.line = { at: 0, who, text };
}

/** What a line does beyond its bubble: Rick's wake the speaker and prick Dale's ears, orders fill the cart. */
function heard(r: Room, line: Line): void {
  r.events.line = line;
  if (line.cap) r.caption = line.cap;
  if (line.film) r.filming = true;
  if (line.who === 'rick') {
    r.listening = 1.1;
    r.events.listen = true;
    r.truck.perk = 0;
    if (r.days === 3) flipSign(r, 0);
  }
  if (line.who === 'echo') {
    r.cart += line.price ?? 0;
    r.events.order = true;
  }
}

function flipSign(r: Room, days: number): void {
  r.shownDays = r.days;
  r.days = days;
  r.flip = 1;
  r.events.flip = true;
}

function schedule(r: Room, lines: Queued[]): void {
  r.queue = lines;
  r.queueT = 0;
}

/** Grandma says grace: the moment the cash-out is accepted. Everyone goes quiet. */
export function sayGrace(r: Room): void {
  r.holding = true;
  say(r, 'gran', 'GRACE. NOW.', 4);
  schedule(r, [{ at: 1.2, who: 'rick', text: 'yes ma’am. Dale, stand down' }]);
}

/**
 * The crash. Hard, Dale puts the truck in gear: the flash, the wall, the turkey, then he throws it in reverse with
 * the rug snagged on the bumper. Harmless (grace has been said), Rick nods off, the speaker cancels the cage and
 * the pie comes out. `quiet` is a crash met late, shown settled.
 */
export function crashRoom(r: Room, crashX100: number, quiet: boolean, harmless: boolean): void {
  if (r.crashed) return;
  const unsaid = r.nextLine === 0;
  r.crashed = true;
  r.harmless = harmless;
  r.holding = true;
  const rand = mulberry32(crashX100 * 5 + 3);
  if (harmless) {
    schedule(r, [{ at: 0.5, who: 'echo', text: 'cancelling: Faraday cage' }, { at: 1.6, who: 'dad', text: 'pie?' }, { at: 3, who: 'niece', text: 'finally' }]);
    // Grandma's GRACE. NOW. clears before Dad asks for pie, so the two bubbles never sit on each other.
    for (const b of r.bubbles) if (b.who === 'gran') b.life = Math.min(b.life, b.age + 1.1);
    if (quiet) settleSpring(r.pie, 1);
  } else {
    // An instant bust cuts Rick off before his first theory.
    schedule(r, [...(unsaid ? [{ at: 0, who: 'rick' as const, text: 'this turkey’s got hor—' }] : []), { at: 0.8, who: 'rick', text: 'DALE, NO' }, { at: 2.2, who: 'echo', text: 'playing: Free Bird' }, { at: 3.5, who: 'niece', text: 'got it. posting' }]);
    r.truck.state = 'crashing';
    r.truck.lights = true;
    r.candle = false;
    r.turkey = { x: PLATTER.x, y: PLATTER.y - 6, rot: 0, vx: 250 + rand() * 60, vy: -560 - rand() * 40, flying: true, landed: false };
    breakWall(r, rand);
    if (!quiet) r.flash = 1;
  }
  if (quiet) {
    r.crashT = 6;
    for (const q of r.queue) say(r, q.who, q.text);
    r.queue = [];
    for (const b of r.bubbles) b.age = 1;
    // Only the last word of each speaker stays up.
    r.bubbles = r.bubbles.filter((b) => b.life > b.age + 0.2);
    if (!harmless) {
      const t = r.truck;
      settleSpring(t.x, BACKED.x);
      settleSpring(t.y, BACKED.y);
      settleSpring(t.scale, BACKED.scale);
      t.state = 'in';
      t.reversing = true;
      t.exhaust = [];
      settleSpring(r.rug, 1);
      r.turkey = { x: -30, y: 0, rot: 0.6, vx: 0, vy: 0, flying: false, landed: true };
      for (let i = 0; i < 360; i += 1) stepBits(r, 1 / 60);
      r.puffs = [];
      r.events = noEvents();
    }
  }
}

/** The wall around the window gives way: drywall, splinters, glass, the poster and a frame off the gallery wall, dust. */
function breakWall(r: Room, rand: () => number): void {
  const throwBit = (bit: Omit<Bit, 'x' | 'y' | 'vx' | 'vy' | 'rot' | 'vr' | 'floor' | 'rest' | 'hits'>, x: number, y: number, power: number) => {
    const a = Math.PI + (rand() - 0.5) * 1.4;
    const s = power * (0.4 + rand());
    const vx = Math.cos(a) * s;
    const vy = Math.sin(a) * s - 120 - rand() * 160;
    const flight = 0.8 + rand() * 0.5;
    const lx = x + vx * flight;
    const onTable = lx > TABLE.nearLeft + 10 && lx < TABLE.nearRight - 10 && rand() > 0.4;
    const wallArt = bit.kind === 'poster' || bit.kind === 'frame';
    const floor = wallArt ? (bit.kind === 'poster' ? 398 : 432) + rand() * 10 : onTable ? mix(TABLE.far + 12, TABLE.near - 14, rand()) : 500 + rand() * 30;
    r.bits.push({ ...bit, x, y, vx, vy, rot: rand() * Math.PI * 2, vr: (rand() - 0.5) * 14, floor, rest: false, hits: 0 });
  };
  for (let i = 0; i < 18; i += 1) throwBit({ r: 6 + rand() * 10, kind: 'drywall', color: rand() > 0.5 ? '#f1f1ec' : '#dfe7dc' }, 740 + rand() * 180, 90 + rand() * 280, 320);
  for (let i = 0; i < 8; i += 1) throwBit({ r: 10 + rand() * 8, kind: 'splinter', color: '#c9a66b' }, 760 + rand() * 140, 120 + rand() * 240, 300);
  for (let i = 0; i < 12; i += 1) throwBit({ r: 4 + rand() * 5, kind: 'glass', color: 'rgba(190, 225, 255, 0.85)' }, WINDOW.x + rand() * WINDOW.w, WINDOW.y + rand() * WINDOW.h, 280);
  throwBit({ r: 30, kind: 'poster', color: '#ffffff' }, 175, 118, 60);
  throwBit({ r: 16, kind: 'frame', color: '#6b4a2b' }, 70, 110, 50);
  for (let i = 0; i < 12; i += 1) {
    const a = Math.PI + (rand() - 0.5) * 2;
    const s = 60 + rand() * 120;
    r.puffs.push({ x: 780 + rand() * 120, y: 120 + rand() * 260, r: 18 + rand() * 20, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, age: 0, life: 0.8 + rand() * 0.6, color: 'rgba(236, 236, 228, 0.9)', grow: 60 });
  }
}

/** Dad's wine glass goes: shards onto the table in front of him. */
export function shatterGlass(r: Room, x: number, y: number, rand: () => number): void {
  for (let i = 0; i < 9; i += 1) {
    const a = -Math.PI * (0.2 + rand() * 0.6);
    const s = 120 + rand() * 160;
    r.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rand() * 6, vr: (rand() - 0.5) * 12, r: 3 + rand() * 4, kind: 'shard', color: 'rgba(200, 230, 255, 0.85)', floor: TABLE.far + 14 + rand() * 40, rest: false, hits: 0 });
  }
  for (let i = 0; i < 5; i += 1) {
    const a = rand() * Math.PI * 2;
    r.puffs.push({ x, y, r: 3, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 40, age: 0, life: 0.5, color: '#7a1f3a', grow: 4 });
  }
}

export function puff(list: Puff[], x: number, y: number, r: number, vy: number, life: number, color: string, rand: () => number): void {
  list.push({ x, y, r, vx: (rand() - 0.5) * 20, vy, age: 0, life, color, grow: 18 });
}

function stepPuffs(list: Puff[], dt: number): void {
  for (const p of list) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2.5 * dt);
    p.vy *= Math.exp(-1.2 * dt);
    p.r += p.grow * dt;
  }
  let w = 0;
  for (const p of list) if (p.age < p.life) list[w++] = p;
  list.length = w;
}

function stepBits(r: Room, dt: number): void {
  for (const b of r.bits) {
    if (b.rest) continue;
    // The exact constant-gravity step, so a piece lands in the same place at any frame rate.
    b.x += b.vx * dt;
    b.y += (b.vy + 550 * dt) * dt;
    b.vy += 1100 * dt;
    b.rot += b.vr * dt;
    if (b.y >= b.floor && b.vy > 0) {
      b.y = b.floor;
      if (b.vy > 120) {
        b.vy *= -0.3;
        b.vx *= 0.6;
        b.vr *= 0.5;
        if (b.hits === 0) r.events.landed += 1;
        b.hits += 1;
      } else {
        b.rest = true;
        b.vx = b.vy = b.vr = 0;
      }
    }
    b.x = clamp(b.x, 8, 952);
  }
}

/** Where the hood is right now, so the turkey lands on it and rides it as Dale reverses. */
function hood(t: Truck): { x: number; y: number } {
  return { x: t.x.x + HOOD.x * t.scale.x, y: t.y.x + HOOD.y * t.scale.x };
}

function bark(r: Room, time: number): void {
  r.truck.bark = 0;
  r.events.bark = true;
  say(r, 'dale', noise(time) > 0.5 ? 'WOOF' : 'BORF', 0.9);
}

function rev(r: Room, time: number): void {
  const t = r.truck;
  t.revClock = 0;
  r.events.rev = true;
  const rand = mulberry32(Math.floor(time * 40) + 9);
  for (let i = 0; i < 4; i += 1) puff(t.exhaust, t.x.x - 100 * t.scale.x, t.y.x - 6, 3 + rand() * 3, -20 - rand() * 20, 0.8, 'rgba(120,120,130,0.7)', rand);
}

function stepTruck(r: Room, drive: RoomDrive, dt: number): void {
  const t = r.truck;
  t.perk += dt;
  if (t.state === 'parked') {
    const live = drive.running && !r.holding;
    t.agitation += clamp((live ? agitationFor(drive.tension) : 0) - t.agitation, -dt * 0.8, dt * 0.6);
    const a = t.agitation;
    t.phase += dt * (6 + a * 16);
    if (live) {
      // His first beats land on the curve, so every round past 1.5× gets the foreshadowing.
      while (t.beats < beatsAt(drive.multiplier)) {
        t.beats += 1;
        if (t.beats === 1) {
          t.blink = 0.6;
          r.events.blink = true;
        } else if (t.beats === 2) bark(r, drive.time);
        else rev(r, drive.time);
      }
      if (t.beats >= 2 && (t.bark += dt * (0.2 + a * 0.6)) > 1) bark(r, drive.time);
      if (t.beats >= 3 && (t.revClock += dt * (0.4 + a + 0.6 * depth(drive.multiplier))) > 1.3) rev(r, drive.time);
      // Over a long round he inches up the driveway toward the window.
      t.creep = Math.max(t.creep, depth(drive.multiplier));
    }
    t.blink = Math.max(0, t.blink - dt);
    // The headlights flash on the beat.
    t.lights = t.blink > 0 ? t.blink % 0.3 > 0.15 : live && a > 0.8 && Math.sin(drive.time * 14) > 0;
    stepSpring(t.y, PARKED.y + CREEP.y * t.creep, 3, 1, dt);
    stepSpring(t.scale, PARKED.scale + CREEP.scale * t.creep, 3, 1, dt);
  } else {
    // In through the wall, then Dale throws it in reverse with the rug caught on the bumper.
    const back = r.crashT > REVERSE_AT;
    const to = back ? BACKED : CRASHED;
    if (back && !t.reversing) {
      t.reversing = true;
      r.events.rev = true;
    }
    stepSpring(t.x, to.x, 7, 0.75, dt);
    stepSpring(t.y, to.y, 7, 0.75, dt);
    stepSpring(t.scale, to.scale, 7, 0.75, dt);
    stepSpring(r.rug, back ? 1 : 0, 9, 0.6, dt);
    if (t.state === 'crashing' && back && Math.abs(t.scale.x - to.scale) < 0.02) t.state = 'in';
    if (r.crashT < 2.5) {
      const rand = mulberry32(Math.floor(drive.time * 40) + 9);
      t.revClock += dt;
      if (t.revClock > 0.12) {
        t.revClock = 0;
        puff(t.exhaust, t.x.x - 118 * t.scale.x, t.y.x - 10, 6, -30, 1, 'rgba(120,120,130,0.6)', rand);
      }
    }
  }
  stepPuffs(t.exhaust, dt);
}

function stepTurkey(r: Room, dt: number): void {
  const t = r.turkey;
  if (t.landed) {
    // It tumbles on into its rest on the hood, the short way round, instead of snapping upright.
    const rest = 0.6 + Math.PI * 2 * Math.round((t.rot - 0.6) / (Math.PI * 2));
    t.rot += (rest - t.rot) * (1 - Math.exp(-10 * dt));
    return;
  }
  if (!t.flying) return;
  t.x += t.vx * dt;
  t.y += (t.vy + 500 * dt) * dt;
  t.vy += 1000 * dt;
  t.rot += 4 * dt;
  const h = hood(r.truck);
  if (t.vy > 0 && t.y >= h.y && t.x > 700) {
    t.flying = false;
    t.landed = true;
    t.x -= h.x;
    t.y = 0;
    r.events.turkey = true;
  }
}

export function stepRoom(r: Room, drive: RoomDrive, dt: number): void {
  r.events = noEvents();
  if (r.crashed) r.crashT += dt;
  // The truck stayed in the driveway: the pie comes out of the kitchen a beat after the speaker's cancellation, just before Dad asks.
  const pieOut = r.crashed && r.harmless && r.crashT >= 1.3;
  if (pieOut && r.pie.x === 0 && r.pie.v === 0) r.events.pie = true;
  stepSpring(r.pie, pieOut ? 1 : 0, 7, 0.55, dt);
  r.listening = Math.max(0, r.listening - dt);

  while (!r.holding && drive.running && r.nextLine < LINES.length && drive.multiplier >= LINES[r.nextLine]!.at) {
    const line = LINES[r.nextLine]!;
    say(r, line.who, line.text);
    heard(r, line);
    r.nextLine += 1;
  }
  if (!r.holding && drive.running && r.nextLine === LINES.length) {
    r.secondsClock += dt;
    if (r.secondsClock >= 6) {
      r.secondsClock %= 6;
      const line = { at: drive.multiplier, ...SECONDS[r.secondsLine++ % SECONDS.length]! };
      say(r, line.who, line.text);
      heard(r, line);
    }
  }
  // Deep into a long round the sign goes past zero.
  if (!r.holding && drive.running && r.days === 0 && drive.multiplier >= 50) flipSign(r, -1);
  r.queueT += dt;
  while (r.queue.length && r.queueT >= r.queue[0]!.at) {
    const q = r.queue.shift()!;
    say(r, q.who, q.text);
    r.events.line = { at: 0, who: q.who, text: q.text };
    if (q.who === 'echo') r.events.order = true;
  }
  r.flip = Math.max(0, r.flip - dt * 2.2);
  for (const b of r.bubbles) {
    b.age += dt;
    stepSpring(b.pop, 1, 18, 0.5, dt);
  }
  r.bubbles = r.bubbles.filter((b) => b.age < b.life + 0.3);

  stepSpring(r.droop, drive.running && !r.holding ? droopFor(drive.tension, drive.multiplier) : r.crashed && !r.harmless ? 1.2 : 0, 2.5, 0.9, dt);
  stepTruck(r, drive, dt);
  stepTurkey(r, dt);
  stepBits(r, dt);
  stepPuffs(r.puffs, dt);
}

/**
 * Settles a fresh room into a round already under way at `multiplier`, for a scene that missed the start:
 * the last things said are up, the cart holds what has been ordered, the sign has flipped, the caption is the
 * last one said, the dog is as worked up as the round has him and the truck as far up the driveway.
 */
export function settleRoom(r: Room, multiplier: number, tension: number, left: boolean): void {
  while (r.nextLine < LINES.length && multiplier >= LINES[r.nextLine]!.at) {
    const line = LINES[r.nextLine]!;
    if (line.who === 'echo') r.cart += line.price ?? 0;
    if (line.who === 'rick') r.days = r.shownDays = 0;
    if (line.cap) r.caption = line.cap;
    if (line.film) r.filming = true;
    r.nextLine += 1;
  }
  if (r.days === 0 && multiplier >= 50) r.days = r.shownDays = -1;
  const t = r.truck;
  t.beats = beatsAt(multiplier);
  t.creep = depth(multiplier);
  settleSpring(t.y, PARKED.y + CREEP.y * t.creep);
  settleSpring(t.scale, PARKED.scale + CREEP.scale * t.creep);
  if (!left) {
    const recent = LINES.slice(0, r.nextLine).reverse();
    const his = recent.find((l) => l.who === 'rick');
    if (his) say(r, 'rick', his.text);
    const theirs = recent.find((l) => l.who !== 'rick');
    if (theirs && recent.indexOf(theirs) < 2) say(r, theirs.who, theirs.text);
    for (const b of r.bubbles) b.age = 1;
    t.agitation = agitationFor(tension);
  }
  r.holding = left;
  settleSpring(r.droop, left ? 0 : droopFor(tension, multiplier));
}

// ---- Drawing --------------------------------------------------------------------------------------------

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Meme caption lettering: heavy, bordered, tracked so Impact's letters don't fuse. */
export function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.letterSpacing = `${Math.round(size * 0.08)}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.11);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
  ctx.letterSpacing = '0px';
}

/** A hex colour `t` of the way from `a` to `b`. */
export function blend(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const k = clamp(t, 0, 1);
  const c = [0, 2, 4].map((i) => Math.round(mix(p(a.slice(1), i), p(b.slice(1), i), k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * The truck, seen from the front, about the bottom centre of its bumper: lifted on big tyres, a light bar, a flag
 * on the antenna, DALE on the plate, and Dale himself at the wheel with his paws up, more worked up with `agitation`.
 */
function drawTruck(ctx: CanvasRenderingContext2D, t: Truck, time: number): void {
  ctx.save();
  ctx.translate(t.x.x, t.y.x);
  ctx.scale(t.scale.x, t.scale.x);
  const a = t.agitation;
  const bounce = t.state !== 'parked' ? 0 : Math.sin(time * 18) * 2 * a;
  ctx.translate(0, bounce);
  ink(ctx, 3);
  // Tyres, then the lifted body.
  ctx.fillStyle = '#2a2a30';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 112, -12, 36, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#4a4a52';
    ctx.lineWidth = 3;
    for (let y = -50; y < 30; y += 12) {
      ctx.beginPath();
      ctx.moveTo(side * 112 - 20, y);
      ctx.lineTo(side * 112 + 20, y + 4);
      ctx.stroke();
    }
    ink(ctx, 3);
  }
  ctx.fillStyle = '#8b1e1e';
  ctx.beginPath();
  ctx.roundRect(-104, -140, 208, 86, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a62828';
  ctx.beginPath();
  ctx.roundRect(-100, -140, 200, 18, 6);
  ctx.fill();
  // Grille, headlights, bumper, plate.
  ctx.fillStyle = '#1c1f26';
  ctx.beginPath();
  ctx.roundRect(-54, -116, 108, 50, 6);
  ctx.fill();
  ctx.strokeStyle = '#c9ced6';
  ctx.lineWidth = 4;
  for (let y = -108; y < -70; y += 10) {
    ctx.beginPath();
    ctx.moveTo(-48, y);
    ctx.lineTo(48, y);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.fillStyle = t.lights ? '#fff6b0' : '#e8ecef';
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.roundRect(side * 84 - 16, -112, 32, 26, 6);
    ctx.fill();
    ctx.stroke();
    if (t.lights) {
      ctx.fillStyle = 'rgba(255, 246, 176, 0.35)';
      ctx.beginPath();
      ctx.moveTo(side * 84, -100);
      ctx.lineTo(side * 84 - 70 * side, 40);
      ctx.lineTo(side * 84 + 90 * side, 40);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = '#c9ced6';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(-110, -56, 220, 30, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.roundRect(-30, -50, 60, 20, 3);
  ctx.fill();
  ink(ctx, 2);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 14px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DALE', 0, -40);
  // Cab: windscreen with Dale at the wheel, the roof, the light bar, the antenna and the flag.
  ctx.fillStyle = '#8b1e1e';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-96, -140);
  ctx.lineTo(-84, -214);
  ctx.lineTo(84, -214);
  ctx.lineTo(96, -140);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9fc3d9';
  ctx.beginPath();
  ctx.moveTo(-86, -146);
  ctx.lineTo(-76, -206);
  ctx.lineTo(76, -206);
  ctx.lineTo(86, -146);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-86, -146);
  ctx.lineTo(-76, -206);
  ctx.lineTo(76, -206);
  ctx.lineTo(86, -146);
  ctx.closePath();
  ctx.clip();
  drawDale(ctx, 0, -158, t, time);
  ctx.restore();
  ctx.fillStyle = '#2a2a30';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.roundRect(-70, -228, 140, 14, 4);
  ctx.fill();
  ctx.stroke();
  for (let x = -56; x <= 56; x += 28) {
    ctx.fillStyle = t.lights && Math.sin(time * 20 + x) > 0 ? '#fff6b0' : '#d9dde3';
    ctx.beginPath();
    ctx.arc(x, -221, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a2a30';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(92, -214);
  ctx.lineTo(96, -300);
  ctx.stroke();
  const wave = Math.sin(time * 6) * 4;
  ctx.fillStyle = '#c4302b';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(96, -300);
  ctx.lineTo(140, -296 + wave);
  ctx.lineTo(138, -270 + wave);
  ctx.lineTo(96, -272);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7f3ea';
  for (let i = 0; i < 3; i += 1) ctx.fillRect(98, -294 + i * 8 + wave * 0.6, 40, 3);
  ctx.fillStyle = '#2b4a7a';
  ctx.fillRect(98, -298, 16, 12);
  ctx.restore();
  for (const p of t.exhaust) {
    ctx.globalAlpha = (1 - p.age / p.life) * 0.8;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Dale: a brown dog at the wheel, paws up, tongue out, ears flapping harder the more worked up he is. Every time
 * Rick speaks his ears prick up and a paw taps the horn.
 */
function drawDale(ctx: CanvasRenderingContext2D, x: number, y: number, t: Truck, time: number): void {
  const agitation = t.agitation;
  const driving = t.state !== 'parked';
  const perk = t.perk < 0.8 ? Math.sin((Math.PI * t.perk) / 0.8) : 0;
  const tap = perk * Math.abs(Math.sin(t.perk * Math.PI * 5)) * 6;
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t.phase) * (2 + agitation * 5);
  ctx.translate(0, bob);
  ink(ctx, 2.5);
  // Wheel.
  ctx.strokeStyle = '#2a2a30';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 28, 30, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Ears, head, muzzle, eyes, tongue, collar.
  ctx.fillStyle = '#7a4a24';
  ink(ctx, 2.5);
  const flap = Math.sin(time * 15) * 8 * agitation;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * (30 + 3 * perk), -4 + flap * side - 10 * perk, 10, 22, side * (0.4 - 0.5 * perk), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#a3683a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9b48a';
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, 6, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(side * 11, -6, 6 + agitation * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(side * 11 + (driving ? 2 : 0), -6, 3 - agitation, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e46b8a';
  ctx.beginPath();
  ctx.ellipse(4, 24, 5, 7 + agitation * 4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#c4302b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 18, 26, 0.3, Math.PI - 0.3);
  ctx.stroke();
  // Paws on the wheel.
  ctx.fillStyle = '#a3683a';
  ink(ctx, 2.5);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 24, 24 + (driving ? -4 : 0) - (side > 0 ? tap : 0), 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawWalls(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#cfdccb';
  ctx.fillRect(0, 0, 960, 400);
  // Picture rail and the wainscot.
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 288, 960, 112);
  ctx.strokeStyle = '#e1ddd3';
  ctx.lineWidth = 2;
  for (let x = 30; x < 960; x += 64) ctx.strokeRect(x, 306, 40, 80);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 286, 960, 10);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(0, 286);
  ctx.lineTo(960, 286);
  ctx.moveTo(0, 296);
  ctx.lineTo(960, 296);
  ctx.stroke();
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#b58a5c';
  ctx.fillRect(0, 400, 960, 140);
  ctx.strokeStyle = '#9a7249';
  ctx.lineWidth = 2;
  for (let y = 418; y < 540; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
    for (let x = ((y / 24) % 3) * 90; x < 960; x += 270) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 24);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#5c4a3a';
  ctx.fillRect(0, 398, 960, 6);
}

function drawGalleryWall(ctx: CanvasRenderingContext2D, r: Room): void {
  const posterGone = r.bits.some((b) => b.kind === 'poster');
  const frameGone = r.bits.some((b) => b.kind === 'frame');
  if (!posterGone) drawPoster(ctx, 175, 118, 0);
  if (!frameGone) drawFrame(ctx, 70, 110, 0);
  // The NPR tote on a hook.
  ctx.save();
  ctx.translate(60, 170);
  ctx.fillStyle = '#6b6b70';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 2.5);
  ctx.fillStyle = '#e9dfc8';
  ctx.beginPath();
  ctx.roundRect(-22, 14, 44, 50, 4);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-12, 14);
  ctx.quadraticCurveTo(0, -4, 12, 14);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NPR', 0, 40);
  ctx.restore();
}

/** The IN THIS HOUSE poster, about its centre. */
function drawPoster(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ink(ctx, 2.5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-52, -68, 104, 136);
  ctx.strokeRect(-52, -68, 104, 136);
  const lines: [string, string][] = [['IN THIS HOUSE', INK], ['WE BELIEVE', INK], ['SCIENCE IS REAL', '#e63946'], ['KINDNESS IS', '#f4813f'], ['EVERYTHING', '#f4813f'], ['NO HUMAN IS', '#3f8fe6'], ['ILLEGAL', '#3f8fe6'], ['OAT MILK IS MILK', '#5cb85c'], ['RICK IS ON', '#a24bd6'], ['THIN ICE', '#a24bd6']];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach(([text, color], i) => {
    ctx.fillStyle = color;
    ctx.font = `900 ${i < 2 ? 11 : 9}px Impact, "Arial Black", sans-serif`;
    ctx.fillText(text, 0, -56 + i * 12.5);
  });
  ctx.restore();
}

/** A framed COEXIST, about its centre. */
function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ink(ctx, 2.5);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(-32, -18, 64, 36);
  ctx.strokeRect(-32, -18, 64, 36);
  ctx.fillStyle = '#f7f1dc';
  ctx.fillRect(-26, -12, 52, 24);
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const word = 'COEXIST';
  const colors = ['#3f8fe6', '#e63946', '#f4813f', '#5cb85c', '#a24bd6', '#ffd166', '#1c1f26'];
  for (let i = 0; i < word.length; i += 1) {
    ctx.fillStyle = colors[i]!;
    ctx.fillText(word[i]!, -21 + i * 7, 1);
  }
  ctx.restore();
}

function drawSign(ctx: CanvasRenderingContext2D, r: Room): void {
  ctx.save();
  ctx.translate(SIGN.x, SIGN.y);
  ink(ctx, 2.5);
  ctx.fillStyle = '#6b4a2b';
  ctx.beginPath();
  ctx.roundRect(-78, -34, 156, 68, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7f1dc';
  ctx.font = '700 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DAYS SINCE', -22, -16);
  ctx.fillText('POLITICS', -22, -2);
  ctx.fillText('AT DINNER', -22, 12);
  // The flip card: it squashes to a line and comes back with the new number.
  const f = r.flip;
  const squash = f > 0.5 ? (f - 0.5) * 2 : 1 - f * 2;
  const shown = f > 0.5 ? r.shownDays : r.days;
  ctx.save();
  ctx.translate(46, 0);
  ctx.scale(1, Math.max(0.05, squash));
  ctx.fillStyle = '#f7f1dc';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(-20, -24, 40, 48, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = shown <= 0 ? '#c4302b' : INK;
  ctx.font = '900 34px Impact, "Arial Black", sans-serif';
  ctx.fillText(String(shown), 0, 2);
  ctx.restore();
  ctx.restore();
}

function drawSideboard(ctx: CanvasRenderingContext2D, r: Room, time: number): void {
  ink(ctx, 2.5);
  ctx.fillStyle = '#b5783f';
  ctx.beginPath();
  ctx.roundRect(20, 300, 232, 92, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 2;
  for (const x of [40, 100, 160]) ctx.strokeRect(x, 312, 48, 68);
  ctx.fillStyle = '#d9c39a';
  for (const x of [60, 120, 180]) ctx.fillRect(x, 342, 10, 4);
  ctx.fillStyle = '#6b4a2b';
  ink(ctx, 2.5);
  for (const x of [34, 226]) {
    ctx.beginPath();
    ctx.moveTo(x, 392);
    ctx.lineTo(x + 4, 400);
    ctx.lineTo(x + 8, 392);
    ctx.closePath();
    ctx.fill();
  }
  // The smart speaker: a fabric cylinder with a light ring that comes on when it hears Rick.
  ctx.save();
  ctx.translate(SPEAKER.x, SPEAKER.y);
  ctx.fillStyle = '#3b3b45';
  ctx.beginPath();
  ctx.roundRect(-14, -40, 28, 40, 6);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#55555f';
  ctx.lineWidth = 1;
  for (let y = -34; y < -4; y += 4) {
    ctx.beginPath();
    ctx.moveTo(-12, y);
    ctx.lineTo(12, y);
    ctx.stroke();
  }
  const lit = r.listening > 0;
  ctx.strokeStyle = lit ? `rgba(80, 200, 255, ${0.5 + 0.5 * Math.abs(Math.sin(time * 8))})` : '#2a2a30';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, -40, 12, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (lit) {
    ctx.fillStyle = 'rgba(80, 200, 255, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, -40, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A bottle of natural wine and the monstera, whose leaves droop as the evening goes.
  ink(ctx, 2);
  ctx.fillStyle = '#4a7a3a';
  ctx.beginPath();
  ctx.roundRect(140, 256, 14, 44, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(144, 246, 6, 12);
  ctx.fillStyle = '#f7f1dc';
  ctx.fillRect(141, 272, 12, 14);
  ctx.save();
  ctx.translate(210, 300);
  ctx.fillStyle = '#c97d3a';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-22, -34);
  ctx.lineTo(22, -34);
  ctx.lineTo(18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const droop = r.droop.x;
  ctx.fillStyle = '#3f7a46';
  for (const [dx, dy, ang] of [[-18, -60, -0.9], [16, -66, 0.8], [0, -80, 0], [-10, -50, -1.4], [12, -48, 1.3]]) {
    ctx.save();
    ctx.translate(0, -34);
    ctx.rotate(ang! + Math.sign(ang! || 1) * droop * 0.9);
    const len = Math.hypot(dx!, dy! + 34) * (1 - droop * 0.1);
    ctx.beginPath();
    ctx.ellipse(0, -len / 2, 12, len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#2d5a33';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, -len * i / 4);
      ctx.lineTo(-10, -len * i / 4 + 6);
      ctx.moveTo(0, -len * i / 4);
      ctx.lineTo(10, -len * i / 4 + 6);
      ctx.stroke();
    }
    ink(ctx, 2.5);
    ctx.restore();
  }
  ctx.restore();
}

function drawWindow(ctx: CanvasRenderingContext2D, r: Room, time: number): void {
  const W = WINDOW;
  const broken = r.truck.state !== 'parked';
  ctx.save();
  if (broken) {
    // The hole the truck made, ragged around where the window was, with the yard behind it.
    ctx.beginPath();
    const pts = [[640, 40], [700, 30], [760, 46], [830, 26], [900, 44], [960, 30], [960, 400], [905, 400], [870, 380], [800, 398], [730, 376], [680, 396], [650, 360], [670, 300], [630, 240], [660, 180], [620, 120]];
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x!, y!) : ctx.moveTo(x!, y!)));
    ctx.closePath();
    ctx.fillStyle = '#9ec4ff';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#6aa84f';
    ctx.fillRect(600, 200, 360, 200);
    ctx.fillStyle = '#8c8c92';
    ctx.fillRect(700, 210, 200, 190);
    ctx.restore();
    ink(ctx, 3);
    ctx.stroke();
    ctx.fillStyle = '#d9c39a';
    for (const [x, y, w, h] of [[650, 200, 12, 60], [700, 330, 50, 10], [900, 300, 12, 50]]) ctx.fillRect(x!, y!, w!, h!);
    ctx.restore();
    return;
  }
  // The view: sky, a lawn, the driveway with the truck parked facing the house, the Subaru's tail at the left.
  ctx.save();
  ctx.beginPath();
  ctx.rect(W.x, W.y, W.w, W.h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, W.y, 0, W.y + W.h);
  sky.addColorStop(0, '#ffb36b');
  sky.addColorStop(0.6, '#ffe0b0');
  sky.addColorStop(1, '#f7efe0');
  ctx.fillStyle = sky;
  ctx.fillRect(W.x, W.y, W.w, W.h);
  ctx.fillStyle = '#6aa84f';
  ctx.fillRect(W.x, W.y + 100, W.w, W.h - 100);
  ctx.fillStyle = '#8c8c92';
  ctx.beginPath();
  ctx.moveTo(W.x + 70, W.y + 100);
  ctx.lineTo(W.x + 150, W.y + 100);
  ctx.lineTo(W.x + 200, W.y + W.h);
  ctx.lineTo(W.x + 20, W.y + W.h);
  ctx.closePath();
  ctx.fill();
  // The Subaru.
  ctx.save();
  ctx.translate(W.x + 34, W.y + 150);
  ink(ctx, 2);
  ctx.fillStyle = '#3a6a4a';
  ctx.beginPath();
  ctx.roundRect(-30, -34, 60, 40, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9fc3d9';
  ctx.fillRect(-22, -30, 44, 14);
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(-12, -8, 24, 8);
  ctx.fillStyle = '#2a2a30';
  for (const s of [-20, 20]) {
    ctx.beginPath();
    ctx.arc(s, 8, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  drawTruck(ctx, r.truck, time);
  ctx.restore();
  // Frame, mullions, sill.
  ctx.strokeStyle = '#f7f3ea';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(W.x + W.w / 2, W.y);
  ctx.lineTo(W.x + W.w / 2, W.y + W.h);
  ctx.moveTo(W.x, W.y + 60);
  ctx.lineTo(W.x + W.w, W.y + 60);
  ctx.stroke();
  ctx.fillStyle = '#f7f3ea';
  ink(ctx, 2.5);
  ctx.fillRect(W.x - 10, W.y - 10, W.w + 20, 10);
  ctx.fillRect(W.x - 10, W.y + W.h, W.w + 20, 14);
  ctx.fillRect(W.x - 10, W.y - 10, 10, W.h + 24);
  ctx.fillRect(W.x + W.w, W.y - 10, 10, W.h + 24);
  ctx.strokeRect(W.x - 10, W.y - 10, W.w + 20, W.h + 24);
  // Linen curtains, open.
  ctx.fillStyle = '#efe7d6';
  for (const side of [0, 1]) {
    const x = side ? W.x + W.w + 10 : W.x - 10;
    ctx.beginPath();
    ctx.roundRect(side ? x - 4 : x - 20, W.y - 14, 24, W.h + 30, 6);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * A point on the rug, `u` along it (left to right) and `v` into the room (far edge to near). Pulled, the trailing
 * end slides further than the end on the truck's bumper, so the rug bunches into folds.
 */
function rugAt(r: Room, u: number, v: number): { x: number; y: number } {
  const p = clamp(r.rug.x, 0, 1.2);
  const x = mix(mix(RUG.farLeft, RUG.nearLeft, v), mix(RUG.farRight, RUG.nearRight, v), u) + mix(170, 60, u) * p;
  const fold = p * 9 * Math.sin(u * Math.PI * 7) ** 2 * (1 - u);
  return { x, y: mix(RUG.far, RUG.near, v) - fold * (0.8 + 0.4 * v) };
}
const rugEdge = (r: Room) => rugAt(r, 1, 0.45);

function rugPath(ctx: CanvasRenderingContext2D, r: Room, iu: number, iv: number): void {
  ctx.beginPath();
  for (let i = 0; i <= 28; i += 1) {
    const p = rugAt(r, mix(iu, 1 - iu, i / 28), iv);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  for (let i = 0; i <= 28; i += 1) {
    const p = rugAt(r, mix(1 - iu, iu, i / 28), 1 - iv);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** The dining-room rug under the table and Rick's chair: a border, a red field, a medallion, fringed ends. */
function drawRug(ctx: CanvasRenderingContext2D, r: Room): void {
  ctx.strokeStyle = '#efe2c4';
  ctx.lineWidth = 2;
  for (const u of [0, 1]) {
    for (let i = 0; i <= 8; i += 1) {
      const p = rugAt(r, u, 0.06 + i * 0.11);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (u ? 9 : -9), p.y + 1);
      ctx.stroke();
    }
  }
  ink(ctx, 2.5);
  ctx.fillStyle = '#e8d3a8';
  rugPath(ctx, r, 0, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9b3b34';
  rugPath(ctx, r, 0.03, 0.14);
  ctx.fill();
  ctx.strokeStyle = '#2f4b6e';
  ctx.lineWidth = 3;
  rugPath(ctx, r, 0.06, 0.26);
  ctx.stroke();
  for (const [k, color] of [[1, '#2f4b6e'], [0.45, '#e8d3a8']] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [u, v] of [[0.5, 0.5 - 0.3 * k], [0.5 + 0.09 * k, 0.5], [0.5, 0.5 + 0.3 * k], [0.5 - 0.09 * k, 0.5]]) {
      const p = rugAt(r, u!, v!);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Shadowed folds where it bunches.
  const pull = clamp(r.rug.x, 0, 1);
  if (pull > 0.02) {
    ctx.lineWidth = 3;
    for (let k = 0; k < 6; k += 1) {
      const u = (k + 0.5) / 7;
      const a = rugAt(r, u + 0.02, 0.02);
      const b = rugAt(r, u + 0.02, 0.98);
      ctx.strokeStyle = `rgba(40, 14, 14, ${0.45 * pull * (1 - u)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

export function drawRoom(ctx: CanvasRenderingContext2D, r: Room, time: number): void {
  drawWalls(ctx);
  drawGalleryWall(ctx, r);
  drawSign(ctx, r);
  drawWindow(ctx, r, time);
  drawFloor(ctx);
  drawRug(ctx, r);
  drawSideboard(ctx, r, time);
}

/** The truck once it is through the wall, drawn after the table so its bumper sits in the room. */
export function drawTruckInRoom(ctx: CanvasRenderingContext2D, r: Room, time: number): void {
  if (r.truck.state === 'parked') return;
  const t = r.truck;
  // The tow strap from the bumper to the rug Dale has hooked, showing as the truck lands.
  const end = rugEdge(r);
  ctx.save();
  ctx.globalAlpha = smoothstep(0.3, 0.6, r.crashT);
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(t.x.x + 30 * t.scale.x, t.y.x - 34 * t.scale.x);
  ctx.stroke();
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  drawTruck(ctx, t, time);
  if (r.turkey.landed) {
    // Gravy down the hood, and the bird on it, riding it back.
    const h = hood(t);
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.ellipse(h.x + r.turkey.x, h.y + 10, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    drawTurkey(ctx, h.x + r.turkey.x, h.y, r.turkey.rot, false);
  }
}

/**
 * A ladder-back chair behind one of the family, drawn before them and pulled up to the table: its posts run
 * down to the table's far edge, and the top rail and the posts show beside the head and above the shoulders.
 */
export function drawChairBack(ctx: CanvasRenderingContext2D, x: number): void {
  ctx.save();
  ctx.translate(x, 0);
  ink(ctx, 2.5);
  ctx.fillStyle = '#2a2a30';
  for (const s of [-58, 58]) {
    ctx.beginPath();
    ctx.roundRect(s - 5, 176, 10, TABLE.far + 2 - 176, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(-64, 168, 128, 14, 6);
  ctx.fill();
  ctx.stroke();
  for (const y of [200, 226, 252]) {
    ctx.beginPath();
    ctx.roundRect(-58, y, 116, 9, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, food: 'turkey' | 'tofu' | 'none'): void {
  ink(ctx, 2);
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (food === 'none') return;
  ctx.fillStyle = food === 'turkey' ? '#c9843a' : '#b9b09a';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.roundRect(x - 16, y - 10, 30, 12, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = food === 'turkey' ? '#fff6dc' : '#6aa84f';
  for (const dx of [-24, 18, 22]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The roast turkey about its centre; on its platter when `platter`. */
function drawTurkey(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, platter: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  if (platter) {
    ink(ctx, 2.5);
    ctx.fillStyle = '#f7f3ea';
    ctx.beginPath();
    ctx.ellipse(0, 10, 74, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3f7a46';
    for (const dx of [-62, 60]) {
      ctx.beginPath();
      ctx.ellipse(dx, 10, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.rotate(rot);
  ink(ctx, 2.5);
  ctx.fillStyle = '#b8732f';
  ctx.beginPath();
  ctx.ellipse(0, -4, 44, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d08a44';
  ctx.beginPath();
  ctx.ellipse(-8, -12, 24, 10, -0.2, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#b8732f';
    ctx.beginPath();
    ctx.moveTo(side * 30, -16);
    ctx.quadraticCurveTo(side * 54, -30, side * 56, -8);
    ctx.quadraticCurveTo(side * 44, 0, side * 30, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7f3ea';
    ctx.beginPath();
    ctx.arc(side * 58, -12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTable(ctx: CanvasRenderingContext2D, r: Room, time: number): void {
  const T = TABLE;
  ink(ctx, 3);
  ctx.fillStyle = '#a8763f';
  ctx.beginPath();
  ctx.moveTo(T.farLeft, T.far);
  ctx.lineTo(T.farRight, T.far);
  ctx.lineTo(T.nearRight, T.near);
  ctx.lineTo(T.nearLeft, T.near);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#8f6232';
  ctx.lineWidth = 2;
  for (let i = 1; i < 8; i += 1) {
    const u = i / 8;
    ctx.beginPath();
    ctx.moveTo(mix(T.farLeft, T.farRight, u), T.far);
    ctx.lineTo(mix(T.nearLeft, T.nearRight, u), T.near);
    ctx.stroke();
  }
  // A linen runner down the middle.
  ctx.fillStyle = '#efe7d6';
  ctx.beginPath();
  ctx.moveTo(mix(T.farLeft, T.farRight, 0.36), T.far);
  ctx.lineTo(mix(T.farLeft, T.farRight, 0.64), T.far);
  ctx.lineTo(mix(T.nearLeft, T.nearRight, 0.64), T.near);
  ctx.lineTo(mix(T.nearLeft, T.nearRight, 0.36), T.near);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(T.farLeft, T.far);
  ctx.lineTo(T.farRight, T.far);
  ctx.lineTo(T.nearRight, T.near);
  ctx.lineTo(T.nearLeft, T.near);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#8f6232';
  ctx.fillRect(T.nearLeft, T.near, T.nearRight - T.nearLeft, 10);
  ctx.strokeRect(T.nearLeft, T.near, T.nearRight - T.nearLeft, 10);
  for (const x of [T.nearLeft + 26, T.nearRight - 38]) {
    ctx.fillRect(x, T.near + 10, 12, 56);
    ctx.strokeRect(x, T.near + 10, 12, 56);
  }

  // The dinner: the tofurkey with its flag, the cranberry can, the candle, the oat milk, the pie, the wine, the plates.
  ink(ctx, 2);
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.ellipse(316, 362, 36, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b9b09a';
  ctx.beginPath();
  ctx.roundRect(292, 338, 48, 24, 10);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#8f8674';
  ctx.lineWidth = 1.5;
  for (let x = 300; x < 336; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 340);
    ctx.lineTo(x + 4, 360);
    ctx.stroke();
  }
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(330, 338);
  ctx.lineTo(330, 318);
  ctx.stroke();
  ctx.fillStyle = '#5cb85c';
  ctx.fillRect(330, 318, 24, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 7px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('TOFU', 332, 323);
  ctx.fillStyle = '#a3203a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(392, 334, 20, 30, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#7a1f3a';
  ctx.lineWidth = 1.5;
  for (let y = 340; y < 362; y += 6) {
    ctx.beginPath();
    ctx.moveTo(394, y);
    ctx.lineTo(410, y);
    ctx.stroke();
  }
  // The candle, lit until the truck's draught.
  ink(ctx, 2);
  ctx.fillStyle = '#f7f1dc';
  ctx.fillRect(426, 336, 10, 30);
  ctx.strokeRect(426, 336, 10, 30);
  if (r.candle) {
    const fl = 1 + Math.sin(time * 11) * 0.2;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(431, 328, 4 * fl, 8 * fl, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    ctx.ellipse(431, 330, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(90,90,100,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(431, 334);
    ctx.quadraticCurveTo(436, 320, 430, 306);
    ctx.stroke();
  }
  ctx.fillStyle = '#eef2f5';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(696, 324, 24, 40, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5cb85c';
  ctx.fillRect(699, 334, 18, 14);
  ctx.fillStyle = INK;
  ctx.font = '900 9px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OAT', 708, 342);
  ctx.fillStyle = '#e08a3a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(612, 356, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.moveTo(612, 356);
  ctx.lineTo(646, 352);
  ctx.lineTo(640, 364);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a4a2a';
  ctx.beginPath();
  ctx.roundRect(664, 300, 18, 56, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(669, 288, 8, 14);
  ctx.fillStyle = '#f7f1dc';
  ctx.fillRect(666, 322, 14, 18);
  drawPlate(ctx, 372, 344, 36, 'turkey');
  drawPlate(ctx, 592, 344, 36, 'tofu');
  if (!r.turkey.flying && !r.turkey.landed) drawTurkey(ctx, PLATTER.x, PLATTER.y, 0, true);
  else {
    // The empty platter, and gravy where the bird was.
    ink(ctx, 2.5);
    ctx.fillStyle = '#f7f3ea';
    ctx.beginPath();
    ctx.ellipse(PLATTER.x, PLATTER.y + 10, 74, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.ellipse(PLATTER.x, PLATTER.y + 8, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (r.pie.x > 0.01) drawPie(ctx, mix(206, 286, clamp(r.pie.x, 0, 1.1)), 430, clamp(r.pie.x, 0, 1.15));
  for (const b of r.bits) if (b.rest) drawBit(ctx, b);
}

/** A whole pumpkin pie on a plate with a dollop of cream, about its centre, at scale `s`: it slides onto the table. */
function drawPie(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ink(ctx, 2);
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.ellipse(0, 4, 46, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c98a3a';
  ctx.beginPath();
  ctx.ellipse(0, 2, 38, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e08a3a';
  ctx.beginPath();
  ctx.ellipse(0, -2, 38, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#b86a2a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, -2, 35, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.arc(0, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBit(ctx: CanvasRenderingContext2D, b: Bit): void {
  if (b.kind === 'poster') {
    drawPoster(ctx, b.x, b.y, b.rot);
    return;
  }
  if (b.kind === 'frame') {
    drawFrame(ctx, b.x, b.y, b.rot);
    return;
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ink(ctx, 1.5);
  ctx.fillStyle = b.color;
  if (b.kind === 'splinter') {
    ctx.beginPath();
    ctx.roundRect(-b.r, -3, b.r * 2, 6, 2);
    ctx.fill();
    ctx.stroke();
  } else if (b.kind === 'glass' || b.kind === 'shard') {
    ctx.beginPath();
    ctx.moveTo(-b.r, b.r * 0.6);
    ctx.lineTo(0, -b.r);
    ctx.lineTo(b.r, b.r * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-b.r, -b.r * 0.4);
    ctx.lineTo(-b.r * 0.2, -b.r);
    ctx.lineTo(b.r, -b.r * 0.3);
    ctx.lineTo(b.r * 0.6, b.r * 0.8);
    ctx.lineTo(-b.r * 0.7, b.r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Everything in flight: the dust, the thrown bits, the turkey between the platter and the hood. */
export function drawAir(ctx: CanvasRenderingContext2D, r: Room): void {
  for (const p of r.puffs) {
    ctx.globalAlpha = (1 - p.age / p.life) * 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const b of r.bits) if (!b.rest) drawBit(ctx, b);
  if (r.turkey.flying) drawTurkey(ctx, r.turkey.x, r.turkey.y, r.turkey.rot, false);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawBubbles(ctx: CanvasRenderingContext2D, r: Room): void {
  for (const b of r.bubbles) {
    const at = BUBBLE_AT[b.who];
    const fade = b.age > b.life ? 1 - (b.age - b.life) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    ctx.translate(at.x, at.y);
    const s = clamp(b.pop.x, 0, 1.2);
    ctx.scale(s, s);
    ctx.font = b.who === 'dale' ? '900 15px Impact, "Arial Black", sans-serif' : BUBBLE_FONT;
    const lines = wrap(ctx, b.text, at.width - 28);
    const w = Math.min(at.width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
    const h = lines.length * 21 + 16;
    ctx.fillStyle = b.who === 'rick' ? '#ffffff' : b.who === 'echo' ? '#dff3ff' : '#fff3d6';
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 12);
    ctx.fill();
    ctx.stroke();
    const tx = at.tail.x - at.x;
    const ty = at.tail.y - at.y;
    const side = Math.sign(tx) || 1;
    const bx = clamp(tx * 0.6, -w / 2 + 16, w / 2 - 16);
    const by = Math.sign(ty) * h / 2;
    ctx.beginPath();
    ctx.moveTo(bx - 10 * side, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 8 * side, by);
    ctx.fill();
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(bx - 10 * side, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 8 * side, by);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 18 + i * 21));
    ctx.restore();
  }
}

/** The white flash of the wall going. */
export function drawFlash(ctx: CanvasRenderingContext2D, r: Room): void {
  if (r.flash <= 0.01) return;
  ctx.fillStyle = `rgba(255, 248, 220, ${r.flash * 0.85})`;
  ctx.fillRect(0, 0, 960, 540);
}
