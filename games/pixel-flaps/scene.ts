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
  [120, 'Gold chain straps glint cleanly under studio lamps'],
  [150, 'Stitching begins showing microscopic wavy patterns'],
  [200, 'Valentino heel straps sprout seven weird holes'],
  [250, 'Senior fashion editor reaches for jewelers loupe'],
  [300, 'Entire staff huddles over the glossy 8k printout'],
  [500, 'Leather grain vibrates into fractal spaghetti'],
  [1000, 'AI scanner progress bar hits 99% probability'],
  [10000, 'Purse strap detaches and floats in zero gravity'],
  [100000, 'Model in the ad blinks three extra digital eyes'],
  [1000000, 'Editorial desk collapses under pure synthetic drip'],
];

const COLOURS = {
  bgDeep: '#13091f',
  bgDesk: '#241238',
  leather: '#c2185b',
  leatherDeep: '#880e4f',
  gold: '#ffd54f',
  goldDark: '#ff8f00',
  cyanGlitch: '#00e5ff',
  pinkGlitch: '#ff007f',
  text: '#ffffff',
  muted: '#c4b5d4',
  cashedOut: '#69f0ae',
  crashed: '#ff5252',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.28 * pop * pop)}px system-ui, -apple-system, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Stamped & Published at ${formatX(view.cashoutX100)} · Couture Secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Synthetic fraud exposed · no credits lost' : 'Spectating couture review · no credits riding', COLOURS.muted];
  }
  if (crashed) return [`Fraud detector triggered! Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Commission on the line · ${credits(view.stake)} riding`, COLOURS.gold];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastLoupeTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Loupe tick sync
    const currentTick = Math.floor(view.elapsed / 450);
    if (running && currentTick > lastLoupeTick && view.cashoutX100 === null) {
      audio.fx('tick', 0.25 + 0.5 * tension);
      lastLoupeTick = currentTick;
    }

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('camera', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.75);
    }
    if (running && previousPhase === 'running' && milestoneCount > previousMilestone) {
      audio.milestone(milestoneCount);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneCount;

    const crashAge = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAge / 0.55) ** 2 : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. Studio Desk & Proof Layout Background
    const bgGrad = ctx.createRadialGradient(480, 260, 60, 480, 270, 520);
    bgGrad.addColorStop(0, '#2d1845');
    bgGrad.addColorStop(0.6, COLOURS.bgDesk);
    bgGrad.addColorStop(1, COLOURS.bgDeep);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Editorial proof print mat
    ctx.save();
    ctx.fillStyle = '#0f0817';
    ctx.strokeStyle = '#432663';
    ctx.lineWidth = 2;
    ctx.fillRect(160, 150, 640, 290);
    ctx.strokeRect(160, 150, 640, 290);

    // Crop marks and proof markings
    ctx.strokeStyle = '#7c4dff';
    ctx.lineWidth = 1.5;
    const marks = [
      [150, 140, 20, 0], [150, 140, 0, 20],
      [810, 140, -20, 0], [810, 140, 0, 20],
      [150, 450, 20, 0], [150, 450, 0, -20],
      [810, 450, -20, 0], [810, 450, 0, -20],
    ];
    for (const [mx, my, dx, dy] of marks) {
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + dx, my + dy);
      ctx.stroke();
    }

    ctx.fillStyle = '#7c4dff';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText('CMYK PROOF #404-GEN // VOGUEISH COUTURE PREVIEW // 600 DPI', 180, 172);

    // Color swatch blocks on sheet
    const swatches = ['#ff007f', '#00e5ff', '#ffd54f', '#ffffff', '#220033'];
    swatches.forEach((c, idx) => {
      ctx.fillStyle = c;
      ctx.fillRect(720 + idx * 12, 163, 9, 9);
    });
    ctx.restore();

    // 2. The Protagonist: Luxury Quilted Handbag ("Pixel Flap")
    const bagBob = Math.sin(view.elapsed * 0.003) * 6;
    const bagW = 280;
    const bagH = 170;
    const bagX = 480 - bagW / 2;
    const bagY = 250 - bagH / 2 + bagBob;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;

    // Bag base body
    const leatherGrad = ctx.createLinearGradient(bagX, bagY, bagX + bagW, bagY + bagH);
    leatherGrad.addColorStop(0, COLOURS.leather);
    leatherGrad.addColorStop(0.5, COLOURS.leatherDeep);
    leatherGrad.addColorStop(1, '#4a0033');

    ctx.fillStyle = leatherGrad;
    ctx.beginPath();
    ctx.roundRect(bagX, bagY, bagW, bagH, [16, 16, 24, 24]);
    ctx.fill();
    ctx.restore();

    // Quilted diamond stitching (gets twisted with tension)
    ctx.save();
    ctx.strokeStyle = crashed ? COLOURS.crashed : tension > 0.4 ? COLOURS.goldDark : '#f06292';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(bagX + 4, bagY + 4, bagW - 8, bagH - 8, 14);
    ctx.clip();

    const warp = tension * 12 * Math.sin(view.elapsed * 0.008);
    const step = 26;
    for (let x = -bagH; x < bagW + bagH; x += step) {
      ctx.beginPath();
      ctx.moveTo(bagX + x, bagY);
      ctx.bezierCurveTo(
        bagX + x + bagH * 0.5 + warp, bagY + bagH * 0.5,
        bagX + x + bagH * 0.7 - warp, bagY + bagH * 0.7,
        bagX + x + bagH, bagY + bagH
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bagX + x + bagH, bagY);
      ctx.bezierCurveTo(
        bagX + x + bagH * 0.5 - warp, bagY + bagH * 0.5,
        bagX + x + bagH * 0.3 + warp, bagY + bagH * 0.7,
        bagX + x, bagY + bagH
      );
      ctx.stroke();
    }
    ctx.restore();

    // Triangular quilted flap cover
    ctx.save();
    ctx.fillStyle = COLOURS.leather;
    ctx.beginPath();
    ctx.moveTo(bagX, bagY + 10);
    ctx.lineTo(bagX + bagW, bagY + 10);
    ctx.lineTo(bagX + bagW * 0.85, bagY + bagH * 0.65);
    ctx.lineTo(480, bagY + bagH * 0.82);
    ctx.lineTo(bagX + bagW * 0.15, bagY + bagH * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLOURS.gold;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Gold Chain Straps arching above bag (extra hallucinated straps appear at high tension)
    const strapCount = 1 + (tension > 0.5 ? 1 : 0) + (tension > 0.8 ? 2 : 0);
    for (let s = 0; s < strapCount; s++) {
      const offset = (s - (strapCount - 1) / 2) * 28;
      ctx.strokeStyle = s === 0 ? COLOURS.gold : COLOURS.cyanGlitch;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(bagX + 35 + offset, bagY + 10);
      ctx.bezierCurveTo(
        bagX + 60 + offset, bagY - 90 - (s * 15),
        bagX + bagW - 60 - offset, bagY - 90 - (s * 15),
        bagX + bagW - 35 - offset, bagY + 10
      );
      ctx.stroke();
    }

    // Gold Turn-lock Logo Clasp
    const claspY = bagY + bagH * 0.72;
    ctx.fillStyle = COLOURS.gold;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(480, claspY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b78103';
    ctx.fillRect(475, claspY - 6, 10, 12);
    ctx.restore();

    // 3. Jeweler's Magnifying Loupe hovering & inspecting
    const loupeRadius = 65;
    const loupeTargetX = 480 + Math.cos(view.elapsed * 0.0022) * 80;
    const loupeTargetY = 270 + Math.sin(view.elapsed * 0.0031) * 35;

    ctx.save();
    // Loupe ring
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#e0e0e0';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12 * tension;
    ctx.beginPath();
    ctx.arc(loupeTargetX, loupeTargetY, loupeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Loupe handle
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#bdbdbd';
    ctx.beginPath();
    ctx.moveTo(loupeTargetX + loupeRadius * 0.7, loupeTargetY + loupeRadius * 0.7);
    ctx.lineTo(loupeTargetX + loupeRadius * 1.5, loupeTargetY + loupeRadius * 1.5);
    ctx.stroke();

    // Reticle crosshair inside loupe
    ctx.strokeStyle = tension > 0.6 ? COLOURS.crashed : COLOURS.cyanGlitch;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(loupeTargetX, loupeTargetY, loupeRadius - 12, 0, Math.PI * 2);
    ctx.moveTo(loupeTargetX - loupeRadius + 5, loupeTargetY);
    ctx.lineTo(loupeTargetX + loupeRadius - 5, loupeTargetY);
    ctx.moveTo(loupeTargetX, loupeTargetY - loupeRadius + 5);
    ctx.lineTo(loupeTargetX, loupeTargetY + loupeRadius - 5);
    ctx.stroke();

    // Loupe HUD scanning tag
    const synthPercent = Math.min(99, Math.floor(10 + tension * 88 + depth * 2));
    ctx.fillStyle = tension > 0.6 ? COLOURS.crashed : COLOURS.cyanGlitch;
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillText(`SYNTH: ${synthPercent}%`, loupeTargetX - 32, loupeTargetY - loupeRadius - 8);
    ctx.restore();

    // 4. Glitch / Synthetics Burst upon Crash
    if (crashed) {
      ctx.save();
      // Flashing alert banner
      const flash = Math.floor(crashAge * 8) % 2 === 0;
      ctx.fillStyle = flash ? 'rgba(255, 0, 80, 0.25)' : 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, 960, 540);

      // Glitch blocks
      for (let i = 0; i < 18; i++) {
        const gx = 200 + ((i * 47 + crashAge * 200) % 560);
        const gy = 160 + ((i * 31) % 240);
        const gw = 40 + (i % 5) * 20;
        const gh = 6 + (i % 4) * 8;
        ctx.fillStyle = i % 2 === 0 ? COLOURS.cyanGlitch : COLOURS.pinkGlitch;
        ctx.fillRect(gx, gy, gw, gh);
      }

      // Red Stamped Box: FRAUDULENT
      ctx.save();
      ctx.translate(480, 270);
      ctx.rotate(-0.16);
      ctx.strokeStyle = COLOURS.crashed;
      ctx.lineWidth = 6;
      ctx.strokeRect(-180, -45, 360, 90);
      ctx.fillStyle = 'rgba(255, 56, 100, 0.15)';
      ctx.fillRect(-180, -45, 360, 90);
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '900 38px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('100% SYNTHETIC', 0, -5);
      ctx.font = '700 15px ui-monospace, monospace';
      ctx.fillText('REJECTED BY EDITORIAL BOARD', 0, 24);
      ctx.restore();
      ctx.restore();
    }

    // 5. Cashout Escape: Editor Approved Stamp
    if (view.cashoutX100 !== null) {
      ctx.save();
      ctx.translate(480, 255);
      ctx.rotate(-0.12);
      ctx.strokeStyle = COLOURS.cashedOut;
      ctx.lineWidth = 6;
      ctx.strokeRect(-170, -44, 340, 88);
      ctx.fillStyle = 'rgba(105, 240, 174, 0.18)';
      ctx.fillRect(-170, -44, 340, 88);
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.textAlign = 'center';
      ctx.font = '900 40px system-ui, sans-serif';
      ctx.fillText('APPROVED', 0, -4);
      ctx.font = '700 15px ui-monospace, monospace';
      ctx.fillText('SENT TO VOGUE PRINT RUN', 0, 24);
      ctx.restore();
    }

    // 6. Primary HUD: Title, Multiplier, Milestone & Stake
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Header Game Title
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText('PIXEL FLAPS', 480, 48);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 14px ui-monospace, monospace';
    ctx.fillText('HAUTE COUTURE GENERATOR · SNOOTY MAGAZINE DESK', 480, 78);

    // Huge Multiplier Readout
    const punch = crashed ? (1 - clamp01((crashAge - 0.12) / 0.25)) ** 2 : 0;
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.gold;
    ctx.fillStyle = multColor;
    ctx.font = `800 ${68 * (1 + 0.18 * punch)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 126);

    // Milestone Caption / Current Phase Info
    const activeMilestone = running ? MILESTONES[milestoneCount - 1] : undefined;
    const statusText = activeMilestone ? activeMilestone[1] : (
      view.phase === 'betting' ? 'Awaiting Editorial Submission...' :
      view.phase === 'crashed' ? 'Runway disaster! Extra fingers on the model cover!' :
      'Inspecting purse flap under jeweler loupe...'
    );

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.font = popFont(600, 20, pop(activeMilestone?.[0] ?? 100));
    ctx.fillText(statusText, 480, 465, 860);

    // Stake line
    const [lineText, lineColour] = stakeLine(view);
    ctx.fillStyle = lineColour;
    ctx.font = popFont(600, 19, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(lineText, 480, 505, 860);

    ctx.restore();
  }

  return { draw };
}
