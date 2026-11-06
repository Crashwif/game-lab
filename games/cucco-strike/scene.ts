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
  skyDay: '#6fc5ff',
  skyDoom: '#2a173b',
  grassDay: '#4db33d',
  grassDoom: '#1c4a24',
  heroTunic: '#2db84c',
  heroHat: '#1b8a36',
  heroSkin: '#ffd5b0',
  cuccoWhite: '#fdfefe',
  cuccoRed: '#ff2d55',
  cuccoBeak: '#ffaa00',
  hayCart: '#c9933b',
  woodBrown: '#6e4423',
  text: '#ffffff',
  accent: '#ffd700',
  crashed: '#ff3b30',
  cashedOut: '#34c759',
  cardBg: 'rgba(15, 23, 42, 0.72)',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First accidental boot connects with the hen'],
  [150, 'A sharp angry squawk echoes across the village'],
  [200, 'Three identical white birds perch on the fence'],
  [250, 'Bushes rustle as a dozen pairs of beady eyes glow'],
  [300, 'A storm front of feathers rolls over the hills'],
  [500, 'Hundreds of chickens blot out the midday sun'],
  [1000, 'Sonic clucks shake the camera in panic mode'],
  [10000, 'Full tactical rooster armada in V-formation'],
  [100000, 'Gigantic mythological Mega-Cucco descends'],
  [1000000, 'Universal poultry singularity envelopes reality'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => {
    const num = parseInt(hex.slice(1), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };
  const rgb1 = parse(c1);
  const rgb2 = parse(c2);
  const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
  const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
  const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function drawChicken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  facingLeft: boolean,
  flap: number,
  redEyes: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  if (facingLeft) ctx.scale(-scale, scale);
  else ctx.scale(scale, scale);

  // Body
  ctx.fillStyle = COLOURS.cuccoWhite;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(10, -8, 8, 0, Math.PI * 2);
  ctx.fill();

  // Comb (red crest)
  ctx.fillStyle = COLOURS.cuccoRed;
  ctx.beginPath();
  ctx.arc(10, -16, 4, 0, Math.PI * 2);
  ctx.arc(7, -14, 3, 0, Math.PI * 2);
  ctx.fill();

  // Wattle
  ctx.beginPath();
  ctx.arc(12, -2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = COLOURS.cuccoBeak;
  ctx.beginPath();
  ctx.moveTo(16, -9);
  ctx.lineTo(23, -6);
  ctx.lineTo(16, -4);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = redEyes ? '#ff0033' : '#111111';
  ctx.beginPath();
  ctx.arc(12, -9, redEyes ? 2.8 : 2, 0, Math.PI * 2);
  ctx.fill();
  if (redEyes) {
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(11, -10, 1.5, 1.5);
  }

  // Wing flapping
  ctx.fillStyle = '#e8edf5';
  ctx.beginPath();
  const wingY = Math.sin(flap) * 6;
  ctx.ellipse(-2, -2 + wingY, 9, 6, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();

  // Feet
  ctx.strokeStyle = COLOURS.cuccoBeak;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 11);
  ctx.lineTo(-4, 16);
  ctx.lineTo(-1, 16);
  ctx.moveTo(4, 11);
  ctx.lineTo(4, 16);
  ctx.lineTo(7, 16);
  ctx.stroke();

  ctx.restore();
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tension: number,
  running: boolean,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);

  const bob = running ? Math.sin(time * 0.012) * (3 + 5 * tension) : 0;
  const panic = running ? Math.sin(time * 0.035) * (tension * 4) : 0;

  // Legs & Boots
  ctx.fillStyle = '#613813';
  ctx.fillRect(-8 + panic, 30 + bob, 6, 12);
  ctx.fillRect(4 - panic, 30 + bob, 6, 12);

  // Tunic body
  ctx.fillStyle = COLOURS.heroTunic;
  ctx.beginPath();
  ctx.moveTo(-16, 8 + bob);
  ctx.lineTo(16, 8 + bob);
  ctx.lineTo(20, 32 + bob);
  ctx.lineTo(-20, 32 + bob);
  ctx.closePath();
  ctx.fill();

  // Belt
  ctx.fillStyle = '#3a2007';
  ctx.fillRect(-17, 21 + bob, 34, 4);
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(-4, 20 + bob, 8, 6);

  // Head
  ctx.fillStyle = COLOURS.heroSkin;
  ctx.beginPath();
  ctx.arc(0, -6 + bob, 14, 0, Math.PI * 2);
  ctx.fill();

  // Screaming face based on tension
  if (tension > 0.3) {
    // Screaming open mouth
    ctx.fillStyle = '#610a0a';
    ctx.beginPath();
    ctx.ellipse(0, -2 + bob, 6, 4 + tension * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wide panicked eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-5, -8 + bob, 4, 0, Math.PI * 2);
    ctx.arc(5, -8 + bob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-5 + panic * 0.3, -8 + bob, 1.8, 0, Math.PI * 2);
    ctx.arc(5 + panic * 0.3, -8 + bob, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Sweat drop
    ctx.fillStyle = '#60c5ff';
    ctx.beginPath();
    ctx.arc(13, -12 + bob, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Normal cocky / poked face
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-5, -7 + bob, 2, 0, Math.PI * 2);
    ctx.arc(5, -7 + bob, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -2 + bob, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // Green Elf Hat
  ctx.fillStyle = COLOURS.heroHat;
  ctx.beginPath();
  ctx.moveTo(-14, -12 + bob);
  ctx.lineTo(14, -12 + bob);
  ctx.lineTo(tension > 0.5 ? 28 : 22, -28 + bob - panic);
  ctx.lineTo(-4, -18 + bob);
  ctx.closePath();
  ctx.fill();

  // Wooden poking sword/stick
  ctx.save();
  ctx.translate(12, 16 + bob);
  const pokeAngle = running ? Math.sin(time * 0.015) * 0.25 - 0.2 : -0.2;
  ctx.rotate(pokeAngle);
  ctx.fillStyle = '#a06e3b';
  ctx.fillRect(0, -3, 36, 6);
  ctx.fillStyle = '#593d20';
  ctx.fillRect(-4, -6, 6, 12);
  ctx.restore();

  ctx.restore();
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'crowd' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestoneIdx = 0;
  let lastFlapTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);

    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Audio triggers
    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('spray', 0.9);
      audio.fx('kaching', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('crowd', prevPhase === null || view.crashAge > 1200);
      audio.fx('scream', 0.9);
      audio.fx('boom', 0.7);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestoneIdx) {
        audio.milestone(milestoneIdx);
        audio.fx('squeak', 0.7 + 0.3 * tension);
      }
      // Squawk flapping cadence
      const flapInterval = Math.max(160, 450 - tension * 320);
      if (now - lastFlapTick > flapInterval && view.cashoutX100 === null) {
        audio.fx('whoosh', 0.25 + 0.5 * tension);
        lastFlapTick = now;
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestoneIdx = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashAgeSec / 0.8) : tension > 0.6 ? (tension - 0.6) * 7 : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // Sky Background gradient shifts from sunny village to apocalyptic storm
    const skyCurrent = lerpColor(COLOURS.skyDay, COLOURS.skyDoom, tension);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, skyCurrent);
    skyGrad.addColorStop(1, lerpColor('#cceaff', '#4a1525', tension));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Distant Hills
    const hillColor = lerpColor(COLOURS.grassDay, COLOURS.grassDoom, tension);
    ctx.fillStyle = hillColor;
    ctx.beginPath();
    ctx.moveTo(0, 360);
    ctx.bezierCurveTo(240, 290, 480, 410, 960, 330);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.closePath();
    ctx.fill();

    // Wooden village fence
    ctx.fillStyle = COLOURS.woodBrown;
    for (let fx = 40; fx < 960; fx += 70) {
      ctx.fillRect(fx, 340, 10, 40);
    }
    ctx.fillRect(30, 350, 900, 6);
    ctx.fillRect(30, 365, 900, 6);

    // Hay Cart on the right (where cashout hides)
    const cartX = 810;
    const cartY = 370;
    ctx.fillStyle = COLOURS.hayCart;
    ctx.beginPath();
    ctx.ellipse(cartX, cartY - 10, 65, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.woodBrown;
    ctx.fillRect(cartX - 55, cartY - 6, 110, 14);
    ctx.beginPath();
    ctx.arc(cartX - 35, cartY + 18, 16, 0, Math.PI * 2);
    ctx.arc(cartX + 35, cartY + 18, 16, 0, Math.PI * 2);
    ctx.stroke();

    // Sky rooster swarm (grows with tension and depth)
    const chickenCount = Math.floor(tension * 40 + depth * 50);
    for (let i = 0; i < chickenCount; i++) {
      const birdSeed = (i * 137.5) % 960;
      const speed = 1.5 + (i % 5) * 0.8 + tension * 4;
      const bx = (birdSeed + now * 0.15 * speed) % 1060 - 50;
      const by = 40 + (i * 37) % 220 + Math.sin(now * 0.005 + i) * 15;
      const bScale = 0.4 + ((i % 4) * 0.15);
      const isDiving = tension > 0.4 && i % 3 === 0;
      ctx.save();
      if (isDiving) {
        ctx.translate(bx, by);
        ctx.rotate(0.35);
        drawChicken(ctx, 0, 0, bScale, true, now * 0.03 + i, true);
      } else {
        drawChicken(ctx, bx, by, bScale, true, now * 0.02 + i, tension > 0.5);
      }
      ctx.restore();
    }

    // Swirling feathers in air
    const featherCount = Math.floor(tension * 30);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let f = 0; f < featherCount; f++) {
      const fx = (f * 193 + now * 0.2) % 960;
      const fy = (f * 97 + Math.sin(now * 0.003 + f) * 60 + now * 0.1) % 460;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(Math.sin(now * 0.005 + f));
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Protagonist & Primary Target Hen
    const heroX = 400;
    const heroY = 360;
    const henX = 485;
    const henY = 380;

    if (view.cashoutX100 !== null) {
      // Streamer safely leaped into the hay cart!
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      // Smoke bomb clouds
      ctx.beginPath();
      ctx.arc(heroX, heroY, 40, 0, Math.PI * 2);
      ctx.arc(heroX + 25, heroY - 20, 30, 0, Math.PI * 2);
      ctx.arc(heroX - 25, heroY - 15, 32, 0, Math.PI * 2);
      ctx.fill();

      // Green booted feet sticking out of the haycart
      ctx.save();
      ctx.translate(cartX - 10, cartY - 30);
      ctx.rotate(-0.4);
      ctx.fillStyle = COLOURS.heroTunic;
      ctx.fillRect(0, 0, 8, 22);
      ctx.fillRect(12, 0, 8, 22);
      ctx.fillStyle = '#613813';
      ctx.fillRect(-2, 18, 12, 8);
      ctx.fillRect(10, 18, 12, 8);
      ctx.restore();

      // Confused ground hen
      drawChicken(ctx, henX, henY, 1.2, true, 0, false);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('???', henX - 5, henY - 28);
    } else if (crashed) {
      // Inescapable Cartoon Pecking Tornado Vortex!
      const vortexAge = clamp01(crashAgeSec / 2);
      const vortexSize = 80 + vortexAge * 70;
      ctx.save();
      ctx.translate(heroX + 40, heroY - 10);

      // Dust smoke swirls
      for (let d = 0; d < 6; d++) {
        const ang = now * 0.02 + (d * Math.PI) / 3;
        const rad = vortexSize * (0.5 + 0.5 * Math.sin(now * 0.01 + d));
        ctx.fillStyle = d % 2 === 0 ? 'rgba(230, 220, 200, 0.75)' : 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * rad, Math.sin(ang) * rad, 35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flying chicken parts, feathers, green cap in tornado
      ctx.fillStyle = COLOURS.heroHat;
      ctx.fillRect(Math.sin(now * 0.03) * 40, -40 + Math.cos(now * 0.02) * 20, 16, 12);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(Math.cos(now * 0.04) * 45, 20 + Math.sin(now * 0.03) * 20, 20, 5);

      // Swarming beaks & red eyes
      for (let k = 0; k < 5; k++) {
        const cx = Math.sin(now * 0.025 + k * 1.5) * (vortexSize * 0.6);
        const cy = Math.cos(now * 0.02 + k * 1.5) * (vortexSize * 0.5);
        drawChicken(ctx, cx, cy, 0.9, k % 2 === 0, now * 0.05, true);
      }
      ctx.restore();
    } else {
      // Active Running / Betting state
      drawHero(ctx, heroX, heroY, tension, running, now);
      // Main chicken being poked
      const chickenPeckHop = running ? Math.abs(Math.sin(now * 0.015)) * (4 + tension * 8) : 0;
      drawChicken(ctx, henX, henY - chickenPeckHop, 1.3, true, now * 0.02, tension > 0.2);
    }

    // Top HUD Bar & Multiplier Display
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title Card
    ctx.fillStyle = COLOURS.cardBg;
    ctx.fillRect(260, 20, 440, 54);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(260, 20, 440, 54);

    ctx.fillStyle = COLOURS.accent;
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('CUCCO STRIKE : AVIAN APOCALYPSE', 480, 38);
    ctx.font = '600 13px monospace';
    ctx.fillStyle = '#d0d8e8';
    ctx.fillText('DO NOT ANGER THE FLOCK · SURVIVE THE MULTIPLIER', 480, 58);

    // Huge Multiplier Display
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.text;
    ctx.fillStyle = multColor;
    const pulse = running ? 1 + tension * 0.08 * Math.sin(now * 0.01) : 1;
    ctx.font = `900 ${Math.round(84 * pulse)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 160);

    // Comical flock threat status meter
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(330, 215, 300, 14);
    const meterFill = ctx.createLinearGradient(330, 0, 630, 0);
    meterFill.addColorStop(0, '#34c759');
    meterFill.addColorStop(0.5, '#ffd60a');
    meterFill.addColorStop(1, '#ff3b30');
    ctx.fillStyle = meterFill;
    ctx.fillRect(332, 217, clamp01(tension) * 296, 10);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(330, 215, 300, 14);

    // Current Milestone / Village Panic Alert
    const passedMilestone = running || crashed ? MILESTONES[milestoneIdx - 1] : undefined;
    const alertText = passedMilestone ? passedMilestone[1] : 'Poke the harmless hen to start...';
    ctx.fillStyle = COLOURS.cardBg;
    ctx.fillRect(160, 245, 640, 36);
    ctx.strokeStyle = tension > 0.6 ? COLOURS.cuccoRed : '#3a4d6b';
    ctx.strokeRect(160, 245, 640, 36);

    ctx.fillStyle = tension > 0.5 ? '#ffecb3' : COLOURS.text;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(alertText, 480, 263, 620);

    // Stake line & Result Banner at bottom
    ctx.fillStyle = COLOURS.cardBg;
    ctx.fillRect(200, 475, 560, 46);
    ctx.strokeStyle = '#556987';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(200, 475, 560, 46);

    let bottomText = '';
    let bottomColor = COLOURS.text;
    if (view.cashoutX100 !== null) {
      bottomText = `Dived into haycart at ${formatX(view.cashoutX100)}! Safe with ${view.payout !== null ? credits(view.payout) : 'profit'}`;
      bottomColor = COLOURS.cashedOut;
    } else if (crashed) {
      bottomText = view.stake !== null ? `Pecked to pixel dust! Lost ${credits(view.stake)}` : 'Hero pulverized by the chicken singularity!';
      bottomColor = COLOURS.crashed;
    } else if (view.stake !== null) {
      bottomText = `Riding the squawk with ${credits(view.stake)} · Cash out before the sky turns red!`;
      bottomColor = COLOURS.accent;
    } else {
      bottomText = 'Spectating · Watch the streamer awaken the mega-rooster';
      bottomColor = '#a0aec0';
    }

    ctx.fillStyle = bottomColor;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(bottomText, 480, 498, 540);

    ctx.restore();
  }

  return { draw };
}
