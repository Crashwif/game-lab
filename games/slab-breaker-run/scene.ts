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
  [120, 'First tap chips off the tamper sticker'],
  [150, 'Pliers wedge into the ultrasonic weld edge'],
  [200, 'ROM dumper progress bar hits 15% read cache'],
  [250, 'Grading company lawyers send certified mail'],
  [300, 'Crack line spreads straight down the label'],
  [500, 'Cartridge pins become visible through fracture'],
  [1000, 'Live torrent tracker seed count explodes'],
  [10000, 'Archive mirror servers ignite in sync'],
  [100000, 'Entire lost generation boots in an emulator'],
  [1000000, 'Total digital preservation achieved!'],
];

const COLOURS = {
  bgMat: '#0b131e',
  grid: '#18283a',
  slabBody: 'rgba(215, 238, 255, 0.22)',
  slabBorder: '#8ec7f5',
  cartridge: '#424d5b',
  cartLabel: '#d97706',
  labelHeader: '#dc2626',
  labelGold: '#f59e0b',
  crack: '#f8fafc',
  accent: '#38bdf8',
  greenSync: '#22c55e',
  crashed: '#ef4444',
  text: '#f1f5f9',
  muted: '#94a3b8',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Dump dumped at ${formatX(view.cashoutX100)} · ROM preserved forever!`, COLOURS.greenSync];
  }
  if (view.stake === null) {
    return [crashed ? 'Cartridge crushed · spectator mode' : 'Watching extraction · 0 credits at risk', COLOURS.muted];
  }
  if (crashed) {
    return [`Silicon crushed! ${credits(view.stake)} pulverized to dust`, COLOURS.crashed];
  }
  return [`Preserving lost ROM · ${credits(view.stake)} riding`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastTapStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Rhythmic jewel hammer tap pacing: accelerates with tension
    const tapPeriod = Math.max(140, 480 - tension * 320);
    const tapStep = Math.floor(view.elapsed / tapPeriod);
    const tapPhase = (view.elapsed % tapPeriod) / tapPeriod;

    if (prevPhase !== null && running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
      audio.fx('cheer', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('zap', 0.5);
      }
      if (tapStep > lastTapStep && !cashedOut) {
        audio.fx('clang', 0.35 + 0.5 * tension);
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;
    lastTapStep = tapStep;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;
    const shakeX = shake * Math.sin(crashAgeSec * 85);
    const shakeY = shake * Math.cos(crashAgeSec * 73);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Anti-Static Workbench Background
    ctx.fillStyle = COLOURS.bgMat;
    ctx.fillRect(0, 0, 960, 540);

    // Grid lines on ESD mat
    ctx.strokeStyle = COLOURS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = 0; y <= 540; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Warm desk lamp glow center-right
    const lampGlow = ctx.createRadialGradient(500, 260, 40, 500, 260, 360);
    lampGlow.addColorStop(0, 'rgba(251, 191, 36, 0.12)');
    lampGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(0, 0, 960, 540);

    // 2. Left Terminal Laptop: ROM Dumper screen
    const laptopX = 54;
    const laptopY = 160;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(laptopX, laptopY, 170, 210);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(laptopX, laptopY, 170, 210);

    // Laptop Header
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(laptopX, laptopY, 170, 24);
    ctx.fillStyle = COLOURS.accent;
    ctx.font = '600 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('OPEN_DUMP_v2.4', laptopX + 8, laptopY + 16);

    // Laptop Hex stream
    ctx.fillStyle = '#38bdf8';
    ctx.font = '10px monospace';
    const hexLines = 8;
    for (let i = 0; i < hexLines; i++) {
      const offset = (Math.floor(now / 110) + i * 3) % 999;
      const hexStr = `0x${offset.toString(16).toUpperCase().padStart(4, '0')} 4A${(i * 7) % 99} F0`;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now * 0.005 + i);
      ctx.fillText(hexStr, laptopX + 8, laptopY + 45 + i * 16);
    }
    ctx.globalAlpha = 1.0;

    // Buffer Bar
    const dumpPct = cashedOut ? 100 : Math.min(99, Math.floor(tension * 100));
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(laptopX + 8, laptopY + 180, 154, 14);
    ctx.fillStyle = cashedOut ? COLOURS.greenSync : (crashed ? COLOURS.crashed : COLOURS.accent);
    ctx.fillRect(laptopX + 8, laptopY + 180, 154 * (dumpPct / 100), 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 9px monospace';
    ctx.fillText(`BUFFER: ${dumpPct}%`, laptopX + 14, laptopY + 191);

    // 3. Centerpiece: Graded Acrylic Slab & Vintage Cartridge
    const slabW = 200;
    const slabH = 260;
    const slabCenterX = 510;
    const slabCenterY = 275;
    const slabX = slabCenterX - slabW / 2;
    const slabY = slabCenterY - slabH / 2;

    if (!crashed || crashAgeSec < 0.25) {
      // Slab Outer Shadow & Body
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(slabX + 6, slabY + 6, slabW, slabH);

      // Acrylic case
      ctx.fillStyle = COLOURS.slabBody;
      ctx.fillRect(slabX, slabY, slabW, slabH);
      ctx.strokeStyle = cashedOut ? COLOURS.greenSync : COLOURS.slabBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(slabX, slabY, slabW, slabH);

      // Grading Header Tag
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(slabX + 10, slabY + 10, slabW - 20, 48);
      ctx.fillStyle = COLOURS.labelHeader;
      ctx.fillRect(slabX + 10, slabY + 10, slabW - 20, 10);

      ctx.fillStyle = '#0f172a';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('PSA GEM MT', slabX + 16, slabY + 36);
      ctx.fillStyle = COLOURS.labelGold;
      ctx.font = '900 18px monospace';
      ctx.fillText('10', slabX + 145, slabY + 38);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 9px monospace';
      ctx.fillText('1996 LOST ALPHA ROM #001', slabX + 16, slabY + 52);

      // Tamper sticker with hologram strip
      const holoX = slabX + slabW - 40;
      const holoY = slabY + 62;
      const holoGrad = ctx.createLinearGradient(holoX, holoY, holoX + 28, holoY + 14);
      holoGrad.addColorStop(0, '#f43f5e');
      holoGrad.addColorStop(0.5, '#06b6d4');
      holoGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = holoGrad;
      ctx.fillRect(holoX, holoY, 28, 12);

      // Cartridge nestled inside
      const cartX = slabX + 26;
      const cartY = slabY + 84;
      const cartW = slabW - 52;
      const cartH = 150;

      // When cashed out, cartridge slides right into the USB dumper dock!
      const cartSlide = cashedOut ? Math.min(180, (now % 3000) * 0.2) : 0;

      ctx.save();
      ctx.translate(cartSlide, 0);

      // Cartridge Plastic
      ctx.fillStyle = COLOURS.cartridge;
      ctx.beginPath();
      ctx.roundRect(cartX, cartY, cartW, cartH, [6, 6, 2, 2]);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cartridge Label
      ctx.fillStyle = COLOURS.cartLabel;
      ctx.fillRect(cartX + 14, cartY + 16, cartW - 28, 70);
      ctx.fillStyle = '#1e293b';
      ctx.font = '900 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CHRONO ZERO', cartX + cartW / 2, cartY + 45);
      ctx.font = '700 8px monospace';
      ctx.fillText('PRE-RELEASE MASTER', cartX + cartW / 2, cartY + 60);

      // Gold pins poking at bottom
      ctx.fillStyle = '#fbbf24';
      for (let p = 0; p < 8; p++) {
        ctx.fillRect(cartX + 18 + p * 14, cartY + cartH - 12, 8, 10);
      }
      ctx.restore();

      // Hairline Cracks (growing with tension)
      if (tension > 0.05 && !cashedOut) {
        ctx.strokeStyle = COLOURS.crack;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 4;
        const crackProg = tension;

        ctx.beginPath();
        ctx.moveTo(slabX + slabW / 2, slabY + 60);
        ctx.lineTo(slabX + slabW / 2 + 10, slabY + 100 * crackProg);
        if (tension > 0.3) {
          ctx.lineTo(slabX + slabW / 2 - 18, slabY + 160 * crackProg);
        }
        if (tension > 0.6) {
          ctx.lineTo(slabX + slabW / 2 + 25, slabY + 210 * crackProg);
          ctx.moveTo(slabX + 20, slabY + 140);
          ctx.lineTo(slabX + 60 * crackProg, slabY + 170);
        }
        if (tension > 0.85) {
          ctx.moveTo(slabX + slabW - 20, slabY + 120);
          ctx.lineTo(slabX + slabW - 70, slabY + 190);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Jewel Hammer / Mini Pliers hovering & striking
      if (running && !cashedOut) {
        const hammerAngle = -0.3 + Math.sin(tapPhase * Math.PI) * 0.7;
        const hPivotX = slabCenterX + 95;
        const hPivotY = slabCenterY - 40;

        ctx.save();
        ctx.translate(hPivotX, hPivotY);
        ctx.rotate(hammerAngle);

        // Hammer Handle
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-6, -80, 12, 90);
        ctx.strokeStyle = '#b45309';
        ctx.strokeRect(-6, -80, 12, 90);

        // Steel Head
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-22, -92, 44, 20);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-26, -90, 8, 16);
        ctx.restore();

        // Spark effect on strike impact
        if (tapPhase > 0.85) {
          ctx.fillStyle = '#fef08a';
          for (let s = 0; s < 4; s++) {
            const spX = slabCenterX + Math.cos(s * 1.6) * 16;
            const spY = slabCenterY - 20 + Math.sin(s * 1.6) * 16;
            ctx.beginPath();
            ctx.arc(spX, spY, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else {
      // CRASHED STATE: Acrylic shattered & Silicon pulverised into dust!
      const burstAge = clamp01(crashAgeSec / 1.5);
      const shardCount = 18;
      ctx.save();
      ctx.translate(slabCenterX, slabCenterY);

      for (let i = 0; i < shardCount; i++) {
        const angle = (i / shardCount) * Math.PI * 2 + i;
        const dist = burstAge * (90 + (i % 5) * 40);
        const rot = burstAge * ((i % 2 === 0 ? 1 : -1) * 6);
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist + burstAge * burstAge * 120; // gravity

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        ctx.fillStyle = i % 3 === 0 ? '#475569' : (i % 3 === 1 ? 'rgba(148, 163, 184, 0.7)' : '#f59e0b');
        ctx.beginPath();
        ctx.moveTo(-12, -8);
        ctx.lineTo(14, -4);
        ctx.lineTo(4, 16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Silicon pulverized dust cloud
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 * (1 - burstAge)})`;
      ctx.beginPath();
      ctx.arc(0, 0, 70 + burstAge * 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Safe USB Dumper Bay on Right
    const bayX = 720;
    const bayY = 175;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bayX, bayY, 180, 180);
    ctx.strokeStyle = cashedOut ? COLOURS.greenSync : '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(bayX, bayY, 180, 180);

    ctx.fillStyle = cashedOut ? COLOURS.greenSync : COLOURS.muted;
    ctx.font = '700 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cashedOut ? 'DUMP STATION · READY' : 'USB DUMP DOCK', bayX + 90, bayY + 30);

    // Slot
    ctx.fillStyle = '#090d16';
    ctx.fillRect(bayX + 25, bayY + 55, 130, 24);

    // Activity LEDs
    const ledOn = cashedOut || (running && Math.floor(now / 150) % 2 === 0);
    ctx.fillStyle = cashedOut ? '#22c55e' : (ledOn ? '#38bdf8' : '#334155');
    ctx.beginPath();
    ctx.arc(bayX + 50, bayY + 120, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cashedOut ? '#22c55e' : (crashed ? '#ef4444' : '#334155');
    ctx.beginPath();
    ctx.arc(bayX + 90, bayY + 120, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cashedOut ? '#22c55e' : '#334155';
    ctx.beginPath();
    ctx.arc(bayX + 130, bayY + 120, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px monospace';
    ctx.fillText('SYNC', bayX + 50, bayY + 142);
    ctx.fillText('CRACK', bayX + 90, bayY + 142);
    ctx.fillText('DUMP', bayX + 130, bayY + 142);

    // 5. Celebration or Crashed Banner Overlays
    if (cashedOut) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = COLOURS.greenSync;
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ 100% BIT-PERFECT ROM DUMP PRESERVED ★', 480, 395);
    } else if (crashed) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✖ MISSTRIKE: SILICON CHIP PULVERIZED TO DUST ✖', 480, 395);
    }

    // 6. HUD Elements
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.fillText('SLAB BREAKER', 480, 46);

    ctx.font = '600 14px monospace';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('CRACK THE GRADED SLAB · DUMP THE LOST ROM BEFORE PERMANENT EPOXY', 480, 72);

    // Multiplier Display
    const multColor = cashedOut ? COLOURS.greenSync : (crashed ? COLOURS.crashed : COLOURS.accent);
    ctx.fillStyle = multColor;
    const punchScale = crashed ? 1 + 0.3 * clamp01(1 - crashAgeSec / 0.3) : 1;
    ctx.font = `900 ${Math.floor(70 * punchScale)}px monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 138);

    // Current Milestone or Phase Caption
    const currentMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const statusText = currentMilestone?.[1] ?? (
      view.phase === 'betting' ? 'Equip jewel pliers & inspect acrylic casing' :
      view.phase === 'waiting' ? 'Waiting for grading case unboxing...' :
      crashed ? 'Case smashed into brittle dust · Data unrecoverable' :
      'Carefully tapping ultrasonic weld seams...'
    );

    ctx.fillStyle = tension > 0.7 ? '#facc15' : COLOURS.text;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 442, 860);

    // Player Stake / Status Line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 488, 860);

    // Bottom decorative bar
    ctx.fillStyle = '#334155';
    ctx.fillRect(240, 514, 480, 6);
    ctx.fillStyle = multColor;
    ctx.fillRect(240, 514, 480 * depth, 6);

    ctx.restore();
  }

  return { draw };
}
