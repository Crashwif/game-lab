/**
 * The shill video's set: a garage behind a beach cloth, the influencer,
 * the rented Lambo, the wallet monitor, the tow and the sponsor card.
 * The cloth, the sticker and the truck are presentation. They never
 * move the committed crash point.
 */
import { clamp, mix, smoothstep, settleSpring, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
export const VIDEO_W = 590;
export const VIDEO_H = 332;
const SKIN = '#f3dccb';
/** Where the tow truck's hook meets the Lambo's rear bumper, and how far it hauls the Lambo out. */
const TOW_LATCH = 540;
const HAULED = 240;

/** How far the RENTAL sticker has peeled at a given tension. */
const peel = (tension: number): number => clamp(tension * 1.15, 0, 1);
/**
 * Where the tow truck waits: its hook peeks in at the right edge, its engine turns over about 1.2×, its light
 * bar edges into frame about 1.55× (its strobe spills in from 1.25×), and it creeps a notch closer with a reversing
 * beep after every sponsor read, never past the latch.
 */
const towWaiting = (tension: number, creeps: number): number => Math.max(TOW_LATCH + 8, 660 - 80 * tension - 9 * creeps);
/** How many PENDING SELL rows the wallet shows at a tension: 1.3×, 1.8×, 3.1× and 11×. */
const pendingRows = (tension: number): number => clamp(Math.floor(tension * 4.4), 0, 4);
/** The cousin's row appears in the wallet from here (1.67×); it dumps harder as the tension climbs. */
const COUSIN_FROM = 0.4;
/** How long a sponsor read is held to camera. */
const READ_S = 2.6;

type Point = { x: number; y: number };
/** His free shoulder at rest, and where that hand goes: the 1000x point, the fetch below frame, the facepalm, the betting wave. */
const SHOULDER: Point = { x: 232, y: 250 };
const REACH = 95;
const POINT: Point = { x: 304, y: 204 };
const HOLD: Point = { x: 306, y: 232 };
const FETCH: Point = { x: 262, y: 336 };
const FACE: Point = { x: 216, y: 219 };
const WAVE: Point = { x: 262, y: 184 };
/** What his pointing finger aims at: the 1000X arrow burned into the top right of the video. */
const ARROW: Point = { x: 482, y: 92 };

/** The sponsor reads: one per milestone, each dumber than the last. */
export const PRODUCTS: { name: string; kind: 'tube' | 'book' | 'can' | 'gloves' | 'vape' | 'tree' | 'candle' | 'kit' }[] = [
  { name: 'NFT TOOTHPASTE', kind: 'tube' },
  { name: 'HARDWARE WALLET (A NOTEBOOK)', kind: 'book' },
  { name: 'AIRDROP ENERGY DRINK', kind: 'can' },
  { name: 'DIAMOND HANDS GLOVES', kind: 'gloves' },
  { name: 'HOPIUM VAPE · 0% NICOTINE 100% COPE', kind: 'vape' },
  { name: 'LAMBO AIR FRESHENER (RENTAL SCENT)', kind: 'tree' },
  { name: 'GENERATIONAL WEALTH CANDLE', kind: 'candle' },
  { name: 'SEED PHRASE TATTOO KIT', kind: 'kit' },
];

/** The influencer's rig: integrated talk, nod and shake phases, a head that lags his body, the free hand on a spring. */
export interface Rig {
  talk: number;
  bob: number;
  tremor: number;
  wave: number;
  /** Mouth flap amplitude and waving amount: eased so no phase change pops them. */
  mouth: number;
  waving: number;
  head: Spring;
  look: Spring;
  slump: Spring;
  hand: { x: Spring; y: Spring };
}

export interface Studio {
  rig: Rig;
  tear: number;
  fall: Spring;
  sticker: Spring;
  truck: Spring;
  pull: number;
  sponsor: Spring;
  crashed: boolean;
  crashT: number;
  soldFlash: number;
  /** The sponsor read held to camera: which product, how far up (a spring), and for how long. */
  read: { index: number; hold: Spring; age: number };
  readsShown: number;
  /** Time between sponsor spots once the opening milestone reads have finished. */
  encoreClock: number;
  pending: number;
  /** Your subscriber's screenshot: a shutter flash over the video. */
  flash: number;
  truckIn: boolean;
  beepClock: number;
  beeps: number;
  /** Sponsor reads that have finished: the truck creeps in a notch after each one. */
  creeps: number;
  /** The read on screen came from a milestone (an encore read does not move the truck). */
  rungRead: boolean;
  /** The Lambo's rear lifted on the hook. */
  lift: number;
  /** The product he was holding when the wallet posted SOLD, falling out of frame. */
  drop: { x: number; y: number; vy: number; spin: number; index: number } | null;
  /** A new take fades up from black, so the reset after a crash never pops. */
  cut: number;
  events: { pending: boolean; read: boolean; truck: boolean; beep: boolean };
}

export interface StudioDrive {
  running: boolean;
  tension: number;
  /** How many milestones the round has passed: each one is a sponsor read. */
  reads: number;
  /** Seconds since the run started (glances at the wallet are timed on it). */
  elapsed?: number;
  /** A slow log driver for long rounds: 0 at 1×, 1 at 1000×. */
  long?: number;
  /** Reduced motion: the rig holds still instead of nodding, talking and shaking. */
  still?: boolean;
}

function createRig(): Rig {
  return {
    talk: 0, bob: 0, tremor: 0, wave: 0, mouth: 1, waving: 1,
    head: spring(0), look: spring(0), slump: spring(0),
    hand: { x: spring(WAVE.x), y: spring(WAVE.y) },
  };
}

export function createStudio(): Studio {
  return {
    rig: createRig(),
    tear: 0,
    fall: spring(0),
    sticker: spring(0),
    truck: spring(660),
    pull: 0,
    sponsor: spring(0),
    crashed: false,
    crashT: 0,
    soldFlash: 0,
    read: { index: -1, hold: spring(0), age: 0 },
    readsShown: 0,
    encoreClock: 0,
    pending: 0,
    flash: 0,
    truckIn: false,
    beepClock: 0,
    beeps: 0,
    creeps: 0,
    rungRead: false,
    lift: 0,
    drop: null,
    cut: 0,
    events: { pending: false, read: false, truck: false, beep: false },
  };
}

/** A new take. The rig keeps its springs, so he eases out of the facepalm under the fade instead of snapping. */
export function resetStudio(s: Studio): void {
  s.tear = 0;
  s.fall.x = 0;
  s.fall.v = 0;
  s.sticker.x = 0;
  s.sticker.v = 0;
  s.truck.x = 660;
  s.truck.v = 0;
  s.pull = 0;
  s.sponsor.x = 0;
  s.sponsor.v = 0;
  s.crashed = false;
  s.crashT = 0;
  s.soldFlash = 0;
  s.read = { index: -1, hold: spring(0), age: 0 };
  s.readsShown = 0;
  s.encoreClock = 0;
  s.pending = 0;
  s.flash = 0;
  s.truckIn = false;
  s.beepClock = 0;
  s.beeps = 0;
  s.creeps = 0;
  s.rungRead = false;
  s.lift = 0;
  s.drop = null;
  s.cut = 1;
  s.events = { pending: false, read: false, truck: false, beep: false };
}

/** The cash-out beat: your subscriber's screenshot flashes the video. */
export function screenshot(s: Studio): void {
  s.flash = 1;
}

/** Jumps the props to where the tension has them, for a stretch of the round the scene did not draw. */
export function settleStudio(s: Studio, tension: number, reads: number, running = true): void {
  s.tear = tension;
  settleSpring(s.sticker, peel(tension));
  // The reads so far were read and the truck crept in after each; none is held up now.
  s.readsShown = reads;
  s.creeps = Math.min(reads, PRODUCTS.length);
  settleSpring(s.truck, towWaiting(tension, s.creeps));
  s.truckIn = s.truck.x < 645;
  s.pending = pendingRows(tension);
  const hand = running ? POINT : WAVE;
  settleSpring(s.rig.hand.x, hand.x);
  settleSpring(s.rig.hand.y, hand.y);
  s.rig.waving = running ? 0 : 1;
}

/** The reveal. `quiet` (a crash that happened off screen) opens on its aftermath: no SOLD flash, nothing moving. */
export function endStudio(s: Studio, quiet: boolean): void {
  if (s.crashed) return;
  s.crashed = true;
  if (quiet) {
    // The tear and the sticker follow the tension, so they stay where the round left them.
    s.crashT = 3;
    settleSpring(s.fall, 1);
    settleSpring(s.truck, TOW_LATCH);
    s.pull = HAULED;
    s.lift = 1;
    settleSpring(s.sponsor, 1);
    s.beeps = 3;
    const r = s.rig;
    settleSpring(r.slump, 1);
    settleSpring(r.head, 8);
    settleSpring(r.look, 0);
    settleSpring(r.hand.x, FACE.x);
    settleSpring(r.hand.y, FACE.y);
    r.mouth = r.waving = 0;
    settleSpring(s.read.hold, 0);
  } else {
    s.soldFlash = 1;
    s.fall.v = 2;
    if (s.read.index >= 0 && s.read.hold.x > 0.3) {
      // Whatever he was holding up gets dropped: it leaves his hand and falls out of frame.
      s.drop = { x: s.rig.hand.x.x + 8, y: s.rig.hand.y.x - 16, vy: -70, spin: 0, index: s.read.index };
    }
    s.read.age = READ_S;
  }
}

/** Seconds of a read spent fetching the product from below frame before it springs up to camera. */
const FETCH_S = 0.2;

export function stepStudio(s: Studio, drive: StudioDrive, dt: number): void {
  s.events = { pending: false, read: false, truck: false, beep: false };
  s.crashT += s.crashed ? dt : 0;
  s.soldFlash = Math.max(0, s.soldFlash - dt * 1.4);
  s.flash = Math.max(0, s.flash - dt * 3);
  s.cut = Math.max(0, s.cut - dt / 0.4);
  // The tear follows the tension, and keeps opening slowly on the log driver through very long rounds.
  s.tear = drive.tension * 0.85 + (drive.long ?? 0) * 0.4;
  stepSpring(s.sticker, peel(drive.tension), 5, 0.8, dt);
  stepSpring(s.fall, s.crashed ? 1 : 0, 3.2, 0.85, dt);
  if (s.crashed) {
    // The truck backs onto the bumper beeping (there from wherever it waited by 0.6 s), the hook lifts the Lambo's
    // rear, then it hauls the car out of frame.
    stepSpring(s.truck, TOW_LATCH, 8, 0.85, dt);
    if (s.beeps < 3) {
      s.beepClock += dt;
      if (s.beepClock > 0.3) {
        s.beepClock = 0;
        s.beeps += 1;
        s.events.beep = true;
      }
    }
    // Closed form in the crash's own clock: 0.25 s to lift, then 300 px/s² up to a 170 px/s haul.
    s.lift = clamp((s.crashT - 0.6) / 0.25, 0, 1);
    const haul = Math.max(0, s.crashT - 0.85);
    s.pull = Math.min(HAULED, haul < 170 / 300 ? 150 * haul * haul : 170 * haul - 170 * 170 / 600);
  } else stepSpring(s.truck, towWaiting(drive.tension, s.creeps), 7, 0.6, dt);
  if (!s.truckIn && s.truck.x < 645) {
    s.truckIn = true;
    s.events.truck = !s.crashed;
  }
  stepSpring(s.sponsor, s.crashed && s.crashT > 0.5 ? 1 : 0, 10, 0.55, dt);
  const pending = pendingRows(drive.tension);
  if (drive.running && pending > s.pending) s.events.pending = true;
  if (drive.running || s.crashed) s.pending = pending;
  // A sponsor read at every milestone: he fetches the product from below frame, it springs up to camera, wobbles, and is held for a moment.
  if (drive.running && !s.crashed && drive.reads > s.readsShown) {
    s.readsShown = drive.reads;
    s.read.index = (drive.reads - 1) % PRODUCTS.length;
    s.read.age = 0;
    s.rungRead = true;
    s.events.read = true;
    s.encoreClock = 0;
  }
  if (drive.running && !s.crashed && s.readsShown >= PRODUCTS.length) {
    s.encoreClock += dt;
    if (s.encoreClock >= 12) {
      s.encoreClock %= 12;
      s.read.index = (s.read.index + 1) % PRODUCTS.length;
      s.read.age = 0;
      s.rungRead = false;
      s.events.read = true;
    }
  }
  const held = s.read.age < READ_S;
  s.read.age += dt;
  if (held && s.read.age >= READ_S && s.rungRead && drive.running && !s.crashed) {
    // The read is over and the truck creeps a notch closer, beeping.
    s.creeps = Math.min(PRODUCTS.length, s.creeps + 1);
    s.events.beep = true;
  }
  stepSpring(s.read.hold, s.read.index >= 0 && s.read.age >= FETCH_S && s.read.age < READ_S && !s.crashed ? 1 : 0, 11, 0.5, dt);
  if (s.drop) {
    s.drop.vy += 900 * dt;
    s.drop.y += s.drop.vy * dt;
    s.drop.spin += 6 * dt;
    if (s.drop.y > VIDEO_H + 60) s.drop = null;
  }
  stepRig(s, drive, dt);
}

/** He talks, nods and points while the round runs, waves through betting, glances at the wallet from 2×, and facepalms at the crash. */
function stepRig(s: Studio, drive: StudioDrive, dt: number): void {
  const r = s.rig;
  const t = drive.tension;
  const crashed = s.crashed;
  if (!drive.still) {
    // Phases are integrated, so a changing tension speeds the motion up without jumping its phase.
    r.talk += dt * (5 + 20 * t + 6 * (drive.long ?? 0));
    r.bob += dt * (2 + 3 * t);
    r.tremor += dt * 38;
    r.wave += dt * 9;
  }
  const ease = (k: number): number => 1 - Math.exp(-k * dt);
  r.mouth += ((crashed ? 0 : 1) - r.mouth) * ease(12);
  r.waving += ((drive.running || crashed ? 0 : 1) - r.waving) * ease(8);
  stepSpring(r.slump, crashed ? 1 : 0, 9, 0.7, dt);
  // The head rides its own spring: it lags the nod, and drops 8 px when the wallet posts SOLD.
  const nod = drive.still ? 0 : Math.sin(r.bob) * (2 + 4 * t) * (1 - r.slump.x);
  stepSpring(r.head, nod + (crashed ? 8 : 0), 14, 0.55, dt);
  const live = drive.running && !crashed;
  const glance = live && t >= 0.5 && (drive.elapsed ?? 0) % 3 < 0.8;
  const admire = live && s.read.index >= 0 && s.read.age > 0.3 && s.read.age < 1.1;
  stepSpring(r.look, glance ? -1 : admire ? 0.6 : 0, 12, 0.7, dt);
  let target = sponsorGrip(0);
  if (crashed) target = FACE;
  else if (!drive.running) target = WAVE;
  else if (s.read.index >= 0 && s.read.age < READ_S + 0.3) target = s.read.age < FETCH_S || s.read.age >= READ_S ? FETCH : sponsorGrip(1);
  stepSpring(r.hand.x, target.x, 16, 0.75, dt);
  stepSpring(r.hand.y, target.y, 16, 0.75, dt);
}

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
  bone(ctx, [a, joint, b], width, colour);
  return joint;
}

/** An inked stroke through the points: a sleeve, a forearm. */
function bone(ctx: CanvasRenderingContext2D, points: Point[], width: number, colour: string): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, c] of [[width + 4, INK], [width, colour]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function drawGarage(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#3a3e44';
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  ctx.fillStyle = '#2c3036';
  ctx.fillRect(0, 250, VIDEO_W, 82);
  ctx.strokeStyle = '#50565e';
  ctx.lineWidth = 2;
  for (let x = 0; x < VIDEO_W; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 250);
    ctx.lineTo(x + 18, VIDEO_H);
    ctx.stroke();
  }
  ctx.fillStyle = '#5c4636';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(18, 196, 70, 54, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e7d7b8';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOODIES', 53, 226);
  ctx.fillStyle = '#2f6b3a';
  ctx.beginPath();
  ctx.ellipse(120, 214, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1d3d22';
  ctx.beginPath();
  ctx.moveTo(120, 214);
  ctx.lineTo(120, 188);
  ctx.stroke();
}

function drawBeach(ctx: CanvasRenderingContext2D, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0, '#79c7ff');
  sky.addColorStop(1, '#d8f1ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIDEO_W, 230);
  ctx.fillStyle = '#f0d7a2';
  ctx.fillRect(0, 210, VIDEO_W, 122);
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(500, 70, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2f7a3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(80, 230);
  ctx.quadraticCurveTo(70, 150, 40, 120);
  ctx.moveTo(80, 180);
  ctx.quadraticCurveTo(120, 150, 130, 170);
  ctx.stroke();
  ctx.fillStyle = '#2f7a3a';
  ctx.beginPath();
  ctx.ellipse(48, 108, 28, 12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // A wave so the cloth is obviously a loop.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= VIDEO_W; x += 12) {
    const y = 228 + Math.sin(x * 0.04 + time) * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** A hub mark, so a wheel visibly rolls by the distance it travels. */
function hub(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle) * r, y - Math.sin(angle) * r);
  ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  ctx.stroke();
  ink(ctx, 3);
}

function drawLambo(ctx: CanvasRenderingContext2D, x: number, sticker: number, lift: number): void {
  ctx.save();
  ctx.translate(x, 236);
  if (lift > 0) {
    // The hook lifts the rear about the front tyre's contact.
    ctx.translate(-46, 26);
    ctx.rotate(-0.12 * lift);
    ctx.translate(46, -26);
  }
  ctx.fillStyle = '#c6f135';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-78, 10);
  ctx.lineTo(-70, -16);
  ctx.lineTo(-30, -22);
  ctx.lineTo(10, -40);
  ctx.lineTo(54, -40);
  ctx.lineTo(78, -16);
  ctx.lineTo(84, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c2420';
  ctx.beginPath();
  ctx.moveTo(-8, -36);
  ctx.lineTo(48, -36);
  ctx.lineTo(66, -18);
  ctx.lineTo(-24, -18);
  ctx.closePath();
  ctx.fill();
  for (const wx of [-46, 48]) {
    ctx.beginPath();
    ctx.arc(wx, 12, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1b1f';
    ctx.fill();
    ctx.stroke();
    hub(ctx, wx, 12, 8, (x - 400) / 14);
  }
  ctx.save();
  ctx.translate(10, -8);
  ctx.rotate(sticker * 0.9);
  ctx.translate(0, -sticker * 26);
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(-22, -8, 44, 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-22, -8, 44, 16);
  ctx.fillStyle = '#c0392b';
  ctx.font = '900 10px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RENTAL', 0, 4);
  ctx.restore();
  if (sticker > 0.15) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.lineTo(4, -8 - sticker * 20);
    ctx.moveTo(16, -6);
    ctx.lineTo(14, -6 - sticker * 16);
    ctx.stroke();
  }
  ctx.restore();
}

/** His free hand from the 1000x point (0) to a product held up to camera (1), always inside the arm's reach. */
export function sponsorGrip(hold: number): Point {
  const k = clamp(hold, 0, 1);
  return { x: mix(POINT.x, HOLD.x, k), y: mix(POINT.y, HOLD.y, k) };
}

/** The product of the moment in his hand (or falling out of frame at the crash), the label on a chyron across the top of the video. */
function drawProduct(ctx: CanvasRenderingContext2D, s: Studio, hand: Point): void {
  const hold = clamp(s.read.hold.x, 0, 1.2);
  if (s.drop) {
    ctx.save();
    ctx.translate(s.drop.x, s.drop.y);
    ctx.rotate(-0.15 + s.drop.spin);
    productShape(ctx, PRODUCTS[s.drop.index]!.kind);
    ctx.restore();
  } else if (hold >= 0.03 && s.read.index >= 0) {
    // It springs up out of the fetch: overshoot in, a wobble that dies, then back down below frame.
    const wobble = Math.sin(s.read.age * 11) * 0.22 * Math.exp(-s.read.age * 2.5);
    ctx.save();
    ctx.globalAlpha = smoothstep(0, 0.25, hold);
    ctx.translate(hand.x + 8, hand.y - 16);
    ctx.rotate(-0.15 + wobble);
    const k = 0.7 + 0.3 * hold;
    ctx.scale(k, k);
    productShape(ctx, PRODUCTS[s.read.index]!.kind);
    ctx.restore();
  }
  if (hold < 0.03 || s.read.index < 0) return;
  drawChyron(ctx, PRODUCTS[s.read.index]!.name, hold);
}

function productShape(ctx: CanvasRenderingContext2D, kind: (typeof PRODUCTS)[number]['kind']): void {
  ink(ctx, 2.5);
  switch (kind) {
    case 'tube':
      ctx.fillStyle = '#f4f1e6';
      ctx.beginPath();
      ctx.roundRect(-11, -18, 22, 38, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3b7cff';
      ctx.beginPath();
      ctx.roundRect(-7, -26, 14, 10, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c0392b';
      ctx.font = '900 9px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NFT', 0, 4);
      break;
    case 'book':
      ctx.fillStyle = '#8a5a2b';
      ctx.beginPath();
      ctx.roundRect(-16, -22, 32, 44, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5c3a1c';
      ctx.fillRect(-16, -22, 6, 44);
      ctx.fillStyle = '#ffe27a';
      ctx.font = '900 12px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 3, 4);
      break;
    case 'can':
      ctx.fillStyle = '#d5fb6d';
      ctx.beginPath();
      ctx.roundRect(-12, -22, 24, 44, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-12, -6, 24, 12);
      ctx.fillStyle = '#9aa3ad';
      ctx.fillRect(-10, -26, 20, 5);
      break;
    case 'gloves':
      ctx.fillStyle = '#8fd0ff';
      ctx.beginPath();
      ctx.roundRect(-13, -14, 26, 34, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-15, -4, 6, 9, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, -2);
      ctx.lineTo(0, 6);
      ctx.lineTo(-6, -2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'vape':
      ctx.fillStyle = '#22262e';
      ctx.beginPath();
      ctx.roundRect(-5, -24, 10, 48, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff7a3b';
      ctx.fillRect(-3, 18, 6, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(0, -32, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'tree':
      ctx.fillStyle = '#2f7a3a';
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(16, 6);
      ctx.lineTo(6, 6);
      ctx.lineTo(14, 22);
      ctx.lineTo(-14, 22);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-16, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#f4f1e6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(0, -36);
      ctx.stroke();
      break;
    case 'candle':
      ctx.fillStyle = '#f4f1e6';
      ctx.beginPath();
      ctx.roundRect(-12, -12, 24, 34, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.ellipse(0, -20, 4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.ellipse(0, -18, 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      ctx.fillStyle = '#9aa3ad';
      ctx.beginPath();
      ctx.roundRect(-16, -8, 32, 18, 3);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 10);
      ctx.lineTo(-8, 26);
      ctx.stroke();
      ctx.fillStyle = '#c0392b';
      ctx.font = '900 8px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SEED', 0, 4);
  }
}

function drawChyron(ctx: CanvasRenderingContext2D, name: string, hold: number): void {
  ctx.save();
  ctx.globalAlpha = clamp(hold, 0, 1);
  ctx.translate(0, (1 - clamp(hold, 0, 1)) * -12);
  ctx.fillStyle = 'rgba(12, 14, 18, 0.9)';
  ctx.beginPath();
  ctx.roundRect(112, 38, 328, 24, 4);
  ctx.fill();
  ctx.fillStyle = '#d5fb6d';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPONSOR', 120, 50);
  const labelW = ctx.measureText('SPONSOR').width;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText(name, 120 + labelW + 10, 50, 310 - labelW);
  ctx.restore();
}

/** Draws him and returns where his free hand is, which the product is held from. */
function drawInfluencer(ctx: CanvasRenderingContext2D, s: Studio, tension: number, time: number): Point {
  const r = s.rig;
  const flap = Math.abs(Math.sin(r.talk)) * r.mouth;
  // The body carries a little of the nod, a beat behind the head, and sinks into the hoodie at the crash.
  const bodyY = Math.sin(r.bob - 0.6) * (0.5 + tension) * (1 - r.slump.x) + r.slump.x * 3;
  ctx.save();
  ctx.translate(214, 292 + bodyY);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Hoodie body.
  ctx.fillStyle = '#22262e';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(0, -36, 32, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d5fb6d';
  ctx.beginPath();
  ctx.arc(-6, -48, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '900 8px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↑', -6, -45);
  // The other arm holds the mic against the chest.
  const micHand = { x: 18, y: -20 };
  limb(ctx, { x: -18, y: -40 }, micHand, 22, 20, 1, 7, '#22262e');
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(micHand.x - 4, micHand.y);
  ctx.lineTo(micHand.x + 6, micHand.y + 8);
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.fillRect(micHand.x + 4, micHand.y + 6, 6, 8);
  ctx.restore();
  // Head, on its own spring: it turns to the wallet, admires the product, and drops at the crash.
  const look = clamp(r.look.x, -1.2, 1.2);
  ctx.save();
  ctx.translate(214 + look * 2, 214 + r.head.x);
  ctx.rotate(r.slump.x * 0.1 + look * 0.04);
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ink(ctx, 2.2);
  ctx.stroke();
  ctx.fillStyle = '#2a211c';
  ctx.beginPath();
  ctx.ellipse(look * 1.5, -16, 16, 8, 0, Math.PI, 0);
  ctx.fill();
  // Shades with the tow lights living in the lenses.
  const fx = look * 5;
  ctx.fillStyle = '#111';
  ctx.fillRect(-14 + fx, -6, 12, 8);
  ctx.fillRect(2 + fx, -6, 12, 8);
  ctx.fillRect(-3 + fx, -4, 6, 2);
  if (tension > 0.4 || s.crashed) {
    const blink = Math.sin(time * 18) > 0;
    ctx.fillStyle = blink ? '#ff3b3b' : '#3b7cff';
    ctx.fillRect(-12 + fx, -4, 4, 3);
    ctx.fillStyle = blink ? '#3b7cff' : '#ff3b3b';
    ctx.fillRect(8 + fx, -4, 4, 3);
  }
  ctx.fillStyle = '#6b2a2a';
  ctx.beginPath();
  ctx.ellipse(fx * 0.8, 8, 5, 2 + flap * 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (tension > 0.5 || s.crashed) {
    // Why is he sweating.
    const drip = (time * 0.7) % 1;
    ctx.globalAlpha = 1 - drip * 0.6;
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.ellipse(16 - fx * 0.3, -2 + drip * 12, 1.8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // The free arm: a fixed sleeve and forearm solved to the hand, its elbow below and outside the line. For the
  // facepalm the elbow swings round toward the camera (the bones foreshorten in depth, never stretch) to sit in
  // front of his chest under the hand.
  const shoulder = { x: SHOULDER.x, y: SHOULDER.y + bodyY };
  // The shake from 2× settles out as he slumps, instead of stopping dead on the crash.
  const shake = 2.2 * smoothstep(0.5, 0.95, tension) * (1 - clamp(r.slump.x, 0, 1));
  let hand = {
    x: r.hand.x.x + Math.sin(r.tremor) * shake + Math.sin(r.wave) * 8 * r.waving,
    y: r.hand.y.x + Math.sin(r.tremor * 1.37) * shake * 0.6,
  };
  const reach = Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y);
  if (reach > REACH) hand = { x: shoulder.x + ((hand.x - shoulder.x) * REACH) / reach, y: shoulder.y + ((hand.y - shoulder.y) * REACH) / reach };
  const elbow = bendJoint(shoulder, hand, 49, 47, Math.cos(Math.PI * 0.62 * clamp(r.slump.x, 0, 1)));
  bone(ctx, [shoulder, elbow], 8, '#22262e');
  bone(ctx, [elbow, hand], 5, SKIN);
  // The 1000x point: an index finger aimed at the thumbnail arrow whenever the hand is not busy.
  const pointing = (1 - clamp(s.read.hold.x, 0, 1)) * (1 - r.slump.x) * (1 - r.waving);
  if (pointing > 0.35) {
    const a = Math.atan2(ARROW.y - hand.y, ARROW.x - hand.x);
    const tip = { x: hand.x + Math.cos(a) * 11 * pointing, y: hand.y + Math.sin(a) * 11 * pointing };
    bone(ctx, [hand, tip], 3, SKIN);
  }
  ctx.fillStyle = SKIN;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, r.waving > 0.5 || r.slump.x > 0.5 ? 5.5 : 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  return hand;
}

function drawMonitor(ctx: CanvasRenderingContext2D, tension: number, crashed: boolean, flash: number): void {
  ctx.save();
  ctx.translate(28, 176);
  ctx.fillStyle = '#14181e';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(0, 0, 150, 96, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#07140c';
  ctx.fillRect(6, 6, 138, 78);
  const pending = pendingRows(tension);
  const cousin = tension >= COUSIN_FROM || crashed;
  ctx.textAlign = 'left';
  // His own allocation, on top: it was never locked.
  ctx.font = '700 9px ui-monospace, monospace';
  ctx.fillStyle = crashed ? '#ff4d6d' : '#8fd0ff';
  ctx.fillText(crashed ? 'KOL ALLOC 5% · DUMPED' : 'KOL ALLOC 5% · VESTED: NO', 12, 17, 128);
  for (let i = 0; i < 4; i += 1) {
    const sold = crashed;
    const pendingRow = !sold && i >= 4 - pending && pending > 0;
    const y = 31 + i * 14;
    ctx.font = '700 11px ui-monospace, monospace';
    if (i === 0 && cousin) {
      // The cousin (the dev) dumping on everyone, the bar growing with the tension.
      ctx.fillStyle = '#ff7a3b';
      ctx.fillText(sold ? 'COUSIN SOLD' : 'COUSIN SELL', 12, y);
      const dump = sold ? 1 : clamp((tension - COUSIN_FROM) / (0.92 - COUSIN_FROM), 0.08, 1);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(96, y - 8, 42 * dump, 8);
      continue;
    }
    ctx.fillStyle = sold ? '#ff4d6d' : pendingRow ? '#ffe08a' : '#39ff8a';
    const label = sold ? 'SOLD' : pendingRow ? 'PENDING SELL' : `BUY  +${(0.4 + i * 0.3).toFixed(2)}`;
    ctx.fillText(label, 12, y);
  }
  if (flash > 0.02) {
    ctx.globalAlpha = flash * 0.45;
    ctx.fillStyle = '#fff';
    ctx.fillRect(6, 6, 138, 78);
  }
  ctx.restore();
}

/** The tow truck reverses in hook first, its light bar over the leading end so the strobe shows early. */
function drawTow(ctx: CanvasRenderingContext2D, x: number, time: number): void {
  ctx.save();
  ctx.translate(x, 248);
  ctx.fillStyle = '#f0b429';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(-46, -28, 70, 32, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a3038';
  ctx.fillRect(-38, -24, 22, 14);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-42, -36, 28, 10);
  const blink = Math.sin(time * 16) > 0;
  ctx.fillStyle = blink ? '#ff3b3b' : '#3b7cff';
  ctx.fillRect(-38, -34, 8, 6);
  ctx.fillStyle = blink ? '#3b7cff' : '#ff3b3b';
  ctx.fillRect(-26, -34, 8, 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-46, -8);
  ctx.lineTo(-78, 4);
  ctx.arc(-78, 9, 5, -Math.PI / 2, Math.PI * 0.8, true);
  ctx.stroke();
  for (const wx of [-20, 28]) {
    ctx.beginPath();
    ctx.arc(wx, 8, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1b1f';
    ctx.fill();
    ctx.stroke();
    hub(ctx, wx, 8, 6, x / 10);
  }
  ctx.restore();
}

export function drawStudio(ctx: CanvasRenderingContext2D, s: Studio, tension: number, time: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIDEO_W, VIDEO_H);
  ctx.clip();
  drawGarage(ctx);
  // The beach is a cloth. The edges tear back to the garage, then the cloth falls.
  const bite = 8 + s.tear * 52;
  ctx.save();
  ctx.translate(s.fall.x * 30, s.fall.x * 380);
  ctx.rotate(s.fall.x * 0.2);
  ctx.beginPath();
  ctx.moveTo(bite, bite * 0.6);
  ctx.lineTo(VIDEO_W * 0.3, bite * 0.2);
  ctx.lineTo(VIDEO_W * 0.55, bite);
  ctx.lineTo(VIDEO_W - bite, bite * 0.35);
  ctx.lineTo(VIDEO_W - bite * 0.5, VIDEO_H * 0.45);
  ctx.lineTo(VIDEO_W - bite, VIDEO_H - bite);
  ctx.lineTo(VIDEO_W * 0.6, VIDEO_H - bite * 0.4);
  ctx.lineTo(bite * 1.2, VIDEO_H - bite * 0.7);
  ctx.lineTo(bite * 0.4, VIDEO_H * 0.5);
  ctx.closePath();
  ctx.clip();
  drawBeach(ctx, time);
  ctx.restore();
  drawLambo(ctx, 400 + s.pull, s.sticker.x, s.lift);
  const towX = s.truck.x + s.pull;
  if (towX < 680) drawTow(ctx, towX, time);
  // The light bar's strobe spills into frame before the truck itself does.
  const glow = s.crashed ? 1 : smoothstep(0.2, 0.6, tension);
  if (glow > 0.01 && towX < 760) {
    const lx = towX - 28;
    const red = Math.sin(time * 16) > 0;
    const g = ctx.createRadialGradient(lx, 214, 4, lx, 214, 130);
    g.addColorStop(0, red ? 'rgba(255,59,59,0.34)' : 'rgba(59,124,255,0.34)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = glow;
    ctx.fillStyle = g;
    ctx.fillRect(lx - 130, 84, 260, 260);
    ctx.globalAlpha = 1;
  }
  const hand = drawInfluencer(ctx, s, tension, time);
  drawProduct(ctx, s, hand);
  drawMonitor(ctx, tension, s.crashed, s.soldFlash);
  if (s.sponsor.x > 0.04) {
    // The sponsor card slaps over his face once he has facepalmed.
    ctx.save();
    ctx.translate(238, 216 + s.rig.head.x * 0.5);
    const scale = clamp(s.sponsor.x, 0, 1.15);
    ctx.scale(scale, scale);
    ctx.rotate(-0.1);
    ctx.fillStyle = '#111';
    ink(ctx, 4);
    ctx.beginPath();
    ctx.roundRect(-70, -32, 140, 64, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d5fb6d';
    ctx.font = '900 25px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOONJUICE', 0, -2, 124);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('PAID IN FULL', 0, 18);
    ctx.restore();
  }
  // Scanlines.
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 0; y < VIDEO_H; y += 4) ctx.fillRect(0, y, VIDEO_W, 1);
  if (s.flash > 0.02) {
    // The screenshot: a white shutter with the frame's corners.
    ctx.globalAlpha = s.flash * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
    ctx.globalAlpha = Math.min(1, s.flash * 1.6);
    ctx.strokeStyle = '#d5fb6d';
    ctx.lineWidth = 4;
    for (const [cx, cy, dx, dy] of [[8, 8, 1, 1], [VIDEO_W - 8, 8, -1, 1], [8, VIDEO_H - 8, 1, -1], [VIDEO_W - 8, VIDEO_H - 8, -1, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * 26);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * 26, cy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (s.cut > 0.01) {
    // A new take fades up from black.
    ctx.globalAlpha = s.cut * s.cut;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
