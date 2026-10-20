/**
 * A live connection to a game-server room, for the platform's pages and for
 * creator-built games alike. The state is folded by the shared reducer
 * (state.ts), and the connection keeps the same checks as the platform page:
 * one snapshot per connection, frames handled late after a frozen tab skip
 * timing checks, a bet refused as late while the room's clock had time left
 * is flagged, and reconnects back off.
 *
 * A player's session token is offered as a subprotocol (`crashwif.token.<token>`,
 * next to `crashwif.room.v1`) in the Sec-WebSocket-Protocol header, never in the
 * URL. Credits have no value; a spectator offers no token.
 */
import { Emitter } from './emitter.js';
import type { ClientMessage, ServerMessage } from './protocol.js';
import { applyMessage, emptyRoomState, roomSocketProtocols, roomSocketUrl, withProblem, type RoomState, type TokenSource } from './state.js';

export type SocketLike = Pick<WebSocket, 'send' | 'close' | 'readyState'> & {
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
};
export type SocketFactory = (url: string, protocols: string[]) => SocketLike;

export interface GameClientOptions {
  /** The game server's base URL (ws://, wss://, http:// or https://). */
  baseUrl: string;
  makeSocket?: SocketFactory;
  now?: () => number;
}

export type GameClientEvents = {
  /** The state after a message was folded (or the connection changed). */
  change: (state: RoomState, message: ServerMessage | null) => void;
  /** Every server frame accepted on the current connection, with when it counts as having arrived. */
  message: (message: ServerMessage, now: number, fresh: boolean) => void;
  connected: () => void;
  disconnected: () => void;
  /** A new problem this client caught the room doing; betting is off from then on. */
  integrity: (problems: string[]) => void;
};

const HEARTBEAT_MS = 1_000;
const LATE_FRAME_MS = 2_500;
const MAX_RETRY_EXPONENT = 6;

export class GameClient extends Emitter<GameClientEvents> {
  private stateValue: RoomState = emptyRoomState();
  private socket: SocketLike | null = null;
  private closed = false;
  private retry = 0;
  private target: { gameId: string; token: TokenSource } | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBeat: number;
  private beat: ReturnType<typeof setInterval> | null = null;
  private lastBetAt: number | null = null;
  private readonly makeSocket: SocketFactory;
  private readonly now: () => number;

  constructor(private readonly options: GameClientOptions) {
    super();
    this.makeSocket = options.makeSocket ?? ((url, protocols) => new WebSocket(url, protocols));
    this.now = options.now ?? (() => Date.now());
    this.lastBeat = this.now();
  }

  get state(): RoomState {
    return this.stateValue;
  }

  get connected(): boolean {
    return this.stateValue.connected;
  }

  /** Whether this client would let a bet through: the room is taking bets and nothing has been caught. */
  get canBet(): boolean {
    const s = this.stateValue;
    return s.connected && s.integrity.length === 0 && s.round?.phase === 'betting' && s.you !== null && !s.you.ended && s.sequence?.chainId === s.room?.chainId;
  }

  connect(gameId: string, token: TokenSource = null): void {
    this.closed = false;
    this.target = { gameId, token };
    this.drop();
    void this.open();
  }

  bet(stake: number, targetX100: number | null): void {
    this.send({ type: 'bet', stake, targetX100 });
  }

  cancel(): void {
    this.send({ type: 'cancel' });
  }

  cashout(): void {
    this.send({ type: 'cashout' });
  }

  ping(): void {
    this.send({ type: 'ping' });
  }

  send(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify(message));
    if (message.type === 'bet') this.lastBetAt = this.now();
  }

  /** Applies a state patch from outside the reducer (the page's own anchor check, evidence from earlier visits). */
  patch(patch: Partial<RoomState>): void {
    this.update({ ...this.stateValue, ...patch }, null);
  }

  close(): void {
    this.closed = true;
    this.drop();
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
    this.target = null;
    if (this.stateValue.connected) this.update({ ...this.stateValue, connected: false }, null);
    this.emit('disconnected');
  }

  private update(next: RoomState, message: ServerMessage | null): void {
    const before = this.stateValue;
    this.stateValue = next;
    this.emit('change', next, message);
    if (next.integrity.length > before.integrity.length) this.emit('integrity', next.integrity);
  }

  private async open(): Promise<void> {
    this.beat ??= setInterval(() => (this.lastBeat = this.now()), HEARTBEAT_MS);
    if (!this.target) return;
    const current = this.target;
    // Tokens are short-lived (15 minutes); a provider fetches a fresh one on every (re)connect.
    const token = typeof current.token === 'function' ? await current.token().catch(() => null) : current.token;
    if (this.closed || this.target !== current) return;
    const socket = this.makeSocket(roomSocketUrl(this.options.baseUrl, current.gameId), roomSocketProtocols(token));
    this.socket = socket;
    // Nothing but errors counts on a socket until its snapshot: a round event racing ahead of it belongs to a
    // room this client hasn't been shown yet.
    let snapshot = false;
    socket.onopen = () => {
      this.retry = 0;
      this.update({ ...this.stateValue, connected: true }, null);
      this.emit('connected');
    };
    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return; // a malformed frame is ignored
      }
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
      let state = this.stateValue;
      if (message.type === 'state') {
        // The server sends one snapshot per connection; another would quietly reset round order.
        if (snapshot) state = { ...state, ...withProblem(state, 'the room sent a second snapshot on one connection') };
        snapshot = true;
      } else if (!snapshot && message.type !== 'error') return;
      const handled = this.now();
      const fresh = handled - this.lastBeat < LATE_FRAME_MS;
      // A bet refused as too late while the room's own clock still had more than a second to go.
      if (message.type === 'error' && message.code === 'betting_closed' && fresh && this.lastBetAt !== null && state.round?.phase === 'betting' && state.round.bettingClosesAt !== null) {
        const margin = state.round.bettingClosesAt - (this.lastBetAt + state.clockOffsetMs);
        if (margin > 1_000) state = { ...state, ...withProblem(state, `the room refused a bet as too late with ${Math.round(margin / 1000)}s of betting left`) };
      }
      const now = fresh ? handled : this.lastBeat;
      this.emit('message', message, now, fresh);
      this.update(applyMessage(state, message, now, fresh), message);
    };
    socket.onclose = () => {
      if (this.stateValue.connected) this.update({ ...this.stateValue, connected: false }, null);
      this.emit('disconnected');
      if (this.closed) return;
      this.retry = Math.min(this.retry + 1, MAX_RETRY_EXPONENT);
      this.retryTimer = setTimeout(() => void this.open(), 500 * 2 ** this.retry);
    };
  }

  /** Closes the current socket without a reconnect. */
  private drop(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      try {
        this.socket.close();
      } catch {
        // already closed
      }
      this.socket = null;
    }
  }
}
