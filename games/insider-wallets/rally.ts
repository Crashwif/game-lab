/**
 * The rally: a fictional candidate (generic cartoon, not a portrait), the
 * podium, flags, crowd, press pool, confetti cannons, helicopter and the
 * seat you can still leave. Hair is drawn without the head's shake.
 */
import { clamp, mulberry32, noise, settleSpring, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
const SKIN = '#f3dccb';
const MARKS = [1.5, 2.2, 3.2, 4.8, 7, 10, 14, 20];

interface Bit { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; rot: number; vr: number; }

export interface Rally {
  tip: Spring;
  droop: Spring;
  lift: number;
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
}

export function createRally(): Rally {
  return {
    tip: spring(0),
    droop: spring(0),
    lift: 0,
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
  };
}

export function resetRally(r: Rally): void {
  const next = createRally();
  Object.assign(r, next);
  r.tip = next.tip;
  r.droop = next.droop;
  r.heliX = next.heliX;
  r.heliY = next.heliY;
}

export function leaveSeat(r: Rally): void {
  r.leaving = true;
}

/** The dump. `quiet` jumps to the end pose, for a crash that already happened; `reduced` plays it without the confetti. */
export function dumpRally(r: Rally, seed: number, quiet: boolean, reduced: boolean): void {
  if (r.crashed) return;
  r.crashed = true;
  if (quiet) {
    r.crashT = 3;
    r.tip.x = 1;
    r.droop.x = 1;
    r.lift = 220;
    r.heliX.x = 470;
    r.heliY.x = -30;
    r.surge = 1;
    return;
  }
  if (reduced) return;
  const rand = mulberry32(seed);
  spawn(r, 230, 300, rand);
  spawn(r, 560, 300, rand);
}

export interface RallyDrive { running: boolean; multiplier: number; tension: number; reduced: boolean; }

/** How many milestone cannons a round has earned by this multiplier. */
const marksPassed = (multiplier: number): number => MARKS.filter((mark) => multiplier >= mark).length;

/**
 * Puts the rally where the view says the round already is, for the part of a round the scene did not
 * watch: the cannons it passed are counted but not fired, the flags and the helicopter sit where the
 * tension holds them, and a seat you already left is empty.
 */
export function settleRally(r: Rally, drive: RallyDrive, left: boolean): void {
  r.cannons = Math.max(r.cannons, marksPassed(drive.multiplier));
  settleSpring(r.droop, drive.tension * 0.15);
  settleSpring(r.heliX, 760 - drive.tension * 80);
  if (left) {
    r.leaving = true;
    r.seatX = 0;
  }
}

export function stepRally(r: Rally, drive: RallyDrive, dt: number): void {
  r.crashT += r.crashed ? dt : 0;
  // Reduced motion slows the rotor (and the bob that follows it) rather than stopping the helicopter dead.
  r.rotor += dt * (10 + drive.tension * 16) * (drive.reduced ? 0.2 : 1);
  const marks = marksPassed(drive.multiplier);
  if (drive.running && marks > r.cannons) {
    if (!drive.reduced) {
      const rand = mulberry32(marks * 17 + 3);
      spawn(r, 210, 310, rand);
      spawn(r, 560, 300, rand);
    }
    r.cannons = marks;
  }
  stepSpring(r.tip, r.crashed ? 1 : 0, 5, 0.55, dt);
  stepSpring(r.droop, r.crashed ? 1 : drive.tension * 0.15, 3, 0.8, dt);
  stepSpring(r.heliX, r.crashed ? 450 : 760 - drive.tension * 80, 2.4, 0.9, dt);
  stepSpring(r.heliY, r.crashed ? -40 : 70 + Math.sin(r.rotor * 0.2) * 4, 2.2, 0.85, dt);
  if (r.crashed) r.lift = Math.min(260, r.lift + 70 * dt);
  if (r.leaving) r.seatX -= 130 * dt;
  if (r.crashed) r.surge = Math.min(1, r.surge + dt * 0.8);
  for (const bit of r.bits) {
    bit.age += dt;
    bit.vy += 280 * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.rot += bit.vr * dt;
  }
  r.bits = r.bits.filter((bit) => bit.age < bit.life);
}

function spawn(r: Rally, x: number, y: number, rand: () => number): void {
  const colors = ['#f0c14a', '#ff4d4d', '#d5fb6d', '#ffffff', '#7ec8ff'];
  for (let i = 0; i < 16; i += 1) {
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
export function prompter(multiplier: number, crashed: boolean, tension: number): readonly [string, string] {
  if (crashed || tension > 0.82) return ['NEVER HEARD', 'OF THIS COIN'];
  if (multiplier < 1.4) return ['GM', 'PATRIOTS'];
  if (multiplier < 2.1) return ["THE PEOPLE'S", 'COIN'];
  if (multiplier < 3.2) return ['NUMBER ONLY', 'GOES UP'];
  if (multiplier < 5) return ['TREMENDOUS', 'BAGS'];
  if (multiplier < 8) return ['BUY', 'THE DIP'];
  return ['I LOVE', 'THE UNBANKED'];
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

function drawCandidate(ctx: CanvasRenderingContext2D, lift: number, tension: number, time: number, crashed: boolean): void {
  const jitter = !crashed && tension > 0.45 ? Math.sin(time * 42) * 3 * tension : 0;
  const tie = Math.sin(time * (3 + tension * 6)) * (4 + tension * 8);
  ctx.save();
  ctx.translate(430, 328 - lift);
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

function drawCrowd(ctx: CanvasRenderingContext2D, multiplier: number, surge: number, crashed: boolean): void {
  const growth = Math.log2(Math.max(1, multiplier));
  const shown = clamp(Math.round(10 + growth * 18), 10, 70);
  const signs: { x: number; y: number }[] = [];
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
    const sign = { x, y: y - 28 };
    const crowded = sign.x < 150 || sign.x > 590 || signs.some((other) => Math.hypot(other.x - sign.x, other.y - sign.y) < 56);
    if (i % 7 === 0 && !crowded) signs.push(sign);
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
    ctx.fillText(crashed ? 'RUGGED' : 'SEND IT', sign.x, sign.y + 8);
  }
}

function drawPress(ctx: CanvasRenderingContext2D, tension: number, time: number, reduced: boolean): void {
  for (let i = 0; i < 3; i += 1) {
    const x = 36 + i * 28;
    ctx.fillStyle = '#222';
    ctx.fillRect(x, 430, 22, 16);
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(x + 11, 426, 8, 0, Math.PI * 2);
    ctx.fill();
    const flash = !reduced && noise(Math.floor(time * (3 + tension * 8)) + i * 4) > 0.62;
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
  drawCandidate(ctx, r.lift, tension, time, r.crashed);
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
  // Seal.
  ctx.fillStyle = '#f0c14a';
  ctx.beginPath();
  ctx.arc(0, 8, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 12px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', 0, 12);
  // Teleprompter.
  ctx.fillStyle = '#07140c';
  ctx.fillRect(-64, -22, 128, 36);
  ctx.fillStyle = '#39ff8a';
  ctx.font = '700 11px ui-monospace, monospace';
  const [topLine, bottomLine] = prompter(multiplier, r.crashed, tension);
  ctx.fillText(topLine, 0, -4);
  ctx.fillText(bottomLine, 0, 10);
  ctx.restore();
  drawCrowd(ctx, multiplier, r.surge, r.crashed);
  drawPress(ctx, tension, time, reduced);
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
