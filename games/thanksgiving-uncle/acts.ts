/** Elapsed-time presentation only: no result, stake or crash prediction enters this director. */
const STARTS = [0, 32, 52, 75, 100, 125, 145] as const;
const LINES = ["A peaceful family dinner", "Pass the gravy. Slowly.", "Turn down the speaker", "A brief attempt at calm", "The window needs checking", "Another order arrives", "Everybody, just eat"];
const ease = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
/** `effort` is the props' own energy (a smooth lull, then renewed activity); it never touches the round's tension. */
export function actAt(elapsed: number) {
  const seconds = Math.max(0, elapsed / 1000);
  let stage = 0; for (let i = 1; i < STARTS.length; i++) if (seconds >= STARTS[i]!) stage = i;
  const cycle = seconds >= 170 ? Math.floor((seconds - 170) / 24) : 0;
  const age = seconds >= 170 ? (seconds - 170) % 24 : seconds - STARTS[stage]!;
  if (seconds >= 170) stage = 1 + cycle % 6;
  const release = ease(age / 5) * (1 - ease((age - 5) / 5));
  const effort = stage === 0 ? 1 : Math.min(1, .30 + .03 * stage + (1 - release) * .52);
  return { stage, age, effort, reach: ease(age / 5), pulse: Math.sin(age * 2.1), line: LINES[stage]! };
}
export type Act = ReturnType<typeof actAt>;
/** Draws the act's props at `alpha`, so the scene can fade them out on the crash or the cash-out. */
export function drawAct(c: CanvasRenderingContext2D, a: Act, alpha = 1): void {
  if (!a.stage || alpha <= 0) return;
  c.save(); c.globalAlpha = alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  const box = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.stroke(); };
  const line = (x: number, y: number, x2: number, y2: number, color = '#e5c485', width = 5) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.strokeStyle = '#202432'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (a.stage === 1 || a.stage === 3 || a.stage === 6) { c.save(); c.translate(479, 332); c.rotate(a.stage === 1 ? -.15 * a.reach + .03 * a.pulse * a.effort : 0); oval(0, -8, 27, 13, '#dce0c4'); line(18,-13,37,-25,'#dce0c4',8); c.restore(); }
  // The volume box sits on the sideboard beside the speaker, clear of its light ring.
  if (a.stage >= 2) { box(24, 268, 46, 32, '#334c51'); oval(47, 284, 10, 10, a.stage === 3 ? '#859b78' : '#c59478'); }
  if (a.stage >= 4) {
    // Checking the window: a roller shade comes partway down over the glass, its pull swaying, Dale still in view.
    const drop = 16 + a.reach * 38 + a.pulse * a.effort * 3;
    c.fillStyle = '#efe6d2'; c.strokeStyle = '#202432'; c.lineWidth = 3;
    c.beginPath(); c.rect(692, 60, 206, drop); c.fill(); c.stroke();
    box(684, 48, 222, 14, '#6b4a2b');
    line(878, 60 + drop, 878, 60 + drop + 24, '#d9c39a', 3);
    oval(878, 60 + drop + 28, 5, 5, '#d9c39a');
  }
  if (a.stage >= 5) { box(702, 386, 62, 51, '#c6a878'); line(732,389,732,435,'#f1dba5',8); box(711,404,16,9,'#f4e3c1'); }
  c.restore();
}
