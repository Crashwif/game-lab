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
  bgTop: '#0a0d14',
  bgBottom: '#181b24',
  woodDark: '#2a1a14',
  woodMid: '#4a2d20',
  woodTrim: '#c6924b',
  marble: '#dfdcd5',
  carpet: '#641e24',
  text: '#ffffff',
  muted: '#9ba5b7',
  accent: '#5ce1e6',
  crashed: '#ff4d6d',
  cashedOut: '#4ade80',
  tape: '#ff2a2a',
  subpoena: '#f8fafc',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Fresh subpoena slid across the witness desk'],
  [150, 'C-SPAN red recording light blinks ominously'],
  [200, 'Congressional aide brings out unpaid cloud bills'],
  [250, 'Cooling fan flies loose from the server case'],
  [300, 'Lawmakers vote unanimously against free credits'],
  [500, 'Bankruptcy auction paddles rise across the room'],
  [1000, 'Federal marshals secure the remaining hard drives'],
  [10000, 'Liquidators list CEO fleece vest on government eBay'],
  [100000, 'Algorithm source code printed on scrap paper rolls'],
  [1000000, 'Empty corporate headquarters turned into a DMV'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Sprinted past reporters at ${formatX(view.cashoutX100)} with runway safe!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Gavel slammed · spectator observing liquidation' : 'Spectating hearing · no seed compute staked', COLOURS.muted];
  }
  if (crashed) {
    return [`Gavel dropped! ${credits(view.stake)} seized for auction`, COLOURS.crashed];
  }
  return [`Testifying under oath · ${credits(view.stake)} compute burning`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastShutterTime = 0;

  function drawChamber(ctx: CanvasRenderingContext2D, elapsed: number, tension: number) {
    // Wall and mahogany paneling
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, COLOURS.bgTop);
    grad.addColorStop(0.65, COLOURS.bgBottom);
    grad.addColorStop(1, COLOURS.carpet);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);

    // Marble fluted columns
    for (let i = 0; i < 5; i++) {
      const cx = 90 + i * 195;
      ctx.fillStyle = 'rgba(25, 30, 42, 0.8)';
      ctx.fillRect(cx - 24, 0, 48, 380);
      ctx.fillStyle = 'rgba(223, 220, 213, 0.12)';
      ctx.fillRect(cx - 20, 0, 40, 380);
      ctx.fillStyle = 'rgba(198, 146, 75, 0.35)';
      ctx.fillRect(cx - 26, 0, 52, 18);
      ctx.fillRect(cx - 26, 360, 52, 20);
    }

    // Committee Dais in back
    ctx.fillStyle = COLOURS.woodDark;
    ctx.fillRect(0, 250, 960, 80);
    ctx.fillStyle = COLOURS.woodTrim;
    ctx.fillRect(0, 248, 960, 4);

    // Congressional Seal backdrop
    ctx.save();
    ctx.translate(480, 140);
    ctx.strokeStyle = 'rgba(198, 146, 75, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(198, 146, 75, 0.15)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOUSE COMMITTEE ON RUNWAY EXHAUSTION', 0, 5);
    ctx.restore();

    // Witness desk in foreground
    ctx.fillStyle = COLOURS.woodMid;
    ctx.beginPath();
    ctx.moveTo(120, 410);
    ctx.lineTo(840, 410);
    ctx.lineTo(920, 540);
    ctx.lineTo(40, 540);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLOURS.woodTrim;
    ctx.fillRect(100, 408, 760, 6);

    // Subpoena envelopes stacking based on tension
    const subpoenaCount = Math.min(10, Math.floor(tension * 12));
    for (let i = 0; i < subpoenaCount; i++) {
      ctx.save();
      ctx.translate(220 + (i % 2) * 16, 430 - i * 5);
      ctx.rotate((i % 3 - 1) * 0.08);
      ctx.fillStyle = COLOURS.subpoena;
      ctx.fillRect(-35, -15, 70, 30);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(-35, -15, 70, 30);
      ctx.fillStyle = '#dc2626';
      ctx.font = '700 9px monospace';
      ctx.fillText('SUBPOENA', -25, 2);
      ctx.restore();
    }

    // Red tape rolls stretching across desk
    if (tension > 0.4) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 14;
      ctx.setLineDash([22, 12]);
      ctx.beginPath();
      ctx.moveTo(150, 460);
      ctx.lineTo(420 + tension * 80, 440 + tension * 20);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // C-SPAN camera indicator
    const blink = Math.sin(elapsed * 0.008) > 0;
    ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(60, 36, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('C-SPAN 3 · LIVE WITNESS TESTIMONY', 76, 40);
  }

  function drawFounder(ctx: CanvasRenderingContext2D, view: SceneView, tension: number, age: number) {
    const isEscaped = view.cashoutX100 !== null;
    const isCrashed = view.phase === 'crashed';
    const tremble = (view.phase === 'running' || isCrashed) ? (Math.random() - 0.5) * (tension * 8 + 2) : 0;
    const escapeProgress = isEscaped ? Math.min(1, (view.elapsed % 3000) / 1200) : 0;

    ctx.save();
    if (isEscaped) {
      // Sprinting towards exit on right
      ctx.translate(560 + escapeProgress * 320, 380);
      ctx.scale(0.9, 0.9);
    } else {
      ctx.translate(480 + tremble, 380);
    }

    if (isCrashed) {
      // Flattened by gavel
      const flatten = clamp01(age / 0.15);
      ctx.scale(1 + flatten * 0.6, Math.max(0.08, 1 - flatten * 0.92));
    }

    // Meltdown server rack in front/arms
    const heatColor = tension > 0.6 ? '#f97316' : '#38bdf8';
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-55, -45, 110, 80);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(-55, -45, 110, 80);

    // Blinking rack drive slots & LEDs
    for (let r = 0; r < 4; r++) {
      const ry = -38 + r * 18;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-48, ry, 96, 12);
      ctx.fillStyle = (Math.sin(view.elapsed * 0.02 + r) > 0) ? heatColor : '#ef4444';
      ctx.fillRect(-44, ry + 3, 6, 6);
      ctx.fillRect(-32, ry + 3, 6, 6);
    }

    // Sizzling sparks / heat smoke from server
    if (view.phase === 'running' && tension > 0.25) {
      for (let s = 0; s < 4; s++) {
        const sy = -50 - ((view.elapsed * 0.08 + s * 22) % 60);
        const sx = Math.sin(view.elapsed * 0.01 + s) * 24;
        ctx.fillStyle = `rgba(249, 115, 22, ${Math.max(0, 0.8 - ((-sy - 50) / 60))})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + s * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Founder Torso & Iconic Tech Fleece Vest
    ctx.fillStyle = '#1e3a8a'; // Blue collared shirt
    ctx.beginPath();
    ctx.ellipse(0, -90, 42, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Puffy Tech Fleece Vest (Gray)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-35, -55);
    ctx.lineTo(-30, -125);
    ctx.quadraticCurveTo(0, -118, 30, -125);
    ctx.lineTo(35, -55);
    ctx.quadraticCurveTo(0, -50, -35, -55);
    ctx.fill();
    // Vest zipper
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -122);
    ctx.lineTo(0, -52);
    ctx.stroke();

    // Founder Head
    ctx.fillStyle = '#fed7aa'; // Skin
    ctx.beginPath();
    ctx.arc(0, -150, 26, 0, Math.PI * 2);
    ctx.fill();

    // Messy Founder Hair
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(0, -162, 26, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();

    // Panicked Eyes
    const eyeSize = 6 + tension * 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-9, -152, eyeSize, 0, Math.PI * 2);
    ctx.arc(9, -152, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-9 + (Math.random() - 0.5) * tension * 3, -152, 2.5, 0, Math.PI * 2);
    ctx.arc(9 + (Math.random() - 0.5) * tension * 3, -152, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Trembling/Screaming Mouth
    ctx.fillStyle = isEscaped ? '#22c55e' : (tension > 0.5 ? '#b91c1c' : '#7c2d12');
    ctx.beginPath();
    if (isEscaped) {
      // Big grin escaping
      ctx.arc(0, -138, 8, 0, Math.PI);
    } else {
      ctx.ellipse(0, -138, 5 + tension * 6, 4 + tension * 7, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // Sweat beads flying
    if (tension > 0.3 && !isEscaped && !isCrashed) {
      ctx.fillStyle = '#38bdf8';
      const sweatY = -158 + (view.elapsed * 0.05) % 30;
      ctx.beginPath();
      ctx.arc(22, sweatY, 3.5, 0, Math.PI * 2);
      ctx.arc(-24, sweatY - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clutching hands on server
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(-42, -28, 9, 0, Math.PI * 2);
    ctx.arc(42, -28, 9, 0, Math.PI * 2);
    ctx.fill();

    // Nameplate on witness desk
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-65, 20, 130, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MR. FOUNDER (SEED RUNWAY: $0)', 0, 35);

    // Microphones angling toward witness
    const micBend = Math.min(18, tension * 22);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-110, 30);
    ctx.quadraticCurveTo(-90 - micBend, -20, -50 - micBend, -40);
    ctx.moveTo(110, 30);
    ctx.quadraticCurveTo(90 + micBend, -20, 50 + micBend, -40);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(-50 - micBend, -40, 7, 0, Math.PI * 2);
    ctx.arc(50 + micBend, -40, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawGavelSmash(ctx: CanvasRenderingContext2D, age: number) {
    if (age <= 0) return;
    // Gavel slamming from ceiling: hits at age 0.1s
    const hitTime = 0.12;
    const gavelY = age < hitTime ? 380 * (age / hitTime) : 380;
    
    ctx.save();
    ctx.translate(480, gavelY);
    // Draw giant wooden gavel head
    ctx.fillStyle = '#5c2c16';
    ctx.fillRect(-110, -50, 220, 60);
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(-115, -45, 10, 50);
    ctx.fillRect(105, -45, 10, 50);
    // Handle
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-14, -220, 28, 170);

    // Impact debris & shockwave
    if (age >= hitTime) {
      const impactAge = age - hitTime;
      const blastRadius = impactAge * 450;
      ctx.strokeStyle = `rgba(255, 77, 109, ${Math.max(0, 1 - impactAge * 2)})`;
      ctx.lineWidth = 12 * Math.max(0, 1 - impactAge * 2);
      ctx.beginPath();
      ctx.arc(0, -10, blastRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Splinters / computer chips flying
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const dist = impactAge * (200 + (i % 5) * 40);
        ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#22c55e';
        ctx.fillRect(Math.cos(ang) * dist, Math.sin(ang) * dist * 0.5 - 20, 8, 8);
      }
    }
    ctx.restore();

    // Large STAMP banner: MOTION DENIED / LIQUIDATE
    if (age > 0.25) {
      ctx.save();
      ctx.translate(480, 210);
      ctx.rotate(-0.06);
      const stampAlpha = Math.min(1, (age - 0.25) * 4);
      ctx.strokeStyle = `rgba(239, 68, 68, ${stampAlpha})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(-240, -45, 480, 90);
      ctx.fillStyle = `rgba(239, 68, 68, ${stampAlpha})`;
      ctx.font = '900 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MOTION DENIED · AUCTION', 0, 10);
      ctx.font = '700 16px monospace';
      ctx.fillText('SCRAP METAL LIQUIDATION IMMINENT', 0, 32);
      ctx.restore();
    }
  }

  function drawEscapeBanner(ctx: CanvasRenderingContext2D, payout: number | null) {
    ctx.save();
    ctx.translate(480, 210);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = COLOURS.cashedOut;
    ctx.lineWidth = 4;
    ctx.fillRect(-260, -50, 520, 100);
    ctx.strokeRect(-260, -50, 520, 100);

    ctx.fillStyle = COLOURS.cashedOut;
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOBBY TURNSTILE BREACHED!', 0, -10);

    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText(`CEO Sprinted Away With ${payout !== null ? credits(payout) : 'Full Seed Runway'}`, 0, 24);
    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Audio triggers
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('door', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('gasp', 0.8);
      }
      // Camera flashes from press pool
      if (view.elapsed - lastShutterTime > 1100 - tension * 800) {
        lastShutterTime = view.elapsed;
        audio.fx('camera', 0.35 + tension * 0.45);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.5) ** 2 : 0;

    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // Draw courtroom environment
    drawChamber(ctx, view.elapsed, tension);

    // Draw the panicked founder clutching melted server rack
    drawFounder(ctx, view, tension, age);

    // If crashed, slam giant gavel down
    if (crashed) {
      drawGavelSmash(ctx, age);
    }

    // Cashout win overlay
    if (view.cashoutX100 !== null) {
      drawEscapeBanner(ctx, view.payout);
    }

    // Top Header & Title
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.fillText('NO AI BAILOUT', 480, 52);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('CONGRESSIONAL COMMITTEE ON RUNWAY EXHAUSTION', 480, 78);

    // Giant Multiplier Readout
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.accent);
    ctx.fillStyle = multColor;
    ctx.font = '900 84px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 162);

    // Milestone ticker / hearing narration
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const caption = activeMilestone?.[1] ?? (crashed ? 'HEARING ADJOURNED · HARD DRIVES CONFISCATED' : 'WITNESS SWORN IN');
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(caption, 480, 488);

    // Footer Stake Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 518);

    ctx.restore();
  }

  return { draw };
}
