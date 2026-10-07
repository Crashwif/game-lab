import { endurance } from './endurance';
import { clamp, mulberry32, noise, smoothstep } from './motion';

export const INK = '#1c1f26';
export const STAGE = 470;
export const CENTRE = 480;
export const MAX_ROWS = 9;
export const ROW_GROWTH = 1.35;
const SHIRTS = ['#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399', '#fbbf24'];
export const rowsFor = (multiplier: number): number => clamp(1 + Math.floor(Math.log(multiplier) / Math.log(ROW_GROWTH) + 1e-9), 1, MAX_ROWS);
export const heightFor = (rows: number): number => clamp(300 / (0.82 * rows), 34, 66);
export function place(rows: number, k: number, j: number): { x: number; y: number; h: number } {
  const h = heightFor(rows);
  return { x: CENTRE + (j - k / 2) * h * 0.8, y: STAGE - (rows - 1 - k) * h * 0.82, h };
}

type Foot = { x: number; y: number };
export function recruitFeet(worldX: number, h: number, direction = 1): Foot[] {
  const scale = h / 60;
  return [-1, 1].map((side) => {
    const u = ((worldX * direction / (36 * scale) + (side > 0 ? .5 : 0)) % 1 + 1) % 1;
    const t = (u - .6) / .4, ease = t * t * (3 - 2 * t);
    return { x: side * 7 + direction * (u < .6 ? 12 - 36 * u : -9.6 + 21.6 * ease), y: u < .6 ? 0 : -Math.sin(t * Math.PI) * 9 };
  });
}
export function supportPose(rows: number, k: number, j: number, seconds: number) {
  const act = endurance(seconds), p = place(rows, k, j), levels = rows - 1 - k;
  const lean = act.act === 1 ? 1 : act.act === 3 ? -1 : Math.sin(seconds * .55) * .45;
  const offset = (level: number) => ({ x: level * 2.3 * lean * act.effort, y: level * (act.act === 2 ? .85 : act.act === 4 ? .5 : 0) * act.effort });
  const own = offset(levels), below = offset(Math.max(0, levels - 1));
  const x = p.x + own.x, y = p.y + own.y, scale = p.h / 60;
  const feet = [-1, 1].map((side) => ({ x: side * 10 + (below.x - own.x) / scale, y: levels > 0 ? (below.y - own.y) / scale : 0 }));
  return { x, y, h: p.h, feet };
}

export interface Body { x: number; y: number; vx: number; vy: number; angle: number; spin: number; h: number; shirt: string; you: boolean }
export interface Look { strain: number; shirt: string; you: boolean; shades: boolean; dazed: boolean; arms: 'up' | 'down' | 'flail'; feet?: Foot[] }
export function drawFigure(c: CanvasRenderingContext2D, x: number, y: number, h: number, angle: number, time: number, look: Look): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(h / 60, h / 60);
  const wobble = look.strain * Math.sin(time * 30 + x) * 3;
  c.lineCap = 'round';
  c.strokeStyle = INK;
  c.lineWidth = 6;
  c.beginPath();
  for (const [i, s] of [-1, 1].entries()) {
    const foot = look.feet?.[i] ?? { x: s * 10, y: 0 };
    c.moveTo(s * 7, -20); c.lineTo(s * 9 + wobble + foot.x * .15, -10 + foot.y * .5); c.lineTo(foot.x, foot.y);
  }
  c.stroke();
  c.fillStyle = look.shirt;
  c.beginPath(); c.roundRect(-11, -42, 22, 24, 6); c.fill();
  c.lineWidth = 2.5;
  c.stroke();
  c.lineWidth = 5;
  c.beginPath();
  if (look.arms === 'up') { c.moveTo(-10, -38); c.lineTo(-14, -49.2); c.moveTo(10, -38); c.lineTo(14, -49.2); }
  else if (look.arms === 'down') { c.moveTo(-10, -38); c.lineTo(-16, -22); c.moveTo(10, -38); c.lineTo(16, -22); }
  else { c.moveTo(-10, -38); c.lineTo(-22, -30 + Math.sin(time * 20) * 8); c.moveTo(10, -38); c.lineTo(22, -46 + Math.cos(time * 20) * 8); }
  c.stroke();
  c.fillStyle = '#f4d1b0';
  c.beginPath(); c.arc(0, -52, 10, 0, Math.PI * 2); c.fill();
  c.lineWidth = 2.5;
  c.stroke();
  c.fillStyle = INK;
  if (look.shades) c.fillRect(-9, -57, 18, 6);
  else if (look.dazed) { c.lineWidth = 2; c.beginPath(); for (const s of [-4, 4]) { c.moveTo(s - 2, -57); c.lineTo(s + 2, -53); c.moveTo(s + 2, -57); c.lineTo(s - 2, -53); } c.stroke(); }
  else for (const s of [-4, 4]) { c.beginPath(); c.arc(s, -55, 1.5 + look.strain, 0, Math.PI * 2); c.fill(); }
  c.lineWidth = 2;
  c.beginPath();
  if (look.strain > 0.5) c.ellipse(0, -47, 3, 1.5 + 3 * look.strain, 0, 0, Math.PI * 2);
  else c.arc(0, -50, 4, 0.3, Math.PI - 0.3);
  c.stroke();
  if (look.strain > 0.55 && !look.dazed) { c.fillStyle = '#8fd3ff'; c.beginPath(); c.ellipse(11, -58, 2, 3, 0, 0, Math.PI * 2); c.fill(); }
  if (look.you) {
    c.fillStyle = '#c9a227';
    c.beginPath(); c.ellipse(19, -60, 8, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = INK;
    c.font = '900 11px Impact, "Arial Black", sans-serif';
    c.textAlign = 'center';
    c.fillText('$', 19, -56);
    c.fillStyle = '#ff4d6d';
    c.beginPath(); c.moveTo(-11, -40); c.lineTo(11, -24); c.lineTo(11, -19); c.lineTo(-11, -35); c.fill();
  }
  c.restore();
}
export function drawFounder(c: CanvasRenderingContext2D, x: number, time: number, running: boolean): void {
  c.save();
  c.translate(x, STAGE);
  c.lineCap = 'round';
  c.strokeStyle = INK;
  c.lineWidth = 8;
  const stride = running ? Math.sin(time * 16) * 16 : 0;
  c.beginPath(); c.moveTo(-8, -30); c.lineTo(-10 + stride, 0); c.moveTo(8, -30); c.lineTo(10 - stride, 0); c.stroke();
  c.fillStyle = '#1e293b';
  c.beginPath(); c.roundRect(-16, -70, 32, 42, 8); c.fill();
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = '#e63946';
  c.beginPath(); c.moveTo(-3, -66); c.lineTo(3, -66); c.lineTo(0, -40); c.fill();
  c.lineWidth = 7;
  c.beginPath();
  if (running) { c.moveTo(14, -62); c.lineTo(30, -50); c.moveTo(-14, -62); c.lineTo(-30, -52); }
  else { c.moveTo(14, -62); c.lineTo(34, -78 + Math.sin(time * 3) * 10); c.moveTo(-14, -62); c.lineTo(-26, -46); }
  c.stroke();
  c.fillStyle = '#f4d1b0';
  c.beginPath(); c.arc(0, -84, 14, 0, Math.PI * 2); c.fill();
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = INK;
  c.beginPath(); c.arc(0, -90, 15, Math.PI, 0); c.fill();
  for (const s of [-5, 5]) { c.beginPath(); c.arc(s, -85, 1.8, 0, Math.PI * 2); c.fill(); }
  c.lineWidth = 2;
  c.beginPath(); c.arc(0, -80, 6, 0.2, Math.PI - 0.2); c.stroke();
  if (running) {
    c.fillStyle = '#c9a227';
    c.beginPath(); c.ellipse(38, -46, 12, 15, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  } else {
    c.beginPath(); c.arc(-30, -48, 5, 0, Math.PI * 2); c.fillStyle = '#64748b'; c.fill();
  }
  c.restore();
}
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
export function settleBodies(bodies: Body[]): void {
  for (const [i, b] of bodies.entries()) {
    b.x = clamp(CENTRE + (i - bodies.length / 2) * 22 + noise(i) * 30, 40, 920);
    b.y = STAGE;
    b.vx = b.vy = b.spin = 0;
    b.angle = i % 2 ? Math.PI / 2 : -Math.PI / 2;
  }
}

export function drawBodies(c: CanvasRenderingContext2D, bodies: Body[], time: number, shades: boolean): void {
  for (const b of bodies) drawFigure(c, b.x, b.y, b.h, b.angle, time, { strain: 1, shirt: b.shirt, you: b.you, shades: b.you && shades, dazed: b.vy === 0, arms: b.vy === 0 ? 'down' : 'flail' });
}
