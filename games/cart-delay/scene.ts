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
  bg: '#0c0f17',
  windowBg: '#131924',
  windowBar: '#1c2436',
  windowBorder: '#2b3852',
  accent: '#00f2fe',
  tape: '#c49746',
  tapeBorder: '#e0b25e',
  crashed: '#ff3b69',
  cashedOut: '#22e58b',
  text: '#f1f5f9',
  muted: '#8b9bb4',
  warning: '#f59e0b',
  noteBg: '#1e293b',
};

const MILESTONES: [number, string][] = [
  [120, 'Store launcher opens two seconds slower than rivals'],
  [150, 'Engineering team debates adding a cart button'],
  [200, 'Corporate decree: replace all artists with prompts'],
  [250, 'Battle pass price hikes spark furious forum rants'],
  [300, 'Vibe-coded launcher rewrite introduces 400 bugs'],
  [500, 'Metaverse concert runs at 4 frames per second'],
  [1000, 'Five community notes attach to your CEO tweet'],
  [10000, "Gabe replies with 'u mad bro' in 4K resolution"],
  [100000, 'Virtual shoes cost more than actual rent'],
  [1000000, 'Launcher rebrands into fully autonomous AI void'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Cart checkout secured at ${formatX(view.cashoutX100)}! 1x Digital Fedora printed`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Launcher uninstalled · 0 credits lost' : 'Browsing catalog · 0 credits staked', COLOURS.muted];
  }
  if (crashed) {
    return [`Launcher crashed · ${credits(view.stake)} lost to the metaverse`, COLOURS.crashed];
  }
  return [`Staked in storefront · ${credits(view.stake)} riding`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'static' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastTapStep = 0;

  function drawCEO(ctx: CanvasRenderingContext2D, cx: number, cy: number, tension: number, elapsed: number, crashed: boolean): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Smug frantic oscillation
    const panicSpeed = 1 + tension * 4;
    const bodyWiggle = crashed ? 0 : Math.sin(elapsed * 0.008 * panicSpeed) * (4 + tension * 12);
    ctx.translate(bodyWiggle, 0);

    // Suit body / black turtleneck
    ctx.fillStyle = '#1e1b2e';
    ctx.beginPath();
    ctx.roundRect(-42, 30, 84, 90, [20, 20, 0, 0]);
    ctx.fill();

    // Golden corporate lanyard
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-18, 30);
    ctx.lineTo(-4, 76);
    ctx.lineTo(10, 30);
    ctx.stroke();

    // CEO Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.ellipse(0, -6, 32, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Slicked gelled hair
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.moveTo(-34, -14);
    ctx.quadraticCurveTo(-18, -48, 20, -42);
    ctx.quadraticCurveTo(36, -30, 34, -8);
    ctx.quadraticCurveTo(12, -26, -34, -14);
    ctx.fill();

    // Smug futuristic tech glasses or sweat drops
    if (!crashed) {
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(-24, -14, 20, 11);
      ctx.fillRect(4, -14, 20, 11);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(-24, -14, 20, 11);
      ctx.strokeRect(4, -14, 20, 11);
      ctx.beginPath();
      ctx.moveTo(-4, -8);
      ctx.lineTo(4, -8);
      ctx.stroke();

      // Smug smile stretches with tension
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const smileSquint = Math.sin(elapsed * 0.01) * 3;
      ctx.arc(0, 10 + smileSquint, 14, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else {
      // Dizzy eyes upon crash
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      // Cross eyes
      [-14, 14].forEach((ex) => {
        ctx.beginPath();
        ctx.moveTo(ex - 6, -12);
        ctx.lineTo(ex + 6, -2);
        ctx.moveTo(ex + 6, -12);
        ctx.lineTo(ex - 6, -2);
        ctx.stroke();
      });
      // Shocked open mouth
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.ellipse(0, 14, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Arm holding giant roll of duct tape
    const armAngle = crashed ? 0.6 : Math.sin(elapsed * 0.015 * panicSpeed) * 0.35 - 0.3;
    ctx.save();
    ctx.translate(34, 40);
    ctx.rotate(armAngle);

    // Arm
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(38, -10);
    ctx.stroke();

    // Duct tape roll
    ctx.fillStyle = COLOURS.tape;
    ctx.strokeStyle = COLOURS.tapeBorder;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(46, -12, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Tape roll hole
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(46, -12, 7, 0, Math.PI * 2);
    ctx.fill();

    // Duct tape trail reaching launcher
    if (!crashed) {
      ctx.strokeStyle = COLOURS.tape;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(46, -12);
      ctx.quadraticCurveTo(80, -30, 110, -10);
      ctx.stroke();
    }
    ctx.restore();

    // Left arm holding AI prompt remote
    ctx.save();
    ctx.translate(-34, 40);
    ctx.rotate(crashed ? -0.5 : -Math.sin(elapsed * 0.012) * 0.25 + 0.2);
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, 4);
    ctx.stroke();
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(-44, -4, 18, 22);
    ctx.restore();

    ctx.restore();
  }

  function drawDuctTapes(ctx: CanvasRenderingContext2D, tension: number, depth: number): void {
    const tapeCount = Math.floor(tension * 14 + depth * 6);
    const strips = [
      { x: 190, y: 160, r: -0.22, text: 'AI COPILOT' },
      { x: 280, y: 220, r: 0.18, text: 'METAVERSE PASS' },
      { x: 150, y: 310, r: 0.35, text: '$400 VIRTUAL HOODIE' },
      { x: 380, y: 140, r: -0.15, text: 'DELAY CART TO 2031' },
      { x: 230, y: 380, r: -0.08, text: 'VIBE-CODED PATCH' },
      { x: 330, y: 290, r: 0.42, text: 'CONCERT 4 FPS' },
      { x: 170, y: 240, r: -0.31, text: 'WEB3 READY' },
      { x: 420, y: 370, r: 0.21, text: 'NO REFUNDS' },
      { x: 130, y: 180, r: 0.15, text: 'PROMPT WRITER' },
      { x: 360, y: 220, r: -0.28, text: 'CART BUTTON: 404' },
    ];

    for (let i = 0; i < Math.min(tapeCount, strips.length); i++) {
      const s = strips[i];
      if (!s) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.r);
      ctx.fillStyle = COLOURS.tape;
      ctx.strokeStyle = COLOURS.tapeBorder;
      ctx.lineWidth = 2;
      ctx.fillRect(-65, -13, 130, 26);
      ctx.strokeRect(-65, -13, 130, 26);
      ctx.fillStyle = '#2d1804';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.text, 0, 1);
      ctx.restore();
    }
  }

  function drawLauncherWindow(ctx: CanvasRenderingContext2D, view: SceneView, tension: number, depth: number): void {
    const lx = 90;
    const ly = 80;
    const lw = 490;
    const lh = 330;

    // Window frame
    ctx.fillStyle = COLOURS.windowBg;
    ctx.strokeStyle = COLOURS.windowBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, lh, 10);
    ctx.fill();
    ctx.stroke();

    // Title bar
    ctx.fillStyle = COLOURS.windowBar;
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, 36, [10, 10, 0, 0]);
    ctx.fill();

    // Window controls
    ['#ff5f56', '#ffbd2e', '#27c93f'].forEach((col, idx) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(lx + 18 + idx * 16, ly + 18, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('EPIC VIBE STORE LAUNCHER v99.42 — [CART FEATURE: TBD]', lx + 74, ly + 18);

    // Nav Tabs inside launcher
    const tabs = ['STORE', 'METAVERSE', 'AI ENGINE', 'CART (LOCKED)'];
    tabs.forEach((tab, i) => {
      const tx = lx + 16 + i * 115;
      const ty = ly + 46;
      ctx.fillStyle = i === 3 ? 'rgba(239, 68, 68, 0.25)' : i === 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = i === 3 ? '#ef4444' : i === 0 ? '#38bdf8' : '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(tx, ty, 106, 26, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = i === 3 ? '#fca5a5' : i === 0 ? '#38bdf8' : '#cbd5e1';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tab, tx + 53, ty + 13);
    });

    // Content Hero Carousel inside launcher
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(lx + 16, ly + 82, lw - 32, 228, 8);
    ctx.fill();
    ctx.stroke();

    // Banner graphics: "EXCLUSIVE METAVERSE DROP"
    const grad = ctx.createLinearGradient(lx + 16, ly + 82, lx + lw - 16, ly + 200);
    grad.addColorStop(0, '#312e81');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(lx + 24, ly + 92, lw - 48, 120, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CYBER-HAT SEASON 8', lx + 44, ly + 128);
    ctx.fillStyle = '#bae6fd';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText('Requires 42 individual checkout forms (No Cart Allowed)', lx + 44, ly + 152);

    // Tiny fake shopping cart button (The Holy Grail)
    const cartX = lx + lw - 110;
    const cartY = ly + 264;
    const isCartActive = view.cashoutX100 !== null;
    ctx.fillStyle = isCartActive ? '#10b981' : '#334155';
    ctx.strokeStyle = isCartActive ? '#34d399' : '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cartX, cartY, 86, 34, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isCartActive ? '🛒 PURCHASED' : '🛒 CART [404]', cartX + 43, cartY + 17);

    // Duct tapes cluttering the launcher
    drawDuctTapes(ctx, tension, depth);
  }

  function drawReceipt(ctx: CanvasRenderingContext2D, cashoutX: number): void {
    ctx.save();
    ctx.translate(680, 290);
    // Receipt shadow & paper
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(-86, -6, 172, 172);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-90, -10, 180, 170);

    // Serrated bottom edge
    ctx.fillStyle = '#f8fafc';
    for (let i = -90; i < 90; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 160);
      ctx.lineTo(i + 6, 168);
      ctx.lineTo(i + 12, 160);
      ctx.fill();
    }

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('--- OFFICIAL RECEIPT ---', 0, 12);
    ctx.font = '10px monospace';
    ctx.fillText('CART FEATURE WORKED!', 0, 28);
    ctx.fillText(`RATE: ${formatX(cashoutX)}`, 0, 44);
    ctx.fillText('ITEM: 1x DIGITAL FEDORA', 0, 62);
    ctx.fillText('STATUS: ESCAPED SAFELY', 0, 78);

    // Barcode lines
    ctx.fillStyle = '#1e293b';
    for (let x = -70; x < 70; x += 6) {
      const barW = (x % 4 === 0) ? 3 : 1.5;
      ctx.fillRect(x, 96, barW, 28);
    }

    // Green stamp
    ctx.save();
    ctx.rotate(-0.16);
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 3;
    ctx.strokeRect(-60, 42, 120, 36);
    ctx.fillStyle = '#16a34a';
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.fillText('VERIFIED CART', 0, 65);
    ctx.restore();

    ctx.restore();
  }

  function drawCommunityNote(ctx: CanvasRenderingContext2D, age: number): void {
    const slam = clamp01(age / 0.18);
    const scale = 1 + (1 - slam) * 0.4;
    const alpha = clamp01(age / 0.1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(480, 270);
    ctx.scale(scale, scale);

    // Background note box
    ctx.fillStyle = COLOURS.noteBg;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-270, -80, 540, 160, 12);
    ctx.fill();
    ctx.stroke();

    // Bird / Note Header
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Readers added context they thought people might want to know', -245, -45);

    // Body
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('• The CEO spent 4 years building metaverse concert stadiums.', -245, -16);
    ctx.fillText('• The storefront still lacks basic multi-item cart capability.', -245, 6);
    ctx.fillText('• The launcher has crashed and wiped user wallpaper to default blue.', -245, 28);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 11px system-ui, sans-serif';
    ctx.fillText('Context rated helpful by 42,912 disappointed gamers', -245, 56);

    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Trigger audio cues
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.6);
    }
    if (running && previousPhase === 'running') {
      if (milestoneCount > previousMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('notify', 0.6);
      }
      const tapStep = Math.floor(view.elapsed / 450);
      if (tapStep > lastTapStep && view.cashoutX100 === null) {
        audio.fx('click', 0.3 + 0.4 * tension);
      }
      lastTapStep = tapStep;
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneCount;

    // Crash shake & screen glitch
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.5) ** 2 : 0;

    ctx.save();
    // Desktop Background
    ctx.fillStyle = crashed ? '#0f172a' : COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Subtle grid on desktop
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
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

    // Screen shake transform
    ctx.translate(shake * Math.sin(age * 80), shake * Math.sin(age * 63));

    // Draw main scene: Launcher Window + Duct Tape CEO
    drawLauncherWindow(ctx, view, tension, depth);
    drawCEO(ctx, 740, 240, tension, view.elapsed, crashed);

    // Static glitches if crashed
    if (crashed && age < 0.6) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let i = 0; i < 7; i++) {
        const gy = Math.random() * 540;
        ctx.fillRect(0, gy, 960, 4 + Math.random() * 12);
      }
    }

    // Community Note slamming down on crash
    if (crashed) {
      drawCommunityNote(ctx, age);
    }

    // Receipt printing on cash out
    if (view.cashoutX100 !== null) {
      drawReceipt(ctx, view.cashoutX100);
    }

    // Top Header & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText('CART DELAY', 480, 36);

    // Multiplier box
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.accent;
    ctx.fillStyle = multColor;
    ctx.font = '900 58px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 210);

    // Milestone ticker / Subtitle
    const currentMilestoneText = running && milestoneCount > 0
      ? MILESTONES[milestoneCount - 1]?.[1] ?? 'Shopping cart delayed further...'
      : crashed
        ? 'LAUNCHER UNINSTALLED DESKTOP WALLPAPER'
        : 'Ship digital storefront before shopping cart takes 4 years';

    ctx.fillStyle = crashed ? COLOURS.crashed : '#94a3b8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(currentMilestoneText, 480, 456);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(line, 480, 492);

    ctx.restore();
  }

  return { draw };
}
