/**
 * The battlefield: a sky of seeded shell bursts, the chart-shaped ridge
 * that steepens with the tension, the loot on the ridge that gets closer
 * with the multiplier, the mud and shell holes with a scope glint, the
 * rats and jeets that run back past the line, and the nuke: a seeded
 * mushroom cloud, a shockwave, a helmet rain and a crater. Nothing here
 * changes the outcome.
 */
import { endurance } from './endurance';
import { clamp, mix, mulberry32, noise, smoothstep } from './motion';

export const INK = '#1c1f26';
export const W = 960;
export const H = 540;
/** Where the trench lip sits and where the ridge line runs at the centre. */
export const TRENCH_Y = 400;
export const RIDGE_Y = 292;
export const RIDGE_X = 500;

export interface Burst { x: number; y: number; age: number; life: number; size: number; streak: number }
export interface Runner { kind: 'rat' | 'jeet'; x: number; y: number; vx: number; vy: number; age: number; seed: number }
export interface Helmet { x: number; y: number; vx: number; vy: number; spin: number; rot: number; landed: boolean }
export interface Silhouette { x0: number; y0: number; x1: number; y1: number; rot: number; peak: number }

/** What happened this step, for the scene's sound: the flags hold for one frame, `helmets` counts the landings. */
export interface FieldEvents { shell: boolean; jeet: boolean; flung: boolean; helmets: number }

export interface Field {
  time: number;
  whooshNext: number;
  events: FieldEvents;
  bursts: Burst[];
  runners: Runner[];
  nuked: boolean;
  nukeAge: number;
  nukeSeed: number;
  cloudWobble: number;
  cloudTilt: number;
  helmets: Helmet[];
  flung: Silhouette[];
  flash: number;
  nextBurst: number;
  nextRunner: number;
}

export function createField(): Field {
  return { time: 0, whooshNext: 0, events: { shell: false, jeet: false, flung: false, helmets: 0 }, bursts: [], runners: [], nuked: false, nukeAge: 0, nukeSeed: 1, cloudWobble: 0.5, cloudTilt: 0, helmets: [], flung: [], flash: 0, nextBurst: 1, nextRunner: 3 };
}

export function resetField(f: Field): void {
  f.bursts = [];
  f.runners = [];
  f.nuked = false;
  f.nukeAge = 0;
  f.helmets = [];
  f.flung = [];
  f.flash = 0;
  f.nextBurst = f.time + 1;
  f.nextRunner = f.time + 3;
}

/** Height of the ridge line at `x`: a chart that climbs to the right and steepens with the tension. */
export function ridgeY(x: number, tension: number, time: number): number {
  const t = x / W;
  const climb = Math.pow(t, 1 + 1.6 * tension) * (60 + 70 * tension);
  const bumps = Math.sin(t * 19 + 1) * 5 + Math.sin(t * 37 + time * 0.2) * 3 + Math.sin(t * 7.3) * 8;
  return RIDGE_Y + 40 - climb + bumps;
}

/** Fires the nuke on the ridge. `quiet` skips the effects for a crash that already happened. */
export function nuke(f: Field, seed: number, quiet: boolean, frogXs: number[]): void {
  if (f.nuked) return;
  f.nuked = true;
  f.nukeSeed = seed;
  const rng = mulberry32(seed);
  f.cloudWobble = 0.3 + rng() * 0.6;
  f.cloudTilt = (rng() - 0.5) * 0.3;
  f.bursts = [];
  f.runners = [];
  f.helmets = [];
  f.flung = [];
  if (quiet) { f.nukeAge = 10; return; }
  f.nukeAge = 0;
  f.flash = 1;
  for (let i = 0; i < 14; i += 1) {
    const x = 120 + rng() * 720;
    f.helmets.push({ x, y: -40 - rng() * 260, vx: (rng() - 0.5) * 40, vy: 60 + rng() * 120, spin: (rng() - 0.5) * 12, rot: rng() * 6, landed: false });
  }
  frogXs.forEach((x, i) => {
    f.flung.push({ x0: x, y0: RIDGE_Y + 30, x1: 140 + i * 160 + (rng() - 0.5) * 60, y1: TRENCH_Y + 90 + rng() * 30, rot: (rng() - 0.5) * 14, peak: 120 + rng() * 120 });
  });
}

export interface FieldDrive { running: boolean; tension: number; multiplier: number; reduced: boolean }

export function stepField(f: Field, drive: FieldDrive, dt: number): void {
  const e = f.events;
  e.shell = e.jeet = e.flung = false;
  e.helmets = 0;
  f.time += dt;
  if (f.nuked) {
    const was = f.nukeAge;
    f.nukeAge += dt;
    if (was <= 0.15 && f.nukeAge > 0.15) e.flung = true;
    f.flash = Math.max(0, f.flash - dt / 0.7);
    for (const h of f.helmets) {
      if (h.landed) continue;
      h.vy += 420 * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.spin * dt;
      const floor = h.y > TRENCH_Y + 20 ? TRENCH_Y + 96 + noise(h.x) * 30 : Infinity;
      if (h.y >= floor) { h.y = floor; h.landed = true; e.helmets += 1; }
    }
    return;
  }
  const rate = drive.running ? 0.35 + 2.2 * drive.tension : 0.15;
  if (f.time > f.nextBurst && f.bursts.length < 24) {
    const n = f.time * 3.7;
    const streak = drive.tension > 0.5 && noise(n * 4.1) > 0.4 ? 1 : 0;
    f.bursts.push({ x: 40 + noise(n) * (W - 80), y: 30 + noise(n * 1.7) * 200, age: 0, life: 0.9 + noise(n * 2.3) * 0.8, size: 14 + noise(n * 3.1) * 26 * (0.5 + drive.tension), streak });
    f.nextBurst = f.time + (0.4 + noise(n * 5.3) * 1.4) / rate;
    // The incoming whistle, at most a couple a second.
    if (streak && drive.running && f.time > f.whooshNext) { f.whooshNext = f.time + 0.6; e.shell = true; }
  }
  for (const b of f.bursts) b.age += dt;
  f.bursts = f.bursts.filter((b) => b.age < b.life);
  if (drive.running && drive.tension > 0.25 && f.time > f.nextRunner && f.runners.length < 8) {
    const n = f.time * 2.9;
    const jeet = noise(n * 1.3) > 0.55;
    const x = 80 + noise(n) * 800;
    f.runners.push({ kind: jeet ? 'jeet' : 'rat', x, y: ridgeY(x, drive.tension, f.time) + 6, vx: (noise(n * 2) - 0.5) * 60, vy: jeet ? 90 : 140, age: 0, seed: n });
    if (jeet) e.jeet = true;
    f.nextRunner = f.time + (1.2 + noise(n * 7) * 2.5) / (0.4 + drive.tension);
  }
  for (const r of f.runners) { r.age += dt; r.x += r.vx * dt; r.y += r.vy * dt * (0.6 + r.y / 400); }
  f.runners = f.runners.filter((r) => r.y < H + 60);
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x - r * 0.9, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 0.9, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x - r * 0.4, y - r * 0.4, r * 0.65, 0, Math.PI * 2);
  ctx.arc(x + r * 0.45, y - r * 0.35, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Sky, bursts, the moon that grows with the multiplier. */
export function drawSky(ctx: CanvasRenderingContext2D, f: Field, tension: number, multiplier: number, reduced: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, RIDGE_Y + 40);
  const heat = f.nuked ? smoothstep(0, 1.5, f.nukeAge) : 0;
  g.addColorStop(0, f.nuked ? `rgb(${mix(52, 120, heat)}, ${mix(48, 60, heat)}, ${mix(70, 40, heat)})` : `rgb(${52 + 30 * tension}, ${48 + 10 * tension}, ${70 - 20 * tension})`);
  g.addColorStop(1, f.nuked ? `rgb(${mix(140, 230, heat)}, ${mix(96, 140, heat)}, ${mix(70, 60, heat)})` : `rgb(${140 + 60 * tension}, ${96 - 20 * tension}, ${70 - 20 * tension})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, RIDGE_Y + 60);
  // The moon: loot in the sky, bigger with the multiplier.
  const moonR = 22 + 26 * clamp(Math.log2(Math.max(1, multiplier)) / 3.3, 0, 1);
  ctx.fillStyle = '#f2e6b3';
  ctx.beginPath(); ctx.arc(830, 78, moonR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(120, 110, 80, 0.35)';
  for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.3, 0.13], [0.1, -0.45, 0.1]] as const) { ctx.beginPath(); ctx.arc(830 + dx * moonR, 78 + dy * moonR, r * moonR, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(830, 78, moonR, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WEN', 830, 82 + moonR + 14);
  // Clouds of smoke drifting.
  for (let i = 0; i < 5; i += 1) {
    const cx = ((i * 230 + f.time * (8 + 20 * tension)) % (W + 200)) - 100;
    cloud(ctx, cx, 140 + i * 22, 26, `rgba(${90 + 20 * tension}, ${80}, ${90}, 0.35)`);
  }
  for (const b of f.bursts) {
    const k = b.age / b.life;
    if (b.streak && k < 0.35 && !reduced) {
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x - 90 * (1 - k / 0.35), b.y - 160 * (1 - k / 0.35)); ctx.lineTo(b.x, b.y); ctx.stroke();
      continue;
    }
    const r = b.size * (0.4 + 0.6 * smoothstep(0, 0.3, k)) * (1 + 0.3 * k);
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = k < 0.25 ? '#ffe27a' : '#8e8a86';
    ctx.beginPath();
    for (let i = 0; i < 9; i += 1) { const a = i * Math.PI * 2 / 9; const rr = r * (0.8 + 0.3 * noise(b.x + i)); ctx.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    if (k < 0.25 && !reduced) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.35, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}

function lambo(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#ff9f1c'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-34, -12); ctx.lineTo(-12, -14); ctx.lineTo(0, -24); ctx.lineTo(22, -24); ctx.lineTo(36, -12); ctx.lineTo(42, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.moveTo(-8, -13); ctx.lineTo(1, -21); ctx.lineTo(20, -21); ctx.lineTo(28, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; for (const wx of [-24, 26]) { ctx.beginPath(); ctx.arc(wx, 2, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.arc(wx, 2, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = INK; }
  ctx.restore();
}

function bag(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-10, -26); ctx.quadraticCurveTo(-20, 0, 0, 0); ctx.quadraticCurveTo(20, 0, 10, -26); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7cf67c'; ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', 0, -7);
  ctx.restore();
}

type Point = { x: number; y: number };

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + (dx / distance) * along - (dy / distance) * bend, y: root.y + (dy / distance) * along + (dx / distance) * bend };
}

function frogSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, s: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -16, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
  const limbs: ReadonlyArray<readonly [Point, Point, number]> = [
    [{ x: -8, y: 4 }, { x: -22, y: 18 }, -1],
    [{ x: 8, y: 4 }, { x: 24, y: 16 }, 1],
    [{ x: -8, y: -6 }, { x: -22, y: -20 }, -1],
    [{ x: 8, y: -6 }, { x: 24, y: -18 }, 1],
  ];
  for (const [a, b, side] of limbs) {
    const joint = bendJoint(a, b, 14, 13, side);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}

/** The ridge and the ground down to the trench: loot, shell holes, mud, the runners, and the crater after the nuke. */
export function drawGround(ctx: CanvasRenderingContext2D, f: Field, tension: number, progress: number): void {
  const heat = f.nuked ? smoothstep(0, 2, f.nukeAge) : 0;
  // Far ridge.
  ctx.fillStyle = `rgb(${mix(78, 60, heat)}, ${mix(72, 52, heat)}, ${mix(52, 46, heat)})`;
  ctx.beginPath(); ctx.moveTo(0, ridgeY(0, tension, f.time));
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, ridgeY(x, tension, f.time));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, ridgeY(0, tension, f.time));
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, ridgeY(x, tension, f.time));
  ctx.stroke();
  // The chart line dotted along the ridge: it is the curve you are running up.
  ctx.setLineDash([6, 8]); ctx.strokeStyle = '#7cf67c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, ridgeY(0, tension, f.time) - 6);
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, ridgeY(x, tension, f.time) - 6);
  ctx.stroke(); ctx.setLineDash([]);
  // Loot on the ridge, closer with the multiplier.
  const ly = ridgeY(RIDGE_X + 120, tension, f.time) - 2;
  const ls = 0.45 + 0.55 * progress;
  if (f.nuked) {
    const k = smoothstep(0, 1.2, f.nukeAge);
    ctx.fillStyle = `rgba(20, 16, 14, ${0.9 * k})`;
    ctx.beginPath(); ctx.ellipse(RIDGE_X + 90, ly + 10, 150 * k, 34 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  } else {
    bag(ctx, RIDGE_X + 40, ly, ls); bag(ctx, RIDGE_X + 70, ly + 4, ls * 0.9);
    lambo(ctx, RIDGE_X + 150, ly, ls);
    bag(ctx, RIDGE_X + 220, ly + 2, ls * 0.85);
  }
  // Mud, sludge lines and shell holes between the ridge and the trench.
  const mud = ctx.createLinearGradient(0, RIDGE_Y, 0, TRENCH_Y);
  mud.addColorStop(0, `rgba(${mix(96, 70, heat)}, ${mix(84, 56, heat)}, 56, 0)`);
  mud.addColorStop(1, `rgba(${mix(96, 70, heat)}, ${mix(84, 56, heat)}, 56, 0.9)`);
  ctx.fillStyle = mud; ctx.fillRect(0, RIDGE_Y, W, TRENCH_Y - RIDGE_Y + 10);
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const y = RIDGE_Y + 30 + i * 9 + i * i * 0.9;
    ctx.beginPath(); ctx.moveTo(40 + noise(i) * 200, y); ctx.quadraticCurveTo(300 + noise(i * 2) * 300, y + 4, 700 + noise(i * 3) * 220, y); ctx.stroke();
  }
  const holes: [number, number, number][] = [[140, 330, 30], [380, 350, 24], [640, 322, 34], [820, 360, 22], [270, 385, 20], [560, 375, 26]];
  for (const [hx, hy, hr] of holes) {
    ctx.fillStyle = '#3d3427'; ctx.beginPath(); ctx.ellipse(hx, hy, hr, hr * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#5d5040'; ctx.beginPath(); ctx.ellipse(hx, hy - 3, hr * 0.7, hr * 0.22, 0, Math.PI, Math.PI * 2); ctx.fill();
  }
  // The scope glint in a hole once the tension is high.
  const glint = tension > 0.6 && !f.nuked ? Math.max(0, Math.sin(f.time * 3.1)) * smoothstep(0.6, 0.8, tension) : 0;
  if (glint > 0.1) {
    ctx.save(); ctx.translate(640, 316); ctx.rotate(f.time);
    ctx.strokeStyle = `rgba(255, 255, 255, ${glint})`; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-10 - 8 * glint, 0); ctx.lineTo(10 + 8 * glint, 0); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = `rgba(255, 60, 60, ${glint})`; ctx.beginPath(); ctx.arc(640, 316, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Rats and jeets running back toward the trench.
  for (const r of f.runners) {
    const s = 0.5 + r.y / 400;
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale(s, s);
    if (r.kind === 'rat') {
      ctx.fillStyle = '#6b6b70'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-24, -6 + Math.sin(r.age * 20) * 6, -30, 2); ctx.stroke();
      ctx.lineWidth = 1.6;
      for (const side of [-1, 1]) {
        const phase = r.age * 22 + side;
        ctx.beginPath(); ctx.moveTo(side * 3, 4); ctx.lineTo(side * 7 + Math.cos(phase) * 3, 7 + Math.max(0, Math.sin(phase)) * 2); ctx.stroke();
      }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(9, -2, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      const bob = Math.abs(Math.sin(r.age * 14)) * 4;
      ctx.fillStyle = '#5cab4a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -10 - bob, 11, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc(ex, -16 - bob, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = INK; for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc(ex, -16 - bob, 1.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.lineCap = 'round';
      const step = r.age * 14;
      for (const side of [-1, 1]) {
        const phase = step + (side > 0 ? Math.PI : 0);
        const lift = Math.max(0, Math.sin(phase)) * 6;
        const reach = Math.cos(phase) * 4;
        const hip = { x: side * 5, y: -4 - bob * 0.2 };
        const foot = { x: side * 7 + reach, y: 8 - lift };
        const knee = bendJoint(hip, foot, 10, 9, -side);
        ctx.strokeStyle = INK; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
        ctx.strokeStyle = '#4a9440'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeText('JEET', 0, -30 - bob); ctx.fillText('JEET', 0, -30 - bob);
    }
    ctx.restore();
  }
}

/** The mushroom cloud on the ridge, drawn between the ground and the squad. */
export function drawCloud(ctx: CanvasRenderingContext2D, f: Field, tension: number, reduced: boolean): void {
  if (!f.nuked) return;
  const a = f.nukeAge;
  const rise = smoothstep(0, 2.4, a);
  const base = ridgeY(RIDGE_X + 100, tension, f.time);
  const cx = RIDGE_X + 100;
  ctx.save();
  ctx.translate(cx, base);
  ctx.rotate(f.cloudTilt * rise);
  const wob = reduced ? 0 : Math.sin(f.time * 2.3) * 6 * f.cloudWobble;
  // Stem.
  const stemH = 40 + 170 * rise;
  const stemW = 26 + 34 * rise;
  const stem = ctx.createLinearGradient(0, 0, 0, -stemH);
  stem.addColorStop(0, '#ffb347'); stem.addColorStop(0.5, '#9c7c6c'); stem.addColorStop(1, '#6d5c5a');
  ctx.fillStyle = stem; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-stemW, 0); ctx.quadraticCurveTo(-stemW * 0.6 + wob, -stemH * 0.5, -stemW * 0.8, -stemH); ctx.lineTo(stemW * 0.8, -stemH); ctx.quadraticCurveTo(stemW * 0.6 + wob, -stemH * 0.5, stemW, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Cap.
  const capR = 30 + 90 * rise;
  cloud(ctx, wob * 0.5, -stemH - capR * 0.3, capR, '#7d6b6b');
  cloud(ctx, wob * 0.5, -stemH - capR * 0.3, capR * 0.82, '#a89390');
  cloud(ctx, wob * 0.3, -stemH - capR * 0.45, capR * 0.5, a < 1.5 ? '#ffd166' : '#c9b8b3');
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(wob * 0.5, -stemH - capR * 0.3, capR, 0, Math.PI * 2); ctx.stroke();
  // Ground ring.
  const ring = smoothstep(0, 1.6, a);
  ctx.strokeStyle = `rgba(255, 230, 160, ${1 - ring})`; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(0, 6, 40 + 600 * ring, 12 + 140 * ring, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // Frogs flung back in silhouette against the light.
  for (const s of f.flung) {
    const k = smoothstep(0.15, 1.1, a);
    if (k <= 0) continue;
    const x = mix(s.x0, s.x1, k);
    const y = mix(s.y0, s.y1, k) - Math.sin(k * Math.PI) * s.peak;
    frogSilhouette(ctx, x, y, s.rot * k, 0.9 + 0.6 * k);
  }
}

/** The helmet rain and the flash, drawn on top of everything. */
export function drawNukeFront(ctx: CanvasRenderingContext2D, f: Field, reduced: boolean): void {
  if (!f.nuked) return;
  for (const h of f.helmets) {
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
    ctx.fillStyle = '#5e6b3a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0, Math.PI, Math.PI * 2); ctx.lineTo(20, 0); ctx.lineTo(-20, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (f.flash > 0 && !reduced) { ctx.fillStyle = `rgba(255, 250, 230, ${f.flash * f.flash})`; ctx.fillRect(0, 0, W, H); }
}

/** Advancing field details under the squad: mud, cover and discarded kit return in bounded chapters. */
export function drawAdvance(ctx: CanvasRenderingContext2D, seconds: number, reduced: boolean): void {
  const act = endurance(seconds); if (!act.act) return;
  const age = seconds - 42 - act.cycle * 26;
  const drift = reduced ? 55 : Math.min(120, age * 5);
  ctx.save();
  if (act.act === 2 || act.act === 4) {
    ctx.fillStyle = act.act === 2 ? '#453926' : '#58613b';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(210 + i * 130, 285 + drift * .65, 45, 10 + act.effort * 5, 0, 0, Math.PI * 2); ctx.fill(); }
  } else {
    for (const x of [86, 800]) {
      const y = 265 + drift;
      ctx.fillStyle = '#a58e5f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.roundRect(x + j * 22, y - j % 2 * 9, 35, 16, 7); ctx.fill(); ctx.stroke(); }
      if (act.act === 3) {
        ctx.strokeStyle = '#c4b59a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 24, y); ctx.lineTo(x + 24, y - 45); ctx.stroke();
        ctx.fillStyle = '#78984a'; ctx.beginPath(); ctx.moveTo(x + 24, y - 45); ctx.lineTo(x + 49 + act.effort * 7, y - 35); ctx.lineTo(x + 24, y - 26); ctx.fill();
      }
    }
  }
  ctx.restore();
}
