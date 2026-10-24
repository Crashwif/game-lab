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
  bgDark: '#0b111e',
  bgWall: '#152238',
  mailSlots: '#1c2d4a',
  knicksBlue: '#006bb6',
  knicksOrange: '#f58426',
  gold: '#ffcc00',
  goldDark: '#c89600',
  diamondGlow: '#d8f6ff',
  diamondCore: '#ffffff',
  textLight: '#f0f5fc',
  textMuted: '#8ba2c4',
  dangerRed: '#ff3344',
  cashoutGreen: '#00e676',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Phishing test email pops up in inbox'],
  [150, 'Clicking link confirms ring size 14'],
  [200, 'HR realizes they promised real gold'],
  [250, 'Accounting panics as invoices arrive'],
  [300, 'First diamond ring slides onto thumb'],
  [500, 'Ten rings on fingers glowing bright'],
  [1000, 'Spike Lee sends thumbs up from courtside'],
  [10000, 'Knicks payroll hits minus four million'],
  [100000, 'Entire office wearing custom championship iced bling'],
  [1000000, 'Madison Square Garden handed to staff as apology'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Bling secured at ${formatX(view.cashoutX100)}! Safe in the elevator`, COLOURS.cashoutGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Audit hit! No rings confiscated' : 'Auditing mailroom · no rings wagered', COLOURS.textMuted];
  }
  if (crashed) return [`HR repossessed your ${credits(view.stake)} stake!`, COLOURS.dangerRed];
  return [`Stacking rings · ${credits(view.stake)} riding on the bling!`, COLOURS.knicksOrange];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'trap', crash: 'siren' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastRingTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (prevPhase !== null && running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('siren', prevPhase === null || view.crashAge > 1200);
      audio.fx('door', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestone) audio.milestone(milestoneIdx);
      const ringTick = Math.floor(view.elapsed / 280);
      if (ringTick > lastRingTick && !cashedOut) {
        audio.fx('clang', 0.35 + 0.5 * tension);
        lastRingTick = ringTick;
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) : running ? Math.sin(view.elapsed * 0.03) * (1 + 3 * tension) : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(crashAgeSec * 80 || view.elapsed * 0.05), shake * Math.cos(crashAgeSec * 60 || view.elapsed * 0.04));

    // Mailroom wall background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgDark);
    bgGrad.addColorStop(0.7, COLOURS.bgWall);
    bgGrad.addColorStop(1, '#0c1626');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Fluorescent ceiling lighting flicker
    const flick = running ? (Math.sin(view.elapsed * 0.015) > 0.96 ? 0.3 : 0.8) : 0.7;
    ctx.fillStyle = `rgba(180, 220, 255, ${0.08 * flick})`;
    ctx.beginPath();
    ctx.moveTo(380, 0); ctx.lineTo(580, 0); ctx.lineTo(750, 540); ctx.lineTo(210, 540);
    ctx.fill();

    // Mail sorting pigeonholes on background
    ctx.fillStyle = COLOURS.mailSlots;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        const x = 70 + c * 105;
        const y = 80 + r * 50;
        ctx.fillRect(x, y, 92, 40);
        ctx.fillStyle = '#0a1424';
        ctx.fillRect(x + 2, y + 2, 88, 36);
        // Letter slips inside slots
        ctx.fillStyle = (r + c) % 2 === 0 ? '#d4af37' : '#e2e8f0';
        ctx.fillRect(x + 12, y + 18, 64, 16);
        ctx.fillStyle = COLOURS.mailSlots;
      }
    }

    // Emergency Exit door (left) with green sign
    ctx.fillStyle = '#101e33';
    ctx.fillRect(30, 240, 90, 240);
    ctx.strokeStyle = '#223c63';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 240, 90, 240);
    ctx.fillStyle = cashedOut ? '#00ff77' : '#00aa44';
    ctx.fillRect(40, 215, 70, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('EXIT 🏃', 46, 230);

    // Mailroom Desk Surface
    const deskGrad = ctx.createLinearGradient(0, 390, 0, 540);
    deskGrad.addColorStop(0, '#2d3e58');
    deskGrad.addColorStop(1, '#151f2e');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(0, 390, 960, 150);
    ctx.fillStyle = COLOURS.knicksOrange;
    ctx.fillRect(0, 388, 960, 4);

    // Stacks of mail trays & accounting folders
    ctx.fillStyle = '#22334d';
    ctx.fillRect(140, 320, 110, 70);
    ctx.fillStyle = '#f58426';
    ctx.fillRect(145, 335, 100, 14);
    ctx.fillStyle = '#006bb6';
    ctx.fillRect(148, 355, 94, 14);

    // Swirling memos/paper particles in the AC draft
    const paperCount = 8 + Math.floor(tension * 16);
    ctx.fillStyle = 'rgba(240, 245, 255, 0.75)';
    for (let i = 0; i < paperCount; i++) {
      const speed = 0.0012 + (i % 3) * 0.0006;
      const angle = (view.elapsed * speed + i * 1.6) % (Math.PI * 2);
      const px = 480 + Math.cos(angle) * (180 + i * 14);
      const py = 220 + Math.sin(angle * 1.5) * (70 + i * 8);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle * 2);
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = 'rgba(255, 60, 60, 0.6)';
      ctx.fillRect(-8, -2, 16, 2); // Memo red header
      ctx.fillStyle = 'rgba(240, 245, 255, 0.75)';
      ctx.restore();
    }

    // MAIN HERO / ESCALATION: Mailroom clerk stacking giant rings
    const clerkX = cashedOut ? 220 : crashed ? 580 : 480;
    const trembling = running ? Math.sin(view.elapsed * 0.06) * (3 * tension) : 0;
    const clerkY = 380;

    // Clerk Torso / Knicks intern lanyard
    ctx.save();
    ctx.translate(clerkX + trembling, clerkY);

    if (cashedOut) {
      // Escape sprint pose towards the emergency exit
      ctx.fillStyle = '#10335e';
      ctx.beginPath();
      ctx.ellipse(-15, -70, 35, 65, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Intern Head (grinning relieved)
      ctx.fillStyle = '#f3c299';
      ctx.beginPath();
      ctx.arc(-40, -145, 24, 0, Math.PI * 2);
      ctx.fill();
      // Sunglasses / grin
      ctx.fillStyle = '#111111';
      ctx.fillRect(-52, -152, 26, 10);
      ctx.strokeStyle = '#f58426';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(-42, -132, 8, 0, Math.PI); ctx.stroke();
    } else if (crashed) {
      // Busted pose: hands up, rings flying off
      ctx.fillStyle = '#1a2638';
      ctx.beginPath();
      ctx.ellipse(0, -60, 36, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      // Intern Head (sweating/panicked)
      ctx.fillStyle = '#f3c299';
      ctx.beginPath();
      ctx.arc(0, -135, 25, 0, Math.PI * 2);
      ctx.fill();
      // Wide shocked eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-8, -140, 6, 0, Math.PI * 2); ctx.arc(8, -140, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath(); ctx.arc(-8, -140, 2.5, 0, Math.PI * 2); ctx.arc(8, -140, 2.5, 0, Math.PI * 2); ctx.fill();
      // O mouth
      ctx.fillStyle = '#441111';
      ctx.beginPath(); ctx.arc(0, -124, 7, 0, Math.PI * 2); ctx.fill();
    } else {
      // Intern body hunched over desk admiring the loot
      ctx.fillStyle = '#0f294a'; // Blue uniform shirt
      ctx.beginPath();
      ctx.ellipse(0, -55, 42, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      // Orange lanyard
      ctx.strokeStyle = COLOURS.knicksOrange;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-16, -115); ctx.lineTo(0, -40); ctx.lineTo(16, -115);
      ctx.stroke();
      // ID Badge
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12, -40, 24, 30);
      ctx.fillStyle = '#006bb6';
      ctx.fillRect(-10, -38, 20, 8);
      // Intern Head (sweating/focused)
      ctx.fillStyle = '#f3c299';
      ctx.beginPath();
      ctx.arc(0, -125, 24, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillStyle = '#3a2312';
      ctx.beginPath();
      ctx.arc(0, -132, 24, Math.PI, Math.PI * 2);
      ctx.fill();
      // Eyes looking down at glittering hands
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(-7, -122, 3, 0, Math.PI * 2); ctx.arc(7, -122, 3, 0, Math.PI * 2); ctx.fill();
      // Nervous sweat droplet
      if (tension > 0.3) {
        ctx.fillStyle = '#7cd8ff';
        ctx.beginPath();
        ctx.arc(16, -128 + (view.elapsed * 0.05) % 20, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HANDS & CHAMPIONSHIP RING STACK
    const ringCount = Math.min(18, Math.max(1, Math.floor(2 + tension * 12 + depth * 4)));
    const handLeftX = cashedOut ? 40 : -55;
    const handRightX = cashedOut ? 65 : 55;
    const handY = cashedOut ? -50 : -25;

    // Draw hands
    ctx.fillStyle = '#f3c299';
    ctx.beginPath(); ctx.arc(handLeftX, handY, 18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(handRightX, handY, 18, 0, Math.PI * 2); ctx.fill();

    // Stacking towering rings on fingers
    for (let i = 0; i < ringCount; i++) {
      const isRight = i % 2 === 0;
      const ringBaseX = isRight ? handRightX : handLeftX;
      const stackLevel = Math.floor(i / 2);
      const ringY = handY - 14 - stackLevel * 14;

      if (crashed) {
        // Scatter rings on crash
        const scatterAge = Math.min(1.2, crashAgeSec);
        const scatX = ringBaseX + (isRight ? 1 : -1) * (i * 24 * scatterAge);
        const scatY = ringY + (scatterAge * scatterAge * 320) - (i * 12);
        drawChampionshipRing(ctx, scatX, scatY, 0.85, (view.elapsed + i * 200) * 0.005);
      } else {
        const glint = Math.sin(view.elapsed * 0.008 + i * 0.8);
        drawChampionshipRing(ctx, ringBaseX, ringY, 1.0 + tension * 0.15, glint);
      }
    }

    ctx.restore();

    // CRASH OVERLAY: Audit squad repo raid
    if (crashed) {
      const repoAlpha = clamp01(crashAgeSec * 3);
      ctx.fillStyle = `rgba(180, 0, 10, ${0.18 * repoAlpha})`;
      ctx.fillRect(0, 0, 960, 540);

      // Audit Squad on Right
      const squadX = 760 - Math.min(100, crashAgeSec * 240);
      ctx.fillStyle = '#1b1b24';
      // HR Boss Body
      ctx.fillRect(squadX, 240, 60, 160);
      ctx.fillStyle = '#e8b898';
      ctx.beginPath(); ctx.arc(squadX + 30, 215, 22, 0, Math.PI * 2); ctx.fill();
      // Clipboard with REPO notice
      ctx.fillStyle = '#8a5d3b';
      ctx.fillRect(squadX - 28, 270, 36, 50);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(squadX - 24, 275, 28, 40);
      ctx.fillStyle = '#d32f2f';
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.fillText('AUDIT', squadX - 22, 290);
      ctx.fillText('CONFISCATE', squadX - 22, 304);

      // Warning tape stripe
      ctx.fillStyle = COLOURS.knicksOrange;
      ctx.save();
      ctx.translate(480, 150);
      ctx.rotate(-0.06);
      ctx.fillRect(-500, -18, 1000, 36);
      ctx.fillStyle = '#111111';
      ctx.font = '900 16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ ACCOUNTING ERROR DETECTED • HR AUDIT IN PROGRESS • REPOSSESSING BLING ⚠️', 0, 6);
      ctx.restore();
    }

    // CASHOUT OVERLAY: Safe down service elevator
    if (cashedOut) {
      ctx.fillStyle = 'rgba(0, 230, 118, 0.12)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = COLOURS.cashoutGreen;
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💎 SERVICE ELEVATOR ESCAPE SUCCESSFUL 💎', 480, 140);
    }

    // HUD / HEADERS
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText('CHAMPIONSHIP BAIT', 480, 42);

    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('KNICKS MAILROOM RING LOOTING INCIDENT', 480, 64);

    // Multiplier Callout
    const multColor = crashed ? COLOURS.dangerRed : cashedOut ? COLOURS.cashoutGreen : COLOURS.gold;
    const multPulse = running ? 1 + 0.08 * Math.sin(view.elapsed * 0.01) * tension : 1;
    ctx.save();
    ctx.translate(480, 220);
    ctx.scale(multPulse, multPulse);
    ctx.fillStyle = multColor;
    ctx.font = '900 78px ui-monospace, monospace';
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 18 * tension;
    ctx.fillText(formatX(view.currentX100), 0, 0);
    ctx.restore();

    // Active Milestone Banner
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    const bannerText = running
      ? (currentMilestone ? currentMilestone[1] : 'Loading oversized rings from mail sorting crates...')
      : crashed
      ? 'Audit Squad Confiscated All Cubic Zirconias'
      : view.phase === 'betting'
      ? 'New shipment of fake rings arrived · Ready to stack'
      : 'Waiting for next mail sorting shift';

    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 470, 880);

    // Stake line
    const [stkText, stkCol] = stakeLine(view);
    ctx.fillStyle = stkCol;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(stkText, 480, 506, 880);

    ctx.restore();
  }

  function drawChampionshipRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    sparklePhase: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Gold band
    ctx.fillStyle = COLOURS.goldDark;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Massive Diamond encrusted ring face
    ctx.fillStyle = COLOURS.gold;
    ctx.beginPath();
    ctx.ellipse(0, -6, 20, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Center faceted diamond gem
    ctx.fillStyle = COLOURS.diamondCore;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(10, -6);
    ctx.lineTo(0, 4);
    ctx.lineTo(-10, -6);
    ctx.closePath();
    ctx.fill();

    // Knicks logo gem inset (Orange/Blue)
    ctx.fillStyle = COLOURS.knicksBlue;
    ctx.beginPath();
    ctx.arc(0, -6, 4, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle star burst
    if (Math.sin(sparklePhase) > 0.4) {
      ctx.strokeStyle = COLOURS.diamondGlow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -6); ctx.lineTo(12, -6);
      ctx.moveTo(0, -18); ctx.lineTo(0, 6);
      ctx.stroke();
    }

    ctx.restore();
  }

  return { draw };
}
