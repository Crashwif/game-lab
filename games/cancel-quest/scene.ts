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
  [120, 'Guilt owl begins weeping openly'],
  [150, '"KEEP PLAN" button glows toxic neon'],
  [200, 'Actual cancel link shrunk to 3px gray'],
  [250, 'Stacked modals pleading: DO NOT LEAVE'],
  [300, 'Mandatory 40-question exit exam loaded'],
  [500, 'Support line redirected to Reykjavik fax'],
  [1000, '5 blurry crosswalk CAPTCHAs required'],
  [10000, 'Hidden cancel button hidden in HTML source'],
  [100000, 'Quantum unsubscribe portal unstable'],
  [1000000, 'Absolute zero-bill corporate liberation'],
];

const COLOURS = {
  bg: '#0f172a',
  windowBg: '#1e293b',
  windowBar: '#334155',
  neonGreen: '#22c55e',
  neonGlow: 'rgba(34, 197, 94, 0.45)',
  crashed: '#ef4444',
  cashedOut: '#10b981',
  textMuted: '#94a3b8',
  white: '#f8fafc',
  tearBlue: '#38bdf8',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Unsubscribed safely at ${formatX(view.cashoutX100)} · zero sneaky fees!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Subscription expired · spectator view' : 'Browsing without active subscription', COLOURS.textMuted];
  }
  if (crashed) {
    return [`Trapped! Auto-renewed 20-year plan with ${credits(view.stake)}`, COLOURS.crashed];
  }
  return [`Attempting cancellation · ${credits(view.stake)} at risk of auto-renew`, '#38bdf8'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'elevator', crash: 'static' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastClickSec = 0;

  function drawOwl(ctx: CanvasRenderingContext2D, cx: number, cy: number, tension: number, elapsed: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Body
    const breathe = Math.sin(elapsed * 0.005) * 2;
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.ellipse(0, 4 + breathe, 42, 48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#e0e7ff';
    ctx.beginPath();
    ctx.ellipse(0, 14 + breathe, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ear tufts
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.moveTo(-32, -32 + breathe);
    ctx.lineTo(-44, -58 + breathe);
    ctx.lineTo(-16, -42 + breathe);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(32, -32 + breathe);
    ctx.lineTo(44, -58 + breathe);
    ctx.lineTo(16, -42 + breathe);
    ctx.fill();

    // Large sad eyes
    const eyeRadius = 14 + tension * 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-18, -10 + breathe, eyeRadius, 0, Math.PI * 2);
    ctx.arc(18, -10 + breathe, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Quivering pupils
    const tremble = Math.sin(elapsed * 0.03) * (1 + tension * 3);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-18 + tremble, -8 + breathe, 6, 0, Math.PI * 2);
    ctx.arc(18 + tremble, -8 + breathe, 6, 0, Math.PI * 2);
    ctx.fill();

    // Sad eyebrows
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-32, -26 + breathe);
    ctx.lineTo(-8, -18 + breathe);
    ctx.moveTo(32, -26 + breathe);
    ctx.lineTo(8, -18 + breathe);
    ctx.stroke();

    // Beak
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(0, 4 + breathe);
    ctx.lineTo(-6, -4 + breathe);
    ctx.lineTo(6, -4 + breathe);
    ctx.closePath();
    ctx.fill();

    // Tear streams
    const tearIntensity = 1 + tension * 4;
    ctx.fillStyle = COLOURS.tearBlue;
    for (let i = 0; i < 6; i++) {
      const t = (elapsed * 0.003 * tearIntensity + i * 0.3) % 1;
      const dropY = 4 + t * 50;
      const spread = (i % 2 === 0 ? -1 : 1) * (18 + t * 12);
      ctx.beginPath();
      ctx.arc(spread, dropY + breathe, 2.5 + t * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(5, 14);
    ctx.lineTo(9, 22);
    ctx.lineTo(13, 20);
    ctx.lineTo(9, 12);
    ctx.lineTo(16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1500);
      audio.fx('buzzer' in audio ? 'buzz' : 'buzz', 0.8);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('notify', 0.6);
      }
      const sec = Math.floor(view.elapsed / 650);
      if (sec > lastClickSec && !cashed) {
        lastClickSec = sec;
        audio.fx('click', 0.3 + 0.4 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAge = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAge / 0.6) ** 2 : 0;

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    if (shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shake * 2,
        (Math.random() - 0.5) * shake * 2
      );
    }

    // Grid pattern in the background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 960; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = 0; y < 540; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Stacked popups escalation in the background
    const extraModals = Math.min(4, Math.floor(tension * 5));
    for (let i = extraModals; i > 0; i--) {
      const offsetX = 480 + (i % 2 === 0 ? i * 22 : -i * 22);
      const offsetY = 270 - i * 16;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(offsetX - 260, offsetY - 140, 520, 280);
      ctx.strokeRect(offsetX - 260, offsetY - 140, 520, 280);
    }

    // Main Cancel Window
    const winX = 220;
    const winY = 85;
    const winW = 520;
    const winH = 340;

    // Window shadow & body
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = COLOURS.windowBg;
    ctx.fillRect(winX, winY, winW, winH);
    ctx.shadowBlur = 0;

    // Title bar
    ctx.fillStyle = COLOURS.windowBar;
    ctx.fillRect(winX, winY, winW, 36);

    // Window buttons
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(winX + 16, winY + 18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(winX + 32, winY + 18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(winX + 48, winY + 18, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Account Settings > Billing > Membership > Confirmation [Step 7/14]', winX + winW / 2, winY + 23);

    // Owl mascot inside modal
    drawOwl(ctx, winX + 105, winY + 140, tension, view.elapsed);

    // Dialog text
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOURS.white;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('Are you sure you want to lose', winX + 180, winY + 80);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('UNLIMITED HAPPINESS VIP?', winX + 180, winY + 105);

    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Barnaby the Owl will lose his healthcare', winX + 180, winY + 132);
    ctx.fillText('and your profile icon turns into a crying turnip.', winX + 180, winY + 150);

    // Gigantic NEON KEEP MEMBERSHIP button
    const btnPulse = Math.sin(view.elapsed * 0.008) * 0.08;
    ctx.save();
    ctx.shadowColor = COLOURS.neonGlow;
    ctx.shadowBlur = 16 + tension * 12;
    ctx.fillStyle = COLOURS.neonGreen;
    const btnX = winX + 180;
    const btnY = winY + 175;
    const btnW = 300;
    const btnH = 50;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#052e16';
    ctx.font = `700 ${16 + btnPulse * 10}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('KEEP MEMBERSHIP (99% OFF)', btnX + btnW / 2, btnY + 28);
    ctx.font = '500 10px system-ui, sans-serif';
    ctx.fillText('★ RECOMMENDED BY 9 OUT OF 10 MASCOTS ★', btnX + btnW / 2, btnY + 42);

    // Shifting, evasive microscopic CANCEL button
    const cancelPhase = view.elapsed * 0.002;
    const cancelX = winX + 220 + Math.sin(cancelPhase) * (50 + tension * 60);
    const cancelY = winY + 265 + Math.cos(cancelPhase * 1.5) * (8 + tension * 12);
    const fontPx = Math.max(3, 11 - tension * 8);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.font = `400 ${fontPx}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('cancel membership and disappoint family', cancelX, cancelY);

    // Chasing cursor
    const cursorLag = 0.85;
    const curTargetX = cancelX - 6;
    const curTargetY = cancelY - 8;
    const curX = curTargetX + Math.sin(view.elapsed * 0.007) * 25 * (1 - cursorLag);
    const curY = curTargetY + Math.cos(view.elapsed * 0.005) * 20 * (1 - cursorLag);
    drawCursor(ctx, curX, curY);

    // TOP HUD: Multiplier and Milestones
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 58px ui-monospace, monospace';
    const multColor = cashed ? COLOURS.cashedOut : crashed ? COLOURS.crashed : '#38bdf8';
    ctx.fillStyle = multColor;
    ctx.fillText(formatX(view.currentX100), 480, 58);

    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.textMuted;
    ctx.fillText(
      activeMilestone ? `Stage ${milestoneIndex}: ${activeMilestone[1]}` : 'Dark Pattern Multiplier Escalating',
      480,
      winY + winH + 34
    );

    // Bottom Stake / Outcome line
    const [line, color] = stakeLine(view);
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(line, 480, 500);

    // Overlay on Cashout
    if (cashed) {
      ctx.fillStyle = 'rgba(6, 78, 59, 0.88)';
      ctx.fillRect(winX + 20, winY + 46, winW - 40, winH - 60);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '800 28px system-ui, sans-serif';
      ctx.fillText('SUBSCRIPTION CANCELLED!', winX + winW / 2, winY + 120);

      ctx.fillStyle = '#ecfdf5';
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillText('No hidden fees applied.', winX + winW / 2, winY + 160);
      ctx.fillText(`Cashed out clean at ${formatX(view.cashoutX100 ?? 100)}`, winX + winW / 2, winY + 190);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Confirmation code: #FREE-FROM-GREED-00', winX + winW / 2, winY + 225);
    }

    // Overlay on Crash
    if (crashed) {
      const redFlash = Math.sin(crashAge * 20) > 0 ? 'rgba(239, 68, 68, 0.92)' : 'rgba(185, 28, 28, 0.95)';
      ctx.fillStyle = redFlash;
      ctx.fillRect(winX + 15, winY + 45, winW - 30, winH - 55);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.fillText('AUTO-RENEW ACCEPTED!', winX + winW / 2, winY + 115);

      ctx.fillStyle = '#fef2f2';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillText('ENTERPRISE 20-YEAR ULTRA-RESERVE ACTIVATED', winX + winW / 2, winY + 155);

      ctx.font = '500 14px system-ui, sans-serif';
      ctx.fillText('Non-refundable · Billed tri-annually · Support chat: offline', winX + winW / 2, winY + 190);

      ctx.fillStyle = '#fca5a5';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('Owl Barnaby has been awarded a gold yacht in your honour.', winX + winW / 2, winY + 225);
    }

    ctx.restore();
  }

  return { draw };
}
