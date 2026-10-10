/**
 * The shared ink: the outline colour, the meme and bubble lettering, text wrapping, outlined shapes and the
 * speech bubbles, so the set, the cast and the HUD agree on one look. Everything draws in the 960 × 540 space.
 */
import { clamp } from './motion';

export const INK = '#1d1418';
export const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
export const BUBBLE_FONT = '600 17px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const THOUGHT_FONT = 'italic 600 16px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const LABEL_FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export function ink(ctx: CanvasRenderingContext2D, width = 2.5, colour = INK): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Meme caption lettering: heavy, bordered, tracked so Impact's letters don't fuse. */
export function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.letterSpacing = `${Math.round(size * 0.08)}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.11);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
  ctx.letterSpacing = '0px';
}

/** Plain centred lettering on a prop (a ribbon, a sign, a screen), squeezed to `maxWidth`. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, weight = 700, maxWidth?: number, align: CanvasTextAlign = 'center'): void {
  ctx.font = `${weight} ${size}px ${LABEL_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** Breaks `text` into lines no wider than `width` in the current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** A filled, outlined rounded box. */
export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, width = 2.5): void {
  ctx.fillStyle = fill;
  ink(ctx, width);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  if (width > 0) ctx.stroke();
}

/** A filled, outlined ellipse. */
export function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, width = 2.5, rotation = 0): void {
  ctx.fillStyle = fill;
  ink(ctx, width);
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, Math.PI * 2);
  ctx.fill();
  if (width > 0) ctx.stroke();
}

/** A filled, outlined polygon through `points` ([x0, y0, x1, y1, ...]). */
export function poly(ctx: CanvasRenderingContext2D, points: readonly number[], fill: string | null, width = 2.5): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (width > 0) {
    ink(ctx, width);
    ctx.stroke();
  }
}

/** An outlined limb or rope: a thick stroke in `fill` over a slightly thicker ink stroke, through the points. */
export function limb(ctx: CanvasRenderingContext2D, points: readonly { x: number; y: number }[], thickness: number, fill: string, outline = 2.5): void {
  if (points.length < 2) return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i]!.x, points[i]!.y);
  if (outline > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = thickness + outline * 2;
    ctx.stroke();
  }
  ctx.strokeStyle = fill;
  ctx.lineWidth = thickness;
  ctx.stroke();
}

/** Where a bubble sits: its centre, the point its tail reaches, its widest line, and an optional name under it. */
export interface BubblePlace { x: number; y: number; tail: { x: number; y: number }; width: number; name?: string; fill?: string; font?: string }

/**
 * A speech bubble (or a thought cloud) centred on `at`, scaled by `pop` (0 → 1, overshoot allowed) and faded by
 * `alpha`, with its tail pointing at the speaker.
 */
export function drawBubble(ctx: CanvasRenderingContext2D, text: string, at: BubblePlace, pop: number, alpha: number, thought = false): void {
  if (alpha <= 0.01 || pop <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha, 0, 1);
  ctx.translate(at.x, at.y);
  const s = clamp(pop, 0, 1.2);
  ctx.scale(s, s);
  ctx.font = at.font ?? (thought ? THOUGHT_FONT : BUBBLE_FONT);
  const lines = wrap(ctx, text, at.width - 28);
  const w = Math.min(at.width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
  const h = lines.length * 21 + 16 + (at.name ? 12 : 0);
  ctx.fillStyle = at.fill ?? (thought ? '#e8eef9' : '#fbf6ea');
  ink(ctx, 2.5);
  const tx = at.tail.x - at.x;
  const ty = at.tail.y - at.y;
  if (thought) {
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 18);
    ctx.fill();
    ctx.stroke();
    for (const [k, rr] of [[0.35, 6], [0.62, 4], [0.84, 2.5]] as const) {
      ctx.beginPath();
      ctx.arc(tx * k, ty * k, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 12);
    ctx.fill();
    ctx.stroke();
    // The tail leaves from the edge nearest the speaker.
    const vertical = Math.abs(ty) * w > Math.abs(tx) * h;
    ctx.beginPath();
    if (vertical) {
      const bx = clamp(tx * 0.5, -w / 2 + 16, w / 2 - 16);
      const by = Math.sign(ty || 1) * h / 2;
      ctx.moveTo(bx - 9, by);
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx + 9, by);
    } else {
      const bx = Math.sign(tx || 1) * w / 2;
      const by = clamp(ty * 0.5, -h / 2 + 12, h / 2 - 12);
      ctx.moveTo(bx, by - 8);
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx, by + 8);
    }
    ctx.fill();
    ctx.stroke();
    // Cover the box outline where the tail joins it.
    ctx.beginPath();
    if (vertical) {
      const bx = clamp(tx * 0.5, -w / 2 + 16, w / 2 - 16);
      const by = Math.sign(ty || 1) * (h / 2 - 1.5);
      ctx.moveTo(bx - 7.5, by);
      ctx.lineTo(bx + 7.5, by);
    } else {
      const bx = Math.sign(tx || 1) * (w / 2 - 1.5);
      const by = clamp(ty * 0.5, -h / 2 + 12, h / 2 - 12);
      ctx.moveTo(bx, by - 6.5);
      ctx.lineTo(bx, by + 6.5);
    }
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 18 + i * 21));
  if (at.name) {
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.fillStyle = '#7a4a1f';
    ctx.fillText(`— ${at.name.toUpperCase()}`, 0, h / 2 - 9, w - 12);
  }
  ctx.restore();
}

/** The size `drawBubble` will draw `text` at in `place`, for laying bubbles out before drawing them. */
export function measureBubble(ctx: CanvasRenderingContext2D, text: string, at: Pick<BubblePlace, 'width' | 'name' | 'font'>, thought = false): { w: number; h: number } {
  ctx.font = at.font ?? (thought ? THOUGHT_FONT : BUBBLE_FONT);
  const lines = wrap(ctx, text, at.width - 28);
  const w = Math.min(at.width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
  return { w, h: lines.length * 21 + 16 + (at.name ? 12 : 0) };
}

/** A static piece painted once into an offscreen canvas at the frame's pixel density, in the 960 × 540 space. */
export interface Sprite { canvas: HTMLCanvasElement; scale: number; x: number; y: number; w: number; h: number }
const sprites = new Map<string, Sprite | null>();

/** Returns the sprite for `key`, painting it on first use (or when the pixel density changes); null without a DOM. */
export function sprite(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Sprite | null {
  if (typeof document === 'undefined') return null;
  const width = (ctx.canvas as HTMLCanvasElement | undefined)?.width ?? 960;
  const scale = clamp(Math.round((width / 960) * 4) / 4, 1, 2.5);
  const known = sprites.get(key);
  if (known !== undefined && (known === null || known.scale === scale)) return known;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const g = c.getContext('2d');
  let made: Sprite | null = null;
  if (g) {
    g.scale(scale, scale);
    g.translate(-x, -y);
    paint(g);
    made = { canvas: c, scale, x, y, w, h };
  }
  sprites.set(key, made);
  return made;
}

/** Draws a cached static piece at its place, or paints it directly where there is no DOM. */
export function blit(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): void {
  const s = sprite(ctx, key, x, y, w, h, paint);
  if (s) ctx.drawImage(s.canvas, x, y, w, h);
  else paint(ctx);
}
