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
  wall: '#1b1c2b',
  wallStripe: '#232438',
  floor: '#12131d',
  couch: '#3a4b6e',
  couchShadow: '#28344e',
  cushion: '#ff7a59',
  owlGreen: '#58cc02',
  owlBelly: '#89e219',
  owlBeak: '#ff9600',
  iceBlue: '#5fe3ff',
  iceGlow: 'rgba(95, 227, 255, 0.4)',
  woodDoor: '#5a351d',
  text: '#ffffff',
  muted: '#a3adc2',
  accent: '#58cc02',
  crashed: '#ff4b4b',
  cashedOut: '#ffd900',
  windowDark: '#080d18',
};

const PHASE_LABELS = {
  waiting: 'NEXT LESSON IMMINENT',
  betting: 'DO YOUR VOCAB DRILL',
  running: 'STREAK AT RISK',
  crashed: 'STREAK TERMINATED',
};

const MILESTONES: [number, string][] = [
  [120, 'Phone buzzes with subtle practice reminder'],
  [150, 'App icon begins weeping passive-aggressive tears'],
  [200, 'Green silhouette spotted behind yard bushes'],
  [250, 'Doorbells ring in fluent conversational Spanish'],
  [300, 'Heavy feather scratches scrape against the window'],
  [500, 'Mascot taps glass holding a vocab flashcard'],
  [1000, 'Shadow stretches across the whole living room'],
  [10000, 'Owl hovers mid-air with glowing red eyes'],
  [100000, 'Entire neighborhood converted to verb conjugations'],
  [1000000, 'Ascended multilingual owl rules mortal realm'],
];

const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number): string => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number): string =>
  `${weight} ${Math.round(size * (1 + 0.28 * pop * pop))}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`STREAK FREEZE EQUIPPED at ${formatX(view.cashoutX100)} · Duolingo defeated!`, COLOURS.iceBlue];
  }
  if (view.stake === null) {
    return [crashed ? 'You skipped practice · streak lost' : 'Spectating the frantic midnight study session', COLOURS.muted];
  }
  if (crashed) return [`Lost ${credits(view.stake)} · The owl caught you slacking!`, COLOURS.crashed];
  return [`${credits(view.stake)} riding on your daily lesson!`, COLOURS.cashedOut];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastDoorBell = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('clang', 0.9);
      audio.fx('zap', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('door', 1.0);
      audio.fx('shatter', 0.8);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        if (milestoneIndex >= 4 && now - lastDoorBell > 3000) {
          audio.fx('bell', 0.7);
          lastDoorBell = now;
        } else {
          audio.fx('phone', 0.6);
        }
      }
      if (Math.sin(view.elapsed / 180) > 0.96) {
        audio.fx('tick', 0.2 + 0.4 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeS = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 18 * clamp01(1 - crashAgeS / 0.6) ** 2 : (running ? tension * 3.5 * Math.sin(now * 0.05) : 0);
    const pop = (x100: number): number => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.save();
    // Screen shake
    ctx.translate(shake * Math.sin(now * 0.09), shake * Math.cos(now * 0.07));

    // 1. Room Background
    ctx.fillStyle = COLOURS.wall;
    ctx.fillRect(0, 0, 960, 540);

    // Wall wallpaper stripes
    ctx.fillStyle = COLOURS.wallStripe;
    for (let x = 0; x < 960; x += 48) {
      ctx.fillRect(x, 0, 16, 400);
    }

    // Floor
    ctx.fillStyle = COLOURS.floor;
    ctx.fillRect(0, 400, 960, 140);
    ctx.fillStyle = '#1c1e2e';
    ctx.fillRect(0, 400, 960, 8); // baseboard

    // 2. Window (Owl stalking spot)
    const winX = 640;
    const winY = 80;
    const winW = 240;
    const winH = 220;
    ctx.fillStyle = COLOURS.windowDark;
    ctx.fillRect(winX, winY, winW, winH);

    // Moonlight / distant porch lamp
    const moonGrad = ctx.createRadialGradient(winX + 180, winY + 40, 5, winX + 180, winY + 40, 140);
    moonGrad.addColorStop(0, 'rgba(255, 245, 180, 0.35)');
    moonGrad.addColorStop(1, 'rgba(8, 13, 24, 0)');
    ctx.fillStyle = moonGrad;
    ctx.fillRect(winX, winY, winW, winH);

    // Owl Stalker at window
    const owlApproach = clamp01(view.currentX100 / 800);
    const owlScale = 0.4 + 0.65 * owlApproach;
    const owlX = winX + winW / 2 + Math.sin(now * 0.003) * 15;
    const owlY = winY + winH / 2 + (1 - owlApproach) * 60 + Math.cos(now * 0.004) * 8;

    ctx.save();
    ctx.beginPath();
    ctx.rect(winX, winY, winW, winH);
    ctx.clip();

    // Red aura at high tension
    if (tension > 0.4) {
      const redAura = ctx.createRadialGradient(owlX, owlY, 10, owlX, owlY, 110 * owlScale);
      redAura.addColorStop(0, `rgba(255, 0, 0, ${0.45 * tension})`);
      redAura.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = redAura;
      ctx.fillRect(winX, winY, winW, winH);
    }

    // Owl body in window
    ctx.save();
    ctx.translate(owlX, owlY);
    ctx.scale(owlScale, owlScale);
    ctx.fillStyle = COLOURS.owlGreen;
    ctx.beginPath();
    ctx.ellipse(0, 0, 50, 62, 0, 0, Math.PI * 2);
    ctx.fill();

    // Owl belly
    ctx.fillStyle = COLOURS.owlBelly;
    ctx.beginPath();
    ctx.ellipse(0, 16, 34, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Owl Eyes
    const eyeSize = 18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-20, -14, eyeSize, 0, Math.PI * 2);
    ctx.arc(20, -14, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Pupils: turn crazy red as multiplier surges
    ctx.fillStyle = tension > 0.65 ? '#ff0033' : '#111111';
    const pupilJitter = tension > 0.5 ? Math.sin(now * 0.04) * 3 : 0;
    ctx.beginPath();
    ctx.arc(-20 + pupilJitter, -14, 7 + tension * 4, 0, Math.PI * 2);
    ctx.arc(20 - pupilJitter, -14, 7 + tension * 4, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = COLOURS.owlBeak;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();

    // Vocab Flashcard in beak or hand at window
    if (view.currentX100 >= 300) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(15, 10, 36, 24);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('FRANÇAIS?', 33, 24);
    }
    ctx.restore();

    // Window panes
    ctx.strokeStyle = '#32374b';
    ctx.lineWidth = 8;
    ctx.strokeRect(winX, winY, winW, winH);
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, winY);
    ctx.lineTo(winX + winW / 2, winY + winH);
    ctx.moveTo(winX, winY + winH / 2);
    ctx.lineTo(winX + winW, winY + winH / 2);
    ctx.stroke();

    // Window scratches when milestone 5 hit
    if (view.currentX100 >= 300) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(winX + 40, winY + 60);
      ctx.lineTo(winX + 75, winY + 110);
      ctx.moveTo(winX + 48, winY + 58);
      ctx.lineTo(winX + 85, winY + 105);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Front Door (Left Side)
    const doorX = 40;
    const doorY = 70;
    const doorW = 140;
    const doorH = 330;

    ctx.save();
    if (crashed) {
      // Smashed open door!
      const doorOpen = Math.min(1.2, crashAgeS * 4);
      ctx.translate(doorX, doorY);
      ctx.rotate(-doorOpen * 0.6);
      ctx.fillStyle = COLOURS.woodDoor;
      ctx.fillRect(0, 0, doorW, doorH);

      // Splinter marks
      ctx.fillStyle = '#3a1f0d';
      ctx.fillRect(20, 80, 40, 160);
      ctx.restore();

      // Giant breach owl bursting through with golden dictionary!
      const burstProgress = Math.min(1, crashAgeS * 2.5);
      const bx = doorX + 70 + burstProgress * 60;
      const by = doorY + 170;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(1.3, 1.3);

      // Owl body
      ctx.fillStyle = COLOURS.owlGreen;
      ctx.beginPath();
      ctx.ellipse(0, 0, 55, 68, 0, 0, Math.PI * 2);
      ctx.fill();

      // Red angry eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-22, -18, 20, 0, Math.PI * 2);
      ctx.arc(22, -18, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff0033';
      ctx.beginPath();
      ctx.arc(-22, -18, 10, 0, Math.PI * 2);
      ctx.arc(22, -18, 10, 0, Math.PI * 2);
      ctx.fill();

      // Gold Dictionary weapon
      ctx.fillStyle = '#ffb703';
      ctx.fillRect(25, -20, 50, 70);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('DICTIONARY', 50, 15);

      ctx.restore();

      // Flying flashcards particles
      for (let i = 0; i < 8; i++) {
        const fcX = bx + Math.cos(i * 0.8 + crashAgeS * 4) * (60 + crashAgeS * 140);
        const fcY = by + Math.sin(i * 1.1 + crashAgeS * 3) * (50 + crashAgeS * 100);
        ctx.save();
        ctx.translate(fcX, fcY);
        ctx.rotate(i + crashAgeS * 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-18, -12, 36, 24);
        ctx.fillStyle = '#ff4b4b';
        ctx.fillRect(-14, -8, 28, 4);
        ctx.fillRect(-14, -1, 18, 3);
        ctx.restore();
      }
    } else {
      // Closed Door with deadbolt
      ctx.fillStyle = COLOURS.woodDoor;
      ctx.fillRect(doorX, doorY, doorW, doorH);
      ctx.strokeStyle = '#3e2311';
      ctx.lineWidth = 6;
      ctx.strokeRect(doorX + 15, doorY + 20, doorW - 30, doorH / 2 - 30);
      ctx.strokeRect(doorX + 15, doorY + doorH / 2 + 10, doorW - 30, doorH / 2 - 30);

      // Deadbolt lock
      const locked = view.cashoutX100 !== null;
      ctx.fillStyle = locked ? COLOURS.iceBlue : '#e2a93b';
      ctx.beginPath();
      ctx.arc(doorX + doorW - 25, doorY + doorH / 2 - 10, 14, 0, Math.PI * 2);
      ctx.fill();

      // Peephole
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(doorX + doorW / 2, doorY + 80, 8, 0, Math.PI * 2);
      ctx.fill();

      // Streak Freeze Ice Shield if Cashed Out
      if (locked) {
        ctx.fillStyle = COLOURS.iceGlow;
        ctx.fillRect(doorX - 10, doorY - 10, doorW + 20, doorH + 20);
        ctx.strokeStyle = COLOURS.iceBlue;
        ctx.lineWidth = 4;
        ctx.strokeRect(doorX - 10, doorY - 10, doorW + 20, doorH + 20);

        // Giant Frost Snowflake icon over door
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('❄️', doorX + doorW / 2, doorY + doorH / 2);
      }
      ctx.restore();
    }

    // 4. Centerpiece: Gamer trembling on couch
    const couchX = 340;
    const couchY = 320;
    const tremble = running ? Math.sin(now * 0.08) * (2 + 6 * tension) : 0;

    // Couch Back & Base
    ctx.fillStyle = COLOURS.couchShadow;
    ctx.fillRect(couchX - 20, couchY - 20, 260, 110);
    ctx.fillStyle = COLOURS.couch;
    ctx.fillRect(couchX - 10, couchY, 240, 90);

    // Gamer Body
    ctx.save();
    ctx.translate(couchX + 100 + tremble, couchY - 10);

    // Head
    ctx.fillStyle = '#ffd1b3';
    ctx.beginPath();
    ctx.arc(0, -32, 26, 0, Math.PI * 2);
    ctx.fill();

    // Messy hair
    ctx.fillStyle = '#4a2c16';
    ctx.beginPath();
    ctx.arc(0, -42, 26, Math.PI, Math.PI * 2);
    ctx.fill();

    // Trembling eyes / mouth
    ctx.fillStyle = '#111';
    if (crashed) {
      // Shocked eyes
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('x x', -14, -30);
      ctx.beginPath();
      ctx.arc(0, -20, 8, 0, Math.PI);
      ctx.stroke();
    } else {
      // Stressed wide eyes
      ctx.beginPath();
      ctx.arc(-8, -32, 5, 0, Math.PI * 2);
      ctx.arc(8, -32, 5, 0, Math.PI * 2);
      ctx.fill();
      // Sweating
      ctx.fillStyle = '#7cd8ff';
      ctx.beginPath();
      ctx.arc(18, -38 + Math.sin(now * 0.01) * 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body Hoodie
    ctx.fillStyle = crashed ? '#7d3232' : '#2b5876';
    ctx.beginPath();
    ctx.roundRect(-24, -6, 48, 50, 12);
    ctx.fill();

    // Glowing Smartphone in hands
    const phoneY = 14 + Math.sin(now * 0.02) * 2;
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(-14, phoneY, 28, 42);

    // Screen glow (green lesson vs blue freeze)
    ctx.fillStyle = view.cashoutX100 !== null ? COLOURS.iceBlue : (crashed ? '#ff4b4b' : COLOURS.owlGreen);
    ctx.fillRect(-12, phoneY + 2, 24, 38);

    // Light cast on face
    const glow = ctx.createRadialGradient(0, phoneY + 16, 2, 0, phoneY + 16, 60);
    glow.addColorStop(0, view.cashoutX100 !== null ? 'rgba(95, 227, 255, 0.4)' : 'rgba(88, 204, 2, 0.35)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -10, 45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 5. HUD & Multipliers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Streak Badge
    ctx.fillStyle = COLOURS.accent;
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('STREAK STALKER', 480, 36);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('🔥 429-DAY STREAK DEADLINE · 11:59 PM', 480, 62);

    // Huge Central Multiplier
    const numColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.text);
    const punch = crashed ? (1 - clamp01((crashAgeS - 0.12) / 0.25)) ** 2 : 0;
    ctx.fillStyle = numColor;
    ctx.font = `900 ${76 * (1 + 0.2 * punch + 0.1 * depth)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 130);

    // Milestone / Phase notification banner
    const passedMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const milestoneText = passedMilestone ? passedMilestone[1] : PHASE_LABELS[view.phase];
    const bannerPop = pop(passedMilestone?.[0] ?? 100);

    ctx.save();
    ctx.fillStyle = 'rgba(18, 19, 29, 0.85)';
    ctx.strokeStyle = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.iceBlue : '#3a4b6e');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(140, 185, 680, 42, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.font = popFont(600, 16, bannerPop);
    ctx.fillText(milestoneText, 480, 206);
    ctx.restore();

    // Stake / Cashout status line
    const [line, lineColour] = stakeLine(view);
    ctx.fillStyle = lineColour;
    ctx.font = popFont(700, 20, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(line, 480, 505);

    ctx.restore();
  }

  return { draw };
}
