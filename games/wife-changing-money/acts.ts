/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["Keep the keyboard quiet", "A light under the door", "The cat finds the alarm", "Nobody move", "The stair light comes on", "A mug starts to slide", "Listen before typing"];
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
  if (a.stage === 1 || a.stage >= 4) { c.globalAlpha = a.stage === 6 ? .12 : .23 + a.reach * .25; c.fillStyle = '#ffe6ac'; c.beginPath(); c.moveTo(823, 177); c.lineTo(866, 157); c.lineTo(909, 443); c.lineTo(722, 451); c.closePath(); c.fill(); c.globalAlpha = 1; }
  if (a.stage === 2 || a.stage === 3) { box(549, 410, 48, 24, '#ddc38c'); oval(559, 411, 7, 7, '#4a465e'); oval(584, 411, 7, 7, '#4a465e'); line(573, 414, 573 + a.pulse * 7, 423, '#eed8bb', 2); }
  if (a.stage >= 5) { c.save(); c.translate(620 + a.reach * 18, 419); c.rotate(a.stage === 5 ? a.pulse * .045 : 0); box(-11, -26, 24, 27, '#d6dfc8'); oval(17, -14, 7, 8, '#2b2631'); c.restore(); }
  c.restore();
}
