/**
 * The crash, in four beats. Impact: a latex wall stamped SAFU catches the
 * light just ahead of the leaders, the pack piles into it and it bulges.
 * Pull-out: the camera is yanked back down the tunnel into a white-out.
 * Reveal: outside, a knotted condom with the swimmers still wriggling in its
 * tip is dropped at a bin, bounces off the rim and lands on a rug; if you
 * cashed out, your swimmer stands beside it frozen in the sperm bank's vial,
 * wearing shades. Rug pull: the rug goes too, taking the bin over with it.
 * Everything is seeded from the crash point, so a replay falls the same way.
 */
import { FACE } from './atlas';
import { putInstance } from './gl';
import { type Vec3, add, basisFrom, lerp3, madd, normalize, rotateAbout, sub } from './math3d';
import { type Spring, clamp, mulberry32, smoothstep, spring, stepSpring } from './motion';
import type { Label } from './pack';
import { frameAt, tunnelRadius } from './path';
import type { Environment, Renderer } from './render';

/** Seconds from the crash: the pack hits the wall, the pull-out starts, the reveal cuts in. */
export const IMPACT = 0.3;
export const PULL = 1.3;
export const OUTSIDE = 1.9;
/** The condom has landed on the rug; now the rug goes. */
export const RUG_PULL = OUTSIDE + 2.3;
const SETTLED = OUTSIDE + 3.6;

export interface Crash {
  active: boolean;
  age: number;
  wallS: number;
  bulge: Spring;
  hit: boolean;
  banked: boolean;
  minis: { at: Vec3; dir: Vec3; phase: number; size: number }[];
  bokeh: { at: Vec3; size: number; hue: number }[];
}

export function createCrash(): Crash {
  return { active: false, age: 0, wallS: 0, bulge: spring(0), hit: false, banked: false, minis: [], bokeh: [] };
}

export function resetCrash(crash: Crash): void {
  crash.active = false;
  crash.age = 0;
  crash.hit = false;
  crash.bulge = spring(0);
}

/** Starts the crash; `quiet` skips straight to the settled reveal (a crash missed while the tab was hidden). */
export function startCrash(crash: Crash, wallS: number, crashX100: number, banked: boolean, quiet: boolean): void {
  const random = mulberry32(crashX100 * 7919 + 17);
  crash.active = true;
  crash.age = quiet ? SETTLED : 0;
  crash.hit = quiet;
  crash.wallS = wallS;
  crash.banked = banked;
  crash.bulge = spring(0);
  crash.minis = [];
  for (let i = 0; i < 26; i += 1) {
    const z = 3.7 + random() * 1.35;
    const room = z > 4.4 ? 0.52 * Math.cos(((z - 4.4) / 0.6) * Math.PI * 0.5) : 0.5;
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * Math.max(0.05, room - 0.12);
    crash.minis.push({ at: [Math.cos(a) * r, Math.sin(a) * r, z], dir: normalize([random() - 0.5, random() - 0.5, random() - 0.5]), phase: random() * 6.28, size: 0.12 + random() * 0.05 });
  }
  crash.bokeh = [];
  for (let i = 0; i < 26; i += 1) crash.bokeh.push({ at: [-14 + random() * 28, -1 + random() * 11, -9 - random() * 8], size: 0.5 + random() * 1.3, hue: random() });
}

export function stepCrash(crash: Crash, dt: number): void {
  if (!crash.active) return;
  crash.age += dt;
  if (!crash.hit && crash.age >= IMPACT) {
    crash.hit = true;
    crash.bulge.v += 3.2;
  }
  stepSpring(crash.bulge, 0, 9, 0.28, dt);
}

export const outside = (crash: Crash): boolean => crash.active && crash.age >= OUTSIDE;

/** How far back down the tunnel the camera has been yanked. */
export const pullBack = (crash: Crash): number => (crash.active && crash.age > PULL ? 60 * (crash.age - PULL) + 260 * (crash.age - PULL) ** 2 : 0);

/** The white-out either side of the cut. */
export function crashFlash(crash: Crash): number {
  if (!crash.active) return 0;
  if (crash.age < OUTSIDE) return 1.3 * smoothstep(OUTSIDE - 0.35, OUTSIDE, crash.age);
  return 1.3 * Math.max(0, 1 - (crash.age - OUTSIDE) / 0.4);
}

/** The latex wall, seen from inside the tunnel. Drawn after everything opaque. */
export function drawWall(crash: Crash, renderer: Renderer): void {
  if (!crash.active || crash.age >= OUTSIDE) return;
  const f = frameAt(crash.wallS);
  const r = tunnelRadius(crash.wallS) + 1.1;
  const appear = smoothstep(0, 0.14, crash.age);
  const depth = r * (0.5 + Math.max(-0.3, crash.bulge.x) * 0.35);
  putInstance(renderer.meshes.membrane, 0, madd(f.point, f.tangent, -0.3), f.side, f.up, f.tangent, [r, r, depth], [1, 0.72, 0.8, 0.92 * appear], [0, 0, -1, 0.05], [2, 0, 0, 0]);
  renderer.drawLit(renderer.meshes.membrane, 1, 'alpha', 'none');
  if (crash.hit) {
    const k = crash.age - IMPACT;
    renderer.sprite(madd(f.point, f.tangent, 0.2), 1.5 + k * 9, [1, 0.85, 0.9, Math.max(0, 0.8 - k * 1.1)], 1);
    renderer.sprite(madd(f.point, f.tangent, 0.2), 3 + k * 4, [1, 0.6, 0.72, Math.max(0, 0.45 - k * 0.5)], 2);
  }
  renderer.flushSprites('additive');
}

/** The outside world: a warm lamp in a dark room. */
export function outsideEnvironment(): Environment {
  return { fogColor: [0.04, 0.03, 0.08], fogGlow: [0.04, 0.03, 0.08], fogDensity: 0, glowPos: [-6, 6, 4], glowColor: [1, 0.72, 0.5], ambientTop: [0.34, 0.3, 0.46], ambientBottom: [0.1, 0.07, 0.14], lightPos: [4, 7, 9] };
}

/** The reveal's camera: a slow push in on the rug. */
export function outsideCamera(crash: Crash): { eye: Vec3; target: Vec3 } {
  const k = smoothstep(OUTSIDE, SETTLED, crash.age);
  return { eye: lerp3([1, 4, 10.4], [0.9, 3.4, 8.6], k), target: [crash.banked ? -0.7 : 0.2, 1.75, 0.3] };
}

/** 0 before the rug is pulled, rising through the yank. */
const rugPull = (crash: Crash, seconds: number): number => clamp((crash.age - RUG_PULL) / seconds, 0, 1);
export const rugPulled = (crash: Crash): boolean => crash.active && crash.age >= RUG_PULL + 0.12;

const BIN_AT: Vec3 = [-1, 0, -0.9];
const BIN_SCALE = 0.85;

/** Where the condom is and which way it points: dropped at the bin, off the rim, onto the rug; then the rug goes. */
function condomPose(crash: Crash): { at: Vec3; axes: [Vec3, Vec3, Vec3] } {
  const t = Math.max(0, crash.age - OUTSIDE);
  const drop: Vec3 = [-1.2, 9.5, -0.9];
  const rim: Vec3 = [-0.25, 2.5, -0.45];
  const rest: Vec3 = [1.2, 0.47, 1.1];
  let at: Vec3;
  if (t < 0.62) {
    const k = t / 0.62;
    at = lerp3(drop, rim, k * k);
  } else if (t < 1.3) {
    const k = (t - 0.62) / 0.68;
    at = lerp3(rim, rest, k);
    at[1] += Math.sin(k * Math.PI) * 1.1;
  } else {
    at = [rest[0], rest[1] + Math.abs(Math.sin((t - 1.3) * 10)) * 0.28 * Math.exp(-(t - 1.3) * 5), rest[2]];
  }
  const hop = rugPull(crash, 0.6);
  at[0] -= 0.9 * smoothstep(0, 1, hop);
  at[1] += 0.75 * Math.sin(Math.PI * hop);
  const [x, yAxis, z] = basisFrom(normalize([1, 0.02, -0.42]), [0, 1, 0]);
  const settle = smoothstep(0, 1.45, t);
  const tumble = (1 - settle) * Math.PI * 3.2;
  const spin = (1 - settle) * 2.4;
  const roll = smoothstep(0, 1, hop) * Math.PI * 2;
  const axes = [x, yAxis, z].map((v) => rotateAbout(rotateAbout(rotateAbout(v, z, roll), [0, 0, 1], tumble), [0, 1, 0], spin)) as [Vec3, Vec3, Vec3];
  return { at, axes };
}

/** Draws the reveal and adds its labels. */
export function drawOutside(crash: Crash, renderer: Renderer, time: number, labels: Label[]): void {
  const m = renderer.meshes;
  renderer.drawBackdrop([0.12, 0.07, 0.22], [0.03, 0.02, 0.06], [0.55, 0.34, 0.2], [0.16, 0.78]);
  putInstance(m.sphere, 0, [0, -0.06, -6], [1, 0, 0], [0, 1, 0], [0, 0, 1], [40, 0.05, 26], [0.22, 0.13, 0.1, 1], [0, 0, -1, 0]);
  renderer.drawLit(m.sphere, 1);
  // The rug, until it is pulled.
  const yank = rugPull(crash, 0.45);
  if (yank < 1) {
    putInstance(m.rug, 0, [0.2 - 18 * yank * yank, 0, 0.3], [1, 0, 0], [0, 1, 0], [0, 0, 1], [3.9, 1, 2.9], [1, 1, 1, 1], [0, 0, -1, 0]);
    renderer.drawLit(m.rug, 1, 'opaque', 'none');
  }
  // The bin, dragged and tipped over by the yank.
  const tip = rugPull(crash, 0.7);
  const drag = -0.35 * smoothstep(0, 0.4, tip);
  const angle = -(Math.PI / 2) * smoothstep(0.1, 0.8, tip) + 0.08 * Math.sin(tip * 18) * smoothstep(0.75, 1, tip) * (1 - tip);
  const pivot: Vec3 = [BIN_AT[0] + drag + 1.05 * BIN_SCALE, 0, BIN_AT[2]];
  const binAt = add(pivot, rotateAbout(sub([BIN_AT[0] + drag, 0, BIN_AT[2]], pivot), [0, 0, 1], angle));
  putInstance(m.bin, 0, binAt, rotateAbout([1, 0, 0], [0, 0, 1], angle), rotateAbout([0, 1, 0], [0, 0, 1], angle), [0, 0, 1], [BIN_SCALE, BIN_SCALE, BIN_SCALE], [1, 1, 1, 1], [0, 0, -1, 0]);
  renderer.drawLit(m.bin, 1, 'opaque', 'none');

  const pose = condomPose(crash);
  const [cx, cy, cz] = pose.axes;
  const scale = 0.7;
  const local = (p: Vec3): Vec3 => add(pose.at, add(add([cx[0] * p[0] * scale, cx[1] * p[0] * scale, cx[2] * p[0] * scale], [cy[0] * p[1] * scale, cy[1] * p[1] * scale, cy[2] * p[1] * scale]), [cz[0] * p[2] * scale, cz[1] * p[2] * scale, cz[2] * p[2] * scale]));
  let n = 0;
  for (const mini of crash.minis) {
    const wiggle = Math.sin(time * 3 + mini.phase) * 0.06;
    const at = local([mini.at[0] + wiggle, mini.at[1], mini.at[2]]);
    const dir = normalize(add(add([cx[0] * mini.dir[0], cx[1] * mini.dir[0], cx[2] * mini.dir[0]], [cy[0] * mini.dir[1], cy[1] * mini.dir[1], cy[2] * mini.dir[1]]), [cz[0] * mini.dir[2], cz[1] * mini.dir[2], cz[2] * mini.dir[2]]));
    const [bx, by, bz] = basisFrom(dir, [0, 1, 0], mini.phase);
    putInstance(m.swimmer, n, at, bx, by, bz, [mini.size, mini.size, mini.size], [1, 0.95, 0.92, 1], [time * 14 + mini.phase, 0.3, FACE.crying, 0.1]);
    n += 1;
  }

  // Your frozen swimmer, if you got out: standing in the vial with shades on.
  let vialAt: Vec3 | null = null;
  let vialAxes: [Vec3, Vec3, Vec3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (crash.banked) {
    vialAt = [-2, 0, 1.9];
    const wobble = 0.18 * Math.sin(tip * 14) * (1 - tip) * (tip > 0 ? 1 : 0);
    vialAxes = [rotateAbout([1, 0, 0], [0, 0, 1], wobble), rotateAbout([0, 1, 0], [0, 0, 1], wobble), [0, 0, 1]];
    const cam = outsideCamera(crash).eye;
    // Upright in the tube, tipped toward the camera so the shades show.
    const toCam = normalize(sub(cam, add(vialAt, [0, 1.5, 0])));
    const facing = normalize([toCam[0] * 0.45, toCam[1] * 0.45 + 1, toCam[2] * 0.45]);
    const [bx, by, bz] = basisFrom(facing, [0, 1, 0]);
    const at = add(vialAt, madd([0, 0, 0], vialAxes[1], 1.5));
    putInstance(m.swimmer, n, at, bx, by, bz, [0.78, 0.78, 0.78], [0.82, 0.92, 1, 1], [0, 0, FACE.you, 0.18]);
    n += 1;
    putInstance(m.shades, 0, madd(at, bz, 0.02), bx, by, bz, [0.78, 0.78, 0.78], [1, 1, 1, 1], [0, 0, -1, 0]);
    renderer.drawLit(m.shades, 1);
  }
  renderer.drawLit(m.swimmer, n);
  putInstance(m.condom, 0, pose.at, cx, cy, cz, [scale, scale, scale], [1, 0.7, 0.8, 0.9], [0, 0, -1, 0.04], [2, 0, 0, 1]);
  renderer.drawLit(m.condom, 1, 'alpha', 'front');
  renderer.drawLit(m.condom, 1, 'alpha', 'back');
  if (vialAt) {
    const [vx, vy, vz] = vialAxes;
    putInstance(m.vialCap, 0, vialAt, vx, vy, vz, [1.2, 1.2, 1.2], [1, 1, 1, 1], [0, 0, -1, 0]);
    renderer.drawLit(m.vialCap, 1);
    putInstance(m.vialGlass, 0, vialAt, vx, vy, vz, [1.2, 1.2, 1.2], [0.8, 0.92, 1, 0.9], [0, 0, -1, 0], [3, 0, 0, 0]);
    renderer.drawLit(m.vialGlass, 1, 'alpha', 'front');
    renderer.drawLit(m.vialGlass, 1, 'alpha', 'back');
    for (let i = 0; i < 14; i += 1) {
      const a = time * 0.6 + i * 0.9;
      renderer.sprite(add(vialAt, [Math.cos(a) * 0.78, 0.4 + ((i * 0.37 + time * 0.25) % 2.9), Math.sin(a) * 0.78]), 0.07 + 0.04 * Math.sin(time * 5 + i), [0.75, 0.95, 1, 0.9], 0);
    }
    labels.push({ text: 'SPERM BANK', at: add(vialAt, [0, 3.9, 0]), colour: '#8ff0ff', size: 22, far: true });
  }
  for (const b of crash.bokeh) renderer.sprite(b.at, b.size, [1, 0.6 + b.hue * 0.3, 0.4 + b.hue * 0.3, 0.12], 2);
  renderer.flushSprites('additive', 0);
}
