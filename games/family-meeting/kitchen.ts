/**
 * The kitchen of Family Meeting: the wallpaper and the window, the counter with the kettle, the fridge and its
 * magnets, the cross on the wall above the table, the table and the dinner on it, the speech bubbles, and the
 * loose bits the crash throws across the room. Drawn on a 960 × 540 canvas; presentation only, nothing here
 * picks or changes the outcome.
 */
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
export const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
const BUBBLE_FONT = '600 17px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
/** The nail the cross hangs from, centred on the wall between the parents. */
export const NAIL = { x: 482, y: 80 } as const;
/** The table: a trapezoid in perspective, its far edge behind the parents' plates. */
export const TABLE = { far: 330, near: 474, farLeft: 236, farRight: 728, nearLeft: 150, nearRight: 814 } as const;
/** Where the casserole sits, which is where the cross lands. */
export const CASSEROLE = { x: 482, y: 376 } as const;
/** The kettle's spout, where its steam comes from. */
const SPOUT = { x: 214, y: 268 } as const;

export type Who = 'her' | 'dad' | 'mom';
/** `cap` is the caption the line puts up when it is said, so a caption never runs ahead of the line it names. */
export interface Line { at: number; who: Who; text: string; cap?: string }
/**
 * The confession, keyed to the multiplier: the college fund, then the church fund, into memecoins, and the
 * parents get a word in between. A line every second and a half or so through the first 15 s, where most
 * rounds end; each line is a speech bubble and a cue; once she has left the table no more are said.
 */
export const LINES: Line[] = [
  { at: 1.04, who: 'her', text: 'so… I’ve been thinking about my portfolio', cap: 'SO, UM, ABOUT MY PORTFOLIO' },
  { at: 1.18, who: 'dad', text: 'pass the potatoes' },
  { at: 1.32, who: 'her', text: 'I put the college fund in a dog coin', cap: 'THE COLLEGE FUND IS IN A DOG COIN' },
  { at: 1.48, who: 'mom', text: 'is this from the internet' },
  { at: 1.68, who: 'her', text: 'it’s not gambling, it’s a DAO', cap: 'IT’S NOT GAMBLING, IT’S A DAO' },
  { at: 1.9, who: 'dad', text: 'what in god’s name is a DAO' },
  { at: 2.2, who: 'her', text: 'I’m a KOL now. 40k followers. mostly bots', cap: 'SHE’S A KOL NOW' },
  { at: 2.55, who: 'mom', text: 'we raised you in a christian home' },
  { at: 2.9, who: 'her', text: 'so I aped the church building fund', cap: 'SHE APED THE CHURCH FUND' },
  { at: 3.35, who: 'dad', text: 'WHAT DID YOU DO WITH THE CHURCH FUND' },
  { at: 3.8, who: 'her', text: 'few understand', cap: 'FEW UNDERSTAND' },
  { at: 4.4, who: 'mom', text: 'pastor rick is going to hear about this' },
  { at: 5, who: 'her', text: 'pastor rick is in my discord, mom', cap: 'PASTOR RICK IS IN THE DISCORD' },
  { at: 5.7, who: 'dad', text: 'is THAT why he drives a lambo' },
  { at: 6.5, who: 'her', text: 'I’m not selling. diamond hands', cap: 'DIAMOND HANDS AT DINNER' },
  { at: 7.4, who: 'mom', text: 'lord give me strength' },
  { at: 8, who: 'her', text: 'also I borrowed against the minivan. 100x', cap: 'THE MINIVAN IS LEVERAGED' },
  { at: 9, who: 'dad', text: 'WE NEED THE MINIVAN' },
  { at: 10, who: 'her', text: 'money is a social construct, dad', cap: 'MONEY IS A CONSTRUCT' },
  { at: 11.2, who: 'mom', text: 'I’m calling your grandmother' },
  { at: 12.6, who: 'her', text: 'grandma’s in the discord too. she’s a whale', cap: 'GRANDMA IS A WHALE' },
  { at: 15.8, who: 'her', text: 'it’s not a ponzi if grandma got in early', cap: 'IT’S NOT A PONZI' },
  { at: 20, who: 'dad', text: 'how much is left' },
  { at: 25, who: 'her', text: 'define “left”', cap: 'DEFINE “LEFT”' },
  { at: 31.6, who: 'mom', text: 'lord, take the wheel. of the minivan' },
  { at: 40, who: 'her', text: 'I minted the family bible as an NFT', cap: 'THE FAMILY BIBLE IS AN NFT' },
  { at: 54, who: 'her', text: 'wagmi, mom. we’re all gonna make it', cap: 'WAGMI' },
  { at: 73, who: 'dad', text: 'we are NOT all gonna make it' },
  { at: 100, who: 'her', text: 'anyway, who wants pie. it’s tokenized', cap: 'THE PIE IS TOKENIZED' },
  { at: 316, who: 'her', text: 'I sold the house to buy the dip', cap: 'SHE SOLD THE HOUSE' },
  { at: 540, who: 'dad', text: 'WE LIVE IN THE HOUSE' },
  { at: 1000, who: 'her', text: 'we rent it back from the DAO now', cap: 'THE DAO OWNS THE HOUSE' },
];
/** Dinner keeps going between and after the scripted ladder: a filler exchange whenever six seconds pass in silence. */
const SECONDS: Omit<Line, 'at'>[] = [
  { who: 'dad', text: 'can we discuss literally anything else' },
  { who: 'her', text: 'sure. wen dessert' },
  { who: 'mom', text: 'the kettle has been screaming for ten minutes' },
  { who: 'her', text: 'same. it’s been a rough cycle' },
  { who: 'dad', text: 'I am starting a second casserole' },
  { who: 'her', text: 'a second casserole? bullish' },
  { who: 'mom', text: 'dessert was supposed to be the easy part' },
  { who: 'her', text: 'wait until you see the group chat' },
  { who: 'dad', text: 'why is the cross doing that' },
  { who: 'her', text: 'even the decorations are capitulating' },
];
/** The betting window: grace, and a warning. */
const GRACE: Line[] = [
  { at: 0.6, who: 'mom', text: 'who’s saying grace?' },
  { at: 1.5, who: 'dad', text: 'not it' },
  { at: 2.4, who: 'her', text: 'before we eat… I have an announcement' },
];
/** Seconds a bubble stays up before the same speaker's next line may replace it. */
const READ_S = 2.6;
/** Where each speaker's bubble sits and where its tail points. */
const BUBBLE_AT: Record<Who, { x: number; y: number; tail: { x: number; y: number }; width: number }> = {
  her: { x: 356, y: 400, tail: { x: 558, y: 410 }, width: 280 },
  dad: { x: 300, y: 134, tail: { x: 350, y: 176 }, width: 230 },
  mom: { x: 672, y: 134, tail: { x: 622, y: 176 }, width: 230 },
};

export interface Bubble { who: Who; text: string; age: number; life: number; pop: Spring }
export type BitKind = 'chunk' | 'pearl' | 'tooth' | 'tuft' | 'glasses' | 'band' | 'eye';
export interface Bit { x: number; y: number; vx: number; vy: number; rot: number; vr: number; r: number; kind: BitKind; color: string; floor: number; rest: boolean; splat: boolean; hits: number }
export interface Puff { x: number; y: number; r: number; vx: number; vy: number; age: number; life: number; color: string; grow: number }
/** `lie` is the angle it comes to rest at once it has hit the dish, and `settle` how far it has got there. */
interface Cross { angle: Spring; fallen: boolean; x: number; y: number; rot: number; vx: number; vy: number; vr: number; rest: boolean; hits: number; lie: number; settle: number }
interface Kettle { whistle: number; lid: Spring; steam: Puff[]; puffClock: number }

export interface Kitchen {
  cross: Cross;
  kettle: Kettle;
  bubbles: Bubble[];
  nextLine: number;
  /** Lines the multiplier has reached that wait for their speaker's last bubble to be read. */
  queue: Line[];
  /** Seconds since anyone said anything: six of them bring a filler line. */
  secondsClock: number;
  secondsLine: number;
  /** Seconds into the betting window, for the grace exchange. */
  graceT: number;
  /** Lines the crash's aftermath adds (her shrug, or the parents' sigh), played out by crashT. */
  aftermath: { at: number; who: Who; text: string }[];
  bits: Bit[];
  puffs: Puff[];
  smokeClock: number;
  /** The neck stubs smoke rises from once the heads have gone. */
  smokeFrom: { x: number; y: number }[];
  splats: { x: number; y: number; r: number; color: string }[];
  crashed: boolean;
  harmless: boolean;
  crashT: number;
  flash: number;
  creakClock: number;
  /** She has left the table: no more lines, the parents simmer down. */
  holding: boolean;
  events: { line: Line | null; creak: boolean; whistle: boolean; crossLand: boolean; landed: number; splat: boolean };
}

function noEvents(): Kitchen['events'] {
  return { line: null, creak: false, whistle: false, crossLand: false, landed: 0, splat: false };
}

function fresh(): Kitchen {
  return {
    cross: { angle: spring(0), fallen: false, x: NAIL.x, y: NAIL.y, rot: 0, vx: 0, vy: 0, vr: 0, rest: false, hits: 0, lie: 0, settle: 0 },
    kettle: { whistle: 0, lid: spring(0), steam: [], puffClock: 0 },
    bubbles: [],
    nextLine: 0,
    queue: [],
    secondsClock: 1,
    secondsLine: 0,
    graceT: 0,
    aftermath: [],
    bits: [],
    puffs: [],
    smokeClock: 0,
    smokeFrom: [],
    splats: [],
    crashed: false,
    harmless: false,
    crashT: 0,
    flash: 0,
    creakClock: 0,
    holding: false,
    events: noEvents(),
  };
}

export const createKitchen = (): Kitchen => fresh();
export function resetKitchen(k: Kitchen): void {
  Object.assign(k, fresh());
}

export interface KitchenDrive {
  running: boolean;
  /** The betting window, when grace is (not) said. */
  betting?: boolean;
  multiplier: number;
  tension: number;
  time: number;
  reduced: boolean;
}

function say(k: Kitchen, who: Who, text: string, life = who === 'her' ? 5.5 : 3.2): void {
  // One bubble per speaker at a time: a new line replaces the last one from the same mouth.
  for (const b of k.bubbles) if (b.who === who && b.age < b.life) b.life = Math.min(b.life, b.age + 0.12);
  k.bubbles.push({ who, text, age: 0, life, pop: spring(0.6) });
}

/** Her leaving line, the moment the cash-out is accepted: paper hands, full plate. */
export function sayLeaving(k: Kitchen): void {
  k.holding = true;
  k.queue = [];
  say(k, 'her', 'anyway I’m taking profits in my room', 2.6);
}

/** The caption of the last scripted line said, for a scene that opens mid-round. */
export function lastCaption(k: Kitchen): string {
  for (let i = k.nextLine - 1; i >= 0; i -= 1) if (LINES[i]!.cap) return LINES[i]!.cap!;
  return '';
}

/** The kettle and the cross at a tension: the kettle steams from about 2.6× and whistles by 3.3×; the cross trembles from 1.3× and creaks by 1.5×. */
const kettleAt = (tension: number): number => smoothstep(0.57, 0.94, tension);
const rattleAt = (tension: number): number => smoothstep(0.15, 0.75, tension);
/** The cross at rest in the dish, lying across it. */
const LIE = Math.PI / 2 + 0.42;

/**
 * The crash. Hard, both heads go: the flash, the cross off its nail, the aftermath lines. Harmless (she had
 * already left), the parents only deflate. `quiet` is a crash met late, shown settled instead of played.
 */
export function crashKitchen(k: Kitchen, crashX100: number, quiet: boolean, harmless: boolean, necks: { x: number; y: number }[]): void {
  if (k.crashed) return;
  k.crashed = true;
  k.harmless = harmless;
  k.holding = true;
  k.queue = [];
  const rand = mulberry32(crashX100 * 7 + 1);
  // The key beats land inside the two seconds the crash is held: her shrug, or their sigh; the car is a bonus for replays.
  if (harmless) {
    k.aftermath = [{ at: 0.5, who: 'mom', text: 'we’ll pray about it' }, { at: 1.6, who: 'dad', text: 'pass the potatoes' }];
  } else {
    // A bust before she has said a word: she barely got the first syllable out.
    if (k.nextLine === 0 && !quiet) say(k, 'her', 'so, um—', 1.2);
    k.smokeFrom = necks;
    k.aftermath = [{ at: 0.75, who: 'her', text: '…so anyway' }, { at: 2.6, who: 'her', text: 'can I borrow the car' }];
    const c = k.cross;
    c.fallen = true;
    c.vx = (rand() - 0.5) * 60;
    c.vy = -160 - rand() * 80;
    c.vr = (rand() - 0.5) * 9;
    c.rot = c.angle.x;
    if (!quiet) k.flash = 1;
  }
  if (quiet) {
    k.crashT = 5;
    // Met late, each aftermath line is the only bubble up from that mouth, rather than one fading out behind it.
    for (const line of k.aftermath) {
      k.bubbles = k.bubbles.filter((b) => b.who !== line.who);
      say(k, line.who, line.text);
    }
    k.aftermath = [];
    for (const b of k.bubbles) b.age = 1;
    if (!harmless) {
      const c = k.cross;
      c.rest = true;
      c.x = CASSEROLE.x + 8;
      c.y = CASSEROLE.y - 14;
      c.rot = c.lie = LIE;
      c.settle = 1;
      c.vx = c.vy = c.vr = 0;
    }
  }
}

/** Spawns the heads' pieces into the room: skin, hair, teeth, an eye each, dad's glasses, mom's pearls and hairband. */
export function burstHead(k: Kitchen, x: number, y: number, kind: 'dad' | 'mom', skin: string, hair: string, rand: () => number): void {
  const throwBit = (bit: Omit<Bit, 'x' | 'y' | 'vx' | 'vy' | 'rot' | 'vr' | 'floor' | 'rest' | 'splat' | 'hits'>, power: number) => {
    const a = -Math.PI * (0.15 + rand() * 0.7);
    const s = power * (0.45 + rand());
    const vx = Math.cos(a) * s + (rand() - 0.5) * 60;
    const vy = Math.sin(a) * s;
    // The depth on the table it would come down at; whether the table is there is decided when it gets there.
    const floor = mix(TABLE.far + 12, TABLE.near - 14, rand());
    k.bits.push({ ...bit, x, y, vx, vy, rot: rand() * Math.PI * 2, vr: (rand() - 0.5) * 16, floor, rest: false, splat: false, hits: 0 });
  };
  for (let i = 0; i < 16; i += 1) throwBit({ r: 4 + rand() * 7, kind: 'chunk', color: skin }, 300);
  for (let i = 0; i < 6; i += 1) throwBit({ r: 5 + rand() * 6, kind: 'tuft', color: hair }, 240);
  for (let i = 0; i < 5; i += 1) throwBit({ r: 3, kind: 'tooth', color: '#fffaf0' }, 320);
  throwBit({ r: 6, kind: 'eye', color: '#ffffff' }, 260);
  if (kind === 'dad') throwBit({ r: 14, kind: 'glasses', color: '#3b3b45' }, 220);
  else {
    for (let i = 0; i < 9; i += 1) throwBit({ r: 3.2, kind: 'pearl', color: '#f6f0e4' }, 280);
    throwBit({ r: 16, kind: 'band', color: '#d94f8a' }, 200);
  }
  for (let i = 0; i < 9; i += 1) {
    const a = rand() * Math.PI * 2;
    const s = 40 + rand() * 90;
    k.puffs.push({ x, y, r: 14 + rand() * 18, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, age: 0, life: 0.55 + rand() * 0.4, color: i < 3 ? '#fff1b0' : i < 6 ? '#ffb347' : '#ff6b4a', grow: 90 });
  }
}

/** A puff of steam or smoke at a point. */
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

/** Whether a point on the table's plane at depth `y` is over the cloth, a little in from its edge. */
function overTable(x: number, y: number): boolean {
  const u = (y - TABLE.far) / (TABLE.near - TABLE.far);
  return u >= 0 && u <= 1 && x > mix(TABLE.farLeft, TABLE.nearLeft, u) + 10 && x < mix(TABLE.farRight, TABLE.nearRight, u) - 10;
}

function inCasserole(x: number, y: number): boolean {
  const dx = (x - CASSEROLE.x) / 58;
  const dy = (y - CASSEROLE.y) / 20;
  return dx * dx + dy * dy < 1;
}

function stepBits(k: Kitchen, dt: number): void {
  for (const b of k.bits) {
    if (b.rest) continue;
    b.vy += 1100 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.vr * dt;
    if (b.y >= b.floor && b.vy > 0) {
      // Off the edge of the cloth there is nothing to land on: it carries on down to the floor.
      if (b.floor < 522 && !overTable(b.x, b.floor)) {
        b.floor = 522;
        continue;
      }
      if (b.kind !== 'glasses' && b.kind !== 'band' && inCasserole(b.x, b.y)) {
        // It lands in the dish and stays there as a splat.
        b.rest = true;
        b.splat = true;
        k.splats.push({ x: b.x, y: b.y, r: b.r * 0.9, color: b.color });
        k.events.splat = true;
        continue;
      }
      b.y = b.floor;
      if (b.vy > 120) {
        b.vy *= -0.3;
        b.vx *= 0.6;
        b.vr *= 0.5;
        if (b.hits === 0) k.events.landed += 1;
        b.hits += 1;
      } else {
        b.rest = true;
        b.vx = b.vy = b.vr = 0;
      }
    }
    b.x = clamp(b.x, 8, 952);
  }
}

function stepCross(k: Kitchen, drive: KitchenDrive, dt: number): void {
  const c = k.cross;
  if (!c.fallen) {
    const rattle = drive.running && !k.crashed && !k.holding ? rattleAt(drive.tension) : 0;
    const target = drive.reduced ? 0 : (noise(Math.floor(drive.time * 17)) - 0.5) * 0.5 * rattle;
    stepSpring(c.angle, target, 14, 0.3, dt);
    if (rattle > 0.1) {
      k.creakClock += dt;
      if (k.creakClock > 1.5 - rattle * 0.9) {
        k.creakClock = 0;
        k.events.creak = true;
        c.angle.v += (noise(drive.time) - 0.5) * 2.4;
      }
    } else k.creakClock = 0;
    return;
  }
  // Once it has hit the dish it topples toward lying across it, from whichever way round it came down.
  if (c.hits > 0) {
    c.settle = Math.min(1, c.settle + dt * 2.5);
    c.rot += (c.lie - c.rot) * (1 - Math.exp(-9 * dt));
  }
  if (c.rest) return;
  c.vy += 1000 * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.rot += c.vr * dt;
  const floor = CASSEROLE.y - 14;
  if (c.y >= floor && c.vy > 0) {
    c.y = floor;
    if (c.hits === 0) {
      // The nearest way for it to lie across the dish, wrapped so it never spins the long way round.
      let gap = Infinity;
      for (const base of [LIE, LIE - 0.84, LIE - Math.PI, LIE - Math.PI - 0.84]) {
        const a = base + 2 * Math.PI * Math.round((c.rot - base) / (2 * Math.PI));
        if (Math.abs(a - c.rot) < gap) {
          gap = Math.abs(a - c.rot);
          c.lie = a;
        }
      }
    }
    if (c.vy > 90) {
      c.vy *= -0.28;
      c.vx *= 0.5;
      c.vr *= 0.4;
      if (c.hits === 0) k.events.crossLand = true;
      c.hits += 1;
    } else {
      c.rest = true;
      c.hits = Math.max(1, c.hits);
      c.vx = c.vy = c.vr = 0;
    }
  }
}

function stepKettle(k: Kitchen, drive: KitchenDrive, dt: number): void {
  const t = k.kettle;
  const target = drive.running && !k.crashed && !k.holding ? kettleAt(drive.tension) : 0;
  const was = t.whistle;
  t.whistle += clamp(target - t.whistle, -dt * 1.2, dt * 0.9);
  if (was < 0.25 && t.whistle >= 0.25) k.events.whistle = true;
  stepSpring(t.lid, t.whistle > 0.45 && !drive.reduced ? (noise(Math.floor(drive.time * 24)) - 0.5) * 3 * t.whistle : 0, 20, 0.4, dt);
  t.puffClock += dt * (0.5 + 9 * t.whistle);
  const rand = mulberry32(Math.floor(drive.time * 60) + 11);
  while (t.puffClock > 1 && t.whistle > 0.05) {
    t.puffClock -= 1;
    puff(t.steam, SPOUT.x + 2, SPOUT.y, 3 + 3 * t.whistle, -40 - 50 * t.whistle, 0.9 + 0.5 * rand(), 'rgba(255,255,255,0.75)', rand);
    t.steam[t.steam.length - 1]!.vx = 30 + 40 * rand();
  }
  stepPuffs(t.steam, dt);
}

export function stepKitchen(k: Kitchen, drive: KitchenDrive, dt: number): void {
  k.events = noEvents();
  if (k.crashed) k.crashT += dt;
  k.flash = Math.max(0, k.flash - dt * 4);

  // The conversation follows the multiplier while the round runs; she says nothing more once she has left or the heads have gone.
  const talking = !k.holding && drive.running;
  while (talking && k.nextLine < LINES.length && drive.multiplier >= LINES[k.nextLine]!.at) k.queue.push(LINES[k.nextLine++]!);
  if (talking) {
    k.secondsClock += dt;
    // In order, and each bubble up long enough to read before the same mouth says the next thing.
    const next = k.queue[0];
    if (next && k.secondsClock > 0.9 && !k.bubbles.some((b) => b.who === next.who && b.age < Math.min(b.life, READ_S))) {
      k.queue.shift();
      say(k, next.who, next.text);
      k.events.line = next;
      k.secondsClock = 0;
    } else if (!next && k.secondsClock >= 6) {
      const line = { at: drive.multiplier, ...SECONDS[k.secondsLine++ % SECONDS.length]! };
      say(k, line.who, line.text);
      k.events.line = line;
      k.secondsClock = 0;
    }
  }
  if (drive.betting) {
    const was = k.graceT;
    k.graceT += dt;
    for (const line of GRACE) if (was < line.at && k.graceT >= line.at) {
      say(k, line.who, line.text);
      k.events.line = line;
    }
  }
  while (k.aftermath.length && k.crashT >= k.aftermath[0]!.at) {
    const line = k.aftermath.shift()!;
    say(k, line.who, line.text);
    k.events.line = { at: 0, who: line.who, text: line.text };
  }
  for (const b of k.bubbles) {
    b.age += dt;
    stepSpring(b.pop, 1, 18, 0.5, dt);
  }
  k.bubbles = k.bubbles.filter((b) => b.age < b.life + 0.3);

  stepCross(k, drive, dt);
  stepKettle(k, drive, dt);
  stepBits(k, dt);
  stepPuffs(k.puffs, dt);
  if (k.crashed && !k.harmless && k.smokeFrom.length) {
    k.smokeClock += dt;
    const rand = mulberry32(Math.floor(drive.time * 50) + 5);
    while (k.smokeClock > 0.11) {
      k.smokeClock -= 0.11;
      const thin = k.crashT > 6 ? 0.45 : 1;
      for (const n of k.smokeFrom) puff(k.puffs, n.x + (rand() - 0.5) * 12, n.y - 6, (7 + rand() * 6) * thin, -48 - rand() * 36, 1.6 + rand() * 0.8, `rgba(58,58,68,${0.9 * thin})`, rand);
    }
  }
}

/** A crash met late: the pieces lie where they fell and the clouds are gone; only the smoke still rises. */
export function settleAftermath(k: Kitchen): void {
  for (let i = 0; i < 360; i += 1) stepBits(k, 1 / 60);
  k.puffs = [];
  k.events = noEvents();
}

/**
 * Settles a fresh kitchen into a round already under way at `multiplier`, for a scene that missed the start:
 * the last thing each of them said is up, the cross hangs at its tilt, the kettle is as far along as it would be.
 */
export function settleKitchen(k: Kitchen, multiplier: number, tension: number, left: boolean): void {
  while (k.nextLine < LINES.length && multiplier >= LINES[k.nextLine]!.at) k.nextLine += 1;
  if (!left) {
    const recent = LINES.slice(0, k.nextLine).reverse();
    const hers = recent.find((l) => l.who === 'her');
    if (hers) say(k, 'her', hers.text);
    const theirs = recent.find((l) => l.who !== 'her');
    if (theirs && recent.indexOf(theirs) < 2) say(k, theirs.who, theirs.text);
    for (const b of k.bubbles) b.age = 1;
  }
  k.holding = left;
  k.kettle.whistle = left ? 0 : kettleAt(tension);
  settleSpring(k.kettle.lid, 0);
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

/** The cross about its nail: a wooden upright with a crossbar, a bevel and a hook. */
export function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ink(ctx, 2.5);
  ctx.fillStyle = '#8a5a2b';
  ctx.beginPath();
  ctx.roundRect(-7, -4, 14, 78, 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-26, 16, 52, 13, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b07a3e';
  ctx.fillRect(-4, -1, 3, 72);
  ctx.fillRect(-23, 19, 46, 3);
  ctx.strokeStyle = '#6b6b70';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -6, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWallpaper(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#e9d9b8';
  ctx.fillRect(0, 0, 960, 400);
  ctx.fillStyle = '#e0cda6';
  for (let x = 14; x < 960; x += 44) ctx.fillRect(x, 0, 16, 288);
  ctx.fillStyle = '#d7a8a0';
  for (let y = 24; y < 288; y += 56) for (let x = 22 + ((y / 56) % 2) * 22; x < 960; x += 44) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Chair rail and wainscot.
  ctx.fillStyle = '#d6c094';
  ctx.fillRect(0, 294, 960, 106);
  ctx.strokeStyle = '#c4aa7c';
  ctx.lineWidth = 2;
  for (let x = 20; x < 960; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 306);
    ctx.lineTo(x, 392);
    ctx.stroke();
  }
  ctx.fillStyle = '#b48a5a';
  ctx.fillRect(0, 288, 960, 8);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(0, 288);
  ctx.lineTo(960, 288);
  ctx.moveTo(0, 296);
  ctx.lineTo(960, 296);
  ctx.stroke();
}

function drawWindow(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.translate(58, 52);
  // The view: a sky, a lawn, a fence, a mailbox with the flag up.
  const sky = ctx.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, '#7fbcff');
  sky.addColorStop(1, '#dff1ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 176, 160);
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(40, 30, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [cx, cy] of [[110, 36], [130, 32], [150, 40]]) {
    ctx.beginPath();
    ctx.arc(cx! + Math.sin(time * 0.2) * 4, cy!, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#6aa84f';
  ctx.fillRect(0, 108, 176, 52);
  ctx.fillStyle = '#f7f3ea';
  for (let x = 6; x < 176; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 118);
    ctx.lineTo(x + 8, 118);
    ctx.lineTo(x + 8, 96);
    ctx.lineTo(x + 4, 90);
    ctx.lineTo(x, 96);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(0, 100, 176, 3);
  ctx.fillRect(0, 110, 176, 3);
  // Frame, mullions and the gingham curtains tied back.
  ctx.restore();
  ctx.save();
  ctx.translate(58, 52);
  ink(ctx, 3);
  ctx.strokeStyle = '#f7f3ea';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(88, 0);
  ctx.lineTo(88, 160);
  ctx.moveTo(0, 80);
  ctx.lineTo(176, 80);
  ctx.stroke();
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(-10, -10, 196, 10);
  ctx.fillRect(-10, 160, 196, 12);
  ctx.fillRect(-10, -10, 10, 182);
  ctx.fillRect(176, -10, 10, 182);
  ink(ctx, 2.5);
  ctx.strokeRect(-10, -10, 196, 182);
  for (const side of [-1, 1]) {
    ctx.save();
    if (side > 0) {
      ctx.translate(176, 0);
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = '#d65a5a';
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(44, -8);
    ctx.quadraticCurveTo(26, 60, 14, 96);
    ctx.quadraticCurveTo(30, 130, 40, 170);
    ctx.lineTo(-10, 170);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-6 + i * 11, -8);
      ctx.quadraticCurveTo(10 + i * 4, 60, 6 + i * 3, 96);
      ctx.quadraticCurveTo(12 + i * 6, 130, 4 + i * 10, 170);
      ctx.stroke();
    }
    ctx.fillStyle = '#f7f3ea';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.ellipse(16, 96, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Valance.
  ctx.fillStyle = '#d65a5a';
  ctx.beginPath();
  ctx.moveTo(-12, -12);
  ctx.lineTo(188, -12);
  ctx.lineTo(188, 14);
  for (let x = 188; x > -12; x -= 20) ctx.quadraticCurveTo(x - 10, 28, x - 20, 14);
  ctx.closePath();
  ctx.fill();
  ink(ctx, 2.5);
  ctx.stroke();
  ctx.restore();
}

function drawSampler(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(882, 112);
  ink(ctx, 2.5);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(0, 0, 70, 64);
  ctx.strokeRect(0, 0, 70, 64);
  ctx.fillStyle = '#f7f1dc';
  ctx.fillRect(7, 7, 56, 50);
  ctx.fillStyle = '#9a3b3b';
  ctx.font = '700 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BLESS', 35, 20);
  ctx.fillText('THIS', 35, 32);
  ctx.fillText('HOME', 35, 44);
  ctx.fillStyle = '#5c8a4a';
  for (let x = 12; x < 60; x += 8) {
    ctx.fillRect(x, 9, 3, 3);
    ctx.fillRect(x + 3, 52, 3, 3);
  }
  ctx.restore();
}

function drawClock(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.translate(917, 218);
  ink(ctx, 2.5);
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
    ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
    ctx.stroke();
  }
  // Six o'clock, dinner; the second hand keeps the time.
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 15);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -10);
  ctx.stroke();
  ctx.strokeStyle = '#c4302b';
  ctx.lineWidth = 1.5;
  const s = (time % 60) / 60 * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(s) * 17, Math.sin(s) * 17);
  ctx.stroke();
  ctx.restore();
}

function drawFridge(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(752, 150);
  ink(ctx, 3);
  ctx.fillStyle = '#eef0ea';
  ctx.beginPath();
  ctx.roundRect(0, 0, 118, 250, 8);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#b9bdb5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 96);
  ctx.lineTo(118, 96);
  ctx.stroke();
  ctx.fillStyle = '#b9bdb5';
  ctx.fillRect(8, 30, 6, 50);
  ctx.fillRect(8, 110, 6, 70);
  // A church bulletin, a crayon rainbow she drew at six, and her school photo (brown hair, braces).
  ctx.save();
  ctx.translate(40, 20);
  ctx.rotate(-0.06);
  ctx.fillStyle = '#fffdf5';
  ink(ctx, 1.5);
  ctx.fillRect(0, 0, 46, 58);
  ctx.strokeRect(0, 0, 46, 58);
  ctx.fillStyle = '#9a3b3b';
  ctx.fillRect(20, 8, 6, 22);
  ctx.fillRect(13, 14, 20, 6);
  ctx.fillStyle = '#8a8a8a';
  for (let y = 36; y < 54; y += 6) ctx.fillRect(6, y, 34, 2);
  ctx.fillStyle = '#c4302b';
  ctx.beginPath();
  ctx.arc(23, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(26, 118);
  ctx.rotate(0.08);
  ctx.fillStyle = '#fffdf5';
  ink(ctx, 1.5);
  ctx.fillRect(0, 0, 60, 48);
  ctx.strokeRect(0, 0, 60, 48);
  const crayons = ['#e63946', '#f4a261', '#ffd166', '#6aa84f', '#4f8fe6', '#8a5bd6'];
  crayons.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(30, 40, 26 - i * 3.5, Math.PI, 0);
    ctx.stroke();
  });
  ctx.fillStyle = '#4f8fe6';
  ctx.beginPath();
  ctx.arc(30, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(66, 176);
  ctx.rotate(-0.1);
  ctx.fillStyle = '#fffdf5';
  ink(ctx, 1.5);
  ctx.fillRect(0, 0, 40, 50);
  ctx.strokeRect(0, 0, 40, 50);
  ctx.fillStyle = '#6aa0c8';
  ctx.fillRect(3, 3, 34, 40);
  ctx.fillStyle = '#6b4a2b';
  ctx.beginPath();
  ctx.ellipse(20, 20, 13, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1cfb0';
  ctx.beginPath();
  ctx.arc(20, 24, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(16, 22, 2, 2);
  ctx.fillRect(22, 22, 2, 2);
  ctx.strokeStyle = '#9aa0a8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(16, 29);
  ctx.lineTo(24, 29);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(20, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawCounter(ctx: CanvasRenderingContext2D, k: Kitchen, time: number): void {
  // Cabinets under a counter, with a range in them and the kettle on the back burner.
  ink(ctx, 2.5);
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(16, 296, 234, 104);
  ctx.strokeRect(16, 296, 234, 104);
  ctx.strokeStyle = '#6b4327';
  ctx.lineWidth = 2;
  for (const x of [34, 86]) {
    ctx.strokeRect(x, 314, 42, 74);
    ctx.fillStyle = '#d9c39a';
    ctx.fillRect(x + 32, 346, 4, 12);
  }
  ctx.fillStyle = '#f2f2ee';
  ink(ctx, 2.5);
  ctx.fillRect(140, 296, 110, 104);
  ctx.strokeRect(140, 296, 110, 104);
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(150, 318, 90, 60);
  ctx.fillStyle = '#5a5a60';
  ctx.fillRect(158, 326, 74, 44);
  ctx.fillStyle = '#f2f2ee';
  ctx.fillRect(140, 286, 110, 12);
  ctx.strokeRect(140, 286, 110, 12);
  ctx.fillStyle = '#d4d4d0';
  ctx.fillRect(16, 288, 124, 10);
  ctx.strokeRect(16, 288, 124, 10);
  for (const x of [168, 222]) {
    ctx.fillStyle = '#2a2a30';
    ctx.beginPath();
    ctx.ellipse(x, 290, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const x of [160, 180, 210, 230]) {
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath();
    ctx.arc(x, 300, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The kettle: a dome, a spout to the right, a handle; its lid hops when it whistles.
  const t = k.kettle;
  ctx.save();
  ctx.translate(196, 290);
  const glow = t.whistle;
  ctx.fillStyle = blend('#d8dde4', '#ff9b7a', glow * 0.6);
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.quadraticCurveTo(-26, -34, 0, -36);
  ctx.quadraticCurveTo(26, -34, 24, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(14, -22);
  ctx.lineTo(SPOUT.x - 196, SPOUT.y - 290 - 4);
  ctx.lineTo(SPOUT.x - 196 - 2, SPOUT.y - 290 + 3);
  ctx.lineTo(16, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-4, -36, 14, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.fillStyle = '#3a3a40';
  ctx.beginPath();
  ctx.arc(0, -38 + t.lid.x, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (const p of t.steam) {
    const a = 1 - p.age / p.life;
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  void time;
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#c9b48f';
  ctx.fillRect(0, 400, 960, 140);
  ctx.fillStyle = '#b89f78';
  for (let row = 0; row < 3; row += 1) {
    const y = 400 + row * 48;
    const h = row === 2 ? 44 : 48;
    for (let x = (row % 2) * 60; x < 960; x += 120) ctx.fillRect(x, y, 60, h);
  }
  ctx.fillStyle = '#5c4a3a';
  ctx.fillRect(0, 398, 960, 6);
}

export function drawRoom(ctx: CanvasRenderingContext2D, k: Kitchen, time: number): void {
  drawWallpaper(ctx);
  drawWindow(ctx, time);
  drawSampler(ctx);
  drawClock(ctx, time);
  drawFridge(ctx);
  drawFloor(ctx);
  drawCounter(ctx, k, time);
  // The nail, and the cross on it unless the crash has shaken it off.
  ctx.fillStyle = '#6b6b70';
  ctx.beginPath();
  ctx.arc(NAIL.x, NAIL.y - 6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (!k.cross.fallen) drawCross(ctx, NAIL.x, NAIL.y, k.cross.angle.x);
}

/** A chair back behind a parent, drawn before them. */
export function drawChairBack(ctx: CanvasRenderingContext2D, x: number): void {
  ctx.save();
  ctx.translate(x, 0);
  ink(ctx, 2.5);
  ctx.fillStyle = '#8a5a3a';
  ctx.beginPath();
  ctx.roundRect(-50, 170, 100, 14, 5);
  ctx.fill();
  ctx.stroke();
  for (const s of [-44, -22, 0, 22, 44]) {
    ctx.beginPath();
    ctx.roundRect(s - 4, 182, 8, 150, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, food: boolean): void {
  ink(ctx, 2);
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#4f8fe6';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.8, w * 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (food) {
    ctx.fillStyle = '#c97d3a';
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.roundRect(x - 16, y - 10, 30, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6aa84f';
    for (const dx of [-24, 18, 22]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawTable(ctx: CanvasRenderingContext2D, k: Kitchen, time: number): void {
  const T = TABLE;
  // The gingham cloth: red, with white lines converging to the far edge.
  ink(ctx, 3);
  ctx.fillStyle = '#c8453f';
  ctx.beginPath();
  ctx.moveTo(T.farLeft, T.far);
  ctx.lineTo(T.farRight, T.far);
  ctx.lineTo(T.nearRight, T.near);
  ctx.lineTo(T.nearLeft, T.near);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 7;
  for (let i = 0; i <= 10; i += 1) {
    const u = i / 10;
    ctx.beginPath();
    ctx.moveTo(mix(T.farLeft, T.farRight, u), T.far);
    ctx.lineTo(mix(T.nearLeft, T.nearRight, u), T.near);
    ctx.stroke();
  }
  for (let i = 0; i <= 5; i += 1) {
    const v = Math.pow(i / 5, 1.3);
    const y = mix(T.far, T.near, v);
    ctx.lineWidth = 4 + v * 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(T.farLeft, T.far);
  ctx.lineTo(T.farRight, T.far);
  ctx.lineTo(T.nearRight, T.near);
  ctx.lineTo(T.nearLeft, T.near);
  ctx.closePath();
  ctx.stroke();
  // Lace at the near edge, and the legs.
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  for (let x = T.nearLeft; x < T.nearRight; x += 16) ctx.arc(x + 8, T.near + 2, 7, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#8a5a3a';
  ink(ctx, 2.5);
  for (const x of [T.nearLeft + 26, T.nearRight - 38]) {
    ctx.fillRect(x, T.near, 12, 66);
    ctx.strokeRect(x, T.near, 12, 66);
  }

  // The dinner: the family bible, the potatoes, the casserole, the shakers, the tea, the plates.
  ctx.save();
  ctx.translate(224, 358);
  ctx.rotate(0.12);
  ctx.fillStyle = '#2a2a30';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(-30, -12, 60, 24, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d4a93a';
  ctx.fillRect(-2, -8, 4, 14);
  ctx.fillRect(-7, -4, 14, 3);
  ctx.restore();
  ctx.fillStyle = '#f7f3ea';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(304, 360, 34, 14, 0, 0, Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath();
  ctx.moveTo(272, 360);
  ctx.quadraticCurveTo(286, 334, 304, 340);
  ctx.quadraticCurveTo(322, 330, 336, 360);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.arc(306, 344, 4, 0, Math.PI * 2);
  ctx.fill();
  for (const x of [412, 428]) {
    ctx.fillStyle = x === 412 ? '#f7f3ea' : '#3a3a40';
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.roundRect(x - 5, 340, 10, 22, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(214, 150, 60, 0.85)';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(646, 318, 34, 46, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(652, 322, 6, 36);
  ctx.beginPath();
  ctx.arc(686, 340, 10, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  drawPlate(ctx, 372, 344, 36, true);
  drawPlate(ctx, 592, 344, 36, true);
  // The casserole: a dish, a bubbling top, steam, and whatever has landed in it.
  ctx.save();
  ctx.translate(CASSEROLE.x, CASSEROLE.y);
  ink(ctx, 2.5);
  ctx.fillStyle = '#c9c9d4';
  ctx.beginPath();
  ctx.ellipse(0, 6, 62, 18, 0, 0, Math.PI);
  ctx.lineTo(-62, -4);
  ctx.ellipse(0, -4, 62, 18, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c97d3a';
  ctx.beginPath();
  ctx.ellipse(0, -4, 56, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2c14e';
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + time * 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 36, -4 + Math.sin(a) * 8, 3 + Math.sin(time * 3 + i) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of k.splats) {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.ellipse(s.x - CASSEROLE.x, s.y - CASSEROLE.y, s.r, s.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (const dx of [-20, 0, 20]) {
    const ph = time * 1.4 + dx;
    ctx.beginPath();
    ctx.moveTo(dx, -12);
    ctx.quadraticCurveTo(dx + Math.sin(ph) * 6, -26, dx + Math.sin(ph + 1) * 6, -40);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // The cross, once it lies in the dinner.
  if (k.cross.fallen && k.cross.rest) drawCross(ctx, k.cross.x, k.cross.y, k.cross.rot, 1 - 0.1 * k.cross.settle);
  // Her phone, face up beside her place.
  ctx.save();
  ctx.translate(462, 452);
  ctx.rotate(0.3);
  ctx.fillStyle = '#2a2a30';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(-11, -20, 22, 40, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7fd1ff';
  ctx.fillRect(-8, -16, 16, 30);
  ctx.restore();
  // What has landed on the table or the floor lies where it stopped.
  for (const b of k.bits) if (b.rest && !b.splat) drawBit(ctx, b);
}

function drawBit(ctx: CanvasRenderingContext2D, b: Bit): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ink(ctx, 1.5);
  ctx.fillStyle = b.color;
  if (b.kind === 'glasses') {
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-14, -5, 12, 10, 3);
    ctx.roundRect(2, -5, 12, 10, 3);
    ctx.moveTo(-2, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,230,255,0.5)';
    ctx.fillRect(-13, -4, 10, 8);
    ctx.fillRect(3, -4, 10, 8);
  } else if (b.kind === 'band') {
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 4, 16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (b.kind === 'tooth') {
    ctx.beginPath();
    ctx.roundRect(-3, -3.5, 6, 7, 1.5);
    ctx.fill();
    ctx.stroke();
  } else if (b.kind === 'eye') {
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(1.5, 0.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.kind === 'tuft') {
    ctx.beginPath();
    ctx.moveTo(-b.r, 2);
    ctx.quadraticCurveTo(-b.r * 0.3, -b.r, 0, 0);
    ctx.quadraticCurveTo(b.r * 0.4, -b.r * 1.1, b.r, 1);
    ctx.quadraticCurveTo(0, b.r * 0.6, -b.r, 2);
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

/** Everything in flight: the thrown bits, the clouds and the smoke, and the cross between its nail and the dish. */
export function drawAir(ctx: CanvasRenderingContext2D, k: Kitchen): void {
  for (const p of k.puffs) {
    const u = p.age / p.life;
    ctx.globalAlpha = (1 - u) * 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const b of k.bits) if (!b.rest) drawBit(ctx, b);
  if (k.cross.fallen && !k.cross.rest) drawCross(ctx, k.cross.x, k.cross.y, k.cross.rot, 1 - 0.1 * k.cross.settle);
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

export function drawBubbles(ctx: CanvasRenderingContext2D, k: Kitchen): void {
  for (const b of k.bubbles) {
    const at = BUBBLE_AT[b.who];
    const fade = b.age > b.life ? 1 - (b.age - b.life) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    ctx.translate(at.x, at.y);
    const s = clamp(b.pop.x, 0, 1.2);
    ctx.scale(s, s);
    ctx.font = BUBBLE_FONT;
    const lines = wrap(ctx, b.text, at.width - 28);
    const w = Math.min(at.width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
    const h = lines.length * 21 + 16;
    ctx.fillStyle = b.who === 'her' ? '#ffffff' : '#fff3d6';
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 12);
    ctx.fill();
    ctx.stroke();
    // The tail toward the speaker.
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

/** The white flash of the burst. */
export function drawFlash(ctx: CanvasRenderingContext2D, k: Kitchen): void {
  if (k.flash <= 0.01) return;
  ctx.fillStyle = `rgba(255, 248, 220, ${k.flash * 0.85})`;
  ctx.fillRect(0, 0, 960, 540);
}
