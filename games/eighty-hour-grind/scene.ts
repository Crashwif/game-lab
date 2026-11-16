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
  bgDark: '#080c16',
  bgRoom: '#111828',
  deskMetal: '#1f293d',
  deskSurface: '#2d3b55',
  screenGlow: '#22d3ee',
  alarmRed: '#ff2d55',
  badgeGold: '#fbbf24',
  uniformBlue: '#1e3a8a',
  guardSkin: '#f8d5b4',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#38bdf8',
  crashed: '#fb7185',
  cashedOut: '#4ade80',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Graveyard shift starts soon · Prep the thermos',
  betting: 'Punch timecard to start the grind',
  running: 'Graveyard shift in progress',
  crashed: 'Shift collapse · Passed out cold',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First thermos emptied, blinking past yawn'],
  [150, 'Double punch-in registered across two jobs'],
  [200, 'CCTV screens display 16 simultaneous feeds'],
  [250, 'Energy drink tower hits four cans high'],
  [300, 'Eyes taped open with company masking tape'],
  [500, 'Hallway shadow puppet routine begins'],
  [1000, 'Clock dial spins backwards from sheer fatigue'],
  [10000, 'Guard ascends to astral plane of pure overtime'],
  [100000, 'Timecard machine starts spewing paper ribbon'],
  [1000000, 'Immortal midnight shift legend unlocked'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Swiped out at ${formatX(view.cashoutX100)} · Overtime check secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Guard collapsed · You were just observing' : 'Spectating security desk · No shift clocked in', COLOURS.muted];
  }
  if (crashed) return [`Lost ${credits(view.stake)} · Forehead hit the emergency keyboard`, COLOURS.crashed];
  return [`Clocked in · ${credits(view.stake)} overtime riding`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastGulpTime = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('door', 0.8);
      audio.fx('kaching', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.9);
      audio.fx('clang', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('beep', 0.7);
      }
      if (now - lastGulpTime > 2800 - tension * 1600 && !cashed) {
        audio.fx('glug', 0.35 + tension * 0.4);
        lastGulpTime = now;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;
    const shakeX = shake * Math.sin(crashAgeSec * 65);
    const shakeY = shake * Math.cos(crashAgeSec * 73);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Room Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgDark);
    bgGrad.addColorStop(1, COLOURS.bgRoom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Wall Grid Lines / Tile perspective
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 40; x < 960; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 380);
      ctx.stroke();
    }

    // 2. CCTV Bank on Wall
    const cctvCount = running ? Math.min(8, 3 + Math.floor(tension * 5)) : 3;
    const screenWidth = 92;
    const screenHeight = 64;
    const startX = 60;
    const screenY = 46;

    for (let i = 0; i < 8; i++) {
      const active = i < cctvCount;
      const sx = startX + (i % 4) * (screenWidth + 14);
      const sy = screenY + Math.floor(i / 4) * (screenHeight + 12);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx, sy, screenWidth, screenHeight);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, screenWidth, screenHeight);

      if (active) {
        const flicker = 0.5 + 0.5 * Math.sin(now * 0.01 + i * 2);
        const screenGrad = ctx.createLinearGradient(sx, sy, sx, sy + screenHeight);
        screenGrad.addColorStop(0, crashed ? `rgba(255, 45, 85, ${0.35 * flicker})` : `rgba(34, 211, 238, ${0.15 + tension * 0.2})`);
        screenGrad.addColorStop(1, crashed ? 'rgba(120, 10, 30, 0.6)' : 'rgba(15, 23, 42, 0.8)');
        ctx.fillStyle = screenGrad;
        ctx.fillRect(sx + 2, sy + 2, screenWidth - 4, screenHeight - 4);

        // Scan lines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        for (let row = sy + 4; row < sy + screenHeight; row += 4) {
          ctx.fillRect(sx + 2, row, screenWidth - 4, 1);
        }

        // Tiny CCTV HUD
        ctx.fillStyle = crashed ? '#ff8da1' : '#67e8f9';
        ctx.font = '700 8px ui-monospace, monospace';
        ctx.fillText(`CAM 0${i + 1}`, sx + 6, sy + 12);
        ctx.fillText(crashed ? 'ALARM' : 'REC', sx + screenWidth - 22, sy + 12);
      }
    }

    // 3. Shift Clock on the Wall (Right side)
    const clockX = 860;
    const clockY = 90;
    const clockR = 42;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.alarmRed : '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Clock Face & Hands
    const spinDir = view.currentX100 >= 1000 ? -1 : 1;
    const handSpeed = running ? (view.elapsed * 0.006 * (1 + tension * 7) * spinDir) : now * 0.001;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + Math.cos(handSpeed) * 28, clockY + Math.sin(handSpeed) * 28);
    ctx.stroke();

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + Math.cos(handSpeed * 0.1) * 18, clockY + Math.sin(handSpeed * 0.1) * 18);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(clockX, clockY, 3, 0, Math.PI * 2);
    ctx.fill();

    // 4. Overtime Security Desk (Foreground)
    const deskY = 360;
    ctx.fillStyle = COLOURS.deskMetal;
    ctx.beginPath();
    ctx.moveTo(0, deskY);
    ctx.lineTo(960, deskY);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.fill();

    ctx.fillStyle = COLOURS.deskSurface;
    ctx.fillRect(0, deskY, 960, 16);

    // Blinking console lights on desk
    for (let c = 0; c < 12; c++) {
      const ledX = 60 + c * 48;
      const ledOn = crashed ? Math.sin(now * 0.02 + c) > 0 : Math.sin(now * 0.004 + c * 1.5) > -0.2;
      ctx.fillStyle = crashed ? (ledOn ? '#ef4444' : '#450a0a') : (ledOn ? '#22c55e' : '#14532d');
      ctx.beginPath();
      ctx.arc(ledX, deskY + 32, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Energy Drink Can Tower (Left Desk)
    const cansCount = Math.min(6, 1 + Math.floor(tension * 4.5));
    for (let can = 0; can < cansCount; can++) {
      const cx = 130 + (can % 2) * 28;
      const cy = deskY - 14 - Math.floor(can / 2) * 36;
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(cx - 10, cy - 24, 20, 30);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(cx - 10, cy - 14, 20, 8);
      ctx.fillStyle = '#0284c7';
      ctx.font = '900 7px sans-serif';
      ctx.fillText('⚡VOLT', cx, cy - 8);
    }

    // Giant Neon Thermos Mug
    const mugX = 230;
    const mugY = deskY - 26;
    ctx.fillStyle = '#10b981';
    ctx.fillRect(mugX - 16, mugY - 32, 32, 42);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.strokeRect(mugX - 16, mugY - 32, 32, 42);
    // Mug handle
    ctx.beginPath();
    ctx.arc(mugX - 16, mugY - 12, 10, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    // Neon glow on mug
    ctx.fillStyle = '#ecfdf5';
    ctx.font = '800 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COFFEE', mugX, mugY - 12);

    // Steam rising from thermos
    if (running && !crashed) {
      const steamY = mugY - 38 - ((now * 0.03) % 25);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(mugX + Math.sin(now * 0.005) * 4, steamY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Protagonist: Exhausted Security Guard
    const guardBaseX = 480;
    let guardY = 320;
    let headTilt = 0;

    // Sleep nodding behavior when running
    if (running && !cashed) {
      const nodCycle = (view.elapsed * 0.0018) % 3;
      // Head slowly drops for 2.2 seconds then jerks upright
      if (nodCycle < 2.2) {
        headTilt = (nodCycle / 2.2) * 0.22;
      } else {
        headTilt = 0.22 * (1 - (nodCycle - 2.2) / 0.8);
      }
      // Add heavy fatigue jitter at high tension
      headTilt += Math.sin(now * 0.03) * (tension * 0.06);
    }

    if (crashed) {
      // Slumped face-first on the keyboard desk!
      guardY = 345;
      headTilt = Math.PI * 0.45;
    } else if (cashed) {
      // Leaning / celebrating escape toward the exit door
      guardY = 310;
      headTilt = -0.15;
    }

    // Guard Body (Uniform)
    ctx.save();
    ctx.translate(guardBaseX, guardY);

    if (cashed) {
      // Fire Exit celebration glow & door right behind him
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(80, -90, 80, 130);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(84, -86, 72, 122);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px sans-serif';
      ctx.fillText('EXIT ➔', 120, -50);
    }

    // Torso / Navy Shirt
    ctx.fillStyle = COLOURS.uniformBlue;
    ctx.beginPath();
    ctx.roundRect(-42, -40, 84, 82, [14, 14, 0, 0]);
    ctx.fill();

    // Tie
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-6, -34);
    ctx.lineTo(6, -34);
    ctx.lineTo(10, 16);
    ctx.lineTo(0, 30);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.fill();

    // Badges piling on shoulder as multiplier escalates!
    const badgeCount = Math.min(5, 1 + Math.floor(tension * 4.5));
    for (let b = 0; b < badgeCount; b++) {
      ctx.fillStyle = COLOURS.badgeGold;
      ctx.beginPath();
      ctx.arc(-28, -26 + b * 11, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(-28, -26 + b * 11, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Guard Head & Neck
    ctx.rotate(headTilt);

    // Neck
    ctx.fillStyle = COLOURS.guardSkin;
    ctx.fillRect(-12, -56, 24, 20);

    // Head Oval
    ctx.beginPath();
    ctx.ellipse(0, -78, 30, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Security Cap
    ctx.fillStyle = COLOURS.uniformBlue;
    ctx.beginPath();
    ctx.roundRect(-32, -106, 64, 22, [12, 12, 2, 2]);
    ctx.fill();
    // Cap Visor
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(8, -88, 28, 7, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Gold Star on cap
    ctx.fillStyle = COLOURS.badgeGold;
    ctx.beginPath();
    ctx.arc(0, -96, 5, 0, Math.PI * 2);
    ctx.fill();

    // Exhausted Face details
    if (crashed) {
      // Knocked out dizzy face (X X eyes)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      // Eye left
      ctx.beginPath();
      ctx.moveTo(-16, -76); ctx.lineTo(-8, -68);
      ctx.moveTo(-8, -76); ctx.lineTo(-16, -68);
      ctx.stroke();
      // Eye right
      ctx.beginPath();
      ctx.moveTo(6, -76); ctx.lineTo(14, -68);
      ctx.moveTo(14, -76); ctx.lineTo(6, -68);
      ctx.stroke();
    } else if (cashed) {
      // Big happy awake smile & wide relieved eyes
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-11, -74, 4, 0, Math.PI * 2);
      ctx.arc(11, -74, 4, 0, Math.PI * 2);
      ctx.fill();
      // Smile
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -68, 10, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else {
      // Running / Tired guard
      // Dark eye circles (fatigue bags)
      ctx.fillStyle = 'rgba(147, 51, 234, 0.25)';
      ctx.beginPath();
      ctx.ellipse(-11, -70, 9, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(11, -70, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Drooping or Taped Eyelids
      const taped = view.currentX100 >= 300;
      if (taped) {
        // Taped open with yellow masking tape!
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-17, -84, 12, 22);
        ctx.fillRect(5, -84, 12, 22);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-11, -73, 3, 0, Math.PI * 2);
        ctx.arc(11, -73, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Half closed drowsy slits
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-18, -74);
        ctx.quadraticCurveTo(-11, -79 + tension * 4, -4, -74);
        ctx.moveTo(4, -74);
        ctx.quadraticCurveTo(11, -79 + tension * 4, 18, -74);
        ctx.stroke();
      }

      // Small open yawn mouth
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.ellipse(0, -60, 4, 3 + tension * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 6. Crashed Overlays & Alarm Siren
    if (crashed) {
      // Red spinning emergency alarm flash
      const alarmFlash = Math.sin(crashAgeSec * 16);
      if (alarmFlash > 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${0.25 * alarmFlash})`;
        ctx.fillRect(0, 0, 960, 540);
      }

      // Keyboard flying keys / sparkles
      const burstAge = Math.min(1, crashAgeSec / 0.6);
      ctx.fillStyle = '#f8fafc';
      for (let k = 0; k < 10; k++) {
        const kAngle = (k / 10) * Math.PI * 2;
        const kDist = 60 + burstAge * 140;
        const kx = 480 + Math.cos(kAngle) * kDist;
        const ky = 360 + Math.sin(kAngle) * (kDist * 0.4);
        ctx.fillRect(kx, ky, 8, 8);
      }

      // Crash Stamp
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '900 36px system-ui, sans-serif';
      ctx.fillText('💥 FOREHEAD ALARM TRIGGERED 💥', 480, 290);
    }

    // 7. Timecard Paper Ribbon Spewing (High Multiplier visual)
    if (running && depth > 0.4) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      const ribbonLength = 40 + depth * 110;
      for (let r = 0; r < ribbonLength; r += 10) {
        const rx = 340 + Math.sin((view.elapsed * 0.01) + r * 0.2) * 14;
        const ry = deskY - 10 + r;
        ctx.fillRect(rx, ry, 24, 7);
      }
    }

    // 8. Main HUD Text / Status
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Subtitle
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText('80-HOUR GRIND', 480, 114);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText('Stack graveyard shifts before your eyelids slam shut', 480, 138);

    // Giant Center Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.text);
    ctx.fillStyle = multColor;
    const punchScale = crashed ? Math.max(1, 1.3 - crashAgeSec * 0.8) : 1;
    ctx.font = `900 ${Math.floor(76 * punchScale)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 204);

    // Milestones and phase captions
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const statusText = activeMilestone ? activeMilestone[1] : PHASE_LABELS[view.phase];

    ctx.fillStyle = activeMilestone ? '#fde047' : COLOURS.muted;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 442, 880);

    // Stake & cashout result bar
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 488, 880);

    ctx.restore();
  }

  return { draw };
}
