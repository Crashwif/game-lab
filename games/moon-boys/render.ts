/**
 * The WebGL2 renderer: owns an offscreen canvas, the three programs, every
 * uploaded mesh and the sprite batch. The scene fills instance data and calls
 * the draw methods in order; the frame is then copied into the visible 2D
 * canvas, where the HUD is drawn on top.
 */
import { createAtlas } from './atlas';
import { ATTR, type GL, type GpuMesh, type Uniforms, createProgram, createTexture, deleteMesh, drawInstances, uniforms, uploadMesh } from './gl';
import { type Mat4, type Vec3, mat4, multiply } from './math3d';
import { astronautMesh, bagMesh, birdMesh, boosterMesh, boxMesh, capsuleMesh, cartMesh, chairMesh, chuteMesh, clapperMesh, coneMesh, coreMesh, discMesh, dishMesh, doghouseMesh, earthPlateMesh, flagMesh, gloveMesh, lampMesh, lizardMesh, micMesh, moonPlateMesh, noseMesh, padMesh, poolMesh, portholeMesh, sphereMesh, stickMesh, stickerMesh, towerMesh, trailerMesh, upperMesh, wingMesh } from './meshes';
import { LIT_FS, LIT_VS, SKY_FS, SKY_VS, SPRITE_FS, SPRITE_VS } from './shaders';

/** Per sprite: position and size (4), colour (4), velocity for streaks and a shape (4). */
export const SPRITE_FLOATS = 12;
export const SPRITE_CAPACITY = 1400;

export interface Environment {
  fogColor: Vec3;
  fogDensity: number;
  sunDir: Vec3;
  sunColor: Vec3;
  ambientTop: Vec3;
  ambientBottom: Vec3;
  /** A point light: the exhaust under the rocket, the key light in the studio. */
  pointPos: Vec3;
  pointColor: Vec3;
  /** Added to every colour: the white-out. */
  flash: number;
}

export interface Sky {
  /** 0 at the ground (blue), 1 in space (black, stars). */
  space: number;
  /** 1 for the studio's walls. */
  studio: number;
}

export type Blend = 'opaque' | 'alpha' | 'additive';
export type Cull = 'back' | 'front' | 'none';

const LIT_UNIFORMS = ['uViewProj', 'uTime', 'uCamera', 'uFogColor', 'uFogDensity', 'uSunDir', 'uSunColor', 'uAmbientTop', 'uAmbientBottom', 'uPointPos', 'uPointColor', 'uFlash', 'uAtlas'] as const;
const SPRITE_UNIFORMS = ['uView', 'uProj', 'uFogDensity'] as const;
const SKY_UNIFORMS = ['uRight', 'uUp', 'uForward', 'uTanHalf', 'uAspect', 'uSpace', 'uSunDir', 'uTime', 'uStudio', 'uFlash'] as const;

export type MeshName = 'booster' | 'core' | 'upper' | 'capsule' | 'nose' | 'porthole' | 'sticker' | 'cling' | 'flail' | 'stand' | 'hero' | 'chute' | 'earth' | 'moon' | 'disc' | 'box' | 'sphere' | 'cone' | 'mic' | 'glove' | 'bird' | 'wing' | 'lizard' | 'cart' | 'clapper' | 'stick' | 'lamp' | 'chair' | 'flag' | 'dish' | 'trailer' | 'doghouse' | 'pool' | 'tower' | 'pad' | 'bag';

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: GL;
  readonly view: Mat4 = mat4();
  readonly proj: Mat4 = mat4();
  readonly viewProj: Mat4 = mat4();
  readonly meshes: Record<MeshName, GpuMesh>;
  readonly sprites = new Float32Array(SPRITE_CAPACITY * SPRITE_FLOATS);
  spriteCount = 0;
  private readonly lit: WebGLProgram;
  private readonly litU: Uniforms<(typeof LIT_UNIFORMS)[number]>;
  private readonly spriteProgram: WebGLProgram;
  private readonly spriteU: Uniforms<(typeof SPRITE_UNIFORMS)[number]>;
  private readonly sky: WebGLProgram;
  private readonly skyU: Uniforms<(typeof SKY_UNIFORMS)[number]>;
  private readonly spriteVao: WebGLVertexArrayObject;
  private readonly spriteBuffer: WebGLBuffer;
  private readonly cornerBuffer: WebGLBuffer;
  private readonly emptyVao: WebGLVertexArrayObject;
  private readonly atlas: WebGLTexture;
  private camera: Vec3 = [0, 0, 0];
  private env: Environment | null = null;
  private time = 0;
  private tanHalf = 1;

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
    this.spriteProgram = createProgram(gl, SPRITE_VS, SPRITE_FS, { aCorner: 0, iPosSize: 1, iColor: 2, iVel: 3 });
    this.spriteU = uniforms(gl, this.spriteProgram, SPRITE_UNIFORMS);
    this.sky = createProgram(gl, SKY_VS, SKY_FS, {});
    this.skyU = uniforms(gl, this.sky, SKY_UNIFORMS);

    this.meshes = {
      booster: uploadMesh(gl, boosterMesh(), 4),
      core: uploadMesh(gl, coreMesh(), 1),
      upper: uploadMesh(gl, upperMesh(), 1),
      capsule: uploadMesh(gl, capsuleMesh(), 1),
      nose: uploadMesh(gl, noseMesh(), 1),
      porthole: uploadMesh(gl, portholeMesh(), 3),
      sticker: uploadMesh(gl, stickerMesh(), 48),
      cling: uploadMesh(gl, astronautMesh('cling'), 160),
      flail: uploadMesh(gl, astronautMesh('flail'), 200),
      stand: uploadMesh(gl, astronautMesh('stand'), 24),
      hero: uploadMesh(gl, astronautMesh('torso'), 1),
      chute: uploadMesh(gl, chuteMesh(), 2),
      earth: uploadMesh(gl, earthPlateMesh(), 1),
      moon: uploadMesh(gl, moonPlateMesh(), 1),
      disc: uploadMesh(gl, discMesh(), 64),
      box: uploadMesh(gl, boxMesh(), 700),
      sphere: uploadMesh(gl, sphereMesh(), 40),
      cone: uploadMesh(gl, coneMesh(), 16),
      mic: uploadMesh(gl, micMesh(), 1),
      glove: uploadMesh(gl, gloveMesh(), 1),
      bird: uploadMesh(gl, birdMesh(), 2),
      wing: uploadMesh(gl, wingMesh(), 4),
      lizard: uploadMesh(gl, lizardMesh(), 1),
      cart: uploadMesh(gl, cartMesh(), 1),
      clapper: uploadMesh(gl, clapperMesh(), 1),
      stick: uploadMesh(gl, stickMesh(), 1),
      lamp: uploadMesh(gl, lampMesh(), 6),
      chair: uploadMesh(gl, chairMesh(), 1),
      flag: uploadMesh(gl, flagMesh(), 2),
      dish: uploadMesh(gl, dishMesh(), 1),
      trailer: uploadMesh(gl, trailerMesh(), 1),
      doghouse: uploadMesh(gl, doghouseMesh(), 1),
      pool: uploadMesh(gl, poolMesh(), 1),
      tower: uploadMesh(gl, towerMesh(), 1),
      pad: uploadMesh(gl, padMesh(), 1),
      bag: uploadMesh(gl, bagMesh(), 3),
    };

    this.spriteVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.spriteVao);
    this.cornerBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
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

  get lost(): boolean { return this.gl.isContextLost(); }

  resize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /** Starts a frame: sets the camera matrices and the lighting, clears. `fovy` is the vertical field of view in radians. */
  begin(view: Mat4, proj: Mat4, camera: Vec3, env: Environment, time: number, fovy: number): void {
    const gl = this.gl;
    this.view.set(view);
    this.proj.set(proj);
    multiply(this.viewProj, proj, view);
    this.camera = camera;
    this.env = env;
    this.time = time;
    this.tanHalf = Math.tan(fovy / 2);
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

  private cull(face: Cull): void {
    const gl = this.gl;
    if (face === 'none') gl.disable(gl.CULL_FACE);
    else {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(face === 'back' ? gl.BACK : gl.FRONT);
    }
  }

  /** The sky behind everything: drawn at the far plane, so it goes first with depth writes off. */
  drawSky(sky: Sky): void {
    const gl = this.gl;
    const env = this.env!;
    const v = this.view;
    this.blend('opaque', false);
    this.cull('none');
    gl.useProgram(this.sky);
    gl.uniform3f(this.skyU.uRight, v[0]!, v[4]!, v[8]!);
    gl.uniform3f(this.skyU.uUp, v[1]!, v[5]!, v[9]!);
    gl.uniform3f(this.skyU.uForward, -v[2]!, -v[6]!, -v[10]!);
    gl.uniform1f(this.skyU.uTanHalf, this.tanHalf);
    gl.uniform1f(this.skyU.uAspect, this.canvas.width / Math.max(1, this.canvas.height));
    gl.uniform1f(this.skyU.uSpace, sky.space);
    gl.uniform3fv(this.skyU.uSunDir, env.sunDir);
    gl.uniform1f(this.skyU.uTime, this.time);
    gl.uniform1f(this.skyU.uStudio, sky.studio);
    gl.uniform1f(this.skyU.uFlash, env.flash);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
  }

  /** Draws `count` instances of a mesh with the lit program. */
  drawLit(mesh: GpuMesh, count: number, blend: Blend = 'opaque', cull: Cull = 'back'): void {
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
    gl.uniform1f(u.uFogDensity, env.fogDensity);
    gl.uniform3fv(u.uSunDir, env.sunDir);
    gl.uniform3fv(u.uSunColor, env.sunColor);
    gl.uniform3fv(u.uAmbientTop, env.ambientTop);
    gl.uniform3fv(u.uAmbientBottom, env.ambientBottom);
    gl.uniform3fv(u.uPointPos, env.pointPos);
    gl.uniform3fv(u.uPointColor, env.pointColor);
    gl.uniform1f(u.uFlash, env.flash);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(u.uAtlas, 0);
    drawInstances(gl, mesh, count);
  }

  /** Queues a billboard: shape 0 is a soft dot, 1 a ring, 2 a glow, 3 a hard disc; a velocity stretches it into a streak. */
  sprite(position: Vec3, size: number, colour: readonly [number, number, number, number], shape = 0, velocity: Vec3 = [0, 0, 0]): void {
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
    gl.deleteBuffer(this.spriteBuffer);
    gl.deleteBuffer(this.cornerBuffer);
    gl.deleteVertexArray(this.spriteVao);
    gl.deleteVertexArray(this.emptyVao);
    gl.deleteTexture(this.atlas);
    for (const program of [this.lit, this.spriteProgram, this.sky]) gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
