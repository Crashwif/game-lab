/**
 * The shared ink of Yes Men: the outline colour, the meme and bubble lettering, text wrapping and the room's
 * geometry on the 960 × 540 canvas, so the room, the cast and the scene agree on where everything sits.
 */
import { clamp } from './motion';

export const INK = '#1c1420';
export const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
export const BUBBLE_FONT = '600 17px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** The long table in perspective: the far edge behind the Leader's chair, the near edge at the player's. */
export const TABLE = { far: 302, near: 474, farLeft: 386, farRight: 574, nearLeft: 208, nearRight: 752 } as const;
/** The Leader: the base of his neck at the far end, and the TOTAL CONTROL button on the table before him. */
export const LEADER = { x: 480, y: 262 } as const;
export const BUTTON = { x: 480, y: 330 } as const;
/** The stamped decrees pile up at his right hand (our left). */
export const DECREES = { x: 404, y: 336 } as const;
/** The door out, on the back wall; the floor starts where the wall ends. */
export const DOOR = { x: 850, y: 104, w: 82, h: 198 } as const;
export const FLOOR_Y = 302;
/** The player's seat: the chair's foot at the near edge, back to the camera. */
export const YOU = { x: 480, y: 506 } as const;
/** The ministers' seats along the sides: the hip point, the scale with nearness, and which way they face. */
export interface Seat { x: number; y: number; s: number; side: 1 | -1 }
export const SEATS: readonly Seat[] = [
  { x: 332, y: 322, s: 0.72, side: 1 },
  { x: 628, y: 322, s: 0.72, side: -1 },
  { x: 290, y: 372, s: 0.84, side: 1 },
  { x: 670, y: 372, s: 0.84, side: -1 },
  { x: 236, y: 430, s: 0.97, side: 1 },
  { x: 724, y: 430, s: 0.97, side: -1 },
];
export const TITLES = ['Minister of Agreement', 'Secretary of Yes', 'Chief Nodder', 'Head of Applause', 'Vibes Czar', 'Ministry of Truth (acting)'];

/** The table's edge at height `y`, on the left (`side` 1) or the right. */
export function tableEdge(y: number, side: 1 | -1): number {
  const t = clamp((y - TABLE.far) / (TABLE.near - TABLE.far), 0, 1);
  return side === 1 ? TABLE.farLeft + (TABLE.nearLeft - TABLE.farLeft) * t : TABLE.farRight + (TABLE.nearRight - TABLE.farRight) * t;
}

export function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
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
  ctx.stroke();
}
