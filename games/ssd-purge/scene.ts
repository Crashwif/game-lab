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
  bgDark: '#080914',
  windowBg: '#131124',
  windowBorder: '#382b6b',
  cyberCyan: '#00f0ff',
  neonPink: '#ff2a85',
  warningOrange: '#ff8400',
  hazardRed: '#ff2d55',
  bsodBlue: '#005bba',
  safeGreen: '#05ffa1',
  textMuted: '#9aa0b8',
  textLight: '#f3f5fd',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'System idle · Insert SSD to begin',
  betting: 'Allocating partition for 210GB preload',
  running: 'DELETING EVERYTHING TO CLEAR DISK SPACE',
  crashed: 'KERNEL PANIC: UNRECOVERABLE DRIVE SLAG',
};

const MILESTONES: [number, string][] = [
  [120, 'Recycle bin emptied for first 15GB'],
  [150, 'Uninstalled all other favorite indie games'],
  [200, 'Deleted high school graduation photos'],
  [250, 'Dumped Windows system32 folder into trash'],
  [300, 'External hard drive starts audibly smoking'],
  [500, 'Formatting USB flash drives in microwave'],
  [1000, "Compressed Grandma's digitized voice memo"],
  [10000, 'Sold soul to cloud storage server racks'],
  [100000, 'Downloading directly into human brain stem'],
  [1000000, 'Local reality deleted to free up 210GB'],
];

const SACRIFICE_FOLDERS = [
  'Tax_Returns_2022',
  'Family_Photos.zip',
  'system32',
  'Homework_Real',
  'grandma_voicemail.wav',
  'wallet_backup.dat',
  'OS_Kernel.sys',
  'Reality_Matrix.dll',
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Ethernet yanked at ${formatX(view.cashoutX100)} · Saved 12KB space!`, COLOURS.safeGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Drive fried · Spectating with safe data' : 'Spectating preload allocation', COLOURS.textMuted];
  }
  if (crashed) return [`Motherboard slagged! ${credits(view.stake)} vanished`, COLOURS.hazardRed];
  return [`Preload active · ${credits(view.stake)} committed`, COLOURS.cyberCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastFxTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('whoosh', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('zap', 1.0);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIndex > prevMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('yeet', 0.8);
      }
      const tickCadence = Math.max(120, 480 - tension * 320);
      if (view.elapsed - lastFxTick > tickCadence && view.cashoutX100 === null) {
        audio.fx('click', 0.35 + 0.5 * tension);
        lastFxTick = view.elapsed;
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.6) : running ? tension * 3.5 * Math.sin(view.elapsed * 0.04) : 0;
    const shakeX = shake * Math.sin(view.elapsed * 0.1);
    const shakeY = shake * Math.cos(view.elapsed * 0.13);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Dark synthwave desktop background
    const bgGrad = ctx.createLinearGradient(0, 0, 960, 540);
    bgGrad.addColorStop(0, '#0c0b1e');
    bgGrad.addColorStop(0.5, '#160f2e');
    bgGrad.addColorStop(1, '#070512');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Synthwave floor grid
    ctx.strokeStyle = `rgba(255, 42, 133, ${0.12 + 0.15 * tension})`;
    ctx.lineWidth = 1;
    const gridHorizon = 380;
    for (let x = -200; x <= 1160; x += 60) {
      ctx.beginPath();
      ctx.moveTo(480 + (x - 480) * 0.1, gridHorizon);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = gridHorizon; y <= 540; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Desktop Application Window: "PRELOAD INSTALLER 2000"
    ctx.fillStyle = COLOURS.windowBg;
    ctx.strokeStyle = COLOURS.windowBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(140, 24, 680, 480, 14);
    ctx.fill();
    ctx.stroke();

    // Window title bar
    ctx.fillStyle = '#1c1836';
    ctx.beginPath();
    ctx.roundRect(140, 24, 680, 38, [14, 14, 0, 0]);
    ctx.fill();
    // Window control dots
    ctx.fillStyle = '#ff5f56';
    ctx.beginPath(); ctx.arc(162, 43, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffbd2e';
    ctx.beginPath(); ctx.arc(180, 43, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#27c93f';
    ctx.beginPath(); ctx.arc(198, 43, 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '700 14px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DISCORDANT PRELOAD WIZARD · 210.00 GB ALLOCATION QUEUE', 220, 48);

    // Gamer Monitor & Sweaty Avatar area
    const charBob = running ? Math.sin(view.elapsed * 0.015) * 4 : 0;
    // Gamer silhouette sitting at desk (right side)
    const gx = 670;
    const gy = 260 + charBob;
    // Head / Sweating face
    ctx.fillStyle = '#fca374';
    ctx.beginPath();
    ctx.arc(gx, gy, 28, 0, Math.PI * 2);
    ctx.fill();
    // Headband / gamer headset
    ctx.fillStyle = COLOURS.cyberCyan;
    ctx.beginPath();
    ctx.arc(gx, gy - 6, 32, Math.PI * 0.8, Math.PI * 0.2);
    ctx.lineWidth = 6;
    ctx.stroke();
    // Headset earcups
    ctx.fillStyle = COLOURS.neonPink;
    ctx.fillRect(gx - 35, gy - 12, 10, 20);
    ctx.fillRect(gx + 25, gy - 12, 10, 20);
    // Panicked eyes
    ctx.fillStyle = '#0b0c16';
    const eyeShock = running ? 2 + tension * 4 : 2;
    ctx.beginPath(); ctx.arc(gx - 10, gy - 2, eyeShock, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 6, gy - 2, eyeShock, 0, Math.PI * 2); ctx.fill();
    // Frantic open mouth
    ctx.beginPath();
    ctx.arc(gx - 2, gy + 12, running ? 5 + tension * 6 : 4, 0, Math.PI);
    ctx.fillStyle = '#941e32';
    ctx.fill();
    // Sweat drops flying
    if (running && tension > 0.15) {
      const dropCount = Math.floor(3 + tension * 6);
      ctx.fillStyle = COLOURS.cyberCyan;
      for (let i = 0; i < dropCount; i++) {
        const dropPhase = (view.elapsed * 0.003 + i * 1.3) % 1;
        const dx = gx + Math.cos(i * 2.1) * (36 + dropPhase * 30);
        const dy = gy + Math.sin(i * 2.1) * (20 + dropPhase * 40);
        ctx.beginPath();
        ctx.arc(dx, dy, 2.5 * (1 - dropPhase), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Animated Flying Folders into Trash Can
    const trashX = 240;
    const trashY = 270;
    // Recycle Bin
    ctx.fillStyle = '#242a42';
    ctx.strokeStyle = COLOURS.cyberCyan;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(trashX - 32, trashY - 26, 64, 60, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLOURS.cyberCyan;
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RECYCLE BIN', trashX, trashY + 46);

    // Flying deleted folder items
    if (running) {
      const folderIdx = Math.floor(view.elapsed / 450) % SACRIFICE_FOLDERS.length;
      const tProgress = (view.elapsed % 450) / 450;
      const fx = gx - 40 + (trashX - (gx - 40)) * tProgress;
      const fy = gy + (trashY - gy) * tProgress - Math.sin(tProgress * Math.PI) * 45;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(tProgress * 4);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(-16, -12, 32, 24);
      ctx.fillStyle = '#d49b00';
      ctx.fillRect(-16, -16, 14, 6);
      ctx.fillStyle = '#080914';
      ctx.font = '600 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const folderName = SACRIFICE_FOLDERS[folderIdx] ?? 'deleted.dat';
      ctx.fillText(folderName.slice(0, 10), 0, 2);
      ctx.restore();
    }

    // Drive Heat / Smokin' Meter
    const driveTemp = Math.floor(42 + tension * 920);
    ctx.fillStyle = '#1c1b30';
    ctx.fillRect(400, 230, 160, 70);
    ctx.strokeStyle = driveTemp > 100 ? COLOURS.hazardRed : COLOURS.cyberCyan;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(400, 230, 160, 70);

    ctx.textAlign = 'center';
    ctx.fillStyle = driveTemp > 100 ? COLOURS.hazardRed : COLOURS.warningOrange;
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillText(`M.2 SSD TEMP: ${driveTemp}°C`, 480, 250);

    // Disk gauge bar
    ctx.fillStyle = '#2d2645';
    ctx.fillRect(415, 260, 130, 12);
    const heatGrad = ctx.createLinearGradient(415, 0, 545, 0);
    heatGrad.addColorStop(0, COLOURS.safeGreen);
    heatGrad.addColorStop(0.5, COLOURS.warningOrange);
    heatGrad.addColorStop(1, COLOURS.hazardRed);
    ctx.fillStyle = heatGrad;
    ctx.fillRect(415, 260, 130 * tension, 12);

    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.textMuted;
    ctx.fillText(driveTemp > 500 ? 'THERMAL RUNAWAY' : 'SECTOR WRITE BURST', 480, 288);

    // Preload Download Progress Bar
    const progY = 328;
    ctx.fillStyle = '#100f20';
    ctx.fillRect(200, progY, 560, 36);
    ctx.strokeStyle = COLOURS.windowBorder;
    ctx.strokeRect(200, progY, 560, 36);

    const fillRatio = Math.min(1, tension * 0.95 + depth * 0.05);
    const barGrad = ctx.createLinearGradient(200, 0, 760, 0);
    barGrad.addColorStop(0, COLOURS.cyberCyan);
    barGrad.addColorStop(1, COLOURS.neonPink);
    ctx.fillStyle = barGrad;
    ctx.fillRect(202, progY + 2, Math.max(8, 556 * fillRatio), 32);

    // Download rate / size labels
    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    const downloadedGb = (210 * fillRatio).toFixed(1);
    ctx.fillText(`DOWNLOADING: ${downloadedGb} GB / 210.0 GB`, 215, progY + 23);
    ctx.textAlign = 'right';
    const mbSpeed = (120 + tension * 890).toFixed(0);
    ctx.fillText(`${mbSpeed} MB/s · WRITE BURST`, 745, progY + 23);

    // Huge Central Multiplier Readout
    ctx.textAlign = 'center';
    const mulY = 145;
    ctx.fillStyle = crashed ? COLOURS.hazardRed : view.cashoutX100 !== null ? COLOURS.safeGreen : COLOURS.cyberCyan;
    ctx.font = '900 78px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, mulY);

    // Current Milestone / Event Subtitle
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const caption = activeMilestone ? activeMilestone[1] : PHASE_LABELS[view.phase];
    ctx.fillStyle = activeMilestone ? COLOURS.warningOrange : COLOURS.textMuted;
    ctx.font = '700 18px ui-monospace, monospace';
    ctx.fillText(caption, 480, 192);

    // Bottom Stake Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 21px ui-monospace, monospace';
    ctx.fillText(lineText, 480, 442);

    // Safe Cashout Overlay
    if (view.cashoutX100 !== null && !crashed) {
      ctx.fillStyle = 'rgba(5, 255, 161, 0.12)';
      ctx.fillRect(140, 24, 680, 480);
      ctx.fillStyle = COLOURS.safeGreen;
      ctx.strokeStyle = '#02422a';
      ctx.lineWidth = 4;
      ctx.font = '900 28px ui-monospace, monospace';
      ctx.strokeText('ETHERNET CABLE YANKED! 12 KB DRIVE SPACE SAVED!', 480, 84);
      ctx.fillText('ETHERNET CABLE YANKED! 12 KB DRIVE SPACE SAVED!', 480, 84);
    }

    // Crashed Blue Screen of Death (BSOD) / Slag Overlap
    if (crashed) {
      const bsodFade = clamp01(crashSec / 0.15);
      ctx.fillStyle = `rgba(0, 91, 186, ${0.9 * bsodFade})`;
      ctx.beginPath();
      ctx.roundRect(140, 24, 680, 480, 14);
      ctx.fill();

      // BSOD Sad smiley & text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = '900 72px system-ui, sans-serif';
      ctx.fillText(':(', 180, 120);

      ctx.font = '700 24px system-ui, sans-serif';
      ctx.fillText('Your PC ran into a problem and melted into slag.', 180, 175);

      ctx.font = '500 16px ui-monospace, monospace';
      ctx.fillText('Stop Code: KERNEL_PURGE_OUT_OF_SPACE_ERROR', 180, 220);
      ctx.fillText('Failed Component: Kingston_NVMe_Drive_Smoldering.sys', 180, 245);
      ctx.fillText(`Drive Wiped at: ${formatX(view.currentX100)} multiplier limit`, 180, 270);
      ctx.fillText('Grandma audio memo & high school photos: GONE FOREVER', 180, 295);

      // Comical QR Code representation
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(180, 330, 80, 80);
      ctx.fillStyle = '#005bba';
      ctx.fillRect(190, 340, 24, 24);
      ctx.fillRect(226, 340, 24, 24);
      ctx.fillRect(190, 376, 24, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 14px system-ui, sans-serif';
      ctx.fillText('For more info on buying new motherboards, visit:', 280, 365);
      ctx.fillText('crashwif.lab/unrecoverable-slag', 280, 390);

      // Sparks flying off the slagged drive
      if (crashSec < 1.4) {
        ctx.fillStyle = '#ffec40';
        for (let s = 0; s < 16; s++) {
          const spAngle = s * 0.4 + crashSec * 5;
          const spDist = 30 + crashSec * 220;
          const sx = 480 + Math.cos(spAngle) * spDist;
          const sy = 260 + Math.sin(spAngle) * spDist;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1, 4 * (1 - crashSec / 1.4)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  return { draw };
}
