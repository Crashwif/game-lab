/** Presentation-only geometry; distance, not the render clock, advances a step. */
import { smoothstep } from './motion';

export type Joint = { x: number; y: number };
export function solveLimb(root: Joint, target: Joint, upper: number, lower: number, pole: number): { joint: Joint; end: Joint } {
  const dx = target.x - root.x, dy = target.y - root.y;
  const distance = Math.max(.0001, Math.hypot(dx, dy));
  const reach = Math.max(Math.abs(upper - lower) + .001, Math.min(upper + lower - .001, distance));
  const ux = dx / distance, uy = dy / distance;
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * (pole < 0 ? -1 : 1);
  return { joint: { x: root.x + ux * along - uy * bend, y: root.y + uy * along + ux * bend }, end: { x: root.x + ux * reach, y: root.y + uy * reach } };
}
/** During stance x cancels root travel exactly; swing returns the foot with zero endpoint velocity. */
export function stepFoot(distance: number, stride: number, offset: number, lift: number): Joint {
  const phase = ((distance / stride + offset) % 1 + 1) % 1;
  const half = stride * .58 / 2;
  if (phase < .58) return { x: half - phase * stride, y: 0 };
  const u = (phase - .58) / .42;
  return { x: -half - u * stride * .42 + stride * u * u * (3 - 2 * u), y: -lift * Math.sin(Math.PI * u) ** 2 };
}

/**
 * The first step grows out of the standing pose: each foot (starting in stance) stays planted where it stood
 * until its first swing, and the offset from the gait is only shed while that foot is in the air, so neither
 * foot skates. The first few pixels ease out of rest.
 */
export function walkingFoot(distance: number, stride: number, offset: number, lift: number): Joint {
  const start = stepFoot(0, stride, offset, lift), foot = stepFoot(distance, stride, offset, lift);
  const phase = (offset % 1 + 1) % 1, swing = Math.max(0, .58 - phase) * stride;
  const keep = 1 - smoothstep(swing, (1 - phase) * stride, distance), grip = smoothstep(0, 3, distance);
  return { x: (foot.x - start.x * keep) * grip, y: (foot.y - start.y * keep) * grip };
}
