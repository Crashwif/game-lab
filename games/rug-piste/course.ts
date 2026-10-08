/** A bounded, deterministic arcade slope. No round outcomes, stakes or payouts enter this controller. */
import type { Commands } from './input';
export type Kind = 'tree' | 'rock' | 'rug' | 'ramp' | 'coin';
export interface Obstacle { id: number; kind: Kind; x: number; z: number; used: boolean }
export interface Trail { x: number; z: number; lean: number }
export interface World {
  x: number; lean: number; distance: number; row: number; time: number;
  jump: number; jumpLeft: number; stumble: number; coins: number; style: number; bonks: number;
  objects: Obstacle[]; trails: Trail[]; trailClock: number;
}
export type CourseEvent = 'coin' | 'bonk' | 'jump' | 'ramp';
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Hash only the scenery row; never read a backend seed or a future result. */
function noise(n: number): number {
  let x = Math.imul(n ^ 0x45d9f3b, 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
export function createWorld(elapsed = 0): World {
  const distance = Math.max(0, elapsed) * 0.155;
  const world: World = { x: 0.5, lean: 0, distance, row: Math.max(0, Math.floor((distance - 200) / 125)), time: elapsed / 1000,
    jump: 0, jumpLeft: 0, stumble: 0, coins: 0, style: 0, bonks: 0, objects: [], trails: [], trailClock: 0 };
  populate(world);
  // A late arrival starts with a fresh local score, and never collides with things already passed.
  for (const object of world.objects) if (object.z < distance - 18) object.used = true;
  return world;
}
function populate(world: World) {
  world.objects = world.objects.filter(object => object.z > world.distance - 440);
  while (world.row * 125 < world.distance + 1000) {
    const row = world.row++;
    const z = 220 + row * 125;
    const lane = Math.floor(noise(row * 5 + 1) * 5);
    const x = 0.14 + lane * 0.18;
    const blocked = (lane + 2 + row % 2) % 5;
    const kinds: Kind[] = ['tree', 'rock', 'tree', 'rug'];
    world.objects.push({ id: row * 10, kind: kinds[row % 4], x: 0.14 + blocked * 0.18, z, used: false });
    world.objects.push({ id: row * 10 + 1, kind: 'tree', x: row % 2 ? 0.055 : 0.945, z: z + 36, used: false });
    if (row % 5 === 3) world.objects.push({ id: row * 10 + 2, kind: 'ramp', x, z: z - 28, used: false });
    for (let c = 0; c < 3; c++) world.objects.push({ id: row * 10 + 3 + c, kind: 'coin', x, z: z + c * 27, used: false });
  }
}
export function stepWorld(world: World, dt: number, input: Commands): CourseEvent[] {
  const events: CourseEvent[] = [];
  dt = clamp(dt, 0, 0.05);
  world.time += dt;
  world.stumble = Math.max(0, world.stumble - dt);
  let steer = input.steer;
  if (!input.touched) {
    const coin = world.objects.find(o => o.kind === 'coin' && !o.used && o.z > world.distance + 15);
    steer = clamp(((coin?.x ?? 0.5) - world.x) * 6, -1, 1);
  } else if (!steer && input.target !== null) steer = clamp((input.target - world.x) * 9, -1, 1);
  if (world.stumble > 0) steer *= 0.4;
  world.x = clamp(world.x + steer * dt * 0.62, 0.055, 0.945);
  world.lean += (steer - world.lean) * Math.min(1, dt * 12);
  if (input.jump && world.jumpLeft <= 0 && world.stumble === 0) {
    world.jumpLeft = 0.85;
    events.push('jump');
  }
  world.jumpLeft = Math.max(0, world.jumpLeft - dt);
  world.jump = world.jumpLeft > 0 ? Math.sin(Math.PI * world.jumpLeft / 0.85) : 0;
  const before = world.distance;
  world.distance += dt * 155 * (world.stumble > 0 ? 0.42 : 1);
  populate(world);
  for (const object of world.objects) {
    if (object.used || object.z < before - 20 || object.z > world.distance + 14) continue;
    const near = Math.abs(object.x - world.x) < (object.kind === 'coin' ? 0.052 : 0.059);
    if (!near) continue;
    if (object.kind === 'coin') {
      object.used = true; world.coins++; world.style += 100; events.push('coin');
    } else if (object.kind === 'ramp') {
      object.used = true; world.jumpLeft = 0.85; world.style += 50; events.push('ramp');
    } else if (object.kind !== 'tree' && world.jump > 0.3) {
      object.used = true; world.style += 25;
    } else if (world.stumble <= 0 && world.jumpLeft < 0.8) {
      object.used = true; world.stumble = 0.72; world.bonks++; world.style = Math.max(0, world.style - 25); events.push('bonk');
    }
  }
  world.trailClock += dt;
  if (world.trailClock > 0.045 && world.jump < 0.2) {
    world.trailClock = 0;
    world.trails.push({ x: world.x, z: world.distance, lean: world.lean });
  }
  world.trails = world.trails.filter(t => t.z > world.distance - 500).slice(-130);
  return events;
}
