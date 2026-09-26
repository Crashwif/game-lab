import { chain as fairChain, free } from '@crashwif/crash-math';
import { describe, expect, it, vi } from 'vitest';

import { GameClient, type SocketLike } from '../src/client.js';
import { EMBED_PROTOCOL, EmbeddedGame, hostGame, type GameToHost, type HostToGame, type Transport } from '../src/embed.js';
import { canonicalManifest, validateManifest } from '../src/manifest.js';
import type { RoundResult, ServerMessage } from '../src/protocol.js';
import { ReplayPlayer, replayTimeline, verifyReplay } from '../src/replay.js';
import { applyMessage, emptyRoomState, roomSocketUrl } from '../src/state.js';

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
  return { gameId: 'g', status: 'open', chainId, terminalHash, chainLength: 3, saltSlot: 1, salt, houseEdgeBps: 300, anchorSignature: null, bettingMs: 5000, maxBettorsPerRound: 50, minTargetX100: 101, maxTargetX100: 100000 } as const;
}

class FakeSocket implements SocketLike {
  readyState: 0 | 1 | 2 | 3 = 0;
  sent: string[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(readonly url: string) {}
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
  it('connects with the token, folds messages through the reducer, sends bets and flags a second snapshot', async () => {
    const sockets: FakeSocket[] = [];
    const client = new GameClient({ baseUrl: 'https://play.test', makeSocket: (url) => sockets[sockets.push(new FakeSocket(url)) - 1]! });
    const changes: string[] = [];
    client.on('change', (_s, m) => changes.push(m?.type ?? 'none'));
    client.connect('g-1', async () => 'tok');
    await Promise.resolve();
    await Promise.resolve();
    expect(sockets[0]!.url).toBe('wss://play.test/ws?game=g-1&token=tok');
    sockets[0]!.open();
    expect(client.connected).toBe(true);
    // A round event before the snapshot belongs to a room this client hasn't been shown: ignored.
    sockets[0]!.push({ type: 'round.betting', roundIndex: 0, serverSeedHash: 'x', bettingClosesAt: 1 });
    expect(client.state.round).toBeNull();
    const round = { roundIndex: 0, phase: 'betting', bettingClosesAt: Date.now() + 5000, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: 'aa'.repeat(32), serverTime: Date.now() } as const;
    sockets[0]!.push({ type: 'state', room: roomInfo(), round, recent: [], you: { sessionId: 's', creditsLeft: 1000, roundsLeft: 50, expiresAt: 2e9, ended: false, endReason: null, bet: null } });
    expect(client.state.room?.gameId).toBe('g');
    expect(client.canBet).toBe(true);
    client.bet(100, 200);
    expect(JSON.parse(sockets[0]!.sent[0]!)).toEqual({ type: 'bet', stake: 100, targetX100: 200 });
    sockets[0]!.push({ type: 'state', room: roomInfo(), round, recent: [], you: null });
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
    const client = new GameClient({ baseUrl: 'ws://localhost:4500', makeSocket: (url) => sockets[sockets.push(new FakeSocket(url)) - 1]! });
    client.connect('g-1', async () => `tok-${++n}`);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]!.open();
    sockets[0]!.onclose?.(new CloseEvent('close'));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sockets).toHaveLength(2);
    expect(sockets[1]!.url).toContain('token=tok-2');
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
      state: applyMessage(emptyRoomState(), { type: 'state', room: roomInfo(), round: { roundIndex: 0, phase: 'betting', bettingClosesAt: 5000, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: 'aa'.repeat(32), serverTime: 1000 }, recent: [], you: null }, 1000),
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
    source.state.you = { sessionId: 's', creditsLeft: 900, roundsLeft: 49, expiresAt: 0, ended: false, endReason: null, bet: { stake: 100, targetX100: null, cashoutX100: null, status: 'active' } };
    source.state.round!.phase = 'running';
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
    rallyN: 2,
    bets: [
      { handle: 'Degen', stake: 100, targetX100: 101, won: crash >= 101, payout: free.payout(100, 101, crash, 2) },
      { handle: null, stake: 50, targetX100: crash + 100, won: false, payout: 0 },
    ],
  };

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
    expect(last.at).toBe(1000 + free.msToReach(crash));
    const ticks = timeline.filter((e) => e.event.type === 'tick');
    expect(ticks.every((t) => t.at < last.at)).toBe(true);
    if (round.bets[0]!.won) {
      const cashout = timeline.find((e) => e.event.type === 'cashout')!;
      expect(cashout.at).toBe(1000 + free.msToReach(101));
    }
    expect(replayTimeline(round, { bettingMs: 1000, tickMs: 200 })).toEqual(timeline);
  });

  it('replays a recorded manual cashout before an optional auto target', () => {
    let manualSalt = 'manual-replay-0';
    for (let i = 1; free.crashFromSeed(seed0, manualSalt, 300) < 300; i++) manualSalt = `manual-replay-${i}`;
    const manualCrash = free.crashFromSeed(seed0, manualSalt, 300);
    const elapsed = free.msToReach(150);
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
    expect(verifyReplay({ ...manual, bets: [{ ...manual.bets[0]!, cashoutElapsedMs: elapsed + 1000 }] }).problems).toContain('a manual cashout does not match the published curve or precede the crash and auto target');
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
  it('accepts a well-formed manifest and reports each problem of a bad one', () => {
    const good = validateManifest({ version: 1, name: 'Doge Rocket', description: 'to the moon', templateId: 'space-doge', theme: { category: 'space', mood: 'hype', colors: { background: '#101020', curve: 'rgb(255, 0, 0)' } }, assets: { background: 'bg.png', character: 'doge.png' }, audio: { preset: 'arcade', volume: 0.5 }, renderer: 'builtin-curve', licence: 'derivatives-royalty', royaltyBps: 200, derivativeOf: null });
    expect(good.ok).toBe(true);
    if (good.ok) expect(canonicalManifest(good.manifest)).toContain('"licence":"derivatives-royalty"');
    const bad = validateManifest({ version: 2, name: '', theme: { colors: { Background: 'nope' } }, assets: { hat: '../x' }, audio: {}, renderer: 'custom', licence: 'open', royaltyBps: 5, derivativeOf: 'x' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problems.map((p) => p.path)).toEqual(expect.arrayContaining(['version', 'name', 'theme.category', 'theme.colors.Background', 'assets.hat', 'audio.preset', 'entry', 'royaltyBps', 'derivativeOf']));
  });
});

describe('state helpers', () => {
  it('builds socket URLs and folds a crash reveal that checks out', () => {
    expect(roomSocketUrl('https://play.test', 'g', 'tok')).toBe('wss://play.test/ws?game=g&token=tok');
    const { terminalHash, salt, seed } = committedChain();
    let state = applyMessage(emptyRoomState(), { type: 'state', room: roomInfo(0, terminalHash, salt), round: { roundIndex: null, phase: 'waiting', bettingClosesAt: null, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: null, serverTime: 1000 }, recent: [], you: null }, 1000);
    state = applyMessage(state, { type: 'round.betting', roundIndex: 0, serverSeedHash: terminalHash, bettingClosesAt: 6000 }, 1000);
    const result: RoundResult = { roundIndex: 0, chainId: 0, crashX100: free.crashFromSeed(seed(0), salt, 300), serverSeed: seed(0), serverSeedHash: terminalHash, salt, houseEdgeBps: 300, rally: { active: false, bettors: 0, percent: 100 }, bettors: 0, winners: 0 };
    state = applyMessage(state, { type: 'round.crashed', result }, 7000);
    expect(state.integrity).toEqual([]);
    expect(state.verified[0]).toEqual({ round: 0, seed: seed(0) });
  });
});
