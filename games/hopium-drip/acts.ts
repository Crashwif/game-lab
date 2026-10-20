/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["Checking the chart", "Fresh supplies arrive", "The cuff needs adjusting", "A slower breath", "Another tray is needed", "Check the bag and tubing", "A cautious reassessment"];
export function actAt(elapsed: number) {
  const seconds = Math.max(0, elapsed / 1000);
  let stage = 0; for (let i = 1; i < STARTS.length; i++) if (seconds >= STARTS[i]!) stage = i;
  const cycle = seconds >= 170 ? Math.floor((seconds - 170) / 24) : 0;
  const age = seconds >= 170 ? (seconds - 170) % 24 : seconds - STARTS[stage]!;
  if (seconds >= 170) stage = 1 + cycle % 6;
  const ramp = Math.min(1, age / 5), release = Math.max(0, 1 - Math.abs(age - 5) / 5);
  const effort = stage === 0 ? 1 : Math.min(1, .30 + .03 * stage + (1 - release) * .52);
  return { stage, age, effort, reach: ramp * ramp * (3 - 2 * ramp), pulse: Math.sin(age * 2.1), line: LINES[stage]! };
}
export type Act = ReturnType<typeof actAt>;
export function drawAct(c: CanvasRenderingContext2D, a: Act): void {
  if (!a.stage) return;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (a.stage === 1 || a.stage === 4) { box(425, 402, 66, 14, '#bdced0'); for (let i=0;i<4;i++) { box(433+i*13,375-a.reach*5,9,26,'#c3ebdb'); box(433+i*13,372-a.reach*5,9,7,'#ece2af'); } }
  if (a.stage === 2 || a.stage >= 5) { box(398, 241, 51, 33, '#3f6259'); oval(424, 257, 12, 12, '#f1e5c6'); line(424,257,430,247+a.pulse*3,'#4e6761',2); c.strokeStyle='#708f85';c.lineWidth=3;c.beginPath();c.moveTo(403,270);c.quadraticCurveTo(360,306,378,336);c.stroke(); }
  if (a.stage === 3 || a.stage === 6) { c.strokeStyle = '#b2d8cd';c.lineWidth=3; for(let i=0;i<3;i++){c.beginPath();c.arc(381,244,13+i*8,-.7,.7);c.stroke();} }
  c.restore();
}
