/**
 * The stoker: the player's stand-in at the firebox. He shovels coal in a
 * cycle whose pace follows the multiplier, both hands on the shovel through
 * two-bone arms, the torso and head trailing on springs. An accepted exit
 * sends him behind the blast shield with his goggles down; a blow-out with
 * him still at the door throws him across the room.
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { DOOR, FLOOR_Y } from './engine';

export type StokerMode = 'idle' | 'stoking' | 'running' | 'sheltered' | 'blasted' | 'floored';
type Point = { x: number; y: number };

/** Where the blast shield stands; he crouches behind it. */
export const SHIELD = { x: 84, top: 326, width: 58 };
const HOME_X = 176;
const HIP_Y = 380;
const INK = '#1c1f26';
const SKIN = '#f3dccb';
const SKIN_SHADE = '#e0bda7';
const SHIRT = '#c9ccd1';
const TROUSERS = '#3a3f4a';
const CAP = '#6b6f78';

/** Solves a two-bone limb with a fixed endpoint and a consistent bend direction. */
function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + dx / distance * along - dy / distance * bend, y: root.y + dy / distance * along + dx / distance * bend };
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const quad = (a: Point, b: Point, c: Point, t: number): Point => {
  const k = 1 - t;
  return { x: k * k * a.x + 2 * k * t * b.x + t * t * c.x, y: k * k * a.y + 2 * k * t * b.y + t * t * c.y };
};

export interface StokerDrive {
  /** Shovel cycles per second while stoking. */
  rate: number;
  fear: number;
  pressure: number;
}

export interface StokerState {
  mode: StokerMode;
  time: number;
  modeAge: number;
  x: number;
  phase: number;
  lean: Spring;
  nod: Spring;
  crouch: Spring;
  goggles: Spring;
  wipe: Spring;
  wipeAt: number;
  eyeOpen: Spring;
  mouthOpen: Spring;
  mouthCurve: Spring;
  brow: Spring;
  blinkAt: number;
  fall: { x: number; y: number; vx: number; vy: number; angle: number; spin: number };
  shovelDropped: boolean;
  fear: number;
  soot: number;
  events: { throw: boolean };
}

export function createStoker(): StokerState {
  return {
    mode: 'idle', time: 0, modeAge: 0, x: HOME_X, phase: 0.95, lean: spring(0), nod: spring(0), crouch: spring(0), goggles: spring(0), wipe: spring(0), wipeAt: 3,
    eyeOpen: spring(1), mouthOpen: spring(0.05), mouthCurve: spring(0.2), brow: spring(0), blinkAt: 2.4,
    fall: { x: HOME_X, y: HIP_Y, vx: 0, vy: 0, angle: 0, spin: 0 }, shovelDropped: false, fear: 0, soot: 0, events: { throw: false },
  };
}

function setMode(s: StokerState, mode: StokerMode): void {
  s.mode = mode;
  s.modeAge = 0;
}

export function resetStoker(s: StokerState): void {
  setMode(s, 'idle');
  s.x = HOME_X;
  s.phase = 0.95;
  settleSpring(s.lean, 0);
  settleSpring(s.nod, 0);
  settleSpring(s.crouch, 0);
  settleSpring(s.goggles, 0);
  settleSpring(s.wipe, 0);
  s.shovelDropped = false;
  s.soot = 0;
}

/**
 * Jumps to the state a late joiner would see: stoking with the soot the
 * pressure has given him, behind the shield once his exit was accepted, or
 * floored by a blow-out he stayed for.
 */
export function settleStoker(s: StokerState, running: boolean, crashed: boolean, sheltered: boolean, pressure: number): void {
  resetStoker(s);
  s.soot = clamp(pressure * 0.4, 0, 1);
  if (sheltered && (running || crashed)) {
    setMode(s, 'sheltered');
    s.x = SHIELD.x;
    s.shovelDropped = true;
    settleSpring(s.crouch, 1);
    settleSpring(s.goggles, 1);
  } else if (crashed) {
    setMode(s, 'floored');
    s.fall = { x: 78, y: FLOOR_Y - 26, vx: 0, vy: 0, angle: -Math.PI / 2, spin: 0 };
    s.soot = 1;
    s.shovelDropped = true;
  } else if (running) {
    setMode(s, 'stoking');
  }
}

/** The exit was accepted: drop the shovel and get behind the shield. */
export function callShield(s: StokerState): void {
  if (s.mode !== 'stoking' && s.mode !== 'idle') return;
  setMode(s, 'running');
  s.shovelDropped = true;
}

/** The valve blew. */
export function blastStoker(s: StokerState, quiet: boolean): void {
  if (s.mode === 'stoking' || s.mode === 'idle') {
    s.shovelDropped = true;
    s.soot = 1;
    if (quiet) {
      setMode(s, 'floored');
      s.fall = { x: 78, y: FLOOR_Y - 26, vx: 0, vy: 0, angle: -Math.PI / 2, spin: 0 };
    } else {
      setMode(s, 'blasted');
      s.fall = { x: s.x, y: HIP_Y, vx: -300, vy: -300, angle: 0, spin: -6 };
    }
  } else if (s.mode === 'running') {
    // The exit was accepted: he makes it behind the shield in the nick of time.
    setMode(s, 'sheltered');
    s.x = SHIELD.x;
    settleSpring(s.crouch, 1);
  } else if (s.mode === 'sheltered') {
    s.crouch.v += 6;
  }
}

/** Shovel geometry through the cycle: where the blade and the grip are, and whether coal is on it. */
export const SHOVEL_LENGTH = 122;
export function shovelPose(u: number): { blade: Point; grip: Point; tip: number; carrying: boolean } {
  const phase = ((u % 1) + 1) % 1;
  const swing = smoothstep(0.24, 0.64, phase) * (1 - smoothstep(0.72, 1, phase));
  const grip = { x: 200 + 22 * swing, y: 340 - 24 * Math.sin(swing * Math.PI) };
  const angle = mix(2.15, 0.45, swing);
  return { grip, blade: { x: grip.x + Math.cos(angle) * SHOVEL_LENGTH, y: grip.y + Math.sin(angle) * SHOVEL_LENGTH }, tip: 0, carrying: phase >= 0.25 && phase < 0.67 };
}

type Mood = 'calm' | 'nervous' | 'panic' | 'shock' | 'smug' | 'dazed';
const FACES: Record<Mood, { eye: number; open: number; curve: number; brow: number }> = {
  calm: { eye: 1, open: 0.05, curve: 0.25, brow: 0 },
  nervous: { eye: 1.1, open: 0.12, curve: -0.25, brow: 0.6 },
  panic: { eye: 1.35, open: 0.55, curve: -0.55, brow: 1 },
  shock: { eye: 1.7, open: 1, curve: 0.05, brow: 1 },
  smug: { eye: 0.75, open: 0.08, curve: 0.75, brow: -0.4 },
  dazed: { eye: 0.6, open: 0.3, curve: -0.3, brow: 0.4 },
};

export function stepStoker(s: StokerState, drive: StokerDrive, dt: number): void {
  s.time += dt;
  s.modeAge += dt;
  s.fear = drive.fear;
  s.events.throw = false;
  const u0 = s.phase - Math.floor(s.phase);
  let leanTarget = 0;
  let nodTarget = 0;
  switch (s.mode) {
    case 'stoking': {
      // Work, catch a breath, and brace against another pressure surge.
      const fatigue = s.time > 45 ? Math.pow(Math.max(0, Math.sin((s.time - 45) * Math.PI / 15)), 6) : 0;
      s.phase += drive.rate * (1 - fatigue * 0.78) * dt;
      s.wipe.v += fatigue * dt * 2;
      const u = s.phase - Math.floor(s.phase);
      if ((u0 < 0.62 && u >= 0.62) || (u < u0 && u >= 0.62)) s.events.throw = true;
      const pose = shovelPose(u);
      leanTarget = clamp((pose.blade.x - s.x) / 420, -0.3, 0.45);
      nodTarget = leanTarget * 0.5;
      s.soot = clamp(s.soot + (drive.pressure * 0.4 - s.soot) * dt * 0.3, 0, 1);
      break;
    }
    case 'idle': {
      // Rest the phase at the top of the cycle and wipe the brow now and then.
      const rest = Math.ceil(s.phase - 1e-9) - 0.05;
      if (s.phase < rest) s.phase = Math.min(rest, s.phase + 0.8 * dt);
      if (s.time > s.wipeAt) { s.wipe.v += 9; s.wipeAt = s.time + 4 + noise(s.wipeAt) * 4; }
      nodTarget = Math.sin(s.time * 1.5) * 0.04;
      break;
    }
    case 'running': {
      const k = clamp(s.modeAge / 0.55, 0, 1);
      s.x = mix(HOME_X, SHIELD.x, k * k * (3 - 2 * k));
      leanTarget = -0.18;
      if (k >= 1) setMode(s, 'sheltered');
      break;
    }
    case 'sheltered':
      s.x = SHIELD.x;
      break;
    case 'blasted':
      s.fall.vy += 900 * dt;
      s.fall.x += s.fall.vx * dt;
      s.fall.y += s.fall.vy * dt;
      s.fall.angle += s.fall.spin * dt;
      if (s.fall.x < 78) { s.fall.x = 78; s.fall.vx = 0; }
      if (s.fall.y >= FLOOR_Y - 26) {
        s.fall.y = FLOOR_Y - 26;
        s.fall.angle = -Math.PI / 2;
        setMode(s, 'floored');
      }
      break;
    case 'floored':
      break;
  }
  stepSpring(s.lean, leanTarget, 14, 0.7, dt);
  stepSpring(s.nod, nodTarget, 9, 0.45, dt);
  stepSpring(s.crouch, s.mode === 'sheltered' ? 1 : 0, 10, 0.6, dt);
  stepSpring(s.goggles, s.mode === 'sheltered' ? 1 : 0, 12, 0.5, dt);
  stepSpring(s.wipe, 0, 3.5, 0.9, dt);
  const mood: Mood = s.mode === 'floored' ? 'dazed' : s.mode === 'blasted' ? 'shock' : s.mode === 'sheltered' || s.mode === 'running' ? 'smug' : drive.fear > 0.62 ? 'panic' : drive.fear > 0.25 ? 'nervous' : 'calm';
  const face = FACES[mood];
  const blinking = s.time > s.blinkAt && s.time < s.blinkAt + 0.13;
  if (s.time >= s.blinkAt + 0.13) s.blinkAt = s.time + 2.2 + 2.6 * noise(s.blinkAt);
  stepSpring(s.eyeOpen, blinking && mood !== 'shock' ? 0.08 : face.eye, 26, 0.9, dt);
  stepSpring(s.mouthOpen, face.open, 14, 0.8, dt);
  stepSpring(s.mouthCurve, face.curve, 10, 0.8, dt);
  stepSpring(s.brow, face.brow, 12, 0.75, dt);
}

/** World position of the shovel blade while he holds it, for the coal he throws. */
export function bladePoint(s: StokerState): Point {
  return shovelPose(s.phase - Math.floor(s.phase)).blade;
}

export function drawShield(ctx: CanvasRenderingContext2D): void {
  const x = SHIELD.x;
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#3a3f4a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - SHIELD.width / 2, SHIELD.top, SHIELD.width, FLOOR_Y - SHIELD.top - 8, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6a6f7a';
  for (let y = SHIELD.top + 10; y < FLOOR_Y - 14; y += 16) {
    ctx.beginPath(); ctx.arc(x - SHIELD.width / 2 + 7, y, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + SHIELD.width / 2 - 7, y, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.roundRect(x - 14, SHIELD.top + 16, 28, 14, 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2;
  for (const bx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x + bx, SHIELD.top + 17); ctx.lineTo(x + bx, SHIELD.top + 29); ctx.stroke(); }
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  for (const wx of [-18, 18]) { ctx.beginPath(); ctx.arc(x + wx, FLOOR_Y - 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#e63946';
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFF', x, SHIELD.top + 52);
  ctx.fillText('SHORE', x, SHIELD.top + 63);
}

function drawShovel(ctx: CanvasRenderingContext2D, grip: Point, blade: Point, tip: number, carrying: boolean): void {
  const dx = blade.x - grip.x;
  const dy = blade.y - grip.y;
  const len = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.lineTo(blade.x - (dx / len) * 12, blade.y - (dy / len) * 12); ctx.stroke();
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#5a3d24'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.save(); ctx.translate(grip.x, grip.y); ctx.rotate(angle);
  ctx.beginPath(); ctx.roundRect(-10, -8, 12, 16, 4); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(blade.x, blade.y);
  ctx.rotate(angle + tip * 1.1);
  ctx.fillStyle = '#8f96a3'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-16, -11); ctx.lineTo(14, -13); ctx.lineTo(18, 13); ctx.lineTo(-16, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (carrying) {
    ctx.fillStyle = '#1b1b1f';
    for (const [cx, cy, r] of [[-4, -4, 6], [5, -6, 5], [1, 2, 6], [9, 1, 4]] as const) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

export function drawShovelOnFloor(ctx: CanvasRenderingContext2D): void {
  drawShovel(ctx, { x: 190, y: 456 }, { x: 190 + Math.sqrt(SHOVEL_LENGTH ** 2 - 36), y: 462 }, 0, false);
}

export function drawStoker(ctx: CanvasRenderingContext2D, s: StokerState): void {
  const crouch = clamp(s.crouch.x, 0, 1.1);
  const floored = s.mode === 'floored';
  const blasted = s.mode === 'blasted';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const hip: Point = floored || blasted ? { x: s.fall.x, y: s.fall.y } : { x: s.x, y: HIP_Y + crouch * 46 };
  if (floored || blasted) { ctx.translate(hip.x, hip.y); ctx.rotate(s.fall.angle); ctx.translate(-hip.x, -hip.y); }
  const lean = s.lean.x;
  const torso = 98 - crouch * 30;
  const shoulder: Point = { x: hip.x + Math.sin(lean) * torso, y: hip.y - Math.cos(lean) * torso };
  const headRot = lean * 0.6 + s.nod.x;
  const head: Point = { x: shoulder.x + Math.sin(headRot) * 44, y: shoulder.y - Math.cos(headRot) * 44 };
  const toWorld = (lx: number, ly: number): Point => ({ x: head.x + lx * Math.cos(headRot) - ly * Math.sin(headRot), y: head.y + lx * Math.sin(headRot) + ly * Math.cos(headRot) });
  const running = s.mode === 'running';
  const stride = running ? Math.sin(s.time * 16) * 14 : 0;
  const footL: Point = floored || blasted ? { x: hip.x - 34, y: hip.y + 60 } : { x: hip.x - 38 + stride, y: FLOOR_Y - 2 };
  const footR: Point = floored || blasted ? { x: hip.x + 36, y: hip.y + 58 } : { x: hip.x + 40 - stride, y: FLOOR_Y - 2 };

  function segment(a: Point, b: Point, width: number, colour: string) {
    ctx.strokeStyle = colour; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function limb(root: Point, end: Point, upper: number, lower: number, side: number, width: number, colour: string): Point {
    const joint = bendJoint(root, end, upper, lower, side);
    segment(root, joint, width + 5, INK); segment(joint, end, width + 5, INK);
    segment(root, joint, width, colour); segment(joint, end, width, colour);
    return joint;
  }
  function boot(foot: Point) {
    ctx.fillStyle = '#3b2a1e'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(foot.x - 12, foot.y - 6, 34, 12, [5, 7, 7, 5]); ctx.fill(); ctx.stroke();
  }
  function hand(point: Point, radius: number, colour: string) {
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = colour; ctx.fill();
  }
  // Legs, boots, back arm target decided by the mode.
  limb({ x: hip.x - 8, y: hip.y }, footL, 50, 50, -1, 22, '#2f343d');
  boot(footL);
  limb({ x: hip.x + 8, y: hip.y }, footR, 50, 50, -1, 24, TROUSERS);
  boot(footR);
  const u = s.phase - Math.floor(s.phase);
  const pose = shovelPose(u);
  let grip: Point;
  let blade: Point;
  let backHand: Point;
  let frontHand: Point;
  let showShovel = !s.shovelDropped;
  if (s.mode === 'stoking') {
    grip = pose.grip;
    blade = pose.blade;
    backHand = lerp(grip, blade, 0.12);
    frontHand = lerp(grip, blade, 0.4);
  } else if (s.mode === 'idle') {
    grip = { x: s.x + 52, y: 350 };
    blade = { x: grip.x, y: grip.y + SHOVEL_LENGTH };
    frontHand = lerp(grip, blade, 0.06);
    const wipe = clamp(s.wipe.x, 0, 1);
    backHand = lerp({ x: s.x - 22, y: hip.y - 40 }, { x: head.x + 8, y: head.y - 20 }, wipe);
  } else if (s.mode === 'sheltered') {
    grip = blade = { x: 0, y: 0 };
    backHand = { x: SHIELD.x - 12, y: SHIELD.top + 2 };
    frontHand = { x: SHIELD.x + 14, y: SHIELD.top + 2 };
    showShovel = false;
  } else {
    grip = blade = { x: 0, y: 0 };
    const up = floored || blasted ? 1 : 0.4;
    backHand = { x: hip.x - 30, y: hip.y - 40 - 60 * up };
    frontHand = { x: hip.x + 46, y: hip.y - 30 - 60 * up };
    showShovel = false;
  }
  const backShoulder = { x: shoulder.x - 10, y: shoulder.y + 6 };
  limb(backShoulder, backHand, 56, 60, 1, 15, SKIN_SHADE);
  // Keep the back hand behind the body, with its arm.
  hand(backHand, 8.5, SKIN_SHADE);
  // Torso, shirt and braces.
  segment(hip, shoulder, 58, INK);
  segment({ x: hip.x + (shoulder.x - hip.x) * 0.05, y: hip.y + (shoulder.y - hip.y) * 0.05 }, shoulder, 52, SHIRT);
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 5;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hip.x + side * 16, hip.y - 4); ctx.lineTo(shoulder.x + side * 12, shoulder.y + 8); ctx.stroke(); }
  segment({ x: hip.x - 26, y: hip.y }, { x: hip.x + 26, y: hip.y }, 9, '#241f1f');
  segment(shoulder, head, 24, INK);
  segment(shoulder, head, 19, SKIN);
  // Head: skull, soot, face, cap, goggles.
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(headRot);
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 34, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = SKIN; ctx.fill();
  const soot = clamp(s.soot, 0, 1);
  if (soot > 0.02) {
    ctx.fillStyle = `rgba(30, 28, 30, ${floored || blasted ? 0.85 : soot * 0.45})`;
    if (floored || blasted) { ctx.beginPath(); ctx.ellipse(0, 0, 27, 33, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(-12, 12, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(18, 18, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.beginPath(); ctx.ellipse(-23, 3, 7, 9, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = SKIN; ctx.fill();
  const eyes = [{ x: 5, y: -7 }, { x: 20, y: -8 }];
  const eyeOpen = Math.max(0.08, s.eyeOpen.x);
  const brow = s.brow.x;
  for (const eye of eyes) {
    ctx.beginPath(); ctx.ellipse(eye.x, eye.y, 6, 6 * Math.min(1.3, eyeOpen), 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    if (floored) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(eye.x - 3, eye.y - 3); ctx.lineTo(eye.x + 3, eye.y + 3); ctx.moveTo(eye.x + 3, eye.y - 3); ctx.lineTo(eye.x - 3, eye.y + 3); ctx.stroke();
    } else {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(eye.x + 2, eye.y + 0.5, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-3, -18 + 1.5 * brow); ctx.lineTo(13, -18 - 5 * brow); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13, -19 - 5 * brow); ctx.lineTo(29, -19 + 1.5 * brow); ctx.stroke();
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(29, 9); ctx.lineTo(22, 12); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(29, 9); ctx.lineTo(22, 12); ctx.stroke();
  const open = clamp(s.mouthOpen.x, 0, 1);
  const curve = s.mouthCurve.x;
  ctx.globalAlpha = clamp(1 - open * 3, 0, 1);
  ctx.beginPath(); ctx.moveTo(6, 19 - curve * 3); ctx.quadraticCurveTo(15, 19 + curve * 9, 24, 19 - curve * 3); ctx.stroke();
  ctx.globalAlpha = 1;
  if (open > 0.12) {
    ctx.beginPath(); ctx.ellipse(15, 21 + 2 * open, 5 + 6 * open, 2 + 9 * open, 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#3a1420'; ctx.fill();
  }
  // Sweat as the pressure climbs.
  const drops = s.mode === 'stoking' ? (s.fear > 0.8 ? 3 : s.fear > 0.55 ? 2 : s.fear > 0.3 ? 1 : 0) : 0;
  const sites = [{ x: -12, y: -14 }, { x: 30, y: -20 }, { x: -6, y: 8 }];
  for (let i = 0; i < drops; i += 1) {
    const p = (s.time / 1.1 + i * 0.37) % 1;
    const site = sites[i]!;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(site.x, site.y + 24 * p * p, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Flat cap with the goggles parked on it, or pulled down over the eyes.
  ctx.fillStyle = CAP; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-30, -18); ctx.quadraticCurveTo(-26, -46, 2, -46); ctx.quadraticCurveTo(28, -46, 30, -22); ctx.lineTo(38, -18); ctx.lineTo(-30, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4f535c';
  ctx.beginPath(); ctx.moveTo(30, -22); ctx.lineTo(44, -18); ctx.lineTo(30, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
  const gy = mix(-36, -8, clamp(s.goggles.x, 0, 1));
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-24, gy); ctx.lineTo(30, gy); ctx.stroke();
  for (const gx of [5, 20]) {
    ctx.beginPath(); ctx.arc(gx, gy, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = s.goggles.x > 0.5 ? 'rgba(20, 24, 30, 0.92)' : 'rgba(150, 200, 230, 0.55)'; ctx.fill();
    ctx.strokeStyle = '#b8862b'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
  // Shovel and the front arm over it.
  if (showShovel) drawShovel(ctx, grip, blade, pose.tip * (s.mode === 'stoking' ? 1 : 0), s.mode === 'stoking' && pose.carrying);
  const frontShoulder = { x: shoulder.x + 10, y: shoulder.y + 2 };
  const elbow = limb(frontShoulder, frontHand, 56, 60, 1, 17, SKIN);
  segment(frontShoulder, lerp(frontShoulder, elbow, 0.3), 24, INK);
  segment(frontShoulder, lerp(frontShoulder, elbow, 0.3), 20, SHIRT);
  hand(frontHand, 9.5, SKIN);
  ctx.restore();
  void toWorld;
}
