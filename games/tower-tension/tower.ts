/**
 * The tower: a stack of prefab floors joined by small lateral springs (a
 * shear-building model). Each landing floor arrives with the crane hook's
 * swing, the storeys below flex under it, and wind pushes harder the higher
 * the stack gets, so the sway grows with the multiplier. At the crash the
 * joints release: the stack tips about its base and breaks apart from the top
 * down into a seeded debris fall.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, spring, stepSpring } from './motion';

export const TOWER_X = 560;
/** World y of the ground surface (y grows downward). */
export const GROUND_Y = 460;
export const FLOOR_W = 120;
export const FLOOR_H = 30;
/** The hoist rail runs this far right of the tower axis. */
export const RAIL_DX = 72;
/** Storey stiffness, inter-storey damping and air damping, per unit floor mass. */
const STIFFNESS = 700;
const DAMPING = 8;
const AIR = 1.0;
const GRAVITY = 900;
const INK = '#1c1f26';

export const TONES = [
  { fill: '#f6d8a8', edge: '#c9a66f', glass: '#5a7aa0' },
  { fill: '#e8846b', edge: '#b85b45', glass: '#4c6b8f' },
  { fill: '#7fc8b5', edge: '#4f9a87', glass: '#3f5f83' },
  { fill: '#f2c14e', edge: '#c4932a', glass: '#4f6c93' },
] as const;

export interface Floor {
  /** Lateral offset of the floor centre from the tower axis. */
  x: number;
  vx: number;
  tone: number;
  /** Landing compression: positive is squashed. */
  squash: Spring;
}

export interface Debris {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  spin: number;
  tone: number;
  index: number;
  released: boolean;
  releaseAt: number;
  resting: boolean;
  hits: number;
}

export interface Dust { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number }

export interface TowerState {
  floors: Floor[];
  /** Whole-stack vertical bump when a floor lands. */
  thud: Spring;
  collapsed: boolean;
  fallAge: number;
  /** Height at the moment of the crash, for the camera. */
  fallHeight: number;
  /** The part still attached tips about the base like a rigid rod. */
  rod: { angle: number; omega: number; height: number; dir: number };
  debris: Debris[];
  dust: Dust[];
  rng: () => number;
}

export function createTower(): TowerState {
  return { floors: [], thud: spring(0), collapsed: false, fallAge: 0, fallHeight: 0, rod: { angle: 0, omega: 0, height: 0, dir: 1 }, debris: [], dust: [], rng: mulberry32(1) };
}

export function resetTower(t: TowerState): void {
  t.floors = [];
  settleSpring(t.thud, 0);
  t.collapsed = false;
  t.fallAge = 0;
  t.fallHeight = 0;
  t.debris = [];
  t.dust = [];
}

export const floorCount = (t: TowerState): number => t.floors.length;
export const towerHeight = (t: TowerState): number => t.floors.length * FLOOR_H;
/** World y of the top surface (the foundation when empty). */
export const towerTopY = (t: TowerState): number => GROUND_Y - t.floors.length * FLOOR_H + t.thud.x;
export const topOffset = (t: TowerState): number => (t.floors.length ? t.floors[t.floors.length - 1]!.x : 0);
export const topVelocity = (t: TowerState): number => (t.floors.length ? t.floors[t.floors.length - 1]!.vx : 0);

/** Lateral offset of the stack at a world height, for the hoist rail and cage. */
export function offsetAtY(t: TowerState, y: number): number {
  const level = (GROUND_Y - y) / FLOOR_H;
  if (level <= 0 || !t.floors.length) return 0;
  const i = Math.min(t.floors.length - 1, Math.floor(level));
  const below = i === 0 ? 0 : t.floors[i - 1]!.x;
  return mix(below, t.floors[i]!.x, clamp(level - i, 0, 1));
}

export function addDust(t: TowerState, x: number, y: number, count: number, side: number, seed: number, strength = 1): void {
  for (let i = 0; i < count; i += 1) {
    const n = seed + i * 1.37;
    t.dust.push({ x: x + (noise(n) - 0.5) * 10, y: y - noise(n + 1) * 6, vx: side * (30 + noise(n + 2) * 70) * strength, vy: -(10 + noise(n + 3) * 40) * strength, r: 5 + noise(n + 4) * 7, age: 0, life: 0.6 + noise(n + 5) * 0.5 });
  }
}

/** A floor arrives from the crane with the hook's lateral offset and swing velocity. */
export function landFloor(t: TowerState, offset: number, lateralVelocity: number, quiet = false): void {
  const n = t.floors.length;
  const top = t.floors[n - 1];
  const floor: Floor = { x: (top?.x ?? 0) + offset, vx: (top?.vx ?? 0) + lateralVelocity, tone: n % TONES.length, squash: spring(0) };
  t.floors.push(floor);
  if (quiet) return;
  floor.squash.v += 5;
  t.thud.v += 90;
  const y = GROUND_Y - n * FLOOR_H;
  addDust(t, TOWER_X + floor.x - FLOOR_W / 2, y, 3, -1, n * 7);
  addDust(t, TOWER_X + floor.x + FLOOR_W / 2, y, 3, 1, n * 7 + 3);
}

function substep(t: TowerState, wind: number, h: number): void {
  const n = t.floors.length;
  if (!n) return;
  const forces = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const f = t.floors[i]!;
    const below = i ? t.floors[i - 1]! : null;
    const above = i + 1 < n ? t.floors[i + 1]! : null;
    const xb = below ? below.x : 0;
    const vb = below ? below.vx : 0;
    let force = -STIFFNESS * (f.x - xb) - DAMPING * (f.vx - vb) - AIR * f.vx + wind * (1 + i / 24);
    if (above) force += STIFFNESS * (above.x - f.x) + DAMPING * (above.vx - f.vx);
    forces[i] = force;
  }
  for (let i = 0; i < n; i += 1) t.floors[i]!.vx += forces[i]! * h;
  for (let i = 0; i < n; i += 1) t.floors[i]!.x += t.floors[i]!.vx * h;
}

export function stepTower(t: TowerState, wind: number, dt: number): void {
  if (!t.collapsed) {
    let left = dt;
    while (left > 0) {
      const h = Math.min(1 / 240, left);
      left -= h;
      substep(t, wind, h);
    }
    for (const f of t.floors) stepSpring(f.squash, 0, 30, 0.35, dt);
    stepSpring(t.thud, 0, 22, 0.5, dt);
  } else {
    stepCollapse(t, dt);
  }
  for (const d of t.dust) {
    d.age += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vx *= Math.exp(-2.5 * dt);
    d.vy -= 15 * dt;
    d.r += 28 * dt;
  }
  t.dust = t.dust.filter((d) => d.age < d.life);
}

/** The joints let go: the stack tips in the direction it leans and sheds floors from the top down. */
export function collapseTower(t: TowerState, seed: number, quiet: boolean): void {
  const rng = mulberry32(seed);
  t.rng = rng;
  const n = t.floors.length;
  const top = t.floors[n - 1];
  const lean = top?.x ?? 0;
  const dir = Math.abs(lean) > 0.5 ? Math.sign(lean) : rng() < 0.5 ? -1 : 1;
  const height = Math.max(FLOOR_H, n * FLOOR_H);
  t.collapsed = true;
  t.fallAge = quiet ? 10 : 0;
  t.fallHeight = n * FLOOR_H;
  t.rod = { angle: clamp(lean / height, -0.06, 0.06), omega: dir * 0.8 + (top?.vx ?? 0) / height, height, dir };
  t.debris = t.floors.map((f, i) => {
    const below = i ? t.floors[i - 1]!.x : 0;
    return {
      x: TOWER_X + f.x, y: GROUND_Y - (i + 0.5) * FLOOR_H, angle: Math.atan2(f.x - below, FLOOR_H) * 0.4,
      vx: f.vx, vy: 0, spin: 0, tone: f.tone, index: i,
      released: false, releaseAt: 0.12 + 0.55 * (1 - i / Math.max(1, n)) * (0.6 + 0.4 * rng()) + rng() * 0.1,
      resting: false, hits: 0,
    };
  });
  t.floors = [];
  if (!quiet) return;
  for (const d of t.debris) {
    d.released = true;
    d.resting = true;
    d.x = TOWER_X + dir * (30 + d.index * 26) + (rng() - 0.5) * 20;
    d.y = GROUND_Y - FLOOR_H / 2;
    d.angle = (rng() - 0.5) * 0.2;
    d.vx = d.vy = d.spin = 0;
  }
}

function stepCollapse(t: TowerState, dt: number): void {
  t.fallAge += dt;
  const rod = t.rod;
  rod.omega += ((1.5 * GRAVITY) / rod.height) * Math.sin(rod.angle) * dt;
  rod.angle += rod.omega * dt;
  const sin = Math.sin(rod.angle);
  const cos = Math.cos(rod.angle);
  for (const d of t.debris) {
    if (d.resting) continue;
    const r = (d.index + 0.5) * FLOOR_H;
    if (!d.released) {
      if (t.fallAge >= d.releaseAt || rod.angle * rod.dir > 1.2) {
        d.released = true;
        const outward = rod.dir * (20 + 0.18 * r) + (t.rng() - 0.5) * 220;
        d.vx = clamp(r * cos * rod.omega + outward, -520, 520);
        d.vy = r * sin * rod.omega - 40 - t.rng() * 60;
        d.spin = rod.omega * (0.6 + t.rng() * 0.8) * rod.dir + (t.rng() - 0.5) * 5;
      } else {
        d.x = TOWER_X + r * sin;
        d.y = GROUND_Y - r * cos;
        d.angle = rod.angle;
        continue;
      }
    }
    d.vy += GRAVITY * dt;
    d.vx *= Math.exp(-1.6 * dt);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.angle += d.spin * dt;
    const half = (FLOOR_H / 2) * Math.abs(Math.cos(d.angle)) + (FLOOR_W / 2) * Math.abs(Math.sin(d.angle));
    if (d.y + half > GROUND_Y) {
      d.y = GROUND_Y - half;
      if (d.vy > 0) {
        if (d.vy > 140 && d.hits < 3) addDust(t, d.x, GROUND_Y, 4, d.vx >= 0 ? 1 : -1, d.index * 13 + d.hits, 1.4);
        d.hits += 1;
        d.vy = -d.vy * 0.25;
        d.vx *= 0.55;
        d.spin *= 0.4;
      }
      if (Math.abs(d.vy) < 35 && Math.abs(d.spin) < 0.8) {
        d.resting = true;
        d.vy = 0;
        d.spin = 0;
        // Rubble lies flat.
        const flat = Math.round(d.angle / Math.PI) * Math.PI;
        d.angle = flat;
        d.y = GROUND_Y - ((FLOOR_H / 2) * Math.abs(Math.cos(flat)) + (FLOOR_W / 2) * Math.abs(Math.sin(flat)));
      }
    }
  }
}

/** The highest point of the tower or its debris, for the camera. */
export function towerExtentY(t: TowerState): number {
  if (!t.collapsed) return towerTopY(t);
  let top = GROUND_Y;
  for (const d of t.debris) top = Math.min(top, d.y - FLOOR_W / 2);
  return top;
}

export function drawBlock(ctx: CanvasRenderingContext2D, tone: number, cracked = false): void {
  const c = TONES[tone % TONES.length]!;
  ctx.beginPath();
  ctx.roundRect(-FLOOR_W / 2, -FLOOR_H / 2, FLOOR_W, FLOOR_H, 4);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = c.edge;
  ctx.fillRect(-FLOOR_W / 2 + 2, -FLOOR_H / 2 + 2, FLOOR_W - 4, 4);
  ctx.fillStyle = c.glass;
  for (const x of [-40, -8, 24]) ctx.fillRect(x, -5, 16, 11);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const x of [-40, -8, 24]) ctx.fillRect(x + 2, -3, 5, 3);
  if (cracked) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-30, -15); ctx.lineTo(-22, -4); ctx.lineTo(-31, 4); ctx.lineTo(-24, 15);
    ctx.moveTo(38, -15); ctx.lineTo(44, -2); ctx.lineTo(36, 8);
    ctx.stroke();
  }
}

function drawFoundation(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.roundRect(TOWER_X - 92, GROUND_Y - 10, 184, 14, 3);
  ctx.fillStyle = '#a8aeb6';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#6f757d';
  for (const x of [-76, -40, 36, 72]) ctx.fillRect(TOWER_X + x - 3, GROUND_Y - 7, 6, 4);
}

export function drawTower(ctx: CanvasRenderingContext2D, t: TowerState): void {
  drawFoundation(ctx);
  if (t.collapsed) return;
  const n = t.floors.length;
  for (let i = 0; i < n; i += 1) {
    const f = t.floors[i]!;
    const below = i ? t.floors[i - 1]!.x : 0;
    const tilt = Math.atan2(f.x - below, FLOOR_H) * 0.4;
    ctx.save();
    ctx.translate(TOWER_X + f.x, GROUND_Y - (i + 0.5) * FLOOR_H + t.thud.x);
    ctx.rotate(tilt);
    ctx.scale(1, 1 - 0.12 * clamp(f.squash.x, -1, 1));
    drawBlock(ctx, f.tone);
    ctx.restore();
  }
  // The hoist rail follows the stack's bend.
  if (n) {
    ctx.strokeStyle = '#7d8590';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(TOWER_X + RAIL_DX, GROUND_Y);
    for (let i = 0; i < n; i += 1) ctx.lineTo(TOWER_X + RAIL_DX + t.floors[i]!.x, GROUND_Y - (i + 1) * FLOOR_H + t.thud.x);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < n; i += 1) {
      const y = GROUND_Y - (i + 0.5) * FLOOR_H + t.thud.x;
      const x = TOWER_X + RAIL_DX + offsetAtY(t, y);
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.stroke();
    }
  }
}

export function drawDebris(ctx: CanvasRenderingContext2D, t: TowerState): void {
  for (const d of t.debris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    drawBlock(ctx, d.tone, true);
    ctx.restore();
  }
}

export function drawDust(ctx: CanvasRenderingContext2D, t: TowerState): void {
  for (const d of t.dust) {
    ctx.globalAlpha = 0.55 * (1 - d.age / d.life);
    ctx.fillStyle = '#d9d4c7';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
