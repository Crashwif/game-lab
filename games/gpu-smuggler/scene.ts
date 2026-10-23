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
  [120, 'TSA agent squints at suspicious coat bulge'],
  [150, 'Cooling fans spin up with audible high whine'],
  [200, 'Thermal paste leaks through front pocket seam'],
  [250, 'Metal detector wand screams at maximum volume'],
  [300, 'Airport sniffer beagle starts barking madly'],
  [500, 'RGB glow shines through trench coat buttons'],
  [1000, 'Internal heatsinks hit supercritical 98C'],
  [10000, 'Customs supervisor unholsters megaphone'],
  [100000, 'TSA conveyor belt catches spontaneous fire'],
  [1000000, 'Smuggled rig achieves rogue sentient AGI'],
];

const COLOURS = {
  bg: '#0d111b',
  floor: '#161c2b',
  archMetal: '#3a475d',
  neonRed: '#ff2255',
  neonAmber: '#ffaa00',
  neonCyan: '#00f3ff',
  neonGreen: '#39ff14',
  coat: '#2b313d',
  skin: '#ffd4a3',
  text: '#ffffff',
  muted: '#8b9bb4',
  alert: '#ff3344',
  gold: '#ffcf33',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Cashed out at ${formatX(view.cashoutX100)} · Illicit tensor cores secured!`, COLOURS.neonGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Busted at customs · spectator' : 'Watching checkpoint · no cargo risked', COLOURS.muted];
  }
  if (crashed) return [`Thermal meltdown tackled! Lost ${credits(view.stake)}`, COLOURS.neonRed];
  return [`Smuggling rig loaded · ${credits(view.stake)} committed`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastBeepSec = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (prevPhase !== null && running && cashedOut && prevCashout === null) audio.cashout();
    if (crashed && prevPhase !== 'crashed') audio.crash('siren', prevPhase === null || view.crashAge > 1500);
    if (running && prevPhase === 'running' && milestoneCount > prevMilestone) audio.milestone(milestoneCount);

    const nowSec = now / 1000;
    const beepInterval = Math.max(0.12, 0.7 - 0.55 * tension);
    if (running && !cashedOut && nowSec - lastBeepSec > beepInterval) {
      lastBeepSec = nowSec;
      audio.fx('beep', 0.2 + 0.6 * tension);
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneCount;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.8) : tension * 2;
    const shakeX = (Math.sin(now * 0.05) + Math.cos(now * 0.033)) * shake;
    const shakeY = (Math.cos(now * 0.04) + Math.sin(now * 0.027)) * shake;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Terminal Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#0a0d17');
    bgGrad.addColorStop(0.65, '#131b2e');
    bgGrad.addColorStop(1, COLOURS.floor);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Terminal perspective tiles
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = -200; x <= 1160; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 340);
      ctx.lineTo(480 + (x - 480) * 2.2, 540);
      ctx.stroke();
    }
    for (let y = 350; y < 540; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Overhead Departure Sign
    ctx.fillStyle = '#060a12';
    ctx.strokeStyle = '#22324c';
    ctx.lineWidth = 2;
    ctx.fillRect(260, 16, 440, 50);
    ctx.strokeRect(260, 16, 440, 50);
    ctx.fillStyle = '#ffb300';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CUSTOMS CHECKPOINT B4 ✈ DIRECT TO ZERO-TAX COLO', 480, 36);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('WARNING: ALL ACCELERATOR HARDWARE MUST BE DECLARED', 480, 54);

    // Metal Detector Arch
    const archGlow = crashed
      ? COLOURS.neonRed
      : tension > 0.6
      ? COLOURS.neonRed
      : tension > 0.25
      ? COLOURS.neonAmber
      : COLOURS.neonGreen;

    ctx.strokeStyle = '#263347';
    ctx.lineWidth = 26;
    ctx.strokeRect(330, 90, 300, 350);

    // Arch detection sensor light bars
    ctx.shadowBlur = 15;
    ctx.shadowColor = archGlow;
    ctx.fillStyle = archGlow;
    const pulseAlpha = 0.5 + 0.5 * Math.sin(now * (running ? 0.015 + tension * 0.02 : 0.004));
    ctx.globalAlpha = pulseAlpha;
    ctx.fillRect(322, 100, 12, 330);
    ctx.fillRect(626, 100, 12, 330);
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;

    // Conveyor Belt on the right
    ctx.fillStyle = '#1d2535';
    ctx.fillRect(660, 340, 280, 50);
    ctx.fillStyle = '#111622';
    for (let i = 0; i < 7; i++) {
      const bx = 670 + i * 40 - ((now * 0.08) % 40);
      if (bx > 660 && bx < 930) ctx.fillRect(bx, 345, 8, 40);
    }

    // Heat Distortion & Steam
    if (running && tension > 0.15 && !cashedOut) {
      ctx.save();
      const steamCount = Math.floor(tension * 18);
      for (let s = 0; s < steamCount; s++) {
        const sx = 440 + Math.sin(s * 7 + now * 0.005) * 60;
        const sy = 340 - ((now * 0.1 + s * 30) % 180);
        ctx.fillStyle = 'rgba(255, 120, 50, 0.18)';
        ctx.beginPath();
        ctx.arc(sx, sy, 8 + (340 - sy) * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Protagonist (The GPU Smuggler)
    const smugglerX = cashedOut ? Math.min(880, 480 + (nowSec * 320) % 450) : 480;
    const smugglerY = cashedOut ? 330 : 340;
    const coatBulge = 18 + tension * 42;
    const coatBreath = Math.sin(now * 0.008) * 4;

    ctx.save();
    ctx.translate(smugglerX, smugglerY);

    if (cashedOut) {
      // Cashed Out Celebration Pose: riding conveyor belt sliding safely!
      ctx.fillStyle = COLOURS.coat;
      ctx.beginPath();
      ctx.ellipse(0, -10, 48, 25, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Glowing bagged GPUs
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.fillRect(-20, -32, 35, 20);
      ctx.fillStyle = '#053';
      ctx.font = '900 11px monospace';
      ctx.fillText('H100', -3, -18);
      // Head & sunglasses
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.arc(38, -25, 16, 0, Math.PI * 2);
      ctx.fill();
      // Cool black shades
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(36, -30, 18, 8);
      // Thumbs up
      ctx.fillStyle = COLOURS.skin;
      ctx.fillRect(20, -45, 8, 14);
      ctx.fillText('👍', 24, -48);
    } else if (crashed) {
      // Crashed State: Blown trench coat, smoke, flying cards
      const blow = Math.min(1, crashAgeSec * 3);
      ctx.fillStyle = 'rgba(255, 60, 20, 0.85)';
      ctx.beginPath();
      ctx.arc(0, -50, 55 * blow, 0, Math.PI * 2);
      ctx.fill();

      // Blown coat wings
      ctx.fillStyle = '#1c1f26';
      ctx.beginPath();
      ctx.moveTo(-60 * blow, 20);
      ctx.lineTo(-80 * blow, -70);
      ctx.lineTo(-20, -50);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(60 * blow, 20);
      ctx.lineTo(80 * blow, -70);
      ctx.lineTo(20, -50);
      ctx.fill();

      // Dislodged GPUs and smoking heatsinks
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-35 - blow * 40, -40, 24, 14);
      ctx.fillRect(15 + blow * 45, -60, 28, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 10px monospace';
      ctx.fillText('RTX', -23 - blow * 40, -30);
      ctx.fillText('A100', 29 + blow * 45, -48);

      // Charred / shocked smuggler head
      ctx.fillStyle = '#685954';
      ctx.beginPath();
      ctx.arc(0, -95, 20, 0, Math.PI * 2);
      ctx.fill();
      // X eyes
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeText('×  ×', 0, -92);
    } else {
      // Bulky trench coat
      ctx.fillStyle = COLOURS.coat;
      ctx.beginPath();
      ctx.ellipse(0, -40, 36 + coatBulge * 0.45, 55 + coatBreath, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trench coat collar & lapels
      ctx.fillStyle = '#1e232d';
      ctx.beginPath();
      ctx.moveTo(-25, -90);
      ctx.lineTo(0, -45);
      ctx.lineTo(25, -90);
      ctx.lineTo(0, -78);
      ctx.fill();

      // GPU Cooling Fans spinning through coat slits
      const fanAngle = now * (0.02 + tension * 0.08);
      for (const fx of [-22, 22]) {
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(fx, -32, 16, 0, Math.PI * 2);
        ctx.fill();

        // RGB Fan Lighting
        const hue = (now * 0.2 + fx * 4) % 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 55%)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx, -32, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Blades
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        for (let b = 0; b < 3; b++) {
          const a = fanAngle + (b * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.moveTo(fx, -32);
          ctx.lineTo(fx + Math.cos(a) * 12, -32 + Math.sin(a) * 12);
          ctx.stroke();
        }
      }

      // Smuggler Head & Nervous Sweating Face
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.arc(0, -96, 20, 0, Math.PI * 2);
      ctx.fill();

      // Black bucket hat / founder cap
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(0, -108, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-18, -122, 36, 16);

      // Nervous sweat drops
      if (tension > 0.2) {
        ctx.fillStyle = '#38bdf8';
        const sweatY = -92 + ((now * 0.08) % 18);
        ctx.beginPath();
        ctx.arc(17, sweatY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shifty nervous eyes looking sideways
      const eyeShift = Math.sin(now * 0.007) * 3;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11, -99, 7, 6);
      ctx.fillRect(4, -99, 7, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-9 + eyeShift, -98, 4, 4);
      ctx.fillRect(6 + eyeShift, -98, 4, 4);
    }
    ctx.restore();

    // Thermal Gauge HUD (top-right)
    const tempC = Math.min(105, 42 + Math.floor(tension * 62));
    ctx.fillStyle = 'rgba(10, 16, 26, 0.88)';
    ctx.strokeStyle = tempC > 90 ? COLOURS.neonRed : COLOURS.neonCyan;
    ctx.lineWidth = 2;
    ctx.fillRect(720, 24, 215, 62);
    ctx.strokeRect(720, 24, 215, 62);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('INTERNAL DIE TEMP', 734, 42);
    ctx.fillStyle = tempC > 90 ? COLOURS.neonRed : tempC > 75 ? COLOURS.neonAmber : COLOURS.neonGreen;
    ctx.font = '700 24px ui-monospace, monospace';
    ctx.fillText(`${tempC}°C`, 734, 70);

    // Mini heatbar
    ctx.fillStyle = '#223046';
    ctx.fillRect(810, 52, 110, 14);
    const barW = clamp01((tempC - 40) / 65) * 106;
    ctx.fillStyle = tempC > 90 ? COLOURS.neonRed : tempC > 75 ? COLOURS.neonAmber : COLOURS.neonCyan;
    ctx.fillRect(812, 54, barW, 10);

    // Center HUD Multiplier & Status
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const multColor = crashed
      ? COLOURS.neonRed
      : cashedOut
      ? COLOURS.neonGreen
      : depth > 0.6
      ? COLOURS.neonAmber
      : '#ffffff';

    ctx.fillStyle = multColor;
    ctx.shadowBlur = running ? 20 * tension : 0;
    ctx.shadowColor = multColor;
    ctx.font = '800 78px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 206);
    ctx.shadowBlur = 0;

    // Milestone ticker / story headline
    const passed = running ? MILESTONES[milestoneCount - 1] : undefined;
    const headline = cashedOut
      ? '🎉 CLEAR OF CUSTOMS! TAX-FREE COMPUTE DELIVERED!'
      : crashed
      ? '💥 THERMAL RUNAWAY MELTDOWN · TSA INTERCEPT!'
      : passed?.[1] ?? (running ? 'Approaching detector arch...' : 'Pre-flight check in progress');

    ctx.fillStyle = cashedOut ? COLOURS.neonGreen : crashed ? COLOURS.neonRed : COLOURS.muted;
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText(headline, 480, 458, 880);

    // Player stake line
    const [line, color] = stakeLine(view);
    ctx.fillStyle = color;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(line, 480, 495, 880);

    ctx.restore();
  }

  return { draw };
}
