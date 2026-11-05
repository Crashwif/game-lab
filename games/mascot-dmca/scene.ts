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
  bgDark: '#0a0814',
  roomWall: '#15102a',
  owlGreen: '#58cc02',
  owlGlow: 'rgba(88, 204, 2, 0.45)',
  purpleNeon: '#b545ff',
  deskSurface: '#1e1b38',
  tabletGlow: '#00e5ff',
  text: '#f3f4f6',
  muted: '#9ca3af',
  crashed: '#ff3366',
  cashedOut: '#22c55e',
  warningBorder: '#f59e0b',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First sketch hits 50,000 reposts on timeline'],
  [150, 'Mascot goth fan club discord hits capacity'],
  [200, 'Green owl verified account leaves side-eye emoji'],
  [250, 'App notification warns daily lesson is overdue'],
  [300, 'Corporate legal department joins the livestream'],
  [500, 'Artist frantically drafts an apology thread'],
  [1000, 'Subpoena courier spotted parking outside studio'],
  [10000, 'Fan art hits billboard in downtown Tokyo'],
  [100000, 'Entire language curriculum rewritten in protest'],
  [1000000, 'The goth mascot itself signs an indie buyout deal'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [
      `Cashed out at ${formatX(view.cashoutX100)} · Offshore Mirror Synced!`,
      COLOURS.cashedOut,
    ];
  }
  if (view.stake === null) {
    return [
      view.phase === 'crashed' ? 'Raid executed · No credits seized' : 'Spectating artist studio · No credits placed',
      COLOURS.muted,
    ];
  }
  if (view.phase === 'crashed') {
    return [`Legal seized your ${credits(view.stake)} · DMCA Stamp Applied`, COLOURS.crashed];
  }
  return [`${credits(view.stake)} committed · Drawing feverishly`, '#c084fc'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('door', 1.0);
    }
    if (running && previousPhase === 'running' && milestoneIndex > previousMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('notify', 0.6 + 0.3 * tension);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeS = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeS / 0.5) ** 2 : 0;
    const shakeX = shake * Math.sin(crashAgeS * 80);
    const shakeY = shake * Math.cos(crashAgeS * 60);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Studio Backdrop
    const gradBg = ctx.createLinearGradient(0, 0, 0, 540);
    gradBg.addColorStop(0, '#0a0614');
    gradBg.addColorStop(0.7, '#140c26');
    gradBg.addColorStop(1, '#080510');
    ctx.fillStyle = gradBg;
    ctx.fillRect(0, 0, 960, 540);

    // Doorway on the left (where the giant owl creeps)
    const doorX = 70;
    const doorY = 70;
    const doorW = 160;
    const doorH = 370;

    ctx.fillStyle = '#110c22';
    ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.strokeStyle = '#2d2448';
    ctx.lineWidth = 6;
    ctx.strokeRect(doorX, doorY, doorW, doorH);

    // Door Frosted Glass Panel
    const glassX = doorX + 20;
    const glassY = doorY + 30;
    const glassW = doorW - 40;
    const glassH = 200;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(glassX, glassY, glassW, glassH);

    // Menacing Owl Eyes & silhouette behind frosted glass
    const owlPresence = clamp01(tension * 1.2 + depth * 0.4);
    if (owlPresence > 0.05 || crashed) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(glassX, glassY, glassW, glassH);
      ctx.clip();

      const eyeGlow = crashed ? 1 : owlPresence;
      const eyeBob = Math.sin(view.elapsed / 220) * 4;

      // Owl silhouette body
      ctx.fillStyle = `rgba(10, 35, 10, ${0.4 + 0.5 * eyeGlow})`;
      ctx.beginPath();
      ctx.arc(doorX + doorW / 2, glassY + 110 + eyeBob, 58, 0, Math.PI * 2);
      ctx.fill();

      // Glowing green predator eyes
      ctx.shadowColor = COLOURS.owlGreen;
      ctx.shadowBlur = 18 * eyeGlow;
      ctx.fillStyle = crashed ? '#ff1e40' : COLOURS.owlGreen;

      // Left eye
      ctx.beginPath();
      ctx.ellipse(doorX + 58, glassY + 95 + eyeBob, 14 * eyeGlow, 18 * eyeGlow, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Right eye
      ctx.beginPath();
      ctx.ellipse(doorX + 102, glassY + 95 + eyeBob, 14 * eyeGlow, 18 * eyeGlow, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Pupils (glaring intently)
      ctx.fillStyle = '#051204';
      ctx.beginPath();
      ctx.arc(doorX + 61, glassY + 95 + eyeBob, 6 * eyeGlow, 0, Math.PI * 2);
      ctx.arc(doorX + 99, glassY + 95 + eyeBob, 6 * eyeGlow, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Owl feather shadows creeping under the door crack
    if (tension > 0.25) {
      const creep = (tension - 0.25) * 80;
      ctx.fillStyle = COLOURS.owlGlow;
      ctx.beginPath();
      ctx.moveTo(doorX, doorY + doorH);
      ctx.lineTo(doorX + doorW, doorY + doorH);
      ctx.lineTo(doorX + doorW + creep, doorY + doorH + 25);
      ctx.lineTo(doorX - creep * 0.5, doorY + doorH + 25);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Studio Desk & Setup (Center-Right)
    const deskY = 360;
    ctx.fillStyle = COLOURS.deskSurface;
    ctx.fillRect(260, deskY, 660, 180);
    ctx.fillStyle = '#16132b';
    ctx.fillRect(260, deskY, 660, 12);

    // Glowing Tablet on Desk
    const tabX = 490;
    const tabY = 320;
    const tabW = 220;
    const tabH = 140;

    // Tablet bezel
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(tabX, tabY, tabW, tabH);
    ctx.strokeStyle = '#322d56';
    ctx.lineWidth = 4;
    ctx.strokeRect(tabX, tabY, tabW, tabH);

    // Tablet screen surface (glows purple / cyan)
    const screenGrad = ctx.createLinearGradient(tabX, tabY, tabX + tabW, tabY + tabH);
    screenGrad.addColorStop(0, '#2d0f48');
    screenGrad.addColorStop(1, '#0e3a50');
    ctx.fillStyle = screenGrad;
    ctx.fillRect(tabX + 8, tabY + 8, tabW - 16, tabH - 16);

    // Viral Goth Mascot drawing on tablet
    const mascotBob = Math.sin(view.elapsed / 160) * 3;
    ctx.fillStyle = COLOURS.purpleNeon;
    ctx.beginPath();
    ctx.arc(tabX + 110, tabY + 65 + mascotBob, 28, 0, Math.PI * 2);
    ctx.fill();
    // Mascot goth twin buns & bat wings
    ctx.beginPath();
    ctx.arc(tabX + 88, tabY + 45 + mascotBob, 12, 0, Math.PI * 2);
    ctx.arc(tabX + 132, tabY + 45 + mascotBob, 12, 0, Math.PI * 2);
    ctx.fill();
    // Mascot cute face
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tabX + 102, tabY + 64 + mascotBob, 5, 0, Math.PI * 2);
    ctx.arc(tabX + 118, tabY + 64 + mascotBob, 5, 0, Math.PI * 2);
    ctx.fill();

    // Panicked Illustrator (Left of tablet, behind desk)
    const artistX = 380;
    const artistY = 270;
    const panicTremble = running ? Math.sin(view.elapsed / 30) * (2 + 6 * tension) : 0;

    // Head
    ctx.fillStyle = '#ffdfbf';
    ctx.beginPath();
    ctx.arc(artistX + panicTremble, artistY - 30, 32, 0, Math.PI * 2);
    ctx.fill();

    // Messy hair
    ctx.fillStyle = '#3a2154';
    ctx.beginPath();
    ctx.arc(artistX + panicTremble, artistY - 42, 36, Math.PI, Math.PI * 2);
    ctx.lineTo(artistX + panicTremble + 36, artistY - 20);
    ctx.lineTo(artistX + panicTremble - 36, artistY - 20);
    ctx.closePath();
    ctx.fill();

    // Giant headphones
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(artistX + panicTremble, artistY - 32, 36, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();

    // Panicked eyes
    ctx.fillStyle = '#1e1b4b';
    const eyeSize = 4 + 4 * tension;
    ctx.beginPath();
    ctx.arc(artistX - 10 + panicTremble, artistY - 30, eyeSize, 0, Math.PI * 2);
    ctx.arc(artistX + 10 + panicTremble, artistY - 30, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Sweat drop when high tension
    if (tension > 0.3) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(artistX + 26 + panicTremble, artistY - 40 + (view.elapsed % 400) / 20, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fast-sketching arm with stylus
    const scribbleRate = running ? Math.sin(view.elapsed / 45) * 16 : 0;
    ctx.strokeStyle = '#ffdfbf';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(artistX + 20, artistY);
    ctx.lineTo(tabX + 60 + scribbleRate, tabY + 60 + scribbleRate * 0.5);
    ctx.stroke();

    // Stylus
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tabX + 55 + scribbleRate, tabY + 55 + scribbleRate * 0.5);
    ctx.lineTo(tabX + 75 + scribbleRate, tabY + 75 + scribbleRate * 0.5);
    ctx.stroke();

    // Floating viral sparkles & social notification badges
    if (running && tension > 0.1) {
      for (let i = 0; i < 4; i++) {
        const floatOffset = (view.elapsed * 0.1 + i * 90) % 240;
        const sparkX = tabX + 70 + (i % 2 === 0 ? 50 : -40) + Math.sin(floatOffset * 0.05) * 20;
        const sparkY = tabY - floatOffset * 0.7;
        ctx.fillStyle = i % 2 === 0 ? '#ff4081' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 4 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. HUD: Headers & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.text;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText('MASCOT DMCA', 610, 48);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText('SCRUB VIRAL FAN ART BEFORE CORPORATE LEGAL BREAKS IN', 610, 74);

    // Multiplier Display
    const multiplierColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : '#ffffff';
    ctx.fillStyle = multiplierColor;
    const multScale = crashed ? 1 + 0.15 * Math.sin(crashAgeS * 20) : 1;
    ctx.font = `900 ${Math.floor(78 * multScale)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 610, 150);

    // Milestone Badge
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const milestoneText = activeMilestone ? activeMilestone[1] : (crashed ? 'LEGAL RAID IN PROGRESS' : 'STANDBY · AWAITING NEXT ROUND');

    ctx.fillStyle = crashed ? 'rgba(255, 51, 102, 0.2)' : 'rgba(88, 204, 2, 0.15)';
    ctx.fillRect(360, 202, 500, 36);
    ctx.strokeStyle = crashed ? COLOURS.crashed : COLOURS.owlGreen;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(360, 202, 500, 36);

    ctx.fillStyle = crashed ? '#ffa3b8' : '#a3e635';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(milestoneText, 610, 220);

    // Stake line
    const [lineMsg, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(lineMsg, 610, 500);

    // 4. Overlays: Cashout / Crashed States
    if (view.cashoutX100 !== null && !crashed) {
      // Safe Export Badge
      ctx.fillStyle = 'rgba(16, 185, 129, 0.88)';
      ctx.fillRect(340, 252, 540, 50);
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = 2;
      ctx.strokeRect(340, 252, 540, 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillText('PORTFOLIO ENCRYPTED & MIRRORED OFFSHORE · LOGGED OUT', 610, 277);
    }

    if (crashed) {
      // Giant Red DMCA Cease-and-Desist Stamp
      ctx.save();
      ctx.translate(480, 270);
      ctx.rotate(-0.16);

      const stampFade = clamp01(crashAgeS / 0.15);
      ctx.globalAlpha = Math.min(0.96, stampFade);

      ctx.fillStyle = 'rgba(255, 0, 55, 0.2)';
      ctx.fillRect(-280, -75, 560, 150);

      ctx.strokeStyle = '#ff0037';
      ctx.lineWidth = 8;
      ctx.strokeRect(-280, -75, 560, 150);

      ctx.fillStyle = '#ff1744';
      ctx.font = '900 60px system-ui, sans-serif';
      ctx.fillText('DMCA TAKEDOWN', 0, -18);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText('SUBPOENA SERVED · CEASE AND DESIST', 0, 42);

      ctx.restore();
    }

    ctx.restore();
  }

  return { draw };
}
