/**
 * The stash: every bag this browser has banked, the rank it earns and the drip it unlocks. Coins are a
 * skill score with no value of any kind: they are never bought, never traded, never paid out and never
 * touch a round, a bet or a credit. The stash lives in localStorage when the page has one; a sandboxed
 * frame has no origin to keep it in, so there it lasts the page.
 */
const STORAGE_KEY = 'rug-rails-stash';

export interface Stash {
  /** Coins banked over every round played here. */
  coins: number;
  /** The biggest bag ever banked in one round. */
  best: number;
  /** Rounds in which a bag was banked. */
  banked: number;
}

/** Rank titles by coins in the stash, lowest first. */
export const RANKS: readonly { at: number; title: string }[] = [
  { at: 0, title: 'EXIT LIQUIDITY' },
  { at: 150, title: 'PAPER HANDS' },
  { at: 600, title: 'BAGHOLDER' },
  { at: 2_000, title: 'DIAMOND HANDS' },
  { at: 6_000, title: 'WHALE' },
  { at: 20_000, title: 'DEITY OF DEGENERACY' },
];

export type Drip = 'cap' | 'gloves' | 'cape' | 'crown';
/** Cosmetic drip on the runner, unlocked by the stash: recognition only, seen from behind. */
export const DRIP: readonly { at: number; item: Drip; label: string }[] = [
  { at: 300, item: 'cap', label: 'GM CAP' },
  { at: 1_200, item: 'gloves', label: 'DIAMOND GLOVES' },
  { at: 4_000, item: 'cape', label: 'WAGMI CAPE' },
  { at: 12_000, item: 'crown', label: 'CROWN' },
];

export function rankFor(coins: number): string {
  let title = RANKS[0]!.title;
  for (const rank of RANKS) if (coins >= rank.at) title = rank.title;
  return title;
}

export function dripFor(coins: number): Set<Drip> {
  return new Set(DRIP.filter((d) => coins >= d.at).map((d) => d.item));
}

/** The next rank or drip the stash is short of, for the HUD's nudge; null at the top. */
export function nextGoal(coins: number): { at: number; label: string } | null {
  const goals = [...RANKS.map((r) => ({ at: r.at, label: r.title })), ...DRIP.map((d) => ({ at: d.at, label: d.label }))].filter((g) => g.at > coins).sort((a, b) => a.at - b.at);
  return goals[0] ?? null;
}

export function loadStash(): Stash {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stash>;
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
      return { coins: num(parsed.coins), best: num(parsed.best), banked: num(parsed.banked) };
    }
  } catch {
    // No storage in this frame (a sandbox without an origin, or storage blocked): the stash lasts the page.
  }
  return { coins: 0, best: 0, banked: 0 };
}

export function saveStash(stash: Stash): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stash));
  } catch {
    // Storage may be unavailable; the stash then lasts the page.
  }
}
