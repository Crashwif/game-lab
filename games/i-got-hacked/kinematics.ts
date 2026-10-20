/** Presentation-only geometry; distance, not the render clock, advances a step. */
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

/** The first step grows out of the standing pose instead of exposing an arbitrary gait phase. */
export function walkingFoot(distance: number, stride: number, offset: number, lift: number): Joint {
  const foot = stepFoot(distance, stride, offset, lift);
  const u = Math.min(1, Math.max(0, distance / 26)), weight = u * u * (3 - 2 * u);
  return { x: foot.x * weight, y: foot.y * weight };
}
