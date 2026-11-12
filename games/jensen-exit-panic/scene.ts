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
  [120, 'Jensen unzips collar as board stares in shock'],
  [150, 'Server rack indicator LEDs flicker nervous red'],
  [200, 'Pre-market ticker ticks down three whole percent'],
  [250, 'CFO begins furiously drafting press statement'],
  [300, 'Spike in datacenter cooling fan rpm drowns audio'],
  [500, 'Wall Street analysts start panic live streaming'],
  [1000, 'Interim CEO candidate is handed the mic'],
  [10000, 'H100 chips spontaneously start minting dogcoins'],
  [100000, 'Silicon Valley power grid drops half voltage'],
  [1000000, 'Jacket attains sentience and takes over Nasdaq'],
];

const COLOURS = {
  bgTop: '#090d16',
  bgBottom: '#04060a',
  leather: '#18181c',
  leatherHighlight: '#2c2d35',
  zipper: '#c0c5cf',
  neonGreen: '#76b900',
  laserCyan: '#00e5ff',
  dangerRed: '#ff2d55',
  gold: '#ffd13b',
  text: '#f3f6fc',
  muted: '#8b9bb4',
  cardBg: 'rgba(12, 17, 28, 0.85)',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`Secured RSU Exit at ${formatX(view.cashoutX100)} · Golden Golf Cart Escaped!`, COLOURS.gold];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Observed board panic · 0 credits lost' : 'Spectating board meeting · No credits riding', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Margin call wiped ${credits(view.stake)} · 10% Pre-Market Drop`, COLOURS.dangerRed];
  }
  return [`Unvested RSUs: ${credits(view.stake)} riding on Jensen's jacket`, COLOURS.neonGreen];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let prevStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const milestoneCount = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    audio.update(view.phase, tension);

    if (running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('engine', 0.8);
      audio.fx('kaching', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.8);
    }
    if (running && prevPhase === 'running') {
      if (milestoneCount > prevMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('beep', 0.6 + 0.4 * tension);
      }
      const step = Math.floor(view.elapsed / 260);
      if (step > prevStep && !cashedOut) {
        audio.fx('ratchet', 0.25 + 0.45 * tension);
        prevStep = step;
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneCount;

    // Shake & Crash Dynamics
    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.75) ** 2 : (running ? tension * 1.8 : 0);
    const shakeX = shake * Math.sin(view.elapsed * 0.05);
    const shakeY = shake * Math.cos(view.elapsed * 0.07);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Boardroom Background & City Skyline
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, COLOURS.bgTop);
    grad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);

    // Skyline windows behind boardroom
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 9; i++) {
      const bx = 60 + i * 95;
      const bh = 140 + ((i * 37) % 90);
      ctx.fillRect(bx, 280 - bh, 70, bh);
      // Window lights
      ctx.fillStyle = (i + Math.floor(view.elapsed / 400)) % 3 === 0 ? '#1e293b' : '#334155';
      for (let wy = 300 - bh + 10; wy < 270; wy += 22) {
        ctx.fillRect(bx + 12, wy, 16, 10);
        ctx.fillRect(bx + 42, wy, 16, 10);
      }
      ctx.fillStyle = '#0f172a';
    }

    // Boardroom floor with perspective
    ctx.fillStyle = '#080a10';
    ctx.beginPath();
    ctx.moveTo(0, 310);
    ctx.lineTo(960, 310);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.fill();

    // Perspective floor lines
    ctx.strokeStyle = crashed ? 'rgba(255, 45, 85, 0.25)' : 'rgba(0, 229, 255, 0.15)';
    ctx.lineWidth = 1.5;
    for (let x = -200; x <= 1160; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 310);
      ctx.lineTo(480 + (x - 480) * 2.2, 540);
      ctx.stroke();
    }

    // 2. Server Racks (Left & Right Flanks)
    const rackGlow = crashed ? COLOURS.dangerRed : (tension > 0.4 ? '#ff9500' : COLOURS.neonGreen);
    [-1, 1].forEach((side) => {
      const rx = side === -1 ? 40 : 810;
      ctx.fillStyle = '#111520';
      ctx.fillRect(rx, 140, 110, 240);
      ctx.strokeStyle = '#22293a';
      ctx.strokeRect(rx, 140, 110, 240);

      // Server blades and LEDs
      for (let s = 0; s < 7; s++) {
        const sy = 152 + s * 30;
        ctx.fillStyle = '#191f2e';
        ctx.fillRect(rx + 8, sy, 94, 24);
        // Blinking LEDs
        const blink = Math.sin(view.elapsed * 0.015 + s * 1.5) > 0;
        ctx.fillStyle = blink ? rackGlow : '#252e42';
        ctx.beginPath();
        ctx.arc(rx + 20, sy + 12, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Server fans spinning
        const fanAngle = view.elapsed * (0.01 + tension * 0.04);
        ctx.save();
        ctx.translate(rx + 85, sy + 12);
        ctx.rotate(fanAngle);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 3. Central Character: Jensen & Leather Jacket OR Gold Golf Cart
    const centerX = 480;
    const centerY = 310;
    const bob = running || crashed ? Math.sin(view.elapsed * 0.008) * (3 + tension * 6) : 0;

    if (cashedOut) {
      // ESCAPE STATE: Jensen speeding away in Golden Golf Cart!
      const cartX = Math.min(centerX + 60 + view.elapsed * 0.15, 780);
      ctx.save();
      ctx.translate(cartX, centerY + 20);

      // Golden Golf Cart Body
      ctx.fillStyle = COLOURS.gold;
      ctx.beginPath();
      ctx.roundRect(-80, -35, 120, 45, [10, 18, 5, 5]);
      ctx.fill();
      ctx.strokeStyle = '#e0a800';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Canopy & Poles
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-60, -35);
      ctx.lineTo(-50, -80);
      ctx.moveTo(25, -35);
      ctx.lineTo(15, -80);
      ctx.stroke();
      // Canopy roof
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-70, -85, 110, 10);

      // Wheels
      [-50, 20].forEach((wx) => {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(wx, 15, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLOURS.gold;
        ctx.beginPath();
        ctx.arc(wx, 15, 7, 0, Math.PI * 2);
        ctx.fill();
      });

      // Jensen smiling in cart
      ctx.fillStyle = COLOURS.leather;
      ctx.beginPath();
      ctx.arc(-20, -50, 16, 0, Math.PI * 2); // Head/hair
      ctx.fill();
      ctx.fillStyle = '#fbd4b4';
      ctx.beginPath();
      ctx.arc(-20, -48, 13, 0, Math.PI * 2); // Face
      ctx.fill();
      // Sunglasses
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-26, -52, 16, 6);
      // Grin
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-18, -42, 5, 0, Math.PI);
      ctx.stroke();

      // Golden Trophy / RSUs in back
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.font = 'bold 22px system-ui';
      ctx.fillText('RSU $$', -75, -45);
      ctx.restore();

      // Exit sign door glow
      ctx.fillStyle = 'rgba(118, 185, 0, 0.2)';
      ctx.fillRect(830, 190, 100, 140);
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('RUN TO LIMO ➔', 880, 210);
    } else {
      // IN-ROUND / PROTAGONIST: Jensen wearing iconic leather coat
      ctx.save();
      ctx.translate(centerX, centerY + bob);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 75, 65 + tension * 10, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Jacket Torso (Deep textured black leather)
      ctx.fillStyle = COLOURS.leather;
      ctx.beginPath();
      ctx.moveTo(-50, -40);
      ctx.lineTo(50, -40);
      ctx.lineTo(60, 60);
      ctx.lineTo(-60, 60);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLOURS.leatherHighlight;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Leather collar lapels
      ctx.fillStyle = '#222329';
      ctx.beginPath();
      ctx.moveTo(-50, -40);
      ctx.lineTo(-20, 5);
      ctx.lineTo(-10, -35);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(50, -40);
      ctx.lineTo(20, 5);
      ctx.lineTo(10, -35);
      ctx.fill();

      // The iconic Zipper: unzips further down as tension mounts!
      const unzipAmount = crashed ? 75 : tension * 65;
      ctx.strokeStyle = COLOURS.zipper;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.lineTo(0, -30 + unzipAmount);
      ctx.stroke();

      // Exposed chest / Green GPU circuit underneath jacket as it unzips
      if (unzipAmount > 12) {
        ctx.fillStyle = '#062810';
        ctx.beginPath();
        ctx.moveTo(0, -30 + unzipAmount);
        ctx.lineTo(-unzipAmount * 0.45, -35);
        ctx.lineTo(unzipAmount * 0.45, -35);
        ctx.closePath();
        ctx.fill();

        // Glowing silicon traces underneath
        ctx.strokeStyle = crashed ? COLOURS.dangerRed : COLOURS.neonGreen;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -30 + unzipAmount);
        ctx.lineTo(0, -35);
        ctx.moveTo(-6, -20);
        ctx.lineTo(6, -20);
        ctx.stroke();
      }

      // Zipper pull-tab
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-4, -34 + unzipAmount, 8, 12);

      // Arms & Wafer in hand
      ctx.fillStyle = COLOURS.leather;
      // Left arm holding silicon wafer
      ctx.beginPath();
      ctx.roundRect(-75, -25, 26, 65, 8);
      ctx.fill();
      // Right arm
      ctx.beginPath();
      ctx.roundRect(49, -25, 26, 65, 8);
      ctx.fill();

      // Silicon Wafer (Held in hand)
      const waferAngle = Math.sin(view.elapsed * 0.005) * 0.15;
      ctx.save();
      ctx.translate(-75, 40);
      ctx.rotate(waferAngle);
      const waferGrad = ctx.createLinearGradient(-25, -25, 25, 25);
      waferGrad.addColorStop(0, '#00e5ff');
      waferGrad.addColorStop(0.5, '#76b900');
      waferGrad.addColorStop(1, '#a855f7');
      ctx.fillStyle = waferGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Grid lines on wafer
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.moveTo(0, -20);
      ctx.lineTo(0, 20);
      ctx.stroke();
      ctx.restore();

      // Jensen Head & Hair
      // Silver hair
      ctx.fillStyle = '#c7cbd6';
      ctx.beginPath();
      ctx.arc(0, -74, 30, Math.PI, Math.PI * 2);
      ctx.fill();
      // Head base
      ctx.fillStyle = '#fcd9bd';
      ctx.beginPath();
      ctx.arc(0, -66, 25, 0, Math.PI * 2);
      ctx.fill();
      // Silver swept hair sides
      ctx.fillStyle = '#b0b6c6';
      ctx.beginPath();
      ctx.arc(-22, -72, 9, 0, Math.PI * 2);
      ctx.arc(22, -72, 9, 0, Math.PI * 2);
      ctx.fill();

      // Glasses (Signature black framed rim glasses)
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeRect(-18, -72, 14, 11);
      ctx.strokeRect(4, -72, 14, 11);
      ctx.beginPath();
      ctx.moveTo(-4, -67);
      ctx.lineTo(4, -67);
      ctx.stroke();

      // Eyes (look panicked as tension rises)
      ctx.fillStyle = '#1e293b';
      const eyeOffset = tension > 0.4 ? Math.sin(view.elapsed * 0.02) * 2 : 0;
      ctx.beginPath();
      ctx.arc(-11 + eyeOffset, -66, 2.5, 0, Math.PI * 2);
      ctx.arc(11 + eyeOffset, -66, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Nervous mouth
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (tension < 0.3) {
        ctx.arc(0, -56, 5, 0.2, Math.PI - 0.2); // Cool smirk
      } else {
        const wiggle = Math.sin(view.elapsed * 0.04) * 3;
        ctx.moveTo(-7, -54 + wiggle);
        ctx.lineTo(7, -54 - wiggle); // Nervous wavy mouth
      }
      ctx.stroke();

      // Flying sweat drops when tension is high
      if (tension > 0.35 && !crashed) {
        ctx.fillStyle = '#67e8f9';
        const sweatY = -85 + ((view.elapsed * 0.08) % 40);
        ctx.beginPath();
        ctx.arc(28, sweatY, 3, 0, Math.PI * 2);
        ctx.arc(-30, sweatY + 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 4. Crash Visuals: Shattered glass & Margin Call faxes floating down
    if (crashed) {
      // Glass crack lines across boardroom window
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(480, 260);
      ctx.lineTo(320, 110);
      ctx.lineTo(210, 80);
      ctx.moveTo(480, 260);
      ctx.lineTo(670, 130);
      ctx.lineTo(820, 95);
      ctx.moveTo(480, 260);
      ctx.lineTo(510, 420);
      ctx.moveTo(480, 260);
      ctx.lineTo(390, 360);
      ctx.stroke();

      // Red siren alarm strobe
      const strobe = Math.sin(crashAgeSec * 16) > 0 ? 0.25 : 0.05;
      ctx.fillStyle = `rgba(255, 45, 85, ${strobe})`;
      ctx.fillRect(0, 0, 960, 540);

      // Margin call fax papers tumbling
      ctx.fillStyle = '#ffffff';
      for (let p = 0; p < 18; p++) {
        const px = ((p * 57 + crashAgeSec * 140) % 920) + 20;
        const py = ((p * 83 + crashAgeSec * 280) % 480) + 30;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((p * 1.3) + crashAgeSec * 2);
        ctx.fillRect(-12, -16, 24, 32);
        ctx.fillStyle = COLOURS.dangerRed;
        ctx.font = 'bold 7px monospace';
        ctx.fillText('MARGIN', -10, -5);
        ctx.fillText('CALL', -8, 5);
        ctx.fillStyle = '#ffffff';
        ctx.restore();
      }
    }

    // 5. Boardroom Ticker Tape at bottom
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 508, 960, 32);
    ctx.strokeStyle = crashed ? COLOURS.dangerRed : COLOURS.laserCyan;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 508, 960, 32);

    const tickerOffset = (view.elapsed * 0.08) % 480;
    ctx.fillStyle = crashed ? COLOURS.dangerRed : COLOURS.neonGreen;
    ctx.font = '600 13px ui-monospace, monospace';
    const tickerText = crashed
      ? '🚨 NASDAQ ALERT: PRE-MARKET STOCK PLUMMETS -10.4% · CFO DRAFTING APOLOGY · EMERGENCY BOARD CONVENED ·'
      : '📈 NV-AI: $148.20 (+4.8%) · H100 DEMAND CRITICAL · RSU VEST SCHEDULE: ACCELERATING · BOARD ROOM SECURE ·';
    ctx.fillText(tickerText, 480 - tickerOffset, 529);
    ctx.fillText(tickerText, 960 - tickerOffset, 529);

    // 6. HUD & Multiplier Display
    // Top Banner
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText('JENSEN EXIT PANIC', 480, 42);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('UNZIP THE LEATHER JACKET · CASH OUT BEFORE THE BOARD REVOLTS', 480, 64);

    // Main Multiplier Readout Card
    const cardY = 112;
    ctx.fillStyle = COLOURS.cardBg;
    ctx.beginPath();
    ctx.roundRect(320, cardY - 32, 320, 68, 14);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.dangerRed : (cashedOut ? COLOURS.gold : COLOURS.neonGreen);
    ctx.lineWidth = 2;
    ctx.stroke();

    const multColor = crashed ? COLOURS.dangerRed : (cashedOut ? COLOURS.gold : (running ? COLOURS.laserCyan : COLOURS.text));
    ctx.fillStyle = multColor;
    const pulse = running ? 1 + 0.04 * Math.sin(view.elapsed * 0.012) : 1;
    ctx.font = `800 ${Math.floor(46 * pulse)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, cardY + 12);

    // Milestone / Status Caption
    const milestoneInfo = running ? MILESTONES[milestoneCount - 1] : undefined;
    const currentCaption = milestoneInfo ? milestoneInfo[1] : (crashed ? '💥 GPU BOARD REVOLT: JACKET FLUNG OPEN!' : 'Awaiting Next Board Meeting...');
    ctx.fillStyle = crashed ? COLOURS.dangerRed : (cashedOut ? COLOURS.gold : '#cbd5e1');
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(currentCaption, 480, 440);

    // Stake / Escape Line
    const [statusLine, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(statusLine, 480, 480);

    ctx.restore();
  }

  return { draw };
}
