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
  bgTop: '#0b101d',
  bgFloor: '#d99446',
  floorPlanks: '#c47e32',
  courtLines: '#ffffff',
  keyPaint: '#b83b3b',
  jersey: '#00e599',
  skin: '#f5c198',
  ball: '#ff6b22',
  rim: '#ff4400',
  net: '#f0f0f0',
  accent: '#00ffc2',
  crashed: '#ff3b5c',
  cashedOut: '#ffe600',
  text: '#ffffff',
  muted: '#8e9aaf',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Knees touch together in a deep bowlegged crouch'],
  [150, 'Aggressive wrist flicking begins at chest level'],
  [200, 'Spins the basketball three times on one fingertip'],
  [250, 'Full 360 neck spin while maintaining eye contact'],
  [300, 'Right elbow lifts perpendicular to outer space'],
  [500, 'Crowd goes dead silent as gym floor squeaks hard'],
  [1000, 'Steam jets out of high-top sneakers'],
  [10000, 'Defies gravity by hovering four inches in windup'],
  [100000, 'Hoop rim vibrates in sheer anticipation'],
  [1000000, 'Shooting pocket reaches hyper-dimensional geometry'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`SWISHED AT ${formatX(view.cashoutX100)}! PURE NYLON`, COLOURS.cashedOut];
  }
  if (view.phase === 'crashed') {
    return view.stake === null
      ? ['Watched the ugly brick · 0 credits lost', COLOURS.muted]
      : [`Airballed and faceplanted · lost ${credits(view.stake)}`, COLOURS.crashed];
  }
  if (view.stake === null) return ['Watching from the bleachers', COLOURS.muted];
  return [`At the free throw line · ${credits(view.stake)} riding`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'trap', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSqueakTime = 0;

  function drawCourt(ctx: CanvasRenderingContext2D, elapsed: number, tension: number): void {
    // Arena stands & crowd silhouettes
    const crowdGrad = ctx.createLinearGradient(0, 0, 0, 310);
    crowdGrad.addColorStop(0, '#060a12');
    crowdGrad.addColorStop(1, '#1b2234');
    ctx.fillStyle = crowdGrad;
    ctx.fillRect(0, 0, 960, 310);

    // Flashbulbs
    const flashSeed = Math.floor(elapsed / 120);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 7; i++) {
      const fx = ((flashSeed * 173 + i * 137) % 900) + 30;
      const fy = ((flashSeed * 97 + i * 59) % 180) + 50;
      const flashAlpha = Math.max(0, Math.sin((elapsed / 120 + i) * 2));
      if (flashAlpha > 0.8) {
        ctx.beginPath();
        ctx.arc(fx, fy, 4 + flashAlpha * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hardwood court
    const courtGrad = ctx.createLinearGradient(0, 310, 0, 540);
    courtGrad.addColorStop(0, COLOURS.bgFloor);
    courtGrad.addColorStop(1, '#9e5a1b');
    ctx.fillStyle = courtGrad;
    ctx.fillRect(0, 310, 960, 230);

    // Floor lines
    ctx.strokeStyle = COLOURS.floorPlanks;
    ctx.lineWidth = 1;
    for (let y = 330; y < 540; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Painted Free Throw Lane & Line
    ctx.fillStyle = 'rgba(184, 59, 59, 0.45)';
    ctx.beginPath();
    ctx.moveTo(340, 540);
    ctx.lineTo(500, 310);
    ctx.lineTo(840, 310);
    ctx.lineTo(840, 540);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = COLOURS.courtLines;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Free Throw Line
    ctx.beginPath();
    ctx.moveTo(340, 470);
    ctx.lineTo(540, 470);
    ctx.stroke();

    // Backboard & Hoop at right
    const hoopVibe = tension > 0.6 ? Math.sin(elapsed * 0.05) * (tension * 4) : 0;
    const bbX = 810;
    const bbY = 140 + hoopVibe;

    // Pole
    ctx.strokeStyle = '#444c5e';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(bbX + 30, bbY + 130);
    ctx.lineTo(bbX + 30, 340);
    ctx.stroke();

    // Backboard
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(bbX + 16, bbY - 20, 10, 110);
    ctx.strokeStyle = '#b83b3b';
    ctx.lineWidth = 3;
    ctx.strokeRect(bbX + 16, bbY + 25, 10, 45);

    // Rim
    ctx.strokeStyle = COLOURS.rim;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bbX + 16, bbY + 68);
    ctx.lineTo(bbX - 35, bbY + 68);
    ctx.stroke();

    // Net
    ctx.strokeStyle = COLOURS.net;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bbX - 33, bbY + 70);
    ctx.lineTo(bbX - 25, bbY + 115);
    ctx.lineTo(bbX - 2, bbY + 115);
    ctx.lineTo(bbX + 14, bbY + 70);
    ctx.stroke();
  }

  function drawFreakShooter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tension: number,
    elapsed: number,
    state: 'normal' | 'swish' | 'wrecked',
    crashProgress: number
  ): void {
    ctx.save();
    ctx.translate(x, y);

    if (state === 'wrecked') {
      // Hilarious faceplant into floor with over-rotated legs
      const slipAngle = Math.min(Math.PI * 0.55, crashProgress * Math.PI * 0.7);
      ctx.rotate(slipAngle);
      ctx.fillStyle = COLOURS.jersey;
      ctx.fillRect(-24, -50, 48, 60);
      // Legs sprawling up
      ctx.strokeStyle = COLOURS.skin;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-15, -50);
      ctx.lineTo(-30, -90);
      ctx.moveTo(15, -50);
      ctx.lineTo(35, -85);
      ctx.stroke();
      // Sneaker
      ctx.fillStyle = '#ff2255';
      ctx.fillRect(-45, -95, 24, 12);
      ctx.fillRect(25, -92, 24, 12);
      // Smashed head
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.arc(35, 10, 18, 0, Math.PI * 2);
      ctx.fill();
      // Dizzies
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.strokeText('💫', 40, -10);
      ctx.restore();
      return;
    }

    if (state === 'swish') {
      // Elegant silky follow-through pose
      ctx.fillStyle = COLOURS.jersey;
      ctx.fillRect(-18, -105, 36, 65);
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('00', 0, -70);
      // Straight legs
      ctx.strokeStyle = COLOURS.skin;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-10, -40);
      ctx.lineTo(-10, 15);
      ctx.moveTo(10, -40);
      ctx.lineTo(10, 15);
      ctx.stroke();
      // Head looking up
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.arc(0, -125, 16, 0, Math.PI * 2);
      ctx.fill();
      // Wrist flick high up towards basket
      ctx.strokeStyle = COLOURS.skin;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(14, -95);
      ctx.lineTo(35, -145);
      ctx.lineTo(50, -140);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // WINDUP: Twisting knot-like pretzel form escalates!
    const squat = tension * 45;
    const wobbleSpeed = 8 + tension * 22;
    const wobble = Math.sin(elapsed * 0.001 * wobbleSpeed) * (4 + tension * 14);
    const knotPhase = Math.sin(elapsed * 0.008) * tension;

    // Hover defying gravity milestone
    const hover = tension > 0.8 ? Math.sin(elapsed * 0.015) * 10 : 0;
    ctx.translate(0, -hover);

    // Steam from sneakers
    if (tension > 0.6) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      const steamY = 12 + Math.sin(elapsed * 0.03) * 6;
      ctx.beginPath();
      ctx.arc(-22, steamY - 10, 6 + tension * 4, 0, Math.PI * 2);
      ctx.arc(22, steamY - 14, 5 + tension * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // High top sneakers
    ctx.fillStyle = '#ff1144';
    ctx.fillRect(-32, 6, 24, 12);
    ctx.fillRect(8, 6, 24, 12);

    // Pretzel Bowlegged Knees knocking
    ctx.strokeStyle = COLOURS.skin;
    ctx.lineWidth = 7;
    ctx.beginPath();
    // Left leg bending inwards
    ctx.moveTo(-18, -40 + squat);
    ctx.lineTo(5 * knotPhase - 4, -15 + squat * 0.5);
    ctx.lineTo(-20, 8);
    // Right leg wrapping
    ctx.moveTo(18, -40 + squat);
    ctx.lineTo(-5 * knotPhase + 4, -15 + squat * 0.5);
    ctx.lineTo(20, 8);
    ctx.stroke();

    // Baggy Jersey
    ctx.save();
    ctx.translate(wobble * 0.3, squat);
    ctx.fillStyle = COLOURS.jersey;
    ctx.beginPath();
    ctx.moveTo(-22 - tension * 8, -45);
    ctx.lineTo(22 + tension * 8, -45);
    ctx.lineTo(16, 2);
    ctx.lineTo(-16, 2);
    ctx.closePath();
    ctx.fill();

    // Jersey text
    ctx.fillStyle = '#111';
    ctx.font = '900 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('99', 0, -20);
    ctx.restore();

    // Goofy Head with Sweatband
    const headY = -68 + squat + wobble * 0.4;
    const neckSpin = tension > 0.4 ? Math.sin(elapsed * 0.02) * (tension * 0.6) : 0;
    ctx.save();
    ctx.translate(wobble * 0.5, headY);
    ctx.rotate(neckSpin);
    ctx.fillStyle = COLOURS.skin;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    // Sweatband
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-16, -10, 32, 6);

    // Goofy eyes & tongue
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-5, -2, 5, 0, Math.PI * 2);
    ctx.arc(7, -2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    const pupilTwitch = Math.sin(elapsed * 0.05) * 2;
    ctx.arc(-5 + pupilTwitch, -2, 2.5, 0, Math.PI * 2);
    ctx.arc(7 - pupilTwitch, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Tongue sticking out
    ctx.fillStyle = '#ff4d88';
    ctx.beginPath();
    ctx.arc(2, 10, 4 + tension * 4, 0, Math.PI);
    ctx.fill();
    ctx.restore();

    // Spindly twisting pretzel arms holding basketball
    const armAngle = elapsed * 0.006 * (1 + tension * 3);
    const ballDist = 30 + tension * 15;
    const ballX = wobble + Math.cos(armAngle) * ballDist;
    const ballY = headY - 15 + Math.sin(armAngle) * (20 + tension * 25);

    ctx.strokeStyle = COLOURS.skin;
    ctx.lineWidth = 6;
    ctx.beginPath();
    // Left elbow lifting to outer space
    ctx.moveTo(-16, -42 + squat);
    ctx.lineTo(-30 - tension * 30, -50 - tension * 40 + Math.sin(elapsed * 0.02) * 10);
    ctx.lineTo(ballX - 8, ballY + 4);
    // Right arm winding around neck
    ctx.moveTo(16, -42 + squat);
    ctx.lineTo(24 + tension * 20, -55 + Math.cos(elapsed * 0.03) * 15);
    ctx.lineTo(ballX + 8, ballY + 4);
    ctx.stroke();

    // Basketball with seams
    ctx.save();
    ctx.translate(ballX, ballY);
    ctx.rotate(elapsed * 0.01 * (1 + tension * 4));
    ctx.fillStyle = COLOURS.ball;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.moveTo(-16, 0);
    ctx.lineTo(16, 0);
    ctx.moveTo(0, -16);
    ctx.lineTo(0, 16);
    ctx.stroke();
    ctx.restore();

    // Sweat tornado drops flying outwards
    if (tension > 0.25) {
      const dropCount = Math.floor(tension * 12);
      ctx.fillStyle = '#6be5ff';
      for (let i = 0; i < dropCount; i++) {
        const dropAngle = (elapsed * 0.01 + i * (Math.PI * 2 / dropCount)) % (Math.PI * 2);
        const radius = 35 + ((elapsed * 0.08 + i * 15) % 60);
        ctx.beginPath();
        ctx.arc(ballX + Math.cos(dropAngle) * radius, ballY + Math.sin(dropAngle) * radius * 0.6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawConfettiAndSwish(ctx: CanvasRenderingContext2D, elapsed: number): void {
    // Sinking clean ball through hoop
    const bbX = 810;
    const bbY = 140;
    const netY = bbY + 80 + Math.sin(elapsed * 0.02) * 5;
    ctx.fillStyle = COLOURS.ball;
    ctx.beginPath();
    ctx.arc(bbX - 18, netY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Confetti rain
    const colors = ['#ffe600', '#00ffc2', '#ff0055', '#ffffff', '#3b82f6'];
    for (let i = 0; i < 40; i++) {
      const cx = (Math.sin(i * 99 + elapsed * 0.002) * 0.5 + 0.5) * 960;
      const cy = ((elapsed * 0.2 + i * 27) % 540);
      ctx.fillStyle = colors[i % colors.length] ?? '#ffffff';
      ctx.fillRect(cx, cy, 8, 5);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('whistle', 0.7);
      }
      // Squeak sneaker shoes on the hardwood floor
      if (view.elapsed - lastSqueakTime > 900 - tension * 550) {
        audio.fx('squeak', 0.4 + 0.5 * tension);
        lastSqueakTime = view.elapsed;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate(shake * Math.sin(crashAgeSec * 60), shake * Math.cos(crashAgeSec * 45));
    }

    // Court background
    drawCourt(ctx, view.elapsed, tension);

    // Protagonist Freak Shooter
    const shooterX = 400;
    const shooterY = 460;
    if (cashedOut) {
      drawFreakShooter(ctx, shooterX, shooterY, tension, view.elapsed, 'swish', 0);
      drawConfettiAndSwish(ctx, view.elapsed);
    } else if (crashed) {
      drawFreakShooter(ctx, shooterX, shooterY, tension, view.elapsed, 'wrecked', clamp01(crashAgeSec / 0.5));
    } else {
      drawFreakShooter(ctx, shooterX, shooterY, tension, view.elapsed, 'normal', 0);
    }

    // HUD Header & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 36px system-ui, sans-serif';
    ctx.fillText('FREE THROW FREAK', 480, 48);

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('WIND UP THE CLUMSIEST SHOOTING FORM IN HOOPS HISTORY', 480, 80);

    // Multiplier Display
    const multiplierColor = crashed ? COLOURS.crashed : cashedOut ? COLOURS.cashedOut : COLOURS.accent;
    ctx.fillStyle = multiplierColor;
    ctx.font = '900 84px monospace';
    ctx.fillText(formatX(view.currentX100), 480, 160);

    // Milestone / Action Banner
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const bannerText = activeMilestone ? activeMilestone[1] : view.phase === 'betting' ? 'Line up your shot · Ready to join' : view.phase === 'waiting' ? 'Next shooter warming up...' : crashed ? 'OVER-ROTATED! LAUNCHED TO CEILING!' : 'SINK THE SHOT BEFORE RELEASE';

    ctx.fillStyle = 'rgba(10, 14, 25, 0.75)';
    ctx.fillRect(160, 218, 640, 38);
    ctx.strokeStyle = multiplierColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(160, 218, 640, 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 237);

    // Bottom Stake Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 508);

    ctx.restore();
  }

  return { draw };
}
