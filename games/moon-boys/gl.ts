/**
 * Thin WebGL2 plumbing: programs, meshes with a per-instance buffer, and
 * textures. Every instanced mesh shares one vertex layout (ATTR) so the lit
 * program can draw any of them.
 */
import type { MeshData } from './meshes';

export type GL = WebGL2RenderingContext;

/** Attribute locations shared by the lit program and every mesh uploaded for it. */
export const ATTR = { position: 0, normal: 1, color: 2, extra: 3, m0: 4, m1: 5, m2: 6, m3: 7, tint: 8, params: 9, more: 10 } as const;
/** Per instance: a model matrix (16), a tint (4), params (4) and more params (4). */
export const INSTANCE_FLOATS = 28;

export interface GpuMesh {
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  instanceBuffer: WebGLBuffer;
  /** Filled by the caller each frame, INSTANCE_FLOATS per instance. */
  instances: Float32Array;
  capacity: number;
  count: number;
  indexType: number;
}

function compile(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log}`);
  }
  return shader;
}

export function createProgram(gl: GL, vertex: string, fragment: string, attributes: Record<string, number>): WebGLProgram {
  const program = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  for (const [name, location] of Object.entries(attributes)) gl.bindAttribLocation(program, location, name);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`Program failed to link: ${gl.getProgramInfoLog(program)}`);
  return program;
}

export type Uniforms<K extends string> = Record<K, WebGLUniformLocation | null>;

export function uniforms<K extends string>(gl: GL, program: WebGLProgram, names: readonly K[]): Uniforms<K> {
  const out = {} as Uniforms<K>;
  for (const name of names) out[name] = gl.getUniformLocation(program, name);
  return out;
}

function staticBuffer(gl: GL, target: number, data: ArrayBufferView): WebGLBuffer {
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
}

/** Uploads a mesh and gives it room for `capacity` instances. */
export function uploadMesh(gl: GL, mesh: MeshData, capacity: number): GpuMesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  const attribute = (location: number, data: Float32Array, size: number) => {
    buffers.push(staticBuffer(gl, gl.ARRAY_BUFFER, data));
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  };
  attribute(ATTR.position, mesh.positions, 3);
  attribute(ATTR.normal, mesh.normals, 3);
  attribute(ATTR.color, mesh.colors, 3);
  attribute(ATTR.extra, mesh.extras, 4);
  buffers.push(staticBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, mesh.indices));
  const instances = new Float32Array(capacity * INSTANCE_FLOATS);
  const instanceBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW);
  const stride = INSTANCE_FLOATS * 4;
  const locations = [ATTR.m0, ATTR.m1, ATTR.m2, ATTR.m3, ATTR.tint, ATTR.params, ATTR.more];
  locations.forEach((location, i) => {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 4, gl.FLOAT, false, stride, i * 16);
    gl.vertexAttribDivisor(location, 1);
  });
  gl.bindVertexArray(null);
  return { vao, buffers, instanceBuffer, instances, capacity, count: mesh.indices.length, indexType: mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
}

/** Draws the first `count` instances the caller wrote into `mesh.instances`. */
export function drawInstances(gl: GL, mesh: GpuMesh, count: number): void {
  const n = Math.min(count, mesh.capacity);
  if (n <= 0) return;
  gl.bindVertexArray(mesh.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.instanceBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.instances, 0, n * INSTANCE_FLOATS);
  gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, mesh.indexType, 0, n);
}

/**
 * Writes one instance: a model matrix from a position and three scaled axes,
 * then the tint (rgb, alpha), params (face cell or -1, emissive, flex, spare)
 * and more (material, spare, spare, spare). Returns the next index.
 */
export function putInstance(mesh: GpuMesh, index: number, position: readonly number[], x: readonly number[], y: readonly number[], z: readonly number[], scale: readonly [number, number, number], tint: readonly number[] = [1, 1, 1, 1], params: readonly number[] = [-1, 0, 0, 0], more: readonly number[] = [0, 0, 0, 0]): number {
  if (index >= mesh.capacity) return index;
  const o = index * INSTANCE_FLOATS;
  const d = mesh.instances;
  for (let k = 0; k < 3; k += 1) {
    d[o + k] = x[k]! * scale[0];
    d[o + 4 + k] = y[k]! * scale[1];
    d[o + 8 + k] = z[k]! * scale[2];
    d[o + 12 + k] = position[k]!;
  }
  d[o + 3] = 0; d[o + 7] = 0; d[o + 11] = 0; d[o + 15] = 1;
  for (let k = 0; k < 4; k += 1) {
    d[o + 16 + k] = tint[k]!;
    d[o + 20 + k] = params[k]!;
    d[o + 24 + k] = more[k]!;
  }
  return index + 1;
}

export function deleteMesh(gl: GL, mesh: GpuMesh): void {
  gl.deleteVertexArray(mesh.vao);
  for (const buffer of mesh.buffers) gl.deleteBuffer(buffer);
  gl.deleteBuffer(mesh.instanceBuffer);
}

export function createTexture(gl: GL, source: HTMLCanvasElement): WebGLTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}
