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
  bgTop: '#0a192f',
  bgBottom: '#050c18',
  blueprintGrid: '#133358',
  blueprintPaper: '#0f294a',
  wallStable: '#64ffda',
  wallStress: '#ff5370',
  pillar: '#ffcb6b',
  toilet: '#e2f1ff',
  pipeCyan: '#00e5ff',
  pipeOrange: '#ff9100',
  text: '#f1f7fe',
  muted: '#8892b0',
  accent: '#00e5ff',
  crashed: '#ff5370',
  approved: '#69f0ae',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Drafting board clear · waiting for round',
  betting: 'Place stake · inspect floorplan blueprints',
  running: 'Walls shifting · load-bearing limit testing',
  crashed: 'LOAD FAILURE · Drywall stack collapsed',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Toilet moved adjacent to front welcome mat'],
  [150, 'Pocket door opens directly into oven door'],
  [200, 'Master bedroom requires crawling under sink'],
  [250, 'Load-bearing pillar planted inside bathtub'],
  [300, 'Dining room table straddles staircase steps'],
  [500, 'Open concept hallway connects to neighbors'],
  [1000, 'Half-bath suspended entirely over driveway'],
  [10000, 'Contractor builds kitchen inside dumbwaiter'],
  [100000, 'Four-dimensional drywall violates physics'],
  [1000000, 'House transforms into Escher labyrinth'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Deed approved at ${formatX(view.cashoutX100)} · keys secured`, COLOURS.approved];
  }
  if (view.stake === null) {
    return [crashed ? 'Blueprint tore · spectating only' : 'Inspecting drafts · no credits riding', COLOURS.muted];
  }
  if (crashed) return [`Drywall collapsed with ${credits(view.stake)} inside`, COLOURS.crashed];
  return [`Contract active · ${credits(view.stake)} riding on structural limits`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let nextShiftAudioTime = 0;

  function toIso(x: number, y: number, z: number, cx: number, cy: number): [number, number] {
    return [cx + (x - y) * 1.5, cy + (x + y) * 0.86 - z];
  }

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
      audio.fx('ratchet', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('creak', 0.85);
      }
      if (now > nextShiftAudioTime && !cashedOut) {
        audio.fx('click', 0.3 + 0.5 * tension);
        nextShiftAudioTime = now + Math.max(120, 600 - tension * 450);
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.6) ** 2 : running ? tension * 3.5 * Math.sin(view.elapsed * 0.03) : 0;
    const crackRatio = crashed ? clamp01(crashSec / 0.3) : 0;

    ctx.save();
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Blueprint grid
    ctx.save();
    ctx.strokeStyle = COLOURS.blueprintGrid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    for (let x = 0; x < 960; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = 0; y < 540; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.07));

    // Draw Isometric Floorplan Board
    const planCx = 460;
    const planCy = 310;
    const wallShift = running ? Math.sin(view.elapsed * 0.007 * (1 + tension * 3)) * (20 + tension * 40) : 0;
    const splitY = crackRatio * 85;

    // Blueprint Paper Base
    const [p0x, p0y] = toIso(-150, -110, 0, planCx, planCy);
    const [p1x, p1y] = toIso(150, -110, 0, planCx, planCy);
    const [p2x, p2y] = toIso(150, 110, 0, planCx, planCy);
    const [p3x, p3y] = toIso(-150, 110, 0, planCx, planCy);

    ctx.save();
    ctx.fillStyle = COLOURS.blueprintPaper;
    ctx.strokeStyle = crashed ? COLOURS.crashed : COLOURS.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p0x, p0y);
    ctx.lineTo(p1x, p1y);
    ctx.lineTo(p2x, p2y + splitY);
    ctx.lineTo(p3x, p3y + splitY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Floorplan Rooms & Partitions
    ctx.lineWidth = 4;
    const wallColor = tension > 0.65 ? (Math.floor(now / 150) % 2 === 0 ? COLOURS.wallStress : COLOURS.wallStable) : COLOURS.wallStable;
    ctx.strokeStyle = wallColor;

    // Exterior load-bearing walls
    const [w0x, w0y] = toIso(-120, -80, 0, planCx, planCy);
    const [w1x, w1y] = toIso(120, -80, 0, planCx, planCy);
    const [w2x, w2y] = toIso(120, 80, 0, planCx, planCy + splitY * 0.5);
    const [w3x, w3y] = toIso(-120, 80, 0, planCx, planCy + splitY * 0.5);

    ctx.beginPath();
    ctx.moveTo(w0x, w0y);
    ctx.lineTo(w1x, w1y);
    ctx.lineTo(w2x, w2y);
    ctx.lineTo(w3x, w3y);
    ctx.closePath();
    ctx.stroke();

    // Shifting cursed interior walls
    const [divA1x, divA1y] = toIso(wallShift, -80, 0, planCx, planCy);
    const [divA2x, divA2y] = toIso(wallShift, 20, 0, planCx, planCy);
    ctx.beginPath();
    ctx.moveTo(divA1x, divA1y);
    ctx.lineTo(divA2x, divA2y);
    ctx.stroke();

    const [divB1x, divB1y] = toIso(-120, -wallShift * 0.6, 0, planCx, planCy);
    const [divB2x, divB2y] = toIso(30, -wallShift * 0.6, 0, planCx, planCy);
    ctx.beginPath();
    ctx.moveTo(divB1x, divB1y);
    ctx.lineTo(divB2x, divB2y);
    ctx.stroke();

    // Load-bearing Pillar planted in the Bathtub
    const [tubX, tubY] = toIso(-60 + wallShift * 0.3, 30, 0, planCx, planCy + splitY * 0.3);
    ctx.fillStyle = COLOURS.toilet;
    ctx.beginPath();
    ctx.ellipse(tubX, tubY, 20, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#90caf9';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pillar through tub
    ctx.fillStyle = COLOURS.pillar;
    ctx.fillRect(tubX - 5, tubY - 32, 10, 32);
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(tubX - 7, tubY - 35, 14, 5);

    // Cursed wandering Toilet
    const toiletIso = toIso(50 - wallShift * 0.8, -40, 0, planCx, planCy);
    ctx.fillStyle = COLOURS.toilet;
    ctx.beginPath();
    ctx.ellipse(toiletIso[0], toiletIso[1], 10, 14, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(toiletIso[0] - 8, toiletIso[1] - 18, 16, 7);

    // Spaghetti plumbing pipes connecting bizarrely
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLOURS.pipeCyan;
    ctx.beginPath();
    ctx.moveTo(tubX, tubY);
    ctx.bezierCurveTo(toiletIso[0] - 30, tubY - 40, toiletIso[0] + 40, tubY + 20, toiletIso[0], toiletIso[1]);
    ctx.stroke();

    ctx.strokeStyle = COLOURS.pipeOrange;
    ctx.beginPath();
    ctx.moveTo(toiletIso[0], toiletIso[1]);
    ctx.bezierCurveTo(planCx + 70, planCy + 30, planCx - 50, planCy - 60, tubX, tubY - 15);
    ctx.stroke();

    // Debris & dust when crashed
    if (crashed) {
      ctx.fillStyle = 'rgba(230, 220, 200, 0.65)';
      for (let i = 0; i < 22; i++) {
        const seed = (i * 97) % 100;
        const pAge = Math.min(1, crashSec * 2);
        const px = planCx + (seed - 50) * 4 * pAge;
        const py = planCy + (i * 23 % 70 - 20) + pAge * 60;
        ctx.beginPath();
        ctx.arc(px, py, (i % 6) + 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Panicked Architect Character (Right side)
    const archX = 810;
    const archY = 380 + (running ? Math.sin(now * 0.02) * (2 + tension * 6) : 0);
    ctx.save();
    // Body / Smock
    ctx.fillStyle = '#1e88e5';
    ctx.beginPath();
    ctx.arc(archX, archY + 55, 34, Math.PI, Math.PI * 2);
    ctx.fill();
    // Neck & Head
    ctx.fillStyle = '#ffcc80';
    ctx.fillRect(archX - 8, archY + 16, 16, 12);
    ctx.beginPath();
    ctx.arc(archX, archY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Wild Hair
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.arc(archX, archY - 10, 28, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();
    // Glasses askew
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 3;
    const tilt = running ? Math.sin(now * 0.03) * 0.2 : 0;
    ctx.beginPath();
    ctx.arc(archX - 11, archY - 2 + tilt * 5, 8, 0, Math.PI * 2);
    ctx.arc(archX + 11, archY - 2 - tilt * 5, 8, 0, Math.PI * 2);
    ctx.stroke();
    // Screaming Mouth
    ctx.fillStyle = crashed ? '#b71c1c' : '#212121';
    ctx.beginPath();
    const mouthH = 5 + tension * 12 + (crashed ? 8 : 0);
    ctx.ellipse(archX, archY + 14, 7, mouthH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Clutching Yellow Drafting T-Square
    ctx.save();
    ctx.translate(archX - 25, archY + 35);
    ctx.rotate(0.3 + (running ? Math.sin(now * 0.04) * 0.3 : 0));
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(-6, -35, 12, 70);
    ctx.fillRect(-22, -45, 44, 12);
    ctx.restore();

    // Flying Sweat Drops
    if (running && tension > 0.25) {
      ctx.fillStyle = '#64b5f6';
      for (let s = 0; s < 3; s++) {
        const swPhase = (view.elapsed * 0.005 + s * 1.8) % 1;
        const swX = archX + (s === 0 ? -35 : 30) - swPhase * 25;
        const swY = archY - 10 + swPhase * 40;
        ctx.beginPath();
        ctx.arc(swX, swY, 3.5 * (1 - swPhase), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Structural Stress Meter (Left Side)
    const meterX = 55;
    const meterY = 250;
    const meterH = 140;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 32, 58, 0.85)';
    ctx.strokeStyle = '#1e3d59';
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, meterY, 28, meterH);
    ctx.fillRect(meterX, meterY, 28, meterH);

    const fillH = meterH * (crashed ? 1 : tension);
    const meterGrad = ctx.createLinearGradient(0, meterY + meterH, 0, meterY);
    meterGrad.addColorStop(0, '#64ffda');
    meterGrad.addColorStop(0.6, '#ffcb6b');
    meterGrad.addColorStop(1, '#ff5370');
    ctx.fillStyle = meterGrad;
    ctx.fillRect(meterX + 3, meterY + meterH - fillH + 2, 22, Math.max(0, fillH - 4));

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STRESS', meterX + 14, meterY - 10);
    ctx.restore();

    // Stamp / Overlay states
    if (cashedOut) {
      ctx.save();
      ctx.translate(planCx, planCy - 20);
      ctx.rotate(-0.18);
      ctx.strokeStyle = COLOURS.approved;
      ctx.lineWidth = 6;
      ctx.strokeRect(-160, -45, 320, 90);
      ctx.fillStyle = 'rgba(105, 240, 174, 0.18)';
      ctx.fillRect(-160, -45, 320, 90);
      ctx.fillStyle = COLOURS.approved;
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DEED APPROVED', 0, 0);
      ctx.restore();
    }

    // HUD & Headers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 38px system-ui, sans-serif';
    ctx.fillText('LAYOUT ROULETTE', 480, 48);

    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('TWO CURSED FLOORPLANS · SHIFTING BEFORE LOAD-BEARING FAILURE', 480, 80);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : cashedOut ? COLOURS.approved : COLOURS.wallStable;
    const pulseScale = running ? 1 + tension * 0.12 * Math.sin(now * 0.015) : 1;
    ctx.save();
    ctx.translate(480, 142);
    ctx.scale(pulseScale, pulseScale);
    ctx.fillStyle = multColor;
    ctx.font = '800 64px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 0, 0);
    ctx.restore();

    // Milestone Caption / Phase text
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const statusText = activeMilestone ? activeMilestone[1] : PHASE_LABELS[view.phase];
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = activeMilestone ? '#ffcb6b' : COLOURS.muted;
    ctx.fillText(statusText, 480, 470, 860);

    // Stake readout line
    const [stkText, stkColour] = stakeLine(view);
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = stkColour;
    ctx.fillText(stkText, 480, 508, 860);

    ctx.restore();
  }

  return { draw };
}
