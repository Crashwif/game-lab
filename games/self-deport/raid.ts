/**
 * The crash: the unmarked van, the agents, the tackle, the stamp, and then the game itself crashing into a
 * blue screen. Everything plays from the raid's age, seeded by nothing but it, so a replay or a late entry
 * draws the same frame. A dodged raid finds the note instead.
 */
import { INK, box, clamp, ease, glow, line, noise, oval, plain, shape, stamp, text } from './drawing';
import { BSOD, NOTE, STAMP } from './lines';
import { GROUND, HERO_X, type Point } from './memo';
import { mulberry32 } from './motion';
import { AGENT, figure, van } from './threats';

/** The raid's beats, in seconds after the frozen one. */
export const RAID = { door: 0.42, out: 0.5, tackle: 0.95, stamp: 1.12, slam: 1.5, go: 1.62, glitch: 1.8, bsod: 2.15 } as const;
export type Outcome = 'caught' | 'dodged';

const STOP_X = 490;
const vanAt = (age: number, outcome: Outcome) => (outcome === 'caught' && age > RAID.go ? STOP_X - 1500 * ((age - RAID.go) / 0.9) ** 2 : 1210 - 720 * ease(age / 0.55));

export function drawRaid(c: CanvasRenderingContext2D, age: number, hero: Point, outcome: Outcome, time: number): void {
  if (age < 0) return;
  const x = vanAt(age, outcome);
  const caught = outcome === 'caught';
  // Skid: the stop, and the getaway.
  if (age > 0.22 && age < 1.2) { c.save(); c.globalAlpha = 0.7 * (1 - clamp((age - 0.7) / 0.5)); line(c, [[x + 60, 531], [x + 60 + 160 * clamp((age - 0.22) / 0.3), 531]], '#15161f', 7); line(c, [[x - 96, 531], [x - 96 + 150 * clamp((age - 0.22) / 0.3), 531]], '#15161f', 7); c.restore(); }
  if (age > 0.25 && age < 1.1) for (let i = 0; i < 4; i++) { const u = clamp((age - 0.25 - i * 0.08) / 0.7); c.save(); c.globalAlpha = 0.55 * (1 - u); oval(c, x + 70 + i * 22 + u * 30, 526 - u * 28, 16 + 20 * u, 10 + 12 * u, '#ffffff'); c.restore(); }
  if (caught && age > RAID.go) { c.save(); c.globalAlpha = 0.7; line(c, [[STOP_X + 80, 531], [x + 80, 531]], '#15161f', 7); c.restore(); for (let i = 0; i < 4; i++) { const u = clamp((age - RAID.go - i * 0.06) / 0.8); c.save(); c.globalAlpha = 0.5 * (1 - u); oval(c, STOP_X + 70 + i * 26, 524 - u * 24, 18 + 24 * u, 10 + 12 * u, '#ffffff'); c.restore(); } }
  const door = caught ? ease((age - RAID.door) / 0.18) * (1 - ease((age - RAID.slam) / 0.12)) : ease((age - RAID.door) / 0.18);
  van(c, x, 534, door, age < 0.6 ? 1 : 0, caught ? 0 : (Math.sin(age * 8) > 0 ? 1 : 0), true);
  // The agents hop out and run up the sidewalk on planted feet.
  if (age >= RAID.out && (!caught || age < RAID.tackle + 0.2)) {
    for (let i = 0; i < 3; i++) {
      const start = RAID.out + i * 0.08;
      if (age < start) continue;
      const from = STOP_X + 24 + i * 18, to = hero.x + (caught ? 38 : 30) + i * 32;
      const u = ease((age - start) / (caught ? 0.42 : 0.7));
      const px = from - (from - to) * u;
      const travel = (from - px);
      const arrived = u >= 1;
      const pose = !caught && arrived ? (i === 0 ? { front: { x: 22, y: -8 }, back: { x: 6, y: 24 } } : i === 2 ? { front: { x: 4, y: -34 }, back: { x: -8, y: 24 } } : { front: { x: 14, y: 18 }, back: { x: -12, y: 18 } }) : { front: { x: 26, y: -4 }, back: { x: -20, y: 10 } };
      c.save(); c.globalAlpha = ease((age - start) / 0.12);
      const h = figure(c, px, GROUND, 0.92, -1, arrived ? null : travel / 40, 40, AGENT, pose);
      if (!caught && arrived && i === 0 && age > 1.3) { c.save(); c.translate(h.front.x, h.front.y - 8); c.rotate(-0.2); box(c, -18, -14, 36, 28, '#fff7cf', 2, 2); plain(c, NOTE[0] ?? '', 0, -2, 6, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); plain(c, NOTE[1] ?? '', 0, 7, 5, '#7a3b2a', 'center', 'system-ui, sans-serif', 800); c.restore(); }
      if (caught && i === 1) { box(c, h.front.x - 5, h.front.y - 14, 10, 18, '#141420', 2, 2); box(c, h.front.x - 3, h.front.y - 12, 6, 12, '#8ff', 1, 0); }
      c.restore();
    }
    if (!caught && age > 1.5) { box(c, hero.x + 70, GROUND - 180, 150, 24, '#f6f1e4', 6, 2); plain(c, age < 3 ? '…“water the plants”?' : 'he self-deported. voluntarily.', hero.x + 145, GROUND - 164, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 142); }
  }
  // The tackle: a cloud with boots, a hat, stars and a lot of yelling in it.
  if (caught && age >= RAID.tackle) {
    const t = age - RAID.tackle;
    const grow = ease(t / 0.18), fade = 1 - ease((t - 0.55) / 0.5);
    const r = mulberry32(917);
    c.save(); c.globalAlpha = fade; c.translate(hero.x + 40, GROUND - 58);
    for (let i = 0; i < 11; i++) { const a = r() * Math.PI * 2, d = 14 + r() * 74, s = 26 + r() * 30; oval(c, Math.cos(a) * d * grow, Math.sin(a) * d * grow * 0.7, s * (0.5 + grow), s * (0.5 + grow) * 0.85, i % 2 ? '#d9d2c2' : '#efe9dc', 3); }
    const spin = t * 9;
    for (let i = 0; i < 5; i++) { const a = spin + i * 1.25, d = 72 * grow; c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d * 0.6); c.rotate(a); if (i === 0) box(c, -12, -6, 24, 10, '#7a4f2a', 3, 2); else if (i === 1) box(c, -10, -5, 20, 10, '#1b1f2e', 3, 2); else shape(c, [[0, -9], [3, -3], [9, -3], [4, 1], [6, 8], [0, 4], [-6, 8], [-4, 1], [-9, -3], [-3, -3]], '#ffd166', 2); c.restore(); }
    text(c, t < 0.4 ? '!!' : t < 0.8 ? 'STOP RESISTING' : 'HE ISN’T', 0, -92 - 10 * grow, 18, '#fff2c9', 'center', 190);
    c.restore();
  }
  // The stamp slams in.
  const s = age - RAID.stamp;
  if (s > 0) {
    const kind = caught ? STAMP.caught : STAMP.dodged;
    stamp(c, 520, 236, 420, 118, caught ? '#f06c78' : '#5aa36d', s, -0.06, () => { text(c, kind.small, 0, -28, 13, '#fff0c5', 'center', 380); text(c, kind.big, 0, 30, 50, '#fff0c5', 'center', 380); });
  }
}

/** The picture tears before it dies: slices of the last frame thrown sideways, bars, static, scanlines. */
export function drawGlitch(c: CanvasRenderingContext2D, snap: HTMLCanvasElement, age: number): void {
  const w = c.canvas.width, h = c.canvas.height;
  const r = mulberry32(1 + Math.floor(age * 36));
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 10; i++) {
    const y = Math.floor(r() * h), sh = Math.floor(8 + r() * 60), dx = Math.floor((r() - 0.5) * 140 * (0.5 + age));
    c.drawImage(snap, 0, y, w, sh, dx, y, w, sh);
  }
  c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.35;
  c.drawImage(snap, 6 + 10 * age, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  for (let i = 0; i < 6; i++) { c.fillStyle = ['#00f0ff', '#ff00aa', '#ffffff', '#0a62c9'][i % 4]!; c.globalAlpha = 0.25 + r() * 0.4; c.fillRect(0, r() * h, w, 2 + r() * 10); }
  c.globalAlpha = 0.5; for (let i = 0; i < 40; i++) { const g = Math.floor(r() * 255); c.fillStyle = `rgb(${g},${g},${g})`; c.fillRect(r() * w, r() * h, 4 + r() * 60, 2 + r() * 6); }
  c.globalAlpha = 0.12; c.fillStyle = '#000'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 2);
  c.restore();
}

/** The blue screen: the round died, so the game does too. The percentage sticks at 37 like it always has. */
export function drawBsod(c: CanvasRenderingContext2D, age: number): void {
  c.fillStyle = '#0a62c9'; c.fillRect(0, 0, 960, 540);
  const pct = age > 9 ? 100 : Math.min(BSOD.stuck, Math.floor(BSOD.stuck * ease(age / 2.4)));
  plain(c, BSOD.face, 118, 196, 112, '#ffffff', 'left', 'system-ui, sans-serif', 300);
  BSOD.body.forEach((lineText, i) => plain(c, lineText, 118, 252 + i * 30, 21, '#ffffff', 'left', 'system-ui, sans-serif', 400));
  plain(c, `${pct}% complete`, 118, 376, 26, '#ffffff', 'left', 'system-ui, sans-serif', 400);
  // A square that looks like a code and is not one.
  box(c, 118, 404, 92, 92, '#ffffff', 0, 0);
  const r = mulberry32(287);
  for (let gy = 0; gy < 11; gy++) for (let gx = 0; gx < 11; gx++) { const finder = (gx < 3 && gy < 3) || (gx > 7 && gy < 3) || (gx < 3 && gy > 7); if (finder ? (gx === 1 || gy === 1 || gx === 9 || gy === 9) !== ((gx + gy) % 2 === 0) : r() > 0.55) { c.fillStyle = '#0a62c9'; c.fillRect(124 + gx * 7.3, 410 + gy * 7.3, 6.5, 6.5); } }
  plain(c, BSOD.more, 230, 424, 13, '#ffffff', 'left', 'system-ui, sans-serif', 400, 700);
  plain(c, BSOD.code, 230, 462, 14, '#ffffff', 'left', 'system-ui, sans-serif', 400);
  plain(c, BSOD.failed, 230, 484, 14, '#ffffff', 'left', 'system-ui, sans-serif', 400);
  plain(c, BSOD.qr, 164, 512, 9, '#cfe3ff', 'center', 'system-ui, sans-serif', 400);
  if (Math.floor(age * 2) % 2 === 0) plain(c, '_', 118 + 14 * `${pct}% complete`.length, 376, 26, '#ffffff', 'left', 'system-ui, sans-serif', 400);
}
