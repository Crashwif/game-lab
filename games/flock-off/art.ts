/**
 * The city's artwork: the sky from golden hour to night, the far skyline, the lots with their storefronts,
 * billboards and street junk, the road, every kind of camera (live, reading, shot), government pigeons,
 * bullet holes and the getaway Kia. Text and shape helpers for the HUD live here too. Everything is a pure
 * function of what it is handed: no state, no clocks of its own.
 */
import { GROUND, SIDEWALK, SEG, type Cam, type Lot, type LotStyle } from './city';

export const C = {
  ink: '#0a0b12', sky0: '#ff9a4a', sky1: '#5a2a6e', night0: '#06070f', night1: '#15123a', star: '#dfe6ff',
  far: '#1d1a33', mid: '#262040', wall: '#3b3350', wallLight: '#4b4166', roof: '#2a2440', trim: '#6b5f8a',
  road: '#2a2b33', roadNight: '#1c1c24', kerb: '#8a8a94', walk: '#6d6d78', walkNight: '#45454f', lane: '#d8c66a',
  window: '#ffd27a', windowOff: '#2a2540', pole: '#8e94a3', poleDark: '#5b606c', camera: '#111218', panel: '#2b3c5c', panelEdge: '#9fb6dd',
  led: '#4da3ff', red: '#ff3b4f', blue: '#3d7bff', white: '#f6f6f8', amber: '#ffb347', lime: '#b7ff5a', pink: '#ff5db1', cyan: '#5ee1ff', gold: '#f2c14e',
  neon: ['#ff5db1', '#5ee1ff', '#b7ff5a', '#ffb347', '#c792ff'],
} as const;

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const noise = (n: number): number => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', maxWidth?: number, weight = 700, family = 'system-ui, sans-serif'): void {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (maxWidth) ctx.fillText(s, x, y, maxWidth); else ctx.fillText(s, x, y);
}

/** Text with a dark outline, for anything over the picture. */
export function outlined(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, maxWidth?: number, weight = 900, align: CanvasTextAlign = 'center'): void {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(6, 7, 15, 0.9)';
  ctx.lineWidth = Math.max(3, size * 0.22);
  if (maxWidth) ctx.strokeText(s, x, y, maxWidth); else ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  if (maxWidth) ctx.fillText(s, x, y, maxWidth); else ctx.fillText(s, x, y);
}

/** A mix of two hex colours, for the day-to-night blends. */
export function blend(a: string, b: string, t: number): string {
  const p = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const u = clamp(t, 0, 1);
  return `rgb(${Math.round(mix(p(a, 1), p(b, 1), u))}, ${Math.round(mix(p(a, 3), p(b, 3), u))}, ${Math.round(mix(p(a, 5), p(b, 5), u))})`;
}

// ---- Sky and the far city ---------------------------------------------------------------------------------------

export function drawSky(ctx: CanvasRenderingContext2D, dusk: number, clock: number, camera: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, 440);
  g.addColorStop(0, blend(C.sky1, C.night0, dusk));
  g.addColorStop(1, blend(C.sky0, C.night1, dusk));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 540);
  // The sun sets as the multiplier climbs; the moon takes over.
  const sunY = mix(300, 470, dusk);
  const sunX = 760 - camera * 0.02;
  ctx.globalAlpha = 1 - dusk;
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(((sunX % 1200) + 1200) % 1200 - 120, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = dusk;
  ctx.fillStyle = '#eef0ff';
  ctx.beginPath();
  ctx.arc(150, mix(40, 90, dusk) + 30, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blend(C.sky1, C.night0, dusk);
  ctx.beginPath();
  ctx.arc(158, mix(40, 90, dusk) + 24, 20, 0, Math.PI * 2);
  ctx.fill();
  // Stars come out with the dark and twinkle.
  if (dusk > 0.2) {
    ctx.fillStyle = C.star;
    for (let k = 0; k < 70; k++) {
      const x = ((noise(k * 3.1) * 1100 - camera * 0.01) % 1000 + 1000) % 1000 - 20;
      const y = noise(k * 7.7) * 260;
      ctx.globalAlpha = (dusk - 0.2) * (0.5 + 0.5 * Math.sin(clock * 2 + k)) * 0.9;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

/** The far skyline and a mid row of warehouses, on parallax. */
export function drawSkyline(ctx: CanvasRenderingContext2D, dusk: number, camera: number, clock: number): void {
  // Far: towers against the sky, with aircraft-warning lights.
  const far = blend(C.far, '#0b0a1a', dusk);
  ctx.fillStyle = far;
  const scroll = camera * 0.18;
  for (let k = -1; k < 14; k++) {
    const i = Math.floor(scroll / 110) + k;
    const x = i * 110 - scroll;
    const h = 60 + noise(i * 1.7) * 150;
    const w = 50 + noise(i * 2.3) * 55;
    ctx.fillRect(x, 330 - h, w, h + 20);
    if (noise(i * 4.1) < 0.3) {
      ctx.fillStyle = (Math.sin(clock * 3 + i) > 0.6) ? C.red : '#5a1a22';
      ctx.fillRect(x + w / 2 - 1.5, 326 - h, 3, 3);
      ctx.fillStyle = far;
    }
    // Lit windows on the towers at night.
    if (dusk > 0.35) {
      ctx.fillStyle = `rgba(255, 210, 120, ${0.5 * (dusk - 0.35)})`;
      for (let r = 0; r < Math.floor(h / 14); r++) for (let c = 0; c < Math.floor(w / 12); c++) if (noise(i * 13 + r * 7 + c * 3) < 0.5) ctx.fillRect(x + 4 + c * 12, 336 - h + r * 14, 5, 7);
      ctx.fillStyle = far;
    }
  }
  // A water tower with the town's name, on the far layer.
  const tx = ((300 - scroll * 1.1) % 1600 + 1600) % 1600 - 200;
  ctx.fillStyle = far;
  ctx.fillRect(tx - 14, 230, 6, 110);
  ctx.fillRect(tx + 30, 230, 6, 110);
  roundRect(ctx, tx - 26, 196, 74, 44, 14);
  ctx.fill();
  text(ctx, 'FLOCKVILLE', tx + 11, 218, 10, blend('#7a7294', '#3b3652', dusk), 'center', 66, 900);
  // Mid: a row of warehouses and rooftops.
  const mid = blend(C.mid, '#100e22', dusk);
  const ms = camera * 0.5;
  ctx.fillStyle = mid;
  for (let k = -1; k < 8; k++) {
    const i = Math.floor(ms / 180) + k;
    const x = i * 180 - ms;
    const h = 70 + noise(i * 5.3) * 60;
    ctx.fillRect(x, 420 - h, 170, h);
    ctx.fillRect(x + 20, 420 - h - 14, 24, 14);
    if (dusk > 0.3) {
      ctx.fillStyle = `rgba(255, 180, 90, ${0.35 * (dusk - 0.3)})`;
      ctx.fillRect(x + 60, 420 - h + 18, 40, 10);
      ctx.fillStyle = mid;
    }
  }
}

// ---- Lots ----------------------------------------------------------------------------------------------------------

const SIGNS = ['VAPE & CRYPTO ATM', 'PAYDAY LOANS', 'BAIL BONDS 24/7', 'DISPENSARY', 'GUN & GRILL', 'URGENT-ISH CARE', 'HOA OFFICE', 'NAILS · TAX · BAIL', 'DOLLAR GENERIC', 'GYM (NO JUDGMENT)', 'PAWN & PRAYER', 'CHICKEN & WIFI', 'BIG DEGEN LIQUOR', 'TATTOO · NOTARY', 'MATTRESS SALE (FINAL, AGAIN)', 'COPE DEPOT', 'LAUNDROMAT & LAWYER'] as const;
const BILLBOARDS = ['INJURED? CALL 1-800-COPE', 'WE BUY HOUSES (AND YOUR DATA)', 'FLOCK: WE SEE YOU. ALL OF YOU. ALWAYS.', 'NEXTDOOR · NOW WITH 40% MORE KAREN', 'RING · EVERY DOORBELL A SNITCH', 'JESUS IS COMING. LOOK BUSY.', 'LAWYER? NO. VIBES? YES.', '1984 WAS NOT AN INSTRUCTION MANUAL', 'TOUCH GRASS · $4.99 / LB', 'YOUR AD HERE (WE KNOW WHERE YOU LIVE)', 'DRINK WATER · THE GOVT', "BIRDS AREN'T REAL", 'HE HAS NO PLATE. WE CHECKED.', 'LIVE LAUGH LITIGATE'] as const;
const GRAFFITI = ['NO FACE NO CASE', 'FLOCK OFF', "BIRDS AREN'T REAL", 'DEFLOCK THE BLOCK', 'TOUCH GRASS', 'WAGMI (NOT YOU)'] as const;
const CHURCH = ['WE PRAY FOR GREEN CANDLES', 'SUNDAY: FORGIVENESS. MONDAY: LEVERAGE.', 'HE IS WATCHING (SO IS FLOCK)', 'REPENT · THEN RESUBMIT'] as const;

function windows(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, w: number, h: number, gap: number, seed: number, dusk: number): void {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lit = noise(seed + r * 11 + c * 3) < mix(0.1, 0.65, dusk);
    ctx.fillStyle = lit ? `rgba(255, 210, 122, ${mix(0.4, 1, dusk)})` : C.windowOff;
    ctx.fillRect(x + c * (w + gap), y + r * (h + gap), w, h);
  }
}

function neonSign(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, w: number, color: string, dusk: number, clock: number, seed: number): void {
  // A sign band: dark, with the copy glowing more as the light goes, and one letter that flickers.
  roundRect(ctx, x, y - 11, w, 22, 4);
  ctx.fillStyle = '#121221';
  ctx.fill();
  const flicker = Math.sin(clock * 17 + seed * 50) > 0.92 ? 0.35 : 1;
  ctx.globalAlpha = mix(0.75, 1, dusk) * flicker;
  if (dusk > 0.2) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * dusk;
  }
  text(ctx, s, x + w / 2, y + 1, 12, color, 'center', w - 10, 900);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/** One lot of the city, standing on the sidewalk; `x` is its left edge on screen. */
export function drawLot(ctx: CanvasRenderingContext2D, lot: Lot, x: number, dusk: number, clock: number): void {
  const wall = blend(C.wall, '#1e1a2e', dusk * 0.8);
  const wallLight = blend(C.wallLight, '#2a2440', dusk * 0.8);
  const roof = blend(C.roof, '#151224', dusk * 0.8);
  // Lots stand a little back from the kerb, so a strip of pavement shows in front of them.
  const base = SIDEWALK - 14;
  const w = SEG - 16;
  const neon = C.neon[lot.sign % C.neon.length]!;
  switch (lot.style) {
    case 'strip': {
      ctx.fillStyle = wall;
      ctx.fillRect(x, base - 112, w, 112);
      ctx.fillStyle = roof;
      ctx.fillRect(x - 4, base - 118, w + 8, 8);
      // Two units: a door each, glass fronts and the sign band.
      for (let u = 0; u < 2; u++) {
        const ux = x + 10 + u * (w / 2);
        ctx.fillStyle = wallLight;
        ctx.fillRect(ux, base - 72, w / 2 - 20, 72);
        windows(ctx, ux + 8, base - 64, 3, 2, 22, 20, 6, lot.sign + u * 5, dusk);
        ctx.fillStyle = '#1a1826';
        ctx.fillRect(ux + w / 2 - 46, base - 56, 20, 56);
        ctx.fillStyle = C.gold;
        ctx.fillRect(ux + w / 2 - 31, base - 30, 2, 4);
        neonSign(ctx, SIGNS[(lot.sign + u * 7) % SIGNS.length]!, ux - 2, base - 88, w / 2 - 16, C.neon[(lot.sign + u * 3) % C.neon.length]!, dusk, clock, lot.variant + u);
      }
      break;
    }
    case 'house': {
      // A suburban house with a porch light, a Ring-shaped hole in the vibe, and a lawn sign.
      const hx = x + 50, hw = w - 100;
      ctx.fillStyle = blend('#6a5b78', '#2b2538', dusk * 0.8);
      ctx.fillRect(hx, base - 88, hw, 88);
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(hx - 12, base - 86); ctx.lineTo(hx + hw / 2, base - 134); ctx.lineTo(hx + hw + 12, base - 86);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1826';
      ctx.fillRect(hx + 24, base - 58, 22, 58);
      ctx.fillStyle = `rgba(255, 220, 150, ${mix(0.2, 0.9, dusk)})`;
      ctx.beginPath();
      ctx.arc(hx + 54, base - 64, 3, 0, Math.PI * 2);
      ctx.fill();
      windows(ctx, hx + 66, base - 66, 2, 1, 26, 24, 10, lot.sign, dusk);
      // The lawn, the sign and the flamingo.
      ctx.fillStyle = blend('#3f6b3a', '#1c2e1c', dusk * 0.8);
      ctx.fillRect(x + 6, base - 6, w - 12, 6);
      ctx.fillStyle = C.white;
      ctx.fillRect(x + 20, base - 30, 2, 26);
      roundRect(ctx, x + 8, base - 44, 42, 18, 2);
      ctx.fillStyle = lot.variant < 0.5 ? C.blue : C.red;
      ctx.fill();
      text(ctx, lot.variant < 0.5 ? 'MORE CAMERAS' : 'HOA: VOTE NO', x + 29, base - 35, 7, C.white, 'center', 38, 900);
      ctx.fillStyle = C.pink;
      ctx.beginPath();
      ctx.ellipse(x + w - 30, base - 18, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + w - 31, base - 16, 1.5, 14);
      break;
    }
    case 'warehouse': {
      ctx.fillStyle = wall;
      ctx.fillRect(x, base - 96, w, 96);
      ctx.fillStyle = roof;
      ctx.fillRect(x - 4, base - 102, w + 8, 8);
      ctx.fillStyle = '#23202f';
      ctx.fillRect(x + 30, base - 62, 70, 62);
      ctx.strokeStyle = '#3a3648';
      ctx.lineWidth = 1;
      for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + 30, base - 62 + k * 10); ctx.lineTo(x + 100, base - 62 + k * 10); ctx.stroke(); }
      windows(ctx, x + 120, base - 84, 5, 1, 24, 16, 8, lot.sign, dusk);
      // Spray paint, the local newspaper.
      ctx.save();
      ctx.translate(x + 200, base - 34);
      ctx.rotate(-0.06);
      text(ctx, GRAFFITI[lot.sign % GRAFFITI.length]!, 0, 0, 15, C.neon[(lot.sign + 1) % C.neon.length]!, 'center', 150, 900, 'Impact, "Arial Black", system-ui, sans-serif');
      ctx.restore();
      break;
    }
    case 'church': {
      const cx = x + 60, cw = w - 120;
      ctx.fillStyle = blend('#d9d4e6', '#4a4660', dusk * 0.85);
      ctx.fillRect(cx, base - 100, cw, 100);
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(cx - 8, base - 98); ctx.lineTo(cx + cw / 2, base - 150); ctx.lineTo(cx + cw + 8, base - 98);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = blend('#d9d4e6', '#4a4660', dusk * 0.85);
      ctx.fillRect(cx + cw / 2 - 10, base - 190, 20, 60);
      ctx.fillStyle = C.gold;
      ctx.fillRect(cx + cw / 2 - 1.5, base - 212, 3, 22);
      ctx.fillRect(cx + cw / 2 - 7, base - 206, 14, 3);
      ctx.fillStyle = '#1a1826';
      ctx.beginPath();
      ctx.moveTo(cx + cw / 2 - 12, base); ctx.lineTo(cx + cw / 2 - 12, base - 46); ctx.arc(cx + cw / 2, base - 46, 12, Math.PI, 0); ctx.lineTo(cx + cw / 2 + 12, base);
      ctx.fill();
      // The roadside letter board.
      ctx.fillStyle = '#efe9d8';
      ctx.fillRect(x + 8, base - 58, 2, 54);
      ctx.fillRect(x + 46, base - 58, 2, 54);
      roundRect(ctx, x + 2, base - 86, 52, 30, 3);
      ctx.fill();
      text(ctx, 'CHURCH OF', x + 28, base - 78, 7, '#2b2538', 'center', 48, 900);
      text(ctx, 'LATTER-DAY DEGENS', x + 28, base - 70, 6, '#2b2538', 'center', 48, 900);
      text(ctx, CHURCH[lot.sign % CHURCH.length]!, x + 28, base - 61, 5, '#8a2b2b', 'center', 48, 800);
      break;
    }
    case 'gas': {
      // A canopy over two pumps and a price nobody likes.
      ctx.fillStyle = wall;
      ctx.fillRect(x + w - 90, base - 70, 90, 70);
      windows(ctx, x + w - 82, base - 56, 3, 1, 22, 20, 6, lot.sign, dusk);
      ctx.fillStyle = C.poleDark;
      ctx.fillRect(x + 40, base - 110, 6, 110);
      ctx.fillRect(x + 150, base - 110, 6, 110);
      ctx.fillStyle = blend('#e9e4f3', '#5a5470', dusk * 0.85);
      ctx.fillRect(x + 10, base - 124, 190, 16);
      ctx.fillStyle = `rgba(255, 245, 200, ${mix(0.1, 0.8, dusk)})`;
      ctx.fillRect(x + 14, base - 108, 182, 4);
      for (const px of [x + 70, x + 120]) {
        ctx.fillStyle = C.red;
        ctx.fillRect(px, base - 40, 18, 40);
        ctx.fillStyle = '#1a1826';
        ctx.fillRect(px + 3, base - 36, 12, 10);
      }
      roundRect(ctx, x + 6, base - 100, 36, 50, 3);
      ctx.fillStyle = '#1a1826';
      ctx.fill();
      text(ctx, 'GAS', x + 24, base - 90, 9, C.white, 'center', 32, 900);
      text(ctx, '$9.99⁹', x + 24, base - 76, 10, C.amber, 'center', 32, 900);
      text(ctx, '(SORRY)', x + 24, base - 62, 6, C.white, 'center', 32, 800);
      break;
    }
    case 'bank': {
      ctx.fillStyle = blend('#8d8aa6', '#2e2b40', dusk * 0.85);
      ctx.fillRect(x + 20, base - 100, w - 40, 100);
      ctx.fillStyle = roof;
      ctx.fillRect(x + 12, base - 108, w - 24, 10);
      for (let k = 0; k < 4; k++) { ctx.fillStyle = blend('#bfbcd6', '#3b3850', dusk * 0.85); ctx.fillRect(x + 36 + k * 60, base - 94, 12, 94); }
      ctx.fillStyle = '#1a1826';
      ctx.fillRect(x + w / 2 - 14, base - 56, 28, 56);
      neonSign(ctx, lot.variant < 0.5 ? 'BAIL BONDS 24/7' : 'CRYPTO ATM · NO KYC', x + 30, base - 80, w - 60, neon, dusk, clock, lot.variant);
      break;
    }
    case 'lot': {
      // An empty lot behind a chain-link fence, with the sign every town has.
      ctx.strokeStyle = blend('#9a9aa8', '#3d3d4a', dusk * 0.8);
      ctx.lineWidth = 1;
      for (let k = 0; k <= w; k += 10) { ctx.beginPath(); ctx.moveTo(x + k, base - 36); ctx.lineTo(x + k, base); ctx.stroke(); }
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, base - 36 + k * 12); ctx.lineTo(x + w, base - 36 + k * 12); ctx.stroke(); }
      ctx.fillStyle = C.poleDark;
      ctx.fillRect(x + 60, base - 90, 3, 54);
      ctx.fillRect(x + 110, base - 90, 3, 54);
      roundRect(ctx, x + 48, base - 118, 78, 32, 3);
      ctx.fillStyle = C.white;
      ctx.fill();
      text(ctx, 'WE BUY HOUSES', x + 87, base - 108, 8, '#1a1826', 'center', 72, 900);
      text(ctx, 'CASH · ANY CONDITION · ANY VIBE', x + 87, base - 96, 5, '#8a2b2b', 'center', 72, 800);
      // A shopping cart, abandoned.
      ctx.strokeStyle = C.kerb;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 200, base - 22, 22, 14);
      ctx.beginPath(); ctx.moveTo(x + 222, base - 22); ctx.lineTo(x + 230, base - 30); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 204, base - 4, 2.5, 0, Math.PI * 2); ctx.arc(x + 218, base - 4, 2.5, 0, Math.PI * 2); ctx.stroke();
      break;
    }
  }
  // A billboard behind every fifth lot.
  if (lot.billboard >= 0) {
    const bx = x + 150;
    ctx.fillStyle = C.pole;
    ctx.fillRect(bx - 3, base - 190, 6, 110);
    roundRect(ctx, bx - 120, base - 252, 240, 66, 4);
    ctx.fillStyle = '#f3efe6';
    ctx.fill();
    ctx.strokeStyle = '#2b2538';
    ctx.lineWidth = 2;
    ctx.stroke();
    const copy = BILLBOARDS[lot.billboard % BILLBOARDS.length]!;
    text(ctx, copy, bx, base - 219, 13, '#1a1826', 'center', 224, 900);
    ctx.fillStyle = `rgba(255, 240, 200, ${mix(0, 0.5, dusk)})`;
    ctx.fillRect(bx - 110, base - 188, 220, 3);
  }
  // Street junk at the kerb.
  const ix = x + 230;
  switch (lot.item) {
    case 0: ctx.fillStyle = C.red; roundRect(ctx, ix, base - 16, 8, 16, 3); ctx.fill(); ctx.fillRect(ix - 3, base - 10, 14, 3); break;
    case 1: ctx.fillStyle = '#3f4a3a'; ctx.fillRect(ix, base - 18, 14, 18); ctx.fillStyle = '#2a3027'; ctx.fillRect(ix - 2, base - 21, 18, 4); break;
    case 2: ctx.fillStyle = C.poleDark; ctx.fillRect(ix + 4, base - 56, 3, 56); ctx.fillStyle = C.blue; ctx.fillRect(ix - 8, base - 70, 26, 16); text(ctx, 'BUS', ix + 5, base - 62, 8, C.white, 'center', 22, 900); break;
    case 3: ctx.save(); ctx.translate(ix, base - 2); ctx.rotate(0.9); ctx.fillStyle = C.lime; ctx.fillRect(0, -3, 30, 3); ctx.fillRect(28, -14, 2, 14); ctx.restore(); break;
    case 4: ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(ix, base); ctx.lineTo(ix + 5, base - 16); ctx.lineTo(ix + 10, base); ctx.closePath(); ctx.fill(); break;
    default: break;
  }
}

/** The road, the kerb and the sidewalk, with the lane line and the potholes scrolling. */
export function drawRoad(ctx: CanvasRenderingContext2D, dusk: number, camera: number, potholes: number[]): void {
  ctx.fillStyle = blend(C.walk, C.walkNight, dusk);
  ctx.fillRect(0, 418, 960, SIDEWALK - 418 + 2);
  ctx.fillStyle = blend(C.kerb, '#4a4a55', dusk);
  ctx.fillRect(0, SIDEWALK, 960, GROUND - SIDEWALK);
  ctx.fillStyle = blend(C.road, C.roadNight, dusk);
  ctx.fillRect(0, GROUND, 960, 540 - GROUND);
  // Sidewalk joints and the kerb edge.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  for (let k = -1; k < 14; k++) { const x = ((k * 80 - camera) % 80 + 80) % 80 + k * 80 - 80; ctx.beginPath(); ctx.moveTo(x, 418); ctx.lineTo(x, SIDEWALK); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, GROUND, 960, 2);
  // The lane line and the shoulder.
  ctx.fillStyle = blend(C.lane, '#8a7f44', dusk);
  for (let k = -1; k < 12; k++) { const x = ((k * 90 - camera) % 90 + 90) % 90 + k * 90 - 90; ctx.fillRect(x, 504, 48, 4); }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let k = -1; k < 24; k++) { const x = ((k * 40 - camera) % 40 + 40) % 40 + k * 40 - 40; ctx.fillRect(x, 470, 2, 60); }
  for (const px of potholes) {
    const x = px - camera;
    if (x < -40 || x > 1000) continue;
    ctx.fillStyle = '#121218';
    ctx.beginPath();
    ctx.ellipse(x, GROUND + 4, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, GROUND + 3, 26, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---- Cameras -------------------------------------------------------------------------------------------------------

/** A Flock-style head: a black box with a lens, a blue LED, and a "FLOCK" label; shot, it hangs off and sparks. */
function cameraHead(ctx: CanvasRenderingContext2D, x: number, y: number, c: Cam, clock: number, scale = 1): void {
  const dead = c.state === 'dead';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (dead) {
    // It dangles from its cable and swings down over the first second, then hangs still.
    const drop = Math.min(1, c.age / 0.8);
    ctx.strokeStyle = C.poleDark;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4 * drop, 14 * drop);
    ctx.stroke();
    ctx.translate(4 * drop, 14 * drop);
    ctx.rotate(mix(0, 2.4, drop) + Math.sin(c.age * 4) * 0.15 * (1 - drop));
  }
  ctx.fillStyle = C.camera;
  roundRect(ctx, -12, -8, 24, 16, 3);
  ctx.fill();
  ctx.strokeStyle = '#3d4150';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = dead ? '#3a3a44' : '#223049';
  ctx.beginPath();
  ctx.arc(-4, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (!dead) {
    ctx.fillStyle = '#4a6a9c';
    ctx.beginPath();
    ctx.arc(-5, -1, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = Math.sin(clock * 6 + c.variant * 20) > 0 ? C.led : '#1c3a66';
    ctx.fillRect(6, -5, 3, 3);
  } else {
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -3); ctx.lineTo(-1, 3); ctx.moveTo(-1, -3); ctx.lineTo(-7, 3);
    ctx.stroke();
  }
  text(ctx, 'FLOCK', 4, 2, 5, C.white, 'center', 14, 900);
  ctx.restore();
  if (dead && c.age < 0.7) sparks(ctx, x, y, c.age, c.variant);
  if (c.state === 'read' && c.age < 0.9) {
    // The IR flash: it got him.
    const a = 1 - c.age / 0.9;
    ctx.strokeStyle = `rgba(255, 80, 80, ${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 4 * scale, y, 8 + 22 * (1 - a), 0, Math.PI * 2);
    ctx.stroke();
    outlined(ctx, 'READ', x, y - 22 - 12 * (1 - a), 11, C.red);
  }
}

export function sparks(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, seed: number): void {
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a = noise(seed * 100 + k) * Math.PI * 2;
    const v = 90 + noise(seed * 50 + k) * 160;
    const t = age;
    const px = x + Math.cos(a) * v * t;
    const py = y + Math.sin(a) * v * t + 300 * t * t;
    ctx.fillStyle = k % 2 ? C.amber : C.white;
    ctx.globalAlpha = clamp(1 - age / 0.7, 0, 1);
    ctx.fillRect(px - 1, py - 1, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
  if (age < 0.18) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 30);
    g.addColorStop(0, `rgba(255, 255, 230, ${1 - age / 0.18})`);
    g.addColorStop(1, 'rgba(255, 180, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

function solarPanel(ctx: CanvasRenderingContext2D, x: number, y: number, dead: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dead ? 0.6 : -0.35);
  ctx.fillStyle = C.panel;
  ctx.fillRect(-14, -6, 28, 12);
  ctx.strokeStyle = C.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(-14, -6, 28, 12);
  ctx.beginPath();
  ctx.moveTo(-7, -6); ctx.lineTo(-7, 6); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(7, -6); ctx.lineTo(7, 6);
  ctx.stroke();
  if (dead) {
    ctx.strokeStyle = C.white;
    ctx.beginPath();
    ctx.moveTo(-10, -4); ctx.lineTo(2, 2); ctx.lineTo(8, -3);
    ctx.stroke();
  }
  ctx.restore();
}

/** A camera on its mount, at its screen position; `p` is the lens point the hit test uses. */
export function drawCam(ctx: CanvasRenderingContext2D, c: Cam, p: { x: number; y: number }, dusk: number, clock: number): void {
  const dead = c.state === 'dead';
  const base = SIDEWALK;
  switch (c.kind) {
    case 'pole': {
      ctx.fillStyle = C.pole;
      ctx.fillRect(p.x - 2.5, p.y - 24, 5, base - p.y + 24);
      ctx.fillStyle = C.poleDark;
      ctx.fillRect(p.x - 6, base - 6, 12, 6);
      solarPanel(ctx, p.x, p.y - 28, dead);
      cameraHead(ctx, p.x, p.y, c, clock);
      break;
    }
    case 'lamp': {
      // A streetlight with the camera bolted on under the arm.
      ctx.fillStyle = C.pole;
      ctx.fillRect(p.x - 3, p.y - 30, 6, base - p.y + 30);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 30);
      ctx.quadraticCurveTo(p.x + 10, p.y - 48, p.x + 44, p.y - 44);
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.pole;
      ctx.stroke();
      ctx.fillStyle = '#d8dce6';
      roundRect(ctx, p.x + 36, p.y - 48, 22, 8, 2);
      ctx.fill();
      if (dusk > 0.15) {
        const g = ctx.createRadialGradient(p.x + 47, p.y - 40, 0, p.x + 47, p.y - 40, 120);
        g.addColorStop(0, `rgba(255, 220, 150, ${0.28 * dusk})`);
        g.addColorStop(1, 'rgba(255, 220, 150, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(p.x + 36, p.y - 40);
        ctx.lineTo(p.x - 40, base);
        ctx.lineTo(p.x + 140, base);
        ctx.closePath();
        ctx.fill();
      }
      cameraHead(ctx, p.x + 4, p.y, c, clock);
      break;
    }
    case 'signal': {
      // A signal mast reaching out over the road, lights and camera at the end of the arm.
      const mast = p.x + 150;
      ctx.fillStyle = C.poleDark;
      ctx.fillRect(mast - 4, p.y - 36, 8, base - p.y + 36);
      ctx.fillRect(p.x - 10, p.y - 36, mast - p.x + 14, 6);
      ctx.fillStyle = '#1a1a22';
      roundRect(ctx, p.x + 40, p.y - 30, 14, 40, 3);
      ctx.fill();
      const phase = Math.floor(clock / 2.5) % 3;
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k === phase ? [C.red, C.amber, '#39d353'][k]! : '#2a2a33';
        ctx.beginPath();
        ctx.arc(p.x + 47, p.y - 22 + k * 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = C.poleDark;
      ctx.fillRect(p.x - 2, p.y - 30, 4, 22);
      cameraHead(ctx, p.x, p.y, c, clock);
      break;
    }
    case 'ring': {
      // A doorbell on a post: the suburb's smallest snitch.
      ctx.fillStyle = '#8b6a4a';
      ctx.fillRect(p.x - 3, p.y - 10, 6, base - p.y + 10);
      ctx.fillStyle = '#e8e8ee';
      roundRect(ctx, p.x - 6, p.y - 10, 12, 22, 3);
      ctx.fill();
      ctx.strokeStyle = dead ? C.red : C.led;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 4, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = dead ? '#3a3a44' : '#223049';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (dead) {
        ctx.strokeStyle = C.white;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - 4, p.y - 8); ctx.lineTo(p.x + 4, p.y); ctx.moveTo(p.x + 4, p.y - 8); ctx.lineTo(p.x - 4, p.y);
        ctx.stroke();
        if (c.age < 0.7) sparks(ctx, p.x, p.y, c.age, c.variant);
      } else if (c.state === 'read' && c.age < 0.9) {
        const a = 1 - c.age / 0.9;
        ctx.strokeStyle = `rgba(77, 163, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 + 18 * (1 - a), 0, Math.PI * 2);
        ctx.stroke();
        outlined(ctx, 'DING', p.x, p.y - 18 - 10 * (1 - a), 11, C.led);
      }
      break;
    }
    case 'speed': {
      // A speed camera: a chunky box with a radar dish and a flash the size of a bad decision.
      ctx.fillStyle = C.pole;
      ctx.fillRect(p.x - 4, p.y, 8, base - p.y);
      ctx.fillStyle = dead ? '#2a2a33' : '#d9d9e0';
      roundRect(ctx, p.x - 18, p.y - 14, 36, 28, 4);
      ctx.fill();
      ctx.strokeStyle = '#3b3b48';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = dead ? '#3a3a44' : '#223049';
      ctx.beginPath();
      ctx.arc(p.x - 7, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1826';
      roundRect(ctx, p.x + 4, p.y - 8, 10, 16, 2);
      ctx.fill();
      text(ctx, dead ? 'LOL' : '30', p.x + 9, p.y, 6, dead ? C.red : C.amber, 'center', 10, 900);
      if (dead) { ctx.strokeStyle = C.white; ctx.beginPath(); ctx.moveTo(p.x - 12, p.y - 6); ctx.lineTo(p.x - 2, p.y + 6); ctx.stroke(); if (c.age < 0.7) sparks(ctx, p.x, p.y, c.age, c.variant); }
      else if (c.state === 'read' && c.age < 0.5) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(1 - c.age / 0.5) * 0.8})`;
        ctx.fillRect(p.x - 60, p.y - 60, 120, 120);
        outlined(ctx, 'FLASH', p.x, p.y - 26, 11, C.white);
      }
      break;
    }
    case 'trailer': {
      // A mobile trailer with a mast of three heads; each hit knocks one off.
      ctx.fillStyle = '#d2d4dd';
      roundRect(ctx, p.x - 44, base - 40, 88, 34, 4);
      ctx.fill();
      ctx.fillStyle = C.camera;
      ctx.beginPath();
      ctx.arc(p.x - 26, base - 4, 7, 0, Math.PI * 2);
      ctx.arc(p.x + 26, base - 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.pole;
      ctx.fillRect(p.x - 3, p.y, 6, base - 40 - p.y);
      solarPanel(ctx, p.x - 20, base - 50, dead);
      text(ctx, 'FLOCK MOBILE', p.x, base - 24, 8, '#1a1826', 'center', 80, 900);
      text(ctx, 'UNIT (BETA)', p.x, base - 14, 6, '#8a2b2b', 'center', 80, 800);
      const heads = 3 - c.hits;
      for (let k = 0; k < 3; k++) {
        const hx = p.x + (k - 1) * 18;
        const hy = p.y + (k === 1 ? -8 : 2);
        if (k < heads) cameraHead(ctx, hx, hy, { ...c, state: 'live' }, clock, 0.85);
        else if (c.age < 0.7 && k === heads) sparks(ctx, hx, hy, c.age, c.variant + k);
        else if (dead || k >= heads) { ctx.strokeStyle = C.poleDark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 3, hy + 12); ctx.stroke(); }
      }
      if (c.state === 'read' && c.age < 0.9) outlined(ctx, 'READ ×3', p.x, p.y - 30, 11, C.red);
      break;
    }
    case 'bird': {
      drawBird(ctx, p.x, p.y, c, clock);
      break;
    }
  }
}

/** A pigeon that is, on inspection, a drone. Shot, it sheds a propeller and a battery. */
export function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, c: Cam, clock: number): void {
  if (c.state === 'dead') {
    const t = c.age;
    ctx.fillStyle = '#9aa0ad';
    for (let k = 0; k < 4; k++) {
      const a = noise(c.variant * 30 + k) * Math.PI * 2;
      const v = 40 + noise(c.variant * 40 + k) * 60;
      ctx.save();
      ctx.translate(x + Math.cos(a) * v * t, y + Math.sin(a) * v * t + 260 * t * t);
      ctx.rotate(t * 9 + k);
      if (k === 0) { ctx.fillStyle = C.camera; ctx.fillRect(-5, -2, 10, 4); }
      else if (k === 1) { ctx.fillStyle = C.amber; ctx.fillRect(-3, -4, 6, 8); }
      else { ctx.fillStyle = '#9aa0ad'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (t < 0.5) {
      ctx.globalAlpha = 1 - t / 0.5;
      outlined(ctx, 'DRONE', x, y - 16 - t * 30, 11, C.amber);
      ctx.globalAlpha = 1;
    }
    return;
  }
  const flap = Math.sin(clock * 14 + c.variant * 10);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(c.vx < 0 ? 1 : -1, 1);
  ctx.fillStyle = '#8c93a3';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6f7686';
  ctx.beginPath();
  ctx.moveTo(-2, -2); ctx.quadraticCurveTo(2, -10 * flap - 4, 10, -8 * flap - 2); ctx.lineTo(3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5c6e9a';
  ctx.beginPath();
  ctx.arc(-9, -2, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.amber;
  ctx.beginPath();
  ctx.moveTo(-12, -2); ctx.lineTo(-15, -1); ctx.lineTo(-12, 0);
  ctx.fill();
  // The tell: a tiny red light on its chest, blinking like a router.
  ctx.fillStyle = Math.sin(clock * 9 + c.variant * 7) > 0.3 ? C.red : '#4a2a2a';
  ctx.fillRect(-4, 1, 2, 2);
  ctx.restore();
}

export function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number, age: number): void {
  ctx.fillStyle = '#0a0a10';
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(230, 230, 240, ${0.5 * clamp(1 - age / 20, 0, 1)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 3.8, 0, Math.PI * 2);
  ctx.stroke();
  if (age < 0.35) {
    ctx.fillStyle = `rgba(200, 190, 170, ${(1 - age / 0.35) * 0.6})`;
    ctx.beginPath();
    ctx.arc(x + age * 20, y - age * 30, 4 + age * 20, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The tracer of a shot: a bright line from the muzzle out past the reticle that fades in a tenth of a second. */
export function drawTracer(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, age: number): void {
  const a = clamp(1 - age / 0.1, 0, 1);
  if (a <= 0) return;
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  ctx.strokeStyle = `rgba(255, 240, 180, ${0.9 * a})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x + dx / d * 60, to.y + dy / d * 60);
  ctx.stroke();
}

/** The reticle: a crosshair that tightens when it sits on something, and says who is holding the gun. */
export function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number, onTarget: boolean, clock: number, label: string | null, color: string, faint = false): void {
  const r = onTarget ? 12 : 16 + Math.sin(clock * 5) * 1.5;
  ctx.save();
  ctx.globalAlpha = faint ? 0.45 : 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    ctx.moveTo(x + ax * (r - 5), y + ay * (r - 5));
    ctx.lineTo(x + ax * (r + 7), y + ay * (r + 7));
  }
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y - 1, 2, 2);
  if (label) outlined(ctx, label, x, y + r + 14, 10, color);
  ctx.restore();
}

/** The getaway: a hatchback with a USB cable where the key should be. */
export function drawKia(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, doorOpen: number, dusk: number): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(clock * 20) * 0.6);
  ctx.fillStyle = '#b9c4cf';
  roundRect(ctx, -58, -30, 116, 26, 7);
  ctx.fill();
  ctx.fillStyle = '#9aa6b2';
  ctx.beginPath();
  ctx.moveTo(-36, -30); ctx.lineTo(-24, -50); ctx.lineTo(30, -50); ctx.lineTo(44, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1c2230';
  ctx.beginPath();
  ctx.moveTo(-32, -31); ctx.lineTo(-22, -47); ctx.lineTo(0, -47); ctx.lineTo(0, -31);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -31); ctx.lineTo(4, -47); ctx.lineTo(27, -47); ctx.lineTo(38, -31);
  ctx.closePath();
  ctx.fill();
  // The passenger door swings open toward the camera.
  if (doorOpen > 0) {
    ctx.fillStyle = '#b9c4cf';
    ctx.save();
    ctx.translate(4, -30);
    ctx.scale(1, 1 + doorOpen * 0.6);
    roundRect(ctx, 0, 0, 36, 24, 4);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#121218';
  ctx.beginPath();
  ctx.arc(-34, -4, 9, 0, Math.PI * 2);
  ctx.arc(36, -4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c6ccd8';
  ctx.beginPath();
  ctx.arc(-34, -4, 4, 0, Math.PI * 2);
  ctx.arc(36, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dusk > 0.3 ? '#fff2b0' : '#d9d9e0';
  ctx.fillRect(52, -24, 6, 5);
  ctx.fillStyle = C.red;
  ctx.fillRect(-58, -24, 5, 5);
  ctx.fillStyle = C.white;
  roundRect(ctx, -46, -16, 26, 9, 1);
  ctx.fill();
  text(ctx, 'USB 4EVR', -33, -11.5, 6, '#1a1826', 'center', 24, 900);
  text(ctx, 'KIA (BOYS EDITION)', 2, -22, 6, '#3b3b48', 'center', 70, 900);
  ctx.restore();
}
