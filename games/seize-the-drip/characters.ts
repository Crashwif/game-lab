import { box, ease, label, line, mix, oval, poly, solveLimb, walkingFoot, type Ctx, type Point } from './ink';
import { item, shoppingBag } from './props';
import { placard } from './content';
import type { Frame } from './presentation';
import type { Haul } from './loot';

const EDGE = '#282027';

function drawLimb(c: Ctx, root: Point, limb: { joint: Point; end: Point }, color: string, width: number, outline = EDGE) {
  line(c, [root.x, root.y, limb.joint.x, limb.joint.y, limb.end.x, limb.end.y], outline, width + 4);
  line(c, [root.x, root.y, limb.joint.x, limb.joint.y, limb.end.x, limb.end.y], color, width);
}

export function heroPose(frame: Frame, haul: Haul, time: number, distance = 0, walkSpan = 260) {
  const raised = frame.phase === 'crashed' ? ease((frame.outcomeAge - .12) / .5) : 0;
  const walkBlend = distance > 0 && distance < walkSpan ? ease(distance / 18) * ease((walkSpan - distance) / 18) : 0;
  const bounce = mix(Math.sin(time * 2.1) * 1.8, Math.abs(Math.sin(distance / 50 * Math.PI * 2)) * 3, walkBlend);
  const lean = Math.sin(time * 1.5) * 2 + Math.min(haul.items.length, 12) * .27 + walkBlend * 2.2;
  const leftRoot = { x: -26 + lean, y: -128 + bounce };
  const rightRoot = { x: 26 + lean, y: -128 + bounce };
  const reach = Math.sin(haul.progress * Math.PI * 2);
  // Fixed outward poles (-1 for left, +1 for right) keep elbows hanging down at rest and bending outward when raised.
  const left = solveLimb(leftRoot, { x: mix(-63 - reach * 5, -51, raised), y: mix(-92 + reach * 7, -183, raised) + bounce }, 35, 34, -1);
  const right = solveLimb(rightRoot, { x: mix(63 + reach * 8, 54, raised), y: mix(-98 - reach * 10, -182, raised) + bounce }, 35, 34, 1);
  const leftFoot = walkingFoot(distance, walkSpan, 50, 0, 13);
  const rightFoot = walkingFoot(distance, walkSpan, 50, .5, 13);
  const leftHip = { x: -14 + lean, y: -72 + bounce };
  const rightHip = { x: 14 + lean, y: -72 + bounce };
  const leftLeg = solveLimb(leftHip, { x: -15 + leftFoot.x, y: -8 + leftFoot.y }, 37, 35, 1);
  const rightLeg = solveLimb(rightHip, { x: 15 + rightFoot.x, y: -8 + rightFoot.y }, 37, 35, -1);
  return { bounce, lean, leftRoot, rightRoot, left, right, leftFoot, rightFoot, leftHip, rightHip, leftLeg, rightLeg, raised };
}

export function hero(c: Ctx, frame: Frame, haul: Haul, x: number, floor: number, scale: number, time: number, distance = 0, walkSpan = 260) {
  const caught = frame.phase === 'crashed';
  const pose = heroPose(frame, haul, time, distance, walkSpan);
  const { raised } = pose;
  c.save(); c.translate(x, floor); c.scale(scale, scale);
  oval(c, 2, 5, 65, 9, '#3d29273b');
  // 1. Two fixed-length leg chains and shoes behind the torso.
  for (const [hip, leg] of [[pose.leftHip, pose.leftLeg], [pose.rightHip, pose.rightLeg]] as const) {
    drawLimb(c, hip, leg, '#29242c', 17);
    box(c, leg.end.x - 10, leg.end.y - 5, 29, 13, frame.stage >= 2 ? '#f5ebda' : '#747775', EDGE, 5);
    line(c, [leg.end.x - 9, leg.end.y + 6, leg.end.x + 18, leg.end.y + 6], '#b3a486', 3);
  }
  // 2. Torso, jacket quilting, sash, fur collar and chest chain.
  c.save(); c.translate(pose.lean, pose.bounce);
  poly(c, [-31, -137, 28, -137, 38, -76, -34, -72], frame.stage > 3 ? '#ccb38e' : '#6f2738', EDGE);
  for (let y = -123; y < -73; y += 13) line(c, [-29, y, 31, y - 1], frame.stage > 3 ? '#9d8364' : '#4a1b2c', 2);
  line(c, [3, -135, 3, -77], '#d3b16a', 2);
  box(c, 14, -126, 13, 9, '#edcc82', EDGE, 2);
  label(c, 'VIP', 20, -121, 5, EDGE, 12);
  if (frame.stage >= 5) {
    c.save(); c.translate(5, -98); c.rotate(-.6);
    box(c, -37, -8, 74, 17, '#773544', '#d5b16a', 2);
    label(c, 'COMRADE VIP', 0, 0, 8, '#f5db9a', 68); c.restore();
    for (let i = 0; i < 8; i++) oval(c, -26 + i * 7, -137 + Math.sin(i * .5) * 7, 8, 9, '#f4e2c0', '#b89e77');
  }
  if (frame.stage >= 2) {
    c.strokeStyle = '#deb45e'; c.lineWidth = 5;
    c.beginPath(); c.arc(0, -130, 17, 0, Math.PI); c.stroke();
    label(c, '€', 0, -108, 21, '#f5d986', 25, 'center', 'Georgia');
  }
  c.restore();
  // 3. Head, balaclava mask, crown, expressive eyes/brows, and attached price tag.
  c.save(); c.translate(pose.lean, pose.bounce - 159); c.rotate(caught ? -.08 : Math.sin(time * .8) * .045);
  oval(c, 0, -6, 29, 36, '#292a2d', EDGE);
  if (frame.stage >= 6) {
    poly(c, [-28, -37, -32, -58, -16, -48, -3, -67, 10, -48, 28, -60, 25, -36], '#d7ad51', EDGE);
    line(c, [-26, -39, 25, -39], '#f6d98c', 4);
    oval(c, -2, -48, 4, 6, '#9f3a4c', EDGE);
  }
  for (let i = 0; i < 6; i++) line(c, [-21 + i * 8, -30, -20 + i * 8, 20], '#3a3a3d', .8);
  box(c, -24, -17, 48, 17, '#d3a17c', EDGE, 8);
  const blink = Math.sin(time * 1.7) > .993;
  for (const sign of [-1, 1]) {
    oval(c, sign * 11, -8, 7, blink ? 1 : caught ? 7 : 5, '#f8efdf');
    oval(c, sign * 11 + (caught ? -1 : 2), -7, 2.5, blink ? .7 : 4, '#241c24');
    line(c, [sign * 7, -21 + raised * 3, sign * 18, -21 - raised * 2], '#17161c', 3);
  }
  oval(c, 0, 10, caught ? 8 : 10, caught ? 8 : 4, '#aa7b66', EDGE);
  if (!caught) line(c, [-6, 9, 2, 12, 7, 8], '#572e2f', 1.5);
  if (frame.stage >= 1) {
    line(c, [24, -20, 38, -3], '#e3d8bd', 1);
    box(c, 32, -4, 18, 30, '#f0debc', EDGE, 1);
    label(c, '€890', 41, 7, 6, EDGE, 16); label(c, 'MASK', 41, 16, 5, EDGE, 16);
  }
  c.restore();
  // 4. Articulated arms and wrist watch before the hands and held straps.
  const sleeveColor = frame.stage > 3 ? '#c5ad88' : '#82384b';
  for (const [root, limb] of [[pose.leftRoot, pose.left], [pose.rightRoot, pose.right]] as const) {
    drawLimb(c, root, limb, sleeveColor, 15);
  }
  if (frame.stage >= 4) {
    box(c, pose.right.end.x - 8, pose.right.end.y - 14, 16, 10, '#edc96b', EDGE, 2);
    oval(c, pose.right.end.x, pose.right.end.y - 9, 6, 6, '#253636', '#e9c976');
  }
  // 5. Held loot straps and items hang from the wrists; palms and thumbs clasp over the cords.
  if (!caught || frame.outcomeAge < .22) {
    for (let i = haul.items.length - 1; i >= 0; i--) {
      const kind = haul.items[i]!;
      const hand = i % 2 ? pose.right.end : pose.left.end;
      const offset = Math.floor(i / 2);
      const dx = (i % 2 ? 1 : -1) * (offset * 12 + 4), dy = offset * 10 + 6;
      line(c, [hand.x, hand.y, hand.x + dx, hand.y + dy], '#d8be8e', 1.8);
      item(c, kind, hand.x + dx, hand.y + dy, .62, Math.sin(time * 2.5 + i) * .06 + (i % 2 ? -.11 : .11), i === haul.items.length - 1);
    }
  }
  for (const limb of [pose.left, pose.right]) {
    oval(c, limb.end.x, limb.end.y, 8, 9, '#e0ac87', EDGE);
  }
  c.restore();
  return pose;
}

export function protestSign(c: Ctx, x: number, y: number, stage: number, time: number, scale = 1) {
  const text = placard(stage);
  c.save(); c.translate(x, y); c.rotate(-.12 + Math.sin(time * 1.3) * .03); c.scale(scale, scale);
  line(c, [0, 0, 0, -113], '#94724e', 6);
  box(c, -56, -140, 112, 58, '#e2d0a8', '#443335', 1);
  label(c, text[0]!, 0, -122, 16, '#6f2433', 104, 'center', 'Georgia');
  label(c, text[1]!, 0, -99, 18, '#30262b', 104, 'center', 'Georgia'); c.restore();
}

export function bystanderPose(role: number, time: number) {
  const bob = Math.sin(time * 2 + role) * 1.4;
  const leftHip = { x: -10, y: -49 + bob };
  const rightHip = { x: 10, y: -49 + bob };
  const leftLeg = solveLimb(leftHip, { x: -12, y: -5 }, 24, 24, 1);
  const rightLeg = solveLimb(rightHip, { x: 13, y: -5 }, 24, 24, -1);
  const leftRoot = { x: -17, y: -88 + bob };
  const rightRoot = { x: 17, y: -88 + bob };
  const sweep = Math.sin(time * 1.8) * 14;
  const broomTop = { x: 24 + sweep * .18, y: -104 + bob };
  const broomBottom = { x: 42 + sweep, y: 0 };
  const onBroom = (u: number): Point => ({
    x: mix(broomTop.x, broomBottom.x, u),
    y: mix(broomTop.y, broomBottom.y, u),
  });
  let leftTarget: Point, rightTarget: Point;
  let leftPole = -1, rightPole = 1;
  if (role === 0) {
    // Employee: both hands grip collinear points along the broom handle.
    leftTarget = onBroom(.22);
    rightTarget = onBroom(.50);
    leftPole = 1;
    rightPole = -1;
  } else if (role === 1) {
    leftTarget = { x: -28, y: -54 + bob };
    rightTarget = { x: 37, y: -58 + bob };
  } else if (role === 2 || role === 3) {
    leftTarget = { x: -29, y: -56 + bob };
    rightTarget = { x: 49, y: -120 + Math.sin(time * 2) * 4 + bob };
  } else {
    leftTarget = { x: -37, y: -46 + bob };
    rightTarget = { x: 37, y: -46 + bob };
  }
  const leftArm = solveLimb(leftRoot, leftTarget, 28, 27, leftPole);
  const rightArm = solveLimb(rightRoot, rightTarget, 28, 27, rightPole);
  return { bob, leftHip, rightHip, leftLeg, rightLeg, leftRoot, rightRoot, leftArm, rightArm, sweep, broomTop, broomBottom };
}

export function bystander(c: Ctx, x: number, floor: number, scale: number, role: number, time: number) {
  const pose = bystanderPose(role, time);
  const { bob } = pose;
  const coat = ['#54746c', '#676178', '#88634e', '#4b4555', '#938561'][role]!;
  c.save(); c.translate(x, floor); c.scale(scale, scale);
  oval(c, 0, 3, 31, 5, '#36292d2b');
  for (const [hip, leg] of [[pose.leftHip, pose.leftLeg], [pose.rightHip, pose.rightLeg]] as const) {
    drawLimb(c, hip, leg, '#3b353c', 11);
    box(c, leg.end.x - 8, leg.end.y - 3, 19, 8, '#282328', EDGE, 3);
  }
  if (role !== 0) {
    drawLimb(c, pose.leftRoot, pose.leftArm, coat, 10);
    if (role === 4) shoppingBag(c, pose.leftArm.end.x, pose.leftArm.end.y, .8, time - 1);
    oval(c, pose.leftArm.end.x, pose.leftArm.end.y, 6, 6.5, '#d4a17e', EDGE);
  }
  box(c, -20, -97 + bob, 41, 52, coat, EDGE, 7);
  if (role === 0) label(c, 'STAFF', 0, -76 + bob, 8, '#f8e8c4', 37);
  oval(c, 0, -115 + bob, 21, 26, '#d4a17e', EDGE);
  poly(c, [-22, -122 + bob, -15, -143 + bob, 12, -142 + bob, 24, -122 + bob, 7, -129 + bob, -14, -123 + bob], '#392e31');
  for (const sign of [-1, 1]) oval(c, sign * 8, -113 + bob, 2, 3, '#251d25');
  line(c, [-6, -102 + bob, 6, -102 + bob], '#85574c', 2);
  if (role === 0) {
    // Far upper arm behind the broom shaft, broom in middle, forearms and clasping hands in front.
    line(c, [pose.leftRoot.x, pose.leftRoot.y, pose.leftArm.joint.x, pose.leftArm.joint.y], EDGE, 14);
    line(c, [pose.leftRoot.x, pose.leftRoot.y, pose.leftArm.joint.x, pose.leftArm.joint.y], coat, 10);
    line(c, [pose.broomTop.x, pose.broomTop.y, pose.broomBottom.x, pose.broomBottom.y], '#a77b4b', 5);
    box(c, pose.broomBottom.x - 20, -3, 39, 10, '#c09a53', EDGE, 1);
    line(c, [pose.leftArm.joint.x, pose.leftArm.joint.y, pose.leftArm.end.x, pose.leftArm.end.y], EDGE, 14);
    line(c, [pose.leftArm.joint.x, pose.leftArm.joint.y, pose.leftArm.end.x, pose.leftArm.end.y], coat, 10);
    drawLimb(c, pose.rightRoot, pose.rightArm, coat, 10);
    oval(c, pose.leftArm.end.x, pose.leftArm.end.y, 6, 6.5, '#d4a17e', EDGE);
    oval(c, pose.rightArm.end.x, pose.rightArm.end.y, 6, 6.5, '#d4a17e', EDGE);
  } else if (role === 1) {
    drawLimb(c, pose.rightRoot, pose.rightArm, coat, 10);
    const hand = pose.rightArm.end;
    box(c, hand.x - 13, hand.y - 27, 30, 40, '#7d2638', '#d0a16a', 1);
    label(c, 'CAPITAL', hand.x + 2, hand.y - 13, 6, '#edd8a8', 28);
    label(c, 'UNREAD', hand.x + 2, hand.y + 2, 5, '#edd8a8', 28);
    line(c, [hand.x - 13, hand.y + 11, hand.x + 16, hand.y - 27], '#fff2c7aa', 2);
    oval(c, hand.x - 6, hand.y, 6, 6.5, '#d4a17e', EDGE);
  } else if (role === 2 || role === 3) {
    drawLimb(c, pose.rightRoot, pose.rightArm, coat, 10);
    const hand = pose.rightArm.end;
    box(c, hand.x - 8, hand.y - 22, 17, 29, '#201e29', '#dfbd7b', 3);
    box(c, hand.x - 5, hand.y - 17, 11, 18, '#8fafad', undefined, 1);
    if (role === 2) label(c, 'LIVE', hand.x, hand.y - 30, 7, '#9d2239', 30);
    oval(c, hand.x, hand.y, 6, 6.5, '#d4a17e', EDGE);
  } else {
    drawLimb(c, pose.rightRoot, pose.rightArm, coat, 10);
    shoppingBag(c, pose.rightArm.end.x, pose.rightArm.end.y, .8, time + 1);
    oval(c, pose.rightArm.end.x, pose.rightArm.end.y, 6, 6.5, '#d4a17e', EDGE);
  }
  c.restore();
  return pose;
}

export function officerPose(travelled: number, scale: number, time: number, dir: 1 | -1 = 1, span = 150) {
  const walkDist = travelled / scale;
  const walkSpan = span / scale;
  const walkBlend = walkDist > 0 && walkDist < walkSpan ? ease(walkDist / 16) * ease((walkSpan - walkDist) / 16) : 0;
  const bob = walkBlend * Math.abs(Math.sin(walkDist / 46 * Math.PI * 2)) * 2.2;
  const leftStep = walkingFoot(walkDist, walkSpan, 46, 0, 11);
  const rightStep = walkingFoot(walkDist, walkSpan, 46, .5, 11);
  const leftHip = { x: -10, y: -54 + bob };
  const rightHip = { x: 10, y: -54 + bob };
  const leftLeg = solveLimb(leftHip, { x: -10 + leftStep.x * dir, y: -7 + leftStep.y }, 29, 29, -dir);
  const rightLeg = solveLimb(rightHip, { x: 10 + rightStep.x * dir, y: -7 + rightStep.y }, 29, 29, -dir);
  const leftRoot = { x: -19, y: -95 + bob };
  const rightRoot = { x: 19, y: -95 + bob };
  const leftArm = solveLimb(leftRoot, { x: -27, y: -63 + Math.sin(time) + bob }, 26, 26, -1);
  const rightArm = solveLimb(rightRoot, { x: 26, y: -62 - Math.sin(time) + bob }, 26, 26, 1);
  return { bob, leftHip, rightHip, leftLeg, rightLeg, leftRoot, rightRoot, leftArm, rightArm, dir };
}

export function officer(c: Ctx, x: number, floor: number, scale: number, travelled: number, time: number, dir: 1 | -1 = 1) {
  const pose = officerPose(travelled, scale, time, dir);
  const { bob } = pose;
  c.save(); c.translate(x, floor); c.scale(scale, scale);
  oval(c, 0, 3, 34, 6, '#1f283038');
  for (const [hip, leg] of [[pose.leftHip, pose.leftLeg], [pose.rightHip, pose.rightLeg]] as const) {
    drawLimb(c, hip, leg, '#253a4b', 13);
    box(c, leg.end.x - (dir > 0 ? 9 : 17), leg.end.y - 2, 26, 10, '#18222b', EDGE, 3);
  }
  drawLimb(c, pose.rightRoot, pose.rightArm, '#2c4559', 12);
  oval(c, pose.rightArm.end.x, pose.rightArm.end.y, 6, 6.5, '#18222b', EDGE);
  box(c, -25, -108 + bob, 50, 62, '#2c4559', EDGE, 8);
  oval(c, 0, -124 + bob, 25, 25, '#293947', EDGE);
  box(c, -25, -131 + bob, 50, 20, '#a3c3c5d9', '#c8dee2', 5);
  line(c, [-17, -126 + bob, 15, -126 + bob], '#e7f4eb99', 2);
  drawLimb(c, pose.leftRoot, pose.leftArm, '#2c4559', 12);
  const hand = pose.leftArm.end;
  oval(c, hand.x, hand.y, 6, 6.5, '#18222b', EDGE);
  box(c, hand.x - 22, hand.y - 26, 48, 75, '#8fa5b1c9', '#d5e1e2', 9);
  label(c, 'RETURNS', hand.x + 2, hand.y - 4, 7, '#203145', 44);
  label(c, 'DESK', hand.x + 2, hand.y + 9, 9, '#203145', 44);
  c.restore();
  return pose;
}
