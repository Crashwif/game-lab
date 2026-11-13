import { pageAudio } from './audio';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose?(): void;
}

const COLOURS = {
  bgDeep: '#080814',
  matrixUv: '#9d4edd',
  cyanWafer: '#00f5d4',
  goldDie: '#ffd166',
  warningRed: '#ff0054',
  textLight: '#f8f9fa',
  textMuted: '#9aa5b8',
  cashoutGreen: '#52b788',
  rackMetal: '#1c1f30',
  quarantineYellow: '#ffbe0b',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Scraping open weights repo at 3 AM'],
  [150, 'Floating point tensor anomaly detected'],
  [200, 'Seed match found across 100 billion weights'],
  [250, 'Statistical sigma passes 20 standard devs'],
  [300, 'Liquid-cooled server heat signature logged'],
  [500, 'B300 silicon layout fingerprint verified'],
  [1000, 'Correlation hits 0.999995 across clusters'],
  [10000, 'Half-billion export contraband fully mapped'],
  [100000, 'Over one thousand sigma proof confirmed'],
  [1000000, 'Global AI hardware diplomacy completely implodes'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`Paper Published at ${formatX(view.cashoutX100)} · Tenure Secured!`, COLOURS.cashoutGreen];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Raid cleared the lab · you were spectating' : 'Auditing remotely · 0 credits staked', COLOURS.textMuted];
  }
  if (view.phase === 'crashed') {
    return [`Hardware Seized! Your ${credits(view.stake)} locked in quarantine`, COLOURS.warningRed];
  }
  return [`Forensics in progress · ${credits(view.stake)} staked`, COLOURS.cyanWafer];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'siren' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastScanTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 4);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;
    if (milestoneIndex > prevMilestone && running) {
      audio.milestone(milestoneIndex);
      audio.fx('zap', 0.5 + 0.5 * tension);
    }
    if (running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('siren', view.crashAge > 1200);
      audio.fx('clang', 0.8);
    }

    // High frequency scan tick sound
    const scanPeriod = Math.max(120, 420 - tension * 300);
    if (running && !cashed && now - lastScanTick > scanPeriod) {
      audio.fx('tick', 0.2 + 0.4 * tension);
      lastScanTick = now;
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? Math.sin(crashSec * 45) * 14 * clamp01(1 - crashSec / 0.8) : 0;
    const raidFlash = crashed ? Math.sin(crashSec * 16) > 0 : false;

    ctx.save();
    ctx.translate(shake, shake * 0.4);

    // Dark forensic lab backdrop
    const bgGrad = ctx.createRadialGradient(480, 260, 50, 480, 270, 500);
    bgGrad.addColorStop(0, '#15132d');
    bgGrad.addColorStop(0.7, '#080816');
    bgGrad.addColorStop(1, '#03030a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Background Server Racks with pulsating activity LEDs
    for (let side = 0; side < 2; side++) {
      const rx = side === 0 ? 30 : 810;
      ctx.fillStyle = COLOURS.rackMetal;
      ctx.fillRect(rx, 60, 120, 420);
      ctx.strokeStyle = '#2d334d';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, 60, 120, 420);

      // Liquid cooling tubes
      const glowCol = crashed ? '#ff0054' : (side === 0 ? COLOURS.cyanWafer : COLOURS.matrixUv);
      ctx.strokeStyle = glowCol;
      ctx.lineWidth = 4;
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(rx + 15, 70);
      ctx.bezierCurveTo(rx + 5, 200, rx + 25, 340, rx + 15, 470);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Status blinks
      for (let slot = 0; slot < 8; slot++) {
        const sy = 80 + slot * 48;
        ctx.fillStyle = '#0f121d';
        ctx.fillRect(rx + 28, sy, 82, 38);
        const blink = Math.sin(now * 0.008 + slot * 1.5 + side * 3) > 0.1;
        ctx.fillStyle = crashed ? (raidFlash ? '#ff0044' : '#440011') : (blink ? COLOURS.cyanWafer : '#1b4332');
        ctx.fillRect(rx + 92, sy + 14, 8, 8);
      }
    }

    // Microscope Wafer Viewport in center
    const cx = 480;
    const cy = 250;
    const lensR = 155;

    // Outer metal aperture
    ctx.strokeStyle = '#272d42';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, lensR + 7, 0, Math.PI * 2);
    ctx.stroke();

    // Microscope screen clipping
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, lensR, 0, Math.PI * 2);
    ctx.clip();

    // UV / Wafer matrix background
    ctx.fillStyle = '#0b001a';
    ctx.fillRect(cx - lensR, cy - lensR, lensR * 2, lensR * 2);

    // Silicon wafer die circuits escalates with depth & tension
    const rot = (view.elapsed * 0.0004) * (1 + tension * 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    ctx.strokeStyle = `rgba(157, 78, 221, ${0.25 + depth * 0.5})`;
    ctx.lineWidth = 1.5;
    const gridSize = 24;
    for (let gx = -140; gx <= 140; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, -140);
      ctx.lineTo(gx, 140);
      ctx.moveTo(-140, gx);
      ctx.lineTo(140, gx);
      ctx.stroke();
    }

    // Silicon core micro-circuits
    ctx.strokeStyle = crashed ? COLOURS.warningRed : COLOURS.cyanWafer;
    ctx.lineWidth = 2;
    for (let c = 0; c < 4; c++) {
      const cr = 35 + c * 26 * (1 - depth * 0.2);
      ctx.strokeRect(-cr, -cr, cr * 2, cr * 2);
    }
    ctx.restore();

    // Floating tensor hex code rain
    ctx.fillStyle = COLOURS.matrixUv;
    ctx.font = '11px monospace';
    const hexSamples = ['0x3C00', 'FP16', 'B300', 'W_GATE', 'SIG:99.8σ', 'EXP_CTRL'];
    for (let i = 0; i < 6; i++) {
      const hx = cx - 110 + (i % 3) * 80;
      const hy = cy - 80 + Math.floor(i / 3) * 110 + Math.sin(now * 0.003 + i) * 12;
      const hexText = hexSamples[i] ?? '0x0000';
      ctx.fillText(hexText, hx, hy);
    }

    // Microscope crosshairs and targeting hud
    ctx.strokeStyle = crashed ? 'rgba(255, 0, 84, 0.7)' : 'rgba(0, 245, 212, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - lensR, cy);
    ctx.lineTo(cx + lensR, cy);
    ctx.moveTo(cx, cy - lensR);
    ctx.lineTo(cx, cy + lensR);
    ctx.stroke();

    // Reticle brackets
    ctx.strokeStyle = COLOURS.goldDie;
    ctx.strokeRect(cx - 45, cy - 45, 90, 90);
    ctx.restore(); // lens clip

    // Sleep-deprived Forensic Researcher (Lower Center)
    const bob = Math.sin(view.elapsed * 0.005) * (running ? 3 : 1);
    const px = 480;
    const py = 390 + bob;

    // Lab coat shoulders
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.ellipse(px, py + 95, 110, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // White lab coat collar
    ctx.fillStyle = '#edf2f4';
    ctx.beginPath();
    ctx.moveTo(px - 45, py + 70);
    ctx.lineTo(px, py + 120);
    ctx.lineTo(px + 45, py + 70);
    ctx.lineTo(px + 60, py + 130);
    ctx.lineTo(px - 60, py + 130);
    ctx.closePath();
    ctx.fill();

    // Face / Head
    ctx.fillStyle = '#ffcca7';
    ctx.beginPath();
    ctx.arc(px, py + 40, 36, 0, Math.PI * 2);
    ctx.fill();

    // Messy exhausted hair
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.arc(px, py + 22, 40, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    // Wild hair spikes
    ctx.beginPath();
    ctx.moveTo(px - 36, py + 22);
    ctx.lineTo(px - 46, py + 2);
    ctx.lineTo(px - 26, py + 15);
    ctx.lineTo(px - 10, py - 5);
    ctx.lineTo(px + 10, py + 10);
    ctx.lineTo(px + 38, py + 2);
    ctx.lineTo(px + 36, py + 24);
    ctx.fill();

    // UV Forensic Goggles
    ctx.fillStyle = '#111';
    ctx.fillRect(px - 38, py + 30, 76, 18);
    ctx.fillStyle = crashed ? COLOURS.warningRed : (cashed ? COLOURS.cashoutGreen : COLOURS.matrixUv);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    // Dual lenses
    ctx.beginPath();
    ctx.roundRect(px - 34, py + 32, 30, 14, 4);
    ctx.roundRect(px + 4, py + 32, 30, 14, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Sweat drop when tension is high
    if (tension > 0.4 && !crashed && !cashed) {
      ctx.fillStyle = '#80ed99';
      ctx.beginPath();
      ctx.arc(px + 38, py + 44 + ((now * 0.05) % 15), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cashout Escaped Cyber-Van / Scoop banner
    if (cashed) {
      ctx.fillStyle = 'rgba(7, 43, 28, 0.9)';
      ctx.strokeStyle = COLOURS.cashoutGreen;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(240, 180, 480, 100, 12);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#d8f3dc';
      ctx.font = '700 24px monospace';
      ctx.fillText('SUBSTACK FORENSIC SCOOP PUBLISHED', 480, 218);
      ctx.font = '600 16px sans-serif';
      ctx.fillStyle = COLOURS.cashoutGreen;
      ctx.fillText('ENCRYPTED VAN EVACUATION CONFIRMED · TENURE GRANTED', 480, 252);
    }

    // Crashed: Federal Export Enforcement Skylight Raid
    if (crashed) {
      // Flashing alert banner
      ctx.fillStyle = raidFlash ? 'rgba(255, 0, 84, 0.9)' : 'rgba(50, 0, 20, 0.92)';
      ctx.strokeStyle = COLOURS.quarantineYellow;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(190, 175, 580, 110, 10);
      ctx.fill();
      ctx.stroke();

      // Caution stripes
      ctx.fillStyle = COLOURS.quarantineYellow;
      ctx.font = '900 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ EXPORT CONTROL RAID · QUARANTINE ⚠', 480, 218);
      ctx.font = '600 16px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('FEDERAL ENFORCEMENT SMASHED SKYLIGHT · SERVER SEIZED', 480, 254);
    }

    // HUD Header & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '800 26px monospace';
    ctx.letterSpacing = '2px';
    ctx.fillText('SEED DETECTIVE', 480, 42);

    ctx.font = '600 13px monospace';
    ctx.fillStyle = COLOURS.cyanWafer;
    ctx.fillText('AI WEIGHT FORENSIC SCANNER // 6T PARAMETER TRACE', 480, 64);

    // Multiplier Callout
    const multColor = crashed ? COLOURS.warningRed : (cashed ? COLOURS.cashoutGreen : COLOURS.textLight);
    ctx.fillStyle = multColor;
    ctx.font = '900 56px monospace';
    ctx.shadowColor = multColor;
    ctx.shadowBlur = running ? 12 : 4;
    ctx.fillText(formatX(view.currentX100), 480, 134);
    ctx.shadowBlur = 0;

    // Milestones caption
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const milestoneText = activeMilestone ? activeMilestone[1] : (crashed ? 'Hardware trace compromised by federal compliance' : 'Calibrating electron optics...');
    ctx.fillStyle = crashed ? COLOURS.warningRed : COLOURS.goldDie;
    ctx.font = '600 16px sans-serif';
    ctx.fillText(milestoneText, 480, 485);

    // Stake line
    const [stkText, stkCol] = stakeLine(view);
    ctx.fillStyle = stkCol;
    ctx.font = '700 15px monospace';
    ctx.fillText(stkText, 480, 514);

    ctx.restore();
  }

  return { draw };
}
