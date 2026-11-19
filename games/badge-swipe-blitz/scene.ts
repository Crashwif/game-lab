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

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Turnstile reader blinks faint yellow'],
  [150, 'Security guard looks up from his donut'],
  [200, 'HR camera begins facial verification scan'],
  [250, 'Lanyard catches slightly on turnstile corner'],
  [300, 'Hallway security gate begins closing countdown'],
  [500, 'Automated attendance tracker enters red zone'],
  [1000, 'RFID chip starts smoking from scanning friction'],
  [10000, 'VP of Culture sprints down lobby with clipboard'],
  [100000, 'Corporate drone swarm activates perimeter grid'],
  [1000000, 'Ascend to legendary tenured remote-exempt status'],
];

const COLOURS = {
  bgTop: '#090d16',
  bgBot: '#151d2a',
  tileDark: '#121926',
  tileLight: '#1f293d',
  accent: '#38bdf8',
  amber: '#f59e0b',
  danger: '#ef4444',
  success: '#10b981',
  text: '#f8fafc',
  muted: '#94a3b8',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Swiped & escaped at ${formatX(view.cashoutX100)} · Enjoy your iced oat latte!`, COLOURS.success];
  }
  if (view.stake === null) {
    return [crashed ? 'Turnstiles slammed · spectating safely' : 'Watching the sprint · tap badge to join', COLOURS.muted];
  }
  if (crashed) {
    return [`PIP issued! ${credits(view.stake)} lost to mandatory team-building`, COLOURS.danger];
  }
  return [`Badge swiped: ${credits(view.stake)} on the line · Sprint!`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let stepCounter = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    const speed = running ? 1 + tension * 3 + depth * 2 : (crashed ? 0 : 0.3);

    // Audio triggers
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('ding', 0.9);
      audio.fx('whoosh', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1200);
      audio.fx('door', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('camera', 0.6 + 0.4 * tension);
      }
      // Running footsteps
      const currentStep = Math.floor(view.elapsed / (160 - tension * 70));
      if (currentStep > stepCounter) {
        stepCounter = currentStep;
        if (!cashed) audio.fx('click', 0.25 + 0.35 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? Math.max(0, 1 - crashSec / 0.6) * 14 : 0;
    const shakeX = shake * Math.sin(crashSec * 60);
    const shakeY = shake * Math.cos(crashSec * 45);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Corporate Hallway Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, crashed ? '#240608' : COLOURS.bgTop);
    bgGrad.addColorStop(0.55, crashed ? '#3d0c11' : '#111827');
    bgGrad.addColorStop(1, crashed ? '#150507' : COLOURS.bgBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Hallway perspective lines
    const scrollOffset = (now * 0.4 * speed) % 80;
    ctx.strokeStyle = crashed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1.5;

    // Floor perspective & tiles
    const horizonY = 240;
    for (let x = -200; x <= 1160; x += 140) {
      ctx.beginPath();
      ctx.moveTo(480, horizonY);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    // Floor grid horizontal bands
    for (let y = horizonY; y < 540; y += 30) {
      const py = y + (scrollOffset * ((y - horizonY) / 300)) % 30;
      if (py >= horizonY && py <= 540) {
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(960, py);
        ctx.stroke();
      }
    }

    // Ceiling LED Light Panels rushing past
    const ceilingOffset = (now * 0.6 * speed) % 120;
    for (let lx = -120; lx < 1080; lx += 120) {
      const cx = lx - ceilingOffset;
      ctx.fillStyle = crashed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(cx, 15, 70, 8);
    }

    // Security Cameras / HR Drones scanning
    const camAngle = Math.sin(now * 0.004) * 0.35;
    ctx.save();
    ctx.translate(820, 70);
    ctx.rotate(camAngle);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-20, -10, 40, 20);
    // Camera lens
    ctx.fillStyle = crashed ? '#ef4444' : (tension > 0.6 ? '#f59e0b' : '#38bdf8');
    ctx.beginPath();
    ctx.arc(15, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    // Scan laser beam down
    if (running || crashed) {
      const beamGrad = ctx.createRadialGradient(15, 0, 5, 15, 260, 260);
      beamGrad.addColorStop(0, crashed ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.4)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-120, 360);
      ctx.lineTo(160, 360);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 2. The Turnstile Gate (Destination)
    const gateX = 640;
    const gateY = 260;
    // Pedestals
    ctx.fillStyle = '#334155';
    ctx.fillRect(gateX - 25, gateY, 50, 160);
    ctx.fillRect(gateX + 115, gateY, 50, 160);
    // Chrome highlights
    ctx.fillStyle = '#64748b';
    ctx.fillRect(gateX - 25, gateY, 50, 6);
    ctx.fillRect(gateX + 115, gateY, 6, 160);

    // RFID Scanner Pad on turnstile
    const padColor = cashed ? COLOURS.success : (crashed ? COLOURS.danger : (tension > 0.5 ? COLOURS.amber : COLOURS.accent));
    ctx.fillStyle = padColor;
    ctx.beginPath();
    ctx.roundRect(gateX - 18, gateY + 20, 36, 45, 6);
    ctx.fill();
    // Glowing RFID icon rings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const pulseRing = (now * 0.008) % 1;
    ctx.beginPath();
    ctx.arc(gateX, gateY + 42, 6 + pulseRing * 12, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();

    // Turnstile barrier flaps
    const gateClosed = crashed || (!cashed && view.phase === 'waiting');
    const gateFlapAngle = gateClosed ? 0 : (cashed ? -Math.PI * 0.45 : Math.sin(now * 0.008) * 0.1);
    ctx.save();
    ctx.translate(gateX + 25, gateY + 50);
    ctx.rotate(gateFlapAngle);
    ctx.fillStyle = crashed ? 'rgba(239, 68, 68, 0.85)' : (cashed ? 'rgba(16, 185, 129, 0.85)' : 'rgba(56, 189, 248, 0.7)');
    ctx.fillRect(0, -6, 75, 12);
    ctx.restore();

    // 3. Protagonist: Worker in Wrinkled Blazer
    const runCycle = (now * (0.012 * speed)) % (Math.PI * 2);
    const workerBaseX = cashed ? Math.min(840, 520 + (now * 0.25) % 280) : 340;
    const bob = running ? Math.sin(runCycle * 2) * 9 : (crashed ? 12 : 2);
    const workerY = 320 + bob;

    ctx.save();
    ctx.translate(workerBaseX, workerY);

    if (crashed) {
      // Slumped / flattened against gate with PIP Memo
      ctx.rotate(0.25);
      // Legs crumpled
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-20, 40, 16, 40);
      ctx.fillRect(0, 35, 18, 42);
      // Torso crumpled
      ctx.fillStyle = '#475569';
      ctx.fillRect(-25, 0, 46, 50);
      // Head
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(0, -18, 20, 0, Math.PI * 2);
      ctx.fill();
      // Swirly dizzy eyes
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-8, -20, 4, 0, Math.PI);
      ctx.arc(8, -20, 4, 0, Math.PI);
      ctx.stroke();

      // Giant PIP Memo stamped on forehead!
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.save();
      ctx.translate(-5, -45);
      ctx.rotate(-0.15);
      ctx.fillRect(-45, -28, 90, 50);
      ctx.strokeRect(-45, -28, 90, 50);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFFICIAL PIP', 0, -12);
      ctx.fillStyle = '#334155';
      ctx.font = '8px system-ui, sans-serif';
      ctx.fillText('RETURN TO OFFICE', 0, 4);
      ctx.fillText('IMMEDIATELY', 0, 15);
      ctx.restore();
    } else {
      // Forward sprint pose
      const lean = running ? 0.32 + tension * 0.15 : 0.05;
      ctx.rotate(lean);

      // Running Legs
      const legL = Math.sin(runCycle) * 28;
      const legR = Math.sin(runCycle + Math.PI) * 28;
      ctx.fillStyle = '#1e293b';
      // Left leg
      ctx.save();
      ctx.translate(-10, 45);
      ctx.rotate(legL * 0.03);
      ctx.fillRect(-6, 0, 12, 45);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, 40, 20, 10); // Shoe
      ctx.restore();
      // Right leg
      ctx.save();
      ctx.translate(10, 45);
      ctx.rotate(legR * 0.03);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-6, 0, 12, 45);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, 40, 20, 10); // Shoe
      ctx.restore();

      // Flapping Wrinkled Blazer
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(24, 0);
      ctx.lineTo(20, 52);
      // flapping tail of jacket
      const flap = Math.sin(runCycle * 2) * 12;
      ctx.lineTo(-32 + flap, 50);
      ctx.closePath();
      ctx.fill();

      // Collar & necktie
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-3, 6, 6, 26);

      // Head with messy hair & sleep-deprived eye bags
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(4, -18, 18, 0, Math.PI * 2);
      ctx.fill();
      // Messy bed-head hair
      ctx.fillStyle = '#57301c';
      ctx.beginPath();
      ctx.arc(2, -26, 18, Math.PI, Math.PI * 2.1);
      ctx.lineTo(24, -20);
      ctx.lineTo(-18, -16);
      ctx.fill();
      // Eye bags
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(10, -14, 5, 0, Math.PI);
      ctx.stroke();
      // Wide stressed eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(10, -18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(11 + tension * 2, -18, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Outstretched Arm reaching with Lanyard RFID Badge
      const armSwing = Math.sin(runCycle + Math.PI * 0.5) * 8;
      ctx.save();
      ctx.translate(14, 12);
      ctx.rotate(0.35 + armSwing * 0.02);
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, -6, 44, 12); // arm
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(44, 0, 7, 0, Math.PI * 2); // hand
      ctx.fill();

      // The Lanyard Card (RFID Badge)
      ctx.save();
      ctx.translate(50, 4);
      ctx.rotate(0.15);
      // Blue ribbon lanyard
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-15, -28);
      ctx.lineTo(0, 0);
      ctx.stroke();
      // Plastic Badge
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, -8, 26, 18);
      ctx.strokeRect(0, -8, 26, 18);
      // Photo square + barcode
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(3, -5, 6, 8);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(12, -4, 10, 2);
      ctx.fillRect(12, 0, 8, 2);

      // Cashed out item: artisanal coffee cup!
      if (cashed) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(20, -22, 16, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(18, -26, 20, 5); // lid
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 9px system-ui';
        ctx.fillText('☕', 22, -10);
      }
      ctx.restore();
      ctx.restore();
    }
    ctx.restore();

    // 4. Clipboard-wielding HR Monitor chasing from behind
    if (running && tension > 0.15) {
      const hrX = 140 + Math.sin(now * 0.007) * 20;
      const hrY = 325 + Math.cos(now * 0.01) * 6;
      ctx.save();
      ctx.translate(hrX, hrY);
      // Dark formal suit
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-18, 0, 36, 55);
      // Head with severe bun haircut
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -18, 16, 0, Math.PI * 2);
      ctx.fill();
      // Red sharp glasses
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, -20, 14, 4);
      // Arm holding giant clipboard
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(12, -5, 26, 36);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(15, -2, 20, 30);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 8px system-ui';
      ctx.fillText('RTO AUDIT', 16, 8);
      ctx.restore();
    }

    // 5. Celebration or Crash Overlays
    if (cashed) {
      // Luminous Green escape chime overlay
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = COLOURS.success;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ BADGE VERIFIED · ACCESS GRANTED · ESPRESSO BAR ESCAPE ⚡', 480, 200);
    } else if (crashed) {
      // Red siren strobe
      const strobe = Math.sin(crashSec * 16) > 0 ? 0.35 : 0.1;
      ctx.fillStyle = `rgba(239, 68, 68, ${strobe})`;
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = COLOURS.danger;
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 SECURITY LOCKDOWN · GATE CLAMPED · MANDATORY PIP ISSUED 🚨', 480, 195);
    }

    // 6. HUD and Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 38px system-ui, sans-serif';
    ctx.fillText('BADGE SWIPE BLITZ', 480, 55);

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = tension > 0.6 ? COLOURS.danger : COLOURS.muted;
    ctx.fillText('SWIPE YOUR RFID CARD BEFORE HR AUDITORS FORCE RETURN-TO-OFFICE', 480, 88);

    // Main Multiplier Readout
    const punch = crashed ? (1 - clamp01((crashSec - 0.1) / 0.3)) ** 2 : 0;
    const multColor = cashed ? COLOURS.success : (crashed ? COLOURS.danger : COLOURS.accent);
    ctx.fillStyle = multColor;
    ctx.font = `800 ${88 * (1 + 0.18 * punch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 145);

    // Current Milestone / Status Banner
    const currentMilestoneText = running
      ? (MILESTONES[milestoneIndex - 1]?.[1] ?? 'Approaching Turnstile Security Grid...')
      : (crashed ? 'Turnstile gate slammed shut on blazer tail!' : (cashed ? 'Slipped past corporate security to local café' : 'Ready badge for automated entrance sprint'));

    ctx.fillStyle = cashed ? COLOURS.success : (crashed ? COLOURS.danger : '#e2e8f0');
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(currentMilestoneText, 480, 470);

    // Stake line & status
    const [statusText, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 505);

    ctx.restore();
  }

  return { draw };
}
