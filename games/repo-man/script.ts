/**
 * The dialogue: a ladder of lines keyed to the displayed multiplier, never to the crash point. A line comes due
 * when the multiplier passes its rung and is said once its speaker's current bubble has been up long enough to
 * read (at least HOLD seconds) and a short beat has passed since the last line, so two lines never pop on the
 * same frame and replies follow their questions. The caption is the last captioned line actually said, so it
 * never runs ahead of the dialogue. Past the last rung an overtime cycle comes due every `ratio` of multiplier,
 * so a long round keeps talking. Everything is bounded: at most MAX_BUBBLES live bubbles and MAX_QUEUE waiting.
 * Presentation only: nothing here reads or changes the round's outcome.
 */
import { clamp, spring, type Spring, stepSpring } from './motion';

export interface Line {
  /** The displayed multiplier (1.5 means 1.50×) at which the line comes due. Unscheduled lines ignore it. */
  at: number;
  /** Who says it: a key the game maps to a bubble position and a character. */
  who: string;
  text: string;
  /** The HUD caption this line sets once it is said. */
  cap?: string;
  /** Seconds after the previous line was said before this one may be (a reply, a beat). Default BEAT. */
  gap?: number;
  /** How long the bubble stays up, in seconds; by default from its length. */
  life?: number;
  thought?: boolean;
  /** A game-specific tag the scene reads from `events` to stage a prop beat or a cue. */
  beat?: string;
}

export interface Bubble {
  line: Line;
  age: number;
  life: number;
  pop: Spring;
}

export interface Script {
  readonly ladder: readonly Line[];
  readonly overtime: readonly Omit<Line, 'at'>[];
  readonly ratio: number;
  /** The next ladder line not yet due, and how many overtime lines have come due. */
  next: number;
  overtimeDue: number;
  queue: Line[];
  bubbles: Bubble[];
  caption: string;
  /** Seconds since the last line was said. */
  quiet: number;
  /** Lines said this frame, for cues and reactions. Cleared at the start of every step. */
  events: Line[];
}

/** A bubble stays up at least this long before the same speaker's next line replaces it. */
export const HOLD = 2.6;
/** The default beat between two consecutive lines. */
export const BEAT = 0.7;
const MAX_BUBBLES = 5;
const MAX_QUEUE = 4;

/** The last item matching `test` (ES2022 has no Array.prototype.findLast). */
function lastOf<T>(items: readonly T[], test: (item: T) => boolean): T | undefined {
  for (let i = items.length - 1; i >= 0; i -= 1) if (test(items[i]!)) return items[i];
  return undefined;
}

/** How long a line takes to read: never under HOLD, never over 7 s. */
export const readTime = (line: Pick<Line, 'text' | 'life'>): number => line.life ?? clamp(1.3 + line.text.length * 0.042, HOLD + 0.3, 7);
/** How long a speaker's bubble must have been up before their next line may replace it. */
const holdFor = (b: Bubble): number => Math.min(b.life, Math.max(HOLD, clamp(0.9 + b.line.text.length * 0.026, HOLD, 4.6)));

export function createScript(ladder: readonly Line[], overtime: readonly Omit<Line, 'at'>[], ratio = 1.35): Script {
  return { ladder, overtime, ratio, next: 0, overtimeDue: 0, queue: [], bubbles: [], caption: '', quiet: 99, events: [] };
}

export function resetScript(s: Script): void {
  s.next = 0;
  s.overtimeDue = 0;
  s.queue = [];
  s.bubbles = [];
  s.caption = '';
  s.quiet = 99;
  s.events = [];
}

/** The multiplier at which overtime line `k` (0-based) comes due. */
const overtimeAt = (s: Script, k: number): number => (s.ladder.at(-1)?.at ?? 1) * s.ratio ** (k + 1);
/** How many overtime lines are due at `multiplier`, in closed form so a late entry at 100,000× does not loop. */
const overtimeCount = (s: Script, multiplier: number): number => {
  const last = s.ladder.at(-1)?.at ?? 1;
  if (s.overtime.length === 0 || multiplier < last * s.ratio) return 0;
  return Math.floor(Math.log(multiplier / last) / Math.log(s.ratio) + 1e-9);
};
const overtimeLine = (s: Script, k: number): Line => ({ at: overtimeAt(s, k), ...s.overtime[k % s.overtime.length]! });

function enqueue(s: Script, line: Line, urgent: boolean): void {
  if (urgent) s.queue.unshift(line);
  else s.queue.push(line);
  // A fast curve can pass rungs faster than anyone can talk: drop the oldest uncaptioned line, then the oldest.
  while (s.queue.length > MAX_QUEUE) {
    const spare = s.queue.findIndex((l, i) => i > 0 && !l.cap);
    s.queue.splice(spare > 0 ? spare : 1, 1);
  }
}

function show(s: Script, line: Line, age = 0): void {
  for (const b of s.bubbles) if (b.line.who === line.who && b.age < b.life) b.life = Math.min(b.life, b.age + 0.12);
  s.bubbles.push({ line, age, life: readTime(line), pop: spring(age > 0 ? 1 : 0.55) });
  if (s.bubbles.length > MAX_BUBBLES) s.bubbles.splice(0, s.bubbles.length - MAX_BUBBLES);
  if (line.cap) s.caption = line.cap;
}

/** The speaker's live bubble, if any. */
export const bubbleOf = (s: Script, who: string): Bubble | undefined => lastOf(s.bubbles, (b) => b.line.who === who && b.age < b.life);

/**
 * Advances the script by `dt` seconds at the displayed `multiplier`. While `live` (running, no crash yet) lines
 * come due from the ladder and the overtime cycle; queued lines (including unscheduled ones from `say`) are said
 * in order whenever their speaker is free and the beat has passed, live or not.
 */
export function stepScript(s: Script, multiplier: number, dt: number, live: boolean): void {
  s.events = [];
  s.quiet += dt;
  if (live) {
    while (s.next < s.ladder.length && multiplier >= s.ladder[s.next]!.at) enqueue(s, s.ladder[s.next++]!, false);
    if (s.next >= s.ladder.length) {
      const due = overtimeCount(s, multiplier);
      // Never more than a few at once, even if a frame jumps a long way up the curve.
      if (due - s.overtimeDue > MAX_QUEUE) s.overtimeDue = due - MAX_QUEUE;
      while (s.overtimeDue < due) enqueue(s, overtimeLine(s, s.overtimeDue++), false);
    }
  }
  const head = s.queue[0];
  if (head) {
    const current = bubbleOf(s, head.who);
    const free = !current || current.age >= holdFor(current);
    if (free && s.quiet >= (head.gap ?? BEAT)) {
      s.queue.shift();
      show(s, head);
      s.quiet = 0;
      s.events.push(head);
    }
  }
  for (const b of s.bubbles) {
    b.age += dt;
    stepSpring(b.pop, 1, 18, 0.5, dt);
  }
  s.bubbles = s.bubbles.filter((b) => b.age < b.life + 0.3);
}

/**
 * An unscheduled line (a cash-out, the crash, a regret aside), said through the same queue. `urgent` puts it at
 * the head of the queue; `interrupt` also lets it cut its speaker off and skip the beat.
 */
export function say(s: Script, line: Omit<Line, 'at'> & { at?: number }, urgent = false, interrupt = false): void {
  const full: Line = { at: 0, ...line };
  if (interrupt) {
    s.queue = s.queue.filter((l) => l.who !== full.who);
    for (const b of s.bubbles) if (b.line.who === full.who) b.life = Math.min(b.life, b.age);
    s.quiet = 99;
  }
  enqueue(s, full, urgent || interrupt);
}

/** Shows `line` at once as if said `age` seconds ago, outside the queue and without an event: for settling a late entry. */
export function settleLine(s: Script, line: Omit<Line, 'at'> & { at?: number }, age = 0.6): void {
  show(s, { at: 0, ...line }, age);
}

/** Drops every line still waiting: the crash ends the agenda. Lines `say` adds afterwards still play. */
export function hush(s: Script): void {
  s.queue = [];
}

/**
 * Settles a fresh script into a round already at `multiplier`, for a scene that missed the start: every line
 * below the multiplier counts as said, the caption is the last captioned one, and the last line or two stay up
 * as if they had been said a moment ago. Nothing is queued and no events fire.
 */
export function settleScript(s: Script, multiplier: number): void {
  resetScript(s);
  while (s.next < s.ladder.length && multiplier >= s.ladder[s.next]!.at) s.next += 1;
  const said: Line[] = s.ladder.slice(0, s.next);
  if (s.next >= s.ladder.length) {
    s.overtimeDue = overtimeCount(s, multiplier);
    for (let k = Math.max(0, s.overtimeDue - s.overtime.length); k < s.overtimeDue; k += 1) said.push(overtimeLine(s, k));
  }
  const caption = lastOf(said, (l) => l.cap !== undefined);
  if (caption?.cap) s.caption = caption.cap;
  const last = said.at(-1);
  if (last) {
    const before = lastOf(said, (l) => l.who !== last.who);
    if (before && said.indexOf(before) >= said.length - 3) show(s, before, 1.2);
    show(s, last, 0.6);
    if (caption?.cap) s.caption = caption.cap;
  }
  s.quiet = 0.6;
  s.events = [];
}

/** How hard `who` is talking right now: 1 while their bubble is fresh, easing to 0 as they finish the line. */
export function talking(s: Script, who: string): number {
  const b = bubbleOf(s, who);
  if (!b) return 0;
  const speak = Math.min(b.life, 0.6 + b.line.text.length * 0.035);
  return b.line.thought ? 0 : clamp(1 - (b.age - speak) / 0.4, 0, 1) * clamp(b.age / 0.08, 0, 1);
}

/** The most recent line said, for the portrait's content line and the HUD. */
export const lastLine = (s: Script): Line | undefined => s.bubbles.at(-1)?.line;

/** A bubble's fade: full while live, fading over 0.3 s after its life. */
export const bubbleAlpha = (b: Bubble): number => (b.age > b.life ? clamp(1 - (b.age - b.life) / 0.3, 0, 1) : 1);
