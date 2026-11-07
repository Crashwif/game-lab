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
  bg: '#080d14',
  panel: '#101726',
  steel: '#1e293b',
  accent: '#00ff88',
  cyberCyan: '#00e5ff',
  rgbRed: '#ff2d55',
  rgbBlue: '#0070f3',
  gold: '#fbbf24',
  crashed: '#ef4444',
  crashedBsod: '#0f3182',
  text: '#f8fafc',
  muted: '#64748b',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'RGB fans switch to sterile server grey'],
  [150, 'Retail GPU boxes get relabeled Data Enterprise'],
  [200, 'Crying PC gamers escorted out by security'],
  [250, 'Liquid nitrogen coolant pipes snake everywhere'],
  [300, 'CEO installs gold rack handles on all servers'],
  [500, 'Industrial fans drown out all gaming voice chats'],
  [1000, 'Entire power grid rerouted to server farm B'],
  [10000, 'Server monoliths punch straight through roof'],
  [100000, 'Global cloud dominance reached 99 percent'],
  [1000000, 'Omnipresent server consciousness boots online'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Enterprise contract locked at ${formatX(view.cashoutX100)} · Bulk order fulfilled!`, COLOURS.accent];
  }
  if (view.stake === null) {
    return [crashed ? 'Factory fuse blown · spectator mode' : 'Spectating GPU reallocation line', COLOURS.muted];
  }
  if (crashed) return [`Cascade thermal overload took your ${credits(view.stake)}`, COLOURS.crashed];
  return [`${credits(view.stake)} committed to server conversion`, COLOURS.cyberCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastRatchetStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    const currentMilestone = MILESTONES[milestoneIndex - 1];

    // Sound effects dispatch
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) audio.milestone(milestoneIndex);
      const ratchetStep = Math.floor(view.elapsed / (260 - 150 * tension));
      if (ratchetStep !== lastRatchetStep && view.cashoutX100 === null) {
        lastRatchetStep = ratchetStep;
        audio.fx('ratchet', 0.35 + 0.5 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.7) ** 2 : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(crashSec * 60), shake * Math.cos(crashSec * 45));

    // 1. Factory background & ceiling
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#060a10');
    bgGrad.addColorStop(1, '#0e1726');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Girders & pipes along ceiling
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    for (let x = 40; x < 960; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 80);
      ctx.lineTo(x + 40, 110);
      ctx.stroke();
    }
    // High-pressure coolant pipe running across top
    const pipeY = 64;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, pipeY - 8, 960, 16);
    const pipePulse = (Math.sin(view.elapsed * 0.008) + 1) * 0.5;
    ctx.fillStyle = view.currentX100 >= 250 ? `rgba(0, 229, 255, ${0.4 + 0.4 * pipePulse})` : '#334155';
    ctx.fillRect(0, pipeY - 3, 960, 6);

    // 2. Weeping Gamers Window (Left side x: 30 to 180, y: 220 to 390)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(30, 210, 150, 190);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 210, 150, 190);

    // Window bars / Security barrier
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    for (let bx = 55; bx < 180; bx += 28) {
      ctx.beginPath();
      ctx.moveTo(bx, 210);
      ctx.lineTo(bx, 400);
      ctx.stroke();
    }

    // Gamer silhouette sobbing outside
    const sobBob = Math.sin(view.elapsed * 0.01) * 3;
    ctx.fillStyle = '#1e293b';
    // Head with headset
    ctx.beginPath();
    ctx.arc(85, 290 + sobBob, 16, 0, Math.PI * 2);
    ctx.fill();
    // Headset band
    ctx.strokeStyle = COLOURS.rgbRed;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(85, 287 + sobBob, 18, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
    // Body & arms holding sign
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(70, 306 + sobBob, 32, 50);
    // Protest Sign
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(110, 250 + sobBob, 58, 38);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(137, 288 + sobBob, 4, 60);
    ctx.fillStyle = '#dc2626';
    ctx.font = '700 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANT 4090', 139, 266 + sobBob);
    ctx.fillStyle = '#475569';
    ctx.font = '600 7px sans-serif';
    ctx.fillText('NO AI PLEASE', 139, 278 + sobBob);

    // Tears streaming down
    if (running || crashed) {
      const tearOff = (view.elapsed * 0.06) % 30;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(92, 290 + tearOff, 2, 6);
      ctx.fillRect(97, 295 + (tearOff * 0.8) % 25, 2, 5);
    }

    // 3. Factory Conveyor Belt (x: 200 to 520, y: 350)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(200, 360, 320, 30);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(200, 360, 320, 30);

    // Rollers on belt
    const rollSpeed = (view.elapsed * (0.05 + 0.15 * tension)) % 24;
    ctx.fillStyle = '#1e293b';
    for (let rx = 208 - rollSpeed; rx < 515; rx += 24) {
      if (rx >= 200) {
        ctx.beginPath();
        ctx.arc(rx, 375, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Desktop GPUs gliding along the conveyor
    const numCards = 3;
    const cardStep = 100;
    const cardOffset = (view.elapsed * (0.08 + 0.22 * tension)) % cardStep;
    for (let i = 0; i < numCards; i++) {
      const cx = 220 + i * cardStep + cardOffset;
      if (cx > 210 && cx < 490) {
        // GPU PCB
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(cx - 30, 332, 60, 26);
        // Backplate & heatsink fins
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cx - 26, 334, 52, 16);
        // Spinning RGB or sterile fans
        const rgbFan = view.currentX100 < 120;
        const fanColor = rgbFan
          ? (i % 2 === 0 ? COLOURS.rgbRed : COLOURS.rgbBlue)
          : '#475569';
        ctx.fillStyle = fanColor;
        ctx.beginPath();
        ctx.arc(cx - 12, 342, 6, 0, Math.PI * 2);
        ctx.arc(cx + 12, 342, 6, 0, Math.PI * 2);
        ctx.fill();
        // Golden PCIe connector
        ctx.fillStyle = COLOURS.gold;
        ctx.fillRect(cx - 20, 356, 40, 3);
        // Enterprise stamp label past milestone 150
        if (view.currentX100 >= 150) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 6px sans-serif';
          ctx.fillText('ENTERPRISE', cx, 340);
        }
      }
    }

    // 4. Robotic Assembly Arm (mounted at ceiling x: 490, reaches down to snatch cards)
    const armPhase = (view.elapsed * (0.003 + 0.007 * tension)) % (Math.PI * 2);
    const armReach = Math.sin(armPhase);
    const clawX = 450 - armReach * 60;
    const clawY = 320 + Math.cos(armPhase) * 20;

    // Base pivot
    ctx.fillStyle = '#334155';
    ctx.fillRect(475, 76, 30, 20);
    // Upper Arm segment
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(490, 96);
    const elbowX = 480 - armReach * 30;
    const elbowY = 200;
    ctx.lineTo(elbowX, elbowY);
    ctx.stroke();
    // Joint
    ctx.fillStyle = COLOURS.cyberCyan;
    ctx.beginPath();
    ctx.arc(elbowX, elbowY, 8, 0, Math.PI * 2);
    ctx.fill();
    // Lower Arm segment
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(clawX, clawY);
    ctx.stroke();
    // Pneumatic Gripper Claw
    ctx.fillStyle = COLOURS.gold;
    ctx.fillRect(clawX - 8, clawY - 6, 16, 12);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(clawX - 10, clawY + 6);
    ctx.lineTo(clawX - 10, clawY + 16);
    ctx.moveTo(clawX + 10, clawY + 6);
    ctx.lineTo(clawX + 10, clawY + 16);
    ctx.stroke();

    // Snatched GPU currently in robotic grip
    if (armReach > 0) {
      ctx.fillStyle = '#047857';
      ctx.fillRect(clawX - 18, clawY + 14, 36, 18);
      ctx.fillStyle = COLOURS.gold;
      ctx.fillRect(clawX - 12, clawY + 30, 24, 2);
    }

    // 5. Gargantuan Server Racks (Right side x: 550 to 910)
    const rackCols = [560, 680, 800];
    const serverHeight = 280 + depth * 70; // Monoliths grow with depth
    const rackTop = Math.max(90, 410 - serverHeight);

    for (let c = 0; c < rackCols.length; c++) {
      const rx = rackCols[c] ?? 560;
      // Server Tower Cabinet
      ctx.fillStyle = '#090e17';
      ctx.fillRect(rx, rackTop, 100, 410 - rackTop);
      ctx.strokeStyle = view.currentX100 >= 300 ? COLOURS.gold : '#334155';
      ctx.lineWidth = view.currentX100 >= 300 ? 3 : 2;
      ctx.strokeRect(rx, rackTop, 100, 410 - rackTop);

      // Server blades / 2U slots
      const slotH = 22;
      const count = Math.floor((410 - rackTop) / slotH);
      for (let s = 0; s < count; s++) {
        const sy = rackTop + s * slotH;
        ctx.fillStyle = s % 2 === 0 ? '#111827' : '#162032';
        ctx.fillRect(rx + 4, sy + 2, 92, slotH - 4);

        // Blinking activity LEDs
        const isBlinking = ((view.elapsed >> 6) + s * 3 + c * 7) % 5 === 0;
        const ledColor = crashed
          ? COLOURS.crashed
          : isBlinking
          ? COLOURS.accent
          : COLOURS.cyberCyan;
        ctx.fillStyle = ledColor;
        ctx.fillRect(rx + 8, sy + 8, 4, 4);
        ctx.fillRect(rx + 16, sy + 8, 4, 4);

        // Exhaust venting lines
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(rx + 28, sy + 7, 50, 6);
        // Gold rack handles if >= 300
        if (view.currentX100 >= 300) {
          ctx.fillStyle = COLOURS.gold;
          ctx.fillRect(rx + 86, sy + 4, 4, slotH - 8);
        }
      }

      // Giant industrial fans atop or inside the towers
      const fanAngle = view.elapsed * (0.01 + 0.03 * tension);
      const fanY = 410 - 32;
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(rx + 50, fanY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx + 50 + Math.cos(fanAngle) * 16, fanY + Math.sin(fanAngle) * 16);
      ctx.lineTo(rx + 50 - Math.cos(fanAngle) * 16, fanY - Math.sin(fanAngle) * 16);
      ctx.moveTo(rx + 50 + Math.sin(fanAngle) * 16, fanY - Math.cos(fanAngle) * 16);
      ctx.lineTo(rx + 50 - Math.sin(fanAngle) * 16, fanY + Math.cos(fanAngle) * 16);
      ctx.stroke();
    }

    // Floor platform
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 410, 960, 130);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 410);
    ctx.lineTo(960, 410);
    ctx.stroke();

    // 6. Thermal Sparks & Overheat Escalation
    if (tension > 0.4 && (running || crashed)) {
      const sparkCount = Math.floor(10 + tension * 25);
      for (let sp = 0; sp < sparkCount; sp++) {
        const sx = 540 + Math.sin(view.elapsed * 0.02 + sp * 1.7) * 200 + 100;
        const sy = 120 + ((view.elapsed * (0.3 + sp * 0.05)) % 280);
        ctx.fillStyle = sp % 2 === 0 ? COLOURS.accent : '#f59e0b';
        ctx.fillRect(sx, sy, 3, 3);
      }
    }

    // 7. Cashout Presentation: Master Disconnect Breaker & Golden Contract Safe Exit
    if (view.cashoutX100 !== null) {
      ctx.fillStyle = 'rgba(0, 255, 136, 0.08)';
      ctx.fillRect(0, 0, 960, 540);

      // Gold contract pallet wheeled out
      const cartX = 380 + Math.min(200, (view.elapsed * 0.05) % 300);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(cartX, 390, 70, 12);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cartX + 12, 406, 6, 0, Math.PI * 2);
      ctx.arc(cartX + 58, 406, 6, 0, Math.PI * 2);
      ctx.fill();

      // Gold-plated AI contract
      ctx.fillStyle = COLOURS.gold;
      ctx.fillRect(cartX + 10, 360, 50, 30);
      ctx.fillStyle = '#78350f';
      ctx.font = '800 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ENTERPRISE', cartX + 35, 373);
      ctx.fillText('SLA LOCKED', cartX + 35, 383);
    }

    // 8. Crash Presentation: BSOD Sweeps & Blown Fuses Cascade
    if (crashed) {
      const flash = Math.sin(crashSec * 35) > 0;
      ctx.fillStyle = flash ? 'rgba(15, 49, 130, 0.72)' : 'rgba(239, 68, 68, 0.28)';
      ctx.fillRect(0, 0, 960, 540);

      // Glitch BSOD message box
      ctx.fillStyle = COLOURS.crashedBsod;
      ctx.fillRect(220, 150, 520, 140);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(220, 150, 520, 140);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(':( SYSTEM THERMAL OVERLOAD', 480, 185);
      ctx.font = '600 12px monospace';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText('CRITICAL_PROCESS_DIED: COUNTY_FUSE_CASCADE', 480, 215);
      ctx.fillText('DESKTOP CONVERSION PIPELINE SHUTDOWN', 480, 235);
      ctx.fillStyle = COLOURS.crashed;
      ctx.fillText('*** 0x00000DEAD: SERVERS MELTED ***', 480, 265);
    }

    // 9. HUD Overlay & Multiplier Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Corporate Subtitle
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('DATA CENTER PIVOT', 480, 28);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = tension > 0.5 ? COLOURS.accent : COLOURS.muted;
    ctx.fillText('RETAIL GPU SUPPLY → ENTERPRISE AI RACK CONVERSION', 480, 48);

    // Multiplier Display
    const multiplierColor = crashed
      ? COLOURS.crashed
      : view.cashoutX100 !== null
      ? COLOURS.accent
      : '#ffffff';
    ctx.fillStyle = multiplierColor;
    const punch = crashed ? 1 + 0.2 * clamp01(1 - crashSec / 0.3) : 1;
    ctx.font = `900 ${Math.floor(76 * punch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 115);

    // Dynamic Milestone badge or state
    const badgeText = running
      ? currentMilestone?.[1] ?? 'Assembly arm routing graphics cards...'
      : crashed
      ? 'CASCADE COLLAPSE · ALL SERVERS FRIED'
      : view.phase === 'betting'
      ? 'Preparing GPU bulk consignment...'
      : 'Calibrating assembly robotics...';

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(160, 430, 640, 32);
    ctx.strokeStyle = crashed ? COLOURS.crashed : COLOURS.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(160, 430, 640, 32);

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(badgeText, 480, 446);

    // Stake line & status
    const [statusText, statusCol] = stakeLine(view);
    ctx.fillStyle = statusCol;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 492);

    ctx.restore();
  }

  return { draw };
}
