/**
 * Wire protocol between the game server and everything that plays or watches
 * a room: the platform's player page and overlay, creator-built games through
 * the SDK, and the emulator. Types only.
 *
 * Credits have no value. Product rooms grant them through passes; marked
 * devnet test rooms can use operator-issued mock sessions.
 * Multipliers and targets are integers in hundredths (x100): 250 = 2.50x.
 */

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
  /** The Solana transaction that committed this chain before its salt slot; players' pages check it before betting. */
  anchorSignature: string | null;
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

export interface YouState {
  sessionId: string;
  creditsLeft: number;
  roundsLeft: number;
  expiresAt: number;
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
  | { type: 'state'; room: RoomInfo; round: PublicRoundState; recent: RoundResult[]; you: YouState | null }
  | { type: 'room'; room: RoomInfo }
  | { type: 'round.betting'; roundIndex: number; serverSeedHash: string; bettingClosesAt: number }
  | { type: 'round.locked'; roundIndex: number; runningSince: number; admitted: number; rally: RallyState }
  | { type: 'tick'; roundIndex: number; multiplierX100: number; elapsedMs: number }
  | { type: 'cashout'; roundIndex: number; targetX100: number; payout: number; mine: boolean }
  | { type: 'round.crashed'; result: RoundResult }
  | { type: 'you'; you: YouState }
  | { type: 'bet.result'; ok: true; status: 'accepted' | 'queued' }
  | { type: 'error'; code: ErrorCode; message?: string }
  | { type: 'pong'; serverTime: number };

export type ClientMessage =
  | { type: 'bet'; stake: number; targetX100: number | null }
  | { type: 'cancel' }
  | { type: 'cashout' }
  | { type: 'ping' };
