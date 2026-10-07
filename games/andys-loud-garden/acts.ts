/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["Just a little water", "Someone at the fence", "Support stakes going in", "Listen. Did that stop?", "Someone peers over the fence", "The tallest branch leans", "Still watching the garden"];
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
export function drawAct(c: CanvasRenderingContext2D, a: Act): void {
  if (!a.stage) return;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (a.stage === 1 || a.stage === 4 || a.stage === 6) { oval(851, 293 + (1 - a.reach) * 12, 18, 21, '#bda393'); oval(846, 288 + (1 - a.reach) * 12, 3, 4, '#25253a'); oval(857, 288 + (1 - a.reach) * 12, 3, 4, '#25253a'); box(831, 307, 40, 14, '#b97e67'); oval(831, 309, 6, 4, '#bda393'); oval(871, 309, 6, 4, '#bda393'); }
  if (a.stage >= 2) { for (const x of [468, 614]) { line(x, 449, x - 18 * (a.stage >= 5 ? a.reach : 0), 294, '#b59068', 9); line(x - 23, 341, x + 20, 341, '#ded69a', 4); } }
  if (a.stage === 3 || a.stage === 6) { c.fillStyle = '#d3e8ac'; c.globalAlpha = .25; c.beginPath(); c.ellipse(405, 355, 92 + a.reach * 20, 58, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
