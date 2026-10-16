/**
 * The second hide: an ally runs in with her yard sign and a push mower, holds the sign between Memo and
 * the street, and he does her lawn behind it. Nobody looks at the help. The price is $5, renegotiated
 * every time. The sod she unrolls, the clippings and her lines are presentation; the fee comes off his
 * stack, never the bet.
 */
import { INK, box, clamp, ease, line, noise, oval, plain, shape, text } from './drawing';
import { ALLY_SIGN, BARGAINS } from './lines';
import { GROUND, type MemoPose, type Point } from './memo';
import { figure } from './threats';

/** How long the sign is up, and how long she takes to arrive and to leave. */
export const ALLY_S = 1.8;
const IN_S = 0.3;
const OUT_S = 0.35;

interface Clip { x: number; y: number; vx: number; vy: number; life: number }
export interface Ally {
  active: boolean;
  age: number;
  uses: number;
  line: string;
  /** How much sod has unrolled, in px, and how far the mower has walked it. */
  sod: number;
  mowed: number;
  clips: Clip[];
  fee: number;
  feeAge: number;
}

export const createAlly = (): Ally => ({ active: false, age: 0, uses: 0, line: BARGAINS[0]!, sod: 0, mowed: 0, clips: [], fee: 0, feeAge: 9 });
export function resetAlly(a: Ally): void { Object.assign(a, createAlly()); }

/** The fee for this use: the bargain gets worse the more he comes back. */
export const allyFee = (uses: number, stacked: number) => Math.min(stacked, 1 + Math.floor(uses / 3));

/** She comes running. Returns the paychecks she takes. */
export function startAlly(a: Ally, stacked: number): number {
  if (a.active) return 0;
  const fee = allyFee(a.uses, stacked);
  a.active = true; a.age = 0; a.sod = 0; a.mowed = 0; a.clips.length = 0;
  a.line = BARGAINS[a.uses % BARGAINS.length]!;
  a.uses += 1; a.fee = fee; a.feeAge = 0;
  return fee;
}

/** Whether the sign is between him and the street right now. */
export const allyHides = (a: Ally) => a.active && a.age >= IN_S * 0.8 && a.age <= ALLY_S + OUT_S * 0.3;
export const allyDone = (a: Ally) => a.age >= ALLY_S + OUT_S;

export function stepAlly(a: Ally, dt: number, heroX: number): void {
  a.feeAge += dt;
  if (!a.active) return;
  a.age += dt;
  if (a.age < ALLY_S) { a.sod = Math.min(260, a.sod + 520 * dt); a.mowed = Math.min(a.sod, a.mowed + 95 * dt); }
  if (a.age > IN_S && a.age < ALLY_S && Math.floor(a.age * 14) !== Math.floor((a.age - dt) * 14)) {
    const r = noise(a.age * 31 + a.uses);
    a.clips.push({ x: heroX + 56 + r * 10, y: GROUND - 10, vx: 40 + r * 120, vy: -120 - noise(a.age * 7) * 140, life: 0.7 });
    if (a.clips.length > 30) a.clips.shift();
  }
  for (let i = a.clips.length - 1; i >= 0; i--) {
    const k = a.clips[i]!;
    k.x += k.vx * dt; k.y += k.vy * dt; k.vy += 700 * dt; k.life -= dt;
    if (k.life <= 0) a.clips.splice(i, 1);
  }
  if (allyDone(a)) { a.active = false; a.age = 0; }
}

/** Where she stands, from her run in to her run out. */
function allyX(a: Ally, heroX: number): number {
  const home = heroX + 78;
  if (a.age < IN_S) return home - 320 * (1 - ease(a.age / IN_S));
  if (a.age > ALLY_S) return home - 320 * ease((a.age - ALLY_S) / OUT_S);
  return home;
}

/** The sod strip under his feet: drawn before him. */
export function drawAllyGround(c: CanvasRenderingContext2D, a: Ally, heroX: number): void {
  if (!a.active || a.sod <= 2) return;
  const x0 = heroX - 40, w = a.sod;
  box(c, x0, GROUND - 4, w, 16, '#4f9a3c', 3, 2);
  c.save(); c.fillStyle = '#3b7a2c';
  for (let x = x0 + 6; x < x0 + Math.min(w, a.mowed); x += 14) c.fillRect(x, GROUND - 3, 7, 14);
  c.restore();
  // The roll at the leading edge.
  if (w < 258) { oval(c, x0 + w, GROUND + 2, 12, 11, '#6b4a2a', 3); oval(c, x0 + w, GROUND + 2, 5, 4, '#4f9a3c', 1.5); }
}

/** Her, the sign, the mower's clippings and her line: drawn after him, so the sign is between him and us. */
export function drawAllyFront(c: CanvasRenderingContext2D, a: Ally, time: number, heroX: number, pose: MemoPose | null): void {
  if (!a.active) return;
  const x = allyX(a, heroX);
  const running = a.age < IN_S || a.age > ALLY_S;
  const dir = a.age > ALLY_S ? -1 : 1;
  const phase = running ? (time * 3.2) : null;
  const h = figure(c, x, GROUND, 0.95, dir, phase, 44, { skin: '#f0c8a8', shirt: '#e9e3d3', pants: '#c7b8a0', hair: '#7a4f2a' }, running ? {} : { back: { x: -16, y: -8 }, front: { x: -6, y: -10 }, lean: -0.04 });
  // The tote, always.
  box(c, h.shoulder.x - 26 * dir, h.shoulder.y + 12, 18, 24, '#d9c7a3', 3, 2); plain(c, 'ALLY', h.shoulder.x - 17 * dir, h.shoulder.y + 27, 5, '#1e1a2b', 'center', 'system-ui, sans-serif', 900);
  // The sign, held up between him and the street while she stands.
  if (!running) {
    const sx = heroX + 18, sy = GROUND - 128, w = 124, hgt = 96;
    line(c, [[sx, sy + hgt - 4], [sx, GROUND - 6]], '#f6f1e4', 6);
    c.save(); c.translate(sx, sy); c.rotate(Math.sin(time * 2) * 0.02);
    const colors = ['#e63946', '#f4a261', '#f2d23c', '#57b57b', '#4a8fd1'];
    for (let i = 0; i < 5; i++) box(c, -w / 2, -hgt / 2 + i * (hgt / 5), w, hgt / 5 + 1, colors[i]!, 0, 0);
    box(c, -w / 2, -hgt / 2, w, hgt, '#00000000', 6, 3);
    for (let i = 0; i < ALLY_SIGN.length; i++) plain(c, ALLY_SIGN[i]!, 0, -hgt / 2 + 14 + i * (hgt / 5), 11, '#ffffff', 'center', 'system-ui, sans-serif', 900, w - 10);
    c.restore();
    for (const k of a.clips) { c.save(); c.globalAlpha = clamp(k.life / 0.3); oval(c, k.x, k.y, 3, 1.6, '#7fd36b'); c.restore(); }
  }
  // Her line.
  if (a.age > IN_S * 0.6 && a.age < ALLY_S + 0.1) {
    const bx = heroX + 215, by = GROUND - 252;
    c.save(); c.globalAlpha = ease((a.age - IN_S * 0.6) / 0.2);
    box(c, bx - 110, by - 16, 220, 32, '#fcf0c9', 10, 3);
    plain(c, a.line, bx, by + 4, 11, INK, 'center', 'system-ui, sans-serif', 700, 208);
    shape(c, [[bx - 96, by + 12], [bx - 118, by + 34], [bx - 80, by + 14]], '#fcf0c9', 0);
    c.restore();
  }
  // The fee floats off his stack.
  if (a.feeAge < 1.2 && a.fee > 0 && pose) {
    c.save(); c.globalAlpha = 1 - ease((a.feeAge - 0.7) / 0.5);
    text(c, `−$${a.fee * 100} · ALLY FEE`, pose.head.x - 70, pose.head.y - 60 - 40 * a.feeAge, 15, '#ff8b90', 'center');
    c.restore();
  }
}
