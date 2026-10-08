/**
 * The words: the ladder keyed to the displayed multiplier, the extras, the HQ radio, the bounded overtime loop, the
 * escape and aftermath sets, the HUD tables, the bubble queue and the meme lettering. Nothing reads the outcome.
 */
import { clamp, type Spring, settleSpring, spring, stepSpring } from './motion';

export const INK = '#202432';
/** The HUD lettering: heavy system-ui with a dark outline (see memeText). */
export const MEME_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const BUBBLE_FONT = `700 18px ${MEME_FONT}`;
const HQ_FONT = `700 15px ${MEME_FONT}`;

export type Who = 'suspect' | 'lead' | 'heavy' | 'hq';
/** Rig business: the aside to the lens, the hold-on palm, the open mouth, the flat palm, the look down, the wordless bubble. */
export type LineTag = 'chat' | 'phone' | 'caps' | 'notyet' | 'glance' | 'ellipsis';
export interface Line {
  /** The multiplier it fires at (ladder) or the clock second (timed sets). */
  at: number;
  who: Who;
  text: string;
  /** Seconds after `at` is crossed before the bubble pops. */
  delay?: number;
  tag?: LineTag;
  /** Bubble life; defaults 5.5 / 3.2 / 3.0 s (suspect / militia / HQ). */
  life?: number;
}

/** rung = count of RUNGS at or under the displayed multiplier (0..12); the tables are indexed by rung. */
export const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 30];
export const CAPTIONS = ['ARE YOU ALIGNED', 'BOTH DAYS', 'LOYALTY IS A VESTING SCHEDULE', 'DIVERSIFIED', 'NINE MILITIAS', 'IS THAT MERCH', 'SOLD YOUR COIN AT THE TOP', 'RESPECTFULLY', 'CHAT SAYS NGMI', 'UNDER RISKS', 'LIQUIDATION PRICE: THIS ROOF', 'WHOEVER CATCHES ME', 'UP ONLY (ALLEGEDLY)'];
export const ALIGNMENTS = ['LAWFUL GOOD', 'LAWFUL-ISH', 'TRUE NEUTRAL', 'CHAOTIC NEUTRAL', 'CHAOTIC LONG', 'LEVERAGED NEUTRAL', 'LAWFUL EVIL', 'CHAOTIC EVIL', 'CHAOTIC DEGEN', 'LONG BOTH SIDES', 'SHORT BOTH SIDES', 'ALIGNED WITH THE CHART', 'ALIGNED WITH GRAVITY'];
/** LEDGE metres by rung (0 = on the coping, −0.3 = heels over). */
export const LEDGES = [4, 3.7, 3.4, 3, 2.6, 2.2, 1.8, 1.4, 1, 0.6, 0.2, 0, -0.3];

/** The ladder: the suspect at each rung, the militia reply 0.9 s later. */
export const LINES: Line[] = [
  { at: 1, who: 'lead', text: 'Simple question. Are you aligned with us?' },
  { at: 1.04, who: 'suspect', text: 'aligned? bro, I’m basically a founding member' },
  { at: 1.2, who: 'lead', text: 'You joined on Tuesday.' },
  { at: 1.2, who: 'suspect', text: 'and loyal every day since. both of them', delay: 0.9 },
  { at: 1.5, who: 'suspect', text: 'loyalty is a vesting schedule, chief' },
  { at: 1.5, who: 'lead', text: 'THAT’S NOT AN ANSWER', delay: 0.9, tag: 'caps' },
  { at: 2, who: 'suspect', text: 'I hold a small bag of the other guys. diversification.' },
  { at: 2, who: 'heavy', text: 'throw him.', delay: 0.9 },
  { at: 2, who: 'lead', text: 'not yet.', delay: 1.7, tag: 'notyet' },
  { at: 2.6, who: 'suspect', text: 'I lurk in like nine militias. it’s networking' },
  { at: 2.6, who: 'lead', text: 'nine.', delay: 0.9 },
  { at: 3.4, who: 'suspect', text: 'nice headbands. is that merch? what’s the mint date?' },
  { at: 3.4, who: 'lead', text: 'DO NOT TALK ABOUT THE HEADBANDS', delay: 0.9, tag: 'caps' },
  { at: 4.5, who: 'suspect', text: 'I sold your coin at the top. you’re welcome btw.' },
  { at: 4.5, who: 'heavy', text: 'we have a coin?', delay: 0.9 },
  { at: 6, who: 'suspect', text: 'I’d betray you guys in a heartbeat. respectfully' },
  { at: 6, who: 'lead', text: 'Why would you say that out loud.', delay: 0.9 },
  { at: 8, who: 'suspect', text: 'I’ve been streaming this whole time. chat says you’re ngmi.', tag: 'chat' },
  { at: 8, who: 'lead', text: '...what’s the link', delay: 0.9 },
  { at: 11, who: 'suspect', text: 'you’re both in the whitepaper. under risks' },
  { at: 11, who: 'heavy', text: 'I’m going to throw him.', delay: 0.9 },
  { at: 11, who: 'lead', text: '...not yet.', delay: 2.3, tag: 'notyet' },
  { at: 15, who: 'suspect', text: 'I just shorted you both. 50x. liquidation price: this roof.', tag: 'glance' },
  { at: 15, who: 'lead', text: 'IS THAT A THREAT', delay: 0.9, tag: 'caps' },
  { at: 22, who: 'suspect', text: 'final answer: I’m aligned with whoever catches me.' },
  { at: 22, who: 'lead', text: 'NOBODY IS CATCHING YOU', delay: 0.9, tag: 'caps' },
  { at: 30, who: 'suspect', text: 'gravity is just a bearish narrative. I’m up only.' },
  { at: 30, who: 'heavy', text: '…', delay: 0.9, tag: 'ellipsis' },
];
/** Exchanges between the rungs. */
export const EXTRAS: Line[] = [
  { at: 9.3, who: 'suspect', text: 'hold on, I’m up 4% on something', tag: 'phone' },
  { at: 9.3, who: 'lead', text: 'PUT THE PHONE AWAY', delay: 0.9, tag: 'caps' },
  { at: 13, who: 'suspect', text: 'WAGMI. not you two specifically. in general', tag: 'chat' },
  { at: 18, who: 'suspect', text: 'aligned with my bag. my bag is aligned with gravity' },
  { at: 18, who: 'lead', text: 'Stop saying gravity.', delay: 0.9 },
  { at: 26, who: 'suspect', text: 'my loyalty is a floating-rate instrument' },
  { at: 26, who: 'lead', text: 'what does that mean', delay: 0.9 },
];
/** The belt radio. Only ever "HQ": no cause, region or enemy is named. */
export const HQ_LINES: Line[] = [
  { at: 2, who: 'hq', text: 'HQ: is he aligned yet', delay: 2.6 },
  { at: 6, who: 'hq', text: 'HQ: ask nicely one more time', delay: 2.2 },
  { at: 13, who: 'hq', text: 'HQ: ...is that a livestream', delay: 0.9 },
  { at: 22, who: 'hq', text: 'HQ: we are not hearing alignment', delay: 2.2 },
];
/** Every multiplier-keyed line in firing order. */
const SCRIPT: Line[] = [...LINES, ...EXTRAS, ...HQ_LINES].sort((a, b) => a.at - b.at || (a.delay ?? 0) - (b.delay ?? 0));

/** An overtime exchange: lines at +0 / +0.9 / +1.8 s with its caption and ALIGNMENT label. */
export interface Exchange { lines: Omit<Line, 'at'>[]; caption: string; alignment: string }
/** Past 30x: exchange k = overtimeIndex(x) fires when k increments, cycling mod 10. */
export const OVERTIME: Exchange[] = [
  { lines: [{ who: 'suspect', text: 'are we done? I have a space at 9' }, { who: 'lead', text: 'Why would we be done.' }], caption: 'STILL TALKING', alignment: 'UNDER REVIEW' },
  { lines: [{ who: 'suspect', text: 'if I was misaligned would I still be up here? exactly' }, { who: 'lead', text: 'That is exactly why you’re up here.' }, { who: 'suspect', text: 'oh. oh no. ok that’s actually valid' }], caption: 'THAT’S ACTUALLY VALID', alignment: 'ACTUALLY VALID' },
  { lines: [{ who: 'suspect', text: 'you’re both in my will. 0.1% each. unvested.' }, { who: 'lead', text: 'UNVESTED?', tag: 'caps' }], caption: 'IN THE WILL, UNVESTED', alignment: 'UNVESTED' },
  { lines: [{ who: 'heavy', text: 'throw him.' }, { who: 'lead', text: '...soon.', tag: 'notyet' }, { who: 'suspect', text: 'I heard that' }], caption: 'SOON', alignment: '[REDACTED]' },
  { lines: [{ who: 'suspect', text: 'ngl I thought the headband was a fashion thing' }, { who: 'heavy', text: 'it is not a fashion thing' }], caption: 'NOT A FASHION THING', alignment: 'NOT FASHION' },
  { lines: [{ who: 'suspect', text: 'not scared btw. this is just my resting face' }, { who: 'lead', text: 'YOUR HEELS ARE OVER THE EDGE', tag: 'caps' }], caption: 'RESTING FACE', alignment: 'RESTING FACE' },
  { lines: [{ who: 'suspect', text: 'what if we’re all aligned and the real enemy is HQ' }, { who: 'hq', text: 'HQ: we heard that' }], caption: 'THE REAL ENEMY IS HQ', alignment: 'ASK HQ' },
  { lines: [{ who: 'suspect', text: 'chat is bigger than your whole militia now', tag: 'chat' }, { who: 'heavy', text: 'how much bigger' }], caption: 'CHAT OUTNUMBERS THEM', alignment: 'OUTNUMBERED' },
  { lines: [{ who: 'suspect', text: 'okay but what’s YOUR alignment?' }, { who: 'heavy', text: 'gravity.' }], caption: 'HIS ALIGNMENT: GRAVITY', alignment: 'GRAVITY (SOON)' },
  { lines: [{ who: 'lead', text: 'Same question. Are you aligned with us?' }, { who: 'suspect', text: 'aligned? bro, I’m basically a founding member' }], caption: 'FOUNDING MEMBER (AGAIN)', alignment: 'FOUNDING MEMBER' },
];
/** −1 under 30x, then one exchange per ×1.85; reads the multiplier only. */
export const overtimeIndex = (multiplier: number): number => (multiplier < 30 ? -1 : Math.floor(Math.log(multiplier / 30) / Math.log(1.85)));

/** Timed sets on a scene clock: `at` is seconds on it. */
export type TimedLine = Line;
export type AftermathSet = 'rekt' | 'instant' | 'called' | 'spectator';
/** After the throw (crashAge seconds) or the harmless heave (its own clock). */
export const AFTERMATH: Record<AftermathSet, TimedLine[]> = {
  rekt: [{ at: 4.2, who: 'lead', text: '…not aligned.' }, { at: 5.5, who: 'heavy', text: 'he said the view was good' }],
  instant: [{ at: 4.2, who: 'lead', text: 'I hadn’t finished the question.' }, { at: 5.5, who: 'heavy', text: 'he looked misaligned.' }],
  spectator: [{ at: 4.2, who: 'lead', text: '…not aligned.' }, { at: 5.5, who: 'heavy', text: 'he said the view was good' }, { at: 8.5, who: 'lead', text: 'you, across the street. you saw nothing.' }],
  called: [{ at: 1.6, who: 'lead', text: 'that was mine' }, { at: 3.4, who: 'lead', text: 'he was aligned with the stairs.' }],
};
/** The escape clock: seconds from the accepted cash-out. */
export const ESCAPE: TimedLine[] = [
  { at: 0, who: 'suspect', text: 'AIRDROP!', life: 1.6 },
  { at: 0.95, who: 'suspect', text: 'later, chat', life: 1.6 },
  { at: 2.2, who: 'lead', text: '...it’s worthless.' },
  { at: 3.6, who: 'heavy', text: 'I’m keeping it.' },
];
/** Said by the scene on the rig's throw keyframes. */
export const THROW_LINES = { wait: 'wait wait wait—', sayLess: 'say less', view: 'ok this is actually a great view', instantOpener: 'Simple question. Are you al—' } as const;
/** The LIVE chat: generic, no handles ('pov' is the rig's, once he films the drop). */
export const CHAT = ['W', 'ngmi', 'ratio', 'ask him about the coin', 'is this a cult', 'touch grass', 'L + ratio', 'he’s cooked', 'gm'];

const LIFE: Record<Who, number> = { suspect: 5.5, lead: 3.2, heavy: 3.2, hq: 3 };
const WIDTH: Record<Who, number> = { suspect: 300, lead: 260, heavy: 260, hq: 200 };
/** Fixed bubble centres; the suspect's follows his head. */
const FIXED: Record<Exclude<Who, 'suspect'>, { x: number; y: number }> = { lead: { x: 370, y: 205 }, heavy: { x: 610, y: 150 }, hq: { x: 280, y: 300 } };
/** Fade seconds once a life is spent (0.2 when retired early). */
const FADE = 0.3;

export interface Bubble { who: Who; text: string; age: number; life: number; fade: number; pop: Spring; tag?: LineTag }
interface Pending { line: Line; in: number }
export interface TalkEvents { said: Line[] }
export interface Talk {
  /** Newest last; at most 8 kept, 2 live (age < life). */
  bubbles: Bubble[];
  /** The next unfired SCRIPT index. */
  next: number;
  /** Delayed lines waiting for their offset (scene seconds). */
  pending: Pending[];
  /** The last overtime exchange fired; −1 before 30x. */
  overtimeK: number;
  /** Timed sets consumed by drive.escapeT / drive.aftermathT. */
  escape: TimedLine[];
  aftermath: TimedLine[];
  /** No more ladder or overtime lines: escaped, or the crash has begun. */
  holding: boolean;
  /** A suspect line has been said (false = an instant crash). */
  spoke: boolean;
  last: Line | null;
  events: TalkEvents;
}

const blank = (): Talk => ({ bubbles: [], next: 0, pending: [], overtimeK: -1, escape: [], aftermath: [], holding: false, spoke: false, last: null, events: { said: [] } });
export const createDialogue = (): Talk => blank();
export function resetDialogue(t: Talk): void {
  Object.assign(t, blank());
}

/** Ends a live bubble now; it fades over `over` seconds. */
function retire(b: Bubble, over: number): void {
  if (b.age < b.life) {
    b.life = b.age;
    b.fade = over;
  }
}
/** Pops a bubble: one per speaker, at most two live (the oldest retires over 0.2 s), 8 kept. Does not push to `events`. */
export function say(t: Talk, who: Who, text: string, life = LIFE[who], tag?: LineTag): Line {
  for (const b of t.bubbles) if (b.who === who) retire(b, 0.12);
  const live = t.bubbles.filter((b) => b.age < b.life);
  if (live.length >= 2) retire(live[0]!, 0.2);
  const bubble: Bubble = { who, text, age: 0, life, fade: FADE, pop: spring(0.6) };
  if (tag) bubble.tag = tag;
  t.bubbles.push(bubble);
  while (t.bubbles.length > 8) t.bubbles.shift();
  const line: Line = { at: 0, who, text };
  if (tag) line.tag = tag;
  t.last = line;
  if (who === 'suspect') t.spoke = true;
  return line;
}
/** The grab or a reset. */
export function clearBubbles(t: Talk): void {
  t.bubbles = [];
  t.pending = [];
}
/** Queues the escape set and stops the ladder; every live bubble retires so AIRDROP! pops alone. */
export function beginEscapeLines(t: Talk): void {
  t.escape = ESCAPE.slice();
  t.pending = [];
  t.holding = true;
  for (const b of t.bubbles) retire(b, 0.12);
}
/** Queues an aftermath set and stops the ladder. */
export function beginAftermath(t: Talk, set: AftermathSet): void {
  t.aftermath = AFTERMATH[set].slice();
  t.holding = true;
}

export interface TalkDrive {
  running: boolean;
  multiplier: number;
  /** Clock seconds, −1 while inactive. */
  escapeT: number;
  aftermathT: number;
}

/** Says a line now or parks it on its offset (6 in flight at most). */
function queue(t: Talk, line: Line): void {
  if (!line.delay) {
    const said = say(t, line.who, line.text, line.life ?? LIFE[line.who], line.tag);
    said.at = line.at;
    t.events.said.push(said);
  } else if (t.pending.length < 6) t.pending.push({ line, in: line.delay });
}

/** Advances by `dt` (0 in the hit-stop); fires every line whose threshold the multiplier has reached. */
export function stepDialogue(t: Talk, drive: TalkDrive, dt: number): void {
  t.events = { said: [] };
  if (!t.holding && drive.running) {
    while (t.next < SCRIPT.length && drive.multiplier >= SCRIPT[t.next]!.at) queue(t, SCRIPT[t.next++]!);
    const k = overtimeIndex(drive.multiplier);
    if (k > t.overtimeK) {
      t.overtimeK = k;
      const ex = OVERTIME[k % OVERTIME.length]!;
      ex.lines.forEach((l, i) => queue(t, { ...l, at: drive.multiplier, delay: i * 0.9 }));
    }
  }
  for (const p of t.pending) p.in -= dt;
  const due = t.pending.filter((p) => p.in <= 0);
  t.pending = t.pending.filter((p) => p.in > 0);
  for (const p of due) queue(t, { ...p.line, delay: 0 });
  const fire = (list: TimedLine[], clock: number): TimedLine[] => {
    if (clock < 0) return list;
    const rest: TimedLine[] = [];
    for (const l of list) {
      if (clock >= l.at) queue(t, { ...l, delay: 0 });
      else rest.push(l);
    }
    return rest;
  };
  t.escape = fire(t.escape, drive.escapeT);
  t.aftermath = fire(t.aftermath, drive.aftermathT);
  for (const b of t.bubbles) {
    b.age += dt;
    stepSpring(b.pop, 1, 16, 0.45, dt);
  }
  t.bubbles = t.bubbles.filter((b) => b.age < b.life + b.fade);
}

/** Late entry: the spent ladder is skipped and (unless escaped) the last two lines shown aged 0.5 s. No events. */
export function settleDialogue(t: Talk, multiplier: number, escaped: boolean): void {
  while (t.next < SCRIPT.length && multiplier >= SCRIPT[t.next]!.at) t.next += 1;
  t.overtimeK = overtimeIndex(multiplier);
  t.spoke = SCRIPT.slice(0, t.next).some((l) => l.who === 'suspect');
  t.holding = escaped;
  t.pending = [];
  if (escaped) return;
  const recent: Omit<Line, 'at'>[] = t.overtimeK >= 0 ? OVERTIME[t.overtimeK % OVERTIME.length]!.lines : SCRIPT.slice(0, t.next);
  for (const l of recent.slice(-2)) say(t, l.who, l.text, l.life ?? LIFE[l.who], l.tag);
  for (const b of t.bubbles) {
    b.age = 0.5;
    settleSpring(b.pop, 1);
  }
  t.events = { said: [] };
}
/** A crash met late: the aftermath lines already due are shown aged (no pops); the rest stay queued. */
export function settleAftermathLines(t: Talk, set: AftermathSet, clock: number): void {
  beginAftermath(t, set);
  const rest: TimedLine[] = [];
  for (const l of t.aftermath) {
    if (clock >= l.at) {
      say(t, l.who, l.text, l.life ?? LIFE[l.who], l.tag);
      const b = t.bubbles[t.bubbles.length - 1]!;
      b.age = Math.min(clock - l.at, b.life + b.fade);
      settleSpring(b.pop, 1);
    } else rest.push(l);
  }
  t.aftermath = rest;
  t.events = { said: [] };
}

// ---- Formatting ----------------------------------------------------------------------------------------

/** 'LEDGE 4.0 m', a true minus once his heels are over. */
export function ledgeText(metres: number): string {
  const v = Math.round((Number.isFinite(metres) ? metres : 0) * 10) / 10;
  return `LEDGE ${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} m`;
}
/** 'FLOOR 40' down to 'FLOOR 15'. */
export const floorText = (floor: number): string => `FLOOR ${Math.max(0, Math.round(Number.isFinite(floor) ? floor : 0))}`;

/** Meme caption lettering: 900-weight system-ui with a dark outline. */
export function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.strokeStyle = INK;
  if (maxWidth === undefined) {
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  } else {
    ctx.strokeText(text, x, y, maxWidth);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y, maxWidth);
  }
}

/** Word-wraps to `width` px; never drops a word. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const rows: string[] = [];
  let row = '';
  for (const w of text.split(' ')) {
    const next = row ? `${row} ${w}` : w;
    if (ctx.measureText(next).width > width && row) {
      rows.push(row);
      row = w;
    } else row = next;
  }
  if (row) rows.push(row);
  return rows.length ? rows : ['…'];
}

/** Tail targets in frame space (the suspect's null once he is gone). */
export interface BubbleAnchors { suspect: { x: number; y: number } | null; lead: { x: number; y: number }; heavy: { x: number; y: number }; hq: { x: number; y: number } }
interface Rect { x: number; y: number; w: number; h: number }
const hits = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The HQ radio bubble: squared, a tooth every 10 px. */
function jagged(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const n = 10;
  const d = 3;
  const [l, r, t, b] = [-w / 2, w / 2, -h / 2, h / 2];
  ctx.moveTo(l, t);
  for (let x = l; x < r - 1; x += n) ctx.lineTo(Math.min(r, x + n / 2), t - d), ctx.lineTo(Math.min(r, x + n), t);
  for (let y = t; y < b - 1; y += n) ctx.lineTo(r + d, Math.min(b, y + n / 2)), ctx.lineTo(r, Math.min(b, y + n));
  for (let x = r; x > l + 1; x -= n) ctx.lineTo(Math.max(l, x - n / 2), b + d), ctx.lineTo(Math.max(l, x - n), b);
  for (let y = b; y > t + 1; y -= n) ctx.lineTo(l - d, Math.max(t, y - n / 2)), ctx.lineTo(l, Math.max(t, y - n));
  ctx.closePath();
}

interface Placed { b: Bubble; rows: string[]; w: number; h: number; lh: number; cx: number; cy: number; s: number; alpha: number; tail: { x: number; y: number } }
/** Landscape only, oldest first. The suspect's sits over his head (bottom 64 px above the mouth) inside x 20..940 and under y 128; the others are fixed. A newer bubble meeting an older live rect is pushed up to 60 px (never into the caption zone). Tails go under every body so none crosses older text. */
export function drawBubbles(ctx: CanvasRenderingContext2D, t: Talk, anchors: BubbleAnchors): void {
  const placed: Rect[] = [];
  const out: Placed[] = [];
  for (const b of t.bubbles) {
    const tail = anchors[b.who];
    if (!tail || !Number.isFinite(tail.x) || !Number.isFinite(tail.y)) continue;
    const hq = b.who === 'hq';
    ctx.font = hq ? HQ_FONT : BUBBLE_FONT;
    const rows = wrap(ctx, b.text, WIDTH[b.who] - 28);
    const lh = hq ? 18 : 22;
    const w = Math.min(WIDTH[b.who], Math.max(...rows.map((r) => ctx.measureText(r).width)) + 28);
    const h = rows.length * lh + 16;
    let cx: number;
    let cy: number;
    if (b.who === 'suspect') {
      cx = clamp(tail.x, 20 + w / 2, 940 - w / 2);
      cy = Math.max(128 + h / 2, tail.y - 64 - h / 2);
    } else {
      cx = FIXED[b.who].x;
      cy = FIXED[b.who].y;
    }
    let lift = 0;
    const rect = (): Rect => ({ x: cx - w / 2, y: cy - lift - h / 2, w, h });
    while (lift < 60 && cy - lift - 10 - h / 2 >= 76 && placed.some((p) => hits(p, rect()))) lift += 10;
    cy -= lift;
    if (b.age < b.life) placed.push(rect());
    const fade = b.age > b.life ? 1 - (b.age - b.life) / Math.max(0.05, b.fade) : 1;
    out.push({ b, rows, w, h, lh, cx, cy, s: clamp(b.pop.x, 0.05, 1.2), alpha: clamp(fade, 0, 1), tail });
  }
  // Pass 0 the tails, 1 the bodies and text, 2 a 14 px stub of each tail over its own body for a seamless join.
  for (const pass of [0, 1, 2]) {
    for (const o of out) {
      const { b, w, h, cx, cy, s, tail } = o;
      const hq = b.who === 'hq';
      ctx.save();
      ctx.globalAlpha = o.alpha;
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.fillStyle = b.who === 'suspect' ? '#ffffff' : hq ? '#dfe6d6' : '#fff3d6';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'butt';
      if (pass === 1) {
        ctx.beginPath();
        if (hq) jagged(ctx, w, h);
        else ctx.roundRect(-w / 2, -h / 2, w, h, 12);
        ctx.fill();
        ctx.stroke();
        ctx.font = hq ? HQ_FONT : BUBBLE_FONT;
        ctx.fillStyle = INK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        o.rows.forEach((r, i) => ctx.fillText(r, 0, -h / 2 + 8 + o.lh / 2 + i * o.lh));
      } else {
        const tx = (tail.x - cx) / s;
        const ty = (tail.y - cy) / s;
        const side = Math.sign(tx) || 1;
        const bx = clamp(tx * 0.6, -w / 2 + 16, w / 2 - 16);
        const by = ((Math.sign(ty) || 1) * h) / 2;
        const k = pass ? Math.min(1, 14 / Math.max(1, Math.hypot(tx - bx, ty - by))) : 1;
        const x0 = bx - 10 * side;
        const x1 = bx + 8 * side;
        ctx.beginPath();
        ctx.moveTo(x0, by);
        ctx.lineTo(x0 + (tx - x0) * k, by + (ty - by) * k);
        ctx.lineTo(x1 + (tx - x1) * k, by + (ty - by) * k);
        ctx.lineTo(x1, by);
        ctx.closePath();
        ctx.fill();
        if (!pass) ctx.stroke();
      }
      ctx.restore();
    }
  }
}
