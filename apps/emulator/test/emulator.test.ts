import { chain as fairChain, free } from '@crashwif/crash-math';
import { verifyRoomChain } from '@crashwif/crash-math/verify';
import { GameClient } from '@crashwif/game-sdk';
import type { ServerMessage } from '@crashwif/game-sdk/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { parseArgs } from '../src/cli.js';
import { EmulatorRoom, playerKey } from '../src/engine.js';
import { FIXED_SALT, FIXED_TOP_SEED, findEdgeSeed, scenarioConfig } from '../src/scenarios.js';
import { EmulatorServer } from '../src/server.js';

describe('scenarios', () => {
  it('fixed and edge scenarios replay the same rounds every time', () => {
    const fixed = scenarioConfig('fixed');
    expect(fixed).toMatchObject({ topSeed: FIXED_TOP_SEED, salt: FIXED_SALT });
    const edge = scenarioConfig('edge', { chainLength: 200, chainCheckpointInterval: 50 });
    const chain = fairChain.buildChain(edge.topSeed!, 200, 50);
    const first = Array.from({ length: 12 }, (_, i) => free.crashFromSeed(fairChain.deriveSeed(chain, i + 1), FIXED_SALT, 300));
    expect(first).toContain(100);
    expect(Math.max(...first)).toBeGreaterThanOrEqual(1000);
    expect(findEdgeSeed(FIXED_SALT, 300, 200, 50)).toBe(edge.topSeed);
    expect(scenarioConfig('stress').bots).toBe(200);
  });

  it('parses the command line', () => {
    expect(parseArgs(['--port', '4600', '--scenario', 'edge', '--time-scale', '10', '--quiet'])).toMatchObject({ port: 4600, scenario: 'edge', quiet: true, config: { timeScale: 10 } });
    expect(() => parseArgs(['--scenario', 'nope'])).toThrow(/one of/);
    expect(() => parseArgs(['--seed', 'xyz'])).toThrow(/64 hex/);
    // Room ids are lowercase, as the game server's are and as the verifier requests them.
    expect(parseArgs(['--game', 'my-game']).config.gameId).toBe('my-game');
    expect(() => parseArgs(['--game', 'My-Game'])).toThrow(/lowercase/);
  });
});

describe('the room', () => {
  it('preserves remaining session time through pauses without reviving expired sessions', () => {
    let now = 1_000_000;
    const room = new EmulatorRoom({ ...scenarioConfig('fixed'), sessionMinutes: 1 }, () => {}, () => now);
    const session = room.createSession();
    const expired = room.createSession();
    expired.expiresAt = now;
    room.pause();
    now += 120_000;
    room.pause();
    expect(room.you(session.sessionId)).toMatchObject({ pausedAt: 1_000_000, expiresAt: 1_060_000, ended: false });
    const during = room.createSession();
    expect(during.pausedAt).toBe(now);
    room.resume();
    expect(session).toMatchObject({ pausedAt: null, expiresAt: 1_180_000 });
    expect(during).toMatchObject({ pausedAt: null, expiresAt: 1_180_000 });
    expect(expired.expiresAt).toBe(1_000_000);
    room.resume();
    expect(session.expiresAt).toBe(1_180_000);
    room.stop();
  });

  it('plays rounds from the chain, settles bets with the maths and queues over the cap', async () => {
    const messages: { to: string | null; type: string; message: ServerMessage }[] = [];
    let now = 1_000_000;
    const room = new EmulatorRoom({ ...scenarioConfig('fixed'), bettingMs: 100, roundDelayMs: 10, tickMs: 10, timeScale: 1, maxBettorsPerRound: 1, chainLength: 50, chainCheckpointInterval: 10 }, (to, m) => messages.push({ to, type: m.type, message: m }), () => now);
    const a = room.createSession(false, 'ace_hi');
    const b = room.createSession(false, 'not a handle');
    expect([a.handle, b.handle]).toEqual(['ace_hi', null]);
    expect(room.bet(a.sessionId, 10, 150).type).toBe('error'); // not started
    const upcoming = room.upcoming(3);
    room.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(room.bet(a.sessionId, 10, 150)).toEqual({ type: 'bet.result', ok: true, status: 'accepted' });
    expect(room.bet(b.sessionId, 10, 150)).toEqual({ type: 'bet.result', ok: true, status: 'queued' });
    expect(room.bet(a.sessionId, 10, 150)).toEqual({ type: 'error', code: 'already_bet' });
    expect(room.bet(b.sessionId, 5_000, 150)).toEqual({ type: 'error', code: 'already_bet' });
    expect(a.creditsLeft).toBe(990);
    // Everyone is told who bet, by key and ranking name, as the game server tells them; the snapshot lists the same.
    const told = messages.filter((m) => m.type === 'player.bet').map((m) => (m.message as Extract<ServerMessage, { type: 'player.bet' }>).player);
    expect(told).toEqual([
      { key: playerKey(a.sessionId), handle: 'ace_hi', stake: 10, targetX100: 150, cashoutX100: null, payout: null, status: 'active' },
      { key: playerKey(b.sessionId), handle: null, stake: 10, targetX100: 150, cashoutX100: null, payout: null, status: 'queued' },
    ]);
    expect(room.players()).toEqual(told);
    expect(room.you(a.sessionId)?.playerKey).toBe(playerKey(a.sessionId));
    expect(JSON.stringify(told)).not.toContain(a.sessionId);
    // Let the round lock and run to its crash.
    await new Promise((r) => setTimeout(r, 120));
    const crash = upcoming[0]!.crashX100;
    now += free.msToReach(crash, free.DEFAULT_CURVE) + 10_000;
    await new Promise((r) => setTimeout(r, free.msToReach(crash, free.DEFAULT_CURVE) + 100));
    const crashed = room.recent(1)[0];
    expect(crashed?.crashX100).toBe(crash);
    expect(crashed?.roundIndex).toBe(0);
    expect(a.creditsLeft).toBe(990 + free.payout(10, 150, crash, 1));
    expect(messages.some((m) => m.type === 'round.crashed')).toBe(true);
    // The queued player stays listed through the pause and is placed, and listed again, when the next round opens.
    const crashedAt = messages.findIndex((m) => m.type === 'round.crashed');
    const next = messages.slice(crashedAt).filter((m) => m.type === 'player.bet').map((m) => (m.message as Extract<ServerMessage, { type: 'player.bet' }>).player);
    expect(next).toEqual([{ key: playerKey(b.sessionId), handle: null, stake: 10, targetX100: 150, cashoutX100: null, payout: null, status: 'active' }]);
    if (crash >= 150) expect(messages.find((m) => m.type === 'cashout' && m.to === null)?.message).toMatchObject({ player: playerKey(a.sessionId), targetX100: 150, mine: false });
    room.stop();
  });

  it('refuses a game id with capitals, which the socket, the routes and the verifier would disagree on', () => {
    expect(() => new EmulatorRoom({ gameId: 'MyGame' }, () => {})).toThrow(/lowercase/);
    expect(new EmulatorRoom({ gameId: 'my-game' }, () => {}).info().gameId).toBe('my-game');
  });
});

describe('the server', () => {
  let server: EmulatorServer;
  beforeAll(async () => {
    server = new EmulatorServer({ port: 0, scenario: 'fixed', config: { bettingMs: 10_000, roundDelayMs: 100, tickMs: 20, timeScale: 25, chainLength: 100, chainCheckpointInterval: 10 } });
    await server.listen();
  });
  afterAll(() => server.close());

  it('serves the room, mints sessions, and the SDK client plays a verified round over the real socket', async () => {
    const base = `http://127.0.0.1:${server.port}`;
    expect((await (await fetch(`${base}/health`)).json()).emulator).toBe(true);
    const roomBody = await (await fetch(`${base}/rooms/emulator-game`)).json();
    expect(roomBody.room.terminalHash).toHaveLength(64);
    const session = await (await fetch(`${base}/dev/sessions`, { method: 'POST', body: '{}' })).json();
    expect(session.credits).toBe(1000);
    expect(session.socketUrl).toBe(`ws://127.0.0.1:${server.port}/ws?game=emulator-game`);
    expect(session.protocols).toEqual(['crashwif.room.v1', `crashwif.token.${session.token}`]);
    const upcoming = (await (await fetch(`${base}/dev/upcoming?n=3`)).json()).upcoming as { roundIndex: number; crashX100: number }[];

    const client = new GameClient({ baseUrl: base });
    const crashes: number[] = [];
    client.on('message', (m) => {
      if (m.type === 'round.crashed') crashes.push(m.result.crashX100);
    });
    client.connect('emulator-game', session.token);
    await new Promise<void>((resolve) => client.on('connected', () => resolve()));
    // Bet as soon as a fresh betting window is announced.
    let crashesBeforeBet = 0;
    const accepted = new Promise<void>((resolve, reject) => {
      const stop = client.on('message', (message) => {
        if (message.type === 'bet.result' && message.status === 'accepted') { stop(); resolve(); }
        else if (message.type === 'error') { stop(); reject(new Error(`bet refused: ${message.code}`)); }
      });
    });
    await new Promise<void>((resolve) => {
      const stop = client.on('message', (message) => {
        if (message.type === 'round.betting' && client.state.you && !client.state.you.bet) {
          crashesBeforeBet = crashes.length;
          client.bet(25, 200);
          stop();
          resolve();
        }
      });
    });
    await accepted;
    await new Promise<void>((resolve) => {
      const stop = client.on('change', () => {
        if (crashes.length >= Math.max(2, crashesBeforeBet + 1)) {
          stop();
          resolve();
        }
      });
    });
    expect(client.state.integrity).toEqual([]);
    const seen = new Set(crashes);
    expect(upcoming.some((u) => seen.has(u.crashX100))).toBe(true);
    expect(client.state.verified[0]?.round).toBeGreaterThanOrEqual(0);
    // A 25-credit bet at 2.00x settles to 975 or 1,025, never back to 1,000; and it used a round.
    expect(client.state.you?.creditsLeft).not.toBe(1000);
    expect(client.state.you?.roundsLeft).toBeLessThan(session.rounds);
    client.close();

    const chains = await (await fetch(`${base}/rooms/emulator-game/chains`)).json();
    expect(chains.chains[0].nextIndex).toBeGreaterThanOrEqual(2);
    const rounds = await (await fetch(`${base}/rooms/emulator-game/chains/0/rounds`)).json();
    expect(rounds.chain.nextIndex).toBeGreaterThanOrEqual(2);
    expect(fairChain.hashSeed(rounds.rounds[1].seed)).toBe(rounds.rounds[0].seed);
    expect((await (await fetch(`${base}/dev/control/pause`, { method: 'POST' })).json()).paused).toBe(true);
    expect((await (await fetch(`${base}/dev/control/bots`, { method: 'POST', body: JSON.stringify({ count: 3 }) })).json()).botsAdded).toBe(3);
    expect((await fetch(`${base}/rooms/other`)).status).toBe(404);
  }, 15_000);

  it('reads the session token from the subprotocol and ignores one in the URL', async () => {
    const base = `http://127.0.0.1:${server.port}`;
    const session = await (await fetch(`${base}/dev/sessions`, { method: 'POST', body: '{}' })).json();
    const snapshot = (url: string, protocols: string[]) =>
      new Promise<{ protocol: string; you: { sessionId: string } | null }>((resolve, reject) => {
        const ws = new WebSocket(url, protocols);
        ws.once('error', reject);
        ws.once('message', (data) => {
          const state = JSON.parse(String(data)) as { you: { sessionId: string } | null };
          ws.close();
          resolve({ protocol: ws.protocol, you: state.you });
        });
      });
    const player = await snapshot(session.socketUrl, session.protocols);
    expect(player.protocol).toBe('crashwif.room.v1');
    expect(player.you?.sessionId).toBe(session.sessionId);
    expect(await snapshot(session.socketUrl, [])).toEqual({ protocol: '', you: null });
    expect(await snapshot(`${session.socketUrl}&token=${session.token}`, ['crashwif.room.v1'])).toEqual({ protocol: 'crashwif.room.v1', you: null });
  });

  it('sends the session expiry as epoch milliseconds, as the game server does', async () => {
    const base = `http://127.0.0.1:${server.port}`;
    const before = Date.now();
    const session = await (await fetch(`${base}/dev/sessions`, { method: 'POST', body: '{}' })).json();
    const after = Date.now();
    const you = await new Promise<{ expiresAt: number }>((resolve, reject) => {
      const ws = new WebSocket(session.socketUrl, session.protocols);
      ws.once('error', reject);
      ws.once('message', (data) => {
        ws.close();
        resolve((JSON.parse(String(data)) as { you: { expiresAt: number } }).you);
      });
    });
    const sessionMs = server.room.cfg.sessionMinutes * 60_000;
    expect(you.expiresAt).toBeGreaterThan(Date.now());
    expect(you.expiresAt).toBeGreaterThanOrEqual(before + sessionMs);
    expect(you.expiresAt).toBeLessThanOrEqual(after + sessionMs);
    expect(you.expiresAt).toBe(session.expiresAt);
  });
});

describe('verification against the emulator', () => {
  const GAME = 'emulator-game';
  let server: EmulatorServer;
  let base: string;
  beforeAll(async () => {
    // Four-round chains, so the room retires chain 0 and plays on into chain 1; the pause between rounds
    // leaves time to stop the room there, two rounds before chain 1 runs out.
    server = new EmulatorServer({ port: 0, scenario: 'fixed', config: { bettingMs: 1_000, roundDelayMs: 20_000, tickMs: 100, timeScale: 100, chainLength: 4, chainCheckpointInterval: 2 } });
    await server.listen();
    base = `http://127.0.0.1:${server.port}`;
    const deadline = Date.now() + 20_000;
    const waitFor = async (done: () => boolean) => {
      while (!done()) {
        if (Date.now() > deadline) throw new Error('the emulator did not settle rounds into a second chain');
        await new Promise((r) => setTimeout(r, 5));
      }
    };
    await waitFor(() => server.room.recent(2).filter((r) => r.chainId === 1).length === 2);
    server.room.pause();
    await waitFor(() => server.room.publicRound().phase === 'waiting');
  }, 30_000);
  afterAll(() => server.close());

  it('verifies a retired chain and the active one with verifyRoomChain, with the anchor checks not run', async () => {
    const retired = await verifyRoomChain(base, GAME, 0, { pageSize: 3 });
    expect(retired.state.failures).toEqual([]);
    expect(retired.state.checked).toBe(4);
    expect(retired.chain).toMatchObject({ chainId: 0, chainLength: 4, nextIndex: 4, anchorSignature: null });
    expect(retired).toMatchObject({ salt: null, anchor: null, history: null, listingError: null, consistency: null });
    expect(retired.listing?.map((c) => [c.chainId, c.retired])).toEqual([
      [0, true],
      [1, false],
    ]);

    const active = await verifyRoomChain(base, GAME, 1, { pageSize: 1 });
    expect(active.state.failures).toEqual([]);
    expect(active.state.checked).toBeGreaterThanOrEqual(2);
    expect(active.state.checked).toBe(active.chain.nextIndex);
    expect(active.consistency).toBeNull();
  });

  it('pages settled rounds and lists chains in the game server shapes', async () => {
    const { chains } = await (await fetch(`${base}/rooms/${GAME}/chains`)).json();
    expect(Object.keys(chains[0]).sort()).toEqual(['anchorSignature', 'anchorSlot', 'chainId', 'chainLength', 'createdAt', 'houseEdgeBps', 'nextIndex', 'retired', 'retiredAt', 'salt', 'saltSlot', 'terminalHash']);
    expect(chains[0]).toMatchObject({ chainId: 0, chainLength: 4, nextIndex: 4, saltSlot: 0, salt: FIXED_SALT, anchorSignature: null, anchorSlot: null, retired: true });
    expect(Date.parse(chains[0].retiredAt)).toBeGreaterThanOrEqual(Date.parse(chains[0].createdAt));
    expect(chains[1]).toMatchObject({ chainId: 1, retired: false, retiredAt: null });

    const page = (from: number, limit: number) => fetch(`${base}/rooms/${GAME}/chains/0/rounds?from=${from}&limit=${limit}`).then((r) => r.json());
    const first = await page(0, 3);
    expect(first.chain).toEqual(chains[0]);
    expect(first.rounds.map((r: { roundIndex: number }) => r.roundIndex)).toEqual([0, 1, 2]);
    expect(Object.keys(first.rounds[0]).sort()).toEqual(['crashX100', 'roundIndex', 'seed', 'settledAt']);
    expect(first.rounds[0].seed).toMatch(/^[0-9a-f]{64}$/);
    expect(fairChain.hashSeed(first.rounds[0].seed)).toBe(chains[0].terminalHash);
    expect(first.next).toBe(3);
    const last = await page(3, 3);
    expect(last.rounds.map((r: { roundIndex: number }) => r.roundIndex)).toEqual([3]);
    expect(last.next).toBeNull();
    // A full page names the next index even when nothing follows, as the game server does.
    expect((await page(2, 2)).next).toBe(4);
    expect(await page(4, 2)).toMatchObject({ rounds: [], next: null });

    const missing = await fetch(`${base}/rooms/${GAME}/chains/9/rounds`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'chain_not_found' });
  });
});
