/**
 * Replays of settled rounds. A round is fully determined by its committed
 * seed, the chain's salt and edge, its bets and the curve its chain ran on.
 * Manual cashouts include the multiplier and elapsed time accepted by the
 * room. The same maths (@crashwif/crash-math) drives the virtual clock.
 */
import { chain as fairChain, free } from '@crashwif/crash-math';

import type { RallyState, RoundResult } from './protocol.js';

export interface ReplayBet {
  /** The player's ranking name, or null when they have none or hid it. */
  handle: string | null;
  stake: number;
  targetX100: number | null;
  cashoutX100?: number | null;
  cashoutElapsedMs?: number | null;
  cashoutAt?: string | null;
  won: boolean;
  payout: number;
}

export interface ReplayRound {
  gameId: string;
  chainId: number;
  roundIndex: number;
  crashX100: number;
  serverSeed: string;
  serverSeedHash: string;
  salt: string;
  houseEdgeBps: number;
  /**
   * The curve the round ran on (its chain's): the ticks, the auto cashouts and the crash fall where it says. A
   * round recorded without one ran on `free.FIRST_CURVE` (see `replayCurve`).
   */
  curve?: free.Curve;
  rallyN: number;
  bets: ReplayBet[];
  startedAt?: string | null;
  settledAt?: string | null;
}

export type ReplayEvent =
  | { type: 'round.betting'; roundIndex: number; serverSeedHash: string; bettingMs: number }
  | { type: 'bet'; bet: ReplayBet; index: number }
  | { type: 'round.locked'; roundIndex: number; admitted: number; rally: RallyState }
  | { type: 'tick'; roundIndex: number; multiplierX100: number; elapsedMs: number }
  | { type: 'cashout'; roundIndex: number; targetX100: number; payout: number; handle: string | null; elapsedMs: number }
  | { type: 'round.crashed'; result: RoundResult; durationMs: number };

export interface TimelineEntry {
  /** Milliseconds from the start of the replay. */
  at: number;
  event: ReplayEvent;
}

export interface ReplayOptions {
  /** How long the betting phase is shown (the live round's was 10 s). */
  bettingMs?: number;
  tickMs?: number;
}

/**
 * The curve a recorded round ran on: the one it names, `free.FIRST_CURVE` when it was recorded without one,
 * and null when it names one the maths can't run (such a round can't be replayed or checked).
 */
export function replayCurve(round: Pick<ReplayRound, 'curve'>): free.Curve | null {
  if (round.curve === undefined) return free.FIRST_CURVE;
  return free.validCurve(round.curve) ? round.curve : null;
}

/** Whether the round's crash point follows from its seed and salt, and its seed hashes to its announced hash. */
export function verifyReplay(round: ReplayRound): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  try {
    if (fairChain.hashSeed(round.serverSeed) !== round.serverSeedHash) problems.push("the seed doesn't hash to the hash announced before the round");
    if (free.crashFromSeed(round.serverSeed, round.salt, round.houseEdgeBps) !== round.crashX100) problems.push("the crash point doesn't follow from the seed and salt");
  } catch (error) {
    problems.push(`the seed can't be checked: ${(error as Error).message}`);
  }
  const curve = replayCurve(round);
  if (!curve) problems.push('the round names a multiplier curve this player can\'t run');
  for (const bet of round.bets) {
    const exit = bet.cashoutX100 ?? bet.targetX100;
    const expected = exit === null ? 0 : free.payout(bet.stake, exit, round.crashX100, round.rallyN);
    if ((bet.won && expected === 0) || (!bet.won && expected > 0) || bet.payout !== expected) problems.push(`a bet with ${exit === null ? 'no cashout' : `${(exit / 100).toFixed(2)}x exit`} was settled differently from the maths`);
    if (curve && bet.cashoutX100 !== null && bet.cashoutX100 !== undefined) {
      const elapsed = bet.cashoutElapsedMs;
      if (elapsed === null || elapsed === undefined || !Number.isInteger(elapsed) || elapsed < 0
        || free.multiplierAtX100(elapsed, curve) !== bet.cashoutX100 || elapsed >= free.msToReach(round.crashX100, curve)
        || (bet.targetX100 !== null && bet.cashoutX100 >= bet.targetX100)) problems.push("a manual cashout does not match the round's curve or precede the crash and auto target");
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * The deterministic event timeline of a round: betting, the bets, lock, ticks, cash-outs, the crash. A round
 * naming a curve the maths can't run has no timeline (RangeError): there is no pace to place its events at.
 */
export function replayTimeline(round: ReplayRound, options: ReplayOptions = {}): TimelineEntry[] {
  const curve = replayCurve(round);
  if (!curve) throw new RangeError('the round names a multiplier curve this player can\'t run');
  const bettingMs = Math.max(500, options.bettingMs ?? 3_000);
  const tickMs = Math.max(20, options.tickMs ?? 100);
  const entries: TimelineEntry[] = [{ at: 0, event: { type: 'round.betting', roundIndex: round.roundIndex, serverSeedHash: round.serverSeedHash, bettingMs } }];
  const bets = [...round.bets].sort((a, b) => b.stake - a.stake);
  bets.forEach((bet, index) => entries.push({ at: Math.round((bettingMs * (index + 1)) / (bets.length + 1)), event: { type: 'bet', bet, index } }));
  const rally: RallyState = { active: round.rallyN > 0, bettors: round.rallyN, percent: free.rallyPercent(round.rallyN) };
  entries.push({ at: bettingMs, event: { type: 'round.locked', roundIndex: round.roundIndex, admitted: bets.length, rally } });
  const durationMs = free.msToReach(round.crashX100, curve);
  for (let t = tickMs; t < durationMs; t += tickMs) {
    entries.push({ at: bettingMs + t, event: { type: 'tick', roundIndex: round.roundIndex, multiplierX100: free.multiplierAtX100(t, curve), elapsedMs: t } });
  }
  for (const bet of bets) {
    if (!bet.won) continue;
    const exit = bet.cashoutX100 ?? bet.targetX100;
    if (exit === null) continue;
    const t = bet.cashoutX100 === null || bet.cashoutX100 === undefined ? free.msToReach(exit, curve) : bet.cashoutElapsedMs ?? 0;
    entries.push({ at: bettingMs + t, event: { type: 'cashout', roundIndex: round.roundIndex, targetX100: exit, payout: bet.payout, handle: bet.handle, elapsedMs: t } });
  }
  const result: RoundResult = {
    roundIndex: round.roundIndex,
    chainId: round.chainId,
    crashX100: round.crashX100,
    serverSeed: round.serverSeed,
    serverSeedHash: round.serverSeedHash,
    salt: round.salt,
    houseEdgeBps: round.houseEdgeBps,
    rally,
    bettors: bets.length,
    winners: bets.filter((b) => b.won).length,
  };
  entries.push({ at: bettingMs + durationMs, event: { type: 'round.crashed', result, durationMs } });
  // Stable order: by time, then betting before bets, ticks before cash-outs at the same instant, the crash last.
  const rank = (e: ReplayEvent) => ({ 'round.betting': 0, bet: 1, 'round.locked': 2, tick: 3, cashout: 4, 'round.crashed': 5 })[e.type];
  return entries.sort((a, b) => a.at - b.at || rank(a.event) - rank(b.event));
}

export interface PlayerOptions extends ReplayOptions {
  /** Playback speed; 2 plays twice as fast. */
  speed?: number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

/** Plays a timeline on a virtual clock; pausing keeps its place. */
export class ReplayPlayer {
  readonly timeline: TimelineEntry[];
  private position = 0;
  private timer: unknown = null;
  private handlers: ((event: ReplayEvent, at: number) => void)[] = [];
  private endHandlers: (() => void)[] = [];
  private readonly speed: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(
    readonly round: ReplayRound,
    options: PlayerOptions = {},
  ) {
    this.timeline = replayTimeline(round, options);
    this.speed = options.speed && options.speed > 0 ? options.speed : 1;
    this.setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  on(handler: (event: ReplayEvent, at: number) => void): () => void {
    this.handlers.push(handler);
    return () => (this.handlers = this.handlers.filter((h) => h !== handler));
  }

  onEnd(handler: () => void): () => void {
    this.endHandlers.push(handler);
    return () => (this.endHandlers = this.endHandlers.filter((h) => h !== handler));
  }

  get durationMs(): number {
    return this.timeline.length ? this.timeline[this.timeline.length - 1]!.at : 0;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  get finished(): boolean {
    return this.position >= this.timeline.length;
  }

  play(): void {
    if (this.timer !== null || this.finished) return;
    this.schedule();
  }

  pause(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  /** Back to the start, stopped. */
  reset(): void {
    this.pause();
    this.position = 0;
  }

  /** Emits everything up to `atMs` at once (a scrub), then continues from there if playing. */
  seek(atMs: number): void {
    const wasPlaying = this.playing;
    this.pause();
    if (atMs < (this.timeline[this.position - 1]?.at ?? -1)) this.position = 0;
    while (this.position < this.timeline.length && this.timeline[this.position]!.at <= atMs) {
      const entry = this.timeline[this.position++]!;
      for (const h of this.handlers) h(entry.event, entry.at);
    }
    if (this.finished) for (const h of this.endHandlers) h();
    else if (wasPlaying) this.schedule();
  }

  private schedule(): void {
    const entry = this.timeline[this.position];
    if (!entry) {
      this.timer = null;
      for (const h of this.endHandlers) h();
      return;
    }
    const previous = this.position === 0 ? 0 : this.timeline[this.position - 1]!.at;
    this.timer = this.setTimer(() => {
      this.position += 1;
      for (const h of this.handlers) h(entry.event, entry.at);
      this.schedule();
    }, Math.max(0, (entry.at - previous) / this.speed));
  }
}
