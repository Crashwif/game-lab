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
  bgTop: '#0a0f1d',
  bgBottom: '#05070d',
  cardboard: '#c89a58',
  cardboardDark: '#8b6432',
  gpuPcb: '#0f3826',
  gpuFan: '#10b981',
  cashGreen: '#22c55e',
  paperWhite: '#f8fafc',
  suitNavy: '#1e293b',
  suitTie: '#ef4444',
  auditRed: '#dc2626',
  gold: '#fbbf24',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#38bdf8',
  cashedOut: '#4ade80',
  crashed: '#f87171',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First vendor credit issued on a napkin'],
  [150, 'Neocloud company orders 10,000 servers'],
  [200, 'Unused server capacity bought back at cost'],
  [250, 'CFO questions the mysterious guarantee spread'],
  [300, 'Guarantees double to five hundred billion'],
  [500, 'Cardboard data centers fill the whole horizon'],
  [1000, 'Money completes ten full circular laps'],
  [10000, 'Every bank accepts GPU invoices as gold'],
  [100000, 'The balance sheet folds into fourth dimension'],
  [1000000, 'Infinite circular revenue engine ascends'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Wired to offshore vault at ${formatX(view.cashoutX100)} · Escaped audit`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Auditors raided the loop · Spectating' : 'Watching circular debt loop · No stake', COLOURS.muted];
  }
  if (crashed) return [`Fictitious collateral collapsed · Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Revolving debt active · ${credits(view.stake)} committed`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastFxTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('yeet', 0.85);
      audio.fx('kaching', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.7);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIndex > prevMilestone) audio.milestone(milestoneIndex);
      const tickInterval = Math.max(120, 480 - tension * 360);
      if (now - lastFxTick > tickInterval && view.cashoutX100 === null) {
        lastFxTick = now;
        audio.fx('ratchet', 0.25 + 0.35 * tension);
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const shake = crashed ? 14 * clamp01(1 - age / 0.5) ** 2 : 0;
    const shakeX = shake * Math.sin(age * 80);
    const shakeY = shake * Math.cos(age * 60);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Background corporate facility / cardboard server room
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Perspective floor lines
    ctx.strokeStyle = '#1e293b55';
    ctx.lineWidth = 1.5;
    for (let x = -200; x <= 1160; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 320);
      ctx.lineTo(480 + (x - 480) * 2.2, 540);
      ctx.stroke();
    }
    ctx.strokeStyle = '#33415533';
    for (let y = 330; y <= 540; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Background Cardboard Data Center Silhouette on the right
    const cardboardX = 640;
    ctx.fillStyle = COLOURS.cardboardDark;
    ctx.fillRect(cardboardX - 20, 160, 260, 200);
    ctx.fillStyle = COLOURS.cardboard;
    ctx.fillRect(cardboardX - 10, 170, 240, 185);
    // Cardboard flaps & tape
    ctx.strokeStyle = '#6b4f24';
    ctx.lineWidth = 2;
    ctx.strokeRect(cardboardX - 10, 170, 240, 185);
    ctx.fillStyle = '#b48a47';
    ctx.fillRect(cardboardX + 20, 200, 180, 20); // brown tape
    // Marker label
    ctx.fillStyle = '#222';
    ctx.font = '700 16px monospace';
    ctx.fillText('DATA CENTER 01', cardboardX + 40, 195);
    ctx.font = '600 12px monospace';
    ctx.fillText('(DO NOT OPEN: HOLLOW)', cardboardX + 30, 235);
    // Fake blinking LED array on cardboard
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const ledOn = Math.sin(view.elapsed * 0.008 + r * 3 + c * 2) > 0.1;
        ctx.fillStyle = ledOn ? (crashed ? '#ef4444' : '#10b981') : '#1e293b';
        ctx.beginPath();
        ctx.arc(cardboardX + 15 + c * 26, 260 + r * 22, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Conveyor Belt Loop
    const beltY = 380;
    const beltW = 760;
    const beltX = 100;
    const beltSpeed = (view.elapsed * (0.4 + tension * 1.6)) % 40;

    // Conveyor structural frame
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(beltX - 20, beltY - 6, beltW + 40, 32);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(beltX - 20, beltY - 6, beltW + 40, 32);

    // Conveyor rollers
    for (let rx = beltX - 10; rx <= beltX + beltW + 10; rx += 45) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(rx, beltY + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(rx, beltY + 10, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Top track moving right (GPUs to Data Center)
    ctx.fillStyle = '#334155';
    ctx.fillRect(beltX, beltY - 14, beltW, 10);
    // Bottom track moving left (IOU cash loop back)
    ctx.fillRect(beltX, beltY + 24, beltW, 8);

    // Items on top track: GPUs moving RIGHT
    const gpuSpacing = 160;
    const gpuOffset = (beltSpeed * 4) % gpuSpacing;
    if (!crashed || age < 0.2) {
      for (let gx = beltX + gpuOffset - 50; gx < beltX + beltW; gx += gpuSpacing) {
        if (gx < beltX - 30 || gx > beltX + beltW - 20) continue;
        // GPU PCB
        ctx.fillStyle = COLOURS.gpuPcb;
        ctx.fillRect(gx, beltY - 42, 60, 28);
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx, beltY - 42, 60, 28);
        // GPU Fans
        const fanRot = (view.elapsed * 0.02) % (Math.PI * 2);
        for (let fanI = 0; fanI < 2; fanI++) {
          const fx = gx + 18 + fanI * 24;
          const fy = beltY - 28;
          ctx.fillStyle = '#064e3b';
          ctx.beginPath();
          ctx.arc(fx, fy, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = COLOURS.gpuFan;
          ctx.beginPath();
          ctx.arc(fx, fy, 9, fanRot, fanRot + Math.PI);
          ctx.stroke();
        }
        // Gold connectors
        ctx.fillStyle = COLOURS.gold;
        ctx.fillRect(gx + 12, beltY - 14, 36, 3);
      }
    }

    // Items on bottom track: Flying promissory notes / Cash bundles moving LEFT
    const cashSpacing = 140;
    const cashOffset = (beltW - (beltSpeed * 4) % cashSpacing);
    if (!crashed || age < 0.25) {
      for (let cx = beltX + (cashOffset % cashSpacing) - 20; cx < beltX + beltW; cx += cashSpacing) {
        ctx.fillStyle = COLOURS.cashGreen;
        ctx.fillRect(cx, beltY + 34, 46, 18);
        ctx.strokeStyle = '#15803d';
        ctx.strokeRect(cx, beltY + 34, 46, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 10px monospace';
        ctx.fillText('$$$ IOU', cx + 4, beltY + 47);
      }
    }

    // 3. Stacks of Promissory Notes (Unstable Towers)
    const towerH = Math.min(180, (tension * 140) + depth * 40);
    const wobble = Math.sin(view.elapsed * (0.006 + tension * 0.015)) * (tension * 16);
    const stackX = 350;
    const stackBaseY = beltY - 14;

    ctx.save();
    ctx.translate(stackX + wobble * 0.4, stackBaseY);
    ctx.rotate((wobble * Math.PI) / 180);
    const layers = Math.floor(towerH / 6);
    for (let i = 0; i < layers; i++) {
      const ly = -i * 6;
      const lw = 70 - (i / layers) * 15;
      const jiggle = Math.sin(i * 0.8 + view.elapsed * 0.01) * (tension * 3);
      ctx.fillStyle = i % 2 === 0 ? COLOURS.paperWhite : '#e2e8f0';
      ctx.fillRect(-lw / 2 + jiggle, ly - 5, lw, 5);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-lw / 2 + jiggle, ly - 5, lw, 5);
    }
    if (layers > 4) {
      ctx.fillStyle = '#b91c1c';
      ctx.font = '700 9px sans-serif';
      ctx.fillText('CIRCULAR LOAN', -30, -towerH + 12);
    }
    ctx.restore();

    // 4. Protagonist: Sweating Suit atop the conveyor belt / Escape chute
    const suitDeskX = 220;
    const suitDeskY = beltY - 14;
    const isEscaped = view.cashoutX100 !== null;

    if (isEscaped) {
      // Escape chute on the left
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(80, 200);
      ctx.lineTo(130, 200);
      ctx.lineTo(80, 480);
      ctx.lineTo(20, 480);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Sign: OFFSHORE VAULT
      ctx.fillStyle = COLOURS.gold;
      ctx.font = '700 12px sans-serif';
      ctx.fillText('OFFSHORE CHUTE', 15, 220);

      // Leaping suit sliding down chute
      const slideT = clamp01((view.elapsed % 1500) / 1200);
      const slideX = 110 - slideT * 60;
      const slideY = 240 + slideT * 200;

      ctx.save();
      ctx.translate(slideX, slideY);
      ctx.rotate(-0.4);
      // Duffel bag with checks
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.roundRect(14, -10, 34, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.font = '900 12px sans-serif';
      ctx.fillText('$$$', 20, 6);

      // Suit body
      ctx.fillStyle = COLOURS.suitNavy;
      ctx.fillRect(-15, -15, 30, 35);
      // Red tie blowing
      ctx.strokeStyle = COLOURS.suitTie;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(8, 12);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -25, 12, 0, Math.PI * 2);
      ctx.fill();
      // Cheerful grinning face
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-3, -27, 2, 0, Math.PI * 2);
      ctx.arc(3, -27, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -22, 5, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    } else if (!crashed) {
      // Sitting at conveyor desk furiously stamping promissory notes
      const franticRate = view.elapsed * (0.015 + tension * 0.04);
      const bobY = Math.sin(franticRate) * (2 + tension * 5);
      const headX = suitDeskX;
      const headY = suitDeskY - 60 + bobY;

      // Desk / balance ledger
      ctx.fillStyle = '#334155';
      ctx.fillRect(suitDeskX - 35, suitDeskY - 20, 70, 20);

      // Suit Torso
      ctx.fillStyle = COLOURS.suitNavy;
      ctx.fillRect(suitDeskX - 22, headY + 12, 44, 38);

      // Red Tie swinging
      ctx.fillStyle = COLOURS.suitTie;
      ctx.beginPath();
      ctx.moveTo(suitDeskX - 4, headY + 14);
      ctx.lineTo(suitDeskX + 4, headY + 14);
      ctx.lineTo(suitDeskX + Math.sin(franticRate * 1.5) * 6, headY + 44);
      ctx.closePath();
      ctx.fill();

      // Arms stamping furiously
      ctx.fillStyle = COLOURS.suitNavy;
      const armStampY = Math.sin(franticRate * 2) * 8;
      ctx.fillRect(suitDeskX - 32, headY + 22 + armStampY, 14, 24);
      ctx.fillRect(suitDeskX + 18, headY + 22 - armStampY, 14, 24);

      // Stamp in hand
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(suitDeskX + 24, headY + 40 - armStampY, 10, 8);

      // Suit Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(headX, headY, 16, 0, Math.PI * 2);
      ctx.fill();

      // Disheveled hair
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(headX, headY - 6, 17, Math.PI, Math.PI * 2);
      ctx.fill();

      // Panicked wide eyes
      const pupilOffset = Math.sin(view.elapsed * 0.02) * 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(headX - 6, headY - 2, 5, 0, Math.PI * 2);
      ctx.arc(headX + 6, headY - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(headX - 6 + pupilOffset, headY - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(headX + 6 + pupilOffset, headY - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Trembling mouth
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(headX, headY + 8, 4 + tension * 3, 0, Math.PI);
      ctx.stroke();

      // Sweat beads bursting out
      const sweatCount = 2 + Math.floor(tension * 6);
      for (let s = 0; s < sweatCount; s++) {
        const angle = (s / sweatCount) * Math.PI - 0.2 + Math.sin(view.elapsed * 0.03 + s);
        const dist = 24 + ((view.elapsed * 0.08 + s * 12) % 24);
        const sx = headX + Math.cos(angle) * dist;
        const sy = headY - 10 + Math.sin(angle) * dist;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Crashed: Suit blown away, conveyor destroyed
      const fallT = Math.min(1, age * 2);
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(suitDeskX - fallT * 80, suitDeskY + fallT * 60, 14, 0, Math.PI * 2);
      ctx.fill();
      // X eyes
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      const ex = suitDeskX - fallT * 80;
      const ey = suitDeskY + fallT * 60;
      ctx.strokeText('x x', ex - 8, ey + 4);
    }

    // 5. Crash Effects: Confetti audit shreds & Giant REJECTED Stamp
    if (crashed) {
      // Shredded paper confetti
      const confettiSeed = Math.floor(age * 50);
      for (let i = 0; i < 40; i++) {
        const cx = (i * 27 + confettiSeed * 9) % 960;
        const cy = ((i * 37 + age * 400) % 540);
        const rot = (i + age * 10);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = i % 3 === 0 ? '#ef4444' : i % 2 === 0 ? '#f8fafc' : '#fbbf24';
        ctx.fillRect(-6, -4, 12, 8);
        ctx.restore();
      }

      // Giant CFO Audit Stamp Slam
      const stampPunch = clamp01(age / 0.12);
      const stampScale = 1 + (1 - stampPunch) * 2;
      ctx.save();
      ctx.translate(480, 280);
      ctx.rotate(-0.14);
      ctx.scale(stampScale, stampScale);
      ctx.strokeStyle = COLOURS.auditRed;
      ctx.lineWidth = 10;
      ctx.strokeRect(-240, -50, 480, 100);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
      ctx.fillRect(-240, -50, 480, 100);

      ctx.fillStyle = COLOURS.auditRed;
      ctx.font = '900 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AUDIT REJECTED', 0, -10);
      ctx.font = '700 18px monospace';
      ctx.fillText('FICTITIOUS CIRCULAR GUARANTEE COLLAPSED', 0, 26);
      ctx.restore();
    }

    // 6. HUD / Headers / Multiplier Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText('GPU LOAN LOOP', 480, 44);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('CIRCULAR VENDOR FINANCING ENGINE · FICTITIOUS BALANCE SHEET', 480, 72);

    // Huge Multiplier
    const tint = crashed ? COLOURS.crashed : (isEscaped ? COLOURS.cashedOut : COLOURS.accent);
    ctx.fillStyle = tint;
    const pulse = running ? 1 + tension * 0.08 * Math.sin(view.elapsed * 0.012) : 1;
    ctx.font = `900 ${Math.round(84 * pulse)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 138);

    // Milestone / Phase Status Banner
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    const bannerText = running
      ? (currentMilestone ? currentMilestone[1] : 'Lending loop accelerating...')
      : (crashed ? 'BALANCE SHEET IMPLODED IN AUDIT' : 'Awaiting Next Credit Cycle');

    ctx.fillStyle = crashed ? COLOURS.crashed : (running ? COLOURS.gold : COLOURS.muted);
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 484);

    // Player stake / cash-out line
    const [lineText, lineColour] = stakeLine(view);
    ctx.fillStyle = lineColour;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 514);

    ctx.restore();
  }

  return { draw };
}
