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
  [120, 'Red arrow glued over nothing'],
  [150, 'Jaw dropped 40% wider than humanly possible'],
  [200, 'Neon laser eyes glowing on preview'],
  [250, 'Random frame picker starts jittering'],
  [300, 'Mid-sneeze double-chin captured'],
  [500, 'Fake gold border bursts into flames'],
  [1000, 'Algorithmic demon overrides the upload'],
  [10000, '10M bot clicks storm the video'],
  [100000, 'Thumbnail becomes sentient internet lore'],
  [1000000, 'Permanent spot on the global trending tab'],
];

const COLOURS = {
  bg: '#0c0d14',
  panel: '#151722',
  panelBorder: '#292d3f',
  text: '#ffffff',
  muted: '#8b93ad',
  redArrow: '#ff1744',
  neonYellow: '#ffe600',
  laserCyan: '#00e5ff',
  crashed: '#ff3366',
  cashedOut: '#00ff88',
  timeline: '#22273d',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Published 10/10 banger at ${formatX(view.cashoutX100)} · Algorithmic jackpot secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Cursed pause locked · No credits at risk' : 'Watching the timeline scrub · Spectating', COLOURS.muted];
  }
  if (crashed) return [`Cursed mid-sneeze thumbnail locked · Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Scrubbing high stakes · ${credits(view.stake)} riding on the frame`, COLOURS.laserCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'scratch' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastScrubTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('camera', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('scratch', previousPhase === null || view.crashAge > 1500);
      audio.fx('gasp', 0.85);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('notify', 0.7);
      }
      const scrubInterval = Math.max(90, 320 - tension * 220);
      if (now - lastScrubTick > scrubInterval && !cashed) {
        audio.fx('click', 0.25 + 0.45 * tension);
        lastScrubTick = now;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.5) ** 2 : running ? tension * (Math.sin(now * 0.04) > 0.8 ? 2 : 0) : 0;

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);
    if (shake > 0) {
      ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.09));
    }

    // Top Studio Header
    ctx.fillStyle = COLOURS.panel;
    ctx.fillRect(20, 16, 920, 48);
    ctx.strokeStyle = COLOURS.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 16, 920, 48);

    ctx.fillStyle = running ? '#ff2a5f' : crashed ? '#555866' : '#ffe600';
    ctx.beginPath();
    ctx.arc(44, 40, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '800 18px ui-monospace, monospace';
    ctx.fillStyle = COLOURS.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(running ? 'REC ● SCRUBBING TIMELINE' : crashed ? 'ENCODING FAILED: CORRUPT FRAME' : 'TIMELINE READY', 62, 40);

    const viewsEstimate = Math.floor(view.currentX100 * 2450);
    ctx.textAlign = 'right';
    ctx.font = '700 16px ui-monospace, monospace';
    ctx.fillStyle = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.neonYellow;
    ctx.fillText(crashed ? '0 VIEWS · -98,400 SUBS' : `EST. ${viewsEstimate.toLocaleString()} VIEWS`, 920, 40);

    // Main Studio Monitor (The Thumbnail Canvas)
    const monX = 180;
    const monY = 80;
    const monW = 600;
    const monH = 320;

    ctx.fillStyle = '#05070a';
    ctx.fillRect(monX - 4, monY - 4, monW + 8, monH + 8);

    // Monitor Screen border
    ctx.lineWidth = view.currentX100 >= 500 && running ? 4 : 2;
    ctx.strokeStyle = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : view.currentX100 >= 500 ? COLOURS.neonYellow : COLOURS.panelBorder;
    ctx.strokeRect(monX - 4, monY - 4, monW + 8, monH + 8);

    ctx.save();
    ctx.beginPath();
    ctx.rect(monX, monY, monW, monH);
    ctx.clip();

    // Studio Monitor Background: saturated radial glow or glitch green-screen
    const bgGrad = ctx.createRadialGradient(monX + monW * 0.5, monY + monH * 0.4, 20, monX + monW * 0.5, monY + monH * 0.5, 360);
    if (crashed) {
      bgGrad.addColorStop(0, '#4a0815');
      bgGrad.addColorStop(1, '#1a0307');
    } else if (cashed) {
      bgGrad.addColorStop(0, '#0a3d24');
      bgGrad.addColorStop(0.7, '#041f11');
      bgGrad.addColorStop(1, '#000803');
    } else {
      const hue = (view.elapsed * 0.05 + tension * 120) % 360;
      bgGrad.addColorStop(0, `hsl(${hue}, 85%, 28%)`);
      bgGrad.addColorStop(1, '#070a14');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(monX, monY, monW, monH);

    // Ray bursts for viral clickbait look
    const rayCount = 12;
    ctx.save();
    ctx.translate(monX + monW * 0.5, monY + monH * 0.45);
    ctx.rotate(now * 0.0006 * (1 + tension * 2));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < rayCount; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 420, (i * 2 * Math.PI) / rayCount, ((i + 0.5) * 2 * Math.PI) / rayCount);
      ctx.fill();
    }
    ctx.restore();

    // The Protagonist Creator (Neurotic YouTuber)
    const centerX = monX + monW * 0.44;
    const centerY = monY + monH * 0.55;
    const breathe = Math.sin(now * 0.008) * (3 + 5 * tension);
    const jawDrop = crashed ? 45 : Math.min(50, tension * 42 + (view.currentX100 >= 150 ? 12 : 0));

    // Green screen glitch scanlines if running at high tension or crashed
    if ((running && tension > 0.4) || crashed) {
      ctx.fillStyle = crashed ? 'rgba(255, 0, 50, 0.12)' : 'rgba(0, 255, 120, 0.08)';
      for (let y = monY; y < monY + monH; y += 6) {
        if (Math.sin(y * 0.3 + now * 0.03) > 0.4) {
          ctx.fillRect(monX, y, monW, 2);
        }
      }
    }

    ctx.save();
    ctx.translate(centerX, centerY + breathe);

    // Cursed double chin / morph
    if (crashed) {
      ctx.fillStyle = '#c77d61';
      ctx.beginPath();
      ctx.ellipse(0, 42, 65, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head / Face
    ctx.fillStyle = crashed ? '#d88b6c' : '#f5be98';
    ctx.beginPath();
    ctx.ellipse(0, 0, 60, 68 + (crashed ? -10 : jawDrop * 0.3), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2b1408';
    ctx.stroke();

    // Sweaty hair
    ctx.fillStyle = '#261710';
    ctx.beginPath();
    ctx.arc(0, -42, 60, Math.PI * 0.9, Math.PI * 2.1);
    ctx.lineTo(55, -20);
    ctx.lineTo(40, -40);
    ctx.lineTo(10, -50);
    ctx.lineTo(-20, -52);
    ctx.lineTo(-50, -32);
    ctx.closePath();
    ctx.fill();

    // Eyes
    const eyeSpread = 26;
    const eyeY = -12;
    const eyeR = crashed ? 13 : 16 + tension * 6;

    for (const side of [-1, 1]) {
      const ex = side * eyeSpread;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (crashed) {
        // mid-sneeze squint / distorted eyes
        ctx.ellipse(ex, eyeY, eyeR, eyeR * (side > 0 ? 0.35 : 0.8), side * 0.2, 0, Math.PI * 2);
      } else {
        ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.strokeStyle = '#2b1408';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Pupils
      ctx.fillStyle = '#111';
      ctx.beginPath();
      const pR = crashed ? 3 : 5 - tension * 2;
      ctx.arc(ex + (crashed ? side * 3 : 0), eyeY, Math.max(2, pR), 0, Math.PI * 2);
      ctx.fill();

      // Laser eyes milestone
      if (view.currentX100 >= 200 && !crashed) {
        ctx.save();
        ctx.strokeStyle = COLOURS.laserCyan;
        ctx.lineWidth = 5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(ex, eyeY);
        ctx.lineTo(ex + side * 140, eyeY + 110);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Sweats beads
    if (tension > 0.25 && !crashed) {
      ctx.fillStyle = '#64d2ff';
      const sweatDrop = (now * 0.08) % 30;
      ctx.beginPath();
      ctx.arc(42, -20 + sweatDrop, 4, 0, Math.PI * 2);
      ctx.arc(-40, -14 + sweatDrop * 0.7, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Giant Clickbait Gaping Mouth
    const mouthY = 22;
    ctx.fillStyle = '#4a0815';
    ctx.beginPath();
    if (crashed) {
      // Cursed mid-sneeze scrunched snout
      ctx.ellipse(0, mouthY, 26, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#220306';
      ctx.beginPath();
      ctx.arc(-7, mouthY - 1, 4, 0, Math.PI * 2);
      ctx.arc(7, mouthY - 1, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const mw = 32 + tension * 10;
      const mh = 20 + jawDrop;
      ctx.ellipse(0, mouthY + mh * 0.3, mw, mh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#200';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Uvula / Teeth
      ctx.fillStyle = '#ff3366';
      ctx.beginPath();
      ctx.arc(0, mouthY + mh * 0.5, 8, 0, Math.PI);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12, mouthY - 2, 24, 7);
    }
    ctx.restore(); // creator restore

    // Neon Clickbait Red Arrow pointing to mouth
    if (!crashed) {
      ctx.save();
      const arrowPulse = Math.sin(now * 0.01) * 6;
      ctx.translate(monX + monW * 0.78 + arrowPulse, monY + monH * 0.42);
      ctx.rotate(-0.4);
      ctx.fillStyle = COLOURS.redArrow;
      ctx.strokeStyle = COLOURS.neonYellow;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(0, -22);
      ctx.lineTo(0, -10);
      ctx.lineTo(-65, -10);
      ctx.lineTo(-65, 10);
      ctx.lineTo(0, 10);
      ctx.lineTo(0, 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bold Clickbait text sticker: "NOT CLICKBAIT!!"
      ctx.font = '900 24px Impact, system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('GONE WRONG?!', -80, -40);
      ctx.fillText('GONE WRONG?!', -80, -40);
      ctx.restore();
    }

    // Crashed Cursed Frame Watermark / Overlay
    if (crashed) {
      ctx.fillStyle = 'rgba(255, 0, 50, 0.28)';
      ctx.fillRect(monX, monY, monW, monH);
      ctx.font = '900 36px Impact, system-ui, sans-serif';
      ctx.fillStyle = '#ff2a5f';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.textAlign = 'center';
      ctx.strokeText('CURSED FRAME LOCKED FOREVER', monX + monW * 0.5, monY + monH * 0.48);
      ctx.fillText('CURSED FRAME LOCKED FOREVER', monX + monW * 0.5, monY + monH * 0.48);
    }

    // Cashed out celebration shine
    if (cashed) {
      ctx.fillStyle = 'rgba(0, 255, 136, 0.16)';
      ctx.fillRect(monX, monY, monW, monH);
      ctx.font = '900 38px Impact, system-ui, sans-serif';
      ctx.fillStyle = '#00ff88';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.textAlign = 'center';
      ctx.strokeText('★ 10/10 VIRAL BANGER PUBLISHED! ★', monX + monW * 0.5, monY + monH * 0.5);
      ctx.fillText('★ 10/10 VIRAL BANGER PUBLISHED! ★', monX + monW * 0.5, monY + monH * 0.5);
    }

    ctx.restore(); // monitor clip restore

    // Timeline Scrubber Bar below Monitor
    const timeX = 180;
    const timeY = 412;
    const timeW = 600;
    const timeH = 34;

    ctx.fillStyle = COLOURS.timeline;
    ctx.fillRect(timeX, timeY, timeW, timeH);
    ctx.strokeStyle = COLOURS.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(timeX, timeY, timeW, timeH);

    // Audio waveform simulation inside scrubber
    const bars = 48;
    for (let i = 0; i < bars; i++) {
      const bx = timeX + 6 + (i * (timeW - 12)) / bars;
      const bHeight = 4 + 14 * Math.abs(Math.sin(i * 0.6 + view.elapsed * 0.003));
      ctx.fillStyle = i % 2 === 0 ? '#384166' : '#4d5985';
      ctx.fillRect(bx, timeY + (timeH - bHeight) * 0.5, 6, bHeight);
    }

    // Playhead Scrubber needle jumping rapidly
    const scrubProgress = running ? ((view.elapsed * 0.001 * (1 + tension * 4)) % 1) : crashed ? 0.88 : cashed ? 0.5 : 0.05;
    const scrubX = timeX + scrubProgress * (timeW - 8);

    ctx.fillStyle = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.neonYellow;
    ctx.fillRect(scrubX, timeY - 4, 6, timeH + 8);

    // Playhead head marker
    ctx.beginPath();
    ctx.moveTo(scrubX - 5, timeY - 4);
    ctx.lineTo(scrubX + 11, timeY - 4);
    ctx.lineTo(scrubX + 3, timeY + 6);
    ctx.closePath();
    ctx.fill();

    // Floating Giant Multiplier readout over the bottom right of the canvas
    ctx.textAlign = 'right';
    ctx.font = `900 ${48 + Math.floor(depth * 14)}px ui-monospace, monospace`;
    ctx.fillStyle = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.text;
    ctx.shadowColor = crashed ? '#ff003b' : cashed ? '#00ff88' : '#ffe600';
    ctx.shadowBlur = running ? 14 : 0;
    ctx.fillText(formatX(view.currentX100), 910, 436);
    ctx.shadowBlur = 0;

    // Milestone Caption & Status
    const passed = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const caption = passed?.[1] ?? (running ? 'Scrubbing for viral thumbnail...' : crashed ? 'Double-chin frame forever immortalized.' : 'Set your stake to scrub');

    ctx.textAlign = 'center';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonYellow;
    ctx.fillText(caption, 480, 468);

    // Bottom Stake & Payout Line
    const [line, lineCol] = stakeLine(view);
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillStyle = lineCol;
    ctx.fillText(line, 480, 498);

    ctx.restore();
  }

  return { draw };
}
