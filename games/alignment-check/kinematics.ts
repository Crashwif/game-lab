/** Presentation-only geometry; distance, not the render clock, advances a step. */
export type Joint = { x: number; y: number };
/**
 * Two-bone IK in closed form. `pole` is a signed bend strength (-1..1), not just a sign:
 * the middle joint is offset from the straight line toward the pole side by `|pole|` of the
 * full bend, so a passing pole hint blends continuously instead of flipping. Out-of-reach
 * targets are pulled to the reachable circle with a soft clamp; `end` reports the clamped
 * point, so a hand never detaches from the shoulder or snaps along the bone axis.
 */
export function solveLimb(root: Joint, target: Joint, upper: number, lower: number, pole: number): { joint: Joint; end: Joint } {
  const dx = target.x - root.x, dy = target.y - root.y;
  const distance = Math.max(1e-4, Math.hypot(dx, dy));
  const reach = Math.max(Math.abs(upper - lower) + .001, Math.min(upper + lower - .001, distance));
  // Soft clamp: only the excess beyond the reach circle is trimmed, direction preserved.
  const ux = dx / distance, uy = dy / distance;
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const half = Math.sqrt(Math.max(0, upper * upper - along * along));
  // The pole blend: -1..1, with the sign picking the side and the magnitude the share of the bend.
  const bend = half * Math.sign(pole || 1) * Math.min(1, Math.abs(pole));
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