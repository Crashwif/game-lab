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
  [120, 'Ref trips backward onto the fifty-yard line'],
  [150, 'First yellow flag flutters upward gracefully'],
  [200, "Second flag whipped out from ref's waistband"],
  [250, 'Third flag flung spinning like a golden boomerang'],
  [300, 'Sideline coaches begin screaming in disbelief'],
  [500, 'Flags orbit the stadium lights in unison'],
  [1000, 'Jumbotron replays the midsection kick in 4K'],
  [10000, 'Stadium roof opens under sheer flag momentum'],
  [100000, 'Flags break atmosphere alongside broadcast drones'],
  [1000000, 'The entire galaxy is penalized for holding'],
];

const COLOURS = {
  skyNight: '#0d1626',
  turfDark: '#1a472a',
  turfLight: '#235e38',
  yardWhite: '#eaf4e8',
  refShirtDark: '#121212',
  refShirtWhite: '#f5f5f5',
  flagYellow: '#ffd214',
  flagWeight: '#1e1c16',
  accent: '#ffd214',
  crashed: '#ff4c68',
  cashedOut: '#4ee898',
  textLight: '#f4f8fd',
  textMuted: '#96a7be',
  jumboBorder: '#28384f',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.28 * pop * pop)}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Commercial Break Secured at ${formatX(view.cashoutX100)}!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Flag avalanche hits field · watching' : 'Spectating from the luxury box', COLOURS.textMuted];
  }
  if (crashed) return [`Lost ${credits(view.stake)} under the flag pile`, COLOURS.crashed];
  return [`Riding play · ${credits(view.stake)} at stake`, COLOURS.accent];
}

interface FlagParticle {
  id: number;
  spawnX100: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  swayFreq: number;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'military', crash: 'crowd' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let flagCounter = 0;
  let flags: FlagParticle[] = [];

  function spawnFlag(count: number, x100: number): void {
    for (let i = 0; i < count; i++) {
      flagCounter++;
      flags.push({
        id: flagCounter,
        spawnX100: x100,
        ox: 480 + (Math.random() - 0.5) * 40,
        oy: 370 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 360,
        vy: -280 - Math.random() * 260,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12,
        swayFreq: 3 + Math.random() * 4,
      });
    }
    if (flags.length > 70) flags.splice(0, flags.length - 70);
  }

  function drawField(ctx: CanvasRenderingContext2D, elapsed: number, tension: number): void {
    // Stadium upper tier
    const grad = ctx.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, '#060a12');
    grad.addColorStop(1, '#132136');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 340);

    // Stadium lights glow
    for (const lx of [120, 360, 600, 840]) {
      const glow = ctx.createRadialGradient(lx, 50, 5, lx, 50, 110);
      glow.addColorStop(0, `rgba(255, 250, 220, ${0.4 + 0.3 * tension})`);
      glow.addColorStop(1, 'rgba(255, 250, 220, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 120, 0, 240, 150);

      // Light rig
      ctx.fillStyle = '#405068';
      ctx.fillRect(lx - 35, 30, 70, 10);
      ctx.fillStyle = '#ffffff';
      for (let dot = -28; dot <= 28; dot += 14) {
        ctx.beginPath();
        ctx.arc(lx + dot, 35, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Crowd rows
    const crowdOffset = Math.sin(elapsed * 0.005) * 3;
    for (let row = 0; row < 4; row++) {
      const y = 140 + row * 26;
      ctx.fillStyle = row % 2 === 0 ? '#1e2b40' : '#172233';
      ctx.fillRect(0, y, 960, 24);
      for (let p = 0; p < 960; p += 16) {
        const bob = Math.sin(elapsed * 0.008 + p) * (tension * 4);
        ctx.fillStyle = ((p + row * 11) % 5 === 0) ? '#ff5252' : '#e0e8f0';
        ctx.beginPath();
        ctx.arc(p + 8 + crowdOffset, y + 10 + bob, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Turf base with alternating yard stripes
    for (let stripe = 0; stripe < 6; stripe++) {
      ctx.fillStyle = stripe % 2 === 0 ? COLOURS.turfDark : COLOURS.turfLight;
      ctx.fillRect(0, 240 + stripe * 50, 960, 50);
    }

    // Yard lines and 50-yard mark
    ctx.strokeStyle = COLOURS.yardWhite;
    ctx.lineWidth = 3;
    for (let x = 60; x < 960; x += 140) {
      ctx.beginPath();
      ctx.moveTo(x, 240);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    // Hash marks
    ctx.lineWidth = 2;
    for (let y = 260; y < 530; y += 22) {
      ctx.beginPath();
      ctx.moveTo(420, y);
      ctx.lineTo(440, y);
      ctx.moveTo(520, y);
      ctx.lineTo(540, y);
      ctx.stroke();
    }

    // Huge "50" on the field
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '900 68px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('5 0', 480, 480);
    ctx.restore();
  }

  function drawRef(ctx: CanvasRenderingContext2D, elapsed: number, tension: number, crashed: boolean): void {
    ctx.save();
    ctx.translate(480, 390);

    const kickTime = elapsed * 0.015 * (1 + tension * 2);
    const leg1 = Math.sin(kickTime) * 24;
    const leg2 = Math.cos(kickTime) * 24;
    const armWave = Math.sin(kickTime * 1.5) * 28;

    if (crashed) {
      // Ref pinned and swamped
      ctx.rotate(0.2);
    }

    // Shadow on turf
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 45, 95, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fallen ref torso (on his back, black-and-white stripes)
    ctx.save();
    ctx.translate(0, 15);
    ctx.rotate(0.08);

    // Torso background
    ctx.fillStyle = COLOURS.refShirtWhite;
    ctx.beginPath();
    ctx.roundRect(-42, -24, 84, 46, 12);
    ctx.fill();

    // Stripes
    ctx.fillStyle = COLOURS.refShirtDark;
    for (let sx = -35; sx < 40; sx += 14) {
      ctx.fillRect(sx, -24, 7, 46);
    }

    // Official belt & flag pouch
    ctx.fillStyle = '#1e1c14';
    ctx.fillRect(-40, 10, 80, 10);
    ctx.fillStyle = COLOURS.flagYellow;
    ctx.fillRect(10, 8, 16, 14); // Yellow flag sticking out of belt
    ctx.restore();

    // Kicking legs (pointing upward in panic)
    // Left leg
    ctx.save();
    ctx.translate(-24, 25);
    ctx.rotate(-0.8 + (leg1 * Math.PI) / 180);
    ctx.fillStyle = '#111';
    ctx.fillRect(-7, -40, 14, 40);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-7, -46, 14, 8); // White socks
    ctx.fillStyle = '#222';
    ctx.fillRect(-8, -54, 22, 10); // Cleat
    ctx.restore();

    // Right leg
    ctx.save();
    ctx.translate(22, 25);
    ctx.rotate(-0.6 + (leg2 * Math.PI) / 180);
    ctx.fillStyle = '#111';
    ctx.fillRect(-7, -42, 14, 42);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-7, -48, 14, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -56, 22, 10);
    ctx.restore();

    // Ref head (stunned, helmet/cap askew)
    ctx.save();
    ctx.translate(-58, 6);
    ctx.fillStyle = '#fed1a8'; // Skin
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    // Whistle in mouth
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(12, -4, 16, 7);
    ctx.beginPath();
    ctx.arc(28, -0.5, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Black referee cap tilted back
    ctx.fillStyle = '#121212';
    ctx.beginPath();
    ctx.arc(-4, -8, 18, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.fillRect(-22, -12, 16, 5); // Visor

    // Dazed spiral/swirl eyes
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    if (crashed) {
      // X X eyes
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo(0, 1);
      ctx.moveTo(0, -5);
      ctx.lineTo(-6, 1);
      ctx.moveTo(6, -5);
      ctx.lineTo(12, 1);
      ctx.moveTo(12, -5);
      ctx.lineTo(6, 1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-2, -2, 4, 0, Math.PI * 1.6);
      ctx.arc(8, -2, 4, 0, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();

    // Flailing throwing arm
    ctx.save();
    ctx.translate(34, 10);
    ctx.rotate(0.3 + (armWave * Math.PI) / 180);
    ctx.fillStyle = COLOURS.refShirtWhite;
    ctx.fillRect(-5, -34, 10, 34);
    // Hand grasping yellow flag cloth
    ctx.fillStyle = '#fed1a8';
    ctx.beginPath();
    ctx.arc(0, -36, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.flagYellow;
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(16, -54);
    ctx.lineTo(26, -40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawFlags(ctx: CanvasRenderingContext2D, elapsed: number): void {
    for (const f of flags) {
      const age = (elapsed - f.spawnX100 * 10) / 1000;
      if (age < 0) continue;
      const x = f.ox + f.vx * age;
      const y = f.oy + f.vy * age + 150 * age * age + Math.sin(age * f.swayFreq) * 20;
      const angle = f.rot + f.rotSpeed * age;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Yellow flag cloth
      ctx.fillStyle = COLOURS.flagYellow;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(14, -12, 28, -6);
      ctx.quadraticCurveTo(24, 14, 4, 18);
      ctx.closePath();
      ctx.fill();

      // Weighted bean ball inside flag
      ctx.fillStyle = COLOURS.flagWeight;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  function drawJumbotron(ctx: CanvasRenderingContext2D, view: SceneView, tension: number): void {
    // Upper scoreboard ribbon
    ctx.fillStyle = '#0a101b';
    ctx.fillRect(230, 18, 500, 56);
    ctx.strokeStyle = COLOURS.jumboBorder;
    ctx.lineWidth = 3;
    ctx.strokeRect(230, 18, 500, 56);

    ctx.fillStyle = '#ff2b4e';
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('● OFFICIAL REVIEW IN PROGRESS', 246, 36);

    ctx.fillStyle = '#e1ebff';
    ctx.font = '700 12px monospace';
    ctx.fillText(`DOWN: 4TH & MULTIPLIER   BALL ON: 50   PENALTY CLOCK: ${(view.elapsed / 1000).toFixed(1)}s`, 246, 58);

    // Dynamic siren lights on the scoreboard
    const flash = Math.sin(view.elapsed * 0.02) > 0;
    ctx.fillStyle = flash ? '#ffd214' : '#554400';
    ctx.fillRect(700, 28, 16, 16);
    ctx.fillStyle = !flash ? '#ff3232' : '#550000';
    ctx.fillRect(676, 28, 16, 16);

    if (tension > 0.4) {
      // Side replay cameras
      ctx.strokeStyle = 'rgba(255, 210, 20, 0.4)';
      ctx.strokeRect(40, 30, 140, 70);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(40, 30, 140, 70);
      ctx.fillStyle = '#fff';
      ctx.font = '800 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('CAM 1: REVERSE SLOMO', 110, 50);
      ctx.fillText(`${formatX(view.currentX100)} VELOCITY`, 110, 75);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    // Trigger audio cues
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('whistle', 1.0);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('crowd', previousPhase === null || view.crashAge > 1500);
      audio.fx('boo', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('whoosh', 0.8);
        spawnFlag(4 + milestoneIndex * 2, view.currentX100);
      }
    }

    // Passive flag tosses while running
    if (running && Math.random() < 0.18 + tension * 0.25) {
      spawnFlag(1, view.currentX100);
      if (Math.random() < 0.3) audio.fx('yeet', 0.3 + 0.4 * tension);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. Draw Field & Stadium
    drawField(ctx, view.elapsed, tension);

    // 2. Draw Referee on turf
    drawRef(ctx, view.elapsed, tension, crashed);

    // 3. Draw hurled penalty flags
    drawFlags(ctx, view.elapsed);

    // 4. Jumbotron HUD
    drawJumbotron(ctx, view, tension);

    // 5. Crash Avalanche Overlay
    if (crashed) {
      const avalancheProgress = clamp01(crashAgeSec / 0.6);
      ctx.fillStyle = `rgba(255, 210, 20, ${0.45 * avalancheProgress})`;
      ctx.fillRect(0, 0, 960, 540);

      // Piles of yellow cloth
      ctx.fillStyle = COLOURS.flagYellow;
      for (let bx = 0; bx < 960; bx += 32) {
        const moundH = Math.sin(bx * 0.02) * 45 + 130 * avalancheProgress;
        ctx.beginPath();
        ctx.arc(bx + 16, 540, moundH, Math.PI, 0);
        ctx.fill();
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '900 58px system-ui, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 12;
      ctx.fillText('BURIED IN FLAGS!', 480, 200);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.fillText('EXCESSIVE WHISTLE BLOWING · YARD LOSS UNLIMITED', 480, 240);
      ctx.restore();
    }

    // 6. Cashout Truck Commercial Overlay
    if (view.cashoutX100 !== null) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(180, 90, 600, 80);
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.strokeRect(180, 90, 600, 80);

      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CUTTING TO COMMERCIAL BREAK!', 480, 126);
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Whistle blown at ${formatX(view.cashoutX100)} · Official review avoided`, 480, 154);
      ctx.restore();
    }

    // 7. Core Central Multiplier Readout
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);
    const passedMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;

    ctx.save();
    ctx.textAlign = 'center';

    // Massive Multiplier
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.accent;
    ctx.fillStyle = multColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 16;
    ctx.font = `900 ${crashed ? 86 : 100}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 290);
    ctx.shadowBlur = 0;

    // Milestone Caption
    const milestoneCaption = passedMilestone ? passedMilestone[1] : (crashed ? 'Flag Avalanche On Field' : 'Flurry of yellow laundry incoming...');
    const passedX = passedMilestone ? passedMilestone[0] : 100;
    ctx.font = popFont(700, 22, pop(passedX));
    ctx.fillStyle = COLOURS.textLight;
    ctx.fillText(milestoneCaption, 480, 335);

    // Stake line
    const [lineText, lineCol] = stakeLine(view);
    const cashoutPopTarget = view.cashoutX100 !== null ? view.cashoutX100 : 100;
    ctx.font = popFont(700, 21, view.cashoutX100 !== null ? pop(cashoutPopTarget) : 0);
    ctx.fillStyle = lineCol;
    ctx.fillText(lineText, 480, 514);

    // Game Title Badge
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('FALLEN REF FLAG', 480, 95);

    ctx.restore();

    ctx.restore();
  }

  return { draw };
}
