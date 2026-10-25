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
  bgWall: '#150f28',
  carpet: '#26173a',
  neonPink: '#ff2a85',
  neonCyan: '#00f0ff',
  neonOrange: '#ff8800',
  gold: '#ffd13b',
  text: '#f3f4f9',
  muted: '#9ba0bc',
  crashed: '#ff3366',
  cashedOut: '#38ef7d',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Unboxing a massive 77-inch OLED panel'],
  [150, 'Mounting brackets groaning into cheap drywall'],
  [200, 'Adding dual 12-inch subwoofers near radiator'],
  [250, 'Surround speakers taped to ceiling fans'],
  [300, 'RGB backlight strips blinding the whole block'],
  [500, 'PS5 Pro glowing neon blue from overheat'],
  [1000, 'Bass rattle vibrating popcorn ceiling onto floor'],
  [10000, 'Room declared an official IMAX satellite zone'],
  [100000, 'Electric meter spinning at Mach speed outside'],
  [1000000, 'Grand Theft Living Room achieved in 8K HDR'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Cashed out at ${formatX(view.cashoutX100)} · Kicking back in 4K HDR!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Drywall ripped off · Just spectating' : 'Watching the install · No credits placed', COLOURS.muted];
  }
  if (crashed) return [`Drywall collapsed! Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Rig is live · ${credits(view.stake)} pushing the breaker`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let bassTimer = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (prevPhase !== null && running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('zap', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIndex > prevMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx(milestoneIndex % 2 === 0 ? 'creak' : 'buzz', 0.6 + tension * 0.4);
      }
      if (now - bassTimer > (600 - tension * 360)) {
        bassTimer = now;
        audio.fx('thud', 0.3 + 0.5 * tension);
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 18 * Math.max(0, 1 - crashAgeSec / 0.8)
      : running
      ? tension * 4 * Math.sin(now * 0.03)
      : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.09));

    // Room background (walls + retro wallpaper trim)
    const wallGrad = ctx.createLinearGradient(0, 0, 0, 390);
    wallGrad.addColorStop(0, '#100a20');
    wallGrad.addColorStop(1, COLOURS.bgWall);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, 960, 390);

    // Floor carpet
    const floorGrad = ctx.createLinearGradient(0, 390, 0, 540);
    floorGrad.addColorStop(0, '#1a1028');
    floorGrad.addColorStop(1, COLOURS.carpet);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 390, 960, 150);

    // Baseboard moulding
    ctx.fillStyle = '#3a204d';
    ctx.fillRect(0, 384, 960, 10);

    // Drywall cracks (appear as tension mounts, explode when crashed)
    const crackIntensity = crashed ? 1 : tension;
    if (crackIntensity > 0.15) {
      ctx.strokeStyle = crashed ? '#ff2a55' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.8 + crackIntensity * 2;
      ctx.beginPath();
      ctx.moveTo(330, 140);
      ctx.lineTo(310 + crackIntensity * 15, 175);
      ctx.lineTo(290, 210);
      ctx.lineTo(315, 260);
      ctx.moveTo(630, 145);
      ctx.lineTo(650 - crackIntensity * 10, 180);
      ctx.lineTo(670, 230);
      if (crackIntensity > 0.6) {
        ctx.moveTo(480, 110);
        ctx.lineTo(470, 80);
        ctx.lineTo(495, 45);
      }
      ctx.stroke();
    }

    // Popcorn ceiling particles vibrating down
    if (running && tension > 0.3) {
      ctx.fillStyle = 'rgba(230, 230, 250, 0.6)';
      for (let i = 0; i < 18; i++) {
        const px = (Math.sin(i * 99 + now * 0.002) * 0.5 + 0.5) * 960;
        const py = ((now * 0.15 + i * 40) % 360) + 20;
        ctx.fillRect(px, py, 2, 2.5);
      }
    }

    // TV Backlight Glow
    const rgbPhase = (now * 0.004) % (Math.PI * 2);
    const glowColor = crashed
      ? 'rgba(255, 30, 60, 0.35)'
      : `rgba(${Math.sin(rgbPhase) * 100 + 155}, ${Math.sin(rgbPhase + 2) * 80 + 100}, 255, ${0.25 + 0.45 * tension})`;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 35 + tension * 45;

    // The Colossal 77-inch OLED Panel
    const tvW = 430 + depth * 35;
    const tvH = 225 + depth * 15;
    const tvX = 480 - tvW / 2;
    const tvY = 135;

    ctx.save();
    if (crashed) {
      // Fallen & ripped off wall
      const dropY = Math.min(100, crashAgeSec * 320);
      const rot = Math.min(0.24, crashAgeSec * 0.3);
      ctx.translate(480, tvY + tvH / 2 + dropY);
      ctx.rotate(rot);
      ctx.translate(-480, -(tvY + tvH / 2));
    }

    // TV outer bezel
    ctx.fillStyle = '#08080f';
    ctx.fillRect(tvX - 6, tvY - 6, tvW + 12, tvH + 12);

    // Screen content
    if (cashedOut) {
      // Peaceful GTA VI Vice City palm paradise preview
      const skyGrad = ctx.createLinearGradient(tvX, tvY, tvX, tvY + tvH);
      skyGrad.addColorStop(0, '#ff3377');
      skyGrad.addColorStop(0.5, '#7b2ff7');
      skyGrad.addColorStop(1, '#00d2ff');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(tvX, tvY, tvW, tvH);

      // Palm silhouettes
      ctx.fillStyle = '#110526';
      ctx.beginPath();
      ctx.arc(tvX + 80, tvY + tvH - 20, 45, 0, Math.PI * 2);
      ctx.arc(tvX + tvW - 80, tvY + tvH - 30, 55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GTA VI: READY TO PLAY', 480, tvY + tvH / 2);
    } else if (crashed) {
      // Shattered screen
      ctx.fillStyle = '#05070d';
      ctx.fillRect(tvX, tvY, tvW, tvH);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tvX + 50, tvY + 30);
      ctx.lineTo(tvX + 220, tvY + 110);
      ctx.lineTo(tvX + 380, tvY + 80);
      ctx.moveTo(tvX + 220, tvY + 110);
      ctx.lineTo(tvX + 170, tvY + 200);
      ctx.moveTo(tvX + 220, tvY + 110);
      ctx.lineTo(tvX + 290, tvY + 190);
      ctx.stroke();

      // Electric sparks
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 8; s++) {
        const sx = tvX + 160 + Math.sin(now * 0.05 + s) * 70;
        const sy = tvY + 90 + Math.cos(now * 0.07 + s * 2) * 50;
        ctx.fillRect(sx, sy, 3, 3);
      }
    } else {
      // Hyper installation / booting screen
      const screenGrad = ctx.createLinearGradient(tvX, tvY, tvX + tvW, tvY + tvH);
      screenGrad.addColorStop(0, '#190a36');
      screenGrad.addColorStop(1, '#0c1b44');
      ctx.fillStyle = screenGrad;
      ctx.fillRect(tvX, tvY, tvW, tvH);

      // Grid visualizer on TV
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let gy = tvY + 20; gy < tvY + tvH; gy += 30) {
        ctx.beginPath();
        ctx.moveTo(tvX, gy);
        ctx.lineTo(tvX + tvW, gy);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.shadowBlur = 0;

    // Subwoofers & Soundbars flanking the setup
    const bassPulse = running ? Math.sin(now * 0.02) * (5 + tension * 9) : 0;
    // Left Sub
    ctx.fillStyle = '#1e1c24';
    ctx.fillRect(195, 330, 65, 85);
    ctx.fillStyle = '#111015';
    ctx.beginPath();
    ctx.arc(227.5, 372.5, 24 + bassPulse * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLOURS.neonOrange;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right Sub
    ctx.fillStyle = '#1e1c24';
    ctx.fillRect(700, 330, 65, 85);
    ctx.fillStyle = '#111015';
    ctx.beginPath();
    ctx.arc(732.5, 372.5, 24 + bassPulse * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLOURS.neonOrange;
    ctx.stroke();

    // Massive Soundbar under TV
    ctx.fillStyle = '#181720';
    ctx.fillRect(320, 370, 320, 22);
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillRect(475, 378, 10, 4);

    // Overheating PS5 Pro (neon glow)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(655, 355, 14, 45);
    ctx.fillStyle = running && tension > 0.4 ? '#00e1ff' : '#444455';
    ctx.fillRect(667, 360, 4, 35);

    // Character: The sweaty Redditor protagonist
    const charX = cashedOut ? 480 : 360;
    const charY = cashedOut ? 415 : 405;

    if (cashedOut) {
      // Recliner with soda - pure chill victory
      ctx.fillStyle = '#6d1838'; // Recliner chair
      ctx.fillRect(430, 400, 100, 50);
      ctx.fillRect(420, 420, 120, 25);

      // Relaxing gamer
      ctx.fillStyle = '#f7d5b8'; // Head
      ctx.beginPath();
      ctx.arc(460, 385, 16, 0, Math.PI * 2);
      ctx.fill();

      // Messy gamer hair & headset
      ctx.fillStyle = '#4a2d18';
      ctx.beginPath();
      ctx.arc(458, 378, 16, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(460, 385, 18, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();

      // Body in recliner
      ctx.fillStyle = '#ffffff'; // Tank top
      ctx.fillRect(455, 398, 35, 24);
      ctx.fillStyle = '#3a5da8'; // Boxers
      ctx.fillRect(475, 412, 35, 18);

      // Can of soda
      ctx.fillStyle = '#ff2a55';
      ctx.fillRect(435, 405, 8, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(438, 401, 2, 4); // straw
    } else if (crashed) {
      // Shocked posture fallen backwards
      ctx.fillStyle = '#f7d5b8';
      ctx.beginPath();
      ctx.arc(320, 435, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a2d18';
      ctx.beginPath();
      ctx.arc(318, 427, 17, Math.PI, Math.PI * 2);
      ctx.fill();
      // Shock mouth
      ctx.fillStyle = '#331111';
      ctx.beginPath();
      ctx.arc(322, 440, 5, 0, Math.PI * 2);
      ctx.fill();
      // Sprawled legs
      ctx.fillStyle = '#f7d5b8';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#f7d5b8';
      ctx.beginPath();
      ctx.moveTo(330, 445);
      ctx.lineTo(370, 460);
      ctx.stroke();
    } else {
      // Installing/wrestling with cables in sweaty boxers
      const sway = Math.sin(now * 0.012) * 5;
      // Head
      ctx.fillStyle = '#f7d5b8';
      ctx.beginPath();
      ctx.arc(charX + sway, charY - 45, 16, 0, Math.PI * 2);
      ctx.fill();

      // Messy brown hair
      ctx.fillStyle = '#4a2d18';
      ctx.beginPath();
      ctx.arc(charX + sway - 2, charY - 52, 16, Math.PI, Math.PI * 2);
      ctx.fill();

      // Headset
      ctx.strokeStyle = '#1a1a24';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(charX + sway, charY - 45, 18, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();

      // Sweat drops flying when tense
      if (tension > 0.2) {
        ctx.fillStyle = '#00f0ff';
        const swX = charX + sway + 14 + Math.sin(now * 0.02) * 8;
        const swY = charY - 55 + (now * 0.04 % 25);
        ctx.beginPath();
        ctx.arc(swX, swY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Torso (white tank top with sweat stain)
      ctx.fillStyle = '#e8eaed';
      ctx.fillRect(charX + sway - 12, charY - 30, 24, 32);
      ctx.fillStyle = '#d2d6dc';
      ctx.beginPath();
      ctx.arc(charX + sway, charY - 14, 7, 0, Math.PI * 2);
      ctx.fill();

      // Boxers with pink heart patterns
      ctx.fillStyle = '#f0ebe8';
      ctx.fillRect(charX + sway - 13, charY + 2, 26, 18);
      ctx.fillStyle = '#ff3366';
      ctx.fillRect(charX + sway - 6, charY + 6, 4, 4);
      ctx.fillRect(charX + sway + 4, charY + 10, 4, 4);

      // Heavy HDMI cable in hands
      ctx.strokeStyle = '#0e0e14';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(charX + sway + 5, charY - 10);
      ctx.quadraticCurveTo(charX + 45, charY - 5, 480, 360);
      ctx.stroke();
    }

    // --- HUD Overlay ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('GTA LIVING ROOM', 480, 34);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('COLOSSAL THEATER UPGRADE · MULTIPLIER RISES', 480, 56);

    // Multiplier readout inside TV or centered overlay
    const multiplierColor = crashed ? COLOURS.crashed : cashedOut ? COLOURS.cashedOut : COLOURS.neonCyan;
    ctx.fillStyle = multiplierColor;
    ctx.font = `900 ${running ? 64 + tension * 12 : 56}px ui-monospace, monospace`;
    ctx.shadowColor = multiplierColor;
    ctx.shadowBlur = running ? 15 + tension * 15 : 0;
    ctx.fillText(formatX(view.currentX100), 480, tvY + tvH / 2 - (cashedOut ? 35 : 0));
    ctx.shadowBlur = 0;

    // Milestone ticker caption
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const bannerText = crashed
      ? 'CRASH! DRYWALL RIPPED THROUGH STUDS'
      : (activeMilestone?.[1] ?? (running ? 'Mounting components...' : 'Waiting for round to join'));

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.gold;
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 480);

    // Bottom stake status bar
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 510);

    ctx.restore();
  }

  return { draw };
}
