/**
 * The WebGL2 renderer: owns an offscreen canvas, the four programs, every
 * uploaded mesh and the sprite batch. The scene fills instance data and calls
 * the draw methods in order; the frame is then copied into the visible 2D
 * canvas, where the HUD is drawn on top.
 */
import { createAtlas } from './atlas';
import { ATTR, type GL, type GpuMesh, type Uniforms, createProgram, createTexture, deleteMesh, drawInstances, uniforms, uploadMesh } from './gl';
import { type Mat4, type Vec3, mat4, multiply } from './math3d';
import { beanieMesh, binMesh, condomMesh, membraneMesh, propellerMesh, rugMesh, shadesMesh, sphereMesh, swimmerMesh, tunnelGrid, vialMeshes, whaleJawMesh, whaleMesh } from './meshes';
import { BACKDROP_FS, BACKDROP_VS, LIT_FS, LIT_VS, SPRITE_FS, SPRITE_VS, TUNNEL_FS, TUNNEL_VS } from './shaders';

export const TUNNEL_SIDES = 56;
export const TUNNEL_RINGS = 170;
export const RING_SPACING = 1.25;
/** Per sprite: position and size (4), colour (4), velocity for streaks and a shape (4). */
export const SPRITE_FLOATS = 12;
export const SPRITE_CAPACITY = 900;

export interface Environment {
  fogColor: Vec3;
  /** The fog's colour looking straight at the glow (the light at the end of the tunnel). */
  fogGlow: Vec3;
  fogDensity: number;
  glowPos: Vec3;
  glowColor: Vec3;
  ambientTop: Vec3;
  ambientBottom: Vec3;
  lightPos: Vec3;
}

export interface TunnelParams {
  s0: number;
  pulse: number;
  beat: number;
  bulgeS: number;
  bulge: number;
  flash: number;
  heat: number;
  /** How far the whole bore clenches in, as a fraction of its radius. */
  squeeze: number;
}

export type Blend = 'opaque' | 'alpha' | 'additive';

const LIT_UNIFORMS = ['uViewProj', 'uTime', 'uCamera', 'uFogColor', 'uFogGlow', 'uFogDensity', 'uLightPos', 'uGlowPos', 'uGlowColor', 'uAmbientTop', 'uAmbientBottom', 'uAtlas'] as const;
const TUNNEL_UNIFORMS = ['uViewProj', 'uS0', 'uSpacing', 'uPulse', 'uBeat', 'uBulgeS', 'uBulge', 'uSqueeze', 'uCamera', 'uFogColor', 'uFogGlow', 'uFogDensity', 'uGlowPos', 'uGlowColor', 'uFlash', 'uHeat'] as const;
const SPRITE_UNIFORMS = ['uView', 'uProj', 'uFogDensity'] as const;
const BACKDROP_UNIFORMS = ['uTop', 'uBottom', 'uLamp', 'uLampPos', 'uAspect'] as const;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: GL;
  readonly view: Mat4 = mat4();
  readonly proj: Mat4 = mat4();
  readonly viewProj: Mat4 = mat4();
  readonly meshes: Record<'swimmer' | 'beanie' | 'propeller' | 'shades' | 'whale' | 'jaw' | 'sphere' | 'membrane' | 'condom' | 'bin' | 'rug' | 'vialGlass' | 'vialCap', GpuMesh>;
  readonly sprites = new Float32Array(SPRITE_CAPACITY * SPRITE_FLOATS);
  spriteCount = 0;
  private readonly lit: WebGLProgram;
  private readonly litU: Uniforms<(typeof LIT_UNIFORMS)[number]>;
  private readonly tunnel: WebGLProgram;
  private readonly tunnelU: Uniforms<(typeof TUNNEL_UNIFORMS)[number]>;
  private readonly spriteProgram: WebGLProgram;
  private readonly spriteU: Uniforms<(typeof SPRITE_UNIFORMS)[number]>;
  private readonly backdrop: WebGLProgram;
  private readonly backdropU: Uniforms<(typeof BACKDROP_UNIFORMS)[number]>;
  private readonly tunnelVao: WebGLVertexArrayObject;
  private readonly tunnelCount: number;
  private readonly spriteVao: WebGLVertexArrayObject;
  private readonly spriteBuffer: WebGLBuffer;
  private readonly emptyVao: WebGLVertexArrayObject;
  private readonly atlas: WebGLTexture;
  private readonly owned: WebGLBuffer[] = [];
  private camera: Vec3 = [0, 0, 0];
  private env: Environment | null = null;
  private time = 0;

  /**
   * Throws when WebGL2 is unavailable, so the caller can fall back to Canvas 2D. Pass the canvas of a context
   * that was lost and has been restored to upload everything again on it: its old programs and buffers are gone.
   */
  constructor(canvas: HTMLCanvasElement = document.createElement('canvas')) {
    this.canvas = canvas;
    const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    const litAttributes = { aPosition: ATTR.position, aNormal: ATTR.normal, aColor: ATTR.color, aExtra: ATTR.extra, iM0: ATTR.m0, iM1: ATTR.m1, iM2: ATTR.m2, iM3: ATTR.m3, iTint: ATTR.tint, iParams: ATTR.params, iMore: ATTR.more };
    this.lit = createProgram(gl, LIT_VS, LIT_FS, litAttributes);
    this.litU = uniforms(gl, this.lit, LIT_UNIFORMS);
    this.tunnel = createProgram(gl, TUNNEL_VS, TUNNEL_FS, { aGrid: 0 });
    this.tunnelU = uniforms(gl, this.tunnel, TUNNEL_UNIFORMS);
    this.spriteProgram = createProgram(gl, SPRITE_VS, SPRITE_FS, { aCorner: 0, iPosSize: 1, iColor: 2, iVel: 3 });
    this.spriteU = uniforms(gl, this.spriteProgram, SPRITE_UNIFORMS);
    this.backdrop = createProgram(gl, BACKDROP_VS, BACKDROP_FS, {});
    this.backdropU = uniforms(gl, this.backdrop, BACKDROP_UNIFORMS);

    const [vialGlass, vialCap] = vialMeshes();
    this.meshes = {
      swimmer: uploadMesh(gl, swimmerMesh(), 320),
      beanie: uploadMesh(gl, beanieMesh(), 2),
      propeller: uploadMesh(gl, propellerMesh(), 2),
      shades: uploadMesh(gl, shadesMesh(), 2),
      whale: uploadMesh(gl, whaleMesh(), 1),
      jaw: uploadMesh(gl, whaleJawMesh(), 1),
      sphere: uploadMesh(gl, sphereMesh(), 24),
      membrane: uploadMesh(gl, membraneMesh(), 1),
      condom: uploadMesh(gl, condomMesh(), 1),
      bin: uploadMesh(gl, binMesh(), 1),
      rug: uploadMesh(gl, rugMesh(), 1),
      vialGlass: uploadMesh(gl, vialGlass, 1),
      vialCap: uploadMesh(gl, vialCap, 1),
    };

    const { grid, indices } = tunnelGrid(TUNNEL_SIDES, TUNNEL_RINGS);
    this.tunnelVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.tunnelVao);
    this.owned.push(this.buffer(gl.ARRAY_BUFFER, grid));
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.owned.push(this.buffer(gl.ELEMENT_ARRAY_BUFFER, indices));
    this.tunnelCount = indices.length;

    this.spriteVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.spriteVao);
    this.owned.push(this.buffer(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])));
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.spriteBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.sprites.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 3; i += 1) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, SPRITE_FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);
    this.atlas = createTexture(gl, createAtlas());
  }

  private buffer(target: number, data: ArrayBufferView): WebGLBuffer {
    const buffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(target, buffer);
    this.gl.bufferData(target, data, this.gl.STATIC_DRAW);
    return buffer;
  }

  get lost(): boolean { return this.gl.isContextLost(); }

  resize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /** Starts a frame: sets the camera matrices and the lighting, clears to the fog colour. */
  begin(view: Mat4, proj: Mat4, camera: Vec3, env: Environment, time: number): void {
    const gl = this.gl;
    this.view.set(view);
    this.proj.set(proj);
    multiply(this.viewProj, proj, view);
    this.camera = camera;
    this.env = env;
    this.time = time;
    this.spriteCount = 0;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }

  private blend(mode: Blend, depthWrite: boolean): void {
    const gl = this.gl;
    if (mode === 'opaque') gl.disable(gl.BLEND);
    else {
      gl.enable(gl.BLEND);
      if (mode === 'additive') gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.depthMask(depthWrite);
  }

  private cull(face: 'back' | 'front' | 'none'): void {
    const gl = this.gl;
    if (face === 'none') gl.disable(gl.CULL_FACE);
    else {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(face === 'back' ? gl.BACK : gl.FRONT);
    }
  }

  drawBackdrop(top: Vec3, bottom: Vec3, lamp: Vec3, lampPos: [number, number]): void {
    const gl = this.gl;
    this.blend('opaque', false);
    this.cull('none');
    gl.useProgram(this.backdrop);
    gl.uniform3fv(this.backdropU.uTop, top);
    gl.uniform3fv(this.backdropU.uBottom, bottom);
    gl.uniform3fv(this.backdropU.uLamp, lamp);
    gl.uniform2fv(this.backdropU.uLampPos, lampPos);
    gl.uniform1f(this.backdropU.uAspect, this.canvas.width / Math.max(1, this.canvas.height));
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
  }

  drawTunnel(params: TunnelParams): void {
    const gl = this.gl;
    const env = this.env!;
    const u = this.tunnelU;
    this.blend('opaque', true);
    this.cull('none');
    gl.useProgram(this.tunnel);
    gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj);
    gl.uniform1f(u.uS0, params.s0);
    gl.uniform1f(u.uSpacing, RING_SPACING);
    gl.uniform1f(u.uPulse, params.pulse);
    gl.uniform1f(u.uBeat, params.beat);
    gl.uniform1f(u.uBulgeS, params.bulgeS);
    gl.uniform1f(u.uBulge, params.bulge);
    gl.uniform1f(u.uSqueeze, params.squeeze);
    gl.uniform3fv(u.uCamera, this.camera);
    gl.uniform3fv(u.uFogColor, env.fogColor);
    gl.uniform3fv(u.uFogGlow, env.fogGlow);
    gl.uniform1f(u.uFogDensity, env.fogDensity);
    gl.uniform3fv(u.uGlowPos, env.glowPos);
    gl.uniform3fv(u.uGlowColor, env.glowColor);
    gl.uniform1f(u.uFlash, params.flash);
    gl.uniform1f(u.uHeat, params.heat);
    gl.bindVertexArray(this.tunnelVao);
    gl.drawElements(gl.TRIANGLES, this.tunnelCount, gl.UNSIGNED_INT, 0);
  }

  /** Draws `count` instances of a mesh with the lit program. */
  drawLit(mesh: GpuMesh, count: number, blend: Blend = 'opaque', cull: 'back' | 'front' | 'none' = 'back'): void {
    if (count <= 0) return;
    const gl = this.gl;
    const env = this.env!;
    const u = this.litU;
    this.blend(blend, blend === 'opaque');
    this.cull(cull);
    gl.useProgram(this.lit);
    gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform3fv(u.uCamera, this.camera);
    gl.uniform3fv(u.uFogColor, env.fogColor);
    gl.uniform3fv(u.uFogGlow, env.fogGlow);
    gl.uniform1f(u.uFogDensity, env.fogDensity);
    gl.uniform3fv(u.uLightPos, env.lightPos);
    gl.uniform3fv(u.uGlowPos, env.glowPos);
    gl.uniform3fv(u.uGlowColor, env.glowColor);
    gl.uniform3fv(u.uAmbientTop, env.ambientTop);
    gl.uniform3fv(u.uAmbientBottom, env.ambientBottom);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(u.uAtlas, 0);
    drawInstances(gl, mesh, count);
  }

  /** Queues a billboard: shape 0 is a soft dot, 1 a ring, 2 a glow; a velocity stretches it into a streak. */
  sprite(position: Vec3, size: number, colour: [number, number, number, number], shape = 0, velocity: Vec3 = [0, 0, 0]): void {
    if (this.spriteCount >= SPRITE_CAPACITY) return;
    const o = this.spriteCount * SPRITE_FLOATS;
    const s = this.sprites;
    s[o] = position[0]; s[o + 1] = position[1]; s[o + 2] = position[2]; s[o + 3] = size;
    s[o + 4] = colour[0]; s[o + 5] = colour[1]; s[o + 6] = colour[2]; s[o + 7] = colour[3];
    s[o + 8] = velocity[0]; s[o + 9] = velocity[1]; s[o + 10] = velocity[2]; s[o + 11] = shape;
    this.spriteCount += 1;
  }

  /** Draws and empties the queued sprites. */
  flushSprites(blend: Blend = 'additive', fogDensity = this.env?.fogDensity ?? 0): void {
    const n = this.spriteCount;
    this.spriteCount = 0;
    if (n === 0) return;
    const gl = this.gl;
    this.blend(blend === 'opaque' ? 'alpha' : blend, false);
    if (blend === 'alpha') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.cull('none');
    gl.useProgram(this.spriteProgram);
    gl.uniformMatrix4fv(this.spriteU.uView, false, this.view);
    gl.uniformMatrix4fv(this.spriteU.uProj, false, this.proj);
    gl.uniform1f(this.spriteU.uFogDensity, fogDensity);
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sprites, 0, n * SPRITE_FLOATS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
  }

  /** Leaves the GL state tidy at the end of a frame. */
  end(): void {
    const gl = this.gl;
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const mesh of Object.values(this.meshes)) deleteMesh(gl, mesh);
    for (const buffer of this.owned) gl.deleteBuffer(buffer);
    gl.deleteBuffer(this.spriteBuffer);
    gl.deleteVertexArray(this.tunnelVao);
    gl.deleteVertexArray(this.spriteVao);
    gl.deleteVertexArray(this.emptyVao);
    gl.deleteTexture(this.atlas);
    for (const program of [this.lit, this.tunnel, this.spriteProgram, this.backdrop]) gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
