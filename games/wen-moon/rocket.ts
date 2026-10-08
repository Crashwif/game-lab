import { type Spring, mix, mulberry32, noise, smoothstep, spring, stepSpring, clamp } from './motion';

export const INK = '#1c1f26';
export const GROUND = 468;
export const PAD_X = 480;
const HOVER = 375;
export const PX_PER_DOUBLING = 520;

export interface Piece { x: number; y: number; vx: number; vy: number; a: number; spin: number; kind: number; s: number }
export interface Pod { x: number; h: number; vx: number; vy: number; chute: Spring; age: number; angle: Spring }
/** The visible pilot socket is 166px above the nozzle; the pod pilot is 7px above its origin. */
export function createPod(alt: number, wobble: number, climb: number, angularVelocity = 0): Pod {
  const angle = spring(wobble); angle.v = angularVelocity;
  return { x: 159 * Math.sin(wobble), h: alt + 159 * Math.cos(wobble), vx: -170 + 159 * Math.cos(wobble) * angularVelocity, vy: climb + 60 - 159 * Math.sin(wobble) * angularVelocity, chute: spring(0), age: 0, angle };
}
export function stepPod(p: Pod, dt: number, reduced: boolean): void {
  const steps = Math.max(1, Math.ceil(dt / 0.008)), h = dt / steps;
  for (let i = 0; i < steps; i++) {
    p.age += h; stepSpring(p.chute, p.age > 0.55 ? 1 : 0, 10, 0.75, h);
    const open = clamp(p.chute.x, 0, 1);
    const drag = open * 4, gravity = 420 * (1 - open);
    p.vy += (-gravity + (-55 - p.vy) * drag) * h;
    p.vx *= Math.exp(-(0.3 + open * 1.2) * h);
    p.x += p.vx * h; p.h += p.vy * h;
    stepSpring(p.angle, -p.vx * 0.0015 * open * (reduced ? 0.25 : 1), 5, 0.55, h);
  }
}
export function podRig(open: number) {
  const k = clamp(open, 0, 1);
  return { canopyY: -12 - 58 * k, radius: 46 * k, harnessY: -12 };
}

export interface Jeet { x: number; h: number; vx: number }
export interface Frog { fear: number; shades: boolean }
export interface RocketDrive { booster: boolean; piloted: boolean; frog: Frog; flame: number; flicker: number; wobble: number }

export function camera(alt: number): { y: number; scroll: number } {
  const lift = Math.min(alt, GROUND - HOVER);
  return { y: GROUND - lift, scroll: alt - lift };
}

export function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

export function shape(ctx: CanvasRenderingContext2D, points: number[][], fill: string, width = 3): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x!, y!) : ctx.moveTo(x!, y!)));
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (width > 0) { ctx.strokeStyle = INK; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
}

const STARS = Array.from({ length: 60 }, (_, i) => ({ x: noise(i * 3.1) * 960, y: noise(i * 7.7) * 420, r: 0.6 + noise(i * 1.3) * 1.4, k: 1 + noise(i * 5.9) * 3 }));
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: 60 + noise(i * 2.3) * 840, h: 140 + i * 105 + noise(i) * 60, w: 60 + noise(i * 4.7) * 90 }));

export function drawWorld(ctx: CanvasRenderingContext2D, alt: number, growth: number, time: number, reduced: boolean, frameY = 0): void {
  const { scroll } = camera(alt);
  const space = smoothstep(250, 1500, alt);
  const sky = ctx.createLinearGradient(0, -frameY, 0, 540 - frameY);
  sky.addColorStop(0, `rgb(${mix(28, 6, space)}, ${mix(72, 8, space)}, ${mix(150, 22, space)})`);
  sky.addColorStop(1, `rgb(${mix(140, 10, space)}, ${mix(190, 14, space)}, ${mix(230, 34, space)})`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, -frameY, 960, 540);
  for (const [i, s] of STARS.entries()) {
    ctx.globalAlpha = space * (reduced ? 0.8 : 0.7 + 0.3 * Math.sin(time * s.k + i));
    disc(ctx, s.x, (s.y + scroll * 0.02) % 540, s.r, '#ffffff');
  }
  ctx.globalAlpha = 1;
  // Recurring satellite traffic gives deep space depth after the launch scenery has scrolled away.
  if (growth > 4) {
    const pass = reduced ? 0.25 : (time % 18) / 18;
    ctx.save();
    ctx.translate(-100 + pass * 1160, 330 + Math.sin(pass * Math.PI * 2) * 80);
    ctx.rotate(reduced ? 0.2 : time * 0.25);
    ctx.fillStyle = '#477bac';
    ctx.fillRect(-66, -16, 48, 32); ctx.fillRect(18, -16, 48, 32);
    ctx.strokeStyle = '#92c7f5'; ctx.lineWidth = 2;
    for (const x of [-66, -50, -34, 18, 34, 50]) ctx.strokeRect(x, -16, 16, 32);
    ctx.fillStyle = '#dce4ec'; ctx.fillRect(-16, -20, 32, 40);
    disc(ctx, 0, -22, 10, '#f6cf62');
    ctx.restore();
  }
  // Passing debris fields alternate with clear space in later acts.
  if (time > 45) {
    const cycle = Math.floor((time - 45) / 18);
    const pass = ((time - 45) % 18) / 18;
    const side = cycle % 2 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const x = 480 + side * (200 + Math.sin(pass * Math.PI) * 110) + i * 36;
      const y = -60 + pass * 680 + i * 55;
      ctx.save(); ctx.translate(x, y); ctx.rotate(reduced ? 0.3 : time * 0.3 + i);
      ctx.fillStyle = cycle % 3 === 0 ? '#8490a5' : '#516f9f';
      ctx.fillRect(-12 - i * 2, -6, 24 + i * 4, 13); ctx.restore();
    }
  }
  // The moon grows with the climb and never gets any closer.
  const r = 26 + 112 * smoothstep(0, 4.6, growth);
  disc(ctx, 800, 120, r, '#f4ecd2');
  for (const [dx, dy, k] of [[-0.35, -0.2, 0.2], [0.3, 0.25, 0.14], [0.1, -0.45, 0.1], [-0.1, 0.4, 0.08]]) disc(ctx, 800 + dx! * r, 120 + dy! * r, k! * r, '#d9cfb0');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (const c of CLOUDS) {
    const y = GROUND - c.h + scroll;
    if (y < -40 || y > 580) continue;
    const x = c.x + Math.sin(time * 0.1 + c.h) * 12;
    ctx.beginPath(); ctx.ellipse(x, y, c.w * 0.5, c.w * 0.22, 0, 0, Math.PI * 2); ctx.ellipse(x - c.w * 0.4, y + 4, c.w * 0.32, c.w * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  }
  // The ground, the pad and the gantry drop away with the climb; the arm swings clear once the rocket lifts.
  const gy = GROUND + scroll;
  if (gy > 560) return;
  ctx.fillStyle = '#3e5a3c';
  ctx.fillRect(0, gy, 960, 560 - gy);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(PAD_X - 70, gy - 10, 140, 14);
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(410, gy - 250, 8, 240);
  ctx.fillRect(440, gy - 250, 8, 240);
  for (let y = gy - 240; y < gy - 10; y += 26) ctx.fillRect(418, y, 22, 3);
  ctx.save();
  ctx.translate(448, gy - 160);
  ctx.rotate(-smoothstep(0, 40, alt) * 1.3);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, -5, 36, 10);
  ctx.restore();
}

export function drawFrog(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frog: Frog): void {
  disc(ctx, x, y, r, '#5b9a45');
  const eye = r * (0.34 + 0.12 * frog.fear);
  for (const s of [-1, 1]) {
    disc(ctx, x + s * r * 0.42, y - r * 0.28, eye, '#ffffff');
    disc(ctx, x + s * r * 0.42, y - r * 0.28, eye * (0.55 - 0.25 * frog.fear), INK);
  }
  if (frog.shades) { ctx.fillStyle = INK; ctx.fillRect(x - r * 0.9, y - r * 0.55, r * 1.8, r * 0.5); }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  if (frog.fear > 0.55) ctx.ellipse(x, y + r * 0.4, r * 0.28, r * 0.25 * frog.fear, 0, 0, Math.PI * 2);
  else ctx.arc(x, y + r * 0.15, r * 0.5, 0.2, Math.PI - 0.2);
  ctx.stroke();
  if (frog.fear > 0.4 && !frog.shades) disc(ctx, x + r * 0.95, y - r * 0.6, r * 0.16, '#8fd3ff');
}

const fin = (ctx: CanvasRenderingContext2D, x: number, y: number, side: number, size: number): void => shape(ctx, [[x, y], [x + side * size, y + size * 0.35], [x, y - size * 1.4]], '#e63946', 2.5);
function hull(ctx: CanvasRenderingContext2D, top: number, bottom: number, w: number): void {
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-w / 2, top, w, bottom - top, 6); ctx.fill(); ctx.stroke();
}
function cone(ctx: CanvasRenderingContext2D, y: number, w: number): void {
  ctx.fillStyle = '#e63946';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.quadraticCurveTo(0, y - 70, w / 2, y); ctx.closePath(); ctx.fill(); ctx.stroke();
}

export function drawRocket(ctx: CanvasRenderingContext2D, drive: RocketDrive): void {
  ctx.save();
  ctx.rotate(drive.wobble);
  const base = drive.booster ? 0 : -74;
  if (drive.flame > 0) {
    const len = drive.flame * (1 + 0.18 * drive.flicker);
    for (const [k, colour] of [[1, '#f97316'], [0.65, '#fde047'], [0.32, '#ffffff']] as const) {
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.moveTo(-14 * k, base); ctx.quadraticCurveTo(-8 * k, base + len * k * 0.6, 0, base + len * k); ctx.quadraticCurveTo(8 * k, base + len * k * 0.6, 14 * k, base); ctx.fill();
    }
  }
  shape(ctx, [[-12, base - 6], [12, base - 6], [17, base + 8], [-17, base + 8]], '#374151', 0);
  if (drive.booster) {
    fin(ctx, -22, 0, -1, 26);
    fin(ctx, 22, 0, 1, 26);
    hull(ctx, -74, 0, 44);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(-22, -30, 44, 8);
  }
  fin(ctx, -21, -74, -1, 18);
  fin(ctx, 21, -74, 1, 18);
  hull(ctx, -196, -74, 42);
  if (drive.piloted) cone(ctx, -196, 42);
  ctx.save();
  ctx.translate(0, -88);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = INK;
  ctx.font = '900 16px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('$MOON', -4, 0);
  ctx.restore();
  disc(ctx, 0, -168, 17, '#1e3a5f');
  ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 4; ctx.stroke();
  if (drive.piloted) drawFrog(ctx, 0, -166, 11, drive.frog);
  ctx.restore();
}

export function drawPod(ctx: CanvasRenderingContext2D, pod: Pod, screenY: number, frog: Frog, _time: number): void {
  ctx.save();
  ctx.translate(PAD_X + pod.x, screenY);
  ctx.rotate(pod.angle.x);
  const open = Math.min(1, Math.max(0, pod.chute.x));
  if (open > 0.02) {
    ctx.save();
    const rig = podRig(open);
    ctx.fillStyle = '#d5fb6d';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, rig.canopyY, rig.radius, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    for (const x of [-44, -15, 15, 44]) { ctx.moveTo(x * open, rig.canopyY); ctx.lineTo(Math.sign(x) * 8, rig.harnessY); }
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-18, 12); ctx.lineTo(18, 12); ctx.lineTo(16, -12); ctx.quadraticCurveTo(0, -46, -16, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
  disc(ctx, 0, -8, 11, '#1e3a5f');
  drawFrog(ctx, 0, -7, 8, frog);
  ctx.restore();
}

export function drawJeet(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 3 + x) * 0.15);
  ctx.fillStyle = '#fca5a5';
  ctx.beginPath(); ctx.arc(0, -26, 16, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-16, -26); ctx.lineTo(0, -4); ctx.lineTo(16, -26); ctx.moveTo(0, -4); ctx.lineTo(0, 10); ctx.moveTo(-6, 18); ctx.lineTo(0, 10); ctx.lineTo(6, 18); ctx.stroke();
  disc(ctx, 0, -8, 5, '#fde68a');
  ctx.restore();
}

export function shred(x: number, y: number, crashX100: number, piloted: boolean): Piece[] {
  const random = mulberry32(crashX100);
  return Array.from({ length: 12 }, (_, i) => {
    const a = random() * Math.PI * 2;
    const speed = 160 + random() * 340;
    return { x, y: y - 40 - random() * 140, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 120, a: random() * 6, spin: (random() - 0.5) * 14, kind: i < 4 ? 0 : i === 8 && piloted ? 2 : i === 9 && piloted ? 3 : 1, s: 0.6 + random() * 0.8 };
  });
}

export function stepPieces(pieces: Piece[], dt: number): void {
  for (const p of pieces) {
    p.vy += 620 * dt;
    p.vx *= Math.exp(-0.4 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.a += p.spin * dt;
  }
}

export function drawPieces(ctx: CanvasRenderingContext2D, pieces: Piece[]): void {
  for (const p of pieces) {
    if (p.y > 600) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.scale(p.s, p.s);
    if (p.kind === 0) fin(ctx, 0, 0, 1, 20);
    else if (p.kind === 1) hull(ctx, -14, 14, 24);
    else if (p.kind === 2) cone(ctx, 10, 38);
    else drawFrog(ctx, 0, 0, 11, { fear: 1, shades: false });
    ctx.restore();
  }
}
