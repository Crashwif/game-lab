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
  bg: '#0f172a',
  panel: '#1e293b',
  panelBorder: '#334155',
  accent: '#38bdf8',
  text: '#f8fafc',
  muted: '#94a3b8',
  crashed: '#f43f5e',
  cashedOut: '#34d399',
  alert: '#fbbf24',
  tileBg: '#090d16',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Recruiter screen passes with enthusiastic nod'],
  [150, 'Hiring manager praises resume formatting'],
  [200, 'Technical whiteboard prompt asks for a linked list'],
  [250, 'Culture fit round tests synergy alignment'],
  [300, 'Take-home test takes over entire weekend'],
  [500, 'Executive VP conducts unexpected behavioral quiz'],
  [1000, 'Bar raiser demands hypothetical system redesign'],
  [10000, 'Coffee chat with the board of directors begins'],
  [100000, 'Comp committee deliberates stock option package'],
  [1000000, 'Named co-founder by unanimous boardroom vote'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.25 * pop * pop)}px ui-sans-serif, system-ui, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  if (view.cashoutX100 !== null) {
    return [`Offer signed at ${formatX(view.cashoutX100)}! Onboarding begins Monday`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [view.phase === 'crashed' ? 'Meeting terminated · Watching from lobby' : 'Observing interview room', COLOURS.muted];
  }
  if (view.phase === 'crashed') {
    return [`Auto-rejected: ${credits(view.stake)} lost to the ATS void`, COLOURS.crashed];
  }
  return [`In the gauntlet · ${credits(view.stake)} riding on culture fit`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', crash: 'scratch' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let prevBuzzSec = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('ding', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('scratch', prevPhase === null || view.crashAge > 1500);
      audio.fx('door', 0.8);
    }
    if (running && prevPhase === 'running') {
      if (milestoneCount > prevMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('notify', 0.7);
      }
      const buzzSec = Math.floor(view.elapsed / 650);
      if (buzzSec > prevBuzzSec) {
        audio.fx('tick', 0.25 + 0.5 * tension);
        prevBuzzSec = buzzSec;
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneCount;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 10 * clamp01(1 - crashSec / 0.5) ** 2 : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.06) : 0);

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);
    ctx.translate(shake * Math.sin(crashSec * 80), shake * Math.cos(crashSec * 60));

    // Conference Window Chrome
    ctx.fillStyle = COLOURS.panel;
    ctx.fillRect(16, 12, 928, 40);
    ctx.strokeStyle = COLOURS.panelBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 12, 928, 40);

    // Recording pill
    ctx.fillStyle = running ? '#ef4444' : COLOURS.muted;
    ctx.beginPath();
    ctx.arc(38, 32, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = COLOURS.text;
    ctx.fillText('REC', 52, 36);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Round 8: Final Culture Alignment & Synergistic Whiteboard Session (Internal Only)', 90, 36);
    const attendeeCount = 3 + Math.min(12, milestoneCount * 2);
    ctx.fillText(`👥 ${attendeeCount} panelists`, 830, 36);

    // Grid layout: 3 Top Interviewer Webcams
    const panelNames = ['Recruiter (Sarah)', 'Tech Lead (Dave)', 'VP Strategy (Brad)'];
    const panelMoods = ['🙂 nodding', '🤨 skeptical', '🥱 checking phone'];
    for (let i = 0; i < 3; i++) {
      const tx = 24 + i * 180;
      const ty = 60;
      const tw = 170;
      const th = 110;
      ctx.fillStyle = COLOURS.tileBg;
      ctx.fillRect(tx, ty, tw, th);
      ctx.strokeStyle = i === (Math.floor(view.elapsed / 900) % 3) && running ? COLOURS.accent : COLOURS.panelBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tx, ty, tw, th);

      // Interviewer avatar
      const bob = Math.sin(view.elapsed * 0.003 + i) * 2;
      ctx.fillStyle = i === 0 ? '#475569' : i === 1 ? '#334155' : '#1e293b';
      ctx.beginPath();
      ctx.arc(tx + tw / 2, ty + 46 + bob, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOURS.muted;
      ctx.beginPath();
      ctx.ellipse(tx + tw / 2, ty + 95 + bob, 38, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Interviewer name tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(tx + 4, ty + th - 22, tw - 8, 18);
      ctx.fillStyle = COLOURS.text;
      ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
      const label = running && tension > 0.4 ? `${panelNames[i]} · ${panelMoods[i]}` : (panelNames[i] ?? '');
      ctx.fillText(label, tx + 8, ty + th - 9);
    }

    // Right Side: Calendar Queued Rounds Widget
    const calX = 580;
    const calY = 60;
    const calW = 360;
    const calH = 110;
    ctx.fillStyle = COLOURS.panel;
    ctx.fillRect(calX, calY, calW, calH);
    ctx.strokeStyle = COLOURS.panelBorder;
    ctx.strokeRect(calX, calY, calW, calH);
    ctx.fillStyle = COLOURS.alert;
    ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('📅 UPCOMING CALENDAR INVITES', calX + 12, calY + 22);

    const pendingStages = [
      'Round 9: Coffee with 4 Board Members (15m)',
      'Round 10: 72hr Take-Home Microservices Overhaul',
      'Round 11: Lunch with the Founder (Vibe Audit)',
    ];
    ctx.font = '400 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    for (let s = 0; s < 3; s++) {
      const text = pendingStages[s] ?? '';
      ctx.fillText(`• ${text}`, calX + 12, calY + 44 + s * 20);
    }

    // Main Candidate Webcam (Center-Left)
    const cX = 24;
    const cY = 180;
    const cW = 530;
    const cH = 270;
    ctx.fillStyle = COLOURS.tileBg;
    ctx.fillRect(cX, cY, cW, cH);
    ctx.strokeStyle = running ? (tension > 0.6 ? COLOURS.alert : COLOURS.accent) : COLOURS.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(cX, cY, cW, cH);

    // Candidate Whiteboard behind him
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(cX + 30, cY + 24, 210, 150);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(cX + 30, cY + 24, 210, 150);

    // Whiteboard doodles
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cX + 50, cY + 60);
    ctx.lineTo(cX + 90, cY + 40);
    ctx.lineTo(cX + 130, cY + 70);
    ctx.lineTo(cX + 180, cY + 45);
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.font = '700 10px monospace';
    ctx.fillText('O(1) SYNERGY', cX + 40, cY + 110);
    ctx.fillStyle = '#1e293b';
    ctx.fillText('BST -> CLOUD LINK', cX + 40, cY + 130);

    // Candidate Character
    const sweatRate = running ? 1 + tension * 4 : 1;
    const candidateBob = running ? Math.sin(view.elapsed * 0.008 * sweatRate) * (3 + tension * 4) : 0;
    const headX = cX + 340;
    const headY = cY + 140 + candidateBob;

    // Body (Business Casual: blue dress shirt)
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.ellipse(headX, headY + 75, 70, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red tie (crooked as tension rises)
    const tieAngle = (Math.sin(view.elapsed * 0.01) * 0.2 + 0.1) * (1 + tension * 2);
    ctx.save();
    ctx.translate(headX, headY + 50);
    ctx.rotate(tieAngle);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.lineTo(10, 60);
    ctx.lineTo(0, 75);
    ctx.lineTo(-10, 60);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(headX, headY, 44, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(headX, headY - 14, 46, Math.PI, 0);
    ctx.fill();

    // Eyeballs & Pupils (darting frantically with tension)
    const eyeDart = running ? Math.sin(view.elapsed * 0.015) * (2 + tension * 5) : 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headX - 16, headY - 6, 9, 0, Math.PI * 2);
    ctx.arc(headX + 16, headY - 6, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(headX - 16 + eyeDart, headY - 6, 4, 0, Math.PI * 2);
    ctx.arc(headX + 16 + eyeDart, headY - 6, 4, 0, Math.PI * 2);
    ctx.fill();

    // Mouth: nervous chatter or shock
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (crashed) {
      // Screaming O mouth
      ctx.fillStyle = '#7f1d1d';
      ctx.arc(headX, headY + 18, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (view.cashoutX100 !== null) {
      // Wide relieved smile
      ctx.arc(headX, headY + 10, 16, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else {
      // Wavy chatter line
      const mouthWobble = Math.sin(view.elapsed * 0.03) * (1 + tension * 3);
      ctx.moveTo(headX - 14, headY + 18);
      ctx.quadraticCurveTo(headX, headY + 18 + mouthWobble, headX + 14, headY + 18);
      ctx.stroke();
    }

    // Flying Sweat Drops
    if (running && tension > 0.15) {
      ctx.fillStyle = '#38bdf8';
      for (let d = 0; d < 4; d++) {
        const dropT = (view.elapsed * 0.003 + d * 0.25) % 1;
        const dropX = headX + (d % 2 === 0 ? 35 : -35) + (d % 2 === 0 ? 1 : -1) * dropT * 40;
        const dropY = headY - 20 + dropT * 60;
        const dropAlpha = 1 - dropT;
        ctx.globalAlpha = dropAlpha;
        ctx.beginPath();
        ctx.arc(dropX, dropY, 3 + tension * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Candidate Webcam Name Tag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(cX + 12, cY + cH - 32, 280, 24);
    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Candidate (You) [Muted by Host]', cX + 20, cY + cH - 16);

    // Multiplier & Status HUD Board (Center-Right)
    const hudX = 580;
    const hudY = 180;
    const hudW = 360;
    const hudH = 270;
    ctx.fillStyle = COLOURS.panel;
    ctx.fillRect(hudX, hudY, hudW, hudH);
    ctx.strokeStyle = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(hudX, hudY, hudW, hudH);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '700 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('OFFER MULTIPLIER', hudX + hudW / 2, hudY + 36);

    const tint = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.accent;
    ctx.fillStyle = tint;
    ctx.font = `800 ${56 * (1 + 0.15 * pop(view.currentX100))}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), hudX + hudW / 2, hudY + 105);

    // Stress Gauge Bar
    const gaugeW = hudW - 48;
    const gaugeX = hudX + 24;
    const gaugeY = hudY + 130;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(gaugeX, gaugeY, gaugeW, 14);
    const grad = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeW, 0);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#fbbf24');
    grad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = grad;
    ctx.fillRect(gaugeX, gaugeY, gaugeW * tension, 14);
    ctx.strokeStyle = COLOURS.panelBorder;
    ctx.strokeRect(gaugeX, gaugeY, gaugeW, 14);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`HR VIBE PRESSURE: ${(tension * 100).toFixed(0)}%`, hudX + hudW / 2, gaugeY + 28);

    // Current Milestone / Status Callout
    const passed = running ? MILESTONES[milestoneCount - 1] : undefined;
    const milestoneText = passed?.[1] ?? (running ? 'Round 1: Screening underway' : 'Awaiting interview panel...');
    ctx.fillStyle = COLOURS.text;
    ctx.font = popFont(600, 14, pop(passed?.[0] ?? 100));
    ctx.fillText(milestoneText, hudX + hudW / 2, hudY + 205, hudW - 20);

    // Bottom Subtitle & Stake Line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = popFont(600, 16, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(line, 480, 485, 900);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('ROUND EIGHT GRIND · Survive the endless panel before the automated ghosting kicks in', 480, 514);

    // CASHOUT OVERLAY: Signed Offer Letter PDF
    if (view.cashoutX100 !== null) {
      const offerAge = (view.elapsed - (view.cashoutX100 ? 0 : 0)) * 0.001;
      const lift = Math.min(1, offerAge * 3);
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(0, 0, 960, 540);

      const docW = 420;
      const docH = 260;
      const docX = 480 - docW / 2;
      const docY = 270 - docH / 2 + (1 - lift) * 30;

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 25;
      ctx.fillRect(docX, docY, docW, docH);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(docX, docY, docW, docH);

      ctx.fillStyle = '#0f172a';
      ctx.font = '800 20px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('OFFICIAL EMPLOYMENT OFFER', 480, docY + 36);

      ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('STATUS: LOCKED IN DIGITAL INK', 480, docY + 62);

      ctx.font = '400 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('Position: Principal Culture & Systems Aligner', 480, docY + 95);
      ctx.fillText(`Base Compensation Multiplier: ${formatX(view.cashoutX100)}`, 480, docY + 118);
      ctx.fillText('Stock Options: Fully Vested on Day One', 480, docY + 140);
      ctx.fillText('Unlimited PTO (Requires VP pre-approval)', 480, docY + 162);

      // Signature line
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(docX + 60, docY + 215);
      ctx.quadraticCurveTo(docX + 140, docY + 195, docX + 220, docY + 215);
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.font = 'italic 700 14px cursive, system-ui';
      ctx.fillText('Digitally Signed by VP & Board', docX + 140, docY + 205);
      ctx.restore();
    }

    // CRASH OVERLAY: Disconnect Notification & No-Reply Ghost Rejection
    if (crashed) {
      ctx.save();
      const fade = Math.min(0.88, crashSec * 2);
      ctx.fillStyle = `rgba(15, 23, 42, ${fade})`;
      ctx.fillRect(0, 0, 960, 540);

      const modalW = 500;
      const modalH = 240;
      const modalX = 480 - modalW / 2;
      const modalY = 270 - modalH / 2;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(modalX, modalY, modalW, modalH);
      ctx.strokeStyle = COLOURS.crashed;
      ctx.lineWidth = 2;
      ctx.strokeRect(modalX, modalY, modalW, modalH);

      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '800 22px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('⚠️ YOU HAVE BEEN REMOVED FROM THE CALL', 480, modalY + 45);

      ctx.fillStyle = COLOURS.text;
      ctx.font = '600 14px ui-monospace, monospace';
      ctx.fillText('New Message: no-reply@synergy-corp.internal', 480, modalY + 85);

      ctx.fillStyle = COLOURS.muted;
      ctx.font = '400 13px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('"Thank you for taking the time to complete all 8 rounds.', 480, modalY + 120);
      ctx.fillText('While your technical feats were undeniably extraordinary,', 480, modalY + 142);
      ctx.fillText('we decided to pivot the role toward someone with more synergy."', 480, modalY + 164);

      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(`Round crashed at ${formatX(view.currentX100)} · Position Closed`, 480, modalY + 205);
      ctx.restore();
    }

    ctx.restore();
  }

  return { draw };
}
