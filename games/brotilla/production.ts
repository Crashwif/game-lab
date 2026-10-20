import { ease, mix } from './ink';
import type { Frame } from './presentation';

export const STUNTS = ['live', 'drone', 'statement', 'centre'] as const;
export type Stunt = typeof STUNTS[number];
export type Choice = Stunt | 'auto';
export interface Production {
  choice: Choice;
  active: Stunt;
  weights: Record<Stunt, number>;
  serial: number;
  enabled: boolean;
  flash: number;
}
/** Cosmetic direction only. No cash-out intents, crash guesses, or score. */
export function createProduction() {
  let choice: Choice = 'auto', active: Stunt = 'live';
  let previous: Frame | null = null, serial = 0, changedAt = 0;
  let weights: Record<Stunt, number> = { live: 1, drone: 0, statement: 0, centre: 0 };
  let from = { ...weights }, enabled = true, pending = false;
  return {
    choose(next: Choice) {
      if (!enabled || (next !== 'auto' && !STUNTS.includes(next)) || next === choice) return;
      choice = next; pending = true;
    },
    update(frame: Frame): Production {
      enabled = frame.phase === 'running' || frame.phase === 'waiting' || frame.phase === 'betting';
      const reset = !previous || frame.elapsed < previous.elapsed || (frame.phase === 'running' && previous.phase !== 'running');
      const desired = choice === 'auto' ? STUNTS[Math.floor(frame.elapsed / 5.5) % 4]! : choice;
      const changed = desired !== active;
      if ((enabled && changed) || reset) {
        from = { ...weights }; active = desired; changedAt = frame.elapsed;
        if (!reset) serial++;
        if (reset || frame.quiet) {
          weights = { live: 0, drone: 0, statement: 0, centre: 0 };
          weights[active] = 1; from = { ...weights };
        }
      }
      if (pending && enabled) { if (!changed && !reset) { serial++; changedAt = frame.elapsed; } pending = false; }
      const age = Math.max(0, frame.elapsed - changedAt);
      if (enabled) for (const stunt of STUNTS) weights[stunt] = mix(from[stunt], stunt === active ? 1 : 0, ease(age / .48));
      previous = { ...frame, view: { ...frame.view } };
      return { choice, active, weights: { ...weights }, serial, enabled, flash: frame.phase === 'running' && serial > 0 ? 1 - ease(age / 1.2) : 0 };
    },
  };
}
