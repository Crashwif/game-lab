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
  [120, 'Menlo Park sunscreen stockpile secured'],
  [150, 'Unplugs Quest servers from Palo Alto grid'],
  [200, 'Slips past Golden Gate toll scanner'],
  [250, 'Frantic tax auditors deploy pursuit kayaks'],
  [300, 'Drops Quest 3 boxes to lighten payload'],
  [500, 'State helicopter drops audit subpoenas'],
  [1000, 'Speeds past Lake Tahoe tax haven checkpoint'],
  [10000, 'Outruns California airspace patrol entirely'],
  [100000, 'Achieves sovereign micronation tax status'],
  [1000000, 'Ascends into untaxable orbit above Earth'],
];

const COLOURS = {
  bgDeep: '#0c071d',
  bgSky: '#2b0f44',
  sunPink: '#ff3d8b',
  waterDark: '#08142b',
  waterNeon: '#00e5ff',
  hudText: '#f5f7ff',
  hudMuted: '#94a3b8',
  gold: '#fbbf24',
  crashed: '#ff3b30',
  cashedOut: '#34d399',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Bunker reached at ${formatX(view.cashoutX100)} · 0% state tax locked!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Audit executed · spectator only' : 'Watching Bay getaway · no credits risked', COLOURS.hudMuted];
  }
  if (crashed) return [`Garnished! Your ${credits(view.stake)} seized by Sacramento`, COLOURS.crashed];
  return [`Fleeing California · ${credits(view.stake)} on the e-foil`, COLOURS.waterNeon];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.7);
    }
    if (running && previousPhase === 'running' && milestoneIndex > previousMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('whoosh', 0.6);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 10 * clamp01(1 - crashSec / 0.5) ** 2 : 0;
    const time = now / 1000;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 320);
    sky.addColorStop(0, COLOURS.bgDeep);
    sky.addColorStop(0.65, COLOURS.bgSky);
    sky.addColorStop(1, '#ff6536');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 320);

    // Synthwave Sunset Sun
    const sunY = 220 - depth * 60;
    const sunGrad = ctx.createLinearGradient(480, sunY - 90, 480, sunY + 90);
    sunGrad.addColorStop(0, '#ffe066');
    sunGrad.addColorStop(1, COLOURS.sunPink);
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(480, sunY, 86, 0, Math.PI * 2);
    ctx.fill();

    // Sun horizontal scanline cutouts
    ctx.fillStyle = COLOURS.bgSky;
    for (let i = 0; i < 6; i++) {
      const sy = sunY + 12 + i * 11;
      ctx.fillRect(480 - 86, sy, 172, 2.5 + i * 0.9);
    }

    // Distant Golden Gate Bridge silhouette
    const bridgeScroll = ((view.elapsed * 0.04) % 960);
    ctx.fillStyle = 'rgba(28, 9, 44, 0.85)';
    for (let offset = -960; offset <= 960; offset += 960) {
      const bx = offset - bridgeScroll;
      // Towers
      ctx.fillRect(bx + 140, 120, 18, 170);
      ctx.fillRect(bx + 310, 120, 18, 170);
      // Main cable arc
      ctx.beginPath();
      ctx.moveTo(bx + 50, 190);
      ctx.quadraticCurveTo(bx + 225, 230, bx + 400, 190);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(28, 9, 44, 0.85)';
      ctx.stroke();
      // Bridge deck
      ctx.fillRect(bx + 30, 220, 400, 6);
    }

    // Bay Water with neon synthwave grid lines
    const waterGrad = ctx.createLinearGradient(0, 310, 0, 540);
    waterGrad.addColorStop(0, '#100a26');
    waterGrad.addColorStop(0.3, COLOURS.waterDark);
    waterGrad.addColorStop(1, '#020713');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 310, 960, 230);

    // Flowing neon speed lines on water
    const speed = running ? 240 + tension * 480 : (crashed ? 0 : 70);
    ctx.strokeStyle = COLOURS.waterNeon;
    for (let r = 0; r < 7; r++) {
      const lineY = 328 + r * 30;
      const lw = 1 + r * 0.4;
      ctx.lineWidth = lw;
      ctx.globalAlpha = 0.2 + (r / 7) * 0.4;
      ctx.beginPath();
      const waveOffset = ((time * speed) + r * 95) % 180;
      for (let x = -180 + waveOffset; x < 960; x += 180) {
        ctx.moveTo(x, lineY);
        ctx.lineTo(x + 110, lineY);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Fleeing Protagonist: Zuck on E-Foil
    const bob = Math.sin(time * 7) * (running ? 6 + tension * 4 : 2);
    const zuckX = cashed ? 620 : 420;
    const zuckY = 325 + bob - (cashed ? 40 : 0);

    // E-Foil Hydrofoil mast & underwater foil
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(zuckX, zuckY + 22);
    ctx.lineTo(zuckX - 10, zuckY + 68);
    ctx.stroke();
    // Glowing submerged foil wing
    ctx.fillStyle = '#00f5d4';
    ctx.beginPath();
    ctx.ellipse(zuckX - 10, zuckY + 70, 28, 5, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Spray & hydrofoil foam
    if (running) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let p = 0; p < 5; p++) {
        const px = zuckX - 35 - Math.random() * 55;
        const py = zuckY + 68 + (Math.random() - 0.5) * 8;
        ctx.fillRect(px, py, 3 + Math.random() * 4, 3);
      }
    }

    // E-Foil surfboard deck
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(zuckX + 5, zuckY + 20, 52, 9, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cargo on back: Massive U-Haul cardboard box
    ctx.fillStyle = '#d97706';
    ctx.fillRect(zuckX - 48, zuckY - 45, 52, 58);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.strokeRect(zuckX - 48, zuckY - 45, 52, 58);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('U-HAUL NV', zuckX - 22, zuckY - 33);
    ctx.fillStyle = '#451a03';
    ctx.fillText('SERVERS', zuckX - 22, zuckY - 21);
    ctx.fillText('SUNSCREEN', zuckX - 22, zuckY - 9);

    // Peeking Wagyu cow in the box
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(zuckX - 40, zuckY - 50, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(zuckX - 43, zuckY - 49, 6, 4);

    // Zuck's Black Hoodie & Limbs
    ctx.fillStyle = '#18181b';
    // Legs leaning into foil
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(zuckX + 18, zuckY + 18);
    ctx.lineTo(zuckX + 12, zuckY - 8);
    ctx.stroke();
    // Torso
    ctx.fillRect(zuckX + 2, zuckY - 35, 18, 30);
    // Remote trigger hand
    ctx.beginPath();
    ctx.moveTo(zuckX + 10, zuckY - 22);
    ctx.lineTo(zuckX + 28, zuckY - 14);
    ctx.stroke();

    // Zuck's Head (pale robot face + thick sunscreen nose/cheeks)
    ctx.fillStyle = '#fce7f3';
    ctx.beginPath();
    ctx.arc(zuckX + 12, zuckY - 48, 11, 0, Math.PI * 2);
    ctx.fill();
    // Short brownish buzzcut
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(zuckX + 11, zuckY - 53, 11, Math.PI, Math.PI * 2);
    ctx.fill();
    // Sunscreen paste (signature white zinc mask)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(zuckX + 15, zuckY - 47, 5, 0, Math.PI * 2);
    ctx.fill();
    // Robot eye slit
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(zuckX + 16, zuckY - 50, 3, 2);

    // Pursuit: State Tax Kayakers & Drones behind him
    if (running || crashed) {
      const auditX = zuckX - 180 + (crashed ? 90 : 0);
      const auditY = 345 + Math.sin(time * 8) * 4;
      // Tax auditor kayak (Bright orange)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(auditX, auditY + 22, 42, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Auditor with suit & lifejacket
      ctx.fillStyle = '#fdba74';
      ctx.fillRect(auditX - 6, auditY - 8, 12, 18);
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath();
      ctx.arc(auditX, auditY - 16, 7, 0, Math.PI * 2);
      ctx.fill();
      // Kayak paddle
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      const paddleAng = Math.sin(time * 12);
      ctx.beginPath();
      ctx.moveTo(auditX - 24 * Math.cos(paddleAng), auditY + 4 - 18 * Math.sin(paddleAng));
      ctx.lineTo(auditX + 24 * Math.cos(paddleAng), auditY + 4 + 18 * Math.sin(paddleAng));
      ctx.stroke();
      // "CA TAX" flag on kayak
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(auditX - 35, auditY - 16, 18, 11);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px sans-serif';
      ctx.fillText('FTB', auditX - 26, auditY - 8);

      // Flying tax subpoena forms floating in the air
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let f = 0; f < 3; f++) {
        const fx = zuckX - 90 - f * 35 + Math.sin(time * 5 + f) * 12;
        const fy = zuckY - 60 - f * 18 + Math.cos(time * 4 + f) * 8;
        ctx.fillRect(fx, fy, 11, 14);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(fx + 2, fy + 2, 7, 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      }
    }

    // Cashout Overlay: Nevada Border Bunker Lounge Celebration
    if (cashed) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.fillRect(0, 0, 960, 540);

      // Nevada Welcome Arch / Bunker Banner
      ctx.fillStyle = '#065f46';
      ctx.fillRect(260, 60, 440, 52);
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 3;
      ctx.strokeRect(260, 60, 440, 52);
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WELCOME TO NEVADA: 0% STATE TAX', 480, 84);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#d1fae5';
      ctx.fillText('MENLO PARK SUNSCREEN STOCKPILE SECURED IN BUNKER', 480, 102);

      // Rocket boost trail behind e-foil
      ctx.fillStyle = '#34d399';
      for (let b = 0; b < 8; b++) {
        ctx.beginPath();
        ctx.arc(zuckX - 45 - b * 14, zuckY + 18 + (Math.random() - 0.5) * 8, 8 - b * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Crash Overlay: Snared by Golden Gate bridge toll net + retro-tax subpoena
    if (crashed) {
      // Siren flashing lights
      const sirenColor = Math.floor(time * 8) % 2 === 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(59, 130, 246, 0.35)';
      ctx.fillStyle = sirenColor;
      ctx.fillRect(0, 0, 960, 540);

      // Golden Gate Snare Net around the foil
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      for (let n = 0; n < 6; n++) {
        ctx.beginPath();
        ctx.arc(zuckX, zuckY + 10, 30 + n * 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Impound Tax Stamp Notice
      ctx.save();
      ctx.translate(480, 160);
      ctx.rotate(-0.06);
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(-230, -50, 460, 95);
      ctx.strokeStyle = COLOURS.crashed;
      ctx.lineWidth = 4;
      ctx.strokeRect(-230, -50, 460, 95);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CALIFORNIA TAX AUDIT IMPOUND', 0, -18);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('SUNSCREEN SURCHARGE: 5% RETROACTIVE LEVY APPLIED', 0, 6);
      ctx.fillText('E-FOIL REGISTERED TO SACRAMENTO IMPOUND DOCK', 0, 26);
      ctx.restore();
    }

    // HUD Header & Multiplier Display
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.hudText;
    ctx.font = '900 36px system-ui, sans-serif';
    ctx.fillText('ZUCK EXODUS', 480, 42);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.hudMuted;
    ctx.fillText('FLEE SACRAMENTO TAX REAVERS · REACH THE ZERO-TAX BUNKER', 480, 64);

    // Multiplier Huge Center Display
    const multiplierColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.waterNeon);
    ctx.fillStyle = multiplierColor;
    ctx.font = '900 78px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 142);

    // Milestone ticker banner
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = running ? COLOURS.gold : COLOURS.hudMuted;
    const tickerText = currentMilestone ? `★ ${currentMilestone[1]}` : (running ? 'Cruising past Alcatraz...' : 'Engine warmed on the bay');
    ctx.fillText(tickerText, 480, 476);

    // Stake line footer
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(line, 480, 508);

    ctx.restore();
  }

  return { draw };
}
