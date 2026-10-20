import { describe, it, expect } from 'vitest';
import { crashFromSeedRtp, crashFromUniform52, casinoPayout } from '../src/casino.js';
import { TWO_POW_52 } from '../src/core.js';
import { testSeed, testSalt } from './helpers.js';

const SAMPLES = 200_000;
const RTP_BPS = 9700;

describe('casino crash maths', () => {
  const crashes = Array.from({ length: SAMPLES }, (_, i) =>
    crashFromSeedRtp(testSeed(i, 'casino-dist'), testSalt(i), RTP_BPS)
  );

  it.each([1.01, 2, 5, 10])('gives RTP = 97%% at a %sx target within 5 sigma', (m) => {
    const target = Math.round(m * 100);
    const p = RTP_BPS / 10000 / (target / 100);
    const observed = crashes.filter((c) => c >= target).length / SAMPLES;
    const sigma = Math.sqrt((p * (1 - p)) / SAMPLES);
    expect(Math.abs(observed - p)).toBeLessThan(5 * sigma);
  });

  it('has exact tail probabilities at the 52-bit boundaries', () => {
    // r = 0 gives rtp * 1 = 0.97x -> floored to the 1.00x instant crash.
    expect(crashFromUniform52(0n, RTP_BPS)).toBe(100);
    // The largest r gives the largest multiplier.
    expect(crashFromUniform52(TWO_POW_52 - 1n, RTP_BPS)).toBeGreaterThan(1_000_000);
  });

  it('applies an optional cap', () => {
    expect(crashFromUniform52(TWO_POW_52 - 1n, RTP_BPS, 100_000)).toBe(100_000);
  });

  it('has no rally bonus in its payout', () => {
    expect(casinoPayout(100, 200, 500)).toBe(200);
    expect(casinoPayout(100, 501, 500)).toBe(0);
  });

  it('rejects invalid inputs', () => {
    expect(() => crashFromUniform52(-1n, RTP_BPS)).toThrow(RangeError);
    expect(() => crashFromUniform52(TWO_POW_52, RTP_BPS)).toThrow(RangeError);
    expect(() => crashFromUniform52(0n, 0)).toThrow(RangeError);
    expect(() => crashFromUniform52(0n, 10001)).toThrow(RangeError);
    expect(() => crashFromUniform52(0n, RTP_BPS, 99)).toThrow(RangeError);
    expect(() => casinoPayout(10, 100, 200)).toThrow(RangeError);
  });
});
