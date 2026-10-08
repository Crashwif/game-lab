export const INK = '#101c19';
export const CREAM = '#fff0c6';
export const GREEN = '#6df38c';
export const GOLD = '#ffcc4d';
export const RED = '#ff685c';
export const FONT = 'Impact, "Arial Black", system-ui, sans-serif';
export const TAU = Math.PI * 2;
export const clamp = (n: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, n));
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const ease = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const pulse = (t: number, a: number, b: number): number => Math.sin(clamp((t - a) / (b - a)) * Math.PI);
export const frac = (n: number): number => n - Math.floor(n);
export const grain = (n: number): number => frac(Math.sin(n * 93.13 + 71.41) * 19997.4);

export function shape(c: CanvasRenderingContext2D, fill: string, width = 4): void {
  c.fillStyle = fill; c.strokeStyle = INK; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round';
  c.fill(); if (width > 0) c.stroke();
}
export function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, width = 4, angle = 0): void {
  c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), angle, 0, TAU); shape(c, fill, width);
}
export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 8, width = 4): void {
  c.beginPath(); c.roundRect(x, y, w, h, radius); shape(c, fill, width);
}
export function poly(c: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], fill: string, width = 4): void {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); shape(c, fill, width);
}
export function line(c: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], colour = INK, width = 4): void {
  c.strokeStyle = colour; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
}
export function text(c: CanvasRenderingContext2D, words: string, x: number, y: number, size: number, fill = INK, align: CanvasTextAlign = 'left', maxWidth?: number, stroke = false): void {
  c.font = `900 ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (stroke) { c.strokeStyle = INK; c.lineWidth = Math.max(3, size * 0.13); c.strokeText(words, x, y, maxWidth); }
  c.fillStyle = fill; c.fillText(words, x, y, maxWidth);
}
export function star(c: CanvasRenderingContext2D, x: number, y: number, radius: number, fill = GOLD, points = 8): void {
  c.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const a = i * Math.PI / points - Math.PI / 2, r = i % 2 ? radius * 0.5 : radius;
    if (i === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath(); shape(c, fill, 3);
}
export function bubble(c: CanvasRenderingContext2D, x: number, y: number, words: string, width = 210, colour = CREAM): void {
  box(c, x - width / 2, y - 23, width, 46, colour, 6, 3);
  poly(c, [[x + 30, y + 22], [x + 43, y + 37], [x + 46, y + 22]], colour, 3);
  text(c, words, x, y + 1, 19, INK, 'center', width - 17);
}
