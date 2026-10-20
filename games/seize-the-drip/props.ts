import { box, label, line, oval, poly, type Ctx } from './ink';
import type { LootKind } from './loot';

export const GOODS: Record<LootKind, { name: string; brand: string; color: string }> = {
  bag: { name: 'THE BAG', brand: 'LOUIS VANDAL', color: '#a46639' },
  watch: { name: 'THE WATCH', brand: 'KARL MARKS-UP', color: '#e5bc66' },
  shoe: { name: 'THE TRAINERS', brand: 'YVES SAINT LOOT', color: '#e7dbc4' },
  coat: { name: 'THE COAT', brand: 'MAISON DU CAPITAL', color: '#8d323a' },
};
const EDGE = '#2b2122';

/** Every item hangs from (0, 0); a solved hand can hold the same anchor. */
export function item(c: Ctx, kind: LootKind, x: number, y: number, scale = 1, angle = 0, tag = false) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  if (kind === 'bag') {
    c.strokeStyle = EDGE; c.lineWidth = 4;
    c.beginPath(); c.ellipse(0, 10, 12, 12, 0, Math.PI, 2 * Math.PI); c.stroke();
    poly(c, [-25, 12, 25, 12, 29, 53, -29, 53], GOODS.bag.color, EDGE);
    line(c, [-23, 22, 23, 22], '#d7ab70', 2);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++)
      label(c, 'LV', -18 + col * 12, 29 + row * 9, 6, '#e4c18c', 10, 'center', 'Georgia');
    box(c, -4, 14, 8, 9, '#eac478', EDGE, 1);
  } else if (kind === 'watch') {
    box(c, -10, 0, 20, 62, '#d7a550', EDGE, 4);
    for (let i = 5; i < 60; i += 6) line(c, [-8, i, 8, i], '#9f6d37', 1);
    oval(c, 0, 30, 23, 23, '#e9c77b', EDGE);
    oval(c, 0, 30, 17, 17, '#263338');
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; oval(c, Math.sin(a) * 14, 30 + Math.cos(a) * 14, 1, 1, '#eee5c4'); }
    line(c, [0, 19, 0, 30, 10, 34], '#f3d494', 2);
    box(c, 23, 26, 4, 7, '#c58d41', EDGE, 1);
  } else if (kind === 'shoe') {
    line(c, [0, 0, -9, 16], '#b59b78', 2);
    poly(c, [-24, 14, -6, 10, 3, 22, 26, 29, 32, 43, -28, 43], '#ece2ce', EDGE);
    poly(c, [-23, 22, -6, 16, 1, 28, 24, 32, 18, 37, -21, 32], '#b37b61');
    box(c, -29, 39, 63, 9, '#f7efde', EDGE, 3);
    line(c, [-10, 20, 2, 22, -5, 26, 9, 28, 3, 31, 15, 32], '#fff5dc', 2);
    label(c, 'YSL?', 14, 37, 7, EDGE, 25);
  } else {
    line(c, [0, 0, -7, 8, -27, 16, 26, 16, 6, 8, 0, 0], '#cba257', 2);
    poly(c, [-12, 10, -32, 18, -41, 50, -24, 56, -19, 35, -20, 73, 21, 73, 20, 35, 26, 56, 42, 50, 32, 18, 12, 10, 0, 21], '#943c46', EDGE);
    for (let y = 28; y < 72; y += 11) line(c, [-18, y, 19, y], '#592731', 2);
    line(c, [0, 22, 0, 72], '#d7b479', 2);
    oval(c, 0, 12, 12, 8, '#ccb58e', EDGE);
  }
  if (tag) {
    line(c, [20, 20, 35, 36], '#f4e9d3', 1);
    c.save(); c.translate(35, 39); c.rotate(.2);
    box(c, -6, -4, 17, 25, '#f6ecdc', EDGE, 1);
    label(c, '€?!', 2, 6, 8, EDGE, 14); c.restore();
  }
  c.restore();
}

export function shoppingBag(c: Ctx, x: number, y: number, scale: number, time: number) {
  c.save(); c.translate(x, y); c.rotate(Math.sin(time) * .07); c.scale(scale, scale);
  line(c, [-12, 0, -12, -17, 12, -17, 12, 0], '#927b56', 3);
  box(c, -26, -1, 52, 51, '#e3cfaa', '#49372a', 1);
  label(c, 'SEIZED', 0, 19, 9, '#7c3339', 46, 'center', 'Georgia');
  label(c, 'WITH LOVE', 0, 31, 6, '#49372a', 44);
  c.restore();
}
