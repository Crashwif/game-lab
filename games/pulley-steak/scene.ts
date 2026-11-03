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
  [120, 'Window opens up and skillet swings outward'],
  [150, 'Pigeon swoops close to inspect the garlic rosemary'],
  [200, 'Fire escape ladder shakes as rope groans'],
  [250, 'Bystanders look up filming on their phones'],
  [300, 'Grease drops hiss onto an awning below'],
  [500, 'A delivery cyclist swerves under the swinging pan'],
  [1000, 'Health inspector spots the rig through binoculars'],
  [10000, 'Skillet reaches second floor wind turbulence'],
  [100000, 'Crowd gathers with open mouths on sidewalk'],
  [1000000, 'Five-star Yelp review drafted mid-air'],
];

const COLOURS = {
  brickDark: '#3e1d1d',
  brickLight: '#5c2d2d',
  windowDark: '#1a1824',
  windowGlow: '#f8c057',
  iron: '#202227',
  ironHighlight: '#484f59',
  steakBrown: '#6e2b1b',
  steakPink: '#ba4839',
  butterYellow: '#fae478',
  rosemaryGreen: '#457a3b',
  taxiYellow: '#f5b800',
  ropeHemp: '#c8a367',
  ropeFray: '#dfc28e',
  accent: '#ff8a50',
  cashedOut: '#6ee7b7',
  crashed: '#ef4444',
  textMuted: '#cbd5e1',
  textWhite: '#f8fafc',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${Math.round(size * (1 + 0.25 * pop * pop))}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Cashed out at ${formatX(view.cashoutX100)} · Bagged hot & juicy!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Watched the grease splatter · 0 credits lost' : 'Spectating the descent · 0 credits placed', COLOURS.textMuted];
  }
  if (crashed) return [`Lost ${credits(view.stake)} in the street collision`, COLOURS.crashed];
  return [`Order in progress · ${credits(view.stake)} on the clothesline`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastRopeCreak = 0;

  function drawBackground(ctx: CanvasRenderingContext2D, elapsed: number, tension: number) {
    // City canyon evening sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 540);
    skyGrad.addColorStop(0, '#19132b');
    skyGrad.addColorStop(0.65, '#3b203c');
    skyGrad.addColorStop(1, '#5a2d33');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Distant Manhattan skyline silhouettes
    ctx.fillStyle = '#140e21';
    for (let i = 0; i < 9; i++) {
      const bx = i * 115 - 20;
      const bw = 80 + (i % 3) * 20;
      const bh = 140 + ((i * 37) % 90);
      ctx.fillRect(bx, 540 - bh, bw, bh);
      // Small tower antenna blinking
      if (i % 2 === 0) {
        ctx.fillRect(bx + bw / 2 - 2, 540 - bh - 24, 4, 24);
        const blink = Math.sin(elapsed * 0.005 + i) > 0 ? '#ff3b30' : '#4a1515';
        ctx.fillStyle = blink;
        ctx.beginPath();
        ctx.arc(bx + bw / 2, 540 - bh - 25, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#140e21';
      }
    }

    // Manhattan Brownstone facade (occupies left side: x: 0 to 420)
    ctx.fillStyle = COLOURS.brickDark;
    ctx.fillRect(0, 0, 420, 540);

    // Brick mortar lines
    ctx.strokeStyle = '#2b1313';
    ctx.lineWidth = 2;
    for (let y = 15; y < 540; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(420, y);
      ctx.stroke();
    }

    // Fire escape zig-zag ladders and platforms on brownstone
    ctx.strokeStyle = '#121217';
    ctx.lineWidth = 4;
    for (let f = 1; f <= 3; f++) {
      const fy = f * 130 - 20;
      // platform
      ctx.strokeRect(120, fy, 160, 10);
      // railing
      ctx.strokeRect(120, fy - 22, 160, 22);
      // vertical rungs
      for (let rx = 135; rx < 280; rx += 25) {
        ctx.beginPath();
        ctx.moveTo(rx, fy - 22);
        ctx.lineTo(rx, fy);
        ctx.stroke();
      }
      // angled ladder connecting downward
      ctx.beginPath();
      ctx.moveTo(270, fy);
      ctx.lineTo(130, fy + 120);
      ctx.stroke();
    }

    // 4th Floor Window where the rig originates (top right of brownstone, x: 280, y: 30)
    ctx.fillStyle = COLOURS.windowDark;
    ctx.fillRect(290, 24, 90, 85);
    ctx.fillStyle = COLOURS.windowGlow;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(295, 29, 38, 75);
    ctx.fillRect(337, 29, 38, 75);
    ctx.globalAlpha = 1;

    // Wooden clothesline pole arm jutting out from window
    ctx.fillStyle = '#59341b';
    ctx.fillRect(330, 68, 140, 12);
    ctx.strokeStyle = '#2d180b';
    ctx.strokeRect(330, 68, 140, 12);

    // Rig pulley wheel at tip
    ctx.fillStyle = '#7a828e';
    ctx.beginPath();
    ctx.arc(470, 74, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b3038';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Street ground & yellow taxi hood on right/center bottom
    ctx.fillStyle = '#1c1b22';
    ctx.fillRect(0, 480, 960, 60);

    // Yellow taxi body
    ctx.fillStyle = COLOURS.taxiYellow;
    ctx.beginPath();
    ctx.roundRect(430, 450, 310, 65, [14, 14, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#a87e00';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Taxi roof sign
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(540, 432, 70, 18);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('TAXI', 575, 444);

    // Pigeon perched or flying depending on tension
    const pigeonX = 390 + Math.sin(elapsed * 0.003) * (tension > 0.4 ? 40 : 10);
    const pigeonY = 160 + (tension > 0.4 ? Math.cos(elapsed * 0.008) * 30 : 0);
    ctx.fillStyle = '#7d8899';
    ctx.beginPath();
    ctx.ellipse(pigeonX, pigeonY, 14, 9, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#495260';
    ctx.beginPath();
    ctx.arc(pigeonX + 11, pigeonY - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = '#ea8b32';
    ctx.beginPath();
    ctx.moveTo(pigeonX + 16, pigeonY - 6);
    ctx.lineTo(pigeonX + 22, pigeonY - 4);
    ctx.lineTo(pigeonX + 16, pigeonY - 2);
    ctx.fill();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Audio cues
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('whoosh', 0.6);
      }
      // Periodic creak sound as tension grows
      if (view.elapsed - lastRopeCreak > 1200 - tension * 700) {
        audio.fx('creak', 0.3 + 0.5 * tension);
        lastRopeCreak = view.elapsed;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate(
        shake * Math.sin(crashAgeSec * 75),
        shake * Math.cos(crashAgeSec * 95)
      );
    }

    drawBackground(ctx, view.elapsed, tension);

    // Pan descent kinematics
    // Origin at pulley: (470, 74)
    const pulleyX = 470;
    const pulleyY = 74;

    // Normal lowering goes from y=120 down to y=380
    const descentProgress = cashed
      ? clamp01(view.elapsed / 2500)
      : clamp01(0.08 + depth * 0.75 + tension * 0.17);

    // Pendulum swing quickens and widens with tension
    const swingFreq = 0.004 + tension * 0.005;
    const swingAmp = 25 + tension * 45;
    const swingOffset = (running || (!crashed && !cashed)) ? Math.sin(view.elapsed * swingFreq) * swingAmp : 0;

    let panX = pulleyX + swingOffset;
    let panY = pulleyY + 45 + descentProgress * 290;
    let ropeSnapped = false;

    if (crashed) {
      ropeSnapped = true;
      // Skillet falls fast to the taxi hood at (560, 455)
      const fallT = Math.min(1, crashAgeSec / 0.35);
      const startFallY = pulleyY + 45 + descentProgress * 290;
      panY = startFallY + (455 - startFallY) * (fallT * fallT);
      panX = pulleyX + swingOffset * (1 - fallT * 0.7);
    } else if (cashed) {
      // Gentle glide down into tote bag at (680, 440)
      panX = 680;
      panY = 430;
    }

    // Draw Clothesline / Rope
    ctx.lineWidth = 3.5;
    if (ropeSnapped) {
      // Snapped recoil rope from pulley
      ctx.strokeStyle = COLOURS.ropeHemp;
      ctx.beginPath();
      ctx.moveTo(pulleyX, pulleyY);
      const recoilY = pulleyY + 40 + Math.sin(crashAgeSec * 20) * 12;
      ctx.quadraticCurveTo(pulleyX + 15, pulleyY + 20, pulleyX - 10, recoilY);
      ctx.stroke();

      // Frayed snapped fiber ends
      ctx.strokeStyle = COLOURS.ropeFray;
      ctx.lineWidth = 1.5;
      for (let f = -8; f <= 8; f += 4) {
        ctx.beginPath();
        ctx.moveTo(pulleyX - 10, recoilY);
        ctx.lineTo(pulleyX - 10 + f * 1.5, recoilY + 12 + Math.abs(f));
        ctx.stroke();
      }
    } else {
      // Stretched rope holding pan harness
      ctx.strokeStyle = COLOURS.ropeHemp;
      ctx.beginPath();
      ctx.moveTo(pulleyX, pulleyY);
      const ropeSagX = (pulleyX + panX) / 2 + Math.sin(view.elapsed * 0.006) * (6 + tension * 8);
      const ropeSagY = (pulleyY + panY) / 2;
      ctx.quadraticCurveTo(ropeSagX, ropeSagY, panX, panY - 26);
      ctx.stroke();

      // Three harness strands holding pan rim
      ctx.beginPath();
      ctx.moveTo(panX, panY - 26);
      ctx.lineTo(panX - 28, panY - 4);
      ctx.moveTo(panX, panY - 26);
      ctx.lineTo(panX + 28, panY - 4);
      ctx.moveTo(panX, panY - 26);
      ctx.lineTo(panX + 50, panY - 2); // handle support
      ctx.stroke();

      // Frayed strands flying out if tension is high
      if (tension > 0.3) {
        ctx.strokeStyle = COLOURS.ropeFray;
        ctx.lineWidth = 1.5;
        const frayCount = Math.floor(tension * 6);
        for (let i = 0; i < frayCount; i++) {
          const fy = pulleyY + 30 + i * 35;
          ctx.beginPath();
          ctx.moveTo(pulleyX + (i % 2 === 0 ? 3 : -3), fy);
          ctx.lineTo(pulleyX + (i % 2 === 0 ? 14 : -14), fy + 6);
          ctx.stroke();
        }
      }
    }

    // Cast-iron pan & sizzling Ribeye
    ctx.save();
    ctx.translate(panX, panY);

    if (crashed) {
      // Rotated impact on taxi hood
      const impactRot = Math.min(0.65, crashAgeSec * 2.5);
      ctx.rotate(impactRot);
    } else {
      ctx.rotate(Math.sin(view.elapsed * swingFreq) * (0.08 + tension * 0.15));
    }

    // Cast Iron Skillet Handle
    ctx.fillStyle = COLOURS.iron;
    ctx.beginPath();
    ctx.roundRect(32, -6, 38, 12, 4);
    ctx.fill();
    // Handle teardrop hole
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(62, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Skillet rim and body
    ctx.fillStyle = COLOURS.iron;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Skillet inner recess
    ctx.fillStyle = '#17181c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 33, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sizzling grease pool
    ctx.fillStyle = 'rgba(230, 160, 40, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // The Ribeye Steak!
    ctx.fillStyle = COLOURS.steakBrown;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 24, 10, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Juicy pink center
    ctx.fillStyle = COLOURS.steakPink;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 16, 6, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Grill marks
    ctx.strokeStyle = '#38120c';
    ctx.lineWidth = 2;
    for (let gx = -12; gx <= 10; gx += 7) {
      ctx.beginPath();
      ctx.moveTo(gx, -5);
      ctx.lineTo(gx + 5, 5);
      ctx.stroke();
    }

    // Melting garlic herb butter pat
    ctx.fillStyle = COLOURS.butterYellow;
    ctx.beginPath();
    ctx.roundRect(-4, -4, 9, 7, 2);
    ctx.fill();

    // Rosemary sprig
    ctx.strokeStyle = COLOURS.rosemaryGreen;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.lineTo(14, 3);
    ctx.lineTo(16, 1);
    ctx.stroke();

    // Grease spitting & sizzling steam particles
    if (!crashed) {
      for (let s = 0; s < 5; s++) {
        const steamPhase = (view.elapsed * 0.003 + s * 1.3) % 1;
        const stX = -12 + s * 7 + Math.sin(steamPhase * 6) * 6;
        const stY = -12 - steamPhase * 32;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * (1 - steamPhase)})`;
        ctx.beginPath();
        ctx.arc(stX, stY, 3 + steamPhase * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hot grease drops flying downwards
      if (tension > 0.15) {
        ctx.fillStyle = '#ffb347';
        for (let g = 0; g < 3; g++) {
          const dropY = ((view.elapsed * (0.2 + g * 0.05)) % 60);
          ctx.beginPath();
          ctx.arc(-8 + g * 10, 14 + dropY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();

    // Hipster customer at street on cashout
    if (cashed) {
      const bagX = 680;
      const bagY = 470;
      // Insulated delivery tote bag
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.roundRect(bagX - 35, bagY - 40, 70, 48, 6);
      ctx.fill();
      ctx.strokeStyle = '#5b21b6';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Handles
      ctx.beginPath();
      ctx.arc(bagX, bagY - 40, 18, Math.PI, 0);
      ctx.stroke();

      // Big crisp $20 tip banner popup
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.roundRect(bagX + 45, bagY - 75, 95, 36, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+$20 TIP!', bagX + 92, bagY - 52);
    }

    // Comical Crash aftermath on yellow taxi
    if (crashed) {
      // Hot butter & sauce explosion burst
      const burstProgress = Math.min(1, crashAgeSec / 0.5);
      const alpha = 1 - burstProgress * 0.8;
      ctx.fillStyle = `rgba(255, 140, 0, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(560, 455, 45 + burstProgress * 65, 0, Math.PI * 2);
      ctx.fill();

      // Shattered windshield / hood dent cracks
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(560, 455);
      ctx.lineTo(530, 435);
      ctx.moveTo(560, 455);
      ctx.lineTo(595, 430);
      ctx.moveTo(560, 455);
      ctx.lineTo(580, 485);
      ctx.stroke();

      // Garlic butter splatter spots
      ctx.fillStyle = '#ffe066';
      for (let sp = 0; sp < 7; sp++) {
        const sx = 560 + Math.cos(sp * 0.9) * (25 + sp * 8);
        const sy = 455 + Math.sin(sp * 0.9) * (20 + sp * 6);
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + (sp % 4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HUD & Interface elements
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);
    const activeTint = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.accent;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline banner
    ctx.fillStyle = COLOURS.textWhite;
    ctx.font = '700 38px system-ui, sans-serif';
    ctx.fillText('PULLEY STEAK', 680, 44, 450);

    ctx.font = '500 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.textMuted;
    ctx.fillText('HOT RIBEYE SKYLINE COURIER · LOWER CLEANLY', 680, 72, 450);

    // Multiplier Box & Digital Display
    ctx.fillStyle = 'rgba(15, 15, 23, 0.75)';
    ctx.beginPath();
    ctx.roundRect(470, 94, 420, 115, 14);
    ctx.fill();
    ctx.strokeStyle = activeTint;
    ctx.lineWidth = 2;
    ctx.stroke();

    const punch = crashed ? (1 - clamp01((crashAgeSec - 0.12) / 0.25)) ** 2 : 0;
    ctx.fillStyle = activeTint;
    ctx.font = `800 ${Math.round(76 * (1 + 0.2 * punch))}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 680, 146, 400);

    // Dynamic Milestone / Phase caption
    const passedMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const captionText = passedMilestone ? passedMilestone[1] : (crashed ? 'CLOTHESLINE SNAPPED!' : 'Preparing Ribeye in 4th Floor Kitchen');
    ctx.fillStyle = COLOURS.textWhite;
    ctx.font = popFont(500, 18, pop(passedMilestone?.[0] ?? 100));
    ctx.fillText(captionText, 480, 508, 880);

    // Stake line
    const [lineText, lineColour] = stakeLine(view);
    ctx.fillStyle = lineColour;
    ctx.font = popFont(600, 19, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(lineText, 680, 236, 420);

    ctx.restore();
  }

  return { draw };
}
