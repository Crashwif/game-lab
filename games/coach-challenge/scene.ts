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
  bgTop: '#0b101d',
  bgFloor: '#d98b3a',
  woodPlank1: '#d28033',
  woodPlank2: '#df9547',
  courtLine: '#ffffff',
  courtBorder: '#992211',
  jumboBg: '#080d1a',
  jumboBorder: '#2a3b5c',
  jumboGlow: '#00e5ff',
  jerseyYellow: '#f5b000',
  jerseyTrim: '#542583',
  refStripes: '#111111',
  accent: '#38bdf8',
  crashed: '#ef4444',
  cashedOut: '#22c55e',
  text: '#f8fafc',
  muted: '#94a3b8',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Player swears on everything he never touched him'],
  [150, 'Coach hesitates with the red challenge beacon'],
  [200, 'Bench squad starts waving towels in panic'],
  [250, 'Ref puts on headset with cold indifferent glare'],
  [300, 'Arena jumbo screen begins 4K slow motion replay'],
  [500, 'Assistant coaches frantically scramble tablets'],
  [1000, 'Crowd boos shake the entire hardwood floor'],
  [10000, 'Review booth enters dramatic frame-by-frame zoom'],
  [100000, 'Ref walks to center court mic under blinding light'],
  [1000000, 'Overturned call triggers confetti and coach hugs'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Call Overturned at ${formatX(view.cashoutX100)}! · Bench goes wild`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Whistle stands · No credits risked' : 'Spectating sideline · Ready to challenge', COLOURS.muted];
  }
  if (crashed) return [`Foul upheld! Ref burned your ${credits(view.stake)}`, COLOURS.crashed];
  return [`Review active · ${credits(view.stake)} on the line`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'trap', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let previousSqueak = 0;

  function drawHardwood(ctx: CanvasRenderingContext2D): void {
    const floorY = 320;
    const grad = ctx.createLinearGradient(0, floorY, 0, 540);
    grad.addColorStop(0, '#bd6f26');
    grad.addColorStop(1, '#8e4b10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, floorY, 960, 220);

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let y = floorY; y < 540; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Sideline out of bounds border & court arc
    ctx.fillStyle = COLOURS.courtBorder;
    ctx.fillRect(0, floorY, 960, 24);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, floorY + 24);
    ctx.lineTo(960, floorY + 24);
    ctx.stroke();

    // 3-point painted key line in perspective
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(480, 580, 230, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  function drawCrowdAndJumbotron(ctx: CanvasRenderingContext2D, view: SceneView, tension: number): void {
    // Arena stands gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 320);
    sky.addColorStop(0, '#060a12');
    sky.addColorStop(0.7, '#111b2e');
    sky.addColorStop(1, '#1a243a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 320);

    // Crowd silhouettes bobbing
    const crowdBob = Math.sin(view.elapsed * 0.008) * (3 + tension * 6);
    ctx.fillStyle = '#0a101d';
    for (let i = 0; i < 28; i++) {
      const cx = i * 36 + 10;
      const cy = 290 + Math.sin(i * 1.7 + view.elapsed * 0.006) * 4 + (i % 2 === 0 ? crowdBob : -crowdBob);
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overhead Jumbotron Screen
    const screenW = 440;
    const screenH = 150;
    const screenX = (960 - screenW) / 2;
    const screenY = 28;

    // Cables & Rigging
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screenX + 40, 0);
    ctx.lineTo(screenX + 40, screenY);
    ctx.moveTo(screenX + screenW - 40, 0);
    ctx.lineTo(screenX + screenW - 40, screenY);
    ctx.stroke();

    // Monitor frame
    ctx.fillStyle = COLOURS.jumboBg;
    ctx.strokeStyle = view.phase === 'crashed' ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.jumboBorder;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenW, screenH, 12);
    ctx.fill();
    ctx.stroke();

    // Scanlines & arena broadcast header
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let sy = screenY + 2; sy < screenY + screenH; sy += 4) {
      ctx.fillRect(screenX + 4, sy, screenW - 8, 2);
    }

    // Top ticker bar on monitor
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(screenX + 6, screenY + 6, screenW - 12, 24);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('OFFICIAL REVIEW // CAM 04 - ULTRA SLOW-MO 4K', screenX + 16, screenY + 22);

    // Red challenge light pulse on top of monitor
    const lampGlow = Math.sin(view.elapsed * 0.015) > 0 ? 1 : 0.2;
    ctx.fillStyle = view.phase === 'crashed' ? '#ef4444' : view.cashoutX100 !== null ? '#22c55e' : `rgba(239, 68, 68, ${lampGlow})`;
    ctx.beginPath();
    ctx.arc(480, screenY, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCoachAndRef(ctx: CanvasRenderingContext2D, view: SceneView, tension: number): void {
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    // COACH (Sideline Left, x ~ 270)
    const coachX = 270;
    const coachY = 380;
    // Coach body (Suit)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(coachX, coachY + 30, 24, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    // Coach tie
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(coachX - 4, coachY + 8);
    ctx.lineTo(coachX + 4, coachY + 8);
    ctx.lineTo(coachX + 2, coachY + 38);
    ctx.lineTo(coachX - 2, coachY + 38);
    ctx.fill();
    // Coach head
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.arc(coachX, coachY - 8, 16, 0, Math.PI * 2);
    ctx.fill();
    // Coach hair (graying)
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(coachX, coachY - 14, 16, Math.PI, Math.PI * 2);
    ctx.fill();

    // Coach arm: if cashed out, spinning challenge finger; else clutching clipboard
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (cashed) {
      const twirl = Math.sin(view.elapsed * 0.02) * 14;
      ctx.moveTo(coachX + 16, coachY + 12);
      ctx.lineTo(coachX + 32 + twirl, coachY - 30);
      ctx.stroke();
      // Raised twirling index finger
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(coachX + 32 + twirl, coachY - 32, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(coachX + 10, coachY + 15);
      ctx.lineTo(coachX + 28, coachY + 22);
      ctx.stroke();
      // Red challenge beacon/flag in hand
      ctx.fillStyle = crashed ? '#475569' : '#ef4444';
      ctx.fillRect(coachX + 24, coachY + 8, 14, 20);
    }

    // REFEREE (Sideline Right, x ~ 690)
    const refX = 690;
    const refY = 370;
    // Referee shirt stripes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(refX, refY + 32, 22, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.refStripes;
    for (let ox = -14; ox <= 14; ox += 7) {
      ctx.fillRect(refX + ox, refY - 4, 3, 76);
    }
    // Referee Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(refX, refY - 8, 15, 0, Math.PI * 2);
    ctx.fill();
    // Ref headset
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(refX, refY - 10, 17, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();

    // Referee arms gesture
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    if (crashed) {
      // Ejection / Foul upheld technical "T" sign
      ctx.moveTo(refX - 24, refY + 10);
      ctx.lineTo(refX + 24, refY + 10);
      ctx.moveTo(refX, refY + 10);
      ctx.lineTo(refX, refY + 36);
      ctx.stroke();
    } else if (cashed) {
      // Sweeping arms "Overturned / Incomplete" safe signal
      ctx.moveTo(refX - 28, refY + 12);
      ctx.lineTo(refX + 28, refY + 12);
      ctx.stroke();
    } else {
      // One hand listening to headset with cold glare
      ctx.moveTo(refX - 10, refY + 20);
      ctx.lineTo(refX - 16, refY - 6);
      ctx.stroke();
    }
  }

  function drawKneelingForward(ctx: CanvasRenderingContext2D, view: SceneView, tension: number): void {
    // The player: center kneeling forward pleading at coach (x ~ 480, y ~ 420)
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const shake = tension * Math.sin(view.elapsed * 0.04) * 2;
    const px = 480 + shake;
    const py = 410;

    // Shadow on court
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(px, py + 52, 54, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Knees & legs folded on hardwood
    ctx.fillStyle = '#78350f'; // Dark skin tone
    ctx.beginPath();
    ctx.ellipse(px - 26, py + 44, 14, 10, 0.2, 0, Math.PI * 2);
    ctx.ellipse(px + 26, py + 44, 14, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Kneepads
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(px - 28, py + 42, 10, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(px + 28, py + 42, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Torso / Jersey (Gold & Purple #23)
    ctx.fillStyle = COLOURS.jerseyYellow;
    ctx.beginPath();
    ctx.roundRect(px - 30, py - 18, 60, 54, [14, 14, 4, 4]);
    ctx.fill();
    // Jersey trim
    ctx.strokeStyle = COLOURS.jerseyTrim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(px, py - 18, 16, 0, Math.PI);
    ctx.stroke();

    // Jersey number "23"
    ctx.fillStyle = COLOURS.jerseyTrim;
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('23', px, py + 16);

    // Arms: Pleading prayer hands or grasping coach
    const armBob = Math.sin(view.elapsed * 0.015) * 6;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (cashed) {
      // Arms raised celebrating
      ctx.moveTo(px - 26, py - 4);
      ctx.lineTo(px - 42, py - 46);
      ctx.moveTo(px + 26, py - 4);
      ctx.lineTo(px + 42, py - 46);
      ctx.stroke();
    } else if (crashed) {
      // Head in hands / disbelief
      ctx.moveTo(px - 26, py - 4);
      ctx.lineTo(px - 14, py - 38);
      ctx.moveTo(px + 26, py - 4);
      ctx.lineTo(px + 14, py - 38);
      ctx.stroke();
    } else {
      // Clasped pleading hands stretched out forward to coach
      ctx.moveTo(px - 26, py - 4);
      ctx.lineTo(px - 48 + armBob, py - 10);
      ctx.moveTo(px + 26, py - 4);
      ctx.lineTo(px - 44 + armBob, py - 12);
      ctx.stroke();
    }

    // Head
    const headY = py - 42;
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(px, headY, 22, 0, Math.PI * 2);
    ctx.fill();

    // Headband
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(px - 22, headY - 14, 44, 9, 4);
    ctx.fill();

    // Panicked sweating eyes & expression
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - 8, headY + 2, 6, 0, Math.PI * 2);
    ctx.arc(px + 8, headY + 2, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e1b4b';
    const pupilLookX = cashed ? 0 : -2;
    ctx.beginPath();
    ctx.arc(px - 8 + pupilLookX, headY + 2, 3, 0, Math.PI * 2);
    ctx.arc(px + 8 + pupilLookX, headY + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Sweat drops flying as tension escalates
    if (view.phase === 'running') {
      const dropCount = Math.floor(2 + tension * 6);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      for (let d = 0; d < dropCount; d++) {
        const dropX = px + Math.sin(view.elapsed * 0.02 + d * 1.5) * 32;
        const dropY = headY - 6 - (view.elapsed * 0.06 + d * 18) % 36;
        ctx.beginPath();
        ctx.arc(dropX, dropY, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);

    audio.update(view.phase, tension);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    const squeakStep = Math.floor(view.elapsed / 650);

    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.9);
      audio.fx('airhorn', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('whistle', 1.0);
      audio.fx('boo', 0.85);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('whistle', 0.5);
      }
      if (squeakStep > previousSqueak && !cashed) {
        audio.fx('squeak', 0.25 + 0.45 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;
    previousSqueak = squeakStep;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.5) ** 2 : tension * 1.8 * Math.sin(view.elapsed * 0.05);

    ctx.save();
    ctx.translate(shake * Math.sin(age * 55), shake * Math.cos(age * 45));

    // Base basketball arena visuals
    drawCrowdAndJumbotron(ctx, view, tension);
    drawHardwood(ctx);
    drawCoachAndRef(ctx, view, tension);
    drawKneelingForward(ctx, view, tension);

    // Multiplier display inside Jumbotron Screen
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tint = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.accent;
    ctx.fillStyle = tint;
    ctx.font = '900 66px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 102, 400);

    // Sub-banner in monitor: status / outcome
    ctx.font = '700 16px system-ui, sans-serif';
    if (crashed) {
      ctx.fillStyle = COLOURS.crashed;
      ctx.fillText('DEFINITIVE WRIST SLAP CONFIRMED // TECH FOUL', 480, 145);
    } else if (cashed) {
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.fillText('CALL OVERTURNED! OUT OF BOUNDS DEFENSE!', 480, 145);
    } else {
      ctx.fillStyle = COLOURS.muted;
      ctx.fillText('VIDEO REVIEW IN PROGRESS...', 480, 145);
    }

    // Game Title & Milestones HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('COACH CHALLENGE', 34, 46);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('PLEAD FOR THE OVERTURN BEFORE THE WHISTLE STANDS', 34, 68);

    // Milestone ticker caption
    const passed = running ? MILESTONES[milestone - 1] : undefined;
    const statusText = passed?.[1] ?? (crashed ? 'Foul Call Upheld by Officials' : cashed ? 'Challenge Successful!' : 'Awaiting Next Whistle');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 276, 860);

    // Bottom Stake Line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(line, 480, 508, 860);

    // Crash Red Overlay Flash
    if (crashed && age < 0.6) {
      const flash = (1 - age / 0.6) * 0.35;
      ctx.fillStyle = `rgba(239, 68, 68, ${flash})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // Cashed out green confetti burst
    if (cashed && view.cashoutX100 !== null) {
      const confCount = 20;
      for (let c = 0; c < confCount; c++) {
        const cx = 320 + ((c * 47 + view.elapsed * 0.2) % 360);
        const cy = 200 + ((c * 31 + view.elapsed * 0.15) % 280);
        ctx.fillStyle = c % 2 === 0 ? '#22c55e' : '#eab308';
        ctx.fillRect(cx, cy, 6, 10);
      }
    }

    ctx.restore();
  }

  return { draw };
}
