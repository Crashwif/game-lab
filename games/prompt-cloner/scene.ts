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
  [120, 'Terminal dumps pixelated plumber sprites'],
  [150, 'Claude hallucinating proprietary physics engine'],
  [200, 'Lawyer bots sniff the incoming git commits'],
  [250, 'Full 16-bit kart racer compiles in terminal'],
  [300, 'Anthropic safety scanner begins active probe'],
  [500, 'Engine adds unlicensed side-scrolling hedgehog'],
  [1000, 'Speedrun exploit discovered in generated code'],
  [10000, 'Complete bootleg open-world RPG generated'],
  [100000, 'Neural net reproduces entire AAA library'],
  [1000000, 'Sentient AI patents every video game mechanic'],
];

const COLOURS = {
  bg: '#070b12',
  termBg: '#041409',
  termFrame: '#1b2a26',
  termGlow: '#00ff66',
  termScan: 'rgba(0, 255, 102, 0.08)',
  accent: '#00ff88',
  danger: '#ff2a55',
  warning: '#ffb700',
  text: '#e6fff0',
  muted: '#527a69',
  cashedOut: '#38ef7d',
  crashed: '#ff3366',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`ROM SECURED ON USB · Cashed out at ${formatX(view.cashoutX100)}`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Monitor destroyed · Watching anonymously' : 'Watching rogue terminal · Place bet to compile', COLOURS.muted];
  }
  if (crashed) {
    return [`BANHAMMER STRUCK · ${credits(view.stake)} seized by corporate legal`, COLOURS.crashed];
  }
  return [`Prompt compiling · ${credits(view.stake)} riding on rogue build`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastKeyboardTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('zap', 0.7);
      }
      // Rapid keyboard keystrokes during compilation
      if (now - lastKeyboardTick > Math.max(70, 220 - tension * 150)) {
        lastKeyboardTick = now;
        audio.fx('click', 0.35 + 0.35 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeS = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashAgeS / 0.6) : (running ? Math.sin(now * 0.03) * (tension * 2.5) : 0);

    ctx.save();
    // Dark room background
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // Room ambience: server rack lights & glowing wires in background
    ctx.fillStyle = '#0f1822';
    ctx.fillRect(40, 40, 880, 460);

    // Background server racks
    for (let i = 0; i < 5; i++) {
      const rx = 60 + i * 50;
      ctx.fillStyle = '#0b1219';
      ctx.fillRect(rx, 80, 36, 320);
      for (let j = 0; j < 8; j++) {
        const blink = Math.sin(now * 0.003 + i + j) > 0.2;
        ctx.fillStyle = blink ? (j % 2 === 0 ? '#00ffaa' : '#ff4444') : '#152520';
        ctx.fillRect(rx + 6, 95 + j * 36, 6, 4);
      }
    }

    // Spinning Copyright Warning Siren on desk corner
    const sirenAngle = now * 0.008 * (1 + tension * 3);
    const sirenX = 140;
    const sirenY = 180;
    ctx.save();
    ctx.translate(sirenX, sirenY);
    ctx.fillStyle = '#222';
    ctx.fillRect(-18, 10, 36, 20);
    ctx.fillStyle = running || crashed ? (crashed ? COLOURS.danger : `rgba(255, 42, 85, ${0.4 + 0.6 * tension})`) : '#331118';
    ctx.beginPath();
    ctx.arc(0, 10, 16, Math.PI, 0);
    ctx.fill();
    if (running || crashed) {
      // Rotating light beams
      ctx.rotate(sirenAngle);
      const sirenGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 100);
      sirenGrad.addColorStop(0, 'rgba(255, 30, 60, 0.5)');
      sirenGrad.addColorStop(1, 'rgba(255, 30, 60, 0)');
      ctx.fillStyle = sirenGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 90, -0.4, 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Central CRT Monitor Station
    const monX = 350;
    const monY = 100;
    const monW = 540;
    const monH = 340;

    // Monitor outer bezel
    ctx.fillStyle = COLOURS.termFrame;
    ctx.beginPath();
    ctx.roundRect(monX, monY, monW, monH, 18);
    ctx.fill();
    ctx.strokeStyle = '#2d443e';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Monitor stand
    ctx.fillStyle = '#16221f';
    ctx.fillRect(monX + monW / 2 - 35, monY + monH, 70, 30);
    ctx.fillRect(monX + monW / 2 - 80, monY + monH + 26, 160, 12);

    // Inner glowing screen
    ctx.fillStyle = COLOURS.termBg;
    ctx.beginPath();
    ctx.roundRect(monX + 16, monY + 16, monW - 32, monH - 32, 10);
    ctx.fill();

    // Scanlines over CRT screen
    ctx.fillStyle = COLOURS.termScan;
    for (let sl = monY + 18; sl < monY + monH - 18; sl += 4) {
      ctx.fillRect(monX + 16, sl, monW - 32, 1.5);
    }

    // Terminal header inside screen
    ctx.fillStyle = '#0a2e16';
    ctx.fillRect(monX + 20, monY + 20, monW - 40, 26);
    ctx.fillStyle = COLOURS.termGlow;
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('> rogue_llm_compiler.exe --bypass-copyright-filters', monX + 28, monY + 38);

    // Terminal dynamic generated code lines
    const codeY = monY + 70;
    ctx.font = '12px ui-monospace, monospace';
    const lines = [
      `[SYSTEM] Safety bypass level: ${(tension * 100).toFixed(0)}%`,
      `[INJECT] Cloning sprite atlas: 16-bit tiles extracted`,
      `[PROMPT] "Make it like plumber kart racer, no DMCA"`,
      milestoneIndex > 2 ? `[WARN] Claude hallucinating physics engine v2.1` : `[CACHE] Zeroing memory leaks...`,
      milestoneIndex > 4 ? `[ALERT] Corporate crawler sniffing port 8080!` : `[STATUS] Compile thread active`,
    ];
    for (let li = 0; li < lines.length; li++) {
      ctx.fillStyle = li === 4 && tension > 0.4 ? COLOURS.danger : (li === 0 ? COLOURS.warning : COLOURS.accent);
      const lineText = lines[li];
      if (lineText) ctx.fillText(lineText, monX + 28, codeY + li * 18);
    }

    // Mini bootleg rendered game in bottom half of monitor!
    const gameBoxX = monX + 28;
    const gameBoxY = monY + 170;
    const gameBoxW = monW - 56;
    const gameBoxH = 130;
    ctx.fillStyle = '#001a0e';
    ctx.fillRect(gameBoxX, gameBoxY, gameBoxW, gameBoxH);
    ctx.strokeStyle = '#00552b';
    ctx.strokeRect(gameBoxX, gameBoxY, gameBoxW, gameBoxH);

    // Bootleg game rendering: ground and animated bootleg plumber/kart!
    ctx.fillStyle = '#0b5926';
    ctx.fillRect(gameBoxX, gameBoxY + gameBoxH - 24, gameBoxW, 24);

    // Animated bootleg plumber jumping / running
    const runCycle = Math.sin(now * 0.015);
    const spriteX = gameBoxX + 40 + ((view.elapsed * 0.08) % (gameBoxW - 80));
    const spriteJump = Math.abs(Math.sin(now * 0.008)) * 32 * tension;
    const spriteY = gameBoxY + gameBoxH - 42 - spriteJump;

    // Draw pixelated plumber
    ctx.fillStyle = '#ff2233'; // Red hat & shirt
    ctx.fillRect(spriteX, spriteY, 14, 8);
    ctx.fillRect(spriteX + 4, spriteY - 5, 12, 6); // Hat visor
    ctx.fillStyle = '#ffd199'; // Face
    ctx.fillRect(spriteX + 2, spriteY + 4, 10, 6);
    ctx.fillStyle = '#3a2010'; // Mustache
    ctx.fillRect(spriteX + 7, spriteY + 7, 7, 3);
    ctx.fillStyle = '#1b38e0'; // Overalls
    ctx.fillRect(spriteX, spriteY + 10, 14, 10);
    // Shoes
    ctx.fillStyle = '#653010';
    ctx.fillRect(spriteX - 2, spriteY + 18 + (runCycle > 0 ? 2 : 0), 7, 4);
    ctx.fillRect(spriteX + 9, spriteY + 18 + (runCycle < 0 ? 2 : 0), 7, 4);

    // Pixel gold coins floating if high multiplier
    if (tension > 0.2) {
      for (let ci = 0; ci < 4; ci++) {
        const coinX = gameBoxX + 110 + ci * 60;
        const coinY = gameBoxY + 50 + Math.sin(now * 0.006 + ci) * 8;
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(coinX, coinY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(coinX - 1, coinY - 3, 2, 6);
      }
    }

    // Extra retro hedgehog running if milestone >= 500
    if (milestoneIndex >= 6) {
      const sonicX = (spriteX + 80) % (gameBoxW - 40) + gameBoxX;
      ctx.fillStyle = '#1155ff';
      ctx.beginPath();
      ctx.arc(sonicX, gameBoxY + gameBoxH - 34, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff1122';
      ctx.fillRect(sonicX - 8, gameBoxY + gameBoxH - 26, 16, 5);
    }

    // Developer protagonist sitting in foreground left
    const devX = 260;
    const devY = 320;
    // Chair
    ctx.fillStyle = '#1e1c24';
    ctx.fillRect(devX - 30, devY + 40, 60, 90);
    ctx.fillRect(devX - 10, devY + 130, 20, 50);

    // Hoodie body
    ctx.fillStyle = '#223548';
    ctx.beginPath();
    ctx.ellipse(devX, devY + 70, 36, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Frantic typing arms
    const typeOffsetL = Math.sin(now * 0.04) * 6;
    const typeOffsetR = Math.cos(now * 0.04) * 6;
    ctx.strokeStyle = '#2d4860';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(devX - 20, devY + 60);
    ctx.lineTo(devX + 45 + typeOffsetL, devY + 80);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(devX + 15, devY + 60);
    ctx.lineTo(devX + 65 + typeOffsetR, devY + 82);
    ctx.stroke();

    // Dev head (hoodie)
    const headNod = Math.sin(now * 0.02) * (2 + tension * 4);
    ctx.fillStyle = '#1a2938';
    ctx.beginPath();
    ctx.arc(devX, devY + 16 + headNod, 26, 0, Math.PI * 2);
    ctx.fill();

    // Nervous face silhouette inside hood
    ctx.fillStyle = '#ffd1a4';
    ctx.beginPath();
    ctx.arc(devX + 6, devY + 18 + headNod, 16, -0.6, 1.6);
    ctx.fill();

    // Wide anxious eyes looking at terminal
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(devX + 13, devY + 14 + headNod, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(devX + 15, devY + 14 + headNod, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Flying sweat droplets when tension is high
    if (tension > 0.25 && !crashed) {
      const sweatTime = (now * 0.005) % 1;
      ctx.fillStyle = '#8ce8ff';
      ctx.beginPath();
      ctx.arc(devX - 8 - sweatTime * 20, devY + headNod - sweatTime * 15, 3.5 * (1 - sweatTime), 0, Math.PI * 2);
      ctx.fill();
    }

    // Keyboard on desk
    ctx.fillStyle = '#141c22';
    ctx.fillRect(320, 420, 150, 20);
    ctx.fillStyle = '#00ff88';
    for (let k = 0; k < 10; k++) {
      ctx.fillRect(326 + k * 14, 424, 9, 6);
    }

    // Multiplier & Status Banner Overlay (center top HUD)
    const multColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.accent);
    ctx.textAlign = 'center';

    // HUD Container
    ctx.fillStyle = 'rgba(4, 15, 10, 0.88)';
    ctx.strokeStyle = multColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(monX + 110, monY + 28, monW - 220, 80, 10);
    ctx.fill();
    ctx.stroke();

    // Large Multiplier readout
    const punch = crashed ? (1 - clamp01((crashAgeS - 0.12) / 0.25)) ** 2 : 0;
    const multSize = 50 * (1 + 0.15 * punch + 0.08 * depth);
    ctx.font = `800 ${multSize}px ui-monospace, monospace`;
    ctx.fillStyle = multColor;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 12;
    ctx.fillText(formatX(view.currentX100), monX + monW / 2, monY + 84);
    ctx.shadowBlur = 0;

    // Header Game Name & Safety Danger Bar
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText('PROMPT CLONER', 50, 50);

    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('ROGUE RETRO ROM COMPILER // DMCA EVASION TERMINAL', 50, 70);

    // DMCA Scanner Threat Bar
    const threatBarW = 220;
    ctx.fillStyle = '#111e19';
    ctx.fillRect(50, 90, threatBarW, 14);
    const threatGrad = ctx.createLinearGradient(50, 0, 50 + threatBarW, 0);
    threatGrad.addColorStop(0, '#00ff88');
    threatGrad.addColorStop(0.6, '#ffaa00');
    threatGrad.addColorStop(1, '#ff2255');
    ctx.fillStyle = threatGrad;
    ctx.fillRect(52, 92, (threatBarW - 4) * (crashed ? 1 : tension), 10);
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.text;
    ctx.fillText(`FILTER RADAR: ${(crashed ? 100 : tension * 100).toFixed(0)}% DETECTED`, 54, 86);

    // CRASHED STATE: Giant Banhammer smashes monitor into smoking shards!
    if (crashed) {
      const hammerDrop = Math.min(1, crashAgeS / 0.15);
      const hammerY = monY + 20 + hammerDrop * 80;
      const hammerX = monX + monW / 2 + 10;

      // Cracked glass lines on monitor
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hammerX, hammerY);
      ctx.lineTo(hammerX - 120, hammerY - 80);
      ctx.moveTo(hammerX, hammerY);
      ctx.lineTo(hammerX + 140, hammerY - 60);
      ctx.moveTo(hammerX, hammerY);
      ctx.lineTo(hammerX - 100, hammerY + 120);
      ctx.moveTo(hammerX, hammerY);
      ctx.lineTo(hammerX + 110, hammerY + 90);
      ctx.stroke();

      // Huge Metallic Banhammer
      ctx.save();
      ctx.translate(hammerX, hammerY - (1 - hammerDrop) * 200);
      ctx.rotate(-0.25);
      // Hammer head
      ctx.fillStyle = '#85909c';
      ctx.fillRect(-60, -35, 120, 70);
      ctx.fillStyle = '#49525c';
      ctx.fillRect(-55, -30, 110, 60);
      ctx.fillStyle = '#ff2244';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BAN', 0, 6);
      // Hammer handle
      ctx.fillStyle = '#593214';
      ctx.fillRect(-10, -180, 20, 150);
      ctx.restore();

      // Flashing TOS Violation overlay
      ctx.fillStyle = `rgba(255, 30, 70, ${0.45 * Math.sin(now * 0.015) + 0.45})`;
      ctx.fillRect(monX + 16, monY + 16, monW - 32, monH - 32);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ POLICY ERROR 451: DMCA BANHAMMER ]', monX + monW / 2, monY + monH / 2 + 50);
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText('WORKSTATION PURGED · HARD DRIVE SMASHED', monX + monW / 2, monY + monH / 2 + 80);
    }

    // CASHOUT CELEBRATION STATE: Yanked encrypted USB drive & Fire escape ROM secured!
    if (cashed && !crashed) {
      ctx.save();
      ctx.translate(480, 240);
      ctx.fillStyle = 'rgba(0, 30, 15, 0.92)';
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-220, -75, 440, 150, 14);
      ctx.fill();
      ctx.stroke();

      // Glowing USB drive icon
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(-180, -25, 48, 50);
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(-192, -15, 14, 30);
      ctx.fillStyle = '#111';
      ctx.fillRect(-188, -10, 6, 8);
      ctx.fillRect(-188, 2, 6, 8);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.fillText('ROM EXPORTED TO USB!', -110, -15);
      ctx.font = '600 15px ui-monospace, monospace';
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.fillText(`BUILD SAVED AT ${formatX(view.cashoutX100 ?? 100)}`, -110, 12);
      ctx.fillStyle = '#8ee6b4';
      ctx.font = '500 13px system-ui, sans-serif';
      ctx.fillText('Sliding down fire escape · Law enforcement dodged', -110, 36);
      ctx.restore();
    }

    // Bottom Milestone & Stake Info HUD
    const passed = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const milestoneCaption = passed ? passed[1] : (crashed ? 'SESSION TERMINATED BY CORPORATE ENFORCERS' : 'Awaiting prompt injection...');

    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(milestoneCaption, 480, 485, 880);

    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 515, 880);

    ctx.restore();
  }

  return { draw };
}
