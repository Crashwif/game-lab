/** Small Canvas helpers; every mark in this game is drawn locally. */
export const INK = '#090c17';
export const LIME = '#d8ff3e';
export const PINK = '#ff407e';
export const CYAN = '#6af7e8';
export const FONT = '"Arial Black", Impact, sans-serif';
export const MONO = '"Courier New", monospace';

export function poly(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], fill: string, stroke?: string, width = 2): void {
  ctx.beginPath();
  for (const [i, p] of points.entries()) i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, colour = '#fff', align: CanvasTextAlign = 'left', maxWidth?: number, font = FONT): void {
  ctx.font = `900 ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = colour;
  ctx.fillText(value, x, y, maxWidth);
}

export function line(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], colour: string, width: number): void {
  ctx.beginPath();
  for (const [i, p] of points.entries()) i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string, border?: string, radius = 8): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = colour; ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke(); }
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, colour: string, border?: string): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke(); }
}
