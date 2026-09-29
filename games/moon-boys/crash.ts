/**
 * The crash, in beats. In flight: a wire snaps, the engines die, everyone
 * lets go and the rocket tumbles while the studio lights come up into a
 * white-out. Then the cut to the soundstage: a model rocket on a crash mat
 * under its wires, the moon a plywood prop on a stand, the earth a painted
 * floor cloth, three studio lights, the dev (a lizard) in the director's
 * chair, and the clapperboard that snaps shut. CUT. The moon prop tips over
 * and shows its back. The dev leaves on a golf cart with the bag, dragging
 * the earth away by its corner: the rug pull. The crew climb onto the fallen
 * moon and raise the WAGMI flag: a community takeover. If you bailed, you
 * stand by the exit with your chute and your bag. Seeded from the crash
 * point, so a replay falls the same way.
 */
import { FACE, PRINT } from './atlas';
import { putInstance } from './gl';
import type { Label } from './hud';
import { type Vec3, add, cross, lerp3, madd, normalize, rotateAbout, sub } from './math3d';
import { type Spring, clamp, mulberry32, smoothstep, spring, stepSpring } from './motion';
import type { Environment, Renderer } from './render';

/** Seconds from the crash: the wire snaps, the cut to the studio, the clapper, the moon tips, the rug, the flag. */
export const SNAP = 0.25;
export const CUT = 1.9;
export const CLAP = CUT + 0.35;
export const MOONED = CUT + 1.6;
export const RUG = CUT + 2.8;
export const CTO = CUT + 4.0;
export const SETTLED = CUT + 5.2;

export interface Crash {
  active: boolean;
  age: number;
  snapped: boolean;
  banked: boolean;
  /** Never left the pad: a 1.00× crash. */
  failed: boolean;
  /** What was still attached when the wire went, so the wreck matches. */
  boosters: boolean;
  core: boolean;
  stars: { x: number; y: number; size: number }[];
  heap: { at: Vec3; spin: number; lean: number; face: number; size: number }[];
  clap: Spring;
  tip: Spring;
}

export function createCrash(): Crash {
  return { active: false, age: 0, snapped: false, banked: false, failed: false, boosters: false, core: false, stars: [], heap: [], clap: spring(0), tip: spring(0) };
}

export function resetCrash(crash: Crash): void {
  crash.active = false;
  crash.age = 0;
  crash.snapped = false;
  crash.clap = spring(0);
  crash.tip = spring(0);
}

/** Starts the crash; `quiet` skips straight to the settled studio (a crash missed while the tab was hidden). */
export function startCrash(crash: Crash, crashX100: number, banked: boolean, quiet: boolean, stages: { boosters: boolean; core: boolean }): void {
  const random = mulberry32(crashX100 * 7919 + 42);
  crash.active = true;
  crash.age = quiet ? SETTLED : 0;
  crash.snapped = quiet;
  crash.banked = banked;
  crash.failed = crashX100 < 105;
  crash.boosters = stages.boosters;
  crash.core = stages.core;
  crash.clap = spring(quiet ? 1 : 0);
  crash.tip = spring(quiet ? 1 : 0);
  crash.stars = [];
  for (let i = 0; i < 150; i += 1) crash.stars.push({ x: -17 + random() * 34, y: 0.4 + random() * 15, size: 0.05 + random() * 0.12 });
  crash.heap = [];
  const faces = [FACE.crying, FACE.wojak, FACE.crying, FACE.soy, FACE.crying, FACE.doge];
  for (let i = 0; i < 11; i += 1) crash.heap.push({ at: [-3.2 + random() * 6.2, 0.78 + random() * 0.25, 0.4 + random() * 3.2], spin: random() * Math.PI * 2, lean: 1.2 + random() * 0.5, face: faces[i % faces.length]!, size: 0.34 + random() * 0.08 });
}

export function stepCrash(crash: Crash, dt: number): void {
  if (!crash.active) return;
  crash.age += dt;
  stepSpring(crash.clap, crash.age >= CLAP ? 1 : 0, 34, 0.5, dt);
  stepSpring(crash.tip, crash.age >= MOONED ? 1 : 0, 6.5, 0.32, dt);
}

export const outside = (crash: Crash): boolean => crash.active && crash.age >= CUT;
export const mooned = (crash: Crash): boolean => crash.active && crash.age >= MOONED + 0.45;
export const rugPulled = (crash: Crash): boolean => crash.active && crash.age >= RUG + 0.3;
export const ctoUp = (crash: Crash): boolean => crash.active && crash.age >= CTO + 1.1;

/** The white-out either side of the cut: the studio lights coming up. */
export function crashFlash(crash: Crash): number {
  if (!crash.active) return 0;
  if (crash.age < CUT) return 1.3 * smoothstep(CUT - 0.4, CUT, crash.age);
  return 1.3 * Math.max(0, 1 - (crash.age - CUT) / 0.45);
}

/** The reveal's camera: a slow push in on the mat. */
export function studioCamera(crash: Crash): { eye: Vec3; target: Vec3 } {
  const k = smoothstep(CUT, SETTLED + 2, crash.age);
  return { eye: lerp3([2, 12.5, 24], [1.4, 11, 20.5], k), target: [-1, 1.8, -1.5] };
}

/** The studio: dark walls, hot lamps. */
export function studioEnvironment(flash: number): Environment {
  return { fogColor: [0.05, 0.05, 0.06], fogDensity: 0, sunDir: normalize([0.3, 0.8, 0.5]), sunColor: [0.85, 0.82, 0.78], ambientTop: [0.34, 0.32, 0.38], ambientBottom: [0.12, 0.11, 0.13], pointPos: [-9, 5.5, 4], pointColor: [0.9, 0.8, 0.6], flash };
}

const turned = (angle: number): [Vec3, Vec3, Vec3] => [rotateAbout([1, 0, 0], [0, 1, 0], angle), [0, 1, 0], rotateAbout([0, 0, 1], [0, 1, 0], angle)];
const ID: [Vec3, Vec3, Vec3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Draws the soundstage and adds its labels. */
export function drawStudio(crash: Crash, renderer: Renderer, time: number, labels: Label[], reduced: boolean): void {
  const r = renderer;
  const m = r.meshes;
  const t = crash.age;
  let boxes = 0;
  let discs = 0;
  let stickers = 0;
  let stands = 0;
  let flails = 0;
  let lamps = 0;
  let bags = 0;
  const box = (at: Vec3, scale: [number, number, number], colour: [number, number, number, number], axes: [Vec3, Vec3, Vec3] = ID, params: number[] = [-1, 0, 0, 0], more: number[] = [0, 0, 0, 0]) => { boxes = putInstance(m.box, boxes, at, axes[0], axes[1], axes[2], scale, colour, params, more); };
  // Floor, back wall, sign.
  box([0, -0.5, 0], [90, 1, 70], [0.24, 0.23, 0.25, 1]);
  box([0, 11, -22.5], [90, 22, 1], [0.3, 0.29, 0.32, 1]);
  stickers = putInstance(m.sticker, stickers, [0, 13, -21.9], ID[0], ID[1], ID[2], [11, 4.6, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [0, PRINT.sign, 0, 0]);
  // The cyclorama with the stars painted on, toppling backward off its hinge.
  const fallen = smoothstep(CUT + 0.5, CUT + 2.1, t) * 1.45;
  const cy: Vec3 = [0, Math.cos(fallen), -Math.sin(fallen)];
  const cz: Vec3 = [0, Math.sin(fallen), Math.cos(fallen)];
  box(add([0, 0, -16], [cy[0] * 8, cy[1] * 8, cy[2] * 8]), [34, 16, 0.2], [0.03, 0.03, 0.09, 1], [[1, 0, 0], cy, cz]);
  for (const star of crash.stars) r.sprite(add([star.x, 0, -15.85], [cy[0] * star.y, cy[1] * star.y, cy[2] * star.y]), star.size, [1, 1, 1, 0.9], 3);
  // The earth: a floor cloth, dragged off by its corner once the rug goes.
  const drag = 40 * smoothstep(0, 2.2, t - RUG - 0.3);
  const rugAt: Vec3 = [1.2 + drag, 0.02, 2.2];
  putInstance(m.earth, 0, rugAt, ID[0], ID[1], ID[2], [5, 0.6, 5], [1, 1, 1, 1], [-1, 0, 0, 0], [1, 0, 0, 0]);
  r.drawLit(m.earth, 1, 'opaque', 'none');
  if (t > RUG && drag < 30) labels.push({ text: 'RUG', at: add(rugAt, [0, 0.4, 3]), colour: '#ff4d6d', size: 22, far: true });
  // The crash mat and the wreck on it.
  box([-0.2, 0.34, 2], [7, 0.68, 5], [0.15, 0.3, 0.7, 1]);
  const wy = normalize([0.75, 0.14, 0.65]);
  const wx = normalize(cross([0, 1, 0], wy));
  const wz = cross(wx, wy);
  const wreckAt: Vec3 = [-2.4, 1.05, 0.6];
  const ws = 0.35;
  if (crash.core) {
    putInstance(m.core, 0, wreckAt, wx, wy, wz, [ws, ws, ws]);
    r.drawLit(m.core, 1);
    if (crash.boosters) {
      let boosters = 0;
      for (let k = 0; k < 4; k += 1) {
        const a = (k * Math.PI) / 2;
        const off = add([wx[0] * Math.cos(a), wx[1] * Math.cos(a), wx[2] * Math.cos(a)], [wz[0] * Math.sin(a), wz[1] * Math.sin(a), wz[2] * Math.sin(a)]);
        boosters = putInstance(m.booster, boosters, madd(wreckAt, off, 1.55 * ws), wx, wy, wz, [ws, ws, ws]);
      }
      r.drawLit(m.booster, boosters);
    }
  }
  putInstance(m.upper, 0, wreckAt, wx, wy, wz, [ws, ws, ws]);
  putInstance(m.capsule, 0, wreckAt, wx, wy, wz, [ws, ws, ws]);
  putInstance(m.nose, 0, wreckAt, wx, wy, wz, [ws, ws, ws]);
  r.drawLit(m.upper, 1);
  r.drawLit(m.capsule, 1);
  r.drawLit(m.nose, 1);
  const nose = madd(wreckAt, wy, 17.3 * ws);
  // The wires: one still on the nose, slack; the snapped one swinging beside it.
  const wireTop: Vec3 = [nose[0], 30, nose[2]];
  const hang = (from: Vec3, to: Vec3, colour: [number, number, number, number]) => {
    const d = sub(to, from);
    const len = Math.hypot(d[0], d[1], d[2]);
    const y = normalize(d);
    const x = normalize(cross(y, [0, 0, 1]));
    box(madd(from, d, 0.5), [0.03, len, 0.03], colour, [x, y, cross(x, y)], [-1, 0.2, 0, 0]);
  };
  hang(wireTop, madd(nose, [0.6, 0, 0.3], Math.sin(t) * 0.2), [0.92, 0.93, 0.98, 1]);
  const swing = Math.sin(t * 2.2) * 1.4 * Math.exp(-(t - CUT) * 0.25);
  hang([nose[0] - 1.2, 30, nose[2]], [nose[0] - 1.2 + swing, 3.2, nose[2] + swing * 0.5], [0.92, 0.93, 0.98, 1]);
  labels.push({ text: 'WIRES (BUDGET: ONE)', at: [nose[0] - 0.4, 4.3, nose[2]], colour: '#ffd24a', size: 15, far: true });
  // The crew on the mat's edge, the heap of holders behind them, and the two who go and take the moon.
  const crewFaces = [FACE.pepe, FACE.wojak, FACE.doge, FACE.chad];
  const walk = smoothstep(CTO, CTO + 1.1, t);
  const fallenMoon: Vec3 = [-7, 0.34, -2.4];
  for (let i = 0; i < 4; i += 1) {
    const spot: Vec3 = [-3.6 + i * 0.75, 0.68, 4.4];
    const goal: Vec3 = i === 0 ? [fallenMoon[0] - 0.9, fallenMoon[1], fallenMoon[2] + 0.4] : [fallenMoon[0] + 0.9, fallenMoon[1], fallenMoon[2] + 0.1];
    const at = i < 2 ? lerp3(spot, goal, walk) : spot;
    const hop = i < 2 && walk > 0 && walk < 1 ? Math.abs(Math.sin(walk * Math.PI * 5)) * 0.18 : 0;
    stands = putInstance(m.stand, stands, [at[0], at[1] + hop, at[2]], ID[0], ID[1], ID[2], [0.38, 0.38, 0.38], [1, 1, 1, 1], [crewFaces[i]!, 0, 0, 0]);
  }
  labels.push({ text: 'THE CREW', at: [-2.5, 1.35, 4.4], colour: '#ffd0dc', size: 13 });
  for (const h of crash.heap) {
    const hx = rotateAbout([1, 0, 0], [0, 1, 0], h.spin);
    const hz = rotateAbout([0, 0, 1], [0, 1, 0], h.spin);
    const axis = hx;
    flails = putInstance(m.flail, flails, h.at, hx, rotateAbout([0, 1, 0], axis, h.lean), rotateAbout(hz, axis, h.lean), [h.size, h.size, h.size], [1, 1, 1, 1], [h.face, 0, 0, 0]);
  }
  // Three still holding the earth: they go with it.
  for (const [ox, oz, a] of [[-1.6, 0.6, 0.4], [0.9, -1.3, 2.2], [1.7, 1.5, 4]] as const) {
    const hx = rotateAbout([1, 0, 0], [0, 1, 0], a);
    const hz = rotateAbout([0, 0, 1], [0, 1, 0], a);
    flails = putInstance(m.flail, flails, [rugAt[0] + ox, 0.16, rugAt[2] + oz], hx, rotateAbout([0, 1, 0], hx, 1.5), rotateAbout(hz, hx, 1.5), [0.36, 0.36, 0.36], [1, 1, 1, 1], [FACE.crying, 0, 0, 0]);
  }
  if (drag > 0.5 && drag < 32) labels.push({ text: 'STILL HOLDING', at: [rugAt[0] + 0.5, 1.1, rugAt[2] + 1.5], colour: '#ff6b86', size: 15, far: true });
  // The moon prop on its stand; it tips toward the camera and lands face down.
  const tip = clamp(crash.tip.x, 0, 1);
  const hopUp = Math.max(0, crash.tip.x - 1) * 1.2;
  const moonBase: Vec3 = [-7, 0.1, -6];
  const angle = tip * (Math.PI / 2);
  const my: Vec3 = [0, -Math.sin(angle), Math.cos(angle)];
  const mz: Vec3 = [0, -Math.cos(angle), -Math.sin(angle)];
  const mx: Vec3 = [1, 0, 0];
  const moonAt: Vec3 = [moonBase[0], moonBase[1] + 3.6 * Math.cos(angle) + hopUp, moonBase[2] + 3.6 * Math.sin(angle)];
  putInstance(m.moon, 0, moonAt, mx, my, mz, [3.6, 3.6, 3.6], [1, 1, 1, 1], [-1, 0, 0, 0], [1, 0, 0, 0]);
  r.drawLit(m.moon, 1, 'opaque', 'none');
  // Its face: shocked, until it is face down.
  if (tip < 0.98) {
    const ex = mx;
    const ey: Vec3 = [-mz[0], -mz[1], -mz[2]];
    const ez = my;
    const onFace = (x: number, z: number, lift: number): Vec3 => add(add(moonAt, [mx[0] * x * 3.6, mx[1] * x * 3.6, mx[2] * x * 3.6]), add([mz[0] * z * 3.6, mz[1] * z * 3.6, mz[2] * z * 3.6], [my[0] * lift * 3.6, my[1] * lift * 3.6, my[2] * lift * 3.6]));
    for (const side of [-1, 1]) {
      discs = putInstance(m.disc, discs, onFace(side * 0.3, -0.16, 0.012), ex, ey, ez, [0.5, 0.58, 1], [1, 1, 1, 1], [-1, 0.1, 0, 0], [1, 0, 0, 0]);
      discs = putInstance(m.disc, discs, onFace(side * 0.3, -0.12, 0.014), ex, ey, ez, [0.22, 0.25, 1], [0.08, 0.06, 0.1, 1], [-1, 0, 0, 0], [1, 0, 0, 0]);
    }
    stickers = putInstance(m.sticker, stickers, onFace(0, 0.34, 0.012), ex, ey, ez, [2.5, 1.25, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [1, PRINT.gawp, 1, 0]);
  }
  for (const s of [-1, 1]) box([moonBase[0] + s * 1.9, 2.0, moonBase[2] - 0.7], [0.14, 4.2, 0.14], [0.55, 0.42, 0.3, 1], [rotateAbout([1, 0, 0], [0, 0, 1], -s * 0.28), rotateAbout([0, 1, 0], [0, 0, 1], -s * 0.28), [0, 0, 1]]);
  box([moonBase[0], 2.8, moonBase[2] - 0.7], [3.6, 0.12, 0.12], [0.55, 0.42, 0.3, 1]);
  if (t < MOONED) labels.push({ text: 'THE MOON (PLYWOOD)', at: [moonBase[0], 0.9, moonBase[2] + 0.3], colour: '#ffe27a', size: 18, far: true });
  // The WAGMI flag goes up on the fallen moon.
  const flagUp = smoothstep(CTO + 1.1, CTO + 1.9, t);
  if (flagUp > 0) {
    const pole = 3.4 * flagUp;
    box([fallenMoon[0], fallenMoon[1] + pole / 2, fallenMoon[2]], [0.06, pole, 0.06], [0.75, 0.75, 0.8, 1]);
    putInstance(m.flag, 0, [fallenMoon[0] + 0.03, fallenMoon[1] + pole - 0.55, fallenMoon[2]], ID[0], ID[1], ID[2], [1.2 * flagUp, 1.05 * flagUp, 1], [1, 1, 1, 1], [-1, 0, reduced ? 0 : 0.28, 0]);
    r.drawLit(m.flag, 1, 'opaque', 'none');
    if (flagUp > 0.9) labels.push({ text: 'CTO · THE MOON IS OURS NOW', at: [fallenMoon[0], fallenMoon[1] + pole + 0.9, fallenMoon[2]], colour: '#86efac', size: 17, far: true });
  }
  // The lights on their stands, one of them the key, with a lens that glows.
  const lights: [Vec3, Vec3][] = [[[-12.5, 6, 4.5], [-1, 1.2, 2]], [[12.5, 6.5, 2.5], [-1, 1.2, 2]], [[6.5, 8, -12], [-1, 1.2, 0]]];
  for (const [at, target] of lights) {
    box([at[0], at[1] / 2, at[2]], [0.12, at[1], 0.12], [0.2, 0.2, 0.22, 1]);
    box([at[0], 0.06, at[2]], [1.3, 0.12, 1.3], [0.2, 0.2, 0.22, 1]);
    const lz = normalize(sub(target, at));
    const lx = normalize(cross([0, 1, 0], lz));
    const ly = cross(lz, lx);
    lamps = putInstance(m.lamp, lamps, at, lx, ly, lz, [1.3, 1.3, 1.3]);
    discs = putInstance(m.disc, discs, madd(at, lz, 0.02), lx, ly, lz, [0.8, 0.8, 1], [1, 0.96, 0.85, 1], [-1, 0.6, 0, 0], [2, 0, 0, 0]);
    r.sprite(madd(at, lz, 0.3), 2.6, [1, 0.9, 0.7, 0.35], 2);
  }
  // The director's chair, and the dev in it until the cart leaves.
  const chairAt: Vec3 = [7.6, 0, -2];
  const [cx, cyy, czz] = turned(-0.55);
  putInstance(m.chair, 0, chairAt, cx, cyy, czz, [1.1, 1.1, 1.1]);
  r.drawLit(m.chair, 1, 'opaque', 'none');
  const cartTravel = 42 * smoothstep(0, 2.4, t - RUG);
  const cartAt: Vec3 = [10.8 + cartTravel, 0, 3.6];
  const [kx, ky, kz] = turned(Math.PI / 2);
  putInstance(m.cart, 0, cartAt, kx, ky, kz, [1.1, 1.1, 1.1]);
  r.drawLit(m.cart, 1);
  const bagAt: Vec3 = [cartAt[0] - 1.7, 0.95, cartAt[2]];
  bags = putInstance(m.bag, bags, bagAt, ID[0], ID[1], ID[2], [1.1, 1.1, 1.1]);
  if (cartTravel < 20) labels.push({ text: 'THE BAG', at: add(bagAt, [0, 1.5, 0]), colour: '#ffd24a', size: 16 });
  // The rope from the cart to the earth's corner.
  if (t > RUG - 0.2 && drag < 38) {
    const from: Vec3 = [cartAt[0] - 2.2, 0.5, cartAt[2]];
    const to: Vec3 = [rugAt[0] + 4.6, 0.1, rugAt[2] + 1.2];
    const d = sub(to, from);
    const len = Math.hypot(d[0], d[1], d[2]);
    const y = normalize(d);
    const x = normalize(cross(y, [0, 1, 0]));
    box(madd(from, d, 0.5), [0.05, len, 0.05], [0.8, 0.7, 0.5, 1], [x, y, cross(x, y)]);
  }
  const hop = clamp((t - (RUG - 0.55)) / 0.55, 0, 1);
  const seat = add(chairAt, [cx[0] * 0 + czz[0] * 0.05, 1.05, czz[2] * 0.05]);
  const ride: Vec3 = [cartAt[0] - 0.1, 1.0, cartAt[2]];
  const lizardAt = lerp3(seat, ride, hop);
  lizardAt[1] += Math.sin(hop * Math.PI) * 1.4;
  const [lx, ly, lz] = hop < 0.5 ? [cx, cyy, czz] : [kx, ky, kz];
  putInstance(m.lizard, 0, lizardAt, lx, ly, lz, [1.1, 1.1, 1.1], [1, 1, 1, 1], [FACE.lizard, 0, 0, 0]);
  r.drawLit(m.lizard, 1);
  if (cartTravel < 24) labels.push({ text: hop > 0.5 ? 'DEV (LEAVING)' : 'DEV', at: add(lizardAt, [0, 1.9, 0]), colour: '#c9f76b', size: 16 });
  // The clapperboard in the foreground, on its stand; the stick snaps shut.
  const clapAt: Vec3 = [-5.8, 3.3, 7.6];
  const [bx, by, bz] = turned(0.4);
  putInstance(m.clapper, 0, clapAt, bx, by, bz, [1.4, 1.4, 1.4]);
  r.drawLit(m.clapper, 1);
  const open = 0.55 * (1 - clamp(crash.clap.x, 0, 1.15));
  const hinge = add(add(clapAt, [bx[0] * -0.91, bx[1] * -0.91, bx[2] * -0.91]), [by[0] * 0.7, by[1] * 0.7, by[2] * 0.7]);
  putInstance(m.stick, 0, madd(hinge, bz, 0.06), rotateAbout(bx, bz, open), rotateAbout(by, bz, open), bz, [1.4, 1.4, 1.4]);
  r.drawLit(m.stick, 1);
  box([clapAt[0], 1.3, clapAt[2]], [0.08, 2.6, 0.08], [0.2, 0.2, 0.22, 1]);
  box([clapAt[0], 0.06, clapAt[2]], [1.1, 0.12, 1.1], [0.2, 0.2, 0.22, 1]);
  // The exit, and you beside it if you got out.
  box([-17, 2.4, -13], [2.4, 4.8, 0.3], [0.35, 0.33, 0.3, 1]);
  stickers = putInstance(m.sticker, stickers, [-17, 5.6, -12.8], ID[0], ID[1], ID[2], [2.6, 1.18, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [0, PRINT.exit, 0, 0]);
  if (crash.banked) {
    const youAt: Vec3 = [5.4, 0, 9.2];
    stands = putInstance(m.stand, stands, youAt, ID[0], ID[1], ID[2], [0.4, 0.4, 0.4], [1, 1, 1, 1], [FACE.you, 0, 0, 0]);
    let spheres = 0;
    spheres = putInstance(m.sphere, spheres, [5.95, 0.24, 9.3], ID[0], ID[1], ID[2], [0.26, 0.2, 0.26], [0.78, 0.95, 0.42, 1]);
    r.drawLit(m.sphere, spheres);
    bags = putInstance(m.bag, bags, [4.85, 0, 9.35], ID[0], ID[1], ID[2], [0.45, 0.45, 0.45]);
    labels.push({ text: 'CALLED IT', at: [5.4, 1.0, 9.2], colour: '#8ff0ff', size: 22 });
  }
  // Craft services.
  box([13.8, 1.0, -7.5], [3.2, 0.12, 1.3], [0.5, 0.36, 0.22, 1]);
  for (const [ox, oz] of [[-1.4, -0.5], [1.4, -0.5], [-1.4, 0.5], [1.4, 0.5]] as const) box([13.8 + ox, 0.5, -7.5 + oz], [0.08, 1, 0.08], [0.3, 0.22, 0.14, 1]);
  for (let i = 0; i < 6; i += 1) box([12.6 + i * 0.5, 1.15, -7.7 + (i % 2) * 0.4], [0.32, 0.16, 0.32], i % 3 === 0 ? [0.95, 0.5, 0.6, 1] : i % 3 === 1 ? [0.55, 0.32, 0.18, 1] : [0.95, 0.85, 0.5, 1]);
  labels.push({ text: 'CRAFT SERVICES', at: [13.8, 1.9, -7.5], colour: '#c9d2e6', size: 13, far: true });
  // The SEC's bird, perched on the back light.
  putInstance(m.bird, 0, [6.5, 8.45, -12], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0.9, 0.9, 0.9]);
  r.drawLit(m.bird, 1);
  // Smoke off the wreck.
  for (let i = 0; i < (reduced ? 4 : 9); i += 1) {
    const age = ((time * 0.5 + i * 0.37) % 1.8);
    r.sprite(add(wreckAt, [Math.sin(i * 2.3) * 0.4, age * 1.6, Math.cos(i * 1.7) * 0.4]), 0.35 + age * 0.9, [0.6, 0.6, 0.64, 0.25 * (1 - age / 1.8)], 0);
  }
  r.drawLit(m.box, boxes);
  r.drawLit(m.disc, discs, 'opaque', 'none');
  r.drawLit(m.sticker, stickers, 'alpha', 'none');
  r.drawLit(m.stand, stands);
  r.drawLit(m.flail, flails);
  r.drawLit(m.lamp, lamps);
  r.drawLit(m.bag, bags);
  r.flushSprites('alpha');
}
