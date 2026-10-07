/** Procedural mesh builders. Vertex extras select material, atlas cell and print coordinates. */
import { PRINT } from './atlas';
import { type Vec3, cross, normalize, rotateAbout, sub } from './math3d';

export const PART = { plain: 0, face: 1, print: 2, glossy: 3 } as const;

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  extras: Float32Array;
  indices: Uint16Array | Uint32Array;
}

type Colour = Vec3;
interface Sample { y: number; r: number }
type ColourFn = Colour | ((angle: number, sample: Sample, index: number) => Colour);

const colourAt = (c: ColourFn, angle: number, sample: Sample, index: number): Colour => (typeof c === 'function' ? c(angle, sample, index) : c);

const WHITE: Colour = [0.93, 0.94, 0.96];
const RED: Colour = [0.86, 0.13, 0.17];
const DARK: Colour = [0.16, 0.16, 0.19];
const STEEL: Colour = [0.55, 0.57, 0.62];
const VISOR: Colour = [0.2, 0.22, 0.28];
const GREEN: Colour = [0.3, 0.62, 0.28];
const WOOD: Colour = [0.45, 0.3, 0.18];

class Builder {
  positions: number[] = [];
  colors: number[] = [];
  extras: number[] = [];
  indices: number[] = [];

  get count(): number { return this.positions.length / 3; }

  vertex(p: Vec3, c: Colour, u = 0, v = 0, part: number = PART.plain, code = 0): number {
    this.positions.push(p[0], p[1], p[2]);
    this.colors.push(c[0], c[1], c[2]);
    this.extras.push(u, v, part, code);
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

/** A surface of revolution about +y. A profile walked from the top down faces outward; walked upward, it faces the axis. */
function lathe(b: Builder, profile: Sample[], sides: number, colour: ColourFn, part: number = PART.plain, code = 0): void {
  const start = b.count;
  profile.forEach((sample, i) => {
    for (let j = 0; j < sides; j += 1) {
      const angle = (j / sides) * Math.PI * 2;
      const r = Math.max(1e-4, sample.r);
      b.vertex([Math.cos(angle) * r, sample.y, Math.sin(angle) * r], colourAt(colour, angle, sample, i), j / sides, i / Math.max(1, profile.length - 1), part, code);
    }
  });
  for (let i = 0; i < profile.length - 1; i += 1) {
    for (let j = 0; j < sides; j += 1) {
      const a = start + i * sides + j;
      const c = start + i * sides + ((j + 1) % sides);
      const d = a + sides;
      const e = c + sides;
      b.tri(a, c, d); b.tri(c, e, d);
    }
  }
}

function ellipsoid(b: Builder, centre: Vec3, radii: Vec3, colour: ColourFn, part: number = PART.plain, segments = 14, rings = 8): void {
  const profile: Sample[] = [];
  for (let i = 0; i <= rings; i += 1) {
    const a = (i / rings) * Math.PI;
    profile.push({ y: Math.cos(a), r: Math.max(1e-4, Math.sin(a)) });
  }
  const start = b.count;
  lathe(b, profile, segments, colour, part);
  b.transform(start, (p) => [centre[0] + p[0] * radii[0], centre[1] + p[1] * radii[1], centre[2] + p[2] * radii[2]]);
}

function box(b: Builder, centre: Vec3, half: Vec3, colour: Colour): number {
  const start = b.count;
  const faces: [Vec3, Vec3, Vec3][] = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  for (const [n, u, v] of faces) {
    const corner = (su: number, sv: number): Vec3 => [0, 1, 2].map((k) => centre[k]! + half[k]! * (n[k]! + u[k]! * su + v[k]! * sv)) as Vec3;
    const a = b.vertex(corner(-1, -1), colour);
    const c = b.vertex(corner(1, -1), colour);
    const d = b.vertex(corner(1, 1), colour);
    const e = b.vertex(corner(-1, 1), colour);
    b.tri(a, c, d); b.tri(a, d, e);
  }
  return start;
}

/** A box turned `angle` about `axis` through `pivot` (its centre by default). */
function rotBox(b: Builder, centre: Vec3, half: Vec3, colour: Colour, axis: Vec3, angle: number, pivot: Vec3 = centre): void {
  const start = box(b, centre, half, colour);
  b.transform(start, (p) => {
    const q = rotateAbout(sub(p, pivot), axis, angle);
    return [q[0] + pivot[0], q[1] + pivot[1], q[2] + pivot[2]];
  });
}

/** A disc in the xy plane facing +z (or -z), with texture coordinates across it (v down). */
function discZ(b: Builder, centre: Vec3, radius: number, colour: Colour, part: number = PART.plain, code = 0, segments = 24, back = false): void {
  const c = b.vertex(centre, colour, 0.5, 0.5, part, code);
  const ring: number[] = [];
  for (let j = 0; j < segments; j += 1) {
    const a = (j / segments) * Math.PI * 2;
    const x = Math.cos(a);
    const y = Math.sin(a);
    ring.push(b.vertex([centre[0] + x * radius, centre[1] + y * radius, centre[2]], colour, 0.5 + 0.5 * x, 0.5 - 0.5 * y, part, code));
  }
  for (let j = 0; j < segments; j += 1) {
    const p = ring[j]!;
    const q = ring[(j + 1) % segments]!;
    if (back) b.tri(c, q, p); else b.tri(c, p, q);
  }
}

/** A disc in the xz plane facing +y (or -y). */
function discY(b: Builder, centre: Vec3, radius: number, colour: Colour, part: number = PART.plain, code = 0, segments = 24, down = false): void {
  const c = b.vertex(centre, colour, 0.5, 0.5, part, code);
  const ring: number[] = [];
  for (let j = 0; j < segments; j += 1) {
    const a = (j / segments) * Math.PI * 2;
    const x = Math.cos(a);
    const z = Math.sin(a);
    ring.push(b.vertex([centre[0] + x * radius, centre[1], centre[2] + z * radius], colour, 0.5 + 0.5 * x, 0.5 + 0.5 * z, part, code));
  }
  for (let j = 0; j < segments; j += 1) {
    const p = ring[j]!;
    const q = ring[(j + 1) % segments]!;
    if (down) b.tri(c, p, q); else b.tri(c, q, p);
  }
}

/** A rectangle in the xy plane facing +z (or -z), u left to right and v top to bottom. */
function quad(b: Builder, centre: Vec3, halfW: number, halfH: number, colour: Colour, part: number = PART.plain, code = 0, back = false): void {
  const [cx, cy, cz] = centre;
  const tl = b.vertex([cx - halfW, cy + halfH, cz], colour, 0, 0, part, code);
  const tr = b.vertex([cx + halfW, cy + halfH, cz], colour, 1, 0, part, code);
  const br = b.vertex([cx + halfW, cy - halfH, cz], colour, 1, 1, part, code);
  const bl = b.vertex([cx - halfW, cy - halfH, cz], colour, 0, 1, part, code);
  if (back) { b.tri(tl, br, bl); b.tri(tl, tr, br); } else { b.tri(tl, bl, br); b.tri(tl, br, tr); }
}

function tube(b: Builder, y0: number, y1: number, r: number, colour: ColourFn, sides = 16, caps = true): void {
  lathe(b, [{ y: y1, r }, { y: y0, r }], sides, colour);
  if (caps) {
    const c = colourAt(colour, 0, { y: y1, r }, 0);
    discY(b, [0, y1, 0], r, c, PART.plain, 0, sides);
    discY(b, [0, y0, 0], r, c, PART.plain, 0, sides, true);
  }
}

/** A sphere whose front cap (toward +z) carries a face from the atlas: the helmet's visor, the lizard's head. */
function dome(b: Builder, centre: Vec3, R: number, colour: Colour, faceColour: Colour, cap = 0.82): void {
  const rings = 10;
  const segments = 16;
  const faceR = Math.sin(cap) * R;
  const grid: number[][] = [];
  for (let i = 0; i <= rings; i += 1) {
    const phi = (i / rings) * Math.PI;
    const row: number[] = [];
    for (let j = 0; j < segments; j += 1) {
      const th = (j / segments) * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(th) * R;
      const y = Math.sin(phi) * Math.sin(th) * R;
      const z = Math.cos(phi) * R;
      const face = phi < cap + 1e-6;
      row.push(b.vertex([centre[0] + x, centre[1] + y, centre[2] + z], face ? faceColour : colour, face ? 0.5 + x / (2 * faceR) : 0, face ? 0.5 - y / (2 * faceR) : 0, face ? PART.face : PART.plain));
    }
    grid.push(row);
  }
  for (let i = 0; i < rings; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = grid[i]![j]!;
      const c = grid[i]![(j + 1) % segments]!;
      const d = grid[i + 1]![j]!;
      const e = grid[i + 1]![(j + 1) % segments]!;
      b.tri(a, d, c); b.tri(c, d, e);
    }
  }
}

/** A limb hanging from `joint`, turned `rx` about x then `rz` about z, with a boot at its end. */
function limb(b: Builder, joint: Vec3, half: Vec3, colour: Colour, rz: number, rx: number, boot?: Colour): void {
  const start = b.count;
  box(b, [0, -half[1], 0], half, colour);
  if (boot) box(b, [0, -half[1] * 2 - 0.02, 0.03], [half[0] + 0.02, 0.04, half[2] + 0.05], boot);
  b.transform(start, (p) => {
    const q = rotateAbout(rotateAbout(p, [1, 0, 0], rx), [0, 0, 1], rz);
    return [q[0] + joint[0], q[1] + joint[1], q[2] + joint[2]];
  });
}

// ---- The rocket, base at y = 0 and up along +y ---------------------------------------------------------------

/** A strap-on booster: nose, body, red band, nozzle. Placed round the core by the scene. */
export function boosterMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 6.9, r: 0.001 }, { y: 6.85, r: 0.12 }, { y: 6.2, r: 0.4 }, { y: 5.7, r: 0.52 }, { y: 0.4, r: 0.52 }, { y: 0.3, r: 0.44 }], 14, (_a, s) => (s.y > 6.1 || (s.y < 4.7 && s.y > 4.3) ? RED : WHITE));
  discY(b, [0, 0.3, 0], 0.44, DARK, PART.plain, 0, 14, true);
  lathe(b, [{ y: 0.3, r: 0.22 }, { y: -0.3, r: 0.36 }, { y: -0.32, r: 0.3 }], 10, DARK);
  return b.finish();
}

/** The core stage: the tank with a checker band, the interstage, five engines and four swept fins. */
export function coreMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 8.4, r: 1.0 }, { y: 8.05, r: 1.0 }, { y: 8.05, r: 0.99 }, { y: 7.7, r: 0.99 }, { y: 7.7, r: 1.0 }, { y: 0.4, r: 1.0 }, { y: 0, r: 0.92 }], 20, (a, s) => {
    if (s.y > 8.0 || (s.y < 7.75 && s.y > 7.65)) return DARK;
    if (s.y < 0.9 && Math.floor(a / (Math.PI / 4)) % 2 === 0) return RED;
    return WHITE;
  });
  discY(b, [0, 8.4, 0], 1.0, DARK, PART.plain, 0, 20);
  discY(b, [0, 0, 0], 0.92, DARK, PART.plain, 0, 20, true);
  const engines: [number, number][] = [[0, 0], [0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]];
  for (const [x, z] of engines) {
    const start = b.count;
    lathe(b, [{ y: 0, r: 0.22 }, { y: -0.7, r: 0.4 }, { y: -0.72, r: 0.33 }], 10, DARK);
    b.transform(start, (p) => [p[0] + x, p[1], p[2] + z]);
  }
  for (let k = 0; k < 4; k += 1) {
    const start = box(b, [1.45, 0.95, 0], [0.5, 0.8, 0.05], RED);
    b.transform(start, (p) => rotateAbout([p[0], p[1] - Math.max(0, p[0] - 0.95) * 0.7, p[2]], [0, 1, 0], (k * Math.PI) / 2 + Math.PI / 4));
  }
  return b.finish();
}

/** The upper stage: an interstage truss, the HOPIUM tank and its engine. */
export function upperMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 13.5, r: 0.85 }, { y: 13.1, r: 0.85 }, { y: 12.7, r: 0.85 }, { y: 9.0, r: 0.85 }, { y: 8.95, r: 0.8 }, { y: 8.4, r: 0.8 }], 18, (_a, s) => (s.y < 9 ? DARK : s.y > 12.75 && s.y < 13.15 ? [0.2, 0.5, 0.95] : WHITE));
  discY(b, [0, 8.4, 0], 0.8, DARK, PART.plain, 0, 18, true);
  lathe(b, [{ y: 8.4, r: 0.28 }, { y: 7.8, r: 0.5 }, { y: 7.82, r: 0.42 }], 12, DARK);
  return b.finish();
}

/** The crew capsule: tapers from the stage to the nose, with a dark band where the portholes sit. */
export function capsuleMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 14.9, r: 0.5 }, { y: 14.6, r: 0.7 }, { y: 13.9, r: 0.85 }, { y: 13.5, r: 0.85 }], 18, (_a, s) => (s.y < 13.6 ? DARK : WHITE));
  discY(b, [0, 14.9, 0], 0.5, WHITE, PART.plain, 0, 18);
  return b.finish();
}

/** The nose cone, red tipped, and the antenna the wires hold. */
export function noseMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 16.5, r: 0.001 }, { y: 16.4, r: 0.1 }, { y: 15.5, r: 0.38 }, { y: 14.9, r: 0.5 }], 16, (_a, s) => (s.y > 15.6 ? RED : WHITE));
  tube(b, 16.5, 17.3, 0.03, STEEL, 6, false);
  ellipsoid(b, [0, 17.3, 0], [0.07, 0.07, 0.07], RED, PART.plain, 8, 4);
  return b.finish();
}

/** A porthole: a face in a dark rim, facing +z, proud of the hull it is placed on. */
export function portholeMesh(): MeshData {
  const b = new Builder();
  discZ(b, [0, 0, 0.02], 0.28, DARK, PART.plain, 0, 16);
  discZ(b, [0, 0, 0.035], 0.22, VISOR, PART.face, 0, 16);
  return b.finish();
}

/** A unit square facing +z that shows whatever print cell its instance names. */
export function stickerMesh(): MeshData {
  const b = new Builder();
  quad(b, [0, 0, 0], 0.5, 0.5, WHITE, PART.print, 0);
  return b.finish();
}

// ---- People ---------------------------------------------------------------------------------------------------

/** An astronaut a unit tall facing +z, with a visor that shows the instance's face: clinging, flailing or standing. */
export function astronautMesh(pose: 'cling' | 'flail' | 'stand' | 'torso'): MeshData {
  const b = new Builder();
  const suit = WHITE;
  dome(b, [0, 0.98, 0], 0.3, suit, VISOR);
  lathe(b, [{ y: 0.75, r: 0.26 }, { y: 0.68, r: 0.28 }, { y: 0.66, r: 0.24 }], 12, [0.35, 0.36, 0.4]);
  lathe(b, [{ y: 0.72, r: 0.22 }, { y: 0.6, r: 0.27 }, { y: 0.4, r: 0.27 }, { y: 0.3, r: 0.2 }], 12, suit);
  discY(b, [0, 0.3, 0], 0.2, suit, PART.plain, 0, 12, true);
  box(b, [0, 0.58, 0.25], [0.11, 0.09, 0.04], [0.3, 0.4, 0.62]);
  box(b, [0, 0.6, -0.32], [0.19, 0.26, 0.1], [0.78, 0.8, 0.84]);
  const boot: Colour = [0.2, 0.2, 0.24];
  const arm: Vec3 = [0.06, 0.2, 0.06];
  const leg: Vec3 = [0.075, 0.19, 0.075];
  if (pose === 'cling') {
    limb(b, [-0.29, 0.66, 0.04], arm, suit, -(Math.PI - 0.45), 0.35);
    limb(b, [0.29, 0.66, 0.04], arm, suit, Math.PI - 0.45, 0.35);
    limb(b, [-0.12, 0.32, 0], leg, suit, -0.5, -0.45, boot);
    limb(b, [0.12, 0.32, 0], leg, suit, 0.5, -0.45, boot);
  } else if (pose === 'flail') {
    limb(b, [-0.29, 0.66, 0.04], arm, suit, -(Math.PI / 2 + 0.25), 0);
    limb(b, [0.29, 0.66, 0.04], arm, suit, Math.PI / 2 + 0.25, 0);
    limb(b, [-0.12, 0.32, 0], leg, suit, -0.35, -0.7, boot);
    limb(b, [0.12, 0.32, 0], leg, suit, 0.35, 0.5, boot);
  } else if (pose === 'stand') {
    limb(b, [-0.29, 0.66, 0.04], arm, suit, -0.2, 0);
    limb(b, [0.29, 0.66, 0.04], arm, suit, 0.2, 0);
    limb(b, [-0.12, 0.32, 0], leg, suit, -0.06, 0, boot);
    limb(b, [0.12, 0.32, 0], leg, suit, 0.06, 0, boot);
  }
  return b.finish();
}

/** A parachute canopy of unit radius, open at the bottom; the lines are box instances the scene adds. */
export function chuteMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 0.5, r: 0.001 }, { y: 0.48, r: 0.25 }, { y: 0.38, r: 0.6 }, { y: 0.2, r: 0.88 }, { y: 0, r: 1.0 }, { y: -0.03, r: 0.98 }], 18, (a) => (Math.floor(a / (Math.PI / 3)) % 2 === 0 ? [0.78, 0.95, 0.42] : [0.14, 0.2, 0.1]));
  return b.finish();
}

/** The dev: a lizard in a suit and tie, sitting. The instance names the lizard face. */
export function lizardMesh(): MeshData {
  const b = new Builder();
  const suit: Colour = [0.12, 0.12, 0.16];
  ellipsoid(b, [0, 0.58, 0], [0.3, 0.34, 0.27], suit, PART.plain, 12, 7);
  dome(b, [0, 1.05, 0.05], 0.3, GREEN, GREEN, 0.9);
  box(b, [0, 0.66, 0.26], [0.04, 0.16, 0.02], RED);
  box(b, [-0.15, 0.32, 0.26], [0.09, 0.08, 0.3], GREEN);
  box(b, [0.15, 0.32, 0.26], [0.09, 0.08, 0.3], GREEN);
  box(b, [-0.15, 0.06, 0.5], [0.07, 0.2, 0.07], GREEN);
  box(b, [0.15, 0.06, 0.5], [0.07, 0.2, 0.07], GREEN);
  limb(b, [-0.36, 0.72, 0.04], [0.07, 0.24, 0.07], suit, -0.15, -0.5);
  limb(b, [0.36, 0.72, 0.04], [0.07, 0.24, 0.07], suit, 0.15, -0.5);
  const start = b.count;
  lathe(b, [{ y: 1.7, r: 0.02 }, { y: 1.0, r: 0.08 }, { y: 0, r: 0.15 }], 8, GREEN);
  b.transform(start, (p) => { const q = rotateAbout(p, [1, 0, 0], -(Math.PI / 2 + 0.5)); return [q[0], q[1] + 0.35, q[2] - 0.2]; });
  return b.finish();
}

// ---- Props ----------------------------------------------------------------------------------------------------

/** A painted disc of unit radius facing +y with a rim: the flat earth (ice wall round the edge, dark underneath). */
export function earthPlateMesh(): MeshData {
  const b = new Builder();
  discY(b, [0, 0, 0], 1, WHITE, PART.print, PRINT.earth, 64);
  lathe(b, [{ y: 0, r: 1 }, { y: -0.05, r: 1 }], 64, [0.95, 0.97, 1]);
  discY(b, [0, -0.05, 0], 1, [0.28, 0.24, 0.2], PART.plain, 0, 64, true);
  return b.finish();
}

/** The moon prop: the painted moon on top, a plywood edge, and the back of the moon underneath. */
export function moonPlateMesh(): MeshData {
  const b = new Builder();
  discY(b, [0, 0, 0], 1, WHITE, PART.print, PRINT.moon, 48);
  lathe(b, [{ y: 0, r: 1 }, { y: -0.06, r: 1 }], 48, [0.78, 0.62, 0.42]);
  discY(b, [0, -0.06, 0], 1, WHITE, PART.print, PRINT.butt, 48, true);
  return b.finish();
}

/** A plain unit disc facing +z: eyes, pupils, lids, lamp lenses. */
export function discMesh(): MeshData {
  const b = new Builder();
  discZ(b, [0, 0, 0], 1, WHITE, PART.plain, 0, 24);
  return b.finish();
}

/** A unit cube: wires, poles, stands, walls, struts, the crash mat, whatever is blocky. */
export function boxMesh(): MeshData {
  const b = new Builder();
  box(b, [0, 0, 0], [0.5, 0.5, 0.5], WHITE);
  return b.finish();
}

export function sphereMesh(): MeshData {
  const b = new Builder();
  ellipsoid(b, [0, 0, 0], [1, 1, 1], WHITE, PART.plain, 18, 10);
  return b.finish();
}

/** A unit cone, its base at y = 0 and its tip at y = 1. */
export function coneMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 1, r: 0.001 }, { y: 0, r: 1 }], 16, WHITE);
  discY(b, [0, 0, 0], 1, WHITE, PART.plain, 0, 16, true);
  return b.finish();
}

/** The boom mic: a fuzzy windscreen with its pole reaching up out of frame. */
export function micMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 0.6, r: 0.001 }, { y: 0.55, r: 0.2 }, { y: 0.4, r: 0.3 }, { y: -0.4, r: 0.3 }, { y: -0.55, r: 0.2 }, { y: -0.6, r: 0.001 }], 14, (a, s, i) => {
    const k = (Math.sin(a * 9 + i * 7) + Math.sin(a * 5 - i * 3)) * 0.5;
    return [0.36 + 0.14 * k, 0.35 + 0.13 * k, 0.37 + 0.12 * k];
  });
  tube(b, 0.55, 7, 0.035, DARK, 6, false);
  return b.finish();
}

/** A giant stagehand's glove, fingers up along +y and the palm facing +z; the arm is a box instance. */
export function gloveMesh(): MeshData {
  const b = new Builder();
  ellipsoid(b, [0, 0, 0], [0.55, 0.65, 0.28], WHITE, PART.plain, 14, 8);
  for (const x of [-0.42, -0.14, 0.14, 0.42]) {
    const start = b.count;
    ellipsoid(b, [0, 0.4, 0], [0.14, 0.42, 0.14], WHITE, PART.plain, 10, 6);
    b.transform(start, (p) => { const q = rotateAbout(p, [0, 0, 1], -x * 0.35); return [q[0] + x, q[1] + 0.5, q[2]]; });
  }
  const start = b.count;
  ellipsoid(b, [0, 0.3, 0], [0.13, 0.34, 0.13], WHITE, PART.plain, 10, 6);
  b.transform(start, (p) => { const q = rotateAbout(p, [0, 0, 1], 1.0); return [q[0] - 0.62, q[1] + 0.05, q[2]]; });
  tube(b, -0.85, -0.5, 0.5, DARK, 14, true);
  return b.finish();
}

/** The SEC's bird: a drone in feathers, forward along +x, with a lens for an eye. The wings are their own mesh. */
export function birdMesh(): MeshData {
  const b = new Builder();
  const feather: Colour = [0.22, 0.22, 0.26];
  ellipsoid(b, [0, 0, 0], [0.42, 0.22, 0.2], feather, PART.plain, 12, 7);
  ellipsoid(b, [0.42, 0.12, 0], [0.17, 0.16, 0.16], feather, PART.plain, 10, 6);
  ellipsoid(b, [0.62, 0.08, 0], [0.13, 0.05, 0.05], [0.95, 0.6, 0.15], PART.plain, 8, 4);
  ellipsoid(b, [0.52, 0.15, 0.12], [0.07, 0.07, 0.07], [0.02, 0.02, 0.03], PART.glossy, 8, 5);
  ellipsoid(b, [0.52, 0.15, -0.12], [0.07, 0.07, 0.07], [0.02, 0.02, 0.03], PART.glossy, 8, 5);
  box(b, [-0.5, 0.02, 0], [0.16, 0.02, 0.12], feather);
  box(b, [0, 0.24, 0], [0.04, 0.04, 0.04], [0.9, 0.1, 0.1]);
  return b.finish();
}

/** One wing, hinged at the origin and reaching along +z; mirrored for the other side. */
export function wingMesh(): MeshData {
  const b = new Builder();
  box(b, [0, 0, 0.42], [0.17, 0.015, 0.42], [0.25, 0.25, 0.3]);
  return b.finish();
}

/** The dev's golf cart, forward along +z, with the bag on the back. */
export function cartMesh(): MeshData {
  const b = new Builder();
  box(b, [0, 0.55, 0], [0.7, 0.25, 1.3], WHITE);
  box(b, [0, 0.95, 0.1], [0.6, 0.12, 0.35], DARK);
  box(b, [0, 1.3, -0.3], [0.6, 0.3, 0.08], DARK);
  box(b, [0, 2.05, 0], [0.8, 0.04, 1.35], WHITE);
  for (const x of [-0.7, 0.7]) for (const z of [-1.2, 1.2]) box(b, [x, 1.55, z], [0.04, 0.5, 0.04], STEEL);
  for (const x of [-0.78, 0.78]) for (const z of [-0.85, 0.85]) {
    const start = b.count;
    tube(b, -0.1, 0.1, 0.3, DARK, 12, true);
    b.transform(start, (p) => { const q = rotateAbout(p, [0, 0, 1], Math.PI / 2); return [q[0] + x, q[1] + 0.3, q[2] + z]; });
  }
  const start = b.count;
  discZ(b, [0, 0, 0], 0.2, DARK, PART.plain, 0, 12);
  b.transform(start, (p) => { const q = rotateAbout(p, [1, 0, 0], -0.6); return [q[0] - 0.25, q[1] + 1.2, q[2] + 0.55]; });
  return b.finish();
}

/** The clapperboard, its face toward +z; the striped stick hinges separately. */
export function clapperMesh(): MeshData {
  const b = new Builder();
  box(b, [0, 0, 0], [0.65, 0.5, 0.03], [0.1, 0.1, 0.12]);
  quad(b, [0, 0, 0.035], 0.62, 0.47, WHITE, PART.print, PRINT.clapper);
  return b.finish();
}

/** The clapper's stick, hinged at its left end (the origin). */
export function stickMesh(): MeshData {
  const b = new Builder();
  for (let k = 0; k < 8; k += 1) box(b, [0.08 + k * 0.1625, 0.1, 0], [0.0815, 0.1, 0.03], k % 2 ? [0.95, 0.95, 0.95] : [0.1, 0.1, 0.12]);
  return b.finish();
}

/** A studio light's head pointing along +z, its lens at the origin; the stand is box instances and the lens a disc. */
export function lampMesh(): MeshData {
  const b = new Builder();
  const start = b.count;
  lathe(b, [{ y: 0.75, r: 0.28 }, { y: 0.05, r: 0.62 }, { y: 0, r: 0.66 }], 14, DARK);
  discY(b, [0, 0.75, 0], 0.28, DARK, PART.plain, 0, 14);
  box(b, [0, 0.4, -0.7], [0.06, 0.06, 0.3], STEEL);
  b.transform(start, (p) => [p[0], -p[2], p[1]]);
  for (const s of [-1, 1]) box(b, [s * 0.72, 0, 0.06], [0.03, 0.72, 0.12], DARK);
  return b.finish();
}

/** The director's chair, its DEV panel toward +z. */
export function chairMesh(): MeshData {
  const b = new Builder();
  for (const x of [-0.45, 0.45]) for (const z of [-0.4, 0.4]) box(b, [x, 0.5, z], [0.04, 0.5, 0.04], WOOD);
  box(b, [0, 1.0, 0], [0.5, 0.03, 0.45], [0.08, 0.08, 0.1]);
  for (const x of [-0.45, 0.45]) box(b, [x, 1.5, -0.42], [0.04, 0.5, 0.04], WOOD);
  for (const x of [-0.45, 0.45]) box(b, [x, 1.25, 0], [0.03, 0.03, 0.42], WOOD);
  quad(b, [0, 1.55, -0.4], 0.45, 0.28, WHITE, PART.print, PRINT.dev);
  quad(b, [0, 1.55, -0.41], 0.45, 0.28, [0.08, 0.08, 0.1], PART.plain, 0, true);
  return b.finish();
}

/** The WAGMI flag, its pole edge at x = 0 and reaching along +x; waves in the vertex shader. */
export function flagMesh(): MeshData {
  const b = new Builder();
  quad(b, [0.75, 0, 0], 0.75, 0.5, WHITE, PART.print, PRINT.flag);
  quad(b, [0.75, 0, -0.001], 0.75, 0.5, WHITE, PART.print, PRINT.flag, true);
  return b.finish();
}

/** A satellite dish of unit radius, opening toward +y. Drawn without culling. */
export function dishMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 0.3, r: 1 }, { y: 0.12, r: 0.7 }, { y: 0, r: 0.3 }, { y: -0.02, r: 0.001 }], 16, [0.82, 0.84, 0.88]);
  box(b, [0, 0.35, 0], [0.03, 0.4, 0.03], STEEL);
  ellipsoid(b, [0, 0.75, 0], [0.08, 0.08, 0.08], DARK, PART.plain, 8, 4);
  return b.finish();
}

/** Mom's trailer, its door toward +z. */
export function trailerMesh(): MeshData {
  const b = new Builder();
  const cream: Colour = [0.9, 0.86, 0.75];
  box(b, [0, 1.3, 0], [3.0, 1.3, 1.4], cream);
  box(b, [0, 1.0, 0], [3.01, 0.15, 1.41], [0.6, 0.25, 0.2]);
  box(b, [0, 2.65, 0], [3.05, 0.06, 1.45], [0.5, 0.5, 0.55]);
  quad(b, [1.2, 1.1, 1.415], 0.4, 0.9, [0.35, 0.25, 0.2]);
  quad(b, [-1.4, 1.7, 1.415], 0.55, 0.35, [0.35, 0.55, 0.7]);
  quad(b, [0.1, 1.7, 1.415], 0.35, 0.35, [0.35, 0.55, 0.7]);
  for (const x of [-1.6, 1.6]) for (const z of [-1.2, 1.2]) box(b, [x, 0.3, z], [0.35, 0.3, 0.15], DARK);
  box(b, [1.2, 0.1, 1.9], [0.5, 0.1, 0.4], [0.5, 0.5, 0.5]);
  ellipsoid(b, [-2.4, 0.6, 1.9], [0.35, 0.5, 0.35], WHITE, PART.plain, 10, 6);
  return b.finish();
}

/** The dog house, with its sign over the door toward +z. */
export function doghouseMesh(): MeshData {
  const b = new Builder();
  box(b, [0, 0.5, 0], [0.7, 0.5, 0.7], [0.6, 0.38, 0.2]);
  rotBox(b, [-0.38, 1.22, 0], [0.62, 0.05, 0.85], [0.5, 0.2, 0.15], [0, 0, 1], 0.62);
  rotBox(b, [0.38, 1.22, 0], [0.62, 0.05, 0.85], [0.5, 0.2, 0.15], [0, 0, 1], -0.62);
  quad(b, [0, 0.4, 0.705], 0.25, 0.4, DARK);
  quad(b, [0, 0.92, 0.71], 0.4, 0.25, WHITE, PART.print, PRINT.doge);
  return b.finish();
}

/** A kiddie pool. */
export function poolMesh(): MeshData {
  const b = new Builder();
  tube(b, 0, 0.35, 1.6, [0.25, 0.55, 0.9], 20, false);
  tube(b, 0.33, 0.42, 1.68, WHITE, 20, true);
  discY(b, [0, 0.28, 0], 1.55, [0.35, 0.72, 0.96], PART.plain, 0, 20);
  ellipsoid(b, [0.5, 0.42, 0.3], [0.28, 0.2, 0.32], [0.98, 0.85, 0.2], PART.plain, 10, 6);
  ellipsoid(b, [0.75, 0.6, 0.3], [0.14, 0.14, 0.14], [0.98, 0.85, 0.2], PART.plain, 8, 5);
  return b.finish();
}

/** The launch tower: a lattice with an access arm toward +x and a cabin on top. */
export function towerMesh(): MeshData {
  const b = new Builder();
  const paint: Colour = [0.85, 0.36, 0.14];
  for (const x of [-1.3, 1.3]) for (const z of [-1.3, 1.3]) box(b, [x, 8, z], [0.09, 8, 0.09], paint);
  for (let y = 2; y <= 16; y += 2) {
    for (const z of [-1.3, 1.3]) box(b, [0, y, z], [1.3, 0.05, 0.05], paint);
    for (const x of [-1.3, 1.3]) box(b, [x, y, 0], [0.05, 0.05, 1.3], paint);
  }
  box(b, [0, 16.4, 0], [1.5, 0.35, 1.5], [0.5, 0.5, 0.55]);
  box(b, [1.9, 12.8, 0], [1.0, 0.12, 0.12], paint);
  box(b, [2.6, 12.55, 0], [0.4, 0.14, 0.5], [0.5, 0.5, 0.55]);
  return b.finish();
}

/** The pad: a concrete circle with a flame trench and hold-down clamps. */
export function padMesh(): MeshData {
  const b = new Builder();
  discY(b, [0, 0.06, 0], 6, [0.62, 0.62, 0.6], PART.plain, 0, 28);
  discY(b, [0, 0.07, 0], 2.2, [0.2, 0.2, 0.2], PART.plain, 0, 20);
  for (let k = 0; k < 4; k += 1) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    box(b, [Math.cos(a) * 1.7, 0.3, Math.sin(a) * 1.7], [0.25, 0.3, 0.25], [0.35, 0.35, 0.38]);
  }
  return b.finish();
}

/** The bag, a unit tall, tied at the neck. */
export function bagMesh(): MeshData {
  const b = new Builder();
  lathe(b, [{ y: 1.05, r: 0.001 }, { y: 1.0, r: 0.12 }, { y: 0.85, r: 0.2 }, { y: 0.7, r: 0.16 }, { y: 0.55, r: 0.42 }, { y: 0.2, r: 0.5 }, { y: 0, r: 0.35 }, { y: -0.01, r: 0.001 }], 12, (_a, s) => (s.y > 0.62 && s.y < 0.78 ? [0.85, 0.75, 0.5] : [0.55, 0.38, 0.2]));
  return b.finish();
}
