/**
 * Progression in creator games (recognition only). Formula v1 is
 * data in unlock.progression_formulas; this is the same formula in code, used
 * by the oracle to compute XP and levels and by the web app to show them.
 * Levels and achievements unlock nothing of value.
 */

export const PROGRESSION_FORMULA_V1 = {
  version: 1,
  xpPerBet: 1,
  xpPerWin: 4,
  xpPerPass: 20,
  /** XP to reach each level from 2: floor(100 * 1.5^(level - 2)). */
  levelBase: 100,
  levelGrowth: 1.5,
  maxLevel: 200,
} as const;

export interface ProgressStats {
  bets: number;
  wins: number;
  passes: number;
  /** Points of every achievement awarded. */
  points: number;
}

/** XP needed to reach `level` from the one before; level 1 is the start. */
export function levelCost(level: number): number {
  return level <= 1 ? 0 : Math.floor(PROGRESSION_FORMULA_V1.levelBase * Math.pow(PROGRESSION_FORMULA_V1.levelGrowth, level - 2));
}

export function xpFor(stats: ProgressStats): number {
  return stats.bets * PROGRESSION_FORMULA_V1.xpPerBet + stats.wins * PROGRESSION_FORMULA_V1.xpPerWin + stats.passes * PROGRESSION_FORMULA_V1.xpPerPass + stats.points;
}

/** The level `xp` reaches, how far into it the player is, and what the next level costs. */
export function levelFor(xp: number): { level: number; intoLevel: number; nextCost: number } {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  for (;;) {
    const cost = levelCost(level + 1);
    if (remaining < cost || level >= PROGRESSION_FORMULA_V1.maxLevel) return { level, intoLevel: remaining, nextCost: cost };
    remaining -= cost;
    level += 1;
  }
}
