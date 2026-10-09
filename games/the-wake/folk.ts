/**
 * The people (and the dog) of The Wake. The Crypto Celebrant at the lectern, facing us, whose hands rise off
 * the ledger as the round climbs (two-bone arms solved toward hand targets); the front row seen from behind:
 * the widow gripping Gerald's folded lawn chair, her veil trembling on a spring, her mother with a page torn
 * from the guest book, the son running a chart overlay on his phone; the back row and the best friend, who
 * sold at 1.4× and is on his phone; the mourners who glance at phones under their jackets in a seeded order;
 * the dog by the casket; the florist with her stop-loss; and the cousin (the player) by the side door, who on
 * an accepted exit puts shades on, takes two sandwiches and the candle and leaves. At the crash the widow
 * stands, carries the chair to the foot of the casket, unfolds it and sits facing the room. Rigs and drawing
 * only: everything is keyed to the displayed multiplier, the round clock, the exit clock and the crash clock.
 */
import { solveLimb } from './kinematics';
import { blob, box, ink, INK, label, limb, MEME_FONT, poly } from './ink';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';
import { CANDLE, CRASH_AT, DOOR, flame, glow, LECTERN, PLATTER, stamp } from './parlor';

type Pt = { x: number; y: number };
const SKIN = '#efd0b4';
const SKINS = ['#efd0b4', '#d9a77f', '#b97f57', '#f3d9c4', '#8d5a3c'];

// ─── Where everyone is ──────────────────────────────────────────────────────────────────────────────────
export const FRONT = { floor: 470, s: 0.8 } as const;
export const BACK = { floor: 604, s: 1 } as const;
const SEATS = { mother: 262, widow: 352, son: 606, friend: 624 } as const;
export const CELEBRANT = { x: LECTERN.x, y: LECTERN.top, s: 1.15 } as const;
export const DOG = { x: 452, y: 398 } as const;
export const FLORIST = { x: 916, floor: 660, s: 1.04 } as const;
export const COUSIN = { x: 206, floor: 690, s: 1.12 } as const;
/** Where the widow sets the lawn chair down: the foot of the casket. */
const FOOT = { x: 540, floor: 410, s: 0.78 } as const;

/** Exit choreography (seconds of the exit clock). */
export const EXIT_AT = { shades: [0, 0.5], turn: [0.5, 0.75], walk: [0.75, 1.9], grab: [2.05, 2.35, 2.65], back: [2.85, 3.0], door: [3.0, 4.55], fade: [4.4, 4.7], open: [3.75, 5.1] } as const;
/** Crash choreography for the widow and the dog (seconds of the crash clock). */
export const WIDOW_AT = { stand: [1.25, 1.55], walk: [1.55, 2.25], turn: [2.25, 2.4], unfold: [2.4, 2.7], sit: [2.7, 2.95] } as const;
const DOG_TILT = [4.4, 4.75] as const;
/** After this much crash clock, the final image holds. */
export const HOLD_AT = 4.8;

// ─── State ──────────────────────────────────────────────────────────────────────────────────────────────
export interface CastDrive {
  time: number;
  amb: number;
  tension: number;
  multiplier: number;
  /** Running and not crashed. */
  live: boolean;
  /** Seconds of crash clock, or -1. */
  ct: number;
  /** Seconds since the accepted exit, or -1 (large when met late). */
  exitAge: number;
  /** How hard each speaker is talking right now (0..1). */
  talk: (who: string) => number;
}

interface Mourner {
  x: number;
  floor: number;
  s: number;
  coat: string;
  hair: string;
  style: Style;
  skin: string;
  side: number;
  /** The multiplier from which this one starts checking a phone. */
  from: number;
  back: boolean;
  phase: number;
  glance: Spring;
  turn: Spring;
  seed: number;
}

type Style = 'bald' | 'bun' | 'curly' | 'short' | 'slick' | 'hood' | 'grey';

export interface Cast {
  // The celebrant: hands off the book, leaning in, brows, a gesture phase and the blink.
  rise: Spring;
  lean: Spring;
  brow: Spring;
  gest: number;
  blinkIn: number;
  blink: number;
  // The widow: grip on the chair, the veil's spring, shoulders.
  grip: Spring;
  veil: Spring;
  shrug: Spring;
  // The mother: her head turned to the widow, the dab.
  momTurn: Spring;
  dab: Spring;
  dabClock: number;
  // The son and the best friend.
  sonTurn: Spring;
  ear: Spring;
  callT: number;
  mourners: Mourner[];
  // The dog: where he is looking and his ears.
  look: Spring;
  lookClock: number;
  earA: Spring;
  earB: Spring;
  twitchIn: number;
  // The florist typing; the cousin's hunch and glances.
  typing: Spring;
  hunch: Spring;
  peek: Spring;
  peekIn: number;
  peekTo: number;
  events: { glance: number; veil: boolean };
}

function mourners(): Mourner[] {
  const r = mulberry32(0x9a11);
  // Nobody checks before 1.5×; by 5× the whole back row glows. The order is seeded.
  const slots = [1.55, 2.25, 3.05, 4.1];
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [slots[i], slots[j]] = [slots[j]!, slots[i]!];
  }
  const base = [
    { x: 696, floor: FRONT.floor, s: FRONT.s, coat: '#2a2d3a', hair: '#cfcac4', style: 'bald' as Style, skin: SKINS[0]!, side: 1, back: false },
    { x: 786, floor: FRONT.floor, s: FRONT.s, coat: '#3a2a30', hair: '#8a6a4a', style: 'bun' as Style, skin: SKINS[2]!, side: -1, back: false },
    { x: 338, floor: BACK.floor, s: BACK.s, coat: '#25262e', hair: '#1d1418', style: 'curly' as Style, skin: SKINS[4]!, side: 1, back: true },
    { x: 738, floor: BACK.floor, s: BACK.s, coat: '#2f2a26', hair: '#b5652d', style: 'short' as Style, skin: SKINS[3]!, side: -1, back: true },
  ];
  return base.map((b, i) => ({ ...b, from: slots[i]!, phase: r(), glance: spring(0), turn: spring(0), seed: i * 13 + 5 }));
}

export function createCast(): Cast {
  return {
    rise: spring(0), lean: spring(0), brow: spring(0), gest: 0, blinkIn: 2, blink: 0,
    grip: spring(0), veil: spring(0), shrug: spring(0),
    momTurn: spring(0), dab: spring(0), dabClock: 0,
    sonTurn: spring(0), ear: spring(0), callT: 9,
    mourners: mourners(),
    look: spring(0), lookClock: 0, earA: spring(0), earB: spring(0), twitchIn: 1.5,
    typing: spring(0), hunch: spring(0), peek: spring(0), peekIn: 3, peekTo: 0,
    events: { glance: 0, veil: false },
  };
}

export function resetCast(c: Cast): void {
  Object.assign(c, createCast());
}

const riseFor = (tension: number, multiplier: number): number => clamp(smoothstep(0.15, 0.9, tension) + 0.25 * clamp(Math.log10(multiplier) / 2, 0, 1), 0, 1.15);
/** The duty of a mourner's phone glances: none before their turn, always on for the back row from 5×. */
function dutyOf(m: Mourner, multiplier: number): number {
  if (multiplier < m.from) return 0;
  if (m.back && multiplier >= 5) return 1;
  return clamp(0.3 + 0.5 * smoothstep(m.from, 6, multiplier), 0, 0.85);
}

/** Settles the cast into a round already under way (late entry). */
export function settleCast(c: Cast, d: CastDrive): void {
  settleSpring(c.rise, d.live ? riseFor(d.tension, d.multiplier) : 0);
  settleSpring(c.lean, d.live ? d.tension : 0);
  settleSpring(c.grip, d.live ? d.tension : 0);
  settleSpring(c.shrug, d.live ? smoothstep(0.2, 0.9, d.tension) : 0);
  settleSpring(c.hunch, d.live ? smoothstep(0.1, 0.9, d.tension) : 0);
  settleSpring(c.typing, d.live && d.tension > 0.6 ? 1 : 0);
  for (const m of c.mourners) settleSpring(m.glance, dutyOf(m, d.multiplier) >= 1 ? 1 : 0);
}

/** Advances the cast by `dt` seconds. `said` lists who spoke this frame (lines just said). */
export function stepCast(c: Cast, d: CastDrive, said: string[], beats: string[], dt: number): void {
  c.events.glance = 0;
  c.events.veil = false;
  const t = d.tension;
  const crashed = d.ct >= 0;
  // The celebrant: the hands come off the book as the round climbs, and go back to it to close the ledger.
  stepSpring(c.rise, d.live ? riseFor(t, d.multiplier) : 0, crashed ? 5 : 2.4, 0.8, dt);
  stepSpring(c.lean, d.live ? t : crashed ? 0.6 : 0, 2, 0.9, dt);
  if (said.includes('celebrant')) c.brow.v += 6;
  stepSpring(c.brow, 0, 9, 0.5, dt);
  const talking = d.talk('celebrant');
  c.gest += dt * (2.2 + 3 * t) * (d.exitAge >= 0 ? 1.5 : 1) * (0.25 + 0.75 * talking);
  c.blink = Math.max(0, c.blink - dt);
  if ((c.blinkIn -= dt) <= 0) {
    c.blink = 0.12;
    c.blinkIn = 2.2 + 2.6 * noise(d.time * 7.1);
  }
  // The widow: knuckles whiten on the chair, shoulders rise, the veil trembles; every line and milestone nudges it.
  stepSpring(c.grip, d.live ? t : crashed ? 1 : 0, 3, 0.9, dt);
  stepSpring(c.shrug, d.live ? smoothstep(0.2, 0.9, t) : 0, 2.5, 0.8, dt);
  if (said.length && d.live) {
    c.veil.v += (said.includes('celebrant') ? 22 : 12) * (0.4 + t);
    c.events.veil = true;
  }
  stepSpring(c.veil, 0, 7, 0.18, dt);
  // The mother turns to her daughter when she speaks, and dabs with the page.
  stepSpring(c.momTurn, d.talk('mother') > 0.05 ? 1 : 0, 6, 0.8, dt);
  c.dabClock += dt * (0.12 + 0.25 * t);
  const dabbing = beats.includes('dab') || (d.live && (c.dabClock % 1) > 0.78) || (crashed && d.ct > 3.1);
  stepSpring(c.dab, dabbing ? 1 : 0, 6, 0.75, dt);
  // The son looks up from his overlay only to say his piece.
  stepSpring(c.sonTurn, d.talk('son') > 0.05 ? 1 : 0, 6, 0.8, dt);
  // The best friend: the phone to his ear on a call beat.
  if (beats.includes('call')) c.callT = 0;
  c.callT += dt;
  stepSpring(c.ear, c.callT < 3.2 || d.talk('friend') > 0.05 ? 1 : 0, 7, 0.75, dt);
  // The mourners glance at their phones under their jackets, in their seeded turns.
  for (const m of c.mourners) {
    const duty = d.live ? dutyOf(m, d.multiplier) : 0;
    m.phase += dt / mix(6.5, 3.2, t);
    const on = duty >= 1 || ((m.phase % 1) < duty && duty > 0);
    const was = m.glance.x > 0.5;
    stepSpring(m.glance, on ? 1 : crashed ? m.glance.x : 0, 7, 0.85, dt);
    if (!was && m.glance.x > 0.5 && d.live) c.events.glance += 1;
    stepSpring(m.turn, on ? 1 : 0, 5, 0.8, dt);
  }
  // The dog: from the casket to the flowers and back, faster as the room tightens. Ears follow.
  const period = mix(5.2, 1.8, t);
  if (!crashed || d.ct < DOG_TILT[0]) c.lookClock += dt / period;
  const target = crashed ? 1 : Math.floor(c.lookClock) % 2 === 0 ? 1 : 0;
  const prev = c.look.x;
  stepSpring(c.look, target, 5, 0.7, dt);
  const swing = (c.look.x - prev) / Math.max(dt, 1e-4);
  c.earA.v -= swing * 0.9 * dt * 60 * 0.05;
  c.earB.v -= swing * 0.7 * dt * 60 * 0.05;
  if ((c.twitchIn -= dt) <= 0 && (!crashed || d.ct < HOLD_AT)) {
    c.twitchIn = mix(2.6, 0.9, t) + noise(d.time * 3.3) * 1.5;
    c.earA.v += 5;
  }
  stepSpring(c.earA, 0, 14, 0.25, dt);
  stepSpring(c.earB, 0, 11, 0.3, dt);
  // The florist starts typing at high tension.
  stepSpring(c.typing, d.live && t > 0.6 ? 1 : 0, 5, 0.9, dt);
  // The cousin: shoulders up, glances at the door more often the worse it gets.
  stepSpring(c.hunch, d.live ? smoothstep(0.1, 0.9, t) : crashed ? 1 : 0, 2.5, 0.85, dt);
  if ((c.peekIn -= dt) <= 0) {
    c.peekTo = c.peekTo !== 0 ? 0 : d.live && t > 0.25 ? -1 : noise(d.time) > 0.5 ? 0.6 : -0.6;
    c.peekIn = c.peekTo !== 0 ? 0.9 + noise(d.time * 2) : mix(4, 1.6, t) + noise(d.time * 5) * 1.5;
  }
  stepSpring(c.peek, d.exitAge >= 0 ? 0 : c.peekTo, 6, 0.8, dt);
}

// ─── Shared drawing ─────────────────────────────────────────────────────────────────────────────────────
/** An arm whose elbow goes toward `hint`, with a continuous pole so it never flips: sleeve, cuff and hand. */
function arm(ctx: CanvasRenderingContext2D, root: Pt, target: Pt, upper: number, lower: number, hint: Pt, sleeve: string, width: number, skin = SKIN, cuff = '#f2efe8'): Pt {
  const tx = target.x - root.x;
  const ty = target.y - root.y;
  const hx = hint.x - root.x;
  const hy = hint.y - root.y;
  const cross = (tx * hy - ty * hx) / (Math.hypot(tx, ty) * Math.hypot(hx, hy) + 1e-6);
  const { joint, end } = solveLimb(root, target, upper, lower, clamp(cross * 3, -1, 1));
  limb(ctx, [root, joint, end], width, sleeve);
  const k = 0.82;
  const cx = mix(joint.x, end.x, k);
  const cy = mix(joint.y, end.y, k);
  limb(ctx, [{ x: cx, y: cy }, end], width * 0.8, cuff, 1.6);
  blob(ctx, end.x, end.y, width * 0.62, width * 0.56, skin, 2);
  return end;
}

/** A folding chair seen from behind: the back legs, the cross bar and the backrest (drawn over its sitter). */
function chairBack(ctx: CanvasRenderingContext2D, x: number, floor: number, s: number, empty = false): void {
  stamp(ctx, `chair${s}${empty}`, x, floor, -36 * s, -98 * s, 72 * s, 104 * s, (g) => {
    g.scale(s, s);
    ink(g, 6);
    g.beginPath();
    g.moveTo(-24, 0);
    g.lineTo(-26, -92);
    g.moveTo(24, 0);
    g.lineTo(26, -92);
    g.moveTo(-25, -22);
    g.lineTo(25, -22);
    g.stroke();
    g.strokeStyle = '#8a7f86';
    g.lineWidth = 3;
    g.stroke();
    if (empty) box(g, -26, -52, 52, 8, 2, '#8a7f86', 2);
    box(g, -30, -90, 60, 22, 6, '#8a7f86', 2.5);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(-24, -86, 48, 3);
  });
}

interface BackLook { coat: string; hair: string; style: Style; skin: string }

/**
 * A seated mourner from behind, at scale `s` with the chair's back feet at (x, floor): torso, shoulders, neck,
 * the back of the head (turning shows a cheek, an ear and the tip of a nose), with an optional phone glance.
 */
type BackPose = { sway: number; breathe: number; shrug: number; turn: number; bow: number; glance: number; side: number };

/**
 * A seated mourner from behind, at scale `s` with the chair's back feet at (x, floor): torso, shoulders, neck,
 * the back of the head (turning shows a cheek, an ear and the tip of a nose), with an optional phone glance.
 * At their resting pose (`rest`) the figure is a cached image, swayed and breathed by its transform.
 */
function seatedBack(ctx: CanvasRenderingContext2D, x: number, floor: number, s: number, look: BackLook, o: BackPose, rest?: { key: string; turn: number; bow: number }): void {
  ctx.save();
  ctx.translate(x, floor);
  ctx.scale(s, s);
  // The body leans about the seat.
  ctx.translate(0, -48);
  ctx.rotate(o.sway * 0.03);
  ctx.translate(0, 48);
  if (rest && o.glance < 0.02 && Math.abs(o.turn - rest.turn) < 0.02 && Math.abs(o.bow - rest.bow) < 0.02) {
    ctx.translate(0, -46);
    ctx.scale(1, 1 + (6 * o.shrug - o.breathe) / 100);
    ctx.translate(0, 46);
    stamp(ctx, rest.key, 0, 0, -44, -160, 88, 120, (g) => figureBack(g, look, { ...o, sway: 0, breathe: 0, shrug: 0, turn: rest.turn, bow: rest.bow, glance: 0 }));
  } else figureBack(ctx, look, o);
  ctx.restore();
}

function figureBack(ctx: CanvasRenderingContext2D, look: BackLook, o: BackPose): void {
  const sh = -102 - 6 * o.shrug + o.breathe;
  // The phone hand's elbow out at the side, the jacket opened on it.
  if (o.glance > 0.05) {
    const side = o.side;
    limb(ctx, [{ x: side * 28, y: sh + 10 }, { x: side * (38 + 4 * o.glance), y: sh + 34 }, { x: side * 18, y: sh + 22 }], 11, look.coat);
  }
  ctx.fillStyle = look.coat;
  ink(ctx, 2.6);
  ctx.beginPath();
  ctx.moveTo(-25, -44);
  ctx.lineTo(-30, sh + 10);
  ctx.quadraticCurveTo(-31, sh - 2, -19, sh - 4 + 2 * o.shrug);
  ctx.lineTo(19, sh - 4 + 2 * o.shrug);
  ctx.quadraticCurveTo(31, sh - 2, 30, sh + 10);
  ctx.lineTo(25, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // A seam down the back.
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, sh + 6);
  ctx.lineTo(0, -46);
  ctx.stroke();
  const turn = clamp(o.turn + (o.glance > 0.05 ? o.side * 0.45 * o.glance : 0), -1, 1);
  const bow = o.bow + 0.6 * o.glance;
  drawBackHead(ctx, 0, sh - 22 + 7 * bow, look, turn, bow);
  if (o.glance > 0.05) {
    // The light from the phone on the face's edge.
    glow(ctx, o.side * 22, sh - 10, 30, [150, 210, 255], 0.75 * o.glance);
    ctx.strokeStyle = `rgba(190, 230, 255, ${0.8 * o.glance})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, sh - 22 + 7 * bow, 18, o.side > 0 ? -0.6 : Math.PI - 0.9, o.side > 0 ? 0.9 : Math.PI + 0.6);
    ctx.stroke();
  }
}

/** The back of a head (centre at x, y; radius 18), turned by `turn` (-1 left … 1 right), bowed by `bow`. */
function drawBackHead(ctx: CanvasRenderingContext2D, x: number, y: number, look: BackLook, turn: number, bow: number): void {
  const r = 18;
  // Neck.
  ctx.fillStyle = look.skin;
  ink(ctx, 2.2);
  ctx.fillRect(x - 8, y + 10, 16, 14);
  ctx.strokeRect(x - 8, y + 10, 16, 14);
  // Ears, slid round with the turn.
  ctx.fillStyle = look.skin;
  ink(ctx, 2);
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const ex = x + side * r * (1 - 0.35 * Math.max(0, side * turn)) - turn * 4;
    ctx.moveTo(ex + 4.2, y + 2);
    ctx.ellipse(ex, y + 2, 4.2, 6.5, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  blob(ctx, x, y, r, r * 1.04, look.skin, 2.4);
  // A turned head shows the cheek and the tip of the nose on that side.
  if (Math.abs(turn) > 0.25) {
    const side = Math.sign(turn);
    const k = smoothstep(0.25, 0.9, Math.abs(turn));
    ctx.fillStyle = look.skin;
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(x + side * (r - 3), y - 2 + 3 * bow);
    ctx.lineTo(x + side * (r + 5 * k), y + 3 + 3 * bow);
    ctx.lineTo(x + side * (r - 2), y + 6 + 3 * bow);
    ctx.fill();
    ctx.stroke();
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.moveTo(x + side * (r - 6), y - 4 + 2 * bow);
    ctx.lineTo(x + side * (r - 1 + 2 * k), y - 6 + 2 * bow);
    ctx.stroke();
  }
  // Hair, covering the back of the head and pushed away from the turned side.
  const hx = x - turn * 4;
  ctx.fillStyle = look.hair;
  ink(ctx, 2.2);
  switch (look.style) {
    case 'bald':
      ctx.beginPath();
      ctx.ellipse(hx, y + 6, r * 0.95, 8, 0, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.ellipse(x - 5, y - 9, 6, 4, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bun':
    case 'grey':
      ctx.beginPath();
      ctx.ellipse(hx, y - 2, r * 1.04, r * 1.02, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      blob(ctx, hx, y + 8, 9, 7, look.hair, 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.2;
      for (const a of [-0.6, 0, 0.6]) {
        ctx.beginPath();
        ctx.moveTo(hx + Math.sin(a) * 16, y - 14);
        ctx.quadraticCurveTo(hx + Math.sin(a) * 10, y, hx + Math.sin(a) * 4, y + 6);
        ctx.stroke();
      }
      break;
    case 'curly':
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * Math.PI * 2;
        blob(ctx, hx + Math.cos(a) * 12, y - 2 + Math.sin(a) * 12, 8, 8, look.hair, 1.6);
      }
      blob(ctx, hx, y - 2, 13, 13, look.hair, 0);
      break;
    case 'hood':
    case 'short':
    case 'slick':
    default:
      ctx.beginPath();
      ctx.moveTo(hx - r, y + 4);
      ctx.quadraticCurveTo(hx - r - 2, y - r - 4, hx, y - r - 2);
      ctx.quadraticCurveTo(hx + r + 2, y - r - 4, hx + r, y + 4);
      ctx.quadraticCurveTo(hx, y + 12, hx - r, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (look.style === 'slick') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        for (const dx of [-8, 0, 8]) {
          ctx.beginPath();
          ctx.moveTo(hx + dx - 2, y - 14);
          ctx.quadraticCurveTo(hx + dx, y - 4, hx + dx + 1, y + 4);
          ctx.stroke();
        }
      }
  }
}

// ─── The celebrant ──────────────────────────────────────────────────────────────────────────────────────
/** His torso, stole, bow tie and face (drawn before the lectern). */
export function drawCelebrant(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const { x, y } = CELEBRANT;
  const lean = clamp(c.lean.x, 0, 1.1);
  const talk = d.talk('celebrant');
  const crashed = d.ct >= 0;
  const bowHead = crashed ? smoothstep(1.3, 2.0, d.ct) : 0;
  const breathe = Math.sin(d.amb * 1.6) * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(CELEBRANT.s, CELEBRANT.s);
  // Suit, shirt, the stole with the ticker woven in and the bow tie: one cached image that breathes and leans.
  const sh = -34 + breathe * 0.4 + 3 * lean;
  stamp(ctx, 'celebrantTorso', 0, sh + 34, -50, -40, 100, 60, (g) => {
    const top = -34;
    g.fillStyle = '#1f1d24';
    ink(g, 3);
    g.beginPath();
    g.moveTo(-46, 16);
    g.lineTo(-46, top + 14);
    g.quadraticCurveTo(-46, top, -26, top - 2);
    g.lineTo(26, top - 2);
    g.quadraticCurveTo(46, top, 46, top + 14);
    g.lineTo(46, 16);
    g.closePath();
    g.fill();
    g.stroke();
    poly(g, [-12, top - 2, 12, top - 2, 0, top + 24], '#f4f1ea', 2);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * 20, top - 2);
      g.rotate(side * -0.08);
      box(g, -7, 0, 14, 52, 2, '#2f5f45', 2);
      g.fillStyle = '#d4a94f';
      g.fillRect(-7, 0, 2, 52);
      g.fillRect(5, 0, 2, 52);
      g.translate(0, 22);
      g.rotate(Math.PI / 2);
      label(g, '$BAGS', 0, 0, 7, '#e8c25a', 900, 44);
      g.restore();
    }
    poly(g, [-12, top - 4, -2, top + 1, -12, top + 6], '#8a2232', 1.8);
    poly(g, [12, top - 4, 2, top + 1, 12, top + 6], '#8a2232', 1.8);
    blob(g, 0, top + 1, 3, 3, '#a8323f', 1.5);
  });
  // The head: a nod with his phrasing, a lean as the eulogy deepens, bowed after he closes the book.
  const nod = talk * Math.sin(c.gest * 2.1) * 2.5;
  const hx = Math.sin(c.gest * 0.9) * 2 * talk;
  const hy = sh - 34 + nod + 4 * lean + 10 * bowHead;
  drawCelebrantFace(ctx, hx, hy, c, d, talk, lean, bowHead);
  ctx.restore();
}

function drawCelebrantFace(ctx: CanvasRenderingContext2D, x: number, y: number, c: Cast, d: CastDrive, talk: number, lean: number, bowHead: number): void {
  const r = 27;
  ctx.fillStyle = '#f0cfae';
  ink(ctx, 2.6);
  ctx.fillRect(x - 10, y + 16, 20, 16);
  ctx.strokeRect(x - 10, y + 16, 20, 16);
  for (const side of [-1, 1]) blob(ctx, x + side * 26, y + 2, 6, 8.5, '#f0cfae', 2.2);
  blob(ctx, x, y, r, r * 1.05, '#f0cfae', 2.8);
  // A shine on the dome, white tufts over the ears.
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(x - 8, y - 18, 8, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#e8e4de';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(x + side * 20, y - 14);
    ctx.quadraticCurveTo(x + side * 34, y - 12, x + side * 30, y + 2);
    ctx.quadraticCurveTo(x + side * 34, y + 8, x + side * 24, y + 10);
    ctx.quadraticCurveTo(x + side * 24, y - 4, x + side * 20, y - 14);
    ctx.fill();
    ctx.stroke();
  }
  // Brows: bushy, climbing with each line and with the round, sorrowful at the end.
  const lift = clamp(c.brow.x, -1, 2) * 2.5 + 4 * d.tension;
  ctx.fillStyle = '#e8e4de';
  ink(ctx, 2);
  for (const side of [-1, 1]) {
    const inner = y - 12 - lift - (bowHead > 0 ? 4 * bowHead : 0);
    const outer = y - 11 - lift * 0.6 + 3 * bowHead;
    ctx.beginPath();
    ctx.moveTo(x + side * 4, inner + 2);
    ctx.quadraticCurveTo(x + side * 11, inner - 5, x + side * 19, outer);
    ctx.lineTo(x + side * 18, outer + 4);
    ctx.quadraticCurveTo(x + side * 11, inner, x + side * 4, inner + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Eyes: on the congregation, a blink now and then, shut once the book is shut.
  const shut = c.blink > 0 || bowHead > 0.6;
  for (const side of [-1, 1]) {
    const ex = x + side * 10;
    const ey = y - 3;
    if (shut) {
      ink(ctx, 2);
      ctx.beginPath();
      ctx.arc(ex, ey - 1, 4.5, 0.25, Math.PI - 0.25);
      ctx.stroke();
      continue;
    }
    blob(ctx, ex, ey, 5.2, 5.6 + 1.6 * d.tension, '#ffffff', 1.8);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex - 1.2 + Math.sin(d.amb * 0.5) * 0.8, ey + 1, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The nose, and the mouth: solemn at rest, working through the eulogy, a strained grin when it gets high.
  ctx.fillStyle = '#e6b894';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(x, y + 5, 5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const open = talk * (0.25 + 0.75 * Math.abs(Math.sin(d.time * 13)));
  const grin = smoothstep(0.75, 1, d.tension) * (1 - bowHead);
  ctx.fillStyle = '#6a2430';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(x - 10 - 3 * grin, y + 15 - 2 * grin);
  ctx.quadraticCurveTo(x, y + 15 + 2 + 9 * open + 3 * grin, x + 10 + 3 * grin, y + 15 - 2 * grin);
  ctx.quadraticCurveTo(x, y + 13 - 1 * open, x - 10 - 3 * grin, y + 15 - 2 * grin);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (lean > 0.8 && bowHead < 0.5) {
    // A bead of sweat at the temple.
    const fall = (d.amb * 0.6) % 1;
    blob(ctx, x + 22, y - 8 + 14 * fall, 2, 3, 'rgba(160, 210, 255, 0.95)', 1);
  }
}

/** His arms and hands, over the lectern: on the book, then rising off it; at the crash, closing it. Returns the book's close (0..1). */
export function drawCelebrantArms(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const rise = clamp(c.rise.x, 0, 1.15);
  const talk = d.talk('celebrant');
  const lean = clamp(c.lean.x, 0, 1.1);
  const sh = -34 + Math.sin(d.amb * 1.6) * 0.5 + 3 * lean;
  const close = d.ct >= 0 ? ledgerClose(d.ct) : 0;
  const reach = d.ct >= 0 ? smoothstep(0.5, 0.8, d.ct) : 0;
  // The hands lift off the book and open out as the eulogy deepens: chest height by half tension, high and wide near the top.
  const lift = rise * rise;
  ctx.save();
  ctx.translate(CELEBRANT.x, CELEBRANT.y);
  ctx.scale(CELEBRANT.s, CELEBRANT.s);
  for (const side of [-1, 1]) {
    const g = side < 0 ? c.gest : c.gest + 2.1;
    const gx = Math.sin(g) * 10 * talk * (0.4 + rise);
    const gy = Math.cos(g * 1.3) * 9 * talk;
    let hand = { x: mix(side * 20, side * 80, rise) + gx * (1 - reach), y: mix(-6, -100, lift) + gy * (1 - reach) };
    if (reach > 0) {
      // Back down to the book; the right hand swings the right half over to shut it.
      hand = { x: mix(hand.x, side * 20, reach), y: mix(hand.y, -6, reach) };
      if (side > 0) hand = { x: hand.x - 36 * close, y: hand.y - 12 * Math.sin(Math.PI * close) };
    }
    const root = { x: side * 40, y: sh + 6 };
    arm(ctx, root, hand, 36, 34, { x: side * 90, y: sh + 60 }, '#1f1d24', 15, '#f0cfae');
  }
  ctx.restore();
}

/** How shut the ledger is at this crash clock. */
export const ledgerClose = (ct: number): number => smoothstep(CRASH_AT.book[0], CRASH_AT.book[1], ct);

// ─── The widow ──────────────────────────────────────────────────────────────────────────────────────────
/** Where the widow is and what she is doing at this crash clock (or seated, before it). */
function widowPose(ct: number): { x: number; floor: number; s: number; rise: number; walk: number; front: number; turnSquash: number; unfold: number; sit: number } {
  if (ct < WIDOW_AT.stand[0]) return { x: SEATS.widow, floor: FRONT.floor, s: FRONT.s, rise: 0, walk: 0, front: 0, turnSquash: 1, unfold: 0, sit: 0 };
  const rise = smoothstep(WIDOW_AT.stand[0], WIDOW_AT.stand[1], ct);
  const w = clamp((ct - WIDOW_AT.walk[0]) / (WIDOW_AT.walk[1] - WIDOW_AT.walk[0]), 0, 1);
  const v = smoothstep(0, 1, w);
  // Out into the aisle and up it to the foot of the casket.
  const u = 1 - v;
  const x = u * u * SEATS.widow + 2 * u * v * 470 + v * v * FOOT.x;
  const floor = u * u * FRONT.floor + 2 * u * v * 470 + v * v * FOOT.floor;
  const s = mix(FRONT.s, FOOT.s, v);
  const turn = clamp((ct - WIDOW_AT.turn[0]) / (WIDOW_AT.turn[1] - WIDOW_AT.turn[0]), 0, 1);
  const front = turn >= 0.5 ? 1 : 0;
  const turnSquash = Math.max(0.08, Math.abs(Math.cos(Math.PI * turn)));
  const unfold = smoothstep(WIDOW_AT.unfold[0], WIDOW_AT.unfold[1], ct);
  const sit = smoothstep(WIDOW_AT.sit[0], WIDOW_AT.sit[1], ct);
  return { x, floor, s, rise, walk: w > 0 && w < 1 ? (ct - WIDOW_AT.walk[0]) * 13 : 0, front, turnSquash, unfold, sit };
}

/** The widow's depth (her floor line), for drawing order. */
export const widowDepth = (ct: number): number => widowPose(Math.max(ct, -1)).floor;

/** Gerald's lawn chair, folded (u = 0) or open (u = 1), feet at the origin, facing us when open. */
function lawnChair(ctx: CanvasRenderingContext2D, u: number, shake: number): void {
  if (u <= 0) {
    stamp(ctx, 'lawnFolded', shake, 0, -14, -110, 28, 114, (g) => paintLawnChair(g, 0));
    return;
  }
  ctx.save();
  ctx.translate(shake, 0);
  paintLawnChair(ctx, u);
  ctx.restore();
}

function paintLawnChair(ctx: CanvasRenderingContext2D, u: number): void {
  const w = mix(8, 30, u);
  const top = mix(-104, -112, u);
  const seat = mix(-60, -44, u);
  // Back legs splay out as it opens.
  ink(ctx, 5.5);
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(-w * 0.9, top);
  ctx.moveTo(w, 0);
  ctx.lineTo(w * 0.9, top);
  if (u > 0.2) {
    ctx.moveTo(-w - 8 * u, -2);
    ctx.lineTo(-w * 0.6, seat);
    ctx.moveTo(w + 8 * u, -2);
    ctx.lineTo(w * 0.6, seat);
  }
  ctx.stroke();
  ctx.strokeStyle = '#c9ced3';
  ctx.lineWidth = 3;
  ctx.stroke();
  // The webbing: green and white straps across the back (and the seat once it opens).
  const straps = 7;
  for (const colour of [0, 1]) {
    ctx.fillStyle = colour === 0 ? '#3f9a5a' : '#f2f2ea';
    ctx.beginPath();
    for (let i = colour; i < straps; i += 2) ctx.rect(-w * 0.9, mix(top + 4, seat - 6, i / (straps - 1)), w * 1.8, mix(11, 7, u) - 1);
    ctx.fill();
  }
  ink(ctx, 1.2);
  ctx.strokeRect(-w * 0.9, top + 4, w * 1.8, seat - 6 - top);
  if (u > 0.3) {
    const k = smoothstep(0.3, 1, u);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#3f9a5a' : '#f2f2ea';
      ctx.fillRect(-w * 0.95, seat + i * 4 * k, w * 1.9, 4 * k);
    }
    // Armrests.
    ink(ctx, 5);
    ctx.beginPath();
    ctx.moveTo(-w - 4, seat - 16 * k);
    ctx.lineTo(-w + 2, seat - 16 * k);
    ctx.moveTo(w + 4, seat - 16 * k);
    ctx.lineTo(w - 2, seat - 16 * k);
    ctx.stroke();
    ctx.strokeStyle = '#c9ced3';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ink(ctx, 5);
  ctx.beginPath();
  ctx.moveTo(-w * 0.9 - 1, top);
  ctx.lineTo(w * 0.9 + 1, top);
  ctx.stroke();
  ctx.strokeStyle = '#c9ced3';
  ctx.lineWidth = 3;
  ctx.stroke();

}

/** The hat and its veil from behind, the hem trembling. */
function hatBack(ctx: CanvasRenderingContext2D, x: number, y: number, tremble: number, amb: number): void {
  // The veil hangs from the brim's back edge to the shoulders: sheer black net.
  ctx.fillStyle = 'rgba(30, 22, 36, 0.7)';
  ctx.beginPath();
  ctx.moveTo(x - 24, y - 12);
  ctx.lineTo(x + 24, y - 12);
  ctx.lineTo(x + 25 + tremble, y + 26);
  for (let i = 0; i <= 8; i += 1) {
    const hx = x + 25 + tremble - (i * 50) / 8 + Math.sin(amb * 9 + i) * Math.abs(tremble) * 0.3;
    ctx.lineTo(hx, y + 26 + (i % 2 === 0 ? 3 : 0));
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150, 130, 160, 0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = -20; i <= 20; i += 5) {
    ctx.moveTo(x + i, y - 10);
    ctx.lineTo(x + i + tremble * 0.8, y + 26);
  }
  for (let j = 0; j < 4; j += 1) {
    ctx.moveTo(x - 23, y - 4 + j * 8);
    ctx.lineTo(x + 23 + tremble * (j / 4), y - 4 + j * 8);
  }
  ctx.stroke();
  // The crown and the brim, caught by the late light along their tops.
  blob(ctx, x, y - 22, 16, 13, '#141018', 2.4);
  ctx.fillStyle = '#141018';
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 30, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5a3a4a';
  ctx.fillRect(x - 15, y - 20, 30, 3);
  ctx.strokeStyle = 'rgba(255, 196, 120, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 27, 5, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.moveTo(x - 11, y - 31);
  ctx.quadraticCurveTo(x, y - 36, x + 11, y - 31);
  ctx.stroke();
}

/** The widow: seated from behind with her knuckles on the folded lawn chair; at the crash, the walk, the chair, the seat facing us. */
export function drawWidow(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const pose = widowPose(d.ct);
  const grip = clamp(c.grip.x, 0, 1);
  const shake = Math.sin(d.amb * 41) * 0.9 * smoothstep(0.55, 0.95, d.tension) * (d.ct < 0 ? 1 : 0);
  const tremble = c.veil.x * 0.35 + (noise(Math.floor(d.amb * 16)) - 0.5) * (0.6 + 3.2 * d.tension) * (d.ct >= 0 ? 0.4 : 1);
  if (pose.rise === 0) {
    chairBack(ctx, pose.x, pose.floor, pose.s);
    seatedWidowBack(ctx, c, d, pose.x, pose.floor, pose.s, grip, shake, tremble);
    return;
  }
  // The chair she stood up from stays where it was.
  chairBack(ctx, SEATS.widow, FRONT.floor, FRONT.s, true);
  ctx.save();
  ctx.translate(pose.x, pose.floor);
  ctx.scale(pose.s * pose.turnSquash, pose.s);
  if (!pose.front) standingWidowBack(ctx, d, pose.rise, pose.walk, tremble);
  else {
    // At the foot of the casket: the chair opens beside her, then she sits in it, facing the room.
    ctx.save();
    ctx.translate(mix(34, 0, pose.sit), 0);
    lawnChair(ctx, pose.unfold, 0);
    ctx.restore();
    widowFront(ctx, d, pose.sit, tremble);
  }
  ctx.restore();
}

function seatedWidowBack(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive, x: number, floor: number, s: number, grip: number, shake: number, tremble: number): void {
  ctx.save();
  ctx.translate(x, floor);
  ctx.scale(s, s);
  // The folded lawn chair stands in the aisle at her side.
  ctx.save();
  ctx.translate(46, 0);
  lawnChair(ctx, 0, shake * 0.6);
  ctx.restore();
  const sh = -102 - 7 * clamp(c.shrug.x, 0, 1) + Math.sin(d.amb * 1.3) * 0.8;
  ctx.fillStyle = '#18141c';
  ink(ctx, 2.6);
  ctx.beginPath();
  ctx.moveTo(-24, -44);
  ctx.lineTo(-28, sh + 10);
  ctx.quadraticCurveTo(-28, sh - 2, -17, sh - 3);
  ctx.lineTo(17, sh - 3);
  ctx.quadraticCurveTo(28, sh - 2, 28, sh + 10);
  ctx.lineTo(24, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Neck, the low bun, then the hat and the veil.
  ctx.fillStyle = '#ecd7c8';
  ink(ctx, 2);
  ctx.fillRect(-6, sh - 14, 12, 12);
  ctx.strokeRect(-6, sh - 14, 12, 12);
  blob(ctx, 0, sh - 30, 16, 17, '#2b1d1a', 2.2);
  blob(ctx, 0, sh - 18, 9, 7, '#2b1d1a', 2);
  hatBack(ctx, 0, sh - 38, tremble, d.amb);
  // Her right arm to the chair's top bar; the knuckles go white as she grips.
  const hand = { x: 44 + shake * 0.6, y: -100 + 2 * grip };
  const root = { x: 24, y: sh + 8 };
  const end = arm(ctx, root, hand, 24, 22, { x: 40, y: sh + 50 }, '#18141c', 10, '#ecd7c8', '#18141c');
  // The fist over the bar, and the four knuckles, whiter the harder she holds on.
  blob(ctx, end.x, end.y, 8, 6.5, '#ecd7c8', 2);
  const knuckle = `rgb(${Math.round(mix(226, 255, grip))}, ${Math.round(mix(196, 252, grip))}, ${Math.round(mix(180, 250, grip))})`;
  ctx.fillStyle = knuckle;
  ink(ctx, 1.4);
  ctx.beginPath();
  for (let k = 0; k < 4; k += 1) {
    const kx = end.x - 6.6 + k * 4.4;
    const ky = end.y - 5 - 0.8 * grip;
    ctx.moveTo(kx + 2.6, ky);
    ctx.ellipse(kx, ky, 2.6, 2.3, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  // The late light along her shoulders.
  ctx.strokeStyle = 'rgba(255, 196, 120, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-25, sh + 4);
  ctx.quadraticCurveTo(-25, sh - 1, -15, sh - 1);
  ctx.moveTo(15, sh - 1);
  ctx.quadraticCurveTo(25, sh - 1, 25, sh + 4);
  ctx.stroke();
  ctx.restore();
}

/** A black dress: shoulders, a waist, a flared skirt to `hem` (half-width `flare`). */
function dress(ctx: CanvasRenderingContext2D, sh: number, waist: number, hem: number, flare: number): void {
  ctx.fillStyle = '#18141c';
  ink(ctx, 2.6);
  ctx.beginPath();
  ctx.moveTo(-flare, hem);
  ctx.quadraticCurveTo(-flare + 4, (hem + waist) / 2, -15, waist);
  ctx.quadraticCurveTo(-25, (waist + sh) / 2, -24, sh + 8);
  ctx.quadraticCurveTo(-24, sh - 2, -15, sh - 3);
  ctx.lineTo(15, sh - 3);
  ctx.quadraticCurveTo(24, sh - 2, 24, sh + 8);
  ctx.quadraticCurveTo(25, (waist + sh) / 2, 15, waist);
  ctx.quadraticCurveTo(flare - 4, (hem + waist) / 2, flare, hem);
  ctx.quadraticCurveTo(0, hem + 4, -flare, hem);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function standingWidowBack(ctx: CanvasRenderingContext2D, d: CastDrive, rise: number, walk: number, tremble: number): void {
  const hip = mix(-50, -86, rise);
  const sh = mix(-102, -150, rise);
  const step = Math.sin(walk);
  // Legs below the hem, stepping.
  ink(ctx, 7);
  ctx.strokeStyle = '#141018';
  ctx.beginPath();
  ctx.moveTo(-6, hip + 30);
  ctx.lineTo(-7 + step * 3, -2 - Math.max(0, step) * 4);
  ctx.moveTo(6, hip + 30);
  ctx.lineTo(7 - step * 3, -2 - Math.max(0, -step) * 4);
  ctx.stroke();
  dress(ctx, sh, mix(sh + 40, hip - 4, 0.5), hip + 46, mix(24, 28, rise));
  // Her left arm hangs at her side.
  limb(ctx, [{ x: -22, y: sh + 8 }, { x: -27, y: sh + 40 }, { x: -24 - step * 2, y: hip - 26 }], 9, '#18141c');
  // The folded chair carried at her side.
  ctx.save();
  ctx.translate(40, hip + 40 + Math.abs(step) * 2);
  ctx.scale(0.9, 0.9);
  lawnChair(ctx, 0, 0);
  ctx.restore();
  limb(ctx, [{ x: 24, y: sh + 8 }, { x: 34, y: sh + 40 }, { x: 40, y: hip - 52 }], 10, '#18141c');
  blob(ctx, 40, hip - 52, 5, 5, '#ecd7c8', 1.8);
  ctx.fillStyle = '#ecd7c8';
  ink(ctx, 2);
  ctx.fillRect(-6, sh - 14, 12, 12);
  ctx.strokeRect(-6, sh - 14, 12, 12);
  blob(ctx, 0, sh - 30, 16, 17, '#2b1d1a', 2.2);
  blob(ctx, 0, sh - 18, 9, 7, '#2b1d1a', 2);
  hatBack(ctx, 0, sh - 38, tremble, d.amb);
}

/** The widow facing us: standing beside the chair as it opens, then seated in it. Her face under the net veil. */
function widowFront(ctx: CanvasRenderingContext2D, d: CastDrive, sit: number, tremble: number): void {
  const hip = mix(-86, -48, sit);
  const sh = mix(-150, -104, sit);
  // Legs: standing straight, then knees forward and together in the chair.
  ink(ctx, 7);
  ctx.strokeStyle = '#141018';
  ctx.beginPath();
  ctx.moveTo(-6, hip + 24);
  ctx.lineTo(-6, -2);
  ctx.moveTo(6, hip + 24);
  ctx.lineTo(6, -2);
  ctx.stroke();
  blob(ctx, -7, -2, 6, 3, '#0d0a10', 1.4);
  blob(ctx, 7, -2, 6, 3, '#0d0a10', 1.4);
  // The dress, the hands folded in her lap.
  dress(ctx, sh, mix(sh + 46, hip - 2, 0.5), hip + mix(46, 30, sit), mix(25, 28, sit));
  // Arms down to the hands folded in front of her, then in her lap.
  for (const side of [-1, 1]) limb(ctx, [{ x: side * 21, y: sh + 8 }, { x: side * 24, y: sh + 36 }, { x: side * 5, y: hip + mix(-14, 4, sit) }], 8.5, '#18141c');
  blob(ctx, -5, hip + mix(-14, 4, sit), 6, 5, '#ecd7c8', 1.8);
  blob(ctx, 5, hip + mix(-13, 5, sit), 6, 5, '#ecd7c8', 1.8);
  // The late light on her shoulders.
  ctx.strokeStyle = 'rgba(255, 196, 120, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, sh + 5);
  ctx.quadraticCurveTo(-22, sh - 1, -14, sh - 1);
  ctx.moveTo(14, sh - 1);
  ctx.quadraticCurveTo(22, sh - 1, 22, sh + 5);
  ctx.stroke();
  // Neck and face, a strand of hair, the downcast eyes, a small mouth for her one line.
  ctx.fillStyle = '#ecd7c8';
  ink(ctx, 2);
  ctx.fillRect(-6, sh - 14, 12, 12);
  ctx.strokeRect(-6, sh - 14, 12, 12);
  const hy = sh - 30;
  blob(ctx, 0, hy, 16, 17.5, '#ecd7c8', 2.4);
  ctx.fillStyle = '#2b1d1a';
  ctx.beginPath();
  ctx.moveTo(-16, hy - 2);
  ctx.quadraticCurveTo(-18, hy - 18, 0, hy - 17);
  ctx.quadraticCurveTo(18, hy - 18, 16, hy - 2);
  ctx.quadraticCurveTo(10, hy - 12, 0, hy - 11);
  ctx.quadraticCurveTo(-10, hy - 12, -16, hy - 2);
  ctx.fill();
  ink(ctx, 1.8);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 6, hy - 1, 3.6, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * 3, hy - 8);
    ctx.lineTo(side * 10, hy - 6.5);
    ctx.stroke();
  }
  const talk = d.talk('widow');
  ctx.fillStyle = '#7a3a44';
  ctx.beginPath();
  ctx.ellipse(0, hy + 9, 3.5, 1 + 2.5 * talk * Math.abs(Math.sin(d.time * 9)), 0, 0, Math.PI * 2);
  ctx.fill();
  // The hat and the short net over her eyes.
  ctx.fillStyle = 'rgba(16, 12, 20, 0.45)';
  ctx.fillRect(-18, hy - 14, 36, 14 + tremble * 0.2);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 0.7;
  for (let i = -16; i <= 16; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, hy - 14);
    ctx.lineTo(i + tremble * 0.3, hy);
    ctx.stroke();
  }
  blob(ctx, 0, hy - 24, 15, 10, '#141018', 2.2);
  ctx.fillStyle = '#141018';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.ellipse(0, hy - 15, 28, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ─── The family and the mourners ───────────────────────────────────────────────────────────────────────
/** The mother: grey bun and a small hat, turning to her daughter to speak, dabbing with a guest-book page. */
export function drawMother(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const x = SEATS.mother;
  chairBack(ctx, x, FRONT.floor, FRONT.s);
  const turn = clamp(c.momTurn.x, 0, 1) * 0.8;
  const dab = clamp(c.dab.x, 0, 1);
  seatedBack(ctx, x, FRONT.floor, FRONT.s, { coat: '#211d26', hair: '#bdb6b8', style: 'grey', skin: SKINS[3]! }, { sway: Math.sin(d.amb * 0.9 + 1), breathe: Math.sin(d.amb * 1.4 + 1) * 0.8, shrug: 0, turn, bow: 0.2 * dab, glance: 0, side: 1 }, { key: 'mom', turn: 0, bow: 0 });
  ctx.save();
  ctx.translate(x, FRONT.floor);
  ctx.scale(FRONT.s, FRONT.s);
  // The pillbox hat.
  box(ctx, -10 - turn * 3, -150, 20, 8, 3, '#141018', 2);
  if (dab > 0.05) {
    // The page from the guest book, up at her eye.
    const hx = mix(26, 16, dab) + turn * 4;
    const hy = mix(-90, -130, dab) + Math.sin(d.amb * 7) * 1.5 * dab;
    limb(ctx, [{ x: 24, y: -96 }, { x: 34, y: -78 }, { x: hx, y: hy }], 10, '#211d26');
    ctx.save();
    ctx.translate(hx + 4, hy - 6);
    ctx.rotate(0.3);
    box(ctx, -6, -9, 12, 16, 1, '#f6f0e0', 1.4);
    ctx.strokeStyle = 'rgba(40,40,90,0.6)';
    ctx.lineWidth = 0.7;
    for (let k = 0; k < 3; k += 1) {
      ctx.beginPath();
      ctx.moveTo(-4, -5 + k * 4);
      ctx.lineTo(4, -5 + k * 4);
      ctx.stroke();
    }
    ctx.restore();
    blob(ctx, hx, hy, 4.5, 4.5, SKINS[3]!, 1.6);
  }
  ctx.restore();
}

/** The son: a hoodie, head down over his phone, which runs a chart overlay we can read over his shoulder. */
export function drawSon(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive, crashX: number | null): void {
  const x = SEATS.son;
  chairBack(ctx, x, FRONT.floor, FRONT.s);
  const look = clamp(c.sonTurn.x, 0, 1);
  seatedBack(ctx, x, FRONT.floor, FRONT.s, { coat: '#5d6470', hair: '#4a3324', style: 'short', skin: SKINS[0]! }, { sway: Math.sin(d.amb * 1.1 + 3), breathe: Math.sin(d.amb * 1.7 + 3) * 0.8, shrug: 0.2, turn: -0.5 * look, bow: 0.7 * (1 - look), glance: 0, side: -1 }, { key: 'son', turn: 0, bow: 0.7 });
  ctx.save();
  ctx.translate(x, FRONT.floor);
  ctx.scale(FRONT.s, FRONT.s);
  // The hood bunched at his neck.
  blob(ctx, 0, -100, 20, 8, '#4f5560', 2.2);
  // The phone held up at his left, screen toward him (and us, over his shoulder).
  const px = -34;
  const py = -128 + 6 * look;
  limb(ctx, [{ x: -24, y: -92 }, { x: -40, y: -80 }, { x: px + 2, y: py + 22 }], 11, '#5d6470');
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.12);
  glow(ctx, 0, 0, 34, [150, 210, 255], 0.55);
  box(ctx, -15, -24, 30, 48, 4, '#18181e', 2);
  phoneChart(ctx, -12, -20, 24, 40, d, crashX);
  ctx.restore();
  blob(ctx, px + 2, py + 22, 5, 4.5, SKINS[0]!, 1.6);
  ctx.restore();
}

/** The son's overlay: the round's curve to now (the shape of the displayed multiplier), red and down at the crash. */
function phoneChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: CastDrive, crashX: number | null): void {
  ctx.fillStyle = '#0f1a2a';
  ctx.fillRect(x, y, w, h);
  const m = Math.max(1.0001, d.multiplier);
  const crashed = d.ct >= 0;
  ctx.strokeStyle = crashed ? '#ff4d6d' : '#7cf67c';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const bottom = y + h - 6;
  const topY = y + 10;
  for (let i = 0; i <= 10; i += 1) {
    const u = i / 10;
    const v = (Math.pow(m, u) - 1) / (m - 1);
    ctx.lineTo(x + 2 + u * (w - 6), mix(bottom, topY, m > 1.001 ? v : u * 0.1));
  }
  if (crashed) ctx.lineTo(x + w - 3, bottom + 4);
  ctx.stroke();
  label(ctx, crashed ? `${(crashX ?? d.multiplier).toFixed(2)}×` : `${d.multiplier.toFixed(2)}×`, x + w / 2, y + 5, 5.5, crashed ? '#ff8a9a' : '#d6ffd6', 900, w - 2);
}

/** The best friend and financial advisor: back row, on his phone, which shows the exit he took at 1.4×. */
export function drawFriend(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const x = SEATS.friend;
  chairBack(ctx, x, BACK.floor, BACK.s);
  const ear = clamp(c.ear.x, 0, 1);
  seatedBack(ctx, x, BACK.floor, BACK.s, { coat: '#26304a', hair: '#2b1d16', style: 'slick', skin: SKINS[1]! }, { sway: Math.sin(d.amb * 0.8 + 5), breathe: Math.sin(d.amb * 1.5 + 5) * 0.8, shrug: 0, turn: 0.35 + 0.3 * ear, bow: 0.3 * (1 - ear), glance: 0, side: 1 }, { key: 'friend', turn: 0.35, bow: 0.3 });
  ctx.save();
  ctx.translate(x, BACK.floor);
  ctx.scale(BACK.s, BACK.s);
  // The phone: low at his side showing the exit, or up at his ear.
  const low = { x: 40, y: -88 };
  const up = { x: 22, y: -128 };
  const px = mix(low.x, up.x, ear);
  const py = mix(low.y, up.y, ear);
  limb(ctx, [{ x: 26, y: -96 }, { x: mix(44, 40, ear), y: mix(-70, -96, ear) }, { x: px, y: py + 10 }], 12, '#26304a');
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(mix(0.25, -0.2, ear));
  if (ear < 0.5) {
    glow(ctx, 0, 0, 30, [160, 255, 190], 0.5);
    box(ctx, -12, -20, 24, 40, 4, '#18181e', 2);
    ctx.fillStyle = '#10261a';
    ctx.fillRect(-9.5, -17, 19, 34);
    label(ctx, 'SOLD', 0, -10, 6.5, '#9df7b4', 900, 18);
    label(ctx, '1.40×', 0, -1, 7, '#ffffff', 900, 18);
    ctx.strokeStyle = '#7cf67c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.lineTo(-2, 12);
    ctx.lineTo(6, 4);
    ctx.stroke();
  } else box(ctx, -8, -14, 16, 28, 4, '#2a2a32', 2);
  ctx.restore();
  blob(ctx, px, py + 10, 5.5, 5, SKINS[1]!, 1.6);
  ctx.restore();
}

/** The other mourners: front and back rows, glancing at phones under their jackets in their seeded turns. */
export function drawMourner(ctx: CanvasRenderingContext2D, m: Mourner, d: CastDrive): void {
  chairBack(ctx, m.x, m.floor, m.s);
  const g = clamp(m.glance.x, 0, 1);
  seatedBack(ctx, m.x, m.floor, m.s, m, { sway: Math.sin(d.amb * (0.7 + 0.1 * m.seed % 3) + m.seed), breathe: Math.sin(d.amb * 1.3 + m.seed) * 0.9, shrug: 0.4 * d.tension, turn: 0, bow: d.ct >= 0 ? 0.45 * smoothstep(0.4, 1.2, d.ct) : 0, glance: g, side: m.side }, { key: d.ct >= 0 ? `m${m.seed}bowed` : `m${m.seed}`, turn: 0, bow: d.ct >= 0 ? 0.45 : 0 });
}

export const mournersOf = (c: Cast): Mourner[] => c.mourners;

// ─── The dog ────────────────────────────────────────────────────────────────────────────────────────────
/** The dog, flat on the carpet by the casket, looking from the casket to the flowers and back; his last tilt ends the crash. */
export function drawDog(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const look = clamp(c.look.x, -0.2, 1.2);
  const tilt = d.ct >= 0 ? smoothstep(DOG_TILT[0], DOG_TILT[1], d.ct) : 0;
  const breathe = Math.sin(d.amb * 1.8) * 0.7;
  const tail = Math.sin(d.amb * 2.4) * 0.15 * (d.ct >= 0 ? 0.2 : 1);
  ctx.save();
  ctx.translate(DOG.x, DOG.y);
  // The tail behind, then the body (a cached image that breathes): haunch, the white chest, the paws out in front.
  ctx.save();
  ctx.translate(34, -12);
  ctx.rotate(tail);
  limb(ctx, [{ x: 0, y: 0 }, { x: 14, y: 2 }, { x: 22, y: -4 }], 5, '#c58a4a', 2);
  ctx.restore();
  ctx.save();
  ctx.scale(1, 1 + breathe * 0.03);
  stamp(ctx, 'dogBody', 0, 0, -54, -30, 106, 38, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(0, 0, 50, 6, 0, 0, Math.PI * 2);
    g.fill();
    blob(g, 0, -12, 36, 13, '#c58a4a', 2.5);
    blob(g, 22, -11, 14, 11, '#c58a4a', 2.2);
    blob(g, 34, -2, 8, 3.5, '#f3e6d4', 1.8);
    blob(g, -20, -8, 11, 8, '#f3e6d4', 1.8);
    blob(g, -40, -3, 10, 4, '#f3e6d4', 1.8);
    blob(g, -32, -1, 9, 3.5, '#f3e6d4', 1.8);
    blob(g, 4, -18, 10, 5, '#6b3f1f', 0);
  });
  ctx.restore();
  // The head on the neck: up toward the casket (look 1) or along the floor to the flowers (look 0).
  ctx.save();
  ctx.translate(-26, -20);
  ctx.rotate(mix(-0.05, 0.5, look) + tilt * 0.42);
  blob(ctx, -10, -6, 12, 10.5, '#c58a4a', 2.3);
  blob(ctx, -24, -3, 10, 6.5, '#d9a066', 2.2);
  blob(ctx, -33, -5, 3.2, 2.6, INK, 1);
  // The eye and its brow, worried.
  blob(ctx, -14, -10, 2.8, 2.8, '#ffffff', 1.2);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-15, -10, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(-19, -15);
  ctx.lineTo(-11, -16.5 - 1.5 * look);
  ctx.stroke();
  // The long ears, swinging on their springs.
  for (const [k, e] of [[0, c.earA], [1, c.earB]] as const) {
    ctx.save();
    ctx.translate(-6 + k * 3, -12);
    ctx.rotate(0.15 - (mix(-0.05, 0.5, look) + tilt * 0.42) * 0.8 + clamp(e.x, -1.2, 1.2) * 0.5 + k * 0.1);
    blob(ctx, 2, 11, 5.5, 12, k === 0 ? '#6b3f1f' : '#7a4a26', 2);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

// ─── The florist ────────────────────────────────────────────────────────────────────────────────────────
/** The florist at the back of the room, with a stop-loss on the wreaths; past two-thirds tension she is typing. */
export function drawFlorist(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const { x, floor, s } = FLORIST;
  const typing = clamp(c.typing.x, 0, 1);
  ctx.save();
  ctx.translate(x, floor);
  ctx.scale(s, s);
  const sh = -228 + Math.sin(d.amb * 1.2 + 2) * 1;
  const tx = -42;
  const ty = sh + 22;
  glow(ctx, tx, ty, 40, [255, 140, 140], 0.35 + 0.25 * typing);
  // Black shirt, the green apron's straps crossing her back, and the tablet held up at her left so we read
  // it over her shoulder: one cached image that breathes with her.
  stamp(ctx, 'floristBody', 0, sh + 228, -72, -252, 110, 140, (g) => {
    const top = -228;
    g.fillStyle = '#1e1c22';
    ink(g, 2.6);
    g.beginPath();
    g.moveTo(-26, -112);
    g.lineTo(-30, top + 12);
    g.quadraticCurveTo(-30, top, -18, top - 2);
    g.lineTo(18, top - 2);
    g.quadraticCurveTo(30, top, 30, top + 12);
    g.lineTo(26, -112);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = '#3f7d4f';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(-16, top);
    g.lineTo(18, top + 70);
    g.moveTo(16, top);
    g.lineTo(-18, top + 70);
    g.stroke();
    g.translate(tx, top + 22);
    g.rotate(-0.1);
    box(g, -24, -18, 48, 36, 4, '#202024', 2);
    g.fillStyle = '#1c1014';
    g.fillRect(-21, -15, 42, 30);
    label(g, 'STOP-LOSS: WREATHS', 0, -10, 5.4, '#ffb4c2', 900, 40);
    g.setLineDash([2, 2]);
    g.strokeStyle = '#ffd36b';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-18, 9);
    g.lineTo(18, 9);
    g.stroke();
    g.setLineDash([]);
  });
  // The price line on the tablet, sliding toward her stop.
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(-0.1);
  ctx.strokeStyle = '#ff4d6d';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-18, -3);
  ctx.lineTo(-8, -1);
  ctx.lineTo(0, 3);
  ctx.lineTo(8, 1 + 4 * d.tension);
  ctx.lineTo(18, 6 + 4 * d.tension);
  ctx.stroke();
  ctx.restore();
  // Both hands on it; the right one types.
  const tap = typing * Math.abs(Math.sin(d.amb * 16)) * 5;
  limb(ctx, [{ x: -24, y: sh + 10 }, { x: -34, y: sh + 44 }, { x: tx + 14, y: ty + 14 }], 11, '#1e1c22');
  limb(ctx, [{ x: 20, y: sh + 12 }, { x: 4, y: sh + 46 }, { x: tx + 6 + 4 * typing, y: ty - 2 - tap }], 11, '#1e1c22');
  blob(ctx, tx + 14, ty + 14, 5, 4.5, SKINS[3]!, 1.6);
  blob(ctx, tx + 6 + 4 * typing, ty - 2 - tap, 5, 4.5, SKINS[3]!, 1.6);
  // Head: watching the wreaths, or down at the screen when she types. A red bun with a pencil through it.
  const turn = mix(-0.55, -0.85, typing);
  drawBackHead(ctx, 0, sh - 22 + 5 * typing, { coat: '', hair: '#b4472a', style: 'bun', skin: SKINS[3]! }, turn, 0.6 * typing);
  ink(ctx, 2);
  ctx.strokeStyle = '#e8c25a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-12, sh - 18);
  ctx.lineTo(10, sh - 30);
  ctx.stroke();
  ctx.restore();
}

// ─── The cousin (the player) ───────────────────────────────────────────────────────────────────────────
/** Where the cousin is on the exit clock: x, floor line and scale (perspective toward the side door). */
export function cousinAt(exitAge: number): { x: number; floor: number; s: number } {
  if (exitAge < EXIT_AT.walk[0]) return { x: COUSIN.x, floor: COUSIN.floor, s: COUSIN.s };
  if (exitAge < EXIT_AT.door[0]) {
    const u = smoothstep(EXIT_AT.walk[0], EXIT_AT.walk[1], exitAge);
    return { x: mix(COUSIN.x, 160, u), floor: COUSIN.floor, s: COUSIN.s };
  }
  const u = smoothstep(EXIT_AT.door[0], EXIT_AT.door[1], exitAge);
  const floor = mix(COUSIN.floor, DOOR.y + DOOR.h - 2, u);
  const s = mix(COUSIN.s, 0.44, (COUSIN.floor - floor) / (COUSIN.floor - (DOOR.y + DOOR.h - 2)));
  return { x: mix(160, DOOR.x + DOOR.w / 2, u), floor, s };
}

/** What the cousin has taken off the reception table by this exit clock. */
export function takenBy(exitAge: number): { sandwiches: number; candle: boolean } {
  if (exitAge < 0) return { sandwiches: 0, candle: false };
  const [a, b, c] = EXIT_AT.grab;
  return { sandwiches: exitAge >= b ? 2 : exitAge >= a ? 1 : 0, candle: exitAge >= c };
}

/** The cousin, from behind by the side door; on the exit: shades, the turn, the table, the door. */
export function drawCousin(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const e = d.exitAge;
  if (e >= EXIT_AT.fade[1]) return;
  const at = cousinAt(Math.max(0, e));
  const hunch = clamp(c.hunch.x, 0, 1);
  const shades = e >= 0 ? smoothstep(0.25, 0.45, e) : 0;
  const profile = e >= EXIT_AT.turn[0] && e < EXIT_AT.back[1];
  const squash = e >= EXIT_AT.turn[0] && e < EXIT_AT.turn[1] ? Math.max(0.1, Math.abs(Math.cos(Math.PI * (e - EXIT_AT.turn[0]) / (EXIT_AT.turn[1] - EXIT_AT.turn[0])))) : e >= EXIT_AT.back[0] && e < EXIT_AT.back[1] ? Math.max(0.1, Math.abs(Math.cos(Math.PI * (e - EXIT_AT.back[0]) / (EXIT_AT.back[1] - EXIT_AT.back[0])))) : 1;
  const sideOn = profile && !(e >= EXIT_AT.turn[0] && e < (EXIT_AT.turn[0] + EXIT_AT.turn[1]) / 2) && !(e >= (EXIT_AT.back[0] + EXIT_AT.back[1]) / 2);
  const walking = (e >= EXIT_AT.walk[0] && e < EXIT_AT.walk[1]) || (e >= EXIT_AT.door[0] && e < EXIT_AT.door[1]);
  const gait = walking ? e * 9 : 0;
  const bob = walking ? -Math.abs(Math.sin(gait)) * 4 : 0;
  const taken = takenBy(e);
  ctx.save();
  ctx.globalAlpha = 1 - smoothstep(EXIT_AT.fade[0], EXIT_AT.fade[1], e);
  ctx.translate(at.x, at.floor + bob);
  ctx.scale(at.s * squash, at.s);
  const sh = -232 - 7 * hunch + Math.sin(d.amb * 1.25) * 1.2;
  const hip = -150;
  // Legs (below the frame until the walk into the room).
  ink(ctx, 12);
  ctx.strokeStyle = '#23242c';
  const step = Math.sin(gait);
  ctx.beginPath();
  ctx.moveTo(-9, hip + 10);
  ctx.lineTo(-9 + step * 12, -2);
  ctx.moveTo(9, hip + 10);
  ctx.lineTo(9 - step * 12, -2);
  ctx.stroke();
  if (sideOn) cousinProfile(ctx, d, sh, hip, gait, shades, taken, e);
  else cousinBack(ctx, c, d, sh, hip, gait, shades, taken, e, walking);
  ctx.restore();
}

function cousinBack(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive, sh: number, hip: number, gait: number, shades: number, taken: { sandwiches: number; candle: boolean }, e: number, walking: boolean): void {
  const swing = walking ? Math.sin(gait) : 0;
  // The arms: behind his back holding the program; on the exit the right one goes up for the shades, then they swing.
  const glasses = e >= 0 && e < 0.55 ? Math.sin(Math.PI * clamp(e / 0.55, 0, 1)) : 0;
  const jacket = (g: CanvasRenderingContext2D, top: number): void => {
    g.fillStyle = '#2e2f3a';
    ink(g, 2.8);
    g.beginPath();
    g.moveTo(-30, hip + 6);
    g.lineTo(-36, top + 14);
    g.quadraticCurveTo(-36, top, -22, top - 2);
    g.lineTo(22, top - 2);
    g.quadraticCurveTo(36, top, 36, top + 14);
    g.lineTo(30, hip + 6);
    g.closePath();
    g.fill();
    g.stroke();
    // The jacket's vent and seam.
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, top + 8);
    g.lineTo(0, hip + 6);
    g.stroke();
  };
  if (e < 0) {
    // Waiting: hands clasped at the small of the back round a rolled order of service. One cached image,
    // stretched as the shoulders breathe and climb.
    ctx.save();
    ctx.translate(0, hip);
    ctx.scale(1, (hip - sh) / (hip + 232));
    ctx.translate(0, -hip);
    stamp(ctx, 'cousinIdle', 0, 0, -50, -240, 100, 104, (g) => {
      jacket(g, -232);
      limb(g, [{ x: -32, y: -218 }, { x: -34, y: -172 }, { x: -6, y: hip - 12 }], 13, '#2e2f3a');
      limb(g, [{ x: 32, y: -218 }, { x: 34, y: -172 }, { x: 6, y: hip - 12 }], 13, '#2e2f3a');
      box(g, -18, hip - 22, 36, 9, 4, '#f3ead6', 1.8);
      blob(g, -5, hip - 12, 7, 6, '#c9a07c', 1.8);
      blob(g, 5, hip - 12, 7, 6, '#c9a07c', 1.8);
    });
    ctx.restore();
  } else {
    jacket(ctx, sh);
    const lh = { x: -36 - swing * 6, y: hip - 6 + Math.abs(swing) * 2 };
    const rh = glasses > 0 ? { x: mix(36, 24, glasses), y: mix(hip - 6, sh - 46, glasses) } : { x: 36 + swing * 6, y: hip - 6 };
    limb(ctx, [{ x: -32, y: sh + 14 }, { x: -38, y: sh + 56 }, lh], 13, '#2e2f3a');
    limb(ctx, [{ x: 32, y: sh + 14 }, { x: mix(40, 46, glasses), y: mix(sh + 56, sh - 4, glasses) }, rh], 13, '#2e2f3a');
    blob(ctx, lh.x, lh.y, 7, 6, '#c9a07c', 1.8);
    blob(ctx, rh.x, rh.y, 7, 6, '#c9a07c', 1.8);
    if (taken.candle) flame(ctx, 26, sh - 16, d.amb, 1.2);
  }
  // Neck and head from behind; a glance at the door turns it.
  const turn = e >= 0 ? 0 : clamp(c.peek.x, -1, 1);
  const hy = sh - 30 + 6 * clamp(c.hunch.x, 0, 1);
  drawBackHead(ctx, 0, hy, { coat: '', hair: '#3a2a24', style: 'short', skin: '#c9a07c' }, turn, 0.1);
  if (shades > 0.05) {
    // The shades' arms over the ears.
    ctx.globalAlpha *= shades;
    ink(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(-19, hy + 1);
    ctx.lineTo(-12, hy - 1);
    ctx.moveTo(19, hy + 1);
    ctx.lineTo(12, hy - 1);
    ctx.stroke();
    ctx.globalAlpha /= shades;
  }
}

function cousinProfile(ctx: CanvasRenderingContext2D, d: CastDrive, sh: number, hip: number, gait: number, shades: number, taken: { sandwiches: number; candle: boolean }, e: number): void {
  // Facing left, toward the table and the door.
  ctx.fillStyle = '#2e2f3a';
  ink(ctx, 2.8);
  ctx.beginPath();
  ctx.moveTo(-18, hip + 6);
  ctx.lineTo(-20, sh + 12);
  ctx.quadraticCurveTo(-18, sh - 2, -2, sh - 4);
  ctx.quadraticCurveTo(18, sh - 2, 20, sh + 12);
  ctx.lineTo(18, hip + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Head in profile: hair, ear, nose, the shades.
  const hy = sh - 30;
  ctx.fillStyle = '#c9a07c';
  ink(ctx, 2.2);
  ctx.fillRect(-7, hy + 12, 14, 14);
  ctx.strokeRect(-7, hy + 12, 14, 14);
  blob(ctx, 0, hy, 18, 19, '#c9a07c', 2.4);
  poly(ctx, [-15, hy - 2, -25, hy + 6, -15, hy + 9], '#c9a07c', 2);
  blob(ctx, 7, hy + 4, 4.5, 6.5, '#c9a07c', 1.8);
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.arc(7.5, hy + 4, 2.4, -1.2, 1.2);
  ctx.stroke();
  ctx.fillStyle = '#3a2a24';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(-16, hy - 8);
  ctx.quadraticCurveTo(-10, hy - 24, 6, hy - 20);
  ctx.quadraticCurveTo(20, hy - 14, 18, hy + 6);
  ctx.quadraticCurveTo(12, hy - 8, 2, hy - 10);
  ctx.quadraticCurveTo(-8, hy - 12, -16, hy - 8);
  ctx.fill();
  ctx.stroke();
  if (shades > 0.05) {
    box(ctx, -18, hy - 6, 14, 8, 3, '#141418', 1.6);
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(-4, hy - 3);
    ctx.lineTo(8, hy - 1);
    ctx.stroke();
  }
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-16, hy + 12);
  ctx.lineTo(-10, hy + 12);
  ctx.stroke();
  // The reaching arm: to the platter twice, then to the candle; the far arm holds what he has.
  const shoulder = { x: -4, y: sh + 14 };
  const world = (p: { x: number; y: number }): Pt => {
    // Convert a world point into this figure's local frame (the scene places us at cousinAt with scale s).
    const at = cousinAt(Math.max(0, e));
    return { x: (p.x - at.x) / at.s, y: (p.y - at.floor) / at.s };
  };
  const [ga, gb, gc] = EXIT_AT.grab;
  let target: Pt = { x: -14 - Math.sin(gait) * 14, y: hip - 6 };
  // At the table the arm goes out and stays out: a dip to the platter for each sandwich, then over to the candle.
  const k = smoothstep(ga - 0.3, ga - 0.08, e) * (1 - smoothstep(gc + 0.1, gc + 0.3, e));
  if (k > 0) {
    const toCandle = smoothstep(gb + 0.05, gc - 0.05, e);
    const platter = world({ x: PLATTER.x, y: PLATTER.y - 4 });
    const candle = world({ x: CANDLE.x, y: CANDLE.y - 10 });
    const dip = (t0: number) => Math.exp(-Math.pow((e - t0) / 0.07, 2)) * 10;
    const goal = { x: mix(platter.x, candle.x, toCandle), y: mix(platter.y, candle.y, toCandle) + dip(ga) + dip(gb) + dip(gc) };
    target = { x: mix(target.x, goal.x, k), y: mix(target.y, goal.y, k) };
  }
  // Far arm first, holding the sandwiches at his chest.
  limb(ctx, [{ x: 4, y: sh + 16 }, { x: -2, y: sh + 60 }, { x: -18, y: sh + 70 }], 12, '#262730');
  for (let i = 0; i < taken.sandwiches; i += 1) poly(ctx, [-30 + i * 9, sh + 74, -18 + i * 9, sh + 74, -24 + i * 9, sh + 60], '#f2dca6', 1.6);
  blob(ctx, -18, sh + 70, 6.5, 6, '#c9a07c', 1.8);
  const end = arm(ctx, shoulder, target, 52, 50, { x: shoulder.x + 40, y: shoulder.y + 70 }, '#2e2f3a', 13, '#c9a07c', '#f2efe8');
  if (taken.candle) {
    box(ctx, end.x - 6, end.y - 22, 12, 20, 2, '#f3ead6', 1.6);
    flame(ctx, end.x, end.y - 22, d.amb, 1.1);
  }
}

/** The YOU tag over the cousin's head (drawn last). */
export function drawYouTag(ctx: CanvasRenderingContext2D, c: Cast, d: CastDrive): void {
  const e = d.exitAge;
  if (e >= EXIT_AT.fade[0]) return;
  const at = cousinAt(Math.max(0, e));
  const hunch = clamp(c.hunch.x, 0, 1);
  const k = Math.max(0.55, at.s);
  const y = at.floor + (-281 - hunch) * at.s - 8 - 8 * k + Math.sin(d.amb * 3) * 2.5;
  ctx.save();
  ctx.translate(at.x, y);
  ctx.scale(k, k);
  box(ctx, -26, -24, 52, 22, 5, '#e8c25a', 2.5);
  poly(ctx, [-8, -2, 0, 8, 8, -2], '#e8c25a', 2.5);
  ctx.fillStyle = '#e8c25a';
  ctx.fillRect(-7, -5, 14, 4);
  ctx.font = `900 15px ${MEME_FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOU', 0, -12.5);
  ctx.restore();
}

/** The mouth position of each speaker this frame, for bubble tails. */
export function mouthOf(who: string, d: CastDrive): Pt {
  switch (who) {
    case 'celebrant':
      return { x: CELEBRANT.x, y: CELEBRANT.y - 54 * CELEBRANT.s };
    case 'mother':
      return { x: SEATS.mother + 10, y: FRONT.floor - 120 * FRONT.s };
    case 'son':
      return { x: SEATS.son - 6, y: FRONT.floor - 128 * FRONT.s };
    case 'friend':
      return { x: SEATS.friend + 12, y: BACK.floor - 124 };
    case 'widow': {
      const p = widowPose(d.ct);
      return p.front ? { x: p.x, y: p.floor - mix(150, 104, p.sit) * p.s - 22 * p.s } : { x: p.x, y: p.floor - 128 * p.s };
    }
    case 'cousin': {
      const at = cousinAt(Math.max(0, d.exitAge));
      return { x: at.x, y: at.floor - 262 * at.s };
    }
    default:
      return { x: 480, y: 300 };
  }
}

