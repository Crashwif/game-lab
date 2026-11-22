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
  bg: '#0c1017',
  monitorRim: '#1e2430',
  browserHeader: '#1e293b',
  tabActive: '#334155',
  tabOther: '#1f293d',
  addressBar: '#0f172a',
  accent: '#38bdf8',
  ramGood: '#22c55e',
  ramWarn: '#eab308',
  ramDanger: '#ef4444',
  crashed: '#f43f5e',
  cashedOut: '#4ade80',
  text: '#f8fafc',
  muted: '#94a3b8',
  bsod: '#0078d7',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Tabs shrink until favicons overlap'],
  [150, 'Five background auto-play videos start'],
  [200, 'CPU fan begins emitting high pitch whine'],
  [250, 'Cursor turns into an eternal spinning wheel'],
  [300, 'Task manager itself stops responding'],
  [500, 'Thermal smoke puffs out of the USB ports'],
  [1000, 'Swap memory spills over into smart fridge'],
  [10000, 'Motherboard traces glow incandescent neon orange'],
  [100000, 'RAM chips achieve temporary sentience and weep'],
  [1000000, 'Quantum entanglement crash halts global internet'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`SAVED BOOKMARKS AT ${formatX(view.cashoutX100)} · BACKUP SECURED`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'SESSION LOST · SPECTATOR MODE' : 'BROWSING IN INCOGNITO · NO CREDITS AT STAKE', COLOURS.muted];
  }
  if (crashed) return [`128GB RAM DUMPED · LOST ${credits(view.stake)}`, COLOURS.crashed];
  return [`TABS MULTIPLYING · ${credits(view.stake)} ON THE LINE`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'scratch' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastTabTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('scratch', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 1.0);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('notify', 0.7);
      }
      const tabStep = Math.floor(view.elapsed / Math.max(80, 450 - tension * 350));
      if (tabStep > lastTabTick && view.cashoutX100 === null) {
        audio.fx('click', 0.25 + 0.5 * tension);
        lastTabTick = tabStep;
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shakeMag = crashed ? 14 * clamp01(1 - crashAgeSec / 0.7) : (running ? tension * 2.8 : 0);
    const shakeX = shakeMag * Math.sin(now * 0.05);
    const shakeY = shakeMag * Math.cos(now * 0.07);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Desktop background & workspace
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Subtle desktop grid lines
    ctx.strokeStyle = '#151d2c';
    ctx.lineWidth = 1;
    for (let x = 0; x < 960; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = 0; y < 540; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Thermal smoke pouring from tower vent (right side)
    if (running || crashed) {
      const smokeCount = Math.floor(12 * tension) + (crashed ? 10 : 0);
      for (let i = 0; i < smokeCount; i++) {
        const sTime = (now * 0.002 + i * 0.8) % 3;
        const sx = 870 + Math.sin(sTime * 4 + i) * (20 + 20 * tension);
        const sy = 480 - sTime * 140;
        const sr = 12 + sTime * 28;
        const alpha = Math.max(0, (1 - sTime / 3) * (0.15 + tension * 0.4));
        ctx.fillStyle = tension > 0.7 ? `rgba(255, 120, 50, ${alpha * 0.6})` : `rgba(180, 190, 210, ${alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Browser Window Frame
    const winX = 60;
    const winY = 40;
    const winW = 840;
    const winH = 430;

    ctx.fillStyle = COLOURS.browserHeader;
    ctx.beginPath();
    ctx.roundRect(winX, winY, winW, winH, 12);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Browser window controls
    const dotColors = ['#ef4444', '#f59e0b', '#10b981'];
    dotColors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(winX + 22 + i * 18, winY + 20, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Tab Bar with escalating micro-tabs
    const tabAreaX = winX + 85;
    const tabAreaW = winW - 100;
    const tabAreaY = winY + 10;
    const tabH = 24;

    const baseTabs = 6;
    const extraTabs = Math.min(60, Math.floor(tension * 55));
    const totalTabs = baseTabs + extraTabs;
    const tabWidth = Math.max(9, tabAreaW / totalTabs);

    for (let i = 0; i < totalTabs; i++) {
      const tx = tabAreaX + i * tabWidth;
      const isActive = i === totalTabs - 1;
      ctx.fillStyle = isActive ? COLOURS.accent : (i % 2 === 0 ? COLOURS.tabActive : COLOURS.tabOther);
      ctx.beginPath();
      ctx.roundRect(tx, tabAreaY, tabWidth - 2, tabH, [5, 5, 0, 0]);
      ctx.fill();

      // Audio badge pulsing on overflowing tabs
      if (tension > 0.2 && i % 4 === 1 && tabWidth > 14) {
        ctx.fillStyle = Math.sin(now * 0.02 + i) > 0 ? '#f43f5e' : '#fbbf24';
        ctx.fillRect(tx + tabWidth - 8, tabAreaY + 6, 4, 10);
      }
    }

    // URL Address Bar & System Stats
    ctx.fillStyle = COLOURS.addressBar;
    ctx.beginPath();
    ctx.roundRect(winX + 16, winY + 42, winW - 32, 34, 6);
    ctx.fill();

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('🔒 https://tabs.infiniti.ram/overload/instance_id=' + Math.floor(view.elapsed / 200), winX + 30, winY + 64);

    // RAM usage calculation
    const ramPct = Math.min(999, Math.floor(10 + tension * 120 + depth * 350));
    const ramGb = (12.8 * (view.currentX100 / 100)).toFixed(1);
    const ramColor = ramPct > 100 ? COLOURS.ramDanger : (ramPct > 75 ? COLOURS.ramWarn : COLOURS.ramGood);
    ctx.fillStyle = ramColor;
    ctx.textAlign = 'right';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillText(`RAM USED: ${ramGb}GB / 128GB (${ramPct}%)`, winX + winW - 30, winY + 64);

    // Browser Viewport Content
    const vpX = winX + 16;
    const vpY = winY + 84;
    const vpW = winW - 32;
    const vpH = winH - 96;

    ctx.fillStyle = '#080d16';
    ctx.beginPath();
    ctx.roundRect(vpX, vpY, vpW, vpH, 6);
    ctx.fill();

    // Central Visual: Panicked Dev + Overheated Monitor Glow
    const centerX = 480;
    const centerY = vpY + 110;

    // Heat glow behind developer
    const glowGradient = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, 190);
    const glowAlpha = 0.15 + tension * 0.55;
    glowGradient.addColorStop(0, tension > 0.6 ? `rgba(239, 68, 68, ${glowAlpha})` : `rgba(56, 189, 248, ${glowAlpha})`);
    glowGradient.addColorStop(1, 'rgba(8, 13, 22, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(vpX, vpY, vpW, vpH);

    // Escalating Spinning Cursor Wheel
    if (running && tension > 0.15) {
      const wheelX = 320;
      const wheelY = centerY - 20;
      const spin = now * (0.005 + tension * 0.02);
      ctx.save();
      ctx.translate(wheelX, wheelY);
      ctx.rotate(spin);
      const segs = 6;
      for (let s = 0; s < segs; s++) {
        ctx.fillStyle = ['#38bdf8', '#fbbf24', '#ef4444', '#a855f7', '#22c55e', '#ec4899'][s % 6]!;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 18 + tension * 8, (s * Math.PI * 2) / segs, ((s + 1) * Math.PI * 2) / segs);
        ctx.fill();
      }
      ctx.restore();
    }

    // Panicked Developer Silhouette & Hands
    const jitter = tension * 4 * Math.sin(now * 0.04);
    ctx.fillStyle = '#1e293b';
    // Body / Shoulders
    ctx.beginPath();
    ctx.ellipse(centerX + jitter, centerY + 70, 75, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(centerX + jitter, centerY, 38, 0, Math.PI * 2);
    ctx.fill();

    // Wide panicked eyes
    const eyeSpread = 14;
    const eyeSize = 8 + tension * 6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX + jitter - eyeSpread, centerY - 4, eyeSize, 0, Math.PI * 2);
    ctx.arc(centerX + jitter + eyeSpread, centerY - 4, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Dilated pupils vibrating
    ctx.fillStyle = '#0f172a';
    const pupilJitter = (Math.random() - 0.5) * (tension * 3);
    ctx.beginPath();
    ctx.arc(centerX + jitter - eyeSpread + pupilJitter, centerY - 4, 3, 0, Math.PI * 2);
    ctx.arc(centerX + jitter + eyeSpread + pupilJitter, centerY - 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Gripping hands on head
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(centerX + jitter - 46, centerY - 8, 14, 0, Math.PI * 2);
    ctx.arc(centerX + jitter + 46, centerY - 8, 14, 0, Math.PI * 2);
    ctx.fill();

    // Multiplier Display
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.accent);
    const punch = crashed ? 1 + 0.25 * clamp01(1 - crashAgeSec / 0.3) : 1;
    ctx.font = `800 ${Math.floor(72 * punch)}px ui-monospace, monospace`;
    ctx.shadowColor = crashed ? 'rgba(244, 63, 94, 0.6)' : 'rgba(56, 189, 248, 0.4)';
    ctx.shadowBlur = 18;
    ctx.fillText(formatX(view.currentX100), centerX, centerY + 85);
    ctx.shadowBlur = 0;

    // Milestone / Status banner
    const currentMilestoneIndex = milestone - 1;
    const milestoneText = running && currentMilestoneIndex >= 0 && MILESTONES[currentMilestoneIndex]
      ? MILESTONES[currentMilestoneIndex][1]
      : (running ? 'System stable... opening more tabs' : (crashed ? 'SYSTEM KERNEL PANIC: MEMORY OVERFLOW' : 'PREPARE SESSION LOAD'));

    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.fillText(milestoneText, centerX, centerY + 138);

    // Cashed out safe state: USB backup dialog
    if (view.cashoutX100 !== null && !crashed) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(centerX - 240, centerY - 70, 480, 110, 10);
      ctx.fill();
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText('💾 BOOKMARKS DUMPED TO NVMe DRIVE!', centerX, centerY - 38);
      ctx.fillStyle = COLOURS.text;
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillText(`Gracefully closed all ${totalTabs} runaway tabs without loss`, centerX, centerY - 6);
    }

    // Crashed state: Cascade error dialogs + Blue Screen of Death
    if (crashed) {
      const popCount = Math.min(8, Math.floor(crashAgeSec * 12) + 1);
      for (let k = 0; k < popCount; k++) {
        const dlgX = 140 + (k * 65) % 400;
        const dlgY = 90 + (k * 42) % 200;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dlgX, dlgY, 260, 120);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(dlgX, dlgY, 260, 120);

        ctx.fillStyle = '#0055ea';
        ctx.fillRect(dlgX + 2, dlgY + 2, 256, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Aw, Snap! Out of Memory', dlgX + 10, dlgY + 18);

        ctx.fillStyle = '#000000';
        ctx.font = '500 13px system-ui, sans-serif';
        ctx.fillText('Error code: STATUS_NO_MEMORY', dlgX + 14, dlgY + 60);
        ctx.fillText('Crash dump written to NVRAM', dlgX + 14, dlgY + 84);
      }

      // BSOD fade in after 0.5s
      if (crashAgeSec > 0.45) {
        const bsodAlpha = clamp01((crashAgeSec - 0.45) / 0.4);
        ctx.fillStyle = `rgba(0, 120, 215, ${bsodAlpha * 0.92})`;
        ctx.fillRect(vpX, vpY, vpW, vpH);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.font = '800 64px system-ui, sans-serif';
        ctx.fillText(':(', vpX + 60, vpY + 90);

        ctx.font = '500 21px system-ui, sans-serif';
        ctx.fillText('Your PC ran out of memory and needs to restart.', vpX + 60, vpY + 140);
        ctx.fillText('Stop code: KERNEL_TAB_EXHAUSTION_CRASH', vpX + 60, vpY + 175);
      }
    }

    // Bottom HUD: Stake & Game Tagline
    const [line, colour] = stakeLine(view);
    ctx.textAlign = 'center';
    ctx.fillStyle = colour;
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText(line, centerX, 508);

    ctx.restore();
  }

  return { draw };
}
