/**
 * The tower: a stack of prefab floors joined by small lateral springs (a
 * shear-building model). Each landing floor arrives with the crane hook's
 * swing and the storeys below flex under it. The wind leans the stack and a
 * steady sway drive rocks it from the top, both sized from the stack's own
 * compliance, so it sways about a planted base, visibly from the first floors
 * and wider with the tension, but never bends like a noodle. At the crash the joints release: the stack tips
 * about its base and breaks apart from the top down into a seeded debris
 * fall. Residents move into the windows a moment after each floor lands (more
 * of them the higher the stack), say so, wave harder the worse the sway gets,
 * and go down with the floors.
 */
import { type Spring, clamp, gust, mix, mulberry32, noise, settleSpring, spring, stepSpring } from './motion';
import { type Mood, drawWojak, drawWojakBust } from './people';

export const TOWER_X = 560;
/** World y of the ground surface (y grows downward). */
export const GROUND_Y = 460;
export const FLOOR_W = 120;
export const FLOOR_H = 30;
/** The hoist rail runs this far right of the tower axis. */
export const RAIL_DX = 72;
/**
 * Storey stiffness per unit floor mass: the frame stiffens by GROWTH a floor as the stack grows and each storey by
 * CARRY for every floor it carries, so the base stays planted, the top does the swaying, and a tall tower sways
 * slower and wider (about 1 s a sway on the first floor, 6 s fifty floors up). The tension softens it. Joint
 * damping is proportional to the stiffness, so landings ring for a few sways; a little air damps the rest.
 */
const STIFFNESS = 40;
const GROWTH = 0.25;
const CARRY = 0.08;
const DAMPING = 0.05;
const AIR = 0.3;
/** The sway drive runs at this fraction of the stack's first mode, so it rocks the stack without running away. */
const DRIVE = 0.7;
const GRAVITY = 900;
const INK = '#1c1f26';
const FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';

export const TONES = [
  { fill: '#f6d8a8', edge: '#c9a66f', glass: '#5a7aa0' },
  { fill: '#e8846b', edge: '#b85b45', glass: '#4c6b8f' },
  { fill: '#7fc8b5', edge: '#4f9a87', glass: '#3f5f83' },
  { fill: '#f2c14e', edge: '#c4932a', glass: '#4f6c93' },
] as const;

/** Someone who bought a unit: which window they lean out of, and their arrival (they move in after the floor lands). */
export interface Resident {
  window: number;
  tone: number;
  /** The wave's phase, integrated so the rate can follow the fear without jumping. */
  wave: number;
  delay: number;
  arrive: Spring;
}

/** A resident thrown clear of a breaking floor. */
export interface Faller {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  tone: number;
  resting: boolean;
  hits: number;
  /** Seconds lying still, which calms the flailing. */
  still: number;
}

export interface Floor {
  /** Lateral offset of the floor centre from the tower axis. */
  x: number;
  vx: number;
  tone: number;
  /** Landing compression: positive is squashed. */
  squash: Spring;
  residents: Resident[];
}

/** Window centres across a block, and the number of units sold on the nth floor: the higher, the more suckers. */
const WINDOWS = [-32, 0, 32];
const MAX_FALLERS = 26;
const residentCount = (n: number): number => (n < 3 ? 1 : n < 5 ? 2 : 3);
/** What the newest buyer says moving in, by the fear: GM on the first floors, NGMI and worse at the top. */
const PANIC_LINES = ['NGMI', 'SER PLS', 'IT IS SO OVER', 'WEN EXIT', 'FEW UNDERSTAND'];
const chatter = (n: number, fear: number): string => (fear < 0.25 ? 'GM' : fear < 0.45 ? 'WAGMI' : fear < 0.7 ? 'WEN EXIT' : PANIC_LINES[n % PANIC_LINES.length]!);
/** Half the height a block or a person stands at, for the angle it lies at: what keeps it on the ground. */
const support = (angle: number, half: number, thick: number): number => half * Math.abs(Math.cos(angle)) + thick * Math.abs(Math.sin(angle));

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
  /** Still holding on until the block is released. */
  residents: Resident[];
}

export interface Dust { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number }

export interface TowerState {
  floors: Floor[];
  /** The sway drive's phase, integrated at a rate that follows the stack's first mode. */
  sway: number;
  /** A resident's speech bubble on the floor they just moved into. */
  bubble: { floor: number; window: number; text: string; age: number } | null;
  /** The last round's rubble fading as a new site opens (1 to 0). */
  fade: number;
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
  fallers: Faller[];
  /** What happened this step: blocks hitting the ground hard, residents thrown clear. */
  events: { hits: number; ejected: number };
  rng: () => number;
}

export function createTower(): TowerState {
  return { floors: [], sway: 0, bubble: null, fade: 0, thud: spring(0), collapsed: false, fallAge: 0, fallHeight: 0, rod: { angle: 0, omega: 0, height: 0, dir: 1 }, debris: [], dust: [], fallers: [], events: { hits: 0, ejected: 0 }, rng: mulberry32(1) };
}

export function resetTower(t: TowerState): void {
  // The last round's rubble fades under a cloud of dust rather than vanishing as the new site opens.
  if (t.debris.length || t.fallers.length) {
    t.fade = 1;
    for (const d of t.debris) addDust(t, d.x, GROUND_Y, 3, d.index % 2 ? 1 : -1, d.index * 5.3, 0.8);
  }
  t.floors = [];
  t.bubble = null;
  settleSpring(t.thud, 0);
  t.collapsed = false;
  t.fallAge = 0;
  t.fallHeight = 0;
  t.events = { hits: 0, ejected: 0 };
}

/** The people on the nth floor: a window each, chosen by the floor so a replay seats them the same way. */
function residentsFor(n: number, quiet: boolean): Resident[] {
  const count = residentCount(n);
  const start = Math.floor(noise(n * 3.3) * 3);
  return Array.from({ length: count }, (_, k) => ({
    window: (start + k) % 3, tone: noise(n * 1.7 + k * 4.1), wave: noise(n * 2.9 + k) * Math.PI * 2,
    delay: quiet ? 0 : 0.8 + k * 0.35, arrive: spring(quiet ? 1 : 0),
  }));
}

/** Everyone in the windows, for the caption and the sound. */
export const residentTotal = (t: TowerState): number => t.floors.reduce((n, f) => n + f.residents.length, 0);

export const floorCount = (t: TowerState): number => t.floors.length;
export const towerHeight = (t: TowerState): number => t.floors.length * FLOOR_H;
/** World y of the top surface (the foundation when empty). */
export const towerTopY = (t: TowerState): number => GROUND_Y - t.floors.length * FLOOR_H + t.thud.x;
export const topOffset = (t: TowerState): number => (t.floors.length ? t.floors[t.floors.length - 1]!.x : 0);
export const topVelocity = (t: TowerState): number => (t.floors.length ? t.floors[t.floors.length - 1]!.vx : 0);

/** Keep the swaying stack and fixed crane together even after minutes of accumulated lateral travel. */
export function runningCameraFrame(t: TowerState, scale: number): { x: number; s: number } {
  let left = 150, right = 730;
  for (const floor of t.floors) {
    left = Math.min(left, TOWER_X + floor.x - FLOOR_W / 2 - 25);
    right = Math.max(right, TOWER_X + floor.x + RAIL_DX + 25);
  }
  return { x: (left + right) / 2, s: Math.min(scale, 760 / (right - left)) };
}


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
  const floor: Floor = { x: (top?.x ?? 0) + offset, vx: (top?.vx ?? 0) + lateralVelocity, tone: n % TONES.length, squash: spring(0), residents: residentsFor(n, quiet) };
  t.floors.push(floor);
  if (quiet) return;
  floor.squash.v += 5;
  t.thud.v += 90;
  const y = GROUND_Y - n * FLOOR_H;
  addDust(t, TOWER_X + floor.x - FLOOR_W / 2, y, 3, -1, n * 7);
  addDust(t, TOWER_X + floor.x + FLOOR_W / 2, y, 3, 1, n * 7 + 3);
}

/**
 * How far the top leans in a full gust and sways either side of that. Both grow by the storey, more per storey
 * with the tension, then more slowly past six floors, so a long round keeps swaying wider without the top ever
 * going much past 120 px. A lone block on the slab barely slides, but two already rock like a stack: about ±6 px
 * on the two floors of 1.7×, ±10 on three at 2.2× and ±20 on the four of 3×.
 */
export function swayFor(n: number, tension: number): { lean: number; sway: number } {
  const storeys = (n <= 6 ? n : 6 + 0.5 * (n - 6)) * (n === 1 ? 0.6 : n === 2 ? 1.5 : 1);
  return { lean: Math.min(35, (0.8 + 2 * tension) * storeys), sway: Math.min(70, 45 + 0.5 * n, (2.2 + 4.4 * tension) * storeys) };
}

/**
 * A storey's stiffness: stiffer for each floor it carries (up to forty), and the joint to the slab half as stiff
 * again. Its damping is capped so the substeps stay stable however tall the stack gets.
 */
const storeyK = (k: number, carried: number, base: boolean): number => k * (1 + CARRY * Math.min(40, carried)) * (base ? 1.5 : 1);
const storeyC = (k: number): number => DAMPING * Math.min(k, 1200);

/** Storey forces, reused between substeps. */
const storey: number[] = [];

/** One substep; `push` acts on the top floor. */
function substep(t: TowerState, push: number, k: number, h: number): void {
  const f = t.floors;
  const n = f.length;
  for (let i = 0; i < n; i += 1) {
    const ki = storeyK(k, n - i, i === 0);
    storey[i] = ki * (f[i]!.x - (i ? f[i - 1]!.x : 0)) + storeyC(ki) * (f[i]!.vx - (i ? f[i - 1]!.vx : 0));
  }
  for (let i = 0; i < n; i += 1) f[i]!.vx += ((i + 1 < n ? storey[i + 1]! : push) - storey[i]! - AIR * f[i]!.vx) * h;
  for (let i = 0; i < n; i += 1) f[i]!.x += f[i]!.vx * h;
}

/**
 * `wind` is the gust (-1..1) and `tension` (0..1) how bad it is; `fear` works the residents up. The push on the
 * top is sized from the stack's compliance, so the lean and sway come out as `swayFor` asks at any height, and
 * the sway drive's phase is integrated at a rate that follows the stack's first mode as it grows.
 */
export function stepTower(t: TowerState, wind: number, dt: number, tension = 0, fear = tension): void {
  t.events = { hits: 0, ejected: 0 };
  if (!t.collapsed) {
    const n = t.floors.length;
    if (n) {
      const k = (STIFFNESS * (1 + GROWTH * Math.min(60, n - 1))) / (1 + tension);
      // Top deflection per unit push on the top, and the first mode from the same shape (Rayleigh).
      let u = 0, su2 = 0;
      for (let j = n; j >= 1; j -= 1) {
        u += 1 / storeyK(k, j, j === n);
        su2 += u * u;
      }
      t.sway += DRIVE * Math.sqrt(u / su2) * dt;
      const { lean, sway } = swayFor(n, tension);
      const push = (clamp(wind, -1, 1) * lean + sway * (1 - DRIVE * DRIVE) * (0.8 + 0.25 * gust(t.sway * 0.3, 5)) * Math.sin(t.sway)) / u;
      let left = dt;
      while (left > 0) {
        const h = Math.min(1 / 240, left);
        left -= h;
        substep(t, push, k, h);
      }
    }
    for (const [i, f] of t.floors.entries()) {
      stepSpring(f.squash, 0, 30, 0.35, dt);
      for (const [j, r] of f.residents.entries()) {
        r.wave += (3 + 9 * fear) * dt;
        if (r.delay > 0) {
          r.delay -= dt;
          // The first buyer in says something about it.
          if (r.delay <= 0 && j === 0) t.bubble = { floor: i, window: r.window, text: chatter(i, fear), age: 0 };
        } else stepSpring(r.arrive, 1, 9, 0.45, dt);
      }
    }
    stepSpring(t.thud, 0, 22, 0.5, dt);
    if (t.bubble && (t.bubble.age += dt) > 1.8) t.bubble = null;
    if (t.fade > 0 && (t.fade -= dt / 0.45) <= 0) {
      t.debris = [];
      t.fallers = [];
    }
  } else {
    stepCollapse(t, dt);
  }
  for (const p of t.fallers) {
    p.still += dt;
    if (p.resting) continue;
    p.vy += GRAVITY * dt;
    p.vx *= Math.exp(-1.2 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
    // (x, y) is the middle of the body: it lies 4 px off the ground and stands 13 px up.
    const half = support(p.angle, 13, 4);
    if (p.y + half >= GROUND_Y - 1 && p.vy > -60) {
      if (p.vy > 60) {
        p.hits += 1;
        if (p.vy > 90 && p.hits <= 2) addDust(t, p.x, GROUND_Y, 2, p.vx >= 0 ? 1 : -1, p.x * 0.37 + p.hits, 0.6);
        p.y = GROUND_Y - half;
        p.vy = -p.vy * 0.3;
        p.vx *= 0.5;
        p.spin *= 0.4;
      } else {
        // Down on the ground they ride it as they topple onto their side the way they were going, then lie still.
        p.y = GROUND_Y - half;
        p.vy = 0;
        const off = p.angle - (Math.round(p.angle / Math.PI - 0.5) + 0.5) * Math.PI;
        p.spin = (p.spin - 30 * off * dt) * Math.exp(-7 * dt);
        p.vx *= Math.exp(-6 * dt);
        if (Math.abs(off) < 0.03 && Math.abs(p.spin) < 0.4) {
          p.resting = true;
          p.vx = p.spin = 0;
        }
      }
    } else p.still = 0;
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
  t.bubble = null;
  t.fade = 0;
  t.fallAge = quiet ? 10 : 0;
  t.fallHeight = n * FLOOR_H;
  t.rod = { angle: clamp(lean / height, -0.06, 0.06), omega: dir * 0.8 + (top?.vx ?? 0) / height, height, dir };
  t.debris = t.floors.map((f, i) => {
    const below = i ? t.floors[i - 1]!.x : 0;
    return {
      x: TOWER_X + f.x, y: GROUND_Y - (i + 0.5) * FLOOR_H, angle: Math.atan2(f.x - below, FLOOR_H) * 0.4,
      vx: f.vx, vy: 0, spin: 0, tone: f.tone, index: i,
      released: false, releaseAt: 0.12 + 0.55 * (1 - i / Math.max(1, n)) * (0.6 + 0.4 * rng()) + rng() * 0.1,
      resting: false, hits: 0, residents: f.residents.filter((r) => r.arrive.x > 0.5),
    };
  });
  t.floors = [];
  if (quiet) for (const d of t.debris) layRubble(t, d);
}

/** Lays a block flat in the line of rubble on the side the stack fell, where a finished collapse leaves it; its people beside it. */
function layRubble(t: TowerState, d: Debris): void {
  d.released = true;
  d.resting = true;
  d.x = TOWER_X + t.rod.dir * (30 + d.index * 26) + (t.rng() - 0.5) * 20;
  d.y = GROUND_Y - FLOOR_H / 2;
  d.angle = (t.rng() - 0.5) * 0.2;
  d.vx = d.vy = d.spin = 0;
  for (const r of d.residents) {
    if (t.fallers.length >= MAX_FALLERS) break;
    const side = t.rng() < 0.5 ? -1 : 1;
    t.fallers.push({ x: d.x + (t.rng() - 0.5) * 60, y: GROUND_Y - 4, vx: 0, vy: 0, angle: side * Math.PI / 2, spin: 0, tone: r.tone, resting: true, hits: 1, still: 1 });
  }
  d.residents = [];
}

/** A releasing block throws its people clear, spinning, over the side it flies to. */
function eject(t: TowerState, d: Debris): void {
  for (const r of d.residents) {
    if (t.fallers.length >= MAX_FALLERS) break;
    const wx = WINDOWS[r.window]!;
    const cos = Math.cos(d.angle);
    const sin = Math.sin(d.angle);
    // From the sill, the middle of the body 13 px above it.
    t.fallers.push({
      x: d.x + wx * cos - (-FLOOR_H / 2) * sin, y: d.y + wx * sin + (-FLOOR_H / 2) * cos - 13,
      vx: d.vx * 0.8 + (t.rng() - 0.5) * 200, vy: d.vy - 80 - t.rng() * 180,
      angle: 0, spin: (t.rng() - 0.5) * 16, tone: r.tone, resting: false, hits: 0, still: 0,
    });
    t.events.ejected += 1;
  }
  d.residents = [];
}

/** The block still on the crane's hook falls with the stack; `quiet` lays it straight in the rubble with the rest. */
export function dropLoad(t: TowerState, pose: { x: number; y: number; angle: number }, vx: number, tone: number, quiet: boolean): void {
  const d: Debris = { x: pose.x, y: pose.y, angle: pose.angle, vx, vy: 0, spin: (t.rng() - 0.5) * 4, tone, index: t.debris.length, released: true, releaseAt: 0, resting: false, hits: 0, residents: [] };
  if (quiet) layRubble(t, d);
  t.debris.push(d);
}

function stepCollapse(t: TowerState, dt: number): void {
  t.fallAge += dt;
  const rod = t.rod;
  rod.omega += ((1.5 * GRAVITY) / rod.height) * Math.sin(rod.angle) * dt;
  rod.angle += rod.omega * dt;
  const sin = Math.sin(rod.angle);
  const cos = Math.cos(rod.angle);
  for (const d of t.debris) {
    for (const r of d.residents) r.wave += 18 * dt;
    if (d.resting) continue;
    const r = (d.index + 0.5) * FLOOR_H;
    if (!d.released) {
      if (t.fallAge >= d.releaseAt || rod.angle * rod.dir > 1.2) {
        d.released = true;
        const outward = rod.dir * (20 + 0.18 * r) + (t.rng() - 0.5) * 220;
        d.vx = clamp(r * cos * rod.omega + outward, -520, 520);
        d.vy = r * sin * rod.omega - 40 - t.rng() * 60;
        d.spin = rod.omega * (0.6 + t.rng() * 0.8) * rod.dir + (t.rng() - 0.5) * 5;
        eject(t, d);
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
    const half = support(d.angle, FLOOR_H / 2, FLOOR_W / 2);
    if (d.y + half >= GROUND_Y - 1 && d.vy > -35) {
      d.y = GROUND_Y - half;
      if (d.vy > 35) {
        if (d.vy > 140 && d.hits < 3) {
          addDust(t, d.x, GROUND_Y, 4, d.vx >= 0 ? 1 : -1, d.index * 13 + d.hits, 1.4);
          t.events.hits += 1;
        }
        d.hits += 1;
        d.vy = -d.vy * 0.25;
        d.vx *= 0.55;
        d.spin *= 0.4;
      } else {
        // Down on the ground a block rides it as it topples onto its broad face (gravity about the corner it rests
        // on) and scrapes to a stop, rather than snapping flat: it is at rest only once it lies flat.
        d.vy = 0;
        const off = d.angle - Math.round(d.angle / Math.PI) * Math.PI;
        d.spin = (d.spin - 16 * off * dt) * Math.exp(-4 * dt);
        d.vx *= Math.exp(-4 * dt);
        if (Math.abs(off) < 0.03 && Math.abs(d.spin) < 0.4 && Math.abs(d.vx) < 25) {
          d.resting = true;
          d.vx = d.spin = 0;
        }
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

/** The cracks a block shows: two jagged lines that grow in with `crack` (0 none, 1 the whole way), as a broken block or a straining base. */
const CRACKS: [number, number][][] = [[[-30, -15], [-22, -4], [-31, 4], [-24, 15]], [[38, -15], [44, -2], [36, 8], [40, 15]]];

export function drawBlock(ctx: CanvasRenderingContext2D, tone: number, crack = 0): void {
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
  if (crack > 0.02) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const line of CRACKS) {
      const reach = clamp(crack, 0, 1) * (line.length - 1);
      const full = Math.floor(reach);
      ctx.moveTo(line[0]![0], line[0]![1]);
      for (let i = 1; i <= full; i += 1) ctx.lineTo(line[i]![0], line[i]![1]);
      if (full < line.length - 1) {
        const a = line[full]!;
        const b = line[full + 1]!;
        const u = reach - full;
        ctx.lineTo(mix(a[0], b[0], u), mix(a[1], b[1], u));
      }
    }
    ctx.stroke();
  }
}

/**
 * The people in a block's windows, in the block's frame: leaning out over the sill, waving, and the worse the
 * sway the more frantic the wave, until they are screaming with both hands up. `hold` (the collapse) keeps
 * both hands up on whatever they are riding.
 */
function drawResidents(ctx: CanvasRenderingContext2D, residents: Resident[], fear: number, hold: boolean): void {
  for (const r of residents) {
    const k = clamp(r.arrive.x, 0, 1.25);
    if (k < 0.03) continue;
    const mood: Mood = hold || fear > 0.72 ? 'panic' : fear > 0.4 ? 'meh' : 'hype';
    const wave = hold ? Math.sin(r.wave) * 0.25 : Math.sin(r.wave) * (0.45 + 0.5 * fear) - 0.2;
    ctx.save();
    ctx.translate(WINDOWS[r.window]!, 6);
    ctx.scale(k, k);
    drawWojakBust(ctx, mood, wave, r.tone, hold || fear > 0.72 ? 1 : 0);
    ctx.restore();
  }
}

/** The slab; split down the middle once the tower is down (rugged at the foundation). */
function drawFoundation(ctx: CanvasRenderingContext2D, split: boolean): void {
  ctx.beginPath();
  ctx.roundRect(TOWER_X - 92, GROUND_Y - 10, 184, 14, 3);
  ctx.fillStyle = '#a8aeb6';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#6f757d';
  for (const x of [-76, -40, 36, 72]) ctx.fillRect(TOWER_X + x - 3, GROUND_Y - 7, 6, 4);
  if (!split) return;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(TOWER_X - 6, GROUND_Y - 10); ctx.lineTo(TOWER_X + 3, GROUND_Y - 5); ctx.lineTo(TOWER_X - 4, GROUND_Y - 1); ctx.lineTo(TOWER_X + 5, GROUND_Y + 4);
  ctx.moveTo(TOWER_X + 3, GROUND_Y - 5); ctx.lineTo(TOWER_X + 16, GROUND_Y - 7);
  ctx.stroke();
}

/**
 * A speech bubble with its tail at (x, y), opening to `side` (-1 left, 1 right). `k` pops it in and fades it,
 * `ui` scales it up when the camera pulls back so it stays legible.
 */
export function drawBubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, side: number, k: number, ui = 1): void {
  if (k < 0.02) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= clamp(k * 1.5, 0, 1);
  ctx.scale(ui * Math.min(1, k * 1.2), ui * Math.min(1, k * 1.2));
  ctx.font = `900 12px ${FONT}`;
  const w = ctx.measureText(text).width + 12;
  const bx = side > 0 ? 2 : -2 - w;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(bx, -27, w, 19, 7);
  ctx.moveTo(side * 6, -9); ctx.lineTo(0, 0); ctx.lineTo(side * 14, -9);
  ctx.fill(); ctx.stroke();
  // Paint out the box's edge across the tail's mouth.
  ctx.beginPath(); ctx.moveTo(side * 7, -10); ctx.lineTo(side * 1.5, -2); ctx.lineTo(side * 13, -10); ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, -17);
  ctx.restore();
}

/** A fake-out: the stack lurches one way and the slab coughs dust. Keyed to the multiplier, never the outcome. */
export function lurch(t: TowerState, dir: number, strength: number): void {
  const n = t.floors.length;
  for (const [i, f] of t.floors.entries()) f.vx += dir * strength * ((i + 1) / n);
  t.thud.v += 70;
  if (n) {
    addDust(t, TOWER_X - FLOOR_W / 2 + 4, GROUND_Y - 4, 4, -1, n * 3.1, 0.9);
    addDust(t, TOWER_X + FLOOR_W / 2 - 4, GROUND_Y - 4, 4, 1, n * 3.1 + 2, 0.9);
  }
}

/** The tilt a block draws at: the stack's slope across it, flat where it sits on the slab, softened. */
export function slopeAt(t: TowerState, i: number): number {
  const f = t.floors;
  const drift = (j: number): number => (j > 0 && j < f.length ? f[j]!.x - f[j - 1]!.x : 0);
  return Math.atan2((drift(i) + (i + 1 < f.length ? drift(i + 1) : drift(i))) / 2, FLOOR_H) * 0.6;
}

/**
 * The stack and its people; `fear` (0..1) works the residents up and `crack` (0..1) splits the two base floors.
 * `ui` scales the speech bubbles for a pulled-back camera.
 */
export function drawTower(ctx: CanvasRenderingContext2D, t: TowerState, fear = 0, crack = 0, ui = 1): void {
  drawFoundation(ctx, t.collapsed);
  if (t.collapsed) return;
  const n = t.floors.length;
  for (let i = 0; i < n; i += 1) {
    const f = t.floors[i]!;
    const tilt = slopeAt(t, i);
    ctx.save();
    ctx.translate(TOWER_X + f.x, GROUND_Y - (i + 0.5) * FLOOR_H + t.thud.x);
    ctx.rotate(tilt);
    ctx.scale(1, 1 - 0.12 * clamp(f.squash.x, -1, 1));
    drawBlock(ctx, f.tone, i === 0 ? crack : i === 1 ? crack * 0.6 : 0);
    drawResidents(ctx, f.residents, fear, false);
    ctx.restore();
  }
  const b = t.bubble;
  if (b && b.floor < n) {
    const f = t.floors[b.floor]!;
    const side = b.window === 2 || (b.window === 1 && b.floor % 2 === 1) ? 1 : -1;
    drawBubble(ctx, b.text, TOWER_X + f.x + WINDOWS[b.window]! + side * 4, GROUND_Y - (b.floor + 0.5) * FLOOR_H - 8 + t.thud.x, side, Math.min(b.age / 0.15, (1.8 - b.age) / 0.3), ui);
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
  ctx.save();
  if (t.fade > 0) ctx.globalAlpha = t.fade;
  for (const d of t.debris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    drawBlock(ctx, d.tone, 1);
    if (d.residents.length) drawResidents(ctx, d.residents, 1, true);
    ctx.restore();
  }
  ctx.restore();
}

/** Residents in the air and in the dust: flailing while they spin, calming as they topple, face down once they lie still. */
export function drawFallers(ctx: CanvasRenderingContext2D, t: TowerState, time = 0): void {
  ctx.save();
  if (t.fade > 0) ctx.globalAlpha = t.fade;
  for (const p of t.fallers) {
    const calm = clamp(p.still / 0.5, 0, 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.translate(0, 13);
    drawWojak(ctx, p.resting ? 'out' : 'panic', 1 - 0.4 * calm, Math.sin(time * 30) * 0.8 * (1 - calm), p.tone);
    ctx.restore();
  }
  ctx.restore();
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

export function collapseCamera(t: TowerState): { x: number; y: number; s: number } {
  const pad = FLOOR_W;
  const left = Math.min(TOWER_X - pad, ...t.debris.map(d => d.x - pad));
  const right = Math.max(TOWER_X + pad, ...t.debris.map(d => d.x + pad));
  const top = Math.min(GROUND_Y - 150, ...t.debris.map(d => d.y - pad));
  const bottom = GROUND_Y + 45;
  const s = Math.min(0.85, 800 / (right - left), 370 / (bottom - top));
  return { x: (left + right) / 2, y: (top + bottom) / 2 - 35 / s, s };
}
