/**
 * Elapsed-time presentation only: no result, stake or crash prediction enters this director. `effort` describes
 * the act's calm-then-renewed beat; the scene never scales the round's tension by it.
 */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["Welcome to the stream", "A clamp needs tightening", "A fresh sponsor. Obviously.", "Reset the studio smile", "The backdrop comes loose", "The cable needs attention", "One more perfect take"];
export function actAt(elapsed: number) {
  const seconds = Math.max(0, elapsed / 1000);
  let stage = 0; for (let i = 1; i < STARTS.length; i++) if (seconds >= STARTS[i]!) stage = i;
  const cycle = seconds >= 170 ? Math.floor((seconds - 170) / 24) : 0;
  const age = seconds >= 170 ? (seconds - 170) % 24 : seconds - STARTS[stage]!;
  if (seconds >= 170) stage = 1 + cycle % 6;
  const ramp = Math.min(1, age / 5), release = Math.max(0, 1 - Math.abs(age - 5) / 5);
  const effort = stage === 0 ? 1 : Math.min(1, .30 + .03 * stage + (1 - release) * .52);
  return { stage, age, effort, recurring: seconds >= 170, reach: ramp * ramp * (3 - 2 * ramp), pulse: Math.sin(age * 2.1), line: LINES[stage]! };
}
export type Act = ReturnType<typeof actAt>;
/**
 * `fade` takes the props out over the crash or a cash-out. Each act's new prop fades in over its first 0.6 s and
 * each re-pose eases on from where the last act left it; the recurring acts keep the whole set up, so nothing pops.
 */
export function drawAct(c: CanvasRenderingContext2D, a: Act, fade = 1): void {
  if (!a.stage || fade <= 0.01) return;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const set = a.recurring ? 6 : a.stage, fresh = a.recurring ? 1 : Math.min(1, a.age / .6);
  /** How far the act that brought in a pose has taken it: 0 before that act, its ramp during it, 1 after. */
  const lean = (k: number) => set > k ? 1 : set === k ? a.reach : 0;
  const enter = (k: number) => { c.globalAlpha = fade * (set > k ? 1 : fresh); };
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  // The stand lives right of the burned-in follower count and arrow.
  if (set >= 1) { enter(1); line(571, 16, 571, 337, '#596874', 9); box(552, 25, 38, 17, '#a3b4b0'); }
  if (set >= 2) { enter(2); c.save(); c.translate(530, 95); c.rotate(.18 * lean(4) - .02 * lean(2)); box(-48, -34, 96, 68, '#365c4f'); line(-30, -13, 31, -13, '#d1e4a0', 5); line(-30, 6, 18, 6, '#d1e4a0', 5); c.restore(); }
  if (set >= 4) { enter(4); c.strokeStyle = '#222f38'; c.lineWidth = 5; c.beginPath(); c.moveTo(569, 70); c.quadraticCurveTo(641, 170 + lean(4) * 70, 565, 314); c.stroke(); }
  if (set >= 5) { enter(5); box(489, 300, 61, 22, '#d6c693'); oval(502, 311, 5, 5, set === 6 ? '#83cda8' : '#de9279'); }
  // The lamp lit for act 3 goes out over act 4's first 0.6 s and comes back on for the last act.
  const lamp = set === 3 || set === 6 ? fresh : set === 4 ? 1 - fresh : 0;
  if (lamp > 0) { c.globalAlpha = fade * lamp; oval(568, 14, 10, 10, '#b8df92'); }
  c.restore();
}
