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
  [120, 'Romantic candle lit over steaming soup dumplings'],
  [150, 'Microchip blueprint slid under the soy sauce dish'],
  [200, 'CEO adjusts leather lapel while winking smoothly'],
  [250, 'Black sedans idle suspiciously outside the bistro'],
  [300, 'Spy hands over a flash drive wrapped in a napkin'],
  [500, 'Green laser pointers focus onto the tablecloth'],
  [1000, 'Secret service ear-pieces buzz from kitchen doors'],
  [10000, 'Diplomatic immunity forged documents stamped fast'],
  [100000, 'Helicopter searchlights circle the rooftop patio'],
  [1000000, 'Intercontinental server rack delivered to table'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastBeatTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('whoosh', 0.85);
      audio.fx('kaching', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('shatter', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('zap', 0.6);
      }
      const beatInterval = Math.max(160, 480 - tension * 300);
      if (now - lastBeatTick > beatInterval && !cashed) {
        lastBeatTick = now;
        audio.fx('tick', 0.25 + 0.5 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.6) ** 2 : (tension * 2.5 * Math.sin(now * 0.03));

    ctx.save();
    ctx.translate(shake * Math.sin(crashSec * 60 + now * 0.02), shake * Math.cos(crashSec * 45));

    // Moody Dim Sum Bistro Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#0c0a17');
    bgGrad.addColorStop(0.5, '#160f26');
    bgGrad.addColorStop(1, '#080511');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Rainy Bistro Window with Neon Reflections
    ctx.fillStyle = 'rgba(20, 28, 48, 0.7)';
    ctx.fillRect(280, 40, 400, 150);
    ctx.strokeStyle = '#221935';
    ctx.lineWidth = 4;
    ctx.strokeRect(280, 40, 400, 150);

    // Window blinds & rain streaks
    ctx.fillStyle = 'rgba(8, 12, 22, 0.45)';
    for (let by = 48; by < 185; by += 16) {
      ctx.fillRect(284, by, 392, 4);
    }
    // Suspicious black sedan lights outside in rain
    const sedanAlpha = clamp01(0.2 + depth * 0.8);
    ctx.fillStyle = `rgba(255, 60, 90, ${sedanAlpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(360, 130, 14, 0, Math.PI * 2);
    ctx.arc(430, 130, 14, 0, Math.PI * 2);
    ctx.fill();

    // Helicopter searchlight sweep
    if (depth > 0.4 || crashed) {
      const sweepX = 480 + Math.sin(now * 0.002) * 220;
      const spotGrad = ctx.createRadialGradient(sweepX, 110, 10, sweepX, 110, 120);
      spotGrad.addColorStop(0, 'rgba(120, 240, 255, 0.35)');
      spotGrad.addColorStop(1, 'rgba(120, 240, 255, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(280, 40, 400, 150);
    }

    // Plush Bistro Booth & Velvet Curtains
    ctx.fillStyle = '#420b1f';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(160, 0); ctx.lineTo(120, 420); ctx.lineTo(0, 440); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(960, 0); ctx.lineTo(800, 0); ctx.lineTo(840, 420); ctx.lineTo(960, 440); ctx.closePath();
    ctx.fill();

    // Tabletop
    const tableGrad = ctx.createLinearGradient(0, 310, 0, 540);
    tableGrad.addColorStop(0, '#1c151b');
    tableGrad.addColorStop(0.3, '#2a1a24');
    tableGrad.addColorStop(1, '#110c12');
    ctx.fillStyle = tableGrad;
    ctx.beginPath();
    ctx.ellipse(480, 430, 420, 140, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bamboo Dim Sum Steamer Basket in Table Center
    ctx.fillStyle = '#9e6e42';
    ctx.beginPath();
    ctx.ellipse(480, 395, 84, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b88353';
    ctx.beginPath();
    ctx.ellipse(480, 388, 80, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soup Dumplings (Xiao Long Bao)
    const dumplingCoords = [[460, 384], [480, 392], [502, 384]];
    dumplingCoords.forEach(([dx, dy]) => {
      ctx.fillStyle = '#fdf8ea';
      ctx.beginPath();
      ctx.arc(dx, dy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8d2b2';
      ctx.beginPath();
      ctx.arc(dx, dy - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Confidential Glowing GPU AI Wafer slid under soy dish
    const waferPulse = Math.sin(now * 0.008) * 0.3 + 0.7;
    ctx.save();
    ctx.translate(430, 428);
    ctx.rotate(-0.15);
    ctx.fillStyle = `rgba(0, 255, 190, ${0.4 * waferPulse})`;
    ctx.fillRect(-35, -20, 70, 40);
    ctx.strokeStyle = '#00ffc8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-35, -20, 70, 40);
    // Microchip grid lines
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.7)';
    ctx.beginPath();
    ctx.moveTo(-35, 0); ctx.lineTo(35, 0);
    ctx.moveTo(0, -20); ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();

    // Candle and romantic/tense flicker
    const candleFlicker = (Math.sin(now * 0.02) + Math.cos(now * 0.053)) * (3 + tension * 7);
    ctx.fillStyle = '#eee4d0';
    ctx.fillRect(525, 335, 14, 45);
    // Candle flame glow
    const flameGrad = ctx.createRadialGradient(532 + candleFlicker * 0.3, 324, 2, 532, 324, 28 + tension * 20);
    flameGrad.addColorStop(0, '#fff4b8');
    flameGrad.addColorStop(0.3, '#ff9922');
    flameGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.arc(532, 324, 32 + tension * 20, 0, Math.PI * 2);
    ctx.fill();

    // Stacks of Briefcases (escalates with tension)
    const briefcaseCount = Math.min(4, Math.floor(tension * 5));
    for (let i = 0; i < briefcaseCount; i++) {
      ctx.fillStyle = '#2d2d34';
      ctx.fillRect(170, 380 - i * 22, 70, 18);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(200, 386 - i * 22, 10, 6);
    }

    // Steaming vapor rising from dumplings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 2;
    for (let s = 0; s < 3; s++) {
      const steamOffset = ((now * 0.07 + s * 35) % 80);
      ctx.beginPath();
      ctx.moveTo(465 + s * 16, 375 - steamOffset);
      ctx.quadraticCurveTo(475 + s * 16 + Math.sin(steamOffset * 0.1) * 8, 355 - steamOffset, 465 + s * 16, 335 - steamOffset);
      ctx.stroke();
    }

    // CHARACTERS:
    // Left: Smug CEO in Black Leather Jacket
    const ceoX = 220;
    const ceoY = 280;
    // Leather jacket torso & popped collar
    ctx.fillStyle = '#111317';
    ctx.beginPath();
    ctx.moveTo(ceoX - 70, ceoY + 120);
    ctx.lineTo(ceoX - 45, ceoY + 30);
    ctx.lineTo(ceoX, ceoY + 45);
    ctx.lineTo(ceoX + 50, ceoY + 35);
    ctx.lineTo(ceoX + 75, ceoY + 120);
    ctx.closePath();
    ctx.fill();
    // Shiny leather sheen
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Popped lapels
    ctx.fillStyle = '#1d212a';
    ctx.beginPath();
    ctx.moveTo(ceoX - 18, ceoY + 42); ctx.lineTo(ceoX - 35, ceoY + 12); ctx.lineTo(ceoX - 8, ceoY + 35); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ceoX + 18, ceoY + 42); ctx.lineTo(ceoX + 35, ceoY + 12); ctx.lineTo(ceoX + 8, ceoY + 35); ctx.fill();
    // Head & hair
    ctx.fillStyle = '#dfaf8e';
    ctx.beginPath();
    ctx.arc(ceoX, ceoY - 10, 28, 0, Math.PI * 2);
    ctx.fill();
    // Slicked dark tech hair
    ctx.fillStyle = '#1a1924';
    ctx.beginPath();
    ctx.ellipse(ceoX - 2, ceoY - 26, 30, 18, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Smug sunglasses / smirk
    ctx.fillStyle = '#05070a';
    ctx.fillRect(ceoX - 18, ceoY - 14, 38, 11);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ceoX - 18, ceoY - 14, 38, 11);
    // Smirk
    ctx.strokeStyle = '#5c3328';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ceoX + 4, ceoY + 7, 7, 0.1, Math.PI * 0.7);
    ctx.stroke();

    // Right: Glamorous Spy with Chopsticks
    const spyX = 740;
    const spyY = 280;
    // Elegant evening gown
    ctx.fillStyle = '#67001f';
    ctx.beginPath();
    ctx.moveTo(spyX - 60, spyY + 120);
    ctx.lineTo(spyX - 35, spyY + 35);
    ctx.lineTo(spyX, spyY + 45);
    ctx.lineTo(spyX + 40, spyY + 35);
    ctx.lineTo(spyX + 65, spyY + 120);
    ctx.closePath();
    ctx.fill();
    // Head & chic updo hair
    ctx.fillStyle = '#e8ba99';
    ctx.beginPath();
    ctx.arc(spyX, spyY - 12, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f0e14';
    ctx.beginPath();
    ctx.ellipse(spyX + 4, spyY - 24, 28, 20, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(spyX + 16, spyY - 34, 14, 0, Math.PI * 2);
    ctx.fill();
    // Spy sunglasses & subtle red lips
    ctx.fillStyle = '#120f18';
    ctx.beginPath();
    ctx.ellipse(spyX - 8, spyY - 13, 10, 6, -0.1, 0, Math.PI * 2);
    ctx.ellipse(spyX + 12, spyY - 13, 10, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d90429';
    ctx.fillRect(spyX - 4, spyY + 6, 9, 3);
    // Chopsticks in hand
    ctx.strokeStyle = '#e0a96d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(spyX - 45, spyY + 45);
    ctx.lineTo(spyX - 110, spyY + 75);
    ctx.moveTo(spyX - 45, spyY + 48);
    ctx.lineTo(spyX - 105, spyY + 85);
    ctx.stroke();

    // Laser sight dots dancing across the tablecloth & CEO
    if (tension > 0.25 && !crashed) {
      const laserCount = 1 + Math.floor(tension * 5);
      for (let l = 0; l < laserCount; l++) {
        const lx = 320 + Math.sin(now * 0.003 + l * 1.7) * 220;
        const ly = 320 + Math.cos(now * 0.004 + l * 2.1) * 90;
        ctx.fillStyle = l % 2 === 0 ? '#ff0055' : '#00ff66';
        ctx.beginPath();
        ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(l % 2 === 0 ? 0 : 960, 40 + l * 30);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // CRASHED OVERLAY: Skylight breach, flashbang, handcuffs
    if (crashed) {
      // Flashbang whiteout fading
      const flashAlpha = clamp01(1 - crashSec / 0.7);
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.85})`;
        ctx.fillRect(0, 0, 960, 540);
      }
      // Red emergency strobe
      const strobe = Math.sin(crashSec * 25) > 0 ? 0.35 : 0.08;
      ctx.fillStyle = `rgba(255, 0, 50, ${strobe})`;
      ctx.fillRect(0, 0, 960, 540);

      // Glass shards from skylight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      for (let g = 0; g < 14; g++) {
        const gx = 480 + Math.cos(g * 0.9) * (g * 24 + crashSec * 140);
        const gy = 180 + Math.sin(g * 1.3) * (g * 18 + crashSec * 160);
        ctx.beginPath();
        ctx.moveTo(gx - 10, gy); ctx.lineTo(gx + 8, gy - 6); ctx.lineTo(gx + 4, gy + 10); ctx.closePath();
        ctx.stroke();
      }

      // Handcuffs clamped onto table
      ctx.strokeStyle = '#c0c5ce';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(440, 420, 22, 0, Math.PI * 2);
      ctx.arc(520, 420, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(462, 420); ctx.lineTo(498, 420);
      ctx.stroke();

      // Exploding microphone wires from soup dumplings
      ctx.strokeStyle = '#38ef7d';
      ctx.lineWidth = 2;
      for (let w = 0; w < 6; w++) {
        ctx.beginPath();
        ctx.moveTo(480, 390);
        ctx.lineTo(440 + Math.cos(w + crashSec * 5) * 60, 360 + Math.sin(w) * 45);
        ctx.stroke();
      }
    }

    // CASHOUT CELEBRATION: Titanium card dropped, unmarked EV escape
    if (cashed) {
      // Sleek EV Speeding Away Silhouette in the window
      ctx.fillStyle = 'rgba(0, 255, 170, 0.2)';
      ctx.fillRect(280, 40, 400, 150);
      // Titanium Credit Card spun on table
      ctx.save();
      ctx.translate(480, 450);
      ctx.rotate(0.3);
      ctx.fillStyle = '#dcdde1';
      ctx.fillRect(-45, -25, 90, 50);
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(-45, -15, 90, 10);
      ctx.fillStyle = '#f5cd79';
      ctx.fillRect(15, 5, 18, 12);
      ctx.restore();
    }

    // HUD & MULTIPLIER DISPLAY
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title Badge
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText('LEATHER SPY DATE', 480, 36);

    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillStyle = '#a6b4ca';
    ctx.fillText('TRADE GPU SECRETS BEFORE THE FEDS BREACH', 480, 56);

    // Huge Multiplier readout
    const multColor = crashed ? '#ff4d6d' : (cashed ? '#38ef7d' : '#f9c74f');
    ctx.fillStyle = multColor;
    ctx.font = `800 ${crashed ? 86 : 80}px ui-monospace, monospace`;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 16;
    ctx.fillText(formatX(view.currentX100), 480, 118);
    ctx.shadowBlur = 0;

    // Milestone / Phase status
    const currentMilestoneText = running
      ? (MILESTONES[milestone - 1]?.[1] ?? 'Awaiting first drop...')
      : (crashed ? 'FEDS BREACHED THE DINING ROOM!' : (cashed ? 'TITANIUM CARD FLIPPED · CEO EV ESCAPED' : 'Order dim sum to begin'));
    
    ctx.fillStyle = '#f8f9fa';
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText(currentMilestoneText, 480, 172);

    // Stake line footer
    let stakeText = 'Watching · no credits riding';
    let stakeCol = '#a6b4ca';
    if (view.cashoutX100 !== null) {
      stakeText = `Cashed out at ${formatX(view.cashoutX100)} · Alleyway EV waiting!`;
      stakeCol = '#38ef7d';
    } else if (view.stake !== null) {
      if (crashed) {
        stakeText = `Feds seized your ${credits(view.stake)}`;
        stakeCol = '#ff4d6d';
      } else {
        stakeText = `GPU deal in play · ${credits(view.stake)} riding`;
        stakeCol = '#ffd166';
      }
    } else if (crashed) {
      stakeText = 'Raid concluded · no credits lost';
      stakeCol = '#a6b4ca';
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(200, 498, 560, 34);
    ctx.strokeStyle = stakeCol;
    ctx.lineWidth = 1;
    ctx.strokeRect(200, 498, 560, 34);

    ctx.fillStyle = stakeCol;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(stakeText, 480, 515);

    ctx.restore();
  }

  return { draw };
}
