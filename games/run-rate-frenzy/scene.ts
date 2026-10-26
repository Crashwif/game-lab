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
  bgTop: '#0b081e',
  bgBottom: '#23113a',
  grid: '#ff007f33',
  neonCyan: '#00f6ff',
  neonGreen: '#39ff14',
  neonGold: '#ffd700',
  vestFleece: '#243242',
  vestPatagonia: '#101d28',
  whiteboard: '#f4f6fb',
  crashed: '#ff3366',
  cashedOut: '#ffe259',
  cardBg: '#120d28cc',
  text: '#ffffff',
  muted: '#a8a0c2',
};

const MILESTONES: [number, string][] = [
  [120, '28-day revenue math invented on a napkin'],
  [150, 'Cowork AI agent takes over junior analyst seat'],
  [200, 'Net retention hits 900% on cloud marketplace'],
  [250, 'Revenue per employee crosses luxury yacht tier'],
  [300, 'Venture capitalists swarm the lobby with bags'],
  [500, 'San Francisco landlords triple studio rents'],
  [1000, 'SEC clerk gets dizzy staring at hockey stick'],
  [10000, 'Claude autonomously files amended paperwork'],
  [100000, 'Model replaces entire C-suite with one prompt'],
  [1000000, 'Universe absorbed into pure ARR calculation'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`LOCKED SECONDARY LIQUIDITY AT ${formatX(view.cashoutX100)}`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Watched the audit drop · no credits lost' : 'Observing S-1 draft · no credits committed', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Vaporized ${credits(view.stake)} into risk factors`, COLOURS.crashed];
  }
  return [`Paper Run-Rate: ${credits(view.stake)} riding`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let printTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 16 * clamp01(1 - age / 0.5) ** 2 : 0;

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Audio cues
    if (prevPhase !== null && running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
      audio.fx('yeet', 0.6);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.7);
    }
    if (running && prevPhase === 'running') {
      if (milestoneCount > prevMilestone) audio.milestone(milestoneCount);
      const printStep = Math.floor(view.elapsed / 220);
      if (printStep > printTick) {
        printTick = printStep;
        if (!cashedOut) audio.fx('ratchet', 0.25 + 0.35 * tension);
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneCount;

    ctx.save();
    // Screen shake
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // 1. Synthwave Room Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Grid Floor
    ctx.strokeStyle = COLOURS.grid;
    ctx.lineWidth = 1;
    const horizonY = 320;
    for (let x = -200; x <= 1160; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 540);
      ctx.lineTo(480 + (x - 480) * 0.15, horizonY);
      ctx.stroke();
    }
    for (let y = horizonY; y <= 540; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // SF skyline silhouette in window
    ctx.fillStyle = '#0a0518';
    ctx.fillRect(80, 110, 240, 170);
    ctx.fillStyle = '#ff80bf22';
    ctx.fillRect(80, 110, 240, 170);
    // City towers & neon antenna
    ctx.fillStyle = '#160d2b';
    ctx.fillRect(100, 160, 35, 120);
    ctx.fillRect(145, 130, 45, 150);
    ctx.fillRect(200, 180, 40, 100);
    ctx.fillRect(250, 150, 30, 130);
    ctx.fillStyle = COLOURS.crashed;
    ctx.fillRect(167, 120, 2, 10);

    // 2. Giant Whiteboard (S-1 Filings)
    ctx.save();
    ctx.shadowColor = '#00000066';
    ctx.shadowBlur = 15;
    ctx.fillStyle = COLOURS.whiteboard;
    ctx.beginPath();
    ctx.roundRect(350, 50, 560, 260, 12);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#cdd2e0';
    ctx.lineWidth = 4;
    ctx.strokeRect(350, 50, 560, 260);

    // Whiteboard Header & Math
    ctx.fillStyle = '#7a8599';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CONFIDENTIAL S-1 PRO-FORMA DRAFT // NOT GAAP', 370, 75);

    // Exponential Curve on Whiteboard
    const graphT = (view.elapsed / 1000) % 60;
    ctx.beginPath();
    ctx.strokeStyle = crashed ? COLOURS.crashed : COLOURS.neonGreen;
    ctx.lineWidth = 4;
    ctx.moveTo(375, 270);
    for (let gx = 0; gx <= 500; gx += 20) {
      const prog = gx / 500;
      const wave = Math.sin(prog * 12 + graphT * 4) * 4 * tension;
      const gy = 270 - Math.pow(prog, 2.3) * (180 + tension * 40) + wave;
      ctx.lineTo(375 + gx, gy);
    }
    ctx.stroke();

    // Dry-erase scribbles & buzzwords
    ctx.font = '600 12px sans-serif';
    ctx.fillStyle = '#415270';
    ctx.fillText('ARR = (Last Friday ARR × 52) × 1.35', 375, 105);
    ctx.fillText('Net Retention: 940% (Synthetic agents included)', 375, 125);
    ctx.fillText('Customer Acquisition Cost: ~$0 (Vibe driven)', 375, 145);

    // Golden Receipt / Cash Printer
    ctx.fillStyle = '#222831';
    ctx.fillRect(800, 260, 90, 80);
    ctx.fillStyle = COLOURS.neonGold;
    ctx.fillRect(815, 265, 60, 6);
    // Thermal paper streaming out
    const printFeed = (now * 0.12) % 40;
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.moveTo(820, 271);
    ctx.lineTo(870, 271);
    ctx.lineTo(885, 390 + Math.sin(now * 0.005) * 8);
    ctx.lineTo(805, 390 + Math.sin(now * 0.005) * 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#786e42';
    ctx.font = '9px monospace';
    ctx.fillText('$ARR +1300%', 818, 305);
    ctx.fillText('CONFIRMED', 818, 325);
    ctx.fillText('SERIES Z', 818, 345);

    // 3. Desk & Props
    const deskY = 340;
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(40, deskY, 880, 26);
    // Desk legs
    ctx.fillStyle = '#141220';
    ctx.fillRect(70, deskY + 26, 20, 160);
    ctx.fillRect(870, deskY + 26, 20, 160);

    // Laptop & Red Bulls
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(280, deskY - 22, 54, 22); // Laptop screen
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillRect(283, deskY - 19, 48, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(270, deskY - 3, 74, 5); // Keyboard

    // Energy drink cans
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(250, deskY - 18, 10, 18);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(263, deskY - 24, 10, 24);

    // 4. Protagonist: SF Founder in Patagonia Vest
    const founderX = 200;
    const founderBob = Math.sin(view.elapsed * 0.015) * (tension * 8);
    const founderY = deskY - 10 + founderBob;

    if (!cashedOut && !crashed) {
      // Normal / Feverish state
      // Legs / Stool
      ctx.fillStyle = '#181b2a';
      ctx.fillRect(founderX - 12, founderY + 30, 24, 80);
      // Torso / Patagonia Fleece Vest over Hoodie
      ctx.fillStyle = '#6366f1'; // hoodie sleeves
      ctx.beginPath();
      ctx.roundRect(founderX - 26, founderY - 40, 52, 74, 8);
      ctx.fill();
      ctx.fillStyle = COLOURS.vestPatagonia; // vest body
      ctx.fillRect(founderX - 18, founderY - 38, 36, 70);
      // Small colorful chest tag (Patagonia logo)
      ctx.fillStyle = '#ff6b35';
      ctx.fillRect(founderX + 2, founderY - 26, 9, 4);

      // Head
      ctx.fillStyle = '#f6d5b8';
      ctx.beginPath();
      ctx.arc(founderX, founderY - 62, 22, 0, Math.PI * 2);
      ctx.fill();
      // Messy sleep-deprived hair
      ctx.fillStyle = '#4a2c11';
      ctx.beginPath();
      ctx.arc(founderX - 2, founderY - 74, 23, Math.PI, Math.PI * 2);
      ctx.fill();
      // Hair tufts
      ctx.beginPath();
      ctx.moveTo(founderX - 18, founderY - 74);
      ctx.lineTo(founderX - 25, founderY - 84);
      ctx.lineTo(founderX - 10, founderY - 77);
      ctx.fill();

      // Wild Eyes (sleep deprived dark circles)
      ctx.fillStyle = '#9b7b84';
      ctx.beginPath();
      ctx.arc(founderX + 4, founderY - 60, 7, 0, Math.PI * 2);
      ctx.arc(founderX + 16, founderY - 60, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(founderX + 4, founderY - 61, 5, 0, Math.PI * 2);
      ctx.arc(founderX + 16, founderY - 61, 5, 0, Math.PI * 2);
      ctx.fill();
      // Dilated pupils twitching
      ctx.fillStyle = '#0a0a0a';
      const eyeTwitch = Math.sin(now * 0.05) * 1.5;
      ctx.beginPath();
      ctx.arc(founderX + 4 + eyeTwitch, founderY - 61, 2.5, 0, Math.PI * 2);
      ctx.arc(founderX + 16 + eyeTwitch, founderY - 61, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Dry-erase marker in hand reaching out to whiteboard
      const handX = founderX + 48 + Math.cos(view.elapsed * 0.02) * 12;
      const handY = founderY - 50 + Math.sin(view.elapsed * 0.02) * 20;
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(founderX + 10, founderY - 20);
      ctx.lineTo(handX, handY);
      ctx.stroke();
      // Green marker
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.fillRect(handX - 2, handY - 14, 6, 16);

    } else if (cashedOut && !crashed) {
      // CASHOUT ESCAPE: Founder flying off in golden wingsuit!
      const flightAge = (now % 2000) / 2000;
      const flyX = 200 + flightAge * 600;
      const flyY = 280 - flightAge * 220;

      // Golden Wingsuit
      ctx.fillStyle = COLOURS.neonGold;
      ctx.beginPath();
      ctx.moveTo(flyX, flyY - 20);
      ctx.lineTo(flyX - 45, flyY + 25);
      ctx.lineTo(flyX + 15, flyY + 15);
      ctx.closePath();
      ctx.fill();

      // Founder head with shades
      ctx.fillStyle = '#f6d5b8';
      ctx.beginPath();
      ctx.arc(flyX - 5, flyY - 25, 14, 0, Math.PI * 2);
      ctx.fill();
      // Cool 80s sunglasses
      ctx.fillStyle = '#111827';
      ctx.fillRect(flyX - 2, flyY - 28, 14, 6);

      // Huge Secondary Liquidity Check trailing behind
      ctx.save();
      ctx.translate(flyX - 100, flyY + 30);
      ctx.rotate(-0.15);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 130, 60);
      ctx.strokeStyle = COLOURS.neonGold;
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 130, 60);
      ctx.fillStyle = '#065f46';
      ctx.font = '800 11px sans-serif';
      ctx.fillText('FOUNDER LIQUIDITY', 6, 18);
      ctx.font = '700 14px monospace';
      ctx.fillText(`$${((view.cashoutX100 ?? 100) * 12500).toLocaleString()}`, 6, 38);
      ctx.restore();

    } else {
      // CRASH STATE: 80-Page SEC Risk Factor Audit slammed into desk!
      const auditDrop = Math.min(1, age * 3.5);
      const safeY = -120 + auditDrop * (deskY - 30);

      // Crushed desk kindling
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(founderX - 40, deskY + 10, 120, 14);
      ctx.fillRect(founderX + 10, deskY + 18, 90, 8);

      // Flying audit pages
      for (let i = 0; i < 16; i++) {
        const spread = (i * 47) % 360;
        const pageDist = age * (120 + i * 20);
        const px = 300 + Math.cos(spread) * pageDist;
        const py = deskY - 20 + Math.sin(spread) * pageDist * 0.4;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(px, py, 22, 30);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(px + 3, py + 5, 16, 2);
        ctx.fillRect(px + 3, py + 10, 16, 2);
      }

      // Massive Heavy 80-Page SEC Audit Book
      ctx.save();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.roundRect(founderX + 20, safeY, 190, 110, 8);
      ctx.fill();
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px ui-monospace, monospace';
      ctx.fillText('SEC FORM S-1/A', founderX + 35, safeY + 35);
      ctx.font = '700 11px sans-serif';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('ITEM 1A: 80-PAGE RISK AUDIT', founderX + 35, safeY + 58);
      ctx.fillText('RUN-RATE ADJUSTED TO: $0.00', founderX + 35, safeY + 78);
      ctx.restore();

      // Dizzy Founder flat on floor
      ctx.fillStyle = '#f6d5b8';
      ctx.beginPath();
      ctx.arc(founderX - 30, deskY + 45, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOURS.vestPatagonia;
      ctx.fillRect(founderX - 70, deskY + 40, 38, 26);
      // Swirling stars above head
      ctx.fillStyle = COLOURS.neonGold;
      const starRot = now * 0.008;
      for (let s = 0; s < 4; s++) {
        const sx = founderX - 30 + Math.cos(starRot + (s * Math.PI) / 2) * 22;
        const sy = deskY + 20 + Math.sin(starRot + (s * Math.PI) / 2) * 8;
        ctx.fillText('★', sx, sy);
      }
    }

    // 5. HUD OVERLAYS & MULTIPLIER
    // Top Banner Glass Card
    ctx.fillStyle = COLOURS.cardBg;
    ctx.beginPath();
    ctx.roundRect(280, 16, 400, 112, 16);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.crashed : cashedOut ? COLOURS.cashedOut : COLOURS.neonCyan;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = crashed ? COLOURS.crashed : cashedOut ? COLOURS.cashedOut : COLOURS.neonCyan;
    ctx.font = `900 ${48 + 4 * tension}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 68);

    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.text;
    ctx.fillText('RUN-RATE FRENZY // ARR MULTIPLIER', 480, 104);

    // Milestone ticker / Subtitle
    const currentMilestone = MILESTONES[milestoneCount - 1];
    const milestoneText = crashed
      ? '80-PAGE RISK FACTOR PROSPECTUS VAPORIZED THE VALUATION'
      : currentMilestone
      ? `★ ${currentMilestone[1].toUpperCase()}`
      : 'MULTIPLY LAST MONTH BY 13 · S-1 IN FLIGHT';

    ctx.fillStyle = '#17122bfa';
    ctx.fillRect(160, 446, 640, 36);
    ctx.strokeStyle = '#382a5c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(160, 446, 640, 36);

    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.neonGold;
    ctx.fillText(milestoneText, 480, 469, 610);

    // Bottom Stake & Liquidity Status Line
    const [statusText, statusColour] = stakeLine(view);
    ctx.fillStyle = statusColour;
    ctx.font = '600 15px ui-monospace, monospace';
    ctx.fillText(statusText, 480, 512);

    ctx.restore();
  }

  return { draw };
}
