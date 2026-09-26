/**
 * Golden vectors. Any change to the crash maths that
 * alters a single result fails here. Regenerate only for a deliberate,
 * versioned change: `npm run vectors:update -w @crashwif/crash-math`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crashFromSeed } from '../src/free.js';
import { crashFromSeedRtp } from '../src/casino.js';
import { testSeed, testSalt } from './helpers.js';

const COUNT = 10_000;
const EDGE_BPS = 300;
const RTP_BPS = 9700;

interface VectorFile {
  version: 1;
  count: number;
  seedScheme: string;
  saltScheme: string;
  results: number[];
}

function compute(module: 'free' | 'casino'): number[] {
  return Array.from({ length: COUNT }, (_, i) =>
    module === 'free'
      ? crashFromSeed(testSeed(i), testSalt(i), EDGE_BPS)
      : crashFromSeedRtp(testSeed(i), testSalt(i), RTP_BPS)
  );
}

const files = {
  free: fileURLToPath(new URL('../vectors/free.json', import.meta.url)),
  casino: fileURLToPath(new URL('../vectors/casino.json', import.meta.url)),
};

describe.each(['free', 'casino'] as const)('%s golden vectors', (module) => {
  const actual = compute(module);

  if (process.env.UPDATE_VECTORS === '1') {
    const file: VectorFile = {
      version: 1,
      count: COUNT,
      seedScheme: 'seed_i = sha256(utf8("crashwif-crash-math-vector:" + i))',
      saltScheme: module === 'free'
        ? 'salt_i = "salt-" + (i % 7); edgeBps = 300'
        : 'salt_i = "salt-" + (i % 7); rtpBps = 9700',
      results: actual,
    };
    writeFileSync(files[module], `${JSON.stringify(file)}\n`);
  }

  it(`reproduces all ${COUNT} stored results`, () => {
    const stored = JSON.parse(readFileSync(files[module], 'utf8')) as VectorFile;
    expect(stored.count).toBe(COUNT);
    expect(actual).toEqual(stored.results);
  });
});
