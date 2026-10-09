/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["The launch is going well", "The manager wants a word", "Pack the emergency case", "Just a harmless photo op", "The receipts need sorting", "The PR folder gets thicker", "Rehearse the statement again"];
export function actAt(elapsed: number) {
  const seconds = Math.max(0, elapsed / 1000);
  let stage = 0; for (let i = 1; i < STARTS.length; i++) if (seconds >= STARTS[i]!) stage = i;
  const cycle = seconds >= 170 ? Math.floor((seconds - 170) / 24) : 0;
  const age = seconds >= 170 ? (seconds - 170) % 24 : seconds - STARTS[stage]!;
  if (seconds >= 170) stage = 1 + cycle % 6;
  // The props of the act before, so a prop that comes or goes fades over `fresh` instead of popping.
  const prev = stage === 1 ? (seconds >= 170 ? 6 : 0) : Math.max(0, stage - 1);
  const ramp = Math.min(1, age / 5), release = Math.max(0, 1 - Math.abs(age - 5) / 5), calm = release * release * (3 - 2 * release);
  // Effort only moves the props (a calm beat mid-act, then renewed fuss); it never touches the round's tension.
  const effort = stage === 0 ? 1 : Math.min(1, .30 + .03 * stage + (1 - calm) * .52);
  return { stage, prev, age, effort, fresh: Math.min(1, age / .6), reach: ramp * ramp * (3 - 2 * ramp), pulse: Math.sin(age * 2.1) * effort, line: LINES[stage]! };
}
export type Act = ReturnType<typeof actAt>;
/** `alpha` fades every prop together, for the crash. */
export function drawAct(c: CanvasRenderingContext2D, a: Act, alpha = 1): void {
  if (!a.stage && !a.prev) return;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  /** A prop's opacity: fading in when this act brings it, out when the act before had it and this one does not. */
  const show = (has: (stage: number) => boolean): number => { const now = has(a.stage), before = has(a.prev), k = alpha * (now ? (before ? 1 : a.fresh) : before ? 1 - a.fresh : 0); c.globalAlpha = k; return k; };
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (show((s) => s >= 2)) { c.save(); c.translate(412, 192); c.rotate(a.stage === 2 ? -.12 * a.reach : a.prev === 2 ? -.12 * (1 - a.reach) : 0); box(-27,-39,55,38,'#ae8464'); line(-9,-42,9,-42,'#dec19c',5); c.restore(); }
  // The receipts pile up one sheet per act; only the newest sheet fades.
  const sheets = a.stage >= 4 ? a.stage - 2 : 0, before = a.prev >= 4 ? a.prev - 2 : 0;
  for (let i = 0; i < Math.max(sheets, before); i++) { const k = alpha * (i < Math.min(sheets, before) ? 1 : sheets > before ? a.fresh : 1 - a.fresh); c.globalAlpha = k; if (k > 0) { box(293+i*3,188-i*9,40,12,'#ddd9ba');line(300+i*3,194-i*9,324+i*3,194-i*9,'#899886',2); } }
  if (show((s) => s === 1 || s === 3 || s === 6)) { c.save();c.translate(374, 190);c.rotate(-.08+a.pulse*.015);box(-24,-52,48,44,a.stage===3?'#c1d2c8':'#dec5a0');line(-15,-39,15,-39,'#65766b',3);line(-15,-27,10,-27,'#65766b',3);c.restore(); }
  if (show((s) => s >= 5)) { box(703, 384, 49, 58, '#4c6259');line(711,401,744,401,'#bacbb0',4);oval(728,427,6,4,'#d69677'); }
  c.restore();
}
