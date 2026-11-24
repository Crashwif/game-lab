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
  [120, 'Duffel edges touch the painted yellow cage lines'],
  [150, 'Traveler applies first tentative knee stomp'],
  [200, 'Zipper seam stretches to reveal orange fleece'],
  [250, 'Gate agent clears throat and raises inspection pen'],
  [300, 'Both feet now off the airport floor on the bag'],
  [500, 'Metal sizer box begins making structural groan'],
  [1000, 'Wheels of the bag bend inward under raw pressure'],
  [10000, 'Entire gate concourse turns around to watch flex'],
  [100000, 'Welded iron frame begins glowing under stress'],
  [1000000, 'Luggage reaches density of a neutron suitcase'],
];

const COLOURS = {
  bgTop: '#1b2438',
  bgFloor: '#141a29',
  floorTile: '#253046',
  yellowStripe: '#fbbf24',
  cageSteel: '#94a3b8',
  cageWarning: '#f59e0b',
  bagBody: '#ec4899',
  bagHighlight: '#f472b6',
  agentSuit: '#1e3a8a',
  accent: '#38bdf8',
  crashed: '#ef4444',
  cashedOut: '#22c55e',
  text: '#f8fafc',
  muted: '#94a3b8',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  type: 'sock' | 'magnet' | 'star' | 'bubble';
  color: string;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'dnb', crash: 'thud' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastStompTick = 0;

  // Pre-seeded particles for crash bursts
  const particles: Particle[] = [];
  const palette = ['#fbbf24', '#f43f5e', '#38bdf8', '#a855f7', '#ffffff', '#4ade80'];

  function spawnExplosion(cx: number, cy: number) {
    particles.length = 0;
    for (let i = 0; i < 48; i++) {
      const angle = (Math.PI * 2 * i) / 48 + (Math.random() - 0.5) * 0.4;
      const speed = 180 + Math.random() * 420;
      const types: Particle['type'][] = ['sock', 'magnet', 'star', 'bubble'];
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 8,
        type: types[i % types.length] ?? 'sock',
        color: palette[i % palette.length] ?? '#ffffff',
      });
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Cues
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
      audio.fx('click', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('thud', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.9);
      audio.fx('scream', 0.5);
      spawnExplosion(430, 360);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('creak', 0.6 + 0.4 * tension);
      }
      // Rhythmic stomps speed up with tension
      const stompInterval = Math.max(160, 480 - tension * 300);
      if (view.elapsed - lastStompTick > stompInterval && !cashed) {
        lastStompTick = view.elapsed;
        audio.fx('stomp', 0.4 + 0.5 * tension);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2
      : running
      ? tension * 2.5 * Math.sin(view.elapsed * 0.04)
      : 0;

    // Clear background
    ctx.save();
    ctx.fillStyle = COLOURS.bgTop;
    ctx.fillRect(0, 0, 960, 540);

    // Camera shake
    ctx.translate(shake * Math.sin(crashAgeSec * 80), shake * Math.cos(crashAgeSec * 60));

    // Airport terminal concourse background
    ctx.fillStyle = COLOURS.bgFloor;
    ctx.fillRect(0, 360, 960, 180);

    // Floor perspective tiles
    ctx.strokeStyle = COLOURS.floorTile;
    ctx.lineWidth = 2;
    for (let x = -80; x <= 1040; x += 110) {
      ctx.beginPath();
      ctx.moveTo(x, 360);
      ctx.lineTo(x + (x - 480) * 0.45, 540);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 440);
    ctx.lineTo(960, 440);
    ctx.moveTo(0, 500);
    ctx.lineTo(960, 500);
    ctx.stroke();

    // Yellow hazard boarding zone stripe
    ctx.fillStyle = COLOURS.yellowStripe;
    ctx.fillRect(0, 355, 960, 8);
    for (let bx = 0; bx < 960; bx += 40) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(bx, 355);
      ctx.lineTo(bx + 18, 355);
      ctx.lineTo(bx + 10, 363);
      ctx.lineTo(bx - 8, 363);
      ctx.fill();
    }

    // Gate 14 sign & Flight display board
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.fillRect(50, 40, 220, 75);
    ctx.strokeRect(50, 40, 220, 75);
    ctx.fillStyle = COLOURS.yellowStripe;
    ctx.font = '900 24px monospace';
    ctx.fillText('GATE 14', 65, 72);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('FLIGHT 884 · LAST CALL', 65, 96);

    // Sizer Box (Metal carry-on inspection crate)
    const boxX = 350;
    const boxY = 270;
    const boxW = 160;
    const boxH = 150;
    const bow = running ? tension * 16 * Math.sin(view.elapsed * 0.02) : 0;
    const glowIron = tension > 0.85;

    // Back cage bars
    ctx.strokeStyle = glowIron ? '#f97316' : '#475569';
    ctx.lineWidth = 4;
    for (let bx = boxX + 25; bx < boxX + boxW; bx += 32) {
      ctx.beginPath();
      ctx.moveTo(bx, boxY);
      ctx.lineTo(bx, boxY + boxH);
      ctx.stroke();
    }

    // DUFFEL BAG (wedged into sizer box)
    const stompCycle = Math.sin(view.elapsed * 0.016);
    const squishY = running && !cashed ? (stompCycle > 0 ? stompCycle * 14 * (0.4 + 0.6 * tension) : 0) : 0;
    const bagSunk = cashed ? 50 : (view.currentX100 - 100) * 0.018;
    const bagCenterY = boxY + 60 + Math.min(65, bagSunk) + squishY;
    const bagBulge = 1 + tension * 0.42;

    if (!crashed || crashAgeSec < 0.35) {
      const bagW = 140 * bagBulge;
      const bagH = Math.max(65, 110 - squishY * 1.5);

      ctx.save();
      ctx.translate(boxX + boxW / 2, bagCenterY);

      // Duffel shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, bagH * 0.48, bagW * 0.45, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main Bag Body
      const bagGrad = ctx.createLinearGradient(-bagW / 2, -bagH / 2, bagW / 2, bagH / 2);
      bagGrad.addColorStop(0, COLOURS.bagHighlight);
      bagGrad.addColorStop(0.7, COLOURS.bagBody);
      bagGrad.addColorStop(1, '#9d174d');
      ctx.fillStyle = bagGrad;
      ctx.beginPath();
      ctx.roundRect(-bagW / 2, -bagH / 2, bagW, bagH, 28);
      ctx.fill();

      // Webbing straps
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-bagW * 0.28, -bagH / 2);
      ctx.lineTo(-bagW * 0.28, bagH / 2);
      ctx.moveTo(bagW * 0.28, -bagH / 2);
      ctx.lineTo(bagW * 0.28, bagH / 2);
      ctx.stroke();

      // Straining Zipper
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(-bagW * 0.42, 0);
      ctx.quadraticCurveTo(0, tension * 16, bagW * 0.42, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Orange fleece popping out of zipper gap at high tension
      if (tension > 0.3) {
        ctx.fillStyle = '#ff781f';
        ctx.beginPath();
        ctx.arc(0, 0, 6 + tension * 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Front Metal Frame (Sizer cage)
    ctx.strokeStyle = glowIron ? '#fbbf24' : COLOURS.cageSteel;
    ctx.lineWidth = 8;
    ctx.beginPath();
    // Bowing side bars under pressure
    ctx.moveTo(boxX, boxY);
    ctx.quadraticCurveTo(boxX - bow, boxY + boxH / 2, boxX, boxY + boxH);
    ctx.moveTo(boxX + boxW, boxY);
    ctx.quadraticCurveTo(boxX + boxW + bow, boxY + boxH / 2, boxX + boxW, boxY + boxH);
    // Base & crossbar
    ctx.moveTo(boxX - 10, boxY + boxH);
    ctx.lineTo(boxX + boxW + 10, boxY + boxH);
    ctx.moveTo(boxX - 6, boxY + 28);
    ctx.lineTo(boxX + boxW + 6, boxY + 28);
    ctx.stroke();

    // Sizer metal label: "MAX CARRY-ON 22x14x9"
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(boxX + 15, boxY + 6, boxW - 30, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUDGET-AIR SIZER 22x14x9', boxX + boxW / 2, boxY + 19);

    // PROTAGONIST: Panicked traveler jumping / stomping on top of duffel
    const travelerX = boxX + boxW / 2 - 12;
    const jumpOffset = running && !cashed ? (stompCycle < -0.1 ? stompCycle * 28 : 0) : 0;
    const travelerY = bagCenterY - 45 + jumpOffset;

    if (!crashed) {
      ctx.save();
      ctx.translate(travelerX, travelerY);

      // Legs / Sneakers stomping
      ctx.fillStyle = '#1e293b'; // pants
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#2563eb';
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-20, 28);
      ctx.moveTo(16, 0);
      ctx.lineTo(20, 28);
      ctx.stroke();

      // Sneakers
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(-28, 26, 18, 10);
      ctx.fillRect(12, 26, 18, 10);

      // Torso / Hooded sweater
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(-22, -45, 44, 48, 8);
      ctx.fill();

      // Panicked Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -62, 17, 0, Math.PI * 2);
      ctx.fill();

      // Disheveled hair
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(0, -70, 16, Math.PI, Math.PI * 2);
      ctx.fill();

      // Eyes (wide & alarmed)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-6, -63, 4, 0, Math.PI * 2);
      ctx.arc(6, -63, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-5, -63, 2, 0, Math.PI * 2);
      ctx.arc(7, -63, 2, 0, Math.PI * 2);
      ctx.fill();

      // Panicked sweat drops
      if (tension > 0.2) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(18, -70 + (view.elapsed * 0.05) % 20, 3, 0, Math.PI * 2);
        ctx.arc(-18, -66 + (view.elapsed * 0.06) % 20, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Arms flailing / pushing down
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-18, -35);
      ctx.lineTo(-34, -10 + Math.sin(view.elapsed * 0.02) * 8);
      ctx.moveTo(18, -35);
      ctx.lineTo(34, -10 - Math.sin(view.elapsed * 0.02) * 8);
      ctx.stroke();

      if (cashed) {
        // Victorious thumbs-up
        ctx.fillStyle = '#22c55e';
        ctx.font = '700 13px system-ui';
        ctx.fillText('FIT APPROVED!', 0, -88);
      }
      ctx.restore();
    }

    // GATE AGENT (standing sternly at right)
    const agentX = 690;
    const agentY = 320;
    ctx.save();
    ctx.translate(agentX, agentY);
    // Agent Body
    ctx.fillStyle = COLOURS.agentSuit;
    ctx.fillRect(-22, 0, 44, 110);
    // Epaulets
    ctx.fillStyle = COLOURS.yellowStripe;
    ctx.fillRect(-24, 0, 10, 4);
    ctx.fillRect(14, 0, 10, 4);

    // Agent Head
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(0, -22, 18, 0, Math.PI * 2);
    ctx.fill();
    // Bun hairstyle
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(0, -38, 12, 0, Math.PI * 2);
    ctx.fill();

    // Cat-eye glasses
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-14, -25);
    ctx.lineTo(-2, -22);
    ctx.lineTo(-12, -19);
    ctx.closePath();
    ctx.moveTo(14, -25);
    ctx.lineTo(2, -22);
    ctx.lineTo(12, -19);
    ctx.closePath();
    ctx.stroke();

    // Stern clipboard
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-38, 18, 28, 42);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-35, 23, 22, 32);
    // Tapping pen
    const penTap = running ? Math.sin(view.elapsed * (0.01 + tension * 0.03)) * 6 : 0;
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, 28 + penTap);
    ctx.lineTo(-2, 36 + penTap);
    ctx.stroke();

    // Speech bubble if agent is suspicious
    if (tension > 0.4 && !crashed && !cashed) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-85, -70, 75, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(tension > 0.8 ? 'NO WAY.' : 'AHEM...', -47, -52);
    }
    ctx.restore();

    // CRASH EXPLOSION & PARTICLES (socks, magnets, bubble wrap)
    if (crashed) {
      for (const p of particles) {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.vy += 380 * 0.016; // gravity
        p.rot += p.vRot * 0.016;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.type === 'sock') {
          ctx.beginPath();
          ctx.roundRect(-8, -14, 16, 26, 5);
          ctx.fill();
        } else if (p.type === 'magnet') {
          ctx.fillRect(-10, -8, 20, 16);
          ctx.fillStyle = '#000000';
          ctx.font = '700 8px sans-serif';
          ctx.fillText('PARIS', 0, 3);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Flash ring burst
      if (crashAgeSec < 0.6) {
        const ringProg = crashAgeSec / 0.6;
        ctx.strokeStyle = `rgba(239, 68, 68, ${1 - ringProg})`;
        ctx.lineWidth = 14 * (1 - ringProg);
        ctx.beginPath();
        ctx.arc(boxX + boxW / 2, boxY + 70, ringProg * 280, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // CASH-OUT CELEBRATION OVERLAY
    if (cashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 4;
      ctx.strokeRect(boxX - 6, boxY - 6, boxW + 12, boxH + 12);

      // Boarding Pass Stamp
      ctx.translate(480, 290);
      ctx.rotate(-0.06);
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.fillRect(-120, -32, 240, 64);
      ctx.strokeRect(-120, -32, 240, 64);
      ctx.fillStyle = '#15803d';
      ctx.font = '900 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PRIORITY GROUP 1', 0, -4);
      ctx.font = '700 12px system-ui';
      ctx.fillText('SLID IN CLEAN · PROCEED TO GATE', 0, 18);
      ctx.restore();
    }

    // TOP HUD: MULTIPLIER & STATUS READOUTS
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Subtitle
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 34px system-ui, -apple-system, sans-serif';
    ctx.fillText('SIZER BOX SQUEEZE', 480, 48);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('AIRPORT GATE 14 · CRAM THE OVERSIZED DUFFEL BEFORE AGENT REJECTS IT', 480, 78);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.text;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${crashed ? 84 : 76}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 142);

    // Milestone Caption
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    const statusText = crashed
      ? 'ZIPPER RUPTURE! SOCKS & SOUVENIRS EVERYWHERE!'
      : cashed
      ? `SAFE! SIZED AT ${formatX(view.cashoutX100 ?? 100)}`
      : currentMilestone
      ? currentMilestone[1]
      : 'Sizing bag... Stomp to compress';

    ctx.fillStyle = crashed ? '#fca5a5' : cashed ? '#86efac' : '#e2e8f0';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 196, 860);

    // Stake line
    let stakeLabel = '';
    let stakeColor = COLOURS.muted;
    if (cashed) {
      stakeLabel = `Cashed out at ${formatX(view.cashoutX100 ?? 100)} · Bag accepted!`;
      stakeColor = COLOURS.cashedOut;
    } else if (view.stake === null) {
      stakeLabel = crashed ? 'Watched the zipper burst · no credits lost' : 'Watching the line · no credits riding';
    } else if (crashed) {
      stakeLabel = `Gate checked! Lost ${credits(view.stake)}`;
      stakeColor = COLOURS.crashed;
    } else {
      stakeLabel = `Riding with ${credits(view.stake)} · Push harder!`;
      stakeColor = COLOURS.accent;
    }

    ctx.fillStyle = stakeColor;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(stakeLabel, 480, 515);

    ctx.restore();
  }

  return { draw };
}
