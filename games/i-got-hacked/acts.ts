/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["The launch is going well", "The manager wants a word", "Pack the emergency case", "Just a harmless photo op", "The receipts need sorting", "The PR folder gets thicker", "Rehearse the statement again"];
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
  if (a.stage >= 2) { c.save(); c.translate(412, 192); c.rotate(a.stage === 2 ? -.12 * a.reach : 0); box(-27,-39,55,38,'#ae8464'); line(-9,-42,9,-42,'#dec19c',5); c.restore(); }
  if (a.stage >= 4) { for(let i=0;i<a.stage-2;i++){ box(293+i*3,188-i*9,40,12,'#ddd9ba');line(300+i*3,194-i*9,324+i*3,194-i*9,'#899886',2); } }
  if (a.stage === 1 || a.stage === 3 || a.stage === 6) { c.save();c.translate(374, 190);c.rotate(-.08+a.pulse*.015);box(-24,-52,48,44,a.stage===3?'#c1d2c8':'#dec5a0');line(-15,-39,15,-39,'#65766b',3);line(-15,-27,10,-27,'#65766b',3);c.restore(); }
  if (a.stage >= 5) { box(703, 384, 49, 58, '#4c6259');line(711,401,744,401,'#bacbb0',4);oval(728,427,6,4,'#d69677'); }
  c.restore();
}
