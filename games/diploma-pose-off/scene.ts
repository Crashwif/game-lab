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
  bgTop: '#0d1326',
  bgBottom: '#1e1b4b',
  curtain: '#831843',
  curtainDark: '#500724',
  stageWood: '#92400e',
  stageTrim: '#78350f',
  tubaBrass: '#f59e0b',
  tubaShadow: '#b45309',
  gownGrad: '#4338ca',
  gownDean: '#065f46',
  gold: '#fbbf24',
  parchment: '#fef3c7',
  text: '#f8fafc',
  muted: '#cbd5e1',
  accent: '#38bdf8',
  crashed: '#ef4444',
  cashedOut: '#4ade80',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Graduate pulls a quick peace-sign flex'],
  [150, 'Dean matches the dab with formal poise'],
  [200, 'Full sideways anime power pose unlocked'],
  [250, 'Crowd holds up cardboard cutout heads'],
  [300, 'One-legged flamingo stance on the podium'],
  [500, 'Headmaster drops into a synchronized split'],
  [1000, 'Spotlight ignites theatrical glitter cannons'],
  [10000, 'Choreographed backflip over the faculty desk'],
  [100000, 'Hovering horizontal plank above front row'],
  [1000000, 'Commencement stage dissolves into viral rapture'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`Moonwalked safe at ${formatX(view.cashoutX100)} with degree intact!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Sousaphone wiped out the podium' : 'Audience seat reserved · no credits placed', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Plunged into the tuba · lost ${credits(view.stake)}`, COLOURS.crashed];
  }
  return [`Degree on the line · ${credits(view.stake)} riding`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'thud' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let flashTimer = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (running && milestone > prevMilestone) {
      flashTimer = now + 250;
      audio.milestone(milestone);
      audio.fx('camera', 0.8);
      if (milestone >= 4) audio.fx('cheer', 0.6);
    }
    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.9);
      audio.fx('kaching', 0.7);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('thud', prevPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.9);
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestone;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashAgeSec / 0.5) * Math.sin(crashAgeSec * 60) : 0;

    // --- Background & Auditorium ---
    ctx.save();
    ctx.translate(shake, shake * 0.5);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, 400);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Velvet Theatre Curtains
    ctx.fillStyle = COLOURS.curtain;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(120, 180, 0, 360);
    ctx.lineTo(0, 0);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(960, 0);
    ctx.quadraticCurveTo(840, 180, 960, 360);
    ctx.lineTo(960, 0);
    ctx.fill();

    // Stage Valance
    ctx.fillStyle = COLOURS.curtainDark;
    for (let c = 0; c < 12; c++) {
      ctx.beginPath();
      ctx.arc(40 + c * 80, 0, 48, 0, Math.PI);
      ctx.fill();
    }

    // Spotlights
    const spotAngle = Math.sin((view.elapsed + now * 0.3) / 800) * 0.15;
    ctx.save();
    ctx.translate(480, 0);
    ctx.rotate(spotAngle);
    const spotGrad = ctx.createRadialGradient(0, 0, 20, 0, 380, 260);
    spotGrad.addColorStop(0, 'rgba(255, 245, 200, 0.35)');
    spotGrad.addColorStop(0.8, 'rgba(255, 230, 150, 0.08)');
    spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(40, 0);
    ctx.lineTo(240, 480);
    ctx.lineTo(-240, 480);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Stage Platform
    ctx.fillStyle = COLOURS.stageWood;
    ctx.fillRect(80, 340, 800, 80);
    ctx.fillStyle = COLOURS.stageTrim;
    ctx.fillRect(60, 410, 840, 20);

    // University Crest Banner
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(380, 40, 200, 50);
    ctx.strokeStyle = COLOURS.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(380, 40, 200, 50);
    ctx.fillStyle = COLOURS.gold;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRASHWIF COMMENCEMENT', 480, 70);

    // Cardboard Cutout Crowd at milestone >= 4
    if (milestone >= 4 || tension > 0.4) {
      for (let i = 0; i < 9; i++) {
        const cx = 140 + i * 85;
        const cy = 490 + Math.sin(now * 0.006 + i) * 6;
        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 14);
        ctx.lineTo(cx, cy + 38);
        ctx.stroke();
      }
    }

    // Brass Band Tuba / Sousaphone (Waiting at the right edge pit)
    const sousaX = 770;
    const sousaY = 430;
    ctx.save();
    ctx.fillStyle = COLOURS.tubaBrass;
    ctx.beginPath();
    ctx.ellipse(sousaX, sousaY, 44, 28, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.tubaShadow;
    ctx.beginPath();
    ctx.ellipse(sousaX + 4, sousaY, 32, 18, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glitter Cannons at high milestones
    if (milestone >= 7 && running) {
      for (let p = 0; p < 24; p++) {
        const seed = (now * 0.2 + p * 60) % 500;
        const px = 100 + (p * 37) % 760;
        const py = 120 + seed * 0.7;
        ctx.fillStyle = p % 2 === 0 ? COLOURS.gold : '#f43f5e';
        ctx.fillRect(px, py, 6, 6);
      }
    }

    // --- Character Animation ---
    const bob = running ? Math.sin(view.elapsed * (0.005 + tension * 0.008)) * (8 + tension * 12) : 0;
    const poseStep = Math.min(6, milestone);

    if (crashed) {
      // CRASH STATE: Tumbled headfirst into the sousaphone!
      const fallAge = Math.min(1, crashAgeSec / 0.4);
      const gradCrashX = 480 + (sousaX - 480) * fallAge;
      const gradCrashY = 320 + (sousaY - 320) * fallAge - (1 - fallAge) * 60;

      ctx.save();
      ctx.translate(gradCrashX, gradCrashY);
      ctx.rotate(Math.PI * 0.85);

      // Oversized Gown sticking out
      ctx.fillStyle = COLOURS.gownGrad;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.lineTo(32, 70);
      ctx.lineTo(-32, 70);
      ctx.closePath();
      ctx.fill();

      // Kicking Legs
      const kick = Math.sin(crashAgeSec * 22) * 15;
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-12, 70);
      ctx.lineTo(-20 + kick, 105);
      ctx.moveTo(12, 70);
      ctx.lineTo(20 - kick, 105);
      ctx.stroke();

      // Flung Mortarboard Cap
      ctx.restore();
      ctx.save();
      const capX = gradCrashX - 70 - crashAgeSec * 20;
      const capY = gradCrashY - 60 + crashAgeSec * 35;
      ctx.translate(capX, capY);
      ctx.rotate(crashAgeSec * 6);
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(22, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-22, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = COLOURS.gold;
      ctx.fillRect(10, 0, 12, 3);
      ctx.restore();

      // Comic Impact 'THUD!' cloud
      if (crashAgeSec < 1.2) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '900 36px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BWAAAMP!', sousaX, sousaY - 50);
      }
    } else {
      // STAGE POSES: Graduate & Dean
      const gradBaseX = cashed ? 480 + ((now - (prevCashout ?? now)) * 0.12) % 360 : 490;
      const gradBaseY = 330 + bob;

      // Dean on Left
      const deanX = 350;
      const deanY = 340 + (running ? Math.cos(view.elapsed * 0.006) * 5 : 0);

      // Draw Dean
      ctx.save();
      ctx.translate(deanX, deanY);
      ctx.fillStyle = COLOURS.gownDean;
      if (poseStep >= 5) {
        // Dean in synchronized split!
        ctx.beginPath();
        ctx.moveTo(-18, -40);
        ctx.lineTo(18, -40);
        ctx.lineTo(55, 10);
        ctx.lineTo(-55, 10);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-16, -45);
        ctx.lineTo(16, -45);
        ctx.lineTo(24, 0);
        ctx.lineTo(-24, 0);
        ctx.closePath();
        ctx.fill();
      }
      // Dean Head & Beard
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -60, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -56, 11, 0, Math.PI);
      ctx.fill();
      // Dean Cap
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-16, -76, 32, 6);
      ctx.restore();

      // Draw Graduate (Protagonist)
      ctx.save();
      ctx.translate(gradBaseX, gradBaseY);

      let gradRot = 0;
      if (poseStep === 2) gradRot = -0.15; // anime flex tilt
      if (poseStep === 4) gradRot = 0.22; // flamingo slant
      if (poseStep >= 6) gradRot = Math.sin(now * 0.01) * 0.35; // acrobatic freeze
      ctx.rotate(gradRot);

      // Oversized Graduate Gown
      ctx.fillStyle = COLOURS.gownGrad;
      ctx.beginPath();
      ctx.moveTo(-20, -50);
      ctx.lineTo(20, -50);
      ctx.lineTo(34, 0);
      ctx.lineTo(-34, 0);
      ctx.closePath();
      ctx.fill();

      // Gold Trim
      ctx.strokeStyle = COLOURS.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -50);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Graduate Head & Smug Expression
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.arc(0, -68, 16, 0, Math.PI * 2);
      ctx.fill();

      // Smug Sunglasses
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-14, -73, 12, 7);
      ctx.fillRect(2, -73, 12, 7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2, -70);
      ctx.lineTo(2, -70);
      ctx.stroke();

      // Smug Grin
      ctx.strokeStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(2, -62, 7, 0.2, Math.PI * 0.85);
      ctx.stroke();

      // Mortarboard Cap & Swinging Tassel
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(0, -96);
      ctx.lineTo(32, -84);
      ctx.lineTo(0, -72);
      ctx.lineTo(-32, -84);
      ctx.closePath();
      ctx.fill();
      const tasselSwing = Math.sin(now * 0.008) * 12;
      ctx.strokeStyle = COLOURS.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -84);
      ctx.lineTo(24 + tasselSwing, -70);
      ctx.stroke();

      // Golden Scroll / Diploma
      ctx.fillStyle = COLOURS.parchment;
      ctx.fillRect(20, -45, 14, 30);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(18, -32, 18, 5); // Ribbon

      // Cashout Flower Bouquet
      if (cashed) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-24, -40, 10, 0, Math.PI * 2);
        ctx.arc(-34, -48, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-28, -32, 6, 24);
      }
      ctx.restore();
    }

    // Flash Overlay on milestone capture
    if (now < flashTimer) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, 0, 960, 540);
    }

    // --- HUD & MULTIPLIER DISPLAY ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText('DIPLOMA POSE OFF', 480, 126);

    // Multiplier Callout
    const punch = crashed ? (1 - clamp01((crashAgeSec - 0.1) / 0.3)) ** 2 : 0;
    const multColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.gold;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${76 * (1 + 0.22 * punch + depth * 0.1)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 206);

    // Dynamic Milestone Caption
    const currentMilestone = running ? MILESTONES[milestone - 1] : undefined;
    const bannerText = currentMilestone
      ? currentMilestone[1]
      : view.phase === 'crashed'
        ? 'STAGE DISASTER · BRASS BAND DESTROYED'
        : view.phase === 'betting'
          ? 'DON YOUR GOWN · COMMENCEMENT AWAITS'
          : 'HOLDING RIDICULOUS COMMENCEMENT POSES';

    ctx.fillStyle = running ? '#fef08a' : COLOURS.muted;
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 268);

    // Stake & Action Status Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 488);

    ctx.restore();
  }

  return { draw };
}
