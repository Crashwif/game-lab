/**
 * Canvas 2D drawing for the strait: the sky and its time of day, the Iranian coast on the horizon, the
 * islands and tankers in the far water, the lanes, the hazards, the castaways on their pool floaties, the
 * disco ball and the Pride Air helicopter. Everything here only draws; state lives in strait.ts and scene.ts.
 */
import { clamp, depthScale } from './strait';

export interface Layout {
  width: number;
  height: number;
  /** The coastline on the horizon. */
  horizon: number;
  /** The waterline at depth 0 (the far lane) and depth 1 (the near lane). */
  farY: number;
  nearY: number;
  /** Midship on screen, and px on screen per px along the strait. */
  shipX: number;
  zoom: number;
  portrait: boolean;
}

export const waterY = (L: Layout, d: number): number => L.farY + (L.nearY - L.farY) * d;
export const screenX = (L: Layout, x: number, distance: number): number => L.shipX + (x - distance) * L.zoom;
export const scaleAt = (L: Layout, d: number): number => depthScale(d) * L.zoom;

export const PRIDE = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'] as const;
export const C = {
  ink: '#140f2e', panel: 'rgba(20, 15, 46, 0.82)', white: '#fdfbff', pink: '#ff4fa3', cyan: '#4de1ff', gold: '#ffd166',
  lime: '#b8f36b', red: '#ff3b4f', amber: '#ffb347', muted: '#c9c1e6', navy: '#1d2550',
};
const SKIN = ['#f1c7a5', '#d9a27a', '#a86b43', '#6e4529', '#f6d5b8', '#c68e64'] as const;
const SHIRTS = ['#ff4fa3', '#4de1ff', '#ffed00', '#b8f36b', '#ff8c00', '#a77bff', '#ffffff', '#ff6b6b'] as const;

// ---- Colour helpers ---------------------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const u = clamp(t, 0, 1);
  return `rgb(${Math.round(ar + (br - ar) * u)}, ${Math.round(ag + (bg - ag) * u)}, ${Math.round(ab + (bb - ab) * u)})`;
}
/** A colour along stops at 0, 1/3, 2/3 and 1 of the day: afternoon, golden hour, sunset, night. */
function along(stops: readonly string[], t: number): string {
  const u = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(u));
  return mixColor(stops[i]!, stops[i + 1]!, u - i);
}

export const SKY_TOP = ['#55b2e6', '#6684cc', '#3a2878', '#090b29'] as const;
export const SKY_LOW = ['#ffeacb', '#ffbd7a', '#ff7aa8', '#38225e'] as const;
export const SEA_FAR = ['#4fb6c9', '#5a9db6', '#6466a3', '#1b2f56'] as const;
export const SEA_NEAR = ['#106a8d', '#1a5b82', '#25406f', '#07152d'] as const;
const RIDGE_FAR = ['#c4a68f', '#c08d7a', '#7a4f86', '#221c40'] as const;
const RIDGE_NEAR = ['#a8836c', '#9d6b60', '#5b3a6b', '#181432'] as const;
const COAST = ['#ddc69c', '#d7aa82', '#9a6d86', '#2c2546'] as const;
export const seaFar = (dusk: number): string => along(SEA_FAR, dusk);
export const seaNear = (dusk: number): string => along(SEA_NEAR, dusk);

// ---- Small helpers ----------------------------------------------------------------------------------------

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function text(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', max?: number, weight = 800): void {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (max !== undefined) ctx.fillText(line, x, y, max);
  else ctx.fillText(line, x, y);
}

/** Text with a dark outline, so it reads over the hull, the sky or the sea. */
export function outlined(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size: number, color: string, max?: number): void {
  ctx.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20, 15, 46, 0.85)';
  ctx.strokeText(line, x, y, max);
  ctx.fillStyle = color;
  ctx.fillText(line, x, y, max);
}

/** Text in pride stripes: each letter takes the next colour. */
export function rainbowText(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size: number, shadow = true): void {
  ctx.font = `italic 900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let at = x;
  let i = 0;
  for (const ch of line) {
    const w = ctx.measureText(ch).width;
    if (ch !== ' ') {
      if (shadow) { ctx.fillStyle = 'rgba(10, 6, 30, 0.55)'; ctx.fillText(ch, at + 2, y + 2); }
      ctx.fillStyle = PRIDE[i % PRIDE.length]!;
      ctx.fillText(ch, at, y);
      i++;
    }
    at += w;
  }
}

/** A four-point sparkle. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const wrap = (v: number, period: number): number => ((v % period) + period) % period;

// ---- Sky, mountains and the coast -------------------------------------------------------------------------

/** `dusk` runs 0 (afternoon) to 1 (night) over a long round; `clock` is seconds of scene time. */
export function drawSky(ctx: CanvasRenderingContext2D, L: Layout, dusk: number, clock: number, scroll: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, L.horizon);
  sky.addColorStop(0, along(SKY_TOP, dusk));
  sky.addColorStop(1, along(SKY_LOW, dusk));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, L.width, L.horizon + 2);
  // Stars come out after sunset.
  const stars = clamp((dusk - 0.62) / 0.3, 0, 1);
  if (stars > 0) {
    for (let i = 0; i < 70; i++) {
      const x = hash(i) * L.width;
      const y = hash(i + 91) * (L.horizon - 30);
      ctx.globalAlpha = stars * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(clock * (1 + hash(i + 7) * 2) + i)));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  // The sun sinks toward Iran's mountains as the round runs long; the moon follows.
  const sunY = L.horizon - L.horizon * 0.62 + L.horizon * 0.66 * clamp(dusk / 0.7, 0, 1);
  const sunX = L.width * 0.78;
  if (dusk < 0.78) {
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
    glow.addColorStop(0, 'rgba(255, 244, 214, 0.9)');
    glow.addColorStop(1, 'rgba(255, 220, 160, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 70, sunY - 70, 140, 140);
    ctx.fillStyle = mixColor('#fff6d8', '#ff9a6b', dusk / 0.7);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  const moon = clamp((dusk - 0.7) / 0.2, 0, 1);
  if (moon > 0) {
    const mx = L.width * 0.2;
    const my = L.horizon * 0.42;
    ctx.globalAlpha = moon;
    ctx.fillStyle = '#f4f1ff';
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = along(SKY_TOP, dusk);
    ctx.beginPath();
    ctx.arc(mx + 6, my - 3, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Clouds drift on their own and with the voyage.
  ctx.fillStyle = mixColor('#ffffff', '#6a5a9a', dusk);
  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 260 - scroll * 0.03 - clock * 5, L.width + 260) - 130;
    const y = L.horizon * (0.18 + 0.13 * (i % 3));
    ctx.globalAlpha = 0.55 - 0.25 * dusk;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(x + k * 22 - 30, y - (k % 2) * 7, 26, 11 - (k % 2) * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function ridge(xw: number, seed: number): number {
  return 26 * Math.abs(Math.sin(xw * 0.0031 + seed)) + 14 * Math.sin(xw * 0.0093 + 1 + seed) + 7 * Math.sin(xw * 0.031 + 2 + seed) + 3 * Math.sin(xw * 0.087 + seed);
}

/** The Zagros on the horizon, two ridges at their own parallax. */
export function drawMountains(ctx: CanvasRenderingContext2D, L: Layout, dusk: number, scroll: number): void {
  const layers: [number, number, readonly string[], number][] = [[0.02, 64, RIDGE_FAR, 0.7], [0.045, 40, RIDGE_NEAR, 2.1]];
  for (const [parallax, height, stops, seed] of layers) {
    ctx.fillStyle = along(stops, dusk);
    ctx.beginPath();
    ctx.moveTo(0, L.horizon + 2);
    for (let x = 0; x <= L.width + 12; x += 12) ctx.lineTo(x, L.horizon - height - ridge(x + scroll * parallax, seed));
    ctx.lineTo(L.width, L.horizon + 2);
    ctx.closePath();
    ctx.fill();
  }
}

/** The coastline's own scroll rate: missiles launch from batteries placed with it. */
export const COAST_PARALLAX = 0.12;

/** A strip of shore with port cranes, radar domes, palms and launch trucks. `launches` flash where missiles leave. */
export function drawCoast(ctx: CanvasRenderingContext2D, L: Layout, dusk: number, scroll: number, launches: readonly { x: number; age: number }[]): void {
  const y = L.horizon;
  ctx.fillStyle = along(COAST, dusk);
  ctx.fillRect(0, y - 6, L.width, 9);
  const segment = 150;
  const shift = scroll * COAST_PARALLAX;
  const first = Math.floor(shift / segment) - 1;
  const ink = mixColor('#7b6a58', '#1c1830', dusk);
  const light = clamp((dusk - 0.55) / 0.3, 0, 1);
  for (let i = first; i < first + Math.ceil(L.width / segment) + 3; i++) {
    const x = i * segment - shift + 30 + hash(i) * 70;
    const kind = Math.floor(hash(i + 0.5) * 6);
    ctx.fillStyle = ink;
    if (kind === 0) { // a block of buildings with lit windows after dark
      for (let k = 0; k < 3; k++) ctx.fillRect(x + k * 9, y - 9 - k * 3 - hash(i + k) * 6, 8, 12 + k * 3);
      if (light > 0) {
        ctx.fillStyle = `rgba(255, 220, 140, ${0.8 * light})`;
        for (let k = 0; k < 5; k++) ctx.fillRect(x + 2 + (k % 3) * 9, y - 6 - (k % 2) * 5, 2, 2);
      }
    } else if (kind === 1) { // a radar dome
      ctx.beginPath();
      ctx.arc(x, y - 6, 6, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 1, y - 6, 2, 6);
    } else if (kind === 2) { // a crane
      ctx.fillRect(x, y - 22, 2, 22);
      ctx.fillRect(x - 10, y - 22, 22, 2);
    } else if (kind === 3) { // palms
      for (let k = 0; k < 2; k++) {
        const px = x + k * 8;
        ctx.fillRect(px, y - 11, 1.5, 11);
        ctx.beginPath();
        ctx.ellipse(px - 3, y - 12, 4, 1.5, -0.3, 0, Math.PI * 2);
        ctx.ellipse(px + 4, y - 12, 4, 1.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else { // a launch truck, its rail raised toward the strait
      ctx.fillRect(x - 9, y - 6, 18, 5);
      ctx.save();
      ctx.translate(x - 4, y - 6);
      ctx.rotate(-0.55);
      ctx.fillRect(0, -2, 16, 3);
      ctx.restore();
    }
  }
  for (const launch of launches) {
    if (launch.age > 1.6) continue;
    const a = launch.age;
    ctx.globalAlpha = clamp(1 - a / 0.25, 0, 1);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(launch.x, y - 7, 6 + a * 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = clamp(0.6 - a * 0.38, 0, 1);
    ctx.fillStyle = mixColor('#e8e4dc', '#6b6584', dusk);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(launch.x + (k - 1.5) * 6 * (1 + a), y - 8 - a * 10 - k * 2, 5 + a * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // A heat haze line where the land meets the water.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(0, y + 2, L.width, 1.5);
}

// ---- The water ----------------------------------------------------------------------------------------------

/** The sea from the shore to the foreground: a gradient, the lanes' buoys and scrolling swell lines. */
export function drawSea(ctx: CanvasRenderingContext2D, L: Layout, dusk: number, distance: number, clock: number): void {
  const sea = ctx.createLinearGradient(0, L.horizon, 0, L.height);
  sea.addColorStop(0, seaFar(dusk));
  sea.addColorStop(1, seaNear(dusk));
  ctx.fillStyle = sea;
  ctx.fillRect(0, L.horizon + 2, L.width, L.height - L.horizon);
  // The sun's path on the water.
  if (dusk < 0.8) {
    ctx.fillStyle = `rgba(255, 236, 190, ${0.3 * (1 - dusk)})`;
    for (let k = 0; k < 18; k++) {
      const y = L.horizon + 6 + k * k * 1.3;
      if (y > L.height) break;
      const w = 6 + k * 2.4;
      ctx.fillRect(L.width * 0.78 - w / 2 + Math.sin(clock * 2 + k) * 4, y, w, 1.5);
    }
  }
  // Swell lines: the further the water, the slower they pass and the shorter they are.
  const rows = 22;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 - 0.1 * dusk})`;
  ctx.lineWidth = 1.2;
  for (let r = 0; r < rows; r++) {
    const u = r / (rows - 1);
    const y = L.horizon + 8 + (L.height - L.horizon - 8) * u * u * 0.6 + (L.height - L.horizon - 8) * u * 0.4;
    const depth = (y - L.farY) / (L.nearY - L.farY);
    const parallax = clamp(0.2 + 0.8 * clamp(depth + 0.4, 0, 1.3), 0.15, 1.3);
    const len = 6 + 22 * u;
    const gap = 50 + 90 * u;
    const off = wrap(distance * L.zoom * parallax + r * 37, gap);
    ctx.beginPath();
    for (let x = -off; x < L.width; x += gap) {
      const wob = Math.sin(clock * 1.7 + x * 0.05 + r) * 1.2;
      ctx.moveTo(x, y + wob);
      ctx.quadraticCurveTo(x + len / 2, y + wob - 1.5, x + len, y + wob);
    }
    ctx.stroke();
  }
  // Channel buoys mark the outbound lane: red on the far side, green on the near side.
  for (const [d, color] of [[-0.09, '#e3374b'], [1.09, '#2fbf71']] as const) {
    const y = waterY(L, d);
    const s = scaleAt(L, d);
    const spacing = 520;
    const first = Math.floor((distance - L.shipX / L.zoom) / spacing) - 1;
    for (let i = first; i < first + Math.ceil(L.width / L.zoom / spacing) + 3; i++) {
      const x = screenX(L, i * spacing + (d < 0 ? 0 : 260), distance);
      if (x < -20 || x > L.width + 20) continue;
      const bob = Math.sin(clock * 2 + i) * 1.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, y + bob);
      ctx.lineTo(x - 3 * s, y - 14 * s + bob);
      ctx.lineTo(x + 3 * s, y - 14 * s + bob);
      ctx.lineTo(x + 5 * s, y + bob);
      ctx.fill();
      ctx.fillStyle = clamp((dusk - 0.5) / 0.3, 0, 1) > 0 && Math.sin(clock * 3 + i) > 0 ? '#fff7c2' : 'rgba(255,255,255,0.7)';
      ctx.fillRect(x - 1.5 * s, y - 18 * s + bob, 3 * s, 3 * s);
    }
  }
}

/** The foreground swell, drawn over everything on the water. */
export function drawForeground(ctx: CanvasRenderingContext2D, L: Layout, dusk: number, distance: number, clock: number): void {
  const y0 = L.nearY + (L.height - L.nearY) * 0.55;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.16 - 0.06 * dusk})`;
  const gap = 140;
  const off = wrap(distance * L.zoom * 1.25, gap);
  for (let x = -off - gap; x < L.width + gap; x += gap) {
    const y = y0 + Math.sin(clock * 1.3 + x * 0.01) * 3;
    ctx.beginPath();
    ctx.ellipse(x + 40, y, 36, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Islands and tankers in the far water -------------------------------------------------------------------

const ISLANDS = [
  { name: 'HORMUZ ISLAND', w: 230, h: 30, colors: ['#b8442f', '#d98a3a', '#e9c24a', '#8a3d7a', '#c2563a'], sign: 'RAINBOW VALLEY · NO RELATION' },
  { name: 'LARAK', w: 170, h: 22, colors: ['#9b7b5e', '#a98a6b'], sign: '' },
  { name: 'QESHM', w: 360, h: 18, colors: ['#c5a77f', '#b39470'], sign: '' },
] as const;
export const ISLAND_PARALLAX = 0.22;

export function drawIslands(ctx: CanvasRenderingContext2D, L: Layout, dusk: number, scroll: number): void {
  const period = 1500;
  const shift = scroll * ISLAND_PARALLAX;
  const first = Math.floor(shift / period) - 1;
  const y = L.horizon + (L.farY - L.horizon) * 0.32;
  for (let i = first; i < first + Math.ceil(L.width / period) + 2; i++) {
    const island = ISLANDS[((i % ISLANDS.length) + ISLANDS.length) % ISLANDS.length]!;
    const x = i * period - shift + 200;
    if (x > L.width + 20 || x + island.w < -20) continue;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k <= 20; k++) {
      const u = k / 20;
      ctx.lineTo(x + u * island.w, y - island.h * Math.sin(Math.PI * u) ** 0.7 * (0.75 + 0.25 * Math.sin(u * 13 + i)));
    }
    ctx.closePath();
    ctx.clip();
    // Hormuz Island's famous ochre and rainbow soils, in bands.
    island.colors.forEach((color, k) => {
      ctx.fillStyle = mixColor(color, '#2a2346', dusk * 0.85);
      ctx.fillRect(x, y - island.h + k * (island.h / island.colors.length), island.w, island.h / island.colors.length + 1);
    });
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x + 4, y, island.w - 8, 1.5);
    if (island.sign && !L.portrait) text(ctx, island.sign, x + island.w / 2, y - island.h - 8, 9, mixColor('#5b2a4a', '#e8dcff', dusk), 'center', island.w + 40, 700);
  }
}

const TANKERS = ['MT STRAIGHT ACTING', 'MT DISCREET', 'MT NO DRAMA'] as const;
export const TANKER_PARALLAX = 0.42;

/** Inbound tankers in the far lane, sailing the other way at their own pace. */
export function drawTankers(ctx: CanvasRenderingContext2D, L: Layout, dusk: number, scroll: number, clock: number): void {
  const period = 1150;
  const shift = scroll * TANKER_PARALLAX + clock * 16;
  const first = Math.floor(shift / period) - 1;
  const y = L.horizon + (L.farY - L.horizon) * 0.7;
  const night = clamp((dusk - 0.55) / 0.3, 0, 1);
  for (let i = first; i < first + Math.ceil(L.width / period) + 2; i++) {
    const x = i * period - shift + 420;
    if (x > L.width + 10 || x + 190 < -10) continue;
    const bob = Math.sin(clock * 0.9 + i) * 0.8;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = mixColor('#8c2f2a', '#2b1a33', dusk);
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(180, -12);
    ctx.lineTo(190, -15);
    ctx.lineTo(184, 0);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mixColor('#2a2a2e', '#121022', dusk);
    ctx.fillRect(4, -4, 180, 4);
    ctx.fillStyle = mixColor('#e9e6df', '#4a4560', dusk);
    ctx.fillRect(14, -26, 24, 14);
    ctx.fillRect(18, -32, 10, 6);
    ctx.fillStyle = mixColor('#3b3b45', '#1a1828', dusk);
    ctx.fillRect(40, -18, 130, 6);
    if (night > 0) {
      ctx.fillStyle = `rgba(255, 232, 150, ${night})`;
      for (let k = 0; k < 4; k++) ctx.fillRect(16 + k * 5, -22, 2, 2);
      ctx.fillStyle = `rgba(255, 80, 80, ${night})`;
      ctx.fillRect(186, -18, 2, 2);
    }
    if (!L.portrait) text(ctx, TANKERS[((i % TANKERS.length) + TANKERS.length) % TANKERS.length]!, 110, -7, 7, mixColor('#ffffff', '#b9b0d8', dusk), 'center', 130, 700);
    ctx.restore();
  }
}

// ---- Hazards ------------------------------------------------------------------------------------------------

/** A contact mine riding the swell, horns up, a lamp blinking. Origin at the waterline; the caller clips the sea. */
export function drawMine(ctx: CanvasRenderingContext2D, clock: number, variant: number, dusk: number): void {
  const bob = Math.sin(clock * 2.1 + variant * 9) * 1.4;
  const tilt = Math.sin(clock * 1.3 + variant * 5) * 0.14;
  ctx.save();
  ctx.translate(0, bob - 5);
  ctx.rotate(tilt);
  ctx.strokeStyle = '#3b3e46';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#4a4e57';
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI + (k + 0.5) * Math.PI / 7 - 0.1;
    const x0 = Math.cos(a) * 10, y0 = Math.sin(a) * 10;
    const x1 = Math.cos(a) * 15, y1 = Math.sin(a) * 15;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x1, y1, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const body = ctx.createRadialGradient(-4, -5, 2, 0, 0, 12);
  body.addColorStop(0, '#6e7380');
  body.addColorStop(1, '#22242a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 82, 40, 0.55)';
  ctx.beginPath();
  ctx.ellipse(4, 3, 4, 2.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  const blink = Math.sin(clock * 5 + variant * 20) > 0.3;
  ctx.fillStyle = blink ? '#ff3b4f' : '#5a1a22';
  ctx.beginPath();
  ctx.arc(0, -12.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (blink && dusk > 0.4) {
    ctx.fillStyle = 'rgba(255, 60, 80, 0.3)';
    ctx.beginPath();
    ctx.arc(0, -12.5, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Rings on the water around anything floating. */
export function drawRipples(ctx: CanvasRenderingContext2D, clock: number, variant: number, rx: number, alpha = 0.35): void {
  const base = ctx.globalAlpha;
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 1;
  for (let k = 0; k < 2; k++) {
    const u = (clock * 0.6 + variant + k * 0.5) % 1;
    ctx.globalAlpha = base * (1 - u);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * (1 + u * 0.8), rx * 0.3 * (1 + u * 0.8), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = base;
}

/** An anti-ship missile pointing along +x, with its exhaust. */
export function drawMissile(ctx: CanvasRenderingContext2D, clock: number): void {
  const flicker = 9 + 4 * Math.sin(clock * 70) + 2 * Math.sin(clock * 37);
  const flame = ctx.createLinearGradient(-15 - flicker, 0, -14, 0);
  flame.addColorStop(0, 'rgba(255, 120, 40, 0)');
  flame.addColorStop(0.5, 'rgba(255, 170, 60, 0.9)');
  flame.addColorStop(1, '#fff6c2');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-14, -2.5);
  ctx.lineTo(-15 - flicker, 0);
  ctx.lineTo(-14, 2.5);
  ctx.fill();
  ctx.fillStyle = '#8a8f99';
  ctx.beginPath();
  ctx.moveTo(-14, -2.5); ctx.lineTo(-18, -7); ctx.lineTo(-10, -2.5);
  ctx.moveTo(-14, 2.5); ctx.lineTo(-18, 7); ctx.lineTo(-10, 2.5);
  ctx.fill();
  ctx.fillStyle = '#ece9e1';
  roundRect(ctx, -14, -3, 26, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#5c6270';
  ctx.fillRect(-4, -3, 2, 6);
  ctx.fillStyle = '#c4302b';
  ctx.beginPath();
  ctx.moveTo(12, -3);
  ctx.quadraticCurveTo(19, -1, 21, 0);
  ctx.quadraticCurveTo(19, 1, 12, 3);
  ctx.fill();
}

/** Where a missile or drone will land: amber, or red when it is on the ship's lane. `u` is its flight, 0 to 1. */
export function drawReticle(ctx: CanvasRenderingContext2D, rx: number, u: number, danger: boolean, clock: number): void {
  const color = danger ? C.red : C.amber;
  const ry = rx * 0.32;
  const close = clamp((u - 0.2) / 0.6, 0, 1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25 + 0.65 * close;
  ctx.lineWidth = danger ? 2.2 : 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  const outer = 1 + 1.8 * (1 - u);
  ctx.globalAlpha *= 0.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * outer, ry * outer, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.25 + 0.65 * close;
  ctx.beginPath();
  ctx.moveTo(-rx * 1.25, 0); ctx.lineTo(-rx * 0.6, 0);
  ctx.moveTo(rx * 0.6, 0); ctx.lineTo(rx * 1.25, 0);
  ctx.moveTo(0, -ry * 1.4); ctx.lineTo(0, -ry * 0.6);
  ctx.moveTo(0, ry * 0.6); ctx.lineTo(0, ry * 1.4);
  ctx.stroke();
  if (Math.sin(clock * (8 + 16 * u)) > 0) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A one-way attack drone flying toward -x: a delta wing with a pusher propeller. */
export function drawDrone(ctx: CanvasRenderingContext2D, clock: number, variant: number): void {
  const wobble = Math.sin(clock * 9 + variant * 30) * 0.05;
  ctx.save();
  ctx.rotate(wobble);
  ctx.fillStyle = '#9d967f';
  ctx.beginPath();
  ctx.moveTo(-20, 1);
  ctx.lineTo(10, -9);
  ctx.lineTo(16, -8);
  ctx.lineTo(12, 1);
  ctx.lineTo(16, 9);
  ctx.lineTo(10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c9c2a8';
  ctx.beginPath();
  ctx.moveTo(-20, 1);
  ctx.lineTo(10, -9);
  ctx.lineTo(12, 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5c5747';
  ctx.fillRect(13, -12, 2, 5);
  ctx.fillRect(13, 8, 2, 5);
  ctx.fillStyle = '#2e2c26';
  ctx.beginPath();
  ctx.ellipse(-17, 1, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // A blinking nav light and the propeller, a blur.
  if (Math.sin(clock * 9 + variant * 11) > 0.2) {
    ctx.fillStyle = '#ff3b4f';
    ctx.beginPath();
    ctx.arc(10, -9, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(40, 40, 40, 0.35)';
  ctx.beginPath();
  ctx.ellipse(17, 1, 1.5, 6 + Math.sin(clock * 90) * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A fast attack boat heading toward -x, with a bow wave and a wake. `wreck` 0..1 takes it under. */
export function drawBoat(ctx: CanvasRenderingContext2D, clock: number, variant: number, planing: number, wreck: number): void {
  ctx.save();
  // The wake fans out behind the stern.
  if (wreck === 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, -1); ctx.lineTo(70, -6);
    ctx.moveTo(18, 2); ctx.lineTo(70, 9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let k = 0; k < 6; k++) {
      const u = (clock * 3 + k / 6 + variant) % 1;
      ctx.beginPath();
      ctx.arc(20 + u * 50, 1 + Math.sin(k * 2.3) * 3 * u, 2 + u * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.translate(0, wreck * 9);
  ctx.rotate(-0.05 * planing + wreck * 0.55 + Math.sin(clock * 11 + variant * 7) * 0.02 * planing);
  ctx.fillStyle = '#4c5a4a';
  ctx.beginPath();
  ctx.moveTo(-24, -6);
  ctx.lineTo(20, -8);
  ctx.lineTo(21, 0);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6f7d6a';
  ctx.fillRect(-12, -8, 30, 2.5);
  ctx.fillStyle = '#3c4639';
  ctx.fillRect(2, -15, 11, 7);
  ctx.fillStyle = '#9fd4e6';
  ctx.fillRect(3, -14, 4, 3);
  ctx.strokeStyle = '#2b2f2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-14, -9); ctx.lineTo(-22, -12);
  ctx.moveTo(14, -15); ctx.lineTo(14, -24);
  ctx.stroke();
  ctx.fillStyle = '#c94a3a';
  ctx.beginPath();
  ctx.moveTo(14, -24); ctx.lineTo(20, -22); ctx.lineTo(14, -20);
  ctx.fill();
  // Two crew in helmets.
  ctx.fillStyle = '#2f3a2c';
  ctx.beginPath();
  ctx.arc(-4, -10, 2.2, 0, Math.PI * 2);
  ctx.arc(-9, -10, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (wreck === 0) {
    // The bow wave.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.moveTo(-24, -2);
    ctx.quadraticCurveTo(-30, -6 - 3 * planing, -34, -1);
    ctx.quadraticCurveTo(-28, 1, -20, 1);
    ctx.fill();
  }
  ctx.restore();
}

// ---- People, floaties, the disco ball and the helicopter ------------------------------------------------------

export interface PersonLook { skin: number; shirt: number; arms: number; bob: number; duck: number; wave?: number }

/** A small dancing figure, feet at the origin, about 12 px tall. `arms` 0 down, 1 up. */
export function drawPerson(ctx: CanvasRenderingContext2D, look: PersonLook): void {
  const squash = 1 - 0.4 * look.duck;
  const hip = -4.5 * squash - look.bob;
  const neck = hip - 4.5 * squash;
  ctx.strokeStyle = '#2a2140';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1.2, 0); ctx.lineTo(-0.8, hip);
  ctx.moveTo(1.2, 0); ctx.lineTo(0.8, hip);
  ctx.stroke();
  ctx.fillStyle = SHIRTS[look.shirt % SHIRTS.length]!;
  roundRect(ctx, -2.2, neck, 4.4, hip - neck + 0.6, 1.4);
  ctx.fill();
  ctx.strokeStyle = SKIN[look.skin % SKIN.length]!;
  const up = look.arms * (1 - look.duck);
  const wave = look.wave ?? 0;
  for (const side of [-1, 1]) {
    const ax = side * (2.5 + 1.5 * up) + (side > 0 ? wave : 0);
    const ay = neck + 1 - (up * 6 - 3 * (1 - up)) * (side > 0 ? 1 : 0.85);
    ctx.beginPath();
    ctx.moveTo(side * 1.8, neck + 0.8);
    ctx.lineTo(ax, ay);
    ctx.stroke();
  }
  ctx.fillStyle = SKIN[look.skin % SKIN.length]!;
  ctx.beginPath();
  ctx.arc(0, neck - 2, 1.9, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A castaway's pool floatie, origin at the waterline: a unicorn, a flamingo, a doughnut, a rainbow ring or a
 * swan, with `people` aboard waving.
 */
export function drawFloatie(ctx: CanvasRenderingContext2D, variant: number, clock: number, people = 1): void {
  const kind = Math.floor(variant * 5) % 5;
  const bob = Math.sin(clock * 2.4 + variant * 13) * 1.2;
  const rx = 12 + 4 * (people - 1);
  ctx.save();
  ctx.translate(0, bob);
  const ring = kind === 1 ? '#ff7fbf' : kind === 2 ? '#e5a46a' : kind === 3 ? '#ffffff' : '#fdfbff';
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.ellipse(0, -2, rx, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 2) { // doughnut frosting and sprinkles
    ctx.fillStyle = '#ff8fc8';
    ctx.beginPath();
    ctx.ellipse(0, -3, rx - 1.5, 3.4, 0, Math.PI, 0);
    ctx.fill();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = PRIDE[k]!;
      ctx.fillRect(-rx + 3 + k * (2 * rx - 6) / 6, -4.5 + (k % 2), 2, 1);
    }
  }
  if (kind === 3) { // rainbow ring
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = PRIDE[k]!;
      ctx.fillRect(-rx + 1 + k * (2 * rx - 2) / 6, -5.5, (2 * rx - 2) / 6 + 0.5, 6);
    }
  }
  ctx.fillStyle = 'rgba(30, 60, 90, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -2.5, rx - 5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let p = 0; p < people; p++) {
    const px = (p - (people - 1) / 2) * 8;
    ctx.save();
    ctx.translate(px, -2);
    drawPerson(ctx, { skin: Math.floor(variant * 60) + p * 2, shirt: Math.floor(variant * 40) + p * 3, arms: 0.5 + 0.5 * Math.sin(clock * 5 + p * 2 + variant * 9), bob: 0, duck: 0, wave: Math.sin(clock * 9 + p) * 1.5 });
    ctx.restore();
  }
  // The head of the floatie at the front.
  if (kind === 0 || kind === 1 || kind === 4) {
    const neck = kind === 1 ? '#ff7fbf' : '#fdfbff';
    ctx.strokeStyle = neck;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-rx + 2, -3);
    ctx.quadraticCurveTo(-rx - 4, -10, -rx + 1, -15);
    ctx.stroke();
    ctx.fillStyle = neck;
    ctx.beginPath();
    ctx.ellipse(-rx + 2, -16, 3.2, 2.4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    if (kind === 0) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-rx + 1, -18); ctx.lineTo(-rx - 1, -24); ctx.lineTo(-rx + 3, -18.5);
      ctx.fill();
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = PRIDE[k + 1]!;
        ctx.fillRect(-rx + 3 + k * 1.5, -17 + k * 2.5, 2.5, 2.5);
      }
    } else {
      ctx.fillStyle = kind === 1 ? '#2a2140' : '#ff8c00';
      ctx.beginPath();
      ctx.moveTo(-rx - 1, -16.5); ctx.lineTo(-rx - 4, -15); ctx.lineTo(-rx - 1, -15);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A mirrorball of radius r, its facets turning with the clock, throwing sparkles. */
export function drawDisco(ctx: CanvasRenderingContext2D, r: number, clock: number, sparkles = 1): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#b9bccb';
  ctx.fill();
  ctx.clip();
  const n = 6;
  const spin = clock * 1.6;
  for (let row = 0; row < n; row++) {
    const lat = -Math.PI / 2 + (row + 0.5) * Math.PI / n;
    const y = Math.sin(lat) * r;
    const ring = Math.cos(lat) * r;
    for (let k = 0; k < 10; k++) {
      const lon = spin + k * Math.PI * 2 / 10;
      const z = Math.cos(lon);
      if (z < 0) continue;
      const x = Math.sin(lon) * ring;
      const bright = (row * 3 + k * 7 + Math.floor(spin * 3)) % 5;
      ctx.fillStyle = bright === 0 ? '#ffffff' : bright === 1 ? PRIDE[(row + k) % 6]! : mixColor('#7d8196', '#e4e6f0', z);
      ctx.fillRect(x - r * 0.13, y - r * 0.12, r * 0.26 * (0.4 + 0.6 * z), r * 0.24);
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(40, 40, 60, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const a = clock * 2.2 + k * 2.1;
    const twinkle = 0.5 + 0.5 * Math.sin(clock * 7 + k * 3);
    if (twinkle * sparkles < 0.25) continue;
    sparkle(ctx, Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.2, r * 0.45 * twinkle * sparkles, PRIDE[(k * 2) % 6]!);
  }
}

/** The Pride Air rescue helicopter, centred on the rotor mast, nose toward +x. */
export function drawHeli(ctx: CanvasRenderingContext2D, clock: number, tilt: number): void {
  ctx.save();
  ctx.rotate(tilt);
  // Tail boom and rotor.
  ctx.fillStyle = '#e83e8c';
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(-62, 2);
  ctx.lineTo(-62, -3);
  ctx.lineTo(-14, -1);
  ctx.fill();
  ctx.fillStyle = '#c42a73';
  ctx.beginPath();
  ctx.moveTo(-58, -2); ctx.lineTo(-66, -14); ctx.lineTo(-61, -14); ctx.lineTo(-54, -2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 30, 60, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-62, -1, 7, 7 * Math.abs(Math.sin(clock * 50)), 0, 0, Math.PI * 2);
  ctx.fill();
  // The body, a rainbow stripe and the cockpit.
  ctx.fillStyle = '#ff5fb0';
  roundRect(ctx, -22, -6, 50, 22, 11);
  ctx.fill();
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = PRIDE[k]!;
    ctx.fillRect(-18 + k * 6.5, 9, 6.5, 3);
  }
  ctx.fillStyle = '#bde8ff';
  ctx.beginPath();
  ctx.moveTo(12, -4);
  ctx.quadraticCurveTo(27, -3, 27, 7);
  ctx.lineTo(12, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a2140';
  ctx.beginPath();
  ctx.arc(17, 2, 2.6, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'PRIDE AIR', -2, 2, 6.5, '#ffffff', 'center', 30, 900);
  // Skids.
  ctx.strokeStyle = '#3b2f55';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-8, 16); ctx.lineTo(-10, 21);
  ctx.moveTo(14, 16); ctx.lineTo(16, 21);
  ctx.moveTo(-18, 21); ctx.lineTo(24, 21); ctx.quadraticCurveTo(28, 21, 29, 18);
  ctx.stroke();
  // The mast and the main rotor, a blurred disc.
  ctx.fillStyle = '#3b2f55';
  ctx.fillRect(0, -11, 3, 6);
  ctx.fillStyle = 'rgba(40, 30, 60, 0.28)';
  ctx.beginPath();
  ctx.ellipse(1.5, -11, 46, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 30, 60, 0.55)';
  ctx.lineWidth = 2;
  const blade = Math.cos(clock * 40) * 46;
  ctx.beginPath();
  ctx.moveTo(1.5 - blade, -11);
  ctx.lineTo(1.5 + blade, -11);
  ctx.stroke();
  ctx.restore();
}
