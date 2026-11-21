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
  [120, 'Faking slight mic lag on the greeting'],
  [150, 'Intentional robot voice noises activated'],
  [200, 'Webcam frame dropped to three frames a second'],
  [250, "Stammering through yesterday's blocker excuses"],
  [300, 'Adding fake keyboard typing clatter in bg'],
  [500, 'Scrum master squinting intensely at the camera'],
  [1000, 'Screen shared accidental shopping cart tab'],
  [10000, 'Entire team waiting in dead awkward silence'],
  [100000, 'VP of Engineering unexpectedly joins call'],
  [1000000, 'Transcended sprint boundaries into pure stealth'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Left call at ${formatX(view.cashoutX100)} · Router excuse delivered safely!`, '#34d399'];
  }
  if (view.stake === null) {
    return [crashed ? 'Standup ended · Lurking without stakes' : 'Lurking on mute · No credits risked', '#94a3b8'];
  }
  if (crashed) return [`Busted! Mic blew hot · Lost ${credits(view.stake)}`, '#f87171'];
  return [`Dodging accountability · ${credits(view.stake)} at stake`, '#67e8f9'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'elevator', crash: 'trombone' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let prevGlitchTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    // Cues
    if (prevPhase !== null && running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('notify', 0.85);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('trombone', prevPhase === null || view.crashAge > 1500);
      audio.fx('gasp', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneCount > prevMilestone) audio.milestone(milestoneCount);
      const glitchTick = Math.floor(view.elapsed / 600);
      if (glitchTick > prevGlitchTick && !cashedOut && Math.random() < 0.45) {
        audio.fx('buzz', 0.35 + 0.45 * tension);
      }
      prevGlitchTick = glitchTick;
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneCount;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : (running ? Math.sin(now * 0.04) * tension * 2.5 : 0);

    ctx.save();
    // Screen-shake offset
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // App Frame Background (Video Meeting Dark UI)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 960, 540);

    // Top Meeting Header Bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 960, 48);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🔴 REC  |  Daily Sprint Standup (Sprint 42)', 24, 30);
    ctx.textAlign = 'right';
    const elapsedSec = Math.floor(view.elapsed / 1000);
    const timerStr = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Duration: ${timerStr}  •  7 Participants`, 936, 30);

    // Grid Layout: Left Column (3 attendee tiles) + Main Tile (Protagonist)
    // Attendee 1: Scrum Master
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(24, 60, 200, 126, 8);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(124, 115, 30, 0, Math.PI * 2);
    ctx.fill();
    // SM Glasses and squinting expression
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(108, 105, 12, 10);
    ctx.fillRect(128, 105, 12, 10);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, 110); ctx.lineTo(128, 110);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Dave (Scrum Master)', 32, 174);
    if (tension > 0.4 && running) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('🤨 ?!', 180, 88);
    }

    // Attendee 2: Dev holding coffee
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(24, 196, 200, 126, 8);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(124, 250, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(144, 256, 14, 18); // coffee mug
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Sarah (Backend)', 32, 310);

    // Attendee 3: Cat avatar / Silent PM
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(24, 332, 200, 126, 8);
    ctx.fill();
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(124, 386, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(124, 390, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(depth > 0.6 ? 'VP of Eng (Joined)' : 'Alex (Product)', 32, 446);

    // MAIN WEBCAM TILE (The Protagonist)
    const mainX = 240;
    const mainY = 60;
    const mainW = 696;
    const mainH = 398;
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(mainX, mainY, mainW, mainH, 10);
    ctx.fill();
    ctx.strokeStyle = crashed ? '#ef4444' : (cashedOut ? '#10b981' : (tension > 0.6 ? '#f59e0b' : '#3b82f6'));
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inside protagonist webcam
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mainX, mainY, mainW, mainH, 10);
    ctx.clip();

    // Bedroom background inside feed
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(mainX, mainY, mainW, mainH);
    // Unmade bed / background poster
    ctx.fillStyle = '#312e81';
    ctx.fillRect(mainX + 40, mainY + 80, 130, 200);
    ctx.fillStyle = '#4338ca';
    ctx.fillRect(mainX + 50, mainY + 100, 110, 80);

    // Protagonist remote worker
    const centerX = mainX + mainW / 2;
    const centerY = mainY + mainH / 2 + 30;

    if (!cashedOut) {
      // Pajamas (striped or dotted messy shirt)
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 130, 100, 70, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pajama stars/dots
      ctx.fillStyle = '#34d399';
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(centerX + i * 24, centerY + 110 + (Math.abs(i) % 2) * 12, 6, 6);
      }

      // Head
      ctx.fillStyle = '#fdba74';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 30, 52, 0, Math.PI * 2);
      ctx.fill();

      // Messy bed-head hair
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 8, 56, Math.PI, Math.PI * 2);
      ctx.lineTo(centerX + 58, centerY + 24);
      ctx.lineTo(centerX - 58, centerY + 24);
      ctx.fill();
      // Wild hair spikes
      ctx.beginPath();
      ctx.moveTo(centerX - 40, centerY - 20); ctx.lineTo(centerX - 60, centerY - 45); ctx.lineTo(centerX - 20, centerY - 35);
      ctx.moveTo(centerX + 10, centerY - 30); ctx.lineTo(centerX + 25, centerY - 55); ctx.lineTo(centerX + 40, centerY - 30);
      ctx.fill();

      // Giant gaming headset
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(centerX, centerY + 22, 58, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(centerX - 66, centerY + 14, 16, 32);
      ctx.fillRect(centerX + 50, centerY + 14, 16, 32);

      // Facial expressions
      if (crashed) {
        // CAUGHT RED HANDED: Eyes wide open, mouth stuffed with chips
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX - 18, centerY + 26, 12, 0, Math.PI * 2);
        ctx.arc(centerX + 18, centerY + 26, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - 18, centerY + 26, 4, 0, Math.PI * 2);
        ctx.arc(centerX + 18, centerY + 26, 4, 0, Math.PI * 2);
        ctx.fill();

        // Stuffed bulging cheeks & mouth chewing chips
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY + 58, 26, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bright yellow chip bag in hand!
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.roundRect(centerX + 48, centerY + 40, 70, 95, 8);
        ctx.fill();
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('CRUNCH', centerX + 54, centerY + 90);

        // Chip crumbs bursting out
        ctx.fillStyle = '#fde047';
        for (let c = 0; c < 8; c++) {
          const crumbAngle = c * 0.8 + crashAgeSec * 3;
          const crumbDist = 30 + (c * 7);
          ctx.fillRect(centerX + Math.cos(crumbAngle) * crumbDist, centerY + 56 + Math.sin(crumbAngle) * 15, 6, 6);
        }
      } else {
        // Running or waiting: Frozen mid-sentence face
        const freezeStep = running ? Math.floor(view.elapsed / (1000 / Math.max(3, 15 - tension * 12))) : 0;
        const mouthOpen = (freezeStep % 2 === 0);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(centerX - 16, centerY + 28, 5, 0, Math.PI * 2);
        ctx.arc(centerX + 16, centerY + 28, 5, 0, Math.PI * 2);
        ctx.fill();

        // Stammering mouth
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        if (mouthOpen) {
          ctx.ellipse(centerX, centerY + 54, 12, 10, 0, 0, Math.PI * 2);
        } else {
          ctx.rect(centerX - 12, centerY + 52, 24, 4);
        }
        ctx.fill();
      }

      // Robotic Static Glitch Layers & Buffering Ring when escalating
      if (running && !crashed) {
        if (tension > 0.15) {
          // Horizontal scanline glitches
          const glitches = Math.floor(tension * 12);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
          for (let g = 0; g < glitches; g++) {
            const gy = mainY + ((view.elapsed * 0.7 + g * 53) % mainH);
            const gh = 2 + (g % 5);
            ctx.fillRect(mainX, gy, mainW, gh);
          }
        }
        // Spinning buffer spinner
        const spinSpeed = (view.elapsed * 0.008) * (1 + tension * 4);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(centerX, centerY - 10, 36, spinSpeed, spinSpeed + 4.5);
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AUDIO BUFFERING...', centerX, centerY - 55);
      }
    } else {
      // CASHED OUT: Safe disconnect screen!
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(mainX, mainY, mainW, mainH);
      ctx.fillStyle = '#34d399';
      ctx.font = '700 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DISCONNECTED FROM CALL', centerX, centerY - 30);
      ctx.fillStyle = '#a7f3d0';
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillText("Slack sent: 'Hey team, Wi-Fi router rebooting! Posting async.'", centerX, centerY + 10);
      ctx.fillStyle = '#6ee7b7';
      ctx.font = '600 15px monospace';
      ctx.fillText('✓ STANDUP AVOIDED CLEANLY', centerX, centerY + 45);
    }
    ctx.restore();

    // Hot mic / 4K Banner on crash
    if (crashed) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      ctx.fillRect(mainX, mainY + 12, mainW, 46);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎙️ MIC UNMUTED IN 4K 60FPS LOSSLESS AUDIO: *LOUD CRUNCHING*', mainX + mainW / 2, mainY + 41);
    }

    // Name tag badge on protagonist tile
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(mainX + 16, mainY + mainH - 42, 280, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const netState = crashed ? '🔴 HOT MIC ON' : (cashedOut ? '⚪ Disconnected' : (tension > 0.5 ? '⚠️ Unstable Connection' : '📶 Connected'));
    ctx.fillText(`You (Dev) • ${netState}`, mainX + 26, mainY + mainH - 22);

    // Center Stage Multiplier HUD (Big Overlay at top center of webcam)
    const multColor = crashed ? '#f87171' : (cashedOut ? '#34d399' : '#67e8f9');
    ctx.fillStyle = multColor;
    ctx.font = 'bold 54px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(formatX(view.currentX100), mainX + mainW / 2, mainY + 95);

    // Milestone Caption Badge
    const passed = running ? MILESTONES[milestoneCount - 1] : undefined;
    const bannerText = crashed
      ? 'CAUGHT CRUNCHING CHIPS ON OPEN MIC!'
      : (passed ? passed[1] : (cashedOut ? 'Clean getaway! Sprint backlog dodged.' : 'Waiting for your turn to speak...'));

    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.beginPath();
    ctx.roundRect(mainX + 60, mainY + mainH - 95, mainW - 120, 38, 8);
    ctx.fill();
    ctx.strokeStyle = multColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bannerText, mainX + mainW / 2, mainY + mainH - 71);

    // BOTTOM CONFERENCE CONTROL BAR
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 470, 960, 70);

    // Mic & Cam round buttons
    const drawPillBtn = (bx: number, by: number, label: string, bg: string, textCol: string) => {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(bx, by, 110, 40, 20);
      ctx.fill();
      ctx.fillStyle = textCol;
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, bx + 55, by + 25);
    };

    drawPillBtn(24, 485, crashed ? '🎙️ Unmuted' : '🔇 Muted', crashed ? '#ef4444' : '#334155', '#ffffff');
    drawPillBtn(146, 485, '📹 Video', '#334155', '#ffffff');
    drawPillBtn(268, 485, '💬 Chat (4)', '#334155', '#ffffff');

    // Stake line status info in bottom control bar center
    const [line, color] = stakeLine(view);
    ctx.fillStyle = color;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(line, 410, 510);

    // Comical Leave Call button at far right
    ctx.fillStyle = cashedOut ? '#059669' : '#dc2626';
    ctx.beginPath();
    ctx.roundRect(810, 485, 126, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cashedOut ? '✓ ESCAPED' : 'LEAVE CALL', 873, 510);

    ctx.restore();
  }

  return { draw };
}
