export const INK = '#23192d';
export const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const noise = (n: number) => { const t = Math.sin(n * 19.17 + 7.3) * 43758.5453; return t - Math.floor(t); };

export function shape(c: CanvasRenderingContext2D, points: number[][], fill: string, width = 3, stroke = INK) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = fill; c.fill(); if (width) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}
export function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, width = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  if (width) { c.strokeStyle = INK; c.lineWidth = width; c.stroke(); }
}
export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 8, width = 3) {
  c.beginPath(); c.roundRect(x, y, w, h, radius); c.fillStyle = fill; c.fill();
  if (width) { c.strokeStyle = INK; c.lineWidth = width; c.stroke(); }
}
export function line(c: CanvasRenderingContext2D, points: number[][], color: string, width: number) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
export function text(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, fill = '#fff5d7', align: CanvasTextAlign = 'left', maxWidth?: number) {
  c.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = size > 28 ? 5 : 3;
  c.strokeText(value, x, y, maxWidth); c.fillStyle = fill; c.fillText(value, x, y, maxWidth);
}

const leafTextures = new Map<string, HTMLCanvasElement>();

/** Seven serrated fingers share one petiole; the palette's textures are reused at every growth stage. */
function leafTexture(color: string): HTMLCanvasElement {
  const cached = leafTextures.get(color);
  if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 144;
  const c = canvas.getContext('2d')!;
  const size = 128;
  c.translate(64, 136);
  for (let finger = -3; finger <= 3; finger++) {
    const a = finger * 0.34;
    const length = size * (1 - Math.abs(finger) * 0.17);
    c.save(); c.rotate(a);
    const points = [[0, 0], [-length * 0.12, -length * 0.2], [-length * 0.09, -length * 0.3], [-length * 0.16, -length * 0.4], [-length * 0.1, -length * 0.5], [-length * 0.13, -length * 0.62], [-length * 0.06, -length * 0.68], [0, -length], [length * 0.06, -length * 0.68], [length * 0.13, -length * 0.62], [length * 0.1, -length * 0.5], [length * 0.16, -length * 0.4], [length * 0.09, -length * 0.3], [length * 0.12, -length * 0.2]];
    shape(c, points, color, Math.max(1, size * 0.022), '#173f35');
    line(c, [[0, 0], [0, -length * 0.86]], '#b7e56a', Math.max(0.7, size * 0.012)); c.restore();
  }
  leafTextures.set(color, canvas);
  return canvas;
}

export function leaf(c: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: string) {
  c.save(); c.translate(x, y); c.rotate(angle);
  c.drawImage(leafTexture(color), -size / 2, -size * 136 / 128, size, size * 144 / 128);
  c.restore();
}
