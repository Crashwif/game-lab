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
  [120, 'Terminal boots up clean prompt session'],
  [150, 'Generated sprite looks 90% like an Italian plumber'],
  [200, 'Physics engine compiles with zero warnings'],
  [250, 'Discord testers spam pings in awe'],
  [300, 'Anthropic trust & safety bot scans the repo'],
  [500, 'Automated DMCA crawler trips wire alerts'],
  [1000, 'Legal subpoena emails flood customer inbox'],
  [10000, 'Corporate lawyers rappelling down office windows'],
  [100000, 'Entire server rack starts glowing radioactive neon'],
  [1000000, 'Ascended into fully sovereign bootleg godhood'],
];

const COLOURS = {
  bgDark: '#080c14',
  terminalGreen: '#39ff14',
  amberWarn: '#ffaa00',
  laserRed: '#ff2244',
  cyanNeon: '#00e5ff',
  crashed: '#ff3366',
  cashedOut: '#00ffaa',
  gold: '#ffd700',
  textMuted: '#7f93a8',
  textBright: '#eaf2fa',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Exported to itch.io at ${formatX(view.cashoutX100)} · Bootleg safe!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Terminal smashed · Watching spectator' : 'Observing forbidden prompt terminal', COLOURS.textMuted];
  }
  if (crashed) return [`Gavel struck! Lost ${credits(view.stake)} to legal settlement`, COLOURS.crashed];
  return [`Dev session hot · ${credits(view.stake)} in the memory buffer`, COLOURS.cyanNeon];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastPromptTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
      audio.fx('door', 0.5);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('shatter', 1);
      audio.fx('siren', 0.6);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('notify', 0.5);
      }
      const tickCadence = Math.max(120, 400 - tension * 280);
      if (view.elapsed - lastPromptTick > tickCadence && view.cashoutX100 === null) {
        audio.fx('tick', 0.35 + tension * 0.4);
        lastPromptTick = view.elapsed;
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.5) ** 2 : (running ? Math.sin(view.elapsed * 0.05) * (tension * 2.2) : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(crashSec * 80 + view.elapsed * 0.1), shake * Math.cos(crashSec * 60));

    // Room background with server rack outlines
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#060a12');
    bgGrad.addColorStop(1, '#0e1826');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Background server racks & blinking LEDs
    ctx.fillStyle = '#0a1320';
    ctx.fillRect(40, 80, 100, 360);
    ctx.fillRect(820, 80, 100, 360);
    for (let row = 0; row < 12; row++) {
      const ledY = 100 + row * 28;
      const glowOn = ((view.elapsed + row * 150) % 600) < 300;
      ctx.fillStyle = glowOn ? (tension > 0.6 ? COLOURS.laserRed : COLOURS.cyanNeon) : '#122236';
      ctx.fillRect(52, ledY, 6, 6);
      ctx.fillRect(64, ledY, 6, 6);
      ctx.fillRect(840, ledY, 6, 6);
      ctx.fillRect(852, ledY, 6, 6);
    }

    // Corporate Security Surveillance Lasers
    if (running || crashed) {
      const laserCount = 3 + Math.floor(tension * 5);
      ctx.lineWidth = 1.5 + tension * 1.5;
      for (let l = 0; l < laserCount; l++) {
        const sweep = Math.sin(view.elapsed * 0.002 + l * 1.8);
        const originX = l % 2 === 0 ? 90 : 870;
        const originY = 90 + l * 35;
        const targetX = 480 + sweep * (180 - tension * 120);
        const targetY = 320 + Math.cos(view.elapsed * 0.003 + l) * 50;
        ctx.strokeStyle = `rgba(255, 34, 68, ${0.25 + 0.55 * tension})`;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        // Laser convergence dot on screen
        ctx.fillStyle = COLOURS.laserRed;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 2.5 + tension * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Terminal Monitor Shell (CRT style)
    const crtX = 230;
    const crtY = 140;
    const crtW = 500;
    const crtH = 270;

    // Monitor bezel
    ctx.fillStyle = '#182434';
    ctx.beginPath();
    ctx.roundRect(crtX - 16, crtY - 16, crtW + 32, crtH + 52, 16);
    ctx.fill();
    ctx.strokeStyle = '#2b3e58';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Stand
    ctx.fillStyle = '#101a26';
    ctx.fillRect(450, crtY + crtH + 36, 60, 40);
    ctx.fillRect(410, crtY + crtH + 72, 140, 14);

    // CRT Screen Glass
    const screenGrad = ctx.createRadialGradient(480, 275, 40, 480, 275, 260);
    screenGrad.addColorStop(0, '#0f2918');
    screenGrad.addColorStop(1, '#051109');
    ctx.fillStyle = screenGrad;
    ctx.beginPath();
    ctx.roundRect(crtX, crtY, crtW, crtH, 8);
    ctx.fill();

    // Terminal Assembly / Prompt Feed
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(crtX, crtY, crtW, crtH, 8);
    ctx.clip();

    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let sy = crtY; sy < crtY + crtH; sy += 4) {
      ctx.fillRect(crtX, sy, crtW, 2);
    }

    // Terminal code lines
    const codeSnippets = [
      '>> PROMPT: synth sprite 100% legal distinct jump hero',
      'CLAUDE: Disassembling 6502 bytecode... (OK)',
      'PATCH: Overalls tint -> #39FF14, Moustache -> +4px',
      'BYPASS: anthropic_filter.ts [WARNED - HIGH RISK]',
      'ASM: JMP 0x8080 ; INJECTING CUSTOM RUNTIME',
      'PHYSICS: JumpArc(gravity=0.42, speed=8.8) COMPILED',
      'DMCA_STATUS: Crawlers pinging port 8000...',
      'WARN: Legal department subpoena inbound!',
    ];
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    const scroll = (view.elapsed * 0.05) % 24;
    for (let c = 0; c < 9; c++) {
      const idx = (c + Math.floor(view.elapsed / 480)) % codeSnippets.length;
      const snippet = codeSnippets[idx] ?? '';
      ctx.fillStyle = c === 0 ? COLOURS.amberWarn : 'rgba(57, 255, 20, 0.65)';
      ctx.fillText(snippet, crtX + 16, crtY + 30 + c * 22 - scroll);
    }

    // Center bootleg mutating sprite preview window
    const spriteBoxX = 550;
    const spriteBoxY = 250;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(spriteBoxX, spriteBoxY, 160, 140);
    ctx.strokeStyle = tension > 0.5 ? COLOURS.laserRed : COLOURS.terminalGreen;
    ctx.strokeRect(spriteBoxX, spriteBoxY, 160, 140);

    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.amberWarn;
    ctx.fillText('SPRITE RIPPER v0.9', spriteBoxX + 10, spriteBoxY + 16);

    // Bootleg Character Animation (Plumber / Hedgehog mutant)
    const bounce = Math.abs(Math.sin(view.elapsed * 0.012)) * 14;
    const charX = spriteBoxX + 80;
    const charY = spriteBoxY + 105 - bounce;

    // Body / Overalls
    ctx.fillStyle = '#ff2244';
    ctx.fillRect(charX - 16, charY - 26, 32, 24);
    ctx.fillStyle = '#1e66d0'; // Blue overalls
    ctx.fillRect(charX - 14, charY - 14, 28, 16);
    // Head / Hat
    ctx.fillStyle = '#ffd1a4'; // Face
    ctx.fillRect(charX - 12, charY - 44, 24, 20);
    ctx.fillStyle = tension > 0.4 ? '#00e5ff' : '#ff2244'; // Cap turns sonic cyan with tension
    ctx.fillRect(charX - 16, charY - 52, 34, 10);
    // Mustache
    ctx.fillStyle = '#2b1b17';
    ctx.fillRect(charX - 8, charY - 32, 18, 6);
    // Sonic Quills on back
    if (tension > 0.25) {
      ctx.fillStyle = '#0055ff';
      ctx.beginPath();
      ctx.moveTo(charX - 16, charY - 48);
      ctx.lineTo(charX - 32, charY - 42);
      ctx.lineTo(charX - 16, charY - 36);
      ctx.fill();
    }
    // Glitch aura
    if (tension > 0.6) {
      ctx.strokeStyle = `rgba(0, 229, 255, ${Math.sin(view.elapsed * 0.03) * 0.5 + 0.5})`;
      ctx.strokeRect(charX - 22, charY - 56, 44, 60);
    }

    ctx.restore(); // Exit CRT clipping

    // Big Multiplier Display (inside or overlaid on monitor)
    const multY = 195;
    ctx.textAlign = 'center';
    ctx.font = '700 76px ui-monospace, monospace';
    const multColour = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : (tension > 0.7 ? COLOURS.laserRed : COLOURS.terminalGreen));
    ctx.fillStyle = multColour;
    ctx.shadowColor = multColour;
    ctx.shadowBlur = 18;
    ctx.fillText(formatX(view.currentX100), 400, multY);
    ctx.shadowBlur = 0;

    // Header & HUD Top
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.textBright;
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillText('CLAUDE RIP RUN', 480, 48);
    ctx.font = '600 15px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.amberWarn;
    ctx.fillText('BOOTLEG RETRO ENGINE · PROMPT BEFORE THE DMCA GAVEL STRIKES', 480, 76);

    // Milestone / Status Banner
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const milestoneText = activeMilestone ? activeMilestone[1] : (crashed ? 'SESSION TERMINATED BY MONOLITHIC DMCA STAMP' : (view.cashoutX100 ? 'SUCCESSFULLY SHIPPED TO ITCH.IO!' : 'READY TO COMPILE'));

    ctx.fillStyle = crashed ? COLOURS.laserRed : (view.cashoutX100 ? COLOURS.cashedOut : COLOURS.amberWarn);
    ctx.font = '700 18px ui-monospace, monospace';
    ctx.fillText(`[ ${milestoneText} ]`, 480, 452, 900);

    // Bottom Stake & Cashout Line
    const [line, color] = stakeLine(view);
    ctx.fillStyle = color;
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(line, 480, 498, 900);

    // Tension Gauge Meter
    const gaugeW = 440;
    const gaugeH = 8;
    const gaugeX = 260;
    const gaugeY = 422;
    ctx.fillStyle = '#131e2b';
    ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
    const meterFill = running ? gaugeW * (0.15 + 0.85 * (tension * 0.7 + depth * 0.3)) : (crashed ? gaugeW : 0);
    ctx.fillStyle = tension > 0.65 ? COLOURS.laserRed : COLOURS.terminalGreen;
    ctx.fillRect(gaugeX, gaugeY, meterFill, gaugeH);

    // CASHOUT OVERLAY: Clean escape with floppy disk
    if (view.cashoutX100 !== null && !crashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, 960, 540);

      // Floppy Disk Copy Banner
      const bannerY = 240 + Math.sin(view.elapsed * 0.005) * 8;
      ctx.fillStyle = '#0a2318';
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(220, bannerY - 70, 520, 140, 18);
      ctx.fill();
      ctx.stroke();

      // Floppy disk icon
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(250, bannerY - 45, 50, 50);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(260, bannerY - 45, 30, 24);
      ctx.fillStyle = '#000000';
      ctx.fillRect(280, bannerY - 40, 6, 14);

      ctx.textAlign = 'left';
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.fillText('CLEAN EXPORT: "PLUMBER BROS LIBRE"', 320, bannerY - 18);
      ctx.fillStyle = COLOURS.textBright;
      ctx.font = '600 16px ui-monospace, monospace';
      ctx.fillText(`Uploaded via proxy @ ${formatX(view.cashoutX100)} · Escaped fire exit!`, 320, bannerY + 14);
      ctx.restore();
    }

    // CRASH OVERLAY: Gigantic Monolithic Red DMCA Gavel / Stamp
    if (crashed) {
      const dropProgress = clamp01(crashSec / 0.18);
      const gavelY = dropProgress < 1 ? -120 + dropProgress * 390 : 270;

      // Shatter glass shards flying
      const shardCount = 18;
      for (let s = 0; s < shardCount; s++) {
        const angle = (s / shardCount) * Math.PI * 2;
        const dist = Math.min(260, crashSec * 450);
        const shardX = 480 + Math.cos(angle) * dist;
        const shardY = 270 + Math.sin(angle) * dist * 0.7;
        ctx.fillStyle = s % 2 === 0 ? 'rgba(255, 34, 68, 0.85)' : 'rgba(57, 255, 20, 0.75)';
        ctx.beginPath();
        ctx.arc(shardX, shardY, 6 * (1 - clamp01(crashSec / 0.9)), 0, Math.PI * 2);
        ctx.fill();
      }

      // Giant DMCA Stamp Block
      ctx.save();
      ctx.translate(480, gavelY);
      ctx.rotate(-0.06);

      // Stamp Handle
      ctx.fillStyle = '#4a0e18';
      ctx.fillRect(-22, -180, 44, 180);
      ctx.fillStyle = '#801826';
      ctx.fillRect(-12, -180, 24, 180);

      // Huge Stamp Base
      ctx.fillStyle = '#b3122c';
      ctx.beginPath();
      ctx.roundRect(-240, 0, 480, 84, 12);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 42px system-ui, sans-serif';
      ctx.fillText('CEASE & DESIST', 0, 56);

      ctx.restore();

      // Smoke and Spark debris overlay
      if (crashSec > 0.15) {
        ctx.fillStyle = `rgba(255, 40, 40, ${clamp01(0.35 - crashSec * 0.15)})`;
        ctx.fillRect(0, 0, 960, 540);
      }
    }

    ctx.restore();
  }

  return { draw };
}
