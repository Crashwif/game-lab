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
  [120, 'Crawling past basic paywall cookie banners'],
  [150, 'Bypassing a 5-article free limit popup'],
  [200, 'Solving a captcha full of blurry fire hydrants'],
  [250, 'Tunneling through cloud-flare bot verification'],
  [300, 'Infiltrating county government voter spreadsheets'],
  [500, 'Disabling corporate database rate limits'],
  [1000, 'Extracting entire regional registry servers'],
  [10000, 'AI agent rewrites subscription billing protocols'],
  [100000, 'Scraping the entirety of public internet files'],
  [1000000, 'Transcending firewalls into pure data ether'],
];

const COLOURS = {
  bgDark: '#08051a',
  bgGrid: '#1b1238',
  neonPurple: '#bf5af2',
  neonCyan: '#5ac8fa',
  neonPink: '#ff2d55',
  neonGold: '#ffd60a',
  laser: '#ff375f',
  crashed: '#ff453a',
  cashedOut: '#30d158',
  text: '#f5f5f7',
  muted: '#8e8e93',
  windowBg: '#1c1c1e',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Scraped PDF archive at ${formatX(view.cashoutX100)} · incognito tab secured`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Paywall slam witnessed · zero credits lost' : 'Observing crawler breach · no credits risked', COLOURS.muted];
  }
  if (crashed) return [`403 Forbidden! ${credits(view.stake)} seized by billing server`, COLOURS.crashed];
  return [`Bot armed & crawling · ${credits(view.stake)} riding the scrape`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let stepTimer = 0;

  function drawBackground(ctx: CanvasRenderingContext2D, elapsed: number, tension: number): void {
    // Synthwave cyber grid with descending code stream
    ctx.fillStyle = COLOURS.bgDark;
    ctx.fillRect(0, 0, 960, 540);

    const scrollY = (elapsed * 0.08) % 36;
    ctx.strokeStyle = COLOURS.bgGrid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = scrollY; y <= 540; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Floating digital paywall modals in background
    const popups = [
      { x: 120, y: 130, w: 170, h: 54, text: 'SUBSCRIBE FOR $1', sub: 'Limited Offer!' },
      { x: 740, y: 160, w: 160, h: 50, text: 'ACCEPT ALL COOKIES', sub: '342 trackers active' },
      { x: 150, y: 370, w: 180, h: 52, text: 'ARTICLE LIMIT: 5/5', sub: 'Turn off AdBlocker' },
      { x: 720, y: 360, w: 175, h: 52, text: 'SELECT ALL HYDRANTS', sub: '[ CAPTCHA v3 ]' },
    ];

    popups.forEach((p, idx) => {
      const floatY = p.y + Math.sin(elapsed * 0.002 + idx * 1.5) * 6;
      ctx.fillStyle = COLOURS.windowBg;
      ctx.strokeStyle = idx % 2 === 0 ? COLOURS.neonPink : COLOURS.neonCyan;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(p.x - p.w / 2, floatY - p.h / 2, p.w, p.h, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLOURS.text;
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, floatY - 4);
      ctx.fillStyle = COLOURS.muted;
      ctx.font = '500 9px system-ui, sans-serif';
      ctx.fillText(p.sub, p.x, floatY + 12);
    });

    // Escalating firewall laser sweeps
    if (tension > 0.15) {
      const laserCount = Math.min(4, Math.floor(tension * 5));
      for (let i = 0; i < laserCount; i++) {
        const sweepY = (elapsed * (0.12 + i * 0.05) + i * 140) % 540;
        ctx.strokeStyle = COLOURS.laser;
        ctx.lineWidth = 1 + tension * 2;
        ctx.shadowColor = COLOURS.laser;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, sweepY);
        ctx.lineTo(960, sweepY);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawCrawler(ctx: CanvasRenderingContext2D, cx: number, cy: number, elapsed: number, tension: number, isEscaped: boolean): void {
    const scuttle = Math.sin(elapsed * 0.012);
    const legPhase = elapsed * (0.01 + tension * 0.015);

    ctx.save();
    ctx.translate(cx, cy);

    // Tether thread from ceiling
    ctx.strokeStyle = COLOURS.neonCyan;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, -260);
    ctx.lineTo(0, -18);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6 Browser-Tab Legs (3 left, 3 right)
    for (let i = 0; i < 3; i++) {
      const sideDir = [-1, 1];
      for (const dir of sideDir) {
        const legAngle = 0.25 + i * 0.45 + Math.sin(legPhase + i * 1.6 + dir) * 0.28;
        const lx = dir * (26 + i * 6);
        const ly = -6 + i * 10;
        const tipX = dir * (58 + i * 8 + Math.cos(legAngle) * 20);
        const tipY = ly + Math.sin(legAngle) * 34 + scuttle * 4;

        // Leg joint
        ctx.strokeStyle = COLOURS.neonPurple;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lx * 0.5, ly);
        ctx.lineTo(lx, ly - 6);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Browser tab foot
        ctx.fillStyle = COLOURS.neonCyan;
        ctx.beginPath();
        ctx.roundRect(tipX - 10, tipY - 4, 20, 9, 3);
        ctx.fill();

        // Little 'x' close button on tab foot
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tipX + 4, tipY);
        ctx.lineTo(tipX + 7, tipY + 3);
        ctx.moveTo(tipX + 7, tipY);
        ctx.lineTo(tipX + 4, tipY + 3);
        ctx.stroke();
      }
    }

    // Crawler cute round chassis
    ctx.fillStyle = COLOURS.neonPurple;
    ctx.shadowColor = COLOURS.neonPurple;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Glowing cyan visor screen
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-16, -11, 32, 20, 6);
    ctx.fill();

    // Visor eyes: blinking or scanning
    const blink = Math.sin(elapsed * 0.005) > 0.96;
    ctx.fillStyle = isEscaped ? COLOURS.cashedOut : COLOURS.neonCyan;
    if (blink) {
      ctx.fillRect(-11, 0, 8, 2);
      ctx.fillRect(3, 0, 8, 2);
    } else {
      ctx.beginPath();
      ctx.arc(-7, -1, 4, 0, Math.PI * 2);
      ctx.arc(7, -1, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Neural antenna on top
    ctx.strokeStyle = COLOURS.neonCyan;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(0, -38);
    ctx.stroke();

    ctx.fillStyle = COLOURS.neonGold;
    ctx.beginPath();
    ctx.arc(0, -41, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Carried payload: Golden PDF zip archive icon
    const bagY = 22 + Math.sin(elapsed * 0.009) * 3;
    ctx.fillStyle = COLOURS.neonGold;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-12, bagY, 24, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.font = '900 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ZIP', 0, bagY + 12);

    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // SFX triggers
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('zap', 0.6);
      }
      stepTimer += 16.6;
      const stepInterval = Math.max(120, 400 - tension * 260);
      if (stepTimer > stepInterval) {
        stepTimer = 0;
        if (view.cashoutX100 === null) audio.fx('click', 0.35 + tension * 0.45);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.5) ** 2 : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawBackground(ctx, view.elapsed, tension);

    const crawlerX = 480;
    const crawlerY = 280 + Math.sin(view.elapsed * 0.004) * 14;

    // In Cashout mode, draw Incognito portal and bot jumping into it
    if (view.cashoutX100 !== null) {
      const portalRadius = 65;
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 4;
      ctx.shadowColor = COLOURS.cashedOut;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(480, 270, portalRadius * 1.3, portalRadius, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Incognito Fedora & Glasses silhouette inside portal
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.beginPath();
      ctx.ellipse(480, 248, 30, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(465, 230, 30, 18);
      ctx.fillRect(460, 264, 16, 9);
      ctx.fillRect(484, 264, 16, 9);

      drawCrawler(ctx, 480, 270, view.elapsed, 0, true);
    } else if (crashed) {
      // Crash State: 403 Forbidden vault door slam & shattered captchas
      const slamProgress = clamp01(crashSec / 0.18);
      const doorY = -280 + slamProgress * 280;

      // Vault door
      ctx.fillStyle = '#1c1917';
      ctx.strokeStyle = COLOURS.crashed;
      ctx.lineWidth = 6;
      ctx.fillRect(240, doorY, 480, 260);
      ctx.strokeRect(240, doorY, 480, 260);

      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '900 48px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('403 FORBIDDEN', 480, doorY + 110);
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillStyle = COLOURS.text;
      ctx.fillText('ACCESS DENIED · IP BANNED BY FIREWALL', 480, doorY + 155);

      // Flying captcha puzzle piece debris
      const debrisCount = 12;
      for (let i = 0; i < debrisCount; i++) {
        const angle = (i / debrisCount) * Math.PI * 2;
        const dist = Math.min(220, crashSec * 280);
        const dx = 480 + Math.cos(angle) * dist;
        const dy = 320 + Math.sin(angle) * dist * 0.7;

        ctx.fillStyle = i % 2 === 0 ? COLOURS.neonPurple : COLOURS.neonCyan;
        ctx.fillRect(dx - 10, dy - 10, 20, 20);
        ctx.fillStyle = '#000';
        ctx.font = '900 10px monospace';
        ctx.fillText('?', dx, dy + 3);
      }
    } else {
      // Normal / Running state: draw crawler
      drawCrawler(ctx, crawlerX, crawlerY, view.elapsed, tension, false);
    }

    // Top HUD
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.shadowColor = COLOURS.neonPurple;
    ctx.shadowBlur = 10;
    ctx.fillText('PAYWALL CRAWLER', 480, 48);
    ctx.shadowBlur = 0;

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillText('ROGUE AI BOT INFILTRATING SUBSCRIPTION WALLS', 480, 80);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.text;
    ctx.fillStyle = multColor;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 16;
    ctx.font = '900 78px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 160);
    ctx.shadowBlur = 0;

    // Milestone ticker caption
    const passedMilestone = running ? MILESTONES[milestone - 1] : undefined;
    const bannerText = passedMilestone ? passedMilestone[1] : view.phase === 'betting' ? 'Ready to launch crawler into paywall maze' : view.phase === 'waiting' ? 'Establishing proxy tunnel...' : 'Firewall Lockdown in effect';

    ctx.fillStyle = 'rgba(28, 28, 30, 0.85)';
    ctx.strokeStyle = COLOURS.neonPurple;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(140, 432, 680, 36, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 450);

    // Bottom stake status bar
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 502);

    ctx.restore();
  }

  return { draw };
}
