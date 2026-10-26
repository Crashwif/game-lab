/**
 * Soap Tank Heist - scene.ts
 * A panicked commuter frantically jams Irish Spring and duct tape into a ruptured gas tank!
 */
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
  asphalt: '#1a1d24',
  asphaltLight: '#272c37',
  chassis: '#12151c',
  tankMetal: '#4a5568',
  tankHighlight: '#718096',
  soapGreen: '#00c853',
  soapDark: '#00701a',
  tapeSilver: '#cfd8dc',
  tapeEdge: '#90a4ae',
  fuelAmber: '#ffb300',
  text: '#f8fafc',
  muted: '#94a3b8',
  glowOrange: '#ff3d00',
  cashedOut: '#4ade80',
  crashed: '#ef4444',
  bubble: 'rgba(220, 252, 231, 0.75)',
};

const MILESTONES: [number, string][] = [
  [120, 'Smell of raw 87 octane fills the cabin'],
  [150, 'Claude chatbot suggests Irish Spring bar'],
  [200, 'Dad jams personal body soap into puncture'],
  [250, 'Drips slow down into soapy foamy bubbles'],
  [300, 'Dollar General putty mixed with butter knife'],
  [500, 'Duct tape wraps completely around chassis'],
  [1000, 'Exhaust manifold glows cherry red nearby'],
  [10000, 'Fuel tank swells like a pregnant watermelon'],
  [100000, 'AI diagnostic claims zero leaks remaining'],
  [1000000, 'Car achieves certified DIY aerospace status'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${Math.round(size * (1 + 0.28 * pop * pop))}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Patched at ${formatX(view.cashoutX100)} · Lavender Fresh getaway!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Tank detonated · Bystander unharmed' : 'Watching the blowout · No credits risked', COLOURS.muted];
  }
  if (crashed) return [`Gasket popped! Lost ${credits(view.stake)} in the blast`, COLOURS.crashed];
  return [`Under the tank · ${credits(view.stake)} riding on soap`, '#38bdf8'];
}

interface BubbleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  seed: number;
  alpha: number;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'hardstyle', crash: 'boom' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSpraySfx = 0;

  // Pre-allocated floating bubbles and suds
  const bubbles: BubbleParticle[] = Array.from({ length: 32 }, (_, i) => ({
    x: 480 + (Math.sin(i * 1.7) * 90),
    y: 260 + (i * 9),
    vx: (Math.sin(i * 2.3) - 0.5) * 60,
    vy: -(25 + (i % 5) * 15),
    size: 4 + (i % 7) * 2.2,
    seed: i * 0.47,
    alpha: 0.8,
  }));

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    // Cues
    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('squeak', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('boom', previousPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('ratchet', 0.6);
      }
      if (now - lastSpraySfx > 1800 - tension * 1100 && !cashedOut) {
        audio.fx(tension > 0.6 ? 'hiss' : 'spray', 0.4 + 0.4 * tension);
        lastSpraySfx = now;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 22 * clamp01(1 - crashAgeSec / 0.85) ** 2 : (running ? Math.sin(now * 0.04) * (1 + tension * 4) : 0);

    // Screen Shake
    ctx.save();
    if (shake > 0) {
      const shakeAngle = now * 0.12;
      ctx.translate(Math.cos(shakeAngle) * shake, Math.sin(shakeAngle * 1.3) * shake);
    }

    // --- 1. Background (Dark asphalt undercarriage) ---
    ctx.fillStyle = COLOURS.asphalt;
    ctx.fillRect(-20, -20, 1000, 580);

    // Asphalt gravel texture
    ctx.fillStyle = COLOURS.asphaltLight;
    for (let i = 0; i < 40; i++) {
      const gx = (i * 97) % 960;
      const gy = 360 + ((i * 47) % 180);
      ctx.fillRect(gx, gy, (i % 3) + 2, (i % 2) + 2);
    }

    // Overhead SUV Frame / Chassis rails
    ctx.fillStyle = COLOURS.chassis;
    ctx.fillRect(0, 0, 960, 95);
    ctx.fillRect(80, 95, 800, 24);

    // Red-hot glowing exhaust pipe passing above
    const glowIntensity = clamp01(tension * 1.2 + depth * 0.3);
    ctx.fillStyle = '#222';
    ctx.fillRect(140, 130, 680, 16);
    if (glowIntensity > 0.05) {
      ctx.strokeStyle = `rgba(255, 60, 0, ${0.3 + glowIntensity * 0.65})`;
      ctx.lineWidth = 6 + glowIntensity * 6;
      ctx.beginPath();
      ctx.moveTo(140, 138);
      ctx.lineTo(820, 138);
      ctx.stroke();
    }

    // --- 2. Fuel Tank Centerpiece ---
    // Swelling animation based on tension
    const swell = running ? Math.sin(now * 0.008) * (4 + tension * 12) : 0;
    const tankWidth = 440 + swell * 1.2;
    const tankHeight = 130 + swell * 0.8;
    const tankX = 480 - tankWidth / 2;
    const tankY = 135;

    // Fuel Tank Body Gradient
    const tankGrad = ctx.createLinearGradient(tankX, tankY, tankX, tankY + tankHeight);
    tankGrad.addColorStop(0, '#2d3748');
    tankGrad.addColorStop(0.3, COLOURS.tankHighlight);
    tankGrad.addColorStop(0.8, COLOURS.tankMetal);
    tankGrad.addColorStop(1, '#1a202c');

    ctx.fillStyle = tankGrad;
    ctx.beginPath();
    ctx.roundRect(tankX, tankY, tankWidth, tankHeight, 32);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    // Rivets and warning sticker on tank
    ctx.fillStyle = '#10151f';
    for (let r = 0; r < 6; r++) {
      ctx.beginPath();
      ctx.arc(tankX + 45 + r * 70, tankY + 20, 3.5, 0, Math.PI * 2);
      ctx.arc(tankX + 45 + r * 70, tankY + tankHeight - 20, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Danger Flammable Decal
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(tankX + 35, tankY + 45, 60, 40);
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('87 OCT', tankX + 65, tankY + 70);

    // --- 3. The Puncture & Patching (Dad's Irish Spring & Duct Tape) ---
    const leakX = 480;
    const leakY = tankY + tankHeight - 2;

    if (!crashed) {
      // Fuel Spray / Gush (diminishes as duct tape seals or bubbles)
      const sprayActive = running && !cashedOut;
      if (sprayActive) {
        ctx.fillStyle = COLOURS.fuelAmber;
        const sprayJitter = Math.sin(now * 0.08) * 12;
        ctx.beginPath();
        ctx.moveTo(leakX - 10, leakY);
        ctx.lineTo(leakX + 10, leakY);
        ctx.lineTo(leakX + 25 + sprayJitter, leakY + 70 + tension * 40);
        ctx.lineTo(leakX - 25 + sprayJitter, leakY + 70 + tension * 40);
        ctx.closePath();
        ctx.globalAlpha = 0.45;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Irish Spring Bar of Soap jammed right into puncture
      const soapW = 76;
      const soapH = 34;
      const soapBob = running ? Math.sin(now * 0.015) * 3 : 0;
      const soapX = leakX - soapW / 2;
      const soapY = leakY - 12 + soapBob;

      // Soap gradient (Classic Irish Spring emerald marbled)
      const soapGrad = ctx.createLinearGradient(soapX, soapY, soapX + soapW, soapY + soapH);
      soapGrad.addColorStop(0, '#10b981');
      soapGrad.addColorStop(0.5, COLOURS.soapGreen);
      soapGrad.addColorStop(1, COLOURS.soapDark);

      ctx.fillStyle = soapGrad;
      ctx.beginPath();
      ctx.roundRect(soapX, soapY, soapW, soapH, 12);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#052e16';
      ctx.stroke();

      // Soap text logo
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('IRISH SPRING', leakX, soapY + 21);

      // Duct Tape Strips (accumulate based on multiplier depth or cashout)
      const tapeCount = cashedOut ? 14 : Math.min(10, Math.floor(tension * 12));
      for (let t = 0; t < tapeCount; t++) {
        const angle = -0.3 + (t * 0.06) + Math.sin(t * 9.1) * 0.05;
        ctx.save();
        ctx.translate(leakX, soapY + soapH / 2);
        ctx.rotate(angle);
        ctx.fillStyle = t % 2 === 0 ? COLOURS.tapeSilver : COLOURS.tapeEdge;
        ctx.fillRect(-65, -8 + (t % 3) * 4 - 4, 130, 16);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.strokeRect(-65, -8 + (t % 3) * 4 - 4, 130, 16);
        ctx.restore();
      }

      // Foamy Suds & Bubbles around the soap
      ctx.fillStyle = COLOURS.bubble;
      for (let b = 0; b < bubbles.length; b++) {
        const bub = bubbles[b]!;
        const elapsedS = (now * 0.001 + bub.seed) % 2.5;
        const curY = leakY + 10 + bub.vy * elapsedS;
        const curX = leakX + bub.vx * Math.sin(elapsedS * 3 + bub.seed);
        if (curY > 180 && curY < 390) {
          ctx.beginPath();
          ctx.arc(curX, curY, bub.size * (1 - elapsedS / 2.8), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // --- 4. The Commuter Dad Underneath ---
    const dadY = 385;
    const dadPush = running && !cashedOut ? Math.sin(now * 0.02) * 5 : 0;

    // Dad's body on mechanic creeper board
    ctx.fillStyle = '#b91c1c'; // creeper red board
    ctx.fillRect(360, dadY + 50, 240, 26);
    // Wheels
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(375, dadY + 80, 8, 0, Math.PI * 2);
    ctx.arc(585, dadY + 80, 8, 0, Math.PI * 2);
    ctx.fill();

    // Dad Torso (Navy Blue Polo shirt)
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.roundRect(410, dadY + 20, 140, 48, 16);
    ctx.fill();

    // Frantic Arms reaching up toward the tank
    ctx.strokeStyle = '#fbcfe8'; // Skin tone
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Left arm
    ctx.moveTo(430, dadY + 28);
    ctx.lineTo(455, 310 + dadPush);
    // Right arm
    ctx.moveTo(530, dadY + 28);
    ctx.lineTo(505, 310 + dadPush);
    ctx.stroke();

    // Dad's Face
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(480, dadY + 16, 26, 0, Math.PI * 2);
    ctx.fill();

    // Hair / bald fringe
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(480, dadY + 6, 24, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();

    // Glasses
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(465, dadY + 9, 12, 10);
    ctx.strokeRect(483, dadY + 9, 12, 10);
    ctx.beginPath();
    ctx.moveTo(477, dadY + 14);
    ctx.lineTo(483, dadY + 14);
    ctx.stroke();

    // Eyes (Panicked wide or celebrating)
    if (cashedOut) {
      // Happy squint
      ctx.strokeStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(471, dadY + 15, 4, Math.PI, 0);
      ctx.arc(489, dadY + 15, 4, Math.PI, 0);
      ctx.stroke();
      // Big smile
      ctx.beginPath();
      ctx.arc(480, dadY + 24, 7, 0, Math.PI);
      ctx.stroke();
    } else if (crashed) {
      // X X eyes
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 2;
      ctx.strokeText('×', 467, dadY + 18);
      ctx.strokeText('×', 485, dadY + 18);
    } else {
      // Frantic eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(471, dadY + 14, 2.5, 0, Math.PI * 2);
      ctx.arc(489, dadY + 14, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // O mouth shouting
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(480, dadY + 28, 4, 6 + tension * 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Sweat drops
      if (tension > 0.2) {
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(510, dadY + 8, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- 5. Crashed State: Soapy Fireball Detonation ---
    if (crashed) {
      const burst = clamp01(crashAgeSec / 1.1);
      const fireRad = 70 + burst * 240;

      // Multi-layer explosive blast (Soap foam + Fuel fire)
      const fireGrad = ctx.createRadialGradient(leakX, leakY, 10, leakX, leakY, fireRad);
      fireGrad.addColorStop(0, '#ffffff');
      fireGrad.addColorStop(0.2, '#fef08a');
      fireGrad.addColorStop(0.5, '#f97316');
      fireGrad.addColorStop(0.8, '#22c55e'); // Green soap foam flare
      fireGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(leakX, leakY, fireRad, 0, Math.PI * 2);
      ctx.fill();

      // Flying exploded soap chunks
      for (let sc = 0; sc < 8; sc++) {
        const scAngle = (sc * Math.PI) / 4 + crashAgeSec * 3;
        const scDist = 40 + crashAgeSec * 350;
        const sx = leakX + Math.cos(scAngle) * scDist;
        const sy = leakY + Math.sin(scAngle) * scDist * 0.7;
        ctx.fillStyle = COLOURS.soapGreen;
        ctx.fillRect(sx - 12, sy - 8, 24, 16);
      }
    }

    // --- 6. HUD and Typography ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline Header
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText('SOAP TANK HEIST', 480, 38);

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('PLUG THE 87-OCTANE LEAK WITH IRISH SPRING BEFORE YOU DETONATE', 480, 68);

    // Huge Multiplier Display
    const multiplierColor = crashed ? COLOURS.crashed : cashedOut ? COLOURS.cashedOut : COLOURS.fuelAmber;
    ctx.fillStyle = multiplierColor;
    ctx.font = `900 ${crashed ? 76 : 84}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 195);

    // Current Milestone or Phase Message
    const milestonePassed = running ? MILESTONES[milestoneIndex - 1] : undefined;
    let statusText = '';
    if (cashedOut) {
      statusText = '✨ 50 LAYERS OF DUCT TAPE! SQUEALING OUT TO SAFETY! ✨';
    } else if (crashed) {
      statusText = '💥 SOAP GASKET POPPED! FOAMY EXPLOSION! 💥';
    } else if (milestonePassed) {
      statusText = `⚡ ${milestonePassed[1]}`;
    } else {
      statusText = view.phase === 'betting' ? 'Ready your soap bar · Place bets' : 'Crawl under chassis...';
    }

    ctx.fillStyle = cashedOut ? COLOURS.cashedOut : crashed ? COLOURS.crashed : COLOURS.text;
    const popVal = running && milestonePassed ? clamp01(1 - Math.log(view.currentX100 / milestonePassed[0]) / 0.05) : 0;
    ctx.font = popFont(700, 21, popVal);
    ctx.fillText(statusText, 480, 482);

    // Stake Line at bottom
    const [stkText, stkCol] = stakeLine(view);
    ctx.fillStyle = stkCol;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(stkText, 480, 515);

    ctx.restore();
  }

  return { draw };
}
