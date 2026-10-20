/**
 * Room state for anything that talks to a game-server room (the platform's
 * player page and overlay, creator-built games through the SDK, the emulator's
 * tests): a pure reducer over the wire protocol that also keeps the client's
 * own checks on the room. Every consumer folds the same messages the same
 * way, so a room can't tell a platform page from a creator's game.
 */
import { chain as fairChain, free } from '@crashwif/crash-math';
import type { ErrorCode, PublicRoundState, RoomInfo, RoomPlayer, RoundResult, ServerMessage, YouState } from './protocol.js';

export interface RoomState {
  room: RoomInfo | null;
  round: PublicRoundState | null;
  recent: RoundResult[];
  /**
   * Everyone with a bet in the room: the round's bettors in the order they were accepted (a crashed round's
   * stay listed until the next round opens), then the players queued for the next round. A bet's outcome
   * follows from the entry and the round: a cashout on it won, and without one it has lost once the round
   * crashed.
   */
  players: RoomPlayer[];
  you: YouState | null;
  connected: boolean;
  lastError: { code: ErrorCode; message?: string } | null;
  /** How the room answered this client's last bet, until the next round opens; null again once it is cancelled. */
  lastBet: 'accepted' | 'queued' | null;
  /** Server clock minus ours, from the last state or pong. */
  clockOffsetMs: number;
  /**
   * The seed hash each round announced before betting, keyed "chain:round".
   * A revealed seed is checked against this, not against the hash in the same
   * message that reveals it.
   */
  announced: Record<string, string>;
  /** Rounds whose announced hash was not the previous revealed seed (or the terminal hash): caught at betting time. */
  brokenAnnouncements: Record<string, true>;
  /** Each chain's commitment as first seen, so a later room message can't swap it. */
  chains: Record<number, { terminalHash: string; houseEdgeBps: number; curve: free.Curve | null; salt: string | null; chainLength: number; saltSlot: number; anchorSignature: string | null; anchorKey?: string | null; changed: boolean }>;
  /** Seeds this client saw revealed live (round.crashed), keyed "chain:round"; a connect snapshot can't touch them. */
  revealed: Record<string, string>;
  /** Per chain, the highest round whose revealed seed this client hashed back to the chain's pinned terminal hash. */
  verified: Record<number, { round: number; seed: string }>;
  /**
   * Everything this client caught the room doing wrong: a result for a chain other than the one announced, a
   * seed that doesn't hash back to the chain, a crash point that doesn't follow from its seed, a commitment
   * that changed, a round hash announced out of sequence. Any entry turns betting off.
   */
  integrity: string[];
  /**
   * Round order as seen on the current connection (reset by each connect snapshot): the round announced last
   * and the round revealed last. Rounds must come one after another, each revealed before the next is
   * announced, and a chain must be played to its end before the next one starts.
   */
  sequence: { chainId: number; announced: number | null; revealed: number | null; at: number } | null;
  /** The highest chain id the room has announced: chains never go backwards. */
  highestChain: number;
  /**
   * Per chain, the last round this browser verified and when (kept across connections and reloads). Rounds this
   * page didn't watch must still fit the time between.
   */
  baselines: Record<number, { last: number; at: number }>;
  /** Jumps across a reconnect or reload not judged yet: they wait for the chain's anchored minimum round time. */
  gaps: { chainId: number; from: number; to: number; elapsedMs: number }[];
  /** Each chain's minimum round time as anchored on Solana (from this page's own check of the anchor). */
  paceMs: Record<number, number>;
  /** When the one extra round allowed for a restarted server was last granted (at most once an hour). */
  graceAt: number | null;
}

export const emptyRoomState = (): RoomState => ({
  room: null,
  round: null,
  recent: [],
  players: [],
  you: null,
  connected: false,
  lastError: null,
  lastBet: null,
  clockOffsetMs: 0,
  announced: {},
  brokenAnnouncements: {},
  chains: {},
  revealed: {},
  verified: {},
  integrity: [],
  sequence: null,
  highestChain: -1,
  baselines: {},
  gaps: [],
  paceMs: {},
  graceAt: null,
});

/** A client joining mid-chain hashes one revealed seed back to the terminal hash once; chains are at most 1,000,000 rounds. */
const MAX_LINK_STEPS = 1_000_000;

/** Records a problem caught outside the reducer (a second snapshot on one connection). */
export function withProblem(state: RoomState, problem: string): Pick<RoomState, 'integrity'> {
  return { integrity: flag(state, problem) };
}

/**
 * Seeds the page with what this browser saw on earlier visits: each chain's commitment as first
 * pinned and its highest verified reveal, so a room can't replay or rewrite them after a reload, and the
 * highest chain seen, so it can't go back to an older one.
 */
export function remember(
  state: RoomState,
  seen: { chainId: number; terminalHash: string; houseEdgeBps: number; curve?: free.Curve | null; salt: string | null; chainLength: number; saltSlot: number; anchorSignature: string | null; anchorKey?: string | null; lastRound: number | null; lastSeed: string | null; lastAt?: number | null }[],
): Pick<RoomState, 'chains' | 'verified' | 'highestChain' | 'baselines'> {
  const chains = { ...state.chains };
  const verified = { ...state.verified };
  const baselines = { ...state.baselines };
  let highestChain = state.highestChain;
  for (const e of seen) {
    chains[e.chainId] ??= { terminalHash: e.terminalHash, houseEdgeBps: e.houseEdgeBps, curve: free.validCurve(e.curve) ? e.curve : null, salt: e.salt, chainLength: e.chainLength, saltSlot: e.saltSlot, anchorSignature: e.anchorSignature, anchorKey: e.anchorKey, changed: false };
    if (e.lastRound !== null && e.lastSeed !== null && (verified[e.chainId]?.round ?? -1) < e.lastRound) verified[e.chainId] = { round: e.lastRound, seed: e.lastSeed };
    if (e.lastRound !== null && typeof e.lastAt === 'number' && (baselines[e.chainId]?.last ?? -1) < e.lastRound) baselines[e.chainId] = { last: e.lastRound, at: e.lastAt };
    highestChain = Math.max(highestChain, e.chainId);
  }
  return { chains, verified, highestChain, baselines };
}

/**
 * Judges the jumps recorded across reconnects and reloads once a chain's anchored minimum round time is known:
 * the rounds missed must fit the time away, one minimum round time each, plus one extra round at
 * most once an hour (a restarted server settles the round it had open at once).
 */
export function judgeGaps(state: RoomState, now: number): Pick<RoomState, 'gaps' | 'integrity' | 'graceAt'> {
  let { integrity, graceAt } = state;
  const gaps = state.gaps.filter((g) => {
    const pace = state.paceMs[g.chainId];
    if (pace === undefined) return true;
    const missed = g.to - g.from - 1;
    const allowed = Math.floor(Math.max(0, g.elapsedMs) / Math.max(1, pace));
    if (missed <= allowed) return false;
    if (missed === allowed + 1 && (graceAt === null || now - graceAt > 3_600_000)) {
      graceAt = now;
      return false;
    }
    integrity = flag({ integrity }, `${missed} rounds of chain ${g.chainId} went by in ${Math.round(g.elapsedMs / 1000)}s while this page wasn't watching, faster than they can be played`);
    return false;
  });
  return { gaps, integrity, graceAt };
}

/** Records the chain's anchored minimum round time and judges any jumps waiting for it. */
export function setPace(state: RoomState, chainId: number, minRoundMs: number, now: number): Pick<RoomState, 'paceMs' | 'gaps' | 'integrity' | 'graceAt'> {
  const next = { ...state, paceMs: { ...state.paceMs, [chainId]: minRoundMs } };
  return { paceMs: next.paceMs, ...judgeGaps(next, now) };
}

/** Adds a problem; the first one (usually the root cause) is always kept. */
function flag(state: Pick<RoomState, 'integrity'>, ...problems: string[]): string[] {
  let integrity = state.integrity;
  for (const problem of problems) {
    if (integrity.includes(problem)) continue;
    const all = [...integrity, problem];
    integrity = all.length <= 20 ? all : [all[0]!, ...all.slice(-19)];
  }
  return integrity;
}

/** `seed` hashed `steps` times, or null if it isn't a seed. */
function hashTimes(seed: string, steps: number): string | null {
  try {
    let link = seed;
    for (let i = 0; i < steps; i++) link = fairChain.hashSeed(link);
    return link;
  } catch {
    return null;
  }
}

/**
 * Checks a round revealed live against what this client already trusts: the seed must hash back to the last
 * seed it verified for the chain (or to the pinned terminal hash), the result must belong to the chain the
 * room announced, and its crash point must follow from the seed with the pinned salt and edge.
 */
function checkReveal(state: RoomState, r: RoundResult): Pick<RoomState, 'verified' | 'integrity'> {
  let { verified, integrity } = state;
  const current = state.room?.chainId;
  if (!Number.isSafeInteger(r.chainId) || r.chainId !== current) integrity = flag({ integrity }, `a result for chain ${String(r.chainId)} arrived while the room announced chain ${String(current ?? 'none')}`);
  const pinned = Number.isSafeInteger(r.chainId) ? state.chains[r.chainId] : undefined;
  if (!pinned || !Number.isSafeInteger(r.roundIndex) || r.roundIndex < 0) return { verified, integrity };
  if (r.roundIndex >= pinned.chainLength) return { verified, integrity: flag({ integrity }, `round ${r.roundIndex} is beyond chain ${r.chainId}'s ${pinned.chainLength} rounds`) };
  if (pinned.salt === null) return { verified, integrity: flag({ integrity }, `round ${r.roundIndex} was revealed before chain ${r.chainId}'s salt was announced`) };
  // Once something is caught betting is off for good: no need to spend more hashing on this server.
  if (integrity.length > 0) return { verified, integrity };
  const last = verified[r.chainId];
  // Round i reveals seed_(i+1); seed_i = SHA-256(seed_(i+1)), and seed_0 is the terminal hash.
  let linked: boolean;
  if (!last || r.roundIndex > last.round) {
    const [fromRound, fromLink] = last ? [last.round, last.seed] : [-1, pinned.terminalHash];
    const steps = r.roundIndex - fromRound;
    linked = steps <= Math.min(MAX_LINK_STEPS, pinned.chainLength) && hashTimes(r.serverSeed, steps) === fromLink;
    if (linked) verified = { ...verified, [r.chainId]: { round: r.roundIndex, seed: r.serverSeed } };
  } else {
    // Every round is revealed once: one this browser already verified, revealed again, is a replay.
    return { verified, integrity: flag({ integrity }, `round ${r.roundIndex} of chain ${r.chainId} was revealed again`) };
  }
  if (!linked) integrity = flag({ integrity }, `round ${r.roundIndex}'s seed doesn't hash back to chain ${r.chainId}'s commitment`);
  else if (pinned.salt !== null && free.crashFromSeed(r.serverSeed, pinned.salt, pinned.houseEdgeBps) !== r.crashX100) {
    integrity = flag({ integrity }, `round ${r.roundIndex}'s crash point doesn't follow from its seed`);
  }
  return { verified, integrity };
}

/** A live reveal: checked against the chain, then against round order, one after the other. */
function revealed(state: RoomState, r: RoundResult, now: number): Pick<RoomState, 'verified' | 'integrity' | 'sequence' | 'baselines'> {
  const checked = checkReveal(state, r);
  const verifiedNow = checked.verified[r.chainId]?.round === r.roundIndex && state.verified[r.chainId]?.round !== r.roundIndex;
  return {
    ...checked,
    ...sequenceCrash({ ...state, integrity: checked.integrity }, r, now),
    baselines: verifiedNow ? { ...state.baselines, [r.chainId]: { last: r.roundIndex, at: now } } : state.baselines,
  };
}

/**
 * Chains only move forward: a room announcing an older chain than one it already announced is replaying it.
 * A room must also announce a curve this client can run: without one, nothing it shows about a round (the
 * climb, a manual cashout's multiplier) can be checked, so betting is off.
 */
function noteChain(state: RoomState, room: RoomInfo): Pick<RoomState, 'highestChain' | 'integrity'> {
  const integrity = free.validCurve(room.curve) ? state.integrity : flag(state, `the room announced a multiplier curve this client can't run`);
  if (!Number.isSafeInteger(room.chainId) || room.chainId < 0) return { highestChain: state.highestChain, integrity };
  if (room.chainId < state.highestChain) return { highestChain: state.highestChain, integrity: flag({ integrity }, `the room went back to chain ${room.chainId} after announcing chain ${state.highestChain}`) };
  return { highestChain: room.chainId, integrity };
}

/** Whether two curves run the same: the same kind at the same rate. */
function sameCurve(a: free.Curve, b: free.Curve): boolean {
  return a.kind === b.kind && a.growthRatePerMs === b.growthRatePerMs;
}

/**
 * Round order on this connection: the server knows every crash point of a salted chain in advance,
 * so what keeps it from choosing outcomes is playing the rounds in order, every one of them, in the open. Each
 * round must follow the last, each must be revealed before the next is announced, and a chain must be played
 * to its end before round 0 of the next.
 */
function sequenceBetting(state: RoomState, roundIndex: number, now: number): Pick<RoomState, 'sequence' | 'integrity' | 'gaps'> {
  const chainId = state.room?.chainId;
  let integrity = state.integrity;
  if (chainId === undefined || !Number.isSafeInteger(chainId) || chainId < 0 || !Number.isSafeInteger(roundIndex)) return { sequence: state.sequence, integrity, gaps: state.gaps };
  integrity = flag({ integrity }, ...boundsProblems(state, chainId, roundIndex));
  const seq = state.sequence;
  // The first round on this connection (or on a new chain): measured against what this browser saw before.
  const gaps = !seq || seq.chainId !== chainId ? recordGap(state, chainId, roundIndex, now).gaps : state.gaps;
  if (seq) {
    if (seq.announced !== null && seq.revealed !== seq.announced) integrity = flag({ integrity }, `round ${seq.announced} of chain ${seq.chainId} was never revealed`);
    if (seq.chainId === chainId) {
      const last = seq.revealed ?? seq.announced;
      if (last !== null && roundIndex !== last + 1) {
        integrity = flag({ integrity }, roundIndex <= last ? `round ${roundIndex} of chain ${chainId} was announced again` : `rounds ${last + 1} to ${roundIndex - 1} of chain ${chainId} were skipped`);
      }
    } else {
      const length = state.chains[seq.chainId]?.chainLength;
      if (length !== undefined && seq.revealed !== length - 1) integrity = flag({ integrity }, `chain ${seq.chainId} was left after round ${seq.revealed ?? 'none'} of its ${length}`);
      if (roundIndex !== 0) integrity = flag({ integrity }, `chain ${chainId} started at round ${roundIndex}, not round 0`);
    }
  }
  return { sequence: { chainId, announced: roundIndex, revealed: null, at: now }, integrity, gaps };
}

/**
 * What no announced round may be: past its chain's committed length (it has no committed outcome),
 * or at or below a round this browser already saw revealed for the chain (a replay, across reconnects too).
 */
function boundsProblems(state: RoomState, chainId: number, roundIndex: number): string[] {
  const pinned = state.chains[chainId];
  const last = state.verified[chainId];
  if (pinned && roundIndex >= pinned.chainLength) return [`round ${roundIndex} is beyond chain ${chainId}'s ${pinned.chainLength} rounds`];
  if (last && roundIndex <= last.round) return [`round ${roundIndex} of chain ${chainId} was announced again`];
  return [];
}

/**
 * The first round a connection sees, measured against the chain's baseline (the last round this browser verified,
 * on any connection or visit): a jump is recorded, to be judged against the chain's anchored pace.
 */
function recordGap(state: RoomState, chainId: number, roundIndex: number, now: number): Pick<RoomState, 'gaps'> {
  const base = state.baselines[chainId];
  if (!base || roundIndex <= base.last + 1) return { gaps: state.gaps };
  return { gaps: [...state.gaps, { chainId, from: base.last, to: roundIndex, elapsedMs: now - base.at }].slice(-20) };
}

function sequenceCrash(state: RoomState, r: RoundResult, now: number): Pick<RoomState, 'sequence' | 'integrity'> {
  const seq = state.sequence;
  if (!seq) return { sequence: Number.isSafeInteger(r.chainId) ? { chainId: r.chainId, announced: r.roundIndex, revealed: r.roundIndex, at: now } : null, integrity: state.integrity };
  let integrity = state.integrity;
  if (seq.chainId !== r.chainId || seq.announced !== r.roundIndex) {
    integrity = flag({ integrity }, `round ${r.roundIndex} of chain ${r.chainId} was revealed while round ${seq.announced ?? 'none'} of chain ${seq.chainId} was in play`);
  }
  return { sequence: { ...seq, revealed: r.roundIndex, at: now }, integrity };
}

/** Folds a changed commitment or an out-of-sequence announcement into the integrity list. */
function noteIntegrity(before: RoomState, after: RoomState): RoomState {
  let integrity = after.integrity;
  for (const [id, chain] of Object.entries(after.chains)) if (chain.changed && !before.chains[Number(id)]?.changed) integrity = flag({ integrity }, `the room changed chain ${id}'s commitment after announcing it`);
  for (const key of Object.keys(after.brokenAnnouncements)) {
    if (!before.brokenAnnouncements[key]) integrity = flag({ integrity }, `round ${key.split(':')[1]}'s hash was announced out of sequence`);
  }
  return integrity === after.integrity ? after : { ...after, integrity };
}

const RECENT = 20;
const ANNOUNCED = 50;
/** More players than a room admits and queues together (256 bettors and four times that in the queue). */
const MAX_PLAYERS = 2_000;

/** Lists a bet: in the place of the player's earlier entry, or after everyone listed. */
function listPlayer(players: RoomPlayer[], player: RoomPlayer): RoomPlayer[] {
  const at = players.findIndex((p) => p.key === player.key);
  if (at === -1) return players.length < MAX_PLAYERS ? [...players, player] : players;
  return players.map((p, i) => (i === at ? player : p));
}

function bounded<T>(record: Record<string, T>): Record<string, T> {
  const keys = Object.keys(record);
  for (const key of keys.slice(0, Math.max(0, keys.length - ANNOUNCED))) delete record[key];
  return record;
}

/**
 * Records a round's announced hash, and whether it continues the chain as far as this client can tell:
 * it must be the seed this client saw the previous round reveal (the terminal hash before round 0). The
 * first announcement stands; a different one for the same round (say after a forced reconnect) is flagged,
 * never adopted.
 */
function announce(state: RoomState, chainId: number | undefined, roundIndex: number, hash: string | null | undefined): Pick<RoomState, 'announced' | 'brokenAnnouncements'> {
  if (chainId === undefined || chainId < 0 || !hash) return { announced: state.announced, brokenAnnouncements: state.brokenAnnouncements };
  const key = `${chainId}:${roundIndex}`;
  const pinned = state.chains[chainId];
  const expected = roundIndex === 0 ? (pinned?.terminalHash ?? null) : (state.revealed[`${chainId}:${roundIndex - 1}`] ?? null);
  const first = state.announced[key];
  let broken = (expected !== null && expected !== hash) || (first !== undefined && first !== hash);
  // Nothing revealed just before it (a fresh connection): it must still hash back to the chain, to the last seed
  // this client verified or to the terminal hash, so the round about to take bets is one of the committed chain's.
  // Skipped once something is caught (betting is off anyway).
  if (!broken && expected === null && pinned && state.integrity.length === 0) {
    const last = state.verified[chainId];
    const [fromRound, fromLink] = last && last.round < roundIndex ? [last.round, last.seed] : [-1, pinned.terminalHash];
    const steps = roundIndex - 1 - fromRound;
    broken = roundIndex >= pinned.chainLength || steps > pinned.chainLength || hashTimes(hash, steps) !== fromLink;
  }
  return {
    announced: first !== undefined ? state.announced : bounded({ ...state.announced, [key]: hash }),
    brokenAnnouncements: broken ? bounded({ ...state.brokenAnnouncements, [key]: true as const }) : state.brokenAnnouncements,
  };
}

/** Pins a chain's commitment the first time it is seen; a later, different one is flagged, not adopted. */
function pinChain(chains: RoomState['chains'], room: RoomInfo): RoomState['chains'] {
  if (room.chainId < 0) return chains;
  const pinned = chains[room.chainId];
  const announced = free.validCurve(room.curve) ? room.curve : null;
  if (!pinned) {
    return {
      ...chains,
      [room.chainId]: { terminalHash: room.terminalHash, houseEdgeBps: room.houseEdgeBps, curve: announced, salt: room.salt, chainLength: room.chainLength, saltSlot: room.saltSlot, anchorSignature: room.anchorSignature ?? null, anchorKey: room.anchorKey ?? null, changed: false },
    };
  }
  // The curve is fixed with the chain: a room changing it mid-chain would draw one climb and settle manual cashouts on another.
  const changed =
    pinned.changed ||
    pinned.terminalHash !== room.terminalHash ||
    pinned.houseEdgeBps !== room.houseEdgeBps ||
    pinned.chainLength !== room.chainLength ||
    pinned.saltSlot !== room.saltSlot ||
    pinned.anchorSignature !== (room.anchorSignature ?? null) ||
    (pinned.anchorKey !== undefined && pinned.anchorKey !== (room.anchorKey ?? null)) ||
    (pinned.curve !== null && announced !== null && !sameCurve(pinned.curve, announced)) ||
    (pinned.salt !== null && room.salt !== null && pinned.salt !== room.salt);
  const curve = pinned.curve ?? announced;
  const salt = pinned.salt ?? room.salt;
  const anchorKey = pinned.anchorKey === undefined ? room.anchorKey ?? null : pinned.anchorKey;
  if (changed === pinned.changed && salt === pinned.salt && anchorKey === pinned.anchorKey && curve === pinned.curve) return chains;
  return { ...chains, [room.chainId]: { ...pinned, salt, anchorKey, curve, changed } };
}

/** What to check a revealed round against, from what this client saw before the reveal. */
export interface RoundReference {
  /** The hash the seed must hash to, or null when this client has nothing independent to compare with. */
  expectedHash: string | null;
  source: 'announced' | 'previous' | 'terminal' | null;
  /** The chain's committed salt and edge as this client first saw them; null if it never saw this chain. */
  salt: string | null;
  houseEdgeBps: number | null;
  /** The announced hash didn't continue the chain: the seed was chosen after the previous reveal. */
  announcementBroken: boolean;
  /** The room later showed a different commitment for this chain than it first did. */
  chainChanged: boolean;
  /** The chain's terminal hash as first seen: seed_i hashed i times must give it. */
  terminalHash: string | null;
}

export function roundReference(state: RoomState, result: RoundResult): RoundReference {
  const key = `${result.chainId}:${result.roundIndex}`;
  const pinned = state.chains[result.chainId];
  const base = {
    salt: pinned?.salt ?? null,
    houseEdgeBps: pinned?.houseEdgeBps ?? null,
    announcementBroken: state.brokenAnnouncements[key] === true,
    chainChanged: pinned?.changed === true,
    terminalHash: pinned?.terminalHash ?? null,
  };
  const announced = state.announced[key];
  if (announced) return { expectedHash: announced, source: 'announced', ...base };
  // Seeds are revealed in reverse chain order: this seed must hash to the previous round's revealed seed,
  // but only a reveal this client saw live counts (a connect snapshot could be made up whole).
  const previousSeed = state.revealed[`${result.chainId}:${result.roundIndex - 1}`];
  if (previousSeed) return { expectedHash: previousSeed, source: 'previous', ...base };
  if (result.roundIndex === 0 && pinned) return { expectedHash: pinned.terminalHash, source: 'terminal', ...base };
  return { expectedHash: null, source: null, ...base };
}

/**
 * `now` is when the frame counts as having arrived; `fresh` is false when the page handled it late (a frozen tab
 * catching up), so timing checks skip it.
 */
export function applyMessage(state: RoomState, msg: ServerMessage, now: number = Date.now(), fresh = true): RoomState {
  const next = noteIntegrity(state, fold(state, msg, now, fresh));
  return next.gaps !== state.gaps && next.gaps.length ? { ...next, ...judgeGaps(next, now) } : next;
}

function fold(state: RoomState, msg: ServerMessage, now: number, fresh: boolean): RoomState {
  switch (msg.type) {
    case 'state': {
      // A (re)connect: round order restarts from what the snapshot shows as in play, or as just crashed when the
      // newest result says which chain that round was of (after a rollover it may be the previous chain's).
      const live = (msg.round.phase === 'betting' || msg.round.phase === 'running') && msg.round.roundIndex !== null;
      const newest = msg.recent[0];
      const justCrashed = msg.round.phase === 'crashed' && newest !== undefined && newest.chainId === msg.room.chainId && newest.roundIndex === msg.round.roundIndex;
      const chains = pinChain(state.chains, msg.room);
      const noted = noteChain(state, msg.room);
      const current = live ? msg.round.roundIndex : justCrashed ? newest.roundIndex : null;
      const validChain = Number.isSafeInteger(msg.room.chainId) && msg.room.chainId >= 0;
      const problems = live && validChain ? boundsProblems({ ...state, chains }, msg.room.chainId, msg.round.roundIndex!) : [];
      const gaps = current !== null && validChain ? recordGap(state, msg.room.chainId, current, now).gaps : state.gaps;
      const next: RoomState = {
        ...state,
        room: msg.room,
        round: msg.round,
        recent: msg.recent.slice(0, RECENT),
        players: Array.isArray(msg.players) ? msg.players.slice(0, MAX_PLAYERS) : [],
        you: msg.you,
        clockOffsetMs: msg.round.serverTime - now,
        chains,
        ...noted,
        integrity: flag(noted, ...problems),
        gaps,
        sequence: live
          ? { chainId: msg.room.chainId, announced: msg.round.roundIndex, revealed: null, at: now }
          : justCrashed
            ? { chainId: msg.room.chainId, announced: newest.roundIndex, revealed: newest.roundIndex, at: now }
            : null,
      };
      return live ? { ...next, ...announce(next, msg.room.chainId, msg.round.roundIndex!, msg.round.serverSeedHash) } : next;
    }
    case 'room': {
      const noted = noteChain(state, msg.room);
      const seq = state.sequence;
      // A chain switch while a round is taking bets: the page would show one chain's checks for another's round.
      const switched = seq && seq.announced !== null && seq.revealed !== seq.announced && msg.room.chainId !== seq.chainId;
      return {
        ...state,
        room: msg.room,
        chains: pinChain(state.chains, msg.room),
        ...noted,
        integrity: switched ? flag(noted, `the room switched to chain ${msg.room.chainId} while round ${seq.announced} of chain ${seq.chainId} was in play`) : noted.integrity,
      };
    }
    case 'round.betting':
      return {
        ...state,
        lastBet: null,
        // The last round's bettors leave the list; the queued players stay and are admitted by their own frames.
        players: state.players.filter((p) => p.status === 'queued'),
        ...announce(state, state.room?.chainId, msg.roundIndex, msg.serverSeedHash),
        ...sequenceBetting(state, msg.roundIndex, now),
        round: {
          ...(state.round ?? { admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, serverTime: now }),
          roundIndex: msg.roundIndex,
          phase: 'betting',
          bettingClosesAt: msg.bettingClosesAt,
          runningSince: null,
          multiplierX100: 100,
          crashX100: null,
          serverSeedHash: msg.serverSeedHash,
        } as PublicRoundState,
      };
    case 'round.locked': {
      if (!state.round) return state;
      // Betting closed well before the time the room announced: the server knows the crash point and
      // could shut out late bets. Judged on this page's clock, only for frames it handled on time.
      const closes = state.round.bettingClosesAt;
      const early = fresh && closes !== null && state.round.roundIndex === msg.roundIndex && now + state.clockOffsetMs < closes - 2_000;
      return {
        ...state,
        round: { ...state.round, phase: 'running', runningSince: msg.runningSince, admitted: msg.admitted, rally: msg.rally },
        integrity: early ? flag(state, `round ${msg.roundIndex} closed betting ${Math.round((closes! - now - state.clockOffsetMs) / 1000)}s before the time it announced`) : state.integrity,
      };
    }
    case 'tick':
      return state.round && state.round.roundIndex === msg.roundIndex ? { ...state, round: { ...state.round, multiplierX100: msg.multiplierX100 } } : state;
    case 'round.crashed':
      return {
        ...state,
        round: state.round ? { ...state.round, phase: 'crashed', crashX100: msg.result.crashX100, multiplierX100: msg.result.crashX100 } : state.round,
        recent: [msg.result, ...state.recent.filter((r) => r.roundIndex !== msg.result.roundIndex || r.chainId !== msg.result.chainId)].slice(0, RECENT),
        revealed: bounded({ ...state.revealed, [`${msg.result.chainId}:${msg.result.roundIndex}`]: msg.result.serverSeed }),
        ...revealed(state, msg.result, now),
      };
    case 'you':
      return { ...state, you: msg.you };
    case 'bet.result':
      return { ...state, lastBet: msg.status === 'cancelled' ? null : msg.status, lastError: null };
    case 'error':
      return { ...state, lastError: { code: msg.code, message: msg.message } };
    case 'pong':
      return { ...state, clockOffsetMs: msg.serverTime - now };
    case 'player.bet':
      return { ...state, players: listPlayer(state.players, msg.player) };
    case 'player.left':
      return { ...state, players: state.players.filter((p) => p.key !== msg.key) };
    case 'cashout':
      return state.players.some((p) => p.key === msg.player && p.status === 'active')
        ? { ...state, players: state.players.map((p) => (p.key === msg.player && p.status === 'active' ? { ...p, cashoutX100: msg.targetX100, payout: msg.payout } : p)) }
        : state;
  }
}

/** Where a listed bet stands, from its entry and the round it is in. */
export type PlayerOutcome = 'queued' | 'placed' | 'riding' | 'won' | 'lost';

export function playerOutcome(player: RoomPlayer, round: Pick<PublicRoundState, 'phase'> | null): PlayerOutcome {
  if (player.status === 'queued') return 'queued';
  if (player.cashoutX100 !== null) return 'won';
  if (round?.phase === 'crashed') return 'lost';
  return round?.phase === 'running' ? 'riding' : 'placed';
}

export const ROOM_ERRORS: Record<ErrorCode, string> = {
  room_not_open: 'The room is not open yet.',
  betting_closed: 'Betting has closed for this round.',
  invalid_stake: 'That stake is not allowed.',
  invalid_target: 'Pick a cash-out target between the limits.',
  already_bet: 'You already have a bet this round.',
  no_bet: 'You have no bet to cancel.',
  already_cashed_out: 'This bet has already cashed out.',
  cashout_unavailable: 'Cashout arrived after the crash or the round is not running.',
  no_session: 'Buy a pass to play; you are watching.',
  session_ended: 'Your pass has ended.',
  insufficient_credits: 'Not enough credits.',
  rate_limited: 'Slow down a little.',
  bad_message: 'Something went wrong sending that.',
  server_error: 'The room had a problem. Try again.',
};

/** The subprotocol every room client offers and the game server selects. */
export const ROOM_PROTOCOL = 'crashwif.room.v1';
/** The subprotocol entry that carries a session token: `crashwif.token.<token>`. */
const TOKEN_PROTOCOL_PREFIX = 'crashwif.token.';

/** The room's socket URL. It carries no session token: the token travels in the Sec-WebSocket-Protocol header. */
export function roomSocketUrl(base: string, gameId: string): string {
  const url = new URL('/ws', base.replace(/^http/, 'ws'));
  url.searchParams.set('game', gameId);
  return url.toString();
}

/**
 * The subprotocols a client offers: the room protocol and, when it has one, its session token as
 * `crashwif.token.<token>`. A token is base64url text joined by one dot, so it fits a protocol name;
 * a header entry, unlike a URL, stays out of proxy and access logs.
 */
export function roomSocketProtocols(token: string | null): string[] {
  return token ? [ROOM_PROTOCOL, `${TOKEN_PROTOCOL_PREFIX}${token}`] : [ROOM_PROTOCOL];
}

/** The session token a client offered in its Sec-WebSocket-Protocol header, or null when it spectates. */
export function roomTokenFromProtocols(header: string | undefined): string | null {
  for (const entry of (header ?? '').split(',')) {
    const protocol = entry.trim();
    if (protocol.startsWith(TOKEN_PROTOCOL_PREFIX) && protocol.length > TOKEN_PROTOCOL_PREFIX.length) return protocol.slice(TOKEN_PROTOCOL_PREFIX.length);
  }
  return null;
}

/** A session token, or a function that fetches a fresh one (null to spectate). */
export type TokenSource = string | null | (() => Promise<string | null>);


export const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}x`;
