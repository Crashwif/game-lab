/**
 * The bedroom: the bed, the duvet and everything on it or near it. Nothing
 * under the duvet is ever drawn; expressive heads and kicking feet frame
 * the blanket's movement. The joke lives in their reactions and in
 * the room reacting to it: the headboard knocking the wall, the lamp
 * wobbling, the glass walking off the nightstand, the cat leaving, the
 * neighbour's fist, the buckling bed legs, the wall TV tuned to DEGEN NEWS
 * with a BREAKING headline for every stage, and finally the arm that flops
 * out with a thumbs-up while the cat comes back holding a tiny NGMI sign.
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { drawFeet, drawPhone, drawReaction, drawSleepers, sleeperBob, sleeperFeet, type SleeperPose } from './sleepers';
import { stepFoot } from './kinematics';

export const FLOOR_Y = 470;
export const BED = { left: 210, right: 700, top: 362, headX: 214, footX: 690 };
export const INK = '#1c1f26';
/** Where the glass starts on the nightstand, and past where it goes over the edge. */
const GLASS_X = 158;
const GLASS_EDGE = 190;
/** Where the cat sits on the dresser, where it is out of the picture, and how fast it leaves (from 2×) and comes back. */
const CAT_X = 806;
const CAT_GONE = 1000;
const CAT_SPEED = 140;
const CAT_RETURN = 260;
/** How long after the finish the cat is back with its sign, in from just off the right edge. */
const CAT_BACK_S = 0.7;
/** Where the headboard hits the wall: the cracks spread from here into the wall left of the bed. */
const IMPACT = { x: 203, y: 318 };
/** The partner checks her charts from 2.2×, and yawns between 3× and 3.4×. */
const PHONE_AT = 2.2;
/** The TV on the wall where the poster used to be, and the window (narrowed to leave the wall beside it to the bookie's board). */
export const TV = { x: 18, y: 22, w: 96, h: 86 };
export const WINDOW = { x: 740, y: 60, w: 120, h: 130 };

/** The presentation's tension: 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×, 0.9 at 10×, so the opening window escalates. */
export const tensionAt = (multiplier: number): number => 1 - 1 / Math.max(1, multiplier);
/** Beats per second of the quilt at `growth` (log2 of the multiplier): the slow driver that keeps long rounds changing. */
const tempoAt = (growth: number): number => 0.8 + 2.2 * (1 - Math.exp(-growth / 2));
/** How far the glass walks on one beat. */
const walkPerBeat = (tension: number): number => 1 + 3 * tension;
/** Six cracks: the first at 1.67×, then 2×, 2.5×, 3.3×, 5× and 10×. */
const cracksAt = (multiplier: number): number => clamp((tensionAt(multiplier) - 0.3) / 0.6, 0, 1);
/** The partner's yawn, 0..1..0 across 3× to 3.4×. */
const yawnAt = (multiplier: number): number => (multiplier >= 3 && multiplier < 3.4 ? Math.sin(Math.PI * (multiplier - 3) / 0.4) : 0);

export interface Puff { kind: 'puff' | 'confetti'; x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour: string }

export interface RoomState {
  time: number;
  beatPhase: number;
  tempo: number;
  tension: number;
  multiplier: number;
  /** 0..1, eased: how much the beat drives the feet, so the start and the finish blend instead of snapping. */
  drive: number;
  /** 0..1, eased: how far the heads have slumped after the finish. */
  rest: number;
  lump: Spring;
  headboard: Spring;
  lamp: Spring;
  /** Each beat moves the glass's mark; the glass skids after it on a spring. */
  glassTarget: number;
  glass: Spring;
  glassFallen: boolean;
  glassFall: { x: number; y: number; vy: number; done: boolean };
  catX: number;
  catV: number;
  /** Distance the cat has walked, which drives its gait. */
  catWalk: number;
  catFled: boolean;
  catGone: boolean;
  /** The cat is walking back in after the finish, sign up. */
  catBack: boolean;
  catSign: Spring;
  catSignText: string;
  fist: Spring;
  fistSeen: boolean;
  legs: Spring;
  /** Cracks reached (0..1, six of them), and how far they have spread on the wall. */
  wallCracks: number;
  crackShown: number;
  /** The partner: her phone coming up, and an eye-roll at the cat or the glass (seconds since, and why). */
  phone: Spring;
  rollAge: number;
  rollWhy: 'cat' | 'glass';
  /** 1 just after a new round resets the room, fading the old round's cracks, broken or moved glass out and a fresh glass in. */
  wipe: number;
  ghost: { cracks: number; shards: boolean; glassX: number | null };
  finished: boolean;
  finishAge: number;
  armOut: Spring;
  thumb: Spring;
  /** The TV's two-line headline, and how far it has slid in (1 in place). */
  headline: [string, string];
  slide: Spring;
  /** 1, or 0 under reduced motion: the champ's tremble near the top. */
  motion: number;
  puffs: Puff[];
  events: { beat: boolean; glassFell: boolean; catLeft: boolean; fist: boolean; catBack: boolean; crack: boolean };
}

const noEvents = (): RoomState['events'] => ({ beat: false, glassFell: false, catLeft: false, fist: false, catBack: false, crack: false });

export function createRoom(motion = 1): RoomState {
  return { time: 0, beatPhase: 0, tempo: 0, tension: 0, multiplier: 1, drive: 0, rest: 0, lump: spring(0.6), headboard: spring(0), lamp: spring(0), glassTarget: GLASS_X, glass: spring(GLASS_X), glassFallen: false, glassFall: { x: GLASS_X, y: 0, vy: 0, done: false }, catX: CAT_X, catV: 0, catWalk: 0, catFled: false, catGone: false, catBack: false, catSign: spring(0), catSignText: 'NGMI', fist: spring(0), fistSeen: false, legs: spring(0), wallCracks: 0, crackShown: 0, phone: spring(0), rollAge: 99, rollWhy: 'cat', wipe: 0, ghost: { cracks: 0, shards: false, glassX: null }, finished: false, finishAge: 0, armOut: spring(0), thumb: spring(0), headline: ['TONIGHT:', 'THE MAIN EVENT'], slide: spring(1), motion, puffs: [], events: noEvents() };
}

/**
 * A new round. With `soft` (between rounds) the bodies spring back instead of jumping: the quilt fluffs up, the arm
 * goes back under, the heads lift, the cat walks home, and the old cracks and broken glass fade while a fresh glass
 * fades in. Without it (a fresh scene) everything starts in place.
 */
export function resetRoom(r: RoomState, soft = false): void {
  r.beatPhase = 0;
  r.wipe = soft ? 1 : 0;
  const moved = !r.glassFallen && r.glass.x > GLASS_X + 1;
  r.ghost = { cracks: soft ? r.crackShown : 0, shards: soft && r.glassFallen, glassX: soft && moved ? r.glass.x : null };
  if (!soft) {
    settleSpring(r.lump, 0.6);
    settleSpring(r.armOut, 0);
    settleSpring(r.thumb, 0);
    settleSpring(r.catSign, 0);
    settleSpring(r.phone, 0);
    r.rest = 0;
    r.drive = 0;
    r.puffs = [];
  }
  if (!soft || r.catGone) { r.catX = CAT_X; r.catV = 0; }
  settleSpring(r.headboard, 0);
  settleSpring(r.lamp, 0);
  r.glassTarget = GLASS_X;
  settleSpring(r.glass, GLASS_X);
  r.glassFallen = false;
  r.glassFall = { x: GLASS_X, y: 0, vy: 0, done: false };
  r.catGone = false;
  r.catBack = false;
  r.catFled = false;
  r.rollAge = 99;
  settleSpring(r.fist, 0);
  r.fistSeen = false;
  settleSpring(r.legs, 0);
  r.wallCracks = 0;
  r.crackShown = 0;
  r.finished = false;
  r.finishAge = 0;
}

/** A new headline: it slides in from the right of the screen. Returns whether it changed. */
export function setHeadline(r: RoomState, lines: [string, string]): boolean {
  if (r.headline[0] === lines[0] && r.headline[1] === lines[1]) return false;
  r.headline = lines;
  r.slide.x = 0;
  r.slide.v = 0;
  return true;
}

/** `pace` (1, or a little less while an act catches its breath) eases the quilt's tempo only, never the tension. */
export function stepRoom(r: RoomState, growth: number, running: boolean, dt: number, pace = 1): void {
  r.time += dt;
  r.events = noEvents();
  const multiplier = Math.pow(2, growth);
  r.multiplier = multiplier;
  r.tension = tensionAt(multiplier);
  r.tempo = running && !r.finished ? tempoAt(growth) * pace : 0;
  r.drive += ((r.tempo > 0 ? 1 : 0) - r.drive) * (1 - Math.exp(-dt / 0.1));
  r.rest = r.finished ? Math.min(1, r.rest + dt * 1.8) : Math.max(0, r.rest - dt * 3);
  r.wipe = Math.max(0, r.wipe - dt / 0.4);
  r.rollAge += dt;
  if (r.tempo > 0) {
    const before = r.beatPhase;
    r.beatPhase += r.tempo * dt;
    if (Math.floor(r.beatPhase) > Math.floor(before)) {
      r.events.beat = true;
      r.headboard.v += 3 + 6 * r.tension;
      r.lamp.v += (Math.floor(r.beatPhase) % 2 ? 1 : -1) * (0.6 + 1.6 * r.tension);
      if (!r.glassFallen) r.glassTarget += walkPerBeat(r.tension);
      if (multiplier >= 4) r.fist.v += 40;
      // A knock that reaches the next crack opens it, with a puff of plaster.
      const cracks = cracksAt(multiplier);
      if (Math.floor(cracks * 6 + 1e-6) > Math.floor(r.wallCracks * 6 + 1e-6)) {
        r.events.crack = true;
        for (let i = 0; i < 5; i += 1) {
          const n = Math.floor(r.beatPhase) * 3.7 + i * 1.3;
          r.puffs.push({ kind: 'puff', x: IMPACT.x - 6, y: IMPACT.y + (noise(n) - 0.5) * 20, vx: -20 - noise(n + 1) * 40, vy: -10 - noise(n + 2) * 20, r: 3 + noise(n + 3) * 4, age: 0, life: 0.7 + noise(n + 4) * 0.4, colour: '#e8e0d0' });
        }
      }
      r.wallCracks = Math.max(r.wallCracks, cracks);
    }
  }
  r.crackShown += (r.wallCracks - r.crackShown) * (1 - Math.exp(-dt * 7));
  // The lump breathes with the beat; after the finish it lies flat, and between rounds it fluffs back up.
  const target = r.finished ? 0.08 : running ? 0.55 + (0.45 + 0.4 * r.tension) * (0.5 - 0.5 * Math.cos(r.beatPhase * Math.PI * 2)) : 0.6 + Math.sin(r.time * 1.2) * 0.03;
  stepSpring(r.lump, target, r.finished ? 9 : running ? 30 : 8, r.finished ? 0.5 : 0.9, dt);
  stepSpring(r.headboard, 0, 18, 0.35, dt);
  stepSpring(r.lamp, 0, 5, 0.12, dt);
  stepSpring(r.fist, running && multiplier >= 4 ? 12 : 0, 6, 0.6, dt);
  if (!r.fistSeen && r.fist.x > 6) { r.fistSeen = true; r.events.fist = true; }
  stepSpring(r.legs, running && multiplier >= 6 ? 1 : 0, 3, 0.6, dt);
  stepSpring(r.slide, 1, 9, 0.6, dt);
  // The partner: her charts from 2.2× (lowered for the yawn), and the phone goes down at the finish.
  stepSpring(r.phone, running && !r.finished && multiplier >= PHONE_AT && yawnAt(multiplier) < 0.2 ? 1 : 0, 9, 0.7, dt);
  stepSpring(r.glass, r.glassTarget, 28, 0.55, dt);
  if (!r.glassFallen && r.glass.x > GLASS_EDGE) {
    r.glassFallen = true;
    r.events.glassFell = true;
    r.glassFall = { x: r.glass.x, y: 0, vy: 0, done: false };
    r.rollAge = 0;
    r.rollWhy = 'glass';
  }
  if (r.glassFallen && !r.glassFall.done) {
    r.glassFall.vy += 900 * dt;
    r.glassFall.y += r.glassFall.vy * dt;
    if (r.glassFall.y > 70) { r.glassFall.y = 70; r.glassFall.done = true; }
  }
  if (r.finished) {
    r.finishAge += dt;
    // The cat is back, sign first: in from the edge if it left, or the sign just goes up where it sat.
    if (r.finishAge > CAT_BACK_S && r.catGone && !r.catBack) { r.catBack = true; r.catGone = false; r.catX = 975; r.catV = -CAT_RETURN; r.events.catBack = true; }
  }
  stepSpring(r.armOut, r.finished ? 1 : 0, 6, r.finished ? 0.5 : 0.9, dt);
  stepSpring(r.thumb, r.finished && r.finishAge > 0.9 ? 1 : 0, 10, 0.4, dt);
  // The cat gets up and leaves from 2×, easing into its stride; whenever it is in the room and not fleeing, it walks home.
  const flee = running && multiplier >= 2 && !r.finished;
  if (flee && !r.catFled) { r.catFled = true; r.rollAge = 0; r.rollWhy = 'cat'; }
  if (!r.catGone) {
    const want = flee ? CAT_SPEED : r.catX > CAT_X + 0.5 ? -Math.min(CAT_RETURN, Math.sqrt(2 * 500 * (r.catX - CAT_X))) : 0;
    // Braking follows the stopping curve itself, so it slows right down onto its spot instead of stopping dead.
    r.catV = want * r.catV > 0 && Math.abs(want) < Math.abs(r.catV) ? want : r.catV + (want - r.catV) * (1 - Math.exp(-dt / 0.15));
    r.catX += r.catV * dt;
    if (r.catX <= CAT_X && !flee) { r.catX = CAT_X; r.catV = 0; }
    r.catWalk += Math.abs(r.catV) * dt;
    if (r.catX > CAT_GONE) { r.catGone = true; r.catV = 0; r.events.catLeft = true; }
  }
  stepSpring(r.catSign, r.finished && r.finishAge > CAT_BACK_S ? 1 : 0, 8, 0.4, dt);
  for (const p of r.puffs) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'puff') { p.r += 14 * dt; p.vy -= 20 * dt; }
    else p.vy += 30 * dt;
  }
  r.puffs = r.puffs.filter((p) => p.age < p.life);
}

/**
 * Puts the props where a round that has reached `multiplier` leaves them, for a round met late: a fresh scene
 * mid-round or after the crash, or a frame after the tab was hidden. The glass and the cat only move on, so a
 * round already drawn keeps what it showed. Nothing fires: no beat, no falling glass, no shake.
 */
export function settleRoom(r: RoomState, multiplier: number, running: boolean, elapsed = 0): void {
  // Missed prop motion settles from the known duration and current tension. The room never assumes
  // a backend growth rate: configured curves may reach the same multiplier at different times.
  const growth = Math.log2(Math.max(1, multiplier));
  // The midpoint (in log terms) of the round so far stands in for the average tempo and tension.
  const beats = Math.max(0, elapsed) / 1000 * tempoAt(growth * 0.5);
  const x = GLASS_X + beats * walkPerBeat(tensionAt(Math.sqrt(Math.max(1, multiplier))));
  if (!r.glassFallen && x > GLASS_EDGE) {
    r.glassFallen = true;
    r.glassFall = { x: GLASS_EDGE, y: 70, vy: 0, done: true };
  } else if (!r.glassFallen) {
    r.glassTarget = Math.max(r.glassTarget, x);
    settleSpring(r.glass, r.glassTarget);
  }
  // If the departure happened off screen, the cat is already out of the room.
  if (multiplier >= 2) { r.catGone = true; r.catFled = true; r.catX = CAT_GONE; r.catV = 0; }
  r.multiplier = multiplier;
  r.wallCracks = Math.max(r.wallCracks, cracksAt(multiplier));
  r.crackShown = r.wallCracks;
  r.rollAge = 99;
  r.drive = r.rest = 0;
  if (running) r.drive = 1;
  settleSpring(r.phone, running && multiplier >= PHONE_AT && yawnAt(multiplier) < 0.2 ? 1 : 0);
  settleSpring(r.fist, running && multiplier >= 4 ? 12 : 0);
  r.fistSeen = running && multiplier >= 4;
  settleSpring(r.legs, running && multiplier >= 6 ? 1 : 0);
  settleSpring(r.slide, 1);
}

/** The champ finishes. `sign` is what the cat's placard says about it. */
export function finishRoom(r: RoomState, quiet: boolean, legendary: boolean, sign: string): void {
  r.finished = true;
  r.finishAge = quiet ? 10 : 0;
  r.tempo = 0;
  r.catSignText = sign;
  if (quiet) {
    settleSpring(r.armOut, 1);
    settleSpring(r.thumb, 1);
    settleSpring(r.lump, 0.08);
    settleSpring(r.catSign, 1);
    settleSpring(r.phone, 0);
    r.rest = 1;
    r.drive = 0;
    r.catGone = false;
    r.catBack = true;
    r.catX = CAT_X;
    r.catV = 0;
    return;
  }
  for (let i = 0; i < 12; i += 1) {
    const n = i * 1.7;
    r.puffs.push({ kind: 'puff', x: 450 + (noise(n) - 0.5) * 120, y: 300, vx: (noise(n + 1) - 0.5) * 60, vy: -30 - noise(n + 2) * 40, r: 6 + noise(n + 3) * 8, age: 0, life: 1.2 + noise(n + 4) * 0.6, colour: '#ffffff' });
  }
  if (legendary) {
    for (let i = 0; i < 40; i += 1) {
      const n = i * 2.3;
      r.puffs.push({ kind: 'confetti', x: noise(n) * 960, y: -10, vx: (noise(n + 1) - 0.5) * 40, vy: 60 + noise(n + 2) * 90, r: 2 + noise(n + 3) * 3, age: 0, life: 3 + noise(n + 4) * 2, colour: ['#ff4d6d', '#7cf67c', '#8fd3ff', '#ffe27a'][i % 4]! });
    }
  }
}

/** The wall TV: DEGEN NEWS, an anchor, and the BREAKING lower third with the headline sliding in. It ends above the crowd's signs. */
function drawTV(ctx: CanvasRenderingContext2D, r: RoomState): void {
  const { x, y, w, h } = TV;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.stroke();
  const sx = x + 6;
  const sy = y + 6;
  const sw = w - 12;
  const sh = h - 12;
  ctx.fillStyle = '#243b6b';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.save();
  ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
  // The studio: a desk, an anchor with a tie, a globe, and the channel bug.
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath(); ctx.arc(sx + 66, sy + 20, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(sx + 66, sy + 20, 10, 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(sx + 20, sy + 26, 26, 16, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f3dccb';
  ctx.beginPath(); ctx.ellipse(sx + 33, sy + 17, 9.5, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(sx + 30, sy + 16, 1.4, 0, Math.PI * 2); ctx.arc(sx + 36, sy + 16, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(sx + 30, sy + 22); ctx.lineTo(sx + 36, sy + 22); ctx.stroke();
  ctx.fillStyle = '#5a3a22';
  ctx.beginPath(); ctx.ellipse(sx + 33, sy + 9, 10, 5, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.moveTo(sx + 31, sy + 28); ctx.lineTo(sx + 35, sy + 28); ctx.lineTo(sx + 33, sy + 37); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5b6b8a';
  ctx.fillRect(sx, sy + 34, sw, 5);
  // The channel bug and the BREAKING lower third.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '900 8px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('DEGEN NEWS', sx + 3, sy + 9);
  ctx.fillStyle = Math.floor(r.time * 2) % 2 || r.motion === 0 ? '#e63946' : '#7a1a24';
  ctx.beginPath(); ctx.arc(sx + sw - 7, sy + 6, 2.5, 0, Math.PI * 2); ctx.fill();
  const ly = sy + sh - 36;
  ctx.fillStyle = '#e63946';
  ctx.fillRect(sx, ly, sw, 11);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 9px Impact, "Arial Black", sans-serif';
  ctx.fillText(r.finished ? 'BREAKING' : r.tempo > 0 ? 'LIVE' : 'COMING UP', sx + 4, ly + 9);
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(sx, ly + 11, sw, 25);
  const slide = (1 - clamp(r.slide.x, 0, 1)) * (sw + 10);
  ctx.fillStyle = INK;
  ctx.font = '900 10px Impact, "Arial Black", sans-serif';
  ctx.fillText(r.headline[0], sx + 4 + slide, ly + 21, sw - 8);
  ctx.fillText(r.headline[1], sx + 4 + slide, ly + 32, sw - 8);
  ctx.restore();
  // Screen glare.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw * 0.5, sy); ctx.lineTo(sx, sy + sh * 0.6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Six jagged cracks fanning out left from the impact; each grows from it as `amount` (0..1) passes its sixth. */
function drawCracks(ctx: CanvasRenderingContext2D, amount: number, alpha: number): void {
  if (amount < 0.005) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.75)';
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i += 1) {
    const grown = clamp(amount * 6 - i, 0, 1) * 5;
    if (grown <= 0) break;
    const heading = Math.PI + [-0.15, 0.3, -0.45, 0.6, 0.05, -0.75][i]!;
    let x = IMPACT.x;
    let y = IMPACT.y + (i % 3 - 1) * 6;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < grown; s += 1) {
      const part = Math.min(1, grown - s);
      const angle = heading + (noise(i * 7 + s) - 0.5) * 0.9;
      const length = (11 + noise(i * 3 + s) * 10) * part;
      x += Math.cos(angle) * length; y += Math.sin(angle) * length;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWall(ctx: CanvasRenderingContext2D, r: RoomState): void {
  ctx.fillStyle = '#5b6b8a';
  ctx.fillRect(0, 0, 960, FLOOR_Y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let x = 0; x < 960; x += 48) ctx.fillRect(x, 0, 22, FLOOR_Y);
  // Window with the night outside, and later the fire brigade.
  ctx.fillStyle = '#1b2440';
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i += 1) { ctx.beginPath(); ctx.arc(WINDOW.x + 10 + noise(i) * (WINDOW.w - 20), WINDOW.y + 10 + noise(i * 2.7) * (WINDOW.h - 20), 1.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f7f0d8';
  ctx.beginPath(); ctx.arc(WINDOW.x + 92, 96, 14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(WINDOW.x + WINDOW.w / 2, WINDOW.y); ctx.lineTo(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h); ctx.moveTo(WINDOW.x, 125); ctx.lineTo(WINDOW.x + WINDOW.w, 125); ctx.stroke();
  drawTV(ctx, r);
  // Cracks spreading from where the headboard hits, into the wall left of the bed; the last round's fade out.
  drawCracks(ctx, r.crackShown, 1);
  if (r.wipe > 0) drawCracks(ctx, r.ghost.cracks, r.wipe);
  // The neighbour's fist through the wall.
  const fist = clamp(r.fist.x, 0, 20);
  if (fist > 0.5) {
    ctx.save();
    ctx.translate(25, 340);
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(-4, -26); ctx.lineTo(14, -14); ctx.lineTo(30, -24); ctx.lineTo(34, 8); ctx.lineTo(18, 26); ctx.lineTo(-6, 22); ctx.lineTo(-20, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-10, -18 + fist * 0.4, 36 + fist * 1.2, 36, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(-5, -58, 155, 30, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 14px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KEEP IT DOWN!', 72, -38);
    ctx.restore();
  }
}

/** The cat on the dresser: it gets up and trots off from 2×, and is back after the finish with a placard held up in one paw. */
function drawCat(ctx: CanvasRenderingContext2D, r: RoomState): void {
  // It rises onto its legs as it picks up speed and settles back into a loaf as it stops; the walked distance sets the stride.
  const stand = smoothstep(0, 50, Math.abs(r.catV));
  const rise = 7 * stand;
  const bob = Math.abs(Math.sin(Math.PI * r.catWalk / 18)) * 1.5 * stand * r.motion;
  ctx.save();
  ctx.translate(r.catX, 384 - rise - bob);
  // It faces the way it walks: the head is drawn on the left.
  if (r.catV > 1) ctx.scale(-1, 1);
  ctx.lineCap = 'round';
  if (stand > 0.02) {
    for (const [lx, offset] of [[-15, 0], [-8, 0.5], [9, 0.5], [16, 0]] as const) {
      const step = stepFoot(r.catWalk, 36, offset, 4);
      ctx.beginPath(); ctx.moveTo(lx, -6); ctx.lineTo(lx - step.x * stand, rise + bob + step.y * stand);
      ctx.strokeStyle = INK; ctx.lineWidth = 6.5; ctx.stroke();
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3.5; ctx.stroke();
    }
  }
  ctx.fillStyle = '#3a3a3a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, -12, 24, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-20, -22, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-28, -28); ctx.lineTo(-26, -40); ctx.lineTo(-19, -30); ctx.moveTo(-14, -30); ctx.lineTo(-11, -40); ctx.lineTo(-8, -29); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, -14); ctx.quadraticCurveTo(44, -20 + Math.sin(r.time * 3) * 8, 40, -40); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.arc(-24, -24, 1.8, 0, Math.PI * 2); ctx.arc(-17, -24, 1.8, 0, Math.PI * 2); ctx.fill();
  const sign = clamp(r.catSign.x, 0, 1.2);
  if (sign > 0.02) {
    // The placard comes up on a stick from behind the head, wobbling with the walk.
    ctx.save();
    ctx.translate(-6, -30);
    ctx.rotate(-0.15 + Math.sin(r.time * 4) * 0.06 - (1 - Math.min(sign, 1)) * 0.8);
    const up = 30 * sign;
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -up); ctx.stroke();
    ctx.fillStyle = '#fbf8f1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-20, -up - 18, 40, 18, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 11px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(r.catSignText, 0, -up - 9, 36);
    ctx.restore();
  }
  ctx.restore();
}

/** The glass of water at (`x`, `y`), its base on the nightstand. */
function drawGlass(ctx: CanvasRenderingContext2D, r: RoomState, x: number, y: number, angle: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(200, 230, 255, 0.7)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-7, -22, 14, 22, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(120, 190, 255, 0.8)';
  ctx.fillRect(-6, -12 + Math.sin(r.time * 12) * 1.5 * r.tension, 12, 11);
  ctx.restore();
}

export function drawFloorAndFurniture(ctx: CanvasRenderingContext2D, r: RoomState): void {
  ctx.fillStyle = '#8b6b4a';
  ctx.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);
  ctx.strokeStyle = 'rgba(60, 40, 25, 0.4)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 960; x += 80) { ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x, 540); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(960, FLOOR_Y); ctx.stroke();
  // Nightstand, lamp on a wobble, the walking glass.
  ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(108, 398, 84, FLOOR_Y - 398, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6a44';
  ctx.beginPath(); ctx.roundRect(116, 410, 68, 22, 2); ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.translate(140, 398);
  ctx.rotate(clamp(r.lamp.x, -0.6, 0.6) * 0.15);
  ctx.fillStyle = '#c9a44a';
  ctx.beginPath(); ctx.roundRect(-4, -46, 8, 46, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath(); ctx.moveTo(-26, -46); ctx.lineTo(-16, -80); ctx.lineTo(16, -80); ctx.lineTo(26, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  // A fresh glass fades in for a new round where the last one moved or broke, and a moved one fades out where it stood.
  const fresh = r.ghost.shards || r.ghost.glassX !== null ? 1 - r.wipe : 1;
  if (r.ghost.glassX !== null && r.wipe > 0) drawGlass(ctx, r, r.ghost.glassX, 398, 0, r.wipe);
  if (!r.glassFallen || !r.glassFall.done) {
    // Each knock kicks it along: it skids after its mark with a little hop and tilt, then goes over the edge.
    const skid = r.glassFallen ? 0 : r.glass.v * r.motion;
    const gx = r.glassFallen ? r.glassFall.x + r.glassFall.y * 0.35 : r.glass.x;
    const gy = 398 + (r.glassFallen ? r.glassFall.y : -Math.min(3, Math.abs(skid) * 0.04));
    drawGlass(ctx, r, gx, gy, r.glassFallen ? r.glassFall.y * 0.03 : clamp(skid * 0.003, -0.15, 0.15), fresh);
  }
  const shards = r.glassFallen && r.glassFall.done ? 1 : r.ghost.shards ? r.wipe : 0;
  if (shards > 0) {
    ctx.save();
    ctx.globalAlpha = shards;
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.9)'; ctx.lineWidth = 2;
    for (const [dx, dy] of [[0, 0], [10, 3], [-8, 5], [16, -2]] as const) { ctx.beginPath(); ctx.moveTo(210 + dx, FLOOR_Y - 2 + dy); ctx.lineTo(216 + dx, FLOOR_Y - 8 + dy); ctx.lineTo(220 + dx, FLOOR_Y - 1 + dy); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120, 190, 255, 0.5)';
    ctx.beginPath(); ctx.ellipse(214, FLOOR_Y - 1, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Dresser and the cat.
  ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(730, 384, 160, FLOOR_Y - 384, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6a44';
  for (const y of [396, 424]) { ctx.beginPath(); ctx.roundRect(742, y, 136, 20, 2); ctx.fill(); ctx.stroke(); }
  if (!r.catGone) drawCat(ctx, r);
}

/** Pillows and faces, feet tucked behind the quilt, then the gripping hand and finish. */
export function drawBed(ctx: CanvasRenderingContext2D, r: RoomState): void {
  const legs = clamp(r.legs.x, 0, 1);
  const tilt = legs * 0.05;
  // Reduced motion stills the oscillation (time, beat, lift, tremble) but keeps every expression and line.
  const roll = smoothstep(0, 0.25, r.rollAge) * (1 - smoothstep(1.2, 1.6, r.rollAge));
  const pose: SleeperPose = {
    time: r.time * r.motion, beat: r.beatPhase * Math.PI * 2 * r.motion, tension: r.tension,
    lift: (clamp(r.lump.x, 0, 1.3) - 0.6) * r.motion,
    active: r.tempo > 0, drive: r.drive * r.motion, finished: r.finished, rest: r.rest,
    // A small tremble from 2.5×, full by 20×.
    tremble: r.motion * (r.tempo > 0 ? clamp((r.tension - 0.6) / 0.35, 0, 1) : 0),
    multiplier: r.multiplier, phone: clamp(r.phone.x, 0, 1.2), roll: r.finished ? 0 : roll, rollWhy: r.rollWhy,
    yawn: r.tempo > 0 ? yawnAt(r.multiplier) : 0,
  };
  ctx.save();
  ctx.fillStyle = 'rgba(28, 31, 38, 0.18)';
  ctx.beginPath(); ctx.ellipse(467, FLOOR_Y - 1, 263, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(BED.footX, FLOOR_Y);
  ctx.rotate(-tilt);
  ctx.translate(-BED.footX, -FLOOR_Y);
  ctx.lineJoin = 'round';
  // Frame and legs (the head end buckles).
  ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(BED.left - 6, BED.top + 26, BED.right - BED.left + 12, 30, 4); ctx.fill(); ctx.stroke();
  for (const lx of [BED.left + 8, BED.right - 14]) {
    ctx.save();
    if (lx < 400) { ctx.translate(lx + 6, BED.top + 56); ctx.rotate(-legs * 0.5); ctx.translate(-(lx + 6), -(BED.top + 56)); }
    ctx.beginPath(); ctx.roundRect(lx, BED.top + 54, 12, FLOOR_Y - BED.top - 54, 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Headboard knocks the wall.
  const knock = clamp(r.headboard.x, -1, 8);
  ctx.save();
  ctx.translate(BED.headX, FLOOR_Y);
  ctx.rotate(-knock * 0.02);
  ctx.translate(-BED.headX, -FLOOR_Y);
  ctx.fillStyle = '#7a5230';
  ctx.beginPath(); ctx.roundRect(BED.headX - 12, 262, 22, BED.top + 30 - 262, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6a44';
  for (const y of [280, 306, 332]) { ctx.beginPath(); ctx.roundRect(BED.headX - 8, y, 14, 16, 2); ctx.fill(); }
  ctx.restore();
  // Mattress and sheet.
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath(); ctx.roundRect(BED.left, BED.top, BED.right - BED.left, 30, 6); ctx.fill(); ctx.stroke();
  // Connect the headboard grip to the shoulder tucked behind the pillow.
  ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(275, 356); ctx.quadraticCurveTo(237, 334, BED.headX + 9, 282 - knock * 0.5); ctx.stroke();
  ctx.strokeStyle = '#f3dccb'; ctx.lineWidth = 11; ctx.stroke();
  drawSleepers(ctx, pose);
  const feet = sleeperFeet(pose);
  drawFeet(ctx, feet);
  // A shoulder tuck, broad moving quilt and hanging hem connect heads to feet.
  const h = 33 + 66 * clamp(r.lump.x, 0, 1.3);
  const peakX = 440 + pose.lift * 8;
  const champBob = sleeperBob(pose, false);
  const partnerBob = sleeperBob(pose, true);
  const firstTuck = feet[0]!.tuck;
  const lastTuck = feet[feet.length - 1]!.tuck;
  const hemX = Math.max(BED.right - 16, lastTuck.x + 7);
  const quilt = new Path2D();
  quilt.moveTo(BED.left + 12, BED.top + 10);
  quilt.quadraticCurveTo(276, BED.top + 18 + champBob, 305, BED.top - 17 + champBob);
  quilt.quadraticCurveTo(326, BED.top - 12 + partnerBob, 354, BED.top - 41 + partnerBob);
  quilt.bezierCurveTo(383, BED.top - h, peakX - 24, BED.top - h, peakX, BED.top - h);
  quilt.bezierCurveTo(peakX + 51, BED.top - h, 502, BED.top - h * 0.65, 540, BED.top - h * 0.64);
  quilt.bezierCurveTo(584, BED.top - h * 0.82, firstTuck.x - 30, firstTuck.y - 16, firstTuck.x, firstTuck.y);
  // The drape follows each ankle so a kick never leaves a detached foot or exposed leg end.
  let previousTuck = firstTuck;
  for (let i = 1; i < feet.length; i += 1) {
    const tuck = feet[i]!.tuck;
    // A farther ankle is already covered by the drape over the foot in front of it.
    if (tuck.x <= previousTuck.x) continue;
    quilt.bezierCurveTo(mix(previousTuck.x, tuck.x, 0.6), previousTuck.y + 4, tuck.x, tuck.y - 4, tuck.x, tuck.y);
    previousTuck = tuck;
  }
  quilt.quadraticCurveTo(lastTuck.x + 10, lastTuck.y + 15, hemX, BED.top + 25);
  quilt.bezierCurveTo(594, BED.top + 43, 390, BED.top + 45, 278, BED.top + 29);
  quilt.quadraticCurveTo(244, BED.top + 28, BED.left + 12, BED.top + 10);
  quilt.closePath();
  const fabric = ctx.createLinearGradient(0, BED.top - h, 0, BED.top + 43);
  fabric.addColorStop(0, '#aebfe8'); fabric.addColorStop(0.55, '#819bd0'); fabric.addColorStop(1, '#536fab');
  ctx.fillStyle = fabric; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.fill(quilt); ctx.stroke(quilt);
  ctx.save(); ctx.clip(quilt);
  // Quilting follows the volume.
  ctx.strokeStyle = 'rgba(38, 57, 102, 0.3)'; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    const fx = 312 + i * 48;
    ctx.beginPath(); ctx.moveTo(fx, BED.top + 39);
    ctx.bezierCurveTo(fx + 25, BED.top + 2, fx - 24, BED.top - h * 0.65, fx + 12, BED.top - h - 8); ctx.stroke();
  }
  for (const offset of [0, 25, 50]) {
    ctx.beginPath(); ctx.moveTo(282, BED.top - 13 + offset);
    ctx.bezierCurveTo(394, BED.top - h * 0.7 + offset, 529, BED.top - h * 0.55 + offset, hemX, BED.top - 12 + offset); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(231, 239, 255, 0.65)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(285, BED.top + 23);
  ctx.bezierCurveTo(390, BED.top + 39, 595, BED.top + 37, hemX - 7, BED.top + 21); ctx.stroke();
  ctx.restore();
  // At the finish the champ's near arm comes out from under the covers at his shoulder, beside his chin, and flops
  // over the side; after a beat the forearm lifts from the elbow for a thumbs-up.
  const arm = clamp(r.armOut.x, 0, 1.1);
  if (arm > 0.02) {
    const thumb = clamp(r.thumb.x, 0, 1.1);
    // It lies out along the quilt, then drops over the edge with the limp forearm ahead of the upper arm.
    const upper = mix(0.15, 1.2, arm);
    const fore = mix(mix(0.15, 1.45, Math.min(1, arm * 2)), -0.55, thumb);
    const sx = 304;
    const sy = BED.top - 1 + champBob;
    const ex = sx + Math.cos(upper) * 42;
    const ey = sy + Math.sin(upper) * 42;
    const wx = ex + Math.cos(fore) * 34;
    const wy = ey + Math.sin(fore) * 34;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(wx, wy);
    ctx.strokeStyle = INK; ctx.lineWidth = 17; ctx.stroke();
    ctx.strokeStyle = '#f3dccb'; ctx.lineWidth = 12; ctx.stroke();
    // The fist stays upright, so the thumb comes up straight.
    const fx = wx + Math.cos(fore) * 8;
    const fy = wy + Math.sin(fore) * 8;
    ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    if (thumb > 0.05) { ctx.beginPath(); ctx.roundRect(fx - 6, fy - 8 - 14 * thumb, 9, 6 + 14 * thumb, 4.5); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.roundRect(fx - 10, fy - 9, 20, 18, 6); ctx.fill(); ctx.stroke();
  }
  // A bright turned-over edge identifies the opening; it is drawn over the arm so the arm comes out from under it.
  ctx.save(); ctx.clip(quilt);
  ctx.strokeStyle = '#dae4fb'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(223, BED.top + 10);
  ctx.quadraticCurveTo(276, BED.top + 18 + champBob, 305, BED.top - 17 + champBob);
  ctx.quadraticCurveTo(326, BED.top - 12 + partnerBob, 354, BED.top - 41 + partnerBob); ctx.stroke();
  ctx.restore();
  // Her phone comes up from under the covers, so it is clipped to above the quilt.
  if (pose.phone > 0.02) {
    const outside = new Path2D();
    outside.rect(0, 0, 960, 540);
    outside.addPath(quilt);
    ctx.save(); ctx.clip(outside, 'evenodd');
    drawPhone(ctx, pose);
    ctx.restore();
  }
  // The champ's hand gripping the headboard: knuckles go white with the tension.
  const grip = mix(0.15, 1, r.tension);
  const hx = BED.headX + 4;
  const hy = 268 - knock * 0.5;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.fillStyle = `rgb(${Math.round(mix(243, 255, grip))}, ${Math.round(mix(220, 245, grip))}, ${Math.round(mix(203, 238, grip))})`;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-8, -2, 30, 22, 6); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.roundRect(-4 + i * 7, -10 - grip * 2, 6, 12, 3); ctx.fill(); ctx.stroke(); }
  if (r.tension > 0.3 && !r.finished) {
    const p = (r.time / 1.2) % 1;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(26, 6 + p * 20, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawReaction(ctx, pose);
  ctx.restore();
  for (const p of r.puffs) {
    ctx.globalAlpha = (1 - p.age / p.life) * (p.kind === 'puff' ? 0.6 : 1);
    ctx.fillStyle = p.colour;
    if (p.kind === 'confetti') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.age * 3 + p.vx);
      ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore();
    } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
