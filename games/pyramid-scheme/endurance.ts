/** Presentation-only endurance acts; loops remain bounded beyond 150 seconds. */
export function endurance(seconds: number): { act: number; effort: number; cycle: number } {
  if (seconds < 42) return { act: 0, effort: 0, cycle: 0 };
  const age = seconds - 42;
  const cycle = Math.floor(age / 26);
  const u = (age % 26) / 26;
  const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  return { act: 1 + cycle % 4, effort: ease(u / .24) * (1 - ease((u - .62) / .28)), cycle };
}
