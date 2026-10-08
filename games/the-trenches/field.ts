/**
 * The battlefield: a sky of seeded shell bursts, the chart-shaped ridge
 * that steepens with the tension, the loot on the ridge that gets closer
 * with the multiplier, the mud and shell holes that scroll past as the
 * squad marches, the scope glints on the ridge, the rats and jeets that
 * run back past the line, and the nuke: a seeded mushroom cloud, a
 * shockwave, a helmet rain and a crater. Nothing here changes the outcome.
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
/** A rat or jeet running back; `step` counts its strides by the distance it has run. */
export interface Runner { kind: 'rat' | 'jeet'; x: number; y: number; vx: number; vy: number; age: number; seed: number; step: number }
export interface Helmet { x: number; y: number; vx: number; vy: number; spin: number; rot: number; landed: boolean }

/** What happened this step, for the scene's sound: the flags hold for one frame, `helmets` counts the landings. */
export interface FieldEvents { shell: boolean; jeet: boolean; flung: boolean; helmets: number }

export interface Field {
  time: number;
  /** The smoke clouds' drift, integrated so a change of wind never jumps them. */
  drift: number;
  /** Spawn counters: the bursts and runners are seeded by count, not by the clock. */
  burstCount: number;
  runnerCount: number;
  /** The rat pack still to bolt at 1.3× (−1 until it starts). */
  rats: number;
  /** Whether this round's first incoming shell has come over yet. */
  shelled: boolean;
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
  flash: number;
  /** The shelling's clock, integrated at the burst rate, and when the next burst falls due on it: a rate that rises
   * when the round starts takes effect at once instead of waiting out a gap set at the betting rate. */
  shelling: number;
  nextBurst: number;
  nextRunner: number;
}

export function createField(): Field {
  return { time: 0, drift: 0, burstCount: 0, runnerCount: 0, rats: -1, shelled: false, whooshNext: 0, events: { shell: false, jeet: false, flung: false, helmets: 0 }, bursts: [], runners: [], nuked: false, nukeAge: 0, nukeSeed: 1, cloudWobble: 0.5, cloudTilt: 0, helmets: [], flash: 0, shelling: 0, nextBurst: 0.15, nextRunner: 0 };
}

export function resetField(f: Field): void {
  f.bursts = [];
  f.runners = [];
  f.nuked = false;
  f.nukeAge = 0;
  f.helmets = [];
  f.flash = 0;
  f.burstCount = f.runnerCount = 0;
  f.rats = -1;
  f.shelled = false;
  f.nextBurst = f.shelling + 0.15;
  f.nextRunner = 0;
}

/** The slow driver for long rounds: 0 at 1×, 1/3 at 10×, 2/3 at 100×, 1 at 1000×, so the sky keeps changing after the tension has saturated. */
export const lateFor = (multiplier: number): number => clamp(Math.log10(Math.max(1, multiplier)) / 3, 0, 1);

/** The field's perspective: mud line `u` sits at mudY(u), the spacing widening toward the trench. */
export const mudY = (u: number): number => RIDGE_Y + 30 + 9 * u + 0.9 * u * u;
/** How many pixels the ground at height `y` moves per mud-line spacing marched (the slope of mudY there). */
export const mudRate = (y: number): number => Math.sqrt(Math.max(0, 81 + 3.6 * (y - RIDGE_Y - 30)));
/** The shell holes on the field: x, depth in mud lines, size. They scroll toward the trench as the squad marches. */
const HOLES: ReadonlyArray<readonly [number, number, number]> = [[140, 0.8, 30], [380, 2.5, 24], [640, 0, 34], [820, 3.2, 22], [270, 4.75, 20], [560, 4.15, 26], [470, 6.6, 28]];

/** Height of the ridge line at `x`: a chart that climbs to the right and steepens with the tension. */
export function ridgeY(x: number, tension: number, time: number): number {
  const t = x / W;
  const climb = Math.pow(t, 1 + 1.6 * tension) * (60 + 70 * tension);
  const bumps = Math.sin(t * 19 + 1) * 5 + Math.sin(t * 37 + time * 0.2) * 3 + Math.sin(t * 7.3) * 8;
  return RIDGE_Y + 40 - climb + bumps;
}

/** Fires the nuke on the ridge. `quiet` skips the effects for a crash that already happened. */
export function nuke(f: Field, seed: number, quiet: boolean): void {
  if (f.nuked) return;
  f.nuked = true;
  f.nukeSeed = seed;
  const rng = mulberry32(seed);
  f.cloudWobble = 0.3 + rng() * 0.6;
  f.cloudTilt = (rng() - 0.5) * 0.3;
  f.bursts = [];
  f.runners = [];
  f.helmets = [];
  if (quiet) { f.nukeAge = 10; return; }
  f.nukeAge = 0;
  f.flash = 1;
  for (let i = 0; i < 14; i += 1) {
    const x = 120 + rng() * 720;
    f.helmets.push({ x, y: -40 - rng() * 260, vx: (rng() - 0.5) * 40, vy: 60 + rng() * 120, spin: (rng() - 0.5) * 12, rot: rng() * 6, landed: false });
  }
}

export interface FieldDrive { running: boolean; tension: number; multiplier: number; reduced: boolean }

export function stepField(f: Field, drive: FieldDrive, dt: number): void {
  const e = f.events;
  e.shell = e.jeet = e.flung = false;
  e.helmets = 0;
  f.time += dt;
  f.drift += dt * (8 + 20 * drive.tension);
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
  f.shelling += dt * (drive.running ? 0.35 + 2.2 * drive.tension : 0.15);
  if (f.shelling > f.nextBurst && f.bursts.length < 24) {
    const n = (f.burstCount += 1) * 3.7 + 0.31;
    // Incoming shells (a streak and a whistle) from 1.4× (the first burst past it is one), more of them as the
    // tension climbs; the bursts walk lower.
    const streak = drive.running && drive.tension > 0.28 && (!f.shelled || noise(n * 4.1) > 0.78 - 0.45 * drive.tension) ? 1 : 0;
    if (streak) f.shelled = true;
    f.bursts.push({ x: 40 + noise(n) * (W - 80), y: 30 + noise(n * 1.7) * (150 + 70 * drive.tension), age: 0, life: 0.9 + noise(n * 2.3) * 0.8, size: 14 + noise(n * 3.1) * 26 * (0.5 + drive.tension), streak });
    f.nextBurst = f.shelling + 0.4 + noise(n * 5.3) * 1.4;
    // The incoming whistle, at most a couple a second.
    if (streak && f.time > f.whooshNext) { f.whooshNext = f.time + 0.6; e.shell = true; }
  }
  for (const b of f.bursts) b.age += dt;
  f.bursts = f.bursts.filter((b) => b.age < b.life);
  // Rats, then jeet-frogs, run back past the line from 1.15× (the first is a rat). At 1.3× a pack of three rats
  // bolts back half a second apart: even the rats are jeeting.
  if (drive.running && drive.multiplier >= 1.3 && f.rats < 0) { f.rats = 3; f.nextRunner = f.time; }
  if (drive.running && drive.multiplier >= 1.15 && f.time > f.nextRunner && f.runners.length < 8) {
    const count = (f.runnerCount += 1);
    const n = count * 2.9 + 0.17;
    const jeet = count > 1 && f.rats <= 0 && noise(n * 1.3) > 0.45;
    const x = 80 + noise(n) * 800;
    f.runners.push({ kind: jeet ? 'jeet' : 'rat', x, y: ridgeY(x, drive.tension, f.time) + 6, vx: (noise(n * 2) - 0.5) * 30, vy: jeet ? 38 : 50, age: 0, seed: n, step: 0 });
    if (jeet) e.jeet = true;
    f.nextRunner = f.time + (f.rats > 0 ? 0.5 : (0.5 + noise(n * 7) * 1.2) / (0.45 + drive.tension));
    if (f.rats > 0) f.rats -= 1;
  }
  for (const r of f.runners) {
    const vy = r.vy * (0.6 + r.y / 400);
    r.age += dt; r.x += r.vx * dt; r.y += vy * dt;
    // Strides follow the ground covered, so the legs speed up as the runner does.
    r.step += dt * Math.hypot(r.vx, vy) / (r.kind === 'rat' ? 45 : 55);
  }
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
  const late = lateFor(multiplier);
  g.addColorStop(0, f.nuked ? `rgb(${mix(52, 120, heat)}, ${mix(48, 60, heat)}, ${mix(70, 40, heat)})` : `rgb(${52 + 30 * tension + 26 * late}, ${48 + 10 * tension - 14 * late}, ${70 - 20 * tension - 10 * late})`);
  g.addColorStop(1, f.nuked ? `rgb(${mix(140, 230, heat)}, ${mix(96, 140, heat)}, ${mix(70, 60, heat)})` : `rgb(${140 + 60 * tension + 40 * late}, ${96 - 20 * tension - 26 * late}, ${70 - 20 * tension - 14 * late})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, RIDGE_Y + 60);
  // The moon: loot in the sky, bigger with the multiplier and still growing on a thousand-x round.
  const moonR = 22 + 14 * tension + 28 * late;
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
    const cx = ((i * 230 + f.drift) % (W + 200)) - 100;
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

/** The ridge and the ground down to the trench: loot, shell holes, mud, the runners, and the crater after the nuke. `scroll` is the distance the squad has marched, in mud lines. */
export function drawGround(ctx: CanvasRenderingContext2D, f: Field, tension: number, progress: number, scroll = 0): void {
  const heat = f.nuked ? smoothstep(0, 2, f.nukeAge) : 0;
  const ridge: number[] = [];
  for (let x = 0; x <= W; x += 12) ridge.push(ridgeY(x, tension, f.time));
  const line = (dy: number): void => { ctx.beginPath(); ridge.forEach((y, i) => ctx.lineTo(i * 12, y + dy)); };
  // Far ridge.
  ctx.fillStyle = `rgb(${mix(78, 60, heat)}, ${mix(72, 52, heat)}, ${mix(52, 46, heat)})`;
  line(0); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  line(0); ctx.stroke();
  // The chart line dotted along the ridge: it is the curve you are running up.
  ctx.setLineDash([6, 8]); ctx.strokeStyle = '#7cf67c'; ctx.lineWidth = 2;
  line(-6); ctx.stroke(); ctx.setLineDash([]);
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
  // Mud, sludge lines and shell holes between the ridge and the trench, kept below the ridge line. They scroll
  // toward the trench with the squad's march (spreading with the perspective), so planted feet move with the ground.
  ctx.save();
  line(0); ctx.lineTo(W, TRENCH_Y + 10); ctx.lineTo(0, TRENCH_Y + 10); ctx.closePath(); ctx.clip();
  const mud = ctx.createLinearGradient(0, RIDGE_Y, 0, TRENCH_Y);
  mud.addColorStop(0, `rgba(${mix(96, 70, heat)}, ${mix(84, 56, heat)}, 56, 0)`);
  mud.addColorStop(1, `rgba(${mix(96, 70, heat)}, ${mix(84, 56, heat)}, 56, 0.9)`);
  ctx.fillStyle = mud; ctx.fillRect(0, RIDGE_Y, W, TRENCH_Y - RIDGE_Y + 10);
  const shift = scroll - Math.floor(scroll);
  const spread = (x: number, u: number): number => W / 2 + (x - W / 2) * (0.55 + 0.45 * (9 + 1.8 * u) / 18);
  ctx.lineWidth = 2;
  for (let i = -2; i < 8; i += 1) {
    const u = i + shift;
    const y = mudY(u);
    const n = i - Math.floor(scroll);
    ctx.strokeStyle = `rgba(28, 31, 38, ${0.35 * smoothstep(-2, -0.8, u)})`;
    ctx.beginPath(); ctx.moveTo(spread(40 + noise(n) * 200, u), y); ctx.quadraticCurveTo(spread(300 + noise(n * 2) * 300, u), y + 4, spread(700 + noise(n * 3) * 220, u), y); ctx.stroke();
  }
  for (const [hx, h0, size] of HOLES) {
    const u = ((h0 + scroll + 2) % 9 + 9) % 9 - 2;
    const hy = mudY(u);
    const hr = size * (9 + 1.8 * u) / 14;
    ctx.globalAlpha = smoothstep(-2, -0.8, u);
    const x = spread(hx, u);
    ctx.fillStyle = '#3d3427'; ctx.beginPath(); ctx.ellipse(x, hy, hr, hr * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#5d5040'; ctx.beginPath(); ctx.ellipse(x, hy - 3, hr * 0.7, hr * 0.22, 0, Math.PI, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Scope glints on the ridge: one sniper from 2.2×, a second from 4×.
  for (const [gx, from, rate] of [[700, 0.52, 3.1], [300, 0.72, 2.3]] as const) {
    const glint = f.nuked ? 0 : Math.max(0, Math.sin(f.time * rate + gx)) * smoothstep(from, from + 0.08, tension);
    if (glint <= 0.1) continue;
    const gy = ridgeY(gx, tension, f.time) + 5;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(f.time);
    ctx.strokeStyle = `rgba(255, 255, 255, ${glint})`; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-10 - 8 * glint, 0); ctx.lineTo(10 + 8 * glint, 0); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = `rgba(255, 60, 60, ${glint})`; ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fill();
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
        const phase = r.step * Math.PI * 2 + side;
        ctx.beginPath(); ctx.moveTo(side * 3, 4); ctx.lineTo(side * 7 + Math.cos(phase) * 3, 7 + Math.max(0, Math.sin(phase)) * 2); ctx.stroke();
      }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(9, -2, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      const bob = Math.abs(Math.sin(r.step * Math.PI * 2)) * 4;
      ctx.fillStyle = '#5cab4a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -10 - bob, 11, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc(ex, -16 - bob, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = INK; for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc(ex, -16 - bob, 1.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.lineCap = 'round';
      const step = r.step * Math.PI * 2;
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

/** Advancing field details under the squad: mud, cover and discarded kit return in bounded chapters. `alpha` fades them out at the nuke. */
export function drawAdvance(ctx: CanvasRenderingContext2D, seconds: number, reduced: boolean, alpha = 1): void {
  const act = endurance(seconds); if (!act.act || alpha <= 0) return;
  const age = seconds - 42 - act.cycle * 26;
  const drift = reduced ? 55 : Math.min(120, age * 5);
  ctx.save();
  ctx.globalAlpha = alpha;
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
