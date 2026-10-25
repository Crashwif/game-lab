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
  skyDusk: '#0b1325',
  grass: '#1f3d1a',
  asphalt: '#1e232a',
  roadLine: '#f0c242',
  mowerGreen: '#3fa336',
  ductTape: '#b0b8c2',
  leafBlower: '#e85d04',
  flameOrange: '#ff5400',
  sparks: '#ffd166',
  smoke: 'rgba(210, 220, 230, 0.45)',
  accent: '#39ff14',
  crashed: '#ff3366',
  cashedOut: '#4ade80',
  hudText: '#f8fafc',
  hudMuted: '#94a3b8',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Duct tape holds twin leaf-blowers to mower deck'],
  [150, 'Pull cord rips lawnmower engine into furious idle'],
  [200, 'Suburban driveway asphalt starts smoking lightly'],
  [250, 'Roman candle batteries arm on the mower hood'],
  [300, 'Neighbor peeks through fence blinds in sheer shock'],
  [500, 'Mower reaches 70mph down the neighborhood cul-de-sac'],
  [1000, 'Sparks shower from retrofitted trimmer blades'],
  [10000, 'Military satellites recalibrate to monitor shed'],
  [100000, 'Mower achieves low-altitude suburban hover mode'],
  [1000000, 'Defense contract awarded to dad in dirty cargo shorts'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  if (view.cashoutX100 !== null) {
    return [`Coasted safely into shed at ${formatX(view.cashoutX100)} · HOA baffled`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Engine detonated · Spectating' : 'Scouting from lawn chair · No stake', COLOURS.hudMuted];
  }
  if (view.phase === 'crashed') {
    return [`Blew ${credits(view.stake)} into three subdivisions`, COLOURS.crashed];
  }
  return [`Throttle pinned! ${credits(view.stake)} locked on the deck`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'hardstyle', crash: 'boom' });
  let prevPhase: SceneView['phase'] | null = null;
  let prevMilestone = 0;
  let prevCashout: number | null = null;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (prevPhase !== null && running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('whoosh', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('boom', prevPhase === null || view.crashAge > 1500);
      audio.fx('yeet', 0.9);
    }
    if (running && prevPhase === 'running' && milestoneIdx > prevMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('ratchet', 0.6 + tension * 0.4);
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashAgeS = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 16 * clamp01(1 - crashAgeS / 0.8)
      : running ? (1 + 7 * tension) : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // Sky & Suburban Dusk Backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, '#060a14');
    skyGrad.addColorStop(0.6, COLOURS.skyDusk);
    skyGrad.addColorStop(1, '#1b2838');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Defense satellite targeting lines if deep into round
    if (depth > 0.3) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 60, 60, ${0.15 + 0.35 * Math.sin(now * 0.005)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(340, 200, 280, 180);
      ctx.beginPath();
      ctx.moveTo(480, 180); ctx.lineTo(480, 400);
      ctx.moveTo(320, 290); ctx.lineTo(640, 290);
      ctx.stroke();
      ctx.restore();
    }

    // Suburban Roofline silhouettes & fences
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.lineTo(80, 280); ctx.lineTo(160, 320);
    ctx.lineTo(240, 290); ctx.lineTo(310, 320);
    ctx.lineTo(400, 275); ctx.lineTo(480, 320);
    ctx.lineTo(600, 285); ctx.lineTo(720, 320);
    ctx.lineTo(820, 270); ctx.lineTo(960, 320);
    ctx.lineTo(960, 350); ctx.lineTo(0, 350);
    ctx.fill();

    // Oak tree in background
    ctx.fillStyle = '#0a1d12';
    ctx.beginPath();
    ctx.arc(850, 240, 60, 0, Math.PI * 2);
    ctx.arc(880, 220, 45, 0, Math.PI * 2);
    ctx.arc(810, 230, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(840, 290, 22, 60);

    // Front lawn & cul-de-sac asphalt
    ctx.fillStyle = COLOURS.grass;
    ctx.fillRect(0, 330, 960, 60);
    ctx.fillStyle = COLOURS.asphalt;
    ctx.fillRect(0, 380, 960, 160);

    // Speed lines on road
    const speed = running ? (view.elapsed * 0.7 * (1 + tension * 2)) : (crashed ? 0 : 40);
    ctx.fillStyle = COLOURS.roadLine;
    for (let x = -80; x < 1040; x += 110) {
      const rx = (x - (speed % 110));
      ctx.fillRect(rx, 460, 55, 8);
    }

    // Flying lawn clippings & sparks behind mower
    const particleCount = running ? Math.floor(15 + tension * 40) : (crashed && crashAgeS < 0.9 ? 80 : 0);
    for (let i = 0; i < particleCount; i++) {
      const pSeed = (i * 97 + (crashed ? crashAgeS * 400 : view.elapsed * 0.2)) % 380;
      const px = crashed ? 480 + (Math.sin(i * 13) * crashAgeS * 350) : 420 - pSeed * 1.1;
      const py = crashed ? 380 - Math.sin(i * 7) * 200 * crashAgeS + (crashAgeS ** 2) * 120 : 400 + Math.sin(i + view.elapsed * 0.01) * 35;
      ctx.fillStyle = i % 3 === 0 ? COLOURS.sparks : (i % 2 === 0 ? '#48bb78' : COLOURS.flameOrange);
      ctx.beginPath();
      ctx.arc(px, py, 2 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Protagonist & Mower Centerpiece
    const mowerX = 490;
    const mowerBaseY = 375;
    const mowerBob = running ? Math.sin(view.elapsed * 0.035) * (2 + 4 * tension) : 0;
    const my = mowerBaseY + mowerBob;

    if (!crashed || crashAgeS < 0.25) {
      // Roman candle fireballs shooting forward-up
      if (running && tension > 0.2) {
        ctx.fillStyle = COLOURS.flameOrange;
        ctx.beginPath();
        const fSize = 10 + 20 * tension + Math.sin(now * 0.05) * 6;
        ctx.ellipse(mowerX + 85, my - 25, fSize, fSize * 0.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.arc(mowerX + 85, my - 25, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Exhaust pipe & two-stroke smoke plume
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(mowerX - 10, my - 45, 10, 35);
      ctx.fillStyle = COLOURS.smoke;
      for (let s = 1; s <= 4; s++) {
        const puffX = mowerX - 15 - s * 22;
        const puffY = my - 50 - s * 10 + Math.sin(view.elapsed * 0.01 + s) * 6;
        ctx.beginPath();
        ctx.arc(puffX, puffY, 8 + s * 4 + tension * 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mower green chassis
      ctx.fillStyle = COLOURS.mowerGreen;
      ctx.beginPath();
      ctx.roundRect(mowerX - 55, my - 20, 125, 36, [10, 18, 4, 4]);
      ctx.fill();

      // Mower hood & engine block
      ctx.fillStyle = '#2f855a';
      ctx.fillRect(mowerX + 15, my - 34, 50, 16);

      // Silver Duct Tape bands
      ctx.fillStyle = COLOURS.ductTape;
      ctx.fillRect(mowerX + 22, my - 36, 12, 22);
      ctx.fillRect(mowerX + 44, my - 36, 12, 22);
      ctx.fillRect(mowerX - 25, my - 15, 14, 25);

      // Twin Leaf Blowers strapped on sides
      ctx.fillStyle = COLOURS.leafBlower;
      ctx.beginPath();
      ctx.ellipse(mowerX + 30, my - 16, 26, 11, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Blower nozzle
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(mowerX + 54, my - 20, 32, 8);

      // Wheels (front small, back big turf tire)
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(mowerX - 35, my + 18, 22, 0, Math.PI * 2);
      ctx.arc(mowerX + 50, my + 18, 15, 0, Math.PI * 2);
      ctx.fill();
      // Yellow mower rims
      ctx.fillStyle = '#f6e05e';
      ctx.beginPath();
      ctx.arc(mowerX - 35, my + 18, 11, 0, Math.PI * 2);
      ctx.arc(mowerX + 50, my + 18, 7, 0, Math.PI * 2);
      ctx.fill();

      // Steering wheel
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(mowerX + 8, my - 18);
      ctx.lineTo(mowerX + 16, my - 44);
      ctx.stroke();

      // Suburban Dad Driver
      // Cargo shorts & legs
      ctx.fillStyle = '#c7b299';
      ctx.fillRect(mowerX - 20, my - 15, 20, 14);
      // Torso & Dad polo shirt
      ctx.fillStyle = '#2b6cb0';
      ctx.fillRect(mowerX - 22, my - 48, 26, 34);
      // Arms gripping steering wheel
      ctx.strokeStyle = '#fbd38d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(mowerX - 10, my - 38);
      ctx.lineTo(mowerX + 16, my - 44);
      ctx.stroke();
      // Head & Safety Goggles
      ctx.fillStyle = '#fbd38d';
      ctx.beginPath();
      ctx.arc(mowerX - 8, my - 60, 13, 0, Math.PI * 2);
      ctx.fill();
      // Safety Goggles visor band
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(mowerX - 4, my - 64, 10, 7);
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(mowerX - 18, my - 63, 15, 4);
      // Red cap / ears
      ctx.fillStyle = '#e53e3e';
      ctx.beginPath();
      ctx.arc(mowerX - 10, my - 67, 12, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(mowerX - 14, my - 68, 22, 4);

      // Safe Escape / Parachute deployment
      if (cashedOut) {
        // Red Gingham Barbecue Apron Parachute billows behind
        ctx.save();
        ctx.strokeStyle = '#edf2f7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mowerX - 18, my - 40);
        ctx.lineTo(mowerX - 120, my - 110);
        ctx.moveTo(mowerX - 18, my - 30);
        ctx.lineTo(mowerX - 120, my - 60);
        ctx.stroke();

        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.arc(mowerX - 120, my - 85, 36, 0.4 * Math.PI, 1.6 * Math.PI, true);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 13px sans-serif';
        ctx.fillText('KISS THE COOK', mowerX - 125, my - 82);
        ctx.restore();
      }
    } else {
      // CRASH DETONATION AFTERMATH
      const blastRadius = Math.min(180, crashAgeS * 260);
      const blastAlpha = clamp01(1 - crashAgeS / 1.1);

      // Fireball burst
      const blastGrad = ctx.createRadialGradient(mowerX, my, 10, mowerX, my, blastRadius);
      blastGrad.addColorStop(0, `rgba(255, 255, 255, ${blastAlpha})`);
      blastGrad.addColorStop(0.3, `rgba(255, 140, 0, ${blastAlpha * 0.9})`);
      blastGrad.addColorStop(0.8, `rgba(220, 38, 38, ${blastAlpha * 0.6})`);
      blastGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = blastGrad;
      ctx.beginPath();
      ctx.arc(mowerX, my, blastRadius, 0, Math.PI * 2);
      ctx.fill();

      // Ejected Dad flying toward the oak tree!
      const ejectX = mowerX + crashAgeS * 280;
      const ejectY = my - crashAgeS * 190 + (crashAgeS ** 2) * 90;
      ctx.save();
      ctx.translate(ejectX, ejectY);
      ctx.rotate(crashAgeS * 14);
      ctx.fillStyle = '#fbd38d';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#2b6cb0';
      ctx.fillRect(-12, -4, 24, 10);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(0, -7, 8, 5);
      ctx.restore();

      // Smoldering mower carcass on asphalt
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(mowerX - 50, my + 5, 90, 20);
      ctx.fillStyle = COLOURS.smoke;
      ctx.beginPath();
      ctx.arc(mowerX - 10, my - 15, 25 * blastAlpha, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD Header / Banner
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.letterSpacing = '2px';
    ctx.fillText('SHED ARSENAL : DIY WEAPONS PLATFORM', 480, 48);

    // Huge Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.cashedOut : (tension > 0.6 ? '#f59e0b' : COLOURS.accent));
    ctx.fillStyle = multColor;
    const multPulse = 1 + (running ? 0.08 * Math.sin(view.elapsed * 0.015) * tension : 0);
    ctx.font = `900 ${Math.floor(82 * multPulse)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 126);

    // Milestone Ticker / HOA Threat Alert
    const activeBeat = MILESTONES[milestoneIdx - 1];
    const bannerText = crashed
      ? 'TURBO BLOWER OVERPRESSURE · SUBDIVISION COVERED IN MULCH'
      : (activeBeat ? activeBeat[1] : (running ? 'Nitro weed-whacker idling at peak RPM' : 'Tune mower engine & attach blowers'));

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.cashedOut : '#334155');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(160, 185, 640, 40, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.cashedOut : COLOURS.hudText);
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 205, 620);

    // Stake line
    const [statusStr, statusClr] = stakeLine(view);
    ctx.fillStyle = statusClr;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(statusStr, 480, 502);

    ctx.restore();
  }

  return { draw };
}
