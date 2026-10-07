/**
 * Wire protocol between the game server and everything that plays or watches
 * a room: the platform's player page and overlay, creator-built games through
 * the SDK, and the emulator. Types only.
 *
 * Credits have no value. Product rooms grant them through passes; marked
 * devnet test rooms can use operator-issued mock sessions.
 * Multipliers and targets are integers in hundredths (x100): 250 = 2.50x.
 */
import type { free } from '@crashwif/crash-math';

export type RoomStatus = 'waiting_salt' | 'open' | 'paused' | 'stopped';
export type RoundPhase = 'waiting' | 'betting' | 'running' | 'crashed';

export interface RoomInfo {
  gameId: string;
  status: RoomStatus;
  chainId: number;
  /** seed_0 of the committed chain, published before its first round. */
  terminalHash: string;
  chainLength: number;
  /** Future slot whose blockhash (the first finalized block at or after it) salts every crash point of this chain. */
  saltSlot: number;
  /** The blockhash salt, once that slot is finalized. */
  salt: string | null;
  houseEdgeBps: number;
  /**
   * The multiplier curve this chain's rounds run on: how fast the multiplier climbs, and so when each
   * crash point is reached and what a manual cashout pays. Fixed with the chain. A game draws the curve
   * from here (`free.multiplierAtX100(elapsed, room.curve)`) and never carries a pace of its own.
   */
  curve: free.Curve;
  /** The Solana transaction that committed this chain before its salt slot; players' pages check it before betting. */
  anchorSignature: string | null;
  /** The key that signed this chain; a verifier accepts it only from its published key list. */
  anchorKey?: string | null;
  bettingMs: number;
  maxBettorsPerRound: number;
  minTargetX100: number;
  maxTargetX100: number;
}

export interface RallyState {
  active: boolean;
  bettors: number;
  percent: number;
}

export interface PublicRoundState {
  roundIndex: number | null;
  phase: RoundPhase;
  bettingClosesAt: number | null;
  runningSince: number | null;
  multiplierX100: number;
  admitted: number;
  queued: number;
  rally: RallyState;
  crashX100: number | null;
  /** SHA-256 of this round's seed (the previous chain link), shown before the round. */
  serverSeedHash: string | null;
  serverTime: number;
}

export interface RoundResult {
  roundIndex: number;
  chainId: number;
  crashX100: number;
  serverSeed: string;
  serverSeedHash: string;
  salt: string;
  houseEdgeBps: number;
  rally: RallyState;
  bettors: number;
  winners: number;
}

/**
 * A bettor as the whole room sees them: who is in the round, what they staked and where
 * their bet stands. Keyed by the pass session's player key, so one player's bets can be
 * followed round after round without the session id itself ever leaving the server.
 */
export interface RoomPlayer {
  /** The pass session's player key: SHA-256 of the session id, first 16 hex characters. */
  key: string;
  /** The player's ranking name, or null when they have none or hid it. */
  handle: string | null;
  stake: number;
  targetX100: number | null;
  /** The exit the room accepted (the auto target reached, or a manual cashout); null while the bet rides or once it lost. */
  cashoutX100: number | null;
  /** The credits the cashout paid; null until one is accepted. */
  payout: number | null;
  /** `queued`: waiting for the next round behind the bettor cap. */
  status: 'active' | 'queued';
}

export interface YouState {
  sessionId: string;
  /** The key this session's bets carry in the room's player list. */
  playerKey: string;
  creditsLeft: number;
  roundsLeft: number;
  /** When the session expires, in epoch milliseconds. */
  expiresAt: number;
  /** The saved clock position while the room is paused, in epoch milliseconds. */
  pausedAt?: number | null;
  ended: boolean;
  endReason: string | null;
  bet: { stake: number; targetX100: number | null; cashoutX100: number | null; status: 'active' | 'queued' } | null;
}

export type ErrorCode =
  | 'room_not_open'
  | 'betting_closed'
  | 'invalid_stake'
  | 'invalid_target'
  | 'already_bet'
  | 'no_bet'
  | 'already_cashed_out'
  | 'cashout_unavailable'
  | 'no_session'
  | 'session_ended'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'bad_message'
  | 'server_error';

export type ServerMessage =
  | { type: 'state'; room: RoomInfo; round: PublicRoundState; recent: RoundResult[]; players: RoomPlayer[]; you: YouState | null }
  | { type: 'room'; room: RoomInfo }
  | { type: 'round.betting'; roundIndex: number; serverSeedHash: string; bettingClosesAt: number }
  /** A bet accepted into the round, or queued for the next one; a player already listed is replaced. */
  | { type: 'player.bet'; player: RoomPlayer }
  /** A listed bet cancelled, or a queued one dropped. */
  | { type: 'player.left'; key: string }
  | { type: 'round.locked'; roundIndex: number; runningSince: number; admitted: number; rally: RallyState }
  | { type: 'tick'; roundIndex: number; multiplierX100: number; elapsedMs: number }
  /** `player` is the key of the bet cashed out; `mine` says whether it is this socket's own. */
  | { type: 'cashout'; roundIndex: number; targetX100: number; payout: number; player: string; mine: boolean }
  | { type: 'round.crashed'; result: RoundResult }
  | { type: 'you'; you: YouState }
  /** The answer to `bet` (`accepted` into the round, or `queued` for the next) and to `cancel` (`cancelled`). */
  | { type: 'bet.result'; ok: true; status: 'accepted' | 'queued' | 'cancelled' }
  | { type: 'error'; code: ErrorCode; message?: string }
  | { type: 'pong'; serverTime: number };

export type ClientMessage =
  | { type: 'bet'; stake: number; targetX100: number | null }
  | { type: 'cancel' }
  | { type: 'cashout' }
  | { type: 'ping' };
