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
  bgTop: '#090d18',
  bgBottom: '#171126',
  wallGrid: '#1e243b',
  accent: '#00f0ff',
  accentRgb: '#ff0055',
  glassGlow: '#00e5ff',
  deadPixel: '#39ff14',
  text: '#f2f6ff',
  muted: '#8e9bb3',
  crashed: '#ff3366',
  cashedOut: '#2df894',
  warning: '#ffb703',
  drywall: '#d8cfbe',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Single dead pixel lights up in lime green'],
  [150, 'Curved edge deflects flying drywall plaster'],
  [200, '144Hz overclock heats panel glass to toast'],
  [250, 'RGB strip flashes red distress beacon warnings'],
  [300, 'Stray splinter pings off titanium stand mount'],
  [500, 'Thermal paste starts bubbling across bezel edges'],
  [1000, 'Support ticket approved for legendary warranty tier'],
  [10000, 'Monitor develops sentient quantum ballistic skin'],
  [100000, 'Screen deflects orbiting space station junk easily'],
  [1000000, 'Indestructible display ascends to display heaven'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`RMA Approved at ${formatX(view.cashoutX100)} · Bubble-wrapped safe`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Matrix blowout observed · 0 credits lost' : 'Bunker spectator · Ready to test panels', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Panel shattered! Lost ${credits(view.stake)} in the debris`, COLOURS.crashed];
  }
  return [`Bunker reinforced · ${credits(view.stake)} on the 360Hz glass`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastPingSec = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('zap', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('clang', 0.7);
      }
      const curSec = Math.floor(view.elapsed / 450);
      if (curSec > lastPingSec && !cashed) {
        lastPingSec = curSec;
        audio.fx('tick', 0.3 + 0.5 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.5) ** 2 : (running ? Math.sin(now * 0.03) * (1 + 4 * tension) : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.07));

    // 1. Cyber Bunker Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Bunker Grid & Server racks
    ctx.strokeStyle = COLOURS.wallGrid;
    ctx.lineWidth = 1;
    for (let x = 40; x < 960; x += 55) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (x - 480) * 0.15, 540);
      ctx.stroke();
    }
    for (let y = 30; y < 540; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Drywall blast breach on left wall
    ctx.fillStyle = '#22191b';
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.lineTo(130, 210);
    ctx.lineTo(100, 310);
    ctx.lineTo(150, 420);
    ctx.lineTo(0, 490);
    ctx.closePath();
    ctx.fill();

    // 2. Incoming Plaster & Drywall Debris
    const timeSec = now * 0.001;
    if (running || (crashed && crashSec < 1.0)) {
      const debrisCount = 18 + Math.floor(tension * 24);
      for (let i = 0; i < debrisCount; i++) {
        const seed = i * 133.7;
        const speed = 260 + (seed % 340);
        const loopT = (timeSec * speed + seed) % 700;
        const debX = 80 + loopT * 0.7;
        const debY = 170 + ((seed * 19) % 240) + Math.sin(debX * 0.01) * 30;
        if (debX < 450) {
          ctx.save();
          ctx.translate(debX, debY);
          ctx.rotate(timeSec * 4 + i);
          ctx.fillStyle = i % 3 === 0 ? COLOURS.drywall : (i % 3 === 1 ? '#9e978e' : '#ffd166');
          const sz = 4 + (i % 7);
          ctx.fillRect(-sz / 2, -sz / 2, sz, sz * 0.7);
          ctx.restore();
        }
      }
    }

    // 3. Gamer Protagonist & Shield Centerpiece
    const centerX = 470;
    const centerY = 330;
    const gamerOffset = crashed ? Math.min(200, crashSec * 320) : 0;
    const gamerX = centerX + 45 + gamerOffset;
    const gamerY = centerY + (crashed ? Math.sin(crashSec * 6) * 30 : Math.sin(now * 0.005) * 3);

    // Laundry pile if crashed
    if (crashed) {
      ctx.fillStyle = '#d6e2e9';
      ctx.beginPath();
      ctx.ellipse(780, 440, 90, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef476f';
      ctx.fillRect(720, 420, 35, 20);
      ctx.fillStyle = '#118ab2';
      ctx.fillRect(760, 405, 45, 25);
    }

    // Gamer Body
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(gamerX + 25, gamerY + 45, 34, 48, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Sweat / Face
    ctx.fillStyle = '#ffbe98';
    ctx.beginPath();
    ctx.arc(gamerX + 10, gamerY - 15, 22, 0, Math.PI * 2);
    ctx.fill();

    // Headset
    ctx.strokeStyle = '#3a86ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(gamerX + 10, gamerY - 18, 25, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(gamerX + 26, gamerY - 24, 10, 16);
    ctx.fillRect(gamerX - 16, gamerY - 24, 10, 16);

    // Gamer Sweat drops
    if (running && tension > 0.2) {
      ctx.fillStyle = '#70d6ff';
      const dropY = gamerY - 10 + ((now * 0.2) % 30);
      ctx.beginPath();
      ctx.arc(gamerX + 2, dropY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gamer Arms holding monitor brackets
    ctx.strokeStyle = '#ffbe98';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gamerX + 15, gamerY + 20);
    ctx.lineTo(centerX - 10, gamerY + 10);
    ctx.stroke();

    // 4. Curved 360Hz Display Shield (or Glitched/Replaced)
    if (!crashed || crashSec < 0.1) {
      ctx.save();
      ctx.translate(centerX - 25, centerY);
      const shieldCurve = 0.35;

      // Glow behind shield
      const glow = ctx.createRadialGradient(-10, 0, 10, -10, 0, 120);
      const glowColor = tension > 0.6 ? 'rgba(255, 0, 85, 0.45)' : 'rgba(0, 240, 255, 0.35)';
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-120, -140, 240, 280);

      // Curved Screen Body (1000R Tactical Riot Curve)
      ctx.beginPath();
      ctx.ellipse(-15, 0, 36, 120, shieldCurve, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#1b1f2b';
      ctx.stroke();

      // Screen Glass Panel
      ctx.beginPath();
      ctx.ellipse(-20, 0, 34, 114, shieldCurve, -Math.PI * 0.43, Math.PI * 0.43);
      ctx.lineWidth = 10;
      ctx.strokeStyle = tension > 0.7 ? '#ffe8d6' : COLOURS.glassGlow;
      ctx.stroke();

      // RGB Edge Glow Strip
      const rgbColor = `hsl(${(now * 0.2) % 360}, 100%, 60%)`;
      ctx.beginPath();
      ctx.ellipse(-24, 0, 34, 110, shieldCurve, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.lineWidth = 3;
      ctx.strokeStyle = tension > 0.4 ? (Math.sin(now * 0.03) > 0 ? '#ff0044' : '#ffea00') : rgbColor;
      ctx.stroke();

      // Heat sinks & decals mounting up with tension
      if (tension > 0.25) {
        ctx.fillStyle = '#ff6b35';
        for (let k = -70; k <= 70; k += 35) {
          ctx.fillRect(8, k - 4, 14 + 10 * depth, 8);
        }
      }

      // Lime green dead pixel milestone marker
      if (view.currentX100 >= 120) {
        ctx.fillStyle = COLOURS.deadPixel;
        ctx.fillRect(-22, -25, 4, 4);
        ctx.shadowColor = COLOURS.deadPixel;
        ctx.shadowBlur = 6;
        ctx.fillRect(-22, -25, 4, 4);
        ctx.shadowBlur = 0;
      }

      // Spark deflections at the shield impact front
      if (running) {
        const sparkCount = 4 + Math.floor(tension * 8);
        for (let s = 0; s < sparkCount; s++) {
          const spY = (Math.sin(timeSec * 9 + s * 2.1) * 85);
          const spX = -32 - Math.random() * 18;
          ctx.fillStyle = s % 2 === 0 ? '#ffdd00' : '#ffffff';
          ctx.fillRect(spX, spY, 3, 3);
        }
      }

      // Warranty Tag on shield
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-6, 65, 24, 14);
      ctx.fillStyle = '#000000';
      ctx.font = '700 8px monospace';
      ctx.fillText('360Hz', 6, 75);
      ctx.restore();
    }

    // 5. Cashout Drone Celebration: New Pristine Screen Clamped On
    if (cashed && (!crashed || crashSec < 2.0)) {
      const droneY = centerY - 110 + Math.sin(now * 0.007) * 8;
      // Drone Body
      ctx.fillStyle = '#374151';
      ctx.fillRect(centerX - 50, droneY, 60, 20);
      // Rotors
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - 80, droneY + 2);
      ctx.lineTo(centerX - 20, droneY + 2);
      ctx.moveTo(centerX - 20, droneY + 2);
      ctx.lineTo(centerX + 40, droneY + 2);
      ctx.stroke();

      // Bubble wrap monitor snapped into position
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 4;
      ctx.strokeRect(centerX - 62, centerY - 80, 26, 160);
      ctx.fillRect(centerX - 62, centerY - 80, 26, 160);

      // Gold RMA Stamp
      ctx.fillStyle = '#ffd166';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('✓ RMA REPLACED', centerX - 50, centerY);
    }

    // 6. Crash Glitch Rainbow Blast & LCD Matrix Shatter
    if (crashed) {
      const burstR = Math.min(380, crashSec * 480);
      const shardAlpha = clamp01(1 - crashSec / 1.5);
      const shardCount = 36;
      for (let i = 0; i < shardCount; i++) {
        const ang = (i / shardCount) * Math.PI * 2;
        const dist = burstR * (0.4 + 0.6 * ((i * 37) % 10) / 10);
        const px = centerX - 25 + Math.cos(ang) * dist;
        const py = centerY + Math.sin(ang) * dist;
        const rgbIdx = i % 3;
        ctx.fillStyle = rgbIdx === 0 ? '#ff0055' : (rgbIdx === 1 ? '#00f0ff' : '#39ff14');
        ctx.globalAlpha = shardAlpha;
        ctx.fillRect(px - 5, py - 5, 10, 8);
      }
      ctx.globalAlpha = 1;
    }

    // 7. HUD Overlays & Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Bunker status
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText('PIXEL SHIELD', 480, 48);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 14px ui-monospace, monospace';
    ctx.fillText('360Hz BALLISTIC BUNKER · DEBRIS INTERCEPT PROTOCOL', 480, 78);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.accent);
    const punch = crashed ? clamp01(1 - crashSec / 0.3) * 0.2 : 0;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${78 * (1 + punch)}px ui-monospace, monospace`;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = running ? 12 : 4;
    ctx.fillText(formatX(view.currentX100), 480, 142);
    ctx.shadowBlur = 0;

    // Milestone Pop Banner
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    const bannerText = running
      ? (currentMilestone ? currentMilestone[1] : 'Hold the monitor tight! Plaster incoming...')
      : (crashed ? 'SCREEN MATRIX PULVERIZED INTO DEAD PIXELS' : (cashed ? 'WARRANTY SECURED · SHIELD SWAPPED' : 'Awaiting Next Artillery Round'));

    ctx.fillStyle = view.phase === 'crashed' ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.warning);
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 458, 860);

    // Stake & Net result footer
    const [statusLine, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(statusLine, 480, 492, 860);

    ctx.restore();
  }

  return { draw };
}
