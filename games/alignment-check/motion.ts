/** Motion toolkit: exact damped springs, easing, deterministic noise and a seeded generator. Everything */

export const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Hermite ramp from 0 at `edge0` to 1 at `edge1`. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Hash noise in [0, 1): the same input always gives the same value. */
export const noise = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export interface Spring {
  x: number;
  v: number;
}

export const spring = (x = 0): Spring => ({ x, v: 0 });

/** Moves a damped spring toward `target` by `dt` seconds with the closed-form solution of the oscillator, exact */
export function stepSpring(s: Spring, target: number, omega: number, zeta: number, dt: number): Spring {
  if (dt <= 0) return s;
  const x0 = s.x - target;
  const v0 = s.v;
  if (zeta >= 1) {
    const e = Math.exp(-omega * dt);
    const b = v0 + omega * x0;
    s.x = target + e * (x0 + b * dt);
    s.v = e * (b - omega * (x0 + b * dt));
    return s;
  }
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const e = Math.exp(-zeta * omega * dt);
  const c = Math.cos(wd * dt);
  const sn = Math.sin(wd * dt);
  const b = (v0 + zeta * omega * x0) / wd;
  s.x = target + e * (x0 * c + b * sn);
  s.v = e * ((wd * b - zeta * omega * x0) * c - (wd * x0 + zeta * omega * b) * sn);
  return s;
}

/** Jumps a spring to `target` at rest, for the first frame or a reset. */
export function settleSpring(s: Spring, target: number): Spring {
  s.x = target;
  s.v = 0;
  return s;
}

/** A small deterministic generator (mulberry32), so a replayed crash falls the same way every time. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
