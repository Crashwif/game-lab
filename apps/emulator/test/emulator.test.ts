import { chain as fairChain, free } from '@crashwif/crash-math';
import { GameClient } from '@crashwif/game-sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseArgs } from '../src/cli.js';
import { EmulatorRoom } from '../src/engine.js';
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
  });
});

describe('the room', () => {
  it('plays rounds from the chain, settles bets with the maths and queues over the cap', async () => {
    const messages: { to: string | null; type: string }[] = [];
    let now = 1_000_000;
    const room = new EmulatorRoom({ ...scenarioConfig('fixed'), bettingMs: 100, roundDelayMs: 10, tickMs: 10, timeScale: 1, maxBettorsPerRound: 1, chainLength: 50, chainCheckpointInterval: 10 }, (to, m) => messages.push({ to, type: m.type }), () => now);
    const a = room.createSession();
    const b = room.createSession();
    expect(room.bet(a.sessionId, 10, 150).type).toBe('error'); // not started
    const upcoming = room.upcoming(3);
    room.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(room.bet(a.sessionId, 10, 150)).toEqual({ type: 'bet.result', ok: true, status: 'accepted' });
    expect(room.bet(b.sessionId, 10, 150)).toEqual({ type: 'bet.result', ok: true, status: 'queued' });
    expect(room.bet(a.sessionId, 10, 150)).toEqual({ type: 'error', code: 'already_bet' });
    expect(room.bet(b.sessionId, 5_000, 150)).toEqual({ type: 'error', code: 'already_bet' });
    expect(a.creditsLeft).toBe(990);
    // Let the round lock and run to its crash.
    await new Promise((r) => setTimeout(r, 120));
    const crash = upcoming[0]!.crashX100;
    now += free.msToReach(crash) + 10_000;
    await new Promise((r) => setTimeout(r, free.msToReach(crash) + 100));
    const crashed = room.recent(1)[0];
    expect(crashed?.crashX100).toBe(crash);
    expect(crashed?.roundIndex).toBe(0);
    expect(a.creditsLeft).toBe(990 + free.payout(10, 150, crash, 1));
    expect(messages.some((m) => m.type === 'round.crashed')).toBe(true);
    room.stop();
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
    expect(rounds.settled).toBeGreaterThanOrEqual(2);
    expect(fairChain.hashSeed(rounds.rounds[1].serverSeed)).toBe(rounds.rounds[0].serverSeed);
    expect((await (await fetch(`${base}/dev/control/pause`, { method: 'POST' })).json()).paused).toBe(true);
    expect((await (await fetch(`${base}/dev/control/bots`, { method: 'POST', body: JSON.stringify({ count: 3 }) })).json()).botsAdded).toBe(3);
    expect((await fetch(`${base}/rooms/other`)).status).toBe(404);
  }, 15_000);
});
