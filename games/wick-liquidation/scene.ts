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
  bgDeep: '#0a0512',
  gridRed: '#3d0a1b',
  wickRed: '#ef233c',
  wickDark: '#8d0801',
  wickGlow: 'rgba(239, 35, 60, 0.4)',
  bullFur: '#2b2d42',
  bullSnout: '#ff9ebb',
  bullHorns: '#ffc857',
  surfboard: '#00f5d4',
  goldChute: '#ffd166',
  cashGreen: '#06d6a0',
  textLight: '#edf2f4',
  amberAlert: '#f77f00',
  alertMuted: '#9a8c98',
};

const MILESTONES: [number, string][] = [
  [120, 'Minor dip alerts chime softly'],
  [150, 'Stop losses trigger across the feed'],
  [200, 'Leverage warning flashes bright amber'],
  [250, 'Margin bots begin aggressive sweeps'],
  [300, 'One billion wiped ticker scrolls fast'],
  [500, 'Whales slam market sell buttons'],
  [1000, 'Order book depth completely drains'],
  [10000, 'Exchange servers report total gridlock'],
  [100000, 'Desks unplug ethernet cables in panic'],
  [1000000, 'Legendary negative wick defies physics'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;

  function drawBackground(ctx: CanvasRenderingContext2D, view: SceneView, tension: number): void {
    const t = view.elapsed * 0.001;
    // Cyber-synth dark gradient with cascading red panic glow
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, COLOURS.bgDeep);
    grad.addColorStop(0.7, '#140510');
    grad.addColorStop(1, view.phase === 'crashed' ? '#38000a' : '#1f030b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);

    // Dynamic grid scrolling downward as the candle drops
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(239, 35, 60, ${0.12 + 0.15 * tension})`;
    const offsetY = (t * (80 + 220 * tension)) % 40;
    for (let y = offsetY; y < 540; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }
    for (let x = 0; x < 960; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }

    // Mini chart depth background candles cascading downward
    const candleCount = 7;
    for (let i = 0; i < candleCount; i++) {
      const cx = 80 + i * 125;
      const stepT = t * 1.5 + i * 0.8;
      const cy = ((stepT * 60) % 600) - 60;
      const ch = 40 + Math.sin(stepT + i) * 25 + 20;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(239, 35, 60, 0.18)' : 'rgba(141, 8, 1, 0.15)';
      ctx.fillRect(cx - 14, cy, 28, ch);
      ctx.strokeStyle = 'rgba(239, 35, 60, 0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx, cy + ch + 16);
      ctx.stroke();
    }
  }

  function drawCandleAndRider(ctx: CanvasRenderingContext2D, view: SceneView, tension: number, depth: number): void {
    const t = view.elapsed * 0.001;
    const running = view.phase === 'running';
    const cashed = view.cashoutX100 !== null;
    const crashed = view.phase === 'crashed';
    const crashAgeSec = crashed ? view.crashAge * 0.001 : 0;

    // Surfing slope trajectory
    const candleTopY = 160 + Math.sin(t * 3) * 10;
    const candleBottomY = 460 + Math.cos(t * 2.5) * 8;
    const slopeX1 = 200;
    const slopeX2 = 740;

    // Main red monster candle body
    ctx.save();
    ctx.shadowColor = COLOURS.wickRed;
    ctx.shadowBlur = 15 + tension * 20;

    // Candle Wick Needle
    ctx.strokeStyle = COLOURS.wickRed;
    ctx.lineWidth = 4 + tension * 3;
    ctx.beginPath();
    ctx.moveTo(470, candleTopY - 70);
    ctx.lineTo(470, candleBottomY + 60);
    ctx.stroke();

    // Cascading red candle block
    const cGrad = ctx.createLinearGradient(slopeX1, candleTopY, slopeX2, candleBottomY);
    cGrad.addColorStop(0, COLOURS.wickRed);
    cGrad.addColorStop(0.5, '#d90429');
    cGrad.addColorStop(1, COLOURS.wickDark);
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.moveTo(slopeX1, candleTopY);
    ctx.lineTo(slopeX2, candleBottomY);
    ctx.lineTo(slopeX2 + 40, candleBottomY + 25);
    ctx.lineTo(slopeX1 + 40, candleTopY + 35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sparks / speed streaks off the candle edge
    if (running && !crashed) {
      ctx.strokeStyle = '#ffee88';
      ctx.lineWidth = 2;
      for (let s = 0; s < 5; s++) {
        const prog = ((t * 4 + s * 0.22) % 1);
        const sx = slopeX1 + (slopeX2 - slopeX1) * prog;
        const sy = candleTopY + (candleBottomY - candleTopY) * prog;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 24 - tension * 20, sy - 14 - tension * 12);
        ctx.stroke();
      }
    }

    // Surf deck and Bull protagonist coordinates along the falling wick
    const surfProgress = 0.55 + Math.sin(t * 4) * 0.12;
    let bullX = slopeX1 + (slopeX2 - slopeX1) * surfProgress;
    let bullY = candleTopY + (candleBottomY - candleTopY) * surfProgress;
    const boardAngle = Math.atan2(candleBottomY - candleTopY, slopeX2 - slopeX1) + Math.sin(t * 8) * 0.1;

    // Eject or Crash override
    let chuteDeploy = 0;
    if (cashed) {
      // Golden parachute escape floating up-right
      chuteDeploy = 1;
      bullX += Math.min(180, (view.elapsed * 0.05));
      bullY -= Math.min(140, (view.elapsed * 0.04));
    } else if (crashed) {
      // Flung off the candle by a massive margin hammer
      bullX += crashAgeSec * 220;
      bullY += crashAgeSec * 360 + 0.5 * 600 * crashAgeSec * crashAgeSec;
    }

    ctx.save();
    ctx.translate(bullX, bullY);
    ctx.rotate(cashed ? Math.sin(t * 3) * 0.08 : boardAngle);

    // If cashed out, draw tethered golden parachute
    if (cashed) {
      ctx.strokeStyle = '#ffb703';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-15, -15);
      ctx.lineTo(-40, -80);
      ctx.moveTo(15, -15);
      ctx.lineTo(40, -80);
      ctx.moveTo(0, -15);
      ctx.lineTo(0, -85);
      ctx.stroke();

      // Golden canopy
      ctx.fillStyle = COLOURS.goldChute;
      ctx.beginPath();
      ctx.arc(0, -85, 55, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fb8500';
      ctx.beginPath();
      ctx.arc(0, -85, 25, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();

      // Vault hammock / stablecoin bag
      ctx.fillStyle = COLOURS.cashGreen;
      ctx.beginPath();
      ctx.arc(15, 10, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('$', 12, 14);
    } else if (!crashed) {
      // Surfboard deck
      ctx.fillStyle = COLOURS.surfboard;
      ctx.shadowColor = COLOURS.surfboard;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 14, 38, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Fin
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(-28, 16, 7, 7);
    }

    // Bull Body
    ctx.fillStyle = COLOURS.bullFur;
    ctx.beginPath();
    ctx.roundRect(-22, -26, 42, 38, 8);
    ctx.fill();

    // Bull Snout
    ctx.fillStyle = COLOURS.bullSnout;
    ctx.beginPath();
    ctx.ellipse(14, -8, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nostrils
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(12, -7, 2, 0, Math.PI * 2);
    ctx.arc(18, -7, 2, 0, Math.PI * 2);
    ctx.fill();

    // Bull Horns (Golden curved)
    ctx.fillStyle = COLOURS.bullHorns;
    ctx.beginPath();
    ctx.moveTo(-12, -26);
    ctx.quadraticCurveTo(-24, -48, -4, -42);
    ctx.lineTo(-8, -26);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(4, -26);
    ctx.quadraticCurveTo(16, -48, 22, -38);
    ctx.lineTo(8, -26);
    ctx.fill();

    // Sunglasses (Cool Pixel Shades)
    ctx.fillStyle = '#111111';
    ctx.fillRect(-8, -22, 28, 9);
    ctx.fillStyle = '#00f5d4';
    ctx.fillRect(0, -21, 6, 2);
    ctx.fillRect(14, -21, 6, 2);

    ctx.restore();

    // Liquidation crash visual slam
    if (crashed) {
      const burst = clamp01(crashAgeSec / 0.6);
      // Giant spiked margin call wick slamming down
      ctx.save();
      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 14 * (1 - burst);
      ctx.beginPath();
      ctx.moveTo(480, 0);
      ctx.lineTo(480, 540);
      ctx.stroke();

      // Confetti receipts
      for (let p = 0; p < 24; p++) {
        const seed = p * 133.7;
        const rx = 480 + Math.sin(seed) * crashAgeSec * 350;
        const ry = 200 + Math.cos(seed) * crashAgeSec * 280 + crashAgeSec * crashAgeSec * 150;
        ctx.fillStyle = p % 2 === 0 ? '#ff4d6d' : '#f8f9fa';
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(seed + crashAgeSec * 6);
        ctx.fillRect(-6, -10, 12, 20);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function drawHUD(ctx: CanvasRenderingContext2D, view: SceneView, tension: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    // Top Header Banner
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '900 24px ui-monospace, monospace';
    ctx.fillText('⚡ WICK LIQUIDATION', 42, 52);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.alertMuted;
    ctx.fillText('LONG POSITION UNDER PRESSURE // SURF THE CASCADE', 44, 74);

    // Multiplier Readout Center-Right
    ctx.textAlign = 'right';
    const multColor = cashed ? COLOURS.cashGreen : (crashed ? COLOURS.wickRed : (tension > 0.6 ? COLOURS.amberAlert : COLOURS.surfboard));
    ctx.fillStyle = multColor;
    ctx.font = '900 78px ui-monospace, monospace';
    ctx.shadowColor = multColor;
    ctx.shadowBlur = running ? 12 : 4;
    ctx.fillText(formatX(view.currentX100), 918, 92);
    ctx.shadowBlur = 0;

    // Leverage Gauge bar at top right
    const gaugeW = 180;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(918 - gaugeW, 106, gaugeW, 8);
    ctx.fillStyle = tension > 0.7 ? '#ff0054' : '#ffb703';
    ctx.fillRect(918 - gaugeW, 106, gaugeW * tension, 8);

    // Dynamic Milestone alert ticker
    ctx.textAlign = 'center';
    const activeMilestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;
    const currentMilestone = activeMilestoneIndex > 0 ? MILESTONES[activeMilestoneIndex - 1] : undefined;
    const alertText = currentMilestone ? currentMilestone[1] : (running ? 'Cascade descending · Hold your balance' : (crashed ? 'MARGIN CALL EXECUTION TOTAL ZERO' : 'Waiting for next dip cycle'));

    ctx.fillStyle = crashed ? COLOURS.wickRed : (tension > 0.5 ? COLOURS.amberAlert : COLOURS.textLight);
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText(alertText.toUpperCase(), 480, 480);

    // Sub-line: Stake / Cashout status
    ctx.font = '600 16px system-ui, sans-serif';
    if (cashed) {
      ctx.fillStyle = COLOURS.cashGreen;
      ctx.fillText(`PARACHUTE DEPLOYED AT ${formatX(view.cashoutX100!)} · POSITION SECURED`, 480, 510);
    } else if (crashed) {
      ctx.fillStyle = '#ff758f';
      const stakeNote = view.stake !== null ? `LIQUIDATED ${credits(view.stake)} IN THE DROP` : 'WICK PIERCED THE FLOOR · NO CREDITS LOST';
      ctx.fillText(stakeNote, 480, 510);
    } else if (view.stake !== null) {
      ctx.fillStyle = COLOURS.surfboard;
      ctx.fillText(`SURFING WITH ${credits(view.stake)} · CASH OUT BEFORE THE SLAM`, 480, 510);
    } else {
      ctx.fillStyle = COLOURS.alertMuted;
      ctx.fillText('SPECTATING ORDER BOOK DEPTH · NO CREDITS COMMITTED', 480, 510);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';

    audio.update(view.phase, tension);

    const mCount = MILESTONES.filter(([x]) => view.currentX100 >= x).length;
    if (running && prevPhase === 'running' && mCount > prevMilestone) {
      audio.milestone(mCount);
      audio.fx('bell', 0.5 + 0.4 * tension);
    }
    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.8);
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = mCount;

    // Screen Shake on Crash or intense tension
    ctx.save();
    if (crashed) {
      const shakeAmt = 9 * clamp01(1 - (view.crashAge * 0.001) / 0.5);
      ctx.translate((Math.random() - 0.5) * shakeAmt * 2, (Math.random() - 0.5) * shakeAmt * 2);
    } else if (tension > 0.85) {
      const rumble = (tension - 0.85) * 6;
      ctx.translate((Math.random() - 0.5) * rumble, (Math.random() - 0.5) * rumble);
    }

    drawBackground(ctx, view, tension);
    drawCandleAndRider(ctx, view, tension, depth);
    drawHUD(ctx, view, tension);

    ctx.restore();
  }

  return { draw };
}
