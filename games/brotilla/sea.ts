import { box, hash, label, line, oval, poly, type Ctx } from './ink';
import type { Layout } from './layout';

export function skyAndSea(c: Ctx, l: Layout, t: number) {
  const { w, h, horizon: hy, portrait } = l;
  const sky = c.createLinearGradient(0, l.top, 0, hy + 60);
  sky.addColorStop(0, '#e77871'); sky.addColorStop(.6, '#f2b28d'); sky.addColorStop(1, '#f7dab0');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  const sunX = w * .65, sunY = hy - (portrait ? 67 : 31);
  const halo = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 160);
  halo.addColorStop(0, '#fff6c8bb'); halo.addColorStop(1, '#ffe0ac00');
  c.fillStyle = halo; c.fillRect(0, l.top, w, hy);
  oval(c, sunX, sunY, portrait ? 66 : 64, portrait ? 66 : 64, '#ffe5ad');
  // Hand-inked cloud shelves, with a slow drift instead of per-frame particles.
  for (let i = 0; i < 10; i++) {
    const x = ((hash(i + 6) * w + t * (2 + i % 3)) % (w + 210)) - 105;
    const y = l.top + 25 + hash(i + 21) * (hy - l.top - 50);
    const r = 36 + hash(i) * 53;
    oval(c, x, y, r, 4 + hash(i + 2) * 8, '#f9d0a784');
    line(c, [x - r * .8, y + 7, x + r * .8, y + 7], '#ba737747', 1.3);
  }
  // Europe recedes as a silhouette; no claim to reconstruct a real voyage.
  poly(c, [0, hy + 4, 0, hy - 27, 35, hy - 29, 58, hy - 42, 80, hy - 27, 113, hy - 24, 139, hy - 7, 180, hy - 4, 205, hy + 6], '#657e8190');
  for (let i = 0; i < 7; i++) {
    const x = 7 + i * 16; box(c, x, hy - 34 - hash(i) * 12, 11, 33, '#687f80', undefined, 0);
  }
  const water = c.createLinearGradient(0, hy, 0, h);
  water.addColorStop(0, '#548f91'); water.addColorStop(.2, '#226b79'); water.addColorStop(.65, '#164c64'); water.addColorStop(1, '#102c46');
  c.fillStyle = water; c.fillRect(0, hy, w, h - hy);
  line(c, [0, hy, w, hy], '#f7d5a1', 2);
  for (let row = 0; row < 26; row++) {
    const z = row / 25, y = hy + z * z * (h - hy), amp = .7 + z * 4;
    const points: number[] = [];
    for (let x = -30; x <= w + 30; x += 12) points.push(x, y + Math.sin(x / (29 + z * 31) - t * (1.4 + z * .5) + row * 2.1) * amp);
    line(c, points, row % 3 ? '#82c4bc25' : '#b6dcc348', 1 + z * 1.3);
  }
  // The golden reflection widens toward camera.
  for (let i = 0; i < 34; i++) {
    const z = i / 34, y = hy + z * (h - hy - 20), drift = Math.sin(t * 1.9 + i * 1.7) * (4 + z * 13);
    const x = sunX + drift + (hash(i + 93) - .5) * z * 130;
    const width = 5 + hash(i + 18) * (13 + z * 80);
    line(c, [x - width / 2, y, x + width / 2, y + 1], `rgba(249,208,143,${.3 - z * .21})`, 1 + z * 2);
  }
  for (let i = 0; i < 5; i++) {
    const x = (i * 153 + t * 9) % (w + 100) - 50, y = l.top + 36 + i % 3 * 24;
    const flap = Math.sin(t * 3 + i) * 3;
    line(c, [x - 7, y + flap, x, y, x + 7, y + flap], '#765e64', 1.7);
  }
}

export function wake(c: Ctx, x: number, y: number, width: number, t: number, intensity = 1) {
  for (let i = 0; i < 5; i++) {
    const trail = (t * 24 + i * 33) % 168;
    c.globalAlpha = (1 - trail / 168) * .35 * intensity;
    c.beginPath(); c.ellipse(x - trail * .34, y + i * 4, width + trail * .23, 9 + i * 3, -.015, .05, Math.PI - .05);
    c.strokeStyle = i % 2 ? '#a9ddd0' : '#fff0bc'; c.lineWidth = i === 0 ? 3 : 1.5; c.stroke();
  }
  c.globalAlpha = 1;
}

export function distantBoat(c: Ctx, x: number, y: number, scale: number, t: number, name: string, luxury = false) {
  c.save(); c.translate(x, y + Math.sin(t * 1.5 + x) * 2); c.scale(scale, scale); c.rotate(Math.sin(t + x) * .018);
  if (luxury) {
    poly(c, [-66, -2, -51, -28, 35, -28, 59, -6], '#f5e6c4', '#355365');
    poly(c, [-40, -30, -28, -49, 16, -49, 34, -29], '#d5e7d2', '#355365');
    box(c, -35, -23, 66, 13, '#285f70', '#e3c58a', 2);
    for (let i = 0; i < 4; i++) line(c, [-25 + i * 15, -23, -25 + i * 15, -10], '#9abfb1', 2);
    line(c, [-13, -52, -13, -67, 5, -67], '#294b5b', 3);
  } else {
    line(c, [0, 4, 0, -91], '#345563', 3);
    poly(c, [-4, -86, -4, -11, -57, -11], '#e5d4ad', '#537783');
    poly(c, [4, -82, 4, -13, 49, -13], '#97c1ad', '#537783');
  }
  poly(c, [-80, -1, 78, -4, 59, 22, -61, 22], luxury ? '#eee4ce' : '#537983', '#244b5e');
  line(c, [-72, 5, 70, 1], '#da9a63', 3);
  label(c, name, 0, 12, 9, luxury ? '#34505a' : '#f2dfaf', 121, 'center', 'Georgia');
  if (luxury) label(c, 'SOLIDARITY · BUSINESS CLASS', 0, -35, 4.5, '#305361', 71);
  c.restore();
}
