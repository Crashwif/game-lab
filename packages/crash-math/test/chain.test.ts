import { describe, it, expect } from 'vitest';
import { buildChain, deriveSeed, hashSeed, verifyChainLink } from '../src/chain.js';
import { sha256Hex } from '../src/core.js';
import { testSeed } from './helpers.js';

/** Reference: the full chain seed_0 .. seed_length, materialised. */
function fullChain(top: string, length: number): string[] {
  const seeds = new Array<string>(length + 1);
  seeds[length] = top;
  for (let i = length; i >= 1; i -= 1) seeds[i - 1] = sha256Hex(seeds[i]);
  return seeds;
}

describe('hash chain', () => {
  const top = testSeed(42, 'chain-top');
  const length = 5_000;
  const interval = 100;
  const chain = buildChain(top, length, interval);
  const reference = fullChain(top, length);

  it('publishes seed_0 as the terminal hash', () => {
    expect(chain.terminalHash).toBe(reference[0]);
  });

  it('stores one checkpoint per interval (about length / interval)', () => {
    expect(chain.checkpoints.length).toBe(Math.ceil(length / interval));
    expect(chain.checkpoints[0]).toBe(top);
  });

  it('derives every seed exactly as the full chain does', () => {
    for (let i = 1; i <= length; i += 1) {
      expect(deriveSeed(chain, i)).toBe(reference[i]);
    }
  });

  it('matches a full chain for random indexes with a non-dividing length', () => {
    const oddLength = 1_234;
    const odd = buildChain(top, oddLength, 97);
    const ref = fullChain(top, oddLength);
    for (let k = 0; k < 500; k += 1) {
      const i = 1 + ((k * 7919) % oddLength);
      expect(deriveSeed(odd, i)).toBe(ref[i]);
    }
  });

  it('verifies each revealed seed against the previous link', () => {
    expect(verifyChainLink(reference[1], chain.terminalHash)).toBe(true);
    expect(verifyChainLink(reference[2], reference[1])).toBe(true);
    expect(verifyChainLink(reference[3], reference[1])).toBe(false);
    expect(hashSeed(reference[10])).toBe(reference[9]);
  });

  it('rejects out-of-range indexes and bad parameters', () => {
    expect(() => deriveSeed(chain, 0)).toThrow(RangeError);
    expect(() => deriveSeed(chain, length + 1)).toThrow(RangeError);
    expect(() => buildChain(top, 0)).toThrow(RangeError);
    expect(() => buildChain(top, 10, 0)).toThrow(RangeError);
    expect(() => buildChain('nothex', 10)).toThrow(TypeError);
  });
});
