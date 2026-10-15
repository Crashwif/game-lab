/**
 * The people of the hearing. Five senators facing us over the dais in seniority order, each with a face, an
 * angle and a prop: Chairman Marcus with his chain of office and gavel, Senator Vance with his bill and his phone
 * to the family office, Senator Ruiz with the one white paper, Senator Howe asleep until he objects, Senator Bell
 * with her hardware wallet. The witness from behind, a hoodie whose hood is only shadow (no face is ever drawn).
 * The stenographer at her typewriter in profile, the sergeant at arms with his watch, and the page who runs in
 * and out with a card that keeps getting longer. Rigs and drawing only; nothing here reads or changes the outcome.
 */
import { BLOCK, drawSprite } from './room';
import { blob, box, CRASH, daisTop, ink, INK, label, limb, PAGE_FEET, PAGE_STOPS, poly, SEAT_X, seatScale, SERGEANT, STENO, TYPEWRITER, WITNESS } from './ink';
import { solveLimb, walkingFoot } from './kinematics';
import { clamp, mix, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';
import type { Beat, Who } from './lines';

type Pt = { x: number; y: number };
const ease = (t: number): number => smoothstep(0, 1, t);

// ─── The senators ───────────────────────────────────────────────────────────────────────────────────────

export type SenatorName = 'marcus' | 'vance' | 'ruiz' | 'howe' | 'bell';

interface Look { skin: string; suit: string; shirt: string; tie: string | null; hair: string; lip: string }
const LOOKS: Record<SenatorName, Look> = {
  marcus: { skin: '#efc9aa', suit: '#3a3d4c', shirt: '#f4f1ea', tie: '#7a1f2c', hair: '#f4f4f0', lip: '#8a3a3a' },
  vance: { skin: '#dd9c6c', suit: '#1f2c58', shirt: '#cfe2f5', tie: '#ec6f92', hair: '#c9ced6', lip: '#7a2f2a' },
  ruiz: { skin: '#c48a5f', suit: '#1d7c78', shirt: '#f4f1ea', tie: null, hair: '#2a1a14', lip: '#b02a4a' },
  howe: { skin: '#f2b49c', suit: '#6e4a2c', shirt: '#f4f1ea', tie: '#c0283a', hair: '#8f8070', lip: '#9a4040' },
  bell: { skin: '#f4d3be', suit: '#7c3a72', shirt: '#f7e9f0', tie: null, hair: '#f0cf72', lip: '#c8285a' },
};

export interface Senator {
  who: SenatorName;
  x: number;
  s: number;
  seed: number;
  /** The gaze, eased toward whoever is talking. */
  look: Pt;
  /** A nod kicked by lines; the forward lean that follows the tension; the prop raised on its beat. */
  take: Spring;
  lean: Spring;
  raise: Spring;
  propT: number;
  /** A hand up for a position; Howe's eyes; the phone out; Vance turned to the gallery. */
  hand: Spring;
  handT: number;
  wake: Spring;
  wakeT: number;
  phone: Spring;
  turn: Spring;
  turnT: number;
  /** The Chairman's gavel: seconds since it was last brought down. */
  gavelT: number;
  blink: number;
  blinkIn: number;
  blinks: number;
  /** Howe's phone, face down on the bench, buzzing. */
  buzz: number;
}

const senator = (who: SenatorName, i: number): Senator => {
  const x = SEAT_X[who];
  return {
    who, x, s: seatScale(x), seed: i * 3.7 + 1.3, look: { x: 0, y: 1 },
    take: spring(0), lean: spring(0), raise: spring(0), propT: 9, hand: spring(0), handT: 9, wake: spring(0), wakeT: 9,
    phone: spring(0), turn: spring(0), turnT: 9, gavelT: 9, blink: 0, blinkIn: 1.5 + i * 0.7, blinks: 0, buzz: 0,
  };
};
export const createSenators = (): Senator[] => (['marcus', 'vance', 'ruiz', 'howe', 'bell'] as const).map(senator);
export function resetSenators(all: Senator[]): void {
  all.forEach((sen, i) => Object.assign(sen, senator(sen.who, i)));
}

/** Where each senator's shoulders sit: the bench top is 40 units below. */
export const shoulderOf = (sen: Pick<Senator, 'x' | 's'>): Pt => ({ x: sen.x, y: daisTop(sen.x) - 40 * sen.s });
/** The senator's head centre, for bubble tails and gazes. */
export function headOf(sen: Senator): Pt {
  const sh = shoulderOf(sen);
  const lean = clamp(sen.lean.x, 0, 1.2);
  const asleep = sen.who === 'howe' ? 1 - clamp(sen.wake.x, 0, 1) : 0;
  return { x: sen.x, y: sh.y + (-46 + 4 * lean + 6 * asleep) * sen.s };
}
export const headTopOf = (sen: Senator): number => headOf(sen).y - (sen.who === 'bell' ? 56 : 42) * sen.s;

export interface DaisDrive {
  time: number;
  tension: number;
  multiplier: number;
  running: boolean;
  crashed: boolean;
  /** Seconds into the crash on the scene's crash clock (0 before it). */
  crashT: number;
  /** How hard each speaker is talking right now, 0..1. */
  talk: (who: Who) => number;
  /** Where the newest live speaker is, for the gazes; null when nobody is. */
  focus: Pt | null;
}
export interface DaisEvents { gavel: boolean; miss: boolean; buzz: boolean }

/** A prop or gesture beat from a line the scene just heard said. */
export function cueSenator(all: Senator[], who: Who, beat: Beat | undefined): void {
  for (const sen of all) {
    if (sen.who === who) sen.take.v += 3;
    else sen.take.v += 0.6;
  }
  const sen = all.find((x) => x.who === who);
  if (!sen) return;
  if (beat === 'gavel') sen.gavelT = 0;
  if (beat === 'paper' || beat === 'wallet' || beat === 'bill') sen.propT = 0;
  if (beat === 'hand') sen.handT = 0;
  if (beat === 'wake') sen.wakeT = 0;
  if (beat === 'boat') {
    sen.turnT = 0;
    sen.propT = 0;
  }
}
/** The crash: the Chairman's gavel goes up for the last line. */
export const raiseLastGavel = (all: Senator[]): void => {
  const marcus = all[0]!;
  marcus.gavelT = -1;
};

const phoneAt: Record<SenatorName, number> = { marcus: 0.62, vance: 0.5, ruiz: 9, howe: 9, bell: 0.82 };

export function stepSenators(all: Senator[], d: DaisDrive, dt: number): DaisEvents {
  const ev: DaisEvents = { gavel: false, miss: false, buzz: false };
  for (const sen of all) {
    const live = d.running && !d.crashed;
    const before = sen.gavelT;
    if (sen.gavelT >= 0) sen.gavelT += dt;
    if (before < 0.3 && sen.gavelT >= 0.3) ev.gavel = true;
    sen.propT += dt;
    sen.handT += dt;
    sen.wakeT += dt;
    sen.turnT += dt;
    const talk = d.talk(sen.who);
    stepSpring(sen.take, 0, 13, 0.35, dt);
    stepSpring(sen.lean, live ? smoothstep(0, 0.9, d.tension) : d.crashed ? 0.4 : 0, 2.2 + sen.seed * 0.1, 0.9, dt);
    const raised = (sen.propT < 2.4 || (talk > 0.2 && sen.propT < 6)) && hasProp(sen, d.multiplier);
    stepSpring(sen.raise, raised ? 1 : 0, 9, 0.55, dt);
    stepSpring(sen.hand, sen.handT < 1.4 ? 1 : 0, 11, 0.5, dt);
    const awake = sen.who === 'howe' ? (sen.wakeT < 2.2 || talk > 0.05 ? 1 : 0) : 1;
    stepSpring(sen.wake, awake, awake ? 16 : 3, awake ? 0.45 : 1, dt);
    stepSpring(sen.phone, (live && d.tension >= phoneAt[sen.who]) || (d.crashed && sen.who === 'bell' && d.multiplier >= 5.5) ? 1 : 0, 6, 0.7, dt);
    stepSpring(sen.turn, sen.turnT < 3.2 ? 1 : 0, 6, 0.8, dt);
    sen.buzz = Math.max(0, sen.buzz - dt);
    // Gaze: whoever is talking, else the witness; the crash pulls every eye to the hood.
    const target = d.focus ?? { x: 480, y: 400 };
    const head = headOf(sen);
    const lx = clamp((target.x - head.x) / 90, -1, 1);
    const ly = clamp((target.y - head.y) / 120, -1, 1);
    const k = 1 - Math.exp(-8 * dt);
    sen.look.x += (lx - sen.look.x) * k;
    sen.look.y += (ly - sen.look.y) * k;
    sen.blink = Math.max(0, sen.blink - dt);
    if ((sen.blinkIn -= dt) <= 0) {
      sen.blinks += 1;
      sen.blink = 0.11;
      sen.blinkIn = 2.2 + 2.6 * noise(sen.seed * 7 + sen.blinks);
    }
  }
  // The crash's gavel: up with the last line, down beside the block.
  const marcus = all[0]!;
  if (d.crashed && d.crashT >= CRASH.miss && marcus.gavelT < 0) {
    marcus.gavelT = 0.25;
    ev.miss = true;
  }
  return ev;
}

/** Settles the dais into a round already under way. */
export function settleSenators(all: Senator[], tension: number, multiplier: number, crashed: boolean): void {
  for (const sen of all) {
    settleSpring(sen.lean, crashed ? 0.4 : smoothstep(0, 0.9, tension));
    settleSpring(sen.phone, (tension >= phoneAt[sen.who] && !crashed) || (crashed && sen.who === 'bell' && multiplier >= 5.5) ? 1 : 0);
    settleSpring(sen.wake, sen.who === 'howe' ? 0 : 1);
    sen.propT = sen.handT = sen.wakeT = sen.turnT = 9;
    sen.gavelT = 9;
  }
}
/** Settles the Chairman's missed gavel for a crash met late. */
export function settleMissedGavel(all: Senator[], crashT: number): void {
  const marcus = all[0]!;
  marcus.gavelT = crashT >= CRASH.miss ? 9 : crashT >= CRASH.lastLine ? -1 : 9;
}

function hasProp(sen: Senator, multiplier: number): boolean {
  if (sen.who === 'vance') return multiplier >= 3.8 || sen.turnT < 3.2;
  if (sen.who === 'bell') return multiplier >= 1.55;
  return sen.who === 'ruiz';
}

/** The ink-outlined sleeve from the shoulder through the IK elbow to the hand, and the hand. */
function arm(ctx: CanvasRenderingContext2D, shoulder: Pt, target: Pt, s: number, suit: string, skin: string, pole: number, upper = 30, lower = 30): Pt {
  const solved = solveLimb(shoulder, target, upper * s, lower * s, pole);
  limb(ctx, [shoulder, solved.joint, solved.end], 13 * s, suit);
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath();
  ctx.arc(solved.end.x, solved.end.y, 5.5 * s, 0, Math.PI * 2);
  ctx.fill();
  blob(ctx, solved.end.x, solved.end.y, 7 * s, 6.5 * s, skin, 2);
  return solved.end;
}

/** The senator's suit, shirt, tie or necklace and rank, at the shoulder origin in senator units. */
function paintTorso(ctx: CanvasRenderingContext2D, who: SenatorName, look: Look): void {
  // The torso: the suit, the shirt, the tie or the necklace, and the rank.
  ctx.fillStyle = look.suit;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-50, 50);
  ctx.lineTo(-50, 12);
  ctx.quadraticCurveTo(-48, -6, -26, -9);
  ctx.lineTo(26, -9);
  ctx.quadraticCurveTo(48, -6, 50, 12);
  ctx.lineTo(50, 50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  poly(ctx, [-13, -9, 0, 26, 13, -9], look.shirt, 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, -8);
  ctx.lineTo(-4, 30);
  ctx.moveTo(13, -8);
  ctx.lineTo(4, 30);
  ctx.stroke();
  if (look.tie) {
    poly(ctx, [-4, -6, 4, -6, 2, 0, -2, 0], look.tie, 1.5);
    poly(ctx, [-2, 0, 2, 0, 5, 26, 0, 32, -5, 26], look.tie, 1.5);
  }
  ctx.fillStyle = look.skin;
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.rect(-10, -22, 20, 15);
  ctx.fill();
  ctx.stroke();
  poly(ctx, [-13, -9, 0, 4, 13, -9], look.shirt, 0);
  if (who === 'marcus') {
    // The chain of office and its medallion: the committee's winged ledger.
    ctx.strokeStyle = '#e6c06a';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([3.5, 2.5]);
    ctx.beginPath();
    ctx.moveTo(-30, -6);
    ctx.quadraticCurveTo(-22, 26, 0, 28);
    ctx.quadraticCurveTo(22, 26, 30, -6);
    ctx.stroke();
    ctx.setLineDash([]);
    blob(ctx, 0, 33, 9, 9, '#e6c06a', 2);
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(-4, 30, 8, 6);
    ctx.strokeStyle = '#8a6a20';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, 31);
    ctx.lineTo(-9, 28);
    ctx.moveTo(4, 31);
    ctx.lineTo(9, 28);
    ctx.stroke();
  } else if (who === 'vance') {
    poly(ctx, [-38, 8, -26, 8, -32, 2], '#ec6f92', 1.2);
    ctx.fillStyle = '#e6c06a';
    for (const by of [18, 30]) {
      ctx.beginPath();
      ctx.arc(-17, by, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (who === 'ruiz') {
    ctx.fillStyle = '#fbf6ea';
    ink(ctx, 1);
    ctx.beginPath();
    for (let i = 0; i < 9; i += 1) {
      const a = Math.PI * (0.15 + (i / 8) * 0.7);
      const px = Math.cos(a) * 14;
      const py = -8 + Math.sin(a) * 12;
      ctx.moveTo(px + 2.6, py);
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  } else if (who === 'howe') {
    // A lapel pin: a little oil drop. His state has a refinery.
    ctx.fillStyle = '#1c1420';
    ctx.beginPath();
    ctx.moveTo(-30, 4);
    ctx.quadraticCurveTo(-25, 12, -30, 14);
    ctx.quadraticCurveTo(-35, 12, -30, 4);
    ctx.fill();
  } else if (who === 'bell') {
    blob(ctx, -28, 12, 6, 6, '#e6c06a', 1.5);
    blob(ctx, -28, 12, 3, 3, '#c0283a', 0);
    poly(ctx, [-12, -9, 0, 4, 12, -9, 0, -2], '#f2a7c6', 1.5);
  }
}

/** The senator's body and head: everything above the bench that the dais front does not hide. */
export function drawSenator(ctx: CanvasRenderingContext2D, sen: Senator, d: DaisDrive): void {
  const look = LOOKS[sen.who];
  const sh = shoulderOf(sen);
  const s = sen.s;
  const breath = Math.sin(d.time * (1.5 + 0.1 * sen.seed) + sen.seed) * 1.2;
  const lean = clamp(sen.lean.x, 0, 1.2);
  const take = clamp(sen.take.x, -1.5, 1.5);
  const asleep = sen.who === 'howe' ? 1 - clamp(sen.wake.x, 0, 1) : 0;
  // The torso is the same every frame: a sprite, breathing.
  drawSprite(ctx, `torso-${sen.who}`, sh.x - 56 * s, sh.y + breath * 0.5 - 26 * s, 112 * s, 80 * s, (g) => {
    g.translate(56 * s, 26 * s);
    g.scale(s, s);
    paintTorso(g, sen.who, look);
  });

  // The head, on its own transform: the take nods it, the lean brings it forward, Howe's sleep drops it.
  const head = headOf(sen);
  const sway = Math.sin(d.time * 0.7 + sen.seed * 2) * 1.6;
  const tilt = Math.sin(d.time * 0.5 + sen.seed) * 0.035 + (sen.who === 'howe' ? 0.22 * asleep : 0) + 0.06 * sen.look.x * (1 - asleep);
  ctx.save();
  ctx.translate(head.x + sway + (sen.who === 'vance' ? -6 * clamp(sen.turn.x, 0, 1) : 0), head.y + breath + take * 3 * s);
  ctx.rotate(tilt);
  ctx.scale(s * (1 + 0.04 * lean), s * (1 + 0.04 * lean));
  drawFace(ctx, sen, look, d, asleep);
  ctx.restore();
}

function eyes(ctx: CanvasRenderingContext2D, sen: Senator, y: number, gap: number, rx: number, ry: number, closed: boolean): void {
  if (closed) {
    ink(ctx, 2.2);
    ctx.beginPath();
    for (const ex of [-gap, gap]) {
      ctx.moveTo(ex - rx, y);
      ctx.quadraticCurveTo(ex, y + ry * 0.8, ex + rx, y);
    }
    ctx.stroke();
    return;
  }
  ctx.fillStyle = '#ffffff';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.ellipse(-gap, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.moveTo(gap + rx, y);
  ctx.ellipse(gap, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  const r = Math.min(rx, ry) * 0.48;
  ctx.beginPath();
  for (const ex of [-gap, gap]) {
    const px = ex + sen.look.x * (rx - 2.5);
    const py = y + sen.look.y * (ry - 2.5);
    ctx.moveTo(px + r, py);
    ctx.arc(px, py, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

function brows(ctx: CanvasRenderingContext2D, y: number, gap: number, inner: number, outer: number, width: number, colour = INK): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(side * (gap + 9), y + outer);
    ctx.lineTo(side * (gap - 6), y + inner);
  }
  ctx.stroke();
}

/** A mouth that opens on the line: `open` 0..1, `smile` curls it. */
function mouth(ctx: CanvasRenderingContext2D, y: number, w: number, open: number, smile: number, lip: string, teeth = false): void {
  ctx.fillStyle = '#5a1f2a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-w, y - smile * 3);
  ctx.quadraticCurveTo(0, y + 3 + smile * 4 + open * 12, w, y - smile * 3);
  ctx.quadraticCurveTo(0, y + 1 - open * 1.5, -w, y - smile * 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (teeth) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-w + 3, y - smile * 2.5);
    ctx.quadraticCurveTo(0, y + 2 + smile * 2, w - 3, y - smile * 2.5);
    ctx.quadraticCurveTo(0, y + 1, -w + 3, y - smile * 2.5);
    ctx.fill();
  }
  ctx.strokeStyle = lip;
  ctx.lineWidth = 1;
}

function drawFace(ctx: CanvasRenderingContext2D, sen: Senator, look: Look, d: DaisDrive, asleep: number): void {
  const talk = d.talk(sen.who);
  const flap = talk * (0.35 + 0.65 * Math.abs(Math.sin(d.time * 13 + sen.seed)));
  const blink = sen.blink > 0;
  const t = d.tension;
  // Hair that sits behind the head.
  if (sen.who === 'ruiz') blob(ctx, 0, -2, 36, 38, look.hair, 2.5);
  if (sen.who === 'bell') {
    blob(ctx, 0, -22, 44, 34, look.hair, 2.5);
    blob(ctx, -30, 10, 13, 18, look.hair, 2.5);
    blob(ctx, 30, 10, 13, 18, look.hair, 2.5);
  }
  // Ears and the face; the jowls on the Chairman and Howe.
  ctx.fillStyle = look.skin;
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.ellipse(-28, 2, 7, 10, 0, 0, Math.PI * 2);
  ctx.moveTo(35, 2);
  ctx.ellipse(28, 2, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ink(ctx, 2.5);
  ctx.beginPath();
  if (sen.who === 'marcus' || sen.who === 'howe') {
    const wide = sen.who === 'howe' ? 33 : 29;
    ctx.moveTo(-wide + 2, -14);
    ctx.quadraticCurveTo(-wide + 1, -36, 0, -37);
    ctx.quadraticCurveTo(wide - 1, -36, wide - 2, -14);
    ctx.quadraticCurveTo(wide + 4, 20, 14, 30);
    ctx.quadraticCurveTo(0, 36, -14, 30);
    ctx.quadraticCurveTo(-wide - 4, 20, -wide + 2, -14);
  } else if (sen.who === 'vance') {
    ctx.moveTo(-27, -12);
    ctx.quadraticCurveTo(-27, -36, 0, -37);
    ctx.quadraticCurveTo(27, -36, 27, -12);
    ctx.quadraticCurveTo(27, 22, 10, 31);
    ctx.lineTo(-10, 31);
    ctx.quadraticCurveTo(-27, 22, -27, -12);
  } else ctx.ellipse(0, -2, 26, 32, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cheeks.
  ctx.fillStyle = sen.who === 'howe' ? 'rgba(230, 90, 90, 0.4)' : 'rgba(230, 110, 110, 0.22)';
  ctx.beginPath();
  ctx.ellipse(-17, 10, 7, 4.5, 0, 0, Math.PI * 2);
  ctx.moveTo(24, 10);
  ctx.ellipse(17, 10, 7, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sen.who === 'marcus') {
    // Bald, white tufts over the ears, forehead lines, white brows like hedges, half-moon glasses low on the nose.
    for (const side of [-1, 1]) {
      blob(ctx, side * 27, -14, 9, 8, look.hair, 2);
      blob(ctx, side * 31, -6, 7, 7, look.hair, 2);
    }
    ctx.strokeStyle = 'rgba(120, 70, 50, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      ctx.moveTo(-12, -26 + i * 4);
      ctx.quadraticCurveTo(0, -28 + i * 4, 12, -26 + i * 4);
    }
    ctx.stroke();
    eyes(ctx, sen, -6, 11, 6, blink ? 1 : 5, blink);
    brows(ctx, -15, 11, 2 - 3 * t, -2, 6, '#f4f4f0');
    ink(ctx, 1.2);
    brows(ctx, -15, 11, 2 - 3 * t, -2, 1, '#9a9a90');
    blob(ctx, 0, 6, 6, 7, '#e8b394', 2);
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1.8;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 11, 2, 8, 0, Math.PI);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-3, 3);
    ctx.lineTo(3, 3);
    ctx.stroke();
    mouth(ctx, 19, 10, flap, -0.4, look.lip);
  } else if (sen.who === 'vance') {
    // Swept silver hair with a wave, a sly squint, a grin that widens with the round.
    ctx.fillStyle = look.hair;
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(-28, -8);
    ctx.quadraticCurveTo(-32, -40, -4, -44);
    ctx.quadraticCurveTo(26, -48, 30, -18);
    ctx.quadraticCurveTo(28, -10, 26, -8);
    ctx.quadraticCurveTo(22, -26, 4, -28);
    ctx.quadraticCurveTo(-14, -30, -22, -18);
    ctx.quadraticCurveTo(-25, -12, -28, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(80, 90, 110, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, -32);
    ctx.quadraticCurveTo(0, -42, 20, -30);
    ctx.stroke();
    eyes(ctx, sen, -5, 11, 6, blink ? 1 : 3.4, blink);
    brows(ctx, -13, 11, 0, -3 - 2 * t, 3.5);
    ctx.strokeStyle = 'rgba(120, 60, 30, 0.5)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(-4, 10);
    ctx.lineTo(2, 11);
    ctx.stroke();
    mouth(ctx, 18, 11 + 4 * t, flap * 0.8, 0.6 + 0.6 * t, look.lip, true);
    ctx.strokeStyle = 'rgba(120, 60, 30, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 27);
    ctx.lineTo(0, 30);
    ctx.stroke();
  } else if (sen.who === 'ruiz') {
    // The bob with its fringe, big round glasses, gold earrings, lipstick.
    ctx.fillStyle = look.hair;
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(-30, 4);
    ctx.quadraticCurveTo(-34, -36, 0, -38);
    ctx.quadraticCurveTo(34, -36, 30, 4);
    ctx.quadraticCurveTo(24, -12, 18, -16);
    ctx.lineTo(-20, -16);
    ctx.quadraticCurveTo(-26, -10, -30, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    eyes(ctx, sen, -4, 11, 5, blink ? 1 : 5, blink);
    brows(ctx, -14, 11, -2 - 2 * t, -1, 3);
    ctx.strokeStyle = '#7a4a2a';
    ctx.lineWidth = 2.2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 11, -4, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(2, -4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110, 60, 30, 0.6)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.lineTo(-1, 10);
    ctx.lineTo(3, 10);
    ctx.stroke();
    mouth(ctx, 18, 8, flap, 0.2, look.lip);
    ctx.strokeStyle = look.lip;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 18);
    ctx.quadraticCurveTo(0, 15, 8, 18);
    ctx.stroke();
    for (const side of [-1, 1]) blob(ctx, side * 29, 14, 3, 3, '#e6c06a', 1.2);
  } else if (sen.who === 'howe') {
    // A comb-over, a double chin; asleep, the eyes are shut and the mouth snores; awake, they are very open.
    ctx.strokeStyle = look.hair;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      ctx.moveTo(-28, -16 - i * 4);
      ctx.quadraticCurveTo(-4, -44 - i * 2, 26, -24 - i * 3);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160, 80, 70, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-14, 30);
    ctx.quadraticCurveTo(0, 38, 14, 30);
    ctx.stroke();
    const shut = asleep > 0.5 || blink;
    eyes(ctx, sen, -5, 12, 6 + 2 * (1 - asleep), shut ? 3 : 6.5, shut);
    brows(ctx, -15 - 5 * (1 - asleep), 12, -1, 1, 4);
    blob(ctx, 0, 6, 7, 6, '#ea9e86', 2);
    if (asleep > 0.5) {
      const snore = 0.4 + 0.6 * Math.abs(Math.sin(d.time * 1.6 + sen.seed));
      blob(ctx, 2, 20, 4 + 2 * snore, 3 + 3 * snore, '#5a1f2a', 2);
    } else mouth(ctx, 19, 10, Math.max(flap, 0.3), -0.2, look.lip);
  } else {
    // Bell: the bouffant's fringe, reading glasses on a chain, confused brows, lipstick and earrings.
    ctx.fillStyle = look.hair;
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.quadraticCurveTo(-30, -44, 4, -42);
    ctx.quadraticCurveTo(32, -40, 28, -6);
    ctx.quadraticCurveTo(14, -26, -6, -22);
    ctx.quadraticCurveTo(-20, -18, -28, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160, 120, 40, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-26, -36);
    ctx.quadraticCurveTo(-2, -58, 26, -36);
    ctx.stroke();
    eyes(ctx, sen, -3, 11, 5.5, blink ? 1 : 4.5, blink);
    // One brow up: she is trying.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -12);
    ctx.lineTo(-5, -11);
    ctx.moveTo(5, -15 - 3 * t);
    ctx.lineTo(19, -18 - 3 * t);
    ctx.stroke();
    ctx.strokeStyle = '#8a6a20';
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) ctx.strokeRect(side * 11 - 8, 0, 16, 8);
    ctx.beginPath();
    ctx.moveTo(-19, 4);
    ctx.quadraticCurveTo(-26, 30, -18, 40);
    ctx.moveTo(19, 4);
    ctx.quadraticCurveTo(26, 30, 18, 40);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150, 80, 60, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(-2, 12);
    ctx.stroke();
    mouth(ctx, 19, 8, flap, 0.1, look.lip);
    for (const side of [-1, 1]) blob(ctx, side * 28, 14, 3.5, 3.5, '#f2f2f2', 1.2);
  }
  if (sen.who === 'howe' && asleep > 0.5) {
    // Three z's drifting off his head.
    for (let k = 0; k < 3; k += 1) {
      const p = (d.time * 0.45 + k / 3) % 1;
      // A fixed size per z (a changing font size would re-rasterise its glyph every frame).
      ctx.globalAlpha = (1 - p) * asleep;
      label(ctx, 'z', 26 + p * 22, -36 - p * 40, [11, 15, 19][k]!, '#f4f1ea', 900);
      ctx.globalAlpha = 1;
    }
  }
}

/** A sheet of paper held up in a hand: the white paper, the bill. */
function sheet(ctx: CanvasRenderingContext2D, at: Pt, s: number, angle: number, title: string, body: string, w = 34, h = 44): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  poly(ctx, [-w / 2, -h, w / 2 - 7, -h, w / 2, -h + 7, w / 2, 0, -w / 2, 0], '#ffffff', 2);
  poly(ctx, [w / 2 - 7, -h, w / 2 - 7, -h + 7, w / 2, -h + 7], '#dcd6c8', 1.4);
  label(ctx, title, 0, -h + 8, 5.6, INK, 900, w - 8);
  ctx.fillStyle = '#a8a294';
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) ctx.rect(-w / 2 + 5, -h + 15 + i * 5, w - 12 - (i % 2) * 6, 1.5);
  ctx.fill();
  if (body) label(ctx, body, 0, -10, 6.2, '#b0203a', 900, w - 6);
  ctx.restore();
}

/** A phone in a hand: screen toward us (the Chairman holds it backwards) or toward the holder (the back). */
function handPhone(ctx: CanvasRenderingContext2D, at: Pt, s: number, angle: number, screen: boolean, time: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  box(ctx, -7, -13, 14, 24, 3, '#1a1a20', 1.8);
  if (screen) {
    ctx.fillStyle = '#8fd0ff';
    ctx.fillRect(-5, -10, 10, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, -7 + ((time * 6) % 8), 6, 2);
  } else {
    blob(ctx, -3, -8, 2, 2, '#55555f', 0);
  }
  ctx.restore();
}

/** The arms, the hands and what they hold: drawn over the bench, after the dais front. */
export function drawSenatorDesk(ctx: CanvasRenderingContext2D, sen: Senator, d: DaisDrive): void {
  const look = LOOKS[sen.who];
  const s = sen.s;
  const sh = shoulderOf(sen);
  const breath = Math.sin(d.time * (1.5 + 0.1 * sen.seed) + sen.seed) * 0.6;
  const L = { x: sh.x - 40 * s, y: sh.y + 4 * s + breath };
  const R = { x: sh.x + 40 * s, y: sh.y + 4 * s + breath };
  const bench = daisTop(sen.x) - 4;
  const talk = d.talk(sen.who);
  const gesture = talk * Math.abs(Math.sin(d.time * 4.2 + sen.seed)) * 16 * s;
  const raise = clamp(sen.raise.x, 0, 1.2);
  const hand = clamp(sen.hand.x, 0, 1.2);
  const phone = clamp(sen.phone.x, 0, 1);
  const head = headOf(sen);
  const fidget = Math.sin(d.time * 0.9 + sen.seed * 3) * 3 * s;
  let left: Pt = { x: sh.x - 30 * s, y: bench };
  let right: Pt = { x: sh.x + 30 * s + fidget, y: bench };

  if (sen.who === 'marcus') {
    // The gavel hand: resting by the block, raised, brought down on the block (or, at the end, beside it).
    const g = sen.gavelT;
    const rest = { x: BLOCK.x + 28, y: BLOCK.y - 4 };
    const up = { x: BLOCK.x + 30, y: BLOCK.y - 64 };
    const miss = { x: BLOCK.x + 62, y: BLOCK.y - 2 };
    const strike = d.crashed && d.crashT >= CRASH.miss ? miss : { x: BLOCK.x + 26, y: BLOCK.y - 8 };
    let lift = 0;
    let at: Pt = rest;
    if (g < 0) {
      at = { x: up.x, y: up.y + Math.sin(d.time * 7) * 2 };
      lift = 1;
    } else if (g < 0.22) {
      lift = ease(g / 0.22);
      at = { x: mix(rest.x, up.x, lift), y: mix(rest.y, up.y, lift) };
    } else if (g < 0.3) {
      const u = (g - 0.22) / 0.08;
      lift = 1 - u;
      at = { x: mix(up.x, strike.x, u), y: mix(up.y, strike.y, u * u) };
    } else if (g < 0.7) {
      const u = (g - 0.3) / 0.4;
      at = { x: mix(strike.x, rest.x, ease(u)), y: mix(strike.y, rest.y, ease(u)) - Math.sin(u * Math.PI) * 6 };
      lift = 0;
    } else if (d.crashed && d.crashT >= CRASH.miss) at = miss;
    left = at;
    const end = arm(ctx, L, left, s, look.suit, look.skin, 1);
    // The gavel: the handle from the fist, the head across its end.
    const angle = mix(Math.PI, Math.PI + 1.15, lift);
    const hx = end.x + Math.cos(angle) * 30;
    const hy = end.y + Math.sin(angle) * 30;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = '#7a4a24';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle + Math.PI / 2);
    box(ctx, -15, -8, 30, 16, 5, '#7a4220', 2.4);
    ctx.fillStyle = '#d8b25a';
    ctx.fillRect(-15, -2, 30, 4);
    ctx.restore();
    blob(ctx, end.x, end.y, 7 * s, 6.5 * s, look.skin, 2);
    // The other hand: the phone held out at arm's length, backwards, squinted at.
    right = phone > 0.05 ? { x: mix(right.x, sh.x + 66 * s, phone), y: mix(right.y, sh.y - 18 * s, phone) - gesture * 0.3 } : { x: right.x, y: right.y - gesture };
    if (hand > 0.05) right = { x: mix(right.x, sh.x + 34 * s, hand), y: mix(right.y, head.y - 34 * s, hand) };
    const pend = arm(ctx, R, right, s, look.suit, look.skin, -1, 32, 32);
    if (phone > 0.05 && hand < 0.5) handPhone(ctx, { x: pend.x + 2, y: pend.y - 8 }, s * phone, 0.1, true, d.time);
    return;
  }
  if (sen.who === 'vance') {
    // The bill in his right hand (once drafted), held up on its beat; the phone to the family office in his left.
    const turn = clamp(sen.turn.x, 0, 1);
    const bill = d.multiplier >= 3.8 || turn > 0.05 || sen.propT < 2.4;
    left = bill ? { x: mix(sh.x - 34 * s, sh.x - 44 * s, raise), y: mix(bench - 22 * s, head.y - 10 * s, raise) - gesture * 0.5 } : { x: left.x, y: left.y - gesture };
    if (turn > 0.05) left = { x: mix(left.x, sh.x - 58 * s, turn), y: mix(left.y, sh.y - 6 * s, turn) };
    const lend = arm(ctx, L, left, s, look.suit, look.skin, 1);
    if (bill && turn < 0.5) sheet(ctx, { x: lend.x, y: lend.y - 2 }, s, -0.12, 'A BILL', 'GIVE ME SOME.');
    right = phone > 0.05 ? { x: mix(right.x, head.x + 30 * s, phone), y: mix(right.y, head.y + 4 * s, phone) } : right;
    if (hand > 0.05) right = { x: mix(right.x, sh.x + 36 * s, hand), y: mix(right.y, head.y - 34 * s, hand) };
    const rend = arm(ctx, R, right, s, look.suit, look.skin, -1, 30, 32);
    if (phone > 0.05 && hand < 0.5) handPhone(ctx, { x: rend.x - 2, y: rend.y - 6 }, s, -0.2, false, d.time);
    return;
  }
  if (sen.who === 'ruiz') {
    // The one white paper, always in hand; up beside her head when she brings it up again.
    const shake = raise > 0.5 ? Math.sin(d.time * 16) * 3 : 0;
    left = { x: mix(sh.x - 22 * s, sh.x - 46 * s, raise) + shake, y: mix(bench - 14 * s, head.y + 2 * s, raise) - gesture * 0.4 };
    const lend = arm(ctx, L, left, s, look.suit, look.skin, 1);
    sheet(ctx, { x: lend.x + 2, y: lend.y - 2 }, s * (1 + 0.15 * raise), mix(0.08, -0.18, raise), 'WHITE PAPER', 'p. 9');
    if (hand > 0.05) right = { x: mix(right.x, sh.x + 34 * s, hand), y: mix(right.y, head.y - 34 * s, hand) };
    else {
      // A pen, annotating the margin.
      right = { x: sh.x + 4 * s + Math.sin(d.time * 3.1) * 4, y: bench - 10 * s - gesture };
    }
    const rend = arm(ctx, R, right, s, look.suit, look.skin, -1);
    if (hand < 0.5) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rend.x, rend.y);
      ctx.lineTo(rend.x - 8, rend.y + 8);
      ctx.stroke();
    }
    return;
  }
  if (sen.who === 'howe') {
    // Hands folded on the bench while he sleeps; a fist up when he objects. His phone buzzes face down.
    const wake = clamp(sen.wake.x, 0, 1);
    left = { x: sh.x - 8 * s, y: bench - 2 };
    right = { x: sh.x + 8 * s, y: bench - 3 };
    if (sen.wakeT < 2.2) left = { x: mix(left.x, sh.x - 36 * s, wake), y: mix(left.y, head.y - 24 * s, wake) + Math.sin(d.time * 12) * 3 * wake };
    const px = sh.x + 48 * s + (sen.buzz > 0 ? Math.sin(d.time * 80) * 1.5 : 0);
    ctx.save();
    ctx.translate(px, bench + 1);
    ctx.transform(1, 0, -0.4, 0.45, 0, 0);
    box(ctx, -8, -12, 16, 24, 3, '#1a1a20', 1.6);
    ctx.restore();
    if (sen.buzz > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, bench, 13, -0.6, 0.6);
      ctx.stroke();
    }
    arm(ctx, R, right, s, look.suit, look.skin, -1);
    arm(ctx, L, left, s, look.suit, look.skin, 1);
    return;
  }
  // Bell: the hardware wallet held up to squint at; past 5.5× it goes to her ear, like a phone.
  const wallet = d.multiplier >= 1.55;
  if (wallet) {
    const ear = phone;
    const near = { x: head.x + 16 * s, y: head.y + 22 * s };
    const up = { x: head.x + 40 * s, y: head.y - 18 * s + Math.sin(d.time * 14) * 3 * raise };
    const atEar = { x: head.x + 31 * s, y: head.y + 2 * s };
    right = { x: mix(mix(near.x, up.x, raise), atEar.x, ear), y: mix(mix(near.y, up.y, raise), atEar.y, ear) };
  } else right = { x: right.x, y: right.y - gesture };
  if (hand > 0.05) left = { x: mix(left.x, sh.x - 34 * s, hand), y: mix(left.y, head.y - 34 * s, hand) };
  else left = { x: left.x, y: left.y - gesture };
  arm(ctx, L, left, s, look.suit, look.skin, 1);
  const rend = arm(ctx, R, right, s, look.suit, look.skin, -1, 32, 32);
  if (wallet) {
    ctx.save();
    ctx.translate(rend.x - 2, rend.y - 8 * s);
    ctx.rotate(-0.3);
    box(ctx, -5, -11, 10, 16, 2, '#22222a', 1.6);
    ctx.fillStyle = '#9ad0ff';
    ctx.fillRect(-3, -8, 6, 4);
    box(ctx, -2.5, -15, 5, 4, 1, '#b8b8c0', 1);
    ctx.restore();
  }
}

/** The microphone's wobble for a senator: it nods when they talk. */
export const micWobble = (sen: Senator, d: DaisDrive): number => d.talk(sen.who) * Math.sin(d.time * 9 + sen.seed) * 1.5;

// ─── The witness ────────────────────────────────────────────────────────────────────────────────────────

export interface Witness {
  nod: Spring;
}
export const createWitness = (): Witness => ({ nod: spring(0) });
export function stepWitness(w: Witness, talk: number, said: boolean, dt: number): void {
  if (said) w.nod.v += 2.4;
  stepSpring(w.nod, talk * 0.25, 9, 0.5, dt);
}

const HOODIE = '#4c505d';
const HOODIE_LIGHT = '#626775';
const HOODIE_DARK = '#353843';

/** The silhouette that walks out of the hood at the end: a shadow with no features. */
function drawShadowMan(ctx: CanvasRenderingContext2D, x: number, rise: number, distance: number, alpha: number): void {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const hipY = WITNESS.y - 4 - 40 * rise;
  const shade = '#141019';
  for (const offset of [0, 0.5]) {
    const foot = walkingFoot(distance, 84, offset, 14);
    const hip = { x: x + (offset ? 6 : -6), y: hipY };
    const target = { x: x + foot.x * clamp(distance / 20, 0, 1), y: WITNESS.y + 34 + foot.y };
    const leg = solveLimb(hip, target, 40, 38, 1);
    limb(ctx, [hip, leg.joint, leg.end], 13, shade, 0);
  }
  const sway = Math.sin(distance / 42) * 2;
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(x - 20, hipY + 4);
  ctx.quadraticCurveTo(x - 24, hipY - 56, x - 6 + sway, hipY - 70);
  ctx.lineTo(x + 8 + sway, hipY - 70);
  ctx.quadraticCurveTo(x + 24, hipY - 56, x + 20, hipY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 1 + sway, hipY - 86, 13, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface WitnessDrive {
  time: number;
  tension: number;
  talk: number;
  /** 0 seated in the hoodie … 1 the hoodie empty on the chair; `walk` how far the shadow has gone. */
  leave: number;
  walk: number;
}

/**
 * The witness from behind and a little to the side: the hoodie's back, the elbows on the table, and the hood,
 * whose opening shows only as a crescent of shadow that deepens with the tension. No face is ever drawn.
 */
export function drawWitness(ctx: CanvasRenderingContext2D, w: Witness, d: WitnessDrive): void {
  const breath = Math.sin(d.time * 1.1) * 1.2;
  const out = clamp(d.leave, 0, 1);
  const slump = smoothstep(0.25, 0.85, out);
  const lift = Math.sin(clamp(out / 0.35, 0, 1) * Math.PI) * 9;
  const t = clamp(d.tension, 0, 1);
  // The shadow leaving, behind the hoodie until it is clear of it.
  if (out > 0.15) drawShadowMan(ctx, WITNESS.x + 14 + d.walk, smoothstep(0.15, 0.45, out), d.walk, smoothstep(0.15, 0.4, out));
  ctx.save();
  ctx.translate(0, 6 + breath * (1 - slump) - lift + 8 * slump);
  const sag = 10 * slump;
  // The elbows out on the table: the hoodie's sleeves, ribbed at the cuff where they disappear forward.
  limb(ctx, [{ x: 428, y: 426 + sag }, { x: 402, y: 448 + sag * 0.5 }, { x: 424, y: 436 + sag * 0.5 }], 22, HOODIE);
  limb(ctx, [{ x: 548, y: 426 + sag }, { x: 576, y: 448 + sag * 0.5 }, { x: 552, y: 436 + sag * 0.5 }], 22, HOODIE);
  ctx.strokeStyle = 'rgba(25, 25, 35, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [cx, cy, dir] of [[407, 444, 1], [571, 444, -1]] as const) {
    ctx.moveTo(cx, cy + sag * 0.5);
    ctx.quadraticCurveTo(cx + dir * 7, cy - 9 + sag * 0.5, cx + dir * 4, cy - 14 + sag * 0.5);
  }
  ctx.stroke();
  // The back: shoulders that sag once nobody is inside, raglan seams, light on the window side.
  ctx.fillStyle = HOODIE;
  ink(ctx, 2.8);
  ctx.beginPath();
  ctx.moveTo(410, 512);
  ctx.lineTo(408, 456 + sag);
  ctx.quadraticCurveTo(410, 430 + sag, 434, 422 + sag);
  ctx.quadraticCurveTo(458, 416 + sag, 472, 417 + sag);
  ctx.lineTo(506, 417 + sag);
  ctx.quadraticCurveTo(522, 416 + sag, 544, 422 + sag);
  ctx.quadraticCurveTo(570, 430 + sag, 572, 456 + sag);
  ctx.lineTo(574, 512);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = HOODIE_LIGHT;
  ctx.beginPath();
  ctx.moveTo(416, 454 + sag);
  ctx.quadraticCurveTo(420, 432 + sag, 440, 426 + sag);
  ctx.lineTo(458, 423 + sag);
  ctx.quadraticCurveTo(434, 436 + sag, 422, 470 + sag);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = HOODIE_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(458, 422 + sag);
  ctx.quadraticCurveTo(436, 438 + sag, 420, 466 + sag);
  ctx.moveTo(518, 422 + sag);
  ctx.quadraticCurveTo(542, 438 + sag, 562, 466 + sag);
  ctx.moveTo(486, 444 + sag);
  ctx.quadraticCurveTo(490, 472, 484, 506);
  ctx.stroke();
  const shadeBody = ctx.createLinearGradient(410, 0, 574, 0);
  shadeBody.addColorStop(0, 'rgba(10, 8, 14, 0)');
  shadeBody.addColorStop(1, `rgba(10, 8, 14, ${0.15 + 0.3 * t})`);
  ctx.fillStyle = shadeBody;
  ctx.fillRect(470, 414 + sag, 106, 100);

  // The hood, turned a little toward the dais: a soft point at the crown, a centre seam, and an opening that
  // shows only a crescent of shadow, wider and blacker as the tension rises.
  const nod = clamp(w.nod.x, -0.5, 0.5);
  const hoodH = mix(1, 0.6, slump);
  ctx.save();
  ctx.translate(488, 426 + sag);
  ctx.rotate(0.04 + nod * 0.22 + 0.22 * slump);
  ctx.scale(1 - 0.06 * slump, hoodH);
  ctx.translate(-488, -426);
  const hood = new Path2D();
  hood.moveTo(452, 428);
  hood.bezierCurveTo(438, 408, 436, 376, 448, 356);
  hood.bezierCurveTo(456, 342, 464, 334, 474, 326);
  hood.bezierCurveTo(500, 330, 524, 344, 534, 370);
  hood.bezierCurveTo(542, 390, 540, 412, 532, 428);
  hood.quadraticCurveTo(492, 438, 452, 428);
  hood.closePath();
  ctx.fillStyle = HOODIE;
  ctx.fill(hood);
  ctx.save();
  ctx.clip(hood);
  ctx.fillStyle = HOODIE_LIGHT;
  ctx.beginPath();
  ctx.ellipse(456, 372, 13, 30, 0.3, 0, Math.PI * 2);
  ctx.fill();
  const shade = ctx.createLinearGradient(444, 0, 540, 0);
  shade.addColorStop(0, 'rgba(10, 8, 14, 0)');
  shade.addColorStop(1, `rgba(10, 8, 14, ${0.2 + 0.45 * t + 0.3 * slump})`);
  ctx.fillStyle = shade;
  ctx.fillRect(430, 320, 120, 112);
  ctx.restore();
  ink(ctx, 2.8);
  ctx.stroke(hood);
  // The centre seam, from the point down to the nape, and a crease where the fabric falls.
  ctx.strokeStyle = HOODIE_DARK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(475, 328);
  ctx.bezierCurveTo(462, 352, 460, 392, 472, 430);
  ctx.moveTo(452, 410);
  ctx.quadraticCurveTo(458, 420, 470, 424);
  ctx.stroke();
  // The opening: a thin crescent of dark inside the rim, never a face.
  const open = 2 + 11 * t + 10 * slump;
  ctx.fillStyle = '#07050a';
  ctx.beginPath();
  ctx.moveTo(508, 336);
  ctx.bezierCurveTo(524, 348, 532, 366, 532, 390);
  ctx.quadraticCurveTo(532, 414, 524, 428);
  ctx.quadraticCurveTo(522 - open * 0.8, 412, 522 - open, 388);
  ctx.quadraticCurveTo(520 - open * 0.7, 356, 508, 336);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HOODIE_LIGHT;
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(500, 330);
  ctx.bezierCurveTo(524, 338, 538, 360, 540, 386);
  ctx.quadraticCurveTo(542, 412, 534, 430);
  ctx.lineTo(524, 428);
  ctx.quadraticCurveTo(532, 412, 532, 390);
  ctx.bezierCurveTo(532, 366, 524, 348, 506, 336);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // The collar where the hood meets the shoulders, and the drawstrings at the side.
  ctx.fillStyle = HOODIE_LIGHT;
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(446, 420 + sag);
  ctx.quadraticCurveTo(490, 434 + sag, 536, 420 + sag);
  ctx.lineTo(538, 429 + sag);
  ctx.quadraticCurveTo(490, 444 + sag, 444, 429 + sag);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [dx, len] of [[0, 30], [7, 24]] as const) {
    const sx = 532 + dx;
    const sy = 428 + sag;
    const swing = Math.sin(d.time * 1.3 + dx) * 1.5;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + 3, sy + len * 0.5, sx + 2 + swing, sy + len);
    ctx.stroke();
    ctx.strokeStyle = '#d8d8de';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#b8b8c0';
    ctx.fillRect(sx + swing, sy + len - 1, 4, 6);
  }
  ctx.restore();
}

/** The witness's chair back, in front of him (we are behind him). */
export function drawWitnessChair(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(440, 470);
  ctx.lineTo(436, 540);
  ctx.moveTo(532, 470);
  ctx.lineTo(536, 540);
  ctx.stroke();
  ctx.strokeStyle = '#5e361e';
  ctx.lineWidth = 3;
  ctx.stroke();
  box(ctx, 430, 456, 112, 56, 10, '#6b3e22', 2.8);
  box(ctx, 442, 466, 88, 36, 6, '#7c4a2a', 1.6);
  ctx.fillStyle = 'rgba(255, 220, 170, 0.25)';
  ctx.fillRect(446, 470, 80, 4);
}

// ─── The stenographer ───────────────────────────────────────────────────────────────────────────────────

export interface Steno {
  /** The typing phase, integrated so its rate can rise without a jump; the carriage and the paper. */
  keys: number;
  carriage: number;
  paper: number;
  /** She looks up at the board when a page lands, and at the crash. */
  glance: Spring;
  keyEvent: boolean;
}
export const createSteno = (): Steno => ({ keys: 0, carriage: 0.2, paper: 0.3, glance: spring(0), keyEvent: false });
export function resetSteno(st: Steno): void {
  Object.assign(st, createSteno());
}
export interface StenoDrive { time: number; tension: number; typing: boolean; blank: boolean; crashT: number; crashed: boolean }

export function stepSteno(st: Steno, d: StenoDrive, dt: number): void {
  const rate = d.typing ? 2.2 + 6.5 * d.tension : 0.35;
  const before = Math.floor(st.keys * 2);
  st.keys += dt * rate;
  st.keyEvent = d.typing && Math.floor(st.keys * 2) !== before;
  if (d.typing) {
    st.carriage = (st.carriage + dt * rate * 0.035) % 1;
    st.paper = Math.min(1, st.paper + dt * rate * 0.03);
  }
  stepSpring(st.glance, d.crashed && d.crashT > CRASH.tug ? 1 : 0, 6, 0.8, dt);
}
/** A page went to the board: the paper starts again. */
export const tearPage = (st: Steno): void => {
  st.paper = 0;
  st.carriage = 0;
};

export function drawSteno(ctx: CanvasRenderingContext2D, st: Steno, d: StenoDrive): void {
  const x = STENO.x;
  const hip = { x: x + 14, y: 446 };
  const breath = Math.sin(d.time * 1.4 + 2) * 1;
  const glance = clamp(st.glance.x, 0, 1);
  const shoulder = { x: x + 4 - 2 * glance, y: 392 + breath };
  const headC = { x: x - 4 + 4 * glance, y: 362 + breath - 3 * glance };
  // The chair.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 34, 404);
  ctx.lineTo(x + 34, 482);
  ctx.moveTo(x + 2, 452);
  ctx.lineTo(x + 2, 482);
  ctx.stroke();
  box(ctx, x - 6, 444, 46, 9, 3, '#3a3f4a', 2.2);
  box(ctx, x + 28, 398, 12, 50, 4, '#3a3f4a', 2.2);
  // Legs: a skirt to the knee, shins down.
  limb(ctx, [{ x: hip.x - 4, y: hip.y }, { x: x - 30, y: 448 }, { x: x - 30, y: 486 }], 11, '#2e3446');
  box(ctx, x - 44, 482, 20, 7, 3, '#1c1420', 1.5);
  ctx.fillStyle = '#2e3446';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(hip.x + 14, hip.y + 6);
  ctx.lineTo(x - 36, 456);
  ctx.lineTo(x - 34, 440);
  ctx.lineTo(hip.x + 10, hip.y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Arms to the keys: alternate strokes, quicker with the tension; from 5× the far hand films instead. The far
  // arm goes behind her, the near one in front.
  const k1 = Math.max(0, Math.sin(st.keys * Math.PI * 2));
  const k2 = Math.max(0, Math.sin(st.keys * Math.PI * 2 + Math.PI));
  const keysY = TYPEWRITER.y - 14;
  const aghast = smoothstep(CRASH.tug, CRASH.fall + 0.1, d.crashT) * (d.crashed ? 1 : 0);
  const near = { x: mix(TYPEWRITER.x + 8, x - 10, aghast), y: mix(keysY - 6 * k1, headC.y + 10, aghast) };
  let far: Pt = { x: TYPEWRITER.x - 8, y: keysY - 6 * k2 };
  if (d.blank && !d.crashed) far = { x: x - 44, y: 360 + Math.sin(d.time * 2) * 2 };
  else if (aghast > 0) far = { x: mix(far.x, x - 18, aghast), y: mix(far.y, headC.y + 14, aghast) };
  const farEnd = solveLimb({ x: shoulder.x + 4, y: shoulder.y + 4 }, far, 26, 26, -1);
  limb(ctx, [{ x: shoulder.x + 4, y: shoulder.y + 4 }, farEnd.joint, farEnd.end], 10, '#5f7a50');
  blob(ctx, farEnd.end.x, farEnd.end.y, 5, 5, '#e9c2a0', 1.8);
  if (d.blank && !d.crashed) {
    // Filming vertical, like everyone else.
    box(ctx, farEnd.end.x - 8, farEnd.end.y - 26, 16, 26, 3, '#1a1a20', 1.6);
    ctx.fillStyle = '#9ad0ff';
    ctx.fillRect(farEnd.end.x - 6, farEnd.end.y - 23, 12, 20);
    ctx.fillStyle = '#ff3a4a';
    ctx.beginPath();
    ctx.arc(farEnd.end.x + 3, farEnd.end.y - 20, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The cardigan.
  ctx.fillStyle = '#6f8a5e';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(hip.x + 14, hip.y);
  ctx.quadraticCurveTo(shoulder.x + 22, shoulder.y + 10, shoulder.x + 10, shoulder.y - 4);
  ctx.lineTo(shoulder.x - 10, shoulder.y - 2);
  ctx.quadraticCurveTo(shoulder.x - 18, shoulder.y + 30, hip.x - 16, hip.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The head in profile, facing left; she looks up at the board at the crash.
  ctx.save();
  ctx.translate(headC.x, headC.y);
  ctx.rotate(-0.35 * glance);
  ctx.scale(glance > 0.5 ? -1 : 1, 1);
  blob(ctx, 14, -8, 10, 10, '#5a3a2a', 2.2);
  ctx.strokeStyle = '#e0a020';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(6, -18);
  ctx.lineTo(24, -2);
  ctx.stroke();
  blob(ctx, 0, 0, 16, 17, '#e9c2a0', 2.4);
  poly(ctx, [-14, -4, -21, 4, -14, 6], '#e9c2a0', 2);
  ctx.fillStyle = '#5a3a2a';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(-15, -6);
  ctx.quadraticCurveTo(-12, -20, 4, -18);
  ctx.quadraticCurveTo(16, -16, 16, 2);
  ctx.quadraticCurveTo(8, -6, -15, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#6b5a3a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(-8, -1, 5, 0, Math.PI * 2);
  ctx.moveTo(-3, -1);
  ctx.lineTo(10, -3);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-9 - 2 * glance, -1 - 2 * glance, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 1.8);
  ctx.beginPath();
  if (glance > 0.5) ctx.arc(-11, 9, 3, 0, Math.PI * 2);
  else {
    ctx.moveTo(-14, 10);
    ctx.lineTo(-8, 10);
  }
  ctx.stroke();
  ctx.restore();
  const nearEnd = solveLimb({ x: shoulder.x - 4, y: shoulder.y + 6 }, near, 26, 26, -1);
  limb(ctx, [{ x: shoulder.x - 4, y: shoulder.y + 6 }, nearEnd.joint, nearEnd.end], 10, '#6f8a5e');
  blob(ctx, nearEnd.end.x, nearEnd.end.y, 5, 5, '#e9c2a0', 1.8);
}

// ─── The sergeant at arms ───────────────────────────────────────────────────────────────────────────────

export interface Sergeant {
  /** The watch check: raised wrist, eyes down; the clock to the next one; true the frame he looks. */
  check: Spring;
  checkT: number;
  nextIn: number;
  checked: boolean;
}
export const createSergeant = (): Sergeant => ({ check: spring(0), checkT: 9, nextIn: 3, checked: false });
export function resetSergeant(sg: Sergeant): void {
  Object.assign(sg, createSergeant());
}
/** He checks the watch more often as the tension rises; at high tension, at every exchange. */
export function stepSergeant(sg: Sergeant, tension: number, line: boolean, live: boolean, crashed: boolean, crashT: number, dt: number): void {
  sg.checked = false;
  sg.checkT += dt;
  sg.nextIn -= dt;
  if (!crashed && (sg.nextIn <= 0 || (live && line && tension > 0.72 && sg.checkT > 1.4))) {
    sg.checkT = 0;
    sg.checked = true;
    sg.nextIn = mix(7.5, 2.2, clamp(tension, 0, 1)) * (0.85 + 0.3 * noise(sg.nextIn * 13 + tension));
  }
  const looking = crashed ? (crashT > CRASH.beep - 0.15 && crashT < CRASH.walk + 0.1) || crashT > CRASH.handed + 1.3 : sg.checkT < 1.1;
  stepSpring(sg.check, looking ? 1 : 0, 10, 0.6, dt);
}

/** Where the sergeant walks in the crash: to the clerk's desk for the bouquet, then back toward his spot. */
export function sergeantX(crashT: number): number {
  if (crashT < CRASH.walk) return SERGEANT.x;
  if (crashT < CRASH.walk + 0.45) return mix(SERGEANT.x, 106, ease((crashT - CRASH.walk) / 0.45));
  if (crashT < CRASH.handed + 0.6) return 106;
  return mix(106, SERGEANT.x + 16, ease((crashT - CRASH.handed - 0.6) / 0.6));
}
/** His bouquet hand in the crash: the desk, lifting, out to the page; null when it is not in his hand. */
export function sergeantBouquet(crashT: number): { x: number; y: number } | null {
  if (crashT < CRASH.lift || crashT >= CRASH.handed + 0.1) return null;
  const mid = CRASH.lift + 0.3;
  if (crashT < mid) return { x: mix(150, 132, ease((crashT - CRASH.lift) / 0.3)), y: mix(414, 380, ease((crashT - CRASH.lift) / 0.3)) };
  return { x: mix(132, 184, ease((crashT - mid) / (CRASH.handed - mid))), y: mix(380, 386, ease((crashT - mid) / (CRASH.handed - mid))) };
}

export function drawSergeant(ctx: CanvasRenderingContext2D, sg: Sergeant, time: number, crashT: number, crashed: boolean, beep: boolean): void {
  const x = crashed ? sergeantX(crashT) : SERGEANT.x;
  const back = CRASH.handed + 0.6;
  const moving = crashed && ((crashT > CRASH.walk && crashT < CRASH.walk + 0.45) || (crashT > back && crashT < back + 0.6));
  const walked = !crashed ? 0 : crashT < back ? x - SERGEANT.x : 106 - SERGEANT.x + (106 - x);
  const breath = Math.sin(time * 1.2 + 4) * 1.2;
  const check = clamp(sg.check.x, 0, 1.1);
  const feetY = SERGEANT.y;
  const hipY = feetY - 70;
  // Legs, planted or walking.
  for (const side of [-1, 1]) {
    const hip = { x: x + side * 12, y: hipY };
    const foot = moving ? walkingFoot(walked, 40, side < 0 ? 0 : 0.5, 8) : { x: 0, y: 0 };
    const target = { x: x + side * 14 + foot.x, y: feetY + foot.y };
    const leg = solveLimb(hip, target, 36, 36, 1);
    limb(ctx, [hip, leg.joint, leg.end], 17, '#23262f');
    box(ctx, leg.end.x - 10 + side * 3, leg.end.y - 3, 20, 8, 3, '#141018', 1.8);
  }
  // The torso: a big dark suit, the badge, the shirt and tie.
  const sh = hipY - 76 + breath;
  ctx.fillStyle = '#23262f';
  ink(ctx, 2.6);
  ctx.beginPath();
  ctx.moveTo(x - 30, hipY + 6);
  ctx.lineTo(x - 36, sh + 14);
  ctx.quadraticCurveTo(x - 34, sh - 2, x - 18, sh - 4);
  ctx.lineTo(x + 18, sh - 4);
  ctx.quadraticCurveTo(x + 34, sh - 2, x + 36, sh + 14);
  ctx.lineTo(x + 30, hipY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  poly(ctx, [x - 9, sh - 4, x, sh + 22, x + 9, sh - 4], '#f4f1ea', 1.6);
  poly(ctx, [x - 2.5, sh - 2, x + 2.5, sh - 2, x + 4, sh + 20, x, sh + 26, x - 4, sh + 20], '#141018', 1);
  blob(ctx, x + 18, sh + 18, 5, 6, '#e6c06a', 1.5);
  // The head: crew cut, moustache, the earpiece; he looks down at the watch.
  const headY = sh - 26 + 4 * check;
  ctx.fillStyle = '#e2b593';
  ink(ctx, 2.2);
  ctx.fillRect(x - 7, sh - 12, 14, 10);
  ctx.strokeRect(x - 7, sh - 12, 14, 10);
  blob(ctx, x, headY, 20, 23, '#e2b593', 2.5);
  ctx.fillStyle = '#6a6a70';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.moveTo(x - 20, headY - 6);
  ctx.quadraticCurveTo(x - 20, headY - 26, x, headY - 26);
  ctx.quadraticCurveTo(x + 20, headY - 26, x + 20, headY - 6);
  ctx.quadraticCurveTo(x, headY - 16, x - 20, headY - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f4f1ea';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 20, headY + 2);
  ctx.quadraticCurveTo(x + 26, headY + 16, x + 20, headY + 26);
  ctx.stroke();
  const ly = 2 * check;
  for (const side of [-1, 1]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + side * 8, headY - 3 + ly, 2.4, check > 0.5 ? 1.2 : 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 13, headY - 10);
  ctx.lineTo(x - 3, headY - 8);
  ctx.moveTo(x + 13, headY - 10);
  ctx.lineTo(x + 3, headY - 8);
  ctx.stroke();
  ctx.fillStyle = '#5a5a60';
  ctx.beginPath();
  ctx.moveTo(x - 10, headY + 9);
  ctx.quadraticCurveTo(x, headY + 4, x + 10, headY + 9);
  ctx.quadraticCurveTo(x, headY + 12, x - 10, headY + 9);
  ctx.fill();
  // Arms: hands clasped at the belt; his left wrist comes up to his eyes to read the watch.
  const clasp = { x, y: hipY - 4 };
  const reachBouquet = crashed ? sergeantBouquet(crashT) : null;
  const rightHand = reachBouquet ?? { x: clasp.x - 4, y: clasp.y };
  const leftHand = { x: mix(clasp.x + 4, x + 6, check), y: mix(clasp.y, sh + 6, check) };
  const rEnd = solveLimb({ x: x - 30, y: sh + 4 }, rightHand, 36, 34, 1);
  limb(ctx, [{ x: x - 30, y: sh + 4 }, rEnd.joint, rEnd.end], 15, '#23262f');
  blob(ctx, rEnd.end.x, rEnd.end.y, 7, 7, '#e2b593', 2);
  const lEnd = solveLimb({ x: x + 30, y: sh + 4 }, leftHand, 36, 34, -1);
  limb(ctx, [{ x: x + 30, y: sh + 4 }, lEnd.joint, lEnd.end], 15, '#23262f');
  blob(ctx, lEnd.end.x, lEnd.end.y, 7, 7, '#e2b593', 2);
  // The watch on the left wrist, and its beep at the crash.
  const wx = mix(lEnd.joint.x, lEnd.end.x, 0.78);
  const wy = mix(lEnd.joint.y, lEnd.end.y, 0.78);
  blob(ctx, wx, wy, 5, 5, beep ? '#ff4d6d' : '#e6c06a', 1.8);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(wx + 2.5 * Math.cos(time), wy + 2.5 * Math.sin(time));
  ctx.stroke();
  if (beep) {
    const p = (time * 3) % 1;
    ctx.globalAlpha = 1 - p;
    label(ctx, 'BEEP', wx + 18 + p * 10, wy - 12 - p * 14, 11, '#ff4d6d', 900);
    ctx.globalAlpha = 1;
  }
  // A small brass name tag.
  box(ctx, x - 28, sh + 22, 22, 7, 2, '#d8b25a', 1);
  label(ctx, 'S.A.A.', x - 17, sh + 25.6, 4.5, '#2a1a0c', 900);
}

// ─── The page ───────────────────────────────────────────────────────────────────────────────────────────

export type PageMode = 'off' | 'run' | 'wait';
export interface Page {
  x: number;
  dir: number;
  /** Distance run, for the gait; the target stop and how long he stays there. */
  distance: number;
  mode: PageMode;
  target: number;
  hold: number;
  /** Seconds until the next errand on his own. */
  idle: number;
  errands: number;
  step: boolean;
}
const OFF_X = -46;
export const createPage = (): Page => ({ x: OFF_X, dir: 1, distance: 0, mode: 'off', target: OFF_X, hold: 0, idle: 6, errands: 0, step: false });
export function resetPage(p: Page): void {
  Object.assign(p, createPage());
}
/** Sends the page to a stop; he waits `hold` seconds there, then runs back out. */
export function sendPage(p: Page, stop: number, hold: number): void {
  if (p.mode === 'off') p.x = OFF_X;
  p.mode = 'run';
  p.target = stop;
  p.hold = hold;
}
const STOP_CYCLE = [PAGE_STOPS.chair, PAGE_STOPS.witness, PAGE_STOPS.clerk, PAGE_STOPS.chair, PAGE_STOPS.steno];

export function stepPage(p: Page, tension: number, live: boolean, dt: number): void {
  p.step = false;
  const speed = mix(170, 340, clamp(tension, 0, 1));
  if (p.mode === 'off') {
    p.idle -= dt;
    if (live && p.idle <= 0) {
      p.errands += 1;
      sendPage(p, STOP_CYCLE[p.errands % STOP_CYCLE.length]!, mix(1.6, 0.6, tension));
      p.idle = mix(13, 4, clamp(tension, 0, 1));
    }
    return;
  }
  if (p.mode === 'wait') {
    p.hold -= dt;
    if (p.hold <= 0) {
      p.mode = 'run';
      p.target = OFF_X;
    }
    return;
  }
  const gap = p.target - p.x;
  const move = Math.min(Math.abs(gap), speed * dt);
  if (Math.abs(gap) > 0.5) p.dir = Math.sign(gap);
  const before = Math.floor(p.distance / 18);
  p.x += Math.sign(gap) * move;
  p.distance += move;
  if (Math.floor(p.distance / 18) !== before) p.step = true;
  if (Math.abs(p.target - p.x) < 0.5) {
    p.x = p.target;
    if (p.target === OFF_X) p.mode = 'off';
    else {
      p.mode = 'wait';
      p.dir = p.target > 480 ? -1 : 1;
    }
  }
}

/** The page's crash run: he holds still, comes for the bouquet, then takes the card to the witness table. */
export function pageInCrash(from: number, crashT: number): { x: number; dir: number; distance: number; running: boolean } {
  const start = from <= OFF_X + 1 ? OFF_X : from;
  const seg1 = Math.abs(PAGE_STOPS.clerk - start);
  const arrive = CRASH.pageIn + 0.8;
  const reach = CRASH.toWitness + 0.6;
  if (crashT < CRASH.pageIn) return { x: start, dir: 1, distance: 0, running: false };
  if (crashT < arrive) {
    const u = ease((crashT - CRASH.pageIn) / (arrive - CRASH.pageIn));
    return { x: mix(start, PAGE_STOPS.clerk, u), dir: Math.sign(PAGE_STOPS.clerk - start) || 1, distance: seg1 * u, running: true };
  }
  if (crashT < CRASH.toWitness) return { x: PAGE_STOPS.clerk, dir: -1, distance: seg1, running: false };
  if (crashT < reach) {
    const u = ease((crashT - CRASH.toWitness) / (reach - CRASH.toWitness));
    return { x: mix(PAGE_STOPS.clerk, PAGE_STOPS.witness, u), dir: 1, distance: seg1 + (PAGE_STOPS.witness - PAGE_STOPS.clerk) * u, running: true };
  }
  return { x: PAGE_STOPS.witness, dir: 1, distance: seg1 + PAGE_STOPS.witness - PAGE_STOPS.clerk, running: false };
}

export interface PageLook {
  x: number;
  dir: number;
  distance: number;
  running: boolean;
  /** The card's list, 0 short … 1 very long; the card held out; the bouquet in the other arm. */
  list: number;
  offer: number;
  bouquet: boolean;
}

/** The page in profile: a blazer, a tie, a card whose list keeps getting longer. Returns the free hand. */
export function drawPage(ctx: CanvasRenderingContext2D, look: PageLook, time: number): Pt {
  const s = 0.82;
  const dir = look.dir;
  const run = look.running ? 1 : 0;
  const bob = run ? Math.abs(Math.sin((look.distance / 36) * Math.PI)) * 3 : Math.sin(time * 1.6) * 0.8;
  ctx.save();
  ctx.translate(look.x, PAGE_FEET);
  ctx.scale(s * dir, s);
  const hip = { x: 0, y: -52 - bob };
  // Legs from the gait: planted feet in stance, lifted in swing.
  for (const offset of [0.5, 0]) {
    const foot = run ? walkingFoot(look.distance / s, 44, offset, 12) : { x: offset ? -5 : 5, y: 0 };
    const leg = solveLimb({ x: hip.x + (offset ? -3 : 3), y: hip.y }, { x: foot.x, y: foot.y }, 28, 27, -1);
    limb(ctx, [{ x: hip.x + (offset ? -3 : 3), y: hip.y }, leg.joint, leg.end], 10, offset ? '#565c6a' : '#6a7080');
    box(ctx, leg.end.x - 4, leg.end.y - 4, 14, 6, 2, '#141018', 1.4);
  }
  const lean = run * 0.18;
  ctx.translate(hip.x, hip.y);
  ctx.rotate(lean);
  // The blazer and tie.
  ctx.fillStyle = '#2b3f73';
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(-11, 6);
  ctx.lineTo(-12, -38);
  ctx.quadraticCurveTo(-8, -46, 0, -46);
  ctx.quadraticCurveTo(10, -46, 12, -38);
  ctx.lineTo(12, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  poly(ctx, [4, -45, 12, -45, 9, -30], '#f4f1ea', 1.2);
  poly(ctx, [8, -42, 10, -42, 11, -26, 9, -22, 7, -26], '#c0283a', 1);
  // The head.
  const head = { x: 3, y: -60 };
  blob(ctx, head.x, head.y, 12, 13, '#f0c6a4', 2.2);
  poly(ctx, [head.x + 10, head.y - 2, head.x + 16, head.y + 3, head.x + 10, head.y + 5], '#f0c6a4', 1.8);
  ctx.fillStyle = '#6b3a1d';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(head.x - 12, head.y + 2);
  ctx.quadraticCurveTo(head.x - 14, head.y - 16, head.x + 2, head.y - 14);
  ctx.quadraticCurveTo(head.x + 14, head.y - 14, head.x + 12, head.y - 6);
  ctx.quadraticCurveTo(head.x, head.y - 8, head.x - 6, head.y - 2);
  ctx.quadraticCurveTo(head.x - 8, head.y + 4, head.x - 12, head.y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(head.x + 6, head.y - 2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(head.x + 6, head.y + 7);
  ctx.lineTo(head.x + 10, head.y + 6);
  ctx.stroke();
  // Arms: the back arm swings (or cradles the bouquet), the front arm carries the card out in front.
  const phase = (look.distance / 44) * Math.PI;
  const swing = run ? Math.sin(phase) * 16 : 0;
  const back = look.bouquet ? { x: 8, y: -22 } : { x: -6 - swing, y: -14 };
  const backArm = solveLimb({ x: -2, y: -40 }, back, 20, 19, 1);
  limb(ctx, [{ x: -2, y: -40 }, backArm.joint, backArm.end], 8, '#24365f');
  blob(ctx, backArm.end.x, backArm.end.y, 4.5, 4.5, '#f0c6a4', 1.6);
  const offer = clamp(look.offer, 0, 1);
  const front = { x: mix(14 + swing * 0.4, 30, offer), y: mix(-26, -36, offer) };
  const frontArm = solveLimb({ x: 4, y: -40 }, front, 20, 19, 1);
  limb(ctx, [{ x: 4, y: -40 }, frontArm.joint, frontArm.end], 8, '#2b3f73');
  // The card: its list hangs down longer and longer.
  const cardH = 14 + 50 * clamp(look.list, 0, 1.4);
  ctx.save();
  ctx.translate(frontArm.end.x + 2, frontArm.end.y - 4);
  ctx.rotate(-lean - 0.05 + Math.sin(time * 5) * 0.03 * run);
  ctx.fillStyle = '#ffffff';
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.rect(-2, -4, 16, cardH);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7a7468';
  ctx.beginPath();
  for (let i = 0; i < Math.min(14, Math.floor((cardH - 6) / 4)); i += 1) ctx.rect(1, i * 4, 10 - ((i * 5) % 6), 1.2);
  ctx.fill();
  ctx.restore();
  blob(ctx, frontArm.end.x, frontArm.end.y, 4.5, 4.5, '#f0c6a4', 1.6);
  ctx.restore();
  // The free hand in scene space, for the bouquet.
  const local = backArm.end;
  const c = Math.cos(lean);
  const sn = Math.sin(lean);
  return { x: look.x + dir * s * (hip.x + local.x * c - local.y * sn), y: PAGE_FEET + s * (hip.y + local.x * sn + local.y * c) };
}
