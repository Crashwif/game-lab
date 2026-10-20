/**
 * God's lines, scheduled on the displayed multiplier and never on the crash point. A ladder line comes due when
 * the multiplier passes its rung; the panel types one line at a time and holds it long enough to read before the
 * next one starts, so a fast curve never floods the screen. Past the last rung an overtime cycle comes due every
 * `ratio` of multiplier, so a long round keeps talking. Everything is bounded. Presentation only.
 */
import { clamp } from './world';

export type Who = 'god' | 'intern';
export interface Line {
  /** The displayed multiplier (1.5 means 1.50×) at which the line comes due; unscheduled lines ignore it. */
  at: number;
  who: Who;
  text: string;
}
export interface Script {
  readonly ladder: readonly Line[];
  readonly overtime: readonly Omit<Line, 'at'>[];
  readonly ratio: number;
  next: number;
  overtimeDue: number;
  queue: Line[];
  current: Line | null;
  /** Characters of the current line typed so far, and seconds since it started. */
  shown: number;
  age: number;
  /** Seconds since the last line started. */
  quiet: number;
  /** The last lines said, newest last, for the blue screen's trace. */
  said: Line[];
  /** Lines started this frame, for cues. */
  events: Line[];
}

export const CHARS_PER_SECOND = 44;
const MAX_QUEUE = 3;
const MAX_SAID = 6;
/** How long a line stays once typed: enough to read, never over 6 s. */
export const readTime = (text: string): number => clamp(1.2 + text.length * 0.04, 2, 6);

export function createScript(ladder: readonly Line[], overtime: readonly Omit<Line, 'at'>[], ratio = 1.35): Script {
  return { ladder, overtime, ratio, next: 0, overtimeDue: 0, queue: [], current: null, shown: 0, age: 0, quiet: 99, said: [], events: [] };
}

export function resetScript(s: Script): void {
  s.next = 0;
  s.overtimeDue = 0;
  s.queue = [];
  s.current = null;
  s.shown = 0;
  s.age = 0;
  s.quiet = 99;
  s.said = [];
  s.events = [];
}

const overtimeCount = (s: Script, multiplier: number): number => {
  const last = s.ladder.at(-1)?.at ?? 1;
  if (s.overtime.length === 0 || multiplier < last * s.ratio) return 0;
  return Math.floor(Math.log(multiplier / last) / Math.log(s.ratio) + 1e-9);
};
const overtimeLine = (s: Script, k: number): Line => ({ at: (s.ladder.at(-1)?.at ?? 1) * s.ratio ** (k + 1), ...s.overtime[k % s.overtime.length]! });

function enqueue(s: Script, line: Line, urgent: boolean): void {
  if (urgent) s.queue.unshift(line);
  else s.queue.push(line);
  // A curve that passes rungs faster than anyone can talk keeps the newest lines.
  while (s.queue.length > MAX_QUEUE) s.queue.splice(urgent ? 1 : 0, 1);
}

function start(s: Script, line: Line): void {
  s.current = line;
  s.shown = 0;
  s.age = 0;
  s.quiet = 0;
  s.said.push(line);
  if (s.said.length > MAX_SAID) s.said.shift();
  s.events.push(line);
}

/** Whether the current line has typed out and been up long enough for the next one. */
const finished = (s: Script): boolean => !s.current || (s.shown >= s.current.text.length && s.age >= readTime(s.current.text));

/** Advances the script by `dt` seconds at the displayed `multiplier`; `live` lets ladder and overtime lines come due. */
export function stepScript(s: Script, multiplier: number, dt: number, live: boolean): void {
  s.events = [];
  s.quiet += dt;
  if (live) {
    while (s.next < s.ladder.length && multiplier >= s.ladder[s.next]!.at) enqueue(s, s.ladder[s.next++]!, false);
    if (s.next >= s.ladder.length) {
      const due = overtimeCount(s, multiplier);
      if (due - s.overtimeDue > MAX_QUEUE) s.overtimeDue = due - MAX_QUEUE;
      while (s.overtimeDue < due) enqueue(s, overtimeLine(s, s.overtimeDue++), false);
    }
  }
  if (s.current) {
    s.shown = Math.min(s.current.text.length, s.shown + dt * CHARS_PER_SECOND);
    s.age += dt;
  }
  if (finished(s) && s.queue.length > 0 && s.quiet >= 0.3) start(s, s.queue.shift()!);
}

/** An unscheduled line, queued in order; `urgent` puts it next, and `interrupt` also cuts the current line off. */
export function say(s: Script, line: Omit<Line, 'at'>, urgent = false, interrupt = false): void {
  const full: Line = { at: 0, ...line };
  if (interrupt) {
    s.queue = [];
    s.current = null;
    s.quiet = 99;
  }
  enqueue(s, full, urgent || interrupt);
}

/** Drops every line still waiting. */
export function hush(s: Script): void {
  s.queue = [];
}

/** Settles a fresh script into a round already at `multiplier`: the due lines count as said and the last stands fully typed. */
export function settleScript(s: Script, multiplier: number): void {
  resetScript(s);
  while (s.next < s.ladder.length && multiplier >= s.ladder[s.next]!.at) s.next += 1;
  const said: Line[] = s.ladder.slice(0, s.next);
  if (s.next >= s.ladder.length) {
    s.overtimeDue = overtimeCount(s, multiplier);
    for (let k = Math.max(0, s.overtimeDue - s.overtime.length); k < s.overtimeDue; k += 1) said.push(overtimeLine(s, k));
  }
  s.said = said.slice(-MAX_SAID);
  const last = said.at(-1);
  if (last) {
    s.current = last;
    s.shown = last.text.length;
    s.age = 1;
    s.quiet = 1;
  }
  s.events = [];
}

/** Shows `line` at once, fully typed, outside the queue: for settling an aftermath seen late. */
export function settleLine(s: Script, line: Omit<Line, 'at'>): void {
  const full: Line = { at: 0, ...line };
  s.current = full;
  s.shown = full.text.length;
  s.age = 1;
  s.quiet = 1;
  s.said.push(full);
  if (s.said.length > MAX_SAID) s.said.shift();
}

/** The current line as far as it has typed. */
export const visibleText = (s: Script): string => (s.current ? s.current.text.slice(0, Math.floor(s.shown)) : '');
/** Whether the panel is still typing. */
export const typing = (s: Script): boolean => s.current !== null && s.shown < s.current.text.length;
