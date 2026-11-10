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
  [120, '60 FPS locked, ladder within reach'],
  [150, '120 FPS spike causes light screen jitter'],
  [200, '144 FPS jitter turns into manic rubberbanding'],
  [250, '240hz monitor tears textures in half'],
  [300, 'Spamming spacebar produces loud mechanical clicks'],
  [500, 'Helicopter blades spin backward from desync'],
  [1000, 'Chat spam fills the entire cockpit glass'],
  [10000, 'Uncapped FPS bends 3D ragdoll into pretzel'],
  [100000, 'Speedrun timer turns into cosmic binary static'],
  [1000000, 'Physics engine breaks the space-time continuum'],
];

const COLOURS = {
  bgTop: '#080c14',
  bgBottom: '#1a102a',
  accent: '#00ffcc',
  laser: '#ff0055',
  glitchYellow: '#ffe600',
  crashed: '#ff3366',
  cashedOut: '#39ff14',
  text: '#f0f6fc',
  muted: '#8b9bb4',
  chopper: '#1e293b',
  ladder: '#f59e0b',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`CASHED OUT AT ${formatX(view.cashoutX100)} · MISSION COMPLETE!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Physics shattered · watching spectator' : 'Speedrun in progress · spectating', COLOURS.muted];
  }
  if (crashed) {
    return [`RUNNER FLUNG INTO ORBIT · ${credits(view.stake)} lost to the void`, COLOURS.crashed];
  }
  return [`SPACEBAR SPAM ACTIVE · ${credits(view.stake)} riding`, COLOURS.accent];
}

const CHAT_LOG = [
  'clip it!!',
  'SPACEBAR GO BRRRR',
  'Bro uncapped frames',
  'Physics tick is dying 💀',
  'WR PACE PogChamp',
  'HOLD ON TO THE SKID',
  'RIP V-SYNC',
];

export function createScene(): Scene {
  const audio = pageAudio({ style: 'trap', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastJumpTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    audio.update(view.phase, tension);

    // Audio triggers
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('cheer', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1200);
      audio.fx('yeet', 1.0);
    }
    if (running && previousPhase === 'running' && milestoneIdx > previousMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('beep', 0.7);
    }

    // Spacebar tap sound pacing
    const jumpCycle = Math.floor(view.elapsed / (140 - tension * 80));
    if (running && view.cashoutX100 === null && jumpCycle > lastJumpTick) {
      audio.fx('click', 0.35 + 0.45 * tension);
      lastJumpTick = jumpCycle;
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    // Glitch & camera shake
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shakeAmt = crashed
      ? Math.max(0, 24 * (1 - age / 0.8))
      : (running ? (tension * 8 + depth * 6) : 0);
    const shakeX = (Math.sin(view.elapsed * 0.1) + Math.cos(view.elapsed * 0.17)) * shakeAmt;
    const shakeY = (Math.cos(view.elapsed * 0.13) + Math.sin(view.elapsed * 0.23)) * shakeAmt;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Cyber Skyline & Helipad Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, 1000, 580);

    // Distant city silhouette
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 16; i++) {
      const bx = i * 65 - 20;
      const bh = 140 + ((i * 37) % 110);
      ctx.fillRect(bx, 540 - bh, 55, bh);
      // Windows
      ctx.fillStyle = (i + Math.floor(view.elapsed * 0.002)) % 3 === 0 ? '#1e293b' : '#334155';
      for (let wy = 540 - bh + 15; wy < 460; wy += 22) {
        ctx.fillRect(bx + 12, wy, 8, 10);
        ctx.fillRect(bx + 32, wy, 8, 10);
      }
      ctx.fillStyle = '#0f172a';
    }

    // Rooftop Surface
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(0, 470, 960, 70);
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(0, 468, 960, 3);

    // Helipad Landing Decal [ H ]
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(480, 510, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '900 36px monospace';
    ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('H', 480, 522);

    // 2. Helicopter & Physics Jitter
    const chopperBaseX = 480;
    const chopperHover = Math.sin(view.elapsed * 0.004) * 8;
    const chopperDesyncX = running ? (Math.random() - 0.5) * tension * 12 : 0;
    const chopperDesyncY = running ? (Math.random() - 0.5) * tension * 12 : 0;
    const escapeRise = (view.cashoutX100 !== null) ? Math.min(260, (view.elapsed - 400) * 0.2) : 0;
    const chopperX = chopperBaseX + chopperDesyncX;
    const chopperY = 170 + chopperHover + chopperDesyncY - escapeRise;

    // Main Rotor Blades
    ctx.save();
    ctx.translate(chopperX, chopperY - 26);
    const bladeSpeed = running ? (0.04 + tension * 0.15) : 0.02;
    // Reversal trick at milestone 500+
    const bladeDir = view.currentX100 >= 500 ? -1 : 1;
    const bladeAngle = view.elapsed * bladeSpeed * bladeDir;
    ctx.rotate(bladeAngle);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(-110, -3, 220, 6);
    ctx.restore();

    // Chopper Cockpit & Body
    ctx.fillStyle = COLOURS.chopper;
    ctx.beginPath();
    ctx.ellipse(chopperX, chopperY, 65, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail boom & tail rotor
    ctx.strokeStyle = COLOURS.chopper;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(chopperX + 50, chopperY - 5);
    ctx.lineTo(chopperX + 130, chopperY - 18);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(chopperX + 125, chopperY - 30, 4, 25);

    // Cockpit Glass
    ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.beginPath();
    ctx.ellipse(chopperX - 25, chopperY - 4, 28, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Chopper Skid
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(chopperX - 45, chopperY + 28);
    ctx.lineTo(chopperX + 45, chopperY + 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(chopperX - 25, chopperY + 12);
    ctx.lineTo(chopperX - 25, chopperY + 28);
    ctx.moveTo(chopperX + 25, chopperY + 12);
    ctx.lineTo(chopperX + 25, chopperY + 28);
    ctx.stroke();

    // 3. Cockpit Ladder
    const ladderX = chopperX - 15;
    const ladderTopY = chopperY + 28;
    const ladderBottomY = ladderTopY + 150;
    ctx.strokeStyle = COLOURS.ladder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ladderX - 12, ladderTopY);
    ctx.lineTo(ladderX - 12, ladderBottomY);
    ctx.moveTo(ladderX + 12, ladderTopY);
    ctx.lineTo(ladderX + 12, ladderBottomY);
    for (let ry = ladderTopY + 15; ry < ladderBottomY; ry += 20) {
      ctx.moveTo(ladderX - 12, ry);
      ctx.lineTo(ladderX + 12, ry);
    }
    ctx.stroke();

    // 4. Protagonist (Speedrunner)
    const isEscaped = view.cashoutX100 !== null;
    let runnerX = ladderX;
    let runnerY = 440;
    let legOffset = 0;
    let armRaised = true;

    if (crashed) {
      // Physics tick overflow launches runner into deep space
      const flingSpeed = age * 1600;
      runnerX += flingSpeed * 0.9;
      runnerY -= flingSpeed * 1.3;
      ctx.save();
      ctx.translate(runnerX, runnerY);
      ctx.rotate(age * 25);
      // Pretzel glitch body
      ctx.fillStyle = COLOURS.crashed;
      ctx.fillRect(-15, -30, 30, 45);
      ctx.fillStyle = '#00ffcc';
      ctx.fillRect(-10, -50, 20, 20); // Head
      ctx.restore();
    } else if (isEscaped) {
      // Clinging to ladder skid cleanly!
      runnerX = ladderX;
      runnerY = ladderBottomY - 15;
      legOffset = -15; // Tuck legs
      armRaised = true;
    } else {
      // Spamming spacebar jumps
      const jumpProgress = (view.elapsed % (200 - tension * 100)) / (200 - tension * 100);
      const jumpArc = Math.sin(jumpProgress * Math.PI) * (45 + tension * 45);
      runnerY = 445 - jumpArc;
      runnerX += (Math.random() - 0.5) * (tension * 8);
    }

    if (!crashed) {
      // Runner Body
      ctx.save();
      ctx.translate(runnerX, runnerY);

      // Neon Streamer Headset & Head
      ctx.fillStyle = '#ffe0bd';
      ctx.beginPath();
      ctx.arc(0, -32, 11, 0, Math.PI * 2);
      ctx.fill();

      // Headset
      ctx.strokeStyle = COLOURS.glitchYellow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -32, 13, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLOURS.laser;
      ctx.fillRect(-15, -36, 4, 8);
      ctx.fillRect(11, -36, 4, 8);

      // Torso (Hoodie)
      ctx.fillStyle = isEscaped ? COLOURS.cashedOut : '#3b82f6';
      ctx.fillRect(-10, -20, 20, 26);

      // Arms reaching for ladder rung
      ctx.strokeStyle = '#ffe0bd';
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (armRaised || runnerY < ladderBottomY + 20) {
        ctx.moveTo(-8, -15);
        ctx.lineTo(-12, -45);
        ctx.moveTo(8, -15);
        ctx.lineTo(12, -45);
      } else {
        ctx.moveTo(-8, -15);
        ctx.lineTo(-16, -10);
        ctx.moveTo(8, -15);
        ctx.lineTo(16, -10);
      }
      ctx.stroke();

      // Legs
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(-7, 24 + legOffset);
      ctx.moveTo(6, 6);
      ctx.lineTo(7, 24 + legOffset);
      ctx.stroke();

      ctx.restore();
    }

    // 5. Digital Glitch Screen Tearing (High tension)
    if (running && tension > 0.25) {
      const tearCount = Math.floor(tension * 5);
      ctx.fillStyle = 'rgba(0, 255, 204, 0.12)';
      for (let t = 0; t < tearCount; t++) {
        const ty = ((view.elapsed * 0.7 + t * 93) % 500);
        const th = 4 + (t % 8);
        ctx.fillRect(0, ty, 960, th);
      }
    }

    // 6. Live Chat Spam & FPS Monitor HUD
    // FPS Counter Overlay in Top-Right
    let fpsVal = Math.floor(60 + (view.currentX100 - 100) * 1.8);
    let fpsLabel = `${fpsVal} FPS`;
    if (view.currentX100 >= 1000) fpsLabel = `${Math.floor(fpsVal * 10)} FPS [UNCAPPED]`;
    if (view.currentX100 >= 100000) fpsLabel = 'NaN FPS (TICK OVERFLOW)';
    if (crashed) fpsLabel = '0 FPS (ENGINE CRASHED)';

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = tension > 0.6 ? COLOURS.laser : COLOURS.accent;
    ctx.lineWidth = 1.5;
    ctx.fillRect(720, 20, 220, 52);
    ctx.strokeRect(720, 20, 220, 52);

    ctx.textAlign = 'left';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('STREAM GRAPHICS API:', 732, 40);
    ctx.font = '800 18px ui-monospace, monospace';
    ctx.fillStyle = tension > 0.7 ? COLOURS.laser : COLOURS.accent;
    ctx.fillText(fpsLabel, 732, 60);

    // Stream Chat snippet on the left
    if (view.currentX100 >= 200 && !crashed) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(20, 150, 160, 140);
      ctx.font = '700 12px ui-monospace, monospace';
      ctx.fillStyle = COLOURS.accent;
      ctx.fillText('STREAM CHAT:', 30, 170);
      ctx.font = '500 11px system-ui, sans-serif';
      const offsetChat = Math.floor(view.elapsed / 900) % CHAT_LOG.length;
      for (let c = 0; c < 4; c++) {
        const line = CHAT_LOG[(offsetChat + c) % CHAT_LOG.length] ?? 'spam space!';
        ctx.fillStyle = c === 3 ? COLOURS.glitchYellow : '#cbd5e1';
        ctx.fillText(`> ${line}`, 30, 195 + c * 22);
      }
    }

    // 7. Centerpiece HUD: Title, Multiplier, Milestone & Stake
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Tagline
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('FPS GLITCHOUT', 480, 50);

    ctx.fillStyle = COLOURS.glitchYellow;
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillText('SPAM SPACEBAR · DONT BREAK THE PHYSICS ENGINE', 480, 78);

    // Giant Multiplier Readout
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 ? COLOURS.cashedOut : COLOURS.accent);
    ctx.fillStyle = multColor;
    const multSize = 82 + (crashed ? 10 : 0);
    ctx.font = `900 ${multSize}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 310);

    // Milestone / Phase status
    const passed = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const caption = crashed
      ? 'PHYSICS OVERLOAD · RUNNER EJECTED AT LIGHT SPEED'
      : (passed?.[1] ?? (running ? 'Keep jumping to secure ladder grip' : 'Get ready for next speedrun tick'));

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(caption, 480, 375);

    // Stake line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 412);

    ctx.restore();
  }

  return { draw };
}
