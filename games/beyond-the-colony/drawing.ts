import { TAU } from './motion';
export const INK = '#062637';
export const WHITE = '#edf7e6';
export const JADE = '#8de6b2';
export const CORAL = '#ed796c';
export const GOLD = '#ffd385';
export const FONT = 'Impact, "Arial Black", system-ui, sans-serif';
export function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, angle = 0, stroke = 0): void {
  c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), angle, 0, TAU); c.fill();
  if (stroke) { c.strokeStyle = INK; c.lineWidth = stroke; c.stroke(); }
}
export function polygon(c: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], fill: string | CanvasGradient, stroke = 0): void {
  c.fillStyle = fill; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
  if (stroke) { c.lineWidth = stroke; c.strokeStyle = INK; c.stroke(); }
}
export function line(c: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], fill = INK, width = 3): void {
  c.strokeStyle = fill; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
}
export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 7, stroke = 0): void {
  c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
  if (stroke) { c.strokeStyle = INK; c.lineWidth = stroke; c.stroke(); }
}
export function words(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, fill = WHITE, width = 900, align: CanvasTextAlign = 'center', outline = false): void {
  c.font = `900 ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = fill;
  if (outline) { c.strokeStyle = INK; c.lineJoin = 'round'; c.lineWidth = Math.max(3, size * .15); c.strokeText(value, x, y, width); }
  c.fillText(value, x, y, width);
}
export function burst(c: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void {
  const points: [number, number][] = [];
  for (let i = 0; i < 24; i += 1) { const a = i * TAU / 24; const r = radius * (i % 2 ? .52 : 1); points.push([x + Math.cos(a) * r, y + Math.sin(a) * r * .65]); }
  polygon(c, points, fill, 3);
}
export function balloon(c: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, colour = WHITE, size = 21): void {
  polygon(c, [[x - 12, y + 17], [x - 30, y + 43], [x + 19, y + 16]], colour, 3);
  box(c, x - width / 2, y - 22, width, 47, colour, 10, 3);
  words(c, value, x, y + 1, size, INK, width - 18);
}
