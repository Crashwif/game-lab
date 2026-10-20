import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Deterministic 32-byte seed for test index i (public, test-only). */
export function testSeed(i: number, namespace = 'crashwif-crash-math-vector'): string {
  return bytesToHex(sha256(utf8ToBytes(`${namespace}:${i}`)));
}

/** Deterministic salt for test index i. */
export function testSalt(i: number): string {
  return `salt-${i % 7}`;
}
