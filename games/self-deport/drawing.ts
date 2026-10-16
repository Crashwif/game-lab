/** Canvas 2D helpers in the catalog's thick-ink cartoon style: every shape is filled and inked, text is stroked. */
export const INK = '#1e1a2b';
export const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
/** Hermite ease of a 0..1 fraction (clamped). */
export const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
/** Hash noise in [0, 1): the same input always gives the same value. */
export const noise = (n: number) => { const t = Math.sin(n * 19.17 + 7.3) * 43758.5453; return t - Math.floor(t); };

export function shape(c: CanvasRenderingContext2D, points: number[][], fill: string, width = 3, stroke = INK) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x!, y!) : c.moveTo(x!, y!)); c.closePath();
  c.fillStyle = fill; c.fill(); if (width) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}
export function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, width = 0, stroke = INK) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  if (width) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 8, width = 3, stroke = INK) {
  c.beginPath(); c.roundRect(x, y, w, h, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2)); c.fillStyle = fill; c.fill();
  if (width) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function line(c: CanvasRenderingContext2D, points: number[][], color: string, width: number) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x!, y!) : c.moveTo(x!, y!));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
/** Meme lettering: heavy, inked, with an optional maxWidth squeeze. */
export function text(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, fill = '#fff5d7', align: CanvasTextAlign = 'left', maxWidth?: number) {
  c.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = size > 28 ? 5 : size > 18 ? 3 : size > 12 ? 2.2 : 1.5;
  c.strokeText(value, x, y, maxWidth); c.fillStyle = fill; c.fillText(value, x, y, maxWidth);
}
/** Plain lettering without ink: UI screens, the blue screen, small print. */
export function plain(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left', font = 'system-ui, sans-serif', weight = 600, maxWidth?: number) {
  c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = fill; c.fillText(value, x, y, maxWidth);
}
/** A soft radial light, added on top of what is there. */
export function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, alpha: number) {
  if (alpha <= 0.005 || r <= 1) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`); g.addColorStop(1, `rgba(${rgb}, 0)`);
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
/** A rubber stamp slamming in: scales from `from` down to 1 and fades in; `tilt` in radians. */
export function stamp(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, slam: number, tilt: number, draw: () => void) {
  if (slam <= 0) return;
  c.save(); c.globalAlpha *= ease(slam / 0.4); c.translate(x, y); c.rotate(tilt);
  const s = 1.7 - 0.7 * ease(slam); c.scale(s, s);
  box(c, -w / 2, -h / 2, w, h, fill, 14, 6); draw(); c.restore();
}
