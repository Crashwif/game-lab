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
  bgTop: '#08140c',
  bgBot: '#030805',
  xboxGreen: '#107c10',
  emeraldGlow: '#00ff73',
  gold: '#ffcf33',
  padPaper: '#f2ede0',
  padBorder: '#1c3d22',
  ink: '#092113',
  stampRed: '#e53935',
  textLight: '#f4fdf6',
  muted: '#85a890',
  crashed: '#ff4d6d',
  cashedOut: '#38ef7d',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Golden Xbox logo watermark glazes the note'],
  [150, 'Diagnosis written: Acute controller thumb'],
  [200, 'HR bot sends first verification email chime'],
  [250, "Khaled stamps 'WE THE BEST EXCUSE' on wax"],
  [300, 'Supervisor calls the fake clinic front desk'],
  [500, 'Auto-reply blast excuses your entire department'],
  [1000, 'Khaled drops an airhorn sample into the call'],
  [10000, 'CEO accepts the slip and joins your party lobby'],
  [100000, 'Federal government declares GTA release holiday'],
  [1000000, 'Prescription canonized into labor law eternity'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Prescription faxed at ${formatX(view.cashoutX100)} · Booting Vice City guilt-free!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Watched HR storm the clinic · no credits risked' : 'Spectating the clinic · no credits riding', COLOURS.muted];
  }
  if (crashed) return [`Supervisor busted your forged excuse · ${credits(view.stake)} seized`, COLOURS.crashed];
  return [`Dr. Khaled signing for you · ${credits(view.stake)} riding`, COLOURS.emeraldGlow];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'trap', crash: 'scratch' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;

  function drawKhaled(ctx: CanvasRenderingContext2D, x: number, y: number, bob: number, tension: number, crashed: boolean) {
    ctx.save();
    ctx.translate(x, y + bob);

    // Designer Lab Coat & Shoulders
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(0, 70, 75, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lapels & Green Emerald Trim
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLOURS.xboxGreen;
    ctx.beginPath();
    ctx.moveTo(-35, 30);
    ctx.lineTo(-12, 100);
    ctx.moveTo(35, 30);
    ctx.lineTo(12, 100);
    ctx.stroke();

    // Gold Chain & Giant Xbox Jewel Medallion
    ctx.strokeStyle = COLOURS.gold;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 35, 30, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.fillStyle = COLOURS.gold;
    ctx.beginPath();
    ctx.arc(0, 68, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#107c10';
    ctx.beginPath();
    ctx.arc(0, 68, 9, 0, Math.PI * 2);
    ctx.fill();
    // Xbox X on medallion
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-5, 63);
    ctx.lineTo(5, 73);
    ctx.moveTo(5, 63);
    ctx.lineTo(-5, 73);
    ctx.stroke();

    // Stethoscope around neck
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 20, 42, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#b77342'; // warm skin tone
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair fade & signature sharp beard
    ctx.fillStyle = '#1a120b';
    ctx.beginPath();
    ctx.arc(0, -18, 37, Math.PI, 0); // top hair
    ctx.fill();
    // Beard
    ctx.beginPath();
    ctx.moveTo(-35, -2);
    ctx.quadraticCurveTo(-32, 42, 0, 45);
    ctx.quadraticCurveTo(32, 42, 35, -2);
    ctx.lineTo(24, 0);
    ctx.quadraticCurveTo(18, 25, 0, 27);
    ctx.quadraticCurveTo(-18, 25, -24, 0);
    ctx.closePath();
    ctx.fill();

    // Sunglasses
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-28, -12, 23, 14, 3);
    ctx.roundRect(5, -12, 23, 14, 3);
    ctx.fill();
    ctx.strokeStyle = COLOURS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(5, -6);
    ctx.stroke();

    // Arm holding giant emerald stylus / pen
    const armAngle = crashed ? -0.8 : Math.sin(tension * 25) * 0.25;
    ctx.save();
    ctx.translate(35, 45);
    ctx.rotate(armAngle);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, -10, 40, 20);
    // Green Xbox Stylus
    ctx.fillStyle = COLOURS.emeraldGlow;
    ctx.fillRect(36, -4, 30, 8);
    ctx.fillStyle = COLOURS.gold;
    ctx.beginPath();
    ctx.moveTo(66, -4);
    ctx.lineTo(76, 0);
    ctx.lineTo(66, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawPrescriptionPad(ctx: CanvasRenderingContext2D, x: number, y: number, view: SceneView, tension: number) {
    ctx.save();
    ctx.translate(x, y);

    // Pad shadow & backing
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(-146, -114, 296, 232);

    ctx.fillStyle = '#0f2415';
    ctx.fillRect(-150, -120, 300, 234);

    // Medical Note Sheet
    ctx.fillStyle = COLOURS.padPaper;
    ctx.fillRect(-142, -112, 284, 218);

    // Pad Header
    ctx.fillStyle = COLOURS.xboxGreen;
    ctx.fillRect(-142, -112, 284, 36);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL EXCUSE · DR. KHALED CLINIC', 0, -89);

    // Xbox Watermark in center
    ctx.strokeStyle = `rgba(16, 124, 16, ${0.12 + 0.25 * tension})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 10, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-28, -14);
    ctx.quadraticCurveTo(0, 10, 28, 34);
    ctx.moveTo(28, -14);
    ctx.quadraticCurveTo(0, 10, -28, 34);
    ctx.stroke();

    // Patient Fields
    ctx.fillStyle = COLOURS.ink;
    ctx.textAlign = 'left';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('PATIENT: CERTIFIED VICE GAMER', -130, -56);
    ctx.fillText('DIAGNOSIS: ACUTE CONTROLLER THUMB', -130, -36);
    ctx.fillText('RX: 72H UNINTERRUPTED CONSOLE REST', -130, -16);
    ctx.fillText('REFILLS: "ANOTHER ONE" (UNLIMITED)', -130, 4);

    // Animated Khaled signature scribble
    ctx.strokeStyle = '#005a18';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-125, 45);
    const scribbleProgress = Math.min(1, view.currentX100 / 300);
    const scribbleLen = 140 * scribbleProgress;
    for (let i = 0; i < scribbleLen; i += 6) {
      ctx.lineTo(-125 + i, 45 + Math.sin(i * 0.4 + view.elapsed * 0.01) * 8);
    }
    ctx.stroke();

    // Gold Wax Seal / We The Best Stamp
    if (view.currentX100 >= 250) {
      ctx.save();
      ctx.translate(75, 45);
      ctx.fillStyle = COLOURS.stampRed;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLOURS.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WE THE', 0, -4);
      ctx.fillText('BEST', 0, 6);
      ctx.restore();
    }

    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);

    audio.update(view.phase, tension);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('scratch', previousPhase === null || view.crashAge > 1500);
      audio.fx('phone', 0.9);
    }
    if (running && previousPhase === 'running' && milestone > previousMilestone) {
      audio.milestone(milestone);
      if (milestone >= 7) audio.fx('airhorn', 0.9);
      else audio.fx('notify', 0.6);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;

    ctx.save();
    ctx.fillStyle = COLOURS.bgTop;
    ctx.fillRect(0, 0, 960, 540);

    // Studio Background with ambient neon lighting
    const grad = ctx.createRadialGradient(480, 200, 50, 480, 270, 450);
    grad.addColorStop(0, crashed ? 'rgba(255, 50, 80, 0.22)' : `rgba(0, 255, 115, ${0.12 + 0.2 * tension})`);
    grad.addColorStop(1, 'rgba(3, 8, 5, 0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);

    ctx.translate(shake * Math.sin(crashAgeSec * 60), shake * Math.cos(crashAgeSec * 45));

    // Green soundwave bars behind Khaled
    ctx.fillStyle = `rgba(16, 124, 16, ${0.25 + 0.4 * tension})`;
    for (let i = 0; i < 28; i++) {
      const h = 20 + Math.sin(view.elapsed * 0.007 + i * 0.6) * (18 + 50 * tension);
      ctx.fillRect(120 + i * 26, 190 - h / 2, 8, h);
    }

    // Protagonist & Medical Pad
    const bob = running ? Math.sin(view.elapsed * 0.006) * (4 + 6 * tension) : 0;
    drawKhaled(ctx, 310, 280, bob, tension, crashed);
    drawPrescriptionPad(ctx, 640, 285, view, tension);

    // HR Notification Feed on Top-Right
    if (view.currentX100 >= 200) {
      ctx.save();
      ctx.translate(760, 95);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = crashed ? COLOURS.crashed : COLOURS.gold;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-120, -25, 240, 50, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.gold;
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText(crashed ? 'HR SUPERVISOR CONNECTED' : 'INCOMING CLINIC INQUIRY', -108, -8);
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.fillText(crashed ? '"ANOTHER ONE?! YOU ARE FIRED!"' : '"Verifying Dr. Khaled signature..."', -108, 10);
      ctx.restore();
    }

    // Cashout overlay celebration: Vice City boot-up seal
    if (view.cashoutX100 !== null) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, 960, 540);

      ctx.translate(480, 260);
      ctx.rotate(-0.06);
      ctx.fillStyle = 'rgba(16, 124, 16, 0.95)';
      ctx.strokeStyle = COLOURS.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-260, -60, 520, 120, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLOURS.gold;
      ctx.textAlign = 'center';
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.fillText('EXCUSE FAXED & VERIFIED!', 0, -14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(`VICE CITY LOADED AT ${formatX(view.cashoutX100)} · CONSOLE ONLINE`, 0, 24);
      ctx.restore();
    }

    // Crash overlay
    if (crashed) {
      ctx.fillStyle = 'rgba(235, 30, 60, 0.25)';
      ctx.fillRect(0, 0, 960, 540);

      ctx.save();
      ctx.translate(480, 260);
      ctx.fillStyle = 'rgba(20, 10, 15, 0.92)';
      ctx.strokeStyle = COLOURS.crashed;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-280, -65, 560, 130, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLOURS.crashed;
      ctx.textAlign = 'center';
      ctx.font = '900 32px system-ui, sans-serif';
      ctx.fillText('HR RAIDED THE LIVING ROOM!', 0, -16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillText("Khaled yelled 'ANOTHER ONE!' directly into the supervisor's phone", 0, 22);
      ctx.restore();
    }

    // HUD Header & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Tagline
    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillText('DR. XBOX SICK NOTE', 480, 36);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('DJ KHALED PRESCRIBES ANOTHER DAY OFF FOR VICE CITY', 480, 64);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.emeraldGlow;
    ctx.fillStyle = multColor;
    ctx.font = '900 74px ui-monospace, monospace';
    ctx.shadowColor = multColor;
    ctx.shadowBlur = running ? 14 : 4;
    ctx.fillText(formatX(view.currentX100), 480, 142);
    ctx.shadowBlur = 0;

    // Milestone Caption
    const currentMilestoneText = running && milestone > 0 ? (MILESTONES[milestone - 1]?.[1] ?? '') : '';
    ctx.fillStyle = COLOURS.textLight;
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(currentMilestoneText, 480, 460);

    // Stake Line
    const [statusText, statusCol] = stakeLine(view);
    ctx.fillStyle = statusCol;
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 502);

    ctx.restore();
  }

  return { draw };
}
