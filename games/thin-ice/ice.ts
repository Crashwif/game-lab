/**
 * The frozen lake: a scrolling ice plane seen from the near bank, with the
 * bagholders frozen in it, a crack network that spreads around the skater as
 * the tension rises, skate trails, and the shatter: at the crash the ice
 * around her breaks along seeded rays and rings into floes that tilt, bob and
 * drift apart on open water. The bagholders thaw as she passes and reach up
 * through the ice for her ankles with the tension; at the shatter a few of
 * them surface on the floes, still holding their signs. Between rounds the
 * lake refreezes: the break, the cracks and the trails fade back into the ice.
 */
import { type Spring, clamp, mix, mulberry32, noise, smoothstep, spring, stepSpring } from './motion';

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
  /** Growth per second (1.6 when unset); a racer eases out as it arrives, its tip glinting on the way. */
  rate?: number;
  racer?: boolean;
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
  /** How far it drifts out from the break (px) and how fast (s); the inner wedges also tip their points under. */
  spread: number;
  settle: number;
  tipped: Point[];
  tip: number;
}

export interface Ripple { age: number; life: number; r: number }

/** A bagholder who came up with the break, on a floe, sign first. */
export interface Surfacer { floe: number; sign: [string, string]; up: Spring; delay: number; tone: number; flip: boolean }

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
  /** How far each frozen bagholder (by index) has woken: 0 frozen solid, 1 hand out of the ice. Only ever rises. */
  thaw: Map<number, number>;
  surfacers: Surfacer[];
  events: { surfaced: number };
  /** Between rounds the lake refreezes: everything drawn on it fades out from 1, then it is reset. */
  fade: number;
  refreezing: boolean;
}

export function createIce(): IceState {
  return { cracks: [], trails: [[], []], floes: [], ripples: [], shattered: false, shatterAt: { x: 0, y: 0 }, shatterAge: 0, sheen: 0, crackClock: 0, rippleClock: 0, thaw: new Map(), surfacers: [], events: { surfaced: 0 }, fade: 1, refreezing: false };
}

export function resetIce(ice: IceState): void {
  ice.cracks = [];
  ice.trails = [[], []];
  ice.floes = [];
  ice.ripples = [];
  ice.shattered = false;
  ice.shatterAge = 0;
  ice.thaw = new Map();
  ice.surfacers = [];
  ice.crackClock = 0;
  ice.fade = 1;
  ice.refreezing = false;
}

/** The next round is coming: the break, the cracks and the trails fade back into the ice before it is reset. */
export function refreezeIce(ice: IceState): void {
  ice.refreezing = true;
  ice.surfacers = ice.surfacers.filter((s) => s.delay <= 0);
}

const SIGNS: [string, string][] = [['BUY', 'THE DIP'], ['STILL', 'EARLY'], ['DCA', 'BABY'], ["IT'S A", 'FEATURE'], ['WAGMI', '(2021)'], ['NOT', 'SELLING']];

/** Distance travelled when joining late, integrating the current growth over the elapsed presentation. */
export function journeyDistance(seconds: number, growth: number): number {
  const g = Math.max(0, growth) / 2;
  return Math.max(0, seconds) * (120 + 220 * (g < 1e-5 ? g / 2 : 1 - (1 - Math.exp(-g)) / g));
}

/** Reconstruct only the visible wake: deterministic, bounded and independent of outcome selection. */
export function settleJourney(ice: IceState, x: number, y: number, tension: number, seconds: number): void {
  const count = Math.min(12, Math.floor(seconds / 2));
  for (let i = 0; i < count; i += 1) spawnCrack(ice, x - 540 + i * 57, y + Math.sin(i * 2.3) * 24, tension, Math.floor(seconds / 12) * 100 + i);
  for (const crack of ice.cracks) crack.growth = 1;
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

/**
 * The near miss: a crack that races across the ice from `from` and runs out of steam at `to`, `seconds` later,
 * splitting off a couple of short branches as its tip passes.
 */
export function spawnRacer(ice: IceState, from: Point, to: Point, seconds: number, width: number, seed: number): void {
  const rng = mulberry32(Math.floor(seed * 1000));
  const dx = to.x - from.x;
  const dy = (to.y - from.y) / FORESHORTEN;
  const len = Math.max(1, Math.hypot(dx, dy));
  const points: Point[] = [];
  for (let i = 0; i <= 9; i += 1) {
    const k = i / 9;
    const jag = i === 0 || i === 9 ? 0 : (rng() - 0.5) * 22 * (1 - 0.7 * k);
    points.push({ x: mix(from.x, to.x, k) - (dy / len) * jag, y: mix(from.y, to.y, k) + (dx / len) * jag * FORESHORTEN });
  }
  ice.cracks.push({ points, growth: 0, width, rate: 1 / seconds, racer: true });
  for (const at of [3, 6]) {
    const p = points[at]!;
    const h = Math.atan2(dy, dx) + (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.6);
    const l = 14 + rng() * 16;
    ice.cracks.push({ points: [p, { x: p.x + Math.cos(h) * l, y: p.y + Math.sin(h) * l * FORESHORTEN }], growth: -at / 9 - 0.1, width: width * 0.6, rate: 1.4 / seconds });
  }
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
  ice.events = { surfaced: 0 };
  if (ice.refreezing) {
    ice.fade -= dt / 0.8;
    if (ice.fade <= 0) resetIce(ice);
  }
  for (const c of ice.cracks) c.growth = Math.min(1, c.growth + dt * (c.rate ?? 1.6));
  ice.cracks = ice.cracks.filter((c) => c.points[0]!.x > cameraX - 300);
  for (const t of ice.trails) while (t.length && t[0]!.x < cameraX - 200) t.shift();
  if (!ice.shattered) return;
  ice.shatterAge += dt;
  for (const s of ice.surfacers) {
    if (s.delay > 0) {
      s.delay -= dt;
      if (s.delay <= 0) ice.events.surfaced += 1;
      continue;
    }
    // They come up on an overshooting spring, and slip back under as the lake refreezes.
    if (ice.refreezing) stepSpring(s.up, 0, 7, 1, dt);
    else stepSpring(s.up, 1, 9, 0.4, dt);
  }
  // The inner wedges give way at once, tipping their points under; the outer rings drift off more slowly.
  for (const f of ice.floes) {
    const out = f.spread * (1 - Math.exp(-ice.shatterAge / f.settle));
    f.offset = { x: f.drift.x * out, y: f.drift.y * out * FORESHORTEN };
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
      const local = verts.map((v) => ({ x: v.x - cx, y: v.y - cy }));
      // Tipping hinges on the outer edge: on the lake plane each point swings toward it and drops below it.
      const tip = ring === 1 ? 0.32 + rng() * 0.16 : ring === 2 ? 0.05 + rng() * 0.05 : 0;
      const along = local.map((v) => v.x * Math.cos(am) + (v.y / FORESHORTEN) * Math.sin(am));
      const hinge = Math.max(...along);
      const tipped = local.map((v, k) => {
        const d = hinge - along[k]!;
        const pull = d * (1 - Math.cos(tip));
        return { x: v.x - Math.cos(am) * pull, y: v.y - Math.sin(am) * pull * FORESHORTEN + d * Math.sin(tip) * 0.9 };
      });
      ice.floes.push({
        cx: x + cx, cy: y + cy, verts: local, tipped, tip: tip / 0.5,
        drift: { x: Math.cos(am), y: Math.sin(am) }, tilt: (rng() - 0.5) * 0.5, phase: rng() * Math.PI * 2,
        sink: ring === 1 ? 1 : ring === 2 ? 0.55 : 0.25, offset: { x: 0, y: 0 },
        spread: ring === 1 ? 55 : ring === 2 ? 25 : 8, settle: ring === 1 ? 0.28 : ring === 2 ? 0.6 : 1,
      });
    }
  }
  // Nearby cracks are now part of the break.
  ice.cracks = ice.cracks.filter((c) => Math.hypot(c.points[0]!.x - x, (c.points[0]!.y - y) / FORESHORTEN) > 240);
  // Three of the bagholders come up with it, on middle-ring floes to the sides of the hole (the REKT lands
  // above or below it), each with a sign and the same advice they went down with.
  ice.surfacers = [];
  const indexed = ice.floes.map((f, i) => ({ f, i }));
  const side = (ring: [number, number], dir: number, flat: number) => indexed.filter(({ f }) => f.sink > ring[0] && f.sink < ring[1] && f.drift.x * dir > flat);
  // One each side on the middle ring, and a third further out on a near-horizontal floe, so their signs never sit
  // over each other.
  const seats = [side([0.5, 0.6], -1, 0.55), side([0.5, 0.6], 1, 0.55), side([0.2, 0.3], rng() < 0.5 ? -1 : 1, 0.85)];
  const first = Math.floor(rng() * SIGNS.length);
  for (const [k, seat] of seats.entries()) {
    if (!seat.length) continue;
    const pick = seat[Math.floor(rng() * seat.length)]!;
    const up = spring(quiet ? 1 : 0);
    ice.surfacers.push({ floe: pick.i, sign: SIGNS[(first + k * 2) % SIGNS.length]!, up, delay: quiet ? 0 : 0.55 + k * 0.25, tone: rng(), flip: pick.f.drift.x < 0 });
  }
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
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * ice.fade})`;
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

/** Frozen bagholders: the first one's world x, and the average gap to the next (each one is 600–900 px on). */
const BAG_FIRST = 420;
const BAG_EVERY = 750;
const BAG_BODY = 'rgba(78, 122, 170, 0.3)';
const BAG_RIM = 'rgba(245, 251, 255, 0.55)';
const BAG_FACE = 'rgba(34, 64, 104, 0.55)';

/** Adds a capsule round a to b as one clockwise subpath, so a single fill unions it with the rest of the figure. */
function capsule(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, r: number): void {
  const a = Math.atan2(by - ay, bx - ax);
  ctx.moveTo(bx + Math.cos(a - Math.PI / 2) * r, by + Math.sin(a - Math.PI / 2) * r);
  ctx.arc(bx, by, r, a - Math.PI / 2, a + Math.PI / 2);
  ctx.arc(ax, ay, r, a + Math.PI / 2, a + Math.PI * 1.5);
  ctx.closePath();
}

/** A bagholder's silhouette in its own frame, feet down: arms up to the surface (0), hugging the bag (1) or spread (2). */
function bagholderPath(ctx: CanvasRenderingContext2D, pose: number): void {
  ctx.beginPath();
  ctx.moveTo(16, -30);
  ctx.ellipse(0, -30, 16, 18, 0, 0, Math.PI * 2);
  ctx.moveTo(11, 4);
  ctx.ellipse(0, 4, 11, 15, 0, 0, Math.PI * 2);
  const spread = pose === 2 ? 5 : 0;
  capsule(ctx, -5, 14, -8 - spread, 36, 4.5);
  capsule(ctx, 5, 14, 8 + spread, 36, 4.5);
  const hands = pose === 0 ? [[-19, -50], [18, -54]] : pose === 1 ? [[-8, 8], [8, 8]] : [[-31, -14], [30, -8]];
  for (const [side, [hx, hy]] of [[-1, hands[0]!], [1, hands[1]!]] as const) capsule(ctx, side * 8, -8, hx, hy, 4);
  if (pose === 1) {
    ctx.moveTo(15, 10);
    ctx.arc(0, 10, 15, 0, Math.PI * 2);
    capsule(ctx, -4, -6, 4, -6, 3.5);
  }
}

/** The nth bagholder's world x, screen y and size. */
function bagholder(i: number): { wx: number; y: number; scale: number } {
  const wx = BAG_FIRST + i * BAG_EVERY + (noise(i * 3.7) - 0.5) * 150;
  const y = ICE_FAR_Y + 40 + noise(i * 5.3 + 1) * (ICE_NEAR_Y - ICE_FAR_Y - 64);
  return { wx, y, scale: 1.2 * (0.58 + 0.42 * (y - ICE_FAR_Y) / (ICE_NEAR_Y - ICE_FAR_Y)) };
}

/**
 * The bagholders wake as she passes: the closer she skates and the higher the leverage, the faster one thaws,
 * and a thawed one never freezes back. Old ones far behind the camera are forgotten.
 */
export function stepBagholders(ice: IceState, cameraX: number, skaterX: number, tension: number, dt: number): void {
  if (ice.shattered || tension <= 0.02) return;
  const first = Math.floor((cameraX - 300 - BAG_FIRST) / BAG_EVERY);
  for (let i = first; i <= first + 3; i += 1) {
    const near = clamp(1 - Math.abs(bagholder(i).wx - skaterX) / 300, 0, 1);
    if (near <= 0) continue;
    const level = ice.thaw.get(i) ?? 0;
    ice.thaw.set(i, Math.min(1, level + dt * near * (0.25 + 1.4 * tension)));
  }
  for (const i of ice.thaw.keys()) if (i < first - 1) ice.thaw.delete(i);
}

/**
 * A hand up through the ice, from the surface at the origin, `reach` px high, with a jagged hole round the wrist
 * that melts open (`open` 0 to 1) before the fingers break through.
 */
function drawHand(ctx: CanvasRenderingContext2D, reach: number, wobble: number, scale: number, open: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.min(1, open * 1.6);
  ctx.fillStyle = 'rgba(30, 60, 110, 0.55)';
  ctx.beginPath();
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    const r = (9 + (k % 2) * 4) * (0.35 + 0.65 * open);
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * FORESHORTEN;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 60, 90, 0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (reach < 1) { ctx.restore(); return; }
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7.5;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(wobble * 0.5, -reach * 0.5, wobble, -reach); ctx.stroke();
  ctx.strokeStyle = '#9fc2e6';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.save();
  ctx.translate(wobble, -reach);
  ctx.rotate(wobble * 0.04);
  ctx.fillStyle = '#9fc2e6';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(0, -2, 5, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2.4;
  for (const [fx, fy] of [[-5, -9], [-1.5, -11.5], [2.5, -11], [5.5, -7]] as const) { ctx.beginPath(); ctx.moveTo(fx * 0.5, -5); ctx.lineTo(fx, fy); ctx.stroke(); }
  ctx.strokeStyle = '#9fc2e6';
  ctx.lineWidth = 1.2;
  for (const [fx, fy] of [[-5, -9], [-1.5, -11.5], [2.5, -11], [5.5, -7]] as const) { ctx.beginPath(); ctx.moveTo(fx * 0.5, -5); ctx.lineTo(fx, fy); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

/**
 * The lake is full of bagholders, frozen where they went through: pale ghosts under the surface, seeded by index at
 * fixed world positions so the ice carries them past. Sad or X-eyed, each in its own pose and tilt. A thawing one
 * darkens, opens its eyes and gets a hand up through the ice, higher the more leverage she is on.
 */
export function drawBagholders(ctx: CanvasRenderingContext2D, ice: IceState, cameraX: number, time: number, tension: number): void {
  const first = Math.floor((cameraX - 300 - BAG_FIRST) / BAG_EVERY);
  for (let i = first; i <= first + 3; i += 1) {
    const { wx, y, scale } = bagholder(i);
    const x = wx - cameraX;
    if (x < -90 || x > 1050) continue;
    const pose = ((i % 3) + 3) % 3;
    // When the ice goes they let go and freeze back over; three of them come up on the floes instead.
    const thaw = (ice.thaw.get(i) ?? 0) * (ice.shattered ? 1 - smoothstep(0, 0.5, ice.shatterAge) : 1);
    const dazed = noise(i * 6.1 + 2) > 0.55 && thaw < 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((noise(i * 4.3 + 3) - 0.5) * 1.1 * (1 - 0.6 * thaw));
    ctx.scale(scale * (noise(i * 8.1) > 0.5 ? -1 : 1), scale * 0.8);
    // Lit from above through the ice: a pale copy up and to the left shows as a rim round the body.
    ctx.translate(-1.5, -1.5);
    bagholderPath(ctx, pose);
    ctx.fillStyle = BAG_RIM;
    ctx.fill();
    ctx.translate(1.5, 1.5);
    bagholderPath(ctx, pose);
    ctx.fillStyle = thaw > 0 ? `rgba(78, 122, 170, ${0.3 + 0.35 * thaw})` : BAG_BODY;
    ctx.fill();
    ctx.strokeStyle = BAG_FACE;
    ctx.fillStyle = BAG_FACE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (dazed) {
      for (const ex of [-6, 6]) { ctx.moveTo(ex - 3, -36); ctx.lineTo(ex + 3, -30); ctx.moveTo(ex + 3, -36); ctx.lineTo(ex - 3, -30); }
      ctx.moveTo(3, -20); ctx.arc(0, -20, 3, 0, Math.PI * 2);
    } else {
      // Wojak: brows up in the middle, small sad eyes with bags under them, a nose, the frown.
      ctx.moveTo(-11, -38); ctx.lineTo(-3, -41); ctx.moveTo(11, -38); ctx.lineTo(3, -41);
      ctx.moveTo(-9, -29.5); ctx.quadraticCurveTo(-6.5, -27.5, -4, -29.5); ctx.moveTo(4, -29.5); ctx.quadraticCurveTo(6.5, -27.5, 9, -29.5);
      ctx.moveTo(0, -30); ctx.quadraticCurveTo(-3, -25, 0, -24.5);
      ctx.moveTo(-6, -16); ctx.quadraticCurveTo(0, -21, 6, -16);
    }
    ctx.stroke();
    if (!dazed) {
      for (const ex of [-6.5, 6.5]) { ctx.beginPath(); ctx.arc(ex, -33, 1.8 + 1.4 * thaw, 0, Math.PI * 2); ctx.fill(); }
    }
    if (pose === 1) {
      ctx.font = '900 17px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 12);
    }
    // Air frozen on its way up.
    ctx.strokeStyle = BAG_RIM;
    ctx.lineWidth = 1.2;
    for (let b = 0; b < 3; b += 1) {
      ctx.beginPath(); ctx.arc(10 + b * 6 - noise(i + b) * 8, -56 - b * 11, 2 + b * 0.8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    if (thaw > 0.01) {
      // The ice melts open over it first, then the hand comes up beside the body, feeling about for an ankle,
      // higher with the leverage.
      const open = smoothstep(0.01, 0.12, thaw);
      const up = smoothstep(0.06, 0.3, thaw);
      const reach = up * (thaw * (16 + 42 * tension) + (2 + 2 * thaw) * (1 + Math.sin(time * 2.2 + i)));
      const wobble = Math.sin(time * 3.1 + i * 1.7) * (3 + 7 * tension) * thaw;
      ctx.save();
      ctx.translate(x + 18 * scale, y + 6 * scale);
      drawHand(ctx, reach, wobble, scale * 1.15, open);
      ctx.restore();
    }
  }
}

/** A surfaced bagholder on a floe, in the floe's frame: soaked, shivering, and still holding the sign. */
function drawSurfacer(ctx: CanvasRenderingContext2D, s: Surfacer, time: number): void {
  const up = clamp(s.up.x, 0, 1.25);
  if (up < 0.03) return;
  const shiver = Math.sin(time * 26 + s.tone * 9) * 1.2;
  ctx.save();
  ctx.scale(s.flip ? -1 : 1, up);
  ctx.translate(shiver, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Sign on a stick in the far hand.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, -18); ctx.lineTo(20, -62); ctx.stroke();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#f4e7c3';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-4, -84, 50, 28, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 11px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  if (s.flip) { ctx.translate(21, -70); ctx.scale(-1, 1); ctx.translate(-21, 70); }
  ctx.fillText(s.sign[0], 21, -76, 44);
  ctx.fillText(s.sign[1], 21, -64, 44);
  ctx.restore();
  // Shoulders in a soaked jacket, the head with wet hair and blue lips.
  ctx.fillStyle = s.tone > 0.5 ? '#2b3a55' : '#4a2f6b';
  ctx.beginPath(); ctx.roundRect(-13, -22, 26, 22, 5); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(15, -26); ctx.stroke();
  ctx.strokeStyle = '#9fc2e6'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.fillStyle = '#c9dcf0';
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -32, 10.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#26364a';
  ctx.beginPath(); ctx.ellipse(-1, -40, 10, 5, -0.1, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc(ex, -33, 1.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-7, -38); ctx.lineTo(-2, -39.5); ctx.moveTo(7, -38); ctx.lineTo(2, -39.5); ctx.stroke();
  ctx.strokeStyle = '#3b5bdb'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-3.5, -26); ctx.quadraticCurveTo(0, -28.5, 3.5, -26); ctx.stroke();
  // Drips.
  ctx.fillStyle = '#bfe0ff';
  const alpha = ctx.globalAlpha;
  for (const [dx, k] of [[-9, 0.3], [8, 0.7]] as const) {
    const p = (time * 0.9 + k) % 1;
    ctx.globalAlpha = alpha * (1 - p);
    ctx.beginPath(); ctx.arc(dx, -20 + p * 22, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.restore();
}

export function drawCracks(ctx: CanvasRenderingContext2D, ice: IceState, cameraX: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = ice.fade;
  for (const c of ice.cracks) {
    if (c.growth <= 0) continue;
    const n = c.points.length - 1;
    const reach = (c.racer ? 1 - (1 - c.growth) ** 2 : c.growth) * n;
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
    if (c.racer && c.growth < 1) {
      // The tip glints as it runs.
      const a = c.points[Math.min(n, full)]!;
      const b = c.points[Math.min(n, full + 1)]!;
      const t = reach - full;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath(); ctx.arc(mix(a.x, b.x, t) - cameraX, mix(a.y, b.y, t), 2 + c.width * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Water showing through thinning ice under a point, growing with the tension; `alpha` fades it in or out. */
export function drawThinning(ctx: CanvasRenderingContext2D, x: number, y: number, tension: number, time: number, alpha = 1): void {
  if (tension <= 0.02 || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const r = 40 + 120 * tension;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  // Clear already in the first seconds, and fading in from the start rather than appearing.
  g.addColorStop(0, `rgba(30, 60, 110, ${(0.2 + 0.5 * tension) * smoothstep(0.02, 0.15, tension)})`);
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
    ctx.globalAlpha = (1 - p) * tension * alpha;
    ctx.beginPath(); ctx.arc(bx, by, 1.5 + i * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawShatter(ctx: CanvasRenderingContext2D, ice: IceState, cameraX: number, time: number): void {
  if (!ice.shattered) return;
  const ox = ice.shatterAt.x - cameraX;
  const oy = ice.shatterAt.y;
  const open = clamp(ice.shatterAge / 0.4, 0, 1);
  const tipping = 1 - Math.exp(-ice.shatterAge / 0.3);
  ctx.save();
  ctx.globalAlpha = ice.fade;
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
    ctx.globalAlpha = (1 - r.age / r.life) * 0.7 * ice.fade;
    ctx.beginPath(); ctx.arc(0, 0, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = ice.fade;
  ctx.restore();
  // Floes: the inner wedges tip their points under and slide beneath the middle ring; the outer rings barely move.
  for (const f of ice.floes) {
    const bob = Math.sin(time * 2 + f.phase) * 0.06 * f.sink;
    const tip = f.tip * tipping;
    ctx.save();
    ctx.translate(f.cx - cameraX + f.offset.x, f.cy + f.offset.y + f.sink * (3 + 7 * tip) * open);
    ctx.rotate((f.tilt * 0.35 + bob) * open);
    ctx.scale(1, 1 - 0.08 * f.sink * open);
    ctx.beginPath();
    for (const [k, v] of f.verts.entries()) {
      const t = f.tipped[k]!;
      ctx.lineTo(mix(v.x, t.x, tipping), mix(v.y, t.y, tipping));
    }
    ctx.closePath();
    // Wet and darker the further it has tipped into the water.
    const [r, g, b] = f.sink > 0.9 ? [184, 208, 228] : [207, 225, 239];
    ctx.fillStyle = `rgb(${Math.round(mix(r, 128, tip))}, ${Math.round(mix(g, 166, tip))}, ${Math.round(mix(b, 204, tip))})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 50, 80, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  for (const s of ice.surfacers) {
    const f = ice.floes[s.floe];
    if (!f) continue;
    const bob = Math.sin(time * 2 + f.phase) * 0.06 * f.sink;
    ctx.save();
    ctx.translate(f.cx - cameraX + f.offset.x, f.cy + f.offset.y + f.sink * 3 * open);
    ctx.rotate((f.tilt * 0.35 + bob) * open);
    drawSurfacer(ctx, s, time);
    ctx.restore();
  }
  ctx.restore();
}
