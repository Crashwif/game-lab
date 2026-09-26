/**
 * The round verifier over random chains: an honest chain always verifies, and
 * any single tampered seed or crash point is caught at that round.
 */
import { describe, expect, it } from 'vitest';

import { hashSeed } from '../src/chain.js';
import { crashFromSeed } from '../src/free.js';
import { startVerification, verifyRounds } from '../src/verify.js';

function rng(seed: number) {
  let s = seed >>> 0;
  return (n: number) => {
    s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0;
    return s % n;
  };
}

const hex = (r: (n: number) => number) => Array.from({ length: 32 }, () => r(256).toString(16).padStart(2, '0')).join('');

function randomChain(seed: number) {
  const r = rng(seed);
  const length = 2 + r(40);
  const seeds = [hex(r)];
  for (let i = 0; i < length; i++) seeds.unshift(hashSeed(seeds[0]!));
  const salt = `Salt${seed}`;
  const edge = 1 + r(500);
  const chain = { chainId: 0, terminalHash: seeds[0]!, saltSlot: 1, salt, houseEdgeBps: edge };
  const rounds = seeds.slice(1).map((s, roundIndex) => ({ roundIndex, seed: s, crashX100: crashFromSeed(s, salt, edge) }));
  return { r, chain, rounds };
}

describe('verifyRounds over random chains', () => {
  it('accepts every honest chain, in any page split', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { r, chain, rounds } = randomChain(seed);
      const cut = r(rounds.length + 1);
      const state = verifyRounds(chain, rounds.slice(cut), verifyRounds(chain, rounds.slice(0, cut), startVerification(chain)));
      expect(state).toMatchObject({ checked: rounds.length, failures: [] });
    }
  });

  it('catches any single tampered seed or crash point at that round', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { r, chain, rounds } = randomChain(seed);
      const at = r(rounds.length);
      const tampered = rounds.map((round) => ({ ...round }));
      if (r(2)) tampered[at]!.seed = hex(r);
      else tampered[at]!.crashX100 += 1 + r(1_000);
      const { failures } = verifyRounds(chain, tampered, startVerification(chain));
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0]!.roundIndex).toBe(at);
    }
  });
});
