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
  felt: '#0a4f29',
  feltDark: '#052a16',
  rail: '#61340b',
  railTrim: '#b37d2e',
  accent: '#ffd13b',
  text: '#ffffff',
  muted: '#a8c7b2',
  crashed: '#ff3e5e',
  cashedOut: '#30f299',
  sunglasses: '#00f7ff',
  suit: '#1e1c24',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Dealer winces as player taps the felt to split'],
  [150, 'Pit boss raises eyebrow and checks surveillance eye'],
  [200, 'Floor manager power-walks over with a clipboard'],
  [250, 'Dealer draws another ten on the first split hand'],
  [300, 'Surveillance room zooms high-res lens on table'],
  [500, 'Two giant tuxedo bouncers flank the player chair'],
  [1000, 'Entire casino crowd circles the showdown table'],
  [10000, 'Dealer hits a stiff 16 while dealer hands shake'],
  [100000, 'Casino GM arrives in golf cart to halt the shoe'],
  [1000000, 'Legendary double-down split breaks house bank vault'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Scooped double aces at ${formatX(view.cashoutX100)} · Escaped to valet!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Security obliterated the felt · no credits lost' : 'Watching the degenerate split tens · 0 credits', COLOURS.muted];
  }
  if (crashed) return [`Tackled by security! Your ${credits(view.stake)} got buried in felt`, COLOURS.crashed];
  return [`Splitting ${credits(view.stake)} against dealer five!`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'casino', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;

  function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, rank: string, suit: string, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-36, -52, 72, 104, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d6d6d6';
    ctx.stroke();

    const isRed = suit === '♥' || suit === '♦';
    ctx.fillStyle = isRed ? '#d31b26' : '#1c1c1c';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(rank, -28, -26);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(suit, -28, -4);
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText(suit, 6, 22);
    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
      audio.fx('whoosh', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('stomp', 1.0);
    }
    if (running && previousPhase === 'running' && milestoneIdx > previousMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('camera', 0.5 + 0.5 * tension);
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashAgeSec / 0.5) ** 2 : (running ? Math.sin(now * 0.02) * tension * 3 : 0);

    ctx.save();
    ctx.fillStyle = '#07100b';
    ctx.fillRect(0, 0, 960, 540);
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.09));

    // Casino Carpet & Table Felt
    const feltGrad = ctx.createRadialGradient(480, 420, 80, 480, 360, 480);
    feltGrad.addColorStop(0, '#106c39');
    feltGrad.addColorStop(0.7, COLOURS.felt);
    feltGrad.addColorStop(1, COLOURS.feltDark);

    ctx.beginPath();
    ctx.arc(480, 560, 470, Math.PI, 0, false);
    ctx.lineTo(950, 540);
    ctx.lineTo(10, 540);
    ctx.closePath();
    ctx.fillStyle = feltGrad;
    ctx.fill();

    // Table Rail Wood
    ctx.lineWidth = 22;
    ctx.strokeStyle = COLOURS.rail;
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLOURS.railTrim;
    ctx.stroke();

    // Table Text Felt Stamping
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 235, 170, 0.22)';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('BLACKJACK PAYS 3 TO 2 · DEALER MUST STAND ON 17', 480, 240);
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('THE CARDINAL SIN: SPLITTING 20 AGAINST 5', 480, 268);
    ctx.restore();

    // Surveillance camera laser reticle
    const eyeBlink = Math.sin(now * 0.008) > 0;
    ctx.fillStyle = eyeBlink ? '#ff1e1e' : '#660000';
    ctx.beginPath();
    ctx.arc(880, 46, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px monospace';
    ctx.fillText('SURVEILLANCE CAM #04 · LIVE', 860, 24);

    if (running && tension > 0.2) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 30, 30, ${0.15 + tension * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(880, 46);
      ctx.lineTo(480, 350);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Dealer (sweating in vest and visor)
    const dealerTremble = running ? Math.sin(now * 0.035) * tension * 4 : 0;
    const dealerX = 480 + dealerTremble;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(dealerX, 110, 32, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dealer Visor & Bowtie
    ctx.fillStyle = '#10522c';
    ctx.beginPath();
    ctx.arc(dealerX, 98, 36, Math.PI, 0, false);
    ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.moveTo(dealerX - 10, 134);
    ctx.lineTo(dealerX + 10, 142);
    ctx.lineTo(dealerX + 10, 134);
    ctx.lineTo(dealerX - 10, 142);
    ctx.fill();
    // Dealer Sweat Drops
    if (tension > 0.25 && running) {
      ctx.fillStyle = '#72d7ff';
      const dropY = 110 + ((now * 0.1) % 25);
      ctx.beginPath();
      ctx.arc(dealerX + 28, dropY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dealer's Card: 5 of Spades
    drawCard(ctx, dealerX, 162, 0.05, '5', '♠', 0.72);

    // Pit Boss lurking on the right
    const pitBossSlide = Math.min(60, tension * 70);
    const pitX = 840 - pitBossSlide;
    ctx.fillStyle = COLOURS.suit;
    ctx.beginPath();
    ctx.roundRect(pitX - 35, 140, 70, 110, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd2a6';
    ctx.beginPath();
    ctx.arc(pitX, 120, 24, 0, Math.PI * 2);
    ctx.fill();
    // Earpiece cord
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pitX + 18, 120);
    ctx.quadraticCurveTo(pitX + 24, 150, pitX + 10, 170);
    ctx.stroke();

    // Bouncers on left/right flank when tension is high
    if (tension > 0.45) {
      const bAlpha = clamp01((tension - 0.45) / 0.3);
      ctx.fillStyle = `rgba(18, 18, 22, ${bAlpha})`;
      ctx.beginPath();
      ctx.roundRect(40, 160, 90, 180, 18);
      ctx.roundRect(830, 220, 90, 180, 18);
      ctx.fill();
    }

    // THE PROTAGONIST & SPLITTING 10 CARDS
    const splitSpacing = 42 + tension * 135 + depth * 35;
    const cardY = 350 + Math.sin(now * 0.005) * 4;

    if (!crashed) {
      // Degenerate fingers sliding the cards apart
      ctx.fillStyle = '#f7c399';
      // Left hand
      ctx.beginPath();
      ctx.ellipse(480 - splitSpacing - 12, cardY + 44, 22, 14, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Right hand
      ctx.beginPath();
      ctx.ellipse(480 + splitSpacing + 12, cardY + 44, 22, 14, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Card 1: 10 of Hearts ♥
      drawCard(ctx, 480 - splitSpacing, cardY, -0.06 - tension * 0.12, '10', '♥');
      // Card 2: 10 of Diamonds ♦
      drawCard(ctx, 480 + splitSpacing, cardY, 0.06 + tension * 0.12, '10', '♦');

      // The Degenerate's head & Neon Sunglasses at bottom edge
      ctx.save();
      const degenY = 485;
      ctx.fillStyle = '#ffcca3';
      ctx.beginPath();
      ctx.arc(480, degenY, 68, 0, Math.PI * 2);
      ctx.fill();

      // Wild grin
      ctx.strokeStyle = '#2b1408';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(480, degenY + 12, 28, 0.15, Math.PI - 0.15);
      ctx.stroke();

      // Neon Sunglasses
      ctx.shadowColor = COLOURS.sunglasses;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#0ff';
      ctx.fillRect(432, degenY - 14, 38, 22);
      ctx.fillRect(490, degenY - 14, 38, 22);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(432, degenY - 14, 38, 22);
      ctx.strokeRect(490, degenY - 14, 38, 22);
      ctx.beginPath();
      ctx.moveTo(470, degenY - 4);
      ctx.lineTo(490, degenY - 4);
      ctx.stroke();
      ctx.restore();
    } else {
      // CRASH EFFECT: 3 Bouncers belly-flop onto table & cards spraying!
      const flop = clamp01(crashAgeSec / 0.15);
      const bouncerScale = 0.8 + flop * 0.5;

      // Cards flying out
      for (let i = 0; i < 8; i++) {
        const spreadAng = (i / 8) * Math.PI * 2;
        const dist = 60 + crashAgeSec * 380;
        const px = 480 + Math.cos(spreadAng) * dist;
        const py = 330 + Math.sin(spreadAng) * dist * 0.65;
        drawCard(ctx, px, py, spreadAng + crashAgeSec * 3, i % 2 === 0 ? '10' : 'A', i % 2 === 0 ? '♦' : '♥', 0.6);
      }

      // Giant Bouncers tackling
      ctx.save();
      ctx.translate(480, 340);
      ctx.scale(bouncerScale, bouncerScale);
      ctx.fillStyle = '#111116';
      ctx.beginPath();
      ctx.ellipse(-70, 0, 95, 60, -0.3, 0, Math.PI * 2);
      ctx.ellipse(70, 0, 95, 60, 0.3, 0, Math.PI * 2);
      ctx.ellipse(0, -20, 110, 70, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SECURITY', 0, -20);
      ctx.restore();

      // Torn felt particles
      ctx.fillStyle = 'rgba(255, 62, 94, 0.6)';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TABLE SHUTDOWN!', 480, 205);
    }

    // Cashed out celebration overlay
    if (cashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 40, 20, 0.72)';
      ctx.fillRect(0, 0, 960, 100);
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText('🎩 VALET GETAWAY! CHIPS SWEPT INTO FEDORA WITH DOUBLE ACES! 🏎️', 480, 58);
      ctx.restore();
    }

    // HUD & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.accent;
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText('SPLIT TENS PANIC', 480, 36);

    // Massive Multiplier
    const multColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.accent);
    ctx.fillStyle = multColor;
    const punch = crashed ? (1 - clamp01((crashAgeSec - 0.1) / 0.3)) * 0.28 : 0;
    ctx.font = `900 ${76 * (1 + punch)}px ui-monospace, monospace`;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 14;
    ctx.fillText(formatX(view.currentX100), 480, 112);
    ctx.shadowBlur = 0;

    // Milestone ticker / Status
    const passedMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const bannerText = crashed
      ? 'BOUNCER TAKEDOWN! FELT SHREDDED INTO CONFETTI!'
      : (running ? (passedMilestone?.[1] ?? 'Tapping felt... insists on splitting the 20') : 'Place your stake before the shoe cuts');

    ctx.fillStyle = COLOURS.text;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 440);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(line, 480, 508);

    ctx.restore();
  }

  return { draw };
}
