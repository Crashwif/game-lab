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
  bgDark: '#0b0416',
  neonPink: '#ff2a85',
  neonCyan: '#00f3ff',
  neonGold: '#ffd000',
  pastelSuit: '#e2f4ff',
  shirtTeal: '#00d4aa',
  crashed: '#ff3366',
  cashedOut: '#4ef4a6',
  muted: '#9a8ab5',
  text: '#ffffff',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Selecting targets in the VIP lounge...',
  betting: 'Ropes down · Grab the duffel bag!',
  running: 'Raking cash under the strobe lights!',
  crashed: 'SECURITY COLLAPSE · BUSTED!',
};

const MILESTONES: [number, string][] = [
  [120, 'Scooping tips from the velvet VIP bar'],
  [150, 'Paparazzi lens flare blinds the dance floor'],
  [200, 'DJ drops bassline so hard neon shakes'],
  [250, 'Bouncer cracks brass knuckles on the counter'],
  [300, 'Security earpieces light up red alert'],
  [500, 'Disco ball snaps and crashes into cocktails'],
  [1000, 'Full club riot erupts under pink strobe lights'],
  [10000, 'Helicopter searchlight beams through skylight'],
  [100000, 'Ocean Drive gridlock surrounds the entire block'],
  [1000000, 'Legendary 6-star Vice City escape achieved'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (w: number, sz: number, pop: number) => `${w} ${sz * (1 + 0.28 * pop * pop)}px "Trebuchet MS", system-ui, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`Sped off in pink convertible at ${formatX(view.cashoutX100)}!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Observed the neon beatdown · Safe' : 'Watching the VIP heist · No credits in', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Bouncers tackled your ${credits(view.stake)}!`, COLOURS.crashed];
  }
  return [`Looting VIP booth · ${credits(view.stake)} at risk`, COLOURS.neonGold];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'slam' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let prevBeat = 0;

  function drawClubBackground(ctx: CanvasRenderingContext2D, elapsed: number, tension: number) {
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, '#0a0118');
    grad.addColorStop(0.65, '#220835');
    grad.addColorStop(1, '#05000c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);

    // Neon dance floor grid
    ctx.save();
    ctx.lineWidth = 1.5;
    const gridY = 380;
    for (let x = -200; x <= 1160; x += 60) {
      const topX = 480 + (x - 480) * 0.25;
      const alpha = 0.25 + 0.2 * Math.sin((elapsed * 0.003) + x);
      ctx.strokeStyle = `rgba(0, 243, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(topX, gridY);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = gridY; y <= 540; y += 28) {
      const p = (y - gridY) / (540 - gridY);
      ctx.strokeStyle = `rgba(255, 42, 133, ${0.15 + p * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }
    ctx.restore();

    // Lasers sweeping across the ceiling
    ctx.save();
    const sweep = Math.sin(elapsed * 0.004);
    const laserCount = 4 + Math.floor(tension * 4);
    for (let i = 0; i < laserCount; i++) {
      const angle = (i / laserCount) * Math.PI + sweep * 0.4;
      const lx = 480 + Math.cos(angle) * 700;
      const ly = Math.max(50, Math.sin(angle) * 400);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 42, 133, 0.3)' : 'rgba(0, 243, 255, 0.3)';
      ctx.lineWidth = 2 + tension * 3;
      ctx.beginPath();
      ctx.moveTo(480, 40);
      ctx.lineTo(lx, ly);
      ctx.stroke();
    }

    // Overhead disco ball
    const discoX = 480 + Math.sin(elapsed * 0.002) * 15;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(discoX, 0);
    ctx.lineTo(discoX, 40);
    ctx.stroke();
    const discoG = ctx.createRadialGradient(discoX - 4, 36, 2, discoX, 40, 22);
    discoG.addColorStop(0, '#ffffff');
    discoG.addColorStop(0.5, '#00f3ff');
    discoG.addColorStop(1, '#8800cc');
    ctx.fillStyle = discoG;
    ctx.beginPath();
    ctx.arc(discoX, 40, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBouncers(ctx: CanvasRenderingContext2D, tension: number, elapsed: number) {
    const leftX = 140 + tension * 110 + Math.sin(elapsed * 0.005) * 6;
    const rightX = 820 - tension * 110 - Math.sin(elapsed * 0.005 + 1) * 6;

    const drawBouncer = (bx: number, facingRight: boolean) => {
      ctx.save();
      ctx.translate(bx, 340);
      if (!facingRight) ctx.scale(-1, 1);

      // Body (pastel suit)
      ctx.fillStyle = COLOURS.pastelSuit;
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 62, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shirt collar & neon tie
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(-4, -40, 8, 38);

      // Head & sunglasses
      ctx.fillStyle = '#d29670';
      ctx.beginPath();
      ctx.arc(0, -70, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(-12, -74, 28, 8); // Shades

      // Earpiece blinking red alert
      const alert = Math.sin(elapsed * 0.015) > 0;
      ctx.fillStyle = alert && tension > 0.3 ? '#ff0033' : '#333';
      ctx.beginPath();
      ctx.arc(-16, -70, 4, 0, Math.PI * 2);
      ctx.fill();

      // Giant muscular arms
      ctx.fillStyle = COLOURS.pastelSuit;
      ctx.beginPath();
      ctx.ellipse(28, -8, 14, 32, 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    drawBouncer(leftX, true);
    drawBouncer(rightX, false);
  }

  function drawProtagonist(ctx: CanvasRenderingContext2D, elapsed: number, tension: number) {
    ctx.save();
    const bob = Math.sin(elapsed * 0.008) * 6;
    ctx.translate(480, 350 + bob);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 52, 50, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hawaiian open shirt torso
    ctx.fillStyle = COLOURS.shirtTeal;
    ctx.beginPath();
    ctx.ellipse(0, 2, 26, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shirt floral pattern
    ctx.fillStyle = COLOURS.neonPink;
    ctx.beginPath();
    ctx.arc(-8, -6, 5, 0, Math.PI * 2);
    ctx.arc(10, 10, 6, 0, Math.PI * 2);
    ctx.arc(-10, 20, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bare chest under open shirt
    ctx.fillStyle = '#e8a87c';
    ctx.beginPath();
    ctx.moveTo(-7, -30);
    ctx.lineTo(7, -30);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fill();

    // Head, shades & slick hair
    ctx.fillStyle = '#e8a87c';
    ctx.beginPath();
    ctx.arc(0, -48, 18, 0, Math.PI * 2);
    ctx.fill();

    // Slicked dark 80s hair
    ctx.fillStyle = '#211026';
    ctx.beginPath();
    ctx.ellipse(0, -60, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neon cool shades
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(-12, -50, 24, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -49, 7, 2);

    // Grin
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -40, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Duffel bag stuffed with cash (swells comically with tension)
    const bagScale = 1 + tension * 0.65;
    ctx.save();
    ctx.translate(34, 18);
    ctx.scale(bagScale, bagScale);
    ctx.fillStyle = '#2f1345';
    ctx.beginPath();
    ctx.roundRect(-24, -18, 48, 36, 10);
    ctx.fill();
    ctx.strokeStyle = COLOURS.neonGold;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Stacks of VIP banknotes pouring out
    const noteCount = 3 + Math.floor(tension * 6);
    for (let i = 0; i < noteCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#4ef4a6' : '#9ee8b5';
      const rot = Math.sin(elapsed * 0.01 + i) * 0.4;
      ctx.save();
      ctx.translate(-14 + i * 5, -18 - i * 3);
      ctx.rotate(rot);
      ctx.fillRect(-7, -4, 14, 8);
      ctx.fillStyle = '#1e7845';
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }
    ctx.restore();

    ctx.restore();
  }

  function drawEscapeScene(ctx: CanvasRenderingContext2D, elapsed: number) {
    // Ocean Drive night ride
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, '#060012');
    grad.addColorStop(0.5, '#400842');
    grad.addColorStop(1, '#ff3b88');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);

    // Distant synthwave sun
    const sunGrad = ctx.createLinearGradient(480, 160, 480, 340);
    sunGrad.addColorStop(0, '#ffd000');
    sunGrad.addColorStop(1, '#ff0066');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(480, 260, 90, Math.PI, 0, false);
    ctx.fill();

    // Palm tree silhouettes rushing past
    const offset = (elapsed * 0.6) % 360;
    for (let px = -100 + offset; px < 1100; px += 320) {
      ctx.fillStyle = '#180424';
      ctx.beginPath();
      ctx.moveTo(px, 540);
      ctx.lineTo(px + 10, 280);
      ctx.lineTo(px + 20, 540);
      ctx.fill();
      // Fronds
      for (let f = 0; f < 6; f++) {
        const ang = (f / 6) * Math.PI + 0.2;
        ctx.beginPath();
        ctx.ellipse(px + 10 + Math.cos(ang) * 45, 280 + Math.sin(ang) * 25, 35, 10, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ocean drive asphalt road
    ctx.fillStyle = '#140c1e';
    ctx.fillRect(0, 420, 960, 120);
    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = 4;
    ctx.setLineDash([30, 25]);
    ctx.lineDashOffset = -(elapsed * 0.8) % 55;
    ctx.beginPath();
    ctx.moveTo(0, 475);
    ctx.lineTo(960, 475);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pink Convertible sports car cruising
    const carX = 480 + Math.sin(elapsed * 0.003) * 30;
    const carY = 430;
    ctx.save();
    ctx.translate(carX, carY);

    // Car body
    ctx.fillStyle = '#ff2a85';
    ctx.beginPath();
    ctx.moveTo(-110, 15);
    ctx.lineTo(-70, -14);
    ctx.lineTo(40, -14);
    ctx.lineTo(90, 8);
    ctx.lineTo(110, 15);
    ctx.lineTo(100, 36);
    ctx.lineTo(-100, 36);
    ctx.closePath();
    ctx.fill();

    // Windshield
    ctx.fillStyle = 'rgba(0, 243, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-20, -14);
    ctx.lineTo(10, -32);
    ctx.lineTo(35, -14);
    ctx.closePath();
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-65, 36, 18, 0, Math.PI * 2);
    ctx.arc(65, 36, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd000';
    ctx.beginPath();
    ctx.arc(-65, 36, 8, 0, Math.PI * 2);
    ctx.arc(65, 36, 8, 0, Math.PI * 2);
    ctx.fill();

    // Protagonist waving with full duffel bag
    ctx.fillStyle = '#00d4aa';
    ctx.fillRect(-10, -28, 18, 16);
    ctx.fillStyle = '#e8a87c';
    ctx.beginPath();
    ctx.arc(0, -34, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(-4, -36, 10, 4);

    // Overflowing bag on passenger seat
    ctx.fillStyle = '#ffd000';
    ctx.beginPath();
    ctx.arc(36, -8, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawCrashBeatdown(ctx: CanvasRenderingContext2D, crashAge: number) {
    const age = Math.max(0, crashAge / 1000);
    // Dark chaotic strobe
    ctx.fillStyle = age % 0.15 < 0.075 ? '#240012' : '#0a0008';
    ctx.fillRect(0, 0, 960, 540);

    // Three bouncers belly-flopping dogpile in center
    ctx.save();
    ctx.translate(480, 360);

    // Flying shattered cocktail glasses & lime
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + age * 4;
      const dist = 60 + age * 160;
      ctx.fillStyle = 'rgba(0, 243, 255, 0.7)';
      ctx.fillRect(Math.cos(angle) * dist, Math.sin(angle) * dist * 0.7, 8, 8);
    }

    // Belly-flop pile (huge bouncer suits)
    ctx.fillStyle = COLOURS.pastelSuit;
    ctx.beginPath();
    ctx.ellipse(-40, 10, 65, 45, -0.2, 0, Math.PI * 2);
    ctx.ellipse(40, 15, 70, 48, 0.25, 0, Math.PI * 2);
    ctx.ellipse(0, -25, 75, 42, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Tangled sunglasses
    ctx.fillStyle = '#111';
    ctx.fillRect(-55, -45, 30, 8);
    ctx.fillRect(20, -5, 30, 8);

    // Confetti & scattered green banknotes
    for (let c = 0; c < 14; c++) {
      ctx.fillStyle = c % 2 === 0 ? '#4ef4a6' : '#ff2a85';
      const cx = Math.sin(c * 23.4) * 160;
      const cy = Math.cos(c * 17.1) * 80 - 40;
      ctx.fillRect(cx, cy, 14, 7);
    }

    // Giant cartoon impact dust & starburst
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let s = 0; s < 12; s++) {
      const a = (s / 12) * Math.PI * 2;
      const r = s % 2 === 0 ? 110 : 60;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;
    const beat = Math.floor(view.elapsed / 450);

    // Audio triggers
    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('engine', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('slam', prevPhase === null || view.crashAge > 1500);
      audio.fx('shatter', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIndex > prevMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('camera', 0.7);
      }
      if (beat > prevBeat && view.cashoutX100 === null) {
        audio.fx('coin', 0.3 + 0.6 * tension);
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;
    prevBeat = beat;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : (running ? tension * 2.5 * Math.sin(view.elapsed * 0.05) : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(crashAgeSec * 60 + view.elapsed * 0.02), shake * Math.cos(crashAgeSec * 45));

    // Render appropriate world view
    if (view.cashoutX100 !== null) {
      drawEscapeScene(ctx, view.elapsed);
    } else if (crashed) {
      drawCrashBeatdown(ctx, view.crashAge);
    } else {
      drawClubBackground(ctx, view.elapsed, tension);
      drawBouncers(ctx, tension, view.elapsed);
      drawProtagonist(ctx, view.elapsed, tension);
    }

    // Top Header Banner
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.neonPink;
    ctx.font = '800 38px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText('VICE CLUB HEIST', 480, 46);

    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '700 15px "Trebuchet MS", monospace';
    ctx.fillText('OCEAN DRIVE VIP LOUNGE · DODGE THE BOUNCERS', 480, 78);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.neonGold);
    ctx.fillStyle = multColor;
    ctx.font = '900 86px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 160);

    // Milestone / Phase status
    const currentMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const caption = currentMilestone ? currentMilestone[1] : PHASE_LABELS[view.phase];
    ctx.fillStyle = COLOURS.text;
    ctx.font = popFont(600, 22, running && currentMilestone ? clamp01(1 - Math.log(view.currentX100 / currentMilestone[0]) / 0.06) : 0);
    ctx.fillText(caption, 480, 218);

    // Stake line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 24px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText(lineText, 480, 498);

    ctx.restore();
  }

  return { draw };
}
