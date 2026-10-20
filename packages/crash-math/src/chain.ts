/**
 * Hash-chain commitments for provably fair rounds.
 *
 *   seed_N  = random 32 bytes (secret)
 *   seed_i-1 = SHA-256(seed_i)
 *   terminalHash = seed_0 (published before any round)
 *
 * Round k uses seed_k, starting at k = 1. Revealing seed_k lets anyone check
 * SHA-256(seed_k) == seed_{k-1}, all the way back to the published terminal hash.
 *
 * Only seed_N and a checkpoint every `interval` links are stored:
 * about 32 KB per room for a million rounds instead of 32 MB. Any seed is
 * rebuilt with at most `interval - 1` hashes from the next checkpoint above it.
 * Checkpoints reveal every seed below them, so they are as secret as seed_N.
 */
import { assertSeedHex, sha256Hex } from './core.js';

export interface ChainCheckpoints {
  /** Number of usable seeds (seed_1 .. seed_length). */
  length: number;
  /** Distance between stored checkpoints. */
  interval: number;
  /** seed_0, the public commitment. */
  terminalHash: string;
  /** checkpoints[j] = seed at index length - j * interval (j = 0 is seed_N). */
  checkpoints: string[];
}

/** SHA-256 of a seed: the value the previous link must equal. */
export function hashSeed(seedHex: string): string {
  assertSeedHex('seedHex', seedHex);
  return sha256Hex(seedHex);
}

/** True when SHA-256(seed) equals the previous link (or the terminal hash for seed_1). */
export function verifyChainLink(seedHex: string, previousHex: string): boolean {
  assertSeedHex('previousHex', previousHex);
  return hashSeed(seedHex) === previousHex;
}

/** Builds the chain from its secret top seed, keeping only checkpoints. */
export function buildChain(topSeedHex: string, length: number, interval = 1000): ChainCheckpoints {
  assertSeedHex('topSeedHex', topSeedHex);
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError('length must be a positive integer');
  }
  if (!Number.isInteger(interval) || interval < 1) {
    throw new RangeError('interval must be a positive integer');
  }
  const checkpoints: string[] = [];
  let seed = topSeedHex;
  for (let index = length; index >= 1; index -= 1) {
    if ((length - index) % interval === 0) {
      checkpoints.push(seed);
    }
    seed = sha256Hex(seed);
  }
  return { length, interval, terminalHash: seed, checkpoints };
}

/** Rebuilds seed_index (1 <= index <= length) from the stored checkpoints. */
export function deriveSeed(chain: ChainCheckpoints, index: number): string {
  if (!Number.isInteger(index) || index < 1 || index > chain.length) {
    throw new RangeError(`index must be an integer between 1 and ${chain.length}`);
  }
  // Nearest checkpoint at or above index: checkpoint j sits at length - j * interval.
  const j = Math.floor((chain.length - index) / chain.interval);
  let seed = chain.checkpoints[j];
  for (let at = chain.length - j * chain.interval; at > index; at -= 1) {
    seed = sha256Hex(seed);
  }
  return seed;
}
