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

const TITLE = 'BUDGET SHOWDOWN';
const SUBTITLE = 'Grass Physics Engine ⚔️ Megacorp AAA Engine';

const COLOURS = {
  bgDark: '#0b101d',
  bgIndie: '#10281e',
  bgCorp: '#25131f',
  indieGreen: '#4ade80',
  indieGold: '#facc15',
  corpNeon: '#ec4899',
  corpGold: '#fbbf24',
  text: '#f8fafc',
  muted: '#94a3b8',
  crashed: '#f43f5e',
  cashedOut: '#34d399',
  cardBg: 'rgba(15, 23, 42, 0.75)',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Calibrating Engine Budgets...',
  betting: 'Place Stakes Before Fiscal Launch',
  running: 'Development Spending In Orbit',
  crashed: 'AUDIT FAILED · STUDIO LIQUIDATED',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Kickstarter tier reached; grass gets 2 extra polygons'],
  [150, 'Mocap suit ordered for an office cat'],
  [200, 'Physics engine now simulates realistic sandwich crumbs'],
  [250, 'Full orchestral recording booked in Prague cathedral'],
  [300, 'Celebrity voice cameo demands five trailers'],
  [500, 'Marketing budget surpasses small nation GDP'],
  [1000, 'Raytracing so intense it warms the office block'],
  [10000, 'Studio buys actual private island for field research'],
  [100000, 'Custom AI created solely to render hyper-real mud'],
  [1000000, 'Development costs surpass international space program'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Locked in at ${formatX(view.cashoutX100)} · Critical acclaim secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Auditors stormed the floor · Spectating only' : 'Observing engine spending duel', COLOURS.muted];
  }
  if (crashed) return [`All ${credits(view.stake)} seized by publisher audit!`, COLOURS.crashed];
  return [`Dev funding live: ${credits(view.stake)} allocated`, COLOURS.indieGold];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastBillSpawn = 0;

  // Floating budget burn particles
  const floatingBills: Array<{ x: number; y: number; vx: number; vy: number; rot: number; isGold: boolean }> = [];
  for (let i = 0; i < 28; i++) {
    floatingBills.push({
      x: 200 + Math.random() * 560,
      y: 100 + Math.random() * 380,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -0.5 - Math.random() * 1.5,
      rot: Math.random() * Math.PI,
      isGold: Math.random() > 0.5,
    });
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('camera', 0.8);
      audio.fx('kaching', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneCount > previousMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('kaching', 0.5 + 0.4 * tension);
      }
      if (view.elapsed - lastBillSpawn > 250) {
        lastBillSpawn = view.elapsed;
        audio.fx('tick', 0.15 + 0.25 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneCount;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.6) ** 2 : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(age * 55), shake * Math.cos(age * 47));

    // Base dual backdrop
    ctx.fillStyle = COLOURS.bgDark;
    ctx.fillRect(0, 0, 960, 540);

    // Left Engine side (Indie grass field / cozy warm green)
    const leftGrad = ctx.createLinearGradient(0, 0, 480, 540);
    leftGrad.addColorStop(0, '#0c1b14');
    leftGrad.addColorStop(1, COLOURS.bgIndie);
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 478, 540);

    // Right Engine side (Corp hyper-gloss neon boardroom / server hell)
    const rightGrad = ctx.createLinearGradient(482, 0, 960, 540);
    rightGrad.addColorStop(0, '#1c0d18');
    rightGrad.addColorStop(1, COLOURS.bgCorp);
    ctx.fillStyle = rightGrad;
    ctx.fillRect(482, 0, 478, 540);

    // Split dividing beam & spending bar
    ctx.strokeStyle = crashed ? COLOURS.crashed : '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(480, 0);
    ctx.lineTo(480, 540);
    ctx.stroke();

    // Escalating spending thermo-meter up the center seam
    const barHeight = running || crashed ? Math.min(380, 40 + tension * 320 + depth * 20) : 30;
    const barGlow = ctx.createLinearGradient(476, 500, 484, 500 - barHeight);
    barGlow.addColorStop(0, COLOURS.indieGreen);
    barGlow.addColorStop(0.5, COLOURS.corpNeon);
    barGlow.addColorStop(1, crashed ? COLOURS.crashed : '#ffffff');
    ctx.fillStyle = barGlow;
    ctx.fillRect(475, 500 - barHeight, 10, barHeight);

    // --- LEFT ENGINE: 40 Million Blades of Grass & Hero ---
    const sway = Math.sin(view.elapsed * 0.005) * 8;
    ctx.save();
    // Animated lush grass blades
    ctx.strokeStyle = COLOURS.indieGreen;
    ctx.lineWidth = 2;
    for (let gx = 30; gx < 460; gx += 16) {
      const bladeH = 26 + Math.sin(gx * 0.1 + view.elapsed * 0.004) * 14;
      ctx.beginPath();
      ctx.moveTo(gx, 430);
      ctx.quadraticCurveTo(gx + sway * 0.6, 430 - bladeH * 0.6, gx + sway, 430 - bladeH);
      ctx.stroke();
    }

    // Stack of rupees
    const rupeeBob = Math.sin(view.elapsed * 0.007) * 3;
    const rx = 240;
    const ry = 410 + rupeeBob;
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = r % 2 === 0 ? '#10b981' : '#059669';
      ctx.beginPath();
      ctx.moveTo(rx - 24, ry - r * 9);
      ctx.lineTo(rx, ry - 7 - r * 9);
      ctx.lineTo(rx + 24, ry - r * 9);
      ctx.lineTo(rx, ry + 7 - r * 9);
      ctx.closePath();
      ctx.fill();
    }

    // Hero: Low-poly green tunic adventurer
    const heroY = ry - 42;
    // Tunic Body
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(rx, heroY - 26);
    ctx.lineTo(rx - 18, heroY + 12);
    ctx.lineTo(rx + 18, heroY + 12);
    ctx.closePath();
    ctx.fill();
    // Belt & buckle
    ctx.fillStyle = '#78350f';
    ctx.fillRect(rx - 13, heroY + 2, 26, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(rx - 3, heroY + 1, 6, 6);
    // Head & Green Cap
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(rx, heroY - 32, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.moveTo(rx - 12, heroY - 34);
    ctx.lineTo(rx + 12, heroY - 34);
    ctx.lineTo(rx + 24 + sway * 0.4, heroY - 48);
    ctx.closePath();
    ctx.fill();

    // Wooden Sword
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx + 14, heroY - 8);
    ctx.lineTo(rx + 36, heroY - 28);
    ctx.stroke();
    ctx.restore();

    // --- RIGHT ENGINE: Hyper-Glossy Supercar & Cash Receipts ---
    ctx.save();
    const carX = 710;
    const carY = 415 + Math.sin(view.elapsed * 0.009) * 2;
    // Neon floor grid
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.2)';
    ctx.lineWidth = 1.5;
    for (let line = 0; line < 5; line++) {
      ctx.beginPath();
      ctx.moveTo(500, 430 + line * 20);
      ctx.lineTo(950, 430 + line * 20);
      ctx.stroke();
    }

    // Supercar Body (Hyper gloss wedge)
    const carGrad = ctx.createLinearGradient(carX - 80, carY, carX + 80, carY);
    carGrad.addColorStop(0, '#be185d');
    carGrad.addColorStop(0.5, '#f43f5e');
    carGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = carGrad;
    ctx.beginPath();
    ctx.moveTo(carX - 85, carY);
    ctx.lineTo(carX - 55, carY - 22);
    ctx.lineTo(carX + 15, carY - 26);
    ctx.lineTo(carX + 65, carY - 8);
    ctx.lineTo(carX + 90, carY);
    ctx.lineTo(carX + 85, carY + 16);
    ctx.lineTo(carX - 80, carY + 16);
    ctx.closePath();
    ctx.fill();

    // Tinted windshield & neon headlights
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(carX - 45, carY - 20);
    ctx.lineTo(carX + 5, carY - 23);
    ctx.lineTo(carX - 5, carY - 5);
    ctx.lineTo(carX - 50, carY - 5);
    ctx.closePath();
    ctx.fill();

    // Shiny alloy wheels
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    for (const wx of [carX - 50, carX + 55]) {
      ctx.beginPath();
      ctx.arc(wx, carY + 16, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Golden cash receipts pouring from the exhaust / roof
    for (let bi = 0; bi < floatingBills.length; bi++) {
      const b = floatingBills[bi]!;
      b.x += b.vx * (1 + tension * 2);
      b.y += b.vy * (1 + tension * 2);
      b.rot += 0.04;
      if (b.y < 90) {
        b.y = 440;
        b.x = 480 + (Math.random() - 0.2) * 350;
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.isGold ? COLOURS.corpGold : '#e2e8f0';
      ctx.fillRect(-8, -4, 16, 8);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(-8, -4, 16, 8);
      ctx.restore();
    }
    ctx.restore();

    // Engine Section Headers
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOURS.indieGreen;
    ctx.fillText('ENGINE A: CUSTOM PHYS-X (40M BLADES)', 36, 470);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLOURS.corpNeon;
    ctx.fillText('ENGINE B: HYPER-BILLION CORP RENDER', 924, 470);

    // --- HUD: Top banners, Multiplier, Story Milestones ---
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText(TITLE, 480, 48);

    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText(SUBTITLE, 480, 74);

    // Big central multiplier display
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.indieGold;
    ctx.fillStyle = multColor;
    ctx.font = `800 ${66 + tension * 10}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 150);

    // Milestone text bubble
    const passed = running ? MILESTONES[milestoneCount - 1] : undefined;
    const statusText = passed ? passed[1] : PHASE_LABELS[view.phase];

    ctx.fillStyle = COLOURS.cardBg;
    ctx.beginPath();
    ctx.roundRect(140, 185, 680, 38, 19);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.crashed : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.fillText(statusText, 480, 209);

    // Player stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(line, 480, 508);

    // --- CELEBRATION / CASHOUT OVERLAY: Glider & Day One 10/10 Acclaim ---
    if (view.cashoutX100 !== null) {
      const gliderFloat = Math.sin(view.elapsed * 0.008) * 12;
      ctx.save();
      ctx.translate(480, 275 + gliderFloat);
      // Banner
      ctx.fillStyle = 'rgba(16, 185, 129, 0.92)';
      ctx.beginPath();
      ctx.roundRect(-240, -42, 480, 72, 14);
      ctx.fill();
      ctx.strokeStyle = '#ecfdf5';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.fillText('DAY ONE HIT! 10/10 MASTERPIECE SCORED', 0, -14);
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillStyle = '#d1fae5';
      ctx.fillText(`Escaped on Cartoon Glider at ${formatX(view.cashoutX100)} before marketing burn!`, 0, 14);

      // Cute glider wings on top
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-70, -42);
      ctx.lineTo(0, -78);
      ctx.lineTo(70, -42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // --- CRASH AFTERMATH OVERLAY: Giant Publisher Audit Stamp ---
    if (crashed) {
      const stampPop = Math.min(1, age * 3);
      ctx.save();
      ctx.translate(480, 270);
      ctx.scale(stampPop, stampPop);
      ctx.rotate(-0.1);

      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-260, -56, 520, 102, 16);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fee2e2';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px system-ui, sans-serif';
      ctx.fillText('AUDIT FAILED · PROJECT SCRAPPED', 0, -8);
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillStyle = '#fee2e2';
      ctx.fillText('Corporate cards revoked · Board shuts down studio sequel', 0, 28);
      ctx.restore();
    }

    ctx.restore();
  }

  return { draw };
}
