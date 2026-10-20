/**
 * The tunnel's centre line and radius, written once as constants and
 * evaluated both here (for the swimmers, the camera and the labels) and in
 * GLSL (for the walls), so the two can never disagree. The line runs along
 * +z with small incommensurate sine wiggles in x and y: enough to feel like a
 * body, gentle enough that the egg at the far end stays in sight.
 */
import { type Vec3, cross, madd, normalize } from './math3d';

/** Each axis is a sum of sines: [amplitude, wavenumber, phase] per term. */
const WIGGLE_X: readonly [number, number, number][] = [[2.6, 0.021, 0.7], [1.2, 0.047, 2.1]];
const WIGGLE_Y: readonly [number, number, number][] = [[1.6, 0.017, 1.3], [0.8, 0.039, 0.2]];
/** The bore: a base radius with slow swells along the length. */
const RADIUS: readonly [number, number, number][] = [[0.9, 0.031, 0.4], [0.5, 0.083, 1.9]];
export const BASE_RADIUS = 6.6;
const UP: Vec3 = [0, 1, 0];

const sines = (terms: readonly [number, number, number][], s: number): number => terms.reduce((sum, [a, k, p]) => sum + a * Math.sin(s * k + p), 0);
const slopes = (terms: readonly [number, number, number][], s: number): number => terms.reduce((sum, [a, k, p]) => sum + a * k * Math.cos(s * k + p), 0);

export const pathPoint = (s: number): Vec3 => [sines(WIGGLE_X, s), sines(WIGGLE_Y, s), s];
export const pathTangent = (s: number): Vec3 => normalize([slopes(WIGGLE_X, s), slopes(WIGGLE_Y, s), 1]);
export const tunnelRadius = (s: number): number => BASE_RADIUS + sines(RADIUS, s);

export interface Frame {
  point: Vec3;
  tangent: Vec3;
  /** The cross-section's sideways axis. */
  side: Vec3;
  /** The cross-section's upward axis. */
  up: Vec3;
}

export function frameAt(s: number): Frame {
  const tangent = pathTangent(s);
  const side = normalize(cross(UP, tangent));
  return { point: pathPoint(s), tangent, side, up: cross(tangent, side) };
}

/** A point in the bore: `s` along the line, `x` and `y` across it. */
export function borePoint(s: number, x: number, y: number): Vec3 {
  const f = frameAt(s);
  return madd(madd(f.point, f.side, x), f.up, y);
}

const glslSum = (terms: readonly [number, number, number][], fn: 'sin' | 'cos', derivative: boolean): string =>
  terms.map(([a, k, p]) => `${(derivative ? a * k : a).toFixed(6)} * ${fn}(s * ${k.toFixed(6)} + ${p.toFixed(6)})`).join(' + ');

/** The same functions for the shaders. */
export const PATH_GLSL = `
vec3 pathPoint(float s) { return vec3(${glslSum(WIGGLE_X, 'sin', false)}, ${glslSum(WIGGLE_Y, 'sin', false)}, s); }
vec3 pathTangent(float s) { return normalize(vec3(${glslSum(WIGGLE_X, 'cos', true)}, ${glslSum(WIGGLE_Y, 'cos', true)}, 1.0)); }
float tunnelRadius(float s) { return ${BASE_RADIUS.toFixed(6)} + ${glslSum(RADIUS, 'sin', false)}; }
`;
