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
/** Where the tow truck parks after the crash, and how far it hauls the Lambo out. */
const TOW_PARKED = 340;
const HAULED = 260;

/** How far the RENTAL sticker has peeled, and where the tow truck waits, at a given tension. */
const peel = (tension: number): number => clamp(tension * 1.15, 0, 1);
const towWaiting = (tension: number): number => 640 - tension * 40;
/** How many PENDING SELL rows the wallet shows at a tension. */
const pendingRows = (tension: number): number => clamp(Math.floor(tension * 4), 0, 4);
/** The cousin's row appears in the wallet from here; it dumps harder as the tension climbs. */
const COUSIN_FROM = 0.4;
/** How long a sponsor read is held to camera. */
const READ_S = 2.6;

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

export interface Studio {
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
  events: { pending: boolean; read: boolean; truck: boolean; beep: boolean };
}

export interface StudioDrive {
  running: boolean;
  tension: number;
  time: number;
  /** How many milestones the round has passed: each one is a sponsor read. */
  reads: number;
}

export function createStudio(): Studio {
  return {
    tear: 0,
    fall: spring(0),
    sticker: spring(0),
    truck: spring(640),
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
    events: { pending: false, read: false, truck: false, beep: false },
  };
}

export function resetStudio(s: Studio): void {
  s.tear = 0;
  s.fall.x = 0;
  s.fall.v = 0;
  s.sticker.x = 0;
  s.sticker.v = 0;
  s.truck.x = 640;
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
  s.events = { pending: false, read: false, truck: false, beep: false };
}

/** The cash-out beat: your subscriber's screenshot flashes the video. */
export function screenshot(s: Studio): void {
  s.flash = 1;
}

/** Jumps the props to where the tension has them, for a stretch of the round the scene did not draw. */
export function settleStudio(s: Studio, tension: number, reads: number): void {
  s.tear = tension;
  settleSpring(s.sticker, peel(tension));
  settleSpring(s.truck, towWaiting(tension));
  s.truckIn = towWaiting(tension) < 630;
  s.pending = pendingRows(tension);
  // The reads so far were read; none is held up now.
  s.readsShown = reads;
}

/** The reveal. `quiet` (a crash that happened off screen) opens on its aftermath: no SOLD flash, nothing moving. */
export function endStudio(s: Studio, quiet: boolean): void {
  if (s.crashed) return;
  s.crashed = true;
  if (quiet) {
    // The tear and the sticker follow the tension, so they stay where the round left them.
    s.crashT = 3;
    settleSpring(s.fall, 1);
    settleSpring(s.truck, TOW_PARKED);
    s.pull = HAULED;
    settleSpring(s.sponsor, 1);
    s.beeps = 9;
  } else {
    s.soldFlash = 1;
    s.fall.v = 2;
    s.sponsor.v = 6;
    // Whatever he was holding up gets dropped.
    s.read.age = READ_S;
  }
}

export function stepStudio(s: Studio, drive: StudioDrive, dt: number): void {
  s.events = { pending: false, read: false, truck: false, beep: false };
  s.crashT += s.crashed ? dt : 0;
  s.soldFlash = Math.max(0, s.soldFlash - dt * 1.4);
  s.flash = Math.max(0, s.flash - dt * 3);
  s.tear = drive.tension;
  stepSpring(s.sticker, peel(drive.tension), 5, 0.8, dt);
  stepSpring(s.fall, s.crashed ? 1 : 0, 3.2, 0.85, dt);
  const truckTarget = s.crashed ? TOW_PARKED : towWaiting(drive.tension);
  stepSpring(s.truck, truckTarget, s.crashed ? 4 : 6, 0.9, dt);
  if (!s.truckIn && s.truck.x < 630) {
    s.truckIn = true;
    s.events.truck = true;
  }
  if (s.crashed && s.truck.x > TOW_PARKED + 6 && s.beeps < 6) {
    // Reversing beeps while it backs in, a few, not a siren.
    s.beepClock += dt;
    if (s.beepClock > 0.42) {
      s.beepClock = 0;
      s.beeps += 1;
      s.events.beep = true;
    }
  }
  if (s.crashed && s.truck.x < 430) s.pull = Math.min(HAULED, s.pull + 90 * dt);
  stepSpring(s.sponsor, s.crashed ? 1 : 0, 10, 0.55, dt);
  const pending = pendingRows(drive.tension);
  if (drive.running && pending > s.pending) s.events.pending = true;
  if (drive.running || s.crashed) s.pending = pending;
  // A sponsor read at every milestone: the product springs up to camera, wobbles, and is held for a moment.
  if (drive.running && !s.crashed && drive.reads > s.readsShown) {
    s.readsShown = drive.reads;
    s.read.index = (drive.reads - 1) % PRODUCTS.length;
    s.read.age = 0;
    s.read.hold.v += 4;
    s.events.read = true;
    s.encoreClock = 0;
  }
  if (drive.running && !s.crashed && s.readsShown >= PRODUCTS.length) {
    s.encoreClock += dt;
    if (s.encoreClock >= 12) {
      s.encoreClock %= 12;
      s.read.index = (s.read.index + 1) % PRODUCTS.length;
      s.read.age = 0;
      s.read.hold.v += 4;
      s.events.read = true;
    }
  }
  s.read.age += dt;
  stepSpring(s.read.hold, s.read.index >= 0 && s.read.age < READ_S && !s.crashed ? 1 : 0, 11, 0.5, dt);
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

function drawLambo(ctx: CanvasRenderingContext2D, x: number, sticker: number): void {
  ctx.save();
  ctx.translate(x, 236);
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

/** The product of the moment, held up to camera about its centre, the label on a chyron across the top of the video. */
export function sponsorGrip(hold: number): Point {
  const k = clamp(hold, 0, 1);
  return { x: mix(244, 310, k), y: mix(337, 226, k) };
}

function drawProduct(ctx: CanvasRenderingContext2D, s: Studio): void {
  const hold = clamp(s.read.hold.x, 0, 1.2);
  if (hold < 0.03 || s.read.index < 0) return;
  const product = PRODUCTS[s.read.index]!;
  // Overshoot in, a wobble that dies, then the drop.
  const wobble = Math.sin(s.read.age * 11) * 0.22 * Math.exp(-s.read.age * 2.5);
  ctx.save();
  const grip = sponsorGrip(hold);
  ctx.globalAlpha = smoothstep(0, .18, hold);
  ctx.translate(grip.x + 8, grip.y - 16);
  ctx.rotate(-0.15 + wobble);
  ink(ctx, 2.5);
  switch (product.kind) {
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
  ctx.restore();
  // The chyron.
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
  ctx.fillText(product.name, 120 + labelW + 10, 50, 310 - labelW);
  ctx.restore();
}

function drawInfluencer(ctx: CanvasRenderingContext2D, tension: number, time: number, crashed: boolean, read: Studio['read']): void {
  const flap = Math.abs(Math.sin(time * (5 + tension * 22)));
  const nod = Math.sin(time * (2 + tension * 3)) * (2 + tension * 3);
  ctx.save();
  ctx.translate(214, 292 + nod * 0.2);
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
  // The free arm rests below frame, fetches the product and settles its grip for the read.
  const grip = sponsorGrip(read.index < 0 ? 0 : read.hold.x);
  const finger = { x: grip.x - 214, y: grip.y - 292 - nod * .2 };
  const shoulder = { x: 18, y: -42 };
  // The full sleeve and forearm solve to the grip, which also anchors the product.
  const elbow = bendJoint(shoulder, finger, 49, 47, -1);
  limb(ctx, shoulder, elbow, 25, 24, -1, 8, '#22262e');
  limb(ctx, elbow, finger, 24, 23, -1, 5, SKIN);
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(finger.x, finger.y, 4, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.translate(0, -78);
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ink(ctx, 2.2);
  ctx.stroke();
  ctx.fillStyle = '#2a211c';
  ctx.beginPath();
  ctx.ellipse(0, -16, 16, 8, 0, Math.PI, 0);
  ctx.fill();
  // Shades with the tow lights living in the lenses.
  ctx.fillStyle = '#111';
  ctx.fillRect(-14, -6, 12, 8);
  ctx.fillRect(2, -6, 12, 8);
  if (tension > 0.4) {
    const blink = Math.sin(time * 18) > 0;
    ctx.fillStyle = blink ? '#ff3b3b' : '#3b7cff';
    ctx.fillRect(-12, -4, 4, 3);
    ctx.fillStyle = blink ? '#3b7cff' : '#ff3b3b';
    ctx.fillRect(8, -4, 4, 3);
  }
  ctx.fillStyle = '#6b2a2a';
  ctx.beginPath();
  ctx.ellipse(0, 8, 5, 2 + flap * 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  for (let i = 0; i < 4; i += 1) {
    const sold = crashed;
    const pendingRow = !sold && i >= 4 - pending && pending > 0;
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    if (i === 0 && cousin) {
      // The cousin (the dev) dumping on everyone, the bar growing with the tension.
      ctx.fillStyle = '#ff7a3b';
      ctx.fillText(sold ? 'COUSIN SOLD' : 'COUSIN SELL', 12, 24);
      const dump = sold ? 1 : clamp((tension - COUSIN_FROM) / (1 - COUSIN_FROM), 0.08, 1);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(96, 16, 42 * dump, 8);
      continue;
    }
    ctx.fillStyle = sold ? '#ff4d6d' : pendingRow ? '#ffe08a' : '#39ff8a';
    const label = sold ? 'SOLD' : pendingRow ? 'PENDING SELL' : `BUY  +${(0.4 + i * 0.3).toFixed(2)}`;
    ctx.fillText(label, 12, 24 + i * 16);
  }
  if (flash > 0.02) {
    ctx.globalAlpha = flash * 0.45;
    ctx.fillStyle = '#fff';
    ctx.fillRect(6, 6, 138, 78);
  }
  ctx.restore();
}

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
  ctx.fillRect(8, -36, 28, 10);
  const blink = Math.sin(time * 16) > 0;
  ctx.fillStyle = blink ? '#ff3b3b' : '#3b7cff';
  ctx.fillRect(12, -34, 8, 6);
  ctx.fillStyle = blink ? '#3b7cff' : '#ff3b3b';
  ctx.fillRect(24, -34, 8, 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-46, -8);
  ctx.lineTo(-78, 4);
  ctx.stroke();
  for (const wx of [-20, 28]) {
    ctx.beginPath();
    ctx.arc(wx, 8, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1b1f';
    ctx.fill();
    ctx.stroke();
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
  const bite = 8 + s.tear * 54;
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
  drawLambo(ctx, 400 + s.pull, s.sticker.x);
  if (s.crashed || s.truck.x < 630) drawTow(ctx, s.truck.x, time);
  drawInfluencer(ctx, tension, time, s.crashed, s.read);
  drawProduct(ctx, s);
  drawMonitor(ctx, tension, s.crashed, s.soldFlash);
  if (s.sponsor.x > 0.04) {
    ctx.save();
    ctx.translate(300, 150);
    const scale = clamp(s.sponsor.x, 0, 1.15);
    ctx.scale(scale, scale);
    ctx.rotate(-0.06);
    ctx.fillStyle = '#111';
    ink(ctx, 4);
    ctx.beginPath();
    ctx.roundRect(-120, -46, 240, 92, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d5fb6d';
    ctx.font = '900 32px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOONJUICE', 0, -4);
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('PAID IN FULL', 0, 22);
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
  ctx.restore();
}
