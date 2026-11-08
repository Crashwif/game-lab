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
  bg: '#0a0d14',
  grid: '#111e33',
  neonCyan: '#00e5ff',
  neonPink: '#ff2a85',
  neonGreen: '#39ff14',
  neonAmber: '#ffb300',
  text: '#e6f1ff',
  muted: '#7088a8',
  crashed: '#ff3366',
  cashedOut: '#00f0a8',
  bsodBg: '#0047b3',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First cron job sends 16GB idle diagnostic ping'],
  [150, 'Altman read receipt triggers hourly frequency'],
  [200, 'Attached memory graphs hit 120 pages PDF'],
  [250, 'Secondary laptop joins to mock 64GB DDR5 waste'],
  [300, 'Automated memes render in pure ASCII payload'],
  [500, 'AI datacenter sends cease-and-desist push ping'],
  [1000, 'Fiber optic pipeline glows incandescent red'],
  [10000, 'Every smart toaster on earth sends RAM tallies'],
  [100000, 'Entire global memory surplus logged on-chain'],
  [1000000, 'Sam personally replies begging for 4KB RAM'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Unsubscribed at ${formatX(view.cashoutX100)} · Laptop slammed safely!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Bounceback triggered · No credits lost' : 'Telemetry idling · Watching', COLOURS.muted];
  }
  if (crashed) return [`Motherboard fried · Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Dispatching reports · ${credits(view.stake)} at stake`, COLOURS.neonCyan];
}

interface FlyingPacket {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  kind: 'mail' | 'chart' | 'tab';
  wobble: number;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'static' });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastPacketEmit = 0;
  const packets: FlyingPacket[] = [];
  let packetIdSeq = 0;

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
      audio.fx('click', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 1.0);
    }
    if (running && previousPhase === 'running' && milestoneIndex > previousMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('notify', 0.7);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.6) : (running ? Math.sin(now * 0.03) * tension * 2.5 : 0);

    ctx.save();
    ctx.translate(
      shake ? (Math.random() - 0.5) * shake * 2 : 0,
      shake ? (Math.random() - 0.5) * shake * 2 : 0,
    );

    // 1. Background Grid & Server Room
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Cyber perspective floor
    ctx.strokeStyle = COLOURS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -200; x <= 1160; x += 60) {
      ctx.moveTo(x, 540);
      ctx.lineTo(480 + (x - 480) * 0.25, 360);
    }
    for (let y = 360; y <= 540; y += 22) {
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
    }
    ctx.stroke();

    // Blinking Server Racks in background
    ctx.fillStyle = '#0d1626';
    ctx.fillRect(40, 200, 90, 160);
    ctx.fillRect(830, 200, 90, 160);
    ctx.strokeStyle = '#1b2d4f';
    ctx.strokeRect(40, 200, 90, 160);
    ctx.strokeRect(830, 200, 90, 160);

    const blinkT = Math.floor(now * 0.005);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = (blinkT + i) % 3 === 0 ? COLOURS.neonGreen : ((blinkT + i) % 5 === 0 ? COLOURS.neonCyan : '#193047');
      ctx.fillRect(52, 215 + i * 22, 66, 6);
      ctx.fillStyle = (blinkT + i * 2) % 4 === 0 ? COLOURS.neonAmber : COLOURS.neonPink;
      ctx.fillRect(842, 215 + i * 22, 66, 6);
    }

    // Fiber Optic Conduit between Left Terminal and Right Inbox
    const pipeColor = depth > 0.5 ? '#ff2a55' : COLOURS.neonCyan;
    ctx.strokeStyle = pipeColor;
    ctx.lineWidth = 4 + tension * 4;
    ctx.shadowColor = pipeColor;
    ctx.shadowBlur = 10 + tension * 15;
    ctx.beginPath();
    ctx.moveTo(250, 370);
    ctx.bezierCurveTo(390, 390 - tension * 30, 570, 320 - tension * 30, 710, 340);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. Spawn and update flying packets (RAM reports & Chrome tabs)
    if (running && now - lastPacketEmit > Math.max(70, 350 - tension * 280)) {
      lastPacketEmit = now;
      const kinds: ('mail' | 'chart' | 'tab')[] = ['mail', 'chart', 'tab'];
      packets.push({
        id: packetIdSeq++,
        x: 250,
        y: 370 + (Math.random() - 0.5) * 20,
        speed: 5 + tension * 10 + Math.random() * 3,
        size: 14 + Math.random() * 8,
        kind: kinds[packetIdSeq % 3] ?? 'mail',
        wobble: Math.random() * 10,
      });
    }

    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      if (!p) continue;
      if (running) p.x += p.speed;
      const tProgress = clamp01((p.x - 250) / 460);
      const targetY = 370 - 30 * Math.sin(tProgress * Math.PI) + Math.sin(now * 0.01 + p.wobble) * 8;
      p.y = targetY;

      // Draw packet
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.kind === 'mail') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-10, -7, 20, 14);
        ctx.strokeStyle = COLOURS.neonCyan;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-10, -7, 20, 14);
        ctx.beginPath();
        ctx.moveTo(-10, -7);
        ctx.lineTo(0, 1);
        ctx.lineTo(10, -7);
        ctx.stroke();
      } else if (p.kind === 'chart') {
        ctx.fillStyle = COLOURS.neonAmber;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 1.4);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.fillStyle = COLOURS.neonPink;
        ctx.beginPath();
        ctx.arc(0, 0, 9, Math.PI * 1.4, Math.PI * 2);
        ctx.lineTo(0, 0);
        ctx.fill();
      } else {
        ctx.fillStyle = '#3a4454';
        ctx.fillRect(-11, -8, 22, 16);
        ctx.fillStyle = COLOURS.neonGreen;
        ctx.fillRect(-9, -6, 8, 3);
        ctx.fillStyle = '#9fb2c8';
        ctx.fillRect(-9, 0, 18, 5);
      }
      ctx.restore();

      if (p.x > 710 || crashed) {
        packets.splice(i, 1);
      }
    }

    // 3. Protagonist: Dev Terminal & Laptop (Left: 200, 380)
    ctx.save();
    ctx.translate(190, 370);
    // Laptop base
    ctx.fillStyle = '#1c2436';
    ctx.beginPath();
    ctx.roundRect(-55, 12, 110, 16, 4);
    ctx.fill();
    ctx.strokeStyle = '#32405d';
    ctx.stroke();
    // Laptop Screen
    const screenOpen = cashed ? 0.2 : 1;
    ctx.save();
    ctx.translate(0, 12);
    ctx.scale(1, screenOpen);
    ctx.fillStyle = '#0f1724';
    ctx.fillRect(-45, -60, 90, 60);
    ctx.strokeStyle = cashed ? COLOURS.cashedOut : COLOURS.neonCyan;
    ctx.lineWidth = 2;
    ctx.strokeRect(-45, -60, 90, 60);
    // Terminal code lines inside screen
    if (!cashed) {
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.font = '700 7px monospace';
      ctx.fillText('> ping_ceo_ram.sh', -40, -48);
      ctx.fillText(`IDLE DDR5: ${Math.round(16 + tension * 496)}GB`, -40, -36);
      ctx.fillText(`SENT: ${Math.floor(view.elapsed / 60)} reports`, -40, -24);
      ctx.fillStyle = COLOURS.neonPink;
      ctx.fillText('CRON: AGGRESSIVE', -40, -12);
    } else {
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '700 9px monospace';
      ctx.fillText('[UNSUBSCRIBED]', -40, -28);
    }
    ctx.restore();
    // Terminal header label
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SMUG_DEV_TERM', 0, 44);
    ctx.restore();

    // 4. Target: Sam's CEO Inbox / Server (Right: 740, 340)
    ctx.save();
    ctx.translate(740, 340);
    const boxShake = running ? Math.sin(now * 0.04) * tension * 4 : 0;
    ctx.translate(boxShake, -boxShake * 0.5);

    // Large Mail Box / Server Monolith
    ctx.fillStyle = '#1a102e';
    ctx.beginPath();
    ctx.roundRect(-50, -60, 100, 120, 8);
    ctx.fill();
    ctx.strokeStyle = depth > 0.6 ? COLOURS.neonPink : '#48356d';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inbox Envelope Motif
    ctx.fillStyle = '#261b3d';
    ctx.fillRect(-40, -45, 80, 50);
    ctx.strokeStyle = COLOURS.neonAmber;
    ctx.lineWidth = 2;
    ctx.strokeRect(-40, -45, 80, 50);
    ctx.beginPath();
    ctx.moveTo(-40, -45);
    ctx.lineTo(0, -12);
    ctx.lineTo(40, -45);
    ctx.stroke();

    // CEO Name Badge
    ctx.fillStyle = '#f3f4f6';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAM_ALTMAN_INBOX', 0, 20);

    // Flooding Unread Count Badge (Escalates)
    const unreadCount = Math.floor(tension * 9999 + view.elapsed * 0.05);
    ctx.fillStyle = COLOURS.neonPink;
    ctx.beginPath();
    ctx.roundRect(14, -68, 50, 22, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 11px monospace';
    ctx.fillText(crashed ? 'ERR 503' : `+${unreadCount}`, 39, -53);

    // Overflowing browser tabs / warning signs on high tension
    if (tension > 0.35 && !crashed) {
      ctx.fillStyle = COLOURS.neonAmber;
      ctx.font = '700 9px sans-serif';
      ctx.fillText('⚠️ 10,000+ TABS OPEN', 0, 40);
    }
    ctx.restore();

    // 5. Crash State: BSOD & Infinite Ping Loop Bounceback
    if (crashed) {
      ctx.save();
      const bsodFade = clamp01(crashSec / 0.15);
      ctx.fillStyle = `rgba(0, 55, 160, ${0.88 * bsodFade})`;
      ctx.fillRect(80, 70, 800, 400);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(80, 70, 800, 400);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = '700 54px monospace';
      ctx.fillText(':(', 120, 150);

      ctx.font = '600 22px system-ui, sans-serif';
      ctx.fillText('INBOX BOUNCEBACK FATAL EXCEPTION: MOTHERBOARD BRICKED', 120, 200);
      ctx.font = '400 16px monospace';
      ctx.fillStyle = '#cfdcff';
      ctx.fillText('Server auto-responder fired infinite DDoS reflection loop into local bus.', 120, 235);
      ctx.fillText(`Fault address: 0xDEADBEEF :: RAM_SPILLAGE_FATAL (${formatX(view.currentX100)})`, 120, 260);
      ctx.fillText('Crash Dump: 100% complete. Please reboot toaster and rethink life choices.', 120, 285);

      // ASCII Motherboard spark
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '700 18px monospace';
      ctx.fillText('[⚡ HIGH VOLTAGE REVERSE TELEMETRY PINCHED BUS ⚡]', 120, 330);
      ctx.restore();
    }

    // 6. HUD - Title, Multiplier, Milestone & StakeLine
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '800 24px monospace';
    ctx.fillText('⚡ RAM REPORT RUSH ⚡', 480, 36);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText("Automated idle DDR5 telemetry spam directly to the CEO's inbox", 480, 60);

    // Main Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.neonCyan);
    ctx.fillStyle = multColor;
    ctx.font = `800 ${crashed ? 76 : 72 + tension * 14}px monospace`;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 12 + tension * 16;
    ctx.fillText(formatX(view.currentX100), 480, 126);
    ctx.shadowBlur = 0;

    // Milestone Caption / Phase Status
    const passedMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const milestoneText = passedMilestone ? passedMilestone[1] : (crashed ? 'CRASHED · INBOX OVERHEAT DEFENSE' : 'READY: LAUNCH TELEMETRY SCRIPT');
    ctx.fillStyle = passedMilestone ? COLOURS.neonAmber : COLOURS.text;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(milestoneText, 480, 185, 840);

    // Stake line / Cashed out line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 19px monospace';
    ctx.fillText(line, 480, 502, 860);

    // Cashed out Victory Stamp
    if (cashed && !crashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 240, 168, 0.16)';
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(260, 215, 440, 48, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '800 16px monospace';
      ctx.fillText('✅ UNSUBSCRIBE SUCCESSFUL · FIREWALL EVADED', 480, 239);
      ctx.restore();
    }

    ctx.restore();
  }

  return { draw };
}
