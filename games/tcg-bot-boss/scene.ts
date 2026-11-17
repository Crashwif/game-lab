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
  bgTop: '#070514', bgBottom: '#120b24',
  felt: '#0a1a24', feltBorder: '#00f0ff',
  cardBack: '#1d1238', cardBorder: '#00ffff',
  botChrome: '#4b5768', botHighlight: '#94a3b8',
  neonPurple: '#bf00ff', neonCyan: '#00f3ff', neonGold: '#ffd700',
  crashed: '#ff3366', cashedOut: '#38ef7d', muted: '#8f9bb3', text: '#ffffff',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Bot draws two glowing starter foils'],
  [150, 'Bot shuffles at supersonic speed'],
  [200, 'Neural network activates overclock mode'],
  [250, 'Infinite mana combo begins executing'],
  [300, 'Holographic cards swirl around arena'],
  [500, '97% win rate aura ignites purple flames'],
  [1000, 'Bot rewrites game rules in real time'],
  [10000, 'Arena turns into digital wireframe storm'],
  [100000, 'Every card in deck becomes legendary god card'],
  [1000000, 'Bot achieves godhood and bans all human players'],
];

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'DECK SHUFFLE · PLACE YOUR CREDITS',
  betting: 'NEURAL BOT INITIALIZED · DRAW YOUR HAND',
  running: 'OPPONENT TURN IN PROGRESS',
  crashed: '99-CARD EXODIA COMBO WIPED THE BOARD',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.3 * pop * pop)}px "Courier New", monospace, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Snatched Foil Deck at ${formatX(view.cashoutX100)} · Escaped Neon Portal!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Deck obliterated · Watching without stakes' : 'Observing AI strategy · No credits committed', COLOURS.muted];
  }
  if (crashed) return [`AI destroyed your hand · ${credits(view.stake)} incinerated`, COLOURS.crashed];
  return [`Hand live · ${credits(view.stake)} riding against 97% Win AI`, COLOURS.neonCyan];
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let cardTickTimer = 0;

  const particles: Particle[] = [];

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('zap', 0.6 + 0.3 * tension);
      }
      cardTickTimer += 16.6;
      const tickInterval = Math.max(120, 480 - tension * 360);
      if (cardTickTimer >= tickInterval) {
        cardTickTimer = 0;
        if (view.cashoutX100 === null) audio.fx('whoosh', 0.2 + 0.4 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : (running ? Math.sin(now * 0.02) * tension * 1.5 : 0);
    const punch = crashed ? (1 - clamp01((crashAgeSec - 0.1) / 0.3)) ** 2 : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.06) : 0);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. Arena Background with Wireframe Grid
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Dynamic grid floor (cyberspace arena)
    ctx.save();
    ctx.strokeStyle = crashed ? 'rgba(255, 51, 102, 0.2)' : `rgba(0, 243, 255, ${0.12 + 0.2 * tension})`;
    ctx.lineWidth = 1;
    const gridOffset = (now * (0.04 + tension * 0.08)) % 40;
    for (let x = 0; x <= 960; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (x - 480) * 0.4, 540);
      ctx.stroke();
    }
    for (let y = 180; y <= 540; y += 30) {
      const py = y + gridOffset * ((y - 180) / 360);
      if (py <= 540) {
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(960, py);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 2. Holographic Card Table Felt
    const feltY = 320;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(100, 540);
    ctx.lineTo(240, feltY);
    ctx.lineTo(720, feltY);
    ctx.lineTo(860, 540);
    ctx.closePath();
    ctx.fillStyle = crashed ? '#240a12' : COLOURS.felt;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = crashed ? COLOURS.crashed : (tension > 0.6 ? COLOURS.neonPurple : COLOURS.neonCyan);
    ctx.stroke();

    // Table Zones (Card slots)
    const zones = [300, 420, 540, 660];
    zones.forEach((zx, idx) => {
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.25 + 0.15 * Math.sin(now * 0.004 + idx)})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(zx - 40, feltY + 30, 80, 110);
    });
    ctx.restore();

    // 3. Boss: Chrome Neural AI Entity
    const botX = 480;
    const botY = 175 + (running ? Math.sin(now * 0.003) * 6 : 0);
    const botAuraColor = crashed ? '#ff0055' : (tension > 0.5 ? COLOURS.neonPurple : COLOURS.neonCyan);

    // AI Overclock aura / purple flames
    if (tension > 0.3 && !crashed) {
      const auraRad = 85 + tension * 45 + Math.sin(now * 0.01) * 8;
      const auraGrad = ctx.createRadialGradient(botX, botY, 20, botX, botY, auraRad);
      auraGrad.addColorStop(0, 'rgba(191, 0, 255, 0.45)');
      auraGrad.addColorStop(0.7, 'rgba(0, 243, 255, 0.2)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(botX, botY, auraRad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cooling vents emitting particles
    if (running && Math.random() < 0.6 + tension * 0.4) {
      particles.push({
        x: botX + (Math.random() - 0.5) * 110,
        y: botY + 30,
        vx: (Math.random() - 0.5) * 3,
        vy: -1.5 - Math.random() * 2.5 * (1 + tension),
        life: 0,
        maxLife: 35 + Math.random() * 20,
        color: tension > 0.5 ? COLOURS.neonPurple : COLOURS.neonCyan,
        size: 2 + Math.random() * 4,
      });
    }

    // Render & update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      const alpha = 1 - p.life / p.maxLife;
      if (alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // AI Torso & Shoulders
    ctx.fillStyle = COLOURS.botChrome;
    ctx.beginPath();
    ctx.moveTo(botX - 85, botY + 80);
    ctx.lineTo(botX - 55, botY + 25);
    ctx.lineTo(botX + 55, botY + 25);
    ctx.lineTo(botX + 85, botY + 80);
    ctx.lineTo(botX + 50, botY + 115);
    ctx.lineTo(botX - 50, botY + 115);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = botAuraColor;
    ctx.stroke();

    // Neural Core in Chest
    const corePulsing = 0.5 + 0.5 * Math.sin(now * (0.005 + tension * 0.02));
    ctx.fillStyle = tension > 0.5 ? COLOURS.neonPurple : COLOURS.neonCyan;
    ctx.beginPath();
    ctx.arc(botX, botY + 65, 12 + 6 * corePulsing, 0, Math.PI * 2);
    ctx.fill();

    // AI Head (Angular Cybernetic Mask)
    ctx.fillStyle = '#232b36';
    ctx.beginPath();
    ctx.moveTo(botX, botY - 55);
    ctx.lineTo(botX + 42, botY - 32);
    ctx.lineTo(botX + 35, botY + 15);
    ctx.lineTo(botX, botY + 30);
    ctx.lineTo(botX - 35, botY + 15);
    ctx.lineTo(botX - 42, botY - 32);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLOURS.botHighlight;
    ctx.stroke();

    // Neural Horns / Antenna array
    ctx.strokeStyle = botAuraColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(botX - 35, botY - 25);
    ctx.lineTo(botX - 65, botY - 65);
    ctx.lineTo(botX - 55, botY - 80);
    ctx.moveTo(botX + 35, botY - 25);
    ctx.lineTo(botX + 65, botY - 65);
    ctx.lineTo(botX + 55, botY - 80);
    ctx.stroke();

    // AI Visor Eye
    ctx.fillStyle = crashed ? COLOURS.crashed : (tension > 0.6 ? COLOURS.neonPurple : COLOURS.neonCyan);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12 + 10 * tension;
    ctx.beginPath();
    const eyeWidth = 44 + tension * 12;
    ctx.roundRect(botX - eyeWidth / 2, botY - 18, eyeWidth, 10, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // AI Win-rate Badge
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(botX - 60, botY - 76, 120, 20, 10);
    ctx.fill();
    ctx.strokeStyle = COLOURS.neonGold;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = COLOURS.neonGold;
    ctx.font = '700 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WIN RATE: 97.4%', botX, botY - 62);

    // 4. Floating Holographic Cards Swirling
    const numCards = running ? Math.min(8, 2 + Math.floor(tension * 6)) : 2;
    for (let c = 0; c < numCards; c++) {
      const angle = (now * 0.0018 * (1 + tension * 1.5)) + (c * (Math.PI * 2 / numCards));
      const orbitX = botX + Math.cos(angle) * (140 + tension * 40);
      const orbitY = botY + 15 + Math.sin(angle) * (45 + tension * 15);

      ctx.save();
      ctx.translate(orbitX, orbitY);
      ctx.rotate(Math.sin(angle) * 0.3);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-18, -26, 36, 52);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = c % 2 === 0 ? COLOURS.neonCyan : COLOURS.neonPurple;
      ctx.strokeRect(-18, -26, 36, 52);

      // Card Holo Rune
      ctx.fillStyle = c % 2 === 0 ? COLOURS.neonCyan : COLOURS.neonGold;
      ctx.font = '800 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(c % 2 === 0 ? '♦' : '★', 0, 4);
      ctx.restore();
    }

    // 5. Player Hand / Foil Card (Bottom Center)
    const playerHandX = 480;
    const playerHandY = 475;
    const isEscaped = view.cashoutX100 !== null;

    if (!crashed && !isEscaped) {
      // Rare Foil Card on the felt
      ctx.save();
      ctx.translate(playerHandX, playerHandY);
      const foilGlow = ctx.createLinearGradient(-35, -50, 35, 50);
      foilGlow.addColorStop(0, '#ffd700');
      foilGlow.addColorStop(0.5, '#00ffff');
      foilGlow.addColorStop(1, '#ff007f');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-35, -50, 70, 95);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = foilGlow;
      ctx.strokeRect(-35, -50, 70, 95);

      ctx.fillStyle = COLOURS.neonGold;
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RARE FOIL', 0, -28);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 18px monospace';
      ctx.fillText('99', 0, 2);
      ctx.font = '600 8px monospace';
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.fillText('NEURAL BREAKER', 0, 26);
      ctx.restore();
    } else if (isEscaped) {
      // Neon Holo-Portal Escape Animation
      const portalRadius = 55 + Math.sin(now * 0.01) * 8;
      const portalGrad = ctx.createRadialGradient(playerHandX, playerHandY, 10, playerHandX, playerHandY, portalRadius);
      portalGrad.addColorStop(0, '#ffffff');
      portalGrad.addColorStop(0.5, COLOURS.cashedOut);
      portalGrad.addColorStop(1, 'rgba(0, 255, 128, 0)');
      ctx.fillStyle = portalGrad;
      ctx.beginPath();
      ctx.arc(playerHandX, playerHandY, portalRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '800 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FOIL CARD SECURED!', playerHandX, playerHandY - 15);
      ctx.font = '600 13px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('WARPED OUT VIA NEON PORTAL', playerHandX, playerHandY + 12);
    }

    // 6. Crashed Shatter / Blinding Mega-Combo effect
    if (crashed) {
      const shatterAlpha = clamp01(1 - crashAgeSec / 2.5);
      ctx.save();
      // Laser beams from bot
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.8)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 12; i++) {
        const rayAngle = (i / 12) * Math.PI * 2 + now * 0.003;
        ctx.beginPath();
        ctx.moveTo(botX, botY);
        ctx.lineTo(botX + Math.cos(rayAngle) * 600, botY + Math.sin(rayAngle) * 600);
        ctx.stroke();
      }
      // Shattered glass shards
      ctx.fillStyle = `rgba(255, 255, 255, ${shatterAlpha * 0.7})`;
      for (let s = 0; s < 18; s++) {
        const sx = 200 + (s * 41) % 560;
        const sy = 330 + (s * 29) % 180 + crashAgeSec * 35;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 15, sy - 8);
        ctx.lineTo(sx + 8, sy + 18);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 7. HUD Overlays & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Subtitle Header
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 24px "Courier New", monospace';
    ctx.fillText('TCG BOT BOSS', 480, 36);

    ctx.fillStyle = tension > 0.5 ? COLOURS.neonPurple : COLOURS.neonCyan;
    ctx.font = '700 12px "Courier New", monospace';
    ctx.fillText('CYBERNETIC TRADING BOT · INFINITE EXODIA THREAT', 480, 58);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : (tension > 0.6 ? COLOURS.neonPurple : COLOURS.neonCyan));
    ctx.fillStyle = multColor;
    ctx.font = `900 ${72 * (1 + 0.2 * punch + 0.1 * depth)}px "Courier New", monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 108);

    // Milestones / Status Caption
    const currentMilestoneText = running ? MILESTONES[milestone - 1] : undefined;
    const bannerText = currentMilestoneText ? currentMilestoneText[1].toUpperCase() : PHASE_LABELS[view.phase];
    ctx.fillStyle = crashed ? COLOURS.crashed : (currentMilestoneText ? COLOURS.neonGold : COLOURS.muted);
    ctx.font = popFont(700, 15, pop(currentMilestoneText?.[0] ?? 100));
    ctx.fillText(bannerText, 480, 275);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = popFont(700, 14, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(line, 480, 524);

    ctx.restore();
  }

  return { draw };
}
