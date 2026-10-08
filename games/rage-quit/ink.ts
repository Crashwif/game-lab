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

/** Original ink character; expression is presentation, independent of the round result. */
export function face(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rage: number, scream: boolean, calm: boolean, wobble = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wobble);
  ctx.scale(scale, scale);
  ctx.fillStyle = calm ? '#e9efd8' : rage > 0.55 ? '#f3d2b6' : '#fff9e9';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(-49, -51);
  ctx.bezierCurveTo(-26, -80, 26, -81, 50, -49);
  ctx.bezierCurveTo(68, -32, 72, 3, 57, 30);
  ctx.lineTo(47, 60);
  ctx.bezierCurveTo(16, 80, -30, 69, -46, 50);
  ctx.lineTo(-57, 21);
  ctx.bezierCurveTo(-74, -5, -65, -35, -49, -51);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Uneven contours and hatching give the face a pen-drawn silhouette.
  line(ctx, [[-48, -55], [-36, -62], [-20, -65]], INK, 2);
  line(ctx, [[37, 54], [24, 62], [11, 64]], INK, 2);
  line(ctx, [[-55, 25], [-47, 30], [-42, 39]], INK, 2);
  for (let i = 0; i < 4; i += 1) {
    line(ctx, [[-53 + i * 5, 6], [-48 + i * 5, 20]], '#aa6d56', 1.4);
    line(ctx, [[33 + i * 5, 6], [29 + i * 5, 20]], '#aa6d56', 1.4);
  }
  if (calm) {
    ctx.beginPath();
    ctx.ellipse(-25, -17, 14, 8, 0.15, Math.PI, 2 * Math.PI);
    ctx.ellipse(24, -17, 14, 8, -0.15, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-21, 25);
    ctx.quadraticCurveTo(4, 48, 27, 22);
    ctx.stroke();
    line(ctx, [[-3, -10], [-8, 8], [5, 10]], INK, 3);
  } else {
    const brow = rage * 13;
    shape(ctx, [[-47, -30], [-9, -22 + brow], [-9, -5], [-43, -9]], PAPER, 3);
    shape(ctx, [[12, -21 + brow], [46, -30], [44, -9], [11, -4]], PAPER, 3);
    ctx.fillStyle = INK;
    ctx.fillRect(-24, -17 + rage * 4, 7, 10 - rage * 3);
    ctx.fillRect(23, -17 + rage * 4, 7, 10 - rage * 3);
    line(ctx, [[-47, -37], [-10, -27 + brow]], INK, 6);
    line(ctx, [[12, -26 + brow], [48, -38]], INK, 6);
    line(ctx, [[2, -16], [-8, 8], [7, 11]], INK, 3);
    if (scream) {
      ctx.beginPath();
      ctx.moveTo(-31, 29);
      ctx.bezierCurveTo(-12, 15, 15, 16, 34, 26);
      ctx.lineTo(22, 56);
      ctx.quadraticCurveTo(1, 65, -22, 52);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      shape(ctx, [[-27, 29], [30, 27], [25, 37], [-24, 38]], '#fffaf0', 2);
      for (let i = 0; i < 5; i += 1) line(ctx, [[-17 + i * 9, 29], [-17 + i * 9, 37]], INK, 1.5);
      shape(ctx, [[-12, 52], [3, 45], [17, 50], [14, 56], [-7, 55]], RED, 1);
    } else {
      line(ctx, [[-30, 29], [-11, 25 + rage * 4], [10, 31], [31, 26]], INK, 4);
      line(ctx, [[-20, 42], [0, 45], [19, 41]], INK, 2);
    }
    if (rage > 0.25) {
      line(ctx, [[29, -49], [35, -40], [42, -43]], RED, 4);
      line(ctx, [[37, -58], [38, -50], [49, -52]], RED, 3);
    }
    if (rage > 0.6) {
      line(ctx, [[-25, -50], [-12, -48], [-7, -39]], INK, 2);
      line(ctx, [[-26, -58], [-10, -57], [-3, -48]], INK, 2);
    }
  }
  ctx.restore();
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
