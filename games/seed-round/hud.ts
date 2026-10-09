/**
 * The HUD, drawn in Canvas 2D over the WebGL frame in 960 × 540 logical
 * pixels: meme captions, the multiplier, the swimmer counter, a pump.fun-style
 * coin card with its bonding curve, and labels pinned to things in the tunnel.
 */
import { type Mat4, projectToScreen } from './math3d';
import { clamp } from './motion';
import type { Label } from './pack';

export const W = 960;
export const H = 540;
export const INK = '#1a0710';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The multiplier at which the coin card's bonding curve fills: 69K market cap. */
export const GRADUATION = 6.9;

export function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

export const grouped = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 708, 15.7K, 317K, 1.0M: short enough for the coin card however high the round goes. */
export function compact(n: number): string {
  for (const [size, unit] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
    const v = n / size;
    if (v >= 1) return `${v < 100 ? v.toFixed(1) : Math.floor(v)}${unit}`;
  }
  return String(Math.floor(n));
}

/** Darkened corners, flushed red as the tension builds. */
export function drawVignette(ctx: CanvasRenderingContext2D, tension: number, beat: number): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(${Math.round(30 + 60 * tension * beat)},0,8,${0.55 + 0.15 * tension})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Labels pinned to world positions, dropped when behind the camera or off screen. */
export function drawLabels(ctx: CanvasRenderingContext2D, labels: Label[], viewProj: Mat4): void {
  for (const label of labels) {
    const p = projectToScreen(viewProj, label.at, W, H);
    if (!p || p.x < 30 || p.x > W - 30 || p.y < label.size + 22 || p.y > H - 20) continue;
    const fade = label.far ? 1 : clamp(1.4 - p.depth / 60, 0, 1);
    if (fade <= 0.05) continue;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = label.colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 12);
    ctx.stroke();
    memeText(ctx, label.text, p.x, p.y - 16, label.size, label.colour, 'center');
    ctx.restore();
  }
}

function crown(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s, y - s * 0.9);
  ctx.lineTo(x - s * 0.5, y - s * 0.45);
  ctx.lineTo(x, y - s * 1.1);
  ctx.lineTo(x + s * 0.5, y - s * 0.45);
  ctx.lineTo(x + s, y - s * 0.9);
  ctx.lineTo(x + s, y);
  ctx.closePath();
  ctx.fillStyle = '#ffd34d';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

export interface CardState { multiplier: number; crashed: boolean; king: boolean; replies: number; time: number; }

/** The top holder's share of the supply: 42% at the launch, 69% by 2×, and on toward all of it. */
export const topHolder = (m: number): number => Math.min(96, 42 + 27 * Math.log2(Math.max(1, m)));

/** What the dev is up to, by the multiplier. */
function devStatus(m: number, crashed: boolean): [string, string] {
  if (crashed) return ['dev: deleted', '#ff6b86'];
  if (m < 1.5) return ['dev: online', '#86efac'];
  if (m < 2.4) return ['dev: typing…', '#86efac'];
  if (m < 4.6) return ['dev: afk', '#ffd34d'];
  return ['dev: went dark', '#ff6b86'];
}

/** A pump.fun coin card: ticker, market cap, the bonding curve toward graduation, the top holder's share, King of the Hill. */
export function drawCard(ctx: CanvasRenderingContext2D, card: CardState): void {
  const x = 16;
  const y = 16;
  const w = 228;
  const h = card.king ? 140 : 118;
  ctx.save();
  ctx.fillStyle = 'rgba(16,6,12,0.72)';
  ctx.strokeStyle = card.crashed ? 'rgba(255,77,109,0.8)' : 'rgba(134,239,172,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  // The coin: a swimmer in a circle.
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.arc(x + 26, y + 28, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8f0';
  ctx.beginPath();
  ctx.ellipse(x + 30, y + 26, 6, 4.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 25, y + 29);
  ctx.bezierCurveTo(x + 20, y + 33, x + 24, y + 38, x + 15, y + 40);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.fillText('Seed Round', x + 50, y + 25);
  const [status, statusColour] = devStatus(card.multiplier, card.crashed);
  ctx.textAlign = 'right';
  ctx.fillStyle = statusColour;
  ctx.font = '700 8px system-ui, sans-serif';
  ctx.fillText(status, x + w - 12, y + 24, 54);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#86efac';
  ctx.font = '700 12px system-ui, sans-serif';
  const cap = card.crashed ? 0 : 10_000 * card.multiplier;
  ctx.fillText(`MC $${compact(cap)} · ${compact(card.replies)} replies`, x + 50, y + 42, w - 62);
  const progress = card.crashed ? 0 : clamp(Math.log(card.multiplier) / Math.log(GRADUATION), 0, 1);
  const graduated = progress >= 1;
  // The curve trembles as graduation nears: the wind-up before whatever comes next.
  const tremble = !card.crashed && !graduated ? clamp((progress - 0.75) / 0.25, 0, 1) * 1.5 * Math.sin(card.time * 42) : 0;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 54, w - 24, 10, 5);
  ctx.fill();
  ctx.fillStyle = graduated ? '#ffd34d' : card.crashed ? '#ff4d6d' : '#86efac';
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 54 + tremble, Math.max(10, (w - 24) * progress), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#e9d9e0';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText(card.crashed ? 'bonding curve: rugged' : graduated ? 'bonding curve: GRADUATED' : `bonding curve progress: ${Math.floor(progress * 100)}%`, x + 12, y + 76);
  // The top holder's bar: green until it is most of the supply, then it throbs red.
  const share = card.crashed ? 100 : topHolder(card.multiplier);
  const hot = clamp((share - 60) / 20, 0, 1);
  const throb = card.crashed ? 1 : 0.7 + 0.3 * Math.sin(card.time * 6);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 86, w - 24, 8, 4);
  ctx.fill();
  ctx.fillStyle = `rgb(${Math.round(134 + (255 - 134) * hot)}, ${Math.round(239 - (239 - 77) * hot * throb)}, ${Math.round(172 - (172 - 109) * hot)})`;
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 86, (w - 24) * (share / 100), 8, 4);
  ctx.fill();
  ctx.fillStyle = hot > 0.5 ? '#ffb3c1' : '#e9d9e0';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText(card.crashed ? 'top holder: the dev · 100%' : `top holder: ${Math.round(share)}% (1 wallet)`, x + 12, y + 108);
  if (card.king) {
    crown(ctx, x + 22, y + 132, 9);
    memeText(ctx, 'KING OF THE HILL', x + 38, y + 132, 16, '#ffd34d', 'left');
  }
  ctx.restore();
}
