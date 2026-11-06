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
  skyDark: '#080d1d',
  skyGlow: '#1a103c',
  railBed: '#111827',
  railSteel: '#93c5fd',
  trainYellow: '#ffd000',
  trainBlue: '#003da5',
  trainWindow: '#1e293b',
  laserCyan: '#06b6d4',
  laserBlue: '#3b82f6',
  sparkPurple: '#c084fc',
  crashed: '#ef4444',
  cashedOut: '#10b981',
  text: '#f8fafc',
  muted: '#94a3b8',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Departure bell chimes as yellow nose clears depot'],
  [150, 'Roof scanner domes light up with blue laser grid'],
  [200, 'Speedometer hits 168 mph alongside regular trains'],
  [250, 'Commuters on platform snap blurry good-luck pics'],
  [300, 'Pantograph draws bright purple electrical arcs'],
  [500, 'Laser measures rail gap down to human hair width'],
  [1000, 'Ghost schedule triggers station dispatch panic'],
  [10000, 'Sonic boom ripples through Mount Fuji background'],
  [100000, 'Quantum rail calibration warps track into light'],
  [1000000, 'Doctor Yellow enters timeless bullet perfection'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const popFont = (weight: number, size: number, pop: number) => `${weight} ${size * (1 + 0.28 * pop * pop)}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Track signed off at ${formatX(view.cashoutX100)} · Inspection complete!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Emergency brake triggered · zero credits lost' : 'Spectating Doctor Yellow · no credits riding', COLOURS.muted];
  }
  if (crashed) return [`Sensors blew at ${formatX(view.currentX100)} · ${credits(view.stake)} lost`, COLOURS.crashed];
  return [`High-speed scan running · ${credits(view.stake)} riding`, COLOURS.trainYellow];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSparkTime = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('bell', 0.9);
      audio.fx('cheer', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestoneCount > previousMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('notify', 0.7);
      }
      if (now - lastSparkTime > 400 - tension * 250) {
        audio.fx('zap', 0.25 + 0.5 * tension);
        lastSparkTime = now;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneCount;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : (running ? Math.sin(view.elapsed * 0.05) * (1 + tension * 2) : 0);
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // 1. Sky & Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.skyDark);
    bgGrad.addColorStop(0.65, COLOURS.skyGlow);
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Mount Fuji in the background
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(120, 360);
    ctx.lineTo(260, 200);
    ctx.lineTo(320, 200);
    ctx.lineTo(460, 360);
    ctx.closePath();
    ctx.fill();
    // Fuji Snowcap
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(235, 230);
    ctx.lineTo(260, 200);
    ctx.lineTo(320, 200);
    ctx.lineTo(345, 230);
    ctx.lineTo(325, 240);
    ctx.lineTo(310, 232);
    ctx.lineTo(290, 242);
    ctx.lineTo(270, 233);
    ctx.closePath();
    ctx.fill();

    // Tokyo Skyline Silhouette
    const speed = running ? (250 + tension * 600) : (crashed ? 0 : 60);
    const offset = (view.elapsed * 0.001 * speed) % 960;
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 18; i++) {
      const bx = ((i * 65 - offset * 0.2) % 1040 + 1040) % 1040 - 40;
      const bh = 70 + ((i * 47) % 110);
      ctx.fillRect(bx, 360 - bh, 50, bh);
      // Windows
      ctx.fillStyle = (i % 2 === 0) ? '#fef08a' : '#38bdf8';
      ctx.globalAlpha = 0.25 + 0.3 * Math.sin(now * 0.003 + i);
      ctx.fillRect(bx + 12, 360 - bh + 20, 8, 8);
      ctx.fillRect(bx + 28, 360 - bh + 45, 8, 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0f172a';
    }

    // Elevated viaduct / track bed
    ctx.fillStyle = COLOURS.railBed;
    ctx.fillRect(0, 370, 960, 170);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 370, 960, 10);

    // Fast scrolling sleepers & steel rails
    const railOffset = (view.elapsed * 0.001 * speed * 2) % 80;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    for (let rx = -railOffset; rx < 960; rx += 40) {
      ctx.beginPath();
      ctx.moveTo(rx, 380);
      ctx.lineTo(rx - 15, 430);
      ctx.stroke();
    }
    // High-speed twin rails
    ctx.fillStyle = COLOURS.railSteel;
    ctx.fillRect(0, 395, 960, 6);
    ctx.fillRect(0, 420, 960, 8);
    // Rail neon reflection under tension
    ctx.fillStyle = COLOURS.laserCyan;
    ctx.globalAlpha = 0.35 + 0.45 * tension;
    ctx.fillRect(0, 397, 960, 2);
    ctx.fillRect(0, 422, 960, 3);
    ctx.globalAlpha = 1;

    // Overhead catenary gantries rushing by
    const gantryOffset = (view.elapsed * 0.001 * speed * 1.5) % 360;
    for (let gx = 960 - gantryOffset; gx > -60; gx -= 360) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(gx, 150);
      ctx.lineTo(gx, 370);
      ctx.moveTo(gx - 20, 150);
      ctx.lineTo(gx + 20, 150);
      ctx.stroke();
    }
    // Overhead power line
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 150);
    ctx.lineTo(960, 150);
    ctx.stroke();

    // 2. Doctor Yellow Bullet Train (Shinkansen Class 923)
    const trainX = 140;
    const trainY = 320;
    const trainLen = 480;
    const trainH = 75;

    // Pantograph & electrical arcs
    const pantoX = trainX + 120;
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pantoX, trainY);
    ctx.lineTo(pantoX + 10, trainY - 35);
    ctx.lineTo(pantoX + 35, trainY - 35);
    ctx.lineTo(pantoX + 45, 150);
    ctx.stroke();

    if (running || (crashed && crashAgeSec < 0.8)) {
      // Pantograph purple electric sparks
      const sparkGlow = ctx.createRadialGradient(pantoX + 45, 150, 2, pantoX + 45, 150, 32 + tension * 28);
      sparkGlow.addColorStop(0, '#ffffff');
      sparkGlow.addColorStop(0.3, COLOURS.sparkPurple);
      sparkGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sparkGlow;
      ctx.beginPath();
      ctx.arc(pantoX + 45, 150, 32 + tension * 28, 0, Math.PI * 2);
      ctx.fill();

      // Sharp spark bolts
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2;
      for (let s = 0; s < 4; s++) {
        ctx.beginPath();
        ctx.moveTo(pantoX + 45, 150);
        ctx.lineTo(pantoX + 45 + (Math.random() - 0.5) * 40, 150 + (Math.random() - 0.5) * 30);
        ctx.stroke();
      }
    }

    // Train Body Gradient
    const trainGrad = ctx.createLinearGradient(trainX, trainY, trainX, trainY + trainH);
    trainGrad.addColorStop(0, '#fef08a');
    trainGrad.addColorStop(0.2, COLOURS.trainYellow);
    trainGrad.addColorStop(0.85, '#eab308');
    trainGrad.addColorStop(1, '#ca8a04');

    ctx.save();
    if (crashed) {
      // Derailed tilt & bounce
      const rot = Math.min(0.22, crashAgeSec * 0.35);
      ctx.translate(trainX + trainLen * 0.5, trainY + trainH);
      ctx.rotate(-rot);
      ctx.translate(-(trainX + trainLen * 0.5), -(trainY + trainH));
    }

    // Main fuselage: sleek nose front right
    ctx.fillStyle = trainGrad;
    ctx.beginPath();
    ctx.moveTo(trainX, trainY + trainH); // Rear bottom
    ctx.lineTo(trainX, trainY + 12);     // Rear top
    ctx.lineTo(trainX + trainLen - 90, trainY + 10); // Roof straight
    // Aerodynamic nose slope
    ctx.bezierCurveTo(trainX + trainLen - 40, trainY + 10, trainX + trainLen, trainY + 35, trainX + trainLen + 50, trainY + trainH - 12);
    ctx.lineTo(trainX + trainLen + 30, trainY + trainH); // Nose tip bottom
    ctx.closePath();
    ctx.fill();

    // Iconic Blue Stripe
    ctx.fillStyle = COLOURS.trainBlue;
    ctx.beginPath();
    ctx.rect(trainX, trainY + 44, trainLen - 50, 12);
    ctx.fill();
    // Stripe curve to nose
    ctx.beginPath();
    ctx.moveTo(trainX + trainLen - 50, trainY + 44);
    ctx.quadraticCurveTo(trainX + trainLen - 10, trainY + 46, trainX + trainLen + 30, trainY + 58);
    ctx.lineTo(trainX + trainLen + 20, trainY + 68);
    ctx.quadraticCurveTo(trainX + trainLen - 15, trainY + 56, trainX + trainLen - 50, trainY + 56);
    ctx.closePath();
    ctx.fill();

    // Diagnostic Scanner Domes on roof
    const dome1X = trainX + 220;
    const dome2X = trainX + 340;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(dome1X, trainY + 10, 12, Math.PI, 0);
    ctx.arc(dome2X, trainY + 10, 12, Math.PI, 0);
    ctx.fill();

    // Train Windows
    ctx.fillStyle = COLOURS.trainWindow;
    for (let w = 0; w < 6; w++) {
      ctx.fillRect(trainX + 30 + w * 50, trainY + 22, 28, 14);
    }
    // Cockpit windscreen
    ctx.beginPath();
    ctx.moveTo(trainX + trainLen - 70, trainY + 18);
    ctx.lineTo(trainX + trainLen - 15, trainY + 32);
    ctx.lineTo(trainX + trainLen - 25, trainY + 42);
    ctx.lineTo(trainX + trainLen - 75, trainY + 32);
    ctx.closePath();
    ctx.fill();

    // Nose Headlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(trainX + trainLen + 32, trainY + 56, 7, 0, Math.PI * 2);
    ctx.fill();

    // Wheels / Bogies
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(trainX + 30, trainY + trainH - 4, 80, 14);
    ctx.fillRect(trainX + trainLen - 120, trainY + trainH - 4, 80, 14);

    // 3. Laser Grid & Diagnostic Sensor Beams
    if (running && !crashed) {
      // Twin scanner lasers from roof domes slicing rails
      const laserPulse = 0.7 + 0.3 * Math.sin(now * 0.02);
      ctx.lineWidth = 2 + tension * 3;
      ctx.strokeStyle = `rgba(6, 182, 212, ${laserPulse})`;
      for (const dx of [dome1X, dome2X]) {
        ctx.beginPath();
        ctx.moveTo(dx, trainY + 4);
        ctx.lineTo(dx + 90, 420);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx, trainY + 4);
        ctx.lineTo(dx - 40, 420);
        ctx.stroke();
      }

      // High-power forward track inspection beam
      const beamGrad = ctx.createLinearGradient(trainX + trainLen + 30, trainY + 56, 960, 420);
      beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
      beamGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.4)');
      beamGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(trainX + trainLen + 32, trainY + 56);
      ctx.lineTo(960, 390);
      ctx.lineTo(960, 440);
      ctx.closePath();
      ctx.fill();

      // Laser measurement grid dots on rail
      const dotSpacing = 28 - tension * 12;
      ctx.fillStyle = '#67e8f9';
      for (let dotX = trainX + 80; dotX < 920; dotX += dotSpacing) {
        ctx.beginPath();
        ctx.arc(dotX, 420, 2 + tension * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 4. Commuter Platform Flash Photos (Viral Concept detail)
    if (running && Math.random() < 0.08 + tension * 0.12) {
      const flashX = 40 + Math.random() * 880;
      const flashY = 240 + Math.random() * 80;
      const fGlow = ctx.createRadialGradient(flashX, flashY, 1, flashX, flashY, 26);
      fGlow.addColorStop(0, '#ffffff');
      fGlow.addColorStop(0.4, '#38bdf8');
      fGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = fGlow;
      ctx.beginPath();
      ctx.arc(flashX, flashY, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Crashed Visuals: Giant Sensor Short-Circuit & Sparks
    if (crashed) {
      const burstProgress = clamp01(crashAgeSec / 0.7);
      const bRad = burstProgress * 220;
      const burstGrad = ctx.createRadialGradient(trainX + trainLen, trainY + 40, 5, trainX + trainLen, trainY + 40, bRad);
      burstGrad.addColorStop(0, '#ffffff');
      burstGrad.addColorStop(0.3, '#f87171');
      burstGrad.addColorStop(0.7, '#ef4444');
      burstGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = burstGrad;
      ctx.globalAlpha = 1 - burstProgress;
      ctx.beginPath();
      ctx.arc(trainX + trainLen, trainY + 40, bRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Flying neon bolts and debris
      ctx.fillStyle = '#fef08a';
      for (let p = 0; p < 16; p++) {
        const pAngle = (p * Math.PI) / 8 + crashAgeSec * 2;
        const pDist = 60 + crashAgeSec * 280 * (0.8 + 0.4 * (p % 3));
        const px = trainX + trainLen + Math.cos(pAngle) * pDist;
        const py = trainY + 40 + Math.sin(pAngle) * pDist;
        ctx.fillRect(px, py, 6, 6);
      }
    }

    // 6. Cashed Out Visuals: Maintenance Bay Clear & Lucky Wave
    if (view.cashoutX100 !== null) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.fillRect(0, 0, 960, 540);
      // Clean Track Pass Stamp
      ctx.save();
      ctx.translate(760, 260);
      ctx.rotate(-0.12);
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 4;
      ctx.strokeRect(-120, -32, 240, 64);
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TRACK STATUS: PASS', 0, 0);
      ctx.restore();
    }

    // 7. HUD & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Tagline
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText('DOCTOR YELLOW RUSH', 480, 48, 860);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('HIGH-SPEED TRACK INSPECTION · 0 PASSENGERS · HAIRLINE PRECISION', 480, 80, 860);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.trainYellow);
    ctx.fillStyle = multColor;
    const multScale = running ? 1 + 0.15 * tension : (crashed ? 1.05 : 1.0);
    ctx.font = `800 ${Math.round(86 * multScale)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 168, 860);

    // Story Milestone / Status Banner
    const currentMilestone = running ? MILESTONES[milestoneCount - 1] : undefined;
    const caption = currentMilestone?.[1] ?? (crashed ? 'SENSOR OVERLOAD · DERAILEMENT AVOIDED BY EMERGENCY BRAKES' : (view.cashoutX100 !== null ? 'SCHEDULE SIGNED OFF · DEPOT RETURN COMPLETE' : 'INSPECTION SHINKANSEN READY FOR DISPATCH'));
    ctx.fillStyle = running ? '#38bdf8' : COLOURS.muted;
    ctx.font = popFont(600, 20, pop(currentMilestone?.[0] ?? 100));
    ctx.fillText(caption, 480, 230, 880);

    // Stake / Player Line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = popFont(600, 24, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(line, 480, 500, 880);

    ctx.restore();
  }

  return { draw };
}
