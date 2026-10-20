import { ASIDES } from './content';
import { bystander, hero, heroPose, officer, protestSign } from './characters';
import { box, clamp, ease, hash, label, line, mix, oval, poly, wrap, type Ctx } from './ink';
import { GOODS, item } from './props';
import type { Frame } from './presentation';
import type { Haul } from './loot';
import type { Layout } from './layout';

const INK = '#30262d', GOLD = '#bb8d47';

/** Police choreography is gated solely by the revealed phase. */
export function confiscation(frame: Pick<Frame, 'phase' | 'outcomeAge'>) {
  if (frame.phase !== 'crashed') return { arrival: 0, drop: 0, receipt: 0 };
  return {
    arrival: ease((frame.outcomeAge - .3) / 1.4),
    drop: clamp((frame.outcomeAge - .22) / 1.5),
    receipt: ease((frame.outcomeAge - 1.8) / .9),
  };
}

function boutique(c: Ctx, l: Layout, time: number, frame: Frame) {
  const { w, h, top, floor, portrait } = l;
  const wall = c.createLinearGradient(0, top, 0, floor);
  wall.addColorStop(0, '#f2e5ce'); wall.addColorStop(1, '#cebc9f');
  box(c, 0, top, w, h - top, wall as unknown as string, undefined, 0);
  // Inlaid panels, cornices and reflected marble, all vector art.
  for (let x = 22; x < w; x += portrait ? 124 : 166) {
    box(c, x, top + 23, portrait ? 110 : 148, floor - top - 30, '#ecdfc755', '#b19565', 44);
    line(c, [x + 10, top + 81, x + 16, floor - 33, x + 56, floor - 9], '#a48c6c1f', 1);
  }
  box(c, 0, floor - 12, w, h - floor + 12, '#e8d9bf', undefined, 0);
  for (let i = -4; i < 10; i++) line(c, [w / 2 + i * 38, floor - 12, w / 2 + i * 170, h], '#a68d6a66', 1);
  line(c, [0, floor + 25, w, floor + 25], '#aa936f66', 1);
  line(c, [0, floor - 12, w, floor - 12], '#ad8a54', 4);
  // Burgundy carpet, interrupted by the weight of the haul.
  poly(c, [w * .39, floor - 16, w * .62, floor - 16, w * .76, h, w * .22, h], '#702838');
  line(c, [w * .39, floor - 16, w * .22, h], '#ccaa62', 3);
  line(c, [w * .62, floor - 16, w * .76, h], '#ccaa62', 3);
  const fasciaY = portrait ? 122 : 96;
  label(c, 'MAISON DU CAPITAL', w / 2, fasciaY, portrait ? 25 : 26, '#6b3039', w - 55, 'center', 'Georgia');
  label(c, 'PARIS  /  COLLECTION: CIVIL UNREST', w / 2, fasciaY + 21, 8, '#705847', w - 60);
  // The revolving door is a sight gag, never a timing or escape mechanic.
  const dx = w - (portrait ? 79 : 112), dy = floor - (portrait ? 196 : 164);
  box(c, dx - 39, dy, 78, floor - dy, '#73918f', '#9d7a42', 36);
  for (let i = 0; i < 5; i++) {
    const rx = dx - 31 + i * 14;
    box(c, rx, dy + 74 - (i % 2) * 14, 13, 48 + (i % 2) * 14, '#4c656a', undefined, 0);
    poly(c, [rx - 3, dy + 74 - (i % 2) * 14, rx + 6, dy + 61 - (i % 2) * 14, rx + 16, dy + 74 - (i % 2) * 14], '#45565f');
  }
  line(c, [dx, dy + 3, dx, floor], '#d6b877', 3);
  const turn = frame.phase === 'escaped' ? Math.sin(ease(frame.outcomeAge / 2) * Math.PI * 4) * 33 : 27;
  line(c, [dx - turn, dy + 17, dx + turn, floor - 5], '#d9b978', 2);
  box(c, dx - 22, dy + 36, 44, 15, '#ece0c2', '#a27f48', 1);
  label(c, 'SORTIE', dx, dy + 44, 7, INK, 40);
  if (!portrait) {
    // A distant Eiffel-like silhouette and paper placards establish a fictional Paris.
    line(c, [dx + 18, dy + 100, dx + 23, dy + 64, dx + 27, dy + 100], '#d4bea0', 2);
    line(c, [dx + 16, dy + 92, dx + 29, dy + 92], '#d4bea0', 2);
  }
  // Long-round disarray is capped and deterministic.
  for (let i = 0; i < Math.min(10, frame.stage + 2); i++) {
    c.save(); c.translate(40 + hash(i + 17) * (w - 80), floor - 2 + hash(i) * 20); c.rotate(hash(i + 4));
    box(c, -10, -2, 22, 7, '#f6e9cc', '#bba27a', 1); c.restore();
  }
  const glintX = w * .52 + Math.sin(time * .35) * 32;
  oval(c, glintX, top + 8, 35, 3, '#e8c98588');
}

function display(c: Ctx, l: Layout, haul: Haul, time: number) {
  for (const [i, r] of l.cards.entries()) {
    const selected = r.kind === haul.next;
    box(c, r.x + 2, r.y + 4, r.w, r.h, '#55413422', undefined, 7);
    box(c, r.x, r.y, r.w, r.h, selected ? '#fff1d1' : '#e7d7b9', selected ? '#702838' : '#b99c6b', 7);
    if (selected) { c.save(); c.setLineDash([3, 4]); c.strokeStyle = '#b47549'; c.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10); c.restore(); }
    label(c, `${i + 1}`, r.x + 13, r.y + 14, 9, '#735b46', 16);
    item(c, r.kind, r.x + r.w / 2, r.y + 12 + (selected && haul.enabled ? Math.sin(time * 3) * 2 : 0), l.portrait ? .68 : .7, selected ? Math.sin(time * 1.7) * .04 : 0);
    label(c, GOODS[r.kind].brand, r.x + r.w / 2, r.y + r.h - 12, l.portrait ? 8 : 10, '#4c3333', r.w - 13, 'center', 'Georgia');
  }
}

function aside(c: Ctx, l: Layout, time: number, frame: Frame) {
  const role = Math.floor(time / 6.1) % ASIDES.length;
  const copy = ASIDES[role]!;
  const x = l.portrait ? 24 : 28, y = l.portrait ? 279 : 232, w = l.portrait ? l.w - 48 : 267;
  box(c, x, y, w, l.portrait ? 59 : 61, '#f5ead2ee', '#b79762', 3);
  label(c, frame.phase === 'crashed' ? 'THE ACTUAL EMPLOYEE' : copy[0], x + 12, y + 13, 8, '#8b3843', w - 24, 'left');
  c.font = 'italic 13px Georgia';
  const rows = wrap(c, frame.phase === 'crashed' ? 'At least the police are helping with stocktake.' : copy[1], w - 26);
  rows.forEach((row, i) => label(c, row, x + 12, y + 31 + i * 15, 13, INK, w - 24, 'left', 'Georgia'));
}

function chauffeur(c: Ctx, l: Layout, age: number) {
  const arrive = ease(age / 1.25), carX = mix(l.w + 175, l.w - (l.portrait ? 130 : 149), arrive);
  c.save(); c.translate(carX, l.floor + 5);
  oval(c, 0, 7, 129, 12, '#281d2e55');
  box(c, -131, -70, 264, 65, '#232832', '#0e151f', 15);
  poly(c, [-99, -69, -71, -113, 64, -113, 105, -69], '#2c343c', '#101923');
  poly(c, [-82, -74, -62, -103, -14, -103, -14, -74], '#b5c6b9', '#c8ab70');
  poly(c, [-6, -103, 57, -103, 83, -74, -6, -74], '#809a91', '#c8ab70');
  // The private driver patiently watches the public uprising.
  oval(c, 42, -86, 10, 12, '#d4ac88'); box(c, 30, -101, 25, 8, '#25232c', undefined, 2);
  line(c, [-114, -48, 119, -48], '#ccb16c', 2);
  box(c, -50, -59, 25, 4, '#d3bf8a', undefined, 1);
  for (const x of [-86, 86]) { oval(c, x, -9, 24, 24, '#1c2026'); oval(c, x, -9, 13, 13, '#b9b8ab', '#6d7071'); oval(c, x, -9, 6, 6, '#42474b'); }
  box(c, 109, -47, 19, 15, '#f5e6b9', undefined, 3);
  label(c, 'PAPA', -3, -29, 11, '#ead7a7', 70);
  c.restore();
}

function chauffeurDoor(c: Ctx, l: Layout, age: number) {
  const board = ease((age - 1.15) / .65);
  if (board <= 0) return;
  const arrive = ease(age / 1.25), carX = mix(l.w + 175, l.w - (l.portrait ? 130 : 149), arrive);
  const swing = mix(1, .18, ease((age - 1.85) / .55));
  c.save(); c.translate(carX - 84, l.floor - 65);
  box(c, 0, -5, 68 * swing, 58, '#232832', '#0e151f', 6);
  line(c, [4, 15, 62 * swing, 15], '#ccb16c', 2);
  box(c, 34 * swing, 5, 18 * swing, 4, '#d3bf8a', undefined, 1);
  c.restore();
}

function evidence(c: Ctx, l: Layout, frame: Frame, haul: Haul) {
  const motion = confiscation(frame), age = frame.outcomeAge;
  if (!motion.arrival && !motion.drop) return;
  const cartX = mix(l.w + 120, l.w * (l.portrait ? .73 : .72), motion.arrival);
  const cartY = l.floor - 30;
  const s = l.portrait ? .86 : 1;
  c.save(); c.translate(cartX, cartY); c.scale(s, s);
  line(c, [-73, -25, -60, 18, 62, 18, 77, -48], '#5c6d74', 6);
  for (const x of [-51, 51]) { line(c, [x, 17, x, 29], '#52646d', 5); oval(c, x, 31, 10, 10, '#253039'); }
  box(c, -64, -39, 127, 16, '#566d79', '#344756', 3);
  c.restore();
  const release = heroPose({ ...frame, phase: 'running' }, haul, frame.elapsed);
  const drawGoods = (inBin: boolean) => {
    if (age < .22) return;
    haul.items.forEach((kind, i) => {
      const hand = i % 2 ? release.right.end : release.left.end;
      const offset = Math.floor(i / 2), dt = Math.max(0, age - .22);
      const startX = l.heroX + (hand.x + (i % 2 ? 1 : -1) * (offset * 13 - 12)) * l.heroScale;
      const startY = l.floor + (hand.y + offset * 11 + 4) * l.heroScale;
      const air = Math.min(1, dt);
      const vx = (hash(i + frame.currentX100) - .5) * 260;
      const flyX = startX + vx * air, flyY = Math.min(l.floor - 30, startY - (100 + hash(i + 3) * 65) * air + 230 * air * air);
      const collect = ease((dt - .85) / .9);
      if ((collect > .55) !== inBin) return;
      const x = mix(flyX, cartX + (i % 4 - 1.5) * 24 * s, collect);
      const y = mix(flyY, cartY - 35 - Math.floor(i / 4) * 7 * s, collect);
      item(c, kind, x, y, .61 * l.heroScale, mix((hash(i + 2) - .5) * air * 5, (i % 3 - 1) * .2, collect), i % 4 === 0);
    });
  };
  drawGoods(true);
  c.save(); c.translate(cartX, cartY); c.scale(s, s);
  box(c, -64, -31, 127, 43, '#738d9a', '#344756', 3);
  label(c, 'EVIDENCE', 0, -9, 18, '#f2e5c7', 115);
  c.restore();
  drawGoods(false);
  if (motion.receipt > 0) {
    const x = l.portrait ? 25 : l.w - 159, y = l.portrait ? 365 : 244, width = l.portrait ? 124 : 133;
    c.save(); c.translate(x, y); c.rotate(-.045);
    const height = (l.portrait ? 158 : 151) * motion.receipt;
    box(c, 0, 0, width, height, '#fff4dc', '#aa8860', 1);
    c.beginPath(); c.rect(0, 0, width, height); c.clip();
    label(c, 'RETURNS RECEIPT', width / 2, 13, 10, '#75313b', width - 10);
    label(c, 'MAISON DU CAPITAL', width / 2, 28, 7, INK, width - 10);
    line(c, [8, 37, width - 8, 37], '#887357', 1);
    [haul.items.length + ' ACCESSORIES', '1 MANIFESTO', '0 SELF-AWARENESS', '', 'REFUND: ABSOLUTELY NOT', 'ALL SALES: EVIDENCE'].forEach((row, i) => label(c, row, 8, 49 + i * 14, i === 4 ? 6.5 : 7, INK, width - 16, 'left'));
    label(c, 'STORE CREDIT: 0', width / 2, 137, 8, '#75313b', width - 12);
    c.restore();
  }
}

export function drawArt(c: Ctx, frame: Frame, haul: Haul, l: Layout, time: number) {
  boutique(c, l, time, frame);
  display(c, l, haul, time);
  aside(c, l, time, frame);
  const caught = frame.phase === 'crashed', escaped = frame.phase === 'escaped';
  const motion = confiscation(frame);
  const actorRole = Math.floor(time / 6.1) % ASIDES.length;
  bystander(c, l.portrait ? 62 : 112, l.floor + 2, l.portrait ? .8 : .72, 0, time);
  if (!caught && !escaped) {
    bystander(c, l.portrait ? 460 : 747, l.floor + 3, l.portrait ? .82 : .87, actorRole === 0 ? 4 : actorRole, time);
    protestSign(c, l.heroX - (l.portrait ? 130 : 118), l.floor - 7, frame.stage, time, l.portrait ? .79 : .73);
  }
  if (caught) {
    officer(c, mix(-60, l.portrait ? 168 : 308, motion.arrival), l.floor, l.portrait ? .88 : 1, motion.arrival * 150, time, 1);
    officer(c, mix(l.w + 60, l.portrait ? 441 : 855, motion.arrival), l.floor, l.portrait ? .8 : .95, motion.arrival * 150, time + 1, -1);
  }
  if (escaped) chauffeur(c, l, frame.outcomeAge);
  const span = l.portrait ? 190 : 290;
  const distance = escaped ? ease((frame.outcomeAge - .3) / 2.2) * span : 0;
  c.save();
  if (escaped) c.globalAlpha = 1 - ease((frame.outcomeAge - 2) / .6);
  const actingTime = caught ? frame.elapsed + Math.max(0, frame.outcomeAge - .12) : time;
  hero(c, frame, haul, l.heroX + distance, l.floor, l.heroScale, actingTime, distance / l.heroScale, span / l.heroScale);
  c.restore();
  if (escaped) chauffeurDoor(c, l, frame.outcomeAge);
  if (caught) evidence(c, l, frame, haul);
  if (escaped && frame.outcomeAge > 2.6) {
    const x = l.w * .5, y = l.portrait ? 421 : 302;
    c.save(); c.translate(x, y); c.rotate(-.04);
    box(c, -l.w * .3, -34, l.w * .6, 68, '#6e2939', '#d6b76e', 2);
    label(c, 'VIVE LA TRUST FUND', 0, -8, l.portrait ? 24 : 28, '#f8e9c5', l.w * .56, 'center', 'Georgia');
    label(c, 'THE PEOPLE’S SUV HAS ARRIVED', 0, 18, 9, '#e9ca86', l.w * .54);
    c.restore();
  }
  if (caught && frame.outcomeAge > 2.8) {
    const y = l.floor + 1;
    box(c, l.w / 2 - 116, y, 232, 21, '#733344', '#d1ac70', 1);
    label(c, 'THIS SEASON: CONSEQUENCES', l.w / 2, y + 11, 9, '#f9e9cb', 220);
  }
}
