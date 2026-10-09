/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["Steady rhythm", "The neighbour is listening", "Emergency bed repair", "A little quiet, please", "The brace starts slipping", "One more repair attempt", "The room holds its breath"];
export function actAt(elapsed: number) {
  const seconds = Math.max(0, elapsed / 1000);
  let stage = 0; for (let i = 1; i < STARTS.length; i++) if (seconds >= STARTS[i]!) stage = i;
  const cycle = seconds >= 170 ? Math.floor((seconds - 170) / 24) : 0;
  const age = seconds >= 170 ? (seconds - 170) % 24 : seconds - STARTS[stage]!;
  if (seconds >= 170) stage = 1 + cycle % 6;
  const ramp = Math.min(1, age / 5), dip = Math.max(0, 1 - Math.abs(age - 5) / 5), release = stage ? dip * dip * (3 - 2 * dip) : 0;
  // `effort` is the act's own breath, a dip mid-act before renewed activity. The scene only eases the quilt's tempo
  // a little with `release`; tension and fear never follow it down.
  const effort = stage === 0 ? 1 : Math.min(1, .30 + .03 * stage + (1 - release) * .52);
  return { stage, age, effort, release, reach: ramp * ramp * (3 - 2 * ramp), pulse: Math.sin(age * 2.1), line: LINES[stage]! };
}
export type Act = ReturnType<typeof actAt>;
/** `alpha` fades the props in at a new act and out at the finish or a cash-out instead of cutting them. */
export function drawAct(c: CanvasRenderingContext2D, a: Act, alpha = 1): void {
  if (!a.stage || alpha <= 0) return;
  c.save(); c.globalAlpha = Math.min(1, alpha); c.lineCap = 'round'; c.lineJoin = 'round';
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (a.stage === 1 || a.stage === 6) { box(15, 221, 29, 45, '#bca171'); oval(29, 243, 7, 7, a.stage === 6 ? '#cbe0b0' : '#e7c190'); line(24, 226, 34, 226, '#635848', 2); }
  if (a.stage >= 2) { line(254, 414, 254 - 20 * a.reach, 471, '#a88456', 13); line(300, 440, 254 - 20 * a.reach, 471, '#c8a277', 9); box(235, 405, 48, 16, '#bbc7c2'); }
  if (a.stage >= 4) { c.save(); c.translate(283, 438); c.rotate((a.stage === 4 ? .25 : -.1) * a.reach + a.pulse * .025); box(-20, -10, 40, 20, '#d4dace'); line(-14, 0, 14, 0, '#547875', 3); c.restore(); }
  if (a.stage === 3 || a.stage === 5) { box(706, 368, 32, 51, '#eed793'); line(709, 367, 735, 367, '#738e83', 5); oval(722, 356 - a.reach * 8, 20, 6, '#c7d4c0'); }
  c.restore();
}
