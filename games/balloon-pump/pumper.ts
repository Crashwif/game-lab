/**
 * The pumper: a two-bone rig whose hands are pinned to the pump handle while
 * the rest of the body trails it through springs, so the torso, head and hat
 * pom-pom all move on their own timing. The pump itself (barrel, piston,
 * handle, gauge) is drawn here because the handle position is shared.
 */
import { STROKE, type Spring, clamp, fract, mix, noise, settleSpring, smoothstep, spring, stepSpring, strokeCompression } from './motion';

export type Point = { x: number; y: number };

/** Solves a two-bone limb with a fixed endpoint and a consistent bend direction. */
export function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + dx / distance * along - dy / distance * bend, y: root.y + dy / distance * along + dx / distance * bend };
}

/** Pump geometry: the piston centre line, the handle's top rest and travel, the base plate. */
export const PUMP = { x: 330, handleTop: 232, travel: 104, baseY: 440, barrelTop: 350 } as const;

export interface PumperDrive {
  /** The round is running: the handle works at `rate` strokes per second. */
  pumping: boolean;
  rate: number;
  /** Hands slide inward along the handle during the recovery act. */
  regrip?: number;
  /** Betting: he primes the pump with half strokes and regrips the handle, waiting for the round. */
  ready?: boolean;
  /** 0..1 dread, following the multiplier. */
  fear: number;
  /** Knocked over by the burst. */
  fallen: boolean;
  /** The burst took a bet with it. */
  crying: boolean;
  /** The exit was accepted: shades drop, smugness follows. */
  smug: boolean;
  /** 0..1 laser-eye intensity. */
  laser: number;
  /** 0..1 pressure gauge needle. */
  gauge: number;
  /** Where the eyes look (the balloon). */
  gaze: Point;
}

export interface PumperRig {
  time: number;
  /** Stroke position in cycles; the fraction is the point within a push-lift cycle. */
  phase: number;
  /** Body parts following the handle at different speeds: torso, head, knees. */
  lean: Spring;
  nod: Spring;
  knees: Spring;
  /** 0 standing .. 1 on the ground; its overshoot past 1 is the squash of landing. */
  fall: Spring;
  /** 1 standing idle (breathing) .. 0 pumping or down, eased so the breath never pops in or out. */
  idle: Spring;
  /** The wind-up between rounds: a priming half stroke (in cycles) and a regrip of the handle. */
  prime: Spring;
  grip: Spring;
  fallenFor: number;
  /** 0 off-screen .. 1 on the face. */
  shades: Spring;
  pom: { x: Spring; y: Spring; ready: boolean };
  eyeOpen: Spring;
  mouthOpen: Spring;
  mouthCurve: Spring;
  brow: Spring;
  blinkAt: number;
  /** Stroke edges seen in the last step: a push started; the handle bottomed out. */
  events: { push: boolean; bottom: boolean };
}

type Mood = 'calm' | 'nervous' | 'panic' | 'shock' | 'cry' | 'dazed' | 'smug';
const FACES: Record<Mood, { eye: number; open: number; curve: number; brow: number }> = {
  calm: { eye: 1, open: 0.05, curve: 0.3, brow: 0 },
  nervous: { eye: 1.1, open: 0.12, curve: -0.25, brow: 0.6 },
  panic: { eye: 1.35, open: 0.55, curve: -0.55, brow: 1 },
  shock: { eye: 1.7, open: 1, curve: 0.05, brow: 1 },
  cry: { eye: 0.55, open: 0.4, curve: -1, brow: 0.9 },
  dazed: { eye: 0.8, open: 0.2, curve: -0.2, brow: 0.3 },
  smug: { eye: 0.75, open: 0.08, curve: 0.75, brow: -0.4 },
};

export function createPumper(): PumperRig {
  return {
    time: 0, phase: 0, lean: spring(0), nod: spring(0), knees: spring(0), fall: spring(0), idle: spring(1), prime: spring(0), grip: spring(0), fallenFor: 0, shades: spring(0),
    pom: { x: spring(0), y: spring(0), ready: false }, eyeOpen: spring(1), mouthOpen: spring(0.05), mouthCurve: spring(0.3), brow: spring(0),
    blinkAt: 2.4, events: { push: false, bottom: false },
  };
}

/** Jumps to the pose the drive calls for, for a round met late: already on the grass after a burst `fallenFor` seconds ago, shades already on after an exit. */
export function settlePumper(rig: PumperRig, drive: PumperDrive, fallenFor: number): void {
  settleSpring(rig.fall, drive.fallen ? 1 : 0);
  settleSpring(rig.idle, drive.pumping || drive.fallen ? 0 : 1);
  rig.fallenFor = drive.fallen ? fallenFor : 0;
  settleSpring(rig.shades, drive.smug ? 1 : 0);
  const c = strokeCompression(rig.phase);
  for (const part of [rig.lean, rig.nod, rig.knees]) settleSpring(part, c);
}

/** How far the pom-pom can stray from the knot on top of the hat. */
const POM_TETHER = 8;

/** The handle position in cycles, the priming half stroke included. */
const strokePhase = (rig: PumperRig): number => rig.phase + Math.max(0, rig.prime.x);

export function stepPumper(rig: PumperRig, drive: PumperDrive, dt: number): void {
  rig.time += dt;
  const before = rig.phase;
  if (drive.fallen) {
    // Hands are off the handle; the stroke stays where the burst caught it.
  } else if (drive.pumping) {
    rig.phase += drive.rate * dt;
  } else {
    // Finish the stroke gently and rest with the handle up.
    const rest = Math.ceil(rig.phase - 1e-9);
    if (rig.phase < rest) rig.phase = Math.min(rest, rig.phase + 1.2 * dt);
  }
  // Between rounds, once the handle is up: every 1.4 s a priming half stroke, then a regrip before the next.
  const u = fract(rig.time / 1.4);
  const winding = drive.ready === true && !drive.fallen && fract(rig.phase) === 0;
  stepSpring(rig.prime, winding ? 0.15 * smoothstep(0.05, 0.32, u) * (1 - smoothstep(0.42, 0.72, u)) : 0, 14, 0.8, dt);
  stepSpring(rig.grip, winding ? smoothstep(0.76, 0.84, u) * (1 - smoothstep(0.88, 0.98, u)) : 0, 18, 0.7, dt);
  stepSpring(rig.idle, drive.pumping || drive.fallen ? 0 : 1, 6, 1, dt);
  const u0 = fract(before);
  const u1 = fract(rig.phase);
  const wrapped = Math.floor(rig.phase) > Math.floor(before);
  rig.events.push = wrapped;
  rig.events.bottom = (u0 < STROKE.down && u1 >= STROKE.down) || (wrapped && u1 >= STROKE.down);

  const c = strokeCompression(strokePhase(rig));
  stepSpring(rig.lean, c, 22, 0.7, dt);
  stepSpring(rig.nod, c, 13, 0.4, dt);
  stepSpring(rig.knees, c, 20, 0.8, dt);
  rig.fallenFor = drive.fallen ? rig.fallenFor + dt : 0;
  stepSpring(rig.fall, drive.fallen ? 1 : 0, drive.fallen ? 9 : 4, drive.fallen ? 0.5 : 1, dt);
  stepSpring(rig.shades, drive.smug ? 1 : 0, 12, 0.5, dt);

  const shock = drive.fallen && rig.fallenFor < 0.7;
  const mood: Mood = drive.fallen ? (shock ? 'shock' : drive.crying ? 'cry' : drive.smug ? 'smug' : 'dazed') : drive.smug ? 'smug' : drive.fear > 0.62 ? 'panic' : drive.fear > 0.25 ? 'nervous' : 'calm';
  const face = FACES[mood];
  const blinking = rig.time > rig.blinkAt && rig.time < rig.blinkAt + 0.13;
  if (rig.time >= rig.blinkAt + 0.13) rig.blinkAt = rig.time + 2.2 + 2.6 * noise(rig.blinkAt);
  stepSpring(rig.eyeOpen, blinking && mood !== 'shock' ? 0.08 : face.eye, 26, 0.9, dt);
  stepSpring(rig.mouthOpen, face.open, 14, 0.8, dt);
  stepSpring(rig.mouthCurve, face.curve, 10, 0.8, dt);
  stepSpring(rig.brow, face.brow, 12, 0.75, dt);

  // The pom-pom chases the top of the hat on a loose spring, so it bounces after every stroke. Gravity pulls it
  // a little below its rest above the knot, and its short tether stops it straying more than POM_TETHER away.
  const pose = pumperPose(rig, drive);
  const rest = pose.toWorld(4, -68);
  const target = { x: rest.x, y: rest.y + 4 };
  if (!rig.pom.ready) { settleSpring(rig.pom.x, target.x); settleSpring(rig.pom.y, target.y); rig.pom.ready = true; }
  stepSpring(rig.pom.x, target.x, 24, 0.22, dt);
  stepSpring(rig.pom.y, target.y, 24, 0.22, dt);
  const knot = pose.toWorld(4, -62);
  const dx = rig.pom.x.x - knot.x;
  const dy = rig.pom.y.x - knot.y;
  const d = Math.hypot(dx, dy);
  if (d > POM_TETHER) {
    // Taut: back onto the tether's circle, and only the velocity along it survives.
    const nx = dx / d;
    const ny = dy / d;
    rig.pom.x.x = knot.x + nx * POM_TETHER;
    rig.pom.y.x = knot.y + ny * POM_TETHER;
    const out = rig.pom.x.v * nx + rig.pom.y.v * ny;
    if (out > 0) { rig.pom.x.v -= out * nx; rig.pom.y.v -= out * ny; }
  }
}

const INK = '#1c1f26';
const SKIN = '#f3dccb';
const SKIN_SHADE = '#e0bda7';
const TEE = '#3b3f4a';
const JEANS = '#3d5f8f';
const JEANS_SHADE = '#2e4a70';
const HAT = '#ff7ab8';
const HAT_BRIM = '#ffb3d6';
const HAT_KNIT = '#e3579b';
const POM = '#ffdbea';
const CHROME = '#cfd8dc';

const lerpPoint = (a: Point, b: Point, t: number): Point => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });

interface Pose {
  hip: Point;
  shoulder: Point;
  head: Point;
  headRot: number;
  handleY: number;
  backHand: Point;
  frontHand: Point;
  backFoot: Point;
  frontFoot: Point;
  /** Head-local coordinates to world. */
  toWorld: (lx: number, ly: number) => Point;
}

/** The pose the springs describe: standing at the pump, blended toward sprawled on the ground. */
export function pumperPose(rig: PumperRig, drive: PumperDrive): Pose {
  const t = rig.time;
  const c = strokeCompression(strokePhase(rig));
  const lean = rig.lean.x;
  const nod = rig.nod.x;
  const knees = rig.knees.x;
  // The pose never blends past the sprawl, so the hip stays on the grass; the landing's overshoot squashes the torso instead.
  const fall = clamp(rig.fall.x, 0, 1);
  const squash = clamp(rig.fall.x - 1, 0, 0.25);
  const breathe = Math.sin(t * 1.6) * 1.6 * rig.idle.x;
  const dazed = drive.fallen ? Math.sin(t * 2.6) * 0.06 : 0;
  const hip = lerpPoint({ x: 206 - 14 * lean, y: 306 + 22 * knees + breathe }, { x: 200, y: 404 }, fall);
  const torsoAngle = mix(0.3 + 0.5 * lean, -0.45 + dazed, fall);
  const headAngle = mix(-0.22 - 0.25 * lean + 0.14 * nod, -0.28 - dazed * 2, fall);
  const torso = 108 * (1 - 0.5 * squash);
  const shoulder = { x: hip.x + Math.sin(torsoAngle) * torso, y: hip.y - Math.cos(torsoAngle) * torso };
  const handleY = PUMP.handleTop + c * PUMP.travel;
  const release = smoothstep(0, 0.5, fall);
  const inset = 7 * ((drive.regrip ?? 0) + 0.6 * rig.grip.x);
  let backHand = lerpPoint({ x: PUMP.x - 14 + inset, y: handleY }, { x: hip.x - 30, y: hip.y - 168 }, release);
  let frontHand = lerpPoint({ x: PUMP.x + 14 - inset, y: handleY }, { x: hip.x + 46, y: hip.y - 158 }, release);
  // The free hands follow the fall, but must stay inside the actual shoulder reach.
  // During pumping the same projection is a no-op, keeping both handle contacts exact.
  const constrain = (root: Point, target: Point): Point => {
    const dx = target.x - root.x, dy = target.y - root.y, distance = Math.hypot(dx, dy);
    const reach = clamp(distance, 4.001, 127.999);
    return { x: root.x + (distance > 1e-8 ? dx / distance : 0) * reach, y: root.y + (distance > 1e-8 ? dy / distance : -1) * reach };
  };
  backHand = constrain({ x: shoulder.x - 12, y: shoulder.y + 8 }, backHand);
  frontHand = constrain({ x: shoulder.x + 10, y: shoulder.y + 4 }, frontHand);
  const backFoot = lerpPoint({ x: 160, y: 426 }, { x: 262, y: 430 }, fall);
  const frontFoot = lerpPoint({ x: 306, y: 423 }, { x: 296, y: 424 }, fall);
  const headRot = torsoAngle + headAngle;
  const neck = 48 * (1 - 0.3 * squash);
  const head = { x: shoulder.x + Math.sin(headRot) * neck, y: shoulder.y - Math.cos(headRot) * neck };
  const toWorld = (lx: number, ly: number): Point => ({ x: head.x + lx * Math.cos(headRot) - ly * Math.sin(headRot), y: head.y + lx * Math.sin(headRot) + ly * Math.cos(headRot) });
  return { hip, shoulder, head, headRot, handleY, backHand, frontHand, backFoot, frontFoot, toWorld };
}

export interface PumperView {
  /** World positions of the eyes and the head, for lasers and captions. */
  eyes: Point[];
  head: Point;
}

export function drawPumper(ctx: CanvasRenderingContext2D, rig: PumperRig, drive: PumperDrive): PumperView {
  const t = rig.time;
  const fall = clamp(rig.fall.x, 0, 1);
  const release = smoothstep(0, 0.5, fall);
  const { hip, shoulder, head, headRot, handleY, backHand, frontHand, backFoot, frontFoot, toWorld } = pumperPose(rig, drive);

  function segment(a: Point, b: Point, width: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function disc(p: Point, radius: number, color: string, outline = 0) {
    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    if (outline) { ctx.strokeStyle = INK; ctx.lineWidth = outline; ctx.stroke(); }
    ctx.fillStyle = color; ctx.fill();
  }
  function limb(root: Point, end: Point, upper: number, lower: number, side: number, width: number, color: string): Point {
    const joint = bendJoint(root, end, upper, lower, side);
    segment(root, joint, width + 5, INK); segment(joint, end, width + 5, INK);
    segment(root, joint, width, color); segment(joint, end, width, color);
    return joint;
  }
  function shoe(foot: Point) {
    ctx.beginPath(); ctx.roundRect(foot.x - 12, foot.y + 2, 37, 15, [7, 9, 9, 7]);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#f6f6f6'; ctx.fill();
    segment({ x: foot.x - 6, y: foot.y + 11 }, { x: foot.x + 21, y: foot.y + 11 }, 3, '#ef476f');
    segment({ x: foot.x - 9, y: foot.y + 16 }, { x: foot.x + 23, y: foot.y + 16 }, 2.5, '#8d99ae');
  }
  function hand(p: Point, radius: number, color: string, gripping: boolean) {
    disc(p, radius, color, 3);
    ctx.strokeStyle = SKIN_SHADE; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    if (gripping) {
      for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(p.x - 4 + i * 4, p.y + 2); ctx.lineTo(p.x - 4 + i * 4, p.y + 8); ctx.stroke(); }
    } else {
      for (let i = 0; i < 4; i += 1) {
        const angle = -2.2 + i * 0.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(angle) * (radius + 5), p.y + Math.sin(angle) * (radius + 5)); ctx.stroke();
      }
    }
  }

  ctx.save();
  ctx.lineJoin = 'round';

  // Ground shadow and the pump's base plate (the front foot stands on it).
  ctx.fillStyle = 'rgba(20, 30, 40, 0.18)';
  ctx.beginPath(); ctx.ellipse(mix(240, 210, fall), 448, mix(130, 110, fall), 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.roundRect(PUMP.x - 36, PUMP.baseY - 8, 72, 12, 5); ctx.fill();
  ctx.fillStyle = '#4a5b68';
  ctx.beginPath(); ctx.roundRect(PUMP.x - 33, PUMP.baseY - 6, 66, 5, 3); ctx.fill();

  // Legs, back arm and hand, then the torso over them; the pump handle and front arm cover the far hand's grip.
  limb({ x: hip.x - 8, y: hip.y }, backFoot, 74, 74, -1, 26, JEANS_SHADE);
  shoe(backFoot);
  const backShoulder = { x: shoulder.x - 12, y: shoulder.y + 8 };
  limb(backShoulder, backHand, 62, 66, 1, 16, SKIN_SHADE);
  hand(backHand, 9, SKIN_SHADE, release < 0.5);
  limb({ x: hip.x + 8, y: hip.y }, frontFoot, 78, 78, -1, 29, JEANS);
  shoe(frontFoot);
  disc(hip, 27, JEANS, 5);
  segment({ x: hip.x - 24, y: hip.y - 6 }, { x: hip.x + 24, y: hip.y - 6 }, 8, '#241f1f');
  segment(hip, shoulder, 64, INK);
  segment({ x: hip.x + (shoulder.x - hip.x) * 0.06, y: hip.y + (shoulder.y - hip.y) * 0.06 }, shoulder, 58, TEE);
  segment({ x: hip.x + (shoulder.x - hip.x) * 0.2 + 12, y: hip.y + (shoulder.y - hip.y) * 0.2 + 4 }, { x: shoulder.x + 14, y: shoulder.y + 10 }, 6, '#4c515e');
  segment(shoulder, head, 26, INK);
  segment(shoulder, head, 21, SKIN);

  // Head in its own frame: skull, face, hat, shades.
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(headRot);
  ctx.beginPath(); ctx.ellipse(0, 0, 30, 37, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = SKIN; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-25, 3, 7, 9, 0, 0, Math.PI * 2);
  ctx.stroke(); ctx.fillStyle = SKIN; ctx.fill();
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath(); ctx.ellipse(-25, 4, 3, 5, 0, 0, Math.PI * 2); ctx.fill();

  // Eyes look toward the gaze; lasers heat them up.
  const eyes = [{ x: 5, y: -8 }, { x: 21, y: -9 }];
  const eyeOpen = Math.max(0.08, rig.eyeOpen.x);
  const worldEyes = eyes.map((e) => toWorld(e.x, e.y));
  for (const [i, eye] of eyes.entries()) {
    const world = worldEyes[i]!;
    const gx = drive.gaze.x - world.x;
    const gy = drive.gaze.y - world.y;
    const gd = Math.max(1, Math.hypot(gx, gy));
    const lx = (gx * Math.cos(-headRot) - gy * Math.sin(-headRot)) / gd;
    const ly = (gx * Math.sin(-headRot) + gy * Math.cos(-headRot)) / gd;
    ctx.beginPath(); ctx.ellipse(eye.x, eye.y, 6.5, 6.5 * Math.min(1.3, eyeOpen), 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = drive.laser > 0 ? `rgb(255, ${Math.round(255 - 170 * drive.laser)}, ${Math.round(255 - 190 * drive.laser)})` : '#ffffff'; ctx.fill();
    disc({ x: eye.x + lx * 2.4, y: eye.y + ly * 2.4 * Math.min(1, eyeOpen) }, 2.8, drive.laser > 0.05 ? '#ff2b2b' : INK);
    if (drive.laser > 0.05) {
      ctx.fillStyle = `rgba(255, 60, 60, ${0.55 * drive.laser})`;
      ctx.beginPath(); ctx.arc(eye.x, eye.y, 9 + 3 * drive.laser, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Brows: inner ends rise when worried, drop when determined.
  const brow = rig.brow.x;
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, -19 + 1.5 * brow); ctx.lineTo(13, -19 - 5 * brow); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13, -20 - 5 * brow); ctx.lineTo(29, -20 + 1.5 * brow); ctx.stroke();
  // Nose.
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath(); ctx.moveTo(14, -5); ctx.lineTo(31, 9); ctx.lineTo(23, 12); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(14, -5); ctx.lineTo(31, 9); ctx.lineTo(23, 12); ctx.stroke();
  // Mouth: a curve when closed, an opening when not, a wobble when crying.
  const open = clamp(rig.mouthOpen.x, 0, 1);
  const curve = rig.mouthCurve.x;
  ctx.globalAlpha = clamp(1 - open * 3, 0, 1);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (curve < -0.7) {
    ctx.moveTo(6, 21);
    for (let i = 1; i <= 5; i += 1) ctx.lineTo(6 + i * 4, 21 + (i % 2 ? -2.2 : 2.2) - Math.sin(t * 14 + i) * 0.6);
  } else {
    ctx.moveTo(6, 20 - curve * 3); ctx.quadraticCurveTo(16, 20 + curve * 9, 26, 20 - curve * 3);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (open > 0.12) {
    const mx = 16;
    const my = 22 + 2 * open;
    const rx = 5 + 6 * open;
    const ry = 2 + 9 * open;
    ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#3a1420'; ctx.fill();
    if (open < 0.85 && !drive.fallen) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#fbfbfb'; ctx.fillRect(mx - rx, my - ry, rx * 2, ry * 0.55);
      ctx.restore();
    }
  }
  // Sweat drops slide down the face as the multiplier climbs.
  const drops = drive.fallen || drive.smug ? 0 : drive.fear > 0.8 ? 3 : drive.fear > 0.55 ? 2 : drive.fear > 0.3 ? 1 : 0;
  const dropSites = [{ x: -13, y: -16 }, { x: 31, y: -24 }, { x: -6, y: 6 }];
  for (let i = 0; i < drops; i += 1) {
    const p = fract(t / 1.1 + i * 0.37);
    const site = dropSites[i]!;
    const y = site.y + 26 * p * p;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.moveTo(site.x, y - 6); ctx.lineTo(site.x + 3.6, y); ctx.arc(site.x, y + 1, 3.6, -0.3, Math.PI + 0.3); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Tears.
  if (drive.crying && drive.fallen && rig.fallenFor > 0.7) {
    const flow = Math.min(1, (rig.fallenFor - 0.7) / 0.4);
    ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 4; ctx.globalAlpha = 0.85;
    for (const eye of eyes) {
      ctx.beginPath(); ctx.moveTo(eye.x, eye.y + 4);
      for (let s = 1; s <= 6; s += 1) ctx.lineTo(eye.x - s * 0.5 + Math.sin(t * 9 + s + eye.x) * 1.2, eye.y + 4 + s * 6 * flow);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // The wif hat: knit dome clipped above the brim, then the brim.
  ctx.save();
  ctx.beginPath(); ctx.rect(-40, -80, 80, 58); ctx.clip();
  ctx.beginPath(); ctx.ellipse(0, -34, 31, 30, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = HAT; ctx.fill();
  ctx.strokeStyle = HAT_KNIT; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath(); ctx.moveTo(i * 8 - 3, -60 + Math.abs(i) * 2.5); ctx.lineTo(i * 8 + 3, -48 + Math.abs(i) * 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * 8 + 3, -48 + Math.abs(i) * 3); ctx.lineTo(i * 8 - 3, -36 + Math.abs(i) * 2.5); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(-33, -30, 66, 16, 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = HAT_BRIM; ctx.fill();
  ctx.strokeStyle = HAT_KNIT; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.45;
  for (let x = -27; x <= 27; x += 6) { ctx.beginPath(); ctx.moveTo(x, -27); ctx.lineTo(x + 2, -17); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // Deal-with-it shades drop in from above.
  const shades = clamp(rig.shades.x, 0, 1.1);
  if (shades > 0.02) {
    const dy = -120 * (1 - shades);
    ctx.fillStyle = INK;
    for (const eye of eyes) {
      ctx.fillRect(eye.x - 8, eye.y - 6 + dy, 16, 8);
      ctx.fillRect(eye.x - 6, eye.y + 2 + dy, 12, 4);
      ctx.fillRect(eye.x - 4, eye.y + 6 + dy, 8, 2);
    }
    ctx.fillRect(eyes[0]!.x + 8, eyes[0]!.y - 5 + dy, 5, 3);
    ctx.fillRect(-26, eyes[0]!.y - 5 + dy, 19, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const eye of eyes) ctx.fillRect(eye.x - 6, eye.y - 4 + dy, 5, 2);
  }
  ctx.restore();

  // The pom-pom trails the hat on a loose spring and a short tether.
  const knot = toWorld(4, -62);
  const pom = { x: rig.pom.x.x, y: rig.pom.y.x };
  segment(knot, pom, 5, INK);
  segment(knot, pom, 2.5, HAT_KNIT);
  disc(pom, 11, POM, 3);
  ctx.fillStyle = HAT_BRIM;
  for (let i = 0; i < 5; i += 1) { const a = i * 1.257 + t * 0.5; ctx.beginPath(); ctx.arc(pom.x + Math.cos(a) * 5, pom.y + Math.sin(a) * 5, 2.2, 0, Math.PI * 2); ctx.fill(); }

  // Pump: barrel, gauge, piston rod, handle.
  const barrel = ctx.createLinearGradient(PUMP.x - 15, 0, PUMP.x + 15, 0);
  barrel.addColorStop(0, '#9e1f33'); barrel.addColorStop(0.42, '#f25b6e'); barrel.addColorStop(1, '#b8283f');
  ctx.beginPath(); ctx.roundRect(PUMP.x - 15, PUMP.barrelTop, 30, PUMP.baseY - 8 - PUMP.barrelTop, 7);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = barrel; ctx.fill();
  ctx.fillStyle = '#f9f1e6';
  ctx.beginPath(); ctx.roundRect(PUMP.x - 15, PUMP.barrelTop + 34, 30, 10, 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '900 8px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PUMP', PUMP.x, PUMP.barrelTop + 39.5, 26);
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.roundRect(PUMP.x - 19, PUMP.barrelTop - 6, 38, 12, 4); ctx.fill();
  drawGauge(ctx, { x: PUMP.x + 30, y: PUMP.barrelTop + 22 }, drive.gauge, t);
  segment({ x: PUMP.x, y: PUMP.barrelTop }, { x: PUMP.x, y: handleY }, 12, INK);
  segment({ x: PUMP.x, y: PUMP.barrelTop }, { x: PUMP.x, y: handleY }, 8, CHROME);
  segment({ x: PUMP.x - 2, y: PUMP.barrelTop - 2 }, { x: PUMP.x - 2, y: handleY }, 2, '#f7ffff');
  ctx.beginPath(); ctx.roundRect(PUMP.x - 36, handleY - 7, 72, 14, 7);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#2a3340'; ctx.fill();
  ctx.strokeStyle = '#4c5a6b'; ctx.lineWidth = 2;
  for (let x = PUMP.x - 28; x <= PUMP.x + 28; x += 7) { ctx.beginPath(); ctx.moveTo(x, handleY - 4); ctx.lineTo(x, handleY + 4); ctx.stroke(); }

  // Front arm over the pump, then its hand.
  const frontShoulder = { x: shoulder.x + 10, y: shoulder.y + 4 };
  const elbow = limb(frontShoulder, frontHand, 62, 66, 1, 18, SKIN);
  segment(frontShoulder, lerpPoint(frontShoulder, elbow, 0.4), 27, INK);
  segment(frontShoulder, lerpPoint(frontShoulder, elbow, 0.4), 23, TEE);
  hand(frontHand, 10, SKIN, release < 0.5);
  ctx.restore();
  return { eyes: worldEyes, head };
}

/** A pressure gauge whose needle climbs with the multiplier and shivers near the red. */
function drawGauge(ctx: CanvasRenderingContext2D, at: Point, gauge: number, t: number): void {
  ctx.beginPath(); ctx.arc(at.x, at.y, 14, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#f6f4ec'; ctx.fill();
  ctx.beginPath(); ctx.arc(at.x, at.y, 10.5, 0.35, 0.95);
  ctx.strokeStyle = '#ef233c'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  for (let i = 0; i <= 6; i += 1) {
    const a = -2.35 + i * 0.55;
    ctx.beginPath(); ctx.moveTo(at.x + Math.cos(a) * 8, at.y + Math.sin(a) * 8); ctx.lineTo(at.x + Math.cos(a) * 11, at.y + Math.sin(a) * 11); ctx.stroke();
  }
  const jitter = Math.sin(t * 37) * 0.09 * gauge * gauge;
  const a = -2.35 + 3.3 * clamp(gauge, 0, 1) + jitter;
  ctx.strokeStyle = '#d62839'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.lineTo(at.x + Math.cos(a) * 11, at.y + Math.sin(a) * 11); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(at.x, at.y, 2.2, 0, Math.PI * 2); ctx.fill();
}
