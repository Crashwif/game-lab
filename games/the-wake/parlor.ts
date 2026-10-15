/**
 * The parlor of The Wake at half past four: plum damask walls and a walnut wainscot, late light through
 * venetian blinds laid in stripes across the room, a window onto the driveway (the gravediggers, the hearse,
 * later the cousin's rideshare), the side door with its EXIT sign, Gerald's networking-site headshot with the
 * laser-eye filter, two candle-chart wreaths with their ribbons, the casket on its draped bier (closed to the
 * audience: only the folded hands and the glowing phone show over the rim), too many lilies, the HOLDERS guest
 * book on its stand, the reception table with the HODL sheet cake, and the crash's props: the push
 * notification, the moth from the empty ledger. Drawn on the 960 × 540 canvas; the static backdrop is
 * painted once to an offscreen canvas. Presentation only: nothing here reads or changes the outcome.
 */
import { blob, box, ink, INK, label, MEME_FONT, poly } from './ink';
import { clamp, fract, gust, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

// ─── Layout ─────────────────────────────────────────────────────────────────────────────────────────────
/** Where the back wall meets the carpet. */
const FLOOR = 330;
const WIN = { x: 96, y: 74, w: 204, h: 170 } as const;
export const DOOR = { x: 12, y: 134, w: 72, h: 196 } as const;
const PORTRAIT = { x: 480, y: 128, w: 112, h: 118 } as const;
export const CASKET = { l: 338, r: 622, rim: 258, base: 316, floor: 388, split: 488 } as const;
export const WREATHS = [
  { x: 302, y: 210, r: 46, text: 'DIAMOND HANDS' },
  { x: 658, y: 210, r: 46, text: 'WEN RESURRECTION' },
] as const;
export const LECTERN = { x: 808, top: 314, floor: 394 } as const;
export const STAND = { x: 120, top: 360, floor: 438 } as const;
const TABLE = { top: 452, front: 486, right: 132 } as const;
/** The phone in the casket, held upright in the folded hands. */
export const PHONE = { x: 468, y: 232, w: 22, h: 36 } as const;
const VASE = { x: 904, floor: 392 } as const;
const BASKET = { x: 356, floor: 392 } as const;

const WALL = '#5d4256';
const LIGHT = 'rgba(255, 207, 122, ';
const SKIN = '#e9cdb4';

// ─── Crash timing (seconds of the crash clock, which the hit-stop holds back by about half a second) ─────
/** Front-loaded so a live player sees beats 1–4 inside the ~2 s crash hold; the rest plays on in the encore. */
export const CRASH_AT = {
  /** The notification card is up from here until it folds back into the phone. */
  card: [0.02, 1.6],
  laser: [0.22, 0.5],
  ribbons: 0.5,
  leaves: 0.55,
  book: [0.85, 1.3],
  moth: [1.25, 3.0],
  lastPage: [3.4, 3.8],
  hearse: [3.5, 4.4],
  /** The phone dies. */
  dark: 3.8,
  coda: 3.8,
} as const;

// ─── State ──────────────────────────────────────────────────────────────────────────────────────────────
export interface ParlorDrive {
  multiplier: number;
  tension: number;
  /** Running and not crashed. */
  live: boolean;
  /** The ambient clock: it holds still once the crash's final image is reached. */
  amb: number;
  /** Seconds since the crash, or -1. */
  ct: number;
  /** Seconds since the accepted exit (large when it was settled), or -1. */
  exitAge: number;
}

interface Leaf { a: number; r: number; len: number; wid: number; tint: number; tilt: number }

export interface Parlor {
  /** The guest book: an integrated flip phase, pages turned, and seconds into the current flip. */
  pageClock: number;
  pages: number;
  flipT: number;
  /** The leaf that curls at 5×, the gravediggers stopping to watch, their shovel phase, their phones. */
  curl: Spring;
  watch: Spring;
  dig: number;
  phones: Spring;
  /** The memorial-wallet placard (2.1×) and the REPO sticker on the hearse (12×). */
  qr: Spring;
  repo: Spring;
  /** Seeded at the crash: when each ribbon unrolls and when each leaf wilts (and whether it falls). */
  ribbonAt: number[];
  leafAt: number[][];
  leafDrops: boolean[][];
  events: { flip: boolean };
}

const FLIP_S = 0.6;
/** The leaves of each wreath, laid out once with a fixed seed so every round's wreath is the same. */
const LEAVES: Leaf[][] = [0, 1].map((w) => {
  const r = mulberry32(0x1ea7 + w * 31);
  return Array.from({ length: 30 }, (_, i) => ({
    a: (i / 30) * Math.PI * 2 + (r() - 0.5) * 0.18,
    r: 1 + (r() - 0.5) * 0.16,
    len: 12 + r() * 4,
    wid: 4.5 + r() * 2,
    tint: Math.floor(r() * 3),
    tilt: (r() - 0.5) * 0.5,
  }));
});
const LEAF_GREENS = ['#4f7d3f', '#3f6b35', '#6a9a4f'];
/** The leaf that curls first, on the right-hand wreath, low on the ring where the light reaches it. */
const CURL_LEAF = 7;

export function createParlor(): Parlor {
  return {
    pageClock: 0, pages: 0, flipT: FLIP_S, curl: spring(0), watch: spring(0), dig: 0, phones: spring(0), qr: spring(0), repo: spring(0),
    ribbonAt: [], leafAt: [], leafDrops: [], events: { flip: false },
  };
}

export function resetParlor(p: Parlor): void {
  Object.assign(p, createParlor());
}

const watchFor = (tension: number): number => smoothstep(0.32, 0.62, tension);

/** Jumps the set to where a round at this multiplier has it, for a scene that missed the start. */
export function settleParlor(p: Parlor, d: ParlorDrive, elapsed: number): void {
  settleSpring(p.curl, d.multiplier >= 5 ? 1 : 0);
  settleSpring(p.watch, watchFor(d.tension));
  settleSpring(p.phones, d.multiplier >= 20 ? 1 : 0);
  settleSpring(p.qr, d.multiplier >= 2.1 ? 1 : 0);
  settleSpring(p.repo, d.multiplier >= 12 ? 1 : 0);
  // The pages the wind has turned by now: roughly the integral of the flip rate.
  p.pages = Math.min(40, Math.floor(elapsed * (0.05 + 0.25 * d.tension)));
}

/** Seeds the crash's order from the crash point (known only now): which ribbon unrolls first, which leaf wilts next. */
export function crashParlor(p: Parlor, crashX100: number): void {
  const r = mulberry32(crashX100 * 7 + 11);
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  p.ribbonAt = [0, 0, 0, 0];
  order.forEach((ribbon, k) => (p.ribbonAt[ribbon] = CRASH_AT.ribbons + k * 0.18 + r() * 0.05));
  p.leafAt = LEAVES.map((leaves) => leaves.map(() => CRASH_AT.leaves + r() * 1.8));
  p.leafDrops = LEAVES.map((leaves) => leaves.map(() => r() < 0.45));
}

export function stepParlor(p: Parlor, d: ParlorDrive, dt: number): void {
  p.events.flip = false;
  // The guest book turns its own pages, faster with the tension. Wind, or something.
  if (d.live) {
    p.pageClock += dt * (0.05 + 0.32 * d.tension * d.tension);
    if (p.pageClock >= 1 && p.flipT >= FLIP_S) {
      p.pageClock -= 1;
      p.flipT = 0;
      p.events.flip = true;
    }
  }
  if (p.flipT < FLIP_S) {
    p.flipT += dt;
    if (p.flipT >= FLIP_S) p.pages += 1;
  }
  stepSpring(p.curl, d.live && d.multiplier >= 5 ? 1 : d.ct >= 0 ? p.curl.x : 0, 3, 0.7, dt);
  const watching = d.ct >= 0 ? 1 : d.live ? watchFor(d.tension) : 0;
  stepSpring(p.watch, watching, 3.5, 0.9, dt);
  p.dig += dt * (1.3 + 0.6 * d.tension) * (1 - clamp(p.watch.x, 0, 1));
  stepSpring(p.phones, d.live && d.multiplier >= 20 ? 1 : d.ct >= 0 ? p.phones.x : 0, 5, 0.8, dt);
  stepSpring(p.qr, (d.live && d.multiplier >= 2.1) || (d.ct >= 0 && p.qr.x > 0.5) ? 1 : 0, 12, 0.45, dt);
  stepSpring(p.repo, (d.live && d.multiplier >= 12) || (d.ct >= 0 && p.repo.x > 0.5) ? 1 : 0, 12, 0.45, dt);
}

/** A 0..1 window over [a, b] eased with smoothstep. */
const span = (t: number, a: number, b: number): number => smoothstep(a, b, t);

// ─── Glow sprites (a radial gradient painted once per colour, then stamped) ─────────────────────────────
const sprites = new Map<string, HTMLCanvasElement>();
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: readonly [number, number, number], alpha: number): void {
  if (alpha <= 0.01 || typeof document === 'undefined') return;
  const key = rgb.join(',');
  let sprite = sprites.get(key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const g = sprite.getContext('2d');
    if (!g) return;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${key}, 1)`);
    grad.addColorStop(0.45, `rgba(${key}, 0.45)`);
    grad.addColorStop(1, `rgba(${key}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites.set(key, sprite);
  }
  ctx.save();
  ctx.globalAlpha *= clamp(alpha, 0, 1);
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// ─── Stamps: static art painted once to an offscreen canvas, then drawn as an image ─────────────────────
const stamps = new Map<string, { image: CanvasImageSource; k: number }>();

/**
 * Draws `paint` translated to (x, y) through a cached offscreen image that covers the local rectangle
 * (l, t, w, h), painted once per key at the canvas's resolution. Without a document it paints directly.
 */
export function stamp(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, l: number, t: number, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): void {
  const k = clamp((ctx.canvas?.width || 960) / 960, 1, 2);
  let entry = stamps.get(key);
  if ((!entry || entry.k !== k) && typeof document !== 'undefined') {
    const cw = Math.ceil(w * k);
    const ch = Math.ceil(h * k);
    // An ImageBitmap where the browser can make one (a static image draws faster than a canvas), else a canvas.
    const off = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(cw, ch) : null;
    const offContext = off ? (off.getContext('2d') as unknown as CanvasRenderingContext2D | null) : null;
    const canvas = offContext ? null : document.createElement('canvas');
    if (canvas) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const g = offContext ?? canvas?.getContext('2d') ?? null;
    if (g) {
      g.setTransform(k, 0, 0, k, -l * k, -t * k);
      paint(g);
      entry = { image: offContext && off ? off.transferToImageBitmap() : canvas!, k };
      stamps.set(key, entry);
    }
  }
  if (entry && entry.k === k) {
    ctx.drawImage(entry.image, x + l, y + t, w, h);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  paint(ctx);
  ctx.restore();
}

/** Draws the static room: walls, wainscot, carpet, the view out of the window, the door casing, the sconces, the clock face and the portrait's photograph. */
export function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  stamp(ctx, 'backdrop', 0, 0, 0, 0, 960, 540, paintBackdrop);
}

function paintBackdrop(ctx: CanvasRenderingContext2D): void {
  // The wall: plum damask in stripes, darker toward the ceiling and the corners.
  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, 960, FLOOR);
  for (let x = 0; x < 960; x += 48) {
    ctx.fillStyle = '#634860';
    ctx.fillRect(x, 0, 22, 270);
  }
  ctx.fillStyle = '#6f5369';
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 21; col += 1) {
      const x = col * 48 + 11 + (row % 2) * 24;
      const y = 26 + row * 36;
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.quadraticCurveTo(x + 6, y - 2, x, y + 7);
      ctx.quadraticCurveTo(x - 6, y - 2, x, y - 7);
      ctx.fill();
      ctx.fillRect(x - 0.75, y + 7, 1.5, 4);
    }
  }
  const shade = ctx.createLinearGradient(0, 0, 0, 120);
  shade.addColorStop(0, 'rgba(25, 12, 22, 0.55)');
  shade.addColorStop(1, 'rgba(25, 12, 22, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 960, 120);
  for (const [x0, x1] of [[0, 140], [960, 820]] as const) {
    const side = ctx.createLinearGradient(x0, 0, x1, 0);
    side.addColorStop(0, 'rgba(25, 12, 22, 0.35)');
    side.addColorStop(1, 'rgba(25, 12, 22, 0)');
    ctx.fillStyle = side;
    ctx.fillRect(Math.min(x0, x1), 0, 140, FLOOR);
  }
  // Crown moulding.
  ctx.fillStyle = '#3b2733';
  ctx.fillRect(0, 0, 960, 14);
  ctx.fillStyle = '#c9b38f';
  ctx.fillRect(0, 14, 960, 3);
  ctx.fillStyle = '#3b2733';
  ctx.fillRect(0, 17, 960, 4);
  // The wainscot: a chair rail and walnut panels.
  ctx.fillStyle = '#3c2620';
  ctx.fillRect(0, 270, 960, FLOOR - 270);
  ctx.fillStyle = '#6e4a35';
  ctx.fillRect(0, 266, 960, 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-2, 266, 964, 7);
  for (let x = 6; x < 960; x += 64) {
    ctx.fillStyle = '#47302a';
    ctx.fillRect(x, 282, 52, 38);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(x + 0.5, 282.5, 51, 37);
  }
  ctx.fillStyle = '#2a1a16';
  ctx.fillRect(0, FLOOR - 6, 960, 6);
  // The carpet, with the aisle runner from the casket to the back of the room.
  ctx.fillStyle = '#5c2c3b';
  ctx.fillRect(0, FLOOR, 960, 540 - FLOOR);
  ctx.fillStyle = '#683446';
  for (let row = 0; row < 9; row += 1) {
    const y = FLOOR + 10 + row * row * 3.2 + row * 14;
    const step = 40 + row * 9;
    for (let x = (row % 2) * step * 0.5; x < 980; x += step) {
      const s = 3 + row * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 1.6, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 1.6, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  const depth = ctx.createLinearGradient(0, FLOOR, 0, 420);
  depth.addColorStop(0, 'rgba(20, 8, 14, 0.5)');
  depth.addColorStop(1, 'rgba(20, 8, 14, 0)');
  ctx.fillStyle = depth;
  ctx.fillRect(0, FLOOR, 960, 90);
  ctx.fillStyle = '#7e3c4d';
  ctx.beginPath();
  ctx.moveTo(420, CASKET.floor - 6);
  ctx.lineTo(540, CASKET.floor - 6);
  ctx.lineTo(640, 540);
  ctx.lineTo(320, 540);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b08a4e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(424, CASKET.floor - 6);
  ctx.lineTo(328, 540);
  ctx.moveTo(536, CASKET.floor - 6);
  ctx.lineTo(632, 540);
  ctx.stroke();

  paintOutside(ctx);
  // The window's casing and sill (the blinds and the glass are drawn live, over whatever moves outside).
  box(ctx, WIN.x - 10, WIN.y - 10, WIN.w + 20, 10, 2, '#3c2620', 2.5);
  // The side door's casing, its dark panel and the EXIT sign.
  box(ctx, DOOR.x - 8, DOOR.y - 10, DOOR.w + 16, DOOR.h + 10, 3, '#3c2620', 2.5);
  ctx.fillStyle = '#20140f';
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  box(ctx, DOOR.x + 10, DOOR.y - 38, DOOR.w - 20, 20, 3, '#2a1214', 2.5);
  glowRect(ctx, DOOR.x + 14, DOOR.y - 34, DOOR.w - 28, 12);
  ctx.font = `900 11px ${MEME_FONT}`;
  ctx.fillStyle = '#ff6b6b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', DOOR.x + DOOR.w / 2, DOOR.y - 27.5);
  // Brass sconces either side of the portrait, with their warm pools on the wallpaper.
  for (const x of [372, 588]) {
    const pool = ctx.createRadialGradient(x, 104, 2, x, 104, 70);
    pool.addColorStop(0, 'rgba(255, 214, 150, 0.4)');
    pool.addColorStop(1, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = pool;
    ctx.fillRect(x - 70, 34, 140, 140);
    box(ctx, x - 4, 112, 8, 18, 2, '#b08a4e', 2);
    poly(ctx, [x - 13, 92, x + 13, 92, x + 8, 112, x - 8, 112], '#f6e2b8', 2);
  }
  // The clock: half past four.
  blob(ctx, 902, 106, 21, 21, '#3c2620', 2.5);
  blob(ctx, 902, 106, 16, 16, '#f4ead6', 1.5);
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(902, 106);
  ctx.lineTo(902 + Math.sin(Math.PI * 0.75) * 8, 106 - Math.cos(Math.PI * 0.75) * 8);
  ctx.moveTo(902, 106);
  ctx.lineTo(902, 106 + 12);
  ctx.stroke();
  paintPortraitPhoto(ctx);
}

/** A tiny glow behind the EXIT letters. */
function glowRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(255, 60, 60, 0.25)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
}

/** The view out of the window: a late-afternoon sky, a line of trees, the cemetery lawn, the dug grave and the driveway. */
function paintOutside(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, WIN.y, 0, 160);
  sky.addColorStop(0, '#a9a3c6');
  sky.addColorStop(0.6, '#e9bf96');
  sky.addColorStop(1, '#f7d59a');
  ctx.fillStyle = sky;
  ctx.fillRect(WIN.x, WIN.y, WIN.w, 90);
  // The low sun, behind the trees.
  const sun = ctx.createRadialGradient(276, 138, 2, 276, 138, 60);
  sun.addColorStop(0, 'rgba(255, 238, 190, 0.95)');
  sun.addColorStop(1, 'rgba(255, 238, 190, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(WIN.x, WIN.y, WIN.w, 100);
  ctx.fillStyle = '#5b6b5a';
  ctx.beginPath();
  ctx.moveTo(WIN.x, 156);
  for (let x = WIN.x; x <= WIN.x + WIN.w + 10; x += 14) ctx.quadraticCurveTo(x + 7, 132 + noise(x) * 12, x + 14, 150 + noise(x + 3) * 4);
  ctx.lineTo(WIN.x + WIN.w, 160);
  ctx.lineTo(WIN.x, 160);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#86a15e';
  ctx.fillRect(WIN.x, 154, WIN.w, 46);
  ctx.fillStyle = 'rgba(60, 70, 40, 0.35)';
  for (let i = 0; i < 5; i += 1) ctx.fillRect(WIN.x, 160 + i * 9, WIN.w, 2);
  // Headstones in rows, their long evening shadows thrown to the left.
  for (let i = 0; i < 7; i += 1) {
    const x = WIN.x + 12 + i * 27 + (i % 2) * 6;
    const y = 158 + (i % 3) * 3;
    ctx.fillStyle = 'rgba(40, 50, 30, 0.35)';
    ctx.fillRect(x - 14, y + 8, 14, 2);
    box(ctx, x, y, 8, 10, 3, '#a8a6a4', 1.2);
  }
  // The fresh grave, its dirt heaped beside it.
  ctx.fillStyle = '#2c1f17';
  ctx.beginPath();
  ctx.ellipse(206, 181, 17, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  poly(ctx, [220, 183, 228, 171, 240, 167, 252, 173, 258, 183], '#7a5536', 1.5);
  // The driveway, gravel, with the curb along the lawn.
  ctx.fillStyle = '#cbb898';
  ctx.fillRect(WIN.x, 200, WIN.w, 50);
  ctx.fillStyle = '#b8a482';
  for (let i = 0; i < 40; i += 1) ctx.fillRect(WIN.x + noise(i * 2.3) * WIN.w, 204 + noise(i * 5.1) * 40, 2, 1.2);
  ctx.fillStyle = '#9d9a8c';
  ctx.fillRect(WIN.x, 198, WIN.w, 3);
  ctx.restore();
}

/** Gerald's networking-site headshot: a soft studio backdrop, a navy suit, a red tie and a confident, generic face. */
function paintPortraitPhoto(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = PORTRAIT;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w / 2 + 6, y - h / 2 + 8, w, h);
  box(ctx, x - w / 2, y - h / 2, w, h, 4, '#2b1a14', 3);
  box(ctx, x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 2, '#b08a4e', 2);
  const inner = { l: x - w / 2 + 11, t: y - h / 2 + 11, w: w - 22, h: h - 22 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.l, inner.t, inner.w, inner.h);
  ctx.clip();
  const bg = ctx.createRadialGradient(x, y - 16, 4, x, y - 6, 70);
  bg.addColorStop(0, '#9fb3c8');
  bg.addColorStop(1, '#4b6582');
  ctx.fillStyle = bg;
  ctx.fillRect(inner.l, inner.t, inner.w, inner.h);
  drawGeraldBust(ctx, x, y + 6);
  ctx.restore();
  // The mourning ribbon across the corner.
  ctx.fillStyle = '#121014';
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 26, y - h / 2);
  ctx.lineTo(x + w / 2 - 12, y - h / 2);
  ctx.lineTo(x + w / 2, y - h / 2 + 12);
  ctx.lineTo(x + w / 2, y - h / 2 + 26);
  ctx.closePath();
  ctx.fill();
  // The name plate.
  box(ctx, x - 50, y + h / 2 + 4, 100, 15, 2, '#c9a65a', 2);
  label(ctx, 'GERALD “BIG BAGZ” HOLDERN', x, y + h / 2 + 11.5, 7.5, '#3a2616', 800, 94);
}

/** The bust in the photo: shoulders, collar, tie, the face (eyes are dots: the filter is drawn live). */
function drawGeraldBust(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Suit and shoulders.
  ctx.fillStyle = '#24314a';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(x - 50, y + 60);
  ctx.quadraticCurveTo(x - 46, y + 18, x - 16, y + 12);
  ctx.lineTo(x + 16, y + 12);
  ctx.quadraticCurveTo(x + 46, y + 18, x + 50, y + 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  poly(ctx, [x - 12, y + 12, x + 12, y + 12, x, y + 34], '#f4f1ea', 1.6);
  poly(ctx, [x - 3, y + 16, x + 3, y + 16, x + 5, y + 40, x, y + 46, x - 5, y + 40], '#b5232f', 1.4);
  // Neck, ears, the head: round, a little jowly, a receding hairline.
  ctx.fillStyle = SKIN;
  ink(ctx, 2.2);
  ctx.fillRect(x - 9, y + 2, 18, 12);
  blob(ctx, x - 25, y - 18, 5, 7, SKIN, 2);
  blob(ctx, x + 25, y - 18, 5, 7, SKIN, 2);
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.moveTo(x - 24, y - 30);
  ctx.quadraticCurveTo(x - 27, y + 4, x, y + 8);
  ctx.quadraticCurveTo(x + 27, y + 4, x + 24, y - 30);
  ctx.quadraticCurveTo(x + 22, y - 54, x, y - 54);
  ctx.quadraticCurveTo(x - 22, y - 54, x - 24, y - 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Side hair and a brave strand on top.
  ctx.fillStyle = '#6b4a35';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * 24, y - 32);
    ctx.quadraticCurveTo(x + s * 27, y - 44, x + s * 18, y - 48);
    ctx.quadraticCurveTo(x + s * 21, y - 38, x + s * 20, y - 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#6b4a35';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 52);
  ctx.quadraticCurveTo(x + 2, y - 60, x + 10, y - 50);
  ctx.stroke();
  // Brows, the eyes as plain dots, the nose, the closed-mouth smile and the second chin.
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 32);
  ctx.lineTo(x - 6, y - 33);
  ctx.moveTo(x + 6, y - 33);
  ctx.lineTo(x + 16, y - 32);
  ctx.stroke();
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * 10, y - 25, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.quadraticCurveTo(x - 4, y - 13, x + 1, y - 12);
  ctx.moveTo(x - 9, y - 4);
  ctx.quadraticCurveTo(x, y + 1, x + 10, y - 6);
  ctx.moveTo(x - 8, y + 5);
  ctx.quadraticCurveTo(x, y + 9, x + 8, y + 5);
  ctx.stroke();
}

// ─── The window: what moves outside, then the blinds and the glass ─────────────────────────────────────
/** The window's live layer: gravediggers, the hearse, the rideshare and the cousin outside, then blinds, glass and frame. */
export function drawWindow(ctx: CanvasRenderingContext2D, p: Parlor, d: ParlorDrive): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
  ctx.clip();
  drawDiggers(ctx, p, d);
  drawHearse(ctx, p, d);
  drawRideshare(ctx, d);
  ctx.restore();
  stamp(ctx, 'blinds', 0, 0, WIN.x - 16, WIN.y - 6, WIN.w + 32, WIN.h + 22, paintBlinds);
}

/** The blinds lowered over the top third (their slats lit from behind), the cord, the glass's sheen, the frame and the sill. */
function paintBlinds(ctx: CanvasRenderingContext2D): void {
  const blindBottom = WIN.y + 48;
  ctx.fillStyle = 'rgba(255, 226, 170, 0.9)';
  ctx.fillRect(WIN.x, WIN.y, WIN.w, blindBottom - WIN.y);
  for (let y = WIN.y + 2; y < blindBottom; y += 6) {
    ctx.fillStyle = '#e8dcc2';
    ctx.fillRect(WIN.x, y, WIN.w, 4);
    ctx.fillStyle = 'rgba(80, 60, 40, 0.35)';
    ctx.fillRect(WIN.x, y + 3.2, WIN.w, 0.8);
  }
  box(ctx, WIN.x - 2, blindBottom - 2, WIN.w + 4, 6, 2, '#d8cbb0', 2);
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(WIN.x + WIN.w - 18, blindBottom + 2);
  ctx.lineTo(WIN.x + WIN.w - 18, blindBottom + 34);
  ctx.stroke();
  blob(ctx, WIN.x + WIN.w - 18, blindBottom + 37, 2.5, 3.5, '#d8cbb0', 1.2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(WIN.x + 30, WIN.y + WIN.h);
  ctx.lineTo(WIN.x + 70, blindBottom + 4);
  ctx.lineTo(WIN.x + 84, blindBottom + 4);
  ctx.lineTo(WIN.x + 44, WIN.y + WIN.h);
  ctx.closePath();
  ctx.fill();
  ink(ctx, 2.5);
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#4a3027';
  ctx.beginPath();
  ctx.rect(WIN.x - 8, WIN.y - 4, 8, WIN.h + 4);
  ctx.rect(WIN.x + WIN.w, WIN.y - 4, 8, WIN.h + 4);
  ctx.fill();
  ctx.stroke();
  box(ctx, WIN.x - 14, WIN.y + WIN.h, WIN.w + 28, 9, 2, '#6e4a35', 2.5);
}

/** Two gravediggers by the fresh grave: they dig, then stop, lean on their shovels and watch the parlor. */
function drawDiggers(ctx: CanvasRenderingContext2D, p: Parlor, d: ParlorDrive): void {
  const watch = clamp(p.watch.x, 0, 1);
  const phones = clamp(p.phones.x, 0, 1);
  for (const [i, x, y, side] of [[0, 186, 184, 1], [1, 236, 178, -1]] as const) {
    const phase = p.dig + i * 1.7;
    const stroke = Math.sin(phase * Math.PI * 2);
    const bend = (1 - watch) * (0.5 + 0.5 * stroke);
    const sway = Math.sin(d.amb * 1.3 + i) * 0.6 * watch;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.3, 1.3);
    // Legs.
    ink(ctx, 2.6);
    ctx.strokeStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(-2, -9);
    ctx.lineTo(-3, 0);
    ctx.moveTo(2, -9);
    ctx.lineTo(3, 0);
    ctx.stroke();
    // Body bends over the shovel while digging; upright and leaning while watching.
    ctx.translate(0, -9);
    ctx.rotate(side * (0.55 * bend - 0.08 * watch) + sway * 0.02);
    box(ctx, -4, -12, 8, 12, 2, i === 0 ? '#5c6b4a' : '#6b5a3a', 1.2);
    blob(ctx, 0, -15.5, 3.4, 3.4, '#d9b896', 1.1);
    ctx.fillStyle = i === 0 ? '#333' : '#8a2a2a';
    ctx.fillRect(-3.6, -19.5, 7.2, 2.4);
    if (watch > 0.5) {
      // Faces turned to the parlor's glass.
      ctx.fillStyle = INK;
      ctx.fillRect(-1.6, -16.2, 1, 1);
      ctx.fillRect(0.8, -16.2, 1, 1);
    }
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.3, 1.3);
    // The shovel: digging, its blade bites the heap; watching, it stands upright under both hands.
    const tipX = side * mix(12 + 4 * stroke, 5, watch);
    const tipY = mix(-2 - 6 * Math.max(0, stroke), 0, watch);
    const topX = side * mix(2 - 5 * bend, 4, watch);
    const topY = -mix(16 - 4 * bend, 24, watch);
    ink(ctx, 1.6);
    ctx.strokeStyle = '#8a6a3a';
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = '#9aa0a6';
    ctx.beginPath();
    ctx.ellipse(tipX, tipY, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dirt off the blade on the up-stroke.
    if (watch < 0.4 && stroke > 0.6) {
      ctx.fillStyle = '#7a5536';
      for (let k = 0; k < 3; k += 1) ctx.fillRect(tipX + side * (k * 2 + 2), tipY - 3 - k * 2 - (stroke - 0.6) * 10, 2, 2);
    }
    ctx.restore();
    // Past 20× they are checking the chart too.
    if (phones > 0.05) glow(ctx, x + side * 5, y - 18, 8, [150, 210, 255], phones * (0.7 + 0.3 * Math.sin(d.amb * 3 + i)));
  }
}

/** The hearse in the driveway: a REPO notice past 12×, and at the crash it drives off without its cargo. */
function drawHearse(ctx: CanvasRenderingContext2D, p: Parlor, d: ParlorDrive): void {
  const gone = d.ct >= 0 ? span(d.ct, CRASH_AT.hearse[0], CRASH_AT.hearse[1]) : 0;
  const dx = 280 * gone * gone;
  if (dx > 200) return;
  const bounce = d.ct >= CRASH_AT.hearse[0] && gone < 1 ? Math.sin(d.ct * 30) * 0.6 : 0;
  stamp(ctx, 'hearse', dx, bounce, 126, 182, 128, 42, paintHearse);
  const repo = clamp(p.repo.x, 0, 1.2);
  if (repo > 0.02) {
    ctx.save();
    ctx.translate(198 + dx, 198 + bounce);
    ctx.scale(repo, repo);
    ctx.rotate(-0.12);
    box(ctx, -11, -4.5, 22, 9, 1, '#ff8a1f', 1);
    label(ctx, 'REPO', 0, 0, 6.5, INK, 900, 20);
    ctx.restore();
  }
}

/** The hearse in side view: long and low with a tall rear cabin, chrome trim and the curtained window. */
function paintHearse(ctx: CanvasRenderingContext2D): void {
  ctx.translate(190, 214);
  ctx.scale(0.82, 0.82);
  ctx.translate(-190, -214);
  ctx.fillStyle = '#16141a';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(122, 214);
  ctx.lineTo(122, 198);
  ctx.quadraticCurveTo(124, 186, 136, 186);
  ctx.lineTo(214, 186);
  ctx.lineTo(228, 197);
  ctx.lineTo(250, 200);
  ctx.quadraticCurveTo(256, 204, 256, 214);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6d6a74';
  ctx.fillRect(132, 190, 52, 9);
  ctx.strokeStyle = '#cfcfd6';
  ctx.lineWidth = 0.8;
  for (let x = 135; x < 184; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 190);
    ctx.lineTo(x, 199);
    ctx.stroke();
  }
  ctx.fillStyle = '#8fa3b5';
  ctx.beginPath();
  ctx.moveTo(190, 190);
  ctx.lineTo(212, 190);
  ctx.lineTo(223, 198);
  ctx.lineTo(190, 198);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d8d8de';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(124, 205);
  ctx.lineTo(254, 205);
  ctx.moveTo(160, 190);
  ctx.bezierCurveTo(168, 194, 160, 198, 168, 201);
  ctx.stroke();
  for (const wx of [142, 234]) {
    blob(ctx, wx, 214, 6.5, 6.5, '#0d0c10', 1.6);
    blob(ctx, wx, 214, 2.8, 2.8, '#b8b8c0', 0.8);
  }
}

/** The rideshare (seen from behind): it pulls up on the exit, waits with its hazards on, takes the cousin and drives off. */
function drawRideshare(ctx: CanvasRenderingContext2D, d: ParlorDrive): void {
  const e = d.exitAge;
  if (e < 0.3 || e > 9.6) return;
  const arrive = span(e, 0.3, 1.8);
  const away = span(e, 7.2, 9.4);
  const s = 1 - 0.78 * away;
  const x = 200 + 240 * (1 - arrive) * (1 - arrive) + 10 * away;
  const settle = e > 1.8 && e < 2.6 ? Math.sin((e - 1.8) * 18) * Math.exp(-(e - 1.8) * 5) * 1.5 : 0;
  const rock = e > 6.7 && e < 7.4 ? Math.sin((e - 6.7) * 22) * Math.exp(-(e - 6.7) * 5) * 2 : 0;
  const y = 246 - 64 * away + settle + rock;
  // The cousin crossing the driveway to it, before the car takes them.
  if (e > 5.2 && e < 6.8) drawCousinOutside(ctx, mix(WIN.x - 6, x - 44, span(e, 5.2, 6.6)), 244, e);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Body, cabin and rear windscreen with the driver's head in it.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 60, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  box(ctx, -54, -36, 108, 34, 9, '#e8e3da', 2.2);
  poly(ctx, [-40, -36, 40, -36, 30, -60, -30, -60], '#d8d2c8', 2.2);
  poly(ctx, [-34, -38, 34, -38, 26, -57, -26, -57], '#7f95a8', 1.6);
  blob(ctx, -10, -45, 7, 8, '#2e2620', 0);
  // The roof sign and the taillights; the hazards blink while it waits.
  box(ctx, -15, -69, 30, 9, 2, '#1e1e24', 1.6);
  label(ctx, 'RIDE', 0, -64.5, 6.5, '#9ff0c0', 900, 26);
  const blink = e > 1.8 && e < 7.2 && Math.floor(e * 2.5) % 2 === 0;
  for (const side of [-1, 1]) box(ctx, side * 50 - 6, -30, 12, 8, 2, blink ? '#ffb02e' : '#c4262e', 1.4);
  box(ctx, -30, -4, 60, 6, 2, '#3a3a40', 1.4);
  // The plate.
  box(ctx, -27, -26, 54, 14, 2, '#fbfbf6', 1.6);
  label(ctx, 'TOOK PROFIT', 0, -18.6, 8.4, '#1d3c8a', 900, 50);
  for (const side of [-1, 1]) box(ctx, side * 38 - 7, -4, 14, 9, 3, '#141418', 1.4);
  ctx.restore();
}

/** The cousin, tiny, crossing the driveway with the candle and the sandwiches, shades on. */
function drawCousinOutside(ctx: CanvasRenderingContext2D, x: number, y: number, e: number): void {
  const swing = Math.sin(e * 11);
  ctx.save();
  ctx.translate(x, y + Math.abs(swing) * -0.8);
  ink(ctx, 2.4);
  ctx.strokeStyle = '#1e1f28';
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.lineTo(-2 + swing * 3, 0);
  ctx.moveTo(2, -12);
  ctx.lineTo(2 - swing * 3, 0);
  ctx.stroke();
  box(ctx, -5.5, -27, 11, 16, 3, '#2e2f3a', 1.2);
  blob(ctx, 0, -31, 4.6, 4.8, '#c9a07c', 1.1);
  ctx.fillStyle = '#3a2a24';
  ctx.beginPath();
  ctx.ellipse(0, -33, 4.8, 3.2, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(1, -32.5, 4.5, 1.6);
  // The candle in one hand, flickering.
  box(ctx, 5, -20, 3.5, 7, 1, '#f3ead6', 0.8);
  ctx.fillStyle = '#ffcf5a';
  ctx.beginPath();
  ctx.ellipse(6.75, -22, 1.2, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── The door ──────────────────────────────────────────────────────────────────────────────────────────
/** The side door, swung outward by `open` (0 shut, 1 open), with the evening light in the gap. */
export function drawDoor(ctx: CanvasRenderingContext2D, open: number): void {
  const o = clamp(open, 0, 1);
  if (o > 0.01) {
    ctx.fillStyle = '#ffd99a';
    ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    ctx.fillStyle = '#86a15e';
    ctx.fillRect(DOOR.x, DOOR.y + DOOR.h - 40, DOOR.w, 40);
    ctx.fillStyle = '#cbb898';
    ctx.fillRect(DOOR.x, DOOR.y + DOOR.h - 18, DOOR.w, 18);
  }
  // The leaf swings away from us on its left hinge: narrower and taller at the free edge as it opens.
  const w = DOOR.w * (1 - 0.82 * o);
  const lift = 10 * o;
  ctx.fillStyle = '#5a3a2c';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(DOOR.x, DOOR.y);
  ctx.lineTo(DOOR.x + w, DOOR.y - lift * 0.4);
  ctx.lineTo(DOOR.x + w, DOOR.y + DOOR.h + lift * 0.2);
  ctx.lineTo(DOOR.x, DOOR.y + DOOR.h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (w > 20) {
    ctx.fillStyle = '#6b4636';
    ctx.fillRect(DOOR.x + w * 0.16, DOOR.y + 14, w * 0.68, 64);
    ctx.fillRect(DOOR.x + w * 0.16, DOOR.y + 96, w * 0.68, 84);
    ctx.fillStyle = '#d4a94f';
    ctx.beginPath();
    ctx.arc(DOOR.x + w - 9, DOOR.y + DOOR.h / 2 + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── The portrait ───────────────────────────────────────────────────────────────────────────────────────
/** The laser-eye filter on the photo (pulsing with the round), which goes dark at the crash. */
export function drawPortraitFilter(ctx: CanvasRenderingContext2D, d: ParlorDrive): void {
  const { x, y, w, h } = PORTRAIT;
  let on = 1;
  if (d.ct >= 0) {
    const t = d.ct;
    if (t >= CRASH_AT.laser[1]) on = 0;
    else if (t >= CRASH_AT.laser[0]) on = Math.floor(t * 23) % 3 === 0 ? 0 : 0.6;
  }
  const eyes = [[x - 10, y - 13], [x + 10, y - 13]] as const;
  if (on > 0) {
    const pulse = 0.75 + 0.25 * Math.sin(d.amb * (2 + 5 * d.tension));
    for (const [i, [ex, ey]] of eyes.entries()) {
      const side = i === 0 ? -1 : 1;
      const tx = ex + side * (64 + 18 * d.tension);
      const ty = ey - 30 - 6 * d.tension;
      ctx.save();
      ctx.globalAlpha = on;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255, 40, 50, ${0.28 * pulse})`;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 120, 120, ${0.9 * pulse})`;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.restore();
      glow(ctx, ex, ey, 13, [255, 50, 60], on * pulse);
      ctx.fillStyle = `rgba(255, 245, 245, ${on})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 2.4, 0, Math.PI * 2);
      ctx.fill();
      // The lens flare: a four-point star.
      ctx.strokeStyle = `rgba(255, 220, 220, ${0.8 * on * pulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ex - 7, ey);
      ctx.lineTo(ex + 7, ey);
      ctx.moveTo(ex, ey - 7);
      ctx.lineTo(ex, ey + 7);
      ctx.stroke();
    }
  } else {
    // The filter was the only thing keeping the photo alive: dull and grey without it.
    ctx.fillStyle = 'rgba(70, 64, 74, 0.42)';
    ctx.fillRect(x - w / 2 + 11, y - h / 2 + 11, w - 22, h - 22);
  }
}

// ─── Flowers ────────────────────────────────────────────────────────────────────────────────────────────
/** A lily: six pointed petals around orange stamens. */
function lily(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number): void {
  ctx.fillStyle = '#fbf8f0';
  ink(ctx, 1.3);
  ctx.beginPath();
  for (let i = 0; i < 12; i += 1) {
    const a = turn + (i * Math.PI) / 6;
    const rr = i % 2 === 0 ? r : r * 0.38;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e0a030';
  for (let i = 0; i < 3; i += 1) {
    const a = turn + 0.5 + i * 2.1;
    ctx.fillRect(x + Math.cos(a) * r * 0.32 - 1, y + Math.sin(a) * r * 0.3 - 1, 2, 2);
  }
}

/** A satin ribbon that, at the crash, flips over (unrolls) to read RUGGED. `u` is the unroll, 0..1. */
function ribbon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, text: string, u: number, tails: number): void {
  const flip = Math.cos(Math.PI * clamp(u, 0, 1));
  const back = u >= 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // The tails hang from the right end, and run long as the ribbon unrolls.
  const tailLen = tails * (1 + 1.8 * smoothstep(0, 1, u));
  for (const [dx, k] of [[w / 2 - 12, 1], [w / 2 - 4, 0.85]] as const) {
    const len = tailLen * k;
    ctx.save();
    ctx.translate(dx, 0);
    ctx.rotate(-angle);
    poly(ctx, [-4, 0, 4, 0, 4, len, 0, len - 4, -4, len], back ? '#1d1418' : '#f1e6c8', 1.3);
    ctx.restore();
  }
  ctx.scale(1, Math.max(0.06, Math.abs(flip)));
  box(ctx, -w / 2, -h / 2, w, h, 2, back ? '#1d1418' : '#f4ead2', 1.5);
  ctx.strokeStyle = back ? '#ff4d6d' : '#b08a4e';
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2 + 2.5, -h / 2 + 2.5, w - 5, h - 5);
  label(ctx, back ? 'RUGGED' : text, 0, 0.5, h * 0.56, back ? '#ff4d6d' : '#6a4a1a', 900, w - 10);
  ctx.restore();
}

/** Ribbon unroll (0..1) for ribbon `i` at this crash clock. */
const unroll = (p: Parlor, d: ParlorDrive, i: number): number => (d.ct >= 0 && p.ribbonAt.length ? span(d.ct, p.ribbonAt[i]!, p.ribbonAt[i]! + 0.35) : 0);

/** Wilt (0..1) of leaf `j` of wreath `w`. */
const wiltOf = (p: Parlor, d: ParlorDrive, w: number, j: number): number => (d.ct >= 0 && p.leafAt.length ? span(d.ct, p.leafAt[w]![j]!, p.leafAt[w]![j]! + 0.6) : 0);

const BROWN = [122, 84, 40] as const;
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const GREENS_RGB = LEAF_GREENS.map(hex);
const tintOf = (tint: number, wilt: number): string => {
  const g = GREENS_RGB[tint]!;
  return `rgb(${Math.round(mix(g[0], BROWN[0], wilt))}, ${Math.round(mix(g[1], BROWN[1], wilt))}, ${Math.round(mix(g[2], BROWN[2], wilt))})`;
};

/** A candle-chart wreath on its easel: a ring of leaves, chart candles burning inside it, and the sash. */
export function drawWreath(ctx: CanvasRenderingContext2D, p: Parlor, d: ParlorDrive, w: number): void {
  const { x, y, r, text } = WREATHS[w]!;
  const wilting = d.ct >= 0 && p.leafAt.length > 0;
  const bounds = [x - r - 26, y - r - 26, 2 * r + 52, CASKET.floor - y + r + 26] as const;
  if (!wilting) {
    // At rest the ring, its leaves and the candles are one cached image; the curl leaf, flames and sash are live.
    stamp(ctx, `wreath${w}`, 0, 0, ...bounds, (g) => {
      paintWreathBase(g, w);
      for (const [j, leaf] of LEAVES[w]!.entries()) if (!(w === 1 && j === CURL_LEAF)) paintLeaf(g, x, y, r, leaf, 0, 0);
      paintCarnations(g, x, y, r);
    });
    if (w === 1) paintLeaf(ctx, x, y, r, LEAVES[1]![CURL_LEAF]!, clamp(p.curl.x, 0, 1) * 0.55, clamp(p.curl.x, 0, 1));
  } else {
    stamp(ctx, `wreathBase${w}`, 0, 0, ...bounds, (g) => paintWreathBase(g, w));
    // Leaves: each wilts in its seeded turn at the crash, some drop to the carpet. Leaves of one colour
    // (five steps of wilt per green) share a path, so the ring costs a few fills, not sixty.
    ink(ctx, 1.2);
    for (let tint = 0; tint < 3; tint += 1) {
      for (let step = 0; step <= 4; step += 1) {
        let any = false;
        ctx.beginPath();
        for (const [j, leaf] of LEAVES[w]!.entries()) {
          if (leaf.tint !== tint) continue;
          const curl = w === 1 && j === CURL_LEAF ? clamp(p.curl.x, 0, 1) : 0;
          const wilt = Math.max(wiltOf(p, d, w, j), curl * 0.55);
          if (Math.round(wilt * 4) !== step) continue;
          const fall = p.leafDrops[w]![j] ? Math.max(0, d.ct - (p.leafAt[w]![j]! + 0.6)) : 0;
          leafPath(ctx, x, y, r, leaf, wilt, curl, fall, j);
          any = true;
        }
        if (!any) continue;
        ctx.fillStyle = tintOf(tint, step / 4);
        ctx.fill();
        ctx.stroke();
      }
    }
    paintCarnations(ctx, x, y, r);
  }
  // The flames on the chart candles.
  ctx.fillStyle = '#ffcf5a';
  ctx.beginPath();
  for (const [i, [cx, top]] of CANDLES.entries()) {
    const flick = noise(Math.floor(d.amb * 14) + i * 7 + w * 31);
    const fh = 4 + 2 * flick;
    ctx.moveTo(x + cx, y + top - 6 - fh);
    ctx.quadraticCurveTo(x + cx + 2.6 + (flick - 0.5), y + top - 7, x + cx, y + top - 5.5);
    ctx.quadraticCurveTo(x + cx - 2.6 + (flick - 0.5), y + top - 7, x + cx, y + top - 6 - fh);
  }
  ctx.fill();
  ribbon(ctx, x, y + r * 0.66, r * 2.3, 15, -0.14, text, unroll(p, d, w), 30);
}

/** The chart candles inside each ring: [x offset, body top, body bottom, up]. */
const CANDLES = [[-27, 8, 20, 1], [-17, 0, 12, 0], [-7, 4, 16, 1], [3, -8, 6, 1], [13, -4, 8, 0], [23, -18, -2, 1]] as const;

/** The easel, the dark bed of the ring and the chart candles (no flames). */
function paintWreathBase(ctx: CanvasRenderingContext2D, w: number): void {
  const { x, y, r } = WREATHS[w]!;
  ink(ctx, 3);
  ctx.strokeStyle = '#2a1a16';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 26, CASKET.floor - 8);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 26, CASKET.floor - 8);
  ctx.moveTo(x, y);
  ctx.lineTo(x, CASKET.floor - 14);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#2f4f2a';
  ctx.lineWidth = 17;
  ctx.stroke();
  for (const [cx, top, bottom, up] of CANDLES) {
    ink(ctx, 1);
    ctx.beginPath();
    ctx.moveTo(x + cx, y + top - 6);
    ctx.lineTo(x + cx, y + bottom + 5);
    ctx.stroke();
    box(ctx, x + cx - 3.5, y + top, 7, bottom - top, 1, up ? '#3fae6a' : '#d0454c', 1.3);
  }
}

function paintCarnations(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    blob(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 5, 4.4, '#f6f0e6', 1.2);
  }
}

/** Appends one leaf's outline to the current path (placed and turned by hand, so many leaves share one fill). */
function leafPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, leaf: Leaf, wilt: number, curl: number, fall: number, j: number): { x: number; y: number; angle: number } {
  let lx = x + Math.cos(leaf.a) * r * leaf.r;
  let ly = y + Math.sin(leaf.a) * r * leaf.r;
  let angle = leaf.a + Math.PI / 2 + leaf.tilt;
  angle += Math.atan2(Math.sin(Math.PI / 2 - angle), Math.cos(Math.PI / 2 - angle)) * wilt;
  if (fall > 0) {
    ly += Math.min(CASKET.floor - 4 - ly, 260 * fall * fall);
    lx += Math.sin(fall * 6 + j) * 6 * Math.min(1, fall * 2);
    angle += Math.min(fall, 1.2) * 3;
  }
  const len = leaf.len * (1 - 0.15 * wilt) * (1 - 0.3 * curl);
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const at = (u: number, v: number): [number, number] => [lx + u * c - v * sn, ly + u * sn + v * c];
  ctx.moveTo(lx, ly);
  ctx.quadraticCurveTo(...at(len * 0.5, -leaf.wid), ...at(len, 0));
  ctx.quadraticCurveTo(...at(len * 0.5, leaf.wid * (1 - curl)), lx, ly);
  const [tx, ty] = at(len - 1, 0);
  return { x: tx, y: ty, angle };
}

/** One leaf drawn on its own (the cached ring, and the leaf that curls at 5×, its tip rolled under). */
function paintLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, leaf: Leaf, wilt: number, curl: number): void {
  ctx.fillStyle = tintOf(leaf.tint, wilt);
  ink(ctx, 1.2);
  ctx.beginPath();
  const tip = leafPath(ctx, x, y, r, leaf, wilt, curl, 0, 0);
  ctx.fill();
  ctx.stroke();
  if (curl > 0.05) {
    ctx.beginPath();
    ctx.arc(tip.x, tip.y + 1.5, 2.5 * curl, tip.angle - Math.PI / 2, tip.angle + Math.PI);
    ctx.stroke();
  }
}

/** The tall vase of lilies on its pedestal beside the lectern, with its ribbon. */
export function drawVase(ctx: CanvasRenderingContext2D, p: Parlor, d: ParlorDrive): void {
  const x = VASE.x;
  stamp(ctx, 'vase', 0, 0, x - 44, 196, 88, VASE.floor - 196 + 4, (g) => {
    box(g, x - 16, 326, 32, VASE.floor - 326, 3, '#3c2620', 2.5);
    box(g, x - 22, 320, 44, 9, 2, '#4a3027', 2.5);
    g.strokeStyle = '#4f7d3f';
    g.lineWidth = 2;
    const stems = [[-24, 236], [-10, 214], [6, 222], [20, 242], [-2, 250], [28, 262], [-28, 262]] as const;
    for (const [dx, top] of stems) {
      g.beginPath();
      g.moveTo(x + dx * 0.2, 292);
      g.quadraticCurveTo(x + dx * 0.6, 270, x + dx, top + 8);
      g.stroke();
    }
    for (const [i, [dx, top]] of stems.entries()) lily(g, x + dx, top, 10, i * 0.7);
    poly(g, [x - 14, 320, x + 14, 320, x + 18, 296, x + 10, 286, x - 10, 286, x - 18, 296], '#c9c2d8', 2.5);
  });
  ribbon(ctx, x, 306, 40, 11, 0, 'GROUP CHAT', unroll(p, d, 3), 12);
}

/** The basket of lilies at the head of the bier. */
export function drawBasket(ctx: CanvasRenderingContext2D): void {
  const x = BASKET.x;
  const y = BASKET.floor;
  stamp(ctx, 'basket', 0, 0, x - 34, y - 72, 68, 76, (g) => {
    for (const [i, [dx, dy]] of ([[-20, -46], [0, -58], [18, -48], [-8, -36], [10, -34]] as const).entries()) {
      g.strokeStyle = '#4f7d3f';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + dx * 0.3, y - 22);
      g.lineTo(x + dx, y + dy + 6);
      g.stroke();
      lily(g, x + dx, y + dy, 9, i);
    }
    poly(g, [x - 26, y - 24, x + 26, y - 24, x + 20, y, x - 20, y], '#a8834f', 2.5);
    g.strokeStyle = 'rgba(70, 45, 20, 0.6)';
    g.lineWidth = 1;
    for (let k = 1; k < 4; k += 1) {
      g.beginPath();
      g.moveTo(x - 26 + k * 1.5, y - 24 + k * 6);
      g.lineTo(x + 26 - k * 1.5, y - 24 + k * 6);
      g.stroke();
    }
  });
}

// ─── The casket ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * The bier, the casket (its side panel hides everything inside: only the folded hands and the glowing phone
 * show over the rim), the raised half-lid with its satin, the spray of lilies on the closed half, the bead
 * chain with the hardware wallet, and the memorial-wallet placard.
 */
export function drawCasket(ctx: CanvasRenderingContext2D, p: Parlor, d: ParlorDrive, battery: number): void {
  const { l, r, rim, floor } = CASKET;
  // The bier and the lids, then the hands and the phone over the rim, then the casket's side panel and the spray.
  stamp(ctx, 'casketBack', 0, 0, l - 24, rim - 70, r - l + 48, floor - rim + 80, paintCasketBack);
  drawHandsAndPhone(ctx, d, battery);
  stamp(ctx, 'casketFront', 0, 0, l - 6, rim - 40, r - l + 12, CASKET.base - rim + 46, paintCasketFront);
  // The bead chain from his wrist over the rim, with the hardware wallet on it.
  ctx.fillStyle = '#c9c2b6';
  ink(ctx, 1);
  ctx.beginPath();
  for (let k = 0; k <= 9; k += 1) {
    const u = k / 9;
    const bx = mix(PHONE.x - 14, PHONE.x - 30, u);
    const by = mix(rim - 4, rim + 24, u) + Math.sin(u * Math.PI) * 4;
    ctx.moveTo(bx + 1.8, by);
    ctx.arc(bx, by, 1.8, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  const sway = Math.sin(d.amb * 1.1) * 1.2;
  box(ctx, PHONE.x - 36 + sway, rim + 26, 12, 18, 3, '#3a3d44', 1.6);
  ctx.fillStyle = '#8fd0a0';
  ctx.fillRect(PHONE.x - 33.5 + sway, rim + 29, 7, 5);
  ribbon(ctx, 558, rim + 2, 70, 12, 0.03, 'GM GERALD', unroll(p, d, 2), 14);
  // In lieu of flowers: the memorial wallet placard, propped against the bier from 2.1×.
  const qr = clamp(p.qr.x, 0, 1.2);
  if (qr > 0.02) {
    ctx.save();
    ctx.translate(408, 354);
    ctx.rotate(-0.06);
    ctx.scale(qr, qr);
    box(ctx, -22, -36, 44, 38, 2, '#fbf8f0', 2);
    label(ctx, 'MEMORIAL', 0, -30, 6, INK, 900, 40);
    label(ctx, 'WALLET', 0, -23.5, 6, INK, 900, 40);
    const rq = mulberry32(42);
    ctx.fillStyle = INK;
    for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) if (rq() > 0.45 || (i < 2 && j < 2) || (i > 3 && j < 2)) ctx.fillRect(-9 + i * 3, -18 + j * 3, 3, 3);
    ctx.restore();
  }
}

/** The draped bier, the raised half-lid with its satin and the embroidered chart, and the closed half's domed lid. */
function paintCasketBack(ctx: CanvasRenderingContext2D): void {
  const { l, r, rim, base, floor, split } = CASKET;
  // The draped bier.
  ctx.fillStyle = '#331c2e';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(l - 14, base - 4);
  ctx.lineTo(r + 14, base - 4);
  ctx.lineTo(r + 18, floor);
  for (let x = r + 18; x > l - 18; x -= 24) ctx.quadraticCurveTo(x - 12, floor + 5, x - 24, floor);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  for (let x = l; x < r; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, base + 4);
    ctx.lineTo(x - 2, floor - 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#b79650';
  ctx.fillRect(l - 14, base - 4, r - l + 28, 5);
  // The raised half-lid: its satin lining faces us, with a gold up-only chart embroidered in it.
  ctx.fillStyle = '#6b2c20';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(l + 6, rim - 2);
  ctx.lineTo(l + 12, rim - 54);
  ctx.lineTo(split - 4, rim - 54);
  ctx.lineTo(split, rim - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#efe5d4';
  ctx.beginPath();
  ctx.moveTo(l + 13, rim - 4);
  ctx.lineTo(l + 18, rim - 48);
  ctx.lineTo(split - 10, rim - 48);
  ctx.lineTo(split - 7, rim - 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d6c8b2';
  ctx.lineWidth = 1.2;
  const cx = (l + split) / 2;
  for (let k = 0; k <= 10; k += 1) {
    ctx.beginPath();
    ctx.moveTo(cx, rim - 4);
    ctx.lineTo(mix(l + 18, split - 10, k / 10), rim - 48);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c99a3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 34, rim - 22);
  ctx.lineTo(cx - 20, rim - 30);
  ctx.lineTo(cx - 10, rim - 26);
  ctx.lineTo(cx + 6, rim - 40);
  ctx.lineTo(cx + 14, rim - 36);
  ctx.lineTo(cx + 30, rim - 42);
  ctx.stroke();
  // The closed half's lid, domed, and the satin ruffle along the open rim.
  ctx.fillStyle = '#7b3426';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(split - 2, rim);
  ctx.quadraticCurveTo(split + 4, rim - 14, split + 20, rim - 14);
  ctx.lineTo(r - 18, rim - 14);
  ctx.quadraticCurveTo(r - 2, rim - 14, r + 2, rim);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 200, 170, 0.25)';
  ctx.fillRect(split + 14, rim - 11, r - split - 34, 3);
}

/** The satin ruffle along the open rim, the mahogany side panel with its brass bar, and the spray on the closed half. */
function paintCasketFront(ctx: CanvasRenderingContext2D): void {
  const { l, r, rim, base, split } = CASKET;
  ctx.fillStyle = '#f6eee0';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(l + 6, rim + 1);
  for (let x = l + 6; x < split; x += 10) ctx.quadraticCurveTo(x + 5, rim - 8, x + 10, rim + 1);
  ctx.lineTo(split, rim + 4);
  ctx.lineTo(l + 6, rim + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The body: polished mahogany with a raised panel, a gloss line and the brass bar.
  box(ctx, l, rim, r - l, base - rim, 10, '#7b3426', 3);
  box(ctx, l + 14, rim + 11, r - l - 28, base - rim - 22, 6, '#8e3f2d', 2);
  ctx.fillStyle = 'rgba(255, 210, 180, 0.22)';
  ctx.fillRect(l + 10, rim + 4, r - l - 20, 3);
  ink(ctx, 6);
  ctx.beginPath();
  ctx.moveTo(l + 24, rim + 34);
  ctx.lineTo(r - 24, rim + 34);
  ctx.stroke();
  ctx.strokeStyle = '#d4a94f';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  for (let k = 0; k < 4; k += 1) box(ctx, mix(l + 34, r - 40, k / 3), rim + 28, 8, 12, 2, '#d4a94f', 1.6);
  paintSpray(ctx);
}

function paintSpray(ctx: CanvasRenderingContext2D): void {
  const x = 558;
  const y = CASKET.rim - 14;
  blob(ctx, x, y + 2, 52, 11, '#2f4f2a', 2);
  for (let k = 0; k < 9; k += 1) {
    const a = Math.PI + (k / 8) * Math.PI;
    const lx = x + Math.cos(a) * 54;
    const ly = y + Math.sin(a) * 14;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a);
    ctx.fillStyle = LEAF_GREENS[k % 3]!;
    ink(ctx, 1.2);
    ctx.beginPath();
    ctx.ellipse(6, 0, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  for (const [i, [dx, dy]] of ([[-34, -6], [-14, -14], [8, -10], [28, -6], [-2, -2], [40, 0], [-44, 0]] as const).entries()) lily(ctx, x + dx, y + dy, 10, i * 0.9);
}

/** The folded hands holding the phone upright: the lock screen glows, never unlocks, and buzzes once at the crash. */
function drawHandsAndPhone(ctx: CanvasRenderingContext2D, d: ParlorDrive, battery: number): void {
  const buzz = d.ct >= 0 && d.ct < 0.6 ? Math.sin(d.ct * 95) * 2.2 * (1 - d.ct / 0.6) : 0;
  const dead = d.ct >= CRASH_AT.dark ? smoothstep(CRASH_AT.dark, CRASH_AT.dark + 0.3, d.ct) : 0;
  const x = PHONE.x + buzz;
  const y = PHONE.y;
  const { w, h } = PHONE;
  const flash = d.ct >= 0 && d.ct < 1.2 ? 1 - d.ct / 1.2 : 0;
  glow(ctx, x, y, 46, [150, 210, 255], (0.55 + 0.1 * Math.sin(d.amb * 2) + 0.4 * flash) * (1 - dead));
  // The cuffs coming up from below the rim (a cached image; it shakes with the buzz).
  stamp(ctx, 'cuffs', buzz, 0, PHONE.x - 30, CASKET.rim - 26, 60, 30, (g) => {
    const cx = PHONE.x;
    for (const side of [-1, 1]) {
      poly(g, [cx + side * 16, CASKET.rim + 2, cx + side * 9, CASKET.rim - 14, cx + side * 20, CASKET.rim - 18, cx + side * 27, CASKET.rim + 2], '#22222c', 2);
      poly(g, [cx + side * 9, CASKET.rim - 14, cx + side * 11, CASKET.rim - 19, cx + side * 21, CASKET.rim - 22, cx + side * 20, CASKET.rim - 18], '#f2efe8', 1.5);
    }
  });
  // The phone.
  box(ctx, x - w / 2, y - h / 2, w, h, 4, '#18181e', 2);
  const sx = x - w / 2 + 2.5;
  const sy = y - h / 2 + 3;
  const sw = w - 5;
  const sh = h - 6;
  ctx.fillStyle = dead > 0.5 ? '#0e0e12' : '#1d3550';
  ctx.fillRect(sx, sy, sw, sh);
  if (dead < 0.5) {
    ctx.fillStyle = 'rgba(160, 210, 255, 0.35)';
    ctx.fillRect(sx, sy, sw, sh);
    label(ctx, '4:30', x, sy + 7, 6.5, '#ffffff', 800);
    // The chart on the lock screen, and the battery in the corner.
    ctx.strokeStyle = d.ct >= 0 ? '#ff6b6b' : '#7cf67c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx + 1, sy + sh - 5);
    ctx.lineTo(sx + 5, sy + sh - 8);
    ctx.lineTo(sx + 8, sy + sh - 7);
    ctx.lineTo(sx + 12, sy + sh - 13);
    ctx.lineTo(sx + sw - 1, d.ct >= 0 ? sy + sh - 2 : sy + sh - 17);
    ctx.stroke();
    ctx.fillStyle = battery <= 2 ? '#ff4d6d' : '#ffffff';
    ctx.fillRect(sx + sw - 6, sy + 1, Math.max(1, 4 * battery / 4), 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(sx + sw - 6.5, sy + 0.5, 5, 3);
    if (d.ct >= 0) {
      ctx.fillStyle = '#f7f7f9';
      ctx.fillRect(sx + 0.5, sy + 10, sw - 1, 6);
      ctx.fillStyle = '#d0454c';
      ctx.fillRect(sx + 1.5, sy + 11, 4, 4);
    }
  }
  // The folded hands over the lower half of the phone (cached too).
  stamp(ctx, 'hands', buzz, 0, PHONE.x - 20, PHONE.y - 4, 40, CASKET.rim - PHONE.y + 2, (g) => {
    const cx = PHONE.x;
    for (const side of [-1, 1]) {
      g.fillStyle = SKIN;
      ink(g, 1.8);
      g.beginPath();
      g.moveTo(cx + side * 14, CASKET.rim - 14);
      g.quadraticCurveTo(cx + side * 14, y + 2, cx + side * 7, y + 4);
      g.lineTo(cx + side * 1, y + 8);
      g.quadraticCurveTo(cx - side * 1, CASKET.rim - 8, cx + side * 6, CASKET.rim - 6);
      g.closePath();
      g.fill();
      g.stroke();
      // Fingers wrapped over the phone's edge.
      g.beginPath();
      for (let k = 0; k < 3; k += 1) {
        g.moveTo(cx + side * (w / 2 - 1) + 2.6, y + 2 + k * 4.5);
        g.ellipse(cx + side * (w / 2 - 1), y + 2 + k * 4.5, 2.6, 2.2, 0, 0, Math.PI * 2);
      }
      g.fill();
      g.stroke();
    }
  });
}

// ─── The lectern and the ledger ────────────────────────────────────────────────────────────────────────
/** The lectern's panel and the gooseneck microphone; the book and the celebrant's hands go on top of it. */
export function drawLectern(ctx: CanvasRenderingContext2D): void {
  stamp(ctx, 'lectern', 0, 0, LECTERN.x - 58, LECTERN.top - 58, 116, LECTERN.floor - LECTERN.top + 62, paintLectern);
}

function paintLectern(ctx: CanvasRenderingContext2D): void {
  const { x, top, floor } = LECTERN;
  poly(ctx, [x - 46, top + 4, x + 46, top + 4, x + 36, floor, x - 36, floor], '#4a2e24', 3);
  poly(ctx, [x - 36, top + 14, x + 36, top + 14, x + 30, floor - 10, x - 30, floor - 10], '#58362a', 2);
  // The emblem: a candle chart in brass, and the plaque.
  for (const [i, [dx, t, b]] of ([[-12, 10, 22], [-4, 4, 16], [4, 6, 14], [12, -4, 8]] as const).entries()) {
    ctx.fillStyle = i === 2 ? '#a8723a' : '#d4a94f';
    ctx.fillRect(x + dx - 3, top + 30 + t, 6, b - t);
    ctx.fillRect(x + dx - 0.5, top + 26 + t, 1, b - t + 8);
  }
  box(ctx, x - 30, top + 64, 60, 12, 2, '#c9a65a', 1.8);
  label(ctx, 'CRYPTO CELEBRANT', x, top + 70, 6.4, '#3a2616', 900, 56);
  poly(ctx, [x - 50, top - 6, x + 50, top - 6, x + 46, top + 6, x - 46, top + 6], '#5a3a2c', 2.5);
  // The microphone (the community wallet paid for it).
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 38, top - 4);
  ctx.quadraticCurveTo(x - 44, top - 34, x - 26, top - 44);
  ctx.stroke();
  blob(ctx, x - 24, top - 46, 5, 4, '#2a2a30', 1.6, -0.5);
}

/** The ledger-shaped prayer book: open on the lectern, ruled and blank; `close` (0..1) shuts it at the crash. */
export function drawLedger(ctx: CanvasRenderingContext2D, close: number): void {
  const { x, top } = LECTERN;
  const y = top - 8;
  const c = clamp(close, 0, 1);
  // The left half and its cover.
  poly(ctx, [x - 40, y + 4, x, y + 6, x, y - 8, x - 38, y - 12], '#2f6b48', 2);
  poly(ctx, [x - 36, y + 1, x - 1, y + 3, x - 1, y - 8, x - 34, y - 11], '#f6f0e0', 1.5);
  ctx.strokeStyle = 'rgba(80, 120, 160, 0.6)';
  ctx.lineWidth = 0.8;
  for (let k = 1; k < 4; k += 1) {
    ctx.beginPath();
    ctx.moveTo(x - 34, y - 11 + k * 3.2);
    ctx.lineTo(x - 2, y - 8 + k * 3);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200, 60, 60, 0.6)';
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 9);
  ctx.lineTo(x - 12, y + 2);
  ctx.stroke();
  // The right half: open, then swung over onto the left as he closes it.
  const turn = Math.cos(Math.PI * c);
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(turn, 1);
  const lift = Math.sin(Math.PI * c) * 8;
  poly(ctx, [0, y + 6, 40, y + 4, 38, y - 12 - lift, 0, y - 8 - lift * 0.4], c < 0.5 ? '#2f6b48' : '#2f6b48', 2);
  if (c < 0.5) {
    poly(ctx, [1, y + 3, 36, y + 1, 34, y - 11 - lift, 1, y - 8 - lift * 0.4], '#f6f0e0', 1.5);
    ctx.strokeStyle = 'rgba(80, 120, 160, 0.6)';
    ctx.lineWidth = 0.8;
    for (let k = 1; k < 4; k += 1) {
      ctx.beginPath();
      ctx.moveTo(2, y - 8 + k * 3);
      ctx.lineTo(34, y - 11 + k * 3.2);
      ctx.stroke();
    }
  } else {
    // The cover, face up once it is shut.
    ctx.scale(-1, 1);
    label(ctx, 'LEDGER', -20, y - 3, 6, '#e8c25a', 900, 30);
  }
  ctx.restore();
}

/** The moth that flies out of the empty ledger as it shuts. */
export function drawMoth(ctx: CanvasRenderingContext2D, d: ParlorDrive): void {
  if (d.ct < CRASH_AT.moth[0] || d.ct > CRASH_AT.moth[1]) return;
  const u = (d.ct - CRASH_AT.moth[0]) / (CRASH_AT.moth[1] - CRASH_AT.moth[0]);
  const x = LECTERN.x - 10 - 120 * u + Math.sin(u * 19) * 9;
  const y = LECTERN.top - 14 - 150 * u + Math.sin(u * 31) * 5;
  const flap = Math.abs(Math.sin(d.ct * 38));
  ctx.save();
  ctx.globalAlpha = 1 - smoothstep(0.8, 1, u);
  ctx.translate(x, y);
  for (const side of [-1, 1]) blob(ctx, side * 4, -1, 4.5, 3 + 2 * flap, '#b9ab90', 1.2, side * 0.5);
  blob(ctx, 0, 0, 1.6, 4, '#7a6a50', 1);
  ctx.restore();
}

// ─── The guest book ────────────────────────────────────────────────────────────────────────────────────
/** The HOLDERS guest book on its stand by the door: it turns its own pages, and at the crash turns to WEN WAKE #2. */
export function drawGuestBook(ctx: CanvasRenderingContext2D, p: Parlor, d: ParlorDrive): void {
  const { x, top, floor } = STAND;
  // The stand: a column, a foot, the slanted rest and its brass plate.
  stamp(ctx, 'stand', 0, 0, x - 62, top - 6, 124, floor - top + 10, (g) => {
    box(g, x - 8, top + 8, 16, floor - top - 14, 2, '#3c2620', 2.5);
    poly(g, [x - 26, floor, x + 26, floor, x + 18, floor - 8, x - 18, floor - 8], '#4a3027', 2.5);
    poly(g, [x - 58, top + 12, x + 58, top + 12, x + 52, top - 2, x - 52, top - 2], '#5a3a2c', 2.5);
    box(g, x - 24, top + 16, 48, 11, 2, '#c9a65a', 1.6);
    label(g, 'HOLDERS', x, top + 21.5, 7.5, '#3a2616', 900, 44);
  });
  // The open book: two pages, the left headed HOLDERS, signatures down both.
  const pageTop = top - 26;
  poly(ctx, [x - 54, top + 2, x, top + 4, x, pageTop + 2, x - 50, pageTop], '#f6f0e0', 1.8);
  poly(ctx, [x, top + 4, x + 54, top + 2, x + 50, pageTop, x, pageTop + 2], '#f6f0e0', 1.8);
  const crashFlip = d.ct >= 0 ? span(d.ct, CRASH_AT.lastPage[0], CRASH_AT.lastPage[1]) : 0;
  const last = crashFlip >= 0.5;
  label(ctx, 'HOLDERS', x - 26, pageTop + 6, 6.5, '#5a2a2a', 900, 40);
  scribbles(ctx, x - 48, pageTop + 10, 42, 3, p.pages * 2);
  if (last) {
    label(ctx, 'WEN', x + 26, pageTop + 10, 8.5, INK, 900, 44);
    label(ctx, 'WAKE #2', x + 26, pageTop + 20, 8.5, INK, 900, 44);
  } else scribbles(ctx, x + 6, pageTop + 4, 42, 4, p.pages * 2 + 1);
  // The page in flight: lifting off the right and laid over on the left.
  const u = crashFlip > 0 && crashFlip < 1 ? crashFlip : p.flipT < FLIP_S ? p.flipT / FLIP_S : -1;
  if (u >= 0) {
    const turn = Math.cos(Math.PI * u);
    const lift = Math.sin(Math.PI * u) * 12;
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(turn, 1);
    poly(ctx, [0, top + 4, 52, top + 2 - lift * 0.3, 48, pageTop - lift, 0, pageTop + 2], turn > 0 ? '#fbf6ea' : '#efe6d2', 1.6);
    ctx.restore();
  }
  // The pen on its chain.
  ink(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(x + 52, top + 4);
  ctx.quadraticCurveTo(x + 60, top + 14, x + 50, top + 10);
  ctx.stroke();
}

/** Seeded signature squiggles, `rows` of them, different for every page. */
function scribbles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rows: number, seed: number): void {
  const r = mulberry32(seed * 977 + 13);
  ctx.strokeStyle = 'rgba(40, 40, 90, 0.75)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < rows; i += 1) {
    const yy = y + i * 5;
    ctx.beginPath();
    ctx.moveTo(x + 2, yy);
    const len = w * (0.4 + 0.5 * r());
    for (let k = 0; k <= 6; k += 1) ctx.lineTo(x + 2 + (len * k) / 6, yy + (r() - 0.5) * 3);
    ctx.stroke();
  }
}

// ─── The reception table ───────────────────────────────────────────────────────────────────────────────
/** What the cousin has taken from the table: sandwiches (0..2) and the candle. */
interface Taken { sandwiches: number; candle: boolean }
/** Where the cousin reaches for the sandwiches and for the candle. */
export const PLATTER = { x: 100, y: TABLE.top + 6 } as const;
export const CANDLE = { x: 118, y: TABLE.top + 22 } as const;

/** The reception table at the frame's edge: the HODL sheet cake (uneaten), the sandwiches and the commemorative candle. */
export function drawReception(ctx: CanvasRenderingContext2D, d: ParlorDrive, taken: Taken): void {
  const { top, front, right } = TABLE;
  stamp(ctx, 'cloth', 0, 0, -12, top - 4, right + 20, 556 - top, (g) => {
    // Cloth: the top seen from above and the skirt down to the frame's edge.
    poly(g, [-10, top, right - 6, top, right, front, -10, front], '#f3eee4', 2.5);
    g.fillStyle = '#e4ddcf';
    ink(g, 2.5);
    g.beginPath();
    g.moveTo(-10, front);
    g.lineTo(right, front);
    g.lineTo(right + 4, 548);
    g.lineTo(-10, 548);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(120, 100, 80, 0.3)';
    g.lineWidth = 2;
    for (let x = 14; x < right; x += 26) {
      g.beginPath();
      g.moveTo(x, front + 4);
      g.lineTo(x + 2, 540);
      g.stroke();
    }
    blob(g, PLATTER.x, PLATTER.y, 22, 6, '#d9dde2', 1.8);
  });
  // The platter, with whatever sandwiches are left.
  for (let k = 0; k < 4 - taken.sandwiches; k += 1) {
    const sx = PLATTER.x - 14 + k * 9;
    poly(ctx, [sx - 5, PLATTER.y + 1, sx + 5, PLATTER.y + 1, sx, PLATTER.y - 8], '#f2dca6', 1.4);
    ctx.fillStyle = '#7fb069';
    ctx.fillRect(sx - 4, PLATTER.y - 1, 8, 1.5);
  }
  const cx = 44;
  const cy = top + 20;
  stamp(ctx, 'cake', 0, 0, cx - 46, cy - 16, 92, 38, (g) => {
    // The sheet cake: HODL in blue icing, piped border, not a slice taken.
    poly(g, [cx - 42, cy + 10, cx + 40, cy + 10, cx + 36, cy - 12, cx - 38, cy - 12], '#fbf8f2', 2.2);
    poly(g, [cx - 42, cy + 10, cx + 40, cy + 10, cx + 40, cy + 18, cx - 42, cy + 18], '#f0d9a8', 2.2);
    g.fillStyle = '#7aa7e0';
    for (let k = 0; k < 16; k += 1) {
      g.beginPath();
      g.arc(mix(cx - 38, cx + 36, k / 15), cy - 10, 1.6, 0, Math.PI * 2);
      g.arc(mix(cx - 41, cx + 39, k / 15), cy + 8, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    g.save();
    g.translate(cx - 1, cy - 1);
    g.scale(1, 0.72);
    g.font = `900 22px ${MEME_FONT}`;
    g.letterSpacing = '2px';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#3f74c4';
    g.fillText('HODL', 0, 0);
    g.letterSpacing = '0px';
    g.restore();
  });
  // The commemorative candle, until the cousin takes it.
  if (!taken.candle) {
    box(ctx, CANDLE.x - 7, CANDLE.y - 22, 14, 24, 2, '#f3ead6', 2);
    box(ctx, CANDLE.x - 6, CANDLE.y - 15, 12, 8, 1, '#5b7fa6', 1);
    ctx.fillStyle = '#ff5050';
    ctx.fillRect(CANDLE.x - 3, CANDLE.y - 12, 2, 1.4);
    ctx.fillRect(CANDLE.x + 1, CANDLE.y - 12, 2, 1.4);
    flame(ctx, CANDLE.x, CANDLE.y - 22, d.amb, 1);
  }
}

/** A candle flame at the wick (x, y), flickering on the ambient clock. */
export function flame(ctx: CanvasRenderingContext2D, x: number, y: number, amb: number, scale: number): void {
  const f = noise(Math.floor(amb * 12) + x);
  const h = (7 + 3 * f) * scale;
  glow(ctx, x, y - h * 0.5, 14 * scale, [255, 200, 110], 0.5);
  ctx.fillStyle = '#ffcf5a';
  ink(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.quadraticCurveTo(x + 4 * scale + (f - 0.5), y - 2 * scale, x, y);
  ctx.quadraticCurveTo(x - 4 * scale + (f - 0.5), y - 2 * scale, x, y - h);
  ctx.fill();
  ctx.stroke();
}

// ─── Crash props ────────────────────────────────────────────────────────────────────────────────────────
/** The push notification that rises out of the casket phone at the crash: DEV SOLD. */
export function drawNotification(ctx: CanvasRenderingContext2D, d: ParlorDrive): void {
  const [a, b] = CRASH_AT.card;
  if (d.ct < a || d.ct > b + 0.35) return;
  const age = d.ct - a;
  const grow = age < 0.3 ? 1 - Math.pow(1 - age / 0.3, 3) * Math.cos((age / 0.3) * 4) : 1;
  const back = smoothstep(b, b + 0.35, d.ct);
  const s = clamp(grow, 0, 1.2) * (1 - back);
  if (s <= 0.02) return;
  const x = mix(480, PHONE.x, back);
  const y = mix(204, PHONE.y, back);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  box(ctx, -110, -26, 220, 52, 12, '#f7f7f9', 3);
  box(ctx, -100, -16, 32, 32, 8, '#d0454c', 2);
  ctx.font = `900 22px ${MEME_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', -84, 1);
  label(ctx, 'PUSH NOTIFICATION · now', -58, -13, 8.5, '#6a6a76', 700, 160, 'left');
  ctx.font = `900 21px ${MEME_FONT}`;
  ctx.letterSpacing = '1px';
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.fillText('DEV SOLD.', -58, 4);
  ctx.letterSpacing = '0px';
  label(ctx, 'Liquidity gone.', -58, 18, 8.5, '#6a6a76', 600, 160, 'left');
  ctx.restore();
}

// ─── The late light ─────────────────────────────────────────────────────────────────────────────────────
/** The venetian-blind light: stripes across the wall and the carpet, and the dust turning in them. */
export function drawLight(ctx: CanvasRenderingContext2D, d: ParlorDrive, dim: number): void {
  const breathe = 0.85 + 0.15 * gust(d.amb * 0.6, 2);
  const a = 0.085 * breathe * (1 - 0.55 * dim);
  ctx.fillStyle = `${LIGHT}${a.toFixed(3)})`;
  ctx.beginPath();
  for (let i = 0; i < 7; i += 1) {
    const x0 = 360 + i * 74;
    // On the wall, falling down and to the left…
    ctx.moveTo(x0, 22);
    ctx.lineTo(x0 + 30, 22);
    ctx.lineTo(x0 + 30 - 150, FLOOR);
    ctx.lineTo(x0 - 150, FLOOR);
    ctx.closePath();
    // …then across the carpet toward us, spreading.
    ctx.moveTo(x0 - 150, FLOOR);
    ctx.lineTo(x0 - 120, FLOOR);
    ctx.lineTo(x0 - 120 - 250 + i * 8, 540);
    ctx.lineTo(x0 - 150 - 300 + i * 8, 540);
    ctx.closePath();
  }
  ctx.fill();
  // Dust in the light, twinkling in three groups.
  for (let group = 0; group < 3; group += 1) {
    const tw = 0.5 + 0.5 * Math.sin(d.amb * 2.1 + group * 2.1);
    ctx.fillStyle = `${LIGHT}${(0.55 * tw * (1 - 0.5 * dim)).toFixed(3)})`;
    ctx.beginPath();
    for (let i = group; i < 18; i += 3) {
      const band = i % 7;
      const u = fract(noise(i * 3.7) + d.amb * (0.012 + 0.01 * noise(i)));
      const y = mix(40, 470, u);
      const x = 360 + band * 74 + 14 - (y < FLOOR ? (y - 22) * 0.49 : 150 + (y - FLOOR) * 1.25) + Math.sin(d.amb * 0.7 + i) * 6;
      ctx.rect(x, y, 1.8, 1.8);
    }
    ctx.fill();
  }
}

/** The post-crash coda: the room dims except the reception table at the frame's edge, where the HODL cake sits uneaten. */
export function drawCoda(ctx: CanvasRenderingContext2D, coda: number): void {
  if (coda <= 0.01) return;
  ctx.fillStyle = `rgba(14, 6, 14, ${(0.38 * coda).toFixed(3)})`;
  ctx.beginPath();
  ctx.rect(0, 0, 960, 540);
  ctx.ellipse(54, TABLE.top + 22, 96, 60, -0.1, 0, Math.PI * 2);
  ctx.fill('evenodd');
  glow(ctx, 50, TABLE.top + 20, 80, [255, 214, 140], 0.3 * coda);
}

