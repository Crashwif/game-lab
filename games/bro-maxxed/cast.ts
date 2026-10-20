/**
 * Character rigs, 3-stage gaze lag (eyes -> head -> torso), 8-band physique
 * morphing, two-bone inverse kinematics (`solveLimb`), distance-driven foot
 * gaits (`stepFoot`), mirror reflection pose generation, and supporting cast
 * (Bea, Coach Apex, Vera, Jules, and the sobbing Best Man) for BRO-MAXXED.
 */

import {
  OUTFIT_PALETTES,
  getBandSpec,
  type BandId,
  type GazeTargetId,
  type OutfitPalette,
  type RexPoseTag,
} from './content';
import type { DirectedBeat } from './director';
import {
  clamp,
  mix,
  settleSpring,
  smoothstep,
  solveLimb,
  spring,
  stepFoot,
  stepSpring,
  swingLimb,
  type Joint,
  type Spring,
} from './motion';
import type { SceneLayout } from './portrait';

export const REX_UPPER_ARM = 46;
export const REX_LOWER_ARM = 44;
export const REX_UPPER_LEG = 50;
export const REX_LOWER_LEG = 48;

export const MILO_UPPER_ARM = 44;
export const MILO_LOWER_ARM = 42;
export const MILO_UPPER_LEG = 48;
export const MILO_LOWER_LEG = 46;

export interface LimbSolution {
  shoulderOrHip: Joint;
  joint: Joint;
  end: Joint;
}

export interface CharacterPose {
  root: Joint;
  pelvis: Joint;
  chest: Joint;
  neck: Joint;
  head: Joint;
  leftArm: LimbSolution;
  rightArm: LimbSolution;
  leftLeg: LimbSolution;
  rightLeg: LimbSolution;
  eyeOffset: Joint;
  headYaw: number;
  torsoYaw: number;
  jawScale: number;
  shoulderScale: number;
  bicepScale: number;
  tanMix: number;
  oilSheen: number;
  hairBounce: number;
  vestRipple: number;
  receiptUnspool: number;
  spiritBubbleOffset: number;
  browLiftLeft: number;
  browLiftRight: number;
  smile: number;
  blush: number;
  weddingAttire: number;
}

export interface CastPose {
  rex: CharacterPose;
  rexReflection: CharacterPose;
  milo: CharacterPose;
  sharedHandWorld: Joint;
  handHoldBlend: number;
  reflectionSoloFlex: number;
}

export interface CastState {
  time: number;
  // 3-stage gaze chain: eyes lead (omega 28), head follows (omega 16), torso trails (omega 10)
  eyeX: Spring;
  eyeY: Spring;
  headYaw: Spring;
  torsoYaw: Spring;
  // Body morph springs across the 8 bands
  jawScale: Spring;
  shoulderScale: Spring;
  bicepScale: Spring;
  tanMix: Spring;
  oilSheen: Spring;
  // Secondary motion springs (Page 21)
  hairBounce: Spring;
  vestRipple: Spring;
  receiptLength: Spring;
  spiritBubble: Spring;
  // Acting & locomotion springs
  rexWalkX: Spring;
  rexWalkDist: number;
  miloWalkX: Spring;
  miloWalkDist: number;
  handHold: Spring;
  blush: Spring;
  smile: Spring;
  weddingBlend: Spring;
  miloBrow: Spring;
  miloSmile: Spring;
  reflectionOverride: Spring;
  breathPhase: number;
  flexPhase: number;
  lastBand: BandId;
  lastSlot: number;
  events: {
    bandUp: boolean;
    poseWhoosh: boolean;
  };
}

export function createCast(): CastState {
  return {
    time: 0,
    eyeX: spring(0),
    eyeY: spring(0),
    headYaw: spring(0),
    torsoYaw: spring(0),
    jawScale: spring(1),
    shoulderScale: spring(1),
    bicepScale: spring(1),
    tanMix: spring(0),
    oilSheen: spring(0.05),
    hairBounce: spring(0),
    vestRipple: spring(0),
    receiptLength: spring(0),
    spiritBubble: spring(0),
    rexWalkX: spring(0),
    rexWalkDist: 0,
    miloWalkX: spring(0),
    miloWalkDist: 0,
    handHold: spring(0),
    blush: spring(0),
    smile: spring(0.1),
    weddingBlend: spring(0),
    miloBrow: spring(0.15),
    miloSmile: spring(0.35),
    reflectionOverride: spring(0),
    breathPhase: 0,
    flexPhase: 0,
    lastBand: 1,
    lastSlot: -1,
    events: {
      bandUp: false,
      poseWhoosh: false,
    },
  };
}

export function resetCast(cast: CastState): void {
  cast.time = 0;
  settleSpring(cast.eyeX, 0);
  settleSpring(cast.eyeY, 0);
  settleSpring(cast.headYaw, 0);
  settleSpring(cast.torsoYaw, 0);
  settleSpring(cast.jawScale, 1);
  settleSpring(cast.shoulderScale, 1);
  settleSpring(cast.bicepScale, 1);
  settleSpring(cast.tanMix, 0);
  settleSpring(cast.oilSheen, 0.05);
  settleSpring(cast.hairBounce, 0);
  settleSpring(cast.vestRipple, 0);
  settleSpring(cast.receiptLength, 0);
  settleSpring(cast.spiritBubble, 0);
  settleSpring(cast.rexWalkX, 0);
  cast.rexWalkDist = 0;
  settleSpring(cast.miloWalkX, 0);
  cast.miloWalkDist = 0;
  settleSpring(cast.handHold, 0);
  settleSpring(cast.blush, 0);
  settleSpring(cast.smile, 0.1);
  settleSpring(cast.weddingBlend, 0);
  settleSpring(cast.miloBrow, 0.15);
  settleSpring(cast.miloSmile, 0.35);
  settleSpring(cast.reflectionOverride, 0);
  cast.breathPhase = 0;
  cast.flexPhase = 0;
  cast.lastBand = 1;
  cast.lastSlot = -1;
  cast.events.bandUp = false;
  cast.events.poseWhoosh = false;
}

/** Map a semantic gaze target to normalized (-1..1) horizontal/vertical offsets. */
function gazeVectorFor(target: GazeTargetId): Joint {
  switch (target) {
    case 'mirror':
      return { x: -0.15, y: -0.08 };
    case 'shoulders':
      return { x: -0.35, y: 0.28 };
    case 'phone':
      return { x: -0.75, y: 0.18 };
    case 'milo':
      return { x: 0.92, y: -0.04 };
    case 'exit':
      return { x: 1.0, y: 0.05 };
  }
}

function computeTargetValues(beat: DirectedBeat, layout: SceneLayout) {
  const spec = getBandSpec(beat.band);
  const gazeVec = gazeVectorFor(beat.rexGaze);

  let rexTargetX = layout.rexHome.x;
  let miloTargetX = layout.miloHome.x;
  let handHoldTarget = 0;
  let weddingTarget = 0;
  let blushTarget = 0;
  let smileTarget = 0.15;
  let miloBrowTarget = 0.2;
  let miloSmileTarget = 0.4;
  let reflectionSoloTarget = 0;

  if (beat.mode === 'cashout') {
    const progress = clamp(beat.cashoutAgeSec / 1.1, 0, 1);
    rexTargetX = mix(layout.rexHome.x, layout.exitDoorX - 48, smoothstep(0, 1, progress));
    smileTarget = 0.78;
    miloSmileTarget = 0.65;
    // E01: reflection takes one extra pose before following
    if (beat.cashoutVariant?.id === 'E01' && beat.cashoutAgeSec < 0.75) {
      reflectionSoloTarget = 1;
    }
  } else if (beat.mode === 'crashed') {
    const stage = beat.crashStage;
    if (stage === 'freeze') {
      smileTarget = 0.0;
      miloBrowTarget = 0.45;
      miloSmileTarget = 0.55;
    } else if (stage === 'compliment') {
      blushTarget = 0.65;
      smileTarget = 0.75;
      miloBrowTarget = 0.55;
      miloSmileTarget = 0.8;
    } else if (stage === 'recalculating') {
      blushTarget = 1.0;
      smileTarget = 0.82;
      rexTargetX = mix(layout.rexHome.x, layout.rexWedding.x, 0.45);
      miloTargetX = mix(layout.miloHome.x, layout.miloWedding.x, 0.45);
      miloBrowTarget = 0.5;
      miloSmileTarget = 0.85;
    } else if (stage === 'hand_hold') {
      blushTarget = 0.9;
      smileTarget = 0.92;
      handHoldTarget = 1.0;
      rexTargetX = layout.rexWedding.x;
      miloTargetX = layout.miloWedding.x;
      miloBrowTarget = 0.4;
      miloSmileTarget = 0.92;
    } else {
      // 'wedding' and 'opportunist'
      blushTarget = 0.75;
      smileTarget = 1.0;
      handHoldTarget = 1.0;
      weddingTarget = 1.0;
      rexTargetX = layout.rexWedding.x;
      miloTargetX = layout.miloWedding.x;
      miloBrowTarget = 0.35;
      miloSmileTarget = 1.0;
      if (beat.crashVariant?.id === 'R08') {
        reflectionSoloTarget = 1.0;
      }
    }
  } else if (beat.mode === 'running') {
    if (beat.rexGaze === 'milo') {
      blushTarget = 0.25;
      miloBrowTarget = 0.48;
      miloSmileTarget = 0.65;
    }
    if (beat.gag.id === 'G12') {
      // Intimate tripod: step slightly closer
      rexTargetX = mix(layout.rexHome.x, layout.rexWedding.x, 0.4);
      miloTargetX = mix(layout.miloHome.x, layout.miloWedding.x, 0.4);
    }
  }

  const receiptTarget =
    beat.mode === 'running' && (beat.gag.id === 'G02' || beat.band >= 3)
      ? clamp((beat.band - 1) * 0.22 + beat.slotProgress * 0.45, 0, 1)
      : beat.mode === 'crashed' && beat.instantCrash
        ? 0.35
        : 0;

  const bubbleTarget =
    beat.gag.id === 'G01'
      ? beat.gagStage === 'change'
        ? 0.85 // Slides stubbornly toward Milo!
        : beat.gagStage === 'reaction'
          ? 0.15 // Rex tilts whole body to force it back
          : 0.45
      : 0;

  return {
    spec,
    gazeVec,
    rexTargetX,
    miloTargetX,
    handHoldTarget,
    weddingTarget,
    blushTarget,
    smileTarget,
    miloBrowTarget,
    miloSmileTarget,
    reflectionSoloTarget,
    receiptTarget,
    bubbleTarget,
  };
}

/**
 * Immediately snap all cast springs to the exact pose required by `beat` and `layout`
 * (used on first frame, late entry, or replay seek so nothing animates from rest).
 */
export function settleCast(cast: CastState, beat: DirectedBeat, layout: SceneLayout): void {
  const t = computeTargetValues(beat, layout);
  settleSpring(cast.eyeX, t.gazeVec.x);
  settleSpring(cast.eyeY, t.gazeVec.y);
  settleSpring(cast.headYaw, t.gazeVec.x);
  settleSpring(cast.torsoYaw, t.gazeVec.x * 0.75);
  settleSpring(cast.jawScale, t.spec.jawScale);
  settleSpring(cast.shoulderScale, t.spec.shoulderScale);
  settleSpring(cast.bicepScale, t.spec.bicepScale);
  settleSpring(cast.tanMix, t.spec.tanMix);
  settleSpring(cast.oilSheen, t.spec.oilSheen);
  settleSpring(cast.hairBounce, 0);
  settleSpring(cast.vestRipple, 0);
  settleSpring(cast.receiptLength, t.receiptTarget);
  settleSpring(cast.spiritBubble, t.bubbleTarget);
  settleSpring(cast.rexWalkX, t.rexTargetX);
  cast.rexWalkDist = Math.abs(t.rexTargetX - layout.rexHome.x);
  settleSpring(cast.miloWalkX, t.miloTargetX);
  cast.miloWalkDist = Math.abs(t.miloTargetX - layout.miloHome.x);
  settleSpring(cast.handHold, t.handHoldTarget);
  settleSpring(cast.blush, t.blushTarget);
  settleSpring(cast.smile, t.smileTarget);
  settleSpring(cast.weddingBlend, t.weddingTarget);
  settleSpring(cast.miloBrow, t.miloBrowTarget);
  settleSpring(cast.miloSmile, t.miloSmileTarget);
  settleSpring(cast.reflectionOverride, t.reflectionSoloTarget);
  cast.breathPhase = (beat.slotAgeMs / 1000) * 2.2;
  cast.flexPhase = (beat.slotAgeMs / 1000) * 3.1;
  cast.lastBand = beat.band;
  cast.lastSlot = beat.slotIndex;
  cast.events.bandUp = false;
  cast.events.poseWhoosh = false;
}

/**
 * Advance cast springs and secondary motion forward by `dt` seconds.
 */
export function stepCast(
  cast: CastState,
  beat: DirectedBeat,
  layout: SceneLayout,
  dt: number,
): void {
  const safeDt = clamp(dt, 0, 0.1);
  cast.time += safeDt;
  cast.events.bandUp = false;
  cast.events.poseWhoosh = false;

  if (cast.rexWalkX.x === 0) {
    settleSpring(cast.rexWalkX, layout.rexHome.x);
  }
  if (cast.miloWalkX.x === 0) {
    settleSpring(cast.miloWalkX, layout.miloHome.x);
  }

  if (beat.mode === 'running' && beat.band > cast.lastBand) {
    cast.events.bandUp = true;
    cast.hairBounce.v -= 9;
    cast.vestRipple.v += 11;
  }
  if (beat.mode === 'running' && beat.slotIndex !== cast.lastSlot && cast.lastSlot >= 0) {
    cast.events.poseWhoosh = true;
    cast.hairBounce.v += 6;
  }
  cast.lastBand = beat.band;
  cast.lastSlot = beat.slotIndex;

  const isFrozen = beat.mode === 'crashed' && beat.crashStage === 'freeze';
  const stepDt = isFrozen ? 0 : safeDt;

  cast.breathPhase += stepDt * (1.8 + beat.tension * 1.6);
  cast.flexPhase += stepDt * (2.4 + beat.tension * 2.2);

  const t = computeTargetValues(beat, layout);

  // 3-stage gaze chain (Page 21): eyes (omega 28) -> head (omega 15) -> torso (omega 9)
  stepSpring(cast.eyeX, t.gazeVec.x, 28, 0.85, stepDt);
  stepSpring(cast.eyeY, t.gazeVec.y, 28, 0.85, stepDt);
  stepSpring(cast.headYaw, t.gazeVec.x, 15, 0.72, stepDt);
  stepSpring(cast.torsoYaw, t.gazeVec.x * 0.75, 9, 0.68, stepDt);

  // Physique morph springs
  stepSpring(cast.jawScale, t.spec.jawScale, 12, 0.75, stepDt);
  stepSpring(cast.shoulderScale, t.spec.shoulderScale, 11, 0.72, stepDt);
  stepSpring(cast.bicepScale, t.spec.bicepScale, 13, 0.65, stepDt);
  stepSpring(cast.tanMix, t.spec.tanMix, 8, 0.9, stepDt);
  stepSpring(cast.oilSheen, t.spec.oilSheen, 8, 0.9, stepDt);

  // Secondary motion springs (hair, vest fabric, receipt, spirit bubble)
  stepSpring(cast.hairBounce, Math.sin(cast.flexPhase) * 0.15, 19, 0.28, stepDt);
  stepSpring(cast.vestRipple, Math.sin(cast.breathPhase * 2) * 0.2, 22, 0.32, stepDt);
  stepSpring(cast.receiptLength, t.receiptTarget, 10, 0.75, stepDt);
  stepSpring(cast.spiritBubble, t.bubbleTarget, 14, 0.55, stepDt);

  // Locomotion & distance accumulation for non-skating feet
  const prevRexX = cast.rexWalkX.x;
  const nextRexX = stepSpring(cast.rexWalkX, t.rexTargetX, 10, 0.82, stepDt);
  cast.rexWalkDist += Math.abs(nextRexX - prevRexX);

  const prevMiloX = cast.miloWalkX.x;
  const nextMiloX = stepSpring(cast.miloWalkX, t.miloTargetX, 10, 0.85, stepDt);
  cast.miloWalkDist += Math.abs(nextMiloX - prevMiloX);

  stepSpring(cast.handHold, t.handHoldTarget, 14, 0.8, stepDt);
  stepSpring(cast.blush, t.blushTarget, 12, 0.85, stepDt);
  stepSpring(cast.smile, t.smileTarget, 14, 0.8, stepDt);
  stepSpring(cast.weddingBlend, t.weddingTarget, 12, 0.85, stepDt);
  stepSpring(cast.miloBrow, t.miloBrowTarget, 12, 0.85, stepDt);
  stepSpring(cast.miloSmile, t.miloSmileTarget, 12, 0.85, stepDt);
  stepSpring(cast.reflectionOverride, t.reflectionSoloTarget, 14, 0.75, stepDt);
}

/**
 * Select the two-bone arm solution whose elbow sits naturally outward (`side`)
 * and below the shoulder so elbows never jab inward across the ribcage or flip
 * when hands cross shoulder height.
 */
function solveNaturalArm(
  shoulder: Joint,
  target: Joint,
  upper: number,
  lower: number,
  side: -1 | 1,
): LimbSolution & { root: Joint } {
  const pos = solveLimb(shoulder, target, upper, lower, 1);
  const neg = solveLimb(shoulder, target, upper, lower, -1);
  const scorePos =
    (pos.joint.x - shoulder.x) * side * 0.92 + (pos.joint.y - shoulder.y) * 0.38;
  const scoreNeg =
    (neg.joint.x - shoulder.x) * side * 0.92 + (neg.joint.y - shoulder.y) * 0.38;
  const chosen = scorePos >= scoreNeg ? pos : neg;
  return {
    root: chosen.root,
    shoulderOrHip: chosen.root,
    joint: chosen.joint,
    end: chosen.end,
  };
}

/**
 * Solve a two-bone leg chain with outward knee alignment when standing and
 * forward knee bend when walking so knees never cross over each other in an X.
 */
function solveNaturalLeg(
  hip: Joint,
  footTarget: Joint,
  upper: number,
  lower: number,
  side: -1 | 1,
  walkVelX = 0,
): LimbSolution & { root: Joint } {
  const pole = Math.abs(walkVelX) > 8 ? (walkVelX >= 0 ? -1 : 1) : side < 0 ? 1 : -1;
  const chosen = solveLimb(hip, footTarget, upper, lower, pole);
  return {
    root: chosen.root,
    shoulderOrHip: chosen.root,
    joint: chosen.joint,
    end: chosen.end,
  };
}

/**
 * Pure joint and IK solver producing world-space poses for Rex, his mirror
 * reflection, and Milo (`docs/animation.md`).
 *
 * When `handHold` approaches 1, both Rex's right arm and Milo's left arm
 * solve toward the shared hand-contact point (`sharedHandWorld`) and place
 * their shoulders within reach so both wrists meet at the exact same world point.
 */
export function computeCastPose(
  cast: CastState,
  beat: DirectedBeat,
  layout: SceneLayout,
): CastPose {
  const handHoldBlend = clamp(cast.handHold.x, 0, 1);
  const sharedHandWorld: Joint = {
    x: layout.sharedHandPoint.x,
    y: layout.sharedHandPoint.y,
  };

  const rexReach = REX_UPPER_ARM + REX_LOWER_ARM - 2;
  const miloReach = MILO_UPPER_ARM + MILO_LOWER_ARM - 2;

  // Position Rex and Milo so that during handHold their shoulders are guaranteed within arm reach of sharedHandWorld
  const rexBaseX = mix(
    cast.rexWalkX.x || layout.rexHome.x,
    sharedHandWorld.x - Math.min(54, rexReach * 0.58),
    handHoldBlend,
  );
  const miloBaseX = mix(
    cast.miloWalkX.x || layout.miloHome.x,
    sharedHandWorld.x + Math.min(52, miloReach * 0.58),
    handHoldBlend,
  );

  const rexRoot: Joint = { x: rexBaseX, y: layout.rexHome.y };
  const miloRoot: Joint = { x: miloBaseX, y: layout.miloHome.y };

  // Distance-driven foot targets (Page 21 & docs/animation.md)
  const rexMoving = clamp(Math.abs(cast.rexWalkX.v) / 28, 0, 1);
  const rexDir = cast.rexWalkX.v < -1 ? -1 : 1;
  const rexFootL = stepFoot(cast.rexWalkDist, 56, 0, 10 * rexMoving, rexDir);
  const rexFootR = stepFoot(cast.rexWalkDist, 56, 0.5, 10 * rexMoving, rexDir);

  const rexBob =
    Math.sin(cast.breathPhase) * 2.0 * (1 - handHoldBlend * 0.5) +
    rexMoving * Math.abs(Math.sin((cast.rexWalkDist / 56) * Math.PI * 2)) * 2.4;
  const rexTilt =
    beat.gag.id === 'G01' && beat.gagStage === 'reaction' && beat.mode === 'running'
      ? -0.18 // Rotates torso to center the spirit-level bubble (G01)
      : cast.torsoYaw.x * 0.06;

  const rexPelvis: Joint = {
    x: rexRoot.x + rexTilt * 14,
    y: rexRoot.y - 95 + rexBob,
  };
  const rexChest: Joint = {
    x: rexPelvis.x + Math.sin(rexTilt) * 48,
    y: rexPelvis.y - 58,
  };
  const rexNeck: Joint = {
    x: rexChest.x + cast.headYaw.x * 4,
    y: rexChest.y - 18,
  };
  const rexHead: Joint = {
    x: rexNeck.x + cast.headYaw.x * 5,
    y: rexNeck.y - 22,
  };

  const halfShoulder = 28 * clamp(cast.shoulderScale.x, 1, 1.85);
  const rexLeftShoulder: Joint = {
    x: rexChest.x - halfShoulder,
    y: rexChest.y - 6,
  };
  // Pull right shoulder smoothly toward sharedHandWorld during hand-hold so reach is always comfortable
  const rexRightShoulder: Joint = {
    x: mix(rexChest.x + halfShoulder, sharedHandWorld.x - 42, handHoldBlend),
    y: mix(rexChest.y - 6, sharedHandWorld.y - 18, handHoldBlend),
  };

  // Left arm target by gag/pose
  const flexOsc = Math.sin(cast.flexPhase) * 8;
  let rexLeftTarget: Joint = {
    x: rexLeftShoulder.x - 24,
    y: rexLeftShoulder.y + 44 + flexOsc * 0.3,
  };
  if (beat.mode === 'running') {
    switch (beat.rexPose) {
      case 'level_chin':
        // Holding spirit level or jawline protractor right under his chin (G01 / G06)
        rexLeftTarget = {
          x: Math.min(rexHead.x - 24, rexLeftShoulder.x - 10),
          y: rexHead.y + 22,
        };
        break;
      case 'receipt_fold':
        // Holding unspooling upgrade receipt (G02)
        rexLeftTarget = { x: rexLeftShoulder.x - 32, y: rexLeftShoulder.y + 24 };
        break;
      case 'science_notes':
        // Holding OBJECTIVE SCIENCE notebook near chest (G05)
        rexLeftTarget = { x: rexLeftShoulder.x - 18, y: rexChest.y + 12 };
        break;
      case 'heroic_flex':
      case 'shoulder_audit':
        // Double bicep pose!
        rexLeftTarget = {
          x: rexLeftShoulder.x - 36,
          y: rexLeftShoulder.y - 24 + flexOsc * 0.4,
        };
        break;
      case 'candid_retake':
      case 'boardroom_pitch':
        rexLeftTarget = { x: rexLeftShoulder.x - 38, y: rexLeftShoulder.y + 8 };
        break;
      default:
        rexLeftTarget = { x: rexLeftShoulder.x - 26, y: rexLeftShoulder.y + 34 };
        break;
    }
  } else if (beat.mode === 'cashout') {
    // Carrying gym bag or water bottle out
    rexLeftTarget = { x: rexLeftShoulder.x - 18, y: rexLeftShoulder.y + 52 };
  } else if (beat.mode === 'crashed' && handHoldBlend > 0.5) {
    // Holding wedding bouquet / protein shaker on left side
    rexLeftTarget = { x: rexLeftShoulder.x - 22, y: rexLeftShoulder.y + 28 };
  }

  // Right arm target: flex / chin touch / wave / shared hand-hold!
  let rexRightFreeTarget: Joint = {
    x: rexRightShoulder.x + 34,
    y: rexRightShoulder.y - 18 - flexOsc * 0.4,
  };
  if (beat.mode === 'running' && beat.rexPose === 'level_chin') {
    rexRightFreeTarget = {
      x: Math.max(rexHead.x + 24, rexRightShoulder.x + 10),
      y: rexHead.y + 22,
    };
  } else if (beat.mode === 'running' && beat.rexPose === 'science_notes') {
    rexRightFreeTarget = { x: rexRightShoulder.x + 18, y: rexChest.y + 10 };
  } else if (beat.mode === 'cashout') {
    rexRightFreeTarget = { x: rexRightShoulder.x + 24, y: rexRightShoulder.y + 38 };
  }

  const rexLeftArmSol = solveNaturalArm(
    rexLeftShoulder,
    rexLeftTarget,
    REX_UPPER_ARM,
    REX_LOWER_ARM,
    -1,
  );
  const rexRightFreeSol = solveNaturalArm(
    rexRightShoulder,
    rexRightFreeTarget,
    REX_UPPER_ARM,
    REX_LOWER_ARM,
    1,
  );
  const rexRightHoldSol = solveNaturalArm(
    rexRightShoulder,
    sharedHandWorld,
    REX_UPPER_ARM,
    REX_LOWER_ARM,
    1,
  );
  const rexRightArmSol = swingLimb(
    rexRightShoulder,
    rexRightFreeSol,
    rexRightHoldSol,
    handHoldBlend,
    REX_UPPER_ARM,
    REX_LOWER_ARM,
  );

  const rexLeftHip: Joint = { x: rexPelvis.x - 15, y: rexPelvis.y };
  const rexRightHip: Joint = { x: rexPelvis.x + 15, y: rexPelvis.y };
  const rexLeftFootTarget: Joint = {
    x: rexRoot.x - 16 + rexFootL.x * rexMoving,
    y: rexRoot.y + rexFootL.y,
  };
  const rexRightFootTarget: Joint = {
    x: rexRoot.x + 16 + rexFootR.x * rexMoving,
    y: rexRoot.y + rexFootR.y,
  };
  const rexLeftLegSol = solveNaturalLeg(
    rexLeftHip,
    rexLeftFootTarget,
    REX_UPPER_LEG,
    REX_LOWER_LEG,
    -1,
    cast.rexWalkX.v,
  );
  const rexRightLegSol = solveNaturalLeg(
    rexRightHip,
    rexRightFootTarget,
    REX_UPPER_LEG,
    REX_LOWER_LEG,
    1,
    cast.rexWalkX.v,
  );

  const rexPose: CharacterPose = {
    root: rexRoot,
    pelvis: rexPelvis,
    chest: rexChest,
    neck: rexNeck,
    head: rexHead,
    leftArm: rexLeftArmSol,
    rightArm: { shoulderOrHip: rexRightShoulder, ...rexRightArmSol },
    leftLeg: rexLeftLegSol,
    rightLeg: rexRightLegSol,
    eyeOffset: { x: clamp(cast.eyeX.x, -1, 1), y: clamp(cast.eyeY.x, -1, 1) },
    headYaw: clamp(cast.headYaw.x, -1, 1),
    torsoYaw: clamp(cast.torsoYaw.x, -1, 1),
    jawScale: clamp(cast.jawScale.x, 1, 1.9),
    shoulderScale: clamp(cast.shoulderScale.x, 1, 1.9),
    bicepScale: clamp(cast.bicepScale.x, 1, 1.95),
    tanMix: clamp(cast.tanMix.x, 0, 1),
    oilSheen: clamp(cast.oilSheen.x, 0, 1),
    hairBounce: cast.hairBounce.x,
    vestRipple: cast.vestRipple.x,
    receiptUnspool: clamp(cast.receiptLength.x, 0, 1),
    spiritBubbleOffset: clamp(cast.spiritBubble.x, -1, 1),
    browLiftLeft: beat.mode === 'crashed' && beat.crashStage !== 'freeze' ? 0.25 : 0.75,
    browLiftRight: beat.mode === 'crashed' && beat.crashStage !== 'freeze' ? 0.25 : -0.35,
    smile: clamp(cast.smile.x, 0, 1),
    blush: clamp(cast.blush.x, 0, 1),
    weddingAttire: clamp(cast.weddingBlend.x, 0, 1),
  };

  // Mirror Reflection Pose (Page 11, 12, 21):
  // Constructed from the same rig state centered inside `layout.mirrorRect`,
  // or holding a solo heroic double-bicep flex during E01 / R08!
  const soloFlex = clamp(cast.reflectionOverride.x, 0, 1);
  const mirrorCenter: Joint = {
    x: layout.mirrorRect.x + layout.mirrorRect.w * 0.46,
    y: layout.mirrorRect.y + layout.mirrorRect.h * 0.88,
  };
  const refTilt = mix(rexTilt, 0, soloFlex);
  const refPelvis: Joint = {
    x: mirrorCenter.x + refTilt * 10,
    y: mirrorCenter.y - 80 + rexBob * 0.8,
  };
  const refChest: Joint = {
    x: refPelvis.x + Math.sin(refTilt) * 40,
    y: refPelvis.y - 50,
  };
  const refNeck: Joint = { x: refChest.x - cast.headYaw.x * 3, y: refChest.y - 16 };
  const refHead: Joint = { x: refNeck.x - cast.headYaw.x * 4, y: refNeck.y - 20 };
  const refLShoulder: Joint = { x: refChest.x - halfShoulder * 0.85, y: refChest.y - 5 };
  const refRShoulder: Joint = { x: refChest.x + halfShoulder * 0.85, y: refChest.y - 5 };

  const refLTarget: Joint = {
    x: mix(
      refLShoulder.x + (rexPose.leftArm.end.x - rexLeftShoulder.x) * 0.85,
      refLShoulder.x - 32,
      soloFlex,
    ),
    y: mix(
      refLShoulder.y + (rexPose.leftArm.end.y - rexLeftShoulder.y) * 0.85,
      refLShoulder.y - 24,
      soloFlex,
    ),
  };
  const refRTarget: Joint = {
    x: mix(
      refRShoulder.x + (rexPose.rightArm.end.x - rexRightShoulder.x) * 0.85,
      refRShoulder.x + 32,
      soloFlex,
    ),
    y: mix(
      refRShoulder.y + (rexPose.rightArm.end.y - rexRightShoulder.y) * 0.85,
      refRShoulder.y - 24,
      soloFlex,
    ),
  };
  const refLArm = solveNaturalArm(
    refLShoulder,
    refLTarget,
    REX_UPPER_ARM * 0.85,
    REX_LOWER_ARM * 0.85,
    -1,
  );
  const refRArm = solveNaturalArm(
    refRShoulder,
    refRTarget,
    REX_UPPER_ARM * 0.85,
    REX_LOWER_ARM * 0.85,
    1,
  );
  const refLHip: Joint = { x: refPelvis.x - 13, y: refPelvis.y };
  const refRHip: Joint = { x: refPelvis.x + 13, y: refPelvis.y };
  const refLLeg = solveNaturalLeg(
    refLHip,
    { x: mirrorCenter.x - 14, y: mirrorCenter.y },
    REX_UPPER_LEG * 0.85,
    REX_LOWER_LEG * 0.85,
    -1,
  );
  const refRLeg = solveNaturalLeg(
    refRHip,
    { x: mirrorCenter.x + 14, y: mirrorCenter.y },
    REX_UPPER_LEG * 0.85,
    REX_LOWER_LEG * 0.85,
    1,
  );

  const rexReflection: CharacterPose = {
    ...rexPose,
    root: mirrorCenter,
    pelvis: refPelvis,
    chest: refChest,
    neck: refNeck,
    head: refHead,
    leftArm: refLArm,
    rightArm: refRArm,
    leftLeg: refLLeg,
    rightLeg: refRLeg,
    eyeOffset: { x: -rexPose.eyeOffset.x, y: rexPose.eyeOffset.y },
    weddingAttire: soloFlex > 0.5 ? 0 : rexPose.weddingAttire,
  };

  // Milo Pose (Page 5 & 21):
  // Calm, grounded posture in plum shirt; left hand solves to `sharedHandWorld` on hand-hold!
  const miloMoving = clamp(Math.abs(cast.miloWalkX.v) / 28, 0, 1);
  const miloDir = cast.miloWalkX.v < -1 ? -1 : 1;
  const miloFootL = stepFoot(cast.miloWalkDist, 52, 0, 8 * miloMoving, miloDir);
  const miloFootR = stepFoot(cast.miloWalkDist, 52, 0.5, 8 * miloMoving, miloDir);

  const miloBob =
    Math.sin(cast.breathPhase * 0.75 + 1.1) * 1.4 +
    miloMoving * Math.abs(Math.sin((cast.miloWalkDist / 52) * Math.PI * 2)) * 2.0;
  const miloPelvis: Joint = { x: miloRoot.x, y: miloRoot.y - 91 + miloBob };
  const miloChest: Joint = { x: miloPelvis.x, y: miloPelvis.y - 56 };
  const miloNeck: Joint = { x: miloChest.x - 2, y: miloChest.y - 17 };
  const miloHead: Joint = { x: miloNeck.x - 3, y: miloNeck.y - 21 };

  const miloLeftShoulder: Joint = {
    x: mix(miloChest.x - 26, sharedHandWorld.x + 40, handHoldBlend),
    y: mix(miloChest.y - 5, sharedHandWorld.y - 18, handHoldBlend),
  };
  const miloRightShoulder: Joint = {
    x: miloChest.x + 26,
    y: miloChest.y - 5,
  };

  const miloLeftFreeTarget: Joint =
    beat.miloAction === 'spot_offer' || beat.miloAction === 'compliment'
      ? { x: miloLeftShoulder.x - 32, y: miloLeftShoulder.y + 12 }
      : { x: miloLeftShoulder.x - 20, y: miloLeftShoulder.y + 40 };

  // Right hand rests near the squat rack bar or holds a dumbbell
  const miloRightTarget: Joint =
    beat.miloAction === 'rerack'
      ? {
          x: miloRightShoulder.x + 26,
          y: miloRightShoulder.y + 20 + Math.sin(cast.breathPhase) * 5,
        }
      : { x: miloRightShoulder.x + 20, y: miloRightShoulder.y + 40 };

  const miloLeftFreeSol = solveNaturalArm(
    miloLeftShoulder,
    miloLeftFreeTarget,
    MILO_UPPER_ARM,
    MILO_LOWER_ARM,
    -1,
  );
  const miloLeftHoldSol = solveNaturalArm(
    miloLeftShoulder,
    sharedHandWorld,
    MILO_UPPER_ARM,
    MILO_LOWER_ARM,
    -1,
  );
  const miloLeftArmSol = swingLimb(
    miloLeftShoulder,
    miloLeftFreeSol,
    miloLeftHoldSol,
    handHoldBlend,
    MILO_UPPER_ARM,
    MILO_LOWER_ARM,
  );
  const miloRightArmSol = solveNaturalArm(
    miloRightShoulder,
    miloRightTarget,
    MILO_UPPER_ARM,
    MILO_LOWER_ARM,
    1,
  );

  const miloLeftHip: Joint = { x: miloPelvis.x - 14, y: miloPelvis.y };
  const miloRightHip: Joint = { x: miloPelvis.x + 14, y: miloPelvis.y };
  const miloLeftLegSol = solveNaturalLeg(
    miloLeftHip,
    { x: miloRoot.x - 15 + miloFootL.x * miloMoving, y: miloRoot.y + miloFootL.y },
    MILO_UPPER_LEG,
    MILO_LOWER_LEG,
    -1,
    cast.miloWalkX.v,
  );
  const miloRightLegSol = solveNaturalLeg(
    miloRightHip,
    { x: miloRoot.x + 15 + miloFootR.x * miloMoving, y: miloRoot.y + miloFootR.y },
    MILO_UPPER_LEG,
    MILO_LOWER_LEG,
    1,
    cast.miloWalkX.v,
  );

  const miloPose: CharacterPose = {
    root: miloRoot,
    pelvis: miloPelvis,
    chest: miloChest,
    neck: miloNeck,
    head: miloHead,
    leftArm: { shoulderOrHip: miloLeftShoulder, ...miloLeftArmSol },
    rightArm: miloRightArmSol,
    leftLeg: miloLeftLegSol,
    rightLeg: miloRightLegSol,
    eyeOffset: { x: -0.65, y: 0 },
    headYaw: -0.35,
    torsoYaw: -0.2,
    jawScale: 1.08,
    shoulderScale: 1.15,
    bicepScale: 1.18,
    tanMix: 0.25,
    oilSheen: 0.1,
    hairBounce: 0,
    vestRipple: 0,
    receiptUnspool: 0,
    spiritBubbleOffset: 0,
    browLiftLeft: cast.miloBrow.x,
    browLiftRight: cast.miloBrow.x * 0.5,
    smile: clamp(cast.miloSmile.x, 0, 1),
    blush: handHoldBlend * 0.45,
    weddingAttire: clamp(cast.weddingBlend.x, 0, 1),
  };

  return {
    rex: rexPose,
    rexReflection,
    milo: miloPose,
    sharedHandWorld,
    handHoldBlend,
    reflectionSoloFlex: soloFlex,
  };
}

// ---- Character Drawing Helpers ----------------------------------------------

function interpolateSkin(tanMix: number): string {
  const r = Math.round(mix(238, 204, tanMix));
  const g = Math.round(mix(192, 124, tanMix));
  const b = Math.round(mix(162, 72, tanMix));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawLimbSegment(
  ctx: CanvasRenderingContext2D,
  a: Joint,
  b: Joint,
  thickness: number,
  fill: string,
  sheen = 0,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  // Crisp comic outline for clean limb separation & z-layering
  ctx.strokeStyle = '#171513';
  ctx.lineWidth = thickness + 2.6;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  ctx.strokeStyle = fill;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  if (sheen > 0.2) {
    ctx.strokeStyle = `rgba(255, 248, 220, ${sheen * 0.42})`;
    ctx.lineWidth = Math.max(2, thickness * 0.26);
    ctx.beginPath();
    ctx.moveTo(a.x - 1.5, a.y - 1.5);
    ctx.lineTo(b.x - 1.5, b.y - 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSleeveCap(
  ctx: CanvasRenderingContext2D,
  shoulder: Joint,
  elbow: Joint,
  thickness: number,
  color: string,
  lengthRatio = 0.48,
): void {
  const endX = mix(shoulder.x, elbow.x, lengthRatio);
  const endY = mix(shoulder.y, elbow.y, lengthRatio);
  drawLimbSegment(ctx, shoulder, { x: endX, y: endY }, thickness, color);
}

/**
 * Draw Rex (or his mirror reflection from the same rig state) with separate
 * head, eyes, brows, jaw, torso, and two-bone IK limbs.
 * Z-order: ground shadow -> halo -> legs & shoes -> shorts/pelvis -> upper arms & sleeves
 * -> torso & outfit -> neck, head & face -> forearms, hands & foreground gag props.
 */
export function drawRexFigure(
  ctx: CanvasRenderingContext2D,
  pose: CharacterPose,
  beat: DirectedBeat,
  palette: OutfitPalette = OUTFIT_PALETTES[0]!,
  isReflection = false,
): void {
  const skin = interpolateSkin(pose.tanMix);
  const scale = isReflection ? 0.84 : 1;
  const bicepR = 12 * pose.bicepScale * scale;
  const forearmR = 10 * Math.sqrt(pose.bicepScale) * scale;

  ctx.save();
  if (isReflection) {
    ctx.globalAlpha = 0.82;
  } else {
    // Ground contact shadow
    ctx.fillStyle = 'rgba(9, 11, 16, 0.42)';
    ctx.beginPath();
    ctx.ellipse(pose.root.x, pose.root.y + 3, 34 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Halo ring-light glow behind Rex at Band 5+
  if (!isReflection && beat.bandSpec.ringLights >= 2 && beat.mode === 'running') {
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 250, 210, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pose.head.x, pose.head.y - 4, 34 * scale, 0, Math.PI * 2);
    ctx.stroke();
    if (beat.bandSpec.ringLights >= 3) {
      ctx.strokeStyle = 'rgba(213, 251, 109, 0.45)';
      ctx.beginPath();
      ctx.arc(pose.head.x, pose.head.y - 4, 44 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 1. Legs (Two-Bone IK: hip -> knee -> ankle)
  const pantColor = pose.weddingAttire > 0.5 ? '#14161d' : '#1f232b';
  drawLimbSegment(ctx, pose.leftLeg.shoulderOrHip, pose.leftLeg.joint, 14 * scale, pantColor);
  drawLimbSegment(ctx, pose.leftLeg.joint, pose.leftLeg.end, 12 * scale, pantColor);
  drawLimbSegment(ctx, pose.rightLeg.shoulderOrHip, pose.rightLeg.joint, 14 * scale, pantColor);
  drawLimbSegment(ctx, pose.rightLeg.joint, pose.rightLeg.end, 12 * scale, pantColor);

  // Pelvis shorts / tuxedo trouser bridge so legs join cleanly to torso
  const waistW = 19 * scale;
  ctx.fillStyle = pantColor;
  ctx.strokeStyle = '#111318';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(
    pose.pelvis.x - waistW,
    pose.pelvis.y - 4 * scale,
    waistW * 2,
    18 * scale,
    6 * scale,
  );
  ctx.fill();
  ctx.stroke();

  // Shoes (high-top gym trainers or polished dress shoes)
  for (const foot of [pose.leftLeg.end, pose.rightLeg.end]) {
    ctx.fillStyle = pose.weddingAttire > 0.5 ? '#0f1117' : '#e5e7eb';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(foot.x + 3 * scale, foot.y, 10.5 * scale, 5.2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (pose.weddingAttire <= 0.5) {
      ctx.fillStyle = '#d5fb6d';
      ctx.fillRect(foot.x - 4 * scale, foot.y + 1.5 * scale, 12 * scale, 2 * scale);
    }
  }

  // Determine outfit color by escalation band
  const shoulderW = 30 * pose.shoulderScale * scale;
  let outfitColor = palette.hoodieColor;
  if (pose.weddingAttire > 0.5) {
    outfitColor = palette.tuxColor;
  } else if (beat.band >= 4) {
    outfitColor = palette.compressionColor;
  } else if (beat.band >= 2) {
    outfitColor = palette.vestColor;
  }

  // 2. Upper Arms (drawn before torso so shoulders & chest overlap naturally)
  drawLimbSegment(
    ctx,
    pose.leftArm.shoulderOrHip,
    pose.leftArm.joint,
    bicepR,
    skin,
    pose.oilSheen,
  );
  drawLimbSegment(
    ctx,
    pose.rightArm.shoulderOrHip,
    pose.rightArm.joint,
    bicepR,
    skin,
    pose.oilSheen,
  );

  // Hoodie sleeves in Band 1
  if (pose.weddingAttire <= 0.5 && beat.band <= 1) {
    drawSleeveCap(ctx, pose.leftArm.shoulderOrHip, pose.leftArm.joint, bicepR + 2 * scale, outfitColor, 0.55);
    drawSleeveCap(ctx, pose.rightArm.shoulderOrHip, pose.rightArm.joint, bicepR + 2 * scale, outfitColor, 0.55);
  }

  // 3. Torso / Outfit
  ctx.fillStyle = outfitColor;
  ctx.beginPath();
  ctx.moveTo(pose.chest.x - shoulderW, pose.chest.y - 8 * scale);
  ctx.lineTo(pose.chest.x + shoulderW, pose.chest.y - 8 * scale);
  ctx.lineTo(pose.pelvis.x + waistW, pose.pelvis.y + 6 * scale);
  ctx.lineTo(pose.pelvis.x - waistW, pose.pelvis.y + 6 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111318';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pectoral & Collarbone Sculpt Lines
  ctx.strokeStyle = 'rgba(17, 19, 24, 0.28)';
  ctx.lineWidth = 1.6 * scale;
  ctx.beginPath();
  ctx.moveTo(pose.chest.x - shoulderW * 0.65, pose.chest.y + 10 * scale);
  ctx.quadraticCurveTo(pose.chest.x - 4 * scale, pose.chest.y + 15 * scale, pose.chest.x - 2 * scale, pose.chest.y + 4 * scale);
  ctx.moveTo(pose.chest.x + shoulderW * 0.65, pose.chest.y + 10 * scale);
  ctx.quadraticCurveTo(pose.chest.x + 4 * scale, pose.chest.y + 15 * scale, pose.chest.x + 2 * scale, pose.chest.y + 4 * scale);
  ctx.stroke();

  // Compression seam strain or Sleeveless Tuxedo Lapels & Bowtie!
  if (pose.weddingAttire > 0.5) {
    // Crisp white dress shirt V and black bowtie (sleeveless gym tux from concept art!)
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(pose.chest.x - 12 * scale, pose.chest.y - 8 * scale);
    ctx.lineTo(pose.chest.x + 12 * scale, pose.chest.y - 8 * scale);
    ctx.lineTo(pose.chest.x, pose.chest.y + 28 * scale);
    ctx.closePath();
    ctx.fill();

    // Satin lapels
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(pose.chest.x - 14 * scale, pose.chest.y - 8 * scale);
    ctx.lineTo(pose.chest.x, pose.chest.y + 28 * scale);
    ctx.lineTo(pose.chest.x + 14 * scale, pose.chest.y - 8 * scale);
    ctx.stroke();

    // Bowtie
    ctx.fillStyle = '#111318';
    ctx.beginPath();
    ctx.moveTo(pose.chest.x, pose.chest.y - 4 * scale);
    ctx.lineTo(pose.chest.x - 9 * scale, pose.chest.y - 9 * scale);
    ctx.lineTo(pose.chest.x - 9 * scale, pose.chest.y + 1 * scale);
    ctx.closePath();
    ctx.moveTo(pose.chest.x, pose.chest.y - 4 * scale);
    ctx.lineTo(pose.chest.x + 9 * scale, pose.chest.y - 9 * scale);
    ctx.lineTo(pose.chest.x + 9 * scale, pose.chest.y + 1 * scale);
    ctx.closePath();
    ctx.fill();

    // Rose boutonniere
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(pose.chest.x - 15 * scale, pose.chest.y + 6 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (beat.band >= 3) {
    // Compression-shirt seam strain lines (Page 21)
    ctx.strokeStyle = 'rgba(17, 19, 24, 0.35)';
    ctx.lineWidth = 1.5;
    const ripple = pose.vestRipple * 3;
    ctx.beginPath();
    ctx.moveTo(pose.chest.x - 14 * scale, pose.chest.y + 6 * scale + ripple);
    ctx.lineTo(pose.chest.x + 14 * scale, pose.chest.y + 6 * scale - ripple);
    ctx.moveTo(pose.chest.x - 11 * scale, pose.chest.y + 20 * scale - ripple);
    ctx.lineTo(pose.chest.x + 11 * scale, pose.chest.y + 20 * scale + ripple);
    ctx.stroke();
  }

  // 4. Neck & Head with Chiseled Jawline + 2.5D Head Yaw
  ctx.fillStyle = skin;
  const neckW = 8 * Math.sqrt(pose.jawScale) * scale;
  ctx.fillRect(pose.neck.x - neckW, pose.neck.y - 6 * scale, neckW * 2, 16 * scale);

  const headW = 16 * scale;
  const jawW = 15 * pose.jawScale * scale;
  const hx = pose.head.x;
  const hy = pose.head.y;
  const yawShift = clamp(pose.headYaw, -1, 1) * 3.2 * scale;

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(hx - headW, hy - 14 * scale);
  ctx.quadraticCurveTo(hx, hy - 22 * scale, hx + headW, hy - 14 * scale);
  ctx.lineTo(hx + jawW, hy + 7 * scale);
  ctx.lineTo(hx + jawW * 0.45, hy + 16 * scale);
  ctx.lineTo(hx - jawW * 0.45, hy + 16 * scale);
  ctx.lineTo(hx - jawW, hy + 7 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Cheekbone contour lines & cleft chin dimple at Band 3+
  if (pose.jawScale > 1.18) {
    ctx.strokeStyle = 'rgba(120, 65, 35, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx + yawShift - jawW * 0.72, hy + 1 * scale);
    ctx.lineTo(hx + yawShift - jawW * 0.35, hy + 8 * scale);
    ctx.moveTo(hx + yawShift + jawW * 0.72, hy + 1 * scale);
    ctx.lineTo(hx + yawShift + jawW * 0.35, hy + 8 * scale);
    ctx.moveTo(hx + yawShift, hy + 12 * scale);
    ctx.lineTo(hx + yawShift, hy + 15 * scale);
    ctx.stroke();
  }

  // Blush on reveal/crush (Page 10 & 21)
  if (pose.blush > 0.08) {
    ctx.fillStyle = `rgba(244, 63, 94, ${pose.blush * 0.42})`;
    ctx.beginPath();
    ctx.ellipse(hx + yawShift - 9 * scale, hy + 3 * scale, 5 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(hx + yawShift + 9 * scale, hy + 3 * scale, 5 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Human Eyes with Gaze Offset (Page 21: "His eyes remain human as his silhouette becomes absurd")
  const ex = pose.eyeOffset.x * 3.2 * scale;
  const ey = pose.eyeOffset.y * 2.0 * scale;
  for (const side of [-1, 1] as const) {
    const cx = hx + yawShift + side * 6.5 * scale;
    const cy = hy - 3 * scale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 4.2 * scale, 3.1 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.arc(cx + ex, cy + ey, 2.0 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Expressive Asymmetric Eyebrows (Page 5 & 10)
  ctx.strokeStyle = '#3b2314';
  ctx.lineWidth = 2.6 * scale;
  ctx.lineCap = 'round';
  // Left brow
  ctx.beginPath();
  ctx.moveTo(hx + yawShift - 11 * scale, hy - (8 + pose.browLiftLeft * 2) * scale);
  ctx.lineTo(hx + yawShift - 3 * scale, hy - (9 + pose.browLiftLeft * 4) * scale);
  ctx.stroke();
  // Right brow
  ctx.beginPath();
  ctx.moveTo(hx + yawShift + 3 * scale, hy - (9 + pose.browLiftRight * 3) * scale);
  ctx.lineTo(hx + yawShift + 11 * scale, hy - (8 + pose.browLiftRight * 4) * scale);
  ctx.stroke();

  // Asymmetric Smile / Mouth (Page 5)
  ctx.strokeStyle = '#291811';
  ctx.lineWidth = 2.0 * scale;
  ctx.beginPath();
  const mouthY = hy + 8 * scale;
  ctx.moveTo(hx + yawShift - 6 * scale, mouthY);
  ctx.quadraticCurveTo(
    hx + yawShift,
    mouthY + pose.smile * 6 * scale,
    hx + yawShift + 7 * scale,
    mouthY - (0.8 + pose.smile * 2.5) * scale,
  );
  ctx.stroke();

  // Sculpted Brown Hair with Secondary Motion Bounce
  const hairBounceY = pose.hairBounce * 5 * scale;
  ctx.fillStyle = '#432818';
  ctx.beginPath();
  ctx.moveTo(hx - headW - 2 * scale, hy - 10 * scale);
  ctx.quadraticCurveTo(
    hx - 4 * scale,
    hy - 29 * scale + hairBounceY,
    hx + headW + 4 * scale,
    hy - 15 * scale + hairBounceY * 0.6,
  );
  ctx.quadraticCurveTo(hx + headW, hy - 8 * scale, hx - headW, hy - 10 * scale);
  ctx.closePath();
  ctx.fill();

  // 5. Forearms & Hands (drawn after head/torso so flexed forearms and chin-level props never clip behind the chin)
  drawLimbSegment(ctx, pose.leftArm.joint, pose.leftArm.end, forearmR, skin, pose.oilSheen);
  drawLimbSegment(ctx, pose.rightArm.joint, pose.rightArm.end, forearmR, skin, pose.oilSheen);

  ctx.fillStyle = skin;
  for (const hand of [pose.leftArm.end, pose.rightArm.end]) {
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 6.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // 6. Foreground Gag Props held by Rex (G01 - G11)
  if (!isReflection && beat.mode === 'running') {
    const gagId = beat.gag.id;
    if (gagId === 'G01') {
      // Neon Spirit Level under Rex's chin
      const lx = hx;
      const ly = hy + 21 * scale;
      ctx.fillStyle = '#bef264';
      ctx.strokeStyle = '#111318';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(lx - 28, ly - 5, 56, 10, 4);
      ctx.fill();
      ctx.stroke();
      const bx = lx + pose.spiritBubbleOffset * 18;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(bx, ly, 3.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (gagId === 'G03') {
      // Bronzer spray-tan bottle in Rex's left hand
      const sx = pose.leftArm.end.x;
      const sy = pose.leftArm.end.y;
      ctx.fillStyle = '#ea580c';
      ctx.strokeStyle = '#111318';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(sx - 7, sy - 4, 14, 24, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(sx - 3, sy - 10, 8, 6);
    } else if (gagId === 'G04') {
      // Candid Retake #47 selfie stick & phone in Rex's right hand
      const rx = pose.rightArm.end.x;
      const ry = pose.rightArm.end.y;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + 22, ry - 26);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(rx + 14, ry - 44, 18, 26, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f43f5e';
      ctx.font = '800 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('#47', rx + 23, ry - 29);
    } else if (gagId === 'G05') {
      // Upside-down OBJECTIVE SCIENCE notebook
      const nx = pose.leftArm.end.x + 8;
      const ny = pose.leftArm.end.y - 12;
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#111318';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(nx - 24, ny - 16, 48, 32, 4);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(Math.PI); // Held upside down!
      ctx.fillStyle = '#111318';
      ctx.font = '800 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OBJECTIVE', 0, -2);
      ctx.fillText('SCIENCE', 0, 7);
      ctx.restore();
    } else if (gagId === 'G06') {
      // Jawline Goniometer Protractor measuring 112.4°
      ctx.save();
      ctx.strokeStyle = '#d5fb6d';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(hx + jawW * 0.6, hy + 8, 22, -Math.PI * 0.65, Math.PI * 0.25);
      ctx.stroke();
      ctx.fillStyle = '#d5fb6d';
      ctx.font = '800 8px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('112.4°', hx + jawW + 10, hy + 10);
      ctx.restore();
    } else if (gagId === 'G08') {
      // Drifting beauty-filter wireframe sliding off Rex's face toward Milo
      const driftX = hx + 22;
      ctx.save();
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(driftX - 18, hy - 20, 36, 38);
      ctx.setLineDash([]);
      ctx.fillStyle = '#fef08a';
      ctx.font = '800 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SMOOTH 99%', driftX, hy - 24);
      ctx.restore();
    } else if (gagId === 'G09') {
      // Posture laser plumb-line beam locking onto Milo
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pose.chest.x, pose.chest.y);
      ctx.lineTo(pose.chest.x + 150, pose.chest.y - 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(pose.chest.x + 150, pose.chest.y - 6, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (gagId === 'G10') {
      // Vortex Protein Shaker bottle in Rex's left hand
      const sx = pose.leftArm.end.x;
      const sy = pose.leftArm.end.y;
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#bef264';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sx - 9, sy - 14, 18, 28, 4);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 1.5);
      ctx.stroke();
    } else if (gagId === 'G11') {
      // Q4 Boardroom Synergy Pointer rod & mini chart
      const rx = pose.rightArm.end.x;
      const ry = pose.rightArm.end.y;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + 38, ry - 24);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(rx + 28, ry - 48, 36, 24);
      ctx.strokeRect(rx + 28, ry - 48, 36, 24);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(rx + 33, ry - 34, 6, 8);
      ctx.fillRect(rx + 43, ry - 39, 6, 13);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(rx + 53, ry - 45, 6, 19);
    }
  }

  // Unspooling Jawline Receipt on Floor (G02 & Band 3+, or NO REFUNDS on instant crash)
  if (!isReflection && pose.receiptUnspool > 0.05) {
    const rx = pose.leftArm.end.x - 10;
    const ry = pose.leftArm.end.y;
    const len = 40 + pose.receiptUnspool * 130;
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rx - 12, ry);
    ctx.lineTo(rx + 12, ry);
    ctx.lineTo(rx + 18 + pose.receiptUnspool * 24, Math.min(pose.root.y + 4, ry + len));
    ctx.lineTo(rx - 6 + pose.receiptUnspool * 24, Math.min(pose.root.y + 4, ry + len));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      beat.instantCrash ? 'NO REFUNDS' : 'GOOD NEWS',
      rx + 4,
      ry + 16,
    );
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draw Milo the trainer (Page 5 & 21):
 * Plum shirt with short sleeves, relaxed posture, calm motion, small eyebrow lift and warm half-smile.
 */
export function drawMiloFigure(
  ctx: CanvasRenderingContext2D,
  pose: CharacterPose,
  beat: DirectedBeat,
): void {
  const skin = '#e2b492';
  ctx.save();

  // Ground contact shadow
  ctx.fillStyle = 'rgba(9, 11, 16, 0.38)';
  ctx.beginPath();
  ctx.ellipse(pose.root.x, pose.root.y + 3, 30, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 1. Legs (Two-Bone IK)
  const pantColor = pose.weddingAttire > 0.5 ? '#18181b' : '#27272a';
  drawLimbSegment(ctx, pose.leftLeg.shoulderOrHip, pose.leftLeg.joint, 14, pantColor);
  drawLimbSegment(ctx, pose.leftLeg.joint, pose.leftLeg.end, 12, pantColor);
  drawLimbSegment(ctx, pose.rightLeg.shoulderOrHip, pose.rightLeg.joint, 14, pantColor);
  drawLimbSegment(ctx, pose.rightLeg.joint, pose.rightLeg.end, 12, pantColor);

  // Pelvis jogger / trouser waistband bridge
  const waistW = 20;
  ctx.fillStyle = pantColor;
  ctx.strokeStyle = '#111318';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(pose.pelvis.x - waistW, pose.pelvis.y - 4, waistW * 2, 17, 6);
  ctx.fill();
  ctx.stroke();

  // Shoes
  for (const foot of [pose.leftLeg.end, pose.rightLeg.end]) {
    ctx.fillStyle = pose.weddingAttire > 0.5 ? '#0f1117' : '#f4f4f5';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(foot.x - 2, foot.y, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 2. Upper Arms & Short Plum Shirt Sleeves
  const shoulderW = 31;
  const shirtColor = pose.weddingAttire > 0.5 ? '#18181b' : '#581c4f'; // Plum shirt (Page 21)
  drawLimbSegment(ctx, pose.leftArm.shoulderOrHip, pose.leftArm.joint, 13, skin);
  drawLimbSegment(ctx, pose.rightArm.shoulderOrHip, pose.rightArm.joint, 13, skin);
  if (pose.weddingAttire <= 0.5) {
    drawSleeveCap(ctx, pose.leftArm.shoulderOrHip, pose.leftArm.joint, 15, shirtColor, 0.5);
    drawSleeveCap(ctx, pose.rightArm.shoulderOrHip, pose.rightArm.joint, 15, shirtColor, 0.5);
  }

  // 3. Torso (Plum shirt in gym, or matching sleeveless wedding tuxedo at wedding!)
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.moveTo(pose.chest.x - shoulderW, pose.chest.y - 8);
  ctx.lineTo(pose.chest.x + shoulderW, pose.chest.y - 8);
  ctx.lineTo(pose.pelvis.x + waistW, pose.pelvis.y + 6);
  ctx.lineTo(pose.pelvis.x - waistW, pose.pelvis.y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111318';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (pose.weddingAttire > 0.5) {
    // Wedding shirt & bowtie
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(pose.chest.x - 11, pose.chest.y - 8);
    ctx.lineTo(pose.chest.x + 11, pose.chest.y - 8);
    ctx.lineTo(pose.chest.x, pose.chest.y + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#111318';
    ctx.beginPath();
    ctx.moveTo(pose.chest.x, pose.chest.y - 4);
    ctx.lineTo(pose.chest.x - 8, pose.chest.y - 8);
    ctx.lineTo(pose.chest.x - 8, pose.chest.y);
    ctx.closePath();
    ctx.moveTo(pose.chest.x, pose.chest.y - 4);
    ctx.lineTo(pose.chest.x + 8, pose.chest.y - 8);
    ctx.lineTo(pose.chest.x + 8, pose.chest.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(pose.chest.x + 14, pose.chest.y + 6, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Trainer lanyard & whistle on Milo's plum shirt
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pose.chest.x - 8, pose.chest.y - 7);
    ctx.lineTo(pose.chest.x, pose.chest.y + 14);
    ctx.lineTo(pose.chest.x + 8, pose.chest.y - 7);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(pose.chest.x, pose.chest.y + 16, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Neck & Head
  ctx.fillStyle = skin;
  ctx.fillRect(pose.neck.x - 8, pose.neck.y - 6, 16, 15);

  const hx = pose.head.x;
  const hy = pose.head.y;
  const yawShift = clamp(pose.headYaw, -1, 1) * 2.5;
  ctx.beginPath();
  ctx.roundRect(hx - 15, hy - 18, 30, 33, 10);
  ctx.fill();
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Short dark beard/stubble (from concept art)
  ctx.fillStyle = 'rgba(30, 27, 24, 0.28)';
  ctx.beginPath();
  ctx.roundRect(hx - 14, hy + 1, 28, 13, 7);
  ctx.fill();

  // Warm blush when holding Rex's hand
  if (pose.blush > 0.08) {
    ctx.fillStyle = `rgba(244, 63, 94, ${pose.blush * 0.38})`;
    ctx.beginPath();
    ctx.ellipse(hx + yawShift - 8, hy + 2, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(hx + yawShift + 8, hy + 2, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Warm eyes looking toward Rex
  for (const side of [-1, 1] as const) {
    const cx = hx + yawShift + side * 6;
    const cy = hy - 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 3.8, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(cx - 1.5, cy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small eyebrow lift & warm half-smile (Page 21)
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx + yawShift - 10, hy - 8 - pose.browLiftLeft * 4);
  ctx.lineTo(hx + yawShift - 3, hy - 9 - pose.browLiftLeft * 5);
  ctx.moveTo(hx + yawShift + 3, hy - 9);
  ctx.lineTo(hx + yawShift + 10, hy - 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(hx + yawShift - 6, hy + 7);
  ctx.quadraticCurveTo(hx + yawShift, hy + 7 + pose.smile * 5, hx + yawShift + 6, hy + 5.5);
  ctx.stroke();

  // Dark wavy hair
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.roundRect(hx - 16, hy - 22, 32, 11, 6);
  ctx.fill();

  // 5. Forearms, Hands & Dumbbell/Clipboard Props (drawn in front of torso/head)
  drawLimbSegment(ctx, pose.leftArm.joint, pose.leftArm.end, 11, skin);
  drawLimbSegment(ctx, pose.rightArm.joint, pose.rightArm.end, 11, skin);

  // Dumbbell in Milo's right hand when reracking
  if (beat.miloAction === 'rerack' && pose.weddingAttire < 0.3) {
    const dx = pose.rightArm.end.x;
    const dy = pose.rightArm.end.y;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(dx - 14, dy - 3, 28, 6);
    ctx.fillRect(dx - 16, dy - 9, 6, 18);
    ctx.fillRect(dx + 10, dy - 9, 6, 18);
  } else if (beat.miloAction === 'spot_offer' && pose.weddingAttire < 0.3) {
    const cx = pose.rightArm.end.x;
    const cy = pose.rightArm.end.y;
    ctx.fillStyle = '#92400e';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - 10, cy - 12, 20, 26, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 7, cy - 8, 14, 19);
  }

  // Hands
  ctx.fillStyle = skin;
  for (const hand of [pose.leftArm.end, pose.rightArm.end]) {
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw supporting cast members in the background/midground with articulated two-bone IK limbs:
 * - Bea the gym manager (wiping benches, unplugging wind machine, or invoicing wedding confetti)
 * - Huge sobbing Best Man & Golden Retriever ring bearer during the wedding
 * - Vera (with chasing smoothing filter halo)
 */
export function drawSupportingCast(
  ctx: CanvasRenderingContext2D,
  beat: DirectedBeat,
  layout: SceneLayout,
  time: number,
): void {
  ctx.save();

  // 1. Wedding supporting cast: Huge Sobbing Best Man + Golden Retriever Ring Bearer + Bea with Invoice
  if (beat.mode === 'crashed' && (beat.crashStage === 'wedding' || beat.crashStage === 'opportunist')) {
    // Huge Best Man sobbing on the left of the altar (Page 10 & 21)
    const bmx = layout.portrait ? 74 : 332;
    const bmy = layout.floorY - 4;
    const sobBob = Math.sin(time * 7) * 2.5;
    const bmLeftLeg = solveNaturalLeg(
      { x: bmx - 12, y: bmy - 54 },
      { x: bmx - 14, y: bmy },
      28,
      28,
      -1,
    );
    const bmRightLeg = solveNaturalLeg(
      { x: bmx + 12, y: bmy - 54 },
      { x: bmx + 14, y: bmy },
      28,
      28,
      1,
    );
    drawLimbSegment(ctx, bmLeftLeg.shoulderOrHip, bmLeftLeg.joint, 14, '#0f172a');
    drawLimbSegment(ctx, bmLeftLeg.joint, bmLeftLeg.end, 12, '#0f172a');
    drawLimbSegment(ctx, bmRightLeg.shoulderOrHip, bmRightLeg.joint, 14, '#0f172a');
    drawLimbSegment(ctx, bmRightLeg.joint, bmRightLeg.end, 12, '#0f172a');

    // Best Man broad torso in wedding suit
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bmx - 30, bmy - 118 + sobBob, 60, 68, 12);
    ctx.fill();
    ctx.stroke();

    // Best Man IK arms (left arm holding gym towel to dab tears, right arm over heart)
    const bmLeftArm = solveNaturalArm(
      { x: bmx - 28, y: bmy - 108 + sobBob },
      { x: bmx - 14, y: bmy - 124 + sobBob },
      24,
      22,
      -1,
    );
    const bmRightArm = solveNaturalArm(
      { x: bmx + 28, y: bmy - 108 + sobBob },
      { x: bmx + 8, y: bmy - 88 + sobBob },
      24,
      22,
      1,
    );
    drawLimbSegment(ctx, bmLeftArm.shoulderOrHip, bmLeftArm.joint, 12, '#8d5524');
    drawLimbSegment(ctx, bmRightArm.shoulderOrHip, bmRightArm.joint, 12, '#8d5524');

    // Best Man head & happy tears
    ctx.fillStyle = '#8d5524';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(bmx, bmy - 134 + sobBob, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    const tearBob = Math.sin(time * 9) * 3;
    ctx.beginPath();
    ctx.moveTo(bmx - 7, bmy - 134 + sobBob);
    ctx.lineTo(bmx - 10, bmy - 118 + tearBob);
    ctx.moveTo(bmx + 7, bmy - 134 + sobBob);
    ctx.lineTo(bmx + 10, bmy - 118 - tearBob);
    ctx.stroke();

    // Forearms & gym towel dabbing eyes
    drawLimbSegment(ctx, bmLeftArm.joint, bmLeftArm.end, 10, '#8d5524');
    drawLimbSegment(ctx, bmRightArm.joint, bmRightArm.end, 10, '#8d5524');
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.fillRect(bmLeftArm.end.x - 10, bmLeftArm.end.y - 6, 16, 22);
    ctx.strokeRect(bmLeftArm.end.x - 10, bmLeftArm.end.y - 6, 16, 22);

    // Golden Retriever Ring Bearer with wagging tail, legs, bowtie & ring pillow (Page 1)
    const dogX = layout.portrait ? 136 : 398;
    const dogY = layout.floorY - 4;
    const wag = Math.sin(time * 11) * 6;
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dogX - 18, dogY - 20);
    ctx.lineTo(dogX - 28, dogY - 30 + wag);
    ctx.stroke();
    for (const lx of [dogX - 12, dogX - 4, dogX + 6, dogX + 13]) {
      ctx.beginPath();
      ctx.moveTo(lx, dogY - 10);
      ctx.lineTo(lx, dogY);
      ctx.stroke();
    }
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(dogX, dogY - 18, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dogX + 14, dogY - 31, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Floppy ear
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(dogX + 9, dogY - 29, 4, 8, 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Dog bowtie & tiny weight-plate ring pillow
    ctx.fillStyle = '#111318';
    ctx.fillRect(dogX + 9, dogY - 22, 9, 4);
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(dogX - 2, dogY - 29, 6, 0, Math.PI * 2);
    ctx.fill();

    // Bea holding confetti invoice on the right with IK limbs (Page 12 & 20)
    const beaX = layout.portrait ? 476 : 856;
    const beaY = layout.floorY - 4;
    const beaLeftLeg = solveNaturalLeg({ x: beaX - 7, y: beaY - 44 }, { x: beaX - 8, y: beaY }, 22, 22, -1);
    const beaRightLeg = solveNaturalLeg({ x: beaX + 7, y: beaY - 44 }, { x: beaX + 8, y: beaY }, 22, 22, 1);
    drawLimbSegment(ctx, beaLeftLeg.shoulderOrHip, beaLeftLeg.joint, 10, '#1e293b');
    drawLimbSegment(ctx, beaLeftLeg.joint, beaLeftLeg.end, 9, '#1e293b');
    drawLimbSegment(ctx, beaRightLeg.shoulderOrHip, beaRightLeg.joint, 10, '#1e293b');
    drawLimbSegment(ctx, beaRightLeg.joint, beaRightLeg.end, 9, '#1e293b');

    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(beaX - 16, beaY - 94, 32, 52, 8);
    ctx.fill();
    ctx.stroke();

    const beaLeftArm = solveNaturalArm({ x: beaX - 16, y: beaY - 86 }, { x: beaX - 22, y: beaY - 68 }, 18, 17, -1);
    const beaRightArm = solveNaturalArm({ x: beaX + 16, y: beaY - 86 }, { x: beaX + 18, y: beaY - 58 }, 18, 17, 1);
    drawLimbSegment(ctx, beaLeftArm.shoulderOrHip, beaLeftArm.joint, 8, '#d6a27e');
    drawLimbSegment(ctx, beaLeftArm.joint, beaLeftArm.end, 7, '#d6a27e');
    drawLimbSegment(ctx, beaRightArm.shoulderOrHip, beaRightArm.joint, 8, '#d6a27e');
    drawLimbSegment(ctx, beaRightArm.joint, beaRightArm.end, 7, '#d6a27e');

    ctx.fillStyle = '#d6a27e';
    ctx.beginPath();
    ctx.arc(beaX, beaY - 108, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Long confetti removal invoice
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 1.4;
    ctx.fillRect(beaX - 34, beaY - 82, 24, 54);
    ctx.strokeRect(beaX - 34, beaY - 82, 24, 54);
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 7px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('INVOICE', beaX - 22, beaY - 68);
    ctx.fillText('$420', beaX - 22, beaY - 56);

    ctx.restore();
    return;
  }

  // 2. Running / Waiting / Cashout Supporting Cast: Bea the Gym Manager with IK limbs
  const beaX = layout.portrait ? 488 : 884;
  const beaY = layout.floorY - 4;
  const wipeOsc = Math.sin(time * 3.6) * 6;
  const beaLeftLeg = solveNaturalLeg({ x: beaX - 7, y: beaY - 42 }, { x: beaX - 8, y: beaY }, 21, 21, -1);
  const beaRightLeg = solveNaturalLeg({ x: beaX + 7, y: beaY - 42 }, { x: beaX + 8, y: beaY }, 21, 21, 1);
  drawLimbSegment(ctx, beaLeftLeg.shoulderOrHip, beaLeftLeg.joint, 10, '#1e293b');
  drawLimbSegment(ctx, beaLeftLeg.joint, beaLeftLeg.end, 9, '#1e293b');
  drawLimbSegment(ctx, beaRightLeg.shoulderOrHip, beaRightLeg.joint, 10, '#1e293b');
  drawLimbSegment(ctx, beaRightLeg.joint, beaRightLeg.end, 9, '#1e293b');

  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#111318';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(beaX - 15, beaY - 90, 30, 50, 8);
  ctx.fill();
  ctx.stroke();

  const beaLeftArm = solveNaturalArm(
    { x: beaX - 15, y: beaY - 82 },
    { x: beaX - 18 + wipeOsc, y: beaY - 58 },
    17,
    16,
    -1,
  );
  const beaRightArm = solveNaturalArm(
    { x: beaX + 15, y: beaY - 82 },
    { x: beaX + 17, y: beaY - 54 },
    17,
    16,
    1,
  );
  drawLimbSegment(ctx, beaLeftArm.shoulderOrHip, beaLeftArm.joint, 8, '#d6a27e');
  drawLimbSegment(ctx, beaLeftArm.joint, beaLeftArm.end, 7, '#d6a27e');
  drawLimbSegment(ctx, beaRightArm.shoulderOrHip, beaRightArm.joint, 8, '#d6a27e');
  drawLimbSegment(ctx, beaRightArm.joint, beaRightArm.end, 7, '#d6a27e');

  ctx.fillStyle = '#d6a27e';
  ctx.beginPath();
  ctx.arc(beaX, beaY - 103, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Spray bottle in Bea's left hand
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(beaLeftArm.end.x - 4, beaLeftArm.end.y - 2, 8, 12);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '800 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BEA', beaX, beaY - 68);

  // Vera with chasing beauty-filter ring at Band 3+ or G08
  if (beat.mode === 'running' && (beat.band >= 3 || beat.gag.id === 'G08')) {
    const veraX = (layout.portrait ? 92 : 244) + Math.sin(time * 1.8) * 14;
    const veraY = layout.floorY - 8;
    const veraLeftLeg = solveNaturalLeg({ x: veraX - 6, y: veraY - 38 }, { x: veraX - 7, y: veraY }, 19, 19, -1);
    const veraRightLeg = solveNaturalLeg({ x: veraX + 6, y: veraY - 38 }, { x: veraX + 7, y: veraY }, 19, 19, 1);
    drawLimbSegment(ctx, veraLeftLeg.shoulderOrHip, veraLeftLeg.joint, 9, '#1e293b');
    drawLimbSegment(ctx, veraLeftLeg.joint, veraLeftLeg.end, 8, '#1e293b');
    drawLimbSegment(ctx, veraRightLeg.shoulderOrHip, veraRightLeg.joint, 9, '#1e293b');
    drawLimbSegment(ctx, veraRightLeg.joint, veraRightLeg.end, 8, '#1e293b');

    ctx.fillStyle = '#ec4899';
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(veraX - 13, veraY - 82, 26, 46, 7);
    ctx.fill();
    ctx.stroke();

    const veraLeftArm = solveNaturalArm({ x: veraX - 13, y: veraY - 76 }, { x: veraX - 16, y: veraY - 52 }, 15, 15, -1);
    const veraRightArm = solveNaturalArm({ x: veraX + 13, y: veraY - 76 }, { x: veraX + 18, y: veraY - 92 }, 15, 15, 1);
    drawLimbSegment(ctx, veraLeftArm.shoulderOrHip, veraLeftArm.joint, 7, '#f3d2b8');
    drawLimbSegment(ctx, veraLeftArm.joint, veraLeftArm.end, 6.5, '#f3d2b8');
    drawLimbSegment(ctx, veraRightArm.shoulderOrHip, veraRightArm.joint, 7, '#f3d2b8');
    drawLimbSegment(ctx, veraRightArm.joint, veraRightArm.end, 6.5, '#f3d2b8');

    ctx.fillStyle = '#f3d2b8';
    ctx.beginPath();
    ctx.arc(veraX, veraY - 95, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Chasing smoothing-filter halo lagging behind Vera's face (G08)
    const filterLagX = veraX - Math.cos(time * 1.8) * 12;
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(filterLagX, veraY - 95, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
