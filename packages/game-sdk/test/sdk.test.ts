import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { chain as fairChain, free } from '@crashwif/crash-math';
import { describe, expect, it, vi } from 'vitest';

import { GameClient, type SocketLike } from '../src/client.js';
import { EMBED_PROTOCOL, EmbeddedGame, hostGame, type GameToHost, type HostToGame, type Transport } from '../src/embed.js';
import { canonicalManifest, validateManifest } from '../src/manifest.js';
import type { RoundResult, ServerMessage, YouState } from '../src/protocol.js';
import { ReplayPlayer, replayCurve, replayTimeline, verifyReplay, type ReplayRound } from '../src/replay.js';
import { applyMessage, emptyRoomState, playerOutcome, remember, roomSocketProtocols, roomSocketUrl, roomTokenFromProtocols } from '../src/state.js';

/** A committed chain of 3 rounds with a known salt, as a room would publish it. */
function committedChain(length = 3) {
  const top = 'ab'.repeat(32);
  const chain = fairChain.buildChain(top, length, 1);
  const salt = 'deadbeef';
  // Round r plays seed r + 1 (seed_1 hashes to the terminal hash announced for round 0), as the game server does.
  const seed = (roundIndex: number) => fairChain.deriveSeed(chain, roundIndex + 1);
  return { terminalHash: chain.terminalHash, salt, seed };
}

function roomInfo(chainId = 0, terminalHash = 'aa'.repeat(32), salt: string | null = 'deadbeef') {
  return { gameId: 'g', status: 'open', chainId, terminalHash, chainLength: 3, saltSlot: 1, salt, houseEdgeBps: 300, curve: free.DEFAULT_CURVE, anchorSignature: null, bettingMs: 5000, maxBettorsPerRound: 50, minTargetX100: 101, maxTargetX100: 100000 } as const;
}

class FakeSocket implements SocketLike {
  readyState: 0 | 1 | 2 | 3 = 0;
  sent: string[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(readonly url: string, readonly protocols: string[]) {}
  send(data: string) {
    this.sent.push(String(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  push(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }
}

describe('GameClient', () => {
  it('offers the token as a subprotocol, folds messages through the reducer, sends bets and flags a second snapshot', async () => {
    const sockets: FakeSocket[] = [];
    const client = new GameClient({ baseUrl: 'https://play.test', makeSocket: (url, protocols) => sockets[sockets.push(new FakeSocket(url, protocols)) - 1]! });
    const changes: string[] = [];
    client.on('change', (_s, m) => changes.push(m?.type ?? 'none'));
    client.connect('g-1', async () => 'tok');
    await Promise.resolve();
    await Promise.resolve();
    expect(sockets[0]!.url).toBe('wss://play.test/ws?game=g-1');
    expect(sockets[0]!.protocols).toEqual(['crashwif.room.v1', 'crashwif.token.tok']);
    sockets[0]!.open();
    expect(client.connected).toBe(true);
    // A round event before the snapshot belongs to a room this client hasn't been shown: ignored.
    sockets[0]!.push({ type: 'round.betting', roundIndex: 0, serverSeedHash: 'x', bettingClosesAt: 1 });
    expect(client.state.round).toBeNull();
    const round = { roundIndex: 0, phase: 'betting', bettingClosesAt: Date.now() + 5000, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: 'aa'.repeat(32), serverTime: Date.now() } as const;
    sockets[0]!.push({ type: 'state', room: roomInfo(), round, recent: [], players: [], you: { sessionId: 's', playerKey: 'k-s', creditsLeft: 1000, roundsLeft: 50, expiresAt: 2_000_000_000_000, ended: false, endReason: null, bet: null } });
    expect(client.state.room?.gameId).toBe('g');
    expect(client.canBet).toBe(true);
    client.bet(100, 200);
    expect(JSON.parse(sockets[0]!.sent[0]!)).toEqual({ type: 'bet', stake: 100, targetX100: 200 });
    sockets[0]!.push({ type: 'state', room: roomInfo(), round, recent: [], players: [], you: null });
    expect(client.state.integrity).toContain('the room sent a second snapshot on one connection');
    expect(client.canBet).toBe(false);
    expect(changes).toEqual(['none', 'state', 'state']);
    client.close();
    expect(client.connected).toBe(false);
  });

  it('reconnects after a drop with a fresh token', async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    let n = 0;
    const client = new GameClient({ baseUrl: 'ws://localhost:4500', makeSocket: (url, protocols) => sockets[sockets.push(new FakeSocket(url, protocols)) - 1]! });
    client.connect('g-1', async () => `tok-${++n}`);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.open();
    sockets[0]!.onclose?.(new CloseEvent('close'));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sockets).toHaveLength(2);
    expect(sockets[1]!.url).toBe('ws://localhost:4500/ws?game=g-1');
    expect(sockets[1]!.protocols).toEqual(['crashwif.room.v1', 'crashwif.token.tok-2']);
    // A spectator offers the room protocol alone.
    client.connect('g-2', null);
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets[2]!.protocols).toEqual(['crashwif.room.v1']);
    client.close();
    vi.useRealTimers();
  });
});

/** Two ends of an in-memory bridge. */
function pair(): [Transport<HostToGame, GameToHost>, Transport<GameToHost, HostToGame>] {
  const toGame: ((m: HostToGame) => void)[] = [];
  const toHost: ((m: GameToHost) => void)[] = [];
  return [
    { send: (m) => toGame.forEach((h) => h(m)), listen: (h) => (toHost.push(h), () => void toHost.splice(toHost.indexOf(h), 1)) },
    { send: (m) => toHost.forEach((h) => h(m)), listen: (h) => (toGame.push(h), () => void toGame.splice(toGame.indexOf(h), 1)) },
  ];
}

describe('embed bridge', () => {
  it('gives the game the host state and frames, relays allowed bets, and refuses the rest', () => {
    const [hostSide, gameSide] = pair();
    const sent: unknown[] = [];
    const listeners: ((m: ServerMessage, now: number, fresh: boolean) => void)[] = [];
    let allowed = true;
    const source = {
      state: applyMessage(emptyRoomState(), { type: 'state', room: roomInfo(), round: { roundIndex: 0, phase: 'betting', bettingClosesAt: 5000, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: 'aa'.repeat(32), serverTime: 1000 }, recent: [], players: [], you: null }, 1000),
      on: (_e: 'message', h: (m: ServerMessage, now: number, fresh: boolean) => void) => (listeners.push(h), () => {}),
      send: (m: unknown) => sent.push(m),
    };
    const host = hostGame({ transport: hostSide, client: source, manifest: { name: 'Doge' }, allowBets: () => ({ allowed, reason: allowed ? null : 'checking the chain' }) });
    const game = new EmbeddedGame(gameSide);
    expect(game.manifest).toEqual({ name: 'Doge' });
    expect(game.state.room?.gameId).toBe('g');
    expect(game.canBet).toBe(true);
    game.bet(50, 150);
    expect(sent).toEqual([{ type: 'bet', stake: 50, targetX100: 150 }]);
    const refused: string[] = [];
    game.on('refused', (_m, reason) => refused.push(reason));
    game.bet(-1, 150);
    expect(refused).toEqual(['invalid bet']);
    allowed = false;
    host.setAllowed();
    expect(game.canBet).toBe(false);
    expect(game.betsBlockedBecause).toBe('checking the chain');
    game.bet(50, 150);
    expect(refused).toEqual(['invalid bet', 'checking the chain']);
    expect(sent).toHaveLength(1);
    // The game holds its own copy of the room: the host's state moves it only through forwarded frames.
    source.state.you = { sessionId: 's', playerKey: 'k-s', creditsLeft: 900, roundsLeft: 49, expiresAt: 0, ended: false, endReason: null, bet: { stake: 100, targetX100: null, cashoutX100: null, status: 'active' } };
    source.state.round = { ...source.state.round!, phase: 'running' };
    expect(game.canCashout).toBe(false);
    listeners.forEach((h) => h({ type: 'you', you: source.state.you! }, 5000, true));
    listeners.forEach((h) => h({ type: 'round.locked', roundIndex: 0, runningSince: 5000, admitted: 1, rally: { active: false, bettors: 1, percent: 100 } }, 5000, true));
    expect(game.canCashout).toBe(true);
    game.cashout();
    expect(sent).toEqual([{ type: 'bet', stake: 50, targetX100: 150 }, { type: 'cashout' }]);
    // Server frames reach the game and fold the same way.
    listeners.forEach((h) => h({ type: 'tick', roundIndex: 0, multiplierX100: 250, elapsedMs: 100 }, 1100, true));
    expect(game.state.round?.multiplierX100).toBe(250);
    // The host never sends the token: the frame only carries the protocol's own messages.
    host.close();
    game.close();
  });

  it('ignores untagged or foreign messages', () => {
    const [, gameSide] = pair();
    const game = new EmbeddedGame(gameSide);
    (gameSide as unknown as { send: (m: unknown) => void }).send({ type: 'init' }); // no protocol tag on the game->host side; the host side is what matters
    expect(game.manifest).toBeNull();
    expect(EMBED_PROTOCOL).toBe('crashwif-game-embed:v1');
  });

  const betting = { roundIndex: 0, phase: 'betting', bettingClosesAt: 5000, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: 'aa'.repeat(32), serverTime: 1000 } as const;

  it('blanks the player’s session id in the init state and in every state or you frame it forwards', () => {
    const [hostSide, gameSide] = pair();
    const listeners: ((m: ServerMessage, now: number, fresh: boolean) => void)[] = [];
    const you: YouState = { sessionId: 'sess-secret', playerKey: 'k-secret', creditsLeft: 1000, roundsLeft: 50, expiresAt: 2_000_000_000_000, ended: false, endReason: null, bet: null };
    const source = {
      state: applyMessage(emptyRoomState(), { type: 'state', room: roomInfo(), round: betting, recent: [], players: [], you }, 1000),
      on: (_e: 'message', h: (m: ServerMessage, now: number, fresh: boolean) => void) => (listeners.push(h), () => {}),
      send: vi.fn(),
    };
    const toGame: HostToGame[] = [];
    gameSide.listen((m) => toGame.push(m));
    const host = hostGame({ transport: hostSide, client: source, manifest: {}, allowBets: () => ({ allowed: true, reason: null }) });
    const game = new EmbeddedGame(gameSide);
    expect(game.state.you).toEqual({ ...you, sessionId: '' });
    // The host's own state keeps the id.
    expect(source.state.you?.sessionId).toBe('sess-secret');
    listeners.forEach((h) => h({ type: 'you', you: { ...you, creditsLeft: 900 } }, 1100, true));
    listeners.forEach((h) => h({ type: 'state', room: roomInfo(), round: betting, recent: [], players: [], you }, 1200, true));
    listeners.forEach((h) => h({ type: 'tick', roundIndex: 0, multiplierX100: 120, elapsedMs: 50 }, 1300, true));
    const forwarded = toGame.filter((m): m is Extract<HostToGame, { type: 'server' }> => m.type === 'server').map((m) => m.message);
    expect(forwarded.map((m) => m.type)).toEqual(['you', 'state', 'tick']);
    expect(forwarded.map((m) => ('you' in m ? m.you?.sessionId : 'n/a'))).toEqual(['', '', 'n/a']);
    expect(game.state.you?.creditsLeft).toBe(1000);
    expect(JSON.stringify(toGame)).not.toContain('sess-secret');
    host.close();
    game.close();
  });

  /** A host over an in-memory bridge with fake timers, recording what each side sent. */
  function watchdog(options: { pingIntervalMs?: number; unansweredPings?: number } = {}) {
    vi.useFakeTimers();
    const [hostSide, gameSide] = pair();
    const source = { state: emptyRoomState(), on: () => () => {}, send: vi.fn() };
    const onUnresponsive = vi.fn();
    const fromGame: GameToHost[] = [];
    hostSide.listen((m) => fromGame.push(m));
    const toGame: HostToGame[] = [];
    gameSide.listen((m) => toGame.push(m));
    const host = hostGame({ transport: hostSide, client: source, manifest: {}, allowBets: () => ({ allowed: false, reason: 'checking the chain' }), onUnresponsive, ...options });
    const pings = () => toGame.filter((m): m is Extract<HostToGame, { type: 'ping' }> => m.type === 'ping');
    const pongs = () => fromGame.filter((m) => m.type === 'pong');
    /** Answers every ping from now on while `answering()` holds, after `delayMs` when given. */
    const answer = (answering: () => boolean = () => true, delayMs?: number) =>
      gameSide.listen((m) => {
        if (m.type !== 'ping' || !answering()) return;
        const pong = () => gameSide.send({ proto: EMBED_PROTOCOL, type: 'pong', at: m.at });
        if (delayMs === undefined) pong();
        else setTimeout(pong, delayMs);
      });
    return { host, gameSide, toGame, fromGame, onUnresponsive, pings, pongs, answer };
  }

  it('pings a ready game, which the SDK declares and answers, and never reports it while it answers', () => {
    const w = watchdog();
    const game = new EmbeddedGame(w.gameSide);
    expect(w.fromGame[0]).toEqual({ proto: EMBED_PROTOCOL, type: 'ready', pongs: true });
    vi.advanceTimersByTime(4_999);
    expect(w.pings()).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(w.pings()).toHaveLength(1);
    expect(w.pongs()).toEqual([{ proto: EMBED_PROTOCOL, type: 'pong', at: w.pings()[0]!.at }]);
    vi.advanceTimersByTime(10 * 60_000);
    expect(w.pings()).toHaveLength(121);
    expect(w.pongs()).toHaveLength(121);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    w.host.close();
    game.close();
    vi.useRealTimers();
  });

  it('reports an SDK game whose script hangs once three pings in a row go unanswered, and stops pinging', () => {
    const w = watchdog();
    const game = new EmbeddedGame(w.gameSide);
    vi.advanceTimersByTime(60_000);
    expect(w.pongs()).toHaveLength(12);
    // Its script hangs: the pings at 65, 70 and 75 s go unanswered, and the tick at 80 s reports it instead of pinging.
    game.close();
    vi.advanceTimersByTime(19_999);
    expect(w.pings()).toHaveLength(15);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(w.onUnresponsive).toHaveBeenCalledTimes(1);
    expect(w.pings()).toHaveLength(15);
    const sent = w.toGame.length;
    vi.advanceTimersByTime(60_000);
    expect(w.toGame).toHaveLength(sent);
    expect(w.onUnresponsive).toHaveBeenCalledTimes(1);
    w.host.close();
    vi.useRealTimers();
  });

  it('reports a game that declared pongs and hung before answering its first ping, after three unanswered ticks', () => {
    const w = watchdog();
    // Ready with pongs declared, then its init handler never returns: not one ping is answered.
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'ready', pongs: true });
    expect(w.toGame.map((m) => m.type)).toEqual(['init']);
    vi.advanceTimersByTime(15_000);
    expect(w.pings()).toHaveLength(3);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(w.onUnresponsive).toHaveBeenCalledTimes(1);
    expect(w.pings()).toHaveLength(3);
    // A second ready gets its init, but pinging does not start again and the game is not reported twice.
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'ready', pongs: true });
    vi.advanceTimersByTime(60_000);
    expect(w.pings()).toHaveLength(3);
    expect(w.onUnresponsive).toHaveBeenCalledTimes(1);
    w.host.close();
    vi.useRealTimers();
  });

  it('counts pings, not time: a long suspension followed by one tick and an immediate pong is not reported', () => {
    const w = watchdog();
    const game = new EmbeddedGame(w.gameSide);
    vi.advanceTimersByTime(5_000);
    expect(w.pongs()).toHaveLength(1);
    // The laptop sleeps for an hour: the clock moves on and no timer runs.
    vi.setSystemTime(Date.now() + 60 * 60_000);
    // On waking, the first tick sends one ping, and its answer resets the count.
    vi.advanceTimersToNextTimer();
    expect(w.pings()).toHaveLength(2);
    expect(w.pongs()).toHaveLength(2);
    expect(w.pings()[1]!.at - w.pings()[0]!.at).toBeGreaterThanOrEqual(60 * 60_000);
    vi.advanceTimersByTime(60_000);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    w.host.close();
    game.close();
    vi.useRealTimers();
  });

  it('never times out a game on a host whose ticks come a minute apart, however long it takes to answer within one', () => {
    // A tab hidden for a while wakes its intervals once a minute; the game answers each ping 45 s later.
    const w = watchdog({ pingIntervalMs: 60_000 });
    w.answer(() => true, 45_000);
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'ready', pongs: true });
    vi.advanceTimersByTime(10 * 60_000);
    expect(w.pings()).toHaveLength(10);
    expect(w.pongs()).toHaveLength(9);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    w.host.close();
    vi.useRealTimers();
  });

  it('watches a game that answers a ping without declaring pongs, and reports it once it stops answering', () => {
    const w = watchdog({ pingIntervalMs: 1_000 });
    let answering = true;
    w.answer(() => answering);
    // A hand-written renderer: its ready says nothing about pongs, but it answers pings.
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'ready' });
    vi.advanceTimersByTime(2_000);
    expect(w.pongs()).toHaveLength(2);
    answering = false;
    vi.advanceTimersByTime(3_999);
    expect(w.pings()).toHaveLength(5);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(w.onUnresponsive).toHaveBeenCalledTimes(1);
    w.host.close();
    vi.useRealTimers();
  });

  it('resets the count on any message from the game, and reports at the configured number of unanswered pings', () => {
    const w = watchdog({ pingIntervalMs: 1_000, unansweredPings: 2 });
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'ready', pongs: true });
    // No pongs, but a resize every 1.5 s: never two pings in a row without a word from the game.
    for (let i = 0; i < 40; i++) {
      vi.advanceTimersByTime(1_500);
      w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'resize', height: 500 });
    }
    expect(w.pings()).toHaveLength(60);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    // The last resize came at 60 s; the pings at 61 and 62 s go unanswered, and the tick at 63 s reports.
    vi.advanceTimersByTime(2_999);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(w.onUnresponsive).toHaveBeenCalledTimes(1);
    w.host.close();
    vi.useRealTimers();
  });

  it('never reports a game that neither declares pongs nor answers a ping, and stops pinging when closed', () => {
    const w = watchdog({ pingIntervalMs: 1_000, unansweredPings: 1 });
    // A bundle built before pongs existed: it says ready, reports its height, and never answers a ping.
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'ready' });
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'resize', height: 500 });
    vi.advanceTimersByTime(60_000);
    expect(w.pings()).toHaveLength(60);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    w.host.close();
    vi.advanceTimersByTime(60_000);
    expect(w.pings()).toHaveLength(60);
    vi.useRealTimers();
  });

  it('stops everything when closed: no pings and no report for a declared game that has gone quiet', () => {
    const w = watchdog({ pingIntervalMs: 1_000 });
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'ready', pongs: true });
    vi.advanceTimersByTime(2_000);
    expect(w.pings()).toHaveLength(2);
    w.host.close();
    vi.advanceTimersByTime(60_000);
    expect(w.pings()).toHaveLength(2);
    expect(w.onUnresponsive).not.toHaveBeenCalled();
    // Messages after close reach nothing: a late ready gets no init and starts no pings.
    w.gameSide.send({ proto: EMBED_PROTOCOL, type: 'ready', pongs: true });
    vi.advanceTimersByTime(60_000);
    expect(w.toGame.map((m) => m.type)).toEqual(['init', 'ping', 'ping']);
    vi.useRealTimers();
  });
});

describe('the custom renderer example', () => {
  /** Runs examples/custom-renderer/game.js against a stub page framed by `host`, returning what it posts and a way to deliver messages. */
  function loadExample() {
    const posted: { proto: string; type: string; at?: number }[] = [];
    const listeners: ((event: { source: unknown; data: unknown }) => void)[] = [];
    const host = { postMessage: (message: { proto: string; type: string; at?: number }) => posted.push(message) };
    const elements = new Map<string, { textContent: string; className: string; disabled: boolean; checked: boolean; addEventListener: () => void }>();
    const context = {
      window: { parent: host, addEventListener: (_type: string, listener: (event: { source: unknown; data: unknown }) => void) => listeners.push(listener) },
      document: {
        body: { scrollHeight: 400 },
        getElementById: (id: string) => {
          if (!elements.has(id)) elements.set(id, { textContent: '', className: '', disabled: false, checked: true, addEventListener: () => undefined });
          return elements.get(id);
        },
      },
      ResizeObserver: class {
        observe(): void {}
      },
    };
    runInNewContext(readFileSync(new URL('../examples/custom-renderer/game.js', import.meta.url), 'utf8'), context);
    return { posted, deliver: (data: unknown, source: unknown = host) => listeners.forEach((listener) => listener({ source, data })) };
  }

  it('says it is ready, declaring pongs, and answers the host’s ping with a pong carrying the same timestamp, from the host window only', () => {
    const page = loadExample();
    expect(page.posted).toEqual([{ proto: EMBED_PROTOCOL, type: 'ready', pongs: true }]);
    page.deliver({ proto: EMBED_PROTOCOL, type: 'ping', at: 1_234 });
    expect(page.posted[1]).toEqual({ proto: EMBED_PROTOCOL, type: 'pong', at: 1_234 });
    page.deliver({ proto: EMBED_PROTOCOL, type: 'ping', at: 99 }, {});
    page.deliver({ proto: 'other', type: 'ping', at: 99 });
    expect(page.posted).toHaveLength(2);
  });
});

describe('replay', () => {
  const { terminalHash, salt, seed } = committedChain();
  const seed0 = seed(0);
  const crash = free.crashFromSeed(seed0, salt, 300);
  const round = {
    gameId: 'g',
    chainId: 0,
    roundIndex: 0,
    crashX100: crash,
    serverSeed: seed0,
    serverSeedHash: terminalHash,
    salt,
    houseEdgeBps: 300,
    curve: free.DEFAULT_CURVE,
    rallyN: 2,
    bets: [
      { handle: 'Degen', stake: 100, targetX100: 101, won: crash >= 101, payout: free.payout(100, 101, crash, 2) },
      { handle: null, stake: 50, targetX100: crash + 100, won: false, payout: 0 },
    ],
  };

  it('replays on the curve the round names, on the first curve when it names none, and refuses one it cannot run', () => {
    const slow = { kind: 'exponential', growthRatePerMs: 0.00001 } as const;
    expect(replayCurve(round)).toEqual(free.DEFAULT_CURVE);
    const { curve: _named, ...recordedWithout } = round as ReplayRound;
    expect(replayCurve(recordedWithout as ReplayRound)).toEqual(free.FIRST_CURVE);
    expect(verifyReplay(recordedWithout)).toEqual({ ok: true, problems: [] });
    expect(replayTimeline(recordedWithout, { bettingMs: 1000 }).at(-1)!.at).toBe(1000 + free.msToReach(crash, free.FIRST_CURVE));
    expect(replayTimeline({ ...round, curve: slow }, { bettingMs: 1000 }).at(-1)!.at).toBe(1000 + free.msToReach(crash, slow));
    const unrunnable = { ...round, curve: { kind: 'exponential', growthRatePerMs: 0 } as never };
    expect(replayCurve(unrunnable)).toBeNull();
    expect(verifyReplay(unrunnable).problems).toContain("the round names a multiplier curve this player can't run");
    expect(() => replayTimeline(unrunnable)).toThrow(RangeError);
  });

  it('verifies a round from its seed, salt and bets', () => {
    expect(verifyReplay(round)).toEqual({ ok: true, problems: [] });
    expect(verifyReplay({ ...round, crashX100: round.crashX100 + 1 }).problems[0]).toMatch(/crash point/);
    expect(verifyReplay({ ...round, serverSeedHash: 'bb'.repeat(32) }).problems[0]).toMatch(/hash announced/);
    expect(verifyReplay({ ...round, bets: [{ ...round.bets[1]!, won: true, payout: 1 }] }).problems[0]).toMatch(/settled differently/);
  });

  it('builds a deterministic timeline ending in the crash, with cash-outs at their multipliers', () => {
    const timeline = replayTimeline(round, { bettingMs: 1000, tickMs: 200 });
    expect(timeline[0]!.event.type).toBe('round.betting');
    expect(timeline.filter((e) => e.event.type === 'bet')).toHaveLength(2);
    const lock = timeline.find((e) => e.event.type === 'round.locked')!;
    expect(lock.at).toBe(1000);
    expect((lock.event as { rally: { percent: number } }).rally.percent).toBe(102);
    const last = timeline[timeline.length - 1]!;
    expect(last.event.type).toBe('round.crashed');
    expect(last.at).toBe(1000 + free.msToReach(crash, free.DEFAULT_CURVE));
    const ticks = timeline.filter((e) => e.event.type === 'tick');
    expect(ticks.every((t) => t.at < last.at)).toBe(true);
    if (round.bets[0]!.won) {
      const cashout = timeline.find((e) => e.event.type === 'cashout')!;
      expect(cashout.at).toBe(1000 + free.msToReach(101, free.DEFAULT_CURVE));
    }
    expect(replayTimeline(round, { bettingMs: 1000, tickMs: 200 })).toEqual(timeline);
  });

  it('replays a recorded manual cashout before an optional auto target', () => {
    let manualSalt = 'manual-replay-0';
    for (let i = 1; free.crashFromSeed(seed0, manualSalt, 300) < 300; i++) manualSalt = `manual-replay-${i}`;
    const manualCrash = free.crashFromSeed(seed0, manualSalt, 300);
    const elapsed = free.msToReach(150, free.DEFAULT_CURVE);
    const manual = {
      ...round,
      salt: manualSalt,
      crashX100: manualCrash,
      rallyN: 0,
      bets: [
        { handle: 'Manual', stake: 100, targetX100: 250, cashoutX100: 150, cashoutElapsedMs: elapsed, won: true, payout: free.payout(100, 150, manualCrash) },
        { handle: 'Missed', stake: 100, targetX100: null, cashoutX100: null, cashoutElapsedMs: null, won: false, payout: 0 },
      ],
    };
    expect(verifyReplay(manual)).toEqual({ ok: true, problems: [] });
    const cashouts = replayTimeline(manual, { bettingMs: 1000 }).filter((e) => e.event.type === 'cashout');
    expect(cashouts).toHaveLength(1);
    expect(cashouts[0]!.at).toBe(1000 + elapsed);
    expect(verifyReplay({ ...manual, bets: [{ ...manual.bets[0]!, cashoutElapsedMs: elapsed + 1000 }] }).problems).toContain("a manual cashout does not match the round's curve or precede the crash and auto target");
  });

  it('plays on a virtual clock, pauses and seeks', () => {
    const timers: { fn: () => void; ms: number }[] = [];
    const player = new ReplayPlayer(round, { bettingMs: 1000, tickMs: 500, setTimeout: (fn, ms) => (timers.push({ fn, ms }), timers.length), clearTimeout: () => {} });
    const seen: string[] = [];
    player.on((e) => seen.push(e.type));
    let ended = false;
    player.onEnd(() => (ended = true));
    player.play();
    while (timers.length && !ended) timers.shift()!.fn();
    expect(seen[0]).toBe('round.betting');
    expect(seen[seen.length - 1]).toBe('round.crashed');
    expect(ended).toBe(true);
    const again = new ReplayPlayer(round, { bettingMs: 1000, tickMs: 500, setTimeout: () => 0, clearTimeout: () => {} });
    const scrubbed: string[] = [];
    again.on((e) => scrubbed.push(e.type));
    again.seek(1000);
    expect(scrubbed).toContain('round.locked');
    expect(scrubbed).not.toContain('round.crashed');
  });
});

describe('manifest', () => {
  it('keeps an optional cover in the content commitment and refuses outside paths', () => {
    const input = { version: 1, name: 'Cover game', description: '', templateId: null, theme: { category: 'space', mood: 'hype', colors: {} }, assets: {}, audio: { preset: 'none' }, renderer: 'builtin-curve', licence: 'open' };
    const result = validateManifest({ ...input, cover: 'assets/cover.png' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(canonicalManifest(result.manifest)).toContain('"cover":"assets/cover.png"');
    for (const cover of ['https://other.test/image.png', '/image.png', '../image.png', 'assets//image.png', 4, null]) {
      expect(validateManifest({ ...input, cover })).toMatchObject({ ok: false, problems: [{ path: 'cover' }] });
    }
    const absent = validateManifest(input);
    if (absent.ok) expect(absent.manifest).not.toHaveProperty('cover');
  });
  it('accepts a well-formed manifest and reports each problem of a bad one', () => {
    const good = validateManifest({ version: 1, name: 'Doge Rocket', description: 'to the moon', templateId: 'space-doge', theme: { category: 'space', mood: 'hype', colors: { background: '#101020', curve: 'rgb(255, 0, 0)' } }, assets: { background: 'bg.png', character: 'doge.png' }, audio: { preset: 'arcade', volume: 0.5, clips: { music: 'sounds/music.mp3', crash: 'sounds/crash.mp3' } }, renderer: 'builtin-curve', licence: 'derivatives-royalty', royaltyBps: 200, derivativeOf: null });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(canonicalManifest(good.manifest)).toContain('"licence":"derivatives-royalty"');
      expect(good.manifest.audio.clips).toEqual({ music: 'sounds/music.mp3', crash: 'sounds/crash.mp3' });
    }
    const bad = validateManifest({ version: 2, name: '', theme: { colors: { Background: 'nope' } }, assets: { hat: '../x' }, audio: { clips: { kaching: 'sounds/kaching.mp3', crash: '../crash.mp3' } }, renderer: 'custom', licence: 'open', royaltyBps: 5, derivativeOf: 'x' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problems.map((p) => p.path)).toEqual(expect.arrayContaining(['version', 'name', 'theme.category', 'theme.colors.Background', 'assets.hat', 'audio.preset', 'audio.clips.kaching', 'audio.clips.crash', 'entry', 'royaltyBps', 'derivativeOf']));
    const list = validateManifest({ version: 1, name: 'Doge', description: '', templateId: null, theme: { category: 'space', mood: 'hype', colors: {} }, assets: {}, audio: { preset: 'arcade', clips: ['music.mp3'] }, renderer: 'builtin-curve', licence: 'open', derivativeOf: null });
    expect(list.ok).toBe(false);
    if (!list.ok) expect(list.problems.map((p) => p.path)).toEqual(['audio.clips']);
  });
});

describe('state helpers', () => {
  it('keeps the session token in the subprotocol list and out of the socket URL', () => {
    expect(roomSocketUrl('https://play.test', 'g')).toBe('wss://play.test/ws?game=g');
    expect(roomSocketUrl('ws://localhost:4500', 'g')).toBe('ws://localhost:4500/ws?game=g');
    expect(roomSocketProtocols('a.b')).toEqual(['crashwif.room.v1', 'crashwif.token.a.b']);
    expect(roomSocketProtocols(null)).toEqual(['crashwif.room.v1']);
    // The server side reads the header as the client sends it: any order, with or without spaces.
    expect(roomTokenFromProtocols('crashwif.room.v1, crashwif.token.a.b')).toBe('a.b');
    expect(roomTokenFromProtocols('crashwif.token.x,crashwif.room.v1')).toBe('x');
    expect(roomTokenFromProtocols('crashwif.room.v1')).toBeNull();
    expect(roomTokenFromProtocols('crashwif.token.')).toBeNull();
    expect(roomTokenFromProtocols(undefined)).toBeNull();
  });

  it('folds a crash reveal that checks out', () => {
    const { terminalHash, salt, seed } = committedChain();
    let state = applyMessage(emptyRoomState(), { type: 'state', room: roomInfo(0, terminalHash, salt), round: { roundIndex: null, phase: 'waiting', bettingClosesAt: null, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: null, serverTime: 1000 }, recent: [], players: [], you: null }, 1000);
    state = applyMessage(state, { type: 'round.betting', roundIndex: 0, serverSeedHash: terminalHash, bettingClosesAt: 6000 }, 1000);
    const result: RoundResult = { roundIndex: 0, chainId: 0, crashX100: free.crashFromSeed(seed(0), salt, 300), serverSeed: seed(0), serverSeedHash: terminalHash, salt, houseEdgeBps: 300, rally: { active: false, bettors: 0, percent: 100 }, bettors: 0, winners: 0 };
    state = applyMessage(state, { type: 'round.crashed', result }, 7000);
    expect(state.integrity).toEqual([]);
    expect(state.verified[0]).toEqual({ round: 0, seed: seed(0) });
  });

  it("pins the chain's curve with its commitment and turns betting off on a curve it can't run or a changed one", () => {
    const waiting = { roundIndex: null, phase: 'waiting', bettingClosesAt: null, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: null, serverTime: 1000 } as const;
    const slow = { kind: 'exponential', growthRatePerMs: 0.00001 } as const;
    const state = applyMessage(emptyRoomState(), { type: 'state', room: { ...roomInfo(), curve: slow }, round: waiting, recent: [], players: [], you: null }, 1000);
    expect(state.integrity).toEqual([]);
    expect(state.chains[0]?.curve).toEqual(slow);
    // The room may repeat the curve, never swap it: the climb a game draws and the multiplier a manual cashout pays follow it.
    expect(applyMessage(state, { type: 'room', room: { ...roomInfo(), curve: slow } }, 2000).integrity).toEqual([]);
    const swapped = applyMessage(state, { type: 'room', room: roomInfo() }, 2000);
    expect(swapped.chains[0]).toMatchObject({ curve: slow, changed: true });
    expect(swapped.integrity).toContain("the room changed chain 0's commitment after announcing it");
    // A curve the maths can't run is caught at the snapshot.
    for (const bad of [undefined, { kind: 'linear', growthRatePerMs: 0.00006 }, { kind: 'exponential', growthRatePerMs: 0 }]) {
      const broken = applyMessage(emptyRoomState(), { type: 'state', room: { ...roomInfo(), curve: bad as never }, round: waiting, recent: [], players: [], you: null }, 1000);
      expect(broken.integrity, JSON.stringify(bad)).toContain("the room announced a multiplier curve this client can't run");
      expect(broken.chains[0]?.curve).toBeNull();
    }
    // A chain remembered from an earlier visit without its curve takes the room's when it is announced, and holds it from then on.
    const seen = { ...emptyRoomState(), ...remember(emptyRoomState(), [{ chainId: 0, terminalHash: 'aa'.repeat(32), houseEdgeBps: 300, salt: 'deadbeef', chainLength: 3, saltSlot: 1, anchorSignature: null, lastRound: null, lastSeed: null }]) };
    expect(seen.chains[0]?.curve).toBeNull();
    const announced = applyMessage(seen, { type: 'state', room: { ...roomInfo(), curve: slow }, round: waiting, recent: [], players: [], you: null }, 1000);
    expect(announced.chains[0]).toMatchObject({ curve: slow, changed: false });
    expect(applyMessage(announced, { type: 'room', room: roomInfo() }, 2000).chains[0]?.changed).toBe(true);
  });

  it('lists the room’s players and follows each bet from the snapshot to the crash and the next round', () => {
    const waiting = { roundIndex: null, phase: 'waiting', bettingClosesAt: null, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: null, serverTime: 1000 } as const;
    const player = (key: string, handle: string | null, stake: number, targetX100: number | null, status: 'active' | 'queued' = 'active') => ({ key, handle, stake, targetX100, cashoutX100: null, payout: null, status });
    // The snapshot's list is taken as it comes; a queued player waits in it.
    let state = applyMessage(emptyRoomState(), { type: 'state', room: roomInfo(), round: waiting, recent: [], players: [player('a', 'ace', 100, 200), player('q', null, 5, null, 'queued')], you: null }, 1000);
    expect(state.players.map((p) => p.key)).toEqual(['a', 'q']);
    state = applyMessage(state, { type: 'round.betting', roundIndex: 0, serverSeedHash: 'aa'.repeat(32), bettingClosesAt: 6000 }, 1000);
    // A new round keeps only the queue; bets arrive one frame each, and a player's later frame replaces the earlier one.
    expect(state.players.map((p) => p.key)).toEqual(['q']);
    state = applyMessage(state, { type: 'player.bet', player: player('q', null, 5, null) }, 1100);
    state = applyMessage(state, { type: 'player.bet', player: player('b', 'bob', 50, 150) }, 1200);
    state = applyMessage(state, { type: 'player.bet', player: player('c', null, 20, null) }, 1300);
    expect(state.players.map((p) => [p.key, p.status])).toEqual([['q', 'active'], ['b', 'active'], ['c', 'active']]);
    expect(state.players.map((p) => playerOutcome(p, state.round))).toEqual(['placed', 'placed', 'placed']);
    state = applyMessage(state, { type: 'player.left', key: 'c' }, 1400);
    expect(state.players.map((p) => p.key)).toEqual(['q', 'b']);
    state = applyMessage(state, { type: 'round.locked', roundIndex: 0, runningSince: 6000, admitted: 2, rally: { active: false, bettors: 2, percent: 100 } }, 6000);
    expect(playerOutcome(state.players[0]!, state.round)).toBe('riding');
    // A cashout lands on its player alone; one for a key the list lacks changes nothing.
    state = applyMessage(state, { type: 'cashout', roundIndex: 0, targetX100: 150, payout: 75, player: 'b', mine: false }, 6500);
    const unknown = applyMessage(state, { type: 'cashout', roundIndex: 0, targetX100: 300, payout: 1, player: 'zz', mine: false }, 6600);
    expect(unknown.players).toBe(state.players);
    expect(state.players.find((p) => p.key === 'b')).toMatchObject({ cashoutX100: 150, payout: 75 });
    expect(state.players.find((p) => p.key === 'q')).toMatchObject({ cashoutX100: null, payout: null });
    const result: RoundResult = { roundIndex: 0, chainId: 0, crashX100: 180, serverSeed: 'bb'.repeat(32), serverSeedHash: 'aa'.repeat(32), salt: 'deadbeef', houseEdgeBps: 300, rally: { active: false, bettors: 2, percent: 100 }, bettors: 2, winners: 1 };
    state = applyMessage(state, { type: 'round.crashed', result }, 7000);
    // The crashed round's list stays until the next round opens: who won and who lost reads from it.
    expect(state.players.map((p) => playerOutcome(p, state.round))).toEqual(['lost', 'won']);
    state = applyMessage(state, { type: 'player.bet', player: player('n', 'nxt', 10, 200, 'queued') }, 7500);
    expect(playerOutcome(state.players[2]!, state.round)).toBe('queued');
    state = applyMessage(state, { type: 'round.betting', roundIndex: 1, serverSeedHash: 'bb'.repeat(32), bettingClosesAt: 15000 }, 9000);
    expect(state.players.map((p) => p.key)).toEqual(['n']);
  });
});
