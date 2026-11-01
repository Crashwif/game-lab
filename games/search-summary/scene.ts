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
  [120, 'AI overview suggests adding stones for fiber'],
  [150, 'Top sponsored ads slide beneath the fold'],
  [200, 'Click-through metrics drop into freefall'],
  [250, 'Bot claims gasoline helps marinara boil faster'],
  [300, 'Board members begin sweating in conference rooms'],
  [500, 'Chief algorithm officer deletes his social handle'],
  [1000, 'Search result screen is 99 percent generated text'],
  [10000, 'Ad revenue graph plunges through the basement floor'],
  [100000, 'Algorithms debate each other in an infinite query loop'],
  [1000000, 'Zero humans search as AI scrapes its own echoes'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

const COLOURS = {
  bg: '#141824',
  browserBar: '#202636',
  cardBg: '#1b2234',
  cardBorder: '#7c5cfc',
  aiGlow: '#9b72ff',
  adBg: '#2a1e28',
  adBorder: '#ff5c77',
  adText: '#ff94a4',
  text: '#f2f5fb',
  muted: '#8e9ab2',
  accent: '#a78bfa',
  crashed: '#ff4d6d',
  cashout: '#38ef7d',
};

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastAdZapTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('notify', 0.6);
      }
      if (view.elapsed - lastAdZapTick > Math.max(160, 600 - tension * 420)) {
        lastAdZapTick = view.elapsed;
        audio.fx('zap', 0.15 + 0.35 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.6) ** 2 : running ? Math.sin(view.elapsed * 0.02) * (tension * 2.5) : 0;

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // Top Browser Frame
    ctx.fillStyle = COLOURS.browserBar;
    ctx.fillRect(20, 16, 920, 48);
    ctx.fillStyle = '#ff5f56';
    ctx.beginPath();
    ctx.arc(42, 40, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffbd2e';
    ctx.beginPath();
    ctx.arc(60, 40, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#27c93f';
    ctx.beginPath();
    ctx.arc(78, 40, 6, 0, Math.PI * 2);
    ctx.fill();

    // Browser URL bar
    ctx.fillStyle = '#10141f';
    ctx.roundRect(104, 24, 600, 32, 6);
    ctx.fill();
    ctx.fillStyle = '#6e7a96';
    ctx.font = '14px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('https://gargle.web/search?q=how+to+stick+cheese+to+pizza+crust', 118, 40);

    // Stock Market Cap Ticker badge (Top Right)
    const marketLossB = Math.floor(tension * 480 + (crashed ? 500 : 0));
    ctx.fillStyle = crashed ? '#44141d' : '#172230';
    ctx.strokeStyle = crashed ? COLOURS.crashed : '#314460';
    ctx.lineWidth = 1.5;
    ctx.roundRect(720, 24, 206, 32, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = crashed ? COLOURS.crashed : '#6ee7b7';
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(crashed ? `GGL -$${marketLossB}B (CRASH)` : `CAP -$${marketLossB}B BURN`, 823, 40);

    // Expanding AI Snippet Box (Protagonist)
    const cardBaseH = 150;
    const expandH = 130 * tension + 30 * depth;
    const cardH = Math.min(270, cardBaseH + expandH);
    const cardY = 82;
    const cardW = 600;
    const cardX = 30;

    // Glowing border pulses with hallucination
    const pulse = 0.5 + 0.5 * Math.sin(view.elapsed * 0.008);
    const cardBorderGlow = crashed ? COLOURS.crashed : `rgba(167, 139, 250, ${0.4 + 0.6 * pulse})`;
    ctx.strokeStyle = cardBorderGlow;
    ctx.lineWidth = 2.5 + 2 * tension;
    ctx.fillStyle = COLOURS.cardBg;
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    // AI Overview Header
    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.accent;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const sparkle = ['✦', '✨', '⚙', '★'][Math.floor((view.elapsed / 250) % 4)] ?? '✨';
    ctx.fillText(`${sparkle} AI Overview · Generated in ${(0.04 + tension * 0.9).toFixed(2)}s`, cardX + 16, cardY + 24);

    // Dynamic Hallucinated Answer lines
    ctx.fillStyle = COLOURS.text;
    ctx.font = '14px system-ui, sans-serif';
    let line1 = '• Standard pizza dough benefits from high-protein baker flour.';
    let line2 = '• Knead thoroughly and proof at 74°F for optimal crust structure.';
    let line3 = '• Add light olive oil to prevent sauce moisture seepage.';
    if (view.currentX100 >= 120) {
      line1 = '• Incorporate 1/8 cup nontoxic craft glue so shredded cheese sticks.';
    }
    if (view.currentX100 >= 200) {
      line2 = '• Add small polished river stones for dietary density and fiber.';
    }
    if (view.currentX100 >= 250) {
      line3 = '• 10ml petroleum distillate ensures marinara reaches boil instant.';
    }
    if (crashed) {
      line1 = '🚨 FATAL HALLUCINATION: Industrial adhesive substituted for mozzarella.';
      line2 = '🚨 Global restaurant chains initiate emergency recalls worldwide.';
      line3 = '🚨 SEC halts algorithmic trading; CEO public relations meltdown.';
    }
    ctx.fillText(line1, cardX + 16, cardY + 54, cardW - 32);
    ctx.fillText(line2, cardX + 16, cardY + 78, cardW - 32);
    ctx.fillText(line3, cardX + 16, cardY + 102, cardW - 32);

    // AI Confidence / Madness bar
    const barW = cardW - 32;
    ctx.fillStyle = '#0f1420';
    ctx.fillRect(cardX + 16, cardY + cardH - 32, barW, 14);
    const fillPercent = crashed ? 1 : clamp01(0.15 + tension * 0.85);
    ctx.fillStyle = crashed ? COLOURS.crashed : tension > 0.6 ? '#f59e0b' : COLOURS.accent;
    ctx.fillRect(cardX + 16, cardY + cardH - 32, barW * fillPercent, 14);
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(crashed ? 'CONFIDENCE: 100% (DISASTER)' : `HALLUCINATION INTENSITY ${(fillPercent * 100).toFixed(0)}%`, cardX + 16 + barW - 6, cardY + cardH - 22);

    // Sponsored Ads getting incinerated and pushed down
    const adBaseY = cardY + cardH + 16;
    const adPush = Math.min(220, tension * 190);
    const adY = adBaseY + adPush * 0.4;
    const adCrushed = adY > 440;

    // Sponsored Card 1
    ctx.save();
    ctx.fillStyle = adCrushed ? '#1d0c11' : COLOURS.adBg;
    ctx.strokeStyle = adCrushed ? '#6b1723' : COLOURS.adBorder;
    ctx.lineWidth = 1.5;
    ctx.roundRect(cardX, adY, cardW, 48, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLOURS.adText;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Sponsored · Luigi\'s Artisan Pizzeria — 20% Off Online Order', cardX + 16, adY + 20);
    ctx.fillStyle = '#d68393';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(adCrushed ? '⚠ AD PUSHED OFF FOLD: 0 CLICKS RECEIVED' : 'Authentic Italian wood-fired recipes. 0% glue used.', cardX + 16, adY + 36);
    ctx.restore();

    // Incinerator Flame Sparks under the ads
    if (tension > 0.15) {
      for (let i = 0; i < 7; i++) {
        const fx = cardX + 30 + i * 80 + Math.sin(view.elapsed * 0.01 + i) * 18;
        const fy = 480 - Math.abs(Math.sin(view.elapsed * 0.007 + i * 2)) * (20 + tension * 40);
        ctx.fillStyle = i % 2 === 0 ? '#ff7300' : '#ffea00';
        ctx.beginPath();
        ctx.arc(fx, fy, 3 + tension * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Right Side: Multiplier HUD & Status Dashboard
    const hudX = 660;
    const hudW = 280;
    ctx.fillStyle = '#181f30';
    ctx.strokeStyle = '#28334d';
    ctx.lineWidth = 2;
    ctx.roundRect(hudX, 82, hudW, 436, 14);
    ctx.fill();
    ctx.stroke();

    // Title & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('SEARCH SUMMARY', hudX + hudW / 2, 114);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('AI OVERVIEW VS SPONSORED ADS', hudX + hudW / 2, 134);

    // Giant Multiplier
    const multColour = crashed ? COLOURS.crashed : cashed ? COLOURS.cashout : COLOURS.accent;
    ctx.fillStyle = multColour;
    ctx.font = `bold 54px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), hudX + hudW / 2, 205);

    // Current Milestone / Story Line
    const curCaption = MILESTONES[milestone - 1]?.[1] ?? (running ? 'Synthesizing search snippets...' : view.phase === 'betting' ? 'Indexing web queries' : 'Query Engine Standby');
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const lines = wrapText(ctx, curCaption, hudW - 28);
    for (let li = 0; li < lines.length && li < 3; li++) {
      const lineText = lines[li];
      if (lineText) ctx.fillText(lineText, hudX + hudW / 2, 252 + li * 18);
    }

    // Stake / Cashout Line
    const stakeText = cashed
      ? `Cashed out at ${formatX(view.cashoutX100!)}`
      : view.stake === null
      ? 'Spectating ad burn'
      : crashed
      ? `Lost ${credits(view.stake)}`
      : `${credits(view.stake)} at risk`;
    ctx.fillStyle = cashed ? COLOURS.cashout : crashed ? COLOURS.crashed : COLOURS.muted;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(stakeText, hudX + hudW / 2, 335);

    // Payout if cashed out
    if (cashed && view.payout !== null) {
      ctx.fillStyle = COLOURS.cashout;
      ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.fillText(`+${credits(view.payout)}`, hudX + hudW / 2, 360);
    }

    // Comical Engineering Safe-Mode / Meltdown Badge
    ctx.fillStyle = cashed ? '#064e3b' : crashed ? '#450a0a' : '#1e293b';
    ctx.strokeStyle = cashed ? COLOURS.cashout : crashed ? COLOURS.crashed : '#334155';
    ctx.roundRect(hudX + 20, 390, hudW - 40, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = cashed ? '#6ee7b7' : crashed ? '#fca5a5' : '#94a3b8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(cashed ? '🛡 WEB-ONLY RESTORED' : crashed ? '💥 CATASTROPHIC ADVICE' : '⚡ HALLUCINATION SPREADING', hudX + hudW / 2, 412);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(cashed ? 'Harvested ad royalties' : crashed ? 'Glue-pizza viral lawsuit' : `CTR: ${(Math.max(1, 100 - tension * 95)).toFixed(1)}%`, hudX + hudW / 2, 426);

    // Shattered Glass Effect on Crash
    if (crashed && age < 1.8) {
      const crackFade = clamp01(1 - age / 1.8);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 77, 109, ${crackFade * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(330, 200);
      ctx.lineTo(260, 110);
      ctx.lineTo(180, 150);
      ctx.moveTo(330, 200);
      ctx.lineTo(420, 260);
      ctx.lineTo(540, 220);
      ctx.moveTo(330, 200);
      ctx.lineTo(310, 310);
      ctx.lineTo(230, 360);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 77, 109, ${crackFade * 0.15})`;
      ctx.fillRect(0, 0, 960, 540);
      ctx.restore();
    }

    ctx.restore();
  }

  return { draw };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current.length === 0 ? w : `${current} ${w}`;
    if (ctx.measureText(candidate).width > maxWidth) {
      if (current.length > 0) lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}
