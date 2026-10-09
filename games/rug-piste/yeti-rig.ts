/** Presentation-only two-bone arm rig. Crash age drives it; it never reads or chooses an outcome. */
export interface Point { x: number; y: number }
export interface ArmPose {
  shoulder: Point; elbow: Point; wrist: Point; side: -1 | 1; grip: number;
}
export interface SkierPose {
  /** Torso center; the skier's feet are 30 sprite pixels below this pivot. */
  torso: Point; angle: number; scale: number; width: number; visible: boolean; clipMouth: boolean; behind: boolean;
}
export interface YetiPose {
  rise: number; mouth: number; chew: number; arms: readonly ArmPose[]; skier: SkierPose;
  captionReady: boolean; turn: number; turnDirection: -1 | 1; stage: 'pop' | 'grab' | 'turn' | 'lift' | 'feed' | 'chew';
}
export const YETI_SCALE = 0.68;
export const ENDING_SECONDS = 5.25;
export const HOLE_BELOW_SKIER = 75;
export const ARM_LENGTH = 48;
export const MOUTH_TOP = -82;
export const MOUTH_BOTTOM = -38;
/** The impact frame holds this long before the yeti erupts. */
export const HIT_STOP = 0.14;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const smooth = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp = (a: Point, b: Point, t: number): Point => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });

/** Analytic IK, with the elbow bending outwards. An unreachable target is clamped, never stretched. */
export function solveArm(shoulder: Point, target: Point, side: -1 | 1, grip = 0): ArmPose {
  const dx = target.x - shoulder.x, dy = target.y - shoulder.y;
  const distance = Math.hypot(dx, dy);
  const reach = clamp(distance, 0.001, ARM_LENGTH * 2 - 0.001);
  const ux = distance > 0.000001 ? dx / distance : 0;
  const uy = distance > 0.000001 ? dy / distance : -1;
  const half = reach / 2;
  const bend = Math.sqrt(Math.max(0, ARM_LENGTH * ARM_LENGTH - half * half));
  // With the target above the shoulder, the left elbow bends left and the right bends right.
  const elbow = { x: shoulder.x + ux * half - uy * bend * side, y: shoulder.y + uy * half + ux * bend * side };
  return { shoulder, elbow, wrist: { x: shoulder.x + ux * reach, y: shoulder.y + uy * reach }, side, grip };
}

/** The actual transformed jacket contact, shared by the carried sprite and the hand target. */
export function jacketGrip(skier: SkierPose, side: -1 | 1): Point {
  const x = side * 15 * skier.scale * skier.width;
  return { x: skier.torso.x + Math.cos(skier.angle) * x, y: skier.torso.y + Math.sin(skier.angle) * x };
}

/** Hit-stop: hold the impact frame, then catch up within a second so every later beat keeps its time. */
export function impactAge(age: number): number {
  return age <= HIT_STOP ? 0 : age - HIT_STOP * (1 - smooth(age - HIT_STOP));
}

/** All returned points are in native yeti-sprite coordinates, before YETI_SCALE. */
export function yetiPose(age: number, options: {
  /** Original skier x minus hole x, in slope units (before the field's screen scale). */
  skierOffsetX: number; jumpHeight?: number; angle?: number; escaped?: boolean;
  /** Slope pixels the skier is still uphill of the grab spot: a slide to a stop, or a skier still arriving. */
  lead?: number;
}): YetiPose {
  const t = Math.max(0, age);
  const rise = smooth(t / 0.55);
  const reach = smooth((t - 0.4) / 0.7);
  const turn = smooth((t - 1.3) / 0.85);
  const hoist = smooth((t - 2.35) / 0.7);
  const feed = smooth((t - 3.4) / 1.0);
  const release = smooth((t - 3.82) / 0.25);
  const settled = smooth((t - 4.15) / 0.5);
  const startX = options.skierOffsetX / YETI_SCALE;
  const startY = -(HOLE_BELOW_SKIER + 30) / YETI_SCALE;
  const air = ((options.jumpHeight ?? 0) * (1 - smooth(t / 0.55)) + (options.lead ?? 0)) / YETI_SCALE;
  // Turn inwards at either boundary so the carried skier's arc stays on the slope.
  const turnDirection: -1 | 1 = startX > 0 ? -1 : 1;
  const width = 0.35 + 0.65 * Math.abs(Math.cos(Math.PI * turn));
  const skier: SkierPose = {
    torso: {
      x: mix(startX, 0, turn) + Math.sin(turn * Math.PI) * 48 * turnDirection,
      y: mix(mix(mix(startY - air, -100, turn), -176, hoist), 25, feed),
    },
    angle: (options.angle ?? 0) * (1 - reach) + Math.sin(turn * Math.PI) * 0.12 * turnDirection,
    scale: 1 / YETI_SCALE, width,
    visible: !options.escaped && t < 4.4,
    clipMouth: feed > 0,
    behind: turn < 0.5,
  };
  // Fingers close before the turn. Both hands remain attached throughout the turn and big lift.
  const grip = options.escaped ? 0 : smooth((t - 1.03) / 0.13) * (1 - release);
  const bodyWidth = 0.28 + 0.72 * Math.abs(Math.cos(Math.PI * turn));
  const arms = ([-1, 1] as const).map(side => {
    const shoulder = { x: side * 34 * bodyWidth, y: -83 + (1 - rise) * 165 };
    const resting = { x: side * 76, y: -38 + (1 - rise) * 165 };
    const contact = jacketGrip(skier, side);
    const released = { x: side * mix(54, 76, settled), y: mix(-76, -38, settled) };
    const withdrawal = options.escaped ? smooth((t - 1.2) / 0.6) : release;
    const target = lerp(lerp(resting, contact, reach), released, withdrawal);
    return solveArm(shoulder, target, side, grip);
  });
  // The mouth is revealed by the turn, then opens for the held-above-head feeding pose.
  const mouth = smooth((t - 2.55) / 0.65) * (1 - smooth((t - (options.escaped ? 3.25 : 4.32)) / 0.28));
  const chew = options.escaped ? 0 : smooth((t - 4.42) / 0.12) * (1 - smooth((t - 4.95) / 0.3));
  const stage = t < 0.55 ? 'pop' : t < 1.3 ? 'grab' : t < 2.35 ? 'turn' : t < 3.4 ? 'lift' : t < 4.4 ? 'feed' : 'chew';
  return { rise, mouth, chew, arms, skier, turn, turnDirection, stage, captionReady: t >= 4.6 };
}
