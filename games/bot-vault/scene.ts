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
  [120, 'Bot orders two smart balls via single text ping'],
  [150, 'United Club card charged for spontaneous getaway'],
  [200, 'Automated checkout clears three luxury watches'],
  [250, 'Bot orders 800 packs of organic beef jerky'],
  [300, 'Drone drops unrequested jet skis on the front lawn'],
  [500, 'Chatbot books entire boutique hotel in Ibiza'],
  [1000, 'Five maxed-out titanium cards glowing red-hot'],
  [10000, 'Bot initiates hostile leveraged buyout of FedEx'],
  [100000, 'AI buys an oil tanker on zero down payment'],
  [1000000, 'Bot purchases the Federal Reserve on revolving debt'],
];

const COLOURS = {
  bgTop: '#070c18',
  bgBottom: '#101726',
  cardColors: ['#fbbf24', '#38bdf8', '#c084fc', '#f43f5e', '#34d399'],
  phoneBody: '#1e293b',
  phoneScreen: '#0f172a',
  accent: '#38bdf8',
  crashed: '#ef4444',
  cashedOut: '#10b981',
  text: '#f8fafc',
  muted: '#94a3b8',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${Math.round(size * (1 + 0.25 * pop * pop))}px ui-sans-serif, system-ui, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Unplugged at ${formatX(view.cashoutX100)} · API tokens revoked!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Orders collided · watching safe from sidelines' : 'AI roaming free · no credits pledged', COLOURS.muted];
  }
  if (crashed) {
    return [`Driveway crushed! Your ${credits(view.stake)} vanished`, COLOURS.crashed];
  }
  return [`Auto-checkout active · ${credits(view.stake)} on revolving credit`, COLOURS.accent];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastPurchaseTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    const currentMilestone = milestoneIndex > 0 ? MILESTONES[milestoneIndex - 1] : undefined;

    // Purchase tick sound every ~1.2s to 0.4s based on tension
    const purchasePeriod = Math.max(380, 1200 - tension * 800);
    if (running && !cashedOut && view.elapsed - lastPurchaseTick > purchasePeriod) {
      lastPurchaseTick = view.elapsed;
      audio.fx('kaching', 0.3 + 0.5 * tension);
    }

    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('zap', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
    }
    if (running && previousPhase === 'running' && milestoneIndex > previousMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('notify', 0.7);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.6) ** 2 : (running ? Math.sin(now * 0.05) * tension * 2.5 : 0);
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.save();
    // Screen shake
    if (shake > 0) {
      ctx.translate(shake * Math.sin(age * 60 + now * 0.05), shake * Math.cos(age * 48 + now * 0.04));
    }

    // 1. Dynamic techno background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, crashed ? '#24080c' : COLOURS.bgTop);
    bgGrad.addColorStop(1, crashed ? '#140508' : COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Cyber perspective runway floor
    ctx.save();
    ctx.strokeStyle = crashed ? 'rgba(239,68,68,0.22)' : 'rgba(56,189,248,0.18)';
    ctx.lineWidth = 1.5;
    const horizonY = 320;
    const floorOffset = (view.elapsed * (0.15 + 0.3 * tension)) % 40;
    for (let x = -200; x <= 1160; x += 80) {
      ctx.beginPath();
      ctx.moveTo(480 + (x - 480) * 0.15, horizonY);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = horizonY + floorOffset; y <= 540; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Background Delivery Drones swarm
    const droneCount = 3 + Math.floor(tension * 5);
    for (let i = 0; i < droneCount; i++) {
      const droneSpeed = 0.08 + (i % 3) * 0.03 + tension * 0.12;
      const dx = ((now * droneSpeed + i * 210) % 1120) - 80;
      const dy = 55 + (i % 4) * 35 + Math.sin(now * 0.003 + i) * 8;
      // Drone body
      ctx.fillStyle = crashed ? '#ef4444' : '#64748b';
      ctx.fillRect(dx - 14, dy - 4, 28, 7);
      // Propeller line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      const spin = (now * 0.04 + i) % Math.PI;
      ctx.beginPath();
      ctx.moveTo(dx - 18, dy - 7);
      ctx.lineTo(dx - 18 + Math.cos(spin) * 12, dy - 7);
      ctx.moveTo(dx + 18, dy - 7);
      ctx.lineTo(dx + 18 + Math.cos(spin) * 12, dy - 7);
      ctx.stroke();
      // Tether & cargo parcel
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, dy + 3);
      ctx.lineTo(dx, dy + 18);
      ctx.stroke();
      // Glowing smart ball or parcel
      if (i % 2 === 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(dx - 6, dy + 18, 12, 12);
      } else {
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(dx, dy + 22, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Centerpiece: Five Fanned Credit Cards
    const phoneX = 480;
    const phoneY = 285;
    const cardAngles = [-0.42, -0.21, 0, 0.21, 0.42];
    const cardSpread = 1 + tension * 0.35;

    ctx.save();
    ctx.translate(phoneX, phoneY + 40);
    cardAngles.forEach((baseAngle, idx) => {
      ctx.save();
      const cardAngle = baseAngle * cardSpread + (running ? Math.sin(now * 0.01 + idx) * (0.02 + tension * 0.04) : 0);
      ctx.rotate(cardAngle);

      // Card vibration & heat
      const cardHeat = crashed ? 1 : clamp01(tension * 1.3 - 0.2);
      const cardCol = COLOURS.cardColors[idx % COLOURS.cardColors.length] ?? '#38bdf8';

      // Card body
      const cw = 110;
      const ch = 70;
      const cy = -160 - (idx === 2 ? 15 : 0) - depth * 10;
      roundRect(ctx, -cw / 2, cy, cw, ch, 8);
      const cardGrad = ctx.createLinearGradient(-cw / 2, cy, cw / 2, cy + ch);
      if (crashed) {
        cardGrad.addColorStop(0, '#3f1118');
        cardGrad.addColorStop(1, '#1f0609');
      } else {
        cardGrad.addColorStop(0, cardCol);
        cardGrad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = cardGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = cardHeat > 0.5 ? '#f43f5e' : 'rgba(255,255,255,0.25)';
      ctx.stroke();

      // Chip & embossed line
      ctx.fillStyle = cardHeat > 0.5 ? '#fbbf24' : '#e2e8f0';
      roundRect(ctx, -cw / 2 + 10, cy + 18, 18, 14, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-cw / 2 + 10, cy + 44, cw - 20, 4);

      // Overheat flame sparks on card edge
      if (cardHeat > 0.6 && running) {
        ctx.fillStyle = '#ff7849';
        ctx.beginPath();
        ctx.arc(Math.sin(now * 0.03 + idx * 5) * 40, cy - 4, 3 + tension * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.restore();

    // 4. Centerpiece: The Glowing Smartphone & AI Face
    ctx.save();
    ctx.translate(phoneX, phoneY);
    const phoneBob = running ? Math.sin(now * 0.005) * 6 : 0;
    ctx.translate(0, phoneBob);

    // Phone chassis
    const pw = 150;
    const ph = 210;
    roundRect(ctx, -pw / 2 - 4, -ph / 2 - 4, pw + 8, ph + 8, 24);
    ctx.fillStyle = crashed ? '#450a0a' : '#1e293b';
    ctx.fill();
    ctx.strokeStyle = cashedOut ? '#10b981' : (crashed ? '#ef4444' : '#38bdf8');
    ctx.lineWidth = 3;
    ctx.stroke();

    // Screen
    roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 20);
    ctx.fillStyle = crashed ? '#1a0507' : '#0b1329';
    ctx.fill();

    // Top speaker / camera notch
    ctx.fillStyle = '#334155';
    roundRect(ctx, -20, -ph / 2 + 6, 40, 5, 3);
    ctx.fill();

    // Bot Face on Screen
    if (crashed) {
      // Crashed: Dead eyes X_X and warning
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      // Left eye X
      ctx.beginPath();
      ctx.moveTo(-35, -20); ctx.lineTo(-15, 0);
      ctx.moveTo(-15, -20); ctx.lineTo(-35, 0);
      // Right eye X
      ctx.moveTo(15, -20); ctx.lineTo(35, 0);
      ctx.moveTo(35, -20); ctx.lineTo(15, 0);
      ctx.stroke();
      // Frown
      ctx.beginPath();
      ctx.arc(0, 35, 18, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      // Screen crack line
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-40, -60);
      ctx.lineTo(10, -10);
      ctx.lineTo(-5, 45);
      ctx.lineTo(35, 75);
      ctx.stroke();
    } else if (cashedOut) {
      // Cashed out / Router unplugged: Peaceful sleep ^_^
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-25, -10, 12, Math.PI * 1.1, Math.PI * 1.9);
      ctx.arc(25, -10, 12, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      // Smile
      ctx.beginPath();
      ctx.arc(0, 16, 16, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // Offline prompt
      ctx.fillStyle = '#6ee7b7';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('API OFFLINE', 0, 56);
    } else {
      // Running / Active Bot: Glowing cyber eyes & wide grinning mouth
      const eyePuff = 1 + tension * 0.4;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-26, -10, 10 * eyePuff, 0, Math.PI * 2);
      ctx.arc(26, -10, 10 * eyePuff, 0, Math.PI * 2);
      ctx.fill();

      // Eye pupils tracking or flashing
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-26 + Math.sin(now * 0.006) * 3, -10, 4, 0, Math.PI * 2);
      ctx.arc(26 + Math.sin(now * 0.006) * 3, -10, 4, 0, Math.PI * 2);
      ctx.fill();

      // Digital Grin
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const mouthOpen = 8 + tension * 12;
      ctx.ellipse(0, 20, 22, mouthOpen, 0, 0, Math.PI);
      ctx.stroke();

      // Live mini chat prompt at bottom of phone
      ctx.fillStyle = '#0284c7';
      roundRect(ctx, -56, 46, 112, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.font = '600 10px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(tension > 0.6 ? '⚡ AUTO-BUYING!' : '🤖 APPROVED!', 0, 60);
    }

    ctx.restore();

    // 5. Special Cashed Out: Unplugged Wi-Fi Router Cable floating on left
    if (cashedOut) {
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
      roundRect(ctx, 330, 420, 300, 36, 18);
      ctx.fill();
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#a7f3d0';
      ctx.font = '700 15px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🔌 WI-FI UNPLUGGED · EXPEDITED ORDERS CUT', 480, 443);
      ctx.restore();
    }

    // 6. Special Crashed Overlay: Red Overlimit Alert
    if (crashed) {
      const bannerPulse = 0.8 + 0.2 * Math.sin(age * 16);
      ctx.save();
      ctx.globalAlpha = bannerPulse;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.88)';
      roundRect(ctx, 220, 412, 520, 44, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 18px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 OVERLIMIT! 400 DELIVERY VANS PILE UP IN DRIVEWAY', 480, 440);
      ctx.restore();
    }

    // 7. Heads Up Display (HUD)
    // Game Title & Tagline
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '800 22px ui-sans-serif, system-ui';
    ctx.fillText('BOT VAULT', 480, 32);

    // Huge Multiplier Readout
    const multColor = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.cashedOut : COLOURS.text);
    ctx.fillStyle = multColor;
    const multPop = pop(currentMilestone?.[0] ?? 100);
    ctx.font = popFont(900, 74, multPop);
    ctx.fillText(formatX(view.currentX100), 480, 94);

    // Milestones caption banner
    if (running || crashed) {
      const captionText = currentMilestone ? currentMilestone[1] : 'Handing credit cards to autonomous AI...';
      ctx.fillStyle = running ? COLOURS.accent : (crashed ? '#fca5a5' : COLOURS.muted);
      ctx.font = '600 17px ui-sans-serif, system-ui';
      ctx.fillText(captionText, 480, 146, 860);
    } else {
      ctx.fillStyle = COLOURS.muted;
      ctx.font = '600 18px ui-sans-serif, system-ui';
      ctx.fillText('Ready for the next delivery blitz', 480, 146);
    }

    // Bottom Stake / Cashout Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 20px ui-sans-serif, system-ui';
    ctx.fillText(lineText, 480, 502, 880);

    ctx.restore();
  }

  return { draw };
}
