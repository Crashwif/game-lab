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
  skyDark: '#08111e',
  skyAurora: '#0d383b',
  groundSnow: '#cad7e6',
  groundMud: '#2b211a',
  neonCyan: '#00f3ff',
  neonMagenta: '#ff0077',
  neonGreen: '#39ff14',
  serverRack: '#141c26',
  warningRed: '#ff2244',
  text: '#f0f6fc',
  muted: '#8b9bb4',
  gold: '#ffd23f',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First acre leveled for server foundations'],
  [150, 'Chainsaw blades upgraded to titanium lasers'],
  [200, 'Local wildlife watches nervously from edges'],
  [250, '50,000 pines down, green energy badge applied'],
  [300, 'Cooling water pipeline diverted from lake'],
  [500, 'Finnish forestry rangers spot aerial smoke'],
  [1000, 'Entire horizon converted to server gravel'],
  [10000, 'AI begins hallucinating synthetic trees'],
  [100000, 'Global cloud node running on boreal biomass'],
  [1000000, 'Planetary compute paradise with zero oxygen left'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Cashed out at ${formatX(view.cashoutX100)} · 100% Carbon Offset Faked!`, COLOURS.neonGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Inspection raid over · zero risk taken' : 'Watching telemetry · zero wood cut', COLOURS.muted];
  }
  if (crashed) return [`Seized by Finnish regulators! Lost ${credits(view.stake)}`, COLOURS.warningRed];
  return [`Harvester active · ${credits(view.stake)} compute cluster expanding`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSawBeat = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('zap', 0.75);
      }
      const sawInterval = Math.max(120, 480 - tension * 320);
      if (now - lastSawBeat > sawInterval) {
        lastSawBeat = now;
        audio.fx('buzz', 0.25 + 0.35 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;
    const shakeX = shake * Math.sin(crashAgeSec * 62);
    const shakeY = shake * Math.cos(crashAgeSec * 73);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Arctic boreal sky & aurora
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, COLOURS.skyDark);
    skyGrad.addColorStop(0.65, '#0b1e2e');
    skyGrad.addColorStop(1, '#11333a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Aurora ribbons (fade slightly as compute smog rises)
    const auroraAlpha = clamp01(0.55 - depth * 0.35);
    if (auroraAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = auroraAlpha;
      ctx.fillStyle = COLOURS.neonCyan;
      ctx.beginPath();
      ctx.moveTo(0, 60);
      for (let x = 0; x <= 960; x += 60) {
        const wav = Math.sin(x * 0.008 + now * 0.0018) * 35 + Math.cos(x * 0.015 - now * 0.001) * 20;
        ctx.lineTo(x, 70 + wav);
      }
      ctx.lineTo(960, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Distant mountain ridge & boreal silhouette
    ctx.fillStyle = '#061019';
    ctx.beginPath();
    ctx.moveTo(0, 310);
    for (let x = 0; x <= 960; x += 80) {
      const my = 260 + Math.sin(x * 0.006) * 30 + (x % 160 === 0 ? -15 : 10);
      ctx.lineTo(x, my);
    }
    ctx.lineTo(960, 380);
    ctx.lineTo(0, 380);
    ctx.closePath();
    ctx.fill();

    // 2. Arctic tundra terrain (gradually replaces snow with compute gravel/concrete)
    const groundY = 360;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, 540);
    const snowFactor = clamp01(1 - depth * 1.2);
    groundGrad.addColorStop(0, snowFactor > 0.3 ? COLOURS.groundSnow : '#3d4554');
    groundGrad.addColorStop(1, snowFactor > 0.3 ? '#8ba2b8' : '#1c222b');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, 960, 180);

    // Tree stumps & sprouting glowing server racks
    const rackCount = 7;
    for (let i = 0; i < rackCount; i++) {
      const rx = 40 + i * 140;
      const ry = groundY + 10 + (i % 3) * 18;
      // Stumps
      ctx.fillStyle = '#4a3424';
      ctx.fillRect(rx - 8, ry + 12, 16, 12);
      ctx.fillStyle = '#6e513a';
      ctx.beginPath();
      ctx.ellipse(rx, ry + 12, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Server rack sprouted on stump
      const rackHeight = 25 + Math.min(65, depth * 70 + (i < milestoneIndex ? 20 : 0));
      ctx.fillStyle = COLOURS.serverRack;
      ctx.fillRect(rx - 14, ry + 12 - rackHeight, 28, rackHeight);
      ctx.strokeStyle = '#2b3b4f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx - 14, ry + 12 - rackHeight, 28, rackHeight);

      // Blinking rack LEDs & fiber optics
      const ledTick = Math.floor((now * 0.006 + i) % 4);
      ctx.fillStyle = ledTick === 0 ? COLOURS.neonMagenta : ledTick === 1 ? COLOURS.neonCyan : COLOURS.neonGreen;
      ctx.fillRect(rx - 10, ry + 16 - rackHeight, 5, 3);
      ctx.fillStyle = ledTick === 2 ? COLOURS.neonGreen : COLOURS.neonCyan;
      ctx.fillRect(rx + 5, ry + 16 - rackHeight, 5, 3);

      // Steam puffs rising from liquid cooling
      if (running && (i + Math.floor(now * 0.004)) % 3 === 0) {
        ctx.fillStyle = 'rgba(210, 245, 255, 0.3)';
        const steamY = ry - rackHeight - ((now * 0.05 + i * 20) % 30);
        ctx.beginPath();
        ctx.arc(rx + (i % 2 === 0 ? 4 : -4), steamY, 6 + (depth * 4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Robotic Harvester (Protagonist)
    const hx = 640;
    const hy = groundY - 10;
    const bob = running ? Math.sin(now * 0.012) * 3 : 0;

    // Heavy tracked chassis
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(hx - 90, hy + 24, 180, 36);
    // Neon tread wheel outlines
    ctx.strokeStyle = COLOURS.neonCyan;
    ctx.lineWidth = 3;
    ctx.strokeRect(hx - 88, hy + 26, 176, 32);
    for (let w = -70; w <= 70; w += 28) {
      ctx.fillStyle = '#0a1017';
      ctx.beginPath();
      ctx.arc(hx + w, hy + 42, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#324a61';
      ctx.stroke();
    }

    // Main armoured cabin
    ctx.fillStyle = '#0f1722';
    ctx.beginPath();
    ctx.moveTo(hx - 70, hy + 24 + bob);
    ctx.lineTo(hx - 50, hy - 45 + bob);
    ctx.lineTo(hx + 30, hy - 45 + bob);
    ctx.lineTo(hx + 65, hy + 24 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLOURS.neonMagenta;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // High-tech glowing cockpit glass
    ctx.fillStyle = 'rgba(0, 243, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(hx - 40, hy - 40 + bob);
    ctx.lineTo(hx - 15, hy - 40 + bob);
    ctx.lineTo(hx, hy - 5 + bob);
    ctx.lineTo(hx - 45, hy - 5 + bob);
    ctx.closePath();
    ctx.fill();

    // Industrial exhaust & heat radiation
    ctx.fillStyle = '#303b47';
    ctx.fillRect(hx + 35, hy - 65 + bob, 14, 25);
    if (running) {
      const smokeCount = 4;
      for (let s = 0; s < smokeCount; s++) {
        const sy = hy - 75 - ((now * 0.06 + s * 25) % 80);
        const sx = hx + 42 + Math.sin(sy * 0.05) * 12;
        ctx.fillStyle = `rgba(180, 210, 230, ${0.4 - (hy - 75 - sy) / 160})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 8 + s * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hydraulic articulated arm reaching left
    const armAngle = -0.35 + (running ? Math.sin(now * 0.008) * 0.15 : 0);
    const elbowX = hx - 80;
    const elbowY = hy - 25 + bob;
    const sawHeadX = elbowX - 85 * Math.cos(armAngle);
    const sawHeadY = elbowY + 85 * Math.sin(armAngle);

    ctx.strokeStyle = '#475b73';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(hx - 30, hy - 15 + bob);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(sawHeadX, sawHeadY);
    ctx.stroke();

    // Giant spinning neon harvester buzzsaw / laser cutter
    const sawAngle = now * 0.025;
    ctx.save();
    ctx.translate(sawHeadX, sawHeadY);
    ctx.rotate(sawAngle);

    ctx.fillStyle = '#d0e0ed';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    // Neon laser teeth
    ctx.strokeStyle = COLOURS.neonMagenta;
    ctx.lineWidth = 4;
    for (let t = 0; t < 8; t++) {
      const ta = (t * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ta) * 20, Math.sin(ta) * 20);
      ctx.lineTo(Math.cos(ta) * 36, Math.sin(ta) * 36);
      ctx.stroke();
    }
    ctx.restore();

    // Laser beam slicing into boreal pine
    if (running) {
      ctx.strokeStyle = COLOURS.neonCyan;
      ctx.lineWidth = 3 + Math.sin(now * 0.05) * 2;
      ctx.beginPath();
      ctx.moveTo(sawHeadX, sawHeadY);
      ctx.lineTo(sawHeadX - 40, sawHeadY + 25);
      ctx.stroke();

      // Laser sparks flying
      for (let sp = 0; sp < 6; sp++) {
        const sparkAge = ((now * 0.02 + sp * 12) % 30);
        ctx.fillStyle = sp % 2 === 0 ? COLOURS.gold : COLOURS.neonCyan;
        ctx.fillRect(sawHeadX - 35 - sparkAge * 1.5, sawHeadY + 20 + Math.sin(sp + now * 0.01) * 15, 3, 3);
      }
    }

    // 4. CASHOUT STATE: Fake Solar Canopy & Green Carbon Certificate
    if (view.cashoutX100 !== null) {
      // Fake green solar panel deployed over harvester
      ctx.save();
      ctx.fillStyle = '#06543c';
      ctx.fillRect(hx - 95, hy - 85, 190, 16);
      ctx.strokeStyle = COLOURS.neonGreen;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(hx - 95, hy - 85, 190, 16);

      // Solar grid pattern
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.6)';
      ctx.lineWidth = 1;
      for (let sp = -80; sp < 90; sp += 18) {
        ctx.beginPath();
        ctx.moveTo(hx + sp, hy - 85);
        ctx.lineTo(hx + sp, hy - 69);
        ctx.stroke();
      }

      // 100% Carbon Neutral Banner
      ctx.fillStyle = '#0b261a';
      ctx.strokeStyle = COLOURS.neonGreen;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(hx - 110, hy - 145, 220, 48, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.textAlign = 'center';
      ctx.fillText('LEGAL GREEN CANOPY DEPLOYED', hx, hy - 126);
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillStyle = '#d4fce1';
      ctx.fillText('AUDITORS BAFFLED · 100% ZERO EMISSIONS', hx, hy - 108);

      // Clueless inspector walking away on right
      const insX = 890;
      const insY = groundY + 15;
      ctx.fillStyle = '#3f536e';
      ctx.fillRect(insX - 6, insY - 26, 12, 26);
      ctx.fillStyle = '#ffe0bd';
      ctx.beginPath();
      ctx.arc(insX, insY - 32, 6, 0, Math.PI * 2);
      ctx.fill();
      // Green clipboard
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.fillRect(insX + 4, insY - 20, 8, 12);
      ctx.restore();
    }

    // 5. CRASH STATE: Furious Reindeer & Red Stop-Work Seals Drop
    if (crashed) {
      const ageNorm = clamp01(crashAgeSec / 0.35);

      // Shipping container dropped on harvester
      const containerY = (hy - 120) + (1 - (1 - ageNorm) ** 3) * 60;
      ctx.fillStyle = '#8f1d24';
      ctx.fillRect(hx - 70, containerY, 140, 75);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(hx - 70, containerY, 140, 75);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 14px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('REGULATORY CONFISCATION', hx, containerY + 42);

      // Furious Finnish Reindeer charging on left
      const reinX = 390;
      const reinY = groundY + 8;
      ctx.fillStyle = '#6e4f38';
      // Body
      ctx.beginPath();
      ctx.ellipse(reinX, reinY - 14, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.arc(reinX + 32, reinY - 26, 11, 0, Math.PI * 2);
      ctx.fill();
      // Furious glowing red eye
      ctx.fillStyle = COLOURS.warningRed;
      ctx.beginPath();
      ctx.arc(reinX + 36, reinY - 28, 3, 0, Math.PI * 2);
      ctx.fill();
      // Antlers
      ctx.strokeStyle = '#d9c7b6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(reinX + 32, reinY - 36);
      ctx.lineTo(reinX + 28, reinY - 55);
      ctx.lineTo(reinX + 44, reinY - 60);
      ctx.moveTo(reinX + 30, reinY - 45);
      ctx.lineTo(reinX + 16, reinY - 52);
      ctx.stroke();

      // Enormous Red Stop-Work Seal
      ctx.save();
      ctx.translate(480, 220);
      ctx.rotate(-0.06);
      ctx.fillStyle = 'rgba(255, 34, 68, 0.9)';
      ctx.fillRect(-260, -38, 520, 76);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(-255, -34, 510, 68);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 32px ui-monospace, monospace';
      ctx.fillText('STOP-WORK ORDER: FORESTRY RAID', 0, 0);
      ctx.restore();
    }

    // 6. HUD & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline Header
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText('DATA LUMBERJACK', 480, 36);
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillText('BOREAL PINE DEFORESTATION ➔ MASSIVE AI CLOUD NODE', 480, 62);

    // Multiplier Display
    const multColor = crashed ? COLOURS.warningRed : view.cashoutX100 !== null ? COLOURS.neonGreen : COLOURS.neonCyan;
    ctx.fillStyle = multColor;
    const multSize = 80 + (running ? Math.sin(now * 0.005) * 4 : 0);
    ctx.font = `900 ${multSize}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 138);

    // Dynamic Milestone Ribbon / Status
    const passedMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const statusText = passedMilestone ? passedMilestone[1] : (crashed ? 'OPERATIONS SHUT DOWN BY RANGERS' : 'POWERING INDUSTRIAL LASER HARVESTERS');
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 196);

    // Live Player Stake Line
    const [line, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(line, 480, 502);

    ctx.restore();
  }

  return { draw };
}
