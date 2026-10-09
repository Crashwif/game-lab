/**
 * The rigs, seen from behind: your frog in a hoodie with the bag on his back, and the Taxman on his heels.
 * Every joint is a few strokes and ellipses posed from the course's state (stride, air, slide, stumble, the
 * knockdown roll, the grab, the hoverboard, the fall into the void); nothing here touches the outcome.
 */
import { CYAN, GOLD, INK, LIME, MONO, PINK, ellipse, line, panel, poly, text } from './art';
import { clamp, mix, smoothstep } from './motion';
import type { Drip } from './stash';

export interface FrogPose {
  /** Where the feet are on the picture, and the px per lane width there. */
  X: number;
  Y: number;
  s: number;
  stride: number;
  /** Lateral velocity in lane widths a second: the lean. */
  lean: number;
  air: boolean;
  vh: number;
  /** How far into the slide, 0 (upright) to 1 (flat). */
  slide: number;
  /** Seconds left in the stumble and the knockdown; -1 or seconds since the Taxman's grab. */
  stumble: number;
  down: number;
  audit: number;
  /** The bag's drawn size follows the coins with a little lag. */
  bag: number;
  drip: ReadonlySet<Drip>;
  /** On the hoverboard, 0 to 1. */
  hover: number;
  /** Falling into the void, 0 to 1. */
  fall: number;
  magnet: boolean;
  double: boolean;
  time: number;
  /** Standing breath, in rig px, lifting the body over planted feet. */
  breath?: number;
  /** 0 to 1: arms up and a look back at the camera as the floor goes. */
  scare?: number;
}

const SKIN = '#4faa46';
const SKIN_LIGHT = '#6cc75c';
const HOODIE = '#5b3fd6';
const HOODIE_DARK = '#3d2a99';
const BAG = '#a8642a';
const BAG_DARK = '#6e3f14';
const DOWN_S = 0.9;

/** The bag's radius in rig px for a bag of `coins`: it swells, but never past the frog. */
export const bagRadius = (coins: number): number => 16 + 22 * clamp(Math.log10(1 + Math.max(0, coins)) / 3.4, 0, 1);

function limb(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], c: [number, number], colour: string, width: number, end?: string, endR = 7): void {
  line(ctx, [a, b, c], colour, width);
  if (end) ellipse(ctx, c[0], c[1], endR, endR * 0.8, end, INK, 1.5);
}

/**
 * Two fixed bones above track-space contacts, independent of torso lean and bob. The hips sit high under the
 * hoodie and the lift is modest, so the reach stays long and the knees stay inside the torso's width.
 */
export function runnerLegs(p: FrogPose) {
  const cycle = p.stride * Math.PI * 2;
  const bob = (p.air || p.slide > .3 ? 0 : Math.abs(Math.sin(cycle)) * 4 * (1 - clamp(p.hover, 0, 1))) + (p.breath ?? 0);
  const angle = -p.lean * .05 + (Math.sin(p.time * 40) * .12 * Math.max(0, p.stumble / .5));
  const sx = 1 + .22 * p.slide, sy = 1 - .48 * p.slide;
  return { bob, legs: [-1, 1].map((side, i) => {
    const phase = cycle + i * Math.PI;
    const lift = p.air ? 18 : Math.max(0, Math.sin(phase)) * 16 * (1 - clamp(p.hover, 0, 1));
    const contact = { x: side * 11, y: -lift };
    const foot: [number, number] = [(contact.x * Math.cos(angle) + contact.y * Math.sin(angle)) / sx, (-contact.x * Math.sin(angle) + contact.y * Math.cos(angle) + bob) / sy];
    const hip: [number, number] = [side * 10, -54];
    const dx = foot[0] - hip[0], dy = foot[1] - hip[1], distance = Math.max(.001, Math.hypot(dx, dy));
    // Crouch the pelvis to retain the foot contact if a slide needs more reach.
    if (distance > 59.9) { const k = 59.9 / distance; hip[0] = foot[0] - dx * k; hip[1] = foot[1] - dy * k; }
    const vx = foot[0] - hip[0], vy = foot[1] - hip[1], reach = Math.max(.001, Math.hypot(vx, vy));
    const bend = Math.sqrt(Math.max(0, 30 * 30 - reach * reach / 4));
    const knee: [number, number] = [(hip[0] + foot[0]) / 2 + side * vy / reach * bend, (hip[1] + foot[1]) / 2 - side * vx / reach * bend];
    return { hip, knee, foot, contact };
  }) };
}

export function drawFrog(ctx: CanvasRenderingContext2D, p: FrogPose): void {
  const k = (p.s * 0.7) / 130;
  const downK = p.down > 0 ? 1 - p.down / DOWN_S : 0;
  const stumbleK = p.stumble > 0 ? p.stumble / 0.5 : 0;
  const cycle = p.stride * Math.PI * 2;
  const { bob, legs } = runnerLegs(p);
  ctx.save();
  ctx.translate(p.X, p.Y);
  ctx.scale(k, k);
  if (p.fall > 0) ctx.rotate(p.fall * 5);
  else ctx.rotate(-p.lean * 0.05 + (Math.sin(p.time * 40) * 0.12 * stumbleK));
  if (downK > 0) {
    // The knockdown: one roll along the rails and back up.
    ctx.translate(0, -Math.sin(downK * Math.PI) * 26 - 30);
    ctx.rotate(downK * Math.PI * 2);
    ctx.translate(0, 30);
  }
  if (p.hover > 0) {
    // The golden EXIT LIQUIDITY board, tilting with the lean and humming.
    const tilt = -p.lean * 0.12 + (Math.sin(p.time * 5) * 0.03);
    ctx.save();
    ctx.rotate(tilt);
    const glow = ctx.createRadialGradient(0, 8, 4, 0, 8, 70);
    glow.addColorStop(0, 'rgba(95, 242, 230, 0.55)');
    glow.addColorStop(1, 'rgba(95, 242, 230, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-80, -30, 160, 90);
    panel(ctx, -46, 2, 92, 14, GOLD, '#8a6a00', 7, 2);
    text(ctx, 'EXIT LIQUIDITY', 0, 9, 8, '#3a2a00', 'center', 84);
    ctx.restore();
  }
  ctx.translate(0, -bob);
  // The slide flattens the whole rig.
  ctx.scale(1 + 0.22 * p.slide, 1 - 0.48 * p.slide);

  // Track contacts are inverse-transformed before solving; the body's bob cannot lift them.
  for (const leg of legs) limb(ctx, leg.hip, leg.knee, leg.foot, HOODIE_DARK, 13, '#24262f', 8);
  // The torso and the bunched hood.
  panel(ctx, -28, -100, 56, 52, HOODIE, INK, 14, 2.5);
  line(ctx, [[-22, -60], [22, -60]], HOODIE_DARK, 3);
  ellipse(ctx, 0, -97, 25, 9, HOODIE_DARK, INK, 1.5);
  if (p.drip.has('cape')) {
    const flap = Math.sin(p.time * 9) * 8 + p.lean * 14;
    ctx.beginPath();
    ctx.moveTo(-26, -92);
    ctx.bezierCurveTo(-40 + flap, -60, -44 + flap, -30, -30 + flap * 1.4, -12);
    ctx.lineTo(30 + flap * 1.4, -12);
    ctx.bezierCurveTo(44 + flap, -30, 40 + flap, -60, 26, -92);
    ctx.closePath();
    ctx.fillStyle = LIME;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, 'WAGMI', flap * 0.7, -48, 15, '#2a3a00', 'center', 50);
  }
  // The bag on his back: the round's score, swelling with every coin; the Taxman's grab yanks it.
  const r = bagRadius(p.bag);
  const grab = p.audit >= 0 && p.audit < 0.6 ? p.audit / 0.6 : 0;
  ctx.save();
  ctx.translate(0, -78 + grab * 90);
  ctx.scale(1 + grab * 0.6, 1 + grab * 0.6);
  ctx.rotate(Math.sin(cycle) * 0.06 - p.lean * 0.1);
  ellipse(ctx, 0, 0, r, r * 0.96, BAG, BAG_DARK, 2.5);
  ellipse(ctx, 0, -r * 0.92, r * 0.42, r * 0.22, BAG_DARK, INK, 1.5);
  ellipse(ctx, -r * 0.3, -r * 0.3, r * 0.22, r * 0.14, 'rgba(255, 255, 255, 0.18)');
  text(ctx, '$', 0, r * 0.06, r * 1.2, '#f7e2a0', 'center');
  ctx.restore();
  // Arms swing against the legs; up in the air, out on the slide, flailing in a stumble, thrown up as the floor goes.
  const scare = clamp(p.scare ?? 0, 0, 1);
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1;
    const phase = cycle + i * Math.PI;
    // The slide spreads the arms in proportion, so they blend in and out with it rather than snapping.
    const slide = clamp(p.slide, 0, 1);
    const swing = p.air ? -1 : -Math.sin(phase) * (1 - slide);
    const flail = stumbleK > 0 ? Math.sin(p.time * 35 + i) * 20 : 0;
    const shake = scare > 0 ? Math.sin(p.time * 31 + i * 2) * 5 * scare : 0;
    const shoulder: [number, number] = [side * 28, -90];
    const elbow: [number, number] = [side * mix(36 + 22 * slide, 42, scare), mix(-72 - swing * 14 + flail, -118, scare)];
    const hand: [number, number] = [side * mix(34 + 44 * slide + (p.air ? 8 : 0), 38, scare), mix(p.air ? -110 : -56 - swing * 22 + flail, -150 + shake, scare)];
    limb(ctx, shoulder, elbow, hand, HOODIE, 11, p.drip.has('gloves') ? CYAN : SKIN, 8);
  }
  // The head: a frog from behind, the eyes bulging over the top; a cap or a crown when earned. Scared, he looks
  // back over his shoulder at the camera: the whites of his eyes and an open mouth.
  ellipse(ctx, 0, -118, 25, 24, SKIN, INK, 2.5);
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 13, -136, 9.5, 9, SKIN_LIGHT, INK, 2);
    if (scare > 0.3) {
      ellipse(ctx, side * 13 - 2, -135, 7 * scare, 7 * scare, '#fff', INK, 1.5);
      ellipse(ctx, side * 13 - 3, -134, 2.6 * scare, 2.8 * scare, INK);
    }
  }
  if (scare > 0.3) ellipse(ctx, -3, -108, 5 * scare, 6.5 * scare, '#3a1020', INK, 1.5);
  if (p.drip.has('cap')) {
    ctx.beginPath();
    ctx.arc(0, -124, 24, Math.PI, 0);
    ctx.fillStyle = PINK;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    panel(ctx, -14, -126, 28, 9, '#c2185b', INK, 3, 1.5);
    text(ctx, 'gm', 0, -136, 11, '#fff', 'center');
  }
  if (p.drip.has('crown')) {
    poly(ctx, [[-18, -142], [-12, -160], [-6, -146], [0, -164], [6, -146], [12, -160], [18, -142]], GOLD, '#8a6a00', 2);
  }
  // A power-up shows on him: a magnet ring, or the 2× leverage sparks.
  if (p.magnet) {
    const pulse = 1 + Math.sin(p.time * 8) * 0.06;
    ctx.beginPath();
    ctx.ellipse(0, -80, 58 * pulse, 70 * pulse, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(95, 242, 230, 0.65)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -p.time * 60;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (p.double) {
    for (let i = 0; i < 4; i += 1) {
      const a = p.time * 3 + i * Math.PI * 0.5;
      text(ctx, '2×', Math.cos(a) * 52, -90 + Math.sin(a) * 40, 13, '#c4b5fd', 'center');
    }
  }
  ctx.restore();
}

export interface TaxmanPose {
  X: number;
  Y: number;
  /** Scale relative to the rig's 170 px height. */
  k: number;
  /** 0 to 1: how far into the frame he is. */
  heat: number;
  /** Where the reaching hand goes (picture coordinates), for the grab; null keeps the arm pumping. */
  reachTo: { x: number; y: number } | null;
  /** How far the grab has gone, 0 to 1; the hand holds the bag past a half. */
  grab: number;
  /** Standing on the platform, before the round. */
  idle: boolean;
  fall: number;
  time: number;
  /** The run cycle in radians, integrated from the course speed; the clock drives it when absent. */
  cycle?: number;
  /** 0 to 1: shaking a fist at the frog as the round leaves the platform. */
  fist?: number;
}

export function drawTaxman(ctx: CanvasRenderingContext2D, p: TaxmanPose): void {
  ctx.save();
  ctx.globalAlpha = p.idle ? 1 : clamp(p.heat * 3, 0, 1);
  ctx.translate(p.X, p.Y);
  ctx.scale(p.k, p.k);
  if (p.fall > 0) ctx.rotate(p.fall * 4);
  const cycle = p.idle ? 0 : p.cycle ?? p.time * 9;
  const bob = p.idle ? 0 : Math.abs(Math.sin(cycle)) * 5;
  const fist = clamp(p.fist ?? 0, 0, 1);
  ctx.translate(0, -bob);
  // Trousers and shoes; on the platform one foot taps, impatient.
  const tap = p.idle ? Math.max(0, Math.sin(p.time * Math.PI * 4)) * 7 * (1 - fist) : 0;
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1;
    const lift = p.idle ? (i ? tap : 0) : Math.max(0, Math.sin(cycle + i * Math.PI)) * 26;
    limb(ctx, [side * 14, -66], [side * 16, -34 - lift * 0.5], [side * 15, -lift], '#1f2130', 16, '#0b0c14', 10);
  }
  // The jacket, the department on its back, the briefcase.
  panel(ctx, -38, -150, 76, 88, '#3a3d4d', INK, 12, 2.5);
  line(ctx, [[0, -146], [0, -70]], '#2a2c3a', 2);
  text(ctx, 'AUDIT DEPT.', 0, -104, 10, '#c9cbe0', 'center', 66, MONO);
  panel(ctx, -66, -74, 38, 30, '#4a2e12', INK, 4, 2);
  text(ctx, 'TAX', -47, -59, 13, GOLD, 'center', 34);
  limb(ctx, [-34, -138], [-50, -110], [-50, -80], '#3a3d4d', 11, '#e8c39e', 7);
  // The reaching arm: pumping on the run, stretched to the bag in the grab.
  const shoulder: [number, number] = [34, -138];
  if (p.reachTo) {
    const tx = (p.reachTo.x - p.X) / p.k, ty = (p.reachTo.y - p.Y) / p.k + bob;
    const hx = mix(50, tx, smoothstep(0, 0.45, p.grab) * (1 - smoothstep(0.55, 1, p.grab)));
    const hy = mix(-100, ty, smoothstep(0, 0.45, p.grab) * (1 - smoothstep(0.55, 1, p.grab)));
    limb(ctx, shoulder, [(shoulder[0] + hx) / 2 + 10, (shoulder[1] + hy) / 2], [hx, hy], '#3a3d4d', 11, '#e8c39e', 8);
    if (p.grab > 0.55) ellipse(ctx, hx, hy + 12, 16, 15, '#a8642a', '#6e3f14', 2);
  } else if (fist > 0) {
    // The fist, raised over the hat and shaking.
    const shake = Math.sin(p.time * 26) * 7;
    limb(ctx, shoulder, [mix(52, 58, fist), mix(-112, -170, fist)], [mix(56, 50 + shake, fist), mix(-84, -220, fist)], '#3a3d4d', 11, '#e8c39e', 9);
  } else {
    const swing = p.idle ? 0 : Math.sin(cycle) * 18;
    limb(ctx, shoulder, [52, -112 + swing], [56, -84 - swing], '#3a3d4d', 11, '#e8c39e', 7);
  }
  // The head from behind, with the hat every auditor is issued.
  ellipse(ctx, 0, -168, 21, 22, '#e8c39e', INK, 2.5);
  ellipse(ctx, 0, -180, 25, 9, '#14151f', INK, 2);
  panel(ctx, -18, -204, 36, 26, '#14151f', INK, 5, 2);
  line(ctx, [[-18, -184], [18, -184]], PINK, 3);
  if (p.idle) {
    panel(ctx, -46, -238, 92, 24, '#0e1024', PINK, 4, 2);
    text(ctx, fist > 0.5 ? 'COME BACK HERE' : 'WAITING FOR YOU', 0, -226, 9, PINK, 'center', 84, MONO);
  }
  ctx.restore();
}

/** The shadow under a rig, thinning as it leaves the ground. */
export function drawShadow(ctx: CanvasRenderingContext2D, X: number, Y: number, s: number, height: number): void {
  const k = clamp(1 - height * 0.8, 0.25, 1);
  ellipse(ctx, X, Y, s * 0.26 * k, s * 0.07 * k, `rgba(0, 0, 0, ${0.4 * k})`);
}
