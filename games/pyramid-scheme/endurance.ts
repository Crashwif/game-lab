import { smoothstep } from './motion';

/** Presentation-only endurance acts; loops remain bounded beyond 150 seconds. */
export function endurance(seconds: number): { act: number; effort: number; cycle: number } {
  if (seconds < 42) return { act: 0, effort: 0, cycle: 0 };
  const age = seconds - 42;
  const cycle = Math.floor(age / 26);
  const u = (age % 26) / 26;
  return { act: 1 + cycle % 4, effort: smoothstep(0, .24, u) * (1 - smoothstep(.62, .9, u)), cycle };
}
