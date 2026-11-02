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
  bgDark: '#0e111a',
  wallNight: '#1a1d2e',
  carpet: '#2b213a',
  couch: '#d96b43',
  couchShadow: '#9c4424',
  cashGreen: '#4ade80',
  cashStack: '#22c55e',
  cashShade: '#15803d',
  gold: '#fbbf24',
  accent: '#38bdf8',
  text: '#f8fafc',
  muted: '#94a3b8',
  crashed: '#f43f5e',
  cashedOut: '#34d399',
  neonPurple: '#c084fc',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Declined first Friday club text, saved twenty'],
  [150, 'Ate cold leftovers instead of artisanal tapas'],
  [200, 'Skipped surge priced ride home, saved fifty'],
  [250, 'Ignored cover fee line in freezing drizzle'],
  [300, 'Stacked three hundred unspent drink vouchers'],
  [500, 'Local bartender officially forgets your face'],
  [1000, 'Account balance officially tops four figures'],
  [10000, 'Financial guru features your couch on podcast'],
  [100000, 'Saved enough unspent booze cash to buy a condo'],
  [1000000, 'Achieved Nirvana without leaving the sofa once'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Locked in at ${formatX(view.cashoutX100)} · Safe at home with cold pizza`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Promoters raided the door · zero credits lost' : 'Watching cozy · no credits riding', COLOURS.muted];
  }
  if (crashed) return [`VIP raid dragged away your ${credits(view.stake)}`, COLOURS.crashed];
  return [`Barricaded in · ${credits(view.stake)} riding`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let knockTimer = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('door', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('ding', 0.7);
      }
      knockTimer += 0.016;
      const knockInterval = Math.max(0.4, 2.2 - tension * 1.6);
      if (knockTimer > knockInterval && view.cashoutX100 === null) {
        knockTimer = 0;
        audio.fx('thud', 0.3 + 0.6 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : running ? tension * 2.5 * Math.sin(view.elapsed * 0.03) : 0;

    ctx.save();
    ctx.fillStyle = COLOURS.bgDark;
    ctx.fillRect(0, 0, 960, 540);
    ctx.translate(shake * Math.sin(crashAgeSec * 60 + view.elapsed * 0.05), shake * Math.cos(crashAgeSec * 45 + view.elapsed * 0.04));

    // Living room background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 420);
    bgGrad.addColorStop(0, COLOURS.wallNight);
    bgGrad.addColorStop(1, '#111322');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 420);

    // Floor / Rug
    ctx.fillStyle = '#1c1524';
    ctx.fillRect(0, 420, 960, 120);
    ctx.fillStyle = COLOURS.carpet;
    ctx.beginPath();
    ctx.ellipse(480, 480, 410, 52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nightclub neon glow through window on right
    ctx.save();
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(720, 80, 180, 240);
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 6;
    ctx.strokeRect(720, 80, 180, 240);
    // Window grid
    ctx.beginPath();
    ctx.moveTo(810, 80);
    ctx.lineTo(810, 320);
    ctx.moveTo(720, 200);
    ctx.lineTo(900, 200);
    ctx.stroke();

    // Flashing strobe & promoter silhouettes outside
    const strobe = running ? Math.sin(view.elapsed * 0.008 + tension * 4) : 0;
    ctx.fillStyle = strobe > 0.4 ? 'rgba(236, 72, 153, 0.45)' : 'rgba(168, 85, 247, 0.2)';
    ctx.fillRect(723, 83, 174, 234);

    // Street promoter silhouette banging on window
    if (tension > 0.2 && !crashed) {
      ctx.fillStyle = '#06070d';
      const bob = Math.sin(view.elapsed * 0.015) * 4;
      ctx.beginPath();
      ctx.arc(810, 190 + bob, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(785, 212 + bob, 50, 80);
    }
    ctx.restore();

    // Barricaded door on left
    ctx.save();
    ctx.fillStyle = '#231815';
    ctx.fillRect(60, 110, 130, 310);
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 110, 130, 310);
    // Door planks / barricades
    const doorShake = running ? Math.sin(view.elapsed * 0.02) * (tension * 3) : 0;
    ctx.fillStyle = '#854d0e';
    ctx.save();
    ctx.translate(doorShake, 0);
    ctx.fillRect(45, 170, 160, 22);
    ctx.fillRect(45, 240, 160, 22);
    ctx.fillRect(45, 310, 160, 22);
    // Heavy deadbolt indicator
    ctx.fillStyle = view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.gold;
    ctx.fillRect(160, 235, 30, 32);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(175, 251, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // Fortress of Unspent Cash Stacks & Cheap Soda Cans around the couch
    const stackCount = Math.floor(tension * 16 + depth * 14);
    for (let i = 0; i < stackCount; i++) {
      const leftStack = i % 2 === 0;
      const col = Math.floor(i / 2);
      const bx = leftStack ? 240 - (col % 4) * 36 : 720 + (col % 4) * 36;
      const by = 450 - Math.floor(col / 4) * 24;

      // Cash brick
      ctx.fillStyle = COLOURS.cashShade;
      ctx.fillRect(bx - 20, by - 12, 40, 14);
      ctx.fillStyle = COLOURS.cashGreen;
      ctx.fillRect(bx - 18, by - 10, 36, 10);
      ctx.fillStyle = COLOURS.cashStack;
      ctx.fillRect(bx - 6, by - 8, 12, 6);
    }

    // Soda cans stacked near couch
    const canCount = Math.min(6, 1 + Math.floor(tension * 6));
    for (let c = 0; c < canCount; c++) {
      const cx = 330 + c * 14;
      const cy = 460 - (c % 2) * 16;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx, cy, 10, 16);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx + 2, cy - 2, 6, 2);
    }

    // Comfy Couch Centerpiece
    const couchY = 320;
    ctx.fillStyle = COLOURS.couchShadow;
    ctx.beginPath();
    ctx.roundRect(310, couchY, 340, 140, 24);
    ctx.fill();

    ctx.fillStyle = COLOURS.couch;
    ctx.beginPath();
    ctx.roundRect(325, couchY + 10, 310, 100, 20);
    ctx.fill();
    // Couch Cushions
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.roundRect(340, couchY + 50, 135, 75, 12);
    ctx.roundRect(485, couchY + 50, 135, 75, 12);
    ctx.fill();

    // Protagonist Gamer
    const gamerY = couchY + (running ? Math.sin(view.elapsed * 0.005) * 3 : 0);
    // Pajama Body
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(430, gamerY - 30, 95, 105, 18);
    ctx.fill();
    // Star patterns on pajamas
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    ctx.arc(455, gamerY, 4, 0, Math.PI * 2);
    ctx.arc(495, gamerY + 20, 5, 0, Math.PI * 2);
    ctx.arc(470, gamerY + 45, 4, 0, Math.PI * 2);
    ctx.fill();

    // Slippered feet kicked forward
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.ellipse(430, gamerY + 95, 16, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(525, gamerY + 95, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    const headX = 478;
    const headY = gamerY - 60;
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(headX, headY, 28, 0, Math.PI * 2);
    ctx.fill();

    // Messy Gamer Hair
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(headX, headY - 10, 30, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(headX - 30, headY - 14, 12, 22);

    // Gaming Headset
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(headX, headY - 8, 31, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#047857';
    ctx.fillRect(headX - 34, headY - 12, 8, 20);
    ctx.fillRect(headX + 26, headY - 12, 8, 20);

    // Expressions depending on state
    if (crashed) {
      // Shocked eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(headX - 10, headY, 9, 0, Math.PI * 2);
      ctx.arc(headX + 10, headY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(headX - 10, headY, 3, 0, Math.PI * 2);
      ctx.arc(headX + 10, headY, 3, 0, Math.PI * 2);
      ctx.fill();
      // Screaming mouth
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.ellipse(headX, headY + 16, 10, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      // VIP Cover Charge ticket slapped on forehead
      ctx.save();
      ctx.translate(headX - 32, headY - 32);
      ctx.rotate(-0.15);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(0, 0, 70, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('VIP $400 TAB', 35, 17);
      ctx.restore();
    } else if (view.cashoutX100 !== null) {
      // Peaceful closed smiling eyes
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(headX - 10, headY - 2, 7, 0.2, Math.PI - 0.2);
      ctx.arc(headX + 10, headY - 2, 7, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // Happy smile
      ctx.beginPath();
      ctx.arc(headX, headY + 8, 12, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Microwave pizza slice in hand!
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(530, gamerY + 20);
      ctx.lineTo(555, gamerY);
      ctx.lineTo(560, gamerY + 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(545, gamerY + 16, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Relaxed gaming focus
      const squint = tension * 3;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(headX - 14, headY - 4 + squint, 8, 6 - squint);
      ctx.fillRect(headX + 6, headY - 4 + squint, 8, 6 - squint);
      // Gentle smile
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(headX, headY + 10, 8, 0.1, Math.PI - 0.1);
      ctx.stroke();

      // Vibrating Gamepad
      const padShake = tension * 4 * Math.sin(view.elapsed * 0.08);
      ctx.save();
      ctx.translate(headX + padShake, gamerY + 26);
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 24, 8);
      ctx.fill();
      // Glowing gamepad LEDs
      ctx.fillStyle = COLOURS.accent;
      ctx.beginPath();
      ctx.arc(-10, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOURS.cashGreen;
      ctx.beginPath();
      ctx.arc(10, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // TV blue/cyan ambient light cast on room
    const tvPulse = 0.15 + 0.1 * Math.sin(view.elapsed * 0.007);
    const tvGrad = ctx.createRadialGradient(480, 200, 40, 480, 200, 360);
    tvGrad.addColorStop(0, `rgba(56, 189, 248, ${tvPulse})`);
    tvGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = tvGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Shattered window overlay on crash
    if (crashed) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(760, 100);
      ctx.lineTo(840, 230);
      ctx.lineTo(790, 280);
      ctx.moveTo(840, 230);
      ctx.lineTo(890, 160);
      ctx.moveTo(840, 230);
      ctx.lineTo(860, 310);
      ctx.stroke();

      // Raid banner
      ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
      ctx.fillRect(0, 0, 960, 540);
    }

    // HUD & Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText('COUCH SAVINGS HACK', 480, 42);

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('UNSPENT NIGHTLIFE FUND · BANK THE TAB', 480, 72);

    // Multiplier Display
    const multiplierColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.accent;
    ctx.fillStyle = multiplierColor;
    const punch = crashed ? 1 + 0.18 * clamp01(1 - crashAgeSec / 0.3) : 1;
    ctx.font = `800 ${Math.round(82 * punch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 136);

    // Milestone / Action Banner
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    let bannerText = 'Waiting to chill';
    if (view.phase === 'betting') bannerText = 'Grab a spot on the couch & lock the deadbolt';
    else if (crashed) bannerText = 'RAIDED! Dragged straight to a $400 cocktail lounge!';
    else if (view.cashoutX100 !== null) bannerText = 'SAVINGS BANKED: Tap water martini & hot pizza secured!';
    else if (currentMilestone) bannerText = currentMilestone[1];
    else if (running) bannerText = 'Declining expensive club texts...';

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.gold;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 202);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(line, 480, 508);

    ctx.restore();
  }

  return { draw };
}
