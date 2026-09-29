/**
 * The set. The launch site in mom's backyard (the pad, the tower, the
 * trailer with its dish, the dog house, the pool, mom at the door), the flat
 * earth the backyard sits on, the sky and the sun, and the moon: a painted
 * disc that always faces the camera and grows as the multiplier climbs, with
 * eyes that open at 2.4×, follow the rocket, blink, wink at 6.9× and sweat
 * past 10×. The oddities that come out at the rungs are drawn here too: the
 * boom mic that dips into frame, the stagehand's glove that nudges the moon,
 * the SEC's bird, and the wires above the nose.
 */
import { PRINT, FACE } from './atlas';
import { putInstance } from './gl';
import type { Label } from './hud';
import { type Vec3, add, cross, madd, normalize, rotateAbout, sub } from './math3d';
import { type Spring, clamp, mulberry32, smoothstep, spring, stepSpring } from './motion';
import type { Environment, Renderer } from './render';

export const EARTH_RADIUS = 220;
export const MOON_RADIUS = 40;
const MOON_FAR = 800;
/** Up and away from the camera, which keeps to +z. */
export const MOON_DIR: Vec3 = normalize([-0.06, 0.36, -0.93]);
export const SUN_DIR: Vec3 = normalize([0.45, 0.55, 0.35]);
/** The multipliers at which the moon opens its eyes and winks, the mic dips, the wires show, the bird passes, the glove pushes. */
export const EYES_AT = 2.4;
export const WINK_AT = 6.9;
export const MIC_AT = [3.3, 8, 15, 30, 60];
export const WIRES_AT = 4.2;
export const BIRD_AT = [4.6, 9.2, 18.4, 36.8];
export const GLOVE_AT = 5.5;
export const SWEAT_AT = 10;
export const FLAT_AT = 1.8;

interface Gag { active: boolean; age: number; fired: number }
interface Drop { x: number; y: number; vy: number; age: number }

export interface World {
  /** The moon's eyes: 0 shut, 1 open. */
  eyes: Spring;
  blink: number;
  wink: number;
  look: [Spring, Spring];
  push: Spring;
  sweat: Drop[];
  mic: Gag;
  glove: Gag;
  bird: Gag;
  /** The wires' visibility, 0 to 1. */
  wires: number;
  snapped: boolean;
  snapAge: number;
  events: string[];
  random: () => number;
}

export function createWorld(): World {
  return { eyes: spring(0), blink: 0, wink: 0, look: [spring(0), spring(0)], push: spring(0), sweat: [], mic: { active: false, age: 0, fired: 0 }, glove: { active: false, age: 0, fired: 0 }, bird: { active: false, age: 0, fired: 0 }, wires: 0, snapped: false, snapAge: 0, events: [], random: mulberry32(0x5e7) };
}

export function resetWorld(world: World): void {
  world.eyes = spring(0);
  world.blink = 0;
  world.wink = 0;
  world.look = [spring(0), spring(0)];
  world.push = spring(0);
  world.sweat = [];
  world.mic = { active: false, age: 0, fired: 0 };
  world.glove = { active: false, age: 0, fired: 0 };
  world.bird = { active: false, age: 0, fired: 0 };
  world.wires = 0;
  world.snapped = false;
  world.snapAge = 0;
  world.events = [];
  world.random = mulberry32(0x5e7);
}

/** Joins a round in progress: what the multiplier already let out is not replayed. */
export function settleWorld(world: World, multiplier: number): void {
  if (multiplier >= EYES_AT) world.eyes = spring(1);
  world.mic.fired = MIC_AT.filter((at) => multiplier >= at).length;
  world.bird.fired = BIRD_AT.filter((at) => multiplier >= at).length;
  if (multiplier >= GLOVE_AT) world.glove.fired = 1;
  if (multiplier >= WIRES_AT) world.wires = 1;
}

/** The wire snapped: the set stops pretending. */
export function snapWires(world: World): void {
  world.snapped = true;
  world.snapAge = 0;
  world.wires = 1;
}

export function stepWorld(world: World, multiplier: number, running: boolean, dt: number, reduced: boolean): void {
  world.events = [];
  const r = world.random;
  if (running) {
    if (multiplier >= EYES_AT && world.eyes.x < 0.5 && world.eyes.v === 0) world.events.push('eyes');
    if (world.mic.fired < MIC_AT.length && multiplier >= MIC_AT[world.mic.fired]!) { world.mic = { active: true, age: 0, fired: world.mic.fired + 1 }; world.events.push('mic'); }
    if (world.bird.fired < BIRD_AT.length && multiplier >= BIRD_AT[world.bird.fired]!) { world.bird = { active: true, age: 0, fired: world.bird.fired + 1 }; world.events.push('bird'); }
    if (world.glove.fired < 1 && multiplier >= GLOVE_AT) { world.glove = { active: true, age: 0, fired: 1 }; world.events.push('glove'); }
    if (multiplier >= WIRES_AT && world.wires === 0) world.events.push('wires');
    if (multiplier >= WINK_AT && world.wink === 0) { world.wink = 0.01; world.events.push('wink'); }
  }
  stepSpring(world.eyes, running && multiplier >= EYES_AT ? 1 : world.eyes.x, 6, 0.7, dt);
  if (multiplier >= WIRES_AT && running) world.wires = Math.min(1, world.wires + dt * 0.8);
  // Blinks, and the wink.
  world.blink = Math.max(0, world.blink - dt);
  if (world.eyes.x > 0.8 && world.blink <= 0 && r() < dt * 0.25) world.blink = 0.22;
  if (world.wink > 0) world.wink = world.wink + dt > 1.1 ? 0 : world.wink + dt;
  if (world.wink > 0 && multiplier >= WINK_AT && world.wink < 0.02) world.wink = 0.02;
  stepSpring(world.push, 0, 7, 0.35, dt);
  for (const gag of [world.mic, world.glove, world.bird]) if (gag.active) { gag.age += dt; if (gag.age > (gag === world.bird ? 3.8 : gag === world.mic ? 2.6 : 3.2)) gag.active = false; }
  if (world.glove.active && world.glove.age > 1.55 && world.glove.age - dt <= 1.55) world.push.v += 6;
  if (world.snapped) world.snapAge += dt;
  // Sweat from the moon's temple once it is sweating.
  if (running && multiplier >= SWEAT_AT && !reduced && r() < dt * 3) world.sweat.push({ x: 0.3 + r() * 0.35, y: -0.42 - r() * 0.2, vy: 0, age: 0 });
  for (const drop of world.sweat) { drop.age += dt; drop.vy += dt * 0.5; drop.y += drop.vy * dt; }
  world.sweat = world.sweat.filter((d) => d.age < 2.2);
}

/** Where the moon is and how big, for a rocket centre and the multiplier; it never quite arrives. */
export function moonPlacement(centre: Vec3, multiplier: number): { pos: Vec3; scale: number; distance: number } {
  const distance = 2400 / Math.pow(1 + 2.2 * Math.log2(Math.max(1, multiplier)), 1.5);
  const near = Math.min(distance, MOON_FAR);
  return { pos: madd(centre, MOON_DIR, near), scale: (MOON_RADIUS * near) / distance, distance };
}

/** 0 at the ground, 1 in space. */
export const spaceness = (alt: number): number => smoothstep(14, 95, alt);

export function flightEnvironment(alt: number, engine: Vec3, thrust: number, flash: number): Environment {
  const s = spaceness(alt);
  return {
    fogColor: [0.72 - 0.68 * s, 0.82 - 0.78 * s, 0.96 - 0.86 * s],
    fogDensity: 0.0032 * (1 - s),
    sunDir: SUN_DIR,
    sunColor: [1, 0.96 - 0.04 * s, 0.88 - 0.06 * s],
    ambientTop: [0.46 - 0.32 * s, 0.5 - 0.36 * s, 0.62 - 0.4 * s],
    ambientBottom: [0.3 - 0.25 * s, 0.32 - 0.27 * s, 0.3 - 0.24 * s],
    pointPos: engine,
    pointColor: [1.6 * thrust, 0.9 * thrust, 0.35 * thrust],
    flash,
  };
}

const yUp = (): [Vec3, Vec3, Vec3] => [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
const turned = (angle: number): [Vec3, Vec3, Vec3] => [rotateAbout([1, 0, 0], [0, 1, 0], angle), [0, 1, 0], rotateAbout([0, 0, 1], [0, 1, 0], angle)];

/** The backyard spaceport and the flat earth it sits on. Skipped once the rocket is too high to see it. */
export function drawGround(r: Renderer, alt: number, time: number, labels: Label[]): void {
  const m = r.meshes;
  const [gx, gy, gz] = yUp();
  putInstance(m.earth, 0, [0, -0.12, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [EARTH_RADIUS, 6, EARTH_RADIUS], [1, 1, 1, 1], [-1, 0, 0, 0], [1, 0, 0, 0]);
  r.drawLit(m.earth, 1, 'opaque', 'none');
  if (alt > 160) return;
  let discs = 0;
  discs = putInstance(m.disc, discs, [0, 0, 0], gx, gy, gz, [30, 30, 1], [0.36, 0.6, 0.25, 1]);
  discs = putInstance(m.disc, discs, [3, 0.02, -12], gx, gy, gz, [5, 5, 1], [0.5, 0.42, 0.28, 1]);
  r.drawLit(m.disc, discs, 'opaque', 'none');
  putInstance(m.pad, 0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]);
  r.drawLit(m.pad, 1, 'opaque', 'none');
  putInstance(m.tower, 0, [-3.6, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]);
  r.drawLit(m.tower, 1);
  const [tx, ty, tz] = turned(0.45);
  putInstance(m.trailer, 0, [-9.5, 0, 6], tx, ty, tz, [1, 1, 1]);
  r.drawLit(m.trailer, 1);
  // The dish on the roof points at the moon: NASA is bullish.
  const dy = MOON_DIR;
  const dx = normalize(cross([0, 1, 0], dy));
  const dz = cross(dx, dy);
  putInstance(m.dish, 0, [-8.2, 2.9, 5.2], dx, dy, dz, [1.1, 1.1, 1.1]);
  r.drawLit(m.dish, 1, 'opaque', 'none');
  const [hx, hy, hz] = turned(-0.35);
  putInstance(m.doghouse, 0, [7.5, 0, 5], hx, hy, hz, [1.2, 1.2, 1.2]);
  r.drawLit(m.doghouse, 1);
  putInstance(m.pool, 0, [9, 0, -5], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]);
  r.drawLit(m.pool, 1, 'opaque', 'none');
  // Mom at the door, in her gown, with a plate.
  const [mx, my, mz] = turned(0.45);
  putInstance(m.stand, 0, [-6.1, 0, 8.6], mx, my, mz, [1.5, 1.5, 1.5], [1, 0.72, 0.82, 1], [FACE.wojak, 0, 0, 0]);
  r.drawLit(m.stand, 1);
  putInstance(m.disc, 0, [-5.55, 1.05, 9.1], gx, gy, gz, [0.35, 0.35, 1], [1, 1, 1, 1]);
  r.drawLit(m.disc, 1, 'opaque', 'none');
  labels.push({ text: 'MOM', at: [-6.1, 2.1, 8.6], colour: '#ff9ad5', size: 15 });
  if (alt > 30) labels.push({ text: "MOM'S HOUSE", at: [-9.5, 3.2, 6], colour: '#ffd0dc', size: 14, far: true });
  // The fence, and a car on bricks.
  let boxes = 0;
  for (let i = 0; i < 26; i += 1) boxes = putInstance(m.box, boxes, [-15 + i * 1.2, 0.55, 11], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0.14, 1.1, 0.05], [0.8, 0.72, 0.55, 1]);
  boxes = putInstance(m.box, boxes, [0, 0.85, 11.02], [1, 0, 0], [0, 1, 0], [0, 0, 1], [31, 0.1, 0.06], [0.75, 0.66, 0.5, 1]);
  boxes = putInstance(m.box, boxes, [0, 0.3, 11.02], [1, 0, 0], [0, 1, 0], [0, 0, 1], [31, 0.1, 0.06], [0.75, 0.66, 0.5, 1]);
  boxes = putInstance(m.box, boxes, [12, 0.8, 2], turned(0.2)[0], [0, 1, 0], turned(0.2)[2], [4.2, 1.0, 1.9], [0.72, 0.2, 0.18, 1]);
  boxes = putInstance(m.box, boxes, [12, 1.5, 1.7], turned(0.2)[0], [0, 1, 0], turned(0.2)[2], [2.4, 0.6, 1.7], [0.2, 0.25, 0.3, 1]);
  for (const [bx, bz] of [[10.4, 1.2], [13.6, 1.2], [10.4, 2.9], [13.6, 2.9]] as const) boxes = putInstance(m.box, boxes, [bx, 0.15, bz], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0.5, 0.3, 0.3], [0.7, 0.45, 0.35, 1]);
  r.drawLit(m.box, boxes);
  if (alt < 40) labels.push({ text: 'ON BRICKS SINCE 2021', at: [12, 2.3, 2], colour: '#c9d2e6', size: 12 });
  void time;
}

export interface Camera { eye: Vec3; forward: Vec3; right: Vec3; up: Vec3 }

/** The moon prop, facing the camera, with its face. Returns the frame its face parts sit in. */
export function drawMoon(world: World, r: Renderer, placement: { pos: Vec3; scale: number }, cam: Camera, lookAt: Vec3, time: number, labels: Label[], reduced: boolean): void {
  const m = r.meshes;
  const S = placement.scale;
  const toCam = normalize(sub(cam.eye, placement.pos));
  const yAxis = toCam;
  const xAxis = normalize(cross([0, 1, 0], yAxis));
  const zAxis = cross(xAxis, yAxis);
  const push = world.push.x * S * 0.12;
  const pos = madd(placement.pos, xAxis, -push);
  putInstance(m.moon, 0, pos, xAxis, yAxis, zAxis, [S, S, S], [1, 1, 1, 1], [-1, 0, 0, 0], [1, 0, 0, 0]);
  r.drawLit(m.moon, 1, 'opaque', 'none');
  // The face: eyes, pupils that follow the rocket, lids, and a mouth.
  const open = clamp(world.eyes.x, 0, 1);
  if (open > 0.02) {
    const toRocket = normalize(sub(lookAt, pos));
    const lx = Math.max(-1, Math.min(1, toRocket[0] * xAxis[0] + toRocket[1] * xAxis[1] + toRocket[2] * xAxis[2]));
    const lz = Math.max(-1, Math.min(1, toRocket[0] * zAxis[0] + toRocket[1] * zAxis[1] + toRocket[2] * zAxis[2]));
    const onFace = (x: number, z: number, lift: number): Vec3 => add(add(pos, [xAxis[0] * x * S, xAxis[1] * x * S, xAxis[2] * x * S]), add([zAxis[0] * z * S, zAxis[1] * z * S, zAxis[2] * z * S], [yAxis[0] * lift * S, yAxis[1] * lift * S, yAxis[2] * lift * S]));
    // The disc mesh faces +z: its z is the plate's normal, its y the plate's up (-z of the plate).
    const ex = xAxis;
    const ey: Vec3 = [-zAxis[0], -zAxis[1], -zAxis[2]];
    const ez = yAxis;
    let discs = 0;
    const blink = world.blink > 0 ? Math.sin((world.blink / 0.22) * Math.PI) : 0;
    for (const side of [-1, 1]) {
      const eyeR = 0.14;
      const centre = onFace(side * 0.3, -0.16, 0.012);
      discs = putInstance(m.disc, discs, centre, ex, ey, ez, [eyeR * S, eyeR * S * 1.15, 1], [1, 1, 1, 1], [-1, 0.1, 0, 0], [1, 0, 0, 0]);
      discs = putInstance(m.disc, discs, onFace(side * 0.3 + lx * 0.06, -0.16 + lz * 0.05, 0.014), ex, ey, ez, [0.06 * S, 0.07 * S, 1], [0.08, 0.06, 0.1, 1], [-1, 0, 0, 0], [1, 0, 0, 0]);
      // The lid: a moon-grey disc squashed down from the top; shut when the eyes are closed, blinking, or winking (the right eye).
      const winking = side === 1 && world.wink > 0.02 && world.wink < 0.8 ? 1 : 0;
      const shut = Math.max(1 - open, blink, winking);
      if (shut > 0.01) {
        const lidCentre = add(centre, [ey[0] * eyeR * S * 1.15 * (1 - shut), ey[1] * eyeR * S * 1.15 * (1 - shut), ey[2] * eyeR * S * 1.15 * (1 - shut)]);
        discs = putInstance(m.disc, discs, madd(lidCentre, ez, 0.004 * S), ex, ey, ez, [eyeR * S * 1.08, eyeR * S * 1.15 * shut + 0.001, 1], [0.8, 0.79, 0.77, 1], [-1, 0, 0, 0], [1, 0, 0, 0]);
      }
    }
    r.drawLit(m.disc, discs, 'opaque', 'none');
    const gawp = world.sweat.length > 0 || world.push.x > 0.3;
    putInstance(m.sticker, 0, onFace(0, 0.34, 0.012), ex, ey, ez, [0.7 * S, 0.35 * S, 1], [1, 1, 1, 1], [-1, 0, 0, 0], [1, gawp ? PRINT.gawp : PRINT.smile, 1, 0]);
    r.drawLit(m.sticker, 1, 'alpha', 'none');
    for (const drop of world.sweat) r.sprite(onFace(drop.x, drop.y, 0.02), 0.035 * S * (1 + drop.age * 0.3), [0.6, 0.85, 1, 0.9 * (1 - drop.age / 2.2)], 0);
    r.flushSprites('alpha');
  }
  if (!reduced || true) labels.push({ text: 'THE MOON', at: madd(pos, [-zAxis[0], -zAxis[1], -zAxis[2]], S * 1.15), colour: '#ffe27a', size: 20, far: true });
  // The glove: in from the right of the moon to give it a nudge, with the arm off to the edge of the world.
  if (world.glove.active) {
    const s = Math.sin((Math.PI * world.glove.age) / 3.2);
    const gz: Vec3 = [-xAxis[0], -xAxis[1], -xAxis[2]];
    const gy: Vec3 = [-zAxis[0], -zAxis[1], -zAxis[2]];
    const gx = cross(gy, gz);
    const at = madd(madd(pos, xAxis, S * (1.9 - 0.85 * s)), yAxis, S * 0.08);
    const gs = S * 0.5;
    putInstance(m.glove, 0, at, gx, gy, gz, [gs, gs, gs], [1, 1, 1, 1], [-1, 0.25, 0, 0], [3, 0, 0, 0]);
    r.drawLit(m.glove, 1, 'opaque', 'none');
    const arm = madd(at, xAxis, 60 + gs * 0.7);
    putInstance(m.box, 0, arm, xAxis, gy, gz, [120, gs * 0.42, gs * 0.42], [0.12, 0.12, 0.14, 1]);
    r.drawLit(m.box, 1);
    labels.push({ text: 'HAND OF DEV', at: madd(at, gy, gs * 1.3), colour: '#ffd24a', size: 18, far: true });
  }
  void time;
}

/** The boom mic that dips in from the top of the frame, and the bird that crosses it. Both live in camera space. */
export function drawCameraGags(world: World, r: Renderer, cam: Camera, time: number, labels: Label[]): void {
  const m = r.meshes;
  const fz = cross(cam.right, cam.up);
  if (world.mic.active) {
    const dip = Math.sin((Math.PI * world.mic.age) / 2.6);
    const at = add(add(madd(cam.eye, cam.forward, 6.5), [cam.up[0] * (3.4 - 2.7 * dip), cam.up[1] * (3.4 - 2.7 * dip), cam.up[2] * (3.4 - 2.7 * dip)]), [cam.right[0] * 1.3, cam.right[1] * 1.3, cam.right[2] * 1.3]);
    const wob = Math.sin(time * 3) * 0.08;
    const mx = rotateAbout(cam.right, fz, wob);
    const my = rotateAbout(cam.up, fz, wob);
    putInstance(m.mic, 0, at, mx, my, fz, [0.7, 0.7, 0.7]);
    r.drawLit(m.mic, 1);
    if (dip > 0.6) labels.push({ text: 'BOOM MIC?', at: madd(at, cam.up, -0.75), colour: '#ffd24a', size: 16 });
  }
  if (world.bird.active) {
    const k = world.bird.age / 3.8;
    const at = add(add(madd(cam.eye, cam.forward, 9), [cam.right[0] * (-10 + 20 * k), cam.right[1] * (-10 + 20 * k), cam.right[2] * (-10 + 20 * k)]), [cam.up[0] * (1.4 + 0.4 * Math.sin(world.bird.age * 5)), cam.up[1] * (1.4 + 0.4 * Math.sin(world.bird.age * 5)), cam.up[2] * (1.4 + 0.4 * Math.sin(world.bird.age * 5))]);
    const bx = cam.right;
    const by = cam.up;
    const bz = fz;
    putInstance(m.bird, 0, at, bx, by, bz, [0.9, 0.9, 0.9]);
    r.drawLit(m.bird, 1);
    const flap = Math.sin(world.bird.age * 14) * 0.75;
    let wings = 0;
    wings = putInstance(m.wing, wings, at, bx, rotateAbout(by, bx, flap), rotateAbout(bz, bx, flap), [0.9, 0.9, 0.9]);
    wings = putInstance(m.wing, wings, at, bx, rotateAbout(by, bx, -flap), rotateAbout(bz, bx, -flap), [0.9, 0.9, -0.9]);
    r.drawLit(m.wing, wings, 'opaque', 'none');
    if (Math.sin(world.bird.age * 9) > 0) r.sprite(madd(at, by, 0.28), 0.22, [1, 0.15, 0.1, 0.9], 2);
    r.flushSprites('additive');
    labels.push({ text: 'SEC DRONE', at: madd(at, by, 0.5), colour: '#8ff0ff', size: 15 });
  }
}

/** The wires above the nose: unseen until 4.2×, then glinting; at the crash one snaps and both hang. */
export function drawWires(world: World, r: Renderer, nose: Vec3, time: number, labels: Label[], reduced: boolean): void {
  if (world.wires <= 0.01) return;
  const m = r.meshes;
  let boxes = 0;
  const glint = reduced ? 0.6 : 0.5 + 0.5 * Math.max(0, Math.sin(time * 2.6)) ** 6;
  const tint: [number, number, number, number] = [0.92, 0.93, 0.98, world.wires * (0.55 + 0.45 * glint)];
  for (const side of [-1, 1]) {
    const top: Vec3 = [nose[0] + side * 0.35, nose[1] + 70, nose[2]];
    if (!world.snapped) {
      const foot: Vec3 = [nose[0] + side * 0.3, nose[1], nose[2]];
      const d = sub(top, foot);
      const len = Math.hypot(d[0], d[1], d[2]);
      const y = normalize(d);
      const x = normalize(cross(y, [0, 0, 1]));
      const z = cross(x, y);
      boxes = putInstance(m.box, boxes, madd(foot, d, 0.5), x, y, z, [0.045, len, 0.045], tint, [-1, glint * 0.8, 0, 0]);
    } else {
      // Hanging from the grid, swinging where the rocket let go of them.
      const t = world.snapAge;
      const swing = Math.sin(t * 3.5 + side) * 2.2 * Math.exp(-t * 0.6);
      const foot: Vec3 = [nose[0] + side * 0.3 + swing, nose[1] - 6 * Math.min(1, t), nose[2] + swing * 0.4];
      const d = sub(top, foot);
      const len = Math.hypot(d[0], d[1], d[2]);
      const y = normalize(d);
      const x = normalize(cross(y, [0, 0, 1]));
      const z = cross(x, y);
      boxes = putInstance(m.box, boxes, madd(foot, d, 0.5), x, y, z, [0.045, len, 0.045], [0.92, 0.93, 0.98, 0.9], [-1, 0.3, 0, 0]);
      if (side === 1 && t < 1.2) {
        for (let i = 0; i < 6; i += 1) r.sprite(add(foot, [Math.sin(i * 2.1 + t * 9) * 0.5, Math.cos(i * 1.7 + t * 7) * 0.5, 0]), 0.25 + 0.2 * Math.sin(t * 30 + i), [1, 0.9, 0.5, Math.max(0, 1 - t)], 2);
        r.flushSprites('additive');
      }
    }
  }
  r.drawLit(m.box, boxes, 'alpha', 'none');
  if (!world.snapped && world.wires > 0.5) labels.push({ text: 'WIRE??', at: [nose[0] + 0.35, nose[1] + 2.6, nose[2]], colour: '#ffd24a', size: 15 });
}
