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
  [120, 'Fans spin up to jet engine roar'],
  [150, 'Liquid cooling tubes start bubbling green'],
  [200, 'Datacenter lights dim across the district'],
  [250, 'Chopsticks wedged to hold GPU risers'],
  [300, 'Red market candles bleed down monitor walls'],
  [500, 'Steam billows out of the rack enclosure'],
  [1000, 'STAR50 index chart plummets off the desk'],
  [10000, 'Fire extinguishers blast pure nitrogen'],
  [100000, 'Quantum core fuses into a glowing orb'],
  [1000000, 'Supercomputer levitates on plasma heat'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Cryo-Dolly locked at ${formatX(view.cashoutX100)} · Vault secure!`, '#5eead4'];
  }
  if (view.stake === null) {
    return [crashed ? 'Rack popped · zero credits at risk' : 'Spectating datacenter telemetry', '#94a3b8'];
  }
  if (crashed) {
    return [`Core melted down! Lost ${credits(view.stake)} in vapor`, '#f87171'];
  }
  return [`Cooling rigs online · ${credits(view.stake)} riding`, '#38bdf8'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'shatter' });
  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let fanTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('spray', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('zap', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneCount > prevMilestone) audio.milestone(milestoneCount);
      const fanInterval = Math.max(40, 220 - tension * 170);
      if (now - fanTick > fanInterval) {
        fanTick = now;
        if (!cashed) audio.fx('buzz', 0.15 + tension * 0.35);
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneCount;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashAgeSec / 0.8) ** 2 : (running ? Math.sin(now * 0.05) * tension * 2.2 : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.1), shake * Math.cos(now * 0.13));

    // Datacenter Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    const heatColor = crashed ? '#2a080c' : tension > 0.6 ? '#220b1e' : '#070f1e';
    bgGrad.addColorStop(0, heatColor);
    bgGrad.addColorStop(1, '#020409');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Cable & Floor Grid
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.08 + tension * 0.08})`;
    ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 400);
      ctx.lineTo(480 + (x - 480) * 1.5, 540);
      ctx.stroke();
    }
    for (let y = 400; y <= 540; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Wall Market Charts (Falling red candles)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(40, 70, 180, 260);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.strokeRect(40, 70, 180, 260);
    ctx.fillStyle = '#64748b';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText('NASDAQ: $480B VAL', 50, 90);
    for (let i = 0; i < 7; i++) {
      const cx = 56 + i * 24;
      const drop = Math.sin(now * 0.003 + i) * 15 + i * 16 * tension;
      const cy = 110 + drop;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx + 8, cy - 8, 2, 34 + tension * 16);
      ctx.fillRect(cx + 4, cy, 10, 20);
    }

    // Overhead Warning Beacon
    const flash = (Math.sin(now * (running ? 0.015 + tension * 0.025 : 0.004)) + 1) * 0.5;
    ctx.fillStyle = crashed ? 'rgba(239, 68, 68, 0.8)' : `rgba(249, 115, 22, ${0.2 + flash * 0.6 * tension})`;
    ctx.beginPath();
    ctx.arc(480, 18, 12, 0, Math.PI * 2);
    ctx.fill();

    // Central Server Tower Rig
    const rackX = 490;
    const rackY = 170;
    const rackW = 150;
    const rackH = 240;
    const heatLevel = crashed ? 1 : tension;

    // Heat glow behind rack
    const glowRad = 80 + heatLevel * 140;
    const glowGrad = ctx.createRadialGradient(rackX + rackW / 2, rackY + rackH / 2, 10, rackX + rackW / 2, rackY + rackH / 2, glowRad);
    glowGrad.addColorStop(0, crashed ? 'rgba(255, 69, 0, 0.8)' : `rgba(255, ${Math.floor(180 - heatLevel * 140)}, 40, ${0.15 + heatLevel * 0.5})`);
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(rackX + rackW / 2, rackY + rackH / 2, glowRad, 0, Math.PI * 2);
    ctx.fill();

    if (!crashed || crashAgeSec < 0.1) {
      // Main Chassis
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rackX, rackY, rackW, rackH);
      ctx.strokeStyle = heatLevel > 0.7 ? '#f97316' : '#475569';
      ctx.lineWidth = 3;
      ctx.strokeRect(rackX, rackY, rackW, rackH);

      // Server Blade Slots & Blinking LEDs
      for (let s = 0; s < 6; s++) {
        const sy = rackY + 12 + s * 37;
        ctx.fillStyle = heatLevel > 0.8 ? '#451a03' : '#0f172a';
        ctx.fillRect(rackX + 8, sy, rackW - 16, 30);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(rackX + 8, sy, rackW - 16, 30);

        // Status LEDs
        const isHot = heatLevel > 0.45;
        const ledColor = isHot ? (s % 2 === 0 ? '#ef4444' : '#f59e0b') : '#22c55e';
        ctx.fillStyle = ledColor;
        for (let l = 0; l < 4; l++) {
          ctx.beginPath();
          ctx.arc(rackX + 18 + l * 12, sy + 15, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Exhaust Fan Grills
        const fanAngle = now * (0.01 + heatLevel * 0.05);
        ctx.save();
        ctx.translate(rackX + rackW - 32, sy + 15);
        ctx.rotate(fanAngle);
        ctx.strokeStyle = heatLevel > 0.7 ? '#fdba74' : '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
        ctx.moveTo(0, -10); ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();
      }

      // Coolant pipe running vertically
      ctx.strokeStyle = heatLevel > 0.5 ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(rackX - 10, rackY + 20);
      ctx.bezierCurveTo(rackX - 25, rackY + 80, rackX - 25, rackY + 160, rackX - 10, rackY + 220);
      ctx.stroke();

      // Steam billows
      if (heatLevel > 0.3) {
        ctx.fillStyle = `rgba(241, 245, 249, ${0.2 + heatLevel * 0.35})`;
        for (let p = 0; p < 4; p++) {
          const steamY = rackY + 20 - ((now * 0.08 + p * 35) % 90);
          const steamX = rackX + 15 + p * 30 + Math.sin(now * 0.005 + p) * 12;
          ctx.beginPath();
          ctx.arc(steamX, steamY, 12 + p * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Crashed: Rack exploded into shards, heat sinks, and sparks
      const explode = Math.min(1.5, crashAgeSec);
      ctx.fillStyle = '#ef4444';
      ctx.font = '900 24px ui-monospace, monospace';
      ctx.fillText('⚡ CRITICAL MELTDOWN ⚡', rackX - 40, rackY - 20);

      // Flying burning heat sinks & sparks
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const dist = explode * (90 + (i % 5) * 45);
        const px = rackX + rackW / 2 + Math.cos(angle) * dist;
        const py = rackY + rackH / 2 + Math.sin(angle) * dist + explode * explode * 70;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(explode * 6 + i);
        ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#facc15';
        ctx.fillRect(-10, -6, 20, 12);
        ctx.strokeStyle = '#dc2626';
        ctx.strokeRect(-10, -6, 20, 12);
        ctx.restore();
      }

      // Fried breaker smoke cloud
      ctx.fillStyle = `rgba(71, 85, 105, ${Math.max(0, 0.7 - crashAgeSec * 0.4)})`;
      ctx.beginPath();
      ctx.arc(rackX + rackW / 2, rackY + rackH / 2, 70 + explode * 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Protagonist: Panicked Sysadmin (Normal & Running) or Dolly Safe Escort (Cashed)
    if (!cashed && (!crashed || crashAgeSec < 0.8)) {
      const adminX = 350 + (crashed ? -crashAgeSec * 80 : Math.sin(now * 0.01) * 6);
      const adminY = 320;

      // Sysadmin Body
      ctx.fillStyle = '#0284c7'; // Datacenter uniform
      ctx.fillRect(adminX - 16, adminY + 20, 32, 45);

      // Legs running / trembling
      const legBob = Math.sin(now * 0.02) * (5 + tension * 10);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(adminX - 14, adminY + 65, 10, 30 + legBob);
      ctx.fillRect(adminX + 4, adminY + 65, 10, 30 - legBob);

      // Head & Sweating Face
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(adminX, adminY, 18, 0, Math.PI * 2);
      ctx.fill();

      // Bulging Panicked Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(adminX + 5, adminY - 3, 5, 0, Math.PI * 2);
      ctx.arc(adminX + 13, adminY - 3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(adminX + 6, adminY - 3, 2, 0, Math.PI * 2);
      ctx.arc(adminX + 14, adminY - 3, 2, 0, Math.PI * 2);
      ctx.fill();

      // Open Screaming Mouth
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.ellipse(adminX + 9, adminY + 8, 5, 6 + tension * 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Clutching Wet Towel / Cooling Fan stack
      ctx.fillStyle = '#38bdf8'; // Wet dripping towel
      ctx.fillRect(adminX + 14, adminY + 12, 28, 12);
      ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.arc(adminX + 42, adminY + 28 + ((now * 0.08) % 15), 3, 0, Math.PI * 2);
      ctx.fill();

      // Sweat drops flying
      ctx.fillStyle = '#67e8f9';
      for (let sw = 0; sw < 3; sw++) {
        const sx = adminX - 10 - sw * 10;
        const sy = adminY - 12 - sw * 6 + ((now * 0.05 + sw * 20) % 25);
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (cashed) {
      // Cashed Out: Admin safely pushing Cryo-Dolly to vault!
      const escapeX = Math.min(780, 260 + (now - (prevCashout ?? now)) * 0.35);
      const escapeY = 320;

      // Cryogenic Freight Dolly
      ctx.fillStyle = '#475569';
      ctx.fillRect(escapeX, escapeY + 30, 85, 20);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(escapeX + 10, escapeY - 20, 65, 50); // Frozen server unit
      ctx.fillStyle = '#a5f3fc';
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.fillText('CRYO-SECURE', escapeX + 12, escapeY);

      // Frost particles
      ctx.fillStyle = 'rgba(165, 243, 252, 0.7)';
      for (let f = 0; f < 5; f++) {
        ctx.beginPath();
        ctx.arc(escapeX + f * 16 + Math.sin(now * 0.01 + f) * 5, escapeY + 35, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dolly Wheels
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(escapeX + 18, escapeY + 54, 8, 0, Math.PI * 2);
      ctx.arc(escapeX + 70, escapeY + 54, 8, 0, Math.PI * 2);
      ctx.fill();

      // Relieved Sysadmin pushing cart
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(escapeX - 26, escapeY + 15, 24, 40);
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(escapeX - 14, escapeY, 15, 0, Math.PI * 2);
      ctx.fill();
      // Happy smile
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(escapeX - 10, escapeY + 2, 6, 0.1, Math.PI * 0.9);
      ctx.stroke();
    }

    // Top Header & Multiplier HUD
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 38px system-ui, sans-serif';
    ctx.fillText('AI MELTDOWN', 480, 48);

    ctx.font = '600 15px ui-monospace, monospace';
    ctx.fillStyle = tension > 0.6 ? '#fdba74' : '#94a3b8';
    ctx.fillText('DATACENTER THERMAL TELEMETRY · STACK COOLING RIGS', 480, 80);

    // Multiplier Text with chromatic pop
    const multColor = crashed ? '#f87171' : cashed ? '#4ade80' : tension > 0.7 ? '#fb923c' : '#38bdf8';
    ctx.font = '900 86px ui-monospace, monospace';
    ctx.fillStyle = multColor;
    ctx.fillText(formatX(view.currentX100), 480, 138);

    // Current Milestone or Status
    const curMilestone = MILESTONES[milestoneCount - 1];
    const caption = curMilestone ? curMilestone[1] : (crashed ? 'CORE MELTDOWN EVAPORATED VALUATION' : 'Pumping Liquid Coolant...');
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = crashed ? '#fca5a5' : '#cbd5e1';
    ctx.fillText(caption, 480, 460);

    // Stake / Cashout Info Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = lineCol;
    ctx.fillText(lineText, 480, 498);

    // Thermal Bar Gauge
    const barW = 320;
    const barH = 10;
    const barX = 320;
    const barY = 520;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX, barY, barW, barH);
    const fillW = barW * (crashed ? 1 : tension);
    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    barGrad.addColorStop(0, '#22c55e');
    barGrad.addColorStop(0.5, '#f59e0b');
    barGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = barGrad;
    ctx.fillRect(barX, barY, fillW, barH);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.restore();
  }

  return { draw };
}
