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
  bgDark: '#08060f',
  bgCard: '#130d24',
  neonCyan: '#00f2fe',
  neonPink: '#fe0879',
  neonYellow: '#ffe600',
  neonGreen: '#00ff87',
  dangerRed: '#ff2a5f',
  textLight: '#fbfaff',
  textMuted: '#8b84a6',
  goldCheck: '#ffd700',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First 3-sec visual hook snags 10k views'],
  [150, 'Auto-captions add red flashing emojis 🔥'],
  [200, 'Split-screen parkour keeps attention glued'],
  [250, 'Algorithm promotes reel to primary feed 🚀'],
  [300, 'View counter surpasses local stadium capacity'],
  [500, 'Dozens of burner bot accounts repost clip'],
  [1000, 'Engagement graph shoots vertically off monitor!'],
  [10000, 'Server farm catches fire parsing shares 🔥'],
  [100000, 'Algorithm thinks reel is a new global religion'],
  [1000000, 'Every phone on Earth vibrates with this clip!'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`Sponsor deal secured at ${formatX(view.cashoutX100)} · Trending Page safe!`, COLOURS.neonGreen];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Shadowbanned · Spectating viewer unharmed' : 'Observing the slop conveyor', COLOURS.textMuted];
  }
  if (view.phase === 'crashed') {
    return [`${credits(view.stake)} lost to account termination`, COLOURS.dangerRed];
  }
  return [`${credits(view.stake)} riding the viral wave`, COLOURS.neonYellow];
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  seed: number;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'phonk', crash: 'slam' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastBeatTick = 0;

  const popups: FloatingPopup[] = [
    { x: 120, y: 150, text: '❤️ +50K LIKES', color: COLOURS.neonPink, seed: 1 },
    { x: 830, y: 190, text: '💬 "SO REAL BRO"', color: COLOURS.neonCyan, seed: 2 },
    { x: 110, y: 280, text: '🔁 +12.4K REPOSTS', color: COLOURS.neonGreen, seed: 3 },
    { x: 840, y: 310, text: '🔔 SUB BOMBER', color: COLOURS.neonYellow, seed: 4 },
    { x: 140, y: 400, text: '🔥 TRENDING #1', color: COLOURS.dangerRed, seed: 5 },
  ];

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    // Audio cues
    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('cheer', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('slam', prevPhase === null || view.crashAge > 1200);
      audio.fx('buzz', 0.8);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('notify', 0.85);
      }
      // Heartbeat pulse to phonk tempo
      const beatPeriod = 360 - 180 * tension;
      if (view.elapsed - lastBeatTick > beatPeriod) {
        lastBeatTick = view.elapsed;
        if (view.cashoutX100 === null) {
          audio.fx('pop', 0.25 + 0.45 * tension);
        }
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) : (running ? Math.sin(now * 0.03) * (1.5 + 4 * tension) : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.05), shake * Math.cos(now * 0.06));

    // Studio Background: dark glowing high-tech streamer setup
    const bgGrad = ctx.createLinearGradient(0, 0, 960, 540);
    bgGrad.addColorStop(0, '#06040b');
    bgGrad.addColorStop(0.5, '#120b22');
    bgGrad.addColorStop(1, '#080512');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Neon soundwave bars in background
    ctx.save();
    const barCount = 38;
    const barWidth = 960 / barCount;
    for (let i = 0; i < barCount; i++) {
      const freq = Math.sin((view.elapsed * 0.008) + i * 0.4) * 0.5 + 0.5;
      const barH = 20 + freq * (60 + 120 * tension);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 242, 254, 0.07)' : 'rgba(254, 8, 121, 0.07)';
      ctx.fillRect(i * barWidth + 2, 540 - barH, barWidth - 4, barH);
    }
    ctx.restore();

    // Conveyor belt spit-out: vertical phone reels passing from left to right
    const beltSpeed = (view.elapsed * (0.15 + 0.35 * tension)) % 180;
    ctx.save();
    ctx.fillStyle = '#1c1530';
    ctx.fillRect(0, 360, 960, 16);
    // Conveyor rollers
    for (let rx = -40; rx < 1000; rx += 45) {
      const rollX = rx + (beltSpeed % 45);
      ctx.fillStyle = '#2f2352';
      ctx.beginPath();
      ctx.arc(rollX, 368, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Draw conveyor reels (small vertical video screens)
    for (let reelI = -1; reelI < 6; reelI++) {
      const reelX = reelI * 180 + (beltSpeed);
      if (reelX < -100 || reelX > 1020) continue;
      const reelY = 240 + Math.sin(now * 0.004 + reelI) * 4;

      ctx.save();
      ctx.translate(reelX, reelY);
      // Phone chassis
      ctx.fillStyle = '#0a0914';
      ctx.strokeStyle = reelI % 2 === 0 ? COLOURS.neonCyan : COLOURS.neonPink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-42, -75, 84, 150, 10);
      ctx.fill();
      ctx.stroke();

      // Split screen top: "Kinetic sand / soap cutting"
      ctx.fillStyle = reelI % 2 === 0 ? '#ff0055' : '#00e1d9';
      ctx.fillRect(-38, -70, 76, 68);
      // Split screen bottom: "Mobile subway parkour"
      ctx.fillStyle = reelI % 2 === 0 ? '#38ef7d' : '#ffea00';
      ctx.fillRect(-38, 2, 76, 68);

      // Flashing neon caption bar across reel
      const capFlash = Math.floor((now * 0.01 + reelI) % 3);
      ctx.fillStyle = capFlash === 0 ? COLOURS.neonYellow : '#ffffff';
      ctx.font = '900 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(reelI % 2 === 0 ? 'POV: BRO THINKS 💀' : 'WAIT FOR IT!! 😱', 0, 0);

      // Floating heart on phone
      ctx.fillStyle = COLOURS.neonPink;
      ctx.beginPath();
      ctx.arc(24, 45, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Protagonist & Ring Light Centerpiece (Glowing Creator)
    const centerX = 480;
    const centerY = 240;
    const ringRadius = 88 + 14 * tension;
    const ringPulse = Math.sin(now * 0.009) * 4;

    ctx.save();
    // Huge Ring Light Glow
    const ringGrad = ctx.createRadialGradient(centerX, centerY, ringRadius - 15, centerX, centerY, ringRadius + 35);
    ringGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    ringGrad.addColorStop(0.3, 'rgba(0, 242, 254, 0.6)');
    ringGrad.addColorStop(1, 'rgba(254, 8, 121, 0)');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius + 30 + ringPulse, 0, Math.PI * 2);
    ctx.fill();

    // Solid ring light frame
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Creator Silhouette inside ring light
    // Head & Hair
    ctx.fillStyle = '#221a38';
    ctx.beginPath();
    ctx.arc(centerX, centerY - 12, 38, 0, Math.PI * 2);
    ctx.fill();

    // RGB Streamer Cat-Ear Headphones
    ctx.fillStyle = COLOURS.neonPink;
    ctx.beginPath();
    ctx.ellipse(centerX - 42, centerY - 12, 8, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(centerX + 42, centerY - 12, 8, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cat ears
    ctx.beginPath();
    ctx.moveTo(centerX - 30, centerY - 45);
    ctx.lineTo(centerX - 16, centerY - 68);
    ctx.lineTo(centerX - 10, centerY - 45);
    ctx.moveTo(centerX + 30, centerY - 45);
    ctx.lineTo(centerX + 16, centerY - 68);
    ctx.lineTo(centerX + 10, centerY - 45);
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fill();

    // Hype Sunglasses / Eyewear with LED ticker
    ctx.fillStyle = '#06060c';
    ctx.beginPath();
    ctx.roundRect(centerX - 28, centerY - 20, 56, 18, 5);
    ctx.fill();
    ctx.strokeStyle = COLOURS.neonYellow;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes: either viral hype stars, dollars on cashout, or X_X on crash
    ctx.fillStyle = COLOURS.neonYellow;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (crashed) {
      ctx.fillStyle = COLOURS.dangerRed;
      ctx.fillText('✕   ✕', centerX, centerY - 7);
    } else if (view.cashoutX100 !== null) {
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.fillText('$   $', centerX, centerY - 7);
    } else {
      ctx.fillText('★   ★', centerX, centerY - 7);
    }

    // Mouth: shouting into mic or cheering
    ctx.fillStyle = crashed ? '#0f0814' : '#ff0055';
    ctx.beginPath();
    const mouthW = 10 + 10 * tension;
    ctx.ellipse(centerX, centerY + 12, mouthW, crashed ? 4 : 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Streamer Condenser Mic on boom arm
    ctx.strokeStyle = '#5f557c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - 80, centerY + 70);
    ctx.lineTo(centerX - 25, centerY + 22);
    ctx.stroke();
    // Foam mic head
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.beginPath();
    ctx.ellipse(centerX - 22, centerY + 20, 10, 15, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Floating Live Reaction Popups
    if (!crashed) {
      for (const p of popups) {
        const floatY = p.y + Math.sin(now * 0.003 + p.seed) * 12;
        ctx.save();
        ctx.fillStyle = 'rgba(15, 10, 28, 0.85)';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(p.x - 70, floatY - 16, 140, 30, 15);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = p.color;
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, floatY);
        ctx.restore();
      }
    }

    // Top HUD Title Bar
    ctx.save();
    ctx.fillStyle = 'rgba(6, 4, 12, 0.75)';
    ctx.fillRect(160, 16, 640, 68);
    ctx.strokeStyle = COLOURS.neonCyan;
    ctx.lineWidth = 2;
    ctx.strokeRect(160, 16, 640, 68);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('VIRAL REEL RUSH', 480, 42);

    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('AI SHORT-FORM GENERATOR · BEAT THE ENGAGEMENT POLICE', 480, 64);
    ctx.restore();

    // Multiplier & Views counter in center-top
    const estViews = Math.floor(10000 * Math.pow(view.currentX100 / 100, 2.4));
    const viewsStr = estViews > 1000000000 ? `${(estViews / 1000000000).toFixed(2)}B` : estViews > 1000000 ? `${(estViews / 1000000).toFixed(1)}M` : `${estViews.toLocaleString()} VIEWS`;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const multColor = crashed ? COLOURS.dangerRed : (view.cashoutX100 !== null ? COLOURS.neonGreen : COLOURS.textLight);
    const popScale = 1 + 0.18 * tension;
    ctx.font = `900 ${Math.round(62 * popScale)}px ui-monospace, monospace`;
    ctx.fillStyle = multColor;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 18;
    ctx.fillText(formatX(view.currentX100), 480, 126);
    ctx.shadowBlur = 0;

    // Viral views ticker
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonYellow;
    ctx.fillText(`👀 ${viewsStr}`, 480, 164);
    ctx.restore();

    // Milestone ticker card at bottom center
    const passedMilestone = MILESTONES[milestoneIdx - 1];
    ctx.save();
    ctx.fillStyle = 'rgba(12, 8, 24, 0.88)';
    ctx.fillRect(140, 416, 680, 44);
    ctx.strokeStyle = passedMilestone ? COLOURS.neonPink : '#362a58';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(140, 416, 680, 44);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = passedMilestone ? COLOURS.textLight : COLOURS.textMuted;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(passedMilestone ? passedMilestone[1] : 'Stacking hooks... priming the feed', 480, 438);

    // Stake / payout line
    const [statusMsg, statusColor] = stakeLine(view);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = statusColor;
    ctx.fillText(statusMsg, 480, 492);
    ctx.restore();

    // Safe Cashout Overlay: Sponsor Check & Trending Badge
    if (view.cashoutX100 !== null) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 255, 135, 0.12)';
      ctx.fillRect(0, 0, 960, 540);

      // Sponsor check banner
      ctx.translate(480, 280);
      ctx.fillStyle = '#062013';
      ctx.strokeStyle = COLOURS.goldCheck;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-240, -45, 480, 90, 12);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = COLOURS.goldCheck;
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.fillText('🏆 MEGA BRAND SPONSOR CONTRACT', 0, -14);
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.font = '800 18px ui-monospace, monospace';
      ctx.fillText(`LOGGED OFF AT ${formatX(view.cashoutX100)} · PAYOUT SECURED`, 0, 18);
      ctx.restore();
    }

    // Crashed Overlay: Shadowban Hazard Tape & Community Violation Stamp
    if (crashed) {
      const dropProgress = clamp01(crashAgeSec / 0.25);
      const bannerY = -120 + 240 * dropProgress;

      ctx.save();
      // Hazard diagonal stripes
      ctx.fillStyle = 'rgba(255, 0, 60, 0.22)';
      ctx.fillRect(0, 0, 960, 540);

      ctx.translate(480, bannerY);
      // Hazard Banner
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-480, -45, 960, 90);

      // Black stripes
      ctx.fillStyle = '#111111';
      for (let sx = -480; sx < 480; sx += 60) {
        ctx.beginPath();
        ctx.moveTo(sx, -45);
        ctx.lineTo(sx + 30, -45);
        ctx.lineTo(sx - 10, 45);
        ctx.lineTo(sx - 40, 45);
        ctx.fill();
      }

      // Red central warning box
      ctx.fillStyle = '#ff114a';
      ctx.fillRect(-340, -32, 680, 64);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(-340, -32, 680, 64);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.fillText('⚠ PERMANENT SHADOWBAN ENFORCED ⚠', 0, -5);
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('ACCOUNT TERMINATED: AUTOMATED ENGAGEMENT SLOP DETECTED', 0, 18);
      ctx.restore();
    }

    ctx.restore();
  }

  return { draw };
}
