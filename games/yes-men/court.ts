/**
 * The war room of Yes Men: crimson walls under a gold cornice, the Leader's portrait growing behind his chair,
 * two flags, a DAYS WITHOUT ELECTIONS counter, a clock that becomes YEAR 1, the door out, the long table with
 * the TOTAL CONTROL button under its glass, the decrees he stamps, the conversation keyed to the multiplier
 * (a worse decree at every step and the ministers agreeing harder), the STATE TV chyron, and the crash: the
 * slam, the red lights, the banner, the papers and medals in the air, and the camera flash that turns the room
 * into the historical photo. Drawn on a 960 × 540 canvas; presentation only, nothing here picks the outcome.
 */
import { drawLeaderFace } from './cast';
import { box, BUBBLE_FONT, BUTTON, DECREES, DOOR, FLOOR_Y, ink, INK, LEADER, MEME_FONT, memeText, SEATS, TABLE, TITLES, wrap, YOU } from './ink';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

export type Who = 'leader' | 'yes' | 'you' | 'guard' | 'new';
/**
 * A line of the meeting. `cap` becomes the HUD caption when it is said, `head` scrolls on the chyron, `by` is
 * the minister who says a chorus line (round-robin otherwise), `thought` draws the player's line as a thought.
 */
export interface Line { at: number; who: Who; text: string; cap?: string; head?: string; by?: number; thought?: boolean }
/**
 * The agenda, keyed to the multiplier: every decree is worse than the last and the room agrees harder. The
 * player's thoughts are the only dissent, and they stay thoughts. Half of all rounds end before 2×, so the
 * early items come a few seconds apart; the ladder keeps authored items through 100×, then SECONDS cycles.
 */
export const LINES: Line[] = [
  { at: 1.03, who: 'leader', text: 'first item. rename Tuesday. after me.', cap: 'TUESDAY IS CANCELLED', head: 'TUESDAY RENAMED "LEADERDAY" EFFECTIVE LAST WEEK' },
  { at: 1.09, who: 'yes', text: 'inspired, sir. I never liked Tuesday', by: 0 },
  { at: 1.15, who: 'leader', text: 'move the elections. to never.', cap: 'ELECTIONS: NEVER', head: 'ELECTIONS POSTPONED INDEFINITELY (VIBES)' },
  { at: 1.2, who: 'yes', text: 'elections are so last term, sir', by: 1 },
  { at: 1.25, who: 'you', text: 'ok that one’s… hm', thought: true },
  { at: 1.31, who: 'leader', text: 'the press gets a vacation. permanent.', cap: 'PRESS ON VACATION', head: 'JOURNALISTS ENJOY MANDATORY HOLIDAY, NO RETURN FLIGHTS' },
  { at: 1.37, who: 'yes', text: 'already booked, sir. one way', by: 2 },
  { at: 1.45, who: 'leader', text: 'term limits? cringe. delete.', cap: 'TERM LIMITS DELETED', head: 'LIMITS DEEMED CRINGE BY UNANIMOUS NOD' },
  { at: 1.5, who: 'yes', text: 'limits were holding you back, sir', by: 3 },
  { at: 1.58, who: 'leader', text: 'my face. on the money. all of it.', cap: 'FACE ON THE MONEY', head: '$LEADER COIN LAUNCHES, 100% OF SUPPLY HELD BY LEADER' },
  { at: 1.64, who: 'yes', text: 'finally, a currency with a jawline', by: 4 },
  { at: 1.7, who: 'you', text: 'say something. say something.', thought: true },
  { at: 1.78, who: 'leader', text: 'the opposition leader? a window inspection.', cap: 'WINDOW INSPECTION', head: 'OPPOSITION LEADER TO INSPECT WINDOW (12TH FLOOR)' },
  { at: 1.85, who: 'yes', text: 'windows don’t inspect themselves, sir', by: 5 },
  { at: 1.95, who: 'leader', text: 'the courts are my group chat now.', cap: 'COURTS = GROUP CHAT', head: 'SUPREME COURT ADDED TO GROUP CHAT, THEN MUTED' },
  { at: 2.02, who: 'yes', text: 'added, sir. the judges are on read', by: 0 },
  { at: 2.12, who: 'leader', text: 'ban the word “no”.', cap: '“NO” IS BANNED', head: '"NO" REMOVED FROM DICTIONARY, "YES" NOW ALSO MEANS NO' },
  { at: 2.2, who: 'yes', text: 'y— affirmative, sir', by: 2 },
  { at: 2.3, who: 'you', text: 'i could just leave. the door is right there.', thought: true },
  { at: 2.42, who: 'leader', text: 'loyalty oath. daily. sung. in harmony.', cap: 'SUNG LOYALTY OATH', head: 'NATIONAL ANTHEM NOW JUST HIS NAME, 40 MINUTES' },
  { at: 2.5, who: 'yes', text: '♪ we were born loyal ♪', by: 4 },
  { at: 2.62, who: 'leader', text: 'who stopped clapping first.', cap: 'WHO STOPPED CLAPPING', head: 'HEAD OF APPLAUSE RETIRES SUDDENLY, AGED 41' },
  { at: 2.72, who: 'yes', text: 'not me sir. still going. sir. still going', by: 3 },
  { at: 2.88, who: 'leader', text: 'surveillance. of dreams. everyone’s.', cap: 'DREAM SURVEILLANCE', head: 'SLEEP NOW REQUIRES A PERMIT' },
  { at: 2.98, who: 'yes', text: 'I dreamt of you, sir. please log it', by: 5 },
  { at: 3.12, who: 'leader', text: 'history: I invented bread. write it down.', cap: 'HE INVENTED BREAD', head: 'TEXTBOOKS RECALLED, BREAD CHAPTER CORRECTED' },
  { at: 3.22, who: 'yes', text: 'delicious decree, sir', by: 0 },
  { at: 3.35, who: 'you', text: 'this is going too far. THIS is going too far.', thought: true },
  { at: 3.55, who: 'leader', text: 'the neighbours’ country is ours now. vibes.', cap: 'MANIFEST VIBES', head: 'BORDER MOVED 400 KM "FOR THE VIBES"' },
  { at: 3.7, who: 'yes', text: 'manifest vibes, sir. the map’s updated', by: 2 },
  { at: 3.95, who: 'leader', text: 'my son is emperor. he’s four.', cap: 'EMPEROR, AGED 4', head: 'EMPEROR’S FIRST DECREE: NO BEDTIME' },
  { at: 4.15, who: 'yes', text: 'a prodigy, sir. he ate my badge', by: 4 },
  { at: 4.45, who: 'leader', text: 'emergency powers. forever. it’s my birthday.', cap: 'FOREVER BIRTHDAY', head: 'STATE OF EMERGENCY EXTENDED TO "ALWAYS"' },
  { at: 4.65, who: 'yes', text: 'happy forever birthday, sir', by: 3 },
  { at: 5.05, who: 'leader', text: 'dissidents go to the Smile Camp.', cap: 'SMILE CAMP', head: 'SMILE CAMP OPENS, REVIEWS: 5 STARS (MANDATORY)' },
  { at: 5.3, who: 'yes', text: 'smiles mandatory, sir. frowns noted', by: 5 },
  { at: 5.8, who: 'you', text: 'everyone’s just… nodding. am I nodding?', thought: true },
  { at: 6.3, who: 'leader', text: 'a statue of me. in every living room.', cap: 'STATUES IN YOUR HOMES', head: 'LIVING ROOMS TO BE 60% STATUE BY LAW' },
  { at: 6.7, who: 'yes', text: 'living room’s cleared, sir. kids are outside', by: 0 },
  { at: 7.5, who: 'leader', text: 'the sun rises on my say-so now.', cap: 'SUN BY DECREE', head: 'SUNRISE DELAYED, SUN "UNDER REVIEW"' },
  { at: 8, who: 'yes', text: 'it was late this morning, sir. it’s been written up', by: 2 },
  { at: 9, who: 'leader', text: 'the internet is just my speeches now.', cap: 'INTERNET = SPEECHES', head: 'WIFI PASSWORD CHANGED TO HIS NAME' },
  { at: 9.6, who: 'yes', text: 'finally, no misinformation, sir', by: 4 },
  { at: 11, who: 'leader', text: 'delete the past. we start at Year One.', cap: 'YEAR ONE', head: 'CALENDAR RESET, YOUR BIRTHDAY NO LONGER EXISTS' },
  { at: 12, who: 'yes', text: 'happy Year One, sir. what’s a year', by: 3 },
  { at: 13.5, who: 'you', text: 'leave now and I’m a “former person”. stay and I’m in the photo.', thought: true },
  { at: 15, who: 'leader', text: 'I am the state. also the weather.', cap: 'HE IS THE WEATHER', head: 'FORECAST: GLORIOUS, WITH A CHANCE OF HIM' },
  { at: 16.5, who: 'yes', text: 'lovely weather you’re being, sir', by: 5 },
  { at: 19, who: 'leader', text: 'immortality. pass it. unanimous.', cap: 'IMMORTALITY PASSED', head: 'DEATH BANNED (EXEMPTIONS APPLY)' },
  { at: 21, who: 'yes', text: 'aye. aye. eternal aye, sir', by: 0 },
  { at: 25, who: 'leader', text: 'ban gravity. it’s holding us down.', cap: 'GRAVITY BANNED', head: 'GRAVITY DECLARED A FOREIGN AGENT' },
  { at: 28, who: 'yes', text: 'already floating, sir', by: 2 },
  { at: 34, who: 'leader', text: 'the moon? mine. tell it.', cap: 'THE MOON IS HIS', head: 'MOON SUMMONED FOR QUESTIONING' },
  { at: 38, who: 'yes', text: 'the moon’s been informed, sir. it agreed', by: 4 },
  { at: 45, who: 'leader', text: 'every baby gets my face. at birth.', cap: 'FACE AT BIRTH', head: 'MATERNITY WARDS ISSUED STENCILS' },
  { at: 50, who: 'yes', text: 'my kids are so lucky, sir', by: 3 },
  { at: 60, who: 'leader', text: 'I’m god now. minor update. no action needed.', cap: 'MINOR UPDATE: GOD', head: 'PATCH NOTES: HE IS GOD (BUG FIXES)' },
  { at: 68, who: 'yes', text: 'patch notes approved, sir. five stars', by: 5 },
  { at: 80, who: 'leader', text: 'the clapping never stops. that’s the law now.', cap: 'THE CLAPPING IS THE LAW', head: 'APPLAUSE ENTERS HOUR ELEVEN' },
  { at: 90, who: 'yes', text: 'we have no hands left, sir. we clap with our hearts', by: 0 },
  { at: 100, who: 'leader', text: 'next item: the universe.', cap: 'NEXT: THE UNIVERSE', head: 'UNIVERSE SERVED NOTICE' },
];
/** Past the agenda the meeting re-approves itself, every six seconds, for as long as the round runs. */
const SECONDS: Omit<Line, 'at'>[] = [
  { who: 'leader', text: 're-approve everything. louder.', cap: 'RE-APPROVED. LOUDER.', head: 'EVERYTHING RE-APPROVED, LOUDER' },
  { who: 'yes', text: 'LOUDER, sir', by: 2 },
  { who: 'leader', text: 'the number goes up because I said so.', cap: 'NUMBER UP BY DECREE', head: 'NUMBER ORDERED TO GO UP, COMPLIES' },
  { who: 'you', text: 'my hands are clapping on their own', thought: true },
  { who: 'leader', text: 'ban Tuesday again. for good measure.', cap: 'TUESDAY: DOUBLE BANNED', head: 'TUESDAY BANNED AGAIN TO BE SAFE' },
  { who: 'yes', text: 'double banned, sir', by: 4 },
  { who: 'leader', text: 'give the medal a medal.', cap: 'A MEDAL FOR THE MEDAL', head: 'MEDAL DECORATED FOR SERVICE TO MEDALS' },
  { who: 'yes', text: 'the medal is honoured, sir', by: 1 },
  { who: 'leader', text: 'the clapping is now called “listening”.', cap: 'CLAPPING IS LISTENING', head: 'APPLAUSE REBRANDED AS LISTENING' },
  { who: 'yes', text: 'we’re listening so hard, sir', by: 3 },
  { who: 'leader', text: 'the chair that leaves is a traitor. the chair.', cap: 'THE CHAIR IS A TRAITOR', head: 'CHAIR CHARGED WITH TREASON' },
  { who: 'yes', text: 'the chair’s been arrested, sir', by: 5 },
];
/** After the walk-out the round keeps pumping: what the room says, keyed to how far past the exit it is. */
export const REGRET: [number, Who, string, string?][] = [
  [1.5, 'yes', 'his chair is still warm, sir', 'WALKOUT’S CHAIR "STILL WARM", MINISTERS CONFIRM'],
  [2, 'leader', 'the walker-out is now a former person.', 'WALKOUT RECLASSIFIED AS FORMER PERSON'],
  [3, 'leader', 'rename the door after him. as a warning.', 'DOOR RENAMED AFTER TRAITOR, AS A WARNING'],
  [10, 'leader', 'a statue of the empty chair. as a warning.', 'STATUE OF EMPTY CHAIR UNVEILED, AS A WARNING'],
];

export interface Bubble { who: Who; text: string; age: number; life: number; pop: Spring; by: number; thought: boolean }
export type BitKind = 'paper' | 'medal' | 'glass' | 'ribbon';
export interface Bit { x: number; y: number; vx: number; vy: number; rot: number; vr: number; r: number; kind: BitKind; color: string; floor: number; rest: boolean; hits: number }
interface Queued { at: number; who: Who; text: string; head?: string; cap?: string }

export interface RoomDrive {
  running: boolean;
  multiplier: number;
  tension: number;
  time: number;
  reduced: boolean;
  /** The player has walked out: their thoughts stop, the agenda goes on without them. */
  left: boolean;
}

export interface Room {
  bubbles: Bubble[];
  nextLine: number;
  secondsClock: number;
  secondsLine: number;
  chorus: number;
  /** Lines scheduled to follow an event (the walk-out, the crash), by the queue's own clock. */
  queue: Queued[];
  queueT: number;
  /** What STATE TV has run so far, newest last, and how far the chyron has scrolled. */
  headlines: string[];
  tickerX: number;
  /** Decrees stamped and medals awarded: one of each per captioned decree. */
  decrees: number;
  medals: number;
  caption: string;
  /** The glass over the button, the room's red light, the banner down the wall and the door's swing. */
  cover: Spring;
  red: Spring;
  banner: Spring;
  door: Spring;
  /** Where the scene wants the door this frame: 0 shut, 1 open. */
  doorOpen: number;
  /** The portrait's growth, the DAYS WITHOUT ELECTIONS count and the clock's flip to YEAR 1. */
  portrait: Spring;
  days: number;
  yearOne: Spring;
  bits: Bit[];
  crashed: boolean;
  harmless: boolean;
  crashT: number;
  flash: number;
  /** The photo: 0 live, 1 developed, and how much of the red circle has been drawn. */
  photo: number;
  circle: number;
  slammed: boolean;
  events: { line: Line | null; decree: boolean; headline: boolean; cover: boolean; slam: boolean; photo: boolean; landed: number; drop: boolean; yearOne: boolean };
}

function noEvents(): Room['events'] {
  return { line: null, decree: false, headline: false, cover: false, slam: false, photo: false, landed: 0, drop: false, yearOne: false };
}

function fresh(): Room {
  return {
    bubbles: [], nextLine: 0, secondsClock: 0, secondsLine: 0, chorus: 0, queue: [], queueT: 0,
    headlines: ['APPROVAL RATING HOLDS AT 99.9%, MARGIN OF ERROR: GULAG', 'NOTHING EVER HAPPENS, SAYS MINISTRY OF HAPPENINGS', 'WEATHER: GLORIOUS BY DECREE'],
    tickerX: 0, decrees: 0, medals: 0, caption: '',
    cover: spring(0), red: spring(0), banner: spring(0), door: spring(0), doorOpen: 0, portrait: spring(0), days: 4381, yearOne: spring(0),
    bits: [], crashed: false, harmless: false, crashT: 0, flash: 0, photo: 0, circle: 0, slammed: false, events: noEvents(),
  };
}

export const createRoom = (): Room => fresh();
export function resetRoom(r: Room): void {
  Object.assign(r, fresh());
}

/** The slow, log-paced driver for long rounds: 0 at 1×, a third at 10×, all the way at 1000×. */
export const depth = (multiplier: number): number => clamp(Math.log10(Math.max(1, multiplier)) / 3, 0, 1);
const coverFor = (tension: number, multiplier: number): number => clamp(smoothstep(0.42, 0.92, tension) + 0.3 * depth(multiplier), 0, 1);
const portraitFor = (tension: number, multiplier: number): number => clamp(smoothstep(0.1, 0.9, tension) * 0.7 + 0.5 * depth(multiplier), 0, 1);

function say(r: Room, who: Who, text: string, by = 0, thought = false, life = who === 'leader' ? 5 : 3.4): void {
  for (const b of r.bubbles) if (b.who === who && (who !== 'yes' || b.by === by) && b.age < b.life) b.life = Math.min(b.life, b.age + 0.12);
  r.bubbles.push({ who, text, age: 0, life, pop: spring(0.6), by, thought });
  if (r.bubbles.length > 7) r.bubbles.splice(0, r.bubbles.length - 7);
}

/** What a line does beyond its bubble: a captioned decree is stamped and medalled, a headline hits the chyron. */
function heard(r: Room, line: Line): void {
  r.events.line = line;
  if (line.cap) {
    r.caption = line.cap;
    if (line.who === 'leader') {
      r.decrees += 1;
      r.medals += 1;
      r.events.decree = true;
      if (r.medals > 18) r.events.drop = true;
    }
  }
  if (line.head) headline(r, line.head);
}

function headline(r: Room, text: string): void {
  r.headlines.push(text);
  if (r.headlines.length > 9) r.headlines.shift();
  r.events.headline = true;
}

/** A line outside the agenda (the regret after a walk-out), spoken now. */
export function aside(r: Room, who: Who, text: string, head?: string): void {
  say(r, who, text, r.chorus++ % 6);
  r.events.line = { at: 0, who, text };
  if (head) headline(r, head);
}

function schedule(r: Room, lines: Queued[]): void {
  r.queue = lines;
  r.queueT = 0;
}

/** The chyron's text, in the order it scrolls. */
export const tickerText = (r: Room): string => r.headlines.map((h) => `${h}   ●   `).join('');

/**
 * The player stands up and says it: the moment the cash-out is accepted. The room gasps, the Leader notes the
 * name, and a loyalist is in the chair before it cools.
 */
export function walkOut(r: Room): void {
  say(r, 'you', 'That’s going too far.', 0, false, 2.4);
  r.events.line = { at: 0, who: 'you', text: 'That’s going too far.' };
  schedule(r, [
    { at: 1.1, who: 'leader', text: 'note the name.' },
    { at: 1.9, who: 'yes', text: 'noted, sir. in pen' },
    { at: 3.4, who: 'new', text: 'is this seat taken? it isn’t. it’s mine, sir', head: 'SEAT FILLED IN 3 SECONDS, 40,000 APPLICANTS' },
  ]);
}

/**
 * The crash. Hard, the Leader slams the button and takes the system: the red lights, the banner, the papers and
 * medals in the air, the camera flash. Harmless (the player walked out), the same slam, with the chair empty and
 * a loyalist in the photo. `quiet` is a crash met late, shown settled.
 */
export function crashRoom(r: Room, crashX100: number, quiet: boolean, harmless: boolean): void {
  if (r.crashed) return;
  const unsaid = r.nextLine === 0;
  r.crashed = true;
  r.harmless = harmless;
  r.slammed = true;
  r.events.slam = true;
  const rand = mulberry32(crashX100 * 7 + 11);
  throwPapers(r, rand);
  schedule(r, [
    ...(unsaid ? [{ at: 0, who: 'leader' as const, text: 'skip the agenda.' }] : []),
    { at: 0.6, who: 'leader', text: 'I’ll take it from here. all of it.', head: harmless ? 'LEADER SEIZES EVERYTHING, WALKOUT UNAVAILABLE FOR COMMENT' : 'LEADER SEIZES EVERYTHING, ROOM APPLAUDS' },
    { at: 1.6, who: 'yes', text: harmless ? 'take us too, sir. and the empty chair' : 'take us too, sir' },
    { at: 2.6, who: 'leader', text: harmless ? 'and the empty chair? arrest it.' : 'nobody move. this is the photo.' },
    { at: 3.8, who: 'yes', text: 'smiling, sir' },
  ]);
  if (!quiet) r.flash = 1;
  if (quiet) {
    r.crashT = 6;
    for (const q of r.queue) {
      say(r, q.who, q.text, r.chorus++ % 6);
      if (q.head) r.headlines.push(q.head);
    }
    r.queue = [];
    for (const b of r.bubbles) b.age = 1;
    r.bubbles = r.bubbles.filter((b) => b.life > b.age + 0.2);
    settleSpring(r.red, 1);
    settleSpring(r.banner, 1);
    settleSpring(r.cover, 1);
    r.photo = 1;
    r.circle = 1;
    for (let i = 0; i < 360; i += 1) stepBits(r, 1 / 60);
    r.events = noEvents();
  }
}

/** Every stamped decree and the loose medals go up: paper in a seeded fan, medals and ribbon off his chest. */
function throwPapers(r: Room, rand: () => number): void {
  const throwBit = (bit: Omit<Bit, 'x' | 'y' | 'vx' | 'vy' | 'rot' | 'vr' | 'floor' | 'rest' | 'hits'>, x: number, y: number, power: number, spread: number) => {
    const a = -Math.PI / 2 + (rand() - 0.5) * spread;
    const s = power * (0.5 + rand());
    const onTable = rand() > 0.45;
    const floor = onTable ? mix(TABLE.far + 10, TABLE.near - 10, rand()) : 500 + rand() * 30;
    r.bits.push({ ...bit, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rand() * Math.PI * 2, vr: (rand() - 0.5) * 10, floor, rest: false, hits: 0 });
  };
  const papers = 6 + Math.min(14, r.decrees);
  for (let i = 0; i < papers; i += 1) throwBit({ r: 9 + rand() * 7, kind: 'paper', color: rand() > 0.3 ? '#f4efe1' : '#e9d9a8' }, DECREES.x + (rand() - 0.5) * 50, DECREES.y - 10, 380, 2.2);
  const medals = 2 + Math.min(12, r.medals);
  for (let i = 0; i < medals; i += 1) throwBit({ r: 5 + rand() * 3, kind: 'medal', color: rand() > 0.5 ? '#f1c85a' : '#d9d9e2' }, LEADER.x + (rand() - 0.5) * 70, LEADER.y + 20 + rand() * 30, 300, 2.6);
  for (let i = 0; i < 2 + Math.min(4, r.medals); i += 1) throwBit({ r: 8, kind: 'ribbon', color: rand() > 0.5 ? '#d8364a' : '#2f6fd6' }, LEADER.x + (rand() - 0.5) * 60, LEADER.y + 24, 240, 2.4);
  for (let i = 0; i < 8; i += 1) throwBit({ r: 3 + rand() * 3, kind: 'glass', color: 'rgba(200, 235, 255, 0.85)' }, BUTTON.x + (rand() - 0.5) * 30, BUTTON.y - 14, 260, 2.4);
}

/** A medal with no room left on his chest comes off and bounces on the table. */
export function dropMedal(r: Room, seed: number): void {
  const rand = mulberry32(seed * 13 + 5);
  r.bits.push({ x: LEADER.x + 10 + rand() * 40, y: LEADER.y + 30, vx: (rand() - 0.5) * 80, vy: -60 - rand() * 60, rot: 0, vr: (rand() - 0.5) * 8, r: 5 + rand() * 2, kind: 'medal', color: rand() > 0.5 ? '#f1c85a' : '#d9d9e2', floor: TABLE.far + 14 + rand() * 30, rest: false, hits: 0 });
  if (r.bits.length > 90) r.bits.splice(0, r.bits.length - 90);
}

function stepBits(r: Room, dt: number): void {
  for (const b of r.bits) {
    if (b.rest) continue;
    const drag = b.kind === 'paper' ? Math.exp(-1.6 * dt) : 1;
    // The exact constant-gravity step, so a piece lands in the same place at any frame rate.
    const g = b.kind === 'paper' ? 380 : 1100;
    b.x += b.vx * dt;
    b.y += (b.vy + g * dt / 2) * dt;
    b.vy = b.vy * drag + g * dt;
    b.vx *= drag;
    b.rot += b.vr * dt;
    if (b.y >= b.floor && b.vy > 0) {
      b.y = b.floor;
      if (b.vy > 120 && b.kind !== 'paper') {
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

export function stepRoom(r: Room, drive: RoomDrive, dt: number): void {
  r.events = noEvents();
  if (r.crashed) r.crashT += dt;
  const live = drive.running && !r.crashed;

  while (live && r.nextLine < LINES.length && drive.multiplier >= LINES[r.nextLine]!.at) {
    const line = LINES[r.nextLine]!;
    r.nextLine += 1;
    if (line.who === 'you' && drive.left) continue;
    say(r, line.who, line.text, line.by ?? r.chorus++ % 6, line.thought === true);
    heard(r, line);
  }
  if (live && r.nextLine === LINES.length) {
    r.secondsClock += dt;
    if (r.secondsClock >= 6) {
      r.secondsClock %= 6;
      const line = { at: drive.multiplier, ...SECONDS[r.secondsLine++ % SECONDS.length]! };
      if (!(line.who === 'you' && drive.left)) {
        say(r, line.who, line.text, line.by ?? r.chorus++ % 6, line.thought === true);
        heard(r, line);
      }
    }
  }
  r.queueT += dt;
  while (r.queue.length && r.queueT >= r.queue[0]!.at) {
    const q = r.queue.shift()!;
    say(r, q.who, q.text, r.chorus++ % 6);
    r.events.line = { at: 0, who: q.who, text: q.text };
    if (q.head) headline(r, q.head);
    if (q.cap) r.caption = q.cap;
  }
  for (const b of r.bubbles) {
    b.age += dt;
    stepSpring(b.pop, 1, 18, 0.5, dt);
  }
  r.bubbles = r.bubbles.filter((b) => b.age < b.life + 0.3);

  // The chyron never stops; the counter on the wall runs away with the round.
  r.tickerX += dt * 84;
  if (live) r.days = 4381 + Math.floor(depth(drive.multiplier) * 420_000);
  const coverTo = r.crashed ? 1 : live ? coverFor(drive.tension, drive.multiplier) : 0;
  const wasCovered = r.cover.x < 0.3;
  stepSpring(r.cover, coverTo, 3, 0.8, dt);
  if (wasCovered && r.cover.x >= 0.3 && !r.crashed) r.events.cover = true;
  stepSpring(r.portrait, r.crashed ? 1.1 : live ? portraitFor(drive.tension, drive.multiplier) : 0, 2.2, 0.9, dt);
  stepSpring(r.red, r.crashed ? 1 : 0, 6, 0.7, dt);
  stepSpring(r.banner, r.crashed ? 1 : 0, 2.6, 0.75, dt);
  stepSpring(r.door, r.doorOpen, 9, 0.75, dt);
  const yearOne = live && drive.multiplier >= 11 ? 1 : r.yearOne.x > 0.5 ? 1 : 0;
  if (yearOne === 1 && r.yearOne.x < 0.5 && r.yearOne.v === 0) r.events.yearOne = true;
  stepSpring(r.yearOne, yearOne, 8, 0.6, dt);
  if (r.crashed) {
    // The camera: a flash at 1.2 s, then the picture develops and the circle draws itself around the seat.
    if (r.crashT >= 1.2 && r.photo === 0) {
      r.events.photo = true;
      r.flash = Math.max(r.flash, 0.9);
      r.photo = 0.001;
    }
    if (r.photo > 0) r.photo = Math.min(1, r.photo + dt / 0.5);
    if (r.photo >= 1) r.circle = Math.min(1, r.circle + dt / 0.7);
  }
  stepBits(r, dt);
}

/**
 * Settles a fresh room into a round already under way at `multiplier`, for a scene that missed the start: the
 * decrees stamped and medals awarded, the headlines that ran, the caption, the glass as far up as the round has
 * it, the last things said still up.
 */
export function settleRoom(r: Room, multiplier: number, tension: number, left: boolean): void {
  while (r.nextLine < LINES.length && multiplier >= LINES[r.nextLine]!.at) {
    const line = LINES[r.nextLine]!;
    r.nextLine += 1;
    if (line.cap) {
      r.caption = line.cap;
      if (line.who === 'leader') {
        r.decrees += 1;
        r.medals += 1;
      }
    }
    if (line.head) {
      r.headlines.push(line.head);
      if (r.headlines.length > 9) r.headlines.shift();
    }
  }
  const recent = LINES.slice(0, r.nextLine).reverse();
  const his = recent.find((l) => l.who === 'leader');
  if (his) say(r, 'leader', his.text);
  const theirs = recent.find((l) => l.who === 'yes');
  if (theirs && recent.indexOf(theirs) < 2) say(r, 'yes', theirs.text, theirs.by ?? 0);
  for (const b of r.bubbles) b.age = 1;
  r.days = 4381 + Math.floor(depth(multiplier) * 420_000);
  settleSpring(r.cover, coverFor(tension, multiplier));
  settleSpring(r.portrait, portraitFor(tension, multiplier));
  settleSpring(r.yearOne, multiplier >= 11 ? 1 : 0);
  if (left) r.headlines.push('SEAT FILLED IN 3 SECONDS, 40,000 APPLICANTS');
}

// ---- Drawing --------------------------------------------------------------------------------------------

const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
};

function drawFlag(ctx: CanvasRenderingContext2D, x: number, time: number, reduced: boolean): void {
  ctx.save();
  ink(ctx, 3);
  ctx.strokeStyle = '#b9933a';
  ctx.beginPath();
  ctx.moveTo(x, 44);
  ctx.lineTo(x, 300);
  ctx.stroke();
  ctx.fillStyle = '#e0b64a';
  ctx.beginPath();
  ctx.arc(x, 40, 6, 0, Math.PI * 2);
  ctx.fill();
  // The cloth hangs from the pole and breathes a little in the vent's draught.
  const sway = reduced ? 0 : Math.sin(time * 1.3 + x) * 3;
  ctx.fillStyle = '#b2232f';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x, 52);
  ctx.lineTo(x + 64 + sway, 60);
  ctx.lineTo(x + 58 + sway, 182);
  ctx.lineTo(x, 190);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f1c85a';
  star(ctx, x + 30 + sway / 2, 104, 17);
  ctx.fill();
  ctx.font = `900 14px ${MEME_FONT}`;
  ctx.fillStyle = '#f7e2a0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YES', x + 30 + sway / 2, 146);
  ctx.restore();
}

/** The walls, the cornice, the portrait that grows behind his chair, the flags, the signs, the door and the floor. */
export function drawRoom(ctx: CanvasRenderingContext2D, r: Room, time: number, reduced: boolean): void {
  const red = clamp(r.red.x, 0, 1);
  // Walls: crimson under a gold cornice, dark wainscot, then the floor and a carpet to the player's chair.
  ctx.fillStyle = red > 0.01 ? `rgb(${Math.round(mix(94, 140, red))}, ${Math.round(mix(28, 18, red))}, ${Math.round(mix(40, 24, red))})` : '#5e1c28';
  ctx.fillRect(0, 0, 960, FLOOR_Y);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 232, 960, FLOOR_Y - 232);
  ctx.fillStyle = '#c99a3c';
  ctx.fillRect(0, 22, 960, 8);
  ctx.fillRect(0, 230, 960, 4);
  ctx.fillStyle = red > 0.01 ? `rgb(${Math.round(mix(46, 70, red))}, ${Math.round(mix(36, 18, red))}, ${Math.round(mix(40, 22, red))})` : '#2e2428';
  ctx.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);
  // The carpet runs under the table to the player's chair.
  ctx.fillStyle = red > 0.01 ? `rgb(${Math.round(mix(150, 190, red))}, 30, 42)` : '#96202a';
  ctx.beginPath();
  ctx.moveTo(300, FLOOR_Y);
  ctx.lineTo(660, FLOOR_Y);
  ctx.lineTo(860, 540);
  ctx.lineTo(100, 540);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c99a3c';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawFlag(ctx, 128, time, reduced);
  drawFlag(ctx, 770, time, reduced);

  // The portrait: a gold frame around his face, which grows behind his chair as the room agrees.
  const grow = clamp(r.portrait.x, 0, 1.1);
  const pw = mix(150, 290, grow);
  const ph = mix(118, 206, grow);
  ctx.save();
  ctx.translate(LEADER.x, 112);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-pw / 2 + 8, -ph / 2 + 10, pw, ph);
  box(ctx, -pw / 2, -ph / 2, pw, ph, 6, '#c99a3c', 3);
  box(ctx, -pw / 2 + 12, -ph / 2 + 12, pw - 24, ph - 24, 3, '#3a2634', 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-pw / 2 + 13, -ph / 2 + 13, pw - 26, ph - 26);
  ctx.clip();
  drawLeaderFace(ctx, 0, 8 + 10 * grow, mix(0.6, 1.05, grow), { mouth: 0, glint: 0.4 + 0.6 * grow, grin: grow, speaking: false });
  ctx.restore();
  ctx.font = `900 ${Math.round(mix(11, 18, grow))}px ${MEME_FONT}`;
  ctx.fillStyle = '#f7e2a0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(grow > 0.6 ? 'DEAR LEADER (FOREVER)' : 'DEAR LEADER', 0, -ph / 2 + 17);
  ctx.restore();

  // DAYS WITHOUT ELECTIONS, on the left wall, counting away with the round.
  box(ctx, 18, 150, 150, 58, 6, '#f4efe1', 2.5);
  ctx.fillStyle = INK;
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DAYS WITHOUT ELECTIONS', 93, 164);
  ctx.font = `900 24px ${MEME_FONT}`;
  ctx.fillStyle = '#b2232f';
  ctx.fillText(r.days.toLocaleString('en-US'), 93, 188);

  // The clock, which flips to YEAR 1 when the past is deleted.
  ctx.save();
  ctx.translate(660, 76);
  const flip = clamp(r.yearOne.x, 0, 1);
  ctx.scale(1, Math.max(0.05, Math.abs(1 - 2 * flip)));
  if (flip < 0.5) {
    ctx.fillStyle = '#f4efe1';
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const minute = (time / 6) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(minute) * 15, -Math.cos(minute) * 15);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(minute / 12 + 2) * 10, -Math.cos(minute / 12 + 2) * 10);
    ctx.stroke();
  } else {
    box(ctx, -34, -22, 68, 44, 5, '#b2232f', 2.5);
    ctx.fillStyle = '#f7e2a0';
    ctx.font = `900 18px ${MEME_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YEAR 1', 0, 1);
  }
  ctx.restore();

  // The door out, with its EXIT sign, swung by the spring as people come and go.
  const open = clamp(r.door.x, 0, 1);
  ctx.save();
  ctx.fillStyle = '#1a1014';
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  ink(ctx, 3);
  ctx.strokeStyle = '#c99a3c';
  ctx.strokeRect(DOOR.x - 4, DOOR.y - 4, DOOR.w + 8, DOOR.h + 4);
  // The leaf swings in toward the room on its left hinge; foreshortened as it opens.
  ctx.translate(DOOR.x, DOOR.y);
  ctx.transform(1 - 0.78 * open, 0.24 * open, 0, 1, 0, 0);
  box(ctx, 0, 0, DOOR.w, DOOR.h, 2, '#6b3b2a', 2.5);
  ctx.fillStyle = '#8d5436';
  ctx.fillRect(10, 14, DOOR.w - 20, 70);
  ctx.fillRect(10, 100, DOOR.w - 20, 84);
  ctx.fillStyle = '#e0b64a';
  ctx.beginPath();
  ctx.arc(DOOR.w - 14, DOOR.h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  box(ctx, DOOR.x + 8, DOOR.y - 36, DOOR.w - 16, 24, 4, '#1f7a3f', 2.5);
  ctx.font = `900 15px ${MEME_FONT}`;
  ctx.fillStyle = '#d9ffe4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', DOOR.x + DOOR.w / 2, DOOR.y - 23);

  // The banner comes down the wall at the crash: his face, floor to ceiling.
  const down = clamp(r.banner.x, 0, 1);
  if (down > 0.005) {
    const h = 20 + down * 300;
    ctx.save();
    ctx.translate(480, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-194, 8, 380, h);
    box(ctx, -190, 0, 380, h, 4, '#b2232f', 3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-186, 4, 372, h - 8);
    ctx.clip();
    drawLeaderFace(ctx, 0, 160, 1.9, { mouth: 0, glint: 1, grin: 1, speaking: false });
    ctx.restore();
    ctx.fillStyle = '#f7e2a0';
    ctx.font = `900 30px ${MEME_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (h > 290) ctx.fillText('ALL SYSTEMS: HIS', 0, h - 26);
    ctx.restore();
  }
}

/** The table, the name cards, the stamped decrees at his right hand and the TOTAL CONTROL button under glass. */
export function drawTable(ctx: CanvasRenderingContext2D, r: Room, time: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(TABLE.farLeft - 6, TABLE.far + 24);
  ctx.lineTo(TABLE.farRight + 6, TABLE.far + 24);
  ctx.lineTo(TABLE.nearRight + 10, TABLE.near + 30);
  ctx.lineTo(TABLE.nearLeft - 10, TABLE.near + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a3324';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(TABLE.farLeft, TABLE.far);
  ctx.lineTo(TABLE.farRight, TABLE.far);
  ctx.lineTo(TABLE.nearRight, TABLE.near);
  ctx.lineTo(TABLE.nearLeft, TABLE.near);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The runner down the middle and the sheen.
  ctx.fillStyle = '#7d2730';
  ctx.beginPath();
  ctx.moveTo(452, TABLE.far + 2);
  ctx.lineTo(508, TABLE.far + 2);
  ctx.lineTo(560, TABLE.near - 2);
  ctx.lineTo(400, TABLE.near - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.moveTo(TABLE.farLeft + 10, TABLE.far + 6);
  ctx.lineTo(TABLE.farRight - 10, TABLE.far + 6);
  ctx.lineTo(TABLE.farRight + 40, TABLE.far + 60);
  ctx.lineTo(TABLE.farLeft - 40, TABLE.far + 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3f2218';
  ctx.beginPath();
  ctx.moveTo(TABLE.nearLeft, TABLE.near);
  ctx.lineTo(TABLE.nearRight, TABLE.near);
  ctx.lineTo(TABLE.nearRight, TABLE.near + 14);
  ctx.lineTo(TABLE.nearLeft, TABLE.near + 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Name cards, one in front of each minister, folded toward the room.
  for (const [i, seat] of SEATS.entries()) {
    const edge = seat.side === 1 ? seat.x + 48 * seat.s : seat.x - 48 * seat.s;
    const cx = seat.side === 1 ? edge + 22 * seat.s : edge - 22 * seat.s;
    const cy = seat.y - 2;
    const w = 54 * seat.s;
    box(ctx, cx - w / 2, cy - 7 * seat.s, w, 14 * seat.s, 2, '#f4efe1', 1.5);
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(6.5 * seat.s + 1)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TITLES[i]!.toUpperCase(), cx, cy, w - 4);
  }

  // The decrees pile at his right hand; each is stamped red.
  const pile = Math.min(12, r.decrees);
  for (let i = 0; i < pile; i += 1) {
    const dx = DECREES.x + noise(i * 3.1) * 6 - 3;
    const dy = DECREES.y - i * 1.6;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate((noise(i * 7.7) - 0.5) * 0.3);
    box(ctx, -16, -11, 32, 22, 2, '#f4efe1', 1.5);
    ctx.fillStyle = 'rgba(178,35,47,0.85)';
    ctx.beginPath();
    ctx.arc(6, 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-11, -5);
    ctx.lineTo(4, -5);
    ctx.moveTo(-11, 0);
    ctx.lineTo(-2, 0);
    ctx.stroke();
    ctx.restore();
  }
  if (r.decrees > 0) {
    ctx.font = `900 11px ${MEME_FONT}`;
    ctx.fillStyle = '#f7e2a0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${r.decrees} SIGNED`, DECREES.x, DECREES.y + 22);
  }

  // The TOTAL CONTROL button on its plinth; the glass lifts on its hinge as the room agrees.
  const open = clamp(r.cover.x, 0, 1);
  const pressed = r.slammed ? 1 : 0;
  ctx.save();
  ctx.translate(BUTTON.x, BUTTON.y);
  box(ctx, -34, -8, 68, 22, 5, '#2a2a30', 2.5);
  ctx.fillStyle = '#c99a3c';
  ctx.fillRect(-28, 6, 56, 3);
  ctx.font = '900 7px system-ui, sans-serif';
  ctx.fillStyle = '#f7e2a0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TOTAL CONTROL', 0, 0);
  ctx.fillStyle = '#7a1420';
  ctx.beginPath();
  ctx.ellipse(0, -8, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pressed ? '#9b1f2e' : '#e0323f';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(0, -8 - (pressed ? 2 : 8), 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-6, -14 - (pressed ? 2 : 6), 7, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  if (!r.slammed || open < 1) {
    // The dome, hinged at the back, swings up and away from the room.
    const a = open * 1.9;
    ctx.save();
    ctx.translate(0, -8);
    ctx.scale(1, Math.max(0.12, Math.cos(a) + 0.2 * Math.sin(a)));
    ctx.translate(0, -Math.sin(a) * 14);
    ctx.fillStyle = 'rgba(190, 230, 255, 0.35)';
    ctx.strokeStyle = 'rgba(230, 245, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -2, 26, 22, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(26, 2);
    ctx.lineTo(-26, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-8, -8, 9, 6, -0.6, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();
  }
  // A warning light that blinks faster as the glass goes up.
  if (open > 0.3 && !r.slammed) {
    const rate = 2 + 10 * open;
    if (Math.sin(time * rate) > 0) {
      ctx.fillStyle = '#ffd36b';
      ctx.beginPath();
      ctx.arc(28, -12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();
}

/** Where each speaker's bubble sits and where its tail points. */
function bubbleAt(b: Bubble): { x: number; y: number; tail: { x: number; y: number }; width: number } {
  if (b.who === 'leader') return { x: 672, y: 170, tail: { x: 512, y: 236 }, width: 250 };
  if (b.who === 'you' || b.who === 'new') return { x: 262, y: 392, tail: { x: 440, y: 420 }, width: 260 };
  if (b.who === 'guard') return { x: 150, y: 290, tail: { x: 250, y: 345 }, width: 180 };
  const seat = SEATS[b.by % SEATS.length]!;
  const head = { x: seat.x, y: seat.y - 78 * seat.s };
  const out = seat.side === 1 ? -1 : 1;
  return { x: clamp(head.x + out * 84, 120, 840), y: head.y - 50, tail: head, width: 210 };
}

export function drawBubbles(ctx: CanvasRenderingContext2D, r: Room): void {
  for (const b of r.bubbles) {
    const at = bubbleAt(b);
    const fade = b.age > b.life ? 1 - (b.age - b.life) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    ctx.translate(at.x, at.y);
    const s = clamp(b.pop.x, 0, 1.2);
    ctx.scale(s, s);
    ctx.font = b.who === 'leader' ? '700 18px "Trebuchet MS", "Segoe UI", system-ui, sans-serif' : b.thought ? 'italic 600 16px "Trebuchet MS", "Segoe UI", system-ui, sans-serif' : BUBBLE_FONT;
    const lines = wrap(ctx, b.text, at.width - 28);
    const w = Math.min(at.width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
    const h = lines.length * 21 + 16 + (b.who === 'yes' ? 12 : 0);
    ctx.fillStyle = b.who === 'leader' ? '#fff3d6' : b.thought ? '#e8eef9' : b.who === 'you' ? '#ffffff' : b.who === 'new' ? '#fde3c5' : '#f4efe1';
    ink(ctx, 2.5);
    const tx = at.tail.x - at.x;
    const ty = at.tail.y - at.y;
    if (b.thought) {
      // A thought: a cloud, and a trail of little circles to the head.
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 18);
      ctx.fill();
      ctx.stroke();
      for (const [k, rr] of [[0.35, 6], [0.62, 4], [0.84, 2.5]] as const) {
        ctx.beginPath();
        ctx.arc(tx * k, ty * k, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 12);
      ctx.fill();
      ctx.stroke();
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
    }
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 18 + i * 21));
    if (b.who === 'yes') {
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.fillStyle = '#7a4a1f';
      ctx.fillText(`— ${TITLES[b.by % TITLES.length]!.toUpperCase()}`, 0, h / 2 - 9, w - 12);
    }
    ctx.restore();
  }
}

/** What is in the air after the slam: papers planing down, medals and ribbon bouncing, the glass. */
export function drawAir(ctx: CanvasRenderingContext2D, r: Room): void {
  for (const b of r.bits) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.fillStyle = b.color;
    if (b.kind === 'paper') {
      ink(ctx, 1.2);
      ctx.beginPath();
      ctx.rect(-b.r, -b.r * 0.7, b.r * 2, b.r * 1.4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(178,35,47,0.8)';
      ctx.beginPath();
      ctx.arc(b.r * 0.4, 0, b.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'medal') {
      ink(ctx, 1.2);
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      star(ctx, 0, 0, b.r * 0.6);
      ctx.fill();
    } else if (b.kind === 'ribbon') {
      ctx.fillRect(-b.r, -2, b.r * 2, 4);
    } else {
      ctx.beginPath();
      ctx.moveTo(-b.r, 0);
      ctx.lineTo(0, -b.r);
      ctx.lineTo(b.r, 0);
      ctx.lineTo(0, b.r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/** The STATE TV chyron along the foot of the picture. */
export function drawTicker(ctx: CanvasRenderingContext2D, r: Room, seized: boolean): void {
  ctx.save();
  ctx.fillStyle = seized ? '#2a0a10' : '#140a0e';
  ctx.fillRect(0, 508, 960, 32);
  ctx.fillStyle = '#c99a3c';
  ctx.fillRect(0, 506, 960, 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(118, 508, 842, 32);
  ctx.clip();
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = seized ? '#ffb3b3' : '#f3e9d6';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const text = seized ? 'STATE TV IS NOW THE ONLY TV   ●   ALL SYSTEMS: HIS   ●   APPROVAL: 100%, FOREVER   ●   THE PHOTO HAS BEEN TAKEN   ●   ' : tickerText(r);
  const w = Math.max(1, ctx.measureText(text).width);
  const period = w + 400;
  const x = 960 - (r.tickerX % period);
  ctx.fillText(text, x, 525);
  if (x + w < 960) ctx.fillText(text, x + period, 525);
  ctx.restore();
  box(ctx, 8, 511, 104, 26, 4, seized ? '#9b1f2e' : '#b2232f', 2);
  ctx.font = `900 15px ${MEME_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(seized ? 'HIS TV' : 'STATE TV', 60, 525);
  ctx.restore();
}

export function drawFlash(ctx: CanvasRenderingContext2D, r: Room): void {
  if (r.flash <= 0) return;
  ctx.fillStyle = `rgba(255, 250, 235, ${clamp(r.flash, 0, 1)})`;
  ctx.fillRect(0, 0, 960, 540);
}

/**
 * The photo: the room goes sepia under a vignette and a white border, a red marker circle draws itself around
 * `at` with its label, and a plaque dates the picture. Drawn over the scene, under the HUD.
 */
export function drawPhoto(ctx: CanvasRenderingContext2D, r: Room, at: { x: number; y: number; rx: number; ry: number }, label: string): void {
  const develop = clamp(r.photo, 0, 1);
  if (develop <= 0) return;
  ctx.save();
  ctx.globalAlpha = develop;
  ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = '#8a6a3a';
  ctx.fillRect(0, 0, 960, 540);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(230, 200, 150, 0.9)';
  ctx.fillRect(0, 0, 960, 540);
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(480, 270, 180, 480, 270, 620);
  v.addColorStop(0, 'rgba(60, 30, 10, 0)');
  v.addColorStop(1, 'rgba(60, 30, 10, 0.75)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 960, 540);
  ctx.strokeStyle = '#f6efe0';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 942, 522);
  // The circle: hand-drawn, a little loose, drawn in over 0.7 s.
  const drawn = clamp(r.circle, 0, 1);
  if (drawn > 0) {
    ctx.strokeStyle = '#ff2d4a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const steps = Math.floor(44 * drawn);
    for (let i = 0; i <= steps; i += 1) {
      const a = -Math.PI * 0.6 + (i / 40) * Math.PI * 2.1;
      const wob = 1 + 0.06 * Math.sin(i * 1.7);
      const x = at.x + Math.cos(a) * at.rx * wob;
      const y = at.y + Math.sin(a) * at.ry * wob;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (drawn >= 1) {
      ctx.save();
      ctx.translate(at.x + at.rx + 18, at.y - at.ry - 6);
      ctx.rotate(-0.12);
      ctx.font = '900 30px "Comic Sans MS", "Segoe Print", "Chalkboard SE", cursive, sans-serif';
      ctx.fillStyle = '#ff2d4a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
      ctx.strokeStyle = '#ff2d4a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(at.x + at.rx + 16, at.y - at.ry + 4);
      ctx.lineTo(at.x + at.rx * 0.75, at.y - at.ry * 0.6);
      ctx.stroke();
    }
  }
  box(ctx, 606, 444, 334, 28, 3, '#f6efe0', 2);
  ctx.font = 'italic 600 14px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#3b2a18';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('The Room, Year One. Everyone agreed. (colourised)', 773, 458, 318);
  ctx.restore();
}

/** The red light at the crash, over everything in the room, under the photo. */
export function drawRedLight(ctx: CanvasRenderingContext2D, r: Room, time: number, reduced: boolean): void {
  const red = clamp(r.red.x, 0, 1);
  if (red <= 0.01) return;
  const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 9);
  ctx.fillStyle = `rgba(190, 20, 40, ${0.22 * red * pulse})`;
  ctx.fillRect(0, 0, 960, 540);
}

/** Where the photo's circle goes: around the player's seat (or the loyalist in it). */
export const PHOTO_CIRCLE = { x: YOU.x, y: 442, rx: 88, ry: 64 } as const;
