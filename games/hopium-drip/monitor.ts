/**
 * The bedside monitor: an EKG trace whose beat rate follows the displayed
 * multiplier, the vitals readouts, the dose ladder that pulses at each
 * milestone, and the crash: a seeded scribble, then the long flat line.
 * Nothing here changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, spring, stepSpring } from './motion';
import { INK } from './ward';

export const PANEL = { x: 640, y: 0, w: 320, h: 540 } as const;
const TRACE = { x: 656, y: 70, w: 288, h: 150 } as const;
export const DOSES = [1.5, 2, 3, 5, 8, 13, 21, 34, 55];

export interface Monitor {
  time: number;
  /** Phase of the heartbeat in beats. */
  phase: number;
  /** The trace as a ring of samples, one per pixel column. */
  samples: Float32Array;
  head: number;
  bpm: Spring;
  doseIndex: number;
  goal: number;
  fill: Spring;
  pulse: Spring;
  flat: boolean;
  flatAge: number;
  scribble: number[];
  alarm: number;
  discharged: boolean;
}

export function createMonitor(): Monitor {
  return { time: 0, phase: 0, samples: new Float32Array(TRACE.w), head: 0, bpm: spring(72), doseIndex: 0, goal: DOSES[0]!, fill: spring(0), pulse: spring(0), flat: false, flatAge: 0, scribble: [], alarm: 0, discharged: false };
}

export function resetMonitor(m: Monitor): void {
  m.phase = 0;
  m.samples.fill(0);
  m.head = 0;
  settleSpring(m.bpm, 72);
  m.doseIndex = 0;
  m.goal = DOSES[0]!;
  settleSpring(m.fill, 0);
  settleSpring(m.pulse, 0);
  m.flat = false;
  m.flatAge = 0;
  m.scribble = [];
  m.alarm = 0;
  m.discharged = false;
}

/** Jumps the dose ladder to where a multiplier already is. */
export function settleMonitor(m: Monitor, multiplier: number): void {
  while (m.doseIndex < DOSES.length - 1 && multiplier >= m.goal) { m.doseIndex += 1; m.goal = DOSES[m.doseIndex]!; }
  settleSpring(m.bpm, 72 + 90 * clamp(Math.log2(multiplier) / 3.3, 0, 1));
}

/** The player was discharged: the monitor reads it and stops caring. */
export function dischargeMonitor(m: Monitor): void {
  m.discharged = true;
}

/** The flatline. `quiet` skips the scribble for a crash that already happened. */
export function flatlineMonitor(m: Monitor, seed: number, quiet: boolean): void {
  if (m.flat) return;
  m.flat = true;
  m.flatAge = quiet ? 10 : 0;
  const rng = mulberry32(seed);
  m.scribble = [];
  if (!quiet) for (let i = 0; i < 40; i += 1) m.scribble.push((rng() - 0.5) * 2);
  if (quiet) m.samples.fill(0);
  settleSpring(m.fill, 0);
}

export interface MonitorDrive { running: boolean; multiplier: number; tension: number }

/** Returns true on the frame a dose milestone is reached. */
export function stepMonitor(m: Monitor, drive: MonitorDrive, dt: number): boolean {
  m.time += dt;
  let reached = false;
  const targetBpm = m.flat ? 0 : drive.running ? 72 + 90 * drive.tension + 40 * clamp(drive.tension - 0.7, 0, 1) : 72;
  stepSpring(m.bpm, targetBpm, 3, 1, dt);
  if (drive.running && !m.flat && drive.multiplier >= m.goal && m.doseIndex < DOSES.length - 1) {
    m.doseIndex += 1;
    m.goal = DOSES[m.doseIndex]!;
    reached = true;
    m.pulse.v += 12;
  }
  const previous = m.doseIndex === 0 ? 1 : DOSES[m.doseIndex - 1]!;
  stepSpring(m.fill, m.flat ? 0 : clamp((drive.multiplier - previous) / (m.goal - previous), 0, 1), 8, 0.9, dt);
  stepSpring(m.pulse, 0, 10, 0.4, dt);
  if (m.flat) m.flatAge += dt;
  // Advance the trace: pixels per second scale with the beat so the shape stays readable.
  const speed = 90 + m.bpm.x * 0.6;
  const columns = speed * dt;
  const whole = Math.floor(columns + (m.head % 1));
  const beatsPerSecond = m.bpm.x / 60;
  for (let i = 0; i < whole; i += 1) {
    m.phase += beatsPerSecond * (1 / speed);
    const ph = m.phase % 1;
    let v = 0;
    if (m.flat) {
      const s = m.scribble;
      v = m.flatAge < 0.9 && s.length ? s[Math.floor(noise(m.phase * 91) * s.length)]! * (1 - m.flatAge / 0.9) : 0;
    } else {
      // P wave, QRS complex, T wave; taller and sharper with the tension.
      const amp = 0.5 + 0.5 * drive.tension;
      if (ph > 0.1 && ph < 0.2) v = Math.sin((ph - 0.1) * Math.PI * 10) * 0.12;
      else if (ph > 0.26 && ph < 0.3) v = -((ph - 0.26) / 0.04) * 0.18;
      else if (ph >= 0.3 && ph < 0.34) v = -0.18 + ((ph - 0.3) / 0.04) * (1.18 * amp + 0.18);
      else if (ph >= 0.34 && ph < 0.38) v = amp - ((ph - 0.34) / 0.04) * (amp + 0.3);
      else if (ph >= 0.38 && ph < 0.42) v = -0.3 + ((ph - 0.38) / 0.04) * 0.3;
      else if (ph > 0.55 && ph < 0.72) v = Math.sin((ph - 0.55) * Math.PI / 0.17) * 0.22;
      v += (noise(m.phase * 37) - 0.5) * 0.05 * drive.tension;
    }
    m.samples[Math.floor(m.head) % TRACE.w] = v;
    m.head = (Math.floor(m.head) + 1) % TRACE.w;
  }
  m.head = Math.floor(m.head) + (columns + (m.head % 1)) % 1;
  return reached;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left', mono = false): void {
  ctx.font = `700 ${size}px ${mono ? 'ui-monospace, Menlo, Consolas, monospace' : 'system-ui, sans-serif'}`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function readout(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, value: string, unit: string, colour: string, blink: boolean): void {
  ctx.fillStyle = '#101a1f';
  ctx.beginPath(); ctx.roundRect(x, y, 136, 64, 6); ctx.fill();
  ctx.strokeStyle = blink ? colour : '#22333a'; ctx.lineWidth = 2; ctx.stroke();
  label(ctx, title, x + 10, y + 18, 11, colour);
  label(ctx, value, x + 10, y + 50, 26, blink ? '#ffffff' : colour, 'left', true);
  ctx.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
  const w = ctx.measureText(value).width;
  label(ctx, unit, x + 14 + w, y + 50, 11, '#9aa7b5');
}

/** The monitor panel: the trace, the vitals, the dose ladder. */
export function drawMonitor(ctx: CanvasRenderingContext2D, m: Monitor, multiplier: number, tension: number, reduced: boolean): void {
  ctx.save();
  ctx.fillStyle = '#0b1418';
  ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  // Header.
  ctx.fillStyle = '#132027';
  ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, 54);
  const alarm = m.flat && !reduced ? Math.floor(m.time * 4) % 2 === 0 : false;
  ctx.fillStyle = m.flat ? (alarm ? '#e63946' : '#7a1f28') : m.discharged ? '#2e8b57' : tension > 0.7 ? '#e6a23c' : '#2e8b57';
  ctx.beginPath(); ctx.roundRect(PANEL.x + 14, 14, 92, 24, 5); ctx.fill();
  label(ctx, m.flat ? 'ASYSTOLE' : m.discharged ? 'DISCHARGED' : tension > 0.7 ? 'UNSTABLE' : 'MONITORING', PANEL.x + 60, 31, 11, '#ffffff', 'center');
  label(ctx, 'bed 2 · $HOPE', PANEL.x + 118, 31, 13, '#c9d6dc');
  label(ctx, `${multiplier.toFixed(2)}×`, PANEL.x + PANEL.w - 14, 32, 15, m.flat ? '#ff4d6d' : '#7cf67c', 'right', true);
  // The trace screen.
  ctx.fillStyle = '#04100c';
  ctx.beginPath(); ctx.roundRect(TRACE.x, TRACE.y, TRACE.w, TRACE.h, 6); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(TRACE.x, TRACE.y, TRACE.w, TRACE.h, 6); ctx.clip();
  ctx.strokeStyle = 'rgba(124, 246, 124, 0.12)'; ctx.lineWidth = 1;
  for (let gx = 0; gx < TRACE.w; gx += 24) { ctx.beginPath(); ctx.moveTo(TRACE.x + gx, TRACE.y); ctx.lineTo(TRACE.x + gx, TRACE.y + TRACE.h); ctx.stroke(); }
  for (let gy = 0; gy < TRACE.h; gy += 24) { ctx.beginPath(); ctx.moveTo(TRACE.x, TRACE.y + gy); ctx.lineTo(TRACE.x + TRACE.w, TRACE.y + gy); ctx.stroke(); }
  const mid = TRACE.y + TRACE.h * 0.62;
  const scale = TRACE.h * 0.42;
  const colour = m.flat ? '#ff4d6d' : m.discharged ? '#8fd3ff' : '#7cf67c';
  ctx.strokeStyle = colour; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
  ctx.shadowColor = colour; ctx.shadowBlur = reduced ? 0 : 6;
  ctx.beginPath();
  const head = Math.floor(m.head);
  for (let i = 0; i < TRACE.w; i += 1) {
    const idx = (head + i) % TRACE.w;
    const y = mid - m.samples[idx]! * scale;
    if (i === 0) ctx.moveTo(TRACE.x + i, y); else ctx.lineTo(TRACE.x + i, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Sweep gap at the head.
  ctx.fillStyle = '#04100c';
  ctx.fillRect(TRACE.x + TRACE.w - 1, TRACE.y, 2, TRACE.h);
  if (m.flat && m.flatAge > 0.9) {
    ctx.fillStyle = alarm ? 'rgba(230, 57, 70, 0.18)' : 'rgba(230, 57, 70, 0.08)';
    ctx.fillRect(TRACE.x, TRACE.y, TRACE.w, TRACE.h);
    ctx.font = '900 30px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText('FLATLINE', TRACE.x + TRACE.w / 2, TRACE.y + 44);
    ctx.fillStyle = '#ff4d6d'; ctx.fillText('FLATLINE', TRACE.x + TRACE.w / 2, TRACE.y + 44);
    label(ctx, 'beeeeeeeeeeeeeeeeeeeeeeeeeeeeep', TRACE.x + TRACE.w / 2, TRACE.y + TRACE.h - 10, 10, '#ff9db0', 'center', true);
  }
  // Scanline flicker.
  if (!reduced) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(TRACE.x, TRACE.y + ((m.time * 60) % TRACE.h), TRACE.w, 3); }
  ctx.restore();
  ctx.strokeStyle = '#22333a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(TRACE.x, TRACE.y, TRACE.w, TRACE.h, 6); ctx.stroke();
  // Vitals.
  const bpm = Math.round(m.bpm.x);
  const hopium = m.flat ? 0 : Math.round(clamp(1 - tension * 0.95, 0, 1) * 100);
  const unstable = tension > 0.7 && !m.flat && !reduced ? Math.floor(m.time * 3) % 2 === 0 : false;
  readout(ctx, PANEL.x + 14, 236, 'HEART', m.flat ? '0' : `${bpm}`, 'bpm', m.flat ? '#ff4d6d' : '#7cf67c', unstable || alarm);
  readout(ctx, PANEL.x + 166, 236, 'HOPIUM', `${hopium}`, '%', hopium < 30 ? '#ffe27a' : '#8fd3ff', unstable && hopium < 30);
  readout(ctx, PANEL.x + 14, 310, 'COPE', m.flat ? 'MAX' : `${Math.round(tension * 100)}`, m.flat ? '' : '%', '#ff9db0', false);
  readout(ctx, PANEL.x + 166, 310, 'DOSES', `${m.doseIndex}`, `/ ${DOSES.length - 1}`, '#c9a2ff', clamp(m.pulse.x, 0, 1) > 0.3);
  // Dose ladder.
  const fill = clamp(m.fill.x, 0, 1);
  ctx.fillStyle = '#132027';
  ctx.fillRect(PANEL.x, PANEL.h - 150, PANEL.w, 150);
  label(ctx, m.flat ? 'DOSE DISCONTINUED' : m.discharged ? 'DISCHARGED · NO MORE DOSES' : `NEXT DOSE AT ${m.goal.toFixed(1)}×`, PANEL.x + 14, PANEL.h - 122, 13, m.flat ? '#ff4d6d' : '#ffffff');
  label(ctx, `${Math.round(fill * 100)}%`, PANEL.x + PANEL.w - 14, PANEL.h - 122, 13, '#7cf67c', 'right', true);
  ctx.fillStyle = '#23343c';
  ctx.beginPath(); ctx.roundRect(PANEL.x + 14, PANEL.h - 108, PANEL.w - 28, 18, 9); ctx.fill();
  const g = ctx.createLinearGradient(PANEL.x + 14, 0, PANEL.x + PANEL.w - 14, 0);
  g.addColorStop(0, '#7cf67c'); g.addColorStop(1, '#c9a2ff');
  ctx.fillStyle = g;
  if (fill > 0.01) { ctx.beginPath(); ctx.roundRect(PANEL.x + 14, PANEL.h - 108, (PANEL.w - 28) * fill, 18, 9); ctx.fill(); }
  // The ladder of vials, filled as taken.
  for (let i = 0; i < DOSES.length; i += 1) {
    const vx = PANEL.x + 22 + i * 32;
    const taken = i < m.doseIndex;
    const pulse = i === m.doseIndex - 1 ? clamp(m.pulse.x, 0, 1) : 0;
    ctx.save();
    ctx.translate(vx, PANEL.h - 52 - pulse * 6);
    ctx.fillStyle = taken ? (m.flat ? '#7a1f28' : '#7cf67c') : '#23343c'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-8, -18, 16, 30, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9aa7b5'; ctx.beginPath(); ctx.roundRect(-5, -24, 10, 7, 2); ctx.fill(); ctx.stroke();
    label(ctx, `${DOSES[i]}×`, 0, 28, 9, taken ? '#ffffff' : '#6b7a84', 'center', true);
    ctx.restore();
  }
  label(ctx, m.flat ? 'nurse, the paperwork' : 'nurse, one more dose please', PANEL.x + 14, PANEL.h - 8, 10, '#6b7a84');
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.strokeRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  ctx.restore();
  void mix;
}
