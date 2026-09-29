/**
 * The human pyramid and the people in it: the rows that join underneath as the multiplier climbs, each
 * recruit's strain, your degen at the top, the founder at his lectern, and the seeded tumble of the
 * collapse. Drawn on a 960 × 540 canvas; nothing here picks the outcome.
 */
import { clamp, mulberry32, noise, smoothstep } from './motion';

export const INK = '#1c1f26';
/** The stage floor the base row stands on, the pyramid's centre, the most rows it takes, and the multiplier growth that adds a row. */
export const STAGE = 470;
export const CENTRE = 480;
export const MAX_ROWS = 9;
export const ROW_GROWTH = 1.35;
const SHIRTS = ['#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399', '#fbbf24'];

/** How many rows the pyramid has at `multiplier`: one more every time it grows by ROW_GROWTH. */
export const rowsFor = (multiplier: number): number => clamp(1 + Math.floor(Math.log(multiplier) / Math.log(ROW_GROWTH) + 1e-9), 1, MAX_ROWS);

/** A recruit's height when the pyramid has `rows` rows (fractional while a row is joining): the whole pyramid fits above the stage. */
export const heightFor = (rows: number): number => clamp(300 / (0.82 * rows), 34, 66);

/** Where the recruit `j` of row `k` (0 at the top) stands, feet first: rows stand on the shoulders of the row below. */
export function place(rows: number, k: number, j: number): { x: number; y: number; h: number } {
  const h = heightFor(rows);
  return { x: CENTRE + (j - k / 2) * h * 0.8, y: STAGE - (rows - 1 - k) * h * 0.82, h };
}

export interface Body { x: number; y: number; vx: number; vy: number; angle: number; spin: number; h: number; shirt: string; you: boolean }
export interface Look { strain: number; shirt: string; you: boolean; shades: boolean; dazed: boolean; arms: 'up' | 'down' | 'flail' }

/** A recruit, feet at the origin: legs that wobble with the strain, a shirt, arms holding the row above, a face that stops smiling. */
export function drawFigure(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, angle: number, time: number, look: Look): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(h / 60, h / 60);
  const wobble = look.strain * Math.sin(time * 30 + x) * 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (const s of [-1, 1]) { ctx.moveTo(s * 7, -20); ctx.lineTo(s * 9 + wobble, -10); ctx.lineTo(s * 10, 0); }
  ctx.stroke();
  ctx.fillStyle = look.shirt;
  ctx.beginPath(); ctx.roundRect(-11, -42, 22, 24, 6); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (look.arms === 'up') { ctx.moveTo(-10, -38); ctx.lineTo(-19, -52 + wobble); ctx.moveTo(10, -38); ctx.lineTo(19, -52 - wobble); }
  else if (look.arms === 'down') { ctx.moveTo(-10, -38); ctx.lineTo(-16, -22); ctx.moveTo(10, -38); ctx.lineTo(16, -22); }
  else { ctx.moveTo(-10, -38); ctx.lineTo(-22, -30 + Math.sin(time * 20) * 8); ctx.moveTo(10, -38); ctx.lineTo(22, -46 + Math.cos(time * 20) * 8); }
  ctx.stroke();
  ctx.fillStyle = '#f4d1b0';
  ctx.beginPath(); ctx.arc(0, -52, 10, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = INK;
  if (look.shades) ctx.fillRect(-9, -57, 18, 6);
  else if (look.dazed) { ctx.lineWidth = 2; ctx.beginPath(); for (const s of [-4, 4]) { ctx.moveTo(s - 2, -57); ctx.lineTo(s + 2, -53); ctx.moveTo(s + 2, -57); ctx.lineTo(s - 2, -53); } ctx.stroke(); }
  else for (const s of [-4, 4]) { ctx.beginPath(); ctx.arc(s, -55, 1.5 + look.strain, 0, Math.PI * 2); ctx.fill(); }
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (look.strain > 0.5) ctx.ellipse(0, -47, 3, 1.5 + 3 * look.strain, 0, 0, Math.PI * 2);
  else ctx.arc(0, -50, 4, 0.3, Math.PI - 0.3);
  ctx.stroke();
  if (look.strain > 0.55 && !look.dazed) { ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.ellipse(11, -58, 2, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  if (look.you) {
    // Your degen holds the bag over his head and wears the CEO sash.
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.ellipse(19, -60, 8, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 11px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 19, -56);
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath(); ctx.moveTo(-11, -40); ctx.lineTo(11, -24); ctx.lineTo(11, -19); ctx.lineTo(-11, -35); ctx.fill();
  }
  ctx.restore();
}

/** The founder: a suit, a red tie, a mic and hair that does not move; he pitches with his arms, and runs with the bag once it falls. */
export function drawFounder(ctx: CanvasRenderingContext2D, x: number, time: number, running: boolean): void {
  ctx.save();
  ctx.translate(x, STAGE);
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  const stride = running ? Math.sin(time * 16) * 16 : 0;
  ctx.beginPath(); ctx.moveTo(-8, -30); ctx.lineTo(-10 + stride, 0); ctx.moveTo(8, -30); ctx.lineTo(10 - stride, 0); ctx.stroke();
  ctx.fillStyle = '#1e293b';
  ctx.beginPath(); ctx.roundRect(-16, -70, 32, 42, 8); ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.moveTo(-3, -66); ctx.lineTo(3, -66); ctx.lineTo(0, -40); ctx.fill();
  ctx.lineWidth = 7;
  ctx.beginPath();
  if (running) { ctx.moveTo(14, -62); ctx.lineTo(30, -50); ctx.moveTo(-14, -62); ctx.lineTo(-30, -52); }
  else { ctx.moveTo(14, -62); ctx.lineTo(34, -78 + Math.sin(time * 3) * 10); ctx.moveTo(-14, -62); ctx.lineTo(-26, -46); }
  ctx.stroke();
  ctx.fillStyle = '#f4d1b0';
  ctx.beginPath(); ctx.arc(0, -84, 14, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(0, -90, 15, Math.PI, 0); ctx.fill();
  for (const s of [-5, 5]) { ctx.beginPath(); ctx.arc(s, -85, 1.8, 0, Math.PI * 2); ctx.fill(); }
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -80, 6, 0.2, Math.PI - 0.2); ctx.stroke();
  if (running) {
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.ellipse(38, -46, 12, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(-30, -48, 5, 0, Math.PI * 2); ctx.fillStyle = '#64748b'; ctx.fill();
  }
  ctx.restore();
}

/** Everyone in the pyramid as a body of their own, thrown by the crash's seed: the base scatters outward, the rows above drop. */
export function collapse(rows: number, crashX100: number, youOnTop: boolean): Body[] {
  const random = mulberry32(crashX100);
  const bodies: Body[] = [];
  for (let k = 0; k < rows; k += 1) {
    for (let j = 0; j <= k; j += 1) {
      if (k === 0 && !youOnTop) continue;
      const p = place(rows, k, j);
      const side = j < k / 2 ? -1 : j > k / 2 ? 1 : random() > 0.5 ? 1 : -1;
      const base = (k + 1) / rows;
      bodies.push({ x: p.x, y: p.y, vx: side * (30 + random() * 90 + base * 140), vy: -(40 + random() * 180), angle: 0, spin: side * (3 + random() * 6), h: p.h, shirt: shirtFor(k, j), you: k === 0 });
    }
  }
  return bodies;
}

export const shirtFor = (k: number, j: number): string => SHIRTS[Math.floor(noise(k * 7 + j * 3) * SHIRTS.length)]!;

export function stepBodies(bodies: Body[], dt: number): boolean {
  let landed = false;
  for (const b of bodies) {
    b.vy += 900 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.spin * dt;
    if (b.y >= STAGE && b.vy > 0) {
      b.y = STAGE;
      if (b.vy > 160) { b.vy *= -0.3; b.vx *= 0.6; landed = true; }
      else { b.vy = 0; b.vx *= Math.exp(-6 * dt); b.spin = 0; b.angle += ((b.vx >= 0 ? Math.PI / 2 : -Math.PI / 2) - b.angle) * (1 - Math.exp(-8 * dt)); }
    }
    b.x = clamp(b.x, 20, 940);
  }
  return landed;
}

/** Where the bodies of a collapse met late lie: in a heap along the stage. */
export function settleBodies(bodies: Body[]): void {
  for (const [i, b] of bodies.entries()) {
    b.x = clamp(CENTRE + (i - bodies.length / 2) * 22 + noise(i) * 30, 40, 920);
    b.y = STAGE;
    b.vx = b.vy = b.spin = 0;
    b.angle = i % 2 ? Math.PI / 2 : -Math.PI / 2;
  }
}

export function drawBodies(ctx: CanvasRenderingContext2D, bodies: Body[], time: number, shades: boolean): void {
  for (const b of bodies) drawFigure(ctx, b.x, b.y, b.h, b.angle, time, { strain: 1, shirt: b.shirt, you: b.you, shades: b.you && shades, dazed: b.vy === 0, arms: b.vy === 0 ? 'down' : 'flail' });
}
