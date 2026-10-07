/**
 * The rally: a fictional candidate (generic cartoon, not a portrait), the
 * podium, flags, crowd, press pool, confetti cannons, helicopter and the
 * seat you can still leave. Hair is drawn without the head's shake.
 */
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const SKIN = '#f3dccb';
const MARKS = [1.5, 2.2, 3.2, 4.8, 7, 10, 14, 20];
/** One per sign holder, in the order they join the crowd. */
const SIGNS = ['SEND IT', 'WAGMI', 'BUY HIGH', 'LFG', 'HE CARES', 'MY RENT', 'TRUST ME', 'NO KYC'];
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
export interface RallyEvents { cannon: boolean; flash: boolean; question: boolean; heli: boolean; lift: boolean; podium: boolean; }

export interface Rally {
  tip: Spring;
  droop: Spring;
  lift: number;
  /** The lift's speed: the helicopter yanks harder the longer it pulls. */
  liftV: number;
  heliX: Spring;
  heliY: Spring;
  crashed: boolean;
  crashT: number;
  bits: Bit[];
  cannons: number;
  seatX: number;
  leaving: boolean;
  surge: number;
  rotor: number;
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
    liftV: 0,
    heliX: spring(760),
    heliY: spring(78),
    crashed: false,
    crashT: 0,
    bits: [],
    cannons: 0,
    seatX: 168,
    leaving: false,
    surge: 0,
    rotor: 0,
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
    events: { cannon: false, flash: false, question: false, heli: false, lift: false, podium: false },
  };
}

export function resetRally(r: Rally): void {
  const rotor = r.rotor;
  Object.assign(r, createRally());
  r.rotor = rotor;
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
  if (quiet) {
    r.crashT = 3;
    r.tip.x = 1;
    r.droop.x = 1;
    r.lift = LIFT_MAX;
    settleSpring(r.tieLag, LIFT_MAX);
    r.heliX.x = 470;
    r.heliY.x = 10;
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

export interface RallyDrive { running: boolean; multiplier: number; tension: number; reduced: boolean; }

/** How many milestone cannons a round has earned by this multiplier. */
const marksPassed = (multiplier: number): number => MARKS.filter((mark) => multiplier >= mark).length;
/** How far the tie has grown at this tension: tucked until the round warms up, dragging on the floor near the top. */
const tieFor = (tension: number): number => smoothstep(0.12, 0.95, tension);

/**
 * Puts the rally where the view says the round already is, for the part of a round the scene did not
 * watch: the cannons it passed are counted but not fired, the flags, the tie and the helicopter sit where
 * the tension holds them, and a seat you already left is empty.
 */
export function settleRally(r: Rally, drive: RallyDrive, left: boolean): void {
  r.cannons = Math.max(r.cannons, marksPassed(drive.multiplier));
  settleSpring(r.droop, drive.tension * 0.15);
  settleSpring(r.heliX, 760 - drive.tension * 80);
  settleSpring(r.tieLen, tieFor(drive.tension));
  r.heliNear = drive.tension > 0.5;
  if (left) {
    r.leaving = true;
    r.seatX = 0;
  }
}

/** The next thing the press shouts: the tension picks the row (or the one below), never the same line twice running. */
function nextQuestion(r: Rally, tension: number): string {
  if (tension >= 1 && r.asked >= QUESTIONS.length) return FOLLOWUPS[r.asked++ % FOLLOWUPS.length]!;
  const row = Math.min(QUESTIONS.length - 1, Math.floor(tension * 7));
  const rows = [row, Math.max(0, row - 1)].filter((i, k, all) => all.indexOf(i) === k && QUESTIONS[i] !== r.question);
  r.asked += 1;
  const pick = rows[Math.floor(noise(r.asked * 3.3 + 0.5) * rows.length)];
  return pick === undefined ? QUESTIONS[row]! : QUESTIONS[pick]!;
}

export function stepRally(r: Rally, drive: RallyDrive, dt: number): void {
  const e = r.events;
  e.cannon = e.flash = e.question = e.heli = e.lift = e.podium = false;
  r.time += dt;
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
    e.cannon = true;
  }
  // From the middle of the tension the helicopter is close enough to hear.
  if (drive.running && !r.heliNear && drive.tension > 0.5) {
    r.heliNear = true;
    e.heli = true;
  }
  if (crossed(LIFT_DELAY)) e.lift = true;
  if (crossed(PODIUM_DELAY)) e.podium = true;
  // The podium leans with the tension and trembles near the top; after the crash it goes over a beat after the yank.
  const tremble = !drive.reduced && drive.running && drive.tension > 0.7 ? (noise(Math.floor(r.time * 28)) - 0.5) * 0.04 * smoothstep(0.7, 1, drive.tension) : 0;
  const tipTarget = r.crashed ? (r.crashT > PODIUM_DELAY ? 1 : 0) : drive.running ? drive.tension * 0.05 + tremble : 0;
  stepSpring(r.tip, tipTarget, r.crashed ? 5 : 9, r.crashed ? 0.55 : 0.7, dt);
  stepSpring(r.droop, r.crashed ? 1 : drive.tension * 0.15, 3, 0.8, dt);
  stepSpring(r.heliX, r.crashed ? 450 : 760 - drive.tension * 80, 2.4, 0.9, dt);
  stepSpring(r.heliY, r.crashed ? 10 + Math.sin(r.rotor * 0.2) * 3 : 70 + Math.sin(r.rotor * 0.2) * 4, 2.2, 0.85, dt);
  // The yank: the lift starts a beat after the frame and picks up speed, so he leaves faster than he rose.
  if (r.crashed && r.crashT > LIFT_DELAY && r.lift < LIFT_MAX) {
    r.liftV = Math.min(260, r.liftV + 340 * dt);
    r.lift = Math.min(LIFT_MAX, r.lift + r.liftV * dt);
  }
  // The tie grows with the tension and flaps in the downdraft; its tail lags the lift and swings up after him.
  stepSpring(r.tieLen, drive.running || r.crashed ? tieFor(drive.tension) : 0, 1.6, 0.9, dt);
  const wind = clamp((760 - r.heliX.x) / 140, 0, 1);
  const flap = Math.sin(r.time * (2.5 + 5 * drive.tension)) * (6 + 30 * drive.tension) + Math.sin(r.time * 7.3) * 10 * wind - 34 * wind;
  stepSpring(r.tieSway, drive.reduced ? flap * 0.3 : flap, 5, 0.35, dt);
  stepSpring(r.tieLag, r.lift, 3.2, 0.45, dt);
  if (r.leaving) r.seatX -= 130 * dt;
  if (r.crashed) r.surge = Math.min(1, r.surge + dt * 0.8);
  // The press pool: a question every few seconds, sooner with the tension, and camera flashes between them.
  r.questionAge += dt;
  r.flashT += dt;
  if (drive.running && !r.crashed && r.time > r.questionNext) {
    r.question = nextQuestion(r, drive.tension);
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
  if (crashed || multiplier >= 13) return ['NEVER HEARD', 'OF THIS COIN'];
  if (multiplier < 1.4) return ['GM', 'PATRIOTS'];
  if (multiplier < 2.1) return ["THE PEOPLE'S", 'COIN'];
  if (multiplier < 3.2) return ['NUMBER ONLY', 'GOES UP'];
  if (multiplier < 5) return ['TREMENDOUS', 'BAGS'];
  if (multiplier < 8) return ['MY FRIENDS', 'BOUGHT EARLY'];
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

function drawCandidate(ctx: CanvasRenderingContext2D, lift: number, tension: number, time: number, crashed: boolean, swing: number): void {
  const jitter = !crashed && tension > 0.45 ? Math.sin(time * 42) * 3 * tension : 0;
  const tie = Math.sin(time * (3 + tension * 6)) * (4 + tension * 8);
  ctx.save();
  ctx.translate(430, 328 - lift);
  // On the cable he swings from the collar, so the tie's root stays put.
  if (swing !== 0) {
    ctx.translate(0, -46);
    ctx.rotate(swing);
    ctx.translate(0, 46);
  }
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
  // Head, jittered. Hair is drawn at the unshaken origin on purpose.
  ctx.save();
  ctx.translate(jitter * 0.8, 0);
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
  const flap = Math.abs(Math.sin(time * (4 + tension * 8)));
  ctx.beginPath();
  ctx.ellipse(2, -66, 6, 2 + flap * 3, 0, 0, Math.PI * 2);
  ctx.stroke();
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
  const collar = { x: 430, y: 282 - r.lift };
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

function drawCrowd(ctx: CanvasRenderingContext2D, multiplier: number, surge: number, crashed: boolean): void {
  const growth = Math.log2(Math.max(1, multiplier));
  const shown = clamp(Math.round(10 + growth * 18), 10, 70);
  const signs: { x: number; y: number; text: string }[] = [];
  for (let i = 0; i < shown; i += 1) {
    const col = i % 14;
    const row = Math.floor(i / 14);
    const x = 70 + col * 42 + (row % 2) * 16;
    const y = 470 - row * 28 - surge * (18 + row * 6);
    if (x > 650) continue;
    ctx.fillStyle = ['#e63946', '#3b82f6', '#f2c14e', '#7cf67c', '#e7eef8'][i % 5]!;
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Two holders on the even rows and one between them on the odd rows: a full crowd raises all eight signs.
    const holds = row % 2 === 0 ? col === 4 || col === 11 : col === 7;
    const sign = { x, y: y - 28, text: SIGNS[signs.length % SIGNS.length]! };
    const crowded = sign.x < 150 || sign.x > 590 || signs.some((other) => Math.hypot(other.x - sign.x, other.y - sign.y) < 56);
    if (holds && !crowded) signs.push(sign);
  }
  for (const sign of signs) {
    ctx.fillStyle = crashed ? '#ff4d6d' : '#f7f4ea';
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.roundRect(sign.x - 28, sign.y - 2, 56, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(crashed ? 'RUGGED' : sign.text, sign.x, sign.y + 8);
  }
}

function drawPress(ctx: CanvasRenderingContext2D, r: Rally, tension: number, time: number, reduced: boolean): void {
  for (let i = 0; i < 3; i += 1) {
    const x = 36 + i * 28;
    ctx.fillStyle = '#222';
    ctx.fillRect(x, 430, 22, 16);
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(x + 11, 426, 8, 0, Math.PI * 2);
    ctx.fill();
    const flash = !reduced && (noise(Math.floor(time * (3 + tension * 8)) + i * 4) > 0.62 || (r.flashT < 0.1 && r.flashCam === i));
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(x + 11, 400, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHeli(ctx: CanvasRenderingContext2D, r: Rally): void {
  ctx.save();
  ctx.translate(r.heliX.x, r.heliY.x);
  ctx.fillStyle = '#2c333c';
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
  // Rotor. A disc, so the blades read as spinning rather than a still cross.
  ctx.strokeStyle = 'rgba(230,230,230,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -8, 54, 6 + Math.abs(Math.sin(r.rotor)) * 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Cable once he is being collected.
  if (r.lift > 4) {
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(r.heliX.x, r.heliY.x + 16);
    ctx.lineTo(430, 250 - r.lift);
    ctx.stroke();
  }
  // Downdraft.
  const wind = clamp(r.crashed ? 0.7 : (760 - r.heliX.x) / 400, 0, 0.7);
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
  drawFlag(ctx, 250, r.droop.x, time, tension);
  drawFlag(ctx, 590, r.droop.x, time, tension);
  const swing = r.lift > 4 ? Math.sin(r.crashT * 3.4) * 0.24 * clamp(r.lift / 90, 0, 1) : 0;
  drawCandidate(ctx, r.lift, tension, time, r.crashed, swing);
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
  drawCrowd(ctx, multiplier, r.surge, r.crashed);
  drawPress(ctx, r, tension, time, reduced);
  drawQuestion(ctx, r);
  // The seat. Empty once you have walked.
  ctx.fillStyle = r.leaving && r.seatX < 80 ? '#3a342c' : '#f0c14a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(150, 468, 36, 14, 3);
  ctx.fill();
  ctx.stroke();
  if (!r.leaving || r.seatX > 40) {
    ctx.save();
    ctx.translate(r.seatX, 470);
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
  drawHeli(ctx, r);
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
