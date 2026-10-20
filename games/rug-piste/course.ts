/** A bounded, deterministic arcade slope. No round outcomes, stakes or payouts enter this controller. */
import type { Commands } from './input';
export type Kind = 'tree' | 'rock' | 'rug' | 'ramp' | 'coin' | 'sign';
export interface Obstacle { id: number; kind: Kind; x: number; z: number; used: boolean; label?: readonly string[]; warn?: boolean }
export interface Trail { x: number; z: number; lean: number }
/** A yeti footprint; `dir` is the walking direction across the slope. */
export interface Print { x: number; z: number; dir: number }
/** A coin knocked out of the bag by a bonk. */
export interface Spill { x: number; z: number; vx: number; age: number }
export interface World {
  x: number; lean: number; distance: number; speed: number; row: number; time: number; seed: number;
  /** Slope units the skier trails the camera: the still-in degen skiing in from behind after a cash-out. */
  behind: number;
  jump: number; jumpLeft: number; jumpBuffer: number; swerve: number; swerveZ: number; stumble: number; coins: number; style: number; bonks: number; spilled: number;
  objects: Obstacle[]; trails: Trail[]; trailGap: number; prints: Print[]; spills: Spill[];
}
/** What the round's multiplier lends the slope: speed in units/s, heat = 1 - 1/x, deep = log10(x) / 3. Never an outcome. */
export interface Drive { speed: number; heat: number; deep: number }
export type CourseEvent = 'coin' | 'bonk' | 'jump' | 'ramp';
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const smooth = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
export const LANE = 0.18;
export const BASE_SPEED = 155;
export const TOP_SPEED = 300;
const JUMP_BUFFER = 0.12;
const REST: Drive = { speed: 0, heat: 0, deep: 0 };
const CRUISE: Drive = { speed: BASE_SPEED, heat: 0, deep: 0 };
/** Hash only the scenery row and this round's local seed; never read a backend seed or a future result. */
function noise(n: number, seed = 0): number {
  let x = Math.imul((n + Math.imul(seed, 0x9e3779b1)) ^ 0x45d9f3b, 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
/** Downhill speed for a multiplier: 155 at 1×, 225 at 2×, 266 at 3×, capped at 300 from about 4.2×. */
export const slopeSpeed = (x: number) => Math.min(TOP_SPEED, BASE_SPEED * (1 + 0.45 * Math.log2(Math.max(1, x))));
/** The drive at a multiplier and round time, with a 0.5 s smoothstep push-off from the gate. */
export function driveAt(x100: number, elapsed: number): Drive {
  const x = Math.max(1, x100 / 100);
  return { speed: slopeSpeed(x) * smooth(elapsed / 500), heat: 1 - 1 / x, deep: clamp(Math.log10(x) / 3, 0, 1) };
}
/** Distance after `seconds` on the shared 10×-per-30 s curve: 155T + 3.86T² until the cap, less the push-off. */
export function slopeDistance(seconds: number): number {
  const t = Math.max(0, seconds), k = BASE_SPEED * 0.45 * Math.log2(10) / 30;
  const cap = (TOP_SPEED - BASE_SPEED) / k, a = Math.min(t, cap), u = Math.min(1, t / 0.5);
  return BASE_SPEED * a + k * a * a / 2 + TOP_SPEED * Math.max(0, t - cap) - BASE_SPEED * 0.5 * (u - u * u * u + u * u * u * u / 2);
}
export function createWorld(elapsed = 0, seed = 0, drive: Drive = REST): World {
  const distance = slopeDistance(elapsed / 1000);
  const world: World = { x: 0.5, lean: 0, distance, speed: drive.speed, row: Math.max(0, Math.floor((distance - 200) / 125)), time: elapsed / 1000, seed, behind: 0,
    jump: 0, jumpLeft: 0, jumpBuffer: 0, swerve: 0.5, swerveZ: 0, stumble: 0, coins: 0, style: 0, bonks: 0, spilled: 0, objects: [], trails: [], trailGap: 0, prints: [], spills: [] };
  populate(world, drive);
  // A late arrival starts with a fresh local score, and never collides with things already passed.
  for (const object of world.objects) if (object.z < distance - 18) object.used = true;
  return world;
}
/** A yeti walked across the slope here: alternating prints from one rope line to the other. */
export function addPrints(world: World, z: number, n: number) {
  const dir = noise(n * 3 + 7, world.seed) < 0.5 ? 1 : -1;
  for (let i = 0; i < 10; i++) world.prints.push({ x: dir > 0 ? 0.06 + i * 0.098 : 0.94 - i * 0.098, z: z + i * 7 + (i % 2 ? 9 : -9), dir });
}
const lane = (n: number) => 0.14 + n * LANE;
function populate(world: World, drive: Drive) {
  world.objects = world.objects.filter(object => object.z > world.distance - 440);
  world.prints = world.prints.filter(print => print.z > world.distance - 440);
  // Rows are built just beyond the tallest view, so a hotter round reaches the skier within a few seconds.
  while (world.row * 125 < world.distance + 620) {
    const row = world.row++;
    const z = 220 + row * 125;
    const r = (k: number) => noise(row * 8 + k, world.seed);
    const kind = (k: number): Kind => { const n = r(k); return n < 0.45 ? 'tree' : n < 0.75 ? 'rock' : 'rug'; };
    const coins = Math.floor(r(1) * 5);
    const blocked = (coins + 1 + Math.floor(r(2) * 4)) % 5;
    world.objects.push({ id: row * 10, kind: kind(3), x: lane(blocked), z, used: false });
    world.objects.push({ id: row * 10 + 1, kind: 'tree', x: row % 2 ? 0.055 : 0.945, z: z + 36, used: false });
    if (row % 5 === 3) world.objects.push({ id: row * 10 + 2, kind: 'ramp', x: lane(coins), z: z - 28, used: false });
    for (let c = 0; c < 3; c++) world.objects.push({ id: row * 10 + 3 + c, kind: 'coin', x: lane(coins), z: z + c * 27, used: false });
    if (drive.heat >= 1 / 3) {
      // From 1.5× a second blocker narrows the gaps, and every third row the coin line itself needs a hop.
      const open = [0, 1, 2, 3, 4].filter(n => n !== coins && n !== blocked);
      world.objects.push({ id: row * 10 + 6, kind: kind(4), x: lane(open[Math.floor(r(5) * open.length)]), z: z + 62, used: false });
      if (row % 3 === 0 && row % 5 !== 3) world.objects.push({ id: row * 10 + 7, kind: r(6) < 0.5 ? 'rug' : 'rock', x: lane(coins), z: z - 40, used: false });
    }
    if (drive.heat >= 0.5 && r(7) < 0.1 + 0.3 * drive.deep) addPrints(world, z + 80, row);
  }
}
/** DEMO and the still-in degen: chase coins, hop most low hazards and swerve round most trees. A seeded few still trip it. */
function autopilot(world: World, dt: number): number {
  const here = world.distance - world.behind;
  // A committed swerve holds until the hazard is behind, so the coin chase cannot pull back into it.
  if (world.swerveZ > here) return clamp((world.swerve - world.x) * 9, -1, 1);
  const coin = world.objects.find(o => o.kind === 'coin' && !o.used && o.z > here + 15);
  const steer = clamp(((coin?.x ?? 0.5) - world.x) * 6, -1, 1);
  let hazard: Obstacle | null = null;
  for (const o of world.objects) {
    const lead = o.z - here;
    if (o.used || (o.kind !== 'tree' && o.kind !== 'rock' && o.kind !== 'rug') || lead <= 0 || lead > 30 + world.speed * 0.45) continue;
    // Check both where the skier is and where the current carve will be when it reaches this row.
    const at = clamp(world.x + steer * 0.62 * (0.75 + 0.25 * world.speed / BASE_SPEED) * lead / Math.max(60, world.speed), 0.055, 0.945);
    if (Math.min(Math.abs(o.x - at), Math.abs(o.x - world.x)) < 0.08 && (!hazard || o.z < hazard.z)) hazard = o;
  }
  if (!hazard || noise(hazard.id, world.seed) < 0.12) return steer;
  if (hazard.kind !== 'tree') {
    if (hazard.z < here + 14 + world.speed * 0.3) world.jumpBuffer = Math.max(world.jumpBuffer, dt);
    return steer;
  }
  const away = world.x >= hazard.x ? 1 : -1;
  world.swerve = clamp(hazard.x + (Math.abs(hazard.x + away * 0.13 - 0.5) > 0.37 ? -away : away) * 0.13, 0.12, 0.88);
  world.swerveZ = hazard.z + 12;
  return clamp((world.swerve - world.x) * 9, -1, 1);
}
export function stepWorld(world: World, dt: number, input: Commands, drive: Drive = CRUISE): CourseEvent[] {
  const events: CourseEvent[] = [];
  dt = clamp(dt, 0, 0.05);
  world.time += dt;
  world.stumble = Math.max(0, world.stumble - dt);
  world.jumpBuffer = input.jump ? JUMP_BUFFER : Math.max(0, world.jumpBuffer - dt);
  let steer = input.steer;
  if (!input.touched) steer = autopilot(world, dt);
  else if (!steer && input.target !== null) steer = clamp((input.target - world.x) * 9, -1, 1);
  if (world.stumble > 0) steer *= 0.4;
  world.x = clamp(world.x + steer * dt * 0.62 * (0.75 + 0.25 * world.speed / BASE_SPEED), 0.055, 0.945);
  world.lean += (steer - world.lean) * (1 - Math.exp(-12 * dt));
  // A buffered press lands the jump as soon as the skier is back on the snow.
  if (world.jumpBuffer > 0 && world.jumpLeft <= 0 && world.stumble === 0) {
    world.jumpLeft = 0.85; world.jumpBuffer = 0;
    events.push('jump');
  }
  world.jumpLeft = Math.max(0, world.jumpLeft - dt);
  world.jump = world.jumpLeft > 0 ? Math.sin(Math.PI * world.jumpLeft / 0.85) : 0;
  // Speed eases toward the drive: a bonk bites quickly, recovery takes about half a second.
  const target = drive.speed * (world.stumble > 0 ? 0.42 : 1);
  world.speed += (target - world.speed) * (1 - Math.exp(-(target < world.speed ? 14 : 6) * dt));
  const before = world.distance - world.behind;
  world.distance += dt * world.speed;
  const at = world.distance - world.behind;
  populate(world, drive);
  for (const object of world.objects) {
    if (object.used || object.z < before - 20 || object.z > at + 14) continue;
    const near = Math.abs(object.x - world.x) < (object.kind === 'coin' ? 0.052 : 0.059);
    if (!near) continue;
    if (object.kind === 'coin') {
      object.used = true; world.coins++; world.style += 100; events.push('coin');
    } else if (object.kind === 'ramp') {
      object.used = true; world.jumpLeft = 0.85; world.style += 50; events.push('ramp');
    } else if (object.kind !== 'tree' && world.jump > 0.3) {
      object.used = true; world.style += 25;
    } else if (world.stumble <= 0 && world.jumpLeft < 0.8) {
      // Paper knees spill a quarter of the unbanked arcade bag.
      const lost = Math.ceil(world.coins * 0.25);
      object.used = true; world.stumble = 0.72; world.bonks++; world.style = Math.max(0, world.style - 25);
      world.coins -= lost; world.spilled = lost;
      for (let i = 0; i < Math.min(lost, 5); i++) world.spills.push({ x: world.x, z: at, vx: (i - 2) * 0.05 + (noise(object.id + i, world.seed) - 0.5) * 0.04, age: 0 });
      events.push('bonk');
    }
  }
  for (const spill of world.spills) spill.age += dt;
  world.spills = world.spills.filter(spill => spill.age < 0.7);
  // Tracks are laid by distance, so their spacing stays even at any speed.
  world.trailGap += at - before;
  if (world.trailGap > 7 && world.jump < 0.2) {
    world.trailGap = 0;
    world.trails.push({ x: world.x, z: at, lean: world.lean });
  }
  world.trails = world.trails.filter(t => t.z > world.distance - 500).slice(-130);
  return events;
}
