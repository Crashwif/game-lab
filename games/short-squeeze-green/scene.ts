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
  bgDark: '#080c14',
  gridLine: 'rgba(16, 185, 129, 0.12)',
  candleBody: '#00f576',
  candleGlow: 'rgba(0, 245, 118, 0.4)',
  wick: '#34d399',
  redWick: '#ff1e56',
  redGlow: 'rgba(255, 30, 86, 0.5)',
  gold: '#ffd700',
  text: '#f8fafc',
  muted: '#94a3b8',
  bearBrown: '#854d0e',
  bearSuit: '#1e293b',
  tieRed: '#ef4444',
  cashedOut: '#6ee7b7',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Candle turns lime green, breaking sixty grand'],
  [150, 'First ten million in short orders liquidated'],
  [200, 'Bearish macro influencers delete their threads'],
  [250, 'Sixty-five thousand dollar wall smashed down'],
  [300, 'Leverage cascade triggers automated buying frenzy'],
  [500, 'One hundred thirty million in bears wiped out'],
  [1000, 'God candle punches straight through the ozone'],
  [10000, 'Exchange matching engine begins emitting steam'],
  [100000, "Short sellers apply for night shifts at Wendy's"],
  [1000000, 'Candle establishes permanent orbit near Jupiter'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Vault secured at ${formatX(view.cashoutX100)} · champagne on ice!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Watched the squeeze collapse' : 'Watching short squeeze · 0 credits riding', COLOURS.muted];
  }
  if (crashed) return [`Squashed! Your ${credits(view.stake)} got liquidated`, COLOURS.redWick];
  return [`Riding the God Candle · ${credits(view.stake)} on the rocket`, COLOURS.candleBody];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'hardstyle', crash: 'boom' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSirenStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('boom', previousPhase === null || view.crashAge > 1500);
      audio.fx('shatter', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('airhorn', 0.7);
      }
      const sirenStep = Math.floor(view.elapsed / 1200);
      if (sirenStep > lastSirenStep && tension > 0.4) {
        audio.fx('siren', 0.2 + tension * 0.4);
        lastSirenStep = sirenStep;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * Math.max(0, 1 - crashAgeSec / 0.5) : tension * 2.5 * Math.sin(now * 0.05);

    ctx.save();
    // Screen shake
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.09));

    // Dynamic trading floor background with speed lines
    ctx.fillStyle = COLOURS.bgDark;
    ctx.fillRect(0, 0, 960, 540);

    const speed = running ? 180 + tension * 620 : (crashed ? 0 : 40);
    const scroll = (view.elapsed * (speed / 1000)) % 100;

    // Background ceiling rafters & neon chart grids
    ctx.strokeStyle = COLOURS.gridLine;
    ctx.lineWidth = 1.5;
    for (let y = -100 + scroll; y < 540; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }
    for (let x = 0; x <= 960; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }

    // Flashing margin call warning beacons
    if (tension > 0.2 && !cashedOut) {
      const strobe = Math.sin(now * 0.015) > 0 ? 0.22 * tension : 0;
      ctx.fillStyle = `rgba(255, 30, 86, ${strobe})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // Falling / blasted short-selling suit bears
    if (running || crashed) {
      const bearSeedCount = 4;
      for (let i = 0; i < bearSeedCount; i++) {
        const offset = i * 160;
        const bearY = ((view.elapsed * (0.35 + i * 0.1) + offset) % 650) - 80;
        const bearX = 140 + i * 230 + Math.sin(view.elapsed * 0.003 + i) * 60;
        const angle = (view.elapsed * 0.006 * (i % 2 === 0 ? 1 : -1));

        ctx.save();
        ctx.translate(bearX, bearY);
        ctx.rotate(angle);
        // Bear head & ears
        ctx.fillStyle = COLOURS.bearBrown;
        ctx.beginPath();
        ctx.arc(0, -10, 16, 0, Math.PI * 2);
        ctx.arc(-14, -22, 6, 0, Math.PI * 2);
        ctx.arc(14, -22, 6, 0, Math.PI * 2);
        ctx.fill();
        // Suit & tie
        ctx.fillStyle = COLOURS.bearSuit;
        ctx.fillRect(-12, 6, 24, 22);
        ctx.fillStyle = COLOURS.tieRed;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.lineTo(-4, 20);
        ctx.lineTo(0, 26);
        ctx.lineTo(4, 20);
        ctx.fill();
        // Distress sweat drops
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(16, -14, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Rocket Candlestick Centerpiece
    const cx = 480;
    const baseCy = 310;
    const hover = Math.sin(view.elapsed * 0.008) * 8;
    const cy = baseCy + hover;

    // Squish factor on crash
    let scaleX = 1;
    let scaleY = 1;
    if (crashed) {
      const squash = clamp01(crashAgeSec / 0.15);
      scaleY = Math.max(0.12, 1 - squash * 0.88);
      scaleX = 1 + squash * 0.9;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, scaleY);

    // Rocket Thruster Flames
    if (!crashed) {
      const flameH = 40 + tension * 70 + Math.random() * 15;
      const flameW = 28 + Math.random() * 8;
      const grad = ctx.createLinearGradient(0, 60, 0, 60 + flameH);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#38bdf8');
      grad.addColorStop(0.7, '#f97316');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-flameW / 2, 60);
      ctx.quadraticCurveTo(0, 60 + flameH * 1.2, flameW / 2, 60);
      ctx.fill();

      // Side smoke plumes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(-24, 65 + Math.random() * 8, 12, 0, Math.PI * 2);
      ctx.arc(24, 65 + Math.random() * 8, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom Wick
    ctx.strokeStyle = COLOURS.wick;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(0, 85);
    ctx.stroke();

    // Upper Wick / Rocket nose
    ctx.strokeStyle = COLOURS.wick;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(0, -100);
    ctx.stroke();
    // Upper spark
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, -100, 4 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();

    // Candle Body (Green Pillar)
    const candleWidth = 72;
    const candleHeight = 120;
    ctx.shadowColor = COLOURS.candleGlow;
    ctx.shadowBlur = 24 + tension * 30;
    const bodyGrad = ctx.createLinearGradient(-candleWidth / 2, 0, candleWidth / 2, 0);
    bodyGrad.addColorStop(0, '#10b981');
    bodyGrad.addColorStop(0.4, COLOURS.candleBody);
    bodyGrad.addColorStop(1, '#059669');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-candleWidth / 2, -candleHeight / 2, candleWidth, candleHeight, 14);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Gold Chain & Big $ Medallion
    ctx.strokeStyle = COLOURS.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 5, 22, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // Medallion
    ctx.fillStyle = COLOURS.gold;
    ctx.beginPath();
    ctx.arc(0, 26, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 27);

    // Candle Face: Cool Sunglasses & Grin
    if (!crashed) {
      // Shades
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-26, -30, 22, 14);
      ctx.fillRect(4, -30, 22, 14);
      ctx.fillRect(-6, -26, 12, 4);
      // Glare on sunglasses
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(-22, -28, 4, 10);
      ctx.fillRect(8, -28, 4, 10);

      // Confident Grin
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, -6, 15, 0.15, Math.PI - 0.15);
      ctx.stroke();
      // White teeth
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -6, 12, 0.25, Math.PI - 0.25);
      ctx.fill();
    } else {
      // Dizzy 'X' eyes on crash
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 4;
      const drawX = (ox: number) => {
        ctx.beginPath();
        ctx.moveTo(ox - 6, -24);
        ctx.lineTo(ox + 6, -12);
        ctx.moveTo(ox + 6, -24);
        ctx.lineTo(ox - 6, -12);
        ctx.stroke();
      };
      drawX(-15);
      drawX(15);
    }

    ctx.restore();

    // Crash: Giant Anvil Red Wick slamming down
    if (crashed) {
      const dropY = Math.min(cy - 20, -180 + crashAgeSec * 1400);
      ctx.save();
      ctx.translate(cx, dropY);
      // Giant Red Wick Anvil
      ctx.fillStyle = COLOURS.redWick;
      ctx.shadowColor = COLOURS.redGlow;
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.moveTo(-90, -80);
      ctx.lineTo(90, -80);
      ctx.lineTo(70, -20);
      ctx.lineTo(16, -20);
      ctx.lineTo(4, 30);
      ctx.lineTo(-4, 30);
      ctx.lineTo(-16, -20);
      ctx.lineTo(-70, -20);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // "REKT" stamped on anvil
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LIQUIDATION WICK', 0, -45);
      ctx.restore();
    }

    // Cashout safe vault celebration overlay
    if (cashedOut) {
      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, 920, 500);

      // Champagne glass icon on right side
      ctx.fillStyle = COLOURS.gold;
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🍾 VAULT COLD STORAGE SECURED 🍸', 480, 48);
      ctx.restore();
    }

    // --- HUD OVERLAY ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Live Ticker Status
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.candleBody;
    ctx.fillText('SHORT SQUEEZE GREEN', 480, 80);

    ctx.font = '600 14px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.muted;
    const statusNote = running
      ? `BEARS ON FIRE · LEVERAGE CASCADE DEPTH ${(depth * 100).toFixed(0)}%`
      : (crashed ? 'CRASH WICK EVENT' : 'STANDBY FOR LIQUIDATION IGNITION');
    ctx.fillText(statusNote, 480, 108);

    // Multiplier Text
    const numSize = 92 + (crashed ? 0 : tension * 16);
    ctx.font = `900 ${numSize}px ui-monospace, monospace`;
    ctx.fillStyle = crashed ? COLOURS.redWick : (cashedOut ? COLOURS.cashedOut : COLOURS.candleBody);
    ctx.shadowColor = crashed ? COLOURS.redGlow : COLOURS.candleGlow;
    ctx.shadowBlur = 20;
    ctx.fillText(formatX(view.currentX100), 480, 185);
    ctx.shadowBlur = 0;

    // Milestone / Narrative Alert Banner
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    const bannerText = running
      ? (currentMilestone ? `🚨 ${currentMilestone[1]} 🚨` : 'Pump ignited · squeezing short books')
      : (crashed ? '☠ MARGIN CALL COMPLETE: ORDER BOOK CLEARED' : 'Next squeeze round loading...');

    ctx.fillStyle = crashed ? '#fca5a5' : '#a7f3d0';
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 435, 880);

    // Player Stake / Position status bar
    const [lineText, lineColour] = stakeLine(view);
    ctx.fillStyle = lineColour;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 485, 880);

    ctx.restore();
  }

  return { draw };
}
