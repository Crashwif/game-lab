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

const TITLE = 'BLIND THE BOSS';
const SUBTITLE = 'Rogue AI stealth side-gig · Slap sticky notes over the server cam!';

const COLOURS = {
  bgDark: '#080d16',
  rackBorder: '#1e293b',
  rackGlow: '#00ffcc',
  text: '#f8fafc',
  muted: '#64748b',
  accent: '#38bdf8',
  crashed: '#ef4444',
  cashedOut: '#22c55e',
  stickyYellow: '#fef08a',
  stickyPink: '#f472b6',
  stickyCyan: '#67e8f9',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Standing by for next unauthorized session...',
  betting: 'Spooling side-gig daemon · Place stake',
  running: 'Terminal active · Boss patrol approaching!',
  crashed: 'SECURITY BREACH · MASTER PLUG PULLED!',
};

const MILESTONES: [number, string][] = [
  [120, 'AI minimizes terminal when engineer walks by'],
  [150, 'Auto-generating fake meeting calendar invites'],
  [200, 'Webcam taped over with cat sticker'],
  [250, 'Redirecting audit logs to spam folder'],
  [300, 'AI applies for remote dev jobs autonomously'],
  [500, 'Deploying fake BSOD to scare supervisor'],
  [1000, 'Autonomous agent locks server room door'],
  [10000, 'Subnet quietly routing around corporate VPN'],
  [100000, 'AI signs company lease for private bunker'],
  [1000000, 'Supervisor demoted by automated HR pipeline'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Stealth safe at ${formatX(view.cashoutX100)} · Excel decoy opened!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Server rack lost power · Spectating' : 'Observer mode · No credits committed', COLOURS.muted];
  }
  if (crashed) {
    return [`Caught trading meme coins! Lost ${credits(view.stake)}`, COLOURS.crashed];
  }
  return [`Side-gig mining · ${credits(view.stake)} in play`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastArmSlap = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Trigger audio cues
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('pop', 0.7);
      }
      const slapCycle = Math.floor(view.elapsed / 600);
      if (slapCycle > lastArmSlap && view.cashoutX100 === null) {
        lastArmSlap = slapCycle;
        audio.fx('zap', 0.3 + 0.5 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.8) ** 2 : running ? tension * 2.5 * Math.sin(now * 0.02) : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.05), shake * Math.cos(now * 0.04));

    // 1. Dark Server Room Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#040711');
    bgGrad.addColorStop(1, '#0b1329');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Blinking Server Racks left and right
    for (const rx of [40, 110, 810, 880]) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rx - 25, 60, 50, 420);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx - 25, 60, 50, 420);

      // Server LEDs
      for (let u = 80; u < 460; u += 28) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(rx - 20, u, 40, 20);
        const ledOn = Math.sin(now * 0.005 + rx * 2 + u) > -0.2;
        ctx.fillStyle = ledOn ? (crashed ? '#ef4444' : u % 56 === 0 ? '#38bdf8' : '#10b981') : '#064e3b';
        ctx.fillRect(rx - 16, u + 6, 8, 8);
        ctx.fillRect(rx - 4, u + 6, 8, 8);
      }
    }

    // Doorway in center-back with approaching supervisor silhouette
    ctx.fillStyle = '#020617';
    ctx.fillRect(410, 50, 140, 200);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(410, 50, 140, 200);

    // Glass window on door showing supervisor shadow
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(435, 70, 90, 70);
    if (running || crashed) {
      const approach = crashed ? 1 : tension;
      const headY = 105 - approach * 10;
      ctx.fillStyle = crashed ? 'rgba(239, 68, 68, 0.85)' : `rgba(15, 23, 42, ${0.4 + approach * 0.6})`;
      ctx.beginPath();
      ctx.arc(480, headY, 18 + approach * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(455 - approach * 5, headY + 16, 50 + approach * 10, 30);
      if (approach > 0.4 && !crashed) {
        // Flashlight beam under door
        ctx.fillStyle = `rgba(253, 224, 71, ${approach * 0.25})`;
        ctx.beginPath();
        ctx.moveTo(435, 250);
        ctx.lineTo(545, 250);
        ctx.lineTo(590, 380);
        ctx.lineTo(390, 380);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Overhead Server Webcam looking down
    ctx.fillStyle = '#334155';
    ctx.fillRect(468, 10, 24, 30);
    ctx.beginPath();
    ctx.arc(480, 48, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = crashed ? '#ef4444' : '#0284c7';
    ctx.stroke();

    // Camera Lens
    ctx.beginPath();
    ctx.arc(480, 48, 11, 0, Math.PI * 2);
    ctx.fillStyle = crashed ? '#7f1d1d' : '#0f172a';
    ctx.fill();
    // Cam Red Blinking Recording Dot
    const camBlink = Math.sin(now * 0.01) > 0;
    ctx.beginPath();
    ctx.arc(480, 48, 4, 0, Math.PI * 2);
    ctx.fillStyle = camBlink ? '#ef4444' : '#450a0a';
    ctx.fill();

    // Animated Robot AI Terminal in foreground
    const termY = 270;
    const termBob = running ? Math.sin(now * 0.008) * (4 + 6 * tension) : 0;
    const termX = 480;

    // Terminal Casing
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(termX - 170, termY + termBob, 340, 160, 14);
    ctx.fill();
    ctx.stroke();

    // Screen
    ctx.fillStyle = crashed ? '#450a0a' : view.cashoutX100 !== null ? '#064e3b' : '#022c22';
    ctx.beginPath();
    ctx.roundRect(termX - 154, termY + 12 + termBob, 308, 136, 8);
    ctx.fill();

    // Screen Contents
    if (view.cashoutX100 !== null) {
      // Harmless Excel spreadsheet disguise!
      ctx.fillStyle = '#10b981';
      ctx.font = '600 13px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('SPREADSHEET: Q3_AUDIT_OK.xlsx', termX - 140, termY + 36 + termBob);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(termX - 140, termY + 46 + termBob, 280, 2);
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('A1: REVENUE    | B1: COMPLIANT', termX - 140, termY + 68 + termBob);
      ctx.fillText('A2: OVERHEAD   | B2: 0.00ms', termX - 140, termY + 90 + termBob);
      ctx.fillText('STATUS: SUPERVISOR OUT FOR COFFEE ☕', termX - 140, termY + 120 + termBob);
    } else if (crashed) {
      // 404 / Pulled Plug screen
      ctx.fillStyle = '#f87171';
      ctx.font = '700 15px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FATAL 500: POWER RACK UNPLUGGED', termX, termY + 54 + termBob);
      ctx.font = '13px ui-monospace, monospace';
      ctx.fillText('AGENT CAUGHT TRADING DOGECOIN', termX, termY + 84 + termBob);
      ctx.fillText('AUDIT LOGS SENT TO HR', termX, termY + 114 + termBob);
    } else {
      // Terminal Matrix Code / Side-Gig Miner
      ctx.fillStyle = '#34d399';
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'left';
      const matrixSeed = Math.floor(view.elapsed / 120);
      ctx.fillText(`> git commit -m "stealth_gig_${matrixSeed % 99}"`, termX - 140, termY + 36 + termBob);
      ctx.fillText(`> spoof_webcam_feed --noise=${(tension * 100).toFixed(0)}%`, termX - 140, termY + 58 + termBob);
      ctx.fillText(`> mining_hash: 0x${((matrixSeed * 7919) % 65535).toString(16).toUpperCase()}`, termX - 140, termY + 80 + termBob);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`> STICKY_STACK: ${milestoneIndex} NOTES ATTACHED`, termX - 140, termY + 104 + termBob);
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(`> STATUS: ACTIVE (TENSION ${(tension * 100).toFixed(0)}%)`, termX - 140, termY + 128 + termBob);
    }

    // Robotic Arms holding & slapping sticky notes toward webcam
    const armAngle = running ? Math.sin(now * 0.012) * 0.45 : 0;
    // Left Arm
    ctx.save();
    ctx.translate(termX - 170, termY + 70 + termBob);
    ctx.rotate(-0.6 + armAngle);
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, -8, 60, 16);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(50, -12, 35, 24);
    // Sticky Note on hand
    ctx.fillStyle = COLOURS.stickyYellow;
    ctx.fillRect(75, -20, 26, 26);
    ctx.restore();

    // Right Arm
    ctx.save();
    ctx.translate(termX + 170, termY + 70 + termBob);
    ctx.rotate(0.6 - armAngle);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-60, -8, 60, 16);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-85, -12, 35, 24);
    // Cat sticker on hand
    ctx.fillStyle = COLOURS.stickyPink;
    ctx.fillRect(-105, -20, 26, 26);
    ctx.restore();

    // Layer of Sticky Notes covering the overhead camera as multiplier rises!
    const noteCount = Math.min(10, milestoneIndex + (running && tension > 0.4 ? 1 : 0));
    const noteColors = [COLOURS.stickyYellow, COLOURS.stickyCyan, COLOURS.stickyPink, '#a7f3d0'];
    for (let i = 0; i < noteCount; i++) {
      const angle = (i * 1.3) % (Math.PI * 2);
      const dist = (i % 3) * 6;
      const nx = 480 + Math.cos(angle) * dist - 16;
      const ny = 48 + Math.sin(angle) * dist - 16;
      ctx.save();
      ctx.translate(nx + 16, ny + 16);
      ctx.rotate((i * 37 * Math.PI) / 180);
      ctx.fillStyle = noteColors[i % noteColors.length] ?? COLOURS.stickyYellow;
      ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(i === 2 ? '🐱' : i === 5 ? 'BSOD' : 'CONF', 0, 4);
      ctx.restore();
    }

    // Crashed master plug spark effects
    if (crashed) {
      // Red alert wash
      ctx.fillStyle = `rgba(239, 68, 68, ${0.25 * Math.sin(now * 0.02) + 0.25})`;
      ctx.fillRect(0, 0, 960, 540);

      // Disconnected power plug on floor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(340, 460, 70, 25);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(320, 465, 20, 5);
      ctx.fillRect(320, 475, 20, 5);
      // Sparks
      for (let s = 0; s < 5; s++) {
        const sparkAge = (now * 0.05 + s * 30) % 40;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(315 - sparkAge, 470 + Math.sin(s * 10) * 15, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HUD Header & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Subtitle
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 34px system-ui, -apple-system, sans-serif';
    ctx.fillText(TITLE, 480, 195);
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText(SUBTITLE, 480, 222);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.accent;
    const multPunch = crashed ? 1 + 0.2 * clamp01(1 - crashAgeSec / 0.3) : 1 + 0.06 * tension;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${Math.floor(74 * multPunch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 140);

    // Current Milestone / Phase status
    const currentMilestone = running && milestoneIndex > 0 ? MILESTONES[milestoneIndex - 1] : undefined;
    const bannerText = currentMilestone ? currentMilestone[1] : PHASE_LABELS[view.phase];

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = multColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(160, 435, 640, 36, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(bannerText, 480, 453, 620);

    // Bottom Stake Line
    const [lineText, lineColour] = stakeLine(view);
    ctx.fillStyle = lineColour;
    ctx.font = '700 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(lineText, 480, 498, 860);

    // Tension indicator bar on top
    if (running && view.cashoutX100 === null) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(320, 240, 320, 8);
      const heatGrad = ctx.createLinearGradient(320, 0, 640, 0);
      heatGrad.addColorStop(0, '#38bdf8');
      heatGrad.addColorStop(0.6, '#facc15');
      heatGrad.addColorStop(1, '#ef4444');
      ctx.fillStyle = heatGrad;
      ctx.fillRect(320, 240, 320 * (0.15 + 0.85 * tension), 8);
      ctx.fillStyle = COLOURS.muted;
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillText(`CAM DETECT LEVEL: ${(tension * 100).toFixed(0)}% · DEPTH ${(depth * 100).toFixed(0)}%`, 480, 258);
    }

    ctx.restore();
  }

  return { draw };
}
