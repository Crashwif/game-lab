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
  [120, 'Drafting aliens landed before GTA 6'],
  [150, 'Citing cold fusion discovered first'],
  [200, 'Half-Life 3 rumors start circulating'],
  [250, 'Meme drafts hit maximum spicy levels'],
  [300, 'Digital clock starts ticking backward'],
  [500, 'Elder Scrolls 6 becomes the new punchline'],
  [1000, 'Ten-day countdown sparks internet panic'],
  [10000, 'Every brand account copies the format'],
  [100000, 'The universe pauses before the patch drops'],
  [1000000, 'Infinite meme archive transcending time'],
];

const COLOURS = {
  bgDark: '#080612',
  wallTop: '#160d29',
  wallBottom: '#23153c',
  boardFrame: '#8a4b2a',
  boardFace: '#1a3227',
  boardCrack: '#ff4070',
  neonPink: '#ff2d75',
  neonCyan: '#00f0ff',
  neonYellow: '#ffe600',
  textLight: '#f5f7fa',
  textMuted: '#9aa5bd',
  crashed: '#ff3366',
  cashedOut: '#2fe695',
  chalkWhite: 'rgba(240, 248, 255, 0.88)',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Thread Published at ${formatX(view.cashoutX100)} · Viral archive locked!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Midnight struck · meme deprecated' : 'Spectating meme desk · zero credits committed', COLOURS.textMuted];
  }
  if (crashed) return [`Midnight launch bell rang · ${credits(view.stake)} dissolved into dust`, COLOURS.crashed];
  return [`Drafting live · ${credits(view.stake)} riding on the punchline`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSecondMark = -1;

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
      audio.fx('kaching', 0.8);
      audio.fx('airhorn', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('bell', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('notify', 0.7);
      }
      const sec = Math.floor(view.elapsed / (400 - tension * 260));
      if (sec !== lastSecondMark) {
        lastSecondMark = sec;
        if (!cashed) audio.fx('tick', 0.35 + 0.5 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : (running ? Math.sin(now * 0.03) * tension * 2.5 : 0);

    ctx.save();
    // Synthwave room background
    ctx.translate(shake * Math.sin(now * 0.05), shake * Math.cos(now * 0.04));
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.wallTop);
    bgGrad.addColorStop(0.65, COLOURS.wallBottom);
    bgGrad.addColorStop(1, COLOURS.bgDark);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, 1000, 580);

    // Window showing Vice City synthwave horizon
    ctx.save();
    ctx.fillStyle = '#0a0518';
    ctx.fillRect(50, 40, 220, 190);
    ctx.strokeStyle = '#322154';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 40, 220, 190);

    // Neon city billboard glow outside window
    const billboardPulse = 0.5 + 0.5 * Math.sin(now * 0.005);
    ctx.fillStyle = `rgba(255, 45, 117, ${0.15 + 0.2 * billboardPulse})`;
    ctx.fillRect(60, 50, 200, 70);
    ctx.fillStyle = COLOURS.neonPink;
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GTA VI COMING SOON', 160, 85);
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('MIDNIGHT LAUNCH', 160, 105);

    // Palm tree silhouettes in window
    ctx.fillStyle = '#06030e';
    ctx.beginPath();
    ctx.moveTo(70, 225);
    ctx.lineTo(82, 130);
    ctx.lineTo(86, 225);
    ctx.fill();
    ctx.restore();

    // Frantic digital countdown wall clock
    const clockX = 800;
    const clockY = 110;
    ctx.save();
    ctx.fillStyle = '#100c1e';
    ctx.strokeStyle = crashed ? COLOURS.crashed : COLOURS.neonPink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(clockX - 110, clockY - 50, 220, 84, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '700 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LAUNCH COUNTDOWN CLOCK', clockX, clockY - 32);

    const msLeft = Math.max(0, 120000 - view.elapsed);
    const clockSeconds = Math.floor((msLeft % 60000) / 1000);
    const clockMillis = Math.floor((msLeft % 1000) / 10);
    const timeText = crashed
      ? '00:00:00 EXPIRED'
      : `00:${clockSeconds.toString().padStart(2, '0')}:${clockMillis.toString().padStart(2, '0')}`;
    ctx.fillStyle = crashed ? COLOURS.crashed : (tension > 0.5 ? COLOURS.neonYellow : COLOURS.neonPink);
    ctx.font = '700 24px monospace';
    ctx.fillText(timeText, clockX, clockY + 12);
    ctx.restore();

    // Center Chalkboard
    const boardX = 260;
    const boardY = 70;
    const boardW = 440;
    const boardH = 290;

    // Wood frame
    ctx.save();
    ctx.fillStyle = COLOURS.boardFrame;
    ctx.beginPath();
    ctx.roundRect(boardX - 12, boardY - 12, boardW + 24, boardH + 24, 8);
    ctx.fill();

    // Chalk slate
    ctx.fillStyle = COLOURS.boardFace;
    ctx.fillRect(boardX, boardY, boardW, boardH);

    // Chalkboard dust & chalk scrawls
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(boardX + 15, boardY + 30 + i * 40, boardW - 30, 22);
    }

    // Header scrawled on board
    ctx.font = '900 15px monospace';
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.textAlign = 'center';
    ctx.fillText('WE GOT THIS BEFORE GTA 6:', boardX + boardW / 2, boardY + 34);

    // Giant Multiplier on Board
    const punch = crashed ? (1 - clamp01((crashAgeSec - 0.12) / 0.25)) ** 2 : 0;
    const multY = boardY + 126;
    ctx.fillStyle = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.chalkWhite);
    ctx.font = `900 ${70 * (1 + 0.22 * punch)}px monospace`;
    ctx.fillText(formatX(view.currentX100), boardX + boardW / 2, multY);

    // Milestone meme draft subtitle on board
    const currentMilestoneText = MILESTONES[milestoneIndex - 1]?.[1] ?? 'Brainstorming ridiculous draft #1...';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = cashed ? COLOURS.cashedOut : COLOURS.neonYellow;
    ctx.fillText(`"${currentMilestoneText}"`, boardX + boardW / 2, boardY + 184, boardW - 40);

    // Stacks counter & spice indicator
    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '600 12px monospace';
    const memePiles = Math.min(999, Math.floor(view.currentX100 / 10));
    ctx.fillText(`DRAFTS QUEUED: ${memePiles} | SPICE: ${(tension * 100).toFixed(0)}%`, boardX + boardW / 2, boardY + 224);

    // Chalkboard crack when crashed
    if (crashed) {
      const crackProg = clamp01(crashAgeSec / 0.3);
      ctx.strokeStyle = COLOURS.boardCrack;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(boardX + boardW / 2, boardY);
      ctx.lineTo(boardX + boardW / 2 - 18 * crackProg, boardY + 80 * crackProg);
      ctx.lineTo(boardX + boardW / 2 + 25 * crackProg, boardY + 160 * crackProg);
      ctx.lineTo(boardX + boardW / 2 - 12 * crackProg, boardY + 240 * crackProg);
      ctx.lineTo(boardX + boardW / 2 + 8 * crackProg, boardY + boardH);
      ctx.stroke();

      // Chalk dust particles drifting down
      ctx.fillStyle = 'rgba(255, 200, 220, 0.7)';
      for (let p = 0; p < 24; p++) {
        const px = boardX + (p * 37) % boardW;
        const py = boardY + ((p * 29 + crashAgeSec * 220) % (boardH + 60));
        ctx.fillRect(px, py, 3, 3);
      }
    }
    ctx.restore();

    // Protagonist: Twitchy Meme Admin at the desk
    const adminX = cashed ? 600 + Math.min(400, (view.elapsed % 3000) * 0.4) : 480;
    const adminY = 410;
    const jitter = running && !cashed ? (Math.random() - 0.5) * (tension * 8) : 0;
    const armWave = running ? Math.sin(now * (0.015 + tension * 0.03)) * 25 : 0;

    ctx.save();
    ctx.translate(jitter, jitter * 0.5);

    if (cashed) {
      // Escape convertible speeding with upvotes
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.roundRect(adminX - 80, adminY - 15, 160, 45, 12);
      ctx.fill();

      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(adminX - 50, adminY + 30, 16, 0, Math.PI * 2);
      ctx.arc(adminX + 50, adminY + 30, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.arc(adminX - 50, adminY + 30, 6, 0, Math.PI * 2);
      ctx.arc(adminX + 50, adminY + 30, 6, 0, Math.PI * 2);
      ctx.fill();

      // Admin riding happy
      ctx.fillStyle = '#ffd1a4'; // Head
      ctx.beginPath();
      ctx.arc(adminX - 10, adminY - 35, 18, 0, Math.PI * 2);
      ctx.fill();
      // Cool shades
      ctx.fillStyle = '#111';
      ctx.fillRect(adminX - 18, adminY - 38, 26, 8);
      // Upvotes fountain flying out trunk
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.font = '700 18px monospace';
      ctx.fillText('▲ UPVOTE', adminX - 90, adminY - 35 - (now * 0.05) % 30);
      ctx.fillText('▲ VIRAL', adminX - 120, adminY - 10 - (now * 0.06) % 30);
    } else if (crashed) {
      // Defeated meme admin facepalming at desk
      ctx.fillStyle = '#ffd1a4';
      ctx.beginPath();
      ctx.arc(adminX, adminY - 10, 20, 0, Math.PI * 2);
      ctx.fill();
      // Sad face
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(adminX, adminY - 4, 8, Math.PI, 0);
      ctx.stroke();
      // Body slumped
      ctx.fillStyle = '#495b70';
      ctx.beginPath();
      ctx.roundRect(adminX - 25, adminY + 12, 50, 42, 6);
      ctx.fill();
      // Dust clouds from stale memes
      ctx.fillStyle = 'rgba(160, 160, 160, 0.4)';
      ctx.beginPath();
      ctx.arc(adminX - 40, adminY + 20, 25, 0, Math.PI * 2);
      ctx.arc(adminX + 40, adminY + 15, 20, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Frantic Admin scribbling with chalk
      // Torso / hoodie
      ctx.fillStyle = '#2c3e6b';
      ctx.beginPath();
      ctx.roundRect(adminX - 22, adminY, 44, 46, 8);
      ctx.fill();

      // Head
      ctx.fillStyle = '#ffd1a4';
      ctx.beginPath();
      ctx.arc(adminX, adminY - 24, 20, 0, Math.PI * 2);
      ctx.fill();

      // Wide sleep-deprived eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(adminX - 7, adminY - 26, 6, 0, Math.PI * 2);
      ctx.arc(adminX + 7, adminY - 26, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cc0022'; // Bloodshot red pupils
      ctx.beginPath();
      ctx.arc(adminX - 7 + Math.sin(now * 0.02) * 2, adminY - 26, 2.5, 0, Math.PI * 2);
      ctx.arc(adminX + 7 + Math.sin(now * 0.02) * 2, adminY - 26, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Frantic arm holding chalk towards board
      ctx.strokeStyle = '#ffd1a4';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(adminX + 15, adminY + 12);
      ctx.lineTo(adminX + 35 + armWave * 0.6, adminY - 20 + armWave);
      ctx.stroke();

      // Piece of chalk
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(adminX + 33 + armWave * 0.6, adminY - 24 + armWave, 8, 5);

      // Energy drink can on desk
      ctx.fillStyle = COLOURS.neonPink;
      ctx.fillRect(adminX - 60, adminY + 10, 16, 28);
      ctx.fillStyle = '#eee';
      ctx.fillRect(adminX - 58, adminY + 7, 12, 3);
    }
    ctx.restore();

    // Top Game Title and Subtitle HUD
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOURS.neonPink;
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('JOKE EXPIRY RUSH', 40, 36);

    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('POST EVERY LAST "BEFORE GTA 6" MEME BEFORE MIDNIGHT LAUNCH', 280, 34);

    // Right side depth/tier badge
    ctx.textAlign = 'right';
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '700 13px monospace';
    ctx.fillText(`HYPER-DRIVE: ${(depth * 100).toFixed(0)}%`, 920, 34);
    ctx.restore();

    // Bottom Action / Stake Bar
    const [line, colour] = stakeLine(view);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(8, 6, 18, 0.88)';
    ctx.fillRect(0, 485, 960, 55);
    ctx.strokeStyle = '#271c3d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 485);
    ctx.lineTo(960, 485);
    ctx.stroke();

    ctx.fillStyle = colour;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 512, 900);
    ctx.restore();

    ctx.restore();
  }

  return { draw };
}
