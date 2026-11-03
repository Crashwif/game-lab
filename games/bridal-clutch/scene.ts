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
  bgDark: '#0b0816',
  pewWood: '#24172f',
  altarGold: '#ffd166',
  neonCyan: '#00f0ff',
  neonMagenta: '#ff007f',
  neonGreen: '#39ff14',
  text: '#ffffff',
  muted: '#b2a5c4',
  crashed: '#ff3366',
  cashedOut: '#00ffcc',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Groom unplugs bridal party soundboard'],
  [150, 'Bridesmaids plant tactical spike by altar'],
  [200, 'Best man throws tactical smoke bouquet'],
  [250, 'Tuxedo sleeve rips from furious mouse flicks'],
  [300, 'Father-in-law coaches bride through headset'],
  [500, 'Priest announces sudden death overtime'],
  [1000, 'Flower girl flashes whole chapel with flare'],
  [10000, 'Esports shoutcasters descend from cathedral'],
  [100000, 'RGB stained glass windows glow across altar'],
  [1000000, 'Radiant tier matrimonial bond unlocked'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Clutched marriage at ${formatX(view.cashoutX100)} · Escaped on RGB golf cart!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Bride hit a 360 noscope · Spectating' : 'Spectating altar clutch · Place a wager', COLOURS.muted];
  }
  if (crashed) return [`Lost ${credits(view.stake)} · Headshotted into the wedding cake`, COLOURS.crashed];
  return [`Clutching vows · ${credits(view.stake)} riding on the ring`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'trap', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastBeatTick = -1;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    audio.update(view.phase, tension);

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.9);
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.8);
      audio.fx('screech' as never, 0.5);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('airhorn', 0.7);
      }
      const beatInterval = Math.max(180, 550 - tension * 320);
      const currentBeat = Math.floor(view.elapsed / beatInterval);
      if (currentBeat > lastBeatTick && view.cashoutX100 === null) {
        lastBeatTick = currentBeat;
        audio.fx('heartbeat', 0.3 + 0.5 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) : 1.5 * tension;

    ctx.save();
    ctx.fillStyle = COLOURS.bgDark;
    ctx.fillRect(0, 0, 960, 540);

    const shakeX = shake * Math.sin(view.elapsed * 0.08);
    const shakeY = shake * Math.cos(view.elapsed * 0.09);
    ctx.translate(shakeX, shakeY);

    // --- Cathedral Esports Arena Background ---
    const beamHue = (view.elapsed * 0.1) % 360;
    const beamGrad = ctx.createLinearGradient(0, 0, 960, 540);
    beamGrad.addColorStop(0, `hsla(${beamHue}, 70%, 15%, 0.8)`);
    beamGrad.addColorStop(1, '#080511');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Stained Glass Arch
    ctx.save();
    ctx.strokeStyle = `hsl(${(beamHue + 180) % 360}, 90%, 55%)`;
    ctx.lineWidth = 3 + 4 * tension;
    ctx.shadowBlur = 15;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(480, 180, 190, Math.PI, 0, false);
    ctx.lineTo(670, 420);
    ctx.lineTo(290, 420);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Esports Cross-hair Spotlights sweeping
    const spotAngle = Math.sin(view.elapsed * 0.003) * 0.6;
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.18 * tension;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(100, 0);
    ctx.lineTo(480 + Math.sin(spotAngle) * 200, 480);
    ctx.lineTo(400 + Math.sin(spotAngle) * 200, 480);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.moveTo(860, 0);
    ctx.lineTo(480 - Math.sin(spotAngle) * 200, 480);
    ctx.lineTo(560 - Math.sin(spotAngle) * 200, 480);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Tactical smoke bouquets billowing on aisle
    const smokeCount = 5;
    for (let i = 0; i < smokeCount; i++) {
      const smokePhase = ((view.elapsed * 0.001 + i * 0.7) % 3.5) / 3.5;
      const sx = 200 + i * 140 + Math.sin(view.elapsed * 0.002 + i) * 30;
      const sy = 460 - smokePhase * 110;
      const sRadius = 25 + smokePhase * 45;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 127, 0.16)' : 'rgba(0, 240, 255, 0.14)';
      ctx.beginPath();
      ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floor & Altar Carpet
    ctx.fillStyle = '#170c2a';
    ctx.fillRect(0, 430, 960, 110);
    const carpetGrad = ctx.createLinearGradient(340, 430, 620, 430);
    carpetGrad.addColorStop(0, '#750b38');
    carpetGrad.addColorStop(0.5, '#c2185b');
    carpetGrad.addColorStop(1, '#750b38');
    ctx.fillStyle = carpetGrad;
    ctx.fillRect(360, 430, 240, 110);

    // Tier-3 Wedding Cake on right
    const cakeX = 840;
    const cakeY = 440;
    ctx.fillStyle = '#fce4ec';
    ctx.fillRect(cakeX - 45, cakeY - 30, 90, 30);
    ctx.fillRect(cakeX - 35, cakeY - 60, 70, 30);
    ctx.fillRect(cakeX - 25, cakeY - 85, 50, 25);
    ctx.fillStyle = '#ff4081';
    ctx.fillRect(cakeX - 45, cakeY - 32, 90, 4);
    ctx.fillRect(cakeX - 35, cakeY - 62, 70, 4);
    ctx.fillRect(cakeX - 25, cakeY - 87, 50, 4);
    // Cake topper figures
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(cakeX - 8, cakeY - 96, 6, 0, Math.PI * 2);
    ctx.arc(cakeX + 8, cakeY - 96, 6, 0, Math.PI * 2);
    ctx.fill();

    // Priest at altar
    const priestBob = Math.sin(view.elapsed * 0.005) * 4;
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.arc(480, 290 + priestBob, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(465, 304 + priestBob, 30, 60);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(475, 306 + priestBob, 10, 50); // Priest stole
    // Priest arms waving
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(465, 316 + priestBob);
    ctx.lineTo(440, 295 + (crashed ? -20 : priestBob));
    ctx.moveTo(495, 316 + priestBob);
    ctx.lineTo(520, 295 + (crashed ? -20 : priestBob));
    ctx.stroke();

    // Tactical Bride (Right side / charging or aiming)
    const brideX = 640 - tension * 30;
    const brideY = 380;
    // Bride armor & veil
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(brideX + 12, brideY - 40, 22, 45, Math.PI / 10, 0, Math.PI * 2);
    ctx.fill();
    // Head / Tactical helmet + veil
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(brideX, brideY - 32, 16, 0, Math.PI * 2);
    ctx.fill();
    // Tactical visor
    ctx.fillStyle = COLOURS.neonMagenta;
    ctx.fillRect(brideX - 12, brideY - 35, 14, 7);
    // Kevlar wedding gown
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(brideX - 14, brideY - 14);
    ctx.lineTo(brideX + 18, brideY - 14);
    ctx.lineTo(brideX + 30, brideY + 45);
    ctx.lineTo(brideX - 25, brideY + 45);
    ctx.closePath();
    ctx.fill();
    // Sniper rifle / AWP pointing at groom
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(brideX - 5, brideY - 5);
    ctx.lineTo(brideX - 55, brideY - 12);
    ctx.stroke();
    // Tactical laser sight
    ctx.strokeStyle = 'rgba(255, 0, 80, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(brideX - 55, brideY - 12);
    ctx.lineTo(350, 360);
    ctx.stroke();

    // Protagonist: Trembling Groom at folding table (Left side)
    const jitter = running ? (Math.random() - 0.5) * (4 + tension * 8) : 0;
    const groomX = 330 + jitter;
    const groomY = 385;

    // Folding Desk
    ctx.fillStyle = '#475569';
    ctx.fillRect(groomX - 50, groomY - 10, 100, 8);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(groomX - 45, groomY - 2);
    ctx.lineTo(groomX - 52, groomY + 45);
    ctx.moveTo(groomX + 45, groomY - 2);
    ctx.lineTo(groomX + 52, groomY + 45);
    ctx.stroke();

    // Gaming RGB Monitor
    const monitorX = groomX + 15;
    const monitorY = groomY - 45;
    if (crashed) {
      // Monitor kicked across into wedding cake
      const kickProgress = clamp01(crashAgeSec / 0.7);
      const mFlyX = monitorX + kickProgress * (cakeX - monitorX - 20);
      const mFlyY = monitorY - Math.sin(kickProgress * Math.PI) * 110 + kickProgress * 40;
      ctx.save();
      ctx.translate(mFlyX, mFlyY);
      ctx.rotate(kickProgress * 9);
      ctx.fillStyle = '#111';
      ctx.fillRect(-22, -16, 44, 32);
      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 2;
      ctx.strokeRect(-22, -16, 44, 32);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(monitorX - 24, monitorY - 18, 48, 32);
      ctx.strokeStyle = `hsl(${beamHue}, 100%, 55%)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(monitorX - 24, monitorY - 18, 48, 32);
      // Screen glow
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(monitorX - 21, monitorY - 15, 42, 26);
    }

    // Groom body (sweating in rented tux)
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(groomX - 35, groomY - 20, 26, 42); // Tuxedo jacket
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(groomX - 26, groomY - 20, 8, 20); // Shirt
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(groomX - 22, groomY - 18, 3, 0, Math.PI * 2); // Bowtie
    ctx.fill();

    // Groom Head
    ctx.fillStyle = '#ffdfba';
    ctx.beginPath();
    ctx.arc(groomX - 22, groomY - 34, 13, 0, Math.PI * 2);
    ctx.fill();
    // Hair
    ctx.fillStyle = '#37271e';
    ctx.beginPath();
    ctx.arc(groomX - 22, groomY - 37, 13, Math.PI, 0, false);
    ctx.fill();
    // Sweating droplets
    if (running && tension > 0.2) {
      ctx.fillStyle = '#38bdf8';
      for (let s = 0; s < 3; s++) {
        const dropY = groomY - 40 + ((view.elapsed * 0.1 + s * 18) % 28);
        ctx.beginPath();
        ctx.arc(groomX - 38 + s * 5, dropY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Groom Arm & RGB Mouse flicking
    const armFlick = running ? Math.sin(view.elapsed * (0.04 + tension * 0.05)) * 12 : 0;
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(groomX - 20, groomY - 12);
    ctx.lineTo(groomX - 5 + armFlick, groomY - 12);
    ctx.stroke();

    // RGB Gaming Mouse
    ctx.fillStyle = `hsl(${(view.elapsed * 0.5) % 360}, 100%, 55%)`;
    ctx.beginPath();
    ctx.ellipse(groomX - 3 + armFlick, groomY - 12, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Cashout Golf Cart Escape Animation ---
    if (view.cashoutX100 !== null) {
      const cartProgress = clamp01(view.elapsed / 2000);
      const cartX = 180 + cartProgress * 620;
      const cartY = 410;
      // Golf Cart Frame
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cartX - 45, cartY - 35, 90, 30);
      ctx.fillStyle = '#00ffcc';
      ctx.fillRect(cartX - 45, cartY - 5, 90, 8); // Neon underglow
      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cartX - 25, cartY + 6, 12, 0, Math.PI * 2);
      ctx.arc(cartX + 25, cartY + 6, 12, 0, Math.PI * 2);
      ctx.fill();
      // Canopy & Poles
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 3;
      ctx.strokeRect(cartX - 40, cartY - 60, 80, 26);
      // Just married sign
      ctx.fillStyle = '#ff007f';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JUST MARRIED (CLUTCHED)', cartX, cartY - 44);
      // Heart particles trailing
      ctx.fillStyle = '#ff3366';
      for (let h = 0; h < 6; h++) {
        const hx = cartX - 60 - h * 22;
        const hy = cartY - 10 + Math.sin(view.elapsed * 0.01 + h) * 12;
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Crashed Overlays (360 Noscope & Cake Splatter) ---
    if (crashed) {
      ctx.save();
      // Sniper hit indicator
      ctx.fillStyle = 'rgba(255, 0, 50, 0.35)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#ff0055';
      ctx.font = '900 52px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('360 NOSCOPE HEADSHOT!', 480, 205);
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('PRIEST: "GG NO RE"', 480, 245);
      // Splatter on wedding cake
      ctx.fillStyle = '#fce4ec';
      for (let s = 0; s < 12; s++) {
        const sx = cakeX - 80 + (s * 17) % 110;
        const sy = cakeY - 60 + ((s * 23) % 80);
        ctx.beginPath();
        ctx.arc(sx, sy, 8 + (s % 5) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- HUD Overlay ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Viral Subtitle
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonMagenta;
    ctx.fillText('BRIDAL CLUTCH', 480, 36);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillText('1v1 AT THE ALTAR · SECURE THE RING OR GET NOSCOPED', 480, 58);

    // Multiplier readout
    const multiplierColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.neonGreen;
    const multSize = 64 + depth * 14 + (running ? Math.sin(view.elapsed * 0.01) * 3 : 0);
    ctx.font = `900 ${multSize}px ui-monospace, monospace`;
    ctx.fillStyle = multiplierColor;
    ctx.shadowBlur = 18;
    ctx.shadowColor = multiplierColor;
    ctx.fillText(formatX(view.currentX100), 480, 115);
    ctx.shadowBlur = 0;

    // Milestone Caption
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    const milestoneText = currentMilestone ? currentMilestone[1] : (running ? 'Round live · Tension building' : 'Preparing vows...');
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(milestoneText, 480, 155);

    // Stake line / Player status
    const [line, lineColour] = stakeLine(view);
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = lineColour;
    ctx.fillText(line, 480, 508);

    ctx.restore();
  }

  return { draw };
}
