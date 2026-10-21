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
  bg: '#0c0e17',
  neonCyan: '#00f0ff',
  neonPink: '#ff2a85',
  neonYellow: '#ffe600',
  text: '#f4f6fa',
  muted: '#8e9aaf',
  cashedOut: '#2fe695',
  crashed: '#ff334b',
  slackRed: '#e01e5a',
  slackGreen: '#2eb67d',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Fakes a slight morning cough on company Slack'],
  [150, 'Coworkers start vanishing from morning standup'],
  [200, 'Boss posts furious passive-aggressive emoji'],
  [250, 'US national GDP dips by fifty million bucks'],
  [300, 'Entire middle-management floor is a ghost town'],
  [500, 'Corporate IT tries remote pinging your router'],
  [1000, 'News anchor reports an empty national workforce'],
  [10000, 'The Federal Reserve begs gamers to check email'],
  [100000, 'The stock exchange halts trading due to afk'],
  [1000000, 'Economy fully collapses into open-world sandbox'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Set status to 🩺 Doctor Appointment at ${formatX(view.cashoutX100)} · Safe & munching nachos`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'HR busted in · spectator mode' : 'Watching the absentee strike unfold', COLOURS.muted];
  }
  if (crashed) return [`Busted! Your ${credits(view.stake)} got written up`, COLOURS.crashed];
  return [`On the clock: ${credits(view.stake)} riding on your sick call`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let pingTimer = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('door', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('notify', 0.9);
      }
      if (now - pingTimer > Math.max(260, 1600 - tension * 1300) && !cashedOut) {
        pingTimer = now;
        audio.fx('beep', 0.35 + 0.5 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(crashAgeSec * 80), shake * Math.sin(crashAgeSec * 60));

    // 1. Synthwave Bedroom / Matrix Grid Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#0a0d18');
    bgGrad.addColorStop(0.65, '#16192d');
    bgGrad.addColorStop(1, '#080a12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Synth horizon floor grid
    ctx.strokeStyle = `rgba(255, 42, 133, ${0.12 + 0.18 * tension})`;
    ctx.lineWidth = 1.5;
    const gridY = 360;
    for (let x = -200; x <= 1160; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, gridY);
      ctx.lineTo(480 + (x - 480) * 3, 540);
      ctx.stroke();
    }
    const gridSpeed = (view.elapsed * (0.05 + 0.2 * tension)) % 30;
    for (let y = gridY; y <= 540; y += 15 + (y - gridY) * 0.4) {
      const ly = y + gridSpeed * ((y - gridY) / 180);
      if (ly <= 540) {
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(960, ly);
        ctx.stroke();
      }
    }

    // Distant empty cubicles & ghost office silhouettes
    ctx.fillStyle = '#0f1322';
    const cubicleCount = 6;
    for (let i = 0; i < cubicleCount; i++) {
      const cx = 40 + i * 155;
      const ch = 90 + Math.sin(i * 1.5) * 20;
      ctx.fillRect(cx, gridY - ch, 110, ch);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.fillRect(cx + 15, gridY - ch + 15, 30, 25);
      ctx.fillStyle = '#0f1322';
    }

    // Piling up burning Slack notification icons / towers
    const stackHeight = Math.min(240, milestone * 24 + tension * 40);
    const drawNotificationTower = (tx: number) => {
      const items = Math.floor(stackHeight / 26);
      for (let s = 0; s < items; s++) {
        const ny = gridY - 10 - s * 24;
        ctx.fillStyle = s % 2 === 0 ? COLOURS.slackRed : COLOURS.slackGreen;
        ctx.beginPath();
        ctx.roundRect(tx - 35, ny - 10, 70, 20, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`! PING #${s + 1}`, tx, ny + 4);
      }
    };
    drawNotificationTower(130);
    drawNotificationTower(830);

    // 2. Centerpiece: The Gamer Sanctuary vs The Boss
    const bob = running ? Math.sin(view.elapsed / 180) * (4 + tension * 6) : 0;
    const charX = 480;
    const charY = 350 + bob;

    // Glowing RGB Gaming Monitor
    const glow = ctx.createRadialGradient(charX, charY - 60, 20, charX, charY - 60, 180);
    glow.addColorStop(0, cashedOut ? 'rgba(47, 230, 149, 0.35)' : `rgba(0, 240, 255, ${0.25 + 0.35 * tension})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(charX - 200, charY - 220, 400, 300);

    // Cozy gaming beanbag / sofa chair
    ctx.fillStyle = cashedOut ? '#2b2353' : '#1f2438';
    ctx.beginPath();
    ctx.ellipse(charX, charY + 20, 85, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Protagonist body in pajama hoodie
    ctx.fillStyle = cashedOut ? '#48bb78' : '#6b46c1';
    ctx.beginPath();
    ctx.roundRect(charX - 42, charY - 45, 84, 65, 20);
    ctx.fill();

    // Head / Messy hair
    ctx.fillStyle = '#ffdfba';
    ctx.beginPath();
    ctx.arc(charX, charY - 60, 24, 0, Math.PI * 2);
    ctx.fill();
    // Bedhead hair
    ctx.fillStyle = '#3d2618';
    ctx.beginPath();
    ctx.arc(charX, charY - 70, 26, Math.PI, Math.PI * 2);
    ctx.fill();

    if (cashedOut) {
      // Relaxed sunglasses & Nacho plate
      ctx.fillStyle = '#111';
      ctx.fillRect(charX - 18, charY - 64, 36, 10);
      // Soda cup with straw
      ctx.fillStyle = COLOURS.neonPink;
      ctx.fillRect(charX + 45, charY - 20, 20, 32);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(charX + 53, charY - 32, 4, 14);
      // Cheesy nacho chip in hand
      ctx.fillStyle = '#f6ad55';
      ctx.beginPath();
      ctx.moveTo(charX - 40, charY - 30);
      ctx.lineTo(charX - 25, charY - 15);
      ctx.lineTo(charX - 50, charY - 15);
      ctx.closePath();
      ctx.fill();
    } else {
      // Controller in hands with RGB glow
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.roundRect(charX - 26, charY - 25, 52, 22, 8);
      ctx.fill();
      // Glowing thumbsticks
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.beginPath();
      ctx.arc(charX - 12, charY - 14, 5, 0, Math.PI * 2);
      ctx.arc(charX + 12, charY - 14, 5, 0, Math.PI * 2);
      ctx.fill();
      // Wide gamer eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(charX - 8, charY - 60, 6, 0, Math.PI * 2);
      ctx.arc(charX + 8, charY - 60, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.beginPath();
      ctx.arc(charX - 8, charY - 60, 3, 0, Math.PI * 2);
      ctx.arc(charX + 8, charY - 60, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crash Scene: Angry Boss breaking the bedroom door
    if (crashed) {
      const bossSlide = Math.min(1, crashAgeSec * 4);
      const doorX = 740 - (1 - bossSlide) * 160;

      // Splintered door debris
      ctx.save();
      ctx.fillStyle = '#8b5a2b';
      ctx.translate(doorX + 60, 320);
      ctx.rotate(0.35);
      ctx.fillRect(-25, -120, 50, 160);
      ctx.restore();

      // Boss Body
      ctx.fillStyle = '#1a202c'; // suit
      ctx.fillRect(doorX - 40, 200, 70, 150);
      // Furious Boss Face
      ctx.fillStyle = '#f56565';
      ctx.beginPath();
      ctx.arc(doorX - 5, 170, 30, 0, Math.PI * 2);
      ctx.fill();
      // Megaphone
      ctx.fillStyle = '#e53e3e';
      ctx.beginPath();
      ctx.moveTo(doorX - 35, 175);
      ctx.lineTo(doorX - 85, 150);
      ctx.lineTo(doorX - 85, 200);
      ctx.closePath();
      ctx.fill();
      // Written Write-up Notice
      ctx.fillStyle = '#fff';
      ctx.fillRect(doorX - 100, 230, 48, 64);
      ctx.fillStyle = '#e53e3e';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('FINAL WRITEUP', doorX - 76, 250);
      ctx.fillText('STEAM: IN-GAME', doorX - 76, 265);

      // Boss Screaming Bubble
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(doorX - 250, 100, 230, 50, 10);
      ctx.fill();
      ctx.fillStyle = '#c53030';
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WE SEE YOUR STEAM STATUS!!', doorX - 135, 128);
    }

    // 3. HUD and Multiplier Presentation
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.neonPink;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('SICK DAY SIX', 480, 42);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('CALL OUT BEFORE HR TRACKS DOWN YOUR CONSOLE', 480, 68);

    // Live Slack Status Tag
    const tagText = cashedOut
      ? 'STATUS: 🩺 DOCTOR APPOINTMENT (AWAY)'
      : crashed
        ? 'STATUS: 🚨 BUSTED BY HR MANAGEMENT'
        : running
          ? 'STATUS: 🟡 IDLE · CONTROLLER CLUTCHED'
          : 'STATUS: ⚪ LOGGING IN OFF-GRID';
    ctx.fillStyle = cashedOut ? COLOURS.cashedOut : crashed ? COLOURS.crashed : COLOURS.neonYellow;
    ctx.font = '700 14px monospace';
    ctx.fillText(tagText, 480, 96);

    // Massive Multiplier Readout
    const multColor = cashedOut ? COLOURS.cashedOut : crashed ? COLOURS.crashed : '#ffffff';
    ctx.fillStyle = multColor;
    ctx.font = `900 ${72 + tension * 12}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 160);

    // Milestone ticker / current chaos
    const currentBeat = MILESTONES[milestone - 1];
    ctx.fillStyle = tension > 0.6 ? COLOURS.neonYellow : COLOURS.text;
    ctx.font = '600 20px system-ui, sans-serif';
    const chaosText = crashed
      ? '💥 Bedroom breached! Manager write-up served!'
      : (running ? (currentBeat ? currentBeat[1] : 'Clocking out secretly...') : 'Call out sick and boot up your console');
    ctx.fillText(chaosText, 480, 440);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(line, 480, 486);

    // National Absenteeism Bar
    const barWidth = 460;
    const barFill = barWidth * clamp01(view.currentX100 / 1000);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(480 - barWidth / 2, 514, barWidth, 8);
    ctx.fillStyle = cashedOut ? COLOURS.cashedOut : COLOURS.neonPink;
    ctx.fillRect(480 - barWidth / 2, 514, barFill, 8);

    ctx.restore();
  }

  return { draw };
}
