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
  [120, 'Duct tape wrapped around booster'],
  [150, 'Lawyers speed-stamp merger papers'],
  [200, 'Rocket sparks ignite boardroom rug'],
  [250, 'Cybertruck tailgate begins glowing red'],
  [300, 'Wall Street ceiling tile blown open'],
  [500, 'Trading computers levitate in exhaust'],
  [1000, 'Market cap passes Jupiter GDP'],
  [10000, 'Booster enters low orbit over Delaware'],
  [100000, 'Martian branch opens trading desk'],
  [1000000, 'Intergalactic monopoly declared'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Golden parachute pulled at ${formatX(view.cashoutX100)} · Safe in private lagoon`, '#6ee7b7'];
  }
  if (view.stake === null) {
    return [crashed ? 'SEC audit landed · No credits harmed' : 'Spectating hostile takeover · 0 credits on line', '#94a3b8'];
  }
  if (crashed) return [`Catastrophic SEC audit! Lost ${credits(view.stake)}`, '#f87171'];
  return [`Valuation soaring: ${credits(view.stake)} riding merger wave`, '#38bdf8'];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'spark' | 'smoke' | 'paper' | 'dollar';
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'boom' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastParticleSpawn = 0;
  const particles: Particle[] = [];

  function spawnParticles(x: number, y: number, tension: number, crashed: boolean, elapsed: number) {
    const rate = crashed ? 18 : Math.floor(4 + tension * 12);
    for (let i = 0; i < rate; i++) {
      const isSpark = Math.random() < (crashed ? 0.4 : 0.6);
      const isPaper = Math.random() < 0.25;
      const angle = (Math.PI / 2) + (Math.random() - 0.5) * (crashed ? Math.PI * 2 : 1.2);
      const speed = (crashed ? 180 + Math.random() * 400 : 90 + tension * 260 + Math.random() * 120) * (crashed ? 1 : 1);
      const colors = isSpark
        ? ['#ffedd5', '#f97316', '#ef4444', '#38bdf8']
        : isPaper
        ? ['#f8fafc', '#cbd5e1', '#e2e8f0']
        : ['#475569', '#334155', '#1e293b'];
      particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 15,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (isPaper ? -60 : 0),
        size: isPaper ? 7 + Math.random() * 6 : 2 + Math.random() * (isSpark ? 5 : 12),
        life: 0,
        maxLife: isPaper ? 1.6 : 0.5 + Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff',
        kind: isPaper ? 'paper' : isSpark ? 'spark' : 'smoke',
      });
    }
    lastParticleSpawn = elapsed;
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (prevPhase !== null && running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
      audio.fx('cheer', 0.7);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('boom', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.8);
      audio.fx('shatter', 0.7);
    }
    if (running && prevPhase === 'running' && milestoneIndex > prevMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('zap', 0.5 + tension * 0.5);
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2
      : running
      ? (1.2 + tension * 3.8) * Math.sin(now * 0.05)
      : 0;

    // Background - synthwave Wall Street skyline + corporate board grid
    ctx.save();
    ctx.clearRect(0, 0, 960, 540);
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.06));

    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#0a091a');
    bgGrad.addColorStop(0.55, '#191136');
    bgGrad.addColorStop(1, '#05030f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, 1000, 580);

    // Glowing synth grid on bottom trading floor
    ctx.save();
    ctx.strokeStyle = `rgba(168, 85, 247, ${0.15 + tension * 0.25})`;
    ctx.lineWidth = 1;
    const horizonY = 380;
    for (let gx = -100; gx <= 1060; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, 540);
      ctx.lineTo(480 + (gx - 480) * 0.15, horizonY);
      ctx.stroke();
    }
    for (let gy = horizonY; gy <= 540; gy += 24) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(960, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Wall Street ticker monitors in background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(40, 48, 880, 42);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, 48, 880, 42);

    const tickerOffset = (view.elapsed * 0.12) % 400;
    ctx.save();
    ctx.beginPath();
    ctx.rect(42, 50, 876, 38);
    ctx.clip();
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 13px ui-monospace, monospace';
    const tickerText = '◆ TSLA/SPCX MERGER: BYPASS REGULATORY AUDIT ◆ DUCT TAPE INTEGRITY: 99.4% ◆ SEC VALUATION: TO THE MOON ◆ CEILING TILES: OBLITERATED ◆ REVENUE: 420.69B ◆ MATCHALATTE INDEX: BULLISH ';
    ctx.fillText(tickerText.repeat(3), 50 - tickerOffset, 74);
    ctx.restore();

    // Vehicle position physics
    const baseY = 320;
    const hoverOffset = running ? Math.sin(view.elapsed * 0.005) * (10 + tension * 16) - tension * 45 : 0;
    const vehicleY = baseY + hoverOffset;
    const vehicleX = 480;

    // Spawn engine particles
    if (running && (now - lastParticleSpawn > 32)) {
      spawnParticles(vehicleX, vehicleY + 70, tension, false, now);
    }
    if (crashed && crashAgeSec < 0.8 && (now - lastParticleSpawn > 35)) {
      spawnParticles(vehicleX, vehicleY, 1, true, now);
    }

    // Update & draw particles
    const dt = 0.016;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      if (p.kind === 'paper') {
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 5);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.3);
        ctx.fillStyle = '#ef4444';
        ctx.font = '6px sans-serif';
        ctx.fillText('SEC', -p.size / 2, 2);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // DRAW CENTERPIECE: FALCON 9 BOOSTER + CYBERTRUCK WELDED WITH DUCT TAPE
    ctx.save();
    ctx.translate(vehicleX, vehicleY);

    if (crashed) {
      // Accordion smash effect
      const squish = Math.min(1.8, 1 + crashAgeSec * 3);
      ctx.scale(1 + crashAgeSec * 0.5, Math.max(0.2, 1 / squish));
    }

    // 1. Rocket Booster (Falcon 9 core)
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    // Booster tube
    ctx.beginPath();
    ctx.roundRect(-24, -30, 48, 100, [6, 6, 2, 2]);
    ctx.fill();
    ctx.stroke();

    // Booster markings & grid fins
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-22, -10, 44, 4);
    ctx.fillRect(-22, 15, 44, 4);
    // Grid fins
    ctx.fillStyle = '#334155';
    ctx.fillRect(-34, -20, 10, 8);
    ctx.fillRect(24, -20, 10, 8);
    // Rocket nozzle
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-16, 70);
    ctx.lineTo(16, 70);
    ctx.lineTo(22, 85);
    ctx.lineTo(-22, 85);
    ctx.closePath();
    ctx.fill();

    // Thrust flame
    if (running) {
      const flameH = 40 + tension * 80 + Math.random() * 25;
      const flameGrad = ctx.createLinearGradient(0, 85, 0, 85 + flameH);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.2, '#67e8f9');
      flameGrad.addColorStop(0.5, '#f97316');
      flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-20, 85);
      ctx.lineTo(20, 85);
      ctx.lineTo(0, 85 + flameH);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Cybertruck welded sideways/atop booster
    ctx.save();
    ctx.translate(0, -50);
    // Angular body gradient
    const truckGrad = ctx.createLinearGradient(-55, -25, 55, 10);
    truckGrad.addColorStop(0, '#cbd5e1');
    truckGrad.addColorStop(0.5, '#94a3b8');
    truckGrad.addColorStop(1, tension > 0.4 ? '#fca5a5' : '#64748b');
    ctx.fillStyle = truckGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;

    // Low-poly Cybertruck silhouette
    ctx.beginPath();
    ctx.moveTo(-52, 16); // rear wheel well
    ctx.lineTo(-58, 2);  // tailgate
    ctx.lineTo(-12, -24); // peak roof
    ctx.lineTo(44, 4);    // hood front
    ctx.lineTo(54, 16);   // bumper
    ctx.lineTo(-52, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tailgate glowing if tension high
    if (tension > 0.3) {
      ctx.fillStyle = `rgba(239, 68, 68, ${clamp01((tension - 0.3) * 1.6)})`;
      ctx.fillRect(-58, -4, 4, 14);
    }

    // Lightbar front
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(42, 2, 9, 3);

    // Angular wheels
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-36, 16, 11, 0, Math.PI * 2);
    ctx.arc(32, 16, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(-36, 16, 5, 0, Math.PI * 2);
    ctx.arc(32, 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Thick Silver Duct Tape wraps holding them together
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let ty = -38; ty <= -15; ty += 10) {
      ctx.fillRect(-30, ty, 60, 6);
      ctx.strokeRect(-30, ty, 60, 6);
    }
    // "MERGER INTACT" scribbled in marker
    ctx.fillStyle = '#1e1b4b';
    ctx.font = '700 8px sans-serif';
    ctx.fillText('AUDIT EXEMPT', -26, -20);

    ctx.restore(); // vehicle

    // CASHOUT SURFBOARD ESCAPE ANIMATION
    if (cashedOut) {
      const escapeProgress = clamp01((now % 3000) / 3000);
      const surfX = 260 + escapeProgress * 540;
      const surfY = 160 + Math.sin(now * 0.008) * 12;

      ctx.save();
      ctx.translate(surfX, surfY);
      // Titanium surfboard
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 16, 36, 8, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Golden parachute canopy above
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -38, 28, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(-28, -38);
      ctx.lineTo(0, 0);
      ctx.moveTo(28, -38);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Stick CEO sipping iced matcha
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, -10, 8, 0, Math.PI * 2); // head
      ctx.fill();
      // Cool sunglasses
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-3, -12, 10, 4);
      // Matchacup
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(8, -8, 6, 8);

      ctx.fillStyle = '#6ee7b7';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('ICED MATCHA SECURED', -60, -50);
      ctx.restore();
    }

    // CRASHED OVERLAY: SEC SUBPOENA RAIN & POLICE LIGHTS
    if (crashed) {
      const flash = Math.sin(now * 0.02) > 0;
      ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)';
      ctx.fillRect(0, 0, 960, 540);

      ctx.save();
      ctx.fillStyle = '#f87171';
      ctx.font = '900 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MERGER AUDITED BY SEC: SNAPPED IN HALF!', 480, 140);
      ctx.restore();
    }

    // MAIN MULTIPLIER HUD
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText('MEGA MERGER', 480, 116);

    const multColor = crashed ? '#f87171' : cashedOut ? '#6ee7b7' : '#38bdf8';
    ctx.fillStyle = multColor;
    const punch = crashed ? clamp01(1 - crashAgeSec / 0.3) * 16 : 0;
    ctx.font = `900 ${88 + punch}px ui-monospace, monospace`;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 18;
    ctx.fillText(formatX(view.currentX100), 480, 204);
    ctx.shadowBlur = 0;

    // Milestone Caption
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const caption = activeMilestone
      ? activeMilestone[1]
      : crashed
      ? 'Galactic pop! Booster crushed into accordion'
      : cashedOut
      ? 'Golden parachute safely deployed'
      : 'Duct taping Falcon 9 booster onto Cybertruck...';

    ctx.fillStyle = '#fde047';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(caption, 480, 436);

    // Stake line / status
    const [lineText, lineColour] = stakeLine(view);
    ctx.fillStyle = lineColour;
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 482);

    // Comical gauges in bottom corners
    // Left: Duct Tape Integrity
    ctx.textAlign = 'left';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('DUCT TAPE STRESS', 40, 492);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(40, 502, 140, 10);
    ctx.fillStyle = tension > 0.7 ? '#ef4444' : '#38bdf8';
    ctx.fillRect(40, 502, 140 * clamp01(0.15 + tension * 0.85), 10);

    // Right: SEC Audit Proximity
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('SEC AUDIT PROXIMITY', 920, 492);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(780, 502, 140, 10);
    ctx.fillStyle = crashed ? '#ef4444' : '#eab308';
    ctx.fillRect(780, 502, 140 * (crashed ? 1 : depth), 10);

    ctx.restore();
  }

  return { draw };
}
