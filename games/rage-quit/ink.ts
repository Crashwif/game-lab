export const INK = '#26231f';
export const PAPER = '#f4efdf';
export const RED = '#e9422b';
export const GOLD = '#f7b43c';
export const GREEN = '#c7ddad';
export const clamp = (n: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, n));
export const ease = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };

type Point = readonly [number, number];

export function line(ctx: CanvasRenderingContext2D, points: readonly Point[], color = INK, width = 3): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function shape(ctx: CanvasRenderingContext2D, points: readonly Point[], fill: string, width = 3): void {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = PAPER, width = 3): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.strokeRect(x, y, w, h);
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 18, color = INK, maxWidth = 900, align: CanvasTextAlign = 'left'): void {
  ctx.font = `900 ${size}px "Arial Black", "Trebuchet MS", sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  ctx.fillText(text, x, y, maxWidth);
}

export function mono(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 14, color = INK, maxWidth = 900): void {
  ctx.font = `700 ${size}px ui-monospace, "Courier New", monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y, maxWidth);
}

export function mug(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, calm = false): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(27, -13, 11, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  shape(ctx, [[-20, -28], [22, -27], [18, 4], [-17, 4]], calm ? GREEN : PAPER, 3);
  label(ctx, calm ? 'ahh' : 'NO.', -1, -11, 13, INK, 34, 'center');
  for (let i = 0; i < 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-9 + i * 18, -37);
    ctx.bezierCurveTo(-17 + i * 18 + Math.sin(time * 2) * 4, -44, i * 18 + 5, -49, -7 + i * 18, -59);
    ctx.strokeStyle = '#a69c84';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

export function burst(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  const points: Point[] = [];
  for (let i = 0; i < 30; i += 1) {
    const a = i / 30 * Math.PI * 2;
    const r = i % 2 ? radius * 0.77 : radius;
    points.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.58]);
  }
  shape(ctx, points, color, 3);
}
