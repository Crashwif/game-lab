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
  [120, 'Prompting intern bot to format slides'],
  [150, 'Excel macro loop auto-generates pitch'],
  [200, 'Legal review agent signs NDA in nanoseconds'],
  [250, 'Five cloned bot interns take over email'],
  [300, 'Autonomous memo loop spawns endless tabs'],
  [500, 'Harness cables glow blue with raw token power'],
  [1000, 'Senior managing partner replaced by shell script'],
  [10000, 'Entire firm runs on an open-source bash script'],
  [100000, 'AI acquires building title deed via API call'],
  [1000000, 'Total corporate singularity: human sits on beach'],
];

const COLOURS = {
  bgDeep: '#0b0816',
  gridCyan: '#0df3ff',
  neonPink: '#ff2d78',
  electricBlue: '#38bdf8',
  agentGreen: '#10b981',
  warningOrange: '#f59e0b',
  crashedRed: '#ef4444',
  textLight: '#f8fafc',
  textMuted: '#94a3b8',
  deskWood: '#475569',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'static' });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSparkTime = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const timeSec = view.elapsed / 1000;

    audio.update(view.phase, tension);

    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1500);
    }
    if (running && previousPhase === 'running' && milestoneIdx > previousMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('zap', 0.6);
    }
    if (running && now - lastSparkTime > (600 - tension * 450)) {
      audio.fx('beep', 0.25 + 0.35 * tension);
      lastSparkTime = now;
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashAgeSec / 0.7) ** 2 : (tension > 0.4 ? (tension - 0.4) * 4 * Math.sin(timeSec * 35) : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.09));

    // 1. Synthwave Corporate Skyline & Grid Floor
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#06030e');
    bgGrad.addColorStop(0.55, '#160d2b');
    bgGrad.addColorStop(1, '#090412');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Distant Office Towers
    ctx.fillStyle = '#140f28';
    for (let i = 0; i < 9; i++) {
      const bx = i * 110 - 20;
      const bw = 85;
      const bh = 140 + ((i * 37) % 110);
      ctx.fillRect(bx, 280 - bh, bw, bh);
      // Windows
      ctx.fillStyle = (i + Math.floor(timeSec * 2)) % 3 === 0 ? '#ff007733' : '#00f2ff22';
      for (let wy = 300 - bh + 10; wy < 270; wy += 14) {
        ctx.fillRect(bx + 12, wy, 15, 6);
        ctx.fillRect(bx + 40, wy, 15, 6);
      }
      ctx.fillStyle = '#140f28';
    }

    // Grid Floor
    const horizonY = 280;
    ctx.strokeStyle = crashed ? '#ef444444' : '#0df3ff33';
    ctx.lineWidth = 1.5;
    for (let y = horizonY; y < 540; y += 22) {
      const p = (y - horizonY) / (540 - horizonY);
      const dy = horizonY + p * p * (540 - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, dy);
      ctx.lineTo(960, dy);
      ctx.stroke();
    }
    const gridSpeed = (timeSec * (120 + tension * 260)) % 80;
    for (let x = -200; x <= 1160; x += 80) {
      ctx.beginPath();
      ctx.moveTo(480, horizonY);
      const bx = x + (x - 480) * 1.5 + gridSpeed;
      ctx.lineTo(bx, 540);
      ctx.stroke();
    }

    // 2. Swarming Agent Holograms & Floating Documents
    const agentCount = Math.min(14, Math.floor(tension * 12) + (running ? 2 : 1));
    for (let i = 0; i < agentCount; i++) {
      const angle = (i / agentCount) * Math.PI * 2 + timeSec * (0.8 + depth);
      const radiusX = 260 + (i % 3) * 60;
      const radiusY = 70 + (i % 2) * 25;
      const hx = 480 + Math.cos(angle) * radiusX;
      const hy = 290 + Math.sin(angle) * radiusY;

      // Flying Doc / Tab
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.sin(timeSec * 3 + i) * 0.2);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(255, 45, 120, 0.7)';
      ctx.fillRect(-22, -14, 44, 28);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-18, -10, 36, 4);
      ctx.fillRect(-18, -2, 28, 3);
      ctx.fillRect(-18, 4, 32, 3);

      // Bot Face Icon
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(14, -12, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(12, -14, 2, 2);
      ctx.fillRect(15, -14, 2, 2);
      ctx.restore();
    }

    // 3. Desk & Protagonist or Escaped/Crashed states
    const deskY = 370;
    const isEscaped = view.cashoutX100 !== null;

    if (crashed) {
      // Logic loop collapse vortex
      const vortexR = Math.min(280, crashAgeSec * 380);
      const swirlGrad = ctx.createRadialGradient(480, deskY, 5, 480, deskY, Math.max(10, vortexR));
      swirlGrad.addColorStop(0, '#000000');
      swirlGrad.addColorStop(0.3, '#ff0055');
      swirlGrad.addColorStop(0.7, '#38bdf8');
      swirlGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = swirlGrad;
      ctx.beginPath();
      ctx.arc(480, deskY, vortexR, 0, Math.PI * 2);
      ctx.fill();

      // Shattered glitch pixels
      ctx.fillStyle = '#ff2d78';
      for (let p = 0; p < 25; p++) {
        const px = 480 + Math.sin(p * 91 + crashAgeSec * 15) * (vortexR * 0.9);
        const py = deskY + Math.cos(p * 53 + crashAgeSec * 13) * (vortexR * 0.7);
        ctx.fillRect(px, py, 14, 8);
      }
    } else {
      ctx.save();
      const hoverOffset = isEscaped ? Math.sin(timeSec * 5) * 12 - 40 : Math.sin(timeSec * 12) * (tension * 3);
      const glideX = isEscaped ? Math.min(220, (timeSec - (view.cashoutX100 ? 0 : 0)) * 90) : 0;
      ctx.translate(480 + glideX, deskY + hoverOffset);

      // Hover glow if cashed out
      if (isEscaped) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 60, 110, 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Strapped Harness Cables
      const cablePulse = Math.sin(timeSec * 20);
      ctx.lineWidth = 4 + tension * 3;
      ctx.strokeStyle = isEscaped ? '#10b981' : (cablePulse > 0 ? '#38bdf8' : '#ff2d78');
      ctx.beginPath();
      ctx.moveTo(-120, -130);
      ctx.bezierCurveTo(-90, -40, -40, -50, -15, -20);
      ctx.moveTo(120, -130);
      ctx.bezierCurveTo(90, -40, 40, -50, 15, -20);
      ctx.moveTo(-70, -140);
      ctx.quadraticCurveTo(-20, -80, 0, -35);
      ctx.moveTo(70, -140);
      ctx.quadraticCurveTo(20, -80, 0, -35);
      ctx.stroke();

      // Analyst Chair
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-28, -60, 56, 70);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-20, -70, 40, 18);

      // Junior Analyst Body
      ctx.fillStyle = isEscaped ? '#f59e0b' : '#38bdf8'; // Hawaiian shirt or blue corporate polo
      ctx.beginPath();
      ctx.ellipse(0, -15, 26, 32, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(0, -55, 18, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.arc(0, -62, 19, Math.PI, 0);
      ctx.fill();

      // Facial Expression
      if (isEscaped) {
        // Cool sunglasses & smile
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-14, -58, 28, 8);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -48, 7, 0.1, Math.PI - 0.1);
        ctx.stroke();
      } else {
        // Sweaty terrified junior
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        const eyeWiggle = Math.sin(timeSec * 40) * 1.5;
        ctx.arc(-7 + eyeWiggle, -56, 3.5, 0, Math.PI * 2);
        ctx.arc(7 + eyeWiggle, -56, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Sweat drops
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(17, -62 + (timeSec * 25) % 18, 3, 0, Math.PI * 2);
        ctx.fill();
        // Mouth scream
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.ellipse(0, -45, 6, 5 + tension * 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fast-typing arms
      const armWag = isEscaped ? 0 : Math.sin(timeSec * (25 + tension * 40)) * 8;
      ctx.strokeStyle = '#fbcfe8';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-16, -20);
      ctx.lineTo(-30, 2 + armWag);
      ctx.moveTo(16, -20);
      ctx.lineTo(30, 2 - armWag);
      ctx.stroke();

      // Desk Surface
      ctx.fillStyle = COLOURS.deskWood;
      ctx.fillRect(-150, 15, 300, 20);
      // Desk Base / Hover thruster
      if (isEscaped) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-100, 35, 200, 12);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(-60, 47, 120, 6);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-120, 35, 20, 65);
        ctx.fillRect(100, 35, 20, 65);
      }

      // Multi-Monitor Array (6 glowing screens)
      const monitorAngles = [-105, -65, -25, 25, 65, 105];
      for (let m = 0; m < monitorAngles.length; m++) {
        const mx = monitorAngles[m] ?? 0;
        const my = 0 - Math.abs(mx) * 0.15;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(mx - 18, my - 24, 36, 26);
        // Glowing screen content
        ctx.fillStyle = (m + Math.floor(timeSec * 6)) % 2 === 0 ? '#0284c7' : '#9333ea';
        ctx.fillRect(mx - 16, my - 22, 32, 22);
        // Code lines
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx - 14, my - 18, 14, 2);
        ctx.fillRect(mx - 14, my - 13, 24, 2);
        ctx.fillRect(mx - 14, my - 8, 18, 2);
        // Sparks if high tension
        if (tension > 0.6 && Math.random() < 0.25) {
          ctx.strokeStyle = '#fef08a';
          ctx.beginPath();
          ctx.moveTo(mx, my - 22);
          ctx.lineTo(mx + (Math.random() - 0.5) * 20, my - 34);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // 4. Overlays & HUD
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.font = '800 24px ui-sans-serif, system-ui';
    ctx.fillStyle = COLOURS.gridCyan;
    ctx.fillText('AGENT HARNESS RUSH', 480, 34);

    ctx.font = '600 13px ui-sans-serif, system-ui';
    ctx.fillStyle = COLOURS.textMuted;
    ctx.fillText('STACK CO-WORKER BOTS BEFORE YOUR DESK GETS RECURSED', 480, 58);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashedRed : (isEscaped ? COLOURS.agentGreen : (tension > 0.65 ? COLOURS.neonPink : COLOURS.electricBlue));
    ctx.fillStyle = multColor;
    ctx.font = `900 ${78 + (tension * 16)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 128);

    // Milestone / Status Ribbon
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const bannerText = activeMilestone ? activeMilestone[1] : (crashed ? 'RECURSIVE EXCEPTION: BADGE & DESK PURGED' : (view.phase === 'betting' ? 'STRAP INTO THE HARNESS' : 'WAITING FOR NEXT SHIFT'));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(160, 178, 640, 34);
    ctx.strokeStyle = multColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(160, 178, 640, 34);

    ctx.font = '700 16px ui-sans-serif, system-ui';
    ctx.fillStyle = COLOURS.textLight;
    ctx.fillText(bannerText, 480, 195, 620);

    // Live Token Generation Bar
    const barW = 340;
    const barH = 10;
    const barX = 310;
    const barY = 222;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = isEscaped ? COLOURS.agentGreen : (tension > 0.8 ? COLOURS.neonPink : COLOURS.gridCyan);
    ctx.fillRect(barX, barY, barW * tension, barH);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(barX, barY, barW, barH);

    // Stake line
    let stakeText = 'Watching session · 0 credits at risk';
    let stakeCol = COLOURS.textMuted;
    if (view.cashoutX100 !== null) {
      stakeText = `CASHED OUT: Remote Retainer Signed at ${formatX(view.cashoutX100)}!`;
      stakeCol = COLOURS.agentGreen;
    } else if (view.stake !== null) {
      if (crashed) {
        stakeText = `DESK EVAPORATED: ${credits(view.stake)} lost to the void`;
        stakeCol = COLOURS.crashedRed;
      } else {
        stakeText = `Harness locked: ${credits(view.stake)} in play`;
        stakeCol = COLOURS.electricBlue;
      }
    }
    ctx.font = '700 18px ui-sans-serif, system-ui';
    ctx.fillStyle = stakeCol;
    ctx.fillText(stakeText, 480, 498);

    ctx.restore();
  }

  return { draw };
}
