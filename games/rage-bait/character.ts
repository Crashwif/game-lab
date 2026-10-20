/**
 * Character rig, two-bone inverse kinematics (`solveLimb`), articulated thumb
 * targeting, damped springs (`stepSpring` / `settleSpring`), 4-second slot
 * acting loop, and room/prop rendering for Rage Bait.
 */

import { PALETTE, tierForX100, type OvertimePropKind, type Tier } from './content';
import { SLOT_MS, type DraftView } from './feed';
import type { SceneLayout } from './layout';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Spring {
  value: number;
  velocity: number;
  target: number;
  stiffness: number;
  damping: number;
}

export function createSpring(initial = 0, stiffness = 210, damping = 22): Spring {
  return {
    value: initial,
    velocity: 0,
    target: initial,
    stiffness,
    damping,
  };
}

/** Step a damped spring forward by `dt` seconds (clamped for stability). */
export function stepSpring(s: Spring, dt: number): number {
  const clampedDt = Math.min(0.05, Math.max(0, dt));
  const force = (s.target - s.value) * s.stiffness;
  s.velocity = (s.velocity + force * clampedDt) * Math.exp(-s.damping * clampedDt);
  s.value += s.velocity * clampedDt;
  return s.value;
}

/** Immediately snap a spring to its target without replaying missed frames. */
export function settleSpring(s: Spring, value?: number): number {
  if (value !== undefined) {
    s.target = value;
  }
  s.value = s.target;
  s.velocity = 0;
  return s.value;
}

/**
 * Two-bone inverse kinematics solver using the law of cosines (`docs/animation.md`).
 * Returns the joint (elbow) position and clamped effector (wrist) position.
 */
export function solveLimb(
  origin: Vec2,
  target: Vec2,
  len1: number,
  len2: number,
  bendSign: 1 | -1 = 1,
): { joint: Vec2; effector: Vec2 } {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const rawDist = Math.hypot(dx, dy);
  const minDist = Math.abs(len1 - len2) + 0.001;
  const maxDist = len1 + len2 - 0.001;
  const dist = Math.min(maxDist, Math.max(minDist, rawDist));

  const baseAngle = Math.atan2(dy, dx);
  const cosAngle1 = Math.min(1, Math.max(-1, (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist)));
  const angle1 = baseAngle + bendSign * Math.acos(cosAngle1);

  const joint: Vec2 = {
    x: origin.x + Math.cos(angle1) * len1,
    y: origin.y + Math.sin(angle1) * len1,
  };

  const effector: Vec2 = {
    x: origin.x + Math.cos(baseAngle) * dist,
    y: origin.y + Math.sin(baseAngle) * dist,
  };

  return { joint, effector };
}

export type ThumbAction =
  | 'idle-scroll'
  | 'scroll-finish'
  | 'tap-replies'
  | 'typing-draft'
  | 'select-delete'
  | 'hover-post'
  | 'post-press'
  | 'lock-phone'
  | 'phone-down';

export type FacialExpression =
  | 'calm'
  | 'skeptical'
  | 'disbelief'
  | 'muttering'
  | 'fuming'
  | 'overtime-unhinged'
  | 'crash-lock'
  | 'posted-shock'
  | 'peaceful';

export interface CharacterState {
  torsoLean: Spring;
  headNod: Spring;
  hairBounce: Spring;
  sleeveSway: Spring;
  phoneTilt: Spring;
  thumbX: Spring;
  thumbY: Spring;
  mugRattle: Spring;
  shadesDrop: Spring;
  thumbAction: ThumbAction;
  expression: FacialExpression;
  eyeTarget: Vec2; // Normalized -1..1 gaze offset
  jawOpen: number; // 0..1
  browFurrow: number; // -1 (raised) .. +1 (furrowed)
  sweatCount: number; // 0..4
  footTwitchPhase: number;
  lastSlotIndex: number;
  manualScrollBoost: number;
  manualReplyBoost: number;
}

export function createCharacterState(): CharacterState {
  return {
    torsoLean: createSpring(0, 180, 18),
    headNod: createSpring(0, 210, 20),
    hairBounce: createSpring(0, 240, 15),
    sleeveSway: createSpring(0, 190, 16),
    phoneTilt: createSpring(0, 220, 20),
    thumbX: createSpring(0, 320, 24),
    thumbY: createSpring(0, 320, 24),
    mugRattle: createSpring(0, 380, 12),
    shadesDrop: createSpring(0, 220, 20),
    thumbAction: 'idle-scroll',
    expression: 'calm',
    eyeTarget: { x: 0.25, y: -0.1 },
    jawOpen: 0.05,
    browFurrow: 0,
    sweatCount: 0,
    footTwitchPhase: 0,
    lastSlotIndex: -1,
    manualScrollBoost: 0,
    manualReplyBoost: 0,
  };
}

export interface CharacterUpdateInput {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsedMs: number;
  crashAgeSec: number;
  exitAgeSec: number | null;
  tension: number;
  dtSec: number;
  draft: DraftView;
  propKind: OvertimePropKind | null;
  cardAdvanceEvent: boolean;
  replyToggleEvent: boolean;
}

/** Compute the target pose for the current frame from game state. */
function computeTargets(state: CharacterState, input: CharacterUpdateInput): void {
  const { phase, currentX100, elapsedMs, crashAgeSec, exitAgeSec, tension, draft } = input;
  const tier: Tier = tierForX100(currentX100);
  const slotSec = (((elapsedMs % SLOT_MS) + SLOT_MS) % SLOT_MS) / 1000;
  const slotIndex = Math.floor(elapsedMs / SLOT_MS);

  // Trigger a discrete mug rattle only on acting accents (card advance, high-tier hover, or crash)
  if (input.cardAdvanceEvent && phase === 'running' && exitAgeSec === null) {
    state.mugRattle.velocity += (4 + tension * 10) * (slotIndex % 2 === 0 ? 1 : -1);
    state.hairBounce.velocity -= 6 + tension * 8;
  }
  if (input.replyToggleEvent && exitAgeSec === null) {
    state.manualReplyBoost = 0.35;
  }

  // 1. Confirmed cash-out closure overrides agitation and holds through any subsequent crash (Page 8)
  if (exitAgeSec !== null) {
    state.sweatCount = 0;
    if (exitAgeSec < 0.25) {
      // 0.00 - 0.25s: thumb selects draft and deletes it
      state.thumbAction = 'select-delete';
      state.expression = 'skeptical';
      state.torsoLean.target = 0.08;
      state.headNod.target = 0.05;
      state.phoneTilt.target = 0;
      state.thumbX.target = -0.25;
      state.thumbY.target = 0.35;
      state.shadesDrop.target = 0;
      state.jawOpen = 0.1;
      state.browFurrow = 0.1;
      state.eyeTarget = { x: 0.3, y: 0.25 };
    } else if (exitAgeSec < 0.65) {
      // 0.25 - 0.65s: clicks side button, locks screen, turns phone face-down
      state.thumbAction = 'lock-phone';
      state.expression = 'calm';
      state.torsoLean.target = -0.12;
      state.headNod.target = -0.04;
      state.phoneTilt.target = 0.85;
      state.thumbX.target = 0.45;
      state.thumbY.target = -0.15;
      state.shadesDrop.target = 0.4;
      state.jawOpen = 0.08;
      state.browFurrow = -0.15;
      state.eyeTarget = { x: 0.1, y: 0.1 };
    } else {
      // 0.65s+: leans back, puts on shades, exhales in calm room lighting
      state.thumbAction = 'phone-down';
      state.expression = 'peaceful';
      state.torsoLean.target = -0.32;
      state.headNod.target = -0.12;
      state.phoneTilt.target = 1.0; // Face-down on desk
      state.thumbX.target = -0.4;
      state.thumbY.target = 0.55;
      state.shadesDrop.target = 1.0;
      state.jawOpen = 0.04;
      state.browFurrow = -0.3;
      state.eyeTarget = { x: 0, y: -0.05 };
    }
    return;
  }

  state.shadesDrop.target = 0;

  // 2. Crash ending sequence (only when player did not cash out, Page 8)
  if (phase === 'crashed') {
    state.sweatCount = 4;
    if (crashAgeSec < 0.12) {
      // 0.00 - 0.12s: character freezes, eyes lock on post
      state.thumbAction = 'hover-post';
      state.expression = 'crash-lock';
      state.torsoLean.target = 0.72;
      state.headNod.target = 0.24;
      state.phoneTilt.target = -0.18;
      state.thumbX.target = 0.65;
      state.thumbY.target = 0.42;
      state.jawOpen = 0.25;
      state.browFurrow = 0.95;
      state.eyeTarget = { x: 0.65, y: 0.15 };
    } else if (crashAgeSec < 0.30) {
      // 0.12 - 0.30s: thumb slams Post button
      state.thumbAction = 'post-press';
      state.expression = 'crash-lock';
      state.torsoLean.target = 0.85;
      state.headNod.target = 0.32;
      state.phoneTilt.target = -0.28;
      state.thumbX.target = 0.88;
      state.thumbY.target = 0.52;
      state.jawOpen = 0.55;
      state.browFurrow = 1.0;
      state.eyeTarget = { x: 0.78, y: 0.45 };
      if (Math.abs(state.mugRattle.velocity) < 5) {
        state.mugRattle.velocity = 18;
      }
    } else {
      // 0.30 - 1.50s+: horrified realization as notifications burst and bait account replies
      state.thumbAction = 'post-press';
      state.expression = 'posted-shock';
      const recoil = Math.min(1, (crashAgeSec - 0.30) / 0.4);
      state.torsoLean.target = 0.55 - recoil * 0.4;
      state.headNod.target = 0.18 - recoil * 0.25;
      state.phoneTilt.target = -0.12;
      state.thumbX.target = 0.35;
      state.thumbY.target = 0.15;
      state.jawOpen = 0.88;
      state.browFurrow = -0.65; // Wide shocked brows
      state.eyeTarget = { x: 0.55, y: 0.1 };
    }
    return;
  }

  // 3. Waiting / Betting idle states
  if (phase === 'waiting' || phase === 'betting') {
    state.thumbAction = 'idle-scroll';
    state.expression = phase === 'betting' ? 'skeptical' : 'calm';
    state.torsoLean.target = phase === 'betting' ? 0.08 : 0;
    state.headNod.target = Math.sin(elapsedMs / 900) * 0.04;
    state.phoneTilt.target = 0;
    state.thumbX.target = 0.1;
    state.thumbY.target = Math.sin(elapsedMs / 700) * 0.18;
    state.jawOpen = 0.04;
    state.browFurrow = phase === 'betting' ? 0.15 : 0;
    state.sweatCount = 0;
    state.eyeTarget = { x: 0.35, y: 0 };
    return;
  }

  // 4. Running phase: 4-second reading slot acting loop (Page 7)
  state.sweatCount = tension > 0.82 ? 4 : tension > 0.65 ? 3 : tension > 0.48 ? 2 : tension > 0.32 ? 1 : 0;
  state.torsoLean.target = tension * 0.65 + (draft.hoveringPost ? 0.15 : 0);
  state.phoneTilt.target = -tension * 0.22;

  if (state.manualReplyBoost > 0) {
    state.thumbAction = 'tap-replies';
    state.thumbX.target = 0.45;
    state.thumbY.target = 0.12;
    state.eyeTarget = { x: 0.5, y: 0.18 };
  } else if (slotSec < 0.4) {
    // 0.0 - 0.4s: eyes snap to new headline; browsing thumb completes scroll
    state.thumbAction = 'scroll-finish';
    state.thumbX.target = 0.22;
    state.thumbY.target = -0.32 + (slotSec / 0.4) * 0.35;
    state.eyeTarget = { x: 0.42, y: -0.28 };
    state.headNod.target = -0.08 + tension * 0.12;
  } else if (slotSec < 1.4) {
    // 0.4 - 1.4s: eyebrows react; mouth forms silent disbelief shape; eyes drop to top reply
    state.thumbAction = 'idle-scroll';
    state.thumbX.target = 0.18;
    state.thumbY.target = 0.05;
    const drop = Math.min(1, Math.max(0, (slotSec - 0.8) / 0.5));
    state.eyeTarget = { x: 0.45, y: -0.22 + drop * 0.38 };
    state.headNod.target = 0.06 + tension * 0.16;
  } else if (slotSec < 3.0) {
    // 1.4 - 3.0s: typing thumb enters draft box and taps out current draft ladder line
    state.thumbAction = 'typing-draft';
    const typePulse = Math.sin(elapsedMs * (0.028 + tension * 0.025));
    state.thumbX.target = 0.35 + typePulse * 0.18;
    state.thumbY.target = 0.28 + Math.cos(elapsedMs * 0.034) * 0.08;
    state.eyeTarget = { x: 0.48, y: 0.36 };
    state.headNod.target = 0.14 + tension * 0.18;
  } else {
    // 3.0 - 4.0s: low tiers return to scroll; mid tiers select & delete; high tiers hover over Post
    if (tier <= 2) {
      state.thumbAction = 'idle-scroll';
      state.thumbX.target = 0.15;
      state.thumbY.target = 0.02;
      state.eyeTarget = { x: 0.38, y: -0.05 };
    } else if (tier <= 4) {
      state.thumbAction = 'select-delete';
      state.thumbX.target = -0.15;
      state.thumbY.target = 0.38;
      state.eyeTarget = { x: 0.42, y: 0.32 };
    } else {
      state.thumbAction = 'hover-post';
      const tremor = Math.sin(elapsedMs * 0.06) * 0.05;
      state.thumbX.target = 0.72 + tremor;
      state.thumbY.target = 0.44 - tremor;
      state.eyeTarget = { x: 0.65, y: 0.38 };
    }
    state.headNod.target = 0.1 + tension * 0.2;
  }

  // Facial expression progression by tier & slot beat
  if (tier >= 6) {
    state.expression = 'overtime-unhinged';
    state.browFurrow = 0.92;
    state.jawOpen = 0.38 + 0.22 * Math.abs(Math.sin(elapsedMs * 0.018));
  } else if (tier === 5) {
    state.expression = 'fuming';
    state.browFurrow = 0.82;
    state.jawOpen = slotSec >= 1.4 && slotSec < 3.0 ? 0.32 + 0.15 * Math.sin(elapsedMs * 0.022) : 0.22;
  } else if (tier >= 3) {
    state.expression = slotSec >= 1.4 && slotSec < 3.0 ? 'muttering' : 'disbelief';
    state.browFurrow = 0.52;
    state.jawOpen = slotSec >= 0.4 && slotSec < 1.4 ? 0.34 : 0.18 + 0.1 * Math.sin(elapsedMs * 0.02);
  } else {
    state.expression = slotSec >= 0.4 && slotSec < 1.4 ? 'disbelief' : 'skeptical';
    state.browFurrow = 0.22;
    state.jawOpen = slotSec >= 0.4 && slotSec < 1.4 ? 0.24 : 0.08;
  }
}

/** Step character springs and acting state for a single live frame. */
export function updateCharacter(state: CharacterState, input: CharacterUpdateInput): void {
  const dt = Math.min(0.05, Math.max(0.001, input.dtSec));
  state.manualReplyBoost = Math.max(0, state.manualReplyBoost - dt);
  state.manualScrollBoost = Math.max(0, state.manualScrollBoost - dt);
  state.footTwitchPhase += dt * (2 + input.tension * 14);

  computeTargets(state, input);

  state.hairBounce.target = state.torsoLean.target * 0.35 + state.headNod.target * 0.5;
  state.sleeveSway.target = state.thumbX.target * 0.4 - state.torsoLean.target * 0.25;
  state.mugRattle.target = 0;

  stepSpring(state.torsoLean, dt);
  stepSpring(state.headNod, dt);
  stepSpring(state.hairBounce, dt);
  stepSpring(state.sleeveSway, dt);
  stepSpring(state.phoneTilt, dt);
  stepSpring(state.thumbX, dt);
  stepSpring(state.thumbY, dt);
  stepSpring(state.mugRattle, dt);
  stepSpring(state.shadesDrop, dt);
}

/**
 * Reconstruct and settle the character pose immediately on late entry
 * without simulating missed frames (`docs/animation.md`, Page 16).
 */
export function settleCharacter(state: CharacterState, input: CharacterUpdateInput): void {
  state.manualReplyBoost = 0;
  state.manualScrollBoost = 0;
  computeTargets(state, input);
  state.hairBounce.target = state.torsoLean.target * 0.35 + state.headNod.target * 0.5;
  state.sleeveSway.target = state.thumbX.target * 0.4 - state.torsoLean.target * 0.25;
  state.mugRattle.target = 0;

  settleSpring(state.torsoLean);
  settleSpring(state.headNod);
  settleSpring(state.hairBounce);
  settleSpring(state.sleeveSway);
  settleSpring(state.phoneTilt);
  settleSpring(state.thumbX);
  settleSpring(state.thumbY);
  settleSpring(state.mugRattle);
  settleSpring(state.shadesDrop);
}

// ---- Canvas 2D Character, Rig, Hands, Phone & Room Prop Rendering ----------

function lerpColor(hexA: string, hexB: string, t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - u) + ((b >> 16) & 255) * u);
  const g = Math.round(((a >> 8) & 255) * (1 - u) + ((b >> 8) & 255) * u);
  const bl = Math.round((a & 255) * (1 - u) + (b & 255) * u);
  return `rgb(${r}, ${g}, ${bl})`;
}

function drawLimbSegment(
  ctx: CanvasRenderingContext2D,
  p1: Vec2,
  p2: Vec2,
  thickness: number,
  fill: string,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Bold outer ink silhouette
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = thickness + 5;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  // Inner fill
  ctx.strokeStyle = fill;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.restore();
}

export interface DrawCharacterOptions {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  tension: number;
  crashAgeSec: number;
  exitAgeSec: number | null;
  propKind: OvertimePropKind | null;
  nowMs: number;
}

/** One pose supplies the phone transform, both wrists, and the screen contact. */
export function characterPose(state: CharacterState, layout: SceneLayout, opts: DrawCharacterOptions) {
  const { roomRect, portrait } = layout;
  const scale = portrait ? 0.82 : 1;
  const anchorX = roomRect.x + roomRect.w * (portrait ? 0.44 : 0.43);
  const anchorY = roomRect.y + roomRect.h * (portrait ? 0.82 : 0.78);
  const leanPx = state.torsoLean.value * 36 * scale;
  const deskY = anchorY + 12 * scale;
  const shoulderCenter = { x: anchorX + leanPx, y: anchorY - 122 * scale };
  const leftShoulder = { x: shoulderCenter.x - 48 * scale, y: shoulderCenter.y + 8 * scale };
  const rightShoulder = { x: shoulderCenter.x + 44 * scale, y: shoulderCenter.y + 10 * scale };
  const headCenter = { x: shoulderCenter.x + 8 * scale + leanPx * 0.25, y: shoulderCenter.y - 54 * scale };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const blendPoint = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
  const down = opts.exitAgeSec === null ? 0 : Math.min(1, Math.max(0, state.phoneTilt.value));
  const phone = {
    center: {
      x: anchorX + mix(40 + state.torsoLean.value * 24, 12, down) * scale,
      y: mix(anchorY - 64 * scale, deskY - 7 * scale, down),
    },
    angle: (-0.18 + state.phoneTilt.value * 0.45) * (1 - down),
    width: mix(40, 56, down),
    height: mix(72, 14, down),
    down,
  };
  // Hand targets are phone-local, so tilting or lowering it cannot break the grip.
  const phonePoint = (x: number, y: number): Vec2 => ({
    x: phone.center.x + (x * Math.cos(phone.angle) - y * Math.sin(phone.angle)) * scale,
    y: phone.center.y + (x * Math.sin(phone.angle) + y * Math.cos(phone.angle)) * scale,
  });
  const left = solveLimb(leftShoulder, phonePoint(-phone.width / 2 - 6, 18 * (1 - down)), 64 * scale, 62 * scale, 1);

  // The right palm stays beside the screen; its thumb, rather than its wrist, taps it.
  const tapLift = state.thumbAction === 'typing-draft' ? (1 + Math.sin(opts.nowMs * 0.04)) * 1.5 : 0;
  const touchX = Math.min(10, Math.max(-10, state.thumbX.value * 10));
  const touchY = Math.min(24, Math.max(-24, state.thumbY.value * 38)) - tapLift;
  const screenTarget = phonePoint(touchX, touchY);
  let rightTarget = blendPoint(phonePoint(touchX + 24, touchY + 12), { x: anchorX + 60 * scale, y: deskY - 8 * scale }, down);
  // Only the free hand recoils after posting. The left hand keeps holding the phone.
  const recoilT = opts.phase === 'crashed' && opts.exitAgeSec === null
    ? Math.min(1, Math.max(0, (opts.crashAgeSec - 0.30) / 0.4)) : 0;
  const recoil = recoilT * recoilT * (3 - 2 * recoilT);
  rightTarget = blendPoint(rightTarget, { x: rightShoulder.x + 44 * scale, y: rightShoulder.y + 30 * scale }, recoil);
  const right = solveLimb(rightShoulder, rightTarget, 64 * scale, 62 * scale, -1);
  const rightHandAngle = mix(phone.angle, -0.4, recoil);
  const handPoint = (x: number, y: number): Vec2 => ({
    x: right.effector.x + (x * Math.cos(rightHandAngle) - y * Math.sin(rightHandAngle)) * scale,
    y: right.effector.y + (x * Math.sin(rightHandAngle) + y * Math.cos(rightHandAngle)) * scale,
  });
  const thumbBase = handPoint(-6, -5);
  const thumbTarget = blendPoint(screenTarget, handPoint(-10, -4), Math.max(down, recoil));
  const thumb = solveLimb(thumbBase, thumbTarget, 11 * scale, 10 * scale, -1);

  return { scale, anchorX, anchorY, leanPx, deskY, shoulderCenter, leftShoulder, rightShoulder,
    headCenter, phone, phonePoint, left, right, rightHandAngle, thumbBase, thumb, screenTarget };
}

function drawSleeve(ctx: CanvasRenderingContext2D, shoulder: Vec2, arm: ReturnType<typeof solveLimb>, scale: number, color: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(arm.joint.x, arm.joint.y);
  ctx.lineTo(arm.effector.x, arm.effector.y);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 23 * scale;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 18 * scale;
  ctx.stroke();
  ctx.restore();
}

function drawPalm(ctx: CanvasRenderingContext2D, wrist: Vec2, angle: number, scale: number): void {
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.rotate(angle);
  ctx.fillStyle = '#F2C9AC';
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.ellipse(0, -2 * scale, 9 * scale, 12 * scale, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Render the room vignette, dynamic screen glow, overtime props, coffee mug,
 * scroller torso/head/face, two-bone IK arms, and articulated thumb on the phone.
 */
export function drawCharacterRoom(
  ctx: CanvasRenderingContext2D,
  state: CharacterState,
  layout: SceneLayout,
  opts: DrawCharacterOptions,
): void {
  const { roomRect, portrait } = layout;
  const exited = opts.exitAgeSec !== null && opts.exitAgeSec >= 0.25;
  const crashedActive = opts.phase === 'crashed' && !exited;

  // Screen glow shifts from cool blue-white at 1.00x to warm amber-red as tension rises,
  // then returns to calm room lighting after a confirmed exit (Page 9).
  const glowColor = exited
    ? '#5E7A68'
    : crashedActive
      ? PALETTE.crashRed
      : lerpColor(PALETTE.coolGlow, PALETTE.orange, opts.tension);

  ctx.save();
  // Clip to room card frame
  ctx.beginPath();
  ctx.roundRect(roomRect.x, roomRect.y, roomRect.w, roomRect.h, 14);
  ctx.fillStyle = exited ? '#1B2120' : '#16181E';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = crashedActive ? PALETTE.crashRed : exited ? PALETTE.lime : PALETTE.border;
  ctx.stroke();
  ctx.clip();

  // Ambient screen light cone on the wall/face
  const glowCenterX = roomRect.x + roomRect.w * (portrait ? 0.56 : 0.72);
  const glowCenterY = roomRect.y + roomRect.h * (portrait ? 0.44 : 0.48);
  const grad = ctx.createRadialGradient(
    glowCenterX,
    glowCenterY,
    18,
    glowCenterX,
    glowCenterY,
    roomRect.w * 0.85,
  );
  grad.addColorStop(0, exited ? 'rgba(200, 255, 46, 0.12)' : crashedActive ? 'rgba(230, 58, 67, 0.34)' : `rgba(255, 140, 74, ${0.12 + opts.tension * 0.22})`);
  grad.addColorStop(1, 'rgba(18, 20, 24, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(roomRect.x, roomRect.y, roomRect.w, roomRect.h);

  // Overtime ring light prop behind the desk when active (Page 7 & 12)
  if ((opts.propKind === 'apology-sponsor' || opts.propKind === 'badge-grows') && !exited) {
    const rx = roomRect.x + roomRect.w * 0.82;
    const ry = roomRect.y + roomRect.h * 0.28;
    ctx.save();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(rx, ry + 26);
    ctx.lineTo(rx, roomRect.y + roomRect.h);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rx, ry, 24, 0, Math.PI * 2);
    ctx.strokeStyle = PALETTE.ivory;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = PALETTE.lime;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  const pose = characterPose(state, layout, opts);
  const { scale, anchorX, anchorY, leanPx, deskY, shoulderCenter, leftShoulder, rightShoulder, headCenter } = pose;
  const nodRad = state.headNod.value * 0.25;

  // Twitching knee / foot near the lower edge when tension rises (Page 7 & 9)
  if (!exited && opts.tension > 0.2) {
    const twitchY = Math.sin(state.footTwitchPhase) * (3 + opts.tension * 6) * scale;
    ctx.save();
    ctx.fillStyle = '#262C3A';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(
      roomRect.x + roomRect.w * 0.78,
      roomRect.y + roomRect.h - 18 + twitchY,
      28 * scale,
      14 * scale,
      -0.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Torso / Hoodie
  const hoodieColor = exited ? '#2E473B' : '#323B4E';
  ctx.save();
  ctx.fillStyle = hoodieColor;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(anchorX - 82 * scale, anchorY + 30 * scale);
  ctx.quadraticCurveTo(leftShoulder.x - 22 * scale, leftShoulder.y, shoulderCenter.x, shoulderCenter.y - 18 * scale);
  ctx.quadraticCurveTo(rightShoulder.x + 22 * scale, rightShoulder.y, anchorX + 86 * scale + leanPx * 0.6, anchorY + 30 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hoodie drawstrings (sway with sleeveSway spring)
  const stringSway = state.sleeveSway.value * 14 * scale;
  ctx.strokeStyle = PALETTE.ivory;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(shoulderCenter.x - 10 * scale, shoulderCenter.y + 6 * scale);
  ctx.quadraticCurveTo(shoulderCenter.x - 12 * scale + stringSway, shoulderCenter.y + 32 * scale, shoulderCenter.x - 8 * scale + stringSway, shoulderCenter.y + 52 * scale);
  ctx.moveTo(shoulderCenter.x + 12 * scale, shoulderCenter.y + 6 * scale);
  ctx.quadraticCurveTo(shoulderCenter.x + 14 * scale + stringSway, shoulderCenter.y + 32 * scale, shoulderCenter.x + 10 * scale + stringSway, shoulderCenter.y + 50 * scale);
  ctx.stroke();
  ctx.restore();

  // Head & Expressive Face
  const headR = 44 * scale;

  ctx.save();
  ctx.translate(headCenter.x, headCenter.y);
  ctx.rotate(nodRad);

  // Hoodie back hood rim
  ctx.fillStyle = '#252C3B';
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(-6 * scale, 4 * scale, headR * 1.12, Math.PI * 0.6, Math.PI * 1.85);
  ctx.fill();
  ctx.stroke();

  // Head base
  ctx.fillStyle = '#F2C9AC';
  ctx.beginPath();
  ctx.arc(0, 0, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Screen light rim on the front of the face
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, headR - 1.5, -Math.PI * 0.42, Math.PI * 0.42);
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 4.5 * scale;
  ctx.stroke();
  ctx.restore();

  // Hair tuft (driven by hairBounce spring)
  const hairLift = state.hairBounce.value * 12 * scale;
  ctx.fillStyle = '#1C1E24';
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-headR * 0.75, -headR * 0.35);
  ctx.quadraticCurveTo(-headR * 0.2, -headR * 1.25 + hairLift, headR * 0.55, -headR * 0.85 + hairLift);
  ctx.quadraticCurveTo(headR * 0.85, -headR * 0.55, headR * 0.42, -headR * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tired eyes & pupils
  const leftEyeX = -6 * scale;
  const rightEyeX = 20 * scale;
  const eyeY = -6 * scale;
  const eyeRx = 9.5 * scale;
  const eyeRy = (state.expression === 'posted-shock' ? 11.5 : state.expression === 'peaceful' ? 3 : 8.5) * scale;

  // Tired under-eye bags
  ctx.strokeStyle = 'rgba(92, 60, 56, 0.55)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(leftEyeX, eyeY + 4 * scale, eyeRx * 0.9, 0.15, Math.PI - 0.15);
  ctx.moveTo(rightEyeX - eyeRx * 0.85, eyeY + 5 * scale);
  ctx.arc(rightEyeX, eyeY + 4 * scale, eyeRx * 0.9, 0.15, Math.PI - 0.15);
  ctx.stroke();

  if (state.expression === 'peaceful') {
    // Relaxed closed eyes
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.6 * scale;
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, eyeRx * 0.8, 0.1, Math.PI - 0.1);
    ctx.moveTo(rightEyeX - eyeRx * 0.8, eyeY);
    ctx.arc(rightEyeX, eyeY, eyeRx * 0.8, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else {
    // Sclera
    ctx.fillStyle = PALETTE.ivory;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.2 * scale;
    for (const ex of [leftEyeX, rightEyeX]) {
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bloodshot veins at high tension
      if (opts.tension > 0.65 && !exited) {
        ctx.strokeStyle = PALETTE.crashRed;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(ex - eyeRx * 0.8, eyeY);
        ctx.lineTo(ex - eyeRx * 0.4, eyeY - 2);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 2.2 * scale;
      }

      // Pupils tracking eyeTarget
      const px = ex + state.eyeTarget.x * 4.5 * scale;
      const py = eyeY + state.eyeTarget.y * 4 * scale;
      const pr = (state.expression === 'posted-shock' || state.expression === 'crash-lock' ? 2.6 : 4.2) * scale;
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ivory;
    }
  }

  // Expressive eyebrows
  const browTilt = state.browFurrow * 7 * scale;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3.5 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Left brow
  ctx.moveTo(leftEyeX - 10 * scale, eyeY - 12 * scale - browTilt * 0.6);
  ctx.lineTo(leftEyeX + 8 * scale, eyeY - 12 * scale + browTilt);
  // Right brow
  ctx.moveTo(rightEyeX - 8 * scale, eyeY - 12 * scale + browTilt);
  ctx.lineTo(rightEyeX + 10 * scale, eyeY - 12 * scale - browTilt * 0.6);
  ctx.stroke();

  // Shades drop on confirmed exit (Page 8)
  if (state.shadesDrop.value > 0.05) {
    const sy = -eyeY - (1 - state.shadesDrop.value) * 32 * scale;
    ctx.fillStyle = PALETTE.ink;
    ctx.strokeStyle = PALETTE.lime;
    ctx.lineWidth = 1.8 * scale;
    ctx.fillRect(leftEyeX - 12 * scale, sy - 11 * scale, 22 * scale, 13 * scale);
    ctx.strokeRect(leftEyeX - 12 * scale, sy - 11 * scale, 22 * scale, 13 * scale);
    ctx.fillRect(rightEyeX - 10 * scale, sy - 11 * scale, 22 * scale, 13 * scale);
    ctx.strokeRect(rightEyeX - 10 * scale, sy - 11 * scale, 22 * scale, 13 * scale);
  }

  // Jaw & Mouth (mutter, grimace, disbelief, or drop open)
  const mouthX = 8 * scale;
  const mouthY = 18 * scale;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.6 * scale;
  if (state.expression === 'peaceful') {
    ctx.beginPath();
    ctx.arc(mouthX, mouthY - 3 * scale, 9 * scale, 0.15, Math.PI - 0.15);
    ctx.stroke();
  } else if (state.jawOpen > 0.22) {
    const openH = Math.min(18, 5 + state.jawOpen * 16) * scale;
    ctx.fillStyle = '#3A1518';
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY, 11 * scale, openH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Clenched upper teeth bar when fuming or shocked
    ctx.fillStyle = PALETTE.ivory;
    ctx.fillRect(mouthX - 7 * scale, mouthY - openH * 0.45, 14 * scale, 4 * scale);
  } else {
    // Skeptical / muttering crooked line
    ctx.beginPath();
    ctx.moveTo(mouthX - 9 * scale, mouthY + 2 * scale);
    ctx.lineTo(mouthX + 9 * scale, mouthY - 2 * scale);
    ctx.stroke();
  }

  // Sweat beads at high tension (Page 7 & 9)
  if (state.sweatCount > 0 && !exited) {
    ctx.fillStyle = '#7CE0FF';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < state.sweatCount; i++) {
      const sx = (-24 + i * 11) * scale;
      const sy = (-24 + (i % 2) * 14 + ((opts.nowMs / 160 + i * 3) % 8)) * scale;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore(); // End head transform

  // Desk surface at the bottom of the room frame
  ctx.fillStyle = '#221E24';
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  ctx.fillRect(roomRect.x, deskY, roomRect.w, roomRect.y + roomRect.h - deskY);
  ctx.beginPath();
  ctx.moveTo(roomRect.x, deskY);
  ctx.lineTo(roomRect.x + roomRect.w, deskY);
  ctx.stroke();

  // Overtime RECEIPTS folder prop on the desk when active (Page 7 & 12)
  if (opts.propKind !== null && !exited) {
    const fx = roomRect.x + 22;
    const fy = deskY - 38 * scale;
    ctx.save();
    ctx.fillStyle = '#F7C86A';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(fx, fy, 84 * scale, 44 * scale, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `900 ${Math.round(11 * scale)}px "Arial Black", system-ui, sans-serif`;
    ctx.fillText('RECEIPTS', fx + 10 * scale, fy + 26 * scale);
    ctx.restore();
  }

  // Both elbows bend outward. The supporting palm sits behind the phone.
  const { phone, left, right } = pose;
  drawSleeve(ctx, leftShoulder, left, scale, hoodieColor);
  drawSleeve(ctx, rightShoulder, right, scale, hoodieColor);
  drawPalm(ctx, left.effector, phone.angle, scale);

  // Draw the phone body between the supporting hand and active thumb hand
  ctx.save();
  ctx.translate(phone.center.x, phone.center.y);
  ctx.rotate(phone.angle);
  ctx.fillStyle = exited ? '#1C222D' : '#10131A';
  ctx.strokeStyle = exited ? PALETTE.lime : crashedActive ? PALETTE.crashRed : PALETTE.ivory;
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.roundRect(-phone.width / 2 * scale, -phone.height / 2 * scale, phone.width * scale, phone.height * scale, 5 * scale);
  ctx.fill();
  ctx.stroke();
  if (!exited) {
    // Mini screen glow on handheld phone matching feed state
    ctx.fillStyle = crashedActive ? PALETTE.crashRed : glowColor;
    ctx.fillRect(-15 * scale, -29 * scale, 30 * scale, 58 * scale);

    // Small keyboard rows make the right thumb's typing target readable.
    ctx.fillStyle = 'rgba(16, 19, 26, 0.45)';
    for (let row = 0; row < 2; row++) {
      for (let key = 0; key < 4; key++) {
        ctx.fillRect((-11 + key * 6) * scale, (4 + row * 6) * scale, 4 * scale, 3 * scale);
      }
    }
    // Mini Post button dot on the handheld screen
    ctx.fillStyle = state.thumbAction === 'hover-post' || state.thumbAction === 'post-press' ? PALETTE.orange : PALETTE.postBlue;
    ctx.fillRect(4 * scale, 16 * scale, 9 * scale, 8 * scale);
  }
  ctx.restore();

  // Fingers wrap over the left bezel, with a steady supporting thumb on the edge.
  ctx.save();
  ctx.translate(left.effector.x, left.effector.y);
  ctx.rotate(phone.angle);
  for (let finger = 0; finger < 3; finger++) {
    const y = (finger * 7 - 2) * (1 - phone.down * 0.75) * scale;
    drawLimbSegment(ctx, { x: 0, y }, { x: 9 * scale, y: y - 2 * scale }, 4 * scale, '#F2C9AC');
  }
  drawLimbSegment(ctx, { x: -2 * scale, y: -5 * scale }, { x: 10 * scale, y: -(14 - phone.down * 10) * scale }, 6 * scale, '#F2C9AC');
  ctx.restore();

  drawPalm(ctx, right.effector, pose.rightHandAngle, scale);
  drawLimbSegment(ctx, pose.thumbBase, pose.thumb.joint, 6.5 * scale, '#F2C9AC');
  drawLimbSegment(ctx, pose.thumb.joint, pose.thumb.effector, 6 * scale, '#F2C9AC');

  // Coffee mug on the desk that rattles on acting accents (Page 7 & 9)
  const mugX = roomRect.x + roomRect.w * (portrait ? 0.16 : 0.18) + state.mugRattle.value * 2.2;
  const mugY = deskY - 28 * scale;
  ctx.save();
  ctx.translate(mugX, mugY);
  ctx.rotate(state.mugRattle.value * 0.04);
  ctx.fillStyle = PALETTE.ivory;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-14 * scale, 0, 28 * scale, 32 * scale, 4);
  ctx.fill();
  ctx.stroke();
  // Mug handle
  ctx.beginPath();
  ctx.arc(14 * scale, 16 * scale, 8 * scale, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  // Coffee rim accent
  ctx.fillStyle = PALETTE.orange;
  ctx.fillRect(-11 * scale, 8 * scale, 22 * scale, 5 * scale);
  ctx.restore();

  ctx.restore(); // End roomRect clip
}
