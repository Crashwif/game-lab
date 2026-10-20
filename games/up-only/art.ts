/** Small Canvas helpers and the palette; every mark in this game is drawn locally. */
export const INK = '#0b0c1c';
export const PINK = '#ff3d8a';
export const CYAN = '#5ff2e6';
export const LIME = '#c8ff3e';
export const GOLD = '#ffd23f';
export const VIOLET = '#8b5cf6';
export const FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
export const MONO = '"Courier New", monospace';

export type Point = readonly [number, number];

export function poly(ctx: CanvasRenderingContext2D, points: readonly Point[], fill?: string | CanvasGradient, stroke?: string, width = 2): void {
  ctx.beginPath();
  for (const [i, p] of points.entries()) i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function line(ctx: CanvasRenderingContext2D, points: readonly Point[], colour: string, width: number, cap: CanvasLineCap = 'round'): void {
  ctx.beginPath();
  for (const [i, p] of points.entries()) i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.stroke();
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke?: string, radius = 8, width = 1.5): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, width = 2): void {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, colour = '#fff', align: CanvasTextAlign = 'left', maxWidth?: number, font = FONT): void {
  ctx.font = `900 ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = colour;
  ctx.fillText(value, x, y, maxWidth);
}

/** Meme lettering: heavy type with a dark outline, readable over anything. */
export function memeText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center', maxWidth?: number, outline = INK): void {
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.16); ctx.strokeStyle = outline;
  ctx.strokeText(value, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(value, x, y, maxWidth);
}

/** A count with thousands separators, as the HUD and the stash show them. */
export const count = (n: number): string => Math.max(0, Math.round(n)).toLocaleString('en-US');
