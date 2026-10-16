/**
 * TROLLEY.EXE's picture: the CRT, the track and its fork, the people tied to it, the trolley, the lever,
 * God's panel, the readout, the glitch and the blue screen. Everything here draws from numbers the scene
 * hands it (tension, clocks, poses); nothing reads or changes the round's outcome.
 */

export const W = 960;
export const H = 540;
export const COLOURS = {
  bg: '#070a08', panel: '#0b120c', line: '#1e3a1f', ph: '#9cff8a', ph2: '#5fcf55', dim: '#4e8a4a', ink: '#d7ffd0',
  amber: '#ffb347', amberDim: '#7a5a2a', red: '#ff4d4d', violet: '#c48cff', bsod: '#0078d7', white: '#ffffff', black: '#000000',
} as const;
export const MONO = 'ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';
export const SANS = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** The track: the approach and the main line at MAIN_Y, the fork at FORK_X, the side line at SIDE_Y. */
export const MAIN_Y = 404;
export const SIDE_Y = 296;
export const FORK_X = 380;
export const START_X = 70;
/** Where the five stand on the main track, and the one on the side track. */
export const VICTIMS = [630, 690, 750, 810, 870] as const;
export const SIDE_VICTIM_X = 720;
/** The end of the side branch's curve, where it runs level again. */
const SIDE_LEVEL_X = 520;
const CURVE_LEN = 180;
export const SIDE_TOTAL = CURVE_LEN + (W - 40 - SIDE_LEVEL_X);

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => { const s = clamp(t, 0, 1); return s * s * (3 - 2 * s); };
/** A deterministic 0..1 from a number, so a replay draws the same jitter frame for frame. */
export function hash(n: number): number { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
export const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;

export interface Pose { x: number; y: number; a: number }

/** Where the trolley sits on the approach while the round runs: creeping toward the fork, never reaching it. */
export const approachX = (tension: number): number => START_X + (FORK_X - 34 - START_X) * Math.pow(clamp(tension, 0, 1), 0.72);

function bezier(t: number): { x: number; y: number } {
  const p0x = FORK_X, p0y = MAIN_Y, p1x = 470, p1y = MAIN_Y, p2x = 430, p2y = SIDE_Y, p3x = SIDE_LEVEL_X, p3y = SIDE_Y;
  const u = 1 - t;
  return {
    x: u * u * u * p0x + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * p3x,
    y: u * u * u * p0y + 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * p3y,
  };
}

/** A point along the side branch by distance fraction `s` (0 at the fork, 1 at the picture's edge), with its heading. */
export function sidePoint(s: number): Pose {
  const d = clamp(s, 0, 1) * SIDE_TOTAL;
  if (d <= CURVE_LEN) {
    const t = d / CURVE_LEN;
    const p = bezier(t), q = bezier(Math.min(1, t + 0.01));
    return { x: p.x, y: p.y, a: Math.atan2(q.y - p.y, q.x - p.x) };
  }
  return { x: SIDE_LEVEL_X + (d - CURVE_LEN), y: SIDE_Y, a: 0 };
}
/** The side branch fraction at which the trolley reaches an x on its level part. */
export const sideParamAt = (x: number): number => (CURVE_LEN + Math.max(0, x - SIDE_LEVEL_X)) / SIDE_TOTAL;

// ─── The set ────────────────────────────────────────────────────────────────────────────────────────────

export function drawCRT(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLOURS.bg;
  ctx.fillRect(0, 0, W, H);
  // A faint phosphor haze over the track, so the picture is not flat black.
  const glow = ctx.createRadialGradient(480, 360, 40, 480, 360, 640);
  glow.addColorStop(0, 'rgba(95,207,85,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

/** Scanlines and a vignette over everything: the last thing drawn before the shell's frame ends. */
export function drawScanlines(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5);
  const v = ctx.createRadialGradient(480, 270, 240, 480, 270, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function sidePath(ctx: CanvasRenderingContext2D): void {
  ctx.moveTo(FORK_X, MAIN_Y);
  ctx.bezierCurveTo(470, MAIN_Y, 430, SIDE_Y, SIDE_LEVEL_X, SIDE_Y);
  ctx.lineTo(W - 20, SIDE_Y);
}

export function drawTrack(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.lineCap = 'butt';
  // Ties under both lines.
  ctx.strokeStyle = '#17281a';
  ctx.lineWidth = 14;
  ctx.setLineDash([4, 12]);
  ctx.beginPath();
  ctx.moveTo(20, MAIN_Y);
  ctx.lineTo(W - 20, MAIN_Y);
  ctx.stroke();
  ctx.beginPath();
  sidePath(ctx);
  ctx.stroke();
  ctx.setLineDash([]);
  // Rails.
  ctx.strokeStyle = COLOURS.dim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, MAIN_Y);
  ctx.lineTo(W - 20, MAIN_Y);
  ctx.stroke();
  ctx.beginPath();
  sidePath(ctx);
  ctx.stroke();
  ctx.fillStyle = COLOURS.dim;
  ctx.font = `11px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('M A I N   T R A C K', 640, MAIN_Y + 30);
  ctx.fillText('S I D E   T R A C K', 640, SIDE_Y - 44);
  ctx.restore();
}

/** The lever at the fork: a pole on a pivot that swings from the main setting to the side one. */
export function drawLever(ctx: CanvasRenderingContext2D, angle: number, lit: number): void {
  ctx.save();
  ctx.translate(FORK_X, MAIN_Y);
  ctx.fillStyle = COLOURS.dim;
  ctx.font = `10px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('LEVER', 0, 26);
  ctx.rotate(angle);
  ctx.strokeStyle = COLOURS.amber;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -34);
  ctx.stroke();
  ctx.fillStyle = COLOURS.amber;
  ctx.beginPath();
  ctx.arc(0, -34, 5.5 + 2 * lit, 0, Math.PI * 2);
  ctx.fill();
  if (lit > 0) {
    ctx.globalAlpha = 0.35 * lit;
    ctx.beginPath();
    ctx.arc(0, -34, 12 + 6 * lit, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A person tied across the track: standing on the rail in rope, wriggling harder as the trolley nears; fallen once it has passed. */
export function drawFigure(ctx: CanvasRenderingContext2D, x: number, y: number, dead: boolean, wriggle: number, time: number, seed: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = COLOURS.ph;
  ctx.fillStyle = COLOURS.ph;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (dead) {
    // Flat along the rail, eyes crossed, a small ring rising.
    ctx.translate(0, -4);
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(22, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(10, -8);
    ctx.moveTo(14, 0);
    ctx.lineTo(20, -7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-11, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-14, -3);
    ctx.lineTo(-10, 1);
    ctx.moveTo(-10, -3);
    ctx.lineTo(-14, 1);
    ctx.stroke();
    ctx.strokeStyle = COLOURS.amber;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(-11, -16, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const t = time * (2.2 + 2.6 * wriggle) + seed * 6.28;
  const lean = Math.sin(t) * (0.04 + 0.22 * wriggle);
  ctx.rotate(lean);
  // Legs, body, arms (tied behind), head.
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(0, -12);
  ctx.lineTo(5, 0);
  ctx.moveTo(0, -12);
  ctx.lineTo(0, -30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, -24);
  ctx.lineTo(0, -19);
  ctx.lineTo(6, -24);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -37, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  // Eyes: wide as the trolley nears.
  ctx.beginPath();
  ctx.arc(-2.4, -38, 0.9 + 0.8 * wriggle, 0, Math.PI * 2);
  ctx.arc(2.4, -38, 0.9 + 0.8 * wriggle, 0, Math.PI * 2);
  ctx.fill();
  // Rope.
  ctx.strokeStyle = COLOURS.amberDim;
  ctx.lineWidth = 1.5;
  for (const ry of [-16, -22, -27]) {
    ctx.beginPath();
    ctx.ellipse(0, ry, 5.5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** The trolley, facing +x with its wheels on the rail at the pose. */
export function drawTrolley(ctx: CanvasRenderingContext2D, pose: Pose, spin: number, lamp: number, shake: number): void {
  ctx.save();
  ctx.translate(pose.x + shake * Math.sin(spin * 37), pose.y + shake * Math.cos(spin * 23));
  ctx.rotate(pose.a);
  // Headlight cone.
  ctx.fillStyle = COLOURS.amber;
  ctx.globalAlpha = 0.25 + 0.55 * lamp;
  ctx.beginPath();
  ctx.moveTo(36, -20);
  ctx.lineTo(96, -34);
  ctx.lineTo(96, -6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // Body.
  ctx.fillStyle = '#0d1a0e';
  ctx.strokeStyle = COLOURS.ph;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-36, -32, 72, 30, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLOURS.ph2;
  ctx.globalAlpha = 0.85;
  for (const wx of [-28, -10, 8]) ctx.fillRect(wx, -26, 12, 10);
  ctx.globalAlpha = 1;
  // Pantograph.
  ctx.strokeStyle = COLOURS.ph2;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(10, -46);
  ctx.stroke();
  // Wheels with spokes.
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

/** Sparks off the wheels: a few short streaks behind the trolley, more as it hurries. */
export function drawSparks(ctx: CanvasRenderingContext2D, pose: Pose, amount: number, time: number): void {
  if (amount <= 0) return;
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.a);
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

/** Wraps `text` into lines no wider than `width` in the current font. */
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

/** God's panel across the top: the speaker's name on the frame, the line as far as it has typed, and the patience bar. */
export function drawGodBox(ctx: CanvasRenderingContext2D, speaker: string, text: string, cursor: boolean, patience: number, patienceLabel: string, time: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(18,15,6,0.92)';
  ctx.strokeStyle = COLOURS.amber;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(24.5, 22.5, W - 49, 96);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLOURS.bg;
  ctx.font = `11px ${MONO}`;
  const label = ` ${speaker} `;
  const lw = ctx.measureText(label).width;
  ctx.fillRect(38, 16, lw + 2, 13);
  ctx.fillStyle = COLOURS.amber;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, 39, 27);
  ctx.font = `17px ${MONO}`;
  const lines = wrap(ctx, text, W - 110).slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, 42, 56 + i * 22));
  if (cursor && Math.floor(time * 2) % 2 === 0) {
    const lastLine = lines[lines.length - 1] ?? '';
    ctx.fillRect(44 + ctx.measureText(lastLine).width, 44 + (Math.max(1, lines.length) - 1) * 22, 9, 15);
  }
  // Patience.
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = COLOURS.amberDim;
  ctx.textAlign = 'right';
  ctx.fillText(patienceLabel, W - 46, 110);
  const bw = 220;
  const bx = W - 46 - bw - ctx.measureText(patienceLabel).width - 12;
  ctx.strokeStyle = COLOURS.amberDim;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, 101.5, bw, 9);
  ctx.fillStyle = patience < 0.3 ? COLOURS.red : patience < 0.6 ? COLOURS.amber : COLOURS.ph2;
  ctx.globalAlpha = patience < 0.3 && Math.floor(time * 3) % 2 === 0 ? 0.55 : 1;
  ctx.fillRect(bx + 1, 102.5, (bw - 2) * clamp(patience, 0, 1), 7);
  ctx.restore();
}

/** The multiplier in phosphor, its label, and the word for the round under it. */
export function drawReadout(ctx: CanvasRenderingContext2D, x100: number, punch: number, colour: string, label: string): void {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOURS.dim;
  ctx.font = `11px ${MONO}`;
  ctx.fillText(label, W - 44, 154);
  ctx.fillStyle = colour;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 18;
  ctx.font = `700 ${64 * (1 + 0.22 * punch)}px ${MONO}`;
  ctx.fillText(formatX(x100), W - 40, 216);
  ctx.restore();
}

/** The title block at the left of the picture. */
export function drawTitle(ctx: CanvasRenderingContext2D, sub: string): void {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOURS.ph;
  ctx.shadowColor = COLOURS.ph;
  ctx.shadowBlur = 14;
  ctx.font = `700 40px ${MONO}`;
  ctx.fillText('TROLLEY.EXE', 40, 184);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLOURS.amber;
  ctx.font = `12px ${MONO}`;
  ctx.fillText(sub, 42, 206);
  ctx.restore();
}

/** A stamp that pops in: a boxed line of text. */
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

/** The line at the foot of the picture: your stake, your lever, your outcome. */
export function drawFootLine(ctx: CanvasRenderingContext2D, text: string, colour: string): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colour;
  ctx.font = `600 18px ${MONO}`;
  ctx.fillText(text, W / 2, 500, W - 80);
  ctx.restore();
}

// ─── The crash ──────────────────────────────────────────────────────────────────────────────────────────

/** Tears the picture: strips of the frame so far, shifted sideways, with a few phosphor blocks. */
export function drawGlitch(ctx: CanvasRenderingContext2D, amount: number, seed: number): void {
  if (amount <= 0.01) return;
  const m = ctx.getTransform();
  const sx = m.a, sy = m.d, ox = m.e, oy = m.f;
  const canvas = ctx.canvas;
  const bands = 7;
  for (let i = 0; i < bands; i += 1) {
    const r1 = hash(seed * 3 + i * 7), r2 = hash(seed * 5 + i * 11), r3 = hash(seed * 7 + i * 13);
    if (r3 > 0.3 + 0.6 * amount) continue;
    const y = r1 * (H - 40);
    const h = 6 + r2 * 34;
    const dx = (r3 - 0.5) * 120 * amount;
    const srcW = canvas.width - Math.abs(dx) * sx;
    const srcX = ox + Math.max(0, -dx) * sx;
    const dstX = Math.max(0, dx);
    try {
      ctx.drawImage(canvas, srcX, oy + y * sy, srcW, h * sy, dstX, y, srcW / sx, h);
    } catch {
      // A detached or zero-sized canvas has nothing to tear.
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.5 * amount;
  ctx.fillStyle = COLOURS.ph;
  for (let i = 0; i < 5; i += 1) {
    const r = hash(seed * 11 + i * 17);
    if (r > amount) continue;
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
  ctx.fillText("We're collecting your sins, and then we'll restart for you.", 70, 198);
  ctx.globalAlpha = 1;
  // The percentage climbs in uneven steps once the screen is up, and stalls where it must.
  const steps = [0, 13, 27, 27, 45, 66, 66, 66.6, 66.6, 84, 99, 99, 100];
  const k = clamp(Math.floor((t - 0.4) / 0.16), 0, steps.length - 1);
  ctx.font = `20px ${SANS}`;
  ctx.fillText(`${t < 0.4 ? 0 : steps[k]}% complete`, 70, 236);
  // The findings type in from 0.4 s, fast enough to finish before a live round's next betting phase.
  const shown = clamp((t - 0.4) * 170, 0, 9999);
  const lines = [`Stop code: ${info.code}`, info.detail, `Crashed at ${info.crashedAt}`, `What failed: ${info.failed}`, '', 'Divine trace (most recent sin first):', ...info.trace.map((l) => `  at God.say("${l}")`), '  at God.judge (heaven.js:∞)'];
  ctx.font = `14px ${MONO}`;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(70, 254, W - 140, 14 + lines.length * 19);
  ctx.fillStyle = COLOURS.white;
  let budget = shown;
  lines.forEach((line, i) => {
    if (budget <= 0) return;
    const part = line.slice(0, Math.floor(budget));
    budget -= line.length + 3;
    ctx.fillText(part, 82, 274 + i * 19, W - 164);
  });
  if (t > 2.3 && Math.floor(time * 1.5) % 2 === 0) {
    ctx.font = `16px ${SANS}`;
    ctx.fillText('Press any key to be reincarnated. It will not help.', 70, H - 40);
  }
  ctx.restore();
}
