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
  [120, 'Hinge lube oozes slightly from edge'],
  [150, "Livestream chat screams 'it will snap'"],
  [200, 'Hairline crease catches the studio lighting'],
  [250, 'Bending robot whines at high torque'],
  [300, 'OLED panel flickers magenta and lime green'],
  [500, 'Thermal camera shows hinge at 180°C'],
  [1000, 'Crease becomes a deep optical valley'],
  [10000, 'Sparks shoot out from flexible ribbon cable'],
  [100000, 'Top screen detached and flapping like a wing'],
  [1000000, 'Fold count hits 10,000 as reality bends'],
];

const COLOURS = {
  bg: '#080d16',
  bench: '#141c2c',
  benchTop: '#1b2438',
  clampBody: '#3a4454',
  clampAccent: '#00e5ff',
  hazardYellow: '#ffd600',
  hazardDark: '#212121',
  oledFrame: '#1a1f2c',
  oledScreen: '#101423',
  crease: '#00ffcc',
  crashed: '#ff3366',
  cashedOut: '#00ff88',
  text: '#f0f4fc',
  muted: '#7f93b5',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.28 * pop * pop)}px system-ui, -apple-system, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Cashed out at ${formatX(view.cashoutX100)} · Pristine screen listed!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Device snapped · spectating free' : 'Spectating live stress test', COLOURS.muted];
  }
  if (crashed) return [`Hinge shattered · lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Testing device · ${credits(view.stake)} at stake`, COLOURS.clampAccent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let foldCycleCount = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Folding oscillation: speed ramps up with elapsed and tension
    const foldFreq = 0.0035 + 0.009 * tension + 0.004 * depth;
    const foldPhase = view.elapsed * foldFreq;
    const currentFoldCycle = Math.floor(foldPhase / Math.PI);

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('camera', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('siren', 0.5 + 0.4 * tension);
      }
      if (currentFoldCycle > foldCycleCount && !cashed) {
        audio.fx(tension > 0.45 ? 'creak' : 'squeak', 0.4 + 0.5 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;
    foldCycleCount = currentFoldCycle;

    // Crash shake & settling
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.5) ** 2 : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);
    ctx.translate(shake * Math.sin(age * 80), shake * Math.sin(age * 63));

    // Studio Test Lab Background
    ctx.save();
    const labGrad = ctx.createLinearGradient(0, 0, 0, 540);
    labGrad.addColorStop(0, '#0c1322');
    labGrad.addColorStop(0.65, '#080d17');
    labGrad.addColorStop(1, '#05070c');
    ctx.fillStyle = labGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Bench Surface
    ctx.fillStyle = COLOURS.bench;
    ctx.fillRect(0, 370, 960, 170);
    ctx.fillStyle = COLOURS.benchTop;
    ctx.fillRect(0, 365, 960, 10);

    // Grid lines on bench
    ctx.strokeStyle = '#27344e';
    ctx.lineWidth = 1;
    for (let x = 40; x < 960; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 375);
      ctx.lineTo(x + (x - 480) * 0.4, 540);
      ctx.stroke();
    }
    ctx.restore();

    // Stream HUD Header
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(24, 18, 260, 36);
    ctx.fillStyle = '#ff2a2a';
    ctx.beginPath();
    ctx.arc(42, 36, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE STRESS LAB · FOLD-CAM', 56, 40);

    const viewers = 14200 + Math.floor(view.currentX100 * 85);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`👁 ${viewers.toLocaleString()} VIEWERS`, 936, 38);
    ctx.fillText(`CYCLE: #${Math.floor(view.elapsed / 90)}`, 936, 56);
    ctx.restore();

    // Test Bench Apparatus & Hydraulic Arm
    const hingeX = 480;
    const hingeY = 320;

    // Phone hinge angle calculations
    let foldAngle = 0; // 0 = flat, Math.PI = completely folded
    if (cashed) {
      foldAngle = 0; // holds flat & pristine
    } else if (crashed) {
      foldAngle = -0.55; // snapped backwards!
    } else if (running) {
      foldAngle = (0.5 + 0.5 * Math.sin(foldPhase)) * (Math.PI * 0.85);
    } else {
      foldAngle = 0.2 + 0.1 * Math.sin(now * 0.003);
    }

    const wingW = 100;
    const wingH = 150;

    // Draw Heavy Bench Mount & Hazard Decals
    ctx.save();
    ctx.fillStyle = '#1c2432';
    ctx.fillRect(hingeX - 160, hingeY + 45, 320, 25);
    // Hazard Stripes
    ctx.save();
    ctx.beginPath();
    ctx.rect(hingeX - 160, hingeY + 45, 320, 10);
    ctx.clip();
    for (let hx = hingeX - 180; hx < hingeX + 180; hx += 20) {
      ctx.fillStyle = COLOURS.hazardYellow;
      ctx.fillRect(hx, hingeY + 45, 10, 10);
      ctx.fillStyle = COLOURS.hazardDark;
      ctx.fillRect(hx + 10, hingeY + 45, 10, 10);
    }
    ctx.restore();

    // Robot Hydraulic Base on Right
    const armPivotX = 720;
    const armPivotY = 270;
    ctx.fillStyle = COLOURS.clampBody;
    ctx.fillRect(armPivotX - 20, armPivotY - 50, 45, 120);
    ctx.strokeStyle = '#5a6679';
    ctx.lineWidth = 4;
    ctx.strokeRect(armPivotX - 20, armPivotY - 50, 45, 120);

    // Left Wing (Fixed on Clamp)
    ctx.save();
    ctx.translate(hingeX, hingeY);
    ctx.fillStyle = COLOURS.oledFrame;
    ctx.beginPath();
    ctx.roundRect(-wingW, -wingH / 2, wingW, wingH, [8, 0, 0, 8]);
    ctx.fill();
    ctx.strokeStyle = '#4f5d75';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Left Screen
    const screenGradL = ctx.createLinearGradient(-wingW, -wingH / 2, 0, wingH / 2);
    screenGradL.addColorStop(0, '#001a33');
    screenGradL.addColorStop(1, '#004080');
    ctx.fillStyle = screenGradL;
    ctx.fillRect(-wingW + 6, -wingH / 2 + 6, wingW - 6, wingH - 12);

    // Left Clamp Claw
    ctx.fillStyle = '#5c697e';
    ctx.fillRect(-wingW - 14, -28, 20, 56);
    ctx.fillStyle = '#8898b0';
    ctx.fillRect(-wingW - 6, -20, 12, 40);
    ctx.restore();

    // Right Wing (Actuated & Folding)
    ctx.save();
    ctx.translate(hingeX, hingeY);
    ctx.rotate(foldAngle);

    // Right Panel
    ctx.fillStyle = COLOURS.oledFrame;
    ctx.beginPath();
    ctx.roundRect(0, -wingH / 2, wingW, wingH, [0, 8, 8, 0]);
    ctx.fill();
    ctx.strokeStyle = '#4f5d75';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Right Screen
    const screenGradR = ctx.createLinearGradient(0, -wingH / 2, wingW, wingH / 2);
    screenGradR.addColorStop(0, '#00264d');
    screenGradR.addColorStop(1, '#0059b3');
    ctx.fillStyle = screenGradR;
    ctx.fillRect(0, -wingH / 2 + 6, wingW - 6, wingH - 12);

    // Right Claw attachment point
    const clawTipX = wingW - 6;
    const clawTipY = 0;
    ctx.fillStyle = '#5c697e';
    ctx.fillRect(clawTipX - 4, clawTipY - 24, 18, 48);

    // Screen glitch lines under tension
    if (running && tension > 0.35) {
      const glitches = Math.floor(tension * 6);
      for (let g = 0; g < glitches; g++) {
        const gy = -wingH / 2 + 10 + ((now * 0.13 + g * 37) % (wingH - 20));
        ctx.fillStyle = g % 2 === 0 ? '#39ff14' : '#ff007f';
        ctx.fillRect(0, gy, wingW - 6, 2);
      }
    }
    ctx.restore();

    // Hydraulic Piston Connecting Right Clamp to Main Arm
    const rightPanelTipWorldX = hingeX + Math.cos(foldAngle) * wingW;
    const rightPanelTipWorldY = hingeY + Math.sin(foldAngle) * wingW;
    ctx.save();
    ctx.strokeStyle = '#7c8ca3';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(armPivotX, armPivotY);
    ctx.lineTo(rightPanelTipWorldX, rightPanelTipWorldY);
    ctx.stroke();

    // Inner chrome cylinder
    ctx.strokeStyle = '#dce4f0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(armPivotX - 30, armPivotY);
    ctx.lineTo(rightPanelTipWorldX, rightPanelTipWorldY);
    ctx.stroke();
    ctx.restore();

    // Hinge Spine & Micro-crease rendering
    ctx.save();
    ctx.translate(hingeX, hingeY);
    // Hinge metallic barrel
    ctx.fillStyle = '#222b3d';
    ctx.fillRect(-6, -wingH / 2 - 2, 12, wingH + 4);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-6, -wingH / 2 - 2, 12, wingH + 4);

    // Crease thermal glow & fissure
    if (running || crashed) {
      const creaseIntensity = crashed ? 1 : tension;
      ctx.strokeStyle = crashed ? COLOURS.crashed : `rgba(0, 255, 204, ${0.4 + 0.6 * creaseIntensity})`;
      ctx.lineWidth = 2 + 5 * creaseIntensity;
      ctx.beginPath();
      ctx.moveTo(0, -wingH / 2 + 4);
      ctx.lineTo(0, wingH / 2 - 4);
      ctx.stroke();

      // Thermal warning heat ripples at hinge
      if (creaseIntensity > 0.5) {
        ctx.fillStyle = `rgba(255, 80, 0, ${0.2 + 0.25 * Math.sin(now * 0.02)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16 + 20 * creaseIntensity, wingH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Crashed Aftermath: Spikes, Sparks & Dead OLED
    if (crashed) {
      ctx.save();
      ctx.translate(hingeX, hingeY);
      // Shattered hinge jagged shards
      ctx.fillStyle = '#ff1744';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const sx = Math.sin(i * 1.2 + age) * 45;
        const sy = (i - 3) * 22;
        ctx.beginPath();
        ctx.moveTo(-10, sy);
        ctx.lineTo(sx, sy + 8);
        ctx.lineTo(-4, sy + 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Spark particles
      for (let s = 0; s < 12; s++) {
        const sparkAge = (age * 12 + s) % 1;
        const sDist = sparkAge * 110;
        const sAngle = (s * 2.1) + age;
        ctx.fillStyle = s % 2 === 0 ? '#ffff00' : '#00ffff';
        ctx.beginPath();
        ctx.arc(Math.cos(sAngle) * sDist, Math.sin(sAngle) * sDist, 2.5 * (1 - sparkAge), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Cashout Polish Celebration
    if (cashed) {
      ctx.save();
      ctx.translate(hingeX + 30, hingeY - 30);
      // Buffing microfiber cloth in mechanical clamp
      const wipeX = Math.sin(now * 0.008) * 40;
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.roundRect(wipeX - 25, -20, 50, 40, 8);
      ctx.fill();
      ctx.strokeStyle = '#fff8e1';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sparkles of cleanliness
      for (let sp = 0; sp < 4; sp++) {
        const sx = wipeX + (sp - 1.5) * 24;
        const sy = -35 + Math.sin(now * 0.01 + sp) * 12;
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 16px system-ui';
        ctx.fillText('✦', sx, sy);
      }
      ctx.restore();
    }

    // Centered HUD Multiplier & Status
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline Header
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 38px system-ui, sans-serif';
    ctx.fillText('CREASE TEST', 480, 80);

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('FOLD THE GLASS UNTIL THE HINGE SCREAMS FOR MERCY', 480, 114);

    // Multiplier Display
    const multTint = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.clampAccent;
    ctx.fillStyle = multTint;
    ctx.font = `800 ${88 * (1 + 0.18 * (crashed ? clamp01(1 - age / 0.3) : 0))}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 185);

    // Milestone / Action Caption
    const currentMilestone = MILESTONES[milestone - 1];
    let captionText = 'Awaiting next stress run...';
    if (running) {
      captionText = currentMilestone ? currentMilestone[1] : 'Robot clamp cycling open & shut';
    } else if (crashed) {
      captionText = 'SNAP! Glass shattered into dead OLED shards';
    } else if (view.phase === 'betting') {
      captionText = 'Inspect device & set stake';
    }

    ctx.fillStyle = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.text;
    ctx.font = popFont(600, 22, pop(currentMilestone?.[0] ?? 100));
    ctx.fillText(captionText, 480, 460);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = popFont(600, 19, cashed ? pop(view.cashoutX100 ?? 100) : 0);
    ctx.fillText(line, 480, 498);

    ctx.restore();
  }

  return { draw };
}
