/**
 * Elapsed-time presentation only: no result, stake or crash prediction enters this director. `effort` dips into a
 * breather five seconds into each act; it shapes Andy's pause and the props, never the round's tension or his fear.
 */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["Just a little water", "A windbreaker at the fence", "Support stakes going in", "Listen. Did that stop?", "Someone peers over the fence", "The tallest branch leans", "Still watching the garden"];
export function actAt(elapsed: number, reduced = false) {
  const seconds = Math.max(0, elapsed / 1000);
  let stage = 0; for (let i = 1; i < STARTS.length; i++) if (seconds >= STARTS[i]!) stage = i;
  const cycle = seconds >= 170 ? Math.floor((seconds - 170) / 24) : 0;
  const age = seconds >= 170 ? (seconds - 170) % 24 : seconds - STARTS[stage]!;
  let prev = stage - 1;
  if (seconds >= 170) { stage = 1 + cycle % 6; prev = cycle ? 1 + (cycle - 1) % 6 : 6; }
  const ramp = Math.min(1, age / 5), dip = 1 - Math.min(1, Math.abs(age - 5) / 5), release = dip * dip * (3 - 2 * dip);
  // Smooth at both ends: full effort as an act starts, the breather at five seconds, full effort again by ten.
  const effort = stage === 0 ? 1 : 1 - (.7 - .03 * stage) * release;
  return { stage, prev, age, effort, reach: reduced ? 1 : ramp * ramp * (3 - 2 * ramp), fade: reduced ? 1 : Math.min(1, age / .6), pulse: reduced ? 0 : Math.sin(age * 2.1), line: LINES[stage]! };
}
export type Act = ReturnType<typeof actAt>;
const PROPS = (s: number) => ({ peek: s === 1 || s === 4 || s === 6, stakes: s >= 2, mist: s === 3 || s === 6 });
/** `alpha` fades the props out at a crash or a cash-out; a prop that changes between acts fades instead of popping. */
export function drawAct(c: CanvasRenderingContext2D, a: Act, alpha = 1): void {
  if (!a.stage || alpha <= 0) return;
  const now = PROPS(a.stage), was = PROPS(a.prev), f = a.fade * a.fade * (3 - 2 * a.fade);
  const show = (k: keyof typeof now) => alpha * (now[k] ? (was[k] ? 1 : f) : (was[k] ? 1 - f : 0));
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (show('peek') > .01) {
    // An agent in a windbreaker and cap rises behind the fence.
    const y = 293 + (1 - (was.peek ? 1 : a.reach)) * 12; c.globalAlpha = show('peek');
    oval(851, y, 18, 21, '#bda393'); c.fillStyle = '#26314f'; c.beginPath(); c.ellipse(851, y - 9, 19, 13, 0, Math.PI, 0); c.fill(); line(834, y - 9, 822, y - 7, '#26314f', 5);
    oval(846, y - 3, 3, 4, '#25253a'); oval(857, y - 3, 3, 4, '#25253a'); box(831, 307, 40, 14, '#26314f'); oval(831, 309, 6, 4, '#bda393'); oval(871, 309, 6, 4, '#bda393');
    c.fillStyle = '#f2d04b'; c.font = '900 8px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('SEC', 851, 318);
  }
  if (show('stakes') > .01) {
    const lean = (s: number, reach: number) => s === 5 ? reach : s === 6 ? 1 : 0;
    const tilt = now.stakes ? lean(a.stage, a.reach) : lean(a.prev, 1); c.globalAlpha = show('stakes');
    for (const x of [468, 614]) { line(x, 449, x - 18 * tilt, 294, '#b59068', 9); line(x - 23, 341, x + 20, 341, '#ded69a', 4); }
  }
  if (show('mist') > .01) { c.fillStyle = '#d3e8ac'; c.globalAlpha = .25 * show('mist'); c.beginPath(); c.ellipse(405, 355, 92 + (now.mist ? a.reach : 1) * 20, 58, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
