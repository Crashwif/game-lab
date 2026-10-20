/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["Dinner is served", "Time for a cup of tea", "A second casserole", "Let everyone take a breath", "Someone reaches for dessert", "The kettle needs attention", "Try changing the subject"];
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
/** `alpha` fades the props in at a new act and out at the crash or a cash-out. */
export function drawAct(c: CanvasRenderingContext2D, a: Act, alpha = 1): void {
  if (!a.stage || alpha <= 0) return;
  c.save(); c.globalAlpha = alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (a.stage === 1 || a.stage >= 4) {
    c.save(); c.translate(458, 337); c.rotate(a.stage === 1 ? -.18 * a.reach : 0); oval(0, -15, 21, 21, '#c9ddda'); box(-9,-41,18,7,'#dce9d6'); line(15,-18,36,-30,'#c9ddda',10); oval(-24,-17,9,12,'#c9ddda');
    // The act's breather is the props' moment: the pot steams while everyone takes a breath. It never cools the table.
    const calm = Math.max(0, Math.min(1, (1 - a.effort) / .5));
    if (calm > 0) { c.globalAlpha = alpha * calm * .8; for (const dx of [-6, 6]) line(dx, -50, dx + 4 * a.pulse, -70, '#ffffff', 3); }
    c.restore();
  }
  if (a.stage >= 2) { box(497, 311, 69, 30, '#c98557'); oval(531, 311 - (a.stage === 2 ? a.reach * 10 : 0), 40, 7, '#dae0ca'); }
  if (a.stage === 3 || a.stage === 6) { for (const x of [406, 582]) { oval(x, 353, 16, 5, '#d8d5b9'); box(x-10,332,20,20,'#e9e5d0'); } }
  if (a.stage >= 4) { oval(484, 363, 28, 7, '#dadcbf'); c.fillStyle = '#c6a364'; c.beginPath(); c.moveTo(464,361); c.lineTo(503,361); c.lineTo(482,345); c.closePath(); c.fill(); }
  c.restore();
}
