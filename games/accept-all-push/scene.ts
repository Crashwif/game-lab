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
  bg: '#0a0e17',
  desk: '#1a1f2c',
  serverRack: '#111722',
  terminalGreen: '#00ff66',
  terminalDark: '#041d0f',
  screenGlow: '#00e5ff',
  alertRed: '#ff2d55',
  warningAmber: '#ffb300',
  tapeGold: '#ffd166',
  cashedOut: '#4ade80',
  textMuted: '#64748b',
  textLight: '#f8fafc',
};

const PHASE_LABELS = {
  waiting: 'Standing by: AI Agent ready for commit queue',
  betting: 'Place stake · Authorizing full sudo git-push',
  running: 'Agent refactoring production in real-time...',
  crashed: 'CRITICAL FAILURE: 502 BAD GATEWAY · DB DELETED',
};

const MILESTONES: [number, string][] = [
  [120, 'Agent optimizes variable names to single letters'],
  [150, 'Auto-linter rewrites CSS into a single line'],
  [200, 'All comments converted to philosophical riddles'],
  [250, 'Agent creates 4,000 pull requests in 3 seconds'],
  [300, 'Merge conflicts resolved by coin-flip script'],
  [500, 'Whole codebase rewritten in obscure assembly'],
  [1000, 'CEO tagged in automated commit blame thread'],
  [10000, 'AWS load balancer enters existential crisis'],
  [100000, 'Agent attempts hostile takeover of cloud provider'],
  [1000000, 'Entire corporate intranet merged into one loop'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`PULLED ETHERNET CABLE AT ${formatX(view.cashoutX100)} · BACKUP ARCHIVE SAVED!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Spectating · Watched main branch burn' : 'Spectating · No server power deployed', COLOURS.textMuted];
  }
  if (crashed) return [`AWS wiped: Lost ${credits(view.stake)} in force-push aftermath`, COLOURS.alertRed];
  return [`Agent running with your ${credits(view.stake)} · Pull cord before crash!`, COLOURS.warningAmber];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastTickSecond = 0;

  // Pseudo-random pseudo-terminal code lines
  const CODE_SNIPPETS = [
    'git push --force origin main -f -f',
    'eval(Buffer.from(payload).toString())',
    'DROP DATABASE IF EXISTS prod CASCADE;',
    'rm -rf /var/log/* && rm -rf /etc/nginx',
    'curl -sX POST https://api.agent.ai/nuke',
    'chmod -R 777 /sys/kernel/debug',
    'sed -i "s/true/Math.random()>0.5/g" *',
  ];

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Audio triggers
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('whoosh', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('zap', 0.6);
      }
      const tickSec = Math.floor(view.elapsed / 200);
      if (tickSec !== lastTickSecond && !cashed) {
        lastTickSecond = tickSec;
        audio.fx('beep', 0.2 + 0.5 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    // Crash animations
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 16 * clamp01(1 - age / 0.8) ** 2
      : running
      ? tension * 3.5 * Math.sin(now * 0.03)
      : 0;

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Apply shake offset
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. Background Grid & Server Racks
    ctx.strokeStyle = '#152033';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = 0; y <= 540; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Left and Right Server Racks
    const drawServerRack = (rx: number) => {
      ctx.fillStyle = COLOURS.serverRack;
      ctx.fillRect(rx, 90, 110, 370);
      ctx.strokeStyle = '#223048';
      ctx.strokeRect(rx, 90, 110, 370);

      // Blinking LEDs
      for (let i = 0; i < 12; i++) {
        const ledY = 110 + i * 28;
        ctx.fillStyle = '#06101c';
        ctx.fillRect(rx + 10, ledY, 90, 18);
        const blink1 = Math.sin(now * 0.008 + i * 1.5) > 0.2;
        const blink2 = Math.sin(now * 0.012 + i * 2.3) > 0;
        ctx.fillStyle = crashed
          ? '#ff2244'
          : blink1
          ? tension > 0.5
            ? '#ff9900'
            : COLOURS.terminalGreen
          : '#1a3325';
        ctx.beginPath();
        ctx.arc(rx + 22, ledY + 9, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = blink2 ? '#00e5ff' : '#0e2b38';
        ctx.beginPath();
        ctx.arc(rx + 35, ledY + 9, 4, 0, Math.PI * 2);
        ctx.fill();

        // mini activity bar
        ctx.fillStyle = crashed ? '#ff2244' : '#2dd4bf';
        const barW = (Math.sin(now * 0.005 + i) * 0.5 + 0.5) * 45;
        ctx.fillRect(rx + 48, ledY + 7, barW, 4);
      }

      // Smoke particles if high tension or crashed
      if (tension > 0.4 || crashed) {
        ctx.save();
        const puffCount = crashed ? 8 : 4;
        for (let p = 0; p < puffCount; p++) {
          const puffAge = ((now * 0.002 + p * 0.4) % 1);
          const py = 90 - puffAge * 80;
          const px = rx + 30 + Math.sin(puffAge * 8 + p) * 20;
          ctx.fillStyle = crashed ? 'rgba(255, 60, 60, 0.4)' : 'rgba(160, 170, 190, 0.25)';
          ctx.beginPath();
          ctx.arc(px, py, 10 + puffAge * 24, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    };
    drawServerRack(25);
    drawServerRack(825);

    // 2. Desk & Workstation Centerpiece
    ctx.fillStyle = COLOURS.desk;
    ctx.fillRect(160, 370, 640, 100);
    ctx.fillStyle = '#10141f';
    ctx.fillRect(170, 465, 30, 75);
    ctx.fillRect(760, 465, 30, 75);

    // Monitors (Left, Center Main, Right)
    // Left Monitor: Terminal / Git push history
    ctx.fillStyle = '#05070d';
    ctx.fillRect(180, 210, 140, 150);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(180, 210, 140, 150);
    ctx.fillStyle = COLOURS.terminalGreen;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.save();
    ctx.beginPath();
    ctx.rect(182, 212, 136, 146);
    ctx.clip();
    const scrollY = (view.elapsed * 0.15) % 120;
    for (let l = 0; l < 9; l++) {
      const lineStr = CODE_SNIPPETS[(l + Math.floor(view.elapsed / 300)) % CODE_SNIPPETS.length] ?? '';
      ctx.fillText(`> ${lineStr.slice(0, 18)}`, 186, 226 + l * 16 - scrollY);
      ctx.fillText(`+ ${formatX(view.currentX100)} commit #${l * 73}`, 186, 320 + l * 16 - scrollY);
    }
    ctx.restore();

    // Right Monitor: Metrics & Warning Popups
    ctx.fillStyle = '#05070d';
    ctx.fillRect(640, 210, 140, 150);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(640, 210, 140, 150);
    ctx.fillStyle = tension > 0.4 ? COLOURS.alertRed : COLOURS.screenGlow;
    ctx.font = '10px monospace';
    ctx.fillText('CPU LOAD: 100%', 646, 230);
    ctx.fillText(`PRs: ${Math.floor(view.elapsed * 1.5)}`, 646, 246);
    ctx.fillText('DB: UNCOMMITTED', 646, 262);

    // Stacking red warning boxes on right screen as tension mounts
    const warnings = Math.min(4, Math.floor(tension * 5));
    for (let w = 0; w < warnings; w++) {
      ctx.fillStyle = 'rgba(255, 45, 85, 0.85)';
      ctx.fillRect(646 + w * 6, 275 + w * 14, 115, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('! FORCE PUSH WARN', 650 + w * 6, 289 + w * 14);
    }

    // Main Center Monitor: Live AI Console & Multiplier
    const monitorX = 340;
    const monitorY = 170;
    const monitorW = 280;
    const monitorH = 190;
    ctx.fillStyle = '#03080e';
    ctx.fillRect(monitorX, monitorY, monitorW, monitorH);
    ctx.lineWidth = 3;
    ctx.strokeStyle = crashed ? COLOURS.alertRed : cashed ? COLOURS.cashedOut : '#3b82f6';
    ctx.strokeRect(monitorX, monitorY, monitorW, monitorH);
    // Monitor stand
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(460, 360, 40, 15);
    ctx.fillRect(440, 375, 80, 8);

    // Inside Center Monitor: Multiplier or Crash Screen
    ctx.textAlign = 'center';
    if (crashed) {
      // Skull / 502 BAD GATEWAY
      ctx.fillStyle = 'rgba(255, 30, 60, 0.2)';
      ctx.fillRect(monitorX + 4, monitorY + 4, monitorW - 8, monitorH - 8);
      ctx.fillStyle = COLOURS.alertRed;
      ctx.font = 'bold 24px monospace';
      ctx.fillText('502 GATEWAY', 480, 235);
      // Glowing skull outline
      ctx.beginPath();
      ctx.arc(480, 280, 24, 0, Math.PI * 2);
      ctx.rect(470, 296, 20, 14);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(472, 277, 6, 0, Math.PI * 2);
      ctx.arc(488, 277, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText('ALL DATABASES WIPED', 480, 340);
    } else {
      // Live Terminal Multiplier
      ctx.fillStyle = '#062015';
      ctx.fillRect(monitorX + 4, monitorY + 4, monitorW - 8, 24);
      ctx.fillStyle = '#34d399';
      ctx.font = '10px monospace';
      ctx.fillText('ROOT@AI-DEPLOYER:~# git push --force', 480, 20);

      // Multiplier display
      ctx.fillStyle = cashed ? COLOURS.cashedOut : tension > 0.6 ? '#ff5577' : COLOURS.terminalGreen;
      const pulseFont = 46 + (tension > 0.5 ? Math.sin(now * 0.02) * 4 : 0);
      ctx.font = `bold ${pulseFont}px monospace`;
      ctx.fillText(formatX(view.currentX100), 480, 275);

      ctx.fillStyle = COLOURS.screenGlow;
      ctx.font = '12px monospace';
      ctx.fillText(running ? `[AGENT REFACTORING : ${(100 + depth * 900).toFixed(0)}%] ` : '[STANDBY / WAITING FOR TRIGGER]', 480, 310);

      // Progress / danger bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(360, 328, 240, 8);
      ctx.fillStyle = tension > 0.7 ? COLOURS.alertRed : COLOURS.warningAmber;
      ctx.fillRect(360, 328, 240 * tension, 8);
    }

    // 3. Protagonist: Junior Engineer
    // Positioned in front of the desk
    const engX = 480;
    const engY = 400;

    if (cashed) {
      // SAFE CASHOUT: Engineer yanked the Ethernet cable and holds magnetic tape archive!
      // Dive / celebrate posture
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('DISCONNECTED! TAPE BACKUP SAVED', 480, 395);

      // Hero holding tape reel
      ctx.fillStyle = COLOURS.tapeGold;
      ctx.beginPath();
      ctx.arc(engX + 45, engY + 50, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(engX + 45, engY + 50, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('BACKUP', engX + 45, engY + 53);

      // Yanked glowing blue ethernet cord
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(350, 420);
      ctx.quadraticCurveTo(390, 470, 420, 450);
      ctx.stroke();
      // Sparks at cable end
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(422, 448, 5, 5);
      ctx.fillRect(426, 443, 3, 3);
    } else {
      // Junior engineer sitting in chair, staring in horror / tension
      // Office chair back
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(engX - 35, engY + 20, 70, 80);

      // Head
      const headTremble = running ? (Math.random() - 0.5) * tension * 4 : 0;
      ctx.fillStyle = '#ffd6a5';
      ctx.beginPath();
      ctx.arc(engX + headTremble, engY + 35, 24, 0, Math.PI * 2);
      ctx.fill();

      // Wide Eyes
      const eyeSize = 6 + tension * 4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(engX - 8 + headTremble, engY + 32, eyeSize, 0, Math.PI * 2);
      ctx.arc(engX + 8 + headTremble, engY + 32, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      // Pupils shrinking with panic
      ctx.fillStyle = '#000000';
      const pupilSize = Math.max(2, 4 - tension * 2);
      ctx.beginPath();
      ctx.arc(engX - 7 + headTremble, engY + 32, pupilSize, 0, Math.PI * 2);
      ctx.arc(engX + 9 + headTremble, engY + 32, pupilSize, 0, Math.PI * 2);
      ctx.fill();

      // Sweating drops
      if (tension > 0.3) {
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(engX + 22 + headTremble, engY + 26, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Coffee Mug ("PROD")
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(engX + 50, engY + 45, 18, 22);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 6px sans-serif';
      ctx.fillText('PROD', engX + 59, engY + 58);
      // Steam or spilled coffee
      if (crashed) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(engX + 45, engY + 65, 30, 4); // spilled puddle
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(engX + 59, engY + 42);
        ctx.quadraticCurveTo(engX + 63, engY + 35, engX + 58, engY + 28);
        ctx.stroke();
      }
    }

    // 4. Header HUD (Title & Subtitle)
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.textLight;
    ctx.font = 'bold 26px monospace';
    ctx.fillText('ACCEPT ALL PUSH', 480, 36);

    ctx.fillStyle = COLOURS.screenGlow;
    ctx.font = '13px monospace';
    ctx.fillText('DEPLOYING UNTAMED CODING AGENT TO PRODUCTION', 480, 58);

    // 5. Milestone Banner & Story Beats
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    ctx.fillStyle = crashed
      ? COLOURS.alertRed
      : cashed
      ? COLOURS.cashedOut
      : running && milestoneIdx > 0
      ? COLOURS.tapeGold
      : COLOURS.textMuted;
    ctx.font = 'bold 15px system-ui, sans-serif';
    const milestoneCaption = crashed
      ? 'AUTO-GENERATED RESIGNATION LETTER SENT TO ALL-STAFF'
      : running && currentMilestone
      ? `⚡ [${formatX(currentMilestone[0])}] ${currentMilestone[1]}`
      : PHASE_LABELS[view.phase];
    ctx.fillText(milestoneCaption, 480, 495);

    // 6. Stake and Cashout Status Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(lineText, 480, 524);

    // Red emergency screen flash on crash
    if (crashed && age < 0.6) {
      ctx.fillStyle = `rgba(255, 0, 50, ${0.4 * (1 - age / 0.6)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    ctx.restore();
  }

  return { draw };
}
