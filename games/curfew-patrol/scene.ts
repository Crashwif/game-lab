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

const TITLE = 'CURFEW PATROL';
const SUBTITLE = 'VICE CITY LAUNCH NIGHT · ZERO INCIDENTS';

const COLOURS = {
  bgTop: '#08081a',
  bgBottom: '#180e2b',
  neonPink: '#ff2a85',
  neonCyan: '#00f0ff',
  neonAmber: '#ffaa00',
  neonGreen: '#39ff14',
  text: '#f2f8ff',
  muted: '#8f9ec2',
  crashed: '#ff3366',
  cashedOut: '#44ffaa',
  donutGlaze: '#ff77a8',
  donutDough: '#e09858',
  dashDark: '#121420',
  dashTrim: '#20263c',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Dispatch radio whispers zero active incidents'],
  [150, 'Officer unwraps fresh glazed box number two'],
  [200, 'Neighborhood streetlights buzz in peaceful quiet'],
  [250, 'Cruiser radar displays a flat zero speed line'],
  [300, 'Officer opens folding lawn chair beside cruiser'],
  [500, 'Donut stack balances all the way to car roof'],
  [1000, 'Precinct captain joins in wearing fuzzy slippers'],
  [10000, 'Entire district declared a tranquil gamer holiday'],
  [100000, 'Cruiser dashboard turns into luxury hammock rig'],
  [1000000, 'Crime reaches absolute zero across all five boroughs'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Snoozing on overtime · Cashed out at ${formatX(view.cashoutX100)}`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Blackout struck · no credits lost' : 'Watching the empty precinct · zero credits riding', COLOURS.muted];
  }
  if (crashed) return [`Power grid blew · your ${credits(view.stake)} drowned in gamer tears`, COLOURS.crashed];
  return [`Cruiser on standby · ${credits(view.stake)} enjoying the quiet`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const isCashed = view.cashoutX100 !== null;

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (previousPhase !== null && running && isCashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.9);
      audio.fx('zap', 0.7);
    }
    if (running && previousPhase === 'running' && milestoneIndex > previousMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('ding', 0.6 + tension * 0.4);
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const shake = crashed ? 18 * Math.exp(-age * 4) : Math.sin(now * 0.003) * (tension * 1.5);
    const shakeX = shake * Math.sin(age * 55 + now * 0.05);
    const shakeY = shake * Math.cos(age * 47 + now * 0.05);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. SKY & CITYSCAPE BACKGROUND
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, COLOURS.bgTop);
    skyGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // City skyline with apartment windows glowing with launch game neon (turns black on crash)
    const blackout = crashed && age > 0.08;
    ctx.save();
    const bldCount = 14;
    for (let i = 0; i < bldCount; i++) {
      const bx = i * 72 - 20;
      const bw = 58;
      const bh = 110 + ((i * 37) % 130);
      const by = 310 - bh;
      ctx.fillStyle = '#0b0d1a';
      ctx.fillRect(bx, by, bw, bh);

      // Windows glowing neon from TVs / gaming monitors
      if (!blackout) {
        for (let wy = by + 12; wy < 300; wy += 22) {
          for (let wx = bx + 8; wx < bx + bw - 10; wx += 16) {
            const lit = ((i * 17 + wx + wy) % 5) < 3;
            if (lit) {
              const tint = (i + wx) % 2 === 0 ? COLOURS.neonCyan : COLOURS.neonPink;
              ctx.fillStyle = tint;
              ctx.globalAlpha = 0.4 + 0.4 * Math.sin(now * 0.004 + wx);
              ctx.fillRect(wx, wy, 10, 12);
            }
          }
        }
      }
    }
    ctx.restore();

    // Distant palm trees (Vice City vibes)
    for (const px of [140, 240, 780, 890]) {
      ctx.fillStyle = '#070810';
      ctx.beginPath();
      ctx.moveTo(px - 4, 320);
      ctx.quadraticCurveTo(px + 8, 230, px + 12, 170);
      ctx.lineTo(px + 16, 170);
      ctx.quadraticCurveTo(px + 12, 230, px + 2, 320);
      ctx.fill();
      for (let a = -1.2; a <= 1.2; a += 0.45) {
        ctx.beginPath();
        ctx.moveTo(px + 14, 170);
        ctx.quadraticCurveTo(px + 14 + Math.sin(a) * 45, 160 + Math.cos(a) * 20, px + 14 + Math.sin(a) * 65, 185);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#06070d';
        ctx.stroke();
      }
    }

    // Parking lot ground & synthwave road grid
    const groundGrad = ctx.createLinearGradient(0, 310, 0, 540);
    groundGrad.addColorStop(0, '#100a1c');
    groundGrad.addColorStop(1, '#05040a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 310, 960, 230);

    // Cruiser Dashboard (bottom third of screen frame view)
    ctx.fillStyle = COLOURS.dashDark;
    ctx.beginPath();
    ctx.moveTo(0, 370);
    ctx.bezierCurveTo(240, 340, 720, 340, 960, 370);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.fill();

    // Dashboard neon edge highlight
    ctx.strokeStyle = crashed ? COLOURS.crashed : (isCashed ? COLOURS.cashedOut : COLOURS.neonPink);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 372);
    ctx.bezierCurveTo(240, 342, 720, 342, 960, 372);
    ctx.stroke();

    // 2. RADAR SCANNER & DISPATCH SCREEN (Left side of dash)
    ctx.fillStyle = '#060a12';
    ctx.strokeStyle = COLOURS.dashTrim;
    ctx.lineWidth = 4;
    ctx.roundRect(40, 385, 200, 110, 8);
    ctx.fill();
    ctx.stroke();

    // Radar green flatline / calm grid
    ctx.fillStyle = blackout ? '#08140e' : '#082a16';
    ctx.fillRect(44, 389, 192, 102);

    if (!blackout) {
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.3)';
      ctx.lineWidth = 1;
      for (let rx = 50; rx <= 230; rx += 30) {
        ctx.beginPath();
        ctx.moveTo(rx, 390);
        ctx.lineTo(rx, 490);
        ctx.stroke();
      }
      ctx.strokeStyle = COLOURS.neonGreen;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(48, 440);
      const pulseY = running ? Math.sin(now * 0.008) * (2 + tension * 4) : 0;
      ctx.lineTo(120, 440 + pulseY);
      ctx.lineTo(135, 432 - pulseY * 2);
      ctx.lineTo(145, 448 + pulseY * 2);
      ctx.lineTo(160, 440);
      ctx.lineTo(232, 440);
      ctx.stroke();

      ctx.fillStyle = COLOURS.neonGreen;
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('DISPATCH: ZERO CALLS', 50, 404);
      ctx.fillText(`RADAR: 00.0 MPH (PARK)`, 50, 484);
    } else {
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '700 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ GRID BLACKOUT ⚠️', 140, 444);
    }

    // 3. STEERING WHEEL WITH RESTING BOOTS & DONUT STACK
    const wheelCenter = 460;
    // Steering Wheel rim
    ctx.strokeStyle = '#2d3345';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(wheelCenter, 430, 85, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();

    // Donut Tower balancing on the steering wheel!
    const donutCount = Math.min(10, Math.floor(tension * 10) + (isCashed ? 1 : 0) + (depth > 0.4 ? 2 : 0));
    const donutBaseY = 360;
    const donutSway = Math.sin(now * 0.004) * (tension * 8);

    for (let d = 0; d < donutCount; d++) {
      const dy = donutBaseY - d * 18;
      const dx = wheelCenter - 30 + (d * donutSway) / 5;
      // Dough
      ctx.fillStyle = COLOURS.donutDough;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 24, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glaze
      ctx.fillStyle = d % 2 === 0 ? COLOURS.donutGlaze : '#422416';
      ctx.beginPath();
      ctx.ellipse(dx, dy - 2, 21, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hole
      ctx.fillStyle = COLOURS.dashDark;
      ctx.beginPath();
      ctx.ellipse(dx, dy - 1, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Sprinkles
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx - 10, dy - 4, 3, 2);
      ctx.fillRect(dx + 7, dy - 3, 3, 2);
    }

    // Patrol Officer's Boots resting on steering wheel
    // Left Boot
    ctx.save();
    ctx.translate(wheelCenter + 25, 345);
    ctx.rotate(0.18 + (isCashed ? 0.05 * Math.sin(now * 0.003) : 0));
    ctx.fillStyle = '#0f1118';
    ctx.beginPath();
    ctx.roundRect(-10, -22, 28, 48, 8);
    ctx.fill();
    // Sole & laces
    ctx.fillStyle = '#5c4632';
    ctx.fillRect(-12, 18, 32, 8);
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillRect(-5, -12, 18, 2);
    ctx.fillRect(-5, -6, 18, 2);
    ctx.restore();

    // Right Boot (crossed over)
    ctx.save();
    ctx.translate(wheelCenter + 55, 335);
    ctx.rotate(-0.22);
    ctx.fillStyle = '#0c0e14';
    ctx.beginPath();
    ctx.roundRect(-12, -24, 30, 50, 8);
    ctx.fill();
    ctx.fillStyle = '#5c4632';
    ctx.fillRect(-14, 18, 34, 8);
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillRect(-6, -14, 18, 2);
    ctx.fillRect(-6, -8, 18, 2);
    ctx.restore();

    // 4. STEAMING COFFEE CUP (Right side of dash)
    ctx.fillStyle = '#e8ecf2';
    ctx.beginPath();
    ctx.roundRect(720, 390, 42, 54, 5);
    ctx.fill();
    ctx.fillStyle = COLOURS.neonPink;
    ctx.font = '700 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VPCPD', 741, 420);
    // Steam curls
    if (!blackout) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      const steamShift = (now * 0.003) % 1;
      ctx.beginPath();
      ctx.moveTo(735, 385);
      ctx.quadraticCurveTo(730, 370 - steamShift * 15, 738, 355 - steamShift * 20);
      ctx.moveTo(747, 385);
      ctx.quadraticCurveTo(752, 370 - steamShift * 15, 744, 355 - steamShift * 20);
      ctx.stroke();
    }

    // 5. CASHOUT / CRASH OVERLAYS
    if (isCashed) {
      // Golden Paid Overtime Stamp & Snoring Zzz's
      ctx.save();
      const zShift = (now * 0.003) % 1;
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '800 24px sans-serif';
      ctx.fillText('Z', 560 + zShift * 20, 300 - zShift * 40);
      ctx.font = '800 32px sans-serif';
      ctx.fillText('Z', 580 + zShift * 30, 270 - zShift * 50);

      // Overtime Voucher Stamp
      ctx.translate(760, 260);
      ctx.rotate(-0.15);
      ctx.fillStyle = 'rgba(68, 255, 170, 0.15)';
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.roundRect(-100, -35, 200, 70, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '900 16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAID OVERTIME APPROVED', 0, -8);
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.fillText('FULL SNOOZE AUTHORIZED', 0, 16);
      ctx.restore();
    }

    if (crashed) {
      // Blackout & gamer riot silhouettes outside windows!
      const burst = clamp01(age / 0.3);
      if (age < 0.25) {
        ctx.fillStyle = `rgba(255, 50, 100, ${0.4 * (1 - burst)})`;
        ctx.fillRect(0, 0, 960, 540);
      }
      // Silhouettes of angry gamers with neon red headsets running past outside
      ctx.fillStyle = 'rgba(255, 40, 80, 0.7)';
      for (let g = 0; g < 7; g++) {
        const gx = 120 + g * 115 + Math.sin(now * 0.01 + g) * 12;
        const gy = 260 + Math.sin(now * 0.02 + g * 2) * 5;
        ctx.beginPath();
        ctx.arc(gx, gy - 20, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(gx - 8, gy - 8, 16, 26);
        // Angry glowing headset eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gx - 4, gy - 22, 3, 3);
        ctx.fillRect(gx + 2, gy - 22, 3, 3);
        ctx.fillStyle = 'rgba(255, 40, 80, 0.7)';
      }
    }

    // 6. HUD / TEXT READOUTS
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 42px system-ui, sans-serif';
    ctx.fillText(TITLE, 480, 52);

    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.letterSpacing = '2px';
    ctx.fillText(SUBTITLE, 480, 86);
    ctx.letterSpacing = '0px';

    // Primary Multiplier
    const multiColour = crashed ? COLOURS.crashed : (isCashed ? COLOURS.cashedOut : COLOURS.neonPink);
    const punch = crashed ? (1 - clamp01((age - 0.12) / 0.25)) ** 2 : 0;
    ctx.fillStyle = multiColour;
    ctx.font = `900 ${84 * (1 + 0.18 * punch)}px ui-monospace, monospace`;
    ctx.shadowColor = multiColour;
    ctx.shadowBlur = 18;
    ctx.fillText(formatX(view.currentX100), 480, 155);
    ctx.shadowBlur = 0;

    // Milestone / Dispatch Status Banner
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    const statusText = running
      ? (currentMilestone ? currentMilestone[1] : 'Cruiser quiet · engine idling smoothly')
      : (crashed ? 'CITYWIDE POWER POP · GAMER RIOT COMMENCING' : 'Shift ready · kick your boots onto the dash');

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.neonAmber;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 222, 880);

    // Stake & cashout outcome line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(line, 480, 512, 900);

    ctx.restore();
  }

  return { draw };
}
