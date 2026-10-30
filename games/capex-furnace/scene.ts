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
  bg: '#080c14',
  rack: '#141c2b',
  rackLine: '#1e293b',
  ledCyan: '#00f0ff',
  ledGreen: '#10b981',
  furnaceHeat: '#ff4d00',
  furnaceGlow: '#ffaa00',
  moneyGreen: '#22c55e',
  cfoSuit: '#1e3a8a',
  cfoSkin: '#fed7aa',
  goldCart: '#fbbf24',
  text: '#f8fafc',
  muted: '#94a3b8',
  crashed: '#ef4444',
  cashedOut: '#4ade80',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Server fans spin up to cooling speed'],
  [150, 'CFO signs lease on second diesel generator'],
  [200, 'Venture cash pallets roll directly onto conveyors'],
  [250, 'Liquid nitrogen tubes frost up across aisles'],
  [300, 'Search query costs forty dollars to compute'],
  [500, 'Regional utility grid sends urgent warning text'],
  [1000, 'Substation transformer hums in high pitch C'],
  [10000, 'Entire server row levitates on thermal draft'],
  [100000, 'Power bill exceeds small sovereign nation GDP'],
  [1000000, 'Singularity reached just to output a cookie recipe'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Enterprise cloud invoice locked at ${formatX(view.cashoutX100)}!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Municipal grid melted · you kept your treasury intact' : 'Touring server farm · no credits burned', COLOURS.muted];
  }
  if (crashed) {
    return [`Main breaker tripped: 0¢ dividend on your ${credits(view.stake)}`, COLOURS.crashed];
  }
  return [`Furnace roaring · ${credits(view.stake)} shoveling into GPU cluster`, COLOURS.furnaceGlow];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  life: number;
  kind: 'cash' | 'spark' | 'smoke' | 'sweat';
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'static' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let shovelTick = 0;

  const particles: Particle[] = [];

  function spawnParticles(kind: Particle['kind'], count: number, x: number, y: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * 1.6 - 0.2;
      const spd = speed * (0.5 + Math.random());
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - (kind === 'spark' || kind === 'smoke' ? 2 : 0),
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 8,
        life: 1,
        kind,
      });
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('bell', 0.9);
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1500);
      audio.fx('buzz', 0.9);
      audio.fx('zap', 0.8);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('hiss', 0.6 + tension * 0.4);
      }
      const shovelCycle = Math.floor(view.elapsed / (450 - tension * 250));
      if (shovelCycle > shovelTick && view.cashoutX100 === null) {
        audio.fx('whoosh', 0.35 + tension * 0.45);
        shovelTick = shovelCycle;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.6) ** 2 : (running ? tension * 3 : 0);

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. DATA CENTER BACKGROUND: Rack rows, cables, neon pipes
    const pipeHeatRatio = running ? tension : crashed ? Math.max(0, 1 - age * 1.5) : 0;
    const pipeGlowColor = `rgb(${Math.round(40 + pipeHeatRatio * 215)}, ${Math.round(180 - pipeHeatRatio * 110)}, ${Math.round(255 - pipeHeatRatio * 255)})`;

    // Overhead industrial coolant pipe
    ctx.lineWidth = 14;
    ctx.strokeStyle = pipeGlowColor;
    ctx.beginPath();
    ctx.moveTo(0, 75);
    ctx.bezierCurveTo(320, 75, 480, 110, 960, 100);
    ctx.stroke();

    // Secondary nitrogen frost pipe
    ctx.lineWidth = 6;
    ctx.strokeStyle = `rgba(180, 240, 255, ${0.4 + 0.4 * depth})`;
    ctx.beginPath();
    ctx.moveTo(0, 95);
    ctx.lineTo(960, 120);
    ctx.stroke();

    // Server rack silhouettes
    for (let i = 0; i < 7; i++) {
      const rx = 30 + i * 140;
      ctx.fillStyle = COLOURS.rack;
      ctx.fillRect(rx, 130, 110, 280);
      ctx.fillStyle = COLOURS.rackLine;
      ctx.fillRect(rx + 6, 136, 98, 268);

      // Blinking unit LEDs
      for (let slot = 0; slot < 6; slot++) {
        const sy = 146 + slot * 42;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rx + 12, sy, 86, 32);

        // Active server lights
        const blinkRate = 0.005 + tension * 0.02;
        const blink = Math.sin((view.elapsed * blinkRate) + i * 1.3 + slot) > 0;
        ctx.fillStyle = crashed && age > 0.08 ? '#334155' : blink ? (slot % 2 === 0 ? COLOURS.ledCyan : COLOURS.ledGreen) : '#0284c7';
        ctx.fillRect(rx + 16, sy + 8, 8, 5);
        ctx.fillStyle = (crashed && age > 0.1) ? '#475569' : (tension > 0.5 ? COLOURS.furnaceHeat : '#10b981');
        ctx.fillRect(rx + 28, sy + 8, 6, 5);

        // Rack vent lines
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        for (let v = 0; v < 3; v++) {
          ctx.beginPath();
          ctx.moveTo(rx + 42, sy + 6 + v * 8);
          ctx.lineTo(rx + 90, sy + 6 + v * 8);
          ctx.stroke();
        }
      }
    }

    // Floor grid
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 410, 960, 130);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 960; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 410);
      ctx.lineTo(x - 30, 540);
      ctx.stroke();
    }
    for (let y = 410; y < 540; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // 2. THE CAPEX FURNACE (Right Side: 640, 240)
    const furnaceX = 660;
    const furnaceY = 360;

    // Outer furnace shell
    ctx.fillStyle = '#1e2029';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(furnaceX - 90, furnaceY - 140, 200, 160, 16);
    ctx.fill();
    ctx.stroke();

    // Furnace caution stripes
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(furnaceX - 86, furnaceY - 136, 192, 12);
    ctx.fillStyle = '#111827';
    for (let s = 0; s < 8; s++) {
      ctx.beginPath();
      ctx.moveTo(furnaceX - 86 + s * 24, furnaceY - 136);
      ctx.lineTo(furnaceX - 74 + s * 24, furnaceY - 124);
      ctx.lineTo(furnaceX - 64 + s * 24, furnaceY - 124);
      ctx.lineTo(furnaceX - 76 + s * 24, furnaceY - 136);
      ctx.fill();
    }

    // Screaming furnace intake mouth glow
    const mouthGlow = ctx.createRadialGradient(furnaceX, furnaceY - 50, 10, furnaceX, furnaceY - 50, 90);
    if (!crashed || age < 0.2) {
      mouthGlow.addColorStop(0, '#ffffff');
      mouthGlow.addColorStop(0.3, COLOURS.furnaceGlow);
      mouthGlow.addColorStop(0.7, COLOURS.furnaceHeat);
      mouthGlow.addColorStop(1, 'rgba(255, 60, 0, 0)');
    } else {
      mouthGlow.addColorStop(0, '#475569');
      mouthGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    }
    ctx.fillStyle = mouthGlow;
    ctx.beginPath();
    ctx.ellipse(furnaceX, furnaceY - 50, 75, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Furnace label
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GPU CORE INTAKE · 8000V', furnaceX + 10, furnaceY + 12);

    // Spinning electricity watt meter dial on furnace
    ctx.save();
    ctx.translate(furnaceX + 70, furnaceY - 100);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();
    const meterAngle = (view.elapsed * (0.01 + tension * 0.05)) % (Math.PI * 2);
    ctx.rotate(meterAngle);
    ctx.strokeStyle = COLOURS.crashed;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();
    ctx.restore();

    // 3. CASH / SPARK PARTICLES
    if (running && Math.random() < 0.4 + tension * 0.6) {
      spawnParticles('cash', 2, 330, 310, 6 + tension * 5);
      spawnParticles('spark', 3, furnaceX - 20, furnaceY - 50, 5 + tension * 7);
      if (tension > 0.3) spawnParticles('sweat', 1, 230, 280, 2);
    }
    if (crashed && age < 0.4) {
      spawnParticles('spark', 5, furnaceX, furnaceY - 50, 12);
      spawnParticles('smoke', 3, furnaceX, furnaceY - 70, 3);
    }

    // Update and draw particles
    for (let p = particles.length - 1; p >= 0; p--) {
      const part = particles[p];
      if (!part) continue;
      part.x += part.vx;
      part.y += part.vy;
      part.rot += part.vRot * 0.05;
      part.life -= part.kind === 'spark' ? 0.04 : 0.02;

      if (part.life <= 0) {
        particles.splice(p, 1);
        continue;
      }

      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.rotate(part.rot);
      ctx.globalAlpha = clamp01(part.life);

      if (part.kind === 'cash') {
        ctx.fillStyle = COLOURS.moneyGreen;
        ctx.fillRect(-10, -5, 20, 10);
        ctx.fillStyle = '#ecfdf5';
        ctx.font = '700 8px sans-serif';
        ctx.fillText('$', 0, 3);
      } else if (part.kind === 'spark') {
        ctx.fillStyle = Math.random() > 0.5 ? '#fde047' : '#ffedd5';
        ctx.fillRect(-2, -2, 4, 4);
      } else if (part.kind === 'sweat') {
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(0, 0, 10 * (1.5 - part.life), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // 4. PROTAGONIST: SWEATING CFO OR ESCAPED CFO
    const shovelSpeed = 8 + tension * 16;
    const shovelPhase = running ? Math.sin(view.elapsed * 0.008 * (1 + tension * 2)) : 0;
    const cfoX = 230;
    const cfoY = 330;

    const cashedOut = view.cashoutX100 !== null;

    if (!cashedOut) {
      // CFO shoveling cash into furnace
      ctx.save();
      ctx.translate(cfoX, cfoY);

      // Body (suit)
      ctx.fillStyle = COLOURS.cfoSuit;
      ctx.fillRect(-18, -40, 36, 50);

      // White collar & red power tie flapping
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-8, -40);
      ctx.lineTo(8, -40);
      ctx.lineTo(0, -22);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-4, -36);
      ctx.lineTo(4, -36);
      ctx.lineTo(6 + shovelPhase * 6, -10);
      ctx.lineTo(-2, -8);
      ctx.fill();

      // Legs
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.lineTo(-14, 46);
      ctx.moveTo(10, 10);
      ctx.lineTo(16, 46);
      ctx.stroke();

      // Shoes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-20, 44, 14, 8);
      ctx.fillRect(12, 44, 14, 8);

      // Head
      ctx.fillStyle = COLOURS.cfoSkin;
      ctx.beginPath();
      ctx.arc(0, -56, 18, 0, Math.PI * 2);
      ctx.fill();

      // Hair (receding Silicon Valley slicked hair)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, -62, 16, Math.PI, Math.PI * 2);
      ctx.fill();

      // Eyes (panic escalates with tension)
      const panic = running ? tension * 3 : crashed ? 4 : 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4, -56, 4 + panic * 0.5, 0, Math.PI * 2);
      ctx.arc(14, -56, 4 + panic * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(5 + panic * 0.4, -56, 2, 0, Math.PI * 2);
      ctx.arc(15 + panic * 0.4, -56, 2, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (crashed) {
        ctx.arc(10, -46, 6, 0, Math.PI); // frown
      } else {
        ctx.arc(10, -46, 5 + tension * 4, 0, Math.PI); // grimace / scream
      }
      ctx.stroke();

      // Sweating drops on forehead
      if (running && tension > 0.2) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(-8, -62, 3, 0, Math.PI * 2);
        ctx.arc(8, -66, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Arms swinging briefcase / shovel of venture cash
      ctx.strokeStyle = COLOURS.cfoSuit;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(8, -30);
      const shovelReach = 36 + shovelPhase * shovelSpeed;
      ctx.lineTo(8 + shovelReach * 0.6, -14 - shovelPhase * 8);
      ctx.lineTo(8 + shovelReach, -4 - shovelPhase * 16);
      ctx.stroke();

      // Shovel head / Briefcase spilling bills
      ctx.save();
      ctx.translate(8 + shovelReach, -4 - shovelPhase * 16);
      ctx.rotate(0.3 + shovelPhase * 0.4);
      // Briefcase
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-6, -14, 28, 20);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(4, -14, 4, 20); // gold clasp
      // Overflowing cash
      ctx.fillStyle = COLOURS.moneyGreen;
      ctx.fillRect(8, -20, 20, 10);
      ctx.fillRect(16, -16, 16, 8);
      ctx.restore();

      ctx.restore();
    } else {
      // CASHOUT ESCAPE: Golden electric golf cart speeding off campus with bell
      const cartProgress = clamp01(view.elapsed / 2500);
      const cartX = 140 + cartProgress * 800;
      const cartY = 370;

      ctx.save();
      ctx.translate(cartX, cartY);

      // Gold Golf Cart Chassis
      ctx.fillStyle = COLOURS.goldCart;
      ctx.beginPath();
      ctx.roundRect(-50, -25, 100, 30, 8);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Roof & pillars
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-35, -25);
      ctx.lineTo(-28, -60);
      ctx.moveTo(25, -25);
      ctx.lineTo(20, -60);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-45, -64, 80, 8);

      // Cart Wheels
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-30, 12, 14, 0, Math.PI * 2);
      ctx.arc(30, 12, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(-30, 12, 6, 0, Math.PI * 2);
      ctx.arc(30, 12, 6, 0, Math.PI * 2);
      ctx.fill();

      // Happy Escaped CFO sitting in cart
      ctx.fillStyle = COLOURS.cfoSuit;
      ctx.fillRect(-15, -45, 24, 26);
      ctx.fillStyle = COLOURS.cfoSkin;
      ctx.beginPath();
      ctx.arc(-3, -56, 12, 0, Math.PI * 2);
      ctx.fill();
      // Sunglasses
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, -58, 10, 5);

      // Golden closing bell mounted on cart
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(35, -34, 9, Math.PI, Math.PI * 2);
      ctx.lineTo(47, -23);
      ctx.lineTo(23, -23);
      ctx.fill();

      // Cloud invoice paper waved by CFO
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, -60, 24, 14);
      ctx.fillStyle = COLOURS.moneyGreen;
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.fillText('PAID', 17, -50);

      ctx.restore();
    }

    // 5. CRASH OVERLAY: Breakers blown, blackout and warning sirens
    if (crashed) {
      const blackout = clamp01(age / 0.15) * (1 - clamp01((age - 1.2) / 0.8) * 0.4);
      ctx.fillStyle = `rgba(3, 7, 18, ${0.82 * blackout})`;
      ctx.fillRect(0, 0, 960, 540);

      // Red flashing emergency siren
      const sirenAlpha = Math.sin(age * 12) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.2 * sirenAlpha})`;
      ctx.fillRect(0, 0, 960, 540);

      // Big warning stamp
      ctx.save();
      ctx.translate(480, 290);
      ctx.rotate(-0.04);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.font = '900 28px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.strokeText('BREAKER TRIPPED · 0¢ DIVIDEND STATEMENT', 0, 0);
      ctx.fillText('BREAKER TRIPPED · 0¢ DIVIDEND STATEMENT', 0, 0);
      ctx.restore();
    }

    // 6. HUD / TEXT Readouts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Tagline
    ctx.fillStyle = COLOURS.furnaceGlow;
    ctx.font = '800 36px ui-monospace, monospace';
    ctx.fillText('CAPEX FURNACE', 480, 42);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('BURNING VENTURE CASH TO SERVE THREE-CENT SEARCH SUMMARIES', 480, 74);

    // Multiplier readout
    const multiColour = crashed ? COLOURS.crashed : cashedOut ? COLOURS.cashedOut : COLOURS.text;
    ctx.fillStyle = multiColour;
    const punch = crashed ? (1 - clamp01((age - 0.12) / 0.25)) ** 2 : 0;
    ctx.font = `900 ${88 * (1 + 0.2 * punch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 168);

    // Milestones caption banner
    const currentMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const bannerText = currentMilestone?.[1] ?? (running ? 'Cooling fans engaged · shoveling treasury bills' : view.phase === 'crashed' ? 'Regional grid collapse · all server fans stalled' : 'Racks standby · waiting for next quarter');
    ctx.fillStyle = crashed ? COLOURS.crashed : '#38bdf8';
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 452, 880);

    // Bottom Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 494, 880);

    ctx.restore();
  }

  return { draw };
}
