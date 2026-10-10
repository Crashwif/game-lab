/**
 * The public gallery behind the witness, nearest the camera: a row of seats seen from behind, each with a card
 * on its back that reads PUBLIC, then BID as the multiplier climbs, then (at high tension) one chunk of a single
 * wallet address across the whole row, and REKT in one frame at the crash. The gallery fills and empties as the
 * round goes on, half of it filming vertical, and it applauds on cue. The player sits in it, in a PUBLIC seat,
 * and on an accepted exit stands and leaves. After an exit the crash is seen small, from the doorway.
 * Drawing and presentation state only; nothing here reads or changes the outcome.
 */
import { blob, box, CRASH, ink, INK, label, limb, MEME_FONT } from './ink';
import { clamp, fract, mix, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';
import { drawSprite } from './room';

const SEAT_XS = [46, 136, 226, 316, 646, 736, 826, 916] as const;
/** The player's seat: the first on the right of the aisle. */
export const YOUR_SEAT = 4;
const SEAT_TOP = 498;
/** When each seat fills, how fast it turns over, and when its card flips from PUBLIC to BID. */
const FILL = [1, 1.08, 1, 1.25, 1, 1, 1.15, 1.4];
const TURN = [2.6, 3.4, 2.2, 4.1, 99, 2.9, 3.7, 2.4];
const BID = [1.3, 1.65, 2, 2.4, 0, 1.45, 2.9, 3.5];
/** At high tension the row is one wallet address, a chunk a seat (the player's seat keeps its PUBLIC card). */
const ADDRESS = ['0x9F3A', 'C41E', '77B0', 'DE5D', '', 'A11E', 'B1D0', '0FF5'];
export const ADDRESS_AT = 7;
/** The crash turns every screen red and every card REKT on this frame of the crash clock. */
export const REKT_AT = CRASH.gallery;

const HAIR = ['#2b1d16', '#6b4a2a', '#c9a35a', '#1c1420', '#8a3a2a', '#d8d0c0', '#3a2a24', '#a05a2a'];
const COATS = ['#3a4a6a', '#6a3a3a', '#3a5a4a', '#5a4a6a', '#2a2a34', '#7a6a4a', '#4a5a6a', '#6a5a3a'];
const HATS = ['none', 'cap', 'none', 'beanie', 'none', 'none', 'bun', 'none'] as const;

interface Seat {
  x: number;
  /** In the seat (1) or ducked out (0); who sits there now; a jolt kicked by the crash and the applause. */
  rise: Spring;
  who: number;
  kick: Spring;
}
export interface Gallery {
  seats: Seat[];
  /** Seconds of applause left, and the clap's phase. */
  applause: number;
  clap: number;
  /** The player: up out of the seat, and the walk out along the row. */
  stand: Spring;
  clapped: boolean;
}

export const createGallery = (): Gallery => ({
  seats: SEAT_XS.map((x, i) => ({ x, rise: spring(i === YOUR_SEAT || FILL[i]! <= 1 ? 1 : 0), who: i * 7, kick: spring(0) })),
  applause: 0,
  clap: 0,
  stand: spring(0),
  clapped: false,
});
export function resetGallery(g: Gallery): void {
  Object.assign(g, createGallery());
}

/** Who sits in seat `i` at `multiplier`, and whether they are there (a seat turning over is empty a moment). */
function occupant(i: number, multiplier: number): { who: number; here: boolean } {
  if (i === YOUR_SEAT) return { who: 99, here: true };
  if (multiplier < FILL[i]!) return { who: i * 7, here: false };
  const cycle = Math.log(multiplier / FILL[i]!) / Math.log(TURN[i]!);
  return { who: i * 7 + Math.floor(cycle) * 13, here: fract(cycle) < 0.88 };
}

export function applaud(g: Gallery, seconds = 2.6): void {
  g.applause = Math.max(g.applause, seconds);
  for (const seat of g.seats) seat.kick.v += 2;
}

export interface GalleryDrive { multiplier: number; tension: number; crashed: boolean; crashT: number; left: boolean; exitAge: number }

export function stepGallery(g: Gallery, d: GalleryDrive, dt: number): void {
  g.clapped = false;
  const before = g.clap;
  if (g.applause > 0) {
    g.applause -= dt;
    g.clap += dt * 7;
    if (Math.floor(before) !== Math.floor(g.clap)) g.clapped = true;
  }
  g.seats.forEach((seat, i) => {
    if (i === YOUR_SEAT) return;
    const o = occupant(i, d.multiplier);
    const here = o.here && !(d.crashed && d.crashT > CRASH.gone - 1 && i % 3 === 1);
    stepSpring(seat.rise, here ? 1 : 0, 9, 0.75, dt);
    if (seat.rise.x < 0.08 && o.who !== seat.who) seat.who = o.who;
    stepSpring(seat.kick, 0, 12, 0.35, dt);
  });
  stepSpring(g.stand, d.left ? 1 : 0, 8, 0.6, dt);
}

/** Settles the row as a round already under way has it. */
export function settleGallery(g: Gallery, multiplier: number, left: boolean): void {
  g.seats.forEach((seat, i) => {
    if (i === YOUR_SEAT) return;
    const o = occupant(i, multiplier);
    settleSpring(seat.rise, o.here ? 1 : 0);
    seat.who = o.who;
  });
  settleSpring(g.stand, left ? 1 : 0);
}

function cardText(i: number, d: GalleryDrive): string {
  if (i === YOUR_SEAT) return 'PUBLIC';
  if (d.crashed && d.crashT >= REKT_AT) return 'REKT';
  if (d.multiplier >= ADDRESS_AT) return ADDRESS[i]!;
  return d.multiplier >= BID[i]! ? 'BID' : 'PUBLIC';
}

/** A member of the public from behind: hair or hat, ears, shoulders; returns where the head is. */
function person(ctx: CanvasRenderingContext2D, x: number, y: number, who: number, scale = 1): void {
  const hair = HAIR[who % HAIR.length]!;
  const coat = COATS[(who * 3 + 1) % COATS.length]!;
  const hat = HATS[(who * 5 + 2) % HATS.length]!;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = coat;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-36, 60);
  ctx.quadraticCurveTo(-36, 18, -16, 14);
  ctx.lineTo(16, 14);
  ctx.quadraticCurveTo(36, 18, 36, 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e2b593';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(-19, -2, 5, 7, 0, 0, Math.PI * 2);
  ctx.moveTo(24, -2);
  ctx.ellipse(19, -2, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  blob(ctx, 0, -4, 19, 21, hair, 2.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8, -20);
  ctx.quadraticCurveTo(-2, -4, -6, 12);
  ctx.moveTo(6, -20);
  ctx.quadraticCurveTo(10, -4, 4, 12);
  ctx.stroke();
  if (hat === 'cap') {
    blob(ctx, 0, -14, 20, 13, '#2f6fd0', 2.2);
    box(ctx, -6, -30, 12, 5, 2, '#2f6fd0', 1.5);
  } else if (hat === 'beanie') {
    blob(ctx, 0, -12, 20, 15, '#c0283a', 2.2);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(-19, -6, 38, 5);
    blob(ctx, 0, -28, 5, 5, '#f4f1ea', 1.5);
  } else if (hat === 'bun') blob(ctx, 0, -26, 9, 8, hair, 2.2);
  ctx.restore();
}

/** A phone held up, vertical, screen toward us (we are behind it): the hearing on it, or the crash. */
function phoneUp(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number, red: boolean, time: number, seed: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  box(ctx, -11, -19, 22, 38, 4, '#16161c', 2);
  if (red) {
    ctx.fillStyle = '#e0263e';
    ctx.fillRect(-9, -16, 18, 32);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.lineTo(5, -3);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#1d2944';
    ctx.fillRect(-9, -16, 18, 32);
    ctx.fillStyle = '#8a5a33';
    ctx.fillRect(-9, 1, 18, 6);
    ctx.fillStyle = '#f0c6a4';
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) ctx.rect(-8 + k * 3.6, -2, 2, 3);
    ctx.fill();
    ctx.fillStyle = '#4c505d';
    ctx.fillRect(-2, 8, 4, 6);
    if (fract(time * 0.8 + seed) < 0.6) {
      ctx.fillStyle = '#ff3a4a';
      ctx.beginPath();
      ctx.arc(-5, -12, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A seat back with its card, in front of whoever sits there. */
function seatBack(ctx: CanvasRenderingContext2D, x: number, text: string, red: boolean, mine: boolean, flip: number): void {
  drawSprite(ctx, 'seat', x - 44, SEAT_TOP + 12, 88, 58, (g) => {
    box(g, 4, 4, 80, 50, 10, '#4a2a1a', 2.8);
    g.fillStyle = 'rgba(255, 220, 170, 0.18)';
    g.fillRect(12, 8, 64, 4);
  });
  const w = text.length > 4 ? 58 : 50;
  ctx.save();
  ctx.translate(x, SEAT_TOP + 25);
  ctx.scale(1, 1 - 0.6 * flip);
  box(ctx, -w / 2, -8, w, 17, 3, red ? '#e0263e' : mine ? '#ffe08a' : '#fbf6ea', 2);
  label(ctx, text, 0, 0.5, text.length > 5 ? 9.5 : 11, red ? '#ffffff' : INK, 900, w - 6);
  ctx.restore();
}

/**
 * The row, nearest the camera: people, their phones and their cards; the player in their seat (or standing and
 * walking out along the row). `small` hides the player: after an exit they are drawn in the corridor instead.
 */
export function drawGallery(ctx: CanvasRenderingContext2D, g: Gallery, d: GalleryDrive, time: number): void {
  const red = d.crashed && d.crashT >= REKT_AT;
  const clapping = g.applause > 0 ? Math.abs(Math.sin(g.clap * Math.PI)) : 0;
  g.seats.forEach((seat, i) => {
    const mine = i === YOUR_SEAT;
    const rise = clamp(seat.rise.x, 0, 1.1);
    const text = cardText(i, d);
    // The card flips over just before it changes, keyed to the multiplier so a replay flips it the same way.
    const nextAt = d.multiplier < BID[i]! ? BID[i]! : ADDRESS_AT;
    const flip = !mine && !d.crashed ? smoothstep(0.97, 1, d.multiplier / nextAt) * (d.multiplier < nextAt ? 1 : 0) : 0;
    if (!mine && rise > 0.02) {
      const sway = Math.sin(time * (0.9 + 0.13 * i) + i * 1.7) * 2;
      const kick = clamp(seat.kick.x, -1, 1) * 4;
      const y = SEAT_TOP - 18 + (1 - rise) * 66 - kick + (red ? 3 : 0);
      person(ctx, seat.x + sway, y, seat.who);
      const films = (seat.who + i) % 2 === 0 || d.tension > 0.78;
      if (clapping > 0 && !red) {
        for (const side of [-1, 1]) {
          const hx = seat.x + sway + side * (4 + 9 * clapping);
          limb(ctx, [{ x: seat.x + side * 22, y: y + 26 }, { x: seat.x + side * 26, y: y - 6 }, { x: hx, y: y - 30 }], 9, COATS[(seat.who * 3 + 1) % COATS.length]!);
          blob(ctx, hx, y - 30, 6, 6, '#e2b593', 1.8);
        }
      } else if (red && i % 2 === 1) {
        // Hands on heads.
        for (const side of [-1, 1]) {
          limb(ctx, [{ x: seat.x + side * 22, y: y + 26 }, { x: seat.x + side * 34, y: y - 8 }, { x: seat.x + side * 12, y: y - 20 }], 9, COATS[(seat.who * 3 + 1) % COATS.length]!);
          blob(ctx, seat.x + side * 12, y - 20, 6, 6, '#e2b593', 1.8);
        }
      } else if (films && rise > 0.6) {
        const side = seat.who % 3 === 0 ? -1 : 1;
        const px = seat.x + sway + side * 26 + Math.sin(time * 1.3 + i) * 2;
        const py = y - 34 + Math.sin(time * 1.7 + i * 2) * 2;
        limb(ctx, [{ x: seat.x + side * 22, y: y + 26 }, { x: seat.x + side * 34, y: y + 4 }, { x: px, y: py + 14 }], 9, COATS[(seat.who * 3 + 1) % COATS.length]!);
        phoneUp(ctx, px, py, side * 0.06, red, time, i * 0.37);
      }
    }
    if (mine) drawYou(ctx, g, d, time);
    seatBack(ctx, seat.x, rise < 0.05 && !mine && !red && d.multiplier < ADDRESS_AT ? 'PUBLIC' : text, red && !mine, mine, flip);
  });
  if (clamp(g.stand.x, 0, 1) > 0.02) drawWalker(ctx, g, d, time);
}

/** Where the player is on the walk out: x along the row, how far up. */
function youAt(g: Gallery, d: GalleryDrive): { x: number; up: number } {
  const stand = clamp(g.stand.x, 0, 1.1);
  const walk = d.left ? smoothstep(0.7, 3, d.exitAge) : 0;
  return { x: SEAT_XS[YOUR_SEAT] + walk * 380, up: stand };
}

/** The player seated: a teal beanie and a YOU tag. */
function drawYou(ctx: CanvasRenderingContext2D, g: Gallery, d: GalleryDrive, time: number): void {
  if (clamp(g.stand.x, 0, 1) > 0.02) return;
  const x = SEAT_XS[YOUR_SEAT];
  const breath = Math.sin(time * 1.3) * 1.2;
  const y = SEAT_TOP - 18 + breath + (d.crashed && d.crashT > REKT_AT ? 3 : 0);
  player(ctx, x, y, time, 1);
}

function player(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#2b5a5a';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-36, 64);
  ctx.quadraticCurveTo(-36, 18, -16, 14);
  ctx.lineTo(16, 14);
  ctx.quadraticCurveTo(36, 18, 36, 64);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const side of [-1, 1]) blob(ctx, side * 19, -2, 5, 7, '#e9c2a0', 2);
  blob(ctx, 0, -4, 19, 21, '#4a3020', 2.5);
  blob(ctx, 0, -13, 20, 14, '#7cf6c4', 2.4);
  ctx.fillStyle = '#56c9a0';
  ctx.fillRect(-19, -7, 38, 5);
  // The YOU tag, bobbing over the head.
  const tag = Math.sin(time * 3) * 2;
  box(ctx, -20, -54 + tag, 40, 18, 5, '#7cf67c', 2);
  ctx.fillStyle = '#7cf67c';
  ctx.beginPath();
  ctx.moveTo(-5, -36 + tag);
  ctx.lineTo(5, -36 + tag);
  ctx.lineTo(0, -30 + tag);
  ctx.closePath();
  ctx.fill();
  ctx.font = `900 13px ${MEME_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText('YOU', 0, -44.5 + tag);
  ctx.restore();
}

/** The player up and leaving along the row, over the seat backs, out of the frame to the right. */
function drawWalker(ctx: CanvasRenderingContext2D, g: Gallery, d: GalleryDrive, time: number): void {
  const at = youAt(g, d);
  if (at.x > 1010) return;
  const walking = d.left && d.exitAge > 0.7;
  const bob = walking ? Math.abs(Math.sin(d.exitAge * 8)) * 4 : 0;
  player(ctx, at.x, SEAT_TOP - 18 - 40 * at.up - bob, time, 1);
}

// ─── After the exit: the collapse seen small, from the doorway ──────────────────────────────────────────

/** The doorway the room is seen through once you have left: the opening in the corridor wall. */
export const DOORWAY = { x: 300, y: 118, w: 380, h: 292 } as const;

/** The corridor around the doorway: dim walls, sconces, the runner, the open doors, an EXIT sign. */
export function drawCorridor(ctx: CanvasRenderingContext2D, k: number): void {
  if (k <= 0.01) return;
  const { x, y, w, h } = DOORWAY;
  ctx.save();
  ctx.globalAlpha = clamp(k, 0, 1);
  ctx.fillStyle = '#2a2430';
  ctx.beginPath();
  ctx.rect(0, 0, 960, 540);
  ctx.rect(x + w, y, -w, h);
  ctx.fill('evenodd');
  // Wallpaper stripes and a dado.
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let sx = 0; sx < 960; sx += 28) {
    if (sx > x - 30 && sx < x + w + 10) continue;
    ctx.fillRect(sx, 0, 12, 420);
  }
  ctx.fillStyle = '#3a2a22';
  ctx.fillRect(0, 420, 960, 120);
  ctx.fillStyle = '#5a3a26';
  ctx.fillRect(0, 414, x, 8);
  ctx.fillRect(x + w, 414, 960 - x - w, 8);
  // The runner, from the door toward us.
  ctx.fillStyle = '#6a1f2a';
  ctx.beginPath();
  ctx.moveTo(x + 40, y + h);
  ctx.lineTo(x + w - 40, y + h);
  ctx.lineTo(x + w + 160, 540);
  ctx.lineTo(x - 160, 540);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d8b25a';
  ctx.lineWidth = 3;
  ctx.stroke();
  // The frame and the two leaves swung open.
  ctx.fillStyle = '#5a3420';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.rect(x - 16, y - 20, w + 32, 20);
  ctx.rect(x - 16, y, 16, h);
  ctx.rect(x + w, y, 16, h);
  ctx.fill();
  ctx.stroke();
  for (const side of [-1, 1]) {
    const hinge = side < 0 ? x - 16 : x + w + 16;
    ctx.fillStyle = '#6b3e22';
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(hinge, y);
    ctx.lineTo(hinge + side * 70, y - 26);
    ctx.lineTo(hinge + side * 70, y + h + 50);
    ctx.lineTo(hinge, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    blob(ctx, hinge + side * 54, y + h / 2 + 10, 4, 4, '#d8b25a', 1.5);
  }
  // Sconces and the EXIT sign.
  for (const sx of [120, 860]) {
    ctx.fillStyle = 'rgba(255, 200, 120, 0.18)';
    ctx.beginPath();
    ctx.arc(sx, 190, 60, 0, Math.PI * 2);
    ctx.fill();
    box(ctx, sx - 8, 180, 16, 22, 4, '#ffe0a0', 2);
  }
  box(ctx, 830, 116, 80, 28, 4, '#1a3a24', 2.5);
  label(ctx, 'EXIT', 870, 130, 18, '#7cf67c', 900);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(846, 116);
  ctx.lineTo(846, 104);
  ctx.moveTo(894, 116);
  ctx.lineTo(894, 104);
  ctx.stroke();
  ctx.restore();
}

/** The player in the corridor, back to us, filming the collapse vertical through the door. */
export function drawYouInCorridor(ctx: CanvasRenderingContext2D, k: number, red: boolean, time: number): void {
  if (k <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(k, 0, 1);
  const x = mix(1040, 760, smoothstep(0, 1, k));
  const y = 430;
  limb(ctx, [{ x: x + 26, y: y + 30 }, { x: x + 40, y: y - 6 }, { x: x + 30, y: y - 52 }], 12, '#2b5a5a');
  player(ctx, x, y, time, 1.5);
  phoneUp(ctx, x + 30, y - 70, 0.08, red, time, 0.2);
  ctx.restore();
}

/** Deterministic dust in the room's light, so a held frame still breathes. */
export function drawDust(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = 'rgba(255, 236, 200, 0.35)';
  ctx.beginPath();
  for (let i = 0; i < 14; i += 1) {
    const x = 240 + noise(i * 3.1) * 480 + Math.sin(time * 0.3 + i) * 14;
    const y = 120 + fract(noise(i * 7.7) + time * 0.012 * (1 + (i % 3))) * 200;
    ctx.rect(x, y, 2, 2);
  }
  ctx.fill();
}
