/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["Welcome to the stream", "A clamp needs tightening", "A fresh sponsor. Obviously.", "Reset the studio smile", "The backdrop comes loose", "The cable needs attention", "One more perfect take"];
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
  if (a.stage >= 1) { line(511, 16, 511, 337, '#596874', 9); box(492, 25, 38, 17, '#a3b4b0'); }
  if (a.stage >= 2) { c.save(); c.translate(470, 95); c.rotate((a.stage >= 4 ? .16 : -.02) * a.reach); box(-48, -34, 96, 68, '#365c4f'); line(-30, -13, 31, -13, '#d1e4a0', 5); line(-30, 6, 18, 6, '#d1e4a0', 5); c.restore(); }
  if (a.stage >= 4) { c.strokeStyle = '#222f38'; c.lineWidth = 5; c.beginPath(); c.moveTo(509, 70); c.quadraticCurveTo(581, 170 + a.reach * 70, 505, 314); c.stroke(); }
  if (a.stage >= 5) { box(429, 327, 61, 22, '#d6c693'); oval(442, 338, 5, 5, a.stage === 6 ? '#83cda8' : '#de9279'); }
  if (a.stage === 3 || a.stage === 6) { oval(508, 14, 10, 10, '#b8df92'); }
  c.restore();
}
