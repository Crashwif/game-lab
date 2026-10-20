import { describe, expect, it } from 'vitest';
import { free } from '@crashwif/crash-math';

import type { ServerMessage } from '../src/protocol.js';
import { applyMessage, emptyRoomState, remember } from '../src/state.js';

const betting: ServerMessage = { type: 'round.betting', roundIndex: 0, serverSeedHash: 'aa'.repeat(32), bettingClosesAt: 5_000 };

describe('the room reducer and bet acknowledgements', () => {
  it('pins the anchor key across room updates and remembered commitments', () => {
    const room = { gameId: 'g', status: 'open' as const, chainId: 0, terminalHash: 'aa'.repeat(32), chainLength: 3, saltSlot: 1, salt: 'deadbeef', houseEdgeBps: 300, curve: free.DEFAULT_CURVE, anchorSignature: 'signature', anchorKey: 'published-key', bettingMs: 5000, maxBettorsPerRound: 50, minTargetX100: 101, maxTargetX100: 100000 };
    const pinned = applyMessage(emptyRoomState(), { type: 'room', room }, 1000);
    expect(applyMessage(pinned, { type: 'room', room }, 1001).integrity).toEqual([]);
    const keylessEvidence = { ...emptyRoomState(), ...remember(emptyRoomState(), [{ ...room, anchorKey: undefined, lastRound: null, lastSeed: null }]) };
    const learned = applyMessage(keylessEvidence, { type: 'room', room }, 1002);
    expect(learned.chains[0]).toMatchObject({ anchorKey: 'published-key', changed: false });
    expect(applyMessage(learned, { type: 'room', room: { ...room, anchorKey: 'other-key' } }, 1003).chains[0]?.changed).toBe(true);
    for (const anchorKey of ['other-key', null, undefined]) {
      expect(applyMessage(pinned, { type: 'room', room: { ...room, anchorKey } }, 1002).chains[0]?.changed).toBe(true);
      const restored = { ...emptyRoomState(), ...remember(emptyRoomState(), [{ ...room, lastRound: null, lastSeed: null }]) };
      expect(applyMessage(restored, { type: 'room', room: { ...room, anchorKey } }, 1002).chains[0]?.changed).toBe(true);
    }
  });

  it("keeps the room's answer to the last bet until the round opens again, and forgets it once the bet is cancelled", () => {
    let state = applyMessage(emptyRoomState(), { type: 'bet.result', ok: true, status: 'accepted' }, 1_000);
    expect(state.lastBet).toBe('accepted');
    state = applyMessage(state, { type: 'bet.result', ok: true, status: 'queued' }, 1_000);
    expect(state.lastBet).toBe('queued');
    // A cancel is acknowledged as such: a game reading lastBet never shows a bet the player just took back.
    state = applyMessage(state, { type: 'error', code: 'betting_closed' }, 1_000);
    state = applyMessage(state, { type: 'bet.result', ok: true, status: 'cancelled' }, 1_000);
    expect(state.lastBet).toBeNull();
    expect(state.lastError).toBeNull();
    state = applyMessage(state, { type: 'bet.result', ok: true, status: 'accepted' }, 1_000);
    state = applyMessage(state, betting, 1_000);
    expect(state.lastBet).toBeNull();
  });
});
