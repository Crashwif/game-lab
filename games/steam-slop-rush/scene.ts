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
  steamBg: '#10141c',
  steamDark: '#171d25',
  steamPanel: '#1e2837',
  steamBlue: '#66c0f4',
  steamAccent: '#2a475e',
  text: '#e6edf5',
  muted: '#8f98a0',
  slopGreen: '#5cfc87',
  aiPurple: '#b366f4',
  dangerRed: '#ff4c60',
  gold: '#ffc83b',
  energyCan: '#00ffc4',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Queueing next asset dump...',
  betting: 'Place stake & prepare AI prompt batch',
  running: 'FLOODING STEAM STOREFRONT...',
  crashed: 'DELISTED BY STEAM MODERATION',
};

const MILESTONES: [number, string][] = [
  [120, 'AI generates a six-fingered rogue warrior'],
  [150, 'Store page filled with copy-pasted ChatGPT lore'],
  [200, 'Voice lines sound like depressed robotic tin cans'],
  [250, 'Disclosing AI tags with microscopically tiny text'],
  [300, 'Gaben review queue fills with infinite clones'],
  [500, 'Textures hallucinate spaghetti onto weapons'],
  [1000, 'Wishlists surge from confused discount hunters'],
  [10000, 'Asset bundle hits front page of Steam Summer Sale'],
  [100000, 'Server room cooks from compiling endless prompts'],
  [1000000, 'Game passes greenlight with zero written code'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`Published Early Access @ ${formatX(view.cashoutX100)} · Escaped on skateboard!`, COLOURS.slopGreen];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Watched the ban hammer drop · 0 credits lost' : 'Lurking Steam forums · no credits staked', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Gaben delisted your ${credits(view.stake)} into the void`, COLOURS.dangerRed];
  }
  return [`Generating slop with ${credits(view.stake)} on the line`, COLOURS.steamBlue];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastKeyTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.85);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('zap', 0.5 + 0.4 * tension);
      }
      const tickCadence = Math.max(60, 220 - tension * 160);
      if (view.cashoutX100 === null && now - lastKeyTick > tickCadence) {
        lastKeyTick = now;
        audio.fx('click', 0.25 + 0.35 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : running ? Math.sin(now * 0.04) * (1 + 3 * tension) : 0;
    const hammerDrop = crashed ? clamp01(crashAgeSec / 0.18) : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.1), shake * Math.cos(now * 0.12));

    // 1. Background Store / Server room gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 960, 540);
    bgGrad.addColorStop(0, COLOURS.steamBg);
    bgGrad.addColorStop(0.5, COLOURS.steamDark);
    bgGrad.addColorStop(1, '#0c1017');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Steam grid scanlines
    ctx.fillStyle = 'rgba(102, 192, 244, 0.03)';
    for (let gy = 0; gy < 540; gy += 18) {
      ctx.fillRect(0, gy, 960, 1);
    }

    // 2. Conveyor Belt on Top/Mid delivering hallucinated Steam Store Cards
    const beltY = 220;
    ctx.fillStyle = COLOURS.steamPanel;
    ctx.fillRect(20, beltY, 920, 16);
    ctx.fillStyle = '#111822';
    ctx.fillRect(20, beltY + 16, 920, 8);
    // Conveyor rollers
    const beltSpeed = running ? (view.elapsed * (0.15 + tension * 0.4)) % 30 : 0;
    ctx.strokeStyle = '#324559';
    ctx.lineWidth = 3;
    for (let rx = 30; rx < 930; rx += 30) {
      const pos = ((rx + beltSpeed) % 900) + 30;
      ctx.beginPath();
      ctx.moveTo(pos, beltY);
      ctx.lineTo(pos, beltY + 16);
      ctx.stroke();
    }

    // Floating asset cards riding the conveyor
    const cardLabels = ['7-FINGER MAGE', 'SPAGHETTI BLADE', 'CHATGPT LORE', '6-LEG GOBLIN', 'ROBOT CAN VO', 'EARLY ACCESS AI'];
    const cardCount = 5;
    for (let i = 0; i < cardCount; i++) {
      const cardOff = ((i * 200 + (running ? view.elapsed * (0.2 + tension * 0.3) : i * 200)) % 960) - 40;
      const cardBob = Math.sin((view.elapsed * 0.005) + i) * 4;
      ctx.save();
      ctx.translate(cardOff, beltY - 65 + cardBob);
      ctx.fillStyle = '#1b2838';
      ctx.strokeStyle = i % 2 === 0 ? COLOURS.slopGreen : COLOURS.aiPurple;
      ctx.lineWidth = 2;
      ctx.fillRect(0, 0, 120, 60);
      ctx.strokeRect(0, 0, 120, 60);

      // Card thumbnail (cursed goblin / seven fingers)
      ctx.fillStyle = '#223447';
      ctx.fillRect(6, 6, 40, 48);
      ctx.fillStyle = i % 2 === 0 ? '#4eff78' : '#f980ff';
      ctx.beginPath();
      ctx.arc(26, 26, 12, 0, Math.PI * 2);
      ctx.fill();
      // Extra cursed fingers / tentacles
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      for (let f = 0; f < 7; f++) {
        const fa = (f / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(26, 26);
        ctx.lineTo(26 + Math.cos(fa) * 16, 26 + Math.sin(fa) * 16);
        ctx.stroke();
      }

      // Title on card
      ctx.fillStyle = COLOURS.text;
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(cardLabels[i % cardLabels.length] ?? 'SLOP', 52, 20);
      ctx.fillStyle = COLOURS.gold;
      ctx.fillText('$19.99', 52, 34);
      ctx.fillStyle = COLOURS.slopGreen;
      ctx.font = '600 8px monospace';
      ctx.fillText('99% POSITIVE*', 52, 46);
      ctx.restore();
    }

    // 3. Protagonist Indie Dev Desk (Left/Center bottom)
    const devX = 260;
    const devY = 380;
    const typingJitter = running ? Math.sin(view.elapsed * 0.06) * (2 + 6 * tension) : 0;
    const cashedOut = view.cashoutX100 !== null;

    if (!cashedOut) {
      // Glow from monitor
      const screenGlow = ctx.createRadialGradient(devX + 90, devY - 20, 10, devX + 90, devY - 20, 140);
      screenGlow.addColorStop(0, running ? 'rgba(92, 252, 135, 0.4)' : 'rgba(102, 192, 244, 0.2)');
      screenGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = screenGlow;
      ctx.fillRect(devX - 30, devY - 120, 260, 200);

      // Computer Monitor
      ctx.fillStyle = '#0a0d13';
      ctx.fillRect(devX + 60, devY - 70, 90, 60);
      ctx.fillStyle = running ? (Math.random() > 0.1 ? '#003314' : '#002244') : '#13202e';
      ctx.fillRect(devX + 64, devY - 66, 82, 52);
      ctx.fillStyle = COLOURS.slopGreen;
      ctx.font = '8px monospace';
      ctx.fillText(running ? '> PROMPT 8K..' : '> IDLE...', devX + 68, devY - 50);
      ctx.fillText(running ? `SLOP x${Math.floor(view.currentX100)}` : 'READY', devX + 68, devY - 34);

      // Stand & Keyboard
      ctx.fillStyle = '#313d4d';
      ctx.fillRect(devX + 98, devY - 10, 14, 20);
      ctx.fillRect(devX + 50, devY + 8, 80, 10);

      // Indie Dev Body & Head
      ctx.fillStyle = '#3a506b'; // Hoodie
      ctx.beginPath();
      ctx.roundRect(devX - 25, devY - 30, 48, 55, [12, 12, 4, 4]);
      ctx.fill();

      // Tired head
      ctx.fillStyle = '#f7c59f';
      ctx.beginPath();
      ctx.arc(devX - 2, devY - 50, 18, 0, Math.PI * 2);
      ctx.fill();

      // Messy dev hair
      ctx.fillStyle = '#2c1810';
      ctx.beginPath();
      ctx.arc(devX - 2, devY - 60, 16, Math.PI, Math.PI * 2);
      ctx.fill();

      // Dark bags under eyes
      ctx.fillStyle = '#9e7373';
      ctx.fillRect(devX + 4, devY - 48, 7, 3);
      ctx.fillStyle = '#111';
      ctx.fillRect(devX + 6, devY - 52, 4, 3);

      // Typing Arms frantically moving
      ctx.strokeStyle = '#3a506b';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(devX + 10, devY - 20);
      ctx.lineTo(devX + 45, devY + typingJitter);
      ctx.lineTo(devX + 65, devY + 12 - typingJitter);
      ctx.stroke();

      // Energy drink cans mountain
      for (let c = 0; c < 5; c++) {
        ctx.fillStyle = COLOURS.energyCan;
        ctx.fillRect(devX - 60 + c * 10, devY + 6 - (c > 2 ? 14 : 0), 8, 14);
        ctx.fillStyle = '#111';
        ctx.fillRect(devX - 60 + c * 10, devY + 6 - (c > 2 ? 14 : 0), 8, 3);
      }
    } else {
      // CASHOUT ESCAPE: Dev flees right on a skateboard with dollar bags!
      const escapeX = devX + (view.elapsed * 0.3) % 550;
      ctx.save();
      ctx.translate(escapeX, devY);

      // Skateboard
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(-20, 20, 70, 8);
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(-10, 31, 6, 0, Math.PI * 2);
      ctx.arc(40, 31, 6, 0, Math.PI * 2);
      ctx.fill();

      // Dev riding pose
      ctx.fillStyle = '#3a506b';
      ctx.beginPath();
      ctx.roundRect(0, -35, 36, 45, [8, 8, 2, 2]);
      ctx.fill();
      ctx.fillStyle = '#f7c59f';
      ctx.beginPath();
      ctx.arc(18, -48, 16, 0, Math.PI * 2);
      ctx.fill();

      // Cool sunglasses
      ctx.fillStyle = '#111';
      ctx.fillRect(16, -52, 14, 6);

      // Dollar sack over shoulder
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(-10, -25, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a5e20';
      ctx.font = '700 16px sans-serif';
      ctx.fillText('$', -15, -20);

      // Flying cash particles
      for (let b = 0; b < 6; b++) {
        ctx.fillStyle = COLOURS.slopGreen;
        const bX = -30 - b * 15 + Math.sin(now * 0.01 + b) * 8;
        const bY = -20 + Math.cos(now * 0.02 + b) * 20;
        ctx.fillRect(bX, bY, 14, 7);
      }
      ctx.restore();
    }

    // 4. Wishlist & Prompt Escalation Gauge on Right
    const gaugeX = 720;
    const gaugeY = 320;
    ctx.fillStyle = COLOURS.steamPanel;
    ctx.strokeStyle = COLOURS.steamAccent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(gaugeX, gaugeY, 200, 110, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STEAM METRICS', gaugeX + 16, gaugeY + 24);

    const wishlists = Math.floor(120 + view.currentX100 * 18.5);
    ctx.fillStyle = COLOURS.gold;
    ctx.font = '700 18px monospace';
    ctx.fillText(`★ ${wishlists.toLocaleString()} WISHLISTS`, gaugeX + 16, gaugeY + 52);

    // AI Generation heat bar
    ctx.fillStyle = '#101721';
    ctx.fillRect(gaugeX + 16, gaugeY + 68, 168, 12);
    const heatGrad = ctx.createLinearGradient(gaugeX + 16, 0, gaugeX + 184, 0);
    heatGrad.addColorStop(0, COLOURS.slopGreen);
    heatGrad.addColorStop(0.6, COLOURS.gold);
    heatGrad.addColorStop(1, COLOURS.dangerRed);
    ctx.fillStyle = heatGrad;
    ctx.fillRect(gaugeX + 16, gaugeY + 68, 168 * tension, 12);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '10px monospace';
    ctx.fillText(`SLOP HEAT: ${Math.round(tension * 100)}%`, gaugeX + 16, gaugeY + 98);
    ctx.fillText(depth > 0.5 ? 'GABEN SCANNING...' : 'MODS ASLEEP', gaugeX + 100, gaugeY + 98);

    // 5. CRASH ANIMATION: GIANT BAN HAMMER SLAMS DOWN
    if (crashed) {
      const hammerY = -120 + hammerDrop * 380;
      ctx.save();
      ctx.translate(480, hammerY);

      // Glow behind hammer
      const banGlow = ctx.createRadialGradient(0, 0, 20, 0, 0, 160);
      banGlow.addColorStop(0, 'rgba(255, 76, 96, 0.7)');
      banGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = banGlow;
      ctx.fillRect(-180, -180, 360, 360);

      // Hammer handle
      ctx.fillStyle = '#654321';
      ctx.fillRect(-12, -180, 24, 180);
      ctx.fillStyle = '#442b14';
      ctx.fillRect(-14, -180, 6, 180);

      // Huge Hammer Head
      ctx.fillStyle = '#cc1122';
      ctx.fillRect(-90, -40, 180, 70);
      ctx.fillStyle = '#ff4455';
      ctx.fillRect(-85, -35, 170, 15);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BAN HAMMER', 0, 5);

      // Impact shockwaves
      if (hammerDrop >= 1) {
        ctx.strokeStyle = COLOURS.dangerRed;
        ctx.lineWidth = 6 * (1 - clamp01(crashAgeSec - 0.2));
        ctx.beginPath();
        ctx.ellipse(0, 40, 220 * clamp01(crashAgeSec * 3), 40 * clamp01(crashAgeSec * 3), 0, 0, Math.PI * 2);
        ctx.stroke();

        // 404 NOT FOUND OVERLAY
        ctx.fillStyle = 'rgba(20, 10, 15, 0.75)';
        ctx.fillRect(-480, -200, 960, 340);
        ctx.fillStyle = COLOURS.dangerRed;
        ctx.font = '900 48px monospace';
        ctx.fillText('DELISTED: 404', 0, -40);
        ctx.fillStyle = '#fff';
        ctx.font = '600 18px monospace';
        ctx.fillText('VALVE REJECTED ZERO-EFFORT AI SLOP', 0, 0);
      }
      ctx.restore();
    }

    // 6. HUD Headers & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top Game Title Badge
    ctx.fillStyle = '#0f1722';
    ctx.strokeStyle = COLOURS.steamAccent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(280, 14, 400, 56, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('STEAM SLOP RUSH', 480, 32);
    ctx.fillStyle = COLOURS.steamBlue;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('FLOOD THE STOREFRONT BEFORE GABEN DELISTS YOU', 480, 52);

    // Multiplier Callout
    const numColor = crashed ? COLOURS.dangerRed : cashedOut ? COLOURS.slopGreen : COLOURS.steamBlue;
    const pulse = running ? 1 + 0.05 * Math.sin(now * 0.015) : 1;
    ctx.fillStyle = numColor;
    ctx.font = `800 ${Math.floor(72 * pulse)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 126);

    // Milestone / Status banner
    const currentMilestoneText = running && milestoneIndex > 0
      ? (MILESTONES[milestoneIndex - 1]?.[1] ?? PHASE_LABELS[view.phase])
      : PHASE_LABELS[view.phase];

    ctx.fillStyle = crashed ? COLOURS.dangerRed : cashedOut ? COLOURS.slopGreen : COLOURS.gold;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(currentMilestoneText, 480, 175, 860);

    // Stake line footer
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 498, 880);

    ctx.restore();
  }

  return { draw };
}
