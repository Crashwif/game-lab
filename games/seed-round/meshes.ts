/**
 * Procedural geometry: every model in the game is built here from lathes,
 * ellipsoids and boxes at start-up, so the bundle carries no model files.
 * A vertex has a position, a smooth normal, a colour and two extras: `wave`
 * (how much of the swimming undulation it takes, 0 at the head) and `part`
 * (which surface treatment the shader gives it; see PART).
 */
import { type Vec3, cross, normalize, sub } from './math3d';

export const PART = { plain: 0, face: 1, print: 2, eye: 3 } as const;

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  extras: Float32Array;
  indices: Uint16Array | Uint32Array;
}

type Colour = Vec3;
interface Sample { z: number; rx: number; ry: number; wave?: number }

class Builder {
  positions: number[] = [];
  colors: number[] = [];
  extras: number[] = [];
  indices: number[] = [];

  get count(): number { return this.positions.length / 3; }

  vertex(p: Vec3, c: Colour, wave = 0, part: number = PART.plain): number {
    this.positions.push(p[0], p[1], p[2]);
    this.colors.push(c[0], c[1], c[2]);
    this.extras.push(wave, part);
    return this.count - 1;
  }

  tri(a: number, b: number, c: number): void { this.indices.push(a, b, c); }

  /** Applies `fn` to the vertices added since `start`. */
  transform(start: number, fn: (p: Vec3) => Vec3): void {
    for (let i = start; i < this.count; i += 1) {
      const p = fn([this.positions[i * 3]!, this.positions[i * 3 + 1]!, this.positions[i * 3 + 2]!]);
      this.positions[i * 3] = p[0]; this.positions[i * 3 + 1] = p[1]; this.positions[i * 3 + 2] = p[2];
    }
  }

  finish(): MeshData {
    const n = new Float32Array(this.positions.length);
    const p = this.positions;
    for (let i = 0; i < this.indices.length; i += 3) {
      const [a, b, c] = [this.indices[i]!, this.indices[i + 1]!, this.indices[i + 2]!];
      const pa: Vec3 = [p[a * 3]!, p[a * 3 + 1]!, p[a * 3 + 2]!];
      const face = cross(sub([p[b * 3]!, p[b * 3 + 1]!, p[b * 3 + 2]!], pa), sub([p[c * 3]!, p[c * 3 + 1]!, p[c * 3 + 2]!], pa));
      for (const v of [a, b, c]) { n[v * 3]! += face[0]; n[v * 3 + 1]! += face[1]; n[v * 3 + 2]! += face[2]; }
    }
    for (let v = 0; v < this.count; v += 1) {
      const u = normalize([n[v * 3]!, n[v * 3 + 1]!, n[v * 3 + 2]!]);
      n[v * 3] = u[0]; n[v * 3 + 1] = u[1]; n[v * 3 + 2] = u[2];
    }
    return {
      positions: new Float32Array(this.positions),
      normals: n,
      colors: new Float32Array(this.colors),
      extras: new Float32Array(this.extras),
      indices: this.count > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices),
    };
  }
}

/**
 * A surface of revolution around z with an elliptical (or, with `square` above
 * 2, a rounded-box) cross-section at each sample. The normal sits on the right
 * of the profile's direction of travel: a profile walked from +z to -z faces
 * outwards, one walked back up faces the axis (the inside of a bin).
 */
function lathe(b: Builder, profile: Sample[], sides: number, colour: (angle: number, sample: Sample) => Colour, part: number = PART.plain, square = 2): void {
  const start = b.count;
  for (const sample of profile) {
    for (let j = 0; j < sides; j += 1) {
      const angle = (j / sides) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const k = square === 2 ? 1 : Math.pow(Math.pow(Math.abs(c), square) + Math.pow(Math.abs(s), square), -1 / square);
      b.vertex([c * k * sample.rx, s * k * sample.ry, sample.z], colour(angle, sample), sample.wave ?? 0, part);
    }
  }
  for (let i = 0; i < profile.length - 1; i += 1) {
    for (let j = 0; j < sides; j += 1) {
      const a = start + i * sides + j;
      const c = start + i * sides + ((j + 1) % sides);
      const d = a + sides;
      const e = c + sides;
      b.tri(a, d, c); b.tri(c, d, e);
    }
  }
}

function ellipsoid(b: Builder, centre: Vec3, radii: Vec3, colour: Colour, part: number = PART.plain, segments = 16, rings = 10, wave = 0): void {
  const profile: Sample[] = [];
  for (let i = 0; i <= rings; i += 1) {
    const a = (i / rings) * Math.PI;
    profile.push({ z: Math.cos(a) * radii[2], rx: Math.max(1e-3, Math.sin(a) * radii[0]), ry: Math.max(1e-3, Math.sin(a) * radii[1]), wave });
  }
  const start = b.count;
  lathe(b, profile, segments, () => colour, part);
  b.transform(start, (p) => [p[0] + centre[0], p[1] + centre[1], p[2] + centre[2]]);
}

function box(b: Builder, centre: Vec3, half: Vec3, colour: Colour): void {
  const faces: [Vec3, Vec3, Vec3][] = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  for (const [n, u, v] of faces) {
    const corner = (su: number, sv: number): Vec3 => [0, 1, 2].map((k) => centre[k]! + half[k]! * (n[k]! + u[k]! * su + v[k]! * sv)) as Vec3;
    const a = b.vertex(corner(-1, -1), colour);
    const c = b.vertex(corner(1, -1), colour);
    const d = b.vertex(corner(1, 1), colour);
    const e = b.vertex(corner(-1, 1), colour);
    b.tri(a, c, d); b.tri(a, d, e);
  }
}

const PEARL: Colour = [0.96, 0.94, 0.9];

/** A swimmer, head first along +z: a flattened paddle head, a midpiece and a long tail that takes the wave. */
export function swimmerMesh(): MeshData {
  const b = new Builder();
  const head: Sample[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const a = (i / 12) * Math.PI;
    const z = Math.cos(a);
    const bulge = Math.sin(a) * (1 + 0.18 * z);
    head.push({ z: 0.3 * z, rx: Math.max(1e-3, 0.21 * bulge), ry: Math.max(1e-3, 0.15 * bulge) });
  }
  lathe(b, head, 18, () => PEARL, PART.face);
  const body: Sample[] = [{ z: -0.24, rx: 0.08, ry: 0.07 }, { z: -0.34, rx: 0.07, ry: 0.065 }, { z: -0.5, rx: 0.05, ry: 0.05 }];
  const segments = 30;
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const r = 0.045 * (1 - t) + 0.004;
    body.push({ z: -0.5 - t * 1.9, rx: r, ry: r, wave: t });
  }
  lathe(b, body, 7, (_a, s) => (s.wave ?? 0) > 0.8 ? [0.9, 0.86, 0.84] : PEARL);
  return b.finish();
}

/** Your swimmer's beanie: a lime knit dome with a band, a stalk and (separately) the propeller. */
export function beanieMesh(): MeshData {
  const b = new Builder();
  const dome: Sample[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const a = (i / 8) * Math.PI * 0.5;
    dome.push({ z: 0.16 * Math.cos(a), rx: Math.max(1e-3, 0.2 * Math.sin(a)), ry: Math.max(1e-3, 0.2 * Math.sin(a)) });
  }
  dome.push({ z: -0.03, rx: 0.205, ry: 0.205 });
  lathe(b, dome, 20, (angle, s) => (s.z < 0.02 ? [0.95, 0.35, 0.62] : Math.sin(angle * 6) > 0 ? [0.84, 0.98, 0.43] : [0.66, 0.86, 0.25]));
  const stalk: Sample[] = [{ z: 0.26, rx: 0.018, ry: 0.018 }, { z: 0.15, rx: 0.018, ry: 0.018 }];
  lathe(b, stalk, 6, () => [0.2, 0.2, 0.24]);
  ellipsoid(b, [0, 0, 0.27], [0.035, 0.035, 0.03], [0.95, 0.3, 0.3], PART.plain, 8, 5);
  // Lathes run along z; the hat's axis is the swimmer's up (+y).
  b.transform(0, (p) => [p[0], p[2], -p[1]]);
  return b.finish();
}

export function propellerMesh(): MeshData {
  const b = new Builder();
  box(b, [0.14, 0, 0], [0.13, 0.008, 0.03], [0.95, 0.3, 0.3]);
  box(b, [-0.14, 0, 0], [0.13, 0.008, 0.03], [0.3, 0.55, 1]);
  return b.finish();
}

/** Sunglasses for the frozen winner: two dark lenses and a bridge, facing +z. */
export function shadesMesh(): MeshData {
  const b = new Builder();
  const ink: Colour = [0.03, 0.03, 0.05];
  ellipsoid(b, [0.085, 0.03, 0.27], [0.075, 0.05, 0.02], ink, PART.eye, 12, 6);
  ellipsoid(b, [-0.085, 0.03, 0.27], [0.075, 0.05, 0.02], ink, PART.eye, 12, 6);
  box(b, [0, 0.05, 0.275], [0.03, 0.008, 0.008], ink);
  return b.finish();
}

/**
 * The sperm whale: a blunt box of a head, a body that tapers to the flukes
 * and takes a vertical wave, pectoral fins and eyes. The jaw is its own mesh
 * so it can hinge open.
 */
export function whaleMesh(): MeshData {
  const b = new Builder();
  const profile: Sample[] = [
    { z: 6.27, rx: 1e-3, ry: 1e-3 }, { z: 6.25, rx: 0.85, ry: 1.05 }, { z: 6.05, rx: 1.4, ry: 1.65 }, { z: 5.7, rx: 1.6, ry: 1.85 }, { z: 4.4, rx: 1.75, ry: 1.95 },
    { z: 2.8, rx: 1.8, ry: 1.95 }, { z: 1.2, rx: 1.72, ry: 1.82 }, { z: -0.4, rx: 1.52, ry: 1.55, wave: 0.1 }, { z: -2, rx: 1.22, ry: 1.2, wave: 0.3 },
    { z: -3.5, rx: 0.88, ry: 0.86, wave: 0.55 }, { z: -4.9, rx: 0.52, ry: 0.55, wave: 0.8 }, { z: -6, rx: 0.26, ry: 0.3, wave: 0.95 }, { z: -6.4, rx: 0.16, ry: 0.18, wave: 1 },
  ];
  const skin = (angle: number): Colour => {
    const belly = Math.max(0, -Math.sin(angle));
    return [0.42 + belly * 0.3, 0.47 + belly * 0.28, 0.57 + belly * 0.24];
  };
  lathe(b, profile, 22, skin, PART.plain, 3.2);
  let start = b.count;
  ellipsoid(b, [0, 0, -6.9], [2.5, 0.1, 0.75], [0.27, 0.31, 0.38], PART.plain, 14, 6, 1);
  b.transform(start, (p) => [p[0], p[1], p[2] - Math.abs(p[0]) * 0.35]);
  for (const side of [-1, 1]) {
    start = b.count;
    ellipsoid(b, [0, 0, 0], [0.9, 0.08, 0.4], [0.3, 0.34, 0.41], PART.plain, 10, 5);
    b.transform(start, (p) => [side * (1.55 + p[0] * 0.9), -1.1 - Math.abs(p[0]) * 0.45 + p[1], 0.9 + p[2] - Math.abs(p[0]) * 0.3]);
    ellipsoid(b, [side * 1.62, -0.35, 1.5], [0.16, 0.16, 0.16], [0.05, 0.05, 0.07], PART.eye, 10, 6);
    ellipsoid(b, [side * 1.72, -0.3, 1.56], [0.06, 0.06, 0.06], [0.95, 0.95, 0.95], PART.plain, 8, 5);
  }
  return b.finish();
}

/** The lower jaw, hinged at the origin and reaching forward along +z. */
export function whaleJawMesh(): MeshData {
  const b = new Builder();
  const profile: Sample[] = [{ z: 4.4, rx: 0.08, ry: 0.06 }, { z: 4.2, rx: 0.36, ry: 0.2 }, { z: 2, rx: 0.5, ry: 0.26 }, { z: 0, rx: 0.8, ry: 0.36 }, { z: -0.3, rx: 0.5, ry: 0.25 }];
  lathe(b, profile, 12, (angle) => (Math.sin(angle) > 0 ? [0.92, 0.88, 0.86] : [0.5, 0.53, 0.58]));
  for (let i = 0; i < 9; i += 1) ellipsoid(b, [0.26 * (i % 2 ? 1 : -1), 0.24, 3.8 - i * 0.38], [0.06, 0.12, 0.06], [1, 1, 0.96], PART.plain, 6, 4);
  return b.finish();
}

export function sphereMesh(segments = 32, rings = 20): MeshData {
  const b = new Builder();
  ellipsoid(b, [0, 0, 0], [1, 1, 1], [1, 1, 1], PART.plain, segments, rings);
  return b.finish();
}

/**
 * The latex wall that ends the race, seen from inside: a disc of unit radius
 * that bulges along +z to a reservoir tip. `print` parts carry the brand.
 */
export function membraneMesh(): MeshData {
  const b = new Builder();
  const profile: Sample[] = [];
  const rings = 22;
  for (let i = 0; i <= rings; i += 1) {
    const r = 1.25 * (1 - i / rings);
    const dome = 0.55 * Math.pow(Math.max(0, 1 - (r * r) / 1.5625), 0.7);
    const tip = 0.35 * Math.exp(-(r * r) / 0.012);
    profile.push({ z: dome + tip, rx: Math.max(1e-3, r), ry: Math.max(1e-3, r) });
  }
  lathe(b, profile, 36, () => [1, 0.62, 0.72], PART.print);
  return b.finish();
}

/** The same reservoir-tipped sheath from outside, knotted at the open end (z = 0) and tipped at +z. */
export function condomMesh(): MeshData {
  const b = new Builder();
  const profile: Sample[] = [{ z: -0.22, rx: 1e-3, ry: 1e-3 }, { z: -0.2, rx: 0.18, ry: 0.18 }, { z: -0.05, rx: 0.3, ry: 0.28 }, { z: 0.1, rx: 0.12, ry: 0.12 }, { z: 0.35, rx: 0.1, ry: 0.1 }, { z: 0.8, rx: 0.34, ry: 0.34 }, { z: 1.4, rx: 0.56, ry: 0.56 }];
  for (let i = 0; i <= 8; i += 1) profile.push({ z: 1.6 + i * 0.35, rx: 0.6 + 0.02 * Math.sin(i), ry: 0.6 });
  for (let i = 1; i <= 8; i += 1) {
    const a = (i / 8) * Math.PI * 0.5;
    profile.push({ z: 4.4 + 0.58 * Math.sin(a), rx: Math.max(0.14, 0.6 * Math.cos(a)), ry: Math.max(0.14, 0.6 * Math.cos(a)) });
  }
  profile.push({ z: 5.25, rx: 0.14, ry: 0.14 }, { z: 5.38, rx: 0.1, ry: 0.1 }, { z: 5.42, rx: 1e-3, ry: 1e-3 });
  lathe(b, profile.reverse(), 28, () => [1, 0.62, 0.72], PART.print);
  return b.finish();
}

/** An open-topped pedal bin along +y. */
export function binMesh(): MeshData {
  const b = new Builder();
  const metal: Colour = [0.42, 0.45, 0.5];
  // Walked from the inside floor up the inner wall, over the rim and down the outside.
  const outer: Sample[] = [{ z: 0.15, rx: 1e-3, ry: 1e-3 }, { z: 0.15, rx: 0.98, ry: 0.98 }, { z: 2.74, rx: 1.18, ry: 1.18 }, { z: 2.74, rx: 1.3, ry: 1.3 }, { z: 2.66, rx: 1.32, ry: 1.32 }, { z: 2.6, rx: 1.25, ry: 1.25 }, { z: 0, rx: 1.05, ry: 1.05 }];
  lathe(b, outer, 32, (angle, s) => (s.z > 2.5 ? [0.6, 0.63, 0.68] : [metal[0] + 0.05 * Math.sin(angle * 16), metal[1] + 0.05 * Math.sin(angle * 16), metal[2] + 0.05 * Math.sin(angle * 16)]));
  box(b, [0, -1.15, 0.1], [0.35, 0.12, 0.08], [0.2, 0.2, 0.22]);
  b.transform(0, (p) => [p[0], p[2], -p[1]]);
  return b.finish();
}

/**
 * A round rug on the floor (+y up, unit radius): a gold medallion, maroon and
 * navy bands, a cream border with a zigzag, and a fringe of tassels.
 */
export function rugMesh(): MeshData {
  const b = new Builder();
  const profile: Sample[] = [];
  for (let i = 0; i <= 24; i += 1) {
    const r = Math.max(1e-3, i / 24);
    profile.push({ z: 0, rx: r, ry: r });
  }
  const maroon: Colour = [0.46, 0.06, 0.11];
  const navy: Colour = [0.1, 0.12, 0.28];
  const gold: Colour = [0.82, 0.6, 0.22];
  const cream: Colour = [0.88, 0.8, 0.64];
  const bands: Colour[] = [cream, gold, maroon, maroon, maroon, gold, navy, navy, maroon, maroon, maroon, cream, navy];
  lathe(b, profile.reverse(), 64, (angle, s) => {
    const r = s.rx;
    if (r > 0.86) return Math.sin(angle * 48 + (r - 0.86) * 90) > 0 ? cream : navy;
    const band = bands[Math.min(bands.length - 1, Math.floor((r / 0.86) * bands.length))]!;
    const petal = Math.sin(angle * 8) * 0.5 + 0.5;
    if (r < 0.36 && r > 0.1 && petal > 0.72) return navy;
    if (r > 0.5 && r < 0.66 && Math.sin(angle * 16) > 0.6) return gold;
    return band;
  });
  b.transform(0, (p) => [p[0], -p[2] + 0.01, p[1]]);
  for (let i = 0; i < 72; i += 1) {
    const a = (i / 72) * Math.PI * 2;
    box(b, [Math.cos(a) * 1.035, 0.008, Math.sin(a) * 1.035], [0.012, 0.006, 0.012], [0.95, 0.9, 0.78]);
  }
  return b.finish();
}

/** The sperm bank's vial along +y: a glass tube (index 0) and its cap (index 1). */
export function vialMeshes(): [MeshData, MeshData] {
  const glass = new Builder();
  const profile: Sample[] = [];
  for (let i = 0; i <= 6; i += 1) {
    const a = (i / 6) * Math.PI * 0.5;
    profile.push({ z: 0.45 - 0.45 * Math.cos(a), rx: Math.max(1e-3, 0.45 * Math.sin(a)), ry: Math.max(1e-3, 0.45 * Math.sin(a)) });
  }
  profile.push({ z: 2.4, rx: 0.45, ry: 0.45 });
  lathe(glass, profile.reverse(), 24, () => [0.75, 0.9, 1]);
  glass.transform(0, (p) => [p[0], p[2], -p[1]]);
  const cap = new Builder();
  lathe(cap, [{ z: 2.95, rx: 1e-3, ry: 1e-3 }, { z: 2.95, rx: 0.5, ry: 0.5 }, { z: 2.35, rx: 0.52, ry: 0.52 }, { z: 2.35, rx: 1e-3, ry: 1e-3 }], 24, (angle) => (Math.sin(angle * 12) > 0 ? [0.2, 0.55, 0.95] : [0.16, 0.45, 0.85]));
  cap.transform(0, (p) => [p[0], p[2], -p[1]]);
  return [glass.finish(), cap.finish()];
}

/**
 * The tunnel wall as a grid: x holds the angle as a fraction of a turn, y the
 * ring number. The vertex shader bends it onto the path.
 */
export function tunnelGrid(sides: number, rings: number): { grid: Float32Array; indices: Uint32Array } {
  const grid = new Float32Array((sides + 1) * rings * 2);
  const indices = new Uint32Array(sides * (rings - 1) * 6);
  let g = 0;
  for (let j = 0; j < rings; j += 1) for (let i = 0; i <= sides; i += 1) { grid[g++] = i / sides; grid[g++] = j; }
  let k = 0;
  for (let j = 0; j < rings - 1; j += 1) {
    for (let i = 0; i < sides; i += 1) {
      const a = j * (sides + 1) + i;
      const c = a + sides + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = a + 1;
      indices[k++] = a + 1; indices[k++] = c; indices[k++] = c + 1;
    }
  }
  return { grid, indices };
}
