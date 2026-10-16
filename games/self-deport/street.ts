/**
 * The street: a dawn sky, a far skyline, a row of strip-mall facades, the sidewalk with its props, the
 * asphalt with parked cars, the paychecks along the way, the leaves off the blower and the spilled bills.
 * Everything standing is a pure function of world position, so any scroll draws the same street and a late
 * entry lands on the same props; only the particles are state, and they are capped.
 */
import { INK, box, clamp, ease, glow, line, noise, oval, plain, shape, text } from './drawing';
import { GROUND, type Point } from './memo';

export interface Leaf { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; tint: number }
export interface Spill { x: number; y: number; vx: number; vy: number; rot: number; life: number }
export interface Street {
  scroll: number;
  leaves: Leaf[];
  spills: Spill[];
  collected: Set<number>;
  leafClock: number;
}

const SEG = 520;
const FACADE = 360;
const SKY = 170;
const BILL = 260;
const LEAF_TINTS = ['#d8782c', '#e2a53a', '#b84b2a', '#9d8a2f'];

export const createStreet = (): Street => ({ scroll: 0, leaves: [], spills: [], collected: new Set(), leafClock: 0 });
export function resetStreet(s: Street): void { s.scroll = 0; s.leaves.length = 0; s.spills.length = 0; s.collected.clear(); s.leafClock = 0; }
export function settleStreet(s: Street, scroll: number): void { s.scroll = scroll; s.leaves.length = 0; s.spills.length = 0; s.collected.clear(); }

/** Advances the street by the pace and the particles by `dt`; leaves stream from the nozzle while it blows. */
export function stepStreet(s: Street, dt: number, speed: number, nozzle: Point | null, blowing: number): void {
  if (dt <= 0) return;
  s.scroll += speed * dt;
  if (nozzle && blowing > 0) {
    s.leafClock += dt * (7 + speed / 45) * blowing;
    while (s.leafClock >= 1) {
      s.leafClock -= 1;
      const r = noise(s.scroll * 0.37 + s.leaves.length * 1.3);
      const r2 = noise(s.scroll * 0.11 + 7.7);
      s.leaves.push({ x: nozzle.x, y: nozzle.y, vx: -speed * 0.9 - 110 - r * 170, vy: -70 + r2 * 130, rot: r * 6, vr: (r2 - 0.5) * 14, life: 0.9 + r * 0.7, tint: Math.floor(r2 * LEAF_TINTS.length) });
      if (s.leaves.length > 70) s.leaves.shift();
    }
  }
  for (let i = s.leaves.length - 1; i >= 0; i--) {
    const l = s.leaves[i]!;
    l.x += l.vx * dt; l.y += l.vy * dt; l.vy += 240 * dt; l.vx *= 1 - 1.1 * dt; l.rot += l.vr * dt; l.life -= dt;
    if (l.y > GROUND + 8) { l.y = GROUND + 8; l.vy = -Math.abs(l.vy) * 0.25; }
    if (l.life <= 0 || l.x < -60) s.leaves.splice(i, 1);
  }
  for (let i = s.spills.length - 1; i >= 0; i--) {
    const b = s.spills[i]!;
    b.x += (b.vx - speed * 0.6) * dt; b.y += b.vy * dt; b.vy += 900 * dt; b.rot += 5 * dt; b.life -= dt;
    if (b.y > GROUND + 4) { b.y = GROUND + 4; b.vy = 0; b.vx *= 0.5; }
    if (b.life <= 0 || b.x < -60) s.spills.splice(i, 1);
  }
}

const billAt = (k: number) => noise(k * 1.7 + 0.3) > 0.42;
const billX = (k: number) => k * BILL + 200 + noise(k * 2.3) * 100;

/** Picks up the paychecks the hero is passing; returns how many. */
export function collectBills(s: Street, heroX: number): number {
  const from = Math.floor((s.scroll - 200) / BILL) - 1;
  const to = Math.floor((s.scroll + 1000) / BILL) + 1;
  let got = 0;
  for (let k = from; k <= to; k++) {
    if (!billAt(k) || s.collected.has(k)) continue;
    if (Math.abs(billX(k) - s.scroll - heroX) < 28) { s.collected.add(k); got++; }
  }
  if (s.collected.size > 200) for (const k of s.collected) if (k < from - 20) s.collected.delete(k);
  return got;
}

/** Bills fly out of his pocket when he is spotted. */
export function spill(s: Street, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const r = noise(s.scroll + i * 3.1);
    s.spills.push({ x, y, vx: -120 + r * 260, vy: -300 - noise(i * 7.3 + s.scroll) * 200, rot: r * 4, life: 1.6 });
  }
  while (s.spills.length > 24) s.spills.shift();
}

const bill = (c: CanvasRenderingContext2D, x: number, y: number, rot: number, alpha = 1) => {
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot);
  box(c, -11, -7, 22, 14, '#e9f3d9', 2, 2); box(c, -8, -4, 16, 8, '#8fcf7a', 1, 1.5);
  plain(c, '$', 0, 3, 9, '#2e6b3a', 'center', 'system-ui, sans-serif', 900);
  c.restore();
};

export function drawBills(c: CanvasRenderingContext2D, s: Street, time: number): void {
  const from = Math.floor((s.scroll - 200) / BILL) - 1;
  const to = Math.floor((s.scroll + 1000) / BILL) + 1;
  for (let k = from; k <= to; k++) {
    if (!billAt(k) || s.collected.has(k)) continue;
    const x = billX(k) - s.scroll;
    if (x < -30 || x > 990) continue;
    bill(c, x, GROUND - 14 + Math.sin(time * 4 + k) * 3, Math.sin(time * 2 + k) * 0.2);
  }
}
export function drawSpills(c: CanvasRenderingContext2D, s: Street): void {
  for (const b of s.spills) bill(c, b.x, b.y, b.rot, clamp(b.life / 0.4));
}
export function drawLeaves(c: CanvasRenderingContext2D, s: Street): void {
  for (const l of s.leaves) {
    c.save(); c.globalAlpha = clamp(l.life / 0.3); c.translate(l.x, l.y); c.rotate(l.rot);
    oval(c, 0, 0, 6, 3.2, LEAF_TINTS[l.tint] ?? LEAF_TINTS[0]!, 1.5); c.restore();
  }
}

/** The dawn sky with a low sun, stars going out, and slow clouds. */
export function drawSky(c: CanvasRenderingContext2D, scroll: number, time: number, tension: number): void {
  const g = c.createLinearGradient(0, 0, 0, 460);
  g.addColorStop(0, '#1d2247'); g.addColorStop(0.5, `rgb(${92 + 40 * tension}, ${70 - 10 * tension}, 122)`); g.addColorStop(0.82, '#ff9c6b'); g.addColorStop(1, '#ffd58a');
  c.fillStyle = g; c.fillRect(0, 0, 960, 460);
  for (let i = 0; i < 26; i++) { const x = ((noise(i * 4.1) * 1100 - scroll * 0.02) % 1000 + 1000) % 1000 - 20, y = noise(i * 9.7) * 200; c.save(); c.globalAlpha = 0.25 + 0.3 * Math.sin(time * 2 + i); oval(c, x, y, 1.4, 1.4, '#ffffff'); c.restore(); }
  const sun = c.createRadialGradient(640, 350, 10, 640, 350, 260); sun.addColorStop(0, 'rgba(255, 190, 110, 0.55)'); sun.addColorStop(1, 'rgba(255, 190, 110, 0)');
  c.fillStyle = sun; c.fillRect(380, 90, 520, 370);
  for (let i = 0; i < 4; i++) {
    const x = ((noise(i * 5.3) * 1400 - time * (5 + i * 2) - scroll * 0.06) % 1300 + 1300) % 1300 - 150, y = 70 + noise(i * 2.9) * 120;
    c.save(); c.globalAlpha = 0.5; oval(c, x, y, 70, 16, '#f7d9e0'); oval(c, x - 40, y + 4, 40, 12, '#f7d9e0'); oval(c, x + 36, y + 3, 44, 13, '#f7d9e0'); c.restore();
  }
}

/** Far skyline: boxes, palms, a water tower and the recruitment billboard, at a quarter of the pace. */
export function drawFar(c: CanvasRenderingContext2D, scroll: number): void {
  const off = scroll * 0.25;
  const from = Math.floor((off - 100) / SKY), to = Math.floor((off + 1060) / SKY);
  for (let i = from; i <= to; i++) {
    const x = i * SKY - off, h = 60 + noise(i * 3.7) * 110, w = 90 + noise(i * 1.9) * 70;
    const col = noise(i * 0.7) > 0.5 ? '#2f2c4e' : '#3a3660';
    c.fillStyle = col; c.fillRect(x, 440 - h, w, h);
    for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 3; wx++) if (noise(i * 11 + wy * 3 + wx) > 0.72) { c.fillStyle = '#ffd48a'; c.fillRect(x + 12 + wx * 24, 440 - h + 14 + wy * 26, 10, 12); }
    if (noise(i * 2.2) > 0.78) { const px = x + w + 12; line(c, [[px, 440], [px - 6, 330]], '#2b2744', 7); for (let f = 0; f < 5; f++) { const a = -1.2 + f * 0.55; line(c, [[px - 6, 330], [px - 6 + Math.cos(a) * 46, 330 + Math.sin(a) * 30 + 10]], '#2b4a3a', 6); } }
    if (((i % 15) + 15) % 15 === 7) {
      // NOW HIRING: the job, the bonus, the bar.
      c.save(); c.translate(x, 0);
      line(c, [[30, 440], [30, 250]], '#2b2744', 8); line(c, [[150, 440], [150, 250]], '#2b2744', 8);
      box(c, 0, 170, 182, 92, '#f6f1e4', 3, 3);
      text(c, 'NOW HIRING', 91, 198, 17, '#1e3a8a', 'center', 170);
      text(c, 'ICE · $50,000 BONUS', 91, 222, 13, '#c2321e', 'center', 170);
      text(c, 'NO EXPERIENCE · VIBES CHECKED', 91, 248, 10, '#1e1a2b', 'center', 174);
      c.restore();
    }
    if (((i % 21) + 21) % 21 === 13) {
      c.save(); c.translate(x + 40, 0);
      line(c, [[-16, 440], [-8, 300]], '#2b2744', 5); line(c, [[46, 440], [38, 300]], '#2b2744', 5);
      oval(c, 15, 290, 40, 30, '#3a3660', 3); text(c, 'QUOTA', 15, 296, 11, '#ffd48a', 'center', 60);
      c.restore();
    }
  }
}

const FACADES = [
  { name: 'THE HARDWARE DEPOT', color: '#f26a1b', sign: '#ffffff', sub: 'PARKING LOT · DAY LABOR · SNACKS' },
  { name: 'LAUNDROMAT · 24 HR', color: '#f5a4c8', sign: '#4a1f3a', sub: 'LOST SOCKS · FOUND FEELINGS' },
  { name: 'IGLESIA', color: '#f3eee2', sign: '#7a3b2a', sub: 'SANCTUARY (PROBABLY)' },
  { name: 'PAYDAY LOANS', color: '#56b36a', sign: '#1e2a1e', sub: '400% APR · NO ID (WINK)' },
  { name: 'COUNTY COURTHOUSE', color: '#b8bcc8', sign: '#1e1a2b', sub: 'IMMIGRATION CHECK-IN → · ← EXIT (THEY WAIT HERE)' },
  { name: 'CAR WASH', color: '#4aa8e0', sign: '#ffffff', sub: '$8 · NO QUESTIONS ASKED' },
  { name: 'DOLLAR GENERIC', color: '#f2d23c', sign: '#1e1a2b', sub: 'EVERYTHING $1.25*' },
  { name: 'TAQUERIA EL PRIMO', color: '#d9453d', sign: '#fff2c9', sub: '#1 TACOS · OPEN · ALWAYS' },
  { name: 'CITY HALL', color: '#8fa3c7', sign: '#1e1a2b', sub: 'SANCTUARY CITY* · *BUDGET PENDING' },
  { name: 'HOLE FOODS', color: '#5c9c5a', sign: '#ffffff', sub: '$9 KALE · HARVESTED BY MEMO · $5/HR' },
  { name: 'PATRIOT PAWN', color: '#c43b3b', sign: '#ffffff', sub: 'WE BUY GOLD · WE SELL FREEDOM · NO REFUNDS' },
  { name: 'YOGA & YOUR RIGHTS', color: '#b48ad6', sign: '#2b1d3a', sub: 'HOT VINYASA · KNOW YOUR RIGHTS · $40 DROP-IN' },
  { name: 'DMV', color: '#cfc3a6', sign: '#1e1a2b', sub: 'NOW SERVING: 3,000 · ESTIMATED WAIT: 19 YEARS' },
  { name: 'LUXURY LOFTS', color: '#9a9aa6', sign: '#1e1a2b', sub: 'FORMERLY AFFORDABLE · FROM $4,200' },
  { name: 'BAIL BONDS & CROSSFIT', color: '#2b2f3a', sign: '#f2d23c', sub: 'GET OUT · GET SWOLE · 24 HR' },
  { name: 'ESQUIRE & ESQUIRE', color: '#6b4a2a', sign: '#f6f1e4', sub: 'DEPORTATION DEFENSE · ALSO DUI · ALSO DIVORCE' },
  { name: 'THE DISPENSARY', color: '#3a7a5a', sign: '#d9f99d', sub: 'LAND ACKNOWLEDGMENT INSIDE · ID REQUIRED (IRONIC)' },
  { name: 'ICE FIELD OFFICE', color: '#26314f', sign: '#f2d04b', sub: 'NOW HIRING · ALSO DETAINING · TAKE A NUMBER' },
];
/** Whether a sign colour is light, so the lettering on it goes dark. */
const light = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.55; };

/** The strip mall, at 0.6 of the pace: each facade is chosen by its index, so the same street always comes back. */
export function drawFacades(c: CanvasRenderingContext2D, scroll: number, time: number): void {
  const off = scroll * 0.6;
  const from = Math.floor((off - 40) / FACADE) - 1, to = Math.floor((off + 1000) / FACADE) + 1;
  for (let i = from; i <= to; i++) {
    const x = i * FACADE - off;
    const f = FACADES[(((i * 5 + Math.floor(noise(i * 7.1) * 3)) % FACADES.length) + FACADES.length) % FACADES.length]!;
    const h = 190 + noise(i * 3.3) * 70, top = 440 - h;
    box(c, x, top, FACADE - 14, h + 8, f.color, 4, 3);
    box(c, x - 4, top - 10, FACADE - 6, 16, '#3b3658', 3, 3);
    if (noise(i * 5.9) > 0.5) box(c, x + 40, top - 32, 44, 24, '#8d8ea8', 3, 3);
    box(c, x + 18, top + 22, FACADE - 50, 46, f.sign, 6, 3);
    text(c, f.name, x + FACADE / 2 - 7, top + 55, 24, f.sign === '#ffffff' ? f.color : light(f.sign) ? '#1e1a2b' : '#fff2c9', 'center', FACADE - 70);
    plain(c, f.sub, x + FACADE / 2 - 7, top + 86, 11, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, FACADE - 60);
    // Windows, a door and an awning. The car wash spins its brushes.
    for (let w = 0; w < 3; w++) box(c, x + 24 + w * 104, top + 104, 70, 70, '#2b3350', 4, 3);
    box(c, x + 150, 362, 56, 80, '#2b3350', 4, 3); box(c, x + 196, 400, 6, 12, '#ffd48a', 1, 1);
    c.save(); c.fillStyle = '#ffffff22'; for (let w = 0; w < 3; w++) c.fillRect(x + 30 + w * 104, top + 110, 22, 58); c.restore();
    if (f.name === 'CAR WASH') for (let b = 0; b < 3; b++) { const a = time * 4 + b; oval(c, x + 60 + b * 104, top + 140, 26, 26 * Math.abs(Math.cos(a)), '#7cc6ff', 2); }
    if (f.name === 'IGLESIA') { line(c, [[x + 170, top - 12], [x + 170, top - 54]], '#7a3b2a', 7); line(c, [[x + 156, top - 40], [x + 184, top - 40]], '#7a3b2a', 7); }
    if (f.name === 'COUNTY COURTHOUSE') for (let p = 0; p < 4; p++) box(c, x + 36 + p * 84, top + 100, 20, 342 - top - 100, '#d8dbe4', 3, 3);
    switch (f.name) {
      case 'CITY HALL': oval(c, x + 170, top - 26, 48, 26, '#d8dbe4', 3); line(c, [[x + 230, top - 10], [x + 230, top - 70]], '#2d2a33', 3); box(c, x + 230, top - 70, 30, 18, '#4a8fd1', 2, 2); break;
      case 'HOLE FOODS': for (let b = 0; b < 3; b++) { box(c, x + 30 + b * 60, 406, 50, 32, '#8a5a3c', 3, 3); for (let k = 0; k < 4; k++) oval(c, x + 40 + b * 60 + k * 11, 404, 6, 6, k % 2 ? '#e63946' : '#57b57b', 1.5); } break;
      case 'PATRIOT PAWN': for (let s = 0; s < 3; s++) plain(c, '★', x + 60 + s * 110, top + 18, 18, '#f6f1e4', 'center'); break;
      case 'YOGA & YOUR RIGHTS': for (let p = 0; p < 5; p++) { c.save(); c.translate(x + 170, top + 150); c.rotate(-1.2 + p * 0.6); oval(c, 0, -22, 10, 24, '#f5d0e6', 2); c.restore(); } break;
      case 'DMV': box(c, x + 120, top + 100, 116, 34, '#1e1a2b', 3, 2); plain(c, 'NOW SERVING', x + 178, top + 114, 9, '#ff5d5d', 'center', 'ui-monospace, monospace', 700); plain(c, `${3000 + Math.floor(time / 9) % 1}`, x + 178, top + 129, 13, '#ff5d5d', 'center', 'ui-monospace, monospace', 700); break;
      case 'LUXURY LOFTS': for (let r = 0; r < 3; r++) for (let w = 0; w < 7; w++) box(c, x + 22 + w * 46, top + 98 + r * 28, 30, 18, r === 1 && w === 3 ? '#ffd48a' : '#2b3350', 2, 2); break;
      case 'BAIL BONDS & CROSSFIT': line(c, [[x + 110, top + 140], [x + 230, top + 140]], '#2d2a33', 8); for (const dx of [110, 230]) { box(c, x + dx - 8, top + 118, 16, 44, '#4a4a58', 3, 3); } break;
      case 'ESQUIRE & ESQUIRE': line(c, [[x + 170, top + 104], [x + 170, top + 150]], '#f2d04b', 4); line(c, [[x + 120, top + 112], [x + 220, top + 112]], '#f2d04b', 4); for (const dx of [120, 220]) { line(c, [[x + dx, top + 112], [x + dx - 16, top + 140]], '#f2d04b', 2); line(c, [[x + dx, top + 112], [x + dx + 16, top + 140]], '#f2d04b', 2); oval(c, x + dx, top + 142, 18, 5, '#f2d04b', 2); } break;
      case 'THE DISPENSARY': glow(c, x + 170, top + 134, 46, '120, 255, 140', 0.5 + 0.2 * Math.sin(time * 5)); line(c, [[x + 170, top + 112], [x + 170, top + 156]], '#7fff9a', 7); line(c, [[x + 148, top + 134], [x + 192, top + 134]], '#7fff9a', 7); break;
      case 'ICE FIELD OFFICE': box(c, x + 40, 400, 60, 40, '#f2d04b', 3, 3); plain(c, 'TAKE A', x + 70, 416, 8, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); plain(c, 'NUMBER', x + 70, 428, 8, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); for (let p = 0; p < 4; p++) { line(c, [[x + 110 + p * 30, 440], [x + 110 + p * 30, 414]], '#8e98a0', 3); } line(c, [[x + 110, 418], [x + 200, 418]], '#c2321e', 3); break;
      default: break;
    }
    const stripe = noise(i * 1.3) > 0.5 ? '#2b3350' : '#c2321e';
    for (let a = 0; a < 7; a++) box(c, x + 24 + a * 44, top + 176, 44, 14, a % 2 ? stripe : '#f6f1e4', 2, 2);
  }
  // Grass strip behind the sidewalk.
  c.fillStyle = '#6f8f4a'; c.fillRect(0, 436, 960, 6);
}

/** The sidewalk at the pace: slabs, the curb and one prop per segment. */
export function drawSidewalk(c: CanvasRenderingContext2D, scroll: number): void {
  c.fillStyle = '#a3a8ae'; c.fillRect(0, 440, 960, 38);
  c.strokeStyle = '#8a8f95'; c.lineWidth = 2;
  for (let x = -((scroll % 84) + 84) % 84; x < 980; x += 84) { c.beginPath(); c.moveTo(x, 440); c.lineTo(x, 478); c.stroke(); }
  c.fillStyle = '#6e737a'; c.fillRect(0, 476, 960, 6);
  const from = Math.floor((scroll - 200) / SEG) - 1, to = Math.floor((scroll + 1000) / SEG) + 1;
  for (let i = from; i <= to; i++) {
    const x = i * SEG + 120 + noise(i * 2.1) * 220 - scroll;
    if (x < -160 || x > 1100) continue;
    const kind = Math.floor(noise(i * 3.3) * 8) % 8;
    c.save(); c.translate(x, GROUND);
    switch (kind) {
      case 0: box(c, -40, -6, 80, 10, '#9a6b3c', 2, 3); for (let b = 0; b < 3; b++) box(c, -34 + (b % 2) * 6, -30 - b * 22, 68, 24, '#5d3a22', 6, 3); text(c, 'MULCH', 0, -40, 11, '#f0d9a8', 'center', 56); break;
      case 1: box(c, -8, -34, 16, 36, '#d64545', 4, 3); box(c, -11, -36, 22, 8, '#d64545', 3, 3); oval(c, 0, -40, 7, 5, '#d64545', 3); box(c, -16, -24, 8, 8, '#d64545', 2, 2); box(c, 8, -24, 8, 8, '#d64545', 2, 2); break;
      case 2: box(c, -16, -58, 32, 46, '#2f55a4', 6, 3); oval(c, 0, -58, 16, 7, '#2f55a4', 3); box(c, -4, -16, 8, 18, '#2f55a4', 2, 2); text(c, 'MAIL', 0, -32, 10, '#ffffff', 'center', 28); break;
      case 3: for (let k = 0; k < 3; k++) { c.save(); c.translate(k * 26 - 26, 0); shape(c, [[-14, 0], [-3, -40], [3, -40], [14, 0]], '#ff6a1f', 3); box(c, -12, -16, 24, 5, '#f4f4f0', 0, 0); c.restore(); } box(c, -42, -78, 84, 30, '#f6f1e4', 4, 3); text(c, 'CONES', 0, -64, 11, '#1e1a2b', 'center', 70); text(c, 'HELP YOURSELF', 0, -53, 8, '#c2321e', 'center', 74); break;
      case 4: box(c, -46, -22, 92, 8, '#8a5a3c', 3, 3); box(c, -46, -40, 92, 14, '#8a5a3c', 3, 3); box(c, -44, -14, 6, 14, '#3b3b47', 1, 2); box(c, 38, -14, 6, 14, '#3b3b47', 1, 2); box(c, -52, -88, 104, 46, '#f6f1e4', 4, 3); text(c, 'SELF-DEPORT APP', 0, -70, 11, '#1e3a8a', 'center', 92); text(c, 'GET $1,000*', 0, -56, 11, '#c2321e', 'center', 92); plain(c, '*terms: lol', 0, -46, 7, '#1e1a2b', 'center', 'system-ui, sans-serif', 700); break;
      case 5: box(c, -22, -30, 44, 32, '#9a4a2e', 5, 3); line(c, [[0, -30], [0, -70]], '#6b4a2a', 6); for (let f = 0; f < 5; f++) { const a = -1.4 + f * 0.6; line(c, [[0, -70], [Math.cos(a) * 34, -70 + Math.sin(a) * 22 + 8]], '#3f8a4a', 6); } break;
      case 6: box(c, -16, -54, 32, 54, '#e9d35a', 4, 3); box(c, -12, -48, 24, 20, '#2b3350', 2, 2); text(c, 'EXTRA', 0, -34, 8, '#fff2c9', 'center', 22); text(c, 'QUOTA UP', 0, -14, 8, '#1e1a2b', 'center', 28); break;
      default: box(c, -16, -44, 32, 44, '#4a5d6b', 5, 3); box(c, -18, -48, 36, 8, '#4a5d6b', 3, 3); box(c, -2, -62, 30, 16, '#d9b47a', 2, 2); plain(c, 'PIZZA', 13, -51, 8, '#7a3b2a', 'center', 'system-ui, sans-serif', 800); break;
    }
    c.restore();
  }
}

/** The asphalt in front, with lane dashes, a manhole and the parked cars, drawn after the people on the sidewalk. */
export function drawAsphalt(c: CanvasRenderingContext2D, scroll: number): void {
  c.fillStyle = '#2f3240'; c.fillRect(0, 480, 960, 60);
  c.fillStyle = '#e6c04a';
  for (let x = -((scroll * 1.1 % 120) + 120) % 120; x < 980; x += 120) c.fillRect(x, 524, 52, 4);
  const from = Math.floor((scroll * 1.1 - 200) / 900) - 1, to = Math.floor((scroll * 1.1 + 1000) / 900) + 1;
  for (let i = from; i <= to; i++) { const x = i * 900 + noise(i) * 400 - scroll * 1.1; oval(c, x, 508, 18, 6, '#242634', 2); }
}

export function drawParked(c: CanvasRenderingContext2D, scroll: number, time: number): void {
  const off = scroll * 1.1;
  const from = Math.floor((off - 300) / 1300) - 1, to = Math.floor((off + 1100) / 1300) + 1;
  for (let i = from; i <= to; i++) {
    const x = i * 1300 + 300 + noise(i * 4.7) * 500 - off;
    if (x < -260 || x > 1200) continue;
    const kind = Math.floor(noise(i * 2.9) * 3) % 3;
    c.save(); c.translate(x, 534);
    oval(c, 0, 2, 110, 10, '#15142b55');
    if (kind === 0) {
      shape(c, [[-100, -8], [-92, -40], [-60, -44], [-40, -68], [40, -68], [66, -44], [96, -40], [102, -8]], '#8d93a0', 4);
      shape(c, [[-56, -44], [-38, -64], [36, -64], [60, -44]], '#1f2535', 3);
    } else if (kind === 1) {
      shape(c, [[-110, -8], [-110, -50], [-30, -50], [-30, -64], [20, -64], [36, -44], [100, -44], [104, -8]], '#3f7a3a', 4);
      shape(c, [[-26, -60], [16, -60], [30, -44], [-26, -44]], '#1f2535', 3);
      box(c, -100, -48, 70, 8, '#2b3350', 2, 2); box(c, -96, -70, 40, 22, '#c94a3a', 4, 3); line(c, [[-60, -70], [-40, -84]], '#2d2a33', 4);
      text(c, 'MEMO’S LAWN CARE', -40, -22, 11, '#fff2c9', 'center', 120); plain(c, 'EST. 2007 · LICENSED · LOVED', -40, -12, 7, '#d8f0c0', 'center', 'system-ui, sans-serif', 800);
    } else {
      shape(c, [[-100, -8], [-100, -46], [-70, -70], [70, -70], [96, -46], [100, -8]], '#7a2e46', 4);
      shape(c, [[-66, -46], [-50, -64], [64, -64], [86, -46]], '#1f2535', 3);
      c.save(); c.globalAlpha = 0.9; box(c, 20, -40, 40, 22, '#f6f1e4', 2, 2); plain(c, 'BABY', 40, -30, 7, '#1e1a2b', 'center', 'system-ui, sans-serif', 800); plain(c, 'ON BOARD', 40, -23, 6, '#1e1a2b', 'center', 'system-ui, sans-serif', 800); c.restore();
    }
    for (const w of [-62, 64]) { oval(c, w, -4, 20, 20, '#1d2130', 3); oval(c, w, -4, 9, 9, '#8e98a0', 2); }
    c.restore();
  }
}

/** The note he leaves on the sidewalk when he goes. */
export function drawNote(c: CanvasRenderingContext2D, x: number, lines: readonly string[], alpha: number): void {
  if (alpha <= 0.01) return;
  c.save(); c.globalAlpha = alpha; c.translate(x, GROUND);
  line(c, [[0, 0], [0, -60]], '#8a5a3c', 6);
  c.rotate(-0.06); box(c, -62, -104, 124, 50, '#fff7cf', 4, 3);
  text(c, lines[0] ?? '', 0, -84, 13, '#1e1a2b', 'center', 110); text(c, lines[1] ?? '', 0, -66, 11, '#7a3b2a', 'center', 110);
  c.restore();
}
