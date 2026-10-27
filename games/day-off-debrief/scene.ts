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
  [120, "First text sent: 'just woke up at noon lol'"],
  [150, "Photo of half-eaten bagel sent while he welds"],
  [200, "Two-hour nap update delivered with zero shame"],
  [250, "Reviewing scented candles on speakerphone"],
  [300, "Sends 40 unboxing clips of thrifted sweaters"],
  [500, "Debates buying miniature decorative pumpkins"],
  [1000, "Spams 35 selfie checks for haircut opinions"],
  [10000, "Full essay on why iced matcha hits different"],
  [100000, "Sends 12-minute audio file of ceiling fan hum"],
  [1000000, "Achieves ultimate vegetative nirvana on couch"],
];

const BUBBLE_TEXTS = [
  "look at this cloud lol",
  "my cat sneezed twice 🥺",
  "should i buy this candle??",
  "eating string cheese brb",
  "nap #2 was immaculate ✨",
  "voice note (8:42 min) 🎙️",
  "did you drink water babe??",
  "omg iced matcha hits diff",
  "unboxing sweater #14",
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.28 * pop * pop)}px "Segoe UI", system-ui, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Takeout delivered at ${formatX(view.cashoutX100)} · Boyfriend saved & fed! 🍱`, '#6ee7b7'];
  }
  if (view.stake === null) {
    return [crashed ? 'Phone dropped in wet cement · no credits lost' : 'Lurking in pajamas · 0 credits riding', '#94a3b8'];
  }
  if (crashed) return [`Dropped into molten concrete! Lost ${credits(view.stake)}`, '#f87171'];
  return [`${credits(view.stake)} riding on your leisure debrief 📱`, '#fbbf24'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let nextTextTimer = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('camera', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.85);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('notify', 0.75);
      }
      if (now > nextTextTimer) {
        audio.fx('pop', 0.25 + 0.4 * tension);
        nextTextTimer = now + Math.max(380, 1400 - tension * 950);
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.5) ** 2 : running ? tension * 1.5 * Math.sin(now * 0.02) : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.07));

    // Split background: Left = Cozy Pastel Bedroom (warm pink/lavender), Right = Industrial Steel Rain/Mud
    const gradLeft = ctx.createLinearGradient(0, 0, 480, 540);
    gradLeft.addColorStop(0, '#311b38');
    gradLeft.addColorStop(1, '#1b1226');
    ctx.fillStyle = gradLeft;
    ctx.fillRect(0, 0, 480, 540);

    const gradRight = ctx.createLinearGradient(480, 0, 960, 540);
    gradRight.addColorStop(0, '#1c1f26');
    gradRight.addColorStop(1, '#0d1117');
    ctx.fillStyle = gradRight;
    ctx.fillRect(480, 0, 480, 540);

    // Bedside Fairy Lights (Left side)
    for (let i = 0; i < 7; i++) {
      const lx = 40 + i * 58;
      const ly = 55 + Math.sin(i * 0.8 + now * 0.003) * 12;
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#fbcfe8' : '#fed7aa';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 10;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Construction Girder / Crane & Rain (Right side)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(560, 0);
    ctx.lineTo(960, 260);
    ctx.moveTo(960, 260);
    ctx.lineTo(540, 540);
    ctx.stroke();

    // Cross-trusses on the girder
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#475569';
    for (let i = 0; i < 6; i++) {
      const gx = 560 + i * 65;
      const gy = 60 + i * 40;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 40, gy + 80);
      ctx.stroke();
    }

    // Rain streaks / welding sparks on construction side
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const rx = 520 + ((i * 47 + (now * 0.6)) % 430);
      const ry = (i * 37 + (now * 0.9)) % 520;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8, ry + 18);
      ctx.stroke();
    }

    // Sparks from welding torch
    const sparkRate = crashed ? 0 : 1 + tension * 4;
    for (let i = 0; i < 8 * sparkRate; i++) {
      const sx = 760 + Math.sin(now * 0.02 + i) * (20 + tension * 40);
      const sy = 330 + Math.cos(now * 0.03 + i) * (20 + tension * 35);
      ctx.fillStyle = i % 2 === 0 ? '#fef08a' : '#f97316';
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }

    // Bed & Blanket Burrito Girl (Left side)
    const girlBreath = Math.sin(now * 0.003) * 4;
    // Fluffy bed & pillows
    ctx.fillStyle = '#4a2840';
    ctx.beginPath();
    ctx.roundRect(40, 340, 360, 170, 30);
    ctx.fill();

    // Huge cozy blanket roll (Burrito)
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.ellipse(220, 370 + girlBreath, 130, 80, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.ellipse(220, 355 + girlBreath, 115, 65, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Cozy Girl's head peeking out
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(170, 310 + girlBreath, 36, 0, Math.PI * 2);
    ctx.fill();
    // Messy bun hair
    ctx.fillStyle = '#831843';
    ctx.beginPath();
    ctx.arc(150, 280 + girlBreath, 24, 0, Math.PI * 2);
    ctx.arc(170, 290 + girlBreath, 38, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();
    // Blissful closed eyes & smile
    ctx.strokeStyle = '#500724';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(175, 308 + girlBreath, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // Blush
    ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.beginPath();
    ctx.arc(184, 316 + girlBreath, 7, 0, Math.PI * 2);
    ctx.fill();

    // Glowing phone in girl's hand
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(220, 280 + girlBreath, 42, 68, 6);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 15;
    ctx.fillRect(224, 285 + girlBreath, 34, 58);
    ctx.shadowBlur = 0;

    // Construction Boyfriend on Steel Beam (Right side)
    const bfShake = running ? tension * 5 * Math.sin(now * 0.05) : 0;
    const bfx = 760 + bfShake;
    const bfy = 320;

    // Steel Girder under boyfriend
    ctx.fillStyle = '#64748b';
    ctx.fillRect(580, 370, 340, 28);
    ctx.fillStyle = '#475569';
    for (let b = 0; b < 10; b++) {
      ctx.beginPath();
      ctx.arc(605 + b * 32, 384, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boyfriend body (Muddy yellow vest, jeans)
    ctx.fillStyle = '#0f172a'; // muddy boots
    ctx.fillRect(bfx - 18, bfy + 45, 14, 20);
    ctx.fillRect(bfx + 6, bfy + 45, 14, 20);
    ctx.fillStyle = '#1e293b'; // jeans
    ctx.fillRect(bfx - 20, bfy + 10, 42, 38);
    ctx.fillStyle = '#eab308'; // safety vest
    ctx.beginPath();
    ctx.roundRect(bfx - 24, bfy - 35, 50, 48, 8);
    ctx.fill();
    // Reflective safety stripes
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bfx - 22, bfy - 18, 46, 6);

    // Boyfriend Head / Hardhat
    ctx.fillStyle = '#fcd34d'; // Hardhat
    ctx.beginPath();
    ctx.arc(bfx, bfy - 46, 22, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(bfx - 26, bfy - 48, 52, 6);

    // Face & expression
    ctx.fillStyle = '#fbcfe8';
    ctx.fillRect(bfx - 16, bfy - 44, 32, 22);

    if (crashed) {
      // Screaming / Despair face
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(bfx, bfy - 30, 8, 0, Math.PI * 2);
      ctx.fill();
      // Phone falling into molten concrete
      const fallY = Math.min(500, bfy + age * 360);
      ctx.fillStyle = '#111827';
      ctx.fillRect(bfx + 35, fallY, 20, 34);
      // Molten concrete splash at bottom
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(bfx + 45, 510, 60, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (view.cashoutX100 !== null) {
      // Smiling & holding cold takeout box!
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bfx, bfy - 32, 7, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // Takeout bag
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.roundRect(bfx + 24, bfy - 15, 34, 36, 4);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.font = '16px monospace';
      ctx.fillText('🥡', bfx + 40, bfy + 4);
    } else {
      // Sweating / tired face
      ctx.fillStyle = '#334155';
      ctx.fillRect(bfx - 10, bfy - 36, 6, 2);
      ctx.fillRect(bfx + 4, bfy - 36, 6, 2);
      // Sweat drop
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(bfx + 15, bfy - 32 + (now * 0.05) % 15, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Phone Battery Gauge above Boyfriend
    const batteryPct = clamp01(1 - (view.currentX100 - 100) / 700);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(bfx - 30, bfy - 82, 60, 16, 4);
    ctx.fill();
    ctx.fillStyle = batteryPct < 0.2 ? '#ef4444' : batteryPct < 0.5 ? '#f59e0b' : '#22c55e';
    ctx.fillRect(bfx - 28, bfy - 80, 56 * batteryPct, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '9px monospace';
    ctx.fillText(`${Math.round(batteryPct * 100)}%`, bfx, bfy - 72);

    // Floating SMS bubbles cascading across the split divider
    const bubbleCount = Math.min(7, 2 + Math.floor(tension * 6));
    for (let b = 0; b < bubbleCount; b++) {
      const progress = ((now * 0.0006 + b * 0.28) % 1);
      const bx = 260 + progress * 320;
      const by = 260 - progress * 130 + Math.sin(b * 1.7 + now * 0.002) * 16;
      const text = BUBBLE_TEXTS[(b + milestone) % BUBBLE_TEXTS.length] ?? 'lol';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.roundRect(bx - 60, by - 12, 130, 24, 12);
      ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, bx + 5, by + 4);
    }

    // Split-screen divider line with animated texting pulse
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(480, 100);
    ctx.lineTo(480, 460);
    ctx.stroke();

    // Top HUD: Game Title and Mult
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbcfe8';
    ctx.font = '800 28px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('DAY OFF DEBRIEF', 480, 36);

    ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Spamming his 12-hour welding shift with trivial leisure updates', 480, 60);

    // Huge Multiplier Display
    const multColor = crashed ? '#f87171' : view.cashoutX100 !== null ? '#4ade80' : '#fbbf24';
    ctx.fillStyle = multColor;
    ctx.font = `900 ${76 * (1 + 0.15 * tension)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 138);

    // Milestone / Action Caption
    const passed = running ? MILESTONES[milestone - 1] : undefined;
    const caption = crashed
      ? 'CRASH! 47th voice note dropped phone into wet concrete!'
      : view.cashoutX100 !== null
      ? 'SWEET SELFIES & TAKEOUT DELIVERED IN TIME!'
      : passed?.[1] ?? (view.phase === 'betting' ? 'Getting cozy under the duvet... Place bet' : 'Waking up at noon...');

    ctx.fillStyle = crashed ? '#fca5a5' : '#e0e7ff';
    ctx.font = popFont(600, 18, pop(passed?.[0] ?? 100));
    ctx.fillText(caption, 480, 474, 900);

    // Stake Line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 508, 900);

    // Crash or Cashed Out dramatic banner
    if (crashed) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.fillRect(0, 0, 960, 540);
    } else if (view.cashoutX100 !== null) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
      ctx.fillRect(0, 0, 960, 540);
    }

    ctx.restore();
  }

  return { draw };
}
