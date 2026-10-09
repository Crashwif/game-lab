/**
 * The 3:07 am kitchen: the laptop chart, the text stack, the stair light,
 * the ceiling thump, the suitcase that is the wife-changing-money meter,
 * and the crash (ring, cat, lawyer card). Presentation only.
 */
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
export const DESK = { x: 450, y: 448 };
export const LAPTOP = { x: 300, y: 372, w: 156, h: 108 };
/** Shared world-space contacts: the actor and keyboard use the same sockets. */
export const KEYBOARD_HANDS = [{ x: LAPTOP.x + LAPTOP.w - 44, y: LAPTOP.y + 21 }, { x: LAPTOP.x + LAPTOP.w - 24, y: LAPTOP.y + 21 }] as const;

const LINES: { at: number; text: string; her: boolean }[] = [
  { at: 1.15, text: 'honey?', her: true },
  { at: 1.4, text: 'one more trade', her: false },
  { at: 1.8, text: 'are you coming to bed', her: true },
  { at: 2.2, text: 'it is 3am', her: true },
  { at: 2.6, text: 'kyle says come to bed', her: true },
  { at: 2.9, text: 'who is kyle', her: false },
  { at: 3.8, text: 'did you sell the car??', her: true },
  { at: 4.6, text: 'leased. technically', her: false },
  { at: 5.8, text: 'the light is still on', her: true },
  { at: 7.5, text: 'the cat is judging you', her: true },
  { at: 8.7, text: 'babe lambo tmrw', her: false },
  { at: 10, text: 'i am coming down', her: true },
];
const OVERTIME_TEXTS = ['the coffee is cold', 'still researching', 'the cat wants breakfast', 'almost done. again.', 'your alarm just went off', 'five more minutes', 'the group chat is awake', 'please stop typing'];

interface Mug { x: number; y: number; vx: number; vy: number; rot: number; vr: number; fallen: boolean; hits: number; color: string; }
interface Bubble { text: string; her: boolean; age: number; }
interface Bit { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; color: string; }
interface Ring { x: number; y: number; vx: number; vy: number; dropped: boolean; settled: boolean; }
/**
 * A letter magnet on the fridge. Held ones sit on springs toward their slot (the loose ones tilt and shiver with the
 * tension); a fallen one is a body on the floor.
 */
interface Letter { ch: string; slot: number; x: number; y: number; rot: number; vx: number; vy: number; vr: number; fallen: boolean; rest: boolean; hits: number; sx: Spring; sy: Spring; sr: Spring; loose: number; }
/** The wedding photo: a tilt spring on the fridge until the crash drops it. */
interface Photo { tilt: Spring; fallen: boolean; rest: boolean; x: number; y: number; rot: number; vx: number; vy: number; vr: number; }

/** The magnets' slots along the fridge's top door, and where the spare N lies until it is needed. */
const SLOT_X = [44, 68, 92, 116, 140] as const;
const SLOT_Y = 284;
const LOOSE_N = { x: 142, y: 396, rot: 0.45 } as const;
const PHOTO_HOME = { x: 75, y: 237 } as const;
/** What falls off the fridge lands on the counter in front of it (the floor there is under the HUD's meter). */
const COUNTER_REST = 416;
const PHOTO_REST = 398;
/** Where the cursor rests on the laptop's screen, and the SELL button it is drawn toward. Screen coordinates with the lid open. */
const CURSOR_HOME = { x: 328, y: 286 } as const;
export const SELL_BTN = { x: 404, y: LAPTOP.y - 22, w: 42, h: 18 } as const;
const SELL_CENTRE = { x: SELL_BTN.x + SELL_BTN.w / 2, y: SELL_BTN.y + SELL_BTN.h / 2 } as const;
/** Where she plants her feet, top to bottom: the landing, the seven treads, the kitchen floor. */
const TREADS = [150, 180, 220, 260, 300, 340, 380, 420, 470] as const;
const FLOOR = TREADS.length - 1;
/** Her feet keep back from the stair edge (x=700+(470-y)/2); off the last tread she hops clear of the suitcase. */
const treadX = (i: number): number => i === FLOOR ? 690 : 700 + (470 - TREADS[i]!) / 2 + 30;
/** The threat ladder, keyed to the multiplier: one thump and a flicker, a creak, the light for good, the thumps, the mug, her peeks. */
const FLICKER_AT = 1.6;
const CREAK_AT = 2;
const LIGHT_AT = 2.2;
const THUMPS_AT = 2.5;
const MUG_AT = 3.3;
/** The mug leaves the counter as his elbow lands, a beat after the jab starts (the jab peaks 0.2 s in). */
const MUG_LAG = 0.2;
/** Knocked mugs come to rest on the floor above the HUD's meter line. */
const MUG_FLOOR = 490;
/** Her peeks from the top of the stairs: [from, to, how far she leans in]. The last one stays. */
const PEEKS = [[4, 4.9, 0.55], [6, 7.3, 0.8], [8.5, Infinity, 1]] as const;
const BULB = { x: 930, y: 112 } as const;
const peekAt = (m: number): number => PEEKS.find(([from, to]) => m >= from && m < to)?.[2] ?? 0;

export interface Kitchen {
  mugs: Mug[];
  knocked: boolean;
  /** Seconds until the jabbing elbow reaches the mug. */
  knockIn: number;
  catX: number;
  catY: number;
  catInCase: boolean;
  light: Spring;
  thump: number;
  thumpClock: number;
  /** The multiplier last frame, so each rung of the threat ladder fires once as it is crossed. */
  lastM: number;
  catAlert: number;
  /**
   * She comes down one tread per stomp: `wifeAt` is the tread she stands on (or is leaving), `wifeTo` the one she is
   * stepping to, `wifeT` the time into that step. 'wait' is a harmless crash holding her upstairs until he is up.
   */
  wifeMode: 'asleep' | 'wait' | 'check' | 'down' | 'floor' | 'back';
  wifeAt: number;
  wifeTo: number;
  wifeGoal: number;
  wifeT: number;
  wifeAlpha: number;
  squash: number;
  fling: number;
  /** Her tilt into the step, eased so a landing or a turn on the stairs does not snap her upright. */
  wifeLean: number;
  wifeAge: number;
  harmless: boolean;
  crashed: boolean;
  crashT: number;
  suitX: number;
  suitV: number;
  suitLid: Spring;
  rolling: boolean;
  ring: Ring;
  cardX: Spring;
  cardIn: boolean;
  chartDead: boolean;
  dogX: number;
  bubbles: Bubble[];
  nextLine: number;
  textClock: number;
  overtimeLine: number;
  bits: Bit[];
  meter: Spring;
  holding: boolean;
  peek: number;
  photo: Photo;
  letters: Letter[];
  shuffled: boolean;
  cursor: { x: Spring; y: Spring };
  /** The hover's integrated phase, so its rate can follow the fear without jumping. */
  hover: number;
  /** The SELL button: hovered over all round, aimed at and clicked at the cash-out, greyed out after the crash. */
  sell: 'idle' | 'aim' | 'clicked' | 'dead';
  sellFlash: number;
  clickPulse: number;
  ringHit: boolean;
  doorDone: boolean;
  events: { thump: boolean; flicker: boolean; creak: boolean; text: boolean; her: boolean; mug: boolean; mugHit: boolean; peek: boolean; ring: boolean; letter: boolean; photo: boolean; step: boolean; door: boolean };
}

const MUGS: { x: number; y: number; color: string }[] = [
  { x: 300, y: 424, color: '#efe8dc' },
  { x: 338, y: 418, color: '#d4574a' },
  { x: 560, y: 422, color: '#d5fb6d' },
  { x: 598, y: 416, color: '#7aa2ff' },
  { x: 250, y: 430, color: '#f2c14e' },
  { x: 640, y: 428, color: '#e7d5ff' },
];

function letter(ch: string, slot: number, x: number, y: number, rot: number): Letter {
  return { ch, slot, x, y, rot, vx: 0, vy: 0, vr: 0, fallen: false, rest: false, hits: 0, sx: spring(x), sy: spring(y), sr: spring(rot), loose: 0 };
}

/** WAGMI across the top door, and a spare N lying low on the bottom one (nobody knows where it came from). */
function makeLetters(): Letter[] {
  const letters = ['W', 'A', 'G', 'M', 'I'].map((ch, i) => letter(ch, i, SLOT_X[i]!, SLOT_Y, 0));
  letters.push(letter('N', -1, LOOSE_N.x, LOOSE_N.y, LOOSE_N.rot));
  return letters;
}

function noEvents(): Kitchen['events'] {
  return { thump: false, flicker: false, creak: false, text: false, her: false, mug: false, mugHit: false, peek: false, ring: false, letter: false, photo: false, step: false, door: false };
}

function freshKitchen(): Kitchen {
  return {
    mugs: MUGS.map((m) => ({ ...m, vx: 0, vy: 0, rot: 0, vr: 0, fallen: false, hits: 0 })),
    knocked: false,
    knockIn: 0,
    catX: 132,
    catY: 332,
    catInCase: false,
    light: spring(0),
    thump: 0,
    thumpClock: 0,
    lastM: 1,
    catAlert: 0,
    wifeMode: 'asleep',
    wifeAt: 1,
    wifeTo: 1,
    wifeGoal: 1,
    wifeT: 0,
    wifeAlpha: 0,
    squash: 0,
    fling: 0,
    wifeLean: 0,
    wifeAge: 0,
    harmless: false,
    crashed: false,
    crashT: 0,
    suitX: 640,
    suitV: 0,
    suitLid: spring(0.08),
    rolling: false,
    ring: { x: 470, y: 400, vx: 0, vy: 0, dropped: false, settled: false },
    cardX: spring(980),
    cardIn: false,
    chartDead: false,
    dogX: 520,
    bubbles: [],
    nextLine: 0,
    textClock: 0,
    overtimeLine: 0,
    bits: [],
    meter: spring(0),
    holding: false,
    peek: 0,
    photo: { tilt: spring(0), fallen: false, rest: false, x: PHOTO_HOME.x, y: PHOTO_HOME.y, rot: 0, vx: 0, vy: 0, vr: 0 },
    letters: makeLetters(),
    shuffled: false,
    cursor: { x: spring(CURSOR_HOME.x), y: spring(CURSOR_HOME.y) },
    hover: 0,
    sell: 'idle',
    sellFlash: 0,
    clickPulse: 0,
    ringHit: false,
    doorDone: false,
    events: noEvents(),
  };
}

export function createKitchen(): Kitchen {
  return freshKitchen();
}

export function resetKitchen(k: Kitchen): void {
  Object.assign(k, freshKitchen());
}

export function meterTarget(multiplier: number): number {
  return clamp(Math.log2(Math.max(1, multiplier)) / 4, 0, 1);
}

export interface KitchenDrive {
  running: boolean;
  multiplier: number;
  fear: number;
  time: number;
  traderGone: boolean;
  /** He is upstairs (or never left): a harmless crash may bring her down to check. */
  traderUp?: boolean;
}

function burst(k: Kitchen, x: number, y: number, count: number, color: string, power: number, rand: () => number): void {
  for (let i = 0; i < count; i += 1) {
    const a = rand() * Math.PI * 2;
    const s = power * (0.4 + rand());
    k.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, age: 0, life: 0.6 + rand() * 0.8, r: 1.5 + rand() * 2.5, color });
  }
}

/** Plays the crash. Harmless means he already closed the lid: she checks and goes back. */
export function crashKitchen(k: Kitchen, seed: number, quiet: boolean, harmless: boolean): void {
  if (k.crashed) return;
  k.crashed = true;
  k.harmless = harmless;
  k.chartDead = !harmless;
  k.holding = harmless;
  const peek = k.peek;
  k.peek = 0;
  const rand = mulberry32(seed);
  // The cursor lunges for SELL (too late) instead of jumping there; a crash met late finds it already there.
  if (!harmless) k.sell = 'dead';
  if (!harmless && quiet) {
    settleSpring(k.cursor.x, SELL_CENTRE.x + 6);
    settleSpring(k.cursor.y, SELL_CENTRE.y + 4);
  }
  if (quiet) {
    k.crashT = 4;
    k.light.x = harmless ? 0 : 1;
    k.catAlert = k.lastM >= CREAK_AT ? 1 : 0;
    if (harmless) {
      k.wifeMode = 'back';
      k.wifeAt = k.wifeTo = k.wifeGoal = 0;
      k.wifeAlpha = 0;
      k.suitLid.x = 0.08;
    } else {
      k.wifeMode = 'floor';
      k.wifeAt = k.wifeTo = k.wifeGoal = FLOOR;
      k.wifeAlpha = 1;
      k.wifeAge = 3;
      k.rolling = true;
      k.suitX = 1040;
      k.doorDone = true;
      k.suitLid.x = 0.72;
      k.catInCase = true;
      k.ring = { x: 590 + rand() * 40, y: 446, vx: 0, vy: 0, dropped: true, settled: true };
      k.ringHit = true;
      k.cardIn = true;
      k.cardX.x = 690;
      k.dogX = 980;
      k.meter.x = 0;
      // The aftermath on the fridge: the photo face down on the floor, W and A beside it, and NGMI where WAGMI was.
      restPhoto(k.photo, 66, -0.28);
      shuffleLetters(k);
      for (const l of k.letters) {
        if (l.ch === 'W') restLetter(l, 44, -0.5);
        else if (l.ch === 'A') restLetter(l, 100, 0.35);
        else settleLetter(l);
      }
    }
    return;
  }
  // The light snaps on. Harmless, she waits until he is upstairs; caught, she is already there, two treads down
  // where she peeks from (clear of the multiplier while the camera punches in).
  k.light.x = 1;
  k.light.v = 0;
  k.wifeAge = 0;
  k.wifeT = 0;
  if (harmless) {
    k.wifeMode = 'wait';
    k.wifeAt = k.wifeTo = k.wifeGoal = 1;
    return;
  }
  k.wifeMode = 'down';
  k.wifeAt = k.wifeTo = 2;
  k.wifeGoal = FLOOR;
  k.wifeAlpha = 1;
  k.wifeLean = -0.22 * peek;
  burst(k, 800, 120, 10, '#d9d0c4', 80, rand);
}

/** The cash-out: the cursor darts to SELL and clicks it, and the screen flashes SOLD before the lid comes down. */
export function clickSell(k: Kitchen): void {
  if (k.sell !== 'idle') return;
  k.sell = 'aim';
}

/** A small shower of gold out of the suitcase when the lid is called: capped, so it stays a beat and not a storm. */
export function cashBurst(k: Kitchen): void {
  burst(k, k.suitX, 372, 22, '#f0c14a', 120, mulberry32(7));
}

/** G, M and I slide one slot left and the spare N takes the first: WAGMI becomes NGMI. */
function shuffleLetters(k: Kitchen): void {
  if (k.shuffled) return;
  k.shuffled = true;
  for (const l of k.letters) {
    if (l.ch === 'G') l.slot = 1;
    else if (l.ch === 'M') l.slot = 2;
    else if (l.ch === 'I') l.slot = 3;
    else if (l.ch === 'N') l.slot = 0;
  }
}

function slotTarget(l: Letter): { x: number; y: number; rot: number } {
  return l.slot >= 0 ? { x: SLOT_X[l.slot]!, y: SLOT_Y, rot: 0 } : { x: LOOSE_N.x, y: LOOSE_N.y, rot: LOOSE_N.rot };
}

function settleLetter(l: Letter): void {
  const t = slotTarget(l);
  settleSpring(l.sx, t.x);
  settleSpring(l.sy, t.y);
  settleSpring(l.sr, t.rot);
  l.x = t.x;
  l.y = t.y;
  l.rot = t.rot;
}

function dropLetter(l: Letter, vx: number, vy: number, vr: number): void {
  l.fallen = true;
  l.vx = vx;
  l.vy = vy;
  l.vr = vr;
}

function restLetter(l: Letter, x: number, rot: number): void {
  l.fallen = true;
  l.rest = true;
  l.x = x;
  l.y = COUNTER_REST;
  l.rot = rot;
  l.vx = l.vy = l.vr = 0;
}

function restPhoto(p: Photo, x: number, rot: number): void {
  p.fallen = true;
  p.rest = true;
  p.x = x;
  p.y = PHOTO_REST;
  p.rot = rot;
  p.vx = p.vy = p.vr = 0;
}

/** At 3.3x his elbow sends the red mug off the counter. */
function knockMug(k: Kitchen): void {
  k.knocked = true;
  const mug = k.mugs[1]!;
  mug.fallen = true;
  mug.vx = -40;
  mug.vy = -120;
  mug.vr = 6;
}

/** Drops, bounces and rolls any knocked mug until it rests on the floor. */
function dropMugs(k: Kitchen, dt: number): void {
  for (let i = 0; i < k.mugs.length; i += 1) {
    const mug = k.mugs[i]!;
    if (!mug.fallen) continue;
    mug.vy += 980 * dt;
    mug.x += mug.vx * dt;
    mug.y += mug.vy * dt;
    mug.rot += mug.vr * dt;
    if (mug.y > MUG_FLOOR) {
      mug.y = MUG_FLOOR;
      mug.vy *= -0.28;
      mug.vx *= 0.7;
      mug.vr *= 0.5;
      if (mug.hits === 0) k.events.mugHit = true;
      mug.hits += 1;
    }
  }
}

/**
 * Settles a fresh kitchen into a round that is already running, or over, at `multiplier`, for a scene that
 * missed the start: the texts so far are already read, the knocked mug lies on the floor, and the meter and
 * the stair light stand where the round has them. `heldX100` is the cash-out the meter froze at, if any.
 */
export function settleKitchen(k: Kitchen, multiplier: number, fear: number, heldX100: number | null): void {
  k.holding = heldX100 !== null;
  k.meter.x = meterTarget(heldX100 === null ? multiplier : heldX100 / 100);
  k.light.x = multiplier >= LIGHT_AT ? 1 : 0;
  k.lastM = multiplier;
  k.thumpClock = 0.8;
  k.catAlert = multiplier >= CREAK_AT && heldX100 === null ? 1 : 0;
  k.peek = heldX100 === null ? peekAt(multiplier) : 0;
  while (k.nextLine < LINES.length && multiplier >= LINES[k.nextLine]!.at) {
    const line = LINES[k.nextLine]!;
    // As in stepKitchen: once he has cashed out and gone up, he sends no more replies and her last text is never sent.
    if (!(heldX100 !== null && line.at * 100 > heldX100 && (!line.her || line.at >= 10))) k.bubbles.push({ text: line.text, her: line.her, age: 1 });
    k.nextLine += 1;
  }
  if (multiplier >= MUG_AT) {
    knockMug(k);
    for (let i = 0; i < 240; i += 1) dropMugs(k, 1 / 60);
  }
  // The cursor is already hovering as close to SELL as the fear has it, and the photo and the magnets are tilted for it.
  const approach = smoothstep(0.08, 0.95, fear) * 0.8;
  settleSpring(k.cursor.x, mix(CURSOR_HOME.x, SELL_CENTRE.x, approach));
  settleSpring(k.cursor.y, mix(CURSOR_HOME.y, SELL_CENTRE.y, approach));
  settleSpring(k.photo.tilt, fear * 0.32);
  for (const l of k.letters) {
    l.loose = looseness(l, fear);
    settleSpring(l.sr, slotTarget(l).rot + l.loose * (l.ch === 'W' ? -0.4 : 0.3));
    l.rot = l.sr.x;
  }
}

/** How far a magnet has worked loose: W first, A after it, the rest never. */
function looseness(l: Letter, fear: number): number {
  return l.ch === 'W' ? smoothstep(0.3, 1, fear) : l.ch === 'A' ? smoothstep(0.55, 1, fear) : 0;
}

/** A thump from upstairs: the ceiling cracks, dust falls, and the photo and any loose magnets rattle. */
function thumpCeiling(k: Kitchen, seed: number): void {
  k.thump = 1;
  k.events.thump = true;
  burst(k, 520, 70, 6, '#cabb9a', 50, mulberry32(seed));
  k.photo.tilt.v += 1.6;
  for (const l of k.letters) if (l.loose > 0.2 && !l.fallen) l.sr.v += l.ch === 'W' ? -2.6 : 2.2;
}

export function stepKitchen(k: Kitchen, drive: KitchenDrive, dt: number): void {
  k.events = noEvents();
  k.crashT += k.crashed ? dt : 0;
  k.thump = Math.max(0, k.thump - dt * 1.8);
  const m = drive.multiplier;
  const fill = meterTarget(m);
  const target = k.crashed && !k.harmless ? 0 : k.holding ? k.meter.x : fill;
  stepSpring(k.meter, target, k.crashed && !k.harmless ? 4 : 6, 0.9, dt);
  // The threat ladder only plays while he is still at the desk and the round runs.
  const live = drive.running && !k.crashed && !drive.traderGone;
  const crossed = (at: number): boolean => live && k.lastM < at && m >= at;
  const wasPeeking = k.peek > 0.25;
  k.peek += ((live ? peekAt(m) : 0) - k.peek) * (1 - Math.exp(-5 * dt));
  if (!wasPeeking && k.peek > 0.25) k.events.peek = true;
  if (crossed(FLICKER_AT)) {
    // The first fake-out: one thump and the stair light stutters on, then off again.
    thumpCeiling(k, 11);
    k.events.flicker = true;
  }
  if (crossed(CREAK_AT)) k.events.creak = true;
  if (crossed(MUG_AT)) {
    // His elbow goes out: the scene cues the jab.
    k.events.mug = true;
    k.knockIn = MUG_LAG;
  }
  k.catAlert += ((m >= CREAK_AT && (live || k.crashed) ? 1 : 0) - k.catAlert) * (1 - Math.exp(-6 * dt));
  const flick = live && m >= FLICKER_AT && m < FLICKER_AT + 0.08 ? (m - FLICKER_AT) / 0.08 : -1;
  const lit = (drive.running && !k.crashed && m >= LIGHT_AT) || k.peek > 0.25 || k.wifeMode === 'down' || k.wifeMode === 'floor' || k.wifeMode === 'wait' || (k.wifeMode === 'check' && k.wifeGoal > 0);
  if (flick >= 0) {
    k.light.x = flick < 0.18 || (flick > 0.34 && flick < 0.8) ? 0.85 : 0.06;
    k.light.v = 0;
  } else stepSpring(k.light, lit ? 1 : 0, 7, 0.85, dt);

  if (live && m >= THUMPS_AT) {
    // From 2.5x the ceiling thumps, closer together as the multiplier climbs.
    k.thumpClock -= dt;
    if (k.thumpClock <= 0) {
      k.thumpClock = 1.9 - 0.8 * smoothstep(THUMPS_AT, 10, m);
      thumpCeiling(k, Math.floor(m * 100));
    }
  } else if (!live) k.thumpClock = 0;
  k.lastM = m;
  stepFridge(k, drive, dt);
  stepCursor(k, drive, dt);

  while (k.nextLine < LINES.length && drive.multiplier >= LINES[k.nextLine]!.at && (drive.running || k.crashed)) {
    const line = LINES[k.nextLine]!;
    if (!(k.holding && (!line.her || line.at >= 10))) k.bubbles.push({ text: line.text, her: line.her, age: 0 });
    k.nextLine += 1;
    k.events.text = true;
    if (line.her) k.events.her = true;
  }
  if (drive.running && !k.crashed && !drive.traderGone && k.nextLine === LINES.length) {
    k.textClock += dt;
    if (k.textClock >= 8) {
      k.textClock %= 8;
      const her = k.overtimeLine % 2 === 0;
      k.bubbles.push({ text: OVERTIME_TEXTS[k.overtimeLine % OVERTIME_TEXTS.length]!, her, age: 0 });
      k.overtimeLine += 1;
      k.events.text = true;
      k.events.her = her;
    }
  }
  // Only the latest messages are drawn; old texts must not accumulate over long rounds.
  if (k.bubbles.length > 6) k.bubbles = k.bubbles.slice(-6);
  for (const b of k.bubbles) b.age += dt;

  // The mug goes once his elbow lands; with him gone from the desk it slides off on its own.
  k.knockIn = Math.max(0, k.knockIn - dt);
  if (drive.running && !k.knocked && m >= MUG_AT && k.knockIn === 0) knockMug(k);
  dropMugs(k, dt);

  // Wife, suitcase, ring, card, cat, dog.
  stepWife(k, drive, dt);
  if (k.wifeMode === 'floor' && !k.harmless && !k.rolling && k.wifeAge > 0.1) k.rolling = true;
  stepSpring(k.suitLid, k.rolling ? 0.72 : 0.08, 8, 0.7, dt);
  // The suitcase gets going over a third of a second instead of leaving at full speed.
  k.suitV = k.rolling ? k.suitV + (210 - k.suitV) * (1 - Math.exp(-6 * dt)) : 0;
  k.suitX += k.suitV * dt;
  if (k.rolling && !k.doorDone && k.suitX > 940) {
    k.doorDone = true;
    k.events.door = true;
  }
  if (k.ring.dropped && !k.ring.settled) {
    k.ring.vy += 1400 * dt;
    k.ring.x += k.ring.vx * dt;
    k.ring.y += k.ring.vy * dt;
    if (k.ring.y > 446) {
      k.ring.y = 446;
      k.ring.vy *= -0.32;
      k.ring.vx *= 0.65;
      if (!k.ringHit) {
        k.ringHit = true;
        k.events.ring = true;
      }
      if (Math.abs(k.ring.vy) < 50) k.ring.settled = true;
    }
  }
  if (k.rolling && !k.cardIn && k.crashT > 0.8) k.cardIn = true;
  stepSpring(k.cardX, k.cardIn ? 688 : 980, 7, 0.85, dt);

  const catTarget = k.catInCase || (k.rolling && !k.harmless) ? { x: k.suitX + 30, y: 400 } : { x: 132, y: 332 };
  const follow = 1 - Math.exp(-4 * dt);
  k.catX += (catTarget.x - k.catX) * follow;
  k.catY += (catTarget.y - k.catY) * follow;
  if (k.rolling && Math.hypot(k.catX - (k.suitX + 30), k.catY - 400) < 24) k.catInCase = true;
  if (k.rolling) k.dogX += (k.suitX - 70 - k.dogX) * (1 - Math.exp(-3 * dt));

  for (const bit of k.bits) {
    bit.age += dt;
    bit.vy += 280 * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  k.bits = k.bits.filter((bit) => bit.age < bit.life);
}

/** Seconds per tread: she storms down, checks more softly, and climbs back slower still. */
const stepTime = (k: Kitchen): number => k.wifeMode === 'down' ? 0.17 : k.wifeMode === 'back' ? 0.24 : 0.2;

/**
 * Her stairs: each step plants for a moment, then drops onto the next tread, which is the stomp. Caught, she storms
 * to the floor and flings the ring on the way; harmless, she waits for him to get upstairs, comes down three treads
 * to look, and goes back up into the dark.
 */
function stepWife(k: Kitchen, drive: KitchenDrive, dt: number): void {
  k.squash = Math.max(0, k.squash - dt / 0.07);
  k.fling = Math.max(0, k.fling - dt / 0.35);
  if (k.wifeMode === 'asleep') return;
  k.wifeAge += dt;
  if (k.wifeMode === 'wait') {
    if (drive.traderUp !== true) return;
    k.wifeMode = 'check';
    k.wifeAge = 0;
    k.wifeAt = k.wifeTo = 1;
    k.wifeGoal = 3;
  }
  if (k.wifeMode === 'check' && k.wifeAt === 3 && k.wifeAge > 1.05) {
    k.wifeMode = 'back';
    k.wifeGoal = 0;
  }
  k.wifeAlpha += ((k.wifeMode === 'back' && k.wifeAt === 0 ? 0 : 1) - k.wifeAlpha) * (1 - Math.exp(-(k.wifeMode === 'down' ? 60 : 9) * dt));
  k.wifeT += dt;
  for (;;) {
    if (k.wifeTo === k.wifeAt) {
      if (k.wifeAt === k.wifeGoal) {
        k.wifeT = 0;
        break;
      }
      k.wifeTo = k.wifeAt + Math.sign(k.wifeGoal - k.wifeAt);
    }
    const pace = stepTime(k);
    if (k.wifeT < pace) break;
    k.wifeT -= pace;
    k.wifeAt = k.wifeTo;
    k.squash = 1;
    k.events.step = true;
    if (k.wifeMode === 'down' && k.wifeAt === 4 && !k.ring.dropped) {
      // Halfway down she pulls the ring off and flings it at the table.
      const hand = wifeFeet(k);
      k.fling = 1;
      k.ring = { x: hand.x - 14, y: hand.y - 62, vx: -230, vy: -260, dropped: true, settled: false };
    }
    if (k.wifeMode === 'down' && k.wifeAt === FLOOR) {
      k.wifeMode = 'floor';
      k.wifeAge = 0;
    }
  }
  const lean = k.wifeTo === k.wifeAt ? 0 : -0.08 * Math.sign(k.wifeTo - k.wifeAt);
  k.wifeLean += (lean - k.wifeLean) * (1 - Math.exp(-14 * dt));
}

/** Where her feet are: planted on a tread, or partway through the drop to the next (a fall on the way down, a push up on the way back). */
function wifeFeet(k: Kitchen): { x: number; y: number } {
  const a = TREADS[k.wifeAt]!;
  const b = TREADS[k.wifeTo]!;
  const u = clamp((k.wifeT / stepTime(k) - 0.45) / 0.55, 0, 1);
  const e = b > a ? u * u : 1 - (1 - u) * (1 - u);
  return { x: mix(treadX(k.wifeAt), treadX(k.wifeTo), u), y: mix(a, b, e) };
}

/** The photo and the magnets: they tilt and shiver with the fear, and the crash drops them one by one and spells NGMI. */
function stepFridge(k: Kitchen, drive: KitchenDrive, dt: number): void {
  const hard = k.crashed && !k.harmless;
  const p = k.photo;
  if (hard) {
    // Just after the hit-stop the photo lets go, W falls with it, A hangs on a moment longer, then the rest slide over.
    if (!p.fallen && k.crashT > 0.12) {
      p.fallen = true;
      p.vx = -16;
      p.vy = -40;
      p.vr = -2.6;
    }
    for (const l of k.letters) {
      if (l.fallen) continue;
      if (l.ch === 'W') dropLetter(l, -34, -80, -6);
      else if (l.ch === 'A' && k.crashT > 0.3) dropLetter(l, 22, -60, 5);
    }
    if (k.crashT > 0.75) shuffleLetters(k);
  }
  if (p.fallen) {
    if (!p.rest) {
      p.vy += 980 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > PHOTO_REST) {
        p.y = PHOTO_REST;
        if (Math.abs(p.vy) < 70) {
          p.rest = true;
          p.vx = p.vy = p.vr = 0;
        } else {
          p.vy *= -0.3;
          p.vx *= 0.6;
          p.vr *= 0.45;
          k.events.photo = true;
        }
      }
    }
  } else stepSpring(p.tilt, drive.running && !k.crashed ? drive.fear * 0.32 : 0, 5, 0.35, dt);
  for (const l of k.letters) {
    if (l.fallen) {
      if (l.rest) continue;
      l.vy += 980 * dt;
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.rot += l.vr * dt;
      if (l.y > COUNTER_REST) {
        l.y = COUNTER_REST;
        if (Math.abs(l.vy) < 60) {
          l.rest = true;
          l.vx = l.vy = l.vr = 0;
        } else {
          l.vy *= -0.3;
          l.vx *= 0.6;
          l.vr *= 0.5;
          if (l.hits === 0) k.events.letter = true;
          l.hits += 1;
        }
      }
      continue;
    }
    const t = slotTarget(l);
    if (drive.running && !k.crashed) l.loose = looseness(l, drive.fear);
    let rot = t.rot + l.loose * (l.ch === 'W' ? -0.4 : 0.3);
    if (l.loose > 0.5 && !k.crashed) rot += (noise(Math.floor(drive.time * 14) + l.slot * 9) - 0.5) * 0.16 * l.loose;
    stepSpring(l.sx, t.x, 9, 0.55, dt);
    stepSpring(l.sy, t.y, 9, 0.55, dt);
    stepSpring(l.sr, rot, 6, 0.4, dt);
    l.x = l.sx.x;
    l.y = l.sy.x;
    l.rot = l.sr.x;
  }
}

/**
 * The cursor on the laptop: it drifts toward SELL as the fear climbs, pulls back, drifts closer, and shivers right
 * over the button near the top without ever clicking. The cash-out clicks it; after the crash it clicks and clicks.
 */
function stepCursor(k: Kitchen, drive: KitchenDrive, dt: number): void {
  k.sellFlash = Math.max(0, k.sellFlash - dt * 2.4);
  if (k.sell === 'idle') {
    const approach = drive.running ? smoothstep(0.08, 0.95, drive.fear) : 0;
    k.hover += dt * (1.1 + approach * 1.6);
    const hover = approach * (0.8 + 0.2 * Math.sin(k.hover));
    let tx = mix(CURSOR_HOME.x, SELL_CENTRE.x, hover);
    let ty = mix(CURSOR_HOME.y, SELL_CENTRE.y, hover);
    if (approach > 0.5) {
      tx += (noise(Math.floor(drive.time * 23)) - 0.5) * 7 * approach;
      ty += (noise(Math.floor(drive.time * 19) + 5) - 0.5) * 6 * approach;
    }
    stepSpring(k.cursor.x, tx, 3.5, 0.75, dt);
    stepSpring(k.cursor.y, ty, 3.5, 0.75, dt);
  } else if (k.sell === 'aim' || k.sell === 'clicked') {
    // The cash-out: it darts the last stretch to SELL, the screen flashes SOLD when it lands, and it settles there.
    stepSpring(k.cursor.x, SELL_CENTRE.x + 8, 18, 0.8, dt);
    stepSpring(k.cursor.y, SELL_CENTRE.y + 6, 18, 0.8, dt);
    if (k.sell === 'aim' && Math.hypot(k.cursor.x.x - SELL_CENTRE.x - 8, k.cursor.y.x - SELL_CENTRE.y - 6) < 5) {
      k.sell = 'clicked';
      k.sellFlash = 1;
    }
  } else if (k.sell === 'dead' && k.crashT < 3) {
    const jx = (noise(Math.floor(drive.time * 30)) - 0.5) * 5;
    const jy = (noise(Math.floor(drive.time * 26) + 3) - 0.5) * 4;
    stepSpring(k.cursor.x, SELL_CENTRE.x + 6 + jx, 14, 0.6, dt);
    stepSpring(k.cursor.y, SELL_CENTRE.y + 4 + jy, 14, 0.6, dt);
    k.clickPulse = (k.clickPulse + dt * 5) % 1;
  }
}

export function visibleMugs(multiplier: number): number {
  return clamp(Math.round(1 + Math.log2(Math.max(1, multiplier)) * 1.35), 1, MUGS.length);
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

export function drawRoom(ctx: CanvasRenderingContext2D, k: Kitchen, time: number): void {
  ctx.fillStyle = '#120e16';
  ctx.fillRect(0, 0, 960, 540);
  // Moonlit window.
  ctx.fillStyle = '#241c2e';
  ctx.fillRect(0, 0, 960, 470);
  ctx.fillStyle = '#1a2438';
  ctx.beginPath();
  ctx.roundRect(46, 78, 150, 110, 6);
  ctx.fill();
  ink(ctx, 3);
  ctx.stroke();
  ctx.fillStyle = '#f4efe2';
  ctx.beginPath();
  ctx.arc(150, 118, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#31405c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(121, 78);
  ctx.lineTo(121, 188);
  ctx.moveTo(46, 132);
  ctx.lineTo(196, 132);
  ctx.stroke();
  // Clock.
  const flicker = 0.65 + 0.35 * (Math.sin(time * 3) > 0 ? 1 : 0.35);
  ctx.globalAlpha = flicker;
  ctx.fillStyle = '#ff4d6a';
  ctx.font = '700 22px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('3:07', 214, 110);
  ctx.globalAlpha = 1;
  // Fridge and the photo that cracks if the chart kills the night.
  ctx.fillStyle = '#d5dbe3';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(28, 188, 132, 230, 8);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#aeb6c2';
  ctx.beginPath();
  ctx.moveTo(28, 300);
  ctx.lineTo(160, 300);
  ctx.stroke();
  if (!k.photo.fallen) drawPhoto(ctx, PHOTO_HOME.x, PHOTO_HOME.y, k.photo.tilt.x, false);
  for (const l of k.letters) if (!l.fallen) drawLetter(ctx, l);
  // Cabinets, counter, floor.
  ctx.fillStyle = '#3a2d38';
  ctx.fillRect(180, 200, 500, 36);
  ctx.fillStyle = '#4a3b34';
  ctx.fillRect(0, 418, 700, 22);
  ctx.fillStyle = '#2a211c';
  ctx.fillRect(0, 470, 960, 70);
  // Stairs.
  ctx.fillStyle = '#3c3344';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(700, 470);
  ctx.lineTo(860, 150);
  ctx.lineTo(960, 150);
  ctx.lineTo(960, 470);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#2a2432';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i += 1) {
    const y = 180 + i * 40;
    ctx.beginPath();
    ctx.moveTo(700 + (470 - y) / 2, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }
  // The landing light: a bare bulb at the top of the stairs (drawLight makes it glow).
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(BULB.x, BULB.y - 26);
  ctx.lineTo(BULB.x, BULB.y - 6);
  ctx.stroke();
  ctx.fillStyle = '#4a4252';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.arc(BULB.x, BULB.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const prints = Math.floor(k.peek * 6 + (k.wifeMode === 'asleep' || k.wifeMode === 'wait' ? 0 : 6));
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < prints; i += 1) {
    const y = 200 + i * 36;
    ctx.beginPath();
    ctx.ellipse(860 + (i % 2) * 16, y, 6, 3, 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Door.
  ctx.fillStyle = '#4d3a32';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(888, 250, 70, 220, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e6c56a';
  ctx.beginPath();
  ctx.arc(906, 360, 4, 0, Math.PI * 2);
  ctx.fill();
  // Ceiling crack on a thump.
  if (k.thump > 0.02) {
    ctx.globalAlpha = k.thump;
    ctx.strokeStyle = '#d9d0c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(430, 36);
    ctx.lineTo(490, 58);
    ctx.lineTo(540, 40);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Her peeks: two treads down in the stair light, leaning out to look at the laptop, before she commits.
  if (k.peek > 0.04 && k.wifeMode === 'asleep') {
    ctx.globalAlpha = clamp(k.peek * 1.4, 0, 1);
    drawWife(ctx, treadX(2) + 18 * (1 - k.peek), TREADS[2], 'peek', true, 0, -0.22 * k.peek, 0);
    ctx.globalAlpha = 1;
  }
  // What the crash shook off the fridge lies on the floor in front of it.
  for (const l of k.letters) if (l.fallen) drawLetter(ctx, l);
  if (k.photo.fallen) drawPhoto(ctx, k.photo.x, k.photo.y, k.photo.rot, true);
  // Chair, empty once he leaves. Drawn under him.
  ctx.fillStyle = '#6b5348';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.roundRect(DESK.x - 34, DESK.y - 16, 68, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(DESK.x - 28, DESK.y - 16);
  ctx.lineTo(DESK.x - 28, DESK.y - 70);
  ctx.lineTo(DESK.x + 28, DESK.y - 70);
  ctx.stroke();
}

const SKIN_A = '#f3dccb';
const MAGNET_COLOURS: Record<string, string> = { W: '#e94f64', A: '#4fa3e9', G: '#f2c14e', M: '#6fd07a', I: '#e98a4f', N: '#c07de9' };

/** A fridge magnet letter, drawn about its centre. */
function drawLetter(ctx: CanvasRenderingContext2D, l: Letter): void {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.rot);
  ctx.font = '900 19px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.strokeText(l.ch, 0, 1);
  ctx.fillStyle = MAGNET_COLOURS[l.ch] ?? '#ffffff';
  ctx.fillText(l.ch, 0, 1);
  ctx.restore();
}

/** The wedding photo, about its centre; cracked once it has hit the floor. */
function drawPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, cracked: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#f7f1e4';
  ctx.beginPath();
  ctx.roundRect(-27, -23, 54, 46, 3);
  ctx.fill();
  ink(ctx, 1.5);
  ctx.stroke();
  ctx.fillStyle = SKIN_A;
  ctx.beginPath();
  ctx.arc(-9, -3, 8, 0, Math.PI * 2);
  ctx.arc(11, -1, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4eef8';
  ctx.beginPath();
  ctx.roundRect(-20, 6, 18, 14, 2);
  ctx.fill();
  ctx.fillStyle = '#26364a';
  ctx.beginPath();
  ctx.roundRect(2, 6, 18, 14, 2);
  ctx.fill();
  if (cracked) {
    ctx.strokeStyle = '#c23b4e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-25, -21);
    ctx.lineTo(-6, 2);
    ctx.lineTo(-12, 8);
    ctx.lineTo(25, 21);
    ctx.stroke();
  }
  // A magnet holds the corner, until it does not.
  if (!cracked) {
    ctx.fillStyle = '#e94f64';
    ctx.beginPath();
    ctx.arc(20, -18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** The mouse pointer, tip at (x, y). */
function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.15, 1.15);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 12);
  ctx.lineTo(3, 9.4);
  ctx.lineTo(5.4, 14);
  ctx.lineTo(7.6, 13);
  ctx.lineTo(5.2, 8.6);
  ctx.lineTo(9, 8.6);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Her, standing at her feet: `squash` is the landing of a stomp, `lean` tips her toward the kitchen, `fling` throws an arm out. */
function drawWife(ctx: CanvasRenderingContext2D, x: number, y: number, mood: 'peek' | 'angry' | 'soft', ringOn: boolean, squash: number, lean: number, fling: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(1 + 0.07 * squash, 1 - 0.1 * squash);
  ctx.fillStyle = '#f4eef8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-18, -6);
  ctx.lineTo(-22, -78);
  ctx.lineTo(22, -78);
  ctx.lineTo(18, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6b4a3c';
  ctx.beginPath();
  ctx.arc(0, -96, 8, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -84, 14, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN_A;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  const wide = mood === 'angry' ? 2.4 : 1.6;
  ctx.beginPath();
  ctx.ellipse(-5, -86, 1.6, wide, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -86, 1.6, wide, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (mood === 'angry') {
    ctx.moveTo(-9, -94);
    ctx.lineTo(-2, -90);
    ctx.moveTo(9, -94);
    ctx.lineTo(2, -90);
    ctx.moveTo(-4, -74);
    ctx.lineTo(4, -74);
  } else {
    ctx.moveTo(-4, -76);
    ctx.quadraticCurveTo(0, -72, 5, -76);
  }
  ctx.stroke();
  // Arms crossed, ring still on until it drops; the fling throws one arm out toward the table.
  ctx.strokeStyle = SKIN_A;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-14, -70);
  ctx.lineTo(14, -58);
  ctx.moveTo(14, -70);
  if (fling > 0) {
    const f = Math.sin(Math.PI * Math.sqrt(1 - fling));
    ctx.lineTo(mix(-14, -34, f), mix(-58, -80, f));
  } else ctx.lineTo(-14, -58);
  ctx.stroke();
  if (ringOn) {
    ctx.fillStyle = '#e6c56a';
    ctx.beginPath();
    ctx.arc(-12, -60, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLaptop(ctx: CanvasRenderingContext2D, k: Kitchen, lid: number, time: number, fear: number): void {
  const { x, y, w, h } = LAPTOP;
  const chartDead = k.chartDead;
  const deadAge = k.crashT;
  const shake = 0; // A planted keyboard stays still; nervous motion belongs to the shoulders.
  ctx.save();
  ctx.translate(shake, 0);
  ctx.fillStyle = '#2a3038';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(x, y + 8, w, h * 0.42, 4);
  ctx.fill();
  ctx.stroke();
  // Keyboard lip.
  ctx.fillStyle = '#1c2128';
  ctx.fillRect(x + 18, y + 16, w - 36, 10);
  const open = 1 - lid;
  const screenH = Math.max(0, h * open);
  if (screenH > 6) {
    const hingeY = y + 8;
    const top = hingeY - screenH;
    const inset = 8 * (1 - open);
    ctx.fillStyle = '#1b2128';
    ctx.beginPath();
    ctx.moveTo(x + inset, top);
    ctx.lineTo(x + w - inset, top);
    ctx.lineTo(x + w, hingeY);
    ctx.lineTo(x, hingeY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + inset + 6, top + 6);
    ctx.lineTo(x + w - inset - 6, top + 6);
    ctx.lineTo(x + w - 8, hingeY - 4);
    ctx.lineTo(x + 8, hingeY - 4);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = chartDead ? '#240810' : '#06140e';
    ctx.fillRect(x, top, w, screenH);
    ctx.beginPath();
    const n = 22;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      let py = hingeY - 10 - (screenH - 22) * Math.pow(t, 1.45);
      py += Math.sin(time * 3 + i) * 1.5;
      if (chartDead && t > 1 - clamp(deadAge / 0.45, 0, 1)) py = hingeY - 8;
      if (i === 0) ctx.moveTo(x + 16 + t * (w - 32), py);
      else ctx.lineTo(x + 16 + t * (w - 32), py);
    }
    ctx.strokeStyle = chartDead ? '#ff4d6d' : '#39ff8a';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // The SELL button he never clicks, and the cursor hovering over it.
    const clicked = k.sell === 'clicked';
    const dead = k.sell === 'dead';
    ctx.fillStyle = clicked ? '#39ff8a' : dead ? '#4a4f58' : '#e0323c';
    ctx.beginPath();
    ctx.roundRect(SELL_BTN.x, SELL_BTN.y, SELL_BTN.w, SELL_BTN.h, 3);
    ctx.fill();
    ctx.fillStyle = clicked ? '#06140e' : dead ? '#8a8f98' : '#ffffff';
    ctx.font = '900 10px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clicked ? 'SOLD' : dead ? "CAN'T" : 'SELL', SELL_BTN.x + SELL_BTN.w / 2, SELL_BTN.y + SELL_BTN.h / 2 + 0.5);
    if (dead && deadAge < 3) {
      // Clicking, clicking, clicking.
      const r = 3 + k.clickPulse * 13;
      ctx.globalAlpha = 1 - k.clickPulse;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(k.cursor.x.x, k.cursor.y.x, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawCursor(ctx, k.cursor.x.x, k.cursor.y.x);
    if (k.sellFlash > 0.02) {
      ctx.globalAlpha = k.sellFlash * 0.75;
      ctx.fillStyle = '#d8ffe6';
      ctx.fillRect(x, top, w, screenH);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawMug(ctx: CanvasRenderingContext2D, mug: Mug): void {
  ctx.save();
  ctx.translate(mug.x, mug.y);
  ctx.rotate(mug.rot);
  ctx.fillStyle = mug.color;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(-10, -16, 20, 18, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(12, -6, 5, -1.2, 1.2);
  ctx.stroke();
  ctx.restore();
}

/** The cat: `alert` lifts the head toward the stairs, narrows the eyes and stiffens the tail. */
function drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, lookAt: number, alert: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#6a6a72';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(2 * alert, -5 * alert);
  ctx.beginPath();
  ctx.ellipse(18, -8, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const ear = 3 * alert;
  ctx.beginPath();
  ctx.moveTo(12, -16);
  ctx.lineTo(14, -24 - ear);
  ctx.lineTo(18, -14);
  ctx.moveTo(20, -16);
  ctx.lineTo(26, -24 - ear);
  ctx.lineTo(24, -13);
  ctx.fill();
  ctx.stroke();
  const pupil = clamp((lookAt - x) / 80, -1, 1) + alert;
  ctx.fillStyle = '#d6f56a';
  ctx.beginPath();
  ctx.ellipse(16 + pupil, -8, 2, 2.4 - 0.8 * alert, 0, 0, Math.PI * 2);
  ctx.ellipse(22 + pupil, -8, 2, 2.4 - 0.8 * alert, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 + alert;
  ctx.beginPath();
  ctx.moveTo(-20, -2);
  ctx.quadraticCurveTo(mix(-34, -30, alert), mix(-16 + Math.sin(time * 4) * 6, -34, alert), mix(-26, -22, alert), mix(6, -30, alert));
  ctx.stroke();
  ctx.restore();
}

export function drawMid(ctx: CanvasRenderingContext2D, k: Kitchen, multiplier: number, time: number, dialogue = true): void {
  if (!k.catInCase) drawCat(ctx, k.catX, k.catY, time, LAPTOP.x, k.catAlert);
  const n = visibleMugs(multiplier);
  for (let i = 0; i < k.mugs.length; i += 1) {
    const mug = k.mugs[i]!;
    if (i >= n && !mug.fallen) continue;
    drawMug(ctx, mug);
    if (!mug.fallen) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#d7e8ef';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(mug.x, mug.y - 22 - (time * 12 + i * 5) % 10, 4, 0.4, Math.PI - 0.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // Phone and the stack of unread texts.
  ctx.fillStyle = '#17191e';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(168, 424, 28, 44, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8fd0ff';
  ctx.fillRect(172, 430, 20, 28);
  const shown = dialogue ? k.bubbles.slice(-4) : [];
  shown.forEach((bubble, index) => {
    const rise = clamp(bubble.age / 0.25, 0, 1);
    const y = 292 - index * 26 - (1 - rise) * 10;
    ctx.globalAlpha = rise;
    ctx.font = '700 12px system-ui, sans-serif';
    const width = Math.min(190, ctx.measureText(bubble.text).width + 16);
    const x = bubble.her ? 188 : 204;
    ctx.fillStyle = bubble.her ? '#3b82f6' : '#3a3f4a';
    ctx.beginPath();
    ctx.roundRect(x, y, width, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#f4f7fb';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubble.text, x + 8, y + 11, width - 16);
    ctx.globalAlpha = 1;
  });
}

/** The suitcase meter, on the floor beside the stair foot; the room draws it before anyone walks past or climbs. */
export function drawSuitcase(ctx: CanvasRenderingContext2D, k: Kitchen): void {
  const fill = clamp(k.meter.x, 0, 1);
  ctx.save();
  ctx.translate(k.suitX, 392);
  ctx.fillStyle = '#7a4e32';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(-70, -20, 140, 88, 8);
  ctx.fill();
  ctx.stroke();
  // Interior gold, clipped, with the milestone stickers.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-62, 60 - fill * 78, 124, fill * 78 + 4);
  ctx.clip();
  ctx.fillStyle = '#f0c14a';
  ctx.fillRect(-62, -12, 124, 80);
  ctx.fillStyle = '#c6922e';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAMBO', -30, 28);
  if (fill > 0.45) ctx.fillText('LAWYER', 28, 44);
  if (fill > 0.7) ctx.fillText('BOAT', 0, 16);
  ctx.restore();
  // Lid leans back while the case is the meter, and sits down when the cat is in the way.
  const lean = (1 - k.suitLid.x) * 46;
  ctx.fillStyle = '#8d5b3b';
  ctx.beginPath();
  ctx.moveTo(-70, -20);
  ctx.lineTo(70, -20);
  ctx.lineTo(58, -28 - lean);
  ctx.lineTo(-58, -28 - lean);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e6c56a';
  ctx.fillRect(-16, -36 - lean, 32, 8);
  ink(ctx, 2);
  ctx.strokeRect(-16, -36 - lean, 32, 8);
  if (k.catInCase) {
    ctx.fillStyle = '#6a6a72';
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-14, -22);
    ctx.lineTo(-2, -10);
    ctx.moveTo(6, -8);
    ctx.lineTo(14, -22);
    ctx.lineTo(8, -8);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** The dog trots after the suitcase; its legs move with the ground it covers. */
function drawDog(ctx: CanvasRenderingContext2D, x: number): void {
  ctx.save();
  ctx.translate(x, 456);
  ctx.fillStyle = '#c47a3a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(0, -10, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(16, -16, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  for (const lx of [-10, -2, 6, 12]) {
    ctx.beginPath();
    ctx.moveTo(lx, -4);
    ctx.lineTo(lx + Math.sin(x * 0.28 + lx) * 3, 2 - Math.max(0, Math.cos(x * 0.28 + lx)) * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFront(ctx: CanvasRenderingContext2D, k: Kitchen): void {
  if (k.wifeMode !== 'asleep' && k.wifeMode !== 'wait' && k.wifeAlpha > 0.02) {
    // On the stairs, clear of the suitcase beside their foot. She leans into each drop and stands up straight on the floor.
    const feet = wifeFeet(k);
    ctx.globalAlpha = k.wifeAlpha;
    drawWife(ctx, feet.x, feet.y, k.harmless ? 'soft' : 'angry', !k.ring.dropped, k.squash, k.wifeLean, k.fling);
    ctx.globalAlpha = 1;
  }
  if (k.rolling && k.dogX < 980) drawDog(ctx, k.dogX);
  if (k.ring.dropped) {
    ctx.save();
    ctx.translate(k.ring.x, k.ring.y);
    ctx.strokeStyle = '#e6c56a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff6d4';
    ctx.beginPath();
    ctx.arc(0, -1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (k.cardX.x < 970) {
    ctx.save();
    ctx.translate(k.cardX.x, 492);
    ctx.rotate(-0.04);
    ctx.fillStyle = '#f7f4ea';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.roundRect(0, -36, 150, 44, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 13px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SPLIT & CO', 10, -18);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('the cat chose her', 10, -4);
    ctx.restore();
  }
  for (const bit of k.bits) {
    ctx.globalAlpha = clamp(1 - bit.age / bit.life, 0, 1);
    ctx.fillStyle = bit.color;
    ctx.beginPath();
    ctx.arc(bit.x, bit.y, bit.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawLight(ctx: CanvasRenderingContext2D, k: Kitchen): void {
  if (k.light.x < 0.02) return;
  const halo = ctx.createRadialGradient(BULB.x, BULB.y, 2, BULB.x, BULB.y, 70);
  halo.addColorStop(0, `rgba(255, 226, 160, ${0.55 * k.light.x})`);
  halo.addColorStop(1, 'rgba(255, 226, 160, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(BULB.x - 70, BULB.y - 70, 140, 140);
  ctx.globalAlpha = k.light.x;
  ctx.fillStyle = '#fff1c4';
  ctx.beginPath();
  ctx.arc(BULB.x, BULB.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(820, 80, 820, 480);
  g.addColorStop(0, `rgba(255, 206, 140, ${0.42 * k.light.x})`);
  g.addColorStop(1, 'rgba(255, 206, 140, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(720, 80);
  ctx.lineTo(960, 40);
  ctx.lineTo(960, 520);
  ctx.lineTo(640, 520);
  ctx.closePath();
  ctx.fill();
}

export function drawVignette(ctx: CanvasRenderingContext2D, lid: number): void {
  const g = ctx.createRadialGradient(480, 300, 120, 480, 280, 560);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.45 + lid * 0.25})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 540);
}

export function drawGlow(ctx: CanvasRenderingContext2D, lid: number, dead: boolean): void {
  if (lid > 0.85) return;
  const alpha = (1 - lid) * 0.45;
  const g = ctx.createRadialGradient(460, 360, 20, 460, 360, 280);
  g.addColorStop(0, dead ? `rgba(255, 60, 90, ${alpha})` : `rgba(60, 255, 150, ${alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 540);
}
