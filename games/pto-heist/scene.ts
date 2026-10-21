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
  [120, 'Slight throat clearing over company VoIP line'],
  [150, 'Cough recorded into Slack audio note for proof'],
  [200, 'Out-of-office autoreply engaged nationwide'],
  [250, 'Midnight digital download bar reaches 99%'],
  [300, 'Whole department goes silent on Microsoft Teams'],
  [500, 'VP of Sales caught cruising neon Vice City strips'],
  [1000, 'GDP drops 2% as 1.5M "flu cases" pop up'],
  [10000, 'Federal Reserve calls emergency monetary meeting'],
  [100000, 'US stock exchange replaced by digital strip club'],
  [1000000, 'Nationwide sick day becomes official state holiday'],
];

const COLOURS = {
  bgOffice: '#16192b',
  bgSynth: '#09031a',
  neonPink: '#ff2d95',
  neonCyan: '#00f6ff',
  neonYellow: '#ffe600',
  redAlert: '#ff3366',
  safeGreen: '#22e58b',
  text: '#ffffff',
  muted: '#8e9aaf',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Forged doctor note approved at ${formatX(view.cashoutX100)} · PTO SECURED!`, COLOURS.safeGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Inspection hit · no credits lost' : 'Lurking off-clock · 0 credits on line', COLOURS.muted];
  }
  if (crashed) return [`Busted on live webcam! Lost ${credits(view.stake)}`, COLOURS.redAlert];
  return [`Calling in fake sick with ${credits(view.stake)} at risk`, COLOURS.neonYellow];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastCoughTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('phone', 0.8);
      audio.fx('cheer', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('camera', 0.9);
      audio.fx('scream', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('notify', 0.75);
      }
      if (now - lastCoughTick > Math.max(320, 1100 - tension * 800) && !cashed) {
        lastCoughTick = now;
        audio.fx('whoosh', 0.25 + 0.35 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(crashAgeSec * 60), shake * Math.sin(crashAgeSec * 45));

    // 1. Dynamic Background: Drab Cubicle Office Morphing into Vice City Neon
    const synthGrad = ctx.createLinearGradient(0, 0, 0, 540);
    synthGrad.addColorStop(0, '#0a0319');
    synthGrad.addColorStop(0.55 - tension * 0.25, '#1e0836');
    synthGrad.addColorStop(0.8, '#ff1a75');
    synthGrad.addColorStop(1, '#ff8000');
    ctx.fillStyle = synthGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Neon synthwave horizon sun & palm trees
    const sunY = 260 + (1 - tension) * 40;
    const sunGrad = ctx.createRadialGradient(480, sunY, 10, 480, sunY, 110);
    sunGrad.addColorStop(0, '#fffb96');
    sunGrad.addColorStop(0.4, '#ff2d95');
    sunGrad.addColorStop(1, 'rgba(255, 45, 149, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(480, sunY, 110, 0, Math.PI * 2);
    ctx.fill();

    // Perspective synth grid floor
    ctx.save();
    ctx.strokeStyle = `rgba(0, 246, 255, ${0.15 + tension * 0.4})`;
    ctx.lineWidth = 1.5;
    const horizon = 320;
    const gridSpeed = (view.elapsed * (0.15 + tension * 0.6)) % 40;
    for (let y = horizon; y <= 540; y += 18 + (y - horizon) * 0.18) {
      const lineY = y + gridSpeed * ((y - horizon) / 220);
      if (lineY <= 540) {
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(960, lineY);
        ctx.stroke();
      }
    }
    for (let x = -200; x <= 1160; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 540);
      ctx.lineTo(480 + (x - 480) * 0.12, horizon);
      ctx.stroke();
    }
    ctx.restore();

    // Palm tree silhouettes
    ctx.fillStyle = 'rgba(15, 6, 32, 0.9)';
    for (const px of [80, 890]) {
      ctx.beginPath();
      ctx.moveTo(px - 14, 380);
      ctx.quadraticCurveTo(px + (px < 500 ? 25 : -25), 250, px + (px < 500 ? 40 : -40), 160);
      ctx.lineTo(px + (px < 500 ? 50 : -50), 160);
      ctx.quadraticCurveTo(px + (px < 500 ? 35 : -35), 250, px + 8, 380);
      ctx.fill();
      // Fronds
      for (let f = 0; f < 5; f++) {
        ctx.beginPath();
        const dir = (px < 500 ? 1 : -1);
        ctx.ellipse(px + dir * 45 + (f - 2) * 20, 160 + f * 4, 34, 9, (f - 2) * 0.35 * dir, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Stacked Pizza Boxes & Energy Drinks on the side
    ctx.fillStyle = '#c85a17';
    ctx.fillRect(150, 390, 80, 16);
    ctx.fillStyle = '#e67300';
    ctx.fillRect(145, 406, 90, 18);
    ctx.fillStyle = '#d2691e';
    ctx.fillRect(140, 424, 100, 20);
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillRect(250, 412, 16, 32); // Neon energy drink can

    // 2. Protagonist: Worker in Half-Suit + Boxer Shorts
    const bob = Math.sin(view.elapsed * 0.007) * (cashed ? 2 : 4 + tension * 8);
    const charX = 480;
    const charY = 320 + bob;

    // Chair
    ctx.fillStyle = '#1c1f2e';
    ctx.beginPath();
    ctx.roundRect(charX - 85, charY - 90, 170, 170, 20);
    ctx.fill();
    ctx.fillStyle = COLOURS.neonPink;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Bare hairy legs & fluffy slippers
    ctx.fillStyle = '#ffd1a4';
    ctx.fillRect(charX - 50, charY + 50, 26, 65);
    ctx.fillRect(charX + 24, charY + 50, 26, 65);
    // Slippers
    ctx.fillStyle = '#ff85b3';
    ctx.beginPath();
    ctx.arc(charX - 37, charY + 118, 18, 0, Math.PI, false);
    ctx.arc(charX + 37, charY + 118, 18, 0, Math.PI, false);
    ctx.fill();

    // Red Polka-dot Boxers!
    ctx.fillStyle = '#e62443';
    ctx.beginPath();
    ctx.roundRect(charX - 56, charY + 28, 112, 38, [0, 0, 8, 8]);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let dot = -42; dot <= 42; dot += 18) {
      ctx.beginPath();
      ctx.arc(charX + dot, charY + 44, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Professional Suit Jacket & Tie on Upper Half
    ctx.fillStyle = '#1f293d';
    ctx.fillRect(charX - 52, charY - 45, 104, 76);
    // White shirt collar V
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(charX - 22, charY - 45);
    ctx.lineTo(charX, charY - 10);
    ctx.lineTo(charX + 22, charY - 45);
    ctx.fill();
    // Crooked Necktie
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(charX - 6, charY - 26);
    ctx.lineTo(charX + 6, charY - 26);
    ctx.lineTo(charX + 12 + Math.sin(view.elapsed * 0.01) * 3, charY + 20);
    ctx.lineTo(charX, charY + 30);
    ctx.lineTo(charX - 10, charY + 20);
    ctx.closePath();
    ctx.fill();

    // Head & Face
    ctx.fillStyle = '#ffd1a4';
    ctx.beginPath();
    ctx.arc(charX, charY - 65, 34, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#3b2219';
    ctx.beginPath();
    ctx.arc(charX, charY - 80, 36, Math.PI, 0, false);
    ctx.fill();

    if (cashed) {
      // Cashed out escape: Chill sunglasses, smoking cigar / peace sign, doctor note
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(charX - 26, charY - 72, 52, 14);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(charX - 26, charY - 72, 52, 14);
      // Smug smile
      ctx.strokeStyle = '#8d3b1b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(charX, charY - 55, 14, 0.15, Math.PI - 0.15);
      ctx.stroke();

      // Forged doctor note in hand
      ctx.save();
      ctx.translate(charX + 80, charY - 20);
      ctx.rotate(0.2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-28, -40, 56, 75);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(-28, -40, 56, 75);
      ctx.fillStyle = '#dc2626';
      ctx.font = '700 9px monospace';
      ctx.fillText('Rx: REST', -20, -22);
      ctx.fillStyle = '#334155';
      ctx.font = '500 7px monospace';
      ctx.fillText('DIAGNOSIS:', -24, -8);
      ctx.fillText('Severe Boneitis', -24, 2);
      ctx.fillStyle = '#2563eb';
      ctx.font = 'italic 700 9px cursive';
      ctx.fillText('Dr. Nick MD', -18, 22);
      ctx.restore();
    } else if (crashed) {
      // Crashed: wide bulging eyes, dropped jaw, horror!
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(charX - 12, charY - 68, 11, 0, Math.PI * 2);
      ctx.arc(charX + 12, charY - 68, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(charX - 12, charY - 68, 4, 0, Math.PI * 2);
      ctx.arc(charX + 12, charY - 68, 4, 0, Math.PI * 2);
      ctx.fill();
      // Screaming O mouth
      ctx.fillStyle = '#2d0606';
      ctx.beginPath();
      ctx.ellipse(charX, charY - 46, 12, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Running / sweat mode
      // Eyes looking nervous sideways
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(charX - 12, charY - 68, 8, 0, Math.PI * 2);
      ctx.arc(charX + 12, charY - 68, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      const lookDir = Math.sin(view.elapsed * 0.005) > 0 ? 3 : -3;
      ctx.beginPath();
      ctx.arc(charX - 12 + lookDir, charY - 68, 4, 0, Math.PI * 2);
      ctx.arc(charX + 12 + lookDir, charY - 68, 4, 0, Math.PI * 2);
      ctx.fill();

      // Fake cough open grimace
      ctx.strokeStyle = '#8d3b1b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(charX, charY - 50, 8, 5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Profuse sweat droplets spraying off forehead
      ctx.fillStyle = COLOURS.neonCyan;
      for (let s = 0; s < 4; s++) {
        const swPhase = (view.elapsed * 0.006 + s * 1.5) % (Math.PI * 2);
        const dropX = charX + (s % 2 === 0 ? -38 : 38) + Math.cos(swPhase) * 12;
        const dropY = charY - 75 + Math.sin(swPhase) * 14;
        ctx.beginPath();
        ctx.arc(dropX, dropY, 2.5 + tension * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cough comic bubbles
      if (Math.sin(view.elapsed * 0.012) > 0.3) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = '700 13px system-ui';
        ctx.fillText('*HACK COUGH*', charX - 110, charY - 80);
      }
    }

    // Hands: Left holding retro telephone, Right holding glowing game controller
    // Retro phone handset
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(charX - 58, charY - 78, 16, 44, 8);
    ctx.fill();
    // Neon Controller in other hand
    const padGlow = cashed ? COLOURS.safeGreen : COLOURS.neonCyan;
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.roundRect(charX + 38, charY - 10, 48, 28, 8);
    ctx.fill();
    ctx.strokeStyle = padGlow;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Glowing gamepad buttons
    ctx.fillStyle = COLOURS.neonPink;
    ctx.fillRect(charX + 68, charY - 4, 5, 5);
    ctx.fillRect(charX + 75, charY + 2, 5, 5);

    // Productivity Crash Meter (Top Right)
    const prodPercent = Math.max(-99, Math.round(100 - tension * 199));
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.roundRect(710, 24, 230, 68, 8);
    ctx.fill();
    ctx.strokeStyle = prodPercent < 0 ? COLOURS.redAlert : COLOURS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('US NATIONAL PRODUCTIVITY', 722, 44);
    ctx.font = '800 24px ui-monospace, monospace';
    ctx.fillStyle = prodPercent < 0 ? COLOURS.redAlert : COLOURS.safeGreen;
    ctx.fillText(`${prodPercent}% SINKHOLE`, 722, 74);

    // Crashed SWAT HR Drywall Breach Overlay
    if (crashed) {
      // Giant Drywall Shatter Hole on the side
      ctx.fillStyle = '#dcd7c9';
      ctx.beginPath();
      ctx.moveTo(960, 220);
      ctx.lineTo(840, 280);
      ctx.lineTo(880, 360);
      ctx.lineTo(810, 430);
      ctx.lineTo(960, 480);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8a795d';
      ctx.lineWidth = 5;
      ctx.stroke();

      // SWAT HR Laser aiming right at boxer shorts
      const laserPulse = (Math.sin(crashAgeSec * 35) + 1) * 0.5;
      ctx.strokeStyle = `rgba(255, 0, 50, ${0.7 + laserPulse * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(850, 330);
      ctx.lineTo(charX, charY + 44);
      ctx.stroke();
      // Target red dot
      ctx.fillStyle = '#ff0033';
      ctx.beginPath();
      ctx.arc(charX, charY + 44, 6 + laserPulse * 3, 0, Math.PI * 2);
      ctx.fill();

      // Blinking webcam banner
      ctx.fillStyle = 'rgba(230, 0, 40, 0.92)';
      ctx.fillRect(200, 140, 560, 42);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '800 17px system-ui';
      ctx.fillText('🔴 WEBCAM LIVE · STREAMING TO ALL-HANDS (8,412 HR VIEWERS)', 480, 166);
    }

    // 3. HUD Display
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('PTO HEIST', 480, 42);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('THE $1 BILLION NATIONAL PRODUCTIVITY SINKHOLE', 480, 68);

    // Huge Multiplier Display
    const multiplierColor = crashed ? COLOURS.redAlert : cashed ? COLOURS.safeGreen : COLOURS.text;
    const multScale = running ? 1 + tension * 0.18 : 1;
    ctx.save();
    ctx.translate(480, 126);
    ctx.scale(multScale, multScale);
    ctx.fillStyle = multiplierColor;
    ctx.font = '900 64px ui-monospace, monospace';
    ctx.shadowColor = crashed ? COLOURS.redAlert : COLOURS.neonPink;
    ctx.shadowBlur = 16 + tension * 20;
    ctx.fillText(formatX(view.currentX100), 0, 0);
    ctx.restore();

    // Milestone ticker / phase prompt
    const passedMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const bannerText = passedMilestone ? passedMilestone[1] : (crashed ? 'BUSTED BY HR WELLNESS INSPECTION' : 'DIAL IN YOUR PHONIEST SICK-DAY RASP');
    ctx.fillStyle = crashed ? COLOURS.redAlert : COLOURS.neonYellow;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText(bannerText, 480, 468, 880);

    // Bottom Stake line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 508, 880);

    ctx.restore();
  }

  return { draw };
}
