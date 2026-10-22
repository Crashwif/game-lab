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
  bg: '#0b0d14',
  crtBorder: '#1c2233',
  screenBg: '#081820',
  grid: 'rgba(34, 197, 94, 0.15)',
  redYarn: '#ef4444',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  text: '#f8fafc',
  muted: '#94a3b8',
  crashed: '#f43f5e',
  cashout: '#10b981',
  gold: '#fbbf24',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Squinting at 8 muddy brown pixels'],
  [150, 'Adjusting CRT monitor contrast to max'],
  [200, 'Applying unsharp mask in cracked Photoshop'],
  [250, 'Red yarn connecting forum posts from 1998'],
  [300, 'Running ancient Japanese texture rom dumps'],
  [500, 'Illuminati triangles map onto the star statue'],
  [1000, 'Decoding hex addresses with a tin foil hat on'],
  [10000, '3-hour voiceover breakdown goes super-viral'],
  [100000, "Shigeru Miyamoto's ghost whispers the cipher"],
  [1000000, 'Ascending into polyhedral enlightenment'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Published 3-hour doc at ${formatX(view.cashoutX100)}! 12M views rolling in`, COLOURS.cashout];
  }
  if (view.stake === null) {
    return [crashed ? 'Watched the debunking · 0 credits lost' : 'Lurking forum thread · no credits riding', COLOURS.muted];
  }
  if (crashed) return [`Lost ${credits(view.stake)} obsessing over dev comments`, COLOURS.crashed];
  return [`${credits(view.stake)} riding on the ancient glyph cipher`, COLOURS.amber];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'scratch' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let prevStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Pulse audio
    const step = Math.floor(view.elapsed / (260 - 150 * tension));
    if (running && step !== prevStep && !cashed) {
      prevStep = step;
      audio.fx('beep', 0.2 + 0.4 * tension);
    }

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('camera', 0.9);
      audio.fx('cheer', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('scratch', previousPhase === null || view.crashAge > 1500);
      audio.fx('thud', 0.8);
    }
    if (running && previousPhase === 'running' && milestoneIdx > previousMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('zap', 0.6);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 10 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;
    const camShakeX = shake * Math.sin(crashAgeSec * 65);
    const camShakeY = shake * Math.cos(crashAgeSec * 82);

    ctx.save();
    ctx.translate(camShakeX, camShakeY);

    // 1. Dark room & corkboard background
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Corkboard texture & pins
    ctx.fillStyle = '#141724';
    ctx.fillRect(20, 20, 920, 500);

    // Ambient conspiracy grid & hex dumps
    ctx.strokeStyle = COLOURS.grid;
    ctx.lineWidth = 1;
    for (let x = 40; x < 940; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, 510);
      ctx.stroke();
    }
    for (let y = 40; y < 520; y += 40) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(930, y);
      ctx.stroke();
    }

    // Background sticky notes & forum printouts
    const notes = [
      { x: 50, y: 55, w: 120, h: 80, col: '#fef08a', rot: -0.06, text: 'N64 BUILD 0.92b\nIS HE REAL?!' },
      { x: 790, y: 65, w: 120, h: 80, col: '#fbcfe8', rot: 0.08, text: 'L IS REAL 2401\nCOINCIDENCE?' },
      { x: 60, y: 390, w: 130, h: 80, col: '#fed7aa', rot: 0.05, text: 'FOUNTAIN STAR\nROTATE 45 DEG' },
      { x: 770, y: 380, w: 140, h: 90, col: '#bbf7d0', rot: -0.07, text: 'HEX 0x8033B400\nTEXTURE ADDR' },
    ];
    notes.forEach(note => {
      ctx.save();
      ctx.translate(note.x + note.w / 2, note.y + note.h / 2);
      ctx.rotate(note.rot);
      ctx.fillStyle = note.col;
      ctx.fillRect(-note.w / 2, -note.h / 2, note.w, note.h);
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px monospace';
      const lines = note.text.split('\n');
      lines.forEach((l, i) => ctx.fillText(l, -note.w / 2 + 8, -note.h / 2 + 20 + i * 16));
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(0, -note.h / 2 + 5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 2. Central CRT Monitor / Enhancement Viewport
    const crtX = 220;
    const crtY = 80;
    const crtW = 520;
    const crtH = 340;

    ctx.fillStyle = COLOURS.crtBorder;
    ctx.beginPath();
    ctx.roundRect(crtX - 14, crtY - 14, crtW + 28, crtH + 28, 16);
    ctx.fill();

    // Screen inner
    ctx.fillStyle = COLOURS.screenBg;
    ctx.beginPath();
    ctx.roundRect(crtX, crtY, crtW, crtH, 8);
    ctx.fill();

    // Zooming pixel fountain plaque inside CRT
    ctx.save();
    ctx.beginPath();
    ctx.rect(crtX, crtY, crtW, crtH);
    ctx.clip();

    // Animated zoomed texture or 4K reveal on crash
    const cx = crtX + crtW / 2;
    const cy = crtY + crtH / 2;

    if (crashed) {
      // 4K Ultra HD Reveal of dev joke
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(crtX, crtY, crtW, crtH);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(cx - 190, cy - 80, 380, 160);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.strokeRect(cx - 190, cy - 80, 380, 160);

      ctx.textAlign = 'center';
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '900 24px monospace';
      ctx.fillText('[ ULTRA HD 4K ASSET DUMP ]', cx, cy - 44);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 20px monospace';
      ctx.fillText('DEFAULT_TEST_CUBE_01', cx, cy);

      ctx.fillStyle = '#fca5a5';
      ctx.font = '13px monospace';
      ctx.fillText('// TODO: MIYAMOTO SAID SWAP THIS BEFORE E3 1996', cx, cy + 30);
      ctx.fillText('// NO SECRET HIDDEN HERE - KENJI', cx, cy + 50);
    } else {
      // Blurry 90s low-poly fountain textures escalating into mad geometry
      const zoom = 1 + tension * 4.5 + depth * 3;
      const pixelSize = Math.max(14, Math.floor(48 / zoom));

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);

      // Low-poly courtyard fountain stone
      const palette = ['#475569', '#334155', '#64748b', '#1e293b', '#0f172a', '#78716c', '#a8a29e'];
      for (let px = -5; px <= 5; px++) {
        for (let py = -4; py <= 4; py++) {
          const hash = Math.abs(Math.sin(px * 12.9898 + py * 78.233) * 43758.5453);
          const colIdx = Math.floor(hash * palette.length) % palette.length;
          ctx.fillStyle = palette[colIdx] ?? '#334155';
          ctx.fillRect(px * pixelSize - pixelSize / 2, py * pixelSize - pixelSize / 2, pixelSize - 1, pixelSize - 1);
        }
      }

      // Mystic star engraved in pixels
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-pixelSize * 1.5, -pixelSize * 1.5, pixelSize * 3, pixelSize * 3);

      ctx.restore();

      // CRT Scanlines
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      for (let sl = crtY; sl < crtY + crtH; sl += 4) {
        ctx.fillRect(crtX, sl, crtW, 2);
      }

      // Mathematical overlays & Illuminati eye if tension is high
      if (tension > 0.2) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + tension * 0.5})`;
        ctx.lineWidth = 2;
        // Connecting triangles
        ctx.beginPath();
        ctx.moveTo(cx, cy - 100);
        ctx.lineTo(cx - 120, cy + 80);
        ctx.lineTo(cx + 120, cy + 80);
        ctx.closePath();
        ctx.stroke();

        // Illuminati center eye
        if (tension > 0.4) {
          ctx.beginPath();
          ctx.arc(cx, cy - 20, 36, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = COLOURS.amber;
          ctx.beginPath();
          ctx.arc(cx, cy - 20, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // Live hex address decoder stream
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(34, 197, 94, 0.85)';
        for (let i = 0; i < 4; i++) {
          const hex = `0x${((now * 0.05 + i * 239) & 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
          ctx.fillText(`ADDR_${i}: ${hex} [MATCH]`, crtX + 18, crtY + 28 + i * 18);
        }
      }
    }
    ctx.restore();

    // Red yarn connecting pins across the corkboard into CRT center
    if (tension > 0.15 || cashed) {
      ctx.strokeStyle = COLOURS.redYarn;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(110, 100);
      ctx.lineTo(crtX + 100, crtY + 70);
      ctx.lineTo(crtX + crtW / 2, crtY + crtH / 2);
      ctx.lineTo(820, 105);
      ctx.moveTo(crtX + crtW / 2, crtY + crtH / 2);
      ctx.lineTo(120, 430);
      ctx.stroke();
    }

    // 3. Protagonist: Sweaty speedrunner with magnifying glass & tin foil hat
    const sweatX = 810;
    const sweatY = 320;
    ctx.save();
    ctx.translate(sweatX, sweatY);

    if (crashed) {
      // Fainted face-first onto desk
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.ellipse(0, 50, 45, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '24px sans-serif';
      ctx.fillText('😵', -15, 58);
      ctx.font = '14px monospace';
      ctx.fillStyle = COLOURS.muted;
      ctx.fillText('*KEYBOARD FAINT*', -55, 100);
    } else {
      // Sweaty bloodshot eye looking through magnifying glass
      const headBob = Math.sin(now * 0.008) * (2 + 6 * tension);
      ctx.translate(0, headBob);

      // Tin foil hat if tension > 0.6
      if (tension > 0.5) {
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(-35, -40);
        ctx.lineTo(0, -95);
        ctx.lineTo(35, -40);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.stroke();
      }

      // Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();

      // Bloodshot bulging eyes
      const eyeR = 12 + tension * 4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-14, -4, eyeR, 0, Math.PI * 2);
      ctx.arc(14, -4, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Veins in eyes
      if (tension > 0.3) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-18, -10);
        ctx.lineTo(-14, -4);
        ctx.moveTo(18, -10);
        ctx.lineTo(14, -4);
        ctx.stroke();
      }

      // Pupils locked forward
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-14 - tension * 3, -4, 4, 0, Math.PI * 2);
      ctx.arc(14 - tension * 3, -4, 4, 0, Math.PI * 2);
      ctx.fill();

      // Sweating drops
      if (tension > 0.25) {
        ctx.fillStyle = '#38bdf8';
        const dropY = ((now * 0.1) % 40) - 20;
        ctx.beginPath();
        ctx.arc(-42, dropY, 4, 0, Math.PI * 2);
        ctx.arc(42, dropY + 8, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Magnifying glass in hand
      ctx.save();
      ctx.translate(-50, 10);
      ctx.rotate(-0.35);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(147, 197, 253, 0.25)';
      ctx.fill();
      // handle
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(18, 18);
      ctx.lineTo(44, 44);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // 4. Cashed Out Celebration Overlay (YouTube Viral Documentary)
    if (cashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(160, 120, 640, 240);
      ctx.strokeStyle = COLOURS.gold;
      ctx.lineWidth = 4;
      ctx.strokeRect(160, 120, 640, 240);

      // YouTube player style badge
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(190, 140, 50, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(210, 148);
      ctx.lineTo(224, 157);
      ctx.lineTo(210, 166);
      ctx.closePath();
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('VIDEO PUBLISHED · 3:41:09 DOCUMENTARY', 255, 164);

      ctx.fillStyle = COLOURS.gold;
      ctx.font = '900 32px monospace';
      ctx.fillText(`CASHED OUT AT ${formatX(view.cashoutX100 ?? 100)}`, 190, 220);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillText('📈 14,829,104 Views · #1 ON TRENDING GAMING', 190, 260);

      ctx.fillStyle = COLOURS.muted;
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('"The fountain was an ancient stargate all along! Like & Subscribe!"', 190, 310);
      ctx.restore();
    }

    // 5. Main HUD & Multiplier readout
    ctx.textAlign = 'center';

    // Game Title & Tagline
    ctx.font = '800 22px monospace';
    ctx.fillStyle = COLOURS.amber;
    ctx.fillText('PIXEL CONSPIRACY: THE 1996 TEXTURE CIPHER', 480, 48);

    // Huge Multiplier Display inside/above monitor
    const multColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashout : COLOURS.text;
    ctx.fillStyle = multColor;
    const multScale = running ? 1 + tension * 0.15 : 1;
    ctx.font = `900 ${Math.floor(58 * multScale)}px monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 125);

    // Current Milestone caption
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.cyan;
    const bannerText = running
      ? (currentMilestone?.[1] ?? 'Searching fountain texture memory...')
      : crashed
      ? 'CONSPIRACY DEBUNKED · JUST A PLACEHOLDER CUBE'
      : 'Squint into the CRT to unlock the universe';
    ctx.fillText(bannerText, 480, 442);

    // Stake line
    const [statusText, statusCol] = stakeLine(view);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = statusCol;
    ctx.fillText(statusText, 480, 474);

    ctx.restore();
  }

  return { draw };
}
