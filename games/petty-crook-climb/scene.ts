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

const PALETTE = {
  skyTop: '#0b0424',
  skyBottom: '#fd3a85',
  sun: '#ffe66d',
  gridCyan: '#00f5d4',
  neonPink: '#ff007f',
  neonPurple: '#7928ca',
  palmDark: '#12072b',
  roadDark: '#0a0817',
  goldCoin: '#ffd166',
  copBlue: '#00b4d8',
  copRed: '#ef233c',
  textLight: '#f7f9fb',
  textMuted: '#9aa5b8',
  cashGreen: '#06d6a0',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Pocketing scratch-off tickets from the counter'],
  [150, 'Prying loose change from a payphone booth'],
  [200, 'Hotwiring an idling delivery scooter'],
  [250, 'Smashing through a pawn shop display case'],
  [300, 'Bribing a parking enforcement cart driver'],
  [500, 'Cracking a motel floor safe with a crowbar'],
  [1000, 'Hijacking an armored strip-mall cash van'],
  [10000, 'Busting into a marina yacht charter vault'],
  [100000, 'Cruising the skyway in a twin-turbo hypercar'],
  [1000000, 'Buying out Vice City Hall with offshore duffels'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Peeling out in convertible @ ${formatX(view.cashoutX100)} · Hustle secured!`, PALETTE.cashGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Busted by Vice PD · spectators stay clean' : 'Scouting the register · no credits riding', PALETTE.textMuted];
  }
  if (crashed) return [`Cuffed & dragged · ${credits(view.stake)} seized as evidence`, PALETTE.copRed];
  return [`In the getaway hustle · ${credits(view.stake)} riding on the stash`, PALETTE.gridCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastEngineSfx = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('cheer', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.8);
      audio.fx('shatter', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('coin', 0.8);
      }
      if (now - lastEngineSfx > 1200 - tension * 800) {
        audio.fx('engine', 0.25 + 0.45 * tension);
        lastEngineSfx = now;
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * Math.exp(-crashAgeSec * 3) : 0;
    const shakeX = shake * Math.sin(crashAgeSec * 65);
    const shakeY = shake * Math.cos(crashAgeSec * 48);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Synthwave Vice Sunset Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, PALETTE.skyTop);
    skyGrad.addColorStop(0.65, PALETTE.neonPurple);
    skyGrad.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // 2. Neon Strip-Mall Skyline & Palm Silhouettes
    const sunPulse = 1 + 0.05 * Math.sin(now * 0.003);
    const sunGrad = ctx.createRadialGradient(480, 220, 20, 480, 220, 90 * sunPulse);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.3, PALETTE.sun);
    sunGrad.addColorStop(1, 'rgba(255, 58, 133, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(480, 220, 90 * sunPulse, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal sun laser blinds
    ctx.fillStyle = PALETTE.skyTop;
    for (let b = 0; b < 6; b++) {
      ctx.fillRect(390, 205 + b * 11, 180, 2 + b * 0.9);
    }

    // Distant Vice City skyline silhouettes
    ctx.fillStyle = '#180735';
    const cityOffsets = [40, 90, 150, 210, 280, 350, 420, 500, 580, 650, 720, 800, 870];
    const cityHeights = [60, 95, 45, 120, 70, 110, 85, 130, 75, 105, 60, 90, 115];
    cityOffsets.forEach((ox, i) => {
      const h = cityHeights[i] ?? 80;
      ctx.fillRect(ox - 30, 280 - h, 50, h);
      ctx.fillStyle = (i % 2 === 0) ? '#ff007f33' : '#00f5d433';
      ctx.fillRect(ox - 24, 290 - h, 10, 8);
      ctx.fillRect(ox - 8, 290 - h, 10, 8);
      ctx.fillStyle = '#180735';
    });

    // Palm tree silhouettes on roadside
    const drawPalm = (px: number, py: number, scale: number) => {
      ctx.fillStyle = PALETTE.palmDark;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 12 * scale, py - 40 * scale, px + 8 * scale, py - 90 * scale);
      ctx.lineTo(px + 3 * scale, py - 90 * scale);
      ctx.quadraticCurveTo(px + 7 * scale, py - 40 * scale, px - 4 * scale, py);
      ctx.fill();
      const headX = px + 6 * scale;
      const headY = py - 90 * scale;
      for (let f = -2; f <= 2; f++) {
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.quadraticCurveTo(headX + f * 24 * scale, headY - 14 * scale, headX + f * 38 * scale, headY + 12 * scale);
        ctx.stroke();
      }
    };
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.palmDark;
    drawPalm(110, 360, 1.2);
    drawPalm(850, 360, 1.3);

    // 3. Perspectives: Retro Neon Ocean Highway
    ctx.fillStyle = PALETTE.roadDark;
    ctx.fillRect(0, 320, 960, 220);

    // Speed road lines
    const speed = running ? (1200 + tension * 2600) : 350;
    const roadTime = (now * speed * 0.0006) % 60;
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.45)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 8; r++) {
      const y = 330 + ((r * 28 + roadTime) % 210);
      const alpha = clamp01((y - 330) / 180);
      ctx.strokeStyle = `rgba(0, 245, 212, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }
    // Road center dashes
    ctx.strokeStyle = '#ffe66d';
    ctx.lineWidth = 5;
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = -(now * speed * 0.001) % 60;
    ctx.beginPath();
    ctx.moveTo(480, 320);
    ctx.lineTo(480, 540);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Cop Cruiser in Pursuit (flashing sirens behind or alongside)
    const copFlash = Math.sin(now * 0.02) > 0;
    const copDist = 380 - tension * 130;
    // Red / blue spotlight beams sweep the highway
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.2 * tension;
    const sirenGrad = ctx.createRadialGradient(280, copDist, 20, 280, copDist + 60, 260);
    sirenGrad.addColorStop(0, copFlash ? PALETTE.copRed : PALETTE.copBlue);
    sirenGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sirenGrad;
    ctx.beginPath();
    ctx.arc(280, copDist + 40, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cop cruiser grill & roof bar
    ctx.fillStyle = '#111';
    ctx.fillRect(230, copDist - 15, 110, 42);
    ctx.fillStyle = copFlash ? PALETTE.copRed : PALETTE.copBlue;
    ctx.fillRect(250, copDist - 25, 30, 10);
    ctx.fillStyle = copFlash ? PALETTE.copBlue : PALETTE.copRed;
    ctx.fillRect(290, copDist - 25, 30, 10);

    // 5. The Rookie Crooks Getaway Machine (Upgrades with Depth / Multiplier)
    const carX = 520;
    const carY = 385 + (running ? Math.sin(now * 0.015) * (3 + tension * 4) : 0);
    const isHyperCar = depth > 0.55;
    const isCashed = view.cashoutX100 !== null;

    if (!crashed) {
      ctx.save();
      ctx.translate(carX, carY);

      // Exhaust flame when high tension
      if (tension > 0.35 || isCashed) {
        ctx.fillStyle = tension > 0.7 ? '#00f5d4' : '#ff7b00';
        const flameL = 25 + Math.random() * 25 * tension;
        ctx.beginPath();
        ctx.moveTo(-75, 20);
        ctx.lineTo(-75 - flameL, 25);
        ctx.lineTo(-75, 30);
        ctx.fill();
      }

      // Wheels
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.arc(-42, 28, 16, 0, Math.PI * 2);
      ctx.arc(46, 28, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.sun;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Vehicle Chassis (Smoking Sedan -> Stolen Convertible / Hypercar)
      ctx.fillStyle = isHyperCar ? '#ffe66d' : (isCashed ? '#ff007f' : '#2ec4b6');
      ctx.beginPath();
      ctx.roundRect(-70, -2, 140, 30, 8);
      ctx.fill();

      // Windshield & Cockpit
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(-20, -2);
      ctx.lineTo(2, -24);
      ctx.lineTo(34, -24);
      ctx.lineTo(46, -2);
      ctx.closePath();
      ctx.fill();

      // Protagonist 1: The Driver (Neon visor & bandana)
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(8, -16, 9, 0, Math.PI * 2); // head
      ctx.fill();
      ctx.fillStyle = '#0ff';
      ctx.fillRect(10, -18, 6, 4); // neon shades

      // Protagonist 2: Rookie Co-pilot frantic with grocery bag / duffel
      const copilotTilt = Math.sin(now * 0.02) * 5;
      ctx.save();
      ctx.translate(-24, -18);
      ctx.rotate((copilotTilt * Math.PI) / 180);
      // Head
      ctx.fillStyle = '#fb5607';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      // Neon band
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6, -4, 12, 3);
      // Plastic Grocery Bag / Duffel bursting with coins
      ctx.fillStyle = isHyperCar ? '#2a9d8f' : '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-14, 2, 14, 11, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Flying coins from the bag
      for (let c = 0; c < 3; c++) {
        const cx = -26 - ((now * 0.1 + c * 25) % 65);
        const cy = -8 - Math.sin(c + now * 0.01) * 15;
        ctx.fillStyle = PALETTE.goldCoin;
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Neon Undercar Glow
      ctx.shadowColor = isCashed ? PALETTE.cashGreen : PALETTE.neonPink;
      ctx.shadowBlur = 18;
      ctx.fillStyle = isCashed ? PALETTE.cashGreen : PALETTE.neonPink;
      ctx.fillRect(-60, 26, 120, 4);
      ctx.shadowBlur = 0;

      ctx.restore();
    } else {
      // 6. Crashed State: Blown moped/sedan into cheap flip-flop display rack!
      ctx.save();
      ctx.translate(carX, carY);
      // Wreckage smoke
      ctx.fillStyle = 'rgba(50, 40, 50, 0.6)';
      for (let p = 0; p < 5; p++) {
        const puff = (crashAgeSec * 40 + p * 15) % 80;
        ctx.beginPath();
        ctx.arc(-20 + p * 8, 10 - puff, 12 + puff * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Busted cart & scattered flip-flops
      ctx.fillStyle = '#ef233c';
      ctx.fillRect(-40, 10, 60, 16);
      // Flip-flops flying everywhere!
      const flops = ['#ff007f', '#00f5d4', '#ffe66d', '#8338ec', '#3a86ff'];
      flops.forEach((col, idx) => {
        const fx = -70 + idx * 32 + Math.sin(idx * 2) * 20;
        const fy = 20 - (idx % 2 === 0 ? 12 : -8);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 8, 4, 0.4 * idx, 0, Math.PI * 2);
        ctx.fill();
      });
      // Handcuffs icon & BUSTED stamp
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-10, -25, 12, 0, Math.PI * 2);
      ctx.arc(22, -25, 12, 0, Math.PI * 2);
      ctx.moveTo(2, -25);
      ctx.lineTo(10, -25);
      ctx.stroke();

      ctx.restore();
    }

    // 7. Cashout Freedom Celebration Overlay
    if (isCashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(6, 214, 160, 0.15)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.strokeStyle = PALETTE.cashGreen;
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, 928, 508);
      ctx.restore();
    }

    // 8. Main HUD Presentation
    // Title Banner
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.textLight;
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.shadowColor = PALETTE.neonPink;
    ctx.shadowBlur = 12;
    ctx.fillText('PETTY CROOK CLIMB', 480, 54);
    ctx.shadowBlur = 0;

    // Subtitle / Hustle status
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.sun;
    ctx.fillText('VICE CITY PD PURSUIT · LOOSE CHANGE TO HYPERCARS', 480, 88);

    // Huge Multiplier Readout
    const multColor = crashed ? PALETTE.copRed : (isCashed ? PALETTE.cashGreen : PALETTE.sun);
    ctx.fillStyle = multColor;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = running ? 20 : 6;
    ctx.font = '800 82px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 168);
    ctx.shadowBlur = 0;

    // Heat Level Gauge (Tension Bar)
    const barW = 320;
    const barH = 10;
    const barX = 480 - barW / 2;
    const barY = 222;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fill();

    const heatGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    heatGrad.addColorStop(0, PALETTE.gridCyan);
    heatGrad.addColorStop(0.5, PALETTE.sun);
    heatGrad.addColorStop(1, PALETTE.copRed);
    ctx.fillStyle = heatGrad;
    ctx.roundRect(barX, barY, barW * tension, barH, 5);
    ctx.fill();

    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.textLight;
    ctx.fillText(`VICE PD HEAT: ${Math.round(tension * 100)}%`, 480, 246);

    // Current Milestone / Hustle Action Callout
    const activeBeat = MILESTONES[milestoneIdx - 1];
    const beatText = crashed
      ? 'CRUSHED IN A RACK OF DISCOUNT FLIP-FLOPS!'
      : (activeBeat ? `CURRENT SCORE: ${activeBeat[1].toUpperCase()}` : 'SCOUTING CASH REGISTERS...');

    ctx.fillStyle = crashed ? PALETTE.copRed : (isCashed ? PALETTE.cashGreen : PALETTE.gridCyan);
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillText(beatText, 480, 460);

    // Stake line
    const [stLine, stCol] = stakeLine(view);
    ctx.fillStyle = stCol;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(stLine, 480, 498);

    ctx.restore();
  }

  return { draw };
}
