/**
 * The set: the night behind the trailer (sky, moon, the tree line, the far field, the road and Miss Darlene's
 * trailer across it, which is what the kitchen window looks out on), the trailer itself in cutaway (the kitchen
 * open to the camera; the living room and the bathroom behind their front walls, a window each), the counter, the
 * front door and its steps, the skirting and the blocks, and the yard in front (the pickup, the pool, the tree,
 * the dish). After the blast only the scorched deck is left standing, with the toilet. Drawing and a little
 * ambient motion only; nothing here reads or changes the round's outcome.
 */
import {
  BASS, BATH_WINDOW, BULB, COUCH, COUNTER, DISH, DOOR, FAN, FRIDGE, FRONT, HEATER, HORIZON, LIVING_WINDOW, MOON,
  NEIGHBOUR, POOL, POT, RECIPE, ROAD, ROOMS, SHELF, STEPS, TOILET, TRAILER, TREE, TRUCK, TV, WINDOW,
} from './layout';
import { blit, blob, box, ink, INK, label, limb, poly, tile } from './ink';
import { clamp, mix, mulberry32, noise, smoothstep } from './motion';
import { drawShelfJar, rgba } from './still';

export interface WorldDrive {
  time: number;
  tension: number;
  depth: number;
  multiplier: number;
  running: boolean;
  /** The burner is lit: the show is on. */
  lit: boolean;
  /** Choreography seconds since the crash, or −1. */
  crash: number;
  /** The trailer is gone. */
  boom: boolean;
  /** The brew's colour and how hard it glows. */
  brew: [number, number, number];
  glow: number;
  /** World units per frame pixel: stars and hairlines keep their size on screen as the camera pulls out. */
  px: number;
  /** The front door: 0 shut, 1 wide open. */
  door: number;
  /** Jars of blue rock candy on the shelf. */
  jars: number;
  /** The gauge level, for the water heater's missing gauge. */
  level: number;
  /** The bare bulb's brightness, 0 dark to 1 (it flickers with the pressure). */
  bulb: number;
  /** What the camera can see, in world units (with a margin): anything wholly outside it is skipped. */
  view: { x0: number; y0: number; x1: number; y1: number };
  /** The close-up with the trailer standing: the night only shows through the kitchen window. */
  windowOnly: boolean;
}

/** Whether any of the box from (x0, y0) to (x1, y1) is in view. */
const sees = (d: WorldDrive, x0: number, y0: number, x1: number, y1: number): boolean => !(x1 < d.view.x0 || x0 > d.view.x1 || y1 < d.view.y0 || y0 > d.view.y1);

const { left: L, right: R, roof: ROOF, ceil: CEIL, floor: FLOOR, base: BASE, ground: GROUND } = TRAILER;

// ─── Textures ───────────────────────────────────────────────────────────────────────────────────────────────────
function paneling(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  return tile(ctx, 'panel', 48, 96, (g) => {
    g.fillStyle = '#7a5233';
    g.fillRect(0, 0, 48, 96);
    const rng = mulberry32(0x9a7e);
    for (let i = 0; i < 14; i += 1) {
      g.strokeStyle = rng() < 0.5 ? 'rgba(160, 110, 66, 0.45)' : 'rgba(70, 44, 24, 0.4)';
      g.lineWidth = 0.8 + rng() * 1.2;
      const x = rng() * 48;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 3 * (rng() - 0.5), 32, x + 4 * (rng() - 0.5), 64, x, 96);
      g.stroke();
    }
    g.fillStyle = '#3f2814';
    g.fillRect(0, 0, 1.6, 96);
    g.fillRect(24, 0, 1.2, 96);
  }) ?? '#7a5233';
}
function siding(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  return tile(ctx, 'siding', 64, 22, (g) => {
    g.fillStyle = '#d9d2b8';
    g.fillRect(0, 0, 64, 22);
    g.fillStyle = '#a69e83';
    g.fillRect(0, 19, 64, 3);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, 0, 64, 2);
    g.fillStyle = 'rgba(120, 80, 40, 0.18)';
    g.fillRect(40, 0, 3, 22);
  }) ?? '#d9d2b8';
}
function grass(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  return tile(ctx, 'grass', 96, 48, (g) => {
    g.fillStyle = '#1b2716';
    g.fillRect(0, 0, 96, 48);
    const rng = mulberry32(0x6a55);
    for (let i = 0; i < 70; i += 1) {
      const x = rng() * 96;
      const y = rng() * 48;
      g.strokeStyle = rng() < 0.5 ? 'rgba(52, 76, 38, 0.8)' : 'rgba(14, 22, 12, 0.8)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 4, y - 4 - rng() * 6);
      g.stroke();
    }
  }) ?? '#1b2716';
}
function gingham(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  return tile(ctx, 'gingham', 12, 12, (g) => {
    g.fillStyle = '#f3ece0';
    g.fillRect(0, 0, 12, 12);
    g.fillStyle = 'rgba(200, 50, 50, 0.55)';
    g.fillRect(0, 0, 6, 12);
    g.fillRect(0, 0, 12, 6);
  }) ?? '#e4b9b0';
}
function plaid(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  return tile(ctx, 'couch', 30, 30, (g) => {
    g.fillStyle = '#7b5a2c';
    g.fillRect(0, 0, 30, 30);
    g.fillStyle = 'rgba(40, 70, 40, 0.6)';
    g.fillRect(0, 10, 30, 8);
    g.fillRect(10, 0, 8, 30);
    g.fillStyle = 'rgba(230, 200, 120, 0.35)';
    g.fillRect(0, 24, 30, 2);
    g.fillRect(24, 0, 2, 30);
  }) ?? '#7b5a2c';
}

// ─── The night behind ───────────────────────────────────────────────────────────────────────────────────────────
const STARS = (() => {
  const rng = mulberry32(0x5eed);
  const out: { x: number; y: number; r: number; tw: number }[] = [];
  for (let i = 0; i < 230; i += 1) out.push({ x: -3200 + rng() * 6600, y: -1600 + rng() * 1760, r: 0.5 + rng() * 1.1, tw: rng() * 6 });
  // A few placed where the kitchen window can see them.
  for (const [x, y] of [[742, 104], [806, 122], [842, 98], [770, 150], [710, 168]] as const) out.push({ x, y, r: 1.2, tw: x * 0.01 });
  return out;
})();

/** The tree line: a ragged silhouette along the horizon, hashed so it never changes. */
function treeLine(ctx: CanvasRenderingContext2D, x0: number, x1: number): void {
  ctx.fillStyle = '#0a1020';
  ctx.beginPath();
  ctx.moveTo(x0, HORIZON + 2);
  for (let x = x0; x <= x1; x += 18) {
    const n = noise(Math.floor(x / 18) * 3.7);
    const tall = noise(Math.floor(x / 90) * 1.3) > 0.62 ? 26 : 0;
    ctx.lineTo(x, HORIZON - 12 - n * 22 - tall);
  }
  ctx.lineTo(x1, HORIZON + 2);
  ctx.closePath();
  ctx.fill();
}

/** Sky, stars, moon, the tree line, the far field, the road and its poles, and Miss Darlene's trailer. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, d: WorldDrive, lit: { porch: boolean; window: number; tv: boolean }): void {
  ctx.save();
  if (d.windowOnly) {
    // The trailer's back wall hides everything else: paint only what the window frames.
    ctx.beginPath();
    ctx.rect(WINDOW.x0 - 30, WINDOW.y0 - 30, WINDOW.x1 - WINDOW.x0 + 60, WINDOW.y1 - WINDOW.y0 + 60);
    ctx.clip();
  }
  const v = d.windowOnly ? { x0: WINDOW.x0 - 30, y0: WINDOW.y0 - 30, x1: WINDOW.x1 + 30, y1: WINDOW.y1 + 30 } : d.view;
  const g = ctx.createLinearGradient(0, -1700, 0, HORIZON);
  g.addColorStop(0, '#04060f');
  g.addColorStop(0.55, '#0c1430');
  g.addColorStop(1, '#25305a');
  ctx.fillStyle = g;
  const sx0 = Math.max(-3400, v.x0);
  const sx1 = Math.min(3800, v.x1);
  if (v.y0 < HORIZON) ctx.fillRect(sx0, Math.max(-1800, v.y0), sx1 - sx0, HORIZON - Math.max(-1800, v.y0));
  for (const s of STARS) {
    if (s.x < v.x0 || s.x > v.x1 || s.y < v.y0 || s.y > v.y1) continue;
    const a = 0.45 + 0.4 * Math.sin(d.time * 1.7 + s.tw);
    ctx.fillStyle = `rgba(235, 240, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * d.px * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The moon and its halo.
  if (v.x1 > MOON.x - MOON.r * 3.4 && v.y0 < MOON.y + MOON.r * 3.4) {
    const halo = ctx.createRadialGradient(MOON.x, MOON.y, MOON.r * 0.8, MOON.x, MOON.y, MOON.r * 3.2);
    halo.addColorStop(0, 'rgba(240, 236, 200, 0.22)');
    halo.addColorStop(1, 'rgba(240, 236, 200, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(MOON.x - MOON.r * 3.4, MOON.y - MOON.r * 3.4, MOON.r * 6.8, MOON.r * 6.8);
    blob(ctx, MOON.x, MOON.y, MOON.r, MOON.r, '#f2ecc8', 0);
    for (const [cx, cy, cr] of [[-20, -18, 14], [22, 10, 10], [-6, 30, 8]] as const) blob(ctx, MOON.x + cx, MOON.y + cy, cr, cr, 'rgba(200, 190, 150, 0.45)', 0);
  }
  treeLine(ctx, Math.max(-3400, Math.floor(v.x0 / 18) * 18 - 18), Math.min(3800, v.x1 + 18));
  // The far field, darkening toward the yard.
  const f = ctx.createLinearGradient(0, HORIZON, 0, GROUND);
  f.addColorStop(0, '#141d1a');
  f.addColorStop(1, '#0d140f');
  ctx.fillStyle = f;
  if (v.y1 > HORIZON) ctx.fillRect(sx0, HORIZON, sx1 - sx0, GROUND - HORIZON + 4);
  // The dirt road across the field, and its power poles.
  ctx.fillStyle = '#3a3226';
  ctx.fillRect(sx0, ROAD.y - 3, sx1 - sx0, 9);
  ctx.fillStyle = 'rgba(255, 240, 200, 0.06)';
  ctx.fillRect(sx0, ROAD.y - 1, sx1 - sx0, 2);
  for (let x = -3000; x <= 3600; x += 560) {
    if (x + 600 < v.x0 || x - 40 > v.x1) continue;
    ctx.fillStyle = '#1d1712';
    ctx.fillRect(x - 2, ROAD.y - 120, 4, 120);
    ctx.fillRect(x - 14, ROAD.y - 114, 28, 3);
  }
  ctx.strokeStyle = 'rgba(10, 10, 14, 0.8)';
  ctx.lineWidth = 1.2 * d.px * 0.6 + 0.6;
  for (const dy of [0, 6]) {
    ctx.beginPath();
    for (let x = -3000; x < 3600; x += 560) {
      if (x + 600 < v.x0 || x - 40 > v.x1) continue;
      ctx.moveTo(x - 12, ROAD.y - 113 + dy);
      ctx.quadraticCurveTo(x + 280, ROAD.y - 92 + dy, x + 548, ROAD.y - 113 + dy);
    }
    ctx.stroke();
  }
  neighbour(ctx, d, lit);
  ctx.restore();
}

/** Miss Darlene's trailer across the road: pink stripe, a lit window (or the TV's blue), a porch and its light. */
function neighbour(ctx: CanvasRenderingContext2D, d: WorldDrive, lit: { porch: boolean; window: number; tv: boolean }): void {
  const { x0, x1, roof, base } = NEIGHBOUR;
  // Blocks, body, roof, stripe.
  ctx.fillStyle = '#2a2622';
  for (let x = x0 + 8; x < x1 - 4; x += 22) ctx.fillRect(x, base - 4, 7, 6);
  box(ctx, x0, roof, x1 - x0, base - roof - 4, 5, '#a59f8e', 1.2);
  ctx.fillStyle = '#b05a78';
  ctx.fillRect(x0 + 1, roof + 22, x1 - x0 - 2, 4);
  ctx.fillStyle = '#6d6a61';
  ctx.fillRect(x0 - 2, roof - 2, x1 - x0 + 4, 4);
  // Her window: dark, the TV's flicker, or the kitchen light on.
  const wx = x0 + 52;
  const wy = roof + 8;
  const tv = lit.tv ? 0.35 + 0.35 * noise(Math.floor(d.time * 9)) : 0;
  ctx.fillStyle = lit.window > 0.02 ? `rgba(255, 214, 140, ${0.35 + 0.6 * lit.window})` : `rgba(90, 140, 255, ${tv})`;
  ctx.fillRect(wx, wy, 26, 14);
  ctx.strokeStyle = '#3d3a33';
  ctx.lineWidth = 1;
  ctx.strokeRect(wx, wy, 26, 14);
  // The door and the little porch with its light.
  ctx.fillStyle = '#5b4a3a';
  ctx.fillRect(x0 + 18, roof + 12, 12, base - roof - 16);
  ctx.fillStyle = '#4a3c2e';
  ctx.fillRect(x0 - 16, base - 10, 26, 4);
  ctx.fillRect(x0 - 14, base - 6, 3, 8);
  ctx.fillRect(x0 + 5, base - 6, 3, 8);
  if (lit.porch) {
    const p = ctx.createRadialGradient(x0 + 14, roof + 10, 1, x0 + 14, roof + 10, 40);
    p.addColorStop(0, 'rgba(255, 220, 150, 0.55)');
    p.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = p;
    ctx.fillRect(x0 - 30, roof - 30, 90, 80);
    blob(ctx, x0 + 14, roof + 10, 2, 2, '#fff1c8', 0);
  }
  // The flamingo by the step.
  ink(ctx, 0.8, '#d76b9a');
  ctx.beginPath();
  ctx.moveTo(x0 - 24, base);
  ctx.lineTo(x0 - 24, base - 8);
  ctx.stroke();
}

// ─── The trailer's interior ─────────────────────────────────────────────────────────────────────────────────────
/** The back wall from end to end, with the kitchen window cut out of it. */
function backWall(ctx: CanvasRenderingContext2D, x0: number, x1: number): void {
  ctx.fillStyle = paneling(ctx);
  ctx.beginPath();
  ctx.rect(x0, CEIL, x1 - x0, FLOOR - CEIL);
  ctx.rect(WINDOW.x0, WINDOW.y1, WINDOW.x1 - WINDOW.x0, WINDOW.y0 - WINDOW.y1);
  ctx.fill('evenodd');
  // The ceiling's shadow and the baseboard.
  const sh = ctx.createLinearGradient(0, CEIL, 0, CEIL + 60);
  sh.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sh;
  ctx.fillRect(x0, CEIL, x1 - x0, 60);
  ctx.fillStyle = '#4a311d';
  ctx.fillRect(x0, FLOOR - 14, x1 - x0, 14);
  // The linoleum's front edge.
  ctx.fillStyle = '#b39762';
  ctx.fillRect(x0, FLOOR - 4, x1 - x0, 4);
  // The post between the living room and the kitchen; the bathroom's wall.
  if (x0 <= ROOMS.post + 10 && x1 >= ROOMS.post - 10) box(ctx, ROOMS.post - 10, CEIL, 20, FLOOR - CEIL, 0, '#5d3d22', 2);
  if (x0 <= ROOMS.bath + 8 && x1 >= ROOMS.bath - 8) box(ctx, ROOMS.bath - 8, CEIL, 16, FLOOR - CEIL, 0, '#8a7f6a', 2);
}

/** The mounted bass on its plaque: it starts to sing on its own once the pressure is up. */
function bass(ctx: CanvasRenderingContext2D, d: WorldDrive): void {
  const sing = d.lit && d.crash < 0 ? smoothstep(0.55, 0.75, d.tension) * Math.max(0, Math.sin(d.time * 7)) : 0;
  const flap = sing > 0 ? Math.sin(d.time * 9) * 0.25 : 0;
  box(ctx, BASS.x - 56, BASS.y - 26, 112, 52, 22, '#6b4220', 2.2);
  ctx.save();
  ctx.translate(BASS.x, BASS.y);
  // Tail.
  ctx.save();
  ctx.translate(34, 0);
  ctx.rotate(flap);
  poly(ctx, [0, 0, 18, -14, 14, 0, 18, 14], '#5d7a3a', 2);
  ctx.restore();
  blob(ctx, 0, 0, 40, 15, '#6f8d42', 2.2);
  ctx.fillStyle = '#d9d2a6';
  ctx.beginPath();
  ctx.ellipse(-4, 6, 30, 7, 0, 0, Math.PI);
  ctx.fill();
  blob(ctx, -26, -4, 4, 4, '#f6f0d8', 1.4);
  blob(ctx, -26, -4, 1.6, 1.6, INK, 0);
  // The mouth opens on the beat.
  ctx.fillStyle = '#3b1a12';
  ctx.beginPath();
  ctx.ellipse(-38, 4, 5, 2 + 6 * sing, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (sing > 0.3) label(ctx, '♪', BASS.x - 62, BASS.y - 30 - 6 * sing, 14, '#f4efe2', 900);
}

/** The shelf over the counter: finished jars stand on it; past seven, a tally in marker. */
function shelfPlank(ctx: CanvasRenderingContext2D): void {
  const { x0, x1, y } = SHELF;
  for (const bx of [x0 + 16, x1 - 16]) poly(ctx, [bx - 3, y, bx + 3, y, bx + 3, y + 16, bx - 3, y + 6], '#5b5b5f', 1.5);
  box(ctx, x0, y, x1 - x0, 8, 1, '#8c6239', 2);
}
function shelf(ctx: CanvasRenderingContext2D, d: WorldDrive): void {
  const { x0, x1, y } = SHELF;
  const shown = Math.min(d.jars, 7);
  for (let i = 0; i < shown; i += 1) drawShelfJar(ctx, x0 + 18 + i * 26, y, 22, 30);
  if (d.jars > 7) label(ctx, `+${d.jars - 7}`, x1 - 4, y - 16, 13, '#f4efe2', 900, 40, 'right');
}

/** The bare bulb on its cord: it swings with the trailer and flickers with the pressure. */
function bulbSwing(d: WorldDrive, rock: number): number {
  return -rock * 5 + Math.sin(d.time * 1.4) * (0.03 + 0.12 * d.tension);
}
function bulb(ctx: CanvasRenderingContext2D, d: WorldDrive, rock: number): void {
  const a = bulbSwing(d, rock);
  const len = BULB.y - BULB.cord;
  const x = BULB.x + Math.sin(a) * len;
  const y = BULB.cord + Math.cos(a) * len;
  limb(ctx, [{ x: BULB.x, y: BULB.cord }, { x, y }], 2, '#222', 1);
  box(ctx, x - 5, y - 4, 10, 10, 2, '#7a6a52', 1.6);
  blob(ctx, x, y + 14, 9, 11, d.bulb > 0.4 ? '#fff4c4' : '#9a9378', 1.8);
}

/** Christmas lights along the kitchen ceiling, up since 2009: a few dead, the rest twinkling. */
function lights(ctx: CanvasRenderingContext2D, d: WorldDrive, x0: number, x1: number, y: number, scale = 1): void {
  const colours = ['#ff4b4b', '#4bff7a', '#4ba3ff', '#ffd24b', '#ff9a3c'];
  ink(ctx, 1.4 * scale, '#1d2a1a');
  ctx.beginPath();
  const span = 130 * scale;
  for (let x = x0; x < x1; x += span) {
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + span / 2, y + 16 * scale, Math.min(x1, x + span), y);
  }
  ctx.stroke();
  // Bulbs batched by colour and brightness: a few fills for the whole string.
  const bright: (Path2D | null)[] = [];
  const dim: (Path2D | null)[] = [];
  const make = () => (typeof Path2D === 'undefined' ? null : new Path2D());
  for (let k = 0; k < colours.length; k += 1) {
    bright.push(make());
    dim.push(make());
  }
  let i = 0;
  for (let x = x0 + 13 * scale; x < x1; x += 26 * scale, i += 1) {
    const u = ((x - x0) % span) / span;
    const sag = 4 * u * (1 - u) * 16 * scale * 0.5;
    const dead = i % 7 === 3;
    const on = !dead && Math.sin(d.time * 2.2 + i * 1.7) > -0.2;
    const p = (on ? bright : dim)[i % colours.length];
    if (!p) continue;
    const by = y + sag + 5 * scale;
    p.moveTo(x + 3 * scale, by);
    p.ellipse(x, by, 3 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  }
  colours.forEach((c, k) => {
    ctx.fillStyle = c;
    const b = bright[k];
    const m = dim[k];
    if (b) ctx.fill(b);
    ctx.globalAlpha = 0.25;
    if (m) ctx.fill(m);
    ctx.globalAlpha = 1;
  });
}

/** The window: its frame and sill, gingham curtains tied back, and the box fan in its corner. */
function windowFrameStatic(ctx: CanvasRenderingContext2D): void {
  const { x0, x1, y0, y1 } = WINDOW;
  // The frame and the sill.
  ink(ctx, 2.2);
  ctx.fillStyle = '#e9e2cf';
  for (const r of [[x0 - 10, y0 - 10, x1 - x0 + 20, 10], [x0 - 10, y1, x1 - x0 + 20, 10], [x0 - 10, y0, 10, y1 - y0], [x1, y0, 10, y1 - y0]] as const) {
    ctx.beginPath();
    ctx.rect(r[0], r[1], r[2], r[3]);
    ctx.fill();
    ctx.stroke();
  }
  box(ctx, x0 - 16, y1 + 8, x1 - x0 + 32, 8, 2, '#d9cfb6', 2);
}
function windowFrame(ctx: CanvasRenderingContext2D, d: WorldDrive): void {
  const { x0, x1, y0, y1 } = WINDOW;
  ctx.fillStyle = 'rgba(200, 220, 255, 0.05)';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // The fan: a square housing, a grille, blades that blur as they speed up.
  const spin = d.lit && d.crash < 0 ? d.time * (5 + 22 * d.tension) : d.time * 0.3;
  box(ctx, FAN.x - FAN.r - 6, FAN.y - FAN.r - 6, FAN.r * 2 + 12, FAN.r * 2 + 12, 4, '#cfd2cc', 2);
  blob(ctx, FAN.x, FAN.y, FAN.r, FAN.r, '#2c3036', 1.6);
  if (d.lit && d.tension > 0.35) {
    blob(ctx, FAN.x, FAN.y, FAN.r - 3, FAN.r - 3, 'rgba(160, 170, 180, 0.6)', 0);
  } else {
    for (let k = 0; k < 3; k += 1) {
      const a = spin + (k * Math.PI * 2) / 3;
      ctx.save();
      ctx.translate(FAN.x, FAN.y);
      ctx.rotate(a);
      blob(ctx, 14, 0, 13, 7, '#9ba3ab', 1.2);
      ctx.restore();
    }
  }
  ink(ctx, 0.8, 'rgba(220, 220, 220, 0.6)');
  for (let r = 8; r < FAN.r; r += 7) {
    ctx.beginPath();
    ctx.arc(FAN.x, FAN.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  blob(ctx, FAN.x, FAN.y, 5, 5, '#cfd2cc', 1.2);
  // Curtains, tied back, fluttering in the fan's draught.
  const flutter = d.lit && d.crash < 0 ? Math.sin(d.time * (3 + 8 * d.tension)) * (2 + 5 * d.tension) : 0;
  ctx.fillStyle = gingham(ctx);
  ink(ctx, 2);
  for (const side of [-1, 1]) {
    const edge = side < 0 ? x0 - 12 : x1 + 12;
    const tie = side < 0 ? x0 + 16 : x1 - 16;
    ctx.beginPath();
    ctx.moveTo(edge, y0 - 14);
    ctx.lineTo(edge + side * -34, y0 - 14);
    ctx.quadraticCurveTo(tie + flutter * 0.4, y0 + 40, tie + flutter, (y0 + y1) / 2 + 10);
    ctx.quadraticCurveTo(tie - side * 10, y1 - 10, edge - side * 6, y1 + 6);
    ctx.lineTo(edge, y1 + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  box(ctx, x0 - 24, y0 - 20, x1 - x0 + 48, 7, 3, '#8a6a3a', 1.8);
}

/** The fridge: avocado green, chrome handles, magnets, Mamaw's photo and the recipe taped to the door. */
export function drawFridge(ctx: CanvasRenderingContext2D, x0: number, top: number, open = 0): void {
  const w = FRIDGE.x1 - FRIDGE.x0;
  const h = FLOOR - top;
  box(ctx, x0, top, w, h, 8, '#8d9a3d', 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x0 + 6, top + 6, 10, h - 12);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x0, top + 110);
  ctx.lineTo(x0 + w, top + 110);
  ctx.stroke();
  box(ctx, x0 + 12, top + 70, 6, 30, 3, '#d7dadd', 1.6);
  box(ctx, x0 + 12, top + 124, 6, 54, 3, '#d7dadd', 1.6);
  for (const [mx, my, c] of [[x0 + 40, top + 40, '#e0402e'], [x0 + 92, top + 64, '#f2c230'], [x0 + 104, top + 300, '#3a8cff']] as const) blob(ctx, mx, my, 6, 5, c, 1.2);
  // Mamaw, in a photo booth strip, and the recipe on a napkin.
  box(ctx, x0 + 64, top + 20, 30, 38, 1, '#f4f0e4', 1.2);
  blob(ctx, x0 + 79, top + 36, 8, 9, '#e8c4a4', 1);
  blob(ctx, x0 + 79, top + 27, 10, 6, '#cfcfd6', 1);
  label(ctx, 'MAMAW', x0 + 79, top + 52, 5, '#555', 800);
  if (open > 0) {
    ctx.fillStyle = `rgba(255, 250, 220, ${0.6 * open})`;
    ctx.fillRect(x0 + 4, top + 114, w - 8, h - 120);
  }
}
function recipe(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(RECIPE.x, RECIPE.y);
  ctx.rotate(0.06);
  box(ctx, -36, -42, 72, 88, 3, '#fbf7ec', 1.5);
  box(ctx, -12, -48, 24, 10, 1, 'rgba(200, 200, 180, 0.8)', 1);
  const lines: [string, number, string][] = [
    ["MAMAW'S BLUE", 8, '#1d3f8f'],
    ['ROCK CANDY', 8, '#1d3f8f'],
    ['1. heat it', 7, '#333'],
    ['2. stir it', 7, '#333'],
    ["3. DON'T SMOKE", 7, '#c5221b'],
    ["4. don't tell", 7, '#333'],
    ['    mamaw', 7, '#333'],
  ];
  lines.forEach(([text, size, colour], i) => label(ctx, text, -32, -30 + i * 11, size, colour, i === 4 ? 900 : 700, 66, 'left'));
  ink(ctx, 1, '#c5221b');
  ctx.beginPath();
  ctx.moveTo(-32, 21);
  ctx.lineTo(28, 21);
  ctx.moveTo(-32, 23);
  ctx.lineTo(28, 23);
  ctx.stroke();
  ctx.restore();
}

/** The living room behind its front wall: the couch, the TV and its glow, Mamaw's portrait, the deer head. */
function livingRoom(ctx: CanvasRenderingContext2D): void {
  // Mamaw's portrait in an oval frame, and the deer head with a cap on its antler.
  box(ctx, -600, 120, 70, 90, 35, '#b08a4a', 2.5);
  blob(ctx, -565, 165, 26, 34, '#5a6d7a', 0);
  blob(ctx, -565, 160, 13, 15, '#e8c4a4', 1.4);
  blob(ctx, -565, 146, 15, 9, '#d6d6de', 1.4);
  box(ctx, -440, 150, 50, 70, 6, '#6b4220', 2);
  blob(ctx, -415, 196, 18, 26, '#8b6a44', 2);
  for (const side of [-1, 1]) {
    ink(ctx, 4, '#d8c9a8');
    ctx.beginPath();
    ctx.moveTo(-415 + side * 10, 176);
    ctx.quadraticCurveTo(-415 + side * 40, 150, -415 + side * 30, 116);
    ctx.moveTo(-415 + side * 30, 140);
    ctx.lineTo(-415 + side * 46, 130);
    ctx.stroke();
  }
  // The couch.
  ctx.fillStyle = plaid(ctx);
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.roundRect(COUCH.x0, 420, COUCH.x1 - COUCH.x0, 110, 18);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(COUCH.x0 - 16, 470, COUCH.x1 - COUCH.x0 + 32, 110, 16);
  ctx.fill();
  ctx.stroke();
  box(ctx, COUCH.x0 - 6, 580, 14, 20, 2, '#3b2a1a', 2);
  box(ctx, COUCH.x1 - 8, 580, 14, 20, 2, '#3b2a1a', 2);
  // The TV on a milk crate, rabbit ears.
  box(ctx, TV.x - 50, 520, 100, 80, 3, '#2f5f9a', 2.5);
  box(ctx, TV.x - 70, 400, 140, 120, 10, '#5a4632', 2.5);
  ink(ctx, 2, '#bbb');
  ctx.beginPath();
  ctx.moveTo(TV.x, 400);
  ctx.lineTo(TV.x - 40, 330);
  ctx.moveTo(TV.x, 400);
  ctx.lineTo(TV.x + 36, 334);
  ctx.stroke();
}
/** Whatever is on the TV: it flickers. */
function tvScreen(ctx: CanvasRenderingContext2D, d: WorldDrive): void {
  const flicker = 0.5 + 0.5 * noise(Math.floor(d.time * 8) * 1.7);
  box(ctx, TV.x - 56, 414, 96, 88, 14, `rgba(${Math.round(90 + 80 * flicker)}, ${Math.round(140 + 60 * flicker)}, 255, 1)`, 2);
}

/** The bathroom behind its wall: the toilet (it outlasts everything) and the water heater. */
function drawToilet(ctx: CanvasRenderingContext2D, x: number, floor: number, scorch = 0): void {
  box(ctx, x - 26, floor - 150, 52, 64, 6, scorch > 0.5 ? '#d6d0c4' : '#f4f2ee', 2.5);
  box(ctx, x - 30, floor - 158, 60, 10, 4, '#e8e6e0', 2);
  poly(ctx, [x - 40, floor - 84, x + 40, floor - 84, x + 26, floor - 40, x + 14, floor, x - 14, floor, x - 26, floor - 40], '#f4f2ee', 2.5);
  box(ctx, x - 44, floor - 92, 88, 10, 5, '#e8e6e0', 2.2);
  if (scorch > 0) {
    ctx.fillStyle = `rgba(30, 20, 15, ${0.3 * scorch})`;
    ctx.fillRect(x - 44, floor - 158, 88, 40);
  }
}
function drawHeater(ctx: CanvasRenderingContext2D, x: number, floor: number, gauge: boolean): void {
  box(ctx, x - 34, floor - 260, 68, 260, 14, '#e2e4e2', 2.5);
  label(ctx, 'WATER', x, floor - 160, 9, '#555', 900);
  label(ctx, 'HEATER', x, floor - 148, 9, '#555', 900);
  ink(ctx, 3, '#9a9a9a');
  ctx.beginPath();
  ctx.moveTo(x, floor - 260);
  ctx.lineTo(x, floor - 300);
  ctx.stroke();
  if (gauge) blob(ctx, x + 22, floor - 222, 9, 9, '#f8f4e8', 2);
  else {
    box(ctx, x + 14, floor - 228, 16, 12, 1, '#a7abb0', 1.5);
    label(ctx, 'BRB', x + 22, floor - 222, 5, '#333', 900);
  }
}

/** The kitchen's still life: the wall, the calendar, the shelf, the window's frame, the fridge and the recipe. */
function kitchenStatic(g: CanvasRenderingContext2D): void {
  backWall(g, KITCHEN.x0, KITCHEN.x1);
  // The feed store calendar, still on March.
  box(g, 196, 64, 60, 76, 2, '#f4efe2', 1.6);
  box(g, 200, 68, 52, 28, 1, '#5e8a3a', 1);
  blob(g, 214, 88, 6, 6, '#2b2b2b', 0);
  blob(g, 236, 88, 7, 7, '#2b2b2b', 0);
  box(g, 214, 76, 20, 10, 1, '#c5221b', 0);
  label(g, 'FEED & SEED', 226, 102, 6, '#333', 900);
  ink(g, 0.8, '#999');
  for (let r = 0; r < 4; r += 1) {
    g.beginPath();
    g.moveTo(200, 110 + r * 8);
    g.lineTo(252, 110 + r * 8);
    g.stroke();
  }
  shelfPlank(g);
  windowFrameStatic(g);
  drawFridge(g, FRIDGE.x0, FRIDGE.top);
  recipe(g);
  bulbLight(g);
}
/** The kitchen sprite's extent, and the living room's and the bathroom's either side of it. */
const KITCHEN = { x0: ROOMS.post - 20, x1: FRIDGE.x1 + 6 } as const;

/** Everything inside, back to front, up to the people: walls, decor, the window, the fridge, the bulb. */
export function drawInterior(ctx: CanvasRenderingContext2D, d: WorldDrive, rock: number): void {
  if (sees(d, L, CEIL, KITCHEN.x0, FLOOR)) {
    blit(ctx, 'living', L, CEIL - 2, KITCHEN.x0 - L, FLOOR - CEIL + 4, (g) => {
      backWall(g, L, KITCHEN.x0);
      livingRoom(g);
    }, 0.5);
    tvScreen(ctx, d);
  }
  if (sees(d, KITCHEN.x1, CEIL, R, FLOOR)) {
    blit(ctx, 'bath', KITCHEN.x1, CEIL - 2, R - KITCHEN.x1, FLOOR - CEIL + 4, (g) => backWall(g, KITCHEN.x1, R), 0.5);
    drawToilet(ctx, TOILET.x, FLOOR);
    drawHeater(ctx, HEATER.x, FLOOR, d.level < 1);
  }
  blit(ctx, 'kitchen', KITCHEN.x0, CEIL - 2, KITCHEN.x1 - KITCHEN.x0, FLOOR - CEIL + 4, kitchenStatic);
  bass(ctx, d);
  shelf(ctx, d);
  lights(ctx, d, ROOMS.post + 10, ROOMS.bath - 10, CEIL + 6);
  windowFrame(ctx, d);
  bulb(ctx, d, rock);
}

/** The counter: a harvest-gold top with a chrome edge, brown cabinet doors down to the floor, a dish towel. */
export function drawCounter(ctx: CanvasRenderingContext2D): void {
  const { left, right, top } = COUNTER;
  blit(ctx, 'counter', left - 10, top - 4, right - left + 20, FLOOR - top + 8, counter);
}
function counter(ctx: CanvasRenderingContext2D): void {
  const { left, right, top, edge } = COUNTER;
  box(ctx, left, top + edge, right - left, FLOOR - top - edge, 0, '#6b4423', 2.5);
  for (let x = left + 8; x < right - 60; x += 100) {
    box(ctx, x, top + edge + 30, 88, 200, 4, '#7c5230', 2);
    box(ctx, x + 10, top + edge + 42, 68, 176, 3, '#6b4423', 1.4);
    blob(ctx, x + 76, top + edge + 120, 4, 4, '#d8c27a', 1.4);
  }
  box(ctx, left, top + edge, right - left, 22, 0, '#7c5230', 2);
  // The dish towel on the drawer.
  ctx.save();
  ctx.translate(left + 180, top + edge + 18);
  box(ctx, -18, 0, 36, 70, 3, '#f4efe2', 1.8);
  ctx.fillStyle = '#c5403a';
  ctx.fillRect(-17, 12, 34, 5);
  ctx.fillRect(-17, 52, 34, 5);
  ctx.restore();
  box(ctx, left - 6, top, right - left + 12, edge, 2, '#d9a441', 2.5);
  ctx.fillStyle = '#c0c4c8';
  ctx.fillRect(left - 6, top + edge - 3, right - left + 12, 3);
}

// ─── The shell ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A front wall section from x0 to x1 with optional holes (a window, the doorway), in siding with the stripe. */
function frontWall(ctx: CanvasRenderingContext2D, x0: number, x1: number, holes: readonly (readonly [number, number, number, number])[]): void {
  ctx.fillStyle = siding(ctx);
  ctx.beginPath();
  ctx.rect(x0, ROOF + 12, x1 - x0, BASE - ROOF - 12);
  for (const [hx0, hy0, hx1, hy1] of holes) ctx.rect(hx0, hy1, hx1 - hx0, hy0 - hy1);
  ctx.fill('evenodd');
  // The turquoise band, the rust streaks.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, ROOF + 12, x1 - x0, BASE - ROOF - 12);
  for (const [hx0, hy0, hx1, hy1] of holes) ctx.rect(hx0, hy1, hx1 - hx0, hy0 - hy1);
  ctx.clip('evenodd');
  ctx.fillStyle = '#2f8f8a';
  ctx.fillRect(x0, 316, x1 - x0, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x0, 316, x1 - x0, 4);
  ctx.fillStyle = 'rgba(130, 70, 30, 0.25)';
  for (let x = x0 + 40; x < x1; x += 170) ctx.fillRect(x, ROOF + 20, 6, 120 + (x % 90));
  ctx.restore();
  ink(ctx, 3);
  ctx.strokeRect(x0, ROOF + 12, x1 - x0, BASE - ROOF - 12);
  for (const [hx0, hy0, hx1, hy1] of holes) ctx.strokeRect(hx0, hy0, hx1 - hx0, hy1 - hy0);
}

/** A window seen from outside, glowing with whatever light is inside, with the trim round it. */
function outsideWindow(ctx: CanvasRenderingContext2D, w: { x0: number; x1: number; y0: number; y1: number }, d: WorldDrive): void {
  ctx.fillStyle = 'rgba(255, 220, 160, 0.10)';
  ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
  if (d.glow > 0.05) {
    ctx.fillStyle = rgba(d.brew, 0.35 * d.glow);
    ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
  }
  ink(ctx, 6, '#e9e2cf');
  ctx.strokeRect(w.x0 - 4, w.y0 - 4, w.x1 - w.x0 + 8, w.y1 - w.y0 + 8);
  ink(ctx, 2.5);
  ctx.strokeRect(w.x0 - 8, w.y0 - 8, w.x1 - w.x0 + 16, w.y1 - w.y0 + 16);
  ctx.beginPath();
  ctx.moveTo((w.x0 + w.x1) / 2, w.y0);
  ctx.lineTo((w.x0 + w.x1) / 2, w.y1);
  ctx.stroke();
}

/**
 * The trailer's outside, drawn over the interior: the living room's and the bathroom's front walls (the kitchen is
 * the cutaway), the cut edges framing it, the roof, the floor's edge, the skirting and the blocks, the hitch, the
 * Christmas lights along the roof and the front door, which opens when the cousin leaves.
 */
export function drawShell(ctx: CanvasRenderingContext2D, d: WorldDrive): void {
  const doorHole = [DOOR.x0, DOOR.top, DOOR.x1, FLOOR] as const;
  const living = [LIVING_WINDOW.x0, LIVING_WINDOW.y0, LIVING_WINDOW.x1, LIVING_WINDOW.y1] as const;
  const bath = [BATH_WINDOW.x0, BATH_WINDOW.y0, BATH_WINDOW.x1, BATH_WINDOW.y1] as const;
  const livingSeen = sees(d, L - 160, ROOF, FRONT.cut0 - 8, GROUND);
  const bathSeen = sees(d, FRONT.cut1 + 8, ROOF, R + 10, GROUND);
  if (livingSeen) {
    frontWall(ctx, L, FRONT.cut0, [doorHole, living]);
    outsideWindow(ctx, LIVING_WINDOW, d);
  }
  if (bathSeen) {
    frontWall(ctx, FRONT.cut1, R, [bath]);
    outsideWindow(ctx, BATH_WINDOW, d);
  }
  // The door: hinged on its left, swinging out toward us.
  const open = clamp(d.door, 0, 1);
  if (livingSeen) {
  const w = (DOOR.x1 - DOOR.x0) * Math.cos(open * 1.35);
  if (open > 0.02) {
    ctx.fillStyle = '#0d0b0a';
    ctx.fillRect(DOOR.x0, DOOR.top, DOOR.x1 - DOOR.x0, FLOOR - DOOR.top);
  }
  box(ctx, DOOR.x0 - Math.sin(open * 1.35) * 8, DOOR.top, w, FLOOR - DOOR.top, 2, '#cfc6a8', 2.5);
  if (w > 20) {
    box(ctx, DOOR.x0 + w * 0.2, DOOR.top + 30, w * 0.6, 70, 3, 'rgba(255, 230, 170, 0.35)', 1.6);
    blob(ctx, DOOR.x0 + w - 12, DOOR.top + 150, 4, 4, '#c8b55a', 1.2);
  }
  }
  // The roof: a rounded edge in galvanised steel over the whole length; over the kitchen it is the cut section.
  box(ctx, L - 8, ROOF - 6, R - L + 16, 22, 10, '#9fa6ad', 3);
  // Over the kitchen, the roof's cut section: rafters and a seam of pink insulation.
  ctx.fillStyle = '#1a1512';
  ctx.fillRect(FRONT.cut0, ROOF + 14, FRONT.cut1 - FRONT.cut0, CEIL - ROOF - 14);
  ctx.fillStyle = 'rgba(232, 140, 166, 0.55)';
  ctx.fillRect(FRONT.cut0, ROOF + 24, FRONT.cut1 - FRONT.cut0, 8);
  ctx.fillStyle = '#3a2a1e';
  for (let x = FRONT.cut0 + 20; x < FRONT.cut1 - 10; x += 120) ctx.fillRect(x, ROOF + 14, 12, CEIL - ROOF - 14);
  // The cut edges either side of the kitchen.
  for (const x of [FRONT.cut0, FRONT.cut1]) {
    box(ctx, x - 8, ROOF + 12, 16, BASE - ROOF - 12, 0, '#2a201a', 2.5);
    ctx.fillStyle = '#e88ca6';
    ctx.fillRect(x - 4, ROOF + 30, 8, BASE - ROOF - 60);
  }
  // The floor's cut edge across the kitchen.
  box(ctx, FRONT.cut0, FLOOR, FRONT.cut1 - FRONT.cut0, BASE - FLOOR, 0, '#2a201a', 2.5);
  // The Christmas lights along the roof's edge, where there is still a front wall to hang them on.
  if (livingSeen) lights(ctx, d, L + 10, FRONT.cut0 - 10, ROOF + 4, 1.8);
  if (bathSeen) lights(ctx, d, FRONT.cut1 + 10, R - 10, ROOF + 4, 1.8);
  if (d.view.y1 < BASE) return;
  // Skirting, half kicked in, and the blocks behind it.
  box(ctx, L, BASE, R - L, GROUND - BASE, 0, '#2a2622', 3);
  for (let x = L + 30; x < R - 40; x += 160) {
    box(ctx, x, GROUND - 60, 44, 60, 2, '#8d8d8a', 2.5);
    box(ctx, x + 6, GROUND - 52, 12, 16, 1, '#5f5f5c', 1.4);
    box(ctx, x + 26, GROUND - 52, 12, 16, 1, '#5f5f5c', 1.4);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, BASE, R - L, GROUND - BASE);
  ctx.clip();
  ink(ctx, 4, '#b8a47c');
  for (let x = L - 100; x < R; x += 46) {
    if (Math.floor(x / 46) % 9 === 4) continue;
    ctx.beginPath();
    ctx.moveTo(x, BASE);
    ctx.lineTo(x + 92, GROUND);
    ctx.moveTo(x + 92, BASE);
    ctx.lineTo(x, GROUND);
    ctx.stroke();
  }
  ctx.restore();
  // The hitch at the left end.
  poly(ctx, [L, BASE - 6, L - 150, BASE + 30, L - 150, BASE + 42, L, BASE + 30], '#3a3633', 2.5);
  blob(ctx, L - 156, BASE + 36, 12, 10, '#4a4642', 2.5);
}

/** The wooden steps up to the door (in front of the trailer, so drawn after it). */
export function drawSteps(ctx: CanvasRenderingContext2D): void {
  const { x0, x1 } = STEPS;
  const rise = (GROUND - FLOOR) / 3;
  for (let i = 0; i < 3; i += 1) {
    const y = FLOOR + i * rise;
    box(ctx, x0 - i * 18, y, x1 - x0 + i * 36, 14, 2, '#8a6a42', 2.5);
    box(ctx, x0 - i * 18 + 8, y + 14, 10, rise - 14, 1, '#5d4628', 2);
    box(ctx, x1 + i * 18 - 18, y + 14, 10, rise - 14, 1, '#5d4628', 2);
  }
}

// ─── The yard ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The front yard's ground, the tree (and the branch Junior can end up on), the dish, a tire and the pool's water. */
export function drawYard(ctx: CanvasRenderingContext2D, d: WorldDrive): void {
  if (d.view.y1 < GROUND && !sees(d, TREE.x - 360, -600, TREE.x + 360, GROUND)) return;
  const gx0 = Math.max(-3400, d.view.x0);
  const gx1 = Math.min(3800, d.view.x1);
  ctx.fillStyle = grass(ctx);
  if (d.view.y1 > GROUND) ctx.fillRect(gx0, GROUND, gx1 - gx0, Math.min(1400, d.view.y1 - GROUND));
  // The dirt driveway under the truck, and the worn path from the steps.
  ctx.fillStyle = 'rgba(88, 72, 50, 0.65)';
  ctx.beginPath();
  ctx.ellipse(TRUCK.x0 + 300, TRUCK.ground + 20, 460, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse((STEPS.x0 + STEPS.x1) / 2, GROUND + 40, 90, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  // The tree at the right edge of the yard: trunk, the low branch, and the canopy.
  const tx = TREE.x;
  if (sees(d, tx - 360, -600, tx + 360, GROUND + 20)) {
  poly(ctx, [tx - 50, GROUND + 10, tx - 34, 120, tx - 20, -100, tx + 24, -100, tx + 34, 120, tx + 56, GROUND + 10], '#4a3626', 4);
  limb(ctx, [{ x: tx - 30, y: 330 }, { x: TREE.branch.x + 40, y: TREE.branch.y + 14 }, { x: TREE.branch.x - 60, y: TREE.branch.y - 20 }], 20, '#4a3626', 4);
  limb(ctx, [{ x: tx + 20, y: 40 }, { x: tx + 160, y: -40 }], 14, '#4a3626', 4);
  for (const [cx, cy, r] of [[tx - 120, -160, 170], [tx + 90, -190, 180], [tx - 10, -320, 190], [tx + 200, -60, 120], [tx - 220, -40, 110]] as const) blob(ctx, cx, cy, r, r * 0.8, '#1f3a28', 4);
  for (const [cx, cy, r] of [[tx - 80, -220, 90], [tx + 70, -270, 80], [tx + 150, -110, 60]] as const) blob(ctx, cx, cy, r, r * 0.7, 'rgba(90, 130, 100, 0.45)', 0);
  // Moonlight along the trunk's right edge.
  ink(ctx, 5, 'rgba(220, 230, 255, 0.25)');
  ctx.beginPath();
  ctx.moveTo(tx + 30, 100);
  ctx.lineTo(tx + 50, GROUND);
  ctx.stroke();
  }
  if (d.view.y1 < GROUND - 300) return;
  // The satellite dish on its pole, aimed at nothing in particular.
  ink(ctx, 6, '#5c5f63');
  ctx.beginPath();
  ctx.moveTo(DISH.x, GROUND + 10);
  ctx.lineTo(DISH.x, 520);
  ctx.stroke();
  ctx.save();
  ctx.translate(DISH.x, 500);
  ctx.rotate(-0.5);
  blob(ctx, 0, 0, 60, 22, '#c7cbd0', 3);
  ink(ctx, 3, '#5c5f63');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-50, -40);
  ctx.stroke();
  ctx.restore();
  // A tire planter and a flamingo by the pool.
  blob(ctx, 980, GROUND + 70, 70, 24, '#1a1a1c', 4);
  blob(ctx, 980, GROUND + 62, 40, 10, '#3f6b2e', 2);
  ink(ctx, 3.5, '#e07aa5');
  ctx.beginPath();
  ctx.moveTo(1380, POOL.y + 40);
  ctx.lineTo(1380, POOL.y - 30);
  ctx.stroke();
  blob(ctx, 1392, POOL.y - 50, 26, 14, '#e07aa5', 3);
  limb(ctx, [{ x: 1408, y: POOL.y - 56 }, { x: 1422, y: POOL.y - 96 }, { x: 1410, y: POOL.y - 104 }], 5, '#e07aa5', 2.5);
  // The kiddie pool: its back rim and the water (the front rim is drawn over whoever lands in it).
  blob(ctx, POOL.x, POOL.y, POOL.rx, POOL.ry, '#3b7fc4', 4);
  blob(ctx, POOL.x, POOL.y + 6, POOL.rx - 16, POOL.ry - 10, '#2c5f99', 0);
  ctx.fillStyle = 'rgba(200, 230, 255, 0.25)';
  ctx.beginPath();
  ctx.ellipse(POOL.x - 40 + Math.sin(d.time) * 10, POOL.y + 4, 50, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}
/** The pool's front rim, over anyone sitting in it. */
export function drawPoolFront(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(POOL.x - POOL.rx - 10, POOL.y, POOL.rx * 2 + 20, POOL.ry + 40);
  ctx.clip();
  ink(ctx, 4);
  ctx.fillStyle = '#4f9be0';
  ctx.beginPath();
  ctx.ellipse(POOL.x, POOL.y, POOL.rx, POOL.ry, 0, 0, Math.PI);
  ctx.lineTo(POOL.x - POOL.rx, POOL.y + 26);
  ctx.ellipse(POOL.x, POOL.y + 26, POOL.rx, POOL.ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 6; i += 1) blob(ctx, POOL.x - 120 + i * 48, POOL.y + POOL.ry + 12, 9, 7, i % 2 ? '#ffd24b' : '#ff6b6b', 2);
}

/**
 * The pickup, parked facing left in front of the living room: primer-grey with one red door, a dog box in the bed,
 * a NO FEAR sticker. `crushed` (0 → 1) flattens the cab after the roof lands on it.
 */
export function drawTruck(ctx: CanvasRenderingContext2D, crushed = 0): void {
  const { x0, x1, ground } = TRUCK;
  const wheelR = 62;
  const sill = ground - wheelR - 14;
  const crush = clamp(crushed, 0, 1);
  // Bed and tailgate (right), cab (middle-left), hood (left).
  const cabX0 = x0 + 150;
  const cabX1 = x0 + 330;
  const cabTop = mix(sill - 230, sill - 150, crush);
  box(ctx, cabX1 - 4, sill - 130, x1 - cabX1 + 4, 130, 6, '#6f7378', 3.5);
  box(ctx, cabX1 + 10, sill - 152, x1 - cabX1 - 16, 22, 4, '#5a5e63', 3);
  poly(ctx, [x0, sill - 20, x0 + 10, sill - 120, cabX0, sill - 130, cabX0, sill, x0, sill], '#7a7e83', 3.5);
  poly(ctx, [cabX0, sill, cabX0, sill - 130, cabX0 + 30, cabTop, cabX1, cabTop, cabX1, sill], '#b33b2e', 3.5);
  // Windows, grille, bumper, lights.
  poly(ctx, [cabX0 + 18, sill - 136, cabX0 + 40, cabTop + 16, cabX1 - 16, cabTop + 16, cabX1 - 16, sill - 136], 'rgba(120, 150, 180, 0.55)', 3);
  box(ctx, x0 - 16, sill - 56, 40, 40, 6, '#c9cdd2', 3);
  blob(ctx, x0 + 14, sill - 96, 14, 12, '#f6e9a6', 2.5);
  box(ctx, x0 + 220, sill - 64, 70, 26, 4, '#f4efe2', 2);
  label(ctx, 'NO FEAR', x0 + 255, sill - 51, 13, '#1d1418', 900, 64);
  // Wheels.
  for (const wx of [x0 + 110, x1 - 110]) {
    blob(ctx, wx, ground - wheelR, wheelR, wheelR, '#18181a', 4);
    blob(ctx, wx, ground - wheelR, wheelR * 0.45, wheelR * 0.45, '#7d8188', 3);
  }
  // The dog box in the bed.
  box(ctx, x1 - 170, sill - 196, 120, 66, 4, '#c9b48a', 3);
}

// ─── Light ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The bare bulb's warm pool on the back wall, painted into the kitchen's still life. */
function bulbLight(ctx: CanvasRenderingContext2D): void {
  const b = ctx.createRadialGradient(BULB.x, BULB.y + 14, 10, BULB.x, BULB.y + 14, 460);
  b.addColorStop(0, 'rgba(255, 216, 140, 0.24)');
  b.addColorStop(1, 'rgba(255, 216, 140, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = b;
  ctx.fillRect(BULB.x - 470, CEIL, 940, FLOOR - CEIL);
  ctx.restore();
}
/**
 * The brew's light over everything inside: from about 2× it tints the kitchen blue round the pot, and in a long
 * round it floods the room. When the bulb flickers off, the room dims a little.
 */
export function drawGlow(ctx: CanvasRenderingContext2D, d: WorldDrive): void {
  if (d.bulb < 0.9) {
    ctx.fillStyle = `rgba(10, 8, 20, ${0.35 * (1 - d.bulb)})`;
    ctx.fillRect(Math.max(L, d.view.x0), CEIL, Math.min(R, d.view.x1) - Math.max(L, d.view.x0), FLOOR - CEIL);
  }
  if (d.glow <= 0.02) return;
  const r = 200 + 200 * Math.min(1, d.glow);
  const g = ctx.createRadialGradient(POT.x, POT.rim, 16, POT.x, POT.rim, r);
  g.addColorStop(0, rgba(d.brew, 0.4 * d.glow));
  g.addColorStop(0.45, rgba(d.brew, 0.14 * d.glow));
  g.addColorStop(1, rgba(d.brew, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(POT.x - r, POT.rim - r, r * 2, r * 2);
  ctx.restore();
}

/** Outside at night: the kitchen's light spilling down onto the yard in front of the cutaway. */
export function drawSpill(ctx: CanvasRenderingContext2D, d: WorldDrive): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, BASE, 0, GROUND + 420);
  const c: [number, number, number] = d.glow > 0.05 ? d.brew : [255, 210, 150];
  g.addColorStop(0, rgba(c, 0.16 + 0.2 * d.glow));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(FRONT.cut0, BASE);
  ctx.lineTo(FRONT.cut1, BASE);
  ctx.lineTo(FRONT.cut1 + 260, GROUND + 420);
  ctx.lineTo(FRONT.cut0 - 260, GROUND + 420);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── After ──────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * What is left once the trailer has gone up: the deck on its blocks, scorched, the steps, the stub of the counter,
 * the toilet (standing, as they do) and small fires that burn down over the next few seconds.
 */
export function drawWreck(ctx: CanvasRenderingContext2D, d: WorldDrive, since: number): void {
  // Blocks and the deck.
  for (let x = L + 30; x < R - 40; x += 160) box(ctx, x, GROUND - 60, 44, 60, 2, '#6f6f6c', 2.5);
  poly(ctx, [L, FLOOR + 6, L + 120, FLOOR - 10, 300, FLOOR + 2, 760, FLOOR - 14, 1100, FLOOR, R, FLOOR - 6, R, BASE, L, BASE], '#2b231d', 3);
  ctx.fillStyle = '#4a3a2c';
  ctx.fillRect(L, FLOOR - 2, R - L, 8);
  // Charred stubs: the counter's end, a wall stud or two.
  box(ctx, 230, FLOOR - 70, 90, 70, 3, '#2e241c', 3);
  for (const [x, h] of [[-300, 110], [80, 60], [700, 140], [990, 90]] as const) box(ctx, x, FLOOR - h, 14, h, 1, '#1e1814', 2.5);
  drawToilet(ctx, TOILET.x, FLOOR, 1);
  // Small fires, dying down.
  const fade = 1 - smoothstep(4, 9, since);
  if (fade > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, s] of [[-420, 1], [140, 0.8], [560, 1.2], [880, 0.7], [1240, 0.9]] as const) {
      for (let k = 0; k < 3; k += 1) {
        const h = (50 + 40 * noise(Math.floor(d.time * 12) + x + k)) * s * fade;
        const fx = x + (k - 1) * 16 * s;
        const g = ctx.createLinearGradient(fx, FLOOR, fx, FLOOR - h);
        g.addColorStop(0, 'rgba(255, 170, 60, 0.9)');
        g.addColorStop(0.6, 'rgba(255, 110, 40, 0.5)');
        g.addColorStop(1, 'rgba(255, 80, 30, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(fx - 12 * s, FLOOR);
        ctx.quadraticCurveTo(fx - 6 * s, FLOOR - h * 0.6, fx + Math.sin(d.time * 8 + k) * 5, FLOOR - h);
        ctx.quadraticCurveTo(fx + 6 * s, FLOOR - h * 0.6, fx + 12 * s, FLOOR);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/** The bed's near side and the tailgate, drawn again over anyone who lands in the bed. */
export function drawTruckBedFront(ctx: CanvasRenderingContext2D): void {
  const { x1, ground } = TRUCK;
  const sill = ground - 62 - 14;
  box(ctx, x1 - 260, sill - 130, 264, 130, 6, '#6f7378', 3.5);
  box(ctx, x1 - 250, sill - 152, 250, 22, 4, '#5a5e63', 3);
}
