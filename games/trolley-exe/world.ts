/**
 * TROLLEY.EXE's picture: the CRT, the line and its forks scrolling under a trolley that stays put, the levers,
 * the people on the branches, God's panel, the fork card, the readout, the glitch and the blue screen. Everything
 * here draws from numbers the scene hands it; nothing reads or changes the round's outcome.
 */
import { type Kind, caption, drawCharacter } from './cast';
import { DY, FORK_LEN, type Fork, MERGE, RUN, SPLIT, TROLLEY_X, type World, branchOffset, standAt, trolleyOffset } from './course';
import type { Side } from './input';

export const W = 960;
export const H = 540;
export const COLOURS = {
  bg: '#070a08', panel: '#0b120c', line: '#1e3a1f', ph: '#9cff8a', ph2: '#5fcf55', dim: '#4e8a4a', ink: '#d7ffd0',
  amber: '#ffb347', amberDim: '#7a5a2a', red: '#ff4d4d', violet: '#c48cff', bsod: '#0078d7', white: '#ffffff', black: '#000000',
} as const;
export const MONO = 'ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';
export const SANS = '"Segoe UI", system-ui, -apple-system, sans-serif';
export const MAIN_Y = 448;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => { const s = clamp(t, 0, 1); return s * s * (3 - 2 * s); };
export function hash(n: number): number { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
export const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;
/** A world distance on the screen. */
export const screenX = (w: World, d: number): number => TROLLEY_X + d - w.distance;

// ─── The set ────────────────────────────────────────────────────────────────────────────────────────────

export function drawCRT(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLOURS.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(480, 380, 40, 480, 380, 640);
  glow.addColorStop(0, 'rgba(95,207,85,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}
export function drawScanlines(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5);
  const v = ctx.createRadialGradient(480, 270, 240, 480, 270, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/** Traces a branch of a fork on the screen, from its split to its merge. */
function branchPath(ctx: CanvasRenderingContext2D, sx: number, side: Side): void {
  const dy = DY[side];
  ctx.moveTo(sx, MAIN_Y);
  ctx.bezierCurveTo(sx + SPLIT * 0.6, MAIN_Y, sx + SPLIT * 0.4, MAIN_Y + dy, sx + SPLIT, MAIN_Y + dy);
  ctx.lineTo(sx + SPLIT + RUN, MAIN_Y + dy);
  ctx.bezierCurveTo(sx + SPLIT + RUN + MERGE * 0.6, MAIN_Y + dy, sx + SPLIT + RUN + MERGE * 0.4, MAIN_Y, sx + FORK_LEN, MAIN_Y);
}

/** The line and every fork in view: ties under rails, the branch the trolley will take a touch brighter. */
export function drawTrack(ctx: CanvasRenderingContext2D, w: World, next: Fork | null): void {
  ctx.save();
  ctx.lineCap = 'butt';
  const visible = w.forks.filter((f) => screenX(w, f.at + FORK_LEN) > -40 && screenX(w, f.at) < W + 40);
  // The line between forks.
  const segments: [number, number][] = [];
  let x = -40;
  for (const f of w.forks) {
    const sx = screenX(w, f.at);
    if (sx > x) segments.push([x, Math.min(W + 40, sx)]);
    x = Math.max(x, screenX(w, f.at + FORK_LEN));
  }
  if (x < W + 40) segments.push([x, W + 40]);
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? '#17281a' : COLOURS.dim;
    ctx.lineWidth = pass === 0 ? 14 : 3;
    ctx.setLineDash(pass === 0 ? [4, 12] : []);
    ctx.beginPath();
    for (const [a, b] of segments) {
      ctx.moveTo(a, MAIN_Y);
      ctx.lineTo(b, MAIN_Y);
    }
    ctx.stroke();
    for (const f of visible) {
      const sx = screenX(w, f.at);
      for (const side of ['up', 'down'] as Side[]) {
        const chosen = f.lever === side && (f.locked || f === next);
        ctx.strokeStyle = pass === 0 ? '#17281a' : chosen ? COLOURS.ph2 : COLOURS.dim;
        ctx.beginPath();
        branchPath(ctx, sx, side);
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/** The lever at a fork's split: an arm that swings to the branch set, tagged with whose hand set it. */
export function drawLever(ctx: CanvasRenderingContext2D, sx: number, f: Fork, isNext: boolean, time: number): void {
  ctx.save();
  ctx.translate(sx, MAIN_Y);
  const angle = f.lever === 'up' ? -0.55 : f.lever === 'down' ? 0.55 : 0;
  ctx.save();
  ctx.rotate(angle);
  ctx.strokeStyle = f.lever ? COLOURS.amber : COLOURS.amberDim;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -30);
  ctx.stroke();
  ctx.fillStyle = f.lever ? COLOURS.amber : COLOURS.amberDim;
  ctx.beginPath();
  ctx.arc(0, -30, 5, 0, Math.PI * 2);
  ctx.fill();
  if (isNext && !f.locked) {
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 6);
    ctx.beginPath();
    ctx.arc(0, -30, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = f.setBy === 'you' ? COLOURS.ph : f.setBy === 'auto' ? COLOURS.violet : COLOURS.amberDim;
  ctx.font = `700 9px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(f.setBy === 'you' ? 'YOU' : f.setBy === 'auto' ? 'AUTO' : isNext ? '?' : '', 0, 24);
  ctx.restore();
}

/** Everyone on both branches of a fork, with the branch captions. */
export function drawFork(ctx: CanvasRenderingContext2D, w: World, f: Fork, time: number): void {
  for (const side of ['up', 'down'] as Side[]) {
    const y = MAIN_Y + DY[side];
    const xs = standAt(f, side);
    const kinds = f.dilemma[side];
    xs.forEach((d, i) => {
      const sx = screenX(w, d);
      if (sx < -40 || sx > W + 40) return;
      const near = clamp(1 - (d - w.distance) / 320, 0, 1);
      drawCharacter(ctx, kinds[i]!, sx, y, f.dead[side][i]!, f.locked && f.lever === side ? near : near * 0.5, time, f.index * 0.37 + i * 0.61);
    });
    const mid = screenX(w, f.at + SPLIT + RUN / 2);
    if (mid > -200 && mid < W + 200) {
      ctx.save();
      ctx.fillStyle = f.locked && f.lever === side ? COLOURS.amber : COLOURS.dim;
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(caption(kinds), mid, side === 'up' ? y - 64 : y - 54, RUN + 60);
      ctx.restore();
    }
  }
}

/** The trolley at its place on the screen, following the branch it is on. */
export function drawTrolley(ctx: CanvasRenderingContext2D, w: World, spin: number, lamp: number, shake: number, ghost = false): void {
  const { dy, angle } = trolleyOffset(w);
  drawTram(ctx, TROLLEY_X, MAIN_Y + dy, angle, spin, lamp, shake, ghost);
}
export function drawTram(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, spin: number, lamp: number, shake: number, ghost: boolean): void {
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.55;
  ctx.translate(x + shake * Math.sin(spin * 37), y + shake * Math.cos(spin * 23));
  ctx.rotate(angle);
  ctx.fillStyle = COLOURS.amber;
  ctx.globalAlpha *= 0.25 + 0.55 * lamp;
  ctx.beginPath();
  ctx.moveTo(36, -20);
  ctx.lineTo(96, -34);
  ctx.lineTo(96, -6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = ghost ? 0.55 : 1;
  ctx.fillStyle = '#0d1a0e';
  ctx.strokeStyle = COLOURS.ph;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-36, -32, 72, 30, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLOURS.ph2;
  ctx.globalAlpha *= 0.85;
  for (const wx of [-28, -10, 8]) ctx.fillRect(wx, -26, 12, 10);
  ctx.globalAlpha = ghost ? 0.55 : 1;
  ctx.strokeStyle = COLOURS.ph2;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(10, -46);
  ctx.stroke();
  ctx.strokeStyle = COLOURS.ph;
  ctx.fillStyle = COLOURS.black;
  for (const wx of [-20, 20]) {
    ctx.beginPath();
    ctx.arc(wx, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx + 5 * Math.cos(spin), 5 * Math.sin(spin));
    ctx.lineTo(wx - 5 * Math.cos(spin), -5 * Math.sin(spin));
    ctx.moveTo(wx + 5 * Math.cos(spin + 1.57), 5 * Math.sin(spin + 1.57));
    ctx.lineTo(wx - 5 * Math.cos(spin + 1.57), -5 * Math.sin(spin + 1.57));
    ctx.stroke();
  }
  ctx.restore();
}
export function drawSparks(ctx: CanvasRenderingContext2D, x: number, y: number, amount: number, time: number): void {
  if (amount <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = COLOURS.amber;
  ctx.lineWidth = 1.5;
  const n = Math.round(2 + 6 * amount);
  for (let i = 0; i < n; i += 1) {
    const r = hash(Math.floor(time * 30) * 7 + i * 13);
    const len = 6 + 18 * r * amount;
    ctx.globalAlpha = 0.3 + 0.6 * hash(i * 31 + Math.floor(time * 30));
    ctx.beginPath();
    ctx.moveTo(-20 - 10 * r, 2);
    ctx.lineTo(-20 - 10 * r - len, 2 + (r - 0.5) * 14);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── The HUD ────────────────────────────────────────────────────────────────────────────────────────────

export function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** God's panel across the top: the speaker on the frame, the line as far as it has typed, the patience bar. */
export function drawGodBox(ctx: CanvasRenderingContext2D, speaker: string, text: string, cursor: boolean, patience: number, patienceLabel: string, time: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(18,15,6,0.92)';
  ctx.strokeStyle = COLOURS.amber;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(24.5, 22.5, W - 49, 86);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLOURS.bg;
  ctx.font = `11px ${MONO}`;
  const label = ` ${speaker} `;
  ctx.fillRect(38, 16, ctx.measureText(label).width + 2, 13);
  ctx.fillStyle = COLOURS.amber;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, 39, 27);
  ctx.font = `16px ${MONO}`;
  const lines = wrap(ctx, text, W - 110).slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, 42, 52 + i * 20));
  if (cursor && Math.floor(time * 2) % 2 === 0) {
    const lastLine = lines[lines.length - 1] ?? '';
    ctx.fillRect(44 + ctx.measureText(lastLine).width, 41 + (Math.max(1, lines.length) - 1) * 20, 9, 14);
  }
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = COLOURS.amberDim;
  ctx.textAlign = 'right';
  ctx.fillText(patienceLabel, W - 46, 101);
  const bw = 200;
  const bx = W - 46 - bw - ctx.measureText(patienceLabel).width - 12;
  ctx.strokeStyle = COLOURS.amberDim;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, 92.5, bw, 9);
  ctx.fillStyle = patience < 0.3 ? COLOURS.red : patience < 0.6 ? COLOURS.amber : COLOURS.ph2;
  ctx.globalAlpha = patience < 0.3 && Math.floor(time * 3) % 2 === 0 ? 0.55 : 1;
  ctx.fillRect(bx + 1, 93.5, (bw - 2) * clamp(patience, 0, 1), 7);
  ctx.restore();
}

/** The multiplier in phosphor with its label. */
export function drawReadout(ctx: CanvasRenderingContext2D, x100: number, punch: number, colour: string, label: string): void {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOURS.dim;
  ctx.font = `11px ${MONO}`;
  ctx.fillText(label, W - 44, 140);
  ctx.fillStyle = colour;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 18;
  ctx.font = `700 ${56 * (1 + 0.22 * punch)}px ${MONO}`;
  ctx.fillText(formatX(x100), W - 40, 194);
  ctx.restore();
}
export function drawTitle(ctx: CanvasRenderingContext2D, sub: string): void {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOURS.ph;
  ctx.shadowColor = COLOURS.ph;
  ctx.shadowBlur = 14;
  ctx.font = `700 34px ${MONO}`;
  ctx.fillText('TROLLEY.EXE', 40, 156);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLOURS.amber;
  ctx.font = `11px ${MONO}`;
  ctx.fillText(sub, 42, 174);
  ctx.restore();
}

/** The fork card: the next question, its two branches, which the lever points at and whose hand set it, and a bar to the split. */
export function drawForkCard(ctx: CanvasRenderingContext2D, f: Fork | null, auto: boolean, toSplit: number, keyboard: boolean, ledger: string): void {
  ctx.save();
  ctx.fillStyle = 'rgba(11,18,12,0.9)';
  ctx.strokeStyle = COLOURS.line;
  ctx.lineWidth = 1;
  ctx.fillRect(40.5, 180.5, 430, 108);
  ctx.strokeRect(40.5, 180.5, 430, 108);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = COLOURS.dim;
  ctx.fillText(f ? `NEXT FORK · ${f.index + 1}` : 'NEXT FORK', 52, 195);
  ctx.textAlign = 'right';
  ctx.fillText(ledger, 458, 195, 320);
  ctx.textAlign = 'left';
  if (!f) {
    ctx.fillStyle = COLOURS.ink;
    ctx.font = `12px ${MONO}`;
    ctx.fillText('The track is clear. For now.', 52, 226);
    ctx.restore();
    return;
  }
  ctx.fillStyle = COLOURS.ink;
  ctx.font = `12px ${MONO}`;
  wrap(ctx, f.dilemma.prompt, 406).slice(0, 2).forEach((l, i) => ctx.fillText(l, 52, 213 + i * 15));
  const row = (side: Side, y: number) => {
    const set = f.lever === side;
    ctx.fillStyle = set ? COLOURS.amber : COLOURS.dim;
    ctx.font = `700 11px ${MONO}`;
    ctx.fillText(`${side === 'up' ? '↑' : '↓'} ${caption(f.dilemma[side])}`, 52, y, 300);
    if (set) {
      ctx.fillStyle = f.setBy === 'auto' ? COLOURS.violet : COLOURS.ph;
      ctx.textAlign = 'right';
      ctx.fillText(f.setBy === 'auto' ? 'AUTO-ETHICS.DLL' : 'YOUR HAND', 458, y);
      ctx.textAlign = 'left';
    }
  };
  row('up', 248);
  row('down', 263);
  ctx.fillStyle = COLOURS.dim;
  ctx.font = `9px ${MONO}`;
  ctx.fillText(f.locked ? 'LOCKED · THE TROLLEY IS IN THE FORK' : auto ? (keyboard ? '↑ ↓ OR W S TO TAKE THE LEVER · THE MACHINE THROWS IT OTHERWISE' : 'TAP THE TOP OR BOTTOM OF THE PICTURE TO TAKE THE LEVER') : (keyboard ? '↑ ↓ SET THE SWITCH · IT LOCKS AT THE SPLIT · UNTHROWN, IT STAYS' : 'TAP TOP OR BOTTOM · IT LOCKS AT THE SPLIT · UNTHROWN, IT STAYS'), 52, 282, 406);
  ctx.fillStyle = f.locked ? COLOURS.amberDim : COLOURS.amber;
  ctx.fillRect(52, 270, 406 * clamp(1 - toSplit, 0, 1), 2);
  ctx.restore();
}

export function drawStamp(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, pop: number, colour: string): void {
  if (pop <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.font = `700 15px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = COLOURS.bg;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.fillRect(-w / 2, -14, w, 28);
  ctx.strokeRect(-w / 2, -14, w, 28);
  ctx.fillStyle = colour;
  ctx.fillText(text, 0, 1);
  ctx.restore();
}
export function drawFootLine(ctx: CanvasRenderingContext2D, text: string, colour: string): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colour;
  ctx.font = `600 16px ${MONO}`;
  ctx.fillText(text, W / 2, 531, W - 80);
  ctx.restore();
}

// ─── The crash ──────────────────────────────────────────────────────────────────────────────────────────

export function drawGlitch(ctx: CanvasRenderingContext2D, amount: number, seed: number): void {
  if (amount <= 0.01) return;
  const m = ctx.getTransform();
  const sx = m.a, sy = m.d, ox = m.e, oy = m.f;
  const canvas = ctx.canvas;
  for (let i = 0; i < 7; i += 1) {
    const r1 = hash(seed * 3 + i * 7), r2 = hash(seed * 5 + i * 11), r3 = hash(seed * 7 + i * 13);
    if (r3 > 0.3 + 0.6 * amount) continue;
    const y = r1 * (H - 40);
    const h = 6 + r2 * 34;
    const dx = (r3 - 0.5) * 120 * amount;
    const srcW = canvas.width - Math.abs(dx) * sx;
    const srcX = ox + Math.max(0, -dx) * sx;
    try {
      ctx.drawImage(canvas, srcX, oy + y * sy, srcW, h * sy, Math.max(0, dx), y, srcW / sx, h);
    } catch {
      // A detached or zero-sized canvas has nothing to tear.
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.5 * amount;
  ctx.fillStyle = COLOURS.ph;
  for (let i = 0; i < 5; i += 1) {
    if (hash(seed * 11 + i * 17) > amount) continue;
    ctx.fillRect(hash(seed + i) * W, hash(seed * 2 + i) * H, 20 + 120 * hash(seed * 3 + i), 3 + 10 * hash(seed * 4 + i));
  }
  ctx.restore();
}

export interface BlueScreen {
  code: string;
  detail: string;
  crashedAt: string;
  failed: string;
  trace: string[];
}
/** The blue screen over the picture: slides down over 0.35 s of `t`, then types its findings. */
export function drawBSOD(ctx: CanvasRenderingContext2D, t: number, info: BlueScreen, time: number): void {
  const slide = smooth(t / 0.35);
  if (slide <= 0) return;
  ctx.save();
  ctx.translate(0, -H * (1 - slide));
  ctx.fillStyle = COLOURS.bsod;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLOURS.white;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `300 96px ${SANS}`;
  ctx.fillText(':(', 70, 120);
  ctx.font = `22px ${SANS}`;
  ctx.fillText('TROLLEY.EXE ran into a problem and needs to restart.', 70, 168);
  ctx.font = `17px ${SANS}`;
  ctx.globalAlpha = 0.88;
  ctx.fillText("We're collecting your switches, and then we'll restart for you.", 70, 198);
  ctx.globalAlpha = 1;
  const steps = [0, 13, 27, 27, 45, 66, 66, 66.6, 66.6, 84, 99, 99, 100];
  const k = clamp(Math.floor((t - 0.4) / 0.16), 0, steps.length - 1);
  ctx.font = `20px ${SANS}`;
  ctx.fillText(`${t < 0.4 ? 0 : steps[k]}% complete`, 70, 236);
  const shown = clamp((t - 0.4) * 170, 0, 9999);
  const lines = [`Stop code: ${info.code}`, info.detail, `Crashed at ${info.crashedAt}`, `What failed: ${info.failed}`, '', 'Divine trace (most recent switch first):', ...info.trace, '  at God.judge (heaven.js:∞)'];
  ctx.font = `13px ${MONO}`;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(70, 254, W - 140, 14 + lines.length * 18);
  ctx.fillStyle = COLOURS.white;
  let budget = shown;
  lines.forEach((line, i) => {
    if (budget <= 0) return;
    const part = line.slice(0, Math.floor(budget));
    budget -= line.length + 3;
    ctx.fillText(part, 82, 272 + i * 18, W - 164);
  });
  if (t > 2.3 && Math.floor(time * 1.5) % 2 === 0) {
    ctx.font = `16px ${SANS}`;
    ctx.fillText('Press any key to be reincarnated. It will not help.', 70, H - 40);
  }
  ctx.restore();
}
