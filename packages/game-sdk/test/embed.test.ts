import { free } from '@crashwif/crash-math';
/**
 * The host's bound on a game's bets and the reason it gives for not taking them: a creator's renderer may ask to
 * bet, but only up to the stake the player set on the host's own controls, and it is told why betting is off
 * rather than left to guess.
 */
import { describe, expect, it, vi } from 'vitest';

import { EMBED_PROTOCOL, EmbeddedGame, hostGame, type GameToHost, type HostToGame, type Transport } from '../src/embed.js';
import type { RoomInfo, ServerMessage } from '../src/protocol.js';
import { applyMessage, emptyRoomState } from '../src/state.js';

const roomInfo = (): RoomInfo => ({
  gameId: 'g',
  status: 'open',
  chainId: 0,
  terminalHash: 'ab'.repeat(32),
  chainLength: 10,
  saltSlot: 100,
  salt: 'salt',
  houseEdgeBps: 100,
  curve: free.DEFAULT_CURVE,
  anchorSignature: null,
  bettingMs: 5_000,
  maxBettorsPerRound: 50,
  minTargetX100: 101,
  maxTargetX100: 100_000,
});

const betting = { roundIndex: 0, phase: 'betting', bettingClosesAt: 5_000, runningSince: null, multiplierX100: 100, admitted: 0, queued: 0, rally: { active: false, bettors: 0, percent: 100 }, crashX100: null, serverSeedHash: 'aa'.repeat(32), serverTime: 1_000 } as const;

/** Two ends of an in-memory bridge. */
function pair(): [Transport<HostToGame, GameToHost>, Transport<GameToHost, HostToGame>] {
  const toGame: ((m: HostToGame) => void)[] = [];
  const toHost: ((m: GameToHost) => void)[] = [];
  return [
    { send: (m) => toGame.forEach((h) => h(m)), listen: (h) => (toHost.push(h), () => void toHost.splice(toHost.indexOf(h), 1)) },
    { send: (m) => toHost.forEach((h) => h(m)), listen: (h) => (toGame.push(h), () => void toGame.splice(toGame.indexOf(h), 1)) },
  ];
}

/** A host over an in-memory bridge whose verdict the test moves, recording what reaches the room and the game. */
function bridge(verdict: { allowed: boolean; reason: string | null; maxStake?: number | null }) {
  const [hostSide, gameSide] = pair();
  const sent: unknown[] = [];
  const source = {
    state: applyMessage(emptyRoomState(), { type: 'state', room: roomInfo(), round: betting, recent: [], players: [], you: null }, 1_000),
    on: (_e: 'message', _h: (m: ServerMessage, now: number, fresh: boolean) => void) => () => {},
    send: (m: unknown) => sent.push(m),
  };
  const toGame: HostToGame[] = [];
  gameSide.listen((m) => toGame.push(m));
  const current = { verdict };
  const host = hostGame({ transport: hostSide, client: source, manifest: {}, allowBets: () => current.verdict });
  const game = new EmbeddedGame(gameSide);
  const refused: string[] = [];
  game.on('refused', (_m, reason) => refused.push(reason));
  return { host, game, sent, toGame, refused, set: (next: typeof verdict) => ((current.verdict = next), host.setAllowed()) };
}

describe('the host’s bound on a game’s bets', () => {
  it('refuses a bet above the player’s limit before it reaches the room, and relays one within it', () => {
    const b = bridge({ allowed: true, reason: null, maxStake: 100 });
    expect(b.game.maxStake).toBe(100);
    b.game.bet(101, null);
    expect(b.refused).toEqual(['stake above your limit of 100 credits']);
    expect(b.sent).toEqual([]);
    b.game.bet(100, 250);
    expect(b.sent).toEqual([{ type: 'bet', stake: 100, targetX100: 250 }]);
    b.host.close();
    b.game.close();
  });

  it('tells the game its new limit when the player changes it, and lifts it when the host sets none', () => {
    const b = bridge({ allowed: true, reason: null, maxStake: 100 });
    const allows = () => b.toGame.filter((m): m is Extract<HostToGame, { type: 'allow' }> => m.type === 'allow');
    const seen = vi.fn();
    b.game.on('allow', seen);
    b.set({ allowed: true, reason: null, maxStake: 25 });
    expect(allows().at(-1)).toMatchObject({ allowBets: true, maxStake: 25 });
    expect(seen).toHaveBeenLastCalledWith(true, null, 25);
    expect(b.game.maxStake).toBe(25);
    b.game.bet(50, null);
    expect(b.refused).toEqual(['stake above your limit of 25 credits']);
    // The same verdict again sends nothing.
    b.set({ allowed: true, reason: null, maxStake: 25 });
    expect(allows()).toHaveLength(1);
    b.set({ allowed: true, reason: null });
    expect(b.game.maxStake).toBeNull();
    b.game.bet(5_000, null);
    expect(b.sent).toEqual([{ type: 'bet', stake: 5_000, targetX100: null }]);
    b.host.close();
    b.game.close();
  });

  it('refuses a malformed bet as invalid before weighing it against the limit', () => {
    const b = bridge({ allowed: true, reason: null, maxStake: 10 });
    b.game.bet(10.5, null);
    b.game.bet(20, 50);
    expect(b.refused).toEqual(['invalid bet', 'invalid bet']);
    expect(b.sent).toEqual([]);
    b.host.close();
    b.game.close();
  });
});

describe('why the host is not taking bets', () => {
  it('gives the game the host’s reason from the start, so a spectator’s game can say to get a pass', () => {
    const b = bridge({ allowed: false, reason: 'get a play pass to bet' });
    const init = b.toGame.find((m): m is Extract<HostToGame, { type: 'init' }> => m.type === 'init');
    expect(init).toMatchObject({ allowBets: false, reason: 'get a play pass to bet', maxStake: null });
    expect(b.game.canBet).toBe(false);
    expect(b.game.betsBlockedBecause).toBe('get a play pass to bet');
    b.game.bet(10, null);
    expect(b.refused).toEqual(['get a play pass to bet']);
    b.set({ allowed: false, reason: 'the chain is still being checked' });
    expect(b.game.betsBlockedBecause).toBe('the chain is still being checked');
    b.set({ allowed: true, reason: null, maxStake: 100 });
    expect(b.game.betsBlockedBecause).toBeNull();
    b.host.close();
    b.game.close();
  });

  it('falls back to the host not taking bets when a host gives no reason', () => {
    const [hostSide, gameSide] = pair();
    const game = new EmbeddedGame(gameSide);
    hostSide.send({ proto: EMBED_PROTOCOL, type: 'init', manifest: {}, state: emptyRoomState(), allowBets: false } as HostToGame);
    expect(game.betsBlockedBecause).toBe('the host is not taking bets');
    expect(game.maxStake).toBeNull();
    game.close();
  });
});
