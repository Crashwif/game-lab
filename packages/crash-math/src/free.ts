/**
 * Free-layer crash maths.
 *
 * Used by the free, credits-only game. It makes NO return-to-player claim:
 * with a 3% nominal edge the RTP at a 2.00x target is about 96.5%, and the
 * rally bonus can push effective payouts above 100%, which is fine for credits
 * that have no value. Real-money maths lives in ./casino and never uses this.
 *
 *   hash  = HMAC-SHA256(key = seed bytes, msg = salt UTF-8)
 *   if hash mod floor(10000 / edgeBps) == 0  -> crash at 1.00x   (instant crash)
 *   h     = first 52 bits of hash, e = 2^52
 *   crash = floor((100e - h) / (e - h))  in hundredths (x100)
 *
 * This is the standard bustabit construction; P(crash >= m) = (1 - 1/d) * 99 / (100m - 1)
 * for d = floor(10000 / edgeBps).
 */
import { TWO_POW_52, first52Bits, roundHash } from './core.js';

export const DEFAULT_EDGE_BPS = 300;
/** The rally bonus stops growing at this many bettors (+50%). */
export const RALLY_MAX_BETTORS = 50;
/** Growth rate of the displayed multiplier curve, per millisecond. */
export const GROWTH_RATE_PER_MS = 0.00006;

function instantCrashDivisor(edgeBps: number): bigint {
  if (!Number.isInteger(edgeBps) || edgeBps < 1 || edgeBps > 5000) {
    throw new RangeError('edgeBps must be an integer between 1 and 5000');
  }
  return BigInt(Math.floor(10000 / edgeBps));
}

/** Crash point in hundredths (100 = 1.00x) for one round. */
export function crashFromSeed(seedHex: string, salt: string, edgeBps: number = DEFAULT_EDGE_BPS): number {
  const divisor = instantCrashDivisor(edgeBps);
  const hash = roundHash(seedHex, salt);
  if (BigInt(`0x${hash}`) % divisor === 0n) {
    return 100;
  }
  const h = first52Bits(hash);
  return Number((100n * TWO_POW_52 - h) / (TWO_POW_52 - h));
}

/** Rally multiplier in percent: 100 + min(bettors, 50). */
export function rallyPercent(bettors: number): number {
  if (!Number.isInteger(bettors) || bettors < 0) {
    throw new RangeError('bettors must be a non-negative integer');
  }
  return 100 + Math.min(bettors, RALLY_MAX_BETTORS);
}

/**
 * Credits paid for one bet: stake x exit multiplier x (1 + 0.01 x min(N, 50)), floored,
 * when the exit is at or below the crash point; otherwise 0. Manual exits can
 * occur at 1.00x; automatic targets start at 1.01x.
 * `targetX100` and `crashX100` are in hundredths; `rallyBettors` is N, the
 * number of bettors locked in before the crash point was revealed (0 = no bonus).
 */
export function payout(stake: number, targetX100: number, crashX100: number, rallyBettors = 0): number {
  if (!Number.isSafeInteger(stake) || stake < 0) {
    throw new RangeError('stake must be a non-negative safe integer');
  }
  if (!Number.isInteger(targetX100) || targetX100 < 100) {
    throw new RangeError('targetX100 must be an integer of at least 100 (1.00x)');
  }
  if (!Number.isInteger(crashX100) || crashX100 < 100) {
    throw new RangeError('crashX100 must be an integer of at least 100');
  }
  if (targetX100 > crashX100) {
    return 0;
  }
  const paid = (BigInt(stake) * BigInt(targetX100) * BigInt(rallyPercent(rallyBettors))) / 10000n;
  return Number(paid);
}

/** Continuous display curve in hundredths; rendering can follow it without cent-sized steps. */
export function multiplierAtContinuousX100(elapsedMs: number): number {
  if (!(elapsedMs >= 0)) {
    return 100;
  }
  return 100 * Math.exp(GROWTH_RATE_PER_MS * elapsedMs);
}

/** Displayed multiplier (hundredths) after `elapsedMs` of a running round. Display only. */
export function multiplierAtX100(elapsedMs: number): number {
  return Math.floor(multiplierAtContinuousX100(elapsedMs));
}

/** Milliseconds until the displayed curve first reaches `x100`. Inverse of multiplierAtX100. */
export function msToReach(x100: number): number {
  if (!Number.isInteger(x100) || x100 < 100) {
    throw new RangeError('x100 must be an integer of at least 100');
  }
  let ms = Math.ceil(Math.log(x100 / 100) / GROWTH_RATE_PER_MS);
  // Guard against floating-point rounding at the boundary.
  while (ms > 0 && multiplierAtX100(ms - 1) >= x100) ms -= 1;
  while (multiplierAtX100(ms) < x100) ms += 1;
  return ms;
}

/**
 * Rally-bonus schedule: the bonus runs in
 * alternating blocks (off, on, off, on, ...) from the moment the session opens,
 * so its effect on behaviour is not tied to time in the session. Whether a
 * round gets the bonus is decided when its betting locks.
 */

export interface RallyBlock {
  /** 0-based block number since the session opened. */
  block: number;
  active: boolean;
}

export function rallyBlockAt(elapsedMs: number, blockMs: number, startsActive: boolean): RallyBlock {
  if (!Number.isInteger(blockMs) || blockMs <= 0) {
    throw new RangeError('blockMs must be a positive integer');
  }
  const block = Math.max(0, Math.floor(elapsedMs / blockMs));
  const even = block % 2 === 0;
  return { block, active: startsActive ? even : !even };
}
