/**
 * The church basement on a Thursday: a drop ceiling with three fluorescent tubes (the right one flickers),
 * cinderblock walls painted a tired green, speckled lino, the DEGEN ANONYMOUS banner over a cloth that reads WE
 * ARE POWERLESS OVER THE CHART on two pins, the folding table of supermarket cookies, the podium with the big
 * book of grievances that fills with the room's top pumps, the corner TV on its cart that shows the chart nobody
 * talks about (it grows more prominent with the tension), the door, and the coffee urn whose steam rises like a
 * smoke signal and whose drip quickens. The crash tips the urn into a pour and a puddle that runs to Jules's
 * shoe, brings the cloth down one pin at a time onto the cookies, face-down, and rains Terry's snacks over the
 * circle. Every crash motion is closed-form in the crash clock and seeded from the crash point.
 */
import { box, ink, INK, label, MEME_FONT } from './ink';
import type { Joint } from './kinematics';
import { clamp, gust, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

export const FLOOR_Y = 272;
export const TABLE = { x0: 300, x1: 580, top: 226, front: 236, skirt: 256 } as const;
export const CLOTH = { x0: 296, x1: 576, y: 125, h: 30 } as const;
export const DOOR = { x: 612, y: 104, w: 80, h: 168 } as const;
export const TV = { x: 868, y: 152, w: 128, h: 96 } as const;
export const URN = { x: 74, base: 484, spout: 458 } as const;
const URN_TABLE = { x0: 10, x1: 132, top: 478, front: 492 } as const;
const PODIUM = { x: 74, y: 302 } as const;

export interface Basement {
  steam: number;
  drip: number;
  /** The book: entries written so far, the page turning, how many the open page shows. */
  entries: number;
  turn: Spring;
  /** Seconds since the corner TV disagreed with Big Ron. */
  tvFlash: number;
  flickerOff: boolean;
  events: { drip: boolean; flicker: boolean; page: boolean };
}

export const createBasement = (): Basement => ({ steam: 0, drip: 0, entries: 0, turn: spring(1), tvFlash: 99, flickerOff: false, events: { drip: false, flicker: false, page: false } });
export function resetBasement(b: Basement): void {
  Object.assign(b, createBasement());
}

export interface BasementDrive {
  time: number;
  tension: number;
  depth: number;
  multiplier: number;
  running: boolean;
  crashed: boolean;
  crashT: number;
  /** How many of the room's top pumps the book holds (captioned lines said). */
  entries: number;
  /** The TV's beat this frame. */
  tv: boolean;
}

/** Settles the book to the entries already written (late entry). */
export function settleBasement(b: Basement, entries: number): void {
  b.entries = entries;
  settleSpring(b.turn, 1);
}

export function stepBasement(b: Basement, d: BasementDrive, dt: number): void {
  b.events = { drip: false, flicker: false, page: false };
  // The steam puffs like a signal, faster with the tension; the drip quickens.
  b.steam += dt / mix(1.5, 0.55, d.tension);
  if (!d.crashed) {
    const before = b.drip;
    b.drip += dt * (0.7 + 4.2 * d.tension * d.tension + 1.5 * d.depth);
    if (Math.floor(before) !== Math.floor(b.drip)) b.events.drip = true;
  }
  if (d.entries > b.entries) {
    b.entries = d.entries;
    b.turn.x = 0;
    b.turn.v = 0;
    b.events.page = true;
  }
  stepSpring(b.turn, 1, 7, 0.9, dt);
  if (d.tv) b.tvFlash = 0;
  b.tvFlash += dt;
  const off = tubeOff(d.time, d.crashed ? d.crashT : -1);
  if (off && !b.flickerOff) b.events.flicker = true;
  b.flickerOff = off;
}

/** All three tubes stutter just after the crash. */
const stutter = (crashT: number): boolean => crashT >= 0.25 && crashT < 0.75;

/** The right-hand tube: mostly on, in bursts of flicker every few seconds; at the crash all three stutter. */
function tubeOff(time: number, crashT: number): boolean {
  if (stutter(crashT)) return noise(Math.floor(crashT * 18) + 3) < 0.5;
  const burst = Math.sin(time * 0.53) + 0.6 * Math.sin(time * 1.37 + 1);
  if (burst < 1.05) return false;
  return noise(Math.floor(time * 13)) < 0.45;
}

// ─── The backdrop, cached ────────────────────────────────────────────────────────────────────────────────
let backdrop: HTMLCanvasElement | null = null;
const VP = { x: 480, y: 150 } as const;

function paintBackdrop(ctx: CanvasRenderingContext2D): void {
  // The drop ceiling, tiles receding to the back wall.
  ctx.fillStyle = '#d6d3c4';
  ctx.fillRect(0, 0, 960, 36);
  ctx.strokeStyle = '#b7b3a2';
  ctx.lineWidth = 1.5;
  for (const y of [12, 24]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }
  for (let i = -6; i <= 18; i += 1) {
    const x = 480 + (i - 6) * 80;
    ctx.beginPath();
    ctx.moveTo(VP.x + (x - VP.x) * 1.6, -20);
    ctx.lineTo(x, 36);
    ctx.stroke();
  }
  ctx.fillStyle = '#a9a693';
  ctx.fillRect(0, 34, 960, 4);
  // The cinderblock wall, painted a tired green, every block a little different.
  ctx.fillStyle = '#9db098';
  ctx.fillRect(0, 38, 960, FLOOR_Y - 38);
  for (let row = 0; row < 15; row += 1) {
    const y = 38 + row * 16;
    for (let col = -1; col < 25; col += 1) {
      const x = col * 42 + (row % 2) * 21;
      const n = noise(row * 31 + col * 7.3);
      ctx.fillStyle = `rgba(${n < 0.5 ? '255,255,240' : '40,60,40'}, ${0.03 + 0.05 * Math.abs(n - 0.5)})`;
      ctx.fillRect(x + 1, y + 1, 40, 14);
    }
    ctx.fillStyle = 'rgba(232,240,224,0.55)';
    ctx.fillRect(0, y, 960, 1.5);
    for (let col = -1; col < 25; col += 1) ctx.fillRect(col * 42 + (row % 2) * 21, y, 1.5, 16);
  }
  // The lower wall, painted darker, under a brown chair rail.
  ctx.fillStyle = 'rgba(60,90,62,0.55)';
  ctx.fillRect(0, 206, 960, FLOOR_Y - 206);
  ctx.fillStyle = '#5c4632';
  ctx.fillRect(0, 202, 960, 6);
  ctx.fillStyle = '#3e5a40';
  ctx.fillRect(0, FLOOR_Y - 8, 960, 8);
  // The lino: speckled tiles in perspective, a few in a dull red.
  ctx.fillStyle = '#c4b38c';
  ctx.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);
  const rows: number[] = [];
  for (let k = 0; k < 14; k += 1) rows.push(FLOOR_Y + (540 - FLOOR_Y) * ((Math.pow(1.32, k) - 1) / (Math.pow(1.32, 13) - 1)));
  const xAt = (i: number, y: number): number => VP.x + (i * 64 - VP.x) * ((y - VP.y) / (FLOOR_Y - VP.y));
  for (let r = 0; r < rows.length - 1; r += 1) {
    for (let i = -14; i < 30; i += 1) {
      const y0 = rows[r]!;
      const y1 = rows[r + 1]!;
      const odd = (i + r) % 2 === 0;
      const accent = noise(i * 13.1 + r * 7.7) > 0.86;
      ctx.fillStyle = accent ? '#a8664f' : odd ? '#cdbd97' : '#b9a67f';
      ctx.beginPath();
      ctx.moveTo(xAt(i, y0), y0);
      ctx.lineTo(xAt(i + 1, y0), y0);
      ctx.lineTo(xAt(i + 1, y1), y1);
      ctx.lineTo(xAt(i, y1), y1);
      ctx.closePath();
      ctx.fill();
    }
  }
  const speck = mulberry32(0x5eed);
  for (let k = 0; k < 700; k += 1) {
    const y = FLOOR_Y + speck() ** 1.4 * (540 - FLOOR_Y);
    ctx.fillStyle = speck() < 0.5 ? 'rgba(80,60,40,0.25)' : 'rgba(255,250,235,0.3)';
    ctx.fillRect(speck() * 960, y, 1 + (y - FLOOR_Y) / 140, 1 + (y - FLOOR_Y) / 200);
  }
  ctx.strokeStyle = 'rgba(70,55,40,0.28)';
  ctx.lineWidth = 1;
  for (const y of rows) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }
  // A braided rug in the middle of the circle, worn where the chairs scrape.
  for (const [k, colour] of [[1, '#7a4a3a'], [0.86, '#a8664f'], [0.72, '#c9a065'], [0.58, '#8a5a44'], [0.44, '#b77a52'], [0.3, '#d2b07a']] as const) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(480, 428, 190 * k, 54 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,25,20,0.35)';
  ctx.lineWidth = 1.5;
  for (const k of [1, 0.86, 0.72, 0.58, 0.44, 0.3]) {
    ctx.beginPath();
    ctx.ellipse(480, 428, 190 * k, 54 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The fluorescent wash: brighter under the tubes, a sheen on the floor in the middle.
  const wash = ctx.createRadialGradient(480, 330, 40, 480, 330, 520);
  wash.addColorStop(0, 'rgba(255,255,235,0.16)');
  wash.addColorStop(1, 'rgba(20,30,20,0.22)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 36, 960, 504);
  // The cork board: the bake sale, the choir, stack your chairs.
  box(ctx, 152, 116, 112, 70, 3, '#b98a56', 2.5);
  const flyers: [number, number, number, number, string, string][] = [
    [160, 122, 34, 26, '#fff7d6', 'BAKE SALE'],
    [198, 126, 30, 34, '#d7ecff', 'CHOIR'],
    [232, 120, 26, 28, '#ffd9d9', 'LOST MITT'],
    [164, 152, 40, 28, '#ffffff', 'STACK CHAIRS'],
    [210, 160, 46, 22, '#e6f6d6', 'COFFEE FUND'],
  ];
  for (const [x, y, w, h, colour, text] of flyers) {
    ctx.fillStyle = colour;
    ink(ctx, 1);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    label(ctx, text, x + w / 2, y + 7, 5, INK, 800, w - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 3; k += 1) ctx.fillRect(x + 3, y + 12 + k * 4, w - 6, 1);
    ctx.fillStyle = '#d23a3a';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // The radiator.
  box(ctx, 150, 222, 104, 40, 4, '#c8c2b2', 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 9; k += 1) {
    ctx.beginPath();
    ctx.moveTo(160 + k * 11, 226);
    ctx.lineTo(160 + k * 11, 258);
    ctx.stroke();
  }
  // DEGEN ANONYMOUS, a vinyl banner on grommets.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(272, 84, 330, 40);
  box(ctx, 268, 78, 330, 40, 3, '#2c3e66', 2.5);
  ctx.fillStyle = '#e8e0c8';
  for (const x of [276, 590]) {
    ctx.beginPath();
    ctx.arc(x, 85, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `900 27px ${MEME_FONT}`;
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2e6c4';
  ctx.fillText('DEGEN ANONYMOUS', 433, 99, 300);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#f2b84b';
  ctx.fillRect(282, 112, 302, 2);
  // The door: a fire door with a wired window, a push bar, a kick plate; EXIT glowing over it.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(DOOR.x - 8, DOOR.y - 6, DOOR.w + 16, DOOR.h + 6);
  box(ctx, DOOR.x - 6, DOOR.y - 6, DOOR.w + 12, DOOR.h + 6, 2, '#6e6a5e', 2.5);
  box(ctx, DOOR.x, DOOR.y, DOOR.w, DOOR.h, 2, '#8a6a4a', 2.5);
  box(ctx, DOOR.x + 30, DOOR.y + 16, 20, 52, 2, '#3a4a52', 2);
  ctx.strokeStyle = 'rgba(200,220,230,0.5)';
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 6; k += 1) {
    ctx.beginPath();
    ctx.moveTo(DOOR.x + 30, DOOR.y + 20 + k * 9);
    ctx.lineTo(DOOR.x + 50, DOOR.y + 16 + k * 9);
    ctx.stroke();
  }
  box(ctx, DOOR.x + 6, DOOR.y + 94, DOOR.w - 12, 8, 3, '#c9c4b4', 2);
  box(ctx, DOOR.x + 4, DOOR.y + DOOR.h - 26, DOOR.w - 8, 22, 1, '#b9b4a4', 1.5);
  box(ctx, DOOR.x + 12, DOOR.y - 28, DOOR.w - 24, 18, 3, '#1f7a3f', 2);
  label(ctx, 'EXIT', DOOR.x + DOOR.w / 2, DOOR.y - 19, 12, '#d9ffe4', 900);
  // Coats on hooks and an extinguisher by the door.
  ctx.fillStyle = '#5c4632';
  ctx.fillRect(712, 112, 54, 5);
  box(ctx, 716, 116, 22, 70, 8, '#7a4a52', 2);
  box(ctx, 742, 116, 20, 58, 8, '#4a5a7a', 2);
  box(ctx, 726, 210, 14, 30, 5, '#c8323a', 2);
  ctx.fillStyle = INK;
  ctx.fillRect(729, 205, 8, 6);
  // A sign about the chairs.
  box(ctx, 700, 62, 72, 28, 2, '#fbf6ea', 1.5);
  label(ctx, 'PLEASE FOLD', 736, 71, 7, INK, 800, 66);
  label(ctx, 'YOUR CHAIR', 736, 81, 7, INK, 800, 66);
  paintTableBase(ctx);
  paintLectern(ctx);
  paintCart(ctx);
  // The fixtures, lit, and the light they throw.
  for (const x of [176, 480, 784]) {
    ctx.fillStyle = '#e9e7dc';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.roundRect(x - 66, 6, 132, 22, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbfff4';
    ctx.fillRect(x - 60, 10, 120, 5);
    ctx.fillRect(x - 60, 19, 120, 5);
    ctx.fillStyle = 'rgba(250,255,230,0.09)';
    ctx.beginPath();
    ctx.moveTo(x - 66, 28);
    ctx.lineTo(x + 66, 28);
    ctx.lineTo(x + 170, 300);
    ctx.lineTo(x - 170, 300);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  if (typeof document !== 'undefined') {
    if (!backdrop) {
      backdrop = document.createElement('canvas');
      backdrop.width = 960;
      backdrop.height = 540;
      const c = backdrop.getContext('2d');
      if (c) paintBackdrop(c);
      else backdrop = null;
    }
    if (backdrop) {
      ctx.drawImage(backdrop, 0, 0);
      return;
    }
  }
  paintBackdrop(ctx);
}

/** The wall clock: its hands sweep with the scene clock. */
export function drawClock(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = '#f7f4ea';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.arc(208, 74, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const m = time * 0.6;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(208, 74);
  ctx.lineTo(208 + Math.sin(m) * 11, 74 - Math.cos(m) * 11);
  ctx.moveTo(208, 74);
  ctx.lineTo(208 + Math.sin(m / 12 + 3.6) * 7, 74 - Math.cos(m / 12 + 3.6) * 7);
  ctx.stroke();
}

/** A tube that is out: grey over the lit one baked into the backdrop (the right one, or all three at the crash). */
export function drawTubes(ctx: CanvasRenderingContext2D, b: Basement, crashT: number): void {
  if (!b.flickerOff) return;
  const all = stutter(crashT);
  ctx.fillStyle = '#9a9c94';
  for (const x of all ? [176, 480, 784] : [784]) {
    ctx.fillRect(x - 60, 10, 120, 5);
    ctx.fillRect(x - 60, 19, 120, 5);
  }
}

/** The dim when the right tube is out, over everything but the HUD. */
export function drawFlickerShade(ctx: CanvasRenderingContext2D, b: Basement, crashT: number): void {
  if (!b.flickerOff) return;
  const all = stutter(crashT);
  ctx.fillStyle = all ? 'rgba(10,16,12,0.22)' : 'rgba(10,16,12,0.12)';
  if (all) ctx.fillRect(0, 0, 960, 540);
  else {
    ctx.beginPath();
    ctx.moveTo(600, 0);
    ctx.lineTo(960, 0);
    ctx.lineTo(960, 540);
    ctx.lineTo(700, 540);
    ctx.closePath();
    ctx.fill();
  }
}

// ─── The cloth on two pins ───────────────────────────────────────────────────────────────────────────────
export const PIN1 = 2.1;
export const PIN2 = 2.7;
const LAND = PIN2 + 0.47;
let clothTexture: HTMLCanvasElement | null = null;

function clothArt(ctx: CanvasRenderingContext2D, w: number, h: number, back: boolean): void {
  ctx.fillStyle = back ? '#d8cdb2' : '#efe5cb';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = back ? 'rgba(120,40,40,0.32)' : '#8e2b2b';
  ctx.font = `800 15px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  if (back) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.fillText('WE ARE POWERLESS OVER THE CHART', w / 2, h / 2 + 1, w - 16);
    ctx.restore();
  } else ctx.fillText('WE ARE POWERLESS OVER THE CHART', w / 2, h / 2 + 1, w - 16);
  ctx.letterSpacing = '0px';
  ctx.strokeStyle = back ? 'rgba(0,0,0,0.12)' : 'rgba(140,60,40,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(3, 3, w - 6, h - 6);
}

/** The cloth's two faces, painted once. */
function texture(): HTMLCanvasElement | null {
  if (clothTexture || typeof document === 'undefined') return clothTexture;
  const w = CLOTH.x1 - CLOTH.x0;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = CLOTH.h * 2;
  const g = c.getContext('2d');
  if (!g) return null;
  clothArt(g, w, CLOTH.h, false);
  g.translate(0, CLOTH.h);
  clothArt(g, w, CLOTH.h, true);
  clothTexture = c;
  return c;
}

function pin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#d8323a';
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/**
 * The cloth: on two pins with a draught in it; at the crash the left pin goes and it swings from the right one,
 * the part past the table top heaping on the cookies; then the right pin goes and it all comes down, face-down.
 */
export function drawCloth(ctx: CanvasRenderingContext2D, time: number, crashT: number): void {
  const w = CLOTH.x1 - CLOTH.x0;
  const h = CLOTH.h;
  const tex = texture();
  const t = crashT;
  if (t < PIN1) {
    // Pinned: the bottom edge breathes in the draught from the vent.
    const slices = 8;
    for (let i = 0; i < slices; i += 1) {
      const x = (i * w) / slices;
      const sag = Math.sin((i / slices) * Math.PI) * 2;
      const sway = gust(time * 2.2, i * 0.3) * 1.6;
      ctx.save();
      ctx.translate(CLOTH.x0 + x, CLOTH.y);
      ctx.transform(1, 0, sway / h, 1 + sag / h, 0, 0);
      if (tex) ctx.drawImage(tex, x, 0, w / slices + 0.6, h, 0, 0, w / slices + 0.6, h);
      else {
        ctx.fillStyle = '#efe5cb';
        ctx.fillRect(0, 0, w / slices + 0.6, h);
      }
      ctx.restore();
    }
    ink(ctx, 2);
    ctx.strokeRect(CLOTH.x0, CLOTH.y, w, h + 1);
    pin(ctx, CLOTH.x0 + 4, CLOTH.y + 3);
    pin(ctx, CLOTH.x1 - 4, CLOTH.y + 3);
    return;
  }
  if (t < LAND) {
    // Swinging from the right pin, then dropping: the part below the table top heaps on it.
    const u = t - PIN1;
    const theta = 1.28 * (1 - Math.exp(-2.6 * u) * (Math.cos(6 * u) + 0.43 * Math.sin(6 * u)));
    const drop = t > PIN2 ? 0.5 * 900 * (t - PIN2) ** 2 : 0;
    const px = CLOTH.x1 - 4;
    const py = CLOTH.y + 3 + drop;
    const sin = Math.max(0.02, Math.sin(theta));
    const reach = clamp((TABLE.top - py) / sin, 0, w);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 960, TABLE.top + 2);
    ctx.clip();
    ctx.translate(px, py);
    ctx.rotate(-theta);
    ctx.translate(-w, 0);
    if (tex) ctx.drawImage(tex, 0, 0, w, h, 0, 0, w, h);
    ink(ctx, 2);
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();
    if (t < PIN2) pin(ctx, px, py);
    // The heap on the table where it meets the top.
    const heap = clamp((w - reach) / w, 0, 1);
    if (heap > 0.02) {
      const hx = px - reach * Math.cos(theta) - 10;
      ctx.fillStyle = '#e6dcc0';
      ink(ctx, 2);
      ctx.beginPath();
      ctx.moveTo(hx - 50 * heap - 10, TABLE.top + 4);
      ctx.quadraticCurveTo(hx - 30 * heap, TABLE.top - 18 * heap - 4, hx, TABLE.top - 10 * heap - 2);
      ctx.quadraticCurveTo(hx + 30 * heap, TABLE.top - 20 * heap - 4, hx + 50 * heap + 10, TABLE.top + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  drawClothDown(ctx, smoothstep(LAND, LAND + 0.25, t));
}

/** Face-down on the cookie table: the back of the cloth, the words showing through backwards, over the edge. */
function drawClothDown(ctx: CanvasRenderingContext2D, k: number): void {
  const tex = texture();
  const w = CLOTH.x1 - CLOTH.x0;
  const x0 = TABLE.x0 - 4;
  // Over the top, lumpy with the cookies under it.
  ctx.fillStyle = '#d8cdb2';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x0, TABLE.front + 1);
  for (let i = 0; i <= 10; i += 1) ctx.lineTo(x0 + (i * (w + 8)) / 10, TABLE.top - 3 - (i % 3 === 1 ? 4 : 1) * k);
  ctx.lineTo(x0 + w + 8, TABLE.front + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The flap down the front, the words mirrored.
  const fh = CLOTH.h * mix(0.4, 1, k);
  ctx.save();
  ctx.translate(x0 + 4, TABLE.front);
  if (tex) ctx.drawImage(tex, 0, CLOTH.h, w, CLOTH.h, 0, 0, w, fh);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, fh);
  for (let i = 0; i <= 8; i += 1) ctx.lineTo((i * w) / 8, fh + (i % 2) * 3);
  ctx.lineTo(w, 0);
  ctx.stroke();
  ctx.restore();
}

// ─── The cookie table ────────────────────────────────────────────────────────────────────────────────────
/** The folding table: legs, a plastic cloth, cups and napkins (baked into the backdrop). */
function paintTableBase(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#6e6a5e';
  ctx.lineWidth = 3;
  for (const x of [TABLE.x0 + 14, TABLE.x1 - 14]) {
    ctx.beginPath();
    ctx.moveTo(x, TABLE.skirt);
    ctx.lineTo(x, FLOOR_Y + 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#f4f1e8';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(TABLE.x0 + 6, TABLE.top);
  ctx.lineTo(TABLE.x1 - 6, TABLE.top);
  ctx.lineTo(TABLE.x1, TABLE.front);
  ctx.lineTo(TABLE.x1, TABLE.skirt);
  for (let i = 10; i >= 0; i -= 1) ctx.lineTo(TABLE.x0 + ((TABLE.x1 - TABLE.x0) * i) / 10, TABLE.skirt + (i % 2) * 3);
  ctx.lineTo(TABLE.x0, TABLE.front);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,60,60,0.35)';
  ctx.lineWidth = 2;
  for (let x = TABLE.x0 + 10; x < TABLE.x1; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, TABLE.front + 2);
    ctx.lineTo(x, TABLE.skirt);
    ctx.stroke();
  }
  box(ctx, 330, 196, 14, 30, 2, '#f6f2e8', 1.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 6; k += 1) {
    ctx.beginPath();
    ctx.moveTo(331, 200 + k * 4);
    ctx.lineTo(343, 200 + k * 4);
    ctx.stroke();
  }
  box(ctx, 360, 218, 34, 10, 2, '#fff5c2', 1.5);
  box(ctx, 532, 220, 34, 8, 4, '#f4f1ea', 1.5);
}

/** The clamshell of supermarket cookies on the table, emptying as the room helps itself; gone under the cloth. */
export function drawCookieTable(ctx: CanvasRenderingContext2D, cookies: number, crashT: number): void {
  if (crashT >= LAND + 0.1) return;
  box(ctx, 430, 214, 80, 16, 3, 'rgba(230,240,245,0.75)', 1.6);
  ctx.fillStyle = '#d9a35a';
  ink(ctx, 1.2);
  ctx.beginPath();
  for (let i = 0; i < cookies; i += 1) {
    const x = 438 + (i % 7) * 10.5;
    const y = 222 - Math.floor(i / 7) * 5;
    ctx.moveTo(x + 5, y);
    ctx.ellipse(x, y, 5, 3.2, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
}

// ─── The podium and the big book of grievances ───────────────────────────────────────────────────────────
/** The lectern under the book (baked into the backdrop). */
function paintLectern(ctx: CanvasRenderingContext2D): void {
  const { x, y } = PODIUM;
  // A column on a base, a slanted top.
  box(ctx, x - 34, y - 10, 68, 12, 3, '#6b4528', 2.2);
  ctx.fillStyle = '#86593a';
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(x - 24, y - 10);
  ctx.lineTo(x - 28, y - 96);
  ctx.lineTo(x + 28, y - 96);
  ctx.lineTo(x + 24, y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 16, y - 82, 32, 56);
  label(ctx, 'DA', x, y - 54, 12, '#f2d9a8', 900);
  ctx.fillStyle = '#9a6a45';
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 96);
  ctx.lineTo(x + 40, y - 96);
  ctx.lineTo(x + 34, y - 112);
  ctx.lineTo(x - 34, y - 112);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** The lectern with the big book open on it: each of the room's top pumps is a line in it; the book thickens. */
export function drawPodium(ctx: CanvasRenderingContext2D, b: Basement, time: number): void {
  const { x, y } = PODIUM;
  // Loose pages on the floor once the book overflows.
  const loose = clamp(b.entries - 14, 0, 12);
  for (let i = 0; i < loose; i += 1) {
    const r = mulberry32(i * 911 + 7);
    ctx.save();
    ctx.translate(x - 40 + r() * 110, y - 4 + r() * 22);
    ctx.rotate((r() - 0.5) * 1.2);
    ctx.fillStyle = '#f4efe0';
    ink(ctx, 1.2);
    ctx.fillRect(-9, -6, 18, 12);
    ctx.strokeRect(-9, -6, 18, 12);
    ctx.restore();
  }
  // The book: the page block thickens with every entry.
  const thick = clamp(3 + b.entries * 0.7, 3, 16);
  const top = y - 112 - thick;
  ctx.fillStyle = '#5a1e22';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(x - 38, top, 76, thick + 4, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(x - 35, top + 1, 70, thick);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.7;
  for (let k = 1; k < thick; k += 2) {
    ctx.beginPath();
    ctx.moveTo(x - 35, top + k);
    ctx.lineTo(x + 35, top + k);
    ctx.stroke();
  }
  // The open pages, lines of grievance in a cramped hand; the newest line wet.
  const pageY = top - 22;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fbf6e6';
    ink(ctx, 1.8);
    ctx.beginPath();
    ctx.moveTo(x, pageY + 24);
    ctx.quadraticCurveTo(x + s * 18, pageY + 18, x + s * 38, pageY + 22);
    ctx.lineTo(x + s * 38, pageY - 2);
    ctx.quadraticCurveTo(x + s * 18, pageY - 6, x, pageY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  label(ctx, 'TOP PUMPS', x - 19, pageY + 3, 4.4, '#8e2b2b', 900, 30);
  const onPage = b.entries % 8;
  const rows = b.entries === 0 ? 0 : onPage === 0 ? 8 : onPage;
  ctx.strokeStyle = 'rgba(40,40,70,0.7)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 8; k += 1) {
    const left = k < 3;
    const filled = left ? b.entries > 0 : k - 3 < rows - 3 || (b.entries >= 8 && k < 8);
    if (!filled) continue;
    const lx = left ? x - 33 : x + 5;
    const ly = left ? pageY + 9 + k * 4 : pageY + 3 + (k - 3) * 4;
    const len = 18 + noise(k * 3 + b.entries) * 10;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    for (let q = 1; q <= 6; q += 1) ctx.lineTo(lx + (q * len) / 6, ly + (q % 2 ? -1 : 0.6));
    ctx.stroke();
  }
  // A page turning over to the left when a new pump is written in.
  const turn = clamp(b.turn.x, 0, 1);
  if (turn < 0.98) {
    const a = Math.PI * turn;
    ctx.fillStyle = '#f4ecd6';
    ink(ctx, 1.6);
    ctx.beginPath();
    ctx.moveTo(x, pageY);
    ctx.lineTo(x + Math.cos(a) * 38, pageY - Math.sin(a) * 14 - 2);
    ctx.lineTo(x + Math.cos(a) * 38, pageY - Math.sin(a) * 14 + 22);
    ctx.lineTo(x, pageY + 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // The ribbon.
  ctx.strokeStyle = '#c8323a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 2, pageY + 22);
  ctx.quadraticCurveTo(x + 4 + Math.sin(time * 1.3) * 2, pageY + 34, x + 1, pageY + 44 + thick);
  ctx.stroke();
}

// ─── The corner TV ───────────────────────────────────────────────────────────────────────────────────────
export interface TvView {
  time: number;
  tension: number;
  depth: number;
  multiplier: number;
  elapsed: number;
  running: boolean;
  crashed: boolean;
  crashT: number;
  flash: number;
}

/** The AV cart in the corner (baked into the backdrop). */
function paintCart(ctx: CanvasRenderingContext2D): void {
  // The cart on the floor, the TV on its top shelf.
  ctx.save();
  ctx.translate(TV.x, 300);
  ctx.strokeStyle = '#3a3a42';
  ctx.lineWidth = 4;
  for (const dx of [-54, 54]) {
    ctx.beginPath();
    ctx.moveTo(dx, -96);
    ctx.lineTo(dx, -4);
    ctx.stroke();
  }
  box(ctx, -62, -52, 124, 8, 2, '#4a4a54', 2);
  box(ctx, -62, -12, 124, 8, 2, '#4a4a54', 2);
  box(ctx, -40, -46, 50, 30, 3, '#2a2a33', 1.6);
  for (const dx of [-54, 54]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(dx, -2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** How prominent the TV is: the scale it is drawn at, from the tension and, slowly, the depth of the round. */
export const tvProminence = (tension: number, depth: number): number => clamp(smoothstep(0.05, 0.92, tension) * 0.75 + 0.35 * depth, 0, 1);

/** The chart on the corner TV that nobody talks about; it grows, glows, and goes red at the crash. */
export function drawTV(ctx: CanvasRenderingContext2D, v: TvView): void {
  const p = tvProminence(v.tension, v.depth);
  const red = v.crashed ? smoothstep(0.3, 0.45, v.crashT) : 0;
  const k = 1 + 0.42 * p;
  // The glow it throws into the room, stronger with the tension.
  const glowA = 0.08 + 0.3 * p + 0.25 * red;
  ctx.fillStyle = red > 0.5 ? `rgba(255,60,60,${glowA})` : `rgba(120,255,170,${glowA * 0.7})`;
  ctx.beginPath();
  ctx.ellipse(TV.x - 10, TV.y + 4, 100 * k, 76 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(TV.x, TV.y + 46);
  ctx.scale(k, k);
  ctx.translate(0, -46);
  // A chunky set with a curved screen.
  box(ctx, -TV.w / 2 - 6, -TV.h / 2 - 6, TV.w + 12, TV.h + 12, 9, '#2e2d36', 2.6);
  box(ctx, -TV.w / 2 + 2, TV.h / 2 + 6, TV.w - 4, 8, 2, '#24232b', 2);
  const sx = -TV.w / 2 + 6;
  const sy = -TV.h / 2;
  const sw = TV.w - 30;
  const sh = TV.h - 4;
  ctx.fillStyle = red > 0.5 ? '#3a0a10' : '#06140e';
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, 10);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Grid, the chart from 1× to now, the readout.
  ctx.strokeStyle = red > 0.5 ? 'rgba(255,120,120,0.18)' : 'rgba(100,255,160,0.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(sx, sy + (i * sh) / 6);
    ctx.lineTo(sx + sw, sy + (i * sh) / 6);
    ctx.stroke();
  }
  const m = Math.max(1, v.multiplier);
  const lnm = Math.log(m);
  ctx.strokeStyle = red > 0.5 ? '#ff4d5e' : '#4dff8a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  const n = 26;
  for (let i = 0; i <= n; i += 1) {
    const u = i / n;
    const val = m > 1.0001 ? (Math.exp(u * lnm) - 1) / (m - 1) : u * 0.05;
    const wob = Math.sin(u * 23 + v.elapsed * 0.002) * 0.03 * (1 - u * 0.5);
    let y = sy + sh - 10 - (val + wob) * (sh - 30);
    if (red > 0 && i === n) y = mix(y, sy + sh + 10, red);
    const x = sx + 6 + u * (sw - 16);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.font = `900 16px ${MEME_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = red > 0.5 ? '#ffb3bb' : '#b8ffd0';
  const shown = m < 1000 ? m.toFixed(2) : m < 1e6 ? `${(m / 1000).toFixed(1)}K` : `${(m / 1e6).toFixed(2)}M`;
  ctx.fillText(red > 0.5 ? '↓↓↓ RED' : `DGN ${shown}×`, sx + 6, sy + 5, sw - 12);
  if (!v.crashed && v.flash < 2.6 && v.running) {
    // The TV disagrees with Big Ron.
    ctx.fillStyle = `rgba(77,255,138,${0.85 - v.flash * 0.3})`;
    ctx.font = `900 22px ${MEME_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HIGHER ↑', sx + sw / 2, sy + sh / 2 + 6);
  }
  // Scanlines and the glass.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  for (let y = sy + ((v.time * 30) % 4); y < sy + sh; y += 4) ctx.rect(sx, y, sw, 1.4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.ellipse(sx + sw * 0.3, sy + sh * 0.25, sw * 0.35, sh * 0.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, 10);
  ctx.stroke();
  // Knobs and a power light.
  for (const dy of [-26, -6]) {
    ctx.fillStyle = '#8a8a94';
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.arc(TV.w / 2 - 12, dy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = red > 0.5 ? '#ff3b3b' : '#6dff8a';
  ctx.beginPath();
  ctx.arc(TV.w / 2 - 12, 26, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── The coffee urn ──────────────────────────────────────────────────────────────────────────────────────
const URN_TIP = 0.55;
/** The urn, its table, the cups; steam in puffs, the drip into the cup. At the crash it tips and pours. */
export function drawUrn(ctx: CanvasRenderingContext2D, b: Basement, v: { time: number; tension: number; crashed: boolean; crashT: number; on: boolean }): void {
  // The little folding table.
  ctx.strokeStyle = '#6e6a5e';
  ctx.lineWidth = 3;
  for (const x of [URN_TABLE.x0 + 10, URN_TABLE.x1 - 10]) {
    ctx.beginPath();
    ctx.moveTo(x, URN_TABLE.front);
    ctx.lineTo(x + (x < 60 ? -6 : 6), 548);
    ctx.stroke();
  }
  box(ctx, URN_TABLE.x0, URN_TABLE.top, URN_TABLE.x1 - URN_TABLE.x0, URN_TABLE.front - URN_TABLE.top, 2, '#d8d1bf', 2.2);
  box(ctx, URN_TABLE.x0, URN_TABLE.front, URN_TABLE.x1 - URN_TABLE.x0, 6, 1, '#b9b09c', 2);
  // Cups and the sugar.
  box(ctx, 108, 448, 14, 30, 2, '#f6f2e8', 1.5);
  box(ctx, 18, 462, 16, 16, 3, '#e9e2d0', 1.5);
  const tip = v.crashed ? smoothstep(URN_TIP, URN_TIP + 0.3, v.crashT) : 0;
  const rock = v.crashed ? Math.sin(v.crashT * 30) * smoothstep(0.3, 0.4, v.crashT) * (1 - tip) * 0.06 : 0;
  ctx.save();
  ctx.translate(URN.x + 26, URN.base);
  ctx.rotate(tip * 1.42 + rock);
  ctx.translate(-26, 0);
  // Base, body, lid, handles, the gauge, the spigot and the ON light.
  box(ctx, -24, -14, 48, 14, 3, '#5a5a62', 2);
  ctx.fillStyle = '#c9ccd2';
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.roundRect(-22, -82, 44, 70, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-14, -78, 6, 60);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(10, -78, 8, 60);
  box(ctx, -18, -92, 36, 11, 5, '#7a7d86', 2);
  box(ctx, -5, -98, 10, 7, 3, INK, 1);
  for (const s of [-1, 1]) {
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(s * 22, -66);
    ctx.quadraticCurveTo(s * 31, -60, s * 22, -52);
    ctx.stroke();
  }
  box(ctx, -3, -72, 6, 34, 3, 'rgba(110,70,40,0.75)', 1.4);
  box(ctx, -6, -30, 12, 8, 2, INK, 1.4);
  ctx.fillStyle = v.on ? '#ff4040' : '#5a2a2a';
  ctx.beginPath();
  ctx.arc(12, -24, 2.6, 0, Math.PI * 2);
  ctx.fill();
  if (v.on) {
    ctx.fillStyle = 'rgba(255,60,60,0.25)';
    ctx.beginPath();
    ctx.arc(12, -24, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (!v.crashed || v.crashT < URN_TIP) {
    // The cup under the spigot, and the drip falling into it.
    box(ctx, URN.x - 6, URN.base - 14, 12, 14, 2, '#f6f2e8', 1.4);
    const f = b.drip - Math.floor(b.drip);
    if (v.on) {
      ctx.fillStyle = '#6b4226';
      ctx.beginPath();
      ctx.ellipse(URN.x, URN.base - 22 + f * 9, 1.6, 2.2 + f, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // The steam: round puffs rising in a rhythm, like a signal.
    for (let j = 0; j < 6; j += 1) {
      const a = (b.steam - Math.floor(b.steam)) + j;
      const x = URN.x + Math.sin(a * 1.3 + Math.floor(b.steam - j)) * 5;
      const y = URN.base - 104 - a * 20;
      const r = 5 + a * 3.2;
      const alpha = (1 - a / 6) * 0.45 * (v.on ? 1 : 0.3);
      ctx.fillStyle = `rgba(250,252,248,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── The pour and the puddle ─────────────────────────────────────────────────────────────────────────────
const POUR_FROM = { x: 194, y: 446 } as const;
const POOL = { x: 206, y: 524 } as const;
export const WET_AT = 2.0;
/** The puddle's path from the pour to Jules's shoe, as a point at `u` in [0, 1]. */
function puddlePath(to: Joint, u: number): Joint {
  const cx = 470;
  const cy = 450;
  const a = 1 - u;
  return { x: a * a * POOL.x + 2 * a * u * cx + u * u * to.x, y: a * a * POOL.y + 2 * a * u * cy + u * u * to.y };
}

/** The pour (in the air, drawn over the table) and the puddle (on the floor) that runs to Jules's shoe. */
export function drawPuddle(ctx: CanvasRenderingContext2D, crashT: number, shoe: Joint, seed: number): void {
  const t = crashT;
  if (t < URN_TIP + 0.3) return;
  const grow = smoothstep(URN_TIP + 0.3, WET_AT, t);
  const r = mulberry32(seed);
  ctx.fillStyle = '#6b4226';
  ink(ctx, 2);
  // The pool under the pour.
  const pr = 18 + 26 * smoothstep(URN_TIP + 0.3, 2.2, t);
  ctx.beginPath();
  ctx.ellipse(POOL.x, POOL.y, pr, pr * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The run to the shoe, blob by blob.
  const n = 16;
  for (let i = 1; i <= n; i += 1) {
    const u = i / n;
    if (u > grow) break;
    const p = puddlePath(shoe, u);
    const w = (10 + r() * 8) * (0.7 + 0.5 * (1 - u));
    ctx.beginPath();
    ctx.ellipse(p.x + (r() - 0.5) * 6, p.y, w, w * 0.34, (r() - 0.5) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // A sheen on top.
  ctx.fillStyle = 'rgba(255,230,190,0.25)';
  ctx.beginPath();
  ctx.ellipse(POOL.x - pr * 0.3, POOL.y - 2, pr * 0.4, pr * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  if (t >= WET_AT) {
    // It reaches him: a splash ring round the shoe.
    const age = t - WET_AT;
    ctx.strokeStyle = `rgba(255,240,220,${clamp(1 - age / 1.2, 0, 1)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(shoe.x, shoe.y, 10 + age * 20, 3 + age * 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** The pour from the urn's mouth to the floor. */
export function drawPour(ctx: CanvasRenderingContext2D, crashT: number): void {
  const t = crashT;
  if (t < URN_TIP + 0.25 || t > 3) return;
  const k = smoothstep(URN_TIP + 0.25, URN_TIP + 0.45, t) * (1 - smoothstep(2.4, 3, t));
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9 * k + 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(POUR_FROM.x, POUR_FROM.y);
  ctx.quadraticCurveTo(POUR_FROM.x + 10, POUR_FROM.y + 20, POOL.x + 2, POOL.y - 4);
  ctx.stroke();
  ctx.strokeStyle = '#7a4a2a';
  ctx.lineWidth = 9 * k;
  ctx.stroke();
}

// ─── The cookie rain ─────────────────────────────────────────────────────────────────────────────────────
const RAIN = 34;
/** Terry's cup, upended over the pile, raining supermarket cookies over the circle; each comes to rest. */
export function drawCookieRain(ctx: CanvasRenderingContext2D, crashT: number, from: Joint, seed: number, start: number): void {
  if (crashT < start) return;
  const r = mulberry32(seed * 31 + 5);
  const g = 900;
  const at: { x: number; y: number; r: number; flat: number; spin: number }[] = [];
  for (let i = 0; i < RAIN; i += 1) {
    const t0 = start + i * 0.015;
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
    const speed = 220 + r() * 260;
    const land = 300 + r() * 200;
    const lx = r();
    const size = 4 + r() * 2.5;
    const spin = (r() - 0.5) * 12;
    const u = crashT - t0;
    if (u < 0) continue;
    const vx = Math.cos(a) * speed * (0.6 + lx);
    const vy = Math.sin(a) * speed;
    // Solve the landing time on its floor line, then rest there.
    const disc = vy * vy + 2 * g * (land - from.y);
    const tl = disc > 0 ? (-vy + Math.sqrt(disc)) / g : 1.5;
    const tt = Math.min(u, tl);
    at.push({ x: clamp(from.x + vx * tt, 10, 950), y: from.y + vy * tt + 0.5 * g * tt * tt, r: size, flat: u >= tl ? 0.55 : 1, spin: spin * tt });
  }
  // All the cookies in one path, then all their chips.
  ctx.fillStyle = '#d9a35a';
  ink(ctx, 1.3);
  ctx.beginPath();
  for (const c of at) {
    ctx.moveTo(c.x + c.r, c.y);
    ctx.ellipse(c.x, c.y, c.r, c.r * c.flat, c.spin, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4a2a18';
  ctx.beginPath();
  for (const c of at) {
    ctx.rect(c.x - c.r * 0.4, c.y - c.r * 0.3 * c.flat, c.r * 0.32, c.r * 0.3 * c.flat);
    ctx.rect(c.x + c.r * 0.15, c.y + c.r * 0.1 * c.flat, c.r * 0.32, c.r * 0.3 * c.flat);
  }
  ctx.fill();
}
