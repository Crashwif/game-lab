import { describe, it, expect } from 'vitest';
import {
  crashFromSeed,
  payout,
  rallyPercent,
  multiplierAtX100,
  msToReach,
  DEFAULT_EDGE_BPS,
  rallyBlockAt,
} from '../src/free.js';
import { testSeed, testSalt } from './helpers.js';

const SAMPLES = 200_000;

function sampleCrashes(edgeBps = DEFAULT_EDGE_BPS): number[] {
  const out: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) out.push(crashFromSeed(testSeed(i, 'free-dist'), testSalt(i), edgeBps));
  return out;
}

describe('crashFromSeed', () => {
  const crashes = sampleCrashes();

  it('is deterministic for the same seed and salt', () => {
    const seed = testSeed(1);
    expect(crashFromSeed(seed, 'abc')).toBe(crashFromSeed(seed, 'abc'));
  });

  it('changes with the salt', () => {
    const seed = testSeed(2);
    const results = new Set(Array.from({ length: 20 }, (_, i) => crashFromSeed(seed, `s${i}`)));
    expect(results.size).toBeGreaterThan(10);
  });

  it('never returns less than 1.00x and always returns an integer', () => {
    for (const c of crashes) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(100);
    }
  });

  it.each([2, 10])('matches P(crash >= %sx) = (32/33) * 99 / (100m - 1) within 5 sigma', (m) => {
    const theory = (32 / 33) * (99 / (100 * m - 1));
    const observed = crashes.filter((c) => c >= m * 100).length / SAMPLES;
    const sigma = Math.sqrt((theory * (1 - theory)) / SAMPLES);
    expect(Math.abs(observed - theory)).toBeLessThan(5 * sigma);
  });

  it('crashes instantly about 1/33 of the time at a 3% edge (plus the 1.00x floor case)', () => {
    const instant = crashes.filter((c) => c === 100).length / SAMPLES;
    // 1/33 from the divisor check, plus P(floor lands on 100) = 1/100 * 32/33.
    const theory = 1 / 33 + (32 / 33) * (1 / 100);
    const sigma = Math.sqrt((theory * (1 - theory)) / SAMPLES);
    expect(Math.abs(instant - theory)).toBeLessThan(5 * sigma);
  });

  it('rejects malformed seeds, empty salts and bad edges', () => {
    expect(() => crashFromSeed('abc', 'salt')).toThrow(TypeError);
    expect(() => crashFromSeed(testSeed(1).toUpperCase(), 'salt')).toThrow(TypeError);
    expect(() => crashFromSeed(testSeed(1), '')).toThrow(TypeError);
    expect(() => crashFromSeed(testSeed(1), 'salt', 0)).toThrow(RangeError);
    expect(() => crashFromSeed(testSeed(1), 'salt', 5001)).toThrow(RangeError);
    expect(() => crashFromSeed(testSeed(1), 'salt', 1.5)).toThrow(RangeError);
  });
});

describe('payout', () => {
  it('pays stake x target when the target is at or below the crash point', () => {
    expect(payout(100, 200, 200)).toBe(200);
    expect(payout(100, 250, 1000)).toBe(250);
    expect(payout(100, 100, 101)).toBe(100);
  });

  it('pays nothing when the target is above the crash point', () => {
    expect(payout(100, 201, 200)).toBe(0);
  });

  it('applies the rally bonus: +1% per bettor, capped at +50%', () => {
    expect(payout(100, 200, 500, 10)).toBe(220);
    expect(payout(100, 200, 500, 50)).toBe(300);
    expect(payout(100, 200, 500, 500)).toBe(300);
    expect(rallyPercent(0)).toBe(100);
  });

  it('floors fractional credits', () => {
    expect(payout(3, 133, 200)).toBe(3); // 3.99 -> 3
    expect(payout(7, 150, 200, 1)).toBe(10); // 10.605 -> 10
  });

  it('rejects invalid inputs', () => {
    expect(() => payout(-1, 200, 200)).toThrow(RangeError);
    expect(() => payout(1.5, 200, 200)).toThrow(RangeError);
    expect(() => payout(10, 99, 200)).toThrow(RangeError);
    expect(() => payout(10, 200, 99)).toThrow(RangeError);
    expect(() => rallyPercent(-1)).toThrow(RangeError);
  });
});

describe('multiplier curve', () => {
  it('starts at 1.00x and grows', () => {
    expect(multiplierAtX100(0)).toBe(100);
    expect(multiplierAtX100(10_000)).toBeGreaterThan(multiplierAtX100(5_000));
  });

  it('treats negative or NaN time as the start of the round', () => {
    expect(multiplierAtX100(-5)).toBe(100);
    expect(multiplierAtX100(Number.NaN)).toBe(100);
  });

  it.each([100, 101, 150, 200, 1000, 10000])('msToReach(%s) is the first ms the curve reaches it', (x) => {
    const ms = msToReach(x);
    expect(multiplierAtX100(ms)).toBeGreaterThanOrEqual(x);
    if (ms > 0) expect(multiplierAtX100(ms - 1)).toBeLessThan(x);
  });
});

describe('rally schedule', () => {
  it('starts off and alternates each block', () => {
    const block = 20 * 60_000;
    expect(rallyBlockAt(0, block, false)).toEqual({ block: 0, active: false });
    expect(rallyBlockAt(block - 1, block, false)).toEqual({ block: 0, active: false });
    expect(rallyBlockAt(block, block, false)).toEqual({ block: 1, active: true });
    expect(rallyBlockAt(2 * block, block, false)).toEqual({ block: 2, active: false });
    expect(rallyBlockAt(3 * block + 5, block, false)).toEqual({ block: 3, active: true });
  });

  it('can start on, and treats negative time as block 0', () => {
    expect(rallyBlockAt(0, 1_000, true).active).toBe(true);
    expect(rallyBlockAt(-5, 1_000, true)).toEqual({ block: 0, active: true });
    expect(() => rallyBlockAt(0, 0, true)).toThrow(RangeError);
  });
});
