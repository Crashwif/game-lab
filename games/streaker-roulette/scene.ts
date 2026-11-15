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
  [120, 'Pit boss squinting suspiciously from podium'],
  [150, 'Censor bar wobbles as chip stacks double'],
  [200, 'Security guard enters table frame with walkie'],
  [250, 'Cocktail waitress drops drink tray in shock'],
  [300, 'Two giant bouncers unfold velvet curtain'],
  [500, 'Floor manager points wildly shouting code red'],
  [1000, 'Whole casino floor stops spinning to stare'],
  [10000, 'Flashbulbs pop while chip towers hit ceiling'],
  [100000, 'Gold bullion piled onto naked gambler lap'],
  [1000000, 'Pit boss signs over casino deeds in tears'],
];

const COLOURS = {
  bgDeep: '#13041c',
  bgWall: '#250730',
  carpet: '#3e0e47',
  gold: '#f6c344',
  feltGreen: '#17633e',
  feltBorder: '#0b3d25',
  woodRim: '#4a2306',
  censor: '#111111',
  skin: '#f5c198',
  bouncers: '#1f2438',
  accent: '#ffd166',
  crashed: '#ff5470',
  cashedOut: '#4ee49d',
  text: '#ffffff',
  muted: '#c7b2d6',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Robe secured at ${formatX(view.cashoutX100)} · Escaping on gold cart!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Security swarmed table · No credits staked' : 'Watching streaker stack · No credits riding', COLOURS.muted];
  }
  if (crashed) {
    return [`Tackled into fountain! Lost ${credits(view.stake)}`, COLOURS.crashed];
  }
  return [`Streaker stacking ${credits(view.stake)} · Cash out before the towel!`, COLOURS.gold];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'casino', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastChipClick = 0;

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
      audio.fx('whistle', 0.8);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('siren', 0.4 + 0.4 * tension);
      }
      if (now - lastChipClick > Math.max(120, 480 - tension * 360) && view.cashoutX100 === null) {
        audio.fx('coin', 0.35 + 0.5 * tension);
        lastChipClick = now;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * Math.max(0, 1 - crashAgeSec / 0.6) : (running ? Math.sin(now * 0.02) * tension * 1.5 : 0);
    const escaped = view.cashoutX100 !== null;

    ctx.save();
    if (shake !== 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // Casino Room Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgDeep);
    bgGrad.addColorStop(0.5, COLOURS.bgWall);
    bgGrad.addColorStop(1, COLOURS.carpet);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Chandelier / Ceiling Gold Glow
    const glowGrad = ctx.createRadialGradient(480, 20, 10, 480, 20, 420);
    glowGrad.addColorStop(0, 'rgba(255, 220, 120, 0.28)');
    glowGrad.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, 960, 360);

    // Background casino pillars & lights
    for (let i = 0; i < 5; i++) {
      const px = 100 + i * 190;
      ctx.fillStyle = '#2d0a3d';
      ctx.fillRect(px - 14, 40, 28, 240);
      ctx.fillStyle = COLOURS.gold;
      ctx.fillRect(px - 18, 50, 36, 6);
      // Small warm sconce light
      ctx.beginPath();
      ctx.arc(px, 110, 6 + Math.sin(now * 0.004 + i) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffea9f';
      ctx.fill();
    }

    // Flashing siren light at Code Red (tension > 0.6)
    if (tension > 0.6 && !escaped && !crashed) {
      const sirenAlpha = (Math.sin(now * 0.012) + 1) * 0.5 * 0.35;
      ctx.fillStyle = `rgba(255, 30, 60, ${sirenAlpha})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // Security guards lurking in background wings
    const guardWalkIn = clamp01(tension * 1.8);
    if (!escaped) {
      // Left Guard (Bouncer with walkie & towel)
      const lgX = -60 + guardWalkIn * 150;
      ctx.fillStyle = COLOURS.bouncers;
      ctx.fillRect(lgX, 190, 64, 150); // Body
      ctx.beginPath();
      ctx.arc(lgX + 32, 166, 22, 0, Math.PI * 2); // Head
      ctx.fill();
      // Earpiece cord
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lgX + 44, 168);
      ctx.lineTo(lgX + 50, 194);
      ctx.stroke();
      // Giant rolled bath towel / velvet blanket under arm
      ctx.fillStyle = '#b31e3d';
      ctx.beginPath();
      ctx.roundRect(lgX + 16, 230, 80, 26, 12);
      ctx.fill();

      // Right Pit Boss with clipboard
      const rgX = 1020 - guardWalkIn * 150;
      ctx.fillStyle = '#2c1e28';
      ctx.fillRect(rgX, 190, 54, 150);
      ctx.beginPath();
      ctx.arc(rgX + 27, 168, 20, 0, Math.PI * 2);
      ctx.fill();
      // Squinting eyes & mustache
      ctx.fillStyle = '#000';
      ctx.fillRect(rgX + 12, 166, 12, 3);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(rgX - 10, 220, 28, 40); // gold clipboard
    }

    // The Green Felt Roulette Table (Foreground semi-ellipse)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(480, 420, 420, 140, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLOURS.woodRim;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(480, 422, 390, 120, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLOURS.feltGreen;
    ctx.fill();
    ctx.strokeStyle = COLOURS.feltBorder;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Table Felt Markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(480, 422, 320, 88, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Protagonist & Escapade Rendering
    const bob = Math.sin(now * 0.008) * (running ? 3 + tension * 4 : 1);

    if (escaped) {
      // CASH OUT ESCAPE: Streaker in Gold Silk Bathrobe on Gold Luggage Cart speeding away!
      const cartX = 380 + Math.min(260, (now * 0.25) % 800 - 100);
      const cartY = 320;
      // Gold luggage cart frame
      ctx.strokeStyle = COLOURS.gold;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cartX - 45, cartY + 45);
      ctx.lineTo(cartX + 65, cartY + 45);
      ctx.lineTo(cartX + 65, cartY - 30);
      ctx.arc(cartX + 10, cartY - 30, 55, 0, Math.PI, true);
      ctx.stroke();
      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cartX - 35, cartY + 50, 10, 0, Math.PI * 2);
      ctx.arc(cartX + 55, cartY + 50, 10, 0, Math.PI * 2);
      ctx.fill();

      // Streaker in Gold Bathrobe cheering
      ctx.fillStyle = COLOURS.gold;
      ctx.beginPath();
      ctx.roundRect(cartX - 10, cartY - 20, 48, 60, 14); // Robe
      ctx.fill();
      // Champagne glass in hand
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cartX + 42, cartY - 44, 4, 18);
      ctx.fillStyle = '#fce276';
      ctx.fillRect(cartX + 38, cartY - 54, 12, 12);
      // Head with sunglasses
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.arc(cartX + 14, cartY - 36, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(cartX + 10, cartY - 38, 20, 8); // Cool VIP shades
    } else if (crashed) {
      // CRASHED ENDING: Rolled up in red velvet rug burrito & guards tossing into fountain
      const flyProgress = clamp01(crashAgeSec / 0.8);
      const tossX = 480 + flyProgress * 180;
      const tossY = 320 - Math.sin(flyProgress * Math.PI) * 110 + flyProgress * 80;
      const tossRot = flyProgress * 3.8;

      ctx.save();
      ctx.translate(tossX, tossY);
      ctx.rotate(tossRot);

      // Rolled velvet rug bundle
      ctx.fillStyle = '#8b0e2b';
      ctx.beginPath();
      ctx.roundRect(-55, -28, 110, 56, 16);
      ctx.fill();
      ctx.strokeStyle = COLOURS.gold;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Naked cartoon feet sticking out one end!
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.arc(-62, -8, 8, 0, Math.PI * 2);
      ctx.arc(-62, 8, 8, 0, Math.PI * 2);
      ctx.fill();
      // Distressed eyes sticking out other end!
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.arc(60, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(63, -4, 5, 0, Math.PI * 2);
      ctx.arc(63, 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(63, -5, 3, 3);
      ctx.fillRect(63, 3, 3, 3);
      ctx.restore();

      // Water fountain splash particles if past apex
      if (flyProgress > 0.45) {
        ctx.fillStyle = 'rgba(120, 210, 255, 0.75)';
        for (let s = 0; s < 12; s++) {
          const sx = 660 + Math.sin(s * 1.5 + crashAgeSec * 8) * 55;
          const sy = 400 - (crashAgeSec * 90) % 70 - (s * 8);
          ctx.beginPath();
          ctx.arc(sx, sy, 4 + (s % 4), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // ACTIVE ROUND: Streaker sitting behind green felt table
      const px = 480;
      const py = 300 + bob;

      // Torso (unclothed, skin tone)
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.roundRect(px - 36, py - 30, 72, 85, 20);
      ctx.fill();

      // Arms on table (sweat dropping)
      ctx.beginPath();
      ctx.ellipse(px - 44, py + 25, 14, 38, -0.3, 0, Math.PI * 2);
      ctx.ellipse(px + 44, py + 25, 14, 38, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.arc(px, py - 55, 28, 0, Math.PI * 2);
      ctx.fill();

      // Wild Hair
      ctx.fillStyle = '#6b3e1a';
      ctx.beginPath();
      ctx.arc(px, py - 70, 24, Math.PI, 0);
      ctx.fill();

      // Sweating expression / wide eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - 10, py - 56, 7, 0, Math.PI * 2);
      ctx.arc(px + 10, py - 56, 7, 0, Math.PI * 2);
      ctx.fill();
      // Pupils darting
      const eyeOffset = Math.sin(now * 0.015) * 3;
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(px - 10 + eyeOffset, py - 56, 3, 0, Math.PI * 2);
      ctx.arc(px + 10 + eyeOffset, py - 56, 3, 0, Math.PI * 2);
      ctx.fill();

      // Sweat drops
      if (tension > 0.3) {
        ctx.fillStyle = '#65cbe8';
        ctx.beginPath();
        ctx.arc(px + 28, py - 62 + ((now * 0.05) % 18), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // COMICAL CENSORED BAR (Strategically bobbing right over table line!)
      const censorWobble = tension > 0.15 ? Math.sin(now * 0.035) * (3 + tension * 7) : 0;
      ctx.save();
      ctx.translate(px, py + 52);
      ctx.rotate((censorWobble * Math.PI) / 180);
      ctx.fillStyle = COLOURS.censor;
      ctx.fillRect(-62, -15, 124, 30);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-62, -15, 124, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CENSORED', 0, 0);
      ctx.restore();
    }

    // High Chip Towers Stacking on Table (Climb higher with multiplier!)
    const stackHeight = Math.min(180, Math.floor(12 + depth * 140 + tension * 40));
    const chipCols = [
      { x: 330, col: '#e63946', val: '$5' },
      { x: 375, col: '#1d3557', val: '$20' },
      { x: 585, col: '#f77f00', val: '$50' },
      { x: 630, col: '#f4a261', val: '$100' },
      { x: 480, col: COLOURS.gold, val: 'HIGH' },
    ];

    for (const [idx, col] of chipCols.entries()) {
      const colChips = Math.max(3, Math.floor((stackHeight * (0.8 + 0.3 * Math.sin(idx + 1))) / 7));
      for (let c = 0; c < colChips; c++) {
        const cy = 440 - c * 6 - (idx === 4 ? 12 : 0);
        ctx.fillStyle = c % 2 === 0 ? col.col : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(col.x, cy, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // TOP HUD: Title & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title
    ctx.fillStyle = COLOURS.gold;
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText('STREAKER ROULETTE', 480, 48);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('STACK CHIPS FAST BEFORE SECURITY THROWS THE TOWEL', 480, 78);

    // Huge Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (escaped ? COLOURS.cashedOut : COLOURS.accent);
    ctx.fillStyle = multColor;
    const pulse = running ? 1 + tension * 0.12 * Math.sin(now * 0.01) : 1;
    ctx.font = `900 ${Math.floor(76 * pulse)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 150);

    // Milestone status / Funny Announcement Banner
    const currentMilestoneText = MILESTONES[milestoneIndex - 1]?.[1] ?? (running ? 'Naked at the high roller table...' : (crashed ? 'BUNCLED INTO THE VALET FOUNTAIN!' : 'Place bets before the bouncers notice!'));

    ctx.fillStyle = 'rgba(20, 5, 28, 0.82)';
    ctx.beginPath();
    ctx.roundRect(140, 202, 680, 36, 18);
    ctx.fill();
    ctx.strokeStyle = multColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(currentMilestoneText, 480, 220);

    // Bottom Stake & Cashout status banner
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = 'rgba(10, 4, 18, 0.88)';
    ctx.beginPath();
    ctx.roundRect(160, 482, 640, 42, 21);
    ctx.fill();
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = lineCol;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 503);

    ctx.restore();
  }

  return { draw };
}
