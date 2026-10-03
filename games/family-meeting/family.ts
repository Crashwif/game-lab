/**
 * The family of Family Meeting: the father and the mother behind the table, facing us, whose colour, brows,
 * veins, steam, swelling and shaking follow the tension until the crash blows their heads off; and the
 * daughter in the foreground with her back to us, rainbow hair down to her shoulders, explaining with her
 * hands. Rigs and drawing only; nothing here picks or changes the outcome.
 */
import { INK, blend, burstHead, puff, type Kitchen, type Puff } from './kitchen';
import { clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

/** The parents' seats: the base of the neck, on the far side of the table. */
export const SEAT_Y = 262;
export const DAD_X = 372;
export const MOM_X = 592;
const HEAD_Y = -52;
/** Where she sits: the chair's foot, at the near edge of the table. */
export const DAUGHTER_X = 604;
/** The seat of her chair: the rig's origin, so the chair's legs show under it. */
const CHAIR_Y = 506;
const SKIN = { dad: '#f1cfb0', mom: '#f6d6c0' } as const;
const HAIR = { dad: '#b9b3a8', mom: '#d8c08f' } as const;
const HOT = '#e2574a';
const BOILING = '#8e2b7a';
const DAD_SHIRT = '#3b5f9a';
const MOM_CARDIGAN = '#9a6fb0';
const RAINBOW = ['#e63946', '#f4813f', '#ffd166', '#5cb85c', '#3f8fe6', '#5b4bd6', '#a24bd6'];

interface Drop { x: number; y: number; vy: number }

export interface Parent {
  kind: 'dad' | 'mom';
  x: number;
  seed: number;
  /** How hot they are, 0 to 1: a slow spring behind the tension, kicked by each of her lines. */
  rage: Spring;
  /** A nod of the head when she says something. */
  kick: Spring;
  /** A hand on the way to the pearls (mom) or the forehead (dad, once it is over). */
  clutch: Spring;
  slamT: number;
  slamClock: number;
  sweat: Drop[];
  sweatClock: number;
  steam: Puff[];
  steamClock: number;
  drips: Drop[];
  dripClock: number;
  exploded: boolean;
  deflated: boolean;
  gasps: number;
}

function parent(kind: Parent['kind'], x: number, seed: number): Parent {
  return { kind, x, seed, rage: spring(0), kick: spring(0), clutch: spring(0), slamT: 1, slamClock: 0, sweat: [], sweatClock: 0, steam: [], steamClock: 0, drips: [], dripClock: 0, exploded: false, deflated: false, gasps: 0 };
}

export const createParents = (): Parent[] => [parent('dad', DAD_X, 3), parent('mom', MOM_X, 17)];
export function resetParents(ps: Parent[]): void {
  ps[0] = parent('dad', DAD_X, 3);
  ps[1] = parent('mom', MOM_X, 17);
}

/** The heat each of them reaches at a tension: he boils first, she holds out a little longer. */
const heatFor = (p: Parent, tension: number): number => (p.kind === 'dad' ? smoothstep(0, 0.82, tension) : smoothstep(0.06, 0.95, tension));
/** Where the head is, in the room: for the burst, the smoke and anything aimed at it. */
export const headAt = (p: Parent): { x: number; y: number } => ({ x: p.x, y: SEAT_Y + HEAD_Y });
export const neckAt = (p: Parent): { x: number; y: number } => ({ x: p.x, y: SEAT_Y - 14 });

export interface FamilyDrive {
  running: boolean;
  tension: number;
  time: number;
  reduced: boolean;
  /** She said something this frame. */
  herLine: boolean;
  /** She has left the table (an accepted cash-out): they simmer rather than boil. */
  left: boolean;
}
export interface FamilyEvents { slam: boolean; gasp: boolean; steam: boolean }

export function stepParents(ps: Parent[], drive: FamilyDrive, dt: number): FamilyEvents {
  const ev: FamilyEvents = { slam: false, gasp: false, steam: false };
  for (const p of ps) {
    const base = drive.running ? heatFor(p, drive.tension) : 0;
    const target = p.exploded ? p.rage.x : p.deflated ? 0 : drive.left ? base * 0.3 : base;
    if (drive.herLine && !p.exploded && !p.deflated) {
      p.rage.v += 0.5;
      p.kick.v += p.kind === 'dad' ? 90 : -70;
      if (p.kind === 'mom' && p.rage.x > 0.3) {
        p.gasps += 1;
        if (p.gasps % 2 === 1) ev.gasp = true;
      }
    }
    stepSpring(p.rage, target, p.deflated ? 2.2 : 3, 0.85, dt);
    stepSpring(p.kick, 0, 16, 0.4, dt);
    const heat = clamp(p.rage.x, 0, 1);
    const clutchTarget = p.deflated ? 1 : p.kind === 'mom' ? smoothstep(0.25, 0.55, heat) : 0;
    stepSpring(p.clutch, clutchTarget, 6, 0.7, dt);
    if (p.exploded) continue;

    // His fist: it comes down on the table every so often once he is past half way.
    if (p.kind === 'dad' && heat > 0.55 && !p.deflated) {
      p.slamClock += dt * (0.5 + heat);
      if (p.slamT >= 1 && p.slamClock > 1.6) {
        p.slamClock = 0;
        p.slamT = 0;
      }
    }
    if (p.slamT < 1) {
      const was = p.slamT;
      p.slamT = Math.min(1, p.slamT + dt / 0.42);
      if (was < 0.55 && p.slamT >= 0.55) ev.slam = true;
    }
    // Sweat, steam from the ears, coffee over the rim of her mug.
    const rand = () => noise(drive.time * 131 + p.seed + p.sweat.length);
    if (heat > 0.5) {
      p.sweatClock += dt;
      if (p.sweatClock > 0.7 - 0.3 * heat) {
        p.sweatClock = 0;
        const side = rand() > 0.5 ? 1 : -1;
        p.sweat.push({ x: side * (28 + rand() * 10), y: -26, vy: 20 });
      }
    }
    for (const d of p.sweat) {
      d.vy += 60 * dt;
      d.y += d.vy * dt;
    }
    p.sweat = p.sweat.filter((d) => d.y < 36);
    if (heat > 0.55) {
      const wasQuiet = p.steam.length === 0;
      p.steamClock += dt;
      if (p.steamClock > 0.09 / heat) {
        p.steamClock = 0;
        for (const side of [-1, 1]) puff(p.steam, side * 50, HEAD_Y + 2, 3 + heat * 3, -30 - heat * 40, 0.7 + rand() * 0.4, 'rgba(255,255,255,0.8)', rand);
        p.steam[p.steam.length - 1]!.vx = 14;
        p.steam[p.steam.length - 2]!.vx = -14;
        if (wasQuiet) ev.steam = true;
      }
    }
    for (const s of p.steam) {
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += s.grow * dt;
    }
    p.steam = p.steam.filter((s) => s.age < s.life);
    if (p.kind === 'mom' && heat > 0.7 && !drive.reduced) {
      p.dripClock += dt;
      if (p.dripClock > 0.5) {
        p.dripClock = 0;
        p.drips.push({ x: 40 + rand() * 12, y: 42, vy: 0 });
      }
    }
    for (const d of p.drips) {
      d.vy += 900 * dt;
      d.y += d.vy * dt;
    }
    p.drips = p.drips.filter((d) => d.y < 68);
  }
  return ev;
}

/** Both heads go, pieces into the room along the crash's seed; the smoke and the lines are the kitchen's. */
export function explodeParents(ps: Parent[], k: Kitchen, rand: () => number): void {
  for (const p of ps) {
    if (p.exploded) continue;
    p.exploded = true;
    const h = headAt(p);
    const heat = clamp(p.rage.x, 0, 1);
    burstHead(k, h.x, h.y, p.kind, heatColour(p, heat), HAIR[p.kind], rand);
    p.steam = [];
    p.sweat = [];
  }
}

/** She has already left when the round ends: they let the air out instead. */
export function deflateParents(ps: Parent[]): void {
  for (const p of ps) {
    p.deflated = true;
    p.slamT = 1;
    for (const side of [-1, 1]) puff(p.steam, side * 46, HEAD_Y + 2, 7, -40, 1, 'rgba(255,255,255,0.8)', () => 0.5);
  }
}

/** A fresh scene that meets a round under way: the heat they would have reached by now, and the hand already where it would be. */
export function settleParents(ps: Parent[], tension: number, left: boolean): void {
  for (const p of ps) {
    settleSpring(p.rage, left ? heatFor(p, tension) * 0.3 : heatFor(p, tension));
    settleSpring(p.clutch, p.kind === 'mom' ? smoothstep(0.25, 0.55, p.rage.x) : 0);
  }
}

function heatColour(p: Parent, heat: number): string {
  return heat < 0.6 ? blend(SKIN[p.kind], HOT, heat / 0.6) : blend(HOT, BOILING, (heat - 0.6) / 0.4);
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function arm(ctx: CanvasRenderingContext2D, color: string, sx: number, sy: number, ex: number, ey: number, hx: number, hy: number, skin: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 17;
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

function drawFork(ctx: CanvasRenderingContext2D, x: number, y: number, bend: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.55);
  ctx.strokeStyle = '#b8bcc4';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(0, -14);
  ctx.stroke();
  ctx.translate(0, -14);
  ctx.rotate(-bend * 1.1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -14);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(dx, -13);
    ctx.lineTo(dx, -24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMug(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ink(ctx, 2.5);
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.roundRect(-11, -24, 22, 28, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(14, -10, 7, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = '#5a3a22';
  ctx.beginPath();
  ctx.ellipse(0, -24, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d94f8a';
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('#1', 0, -14);
  ctx.fillText('MOM', 0, -5);
  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, p: Parent, heat: number, time: number): void {
  const color = p.kind === 'dad' ? DAD_SHIRT : MOM_CARDIGAN;
  ctx.save();
  if (p.exploded) {
    ctx.translate(0, 12);
    ctx.rotate(p.kind === 'dad' ? 0.07 : -0.07);
  } else if (p.deflated) ctx.translate(0, 6);
  ink(ctx, 2.5);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-58, -12, 116, 104, 20);
  ctx.fill();
  ctx.stroke();
  if (p.kind === 'dad') {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-58, -12, 116, 104, 20);
    ctx.clip();
    ctx.strokeStyle = '#2b4a7a';
    ctx.lineWidth = 5;
    for (let x = -52; x < 60; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, -12);
      ctx.lineTo(x, 92);
      ctx.stroke();
    }
    for (let y = -4; y < 92; y += 18) {
      ctx.beginPath();
      ctx.moveTo(-58, y);
      ctx.lineTo(58, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#7fa3dd';
    ctx.lineWidth = 1.5;
    for (let x = -43; x < 60; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, -12);
      ctx.lineTo(x, 92);
      ctx.stroke();
    }
    ctx.restore();
    // Collar, buttons, a pocket with a pen.
    ctx.fillStyle = '#2b4a7a';
    ink(ctx, 2);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 14, -14);
      ctx.lineTo(s * 30, 12);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#f7f3ea';
    for (const y of [16, 36, 56]) {
      ctx.beginPath();
      ctx.arc(0, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeRect(-44, 14, 24, 22);
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(-36, 8, 4, 12);
  } else {
    // A floral blouse in the cardigan's V, the pearls, a brooch, the cardigan's buttons.
    ctx.fillStyle = '#fbe9f0';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(-26, -12);
    ctx.lineTo(26, -12);
    ctx.lineTo(0, 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d94f8a';
    for (const [fx, fy] of [[-8, 4], [8, 8], [0, 22], [-4, -4], [10, -4]]) {
      ctx.beginPath();
      ctx.arc(fx!, fy!, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f6f0e4';
    ink(ctx, 1.5);
    for (let i = 0; i <= 8; i += 1) {
      const u = i / 8;
      const px = mix(-20, 20, u);
      const py = -6 + Math.sin(u * Math.PI) * 18;
      ctx.beginPath();
      ctx.arc(px, py, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#d4a93a';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.arc(-38, 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c4302b';
    ctx.beginPath();
    ctx.arc(-38, 10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6f0e4';
    for (const y of [48, 66, 84]) {
      ctx.beginPath();
      ctx.arc(0, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // Arms and hands, with what they hold.
  const skin = p.exploded ? SKIN[p.kind] : heatColour(p, heat * 0.5);
  const clutch = clamp(p.clutch.x, 0, 1);
  if (p.exploded) {
    arm(ctx, color, -54, -2, -78, 40, -72, 62, skin);
    arm(ctx, color, 54, -2, 78, 40, 72, 62, skin);
    if (p.kind === 'mom') drawMug(ctx, 72, 52, 0.9);
  } else if (p.kind === 'dad') {
    // Fork hand, or the hand on the forehead once it is over; the fist that comes down.
    const fx = mix(-46, -22, clutch);
    const fy = mix(60, -34, clutch);
    arm(ctx, color, -54, -2, mix(-76, -70, clutch), mix(42, 10, clutch), fx, fy, skin);
    if (clutch < 0.5) drawFork(ctx, fx - 2, fy - 8, heat);
    const lift = p.slamT < 1 ? Math.sin(p.slamT * Math.PI) * 30 : 0;
    arm(ctx, color, 54, -2, 76, 42 - lift * 0.5, 46, 58 - lift, skin);
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(38, 58 - lift);
    ctx.lineTo(54, 58 - lift);
    ctx.stroke();
  } else {
    // The clutching hand goes from the table to the pearls; the mug hand holds on, and shakes.
    const cx = mix(-46, -14, clutch);
    const cy = mix(60, 0, clutch);
    arm(ctx, color, -54, -2, mix(-76, -58, clutch), mix(42, 20, clutch), cx, cy, skin);
    const tilt = p.deflated ? 0.15 : (noise(Math.floor(time * 30) + 4) - 0.5) * 0.5 * heat * heat;
    arm(ctx, color, 54, -2, 78, 40, 48, 52, skin);
    drawMug(ctx, 48, 44, tilt);
    ctx.fillStyle = '#5a3a22';
    for (const d of p.drips) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The neck, or what is left of it.
  ink(ctx, 2.5);
  if (p.exploded) {
    ctx.fillStyle = SKIN[p.kind];
    ctx.beginPath();
    ctx.roundRect(-13, -26, 26, 20, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2a30';
    ctx.beginPath();
    ctx.ellipse(0, -26, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.ellipse(0, -26, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = heatColour(p, heat * 0.7);
    ctx.fillRect(-12, -22, 24, 14);
    ctx.strokeRect(-12, -22, 24, 14);
  }
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, p: Parent, time: number, reduced: boolean): void {
  const heat = clamp(p.rage.x, 0, 1);
  const s = 1 + 0.22 * heat + (reduced ? 0 : 0.035 * heat * Math.sin(time * 9));
  const jit = reduced ? 0 : 7 * heat * heat;
  const jx = (noise(Math.floor(time * 42) + p.seed) - 0.5) * 2 * jit;
  const jy = (noise(Math.floor(time * 38) + p.seed + 9) - 0.5) * 2 * jit;
  const skin = heatColour(p, heat);
  ctx.save();
  ctx.translate(jx, HEAD_Y + jy + p.kick.x * 0.08 + (p.deflated ? 8 : 0));
  ctx.scale(s, s);
  ink(ctx, 2.5);
  if (p.kind === 'mom') {
    // The bob behind the face: it stops at the ears.
    ctx.fillStyle = HAIR.mom;
    ctx.beginPath();
    ctx.ellipse(0, -22, 50, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = HAIR.dad;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 40, -2, 11, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.fillStyle = skin;
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
  if (p.kind === 'mom') {
    // Fringe, side curls, the hairband and the earrings.
    ctx.fillStyle = HAIR.mom;
    ctx.beginPath();
    ctx.moveTo(-42, -10);
    ctx.quadraticCurveTo(-30, -58, 6, -44);
    ctx.quadraticCurveTo(30, -54, 42, -12);
    ctx.quadraticCurveTo(28, -30, 10, -30);
    ctx.quadraticCurveTo(-16, -22, -42, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 45, -2, 9, 15, side * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = '#d94f8a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -8, 48, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.fillStyle = '#f6f0e4';
    ink(ctx, 1.5);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 44, 16, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    // The combover: strands across the top that lift as he heats up.
    ctx.strokeStyle = HAIR.dad;
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-38, -24 - i * 3);
      ctx.quadraticCurveTo(-10 + i * 6, -72 - heat * 34 - i * 3, 32, -32 - i * 2);
      ctx.stroke();
    }
  }
  // Brows: polite, then a V.
  ink(ctx, p.kind === 'dad' ? 7 : 4.5);
  const browIn = p.deflated ? -30 : p.kind === 'dad' ? -22 + 12 * heat : -27 + 16 * heat;
  const browOut = p.deflated ? -24 : -24 - 4 * heat;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 32, browOut);
    ctx.lineTo(side * 9, browIn);
    ctx.stroke();
  }
  // Eyes: wider, pupils smaller, one twitching, bloodshot.
  for (const side of [-1, 1]) {
    const twitch = side < 0 && heat > 0.5 && !reduced ? 1 + 0.35 * heat * Math.max(0, Math.sin(time * 27)) : 1;
    const rx = 9 + 4 * heat;
    const ry = (7 + 5 * heat) * twitch;
    if (p.deflated) {
      ink(ctx, 2.5);
      ctx.beginPath();
      ctx.arc(side * 16, -8, 8, 0.2, Math.PI - 0.2);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.ellipse(side * 16, -8, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (heat > 0.4) {
      ctx.strokeStyle = `rgba(220, 40, 40, ${smoothstep(0.4, 0.9, heat)})`;
      ctx.lineWidth = 1;
      for (const a of [0.4, 1.9, 3.6, 5]) {
        ctx.beginPath();
        ctx.moveTo(side * 16 + Math.cos(a) * rx * 0.9, -8 + Math.sin(a) * ry * 0.9);
        ctx.lineTo(side * 16 + Math.cos(a) * rx * 0.4, -8 + Math.sin(a) * ry * 0.4);
        ctx.stroke();
      }
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(side * 16 + 1, -6, Math.max(1.2, 4 - 2.4 * heat), 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.kind === 'dad') {
    // Glasses that slide down his nose; a glint in each lens.
    ctx.save();
    ctx.translate(0, 6 * heat);
    ctx.strokeStyle = '#3b3b45';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-30, -19, 27, 22, 6);
    ctx.roundRect(3, -19, 27, 22, 6);
    ctx.moveTo(-3, -10);
    ctx.lineTo(3, -10);
    ctx.moveTo(-30, -12);
    ctx.lineTo(-42, -6);
    ctx.moveTo(30, -12);
    ctx.lineTo(42, -6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    for (const x of [-24, 9]) {
      ctx.beginPath();
      ctx.moveTo(x, -4);
      ctx.lineTo(x + 8, -14);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = blend(skin, '#c4302b', 0.3);
    ink(ctx, 2);
    ctx.beginPath();
    ctx.arc(0, 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // A moustache.
    ctx.fillStyle = HAIR.dad;
    ctx.beginPath();
    ctx.ellipse(-8, 18, 10, 4, 0.2, 0, Math.PI * 2);
    ctx.ellipse(8, 18, 10, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.quadraticCurveTo(-6, 12, 2, 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(230, 90, 120, 0.35)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 26, 14, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The mouth: a smile, a line, then a shout with teeth.
  const open = p.deflated ? 0 : smoothstep(0.55, 0.95, heat);
  ink(ctx, 2.5);
  if (p.deflated) {
    ctx.fillStyle = '#5a1a1a';
    ctx.beginPath();
    ctx.ellipse(0, 28, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (open < 0.05) {
    const frown = smoothstep(0.15, 0.5, heat);
    ctx.beginPath();
    ctx.moveTo(-12, 26 + frown * 4);
    ctx.quadraticCurveTo(0, 26 + (1 - 2 * frown) * 12, 12, 26 + frown * 4);
    ctx.stroke();
  } else {
    const rx = 8 + 12 * open;
    const ry = 4 + 12 * open;
    ctx.fillStyle = '#5a1a1a';
    ctx.beginPath();
    ctx.ellipse(0, 28, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 28, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(-rx, 28 - ry, rx * 2, ry * 0.55);
    ctx.strokeStyle = '#c9c0b0';
    ctx.lineWidth = 1;
    for (let x = -rx + 4; x < rx; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, 28 - ry);
      ctx.lineTo(x, 28 - ry * 0.45);
      ctx.stroke();
    }
    ctx.fillStyle = '#d94f6a';
    ctx.beginPath();
    ctx.ellipse(0, 28 + ry * 0.9, rx * 0.6, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Veins at the temples, sweat down the face, and cracks when the pressure is nearly there.
  if (heat > 0.4 && !p.deflated) {
    ctx.strokeStyle = `rgba(122, 42, 74, ${smoothstep(0.4, 0.8, heat) * (0.7 + 0.3 * Math.sin(time * 10))})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-32, -28);
    ctx.lineTo(-26, -38);
    ctx.lineTo(-30, -46);
    ctx.moveTo(-26, -38);
    ctx.lineTo(-20, -42);
    ctx.moveTo(22, -34);
    ctx.lineTo(28, -42);
    ctx.lineTo(24, -50);
    ctx.moveTo(28, -42);
    ctx.lineTo(34, -44);
    ctx.stroke();
  }
  ctx.fillStyle = '#8fd3ff';
  ink(ctx, 1);
  for (const d of p.sweat) {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - 5);
    ctx.quadraticCurveTo(d.x + 3.5, d.y, d.x, d.y + 3);
    ctx.quadraticCurveTo(d.x - 3.5, d.y, d.x, d.y - 5);
    ctx.fill();
    ctx.stroke();
  }
  if (heat > 0.88) {
    ctx.strokeStyle = `rgba(28, 31, 38, ${smoothstep(0.88, 1, heat)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, -46);
    ctx.lineTo(-4, -34);
    ctx.lineTo(-10, -26);
    ctx.moveTo(26, -36);
    ctx.lineTo(18, -28);
    ctx.lineTo(22, -18);
    ctx.moveTo(-36, 10);
    ctx.lineTo(-28, 16);
    ctx.stroke();
  }
  ctx.restore();
  // Steam out of the ears, in the parent's frame so it follows the head.
  for (const s of p.steam) {
    ctx.globalAlpha = (1 - s.age / s.life) * 0.85;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawParent(ctx: CanvasRenderingContext2D, p: Parent, time: number, reduced: boolean): void {
  ctx.save();
  ctx.translate(p.x, SEAT_Y);
  drawTorso(ctx, p, clamp(p.rage.x, 0, 1), time);
  if (!p.exploded) drawHead(ctx, p, time, reduced);
  ctx.restore();
}

// ---- The daughter --------------------------------------------------------------------------------------

export interface Daughter {
  x: number;
  /** 0 seated, 1 on her feet. */
  stand: Spring;
  /** How much she is talking right now, for the mouth and the hands. */
  talk: number;
  gesture: Spring;
  /** Her phone comes up for the selfie once it is over. */
  phone: Spring;
  mode: 'seated' | 'leaving' | 'gone' | 'selfie';
  walk: number;
  /** Set the frame she takes the picture. */
  snapped: boolean;
}

export const createDaughter = (): Daughter => ({ x: DAUGHTER_X, stand: spring(0), talk: 0, gesture: spring(0), phone: spring(0), mode: 'seated', walk: 0, snapped: false });
export function resetDaughter(d: Daughter): void {
  Object.assign(d, createDaughter());
}

export interface DaughterDrive { speaking: boolean; tension: number; time: number; crashT: number; rekt: boolean }
export interface DaughterEvents { door: boolean; camera: boolean }

export function stepDaughter(d: Daughter, drive: DaughterDrive, dt: number): DaughterEvents {
  const ev: DaughterEvents = { door: false, camera: false };
  d.talk += clamp((drive.speaking ? 1 : 0) - d.talk, -dt * 3, dt * 8);
  stepSpring(d.gesture, d.talk * (0.45 + 0.55 * drive.tension), 5, 0.6, dt);
  if (d.mode === 'leaving') {
    stepSpring(d.stand, 1, 7, 0.75, dt);
    if (d.stand.x > 0.85) {
      d.walk += dt;
      d.x += 300 * dt;
      if (d.x > 1080) {
        d.mode = 'gone';
        ev.door = true;
      }
    }
  }
  if (drive.rekt && d.mode === 'seated' && drive.crashT > 2.2) d.mode = 'selfie';
  stepSpring(d.phone, d.mode === 'selfie' ? 1 : 0, 9, 0.6, dt);
  if (d.mode === 'selfie' && !d.snapped && drive.crashT > 3.1) {
    d.snapped = true;
    ev.camera = true;
  }
  return ev;
}

/** The cash-out: she gets up and takes her plate to her room. `quiet` has her already gone. */
export function leaveTable(d: Daughter, quiet: boolean): void {
  if (quiet) {
    d.mode = 'gone';
    d.x = 1200;
    settleSpring(d.stand, 1);
    return;
  }
  if (d.mode === 'seated') d.mode = 'leaving';
}

/** A crash met late: the phone is already up and the picture taken. */
export function settleDaughterAfter(d: Daughter): void {
  d.mode = 'selfie';
  d.snapped = true;
  settleSpring(d.phone, 1);
}

function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, open: number): void {
  ink(ctx, 2.5);
  ctx.fillStyle = '#f1cfb0';
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (open > 0.2) {
    ctx.lineWidth = 2;
    for (const a of [-0.9, -0.45, 0, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a - Math.PI / 2) * 10, y + Math.sin(a - Math.PI / 2) * 10);
      ctx.lineTo(x + Math.cos(a - Math.PI / 2) * (10 + 8 * open), y + Math.sin(a - Math.PI / 2) * (10 + 8 * open));
      ctx.stroke();
    }
  }
}

/** Her chair, a ladder back between us and her: drawn after her, so she sits on its seat behind its slats. */
export function drawDaughterChair(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(DAUGHTER_X, CHAIR_Y);
  ink(ctx, 2.5);
  // The front legs, set in behind the back ones; the back legs run up into the posts; a stretcher between them.
  ctx.fillStyle = '#6b4327';
  for (const s of [-42, 42]) {
    ctx.beginPath();
    ctx.roundRect(s - 5, 10, 10, 40, 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#8a5a3a';
  for (const s of [-56, 56]) {
    ctx.beginPath();
    ctx.roundRect(s - 6, -62, 12, 110, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(-56, 28, 112, 7, 3);
  ctx.fill();
  ctx.stroke();
  // The seat's back edge under her, and the slats.
  ctx.beginPath();
  ctx.roundRect(-62, 0, 124, 12, 4);
  ctx.fill();
  ctx.stroke();
  for (const y of [-58, -40, -22]) {
    ctx.beginPath();
    ctx.roundRect(-56, y, 112, 9, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDaughter(ctx: CanvasRenderingContext2D, d: Daughter, time: number, tension: number, reduced: boolean): void {
  if (d.mode === 'gone') return;
  const stand = clamp(d.stand.x, 0, 1);
  const stride = d.walk > 0 && !reduced ? Math.sin(d.walk * 11) : 0;
  ctx.save();
  ctx.translate(d.x, CHAIR_Y - 74 * stand + Math.abs(stride) * -4);
  // Legs: shins and sneakers under the seat while she sits, the whole leg once she is up, a stride when she walks.
  ink(ctx, 2.5);
  for (const side of [-1, 1]) {
    const lx = side * 22 - 13 + stride * side * 10;
    const len = 36 + 74 * stand;
    ctx.fillStyle = '#3a5a8a';
    ctx.beginPath();
    ctx.roundRect(lx, -6, 26, len, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7f3ea';
    ctx.beginPath();
    ctx.roundRect(lx - 2, len - 12, 30, 12, 4);
    ctx.fill();
    ctx.stroke();
  }
  // The hoodie, the hood on her back, a pin.
  ctx.fillStyle = '#2b2b33';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.roundRect(-74, -64, 148, 70, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3b3b45';
  ctx.beginPath();
  ctx.ellipse(0, -62, 46, 22, 0, 0, Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(-44, -40);
  RAINBOW.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(-7, -6 + i * 1.7, 14, 1.7);
  });
  ink(ctx, 1.2);
  ctx.strokeRect(-7, -6, 14, 12);
  ctx.restore();
  // Arms: on the table, or up and explaining; the phone hand for the selfie.
  const g = clamp(d.gesture.x, 0, 1);
  const ph = clamp(d.phone.x, 0, 1);
  for (const side of [-1, 1]) {
    const wave = Math.sin(time * 7.5 + (side > 0 ? 0 : 1.8)) * g;
    let hx = side * (62 + 16 * g) + wave * 14;
    let hy = -82 - 46 * g + Math.sin(time * 9 + side) * 12 * g;
    let ex = side * 86;
    let ey = -40 - 30 * g;
    if (side > 0 && ph > 0) {
      hx = mix(hx, 26, ph);
      hy = mix(hy, -150, ph);
      ex = mix(ex, 88, ph);
      ey = mix(ey, -110, ph);
    }
    ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(side * 62, -54);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    drawHand(ctx, hx, hy, side > 0 && ph > 0.5 ? 0 : g);
    if (side > 0 && ph > 0.05) {
      ctx.save();
      ctx.translate(hx - 4, hy - 8);
      ctx.rotate(-0.25);
      ctx.fillStyle = '#2a2a30';
      ink(ctx, 2);
      ctx.beginPath();
      ctx.roundRect(-10, -20, 20, 38, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = d.snapped ? '#ffffff' : '#7fd1ff';
      ctx.fillRect(-7, -16, 14, 28);
      ctx.restore();
    }
  }
  // The head: a cheek and the corner of her mouth on the left, the hair over the rest down to her shoulders.
  ctx.save();
  ctx.translate(-6, -112 + (d.talk > 0 && !reduced ? Math.sin(time * 5) * 1.5 : 0));
  ctx.fillStyle = '#f1cfb0';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Brow, lashes, nose, the mouth that opens as she talks, and an earring.
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-30, -16);
  ctx.lineTo(-18, -19);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-31, -8);
  ctx.lineTo(-22, -9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  ctx.quadraticCurveTo(-40, 6, -33, 8);
  ctx.stroke();
  const mouth = (0.3 + 0.7 * Math.abs(Math.sin(time * 16))) * d.talk;
  ctx.fillStyle = '#5a1a1a';
  ctx.beginPath();
  ctx.ellipse(-28, 17, 4 + 2 * mouth, 1.5 + 5 * mouth, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#d4a93a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-12, 24);
  ctx.lineTo(-12, 34);
  ctx.stroke();
  ctx.fillStyle = '#d4a93a';
  ctx.beginPath();
  ctx.arc(-12, 38, 4, 0, Math.PI * 2);
  ctx.fill();
  // The hair: a silhouette from the crown down the back to the shoulders, filled in rainbow bands.
  ctx.beginPath();
  ctx.moveTo(-9, -10);
  ctx.quadraticCurveTo(-14, -48, 14, -46);
  ctx.quadraticCurveTo(48, -42, 46, -4);
  ctx.quadraticCurveTo(54, 40, 64, 74);
  ctx.quadraticCurveTo(14, 86, -36, 72);
  ctx.quadraticCurveTo(-18, 40, -9, -10);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  const bandH = 124 / RAINBOW.length;
  RAINBOW.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    const top = -48 + i * bandH;
    ctx.moveTo(-60, top + Math.sin(time * 0.8 + i) * 2);
    for (let x = -60; x <= 70; x += 10) ctx.lineTo(x, top + Math.sin(x * 0.08 + i * 1.3) * 4);
    ctx.lineTo(70, top + bandH + 12);
    ctx.lineTo(-60, top + bandH + 12);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
  ink(ctx, 2.5);
  ctx.stroke();
  // A parting and a few strands.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(28,31,38,0.35)';
  for (const x of [-10, 4, 18, 30]) {
    ctx.beginPath();
    ctx.moveTo(x, -42);
    ctx.quadraticCurveTo(x + 8, 10, x + 14, 70);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  void tension;
}
