/**
 * The rocket and everyone on it. Four strap-on boosters (the snipers'
 * stage, which separates at 1.3× with the snipers riding it down), a core
 * (the bundled supply, gone at 2×) and the upper stage with the crew capsule
 * and the nose the wires hold. The rocket sold out, so ninety-six holders
 * ride the outside, clinging to the upper stage, and let go in waves at each
 * milestone, tumbling away behind. Your astronaut clings at the front in a
 * lime visor and bails out on a parachute when the room accepts your
 * cash-out. Positions are in rocket space (up along its axis from the base)
 * so a sway or a tumble carries everything with it.
 */
import { CROWD_FACES, FACE, PRINT } from './atlas';
import { putInstance } from './gl';
import type { Label } from './hud';
import { type Vec3, add, cross, madd, normalize, rotateAbout } from './math3d';
import { type Spring, clamp, mulberry32, settleSpring, spring, stepSpring } from './motion';
import type { Renderer } from './render';

/** The multipliers at which a wave of holders lets go. */
export const WAVES = [1.2, 1.5, 2, 2.6, 3.4, 4.6, 6.9, 10, 15, 25, 50];
/** The boosters (the snipers' stage) separate here, and the core (the bundled supply) here. */
export const BOOSTERS_AT = 1.3;
export const CORE_AT = 2.0;
export const HEADLINE = 69_420;
/** World units climbed per doubling of the multiplier. */
export const CLIMB = 55;
const HOLDERS = 96;
const GRAVITY = 14;
const BOOSTER_RADIUS = 1.55;
const CREW_FACES = [FACE.pepe, FACE.wojak, FACE.doge] as const;

export const altitudeOf = (m: number): number => CLIMB * Math.log2(Math.max(1, m));
/** The holders-aboard headline for the HUD. */
export const headline = (m: number, crashed: boolean): number => (crashed ? 0 : Math.round(HEADLINE * Math.pow(0.5, Math.log2(Math.max(1, m)) * 0.85)));

type HolderState = 'cling' | 'tumble' | 'gone';

interface Holder {
  theta: number;
  y: number;
  size: number;
  face: number;
  quit: number;
  state: HolderState;
  /** Below zero while a wave's stagger holds them on a little longer. */
  age: number;
  /** Where they let go and how they left, in world axes relative to the rocket's base. */
  from: Vec3;
  vel: Vec3;
  spin: Vec3;
  spinRate: number;
  label?: string;
}

interface Particle { p: Vec3; v: Vec3; age: number; life: number; size: number; smoke: boolean }

export interface Stage { attached: boolean; age: number }

export interface Rocket {
  alt: number;
  /** World units per second the rocket climbs while the round runs. */
  climb: number;
  time: number;
  thrust: number;
  swayX: Spring;
  swayZ: Spring;
  /** Where the camera should look: the middle of what is still attached. */
  focus: Spring;
  boosters: Stage;
  core: Stage;
  holders: Holder[];
  you: { mode: 'cling' | 'eject' | 'gone'; theta: number; y: number; size: number; age: number; from: Vec3; vel: Vec3 };
  particles: Particle[];
  events: string[];
  wave: number;
  /** The crew's faces after the wire snaps. */
  panic: boolean;
  /** The in-flight crash: dead engines, a tumble and a fall. */
  dead: boolean;
  deadFor: number;
  random: () => number;
}

export interface Frame { origin: Vec3; x: Vec3; y: Vec3; z: Vec3 }

export function createRocket(): Rocket {
  const rocket: Rocket = { alt: 0, climb: (CLIMB * 0.00006 * 1000) / Math.LN2, time: 0, thrust: 0, swayX: spring(0), swayZ: spring(0), focus: spring(8), boosters: { attached: true, age: 0 }, core: { attached: true, age: 0 }, holders: [], you: { mode: 'cling', theta: 0, y: 11.6, size: 0.5, age: 0, from: [0, 0, 0], vel: [0, 0, 0] }, particles: [], events: [], wave: 0, panic: false, dead: false, deadFor: 0, random: mulberry32(0x6b0b) };
  resetRocket(rocket);
  return rocket;
}

/** Back on the pad with everyone aboard. */
export function resetRocket(rocket: Rocket): void {
  const random = mulberry32(0x6b0b);
  rocket.random = mulberry32(0x9a77);
  rocket.alt = 0;
  rocket.time = 0;
  rocket.thrust = 0;
  settleSpring(rocket.swayX, 0);
  settleSpring(rocket.swayZ, 0);
  settleSpring(rocket.focus, 8);
  rocket.boosters = { attached: true, age: 0 };
  rocket.core = { attached: true, age: 0 };
  rocket.particles = [];
  rocket.events = [];
  rocket.wave = 0;
  rocket.panic = false;
  rocket.dead = false;
  rocket.deadFor = 0;
  rocket.you = { mode: 'cling', theta: 0, y: 11.6, size: 0.5, age: 0, from: [0, 0, 0], vel: [0, 0, 0] };
  // Waves take a shrinking share of the crowd: the early jeets are the many.
  const shares = [18, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3];
  const quits: number[] = [];
  shares.forEach((n, k) => { for (let i = 0; i < n; i += 1) quits.push(WAVES[k]!); });
  for (let i = quits.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [quits[i], quits[j]] = [quits[j]!, quits[i]!]; }
  rocket.holders = [];
  const rows = 9;
  const perRow = 11;
  for (let i = 0; i < HOLDERS; i += 1) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const theta = ((col + (row % 2) * 0.5) / perRow) * Math.PI * 2 + (random() - 0.5) * 0.25;
    const y = 9.35 + (row / (rows - 1)) * 3.75 + (random() - 0.5) * 0.2;
    // Nobody sits in your spot at the front.
    const clash = Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta))) < 0.42 && Math.abs(y - 11.6) < 0.55;
    rocket.holders.push({ theta: clash ? theta + 0.9 : theta, y, size: 0.4 + random() * 0.1, face: CROWD_FACES[Math.floor(random() * CROWD_FACES.length)]!, quit: quits[i]!, state: 'cling', age: 0, from: [0, 0, 0], vel: [0, 0, 0], spin: normalize([random() - 0.5, random() - 0.5, random() - 0.5]), spinRate: 2 + random() * 4 });
  }
  // A few named holders, spread round the hull so their labels keep apart.
  const named: [number, string, number, number, number, number][] = [[1.5, 'INFLUENCER', FACE.soy, 0.5, 0.85, 12.9], [4.6, 'WHALE', FACE.chad, 0.62, -0.95, 10.1], [2.6, 'MY COUSIN', FACE.wojak, 0.45, -0.75, 12.6], [10, 'DIAMOND HANDS', FACE.chad, 0.48, 1.05, 10.4]];
  for (const [quit, label, face, size, theta, y] of named) {
    const holder = rocket.holders.find((h) => h.quit === quit && !h.label);
    if (holder) { holder.label = label; holder.face = face; holder.size = size; holder.theta = theta; holder.y = y; }
  }
}

/** The rocket's frame in the world: its base and its axes, with the sway and the tumble. */
export function rocketFrame(rocket: Rocket): Frame {
  const lean = rocket.dead ? 0 : 0.012;
  let y: Vec3 = normalize([rocket.swayX.v * lean, 1, rocket.swayZ.v * lean]);
  if (rocket.dead) {
    const t = rocket.deadFor;
    y = rotateAbout(y, [0, 0, 1], Math.min(2.7, 0.35 * t + 1.7 * t * t));
  }
  let x: Vec3 = normalize(cross([0, 0, 1], y));
  if (!Number.isFinite(x[0]!) || Math.hypot(x[0], x[1], x[2]) < 1e-4) x = [1, 0, 0];
  const z = cross(x, y);
  // A rocket that never left the pad (a 1.00× round) tips over on it rather than through it.
  const fall = rocket.dead ? Math.min(10 * rocket.deadFor * rocket.deadFor, rocket.alt + 1.5) : 0;
  return { origin: [rocket.swayX.x, rocket.alt - fall, rocket.swayZ.x], x, y, z };
}

/** A rocket-space point in the world. */
export const toWorld = (f: Frame, lx: number, ly: number, lz: number): Vec3 => [f.origin[0] + f.x[0] * lx + f.y[0] * ly + f.z[0] * lz, f.origin[1] + f.x[1] * lx + f.y[1] * ly + f.z[1] * lz, f.origin[2] + f.x[2] * lx + f.y[2] * ly + f.z[2] * lz];

/** A holder's spot on the hull: outward is +z at theta 0, the side the camera keeps to. */
const spot = (theta: number, y: number, radius: number): Vec3 => [Math.sin(theta) * radius, y, Math.cos(theta) * radius];
const outward = (theta: number): Vec3 => [Math.sin(theta), 0, Math.cos(theta)];

/** Joins a round in progress: everything the multiplier already did has happened. */
export function settleRocket(rocket: Rocket, multiplier: number, elapsed?: number): void {
  rocket.alt = altitudeOf(multiplier);
  rocket.time = elapsed ?? rocket.alt / rocket.climb;
  rocket.thrust = 1;
  if (multiplier >= BOOSTERS_AT) rocket.boosters = { attached: false, age: 10 };
  if (multiplier >= CORE_AT) rocket.core = { attached: false, age: 10 };
  settleSpring(rocket.focus, rocket.core.attached ? 8 : 12.6);
  rocket.wave = WAVES.filter((w) => multiplier >= w).length;
  for (const holder of rocket.holders) if (multiplier >= holder.quit) holder.state = 'gone';
}

/** Lets a holder go: they keep the rocket's sideways motion, lose its climb, and spin away. */
function release(rocket: Rocket, holder: Holder, delay: number): void {
  const r = rocket.random;
  const out = outward(holder.theta);
  holder.state = 'tumble';
  holder.age = -delay;
  holder.from = spot(holder.theta, holder.y, 0.85 + 0.44 * holder.size);
  holder.vel = [out[0] * (1.5 + r() * 2), 1 + r() * 1.5, out[2] * (1.5 + r() * 2)];
}

/** The room accepted your cash-out: you jump. */
export function bailYou(rocket: Rocket): void {
  if (rocket.you.mode !== 'cling') return;
  const you = rocket.you;
  you.mode = 'eject';
  you.age = 0;
  you.from = spot(you.theta, you.y, 0.85 + 0.44 * you.size);
  you.vel = [0.6, 3.2, 3.4];
  rocket.events.push('bailed');
}

/** The wire snapped: the engines die, everyone lets go, the rocket tumbles. */
export function killRocket(rocket: Rocket): void {
  if (rocket.dead) return;
  rocket.dead = true;
  rocket.deadFor = 0;
  rocket.panic = true;
  for (const holder of rocket.holders) if (holder.state === 'cling') release(rocket, holder, rocket.random() * 0.5);
}

export interface Drive { racing: boolean; multiplier: number; tension: number; crashed: boolean }

export function stepRocket(rocket: Rocket, drive: Drive, dt: number, reduced: boolean): void {
  rocket.events = [];
  rocket.time += dt;
  const { multiplier } = drive;
  if (rocket.dead) {
    rocket.deadFor += dt;
    rocket.thrust = Math.max(0, rocket.thrust - dt * 3);
  } else if (drive.racing) {
    rocket.alt = altitudeOf(multiplier);
    rocket.thrust = Math.min(1, rocket.thrust + dt * 2.5);
  } else if (!drive.crashed) {
    rocket.thrust = Math.max(0, rocket.thrust - dt * 2);
  }
  // Sway: a slow wander that quickens with the tension, damped so the lean reads as effort.
  const t = rocket.time;
  const wander = drive.racing && !rocket.dead ? (0.3 + 0.9 * drive.tension) * (reduced ? 0.4 : 1) : 0;
  stepSpring(rocket.swayX, wander * (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3) * 0.25), 1.8, 0.6, dt);
  stepSpring(rocket.swayZ, wander * (Math.cos(t * 0.7) * 0.5 + Math.sin(t * 1.9 + 1) * 0.2), 1.8, 0.6, dt);
  // Stage separations.
  if (drive.racing && !rocket.dead) {
    if (rocket.boosters.attached && multiplier >= BOOSTERS_AT) { rocket.boosters = { attached: false, age: 0 }; rocket.events.push('boosters'); }
    if (rocket.core.attached && multiplier >= CORE_AT) { rocket.core = { attached: false, age: 0 }; rocket.events.push('core'); }
  }
  if (!rocket.boosters.attached) rocket.boosters.age += dt;
  if (!rocket.core.attached) rocket.core.age += dt;
  stepSpring(rocket.focus, rocket.core.attached ? 8 : 12.6, 2, 1, dt);
  // Jeet waves.
  if (drive.racing && !rocket.dead) {
    const wave = WAVES.filter((w) => multiplier >= w).length;
    if (wave > rocket.wave) {
      for (let k = rocket.wave; k < wave; k += 1) {
        for (const holder of rocket.holders) if (holder.state === 'cling' && holder.quit === WAVES[k]) release(rocket, holder, rocket.random() * 0.7);
      }
      rocket.wave = wave;
      rocket.events.push('jeets');
    }
  }
  for (const holder of rocket.holders) {
    if (holder.state !== 'tumble') continue;
    holder.age += dt;
    if (holder.age > 4 || holder.from[1] + holder.vel[1] * holder.age - 0.5 * (GRAVITY + rocket.climb * 0) * holder.age * holder.age < -80) holder.state = 'gone';
  }
  const you = rocket.you;
  if (you.mode === 'eject') {
    you.age += dt;
    if (you.age > 7) you.mode = 'gone';
  }
  // Exhaust and smoke, in the world, so they stay behind as the rocket climbs.
  const frame = rocketFrame(rocket);
  const burn = rocket.thrust;
  if (burn > 0.02 && (drive.racing || rocket.dead)) {
    const r = rocket.random;
    const clusters: [Vec3, number][] = [];
    if (rocket.core.attached) {
      clusters.push([toWorld(frame, 0, -0.5, 0), 1]);
      if (rocket.boosters.attached) for (let k = 0; k < 4; k += 1) { const a = (k * Math.PI) / 2; clusters.push([toWorld(frame, Math.cos(a) * BOOSTER_RADIUS, -0.2, Math.sin(a) * BOOSTER_RADIUS), 0.55]); }
    } else clusters.push([toWorld(frame, 0, 7.9, 0), 0.7]);
    const down: Vec3 = [-frame.y[0], -frame.y[1], -frame.y[2]];
    for (const [at, size] of clusters) {
      const flames = Math.round((reduced ? 28 : 55) * dt * burn) + (r() < 40 * dt ? 1 : 0);
      for (let i = 0; i < flames; i += 1) {
        const jitter: Vec3 = [(r() - 0.5) * 0.5, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5];
        rocket.particles.push({ p: madd(at, jitter, size), v: add(madd(down, jitter, 4), [down[0] * (16 + r() * 8), down[1] * (16 + r() * 8), down[2] * (16 + r() * 8)]), age: 0, life: 0.22 + r() * 0.2, size: size * (0.45 + r() * 0.35), smoke: false });
      }
      const smokes = Math.round((reduced ? 8 : 16) * dt * burn) + (r() < 12 * dt ? 1 : 0);
      for (let i = 0; i < smokes; i += 1) {
        const jitter: Vec3 = [(r() - 0.5) * 1.2, (r() - 0.5) * 0.4, (r() - 0.5) * 1.2];
        rocket.particles.push({ p: madd(madd(at, down, 1.2), jitter, size), v: add(madd(down, jitter, 2.5), [down[0] * 3, down[1] * 3, down[2] * 3]), age: 0, life: 1.4 + r() * 1.2, size: size * (0.5 + r() * 0.4), smoke: true });
      }
    }
  }
  // The launch pad's cloud: smoke that hits the ground spreads along it.
  for (const k of rocket.particles) {
    k.age += dt;
    if (k.smoke) {
      if (k.p[1] < 0.6 && k.v[1] < 0) {
        const away = normalize([k.p[0], 0, k.p[2]]);
        k.v = [k.v[0] + away[0] * 9 * dt * 4, k.v[1] * 0.2, k.v[2] + away[2] * 9 * dt * 4];
        k.p[1] = 0.6;
      }
      k.v = [k.v[0] * (1 - dt * 0.6), k.v[1] * (1 - dt * 0.6) + dt * 1.5, k.v[2] * (1 - dt * 0.6)];
    }
    k.p = madd(k.p, k.v, dt);
  }
  rocket.particles = rocket.particles.filter((k) => k.age < k.life);
  if (rocket.particles.length > 900) rocket.particles.splice(0, rocket.particles.length - 900);
}

/** The count of holders still clinging. */
export const aboard = (rocket: Rocket): number => rocket.holders.filter((h) => h.state === 'cling').length;

/** Where a separated stage is, relative to the base of the rocket, and how it has turned. */
function stagePose(stage: Stage, out: Vec3, up: Vec3, climb: number): { offset: Vec3; roll: number } {
  const t = stage.age;
  const drop = 0.5 * GRAVITY * t * t + climb * t * 0.35;
  return { offset: [out[0] * (t * 2.5 + t * t * 1.5) - up[0] * drop, out[1] * (t * 2.5 + t * t * 1.5) - up[1] * drop, out[2] * (t * 2.5 + t * t * 1.5) - up[2] * drop], roll: Math.min(1.4, t * 0.6) };
}

export interface Drawn {
  you: Vec3 | null;
  nose: Vec3;
  /** The mouth of the lowest burning engine, for the light. */
  engine: Vec3;
  centre: Vec3;
}

/** Draws the rocket, its stages, everyone on it and the exhaust; adds their labels. */
export function drawRocket(rocket: Rocket, r: Renderer, labels: Label[], time: number, reduced: boolean): Drawn {
  const m = r.meshes;
  const frame = rocketFrame(rocket);
  const { x, y, z } = frame;
  const one: [number, number, number] = [1, 1, 1];
  // The stages still attached, and the ones falling away.
  let boosters = 0;
  let stickers = 0;
  let flails = 0;
  let clings = 0;
  const sniperFaces = [FACE.pepe, FACE.chad, FACE.pepe, FACE.soy];
  if (rocket.boosters.age < 5) {
    for (let k = 0; k < 4; k += 1) {
      const a = (k * Math.PI) / 2;
      const out: Vec3 = normalize(add([x[0] * Math.cos(a), x[1] * Math.cos(a), x[2] * Math.cos(a)], [z[0] * Math.sin(a), z[1] * Math.sin(a), z[2] * Math.sin(a)]));
      let at = toWorld(frame, Math.cos(a) * BOOSTER_RADIUS, 0, Math.sin(a) * BOOSTER_RADIUS);
      let bx = x;
      let by = y;
      let bz = z;
      if (!rocket.boosters.attached) {
        const pose = stagePose(rocket.boosters, out, y, rocket.climb);
        at = add(at, pose.offset);
        const axis = normalize(cross(y, out));
        bx = rotateAbout(x, axis, pose.roll); by = rotateAbout(y, axis, pose.roll); bz = rotateAbout(z, axis, pose.roll);
      }
      boosters = putInstance(m.booster, boosters, at, bx, by, bz, one);
      // The COPIUM label on the outside of each booster.
      const sx = normalize(cross(by, out));
      const sz = cross(sx, by);
      stickers = putInstance(m.sticker, stickers, add(add(at, [by[0] * 3.2, by[1] * 3.2, by[2] * 3.2]), [out[0] * 0.535, out[1] * 0.535, out[2] * 0.535]), sx, by, sz, [0.62, 0.39, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [0, PRINT.copium, 0, 0]);
      // A sniper rides each booster down, arms out, and one of them is labelled.
      const seat = add(add(at, [by[0] * 7.1, by[1] * 7.1, by[2] * 7.1]), [out[0] * 0.15, out[1] * 0.15, out[2] * 0.15]);
      flails = putInstance(m.flail, flails, seat, sx, by, sz, [0.42, 0.42, 0.42], [1, 1, 1, 1], [sniperFaces[k]!, 0, 0, 0]);
      if (k === 1 && !rocket.boosters.attached && rocket.boosters.age < 3) labels.push({ text: 'SNIPERS', at: add(seat, [by[0] * 0.7, by[1] * 0.7, by[2] * 0.7]), colour: '#ffd24a', size: 16 });
    }
  }
  if (rocket.core.age < 6) {
    let at = frame.origin;
    let cx = x;
    let cy = y;
    let cz = z;
    if (!rocket.core.attached) {
      const pose = stagePose(rocket.core, [0.2 * x[0] + 0.1 * z[0], 0.2 * x[1] + 0.1 * z[1], 0.2 * x[2] + 0.1 * z[2]], y, rocket.climb);
      at = add(at, pose.offset);
      cx = rotateAbout(x, z, pose.roll * 0.8); cy = rotateAbout(y, z, pose.roll * 0.8); cz = z;
    }
    putInstance(m.core, 0, at, cx, cy, cz, one);
    r.drawLit(m.core, 1);
    // The coin's sticker on the front of the tank.
    const front = cz;
    stickers = putInstance(m.sticker, stickers, add(add(at, [cy[0] * 4.4, cy[1] * 4.4, cy[2] * 4.4]), [front[0] * 1.02, front[1] * 1.02, front[2] * 1.02]), cx, cy, cz, [1.9, 1.9, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [0, PRINT.sticker, 0, 0]);
    if (!rocket.core.attached && rocket.core.age < 3.5) labels.push({ text: 'CORE STAGE (60% OF SUPPLY)', at: add(at, [cy[0] * 4.2 + cx[0] * 1.3, cy[1] * 4.2 + cx[1] * 1.3, cy[2] * 4.2 + cx[2] * 1.3]), colour: '#ff6b86', size: 15 });
  }
  putInstance(m.upper, 0, frame.origin, x, y, z, one);
  putInstance(m.capsule, 0, frame.origin, x, y, z, one);
  putInstance(m.nose, 0, frame.origin, x, y, z, one);
  r.drawLit(m.upper, 1);
  r.drawLit(m.capsule, 1);
  r.drawLit(m.nose, 1);
  // HOPIUM on the upper stage, and the crew at the portholes.
  stickers = putInstance(m.sticker, stickers, toWorld(frame, 0, 10.6, 0.865), x, y, z, [1.05, 0.66, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [0, PRINT.hopium, 0, 0]);
  for (let k = 0; k < 3; k += 1) {
    const theta = (k * Math.PI * 2) / 3;
    const out = outward(theta);
    const worldOut = normalize(add([x[0] * out[0], x[1] * out[0], x[2] * out[0]], [z[0] * out[2], z[1] * out[2], z[2] * out[2]]));
    const px = normalize(cross(y, worldOut));
    const pz = cross(px, y);
    const face = rocket.panic && k !== 2 ? FACE.crying : CREW_FACES[k]!;
    putInstance(m.porthole, k, toWorld(frame, out[0] * 0.79, 14.1, out[2] * 0.79), px, y, pz, [0.9, 0.9, 0.9], [1, 1, 1, 1], [face, 0, 0, 0]);
  }
  r.drawLit(m.porthole, 3);
  // The holders: clinging in a grid, then tumbling away.
  const climbDrop = rocket.dead ? 0 : rocket.climb;
  const spinAxes: Vec3[] = [];
  for (const holder of rocket.holders) {
    if (holder.state === 'gone') continue;
    const out = outward(holder.theta);
    const worldOut = normalize(add([x[0] * out[0], x[1] * out[0], x[2] * out[0]], [z[0] * out[2], z[1] * out[2], z[2] * out[2]]));
    const hx = normalize(cross(y, worldOut));
    const hz = cross(hx, y);
    const s = holder.size;
    if (holder.state === 'cling' || holder.age < 0) {
      const at = toWorld(frame, out[0] * (0.85 + 0.44 * s), holder.y, out[2] * (0.85 + 0.44 * s));
      clings = putInstance(m.cling, clings, at, hx, y, hz, [s, s, s], [1, 1, 1, 1], [holder.face, 0, 0, 0]);
      if (holder.label) labels.push({ text: holder.label, at: add(at, [y[0] * 1.2 * s, y[1] * 1.2 * s, y[2] * 1.2 * s]), colour: holder.label === 'WHALE' ? '#8ff0ff' : '#ffd0dc', size: 14 });
      continue;
    }
    const t = holder.age;
    // Let go in the rocket's frame at that moment; since then the rocket has climbed away and they have fallen.
    const rel = madd(holder.from, holder.vel, t);
    const at = add(frame.origin, add([x[0] * rel[0] + z[0] * rel[2], x[1] * rel[0] + z[1] * rel[2], x[2] * rel[0] + z[2] * rel[2]], [y[0] * rel[1], y[1] * rel[1], y[2] * rel[1]]));
    const fallen = 0.5 * GRAVITY * t * t + climbDrop * t;
    const pos: Vec3 = [at[0], at[1] - fallen, at[2]];
    const angle = t * holder.spinRate;
    const fx = rotateAbout(hx, holder.spin, angle);
    const fy = rotateAbout(y, holder.spin, angle);
    const fz = rotateAbout(hz, holder.spin, angle);
    spinAxes.push(pos);
    flails = putInstance(m.flail, flails, pos, fx, fy, fz, [s, s, s], [1, 1, 1, 1], [rocket.dead ? FACE.crying : holder.face, 0, 0, 0]);
    if (holder.label && t < 2.2) labels.push({ text: `${holder.label} SOLD`, at: add(pos, [0, 0.9 * s, 0]), colour: '#ff6b86', size: 14 });
  }
  // You: clinging at the front, or out on the parachute.
  let youAt: Vec3 | null = null;
  const you = rocket.you;
  const yo = outward(you.theta);
  const youOut = normalize(add([x[0] * yo[0], x[1] * yo[0], x[2] * yo[0]], [z[0] * yo[2], z[1] * yo[2], z[2] * yo[2]]));
  const ux = normalize(cross(y, youOut));
  const uz = cross(ux, y);
  if (you.mode === 'cling') {
    youAt = toWorld(frame, yo[0] * (0.85 + 0.44 * you.size), you.y, yo[2] * (0.85 + 0.44 * you.size));
    clings = putInstance(m.cling, clings, youAt, ux, y, uz, [you.size, you.size, you.size], [1, 1, 1, 1], [FACE.you, 0, 0, 0]);
  } else if (you.mode === 'eject') {
    const t = you.age;
    const open = clamp((t - 0.45) / 0.35, 0, 1);
    // A jump, then the canopy takes the fall down to a drift: 2 a second, against the rocket's climb.
    const fallen = open <= 0 ? 0.5 * GRAVITY * t * t : 0.5 * GRAVITY * 0.45 * 0.45 + (t - 0.45) * (2.2 + (GRAVITY * 0.45 - 2.2) * Math.exp(-(t - 0.45) * 3));
    const rel = madd(you.from, you.vel, Math.min(t, 0.45) + Math.max(0, t - 0.45) * 0.35);
    const at = add(frame.origin, add([x[0] * rel[0] + z[0] * rel[2], x[1] * rel[0] + z[1] * rel[2], x[2] * rel[0] + z[2] * rel[2]], [y[0] * rel[1], y[1] * rel[1], y[2] * rel[1]]));
    youAt = [at[0] + Math.sin(t * 1.3) * 0.4 * open, at[1] - fallen - climbDrop * t, at[2]];
    const swing = reduced ? 0 : Math.sin(t * 2.2) * 0.18 * open;
    const sx = rotateAbout(ux, uz, swing);
    const sy = rotateAbout([0, 1, 0], uz, swing);
    const pose = open > 0 ? m.flail : m.flail;
    flails = putInstance(pose, flails, youAt, sx, sy, uz, [you.size, you.size, you.size], [1, 1, 1, 1], [FACE.you, 0, 0, 0]);
    if (open > 0) {
      const top = add(youAt, [sy[0] * 2.4, sy[1] * 2.4, sy[2] * 2.4]);
      const size = 1.6 * open;
      putInstance(m.chute, 0, top, sx, sy, uz, [size, size * 0.9, size]);
      r.drawLit(m.chute, 1, 'opaque', 'none');
      // The lines, from the canopy's rim to the harness.
      let lines = 0;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const rim = add(top, add([sx[0] * Math.cos(a) * size, sx[1] * Math.cos(a) * size, sx[2] * Math.cos(a) * size], [uz[0] * Math.sin(a) * size, uz[1] * Math.sin(a) * size, uz[2] * Math.sin(a) * size]));
        const harness = add(youAt, [sy[0] * 0.9 * you.size, sy[1] * 0.9 * you.size, sy[2] * 0.9 * you.size]);
        const d = [harness[0] - rim[0], harness[1] - rim[1], harness[2] - rim[2]] as Vec3;
        const len = Math.hypot(d[0], d[1], d[2]);
        const ly = normalize(d);
        const lx = normalize(cross(ly, uz));
        const lz = cross(lx, ly);
        lines = putInstance(m.box, lines, madd(rim, d, 0.5), lx, ly, lz, [0.02, len, 0.02], [0.9, 0.9, 0.9, 1]);
      }
      r.drawLit(m.box, lines, 'opaque', 'none');
    }
  }
  r.drawLit(m.booster, boosters);
  r.drawLit(m.sticker, stickers, 'opaque', 'none');
  r.drawLit(m.cling, clings);
  r.drawLit(m.flail, flails);
  // The exhaust: flame as additive streaks, smoke as soft alpha puffs.
  for (const k of rocket.particles) {
    const life = k.age / k.life;
    if (k.smoke) continue;
    const heat = 1 - life;
    r.sprite(k.p, k.size * (0.7 + life * 0.8), [1, 0.55 + 0.45 * heat, 0.15 + 0.6 * heat * heat, 0.9 * heat], 2, [k.v[0] * 0.02, k.v[1] * 0.02, k.v[2] * 0.02]);
  }
  const engineAt = rocket.core.attached ? toWorld(frame, 0, -0.6, 0) : toWorld(frame, 0, 7.7, 0);
  if (rocket.thrust > 0.02 && !reduced) r.sprite(engineAt, 2.2 * rocket.thrust * (0.9 + 0.1 * Math.sin(time * 40)), [1, 0.75, 0.35, 0.55 * rocket.thrust], 2);
  r.flushSprites('additive');
  for (const k of rocket.particles) {
    if (!k.smoke) continue;
    const life = k.age / k.life;
    r.sprite(k.p, k.size * (0.8 + life * 3.2), [0.72, 0.72, 0.76, 0.32 * (1 - life) * (1 - life)], 0);
  }
  r.flushSprites('alpha');
  return { you: youAt, nose: toWorld(frame, 0, 17.3, 0), engine: engineAt, centre: toWorld(frame, 0, rocket.focus.x, 0) };
}
