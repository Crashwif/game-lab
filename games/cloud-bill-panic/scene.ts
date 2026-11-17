/**
 * Cloud Bill Panic - Scene implementation
 * Scale your serverless script before the finance team's credit card melts!
 */
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
  [120, 'First thousand requests ping without errors'],
  [150, 'Auto-scaling spins up three new regions'],
  [200, 'Free tier credits evaporate into thin air'],
  [250, 'Recursive loop spawns infinite microservices'],
  [300, 'Slack bot posts automated budget warnings'],
  [500, 'Data transfer egress outpaces municipal power'],
  [1000, 'Cloud support account manager calls your cell'],
  [10000, 'Company treasury converts equity to pay fees'],
  [100000, 'Datacenter turbines glow cherry red in orbit'],
  [1000000, 'Bill exceeds gross domestic product of small nations'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`KILLSWITCH TRIGGERED AT ${formatX(view.cashoutX100)} · BUDGET SAFE`, '#34d399'];
  }
  if (view.stake === null) {
    return [crashed ? 'Bill surged · you watched safely from sideline' : 'Observing cluster egress · no credits staked', '#94a3b8'];
  }
  if (crashed) {
    return [`CARD MELTED · Your ${credits(view.stake)} burned in the cluster`, '#f87171'];
  }
  return [`Cluster spinning · ${credits(view.stake)} on the line`, '#38bdf8'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastBeepSecond = 0;

  // Pre-seed pseudo sparks
  const sparks = Array.from({ length: 28 }, (_, i) => ({
    x: 0,
    y: 0,
    vx: (Math.random() - 0.5) * 160,
    vy: -Math.random() * 120 - 30,
    seed: i * 0.37,
  }));

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    // Audio triggers
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('zap', 0.9);
      audio.fx('clang', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('buzz', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneCount > previousMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('notify', 0.6);
      }
      const sec = Math.floor(view.elapsed / 450);
      if (sec !== lastBeepSecond && !cashed) {
        audio.fx('beep', 0.2 + tension * 0.5);
        lastBeepSecond = sec;
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneCount;

    // Shake on crash or high tension
    const crashSeconds = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const crashShake = crashed ? 14 * clamp01(1 - crashSeconds / 0.8) ** 2 : 0;
    const tensionJitter = running ? tension * (Math.sin(now * 0.04) * 2.5) : 0;
    const shakeX = crashShake * Math.sin(crashSeconds * 60) + tensionJitter;
    const shakeY = crashShake * Math.cos(crashSeconds * 48) + tensionJitter * 0.5;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Dark Datacenter Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.65, '#0d1527');
    bgGrad.addColorStop(1, '#050811');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, 1000, 580);

    // Perspective floor grid
    ctx.save();
    ctx.strokeStyle = crashed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1.5;
    for (let x = -100; x <= 1060; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 540);
      ctx.lineTo(480 + (x - 480) * 0.25, 340);
      ctx.stroke();
    }
    for (let y = 350; y <= 540; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Server Racks (Left & Right)
    const drawServerRack = (rx: number, isRight: boolean) => {
      ctx.fillStyle = '#111827';
      ctx.fillRect(rx, 90, 150, 380);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, 90, 150, 380);

      // Shelves with blinking activity LEDs
      for (let s = 0; s < 7; s++) {
        const sy = 105 + s * 50;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rx + 6, sy, 138, 42);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(rx + 6, sy, 138, 42);

        // Blinking LEDs
        for (let led = 0; led < 6; led++) {
          const blink = Math.sin(now * 0.008 + s * 1.7 + led * 2.3 + rx) > 0.1;
          const isOverheat = tension > 0.45 && (s + led) % 2 === 0;
          ctx.fillStyle = crashed
            ? '#ef4444'
            : isOverheat
            ? blink ? '#f97316' : '#ef4444'
            : blink ? '#22c55e' : '#0369a1';
          ctx.beginPath();
          ctx.arc(rx + 20 + led * 18, sy + 14, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Exhaust Fan
        const fanX = rx + (isRight ? 116 : 116);
        const fanY = sy + 22;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(fanX, fanY, 11, 0, Math.PI * 2);
        ctx.fill();

        // Spinning blades
        const spin = (now * (0.01 + tension * 0.04)) % (Math.PI * 2);
        ctx.strokeStyle = crashed ? '#dc2626' : '#94a3b8';
        ctx.lineWidth = 2.5;
        for (let b = 0; b < 3; b++) {
          const angle = spin + (b * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.moveTo(fanX, fanY);
          ctx.lineTo(fanX + Math.cos(angle) * 9, fanY + Math.sin(angle) * 9);
          ctx.stroke();
        }
      }
    };
    drawServerRack(30, false);
    drawServerRack(780, true);

    // Sparks when tension high or crashed
    if (tension > 0.3 || crashed) {
      ctx.fillStyle = '#fef08a';
      sparks.forEach((sp, idx) => {
        const t = ((now * 0.001 + sp.seed) % 1);
        const originX = idx % 2 === 0 ? 165 : 795;
        const originY = 220 + (idx % 6) * 35;
        const px = originX + sp.vx * t;
        const py = originY + sp.vy * t + 80 * t * t;
        const size = (1 - t) * 3;
        if (size > 0.5) {
          ctx.fillRect(px, py, size, size);
        }
      });
    }

    // 3. Central Console & Giant Ultra-wide Dashboard
    const monX = 220;
    const monY = 120;
    const monW = 520;
    const monH = 260;

    // Monitor Outer Bezel
    ctx.fillStyle = '#0b0f19';
    ctx.strokeStyle = crashed ? '#b91c1c' : '#334155';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(monX, monY, monW, monH, 14);
    ctx.fill();
    ctx.stroke();

    // Stand
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(455, monY + monH, 50, 40);
    ctx.fillRect(410, monY + monH + 36, 140, 10);

    // Screen display (AWS Console style cloud billing interface)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(monX + 8, monY + 8, monW - 16, monH - 16, 8);
    ctx.clip();

    ctx.fillStyle = '#030712';
    ctx.fillRect(monX + 8, monY + 8, monW - 16, monH - 16);

    // Cloud dashboard top bar
    ctx.fillStyle = '#111827';
    ctx.fillRect(monX + 8, monY + 8, monW - 16, 26);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('☁ AWS BILLING DASHBOARD // REGION: us-east-1 (OVERHEAT)', monX + 18, monY + 25);

    // Billing Graph Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let gx = monX + 30; gx < monX + monW - 20; gx += 50) {
      ctx.beginPath();
      ctx.moveTo(gx, monY + 36);
      ctx.lineTo(gx, monY + monH - 15);
      ctx.stroke();
    }
    for (let gy = monY + 50; gy < monY + monH - 20; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(monX + 15, gy);
      ctx.lineTo(monX + monW - 15, gy);
      ctx.stroke();
    }

    // Exponential Billing Curve on monitor
    const curvePoints: [number, number][] = [];
    const steps = 30;
    const startX = monX + 30;
    const endX = monX + monW - 40;
    const bottomY = monY + monH - 26;
    const topY = monY + 45;

    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const x = startX + frac * (endX - startX);
      const curveHeight = Math.pow(frac, 2.5 + depth * 1.5) * (tension * 0.95 + 0.05);
      const y = bottomY - curveHeight * (bottomY - topY);
      curvePoints.push([x, y]);
    }

    // Shaded area under graph
    ctx.beginPath();
    ctx.moveTo(startX, bottomY);
    curvePoints.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(endX, bottomY);
    ctx.closePath();
    const fillGlow = ctx.createLinearGradient(0, topY, 0, bottomY);
    fillGlow.addColorStop(0, crashed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(249, 115, 22, 0.35)');
    fillGlow.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
    ctx.fillStyle = fillGlow;
    ctx.fill();

    // Line itself
    ctx.beginPath();
    ctx.strokeStyle = crashed ? '#ef4444' : tension > 0.6 ? '#f97316' : '#38bdf8';
    ctx.lineWidth = 3.5;
    curvePoints.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();

    // Rocket / Flame needle at tip of curve
    const tip = curvePoints[curvePoints.length - 1];
    if (tip) {
      ctx.fillStyle = crashed ? '#ef4444' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(tip[0], tip[1], 5 + Math.sin(now * 0.02) * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bill Amount Ticker on dashboard
    const billSim = Math.floor(Math.pow(view.currentX100 / 100, 2.2) * 1420);
    ctx.fillStyle = crashed ? '#f87171' : '#facc15';
    ctx.font = '700 15px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`CURRENT BURNDOWN: $${billSim.toLocaleString('en-US')}.00`, monX + monW - 24, monY + 60);

    ctx.restore(); // end screen clip

    // 4. Desk, Ethernet Cord, & Panicked Dev Mascot
    const deskY = 410;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(200, deskY, 560, 24);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(210, deskY + 24, 540, 18);

    // Panicked Dev in chair
    const devX = 480;
    const devY = 425;
    const devBob = Math.sin(now * (0.01 + tension * 0.03)) * (4 + tension * 6);

    // Dev body
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(devX - 32, devY + 10, 64, 48, 12);
    ctx.fill();

    // Dev Head
    const headY = devY - 18 + devBob;
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.arc(devX, headY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Disheveled hair
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(devX, headY - 10, 26, Math.PI, Math.PI * 2);
    ctx.lineTo(devX + 28, headY - 4);
    ctx.lineTo(devX + 16, headY - 26);
    ctx.lineTo(devX - 6, headY - 32);
    ctx.lineTo(devX - 24, headY - 20);
    ctx.closePath();
    ctx.fill();

    // Face features
    if (cashed) {
      // Relieved face
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      // Happy closed eyes ^ ^
      ctx.beginPath();
      ctx.arc(devX - 10, headY - 2, 6, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(devX + 10, headY - 2, 6, Math.PI, 0);
      ctx.stroke();
      // Smile
      ctx.beginPath();
      ctx.arc(devX, headY + 8, 8, 0, Math.PI);
      ctx.stroke();
    } else if (crashed) {
      // KO / X eyes
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      const drawX = (ex: number) => {
        ctx.beginPath();
        ctx.moveTo(ex - 6, headY - 6);
        ctx.lineTo(ex + 6, headY + 6);
        ctx.moveTo(ex + 6, headY - 6);
        ctx.lineTo(ex - 6, headY + 6);
        ctx.stroke();
      };
      drawX(devX - 11);
      drawX(devX + 11);
      // Screaming O mouth
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.ellipse(devX, headY + 12, 9, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Panicked wide eyes vibrating
      const eyeWide = 7 + tension * 4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(devX - 11, headY - 2, eyeWide, 0, Math.PI * 2);
      ctx.arc(devX + 11, headY - 2, eyeWide, 0, Math.PI * 2);
      ctx.fill();
      // Tiny dilated pupils
      ctx.fillStyle = '#0f172a';
      const pupilJitter = (Math.random() - 0.5) * tension * 3;
      ctx.beginPath();
      ctx.arc(devX - 11 + pupilJitter, headY - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(devX + 11 + pupilJitter, headY - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Mouth agape
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.ellipse(devX, headY + 11, 7 + tension * 5, 5 + tension * 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sweat drops flying
      if (tension > 0.25) {
        ctx.fillStyle = '#38bdf8';
        const sweatY = headY - 14 + (now * 0.05) % 30;
        ctx.beginPath();
        ctx.arc(devX + 28, sweatY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ethernet Cord & Killswitch on Desk
    const cablePlugged = !cashed;
    const socketX = 350;
    const socketY = deskY + 10;
    // Jack socket
    ctx.fillStyle = '#475569';
    ctx.fillRect(socketX - 8, socketY - 8, 16, 16);

    // Cable path
    ctx.strokeStyle = cashed ? '#22c55e' : '#f43f5e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(devX - 25, devY + 28);
    if (cablePlugged) {
      ctx.quadraticCurveTo(390, deskY + 30, socketX, socketY);
      ctx.stroke();
    } else {
      // Disconnected cable in dev's hand!
      const handX = devX - 45;
      const handY = devY + 15;
      ctx.quadraticCurveTo(devX - 40, deskY + 40, handX, handY);
      ctx.stroke();
      // Sparks at socket
      ctx.fillStyle = '#a7f3d0';
      ctx.beginPath();
      ctx.arc(socketX, socketY, 5 + Math.sin(now * 0.03) * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Crashed State: CFO Webcam Overlay
    if (crashed) {
      const settle = clamp01(crashSeconds / 0.4);
      const cfoW = 210 * settle;
      const cfoH = 150 * settle;
      const cfoX = 690 - (cfoW - 210) / 2;
      const cfoY = 140;

      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(cfoX, cfoY, cfoW, cfoH, 10);
      ctx.fill();
      ctx.stroke();

      if (settle > 0.8) {
        // Webcam header
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(cfoX + 2, cfoY + 2, cfoW - 4, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🔴 CFO (INCOMING CALL)', cfoX + 10, cfoY + 17);

        // Stern CFO cartoon face
        const cx = cfoX + cfoW / 2;
        const cy = cfoY + 80;
        // Head
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.fill();
        // Angry eyebrows
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 16, cy - 14);
        ctx.lineTo(cx - 4, cy - 7);
        ctx.moveTo(cx + 16, cy - 14);
        ctx.lineTo(cx + 4, cy - 7);
        ctx.stroke();
        // Arms crossed
        ctx.fillStyle = '#334155';
        ctx.fillRect(cx - 38, cy + 28, 76, 26);

        // Declined stamp
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.font = '900 18px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(cx, cy + 20);
        ctx.rotate(-0.18);
        ctx.fillText('CARD DECLINED', 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    // 6. HUD Layer
    // Header Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 16px ui-monospace, monospace';
    ctx.fillText('CLOUD BILL PANIC // SERVERLESS RECURSION OVERLOAD', 480, 32);

    // Multiplier Display
    const multColor = crashed ? '#f87171' : cashed ? '#34d399' : '#f59e0b';
    ctx.fillStyle = multColor;
    const punch = crashed ? (1 - clamp01((crashSeconds - 0.1) / 0.3)) * 14 : 0;
    ctx.font = `900 ${76 + punch}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 80);

    // Milestone / Stage Caption
    const currentMilestone = running ? MILESTONES[milestoneCount - 1] : undefined;
    const captionText = currentMilestone
      ? currentMilestone[1]
      : view.phase === 'betting'
      ? 'READY TO SPIN UP CLUSTERS · PLACE STAKE'
      : view.phase === 'waiting'
      ? 'PROVISIONING INSTANCES...'
      : crashed
      ? 'QUOTA EXCEEDED · BOARD SUMMONED'
      : 'CLUSTER HEALTHY';

    ctx.fillStyle = crashed ? '#fca5a5' : '#cbd5e1';
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText(captionText, 480, 474);

    // Stake line / Cashout status banner
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 19px ui-monospace, monospace';
    ctx.fillText(line, 480, 510);

    ctx.restore();
  }

  return { draw };
}
