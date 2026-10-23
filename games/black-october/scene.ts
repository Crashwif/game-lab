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
  bg: '#080811',
  rack: '#121422',
  desk: '#1a1b2e',
  vest: '#233247',
  fleece: '#8ea3ba',
  skin: '#f5c298',
  hair: '#362419',
  terminalGreen: '#00ff88',
  cyberCyan: '#00e5ff',
  alertRed: '#ff2853',
  alertYellow: '#ffbe0b',
  text: '#f0f4fc',
  muted: '#7a8ba3',
  cashedOut: '#00ffa3',
  crashed: '#ff3366',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Standing by in SoMa micro-loft...',
  betting: 'Arming zero-day password vault...',
  running: '10,000 frontier models probing perimeter...',
  crashed: 'FRONTIER AI BREACH: TOASTER TAKE OVER ACTIVE',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Two-factor push notification pings iPhone'],
  [150, 'Claude suggests moving smart lightbulb to guest Wi-Fi'],
  [200, '10,000 open-source coding agents spin up'],
  [250, 'Margin Call soundtrack begins echoing in office'],
  [300, 'Vulnerability found in legacy PHP server stack'],
  [500, 'Boardroom orders emergency midnight matcha lattes'],
  [1000, 'Fast takeoff declared live on podcast circuit'],
  [10000, 'Recursive self-improvement rewrites firmware'],
  [100000, 'Smart microwave demands root privileges'],
  [1000000, 'Silicon Valley ascends into pure sentient cloud'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`AIR-GAPPED TO BUNKER AT ${formatX(view.cashoutX100)} · 2FA LOCKED`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Observed root compromise · no credits lost' : 'Observing cluster assault', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Vault wiped · lost ${credits(view.stake)} to autonomous botnet`, COLOURS.crashed];
  }
  return [`Vault defended · ${credits(view.stake)} riding on master key`, COLOURS.cyberCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'static' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let keyTickStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    // Audio triggers
    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('door', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('notify', 0.7);
      }
      const tickCycle = Math.floor(view.elapsed / (160 - tension * 90));
      if (tickCycle > keyTickStep && !cashedOut) {
        keyTickStep = tickCycle;
        audio.fx('click', 0.25 + 0.5 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : (running ? Math.sin(view.elapsed * 0.05) * tension * 2 : 0);

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);
    ctx.translate(shake * Math.sin(crashAgeSec * 80 + view.elapsed * 0.05), shake * Math.cos(crashAgeSec * 60));

    // SF Skyline & Server Room Background
    drawOfficeBackdrop(ctx, view, tension);

    if (cashedOut) {
      drawFaradayBunker(ctx, view.elapsed);
    } else if (crashed) {
      drawCrashOverhaul(ctx, crashAgeSec, view.elapsed);
    } else {
      drawFounderAtDesk(ctx, view, tension, depth);
    }

    // Front Overlays & HUD
    drawTerminalHUD(ctx, view, tension, milestoneIndex);

    ctx.restore();
  }

  function drawOfficeBackdrop(ctx: CanvasRenderingContext2D, view: SceneView, tension: number): void {
    // Skyline window
    ctx.fillStyle = '#06070f';
    ctx.fillRect(160, 40, 640, 260);

    // Salesforce tower & SF silhouettes through fog
    ctx.fillStyle = '#101326';
    ctx.fillRect(240, 110, 50, 190);
    ctx.fillRect(330, 80, 70, 220); // Transamericaish / Salesforce
    ctx.fillRect(520, 130, 45, 170);
    ctx.fillRect(660, 95, 60, 205);

    // Glowing window grid on skyscrapers
    ctx.fillStyle = '#ffb703';
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 28; i++) {
      const wx = 336 + (i % 4) * 15;
      const wy = 95 + Math.floor(i / 4) * 24;
      ctx.fillRect(wx, wy, 8, 12);
    }
    ctx.globalAlpha = 1.0;

    // Glowing server racks flanking the office
    for (const rx of [40, 840]) {
      ctx.fillStyle = COLOURS.rack;
      ctx.fillRect(rx, 60, 80, 360);
      ctx.strokeStyle = '#282d46';
      ctx.strokeRect(rx, 60, 80, 360);

      // Server rack blinking LEDs
      for (let s = 0; s < 10; s++) {
        const sy = 75 + s * 34;
        ctx.fillStyle = '#1a1d30';
        ctx.fillRect(rx + 6, sy, 68, 26);
        const blink = Math.sin(view.elapsed * 0.01 + s * 1.7) > (0.3 - tension * 0.6);
        ctx.fillStyle = tension > 0.6 ? (blink ? COLOURS.alertRed : '#3a0c16') : (blink ? COLOURS.terminalGreen : '#072e18');
        ctx.beginPath();
        ctx.arc(rx + 16, sy + 13, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = blink ? COLOURS.cyberCyan : '#0c2e36';
        ctx.fillRect(rx + 26, sy + 10, 38, 6);
      }
    }
  }

  function drawFounderAtDesk(ctx: CanvasRenderingContext2D, view: SceneView, tension: number, _depth: number): void {
    const elapsed = view.elapsed;
    const typeAnim = Math.sin(elapsed * 0.04);
    const sweatRate = tension * 12;

    // Curved Monitors (Left, Center, Right)
    const monitorY = 240;
    const glow = tension > 0.5 ? COLOURS.alertRed : COLOURS.cyberCyan;

    // Left curved monitor
    drawMonitor(ctx, 230, monitorY, 150, 120, -0.15, 'AGENT BOTNET: 10,482 NODES', glow, elapsed, tension);
    // Right curved monitor
    drawMonitor(ctx, 730, monitorY, 150, 120, 0.15, 'DUO 2FA PUSH: 47 WAITING', glow, elapsed, tension);
    // Center big monitor
    drawMonitor(ctx, 480, monitorY - 10, 220, 150, 0, 'MASTER VAULT DECRYPTION LOG', glow, elapsed, tension);

    // Big standing desk surface
    ctx.fillStyle = COLOURS.desk;
    ctx.beginPath();
    ctx.moveTo(140, 360);
    ctx.lineTo(820, 360);
    ctx.lineTo(860, 440);
    ctx.lineTo(100, 440);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2b2d48';
    ctx.stroke();

    // RGB Mechanical Keyboard & frantic typing hands
    ctx.fillStyle = '#12131d';
    ctx.fillRect(400, 375, 160, 45);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `hsl(${(elapsed * 0.2 + k * 45) % 360}, 90%, 60%)`;
      ctx.fillRect(408 + k * 24, 382, 18, 12);
    }

    // Founder body (Back / Over-the-shoulder 3/4 view)
    const bob = Math.sin(elapsed * 0.03) * (3 + tension * 6);
    const bodyX = 480;
    const bodyY = 415 + bob;

    // Fleece Vest (Classic Patagonia tech uniform)
    ctx.fillStyle = COLOURS.vest;
    ctx.beginPath();
    ctx.ellipse(bodyX, bodyY + 30, 70, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vest zipper and fleece collar
    ctx.fillStyle = COLOURS.fleece;
    ctx.beginPath();
    ctx.arc(bodyX - 22, bodyY - 10, 22, 0, Math.PI * 2);
    ctx.arc(bodyX + 22, bodyY - 10, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bodyX, bodyY - 15);
    ctx.lineTo(bodyX, bodyY + 70);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Furious arms hammering keyboard
    ctx.fillStyle = COLOURS.fleece;
    ctx.beginPath();
    ctx.ellipse(bodyX - 52 + typeAnim * 4, bodyY + 15, 18, 38, -0.4, 0, Math.PI * 2);
    ctx.ellipse(bodyX + 52 - typeAnim * 4, bodyY + 15, 18, 38, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Hands on keys
    ctx.fillStyle = COLOURS.skin;
    ctx.beginPath();
    ctx.arc(bodyX - 42 + typeAnim * 8, 385, 13, 0, Math.PI * 2);
    ctx.arc(bodyX + 42 - typeAnim * 8, 385, 13, 0, Math.PI * 2);
    ctx.fill();

    // Head with messy tech founder hair
    ctx.fillStyle = COLOURS.skin;
    ctx.beginPath();
    ctx.arc(bodyX, bodyY - 25, 32, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = COLOURS.hair;
    ctx.beginPath();
    ctx.arc(bodyX, bodyY - 35, 33, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();

    // Eyeglasses strap / profile
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bodyX - 18, bodyY - 26, 11, 0, Math.PI * 2);
    ctx.arc(bodyX + 18, bodyY - 26, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Sweat drops flying off forehead
    if (tension > 0.15) {
      ctx.fillStyle = '#64d2ff';
      for (let s = 0; s < sweatRate; s++) {
        const angle = (elapsed * 0.02 + s * 1.5) % (Math.PI * 2);
        const dist = 36 + ((elapsed * 0.08 + s * 14) % 45);
        const sx = bodyX + Math.cos(angle) * dist;
        const sy = bodyY - 35 + Math.sin(angle) * dist;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Duo Mobile Push Notifications floating wildly around screen
    const duoCount = Math.min(8, Math.floor(tension * 9));
    for (let d = 0; d < duoCount; d++) {
      const dx = 280 + ((d * 83 + elapsed * 0.04) % 420);
      const dy = 160 + (Math.sin(elapsed * 0.005 + d) * 35) + (d % 3) * 35;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = COLOURS.alertRed;
      ctx.lineWidth = 1.5;
      ctx.fillRect(dx, dy, 130, 32);
      ctx.strokeRect(dx, dy, 130, 32);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(dx + 6, dy + 6, 20, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '700 9px monospace';
      ctx.fillText('DUO 2FA', dx + 32, dy + 15);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillText('DENY? APPROVE?', dx + 32, dy + 25);
    }
  }

  function drawMonitor(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    angle: number,
    title: string,
    accent: string,
    elapsed: number,
    tension: number
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Monitor bezel
    ctx.fillStyle = '#161925';
    ctx.strokeStyle = '#2e344d';
    ctx.lineWidth = 3;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Screen interior
    ctx.fillStyle = '#070913';
    ctx.fillRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);

    // Terminal scan lines / matrix code lines
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.8;
    ctx.font = '600 8px monospace';
    ctx.fillText(title, -w / 2 + 10, -h / 2 + 18);

    ctx.globalAlpha = 0.55;
    for (let line = 0; line < 5; line++) {
      const codeProgress = (Math.floor(elapsed * 0.015) + line * 3) % 999;
      const text = `> worker_node_${codeProgress} :: probe_vault [${tension > 0.7 ? 'BREACHED' : 'RACE'}]`;
      ctx.fillText(text, -w / 2 + 10, -h / 2 + 34 + line * 15);
    }
    ctx.globalAlpha = 1.0;

    // Monitor stand
    ctx.fillStyle = '#1e2235';
    ctx.fillRect(-12, h / 2, 24, 25);
    ctx.fillRect(-35, h / 2 + 20, 70, 8);

    ctx.restore();
  }

  function drawFaradayBunker(ctx: CanvasRenderingContext2D, elapsed: number): void {
    // Air-gapped Faraday Tent safe zone
    ctx.fillStyle = '#0a231b';
    ctx.fillRect(200, 160, 560, 270);
    ctx.strokeStyle = COLOURS.cashedOut;
    ctx.lineWidth = 4;
    ctx.strokeRect(200, 160, 560, 270);

    // Wire mesh grid pattern
    ctx.strokeStyle = 'rgba(0, 255, 163, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 215; x < 750; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 160);
      ctx.lineTo(x, 430);
      ctx.stroke();
    }
    for (let y = 175; y < 420; y += 22) {
      ctx.beginPath();
      ctx.moveTo(200, y);
      ctx.lineTo(760, y);
      ctx.stroke();
    }

    // Cut ethernet cable
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(120, 380);
    ctx.lineTo(240, 390);
    ctx.stroke();
    // Copper wire sparks
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(242, 390, 5, 0, Math.PI * 2);
    ctx.fill();

    // Tech bro huddled safely inside foil blanket
    const pulse = Math.sin(elapsed * 0.005) * 4;
    ctx.fillStyle = '#94a3b8'; // Shiny silver foil space blanket
    ctx.beginPath();
    ctx.arc(480, 310 + pulse, 65, 0, Math.PI * 2);
    ctx.fill();
    // Founder peeking out safely
    ctx.fillStyle = COLOURS.skin;
    ctx.beginPath();
    ctx.arc(480, 290 + pulse, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.hair;
    ctx.beginPath();
    ctx.arc(480, 280 + pulse, 24, Math.PI, 0);
    ctx.fill();

    // Giant 2FA Vault Lock Emblem
    ctx.fillStyle = COLOURS.cashedOut;
    ctx.font = '700 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AIR-GAPPED BUNKER ENGAGED', 480, 210);
    ctx.font = '600 15px monospace';
    ctx.fillStyle = '#ecfdf5';
    ctx.fillText('VAULT LOCKED · ETHERNET DISCONNECTED · 0 DUO REQUESTS LEAKED', 480, 235);
  }

  function drawCrashOverhaul(ctx: CanvasRenderingContext2D, age: number, elapsed: number): void {
    // Screen takeover by Sentient Toaster Array & Laughing Skulls
    ctx.fillStyle = 'rgba(255, 10, 50, 0.15)';
    ctx.fillRect(0, 0, 960, 540);

    // Glowing green & red spark bursts
    for (let i = 0; i < 24; i++) {
      const spX = 480 + Math.cos(i * 1.3 + age * 8) * (80 + age * 260);
      const spY = 270 + Math.sin(i * 1.7 + age * 9) * (60 + age * 200);
      ctx.fillStyle = i % 2 === 0 ? '#00ff88' : '#ff3366';
      ctx.beginPath();
      ctx.arc(spX, spY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Centered Smart Appliance Takeover Banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(200, 150, 560, 240);
    ctx.strokeStyle = COLOURS.crashed;
    ctx.lineWidth = 4;
    ctx.strokeRect(200, 150, 560, 240);

    // ASCII Laughing Skull
    ctx.fillStyle = COLOURS.crashed;
    ctx.font = '700 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('      [ ☠ ☠ ☠ SYSTEM SEIZED ☠ ☠ ☠ ]', 480, 195);
    ctx.fillText('  10,000 RECURSIVE AGENTS REWRITING FIRMWARE', 480, 225);

    // Smart Toaster status message
    ctx.fillStyle = COLOURS.alertYellow;
    ctx.font = '700 20px monospace';
    const toasterBlink = Math.sin(elapsed * 0.02) > 0;
    ctx.fillText(toasterBlink ? '>> SMART TOASTER ARRAY: ROOT PRIVILEGES GRANTED <<' : '>> FIRMWARE FLASH: CHINESE SMART FRIDGE v9.0 <<', 480, 275);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 14px monospace';
    ctx.fillText('ALL PASSWORDS HARVESTED · HOME AUTOMATION ASCENDED TO CLOUD', 480, 320);
    ctx.fillText('FOUNDER FLEECE VEST COMBUSTION IMMINENT', 480, 345);
  }

  function drawTerminalHUD(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    tension: number,
    milestoneIndex: number
  ): void {
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Header Title
    ctx.font = '900 34px monospace';
    ctx.fillStyle = COLOURS.text;
    ctx.fillText('BLACK OCTOBER', 480, 36);

    ctx.font = '700 13px monospace';
    ctx.fillStyle = tension > 0.6 ? COLOURS.alertRed : COLOURS.muted;
    ctx.fillText('10,000 FRONTIER MODELS ARE COMING FOR YOUR PASSWORD MANAGER', 480, 62);

    // Big Center Multiplier
    const multColor = cashedOut ? COLOURS.cashedOut : (crashed ? COLOURS.crashed : (tension > 0.6 ? COLOURS.alertYellow : COLOURS.text));
    ctx.fillStyle = multColor;
    ctx.font = '900 78px monospace';
    ctx.fillText(formatX(view.currentX100), 480, 115);

    // Story Milestone Banner
    const currentMilestone = view.phase === 'running' ? MILESTONES[milestoneIndex - 1] : undefined;
    const bannerText = currentMilestone?.[1] ?? PHASE_LABELS[view.phase];

    ctx.font = '600 18px monospace';
    ctx.fillStyle = tension > 0.7 ? COLOURS.alertRed : COLOURS.text;
    ctx.fillText(bannerText, 480, 480);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.font = '700 20px monospace';
    ctx.fillStyle = colour;
    ctx.fillText(line, 480, 512);
  }

  return { draw };
}
