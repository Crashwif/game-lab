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
  [120, 'Venture fund drops first wire transfer'],
  [150, 'Glowing holographic charts flash green neon'],
  [200, 'Server fans spin into a mini tornado'],
  [250, 'Analyst upgrades price target to outer space'],
  [300, 'Liquid nitrogen tank begins hissing aggressively'],
  [500, 'STAR50 index blows through stadium ceiling'],
  [1000, 'Stack reaches stratosphere on pure VC hype'],
  [10000, 'Traders throw Rolexes into motherboard'],
  [100000, 'Market cap surpasses global GDP'],
  [1000000, 'Pure algorithmic godhood achieved'],
];

const COLOURS = {
  bgTop: '#070514',
  bgBottom: '#180928',
  grid: '#00ffcc22',
  neonGreen: '#39ff14',
  neonCyan: '#00ffff',
  neonPink: '#ff007f',
  serverDark: '#121424',
  serverPlate: '#1f243d',
  gold: '#ffd700',
  crashed: '#ff3b5c',
  text: '#ffffff',
  muted: '#8b9bb4',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`Secured bag at ${formatX(view.cashoutX100)} · Zipped off with gold racks!`, COLOURS.neonGreen];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Grid blown · Spectating the wipeout' : 'Standing on trading floor · Spectating', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Vaporized! ${credits(view.stake)} drowned in melted silicon`, COLOURS.crashed];
  }
  return [`Riding the stack · ${credits(view.stake)} in the furnace`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let nextFxTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 4);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('airhorn', 0.5 + 0.3 * tension);
      }
      if (now > nextFxTick && !cashedOut) {
        audio.fx(tension > 0.6 ? 'hiss' : 'buzz', 0.2 + 0.5 * tension);
        nextFxTick = now + Math.max(350, 1600 - tension * 1200);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashAgeSec / 0.8) ** 2 : (running ? Math.sin(now * 0.04) * tension * 3.5 : 0);

    ctx.save();
    // Backdrop gradient & city synth grid
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    if (shake !== 0) {
      ctx.translate(shake * Math.sin(crashAgeSec * 60 + now * 0.05), shake * Math.cos(crashAgeSec * 45));
    }

    // Holographic retro perspective grid
    ctx.strokeStyle = crashed ? 'rgba(255, 59, 92, 0.25)' : COLOURS.grid;
    ctx.lineWidth = 1.5;
    const horizon = 320;
    const gridOffset = (view.elapsed * (0.08 + tension * 0.25)) % 40;
    for (let x = -200; x <= 1160; x += 60) {
      ctx.beginPath();
      ctx.moveTo(480 + (x - 480) * 0.15, horizon);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = horizon; y <= 540; y += 22) {
      const py = y + (gridOffset * (y - horizon)) / 220;
      if (py > horizon && py < 540) {
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(960, py);
        ctx.stroke();
      }
    }

    // Sky clouds / neon chart lines climbing
    ctx.strokeStyle = crashed ? 'rgba(255,0,80,0.3)' : 'rgba(57, 255, 20, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const cx = (i / 20) * 960;
      const cy = horizon - 40 - Math.sin(i * 0.5 + now * 0.003) * 25 - (tension * 80 * (i / 20));
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Floating server stack tower
    const towerX = 480;
    const towerBaseY = 470;
    const totalRacks = 9;
    const leanAngle = running ? Math.sin(now * 0.006) * (0.04 + tension * 0.12) : 0;
    const rackHeight = 22;
    const rackWidth = 84;

    ctx.save();
    ctx.translate(towerX, towerBaseY);

    if (crashed) {
      // Snapped server stack
      const snapProgress = clamp01(crashAgeSec * 2.2);
      ctx.fillStyle = '#ff2244';
      // Lower broken base
      ctx.fillRect(-rackWidth / 2, -rackHeight * 3, rackWidth, rackHeight * 3);
      // Top section tumbling off
      ctx.save();
      ctx.translate(20 * snapProgress, -rackHeight * 3);
      ctx.rotate(snapProgress * 0.9);
      ctx.fillStyle = '#440f1a';
      ctx.fillRect(-rackWidth / 2, -rackHeight * 5, rackWidth, rackHeight * 5);
      // Pink slips & burning chips flying
      for (let p = 0; p < 16; p++) {
        const px = Math.sin(p * 2 + crashAgeSec * 5) * (40 + p * 18);
        const py = -rackHeight * 4 + crashAgeSec * 160 + Math.cos(p) * 60;
        ctx.fillStyle = p % 2 === 0 ? '#ff80a0' : '#ffd700';
        ctx.fillRect(px, py, 10, 6);
      }
      ctx.restore();
    } else {
      // Ascending leaning stack
      for (let r = 0; r < totalRacks; r++) {
        const sway = Math.sin(now * 0.005 + r * 0.4) * (r * 3.5 * tension);
        const rx = sway;
        const ry = -r * (rackHeight + 2);

        ctx.fillStyle = COLOURS.serverDark;
        ctx.strokeStyle = tension > 0.5 ? COLOURS.neonPink : COLOURS.neonCyan;
        ctx.lineWidth = 1.5;
        ctx.fillRect(rx - rackWidth / 2, ry - rackHeight, rackWidth, rackHeight);
        ctx.strokeRect(rx - rackWidth / 2, ry - rackHeight, rackWidth, rackHeight);

        // Blinking server LEDs
        for (let led = 0; led < 4; led++) {
          const blink = Math.sin(now * 0.015 + led * 1.5 + r) > 0;
          ctx.fillStyle = blink ? COLOURS.neonGreen : '#0d5c1e';
          ctx.beginPath();
          ctx.arc(rx - rackWidth / 2 + 12 + led * 12, ry - rackHeight / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Fan grill
        ctx.strokeStyle = '#324058';
        ctx.strokeRect(rx + rackWidth / 2 - 20, ry - rackHeight + 4, 14, 14);
      }

      // Cooling smoke & lightning arcs when high tension
      if (tension > 0.4) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.25)';
        for (let s = 0; s < 5; s++) {
          const sx = Math.sin(now * 0.01 + s) * 35;
          const sy = -totalRacks * rackHeight - (s * 18 + ((now * 0.1) % 40));
          ctx.beginPath();
          ctx.arc(sx, sy, 8 + s * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Protagonist: Sweat-drenched trader atop tower
      const topSway = Math.sin(now * 0.005 + totalRacks * 0.4) * (totalRacks * 3.5 * tension);
      const topY = -totalRacks * (rackHeight + 2);

      if (cashedOut) {
        // Zip-line escape with duffel bag!
        const zipX = topSway + ((now - (previousCashout ?? now)) * 0.35);
        const zipY = topY - 30 + (zipX * 0.4);
        ctx.strokeStyle = COLOURS.gold;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-160, topY - 100);
        ctx.lineTo(360, topY + 120);
        ctx.stroke();

        // Trader sliding on trolley
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(zipX, zipY, 11, 0, Math.PI * 2); // Head
        ctx.fill();
        // Duffel bag of gold
        ctx.fillStyle = COLOURS.gold;
        ctx.fillRect(zipX - 16, zipY + 10, 18, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('$', zipX - 7, zipY + 18);
      } else {
        // Frantic balancing broker
        ctx.save();
        ctx.translate(topSway, topY);
        ctx.rotate(leanAngle);

        // Legs wobbling
        ctx.strokeStyle = '#222944';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-12, -22);
        ctx.lineTo(0, -32);
        ctx.lineTo(12, -22);
        ctx.lineTo(8, 0);
        ctx.stroke();

        // Torso / White shirt with flying red tie
        ctx.fillStyle = '#eaf0f8';
        ctx.fillRect(-10, -52, 20, 22);

        // Tie flapping in tornado wind
        ctx.fillStyle = COLOURS.neonPink;
        const tieWave = Math.sin(now * 0.03) * (8 + tension * 16);
        ctx.beginPath();
        ctx.moveTo(0, -48);
        ctx.lineTo(14 + tieWave, -40);
        ctx.lineTo(16 + tieWave, -35);
        ctx.lineTo(0, -42);
        ctx.fill();

        // Head & Hair
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(0, -62, 10, 0, Math.PI * 2);
        ctx.fill();
        // Hair
        ctx.fillStyle = '#4a2f1b';
        ctx.beginPath();
        ctx.arc(0, -68, 9, Math.PI, Math.PI * 2);
        ctx.fill();

        // Sweat drops flying off
        if (tension > 0.25) {
          ctx.fillStyle = COLOURS.neonCyan;
          for (let d = 0; d < 3; d++) {
            const dropX = Math.sin(now * 0.02 + d * 2) * 22;
            const dropY = -62 + Math.cos(now * 0.02 + d * 2) * 12;
            ctx.beginPath();
            ctx.arc(dropX, dropY, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Glowing Laptop in hands
        ctx.fillStyle = COLOURS.neonGreen;
        ctx.fillRect(-16, -46, 12, 9);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(-16, -46, 12, 9);

        ctx.restore();
      }
    }
    ctx.restore();

    // HUD Header / Badges
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline banner
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillText('STAR50 WIPEOUT', 480, 42);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('SHANGHAI SILICON SQUEEZE · 480B VC HEATWAVE', 480, 66);

    // Multiplier read-out
    const punch = crashed ? clamp01(1 - crashAgeSec * 2) * 0.2 : 0;
    ctx.font = `900 ${72 * (1 + punch + tension * 0.12)}px ui-monospace, monospace`;
    ctx.fillStyle = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.neonGreen : '#ffffff');
    ctx.shadowColor = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.neonGreen : COLOURS.neonCyan);
    ctx.shadowBlur = 18;
    ctx.fillText(formatX(view.currentX100), 480, 136);
    ctx.shadowBlur = 0;

    // Live Milestone banner / comical alert
    const currentMilestoneText = running
      ? (MILESTONES[milestoneIdx - 1]?.[1] ?? 'Stacking A100 Tensor Cores...')
      : (crashed ? 'POWER GRID OVERLOADED · ZERO RESIDUAL VALUE' : 'Pre-market trading open · Awaiting launch');

    ctx.fillStyle = crashed ? '#400914' : '#0c1328';
    ctx.strokeStyle = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.neonGreen : '#253555');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(140, 186, 680, 36, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.neonGreen : '#e2edff');
    ctx.fillText(currentMilestoneText, 480, 204);

    // Liquid Nitrogen Hiss gauge
    const gaugeW = 340;
    const gaugeX = (960 - gaugeW) / 2;
    const gaugeY = 236;
    ctx.fillStyle = '#080c1a';
    ctx.fillRect(gaugeX, gaugeY, gaugeW, 8);
    const fillW = gaugeW * (crashed ? 1 : tension);
    const gaugeGrad = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeW, 0);
    gaugeGrad.addColorStop(0, COLOURS.neonCyan);
    gaugeGrad.addColorStop(0.7, '#ffff00');
    gaugeGrad.addColorStop(1, COLOURS.neonPink);
    ctx.fillStyle = crashed ? COLOURS.crashed : gaugeGrad;
    ctx.fillRect(gaugeX, gaugeY, fillW, 8);

    // Stake line / footer
    const [statusText, statusColour] = stakeLine(view);
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = statusColour;
    ctx.fillText(statusText, 480, 502);

    ctx.restore();
  }

  return { draw };
}
