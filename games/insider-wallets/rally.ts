/**
 * The rally: a fictional candidate (generic cartoon, not a portrait), the
 * podium, flags, crowd, press pool, confetti cannons, helicopter and the
 * seat you can still leave. Hair is drawn without the head's shake.
 */
import { clamp, fract, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const SKIN = '#f3dccb';
const MARKS = [1.5, 2.2, 3.2, 4.8, 7, 10, 14, 20];
/** One per sign holder, front row first. */
const SIGNS = ['SEND IT', 'WAGMI', 'BUY HIGH', 'LFG', 'HE CARES', 'MY RENT', 'TRUST ME', 'NO KYC'];
const CROWD = ['#e63946', '#3b82f6', '#f2c14e', '#7cf67c', '#e7eef8'];
interface Fan { x: number; row: number; col: number; h: number; h2: number; colour: string; sign: number; rank: number; }
/** The crowd's places, back row first so each row's shoulders sit behind the heads in front. Slot 2 of the front row is your seat. */
const FANS: Fan[] = [];
for (let row = 4; row >= 0; row -= 1) {
  for (let col = 0; col < 14; col += 1) {
    if (row === 0 && col === 2) continue;
    const i = row * 14 + col;
    // Two holders on the even rows and one between them on the odd rows: a full crowd raises all eight signs.
    const holds = row % 2 === 0 ? [4, 11].indexOf(col) : col === 7 ? 0 : -1;
    FANS.push({ x: 70 + col * 42 + (row % 2) * 16, row, col, h: noise(i * 1.37 + 0.2), h2: noise(i * 2.71 + 5.1), colour: CROWD[Math.floor(noise(i * 3.9 + 1.3) * 5)]!, sign: holds < 0 ? -1 : row + Math.ceil(row / 2) + holds, rank: 0 });
  }
}
// They join in a shuffled order that still fills from the front. Your neighbours and the first three sign holders
// (the two your cash-out flips among them) are there from the start, so an early jeet still gets both signs.
const joinKey = (fan: Fan): number => ((fan.row === 0 && Math.abs(fan.col - 2) === 1) || (fan.sign >= 0 && fan.sign < 3) ? -1 : fan.row + fan.h * 1.6);
[...FANS].sort((a, b) => joinKey(a) - joinKey(b)).forEach((fan, rank) => { fan.rank = rank; });
/** What the press pool shouts, from polite to panicked; the tension picks the row. */
const QUESTIONS = ['SIR, IS THIS LEGAL?', 'SIR, WHO IS ANON.SOL?', 'SIR, DID YOUR BARBER BUY?', 'SIR, HOW IS THE DOG WALKER RICH?', 'SIR, IS THAT YOUR HELICOPTER?', 'SIR, WHERE ARE YOU GOING?', 'SIR?? SIR???'];
const FOLLOWUPS = ['SIR, ANOTHER FAMILY WALLET?', 'SIR, WHO PAID FOR THE FUEL?', 'SIR, THE CROWD HAS QUESTIONS', 'SIR, IS THE PILOT AN INSIDER?', 'SIR, WHY IS YOUR TIE SO LONG?', 'SIR, CAN WE SEE THE RECEIPTS?'];
/** Seconds of rally time after the crash frame before the helicopter yanks him, and before the podium goes over. */
const LIFT_DELAY = 0.12;
const PODIUM_DELAY = 0.32;
/** How high the helicopter lifts him: to the top of the picture, where he dangles under the caption with the tie trailing. */
const LIFT_MAX = 150;

interface Bit { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; rot: number; vr: number; }

/** What happened this step, for the scene's sound: each is true for one frame. */
export interface RallyEvents { cannon: boolean; flash: boolean; question: boolean; heli: boolean; latch: boolean; lift: boolean; podium: boolean; }

export interface Rally {
  tip: Spring;
  droop: Spring;
  lift: number;
  /** The lift's speed: the helicopter yanks harder the longer it pulls. */
  liftV: number;
  swing: Spring;
  travel: Spring;
  seatAge: number;
  heliX: Spring;
  heliY: Spring;
  /** How far the cable has come down toward his collar: 0 reeled in, 1 hooked on. */
  reach: Spring;
  /** Your figure in the seat: 0 for a spectator, 1 once you have a bet on. */
  you: Spring;
  /** Whether you have a bet on this round, so the crash knows whose signs to flip. */
  staked: boolean;
  crashed: boolean;
  crashT: number;
  bits: Bit[];
  cannons: number;
  seatX: number;
  leaving: boolean;
  surge: number;
  rotor: number;
  /** Running phases for the nervous loops whose speed follows the tension, so a speed change never jumps the cycle. */
  phase: { tie: number; wig: number; mouth: number; sweat: number; shutter: number };
  /** Seconds since the last cannon, for the crowd's hop. */
  cannonT: number;
  time: number;
  /** The tie: how far it has grown (0 tucked, 1 dragging on the floor), its flap, and the tail that lags the lift. */
  tieLen: Spring;
  tieSway: Spring;
  tieLag: Spring;
  /** The press pool's question of the moment, how long it has been up, when the next comes, and how many were asked. */
  question: string;
  questionAge: number;
  questionNext: number;
  asked: number;
  /** The camera flashes: when the next fires, how long ago the last did, and which camera it was. */
  flashNext: number;
  flashT: number;
  flashCam: number;
  heliNear: boolean;
  events: RallyEvents;
}

export function createRally(): Rally {
  return {
    tip: spring(0),
    droop: spring(0),
    lift: 0,
    liftV: 0, swing: spring(0), travel: spring(0), seatAge: 0,
    heliX: spring(760),
    heliY: spring(78),
    reach: spring(0),
    you: spring(0),
    staked: false,
    crashed: false,
    crashT: 0,
    bits: [],
    cannons: 0,
    seatX: 168,
    leaving: false,
    surge: 0,
    rotor: 0,
    phase: { tie: 0, wig: 0, mouth: 0, sweat: 0, shutter: 0 },
    cannonT: 9,
    time: 0,
    tieLen: spring(0),
    tieSway: spring(0),
    tieLag: spring(0),
    question: '',
    questionAge: 9,
    questionNext: 2.5,
    asked: 0,
    flashNext: 1,
    flashT: 9,
    flashCam: 0,
    heliNear: false,
    events: { cannon: false, flash: false, question: false, heli: false, latch: false, lift: false, podium: false },
  };
}

export function resetRally(r: Rally): void {
  const { rotor, phase } = r;
  Object.assign(r, createRally());
  r.rotor = rotor;
  r.phase = phase;
}

/** You leave: the seat empties, with a puff of green confetti the first time (none under reduced motion). */
export function leaveSeat(r: Rally, reduced: boolean): void {
  if (r.leaving) return;
  r.leaving = true;
  if (reduced) return;
  spawn(r, 168, 452, mulberry32(69), 22, ['#7cf67c', '#d5fb6d', '#ffffff']);
}

/** The dump. `quiet` jumps to the end pose, for a crash that already happened; `reduced` plays it without the confetti. */
export function dumpRally(r: Rally, seed: number, quiet: boolean, reduced: boolean): void {
  if (r.crashed) return;
  r.crashed = true;
  r.liftV = 0;
  // The hook is on his collar in the dump's first frame, however far down it had come.
  settleSpring(r.reach, 1);
  if (quiet) {
    r.crashT = 3;
    r.tip.x = 1;
    r.droop.x = 1;
    r.lift = LIFT_MAX;
    settleSpring(r.tieLag, LIFT_MAX);
    r.heliX.x = 600;
    r.heliY.x = 90;
    r.surge = 1;
    r.question = 'NO COMMENT';
    r.questionAge = 9;
    return;
  }
  r.question = 'SIR, DID YOU JUST RUG?';
  r.questionAge = 0;
  if (reduced) return;
  const rand = mulberry32(seed);
  spawn(r, 230, 300, rand);
  spawn(r, 560, 300, rand);
}

/** `tension` is 1 - 1/x: a third at 1.5×, half at 2×, two thirds at 3×. `staked` is false for a spectator. */
export interface RallyDrive { running: boolean; multiplier: number; tension: number; reduced: boolean; staked?: boolean; }

/** How many milestone cannons a round has earned by this multiplier. */
const marksPassed = (multiplier: number): number => MARKS.filter((mark) => multiplier >= mark).length;
/** The slow driver for long rounds: 0 at 1×, a third at 10×, all of it at 1000×. */
const lateFor = (multiplier: number): number => clamp(Math.log10(Math.max(1, multiplier)) / 3, 0, 1);
/** How far the tie has grown at this tension: peeking out by 1.5×, out from under the podium by 2×, on the floor by 3×, pooled near 10×. */
const tieFor = (tension: number): number => smoothstep(0.18, 1, tension);
/** Where the helicopter waits: peeking out from behind the tracker before the round, closing in and coming down as the number climbs. */
const heliXFor = (tension: number): number => 690 - 120 * tension;
const heliYFor = (tension: number): number => mix(96, 148, smoothstep(0.15, 0.6, tension));
/** The cable starts down at 1.4×, swipes to within a hand of his collar and misses around 1.8× (not under reduced motion), and hooks on near 2.6×. */
const reachFor = (tension: number, reduced: boolean): number => Math.min(1, smoothstep(0.28, 0.64, tension) + (reduced ? 0 : 0.55) * Math.sin(Math.PI * smoothstep(0.39, 0.48, tension)));

/**
 * Puts the rally where the view says the round already is, for the part of a round the scene did not
 * watch: the cannons it passed are counted but not fired, the flags, the tie and the helicopter sit where
 * the tension holds them, and a seat you already left is empty.
 */
export function settleRally(r: Rally, drive: RallyDrive, left: boolean): void {
  r.cannons = Math.max(r.cannons, marksPassed(drive.multiplier));
  settleSpring(r.droop, drive.tension * 0.15);
  settleSpring(r.heliX, heliXFor(drive.tension));
  settleSpring(r.heliY, heliYFor(drive.tension));
  settleSpring(r.tieLen, tieFor(drive.tension));
  settleSpring(r.tip, drive.running ? drive.tension * 0.13 : 0);
  settleSpring(r.reach, drive.running ? reachFor(drive.tension, drive.reduced) : 0);
  settleSpring(r.you, drive.staked ? 1 : 0);
  r.staked = drive.staked === true;
  r.heliNear = drive.tension > 0.28;
  if (left) {
    // Long gone: off the picture, the neighbours facing the stage again, the signs already flipped.
    r.leaving = true;
    r.seatX = -40;
    r.seatAge = 9;
  }
}

/** The next thing the press shouts: the tension picks the row (or the one below), never the same line twice running. */
function nextQuestion(r: Rally, tension: number, multiplier: number): string {
  if (multiplier >= 10 && r.asked >= QUESTIONS.length) return FOLLOWUPS[r.asked++ % FOLLOWUPS.length]!;
  const row = Math.min(QUESTIONS.length - 1, Math.floor(tension * 7));
  const rows = [row, Math.max(0, row - 1)].filter((i, k, all) => all.indexOf(i) === k && QUESTIONS[i] !== r.question);
  r.asked += 1;
  const pick = rows[Math.floor(noise(r.asked * 3.3 + 0.5) * rows.length)];
  return pick === undefined ? QUESTIONS[row]! : QUESTIONS[pick]!;
}

export function stepRally(r: Rally, drive: RallyDrive, dt: number): void {
  const e = r.events;
  e.cannon = e.flash = e.question = e.heli = e.latch = e.lift = e.podium = false;
  const oldHeliV = r.heliX.v, oldLiftV = r.liftV;
  r.time += dt;
  r.cannonT += dt;
  r.staked = drive.staked === true;
  // Integrated, so a speed that follows the tension changes the tempo without jumping the cycle.
  const nerves = drive.reduced ? 0 : dt;
  const ph = r.phase;
  ph.tie += dt * (2.5 + 5 * drive.tension);
  ph.wig += nerves * (3 + 6 * drive.tension);
  ph.mouth += nerves * (4 + 8 * drive.tension);
  ph.sweat += nerves * (0.45 + 0.9 * drive.tension);
  ph.shutter += dt * (3 + 8 * drive.tension);
  const wasT = r.crashT;
  r.crashT += r.crashed ? dt : 0;
  const crossed = (at: number): boolean => r.crashed && wasT <= at && r.crashT > at;
  // Reduced motion slows the rotor (and the bob that follows it) rather than stopping the helicopter dead.
  r.rotor += dt * (10 + drive.tension * 16 + (r.crashed ? 14 : 0)) * (drive.reduced ? 0.2 : 1);
  const marks = marksPassed(drive.multiplier);
  if (drive.running && marks > r.cannons) {
    if (!drive.reduced) {
      const rand = mulberry32(marks * 17 + 3);
      spawn(r, 210, 310, rand);
      spawn(r, 560, 300, rand);
    }
    r.cannons = marks;
    r.cannonT = 0;
    e.cannon = true;
  }
  // From 1.4× the helicopter is close enough to hear, and its cable starts down toward him.
  if (drive.running && !r.heliNear && drive.tension > 0.28) {
    r.heliNear = true;
    e.heli = true;
  }
  const wasReach = r.reach.x;
  // Stiff enough that the swipe reaches about 0.89 (the latch is at 0.97), then pulls back to about 0.6 before it comes down again.
  stepSpring(r.reach, r.crashed ? 1 : drive.running ? reachFor(drive.tension, drive.reduced) : 0, 6, 1, dt);
  if (drive.running && wasReach < 0.97 && r.reach.x >= 0.97) e.latch = true;
  if (crossed(LIFT_DELAY)) e.lift = true;
  if (crossed(PODIUM_DELAY)) e.podium = true;
  // The podium leans with the tension (3° at 2×) and trembles from 2×; after the crash it goes over a beat after the yank.
  const tremble = !drive.reduced && drive.running && drive.tension > 0.5 ? (noise(Math.floor(r.time * 28)) - 0.5) * 0.06 * smoothstep(0.5, 0.85, drive.tension) : 0;
  const tipTarget = r.crashed ? (r.crashT > PODIUM_DELAY ? 1 : 0) : drive.running ? drive.tension * 0.13 + tremble : 0;
  stepSpring(r.tip, tipTarget, r.crashed ? 5 : 9, r.crashed ? 0.55 : 0.7, dt);
  stepSpring(r.droop, r.crashed ? 1 : drive.tension * 0.15, 3, 0.8, dt);
  stepSpring(r.heliX, r.crashed ? 600 : heliXFor(drive.tension), 2.4, 0.9, dt);
  // Long rounds: the hover bob grows from about 30× so the picture keeps moving.
  const bob = Math.sin(r.time * Math.PI / 12) * (4 + 20 * smoothstep(0.45, 0.65, lateFor(drive.multiplier)));
  stepSpring(r.heliY, r.crashed ? 50 : heliYFor(drive.running ? drive.tension : 0) + bob, 2.2, 0.85, dt);
  // The yank: the lift starts a beat after the frame and picks up speed, so he leaves faster than he rose.
  if (r.crashed && r.crashT > LIFT_DELAY) {
    const lift = { x: r.lift, v: r.liftV };
    stepSpring(lift, LIFT_MAX, 4, 1, Math.min(dt, r.crashT - LIFT_DELAY)); r.lift = lift.x; r.liftV = lift.v;
  }
  // He swings in under the helicopter as the lift takes him, rather than trailing beside it.
  stepSpring(r.travel, (r.heliX.x - 430) * 0.9 * smoothstep(0, LIFT_MAX, r.lift), 4, 1, dt);
  if (r.lift > 0 && dt > 0) r.swing.v += ((r.heliX.v - oldHeliV) * -0.002 + (r.liftV - oldLiftV) * 0.001) * (drive.reduced ? 0.25 : 1);
  stepSpring(r.swing, 0, 3.4, 0.3, dt);
  // The tie grows with the tension and flaps in the downdraft; its tail lags the lift and swings up after him.
  stepSpring(r.tieLen, drive.running || r.crashed ? tieFor(drive.tension) : 0, 1.6, 0.9, dt);
  const wind = clamp((700 - r.heliX.x) / 110, 0, 1);
  const flap = Math.sin(ph.tie) * (6 + 30 * drive.tension) + Math.sin(r.time * 7.3) * 10 * wind - 34 * wind;
  stepSpring(r.tieSway, drive.reduced ? flap * 0.3 : flap, 5, 0.35, dt);
  stepSpring(r.tieLag, r.lift, 3.2, 0.45, dt);
  stepSpring(r.you, r.staked || r.leaving ? 1 : 0, 14, drive.reduced ? 1 : 0.55, dt);
  // You stand for 0.3 s, then pick up to a hurried walk over the next 0.3 s; the feet follow the distance walked.
  if (r.leaving) { r.seatAge += dt; r.seatX -= 130 * smoothstep(0.3, 0.6, r.seatAge - dt / 2) * dt; }
  if (r.crashed) r.surge = Math.min(1, r.surge + dt * 0.8);
  // The press pool: a question every few seconds, sooner with the tension, and camera flashes between them.
  r.questionAge += dt;
  r.flashT += dt;
  if (drive.running && !r.crashed && r.time > r.questionNext) {
    r.question = nextQuestion(r, drive.tension, drive.multiplier);
    r.questionAge = 0;
    r.questionNext = r.time + 3.6 - 1.9 * drive.tension + noise(r.time) * 1.2;
    e.question = true;
  }
  if (crossed(2.4)) {
    r.question = 'SIR?? HE LEFT';
    r.questionAge = 0;
  }
  const flashing = drive.running || (r.crashed && r.crashT < 3);
  if (flashing && r.time > r.flashNext) {
    r.flashNext = r.time + Math.max(0.45, 1.7 - 1.25 * drive.tension) * (0.7 + noise(r.time * 3) * 0.6);
    r.flashT = 0;
    r.flashCam = Math.floor(noise(r.time * 5) * 3);
    e.flash = true;
  }
  for (const bit of r.bits) {
    bit.age += dt;
    bit.vy += 280 * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.rot += bit.vr * dt;
  }
  r.bits = r.bits.filter((bit) => bit.age < bit.life);
}

const CONFETTI = ['#f0c14a', '#ff4d4d', '#d5fb6d', '#ffffff', '#7ec8ff'];

function spawn(r: Rally, x: number, y: number, rand: () => number, count = 16, colors = CONFETTI): void {
  if (r.bits.length > 120) return;
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (rand() - 0.5) * 1.4;
    const speed = 120 + rand() * 180;
    r.bits.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 1.3 + rand(),
      color: colors[i % colors.length]!,
      rot: rand() * 6,
      vr: rand() * 8 - 4,
    });
  }
}

/** Two lines that fit the podium screen. A character slice was cutting words in half. */
export function prompter(multiplier: number, crashed: boolean): readonly [string, string] {
  if (crashed || multiplier >= 12) return ['NEVER HEARD', 'OF THIS COIN'];
  if (multiplier < 1.3) return ['GM', 'PATRIOTS'];
  if (multiplier < 1.8) return ["THE PEOPLE'S", 'COIN'];
  if (multiplier < 2.6) return ['NUMBER ONLY', 'GOES UP'];
  if (multiplier < 4) return ['TREMENDOUS', 'BAGS'];
  if (multiplier < 7) return ['MY FRIENDS', 'BOUGHT EARLY'];
  return ['I DO NOT OWN', 'ANY OF IT'];
}

type Point = { x: number; y: number };

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return {
    x: root.x + (dx / distance) * along - (dy / distance) * bend,
    y: root.y + (dy / distance) * along + (dx / distance) * bend,
  };
}

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): Point {
  const joint = bendJoint(a, b, upper, lower, side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 4;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(joint.x, joint.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(joint.x, joint.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  return joint;
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, droop: number, time: number, tension: number): void {
  const sway = Math.sin(time * 2 + x) * (4 + tension * 10);
  ctx.save();
  ctx.translate(x, 300);
  ctx.rotate(droop * 1.3);
  ctx.strokeStyle = '#c9d1d9';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(0, -150 + sway);
  ctx.stroke();
  ctx.translate(0, -150 + sway);
  ctx.fillStyle = '#16351f';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(70, 14);
  ctx.lineTo(8, 36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d5fb6d';
  ctx.fillRect(16, 10, 8, 16);
  ctx.restore();
}

/** A bead of sweat that swells at the temple and runs down the cheek; `u` is how far through its run it is. */
function drawSweat(ctx: CanvasRenderingContext2D, side: number, u: number, amount: number): void {
  const size = 3.4 * smoothstep(0, 0.25, u) * amount;
  if (size < 0.3) return;
  const run = smoothstep(0.45, 0.95, u) ** 2;
  const x = side * (16 - 3 * run);
  const y = -87 + 22 * run;
  ctx.globalAlpha = 1 - smoothstep(0.85, 1, u);
  ctx.fillStyle = '#a8dcff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - size * 2.2);
  ctx.quadraticCurveTo(x + size * 1.2, y, x, y + size);
  ctx.quadraticCurveTo(x - size * 1.2, y, x, y - size * 2.2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCandidate(ctx: CanvasRenderingContext2D, r: Rally, tension: number, time: number, late: number, reduced: boolean): void {
  const { lift, crashed } = r;
  // The nerves start at 1.4× and grow with the tension; the thumb and the head take them.
  const jitter = crashed ? 0 : Math.sin(time * 42) * 4 * tension * smoothstep(0.26, 0.38, tension);
  const tie = Math.sin(r.phase.wig) * (4 + tension * 8);
  ctx.save();
  ctx.translate(430 + r.travel.x, 328 - lift);
  // On the cable he swings from the collar, so the tie's root stays put.
  if (r.swing.x !== 0) {
    ctx.translate(0, -46);
    ctx.rotate(r.swing.x);
    ctx.translate(0, 46);
  }
  // Hips, bent knees and boots become visible when the cable lifts him clear; the kicking grows as he leaves the floor.
  // Each knee bends out to its own side, so the legs never cross; standing, they are nearly straight.
  for (const side of [-1, 1]) {
    const kick = Math.sin(time * 3 + side) * 12 * smoothstep(4, 40, lift);
    limb(ctx, { x: side * 13, y: 12 }, { x: side * 18 + kick, y: 84 - Math.abs(kick) }, 38, 36, -side, 15, '#1d3354');
    ctx.fillStyle = '#171922'; ctx.fillRect(side * 18 + kick - 8, 78 - Math.abs(kick), 25, 10);
  }
  ctx.fillStyle = SKIN; ctx.fillRect(-8, -60, 16, 17);
  // Body and tie. The tie and the thumb get the nerves. The hair does not.
  ctx.fillStyle = '#1d3354';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-38, 20);
  ctx.lineTo(-32, -50);
  ctx.lineTo(32, -50);
  ctx.lineTo(42, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4f6f8';
  ctx.beginPath();
  ctx.moveTo(-8, -48);
  ctx.lineTo(8, -48);
  ctx.lineTo(4, -10);
  ctx.lineTo(-4, -10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.lineTo(tie * 0.3, -8);
  ctx.stroke();
  // The free arm hangs. The other bends up into the thumb.
  limb(ctx, { x: -24, y: -32 }, { x: -42, y: 10 }, 28, 26, 1, 8, '#1d3354');
  const wrist = { x: 64, y: -38 + jitter * 0.4 };
  limb(ctx, { x: 22, y: -30 }, wrist, 28, 24, wrist.y >= -30 ? -1 : 1, 9, '#1d3354');
  const thumb = { x: 72, y: -62 + jitter };
  limb(ctx, wrist, thumb, 14, 12, thumb.y >= wrist.y ? -1 : 1, 5, SKIN);
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(wrist.x, wrist.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Head, jittered, and in a long round swaying as he looks up at the helicopter. Hair is drawn at the unshaken origin on purpose.
  ctx.save();
  ctx.translate(jitter * 0.8 + (crashed ? 0 : Math.sin(time * Math.PI / 10) * 4 * smoothstep(0.4, 0.6, late)), 0);
  ctx.beginPath();
  ctx.ellipse(0, -78, 20, 22, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ink(ctx, 2);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(-6, -80, 2, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(7, -80, 2, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  const flap = Math.abs(Math.sin(r.phase.mouth));
  ctx.beginPath();
  ctx.ellipse(2, -66, 6, 2 + flap * 3, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Sweat from 1.6×, a second bead from 3×. Under reduced motion the beads sit still.
  const bead = (offset: number): number => (reduced ? 0.32 : fract(r.phase.sweat + offset));
  drawSweat(ctx, 1, bead(0), smoothstep(0.36, 0.42, tension));
  drawSweat(ctx, -1, bead(0.47), smoothstep(0.65, 0.7, tension));
  ctx.restore();
  ctx.fillStyle = '#e6c56a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-24, -84);
  ctx.quadraticCurveTo(-46, -120, -4, -118);
  ctx.quadraticCurveTo(40, -130, 36, -86);
  ctx.quadraticCurveTo(10, -96, -24, -84);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * The tie. It starts tucked behind the podium, grows out from under it with the tension until it drags on the
 * floor and flaps in the downdraft, and trails under him when the helicopter takes him, its tail a beat behind.
 */
function drawTie(ctx: CanvasRenderingContext2D, r: Rally): void {
  const len = 30 + 300 * clamp(r.tieLen.x, 0, 1);
  if (len < 60 && r.lift < 4) return;
  const collar = { x: 430 + r.travel.x, y: 282 - r.lift };
  const lag = clamp(r.lift - r.tieLag.x, -80, 160);
  const sway = r.tieSway.x;
  const floor = 428;
  let tipY = collar.y + len + lag;
  let pooled = 0;
  if (tipY > floor) {
    pooled = tipY - floor;
    tipY = floor;
  }
  const side = sway < 0 ? -1 : 1;
  const tip = { x: collar.x + sway + side * Math.min(pooled, 110), y: tipY };
  const ctrl = { x: collar.x + sway * 0.35, y: mix(collar.y, tip.y, 0.55) + lag * 0.35 };
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(collar.x, collar.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y);
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 16;
  path();
  ctx.stroke();
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 12;
  path();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 16]);
  path();
  ctx.stroke();
  ctx.setLineDash([]);
  // The point, along the tangent at the tip.
  const tx = tip.x - ctrl.x;
  const ty = tip.y - ctrl.y;
  const d = Math.max(1, Math.hypot(tx, ty));
  const ux = tx / d;
  const uy = ty / d;
  ctx.fillStyle = '#c0392b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(tip.x - uy * 7, tip.y + ux * 7);
  ctx.lineTo(tip.x + ux * 14, tip.y + uy * 14);
  ctx.lineTo(tip.x + uy * 7, tip.y - ux * 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The press pool's question, in a bubble above the cameras: below the banner, above the seat, left of the crowd's signs. */
function drawQuestion(ctx: CanvasRenderingContext2D, r: Rally): void {
  if (!r.question || r.questionAge > 2.6) return;
  const rise = r.questionAge < 0.18 ? (0.18 - r.questionAge) / 0.18 : 0;
  const fade = r.questionAge > 2.2 ? 1 - (r.questionAge - 2.2) / 0.4 : 1;
  ctx.save();
  ctx.globalAlpha = clamp(fade, 0, 1);
  ctx.font = '700 10px system-ui, sans-serif';
  const w = Math.min(184, ctx.measureText(r.question).width + 18);
  const x = 22;
  const y = 366 + rise * 10;
  ctx.fillStyle = r.crashed ? '#ff4d6d' : '#f7f4ea';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, 24, 6);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 36, y + 23);
  ctx.lineTo(x + 50, y + 23);
  ctx.lineTo(x + 42, y + 38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = r.crashed ? '#ffffff' : INK;
  ctx.textAlign = 'left';
  ctx.fillText(r.question, x + 9, y + 16, w - 18);
  ctx.restore();
}

/** What sign `i` reads now, its colour, and how edge-on it is mid-flip (1 flat, 0 edge-on). */
function signFace(r: Rally, i: number, reduced: boolean): { text: string; colour: string; squash: number } {
  let text = SIGNS[i % SIGNS.length]!;
  let colour = '#f7f4ea';
  let squash = 1;
  const flip = (age: number, next: string, tint: string): void => {
    const u = reduced ? (age > 0 ? 1 : 0) : clamp(age / 0.3, 0, 1);
    if (u >= 0.5) { text = next; colour = tint; }
    squash = Math.min(squash, Math.abs(Math.cos(Math.PI * u)));
  };
  // Your cash-out: the nearest sign calls you a jeet, then the one behind it.
  if (r.leaving && (i === 0 || i === 2)) flip(r.seatAge - (i ? 0.75 : 0.4), i ? 'PAPER HANDS' : 'JEET', '#b8f5a0');
  // The dump: the signs turn one after another. A spectator gets asked; a jeet gets told they were right.
  if (r.crashed) {
    const spectator = !r.staked && !r.leaving;
    flip(r.crashT - 0.1 - 0.1 * i - 0.08 * noise(i * 5.1), spectator ? 'SOLD THE TOP?' : r.leaving && i === 0 ? 'JEET WAS RIGHT' : 'RUGGED', spectator ? '#ffe08a' : r.leaving && i === 0 ? '#b8f5a0' : '#ff4d6d');
  }
  return { text, colour, squash };
}

function drawCrowd(ctx: CanvasRenderingContext2D, r: Rally, multiplier: number, tension: number, time: number, reduced: boolean): void {
  // About two people a second join on the multiplier's curve, each popping in over a quarter second.
  const count = clamp(10 + Math.log2(Math.max(1, multiplier)) * 18, 10, FANS.length);
  const motion = reduced ? 0 : 1;
  const rowdy = 1 + 3 * tension + 2 * lateFor(multiplier);
  // Your neighbours turn to watch you go, then face the stage again.
  const watch = r.leaving ? smoothstep(0.1, 0.4, r.seatAge) * (1 - smoothstep(2, 2.6, r.seatAge)) : 0;
  const signs: { x: number; y: number; i: number; s: number }[] = [];
  for (const fan of FANS) {
    const grow = clamp((count - fan.rank) * 2, 0, 1);
    if (grow <= 0) continue;
    const s = reduced ? grow : 1 + 2.7 * (grow - 1) ** 3 + 1.7 * (grow - 1) ** 2;
    // Each bobs at their own tempo, harder as the number climbs, and hops when a cannon goes off, the wave running along the row.
    const bob = Math.sin(time * (1.6 + 0.8 * fan.h) + 6.28 * fan.h2) * rowdy * motion;
    const hopT = r.cannonT - 0.04 * fan.col - 0.1 * fan.h;
    const hop = hopT > 0 && hopT < 0.36 ? Math.sin((Math.PI * hopT) / 0.36) * 9 * motion : 0;
    const x = fan.x;
    const y = 470 - fan.row * 28 - r.surge * (18 + fan.row * 6) - bob - hop;
    const heard = Math.max(0, 1 - Math.abs(r.questionAge - fan.row * 0.13 - 0.25 - 0.3 * fan.h) * 2) * (reduced ? 0.25 : 1) * (0.6 + 0.8 * fan.h2);
    const neighbour = watch > 0 && fan.row === 0 && (fan.col === 1 || fan.col === 3);
    const facing = neighbour ? clamp((r.seatX - x) / 20, -1, 1) * watch : 0;
    const hx = x + heard * (r.crashed ? 4 : -3) + facing * 4;
    const hy = y - heard * 2;
    ctx.save();
    ctx.translate(x, y + 21);
    ctx.scale(s, s);
    ctx.translate(-x, -y - 21);
    ctx.fillStyle = fan.colour;
    ink(ctx, 1.5);
    ctx.beginPath(); ctx.roundRect(x - 8, y + 7, 16, 14, 5); ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (neighbour && Math.abs(facing) > 0.05) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(hx + facing * 5 - 3, hy - 2, 1.5, 0, Math.PI * 2);
      ctx.arc(hx + facing * 5 + 3, hy - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (fan.sign >= 0) signs.push({ x, y: y - 28, i: fan.sign, s });
  }
  for (const sign of signs) {
    const face = signFace(r, sign.i, reduced);
    ctx.save();
    ctx.translate(sign.x, sign.y + 35);
    ctx.scale(sign.s, sign.s);
    ctx.strokeStyle = '#b88c63'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(0, 0); ctx.stroke();
    ctx.translate(0, -30);
    ctx.scale(1, Math.max(0.04, face.squash));
    ctx.font = '700 8px system-ui, sans-serif';
    const w = Math.max(56, ctx.measureText(face.text).width + 10);
    ctx.fillStyle = face.colour;
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -7, w, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText(face.text, 0, 3);
    ctx.restore();
  }
}

function drawPress(ctx: CanvasRenderingContext2D, r: Rally, reduced: boolean): void {
  for (let i = 0; i < 3; i += 1) {
    const x = 36 + i * 28;
    ctx.fillStyle = '#222';
    ctx.fillRect(x, 430, 22, 16);
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(x + 11, 426, 8, 0, Math.PI * 2);
    ctx.fill();
    const flash = !reduced && (noise(Math.floor(r.phase.shutter) + i * 4) > 0.62 || (r.flashT < 0.1 && r.flashCam === i));
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(x + 11, 400, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHeli(ctx: CanvasRenderingContext2D, r: Rally, reduced: boolean): void {
  ctx.save();
  ctx.translate(r.heliX.x, r.heliY.x);
  ctx.fillStyle = '#697b8b';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 36, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(62, -8);
  ctx.lineTo(62, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a5e7ef'; ctx.beginPath(); ctx.ellipse(-15, -2, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d7e2e9'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, -29); ctx.moveTo(-24, 16); ctx.lineTo(-24, 25); ctx.lineTo(28, 25); ctx.moveTo(19, 16); ctx.lineTo(19, 25); ctx.stroke();
  // Rotor. A disc, so the blades read as spinning rather than a still cross.
  ctx.strokeStyle = 'rgba(230,230,230,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -30, 54, 6 + Math.abs(Math.sin(r.rotor)) * 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // The cable: it pays out toward his collar from 1.4×, hooks on near 2.6× and hangs slack until the yank pulls it taut.
  const reach = clamp(r.reach.x, 0, 1);
  if (reach > 0.01) {
    const top = { x: r.heliX.x, y: r.heliY.x + 16 };
    const end = { x: mix(top.x, 430 + r.travel.x, reach), y: mix(top.y, 282 - r.lift, reach) };
    const slack = 75 * smoothstep(0, 0.5, reach) * (1 - smoothstep(0, LIFT_DELAY + 0.15, r.crashT));
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.quadraticCurveTo((top.x + end.x) / 2, (top.y + end.y) / 2 + slack, end.x, end.y);
    ctx.stroke();
    if (reach < 0.97) {
      // The hook, swinging a little under the cable's end.
      ctx.save();
      ctx.translate(end.x, end.y);
      if (!reduced) ctx.rotate(Math.sin(r.time * 2.2) * 0.25);
      ink(ctx, 2.5);
      ctx.strokeStyle = '#c9d1d9';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 8);
      ctx.arc(-4, 8, 4, 0, Math.PI * 0.9);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Downdraft.
  const wind = clamp(r.crashed ? 0.7 : (700 - r.heliX.x) / 160, 0, 0.7);
  ctx.strokeStyle = `rgba(255,255,255,${wind * 0.35})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const x = r.heliX.x - 30 + i * 16;
    ctx.beginPath();
    ctx.moveTo(x, r.heliY.x + 20);
    ctx.lineTo(x + 6, r.heliY.x + 80);
    ctx.stroke();
  }
}

export function drawRally(ctx: CanvasRenderingContext2D, r: Rally, multiplier: number, tension: number, time: number, reduced: boolean): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 420);
  sky.addColorStop(0, '#1a1030');
  sky.addColorStop(0.55, '#6a2a3a');
  sky.addColorStop(1, '#e38a4a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#2a241c';
  ctx.fillRect(0, 430, 960, 110);
  // Banner. The slogan is the joke; the person under it is a wojak in a suit.
  ctx.fillStyle = '#8d1d2c';
  ctx.fillRect(16, 88, 300, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '900 16px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MAKE BAGS GREAT AGAIN', 28, 111);
  const late = lateFor(multiplier);
  drawFlag(ctx, 250, r.droop.x, time, tension + late);
  drawFlag(ctx, 590, r.droop.x, time, tension + late);
  drawCandidate(ctx, r, tension, time, late, reduced);
  drawTie(ctx, r);
  // Podium, in front of his waist so the teleprompter stays readable.
  ctx.save();
  ctx.translate(430, 300);
  ctx.rotate(r.tip.x * 0.9);
  ctx.fillStyle = '#6b2a32';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-70, 40);
  ctx.lineTo(70, 40);
  ctx.lineTo(50, -20);
  ctx.lineTo(-50, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The seal and the department it belongs to, under the teleprompter.
  ctx.fillStyle = '#f0c14a';
  ctx.beginPath();
  ctx.arc(-46, 27, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 10px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', -46, 31);
  ctx.fillStyle = '#f0c14a';
  ctx.font = '900 8px Impact, "Arial Black", sans-serif';
  ctx.fillText('DEPT OF DEGENERACY', 8, 31);
  // Teleprompter.
  ctx.fillStyle = '#07140c';
  ctx.fillRect(-64, -22, 128, 36);
  ctx.fillStyle = '#39ff8a';
  ctx.font = '700 11px ui-monospace, monospace';
  const [topLine, bottomLine] = prompter(multiplier, r.crashed);
  ctx.fillText(topLine, 0, -4);
  ctx.fillText(bottomLine, 0, 10);
  ctx.restore();
  drawCrowd(ctx, r, multiplier, tension, time, reduced);
  drawPress(ctx, r, reduced);
  drawQuestion(ctx, r);
  // The seat: gold and waiting for a spectator, yours once you bet, empty once you have walked.
  ctx.fillStyle = r.leaving && r.seatX < 80 ? '#3a342c' : '#f0c14a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(150, 468, 36, 14, 3);
  ctx.fill();
  ctx.stroke();
  if (r.you.x > 0.02 && r.seatX > -20) {
    ctx.save();
    const stand = smoothstep(0, 0.3, r.seatAge), distance = 168 - r.seatX;
    ctx.translate(r.seatX, 482);
    ctx.scale(r.you.x, r.you.x);
    ctx.translate(0, -12);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    // Both knees point the way you walk (left), seated or striding, so the legs never cross or flip.
    for (const side of [-1, 1]) {
      const phase = ((distance / 24 + (side > 0 ? 0.5 : 0)) % 1 + 1) % 1, swing = smoothstep(0.6, 1, phase);
      const foot = { x: side * 4 - (0.3 - phase + swing) * 24 * stand, y: 12 - Math.sin(Math.PI * swing) * 6 * stand };
      limb(ctx, { x: side * 3, y: 3 - stand * 8 }, foot, 12, 12, 1, 3, '#1d3354');
    }
    ctx.translate(0, -stand * 8);
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(0, -16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#d5fb6d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-6, 4);
    ctx.moveTo(0, -8);
    ctx.lineTo(8, 2);
    ctx.stroke();
    if (r.leaving) {
      ctx.fillStyle = '#111';
      ctx.fillRect(-6, -20, 5, 3);
      ctx.fillRect(1, -20, 5, 3);
    }
    ctx.restore();
  }
  drawHeli(ctx, r, reduced);
  for (const bit of r.bits) {
    ctx.save();
    ctx.translate(bit.x, bit.y);
    ctx.rotate(bit.rot);
    ctx.globalAlpha = clamp(1 - bit.age / bit.life, 0, 1);
    ctx.fillStyle = bit.color;
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function cannonCount(r: Rally): number {
  return r.cannons;
}
