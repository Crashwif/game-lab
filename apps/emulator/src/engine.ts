/**
 * An in-memory room that plays rounds exactly the way the game server does:
 * a committed SHA-256 hash chain from crash-math, one
 * seed per round in order, the crash point from HMAC(seed, salt) at the
 * committed edge, optional auto cashout and manual exit, the rally bonus and
 * the bettor cap. It differs from the real server only in what it doesn't
 * have: no Postgres, no Solana anchor (the chain is committed in memory and the
 * salt is whatever the scenario says), and credit sessions are free.
 *
 * Outcomes never come from Math.random: they come from the chain, so a test can
 * read the upcoming crash points from `upcoming()` and assert against them.
 */
import { createHash, randomBytes } from 'node:crypto';

import { chain as fairChain, free } from '@crashwif/crash-math';
import type { PublicRoundState, RallyState, RoomInfo, RoomPlayer, RoundResult, ServerMessage, YouState } from '@crashwif/game-sdk/protocol';

export interface EmulatorConfig {
  gameId: string;
  /** 32-byte hex top seed of the first chain; a fresh random one when omitted. */
  topSeed: string | null;
  salt: string;
  chainLength: number;
  chainCheckpointInterval: number;
  houseEdgeBps: number;
  /** The multiplier curve the room announces and runs; a game under test takes it from `RoomInfo.curve`. */
  curve: free.Curve;
  bettingMs: number;
  roundDelayMs: number;
  tickMs: number;
  maxBettorsPerRound: number;
  minTargetX100: number;
  maxTargetX100: number;
  rallyStartsActive: boolean;
  startingCredits: number;
  sessionRounds: number;
  sessionMinutes: number;
  /** Runs the curve and timers this many times faster (tests). */
  timeScale: number;
  bots: number;
}

/** A room id as the game server's are and as the verifier requests them: lowercase letters, digits and hyphens. */
export const GAME_ID = /^[a-z0-9-]{1,64}$/;
/** A ranking name as the platform accepts one. */
export const HANDLE = /^[A-Za-z0-9_]{3,20}$/;

/** The key a session's bets carry in the player list, derived as the game server derives it. */
export function playerKey(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
}

export const DEFAULT_EMULATOR_CONFIG: EmulatorConfig = {
  gameId: 'emulator-game',
  topSeed: null,
  salt: '',
  chainLength: 1_000,
  chainCheckpointInterval: 100,
  houseEdgeBps: free.DEFAULT_EDGE_BPS,
  curve: free.DEFAULT_CURVE,
  bettingMs: 5_000,
  roundDelayMs: 2_000,
  tickMs: 100,
  maxBettorsPerRound: 256,
  minTargetX100: 101,
  maxTargetX100: 100_000,
  rallyStartsActive: true,
  startingCredits: 1_000,
  sessionRounds: 50,
  sessionMinutes: 30,
  timeScale: 1,
  bots: 0,
};

export interface Session {
  sessionId: string;
  /** The name the player list shows, or null for an anonymous player. */
  handle: string | null;
  creditsLeft: number;
  roundsLeft: number;
  /** Epoch milliseconds. */
  expiresAt: number;
  pausedAt: number | null;
  ended: boolean;
  endReason: string | null;
  bet: { stake: number; targetX100: number | null; cashoutX100: number | null; status: 'active' | 'queued' } | null;
  bot: boolean;
}

interface LiveRound {
  index: number;
  seed: string;
  seedHash: string;
  crashX100: number;
  phase: 'betting' | 'running' | 'crashed';
  bettingClosesAt: number;
  runningSince: number | null;
  multiplierX100: number;
  bets: Map<string, { stake: number; targetX100: number | null; cashoutX100: number | null }>;
  queued: { sessionId: string; stake: number; targetX100: number | null }[];
  rally: RallyState;
}

/** A committed chain as the game server lists it on GET /rooms/:id/chains; the emulator's are never anchored. */
export interface PublicChain {
  chainId: number;
  terminalHash: string;
  chainLength: number;
  /** Rounds settled so far. */
  nextIndex: number;
  saltSlot: number;
  salt: string | null;
  houseEdgeBps: number;
  anchorSignature: string | null;
  anchorSlot: number | null;
  createdAt: string;
  retired: boolean;
  retiredAt: string | null;
}

/** A settled round as the game server pages it on GET /rooms/:id/chains/:chainId/rounds. */
export interface PublicRound {
  roundIndex: number;
  seed: string;
  crashX100: number;
  settledAt: string;
}

interface CommittedChain {
  chainId: number;
  terminalHash: string;
  salt: string;
  createdAt: number;
  retiredAt: number | null;
  rounds: PublicRound[];
}

export type Emit = (sessionId: string | null, message: ServerMessage) => void;

export class EmulatorRoom {
  readonly cfg: EmulatorConfig;
  private chainId = 0;
  private chain: fairChain.ChainCheckpoints;
  private nextIndex = 0;
  private salt: string;
  private round: LiveRound | null = null;
  /** The queue of a round that crashed, listed until the next round places it. */
  private carried: LiveRound['queued'] = [];
  private readonly results: RoundResult[] = [];
  /** Every chain committed since start, oldest first, with its settled rounds. */
  private readonly committed: CommittedChain[] = [];
  readonly sessions = new Map<string, Session>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ticker: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private paused = false;
  private botCounter = 0;

  constructor(
    config: Partial<EmulatorConfig> = {},
    private readonly emit: Emit,
    private readonly now: () => number = Date.now,
  ) {
    this.cfg = { ...DEFAULT_EMULATOR_CONFIG, ...config };
    if (!GAME_ID.test(this.cfg.gameId)) throw new Error(`game id ${JSON.stringify(this.cfg.gameId)} is not a short lowercase id (letters, digits and hyphens)`);
    this.salt = this.cfg.salt || randomBytes(32).toString('hex');
    this.chain = fairChain.buildChain(this.cfg.topSeed ?? randomBytes(32).toString('hex'), this.cfg.chainLength, this.cfg.chainCheckpointInterval);
    this.commit();
    for (let i = 0; i < this.cfg.bots; i++) this.createSession(true);
  }

  // ---- what a verifier or the page reads --------------------------------------------

  info(): RoomInfo {
    return {
      gameId: this.cfg.gameId,
      status: this.running ? (this.paused ? 'paused' : 'open') : 'stopped',
      chainId: this.chainId,
      terminalHash: this.chain.terminalHash,
      chainLength: this.cfg.chainLength,
      saltSlot: 0,
      salt: this.salt,
      houseEdgeBps: this.cfg.houseEdgeBps,
      curve: this.cfg.curve,
      anchorSignature: null,
      bettingMs: this.cfg.bettingMs,
      maxBettorsPerRound: this.cfg.maxBettorsPerRound,
      minTargetX100: this.cfg.minTargetX100,
      maxTargetX100: this.cfg.maxTargetX100,
    };
  }

  publicRound(): PublicRoundState {
    const r = this.round;
    const base = { admitted: r ? r.bets.size : 0, queued: r ? r.queued.length : 0, rally: r?.rally ?? { active: false, bettors: 0, percent: 100 }, serverTime: this.now() };
    if (!r) return { roundIndex: null, phase: 'waiting', bettingClosesAt: null, runningSince: null, multiplierX100: 100, crashX100: null, serverSeedHash: null, ...base };
    return {
      roundIndex: r.index,
      phase: r.phase,
      bettingClosesAt: r.bettingClosesAt,
      runningSince: r.runningSince,
      multiplierX100: r.multiplierX100,
      crashX100: r.phase === 'crashed' ? r.crashX100 : null,
      serverSeedHash: r.seedHash,
      ...base,
    };
  }

  recent(limit = 20): RoundResult[] {
    return this.results.slice(-limit).reverse();
  }

  you(sessionId: string | null): YouState | null {
    const s = sessionId ? this.sessions.get(sessionId) : null;
    if (!s) return null;
    return { sessionId: s.sessionId, playerKey: playerKey(s.sessionId), creditsLeft: s.creditsLeft, roundsLeft: s.roundsLeft, expiresAt: s.expiresAt, pausedAt: s.pausedAt, ended: s.ended, endReason: s.endReason, bet: s.bet };
  }

  /** Everyone with a bet: the round's bettors in acceptance order, then the queue for the next round. */
  players(): RoomPlayer[] {
    const r = this.round;
    const active = r ? [...r.bets.keys()].map((sessionId) => this.player(sessionId)!) : [];
    const queued = (r ? r.queued : this.carried).map((q) => this.player(q.sessionId)!);
    return [...active, ...queued];
  }

  /** One session's listed bet, or null when it has none. */
  player(sessionId: string): RoomPlayer | null {
    const s = this.sessions.get(sessionId);
    const r = this.round;
    const bet = r?.bets.get(sessionId);
    const base = { key: playerKey(sessionId), handle: s?.handle ?? null };
    if (bet) {
      const payout = bet.cashoutX100 === null || !r ? null : free.payout(bet.stake, bet.cashoutX100, r.crashX100, r.rally.active ? r.rally.bettors : 0);
      return { ...base, stake: bet.stake, targetX100: bet.targetX100, cashoutX100: bet.cashoutX100, payout, status: 'active' };
    }
    const queued = (r ? r.queued : this.carried).find((q) => q.sessionId === sessionId);
    return queued ? { ...base, stake: queued.stake, targetX100: queued.targetX100, cashoutX100: null, payout: null, status: 'queued' } : null;
  }

  snapshot(sessionId: string | null): ServerMessage {
    return { type: 'state', room: this.info(), round: this.publicRound(), recent: this.recent(), players: this.players(), you: this.you(sessionId) };
  }

  /** Every chain the room has committed, oldest first (or the one asked for), with how far each was played. */
  chains(chainId?: number): PublicChain[] {
    return this.committed
      .filter((c) => chainId === undefined || c.chainId === chainId)
      .map((c) => ({
        chainId: c.chainId,
        terminalHash: c.terminalHash,
        chainLength: this.cfg.chainLength,
        nextIndex: c.rounds.length,
        saltSlot: 0,
        salt: c.salt,
        houseEdgeBps: this.cfg.houseEdgeBps,
        anchorSignature: null,
        anchorSlot: null,
        createdAt: new Date(c.createdAt).toISOString(),
        retired: c.retiredAt !== null,
        retiredAt: c.retiredAt === null ? null : new Date(c.retiredAt).toISOString(),
      }));
  }

  /** Settled rounds of a chain from `from`, in order. */
  rounds(chainId: number, from: number, limit: number): PublicRound[] {
    return (this.committed.find((c) => c.chainId === chainId)?.rounds ?? []).filter((r) => r.roundIndex >= from).slice(0, limit);
  }

  /** The next `n` crash points of the chain, for test authors (a dev tool the real server never has). */
  upcoming(n = 10): { roundIndex: number; crashX100: number }[] {
    const out = [];
    for (let i = this.nextIndex; i < Math.min(this.cfg.chainLength, this.nextIndex + n); i++) out.push({ roundIndex: i, crashX100: free.crashFromSeed(fairChain.deriveSeed(this.chain, i + 1), this.salt, this.cfg.houseEdgeBps) });
    return out;
  }

  // ---- sessions and bets ------------------------------------------------------------------

  /** A session; bots are named after their number, a player after `handle` when it is a valid ranking name. */
  createSession(bot = false, handle: string | null = null): Session {
    const id = bot ? `bot-${++this.botCounter}` : randomBytes(12).toString('hex');
    const name = bot ? `bot_${this.botCounter}` : handle !== null && HANDLE.test(handle) ? handle : null;
    const session: Session = { sessionId: id, handle: name, creditsLeft: this.cfg.startingCredits, roundsLeft: this.cfg.sessionRounds, expiresAt: this.now() + this.cfg.sessionMinutes * 60_000, pausedAt: this.paused ? this.now() : null, ended: false, endReason: null, bet: null, bot };
    this.sessions.set(id, session);
    return session;
  }

  bet(sessionId: string, stake: unknown, targetX100: unknown): ServerMessage {
    const s = this.sessions.get(sessionId);
    if (!s) return { type: 'error', code: 'no_session' };
    if (s.ended || (s.pausedAt === null && s.expiresAt <= this.now())) return { type: 'error', code: 'session_ended' };
    const r = this.round;
    if (!r || !this.running || this.paused) return { type: 'error', code: 'room_not_open' };
    if (r.phase !== 'betting') return { type: 'error', code: 'betting_closed' };
    if (!Number.isSafeInteger(stake) || (stake as number) <= 0) return { type: 'error', code: 'invalid_stake' };
    if (targetX100 !== null && (!Number.isSafeInteger(targetX100) || (targetX100 as number) < this.cfg.minTargetX100 || (targetX100 as number) > this.cfg.maxTargetX100)) return { type: 'error', code: 'invalid_target' };
    if (s.bet) return { type: 'error', code: 'already_bet' };
    if ((stake as number) > s.creditsLeft) return { type: 'error', code: 'insufficient_credits' };
    s.creditsLeft -= stake as number;
    if (r.bets.size < this.cfg.maxBettorsPerRound) {
      r.bets.set(sessionId, { stake: stake as number, targetX100: targetX100 as number | null, cashoutX100: null });
      s.bet = { stake: stake as number, targetX100: targetX100 as number | null, cashoutX100: null, status: 'active' };
      this.emit(null, { type: 'player.bet', player: this.player(sessionId)! });
      this.emit(sessionId, { type: 'you', you: this.you(sessionId)! });
      return { type: 'bet.result', ok: true, status: 'accepted' };
    }
    r.queued.push({ sessionId, stake: stake as number, targetX100: targetX100 as number | null });
    s.bet = { stake: stake as number, targetX100: targetX100 as number | null, cashoutX100: null, status: 'queued' };
    this.emit(null, { type: 'player.bet', player: this.player(sessionId)! });
    this.emit(sessionId, { type: 'you', you: this.you(sessionId)! });
    return { type: 'bet.result', ok: true, status: 'queued' };
  }

  cancel(sessionId: string): ServerMessage {
    const s = this.sessions.get(sessionId);
    const r = this.round;
    if (!s) return { type: 'error', code: 'no_session' };
    if (!s.bet || !r) return { type: 'error', code: 'no_bet' };
    if (r.phase !== 'betting' && s.bet.status !== 'queued') return { type: 'error', code: 'betting_closed' };
    s.creditsLeft += s.bet.stake;
    r.bets.delete(sessionId);
    r.queued = r.queued.filter((q) => q.sessionId !== sessionId);
    s.bet = null;
    this.emit(null, { type: 'player.left', key: playerKey(sessionId) });
    this.emit(sessionId, { type: 'you', you: this.you(sessionId)! });
    // Acknowledged the way the game server does, so a game built here meets the same frame live.
    return { type: 'bet.result', ok: true, status: 'cancelled' };
  }

  cashout(sessionId: string): ServerMessage | null {
    const r = this.round;
    const s = this.sessions.get(sessionId);
    if (!s) return { type: 'error', code: 'no_session' };
    const b = r?.bets.get(sessionId);
    if (!r || !b) return { type: 'error', code: 'no_bet' };
    if (r.phase !== 'running' || r.runningSince === null) return { type: 'error', code: 'cashout_unavailable' };
    if (b.cashoutX100 !== null) return { type: 'error', code: 'already_cashed_out' };
    const elapsed = Math.max(0, Math.floor((this.now() - r.runningSince) * this.cfg.timeScale));
    if (elapsed >= free.msToReach(r.crashX100, this.cfg.curve)) return { type: 'error', code: 'cashout_unavailable' };
    const x100 = free.multiplierAtX100(elapsed, this.cfg.curve);
    if (b.targetX100 !== null && x100 >= b.targetX100) return { type: 'error', code: 'already_cashed_out' };
    b.cashoutX100 = x100;
    if (s.bet) s.bet.cashoutX100 = x100;
    const payout = free.payout(b.stake, x100, r.crashX100, r.rally.active ? r.rally.bettors : 0);
    this.emit(null, { type: 'cashout', roundIndex: r.index, targetX100: x100, payout, player: playerKey(sessionId), mine: false });
    this.emit(sessionId, { type: 'cashout', roundIndex: r.index, targetX100: x100, payout, player: playerKey(sessionId), mine: true });
    this.emit(sessionId, { type: 'you', you: this.you(sessionId)! });
    return null;
  }

  // ---- the round loop -----------------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.emit(null, { type: 'room', room: this.info() });
    this.after(this.cfg.roundDelayMs, () => this.startRound());
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const stamp = this.now();
    for (const session of this.sessions.values()) {
      if (session.ended || session.expiresAt <= stamp) continue;
      session.pausedAt = stamp;
      this.emit(session.sessionId, { type: 'you', you: this.you(session.sessionId)! });
    }
    this.emit(null, { type: 'room', room: this.info() });
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const stamp = this.now();
    for (const session of this.sessions.values()) {
      if (session.pausedAt === null || session.ended) continue;
      session.expiresAt += Math.max(0, stamp - session.pausedAt);
      session.pausedAt = null;
      this.emit(session.sessionId, { type: 'you', you: this.you(session.sessionId)! });
    }
    this.emit(null, { type: 'room', room: this.info() });
    if (!this.round) this.after(this.cfg.roundDelayMs, () => this.startRound());
  }

  stop(): void {
    this.running = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.round = null;
    this.emit(null, { type: 'room', room: this.info() });
  }

  private after(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== t);
      fn();
    }, Math.max(0, ms / this.cfg.timeScale));
    this.timers.push(t);
  }

  private startRound(): void {
    if (!this.running || this.round) return;
    if (this.paused) return;
    if (this.nextIndex >= this.cfg.chainLength) this.rollover();
    const index = this.nextIndex;
    // Round r plays seed r + 1; its announced hash is the previous round's seed (the terminal hash for round 0), as the game server does.
    const seed = fairChain.deriveSeed(this.chain, index + 1);
    const seedHash = index === 0 ? this.chain.terminalHash : fairChain.deriveSeed(this.chain, index);
    const crashX100 = free.crashFromSeed(seed, this.salt, this.cfg.houseEdgeBps);
    const bettingClosesAt = this.now() + this.cfg.bettingMs / this.cfg.timeScale;
    this.round = { index, seed, seedHash, crashX100, phase: 'betting', bettingClosesAt, runningSince: null, multiplierX100: 100, bets: new Map(), queued: [], rally: { active: false, bettors: 0, percent: 100 } };
    this.emit(null, { type: 'round.betting', roundIndex: index, serverSeedHash: seedHash, bettingClosesAt });
    for (const s of this.sessions.values()) if (s.bot && !s.ended) this.botBet(s);
    this.after(this.cfg.bettingMs, () => this.lock());
  }

  /** Bots bet a fixed fraction of their credits at a target drawn from their id: no Math.random, so runs replay. */
  private botBet(s: Session): void {
    const n = Number(s.sessionId.split('-')[1] ?? 1);
    const targetX100 = 110 + ((n * 37 + this.nextIndex * 11) % 400);
    this.bet(s.sessionId, Math.max(1, Math.min(s.creditsLeft, 10 + (n % 5) * 10)), targetX100);
  }

  private lock(): void {
    const r = this.round;
    if (!r || r.phase !== 'betting') return;
    r.phase = 'running';
    r.runningSince = this.now();
    const bettors = r.bets.size;
    r.rally = { active: this.cfg.rallyStartsActive && bettors > 0, bettors, percent: this.cfg.rallyStartsActive ? free.rallyPercent(bettors) : 100 };
    this.emit(null, { type: 'round.locked', roundIndex: r.index, runningSince: r.runningSince, admitted: bettors, rally: r.rally });
    const durationMs = free.msToReach(r.crashX100, this.cfg.curve) / this.cfg.timeScale;
    this.ticker = setInterval(() => this.tick(), Math.max(5, this.cfg.tickMs / this.cfg.timeScale));
    this.after(durationMs * this.cfg.timeScale, () => this.crash());
  }

  private tick(): void {
    const r = this.round;
    if (!r || r.phase !== 'running' || r.runningSince === null) return;
    const elapsed = (this.now() - r.runningSince) * this.cfg.timeScale;
    const x = Math.min(free.multiplierAtX100(elapsed, this.cfg.curve), r.crashX100);
    r.multiplierX100 = x;
    this.emit(null, { type: 'tick', roundIndex: r.index, multiplierX100: x, elapsedMs: elapsed });
    for (const [sessionId, b] of r.bets) {
      if (b.cashoutX100 === null && b.targetX100 !== null && b.targetX100 <= x && b.targetX100 <= r.crashX100) {
        b.cashoutX100 = b.targetX100;
        const s = this.sessions.get(sessionId);
        if (s?.bet) s.bet.cashoutX100 = b.targetX100;
        const payout = free.payout(b.stake, b.targetX100, r.crashX100, r.rally.active ? r.rally.bettors : 0);
        this.emit(null, { type: 'cashout', roundIndex: r.index, targetX100: b.targetX100, payout, player: playerKey(sessionId), mine: false });
        this.emit(sessionId, { type: 'cashout', roundIndex: r.index, targetX100: b.targetX100, payout, player: playerKey(sessionId), mine: true });
        if (s) this.emit(sessionId, { type: 'you', you: this.you(sessionId)! });
      }
    }
  }

  private crash(): void {
    const r = this.round;
    if (!r || r.phase !== 'running') return;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    r.phase = 'crashed';
    r.multiplierX100 = r.crashX100;
    let winners = 0;
    for (const [sessionId, b] of r.bets) {
      const s = this.sessions.get(sessionId);
      const exit = b.cashoutX100 ?? b.targetX100;
      const payout = exit === null ? 0 : free.payout(b.stake, exit, r.crashX100, r.rally.active ? r.rally.bettors : 0);
      if (payout > 0) winners++;
      if (!s) continue;
      s.creditsLeft += payout;
      s.roundsLeft = Math.max(0, s.roundsLeft - 1);
      s.bet = null;
      if (s.creditsLeft <= 0) this.endSession(s, 'credits_used');
      else if (s.roundsLeft === 0) this.endSession(s, 'rounds_used');
      else if (s.pausedAt === null && s.expiresAt <= this.now()) this.endSession(s, 'expired');
      this.emit(sessionId, { type: 'you', you: this.you(sessionId)! });
    }
    const result: RoundResult = { roundIndex: r.index, chainId: this.chainId, crashX100: r.crashX100, serverSeed: r.seed, serverSeedHash: r.seedHash, salt: this.salt, houseEdgeBps: this.cfg.houseEdgeBps, rally: r.rally, bettors: r.bets.size, winners };
    this.results.push(result);
    if (this.results.length > 100) this.results.shift();
    this.committed[this.committed.length - 1]!.rounds.push({ roundIndex: r.index, seed: r.seed, crashX100: r.crashX100, settledAt: new Date(this.now()).toISOString() });
    this.nextIndex = r.index + 1;
    this.emit(null, { type: 'round.crashed', result });
    // Queued bettors are placed first next round.
    this.carried = r.queued;
    this.round = null;
    this.after(this.cfg.roundDelayMs, () => {
      const queued = this.carried;
      this.carried = [];
      this.startRound();
      for (const q of queued) {
        const s = this.sessions.get(q.sessionId);
        if (s) {
          s.bet = null;
          s.creditsLeft += q.stake;
          this.bet(q.sessionId, q.stake, q.targetX100);
        }
      }
    });
  }

  private endSession(s: Session, reason: string): void {
    if (s.pausedAt !== null) {
      s.expiresAt += Math.max(0, this.now() - s.pausedAt);
      s.pausedAt = null;
    }
    s.ended = true;
    s.endReason = reason;
  }

  /** Records the current chain as committed, as the game server does before playing it. */
  private commit(): void {
    this.committed.push({ chainId: this.chainId, terminalHash: this.chain.terminalHash, salt: this.salt, createdAt: this.now(), retiredAt: null, rounds: [] });
  }

  /** Retires the played-out chain and commits the next, as the game server does. */
  private rollover(): void {
    this.committed[this.committed.length - 1]!.retiredAt = this.now();
    this.chainId += 1;
    this.chain = fairChain.buildChain(randomBytes(32).toString('hex'), this.cfg.chainLength, this.cfg.chainCheckpointInterval);
    this.nextIndex = 0;
    this.commit();
    this.emit(null, { type: 'room', room: this.info() });
  }
}
