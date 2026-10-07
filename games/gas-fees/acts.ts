/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["One floor at a time", "Try the ventilation", "The wall fan wakes up", "A moment of fresh air", "The vent is rattling", "Try the emergency button", "Everyone holds their breath"];
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
  box(239, 190, 114, 22, '#adc2bb');
  for (let i = 0; i < 6; i++) line(252 + i * 17, 195, 254 + i * 17 + (a.stage === 4 ? a.pulse * 3 : 0), 207, '#304746', 3);
  if (a.stage <= 3) { c.strokeStyle = '#bdf6db'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(266 + i * 23, 214); c.bezierCurveTo(237 + i * 24, 222, 306 + i * 13, 232, 262 + i * 28, 251 + a.reach * 12); c.stroke(); } }
  if (a.stage >= 2) { line(251, 230, 251, 280, '#8b9b91', 5); c.save(); c.translate(251, 250); oval(0, 0, 22, 22, '#d7ddc9'); c.rotate(a.pulse * 2.7); for (let i=0;i<4;i++) { c.rotate(Math.PI / 2); oval(0, -11, 5, 10, '#779a96'); } oval(0, 0, 5, 5, '#506c69'); c.restore(); }
  if (a.stage >= 5) { oval(707, 210, 14, 14, a.stage === 6 ? '#85c9a9' : '#e2ad6a'); line(697, 210, 717, 210, '#5d534b', 3); }
  c.restore();
}
