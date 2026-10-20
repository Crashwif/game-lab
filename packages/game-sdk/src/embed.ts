/**
 * The bridge between the platform page (the host) and a creator's custom
 * renderer running in a sandboxed iframe (the game). The host owns the socket,
 * the session token and the decision whether betting is allowed; the game
 * sees the same server frames the host does, folds them with the shared
 * reducer, and can ask the host to place, cancel or cash out a bet. Nothing the
 * game does can reach the room directly, and neither the token nor the
 * player's session id ever enters it.
 *
 * Every message is tagged with the protocol name and checked against the
 * other side's origin. The host pings a ready game and the SDK answers, so a
 * frame whose script has hung can be told from one that is merely quiet.
 * Liveness is counted in pings, never in wall-clock time: a host tab that is
 * throttled or suspended sends fewer pings or none, so it cannot time a game
 * out.
 */
import type { ClientMessage, ServerMessage, YouState } from './protocol.js';
import { applyMessage, emptyRoomState, type RoomState } from './state.js';
import { Emitter } from './emitter.js';

export const EMBED_PROTOCOL = 'crashwif-game-embed:v1';

/**
 * `reason` says why the host is not taking the game's bets (null while it is); `maxStake` is the most credits one
 * bet from the game may stake, set by the player on the host's own controls, or null for no bound.
 */
export type HostToGame =
  | { proto: typeof EMBED_PROTOCOL; type: 'init'; manifest: unknown; state: RoomState; allowBets: boolean; reason: string | null; maxStake: number | null }
  | { proto: typeof EMBED_PROTOCOL; type: 'server'; message: ServerMessage; now: number; fresh: boolean }
  | { proto: typeof EMBED_PROTOCOL; type: 'allow'; allowBets: boolean; reason: string | null; maxStake: number | null }
  | { proto: typeof EMBED_PROTOCOL; type: 'refused'; message: ClientMessage; reason: string }
  | { proto: typeof EMBED_PROTOCOL; type: 'ping'; at: number };

/** `pongs` in the ready message declares that the game answers pings, so the host watches it from the start. */
export type GameToHost =
  | { proto: typeof EMBED_PROTOCOL; type: 'ready'; pongs?: true }
  | { proto: typeof EMBED_PROTOCOL; type: 'client'; message: ClientMessage }
  | { proto: typeof EMBED_PROTOCOL; type: 'resize'; height: number }
  | { proto: typeof EMBED_PROTOCOL; type: 'pong'; at: number };

/** How one side sends to the other and hears from it; the defaults use postMessage with an origin check. */
export interface Transport<Out, In> {
  send(message: Out): void;
  listen(handler: (message: In) => void): () => void;
}

function tagged(value: unknown): value is { proto: string; type: string } {
  return !!value && typeof value === 'object' && (value as { proto?: unknown }).proto === EMBED_PROTOCOL && typeof (value as { type?: unknown }).type === 'string';
}

/**
 * A postMessage transport to `target` at `origin`, hearing only frames from that origin and, when `from` is
 * given, only from that window. A sandboxed game frame has an opaque origin ("null"), so both sides then use
 * '*' for the origin and rely on the window check: the host hears only its own frame, the game only its parent.
 */
export function windowTransport<Out, In>(target: Window, origin: string, own: Window, from?: () => Window | null): Transport<Out, In> {
  if (origin === '*' && !from) throw new Error("a transport to any origin needs a window to listen to ('from')");
  return {
    send: (message) => target.postMessage(message, origin),
    listen: (handler) => {
      const onMessage = (event: MessageEvent) => {
        if (origin !== '*' && event.origin !== origin) return;
        if (from && event.source !== from()) return;
        if (!tagged(event.data)) return;
        handler(event.data as In);
      };
      own.addEventListener('message', onMessage);
      return () => own.removeEventListener('message', onMessage);
    },
  };
}

export interface HostSource {
  state: RoomState;
  on(event: 'message', handler: (message: ServerMessage, now: number, fresh: boolean) => void): () => void;
  send(message: ClientMessage): void;
}

export interface HostOptions {
  transport: Transport<HostToGame, GameToHost>;
  client: HostSource;
  manifest: unknown;
  /**
   * Whether the host lets the game bet right now (the page's anchor and integrity verdict, and whether the player
   * holds a live session); refusals are explained. `maxStake` bounds a bet from the game to what the player set on
   * the host's own controls: a larger stake is refused and never reaches the room.
   */
  allowBets: () => { allowed: boolean; reason: string | null; maxStake?: number | null };
  /** A bet, cancel or cashout from the game that the host refused, with the reason the game was given. */
  onRefused?: (message: ClientMessage, reason: string) => void;
  onResize?: (height: number) => void;
  /** A game may ask for at most this many bets per second; more are dropped. */
  maxIntentsPerSecond?: number;
  /** How often a ready game is pinged; 5 s by default. */
  pingIntervalMs?: number;
  /** A watched game that leaves this many pings in a row unanswered is reported through `onUnresponsive`; 3 by default. */
  unansweredPings?: number;
  /**
   * Called once when a watched game stops answering; the host decides what becomes of the frame. A game is watched
   * once it declares `pongs` in its ready message or answers a ping; one that does neither is never reported.
   */
  onUnresponsive?: () => void;
}

/** The game has no use for the player's session id, so the host blanks it in everything it forwards. */
function withoutSessionId(you: YouState): YouState {
  return { ...you, sessionId: '' };
}

function redactState(state: RoomState): RoomState {
  return { ...state, you: state.you && withoutSessionId(state.you) };
}

function redactMessage(message: ServerMessage): ServerMessage {
  if (message.type === 'state') return { ...message, you: message.you && withoutSessionId(message.you) };
  if (message.type === 'you') return { ...message, you: withoutSessionId(message.you) };
  return message;
}

/**
 * Hosts a game frame: forwards server frames after the game says it's ready, relays its bet intents when allowed,
 * and pings it so a frame that has stopped answering can be told apart from one that has nothing to say.
 *
 * Every message from the game resets its count of unanswered pings, and only a ping the host sends advances it.
 * A tick that finds a watched game at `unansweredPings` reports it instead of pinging again, and pinging stops.
 * A host whose timers are throttled or suspended sends fewer pings or none, so its game is never timed out by
 * the wait itself: after a long suspension the first tick sends one ping, and its answer resets the count.
 */
export function hostGame(options: HostOptions): { close(): void; setAllowed(): void } {
  const { transport, client } = options;
  let ready = false;
  let lastAllowed: boolean | null = null;
  let lastReason: string | null = null;
  let lastMaxStake: number | null = null;
  const intents: number[] = [];
  const perSecond = options.maxIntentsPerSecond ?? 5;
  const pingEvery = options.pingIntervalMs ?? 5_000;
  const unansweredLimit = options.unansweredPings ?? 3;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  /** Set once the game is reported or the host closes; pinging never starts again. */
  let stopped = false;
  /** Whether the game answers pings: it said so when ready, or it has answered one. */
  let watched = false;
  /** Pings sent since the game's last message. */
  let unanswered = 0;
  const stopPinging = () => {
    clearInterval(pingTimer);
    pingTimer = undefined;
  };
  const tick = () => {
    if (watched && unanswered >= unansweredLimit) {
      stopPinging();
      stopped = true;
      options.onUnresponsive?.();
      return;
    }
    unanswered += 1;
    transport.send({ proto: EMBED_PROTOCOL, type: 'ping', at: Date.now() });
  };
  const publishAllowed = () => {
    const verdict = options.allowBets();
    const maxStake = verdict.maxStake ?? null;
    if (verdict.allowed === lastAllowed && verdict.reason === lastReason && maxStake === lastMaxStake) return;
    lastAllowed = verdict.allowed;
    lastReason = verdict.reason;
    lastMaxStake = maxStake;
    if (ready) transport.send({ proto: EMBED_PROTOCOL, type: 'allow', allowBets: verdict.allowed, reason: verdict.reason, maxStake });
  };
  const refuse = (intent: ClientMessage, reason: string) => {
    transport.send({ proto: EMBED_PROTOCOL, type: 'refused', message: intent, reason });
    options.onRefused?.(intent, reason);
  };
  const stopListening = transport.listen((message) => {
    unanswered = 0;
    if (message.type === 'pong') {
      watched = true;
      return;
    }
    if (message.type === 'ready') {
      ready = true;
      if (message.pongs === true) watched = true;
      const verdict = options.allowBets();
      lastAllowed = verdict.allowed;
      lastReason = verdict.reason;
      lastMaxStake = verdict.maxStake ?? null;
      transport.send({ proto: EMBED_PROTOCOL, type: 'init', manifest: options.manifest, state: redactState(client.state), allowBets: verdict.allowed, reason: verdict.reason, maxStake: lastMaxStake });
      if (pingTimer === undefined && !stopped) pingTimer = setInterval(tick, pingEvery);
      return;
    }
    if (message.type === 'resize') {
      if (typeof message.height === 'number' && message.height > 0 && message.height < 10_000) options.onResize?.(message.height);
      return;
    }
    if (message.type === 'client') {
      const intent = message.message;
      if (!intent || (intent.type !== 'bet' && intent.type !== 'cancel' && intent.type !== 'cashout' && intent.type !== 'ping')) return;
      if (intent.type === 'ping') return; // the host keeps the socket alive itself
      const now = Date.now();
      while (intents.length && now - intents[0]! > 1_000) intents.shift();
      if (intents.length >= perSecond) return;
      intents.push(now);
      if (intent.type === 'bet') {
        const verdict = options.allowBets();
        if (!verdict.allowed) {
          refuse(intent, verdict.reason ?? 'betting is off');
          return;
        }
        if (!Number.isSafeInteger(intent.stake) || (intent.targetX100 !== null && (!Number.isSafeInteger(intent.targetX100) || intent.targetX100 < 101)) || intent.stake <= 0) {
          refuse(intent, 'invalid bet');
          return;
        }
        const limit = verdict.maxStake ?? null;
        if (limit !== null && intent.stake > limit) {
          refuse(intent, `stake above your limit of ${limit} credits`);
          return;
        }
        client.send({ type: 'bet', stake: intent.stake, targetX100: intent.targetX100 });
      } else if (intent.type === 'cashout') {
        if (client.state.round?.phase !== 'running' || client.state.you?.bet?.status !== 'active' || client.state.you.bet.cashoutX100 !== null) {
          refuse(intent, 'cashout is unavailable');
          return;
        }
        client.send({ type: 'cashout' });
      } else {
        const bet = client.state.you?.bet;
        if (!bet || (bet.status !== 'queued' && client.state.round?.phase !== 'betting')) {
          refuse(intent, 'cancellation is unavailable');
          return;
        }
        client.send({ type: 'cancel' });
      }
    }
  });
  const stopMessages = client.on('message', (message, now, fresh) => {
    if (ready) transport.send({ proto: EMBED_PROTOCOL, type: 'server', message: redactMessage(message), now, fresh });
  });
  return {
    close() {
      stopListening();
      stopMessages();
      stopPinging();
      stopped = true;
    },
    setAllowed: publishAllowed,
  };
}

export type EmbeddedEvents = {
  init: (manifest: unknown) => void;
  change: (state: RoomState, message: ServerMessage | null) => void;
  message: (message: ServerMessage) => void;
  allow: (allowed: boolean, reason: string | null, maxStake: number | null) => void;
  refused: (message: ClientMessage, reason: string) => void;
};

/** The game's side of the bridge: the same state and events as a direct client, with bets relayed through the host. */
export class EmbeddedGame extends Emitter<EmbeddedEvents> {
  private stateValue: RoomState = emptyRoomState();
  private manifestValue: unknown = null;
  private allowed = false;
  private allowReason: string | null = 'waiting for the host';
  private maxStakeValue: number | null = null;
  private readonly stop: () => void;

  constructor(private readonly transport: Transport<GameToHost, HostToGame>) {
    super();
    this.stop = transport.listen((message) => {
      switch (message.type) {
        case 'init':
          this.manifestValue = message.manifest;
          this.stateValue = message.state;
          this.allowed = message.allowBets;
          // The host says why (no pass, a chain still being checked); the fallback is for a host that gives no reason.
          this.allowReason = message.allowBets ? null : (message.reason ?? 'the host is not taking bets');
          this.maxStakeValue = message.maxStake ?? null;
          this.emit('init', message.manifest);
          this.emit('change', this.stateValue, null);
          break;
        case 'server':
          this.stateValue = applyMessage(this.stateValue, message.message, message.now, message.fresh);
          this.emit('message', message.message);
          this.emit('change', this.stateValue, message.message);
          break;
        case 'allow':
          this.allowed = message.allowBets;
          this.allowReason = message.reason;
          this.maxStakeValue = message.maxStake ?? null;
          this.emit('allow', message.allowBets, message.reason, this.maxStakeValue);
          break;
        case 'refused':
          this.emit('refused', message.message, message.reason);
          break;
        case 'ping':
          transport.send({ proto: EMBED_PROTOCOL, type: 'pong', at: message.at });
          break;
      }
    });
    transport.send({ proto: EMBED_PROTOCOL, type: 'ready', pongs: true });
  }

  get state(): RoomState {
    return this.stateValue;
  }

  get manifest(): unknown {
    return this.manifestValue;
  }

  get canBet(): boolean {
    return this.allowed && this.stateValue.round?.phase === 'betting' && this.stateValue.integrity.length === 0;
  }

  get canCashout(): boolean {
    return this.stateValue.round?.phase === 'running' && this.stateValue.you?.bet?.status === 'active' && this.stateValue.you.bet.cashoutX100 === null;
  }

  get betsBlockedBecause(): string | null {
    return this.allowed ? null : this.allowReason;
  }

  /** The most credits one bet may stake, as the player set it on the host's controls; null for no bound. */
  get maxStake(): number | null {
    return this.maxStakeValue;
  }

  bet(stake: number, targetX100: number | null): void {
    this.transport.send({ proto: EMBED_PROTOCOL, type: 'client', message: { type: 'bet', stake, targetX100 } });
  }

  cancel(): void {
    this.transport.send({ proto: EMBED_PROTOCOL, type: 'client', message: { type: 'cancel' } });
  }

  cashout(): void {
    this.transport.send({ proto: EMBED_PROTOCOL, type: 'client', message: { type: 'cashout' } });
  }

  resize(height: number): void {
    this.transport.send({ proto: EMBED_PROTOCOL, type: 'resize', height });
  }

  close(): void {
    this.stop();
    this.clearHandlers();
  }
}

/**
 * Inside a custom renderer: connects to the platform page that framed it. The frame is sandboxed (no origin of
 * its own), so by default it talks to whatever window framed it and hears only that window; pass the host's
 * origin to pin it further.
 */
export function connectEmbedded(hostOrigin = '*', own: Window = window): EmbeddedGame {
  if (!own.parent || own.parent === own) throw new Error('not running inside a game frame');
  const parent = own.parent;
  return new EmbeddedGame(windowTransport<GameToHost, HostToGame>(parent, hostOrigin, own, () => parent));
}
