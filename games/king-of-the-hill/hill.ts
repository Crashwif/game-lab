/**
 * The hill is the bonding curve: its slope steepens as the token climbs.
 * World x runs up the hill; world height comes from integrating the slope.
 * The camera keeps the coin in view, and the sky drains from dawn to space
 * with altitude, the moon growing as it gets closer. Roadside signs are
 * planted up the slope at fixed world x.
 */
import { clamp, mix, noise } from './motion';

export interface Point { x: number; y: number }

const INK = '#1c1f26';
const SIGN_FONT = '900 19px Impact, "Arial Black", sans-serif';
/** Wooden signs up the curve, at world x, two short lines each. */
const SIGNS: { x: number; lines: [string, string] }[] = [
  { x: 420, lines: ['BONDING', 'CURVE →'] },
  { x: 950, lines: ['NO JEETS', 'PAST HERE'] },
  { x: 1550, lines: ['DEV HOLDS', '40% LOL'] },
  { x: 2150, lines: ['LAST EXIT', 'BEFORE RUG'] },
  { x: 2800, lines: ['THIN AIR', 'THIN LIQ'] },
  { x: 3500, lines: ['WELCOME TO', 'VALHALLA'] },
];

const SLOPE_MIN = 0.16;
const SLOPE_GAIN = 1.6;
const SLOPE_SCALE = 1800;

/** dy/dx of the ground at world x. */
export const slopeAt = (x: number): number => x < 0 ? 0 : SLOPE_MIN + SLOPE_GAIN * (1 - Math.exp(-x / SLOPE_SCALE));
/** Ground height at world x (integral of the slope). */
export const heightAt = (x: number): number => {
  const t = Math.max(0, x);
  return SLOPE_MIN * t + SLOPE_GAIN * (t - SLOPE_SCALE * (1 - Math.exp(-t / SLOPE_SCALE)));
};
export const slopeAngle = (x: number): number => Math.atan(slopeAt(x));

export interface Camera { x: number; y: number }

/** World to screen: the camera point lands at (480, 300); y grows upward in the world. */
export const toScreen = (cam: Camera, p: Point): Point => ({ x: 480 + (p.x - cam.x), y: 300 - (p.y - cam.y) });

const RAMP: [number, [number, number, number]][] = [[-200, [255, 214, 170]], [0, [255, 190, 140]], [500, [150, 200, 240]], [1200, [70, 120, 200]], [2200, [30, 45, 110]], [3800, [8, 12, 40]]];
export function skyColour(altitude: number): string {
  let i = 0;
  while (i < RAMP.length - 2 && altitude > RAMP[i + 1]![0]) i += 1;
  const [a0, c0] = RAMP[i]!;
  const [a1, c1] = RAMP[i + 1]!;
  const t = clamp((altitude - a0) / (a1 - a0), 0, 1);
  return `rgb(${Math.round(mix(c0[0], c1[0], t))}, ${Math.round(mix(c0[1], c1[1], t))}, ${Math.round(mix(c0[2], c1[2], t))})`;
}

/** The moon's screen position and radius for a multiplier this far along: it grows as the token gets closer. */
export function moonAt(growth: number): { x: number; y: number; r: number } {
  const near = clamp((growth - 1) / 5, 0, 1);
  return { x: 820 - 200 * near, y: 110 + 40 * near, r: 34 + 150 * near };
}

export function drawSky(ctx: CanvasRenderingContext2D, cam: Camera, time: number, growth: number, reduced: boolean): void {
  const altitudeAt = (sy: number): number => cam.y + (300 - sy);
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  for (const f of [0, 0.25, 0.5, 0.75, 1]) sky.addColorStop(f, skyColour(altitudeAt(f * 540)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  const space = clamp((altitudeAt(0) - 900) / 1800, 0, 1);
  if (space > 0.02) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i += 1) {
      const sx = (noise(i * 3.1) * 1200 - cam.x * 0.05) % 960;
      const sy = (noise(i * 7.7) * 700 + cam.y * 0.08) % 540;
      ctx.globalAlpha = space * (reduced ? 0.7 : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * (1 + noise(i)) + i)));
      ctx.beginPath(); ctx.arc(((sx % 960) + 960) % 960, ((sy % 540) + 540) % 540, 0.7 + noise(i * 1.3) * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // The moon grows as the token gets closer to it.
  const { x: mx, y: my, r } = moonAt(growth);
  const glow = ctx.createRadialGradient(mx, my, r * 0.8, mx, my, r * 2.2);
  glow.addColorStop(0, 'rgba(255, 244, 214, 0.32)');
  glow.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(mx, my, r * 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f7f0d8';
  ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e4dabd';
  for (const [dx, dy, cr] of [[-0.3, -0.2, 0.18], [0.35, 0.3, 0.13], [0.15, -0.45, 0.09], [-0.1, 0.4, 0.11]] as const) {
    ctx.beginPath(); ctx.arc(mx + dx * r, my + dy * r, cr * r, 0, Math.PI * 2); ctx.fill();
  }
}

/** The hill body under the profile, with contour lines and a worn track. */
export function drawHill(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const step = 12;
  ctx.fillStyle = '#5c9a63';
  ctx.beginPath();
  ctx.moveTo(-20, 560);
  for (let sx = -20; sx <= 980; sx += step) {
    const wx = cam.x + (sx - 480);
    ctx.lineTo(sx, toScreen(cam, { x: wx, y: heightAt(wx) }).y);
  }
  ctx.lineTo(980, 560);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3f7a48';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let sx = -20; sx <= 980; sx += step) {
    const wx = cam.x + (sx - 480);
    const p = toScreen(cam, { x: wx, y: heightAt(wx) });
    if (sx === -20) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  // Soil bands below the grass and a few rocks.
  ctx.strokeStyle = 'rgba(60, 40, 30, 0.25)';
  ctx.lineWidth = 2;
  for (const depth of [28, 70, 130]) {
    ctx.beginPath();
    for (let sx = -20; sx <= 980; sx += step * 2) {
      const wx = cam.x + (sx - 480);
      const p = toScreen(cam, { x: wx, y: heightAt(wx) - depth + Math.sin(wx / 60) * 4 });
      if (sx === -20) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#7d8590';
  for (let i = 0; i < 12; i += 1) {
    const wx = Math.floor(cam.x / 400) * 400 + i * 140 + noise(i * 3.3) * 90 - 500;
    const p = toScreen(cam, { x: wx, y: heightAt(wx) });
    const size = 4 + noise(wx) * 7;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, size, size * 0.6, -slopeAngle(wx), 0, Math.PI * 2); ctx.fill();
  }
  drawSigns(ctx, cam);
}

/**
 * Plank signs on upright posts, each post long enough that the board clears the ground on its uphill side.
 * A board fades as it slides under the caption band or the market-cap corner, so HUD text never sits on sign text.
 */
function drawSigns(ctx: CanvasRenderingContext2D, cam: Camera): void {
  ctx.save();
  ctx.font = SIGN_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const [i, sign] of SIGNS.entries()) {
    const w = Math.ceil(Math.max(...sign.lines.map((line) => ctx.measureText(line).width))) + 18;
    const h = 48;
    const p = toScreen(cam, { x: sign.x, y: heightAt(sign.x) });
    if (p.x < -w || p.x > 960 + w || p.y < -20) continue;
    const post = 14 + slopeAt(sign.x) * w * 0.55;
    const top = p.y + 4 - post - h;
    if (top > 560) continue;
    const clearOfCaption = top - 84;
    const clearOfMcap = Math.hypot(Math.max(0, p.x - w / 2 - 200), Math.max(0, 478 - (top + h)));
    const alpha = clamp(Math.min(clearOfCaption, clearOfMcap) / 24, 0, 1);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y + 4);
    ctx.rotate((noise(i * 4.1) - 0.5) * 0.12);
    ctx.fillStyle = '#8b5e34'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(-3.5, -post - h / 2, 7, post + h / 2); ctx.fill(); ctx.stroke();
    ctx.translate(0, -post - h / 2);
    ctx.fillStyle = '#d6a866'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 72, 30, 0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 3, 0); ctx.lineTo(w / 2 - 3, 0); ctx.stroke();
    ctx.fillStyle = INK;
    for (const nx of [-w / 2 + 5, w / 2 - 5]) { ctx.beginPath(); ctx.arc(nx, -h / 2 + 5, 1.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillText(sign.lines[0], 0, -10);
    ctx.fillText(sign.lines[1], 0, 12);
    ctx.restore();
  }
  ctx.restore();
}
