/**
 * The HUD, drawn in Canvas 2D over the WebGL frame in 960 × 540 logical
 * pixels: meme captions, the multiplier, the mission control panel with the
 * altitude, the HOPIUM gauge, the holders aboard and the SUS meter, and
 * labels pinned to things in the world.
 */
import { type Mat4, type Vec3, projectToScreen } from './math3d';
import { clamp } from './motion';

export const W = 960;
export const H = 540;
export const INK = '#0e0a14';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
const UI_FONT = 'system-ui, sans-serif';
/** The moon's distance on the launch pad, in km, which is what NASA says it is. */
export const MOON_KM = 384_400;

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

/** 708, 15.7K, 317K, 1.0M: short enough for a panel row however high the round goes. */
export function compact(n: number): string {
  for (const [size, unit] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
    const v = n / size;
    if (v >= 1) return `${v < 100 ? v.toFixed(1) : Math.floor(v)}${unit}`;
  }
  return String(Math.floor(n));
}

/** How far the moon still is, in km: it never quite arrives. */
export const moonKm = (m: number): number => MOON_KM / Math.pow(Math.max(1, m), 1.5);

/** Darkened corners, flushed red as the tension builds. */
export function drawVignette(ctx: CanvasRenderingContext2D, tension: number, beat: number): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.96);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(${Math.round(20 + 70 * tension * beat)},0,${Math.round(14 - 10 * tension)},${0.5 + 0.2 * tension})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** A caption pinned to a point in the world; `far` ones stay readable at any distance. */
export interface Label { text: string; at: Vec3; colour: string; size: number; far?: boolean }

/** Labels pinned to world positions, dropped when behind the camera or off screen. */
export function drawLabels(ctx: CanvasRenderingContext2D, labels: Label[], viewProj: Mat4): void {
  for (const label of labels) {
    const p = projectToScreen(viewProj, label.at, W, H);
    if (!p || p.x < 30 || p.x > W - 30 || p.y < label.size + 22 || p.y > H - 20) continue;
    const fade = label.far ? 1 : clamp(1.5 - p.depth / 70, 0, 1);
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

export interface PanelState {
  multiplier: number;
  crashed: boolean;
  running: boolean;
  holders: number;
  /** 0 (empty) to 1 (full). */
  fuel: number;
  /** 0 to 100. */
  sus: number;
  stage: string;
  time: number;
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: number, colour: string): void {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (fill > 0.005) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * clamp(fill, 0, 1)), h, h / 2);
    ctx.fill();
  }
}

/** The mission control panel in the top-left corner. */
export function drawPanel(ctx: CanvasRenderingContext2D, panel: PanelState): void {
  const x = 16;
  const y = 16;
  const w = 238;
  const h = 150;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,22,0.72)';
  ctx.strokeStyle = panel.crashed ? 'rgba(255,77,109,0.85)' : 'rgba(201,247,107,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  // The coin: a rocket in a circle.
  ctx.fillStyle = '#c9f76b';
  ctx.beginPath();
  ctx.arc(x + 24, y + 24, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x + 24, y + 25);
  ctx.rotate(-0.7);
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(4, -3);
  ctx.lineTo(4, 7);
  ctx.lineTo(-4, 7);
  ctx.lineTo(-4, -3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff7a3d';
  ctx.beginPath();
  ctx.moveTo(-3, 7);
  ctx.lineTo(0, 13);
  ctx.lineTo(3, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 15px ${UI_FONT}`;
  ctx.fillText('$MOONBOYS', x + 46, y + 22);
  ctx.fillStyle = '#b9c3d6';
  ctx.font = `700 9px ${UI_FONT}`;
  ctx.fillText('MISSION CONTROL · MOM’S BACKYARD', x + 46, y + 36, w - 58);
  const km = panel.crashed ? 0 : panel.running ? MOON_KM - moonKm(panel.multiplier) : 0;
  ctx.fillStyle = '#c9f76b';
  ctx.font = `700 12px ${UI_FONT}`;
  ctx.fillText(`ALT ${grouped(km)} km`, x + 12, y + 56, 98);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e9ecf6';
  ctx.fillText(panel.stage, x + w - 12, y + 56, 104);
  ctx.textAlign = 'left';
  // The fuel: HOPIUM, then COPIUM, then whatever is left.
  const fuelName = panel.crashed ? 'FUEL: LOL' : panel.fuel > 0.4 ? 'HOPIUM' : panel.fuel > 0.15 ? 'COPIUM' : 'PURE DELUSION';
  const fuelColour = panel.crashed ? '#ff4d6d' : panel.fuel > 0.4 ? '#f4c531' : panel.fuel > 0.15 ? '#5b8fe0' : '#ff7ab6';
  ctx.fillStyle = '#e9ecf6';
  ctx.font = `600 11px ${UI_FONT}`;
  ctx.fillText(fuelName, x + 12, y + 76, 78);
  bar(ctx, x + 96, y + 67, w - 108, 10, panel.crashed ? 0 : panel.fuel, fuelColour);
  ctx.fillStyle = '#e9ecf6';
  ctx.fillText(`HOLDERS ABOARD: ${panel.crashed ? 0 : grouped(panel.holders)}`, x + 12, y + 96);
  // The SUS meter fills with every oddity noticed, and throbs red once nothing about this is fine.
  const hot = clamp((panel.sus - 55) / 35, 0, 1);
  const throb = panel.crashed ? 1 : 0.65 + 0.35 * Math.sin(panel.time * 7);
  const susColour = panel.crashed ? '#ff4d6d' : `rgb(${Math.round(201 + (255 - 201) * hot)}, ${Math.round(247 - (247 - 77) * hot * throb)}, ${Math.round(107 - (107 - 109) * hot)})`;
  ctx.fillStyle = hot > 0.5 ? '#ffb3c1' : '#e9ecf6';
  ctx.fillText(panel.crashed ? 'SUS: CONFIRMED' : `SUS: ${Math.round(panel.sus)}%`, x + 12, y + 116, 78);
  bar(ctx, x + 96, y + 107, w - 108, 10, panel.crashed ? 1 : panel.sus / 100, susColour);
  ctx.fillStyle = '#b9c3d6';
  ctx.font = `600 10px ${UI_FONT}`;
  ctx.fillText(panel.crashed ? 'moon status: plywood' : panel.sus >= 100 ? 'moon status: sweating' : panel.sus > 50 ? 'moon status: suspicious' : 'moon status: real (trust me)', x + 12, y + 137, w - 24);
  ctx.restore();
}
