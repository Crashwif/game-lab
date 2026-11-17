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
  bg: '#080d14',
  rackDark: '#111a24',
  rackLight: '#1d2c3d',
  terminalGreen: '#3bf589',
  diffRed: '#ff3b5c',
  diffGreen: '#23d16f',
  accent: '#00e5ff',
  warning: '#ffb300',
  text: '#f0f6fc',
  muted: '#768390',
  crashed: '#ff3366',
  cashedOut: '#00ffaa',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Patch notes published on public GitHub repo'],
  [150, 'Autonomous scraper flags one unchecked pointer'],
  [200, 'AI crawler synthesizes working shellcode script'],
  [250, 'Server update progress bar hangs at 99 percent'],
  [300, 'Automated exploit payload bypasses corporate NAT'],
  [500, 'Security Slack channel triggers 400 pings'],
  [1000, 'Zero-day bot rewrites root admin permissions'],
  [10000, 'Every office smart kettle starts mining monero'],
  [100000, 'Threat intelligence report marks sector critical'],
  [1000000, 'Superintelligent worm buys out the holding corp'],
];

const DIFF_SNIPPETS = [
  '-  if (req.user == NULL) return;',
  '+  // TODO: verify auth signature',
  '+  char buffer[64]; memcpy(buf, req, len);',
  '-  free(session_token);',
  '+  system(payload_exec_ptr);',
  '+  chmod 777 /etc/shadow',
  '@@ -412,8 +412,12 @@ void dispatch()',
  '+  eval(decode_b64(raw_payload));',
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`AIRLOCK SEALED AT ${formatX(view.cashoutX100)} · Zero-trust safe`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Exploit deployed · server compromised' : 'Observing git diff stream · idle', COLOURS.muted];
  }
  if (crashed) {
    return [`Payload executed! Lost ${credits(view.stake)} in exploit`, COLOURS.crashed];
  }
  return [`Firmware patch flashing · ${credits(view.stake)} deployed`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'static' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSpiderTick = 0;

  function drawBackground(ctx: CanvasRenderingContext2D, elapsed: number, tension: number, crashed: boolean): void {
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Enterprise Server Racks on flanks
    for (let i = 0; i < 2; i++) {
      const rx = i === 0 ? 30 : 810;
      ctx.fillStyle = COLOURS.rackDark;
      ctx.fillRect(rx, 40, 120, 440);
      ctx.fillStyle = COLOURS.rackLight;
      ctx.strokeRect(rx, 40, 120, 440);

      // Server rack units & blinking drive lights
      for (let u = 0; u < 11; u++) {
        const uy = 55 + u * 38;
        ctx.fillStyle = '#0a1017';
        ctx.fillRect(rx + 6, uy, 108, 30);

        // Blinking LEDs
        for (let led = 0; led < 5; led++) {
          const blink = Math.sin(elapsed * 0.012 + u * 4 + led * 1.7) > 0.1;
          const isAlarm = crashed || (tension > 0.6 && led === 4);
          ctx.fillStyle = isAlarm
            ? (blink ? COLOURS.diffRed : '#550812')
            : (blink ? COLOURS.terminalGreen : '#0d4a25');
          ctx.beginPath();
          ctx.arc(rx + 16 + led * 18, uy + 15, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Git diff stream in background
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const drift = (elapsed * 0.035) % 24;
    for (let row = 0; row < 18; row++) {
      const idx = (row + Math.floor(elapsed * 0.003)) % DIFF_SNIPPETS.length;
      const snippet = DIFF_SNIPPETS[idx] ?? '';
      const isAdd = snippet.startsWith('+');
      const isDel = snippet.startsWith('-');
      ctx.fillStyle = isDel ? 'rgba(255, 59, 92, 0.22)' : isAdd ? 'rgba(35, 209, 111, 0.25)' : 'rgba(118, 131, 144, 0.18)';
      ctx.fillText(snippet, 175, 45 + row * 24 - drift, 610);
    }
  }

  function drawAdminAndConsole(
    ctx: CanvasRenderingContext2D,
    elapsed: number,
    tension: number,
    cashedOut: boolean,
    crashed: boolean
  ): void {
    const cx = 480;
    const cy = 345;
    const jitter = crashed ? 0 : Math.sin(elapsed * 0.04) * (tension * 4.5);

    // Terminal desk glow
    const deskGlow = ctx.createRadialGradient(cx, cy + 20, 20, cx, cy + 20, 190);
    deskGlow.addColorStop(0, cashedOut ? 'rgba(0, 255, 170, 0.2)' : crashed ? 'rgba(255, 51, 102, 0.25)' : 'rgba(0, 229, 255, 0.15)');
    deskGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = deskGlow;
    ctx.fillRect(cx - 200, cy - 60, 400, 160);

    // Sysadmin body
    ctx.save();
    ctx.translate(cx + jitter, cy);

    // Chair
    ctx.fillStyle = '#0c151f';
    ctx.fillRect(-35, -45, 70, 65);

    // Trembling IT Admin Torso & Arms
    ctx.fillStyle = cashedOut ? '#1a4435' : crashed ? '#4a111a' : '#1e3047';
    ctx.beginPath();
    ctx.roundRect(-28, -25, 56, 50, 8);
    ctx.fill();

    // Head
    const headTilt = Math.sin(elapsed * 0.02) * (tension * 0.12);
    ctx.rotate(headTilt);
    ctx.fillStyle = '#e8b897';
    ctx.beginPath();
    ctx.arc(0, -50, 20, 0, Math.PI * 2);
    ctx.fill();

    // Disheveled hair
    ctx.fillStyle = '#2d1f18';
    ctx.beginPath();
    ctx.arc(0, -58, 20, Math.PI, Math.PI * 2);
    ctx.lineTo(22, -48);
    ctx.lineTo(12, -44);
    ctx.lineTo(0, -48);
    ctx.lineTo(-12, -44);
    ctx.lineTo(-22, -48);
    ctx.closePath();
    ctx.fill();

    // Eyeballs + Bloodshot circles
    const eyeSize = 4.5 + tension * 2.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-8, -50, eyeSize, 0, Math.PI * 2);
    ctx.arc(8, -50, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tension > 0.4 ? '#ff2a2a' : '#0b1017';
    ctx.beginPath();
    ctx.arc(-8, -50, 2, 0, Math.PI * 2);
    ctx.arc(8, -50, 2, 0, Math.PI * 2);
    ctx.fill();

    // Sweating drops under tension
    if (tension > 0.25 && !cashedOut) {
      const dropY = -48 + ((elapsed * 0.05) % 20);
      ctx.fillStyle = '#5ce1e6';
      ctx.beginPath();
      ctx.arc(16, dropY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Energy Drink Can on desk
    ctx.fillStyle = '#10c469';
    ctx.fillRect(40, -15, 14, 25);
    ctx.fillStyle = '#eaf0f6';
    ctx.fillRect(42, -18, 10, 3);
    ctx.restore();

    // Terminal Monitor / Drag Progress Bar
    ctx.fillStyle = '#111822';
    ctx.strokeStyle = cashedOut ? COLOURS.cashedOut : crashed ? COLOURS.crashed : COLOURS.accent;
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 160, cy + 18, 320, 68);
    ctx.strokeRect(cx - 160, cy + 18, 320, 68);

    // Progress bar fill calculation: hangs comically at 99.4%
    const progressFill = cashedOut ? 1 : crashed ? 0.99 : Math.min(0.994, 0.15 + tension * 0.844);
    ctx.fillStyle = '#1a2332';
    ctx.fillRect(cx - 145, cy + 34, 290, 20);
    ctx.fillStyle = cashedOut ? COLOURS.cashedOut : crashed ? COLOURS.diffRed : COLOURS.terminalGreen;
    ctx.fillRect(cx - 145, cy + 34, 290 * progressFill, 20);

    // Cursor indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    const pct = cashedOut ? '100% REBOOT COMPLETE' : crashed ? 'DIFF EXPLOITED - ERROR 0xDEAD' : `FIRMWARE UPDATE: ${(progressFill * 100).toFixed(1)}%`;
    ctx.fillText(pct, cx, cy + 48);

    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText(cashedOut ? 'SYSTEM AIR-GAPPED' : 'DO NOT POWER OFF OR DISCONNECT', cx, cy + 74);
  }

  function drawSpiders(ctx: CanvasRenderingContext2D, elapsed: number, tension: number, crashed: boolean): void {
    if (tension <= 0.05 && !crashed) return;
    const spiderCount = crashed ? 16 : Math.floor(tension * 12) + 1;

    for (let i = 0; i < spiderCount; i++) {
      const seed = i * 67.89;
      const progress = ((elapsed * (0.0008 + tension * 0.0015) + seed) % 1);
      // Crawl path from server racks inward toward terminal
      const fromLeft = i % 2 === 0;
      const startX = fromLeft ? 150 : 810;
      const endX = fromLeft ? 380 : 580;
      const sx = startX + (endX - startX) * progress;
      const sy = 120 + ((i * 35) % 240) + Math.sin(elapsed * 0.02 + seed) * 8;

      // Spider body
      ctx.fillStyle = crashed ? '#ff1744' : '#ff4081';
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Glowing cyber legs
      ctx.strokeStyle = crashed ? 'rgba(255, 23, 68, 0.7)' : 'rgba(255, 64, 129, 0.6)';
      ctx.lineWidth = 1.5;
      const legWiggle = Math.sin(elapsed * 0.05 + i * 2) * 4;
      for (let leg = -1; leg <= 1; leg += 2) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + leg * 8, sy - 5 + legWiggle);
        ctx.lineTo(sx + leg * 14, sy + 3);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + leg * 9, sy + 6 - legWiggle);
        ctx.stroke();
      }
    }
  }

  function drawAirlockSafe(ctx: CanvasRenderingContext2D, elapsed: number): void {
    // Blast doors closed visually
    ctx.fillStyle = 'rgba(0, 255, 170, 0.08)';
    ctx.fillRect(0, 0, 960, 540);

    // Big glowing vault seal banner
    ctx.fillStyle = 'rgba(5, 25, 18, 0.9)';
    ctx.strokeStyle = COLOURS.cashedOut;
    ctx.lineWidth = 3;
    ctx.fillRect(200, 235, 560, 68);
    ctx.strokeRect(200, 235, 560, 68);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.cashedOut;
    ctx.font = '700 24px ui-monospace, monospace';
    ctx.fillText('⚡ AIR-GAP VAULT DOOR SEALED ⚡', 480, 264);
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillStyle = '#b3ffe2';
    const pulse = Math.sin(elapsed * 0.01) > 0 ? ' [ETHERNET DISCONNECTED]' : ' [ZERO-TRUST VERIFIED]';
    ctx.fillText('PRISTINE ISOLATION ACQUIRED' + pulse, 480, 288);
  }

  function drawCrashScreen(ctx: CanvasRenderingContext2D, elapsed: number, age: number): void {
    // Thermal paper receipt spew + ASCII skull glitch
    const scanAlpha = Math.sin(age * 30) > 0 ? 0.35 : 0.15;
    ctx.fillStyle = `rgba(255, 20, 50, ${scanAlpha})`;
    ctx.fillRect(0, 0, 960, 540);

    // ASCII skull glitch prompt
    ctx.fillStyle = 'rgba(12, 0, 4, 0.92)';
    ctx.fillRect(220, 180, 520, 150);
    ctx.strokeStyle = COLOURS.crashed;
    ctx.lineWidth = 3;
    ctx.strokeRect(220, 180, 520, 150);

    ctx.font = '700 15px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.crashed;
    ctx.textAlign = 'center';
    ctx.fillText('☠ REVERSE-ENGINEER EXPLOIT SUCCEEDED ☠', 480, 215);
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillStyle = '#ff8ca3';
    ctx.fillText('ROOT ACCESS REVOKED · MONERO MINER INJECTED', 480, 245);
    ctx.fillText('ALL OFFICE MONITORS CONVERTED TO ASCII SKULLS', 480, 270);

    // Flying receipts
    for (let r = 0; r < 8; r++) {
      const rx = 100 + r * 110 + Math.sin(elapsed * 0.005 + r) * 20;
      const ry = ((age * 380 + r * 80) % 580) - 40;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx, ry, 64, 42);
      ctx.fillStyle = '#111111';
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('0xDEADBEEF', rx + 6, ry + 12);
      ctx.fillText('THERMAL LOG', rx + 6, ry + 22);
      ctx.fillText('PANIC DUMP', rx + 6, ry + 32);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);

    audio.update(view.phase, tension);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Trigger audio cues
    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('door', 0.9);
      audio.fx('kaching', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 1.0);
      audio.fx('siren', 0.6);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('notify', 0.8);
      }
      const tickInterval = Math.max(120, 600 - tension * 450);
      if (view.elapsed - lastSpiderTick > tickInterval && !cashedOut) {
        audio.fx('tick', 0.3 + 0.5 * tension);
        lastSpiderTick = view.elapsed;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 8 * clamp01(1 - age / 0.6) ** 2 : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate(shake * Math.sin(age * 80), shake * Math.sin(age * 63));
    }

    // 1. Background, Server Racks & Git Diff Waterfall
    drawBackground(ctx, view.elapsed, tension, crashed);

    // 2. Swarm Digital Spiders crawling inward
    drawSpiders(ctx, view.elapsed, tension, crashed);

    // 3. Sysadmin Protagonist & Firmware Progress Bar
    drawAdminAndConsole(ctx, view.elapsed, tension, cashedOut, crashed);

    // 4. Airlock Safe or Crash Overlays
    if (cashedOut) {
      drawAirlockSafe(ctx, view.elapsed);
    } else if (crashed) {
      drawCrashScreen(ctx, view.elapsed, age);
    }

    // 5. High-tech HUD Headers & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Mission
    ctx.fillStyle = COLOURS.accent;
    ctx.font = '700 24px ui-monospace, monospace';
    ctx.fillText('PATCH DIFF PANIC', 480, 26);
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('DEPLOY FIRMWARE BEFORE AUTONOMOUS BOTS REVERSE-ENGINEER THE DIFF', 480, 48);

    // Massive central multiplier display
    const multColor = cashedOut ? COLOURS.cashedOut : crashed ? COLOURS.crashed : tension > 0.7 ? COLOURS.warning : COLOURS.text;
    ctx.fillStyle = multColor;
    ctx.font = '800 68px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 114);

    // Milestone ticker / Subtitle line
    const passed = running ? MILESTONES[milestone - 1] : undefined;
    const statusText = passed ? passed[1] : running ? 'Awaiting initial repo diff release...' : crashed ? 'SYSTEM KERNEL PANIC' : 'Sysadmin clutching caffeine... Ready';
    ctx.font = '600 17px ui-monospace, monospace';
    ctx.fillStyle = running && tension > 0.6 ? COLOURS.warning : COLOURS.text;
    ctx.fillText(statusText, 480, 162, 860);

    // Bottom Stake Status Bar
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 20px ui-monospace, monospace';
    ctx.fillText(line, 480, 505, 860);

    ctx.restore();
  }

  return { draw };
}
