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
  bg: '#080d16',
  desk: '#141c2c',
  carpet: '#1d2338',
  consoleWhite: '#e9ecef',
  consoleGrill: '#1c1f26',
  xboxGreen: '#107c10',
  xboxRed: '#ff2233',
  neonPink: '#ff2a85',
  neonCyan: '#00f0ff',
  neonOrange: '#ff8800',
  cashedOut: '#2ee59d',
  crashed: '#ff3b56',
  text: '#f8fafc',
  muted: '#8da0b8',
};

const MILESTONES: [x100: number, caption: string, res: string][] = [
  [120, 'Crisp 1080p drops to a mild 900p blur', '900p Dynamic'],
  [150, 'Internal fan whines like an angry hair dryer', '810p Sub-native'],
  [200, '720p dynamic scaler kicks in with jagged curbs', '720p FSR-1'],
  [250, 'NPC faces reduce to blurry N64 texture smears', '540p Smear'],
  [300, 'Resolution locks at 480p CRT TV potato vision', '480p Potato'],
  [500, 'Xbox glowing logo flashes frantic emergency red', '360p Panic'],
  [1000, '240p Game Boy color palette engulfs the city', '240p GameBoy'],
  [10000, 'Text reduces to indecipherable alien runes', '144p Micro'],
  [100000, 'Fan blades shoot out the side ventilation hole', '72p Shards'],
  [1000000, 'One massive glorious pixel occupies the 4K panel', '1p True Art'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Unplugged at ${formatX(view.cashoutX100)} · Crisp frame preserved!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Watched chip melt · no credits lost' : 'Watching · Series S idling', COLOURS.muted];
  }
  if (crashed) return [`Console melted! ${credits(view.stake)} fried in smoke`, COLOURS.crashed];
  return [`Framerate on the line · ${credits(view.stake)} riding`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'scratch' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let fanTickCounter = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 4);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Audio triggers
    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('scratch', prevPhase === null || view.crashAge > 1200);
      audio.fx('zap', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('beep', 0.5 + 0.5 * tension);
      }
      fanTickCounter += 0.05 + tension * 0.25;
      if (fanTickCounter > 1.0) {
        fanTickCounter = 0;
        if (view.cashoutX100 === null) audio.fx('whir' as 'buzz', 0.15 + tension * 0.45);
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const crashShake = crashed ? 14 * clamp01(1 - crashSec / 0.6) ** 2 : 0;
    const consoleVibe = running ? (Math.sin(now * 0.08) * (1 + tension * 5)) : 0;

    ctx.save();
    // Screen shake
    const shakeX = (Math.sin(now * 0.07) * crashShake) + (running ? (Math.random() - 0.5) * tension * 3 : 0);
    const shakeY = (Math.cos(now * 0.09) * crashShake) + (running ? (Math.random() - 0.5) * tension * 3 : 0);
    ctx.translate(shakeX, shakeY);

    // 1. Room Background
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Desk and Carpet
    ctx.fillStyle = COLOURS.carpet;
    ctx.fillRect(0, 410, 960, 130);
    ctx.fillStyle = COLOURS.desk;
    ctx.fillRect(200, 370, 760, 50);

    // Carpet texture hatch
    ctx.strokeStyle = '#252e47';
    ctx.lineWidth = 1;
    for (let x = 0; x < 960; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 410);
      ctx.lineTo(x - 20, 540);
      ctx.stroke();
    }

    // 2. Ultrawide 4K Monitor Frame
    const monX = 230;
    const monY = 40;
    const monW = 690;
    const monH = 320;

    // Monitor Stand
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(monX + monW / 2 - 20, monY + monH, 40, 25);
    ctx.fillRect(monX + monW / 2 - 80, monY + monH + 20, 160, 10);

    // Bezel
    ctx.fillStyle = '#0f1420';
    ctx.beginPath();
    ctx.roundRect(monX, monY, monW, monH, 8);
    ctx.fill();
    ctx.strokeStyle = '#2b3954';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 3. Monitor Inner Display (The Vice City Downscaled Game!)
    const scrX = monX + 12;
    const scrY = monY + 12;
    const scrW = monW - 24;
    const scrH = monH - 24;

    ctx.save();
    ctx.beginPath();
    ctx.rect(scrX, scrY, scrW, scrH);
    ctx.clip();

    // Calculate downscaled pixel block size based on multiplier
    let blockSize = 1;
    if (view.currentX100 >= 1000000) blockSize = 240;
    else if (view.currentX100 >= 100000) blockSize = 72;
    else if (view.currentX100 >= 10000) blockSize = 48;
    else if (view.currentX100 >= 1000) blockSize = 28;
    else if (view.currentX100 >= 500) blockSize = 18;
    else if (view.currentX100 >= 300) blockSize = 10;
    else if (view.currentX100 >= 200) blockSize = 6;
    else if (view.currentX100 >= 150) blockSize = 3;
    else if (view.currentX100 >= 120) blockSize = 2;

    if (crashed) {
      // Green static death screen
      ctx.fillStyle = '#031405';
      ctx.fillRect(scrX, scrY, scrW, scrH);
      for (let gy = 0; gy < scrH; gy += 14) {
        for (let gx = 0; gx < scrW; gx += 14) {
          if (Math.random() > 0.4) {
            ctx.fillStyle = Math.random() > 0.7 ? '#22ff44' : '#0a5c18';
            ctx.fillRect(scrX + gx, scrY + gy, 12, 12);
          }
        }
      }
      ctx.fillStyle = '#10ff30';
      ctx.font = '900 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ FATAL: GPU DUMP FAILURE 0xDEADBEEF ]', scrX + scrW / 2, scrY + scrH / 2 - 10);
      ctx.font = '600 16px monospace';
      ctx.fillText('SOC TEMPERATURE EXCEEDED 115°C · POTATO STATE REACHED', scrX + scrW / 2, scrY + scrH / 2 + 22);
    } else {
      // Synthwave Vice City Scene rendered with quantized pixelation
      const sunY = scrY + 110;
      const horizonY = scrY + 160;

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, scrY, 0, horizonY);
      skyGrad.addColorStop(0, '#0c0728');
      skyGrad.addColorStop(0.6, '#461358');
      skyGrad.addColorStop(1, '#ff3864');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(scrX, scrY, scrW, scrH);

      // Neon Sun
      ctx.fillStyle = '#ffde59';
      ctx.beginPath();
      ctx.arc(scrX + scrW / 2, sunY, 52, 0, Math.PI * 2);
      ctx.fill();

      // Sun horizontal stripes
      ctx.fillStyle = '#461358';
      for (let s = 0; s < 5; s++) {
        ctx.fillRect(scrX + scrW / 2 - 55, sunY + 8 + s * 9, 110, 3 + s * 1.2);
      }

      // Skyline Buildings
      ctx.fillStyle = '#1a0b2e';
      const cityOffsets = [40, 110, 190, 270, 360, 440, 520, 600];
      cityOffsets.forEach((bx, idx) => {
        const bh = 45 + (idx * 37) % 55;
        ctx.fillRect(scrX + bx, horizonY - bh, 46, bh);
        // glowing window specks
        if (blockSize < 10) {
          ctx.fillStyle = (idx % 2 === 0) ? COLOURS.neonCyan : COLOURS.neonPink;
          ctx.fillRect(scrX + bx + 8, horizonY - bh + 10, 6, 8);
          ctx.fillRect(scrX + bx + 24, horizonY - bh + 25, 6, 8);
          ctx.fillStyle = '#1a0b2e';
        }
      });

      // Neon Grid Floor
      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, scrY + scrH);
      floorGrad.addColorStop(0, '#120422');
      floorGrad.addColorStop(1, '#05010a');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(scrX, horizonY, scrW, scrH - (horizonY - scrY));

      // Perspective grid lines
      ctx.strokeStyle = COLOURS.neonPink;
      ctx.lineWidth = 1.5;
      const speed = (now * (0.15 + tension * 0.4)) % 30;
      for (let gy = horizonY + speed; gy < scrY + scrH; gy += 24) {
        ctx.beginPath();
        ctx.moveTo(scrX, gy);
        ctx.lineTo(scrX + scrW, gy);
        ctx.stroke();
      }
      for (let gx = -120; gx <= scrW + 120; gx += 65) {
        ctx.beginPath();
        ctx.moveTo(scrX + scrW / 2, horizonY);
        ctx.lineTo(scrX + gx, scrY + scrH);
        ctx.stroke();
      }

      // Driving Sports Car (center screen)
      const carX = scrX + scrW / 2 + Math.sin(now * 0.005) * 40;
      const carY = scrY + scrH - 45;
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.fillRect(carX - 32, carY - 14, 64, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(carX - 18, carY - 24, 36, 11);
      // Red taillights
      ctx.fillStyle = '#ff1133';
      ctx.fillRect(carX - 30, carY - 8, 12, 6);
      ctx.fillRect(carX + 18, carY - 8, 12, 6);

      // Simulated dynamic downscaling overlay (mosaic grid)
      if (blockSize > 2) {
        const step = blockSize;
        ctx.fillStyle = 'rgba(10, 10, 20, 0.45)';
        for (let py = scrY; py < scrY + scrH; py += step) {
          ctx.fillRect(scrX, py, scrW, 1.2);
        }
        for (let px = scrX; px < scrX + scrW; px += step) {
          ctx.fillRect(px, scrY, 1.2, scrH);
        }
        // Palette crunch / smear
        if (view.currentX100 >= 1000) {
          ctx.fillStyle = 'rgba(155, 188, 15, 0.35)'; // GameBoy greenish overlay
          ctx.fillRect(scrX, scrY, scrW, scrH);
        }
      }

      // Scanlines CRT effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let sl = scrY; sl < scrY + scrH; sl += 4) {
        ctx.fillRect(scrX, sl, scrW, 1.5);
      }
    }

    // Monitor OSD Resolution Badge (top right of screen)
    const activeMilestone = MILESTONES[milestoneIdx - 1];
    const currentResBadge = activeMilestone ? activeMilestone[2] : '1080p Crisp 60fps';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.roundRect(scrX + scrW - 170, scrY + 12, 158, 28, 4);
    ctx.fill();
    ctx.strokeStyle = tension > 0.6 ? COLOURS.xboxRed : COLOURS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = tension > 0.6 ? COLOURS.xboxRed : COLOURS.text;
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`RES: ${currentResBadge}`, scrX + scrW - 20, scrY + 30);
    ctx.restore();

    // 4. Series S Console (Hero Protagonist) on the Carpet
    const consX = 90 + consoleVibe;
    const consY = 320 + (crashed ? 40 : 0);
    const consW = 85;
    const consH = 140;

    ctx.save();
    if (crashed) {
      // Fallen / toppled console
      ctx.translate(consX + 40, consY + 60);
      ctx.rotate(0.65);
      ctx.translate(-consX - 40, -consY - 60);
    }

    // Console shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(consX + 42, consY + consH + 6, 48, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // White Console Body
    ctx.fillStyle = crashed ? '#bdc3c7' : COLOURS.consoleWhite;
    ctx.beginPath();
    ctx.roundRect(consX, consY, consW, consH, 6);
    ctx.fill();
    ctx.strokeStyle = '#9aa2b0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Iconic Black Circular Fan Grill
    const grillX = consX + 42;
    const grillY = consY + 60;
    const grillRadius = 32;
    ctx.fillStyle = COLOURS.consoleGrill;
    ctx.beginPath();
    ctx.arc(grillX, grillY, grillRadius, 0, Math.PI * 2);
    ctx.fill();

    // Spinning Fan Blades Inside Grill
    ctx.save();
    ctx.beginPath();
    ctx.arc(grillX, grillY, grillRadius - 2, 0, Math.PI * 2);
    ctx.clip();
    const fanSpeed = running ? (now * (0.02 + tension * 0.15)) : 0;
    ctx.strokeStyle = tension > 0.6 ? '#552222' : '#333842';
    ctx.lineWidth = 4;
    for (let b = 0; b < 6; b++) {
      const angle = fanSpeed + (b * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(grillX, grillY);
      ctx.lineTo(grillX + Math.cos(angle) * grillRadius, grillY + Math.sin(angle) * grillRadius);
      ctx.stroke();
    }
    ctx.restore();

    // Glowing Power Button (Xbox Logo)
    const pwrX = consX + 42;
    const pwrY = consY + 120;
    let pwrColor = COLOURS.xboxGreen;
    if (crashed) pwrColor = '#444444';
    else if (tension > 0.5) pwrColor = Math.sin(now * 0.02) > 0 ? COLOURS.xboxRed : '#fff';

    ctx.fillStyle = pwrColor;
    ctx.shadowColor = pwrColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(pwrX, pwrY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Heat distortion / smoke clouds rising from grill
    if (running && tension > 0.2) {
      const smokeCount = Math.floor(tension * 6);
      ctx.fillStyle = `rgba(255, 80, 20, ${0.15 + tension * 0.3})`;
      for (let s = 0; s < smokeCount; s++) {
        const sy = grillY - 20 - ((now * 0.08 + s * 18) % 70);
        const sx = grillX + Math.sin(now * 0.01 + s) * (10 + s * 4);
        ctx.beginPath();
        ctx.arc(sx, sy, 8 + s * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (crashed) {
      // Black smoke puff
      ctx.fillStyle = 'rgba(40, 40, 40, 0.7)';
      for (let s = 0; s < 5; s++) {
        const sy = grillY - 15 - s * 16;
        const sx = grillX + Math.sin(s * 1.5) * 18;
        ctx.beginPath();
        ctx.arc(sx, sy, 14 + s * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HDMI Cable running from console back toward monitor
    ctx.strokeStyle = view.cashoutX100 !== null ? '#555' : '#111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(consX + consW - 8, consY + 90);
    if (view.cashoutX100 !== null) {
      // Unplugged loose dangling cable!
      ctx.bezierCurveTo(consX + 110, consY + 110, consX + 120, consY + 160, consX + 105, consY + 175);
    } else {
      ctx.bezierCurveTo(consX + 110, consY + 110, monX - 30, monY + monH, monX + 40, monY + monH - 10);
    }
    ctx.stroke();

    ctx.restore();

    // 5. Cashout Framed Still Frame celebration popup
    if (view.cashoutX100 !== null) {
      const popW = 340;
      const popH = 90;
      const popX = 960 / 2 - popW / 2;
      const popY = 170;
      ctx.fillStyle = 'rgba(8, 20, 16, 0.94)';
      ctx.beginPath();
      ctx.roundRect(popX, popY, popW, popH, 12);
      ctx.fill();
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓ HDMI UNPLUGGED SAFELY!', 960 / 2, popY + 34);
      ctx.fillStyle = COLOURS.text;
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText(`Frame Locked at Pristine ${formatX(view.cashoutX100)}`, 960 / 2, popY + 62);
    }

    // 6. Main Center Top HUD Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Multiplier Text (Big & Punchy)
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.text);
    ctx.fillStyle = multColor;
    ctx.font = '800 78px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), scrX + scrW / 2, scrY + 70);

    // Game Title & Subtitle Badge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(scrX + 14, scrY + 14, 250, 48, 6);
    ctx.fill();
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SERIES S DOWNSCALE', scrX + 26, scrY + 32);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(`THERMAL LOAD: ${(tension * 100).toFixed(0)}% · DEPTH ${(depth * 10).toFixed(1)}`, scrX + 26, scrY + 50);

    // Milestone Caption Bar (Lower Screen)
    const caption = activeMilestone ? activeMilestone[1] : (running ? 'Vice City running at silky 1080p' : 'Prepare for dynamic downscaling');
    ctx.fillStyle = 'rgba(6, 10, 18, 0.88)';
    ctx.roundRect(scrX + 40, scrY + scrH - 52, scrW - 80, 38, 6);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.crashed : (tension > 0.5 ? COLOURS.neonOrange : '#26344d');
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(crashed ? 'FATAL ERROR: Chip melted into a polygon potato' : caption, scrX + scrW / 2, scrY + scrH - 33);

    // Bottom Stake Line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 505);

    ctx.restore();
  }

  return { draw };
}
