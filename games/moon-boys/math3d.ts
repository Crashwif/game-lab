/**
 * The little linear algebra the renderer needs: three-component vectors as
 * tuples and column-major 4 × 4 matrices in Float32Arrays, laid out the way
 * WebGL uploads them.
 */

export type Vec3 = [number, number, number];
export type Mat4 = Float32Array;

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
/** `a + b × k`, the step every placement in the scene is made of. */
export const madd = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function normalize(a: Vec3): Vec3 {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Rotates `v` about the unit axis `k` by `angle` radians (Rodrigues). */
export function rotateAbout(v: Vec3, k: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
}

export const mat4 = (): Mat4 => new Float32Array(16);

export function perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/** A view matrix at `eye` looking at `target`; `up` need not be orthogonal to the view direction. */
export function lookAt(out: Mat4, eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
  out[12] = -dot(x, eye); out[13] = -dot(y, eye); out[14] = -dot(z, eye); out[15] = 1;
  return out;
}

export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row]! * b[c * 4 + k]!;
      r[c * 4 + row] = sum;
    }
  }
  out.set(r);
  return out;
}

/**
 * Writes a model matrix into `out` at `offset` from a position and three axes
 * (the model's x, y and z in world space) with a scale along each.
 */
export function writeBasis(out: Float32Array, offset: number, position: Vec3, x: Vec3, y: Vec3, z: Vec3, sx: number, sy: number, sz: number): void {
  out[offset] = x[0] * sx; out[offset + 1] = x[1] * sx; out[offset + 2] = x[2] * sx; out[offset + 3] = 0;
  out[offset + 4] = y[0] * sy; out[offset + 5] = y[1] * sy; out[offset + 6] = y[2] * sy; out[offset + 7] = 0;
  out[offset + 8] = z[0] * sz; out[offset + 9] = z[1] * sz; out[offset + 10] = z[2] * sz; out[offset + 11] = 0;
  out[offset + 12] = position[0]; out[offset + 13] = position[1]; out[offset + 14] = position[2]; out[offset + 15] = 1;
}

/** An orthonormal basis whose z is `forward`, rolled `roll` radians about it. */
export function basisFrom(forward: Vec3, up: Vec3 = [0, 1, 0], roll = 0): [Vec3, Vec3, Vec3] {
  const z = normalize(forward);
  let x = cross(up, z);
  if (length(x) < 1e-4) x = cross([1, 0, 0], z);
  x = normalize(x);
  let y = cross(z, x);
  if (roll !== 0) {
    x = rotateAbout(x, z, roll);
    y = rotateAbout(y, z, roll);
  }
  return [x, y, z];
}

/** Projects a world point through a view-projection matrix to logical screen pixels; null behind the camera. */
export function projectToScreen(viewProj: Mat4, p: Vec3, width: number, height: number): { x: number; y: number; depth: number } | null {
  const x = viewProj[0]! * p[0] + viewProj[4]! * p[1] + viewProj[8]! * p[2] + viewProj[12]!;
  const y = viewProj[1]! * p[0] + viewProj[5]! * p[1] + viewProj[9]! * p[2] + viewProj[13]!;
  const w = viewProj[3]! * p[0] + viewProj[7]! * p[1] + viewProj[11]! * p[2] + viewProj[15]!;
  if (w <= 0.05) return null;
  return { x: (x / w * 0.5 + 0.5) * width, y: (0.5 - y / w * 0.5) * height, depth: w };
}
