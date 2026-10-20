/**
 * The trailer finding out. Everything here is a closed-form function of the seconds since the boom and a seed from
 * the crash point (taken only once the crash has happened), so a replay, a late entry and a live viewer all see the
 * same blast: the fireball and its shockwave, the mushroom of blue smoke, the walls falling out and back, the roof
 * going up and coming down behind the deck, the fridge landing upright in the yard with the possum still playing
 * dead on top, the pot, the paddle, the TV, the jugs, the cans, splinters, insulation and a toilet roll unrolling,
 * a glitter of blue rock candy, and the propane tank going up like a rocket and becoming a star.
 */
import { BASS, FRIDGE, POT, TANK, TRAILER, TV } from './layout';
import { blob, box, ink, label, limb, poly } from './ink';
import { clamp, mix, mulberry32, smoothstep } from './motion';
import { drawFridge } from './world';
import { drawGauge, drawJug, drawTank, rgba } from './still';
import { drawPossum } from './critters';

const G = 2200;
const ORIGIN = { x: POT.x - 60, y: 320 } as const;
/** The roof comes down upside down on the ground just behind the deck. */
const ROOF_LAND = TRAILER.ground - 34;

type Kind = 'roof' | 'fridge' | 'tv' | 'pot' | 'lid' | 'paddle' | 'bass' | 'can' | 'jug' | 'gauge' | 'plank' | 'siding' | 'tuft' | 'roll' | 'couch' | 'fan';
interface Piece {
  kind: Kind;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  spin: number;
  rot0: number;
  /** Where it comes to rest: the ground line it lands on, and how it lies. */
  land: number;
  rest: 'up' | 'flat' | 'any';
  /** Drawn behind the deck once down (it landed in the field behind). */
  back: boolean;
  size: number;
  tint: number;
}

export interface Blast {
  seed: number;
  pieces: Piece[];
  /** Puffs of the mushroom: offsets and sizes. */
  puffs: { dx: number; dy: number; r: number; delay: number }[];
  glitter: { vx: number; vy: number; x: number; y: number; tw: number }[];
  /** The tank's drift as it rockets up. */
  tankDrift: number;
}

/** Lays out the blast from the crash point: every piece's launch, spin and landing. */
export function createBlast(crashX100: number): Blast {
  const rng = mulberry32(crashX100 * 7919 + 17);
  const pieces: Piece[] = [];
  const add = (kind: Kind, x0: number, y0: number, vx: number, vy: number, land: number, rest: Piece['rest'], back = false, size = 1) => pieces.push({ kind, x0, y0, vx, vy, spin: (rng() - 0.5) * 14, rot0: 0, land, rest, back, size, tint: rng() });
  // The roof: straight up, over, and down behind the deck, upside down.
  // Half a turn exactly, so it comes down flat on its back.
  const roofT = (2300 + Math.sqrt(2300 * 2300 + 2 * G * (ROOF_LAND - TRAILER.roof))) / G;
  pieces.push({ kind: 'roof', x0: 270, y0: TRAILER.roof, vx: 40 + 60 * rng(), vy: -2300, spin: Math.PI / roofT, rot0: 0, land: ROOF_LAND, rest: 'flat', back: true, size: 1, tint: 0 });
  // The fridge: up and left, landing upright in the yard with its door swinging open.
  pieces.push({ kind: 'fridge', x0: (FRIDGE.x0 + FRIDGE.x1) / 2, y0: 360, vx: -600 - 70 * rng(), vy: -1900, spin: -Math.PI * 2 / 1.98, rot0: 0, land: 905, rest: 'up', back: false, size: 1, tint: 0 });
  add('tv', TV.x, 460, -380 - 200 * rng(), -1500, 960, 'up');
  add('couch', -480, 500, -500 - 200 * rng(), -1250, 780, 'up', true);
  add('pot', POT.x, 280, 260 + 200 * rng(), -2100, 1020, 'up');
  add('lid', POT.x, 230, -120 + 240 * rng(), -2600, 880, 'flat');
  add('paddle', 548, 150, 520 + 160 * rng(), -2200, 1000, 'any');
  add('bass', BASS.x, BASS.y, -260 - 200 * rng(), -1700, 900, 'flat');
  add('gauge', 610, 182, 300 * (rng() - 0.5), -2900, 940, 'flat');
  add('jug', 276, 300, -420 * rng(), -1900, 970, 'any');
  add('jug', 318, 300, 300 * rng(), -2000, 990, 'any');
  add('fan', 690, 128, 380 + 200 * rng(), -1700, 960, 'up');
  add('roll', 1150, 420, 600 + 200 * rng(), -2000, 980, 'any');
  for (let i = 0; i < 8; i += 1) add('can', ORIGIN.x + (rng() - 0.5) * 300, 300, (rng() - 0.5) * 1800, -1200 - rng() * 1600, 860 + rng() * 220, 'any');
  for (let i = 0; i < 14; i += 1) add('plank', ORIGIN.x + (rng() - 0.5) * 900, 200 + rng() * 300, (rng() - 0.5) * 2400, -900 - rng() * 1800, 840 + rng() * 260, 'flat', rng() < 0.3, 0.6 + rng() * 0.8);
  for (let i = 0; i < 10; i += 1) add('siding', ORIGIN.x + (rng() - 0.5) * 1600, 300 + rng() * 200, (rng() - 0.5) * 2600, -800 - rng() * 1400, 840 + rng() * 280, 'flat', rng() < 0.3, 0.7 + rng() * 0.6);
  for (let i = 0; i < 9; i += 1) add('tuft', ORIGIN.x + (rng() - 0.5) * 1200, 60, (rng() - 0.5) * 1200, -600 - rng() * 700, 880 + rng() * 200, 'any', false, 0.45 + rng() * 0.5);
  for (const p of pieces) if (p.kind !== 'roof' && p.kind !== 'fridge') p.rot0 = (rng() - 0.5) * 0.6;
  const puffs = Array.from({ length: 26 }, (_, i) => ({ dx: (rng() - 0.5) * 2, dy: rng(), r: 0.6 + rng() * 0.6, delay: i < 8 ? 0 : rng() * 0.4 }));
  const glitter = Array.from({ length: 70 }, () => ({ x: ORIGIN.x + (rng() - 0.5) * 500, y: ORIGIN.y - rng() * 200, vx: (rng() - 0.5) * 1400, vy: -600 - rng() * 1600, tw: rng() * 6 }));
  return { seed: crashX100, pieces, puffs, glitter, tankDrift: (rng() - 0.5) * 300 };
}

// ─── Trajectories ───────────────────────────────────────────────────────────────────────────────────────────────
/** A piece at `u` seconds after the boom: up and over on gravity, down onto its line, one small bounce, then still. */
export function pieceAt(p: Piece, u: number): { x: number; y: number; rot: number; down: boolean } {
  const drag = p.kind === 'tuft' ? 0.6 : p.kind === 'roll' ? 0.85 : 1;
  const g = G * drag * drag;
  const vy = p.vy * drag;
  const vx = p.vx * drag;
  // The time it reaches its landing line, from y0 + vy t + ½ g t² = land.
  const T = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (p.land - p.y0)))) / g;
  const restAngle = p.rest === 'up' ? 0 : p.rest === 'flat' ? Math.PI : p.rot0 + p.spin * T;
  if (u < T) return { x: p.x0 + vx * u, y: p.y0 + vy * u + 0.5 * g * u * u, rot: p.rot0 + p.spin * u, down: false };
  // One bounce a fifth as high (fluff just settles), a slide that stops, and the turn onto its resting side.
  const t = u - T;
  const vb = p.kind === 'tuft' ? 0 : Math.abs(vy + g * T) * 0.22;
  const tb = (2 * vb) / g;
  const hop = t < tb ? vb * t - 0.5 * g * t * t : 0;
  const slide = (vx * 0.25 * (1 - Math.exp(-6 * t))) / 6;
  const landedRot = p.rot0 + p.spin * T;
  const settle = smoothstep(0, 0.35, t);
  const target = p.rest === 'any' ? landedRot : nearestTurn(landedRot, restAngle);
  return { x: p.x0 + vx * T + slide, y: p.land - hop, rot: mix(landedRot, target, settle), down: t > tb };
}
const nearestTurn = (from: number, to: number): number => to + Math.round((from - to) / (Math.PI * 2)) * Math.PI * 2;

/** The tank: lifts off on its own jet, leaning into its drift, gone off the top by a second, a star by 3.6 s. */
function tankAt(b: Blast, u: number): { x: number; y: number; rot: number; jet: number } {
  const t = Math.max(0, u);
  const y = TANK.base - 120 * t - 1500 * t * t;
  const x = TANK.x + b.tankDrift * t * t + 60 * t;
  const rot = Math.atan2(b.tankDrift * 2 * t + 60, 120 + 3000 * t) * 0.9;
  return { x, y, rot, jet: smoothstep(0, 0.08, t) };
}

// ─── Drawing ────────────────────────────────────────────────────────────────────────────────────────────────────
function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, u: number, time: number, possum: FridgePossum): void {
  const at = pieceAt(p, u);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(at.rot);
  ctx.scale(p.size, p.size);
  switch (p.kind) {
    case 'roof': {
      box(ctx, -900, -26, 1800, 52, 18, '#8f969d', 5);
      ctx.fillStyle = '#5f666d';
      for (let x = -860; x < 860; x += 120) ctx.fillRect(x, -26, 8, 52);
      break;
    }
    case 'fridge': {
      ctx.translate(-(FRIDGE.x1 - FRIDGE.x0) / 2, -(TRAILER.floor - FRIDGE.top));
      drawFridge(ctx, 0, 0, at.down ? 1 : 0);
      // The door hangs open once it's down.
      if (at.down) box(ctx, FRIDGE.x1 - FRIDGE.x0 - 4, 110, 70, TRAILER.floor - FRIDGE.top - 116, 6, '#8d9a3d', 3);
      // The possum, still on top, still playing dead (one eye open once it's down), until it walks off.
      ctx.translate((FRIDGE.x1 - FRIDGE.x0) / 2 + 10, 0);
      if (possum !== 'gone') drawPossum(ctx, 0, 0, 1, 0, time, possum === 'peek' ? 1 : 0);
      break;
    }
    case 'tv': {
      box(ctx, -70, -120, 140, 120, 10, '#5a4632', 4);
      box(ctx, -56, -106, 96, 88, 14, at.down ? (Math.sin(time * 30) > 0 ? '#c9d6ff' : '#8fa3d6') : '#222', 3);
      break;
    }
    case 'couch': {
      box(ctx, -170, -110, 340, 110, 18, '#7b5a2c', 4);
      box(ctx, -180, -60, 360, 60, 16, '#6b4c22', 4);
      break;
    }
    case 'pot': {
      // Upside down once it lands, rocking.
      ctx.rotate(at.down ? Math.PI : 0);
      box(ctx, -72, -45, 144, 90, 10, '#c3c8cf', 4);
      label(ctx, "MAMAW'S", 0, -2, 22, '#2a2a33', 900);
      break;
    }
    case 'lid': {
      blob(ctx, 0, 0, 80, 16, '#c3c8cf', 4);
      break;
    }
    case 'paddle': {
      limb(ctx, [{ x: 0, y: -170 }, { x: 0, y: 80 }], 12, '#c79a5c', 3);
      blob(ctx, 0, 140, 26, 70, '#b88848', 3);
      break;
    }
    case 'bass': {
      box(ctx, -56, -26, 112, 52, 22, '#6b4220', 3);
      blob(ctx, 0, 0, 40, 15, '#6f8d42', 3);
      break;
    }
    case 'can': {
      box(ctx, -14, -26, 28, 52, 6, p.tint > 0.5 ? '#c9cdd2' : '#b33b2e', 3);
      break;
    }
    case 'jug': {
      ctx.scale(1.6, 1.6);
      drawJug(ctx, p.tint > 0.5 ? 'xxx' : 'mystery', 0, -30, 0);
      break;
    }
    case 'gauge': {
      drawGauge(ctx, 0, 0, 0, at.down ? 0 : 1, time, 1, 1.8);
      break;
    }
    case 'fan': {
      box(ctx, -60, -60, 120, 120, 8, '#cfd2cc', 4);
      blob(ctx, 0, 0, 52, 52, '#2c3036', 3);
      break;
    }
    case 'plank': {
      box(ctx, -80, -9, 160, 18, 3, p.tint > 0.5 ? '#7a5233' : '#5d3d22', 3);
      break;
    }
    case 'siding': {
      box(ctx, -90, -40, 180, 80, 4, '#d9d2b8', 4);
      ctx.fillStyle = '#2f8f8a';
      ctx.fillRect(-90, -6, 180, 16);
      break;
    }
    case 'tuft': {
      blob(ctx, 0, 0, 50, 34, '#e88ca6', 0);
      blob(ctx, 30, -14, 34, 26, '#f2a5bb', 0);
      break;
    }
    case 'roll': {
      blob(ctx, 0, 0, 30, 30, '#f4f2ee', 3);
      blob(ctx, 0, 0, 10, 10, '#c9b48a', 2);
      break;
    }
  }
  ctx.restore();
  // The toilet roll leaves a streamer behind it.
  if (p.kind === 'roll') {
    ink(ctx, 14, '#f4f2ee');
    ctx.beginPath();
    for (let k = 0; k <= 16; k += 1) {
      const pu = Math.max(0, u - k * 0.06);
      const q = pieceAt(p, pu);
      if (k === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x + Math.sin(pu * 9 + k) * 12, q.y);
    }
    ctx.stroke();
  }
}

/** The pieces that came down in the field behind the deck (drawn before it). */
export function drawDebrisBack(ctx: CanvasRenderingContext2D, b: Blast, u: number, time: number): void {
  for (const p of b.pieces) if (p.back && pieceAt(p, u).down) drawPiece(ctx, p, u, time, 'dead');
}
/** The possum riding the fridge: playing dead, peeking, or gone (the scene draws it walking off). */
export type FridgePossum = 'dead' | 'peek' | 'gone';
/** Everything else: what has come down in the yard (drawn before the people), or what is still in the air. */
export function drawDebris(ctx: CanvasRenderingContext2D, b: Blast, u: number, time: number, possum: FridgePossum, landed: boolean): void {
  for (const p of b.pieces) {
    const down = pieceAt(p, u).down;
    if (landed ? down && !p.back : !down) drawPiece(ctx, p, u, time, possum);
  }
}
/** Where the fridge (and the possum on it) is, for the possum's walk-off. */
export function fridgeAt(b: Blast, u: number): { x: number; y: number; down: boolean } {
  const p = b.pieces.find((q) => q.kind === 'fridge')!;
  const at = pieceAt(p, u);
  return { x: at.x, y: at.y - (TRAILER.floor - FRIDGE.top), down: at.down };
}
/** When each piece lands, for the thuds. */
export const landings = (b: Blast): { at: number; kind: Kind }[] => b.pieces.filter((p) => p.kind !== 'tuft').map((p) => ({ at: (-p.vy * (p.kind === 'roll' ? 0.85 : 1) + Math.sqrt((p.vy * (p.kind === 'roll' ? 0.85 : 1)) ** 2 + 2 * G * (p.kind === 'roll' ? 0.7225 : 1) * (p.land - p.y0))) / (G * (p.kind === 'roll' ? 0.7225 : 1)), kind: p.kind }));

/** The tank as a rocket, then a star where it went. */
export function drawTankRocket(ctx: CanvasRenderingContext2D, b: Blast, u: number, time: number): void {
  const t = tankAt(b, u);
  if (t.y > -2600) {
    drawTank(ctx, t.x, t.y, 0, t.rot, t.jet);
  }
  const star = smoothstep(3.4, 3.7, u);
  if (star > 0) {
    const sx = TANK.x + b.tankDrift * 0.6 + 200;
    const sy = -820;
    const tw = 0.7 + 0.3 * Math.sin(time * 9);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(200, 230, 255, ${star * tw})`;
    for (const [w, h] of [[60, 6], [6, 60]] as const) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, w * star, h * star, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * The fireball and the shockwave: a billow of glowing puffs, white-hot at the core and rimmed with the brew's blue,
 * cooling through yellow and orange into the smoke inside a second and a half.
 */
export function drawFireball(ctx: CanvasRenderingContext2D, b: Blast, u: number, brew: [number, number, number]): void {
  if (u > 1.5) return;
  const grow = 1 - Math.exp(-u * 8);
  const fade = 1 - smoothstep(0.3, 1.5, u);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // The shockwave ring, flattened along the ground.
  const ring = 300 + 3800 * u;
  const ringA = 1 - smoothstep(0, 0.45, u);
  if (ringA > 0.01) {
    ctx.strokeStyle = `rgba(220, 240, 255, ${0.45 * ringA})`;
    ctx.lineWidth = 70 * ringA;
    ctx.beginPath();
    ctx.ellipse(ORIGIN.x, ORIGIN.y + 260, ring, ring * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The billow: puffs on rings round the heart of the blast, rising as they cool.
  const rng = mulberry32(b.seed * 31 + 5);
  const heat = 1 - smoothstep(0, 0.9, u);
  for (let i = 0; i < 26; i += 1) {
    const ring2 = i < 6 ? 0.25 : i < 14 ? 0.62 : 1;
    const a = rng() * Math.PI * 2;
    const r = 1000 * grow * ring2 * (0.7 + 0.4 * rng());
    const x = ORIGIN.x + Math.cos(a) * r;
    const y = ORIGIN.y + Math.sin(a) * r * 0.72 - 260 * u * (0.5 + ring2);
    const size = (180 + 260 * rng()) * (0.4 + 0.8 * grow) * (1.1 - 0.4 * ring2);
    const core = clamp(heat * (1.3 - ring2), 0, 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, `rgba(255, ${Math.round(mix(150, 255, core))}, ${Math.round(mix(60, 230, core))}, ${0.7 * fade})`);
    g.addColorStop(0.55, ring2 === 1 ? rgba(brew, 0.45 * fade) : `rgba(255, ${Math.round(mix(90, 190, core))}, 40, ${0.45 * fade})`);
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
  }
  // The white flash at the heart, gone in a third of a second.
  const flash = 1 - smoothstep(0, 0.35, u);
  if (flash > 0.01) {
    const g = ctx.createRadialGradient(ORIGIN.x, ORIGIN.y, 0, ORIGIN.x, ORIGIN.y, 900 * grow + 100);
    g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * flash})`);
    g.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(ORIGIN.x - 1000, ORIGIN.y - 1000, 2000, 2000);
  }
  ctx.restore();
}

/** The mushroom: a column of blue-grey smoke and a cap that spreads and drifts, thinning over five seconds. */
export function drawSmoke(ctx: CanvasRenderingContext2D, b: Blast, u: number, brew: [number, number, number]): void {
  if (u < 0.4) return;
  const rise = 1 - Math.exp(-(u - 0.4) * 0.9);
  const drift = 60 * u;
  const alpha = smoothstep(0.4, 1.2, u) * (1 - 0.55 * smoothstep(4, 9, u));
  const capY = ORIGIN.y - 420 - 1000 * rise;
  const tint = (k: number): string => `rgba(${Math.round(mix(92, brew[0], 0.3 * k))}, ${Math.round(mix(100, brew[1], 0.3 * k))}, ${Math.round(mix(122, brew[2], 0.35 * k))}, ${0.72 * alpha})`;
  // The stem.
  for (let i = 0; i < 6; i += 1) {
    const k = i / 5;
    const y = mix(ORIGIN.y + 60, capY + 120, k);
    const r = 150 + 60 * Math.sin(i * 1.7 + u) + 120 * (1 - k) * smoothstep(0, 1, u);
    blob(ctx, ORIGIN.x + drift * k + Math.sin(u * 2 + i) * 20, y, r, r * 0.8, tint(k), 0);
  }
  // The cap.
  for (const p of b.puffs) {
    const t = clamp(u - 0.4 - p.delay, 0, 9);
    if (t <= 0) continue;
    const spread = (1 - Math.exp(-t * 1.2)) * 520;
    const x = ORIGIN.x + drift + p.dx * spread;
    const y = capY - p.dy * 220 + Math.abs(p.dx) * 120 * rise;
    const r = (120 + 160 * (1 - Math.exp(-t))) * p.r;
    blob(ctx, x, y, r, r * 0.78, tint(0.6 + p.dy * 0.4), 0);
  }
}

/** Blue rock candy raining down and twinkling, settling into the grass. */
export function drawGlitter(ctx: CanvasRenderingContext2D, b: Blast, u: number, time: number): void {
  const fade = 1 - smoothstep(3.5, 5.5, u);
  if (fade <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of b.glitter) {
    // Thrown up, slowed by the air, then falling at a gentle terminal speed.
    const k = 2.2;
    const vt = 260;
    const x = g.x + (g.vx / k) * (1 - Math.exp(-k * u));
    const y = Math.min(980, g.y + vt * u + ((g.vy - vt) / k) * (1 - Math.exp(-k * u)));
    const tw = 0.5 + 0.5 * Math.sin(time * 10 + g.tw);
    ctx.fillStyle = `rgba(150, 220, 255, ${0.9 * fade * tw})`;
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 14);
    ctx.lineTo(x - 8, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The trailer's walls going: the front walls fall out flat toward us, the back wall falls away, revealing the night
 * (and Miss Darlene) behind; drawn over the deck for the first half second after the boom.
 */
export function drawWallsFalling(ctx: CanvasRenderingContext2D, u: number): void {
  if (u > 0.7) return;
  const k = smoothstep(0, 0.6, u);
  const a = 1 - k;
  ctx.save();
  ctx.globalAlpha = a;
  // Back wall: shrinking upward and dark.
  ctx.fillStyle = '#4a311d';
  const h = (TRAILER.floor - TRAILER.ceil) * (1 - k);
  ctx.fillRect(TRAILER.left, TRAILER.floor - h, TRAILER.right - TRAILER.left, h);
  ctx.restore();
  // Front walls: tipping toward us onto the yard.
  for (const [x0, x1] of [[TRAILER.left, -40], [1000, TRAILER.right]] as const) {
    const fall = smoothstep(0, 0.55, u);
    const top = mix(TRAILER.roof + 12, TRAILER.ground + 40, fall);
    const bottom = mix(TRAILER.base, TRAILER.ground + 120, fall);
    poly(ctx, [x0 - 60 * fall, top, x1 + 60 * fall, top, x1 + 20 * fall, bottom, x0 - 20 * fall, bottom], '#cfc8ad', 5);
    ctx.fillStyle = '#2f8f8a';
    const sy = mix(316, TRAILER.ground + 70, fall);
    ctx.fillRect(x0 - 40 * fall, sy, x1 - x0 + 80 * fall, 30 * (1 - fall * 0.6));
  }
}
