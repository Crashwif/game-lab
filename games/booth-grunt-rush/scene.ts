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
  [120, 'Subtle mic throat clear detected on air'],
  [150, "Awkward involuntary 'OOOH' on a first down"],
  [200, 'Vocal cords strain during an incomplete pass'],
  [250, 'Full-throated squeal over a two-yard run'],
  [300, 'Audio engineer nervously tweaks limiter dial'],
  [500, 'Audio VU meters glowing dangerously bright red'],
  [1000, 'Guttural pirate noises echo across national TV'],
  [10000, 'Producer weeps as digital limiters shatter'],
  [100000, 'Subwoofer vibration rattles broadcast camera rig'],
  [1000000, 'Cosmic supersonic gasp transcends human hearing'],
];

const COLOURS = {
  bgBooth: '#070b16',
  windowGlow: '#0e1e3e',
  turfGreen: '#1b4d2e',
  suitNavy: '#1b2a47',
  skinTan: '#d67c3b',
  skinFlush: '#eb5140',
  tieGold: '#f5b027',
  micSilver: '#b4c0cf',
  vuGreen: '#22c55e',
  vuYellow: '#eab308',
  vuRed: '#ef4444',
  textLight: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  cashedOut: '#4ade80',
  crashed: '#f87171',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.3 * pop * pop)}px ui-sans-serif, system-ui, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`CASHED OUT AT ${formatX(view.cashoutX100)} · COUGH MUTE HIT`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Broadcast detonated · observing safely' : 'Mic open · zero credits riding', COLOURS.textMuted];
  }
  if (crashed) return [`Boom mic blew your ${credits(view.stake)}`, COLOURS.crashed];
  return [`Live on air · ${credits(view.stake)} at risk`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let gruntTimer = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Audio triggers
    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('click', 0.9);
      audio.fx('bell', 0.7);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('scream', 1.0);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('gasp', 0.5 + 0.5 * tension);
      }
      // Rhythmic grunts & mic pops as tension rises
      gruntTimer += 16.6;
      const interval = Math.max(180, 750 - tension * 500);
      if (gruntTimer > interval) {
        gruntTimer = 0;
        if (!cashed) {
          audio.fx(tension > 0.6 ? 'whoosh' : 'pop', 0.3 + 0.6 * tension);
        }
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 18 * clamp01(1 - crashAgeSec / 0.8) ** 2
      : running && !cashed
      ? (2 + tension * 10) * Math.sin(now * 0.03)
      : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.06));

    // 1. Studio Booth & Stadium Backdrop
    ctx.fillStyle = COLOURS.bgBooth;
    ctx.fillRect(0, 0, 960, 540);

    // Stadium window cutout
    ctx.fillStyle = COLOURS.windowGlow;
    ctx.beginPath();
    ctx.roundRect(140, 40, 680, 260, 16);
    ctx.fill();

    // Field floodlights & turf glow
    const turfGrad = ctx.createLinearGradient(140, 200, 140, 300);
    turfGrad.addColorStop(0, '#0c2e1b');
    turfGrad.addColorStop(1, COLOURS.turfGreen);
    ctx.fillStyle = turfGrad;
    ctx.fillRect(140, 190, 680, 110);

    // Stadium yard lines & stadium crowd lights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    for (let lx = 200; lx < 800; lx += 60) {
      ctx.beginPath();
      ctx.moveTo(lx, 210);
      ctx.lineTo(lx - 20, 300);
      ctx.stroke();
    }
    // Crowd light speckles
    ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
    for (let i = 0; i < 24; i++) {
      const px = 160 + (i * 27) % 640;
      const py = 60 + ((i * 37) % 110);
      ctx.fillRect(px, py, 3, 3);
    }

    // 2. Soundboard Mixing Desk (Foreground Console)
    const deskGrad = ctx.createLinearGradient(0, 340, 0, 540);
    deskGrad.addColorStop(0, '#131d2e');
    deskGrad.addColorStop(1, '#070b13');
    ctx.fillStyle = deskGrad;
    ctx.beginPath();
    ctx.moveTo(0, 340);
    ctx.lineTo(960, 340);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.fill();

    // Studio mixing desk illuminated meter panels (left & right)
    const meterSegments = 16;
    const meterPeak = running ? Math.min(16, Math.floor(tension * 16 + Math.random() * 3)) : crashed ? 16 : 3;
    [-1, 1].forEach((side) => {
      const baseX = side === -1 ? 70 : 850;
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(baseX - 25, 360, 50, 150);
      for (let s = 0; s < meterSegments; s++) {
        const segActive = s < meterPeak;
        const color = s > 12 ? COLOURS.vuRed : s > 8 ? COLOURS.vuYellow : COLOURS.vuGreen;
        ctx.fillStyle = segActive ? color : '#1e293b';
        ctx.fillRect(baseX - 18, 500 - s * 8, 36, 6);
      }
    });

    // Cough Button Panel (Center Desk)
    const coughActive = cashed;
    ctx.fillStyle = coughActive ? '#15803d' : '#991b1b';
    ctx.beginPath();
    ctx.roundRect(420, 485, 120, 44, 8);
    ctx.fill();
    ctx.strokeStyle = coughActive ? '#4ade80' : '#f87171';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(coughActive ? 'MUTE ENGAGED' : 'COUGH MUTE', 480, 512);

    // 3. Protagonist: Tom the Super-Tanned Analyst
    const bob = running && !cashed ? Math.sin(now * 0.015) * (4 + tension * 8) : 0;
    const tomX = 480;
    const tomY = 270 + bob;

    // Suit shoulders & chest
    ctx.fillStyle = COLOURS.suitNavy;
    ctx.beginPath();
    ctx.moveTo(tomX - 110, tomY + 110);
    ctx.lineTo(tomX - 60, tomY + 20);
    ctx.lineTo(tomX + 60, tomY + 20);
    ctx.lineTo(tomX + 110, tomY + 110);
    ctx.closePath();
    ctx.fill();

    // White shirt & gold broadcaster tie
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(tomX - 22, tomY + 20);
    ctx.lineTo(tomX, tomY + 55);
    ctx.lineTo(tomX + 22, tomY + 20);
    ctx.fill();
    ctx.fillStyle = COLOURS.tieGold;
    ctx.beginPath();
    ctx.moveTo(tomX - 10, tomY + 40);
    ctx.lineTo(tomX + 10, tomY + 40);
    ctx.lineTo(tomX + 14, tomY + 105);
    ctx.lineTo(tomX, tomY + 120);
    ctx.lineTo(tomX - 14, tomY + 105);
    ctx.fill();

    // Tom's Face / Tan glow
    const flushRatio = crashed ? 1 : cashed ? 0 : tension;
    ctx.fillStyle = flushRatio > 0.4 ? COLOURS.skinFlush : COLOURS.skinTan;
    ctx.beginPath();
    ctx.ellipse(tomX, tomY - 30, 46, 56, 0, 0, Math.PI * 2);
    ctx.fill();

    // Perfect coiffed swooping analyst hair
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(tomX, tomY - 55, 48, Math.PI * 0.9, Math.PI * 2.1);
    ctx.bezierCurveTo(tomX + 35, tomY - 90, tomX - 35, tomY - 95, tomX - 48, tomY - 50);
    ctx.fill();

    // Broadcaster headset band
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(tomX, tomY - 40, 52, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // Headset ear cups
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tomX - 54, tomY - 45, 12, 28);
    ctx.fillRect(tomX + 42, tomY - 45, 12, 28);

    // Eyes: confident grin vs straining bulging eyes vs crash madness
    ctx.fillStyle = '#ffffff';
    const eyeOpen = crashed ? 14 : cashed ? 6 : 6 + tension * 8;
    ctx.beginPath();
    ctx.ellipse(tomX - 18, tomY - 34, 9, eyeOpen, 0, 0, Math.PI * 2);
    ctx.ellipse(tomX + 18, tomY - 34, 9, eyeOpen, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(tomX - 18, tomY - 34, 4, 0, Math.PI * 2);
    ctx.arc(tomX + 18, tomY - 34, 4, 0, Math.PI * 2);
    ctx.fill();

    // Mouth: Calm smile -> Guttural OOH -> Screech
    if (cashed) {
      // Sipping water with calm smile
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tomX, tomY - 14, 14, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // Neon electrolyte water bottle in hand
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(tomX + 50, tomY - 10, 24, 60);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tomX + 56, tomY - 20, 12, 10);
    } else if (crashed) {
      // Wide banshee scream
      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.ellipse(tomX, tomY - 8, 26, 32, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Involuntary Grunt Mouth: scales with tension
      const mouthRadius = 6 + tension * 22;
      ctx.fillStyle = '#581c1c';
      ctx.beginPath();
      ctx.ellipse(tomX, tomY - 10, mouthRadius * 0.8, mouthRadius, 0, 0, Math.PI * 2);
      ctx.fill();
      // Flying comedic grunt soundwaves
      if (running && tension > 0.15) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + 0.5 * Math.sin(now * 0.04)})`;
        ctx.lineWidth = 3;
        for (let w = 1; w <= 3; w++) {
          const r = mouthRadius + w * 16 + (now * 0.05) % 20;
          ctx.beginPath();
          ctx.arc(tomX, tomY - 10, r, -0.6, 0.6);
          ctx.stroke();
        }
      }
    }

    // High-End Broadcast Boom Mic right next to mouth
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(320, 360);
    ctx.lineTo(tomX - 35, tomY - 10);
    ctx.stroke();
    // Mic Capsule
    ctx.fillStyle = COLOURS.micSilver;
    ctx.beginPath();
    ctx.roundRect(tomX - 44, tomY - 24, 20, 30, 8);
    ctx.fill();
    // Glowing On-Air Mic Ring
    ctx.fillStyle = crashed ? COLOURS.vuRed : cashed ? '#22c55e' : '#ef4444';
    ctx.fillRect(tomX - 44, tomY - 28, 20, 4);

    // 4. Crash Visuals: Cracked Booth Glass & Exploding Sparks
    if (crashed) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(480, 270);
      ctx.lineTo(220, 90);
      ctx.moveTo(480, 270);
      ctx.lineTo(760, 80);
      ctx.moveTo(480, 270);
      ctx.lineTo(180, 320);
      ctx.moveTo(480, 270);
      ctx.lineTo(820, 310);
      ctx.moveTo(350, 180);
      ctx.lineTo(390, 70);
      ctx.moveTo(630, 160);
      ctx.lineTo(670, 60);
      ctx.stroke();

      // Detonated monitor sparks
      const sparkCount = 18;
      for (let i = 0; i < sparkCount; i++) {
        const ang = (i / sparkCount) * Math.PI * 2 + now * 0.01;
        const dist = 50 + ((now * 0.2 + i * 20) % 180);
        ctx.fillStyle = i % 2 === 0 ? '#f59e0b' : '#ef4444';
        ctx.beginPath();
        ctx.arc(tomX + Math.cos(ang) * dist, tomY + Math.sin(ang) * dist, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. HUD & Multiplier Presentation
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Live On Air Tag
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(420, 12, 120, 24, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillText(running ? '● ON AIR' : crashed ? 'OFF AIR (DETONATED)' : 'STANDBY', 480, 24);

    // Massive Multiplier
    const pop = running ? clamp01(1 - Math.log(view.currentX100 / (view.currentX100 - 5)) / 0.05) : 0;
    const multColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.accent;
    ctx.fillStyle = multColor;
    ctx.font = popFont(800, 72 + depth * 14, pop);
    ctx.fillText(formatX(view.currentX100), 480, 95);

    // Subtitle / Milestone Headline
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    const caption = running
      ? currentMilestone?.[1] ?? 'Mic gain cranked · broadcast steady'
      : crashed
      ? '130dB BELCH DETONATED THE MIXING CONSOLE'
      : 'WAITING FOR TOM TO HIT THE DESK';

    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '600 20px ui-sans-serif, system-ui';
    ctx.fillText(caption, 480, 140, 720);

    // Stake line
    const [statusText, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = '700 18px ui-sans-serif, system-ui';
    ctx.fillText(statusText, 480, 460);

    ctx.restore();
  }

  return { draw };
}
