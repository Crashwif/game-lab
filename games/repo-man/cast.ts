/**
 * The people of Repo Man. Gary: cap, mustache, reflector vest over the company shirt, a barcode tattooed down his
 * forearm, a clipboard in one hand and a pen in the other; a walking rig (distance-driven feet, two-bone IK for
 * arms and legs) posed from his current act: walking out to an item, taking it, carrying it, heaving it onto the
 * pile, working the winch lever, nodding up at the window, waving at the kid, shaking hands, sitting on the
 * tailgate with his thermos, or taking the front door off its hinges. The degen: in the bedroom window behind the
 * blinds, then (after an exit) running across the lawn in his socks. The kid in the lower window and the
 * neighbour at their door. Rigs and drawing only; nothing here reads or changes the outcome.
 */
import { blob, box, ink, INK, label, limb, poly } from './ink';
import { type Joint, solveLimb, walkingFoot } from './kinematics';
import { type Act, DOOR_X, EXIT, LANE_Y, LEVER } from './repo';
import { clamp, mix, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

type P = Joint;
const SKIN = '#e0a27c';
const SKIN_SHADE = '#c98a64';
const NAVY = '#24375f';
const VEST = '#ff8a1e';
const SILVER = '#eef3ff';
const PANTS = '#6d664f';
const BOOT = '#3a2a1e';
const ease = (t: number): number => smoothstep(0, 1, t);
const lerpP = (a: P, b: P, t: number): P => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });

// ─── Gary ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface GaryInput {
  act: Act;
  time: number;
  talk: number;
  walk: number;
  /** The held item's centre and the points his hands go to on it. */
  held: { x: number; y: number; hands: [P, P] } | null;
  /** The hook on the supercar's frame (for clipping it on and taking it off). */
  hook: P;
  /** The handshake's meeting point. */
  meet: P;
  vest: number;
  /** The deck top where he sits. */
  deck: number;
  /** A look over whatever he is doing: up at the window with a nod, or across at the neighbour. */
  glance: { kind: 'nod' | 'pat' | null; age: number };
  /** Raising the thermos to the degen from the tailgate (a crash after the exit). */
  toast: number;
}

export interface GaryPose {
  x: number;
  face: 1 | -1;
  hip: P;
  chest: P;
  head: P;
  tilt: number;
  feet: [P, P];
  hands: [P, P];
  crouch: number;
  clip: 'hand' | 'tucked' | 'raised' | 'none';
  pen: number;
  thermos: number;
  phone: number;
  vest: number;
  talk: number;
  brow: number;
  eyes: P;
  blink: boolean;
  sit: number;
  hidden: number;
}

/** Gary's proportions: a big man in the foreground. */
const HIP_H = 68;
const TORSO = 50;
const UPPER = 28;
const FORE = 27;
const THIGH = 35;
const SHIN = 34;
const HEAD = 1.16;

/** Gary's whole pose from his act: a bag of world targets the drawing solves limbs toward. */
export function garyPose(g: GaryInput): GaryPose {
  const a = g.act;
  const f = a.face;
  const t = g.time;
  const k = a.kind;
  const u = a.u;
  const breath = Math.sin(t * 1.9) * 1.2;
  const moving = clamp(a.moving * 3, 0, 1);
  const stride = 50;
  const phase = (g.walk / stride) * Math.PI;
  let crouch = 0;
  let lean = 0;
  let tilt = 0;
  let sit = 0;
  let clip: GaryPose['clip'] = 'hand';
  let pen = 1;
  let thermos = 0;
  let phone = 0;
  let brow = 0;
  let eyes: P = { x: 1, y: 0.4 };
  let writing = 0;
  let back: P | null = null;
  let front: P | null = null;
  const sway = Math.sin(t * 0.7 + 1.3) * 2 * (1 - moving);
  const hipAt = (): P => ({ x: a.x + sway, y: LANE_Y - HIP_H - (moving > 0 ? Math.abs(Math.sin(phase)) * 2.5 * moving : 0) });
  let hip = hipAt();
  if (k === 'idle') {
    // Between items: a slow cycle of reading the list, looking up at the house, writing it down.
    const cyc = (t * 0.16 + 0.3) % 1;
    const up = cyc >= 0.35 && cyc < 0.6;
    writing = cyc > 0.7 && cyc < 0.9 ? 1 : 0;
    eyes = up ? { x: 0.5, y: -1 } : { x: 0.8, y: 1 };
    tilt = up ? 0.18 : -0.12;
  }
  const holdItem = (h: [P, P]): void => {
    back = h[0];
    front = h[1];
    clip = 'tucked';
    pen = 0;
  };
  if (a.phase === 'work' || (a.phase === 'finish' && (k === 'hook' || k === 'opener' || k === 'lift' || k === 'load'))) {
    switch (k) {
      case 'hook': {
        crouch = Math.sin(Math.PI * clamp(u * 1.1, 0, 1)) * 0.85;
        lean = 0.35 * crouch;
        front = lerpP({ x: a.x - 14, y: LANE_Y - 60 }, g.hook, smoothstep(0.1, 0.6, u) * (1 - smoothstep(0.85, 1, u)));
        eyes = { x: 1, y: 1 };
        tilt = -0.3 * crouch;
        break;
      }
      case 'opener': {
        clip = 'raised';
        const flip = smoothstep(0.2, 0.32, u) * (1 - smoothstep(0.32, 0.45, u));
        back = { x: hip.x + f * 26, y: hip.y - 54 };
        front = { x: hip.x + f * (24 + 12 * flip), y: hip.y - 60 - 8 * flip + (u > 0.5 && u < 0.8 ? Math.sin(t * 10) * 3 : 0) };
        eyes = { x: 1, y: 0.6 };
        brow = u > 0.5 ? 0.7 : 0;
        tilt = -0.08;
        break;
      }
      case 'lift':
      case 'load': {
        const lever = k === 'lift' ? Math.sin(Math.PI * clamp(u * 1.2, 0, 1)) : clamp(Math.sin(Math.PI * clamp(a.t / 2.6, 0, 1)) * 1.2, 0, 1);
        lean = 0.15;
        front = { x: LEVER.x - 8 * lever, y: LEVER.y };
        eyes = { x: 1, y: 0.4 };
        break;
      }
      case 'wave': {
        const up = smoothstep(0, 0.15, u) * (1 - smoothstep(0.85, 1, u));
        front = { x: hip.x + f * (24 + Math.sin(t * 9) * 9 * up), y: mix(hip.y - 30, hip.y - 118, up) };
        tilt = 0.15 * up;
        eyes = { x: 1, y: -0.8 };
        brow = 0.4 * up;
        break;
      }
      case 'note':
        writing = 1;
        eyes = { x: 0.8, y: 1 };
        tilt = -0.15;
        break;
      case 'qr': {
        crouch = 0.8 * Math.sin(Math.PI * clamp(u * 1.1, 0, 1));
        lean = 0.3 * crouch;
        phone = 1;
        front = { x: a.x + f * 34, y: LANE_Y - 50 + 12 * crouch };
        eyes = { x: 1, y: 1 };
        tilt = -0.25;
        break;
      }
      case 'vest': {
        const fold = smoothstep(0.35, 0.6, u);
        const place = smoothstep(0.6, 0.85, u);
        clip = 'tucked';
        pen = 0;
        back = lerpP({ x: hip.x - f * 16, y: hip.y - 40 }, { x: hip.x + f * 16, y: hip.y - 38 }, fold);
        front = lerpP(lerpP({ x: hip.x - f * 10, y: hip.y - 58 }, { x: hip.x + f * 22, y: hip.y - 38 }, fold), { x: 606, y: 440 }, place);
        eyes = { x: 1, y: 0.6 };
        tilt = -0.1;
        break;
      }
      case 'tv':
        if (!g.held) {
          front = { x: 394, y: 346 };
          back = { x: 380, y: 352 };
          clip = 'tucked';
          pen = 0;
          tilt = 0.14;
          eyes = { x: 1, y: -0.4 };
        }
        break;
      case 'bike':
        if (!g.held) {
          if (u < 0.3) {
            // He pauses. He writes something down.
            writing = 1;
            brow = 0.6;
            eyes = { x: 0.8, y: 1 };
            tilt = -0.12;
          } else {
            lean = 0.12;
            front = { x: 682 + Math.sin(t * 14) * 3, y: 382 };
            eyes = { x: 1, y: 0.2 };
          }
        }
        break;
      case 'numbers': {
        const which = Math.min(2, Math.floor(clamp((u - 0.1) / 0.16, 0, 2.99)));
        const postit = smoothstep(0.62, 0.72, u) * (1 - smoothstep(0.85, 0.95, u));
        front = lerpP({ x: 580 + which * 14, y: 343 }, { x: 568, y: 342 }, postit);
        back = { x: hip.x + f * 18, y: hip.y - 22 };
        clip = 'tucked';
        pen = 0;
        tilt = 0.18;
        eyes = { x: 1, y: -0.5 };
        break;
      }
      case 'porch':
        crouch = 0.65 * Math.sin(Math.PI * u);
        lean = 0.3 * crouch;
        front = { x: 486, y: 396 + 16 * crouch };
        eyes = { x: 1, y: 1 };
        tilt = -0.2;
        break;
      case 'gutter':
        if (!g.held) {
          front = { x: 330, y: 330 - 30 * u };
          back = { x: 334, y: 352 };
          clip = 'tucked';
          pen = 0;
          tilt = 0.3;
          eyes = { x: 1, y: -1 };
        }
        break;
      case 'hose':
      case 'mailbox':
      case 'fridge':
        if (!g.held) {
          front = k === 'hose' ? { x: 452, y: 392 } : k === 'mailbox' ? { x: 604, y: 440 } : { x: DOOR_X + 4, y: 380 };
          eyes = { x: 1, y: 0.6 };
        }
        break;
    }
  }
  if (a.phase === 'finish' && (k === 'porch' || k === 'load')) {
    const lever = clamp(Math.sin(Math.PI * clamp(a.t / 2.2, 0, 1)) * 1.2, 0, 1);
    front = { x: LEVER.x - 8 * lever, y: LEVER.y };
    eyes = { x: 1, y: -0.3 };
    tilt = 0.1;
  }
  if (g.held) {
    holdItem(g.held.hands);
    if (k === 'fridge') lean = 0.18;
    if (a.phase === 'finish') {
      lean = -0.12;
      tilt = 0.2;
      eyes = { x: 1, y: -1 };
    }
  } else if (a.phase === 'finish' && (k === 'hose' || k === 'tv' || k === 'bike' || k === 'fridge' || k === 'mailbox' || k === 'numbers' || k === 'gutter')) {
    // The follow-through after the toss.
    const fu = clamp((a.t - 0.25) / 0.5, 0, 1);
    back = { x: hip.x + f * (12 - 6 * fu), y: hip.y - 100 + 56 * fu };
    front = { x: hip.x + f * (18 - 8 * fu), y: hip.y - 106 + 62 * fu };
    clip = 'tucked';
    pen = 0;
    eyes = { x: 1, y: -0.6 };
    tilt = 0.15 * (1 - fu);
  }
  // The exit: turn to the house, listen, unhook, shake on it, write the referral code, sit on the tailgate.
  if (k === 'exit') {
    if (a.phase === 'turn') {
      const look = smoothstep(0.15, 0.35, u) * (1 - smoothstep(0.75, 0.95, u));
      eyes = { x: 0.6, y: -1 };
      brow = 0.9 * look;
      tilt = 0.28 * look;
    } else if (a.phase === 'listen') {
      eyes = { x: 1, y: 0.1 };
      brow = 0.3;
      tilt = Math.sin(t * 2) * 0.03;
    } else if (a.phase === 'unhook') {
      crouch = 0.55 * Math.sin(Math.PI * u);
      lean = 0.25;
      front = lerpP({ x: hip.x + f * 20, y: hip.y - 30 }, g.hook, Math.sin(Math.PI * u));
      eyes = { x: 1, y: 1 };
      tilt = -0.2;
    } else if (a.phase === 'shake') {
      const pump = Math.sin(clamp((a.t - 0.2) / 1.2, 0, 1) * Math.PI * 6) * 6 * smoothstep(0.1, 0.25, u) * (1 - smoothstep(0.85, 1, u));
      const reach = smoothstep(0, 0.15, u) * (1 - smoothstep(0.88, 1, u));
      front = lerpP({ x: hip.x + f * 20, y: hip.y - 30 }, { x: g.meet.x, y: g.meet.y + pump }, reach);
      eyes = { x: 1, y: -0.2 };
      tilt = -0.14 * Math.sin(clamp(u * 3, 0, 1) * Math.PI);
    } else if (a.phase === 'write') {
      writing = 1;
      eyes = { x: 0.8, y: 1 };
      tilt = -0.15;
    }
  }
  if (k === 'sit') {
    sit = ease(u);
    clip = 'none';
    pen = 0;
    thermos = 1;
    const sip = a.phase === 'sat' ? clamp(Math.sin(((a.t * 0.25) % 1) * Math.PI * 2) * 3 - 1.4, 0, 1) : 0;
    hip = { x: a.x, y: mix(LANE_Y - HIP_H, g.deck - 6, sit) };
    back = { x: hip.x + f * 2, y: hip.y + 4 };
    front = lerpP({ x: hip.x + f * 20, y: hip.y - 18 }, { x: hip.x + f * 20, y: hip.y - 74 }, sip);
    eyes = sip > 0.5 ? { x: 0.6, y: -0.4 } : { x: 1, y: 0.1 };
    tilt = 0.2 * sip;
    if (g.toast > 0) {
      front = lerpP(front, { x: hip.x + f * 40, y: hip.y - 62 }, g.toast);
      eyes = { x: 1, y: -0.2 };
      tilt = mix(tilt, 0.1, g.toast);
      brow = 0.5 * g.toast;
    }
  }
  if (k === 'crash') {
    if (a.phase === 'pull') {
      const yank = smoothstep(0, 0.35, u);
      lean = -0.2 * yank;
      back = { x: DOOR_X - 22 + 8 * yank, y: 352 + 20 * yank };
      front = { x: DOOR_X - 4 + 8 * yank, y: 370 + 20 * yank };
      clip = 'none';
      pen = 0;
      eyes = { x: 1, y: 0 };
    } else if (a.phase === 'still') {
      eyes = { x: 0.8, y: 1 };
      tilt = -0.12;
    }
    if (g.held) holdItem(g.held.hands);
  }
  // A glance over whatever he is doing: up at the window with a nod, across at the neighbour.
  if (g.glance.kind && g.glance.age < 2.2) {
    const e = smoothstep(0, 0.25, g.glance.age) * (1 - smoothstep(1.8, 2.2, g.glance.age));
    if (g.glance.kind === 'nod') {
      const nod = Math.max(0, Math.sin(clamp((g.glance.age - 0.5) / 0.9, 0, 1) * Math.PI * 2)) * 0.22;
      tilt = mix(tilt, 0.34 - nod, e);
      eyes = { x: 0.4, y: -1 };
    } else {
      tilt = mix(tilt, 0.12, e);
      eyes = { x: 1, y: -0.4 };
    }
  }
  if ((k === 'arrive' || k === 'crash') && a.hidden > 0) hip.y += a.hidden * 80;
  hip.y += crouch * 20;
  const chest: P = { x: hip.x + f * (2 + lean * 30), y: hip.y - TORSO + crouch * 6 + breath * 0.4 };
  if (k === 'sit') chest.x = hip.x - f * 2;
  // The clipboard at the chest, the pen at it; walking, the board goes under the arm and the pen hand swings.
  const swing = Math.sin(phase) * moving;
  if (!back) back = moving > 0.3 && clip === 'hand' ? { x: hip.x + f * 2, y: hip.y - 8 } : { x: chest.x + f * 17, y: chest.y + 22 };
  if (!front) {
    const w = writing * Math.sin(t * 13) * 2.5;
    front = moving > 0.3 ? { x: hip.x + f * (8 + 14 * swing), y: hip.y + 2 - 4 * Math.abs(swing) } : { x: chest.x + f * (24 + w), y: chest.y + 18 + writing * Math.cos(t * 9) * 1.5 };
  }
  if (moving > 0.3 && clip === 'hand') clip = 'tucked';
  // Feet: planted, walking, crouched or dangling off the tailgate.
  const footA = walkingFoot(g.walk, stride, 0, 10);
  const footB = walkingFoot(g.walk, stride, 0.5, 10);
  let feet: [P, P] = [
    { x: hip.x + f * mix(-7, footA.x, moving), y: LANE_Y + mix(0, footA.y, moving) },
    { x: hip.x + f * mix(9, footB.x, moving), y: LANE_Y + mix(0, footB.y, moving) },
  ];
  if (sit > 0) feet = [lerpP(feet[0], { x: hip.x + f * 32, y: hip.y + 44 + Math.sin(t * 1.3) * 2 }, sit), lerpP(feet[1], { x: hip.x + f * 40, y: hip.y + 42 + Math.sin(t * 1.3 + 1) * 2 }, sit)];
  const head = { x: chest.x + f * (3 + 10 * lean), y: chest.y - 26 };
  const blinkOn = noise(Math.floor(t * 0.9) * 7.3) > 0.82 && (t * 0.9) % 1 < 0.12;
  return { x: a.x, face: f, hip, chest, head, tilt, feet, hands: [back, front], crouch, clip, pen, thermos, phone, vest: g.vest, talk: g.talk, brow, eyes, blink: blinkOn, sit, hidden: a.hidden };
}

/**
 * Gary's secondary motion: his hands (relative to his hip, so a carried item never lags), his head's tilt and his
 * crouch chase the pose on springs with different rates, so a change of act eases instead of popping and the head
 * trails the body.
 */
export interface GaryRig { back: P; front: P; bv: P; fv: P; tilt: Spring; crouch: Spring; seeded: boolean }
export const createGaryRig = (): GaryRig => ({ back: { x: 0, y: 0 }, front: { x: 0, y: 0 }, bv: { x: 0, y: 0 }, fv: { x: 0, y: 0 }, tilt: spring(0), crouch: spring(0), seeded: false });
export function smoothGary(rig: GaryRig, p: GaryPose, dt: number, settle: boolean, exact: boolean): void {
  const rel = (h: P): P => ({ x: h.x - p.hip.x, y: h.y - p.hip.y });
  const tb = rel(p.hands[0]);
  const tf = rel(p.hands[1]);
  if (settle || !rig.seeded) {
    rig.back = tb;
    rig.front = tf;
    rig.bv = { x: 0, y: 0 };
    rig.fv = { x: 0, y: 0 };
    settleSpring(rig.tilt, p.tilt);
    rig.seeded = true;
  } else {
    // A critically damped chase for the hands (18 rad/s), a looser spring for the head (11 rad/s, a little overshoot).
    const chase = (pos: P, vel: P, target: P): void => {
      const sx = { x: pos.x, v: vel.x };
      const sy = { x: pos.y, v: vel.y };
      stepSpring(sx, target.x, 18, 0.9, dt);
      stepSpring(sy, target.y, 18, 0.9, dt);
      pos.x = sx.x;
      pos.y = sy.x;
      vel.x = sx.v;
      vel.y = sy.v;
    };
    chase(rig.back, rig.bv, tb);
    chase(rig.front, rig.fv, tf);
    stepSpring(rig.tilt, p.tilt, 11, 0.55, dt);
  }
  if (!exact) {
    p.hands = [{ x: p.hip.x + rig.back.x, y: p.hip.y + rig.back.y }, { x: p.hip.x + rig.front.x, y: p.hip.y + rig.front.y }];
  }
  p.tilt = rig.tilt.x;
}

function drawLegs(ctx: CanvasRenderingContext2D, hip: P, feet: [P, P], f: number, colour: string, shade: string, shoe: string, socks = false, thigh = THIGH, shin = SHIN, thick = 15): void {
  for (let i = 0; i < 2; i += 1) {
    const root = { x: hip.x + f * (i === 0 ? -5 : 6), y: hip.y };
    const foot = feet[i]!;
    const leg = solveLimb(root, { x: foot.x, y: foot.y - 4 }, thigh, shin, -f);
    limb(ctx, [root, leg.joint, leg.end], thick, i === 0 ? shade : colour);
    if (socks) {
      box(ctx, leg.end.x - (f < 0 ? 12 : 4), leg.end.y - 4, 16, 8, 4, '#f2f2ee', 2);
      ctx.fillStyle = '#d23a4a';
      ctx.fillRect(leg.end.x - 2, leg.end.y - 4, 2, 7);
      ctx.fillStyle = '#3a5ad2';
      ctx.fillRect(leg.end.x + 1, leg.end.y - 4, 2, 7);
    } else {
      box(ctx, leg.end.x - (f < 0 ? 15 : 4), leg.end.y - 6, 20, 10, 4, shoe, 2.5);
    }
  }
}

function drawArm(ctx: CanvasRenderingContext2D, shoulder: P, hand: P, f: number, sleeve: string, skin: string, near: boolean, tattoo: boolean): P {
  const arm = solveLimb(shoulder, hand, UPPER, FORE, f);
  const mid = lerpP(shoulder, arm.joint, 0.6);
  limb(ctx, [arm.joint, arm.end], 10, skin);
  if (tattoo) {
    // The barcode down the forearm.
    const dx = arm.end.x - arm.joint.x;
    const dy = arm.end.y - arm.joint.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    ctx.strokeStyle = '#1d2230';
    for (let i = 0; i < 9; i += 1) {
      const s = 0.2 + i * 0.065;
      const px = arm.joint.x + dx * s;
      const py = arm.joint.y + dy * s;
      ctx.lineWidth = noise(i * 3.3) > 0.5 ? 1.8 : 0.9;
      ctx.beginPath();
      ctx.moveTo(px - nx * 3.6, py - ny * 3.6);
      ctx.lineTo(px + nx * 3.6, py + ny * 3.6);
      ctx.stroke();
    }
  }
  limb(ctx, [shoulder, mid], 15, sleeve);
  if (!near) limb(ctx, [mid, arm.joint], 10, skin, 0);
  blob(ctx, arm.end.x, arm.end.y, 5.5, 5.5, skin, 2);
  return arm.end;
}

function drawClipboard(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, f: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  box(ctx, -11, -15, 22, 30, 2, '#a0703e', 2);
  ctx.fillStyle = '#f7f4ea';
  ctx.fillRect(-8.5, -11, 17, 23);
  ctx.strokeStyle = 'rgba(40,60,120,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-6, -6 + i * 4);
    ctx.lineTo(5, -6 + i * 4);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d0202c';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-6, -6 + i * 4);
    ctx.lineTo(-4.5, -4.5 + i * 4);
    ctx.lineTo(-2, -8 + i * 4);
    ctx.stroke();
  }
  box(ctx, -5, -17, 10, 5, 1.5, '#c8ccd6', 1.5);
  ctx.restore();
  void f;
}

function drawGaryHead(ctx: CanvasRenderingContext2D, p: GaryPose, time: number): void {
  const f = p.face;
  ctx.save();
  ctx.translate(p.head.x, p.head.y + 16);
  ctx.rotate(-p.tilt * f);
  ctx.translate(0, -16);
  ctx.scale(f * HEAD, HEAD);
  // Neck, ear, head.
  ctx.fillStyle = SKIN_SHADE;
  ctx.fillRect(-7, 6, 14, 12);
  blob(ctx, -12, 0, 5, 7, SKIN, 2);
  blob(ctx, 0, 0, 18, 20, SKIN, 2.5);
  // Stubble on the jaw, grey sideburn.
  ctx.fillStyle = 'rgba(70, 50, 50, 0.22)';
  ctx.beginPath();
  ctx.ellipse(4, 9, 15, 10, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#9a948c';
  ctx.fillRect(-15, -8, 5, 10);
  // Eyes: heavy-lidded, steady, a man who has seen this before.
  const ex = clamp(p.eyes.x, -1, 1) * 1.2;
  const ey = clamp(p.eyes.y, -1, 1) * 1.1;
  for (const [cx, rx] of [[5, 4], [14, 3.2]] as const) {
    if (p.blink) {
      ink(ctx, 1.8);
      ctx.beginPath();
      ctx.moveTo(cx - rx, -3);
      ctx.lineTo(cx + rx, -3);
      ctx.stroke();
      continue;
    }
    blob(ctx, cx, -3, rx, 3.2, '#ffffff', 1.5);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx + ex, -3 + ey, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // The lid.
    ctx.fillStyle = SKIN_SHADE;
    ctx.beginPath();
    ctx.ellipse(cx, -4.6 - p.brow * 1.2, rx + 0.6, 2.2, 0, Math.PI, 0);
    ctx.fill();
  }
  // Brows: bushy, level.
  ctx.strokeStyle = '#4c3c32';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(1, -10 - p.brow * 3);
  ctx.lineTo(9, -10.5 - p.brow * 3.5);
  ctx.moveTo(12, -11 - p.brow * 3.5);
  ctx.lineTo(18, -10 - p.brow * 3);
  ctx.stroke();
  // Nose, mustache, mouth.
  blob(ctx, 17, 2, 6, 5.5, SKIN_SHADE, 2);
  const open = clamp(p.talk, 0, 1) * (0.4 + 0.6 * Math.abs(Math.sin(time * 15)));
  ctx.fillStyle = '#5a1f22';
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.ellipse(11, 12.5 + open * 1.5, 4.5, 1 + 3 * open, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6b5442';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(2, 9);
  ctx.quadraticCurveTo(8, 4, 15, 6);
  ctx.quadraticCurveTo(22, 4, 24, 10);
  ctx.quadraticCurveTo(20, 12, 15, 10);
  ctx.quadraticCurveTo(8, 13, 2, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The cap: navy crown, brim forward, an orange G.
  ctx.fillStyle = NAVY;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.quadraticCurveTo(-20, -27, 0, -28);
  ctx.quadraticCurveTo(19, -27, 19, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  poly(ctx, [12, -9, 32, -7, 30, -3, 12, -4], '#1a2846', 2.2);
  ctx.fillStyle = '#e8ecf4';
  ctx.fillRect(-19, -10, 6, 4);
  blob(ctx, 7, -18, 5.5, 5.5, VEST, 1.5);
  ctx.restore();
  ctx.save();
  ctx.translate(p.head.x, p.head.y + 16);
  ctx.rotate(-p.tilt * f);
  ctx.translate(0, -16);
  ctx.scale(HEAD, HEAD);
  label(ctx, 'G', f * 7, -18, 7, '#1a2846', 900);
  ctx.restore();
}

function drawGaryTorso(ctx: CanvasRenderingContext2D, p: GaryPose): void {
  const f = p.face;
  const h = p.hip;
  const c = p.chest;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.scale(f * 1.14, 1);
  const cx = (c.x - h.x) * f / 1.14;
  const cy = c.y - h.y;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(-14, 2);
    ctx.lineTo(-17 + cx * 0.4, cy * 0.5);
    ctx.lineTo(-15 + cx, cy);
    ctx.quadraticCurveTo(cx, cy - 4, 14 + cx, cy - 1);
    ctx.quadraticCurveTo(24 + cx * 0.6, cy * 0.55, 23 + cx * 0.2, cy * 0.22);
    ctx.quadraticCurveTo(20, 2, 13, 2);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = NAVY;
  ctx.fill();
  if (p.vest > 0.02) {
    ctx.save();
    path();
    ctx.clip();
    ctx.globalAlpha = clamp(p.vest, 0, 1);
    ctx.fillStyle = VEST;
    ctx.fillRect(-30, cy - 10, 30 + 10 + cx * 0.7, 60);
    ctx.fillStyle = SILVER;
    ctx.fillRect(-30, cy * 0.66, 70, 4);
    ctx.fillRect(-30, cy * 0.3, 70, 4);
    ctx.fillRect(-6 + cx * 0.6, cy - 6, 4, -cy * 0.4);
    ctx.restore();
  } else {
    label(ctx, 'GARY’S', 8 + cx * 0.5, cy * 0.6, 6, '#f2e6c8', 900);
  }
  path();
  ink(ctx, 2.5);
  ctx.stroke();
  // Belt and buckle.
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(-14, -3, 30, 5);
  ctx.fillStyle = '#c9a040';
  ctx.fillRect(10, -3, 5, 5);
  ctx.restore();
}

function drawThermos(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  box(ctx, x - 4, y - 8, 9, 11, 2, '#c8ced8', 2);
  ctx.fillStyle = 'rgba(240, 240, 255, 0.4)';
  ctx.fillRect(x - 2, y - 7, 2, 9);
  // Steam off the cup.
  ctx.strokeStyle = 'rgba(230, 235, 245, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.quadraticCurveTo(x + 3, y - 15, x, y - 20);
  ctx.stroke();
}

/** Gary, full figure. `held` draws whatever he carries between his body and his near arm. */
export function drawGary(ctx: CanvasRenderingContext2D, p: GaryPose, time: number, held?: () => void): void {
  if (p.hidden >= 0.99) return;
  const f = p.face;
  const shoulder = (side: number): P => ({ x: p.chest.x - f * side * 10, y: p.chest.y + 4 });
  // The far arm, the legs, the torso, the head, the carried thing, the near arm.
  const backHand = drawArm(ctx, shoulder(1), p.hands[0], f, '#1b2a4a', SKIN_SHADE, false, false);
  if (p.clip === 'hand') drawClipboard(ctx, backHand.x + f * 6, backHand.y - 4, f * 0.25, f);
  drawLegs(ctx, p.hip, p.feet, f, PANTS, '#5a5442', BOOT);
  drawGaryTorso(ctx, p);
  if (p.clip === 'tucked') drawClipboard(ctx, p.hip.x - f * 14, p.hip.y - 22, f * 0.5, f);
  drawGaryHead(ctx, p, time);
  // Raised to read the small print, the board is in front of him.
  if (p.clip === 'raised') drawClipboard(ctx, backHand.x + f * 4, backHand.y - 6, f * -0.12, f);
  held?.();
  const hand = drawArm(ctx, shoulder(-1), p.hands[1], f, NAVY, SKIN, true, true);
  if (p.pen > 0 && p.clip !== 'tucked' && p.clip !== 'none') limb(ctx, [{ x: hand.x, y: hand.y }, { x: hand.x - f * 4, y: hand.y + 8 }], 2.4, '#1d4ad8', 1);
  if (p.thermos > 0) drawThermos(ctx, hand.x, hand.y);
  if (p.phone > 0) {
    box(ctx, hand.x - 4, hand.y - 12, 9, 14, 2, '#15171e', 1.5);
    ctx.fillStyle = 'rgba(140, 200, 255, 0.9)';
    ctx.fillRect(hand.x - 2.5, hand.y - 10, 6, 10);
  }
}

/** Gary in the cab: reading by dome light at betting, driving away with the door at the crash. */
export function drawGaryInCab(ctx: CanvasRenderingContext2D, x: number, y: number, face: 1 | -1, reading: boolean, talk: number, time: number): void {
  const p: GaryPose = {
    x, face, hip: { x, y: y + 44 }, chest: { x, y }, head: { x: x + face * 2, y: y - 22 }, tilt: reading ? -0.22 + Math.sin(time * 0.8) * 0.05 : 0, feet: [{ x, y: y + 90 }, { x, y: y + 90 }],
    hands: [{ x: x + face * 14, y: y + 22 }, { x: x + face * 18, y: y + 18 }], crouch: 0, clip: reading ? 'raised' : 'none', pen: 0, thermos: 0, phone: 0, vest: 1, talk,
    brow: 0, eyes: reading ? { x: 0.8, y: 1 } : { x: 1, y: 0 }, blink: false, sit: 0, hidden: 0,
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.78, 0.78);
  ctx.translate(-x, -y);
  drawGaryTorso(ctx, p);
  drawGaryHead(ctx, p, time);
  if (reading) {
    // The contract, lifted into the dome light; a page turning now and then.
    const flip = ((time * 0.33) % 1) < 0.12;
    drawClipboard(ctx, x + face * 20, y + 4 - (flip ? 3 : 0), face * -0.2, face);
    blob(ctx, x + face * 14, y + 14, 4.5, 4.5, SKIN, 2);
  } else {
    // Both hands on the wheel.
    blob(ctx, x + face * 26, y + 12, 9, 9, 'rgba(0,0,0,0)', 3);
    blob(ctx, x + face * 22, y + 8, 4.5, 4.5, SKIN, 2);
  }
  ctx.restore();
}

// ─── The degen ──────────────────────────────────────────────────────────────────────────────────────────────

const HOODIE = '#5b3f9a';
const HOODIE_SHADE = '#47307c';
const DEGEN_SKIN = '#e6cdb0';

export interface WindowDegen {
  /** At the window (1) or gone downstairs after the exit (0). */
  present: number;
  /** Leaning in as tension rises. */
  lean: number;
  /** Turned to the laptop at the crash; slumped after. */
  turned: boolean;
  slump: number;
  /** Arms up at the SOLD flash. */
  sold: number;
  /** He looks down at Gary; when Gary nods up, he blinks. */
  look: P;
  time: number;
}

function degenFace(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: P, mouth: number, time: number, shade: string, rim: string | null): void {
  // A mop of hair he has not seen to in days, ears, the face, a fringe.
  const hair = '#3a2618';
  blob(ctx, x, y - r * 0.32, r * 1.06, r * 0.86, hair, 2);
  for (const [dx, dy, w] of [[-0.62, -0.9, 0.34], [-0.1, -1.18, 0.3], [0.5, -1.0, 0.32]] as const) {
    poly(ctx, [x + (dx - w) * r, y + (dy + 0.38) * r, x + dx * r, y + dy * r, x + (dx + w) * r, y + (dy + 0.42) * r], hair, 2);
  }
  for (const s of [-1, 1]) blob(ctx, x + s * r * 0.92, y + r * 0.08, r * 0.18, r * 0.27, shade, 1.5);
  blob(ctx, x, y + r * 0.06, r * 0.88, r * 0.94, shade, 2);
  ctx.fillStyle = hair;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, y - r * 0.05);
  ctx.quadraticCurveTo(x - r * 0.75, y - r * 0.85, x, y - r * 0.82);
  ctx.quadraticCurveTo(x + r * 0.8, y - r * 0.85, x + r * 0.9, y - r * 0.1);
  ctx.quadraticCurveTo(x + r * 0.5, y - r * 0.55, x + r * 0.05, y - r * 0.42);
  ctx.quadraticCurveTo(x - r * 0.45, y - r * 0.6, x - r * 0.9, y - r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 1.12, -Math.PI * 0.95, -Math.PI * 0.05);
    ctx.stroke();
  }
  // A small nose.
  ctx.strokeStyle = 'rgba(80, 50, 40, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.02, y + r * 0.05);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.25, x - r * 0.04, y + r * 0.3);
  ctx.stroke();
  // Stubble, bags, wide eyes looking down at the driveway.
  ctx.fillStyle = 'rgba(80, 60, 60, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.45, r * 0.75, r * 0.45, 0, 0, Math.PI);
  ctx.fill();
  const blink = noise(Math.floor(time * 1.1) * 5.1) > 0.85 && (time * 1.1) % 1 < 0.1;
  for (const s of [-1, 1]) {
    const ex = x + s * r * 0.38;
    const ey = y - r * 0.1;
    ctx.fillStyle = 'rgba(90, 70, 110, 0.45)';
    ctx.beginPath();
    ctx.ellipse(ex, ey + r * 0.28, r * 0.28, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ink(ctx, 1.5);
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.25, ey);
      ctx.lineTo(ex + r * 0.25, ey);
      ctx.stroke();
      continue;
    }
    blob(ctx, ex, ey, r * 0.27, r * 0.24, '#ffffff', 1.5);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + look.x * r * 0.1, ey + look.y * r * 0.1, Math.max(1, r * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
  // Worried brows.
  ink(ctx, 2);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.15, y - r * 0.42);
    ctx.lineTo(x + s * r * 0.6, y - r * 0.32);
    ctx.stroke();
  }
  // Mouth.
  ctx.fillStyle = '#4a1a22';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.5, r * (0.18 + 0.1 * mouth), r * (0.05 + 0.25 * mouth), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** The degen behind the blinds, rim-lit by the laptop on the bed behind him. */
export function drawDegenWindow(ctx: CanvasRenderingContext2D, d: WindowDegen, x: number, y: number, h: number, col: [number, number, number], lit: number): void {
  if (d.present <= 0.02) return;
  const rim = `rgba(${col[0] | 0}, ${col[1] | 0}, ${col[2] | 0}, ${0.5 + 0.5 * lit})`;
  ctx.save();
  ctx.globalAlpha *= clamp(d.present, 0, 1);
  const cx = x + 66 + (1 - d.present) * 60;
  const r = 15 * (1 + 0.16 * d.lean);
  const headY = y + 37 + d.slump * 10 + Math.sin(d.time * 1.7) * 0.8;
  // Shoulders in the hoodie.
  ctx.fillStyle = HOODIE_SHADE;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(cx - 34, y + h + 2);
  ctx.quadraticCurveTo(cx - 30, headY + r + 4, cx, headY + r + 2);
  ctx.quadraticCurveTo(cx + 30, headY + r + 4, cx + 34, y + h + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (d.turned) {
    // Turned to the laptop: the back of his head, his face in profile to the screen.
    blob(ctx, cx, headY, r * 0.92, r, '#3a2618', 2);
    blob(ctx, cx + r * 0.55, headY + 2, r * 0.45, r * 0.7, DEGEN_SKIN, 1.5);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, headY, r + 1, -Math.PI * 0.6, Math.PI * 0.4);
    ctx.stroke();
  } else degenFace(ctx, cx, headY, r, d.look, 0.2 + 0.4 * d.lean + d.sold, d.time, DEGEN_SKIN, rim);
  if (d.sold > 0.05) {
    for (const s of [-1, 1]) limb(ctx, [{ x: cx + s * 20, y: y + h }, { x: cx + s * 30, y: headY - 6 * d.sold }, { x: cx + s * 26, y: headY - 26 * d.sold }], 8, HOODIE);
  }
  ctx.restore();
}

/** The degen outside after the exit: hoodie, sweatpants, socks, no shoes, 4 am. */
export function drawDegenOut(ctx: CanvasRenderingContext2D, o: { x: number; y: number; face: 1 | -1; run: number; walk: number; mode: string; t: number; scale: number }, meet: P, talk: number, time: number): void {
  const f = o.face;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.scale, o.scale);
  ctx.translate(-o.x, -o.y);
  const run = o.run;
  const bob = run > 0 ? Math.abs(Math.sin((o.walk / 64) * Math.PI)) * 4 : Math.sin(time * 2.2) * 0.8;
  const hip = { x: o.x, y: o.y - 56 - bob };
  const chest = { x: hip.x + f * (2 + 8 * run), y: hip.y - 40 };
  const footA = walkingFoot(o.walk, 64, 0, 15);
  const footB = walkingFoot(o.walk, 64, 0.5, 15);
  const feet: [P, P] = [
    { x: hip.x + f * mix(-5, footA.x, run), y: o.y + mix(0, footA.y, run) },
    { x: hip.x + f * mix(7, footB.x, run), y: o.y + mix(0, footB.y, run) },
  ];
  // Arms: flagging Gary down on the run, in the hoodie pocket after, out for the handshake.
  const sh = (side: number): P => ({ x: chest.x - f * side * 8, y: chest.y + 3 });
  let back: P;
  let front: P;
  if (o.mode === 'run' || o.mode === 'door') {
    const wave = Math.sin(time * 14);
    back = { x: chest.x - f * 12 + wave * 6, y: chest.y - 34 };
    front = { x: chest.x + f * 16 - wave * 6, y: chest.y - 38 };
  } else if (o.mode === 'shake') {
    back = { x: chest.x + f * 8, y: hip.y - 6 };
    const u = clamp((o.t - EXIT.shake) / (EXIT.shakeEnd - EXIT.shake), 0, 1);
    const pump = Math.sin(clamp((o.t - EXIT.shake - 0.2) / 1.2, 0, 1) * Math.PI * 6) * 6 * smoothstep(0.1, 0.25, u) * (1 - smoothstep(0.85, 1, u));
    front = lerpP({ x: chest.x + f * 12, y: hip.y - 8 }, { x: meet.x, y: meet.y + pump }, smoothstep(0, 0.15, u) * (1 - smoothstep(0.88, 1, u)));
  } else {
    // Hands in the hoodie pocket, shifting from sock to sock; a scratch of the head now and then.
    const scratch = ((time * 0.13 + 0.4) % 1) < 0.12;
    back = { x: chest.x + f * 8, y: hip.y - 8 };
    front = scratch ? { x: chest.x + f * 4, y: chest.y - 34 + Math.sin(time * 20) * 2 } : { x: chest.x + f * 12, y: hip.y - 6 };
  }
  const arm = (s: P, hnd: P, colour: string): void => {
    const a = solveLimb(s, hnd, 24, 23, f);
    limb(ctx, [s, a.joint, a.end], 10, colour);
    blob(ctx, a.end.x, a.end.y, 4.5, 4.5, DEGEN_SKIN, 2);
  };
  arm(sh(1), back, HOODIE_SHADE);
  drawLegs(ctx, hip, feet, f, '#7d7f8c', '#6a6c78', '#f2f2ee', true, 30, 29, 12);
  // Hoodie torso with its pocket.
  ctx.fillStyle = HOODIE;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(hip.x - 14, hip.y + 4);
  ctx.lineTo(chest.x - 15, chest.y);
  ctx.quadraticCurveTo(chest.x, chest.y - 5, chest.x + 15, chest.y);
  ctx.lineTo(hip.x + 15, hip.y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(hip.x - 9, hip.y - 14, 18, 10);
  // Hood strings.
  ctx.strokeStyle = '#e8e2f2';
  ctx.beginPath();
  ctx.moveTo(chest.x - 3, chest.y + 2);
  ctx.lineTo(chest.x - 4, chest.y + 12);
  ctx.moveTo(chest.x + 3, chest.y + 2);
  ctx.lineTo(chest.x + 4, chest.y + 12);
  ctx.stroke();
  const mouth = run > 0 ? 0.7 + 0.3 * Math.sin(time * 12) : clamp(talk, 0, 1) * (0.4 + 0.6 * Math.abs(Math.sin(time * 15)));
  degenFace(ctx, chest.x + f * 2, chest.y - 19, 15, { x: f, y: -0.2 }, mouth, time, DEGEN_SKIN, null);
  arm(sh(-1), front, HOODIE);
  ctx.restore();
}

// ─── The kid and the neighbour ─────────────────────────────────────────────────────────────────────────────

/** The kid at the lower window, lit from behind, waving back at Gary. Never part of the joke. */
export function drawKid(ctx: CanvasRenderingContext2D, x: number, base: number, on: number, wave: number, time: number): void {
  const k = smoothstep(0.3, 0.8, on);
  ctx.save();
  ctx.globalAlpha *= k;
  const col = '#5a3a52';
  // Pajamas, a plush bunny under one arm.
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, base - 4, 11, 14, 0, Math.PI, 0);
  ctx.fill();
  blob(ctx, x, base - 26, 8, 8.5, '#6a4a5e', 0);
  ctx.fillStyle = '#7a5a6e';
  ctx.beginPath();
  ctx.arc(x, base - 30, 8.5, Math.PI, 0);
  ctx.fill();
  blob(ctx, x - 12, base - 8, 5, 6, '#e8e0f0', 1);
  blob(ctx, x - 14, base - 17, 1.6, 4.5, '#e8e0f0', 1);
  blob(ctx, x - 10, base - 17, 1.6, 4.5, '#e8e0f0', 1);
  if (wave > 0.05) {
    const a = Math.sin(time * 10) * 0.5;
    limb(ctx, [{ x: x + 7, y: base - 14 }, { x: x + 14, y: base - 24 }, { x: x + 14 + Math.sin(a) * 5, y: base - 34 }], 4, col, 0);
  }
  ctx.restore();
}

/** The neighbour in a robe, mug in hand, at their door: it’s just Gary. */
export function drawNeighbour(ctx: CanvasRenderingContext2D, x: number, base: number, k: number, time: number): void {
  ctx.save();
  ctx.globalAlpha *= clamp(k, 0, 1);
  ctx.fillStyle = '#3d324a';
  ctx.beginPath();
  ctx.moveTo(x - 9, base);
  ctx.lineTo(x - 7, base - 34);
  ctx.quadraticCurveTo(x, base - 40, x + 7, base - 34);
  ctx.lineTo(x + 9, base);
  ctx.closePath();
  ctx.fill();
  blob(ctx, x, base - 44, 7, 8, '#d6b494', 1.5);
  ctx.fillStyle = '#8a8aa0';
  for (let i = 0; i < 3; i += 1) blob(ctx, x - 5 + i * 5, base - 52, 2.6, 2.2, '#e8a0b8', 1);
  blob(ctx, x + 9, base - 28 + Math.sin(time) * 0.5, 3, 3.5, '#f0f0f0', 1);
  ctx.restore();
}

