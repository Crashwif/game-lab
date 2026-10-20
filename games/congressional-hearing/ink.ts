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

/** The meme lettering size at which `text` fits `width` (letter spacing included), at most `size`. */
export function fitMeme(ctx: CanvasRenderingContext2D, text: string, size: number, width: number): number {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.letterSpacing = `${Math.round(size * 0.08)}px`;
  const w = ctx.measureText(text).width;
  ctx.letterSpacing = '0px';
  return w > width ? Math.floor(size * (width / w)) : size;
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
export interface BubblePlace { x: number; y: number; tail: { x: number; y: number }; width: number; name?: string; fill?: string; font?: string; lineHeight?: number }

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
  const lh = at.lineHeight ?? 21;
  const w = Math.min(at.width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
  const h = lines.length * lh + 16 + (at.name ? 12 : 0);
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
  lines.forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 8 + lh / 2 + i * lh));
  if (at.name) {
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.fillStyle = '#7a4a1f';
    ctx.fillText(`— ${at.name.toUpperCase()}`, 0, h / 2 - 9, w - 12);
  }
  ctx.restore();
}

// ─── The room's geometry, shared by the set, the cast and the scene ────────────────────────────────────────

/** The dais: a curved bench whose ends come toward the witness, so its ends sit lower in the picture. */
export const DAIS = { left: 128, right: 832, top: 318, sag: 22, bottom: 404, bottomSag: 24 } as const;
const across = (x: number): number => clamp((x - 480) / 352, -1, 1);
/** The bench top's near edge at `x`. */
export const daisTop = (x: number): number => DAIS.top + DAIS.sag * across(x) ** 2;
/** Where the dais front meets the floor at `x`. */
export const daisFoot = (x: number): number => DAIS.bottom + DAIS.bottomSag * across(x) ** 2;
/** The senators in seniority order, dais left to right: where each sits and how near the camera. */
export const SEAT_X = { marcus: 210, vance: 345, ruiz: 480, howe: 615, bell: 750 } as const;
export const seatScale = (x: number): number => 0.93 + 0.1 * across(x) ** 2;
/** The side walls meet the carpet here (the dais hides the line in the middle). */
export const WALL_FOOT = 416;
/** The window cutaway at the left frame edge, with Senator Vance's two boats in it. */
export const WINDOW = { x: -6, y: 104, w: 124, h: 136 } as const;
/** The minutes board on the right wall: the stack grows up from `bottom` toward `top`. */
export const BOARD = { x: 866, w: 88, top: 104, bottom: 432 } as const;
export const PAGE_W = 60;
export const PAGE_H = 78;
/** The witness: the chair seat under the hood, the table in front of it, the phone and the card on the table. */
export const WITNESS = { x: 480, y: 474 } as const;
export const TABLE = { left: 326, right: 634, far: 420, near: 442 } as const;
export const PHONE = { x: 606, y: 431 } as const;
export const CARD = { x: 372, y: 432 } as const;
/** The clerk's desk (with the bouquet), the stenographer's chair, the sergeant's spot; feet lines. */
export const CLERK = { x: 166, y: 470, top: 424 } as const;
export const STENO = { x: 818, y: 468 } as const;
export const TYPEWRITER = { x: 752, y: 420 } as const;
export const SERGEANT = { x: 62, y: 474 } as const;
/** The page runs along this line, in front of the dais and behind the desks. */
export const PAGE_FEET = 432;
/** Where the page stops for the Chairman, the witness table and the clerk's desk. */
export const PAGE_STOPS = { chair: 292, witness: 360, clerk: 236, steno: 690 } as const;

/**
 * The crash's choreography on the crash clock (seconds since the crash). Live, the next betting window opens about
 * two seconds after a crash, so beats 1–4 land inside two seconds and the final image is complete by ENDING_S; the
 * scene plays whatever is left as an encore over the start of betting.
 */
export const CRASH = {
  /** Every gallery screen red and every card REKT in one frame. */
  gallery: 0.3,
  /** The bottom page is pulled, then the stack comes off the board as one sheet and folds onto the floor. */
  tug: 0.55,
  fall: 0.75,
  fallFor: 0.6,
  /** The Chairman's last line with the gavel up; the gavel misses the block. */
  lastLine: 0.9,
  miss: 1.9,
  /** The watch beeps; the sergeant walks to the clerk's desk, lifts the bouquet, and it is in the page's arms. */
  beep: 2.1,
  walk: 2.3,
  lift: 2.8,
  handed: 3.4,
  /** The page runs in for the bouquet, then on to the witness table with the card. */
  pageIn: 2.1,
  toWitness: 3.5,
  /** Vance's boats turn red. */
  boats: 3,
  /** The card on the table; the witness stands; his shadow walks out of the frame. */
  card: 4.3,
  stand: 4.4,
  out: 4.7,
  gone: 6,
} as const;
/** The final image is complete by here. */
export const ENDING_S = 6;
