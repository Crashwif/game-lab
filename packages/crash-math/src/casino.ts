/**
 * Casino crash maths.
 *
 * For the certified real-money game StudioCo ships through casino partners.
 * No rally bonus. The return to player is exact for every target:
 *
 *   X = (rtp) * e / (e - r)      with r uniform in [0, 2^52), e = 2^52
 *   P(X >= m) = rtp / m          for every m >= 1, so  m * P(X >= m) = rtp
 *   crash = max(1.00x, floor(100 * X) / 100), optionally capped at maxX100
 *
 * A cap only lowers the RTP of targets above the cap. Certification proves
 * the RTP of every variant offered, capped or not, by simulating this module.
 */
import { TWO_POW_52, first52Bits, roundHash } from './core.js';

function checkRtp(rtpBps: number): void {
  if (!Number.isInteger(rtpBps) || rtpBps < 1 || rtpBps > 10000) {
    throw new RangeError('rtpBps must be an integer between 1 and 10000');
  }
}

/** Crash point (hundredths) from a uniform 52-bit integer, e.g. from a certified RNG. */
export function crashFromUniform52(r: bigint, rtpBps: number, maxX100?: number): number {
  checkRtp(rtpBps);
  if (typeof r !== 'bigint' || r < 0n || r >= TWO_POW_52) {
    throw new RangeError('r must be a bigint in [0, 2^52)');
  }
  if (maxX100 !== undefined && (!Number.isInteger(maxX100) || maxX100 < 100)) {
    throw new RangeError('maxX100 must be an integer of at least 100');
  }
  const x100 = (BigInt(rtpBps) * TWO_POW_52) / (100n * (TWO_POW_52 - r));
  const crash = x100 < 100n ? 100 : Number(x100);
  return maxX100 !== undefined && crash > maxX100 ? maxX100 : crash;
}

/** Crash point (hundredths) from a seed and salt, for test vectors and non-RGS use. */
export function crashFromSeedRtp(seedHex: string, salt: string, rtpBps: number, maxX100?: number): number {
  return crashFromUniform52(first52Bits(roundHash(seedHex, salt)), rtpBps, maxX100);
}

/** Casino payout: stake x target, when target <= crash. No rally bonus. */
export function casinoPayout(stake: number, targetX100: number, crashX100: number): number {
  if (!Number.isSafeInteger(stake) || stake < 0) {
    throw new RangeError('stake must be a non-negative safe integer');
  }
  if (!Number.isInteger(targetX100) || targetX100 < 101) {
    throw new RangeError('targetX100 must be an integer of at least 101 (1.01x)');
  }
  if (!Number.isInteger(crashX100) || crashX100 < 100) {
    throw new RangeError('crashX100 must be an integer of at least 100');
  }
  return targetX100 > crashX100 ? 0 : Number((BigInt(stake) * BigInt(targetX100)) / 100n);
}
