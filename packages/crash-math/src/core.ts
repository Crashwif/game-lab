/**
 * Hashing primitives shared by every crash-math module.
 *
 * Pure JavaScript (@noble/hashes), synchronous, and identical in Node and the
 * browser, so the game server and the public verifier compute the same bytes.
 */
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

/** 2^52: the resolution of the uniform draw taken from a hash. */
export const TWO_POW_52 = 2n ** 52n;

const HEX_32_BYTES = /^[0-9a-f]{64}$/;

/** Throws unless `value` is 32 bytes of lowercase hex (a seed or a hash). */
export function assertSeedHex(name: string, value: string): void {
  if (typeof value !== 'string' || !HEX_32_BYTES.test(value)) {
    throw new TypeError(`${name} must be 64 lowercase hex characters (32 bytes)`);
  }
}

/** SHA-256 of the raw bytes a hex string encodes, as lowercase hex. */
export function sha256Hex(hex: string): string {
  return bytesToHex(sha256(hexToBytes(hex)));
}

/**
 * HMAC-SHA256 keyed by the seed's raw bytes over the salt's UTF-8 bytes.
 * The salt is a public string (for the free layer, a Solana blockhash).
 */
export function roundHash(seedHex: string, salt: string): string {
  assertSeedHex('seedHex', seedHex);
  if (typeof salt !== 'string' || salt.length === 0) {
    throw new TypeError('salt must be a non-empty string');
  }
  return bytesToHex(hmac(sha256, hexToBytes(seedHex), utf8ToBytes(salt)));
}

/** The first 52 bits of a hex hash as an integer in [0, 2^52). */
export function first52Bits(hashHex: string): bigint {
  return BigInt(`0x${hashHex.slice(0, 13)}`);
}
