/**
 * The tunnel and everything on the rails, projected from lane widths onto the picture: the walls and their
 * graffiti, the ceiling ribs and lights, the sleepers and rails, the station the round starts from, the
 * obstacles (sell walls, KYC gates, rolled rugs, the Exit Scam Express), the pickups, and the rug roll that
 * takes the rails away at the crash. Drawing only: what is where comes from course.ts.
 */
import { CYAN, FONT, GOLD, INK, LIME, MONO, PINK, type Point, ellipse, line, panel, poly, text } from './art';
import { COIN_VALUE, FAR, HALF, RAMP, ROOF, RUNNER_Z, type Obstacle, type Pickup, type World } from './course';
import { clamp, noise } from './motion';

export const W = 960;
export const H = 540;
export const HORIZON = 168;
/** Focal length in px: a lane width at depth z is FOCAL / z px wide. */
export const FOCAL = 300;
/** The camera's height over the rails, in lane widths. */
export const CAM_H = 1.55;
/** The tunnel's half width, its wall height and the crown of its arch. */
const WALL_X = 1.78;
const WALL_H = 2;
const CROWN = 2.45;
/** Nothing nearer than this is drawn: it is beside or behind the camera. */
const NEAR = 0.9;
const SEGMENT = 6;

export interface Camera { x: number }
export interface Projected { X: number; Y: number; s: number }

export function project(x: number, z: number, h: number, cam: Camera): Projected {
  const s = FOCAL / Math.max(0.12, z);
  return { X: W / 2 + (x - cam.x) * s, Y: HORIZON + (CAM_H - h) * s, s };
}

export interface TrackView {
  time: number;
  distance: number;
  tension: number;
  /** The rug roll's depth once the rails are being pulled, else Infinity. */
  rugZ: number;
  /** How far the crash has gone, 0 to 1: the void deepens and the debris falls. */
  dark: number;
  reduced: boolean;
}

const GRAFFITI: readonly (readonly [string, string])[] = [
  ['WAGMI', LIME], ['NGMI', PINK], ['GM', CYAN], ['SER', GOLD], ['WEN LAMBO', PINK], ['HODL', LIME], ['DYOR', CYAN], ['NFA', GOLD],
  ['TRUST ME BRO', PINK], ['SAFU', LIME], ['APE', GOLD], ['RUG', PINK], ['UP ONLY', CYAN], ['COPE', GOLD],
];
const BILLBOARDS: readonly (readonly [string, string, string])[] = [
  ['MIND THE GAP', 'IN YOUR PORTFOLIO', GOLD],
  ['TRENCHES LINE', 'NO STOPS. NO BRAKES. NO LP.', CYAN],
  ['WHALE ALERT', 'DO NOT FEED', PINK],
  ['$RUG', 'LIQUIDITY LOCKED (LOL)', LIME],
  ['AUDITED', "BY THE DEV'S COUSIN", GOLD],
  ['YOU ARE HERE', 'SO IS THE TAXMAN', PINK],
  ['DEV IS BASED', 'TRUST ME BRO', CYAN],
  ['EXIT', 'CLOSED FOR RENOVATION', GOLD],
];
const GATE_WORDS = ['KYC', 'GAS FEE', 'SIGN IN', 'TAX', 'SELL TAX', 'TERMS'];

const quad = (a: Projected, b: Projected, c: Projected, d: Projected): Point[] => [[a.X, a.Y], [b.X, b.Y], [c.X, c.Y], [d.X, d.Y]];

/**
 * Draws in a vertical plane's own space: local x runs along the top edge from `topA` to `topB` and local y
 * down the plane from `topA` to `bottomA`, in hundredths of a lane width, mapped through the projected
 * corners (an affine fit, close enough for lettering on a wall or a side). Lettering reads from `topA`, so
 * a caller picks the end that is on the left of the picture.
 */
function onPlane(ctx: CanvasRenderingContext2D, topA: Projected, topB: Projected, bottomA: Projected, uLen: number, vLen: number, draw: () => void): void {
  ctx.save();
  ctx.transform((topB.X - topA.X) / (uLen * 100), (topB.Y - topA.Y) / (uLen * 100), (bottomA.X - topA.X) / (vLen * 100), (bottomA.Y - topA.Y) / (vLen * 100), topA.X, topA.Y);
  draw();
  ctx.restore();
}

// ---- The tunnel --------------------------------------------------------------------------------------------

function backdrop(ctx: CanvasRenderingContext2D, view: TrackView): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#07061a');
  sky.addColorStop(0.32, '#1a1240');
  sky.addColorStop(0.5, '#120d2c');
  sky.addColorStop(1, '#0a0818');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // The light at the end of the tunnel, which is a train.
  const glow = ctx.createRadialGradient(W / 2, HORIZON, 4, W / 2, HORIZON, 210);
  const pulse = 0.55 + 0.25 * view.tension + (view.reduced ? 0 : Math.sin(view.time * 3) * 0.05);
  glow.addColorStop(0, `rgba(255, 120, 190, ${pulse})`);
  glow.addColorStop(0.35, `rgba(95, 242, 230, ${0.22 * pulse})`);
  glow.addColorStop(1, 'rgba(20, 10, 40, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function walls(ctx: CanvasRenderingContext2D, view: TrackView, cam: Camera): void {
  const first = Math.floor((view.distance + NEAR) / SEGMENT) - 1;
  const last = Math.floor((view.distance + FAR) / SEGMENT);
  for (let n = last; n >= first; n -= 1) {
    const z0 = Math.max(NEAR, n * SEGMENT - view.distance);
    const z1 = Math.min(FAR, (n + 1) * SEGMENT - view.distance);
    if (z1 <= z0) continue;
    for (const side of [-1, 1]) {
      const x = side * WALL_X;
      const a = project(x, z0, 0, cam), b = project(x, z1, 0, cam), c = project(x, z1, WALL_H, cam), d = project(x, z0, WALL_H, cam);
      poly(ctx, quad(a, b, c, d), n % 2 ? '#1b1636' : '#201a3f');
      // A pillar at each joint and a grime line along the foot.
      line(ctx, [[a.X, a.Y], [d.X, d.Y]], '#2c2452', Math.max(1, a.s * 0.05));
      line(ctx, [[a.X, a.Y + a.s * 0.02], [b.X, b.Y + b.s * 0.02]], '#0d0a1c', Math.max(1, a.s * 0.02));
      if (b.s < 12) continue;
      const which = Math.floor(noise(n * 7 + side * 3) * 1000);
      // Lettering reads from the left of the picture: the near end on the left wall, the far end on the right.
      const [topA, topB, bottomA] = side < 0 ? [d, c, a] : [c, d, b];
      onPlane(ctx, topA, topB, bottomA, z1 - z0, WALL_H, () => {
        const uLen = (z1 - z0) * 100;
        if (which % 3 === 1) {
          const [head, sub, colour] = BILLBOARDS[which % BILLBOARDS.length]!;
          panel(ctx, uLen * 0.12, 30, uLen * 0.76, 92, '#0e1024', colour, 6, 3);
          text(ctx, head, uLen * 0.5, 60, 34, colour, 'center', uLen * 0.7);
          text(ctx, sub, uLen * 0.5, 96, 17, '#e9e6ff', 'center', uLen * 0.7, MONO);
        } else {
          const [word, colour] = GRAFFITI[which % GRAFFITI.length]!;
          ctx.save();
          ctx.translate(uLen * 0.5, 92);
          ctx.rotate((noise(which) - 0.5) * 0.2);
          ctx.font = `900 ${44 + noise(which * 3) * 22}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 9;
          ctx.strokeStyle = '#0a0818';
          ctx.strokeText(word, 0, 0, uLen * 0.8);
          ctx.fillStyle = colour;
          ctx.fillText(word, 0, 0, uLen * 0.8);
          ctx.restore();
        }
      });
    }
  }
}

function ceiling(ctx: CanvasRenderingContext2D, view: TrackView, cam: Camera): void {
  const step = 3;
  const offset = view.distance % step;
  for (let z = FAR - offset; z >= NEAR; z -= step) {
    const pts: Point[] = [];
    for (const [x, h] of [[-WALL_X, WALL_H], [-WALL_X * 0.62, CROWN - 0.12], [0, CROWN], [WALL_X * 0.62, CROWN - 0.12], [WALL_X, WALL_H]] as const) {
      const p = project(x, z, h, cam);
      pts.push([p.X, p.Y]);
    }
    const s = project(0, z, 0, cam).s;
    line(ctx, pts, '#2a2350', Math.max(1, s * 0.07));
    // A strip light between the ribs, brighter as the round heats up.
    const l = project(0, z - step * 0.5, CROWN - 0.05, cam);
    if (l.s > 12 && z - step * 0.5 > NEAR) {
      const flicker = view.reduced ? 1 : 0.85 + 0.15 * Math.sin(view.time * 17 + z);
      ellipse(ctx, l.X, l.Y, Math.max(2, l.s * 0.32), Math.max(1, l.s * 0.05), `rgba(210, 240, 255, ${0.65 * flicker})`);
      const halo = ctx.createRadialGradient(l.X, l.Y, 1, l.X, l.Y, l.s * 0.7);
      halo.addColorStop(0, `rgba(95, 242, 230, ${0.22 * flicker})`);
      halo.addColorStop(1, 'rgba(95, 242, 230, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(l.X - l.s * 0.7, l.Y - l.s * 0.7, l.s * 1.4, l.s * 1.4);
    }
  }
}

function floor(ctx: CanvasRenderingContext2D, view: TrackView, cam: Camera): void {
  const end = Math.min(FAR, view.rugZ);
  const a = project(-WALL_X, NEAR, 0, cam), b = project(WALL_X, NEAR, 0, cam), c = project(WALL_X, FAR, 0, cam), d = project(-WALL_X, FAR, 0, cam);
  const ballast = ctx.createLinearGradient(0, HORIZON, 0, H);
  ballast.addColorStop(0, '#171330');
  ballast.addColorStop(1, '#2a2243');
  poly(ctx, [[a.X - 400, a.Y + 300], [b.X + 400, b.Y + 300], [c.X, c.Y], [d.X, d.Y]], ballast);
  // Sleepers, one every half lane width, alternating so the speed reads.
  const pitch = 0.55;
  const offset = view.distance % pitch;
  let k = 0;
  for (let z = NEAR - offset; z < end; z += pitch, k += 1) {
    if (z + 0.2 < NEAR) continue;
    const z0 = Math.max(NEAR, z), z1 = Math.min(end, z + 0.2);
    if (z1 <= z0) continue;
    const q = quad(project(-1.62, z0, 0, cam), project(1.62, z0, 0, cam), project(1.62, z1, 0, cam), project(-1.62, z1, 0, cam));
    poly(ctx, q, (Math.floor((view.distance + z) / pitch) % 4 === 0) ? '#3a3155' : '#2b2546');
  }
  // Rails: two a lane, tapered quads so the perspective holds; the third rails outside glow pink.
  for (const lane of [-1, 0, 1]) {
    for (const side of [-0.32, 0.32]) {
      const x = lane + side;
      poly(ctx, quad(project(x - 0.035, NEAR, 0, cam), project(x + 0.035, NEAR, 0, cam), project(x + 0.035, end, 0, cam), project(x - 0.035, end, 0, cam)), '#6d7390');
      poly(ctx, quad(project(x - 0.012, NEAR, 0.02, cam), project(x + 0.012, NEAR, 0.02, cam), project(x + 0.012, end, 0.02, cam), project(x - 0.012, end, 0.02, cam)), '#c9f7f2');
    }
  }
  for (const x of [-1.52, 1.52]) {
    poly(ctx, quad(project(x - 0.04, NEAR, 0.04, cam), project(x + 0.04, NEAR, 0.04, cam), project(x + 0.04, end, 0.04, cam), project(x - 0.04, end, 0.04, cam)), `rgba(255, 61, 138, ${0.55 + 0.35 * view.tension})`);
  }
  // Lane edges, faint, so the three lanes read on a dark floor.
  for (const x of [-0.5, 0.5]) {
    const n = project(x, NEAR, 0, cam), f = project(x, end, 0, cam);
    line(ctx, [[n.X, n.Y], [f.X, f.Y]], 'rgba(120, 110, 170, 0.18)', 1);
  }
}

/** The platform the round leaves from: a slab beside the rails, a gap to mind, a board with the next departure. */
function station(ctx: CanvasRenderingContext2D, view: TrackView, cam: Camera): void {
  const z0 = Math.max(NEAR, -3 - view.distance), z1 = 8 - view.distance;
  if (z1 <= NEAR) return;
  const top = 0.42;
  poly(ctx, quad(project(1.62, z0, 0, cam), project(1.62, z1, 0, cam), project(1.62, z1, top, cam), project(1.62, z0, top, cam)), '#3b3459', INK, 1);
  poly(ctx, quad(project(1.62, z0, top, cam), project(1.62, z1, top, cam), project(3.4, z1, top, cam), project(3.4, z0, top, cam)), '#514874');
  poly(ctx, quad(project(1.66, z0, top + 0.005, cam), project(1.66, z1, top + 0.005, cam), project(1.82, z1, top + 0.005, cam), project(1.82, z0, top + 0.005, cam)), GOLD);
  const sz = 5.5 - view.distance;
  if (sz > NEAR) {
    const foot = project(2.5, sz, top, cam), head = project(2.5, sz, top + 1.5, cam);
    line(ctx, [[foot.X, foot.Y], [head.X, head.Y]], '#8a84b0', Math.max(1, foot.s * 0.05));
    const s = head.s;
    panel(ctx, head.X - s * 0.95, head.Y - s * 0.34, s * 1.9, s * 0.62, '#0e1024', GOLD, s * 0.05, 2);
    text(ctx, 'TRENCHES STATION', head.X, head.Y - s * 0.16, s * 0.2, GOLD, 'center', s * 1.75);
    text(ctx, 'NEXT RUG: SOON', head.X, head.Y + s * 0.09, s * 0.13, '#e9e6ff', 'center', s * 1.7, MONO);
    text(ctx, 'MIND THE GAP', head.X, head.Y + s * 0.5, s * 0.1, PINK, 'center', s * 1.7, MONO);
  }
}

// ---- Obstacles ---------------------------------------------------------------------------------------------

function wall(ctx: CanvasRenderingContext2D, o: Obstacle, cam: Camera): void {
  const l = o.lane - HALF, r = o.lane + HALF, z0 = o.z, z1 = o.z + o.length, hh = 0.35;
  if (o.hit) {
    // Bricks fly out of the runner's way and fade.
    const k = Math.min(1, o.hitAge / 0.7);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    for (let i = 0; i < 7; i += 1) {
      const dx = (noise(o.seed * 50 + i) - 0.5) * 1.6 * k;
      const dz = noise(i * 3 + o.seed) * 1.5 * k;
      const dh = 0.2 + noise(i * 5 + o.seed * 9) * 1.2 * k - 2.2 * k * k;
      const p = project(o.lane + dx, z0 + dz, Math.max(0.05, dh), cam);
      panel(ctx, p.X - p.s * 0.07, p.Y - p.s * 0.04, p.s * 0.14, p.s * 0.08, i % 2 ? '#b8304a' : '#8c2437', undefined, 1);
    }
    ctx.restore();
    return;
  }
  poly(ctx, quad(project(l, z1, hh, cam), project(r, z1, hh, cam), project(r, z0, hh, cam), project(l, z0, hh, cam)), '#8c2437');
  const a = project(l, z0, 0, cam), b = project(r, z0, 0, cam), c = project(r, z0, hh, cam), d = project(l, z0, hh, cam);
  poly(ctx, quad(a, b, c, d), '#b8304a', INK, Math.max(1, a.s * 0.012));
  for (const h of [0.12, 0.24]) {
    const p = project(l, z0, h, cam), q = project(r, z0, h, cam);
    line(ctx, [[p.X, p.Y], [q.X, q.Y]], '#7a1d31', Math.max(1, a.s * 0.012));
  }
  const m = project(o.lane, z0, hh * 0.52, cam);
  if (m.s > 40) text(ctx, 'SELL WALL', m.X, m.Y, m.s * 0.11, '#ffd9df', 'center', m.s * 0.8);
}

function gate(ctx: CanvasRenderingContext2D, o: Obstacle, cam: Camera): void {
  const l = o.lane - HALF, r = o.lane + HALF, z0 = o.z;
  const s = project(o.lane, z0, 0, cam).s;
  for (const x of [l, r]) {
    const foot = project(x, z0, 0, cam), head = project(x, z0, 1.35, cam);
    line(ctx, [[foot.X, foot.Y], [head.X, head.Y]], '#8a94b8', Math.max(1.5, s * 0.06));
  }
  const lift = o.hit ? Math.min(1, o.hitAge * 3) * 0.9 : 0;
  ctx.save();
  if (o.hit) ctx.globalAlpha = Math.max(0, 1 - Math.max(0, o.hitAge - 0.4) * 2);
  const a = project(l, z0, 0.55 + lift, cam), b = project(r, z0, 0.55 + lift, cam), c = project(r, z0, 1.15 + lift, cam), d = project(l, z0, 1.15 + lift, cam);
  poly(ctx, quad(a, b, c, d), '#16203c', CYAN, Math.max(1, s * 0.015));
  const m = project(o.lane, z0, 0.85 + lift, cam);
  if (m.s > 30) {
    const word = GATE_WORDS[Math.floor(o.seed * GATE_WORDS.length)]!;
    text(ctx, word, m.X, m.Y - m.s * 0.06, m.s * 0.22, CYAN, 'center', m.s * 0.82);
    text(ctx, 'SLIDE UNDER', m.X, m.Y + m.s * 0.15, m.s * 0.075, '#c9d4ff', 'center', m.s * 0.8, MONO);
  }
  ctx.restore();
}

function rug(ctx: CanvasRenderingContext2D, o: Obstacle, cam: Camera): void {
  const l = o.lane - HALF, r = o.lane + HALF, z0 = o.z, z1 = o.z + o.length;
  const squash = o.hit ? 1 - Math.min(1, o.hitAge * 2.2) * 0.85 : 1;
  const hh = 0.9 * squash;
  const a = project(l, z0, 0, cam), b = project(r, z0, 0, cam), c = project(r, z0, hh, cam), d = project(l, z0, hh, cam);
  const s = a.s;
  // The roll's top, then its face across the lane, banded like a rolled carpet.
  poly(ctx, quad(d, c, project(r, z1, hh, cam), project(l, z1, hh, cam)), '#8f1c2c');
  poly(ctx, quad(a, b, c, d), '#c0392b', INK, Math.max(1, s * 0.012));
  for (const h of [0.2, 0.42, 0.64]) {
    if (h > hh) continue;
    const p = project(l, z0, h, cam), q = project(r, z0, h, cam);
    line(ctx, [[p.X, p.Y], [q.X, q.Y]], '#e9c46a', Math.max(1, s * 0.03));
  }
  // The spiral end, on whichever side faces the middle of the track.
  const xEnd = o.lane > 0 ? l : o.lane < 0 ? r : null;
  if (xEnd !== null && !o.hit) {
    const e = project(xEnd, z0 + 0.35, hh * 0.5, cam);
    for (const [k, colour] of [[1, '#7a1522'], [0.66, '#c0392b'], [0.33, '#e9c46a']] as const) ellipse(ctx, e.X, e.Y, Math.max(1, e.s * 0.13 * k), Math.max(1, e.s * 0.45 * k), colour);
  }
  const m = project(o.lane, z0, hh * 0.5, cam);
  if (m.s > 40 && !o.hit) text(ctx, 'RUG', m.X, m.Y, m.s * 0.3, '#fff3d6', 'center', m.s * 0.8);
}

function train(ctx: CanvasRenderingContext2D, o: Obstacle, cam: Camera, view: TrackView): void {
  const l = o.lane - HALF, r = o.lane + HALF, z0 = o.z, z1 = o.z + o.length;
  const s = project(o.lane, z0, 0, cam).s;
  // The roof, with vents along it.
  poly(ctx, quad(project(l, z1, ROOF, cam), project(r, z1, ROOF, cam), project(r, z0, ROOF, cam), project(l, z0, ROOF, cam)), '#8d93a8', INK, 1);
  poly(ctx, quad(project(l + 0.3, z1, ROOF, cam), project(r - 0.3, z1, ROOF, cam), project(r - 0.3, z0, ROOF, cam), project(l + 0.3, z0, ROOF, cam)), '#a3a9be');
  for (let z = z0 + 1; z < z1 - 0.5; z += 1.6) {
    poly(ctx, quad(project(l + 0.12, z + 0.25, ROOF + 0.01, cam), project(l + 0.26, z + 0.25, ROOF + 0.01, cam), project(l + 0.26, z, ROOF + 0.01, cam), project(l + 0.12, z, ROOF + 0.01, cam)), '#5b6178');
  }
  // The side that faces the middle of the track, with lit windows and the name of the line.
  const xs = o.lane < 0 ? r : o.lane > 0 ? l : null;
  if (xs !== null) {
    const a = project(xs, z0, 0, cam), b = project(xs, z1, 0, cam), c = project(xs, z1, ROOF, cam), d = project(xs, z0, ROOF, cam);
    poly(ctx, quad(a, b, c, d), '#4f5570', INK, 1);
    poly(ctx, quad(project(xs, z0, 0.45, cam), project(xs, z1, 0.45, cam), project(xs, z1, 0.8, cam), project(xs, z0, 0.8, cam)), '#1d2440');
    for (let z = z0 + 0.4; z < z1 - 0.6; z += 0.9) {
      const lit = noise(o.seed * 40 + z) > 0.35;
      poly(ctx, quad(project(xs, z, 0.5, cam), project(xs, z + 0.55, 0.5, cam), project(xs, z + 0.55, 0.76, cam), project(xs, z, 0.76, cam)), lit ? '#ffe9a6' : '#2c3556');
    }
    if (Math.hypot(b.X - a.X, b.Y - a.Y) > 90) {
      // The name reads from the left of the picture: from the near end on a left-lane car, the far end on a right-lane one.
      const [topA, topB, bottomA] = o.lane < 0 ? [d, c, a] : [c, d, b];
      onPlane(ctx, topA, topB, bottomA, z1 - z0, ROOF, () => {
        const uLen = (z1 - z0) * 100;
        text(ctx, 'EXIT SCAM EXPRESS', uLen * 0.5, 22, 18, PINK, 'center', uLen * 0.9);
        text(ctx, 'NOT IN SERVICE', uLen * 0.5, 90, 9, '#c9d4ff', 'center', uLen * 0.9, MONO);
      });
    }
  }
  if (o.ramp) {
    // The ramp climbs from the rails to the roof, striped like a hazard.
    const a = project(l, z0 - RAMP, 0, cam), b = project(r, z0 - RAMP, 0, cam), c = project(r, z0, ROOF, cam), d = project(l, z0, ROOF, cam);
    poly(ctx, quad(a, b, c, d), '#e0b32f', INK, Math.max(1, s * 0.012));
    for (let i = 0; i < 4; i += 1) {
      const t0 = i / 4 + 0.05, t1 = i / 4 + 0.16;
      const p = (t: number, x: number) => project(x, z0 - RAMP + RAMP * t, ROOF * t, cam);
      poly(ctx, quad(p(t0, l), p(t0, r), p(t1, r), p(t1, l)), '#1b1a24');
    }
    const m = project(o.lane, z0 - RAMP * 0.5, ROOF * 0.5 + 0.02, cam);
    if (m.s > 45) text(ctx, 'UP ONLY', m.X, m.Y, m.s * 0.12, INK, 'center', m.s * 0.8);
  } else {
    const a = project(l, z0, 0, cam), b = project(r, z0, 0, cam), c = project(r, z0, ROOF, cam), d = project(l, z0, ROOF, cam);
    poly(ctx, quad(a, b, c, d), '#646a86', INK, Math.max(1, s * 0.012));
    poly(ctx, quad(project(l + 0.1, z0, 0.45, cam), project(r - 0.1, z0, 0.45, cam), project(r - 0.1, z0, 0.85, cam), project(l + 0.1, z0, 0.85, cam)), '#151b30');
    const blink = view.reduced ? 1 : Math.sin(view.time * 6 + o.seed * 9) > 0 ? 1 : 0.35;
    for (const x of [l + 0.12, r - 0.12]) {
      const p = project(x, z0, 0.28, cam);
      ellipse(ctx, p.X, p.Y, Math.max(1, p.s * 0.05), Math.max(1, p.s * 0.035), `rgba(255, 70, 90, ${blink})`);
    }
    const m = project(o.lane, z0, 0.16, cam);
    if (m.s > 45) text(ctx, 'NOT IN SERVICE', m.X, m.Y, m.s * 0.075, '#e9e6ff', 'center', m.s * 0.8, MONO);
    const t = project(o.lane, z0, 0.93, cam);
    if (t.s > 45) text(ctx, 'RUG LINE', t.X, t.Y, t.s * 0.07, PINK, 'center', t.s * 0.8, MONO);
  }
}

// ---- Pickups -----------------------------------------------------------------------------------------------

const COIN_COLOUR: Record<string, [string, string]> = { cope: ['#d38b3a', '#8a5218'], wagmi: ['#ffd23f', '#a67c00'] };

function pickup(ctx: CanvasRenderingContext2D, p: Pickup, cam: Camera, view: TrackView): void {
  const q = project(p.x, p.z, p.h, cam);
  // A pickup sliding past the runner is nearly under the camera: its size stops growing there.
  const s = Math.min(q.s, 230);
  if (p.taken) {
    // The pop: a ring and what it was worth, rising.
    const k = Math.min(1, p.age / 0.4);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    const colour = p.kind === 'honey' ? PINK : p.kind === 'magnet' || p.kind === 'double' ? CYAN : GOLD;
    ctx.beginPath();
    ctx.arc(q.X, q.Y, s * (0.12 + 0.35 * k), 0, Math.PI * 2);
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(1, s * 0.03 * (1 - k));
    ctx.stroke();
    const label = p.kind === 'honey' ? '-20% BAG' : p.kind === 'magnet' ? 'INSIDER TIP' : p.kind === 'double' ? '2× LEVERAGE' : `+${COIN_VALUE[p.kind]}`;
    text(ctx, label, q.X, q.Y - s * (0.2 + 0.4 * k), Math.max(8, s * 0.14), colour, 'center');
    ctx.restore();
    return;
  }
  const g = project(p.x, p.z, 0, cam);
  ellipse(ctx, g.X, g.Y, Math.max(1, s * 0.13), Math.max(1, s * 0.045), 'rgba(0, 0, 0, 0.35)');
  const spin = view.reduced ? 1 : Math.cos(view.time * 4 + p.seed * 9);
  switch (p.kind) {
    case 'cope':
    case 'wagmi': {
      const [face, rim] = COIN_COLOUR[p.kind]!;
      const radius = (p.kind === 'wagmi' ? 0.16 : 0.13) * s;
      const halo = ctx.createRadialGradient(q.X, q.Y, radius * 0.4, q.X, q.Y, radius * 2.2);
      halo.addColorStop(0, p.kind === 'wagmi' ? 'rgba(255, 210, 63, 0.35)' : 'rgba(211, 139, 58, 0.22)');
      halo.addColorStop(1, 'rgba(255, 210, 63, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(q.X - radius * 2.2, q.Y - radius * 2.2, radius * 4.4, radius * 4.4);
      ellipse(ctx, q.X, q.Y, Math.max(0.5, radius * Math.abs(spin)), radius, face, rim, Math.max(1, radius * 0.12));
      if (Math.abs(spin) > 0.45 && radius > 5) text(ctx, p.kind === 'wagmi' ? 'W' : 'C', q.X, q.Y + radius * 0.02, radius * 1.1, rim, 'center');
      break;
    }
    case 'lambo': {
      const radius = 0.19 * s;
      const halo = ctx.createRadialGradient(q.X, q.Y, radius * 0.3, q.X, q.Y, radius * 2.4);
      halo.addColorStop(0, 'rgba(95, 242, 230, 0.45)');
      halo.addColorStop(1, 'rgba(95, 242, 230, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(q.X - radius * 2.4, q.Y - radius * 2.4, radius * 4.8, radius * 4.8);
      const w = Math.max(0.5, radius * Math.abs(spin));
      poly(ctx, [[q.X, q.Y - radius], [q.X + w, q.Y], [q.X, q.Y + radius], [q.X - w, q.Y]], CYAN, '#0d5b62', Math.max(1, radius * 0.1));
      poly(ctx, [[q.X, q.Y - radius * 0.55], [q.X + w * 0.5, q.Y], [q.X, q.Y + radius * 0.55], [q.X - w * 0.5, q.Y]], '#e8fffd');
      if (radius > 9) text(ctx, 'LAMBO', q.X, q.Y - radius * 1.5, radius * 0.5, CYAN, 'center');
      break;
    }
    case 'honey': {
      const w = 0.3 * s, h = 0.34 * s;
      panel(ctx, q.X - w / 2, q.Y - h * 0.4, w, h * 0.9, '#5cbf3a', '#1f5a14', Math.max(1, w * 0.18), Math.max(1, w * 0.06));
      panel(ctx, q.X - w * 0.42, q.Y - h * 0.58, w * 0.84, h * 0.24, '#2a3d1e', '#101a0c', Math.max(1, w * 0.1), 1);
      ellipse(ctx, q.X, q.Y + h * 0.05, w * 0.2, w * 0.2, '#fff');
      ellipse(ctx, q.X - w * 0.08, q.Y + h * 0.02, w * 0.05, w * 0.06, '#1f5a14');
      ellipse(ctx, q.X + w * 0.08, q.Y + h * 0.02, w * 0.05, w * 0.06, '#1f5a14');
      line(ctx, [[q.X - w * 0.1, q.Y + h * 0.17], [q.X + w * 0.1, q.Y + h * 0.17]], '#1f5a14', Math.max(1, w * 0.04));
      for (const dx of [-0.35, 0.3]) ellipse(ctx, q.X + w * dx, q.Y + h * 0.5 + (view.reduced ? 0 : ((view.time * 0.6 + p.seed) % 1) * h * 0.2), w * 0.06, w * 0.1, '#8be26b');
      if (w > 18) text(ctx, 'HONEYPOT', q.X, q.Y - h * 0.8, w * 0.28, '#8be26b', 'center');
      break;
    }
    case 'magnet': {
      const w = 0.22 * s, h = 0.36 * s;
      panel(ctx, q.X - w / 2, q.Y - h / 2, w, h, '#0e1224', '#8a94b8', Math.max(1, w * 0.15), Math.max(1, w * 0.06));
      panel(ctx, q.X - w * 0.4, q.Y - h * 0.4, w * 0.8, h * 0.72, '#5ff2e6', undefined, Math.max(1, w * 0.06));
      if (w > 14) text(ctx, 'TIP', q.X, q.Y - h * 0.05, w * 0.42, '#0b2a2a', 'center');
      if (w > 14) text(ctx, 'INSIDER TIP', q.X, q.Y - h * 0.75, w * 0.36, CYAN, 'center');
      break;
    }
    case 'double': {
      const radius = 0.17 * s;
      ellipse(ctx, q.X, q.Y, radius, radius, '#8b5cf6', '#3b2276', Math.max(1, radius * 0.12));
      if (radius > 6) text(ctx, '2×', q.X, q.Y + radius * 0.05, radius * 1.1, '#fff', 'center');
      if (radius > 9) text(ctx, 'LEVERAGE', q.X, q.Y - radius * 1.5, radius * 0.5, '#c4b5fd', 'center');
      break;
    }
  }
}

// ---- The rug pull ------------------------------------------------------------------------------------------

/** Beyond the roll there are no rails: a void with the sleepers tumbling into it. */
function voidBeyond(ctx: CanvasRenderingContext2D, view: TrackView, cam: Camera): void {
  if (!Number.isFinite(view.rugZ)) return;
  const z = Math.max(NEAR + 0.3, view.rugZ);
  const a = project(-WALL_X - 0.2, z, 0, cam), b = project(WALL_X + 0.2, z, 0, cam), c = project(WALL_X + 0.2, FAR, 0, cam), d = project(-WALL_X - 0.2, FAR, 0, cam);
  poly(ctx, quad(a, b, c, d), '#030209');
  for (let i = 0; i < 26; i += 1) {
    const t = noise(i * 3.1), u = noise(i * 7.7);
    const x = -1.9 + t * 3.8, depth = z + u * u * (FAR - z);
    const p = project(x, depth, -0.02, cam);
    const tw = view.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(view.time * 5 + i);
    ellipse(ctx, p.X, p.Y, 1.2, 1.2, `rgba(255, 255, 255, ${0.5 * tw})`);
  }
  for (let i = 0; i < 9; i += 1) {
    const fall = view.dark * (0.5 + noise(i * 2.3));
    const p = project(-1.4 + noise(i * 4.1) * 2.8, z + 0.3 + noise(i * 1.7) * 3, -0.2 - fall * 3.5, cam);
    ctx.save();
    ctx.translate(p.X, p.Y);
    ctx.rotate(fall * 6 * (noise(i) - 0.5));
    ctx.fillStyle = '#3a3155';
    ctx.fillRect(-p.s * 0.28, -p.s * 0.05, p.s * 0.56, p.s * 0.1);
    ctx.restore();
  }
}

function rugRoll(ctx: CanvasRenderingContext2D, view: TrackView, cam: Camera): void {
  if (!Number.isFinite(view.rugZ)) return;
  const z = Math.max(NEAR + 0.3, view.rugZ);
  const c = project(0, z, 0.45, cam);
  const s = c.s;
  const rx = 1.85 * s, ry = 0.45 * s;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(c.X - rx, c.Y - ry, rx * 2, ry * 2, ry);
  ctx.fillStyle = '#b8202f';
  ctx.fill();
  ctx.clip();
  // The bands roll as the rug is pulled.
  const roll = view.reduced ? 0 : (view.time * 3) % 1;
  for (let i = -1; i < 6; i += 1) {
    const y = c.Y - ry + ((i + roll) / 5) * ry * 2;
    ctx.fillStyle = i % 2 ? GOLD : '#7a1522';
    ctx.fillRect(c.X - rx, y, rx * 2, ry * 0.16);
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.roundRect(c.X - rx, c.Y - ry, rx * 2, ry * 2, ry);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const ex = c.X + side * rx;
    for (const [k, colour] of [[1, '#7a1522'], [0.66, '#c0392b'], [0.33, GOLD]] as const) ellipse(ctx, ex, c.Y, Math.max(1, s * 0.16 * k), Math.max(1, ry * k), colour);
  }
  if (s > 30) text(ctx, 'RUG', c.X, c.Y, s * 0.36, '#fff3d6', 'center');
}

// ---- The world ---------------------------------------------------------------------------------------------

interface Item { z: number; end: number; draw: () => void }

/**
 * Draws the tunnel, the rails, the course and the runner in depth order: `drawRunner` is called once
 * everything ahead of the runner (or under it) is down, and what is behind it draws after.
 */
export function drawWorld(ctx: CanvasRenderingContext2D, w: World, view: TrackView, cam: Camera, drawRunner: () => void): void {
  backdrop(ctx, view);
  walls(ctx, view, cam);
  ceiling(ctx, view, cam);
  floor(ctx, view, cam);
  voidBeyond(ctx, view, cam);
  station(ctx, view, cam);
  const items: Item[] = [];
  for (const o of w.obstacles) {
    if (o.z > Math.min(FAR, view.rugZ) || o.z + o.length < NEAR) continue;
    const shape = o.kind === 'wall' ? () => wall(ctx, o, cam) : o.kind === 'gate' ? () => gate(ctx, o, cam) : o.kind === 'rug' ? () => rug(ctx, o, cam) : () => train(ctx, o, cam, view);
    // Once past the runner an obstacle is between it and the camera, where it would fill the picture: it fades out instead.
    const fade = clamp((o.z + o.length - RUNNER_Z + 0.5) / 0.5, 0, 1);
    if (fade <= 0) continue;
    const draw = fade < 1 ? () => { ctx.save(); ctx.globalAlpha = fade; shape(); ctx.restore(); } : shape;
    items.push({ z: o.kind === 'train' && o.ramp ? o.z - RAMP : o.z, end: o.z + o.length, draw });
  }
  for (const p of w.pickups) {
    if (p.z > Math.min(FAR, view.rugZ) || p.z < NEAR) continue;
    items.push({ z: p.sortZ, end: p.z, draw: () => pickup(ctx, p, cam, view) });
  }
  if (Number.isFinite(view.rugZ)) items.push({ z: view.rugZ, end: view.rugZ + 0.9, draw: () => rugRoll(ctx, view, cam) });
  items.sort((a, b) => b.z - a.z);
  const ahead = items.filter((i) => i.z > RUNNER_Z || i.end >= RUNNER_Z);
  const behind = items.filter((i) => !(i.z > RUNNER_Z || i.end >= RUNNER_Z));
  for (const item of ahead) item.draw();
  drawRunner();
  for (const item of behind) item.draw();
}

/** The picture darkens at the edges as the speed climbs. */
export function vignette(ctx: CanvasRenderingContext2D, strength: number): void {
  if (strength <= 0.01) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(5, 3, 15, 0)');
  g.addColorStop(1, `rgba(5, 3, 15, ${clamp(strength, 0, 0.8)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
