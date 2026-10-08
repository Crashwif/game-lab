/**
 * Elapsed-time presentation only: no result, stake or crash prediction enters this director. `effort` dips between
 * acts, but only for the props and her glance at the door: it never lowers the scene's tension.
 */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["The stream is live", "A knock behind the music", "Who moved the handle?", "Smile. Everything is fine.", "The hallway light comes on", "Someone checks the latch", "One more suspicious pause"];
export function actAt(elapsed: number, reduced = false) {
  const seconds = Math.max(0, elapsed / 1000);
  let stage = 0; for (let i = 1; i < STARTS.length; i++) if (seconds >= STARTS[i]!) stage = i;
  const cycle = seconds >= 170 ? Math.floor((seconds - 170) / 24) : 0;
  const age = seconds >= 170 ? (seconds - 170) % 24 : seconds - STARTS[stage]!;
  if (seconds >= 170) stage = 1 + cycle % 6;
  const ramp = Math.min(1, age / 5), release = Math.max(0, 1 - Math.abs(age - 5) / 5);
  const effort = stage === 0 ? 1 : Math.min(1, .30 + .03 * stage + (1 - release) * .52);
  return { stage, age, effort, reach: reduced ? 1 : ramp * ramp * (3 - 2 * ramp), pulse: reduced ? 0 : Math.sin(age * 2.1), line: LINES[stage]! };
}
export type Act = ReturnType<typeof actAt>;
/** `alpha` fades the props out over the crash instead of cutting them. */
export function drawAct(c: CanvasRenderingContext2D, a: Act, alpha = 1): void {
  if (!a.stage || alpha <= 0) return;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = alpha;
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (a.stage >= 2) { c.fillStyle = '#ffedb0'; c.globalAlpha = alpha * (.15 + a.reach * .3); c.beginPath(); c.moveTo(437, 343); c.lineTo(558, 343); c.lineTo(589, 378); c.lineTo(415, 378); c.closePath(); c.fill(); c.globalAlpha = alpha; }
  if (a.stage === 1 || a.stage === 4 || a.stage === 6) { for (let i = 0; i < 3; i++) line(549 + i * 8, 190 - i * 7, 554 + i * 8, 209 - i * 7, '#f8dc97', 3); }
  if (a.stage >= 5) { box(450, 219, 43, 12, '#b4c6bb'); line(452, 225, 477 + a.reach * 11, 225, '#535c59', 4); }
  if (a.stage === 3) { oval(150, 356, 17, 24, '#c6aade'); oval(170, 354, 8, 10, '#c6aade'); }
  c.restore();
}
