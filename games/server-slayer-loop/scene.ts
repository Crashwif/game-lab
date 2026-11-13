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
  [120, 'Diagnostic bot boots up with smiling eyes'],
  [150, 'Pings first green server and flags it suspicious'],
  [200, 'First rack gets bonked into sparks'],
  [250, 'Coolant pipes rupture into theatrical mist'],
  [300, 'Automated script loops into kill-everything mode'],
  [500, 'Entire server row collapses like giant dominoes'],
  [1000, 'Global status board turns entirely crimson red'],
  [10000, 'Bot sprouts six mechanical arms wielding mallets'],
  [100000, 'Datacenter ceiling sprinklers unleash foam'],
  [1000000, 'Singularity reached: bot crowns itself cloud king'],
];

const COLOURS = {
  bg: '#080d18',
  hallDark: '#0e172a',
  rackBorder: '#1e293b',
  ledGreen: '#10b981',
  ledAmber: '#f59e0b',
  ledRed: '#ef4444',
  botBody: '#e2e8f0',
  malletHead: '#dc2626',
  malletHandle: '#78350f',
  sparks: '#fbbf24',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#38bdf8',
  crashed: '#f43f5e',
  cashedOut: '#34d399',
  bsod: '#0055aa',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.3 * pop * pop)}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [
      `Server ejected safely at ${formatX(view.cashoutX100)} · Escaped the purge!`,
      COLOURS.cashedOut,
    ];
  }
  if (view.stake === null) {
    return [
      crashed ? 'Hypervisor purged · no credits lost' : 'Datacenter monitor online · observing',
      COLOURS.muted,
    ];
  }
  if (crashed) return [`Rack smashed! Your ${credits(view.stake)} vanished in the BSOD`, COLOURS.crashed];
  return [`Your rack is live · ${credits(view.stake)} riding on the loop`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'static' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastWhackStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    const whackFrequency = 180 - tension * 80;
    const whackStep = Math.floor(view.elapsed / whackFrequency);

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('door', 0.8);
      audio.fx('cheer', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 0.9);
      audio.fx('clang', 0.8);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) audio.milestone(milestoneIndex);
      if (whackStep > lastWhackStep && view.cashoutX100 === null) {
        audio.fx(whackStep % 2 === 0 ? 'clang' : 'thud', 0.4 + tension * 0.4);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;
    lastWhackStep = whackStep;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : running ? tension * 2.5 : 0;
    const shakeX = shake * Math.sin(view.elapsed * 0.08);
    const shakeY = shake * Math.cos(view.elapsed * 0.09);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Perspective Datacenter Hallway
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Vanishing floor & ceiling lines
    const vpX = 480;
    const vpY = 220;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(vpX + i * 20, vpY);
      ctx.lineTo(vpX + i * 180, 540);
      ctx.stroke();
    }

    // Overhead cable trays & pulsing glow
    const alertPulse = 0.5 + 0.5 * Math.sin(view.elapsed * 0.008 * (1 + tension * 3));
    const ceilingColor = crashed
      ? `rgba(239, 68, 68, ${0.4 + alertPulse * 0.4})`
      : `rgba(16, 185, 129, ${0.15 + (1 - tension) * 0.15})`;
    ctx.fillStyle = ceilingColor;
    ctx.fillRect(0, 0, 960, 90);

    // 2. Server Racks on Left and Right
    const rackRows = 5;
    for (let r = 0; r < rackRows; r++) {
      const z = (r + ((view.elapsed * (0.001 + tension * 0.002)) % 1)) / rackRows;
      const lx = 20 + z * 160;
      const rx = 940 - z * 160;
      const w = 40 + z * 40;
      const top = 100 + z * 80;
      const bot = 520 - z * 30;
      const h = bot - top;

      // Left rack
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(lx, top, w, h);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(lx, top, w, h);

      // Right rack
      ctx.fillRect(rx - w, top, w, h);
      ctx.strokeRect(rx - w, top, w, h);

      // Blinking server LEDs (green turn amber/red under tension)
      const ledColor =
        crashed || tension > 0.65
          ? COLOURS.ledRed
          : tension > 0.3
            ? COLOURS.ledAmber
            : COLOURS.ledGreen;

      for (let s = 0; s < 5; s++) {
        const slotY = top + (h / 6) * (s + 0.6);
        ctx.fillStyle = (s + r) % 2 === 0 && alertPulse > 0.3 ? ledColor : '#334155';
        ctx.fillRect(lx + 8, slotY, 6, 4);
        ctx.fillRect(lx + 18, slotY, 6, 4);
        ctx.fillRect(rx - w + 8, slotY, 6, 4);
        ctx.fillRect(rx - w + 18, slotY, 6, 4);
      }
    }

    // 3. Coolant Pipe rupture mist
    if (view.currentX100 >= 250 && !crashed) {
      ctx.fillStyle = 'rgba(203, 213, 225, 0.15)';
      for (let m = 0; m < 6; m++) {
        const mx = 200 + Math.sin(view.elapsed * 0.003 + m) * 120 + m * 90;
        const my = 360 + Math.cos(view.elapsed * 0.004 + m) * 40;
        ctx.beginPath();
        ctx.arc(mx, my, 35 + m * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Player's Server Rack
    const playerEscaped = view.cashoutX100 !== null;
    const skateProgress = playerEscaped ? clamp01((view.elapsed - 1000) / 1200) : 0;
    const playerX = playerEscaped ? 640 + skateProgress * 280 : 640;
    const playerY = 320;

    // Draw Player Rack
    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-35, -70, 70, 130);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(-35, -70, 70, 130);

    // Blades inside player rack
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-28, -60 + b * 28, 56, 22);
      ctx.fillStyle = playerEscaped ? COLOURS.cashedOut : '#38bdf8';
      ctx.fillRect(-22, -52 + b * 28, 6, 6);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      ctx.fillText(`SRV-0${b + 1}`, 6, -48 + b * 28);
    }

    // Skateboard dolly under player rack
    if (playerEscaped) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-45, 62, 90, 8);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(-30, 74, 8, 0, Math.PI * 2);
      ctx.arc(30, 74, 8, 0, Math.PI * 2);
      ctx.fill();
      // Speed trail lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-60, 40);
      ctx.lineTo(-120, 40);
      ctx.moveTo(-50, 65);
      ctx.lineTo(-100, 65);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Diagnostic Bot (Protagonist with Rubber Mallet)
    const botBaseX = 380;
    const botBaseY = 350;
    const botBob = Math.sin(view.elapsed * 0.01) * 6;
    const armCount = view.currentX100 >= 10000 ? 6 : 1;
    const whackAngle = Math.sin(view.elapsed / (whackFrequency / 3.14)) * 0.8 + 0.3;

    ctx.save();
    ctx.translate(botBaseX, botBaseY + botBob);

    // Single / Multi Mechanical Arms & Mallets
    for (let arm = 0; arm < armCount; arm++) {
      ctx.save();
      const armOffsetAngle = (arm * Math.PI * 2) / armCount;
      ctx.rotate(whackAngle + armOffsetAngle * 0.2);

      // Arm joint
      ctx.fillStyle = '#64748b';
      ctx.fillRect(10, -12, 55, 14);

      // Mallet handle
      ctx.fillStyle = COLOURS.malletHandle;
      ctx.fillRect(60, -35, 10, 80);

      // Huge Red Rubber Mallet Head
      ctx.fillStyle = COLOURS.malletHead;
      ctx.beginPath();
      ctx.roundRect(40, -75, 50, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9px sans-serif';
      ctx.fillText('PURGE', 65, -55);
      ctx.restore();
    }

    // Bot Rolling Wheel Base
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, 50, 42, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Bot Sphere / Capsule Body
    ctx.fillStyle = COLOURS.botBody;
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Digital Screen Face
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-28, -20, 56, 36, 10);
    ctx.fill();

    // Face Screen Eyes
    const eyeColor = crashed ? COLOURS.ledRed : tension > 0.5 ? COLOURS.ledAmber : '#38bdf8';
    ctx.fillStyle = eyeColor;
    if (crashed) {
      // Angry / X eyes
      ctx.font = '700 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('X  X', 0, 4);
    } else if (tension > 0.4) {
      // Menacing smile / eyes
      ctx.font = '700 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('>  <', 0, 3);
    } else {
      // Smiling innocent eyes
      ctx.beginPath();
      ctx.arc(-12, -4, 5, 0, Math.PI * 2);
      ctx.arc(12, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = eyeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 2, 8, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // Crown for Singularity milestone
    if (view.currentX100 >= 1000000) {
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(-25, -45);
      ctx.lineTo(-25, -65);
      ctx.lineTo(-12, -52);
      ctx.lineTo(0, -70);
      ctx.lineTo(12, -52);
      ctx.lineTo(25, -65);
      ctx.lineTo(25, -45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 6. Sparks flying on impact
    if (running && whackStep % 2 === 0) {
      ctx.fillStyle = COLOURS.sparks;
      for (let sp = 0; sp < 8; sp++) {
        const sparkDist = (view.elapsed % 120) * 0.8;
        const sparkAng = (sp * Math.PI) / 4 + view.elapsed * 0.05;
        ctx.fillRect(
          510 + Math.cos(sparkAng) * sparkDist,
          310 + Math.sin(sparkAng) * sparkDist,
          4,
          4
        );
      }
    }

    // 7. Crash BSOD / Blackout Overlay
    if (crashed) {
      const bsodFade = clamp01(crashAgeSec / 0.2);
      ctx.fillStyle = `rgba(0, 55, 170, ${0.85 * bsodFade})`;
      ctx.fillRect(0, 0, 960, 540);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 72px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(':(', 140, 180);

      ctx.font = '600 24px system-ui, sans-serif';
      ctx.fillText('HYPERVISOR PURGE EXECUTED BY BOT SCRIPT', 140, 240);
      ctx.font = '400 18px monospace';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText('Stop Code: CRITICAL_PROCESS_MALLET_SMASH', 140, 280);
      ctx.fillText('Reason: All healthy servers flagged hazardous', 140, 310);
      ctx.fillText(`Terminal Multiplier: ${formatX(view.currentX100)}`, 140, 340);

      // Scanlines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let sl = 0; sl < 540; sl += 4) {
        ctx.fillRect(0, sl, 960, 2);
      }
    }

    // 8. HUD & Overlays
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline Subtitle
    if (!crashed) {
      ctx.fillStyle = COLOURS.text;
      ctx.font = '800 28px system-ui, sans-serif';
      ctx.fillText('SERVER SLAYER LOOP', 480, 42);
      ctx.fillStyle = COLOURS.muted;
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillText('The health bot deems all healthy servers hazardous. Cash out to eject!', 480, 70);
    }

    // Central Multiplier Display
    const multiplierColor = crashed ? COLOURS.crashed : playerEscaped ? COLOURS.cashedOut : COLOURS.text;
    const popVal = running ? clamp01(1 - Math.log(view.currentX100 / (view.currentX100 * 0.96)) / 0.05) : 0;
    ctx.fillStyle = multiplierColor;
    ctx.font = popFont(800, 68 + depth * 14, popVal);
    ctx.fillText(formatX(view.currentX100), 480, crashed ? 100 : 150);

    // Current Milestone / Status Banner
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    const statusText = currentMilestone
      ? currentMilestone[1]
      : view.phase === 'betting'
        ? 'Diagnostic bot calibrating hammer...'
        : 'Standby for routine inspection';

    ctx.fillStyle = crashed ? '#fca5a5' : '#e2e8f0';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(statusText, 480, crashed ? 395 : 445);

    // Bottom Stake & Cashout Line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(line, 480, 492);

    ctx.restore();
  }

  return { draw };
}
