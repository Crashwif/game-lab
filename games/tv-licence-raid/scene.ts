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

const MILESTONES: [number, string][] = [
  [120, 'Incognito tab opened on laptop'],
  [150, 'Detector van parks outside driveway'],
  [200, 'Window blinds twitch in suspicion'],
  [250, 'Heavy knocks rattle the front door'],
  [300, 'Flashlight beams sweep living room'],
  [500, 'Bailiff peers straight through mail slot'],
  [1000, 'Megaphone demands unpaid licence fees'],
  [10000, 'Thermal camera tracks player on sofa'],
  [100000, 'SWAT enforcement van arrives outside'],
  [1000000, 'King Charles inspects TV personally'],
];

const COLOURS = {
  bgDark: '#080c14',
  roomWall: '#181e2b',
  roomFloor: '#12151d',
  windowFrame: '#1b2333',
  rainStreet: '#0c121e',
  vanWhite: '#e2e8f0',
  vanBlue: '#1e3a8a',
  vanYellow: '#fbbf24',
  highVis: '#d9f99d',
  highVisTrim: '#22c55e',
  crtGlow: '#67e8f9',
  alertRed: '#ef4444',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#38bdf8',
  cashout: '#4ade80',
  crashed: '#f87171',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [
      `Cashed out at ${formatX(view.cashoutX100)} · Curtains shut, £1,000 fine dodged!`,
      COLOURS.cashout,
    ];
  }
  if (view.stake === null) {
    return [crashed ? 'Bailiffs stormed the flat · No credits lost' : 'Tuning in · Watching without a stake', COLOURS.muted];
  }
  if (crashed) {
    return [`Raid caught you! Your ${credits(view.stake)} seized by enforcement`, COLOURS.crashed];
  }
  return [`Unlicensed stream active · ${credits(view.stake)} at risk`, COLOURS.accent];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastDoorKnockTime = 0;

  const rainDrops: { x: number; y: number; speed: number; len: number }[] = [];
  for (let i = 0; i < 45; i++) {
    rainDrops.push({
      x: 30 + Math.random() * 320,
      y: Math.random() * 240,
      speed: 8 + Math.random() * 12,
      len: 10 + Math.random() * 16,
    });
  }

  const sparks: Particle[] = [];

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Trigger audio cues
    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
      audio.fx('click', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('shatter', 1.0);
      audio.fx('door', 1.0);
      // Generate raid debris
      for (let i = 0; i < 30; i++) {
        sparks.push({
          x: 480 + (Math.random() - 0.5) * 80,
          y: 280 + (Math.random() - 0.5) * 80,
          vx: (Math.random() - 0.5) * 14,
          vy: -Math.random() * 12 - 2,
          life: 0,
          maxLife: 30 + Math.random() * 40,
          size: 3 + Math.random() * 6,
          color: Math.random() > 0.5 ? '#fde047' : '#f87171',
        });
      }
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        if (milestoneIndex >= 3) {
          audio.fx('siren', 0.5);
        }
      }
      // Rhythmic door rattle / heartbeat when tension builds
      if (tension > 0.4 && now - lastDoorKnockTime > Math.max(260, 1100 - tension * 800)) {
        lastDoorKnockTime = now;
        audio.fx('thud', 0.35 + tension * 0.5);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shakeMagnitude = crashed
      ? 18 * clamp01(1 - crashAgeSec / 0.8)
      : running
      ? Math.sin(now * 0.02) * tension * 3.5
      : 0;

    const shakeX = (Math.random() - 0.5) * shakeMagnitude * 2;
    const shakeY = (Math.random() - 0.5) * shakeMagnitude * 2;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. BASE BACKGROUND: Dim Living Room Interior
    ctx.fillStyle = COLOURS.bgDark;
    ctx.fillRect(0, 0, 960, 540);

    // Wallpaper with faint vertical stripes
    const wallGrad = ctx.createLinearGradient(0, 0, 0, 420);
    wallGrad.addColorStop(0, '#101726');
    wallGrad.addColorStop(1, '#080d16');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, 960, 420);

    ctx.fillStyle = '#0f1420';
    for (let x = 0; x < 960; x += 40) {
      ctx.fillRect(x, 0, 2, 420);
    }

    // Floorboards
    const floorGrad = ctx.createLinearGradient(0, 420, 0, 540);
    floorGrad.addColorStop(0, '#181210');
    floorGrad.addColorStop(1, '#090706');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 420, 960, 120);

    ctx.strokeStyle = '#231b17';
    ctx.lineWidth = 1;
    for (let y = 430; y < 540; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // 2. LEFT WINDOW: Night view with rainy street & DETECTOR VAN
    const winX = 40;
    const winY = 110;
    const winW = 300;
    const winH = 250;

    ctx.save();
    // Clip window area
    ctx.beginPath();
    ctx.rect(winX, winY, winW, winH);
    ctx.clip();

    // Dark outside street sky
    const streetSky = ctx.createLinearGradient(winX, winY, winX, winY + winH);
    streetSky.addColorStop(0, '#090e1a');
    streetSky.addColorStop(0.7, '#131b2e');
    streetSky.addColorStop(1, '#060a12');
    ctx.fillStyle = streetSky;
    ctx.fillRect(winX, winY, winW, winH);

    // Distant streetlamp
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(winX + 45, winY + 60, 8, 0, Math.PI * 2);
    ctx.fill();
    const lampGlow = ctx.createRadialGradient(winX + 45, winY + 60, 5, winX + 45, winY + 60, 90);
    lampGlow.addColorStop(0, 'rgba(254, 240, 138, 0.4)');
    lampGlow.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(winX - 50, winY, 200, 200);

    // Rain on glass
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    for (const drop of rainDrops) {
      drop.y += drop.speed;
      if (drop.y > winY + winH) {
        drop.y = winY - 10;
        drop.x = winX + Math.random() * winW;
      }
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 3, drop.y + drop.len);
      ctx.stroke();
    }

    // DETECTOR VAN OUTSIDE
    // Creeps closer based on tension
    const vanAdvance = tension * 45;
    const vanX = winX + 70 + vanAdvance;
    const vanY = winY + 140;

    // Van Body
    ctx.fillStyle = COLOURS.vanWhite;
    ctx.beginPath();
    ctx.roundRect(vanX, vanY, 140, 65, [12, 12, 2, 2]);
    ctx.fill();

    // Van Blue Decal Stripe
    ctx.fillStyle = COLOURS.vanBlue;
    ctx.fillRect(vanX, vanY + 30, 140, 14);

    // Yellow Chevron stripes on bumper
    ctx.fillStyle = COLOURS.vanYellow;
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.moveTo(vanX + 115 + c * 8, vanY + 48);
      ctx.lineTo(vanX + 120 + c * 8, vanY + 48);
      ctx.lineTo(vanX + 114 + c * 8, vanY + 62);
      ctx.lineTo(vanX + 109 + c * 8, vanY + 62);
      ctx.fill();
    }

    // "TV LICENSING" text on van
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TV LICENSING', vanX + 65, vanY + 40);

    // Van Wheels
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(vanX + 30, vanY + 65, 12, 0, Math.PI * 2);
    ctx.arc(vanX + 110, vanY + 65, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(vanX + 30, vanY + 65, 5, 0, Math.PI * 2);
    ctx.arc(vanX + 110, vanY + 65, 5, 0, Math.PI * 2);
    ctx.fill();

    // Radar dish on roof spinning fast with tension
    const radarAngle = (now * 0.005 * (1 + tension * 4)) % (Math.PI * 2);
    ctx.save();
    ctx.translate(vanX + 70, vanY - 6);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.rotate(radarAngle);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Flashing rooftop amber/blue beacon
    const strobe = (Math.sin(now * 0.015 * (1 + tension * 3)) + 1) * 0.5;
    ctx.fillStyle = strobe > 0.5 ? '#f59e0b' : '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(vanX + 95, vanY - 7, 12, 7, [2, 2, 0, 0]);
    ctx.fill();

    // Beacon glow
    const beaconGlow = ctx.createRadialGradient(vanX + 101, vanY - 5, 2, vanX + 101, vanY - 5, 45);
    beaconGlow.addColorStop(0, strobe > 0.5 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(59, 130, 246, 0.7)');
    beaconGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = beaconGlow;
    ctx.fillRect(vanX + 60, vanY - 45, 80, 80);

    ctx.restore();

    // Window frame
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.strokeRect(winX, winY, winW, winH);
    ctx.lineWidth = 4;
    // Crossbars
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, winY);
    ctx.lineTo(winX + winW / 2, winY + winH);
    ctx.moveTo(winX, winY + winH * 0.45);
    ctx.lineTo(winX + winW, winY + winH * 0.45);
    ctx.stroke();

    // Blinds twitching or closed on cashout
    if (cashedOut) {
      // Curtains completely closed!
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(winX + 2, winY + 2, winW - 4, winH - 4);
      ctx.fillStyle = '#0f172a';
      for (let sl = winY + 12; sl < winY + winH - 6; sl += 14) {
        ctx.fillRect(winX + 6, sl, winW - 12, 4);
      }
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CURTAINS DRAWN · SHHH!', winX + winW / 2, winY + winH / 2);
    } else {
      // Venetians slightly open, casting stripes
      const blindsOpen = 0.4 + 0.5 * Math.sin(now * 0.003);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      for (let sl = winY + 8; sl < winY + winH - 8; sl += 18) {
        ctx.fillRect(winX + 4, sl, winW - 8, 8 * (1 - blindsOpen * 0.2));
      }
    }

    // 3. FLASHLIGHT BEAM SWEEPING THE ROOM (from window towards protagonist)
    if (running && tension > 0.25 && !cashedOut) {
      ctx.save();
      const sweepAngle = Math.sin(now * 0.004) * 0.35 + 0.3;
      ctx.translate(winX + winW, winY + 100);
      ctx.rotate(sweepAngle);
      const beamGrad = ctx.createLinearGradient(0, 0, 420, 0);
      beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.4)');
      beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(440, -50 - tension * 30);
      ctx.lineTo(440, 50 + tension * 30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. FRONT DOOR (Center-Left)
    const doorX = 370;
    const doorY = 160;
    const doorW = 90;
    const doorH = 260;

    ctx.fillStyle = '#1c1917';
    ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 3;
    ctx.strokeRect(doorX, doorY, doorW, doorH);

    // Door knob & Letterbox
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(doorX + 16, doorY + 130, 5, 0, Math.PI * 2);
    ctx.fill();

    // Mail slot
    ctx.fillStyle = '#78716c';
    ctx.fillRect(doorX + 22, doorY + 180, 46, 12);
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(doorX + 25, doorY + 183, 40, 6);

    // Rattle visual particles if door is being knocked
    if (running && tension > 0.3 && (now - lastDoorKnockTime < 180)) {
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(doorX + 45, doorY + 110, 25, -0.6, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(doorX + 45, doorY + 110, 40, -0.4, 0.4);
      ctx.stroke();
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText('BAM BAM!', doorX + 45, doorY + 80);
    }

    // 5. THE PROTAGONIST (Huddled on Couch)
    const sofaX = 520;
    const sofaY = 270;

    // Couch Base
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(sofaX, sofaY + 60, 170, 75, 12);
    ctx.fill();
    // Armrests
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(sofaX - 10, sofaY + 40, 24, 90, 8);
    ctx.roundRect(sofaX + 155, sofaY + 40, 24, 90, 8);
    ctx.fill();

    // Protagonist Boy
    const sweatBounce = running ? Math.sin(now * 0.012) * (2 + tension * 5) : 0;
    const ladX = sofaX + 75;
    const ladY = sofaY + 45 + sweatBounce;

    if (!cashedOut && !crashed) {
      // Body in striped pajamas
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(ladX - 22, ladY + 10, 44, 50, [10, 10, 4, 4]);
      ctx.fill();
      // Pajama stripes
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      for (let s = ladY + 18; s < ladY + 56; s += 9) {
        ctx.beginPath();
        ctx.moveTo(ladX - 20, s);
        ctx.lineTo(ladX + 20, s);
        ctx.stroke();
      }

      // Head
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(ladX, ladY, 19, 0, Math.PI * 2);
      ctx.fill();

      // Messy bed-hair
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(ladX, ladY - 8, 17, Math.PI, Math.PI * 2);
      ctx.fill();

      // Terrified wide eyes
      const eyeWide = 4 + tension * 3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ladX - 6, ladY - 2, eyeWide, 0, Math.PI * 2);
      ctx.arc(ladX + 6, ladY - 2, eyeWide, 0, Math.PI * 2);
      ctx.fill();

      // Pupils darting frantically
      const pupilShift = Math.sin(now * 0.01) * 2;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ladX - 6 + pupilShift, ladY - 2, 2, 0, Math.PI * 2);
      ctx.arc(ladX + 6 + pupilShift, ladY - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // Trembling open mouth
      ctx.fillStyle = '#881337';
      ctx.beginPath();
      ctx.ellipse(ladX, ladY + 8, 3 + tension * 4, 3 + tension * 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Flying sweat drops
      if (tension > 0.1) {
        ctx.fillStyle = '#38bdf8';
        for (let i = 0; i < 3; i++) {
          const swTime = (now * 0.003 + i * 1.8) % 1;
          const swX = ladX + (i === 0 ? -24 : i === 1 ? 24 : 0) * swTime * 1.5;
          const swY = ladY - 14 - swTime * 18;
          ctx.beginPath();
          ctx.arc(swX, swY, 2.5 * (1 - swTime), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (cashedOut) {
      // Hiding under a cozy checkered duvet!
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(ladX, ladY + 25, 38, Math.PI, Math.PI * 2);
      ctx.fill();
      // Peeking eyes only
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ladX - 8, ladY + 12, 4, 0, Math.PI * 2);
      ctx.arc(ladX + 8, ladY + 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ladX - 7, ladY + 12, 2, 0, Math.PI * 2);
      ctx.arc(ladX + 9, ladY + 12, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Crashed: Protagonist screaming with hands in hair
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(ladX, ladY + 4, 19, 0, Math.PI * 2);
      ctx.fill();
      // Screaming big O-mouth
      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.ellipse(ladX, ladY + 12, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hands on face
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(ladX - 18, ladY - 2, 7, 0, Math.PI * 2);
      ctx.arc(ladX + 18, ladY - 2, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. RAID DEBRIS SPARKS ON CRASH
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]!;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45;
      p.life += 1;
      if (p.life >= p.maxLife) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 7. CRASH PENALTY SUMMONS STAMP OVERLAY
    if (crashed) {
      ctx.save();
      ctx.translate(480, 290);
      ctx.rotate(-0.1);
      ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-210, -48, 420, 96, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef2f2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 28px ui-monospace, monospace';
      ctx.fillText('UNLICENSED STREAM DETECTED', 0, -12);
      ctx.fillStyle = '#fde047';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillText('ENFORCEMENT SUMMONS ISSUED · £1,000 PENALTY', 0, 20);
      ctx.restore();
    }

    // 8. TOP & BOTTOM HUD OVERLAY
    ctx.fillStyle = 'rgba(8, 12, 20, 0.82)';
    ctx.fillRect(0, 0, 960, 74);
    ctx.fillRect(0, 444, 960, 96);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText('TV LICENCE RAID', 28, 28);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 14px ui-monospace, monospace';
    ctx.fillText(
      `DETECTOR SIGNAL: ${Math.round((tension * 0.85 + depth * 0.15) * 100)}% · ENFORCEMENT LEVEL ${milestoneIndex}/10`,
      28,
      54,
    );

    const punch = crashed ? (1 - clamp01((crashAgeSec - 0.1) / 0.3)) ** 2 : 0;
    ctx.textAlign = 'right';
    ctx.fillStyle = crashed ? COLOURS.crashed : cashedOut ? COLOURS.cashout : COLOURS.accent;
    ctx.font = `800 ${Math.round(52 * (1 + 0.2 * punch))}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 932, 38);

    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const phaseBanner =
      view.phase === 'waiting'
        ? 'Scanning postcode for unlicensed screens…'
        : view.phase === 'betting'
        ? 'Dim the lights and join before the detector van turns the corner'
        : view.phase === 'crashed'
        ? 'BAILIFFS BREACHED THE LIVING ROOM!'
        : activeMilestone?.[1] ?? 'Streaming in incognito mode…';

    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText(phaseBanner, 480, 472, 900);

    const [statusText, statusColour] = stakeLine(view);
    ctx.fillStyle = statusColour;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 510, 900);

    ctx.restore();
  }

  return { draw };
}

