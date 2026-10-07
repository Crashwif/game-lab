/**
 * The bull, the rider and the dust: a bucking cycle that follows the tension, a rider who sits it through
 * lagged springs, vaults to the fence on a cash-out and is thrown by the crash along a seeded arc.
 */
import { type Spring, clamp, mulberry32, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
/** The dirt line, where the bull waits in the chute, where it bucks, and the rail the rider vaults to. */
export const FLOOR = 432;
export const CHUTE_X = 130;
export const ARENA_X = 470;
export const RAIL = { x: 838, y: 296 };

export interface Dust { x: number; y: number; vx: number; vy: number; r: number; age: number }
export interface Bull { x: Spring; phase: number; hop: number; pitch: Spring; kick: number; landed: boolean }
/** On the bull the rider follows its seat; in the air or in the dirt he moves on his own. */
export interface Rider { mode: 'riding' | 'vaulting' | 'fence' | 'thrown' | 'down'; modeAge: number; lean: Spring; arm: Spring; hat: Spring; x: number; y: number; vx: number; vy: number; angle: number; spin: number }
export interface BullDrive { running: boolean; tension: number; loose: boolean; seconds: number }

export const createBull = (): Bull => ({ x: spring(CHUTE_X), phase: 0.75, hop: 0, pitch: spring(0), kick: 0, landed: false });
export const createRider = (): Rider => ({ mode: 'riding', modeAge: 0, lean: spring(0), arm: spring(1.2), hat: spring(0), x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0 });

/** Where the rider sits: on the hump, moved by the hop and the pitch. */
export function seat(b: Bull): { x: number; y: number } {
  const p = b.pitch.x;
  return { x: b.x.x - 18 * Math.cos(p) + 44 * Math.sin(p), y: FLOOR - 92 - b.hop - 18 * Math.sin(p) - 44 * (Math.cos(p) - 1) };
}

export function stepBull(b: Bull, drive: BullDrive, dt: number): void {
  // Long rides alternate a travelling buck, a high kick and a quick double-time shuffle.
  const routine = drive.running ? Math.floor(drive.seconds / 12) % 3 : 0;
  const travel = drive.running && routine === 1 ? Math.sin(drive.seconds * 0.7) * 65 : 0;
  stepSpring(b.x, drive.running || drive.loose ? ARENA_X + travel : CHUTE_X, 3, 0.9, dt);
  // One buck a cycle: the hop is the positive half of the sine; the front dips as the hind legs kick.
  const rate = drive.running ? (0.9 + 1.7 * drive.tension) * (routine === 2 ? 1.14 : 1) : drive.loose ? 0.5 : 0;
  const before = b.phase;
  b.phase += rate * dt;
  b.hop = Math.max(0, Math.sin(b.phase * Math.PI * 2)) * (drive.running ? 20 + (routine === 2 ? 45 : 70) * drive.tension : 12);
  b.kick = Math.max(0, Math.sin(b.phase * Math.PI * 2 - 0.6));
  b.landed = rate > 0 && Math.floor(before + 0.5) !== Math.floor(b.phase + 0.5);
  stepSpring(b.pitch, drive.running ? (0.12 + 0.45 * drive.tension) * Math.sin(b.phase * Math.PI * 2 + 1.2) : 0, 14, 0.7, dt);
}

/** The rider lets go and vaults to the rail. */
export function vault(r: Rider, b: Bull): void {
  const from = seat(b);
  Object.assign(r, { mode: 'vaulting', modeAge: 0, x: from.x, y: from.y, vx: (RAIL.x - from.x) / 0.75, vy: (RAIL.y - from.y) / 0.75 - 0.5 * 900 * 0.75, angle: 0, spin: 4 });
}

/** The rider leaves along the crash's seeded arc; `quiet` lands him in the dirt at once. */
export function throwRider(r: Rider, b: Bull, crashX100: number, quiet: boolean): void {
  const random = mulberry32(crashX100);
  const from = seat(b);
  const vx = (random() > 0.4 ? 1 : -1) * (150 + random() * 200);
  Object.assign(r, quiet ? { mode: 'down', x: from.x + 120, y: FLOOR - 14, angle: Math.PI / 2 } : { mode: 'thrown', x: from.x, y: from.y, angle: 0 }, { modeAge: 0, vx, vy: -(360 + random() * 200), spin: (random() > 0.5 ? 1 : -1) * (5 + random() * 5) });
}

/** Steps the rider; true on the frame he lands. */
export function stepRider(r: Rider, b: Bull, fear: number, dt: number, dust: Dust[]): boolean {
  r.modeAge += dt;
  if (r.mode === 'riding') {
    const p = seat(b);
    r.x = p.x;
    r.y = p.y;
    stepSpring(r.lean, -b.pitch.x * 1.6 - b.hop * 0.004, 9, 0.35, dt);
    stepSpring(r.arm, 1.1 + b.pitch.x * 2 + Math.sin(b.phase * Math.PI * 2) * 0.5 * fear, 12, 0.5, dt);
    stepSpring(r.hat, -b.hop * 0.2, 16, 0.3, dt);
    return false;
  }
  if (r.mode !== 'vaulting' && r.mode !== 'thrown') return false;
  r.vy += 900 * dt;
  r.x += r.vx * dt;
  r.y += r.vy * dt;
  r.angle += r.spin * dt;
  if (r.mode === 'vaulting' && r.modeAge >= 0.75) {
    Object.assign(r, { mode: 'fence', x: RAIL.x, y: RAIL.y, angle: 0 });
    return true;
  }
  if (r.mode === 'thrown' && r.y >= FLOOR - 14 && r.vy > 0) {
    // One bounce, then he lies where he lands.
    r.y = FLOOR - 14;
    if (r.vy > 220) {
      r.vy *= -0.35;
      r.vx *= 0.5;
    } else {
      r.mode = 'down';
      r.angle = r.vx >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    puff(dust, r.x, FLOOR, 8);
    return true;
  }
  return false;
}

export function puff(dust: Dust[], x: number, y: number, n: number): void {
  for (let i = 0; i < n; i += 1) dust.push({ x: x + (i - n / 2) * 6, y, vx: (i - n / 2) * 40, vy: -40 - (i % 3) * 25, r: 6 + (i % 4) * 3, age: 0 });
}

export function stepDust(dust: Dust[], dt: number): Dust[] {
  for (const d of dust) {
    d.age += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.r += 18 * dt;
  }
  return dust.filter((d) => d.age < 0.9);
}

export function drawDust(ctx: CanvasRenderingContext2D, dust: Dust[]): void {
  for (const d of dust) {
    ctx.fillStyle = `rgba(214, 178, 120, ${0.5 * (1 - d.age / 0.9)})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
}

/** An inked stroke from (x, y), turned by `angle` from straight down. */
function limb(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number, colour: string): void {
  const ex = x + Math.sin(-angle) * length;
  const ey = y + Math.cos(angle) * length;
  ctx.lineCap = 'round';
  for (const [w, c] of [[width + 4, INK], [width, colour]] as const) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  }
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = true): void {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  if (stroke) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); }
}

/** The bull, drawn around its belly: legs, tail, body, hump, rope, head and horns. */
export function drawBull(ctx: CanvasRenderingContext2D, b: Bull, time: number): void {
  ctx.save();
  ctx.translate(b.x.x, FLOOR - 62 - b.hop);
  ctx.rotate(b.pitch.x);
  const hide = '#4a2c17';
  limb(ctx, -52, 26, -b.kick * 1.3, 42, 14, hide);
  limb(ctx, -38, 24, -b.kick * 1.1, 42, 14, '#3a2110');
  limb(ctx, 40, 26, b.kick * 0.5, 42, 14, hide);
  limb(ctx, 56, 24, b.kick * 0.35, 42, 14, '#3a2110');
  ctx.strokeStyle = INK; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-76, -14); ctx.quadraticCurveTo(-110, -10 + Math.sin(time * 12) * 30, -104 + Math.sin(time * 9) * 10, -60); ctx.stroke();
  blob(ctx, 0, 0, 80, 40, hide);
  blob(ctx, -28, -36, 36, 22, hide);
  blob(ctx, 8, 14, 50, 18, '#6b4226', false);
  ctx.fillStyle = '#e9d8a6';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$BULL', -20, 6);
  ctx.strokeStyle = '#c9a27a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-40, -40); ctx.quadraticCurveTo(-18, -62, 10, -40); ctx.stroke();
  blob(ctx, 84, -10, 32, 25, hide);
  blob(ctx, 108, 2, 20, 14, '#c9a27a');
  for (const y of [-2, 6]) blob(ctx, 118, y, 2.5, 2.5, INK, false);
  ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(126, 8, 6, 0, Math.PI * 2); ctx.stroke();
  blob(ctx, 92, -20, 6, 6, '#ffffff');
  blob(ctx, 94, -20, 2.5, 2.5, INK, false);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(80, -32); ctx.lineTo(100, -26); ctx.stroke();
  ctx.strokeStyle = '#f4ecd2'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(70, -30); ctx.quadraticCurveTo(52, -62, 74, -66); ctx.moveTo(96, -32); ctx.quadraticCurveTo(114, -62, 96, -68); ctx.stroke();
  ctx.restore();
}

/** The rider, drawn from his seat: legs, a gripping arm, a free arm, a head under a hat. */
export function drawRider(ctx: CanvasRenderingContext2D, r: Rider, fear: number, shades: boolean): void {
  ctx.save();
  ctx.translate(r.x, r.y);
  const flying = r.mode === 'thrown';
  const fence = r.mode === 'fence';
  ctx.rotate(r.mode === 'riding' ? r.lean.x : fence ? 0 : r.angle);
  const shirt = '#d5fb6d';
  limb(ctx, -8, 0, fence ? 0.4 : flying ? -0.6 : 0.55, 30, 9, '#2f4858');
  limb(ctx, 8, 0, fence ? -0.4 : flying ? 0.8 : -0.55, 30, 9, '#2f4858');
  ctx.fillStyle = shirt;
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-12, -42, 24, 44, 8); ctx.fill(); ctx.stroke();
  limb(ctx, -9, -34, flying ? 2.2 : r.mode === 'riding' ? 2.5 : 2.9, 26, 8, shirt);
  limb(ctx, 9, -34, fence ? -2.6 : flying ? -r.arm.x - 1 : -r.arm.x, 30, 8, shirt);
  blob(ctx, 0, -56, 14, 14, '#f4d1b0');
  ctx.fillStyle = INK;
  if (shades) ctx.fillRect(-13, -63, 26, 8);
  else for (const x of [-5, 5]) blob(ctx, x, -59, 2 + fear * 1.5, 2 + fear * 1.5, INK, false);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath();
  if (fear > 0.5 || flying) ctx.ellipse(0, -48, 4, 3 + 4 * fear, 0, 0, Math.PI * 2);
  else ctx.arc(0, -52, 6, 0.3, Math.PI - 0.3);
  ctx.stroke();
  if (!flying && r.mode !== 'down') {
    // The hat rides a little above the head on the bumps.
    ctx.fillStyle = '#8b5a2b';
    const y = -66 + clamp(r.hat.x, -12, 4);
    ctx.beginPath(); ctx.ellipse(0, y, 24, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-13, y - 16, 26, 17, 5); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
