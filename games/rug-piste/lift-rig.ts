/** Presentation-only boarding; preserve the skier's airborne pose before the chair collects them. */
const ease = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
/** Slope pixels the chair climbs on departure: enough to leave the top of the field while the run scrolls on. */
export const LIFT_CLIMB = 330;
export function liftPose(seconds: number, source: { jump: number; lean: number; stumble: number }) {
  const arrive = ease(seconds / .45);
  const board = ease((seconds - .15) / .55);
  const depart = ease((seconds - .9) / 1.5);
  return {
    depart,
    chairX: 75 * (1 - arrive),
    chairY: 8 + 36 * (1 - arrive) - LIFT_CLIMB * depart,
    skierY: -source.jump * 46 * (1 - board) - LIFT_CLIMB * depart,
    lean: source.lean * (1 - board),
    stumble: source.stumble * (1 - board),
    seated: board,
  };
}
