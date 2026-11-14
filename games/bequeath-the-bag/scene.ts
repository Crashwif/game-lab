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
  bgWallpaper: '#1e1b18',
  woodPanel: '#3b2516',
  woodTrim: '#22140b',
  crtBezel: '#c4baa4',
  crtScreen: '#0c1a0e',
  crtGlow: '#33ff66',
  crtScanline: 'rgba(20, 60, 25, 0.25)',
  crtAmber: '#ffaa22',
  paper: '#f5edd6',
  paperEdge: '#d2be99',
  goldStamp: '#ffd700',
  text: '#fdfbf7',
  muted: '#a89c8a',
  accent: '#5dfc8a',
  crashed: '#ff5252',
  cashedOut: '#6ee7b7',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Estate attorney blows dust off vintage password'],
  [150, 'March 9th calendar alert flashes ominous red'],
  [200, 'Unopened brokerage letters stack to the ceiling'],
  [250, 'Dial-up modem connects to prehistoric server'],
  [300, 'Portfolio unfreezes showing 2008 purchase price'],
  [500, 'Forgotten dividend reinvestment activates'],
  [1000, 'Nostalgic ticker suddenly catches penny pump'],
  [10000, 'Dad ghost nods in approval from wallpaper'],
  [100000, 'Heir prepares to pay off entire family mortgage'],
  [1000000, 'Longest diamond hand in recorded history wins'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Probate Cleared at ${formatX(view.cashoutX100)} · Cruise tickets booked!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Reverse split watched · No shares lost' : 'Reading 2008 prospectus · Spectating', COLOURS.muted];
  }
  if (crashed) return [`Inheritance wiped · Reverse split left $0.42 & paper`, COLOURS.crashed];
  return [`Estate active · ${credits(view.stake)} locked in 2008 penny vault`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastDialupBeep = 0;

  // Pre-generate static dust particles & shards
  const dustParticles = Array.from({ length: 32 }, (_, i) => ({
    x: (i * 31) % 960,
    y: (i * 47) % 540,
    r: 1 + (i % 3),
    speed: 0.2 + (i % 4) * 0.15,
  }));

  const shards = Array.from({ length: 24 }, (_, i) => ({
    dx: (Math.sin(i * 1.7) * 320),
    dy: -180 + ((i * 37) % 360),
    rot: (i * 25) * (Math.PI / 180),
    size: 10 + (i % 5) * 8,
  }));

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // SFX triggers
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('cheer', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('shatter', 1.0);
      audio.fx('gasp', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('ratchet', 0.4 + tension * 0.4);
      }
      if (now - lastDialupBeep > (1800 - tension * 1200) && view.cashoutX100 === null) {
        lastDialupBeep = now;
        audio.fx('beep', 0.2 + tension * 0.3);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : (running ? Math.sin(now * 0.02) * tension * 1.5 : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.07));

    // 1. LAW OFFICE WALLPAPER & WAINSCOTING
    const wallGrad = ctx.createLinearGradient(0, 0, 0, 360);
    wallGrad.addColorStop(0, '#1c1714');
    wallGrad.addColorStop(1, '#2c221b');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, 960, 360);

    // Subtle striped wallpaper
    ctx.fillStyle = 'rgba(255, 240, 210, 0.025)';
    for (let x = 0; x < 960; x += 32) {
      ctx.fillRect(x, 0, 16, 360);
    }

    // Dad Ghost in wallpaper (appears at higher multiplier depth)
    if (depth > 0.25) {
      ctx.save();
      const ghostAlpha = clamp01((depth - 0.25) * 1.2) * (0.28 + 0.1 * Math.sin(now * 0.003));
      ctx.globalAlpha = ghostAlpha;
      ctx.strokeStyle = '#8ee6ff';
      ctx.fillStyle = '#8ee6ff';
      ctx.lineWidth = 3;
      // Dad portrait frame on wall
      ctx.strokeRect(100, 70, 90, 110);
      // Ghost face & mustache nodding
      const nod = Math.sin(now * 0.005) * 3;
      ctx.beginPath();
      ctx.arc(145, 115 + nod, 22, 0, Math.PI * 2);
      ctx.stroke();
      // Glasses & proud smile
      ctx.strokeRect(132, 110 + nod, 10, 8);
      ctx.strokeRect(148, 110 + nod, 10, 8);
      ctx.beginPath();
      ctx.arc(145, 124 + nod, 10, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.font = '600 10px monospace';
      ctx.fillText('DAD 2008 HODL', 105, 195);
      ctx.restore();
    }

    // Heavy mahogany attorney desk
    ctx.fillStyle = COLOURS.woodTrim;
    ctx.fillRect(0, 340, 960, 25);
    const deskGrad = ctx.createLinearGradient(0, 365, 0, 540);
    deskGrad.addColorStop(0, COLOURS.woodPanel);
    deskGrad.addColorStop(1, '#150c07');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(0, 365, 960, 175);

    // Green Banker's Lamp glow
    const lampGlow = ctx.createRadialGradient(820, 220, 10, 820, 220, 240);
    lampGlow.addColorStop(0, 'rgba(120, 255, 140, 0.28)');
    lampGlow.addColorStop(1, 'rgba(10, 40, 15, 0)');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(820, 220, 240, 0, Math.PI * 2);
    ctx.fill();

    // Brass Banker Lamp body
    ctx.fillStyle = '#2d5a27';
    ctx.beginPath();
    ctx.roundRect(775, 190, 90, 30, 12);
    ctx.fill();
    ctx.strokeStyle = '#c49a45';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(820, 220);
    ctx.lineTo(820, 350);
    ctx.lineTo(800, 355);
    ctx.lineTo(840, 355);
    ctx.stroke();

    // 2. DUSTY STOCK CERTIFICATE STACKS (scale up with tension)
    const stackHeight = Math.floor(12 + tension * 45);
    for (let i = 0; i < stackHeight; i++) {
      const cy = 345 - i * 4;
      ctx.fillStyle = i % 2 === 0 ? COLOURS.paper : COLOURS.paperEdge;
      ctx.fillRect(60 + (i % 3) * 2, cy, 140, 5);
      if (i % 6 === 0) {
        ctx.fillStyle = '#9b302a';
        ctx.fillRect(70, cy + 1, 25, 3); // red ribbons / wax seals
      }
    }
    // Folder Label
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 12px monospace';
    ctx.fillText('ESTATE OF 2008 · PROBATE #08-401K', 60, 360);

    // Floating office dust particles
    ctx.fillStyle = 'rgba(255, 240, 200, 0.2)';
    for (const p of dustParticles) {
      const dy = (p.y - (now * 0.02 * p.speed)) % 340;
      const py = dy < 0 ? dy + 340 : dy;
      ctx.beginPath();
      ctx.arc(p.x, py, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. CENTERPIECE: RETRO CRT MONITOR
    const crtX = 330;
    const crtY = 140;
    const crtW = 310;
    const crtH = 220;

    // Monitor Outer Casing (Beige plastic, 2008 vintage)
    ctx.fillStyle = COLOURS.crtBezel;
    ctx.beginPath();
    ctx.roundRect(crtX - 15, crtY - 15, crtW + 30, crtH + 45, 16);
    ctx.fill();
    ctx.fillStyle = '#9c927f';
    ctx.fillRect(crtX + 80, crtY + crtH + 30, 120, 20); // stand
    ctx.fillRect(crtX + 50, crtY + crtH + 48, 180, 10);

    // Screen Bezel Inner Shadow
    ctx.fillStyle = '#050c05';
    ctx.beginPath();
    ctx.roundRect(crtX, crtY, crtW, crtH, 12);
    ctx.fill();

    // CRT Screen Phosphor Glow
    const screenGlow = ctx.createLinearGradient(crtX, crtY, crtX, crtY + crtH);
    screenGlow.addColorStop(0, crashed ? '#3a0c0c' : '#08250f');
    screenGlow.addColorStop(1, crashed ? '#150505' : '#031407');
    ctx.fillStyle = screenGlow;
    ctx.beginPath();
    ctx.roundRect(crtX + 5, crtY + 5, crtW - 10, crtH - 10, 10);
    ctx.fill();

    // Scanlines
    ctx.fillStyle = COLOURS.crtScanline;
    for (let sy = crtY + 6; sy < crtY + crtH - 6; sy += 4) {
      ctx.fillRect(crtX + 5, sy, crtW - 10, 2);
    }

    // CRT Screen Content
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(crtX + 5, crtY + 5, crtW - 10, crtH - 10, 10);
    ctx.clip();

    if (!crashed) {
      // 2008 Retro Line Chart
      ctx.strokeStyle = COLOURS.crtGlow;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(crtX + 15, crtY + crtH - 25);
      const points = 8;
      for (let p = 1; p <= points; p++) {
        const px = crtX + 15 + p * ((crtW - 35) / points);
        const curve = Math.sin((p * 0.9) + now * 0.003) * 15;
        const climb = ((crtH - 70) * (p / points)) * (0.3 + 0.7 * tension);
        ctx.lineTo(px, (crtY + crtH - 30) - climb + curve);
      }
      ctx.stroke();

      // CRT Header & Ticker Tape
      ctx.fillStyle = COLOURS.crtGlow;
      ctx.font = '700 12px monospace';
      ctx.fillText('LEHMAN-PENNY TRADER v2.08', crtX + 18, crtY + 28);
      ctx.font = '600 10px monospace';
      ctx.fillStyle = COLOURS.crtAmber;
      const tickerShift = (now * 0.04) % 180;
      ctx.fillText(`$BAG +${(view.currentX100 * 1.8).toFixed(0)}% · SHARES: 10,000,000 · NAV: FAILED`, crtX + 18 - tickerShift, crtY + 44);
    } else {
      // Screen shattered / reverse merger flash
      ctx.fillStyle = '#ff2222';
      ctx.font = '800 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('! REVERSE MERGER ALERT !', crtX + crtW / 2, crtY + 50);
      ctx.font = '700 12px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('1-FOR-100,000 SPLIT EXECUTED', crtX + crtW / 2, crtY + 85);
      ctx.fillText('REMAINING BALANCE: $0.42', crtX + crtW / 2, crtY + 115);
      ctx.fillStyle = '#ff8888';
      ctx.fillText('CERTIFICATE INVALIDATED', crtX + crtW / 2, crtY + 145);
      ctx.textAlign = 'left';
    }
    ctx.restore();

    // Monitor Power LED
    ctx.fillStyle = crashed ? '#ff0000' : '#33ff33';
    ctx.beginPath();
    ctx.arc(crtX + crtW - 20, crtY + crtH + 18, 4, 0, Math.PI * 2);
    ctx.fill();

    // 4. PROTAGONIST: HEIR AT LAWYER'S DESK (Right side)
    const heirX = 720;
    const heirY = 320;
    // Heir body & vintage tie
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.roundRect(heirX - 25, heirY + 30, 50, 70, 10);
    ctx.fill();
    // Rumpled white collar
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.moveTo(heirX - 12, heirY + 30);
    ctx.lineTo(heirX, heirY + 45);
    ctx.lineTo(heirX + 12, heirY + 30);
    ctx.fill();
    // 2008 skinny tie
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.moveTo(heirX - 4, heirY + 45);
    ctx.lineTo(heirX + 4, heirY + 45);
    ctx.lineTo(heirX + 6, heirY + 85);
    ctx.lineTo(heirX, heirY + 95);
    ctx.lineTo(heirX - 6, heirY + 85);
    ctx.fill();

    // Heir head & sweating/tense expression
    const headNod = running ? Math.sin(now * 0.01) * (2 + tension * 4) : 0;
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath();
    ctx.arc(heirX, heirY + headNod, 26, 0, Math.PI * 2);
    ctx.fill();
    // Hair
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.arc(heirX, heirY - 4 + headNod, 26, Math.PI, Math.PI * 2);
    ctx.fill();

    // Wide anxious eyes
    const eyeSize = 4 + tension * 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(heirX - 9, heirY - 2 + headNod, eyeSize + 2, 0, Math.PI * 2);
    ctx.arc(heirX + 9, heirY - 2 + headNod, eyeSize + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(heirX - 8, heirY - 2 + headNod, eyeSize * 0.7, 0, Math.PI * 2);
    ctx.arc(heirX + 10, heirY - 2 + headNod, eyeSize * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Sweat drops if high tension
    if (tension > 0.3 && !crashed) {
      ctx.fillStyle = '#80d8ff';
      ctx.beginPath();
      ctx.arc(heirX + 22, heirY - 6 + headNod, 3 + tension * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Heir clutches faded 2008 statement
    ctx.fillStyle = COLOURS.paper;
    ctx.save();
    ctx.translate(heirX - 35, heirY + 50);
    ctx.rotate(-0.15);
    ctx.fillRect(0, 0, 45, 30);
    ctx.strokeStyle = '#b0bec5';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 45, 30);
    ctx.fillStyle = '#90a4ae';
    ctx.fillRect(4, 6, 25, 2);
    ctx.fillRect(4, 12, 35, 2);
    ctx.fillRect(4, 18, 30, 2);
    ctx.restore();

    // 5. CRASH OR CASHOUT OVERLAYS
    if (crashed) {
      // Glass shards explosion
      ctx.save();
      const burstProgress = clamp01(crashAgeSec / 0.8);
      ctx.fillStyle = 'rgba(230, 245, 255, 0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      for (const shard of shards) {
        const sx = (crtX + crtW / 2) + shard.dx * burstProgress;
        const sy = (crtY + crtH / 2) + (shard.dy * burstProgress) + (burstProgress * burstProgress * 280);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(shard.rot + crashAgeSec * 4);
        ctx.beginPath();
        ctx.moveTo(0, -shard.size / 2);
        ctx.lineTo(shard.size / 2, shard.size / 2);
        ctx.lineTo(-shard.size / 2, shard.size / 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    if (view.cashoutX100 !== null) {
      // Golden Probate Envelope Celebration Banner
      ctx.save();
      ctx.fillStyle = 'rgba(10, 30, 18, 0.88)';
      ctx.beginPath();
      ctx.roundRect(240, 375, 480, 50, 10);
      ctx.fill();
      ctx.strokeStyle = COLOURS.goldStamp;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = COLOURS.goldStamp;
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ OFFICIAL PROBATE PAYOUT ENVELOPE ISSUED ★', 480, 396);
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = '#d1fae5';
      ctx.fillText('All 2008 Certs Redeemed · Sentimental Family Cruise Confirmed!', 480, 415);
      ctx.restore();
    }

    // 6. HUD / HEADER
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Tagline
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('BEQUEATH THE BAG', 480, 42);

    ctx.font = '600 14px monospace';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('16 YEARS OF INHERITED 2008 SUBPRIME PENNY STOCK', 480, 72);

    // Huge Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.accent);
    ctx.fillStyle = multColor;
    const punch = crashed ? (1 - clamp01((crashAgeSec - 0.1) / 0.25)) ** 2 : 0;
    ctx.font = `800 ${68 * (1 + 0.2 * punch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 118);

    // Milestone Caption
    const passed = running ? MILESTONES[milestoneIndex - 1] : undefined;
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px system-ui, sans-serif';
    const milestoneText = passed?.[1] ?? (running ? 'Connecting through dusty dial-up...' : (crashed ? 'Reverse merger annihilated portfolio' : 'Awaiting estate attorney signature...'));
    ctx.fillText(milestoneText, 480, 465);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 502);

    ctx.restore();
  }

  return { draw };
}
