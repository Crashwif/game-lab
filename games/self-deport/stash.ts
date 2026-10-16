/**
 * The stash: every paycheck this browser has sent home, the rank it earns and the drip it unlocks. Paychecks
 * are a skill score with no value of any kind: never bought, never traded, never paid out, and they never
 * touch a round, a bet or a credit. The stash lives in localStorage when the page has one; a sandboxed frame
 * has no origin to keep it in, so there it lasts the page.
 */
const STORAGE_KEY = 'self-deport-stash';

export interface Stash {
  /** Paychecks sent home over every round played here. */
  sent: number;
  /** The most sent home in one round. */
  best: number;
  /** Rounds in which something was sent home. */
  rounds: number;
}

/** Rank titles by paychecks sent home, lowest first. Memo's career, not the player's money. */
export const RANKS: readonly { at: number; title: string }[] = [
  { at: 0, title: 'DAY LABORER' },
  { at: 12, title: 'LANDSCAPER' },
  { at: 40, title: 'CREW LEAD' },
  { at: 100, title: 'TACO TRUCK OWNER' },
  { at: 250, title: 'SMALL BUSINESS OWNER' },
  { at: 600, title: 'EMPLOYS 40 AMERICANS' },
];

export type Drip = 'chain' | 'hat';
/** Cosmetic drip on Memo, unlocked by the stash: recognition only. */
export const DRIP: readonly { at: number; item: Drip; label: string }[] = [
  { at: 40, item: 'chain', label: 'GOLD CHAIN' },
  { at: 250, item: 'hat', label: 'TEJANA HAT' },
];

export function rankFor(sent: number): string {
  let title = RANKS[0]!.title;
  for (const rank of RANKS) if (sent >= rank.at) title = rank.title;
  return title;
}

export function dripFor(sent: number): Set<Drip> {
  return new Set(DRIP.filter((d) => sent >= d.at).map((d) => d.item));
}

/** The next rank or drip the stash is short of, for the HUD's nudge; null at the top. */
export function nextGoal(sent: number): { at: number; label: string } | null {
  const goals = [...RANKS.map((r) => ({ at: r.at, label: r.title })), ...DRIP.map((d) => ({ at: d.at, label: d.label }))].filter((g) => g.at > sent).sort((a, b) => a.at - b.at);
  return goals[0] ?? null;
}

export function loadStash(): Stash {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stash>;
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
      return { sent: num(parsed.sent), best: num(parsed.best), rounds: num(parsed.rounds) };
    }
  } catch {
    // No storage in this frame: the stash lasts the page.
  }
  return { sent: 0, best: 0, rounds: 0 };
}

export function saveStash(stash: Stash): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stash)); } catch { /* storage may be unavailable */ }
}
