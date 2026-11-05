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
  bgTop: '#0b1329',
  bgBottom: '#18243c',
  counter: '#2a3b5c',
  counterTop: '#51688f',
  glass: 'rgba(125, 211, 252, 0.25)',
  laser: '#ff2d55',
  laserGlow: 'rgba(255, 45, 85, 0.45)',
  hired: '#22c55e',
  hiredGlow: 'rgba(34, 197, 94, 0.4)',
  warning: '#f59e0b',
  text: '#f8fafc',
  muted: '#94a3b8',
  paper: '#fdfbf7',
  paperDark: '#e2d9cc',
};

const MILESTONES: [number, string][] = [
  [120, 'Store manager smiles and adjusts nametag'],
  [150, 'Online portal loading circle starts spinning'],
  [200, 'Keywords detected: Synergy, Excel, Grit'],
  [250, 'Resume bypasses initial robotic keyword filter'],
  [300, 'Manager compliments your physical paper stock'],
  [500, 'AI scanner overheats trying to parse your font'],
  [1000, 'Manager offers you a free employee discount pin'],
  [10000, 'Algorithm gets confused and labels you CEO'],
  [100000, 'Corporate board approves immediate franchise keys'],
  [1000000, 'You automate the AI that tried to reject you'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`HIRED at ${formatX(view.cashoutX100)} · Signed badge secured!`, COLOURS.hired];
  }
  if (view.stake === null) {
    return [crashed ? 'Shredded by ATS · spectator mode' : 'Watching interview · no stake placed', COLOURS.muted];
  }
  if (crashed) {
    return [`Auto-rejected: ${credits(view.stake)} vanished in the portal`, COLOURS.laser];
  }
  return [`Paper CV in hand · ${credits(view.stake)} on the line`, COLOURS.warning];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastLaserTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('zap', 0.6 + 0.4 * tension);
      }
      if (now - lastLaserTick > (180 - tension * 110)) {
        lastLaserTick = now;
        if (!cashed) audio.fx('beep', 0.2 + 0.5 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;
    const shakeX = shake ? Math.sin(crashAgeSec * 62) * shake : 0;
    const shakeY = shake ? Math.cos(crashAgeSec * 77) * shake : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, COLOURS.bgTop);
    bg.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);

    // Background grid & store shelves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 40; x < 960; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 380);
      ctx.stroke();
    }
    for (let y = 30; y < 380; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Checkout Counter
    ctx.fillStyle = COLOURS.counter;
    ctx.fillRect(0, 370, 960, 170);
    ctx.fillStyle = COLOURS.counterTop;
    ctx.fillRect(0, 360, 960, 18);
    // Glass divider ledge
    ctx.fillStyle = COLOURS.glass;
    ctx.fillRect(400, 300, 160, 60);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(400, 300, 160, 60);

    // Protagonist (Anxious Applicant) on Left
    const applicantBob = running ? Math.sin(view.elapsed * 0.008) * 3 : 0;
    ctx.save();
    ctx.translate(170, 330 + applicantBob);

    // Body & Suit
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-42, 20, 84, 80, 12);
    ctx.fill();
    // Shirt Collar & Tie
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-16, 20);
    ctx.lineTo(16, 20);
    ctx.lineTo(0, 48);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-6, 28);
    ctx.lineTo(6, 28);
    ctx.lineTo(0, 65);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = '#fdba74';
    ctx.beginPath();
    ctx.arc(0, -10, 28, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(0, -22, 26, Math.PI, Math.PI * 2);
    ctx.fill();

    // Face / Expression
    ctx.fillStyle = '#1e293b';
    const panicEyeSize = 3 + tension * 4;
    ctx.beginPath();
    ctx.arc(-8, -10, panicEyeSize, 0, Math.PI * 2);
    ctx.arc(8, -10, panicEyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Mouth: nervously trembling or smiling if cashed
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (cashed) {
      ctx.arc(0, 3, 10, 0.1 * Math.PI, 0.9 * Math.PI);
    } else if (crashed) {
      ctx.arc(0, 8, 8, 1.1 * Math.PI, 1.9 * Math.PI);
    } else {
      const jitter = Math.sin(view.elapsed * 0.03) * 3;
      ctx.moveTo(-8, 4 + jitter);
      ctx.lineTo(8, 4 - jitter);
    }
    ctx.stroke();

    // Sweat drops if tense
    if (tension > 0.2 && !cashed && !crashed) {
      ctx.fillStyle = '#38bdf8';
      const sweatY = -12 + (view.elapsed * 0.05) % 30;
      ctx.beginPath();
      ctx.arc(24, sweatY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Extended Left/Right Arm reaching across counter
    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(30, 36);
    ctx.lineTo(190, 10);
    ctx.stroke();

    // Employee Lanyard Badge if cashed
    if (cashed) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 14, 26, 0, Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-14, 42, 28, 36);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(-14, 42, 28, 10);
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 8px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('STAFF', 0, 64);
    }
    ctx.restore();

    // Friendly Store Manager on Right
    ctx.save();
    ctx.translate(790, 330);
    // Manager Body & Apron
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.roundRect(-46, 20, 92, 80, 12);
    ctx.fill();
    // Nametag
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(10, 32, 28, 14);
    ctx.fillStyle = '#854d0e';
    ctx.font = '700 8px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('BOB [MGR]', 24, 42);

    // Manager Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -12, 28, 0, Math.PI * 2);
    ctx.fill();
    // Glasses
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-20, -18, 16, 12);
    ctx.strokeRect(4, -18, 16, 12);
    ctx.beginPath();
    ctx.moveTo(-4, -12);
    ctx.lineTo(4, -12);
    ctx.stroke();

    // Manager smile
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Manager Arm reaching out
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30, 36);
    ctx.lineTo(cashed ? -180 : -130, cashed ? 10 : 25);
    ctx.stroke();
    ctx.restore();

    // The Paper Resume in the Center
    const resumeX = 480;
    const resumeY = 325 + (running ? Math.sin(view.elapsed * 0.007) * 4 : 0);
    ctx.save();
    ctx.translate(resumeX, resumeY);

    if (crashed) {
      // Sliced / shredded paper parts falling apart
      const shredSpread = Math.min(60, crashAgeSec * 90);
      // Left shred
      ctx.save();
      ctx.translate(-shredSpread, shredSpread * 0.5);
      ctx.rotate(-shredSpread * 0.02);
      ctx.fillStyle = COLOURS.paperDark;
      ctx.fillRect(-45, -55, 40, 110);
      ctx.restore();

      // Right shred
      ctx.save();
      ctx.translate(shredSpread, shredSpread * 0.8);
      ctx.rotate(shredSpread * 0.02);
      ctx.fillStyle = COLOURS.paper;
      ctx.fillRect(5, -55, 40, 110);
      ctx.restore();
    } else {
      // Crisp Paper Resume
      ctx.fillStyle = COLOURS.paper;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 10;
      ctx.fillRect(-50, -60, 100, 120);
      ctx.shadowBlur = 0;

      // Lines of CV text
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-38, -48, 45, 7);
      for (let li = 0; li < 6; li++) {
        ctx.fillStyle = li % 2 === 0 ? '#94a3b8' : '#cbd5e1';
        ctx.fillRect(-38, -30 + li * 13, 76, 5);
      }

      // "HIRED" stamp if cashed out
      if (cashed) {
        ctx.save();
        ctx.rotate(-0.25);
        ctx.strokeStyle = COLOURS.hired;
        ctx.lineWidth = 5;
        ctx.strokeRect(-42, -26, 84, 40);
        ctx.fillStyle = COLOURS.hired;
        ctx.font = '900 24px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HIRED', 0, -6);
        ctx.restore();
      }
    }
    ctx.restore();

    // Overhead ATS Scanner Module (Ceiling mount)
    const scannerX = 480;
    const scannerY = 65;
    ctx.save();
    ctx.translate(scannerX, scannerY);

    // Mechanical mount
    ctx.fillStyle = '#334155';
    ctx.fillRect(-70, -65, 140, 40);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Red Scanner Eye Lens
    const eyePupilPulse = 14 + Math.sin(view.elapsed * 0.015) * 4 + tension * 8;
    ctx.fillStyle = crashed ? '#dc2626' : (running ? '#ef4444' : '#64748b');
    ctx.beginPath();
    ctx.arc(0, 0, eyePupilPulse, 0, Math.PI * 2);
    ctx.fill();

    // Scanner Status Display
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-90, -22, 50, 18);
    ctx.fillStyle = tension > 0.6 ? '#ef4444' : '#38bdf8';
    ctx.font = '700 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(crashed ? 'AUTO-BIN' : `ATS v${(1 + depth * 9).toFixed(1)}`, -65, -10);

    ctx.restore();

    // Red Laser Scanning Beam targeting the Resume
    if (running && !cashed) {
      const beamSweep = Math.sin(view.elapsed * (0.008 + tension * 0.015)) * 42;
      const targetX = resumeX + beamSweep;
      const targetY = resumeY;

      ctx.save();
      ctx.strokeStyle = COLOURS.laser;
      ctx.lineWidth = 2 + tension * 3;
      ctx.shadowColor = COLOURS.laser;
      ctx.shadowBlur = 12 + tension * 12;

      ctx.beginPath();
      ctx.moveTo(scannerX - 10, scannerY + 25);
      ctx.lineTo(targetX, targetY);
      ctx.moveTo(scannerX + 10, scannerY + 25);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Laser impact ring & sparks
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(targetX, targetY, 4 + tension * 4, 0, Math.PI * 2);
      ctx.fill();

      // Floating rejection warning indicators
      if (tension > 0.3) {
        ctx.fillStyle = COLOURS.laser;
        ctx.font = '700 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[! PARSING FONT !]', targetX, targetY - 25);
      }
      ctx.restore();
    }

    // Crashed Effect: Red Alert Siren overlay & UNFORTUNATELY Stamp
    if (crashed) {
      const flash = Math.sin(crashAgeSec * 16) > 0 ? 0.35 : 0.08;
      ctx.fillStyle = `rgba(239, 68, 68, ${flash})`;
      ctx.fillRect(0, 0, 960, 540);

      // Automated Regret Email popup in the bottom right
      ctx.save();
      ctx.translate(680, 240);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 16;
      ctx.roundRect(0, 0, 240, 110, 8);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, 240, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('NO-REPLY REJECTION ALERT', 10, 18);
      ctx.fillStyle = '#1e293b';
      ctx.font = '600 10px system-ui';
      ctx.fillText('"Unfortunately, after reviewing your', 10, 48);
      ctx.fillText('application along with 4,000 others,', 10, 66);
      ctx.fillText('we will not be moving forward."', 10, 84);
      ctx.restore();

      // Giant Rubber Stamp slamming down
      const stampScale = Math.max(1, 2.5 - crashAgeSec * 5);
      ctx.save();
      ctx.translate(480, 220);
      ctx.scale(stampScale, stampScale);
      ctx.rotate(-0.15);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.88)';
      ctx.fillRect(-170, -42, 340, 84);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(-164, -36, 328, 72);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('UNFORTUNATELY', 0, 0);
      ctx.restore();
    }

    // Cashout Celebration Overlay
    if (cashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
      ctx.fillRect(0, 0, 960, 540);

      // Thumbs up / badge confirmation banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.roundRect(280, 200, 400, 60, 12);
      ctx.fill();
      ctx.strokeStyle = COLOURS.hired;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = COLOURS.hired;
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HANDSHAKE SECURED! YOU WORK HERE NOW.', 480, 236);
      ctx.restore();
    }

    // HUD: Header Info
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText('ATS SHREDDER', 480, 36);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('Pass your paper CV across the counter before AI auto-shreds you', 480, 58);

    // Multiplier Readout
    ctx.save();
    const multColor = cashed ? COLOURS.hired : (crashed ? COLOURS.laser : '#38bdf8');
    ctx.fillStyle = multColor;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 10;
    ctx.font = '900 78px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 142);
    ctx.restore();

    // Milestone / Phase status
    const currentMilestoneText = running
      ? (MILESTONES[milestoneIndex - 1]?.[1] ?? 'Applicant reaching across counter...')
      : (crashed ? 'RESUME AUTO-BINNED BY ALGORITHM' : 'Next applicant step up to the counter');

    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = cashed ? COLOURS.hired : (crashed ? COLOURS.laser : COLOURS.text);
    ctx.fillText(currentMilestoneText, 480, 465);

    // Stake line
    const [statusMsg, statusColor] = stakeLine(view);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = statusColor;
    ctx.fillText(statusMsg, 480, 498);

    ctx.restore();
  }

  return { draw };
}
