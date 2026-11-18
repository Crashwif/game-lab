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
  [120, 'Mild complaints about slide alignment begin'],
  [150, "Mocking the CFO's inspirational quote graphic"],
  [200, 'Green mic indicator blinks to yellow warning'],
  [250, 'Coworkers start spamming eyes emoji in chat'],
  [300, 'Calling the restructuring plan completely bogus'],
  [500, "CEO pauses monologue: 'What is that noise?'"],
  [1000, 'Volume bar pegs into dangerous redline'],
  [10000, 'Audio reverberates across 20 global offices'],
  [100000, 'Board members lean into their webcams in shock'],
  [1000000, 'Revealing confidential launch dates live on air'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [
      `Cashed out at ${formatX(view.cashoutX100)} · Router snipped & cord cut!`,
      '#6ee7b7',
    ];
  }
  if (view.stake === null) {
    return [
      crashed ? 'Broadcast pinned to 500 screens · No credits lost' : 'Lurking in call · No credits riding',
      '#94a3b8',
    ];
  }
  if (crashed) return [`Busted on live call! Lost ${credits(view.stake)}`, '#f87171'];
  return [`Hot mic riding · ${credits(view.stake)} on the line`, '#38bdf8'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'elevator', crash: 'scratch' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('whoosh', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('scratch', previousPhase === null || view.crashAge > 1500);
      audio.fx('gasp', 0.9);
    }
    if (running && previousPhase === 'running' && milestoneCount > previousMilestone) {
      audio.milestone(milestoneCount);
      audio.fx(milestoneCount >= 5 ? 'siren' : 'notify', 0.5 + 0.5 * tension);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneCount;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.6) : (running ? Math.sin(view.elapsed * 0.03) * 1.5 * tension : 0);

    ctx.save();
    ctx.clearRect(0, 0, 960, 540);
    if (shake !== 0) {
      ctx.translate(shake * Math.sin(view.elapsed * 0.08), shake * Math.cos(view.elapsed * 0.06));
    }

    // 1. Zoom Video Call Grid Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Call participant tiles (mock 3x2 grid of silent attendees)
    const tileW = 160;
    const tileH = 100;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const tx = 20 + col * (tileW + 10);
        const ty = 70 + row * (tileH + 10);
        ctx.fillStyle = '#1e293b';
        drawRoundedRect(ctx, tx, ty, tileW, tileH, 6);
        ctx.fill();

        // Attendee silhouette
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(tx + tileW / 2, ty + 36, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tx + tileW / 2, ty + 80, 26, Math.PI, 0);
        ctx.fill();

        // Attendee mute indicator (green / grey)
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(tx + 16, ty + tileH - 14, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.textAlign = 'left';
        const labels = ['HR Director', 'VP Sales', 'CEO Jenkins', 'Eng Lead', 'Legal Counsel', 'Product VP'];
        const lbl = labels[row * 3 + col] ?? 'Attendee';
        ctx.fillText(lbl, tx + 26, ty + tileH - 11);
      }
    }

    // Right Side: Soundwave Spike & Chat Feed
    const feedX = 670;
    const feedY = 70;
    const feedW = 270;
    const feedH = 340;
    ctx.fillStyle = '#111827';
    drawRoundedRect(ctx, feedX, feedY, feedW, feedH, 8);
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 13px ui-sans-serif, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('# all-hands-chat (500)', feedX + 14, feedY + 24);

    // Dynamic mock chat messages
    const chatMsgs = [
      'Sarah: wait who is that?',
      'Alex: 👀👀👀 is someone unmuted??',
      'HR pinned: PLEASE CHECK YOUR MIC',
      'Dave: OMG IS THAT JASON IN PAJAMAS',
      'CEO: whoever is ranting please stop',
    ];
    const msgsToShow = Math.min(chatMsgs.length, Math.floor(1 + tension * 4));
    for (let i = 0; i < msgsToShow; i++) {
      const msg = chatMsgs[i];
      if (!msg) continue;
      const my = feedY + 54 + i * 28;
      ctx.fillStyle = i === 2 ? '#f87171' : '#94a3b8';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(msg, feedX + 12, my);
    }

    // VU Volume Meter (escalates to crimson)
    const barX = feedX + 12;
    const barY = feedY + 240;
    const barW = feedW - 24;
    const barH = 18;
    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();

    const micLevel = running ? clamp01(0.2 + tension * 0.75 + Math.sin(view.elapsed * 0.02) * 0.08) : (crashed ? 1 : 0.05);
    const meterColor = micLevel > 0.75 ? '#ef4444' : micLevel > 0.45 ? '#f59e0b' : '#10b981';
    ctx.fillStyle = meterColor;
    drawRoundedRect(ctx, barX + 2, barY + 2, (barW - 4) * micLevel, barH - 4, 3);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px ui-sans-serif, system-ui';
    ctx.fillText('LIVE MIC INPUT (REDLINE ESCALATION)', barX, barY + barH + 16);

    // Centerpiece: Protagonist (Reclining remote worker in pajamas ranting)
    const cx = 350;
    const cy = 340;
    const cashed = view.cashoutX100 !== null;

    if (!cashed) {
      // Chair back
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.ellipse(cx - 20, cy + 20, 48, 65, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Pajama Body (plaid cyan/blue)
      const mouthOpen = running ? Math.sin(view.elapsed * 0.025) * 6 * tension : 0;
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 40, 36, 44, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Arm gesticulating
      const handWave = running ? Math.sin(view.elapsed * 0.015) * 12 : 0;
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 20, cy + 30);
      ctx.lineTo(cx + 50 + handWave, cy + 10 - handWave);
      ctx.stroke();

      // Coffee mug in hand
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx + 52 + handWave, cy - 2 - handWave, 16, 20);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 52 + handWave, cy - 2 - handWave, 16, 20);

      // Head
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(cx, cy - 24, 26, 0, Math.PI * 2);
      ctx.fill();

      // Messy bed-head hair
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 40, 20, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();

      // Eyes (wild/ranting)
      const eyeR = 3 + tension * 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + 6, cy - 26, eyeR + 2, 0, Math.PI * 2);
      ctx.arc(cx + 18, cy - 26, eyeR + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(cx + 7, cy - 26, eyeR, 0, Math.PI * 2);
      ctx.arc(cx + 19, cy - 26, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Ranting mouth
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.ellipse(cx + 14, cy - 10, 6 + mouthOpen * 0.5, 4 + mouthOpen, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Gaming Headset with Boom Mic
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 30, 28, Math.PI * 1.1, Math.PI * 2.05);
      ctx.stroke();

      // Ear cup
      ctx.fillStyle = tension > 0.5 ? '#ef4444' : '#06b6d4';
      ctx.beginPath();
      ctx.arc(cx + 2, cy - 24, 9, 0, Math.PI * 2);
      ctx.fill();

      // Headset Mic Boom pointing at mouth
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy - 18);
      ctx.quadraticCurveTo(cx + 14, cy - 8, cx + 24, cy - 8);
      ctx.stroke();

      // Glowing mic tip (Green -> Yellow -> Blinking Red)
      const blink = Math.sin(view.elapsed * 0.03) > 0;
      const micTipColor = tension > 0.7 ? (blink ? '#ef4444' : '#991b1b') : tension > 0.3 ? '#f59e0b' : '#22c55e';
      ctx.fillStyle = micTipColor;
      ctx.beginPath();
      ctx.arc(cx + 24, cy - 8, 5, 0, Math.PI * 2);
      ctx.fill();

      // Laptop on desk
      ctx.fillStyle = '#475569';
      ctx.fillRect(cx + 40, cy + 45, 70, 8);
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(cx + 75, cy + 45);
      ctx.lineTo(cx + 90, cy + 12);
      ctx.lineTo(cx + 125, cy + 12);
      ctx.lineTo(cx + 110, cy + 45);
      ctx.closePath();
      ctx.fill();
    } else {
      // Cashout State: Worker dove off-camera! Snipped router cord dangling!
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.ellipse(cx - 20, cy + 20, 48, 65, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Empty chair with dangling glowing headset
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - 10);
      ctx.lineTo(cx - 10, cy + 35);
      ctx.stroke();

      // Snipped cord with spark particles
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + 30, cy + 50);
      ctx.lineTo(cx + 55, cy + 65);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx + 55, cy + 65, 5, 0, Math.PI * 2);
      ctx.fill();

      // Snipping Scissors
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '28px ui-sans-serif, system-ui';
      ctx.fillText('✂️ CORD CUT! SAFE!', cx + 70, cy + 50);
    }

    // Top Header & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 24px ui-sans-serif, system-ui';
    ctx.fillText('UNMUTE NIGHTMARE', 480, 36);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 13px ui-sans-serif, system-ui';
    ctx.fillText('Gossip while muted · Cash out before CEO hits master unmute!', 480, 56);

    // Multiplier Callout
    const multColor = crashed ? '#f87171' : cashed ? '#6ee7b7' : tension > 0.6 ? '#f59e0b' : '#38bdf8';
    ctx.fillStyle = multColor;
    const pulse = running ? 1 + 0.05 * Math.sin(view.elapsed * 0.01) : 1;
    ctx.font = `800 ${Math.floor(72 * pulse)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 160);

    // Milestone Caption
    const currentMilestone = MILESTONES[milestoneCount - 1];
    const caption = running
      ? (currentMilestone?.[1] ?? 'Starting meeting monologue...')
      : (crashed ? 'HR PINNED YOUR WEBCAM TO ALL 500 CALLERS' : (cashed ? 'Router disconnected in nick of time!' : 'Ready for the all-hands'));

    ctx.fillStyle = crashed ? '#fca5a5' : '#cbd5e1';
    ctx.font = '600 16px ui-sans-serif, system-ui';
    ctx.fillText(caption, 480, 206);

    // Crash Dramatic Overlay (UNMUTED BANNER across all screens)
    if (crashed) {
      const bannerFade = clamp01(crashSec * 3);
      ctx.fillStyle = `rgba(220, 38, 38, ${0.85 * bannerFade})`;
      ctx.fillRect(0, 180, 960, 90);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 44px ui-sans-serif, system-ui';
      ctx.fillText('🔴 MASTER UNMUTED — YOU ARE LIVE', 480, 238);

      ctx.fillStyle = '#fef08a';
      ctx.font = '700 15px ui-monospace, monospace';
      ctx.fillText('CEO JENKINS: "WHOEVER HAS THE COFFEE MUG... SEE ME IMMEDIATELY"', 480, 262);
    }

    // Cashout safe banner
    if (cashed && !crashed) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      drawRoundedRect(ctx, 240, 220, 480, 48, 8);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '700 16px ui-sans-serif, system-ui';
      ctx.fillText('DODGED THE UNMUTE · YOU ARE OFFLINE AND SAFE', 480, 250);
    }

    // Bottom Stake Status Bar
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '600 18px ui-sans-serif, system-ui';
    ctx.fillText(lineText, 480, 505);

    // Subtle soundwave meter on bottom border
    if (running) {
      ctx.strokeStyle = meterColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < 960; x += 15) {
        const wave = Math.sin((x + view.elapsed * 0.4) * 0.05) * (8 + 18 * tension);
        if (x === 0) ctx.moveTo(x, 530 + wave);
        else ctx.lineTo(x, 530 + wave);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  return { draw };
}
