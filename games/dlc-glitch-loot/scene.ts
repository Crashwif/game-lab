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
  [120, 'Community mod sends first unauthorized skin drop'],
  [150, 'Chat spams emotes as rare cosmetics flood in'],
  [200, 'Mod types WE CAN TAKE THE HEAT in official chat'],
  [250, 'Entire killer roster unlocked without payment'],
  [300, 'Streamer wardrobe bursts into golden neon glow'],
  [500, 'Unreleased 2028 anniversary perks start dumping'],
  [1000, 'Publisher VP enters chat typing ALL CAPS threats'],
  [10000, 'Legal department issues live DMCA cease-and-desist'],
  [100000, 'Account value exceeds company quarterly net profit'],
  [1000000, 'Server database burns out from infinite inventory'],
];

const CHAT_MSGS = [
  'MOD_Kev: spamming the unlock payload now!!',
  'xX_Shadow: HOW DID HE GET THE 2028 PERK???',
  'POGGERS POGGERS POGGERS',
  'MOD_Kev: WE CAN TAKE THE HEAT BOYS',
  'DevWatcher99: Corporate legal is pinging channel mods',
  'LootGoblin: CASHOUT TO HARD DRIVE BEFORE DMCA!!',
  'CorpLegal_Bot: CEASE & DESIST NOTICE DISPATCHED',
];

const COLOURS = {
  bgDark: '#0a0614',
  roomGlow: '#1a1036',
  neonPurple: '#a855f7',
  neonCyan: '#06b6d4',
  goldSkin: '#fbbf24',
  goldBright: '#fef08a',
  crimson: '#ef4444',
  crashedBg: '#2a0505',
  safeGreen: '#22c55e',
  textLight: '#f8fafc',
  muted: '#94a3b8',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${Math.floor(size * (1 + 0.28 * pop * pop))}px ui-monospace, monospace, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`OFFLINE USB BACKUP COMPLETE · Locked in at ${formatX(view.cashoutX100)}`, COLOURS.safeGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Banned in 4K · Spectated without stake' : 'Watching glitch stream · No credits staked', COLOURS.muted];
  }
  if (crashed) {
    return [`LEGAL CLAWBACK · Account nuked · Lost ${credits(view.stake)}`, COLOURS.crimson];
  }
  return [`ROGUE LOOT FEED ACTIVE · ${credits(view.stake)} on the line`, COLOURS.goldSkin];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let dropCounter = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('cheer', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.8);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('notify', 0.75);
      }
      const dropStep = Math.floor(view.elapsed / 450);
      if (dropStep > dropCounter && !cashed) {
        dropCounter = dropStep;
        audio.fx('coin', 0.25 + 0.35 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.7) ** 2 : running ? tension * 3 * Math.sin(view.elapsed * 0.02) : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.06) : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(view.elapsed * 0.08), shake * Math.cos(view.elapsed * 0.07));

    // Background: Streamer bedroom / broadcast lab
    const bgGrad = ctx.createLinearGradient(0, 0, 960, 540);
    bgGrad.addColorStop(0, crashed ? COLOURS.crashedBg : '#0c071a');
    bgGrad.addColorStop(1, crashed ? '#140202' : '#1c0c32');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // RGB acoustic wall panels
    for (let i = 0; i < 7; i++) {
      const panelX = 50 + i * 135;
      const hue = (view.elapsed * 0.1 + i * 45) % 360;
      ctx.fillStyle = crashed ? 'rgba(239, 68, 68, 0.12)' : `hsla(${hue}, 80%, 45%, 0.15)`;
      ctx.fillRect(panelX, 25, 95, 120);
      ctx.strokeStyle = crashed ? 'rgba(239, 68, 68, 0.4)' : `hsla(${hue}, 90%, 65%, 0.35)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(panelX, 25, 95, 120);
    }

    // Streamer Desk / Rig Setup (Center)
    const rigX = 350;
    const rigY = 190;
    const rigW = 260;
    const rigH = 210;

    // Monitor bezel & glow
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rigX - 10, rigY - 10, rigW + 20, rigH + 20);
    ctx.strokeStyle = crashed ? '#dc2626' : COLOURS.neonCyan;
    ctx.lineWidth = 3;
    ctx.strokeRect(rigX - 10, rigY - 10, rigW + 20, rigH + 20);

    // Monitor screen content (Webcam + Stream view)
    ctx.save();
    ctx.beginPath();
    ctx.rect(rigX, rigY, rigW, rigH);
    ctx.clip();
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(rigX, rigY, rigW, rigH);

    // Streamer avatar bobbing
    const sweatSway = running ? Math.sin(view.elapsed * 0.012) * (4 + tension * 8) : 0;
    const charCenterX = rigX + rigW / 2 + sweatSway;
    const charCenterY = rigY + 125;

    // Gaming chair backrest
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.roundRect(charCenterX - 55, charCenterY - 70, 110, 130, 24);
    ctx.fill();
    ctx.strokeStyle = cashed ? COLOURS.safeGreen : COLOURS.neonPurple;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Streamer hoodie / torso
    ctx.fillStyle = crashed ? '#7f1d1d' : cashed ? '#14532d' : '#312e81';
    ctx.beginPath();
    ctx.arc(charCenterX, charCenterY + 45, 48, Math.PI, 0, false);
    ctx.fill();

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(charCenterX, charCenterY - 10, 28, 0, Math.PI * 2);
    ctx.fill();

    // Headset
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(charCenterX, charCenterY - 12, 32, Math.PI, 0, false);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();
    // Headset earcups
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(charCenterX - 36, charCenterY - 20, 10, 20);
    ctx.fillRect(charCenterX + 26, charCenterY - 20, 10, 20);

    // Streamer face expressions
    if (crashed) {
      // Hands on face, X eyes
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 3;
      // Eye X's
      ctx.beginPath();
      ctx.moveTo(charCenterX - 14, charCenterY - 15);
      ctx.lineTo(charCenterX - 6, charCenterY - 7);
      ctx.moveTo(charCenterX - 6, charCenterY - 15);
      ctx.lineTo(charCenterX - 14, charCenterY - 7);
      ctx.moveTo(charCenterX + 6, charCenterY - 15);
      ctx.lineTo(charCenterX + 14, charCenterY - 7);
      ctx.moveTo(charCenterX + 14, charCenterY - 15);
      ctx.lineTo(charCenterX + 6, charCenterY - 7);
      ctx.stroke();
      // Screaming mouth
      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.ellipse(charCenterX, charCenterY + 6, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cashed) {
      // Cool confident sunglasses & huge grin holding USB
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(charCenterX - 20, charCenterY - 16, 40, 12);
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(charCenterX, charCenterY + 4, 12, 0, Math.PI);
      ctx.fill();
    } else {
      // Stressed eyes darting around, open mouth
      const eyeOffset = Math.sin(view.elapsed * 0.02) * 3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(charCenterX - 10, charCenterY - 12, 8, 0, Math.PI * 2);
      ctx.arc(charCenterX + 10, charCenterY - 12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(charCenterX - 10 + eyeOffset, charCenterY - 12, 3.5, 0, Math.PI * 2);
      ctx.arc(charCenterX + 10 + eyeOffset, charCenterY - 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // O-shaped panic mouth
      ctx.fillStyle = '#831843';
      ctx.beginPath();
      ctx.ellipse(charCenterX, charCenterY + 3 + tension * 4, 6 + tension * 4, 5 + tension * 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Sweat droplets
      if (tension > 0.2) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(charCenterX + 22, charCenterY - 18 + ((view.elapsed * 0.04) % 18), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Live overlay watermark in webcam corner
    ctx.fillStyle = running ? '#ef4444' : '#64748b';
    ctx.beginPath();
    ctx.arc(rigX + 22, rigY + 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px system-ui';
    ctx.fillText('LIVE 1080p60', rigX + 34, rigY + 25);

    ctx.restore(); // Exit monitor clip

    // Left Column: Loot Crates Piling Up
    const crateCount = Math.min(10, Math.floor(view.currentX100 / 120));
    ctx.fillStyle = '#3b82f6';
    for (let c = 0; c < crateCount; c++) {
      const cy = 410 - c * 26;
      const bounce = Math.sin(view.elapsed * 0.01 + c) * 3;
      const tierColor = c >= 6 ? COLOURS.goldSkin : c >= 3 ? COLOURS.neonPurple : COLOURS.neonCyan;

      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(70, cy + bounce, 180, 22);
      ctx.strokeStyle = tierColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(70, cy + bounce, 180, 22);

      // Crate label
      ctx.fillStyle = tierColor;
      ctx.font = '700 10px monospace';
      const rarity = c >= 6 ? '★ MYTHIC PERK DROP' : c >= 3 ? '◆ ROGUE COSMETIC' : '● EXPLOIT CRATE';
      ctx.fillText(`${rarity} #${c + 1}`, 78, cy + bounce + 15);
    }

    // Right Column: Live Chat Feed
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.roundRect(690, 180, 220, 220, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '700 12px monospace';
    ctx.fillText('STREAM CHAT [ROGUE SERVER]', 702, 202);

    const activeChatLines = Math.min(CHAT_MSGS.length, 2 + Math.floor(tension * 6));
    ctx.font = '500 11px system-ui, sans-serif';
    for (let m = 0; m < activeChatLines; m++) {
      const msgIndex = (m + Math.floor(view.elapsed / 2500)) % CHAT_MSGS.length;
      const msg = CHAT_MSGS[msgIndex] ?? '';
      ctx.fillStyle = msg.includes('CorpLegal') || msg.includes('CEASE') ? COLOURS.crimson : msg.includes('MOD_') ? COLOURS.goldSkin : COLOURS.textLight;
      ctx.fillText(msg, 702, 228 + m * 22, 200);
    }

    // Cashed out celebration: USB Stick Locked Graphic
    if (cashed) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
      ctx.fillRect(0, 0, 960, 540);

      ctx.fillStyle = COLOURS.safeGreen;
      ctx.fillRect(380, 120, 200, 38);
      ctx.fillStyle = '#052e16';
      ctx.font = '900 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✔ HARD DRIVE BACKUP SECURED', 480, 144);
      ctx.textAlign = 'left';
    }

    // Crashed: Compliance Ban Hammer Overlay
    if (crashed) {
      const flash = Math.sin(crashAgeSec * 16) > 0;
      ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, 960, 540);

      // Warning Stamp
      ctx.save();
      ctx.translate(480, 290);
      ctx.rotate(-0.08);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
      ctx.fillRect(-280, -45, 560, 90);
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 4;
      ctx.strokeRect(-280, -45, 560, 90);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '900 36px monospace';
      ctx.fillText('ACCOUNT NUKED & REVOKED', 0, 12);
      ctx.restore();
    }

    // Top HUD: Game Title and Multiplier Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '800 24px monospace';
    ctx.fillText('DLC GLITCH LOOT', 480, 48);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('ROGUE COMMUNITY MANAGER EXPLOIT · CASHOUT BEFORE LEGAL DMCA', 480, 72);

    // Multiplier Text
    const multPop = pop(100);
    const multColor = crashed ? COLOURS.crimson : cashed ? COLOURS.safeGreen : tension > 0.6 ? COLOURS.goldSkin : COLOURS.textLight;
    ctx.fillStyle = multColor;
    ctx.font = popFont(900, 68 + depth * 14, multPop);
    ctx.fillText(formatX(view.currentX100), 480, 120);

    // Live Milestone Caption
    const currentMilestoneText = running && milestone > 0 ? (MILESTONES[milestone - 1]?.[1] ?? '') : view.phase === 'crashed' ? 'Corporate legal counsel dispatched live clawback notice.' : 'Waiting for community manager glitch inject...';

    ctx.fillStyle = crashed ? COLOURS.crimson : COLOURS.goldBright;
    ctx.font = popFont(600, 16, pop(MILESTONES[milestone - 1]?.[0] ?? 100));
    ctx.fillText(currentMilestoneText, 480, 455, 840);

    // Stake line & player status
    const [statusText, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = popFont(700, 20, cashed ? pop(view.cashoutX100 ?? 100) : 0);
    ctx.fillText(statusText, 480, 495, 860);

    ctx.restore();
  }

  return { draw };
}
