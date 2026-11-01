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
  [120, 'Golden chest opens with sparkling gliders'],
  [150, 'Rare anime bundle auto-claims to locker'],
  [200, 'Banana mascot suit equip sparkles wildly'],
  [250, 'Floss dance emote auto-triggers on repeat'],
  [300, 'Pickaxes stack into an unstable sky-high tower'],
  [500, 'Legendary weapon wraps cover the whole UI'],
  [1000, 'Entire cosmetic catalogue marked zero coins'],
  [10000, 'Server warning marquee blinks orange across top'],
  [100000, 'V-bucks counter spins into negative infinity'],
  [1000000, 'Locker transcends the known multiverse grid'],
];

const COLOURS = {
  bgTop: '#0d0722',
  bgBot: '#1f103d',
  neonCyan: '#00f2ff',
  neonGold: '#ffd700',
  neonPink: '#ff2a85',
  neonPurple: '#a855f7',
  crashed: '#ff3355',
  cashedOut: '#4ade80',
  white: '#ffffff',
  muted: '#94a3b8',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Glider deployed at ${formatX(view.cashoutX100)} · Vault secure!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Emergency hotfix landed · spectating' : 'Browsing zero-coin shop · spectating', COLOURS.muted];
  }
  if (crashed) return [`Confiscated! Lost ${credits(view.stake)} to patch note`, COLOURS.crashed];
  return [`Spamming claims with ${credits(view.stake)} riding`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastClickTime = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('whoosh', 0.9);
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('coin', 0.85);
      }
      const clickInterval = Math.max(70, 240 - tension * 170);
      if (now - lastClickTime > clickInterval && view.cashoutX100 === null) {
        lastClickTime = now;
        audio.fx('click', 0.3 + 0.5 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * Math.exp(-crashSec * 3) : running ? tension * 3 * Math.sin(now * 0.04) : 0;
    const sx = shake ? (Math.sin(now * 0.08) * shake) : 0;
    const sy = shake ? (Math.cos(now * 0.11) * shake) : 0;

    ctx.save();
    ctx.translate(sx, sy);

    // 1. Cyber Shop Backdrop
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, COLOURS.bgTop);
    grad.addColorStop(1, COLOURS.bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);

    // Grid lines / item shop matrix
    ctx.strokeStyle = crashed ? 'rgba(255, 51, 85, 0.15)' : 'rgba(0, 242, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 40; x < 960; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    const gridYOffset = (view.elapsed * 0.06) % 60;
    for (let y = -60 + gridYOffset; y < 540; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Server Warning Marquee (escalating)
    if (view.currentX100 >= 10000 || crashed) {
      const flash = (Math.sin(now * 0.02) + 1) * 0.5;
      ctx.fillStyle = crashed ? `rgba(255, 0, 60, ${0.35 + flash * 0.35})` : `rgba(255, 140, 0, ${0.25 + flash * 0.25})`;
      ctx.fillRect(0, 0, 960, 28);
      ctx.fillStyle = COLOURS.white;
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(crashed ? 'CRITICAL HOTFIX APPLIED // ALL EXPLOITED ASSETS REVOKED' : 'WARNING: ABNORMAL ITEM SHOP CLAIMS DETECTED // PATCH IMMINENT', 480, 18);
    }

    // 2. Centerpiece & Loot Pile
    const cx = 480;
    const cy = 330;
    const isEscaped = view.cashoutX100 !== null;

    if (isEscaped) {
      // Glider Escape Animation
      const flightAge = (view.elapsed - (view.cashoutX100 ? 0 : 0)) * 0.001;
      const flyY = Math.max(100, cy - flightAge * 120);
      const sway = Math.sin(now * 0.006) * 25;

      // Holographic Glider Wings
      ctx.save();
      ctx.translate(cx + sway, flyY);
      ctx.strokeStyle = COLOURS.neonCyan;
      ctx.lineWidth = 4;
      ctx.fillStyle = 'rgba(0, 242, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(-90, -40);
      ctx.lineTo(0, -70);
      ctx.lineTo(90, -40);
      ctx.lineTo(30, -30);
      ctx.lineTo(0, -35);
      ctx.lineTo(-30, -30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cables
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-60, -40); ctx.lineTo(0, 10);
      ctx.moveTo(60, -40); ctx.lineTo(0, 10);
      ctx.stroke();

      // Gamer with giant golden loot sack
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.arc(0, 24, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOURS.neonGold;
      ctx.font = '900 16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('$$$', 0, 28);

      // Kid's head & smile
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(0, -2, 14, 0, Math.PI * 2);
      ctx.fill();
      // Neon visor
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.fillRect(-10, -5, 20, 6);
      ctx.restore();
    } else if (crashed) {
      // Confiscated / Default Sweatpants Defeat
      ctx.save();
      ctx.translate(cx, cy);

      // Smashed Error Box
      ctx.fillStyle = 'rgba(255, 51, 85, 0.2)';
      ctx.strokeStyle = COLOURS.crashed;
      ctx.lineWidth = 3;
      ctx.strokeRect(-90, -50, 180, 120);
      ctx.fillRect(-90, -50, 180, 120);

      // Sad Default Avatar
      ctx.fillStyle = '#94a3b8'; // grey default sweatpants
      ctx.fillRect(-16, 20, 12, 40);
      ctx.fillRect(4, 20, 12, 40);
      // plain t-shirt
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-22, -10, 44, 32);
      // head
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(0, -24, 15, 0, Math.PI * 2);
      ctx.fill();
      // crying eyes
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.fillRect(-7, -22, 3, 10);
      ctx.fillRect(4, -22, 3, 10);

      // Giant BAN Stamp
      ctx.rotate(-0.15);
      ctx.fillStyle = COLOURS.crashed;
      ctx.strokeStyle = COLOURS.white;
      ctx.lineWidth = 2;
      ctx.font = '900 36px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HOTFIXED: 0 LOOT', 0, -45);
      ctx.strokeText('HOTFIXED: 0 LOOT', 0, -45);
      ctx.restore();
    } else {
      // LIVE SPAMMING PROTO: Golden chest, towering pickaxes, hyper kid
      const clickSquish = Math.sin(now * 0.035) * 4;
      const stackHeight = Math.min(180, 20 + tension * 150 + depth * 30);

      // Stacking pickaxes / skins tower
      const itemsCount = Math.floor(4 + tension * 16);
      for (let i = 0; i < itemsCount; i++) {
        const itemY = cy + 20 - i * 11;
        const wobble = Math.sin(now * 0.008 + i * 0.7) * (3 + tension * 12);
        const hue = (i * 45 + now * 0.1) % 360;
        ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
        ctx.fillRect(cx - 35 + wobble, itemY, 70, 8);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 35 + wobble, itemY, 70, 8);
      }

      // Golden Loot Chest (Spam target)
      ctx.save();
      ctx.translate(cx, cy + 30 + clickSquish);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-45, -20, 90, 42);
      ctx.strokeStyle = COLOURS.neonGold;
      ctx.lineWidth = 3;
      ctx.strokeRect(-45, -20, 90, 42);
      // Chest lid slightly open & glowing
      const openAngle = 0.2 + tension * 0.4;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-48, -20);
      ctx.lineTo(48, -20);
      ctx.lineTo(48, -20 - openAngle * 25);
      ctx.lineTo(-48, -20 - openAngle * 25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glow beam shooting up
      const beamGrad = ctx.createLinearGradient(0, -20, 0, -20 - stackHeight);
      beamGrad.addColorStop(0, 'rgba(255, 235, 59, 0.7)');
      beamGrad.addColorStop(1, 'rgba(255, 42, 133, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(-30, -20 - stackHeight, 60, stackHeight);
      ctx.restore();

      // Hyperactive Kid sitting in gaming chair clicking furiously
      const gamerX = cx - 110;
      const gamerY = cy + 10;
      ctx.save();
      ctx.translate(gamerX, gamerY);
      // Chair
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-22, -40, 44, 75);
      ctx.fillStyle = COLOURS.neonPink;
      ctx.fillRect(-24, -42, 6, 77);
      ctx.fillRect(18, -42, 6, 77);

      // Body / Banana Suit if >= 200
      const isBanana = view.currentX100 >= 200;
      ctx.fillStyle = isBanana ? '#facc15' : '#3b82f6';
      ctx.beginPath();
      ctx.ellipse(0, 0, isBanana ? 18 : 14, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head + RGB Gaming Headset
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(4, -28, 14, 0, Math.PI * 2);
      ctx.fill();
      // Wide hyped eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(8, -29, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.fillRect(6, -34, 8, 3);
      // Headset band + earpiece
      ctx.strokeStyle = COLOURS.neonPink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(4, -30, 16, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.beginPath();
      ctx.arc(-8, -28, 6, 0, Math.PI * 2);
      ctx.fill();

      // Clicking Arms: blurred rapid flailing
      const armWiggle = Math.sin(now * 0.06) * 12;
      ctx.strokeStyle = isBanana ? '#eab308' : '#60a5fa';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(26 + armWiggle, -2);
      ctx.lineTo(44, 10 + armWiggle);
      ctx.stroke();

      // Floating "+CLAIMED!" burst
      const claimAlpha = (Math.sin(now * 0.012) + 1) * 0.5;
      ctx.fillStyle = `rgba(0, 242, 255, ${0.4 + 0.6 * claimAlpha})`;
      ctx.font = '800 13px ui-monospace, monospace';
      ctx.fillText('CLAIM ALL! x99', 30, -50 - tension * 20);
      ctx.restore();
    }

    // 3. Floating Sparkles / Gliders in background
    for (let i = 0; i < 7; i++) {
      const pTime = (now * 0.001 + i * 1.5) % 4;
      const px = 100 + ((i * 137) % 760);
      const py = 460 - pTime * 110;
      const pAlpha = Math.sin((pTime / 4) * Math.PI) * (running ? 0.75 : 0.2);
      ctx.fillStyle = i % 2 === 0 ? COLOURS.neonCyan : COLOURS.neonGold;
      ctx.globalAlpha = pAlpha;
      ctx.beginPath();
      ctx.arc(px, py, 2.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 4. UI Overlay & Texts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tag
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('LOOT FRENZY', 480, 52);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('EMERGENCY SERVER SHOP EXPLOIT · SPAM BEFORE HOTFIX', 480, 74);

    // Multiplier Callout
    const multColor = crashed ? COLOURS.crashed : isEscaped ? COLOURS.cashedOut : COLOURS.neonGold;
    ctx.fillStyle = multColor;
    const punchScale = running ? 1 + tension * 0.15 : crashed ? 1.25 : 1;
    ctx.font = `900 ${Math.floor(78 * punchScale)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 140);

    // Milestone / Shop status banner
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    const statusText = running
      ? (currentMilestone ? `★ ${currentMilestone[1]} ★` : 'Opening shop crates...')
      : crashed
      ? 'HOTFIX DEPLOYED // LOCKER CONVERTED TO DEFAULT GEAR'
      : view.phase === 'betting'
      ? 'READY UP TO LOOT THE GLITCHED STORE'
      : 'INITIALIZING STOREFRONT...';

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.white;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 442, 880);

    // Stake line / Glider status
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillText(line, 480, 485, 880);

    ctx.restore();
  }

  return { draw };
}
