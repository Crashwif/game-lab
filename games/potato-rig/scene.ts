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
  bg: '#0e131b',
  steel: '#475569',
  steelLight: '#94a3b8',
  oilLow: '#d97706',
  oilHigh: '#ef4444',
  potato: '#b4733c',
  potatoSkin: '#854d0e',
  copper: '#f97316',
  neonGreen: '#22c55e',
  neonCyan: '#06b6d4',
  crashed: '#f87171',
  cashedOut: '#4ade80',
  text: '#f8fafc',
  muted: '#94a3b8',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Spud processor hits 16-bit low-res menu boot'],
  [150, 'Fryer oil warms up; cooling oil reaches a simmer'],
  [200, 'Frosty-cooling tube drips cold cream onto the GPU'],
  [250, 'Turn-based burger demon summoned on screen'],
  [300, 'Potato begins baking inside its copper heat sink'],
  [500, 'Deep fryer GPU hits 400°F of golden crisp'],
  [1000, 'Ray-tracing engages on French fry god boss'],
  [10000, 'Rig achieves 120 FPS powered strictly by starch'],
  [100000, 'Crispy transcendence melts the drive-thru window'],
  [1000000, 'God-tier potato ascends to digital fast-food heaven'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Cashed out at ${formatX(view.cashoutX100)} · Combo basket saved!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Vat blew over · observing spectator' : 'Watching rig boot · no credits riding', COLOURS.muted];
  }
  if (crashed) return [`Lost ${credits(view.stake)} in the grease explosion!`, COLOURS.crashed];
  return [`Overclocking ${credits(view.stake)} · Hold the fryer!`, COLOURS.neonCyan];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  kind: 'bubble' | 'spark' | 'steam' | 'mash';
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'splash' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSoundTick = 0;
  const particles: Particle[] = [];

  function spawnParticles(x: number, y: number, count: number, kind: Particle['kind'], spd: number) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
      const v = (Math.random() * 0.6 + 0.4) * spd;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v - (kind === 'steam' || kind === 'bubble' ? 1.5 : 0),
        size: Math.random() * 5 + 3,
        life: 1,
        kind,
      });
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('cheer', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('splash', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 1.0);
      spawnParticles(290, 310, 40, 'mash', 9);
      spawnParticles(290, 310, 30, 'steam', 6);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('zap', 0.8);
      }
      if (now - lastSoundTick > Math.max(120, 500 - tension * 380)) {
        lastSoundTick = now;
        if (!cashedOut) {
          audio.fx('bubble', 0.3 + 0.5 * tension);
          if (Math.random() < tension) audio.fx('hiss', 0.4 * tension);
        }
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAge = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAge / 0.6) ** 2 : tension * 2.2 * Math.sin(now * 0.04);
    const spudShakeX = (Math.random() - 0.5) * (running ? tension * 6 : 0);
    const spudShakeY = (Math.random() - 0.5) * (running ? tension * 6 : 0);

    // Background kitchen tile wall & counter
    ctx.save();
    ctx.translate(shake * Math.sin(crashAge * 50), shake * Math.cos(crashAge * 45));

    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Tiles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 960; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = 0; y < 540; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Stainless steel counter table
    const tableGrad = ctx.createLinearGradient(0, 380, 0, 540);
    tableGrad.addColorStop(0, '#334155');
    tableGrad.addColorStop(0.3, '#1e293b');
    tableGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, 380, 960, 160);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 380, 960, 4);

    // Periodic bubble / steam spawner
    if (running && Math.random() < 0.4 + tension * 0.4) {
      particles.push({
        x: 230 + Math.random() * 120,
        y: 350,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 3 - 1.5 - tension * 3,
        size: Math.random() * 4 + 2,
        life: 1,
        kind: Math.random() < 0.3 ? 'spark' : Math.random() < 0.6 ? 'steam' : 'bubble',
      });
    }

    // Fryer Vat Body (Center-left)
    const vatX = 200;
    const vatY = 240;
    const vatW = 180;
    const vatH = 150;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(vatX - 6, vatY - 6, vatW + 12, vatH + 12);
    ctx.fillStyle = COLOURS.steel;
    ctx.fillRect(vatX, vatY, vatW, vatH);

    // Boiling Oil Basin
    const oilColor = tension > 0.6 ? COLOURS.oilHigh : COLOURS.oilLow;
    const oilGrad = ctx.createLinearGradient(vatX, vatY + 40, vatX, vatY + vatH);
    oilGrad.addColorStop(0, oilColor);
    oilGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = oilGrad;
    ctx.fillRect(vatX + 10, vatY + 40, vatW - 20, vatH - 50);

    // Fry basket wire mesh
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let bx = vatX + 16; bx < vatX + vatW - 16; bx += 8) {
      ctx.beginPath();
      ctx.moveTo(bx, vatY + 45);
      ctx.lineTo(bx, vatY + vatH - 15);
      ctx.stroke();
    }

    // Skewered Russet Potato Rig (CPU)
    const spudX = vatX + vatW / 2 + spudShakeX;
    const spudY = vatY + 55 + spudShakeY;

    if (!crashed || crashAge > 0.6) {
      ctx.save();
      ctx.translate(spudX, spudY);

      // Heat glow if overclocking
      if (running && tension > 0.2) {
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 15 + 25 * tension;
      }

      // Russet Potato Shape
      ctx.fillStyle = crashed ? '#451a03' : COLOURS.potato;
      ctx.beginPath();
      ctx.ellipse(0, 0, 48, 32, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Potato skin spots / eyes
      ctx.fillStyle = COLOURS.potatoSkin;
      ctx.beginPath();
      ctx.arc(-22, -10, 3, 0, Math.PI * 2);
      ctx.arc(15, 8, 3.5, 0, Math.PI * 2);
      ctx.arc(-6, 12, 2.5, 0, Math.PI * 2);
      ctx.arc(28, -6, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Copper Pipes & Heat Sink
      ctx.strokeStyle = COLOURS.copper;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-35, -20);
      ctx.lineTo(-35, -45);
      ctx.lineTo(35, -45);
      ctx.lineTo(35, -20);
      ctx.stroke();

      // Cooling soft-serve tube
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-15, -45);
      ctx.bezierCurveTo(-15, -70, -60, -70, -70, -30);
      ctx.stroke();

      // Motherboard chip & jumper wires skewered into potato
      ctx.fillStyle = '#059669';
      ctx.fillRect(-18, -12, 36, 24);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPUD-X', 0, 3);

      // Blinking LEDs
      const ledOn = Math.floor(now / 150) % 2 === 0;
      ctx.fillStyle = ledOn ? '#22c55e' : '#14532d';
      ctx.beginPath();
      ctx.arc(12, -7, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else {
      // Crash blowout mashed spuds remnants
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(spudX, spudY + 10, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ca8a04';
      ctx.fillText('MASHED', spudX, spudY + 10);
    }

    // CRT Monitor Rig (Center-right)
    const crtX = 520;
    const crtY = 190;
    const crtW = 340;
    const crtH = 210;

    // Monitor Outer Casing
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(crtX, crtY, crtW, crtH, 14);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Monitor Stand
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(crtX + crtW / 2 - 25, crtY + crtH, 50, 25);
    ctx.fillRect(crtX + crtW / 2 - 50, crtY + crtH + 20, 100, 10);

    // CRT Screen Glass
    const scrX = crtX + 16;
    const scrY = crtY + 16;
    const scrW = crtW - 32;
    const scrH = crtH - 42;

    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.roundRect(scrX, scrY, scrW, scrH, 8);
    ctx.fill();

    // Fast Food RPG Scene on CRT Screen
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(scrX, scrY, scrW, scrH, 8);
    ctx.clip();

    // RPG Dungeon Grid background
    const scanlineOffset = (now * 0.05) % 8;
    ctx.fillStyle = '#091e14';
    ctx.fillRect(scrX, scrY, scrW, scrH);

    // Pixel Burger Goblin / Boss
    const bossX = scrX + scrW / 2;
    const bossY = scrY + scrH / 2 + 10 + Math.sin(now * 0.006) * 5;
    const bossSize = 26 + depth * 18;

    // Boss bun & patty
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(bossX, bossY - bossSize * 0.3, bossSize * 0.8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(bossX - bossSize * 0.75, bossY - bossSize * 0.25, bossSize * 1.5, bossSize * 0.4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(bossX - bossSize * 0.65, bossY + bossSize * 0.1, bossSize * 1.3, bossSize * 0.2);
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(bossX, bossY + bossSize * 0.3, bossSize * 0.8, 0, Math.PI);
    ctx.fill();

    // Burger Goblin Evil Eyes & Teeth
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(bossX - 10, bossY - 8, 4, 0, Math.PI * 2);
    ctx.arc(bossX + 10, bossY - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bossX - 9, bossY - 8, 1.5, 0, Math.PI * 2);
    ctx.arc(bossX + 11, bossY - 8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // RPG UI overlays
    ctx.fillStyle = COLOURS.neonGreen;
    ctx.font = '700 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(depth > 0.6 ? 'BURGER GOD [RTX: ON]' : 'BURGER GOBLIN LV.' + Math.floor(1 + tension * 49), scrX + 10, scrY + 18);

    // HP Bar
    ctx.fillStyle = '#334155';
    ctx.fillRect(scrX + 10, scrY + 24, 120, 6);
    ctx.fillStyle = COLOURS.neonGreen;
    ctx.fillRect(scrX + 10, scrY + 24, Math.max(10, 120 * (1 - tension * 0.8)), 6);

    // CRT Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let sl = scrY + scanlineOffset; sl < scrY + scrH; sl += 4) {
      ctx.fillRect(scrX, sl, scrW, 2);
    }

    if (crashed) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(scrX, scrY, scrW, scrH);
      ctx.fillStyle = '#fef2f2';
      ctx.font = '900 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CRITICAL OVERBOIL', scrX + scrW / 2, scrY + scrH / 2);
    }
    ctx.restore();

    // Overclock Temperature Gauge
    const tempF = Math.floor(180 + tension * 320);
    ctx.fillStyle = tension > 0.7 ? COLOURS.crashed : COLOURS.oilLow;
    ctx.font = '700 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`OIL TEMP: ${tempF}°F [${Math.floor(tension * 100)}% CLOCK]`, vatX, vatY - 14);

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      if (p.kind === 'bubble') {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'steam') {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else {
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Cashout Escaped Badge / Fries Combo
    if (cashedOut) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(80, 190, 240, 150);
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.strokeRect(80, 190, 240, 150);

      // Fries box icon
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(105, 250, 45, 60);
      ctx.fillStyle = '#facc15';
      for (let fi = 0; fi < 5; fi++) {
        ctx.fillRect(108 + fi * 8, 220 + (fi % 2) * 8, 6, 35);
      }
      // Soft serve cup
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(170, 260, 40, 50);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(190, 255, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COMBO SECURED!', 200, 215);
      ctx.restore();
    }

    // HUD Header & Multiplier
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText('POTATO RIG RPG', 480, 48);

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('FAST FOOD OVERCLOCK ENGINE · STARCH-POWERED CORE', 480, 74);

    const multColor = crashed ? COLOURS.crashed : cashedOut ? COLOURS.cashedOut : COLOURS.text;
    ctx.fillStyle = multColor;
    ctx.font = '800 68px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 142);

    // Milestone ticker banner
    const currentMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const tickerText = currentMilestone ? currentMilestone[1] : view.phase === 'betting' ? 'Ready to Overclock the Vat' : view.phase === 'crashed' ? 'Grease Overboil Detonation!' : 'Rig Idling';

    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(tickerText, 480, 480);

    // Stake line
    const [stkText, stkColor] = stakeLine(view);
    ctx.fillStyle = stkColor;
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText(stkText, 480, 514);

    ctx.restore();
  }

  return { draw };
}
