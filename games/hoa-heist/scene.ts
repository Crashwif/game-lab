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
  [120, 'Grass blade measured 0.1 inch too tall'],
  [150, 'Trash can left out 4 minutes past 7 AM'],
  [200, 'HOA Zoom link joins with barking dogs'],
  [250, 'Emergency special assessment mailed out'],
  [300, 'Front porch rocking chairs banned by decree'],
  [500, 'Monthly dues double to fund gold fountain'],
  [1000, 'Foreclosure warnings taped to front door'],
  [10000, 'Board votes to rezone living room as gym'],
  [100000, 'Neighborhood declared private feudal estate'],
  [1000000, 'HOA president declares sovereign kingdom'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Escaped to unincorporated woods at ${formatX(view.cashoutX100)}!`, '#4ade80'];
  }
  if (view.stake === null) {
    return [crashed ? 'Lawn seized · you were watching safely' : 'Observing CC&R violations · no stakes', '#94a3b8'];
  }
  if (crashed) return [`Driveway repoed! ${credits(view.stake)} seized for legal fees`, '#f87171'];
  return [`Under inspection · ${credits(view.stake)} at risk`, '#38bdf8'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'elevator', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const escaped = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (previousPhase !== null && running && escaped && previousCashout === null) {
      audio.cashout();
      audio.fx('whoosh', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.9);
    }
    if (running && previousPhase === 'running' && milestone > previousMilestone) {
      audio.milestone(milestone);
      audio.fx('siren', 0.5 + 0.4 * tension);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * Math.exp(-crashSec * 3.5) * Math.sin(crashSec * 50) : 0;

    ctx.save();
    ctx.translate(shake, shake * 0.7);

    // Sky gradient shifts from suburban daylight to grim fluorescent Zoom-blue
    const sky = ctx.createLinearGradient(0, 0, 0, 360);
    const skyR = Math.round(135 - 90 * tension);
    const skyG = Math.round(206 - 130 * tension);
    const skyB = Math.round(250 - 90 * tension);
    sky.addColorStop(0, `rgb(${skyR}, ${skyG}, ${skyB})`);
    sky.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 540);

    // Zoom window floating in the sky (the tyrannical HOA board president)
    const zoomW = 160 + tension * 40;
    const zoomH = 110 + tension * 25;
    const zoomX = 480 - zoomW / 2;
    const zoomY = 32;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = tension > 0.4 ? '#ef4444' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(zoomX, zoomY, zoomW, zoomH, 8);
    ctx.fill();
    ctx.stroke();

    // Zoom president face
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(480, zoomY + zoomH * 0.46, 20, 0, Math.PI * 2);
    ctx.fill();
    // Glares / glasses
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(471, zoomY + zoomH * 0.42, 7, 5);
    ctx.fillRect(482, zoomY + zoomH * 0.42, 7, 5);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.strokeRect(470, zoomY + zoomH * 0.41, 9, 7);
    ctx.strokeRect(481, zoomY + zoomH * 0.41, 9, 7);
    // Stern frown
    ctx.beginPath();
    ctx.arc(480, zoomY + zoomH * 0.58, 6, Math.PI * 1.1, Math.PI * 1.9, false);
    ctx.stroke();
    // Zoom UI label
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRESIDENT CHAD (UNMUTED)', 480, zoomY + zoomH - 8);

    // Distant suburban houses
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < 6; i++) {
      const hx = 30 + i * 160;
      ctx.fillRect(hx, 280, 110, 80);
      ctx.beginPath();
      ctx.moveTo(hx - 8, 280);
      ctx.lineTo(hx + 55, 235);
      ctx.lineTo(hx + 118, 280);
      ctx.closePath();
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
    }

    // Ground: Manicured lawn vs Paved pickleball court (if crashed)
    if (crashed) {
      // Repaved pickleball court
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 350, 960, 190);
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(160, 370, 640, 150);
      // Court white lines
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(160, 370, 640, 150);
      ctx.beginPath();
      ctx.moveTo(480, 370);
      ctx.lineTo(480, 520);
      ctx.stroke();
    } else {
      // Manicured lawn with mower striping
      const stripeW = 60;
      for (let s = 0; s < 16; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#4ade80' : '#22c55e';
        ctx.fillRect(s * stripeW, 350, stripeW, 190);
      }
      // Sidewalk & curbs
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 345, 960, 12);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 357, 960, 4);

      // Laser micrometer measuring grass blades
      const laserY = 352 + Math.sin(now * 0.005) * 4;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(0, laserY);
      ctx.lineTo(960, laserY);
      ctx.stroke();
      ctx.setLineDash([]);
      // Laser badge
      ctx.fillStyle = '#dc2626';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`MEASURED: ${(1.98 + tension * 0.4).toFixed(2)} IN (MAX 2.00 IN)`, 24, laserY - 6);
    }

    // Floating assessment fines / violation notices raining down
    const invoiceCount = Math.floor(6 + tension * 18);
    for (let f = 0; f < invoiceCount; f++) {
      const fx = (f * 157 + (view.elapsed * 0.12) * (1 + (f % 3) * 0.5)) % 940;
      const fy = ((f * 89 + (view.elapsed * 0.22) * (1 + (f % 2) * 0.4)) % 380) + 70;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(Math.sin(now * 0.003 + f) * 0.3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12, -16, 24, 32);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1;
      ctx.strokeRect(-12, -16, 24, 32);
      ctx.fillStyle = '#ef4444';
      ctx.font = '700 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FINE', 0, -6);
      ctx.fillText(`$${(f + 1) * 75}`, 0, 4);
      ctx.restore();
    }

    // Mailbox on the left
    const mailX = 140;
    const mailY = 320;
    ctx.fillStyle = '#475569';
    ctx.fillRect(mailX - 4, mailY, 8, 55);
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(mailX - 22, mailY - 24, 44, 26, [12, 12, 0, 0]);
    ctx.fill();

    // Protagonist & Lawn Mower
    let riderX = 480;
    const engineShake = running ? Math.sin(now * 0.08) * 3 : 0;
    const riderY = 360 + engineShake;

    if (escaped) {
      // Speeding off into the unincorporated woods on the right
      const scoot = Math.min(360, (now % 3000) * 0.3);
      riderX = 540 + scoot;
      // DIY Sovereign flag on the mower
      ctx.fillStyle = '#eab308';
      ctx.fillRect(riderX - 40, riderY - 70, 28, 18);
      ctx.fillStyle = '#000000';
      ctx.font = '700 8px sans-serif';
      ctx.fillText('NO HOA', riderX - 26, riderY - 58);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(riderX - 40, riderY - 70);
      ctx.lineTo(riderX - 40, riderY - 20);
      ctx.stroke();
    }

    if (!crashed || crashSec > 0.6) {
      // Lawn mower base
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(riderX - 35, riderY, 70, 24);
      // Wheels
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(riderX - 26, riderY + 24, 11, 0, Math.PI * 2);
      ctx.arc(riderX + 26, riderY + 24, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(riderX - 26, riderY + 24, 5, 0, Math.PI * 2);
      ctx.arc(riderX + 26, riderY + 24, 5, 0, Math.PI * 2);
      ctx.fill();
      // Handlebar
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(riderX - 18, riderY);
      ctx.lineTo(riderX - 42, riderY - 38);
      ctx.stroke();

      // Terrified Suburbanite
      const subX = riderX - 30;
      const subY = riderY - 45;
      // Body
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(subX - 9, subY, 18, 30);
      // Terrified head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(subX, subY - 14, 15, 0, Math.PI * 2);
      ctx.fill();
      // Sweat droplets if high tension
      if (tension > 0.25 && !escaped) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(subX + 16, subY - 20 + (now % 400) * 0.05, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Eyes (terrified wide or happy if escaped)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(subX - 5, subY - 15, 5, 0, Math.PI * 2);
      ctx.arc(subX + 5, subY - 15, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(escaped ? subX - 3 : subX - 5, subY - 15, 2.5, 0, Math.PI * 2);
      ctx.arc(escaped ? subX + 7 : subX + 5, subY - 15, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Mouth
      if (escaped) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(subX, subY - 9, 5, 0, Math.PI);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(subX, subY - 7, 5, 4 + tension * 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Crashed: Giant wooden gavel slammed down
    if (crashed) {
      const dropProgress = Math.min(1, crashSec * 4);
      const gavelY = 160 + dropProgress * 150;
      ctx.save();
      ctx.translate(480, gavelY);
      ctx.rotate(-0.15 + (1 - dropProgress) * 0.6);
      // Gavel head
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-70, -32, 140, 64);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-76, -35, 12, 70);
      ctx.fillRect(64, -35, 12, 70);
      // Gavel handle
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-12, -180, 24, 150);
      ctx.restore();

      // Signage: Mandatory pickleball court
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(360, 410, 240, 52);
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 3;
      ctx.strokeRect(360, 410, 240, 52);
      ctx.fillStyle = '#854d0e';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MANDATORY PICKLEBALL COURT', 480, 430);
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText('ASSESSMENT: $500 / HR COURT FEE', 480, 448);
    }

    // Multiplier Display
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const multColor = crashed ? '#ef4444' : escaped ? '#22c55e' : tension > 0.6 ? '#f59e0b' : '#0f172a';
    ctx.fillStyle = multColor;
    const punch = crashed ? Math.max(0, 1 - crashSec * 2) * 18 : 0;
    ctx.font = `800 ${68 + punch}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 202);

    // Header Game Title & Subtitle
    ctx.fillStyle = '#1e293b';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('HOA HEIST', 480, 21);
    ctx.fillStyle = '#475569';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('WHISPERING PINES SUBDIVISION · CC&R FINES IN ORBIT', 480, 39);

    // Current Milestone Ticker
    const currentMilestone = MILESTONES[milestone - 1];
    const tickerText = currentMilestone
      ? `VIOLATION: ${currentMilestone[1].toUpperCase()}`
      : running
      ? 'PATROLLING SUBDIVISION WITH RADAR & CLIPBOARD'
      : view.phase === 'betting'
      ? 'ACCEPTING DUES PAYMENTS · PLACE STAKE'
      : view.phase === 'crashed'
      ? 'SPECIAL ASSESSMENT LEVIED · FORECLOSURE IMMINENT'
      : 'AWAITING BOARD MEETING QUORUM';

    ctx.fillStyle = crashed ? '#dc2626' : '#1e293b';
    ctx.fillRect(160, 474, 640, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillText(tickerText, 480, 487);

    // Player stake line & outcome status
    const [statusText, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 518);

    ctx.restore();
  }

  return { draw };
}
