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
  [120, 'Common wooden chest pops open with gray bandages'],
  [150, 'Uncommon chest reveals blue shield potions'],
  [200, 'Rare purple beam flashes across the minimap'],
  [250, 'Treasure hour activates doubling shiny drops'],
  [300, 'Gold sparkle aura engulfs the loot pile'],
  [500, '1-in-10,000 legendary pirate chest surfaces'],
  [1000, 'The mythic doubloon chest starts humming loud'],
  [10000, 'Item shop unlocked free for all lobby frens'],
  [100000, '1-in-137k pirate coin floats in divine rays'],
  [1000000, 'Entire Epic Games catalog unlocked forever'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function getRarityColor(x100: number): string {
  if (x100 < 150) return '#94a3b8'; // Common Gray
  if (x100 < 200) return '#22c55e'; // Uncommon Green
  if (x100 < 300) return '#38bdf8'; // Rare Blue
  if (x100 < 500) return '#c084fc'; // Epic Purple
  if (x100 < 1000) return '#fbbf24'; // Legendary Gold
  return '#f43f5e'; // Mythic Prismatic
}

function stakeLine(view: SceneView): [text: string, color: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Glided away at ${formatX(view.cashoutX100)} · Victory Royale secure!`, '#4ade80'];
  }
  if (view.stake === null) {
    return [crashed ? 'Storm closed · spectating lobby' : 'Watching the chest spawn · no credits placed', '#94a3b8'];
  }
  if (crashed) {
    return [`Storm crushed your ${credits(view.stake)} · Eliminated #2`, '#f87171'];
  }
  return [`Opening crate · ${credits(view.stake)} on the line`, '#38bdf8'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'pop' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let swingTick = 0;

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
      audio.crash('pop', previousPhase === null || view.crashAge > 1500);
      audio.fx('boo', 0.6);
    }
    if (running && previousPhase === 'running' && milestoneIndex > previousMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('coin', 0.7);
    }

    const swingCycle = Math.floor(view.elapsed / (260 - tension * 120));
    if (running && !cashedOut && swingCycle > swingTick) {
      audio.fx('clang', 0.3 + 0.4 * tension);
      swingTick = swingCycle;
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : (running ? Math.sin(now * 0.02) * tension * 3 : 0);

    ctx.save();
    // Screen shake
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.09));

    // 1. Sky & Storm Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    if (crashed) {
      bgGrad.addColorStop(0, '#1f0d2b');
      bgGrad.addColorStop(0.6, '#3b0764');
      bgGrad.addColorStop(1, '#090514');
    } else {
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#1e1b4b');
      bgGrad.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Closing storm eye effect
    const stormRadius = Math.max(220, 680 - (running ? tension * 320 : 0));
    const stormGrad = ctx.createRadialGradient(480, 270, stormRadius * 0.7, 480, 270, stormRadius * 1.35);
    stormGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
    stormGrad.addColorStop(0.7, 'rgba(147, 51, 234, 0.4)');
    stormGrad.addColorStop(1, 'rgba(88, 28, 135, 0.88)');
    ctx.fillStyle = stormGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Floating storm particles
    const timeSec = now * 0.001;
    ctx.fillStyle = 'rgba(216, 180, 254, 0.4)';
    for (let i = 0; i < 20; i++) {
      const px = (Math.sin(i * 99 + timeSec * 0.8) * 0.5 + 0.5) * 960;
      const py = ((i * 37 + timeSec * 45) % 540);
      ctx.beginPath();
      ctx.arc(px, py, (i % 3) + 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Battle Royale Ground Platform
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.ellipse(480, 480, 420, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#047857';
    ctx.beginPath();
    ctx.ellipse(480, 475, 380, 68, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wooden build ramp underneath chest
    ctx.fillStyle = '#78350f';
    ctx.fillRect(410, 400, 140, 24);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(414, 404, 132, 16);

    const rarityColor = getRarityColor(view.currentX100);

    // 3. Sky Loot Beam (Rare -> Legendary -> Mythic)
    if (running || (crashed && crashAgeSec < 0.8)) {
      const beamWidth = 24 + tension * 48 + depth * 30;
      const beamGrad = ctx.createLinearGradient(480 - beamWidth, 0, 480 + beamWidth, 0);
      beamGrad.addColorStop(0, 'transparent');
      beamGrad.addColorStop(0.5, rarityColor);
      beamGrad.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(timeSec * 8);
      ctx.fillStyle = beamGrad;
      ctx.fillRect(480 - beamWidth, 0, beamWidth * 2, 410);
      ctx.restore();
    }

    // 4. Centerpiece: The Chest
    const chestX = 480;
    const chestY = 385;
    const chestJitter = running ? Math.sin(timeSec * 35) * (1.5 + tension * 5) : 0;
    const chestLidLift = running ? Math.sin(timeSec * 16) * (4 + tension * 12) : 0;

    ctx.save();
    ctx.translate(chestX + chestJitter, chestY);

    if (!crashed || crashAgeSec > 0.4) {
      // Golden / Wooden Chest Body
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.roundRect(-42, -20, 84, 42, 6);
      ctx.fill();

      // Golden banding
      ctx.fillStyle = rarityColor;
      ctx.fillRect(-44, -18, 10, 38);
      ctx.fillRect(34, -18, 10, 38);
      ctx.fillRect(-6, -18, 12, 38);

      // Chest Keyhole
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.rect(-2, 0, 4, 8);
      ctx.fill();

      // Chest Lid (opens/bounces)
      ctx.save();
      ctx.translate(0, -20 - chestLidLift);
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(0, 0, 44, 18, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = rarityColor;
      ctx.fillRect(-6, -16, 12, 16);
      ctx.restore();

      // Loot aura glowing around chest
      ctx.shadowColor = rarityColor;
      ctx.shadowBlur = 15 + tension * 25;
      ctx.strokeStyle = rarityColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-43, -21, 86, 44);
      ctx.shadowBlur = 0;
    } else {
      // Crash blast: Chest blown apart into gray smoke & common pistol
      const blast = crashAgeSec / 0.4;
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(0, -10, 50 * blast, 0, Math.PI * 2);
      ctx.fill();

      // Rusted gray common pistol
      ctx.fillStyle = '#475569';
      ctx.fillRect(-18, -12, 28, 8);
      ctx.fillRect(-14, -4, 10, 16);
      ctx.fillStyle = '#ef4444';
      ctx.font = '700 12px sans-serif';
      ctx.fillText('COMMON TRASH', -40, -28);
    }
    ctx.restore();

    // 5. Protagonist: Sweaty Default Skin OR Glider Escape
    if (cashedOut) {
      // Cashed out: soaring high on an Umbrella / Glider with sparkling loot bag
      const gliderY = 160 + Math.sin(timeSec * 3) * 14;
      ctx.save();
      ctx.translate(480, gliderY);

      // Glider Canopy (Victory Umbrella)
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -40, 55, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glider handle ropes
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-45, -40);
      ctx.lineTo(0, -10);
      ctx.moveTo(45, -40);
      ctx.lineTo(0, -10);
      ctx.stroke();

      // Default Skin hanging from glider
      ctx.fillStyle = '#f59e0b'; // Blond hair / bandana
      ctx.beginPath();
      ctx.arc(0, -5, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10b981'; // Green jacket
      ctx.fillRect(-8, 5, 16, 22);

      // Gold Doubloon in hand
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(16, 12, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.font = '900 10px sans-serif';
      ctx.fillText('★', 12, 16);

      ctx.restore();
    } else if (!crashed) {
      // Frantic pickaxe swing animation
      const swingSpeed = 12 + tension * 16;
      const swingAngle = Math.sin(timeSec * swingSpeed) * 0.7 - 0.4;

      ctx.save();
      ctx.translate(390, 375);

      // Skin Body
      ctx.fillStyle = '#0284c7'; // Blue tank top
      ctx.fillRect(-10, -26, 20, 32);
      ctx.fillStyle = '#ca8a04'; // Hair/bandana
      ctx.beginPath();
      ctx.arc(0, -38, 12, 0, Math.PI * 2);
      ctx.fill();

      // Sweaty sweat drops flying off
      if (tension > 0.3) {
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.arc(-14 + Math.sin(timeSec * 20) * 4, -42, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pickaxe Arm & Golden Pickaxe
      ctx.save();
      ctx.translate(10, -18);
      ctx.rotate(swingAngle);
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(34, -30);
      ctx.stroke();

      // Pickaxe Head
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(26, -38);
      ctx.lineTo(44, -22);
      ctx.lineTo(38, -18);
      ctx.lineTo(20, -34);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    } else {
      // Eliminated Ghost / Bees swarm
      ctx.save();
      ctx.translate(390, 375);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(0, -30 - crashAgeSec * 20, 16, 0, Math.PI * 2);
      ctx.fill();
      // Angry Storm Bees
      ctx.fillStyle = '#facc15';
      for (let b = 0; b < 6; b++) {
        const bx = Math.sin(b * 3 + timeSec * 15) * 30;
        const by = -30 + Math.cos(b * 4 + timeSec * 18) * 20;
        ctx.fillRect(bx, by, 4, 3);
      }
      ctx.restore();
    }

    // 6. HUD - Header & Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('CHEST RNG RUSH', 480, 48);

    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.letterSpacing = '1px';
    ctx.fillText('1-IN-137,500 MYTHIC PIRATE DOUBLOON HUNT', 480, 76);
    ctx.letterSpacing = '0px';

    // Huge Multiplier Display with Dynamic Rarity Color
    ctx.fillStyle = crashed ? '#f87171' : rarityColor;
    const punch = crashed ? 1 + 0.2 * clamp01(1 - crashAgeSec / 0.3) : 1;
    ctx.font = `900 ${Math.floor(78 * punch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 175);

    // Rarity Badge below multiplier
    let rarityName = 'COMMON';
    if (view.currentX100 >= 100000) rarityName = '★ MYTHIC PIRATE RELIC ★';
    else if (view.currentX100 >= 1000) rarityName = 'MYTHIC HUMMING CHEST';
    else if (view.currentX100 >= 500) rarityName = 'LEGENDARY PIRATE CHEST';
    else if (view.currentX100 >= 300) rarityName = 'GOLDEN TREASURE AURA';
    else if (view.currentX100 >= 200) rarityName = 'RARE PURPLE BEAM';
    else if (view.currentX100 >= 150) rarityName = 'UNCOMMON SHIELD DROP';

    ctx.fillStyle = rarityColor;
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText(rarityName, 480, 230);

    // Milestone Caption Banner
    const passed = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const statusText = passed ? passed[1] : (crashed ? 'ELIMINATED #2 · STORM COLLAPSED ON CHEST' : 'READY TO CRACK CHESTS');

    ctx.fillStyle = crashed ? '#fca5a5' : '#cbd5e1';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 452, 860);

    // Stake line
    const [line, lineColor] = stakeLine(view);
    ctx.fillStyle = lineColor;
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText(line, 480, 492, 860);

    ctx.restore();
  }

  return { draw };
}
