/**
 * The family at the reading. Behind the table, facing us, a seated reaction crowd with a lean spring each at its
 * own rate: the twins (sheepish), Mom (cardigan, the folded eulogy), Dad (blazer, expectations), an empty chair
 * where the nephew should be, and the notary's assistant (face like a closed envelope), who takes the paid leave
 * the moment it is read. At the head, Peterson, standing with the will, one editorializing eyebrow and bifocals.
 * At the wrong table, the nephew in his crypto hoodie with the only chart on screen. At the near end, the player
 * from behind, who accepts item fourteen, is handed the will and walks out with it. Rigs and drawing only.
 */
import { blit, blob, box, ink, INK, label, limb, poly } from './ink';
import { type Joint, solveLimb, walkingFoot } from './kinematics';
import { clamp, mix, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';
import { BEATS, STAMP_GAP, TABLE } from './study';

const ease = (t: number): number => smoothstep(0, 1, t);
const window01 = (t: number, a: number, b: number): number => clamp((t - a) / (b - a), 0, 1);

function hand(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, skin: string): void {
  blob(ctx, x, y, r, r * 0.9, skin, 2);
}

/** A two-bone arm from the shoulder to a hand target: sleeve, cuff and hand at the solved end. */
function arm(ctx: CanvasRenderingContext2D, shoulder: Joint, target: Joint, len: number, pole: number, sleeve: string, width: number, skin: string, handR = 5.5): Joint {
  const { joint, end } = solveLimb(shoulder, target, len, len, pole);
  limb(ctx, [shoulder, joint, end], width, sleeve, 2.5);
  hand(ctx, end.x, end.y, handR, skin);
  return end;
}

/** Eyes with pupils on a look target, a blink, and brows that knit with worry. */
interface Eyes { x: number; y: number; gap: number; r: number; lookX: number; lookY: number; blink: number; brow: number; browTilt?: number; lid?: number; skin: string; heavy?: number }
function eyes(ctx: CanvasRenderingContext2D, e: Eyes): void {
  for (const side of [-1, 1]) {
    const ex = e.x + side * e.gap;
    const open = e.blink > 0 ? 0.08 : 1 - (e.lid ?? 0);
    blob(ctx, ex, e.y, e.r, e.r * 1.05 * open + 0.2, '#fbf8f2', 1.6);
    if (open > 0.3) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + clamp(e.lookX, -1, 1) * e.r * 0.45, e.y + clamp(e.lookY, -1, 1) * e.r * 0.4 * open, e.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if ((e.lid ?? 0) > 0.05 && e.blink <= 0) {
      ctx.fillStyle = e.skin;
      ctx.fillRect(ex - e.r - 1, e.y - e.r * 1.1 - 1, e.r * 2 + 2, e.r * 2.1 * (e.lid ?? 0) + 1);
      ink(ctx, 1.4);
      ctx.beginPath();
      ctx.moveTo(ex - e.r, e.y - e.r * 1.05 + e.r * 2.1 * (e.lid ?? 0));
      ctx.lineTo(ex + e.r, e.y - e.r * 1.05 + e.r * 2.1 * (e.lid ?? 0));
      ctx.stroke();
    }
    // Brows: worry lifts the inner end; `browTilt` is a single editorializing eyebrow.
    const tilt = side > 0 ? e.browTilt ?? 0 : 0;
    ink(ctx, e.heavy ?? 3);
    ctx.beginPath();
    ctx.moveTo(ex - side * e.r * 1.1, e.y - e.r * 1.9 - tilt * 6 + 1);
    ctx.lineTo(ex + side * e.r * 1.1, e.y - e.r * 1.8 + 3 * e.brow - tilt * 9);
    ctx.stroke();
  }
}

function mouth(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, open: number, smile: number): void {
  ctx.fillStyle = '#6a2a30';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(x - w, y - smile * 2);
  ctx.quadraticCurveTo(x, y + 2 * smile + open * 9, x + w, y - smile * 2);
  if (open > 0.08) ctx.quadraticCurveTo(x, y - 1 + open * 2, x - w, y - smile * 2);
  ctx.closePath();
  if (open > 0.08) ctx.fill();
  ctx.stroke();
}

// ---- The seated family ------------------------------------------------------------------------------------

export type SitterKind = 'twinA' | 'twinB' | 'mom' | 'dad' | 'assistant';

export interface Sitter {
  kind: SitterKind;
  x: number;
  s: number;
  seed: number;
  /** Sideways lean toward whatever they attend to, a slump with the tension, the head's lag, a jolt. */
  lean: Spring;
  hunch: Spring;
  nod: Spring;
  jolt: Spring;
  lookX: Spring;
  lookY: Spring;
  brow: Spring;
  blinkIn: number;
  blink: number;
  blinks: number;
  /** Mom's eulogy folded away (0..1); the assistant's leave, seconds since it took effect (−1 seated). */
  fold: Spring;
  leave: number;
}

const SITTERS: readonly [SitterKind, number, number][] = [['twinA', 446, 0.78], ['twinB', 494, 0.78], ['mom', 576, 1], ['dad', 664, 1.05], ['assistant', 830, 0.98]];
/** Each member reacts at their own rate: [lean omega, zeta]. The assistant barely moves. */
const RATE: Record<SitterKind, [number, number]> = { twinA: [9, 0.4], twinB: [8, 0.42], mom: [5, 0.6], dad: [6.5, 0.5], assistant: [2.2, 1] };
export const EMPTY_CHAIR_X = 748;
const SEAT_Y = TABLE.back + 8;

export const createFamily = (): Sitter[] =>
  SITTERS.map(([kind, x, s], i) => ({ kind, x, s, seed: i * 7.3 + 1.1, lean: spring(0), hunch: spring(0), nod: spring(0), jolt: spring(0), lookX: spring(-0.6), lookY: spring(0), brow: spring(0), blinkIn: 1 + i * 0.7, blink: 0, blinks: 0, fold: spring(0), leave: -1 }));

export function resetFamily(f: Sitter[]): void {
  for (const m of f) {
    for (const sp of [m.lean, m.hunch, m.nod, m.jolt, m.brow, m.fold, m.lookY]) settleSpring(sp, 0);
    settleSpring(m.lookX, -0.6);
    m.leave = -1;
  }
}

/** The head's centre, for bubbles, looks and the portrait's glances. */
export function sitterHead(m: Sitter): { x: number; y: number } {
  return { x: m.x + clamp(m.lean.x, -14, 14) * 1.2, y: SEAT_Y - 86 * m.s + 7 * clamp(m.hunch.x, 0, 1) };
}

export interface CastDrive {
  time: number;
  tension: number;
  depth: number;
  running: boolean;
  /** Seconds since the crash, or −1. */
  crash: number;
  /** Who is talking (the newest live bubble) and where their head is. */
  speaker: { who: string; x: number; y: number } | null;
  /** A shared look (the kitchen, Gerald, the freezer) and how long ago it started. */
  attend: { x: number; y: number } | null;
  talk: (who: string) => number;
}

const PETERSON_HEAD = { x: 366, y: 226 };

function lookTarget(m: Sitter, d: CastDrive): { x: number; y: number } {
  if (d.crash >= 0) {
    if (d.crash < BEATS.freezer) return PETERSON_HEAD;
    if (d.crash < BEATS.walls) return { x: 930, y: 250 };
    return { x: m.x + 60 * Math.sin(d.time * 0.7 + m.seed), y: 60 };
  }
  if (d.attend) return d.attend;
  if (d.speaker && d.speaker.who !== m.kind && !(d.speaker.who === 'twins' && m.kind.startsWith('twin'))) return d.speaker;
  return PETERSON_HEAD;
}

export function stepFamily(f: Sitter[], d: CastDrive, dt: number): { left: boolean } {
  let left = false;
  for (const m of f) {
    const [omega, zeta] = RATE[m.kind];
    const head = sitterHead(m);
    const t = lookTarget(m, d);
    const twinGlance = m.kind.startsWith('twin') && Math.sin(d.time * 0.6 + m.seed) > 0.55 ? (m.kind === 'twinA' ? 1 : -1) : null;
    const lx = twinGlance ?? clamp((t.x - head.x) / 170, -1, 1);
    const ly = twinGlance !== null ? 0.6 : clamp((t.y - head.y) / 150, -1, 1);
    stepSpring(m.lookX, lx, 14, 0.85, dt);
    stepSpring(m.lookY, ly, 14, 0.85, dt);
    const toward = clamp((t.x - m.x) / 220, -1, 1) * (m.kind === 'assistant' ? 1.5 : m.kind.startsWith('twin') ? 7 : 11);
    const sway = Math.sin(d.time * (0.5 + 0.1 * m.seed) + m.seed) * (m.kind === 'assistant' ? 0.4 : 1.6);
    stepSpring(m.lean, toward + sway, omega, zeta, dt);
    const slump = d.crash >= 0 ? 1 : d.running ? smoothstep(0.1, 0.9, d.tension) * (m.kind === 'assistant' ? 0.15 : 0.8) + 0.25 * d.depth : 0;
    stepSpring(m.hunch, slump, omega * 0.5, 0.9, dt);
    stepSpring(m.nod, m.lean.x * 0.6, omega * 0.8, 0.45, dt);
    stepSpring(m.jolt, 0, 12, 0.35, dt);
    stepSpring(m.brow, d.crash >= 0 ? 1 : smoothstep(0.05, 0.85, d.tension), 4, 0.9, dt);
    stepSpring(m.fold, m.fold.x > 0.02 || m.fold.v > 0 ? 1 : 0, 5, 0.7, dt);
    m.blink = Math.max(0, m.blink - dt);
    if ((m.blinkIn -= dt) <= 0) {
      m.blinks += 1;
      m.blink = 0.11;
      m.blinkIn = (m.kind === 'assistant' ? 5 : 2.4) + 2.2 * noise(m.seed * 5 + m.blinks);
    }
    if (m.leave >= 0 && m.leave < 99) {
      const before = m.leave;
      m.leave += dt;
      if (before < 0.6 && m.leave >= 0.6) left = true;
    }
  }
  return { left };
}

/** A member's own bequest is read: a jolt of hope (or dread). */
export const jolt = (m: Sitter, k = 1): void => {
  m.jolt.v -= 60 * k;
};

export function settleFamily(f: Sitter[], tension: number, depth: number, multiplier: number, crashed: boolean): void {
  for (const m of f) {
    settleSpring(m.hunch, crashed ? 1 : smoothstep(0.1, 0.9, tension) * (m.kind === 'assistant' ? 0.15 : 0.8) + 0.25 * depth);
    settleSpring(m.brow, crashed ? 1 : smoothstep(0.05, 0.85, tension));
    settleSpring(m.fold, m.kind === 'mom' && multiplier >= 2.4 ? 1 : 0);
    m.leave = m.kind === 'assistant' && multiplier >= 7 ? 99 : -1;
  }
}

const SKIN: Record<SitterKind, string> = { twinA: '#f0c8a8', twinB: '#f0c8a8', mom: '#f3d2bc', dad: '#e6b896', assistant: '#dcbc9e' };
const CLOTH: Record<SitterKind, string> = { twinA: '#d8a83a', twinB: '#d8a83a', mom: '#bf7888', dad: '#2c3a5c', assistant: '#4a4a54' };

function diningChair(ctx: CanvasRenderingContext2D, x: number, s: number): void {
  ctx.save();
  ctx.translate(x, SEAT_Y);
  ctx.scale(s, s);
  for (const side of [-1, 1]) box(ctx, side * 26 - 4, -80, 8, 80, 2, '#4a2414', 2.2);
  box(ctx, -32, -92, 64, 14, 6, '#5a2c18', 2.5);
  blob(ctx, 0, -92, 10, 5, '#6a3420', 2);
  ctx.restore();
}

/** The dining chairs behind the table (they never move), and the empty one where the nephew should be. */
export function drawChairs(ctx: CanvasRenderingContext2D): void {
  blit(ctx, 'chairs', 400, 250, 480, 116, (g) => {
    for (const [, x, s] of SITTERS) diningChair(g, x, s);
    drawEmptyChair(g);
  });
}

function drawEmptyChair(ctx: CanvasRenderingContext2D): void {
  diningChair(ctx, EMPTY_CHAIR_X, 1);
  ctx.save();
  ctx.translate(EMPTY_CHAIR_X, SEAT_Y);
  box(ctx, -24, -62, 48, 42, 3, '#4a2414', 2);
  ctx.strokeStyle = '#6a3a24';
  ctx.lineWidth = 3;
  for (const sx of [-12, 0, 12]) {
    ctx.beginPath();
    ctx.moveTo(sx, -60);
    ctx.lineTo(sx, -22);
    ctx.stroke();
  }
  ctx.restore();
}

/** Where a sitter's hands rest on the table, in the frame. */
function handsOf(m: Sitter, d: CastDrive): [Joint, Joint] {
  const s = m.s;
  const base = { x: m.x, y: SEAT_Y };
  const fidget = Math.sin(d.time * 1.3 + m.seed) * 2;
  // Talking, the hands come up off the table a little, on the beat of the words.
  const talk = d.talk(m.kind.startsWith('twin') ? 'twins' : m.kind);
  const gesture = talk * (6 + 4 * Math.sin(d.time * 7 + m.seed));
  if (m.kind === 'mom') {
    // Holding the eulogy, then the hands go to the cardigan pocket with it.
    const f = clamp(m.fold.x, 0, 1);
    return [{ x: base.x - 16 + 4 * f, y: base.y + 10 - 40 * f - gesture * (1 - f) }, { x: base.x + 16 - 30 * f, y: base.y + 10 - 34 * f - gesture }];
  }
  if (m.kind === 'assistant') {
    const pen = Math.sin(d.time * 7) * 3 * (d.crash < 0 ? 1 : 0);
    return [{ x: base.x - 18, y: base.y + 10 }, { x: base.x + 8 + pen, y: base.y + 8 + Math.abs(pen) * 0.5 }];
  }
  if (m.kind === 'dad') {
    // Clasped, rising a little with hope when his bequest lands.
    const up = clamp(-m.jolt.x / 20, 0, 1) * 10;
    return [{ x: base.x - 10 - gesture * 0.6, y: base.y + 8 - up - gesture }, { x: base.x + 10 + gesture, y: base.y + 8 - up - gesture * 1.4 }];
  }
  // The twins keep their hands under the table's edge, fidgeting.
  return [{ x: base.x - 12 * s + fidget, y: base.y + 4 - gesture * 0.5 }, { x: base.x + 12 * s - fidget, y: base.y + 4 - gesture * 0.5 }];
}

function shouldersOf(m: Sitter): { l: Joint; r: Joint; neck: Joint } {
  const s = m.s;
  const hunch = clamp(m.hunch.x, 0, 1.2);
  const lean = clamp(m.lean.x, -14, 14);
  const lift = m.kind.startsWith('twin') ? 6 : 0;
  const y = SEAT_Y - (58 - 6 * hunch) * s - lift + clamp(m.jolt.x, -14, 8) * 0.6;
  return { l: { x: m.x - 26 * s + lean, y }, r: { x: m.x + 26 * s + lean, y }, neck: { x: m.x + lean * 1.05, y: y - 4 * s } };
}

/** The sitter's body and head, drawn before the table. */
export function drawSitter(ctx: CanvasRenderingContext2D, m: Sitter, d: CastDrive): void {
  if (m.leave >= 0.6) {
    if (m.leave < 99) drawLeaving(ctx, m);
    return;
  }
  const rise = m.leave >= 0 ? ease(m.leave / 0.6) * 40 : 0;
  ctx.save();
  ctx.translate(0, -rise);
  const s = m.s;
  const cloth = CLOTH[m.kind];
  const skin = SKIN[m.kind];
  const { l, r, neck } = shouldersOf(m);
  const breathe = Math.sin(d.time * (1.4 + 0.6 * d.tension) + m.seed) * 1.2;
  // The torso: from the hips (behind the table edge) to the shoulders.
  ctx.fillStyle = cloth;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(m.x - 24 * s, SEAT_Y + 4);
  ctx.quadraticCurveTo(l.x - 4 * s, (l.y + SEAT_Y) / 2, l.x, l.y + 6 * s - breathe);
  ctx.quadraticCurveTo(neck.x, l.y - 6 * s - breathe, r.x, r.y + 6 * s - breathe);
  ctx.quadraticCurveTo(r.x + 4 * s, (r.y + SEAT_Y) / 2, m.x + 24 * s, SEAT_Y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  costume(ctx, m, neck, s);
  // The upper arms hang to the elbows above the table's edge; forearms and hands follow after the table.
  const [hl, hr] = handsOf(m, d);
  for (const [sh, h, pole] of [[l, hl, 1], [r, hr, -1]] as const) {
    const { joint } = solveLimb({ x: sh.x, y: sh.y + 6 * s }, h, 30 * s, 30 * s, pole * 0.8);
    limb(ctx, [{ x: sh.x, y: sh.y + 6 * s }, joint], 13 * s, cloth, 2.5);
  }
  // Neck and head.
  const head = { x: neck.x + clamp(m.nod.x, -8, 8) * 0.4, y: neck.y - 24 * s + 3 * clamp(m.hunch.x, 0, 1) };
  ctx.fillStyle = skin;
  ctx.fillRect(neck.x - 7 * s, neck.y - 12 * s, 14 * s, 14 * s);
  drawHead(ctx, m, head.x, head.y, s, d);
  ctx.restore();
}

function costume(ctx: CanvasRenderingContext2D, m: Sitter, neck: Joint, s: number): void {
  const x = neck.x;
  const y = neck.y + 4 * s;
  if (m.kind === 'dad') {
    // Blazer: shirt V, tie, lapels, brass buttons.
    poly(ctx, [x - 10 * s, y, x + 10 * s, y, x, y + 26 * s], '#f2ede2', 1.5);
    poly(ctx, [x - 3 * s, y + 3 * s, x + 3 * s, y + 3 * s, x + 4 * s, y + 24 * s, x, y + 30 * s, x - 4 * s, y + 24 * s], '#8a2a2a', 1.5);
    ctx.strokeStyle = '#3e4f78';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, y);
    ctx.lineTo(x - 4 * s, y + 34 * s);
    ctx.moveTo(x + 12 * s, y);
    ctx.lineTo(x + 4 * s, y + 34 * s);
    ctx.stroke();
    blob(ctx, x - 7 * s, y + 42 * s, 2.5, 2.5, '#d8b04a', 1);
  } else if (m.kind === 'mom') {
    // Cardigan over a blouse, pearls, a pocket.
    poly(ctx, [x - 9 * s, y - 1, x + 9 * s, y - 1, x + 4 * s, y + 30 * s, x - 4 * s, y + 30 * s], '#f2ead8', 1.5);
    ctx.fillStyle = '#f6f2ea';
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.arc(x + i * 3 * s, y + 3 * s + Math.abs(i) * -0.6 + 5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 3; i += 1) blob(ctx, x + 6 * s, y + (14 + i * 9) * s, 1.8, 1.8, '#f2e2c8', 1);
    box(ctx, x - 22 * s, y + 26 * s, 13 * s, 10 * s, 2, '#a86878', 1.5);
  } else if (m.kind === 'assistant') {
    // A grey suit, white shirt, a red wax-seal pin.
    poly(ctx, [x - 8 * s, y, x + 8 * s, y, x, y + 22 * s], '#f4f2ec', 1.5);
    ctx.strokeStyle = '#3a3a42';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, y);
    ctx.lineTo(x - 2 * s, y + 30 * s);
    ctx.moveTo(x + 10 * s, y);
    ctx.lineTo(x + 2 * s, y + 30 * s);
    ctx.stroke();
    blob(ctx, x - 14 * s, y + 12 * s, 3.5, 3.5, '#b82a30', 1.2);
  } else {
    // The twins' matching sweaters: a stripe across the chest.
    ctx.fillStyle = '#6a8ac8';
    ctx.fillRect(x - 22 * s, y + 16 * s, 44 * s, 6 * s);
    blob(ctx, x, y + 1, 9 * s, 4 * s, '#c8962e', 1.5);
  }
}

function drawHead(ctx: CanvasRenderingContext2D, m: Sitter, x: number, y: number, s: number, d: CastDrive): void {
  const skin = SKIN[m.kind];
  const talk = d.talk(m.kind.startsWith('twin') ? 'twins' : m.kind);
  const open = talk * (0.35 + 0.65 * Math.abs(Math.sin(d.time * 13 + m.seed)));
  const brow = clamp(m.brow.x, 0, 1);
  const crash = d.crash >= 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (m.kind === 'assistant') {
    // A face like a closed envelope: a rounded rectangle, a V-shaped hairline for the flap, a seal of a mouth.
    box(ctx, -21, -24, 42, 50, 9, skin, 2.5);
    ctx.fillStyle = '#34302e';
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(-21, -15);
    ctx.lineTo(-21, -22);
    ctx.quadraticCurveTo(-21, -26, -14, -26);
    ctx.lineTo(14, -26);
    ctx.quadraticCurveTo(21, -26, 21, -22);
    ctx.lineTo(21, -15);
    ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const side of [-1, 1]) blob(ctx, side * 22, 2, 4, 6, skin, 2);
    eyes(ctx, { x: 0, y: 4, gap: 9, r: 3, lookX: m.lookX.x, lookY: m.lookY.x, blink: m.blink, brow: 0, skin, heavy: 2 });
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(-7, 16);
    ctx.lineTo(7 + (talk > 0.05 ? 0 : 0), 16 + open * 3);
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Ears, face, then hair by character; the features slide toward where they look, so the head reads as turning.
  const twin = m.kind.startsWith('twin');
  const turn = clamp(m.lookX.x, -1, 1) * 3.5;
  const rx = twin ? 20 : 22;
  const ry = twin ? 22 : 25;
  if (m.kind === 'mom') blob(ctx, 0, -6, 29, 26, '#7a4a30', 2.5);
  for (const side of [-1, 1]) blob(ctx, side * rx, 2, 5, 7, skin, 2);
  blob(ctx, 0, 0, rx, ry, skin, 2.5);
  if (m.kind === 'dad') {
    ctx.fillStyle = '#9a948a';
    for (const side of [-1, 1]) blob(ctx, side * 19, -6, 6, 11, '#9a948a', 2);
    ctx.strokeStyle = '#9a948a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-12, -22);
    ctx.quadraticCurveTo(0, -30, 14, -20);
    ctx.stroke();
  } else if (m.kind === 'mom') {
    ctx.fillStyle = '#7a4a30';
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(-23, -2);
    ctx.quadraticCurveTo(-24, -30, 0, -28);
    ctx.quadraticCurveTo(24, -30, 23, -2);
    ctx.quadraticCurveTo(14, -18, -2, -16);
    ctx.quadraticCurveTo(-14, -14, -23, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const side of [-1, 1]) blob(ctx, side * 22, 10, 2.2, 2.2, '#e8d8a8', 1);
  } else {
    // Twins: identical bowl cuts.
    ctx.fillStyle = '#4a3020';
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(-21, 0);
    ctx.quadraticCurveTo(-24, -26, 0, -25);
    ctx.quadraticCurveTo(24, -26, 21, 0);
    ctx.lineTo(17, -8);
    ctx.lineTo(-17, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(180, 90, 60, 0.5)';
    for (const [fx, fy] of [[-10, 8], [-7, 10], [9, 8], [11, 10]] as const) ctx.fillRect(fx, fy, 1.6, 1.6);
  }
  const eyeY = m.kind === 'dad' ? -3 : -1;
  ctx.translate(turn, 0);
  eyes(ctx, { x: 0, y: eyeY, gap: twin ? 7.5 : 8.5, r: twin ? 4 : 4.6, lookX: m.lookX.x, lookY: m.lookY.x, blink: m.blink, brow: crash ? 1 : brow, skin, heavy: m.kind === 'dad' ? 4.2 : 2.6, lid: crash ? 0 : m.kind.startsWith('twin') ? 0.2 : 0 });
  // The nose.
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(0, eyeY + 2);
  ctx.quadraticCurveTo(m.kind === 'dad' ? 7 : 4, eyeY + 12, -1, eyeY + 13);
  ctx.stroke();
  if (m.kind === 'dad') {
    // A moustache with expectations.
    ctx.fillStyle = '#6a5a4a';
    ink(ctx, 1.6);
    ctx.beginPath();
    ctx.moveTo(-11, 13);
    ctx.quadraticCurveTo(0, 6, 11, 13);
    ctx.quadraticCurveTo(0, 11, -11, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const smile = crash ? -1 : m.kind === 'dad' ? 0.6 - 1.4 * brow : m.kind === 'mom' ? 0.2 - 1.1 * brow : -0.3;
  mouth(ctx, 0, m.kind === 'dad' ? 17 : 14, twin ? 4.5 : 6, clamp(open + (crash ? 0.25 : 0), 0, 1), smile);
  // Grief, genuine: Mom's tears as the estate goes; Dad sweats the rooms.
  if (m.kind === 'mom' && (brow > 0.55 || crash)) {
    const k = crash ? 1 : smoothstep(0.55, 0.9, brow);
    ctx.strokeStyle = 'rgba(130, 190, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, eyeY + 4);
    ctx.lineTo(-10, eyeY + 4 + 12 * k);
    ctx.stroke();
  }
  if (m.kind === 'dad' && brow > 0.5) {
    const u = (d.time * 0.8 + m.seed) % 1;
    blob(ctx, 18, -14 + u * 18, 2, 3, 'rgba(150, 210, 255, 0.85)', 1);
  }
  ctx.restore();
}

/** Forearms, hands and what they hold, drawn after the table so they rest on it. */
export function drawSitterHands(ctx: CanvasRenderingContext2D, m: Sitter, d: CastDrive): void {
  if (m.leave >= 0.25) return;
  const s = m.s;
  const cloth = CLOTH[m.kind];
  const skin = SKIN[m.kind];
  const { l, r } = shouldersOf(m);
  const [hl, hr] = handsOf(m, d);
  if (m.kind.startsWith('twin')) return;
  for (const [sh, h, pole] of [[l, hl, 1], [r, hr, -1]] as const) {
    const root = { x: sh.x, y: sh.y + 6 * s };
    const { joint, end } = solveLimb(root, h, 30 * s, 30 * s, pole * 0.8);
    limb(ctx, [joint, end], 11 * s, cloth, 2.5);
    hand(ctx, end.x, end.y, 5.5 * s, skin);
  }
  if (m.kind === 'mom') {
    // The eulogy: a folded sheet, folded smaller and put away at item five.
    const f = clamp(m.fold.x, 0, 1);
    if (f < 0.95) {
      const px = mix(m.x, m.x - 14, f);
      const py = mix(SEAT_Y + 12, SEAT_Y - 26, f);
      const w = 30 * (1 - 0.6 * f);
      box(ctx, px - w / 2, py - 9 * (1 - 0.5 * f), w, 16 * (1 - 0.5 * f), 1, '#fbf8ee', 1.6);
      if (f < 0.4) label(ctx, 'EULOGY', px, py - 1, 6, '#5a4a6a', 900, w - 4);
    }
  } else if (m.kind === 'assistant') {
    // A folder and a pen, taking notes on everything.
    box(ctx, m.x - 26, SEAT_Y + 4, 34, 12, 2, '#3a5a8a', 1.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hr.x, hr.y);
    ctx.lineTo(hr.x + 6, hr.y - 10);
    ctx.stroke();
  }
}

/** The assistant leaving for the kitchen door: standing, then walking off behind the table. */
function drawLeaving(ctx: CanvasRenderingContext2D, m: Sitter): void {
  const u = window01(m.leave, 0.6, 2.8);
  const x = mix(m.x + 10, 1000, ease(u));
  const bob = Math.abs(Math.sin(u * 18)) * 3;
  const s = m.s;
  ctx.save();
  ctx.translate(x, SEAT_Y - 40 - bob);
  ctx.scale(s, s);
  box(ctx, -18, -60, 36, 64, 8, CLOTH.assistant, 2.5);
  box(ctx, 8, -38, 26, 10, 2, '#3a5a8a', 1.6);
  ctx.translate(0, -84);
  box(ctx, -16, -24, 34, 46, 9, SKIN.assistant, 2.5);
  poly(ctx, [-16, -14, -16, -24, 18, -24, 18, -14, 1, -4], '#34302e', 2.2);
  blob(ctx, 10, 2, 2.6, 2.6, INK, 0);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(6, 14);
  ctx.lineTo(14, 14);
  ctx.stroke();
  ctx.restore();
}

/** The note the assistant leaves at their place. */
export function drawLeaveNote(ctx: CanvasRenderingContext2D, m: Sitter): void {
  if (m.leave < 0.6) return;
  ctx.save();
  ctx.translate(m.x - 26, TABLE.back + 12);
  ctx.rotate(-0.08);
  box(ctx, -12, -7, 26, 14, 1, '#ffe27a', 1.4);
  label(ctx, 'ON LEAVE', 1, 0, 5.5, '#4a3a10', 900, 24);
  ctx.restore();
}

// ---- Peterson ------------------------------------------------------------------------------------------------

export interface Peterson {
  brow: Spring;
  lookX: Spring;
  lookY: Spring;
  /** Seconds since the last page turn. */
  page: number;
  blinkIn: number;
  blink: number;
  sway: Spring;
}

export const PETERSON = { x: 360, y: 438 } as const;
export const createPeterson = (): Peterson => ({ brow: spring(0), lookX: spring(0.2), lookY: spring(0.9), page: 9, blinkIn: 2, blink: 0, sway: spring(0) });
export function resetPeterson(p: Peterson): void {
  settleSpring(p.brow, 0);
  settleSpring(p.lookX, 0.2);
  settleSpring(p.lookY, 0.9);
  p.page = 9;
}
/** He turns a page. */
export const turnPage = (p: Peterson): void => {
  p.page = 0;
  p.brow.v += 3;
};
/** The one eyebrow. */
export const editorialize = (p: Peterson): void => {
  p.brow.v += 9;
};

export interface PetersonDrive extends CastDrive {
  /** Where he glances over the bifocals, or null to read. */
  glance: { x: number; y: number } | null;
  /** Seconds since the accepted exit, or −1: he hands over the will. */
  exit: number;
}

export function stepPeterson(p: Peterson, d: PetersonDrive, dt: number): void {
  p.page += dt;
  const reading = d.glance === null && d.crash < 0;
  const tx = d.glance ? clamp((d.glance.x - PETERSON.x) / 260, -1, 1) : d.crash >= 0 ? 0.6 : 0.35;
  const ty = d.glance ? -0.6 : reading ? 0.9 : -0.2;
  stepSpring(p.lookX, tx, 12, 0.85, dt);
  stepSpring(p.lookY, ty, 12, 0.85, dt);
  stepSpring(p.brow, d.crash >= 0 && d.crash > BEATS.tear ? 0.7 : 0, 6, 0.4, dt);
  stepSpring(p.sway, Math.sin(d.time * 0.8) * 2 + (d.talk('peterson') > 0.2 ? 2 : 0), 4, 0.7, dt);
  p.blink = Math.max(0, p.blink - dt);
  if ((p.blinkIn -= dt) <= 0) {
    p.blink = 0.1;
    p.blinkIn = 2.6 + 2 * noise(d.time);
  }
}

/** What Peterson holds: the will, a COPY after the hand-over, and at the crash the filing and the envelope. */
export function drawPeterson(ctx: CanvasRenderingContext2D, p: Peterson, d: PetersonDrive): void {
  const t = d.time;
  const sway = p.sway.x;
  const c = d.crash;
  const x = PETERSON.x + sway * 0.4;
  const y = PETERSON.y;
  const skin = '#ecc4a4';
  const suit = '#7a5a40';
  const breathe = Math.sin(t * 1.3) * 1.2;
  // Legs, rumpled trousers, shoes.
  for (const side of [-1, 1]) {
    limb(ctx, [{ x: x + side * 9, y: y - 92 }, { x: x + side * 10 + 2, y: y - 46 }, { x: x + side * 11, y: y - 6 }], 15, '#5a4434', 2.5);
    blob(ctx, x + side * 11 + 5, y - 3, 11, 5, '#1d1418', 2);
  }
  // Torso: waistcoat, jacket open, a belly, the tie loosened and askew.
  const sy = y - 176 + breathe * 0.4;
  ctx.fillStyle = suit;
  ink(ctx, 2.8);
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 88);
  ctx.quadraticCurveTo(x - 36, y - 140, x - 26, sy + 4);
  ctx.quadraticCurveTo(x, sy - 8, x + 26, sy + 4);
  ctx.quadraticCurveTo(x + 40, y - 130, x + 32, y - 88);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  poly(ctx, [x - 12, sy + 2, x + 12, sy + 2, x + 16, y - 96, x - 14, y - 96], '#5a4a3a', 2);
  poly(ctx, [x - 7, sy, x + 7, sy, x, sy + 22], '#efe8d8', 1.5);
  poly(ctx, [x - 2, sy + 6, x + 4, sy + 6, x + 8, sy + 44, x + 2, sy + 50, x - 2, sy + 42], '#3a5a7a', 1.5);
  for (let i = 0; i < 3; i += 1) blob(ctx, x - 6, sy + 34 + i * 12, 2, 2, '#c9a14a', 0.8);
  // The will (or the copy) and his hands. Positions in the frame, keyed to the exit and the crash.
  const reach = d.exit >= 0 ? window01(d.exit, 2.2, 2.8) * (1 - window01(d.exit, 3.1, 3.7)) : 0;
  const handedOver = d.exit >= 3.0;
  // At the hand-over he holds the will out in his right hand at chest height; the left drops to his side.
  const will = { x: mix(x + 22, 452, ease(reach)), y: mix(sy + 52, 318, ease(reach)) };
  const setDown = c >= 0 ? ease(window01(c, BEATS.will, BEATS.will + 0.25)) : 0;
  const filing = c >= 0 ? ease(window01(c, BEATS.filing, BEATS.filing + 0.3)) : 0;
  const dab = c >= 0 ? window01(c, BEATS.tear, BEATS.tear + 0.35) * (1 - window01(c, BEATS.tear + 1.3, BEATS.tear + 1.7)) : 0;
  const stampBob = c >= BEATS.stamp && c < BEATS.stamp + 1.1 ? Math.abs(Math.sin(((c - BEATS.stamp) * Math.PI) / STAMP_GAP / 2)) * 6 : 0;
  const shoulderL = { x: x - 24, y: sy + 8 };
  const shoulderR = { x: x + 24, y: sy + 8 };
  const head = { x: x + 4, y: sy - 34 };
  // Left hand: the will's left edge, then at the crash to his side, then the envelope to his eye.
  let left = { x: mix(will.x - 20, x - 30, ease(reach)), y: mix(will.y + 6, y - 100, ease(reach)) };
  let right = { x: will.x + 19 - 14 * ease(reach), y: will.y + 1 };
  if (c >= 0) {
    left = { x: mix(mix(left.x, x - 30, setDown), head.x - 20 + Math.sin(c * 16) * 2 * dab, dab), y: mix(mix(left.y, y - 100, setDown), head.y - 2, dab) };
    right = { x: mix(mix(right.x, 448, setDown * (1 - filing)), x + 40, filing), y: mix(mix(right.y, 368, setDown * (1 - filing)), sy - 30 + stampBob, filing) };
  }
  const page = p.page < 0.45 ? p.page / 0.45 : 1;
  // The document he reads from: the will, held out to the player and let go, then a copy from his pocket;
  // at the crash it goes down on the table (the scene draws it there).
  const emptyHanded = d.exit >= 3.0 && d.exit < 3.6;
  if (setDown < 0.98 && !emptyHanded) {
    const dx = c >= 0 ? mix(will.x, WILL_ON_TABLE.x, setDown) : will.x;
    const dy = c >= 0 ? mix(will.y, WILL_ON_TABLE.y, setDown) : will.y;
    drawDocument(ctx, dx, dy, handedOver ? 'COPY' : 'WILL', page, d.exit >= 0 && !handedOver ? reach : 0);
  }
  arm(ctx, shoulderL, left, 34, 1, suit, 11, skin, 6);
  arm(ctx, shoulderR, right, 34, -1, suit, 11, skin, 6);
  if (filing > 0.05) {
    // The filing, held up: a stapled stack with LIEN tabs; it doubles as the fee schedule.
    ctx.save();
    ctx.translate(right.x, right.y - 8);
    ctx.rotate(0.12);
    box(ctx, -15, -30, 30, 36, 1, '#fbf8ee', 1.8);
    box(ctx, -15, -30, 30, 9, 1, '#d42a36', 1.5);
    label(ctx, c > BEATS.tear ? 'FEES' : 'LIEN', 0, -25.5, 7, '#ffffff', 900, 26);
    ctx.fillStyle = '#8a8a94';
    for (let i = 0; i < 4; i += 1) ctx.fillRect(-11, -16 + i * 5, 22, 1.4);
    ctx.restore();
    hand(ctx, right.x, right.y, 6, skin);
  }
  if (dab > 0.05) {
    // The will's envelope, drying one tear.
    ctx.save();
    ctx.translate(left.x + 8, left.y - 6);
    ctx.rotate(-0.35);
    box(ctx, -18, -10, 36, 20, 1, '#d8a868', 2);
    ctx.strokeStyle = '#8a5e30';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.lineTo(0, 2);
    ctx.lineTo(18, -10);
    ctx.stroke();
    ctx.restore();
    hand(ctx, left.x, left.y, 6, skin);
  }
  drawPetersonHead(ctx, p, d, head.x, head.y);
  // One tear, welling up before the envelope comes up to dry it.
  if (c >= BEATS.tear - 0.7 && c < BEATS.tear + 0.3) {
    const u = clamp((c - BEATS.tear + 0.7) / 0.7, 0, 1);
    blob(ctx, head.x - 9, head.y + 2 + u * 10, 2.2, 3.2, 'rgba(130, 190, 255, 0.95)', 1);
  }
}

/** Where Peterson puts the will (or the copy) down at the crash; it becomes a receipt there. */
export const WILL_ON_TABLE = { x: 432, y: 372 } as const;

export function drawDocument(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, page: number, offer: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12 + 0.3 * offer);
  ctx.scale(1.15, 1.15);
  box(ctx, -18, -26, 36, 46, 2, '#f6efdc', 2);
  box(ctx, -16, -24, 32, 42, 1, '#fbf6ea', 1.2);
  label(ctx, title, 0, -17, 6.5, '#5a2a1a', 900, 28);
  ctx.fillStyle = '#9a8a74';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(-12, -10 + i * 4.5, 24 - (i % 3) * 4, 1.3);
  // A page turning over.
  if (page < 1) {
    const k = Math.cos(page * Math.PI);
    ctx.fillStyle = '#fffaf0';
    ink(ctx, 1.4);
    ctx.beginPath();
    ctx.moveTo(-16, -24);
    ctx.lineTo(-16 + 32 * (k * 0.5 + 0.5), -24 - 6 * Math.sin(page * Math.PI));
    ctx.lineTo(-16 + 32 * (k * 0.5 + 0.5), 18 - 6 * Math.sin(page * Math.PI));
    ctx.lineTo(-16, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPetersonHead(ctx: CanvasRenderingContext2D, p: Peterson, d: PetersonDrive, x: number, y: number): void {
  const skin = '#ecc4a4';
  const talk = d.talk('peterson');
  const open = talk * (0.3 + 0.7 * Math.abs(Math.sin(d.time * 12)));
  ctx.save();
  ctx.translate(x, y);
  // Jowls, ears, the dome with grey tufts.
  for (const side of [-1, 1]) blob(ctx, side * 24, 2, 6, 8, skin, 2);
  ctx.fillStyle = skin;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-23, -8);
  ctx.quadraticCurveTo(-24, -34, 0, -34);
  ctx.quadraticCurveTo(24, -34, 23, -8);
  ctx.quadraticCurveTo(26, 18, 12, 26);
  ctx.quadraticCurveTo(0, 30, -12, 26);
  ctx.quadraticCurveTo(-26, 18, -23, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d8d0c4';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 22, -12, 7, 10, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#d8d0c4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -34);
  ctx.quadraticCurveTo(2, -42, 8, -36);
  ctx.stroke();
  // Eyes behind bifocals: reading below the line, glancing over it.
  const browUp = clamp(p.brow.x, -0.2, 1.4);
  eyes(ctx, { x: 1, y: -6, gap: 9.5, r: 4.2, lookX: p.lookX.x, lookY: p.lookY.x, blink: p.blink, brow: 0, browTilt: browUp + 0.15, skin, heavy: 3.4 });
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.strokeRect(1 + side * 9.5 - 7.5, -12, 15, 12);
    ctx.beginPath();
    ctx.moveTo(1 + side * 9.5 - 7.5, -5);
    ctx.lineTo(1 + side * 9.5 + 7.5, -5);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-1, -7);
  ctx.lineTo(3, -7);
  ctx.stroke();
  // A big nose; the mouth with the smirk of the only person enjoying this.
  blob(ctx, 3, 5, 5.5, 6, '#e4b090', 2);
  const smirk = d.crash >= 0 && d.crash > BEATS.tear + 1.5 ? 1 : 0.5;
  mouth(ctx, 3, 16, 7, open, smirk);
  ctx.restore();
}

// ---- The nephew ----------------------------------------------------------------------------------------------

export const NEPHEW = { x: 236, y: 452 } as const;
export interface Nephew { up: Spring; thumb: number }
export const createNephew = (): Nephew => ({ up: spring(0), thumb: 0 });
export const resetNephew = (n: Nephew): void => {
  settleSpring(n.up, 0);
};
export function stepNephew(n: Nephew, d: CastDrive, dt: number): void {
  stepSpring(n.up, d.crash >= 0 ? 1 : 0, 10, 0.55, dt);
  n.thumb += dt * (1.2 + 2.5 * d.tension) * (d.crash >= 0 ? 0 : 1);
}

/**
 * The nephew on a pouf at the coffee table, in his hoodie and a backwards cap, with the phone tilted so we can
 * see it: the only market data on screen, green until the crash, red in one frame at it. The family never
 * looks at it. Drawn a size up: he is nearer the camera than the table.
 */
export function drawNephew(ctx: CanvasRenderingContext2D, n: Nephew, d: CastDrive, chart: { multiplier: number; elapsed: number }): void {
  const { x, y } = NEPHEW;
  const up = clamp(n.up.x, 0, 1.2);
  const red = d.crash >= 0;
  const skin = '#d9a882';
  const breathe = Math.sin(d.time * 1.1 + 2) * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.12, 1.12);
  // The pouf.
  blob(ctx, 0, 12, 34, 13, '#8a5a3a', 2.5);
  ctx.strokeStyle = '#6a4028';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 10, 24, 6, 0, 0, Math.PI);
  ctx.stroke();
  // The hoodie, slouched; the hood bunched behind the neck; a coin on the chest.
  ctx.fillStyle = '#25252e';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-30, 8);
  ctx.quadraticCurveTo(-34, -30, -24, -52 - breathe);
  ctx.quadraticCurveTo(0, -62 - breathe, 24, -52 - breathe);
  ctx.quadraticCurveTo(34, -30, 30, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  blob(ctx, 0, -56 - breathe, 21, 8, '#30303a', 2.2);
  ctx.strokeStyle = '#d8d8e0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-5, -54);
  ctx.lineTo(-6, -38);
  ctx.moveTo(5, -54);
  ctx.lineTo(6, -38);
  ctx.stroke();
  blob(ctx, -14, -26, 8, 8, '#4ae07a', 1.6);
  label(ctx, '¤', -14, -26, 10, '#123a20', 900);
  // The head: a backwards cap, earbuds, eyes down on the phone; at the crash he looks up and says nothing.
  const hx = -2 + 2 * up;
  const hy = -80 - 4 * up;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(0.1 - 0.12 * up);
  for (const side of [-1, 1]) blob(ctx, side * 21, 3, 5, 7, skin, 2);
  blob(ctx, 0, 0, 21, 23, skin, 2.5);
  // Cap: crown on the head, the brim out the back (our left), a tuft of hair through the strap gap.
  ctx.fillStyle = '#1e1e26';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(-22, -4);
  ctx.quadraticCurveTo(-22, -27, 0, -27);
  ctx.quadraticCurveTo(22, -27, 22, -4);
  ctx.quadraticCurveTo(0, -11, -22, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  poly(ctx, [-20, -10, -36, -8, -34, -2, -18, -4], '#4ae07a', 2);
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.moveTo(-6, -7);
  ctx.lineTo(-2, -2);
  ctx.lineTo(2, -7);
  ctx.lineTo(6, -2);
  ctx.lineTo(9, -7);
  ctx.closePath();
  ctx.fill();
  blob(ctx, -21, 6, 2.4, 2.4, '#f6f6f6', 1);
  blob(ctx, 21, 6, 2.4, 2.4, '#f6f6f6', 1);
  eyes(ctx, { x: 1, y: 2, gap: 8, r: 4.4, lookX: mix(0.5, 0, up), lookY: mix(1, -0.6, up), blink: 0, brow: up, skin, lid: mix(0.45, 0, up), heavy: 2.4 });
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(1, 4);
  ctx.quadraticCurveTo(5, 11, 0, 12);
  ctx.stroke();
  const talk = d.talk('nephew');
  mouth(ctx, 1, 16, 5, talk * (0.3 + 0.7 * Math.abs(Math.sin(d.time * 13))), up > 0.5 ? 0 : 0.25);
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(-1, 21, 4, 3);
  ctx.restore();
  // The phone, held low and out to his right, tilted toward us: thumbs on its sides, never over the screen.
  const px = 18 + 2 * up;
  const py = -26 + 8 * up;
  const scrolling = Math.sin(n.thumb * Math.PI * 2) > 0.6 ? 2 : 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(0.16 - 0.1 * up);
  box(ctx, -18, -30, 36, 60, 6, '#16161c', 2.4);
  ctx.fillStyle = red ? '#fde4e6' : '#e6f8ec';
  ctx.fillRect(-15, -26, 30, 50);
  ctx.strokeStyle = red ? 'rgba(220, 40, 60, 0.18)' : 'rgba(30, 150, 80, 0.16)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-14, -24 + i * 11.5);
    ctx.lineTo(14, -24 + i * 11.5);
    ctx.stroke();
  }
  // The chart: the round so far, wiggling as the ticks come in, ending top right; red and a cliff at the crash.
  ctx.strokeStyle = red ? '#e0202e' : '#18a848';
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const tick = Math.floor(chart.elapsed * 2);
  for (let i = 0; i <= 10; i += 1) {
    const u = i / 10;
    let v = Math.pow(u, 1.7) * 0.82 + 0.07 * (noise(i * 3.1 + tick * 0.37) - 0.5) * (i > 0 && i < 10 ? 1 : 0);
    if (red && i === 10) v = -0.1;
    const cx = -12 + u * 24;
    const cy = 18 - v * 30;
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  label(ctx, red ? '−100%' : `+${Math.round((chart.multiplier - 1) * 100)}%`, 0, -17, 9, red ? '#e0202e' : '#128a3a', 900, 28);
  ctx.restore();
  // Arms from the shoulders to the phone's sides; one thumb scrolls.
  arm(ctx, { x: -22, y: -46 }, { x: px - 18, y: py + 12 }, 24, 1, '#25252e', 11, skin, 5);
  arm(ctx, { x: 22, y: -46 }, { x: px + 17, y: py + 6 - scrolling }, 22, -1, '#25252e', 11, skin, 5);
  // The glow on his face.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = red ? 'rgba(255, 40, 60, 0.2)' : 'rgba(60, 230, 120, 0.13)';
  ctx.beginPath();
  ctx.ellipse(hx + 6, hy + 14, 24, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- The player ------------------------------------------------------------------------------------------------

export const SEAT = { x: 806, y: 472 } as const;
/** The walk: up from the chair, along the table to Peterson, the hand-over, then out toward the hall. */
const WALK = { stand: 0.7, toPeterson: 2.6, handover: 3.4, out: 5.6 } as const;
const FEET_Y = 492;
const HANDOFF_X = 476;

export interface PlayerPose { mode: 'seated' | 'walking' | 'handover' | 'gone'; x: number; y: number; s: number; distance: number; will: boolean; facing: number }

/** The player's place on the walk-out as a pure function of the seconds since the exit was accepted. */
export function playerPose(exit: number): PlayerPose {
  if (exit < 0) return { mode: 'seated', x: SEAT.x, y: SEAT.y, s: 1, distance: 0, will: false, facing: -1 };
  if (exit < WALK.stand) return { mode: 'seated', x: SEAT.x, y: SEAT.y - 40 * ease(exit / WALK.stand), s: 1, distance: 0, will: false, facing: -1 };
  if (exit < WALK.toPeterson) {
    const u = ease(window01(exit, WALK.stand, WALK.toPeterson));
    const x = mix(SEAT.x - 20, HANDOFF_X, u);
    return { mode: 'walking', x, y: FEET_Y, s: 1, distance: SEAT.x - 20 - x, will: false, facing: -1 };
  }
  if (exit < WALK.handover) return { mode: 'handover', x: HANDOFF_X, y: FEET_Y, s: 1, distance: SEAT.x - 20 - HANDOFF_X, will: exit >= 3.0, facing: -1 };
  if (exit < WALK.out) {
    const u = window01(exit, WALK.handover, WALK.out);
    const x = mix(HANDOFF_X, -110, u);
    const y = mix(FEET_Y, 560, u * u);
    return { mode: 'walking', x, y, s: mix(1, 1.32, u), distance: SEAT.x - 20 - HANDOFF_X + (HANDOFF_X - x), will: true, facing: -1 };
  }
  return { mode: 'gone', x: -200, y: 560, s: 1.3, distance: 0, will: true, facing: -1 };
}

const JUMPER = '#2f6464';
const HAIR = '#4a3020';
const PLAYER_SKIN = '#e8b896';

/** The near-end chair, from behind. */
export function drawSeatChair(ctx: CanvasRenderingContext2D, pushed: number): void {
  const x = SEAT.x;
  const y = SEAT.y + 12 * pushed;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(x - 30, y + 10);
  ctx.lineTo(x - 32, y + 64);
  ctx.moveTo(x + 30, y + 10);
  ctx.lineTo(x + 32, y + 64);
  ctx.stroke();
  ctx.strokeStyle = '#4a2414';
  ctx.lineWidth = 5;
  ctx.stroke();
}

export function drawSeatBack(ctx: CanvasRenderingContext2D, pushed: number): void {
  const x = SEAT.x;
  const y = SEAT.y + 12 * pushed;
  box(ctx, x - 38, y - 30, 76, 46, 6, '#5a2c18', 2.5);
  ctx.strokeStyle = '#3a1a0c';
  ctx.lineWidth = 3;
  for (const sx of [-18, 0, 18]) {
    ctx.beginPath();
    ctx.moveTo(x + sx, y - 22);
    ctx.lineTo(x + sx, y + 10);
    ctx.stroke();
  }
  box(ctx, x - 42, y - 38, 84, 12, 5, '#6a3420', 2.5);
}

/** The floating YOU tag. */
export function drawYouTag(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.sin(time * 3) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  box(ctx, -24, -32, 48, 22, 5, '#e8b84a', 2.5);
  poly(ctx, [-8, -10, 0, 0, 8, -10], '#e8b84a', 2.5);
  ctx.fillStyle = '#e8b84a';
  ctx.fillRect(-7, -12, 14, 3);
  ctx.font = '900 15px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText('YOU', 0, -20.5);
  ctx.restore();
}

/** Seated, from behind: shoulders that rise as it gets worse, the head turning a little toward whoever talks. */
export function drawPlayerSeated(ctx: CanvasRenderingContext2D, pose: PlayerPose, d: CastDrive, hunch: number, turn: number): void {
  const x = pose.x;
  const y = pose.y;
  const breathe = Math.sin(d.time * (1.2 + 2 * hunch)) * (1 + 1.5 * hunch);
  const sy = y - 50 - 7 * hunch + breathe * 0.4;
  ctx.fillStyle = JUMPER;
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(x - 46, sy + 16);
  ctx.quadraticCurveTo(x - 48, sy - 6, x - 20, sy - 8);
  ctx.lineTo(x + 20, sy - 8);
  ctx.quadraticCurveTo(x + 48, sy - 6, x + 46, sy + 16);
  ctx.lineTo(x + 42, y + 10);
  ctx.lineTo(x - 42, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, sy);
  ctx.lineTo(x, y + 6);
  ctx.stroke();
  const hy = sy - 26 + 7 * hunch;
  const hx = x + turn * 3;
  ctx.fillStyle = PLAYER_SKIN;
  ctx.fillRect(hx - 9, hy + 12, 18, 14);
  for (const side of [-1, 1]) blob(ctx, hx + side * 24, hy + 3 - side * turn * 1.5, 5, 8, PLAYER_SKIN, 2.2);
  blob(ctx, hx, hy, 24, 26, PLAYER_SKIN, 2.5);
  blob(ctx, hx, hy - 4, 25, 23, HAIR, 2.5);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hx + 2, hy - 8, 10, 0.4, 2.2);
  ctx.stroke();
}

/** Standing and walking, in profile facing left, with legs on a distance-driven gait and the will under the arm. */
export function drawPlayerWalking(ctx: CanvasRenderingContext2D, pose: PlayerPose, exit: number): void {
  const s = pose.s;
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.scale(s, s);
  const walking = pose.mode === 'walking';
  const dist = pose.distance;
  const hip = { x: 0, y: -100 + (walking ? Math.abs(Math.sin((dist / 70) * Math.PI)) * -3 : 0) };
  // Legs: two-bone IK to feet from the gait (planted soles, no skating); the face is to the left.
  for (const [offset, shade] of [[0.5, '#1f2a3a'], [0, '#2a3a4e']] as const) {
    const f = walking ? walkingFoot(dist, 70, offset, 14) : { x: offset ? 6 : -6, y: 0 };
    const foot = { x: -f.x, y: f.y };
    const { joint, end } = solveLimb({ x: hip.x, y: hip.y + 6 }, foot, 50, 50, 1);
    limb(ctx, [{ x: hip.x, y: hip.y + 6 }, joint, end], 14, shade, 2.5);
    blob(ctx, end.x - 6, end.y - 2, 10, 5, INK, 1.5);
  }
  // Torso and head in profile.
  box(ctx, -18, hip.y - 82, 36, 88, 10, JUMPER, 2.5);
  const reach = pose.mode === 'handover' ? window01(exit, WALK.toPeterson, 3.0) * (1 - window01(exit, 3.0, WALK.handover)) : 0;
  const swing = walking ? Math.sin((dist / 70) * Math.PI * 2) * 12 : 0;
  const shoulder = { x: -2, y: hip.y - 74 };
  const handTarget = pose.will ? { x: 8, y: hip.y - 36 } : reach > 0 ? { x: mix(-14, -30, reach), y: mix(hip.y - 22, hip.y - 72, reach) } : { x: -4 - swing, y: hip.y - 16 };
  if (pose.will) {
    // The will, under the arm.
    ctx.save();
    ctx.translate(4, hip.y - 44);
    ctx.rotate(-0.25);
    box(ctx, -20, -6, 40, 12, 3, '#f6efdc', 2);
    label(ctx, 'WILL', 0, 0.5, 6.5, '#5a2a1a', 900, 30);
    ctx.restore();
  }
  arm(ctx, shoulder, handTarget, 34, pose.will ? -1 : 1, JUMPER, 12, PLAYER_SKIN, 6);
  ctx.save();
  ctx.translate(-2, hip.y - 104);
  blob(ctx, 0, 0, 22, 24, PLAYER_SKIN, 2.5);
  poly(ctx, [-20, -4, -30, 4, -20, 8], PLAYER_SKIN, 2);
  ctx.fillStyle = HAIR;
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(-18, -10);
  ctx.quadraticCurveTo(-10, -30, 14, -22);
  ctx.quadraticCurveTo(26, -10, 18, 14);
  ctx.quadraticCurveTo(8, 2, 6, -6);
  ctx.quadraticCurveTo(-6, -12, -18, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  blob(ctx, 6, 2, 4, 6, PLAYER_SKIN, 1.8);
  eyes(ctx, { x: -12, y: -4, gap: 0.01, r: 3.4, lookX: -0.8, lookY: reach > 0 ? -0.6 : 0, blink: 0, brow: 0.2, skin: PLAYER_SKIN, heavy: 2.2 });
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.moveTo(-16, 12);
  ctx.lineTo(-9, 12);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** In the hall, from behind, will under the arm, looking back at the study through the door. */
export function drawPlayerInHall(ctx: CanvasRenderingContext2D, time: number): void {
  const x = 790;
  const y = 560;
  const breathe = Math.sin(time * 1.4) * 1.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.5, 1.5);
  ctx.fillStyle = JUMPER;
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-50, 0);
  ctx.lineTo(-48, -90 - breathe);
  ctx.quadraticCurveTo(-46, -112, -18, -114 - breathe);
  ctx.lineTo(18, -114 - breathe);
  ctx.quadraticCurveTo(46, -112, 48, -90 - breathe);
  ctx.lineTo(50, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The will, rolled under the right arm.
  ctx.save();
  ctx.translate(44, -64);
  ctx.rotate(-0.35);
  box(ctx, -30, -7, 60, 14, 6, '#f6efdc', 2.2);
  label(ctx, 'WILL', 0, 0.5, 8, '#5a2a1a', 900, 40);
  ctx.restore();
  ctx.fillStyle = PLAYER_SKIN;
  ctx.fillRect(-9, -128, 18, 16);
  blob(ctx, -24, -140, 5, 8, PLAYER_SKIN, 2.2);
  blob(ctx, 24, -142, 5, 8, PLAYER_SKIN, 2.2);
  blob(ctx, 0, -144, 24, 26, PLAYER_SKIN, 2.5);
  blob(ctx, 2, -148, 25, 23, HAIR, 2.5);
  ctx.restore();
}
