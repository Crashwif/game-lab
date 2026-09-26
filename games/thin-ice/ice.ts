/**
 * The frozen lake: a scrolling ice plane seen from the near bank, with a
 * crack network that spreads around the skater as the tension rises, skate
 * trails, and the shatter: at the crash the ice around her breaks along
 * seeded rays and rings into floes that tilt, bob and drift apart on open
 * water.
 */
import { clamp, mix, mulberry32, noise } from './motion';

/** Screen y of the far edge of the ice (the shore line) and the near edge. */
export const ICE_FAR_Y = 236;
export const ICE_NEAR_Y = 500;
/** The plane is foreshortened: a circle on the ice is this much flatter on screen. */
export const FORESHORTEN = 0.45;
export const INK = '#1c1f26';

export interface Point { x: number; y: number }

export interface Crack {
  /** World x and screen y along the crack. */
  points: Point[];
  growth: number;
  width: number;
}

export interface Floe {
  cx: number;
  cy: number;
  verts: Point[];
  drift: Point;
  tilt: number;
  phase: number;
  sink: number;
  offset: Point;
}

export interface Ripple { age: number; life: number; r: number }

export interface IceState {
  cracks: Crack[];
  trails: Point[][];
  floes: Floe[];
  ripples: Ripple[];
  shattered: boolean;
  shatterAt: Point;
  shatterAge: number;
  sheen: number;
  crackClock: number;
  rippleClock: number;
}

export function createIce(): IceState {
  return { cracks: [], trails: [[], []], floes: [], ripples: [], shattered: false, shatterAt: { x: 0, y: 0 }, shatterAge: 0, sheen: 0, crackClock: 0, rippleClock: 0 };
}

export function resetIce(ice: IceState): void {
  ice.cracks = [];
  ice.trails = [[], []];
  ice.floes = [];
  ice.ripples = [];
  ice.shattered = false;
  ice.shatterAge = 0;
}

/** A seeded random walk with one branch, starting near a point on the ice. */
export function spawnCrack(ice: IceState, x: number, y: number, tension: number, seed: number): void {
  const rng = mulberry32(Math.floor(seed * 1000));
  const walk = (sx: number, sy: number, heading: number, steps: number, scale: number): Point[] => {
    const pts: Point[] = [{ x: sx, y: sy }];
    let h = heading;
    for (let i = 0; i < steps; i += 1) {
      h += (rng() - 0.5) * 1.2;
      const len = (10 + rng() * 22) * scale;
      const last = pts[pts.length - 1]!;
      pts.push({ x: last.x + Math.cos(h) * len, y: last.y + Math.sin(h) * len * FORESHORTEN });
    }
    return pts;
  };
  const scale = 0.6 + tension * 1.2;
  const main = walk(x, y, rng() * Math.PI * 2, 4 + Math.floor(rng() * 5), scale);
  ice.cracks.push({ points: main, growth: 0, width: 1.2 + tension * 1.4 });
  const at = main[1 + Math.floor(rng() * (main.length - 2))]!;
  const branch = walk(at.x, at.y, rng() * Math.PI * 2, 2 + Math.floor(rng() * 3), scale * 0.7);
  ice.cracks.push({ points: branch, growth: -0.3, width: 0.9 + tension });
  if (ice.cracks.length > 160) ice.cracks.splice(0, ice.cracks.length - 160);
}

/** Records where a skate touched the ice, for the trails. */
export function addTrail(ice: IceState, which: 0 | 1, p: Point): void {
  const trail = ice.trails[which]!;
  const last = trail[trail.length - 1];
  if (last && Math.hypot(last.x - p.x, last.y - p.y) < 4) return;
  trail.push(p);
  if (trail.length > 140) trail.shift();
}

export function stepIce(ice: IceState, cameraX: number, dt: number): void {
  ice.sheen += dt;
  for (const c of ice.cracks) c.growth = Math.min(1, c.growth + dt * 1.6);
  ice.cracks = ice.cracks.filter((c) => c.points[0]!.x > cameraX - 300);
  for (const t of ice.trails) while (t.length && t[0]!.x < cameraX - 200) t.shift();
  if (!ice.shattered) return;
  ice.shatterAge += dt;
  const open = clamp(ice.shatterAge / 0.9, 0, 1);
  for (const f of ice.floes) {
    const spread = 14 * (1 - Math.exp(-ice.shatterAge / 1.4)) * f.sink;
    f.offset = { x: f.drift.x * spread * open, y: f.drift.y * spread * open * FORESHORTEN };
  }
  ice.rippleClock += dt;
  while (ice.rippleClock > 0.6) {
    ice.rippleClock -= 0.6;
    ice.ripples.push({ age: 0, life: 2.2, r: 0 });
  }
  for (const r of ice.ripples) { r.age += dt; r.r += 70 * dt; }
  ice.ripples = ice.ripples.filter((r) => r.age < r.life);
}

/** The ice around a point breaks along seeded rays and rings into floes. */
export function shatterIce(ice: IceState, x: number, y: number, seed: number, quiet: boolean): void {
  const rng = mulberry32(seed);
  ice.shattered = true;
  ice.shatterAt = { x, y };
  ice.shatterAge = quiet ? 10 : 0;
  ice.floes = [];
  const rays = 9 + Math.floor(rng() * 4);
  const angles: number[] = [];
  for (let i = 0; i < rays; i += 1) angles.push(((i + rng() * 0.6) / rays) * Math.PI * 2);
  const rings = [0, 62, 138, 232];
  for (let ring = 1; ring < rings.length; ring += 1) {
    const r0 = rings[ring - 1]!;
    const r1 = rings[ring]!;
    for (let i = 0; i < rays; i += 1) {
      const a0 = angles[i]!;
      const a1 = angles[(i + 1) % rays]! + (i + 1 === rays ? Math.PI * 2 : 0);
      const pt = (r: number, a: number): Point => ({ x: Math.cos(a) * r * (0.9 + rng() * 0.2), y: Math.sin(a) * r * FORESHORTEN * (0.9 + rng() * 0.2) });
      const verts = r0 === 0 ? [{ x: 0, y: 0 }, pt(r1, a0), pt(r1, (a0 + a1) / 2), pt(r1, a1)] : [pt(r0, a0), pt(r1, a0), pt(r1, (a0 + a1) / 2), pt(r1, a1), pt(r0, a1)];
      const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
      const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
      const am = (a0 + a1) / 2;
      ice.floes.push({
        cx: x + cx, cy: y + cy, verts: verts.map((v) => ({ x: v.x - cx, y: v.y - cy })),
        drift: { x: Math.cos(am), y: Math.sin(am) }, tilt: (rng() - 0.5) * 0.5, phase: rng() * Math.PI * 2,
        sink: ring === 1 ? 1 : ring === 2 ? 0.55 : 0.25, offset: { x: 0, y: 0 },
      });
    }
  }
  // Nearby cracks are now part of the break.
  ice.cracks = ice.cracks.filter((c) => Math.hypot(c.points[0]!.x - x, (c.points[0]!.y - y) / FORESHORTEN) > 240);
}

export function drawIce(ctx: CanvasRenderingContext2D, ice: IceState, cameraX: number, time: number): void {
  // The plane: pale near the shore, bluer and glossier toward the near bank.
  const plane = ctx.createLinearGradient(0, ICE_FAR_Y, 0, ICE_NEAR_Y + 40);
  plane.addColorStop(0, '#dbe9f3');
  plane.addColorStop(0.45, '#c3d9ea');
  plane.addColorStop(1, '#9fbfd9');
  ctx.fillStyle = plane;
  ctx.fillRect(0, ICE_FAR_Y, 960, 540 - ICE_FAR_Y);
  // Frozen-in streaks and a slow sweeping sheen.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 40; i += 1) {
    const wx = noise(i * 7.1) * 2400;
    const sx = (((wx - cameraX * (0.6 + 0.4 * noise(i))) % 2400) + 2400) % 2400 - 700;
    const sy = ICE_FAR_Y + 14 + noise(i * 3.3) * (ICE_NEAR_Y - ICE_FAR_Y - 20);
    const len = 30 + noise(i * 5.7) * 90;
    ctx.globalAlpha = 0.25 + 0.5 * noise(i * 9.1);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + len, sy + (noise(i * 2.2) - 0.5) * 6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const sweep = ((time * 40) % 1600) - 400;
  const sheen = ctx.createLinearGradient(sweep - 200, ICE_NEAR_Y, sweep + 200, ICE_FAR_Y);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, ICE_FAR_Y, 960, 540 - ICE_FAR_Y);
  // Skate trails.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (const trail of ice.trails) {
    if (trail.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(trail[0]!.x - cameraX, trail[0]!.y);
    for (const p of trail) ctx.lineTo(p.x - cameraX, p.y);
    ctx.stroke();
  }
}

export function drawCracks(ctx: CanvasRenderingContext2D, ice: IceState, cameraX: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const c of ice.cracks) {
    if (c.growth <= 0) continue;
    const n = c.points.length - 1;
    const reach = c.growth * n;
    const full = Math.floor(reach);
    ctx.strokeStyle = 'rgba(40, 60, 90, 0.75)';
    ctx.lineWidth = c.width;
    ctx.beginPath();
    ctx.moveTo(c.points[0]!.x - cameraX, c.points[0]!.y);
    for (let i = 1; i <= full && i <= n; i += 1) ctx.lineTo(c.points[i]!.x - cameraX, c.points[i]!.y);
    if (full < n) {
      const a = c.points[full]!;
      const b = c.points[full + 1]!;
      const t = reach - full;
      ctx.lineTo(mix(a.x, b.x, t) - cameraX, mix(a.y, b.y, t));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = Math.max(0.6, c.width * 0.4);
    ctx.stroke();
  }
}

/** Water showing through thinning ice under a point, growing with the tension. */
export function drawThinning(ctx: CanvasRenderingContext2D, x: number, y: number, tension: number, time: number): void {
  if (tension <= 0.02) return;
  const r = 40 + 120 * tension;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(30, 60, 110, ${0.45 * tension})`);
  g.addColorStop(1, 'rgba(30, 60, 110, 0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, FORESHORTEN);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 5; i += 1) {
    const p = (time * 0.4 + i * 0.2) % 1;
    const bx = x + Math.sin(i * 2.1 + time) * 30 * tension;
    const by = y + 18 - p * 30;
    ctx.globalAlpha = (1 - p) * tension;
    ctx.beginPath(); ctx.arc(bx, by, 1.5 + i * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawShatter(ctx: CanvasRenderingContext2D, ice: IceState, cameraX: number, time: number): void {
  if (!ice.shattered) return;
  const ox = ice.shatterAt.x - cameraX;
  const oy = ice.shatterAt.y;
  const open = clamp(ice.shatterAge / 0.4, 0, 1);
  // Open water under the break, with ripples.
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(1, FORESHORTEN);
  const water = ctx.createRadialGradient(0, 0, 20, 0, 0, 236);
  water.addColorStop(0, '#12315e');
  water.addColorStop(1, '#1d4b86');
  ctx.fillStyle = water;
  ctx.beginPath(); ctx.arc(0, 0, 236 * open, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200, 225, 255, 0.5)';
  ctx.lineWidth = 2;
  for (const r of ice.ripples) {
    ctx.globalAlpha = (1 - r.age / r.life) * 0.7;
    ctx.beginPath(); ctx.arc(0, 0, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Floes: the inner ring sinks and tips, the outer rings barely move.
  for (const f of ice.floes) {
    const bob = Math.sin(time * 2 + f.phase) * 0.06 * f.sink;
    ctx.save();
    ctx.translate(f.cx - cameraX + f.offset.x, f.cy + f.offset.y + f.sink * 3 * open);
    ctx.rotate((f.tilt * 0.35 + bob) * open);
    ctx.scale(1, 1 - 0.08 * f.sink * open);
    ctx.beginPath();
    ctx.moveTo(f.verts[0]!.x, f.verts[0]!.y);
    for (const v of f.verts) ctx.lineTo(v.x, v.y);
    ctx.closePath();
    ctx.fillStyle = f.sink > 0.9 ? '#b8d0e4' : '#cfe1ef';
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 50, 80, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
