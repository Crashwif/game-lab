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
  [120, 'Odometer hits 1,000 miles on a grocery run'],
  [150, 'Tires begin smoking at constant 107 MPH'],
  [200, 'Trip computer claims you circled Earth once'],
  [250, 'Toll booth cameras snap fiery blur photo'],
  [300, 'Excess mileage surcharge ticker passes $1,000'],
  [500, 'Engine oil boils into pure adrenaline vapor'],
  [1000, 'Rental counter phone buzzes with red alert'],
  [10000, 'Dashboard speedo spins backwards into orbit'],
  [100000, 'Odometer rolls past 18,000 miles in 4 days'],
  [1000000, 'Car achieves escape velocity past airport parking'],
];

const COLOURS = {
  sky: '#0b132b',
  ground: '#1c2541',
  road: '#151922',
  yellowStripe: '#fbc02d',
  silverCar: '#cbd5e1',
  silverShadow: '#64748b',
  glass: '#38bdf8',
  receiptPaper: '#f8fafc',
  surchargeRed: '#ef4444',
  mintGreen: '#34d399',
  hudBg: 'rgba(15, 23, 42, 0.82)',
  hudBorder: '#334155',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastOdoTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 4);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;
    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('whoosh', 0.8);
      }
      const odoTickTime = Math.floor(view.elapsed / Math.max(35, 200 - tension * 170));
      if (odoTickTime > lastOdoTick) {
        audio.fx('tick', 0.25 + 0.5 * tension);
        lastOdoTick = odoTickTime;
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.7) : running ? (2 + 6 * tension) : 0;
    const shakeX = shake ? (Math.sin(now * 0.09) * 0.7 + Math.cos(now * 0.15) * 0.3) * shake : 0;
    const shakeY = shake ? (Math.cos(now * 0.08) * 0.7 + Math.sin(now * 0.14) * 0.3) * shake : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Sky & Speed Gradients
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 320);
    skyGrad.addColorStop(0, depth > 0.4 ? '#2e1065' : COLOURS.sky);
    skyGrad.addColorStop(1, depth > 0.4 ? '#4c1d95' : COLOURS.ground);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-20, -20, 1000, 340);

    // Distant airport runway lights / neon billboards
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-20, 220, 1000, 80);
    for (let i = 0; i < 9; i++) {
      const bx = ((i * 120 - (view.elapsed * (0.15 + tension * 0.4))) % 1080) - 60;
      ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#334155';
      ctx.fillRect(bx, 200 - (i % 3) * 15, 70, 100);
      // Billboard neon signs
      if (i % 3 === 1) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = '700 9px ui-monospace, monospace';
        ctx.fillText('HERTZ DROP-OFF', bx + 6, 215);
      }
    }

    // Speed streaks in upper sky
    if (running || crashed) {
      const speedLines = 8 + Math.floor(tension * 16);
      ctx.strokeStyle = `rgba(147, 197, 253, ${0.15 + 0.4 * tension})`;
      ctx.lineWidth = 1.5;
      for (let s = 0; s < speedLines; s++) {
        const lx = ((s * 93 + now * (1.2 + tension * 2)) % 1000) - 40;
        const ly = 30 + (s * 33) % 170;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - 50 - tension * 80, ly);
        ctx.stroke();
      }
    }

    // 2. Highway road surface with perspective dash markings
    const roadGrad = ctx.createLinearGradient(0, 270, 0, 540);
    roadGrad.addColorStop(0, '#0f172a');
    roadGrad.addColorStop(1, COLOURS.road);
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, 270, 960, 270);

    // Shoulder lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.lineTo(960, 320);
    ctx.stroke();

    // Road dashed stripes zooming past
    const dashSpeed = running ? (0.6 + tension * 1.8) : crashed ? 0 : 0.2;
    const dashOffset = (view.elapsed * dashSpeed) % 140;
    ctx.strokeStyle = COLOURS.yellowStripe;
    ctx.lineWidth = 5;
    ctx.setLineDash([50, 40]);
    ctx.lineDashOffset = -dashOffset;
    ctx.beginPath();
    ctx.moveTo(-100, 420);
    ctx.lineTo(1060, 420);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Receipt Ticker-Tape flapping out the exhaust
    const carX = cashedOut ? 560 : 440;
    const carBounce = running ? Math.sin(now * 0.04) * (2 + tension * 4) : 0;
    const carY = 360 + (crashed ? 10 : carBounce);

    // Draw receipt stream behind car
    const tapeSegments = 16;
    ctx.fillStyle = COLOURS.receiptPaper;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(carX - 85, carY + 32);
    for (let t = 0; t < tapeSegments; t++) {
      const rx = carX - 85 - t * 24;
      const wave = Math.sin(now * 0.02 + t * 0.7) * (6 + t * 3 * tension);
      const ry = carY + 30 + wave + t * 1.5;
      ctx.lineTo(rx, ry);
    }
    for (let t = tapeSegments - 1; t >= 0; t--) {
      const rx = carX - 85 - t * 24;
      const wave = Math.sin(now * 0.02 + t * 0.7) * (6 + t * 3 * tension);
      const ry = carY + 44 + wave + t * 1.5;
      ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Micro text on the flapping receipt
    ctx.fillStyle = COLOURS.surchargeRed;
    ctx.font = '700 8px ui-monospace, monospace';
    for (let t = 1; t < 5; t++) {
      const rx = carX - 90 - t * 45;
      const ry = carY + 38 + Math.sin(now * 0.02 + t * 1.2) * 8;
      ctx.fillText(`$$$ SURCHARGE $${(view.currentX100 * 2.4).toFixed(0)}`, rx, ry);
    }

    // Exhaust smoke / sparks
    if (running || crashed) {
      const smokeCount = crashed ? 18 : 6 + Math.floor(tension * 10);
      for (let p = 0; p < smokeCount; p++) {
        const pAge = (now * 0.003 + p * 0.17) % 1;
        const px = carX - 90 - pAge * (90 + tension * 120);
        const py = carY + 34 - pAge * 35 + Math.sin(p) * 12;
        const pr = 4 + pAge * 22;
        ctx.fillStyle = crashed
          ? `rgba(${220 + p * 2}, ${60 + p * 10}, 20, ${0.7 - pAge * 0.7})`
          : `rgba(200, 210, 225, ${0.6 - pAge * 0.6})`;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Protagonist: Rental Hatchback Sedan
    ctx.save();
    ctx.translate(carX, carY);
    if (cashedOut) {
      ctx.rotate(-0.06); // graceful drift angle
    } else if (crashed) {
      ctx.rotate(Math.min(0.2, crashSec * 0.5));
    }

    // Car shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 48, 105, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Car body gradient (Bruised silver rental compact)
    const bodyGrad = ctx.createLinearGradient(-90, -30, 90, 40);
    bodyGrad.addColorStop(0, COLOURS.silverCar);
    bodyGrad.addColorStop(0.5, '#94a3b8');
    bodyGrad.addColorStop(1, COLOURS.silverShadow);

    // Main chassis
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-90, 36);
    ctx.lineTo(95, 36);
    ctx.lineTo(92, 18);
    ctx.lineTo(75, 12);
    ctx.lineTo(35, -2);
    ctx.lineTo(-25, -2);
    ctx.lineTo(-65, 12);
    ctx.lineTo(-88, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hatchback cabin / windows
    ctx.fillStyle = COLOURS.glass;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(32, 0);
    ctx.lineTo(65, 14);
    ctx.lineTo(-45, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    // Rental agency barcode sticker on driver door
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-15, 20, 22, 12);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-12, 22, 3, 8);
    ctx.fillRect(-7, 22, 2, 8);
    ctx.fillRect(-3, 22, 4, 8);
    ctx.fillRect(3, 22, 2, 8);

    // Rental bumper dent / scratches
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 22);
    ctx.lineTo(84, 28);
    ctx.lineTo(80, 34);
    ctx.stroke();

    // Headlight glow
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(90, 22);
    ctx.lineTo(95, 25);
    ctx.lineTo(92, 32);
    ctx.closePath();
    ctx.fill();

    // Spinning Wheels
    const drawWheel = (wx: number) => {
      ctx.save();
      ctx.translate(wx, 38);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      // Hubcap spokes rotation
      const wheelRot = view.elapsed * 0.03 * (1 + tension * 3);
      ctx.rotate(running ? wheelRot : 0);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      for (let s = 0; s < 4; s++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(s * Math.PI * 0.5) * 8, Math.sin(s * Math.PI * 0.5) * 8);
        ctx.stroke();
      }
      ctx.restore();
    };
    drawWheel(-55);
    drawWheel(60);

    ctx.restore();

    // 5. Huge Comic Odometer Dial / HUD
    ctx.save();
    ctx.translate(480, 115);

    // Odometer mechanical housing
    ctx.fillStyle = COLOURS.hudBg;
    ctx.strokeStyle = COLOURS.hudBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-240, -68, 480, 136, 16);
    ctx.fill();
    ctx.stroke();

    // Rolling odometer digits tumbler box
    ctx.fillStyle = '#020617';
    ctx.fillRect(-220, 2, 440, 52);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-220, 2, 440, 52);

    // Tumbler reels (Simulated 6-digit broken spinning odometer)
    const mileageNum = Math.floor(view.currentX100 * 18.23 + view.elapsed * 0.12);
    const mileageStr = mileageNum.toString().padStart(6, '0').slice(-6);

    for (let d = 0; d < 6; d++) {
      const rx = -200 + d * 48;
      const isLast = d === 5;
      ctx.fillStyle = isLast ? '#991b1b' : '#0f172a';
      ctx.fillRect(rx, 6, 42, 44);
      ctx.fillStyle = isLast ? '#fee2e2' : '#f8fafc';
      ctx.font = '700 32px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Subtle spinning jitter
      const rollJitter = running ? (Math.sin(now * 0.05 + d) * 2 * tension) : 0;
      ctx.fillText(mileageStr[d] ?? '0', rx + 21, 28 + rollJitter);
    }

    // Top Multiplier readout
    const punch = crashed ? (1 - clamp01((crashSec - 0.1) / 0.25)) * 0.35 : 0;
    ctx.font = `900 ${52 * (1 + punch)}px ui-monospace, monospace`;
    ctx.fillStyle = cashedOut ? COLOURS.mintGreen : crashed ? COLOURS.surchargeRed : '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatX(view.currentX100), 0, -32);

    // Micro badge
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('ODOMETER TOTAL MILES', 120, 30);
    ctx.restore();

    // 6. Header Game Titles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('ODOMETER OVERDRIVE', 480, 14);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('RENTAL CAR SOUND-BARRIER ESCAPE', 480, 42);

    // 7. Milestone Banner & Action Status
    const passedMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const statusText = passedMilestone ? passedMilestone[1] : (
      view.phase === 'betting' ? 'RENTAL HATCHBACK READY AT THE CURB' :
      view.phase === 'waiting' ? 'WAITING FOR ENGINE CRANK' :
      cashedOut ? 'SLID CLEAN INTO AIRPORT RETURN LANE!' :
      'SPEEDOMETER SHATTERED · EXCESS MILEAGE IMPOSED'
    );

    ctx.fillStyle = cashedOut ? COLOURS.mintGreen : crashed ? '#fca5a5' : '#cbd5e1';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, 480, 460);

    // Stake line
    let stakeMsg = 'Watching · zero credits riding';
    let stakeCol = '#94a3b8';
    if (view.cashoutX100 !== null) {
      stakeMsg = `Cashed out at ${formatX(view.cashoutX100)} · zero-mile dispute signed!`;
      stakeCol = COLOURS.mintGreen;
    } else if (view.stake !== null) {
      if (crashed) {
        stakeMsg = `Billed! Your ${credits(view.stake)} lost to mileage penalties`;
        stakeCol = COLOURS.surchargeRed;
      } else {
        stakeMsg = `Floor it! ${credits(view.stake)} currently riding`;
        stakeCol = '#38bdf8';
      }
    }
    ctx.fillStyle = stakeCol;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(stakeMsg, 480, 492);

    // 8. Dramatic Overlays for Cashout & Crash
    if (cashedOut) {
      // Golden / Green VIP drop-off stamp
      ctx.save();
      ctx.translate(480, 250);
      ctx.rotate(-0.08);
      ctx.strokeStyle = COLOURS.mintGreen;
      ctx.lineWidth = 5;
      ctx.strokeRect(-210, -32, 420, 64);
      ctx.fillStyle = 'rgba(6, 78, 59, 0.88)';
      ctx.fillRect(-210, -32, 420, 64);
      ctx.fillStyle = '#a7f3d0';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KEYS RETURNED · 0.0 MILE DISPUTE APPROVED', 0, 0);
      ctx.restore();
    } else if (crashed) {
      // Infuriated Hertz agent giant invoice overlay
      const stampPop = Math.min(1, crashSec * 4);
      ctx.save();
      ctx.translate(480, 255);
      ctx.scale(stampPop, stampPop);
      ctx.rotate(0.05);

      ctx.fillStyle = 'rgba(254, 242, 242, 0.95)';
      ctx.strokeStyle = COLOURS.surchargeRed;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(-240, -60, 480, 120, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLOURS.surchargeRed;
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HERTZ AUDIT: $948,220 PENALTY', 0, -22);

      ctx.font = '700 15px ui-monospace, monospace';
      ctx.fillStyle = '#7f1d1d';
      ctx.fillText('SPEED RECORD VOIDED · ENGINE CRACKED', 0, 12);
      ctx.fillText('DESK AGENT FLAGGED RENTAL AGREEMENT', 0, 34);
      ctx.restore();
    }

    ctx.restore();
  }

  return { draw };
}
