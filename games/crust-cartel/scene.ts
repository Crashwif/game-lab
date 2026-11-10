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
  bgDark: '#120d0b',
  kitchenWall: '#271b16',
  brickMuted: '#3f2b23',
  counter: '#4a3328',
  dough: '#fef3c7',
  doughEdge: '#f59e0b',
  marinara: '#dc2626',
  crustGold: '#eab308',
  ovenGlow: '#ff781f',
  text: '#fffbeb',
  muted: '#d6c7b2',
  accent: '#fbbf24',
  crashed: '#ef4444',
  cashedOut: '#34d399',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Firing up the studio oven...',
  betting: 'Tossing sourdough starter · Place your orders',
  running: 'Rush hour madness in 4B',
  crashed: 'Door breached! Kitchen overrun with foodies!',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First ball of dough hand-stretched smoothly'],
  [150, 'Tiny countertop toaster oven preheats fast'],
  [200, 'Online waitlist counter hits 1,000 requests'],
  [250, 'Stairwell fills with hungry foodie influencers'],
  [300, 'Mozzarella bubbles into golden blistered perfection'],
  [500, 'Neighbors call fire department over baseline garlic odor'],
  [1000, 'Micro-bakery valuation clears Michelin three-star rate'],
  [10000, 'Helicopter flies above delivering San Marzano cans'],
  [100000, 'Bidding war starts for a single charred basil leaf'],
  [1000000, 'Studio apartment zoned as sovereign pie consulate'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Boxed & escaped at ${formatX(view.cashoutX100)} · Pure artisanal profit`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Hallway swarmed · You watched safely' : 'Spectating the rush · No crust staked', COLOURS.muted];
  }
  if (crashed) {
    return [`The horde looted your ${credits(view.stake)} in the hallway breach`, COLOURS.crashed];
  }
  return [`Baking high stakes · ${credits(view.stake)} riding on this pie`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastFlourTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Sound triggers
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('whoosh', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('door', 0.9);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('notify', 0.6);
      }
      const flourCycle = Math.floor(view.elapsed / (450 - 200 * tension));
      if (flourCycle > lastFlourTick && view.cashoutX100 === null) {
        audio.fx('hiss', 0.15 + 0.3 * tension);
        lastFlourTick = flourCycle;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const crashShake = crashed ? 16 * clamp01(1 - age / 0.5) ** 2 : 0;
    const doorRumble = running ? Math.sin(view.elapsed * 0.02) * (1 + 7 * tension) : 0;

    ctx.save();
    ctx.translate(
      crashShake * Math.sin(age * 60) + (doorRumble > 3 ? doorRumble * 0.4 : 0),
      crashShake * Math.cos(age * 50)
    );

    // 1. Apartment Studio Background
    ctx.fillStyle = COLOURS.kitchenWall;
    ctx.fillRect(0, 0, 960, 540);

    // Brick texture bands
    ctx.strokeStyle = COLOURS.brickMuted;
    ctx.lineWidth = 1.5;
    for (let by = 40; by < 380; by += 32) {
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.lineTo(960, by);
      ctx.stroke();
      const offset = (by / 32) % 2 === 0 ? 0 : 25;
      for (let bx = offset; bx < 960; bx += 50) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by + 32);
        ctx.stroke();
      }
    }

    // Fire escape window on right
    ctx.fillStyle = '#08121e';
    ctx.fillRect(720, 60, 180, 260);
    // City skyline through window
    ctx.fillStyle = '#172554';
    ctx.fillRect(735, 160, 35, 160);
    ctx.fillRect(780, 120, 45, 200);
    ctx.fillRect(835, 180, 40, 140);
    // Window frame & fire escape bars
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(720, 60, 180, 260);
    ctx.beginPath();
    ctx.moveTo(810, 60);
    ctx.lineTo(810, 320);
    ctx.moveTo(720, 190);
    ctx.lineTo(900, 190);
    ctx.stroke();

    // Fire escape zipline cable out the window
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(760, 140);
    ctx.lineTo(960, 70);
    ctx.stroke();

    // Studio Hallway Door on Left (The Mob is behind this!)
    const doorX = 40;
    const doorY = 90;
    const doorShake = crashed ? 18 : doorRumble;
    ctx.save();
    ctx.translate(doorShake, 0);
    // Door frame
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(doorX - 6, doorY - 6, 122, 282);
    // Door panel
    ctx.fillStyle = crashed ? '#450a0a' : '#292524';
    ctx.fillRect(doorX, doorY, 110, 270);
    // Frosted peephole / upper window with mob shadows
    ctx.fillStyle = crashed ? '#ef4444' : '#fbbf24';
    ctx.fillRect(doorX + 25, doorY + 30, 60, 50);
    // Hungry mob shadow silhouettes
    ctx.fillStyle = '#0f172a';
    const mobShift = Math.sin(view.elapsed * 0.007) * 8;
    ctx.beginPath();
    ctx.arc(doorX + 45 + mobShift, doorY + 62, 16, 0, Math.PI * 2);
    ctx.arc(doorX + 68 - mobShift, doorY + 65, 14, 0, Math.PI * 2);
    ctx.fill();

    // Door lock / chain / stress cracks
    ctx.strokeStyle = tension > 0.4 ? '#f87171' : '#78716c';
    ctx.lineWidth = 3;
    ctx.strokeRect(doorX + 15, doorY + 120, 80, 10);
    if (tension > 0.5) {
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(doorX + 40, doorY + 130);
      ctx.lineTo(doorX + 55, doorY + 210);
      ctx.moveTo(doorX + 70, doorY + 100);
      ctx.lineTo(doorX + 60, doorY + 180);
      ctx.stroke();
    }
    ctx.restore();

    // Kitchen Counter
    ctx.fillStyle = COLOURS.counter;
    ctx.fillRect(0, 360, 960, 180);
    ctx.fillStyle = '#291c15';
    ctx.fillRect(0, 360, 960, 10);

    // Cans of San Marzano Tomatoes on counter
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(190, 305, 34, 55);
    ctx.fillRect(230, 315, 34, 45);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(190, 320, 34, 18);
    ctx.fillRect(230, 328, 34, 16);

    // Countertop toaster oven (Right side)
    const ovenX = 610;
    const ovenY = 270;
    ctx.fillStyle = crashed ? '#451a03' : '#334155';
    ctx.fillRect(ovenX, ovenY, 130, 90);
    // Oven door glass glowing
    const heatGlow = clamp01(0.3 + 0.7 * tension);
    ctx.fillStyle = crashed ? '#7f1d1d' : `rgba(255, 120, 31, ${heatGlow})`;
    ctx.fillRect(ovenX + 12, ovenY + 14, 85, 62);
    // Glowing pizza baking inside
    if (!crashed) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(ovenX + 22, ovenY + 45, 65, 18);
      // Heat coils
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ovenX + 18, ovenY + 26);
      ctx.lineTo(ovenX + 90, ovenY + 26);
      ctx.stroke();
      // Smoke wisps from oven
      ctx.fillStyle = 'rgba(254, 243, 199, 0.4)';
      const smokeY = ovenY - (view.elapsed * 0.05) % 40;
      ctx.beginPath();
      ctx.arc(ovenX + 50 + Math.sin(view.elapsed * 0.006) * 12, smokeY, 8 + 8 * tension, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Protagonist: Frazzled Chef tossing sourdough or escaping
    const chefX = 410;
    const chefY = 320;
    const tossT = (view.elapsed * 0.006) % (Math.PI * 2);
    const tossH = Math.abs(Math.sin(tossT)) * (40 + 60 * tension);

    if (view.cashoutX100 !== null) {
      // CASHOUT ESCAPE: Chef sliding out the zipline with the pizza box!
      const zipProgress = clamp01((view.elapsed % 3000) / 3000);
      const zipChefX = 640 + zipProgress * 260;
      const zipChefY = 180 - zipProgress * 80;

      // Cardboard takeout pizza box held triumphantly
      ctx.fillStyle = '#d97706';
      ctx.fillRect(zipChefX - 35, zipChefY + 10, 48, 22);
      ctx.fillStyle = '#b45309';
      ctx.strokeRect(zipChefX - 35, zipChefY + 10, 48, 22);
      // Branded golden stamp
      ctx.fillStyle = '#fef08a';
      ctx.font = '700 10px system-ui';
      ctx.fillText('CRUST', zipChefX - 22, zipChefY + 22);

      // Zipline harness & Chef silhouette
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(zipChefX, zipChefY - 15, 14, 0, Math.PI * 2); // Head
      ctx.fill();
      // Chef toque
      ctx.fillRect(zipChefX - 10, zipChefY - 38, 20, 18);
      // Apron flying back
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(zipChefX, zipChefY);
      ctx.lineTo(zipChefX - 24, zipChefY + 36);
      ctx.lineTo(zipChefX + 10, zipChefY + 36);
      ctx.closePath();
      ctx.fill();
      // Cool shades
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(zipChefX - 2, zipChefY - 18, 12, 6);
    } else if (crashed) {
      // CRASH STATE: Toaster exploded, sauce everywhere, influencers rushing in!
      ctx.fillStyle = COLOURS.marinara;
      // Marinara sauce splatters across scene
      for (let s = 0; s < 12; s++) {
        const sx = 200 + ((s * 73) % 560);
        const sy = 220 + ((s * 41) % 200);
        const sr = 12 + ((s * 7) % 28);
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Overrun door broken down
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(40, 360);
      ctx.lineTo(190, 330);
      ctx.lineTo(210, 370);
      ctx.lineTo(40, 380);
      ctx.fill();

      // Flashing smartphones in mob hands
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(160, 240, 24, 38);
      ctx.fillRect(210, 210, 22, 36);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(172, 245, 6, 0, Math.PI * 2);
      ctx.arc(221, 215, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // NORMAL / RUNNING BAKING ACTION: Frazzled Chef tossing dough
      // Chef Torso & Apron
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(chefX - 25, chefY - 20, 50, 70); // White chef shirt
      ctx.fillStyle = '#b91c1c'; // Marinara-stained apron
      ctx.fillRect(chefX - 20, chefY, 40, 50);

      // Stains on apron
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.arc(chefX - 5, chefY + 18, 8, 0, Math.PI * 2);
      ctx.arc(chefX + 8, chefY + 28, 5, 0, Math.PI * 2);
      ctx.fill();

      // Frazzled Chef Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(chefX, chefY - 35, 18, 0, Math.PI * 2);
      ctx.fill();

      // Chef Toque (tall pleated hat bobbing)
      const hatWobble = Math.sin(view.elapsed * 0.015) * (3 + 5 * tension);
      ctx.save();
      ctx.translate(chefX, chefY - 50);
      ctx.rotate(hatWobble * 0.03);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-16, -30, 32, 28);
      ctx.beginPath();
      ctx.arc(-8, -30, 12, 0, Math.PI * 2);
      ctx.arc(8, -30, 12, 0, Math.PI * 2);
      ctx.arc(0, -38, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Frazzled facial expression
      ctx.fillStyle = '#0f172a';
      // Wide stressed eyes looking up at dough
      ctx.beginPath();
      ctx.arc(chefX - 7, chefY - 39, 4 + tension * 2, 0, Math.PI * 2);
      ctx.arc(chefX + 7, chefY - 39, 4 + tension * 2, 0, Math.PI * 2);
      ctx.fill();
      // Open panting mouth
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.ellipse(chefX, chefY - 27, 4 + tension * 4, 3 + tension * 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Animated Hands tossing upward
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(chefX - 22, chefY - 35 - tossH * 0.25, 7, 0, Math.PI * 2);
      ctx.arc(chefX + 22, chefY - 35 - tossH * 0.25, 7, 0, Math.PI * 2);
      ctx.fill();

      // Flying Sourdough Pizza Crust in midair!
      const doughY = chefY - 70 - tossH;
      const spinAngle = view.elapsed * (0.005 + 0.008 * tension);
      const doughScaleX = 1 + 0.3 * Math.sin(tossT * 2);
      const doughScaleY = 0.35 + 0.1 * Math.cos(tossT * 2);

      ctx.save();
      ctx.translate(chefX, doughY);
      ctx.rotate(Math.sin(spinAngle) * 0.25);
      // Blistered golden sourdough disc
      ctx.fillStyle = COLOURS.crustGold;
      ctx.beginPath();
      ctx.ellipse(0, 0, 48 * doughScaleX, 24 * doughScaleY, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLOURS.dough;
      ctx.beginPath();
      ctx.ellipse(0, 0, 40 * doughScaleX, 18 * doughScaleY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tomato sauce & basil bits spinning on dough
      ctx.fillStyle = COLOURS.marinara;
      ctx.beginPath();
      ctx.arc(-10 * doughScaleX, -2, 5, 0, Math.PI * 2);
      ctx.arc(12 * doughScaleX, 3, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#15803d'; // Basil
      ctx.fillRect(-2, -4, 5, 4);
      ctx.fillRect(8, -5, 4, 3);

      // Flour cloud puffs drifting
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      for (let f = 0; f < 3; f++) {
        const fx = Math.sin(view.elapsed * 0.008 + f) * 26;
        const fy = 10 + f * 10;
        ctx.beginPath();
        ctx.arc(fx, fy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. HUD: Multiplier, Title & Live Status
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.accent;
    ctx.font = '800 34px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('CRUST CARTEL', 480, 52);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('ARTISANAL SOURDOUGH UNDER SIEGE · RUN THE PIES', 480, 84);

    // Big central Multiplier
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.text);
    const punch = crashed ? (1 - clamp01((age - 0.12) / 0.25)) ** 2 : 0;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${76 * (1 + 0.18 * punch + 0.06 * depth)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 155);

    // Milestone Badge / Caption
    const currentMilestone = MILESTONES[milestone - 1];
    const bannerText = running
      ? (currentMilestone ? currentMilestone[1] : PHASE_LABELS.running)
      : PHASE_LABELS[view.phase];

    ctx.fillStyle = 'rgba(15, 10, 8, 0.85)';
    ctx.beginPath();
    ctx.roundRect(140, 202, 680, 36, 18);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.doughEdge);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.dough;
    ctx.font = '600 17px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 220);

    // Stake / Escape status line at bottom
    const [statusText, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = '700 20px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(statusText, 480, 505);

    ctx.restore();
  }

  return { draw };
}
