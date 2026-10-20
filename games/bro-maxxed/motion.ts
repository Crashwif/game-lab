/**
 * Bounded motion toolkit, closed-form damped springs, deterministic hashing,
 * law-of-cosines two-bone inverse kinematics (`solveLimb`), and distance-driven
 * foot gait helpers for BRO-MAXXED.
 */

export interface Joint {
  x: number;
  y: number;
}

export interface Spring {
  x: number;
  v: number;
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export const fract = (x: number): number => x - Math.floor(x);

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Deterministic scalar hash in [0, 1) from a numeric seed. */
export function noise(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** Smooth multi-sine wandering in approximately [-1, 1] for organic sway. */
export function gust(t: number, seed: number): number {
  return (
    0.5 * Math.sin(t * 1.3 + seed) +
    0.3 * Math.sin(t * 2.1 + seed * 1.7) +
    0.2 * Math.sin(t * 3.7 + seed * 2.3)
  );
}

export const spring = (x = 0): Spring => ({ x, v: 0 });

export function settleSpring(s: Spring, target: number): void {
  s.x = target;
  s.v = 0;
}

/**
 * Closed-form damped harmonic oscillator step.
 * Frame-rate independent, stable at any `dt`, and a safe no-op when `dt <= 0` (hit-stop).
 */
export function stepSpring(
  s: Spring,
  target: number,
  omega: number,
  zeta: number,
  dt: number,
): number {
  if (dt <= 0) return s.x;
  const x0 = s.x - target;
  const v0 = s.v;
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * omega * dt);
    const c = Math.cos(wd * dt);
    const sn = Math.sin(wd * dt);
    const b = (v0 + zeta * omega * x0) / wd;
    s.x = target + e * (x0 * c + b * sn);
    s.v = e * ((b * wd - x0 * zeta * omega) * c - (x0 * wd + b * zeta * omega) * sn);
  } else {
    const e = Math.exp(-omega * dt);
    const b = v0 + omega * x0;
    s.x = target + e * (x0 + b * dt);
    s.v = e * (v0 - b * omega * dt);
  }
  return s.x;
}

/** Deterministic 32-bit PRNG for repeatable particle scatter. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic 32-bit FNV-1a hash for strings and tuples (content version, band, slot index).
 */
export function stableHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Two-bone inverse kinematics solver using the law of cosines (`docs/animation.md`).
 * Preserves exact upper and lower bone lengths for every target, including coincident
 * and unreachable targets. Draw the hand/foot at `end`, never at raw `target`.
 */
export function solveLimb(
  root: Joint,
  target: Joint,
  upper: number,
  lower: number,
  pole: number,
): { root: Joint; joint: Joint; end: Joint } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const rawDist = Math.hypot(dx, dy);
  const ux = rawDist > 0.0001 ? dx / rawDist : 0;
  const uy = rawDist > 0.0001 ? dy / rawDist : 1;
  const minReach = Math.abs(upper - lower) + 0.001;
  const maxReach = upper + lower - 0.001;
  const reach = clamp(rawDist, minReach, maxReach);
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * (pole < 0 ? -1 : 1);
  return {
    root,
    joint: {
      x: root.x + ux * along - uy * bend,
      y: root.y + uy * along + ux * bend,
    },
    end: {
      x: root.x + ux * reach,
      y: root.y + uy * reach,
    },
  };
}

export const heading = (from: Joint, to: Joint): number =>
  Math.atan2(to.y - from.y, to.x - from.x);

export const turnTo = (a: number, b: number, t: number): number =>
  a + (((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * clamp(t, 0, 1);

/**
 * Angular blend between two solved two-bone poses.
 * Preserves exact `upper` and `lower` bone lengths at every `t` and avoids mid-swing pole flips.
 */
export function swingLimb(
  root: Joint,
  a: { joint: Joint; end: Joint },
  b: { joint: Joint; end: Joint },
  t: number,
  upper: number,
  lower: number,
): { root: Joint; joint: Joint; end: Joint } {
  const u = clamp(t, 0, 1);
  if (u <= 0) return { root, joint: a.joint, end: a.end };
  if (u >= 1) return { root, joint: b.joint, end: b.end };
  const up = turnTo(heading(root, a.joint), heading(root, b.joint), u);
  const joint: Joint = {
    x: root.x + Math.cos(up) * upper,
    y: root.y + Math.sin(up) * upper,
  };
  const fore = turnTo(heading(a.joint, a.end), heading(b.joint, b.end), u);
  return {
    root,
    joint,
    end: {
      x: joint.x + Math.cos(fore) * lower,
      y: joint.y + Math.sin(fore) * lower,
    },
  };
}

/**
 * Distance-driven foot gait (`docs/animation.md`).
 * During stance (`phase < 0.58`), `x` cancels root travel so planted soles do not skate;
 * swing returns the foot with zero endpoint velocity.
 */
export function stepFoot(
  distance: number,
  stride: number,
  offset: number,
  lift: number,
  dir = 1,
): Joint {
  const safeStride = Math.max(1, stride);
  const phase = (((distance / safeStride + offset) % 1) + 1) % 1;
  const half = (safeStride * 0.58) / 2;
  if (phase < 0.58) {
    return { x: (half - phase * safeStride) * dir, y: 0 };
  }
  const u = (phase - 0.58) / 0.42;
  return {
    x: (-half - u * safeStride * 0.42 + safeStride * u * u * (3 - 2 * u)) * dir,
    y: -lift * Math.sin(Math.PI * u) ** 2,
  };
}
