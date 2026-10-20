/** Enamel, paper and ink shared by the Ministry's hand-drawn machinery. */
export const C = { ink: '#142e35', dark: '#10282f', cream: '#fff3d7', paper: '#eadbb9', muted: '#7d8d86', coral: '#f27c55', red: '#c54636', mint: '#75d9c0', lime: '#d5e976', brass: '#bea06d', pale: '#b3c5b8' };
export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = C.ink, width = 2): void {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill();
  if (width > 0) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = C.ink, width = 2): void {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  if (width > 0) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function line(c: CanvasRenderingContext2D, points: number[], color = C.ink, width = 2): void {
  c.beginPath(); c.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i]!, points[i + 1]!);
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
export function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = C.ink, align: CanvasTextAlign = 'left', maxWidth?: number, weight = 800): void {
  c.font = `${weight} ${size}px "Arial", sans-serif`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = color;
  if (maxWidth !== undefined) c.fillText(text, x, y, maxWidth); else c.fillText(text, x, y);
}
export function mono(c: CanvasRenderingContext2D, text: string, x: number, y: number, size = 12, color = C.muted, align: CanvasTextAlign = 'left', maxWidth?: number): void {
  c.font = `700 ${size}px "Courier New", monospace`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = color;
  if (maxWidth !== undefined) c.fillText(text, x, y, maxWidth); else c.fillText(text, x, y);
}
export function bolt(c: CanvasRenderingContext2D, x: number, y: number, r = 4): void {
  oval(c, x, y, r, r, C.pale, C.ink, 1.4); line(c, [x - r * .5, y + r * .4, x + r * .5, y - r * .4], C.ink, 1.2);
}
export function hatch(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = C.brass; c.fillRect(x, y, w, h);
  for (let i = -h; i < w; i += 24) line(c, [x + i, y + h, x + i + h, y], C.ink, 10);
  c.restore();
}
