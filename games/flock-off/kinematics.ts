/**
 * Two-bone inverse kinematics, the closed form every catalog rig uses (Blanket Champ's copy): both bone
 * lengths are exact for any target, a coincident target is floored and an unreachable one straightens the
 * chain without stretching it. `pole` picks the bend side and stays fixed per limb, so an elbow never pops.
 * Draw the hand or foot at `end`, the clamped endpoint, never at the raw target.
 */
export interface Joint { x: number; y: number }

export function solveLimb(root: Joint, target: Joint, upper: number, lower: number, pole: number): { joint: Joint; end: Joint } {
  const dx = target.x - root.x, dy = target.y - root.y;
  const distance = Math.max(.0001, Math.hypot(dx, dy));
  const reach = Math.max(Math.abs(upper - lower) + .001, Math.min(upper + lower - .001, distance));
  const ux = dx / distance, uy = dy / distance;
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * (pole < 0 ? -1 : 1);
  return { joint: { x: root.x + ux * along - uy * bend, y: root.y + uy * along + ux * bend }, end: { x: root.x + ux * reach, y: root.y + uy * reach } };
}
