import { solveLimb } from './kinematics';
/**
 * The people of Thanksgiving Uncle: Dad and the niece behind the table facing us, whose civility drains with
 * the tension (his smile freezes wider, her eyes roll further and her phone comes up); Grandma dozing at the
 * end of the table until grace; and Uncle Rick in the foreground with his back to us, cap, vest and beer,
 * making his points. Rigs and drawing only; nothing here picks or changes the outcome.
 */
import { INK, blend } from './room';
import { clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

/** The family's seats: the base of the neck, on the far side of the table. */
export const SEAT_Y = 262;
export const DAD_X = 372;
export const NIECE_X = 592;
const HEAD_Y = -52;
/** Where Rick sits: the chair's foot, at the near edge of the table. Grandma's seat at the far left end. */
export const RICK_X = 604;
/** The seat leaves floor space under the legs through the camera's crash punch. */
const CHAIR_Y = 460;
export const GRAN = { x: 182, y: 362 } as const;
/** Dad's wine glass, in the room, for the shards. */
export const GLASS_AT = { x: DAD_X - 46, y: SEAT_Y + 34 } as const;
const SKIN = '#f1cfb0';
const FLUSH = '#e8a8a0';

interface Drop { x: number; y: number; vy: number }

export interface Relative {
  kind: 'dad' | 'niece';
  x: number;
  seed: number;
  /** How far gone they are, 0 to 1: a slow spring behind the tension, kicked by each of Rick's lines. */
  heat: Spring;
  kick: Spring;
  /** Head down for grace. */
  bow: Spring;
  /** The niece's phone, from the table to her face. */
  phone: Spring;
  glass: 'whole' | 'cracked' | 'gone';
  sweat: Drop[];
  sweatClock: number;
  gasps: number;
  /** The frozen smile's twitch. */
  twitch: number;
}

function relative(kind: Relative['kind'], x: number, seed: number): Relative {
  return { kind, x, seed, heat: spring(0), kick: spring(0), bow: spring(0), phone: spring(0), glass: 'whole', sweat: [], sweatClock: 0, gasps: 0, twitch: 0 };
}

export const createFamily = (): Relative[] => [relative('dad', DAD_X, 3), relative('niece', NIECE_X, 17)];
export function resetFamily(f: Relative[]): void {
  f[0] = relative('dad', DAD_X, 3);
  f[1] = relative('niece', NIECE_X, 17);
}

const heatFor = (r: Relative, tension: number): number => (r.kind === 'dad' ? smoothstep(0, 0.9, tension) : smoothstep(0.05, 0.85, tension));

export interface FamilyDrive {
  running: boolean;
  tension: number;
  time: number;
  reduced: boolean;
  /** Rick said something this frame. */
  rickLine: boolean;
  /** Grandma has said grace: heads down, phones away, civility back. */
  grace: boolean;
  /** The truck is in the room: she keeps filming. */
  wrecked: boolean;
}
export interface FamilyEvents { crack: boolean; gasp: boolean }

export function stepFamily(f: Relative[], drive: FamilyDrive, dt: number): FamilyEvents {
  const ev: FamilyEvents = { crack: false, gasp: false };
  for (const r of f) {
    const target = drive.grace ? 0 : drive.wrecked ? r.heat.x : drive.running ? heatFor(r, drive.tension) : 0;
    if (drive.rickLine && !drive.grace && !drive.wrecked) {
      r.heat.v += 0.45;
      r.kick.v += r.kind === 'dad' ? -70 : 60;
      if (r.kind === 'dad' && r.heat.x > 0.5) {
        r.gasps += 1;
        if (r.gasps % 2 === 1) ev.gasp = true;
      }
    }
    stepSpring(r.heat, target, drive.grace ? 2 : 3, 0.85, dt);
    stepSpring(r.kick, 0, 16, 0.4, dt);
    stepSpring(r.bow, drive.grace ? 1 : 0, 6, 0.8, dt);
    const heat = clamp(r.heat.x, 0, 1);
    stepSpring(r.phone, r.kind === 'niece' && !drive.grace && (heat > 0.4 || drive.wrecked) ? 1 : 0, 8, 0.65, dt);
    if (r.kind === 'dad' && r.glass === 'whole' && heat > 0.75) {
      r.glass = 'cracked';
      ev.crack = true;
    }
    r.twitch = heat > 0.45 && !drive.reduced ? Math.max(0, Math.sin(drive.time * 23 + r.seed)) * heat : 0;
    const rand = () => noise(drive.time * 131 + r.seed + r.sweat.length);
    if (heat > 0.5 && !drive.grace) {
      r.sweatClock += dt;
      if (r.sweatClock > 0.8 - 0.3 * heat) {
        r.sweatClock = 0;
        const side = rand() > 0.5 ? 1 : -1;
        r.sweat.push({ x: side * (28 + rand() * 8), y: -28, vy: 20 });
      }
    }
    for (const d of r.sweat) {
      d.vy += 60 * dt;
      d.y += d.vy * dt;
    }
    r.sweat = r.sweat.filter((d) => d.y < 30);
  }
  return ev;
}

/** The truck is in: Dad's glass goes. */
export function wreckFamily(f: Relative[]): void {
  for (const r of f) if (r.kind === 'dad') r.glass = 'gone';
}

export function settleFamily(f: Relative[], tension: number, grace: boolean): void {
  for (const r of f) {
    settleSpring(r.heat, grace ? 0 : heatFor(r, tension));
    settleSpring(r.bow, grace ? 1 : 0);
    settleSpring(r.phone, r.kind === 'niece' && !grace && r.heat.x > 0.4 ? 1 : 0);
    if (r.kind === 'dad' && !grace && r.heat.x > 0.75) r.glass = 'cracked';
  }
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function arm(ctx: CanvasRenderingContext2D, color: string, width: number, sx: number, sy: number, ex: number, ey: number, hx: number, hy: number, skin: string): void {
  const upper = width >= 22 ? 60 : 49, lower = width >= 22 ? 57 : 47;
  const solved = solveLimb({ x: sx, y: sy }, { x: hx, y: hy }, upper, lower, sx < 0 ? 1 : -1);
  ex = solved.joint.x; ey = solved.joint.y; hx = solved.end.x; hy = solved.end.y;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ink(ctx, 2.5);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawGlass(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number, cracked: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ink(ctx, 2);
  ctx.strokeStyle = '#6b6b70';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -16);
  ctx.moveTo(-8, 0);
  ctx.lineTo(8, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200, 230, 255, 0.45)';
  ctx.beginPath();
  ctx.moveTo(-12, -40);
  ctx.quadraticCurveTo(-13, -14, 0, -16);
  ctx.quadraticCurveTo(13, -14, 12, -40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7a1f3a';
  ctx.beginPath();
  ctx.moveTo(-11.5, -30);
  ctx.quadraticCurveTo(-12, -15, 0, -17);
  ctx.quadraticCurveTo(12, -15, 11.5, -30);
  ctx.closePath();
  ctx.fill();
  if (cracked) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -38);
    ctx.lineTo(-2, -28);
    ctx.lineTo(-7, -22);
    ctx.moveTo(-2, -28);
    ctx.lineTo(5, -24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPhone(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, rec: boolean, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#2a2a30';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(-10, -20, 20, 38, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9fc3d9';
  ctx.fillRect(-7, -16, 14, 28);
  if (rec && Math.sin(time * 6) > -0.3) {
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(-3, -11, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, r: Relative, heat: number, time: number): void {
  const bow = clamp(r.bow.x, 0, 1);
  ink(ctx, 2.5);
  if (r.kind === 'dad') {
    // The quarter-zip: a stand collar, the zip with its pull.
    ctx.fillStyle = '#5b6b7a';
    ctx.beginPath();
    ctx.roundRect(-58, -12, 116, 104, 20);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4a5866';
    ctx.beginPath();
    ctx.roundRect(-20, -22, 40, 16, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 30);
    ctx.stroke();
    ctx.fillStyle = '#c9ced6';
    ctx.fillRect(-3, 26, 6, 10);
    // Glass hand, or the empty hand once it has gone; the other hand pats the air for calm, then folds for grace.
    const skin = blend(SKIN, FLUSH, heat * 0.5);
    const gx = mix(-46, -16, bow);
    const gy = mix(50, 60, bow);
    arm(ctx, '#5b6b7a', 17, -54, -2, mix(-76, -60, bow), 40, gx, gy, skin);
    if (r.glass !== 'gone' && bow < 0.5) drawGlass(ctx, gx, gy - 6, (noise(Math.floor(time * 24) + 2) - 0.5) * 0.5 * heat * heat, r.glass === 'cracked');
    const pat = heat > 0.3 && bow < 0.5 ? Math.max(0, Math.sin(time * 5)) * 14 * smoothstep(0.3, 0.6, heat) : 0;
    const px = mix(46, 16, bow);
    const py = mix(58 - pat, 60, bow);
    arm(ctx, '#5b6b7a', 17, 54, -2, mix(76, 60, bow), 40 - pat * 0.5, px, py, skin);
    if (pat > 2) {
      ink(ctx, 2);
      ctx.beginPath();
      ctx.moveTo(36, py);
      ctx.lineTo(56, py);
      ctx.stroke();
    }
  } else {
    // The oversized olive cardigan over a band tee.
    ctx.fillStyle = '#7f8f6a';
    ctx.beginPath();
    ctx.roundRect(-64, -12, 128, 104, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2a30';
    ctx.beginPath();
    ctx.roundRect(-26, -2, 52, 76, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7f3ea';
    ctx.font = '900 8px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SOFT', 0, 26);
    ctx.fillText('PUNK', 0, 36);
    ctx.fillStyle = '#6a7a56';
    for (const y of [40, 60, 80]) {
      ctx.beginPath();
      ctx.arc(-30, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const skin = SKIN;
    const ph = clamp(r.phone.x, 0, 1);
    const hx = mix(-46, -16, bow);
    const hy = mix(60, 60, bow);
    arm(ctx, '#7f8f6a', 19, -58, -2, mix(-80, -60, bow), 42, hx, hy, skin);
    const fx = mix(mix(46, 34, ph), 16, bow);
    const fy = mix(mix(58, -14, ph), 60, bow);
    arm(ctx, '#7f8f6a', 19, 58, -2, mix(mix(80, 70, ph), 60, bow), mix(mix(42, 20, ph), 40, bow), fx, fy, skin);
    if (bow < 0.5) drawPhone(ctx, fx + 2, fy - 10, -0.2 + ph * 0.1, ph > 0.6, time);
  }
  ink(ctx, 2.5);
  ctx.fillStyle = blend(SKIN, FLUSH, heat * 0.6);
  ctx.beginPath();
  ctx.roundRect(-12, -22, 24, r.kind === 'niece' ? 34 : 14, r.kind === 'niece' ? 7 : 0);
  ctx.fill();
  ctx.stroke();
}

function drawHead(ctx: CanvasRenderingContext2D, r: Relative, time: number, reduced: boolean): void {
  const heat = clamp(r.heat.x, 0, 1);
  const bow = clamp(r.bow.x, 0, 1);
  const jit = reduced ? 0 : 3 * heat * heat;
  const jx = (noise(Math.floor(time * 42) + r.seed) - 0.5) * 2 * jit;
  const jy = (noise(Math.floor(time * 38) + r.seed + 9) - 0.5) * 2 * jit;
  ctx.save();
  ctx.translate(jx, HEAD_Y + jy + r.kick.x * 0.06 + bow * 12);
  ctx.rotate(bow * 0.3 * (r.kind === 'dad' ? 1 : -1));
  ink(ctx, 2.5);
  if (r.kind === 'niece') {
    // The bob frames the cheeks with separate ends and an open neckline.
    ctx.fillStyle = '#2a1a12';
    ctx.beginPath();
    ctx.moveTo(-44, -30);
    ctx.quadraticCurveTo(-59, -5, -50, 32);
    ctx.quadraticCurveTo(-45, 37, -37, 31);
    ctx.quadraticCurveTo(-42, 10, -34, -18);
    ctx.quadraticCurveTo(0, -35, 36, -18);
    ctx.quadraticCurveTo(42, 10, 38, 31);
    ctx.quadraticCurveTo(47, 38, 53, 30);
    ctx.quadraticCurveTo(59, -2, 44, -30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = SKIN;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 44, 4, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Blotches of colour as the civility goes.
  if (heat > 0.2) {
    ctx.fillStyle = `rgba(230, 110, 110, ${smoothstep(0.2, 0.9, heat) * 0.6})`;
    for (const [bx, by, br] of [[-26, 8, 11], [26, 10, 12], [-8, -34, 7], [14, -30, 8]]) {
      ctx.beginPath();
      ctx.ellipse(bx!, by!, br!, br! * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (r.kind === 'dad') {
    // Short hair with a side part, the beard, round glasses.
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath();
    ctx.moveTo(-42, -12);
    ctx.quadraticCurveTo(-36, -50, 0, -48);
    ctx.quadraticCurveTo(38, -50, 42, -14);
    ctx.quadraticCurveTo(30, -34, 6, -30);
    ctx.quadraticCurveTo(-20, -28, -42, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6b4a2b';
    ctx.beginPath();
    ctx.moveTo(-38, 10);
    ctx.quadraticCurveTo(-40, 50, 0, 50);
    ctx.quadraticCurveTo(40, 50, 38, 10);
    ctx.quadraticCurveTo(30, 24, 0, 22);
    ctx.quadraticCurveTo(-30, 24, -38, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // The beanie with its fold, hair out from under it.
    ctx.fillStyle = '#c86b85';
    ctx.beginPath();
    ctx.ellipse(0, -30, 46, 30, 0, Math.PI, 0);
    ctx.lineTo(46, -22);
    ctx.lineTo(-46, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b55a73';
    ctx.beginPath();
    ctx.roundRect(-46, -30, 92, 14, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a1a12';
    ctx.beginPath();
    ctx.moveTo(-42, -16);
    ctx.quadraticCurveTo(-20, -8, -10, -18);
    ctx.lineTo(-42, -10);
    ctx.closePath();
    ctx.fill();
  }
  // Brows: his climb and strain, hers go flat with one lifted.
  ink(ctx, r.kind === 'dad' ? 5 : 4);
  const closed = bow > 0.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (r.kind === 'dad') {
      ctx.moveTo(side * 30, -24 - 6 * heat);
      ctx.quadraticCurveTo(side * 16, -34 - 10 * heat, side * 8, -26 - 8 * heat);
    } else {
      const lift = side > 0 ? 6 * heat : 0;
      ctx.moveTo(side * 30, -24 - lift);
      ctx.lineTo(side * 8, -26 - lift * 0.4);
    }
    ctx.stroke();
  }
  // Eyes: his go wide; hers roll up until only the whites show.
  for (const side of [-1, 1]) {
    if (closed) {
      ink(ctx, 2.5);
      ctx.beginPath();
      ctx.arc(side * 16, -8, 8, 0.2, Math.PI - 0.2);
      ctx.stroke();
      continue;
    }
    const rx = r.kind === 'dad' ? 9 + 5 * heat : 10;
    const ry = r.kind === 'dad' ? 7 + 6 * heat : 7 + 2 * heat;
    ctx.fillStyle = '#ffffff';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.ellipse(side * 16, -8, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    const roll = r.kind === 'niece' ? smoothstep(0.05, 0.85, heat) * 7.5 : 0;
    ctx.beginPath();
    ctx.arc(side * 16 + (r.kind === 'dad' ? 0 : 1), -6 - roll, r.kind === 'dad' ? Math.max(1.5, 4 - 2 * heat) : 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (r.kind === 'dad') {
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-16, -8, 13, 0, Math.PI * 2);
    ctx.moveTo(13, -8);
    ctx.arc(16, -8, 13, 0, Math.PI * 2);
    ctx.moveTo(-3, -8);
    ctx.lineTo(3, -8);
    ctx.moveTo(-29, -9);
    ctx.lineTo(-42, -4);
    ctx.moveTo(29, -9);
    ctx.lineTo(42, -4);
    ctx.stroke();
  } else {
    // Nose and the ring through it.
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.quadraticCurveTo(-6, 12, 2, 12);
    ctx.stroke();
    ctx.strokeStyle = '#c9ced6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, 12, 4, 0.2, Math.PI);
    ctx.stroke();
  }
  // The mouth: his smile widens and freezes with teeth; hers goes flat, then a smirk.
  ink(ctx, 2.5);
  if (closed) {
    ctx.beginPath();
    ctx.moveTo(-8, 30);
    ctx.lineTo(8, 30);
    ctx.stroke();
  } else if (r.kind === 'dad') {
    const w = 10 + 18 * heat;
    const tw = r.twitch * 3;
    const open = 2 + 9 * heat;
    ctx.fillStyle = '#5a1a1a';
    ctx.beginPath();
    ctx.moveTo(-w, 28);
    ctx.quadraticCurveTo(0, 28 + open * 2, w, 28 - tw);
    ctx.quadraticCurveTo(0, 26, -w, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (heat > 0.25) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-w, 28);
      ctx.quadraticCurveTo(0, 28 + open * 2, w, 28 - tw);
      ctx.quadraticCurveTo(0, 26, -w, 28);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(-w, 26, w * 2, open * 0.9);
      ctx.strokeStyle = '#c9c0b0';
      ctx.lineWidth = 1;
      for (let x = -w + 5; x < w; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, 26);
        ctx.lineTo(x, 26 + open * 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }
  } else {
    const smirk = smoothstep(0.3, 0.8, heat) * 6;
    ctx.beginPath();
    ctx.moveTo(-10, 30);
    ctx.quadraticCurveTo(0, 30 + 2 * (1 - smirk / 6), 10, 30 - smirk);
    ctx.stroke();
  }
  // A vein and sweat for him; a single bead for her at the top.
  if (r.kind === 'dad' && heat > 0.5 && !closed) {
    ctx.strokeStyle = `rgba(122, 42, 74, ${smoothstep(0.5, 0.9, heat) * (0.7 + 0.3 * Math.sin(time * 10))})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(26, -34);
    ctx.lineTo(32, -42);
    ctx.lineTo(28, -50);
    ctx.moveTo(32, -42);
    ctx.lineTo(38, -44);
    ctx.stroke();
  }
  ctx.fillStyle = '#8fd3ff';
  ink(ctx, 1);
  for (const d of r.sweat) {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - 5);
    ctx.quadraticCurveTo(d.x + 3.5, d.y, d.x, d.y + 3);
    ctx.quadraticCurveTo(d.x - 3.5, d.y, d.x, d.y - 5);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRelative(ctx: CanvasRenderingContext2D, r: Relative, time: number, reduced: boolean): void {
  ctx.save();
  ctx.translate(r.x, SEAT_Y);
  drawTorso(ctx, r, clamp(r.heat.x, 0, 1), time);
  drawHead(ctx, r, time, reduced);
  ctx.restore();
}

// ---- Grandma --------------------------------------------------------------------------------------------

export interface Gran {
  /** 0 asleep in her chair, 1 on her feet with the cane up. */
  stand: Spring;
  awake: boolean;
  snores: { x: number; y: number; age: number }[];
  snoreClock: number;
}

export const createGran = (): Gran => ({ stand: spring(0), awake: false, snores: [], snoreClock: 0 });
export function resetGran(g: Gran): void {
  Object.assign(g, createGran());
}

export function stepGran(g: Gran, awake: boolean, dt: number): void {
  g.awake = awake;
  stepSpring(g.stand, awake ? 1 : 0, 7, 0.6, dt);
  if (!awake) {
    g.snoreClock += dt;
    if (g.snoreClock > 1.4) {
      g.snoreClock = 0;
      g.snores.push({ x: 24, y: -100, age: 0 });
    }
  }
  for (const s of g.snores) {
    s.age += dt;
    s.x += 14 * dt;
    s.y -= 22 * dt;
  }
  g.snores = g.snores.filter((s) => s.age < 1.8);
}

export function settleGran(g: Gran, awake: boolean): void {
  g.awake = awake;
  settleSpring(g.stand, awake ? 1 : 0);
}

export function caneGrip(up: number): { x: number; y: number; angle: number } {
  up = clamp(up, 0, 1);
  return { x: mix(-26, -45, up), y: mix(-70, -98, up), angle: mix(0, 1.05, up) };
}

/** Grandma in profile at the end of the table, facing the family: asleep in her cardigan, or up with the cane. */
export function drawGran(ctx: CanvasRenderingContext2D, g: Gran, time: number): void {
  const up = clamp(g.stand.x, 0, 1);
  ctx.save();
  ctx.translate(GRAN.x, GRAN.y);
  ink(ctx, 2.5);
  // The chair's legs reach the floor behind the table's left edge.
  ctx.fillStyle = 'rgba(42, 30, 20, 0.16)';
  ctx.beginPath();
  ctx.ellipse(-5, 60, 42, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a30';
  for (const x of [-30, 16]) {
    ctx.beginPath();
    ctx.roundRect(x, 6, 8, 54, 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(-26, 36, 46, 6, 2);
  ctx.fill();
  ctx.stroke();
  // The seat and back stay planted while she stands for grace.
  ctx.fillStyle = '#2a2a30';
  ctx.beginPath();
  ctx.roundRect(-34, -110, 10, 112, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-34, 0, 60, 10, 3);
  ctx.fill();
  ctx.stroke();
  ctx.translate(0, -up * 26);
  // The cane: leaning on the chair, then raised in her hand.
  ctx.save();
  const grip = caneGrip(up);
  ctx.translate(grip.x, grip.y);
  ctx.rotate(grip.angle);
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 70);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6, 0, 6, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
  // Cardigan, pearls, the head with the perm, glasses, the mouth.
  ctx.fillStyle = '#b58fb0';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.roundRect(-20, -72, 44, 72, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f6f0e4';
  ink(ctx, 1.2);
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(8 + i * 3, -60 + Math.sin(i / 4 * Math.PI) * 6, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  const elbow = solveLimb({ x: -14, y: -58 }, grip, 31, 30, -1).joint;
  ctx.strokeStyle = '#b58fb0'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -58); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(grip.x, grip.y); ctx.stroke();
  ink(ctx, 2.5); ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(grip.x, grip.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ink(ctx, 2.5);
  ctx.strokeStyle = '#b58fb0';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(10, -56);
  ctx.lineTo(mix(30, 14, up), mix(-30, -70, up));
  ctx.stroke();
  ink(ctx, 2.5);
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(mix(30, 14, up), mix(-30, -70, up), 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(8, -96);
  ctx.rotate(mix(0.25, -0.1, up));
  ctx.fillStyle = '#f4f1ea';
  for (const [cx, cy, cr] of [[-14, -14, 14], [-2, -22, 14], [12, -16, 12], [-20, 2, 12], [-18, 14, 10]]) {
    ctx.beginPath();
    ctx.arc(cx!, cy!, cr!, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(2, 0, 22, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(22, -4);
  ctx.quadraticCurveTo(32, 0, 22, 6);
  ctx.stroke();
  ctx.strokeStyle = '#2a2a30';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(12, -4, 7, 0, Math.PI * 2);
  ctx.moveTo(5, -4);
  ctx.lineTo(-14, -8);
  ctx.stroke();
  ink(ctx, 2.5);
  if (up > 0.5) {
    ctx.fillStyle = '#5a1a1a';
    ctx.beginPath();
    ctx.ellipse(16, 12, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(16, -4);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(9, -3);
    ctx.lineTo(16, -3);
    ctx.moveTo(12, 12);
    ctx.lineTo(20, 10);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  // Her snores drift up from the chair.
  ctx.save();
  ctx.translate(GRAN.x, GRAN.y);
  ctx.font = '900 16px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const s of g.snores) {
    ctx.globalAlpha = 1 - s.age / 1.8;
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText('z', s.x, s.y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('z', s.x, s.y);
  }
  ctx.restore();
  void time;
}

// ---- Rick -----------------------------------------------------------------------------------------------

export interface Rick {
  turn: Spring;
  talk: number;
  gesture: Spring;
  /** The beer comes up to make a point, and all the way up for Dale. */
  beer: Spring;
  mode: 'talking' | 'bowed' | 'turned' | 'asleep';
  tilt: Spring;
  snores: { x: number; y: number; age: number }[];
  snoreClock: number;
}

export const createRick = (): Rick => ({ turn: spring(0), talk: 0, gesture: spring(0), beer: spring(0), mode: 'talking', tilt: spring(0), snores: [], snoreClock: 0 });
export function resetRick(r: Rick): void {
  Object.assign(r, createRick());
}

export interface RickDrive { speaking: boolean; tension: number; time: number }

export function stepRick(r: Rick, drive: RickDrive, dt: number): void {
  stepSpring(r.turn, r.mode === 'turned' ? 1 : 0, 7, .9, dt);
  r.talk += clamp((drive.speaking && r.mode === 'talking' ? 1 : 0) - r.talk, -dt * 3, dt * 8);
  stepSpring(r.gesture, r.talk * (0.4 + 0.6 * drive.tension), 5, 0.6, dt);
  const beer = r.mode === 'turned' ? 1 : r.mode === 'talking' ? r.talk * (0.3 + 0.5 * drive.tension) : 0;
  stepSpring(r.beer, beer, 6, 0.6, dt);
  stepSpring(r.tilt, r.mode === 'asleep' ? 1 : r.mode === 'bowed' ? -0.6 : 0, 5, 0.7, dt);
  if (r.mode === 'asleep') {
    r.snoreClock += dt;
    if (r.snoreClock > 1.2) {
      r.snoreClock = 0;
      r.snores.push({ x: 40, y: -150, age: 0 });
    }
  }
  for (const s of r.snores) {
    s.age += dt;
    s.x += 16 * dt;
    s.y -= 24 * dt;
  }
  r.snores = r.snores.filter((s) => s.age < 1.8);
}

/** A ladder-back chair between us and Rick: drawn after him, so he sits on its seat behind its slats. */
export function drawRickChair(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(RICK_X, CHAIR_Y);
  ink(ctx, 2.5);
  ctx.fillStyle = '#1f1f24';
  for (const s of [-46, 46]) {
    ctx.beginPath();
    ctx.roundRect(s - 5, 10, 10, 40, 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#2a2a30';
  for (const s of [-62, 62]) {
    ctx.beginPath();
    ctx.roundRect(s - 6, -62, 12, 110, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(-62, 28, 124, 7, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-68, 0, 136, 12, 4);
  ctx.fill();
  ctx.stroke();
  for (const y of [-58, -40, -22]) {
    ctx.beginPath();
    ctx.roundRect(-62, y, 124, 9, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawCan(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ink(ctx, 2);
  ctx.fillStyle = '#c9ced6';
  ctx.beginPath();
  ctx.roundRect(-9, -30, 18, 34, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2b4a7a';
  ctx.fillRect(-9, -20, 18, 12);
  ctx.fillStyle = '#c4302b';
  ctx.fillRect(-9, -10, 18, 3);
  ctx.restore();
}

/** Rick from behind: the camo cap and the strap, a sunburnt neck, the blaze vest over flannel, a beer and a pointing finger. */
export function drawRick(ctx: CanvasRenderingContext2D, r: Rick, time: number, reduced: boolean): void {
  const g = clamp(r.gesture.x, 0, 1);
  const beer = clamp(r.beer.x, 0, 1.2);
  const tilt = r.tilt.x;
  ctx.save();
  ctx.translate(RICK_X, CHAIR_Y);
  // Jeans and work boots under the seat.
  ink(ctx, 2.5);
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#3f5f8a';
    ctx.beginPath();
    ctx.roundRect(side * 26 - 15, -6, 30, 36, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath();
    ctx.roundRect(side * 26 - 17, 24, 34, 14, 4);
    ctx.fill();
    ctx.stroke();
  }
  // Turn above the planted hips; the head leads the slower shoulders.
  ctx.rotate(-.07 * clamp(r.turn.x, 0, 1));
  // The flannel shoulders and the vest over them.
  ink(ctx, 2.5);
  ctx.fillStyle = '#8a3b2b';
  ctx.beginPath();
  ctx.roundRect(-92, -70, 184, 76, 30);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-92, -70, 184, 76, 30);
  ctx.clip();
  ctx.strokeStyle = '#5a2418';
  ctx.lineWidth = 4;
  for (let x = -84; x < 92; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, -70);
    ctx.lineTo(x, 6);
    ctx.stroke();
  }
  for (let y = -62; y < 6; y += 20) {
    ctx.beginPath();
    ctx.moveTo(-92, y);
    ctx.lineTo(92, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#ff7a1a';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.roundRect(-58, -72, 116, 78, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9d9d9';
  ctx.fillRect(-58, -40, 116, 8);
  ctx.strokeStyle = '#ff7a1a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-58, -40, 116, 8);
  // Arms: the beer hand on the right, the pointing hand on the left.
  const asleep = r.mode === 'asleep';
  const sleep = clamp(tilt, 0, 1), bow = clamp(-tilt / .6, 0, 1);
  const bx = mix(74 + 10 * beer, 86, sleep);
  const by = mix(-84 - 70 * beer, -56, sleep);
  arm(ctx, '#8a3b2b', 22, 70, -56, asleep ? 96 : 96, asleep ? -40 : -60 - 20 * beer, bx, by, SKIN);
  if (!asleep) drawCan(ctx, bx - 2, by - 8, -0.3 + 0.2 * beer);
  const wave = Math.sin(time * 7) * g;
  const px = mix(-72 - 10 * g + wave * 10, -40, bow);
  const py = mix(mix(-84 - 50 * g + Math.sin(time * 9) * 10 * g, -50, sleep), -70, bow);
  arm(ctx, '#8a3b2b', 22, -70, -56, -96, asleep ? -40 : -56 - 24 * g, px, py, SKIN);
  if (g > 0.2 && !asleep) {
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(px - 4, py - 8);
    ctx.lineTo(px - 10, py - 24 - 6 * g);
    ctx.stroke();
  }
  // The head: a sunburnt neck, an ear and a stubbled cheek on the left, hair under the cap, the cap and its strap.
  ctx.save();
  ctx.translate(-4, -118);
  ctx.rotate(tilt * 0.35 - .25 * clamp(r.turn.x, 0, 1));
  if (r.talk > 0 && !reduced) ctx.translate(0, Math.sin(time * 5) * 1.5);
  ctx.fillStyle = '#e0a080';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.roundRect(-16, 14, 32, 30, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(0, 0, 36, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-36, 2, 8, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.arc(-30 + noise(i) * 14, 8 + noise(i + 30) * 24, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  if (r.mode === 'turned') {
    // Turned toward the wall: a profile with the mouth open.
    ctx.fillStyle = SKIN;
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(-36, -8);
    ctx.quadraticCurveTo(-48, 0, -38, 8);
    ctx.stroke();
    ctx.fillStyle = '#5a1a1a';
    ctx.beginPath();
    ctx.ellipse(-32, 18, 5, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-30, -8, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-32, -8, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#5a3a22';
  ctx.beginPath();
  ctx.moveTo(-34, 6);
  ctx.quadraticCurveTo(-30, 34, 0, 36);
  ctx.quadraticCurveTo(30, 34, 34, 6);
  ctx.lineTo(34, -6);
  ctx.lineTo(-34, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5a6b3a';
  ctx.beginPath();
  ctx.ellipse(0, -10, 40, 34, 0, Math.PI, 0);
  ctx.lineTo(40, -4);
  ctx.lineTo(-40, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -10, 40, 34, 0, Math.PI, 0);
  ctx.lineTo(40, -4);
  ctx.lineTo(-40, -4);
  ctx.closePath();
  ctx.clip();
  for (const [cx, cy, cr, c] of [[-20, -20, 10, '#3f4a2a'], [12, -30, 9, '#8a7a4a'], [24, -12, 8, '#3f4a2a'], [-6, -8, 7, '#8a7a4a'], [-28, -2, 6, '#2d3a1e'], [4, -40, 6, '#2d3a1e']]) {
    ctx.fillStyle = c as string;
    ctx.beginPath();
    ctx.ellipse(cx as number, cy as number, cr as number, (cr as number) * 0.7, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#2a2a30';
  ctx.beginPath();
  ctx.roundRect(-12, -10, 24, 8, 2);
  ctx.fill();
  ctx.fillStyle = '#3f4a2a';
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(6, -10);
  ctx.lineTo(4, -2);
  ctx.lineTo(-4, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Snores once he is out.
  ctx.font = '900 18px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const s of r.snores) {
    ctx.globalAlpha = 1 - s.age / 1.8;
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText('z', s.x, s.y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('z', s.x, s.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
