import type { LootKind } from './loot';
export interface Rect { x: number; y: number; w: number; h: number }
export function layout(portrait: boolean) {
  const w = portrait ? 540 : 960, h = portrait ? 800 : 540;
  const footer = portrait ? 153 : 105;
  const floor = h - footer - 23;
  const cards: (Rect & { kind: LootKind })[] = (['bag', 'watch', 'shoe', 'coat'] as LootKind[]).map((kind, i) => ({
    kind, x: portrait ? 25 + i * 125 : 78 + i * 204, y: portrait ? 160 : 122,
    w: portrait ? 115 : 192, h: portrait ? 100 : 86,
  }));
  return { w, h, footer, floor, top: portrait ? 93 : 72, portrait, cards, heroX: w * .5, heroScale: portrait ? 1.2 : .95 };
}
export type Layout = ReturnType<typeof layout>;
export const contains = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
