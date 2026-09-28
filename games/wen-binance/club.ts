/**
 * The club front: THE EXCHANGE marquee with its hype meter and a sign that
 * flickers between LISTING SOON and DELISTING, the doors on springs that
 * shake with the bass and crack open on the dance floor, the bouncer with
 * his clipboard, the suits he waves past, the taxi for an accepted exit,
 * and the crash: sell the news. Nothing here changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const W = 960;
export const H = 540;
/** The pavement line the queue stands on. */
export const GROUND = 470;
export const DOOR = { x: 640, y: 236, w: 130, h: GROUND - 236 } as const;
export const BOUNCER_X = 600;
export type Point = { x: number; y: number };

export interface Suit {
  x: number;
  /** Walking speed in px/s; negative runs left (leaving with the bag). */
  vx: number;
  bag: boolean;
  seed: number;
  /** Depth 0..1: drawn smaller and higher when further back on the dance floor. */
  depth: number;
  entering: boolean;
  gone: boolean;
}

export interface Club {
  time: number;
  /** Doors ajar 0..1. */
  doors: Spring;
  /** Bass thump 0..1, driven each beat. */
  thump: Spring;
  lookDown: Spring;
  headShake: Spring;
  wave: Spring;
  signFlip: Spring;
  lights: Spring;
  beatAt: number;
  suits: Suit[];
  /** Flicker state for the marquee text: 0 LISTING SOON, 1 LISTING, 2 DELISTING. */
  flicker: number;
  crashed: boolean;
  crashAge: number;
  taxiX: Spring;
  taxi: boolean;
  /** Suits waved past so far. */
  waved: number;
  strobe: number;
}

export function createClub(): Club {
  return { time: 0, doors: spring(0), thump: spring(0), lookDown: spring(0), headShake: spring(0), wave: spring(0), signFlip: spring(0), lights: spring(0), beatAt: 0, suits: [], flicker: 0, crashed: false, crashAge: 0, taxiX: spring(W + 260), taxi: false, waved: 0, strobe: 0 };
}

export function resetClub(c: Club): void {
  settleSpring(c.doors, 0);
  settleSpring(c.thump, 0);
  settleSpring(c.lookDown, 0);
  settleSpring(c.headShake, 0);
  settleSpring(c.wave, 0);
  settleSpring(c.signFlip, 0);
  settleSpring(c.lights, 0);
  c.suits = [];
  c.flicker = 0;
  c.crashed = false;
  c.crashAge = 0;
  settleSpring(c.taxiX, W + 260);
  c.taxi = false;
  c.waved = 0;
  c.strobe = 0;
}

/** Joins a round already in progress: the suits already inside are inside. */
export function settleClub(c: Club, waved: number): void {
  c.waved = waved;
}

/** A milestone: another suit walks up and is waved straight past the rope. */
export function waveSuit(c: Club, index: number): void {
  c.waved += 1;
  c.suits.push({ x: -60, vx: 190 + 20 * noise(index * 3.7), bag: false, seed: index * 17 + 5, depth: 0, entering: true, gone: false });
}

/** The taxi pulls up for your coin. */
export function callTaxi(c: Club): void {
  c.taxi = true;
}

/** Sell the news. `quiet` skips the effects for a crash that already happened. */
export function crashClub(c: Club, seed: number, quiet: boolean): void {
  if (c.crashed) return;
  c.crashed = true;
  c.crashAge = quiet ? 10 : 0;
  const rng = mulberry32(seed);
  const count = 7 + Math.floor(rng() * 5);
  for (let i = 0; i < count; i += 1) c.suits.push({ x: DOOR.x + 20 + rng() * 60, vx: -(230 + rng() * 160), bag: true, seed: Math.floor(rng() * 1000), depth: 0, entering: false, gone: false });
  if (quiet) {
    settleSpring(c.doors, 1);
    settleSpring(c.signFlip, 1);
    settleSpring(c.lights, 1);
    for (const s of c.suits) s.gone = true;
    c.suits = [];
    return;
  }
  c.strobe = 1;
  c.doors.v = 12;
}

export interface ClubDrive { running: boolean; tension: number; multiplier: number; reduced: boolean }

export function stepClub(c: Club, drive: ClubDrive, dt: number): void {
  c.time += dt;
  const t = drive.tension;
  // The bass: beats per second rise with the hype.
  const bpm = drive.running ? 1.8 + 2.6 * t : 1.2;
  if (c.time >= c.beatAt) { c.beatAt = c.time + 1 / bpm; c.thump.v += drive.running ? 6 + 14 * t : 3; }
  stepSpring(c.thump, 0, 18, 0.5, dt);
  if (c.crashed) {
    c.crashAge += dt;
    stepSpring(c.doors, 1, 6, 0.75, dt);
    stepSpring(c.signFlip, c.crashAge > 2.2 ? 1 : 0, 9, 0.7, dt);
    stepSpring(c.lights, c.crashAge > 1.6 ? 1 : 0, 5, 0.9, dt);
    c.flicker = c.crashAge > 2.2 ? 2 : 1;
    if (c.strobe > 0) c.strobe = Math.max(0, c.strobe - dt / 1.2);
    stepSpring(c.lookDown, 0, 8, 0.8, dt);
    stepSpring(c.wave, 0, 6, 0.6, dt);
    stepSpring(c.headShake, 0, 10, 0.4, dt);
  } else {
    const ajar = drive.running && t > 0.62 ? 0.1 + 0.08 * Math.sin(c.time * 1.3) + 0.06 * (t - 0.62) : 0;
    stepSpring(c.doors, ajar, 5, 0.6, dt);
    stepSpring(c.signFlip, 0, 9, 0.7, dt);
    stepSpring(c.lights, 0, 5, 0.9, dt);
    // The bouncer checks his clipboard longer the higher it goes.
    const checking = drive.running && t > 0.35 && noise(Math.floor(c.time * 0.5)) < 0.3 + 0.6 * t;
    stepSpring(c.lookDown, checking ? 1 : 0, 6, 0.8, dt);
    if (drive.running && t > 0.5 && Math.floor(c.time * 2) !== Math.floor((c.time - dt) * 2) && noise(Math.floor(c.time * 2) * 1.7) > 0.8) c.headShake.v += 30;
    stepSpring(c.headShake, 0, 14, 0.35, dt);
    stepSpring(c.wave, 0, 6, 0.6, dt);
    // Marquee flicker between LISTING SOON, LISTING and DELISTING.
    const slot = Math.floor(c.time * 6);
    const n = noise(slot * 2.3);
    c.flicker = drive.reduced ? 0 : t > 0.55 && n > 1 - 0.35 * (t - 0.55) / 0.45 ? 2 : t > 0.3 && n > 0.85 ? 1 : 0;
  }
  // Suits walking: arrivals go to the door and in; leavers run left with the bags.
  for (const s of c.suits) {
    if (s.gone) continue;
    if (s.entering) {
      s.x += s.vx * dt;
      if (s.x > BOUNCER_X - 40 && s.x < BOUNCER_X + 20) c.wave.x = Math.max(c.wave.x, 0.6);
      if (s.x > DOOR.x + DOOR.w / 2) { s.depth = Math.min(1, s.depth + dt * 1.6); if (s.depth >= 1) s.gone = true; }
    } else {
      s.x += s.vx * dt;
      if (s.x < -80) s.gone = true;
    }
  }
  c.suits = c.suits.filter((s) => !s.gone);
  if (c.taxi) stepSpring(c.taxiX, 330, 3.2, 0.85, dt);
  else settleSpring(c.taxiX, W + 260);
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
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 5;
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

function memeSmall(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center'): void {
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.12); ctx.strokeStyle = INK; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

/** A man in a suit, walking. `stride` in radians drives the knees; the bag lags a step behind. */
export function drawSuit(ctx: CanvasRenderingContext2D, x: number, footY: number, stride: number, bag: boolean, seed: number, scale = 1, facing = 1): void {
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(scale * facing, scale);
  ctx.lineJoin = 'round';
  const tie = ['#c1121f', '#1d4ed8', '#f4c20d', '#0f766e'][Math.floor(noise(seed * 1.3) * 4)]!;
  for (const side of [-1, 1]) {
    const phase = stride + (side > 0 ? Math.PI : 0);
    const lift = Math.max(0, Math.sin(phase)) * 14;
    // Airborne foot travels from behind the hip to in front. Local +x is the way he faces.
    const reach = -Math.cos(phase) * 11;
    limb(ctx, { x: side * 8, y: -66 }, { x: side * 10 + reach, y: -lift }, 38, 34, -1, 12, '#23232b');
    ctx.fillStyle = '#111114'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(side * 10 + reach, 3 - lift, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  const tail = Math.sin(stride) * 8;
  ctx.fillStyle = '#1a1a20';
  ctx.beginPath(); ctx.moveTo(-12, -68); ctx.quadraticCurveTo(-24 - tail, -28, -6 - tail, -4); ctx.lineTo(0, -8); ctx.quadraticCurveTo(-10, -30, -4, -68); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12, -68); ctx.quadraticCurveTo(24 + tail, -28, 6 + tail, -4); ctx.lineTo(0, -8); ctx.quadraticCurveTo(10, -30, 4, -68); ctx.fill();
  ctx.fillStyle = '#2b2b33'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-24, -122, 48, 64, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath(); ctx.moveTo(-8, -122); ctx.lineTo(0, -92); ctx.lineTo(8, -122); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tie;
  ctx.beginPath(); ctx.moveTo(-3, -118); ctx.lineTo(3, -118); ctx.lineTo(2, -92); ctx.lineTo(0, -86); ctx.lineTo(-2, -92); ctx.closePath(); ctx.fill();
  const swing = Math.sin(stride);
  // The arm opposite the forward foot leads.
  const leftHand = { x: -34 - swing * 12, y: -66 };
  const rightHand = { x: 34 + swing * 12, y: -64 };
  limb(ctx, { x: -22, y: -112 }, leftHand, 30, 28, 1, 11, '#2b2b33');
  limb(ctx, { x: 22, y: -112 }, rightHand, 30, 28, 1, 11, '#2b2b33');
  if (bag) {
    const lag = Math.sin(stride - 0.6) * 14;
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rightHand.x - 4, rightHand.y + 2);
    ctx.quadraticCurveTo(rightHand.x - 16 + lag, rightHand.y + 28, rightHand.x + 2 + lag, rightHand.y + 42);
    ctx.quadraticCurveTo(rightHand.x + 30 + lag * 0.4, rightHand.y + 34, rightHand.x + 12, rightHand.y + 4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c'; ctx.font = '900 16px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', rightHand.x + 6 + lag * 0.35, rightHand.y + 28);
  }
  const skin = noise(seed * 2.1) > 0.5 ? '#f3dccb' : '#c68e6a';
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -142, 17, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-12, -166, 26, 6); ctx.fillRect(2, -166, 12, 6);
  ctx.beginPath(); ctx.arc(6, -146, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBouncer(ctx: CanvasRenderingContext2D, c: Club): void {
  ctx.save();
  ctx.translate(BOUNCER_X, GROUND);
  ctx.lineJoin = 'round';
  const thump = c.thump.x * 3;
  ctx.translate(Math.sin(c.time * 1.4) * 2, -thump * 0.4);
  // Legs and a wide stance, knees out.
  limb(ctx, { x: -18, y: -84 }, { x: -32, y: 0 }, 48, 44, 1, 18, '#151519');
  limb(ctx, { x: 18, y: -84 }, { x: 32, y: 0 }, 48, 44, -1, 18, '#151519');
  ctx.fillStyle = '#111114'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(-34, 4, 14, 5, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(34, 4, 14, 5, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // A very wide torso.
  ctx.fillStyle = '#151519'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.roundRect(-46, -168, 92, 92, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a'; ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SECURITY', 0, -100);
  // Left arm holds the clipboard; it rises as he checks it.
  const look = clamp(c.lookDown.x, 0, 1);
  const hand = { x: -56 + 28 * look, y: -108 - 34 * look };
  limb(ctx, { x: -44, y: -150 }, hand, 32, 28, hand.y >= -150 ? 1 : -1, 16, '#151519');
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(-0.4 + 0.5 * look);
  ctx.fillStyle = '#8b5a2b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-16, -22, 32, 44, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f7f3e8';
  ctx.fillRect(-12, -16, 24, 34);
  ctx.strokeStyle = '#9a9aa8'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.moveTo(-9, -10 + i * 7); ctx.lineTo(9 - (i % 2) * 5, -10 + i * 7); ctx.stroke(); }
  ctx.fillStyle = '#c1121f';
  if (c.crashed) { ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('NOPE', 0, 10); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-8, -26, 16, 8, 2); ctx.stroke();
  ctx.restore();
  // Right arm waves a suit through or stays folded.
  const wave = clamp(c.wave.x, 0, 1);
  const waveHand = { x: 48 + 36 * wave, y: -118 - 46 * wave };
  limb(ctx, { x: 44, y: -150 }, waveHand, 32, 28, waveHand.y >= -150 ? -1 : 1, 16, '#151519');
  if (wave > 0.3) { ctx.fillStyle = '#c68e6a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(waveHand.x, waveHand.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  // Head with an earpiece, shades, a head-shake.
  ctx.save();
  ctx.translate(0, -186 + 14 * look);
  ctx.rotate(Math.sin(c.time * 26) * 0.08 * clamp(c.headShake.x, 0, 1) * (c.headShake.x > 0.05 ? 1 : 0) + 0.25 * look);
  ctx.fillStyle = '#c68e6a'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.roundRect(-22, -22, 44, 44, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-20, -8, 40, 10);
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(22, -4); ctx.quadraticCurveTo(32, 6, 24, 24); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(8, 12); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawTaxi(ctx: CanvasRenderingContext2D, x: number, time: number, moving: boolean): void {
  ctx.save();
  ctx.translate(x, GROUND + 48);
  const bob = moving ? Math.sin(time * 30) * 1.2 : 0;
  ctx.translate(0, bob);
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 6, 120, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4c20d'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.roundRect(-118, -38, 236, 40, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-80, -38); ctx.lineTo(-56, -72); ctx.lineTo(50, -72); ctx.lineTo(76, -38); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8fd3ff';
  ctx.beginPath(); ctx.moveTo(-70, -40); ctx.lineTo(-52, -66); ctx.lineTo(-6, -66); ctx.lineTo(-6, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -40); ctx.lineTo(4, -66); ctx.lineTo(46, -66); ctx.lineTo(66, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-30, -84, 60, 14);
  ctx.fillStyle = '#ffe27a'; ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('TAXI', 0, -73);
  for (const wx of [-70, 70]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(wx, 2, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9aa8'; ctx.beginPath(); ctx.arc(wx, 2, 8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-118, -30, 236, 6);
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.roundRect(-124, -30, 10, 12, 3); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  // Driver, one arm on the wheel.
  ctx.fillStyle = '#c68e6a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-30, -54, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(-36, -56, 12, 3);
  limb(ctx, { x: -22, y: -46 }, { x: -2, y: -34 + Math.sin(time * 2.2) * 2 }, 14, 12, 1, 5, '#c68e6a');
  if (!moving) {
    ctx.save();
    ctx.translate(78, -36);
    ctx.rotate(-0.55);
    ctx.fillStyle = '#e0ac00'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(0, 0, 34, 36, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The building, the marquee, the doors and what is behind them, the bouncer. */
export function drawClubBack(ctx: CanvasRenderingContext2D, c: Club, tension: number, reduced: boolean): void {
  const thump = clamp(c.thump.x, 0, 1);
  // Night sky and the brick front.
  const sky = ctx.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0, '#070a1c'); sky.addColorStop(1, '#1a1440');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2a2140';
  ctx.fillRect(0, 60, W, GROUND - 60);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let y = 70; y < GROUND; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let y = 70, r = 0; y < GROUND; y += 22, r += 1) for (let x = (r % 2) * 30; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); }
  ctx.fillStyle = '#1f1a33';
  ctx.fillRect(0, 60, W, 12);
  // Neon glow that pulses with the beat.
  const glow = reduced ? 0.4 : 0.25 + 0.5 * thump;
  const neon = ctx.createRadialGradient(DOOR.x + DOOR.w / 2, 140, 20, DOOR.x + DOOR.w / 2, 140, 520);
  neon.addColorStop(0, `rgba(255, 70, 200, ${0.35 * glow + 0.1})`);
  neon.addColorStop(1, 'rgba(255, 70, 200, 0)');
  ctx.fillStyle = neon; ctx.fillRect(0, 0, W, H);
  // Posters on the wall: LISTING PARTY, and one that has been torn.
  ctx.save();
  ctx.translate(140, 150);
  ctx.rotate(-0.04);
  ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-70, -50, 140, 100, 4); ctx.fill(); ctx.stroke();
  memeSmall(ctx, 'LISTING', 0, -12, 28, '#c1121f');
  memeSmall(ctx, 'PARTY', 0, 22, 28, '#c1121f');
  ctx.fillStyle = '#ffffff'; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('tonight · maybe', 0, 40);
  ctx.restore();
  ctx.save();
  ctx.translate(330, 130);
  ctx.rotate(0.06);
  ctx.fillStyle = '#e7e7ef'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-50, -40); ctx.lineTo(50, -40); ctx.lineTo(50, 10); ctx.lineTo(20, 40); ctx.lineTo(-20, 20); ctx.lineTo(-50, 36); ctx.closePath(); ctx.fill(); ctx.stroke();
  memeSmall(ctx, 'NO JEETS', 0, 0, 20, INK);
  ctx.restore();
  // The marquee.
  const mq = { x: 540, y: 78, w: 380, h: 96 };
  ctx.save();
  ctx.translate(0, thump * (reduced ? 0 : 2));
  ctx.fillStyle = '#12101f'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(mq.x, mq.y, mq.w, mq.h, 10); ctx.fill(); ctx.stroke();
  const bulbs = 22;
  for (let i = 0; i < bulbs; i += 1) {
    const on = reduced ? i % 2 === 0 : (i + Math.floor(c.time * (3 + 8 * tension))) % 3 !== 0;
    ctx.fillStyle = on ? '#ffe27a' : '#5a5040';
    for (const y of [mq.y + 8, mq.y + mq.h - 8]) { ctx.beginPath(); ctx.arc(mq.x + 12 + (i * (mq.w - 24)) / (bulbs - 1), y, 4, 0, Math.PI * 2); ctx.fill(); }
  }
  memeSmall(ctx, 'THE EXCHANGE', mq.x + mq.w / 2, mq.y + 44, 34, '#ff5d9e');
  const flicker = c.flicker;
  const signText = flicker === 2 ? (c.crashed ? 'DELISTED' : 'DELISTING') : flicker === 1 ? (c.crashed ? 'LISTED' : 'LISTING') : 'LISTING SOON';
  const signColour = flicker === 2 ? '#ff4d6d' : flicker === 1 ? '#7cf67c' : '#8fd3ff';
  memeSmall(ctx, signText, mq.x + mq.w / 2, mq.y + 76, 22, signColour);
  ctx.restore();
  // Hype meter under the marquee.
  ctx.fillStyle = '#12101f'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(mq.x + 40, mq.y + mq.h + 10, mq.w - 80, 16, 8); ctx.fill(); ctx.stroke();
  const fill = c.crashed ? Math.max(0, 1 - c.crashAge / 1.2) * tension : tension;
  if (fill > 0.01) {
    const g = ctx.createLinearGradient(mq.x + 40, 0, mq.x + mq.w - 40, 0);
    g.addColorStop(0, '#8fd3ff'); g.addColorStop(1, '#ff5d9e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(mq.x + 40, mq.y + mq.h + 10, (mq.w - 80) * fill, 16, 8); ctx.fill();
  }
  ctx.fillStyle = '#ffffff'; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('HYPE', mq.x + mq.w / 2, mq.y + mq.h + 22);
  // Speakers either side of the door, cones pumping with the beat.
  for (const sx of [DOOR.x - 60, DOOR.x + DOOR.w + 60]) {
    ctx.fillStyle = '#151519'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(sx - 30, GROUND - 130, 60, 130, 6); ctx.fill(); ctx.stroke();
    for (const cy of [GROUND - 96, GROUND - 40]) {
      ctx.fillStyle = '#2b2b33'; ctx.beginPath(); ctx.arc(sx, cy, 20 + thump * 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3d3d48'; ctx.beginPath(); ctx.arc(sx, cy, 8 + thump * 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The doorway: dance floor behind, lit or empty.
  ctx.save();
  ctx.beginPath(); ctx.rect(DOOR.x, DOOR.y, DOOR.w, DOOR.h); ctx.clip();
  const lights = clamp(c.lights.x, 0, 1);
  ctx.fillStyle = lights > 0.5 ? '#e9e4f0' : '#0a0716';
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  if (lights < 0.95) {
    ctx.globalAlpha = 1 - lights;
    const hues = [300, 200, 120, 40];
    for (let i = 0; i < 4; i += 1) {
      const a = c.time * (1.5 + i * 0.4) + i;
      const lx = DOOR.x + DOOR.w / 2 + Math.sin(a) * 50;
      const beam = ctx.createRadialGradient(lx, DOOR.y + 40, 4, lx, DOOR.y + 40, 130);
      const on = reduced ? 0.5 : 0.35 + 0.5 * thump;
      beam.addColorStop(0, `hsla(${hues[i]}, 90%, 60%, ${on})`); beam.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = beam; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    }
    // Disco ball.
    ctx.fillStyle = '#c9c9d4'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(DOOR.x + DOOR.w / 2, DOOR.y + 26, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(DOOR.x + DOOR.w / 2 - 12 + ((i * 5 + Math.floor(c.time * 8)) % 24), DOOR.y + 18 + (i % 3) * 6, 3, 3);
    // Silhouettes of the suits inside: dancing, or heading for the back exit at high tension.
    const leaving = smoothstep(0.55, 0.9, tension);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    for (let i = 0; i < 6; i += 1) {
      const base = DOOR.x + 18 + i * 19;
      const drift = leaving * ((c.time * 26 + i * 40) % 160);
      const sx = base + drift;
      const bounce = (1 - leaving) * Math.abs(Math.sin(c.time * 6 + i)) * 8;
      const sy = DOOR.y + DOOR.h - 30 - bounce;
      ctx.beginPath(); ctx.arc(sx, sy - 24, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(sx - 6, sy - 18, 12, 20);
    }
    if (leaving > 0.05) {
      ctx.fillStyle = `rgba(124, 246, 124, ${leaving})`;
      ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('BACK EXIT →', DOOR.x + DOOR.w - 8, DOOR.y + 60);
    }
    ctx.globalAlpha = 1;
  }
  if (lights > 0.05) {
    // Lights on: the empty club, a mop bucket, a chair on a table.
    ctx.globalAlpha = lights;
    ctx.fillStyle = '#e9e4f0'; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    ctx.fillStyle = '#cfc7dc'; ctx.fillRect(DOOR.x, DOOR.y + DOOR.h - 40, DOOR.w, 40);
    ctx.strokeStyle = '#9a9aa8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(DOOR.x + 20, DOOR.y + DOOR.h - 90, 60, 8, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(DOOR.x + 26, DOOR.y + DOOR.h - 82); ctx.lineTo(DOOR.x + 26, DOOR.y + DOOR.h - 40); ctx.moveTo(DOOR.x + 74, DOOR.y + DOOR.h - 82); ctx.lineTo(DOOR.x + 74, DOOR.y + DOOR.h - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(DOOR.x + 34, DOOR.y + DOOR.h - 90); ctx.lineTo(DOOR.x + 40, DOOR.y + DOOR.h - 130); ctx.lineTo(DOOR.x + 66, DOOR.y + DOOR.h - 130); ctx.lineTo(DOOR.x + 66, DOOR.y + DOOR.h - 90); ctx.stroke();
    ctx.fillStyle = '#4a4a55';
    ctx.beginPath(); ctx.roundRect(DOOR.x + 96, DOOR.y + DOOR.h - 66, 22, 26, 3); ctx.fill();
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(DOOR.x + 106, DOOR.y + DOOR.h - 66); ctx.lineTo(DOOR.x + 112, DOOR.y + DOOR.h - 150); ctx.stroke();
    ctx.fillStyle = '#9a9aa8'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('nobody home', DOOR.x + DOOR.w / 2, DOOR.y + 40);
    ctx.globalAlpha = 1;
  }
  // Suits deep in the doorway (entering ones fade back).
  for (const s of c.suits) if (s.entering && s.depth > 0) { ctx.globalAlpha = 1 - s.depth; drawSuit(ctx, DOOR.x + DOOR.w / 2, GROUND - 20 * s.depth, c.time * 10 + s.seed, false, s.seed, 0.62 * (1 - 0.3 * s.depth)); ctx.globalAlpha = 1; }
  ctx.restore();
  // The doors themselves, ajar by `doors`, jittering with the bass.
  const open = clamp(c.doors.x, 0, 1);
  const jitter = reduced ? 0 : Math.sin(c.time * 40) * 1.5 * thump * (1 - open);
  for (const side of [0, 1]) {
    const hinge = side === 0 ? DOOR.x : DOOR.x + DOOR.w;
    const dir = side === 0 ? 1 : -1;
    const width = (DOOR.w / 2) * (1 - open * 0.92) - Math.abs(jitter);
    ctx.fillStyle = '#4a1d6b'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.rect(Math.min(hinge, hinge + dir * width), DOOR.y, Math.abs(width), DOOR.h); ctx.fill(); ctx.stroke();
    if (width > 20) {
      ctx.fillStyle = '#7cf67c';
      ctx.beginPath(); ctx.arc(hinge + dir * (width - 12), DOOR.y + DOOR.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
      ctx.strokeRect(Math.min(hinge + dir * 10, hinge + dir * (width - 10)), DOOR.y + 20, Math.abs(width) - 20, DOOR.h - 60);
    }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.strokeRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  // The sign on a post by the door: GUEST LIST, flipped to DELISTED.
  const flip = clamp(c.signFlip.x, 0, 1);
  ctx.save();
  ctx.translate(DOOR.x + DOOR.w + 26, GROUND - 150);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 150); ctx.stroke();
  ctx.scale(Math.abs(Math.cos(flip * Math.PI)) + 0.02, 1);
  ctx.fillStyle = flip > 0.5 ? '#ff4d6d' : '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-34, -22, 68, 44, 5); ctx.fill(); ctx.stroke();
  memeSmall(ctx, flip > 0.5 ? 'DELISTED' : 'GUEST LIST', 0, 5, 13, flip > 0.5 ? '#ffffff' : INK);
  ctx.restore();
  drawBouncer(ctx, c);
  // Pavement.
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#2b2b36';
  ctx.fillRect(0, GROUND + 30, W, 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x - 30, H); ctx.stroke(); }
  // Puddle reflecting the neon.
  ctx.fillStyle = `rgba(255, 70, 200, ${0.12 + 0.12 * thump})`;
  ctx.beginPath(); ctx.ellipse(430, GROUND + 50, 120, 12, 0, 0, Math.PI * 2); ctx.fill();
}

/** Suits walking along the front, the taxi, the strobe: drawn over the queue. */
export function drawClubFront(ctx: CanvasRenderingContext2D, c: Club, reduced: boolean): void {
  for (const s of c.suits) {
    if (s.entering) { if (s.depth === 0) drawSuit(ctx, s.x, GROUND + 26, c.time * 10 + s.seed, false, s.seed, 0.66); }
    else drawSuit(ctx, s.x, GROUND + 34, c.time * 14 + s.seed, s.bag, s.seed, 0.7, -1);
  }
  if (c.taxi || c.taxiX.x < W + 200) drawTaxi(ctx, c.taxiX.x, c.time, Math.abs(c.taxiX.v) > 8);
  if (c.strobe > 0 && !reduced && Math.floor(c.time * 18) % 2 === 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * c.strobe})`; ctx.fillRect(0, 0, W, H); }
  void mix;
}
