/** Rocket stages, crowd release and the articulated player. Positions use the rocket's local frame. */
import { CROWD_FACES, FACE, PRINT } from './atlas';
import { putInstance } from './gl';
import type { Label } from './hud';
import { type Vec3, add, cross, lerp3, madd, normalize, rotateAbout, scale, sub } from './math3d';
import { type Spring, clamp, mulberry32, settleSpring, smoothstep, spring, stepSpring } from './motion';
import type { Renderer } from './render';

/** The multipliers at which a wave of holders lets go. */
export const WAVES = [1.2, 1.5, 2, 2.6, 3.4, 4.6, 6.9, 10, 15, 25, 50];
/** The boosters (the snipers' stage) separate here, and the core (the bundled supply) here. */
export const BOOSTERS_AT = 1.3;
export const CORE_AT = 2.0;
export const HEADLINE = 69_420;
export const CLIMB = 55;
const HOLDERS = 96;
const GRAVITY = 14;
const BOOSTER_RADIUS = 1.55;
const CREW_FACES = [FACE.pepe, FACE.wojak, FACE.doge] as const;

export const altitudeOf = (m: number): number => CLIMB * Math.log2(Math.max(1, m));
export const headline = (m: number, crashed: boolean): number => (crashed ? 0 : Math.round(HEADLINE * Math.pow(0.5, Math.log2(Math.max(1, m)) * 0.85)));

type HolderState = 'cling' | 'tumble' | 'gone';

interface Holder {
  theta: number;
  y: number;
  size: number;
  face: number;
  quit: number;
  state: HolderState;
  age: number;
  from: Vec3;
  vel: Vec3;
  spin: Vec3;
  spinRate: number;
  frame?: Frame;
  label?: string;
}

interface Particle { p: Vec3; v: Vec3; age: number; life: number; size: number; smoke: boolean }

export interface Stage { attached: boolean; age: number; frame?: Frame; vel?: Vec3; omega?: Vec3 }

export interface Rocket {
  alt: number;
  climb: number;
  time: number;
  thrust: number;
  swayX: Spring;
  swayZ: Spring;
  focus: Spring;
  boosters: Stage;
  core: Stage;
  holders: Holder[];
  you: { mode: 'cling' | 'eject' | 'gone'; theta: number; y: number; size: number; age: number; from: Vec3; vel: Vec3; frame?: Frame };
  particles: Particle[];
  events: string[];
  wave: number;
  panic: boolean;
  dead: boolean;
  deadFor: number;
  random: () => number;
  omega: Vec3;
  deadFrame?: Frame;
  emissions: number[];
  bailEvent?: boolean;
}

export interface Frame { origin: Vec3; x: Vec3; y: Vec3; z: Vec3 }

export function createRocket(): Rocket {
  const rocket = { swayX: spring(), swayZ: spring(), focus: spring() } as Rocket;
  resetRocket(rocket);
  return rocket;
}

export function resetRocket(rocket: Rocket): void {
  const random = mulberry32(0x6b0b);
  rocket.random = mulberry32(0x9a77);
  rocket.alt = 0;
  rocket.climb = 0; rocket.omega = [0, 0, 0]; rocket.emissions = []; rocket.bailEvent = false; rocket.deadFrame = undefined;
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
  rocket.you = { mode: 'cling', theta: 0, y: 11.6, size: 1.1, age: 0, from: [0, 0, 0], vel: [0, 0, 0] };
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
    const clash = Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta))) < 0.42 && Math.abs(y - 11.6) < 0.55;
    rocket.holders.push({ theta: clash ? theta + 0.9 : theta, y, size: 0.4 + random() * 0.1, face: CROWD_FACES[Math.floor(random() * CROWD_FACES.length)]!, quit: quits[i]!, state: 'cling', age: 0, from: [0, 0, 0], vel: [0, 0, 0], spin: normalize([random() - 0.5, random() - 0.5, random() - 0.5]), spinRate: 2 + random() * 4 });
  }
  const named: [number, string, number, number, number, number][] = [[1.5, 'INFLUENCER', FACE.soy, 0.5, 0.85, 12.9], [4.6, 'WHALE', FACE.chad, 0.62, -0.95, 10.1], [2.6, 'MY COUSIN', FACE.wojak, 0.45, -0.75, 12.6], [10, 'DIAMOND HANDS', FACE.chad, 0.48, 1.05, 10.4]];
  for (const [quit, label, face, size, theta, y] of named) {
    const holder = rocket.holders.find((h) => h.quit === quit && !h.label);
    if (holder) { holder.label = label; holder.face = face; holder.size = size; holder.theta = theta; holder.y = y; }
  }
}

/** The tumble tips the nose toward +x and a little away from the camera: clear of the tower and the car on bricks. */
const TIP: Vec3 = [0.98, 0, -0.2];

export function rocketFrame(rocket: Rocket): Frame {
  let y: Vec3 = normalize([rocket.swayX.v * 0.012, 1, rocket.swayZ.v * 0.012]);
  let origin: Vec3 = [rocket.swayX.x, rocket.alt, rocket.swayZ.x];
  if (rocket.dead) {
    // Low enough to land before the cut: it tips no further than flat, over the rim of its base, and lies on the ground.
    const t = rocket.deadFor, low = rocket.alt < 45, a = Math.min(low ? Math.PI / 2 : 2.7, 0.35 * t + 1.7 * t * t), rim = low ? (rocket.boosters.attached ? 2.1 : 1.45) : 0;
    y = rotateAbout(rocket.deadFrame?.y ?? y, [-TIP[2], 0, TIP[0]], -a);
    origin = madd(origin, TIP, rim * (1 - Math.cos(a)));
    origin[1] = Math.max(rocket.alt - 10 * t * t, rim * Math.sin(a));
  }
  let x: Vec3 = normalize(cross(y, [0, 0, 1]));
  if (!Number.isFinite(x[0]!) || Math.hypot(...x) < 1e-4) x = [1, 0, 0];
  return { origin, x, y, z: cross(x, y) };
}

export const toWorld = (f: Frame, lx: number, ly: number, lz: number): Vec3 => [f.origin[0] + f.x[0] * lx + f.y[0] * ly + f.z[0] * lz, f.origin[1] + f.x[1] * lx + f.y[1] * ly + f.z[1] * lz, f.origin[2] + f.x[2] * lx + f.y[2] * ly + f.z[2] * lz];

const spot = (theta: number, y: number, radius: number): Vec3 => [Math.sin(theta) * radius, y, Math.cos(theta) * radius];
const outward = (theta: number): Vec3 => [Math.sin(theta), 0, Math.cos(theta)];
/** A rocket-frame direction in the xz plane, in the world. */
const across = (x: Vec3, z: Vec3, o: Vec3): Vec3 => normalize(madd(scale(x, o[0]), z, o[2]));

/** Joins a round in progress: everything the multiplier already did has happened. */
export function settleRocket(rocket: Rocket, multiplier: number, elapsed?: number): void {
  rocket.alt = altitudeOf(multiplier);
  rocket.time = elapsed ?? rocket.alt / 4.76;
  rocket.climb = rocket.time > 0 ? rocket.alt / rocket.time : 0;
  rocket.thrust = 1;
  if (multiplier >= BOOSTERS_AT) rocket.boosters = { attached: false, age: 10 };
  if (multiplier >= CORE_AT) rocket.core = { attached: false, age: 10 };
  settleSpring(rocket.focus, rocket.core.attached ? 8 : 12.6);
  rocket.wave = WAVES.filter((w) => multiplier >= w).length;
  for (const holder of rocket.holders) if (multiplier >= holder.quit) holder.state = 'gone';
}

function vector(f: Frame, v: Vec3): Vec3 { return sub(toWorld(f, ...v), f.origin); }
function velocity(r: Rocket, p: Vec3): Vec3 { return add([r.swayX.v, r.dead ? -20 * r.deadFor : r.climb, r.swayZ.v], cross(r.omega, p)); }
function detach(r: Rocket, h: Holder): void {
  const f = rocketFrame(r), p = spot(h.theta, h.y, 0.85 + 0.44 * h.size);
  const out = vector(f, outward(h.theta)), hx = normalize(cross(f.y, out));
  h.frame = { ...f, x: hx, z: cross(hx, f.y) };
  h.from = toWorld(f, ...p);
  h.vel = add(vector(f, h.vel), velocity(r, vector(f, p)));
}
function release(rocket: Rocket, holder: Holder, delay: number): void {
  const r = rocket.random, out = outward(holder.theta);
  holder.state = 'tumble'; holder.age = -delay;
  holder.vel = [out[0] * (1.5 + r() * 2), 1 + r() * 1.5, out[2] * (1.5 + r() * 2)];
  if (delay <= 0) detach(rocket, holder);
}
function detachStage(r: Rocket): Stage {
  return { attached: false, age: 0, frame: rocketFrame(r), vel: velocity(r, [0, 0, 0]), omega: [...r.omega] };
}

/** The room accepted your cash-out: you jump. */
export function bailYou(rocket: Rocket): void {
  if (rocket.you.mode !== 'cling') return;
  const you = rocket.you;
  you.mode = 'eject';
  you.age = 0;
  const f = rocketFrame(rocket), p = spot(you.theta, you.y, 0.85 + 0.44 * you.size);
  you.frame = f; you.from = toWorld(f, ...p);
  you.vel = add(vector(f, [0.6, 3.2, 3.4]), velocity(rocket, vector(f, p)));
  rocket.bailEvent = true;
}

/** The wire snapped: the engines die, everyone lets go, the rocket tumbles. */
export function killRocket(rocket: Rocket): void {
  if (rocket.dead) return;
  rocket.deadFrame = rocketFrame(rocket);
  rocket.dead = true;
  rocket.deadFor = 0;
  rocket.panic = true;
  for (const holder of rocket.holders) if (holder.state === 'cling') release(rocket, holder, rocket.random() * 0.5);
}

export interface Drive { racing: boolean; multiplier: number; tension: number; crashed: boolean }

export function stepRocket(rocket: Rocket, drive: Drive, dt: number, reduced: boolean): void {
  rocket.events = rocket.bailEvent ? ['bailed'] : []; rocket.bailEvent = false;
  const previous = rocketFrame(rocket);
  rocket.time += dt;
  const { multiplier } = drive;
  if (rocket.dead) {
    rocket.deadFor += dt;
    rocket.thrust = Math.max(0, rocket.thrust - dt * 3);
  } else if (drive.racing) {
    const next = altitudeOf(multiplier);
    if (dt > 0) rocket.climb += ((next - rocket.alt) / dt - rocket.climb) * (1 - Math.exp(-dt * 12));
    rocket.alt = next;
    rocket.thrust = Math.min(1, rocket.thrust + dt * 2.5);
  } else if (!drive.crashed) {
    rocket.thrust = Math.max(0, rocket.thrust - dt * 2);
  }
  const t = rocket.time;
  const wander = drive.racing && !rocket.dead ? (0.3 + 0.9 * drive.tension) * (reduced ? 0.4 : 1) : 0;
  stepSpring(rocket.swayX, wander * (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3) * 0.25), 1.8, 0.6, dt);
  stepSpring(rocket.swayZ, wander * (Math.cos(t * 0.7) * 0.5 + Math.sin(t * 1.9 + 1) * 0.2), 1.8, 0.6, dt);
  const current = rocketFrame(rocket);
  if (dt > 0) rocket.omega = scale(add(add(cross(previous.x, current.x), cross(previous.y, current.y)), cross(previous.z, current.z)), 0.5 / dt);
  if (drive.racing && !rocket.dead) {
    if (rocket.boosters.attached && multiplier >= BOOSTERS_AT) { rocket.boosters = detachStage(rocket); rocket.events.push('boosters'); }
    if (rocket.core.attached && multiplier >= CORE_AT) { rocket.core = detachStage(rocket); rocket.events.push('core'); }
  }
  if (!rocket.boosters.attached) rocket.boosters.age += dt;
  if (!rocket.core.attached) rocket.core.age += dt;
  stepSpring(rocket.focus, rocket.core.attached ? 8 : 12.6, 2, 1, dt);
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
    if (holder.age >= 0 && !holder.frame) { detach(rocket, holder); holder.age = 0; }
    if (holder.age > 4 || holder.from[1] + holder.vel[1] * holder.age - 0.5 * GRAVITY * holder.age * holder.age < -80) holder.state = 'gone';
  }
  const you = rocket.you;
  if (you.mode === 'eject') you.age += dt;
  if (you.age > 7.8) you.mode = 'gone';
  const frame = rocketFrame(rocket);
  // On the pad between rounds the stack vents a little smoke.
  const vent = !drive.racing && !drive.crashed && !rocket.dead, burn = vent ? 1 : rocket.thrust;
  if (burn > 0.02 && (drive.racing || rocket.dead || vent)) {
    const r = rocket.random;
    const clusters: [Vec3, number][] = [];
    if (vent) clusters.push([toWorld(frame, 0, 8.6, 1.2), 0.8]);
    else if (rocket.core.attached) {
      clusters.push([toWorld(frame, 0, -0.5, 0), 1]);
      if (rocket.boosters.attached) for (let k = 0; k < 4; k += 1) { const a = (k * Math.PI) / 2; clusters.push([toWorld(frame, Math.cos(a) * BOOSTER_RADIUS, -0.2, Math.sin(a) * BOOSTER_RADIUS), 0.55]); }
    } else clusters.push([toWorld(frame, 0, 7.9, 0), 0.7]);
    const down: Vec3 = [-frame.y[0], -frame.y[1], -frame.y[2]];
    for (const [index, [at, size]] of clusters.entries()) {
      const emit = (slot: number, rate: number) => { const n = (rocket.emissions[slot] ?? 0) + rate * dt * burn; rocket.emissions[slot] = n % 1; return Math.floor(n); };
      const flames = emit(index * 2, vent ? 0 : reduced ? 48 : 95);
      for (let i = 0; i < flames; i += 1) {
        const jitter: Vec3 = [(r() - 0.5) * 0.5, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5];
        rocket.particles.push({ p: madd(at, jitter, size), v: madd(madd(down, jitter, 4), down, 16 + r() * 8), age: 0, life: 0.22 + r() * 0.2, size: size * (0.45 + r() * 0.35), smoke: false });
      }
      const smokes = emit(index * 2 + 1, reduced ? 14 : 28);
      for (let i = 0; i < smokes; i += 1) {
        const jitter: Vec3 = [(r() - 0.5) * 1.2, (r() - 0.5) * 0.4, (r() - 0.5) * 1.2];
        rocket.particles.push({ p: madd(madd(at, down, 1.2), jitter, size), v: vent ? [jitter[0] * 3, 0, 2.6] : madd(madd(down, jitter, 2.5), down, 3), age: 0, life: 1.4 + r() * 1.2, size: size * (0.5 + r() * 0.4), smoke: true });
      }
    }
  }
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

export const aboard = (rocket: Rocket): number => rocket.holders.filter((h) => h.state === 'cling').length;

export function stagePose(stage: Stage, out: Vec3): { offset: Vec3; roll: number } {
  const t = stage.age;
  return { offset: add(madd(madd([0, -0.5 * GRAVITY * t * t, 0], stage.vel ?? [0, 0, 0], t), out, t * 2.5), scale(cross(stage.omega ?? [0, 0, 0], out), BOOSTER_RADIUS * t)), roll: Math.min(1.4, t * 0.6) };
}
export function bailPosition(rocket: Rocket): Vec3 {
  const { from, vel, age: t } = rocket.you, a = Math.min(t, 0.45), b = Math.max(0, t - a), drag = (1 - Math.exp(-3 * b)) / 3;
  const at = madd(from, vel, a + drag);
  at[1] = from[1] + vel[1] * a - 0.5 * GRAVITY * a * a - 2.2 * b + (vel[1] - GRAVITY * a + 2.2) * drag;
  return at;
}
/** Eased onto your chute as you jump, and back onto the rocket once you have drifted out of the story. */
export function cameraCentre(rocket: Rocket): Vec3 {
  const centre = toWorld(rocketFrame(rocket), 0, rocket.focus.x, 0), t = rocket.you.age;
  return rocket.you.mode !== 'eject' ? centre : lerp3(centre, add(bailPosition(rocket), [0, 1, 0]), smoothstep(0, 0.6, t) - smoothstep(6.6, 7.8, t));
}

export interface Drawn {
  you: Vec3 | null;
  nose: Vec3;
  engine: Vec3;
  centre: Vec3;
}

/** Draws the rocket, its stages, everyone on it and the exhaust; `flutter` kicks the clinging holders' legs, and a spectator has no astronaut aboard. */
export function drawRocket(rocket: Rocket, r: Renderer, labels: Label[], time: number, reduced: boolean, flutter: number, spectator: boolean): Drawn {
  const m = r.meshes;
  const frame = rocketFrame(rocket);
  const { x, y, z } = frame;
  const one: [number, number, number] = [1, 1, 1];
  let boosters = 0;
  let stickers = 0;
  let flails = 0;
  let clings = 0;
  const sniperFaces = [FACE.pepe, FACE.chad, FACE.pepe, FACE.soy];
  if (rocket.boosters.age < 5) {
    const frame = rocket.boosters.frame ?? rocketFrame(rocket), { x, y, z } = frame;
    for (let k = 0; k < 4; k += 1) {
      const a = (k * Math.PI) / 2;
      const out = across(x, z, [Math.cos(a), 0, Math.sin(a)]);
      let at = toWorld(frame, Math.cos(a) * BOOSTER_RADIUS, 0, Math.sin(a) * BOOSTER_RADIUS);
      let bx = x;
      let by = y;
      let bz = z;
      if (!rocket.boosters.attached) {
        const pose = stagePose(rocket.boosters, out);
        at = add(at, pose.offset);
        const axis = normalize(cross(y, out));
        bx = rotateAbout(x, axis, pose.roll); by = rotateAbout(y, axis, pose.roll); bz = rotateAbout(z, axis, pose.roll);
      }
      boosters = putInstance(m.booster, boosters, at, bx, by, bz, one);
      const sx = normalize(cross(by, out));
      const sz = cross(sx, by);
      stickers = putInstance(m.sticker, stickers, madd(madd(at, by, 3.2), out, 0.535), sx, by, sz, [0.62, 0.39, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [0, PRINT.copium, 0, 0]);
      const seat = madd(madd(at, by, 7.1), out, 0.15);
      flails = putInstance(m.flail, flails, seat, sx, by, sz, [0.42, 0.42, 0.42], [1, 1, 1, 1], [sniperFaces[k]!, 0, 0, 0]);
      if (k === 1 && !rocket.boosters.attached && rocket.boosters.age < 3) labels.push({ text: 'SNIPERS', at: madd(seat, by, 0.7), colour: '#ffd24a', size: 16 });
    }
  }
  if (rocket.core.age < 6) {
    const frame = rocket.core.frame ?? rocketFrame(rocket), { x, y, z } = frame;
    let at = frame.origin;
    let cx = x;
    let cy = y;
    let cz = z;
    if (!rocket.core.attached) {
      const pose = stagePose(rocket.core, madd(scale(x, 0.2), z, 0.1));
      at = add(at, pose.offset);
      cx = rotateAbout(x, z, pose.roll * 0.8); cy = rotateAbout(y, z, pose.roll * 0.8); cz = z;
    }
    putInstance(m.core, 0, at, cx, cy, cz, one);
    r.drawLit(m.core, 1);
    stickers = putInstance(m.sticker, stickers, madd(madd(at, cy, 4.4), cz, 1.02), cx, cy, cz, [1.9, 1.9, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [0, PRINT.sticker, 0, 0]);
    if (!rocket.core.attached && rocket.core.age < 3.5) labels.push({ text: 'CORE STAGE (60% OF SUPPLY)', at: madd(madd(at, cy, 4.2), cx, 1.3), colour: '#ff6b86', size: 15 });
  }
  putInstance(m.upper, 0, frame.origin, x, y, z, one);
  putInstance(m.capsule, 0, frame.origin, x, y, z, one);
  putInstance(m.nose, 0, frame.origin, x, y, z, one);
  r.drawLit(m.upper, 1);
  r.drawLit(m.capsule, 1);
  r.drawLit(m.nose, 1);
  stickers = putInstance(m.sticker, stickers, toWorld(frame, 0, 10.6, 0.865), x, y, z, [1.05, 0.66, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [0, PRINT.hopium, 0, 0]);
  for (let k = 0; k < 3; k += 1) {
    const out = outward((k * Math.PI * 2) / 3), px = normalize(cross(y, across(x, z, out)));
    putInstance(m.porthole, k, toWorld(frame, out[0] * 0.79, 14.1, out[2] * 0.79), px, y, cross(px, y), [0.9, 0.9, 0.9], [1, 1, 1, 1], [rocket.panic && k !== 2 ? FACE.crying : CREW_FACES[k]!, 0, 0, 0]);
  }
  r.drawLit(m.porthole, 3);
  for (const holder of rocket.holders) {
    if (holder.state === 'gone') continue;
    const out = outward(holder.theta), hx = normalize(cross(y, across(x, z, out))), s = holder.size;
    if (holder.state === 'cling' || holder.age < 0) {
      // Legs kick in the vertex shader, harder as the tension rises; each holder on their own beat.
      const at = toWorld(frame, out[0] * (0.85 + 0.44 * s), holder.y, out[2] * (0.85 + 0.44 * s));
      clings = putInstance(m.cling, clings, at, hx, y, cross(hx, y), [s, s, s], [1, 1, 1, 1], [holder.face, 0, -flutter, holder.theta * 5 + holder.y]);
      if (holder.label) labels.push({ text: holder.label, at: madd(at, y, 1.2 * s), colour: holder.label === 'WHALE' ? '#8ff0ff' : '#ffd0dc', size: 14 });
      continue;
    }
    const t = holder.age, angle = t * holder.spinRate, f = holder.frame ?? frame, fy = rotateAbout(f.y, holder.spin, angle);
    // Lands on the yard, whichever way up.
    const pos = madd(holder.from, holder.vel, t); pos[1] = Math.max(s * (0.7 - 0.6 * fy[1]), pos[1] - 0.5 * GRAVITY * t * t);
    flails = putInstance(m.flail, flails, pos, rotateAbout(f.x, holder.spin, angle), fy, rotateAbout(f.z, holder.spin, angle), [s, s, s], [1, 1, 1, 1], [rocket.dead ? FACE.crying : holder.face, 0, 0, 0]);
    if (holder.label && t < 2.2) labels.push({ text: `${holder.label} SOLD`, at: add(pos, [0, 0.9 * s, 0]), colour: '#ff6b86', size: 14 });
  }
  let youAt: Vec3 | null = null;
  const you = rocket.you, yo = outward(you.theta), ux = normalize(cross(y, across(x, z, yo)));
  if (you.mode === 'cling') {
    // A spectator's place at the front goes to one more holder.
    const s = spectator ? 0.5 : you.size, at = toWorld(frame, yo[0] * (0.85 + 0.44 * s), you.y, yo[2] * (0.85 + 0.44 * s));
    if (spectator) clings = putInstance(m.cling, clings, at, ux, y, cross(ux, y), [s, s, s], [1, 1, 1, 1], [FACE.doge, 0, -flutter, 1]);
    else drawHero(r, youAt = at, ux, y, cross(ux, y), s, rocket.time, 0, reduced, 1);
  } else if (you.mode === 'eject') {
    const t = you.age, open = clamp((t - 0.45) / 0.35, 0, 1), uz = normalize([(you.frame?.z ?? z)[0], 0, (you.frame?.z ?? z)[2]]), ux = cross([0, 1, 0], uz);
    const swing = reduced ? 0 : Math.sin(t * 2.2) * 0.18 * open * Math.exp(-t * 0.3);
    const sx = rotateAbout(ux, uz, swing), sy = rotateAbout([0, 1, 0], uz, swing);
    drawHero(r, youAt = bailPosition(rocket), sx, sy, uz, you.size, rocket.time, open, reduced, 1 - smoothstep(0.05, 0.35, t));
    if (open > 0) {
      const top = madd(youAt, sy, 2.4), size = 1.6 * open, harness = madd(youAt, sy, 0.9 * you.size);
      putInstance(m.chute, 0, top, sx, sy, uz, [size, size * 0.9, size]);
      r.drawLit(m.chute, 1, 'opaque', 'none');
      let lines = 0;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2, rim = madd(madd(top, sx, Math.cos(a) * size), uz, Math.sin(a) * size), d = sub(harness, rim), ly = normalize(d), lx = normalize(cross(ly, uz));
        lines = putInstance(m.box, lines, madd(rim, d, 0.5), lx, ly, cross(lx, ly), [0.02, Math.hypot(...d), 0.02], [0.9, 0.9, 0.9, 1]);
      }
      r.drawLit(m.box, lines, 'opaque', 'none');
    }
  }
  r.drawLit(m.booster, boosters);
  r.drawLit(m.sticker, stickers, 'opaque', 'none');
  r.drawLit(m.cling, clings);
  r.drawLit(m.flail, flails);
  for (const k of rocket.particles) {
    const life = k.age / k.life;
    if (k.smoke) continue;
    const heat = 1 - life;
    r.sprite(k.p, k.size * (0.7 + life * 0.8), [1, 0.55 + 0.45 * heat, 0.15 + 0.6 * heat * heat, 0.9 * heat], 2, scale(k.v, 0.02));
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

export function heroJoint(root: [number, number], end: [number, number], upper: number, lower: number, side: number): [number, number] {
  const dx = end[0] - root[0], dy = end[1] - root[1], d = Math.hypot(dx, dy);
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return [root[0] + dx / d * along - dy / d * bend, root[1] + dy / d * along + dx / d * bend];
}
/** A limb's root, elbow or knee, and end: `grip` 1 holds the hull, 0 is free, and a bail crouches in between. Elbows bend out, knees forward. */
export function heroLimb(side: number, arm: boolean, size: number, time: number, open: number, reduced: boolean, grip: number) {
  const root: Vec3 = [side * (arm ? 0.24 : 0.12), (arm ? 0.65 : 0.3) + lift(time, reduced, grip), 0], hold = side * (arm ? 0.42 : 0.23);
  const free: Vec3 = arm ? [side * (0.57 - 0.25 * open), 0.82 + 0.3 * open, 0] : [side * (0.23 - open * 0.06), -0.1 + (reduced ? 0 : Math.sin(time * 2 + side) * 0.08 * (1 - grip)), 0];
  const end = lerp3(free, [hold, arm ? 1.05 : -0.1, (Math.sqrt(0.85 ** 2 - (hold * size) ** 2) - 0.85 - 0.44 * size) / size], grip);
  const bone = arm ? 0.4 : 0.36;
  const d = sub(end, root), axis = normalize(d), bend = normalize(cross(axis, arm ? [0, 0, side] : [1, 0, 0]));
  const joint = madd(madd(root, d, 0.5), bend, Math.sqrt(Math.max(0, bone * bone - d.reduce((n, v) => n + v * v, 0) / 4)));
  return { root, joint, end, bone };
}
const lift = (time: number, reduced: boolean, grip: number): number => (reduced ? 0 : Math.sin(time * 2.1) * 0.035) - 0.08 * Math.sin(Math.PI * grip);
function drawHero(r: Renderer, at: Vec3, x: Vec3, y: Vec3, z: Vec3, size: number, time: number, open: number, reduced: boolean, grip: number): void {
  const m = r.meshes;
  const point = (p: Vec3): Vec3 => [0, 1, 2].map(i => at[i]! + size * (x[i]! * p[0] + y[i]! * p[1] + z[i]! * p[2])) as Vec3;
  putInstance(m.hero, 0, point([0, lift(time, reduced, grip), 0]), x, y, z, [size, size, size], [1, 1, 1, 1], [FACE.you, 0, 0, 0]);
  r.drawLit(m.hero, 1);
  let parts = 0;
  const segment = (a: Vec3, b: Vec3, width: number, dark = false) => {
    const start = point(a), end = point(b);
    const d: Vec3 = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
    const ly = normalize(d), lx = normalize(cross(ly, z)), lz = cross(lx, ly);
    parts = putInstance(m.box, parts, madd(start, d, 0.5), lx, ly, lz, [width * size, Math.hypot(...d), width * size], dark ? [0.2, 0.22, 0.26, 1] : [0.93, 0.94, 0.96, 1]);
  };
  for (const side of [-1, 1]) for (const arm of [true, false]) {
    const { root, joint, end } = heroLimb(side, arm, size, time, open, reduced, grip);
    const width = arm ? 0.13 : 0.15;
    segment(root, joint, width); segment(joint, end, width);
    if (!arm) segment(end, [end[0] + side * 0.08, end[1], end[2]], 0.17, true);
  }
  r.drawLit(m.box, parts);
}
