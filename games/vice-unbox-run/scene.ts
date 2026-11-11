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
  [120, 'Streamer cuts outer cardboard tape'],
  [150, 'Chat spam moves faster than eye can track'],
  [200, 'Publisher lawyers issue DMCA strike one'],
  [250, 'Holographic security seal gets sliced'],
  [300, 'Unmarked black SUVs idle in driveway'],
  [500, 'Streamer holds disc up to blinding ringlight'],
  [1000, 'Console tray pops open with holy choir chime'],
  [10000, 'Intro synth chords leak through the speakers'],
  [100000, 'Stream hits 40 million concurrent lurkers'],
  [1000000, 'World peace achieved for 12 seconds'],
];

const COLOURS = {
  bg: '#0c071e',
  neonPink: '#ff2a85',
  neonCyan: '#00f0ff',
  neonYellow: '#ffe600',
  text: '#fdfbfe',
  muted: '#8f88ab',
  alert: '#ff3344',
  success: '#38ef7d',
  gold: '#ffb703',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Stashed in pizza box at ${formatX(view.cashoutX100)} · Escaped on getaway scooter!`, COLOURS.success];
  }
  if (view.stake === null) {
    return [crashed ? 'Stream went dark · safe in the audience' : 'Spectating live bootleg unbox · 0 credits risked', COLOURS.muted];
  }
  if (crashed) {
    return [`SWAT legal team seized your ${credits(view.stake)}`, COLOURS.alert];
  }
  return [`${credits(view.stake)} riding on the holy bootleg`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastLaserBeep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const escaped = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    audio.update(view.phase, tension);

    if (previousPhase !== null && running && escaped && previousCashout === null) {
      audio.cashout();
      audio.fx('yeet', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('notify', 0.6);
      }
      if (view.elapsed - lastLaserBeep > 800 - tension * 550) {
        lastLaserBeep = view.elapsed;
        audio.fx('beep', 0.3 + 0.4 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.8) ** 2 : (running ? tension * 3.5 : 0);
    const shakeX = shake * Math.sin(view.elapsed * 0.05);
    const shakeY = shake * Math.cos(view.elapsed * 0.07);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Synthwave Bedroom / Stream Studio Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#0a0518');
    bgGrad.addColorStop(0.65, '#190a36');
    bgGrad.addColorStop(1, '#070212');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Studio window with blinds & drone spotlights outside
    const windowX = 640;
    const windowY = 40;
    const windowW = 270;
    const windowH = 220;
    ctx.fillStyle = '#05020f';
    ctx.fillRect(windowX, windowY, windowW, windowH);

    // Night city grid through window
    ctx.strokeStyle = '#351259';
    ctx.lineWidth = 1;
    for (let gx = windowX; gx <= windowX + windowW; gx += 24) {
      ctx.beginPath();
      ctx.moveTo(gx, windowY + 120);
      ctx.lineTo(gx + (gx - (windowX + windowW / 2)) * 0.6, windowY + windowH);
      ctx.stroke();
    }

    // Helicopter searchlight sweep through window
    const sweep = Math.sin(view.elapsed * 0.0022);
    const beamGrad = ctx.createRadialGradient(
      windowX + windowW / 2 + sweep * 80, windowY + 20, 10,
      windowX + windowW / 2 + sweep * 140, windowY + windowH + 180, 260
    );
    beamGrad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
    beamGrad.addColorStop(0.7, 'rgba(255, 42, 133, 0.15)');
    beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(windowX + windowW / 2 + sweep * 60, windowY);
    ctx.lineTo(windowX - 120 + sweep * 160, 540);
    ctx.lineTo(windowX + windowW + 180 + sweep * 160, 540);
    ctx.closePath();
    ctx.fill();

    // Venetian blinds slats
    ctx.fillStyle = '#160d2b';
    for (let by = windowY; by <= windowY + windowH; by += 14) {
      ctx.fillRect(windowX, by, windowW, 5);
    }
    ctx.strokeStyle = '#2d1852';
    ctx.lineWidth = 3;
    ctx.strokeRect(windowX, windowY, windowW, windowH);

    // Red sniper / drone laser dots & tracking lines targeting streamer
    const laserCount = Math.min(6, 1 + Math.floor(tension * 5));
    for (let i = 0; i < laserCount; i++) {
      const lx = 480 + Math.sin(view.elapsed * 0.003 + i * 1.8) * (80 - tension * 30);
      const ly = 320 + Math.cos(view.elapsed * 0.0025 + i * 2.1) * (40 - tension * 20);
      ctx.strokeStyle = `rgba(255, 30, 80, ${0.45 + 0.35 * Math.sin(view.elapsed * 0.01 + i)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(windowX + windowW - 20, windowY + 30 + i * 25);
      ctx.lineTo(lx, ly);
      ctx.stroke();

      ctx.fillStyle = COLOURS.alert;
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Streamer Desk & Character Centerpiece
    const deskY = 410;
    // Desk surface
    const deskGrad = ctx.createLinearGradient(0, deskY, 0, 540);
    deskGrad.addColorStop(0, '#1c1038');
    deskGrad.addColorStop(1, '#0e051c');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(180, deskY, 600, 130);
    ctx.strokeStyle = COLOURS.neonPink;
    ctx.lineWidth = 2;
    ctx.strokeRect(180, deskY, 600, 130);

    // Ringlight behind streamer
    ctx.strokeStyle = 'rgba(255, 230, 0, 0.4)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(480, 250, 125, 0, Math.PI * 2);
    ctx.stroke();

    // Streamer body / hoodie
    const sweatAngle = view.elapsed * 0.008;
    const bodyShake = running ? Math.sin(sweatAngle * 3) * (tension * 5) : 0;
    ctx.fillStyle = '#26134a';
    ctx.beginPath();
    ctx.ellipse(480 + bodyShake, 380, 95, 75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Streamer face & sweaty expression
    ctx.fillStyle = '#ffd1b3';
    ctx.beginPath();
    ctx.arc(480 + bodyShake, 280, 48, 0, Math.PI * 2);
    ctx.fill();

    // Giant headphones
    ctx.fillStyle = COLOURS.neonPink;
    ctx.fillRect(422 + bodyShake, 258, 14, 38);
    ctx.fillRect(524 + bodyShake, 258, 14, 38);
    ctx.strokeStyle = '#482475';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(480 + bodyShake, 260, 52, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // Frantic wide eyes
    const eyeOpen = 6 + tension * 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(465 + bodyShake, 275, 9, eyeOpen, 0, 0, Math.PI * 2);
    ctx.ellipse(495 + bodyShake, 275, 9, eyeOpen, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#080417';
    ctx.beginPath();
    ctx.arc(465 + bodyShake, 275, 3.5, 0, Math.PI * 2);
    ctx.arc(495 + bodyShake, 275, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // O-mouth screaming/gasping
    ctx.fillStyle = '#610a24';
    ctx.beginPath();
    ctx.ellipse(480 + bodyShake, 305, 7 + tension * 8, 4 + tension * 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flying sweat drops
    if (running && tension > 0.15) {
      ctx.fillStyle = COLOURS.neonCyan;
      for (let s = 0; s < 4; s++) {
        const dropDist = 45 + ((view.elapsed * 0.12 + s * 25) % 35);
        const dropAngle = -Math.PI * 0.5 + (s - 1.5) * 0.8;
        const sx = 480 + bodyShake + Math.cos(dropAngle) * dropDist;
        const sy = 270 + Math.sin(dropAngle) * dropDist;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5 + tension * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Hands frantic peeling Bootleg Vice City Disc & Packaging
    const boxX = 480 + bodyShake;
    const boxY = 365;

    // Cardboard game box base
    ctx.fillStyle = '#b48a52';
    ctx.fillRect(boxX - 42, boxY - 26, 84, 62);
    ctx.strokeStyle = '#4e3312';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX - 42, boxY - 26, 84, 62);

    // Bootleg Disc gleaming out
    const discRadius = 24 + tension * 8;
    const discGleam = ctx.createRadialGradient(boxX, boxY, 4, boxX, boxY, discRadius);
    discGleam.addColorStop(0, '#ffffff');
    discGleam.addColorStop(0.35, COLOURS.neonPink);
    discGleam.addColorStop(0.7, COLOURS.neonCyan);
    discGleam.addColorStop(1, '#a020f0');
    ctx.fillStyle = discGleam;
    ctx.beginPath();
    ctx.arc(boxX, boxY - 4 - tension * 12, discRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f051d';
    ctx.beginPath();
    ctx.arc(boxX, boxY - 4 - tension * 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // Peeling bubble wrap strips & shredded holographic tape flying off
    const peelCount = Math.floor(tension * 8);
    for (let p = 0; p < peelCount; p++) {
      ctx.fillStyle = p % 2 === 0 ? 'rgba(0, 240, 255, 0.7)' : 'rgba(255, 42, 133, 0.8)';
      ctx.beginPath();
      const px = boxX + (p % 2 === 0 ? -50 - p * 6 : 50 + p * 6);
      const py = boxY - 10 + Math.sin(view.elapsed * 0.01 + p) * 15;
      ctx.ellipse(px, py, 14, 4, (p * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Live Stream Chat Sidebar on Left
    ctx.fillStyle = 'rgba(12, 6, 28, 0.75)';
    ctx.fillRect(18, 50, 165, 340);
    ctx.strokeStyle = '#2b144d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(18, 50, 165, 340);

    ctx.fillStyle = COLOURS.neonPink;
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('🔴 LIVE CHAT', 28, 72);

    const chatMessages = [
      'xX_ViceFan_Xx: IS THAT REAL?!',
      'RetroGod: LAWYERS SPOTTED',
      'DMCA_Bot: CEASE & DESIST',
      'ChadGamer: RUN FOR THE EXIT!',
      'NeonRider: PEEEEEEL IT FASTER',
      'NoobSlayer: THAT SOUND TRACK OMG',
    ];
    ctx.font = '10px ui-monospace, monospace';
    for (let c = 0; c < 5; c++) {
      const msgIdx = (Math.floor(view.elapsed / 1200) + c) % chatMessages.length;
      ctx.fillStyle = c === 4 ? COLOURS.neonCyan : COLOURS.muted;
      const text = chatMessages[msgIdx] ?? 'LURKER: POG';
      ctx.fillText(text.slice(0, 20), 26, 100 + c * 48, 148);
    }

    // Viewer Count Pill
    const lurkers = Math.floor(42000 + view.currentX100 * 380 + tension * 500000);
    ctx.fillStyle = '#ff2a85';
    ctx.fillRect(20, 20, 105, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(`👁 ${lurkers.toLocaleString()}`, 28, 35);

    // 5. Comical DMCA Legal Threat Gauge (Top Right)
    ctx.fillStyle = 'rgba(12, 6, 28, 0.75)';
    ctx.fillRect(720, 16, 222, 54);
    ctx.strokeStyle = tension > 0.6 ? COLOURS.alert : COLOURS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(720, 16, 222, 54);

    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillStyle = tension > 0.6 ? COLOURS.alert : COLOURS.neonCyan;
    ctx.fillText(`ATTORNEY PROXIMITY: ${Math.floor(tension * 100)}%`, 732, 33);

    // Threat progress bar
    ctx.fillStyle = '#1c0c38';
    ctx.fillRect(732, 42, 198, 14);
    const threatGrad = ctx.createLinearGradient(732, 0, 930, 0);
    threatGrad.addColorStop(0, COLOURS.neonCyan);
    threatGrad.addColorStop(0.6, COLOURS.neonYellow);
    threatGrad.addColorStop(1, COLOURS.alert);
    ctx.fillStyle = threatGrad;
    ctx.fillRect(732, 42, 198 * tension, 14);

    // 6. Escaped Celebration Overlay
    if (escaped) {
      ctx.fillStyle = 'rgba(7, 2, 22, 0.88)';
      ctx.fillRect(160, 100, 640, 260);
      ctx.strokeStyle = COLOURS.success;
      ctx.lineWidth = 3;
      ctx.strokeRect(160, 100, 640, 260);

      ctx.textAlign = 'center';
      ctx.fillStyle = COLOURS.success;
      ctx.font = '800 28px ui-monospace, monospace';
      ctx.fillText('⚡ SLIPPED OUT THE FIRE ESCAPE! ⚡', 480, 150, 600);

      ctx.fillStyle = COLOURS.text;
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText('Bootleg holy grail stashed safely inside a pizza box', 480, 185, 580);
      ctx.fillText('Getaway scooter speeding 90 mph into the neon sunset!', 480, 212, 580);

      ctx.font = '800 36px ui-monospace, monospace';
      ctx.fillStyle = COLOURS.gold;
      ctx.fillText(`CASHED OUT: ${formatX(view.cashoutX100 ?? 100)}`, 480, 265, 580);

      if (view.payout !== null) {
        ctx.font = '700 20px ui-monospace, monospace';
        ctx.fillStyle = COLOURS.neonCyan;
        ctx.fillText(`+${credits(view.payout)} bankrolled`, 480, 310, 580);
      }
    }

    // 7. Crashed SWAT Copyright Breach Overlay
    if (crashed && !escaped) {
      // Flashing alert tint
      const flash = Math.sin(crashSec * 16) > 0 ? 0.35 : 0.15;
      ctx.fillStyle = `rgba(255, 30, 60, ${flash})`;
      ctx.fillRect(0, 0, 960, 540);

      // Cracked Drywall & Shredded papers
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(340, 110);
      ctx.lineTo(430, 190);
      ctx.lineTo(400, 240);
      ctx.lineTo(480, 330);
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 3, 20, 0.92)';
      ctx.fillRect(180, 120, 600, 220);
      ctx.strokeStyle = COLOURS.alert;
      ctx.lineWidth = 4;
      ctx.strokeRect(180, 120, 600, 220);

      ctx.textAlign = 'center';
      ctx.fillStyle = COLOURS.alert;
      ctx.font = '900 36px ui-monospace, monospace';
      ctx.fillText('🚨 SWAT LAWYERS BREACHED! 🚨', 480, 175, 560);

      ctx.fillStyle = COLOURS.text;
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillText('Corporate legal team kicked down drywall with copyright shredders!', 480, 218, 540);
      ctx.fillText(`The streaming rig was incinerated at ${formatX(view.currentX100)}`, 480, 248, 540);

      ctx.font = '800 24px ui-monospace, monospace';
      ctx.fillStyle = COLOURS.neonYellow;
      ctx.fillText('STREAM TERMINATED · DMCA PERMABAN', 480, 298, 540);
    }

    // 8. Main HUD: Multiplier, Milestones, Stake Line
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.font = '800 22px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillText('VICE UNBOX RUN', 480, 32);

    // Multiplier Callout
    if (!escaped && !crashed) {
      ctx.fillStyle = COLOURS.text;
      const multScale = 1 + tension * 0.15;
      ctx.font = `900 ${Math.floor(70 * multScale)}px ui-monospace, monospace`;
      ctx.shadowColor = COLOURS.neonPink;
      ctx.shadowBlur = 12 + tension * 16;
      ctx.fillText(formatX(view.currentX100), 480, 115, 600);
      ctx.shadowBlur = 0;
    }

    // Milestone ticker / current beat
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const tickerText = activeMilestone ? activeMilestone[1] : (running ? 'Peeling plastic wrap...' : (crashed ? 'RIG CONFISCATED' : 'WAITING FOR STREAM BOOT'));
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonYellow;
    ctx.fillText(tickerText.toUpperCase(), 480, running ? 168 : 460, 780);

    // Stake line footer
    const [line, colour] = stakeLine(view);
    ctx.font = '700 16px ui-monospace, monospace';
    ctx.fillStyle = colour;
    ctx.fillText(line, 480, 508, 900);

    ctx.restore();
  }

  return { draw };
}
