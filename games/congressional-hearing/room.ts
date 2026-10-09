/**
 * The committee room: the walnut walls, the navy backdrop with the invented seal (a ledger with wings) and two
 * plain blue flags, the window cutaway with Senator Vance's two boats at the left frame edge, the curved dais with
 * its name plates and unassigned letters, the minutes board where the stenographer's pages stack (the round's
 * scoreboard), the clerk's desk with the bouquet of bail applications, and the witness table with its phone and
 * microphone. The static parts are painted once into offscreen layers. Drawing only: nothing here reads or
 * changes the round's outcome.
 */
import { blob, BOARD, box, CARD, CLERK, CRASH, DAIS, daisFoot, daisTop, ink, INK, label, LABEL_FONT, PAGE_H, PAGE_W, PHONE, poly, SEAT_X, seatScale, TABLE, TYPEWRITER, WALL_FOOT, WINDOW } from './ink';
import { clamp, mix, mulberry32, smoothstep } from './motion';

export const WOOD = { deep: '#341f15', wall: '#58341f', panel: '#653c23', bevel: '#7c4c2c', shade: '#3f2516', trim: '#c4954f', dais: '#5a321c', top: '#a26b3b' } as const;
export const NAVY = '#1c2742';
const CARPET = '#212d47';
const FLAG = '#2f6fd0';
const PAPER = '#f6f1e3';
const RED = '#e0263e';

// ─── Offscreen layers ───────────────────────────────────────────────────────────────────────────────────

type Paint = (ctx: CanvasRenderingContext2D) => void;
interface Layer { canvas: HTMLCanvasElement | null; scale: number; paint: Paint }
const layer = (paint: Paint): Layer => ({ canvas: null, scale: 0, paint });

/** Paints `l` once at the canvas's resolution and blits it after; without a DOM it paints directly. */
function blit(ctx: CanvasRenderingContext2D, l: Layer): void {
  if (typeof document === 'undefined' || !ctx.canvas || !ctx.canvas.width) {
    l.paint(ctx);
    return;
  }
  const k = clamp(Math.round((ctx.canvas.width / 960) * 4) / 4, 0.5, 2);
  if (!l.canvas || l.scale !== k) {
    const c = l.canvas ?? document.createElement('canvas');
    c.width = Math.round(960 * k);
    c.height = Math.round(540 * k);
    const g = c.getContext('2d');
    if (!g) {
      l.paint(ctx);
      return;
    }
    g.setTransform(k, 0, 0, k, 0, 0);
    l.paint(g);
    l.canvas = c;
    l.scale = k;
  }
  ctx.drawImage(l.canvas, 0, 0, 960, 540);
}

const sprites = new Map<string, { canvas: HTMLCanvasElement; k: number }>();
/**
 * Draws a part that never changes as a cached image: `paint` draws it once into a `w` × `h` box (scene units)
 * at the canvas's resolution; after that it is one drawImage at (x, y).
 */
export function drawSprite(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, paint: Paint): void {
  if (typeof document === 'undefined' || !ctx.canvas || !ctx.canvas.width) {
    ctx.save();
    ctx.translate(x, y);
    paint(ctx);
    ctx.restore();
    return;
  }
  const k = clamp(Math.round((ctx.canvas.width / 960) * 4) / 4, 0.5, 2);
  let sp = sprites.get(key);
  if (!sp || sp.k !== k) {
    const c = sp?.canvas ?? document.createElement('canvas');
    c.width = Math.ceil(w * k);
    c.height = Math.ceil(h * k);
    const g = c.getContext('2d');
    if (!g) {
      ctx.save();
      ctx.translate(x, y);
      paint(ctx);
      ctx.restore();
      return;
    }
    g.setTransform(k, 0, 0, k, 0, 0);
    paint(g);
    sp = { canvas: c, k };
    sprites.set(key, sp);
  }
  ctx.drawImage(sp.canvas, x, y, sp.canvas.width / k, sp.canvas.height / k);
}

// ─── The walls, the seal, the flags, the floor ──────────────────────────────────────────────────────────

function raisedPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = WOOD.shade;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = WOOD.bevel;
  ctx.fillRect(x, y, w - 4, h - 4);
  ctx.fillStyle = WOOD.panel;
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
  ctx.strokeStyle = 'rgba(28, 16, 10, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // A little grain.
  ctx.strokeStyle = 'rgba(40, 22, 12, 0.18)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const gx = x + (w * i) / 4 + Math.sin(x + i) * 3;
    ctx.beginPath();
    ctx.moveTo(gx, y + 8);
    ctx.quadraticCurveTo(gx + 4, y + h / 2, gx - 2, y + h - 8);
    ctx.stroke();
  }
}

/** The committee's invented seal: a ledger with wings on a navy field, ringed in gold. */
export function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#c99a45';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e6c06a';
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#18233d';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The rim lettering, one glyph at a time around the ring.
  const words = '· THE COMMITTEE · ON THE RECORD ';
  ctx.fillStyle = '#3a2410';
  ctx.font = `800 ${Math.round(r * 0.19)}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < words.length; i += 1) {
    const a = -Math.PI / 2 + (i / words.length) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(words[i]!, 0, -r * 0.85);
    ctx.restore();
  }
  // The wings behind the ledger: three feathers a side.
  for (const side of [-1, 1]) {
    for (let f = 0; f < 3; f += 1) {
      ctx.fillStyle = f === 0 ? '#f4ecd8' : f === 1 ? '#e3d6b4' : '#cdbb8e';
      ink(ctx, 1.4);
      ctx.beginPath();
      ctx.moveTo(side * r * 0.12, -r * 0.08 + f * r * 0.1);
      ctx.quadraticCurveTo(side * r * (0.42 + f * 0.04), -r * (0.5 - f * 0.12), side * r * (0.6 - f * 0.05), -r * (0.32 - f * 0.18));
      ctx.quadraticCurveTo(side * r * 0.4, -r * (0.08 - f * 0.12), side * r * 0.12, r * 0.06 + f * r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // The open ledger.
  for (const side of [-1, 1]) {
    poly(ctx, [0, -r * 0.16, side * r * 0.34, -r * 0.24, side * r * 0.34, r * 0.22, 0, r * 0.3], PAPER, 1.6);
    ctx.strokeStyle = '#8d8574';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.06, -r * 0.08 + i * r * 0.1);
      ctx.lineTo(side * r * 0.28, -r * 0.14 + i * r * 0.1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A plain blue flag on a pole, hanging in folds, with a gold fringe and finial. */
function drawFlag(ctx: CanvasRenderingContext2D, pole: number, side: number): void {
  const top = 116;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(pole, top);
  ctx.lineTo(pole, 330);
  ctx.stroke();
  ctx.strokeStyle = '#c99a45';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#e6c06a';
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(pole, top - 14);
  ctx.lineTo(pole + 5, top - 4);
  ctx.lineTo(pole, top + 2);
  ctx.lineTo(pole - 5, top - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const w = 46 * side;
  const field = new Path2D();
  field.moveTo(pole, top + 4);
  field.quadraticCurveTo(pole + w * 0.5, top + 10, pole + w, top + 6);
  field.quadraticCurveTo(pole + w * 0.82, top + 70, pole + w * 0.9, top + 128);
  field.quadraticCurveTo(pole + w * 0.5, top + 136, pole + w * 0.2, top + 124);
  field.quadraticCurveTo(pole, top + 70, pole, top + 4);
  ctx.fillStyle = FLAG;
  ctx.fill(field);
  ctx.save();
  ctx.clip(field);
  ctx.fillStyle = 'rgba(16, 40, 96, 0.35)';
  for (const k of [0.3, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(pole + w * k, top + 8);
    ctx.quadraticCurveTo(pole + w * (k + 0.1), top + 70, pole + w * (k + 0.04), top + 132);
    ctx.lineTo(pole + w * (k + 0.16), top + 132);
    ctx.quadraticCurveTo(pole + w * (k + 0.2), top + 70, pole + w * (k + 0.12), top + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(Math.min(pole, pole + w), top, Math.abs(w) * 0.18, 140);
  ctx.restore();
  ink(ctx, 2.2);
  ctx.stroke(field);
  ctx.strokeStyle = '#e6c06a';
  ctx.lineWidth = 3;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(pole + w * 0.9, top + 131);
  ctx.quadraticCurveTo(pole + w * 0.5, top + 139, pole + w * 0.2, top + 127);
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintBackdrop(ctx: CanvasRenderingContext2D): void {
  // The upper wall and its frieze.
  ctx.fillStyle = WOOD.deep;
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(0, 0, 960, 86);
  ctx.fillStyle = '#4a2c1a';
  for (let x = 6; x < 960; x += 24) ctx.fillRect(x, 70, 12, 10);
  ctx.fillStyle = WOOD.trim;
  ctx.fillRect(0, 86, 960, 6);
  ctx.fillStyle = '#7a5a30';
  ctx.fillRect(0, 92, 960, 4);
  // The panelled wall.
  ctx.fillStyle = WOOD.wall;
  ctx.fillRect(0, 96, 960, WALL_FOOT - 96);
  for (let x = 0; x < 960; x += 120) {
    raisedPanel(ctx, x + 14, 110, 92, 176);
    raisedPanel(ctx, x + 14, 304, 92, 98);
  }
  ctx.fillStyle = WOOD.trim;
  ctx.fillRect(0, 290, 960, 6);
  ctx.fillStyle = WOOD.shade;
  ctx.fillRect(0, 296, 960, 3);
  for (let x = 0; x <= 960; x += 120) {
    ctx.fillStyle = WOOD.shade;
    ctx.fillRect(x - 5, 96, 10, WALL_FOOT - 96);
    ctx.fillStyle = 'rgba(255, 220, 160, 0.12)';
    ctx.fillRect(x - 5, 96, 3, WALL_FOOT - 96);
  }
  // The navy backdrop behind the dais, framed in gold, with the seal.
  ctx.fillStyle = WOOD.trim;
  ctx.fillRect(282, 98, 396, 236);
  ctx.fillStyle = NAVY;
  ctx.fillRect(290, 106, 380, 228);
  const sheen = ctx.createLinearGradient(290, 0, 670, 0);
  sheen.addColorStop(0, 'rgba(0,0,0,0.25)');
  sheen.addColorStop(0.5, 'rgba(120,150,220,0.12)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = sheen;
  ctx.fillRect(290, 106, 380, 228);
  ctx.strokeStyle = 'rgba(200, 170, 100, 0.25)';
  ctx.lineWidth = 1;
  for (let x = 310; x < 670; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 106);
    ctx.lineTo(x, 334);
    ctx.stroke();
  }
  drawSeal(ctx, 480, 152, 44);
  drawFlag(ctx, 436, -1);
  drawFlag(ctx, 524, 1);

  // The window cutaway at the left frame edge: an evening marina; the boats are drawn live.
  const { x, y, w, h } = WINDOW;
  ctx.fillStyle = '#6b4026';
  ctx.fillRect(x, y - 8, w + 10, h + 22);
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#f39a6a');
  sky.addColorStop(0.45, '#ffd29a');
  sky.addColorStop(0.62, '#ffe8bf');
  sky.addColorStop(0.63, '#3f86b6');
  sky.addColorStop(1, '#2a5f8c');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffefc8';
  ctx.beginPath();
  ctx.arc(x + 92, y + 62, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c47d64';
  ctx.beginPath();
  ctx.moveTo(x, y + 86);
  ctx.quadraticCurveTo(x + 30, y + 70, x + 64, y + 86);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    const sy = y + 96 + i * 7;
    ctx.moveTo(x + 10 + ((i * 37) % 70), sy);
    ctx.lineTo(x + 26 + ((i * 37) % 70), sy);
    ctx.stroke();
  }
  // The sill.
  box(ctx, x - 4, y + h + 4, w + 16, 10, 2, '#8a5a33', 2.5);

  // The minutes board on the right wall: cork in a frame, with a brass plaque under it.
  box(ctx, BOARD.x, BOARD.top - 6, BOARD.w, BOARD.bottom - BOARD.top + 12, 3, '#6b4026', 3);
  ctx.fillStyle = '#b48b5c';
  ctx.fillRect(BOARD.x + 6, BOARD.top, BOARD.w - 12, BOARD.bottom - BOARD.top);
  ctx.fillStyle = 'rgba(80, 50, 20, 0.25)';
  const rand = mulberry32(0xc0c);
  for (let i = 0; i < 140; i += 1) ctx.fillRect(BOARD.x + 7 + rand() * (BOARD.w - 14), BOARD.top + rand() * (BOARD.bottom - BOARD.top), 2, 2);
  box(ctx, BOARD.x + 8, BOARD.bottom + 8, BOARD.w - 16, 18, 3, '#d8b25a', 2);
  label(ctx, 'THE MINUTES', BOARD.x + BOARD.w / 2, BOARD.bottom + 17, 9, '#3a2410', 900, BOARD.w - 22);

  // The carpet: navy with a gold lozenge pattern in perspective, lit in the middle.
  ctx.fillStyle = CARPET;
  ctx.fillRect(0, WALL_FOOT, 960, 540 - WALL_FOOT);
  ctx.fillStyle = WOOD.shade;
  ctx.fillRect(0, WALL_FOOT - 8, 960, 8);
  ctx.fillStyle = 'rgba(214, 170, 90, 0.28)';
  let row = 0;
  for (let yy = WALL_FOOT + 10; yy < 545; yy += 10 + row * 4, row += 1) {
    const step = 34 + row * 10;
    for (let xx = (row % 2) * step * 0.5; xx < 980; xx += step) {
      const s = 2.5 + row * 0.7;
      ctx.beginPath();
      ctx.moveTo(xx, yy - s);
      ctx.lineTo(xx + s * 1.6, yy);
      ctx.lineTo(xx, yy + s);
      ctx.lineTo(xx - s * 1.6, yy);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Warm light from above the dais, and a vignette.
  const pool = ctx.createRadialGradient(480, 260, 40, 480, 300, 520);
  pool.addColorStop(0, 'rgba(255, 214, 150, 0.22)');
  pool.addColorStop(0.55, 'rgba(255, 200, 130, 0.05)');
  pool.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, 960, 540);
}

const backdrop = layer(paintBackdrop);
export function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  blit(ctx, backdrop);
}

/** Senator Vance's two boats in the window, bobbing; they turn the same red at the crash. */
export function drawBoats(ctx: CanvasRenderingContext2D, time: number, red: number): void {
  const { x, y, w, h } = WINDOW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const hull = red > 0.5 ? RED : '#f7f4ec';
  for (const [i, bx, by, s] of [[0, 30, y + 112, 1], [1, 82, y + 118, 1.15]] as const) {
    const bob = Math.sin(time * 1.3 + i * 2.1) * 1.6;
    const roll = Math.sin(time * 1.1 + i) * 0.04;
    ctx.save();
    ctx.translate(bx, by + bob);
    ctx.rotate(roll);
    ctx.scale(s, s);
    // Mast and sail, then the hull with a cabin.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(-2, -38);
    ctx.stroke();
    poly(ctx, [-1, -36, 14, -8, -1, -8], red > 0.5 ? '#ff9aa6' : '#fffaf0', 1.4);
    box(ctx, -10, -12, 14, 7, 2, red > 0.5 ? '#ffb3bd' : '#e8eef5', 1.4);
    poly(ctx, [-22, -6, 22, -6, 16, 4, -17, 4], hull, 1.8);
    ctx.fillStyle = red > 0.5 ? '#7a1020' : '#2a4b78';
    ctx.fillRect(-18, -2, 34, 2);
    ctx.restore();
  }
  ctx.restore();
  // The mullions over the view.
  ctx.strokeStyle = '#6b4026';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + w / 2 + 6, y);
  ctx.lineTo(x + w / 2 + 6, y + h);
  ctx.moveTo(x, y + 58);
  ctx.lineTo(x + w, y + 58);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);
  if (red > 0) {
    ctx.fillStyle = `rgba(224, 38, 62, ${0.18 * clamp(red, 0, 1)})`;
    ctx.fillRect(x, y, w, h);
  }
}

// ─── The dais ───────────────────────────────────────────────────────────────────────────────────────────

const NAMEPLATES: [x: number, text: string][] = [
  [SEAT_X.marcus, 'CHAIRMAN MARCUS'],
  [SEAT_X.vance, 'SEN. VANCE'],
  [SEAT_X.ruiz, 'SEN. RUIZ'],
  [SEAT_X.howe, 'SEN. HOWE'],
  [SEAT_X.bell, 'SEN. BELL'],
];

function curve(ctx: CanvasRenderingContext2D, from: number, to: number, at: (x: number) => number, move: boolean): void {
  const step = from < to ? 12 : -12;
  for (let x = from; step > 0 ? x <= to : x >= to; x += step) {
    if (move && x === from) ctx.moveTo(x, at(x));
    else ctx.lineTo(x, at(x));
  }
  ctx.lineTo(to, at(to));
}

function paintDais(ctx: CanvasRenderingContext2D): void {
  const L = DAIS.left;
  const R = DAIS.right;
  // The front face, then its raised panels between the seats.
  ctx.beginPath();
  curve(ctx, L, R, daisTop, true);
  curve(ctx, R, L, daisFoot, false);
  ctx.closePath();
  ctx.fillStyle = WOOD.dais;
  ctx.fill();
  const edges = [L + 14, 276, 412, 548, 684, R - 14];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const a = edges[i]! + 10;
    const b = edges[i + 1]! - 10;
    ctx.beginPath();
    curve(ctx, a, b, (x) => daisTop(x) + 22, true);
    curve(ctx, b, a, (x) => daisFoot(x) - 16, false);
    ctx.closePath();
    ctx.fillStyle = '#4a2814';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 150, 0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    curve(ctx, a + 8, b - 8, (x) => daisTop(x) + 30, true);
    curve(ctx, b - 8, a + 8, (x) => daisFoot(x) - 24, false);
    ctx.closePath();
    ctx.fillStyle = '#56301a';
    ctx.fill();
  }
  // Pilasters with brass caps at the panel edges.
  for (const e of edges) {
    ctx.fillStyle = '#6a3c21';
    ctx.fillRect(e - 6, daisTop(e) + 10, 12, daisFoot(e) - daisTop(e) - 16);
    ctx.fillStyle = '#c99a45';
    ctx.fillRect(e - 7, daisTop(e) + 10, 14, 4);
  }
  // The kick plate.
  ctx.beginPath();
  curve(ctx, L, R, (x) => daisFoot(x) - 8, true);
  curve(ctx, R, L, daisFoot, false);
  ctx.closePath();
  ctx.fillStyle = '#2f190e';
  ctx.fill();
  // The bench top's near edge and the brass trim under it.
  ctx.beginPath();
  curve(ctx, L - 4, R + 4, (x) => daisTop(x) - 9, true);
  curve(ctx, R + 4, L - 4, (x) => daisTop(x) + 4, false);
  ctx.closePath();
  ctx.fillStyle = WOOD.top;
  ctx.fill();
  ink(ctx, 2.5);
  ctx.stroke();
  ctx.strokeStyle = '#d8b25a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  curve(ctx, L, R, (x) => daisTop(x) + 9, true);
  ctx.stroke();
  ctx.beginPath();
  curve(ctx, L, R, daisTop, true);
  curve(ctx, R, L, daisFoot, false);
  ctx.closePath();
  ink(ctx, 3);
  ctx.stroke();
  // The plaque at the front: a letter board whose subject has not been assigned.
  const tiles = 'COMMITTEE ON ?????';
  const tw = 11;
  const start = 480 - (tiles.length * tw) / 2;
  const ty = daisTop(480) + 11;
  box(ctx, start - 8, ty - 4, tiles.length * tw + 16, 20, 3, '#1c1410', 2);
  for (let i = 0; i < tiles.length; i += 1) {
    const ch = tiles[i]!;
    if (ch === ' ') continue;
    const tx = start + i * tw;
    ctx.fillStyle = ch === '?' ? '#3a332c' : '#efe6cf';
    ctx.fillRect(tx + 1, ty, tw - 2, 12);
    if (ch !== '?') label(ctx, ch, tx + tw / 2, ty + 6.5, 9, '#1c1410', 900);
  }
  // The name plates on the bench top.
  for (const [x, text] of NAMEPLATES) {
    const s = seatScale(x);
    const w = (text.length > 10 ? 92 : 70) * s;
    const top = daisTop(x) - 22 * s;
    poly(ctx, [x - w / 2, top + 16 * s, x - w / 2 + 3, top, x + w / 2 - 3, top, x + w / 2, top + 16 * s], '#d8b25a', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x - w / 2 + 5, top + 2, w - 10, 2);
    label(ctx, text, x, top + 9 * s, 9 * s, '#2a1a0c', 900, w - 8);
  }
}

/** The dais front with its plates: one cached image the size of the dais, not of the frame. */
export function drawDais(ctx: CanvasRenderingContext2D): void {
  drawSprite(ctx, 'dais', DAIS.left - 12, DAIS.top - 34, DAIS.right - DAIS.left + 24, DAIS.bottom + DAIS.bottomSag - DAIS.top + 44, (g) => {
    g.translate(-(DAIS.left - 12), -(DAIS.top - 34));
    paintDais(g);
  });
}

/** The Chairman's sound block, on the bench at his right hand. */
export const BLOCK = { x: SEAT_X.marcus - 60, y: daisTop(SEAT_X.marcus - 60) - 4 } as const;
export function drawBlock(ctx: CanvasRenderingContext2D): void {
  blob(ctx, BLOCK.x, BLOCK.y + 1, 20, 6, '#3a1f10', 2);
  box(ctx, BLOCK.x - 17, BLOCK.y - 9, 34, 9, 3, '#7a4220', 2.2);
}

/** A senator's gooseneck microphone, its head nodding when the senator talks. */
export function drawMic(ctx: CanvasRenderingContext2D, x: number, s: number, wobble: number): void {
  const base = { x: x + 30 * s, y: daisTop(x) - 3 };
  const head = { x: x + 18 * s + wobble * 2, y: base.y - 46 * s + Math.abs(wobble) };
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.quadraticCurveTo(base.x + 6 * s, head.y + 16 * s, head.x, head.y);
  ctx.stroke();
  ctx.strokeStyle = '#6d6f78';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  blob(ctx, base.x, base.y, 9 * s, 3.5 * s, '#26262c', 1.8);
  blob(ctx, head.x, head.y - 3 * s, 5 * s, 7 * s, '#1f1f24', 1.8);
  ctx.fillStyle = '#ff5a4a';
  ctx.beginPath();
  ctx.arc(base.x + 5 * s, base.y - 1, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

// ─── The minutes: one page per exchange, pinned up the board ────────────────────────────────────────────

export interface Minutes {
  /** Pages pinned to the board. */
  pages: number;
  /** The first page with no words on it (she stopped recording at 5×); Infinity until then. */
  firstBlank: number;
  /** The gold page typed at the player's exit, or -1. */
  yours: number;
  /** Pages in flight from the typewriter to the board, 0 → 1. */
  flying: { t: number; blank: boolean; yours: boolean }[];
  /** Set for one step when a page lands. */
  landed: boolean;
}

export const createMinutes = (): Minutes => ({ pages: 0, firstBlank: Infinity, yours: -1, flying: [], landed: false });
export function resetMinutes(m: Minutes): void {
  Object.assign(m, createMinutes());
}
/** A page leaves the typewriter. */
export function typePage(m: Minutes, blank: boolean, yours: boolean): void {
  if (m.flying.length >= 3) land(m, m.flying.shift()!);
  m.flying.push({ t: 0, blank, yours });
}
function land(m: Minutes, p: { blank: boolean; yours: boolean }): void {
  if (p.blank && m.firstBlank === Infinity) m.firstBlank = m.pages;
  if (p.yours) m.yours = m.pages;
  m.pages += 1;
  m.landed = true;
}
export function stepMinutes(m: Minutes, dt: number): void {
  m.landed = false;
  for (const p of m.flying) p.t += dt / 0.75;
  while (m.flying.length && m.flying[0]!.t >= 1) land(m, m.flying.shift()!);
}
/** Settles the board as a round already under way has it. */
export function settleMinutes(m: Minutes, pages: number, firstBlank: number, yours: number): void {
  m.pages = pages;
  m.firstBlank = firstBlank;
  m.yours = yours;
  m.flying = [];
}

/** The most pages drawn; past it the stack is drawn compressed (it still shows every page's weight). */
const DRAWN = 56;
const STACK_X = BOARD.x + (BOARD.w - PAGE_W) / 2;

function stackStep(n: number): number {
  return n <= 1 ? 0 : Math.min(13, (BOARD.bottom - BOARD.top - PAGE_H - 6) / (n - 1));
}

function drawPage(ctx: CanvasRenderingContext2D, x: number, y: number, blank: boolean, yours: boolean, words: number, rows = 6): void {
  ctx.fillStyle = yours ? '#ffe08a' : PAPER;
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.rect(x, y, PAGE_W, PAGE_H);
  ctx.fill();
  ctx.stroke();
  if (!blank && rows > 0) {
    ctx.fillStyle = yours ? '#8a6a20' : '#9a958a';
    ctx.beginPath();
    for (let i = 0; i < rows; i += 1) ctx.rect(x + 6, y + PAGE_H - 10 - i * 10, PAGE_W - 14 - ((words * 7 + i * 13) % 17), 2);
    ctx.fill();
  }
  if (yours) {
    ctx.fillStyle = '#e0a020';
    ctx.fillRect(x + PAGE_W - 4, y + 2, 10, 12);
    label(ctx, 'YOU', x + PAGE_W / 2, y + PAGE_H - 6, 8, '#5a3a00', 900);
  }
}

/**
 * The board: the pinned stack (the round's height), the pages in flight from the typewriter, and at the crash
 * the stack pulled off the wall by its bottom page and falling as one sheet, with a few loose pages.
 */
export function drawMinutes(ctx: CanvasRenderingContext2D, m: Minutes, crashT: number, crashSeed: number, time: number, air: boolean): void {
  const n = m.pages;
  const step = stackStep(n);
  const shown = Math.min(n, DRAWN);
  const pageTop = (k: number): number => BOARD.bottom - PAGE_H - 4 - k * step;
  const tug = crashT > 0 ? smoothstep(CRASH.tug, CRASH.tug + 0.18, crashT) : 0;
  const fall = crashT > 0 ? clamp((crashT - CRASH.fall) / CRASH.fallFor, 0, 1) : 0;
  const topY = n > 0 ? pageTop(n - 1) : BOARD.bottom - PAGE_H;
  if (air) {
    drawLoose(ctx, m, crashT, crashSeed, time, fall, topY, pageTop(n));
    return;
  }
  // Pins left behind once the stack has come down.
  if (fall > 0) {
    ctx.fillStyle = '#c0283a';
    ctx.beginPath();
    for (let i = 0; i < shown; i += 1) {
      const k = Math.round((i / Math.max(1, shown - 1)) * (n - 1));
      ctx.moveTo(STACK_X + PAGE_W / 2 + 2, pageTop(k) + 4);
      ctx.arc(STACK_X + PAGE_W / 2, pageTop(k) + 4, 2, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  if (n > 0 && fall < 1) {
    ctx.save();
    if (fall > 0) {
      // One sheet: the top drops under gravity and folds onto the floor at the foot of the board.
      const g = fall * fall;
      const foot = BOARD.bottom + 18;
      ctx.translate(STACK_X + PAGE_W / 2, foot);
      ctx.transform(1, 0, -0.35 * g, 1, 0, 0);
      ctx.scale(1 + 0.15 * g, 1 - 0.9 * g);
      ctx.translate(-(STACK_X + PAGE_W / 2), -foot + 18 * g);
    } else if (tug > 0) ctx.translate(0, 4 * tug);
    // The shingled pages as one sheet: the paper, the gold page, the lines that show, the page edges.
    const x = STACK_X;
    const below = pageTop(0) + PAGE_H;
    if (n > 1) {
      const bottomY = below + 10 * tug;
      ctx.fillStyle = PAPER;
      ctx.fillRect(x, topY + PAGE_H, PAGE_W, bottomY - topY - PAGE_H);
      if (m.yours >= 0 && m.yours < n - 1) {
        ctx.fillStyle = '#ffe08a';
        ctx.fillRect(x, pageTop(m.yours) + PAGE_H - step, PAGE_W, step);
      }
      if (step >= 9) {
        ctx.fillStyle = '#9a958a';
        ctx.beginPath();
        for (let k = 0; k < Math.min(n - 1, m.firstBlank); k += 1) ctx.rect(x + 6, pageTop(k) + PAGE_H - 9, PAGE_W - 14 - ((k * 7) % 17), 2);
        ctx.fill();
      }
      ink(ctx, 1.6);
      ctx.beginPath();
      ctx.rect(x, topY + PAGE_H - 1, PAGE_W, bottomY - topY - PAGE_H + 1);
      for (let i = 1; i < shown; i += 1) {
        const k = shown === n ? i : Math.round((i / Math.max(1, shown - 1)) * (n - 1));
        ctx.moveTo(x, pageTop(k) + PAGE_H);
        ctx.lineTo(x + PAGE_W, pageTop(k) + PAGE_H);
      }
      ctx.stroke();
      if (m.yours >= 0 && m.yours < n - 1) {
        ctx.fillStyle = '#e0a020';
        ctx.fillRect(x + PAGE_W - 4, pageTop(m.yours) + PAGE_H - step + 1, 10, Math.max(4, step - 2));
      }
    }
    drawPage(ctx, x, topY + (n === 1 ? 10 * tug : 0), n - 1 >= m.firstBlank, n - 1 === m.yours, n - 1);
    // The top page's pin.
    if (fall === 0) {
      ctx.fillStyle = '#c0283a';
      ink(ctx, 1.2);
      ctx.beginPath();
      ctx.arc(STACK_X + PAGE_W / 2, topY + 5, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  if (fall >= 1 && n > 0) {
    // The heap at the foot of the board.
    const rand = mulberry32(crashSeed + 3);
    const heap = Math.min(10, 3 + Math.floor(n / 4));
    for (let i = 0; i < heap; i += 1) {
      ctx.save();
      ctx.translate(STACK_X + PAGE_W / 2 + (rand() - 0.5) * 30, BOARD.bottom + 22 - i * 1.6);
      ctx.rotate((rand() - 0.5) * 0.5);
      ctx.scale(1, 0.32);
      drawPage(ctx, -PAGE_W / 2, -PAGE_H / 2, i >= m.firstBlank, false, i);
      ctx.restore();
    }
  }
  // The page count on the plaque.
  box(ctx, BOARD.x + 14, BOARD.bottom - 1, BOARD.w - 28, 12, 3, '#1c1410', 1.5);
  label(ctx, `${n} PP.`, BOARD.x + BOARD.w / 2, BOARD.bottom + 5, 9, fall >= 1 ? '#ff8a96' : '#ffe08a', 900);
}

/** What is in the air in front of everything: the loose pages of the crash and the pages in flight. */
function drawLoose(ctx: CanvasRenderingContext2D, m: Minutes, crashT: number, crashSeed: number, time: number, fall: number, topY: number, nextTop: number): void {
  const n = m.pages;
  // Loose pages fluttering off the falling stack.
  if (fall > 0 && n > 0) {
    const rand = mulberry32(crashSeed);
    const loose = Math.min(7, 2 + Math.floor(n / 3));
    for (let i = 0; i < loose; i += 1) {
      const start = CRASH.fall + 0.05 + rand() * 0.4;
      const dur = 0.7 + rand() * 0.6;
      const from = { x: STACK_X + 10 + rand() * 40, y: topY + rand() * (BOARD.bottom - topY - PAGE_H) };
      const to = { x: 790 + rand() * 150, y: 446 + rand() * 30 };
      const spin = (rand() - 0.5) * 6;
      const sway = 10 + rand() * 18;
      const u = clamp((crashT - start) / dur, 0, 1);
      if (crashT < start) continue;
      const e = smoothstep(0, 1, u);
      const px = mix(from.x, to.x, e) + Math.sin(u * 9 + i) * sway * (1 - u);
      const py = mix(from.y, to.y, u * u);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(spin * u);
      ctx.scale(0.5, mix(0.5, 0.18, u));
      drawPage(ctx, -PAGE_W / 2, -PAGE_H / 2, i % 3 === 0, false, i);
      ctx.restore();
    }
  }
  // Pages in flight, from the typewriter's platen up to the top of the stack.
  for (const p of m.flying) {
    const t = clamp(p.t, 0, 1);
    const from = { x: TYPEWRITER.x - 18, y: TYPEWRITER.y - 40 };
    const to = { x: STACK_X + PAGE_W / 2, y: nextTop + PAGE_H / 2 };
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 };
    const u = smoothstep(0, 1, t);
    const x = (1 - u) ** 2 * from.x + 2 * (1 - u) * u * mid.x + u * u * to.x;
    const y = (1 - u) ** 2 * from.y + 2 * (1 - u) * u * mid.y + u * u * to.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * Math.PI) * 0.6 + Math.sin(time * 9) * 0.05);
    const k = mix(0.45, 1, t);
    ctx.scale(k, k);
    drawPage(ctx, -PAGE_W / 2, -PAGE_H / 2, p.blank, p.yours, n);
    ctx.restore();
  }
}

// ─── The clerk's desk and the bouquet of bail applications ──────────────────────────────────────────────

const RIBBONS: [colour: string, name: string][] = [
  ['#c0283a', 'APPROPRIATIONS'],
  ['#2f6fd0', 'BOATS'],
  ['#2e9e5b', 'PAGE NINE'],
  ['#e0a020', 'REFINERIES'],
  ['#8a3fb0', 'WALLETS'],
];

export function drawClerkDesk(ctx: CanvasRenderingContext2D): void {
  const { x, y, top } = CLERK;
  // Legs, the top, the modesty panel and its plate.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 46, top + 4);
  ctx.lineTo(x - 46, y);
  ctx.moveTo(x + 46, top + 4);
  ctx.lineTo(x + 46, y);
  ctx.stroke();
  box(ctx, x - 54, top + 6, 108, 34, 3, '#5e361e', 2.5);
  ctx.strokeStyle = 'rgba(255,210,150,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 46, top + 12, 92, 22);
  poly(ctx, [x - 58, top + 6, x - 52, top - 4, x + 52, top - 4, x + 58, top + 6], '#8a5a33', 2.5);
  box(ctx, x - 20, top + 18, 40, 10, 2, '#d8b25a', 1.5);
  label(ctx, 'CLERK', x, top + 23.5, 7, '#2a1a0c', 900);
}

/**
 * The bouquet: one rolled bail application per senator, each tied with a ribbon naming a committee, growing with
 * the tension; `held` draws it without the vase, as carried.
 */
export function drawBouquet(ctx: CanvasRenderingContext2D, x: number, y: number, grow: number, time: number, held = false, tilt = 0): void {
  // Grown in steps, so the ribbon names are not re-rasterised at a new size every frame.
  const g = Math.round(clamp(grow, 0, 1.4) * 20) / 20;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const stem = 22 + 44 * g;
  const roll = 0.75 + 0.55 * g;
  const heads: { a: number; tx: number; ty: number }[] = [];
  ctx.strokeStyle = '#3f7a3a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = (i - 2) * (0.24 + 0.06 * g) + Math.sin(time * 1.2 + i * 1.7) * 0.03;
    const len = stem * (i % 2 === 0 ? 1 : 0.86);
    const tx = Math.sin(a) * len;
    const ty = -Math.cos(a) * len;
    ctx.moveTo(0, held ? 0 : -10);
    ctx.quadraticCurveTo(tx * 0.3, ty * 0.6, tx, ty);
    heads.push({ a, tx, ty });
  }
  ctx.stroke();
  for (let i = 0; i < 5; i += 1) {
    const { a, tx, ty } = heads[i]!;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    ctx.scale(roll, roll);
    // The rolled application, its curl, and the ribbon round it with a name tag.
    box(ctx, -7, -20, 14, 24, 5, PAPER, 1.6);
    const [colour, name] = RIBBONS[i]!;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.rect(-7.5, -9, 15, 4);
    ctx.moveTo(-2, -5);
    ctx.lineTo(-7, 6);
    ctx.lineTo(-3, 5);
    ctx.lineTo(0, -5);
    ctx.lineTo(3, 5);
    ctx.lineTo(7, 6);
    ctx.lineTo(2, -5);
    ctx.fill();
    if (g > 0.35) {
      ctx.save();
      ctx.rotate(-a);
      box(ctx, 5, -8, 30, 8, 2, '#fffaf0', 1);
      label(ctx, name, 20, -3.7, 4.6, colour, 900, 28);
      ctx.restore();
    }
    ctx.restore();
  }
  if (!held) {
    // The vase: a glass jar with water.
    ctx.fillStyle = 'rgba(190, 225, 240, 0.55)';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(-12, -16);
    ctx.lineTo(-10, 0);
    ctx.quadraticCurveTo(0, 4, 10, 0);
    ctx.lineTo(12, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(80, 150, 200, 0.45)';
    ctx.fillRect(-10, -9, 20, 8);
  }
  ctx.restore();
}

// ─── The witness table ──────────────────────────────────────────────────────────────────────────────────

export function drawWitnessTable(ctx: CanvasRenderingContext2D): void {
  const { left, right, far, near } = TABLE;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(left + 14, near);
  ctx.lineTo(left + 14, 504);
  ctx.moveTo(right - 14, near);
  ctx.lineTo(right - 14, 504);
  ctx.stroke();
  ctx.strokeStyle = '#4a2814';
  ctx.lineWidth = 3;
  ctx.stroke();
  poly(ctx, [left + 8, far, right - 8, far, right, near, left, near], '#9a6538', 2.5);
  box(ctx, left, near, right - left, 26, 2, '#5e361e', 2.5);
  ctx.strokeStyle = 'rgba(255,210,150,0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 10, near + 6, right - left - 20, 14);
  // The witness microphone, rising past the hood's right shoulder.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(548, far + 6);
  ctx.quadraticCurveTo(560, far - 30, 540, far - 44);
  ctx.stroke();
  ctx.strokeStyle = '#6d6f78';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#1f1f24';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.ellipse(538, far - 50, 6, 8, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // A glass of water, untouched.
  ctx.fillStyle = 'rgba(200, 230, 245, 0.6)';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(612, far - 14);
  ctx.lineTo(614, far + 6);
  ctx.lineTo(626, far + 6);
  ctx.lineTo(628, far - 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(110, 170, 210, 0.5)';
  ctx.fillRect(613, far - 6, 14, 11);
}

export interface PhoneView {
  /** 0 dark, 1 lit; `buzz` shakes it; `red` turns the screen to the crash. */
  lit: number;
  buzz: number;
  red: boolean;
  text: string;
}

/** The witness's phone, flat on the table, screen up. */
export function drawPhone(ctx: CanvasRenderingContext2D, p: PhoneView, time: number): void {
  const jx = p.buzz > 0 ? Math.sin(time * 90) * 1.8 * p.buzz : 0;
  ctx.save();
  ctx.translate(PHONE.x + jx, PHONE.y);
  ctx.rotate(-0.1);
  ctx.transform(1, 0, -0.35, 0.62, 0, 0);
  box(ctx, -15, -24, 30, 48, 6, '#16161c', 2.2);
  const glow = clamp(p.lit, 0, 1);
  ctx.fillStyle = p.red ? `rgba(255, 50, 70, ${0.35 + 0.65 * glow})` : `rgba(120, 200, 255, ${0.12 + 0.75 * glow})`;
  ctx.fillRect(-12, -20, 24, 40);
  if (glow > 0.2) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 7px ${LABEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, 0, -4, 22);
  }
  ctx.restore();
  if (glow > 0.05) {
    // The glow on the table round it.
    ctx.fillStyle = p.red ? `rgba(255, 60, 80, ${0.18 * glow})` : `rgba(140, 210, 255, ${0.12 * glow})`;
    ctx.beginPath();
    ctx.ellipse(PHONE.x, PHONE.y, 34, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.buzz > 0.05) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * p.buzz})`;
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i += 1) {
        ctx.beginPath();
        ctx.arc(PHONE.x + jx, PHONE.y, 20 + i * 7, s > 0 ? -0.5 : Math.PI - 0.5, s > 0 ? 0.5 : Math.PI + 0.5);
        ctx.stroke();
      }
    }
  }
}

/** A notification card popped up over the phone: the crash's DEV SOLD, readable at any size. */
export function drawNotification(ctx: CanvasRenderingContext2D, text: string, sub: string, pop: number, alpha: number): void {
  if (pop <= 0.02 || alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha, 0, 1);
  ctx.translate(PHONE.x + 44, PHONE.y - 52);
  const s = clamp(pop, 0, 1.25);
  ctx.scale(s, s);
  box(ctx, -66, -22, 132, 44, 10, '#fbf6ea', 2.5);
  box(ctx, -58, -14, 28, 28, 7, RED, 2);
  label(ctx, '!', -44, 0, 20, '#ffffff', 900);
  label(ctx, text, 18, -4, 17, RED, 900, 92, 'center');
  label(ctx, sub, 18, 12, 8, '#5a5048', 700, 92, 'center');
  poly(ctx, [-40, 22, -28, 22, -46, 38], '#fbf6ea', 2);
  ctx.fillStyle = '#fbf6ea';
  ctx.fillRect(-42, 19, 16, 4);
  ctx.restore();
}

/** The page's card for the witness, on the table, and the same card held up to read. */
export function drawCard(ctx: CanvasRenderingContext2D, onTable: number, pop: number): void {
  if (onTable > 0.02) {
    ctx.save();
    ctx.translate(CARD.x, CARD.y);
    ctx.rotate(0.12);
    ctx.transform(1, 0, -0.3, 0.6, 0, 0);
    box(ctx, -18, -12, 36, 24, 2, '#ffffff', 1.6);
    ctx.fillStyle = '#8a8478';
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) ctx.rect(-12, -6 + i * 5, 24, 1.5);
    ctx.fill();
    ctx.restore();
  }
  if (pop > 0.02) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(CARD.x - 10, CARD.y + 2);
    ctx.lineTo(CARD.x - 70, CARD.y + 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(CARD.x - 150, CARD.y + 8);
    ctx.rotate(-0.05);
    const s = clamp(pop, 0, 1.25);
    ctx.scale(s, s);
    box(ctx, -78, -30, 156, 60, 3, '#ffffff', 2.5);
    ctx.strokeStyle = '#9fc3e8';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-72, -12 + i * 12);
      ctx.lineTo(72, -12 + i * 12);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e88a9a';
    ctx.beginPath();
    ctx.moveTo(-60, -30);
    ctx.lineTo(-60, 30);
    ctx.stroke();
    label(ctx, 'THE COIN', 6, -10, 17, INK, 900, 136);
    label(ctx, 'WAS THE RECORD', 6, 10, 17, INK, 900, 136);
    ctx.restore();
  }
}

/** The stenographer's typewriter on its stand, the carriage sliding and the paper rising from the platen. */
export function drawTypewriter(ctx: CanvasRenderingContext2D, carriage: number, paper: number, blank: boolean): void {
  const { x, y } = TYPEWRITER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 22, y + 4);
  ctx.lineTo(x - 26, 476);
  ctx.moveTo(x + 22, y + 4);
  ctx.lineTo(x + 26, 476);
  ctx.stroke();
  box(ctx, x - 34, y, 68, 8, 2, '#5e361e', 2.5);
  // The paper, then the carriage and the body.
  const shift = (carriage - 0.5) * 16;
  const ph = 8 + 46 * clamp(paper, 0, 1);
  ctx.fillStyle = PAPER;
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.rect(x - 34 + shift, y - 26 - ph, 30, ph + 4);
  ctx.fill();
  ctx.stroke();
  if (!blank) {
    ctx.fillStyle = '#9a958a';
    ctx.beginPath();
    for (let i = 0; i < Math.floor(ph / 7); i += 1) ctx.rect(x - 30 + shift, y - 24 - ph + 6 + i * 7, 20 - ((i * 7) % 9), 1.5);
    ctx.fill();
  }
  box(ctx, x - 44 + shift, y - 30, 48, 9, 4, '#2c4636', 2);
  blob(ctx, x - 46 + shift, y - 26, 4, 4, '#cfcfcf', 1.5);
  poly(ctx, [x - 30, y - 22, x + 24, y - 22, x + 30, y, x - 36, y], '#355a44', 2.5);
  ctx.fillStyle = '#e8e2d0';
  ctx.beginPath();
  for (let r = 0; r < 3; r += 1) for (let i = 0; i < 6; i += 1) ctx.rect(x - 26 + i * 8 + r * 2, y - 16 + r * 5, 4, 3);
  ctx.fill();
}

