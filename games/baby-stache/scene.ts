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
  bgTop: '#1b233a',
  bgBottom: '#0c101d',
  cribWood: '#8d5524',
  cribGold: '#e8a939',
  cribLining: '#fce4ec',
  babySkin: '#ffc5a8',
  babyBlush: '#ff8c94',
  swaddle: '#90caf9',
  suitNavy: '#1a237e',
  mustache: '#1a1008',
  pomade: '#78909c',
  text: '#ffffff',
  accent: '#ffd54f',
  crashed: '#ff5252',
  cashedOut: '#69f0ae',
  muted: '#9e9e9e',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Baby sprouts thick bristles right over pacifier'],
  [150, 'Tiny handlebar twirls with pomade shine'],
  [200, 'Baby swaps milky bottle for cold brew espresso'],
  [250, 'Crib gets upgraded with leather ergonomic rails'],
  [300, 'Baby checks mortgage interest rates on monitor'],
  [500, 'Full walrus mustache touches baby bib edges'],
  [1000, 'Tiny suit vest buttons pop on chubby tummy'],
  [10000, 'Boardroom nursery votes baby permanent chairman'],
  [100000, 'Baby buys distressed commercial real estate'],
  [1000000, 'Supreme mustache patriarch ascends beyond time'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`RETIRED TO FLORIDA AT ${formatX(view.cashoutX100)} · 401(k) ROLLED OVER`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Watched the blowout · nursery safe' : 'Watching cribside · no credits committed', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Colic blowout cost ${credits(view.stake)} in damages`, COLOURS.crashed];
  }
  return [`Baby riding with ${credits(view.stake)} · speedrunning midlife crisis`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let prevBeat = 0;

  function drawMustache(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    span: number,
    curl: number,
    thickness: number,
  ): void {
    ctx.save();
    ctx.fillStyle = COLOURS.mustache;
    ctx.strokeStyle = COLOURS.mustache;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';

    // Left handlebar
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(
      cx - span * 0.45,
      cy + thickness * 0.3,
      cx - span * 0.85,
      cy - curl * 0.3,
      cx - span,
      cy - curl,
    );
    ctx.stroke();

    // Right handlebar
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(
      cx + span * 0.45,
      cy + thickness * 0.3,
      cx + span * 0.85,
      cy - curl * 0.3,
      cx + span,
      cy - curl,
    );
    ctx.stroke();

    // Center bulk
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, span * 0.4, thickness * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pomade shine highlight
    ctx.strokeStyle = COLOURS.pomade;
    ctx.lineWidth = Math.max(1.5, thickness * 0.25);
    ctx.beginPath();
    ctx.arc(cx - span * 0.5, cy - curl * 0.2, span * 0.2, 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + span * 0.5, cy - curl * 0.2, span * 0.2, 0.2, Math.PI * 0.8);
    ctx.stroke();

    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Eurodance beat rhythm (~140 BPM => ~428ms per beat)
    const beatPhase = (view.elapsed % 428) / 428;
    const currentBeat = Math.floor(view.elapsed / 428);
    const bounce = Math.sin(beatPhase * Math.PI) * (6 + 12 * tension);

    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('cheer', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.7);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIndex > prevMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('bell', 0.6);
      }
      if (currentBeat > prevBeat && !cashed) {
        audio.fx('tick', 0.25 + 0.35 * tension);
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;
    prevBeat = currentBeat;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashSec / 0.6) ** 2 : 0;

    ctx.save();
    ctx.clearRect(0, 0, 960, 540);

    // Screen shake on crash
    if (shake > 0) {
      ctx.translate(shake * Math.sin(crashSec * 60), shake * Math.cos(crashSec * 45));
    }

    // Room Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Eurodance strobe / laser lights when multiplier gets wild
    if (running && tension > 0.4) {
      ctx.save();
      ctx.globalAlpha = 0.12 * tension * (0.6 + 0.4 * Math.sin(view.elapsed * 0.02));
      const sweep = Math.sin(view.elapsed * 0.005) * 480;
      const laserGrad = ctx.createRadialGradient(480 + sweep, 200, 20, 480, 270, 500);
      laserGrad.addColorStop(0, '#ff007f');
      laserGrad.addColorStop(0.5, '#00e5ff');
      laserGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = laserGrad;
      ctx.fillRect(0, 0, 960, 540);
      ctx.restore();
    }

    // Executive Mobile above Crib (Briefcase, Calculator, 401k icon, Pacifier)
    ctx.save();
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 2;
    const mobileSway = Math.sin(view.elapsed * 0.003) * 16;
    ctx.beginPath();
    ctx.moveTo(480, 0);
    ctx.lineTo(480 + mobileSway, 70);
    ctx.lineTo(400 + mobileSway, 95);
    ctx.moveTo(480 + mobileSway, 70);
    ctx.lineTo(560 + mobileSway, 95);
    ctx.stroke();

    // Floating icons
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💼', 395 + mobileSway, 125);
    ctx.fillText('📈', 475 + mobileSway, 105);
    ctx.fillText('🍼', 565 + mobileSway, 125);
    ctx.restore();

    // Crib base & Baby coordinates
    const cribX = 480;
    const cribY = 320 - (running ? bounce : 0);

    // Spreadsheets & IRS 1040 paperwork piles fluttering near crib
    ctx.save();
    const paperCount = Math.min(8, Math.floor(tension * 9));
    for (let i = 0; i < paperCount; i++) {
      const px = 280 + i * 50 + Math.sin(view.elapsed * 0.002 + i) * 6;
      const py = 390 - i * 4;
      const rot = (i % 2 === 0 ? 0.08 : -0.08) * (i + 1);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(-22, -30, 44, 60);
      ctx.fillStyle = '#37474f';
      ctx.fillRect(-16, -24, 32, 4);
      ctx.fillStyle = '#b0bec5';
      ctx.fillRect(-16, -16, 26, 2);
      ctx.fillRect(-16, -10, 30, 2);
      ctx.fillRect(-16, -4, 20, 2);
      ctx.font = '700 8px monospace';
      ctx.fillStyle = '#d32f2f';
      ctx.fillText('1040', 0, 18);
      ctx.restore();
    }
    // Espresso Cold Brew Cup
    if (view.currentX100 >= 200) {
      ctx.save();
      ctx.translate(650, 360);
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(-14, -26, 28, 38);
      ctx.fillStyle = '#d7ccc8';
      ctx.fillRect(-16, -30, 32, 6);
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(0, -7, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('ESPR', 0, -4);
      ctx.restore();
    }
    ctx.restore();

    // Crib Drawing
    ctx.save();
    // Crib rear wall
    ctx.fillStyle = COLOURS.cribWood;
    ctx.beginPath();
    ctx.roundRect(cribX - 160, cribY - 40, 320, 150, 16);
    ctx.fill();

    // Crib mattress & soft fleece
    ctx.fillStyle = COLOURS.cribLining;
    ctx.beginPath();
    ctx.ellipse(cribX, cribY + 50, 140, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // BABY BODY & HEAD
    const babyY = cribY + 10;
    const isTantrum = crashed && crashSec < 1.4;

    // Swaddle / Tiny suit vest
    ctx.fillStyle = view.currentX100 >= 1000 ? COLOURS.suitNavy : COLOURS.swaddle;
    ctx.beginPath();
    ctx.ellipse(cribX, babyY + 36, 52, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // Little red corporate tie if baby escalated
    if (view.currentX100 >= 250) {
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.moveTo(cribX - 7, babyY + 15);
      ctx.lineTo(cribX + 7, babyY + 15);
      ctx.lineTo(cribX + 11, babyY + 45);
      ctx.lineTo(cribX, babyY + 55);
      ctx.lineTo(cribX - 11, babyY + 45);
      ctx.closePath();
      ctx.fill();
    }

    // Chubby Baby Face
    ctx.fillStyle = isTantrum ? '#ff8a80' : COLOURS.babySkin;
    ctx.beginPath();
    ctx.arc(cribX, babyY - 10, 48, 0, Math.PI * 2);
    ctx.fill();

    // Rosy cheeks
    ctx.fillStyle = COLOURS.babyBlush;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cribX - 28, babyY + 4, 11, 0, Math.PI * 2);
    ctx.arc(cribX + 28, babyY + 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Baby Eyes
    if (isTantrum) {
      // Screaming squint eyes + tear geysers
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cribX - 30, babyY - 14);
      ctx.lineTo(cribX - 14, babyY - 10);
      ctx.lineTo(cribX - 30, babyY - 6);
      ctx.moveTo(cribX + 30, babyY - 14);
      ctx.lineTo(cribX + 14, babyY - 10);
      ctx.lineTo(cribX + 30, babyY - 6);
      ctx.stroke();

      // Flying tears
      ctx.fillStyle = '#29b6f6';
      for (let t = 0; t < 6; t++) {
        const tearDist = (crashSec * 350 + t * 40) % 220;
        ctx.beginPath();
        ctx.arc(cribX - 25 - tearDist * 0.7, babyY - 10 - tearDist * 0.3, 5, 0, Math.PI * 2);
        ctx.arc(cribX + 25 + tearDist * 0.7, babyY - 10 - tearDist * 0.3, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (cashed) {
      // Cool retiree aviator sunglasses!
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.roundRect(cribX - 38, babyY - 24, 32, 22, 6);
      ctx.roundRect(cribX + 6, babyY - 24, 32, 22, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cribX - 6, babyY - 16);
      ctx.lineTo(cribX + 6, babyY - 16);
      ctx.stroke();
    } else {
      // Big ambitious eyes staring at charts
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.arc(cribX - 18, babyY - 14, 7, 0, Math.PI * 2);
      ctx.arc(cribX + 18, babyY - 14, 7, 0, Math.PI * 2);
      ctx.fill();
      // Eye highlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cribX - 20, babyY - 16, 2.5, 0, Math.PI * 2);
      ctx.arc(cribX + 16, babyY - 16, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Gold Monocle if multiplier >= 300
      if (view.currentX100 >= 300) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cribX + 18, babyY - 14, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cribX + 33, babyY - 14);
        ctx.lineTo(cribX + 45, babyY + 30);
        ctx.stroke();
      }
    }

    // THE HANDLEBAR MUSTACHE
    // Mustache parameters scale with tension and depth
    const baseSpan = 14 + tension * 46 + depth * 35;
    const baseCurl = 4 + tension * 26 + depth * 18;
    const baseThick = 4 + tension * 12 + depth * 6;

    if (crashed) {
      // Crash: Mustache detaches and flies away spinning!
      const flyY = babyY - crashSec * 160;
      const flyX = cribX + crashSec * 140;
      ctx.save();
      ctx.translate(flyX, flyY);
      ctx.rotate(crashSec * 15);
      drawMustache(ctx, 0, 0, baseSpan, baseCurl, baseThick);
      ctx.restore();

      // Pacifier blowout flying off
      const pY = babyY + 20 - crashSec * 220;
      const pX = cribX - crashSec * 160;
      ctx.save();
      ctx.translate(pX, pY);
      ctx.rotate(-crashSec * 18);
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Normal mustache or early pacifier
      if (view.currentX100 < 120) {
        // Just the pacifier
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(cribX, babyY + 12, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cribX, babyY + 12, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Mustache twirls and dances
        const twirl = baseCurl + Math.sin(view.elapsed * 0.01) * 3;
        drawMustache(ctx, cribX, babyY + 8, baseSpan, twirl, baseThick);
      }
    }

    // Crib Slats in Front
    ctx.fillStyle = view.currentX100 >= 250 ? COLOURS.cribGold : '#bcaaa4';
    for (let s = -140; s <= 140; s += 28) {
      ctx.fillRect(cribX + s - 3, cribY + 10, 6, 75);
    }
    // Front top rail
    ctx.fillRect(cribX - 155, cribY + 6, 310, 12);
    ctx.restore();

    // RETIREMENT CASHOUT OVERLAY: Florida Palm & Golf Cart
    if (cashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 238, 88, 0.2)';
      ctx.fillRect(0, 0, 960, 540);

      // Early Retirement Stamp
      ctx.save();
      ctx.translate(220, 260);
      ctx.rotate(-0.15);
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 6;
      ctx.strokeRect(-160, -38, 320, 76);
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('401(k) APPROVED', 0, -4);
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillText('FLORIDA RETIREMENT CONFIRMED', 0, 22);
      ctx.restore();

      // Mini Golf Cart escaping to the right
      const cartX = 720 + Math.sin(view.elapsed * 0.005) * 15;
      ctx.font = '54px sans-serif';
      ctx.fillText('🛺🌴', cartX, 360);
      ctx.restore();
    }

    // CRASH BANNER OVERLAY
    if (crashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 23, 68, 0.16)';
      ctx.fillRect(0, 0, 960, 540);

      ctx.save();
      ctx.translate(480, 250);
      ctx.rotate(-0.06);
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(-240, -42, 480, 84);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(-240, -42, 480, 84);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('COLIC BLOWOUT GASKET POPPED!', 0, 0);
      ctx.restore();
      ctx.restore();
    }

    // HUD: Multiplier, Title, Milestones
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 36px system-ui, sans-serif';
    ctx.fillText('BABY STACHE', 480, 46);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.accent;
    ctx.fillText('SPEEDRUNNING MIDLIFE CRISIS FROM THE CRIB · 1040 TAX CRUNCH', 480, 76);

    // Huge Multiplier
    const punch = crashed ? (1 - clamp01((crashSec - 0.1) / 0.3)) ** 2 : 0;
    const multColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.text;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${76 * (1 + 0.18 * punch)}px monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 140);

    // Milestone Caption / Current status banner
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    ctx.fillStyle = COLOURS.accent;
    ctx.font = '700 20px system-ui, sans-serif';
    const statusText = running
      ? (currentMilestone ? currentMilestone[1] : 'Sprouting fresh whiskers...')
      : crashed
        ? 'Baby lost his mustache in a colic rattle cloud'
        : 'Naptime in progress · Place bets';
    ctx.fillText(statusText, 480, 470);

    // Stake Line / Cashout Banner
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(line, 480, 508);

    ctx.restore();
  }

  return { draw };
}
