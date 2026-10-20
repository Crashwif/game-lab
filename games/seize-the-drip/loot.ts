import type { Frame } from './presentation';

export const KINDS = ['bag', 'watch', 'shoe', 'coat'] as const;
export type LootKind = typeof KINDS[number];
export type Choice = LootKind | 'auto';
export interface Haul {
  choice: Choice;
  next: LootKind;
  items: readonly LootKind[];
  serial: number;
  progress: number;
  enabled: boolean;
}
export const PICKUP_SECONDS = 2.2;
export const MAX_ITEMS = 12;

/** Cosmetic inventory only. No scores, probabilities, stakes or outcome intents. */
export function createHaul() {
  let choice: Choice = 'auto';
  let items: LootKind[] = [];
  let lastSerial = -1;
  let lastElapsed = 0;
  let previous: Frame['phase'] | null = null;
  let enabled = true;
  let frozen: Haul | null = null;
  return {
    choose(next: Choice) { if (enabled) choice = next; },
    update(frame: Frame): Haul {
      const active = frame.phase === 'running';
      const ending = frame.phase === 'crashed' || frame.phase === 'escaped';
      const reset = active && (previous !== 'running' || frame.elapsed < lastElapsed);
      if (reset || !ending && !active) { items = []; lastSerial = -1; frozen = null; }
      enabled = !ending;
      const serial = active || ending ? Math.floor(frame.elapsed / PICKUP_SECONDS) : -1;
      if (!frozen && serial >= 0 && serial !== lastSerial) {
        // Reconstruct late entry in a bounded loop; continuous runs remember real choices.
        const start = Math.max(lastSerial + 1, serial - MAX_ITEMS + 1);
        for (let i = start; i <= serial; i++) items.push(choice === 'auto' ? KINDS[i % 4]! : choice);
        items = items.slice(-MAX_ITEMS);
        lastSerial = serial;
      }
      const next = choice === 'auto' ? KINDS[(Math.max(0, serial) + 1) % 4]! : choice;
      const result: Haul = frozen ?? {
        choice, next, items: [...items], serial, progress: active || ending ? frame.elapsed / PICKUP_SECONDS % 1 : 0, enabled,
      };
      if (ending && !frozen) frozen = { ...result, enabled: false };
      previous = frame.phase;
      lastElapsed = frame.elapsed;
      return frozen ?? result;
    },
  };
}
