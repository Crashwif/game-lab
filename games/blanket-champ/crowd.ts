/**
 * The crowd: three bleacher rows of Wojak fans with foam fingers and signs,
 * a commentary booth, a bookie, and your supporter in the front row. The
 * crowd bobs harder as the tempo rises, does the wave at milestones, and at
 * the finish either cheers or puts its heads in its hands. An accepted exit
 * walks your supporter to the bookie for the bag and the shades.
 */
import { type Spring, clamp, mix, noise, settleSpring, spring, stepSpring } from './motion';

const INK = '#1c1f26';
const SIGNS = ['HODL', 'DIAMOND HANDS', "DON'T PULL OUT EARLY", 'WAGMI', 'GM CHAMP', 'LFG', 'NUMBER GO UP', 'BUILT DIFFERENT'];
const ROWS = [{ y: 262, scale: 1, count: 12 }, { y: 218, scale: 0.86, count: 13 }, { y: 180, scale: 0.74, count: 14 }];
export const SUPPORTER = { row: 0, index: 5 };
const BOOKIE_X = 904;

export type SupporterMode = 'seated' | 'walking' | 'collecting' | 'done';

export interface CrowdState {
  time: number;
  cheer: number;
  wave: number;
  waveAt: number;
  sulk: Spring;
  hype: Spring;
  supporter: { mode: SupporterMode; x: number; modeAge: number; shades: Spring; ticket: boolean };
  bookiePop: Spring;
}

export function createCrowd(): CrowdState {
  return { time: 0, cheer: 0, wave: -1, waveAt: 0, sulk: spring(0), hype: spring(0), supporter: { mode: 'seated', x: 0, modeAge: 0, shades: spring(0), ticket: true }, bookiePop: spring(0) };
}

function fanX(row: number, index: number): number {
  const r = ROWS[row]!;
  return 90 + (index + 0.5) * (780 / r.count);
}

export function resetCrowd(c: CrowdState): void {
  c.wave = -1;
  settleSpring(c.sulk, 0);
  settleSpring(c.hype, 0);
  c.supporter = { mode: 'seated', x: fanX(SUPPORTER.row, SUPPORTER.index), modeAge: 0, shades: spring(0), ticket: true };
  settleSpring(c.bookiePop, 0);
}

/** The exit was accepted: go and collect. */
export function collectWinnings(c: CrowdState): void {
  if (c.supporter.mode === 'seated') { c.supporter.mode = 'walking'; c.supporter.modeAge = 0; }
}

/** The champ finished. */
export function finishCrowd(c: CrowdState, cheerful: boolean, quiet: boolean): void {
  if (cheerful) { c.hype.v += quiet ? 0 : 12; settleSpring(c.hype, 1); }
  else settleSpring(c.sulk, quiet ? 1 : 0), (c.sulk.v += quiet ? 0 : 10);
  c.supporter.ticket = false;
}

export function stepCrowd(c: CrowdState, tension: number, multiplier: number, beat: boolean, running: boolean, dt: number): void {
  c.time += dt;
  c.cheer += ((running ? 0.2 + 0.8 * tension : 0.05) - c.cheer) * (1 - Math.exp(-dt / 0.8));
  if (running && multiplier >= 3 && c.time > c.waveAt && c.wave < 0) { c.wave = 0; c.waveAt = c.time + 9; }
  if (c.wave >= 0) { c.wave += dt / 1.6; if (c.wave > 1.3) c.wave = -1; }
  stepSpring(c.sulk, c.sulk.x > 0.5 ? 1 : 0, 6, 0.7, dt);
  stepSpring(c.hype, c.hype.x > 0.5 ? 1 : 0, 6, 0.7, dt);
  const s = c.supporter;
  s.modeAge += dt;
  if (s.mode === 'walking') {
    s.x = Math.min(BOOKIE_X - 40, s.x + 190 * dt);
    if (s.x >= BOOKIE_X - 40) { s.mode = 'collecting'; s.modeAge = 0; c.bookiePop.v += 10; }
  } else if (s.mode === 'collecting') {
    if (s.modeAge > 0.8) { s.mode = 'done'; s.modeAge = 0; }
  } else if (s.mode === 'done') {
    stepSpring(s.shades, 1, 12, 0.5, dt);
  }
  stepSpring(c.bookiePop, 0, 8, 0.5, dt);
  void beat;
}

function drawFan(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, seed: number, bob: number, mood: 'calm' | 'hype' | 'sulk' | 'shock', prop: 'finger' | 'sign' | 'none', signText: string, special: boolean, shades: number): void {
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const tone = noise(seed * 3.3);
  const skin = tone > 0.66 ? '#f3dccb' : tone > 0.33 ? '#e0bda7' : '#c68e6a';
  const shirt = special ? '#ffe27a' : ['#e63946', '#3b82f6', '#2e8b57', '#7c3aed', '#f2c14e'][Math.floor(noise(seed * 7.1) * 5)]!;
  if (prop === 'finger') {
    const fy = -70 - (mood === 'hype' ? 10 : 0);
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(18, -30); ctx.lineTo(22, fy + 10); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ff5d9e'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(12, fy - 6, 20, 24, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(18, fy - 22, 8, 20, 4); ctx.fill(); ctx.stroke();
  } else if (prop === 'sign') {
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(-14, -66); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-52, -92, 76, 28, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 10px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(signText, -14, -74, 70);
  }
  ctx.fillStyle = shirt; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-18, -30, 36, 30, 8); ctx.fill(); ctx.stroke();
  const sulk = mood === 'sulk' ? 1 : 0;
  ctx.beginPath(); ctx.ellipse(0, -44 + sulk * 10, 14, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
  if (sulk) {
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-16, -28); ctx.lineTo(-8, -46); ctx.moveTo(16, -28); ctx.lineTo(8, -46); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 4; ctx.stroke();
  } else {
    ctx.fillStyle = INK;
    const open = mood === 'shock' ? 1.6 : 1;
    for (const ex of [-5, 5]) { ctx.beginPath(); ctx.ellipse(ex, -47, 2, 2 * open, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (mood === 'hype') { ctx.ellipse(0, -36, 5, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else if (mood === 'shock') { ctx.ellipse(0, -35, 4, 5, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else { ctx.moveTo(-5, -37); ctx.quadraticCurveTo(0, -33, 5, -37); }
    ctx.stroke();
    if (shades > 0.02) {
      const dy = -30 * (1 - shades);
      ctx.fillStyle = INK;
      ctx.fillRect(-10, -50 + dy, 8, 5);
      ctx.fillRect(2, -50 + dy, 8, 5);
      ctx.fillRect(-2, -49 + dy, 4, 2);
    }
  }
  const hat = Math.floor(noise(seed * 11.3) * 3);
  if (hat === 1) { ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.roundRect(-14, -66, 28, 10, 4); ctx.fill(); ctx.stroke(); ctx.fillRect(4, -60, 18, 4); }
  if (hat === 2) { ctx.fillStyle = '#ff7ab8'; ctx.beginPath(); ctx.arc(0, -58, 14, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -72, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

export function drawBleachers(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#4a5560';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const [i, r] of ROWS.entries()) {
    ctx.beginPath(); ctx.roundRect(70 - i * 6, r.y - 2, 820 + i * 12, 30, 3); ctx.fill(); ctx.stroke();
  }
}

export function drawCrowd(ctx: CanvasRenderingContext2D, c: CrowdState, finished: boolean, cheerful: boolean): void {
  for (let row = ROWS.length - 1; row >= 0; row -= 1) {
    const r = ROWS[row]!;
    for (let i = 0; i < r.count; i += 1) {
      const seed = row * 100 + i;
      const isSupporter = row === SUPPORTER.row && i === SUPPORTER.index;
      if (isSupporter && c.supporter.mode !== 'seated') continue;
      const phase = c.time * (4 + 6 * c.cheer) + i * 0.7 + row;
      let bob = Math.max(0, Math.sin(phase)) * 8 * c.cheer;
      if (c.wave >= 0) {
        const at = c.wave * 1.3;
        const d = Math.abs(i / r.count - at);
        bob += Math.max(0, 1 - d / 0.12) * 26;
      }
      if (c.hype.x > 0.05) bob += Math.max(0, Math.sin(c.time * 10 + i)) * 16 * c.hype.x;
      const mood = finished ? (cheerful ? 'hype' : c.sulk.x > 0.5 ? 'sulk' : 'shock') : c.cheer > 0.7 ? 'hype' : 'calm';
      const propRoll = noise(seed * 5.7);
      const prop = propRoll > 0.72 ? 'sign' : propRoll > 0.4 ? 'finger' : 'none';
      drawFan(ctx, fanX(row, i), r.y, r.scale, seed, bob, isSupporter && finished && !cheerful ? 'sulk' : mood, isSupporter ? 'finger' : prop, SIGNS[Math.floor(noise(seed * 2.1) * SIGNS.length)]!, isSupporter, isSupporter ? clamp(c.supporter.shades.x, 0, 1) : 0);
    }
  }
  // Your supporter on the move: along the front row to the bookie, then done.
  const s = c.supporter;
  if (s.mode !== 'seated') {
    const stride = s.mode === 'walking' ? Math.abs(Math.sin(c.time * 12)) * 6 : 0;
    drawFan(ctx, s.x, ROWS[0]!.y - 12, 1, 5, stride, s.mode === 'done' ? 'hype' : 'calm', s.mode === 'done' ? 'finger' : 'none', '', true, clamp(s.shades.x, 0, 1));
  }
  // The bookie with the BETS sign and the bag he hands over.
  ctx.save();
  ctx.translate(BOOKIE_X, ROWS[0]!.y);
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-30, -20, 60, 44, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BETS', 0, 6);
  ctx.restore();
  drawFan(ctx, BOOKIE_X, ROWS[0]!.y - 12, 0.95, 77, 0, 'calm', 'none', '', false, 1);
  const pop = clamp(c.bookiePop.x, 0, 1.2);
  if (pop > 0.02 || s.mode === 'done') {
    ctx.save();
    ctx.translate(BOOKIE_X - 34, ROWS[0]!.y - 40 - pop * 10);
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-16, 22, 0, 26); ctx.quadraticCurveTo(16, 22, 10, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c';
    ctx.font = '900 12px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 18);
    ctx.restore();
  }
}

/** Two commentators in a booth with a LIVE light and a rolling caption. */
export function drawBooth(ctx: CanvasRenderingContext2D, c: CrowdState, line: string): void {
  ctx.save();
  ctx.translate(770, 18);
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(0, 0, 180, 92, 6); ctx.fill(); ctx.stroke();
  for (const [x, seed] of [[50, 31], [130, 47]] as const) {
    drawFan(ctx, x, 78, 0.62, seed, 0, c.cheer > 0.6 ? 'hype' : 'calm', 'none', '', false, 0);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, 50, 10, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 10, 50); ctx.lineTo(x - 6, 58); ctx.stroke();
  }
  // The caption strip sits in front of the desk, so the commentators end at the desk edge.
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(8, 58, 164, 26, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = Math.floor(c.time * 2) % 2 ? '#e63946' : '#7a1a24';
  ctx.beginPath(); ctx.arc(20, 14, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LIVE', 30, 18);
  ctx.fillStyle = '#ffe27a';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(line, 90, 75, 156);
  ctx.restore();
  void mix;
}
