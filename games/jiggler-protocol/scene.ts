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
  [120, 'Desk fan set to low oscillation setting'],
  [150, 'Laser mouse registers rhythmic mini-shakes'],
  [200, 'Slack status remains solid glowing active green'],
  [250, 'Contraption upgraded with wind-up penguin toy'],
  [300, 'Worker reclines into sofa with peaceful blanket'],
  [500, "Manager posts message asking 'anyone around?'"],
  [1000, "Auto-jiggler accidentally types 'jjjjjj' in chat"],
  [10000, 'Robot vacuum tangles in keyboard power cable'],
  [100000, 'Contraption achieves autonomous perpetual motion'],
  [1000000, 'Promoted to Senior Architect while fast asleep'],
];

const COLOURS = {
  bgGradTop: '#16192b',
  bgGradBot: '#0d0f1a',
  desk: '#2c1e19',
  deskRim: '#48332a',
  slackGreen: '#2bac76',
  slackAway: '#e0a83b',
  laserRed: '#ff2a4b',
  accent: '#7ce38b',
  crashed: '#ff6b6b',
  cashedOut: '#a8ffb2',
  text: '#f3f6fc',
  muted: '#8e9ab0',
  warmLamp: 'rgba(255, 214, 138, 0.12)',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Logged off at ${formatX(view.cashoutX100)} · Sent 'agree with above'`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Webcam tipped · Watching spectator' : 'Observing the nap contraption', COLOURS.muted];
  }
  if (crashed) return [`Webcam crashed! Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`${credits(view.stake)} riding on the nap`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'thud' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastJiggleTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    const crashSeconds = crashed ? Math.max(0, view.crashAge / 1000) : 0;

    // Audio triggers
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('thud', previousPhase === null || view.crashAge > 1200);
      audio.fx('camera', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('notify', 0.5);
      }
      const tickCycle = Math.floor(view.elapsed / 450);
      if (tickCycle > lastJiggleTick && !cashed) {
        audio.fx('tick', 0.25 + 0.35 * tension);
        lastJiggleTick = tickCycle;
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const shake = crashed ? 14 * clamp01(1 - crashSeconds / 0.6) ** 2 : (running ? Math.sin(view.elapsed * 0.04) * tension * 2.5 : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(crashSeconds * 60), shake * Math.cos(crashSeconds * 45));

    // Room Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgGradTop);
    bgGrad.addColorStop(1, COLOURS.bgGradBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Warm ambient lamp cone
    ctx.fillStyle = COLOURS.warmLamp;
    ctx.beginPath();
    ctx.moveTo(820, 40);
    ctx.lineTo(600, 460);
    ctx.lineTo(940, 460);
    ctx.closePath();
    ctx.fill();

    // Snoozing worker on couch in background
    ctx.fillStyle = '#222738';
    ctx.fillRect(60, 310, 210, 110); // sofa back
    ctx.fillStyle = '#31374f';
    ctx.fillRect(45, 360, 240, 60); // sofa cushion
    // Blanket & sleeping head
    ctx.fillStyle = '#8957e5';
    ctx.beginPath();
    ctx.arc(150, 375, 55, Math.PI, 0, false);
    ctx.fill();
    // Head & face
    ctx.fillStyle = '#ffcca3';
    ctx.beginPath();
    ctx.arc(105, 355, 18, 0, Math.PI * 2);
    ctx.fill();
    // Sleep mask
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(92, 348, 26, 10);
    // Zzz animations
    if (!crashed && !cashed) {
      const zPhase = (view.elapsed * 0.002) % 3;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '700 16px sans-serif';
      ctx.fillText('z', 115 + zPhase * 8, 330 - zPhase * 16);
      ctx.font = '700 22px sans-serif';
      ctx.fillText('Z', 125 + zPhase * 12, 315 - zPhase * 20);
    }

    // Desk Surface
    ctx.fillStyle = COLOURS.deskRim;
    ctx.fillRect(0, 400, 960, 140);
    ctx.fillStyle = COLOURS.desk;
    ctx.fillRect(0, 415, 960, 125);

    // Monitor showing Slack
    ctx.fillStyle = '#1a1d28';
    ctx.fillRect(360, 175, 240, 160);
    ctx.strokeStyle = '#343b53';
    ctx.lineWidth = 4;
    ctx.strokeRect(360, 175, 240, 160);
    // Monitor stand
    ctx.fillStyle = '#272c3d';
    ctx.fillRect(465, 335, 30, 70);
    ctx.fillRect(440, 400, 80, 12);
    // Slack UI inside screen
    ctx.fillStyle = '#222533';
    ctx.fillRect(364, 179, 55, 152); // sidebar
    ctx.fillStyle = '#2d3246';
    ctx.fillRect(423, 179, 173, 152); // chat pane
    // Status dot on screen
    const slackActive = running && !crashed;
    ctx.fillStyle = slackActive ? COLOURS.slackGreen : (crashed ? COLOURS.crashed : COLOURS.slackAway);
    ctx.beginPath();
    ctx.arc(385, 202, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 10px monospace';
    ctx.fillText('Online', 396, 205);

    // Chat fake lines & jjjjjj typed
    ctx.fillStyle = '#414763';
    ctx.fillRect(432, 220, 100, 6);
    ctx.fillRect(432, 235, 140, 6);
    if (view.currentX100 >= 1000 && !crashed) {
      ctx.fillStyle = '#ff7b72';
      ctx.font = '11px monospace';
      ctx.fillText('jjjjjjjjjj|', 432, 275);
    }

    // Contraption Assembly (Desk fan, crane, metronome, hanging mouse)
    const fanOsc = Math.sin(view.elapsed * 0.0035 * (1 + tension));
    const metronomeWobble = Math.sin(view.elapsed * 0.008 * (1 + tension * 1.5));
    const mouseWiggle = running ? Math.sin(view.elapsed * 0.015) * (6 + 8 * tension) : 0;

    // Metronome on desk (right)
    ctx.save();
    ctx.translate(680, 405);
    ctx.fillStyle = '#5c3a21';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.lineTo(10, -55);
    ctx.lineTo(-10, -55);
    ctx.closePath();
    ctx.fill();
    // Metronome pendulum arm
    ctx.strokeStyle = '#c4c8d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    const pendAngle = crashed ? 0.8 : metronomeWobble * 0.45;
    ctx.lineTo(Math.sin(pendAngle) * 45, -10 - Math.cos(pendAngle) * 45);
    ctx.stroke();
    ctx.restore();

    // Oscillating desk fan (left of monitor)
    ctx.save();
    ctx.translate(310, 370);
    ctx.fillStyle = '#3a3f55';
    ctx.fillRect(-12, 0, 24, 35); // base
    ctx.fillRect(-22, 30, 44, 8);
    // Fan head rotated by fanOsc
    ctx.translate(0, -5);
    ctx.rotate(crashed ? 0.9 : fanOsc * 0.28);
    ctx.strokeStyle = '#606b8c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -22, 25, 0, Math.PI * 2);
    ctx.stroke();
    // Blades spinning
    const bladeSpin = view.elapsed * 0.03 * (1 + tension * 2);
    ctx.fillStyle = '#8999be';
    for (let b = 0; b < 3; b++) {
      const ba = bladeSpin + (b * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(ba) * 14, -22 + Math.sin(ba) * 14, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Toy Crane / Dental Floss suspension rig
    const craneCollapse = crashed ? Math.min(65, crashSeconds * 180) : 0;
    ctx.save();
    ctx.translate(480, 260 + craneCollapse);
    ctx.rotate(crashed ? 0.45 * Math.min(1, crashSeconds * 3) : 0);
    // Crane tower & arm (yellow toy aesthetic)
    ctx.strokeStyle = '#e6ad12';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-40, 130);
    ctx.lineTo(-40, 0);
    ctx.lineTo(40, -20);
    ctx.stroke();

    // Floss string dangling from crane tip
    const flossX = 40;
    const flossY = -20;
    const hangingY = flossY + 110 + (crashed ? 40 : 0);
    const mx = flossX + (crashed ? 30 : mouseWiggle);
    const my = hangingY;

    ctx.strokeStyle = '#f3f6fc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(flossX, flossY);
    ctx.lineTo(mx, my - 14);
    ctx.stroke();

    // Optical Mouse Protagonist
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(crashed ? 1.6 : (mouseWiggle * 0.04));
    // Mouse body
    ctx.fillStyle = '#2e3440';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4c566a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Scroll wheel
    ctx.fillStyle = '#d8dee9';
    ctx.fillRect(-2.5, -14, 5, 10);
    // Optical red glow underneath
    const redIntensity = running ? 0.6 + 0.4 * Math.sin(view.elapsed * 0.02) : 0.2;
    ctx.fillStyle = COLOURS.laserRed;
    ctx.shadowColor = COLOURS.laserRed;
    ctx.shadowBlur = 12 * redIntensity;
    ctx.beginPath();
    ctx.arc(0, 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.restore();

    // Keyboard on desk underneath mouse
    ctx.fillStyle = '#1e222d';
    ctx.fillRect(460, 435, 120, 26);
    ctx.fillStyle = '#2e3547';
    for (let kx = 465; kx < 575; kx += 11) {
      ctx.fillRect(kx, 439, 8, 7);
      ctx.fillRect(kx, 449, 8, 7);
    }

    // Robot vacuum (milestone upgrade)
    if (view.currentX100 >= 250 || depth > 0.3) {
      const vacX = 180 + Math.sin(view.elapsed * 0.001) * 60;
      ctx.fillStyle = '#d8dee9';
      ctx.beginPath();
      ctx.arc(vacX, 480, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5e81ac';
      ctx.beginPath();
      ctx.arc(vacX, 480, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crash Scene: Webcam knocked over showing live stream popup
    if (crashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, 960, 540);

      // Broken webcam banner overlay
      ctx.translate(480, 230);
      ctx.rotate(-0.06);
      ctx.fillStyle = '#b3192b';
      ctx.fillRect(-220, -110, 440, 220);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(-220, -110, 440, 220);

      // Red recording dot & warning
      ctx.fillStyle = '#ff3838';
      ctx.beginPath();
      ctx.arc(-170, -78, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('🔴 LIVE: ALL-HANDS MEETING', -150, -72);

      ctx.font = '600 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WEBCAM TIPPED OVER!', 0, -15);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#ffdada';
      ctx.fillText('Boss watched you sleeping with snoring audio', 0, 18);
      ctx.fillText('Slack status flipped to: ❌ OUT FOR THE DAY', 0, 46);
      ctx.restore();
    }

    // Cashout safe celebration overlay
    if (cashed && !crashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 32, 18, 0.45)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#2bac76';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💬 SLACK MSG POSTED: "Agree with above 👍"', 480, 350);
      ctx.restore();
    }

    // TOP HUD
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '700 34px sans-serif';
    ctx.fillText('JIGGLER PROTOCOL', 480, 42);

    ctx.font = '600 15px monospace';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('STATUS: ' + (crashed ? 'COLLAPSED' : (running ? 'AUTONOMOUS JIGGLING' : 'IDLE NAP')), 480, 68);

    // Giant Multiplier
    const multColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.accent);
    ctx.fillStyle = multColor;
    ctx.font = '900 68px monospace';
    ctx.fillText(formatX(view.currentX100), 480, 135);

    // Milestone ticker caption
    const passedMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const tickerCaption = passedMilestone ? passedMilestone[1] : (crashed ? 'Contraption disintegrated onto keyboard' : 'Stack devices to keep cursor moving');
    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.font = '600 19px sans-serif';
    ctx.fillText(tickerCaption, 480, 485);

    // Stake line
    const [stkText, stkCol] = stakeLine(view);
    ctx.fillStyle = stkCol;
    ctx.font = '700 17px monospace';
    ctx.fillText(stkText, 480, 515);

    ctx.restore();
  }

  return { draw };
}
