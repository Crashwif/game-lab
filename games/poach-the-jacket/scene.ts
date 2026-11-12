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

const MILESTONES: [number, string][] = [
  [120, 'Direct message sent on corporate social net'],
  [150, 'Leather jacket spotted entering front lobby'],
  [200, 'Offer letter bumped with unlimited PTO'],
  [250, 'Server rack cluster offered as signing bonus'],
  [300, 'Founding partner desk rolled into office'],
  [500, 'Ten thousand GPU chips added to compensation'],
  [1000, 'Gigafactory named after new hire jacket'],
  [10000, 'Autonomous orbital satellite cluster pledged'],
  [100000, 'Both CEOs merge superclusters together'],
  [1000000, 'Total monopoly achieved over all silicon'],
];

const COLOURS = {
  bgTop: '#080c18',
  bgBottom: '#130d24',
  neonCyan: '#00f3ff',
  neonGreen: '#2bf874',
  neonGold: '#ffd53d',
  neonMagenta: '#ff2a85',
  leather: '#181a20',
  leatherHighlight: '#3c404d',
  crashed: '#ff3366',
  cashedOut: '#2bf874',
  text: '#ffffff',
  muted: '#8e9aaf',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`POACHED! Locked at ${formatX(view.cashoutX100)} · NDA Signed`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Hostile buyout concluded · Watching' : 'Watching · Ready to offer stock', COLOURS.muted];
  }
  if (crashed) {
    return [`Bought out! Lost your ${credits(view.stake)} package`, COLOURS.crashed];
  }
  return [`Signing bonus staked: ${credits(view.stake)}`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.8);
    }
    if (running && prevPhase === 'running' && milestoneIndex > prevMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('zap', 0.6 + tension * 0.4);
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.5) ** 2 : 0;
    const timeSec = now * 0.001;

    ctx.save();
    // Screen shake
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // --- Background Datacenter Skyline ---
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Neon synthwave horizon perspective grid
    ctx.save();
    ctx.strokeStyle = `rgba(0, 243, 255, ${0.15 + tension * 0.25})`;
    ctx.lineWidth = 1.5;
    const horizonY = 320;
    for (let x = -200; x <= 1160; x += 80) {
      ctx.beginPath();
      ctx.moveTo(480 + (x - 480) * 0.15, horizonY);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    const scrollZ = (view.elapsed * 0.08) % 40;
    for (let gy = horizonY + scrollZ; gy < 540; gy += 30) {
      const alpha = ((gy - horizonY) / (540 - horizonY)) * (0.2 + tension * 0.3);
      ctx.strokeStyle = `rgba(43, 248, 116, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(960, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Server Racks in background
    for (let i = 0; i < 6; i++) {
      const rx = 50 + i * 155;
      const ry = 140;
      const rw = 70;
      const rh = 160;
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#1d273a';
      ctx.strokeRect(rx, ry, rw, rh);
      // Blinking rack LEDs
      for (let slot = 0; slot < 7; slot++) {
        const sy = ry + 12 + slot * 20;
        const ledOn = Math.sin(timeSec * 8 + i * 3 + slot) > 0;
        ctx.fillStyle = ledOn ? (slot % 2 === 0 ? COLOURS.neonGreen : COLOURS.neonCyan) : '#04221b';
        ctx.fillRect(rx + 8, sy, 8, 4);
        ctx.fillStyle = '#1c2e42';
        ctx.fillRect(rx + 22, sy, rw - 30, 3);
      }
    }

    // Boardroom Desk
    const deskY = 340;
    const deskGrad = ctx.createLinearGradient(0, deskY, 0, 480);
    deskGrad.addColorStop(0, '#1a1f2c');
    deskGrad.addColorStop(1, '#0b0d14');
    ctx.fillStyle = deskGrad;
    ctx.beginPath();
    ctx.moveTo(100, deskY);
    ctx.lineTo(860, deskY);
    ctx.lineTo(940, 500);
    ctx.lineTo(20, 500);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLOURS.neonCyan;
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- LEFT CHARACTER: Recruiter Billionaire ---
    ctx.save();
    ctx.translate(190, 270);
    // Head / Hair (cyber-tech mogul pompadour)
    ctx.fillStyle = '#f6d19e';
    ctx.beginPath();
    ctx.arc(0, -50, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a2f1b';
    ctx.beginPath();
    ctx.arc(-4, -66, 26, Math.PI, Math.PI * 2);
    ctx.fill();
    // Smug grin & glasses
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-4, -46, 12, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillRect(-22, -58, 18, 10);
    ctx.fillRect(4, -58, 18, 10);
    // Body / Fancy Tech Blazer
    ctx.fillStyle = '#15243b';
    ctx.beginPath();
    ctx.moveTo(-40, -18);
    ctx.lineTo(40, -18);
    ctx.lineTo(55, 75);
    ctx.lineTo(-55, 75);
    ctx.closePath();
    ctx.fill();
    // Arm pushing gold pen
    const pushOffset = Math.sin(timeSec * 4) * (8 + tension * 12);
    ctx.strokeStyle = '#15243b';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(25, 10);
    ctx.lineTo(70 + pushOffset, 55);
    ctx.stroke();
    ctx.restore();

    // --- GOLD RECRUITER PEN & OFFER CONTRACT (Table Center) ---
    const penSlide = (Math.sin(timeSec * 3) * 0.5 + 0.5) * (60 + tension * 90);
    const penX = 330 + penSlide;
    const penY = 380;
    // Glowing offer dossier
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = COLOURS.neonCyan;
    ctx.shadowBlur = 12 + tension * 15;
    ctx.fillRect(360, 360, 110, 65);
    ctx.fillStyle = '#111827';
    ctx.font = '700 9px monospace';
    ctx.fillText('STOCK GRANT: 99%', 370, 378);
    ctx.fillText('TITLE: CHIEF JACKET', 370, 394);
    ctx.fillText('+10,000 H100 NODES', 370, 410);
    ctx.restore();

    // Oversized Gold Recruiter Pen
    ctx.save();
    ctx.translate(penX, penY);
    ctx.rotate(0.35);
    const goldGrad = ctx.createLinearGradient(0, -6, 0, 6);
    goldGrad.addColorStop(0, '#fff3b0');
    goldGrad.addColorStop(0.5, '#ffd700');
    goldGrad.addColorStop(1, '#b8860b');
    ctx.fillStyle = goldGrad;
    ctx.fillRect(-45, -6, 90, 12);
    // Pen Nib
    ctx.beginPath();
    ctx.moveTo(45, -6);
    ctx.lineTo(62, 0);
    ctx.lineTo(45, 6);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();

    // --- RIGHT CHARACTER: The Leather Jacket Icon ---
    ctx.save();
    ctx.translate(760, 260);
    const jacketAura = 10 + tension * 25 + Math.sin(timeSec * 6) * 5;
    // Neon Tensor Core Aura radiating from jacket
    ctx.shadowColor = crashed ? COLOURS.crashed : COLOURS.neonGreen;
    ctx.shadowBlur = jacketAura;

    // Leather Jacket Body
    ctx.fillStyle = COLOURS.leather;
    ctx.beginPath();
    ctx.moveTo(-50, -20);
    ctx.lineTo(50, -20);
    ctx.lineTo(65, 80);
    ctx.lineTo(-65, 80);
    ctx.closePath();
    ctx.fill();

    // Biker Jacket Zippers and Asymmetric Lapels
    ctx.strokeStyle = COLOURS.leatherHighlight;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-15, -20);
    ctx.lineTo(10, 80);
    ctx.stroke();

    // Neon Matrix Tensor circuits running on the jacket
    ctx.strokeStyle = crashed ? COLOURS.crashed : COLOURS.neonGreen;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-35, -5);
    ctx.lineTo(-20, 35);
    ctx.lineTo(-40, 65);
    ctx.moveTo(35, -5);
    ctx.lineTo(25, 40);
    ctx.lineTo(45, 65);
    ctx.stroke();

    // Head / Iconic Silver-streaked Hair
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f4cb9f';
    ctx.beginPath();
    ctx.arc(0, -52, 27, 0, Math.PI * 2);
    ctx.fill();
    // Signature hair
    ctx.fillStyle = '#9aa0a6';
    ctx.beginPath();
    ctx.arc(0, -68, 25, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    // Signature wire-rim glasses & expression
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.strokeRect(-22, -58, 18, 12);
    ctx.strokeRect(4, -58, 18, 12);
    ctx.beginPath();
    ctx.moveTo(-4, -52);
    ctx.lineTo(4, -52);
    ctx.stroke();

    // Smirk or sneer
    ctx.beginPath();
    if (crashed) {
      // Victorious sneer
      ctx.arc(2, -40, 10, 0, Math.PI * 0.8);
    } else {
      ctx.arc(0, -42, 8, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();

    // Arm holding remote button or high-five
    ctx.strokeStyle = COLOURS.leather;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (cashed) {
      // Reaching for high five
      ctx.moveTo(-30, 20);
      ctx.lineTo(-85, -10);
    } else if (crashed) {
      // Remote trigger hand
      ctx.moveTo(-30, 20);
      ctx.lineTo(-75, 45);
    } else {
      // Cross-armed stance
      ctx.moveTo(-30, 25);
      ctx.lineTo(-50, 55);
    }
    ctx.stroke();

    // Remote buy-out clicker in hand
    if (crashed) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-85, 40, 18, 10);
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath();
      ctx.arc(-80, 42, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Floating escalating Perks above the contract
    const perkY = 270 - depth * 35;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 22, 38, 0.85)';
    ctx.strokeStyle = COLOURS.neonGreen;
    ctx.lineWidth = 1.5;
    ctx.fillRect(360, perkY - 18, 240, 36);
    ctx.strokeRect(360, perkY - 18, 240, 36);
    ctx.fillStyle = COLOURS.neonGreen;
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    const activeMilestoneText = MILESTONES[Math.max(0, milestoneIndex - 1)]?.[1] ?? 'Drafting Executive Offer...';
    ctx.fillText(activeMilestoneText.toUpperCase(), 480, perkY + 4, 230);
    ctx.restore();

    // --- OVERLAYS: Crash / Cashed Out States ---
    if (cashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(5, 30, 15, 0.65)';
      ctx.fillRect(160, 160, 640, 150);
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.strokeRect(160, 160, 640, 150);
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.textAlign = 'center';
      ctx.font = '900 38px system-ui, sans-serif';
      ctx.fillText('SUPERSTAR HIRE LOCKED IN!', 480, 215);
      ctx.font = '600 20px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Executive NDA executed at ${formatX(view.cashoutX100 ?? 100)}! Driving off in armored cyber roadster!`, 480, 265, 600);
      ctx.restore();
    } else if (crashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(40, 5, 12, 0.78)';
      ctx.fillRect(140, 150, 680, 170);
      ctx.strokeStyle = COLOURS.crashed;
      ctx.lineWidth = 4;
      ctx.strokeRect(140, 150, 680, 170);
      ctx.fillStyle = COLOURS.crashed;
      ctx.textAlign = 'center';
      ctx.font = '900 42px system-ui, sans-serif';
      ctx.fillText('HOSTILE TAKEOVER TRIGGERED!', 480, 210);
      ctx.font = '700 21px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Leather jacket clicked remote: Bought your gigafactory in cash!', 480, 260, 640);
      ctx.font = '600 16px monospace';
      ctx.fillStyle = '#ff8ca8';
      ctx.fillText(`Failed at ${formatX(view.currentX100)}`, 480, 292);
      ctx.restore();
    }

    // --- HUD: Multiplier & Header Info ---
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top Title & Tagline
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonGold;
    ctx.shadowColor = COLOURS.neonGold;
    ctx.shadowBlur = 8;
    ctx.fillText('POACH THE JACKET', 480, 36);
    ctx.shadowBlur = 0;

    // Giant Multiplier
    const multiColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.neonCyan;
    ctx.fillStyle = multiColor;
    ctx.shadowColor = multiColor;
    ctx.shadowBlur = 14 + tension * 16;
    ctx.font = `900 ${76 + tension * 12}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 102);
    ctx.shadowBlur = 0;

    // Subtitle / Milestone Progress
    const [lineText, lineCol] = stakeLine(view);
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillStyle = lineCol;
    ctx.fillText(lineText, 480, 514, 880);

    ctx.restore();
    ctx.restore(); // Restore shake
  }

  return { draw };
}
