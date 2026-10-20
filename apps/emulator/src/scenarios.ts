/**
 * Scenarios fix the chain so a game can be tested against known outcomes:
 * `fixed` always plays the same rounds, `edge` starts with an instant crash
 * and a long run, `stress` adds bots. Seeds are searched, never drawn at
 * random, so every run of a scenario is the same run.
 */
import { chain as fairChain, free } from '@crashwif/crash-math';

import type { EmulatorConfig } from './engine.js';

export const SCENARIOS = ['basic', 'fixed', 'edge', 'stress'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const FIXED_TOP_SEED = '4c72617368776966206669786564207365656420666f722074657374696e672e';
export const FIXED_SALT = 'crashwif-emulator-fixed-salt';

/** Seeds derived deterministically from a base, checked in order. */
function candidate(base: string, n: number): string {
  const hex = n.toString(16).padStart(8, '0');
  return base.slice(0, 64 - 8) + hex;
}

/**
 * The first seed (from the fixed base) whose first `window` rounds include an
 * instant 1.00x crash and a crash at or above `highX100`.
 */
export function findEdgeSeed(salt: string, edgeBps: number, chainLength: number, interval: number, window = 12, highX100 = 1_000): string {
  for (let n = 0; n < 100_000; n++) {
    const seed = candidate(FIXED_TOP_SEED, n);
    const chain = fairChain.buildChain(seed, chainLength, interval);
    let instant = false;
    let high = false;
    for (let i = 0; i < window; i++) {
      const crash = free.crashFromSeed(fairChain.deriveSeed(chain, i + 1), salt, edgeBps);
      if (crash === 100) instant = true;
      if (crash >= highX100) high = true;
      if (instant && high) return seed;
    }
  }
  throw new Error('no edge seed found');
}

export function scenarioConfig(scenario: Scenario, base: Partial<EmulatorConfig> = {}): Partial<EmulatorConfig> {
  const chainLength = base.chainLength ?? 1_000;
  const interval = base.chainCheckpointInterval ?? 100;
  const edgeBps = base.houseEdgeBps ?? free.DEFAULT_EDGE_BPS;
  switch (scenario) {
    case 'basic':
      return base;
    case 'fixed':
      return { ...base, topSeed: base.topSeed ?? FIXED_TOP_SEED, salt: base.salt || FIXED_SALT };
    case 'edge': {
      const salt = base.salt || FIXED_SALT;
      return { ...base, salt, topSeed: base.topSeed ?? findEdgeSeed(salt, edgeBps, chainLength, interval) };
    }
    case 'stress':
      return { ...base, topSeed: base.topSeed ?? FIXED_TOP_SEED, salt: base.salt || FIXED_SALT, bots: base.bots ?? 200, maxBettorsPerRound: base.maxBettorsPerRound ?? 256 };
  }
}
