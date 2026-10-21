import { box, clamp, ease, label, line, mix, oval, poly, solveLimb, swingLimb, type Ctx, type Point } from './ink';
import type { Frame } from './presentation';
import type { Production } from './production';

const INK = '#132e3b', SKIN = '#efbb91';
type Limb = ReturnType<typeof solveLimb>;
function bone(c: Ctx, limb: Limb, colour: string, width: number) {
  const { root: a, joint: b, end: d } = limb;
  line(c, [a.x, a.y, b.x, b.y, d.x, d.y], INK, width + 5);
  line(c, [a.x, a.y, b.x, b.y, d.x, d.y], colour, width);
}
function hand(c: Ctx, p: Point, skin = SKIN) { oval(c, p.x, p.y, 5.5, 6, skin, INK); }
function boot(c: Ctx, p: Point, front = false) {
  box(c, p.x - 9, p.y - 9, front ? 31 : 27, 14, '#163f43', INK, 4);
  line(c, [p.x - 8, p.y + 4, p.x + (front ? 21 : 17), p.y + 4], '#071b29', 4);
  line(c, [p.x - 4, p.y - 5, p.x + 3, p.y - 5], '#7fa99e', 2);
}

/** Feet and flag grip are fixed in the rocking deck's coordinate frame. */
export function captainPose(t: number, f: Frame, production: Production) {
  const crash = f.phase === 'crashed';
  const notice = crash ? ease((f.outcomeAge - 2.25) / .7) : 0;
  const speech = Math.sin(t * 3.4) * .8;
  const sway = Math.sin(t * 1.45) * 1.5;
  const hip = { x: -3 + sway, y: -73 + Math.sin(t * 2) * .65 };
  const chest = { x: -10 + sway, y: -124 + speech * .6 };
  const left = solveLimb({ x: hip.x - 6, y: hip.y }, { x: -39, y: 0 }, 40, 43, 1);
  const right = solveLimb({ x: hip.x + 9, y: hip.y }, { x: 44, y: -34 }, 35, 35, -1);
  const ls = { x: chest.x - 17, y: chest.y + 3 }, rs = { x: chest.x + 17, y: chest.y + 3 };
  const w = production.weights;
  const target = {
    x: 51 * w.live + 65 * w.drone + 29 * w.statement + 35 * w.centre,
    y: -139 * w.live - 153 * w.drone - 151 * w.statement - 121 * w.centre + speech * 2,
  };
  target.x = mix(target.x, 43, notice); target.y = mix(target.y, -104, notice);
  const back = solveLimb(ls, { x: -57, y: -117 }, 32, 31, -1);
  const front = solveLimb(rs, target, 32, 31, 1);
  return { hip, chest, left, right, back, front, notice, head: { x: chest.x + 2, y: chest.y - 41 }, speech };
}

export function captain(c: Ctx, t: number, f: Frame, p: Production) {
  const pose = captainPose(t, f, p);
  const { left, right, back, front, chest, head, notice } = pose;
  // The bow crate and both planted feet share the same elevated platform.
  box(c, 25, -32, 55, 33, '#b78448', INK, 2);
  line(c, [29, -28, 76, -5, 29, -5, 76, -28], '#e1b676', 3);
  label(c, 'OPTICS', 53, -16, 8, '#4c392f', 45);
  bone(c, left, '#365657', 17); boot(c, left.end);
  bone(c, right, '#54716a', 18); boot(c, right.end, true);
  bone(c, front, '#f1c54c', 18);
  // Statement mode carries a microphone; all other modes use the same reachable palm.
  if (p.weights.statement > .05) {
    c.save(); c.globalAlpha = p.weights.statement;
    line(c, [front.end.x, front.end.y + 3, front.end.x + 3, front.end.y - 20], '#16313b', 7);
    oval(c, front.end.x + 3, front.end.y - 21, 7, 9, '#374d57', INK);
    c.restore();
  }
  hand(c, front.end);
  if (p.weights.drone > .4 && notice < .3) line(c, [front.end.x + 2, front.end.y - 3, front.end.x + 13, front.end.y - 7], SKIN, 4);
  // Raincoat: broad silhouette, lapels, folds and a bright windward edge.
  poly(c, [chest.x - 22, chest.y - 6, chest.x + 18, chest.y - 8, chest.x + 29, -77, 19, -57, -40, -61, chest.x - 28, -88], '#efbf42', INK);
  poly(c, [chest.x + 8, chest.y, chest.x + 22, -84, 9, -65, -1, -68, chest.x - 5, chest.y + 5], '#f9d66a');
  poly(c, [chest.x - 22, chest.y + 3, chest.x - 14, chest.y + 9, -16, -68, -34, -67], '#d8a132');
  line(c, [chest.x, chest.y + 7, 0, -66], '#886b2c', 2);
  line(c, [-28, -88, -15, -87, -15, -78, -28, -79], '#a5742e', 2);
  for (let i = 0; i < 3; i++) oval(c, chest.x + 4 + i * 1.5, chest.y + 20 + i * 13, 1.4, 1.4, '#674c25');
  // Sleeve cuff and pin give hands a clear attachment to the coat.
  oval(c, chest.x - 4, chest.y + 16, 5, 5, '#2e8072', INK);
  label(c, 'G', chest.x - 4, chest.y + 16, 6, '#ffefbe', 10);
  box(c, head.x - 7, head.y + 18, 15, 15, SKIN, INK, 3);
  c.save(); c.translate(head.x, head.y); c.rotate(-.055 + Math.sin(t * 1.4 - .35) * .026 + notice * -.12);
  oval(c, 0, -1, 27, 32, '#825a33', INK);
  oval(c, 3, 4, 22, 27, SKIN, INK);
  poly(c, [-22, -4, -17, -21, -2, -31, 15, -23, 24, -7, 11, -13, 1, -19, -8, -8], '#a27743', INK);
  line(c, [-17, -19, -4, -26, 10, -22], '#ccac6a', 3);
  oval(c, 24, 5, 4, 7, SKIN, INK);
  // Pinned roots, lagged braid tips; bright ties make the silhouette readable.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const bx = side * (20 + i * 1.1) - i * 1.2 + Math.sin(t * 2.4 - i * .33) * i * .6;
      oval(c, bx, 13 + i * 5.7, 6 - i * .32, 5.2, i % 2 ? '#956735' : '#b28748', INK);
    }
    box(c, side * 26 - 10 + Math.sin(t * 2.4 - 1.6) * 3, 43, 9, 4, '#96e6ce', INK, 1);
  }
  const blink = Math.sin(t * 1.33 + .3) > .993;
  for (const x of [-6, 13]) {
    if (blink) line(c, [x - 3, 2, x + 3, 2], INK, 2);
    else { oval(c, x, 2, 3.5, 4, '#fff4d6'); oval(c, x + 1 + notice, 2, 1.8, 2.6, INK); }
  }
  line(c, [-11, -5 + notice * 3, -2, -8, 9, -7, 18, -4 - notice * 3], '#614734', 2);
  poly(c, [5, 4, 10, 12, 4, 12], '#d99c79');
  const talking = Math.sin(t * 8.8) > .1 && (!notice || f.outcomeAge > 3);
  oval(c, 7, 20, talking ? 5 : 5.5, talking ? 3.5 : 1, '#743c39');
  oval(c, -11, 15, 5, 2.5, '#e4a488');
  c.restore();
  // The flag is a prop held at the actual solved hand, never a floating target.
  bone(c, back, '#bf8e2d', 19);
  hand(c, back.end);
}

export type Role = 'director' | 'sailor' | 'dj' | 'bro' | 'influencer';
export function crewPose(role: Role, t: number, fall = 0) {
  const sway = Math.sin(t * 2 + (role === 'dj' ? 2 : 0));
  const chest = { x: mix(sway * 2, 13, fall), y: mix(-64 + sway * .7, -42, fall) };
  const hip = { x: mix(0, -1, fall), y: mix(-36, -23, fall) };
  const left = solveLimb({ x: hip.x - 5, y: hip.y }, { x: -15, y: 0 }, 23, 25, 1);
  const right = solveLimb({ x: hip.x + 5, y: hip.y }, { x: 18, y: 0 }, 23, 25, -1);
  const ls = { x: chest.x - 13, y: chest.y + 3 }, rs = { x: chest.x + 13, y: chest.y + 3 };
  const a0 = role === 'dj' ? { x: -23, y: -41 + Math.sin(t * 4) * 4 } : { x: -24, y: -63 };
  const a = { x: mix(a0.x, 10, fall), y: mix(a0.y, -67, fall) };
  const b = role === 'director' || role === 'influencer' ? { x: 30, y: -80 }
    : role === 'sailor' ? { x: 28, y: -43 } : { x: 27, y: -41 + Math.sin(t * 3) * 5 };
  b.x = mix(b.x, 35, fall); b.y = mix(b.y, -52, fall);
  const back = role === 'dj'
    ? swingLimb(ls, solveLimb(ls, a0, 22, 21, 1), solveLimb(ls, { x: 10, y: -67 }, 22, 21, -1), fall, 22, 21)
    : solveLimb(ls, a, 22, 21, -1);
  return { chest, hip, left, right, back,
    front: solveLimb(rs, b, 22, 21, 1),
    head: { x: chest.x + 1 + fall * 5, y: chest.y - 22 },
  };
}
export function crew(c: Ctx, role: Role, t: number, fall = 0) {
  const p = crewPose(role, t, fall), { chest, hip, head } = p;
  const color = role === 'dj' ? '#dc6993' : role === 'bro' ? '#aa9c7c' : role === 'sailor' ? '#f3e4bc' : role === 'director' ? '#344c65' : '#80c0aa';
  const skin = role === 'director' ? '#b67d57' : role === 'influencer' ? '#dca780' : '#edbd94';
  bone(c, p.left, '#2c4857', 10); bone(c, p.right, '#496170', 10);
  boot(c, p.left.end); boot(c, p.right.end, true);
  bone(c, p.front, color, 10);
  if (role === 'director' || role === 'influencer') {
    box(c, p.front.end.x - 7, p.front.end.y - 19, 15, 27, '#182735', '#edc071', 3);
    box(c, p.front.end.x - 4, p.front.end.y - 16, 9, 17, '#72bba8', undefined, 1);
    oval(c, p.front.end.x, p.front.end.y + 4, 1.4, 1.4, '#f4db9d');
  }
  hand(c, p.front.end, skin);
  poly(c, [chest.x - 16, chest.y - 4, chest.x + 15, chest.y - 4, hip.x + 17, hip.y + 5, hip.x - 17, hip.y + 5], color, INK);
  if (role === 'sailor') for (let i = 0; i < 4; i++) line(c, [chest.x - 12, chest.y + 5 + i * 7, chest.x + 13, chest.y + 5 + i * 7], '#37546a', 3);
  if (role === 'bro') label(c, 'PRAXIS', chest.x, chest.y + 16, 5, INK, 29);
  if (role === 'dj') label(c, 'VIBES', chest.x, chest.y + 15, 6, '#501c47', 30);
  oval(c, head.x, head.y, 17, 21, skin, INK);
  poly(c, [head.x - 17, head.y - 5, head.x - 15, head.y - 19, head.x - 3, head.y - 25, head.x + 12, head.y - 21, head.x + 18, head.y - 10, head.x + 4, head.y - 15], role === 'bro' ? '#9a723d' : '#3d3438', INK);
  if (role === 'bro') { oval(c, head.x, head.y - 24, 9, 6, '#815d39', INK); poly(c, [head.x - 11, head.y + 9, head.x + 14, head.y + 8, head.x + 2, head.y + 23], '#6c4b31'); }
  if (role === 'sailor') { box(c, head.x - 17, head.y - 21, 34, 10, '#f4e4b9', INK, 4); line(c, [head.x - 20, head.y - 11, head.x + 20, head.y - 11], INK, 5); }
  for (const x of [-6, 7]) oval(c, head.x + x, head.y, 2, fall > .7 ? 1 : 2.7, INK);
  if (role === 'dj' || role === 'influencer') {
    box(c, head.x - 15, head.y - 5, 13, 8, '#142b39', '#f9cf74', 2);
    box(c, head.x + 1, head.y - 5, 13, 8, '#142b39', '#f9cf74', 2);
    line(c, [head.x - 2, head.y - 2, head.x + 1, head.y - 2], '#f9cf74', 2);
  }
  if (role === 'dj') { line(c, [head.x - 19, head.y - 1, head.x - 19, head.y - 17, head.x - 9, head.y - 26, head.x + 12, head.y - 24, head.x + 20, head.y - 13, head.x + 20, head.y + 1], '#9bf5d1', 5); }
  oval(c, head.x + 3, head.y + 11, 4, 1.3 + (1 - fall) * Math.max(0, Math.sin(t * 7)) * 2, '#733d3a');
  bone(c, p.back, color, 10);
  hand(c, p.back.end, skin);
}
