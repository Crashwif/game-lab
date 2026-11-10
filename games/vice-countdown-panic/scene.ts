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

const MILESTONES: [number, string][] = [
  [120, 'Pre-load reaches 1% on dial-up speed'],
  [150, 'Energy drink tower reaches ceiling'],
  [200, 'Boss sends calendar invite for release day'],
  [250, 'Leaked radio soundtrack blares outside'],
  [300, 'Speedrunning grocery haul for week one'],
  [500, "Neighbor's Wi-Fi stolen for backup link"],
  [1000, 'Midnight launch queue forms on sidewalk'],
  [10000, 'Physical steelbook arrives on drone'],
  [100000, 'Day one 120GB patch completes in seconds'],
  [1000000, 'Ascend directly into 4K Vice City traffic'],
];

const COLOURS = {
  bgDeep: '#0b041a',
  neonPink: '#ff2a8d',
  neonCyan: '#05d9e8',
  neonOrange: '#ff7700',
  neonYellow: '#ffe600',
  crashed: '#ff2255',
  cashedOut: '#00ffaa',
  text: '#fdfbfe',
  muted: '#9a8ca8',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`PTO APPROVED at ${formatX(view.cashoutX100)} · 3 Weeks Sick Leave Locked`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Router yanked · Spectating safe' : 'Watching the countdown · No credits committed', COLOURS.muted];
  }
  if (crashed) return [`Mom pulled the cord · Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Clutching controller · ${credits(view.stake)} locked in`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'static' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastHeartbeat = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Trigger audio cues
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1200);
      audio.fx('zap', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('notify', 0.7);
      }
      const heartbeatInterval = Math.max(240, 1000 - tension * 700);
      if (now - lastHeartbeat > heartbeatInterval && !cashed) {
        audio.fx('tick', 0.2 + tension * 0.5);
        lastHeartbeat = now;
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : running ? Math.sin(now * 0.04) * (tension * 2.5) : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. Synthwave Sunset Background Window
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 360);
    bgGrad.addColorStop(0, '#0f051d');
    bgGrad.addColorStop(0.4, '#390b4d');
    bgGrad.addColorStop(0.8, crashed ? '#3b0615' : '#8a1859');
    bgGrad.addColorStop(1, '#ff6a00');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Glowing Retro Sun
    const sunY = 190 - tension * 30;
    const sunGrad = ctx.createRadialGradient(480, sunY, 10, 480, sunY, 130);
    sunGrad.addColorStop(0, '#fff494');
    sunGrad.addColorStop(0.5, COLOURS.neonPink);
    sunGrad.addColorStop(1, 'rgba(255, 42, 141, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(480, sunY, 130, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal Sun Blinds / Synthwave scanlines
    ctx.fillStyle = '#0f051d';
    for (let i = 0; i < 9; i++) {
      const barY = sunY + 10 + i * 12;
      const barH = 2 + i * 1.2;
      ctx.fillRect(350, barY, 260, barH);
    }

    // Palm tree silhouettes through the room's giant bay window
    ctx.fillStyle = '#090212';
    // Left palm
    ctx.beginPath();
    ctx.moveTo(110, 380);
    ctx.quadraticCurveTo(125, 260, 90, 150);
    ctx.lineTo(80, 150);
    ctx.quadraticCurveTo(115, 260, 100, 380);
    ctx.fill();
    for (let a = -1.2; a <= 1.2; a += 0.45) {
      ctx.beginPath();
      ctx.moveTo(85, 150);
      ctx.quadraticCurveTo(85 + Math.cos(a) * 70, 150 + Math.sin(a) * 50 - 20, 85 + Math.cos(a) * 90, 150 + Math.sin(a) * 60 + 15);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#090212';
      ctx.stroke();
    }

    // Right palm
    ctx.beginPath();
    ctx.moveTo(850, 380);
    ctx.quadraticCurveTo(835, 250, 870, 140);
    ctx.lineTo(880, 140);
    ctx.quadraticCurveTo(845, 250, 860, 380);
    ctx.fill();
    for (let a = -2.2; a <= 0.2; a += 0.45) {
      ctx.beginPath();
      ctx.moveTo(875, 140);
      ctx.quadraticCurveTo(875 + Math.cos(a) * 70, 140 + Math.sin(a) * 50 - 20, 875 + Math.cos(a) * 90, 140 + Math.sin(a) * 60 + 15);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#090212';
      ctx.stroke();
    }

    // 2. Horizon Synthwave Perspective Grid Floor
    ctx.strokeStyle = crashed ? 'rgba(255, 34, 85, 0.4)' : 'rgba(5, 217, 232, 0.5)';
    ctx.lineWidth = 1.5;
    const gridY = 320;
    const speedOffset = (view.elapsed * (0.05 + tension * 0.2)) % 40;
    for (let y = gridY; y < 540; y += 18) {
      const py = gridY + (y - gridY + speedOffset) % (540 - gridY);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(960, py);
      ctx.stroke();
    }
    for (let x = -200; x <= 1160; x += 65) {
      ctx.beginPath();
      ctx.moveTo(480, gridY - 10);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }

    // 3. Dark Room Foreground / Gamer Desk
    ctx.fillStyle = '#06020c';
    ctx.fillRect(0, 360, 960, 180);

    // Energy Drink Can Tower on the Left Desk
    const canCount = Math.min(22, 3 + Math.floor(tension * 18));
    for (let c = 0; c < canCount; c++) {
      const col = c % 4;
      const row = Math.floor(c / 4);
      const cx = 160 + col * 26 + (row % 2) * 12;
      const cy = 350 - row * 38;
      ctx.fillStyle = row % 2 === 0 ? COLOURS.neonCyan : COLOURS.neonPink;
      ctx.fillRect(cx, cy, 20, 34);
      ctx.fillStyle = COLOURS.neonYellow;
      ctx.fillRect(cx + 4, cy + 12, 12, 6);
      // Can rim
      ctx.fillStyle = '#bbb';
      ctx.fillRect(cx - 1, cy - 2, 22, 3);
    }

    // Giant Dual Monitors in the Gamer's Den
    const monitorX = 480;
    const monitorY = 330;
    // Glow behind screen
    const screenGlow = ctx.createRadialGradient(monitorX, monitorY, 30, monitorX, monitorY, 240);
    const glowColor = crashed ? 'rgba(255,34,85,0.45)' : cashed ? 'rgba(0,255,170,0.45)' : 'rgba(5,217,232,0.45)';
    screenGlow.addColorStop(0, glowColor);
    screenGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = screenGlow;
    ctx.fillRect(200, 150, 560, 320);

    // Protagonist Gamer (Center Silhouette + Pajamas + Glowing controller)
    const gamerJitter = running ? Math.sin(now * 0.06) * (tension * 3) : 0;
    const gamerX = 480 + gamerJitter;
    const gamerY = 375;

    // Gamer Body / Pajama Hoodie
    ctx.fillStyle = crashed ? '#2b0b14' : '#1d1338';
    ctx.beginPath();
    ctx.ellipse(gamerX, gamerY + 45, 52, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hoodie Head & Unkempt Hair
    ctx.fillStyle = '#120b24';
    ctx.beginPath();
    ctx.arc(gamerX, gamerY - 12, 32, 0, Math.PI * 2);
    ctx.fill();
    // Sleep-deprived frantic gamer face
    ctx.fillStyle = '#f5c6a5';
    ctx.beginPath();
    ctx.arc(gamerX, gamerY - 10, 24, 0, Math.PI * 2);
    ctx.fill();

    // Wild Messy Hair Tufts
    ctx.fillStyle = '#261208';
    for (let h = -24; h <= 24; h += 8) {
      ctx.beginPath();
      ctx.moveTo(gamerX + h, gamerY - 24);
      ctx.lineTo(gamerX + h + (h > 0 ? 8 : -8), gamerY - 42 - Math.sin(now * 0.01 + h) * 4);
      ctx.lineTo(gamerX + h + 6, gamerY - 22);
      ctx.fill();
    }

    // Glowing Wide Eyes reflected by Screen
    const eyeBlink = Math.sin(now * 0.003) > 0.96 ? 0.2 : 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(gamerX - 9, gamerY - 12, 6, 8 * eyeBlink, 0, 0, Math.PI * 2);
    ctx.ellipse(gamerX + 9, gamerY - 12, 6, 8 * eyeBlink, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils dilated with pure countdown panic
    ctx.fillStyle = crashed ? '#ff1144' : COLOURS.neonCyan;
    ctx.beginPath();
    ctx.arc(gamerX - 8, gamerY - 12, 3, 0, Math.PI * 2);
    ctx.arc(gamerX + 10, gamerY - 12, 3, 0, Math.PI * 2);
    ctx.fill();

    // Dark eye circles (9 days without sleep)
    ctx.strokeStyle = 'rgba(80, 20, 80, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(gamerX - 9, gamerY - 8, 8, 0.2, Math.PI - 0.2);
    ctx.arc(gamerX + 9, gamerY - 8, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Glowing Controller clutched in white-knuckle hands
    const padY = gamerY + 28 + Math.sin(now * 0.05) * (tension * 2);
    ctx.fillStyle = '#151520';
    ctx.beginPath();
    ctx.roundRect(gamerX - 26, padY - 10, 52, 24, 8);
    ctx.fill();

    // Controller LED bar glow
    const ledColor = cashed ? COLOURS.cashedOut : crashed ? COLOURS.crashed : COLOURS.neonPink;
    ctx.fillStyle = ledColor;
    ctx.shadowColor = ledColor;
    ctx.shadowBlur = 12;
    ctx.fillRect(gamerX - 14, padY - 8, 28, 5);
    ctx.shadowBlur = 0;

    // Hands gripping controller
    ctx.fillStyle = '#e8b896';
    ctx.beginPath();
    ctx.arc(gamerX - 25, padY, 9, 0, Math.PI * 2);
    ctx.arc(gamerX + 25, padY, 9, 0, Math.PI * 2);
    ctx.fill();

    // Pre-load Progress Bar at bottom of screen
    const preloadPct = clamp01(view.currentX100 / 1000);
    ctx.fillStyle = 'rgba(10, 10, 25, 0.8)';
    ctx.fillRect(280, 420, 400, 14);
    ctx.strokeStyle = COLOURS.neonPink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(280, 420, 400, 14);
    ctx.fillStyle = cashed ? COLOURS.cashedOut : crashed ? COLOURS.crashed : COLOURS.neonCyan;
    ctx.fillRect(282, 422, Math.max(4, 396 * preloadPct), 10);

    // 4. OVERLAYS: Crash (Mom unplugs router + BSOD) vs Cashed Out (3-Week PTO Sports Car Escape)
    if (crashed) {
      // Glitch scanlines & Blue Screen Of Death overlay
      ctx.fillStyle = 'rgba(0, 18, 90, 0.78)';
      ctx.fillRect(0, 0, 960, 540);

      // Digital Static noise lines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let s = 0; s < 14; s++) {
        const sy = (now * 1.5 + s * 45) % 540;
        ctx.fillRect(0, sy, 960, 2 + (s % 3));
      }

      // Spark explosion at the surge protector
      ctx.fillStyle = COLOURS.neonYellow;
      for (let sp = 0; sp < 12; sp++) {
        const angle = (sp / 12) * Math.PI * 2;
        const dist = 30 + (crashAgeSec * 160) % 120;
        ctx.fillRect(720 + Math.cos(angle) * dist, 440 + Math.sin(angle) * dist, 4, 4);
      }

      ctx.fillStyle = COLOURS.crashed;
      ctx.textAlign = 'center';
      ctx.font = '900 24px ui-monospace, monospace';
      ctx.fillText('⚡ CRITICAL FAILURE: MOM YANKED THE SURGE PROTECTOR ⚡', 480, 126);
      ctx.font = '700 16px ui-monospace, monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText('ERROR_DAY_ONE_CORRUPT // 0xDEAD_WIFI // 9 DAYS WASTED', 480, 154);
    } else if (cashed) {
      // Victory Banner: Approved PTO & Neon Palm Cruise
      const badgeY = 138;
      ctx.fillStyle = 'rgba(0, 30, 20, 0.82)';
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(240, badgeY - 32, 480, 64, 12);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '900 24px ui-monospace, monospace';
      ctx.fillText('🌴 3-WEEK PTO APPROVED & STAMPED! 🌴', 480, badgeY);
      ctx.font = '700 15px ui-monospace, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Physical steelbook delivered · Escaping into the Vice sunset', 480, badgeY + 22);
    }

    // 5. HUD: Game Header & Giant Multiplier
    ctx.textAlign = 'center';

    // Game Title & Countdown theme
    ctx.shadowColor = COLOURS.neonPink;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLOURS.neonPink;
    ctx.font = '900 32px system-ui, -apple-system, sans-serif';
    ctx.fillText('VICE COUNTDOWN PANIC', 480, 42);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '700 13px ui-monospace, monospace';
    const countdownDays = Math.max(0, 9 - Math.floor(view.elapsed / 2500));
    ctx.fillText(`HOLD OUT WITHOUT TOUCHING GRASS · LAUNCH T-MINUS 0${countdownDays}d 14h 22m`, 480, 68);

    // Multiplier Callout
    const multColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.text;
    const multScale = 1 + depth * 0.15 + (crashed ? 0.08 * Math.sin(crashAgeSec * 30) : 0);
    ctx.fillStyle = multColor;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = running ? 18 : 6;
    ctx.font = `900 ${Math.round(84 * multScale)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 114);
    ctx.shadowBlur = 0;

    // Milestone / Status Caption
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.neonYellow;
    const captionText = crashed
      ? 'CONNECTION SEVERED · BACK OF THE LINE'
      : running
        ? currentMilestone?.[1] ?? 'Counting down to zero hour...'
        : view.phase === 'betting'
          ? 'GRAB YOUR CONTROLLER · LAUNCH WINDOW IMMINENT'
          : 'SYNCING SERVERS...';
    ctx.fillText(captionText, 480, 462);

    // Stake Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.font = '600 17px ui-monospace, monospace';
    ctx.fillStyle = lineCol;
    ctx.fillText(lineText, 480, 502);

    ctx.restore();
  }

  return { draw };
}
