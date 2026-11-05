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
  [120, 'Level 1: Slime made of barbecue sauce squashed'],
  [150, 'Upgraded to a double-patty iron helmet'],
  [200, 'Spicy fry dagger unlocked in the scullery'],
  [250, 'Defeated the rogue onion ring sorcerer'],
  [300, 'Frosty golem joins the raiding party'],
  [500, 'Unlocked golden paper crowns with +10 stamina'],
  [1000, '10-hour marathon mark reached without bathroom'],
  [10000, 'Legendary Baconator armor fully equipped'],
  [100000, 'Final boss kitchen dragon entered stage 3'],
  [1000000, 'S-Tier speedrun clears the entire menu tree'],
];

const COLOURS = {
  bgDark: '#0e0b16',
  dungeonFloor: '#1b1424',
  fryerGaze: '#d94b18',
  fryGold: '#ffbe1a',
  frostyCyan: '#5ce1e6',
  sauceRed: '#e62a35',
  textLight: '#fff5ea',
  textMuted: '#9a8ca6',
  cashedOut: '#4be088',
  crashed: '#ff3b56',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`REDEEMED COMBO BAG AT ${formatX(view.cashoutX100)} · SPEEDRUN SAVED!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Server reset · spectator save intact' : 'Spectating raid · no credits risked', COLOURS.textMuted];
  }
  if (crashed) {
    return [`Wiped! ${credits(view.stake)} lost to the broken machine`, COLOURS.crashed];
  }
  return [`Raid active · ${credits(view.stake)} riding on the nuggets`, COLOURS.fryGold];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let previousStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;
    const runTime = view.elapsed * 0.001;
    const stepCount = Math.floor(runTime * (5 + tension * 6));

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('buzz', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('clang', 0.6 + 0.4 * tension);
      }
      if (stepCount > previousStep && !cashed) {
        audio.fx('tick', 0.25 + 0.35 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;
    previousStep = stepCount;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.5) : tension * 2;
    const shakeX = shake * Math.sin(age * 55 + runTime * 20);
    const shakeY = shake * Math.cos(age * 47 + runTime * 17);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Dungeon Backdrop & Greasy Floor
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    const heatColor = tension > 0.6 ? '#320b08' : '#140d1a';
    bgGrad.addColorStop(0, COLOURS.bgDark);
    bgGrad.addColorStop(0.65, heatColor);
    bgGrad.addColorStop(1, '#08050a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Stone brick grid
    ctx.strokeStyle = `rgba(217, 75, 24, ${0.12 + 0.25 * tension})`;
    ctx.lineWidth = 2;
    const scrollX = (view.elapsed * (0.2 + tension * 0.4)) % 48;
    for (let x = -48; x < 980; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x - scrollX, 0);
      ctx.lineTo(x - scrollX, 420);
      ctx.stroke();
    }
    for (let y = 60; y < 420; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Boiling Fryer Vats at bottom
    ctx.fillStyle = COLOURS.dungeonFloor;
    ctx.fillRect(0, 410, 960, 130);
    const oilGrad = ctx.createLinearGradient(0, 410, 0, 440);
    oilGrad.addColorStop(0, COLOURS.fryerGaze);
    oilGrad.addColorStop(1, '#661400');
    ctx.fillStyle = oilGrad;
    ctx.fillRect(0, 410, 960, 24);

    // Boiling bubbles & steam embers
    for (let i = 0; i < 18; i++) {
      const bx = (i * 57 + view.elapsed * 0.12) % 960;
      const by = 410 - ((view.elapsed * 0.08 + i * 37) % 180);
      const bAlpha = clamp01(1 - (410 - by) / 180);
      ctx.fillStyle = i % 2 === 0 ? `rgba(255, 190, 26, ${bAlpha * 0.7})` : `rgba(230, 42, 53, ${bAlpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(bx, by, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Colossal Bacon Dragon Silhouette in Depth
    if (depth > 0.15 && !crashed) {
      const dragonAlpha = clamp01((depth - 0.15) * 1.5) * 0.35;
      ctx.save();
      ctx.fillStyle = `rgba(230, 42, 53, ${dragonAlpha})`;
      const dwX = 700 + Math.sin(runTime * 2) * 20;
      const dwY = 220 + Math.cos(runTime * 1.5) * 15;
      ctx.beginPath();
      ctx.arc(dwX, dwY, 70, 0, Math.PI * 2);
      ctx.lineTo(dwX + 90, dwY - 50);
      ctx.lineTo(dwX + 110, dwY + 40);
      ctx.closePath();
      ctx.fill();
      // Glowing dragon eye
      ctx.fillStyle = `rgba(255, 230, 80, ${dragonAlpha * 2})`;
      ctx.beginPath();
      ctx.arc(dwX - 25, dwY - 15, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Pixel Knight Protagonist
    const knightBaseX = cashed ? 620 : 440;
    const jumpOffset = cashed ? -Math.min(90, (view.elapsed - (view.crashAge || 0)) * 0.1) : Math.sin(runTime * 12) * 7;
    const knightY = (cashed ? 310 : 360) + jumpOffset;

    ctx.save();
    ctx.translate(knightBaseX, knightY);

    if (cashed) {
      // Cashed out: conveyor drive-thru counter & steam combo bag
      ctx.fillStyle = '#ffbe1a';
      ctx.fillRect(-80, 50, 160, 18);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(-90, 68, 180, 30);
      // Steaming paper combo bag held high
      ctx.fillStyle = '#d49b57';
      ctx.fillRect(25, -60, 42, 48);
      ctx.fillStyle = '#b31e28';
      ctx.fillRect(28, -50, 36, 12);
      // Steam curly swirls
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(38, -68);
      ctx.quadraticCurveTo(46, -82, 38, -96);
      ctx.moveTo(52, -66);
      ctx.quadraticCurveTo(62, -80, 54, -94);
      ctx.stroke();
    }

    // Knight Body (16-bit chunky shapes)
    // Blue & White square tabard
    ctx.fillStyle = '#1c6dd0';
    ctx.fillRect(-22, -26, 44, 46);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-8, -26, 16, 46);

    // Double-patty iron helmet / head
    ctx.fillStyle = milestoneIndex >= 2 ? '#6c7a89' : '#8c98a4';
    ctx.fillRect(-18, -60, 36, 34);
    // Wendy-style red braids
    ctx.fillStyle = COLOURS.sauceRed;
    ctx.fillRect(-26, -55, 8, 38);
    ctx.fillRect(18, -55, 8, 38);
    // Blue hair bows
    ctx.fillStyle = '#1c6dd0';
    ctx.fillRect(-28, -28, 12, 8);
    ctx.fillRect(16, -28, 12, 8);
    // Helmet Visor / Face
    ctx.fillStyle = '#222';
    ctx.fillRect(-12, -48, 24, 10);
    ctx.fillStyle = '#ffde59';
    ctx.fillRect(-8, -46, 6, 6);
    ctx.fillRect(2, -46, 6, 6);

    // Legs running animation
    const legPhase = Math.sin(runTime * 14);
    ctx.fillStyle = '#485563';
    ctx.fillRect(-16, 20, 12, 22 + legPhase * 8);
    ctx.fillRect(4, 20, 12, 22 - legPhase * 8);

    // Shield: Red fry carton with yellow fries poking out
    ctx.save();
    ctx.translate(-36, -16);
    ctx.fillStyle = COLOURS.sauceRed;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(24, 0);
    ctx.lineTo(20, 34);
    ctx.lineTo(4, 34);
    ctx.closePath();
    ctx.fill();
    // French fries protruding
    ctx.fillStyle = COLOURS.fryGold;
    ctx.fillRect(4, -14, 5, 14);
    ctx.fillRect(11, -20, 5, 20);
    ctx.fillRect(17, -12, 5, 12);
    ctx.restore();

    // Spatula Sword!
    ctx.save();
    const slashAngle = cashed ? -0.8 : Math.sin(runTime * 14) * 0.45 + tension * 0.3;
    ctx.translate(22, -10);
    ctx.rotate(slashAngle);
    // Wooden handle
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(-4, 0, 8, 22);
    // Steel neck & slotted flipper
    ctx.fillStyle = '#e0e6ed';
    ctx.fillRect(-3, -28, 6, 28);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-14, -60, 28, 32);
    // Spatula slots
    ctx.fillStyle = '#334155';
    ctx.fillRect(-9, -54, 4, 20);
    ctx.fillRect(-2, -54, 4, 20);
    ctx.fillRect(5, -54, 4, 20);
    // Sizzling grease on blade
    if (tension > 0.2) {
      ctx.fillStyle = COLOURS.fryGold;
      ctx.beginPath();
      ctx.arc(0, -62, 4 + Math.sin(runTime * 30) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore(); // Knight restore

    // 4. Rogue Sauce Slime & Minions under attack
    if (running && !cashed) {
      const slimeX = 640 + Math.cos(runTime * 8) * 40;
      const squish = Math.abs(Math.sin(runTime * 10));
      ctx.fillStyle = COLOURS.sauceRed;
      ctx.beginPath();
      ctx.ellipse(slimeX, 400, 24 + squish * 8, 16 - squish * 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Slime eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(slimeX - 12, 394, 6, 6);
      ctx.fillRect(slimeX + 4, 394, 6, 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(slimeX - 10, 396, 3, 3);
      ctx.fillRect(slimeX + 6, 396, 3, 3);
    }

    // 5. Crash Effect: Giant Headset Slam & 404 Glitch Blue Screen
    if (crashed) {
      const dropY = Math.min(260, (age * 1200) - 300);
      // Headset band
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 28;
      ctx.beginPath();
      ctx.arc(480, dropY, 150, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      // Massive earpieces
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(320, dropY - 20, 40, 70);
      ctx.fillRect(600, dropY - 20, 40, 70);
      // Drive-thru mic arm
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(330, dropY + 40);
      ctx.lineTo(390, dropY + 110);
      ctx.stroke();
      ctx.fillStyle = '#ff3344';
      ctx.beginPath();
      ctx.arc(395, 115 + dropY, 12, 0, Math.PI * 2);
      ctx.fill();

      // CRT Scanline / Blue 404 Glitch banner
      ctx.fillStyle = 'rgba(10, 40, 140, 0.78)';
      ctx.fillRect(120, 160, 720, 180);
      ctx.strokeStyle = COLOURS.frostyCyan;
      ctx.lineWidth = 4;
      ctx.strokeRect(120, 160, 720, 180);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px monospace';
      ctx.fillText('FATAL SERVER RESET: 404', 480, 210);
      ctx.fillStyle = COLOURS.frostyCyan;
      ctx.font = '700 20px monospace';
      ctx.fillText('SOFT-SERVE MACHINE DOWN · SOGGY COUPON ISSUED', 480, 260);
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '700 18px monospace';
      ctx.fillText('DUNGEON SAVE WIPED BY DRIVE-THRU SHUTDOWN', 480, 300);
    }

    // 6. HUD Header & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title
    ctx.fillStyle = COLOURS.fryGold;
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText('WENDYQUEST RUN', 480, 38);
    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('15-HOUR PIXEL DUNGEON · REDEEM SPICY NUGGET COMBO', 480, 64);

    // Multiplier readout
    const multiTint = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.fryGold;
    ctx.fillStyle = multiTint;
    ctx.font = `900 ${crashed ? 84 : 96}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 136);

    // Milestone / Quest Log Caption
    const milestoneEntry = MILESTONES[milestoneIndex - 1];
    const logText = running
      ? (milestoneEntry ? milestoneEntry[1] : 'Entering Kitchen Scullery...')
      : (crashed ? 'RUN OVER · KITCHEN CLOSED' : 'Awaiting Next Dungeon Run');

    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillText(logText, 480, 460);

    // Stake line / Cashout State
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 498);

    // Drive-thru neon arrow when running
    if (running && !cashed) {
      const blink = Math.sin(runTime * 8) > 0;
      ctx.fillStyle = blink ? COLOURS.frostyCyan : '#1c6dd0';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillText('>>> CASH OUT BEFORE THE HEADSET SLAMS <<<', 480, 192);
    }

    ctx.restore();
  }

  return { draw };
}
