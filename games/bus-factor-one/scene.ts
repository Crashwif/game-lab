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
  skySunny: '#7ed6df',
  patioFloor: '#f6e58d',
  patioAwning: '#ff7979',
  deckWood: '#d35400',
  zenBody: '#48dbfb',
  coffee: '#6ab04c',
  hqWall: '#1e272e',
  hqAlarm: '#eb2f06',
  screenGlow: '#00d2d3',
  text: '#ffffff',
  muted: '#c7d2fe',
  accent: '#f9ca24',
  crashed: '#ff3838',
  cashedOut: '#2ed573',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Boss leaves first polite voicemail at 9:07am'],
  [150, 'Portal login displays warning: 12 hours left'],
  [200, "Henderson account spams 'Is she there?' in caps"],
  [250, 'Missed call counter flips past 20 notifications'],
  [300, 'CEO sprints down the hall with printed spreadsheets'],
  [500, 'Desk phone vibrates completely off the oak desk'],
  [1000, 'Boss calls vendor hotline with 8 minutes left'],
  [10000, 'Executive suite approves five-figure raise instantly'],
  [100000, 'HR hires two assistants just to monitor her seat'],
  [1000000, 'CEO texts: Everything is fine enjoy your weekend'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`DND ACTIVE · Five-figure raise secured at ${formatX(view.cashoutX100)}!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Vendor expired at midnight · Watching only' : 'Watching patio feed · No credits placed', COLOURS.muted];
  }
  if (crashed) {
    return [`Server locked down! ${credits(view.stake)} lost to the void`, COLOURS.crashed];
  }
  return [`Relaxing on veranda · ${credits(view.stake)} riding on Monday raise`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'elevator', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastPhoneBuzz = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Trigger audio cues
    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
      audio.fx('notify', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.85);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('phone', 0.7);
      }
      if (now - lastPhoneBuzz > Math.max(400, 1600 - tension * 1200) && view.cashoutX100 === null) {
        audio.fx('buzz', 0.3 + 0.5 * tension);
        lastPhoneBuzz = now;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAge = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAge / 0.6) ** 2 : (running ? tension * 2.5 : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.05), shake * Math.cos(now * 0.04));

    // 1. LEFT SIDE: Zen Veranda (0 to 480)
    ctx.fillStyle = COLOURS.skySunny;
    ctx.fillRect(0, 0, 480, 540);

    // Warm sun & subtle rays
    ctx.fillStyle = 'rgba(255, 234, 167, 0.6)';
    ctx.beginPath();
    ctx.arc(80, 70, 55, 0, Math.PI * 2);
    ctx.fill();

    // Patio floor
    ctx.fillStyle = COLOURS.patioFloor;
    ctx.fillRect(0, 360, 480, 180);
    ctx.strokeStyle = '#eccc68';
    ctx.lineWidth = 3;
    for (let lx = 0; lx <= 480; lx += 60) {
      ctx.beginPath();
      ctx.moveTo(lx, 360);
      ctx.lineTo(lx - 40, 540);
      ctx.stroke();
    }

    // Patio umbrella / shade
    ctx.fillStyle = COLOURS.patioAwning;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(440, 0);
    ctx.lineTo(390, 80);
    ctx.lineTo(40, 80);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let s = 60; s < 400; s += 80) {
      ctx.fillRect(s, 0, 40, 75);
    }

    // Reclining Zen Deck Chair & Person
    const sipAnim = view.cashoutX100 !== null ? Math.sin(now * 0.005) * 6 : 0;
    ctx.strokeStyle = COLOURS.deckWood;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(90, 430);
    ctx.lineTo(190, 390);
    ctx.lineTo(260, 440);
    ctx.stroke();

    // Zen employee body
    ctx.fillStyle = COLOURS.zenBody;
    ctx.beginPath();
    ctx.ellipse(190, 385 - sipAnim * 0.5, 45, 18, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Head with sunglasses
    ctx.fillStyle = '#ffdfba';
    ctx.beginPath();
    ctx.arc(245, 345 - sipAnim, 22, 0, Math.PI * 2);
    ctx.fill();
    // Cool sunglasses
    ctx.fillStyle = '#222f3e';
    ctx.fillRect(240, 340 - sipAnim, 16, 7);
    ctx.fillRect(222, 340 - sipAnim, 14, 7);
    // Chill smile
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(240, 355 - sipAnim, 6, 0.1, Math.PI * 0.8);
    ctx.stroke();

    // Side table with iced latte
    ctx.fillStyle = '#b71540';
    ctx.fillRect(290, 400, 70, 8);
    ctx.fillRect(320, 408, 10, 45);

    // Iced latte glass
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(300, 365, 20, 35);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(302, 375, 16, 23);
    // Straw
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(312, 375);
    ctx.lineTo(view.cashoutX100 !== null ? 255 : 325, view.cashoutX100 !== null ? 353 : 345);
    ctx.stroke();

    // Phone on patio table vibrating with Do Not Disturb badge
    const phoneVibe = running && view.cashoutX100 === null ? Math.sin(now * 0.08) * (2 + tension * 4) : 0;
    ctx.save();
    ctx.translate(335 + phoneVibe, 388);
    ctx.fillStyle = '#2f3542';
    ctx.fillRect(-10, -18, 20, 34);
    ctx.fillStyle = view.cashoutX100 !== null ? '#2ed573' : '#a4b0be';
    ctx.fillRect(-8, -15, 16, 26);
    // DND moon icon
    ctx.fillStyle = '#57606f';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. RIGHT SIDE: Corporate HQ Meltdown (480 to 960)
    const alarmFlash = (crashed || running) ? (Math.sin(now * (0.01 + tension * 0.02)) > 0 ? 0.35 + tension * 0.3 : 0.05) : 0.05;
    ctx.fillStyle = COLOURS.hqWall;
    ctx.fillRect(480, 0, 480, 540);

    // Flashing red emergency lighting
    ctx.fillStyle = `rgba(235, 47, 6, ${alarmFlash})`;
    ctx.fillRect(480, 0, 480, 540);

    // Server racks & monitors
    ctx.fillStyle = '#0a0d10';
    ctx.fillRect(520, 160, 110, 260);
    ctx.fillRect(810, 160, 120, 260);
    // Server blinking LEDs
    for (let sy = 180; sy < 400; sy += 22) {
      const ledOn = Math.sin(sy * 8 + now * 0.01) > 0;
      ctx.fillStyle = crashed ? '#ff4757' : (ledOn ? '#2ed573' : '#eccc68');
      ctx.fillRect(530, sy, 8, 8);
      ctx.fillRect(545, sy, 8, 8);
      ctx.fillRect(820, sy, 8, 8);
      ctx.fillRect(835, sy, 8, 8);
    }

    // Giant Corporate Wall Clock: 11:59 countdown
    ctx.fillStyle = '#222f3e';
    ctx.beginPath();
    ctx.arc(710, 120, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.crashed : '#f1f2f6';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Clock hands ticking frantically
    const secondHand = (now * (0.005 + tension * 0.025)) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(710, 120);
    ctx.lineTo(710 + Math.cos(secondHand) * 36, 120 + Math.sin(secondHand) * 36);
    ctx.strokeStyle = '#eb2f06';
    ctx.stroke();

    // Corporate Oak Desk with exploding missed calls
    ctx.fillStyle = '#574b90';
    ctx.fillRect(630, 360, 160, 18);
    ctx.fillRect(650, 378, 16, 70);
    ctx.fillRect(754, 378, 16, 70);

    // Desk phone vibrating wildly
    const deskPhoneShake = running ? Math.sin(now * 0.09) * (4 + tension * 12) : (crashed ? 25 : 0);
    ctx.save();
    ctx.translate(700 + deskPhoneShake, 340 + (crashed ? 40 : 0));
    ctx.fillStyle = '#ced6e0';
    ctx.fillRect(-16, -12, 32, 24);
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(0, 0, 7 + (tension * 5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Flying paper spreadsheets across office
    if (running || crashed) {
      const paperCount = Math.floor(5 + tension * 15);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let p = 0; p < paperCount; p++) {
        const px = 550 + ((p * 73 + now * (0.08 + tension * 0.2)) % 360);
        const py = 180 + ((p * 47 + Math.sin(now * 0.004 + p) * 80) % 200);
        ctx.fillRect(px, py, 14, 18);
      }
    }

    // Panicked CEO or Shredder collapse
    if (crashed) {
      // CEO collapsed on shredder in despair
      ctx.fillStyle = '#747d8c';
      ctx.fillRect(690, 400, 60, 45); // shredder
      ctx.fillStyle = '#ff4757';
      ctx.fillText('SHREDDER', 720, 425);
      // CEO torso slumped
      ctx.fillStyle = '#2f3542';
      ctx.beginPath();
      ctx.ellipse(710, 385, 28, 18, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffdfba';
      ctx.beginPath();
      ctx.arc(685, 380, 15, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Frantic executive pacing
      const paceX = 720 + Math.sin(now * 0.006 * (1 + tension * 2)) * 60;
      ctx.fillStyle = '#2f3542';
      ctx.fillRect(paceX - 10, 270, 20, 55);
      ctx.fillStyle = '#ffdfba';
      ctx.beginPath();
      ctx.arc(paceX, 255, 14, 0, Math.PI * 2);
      ctx.fill();
      // Flailing arms
      ctx.strokeStyle = '#ffdfba';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(paceX - 10, 280);
      ctx.lineTo(paceX - 25, 250 + Math.sin(now * 0.02) * 20);
      ctx.moveTo(paceX + 10, 280);
      ctx.lineTo(paceX + 25, 250 - Math.sin(now * 0.02) * 20);
      ctx.stroke();
    }

    // Dividing split-screen border
    ctx.strokeStyle = '#2f3542';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(480, 0);
    ctx.lineTo(480, 540);
    ctx.stroke();

    // 3. TOP BANNER / HUD
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(480 - 190, 14, 380, 52, 14);
    ctx.fill();
    ctx.fillStyle = COLOURS.accent;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('BUS FACTOR ONE', 480, 32);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('DO NOT DISTURB ON · VENDOR DEADLINE TICKING', 480, 52);

    // Multiplier Centerpiece Box
    const boxY = 88;
    ctx.fillStyle = crashed ? 'rgba(235, 47, 6, 0.9)' : (view.cashoutX100 !== null ? 'rgba(46, 213, 115, 0.9)' : 'rgba(26, 36, 43, 0.9)');
    ctx.beginPath();
    ctx.roundRect(480 - 150, boxY, 300, 72, 18);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.screenGlow);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${crashed ? 54 : 50}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, boxY + 36);

    // Missed Call Counter Badge on right
    const missedCalls = Math.min(99, Math.floor(tension * 50 + depth * 49));
    ctx.fillStyle = '#eb2f06';
    ctx.beginPath();
    ctx.roundRect(750, 20, 170, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(`📞 MISSED CALLS: ${running || crashed ? missedCalls : 0}`, 835, 38);

    // Bottom Story milestone banner
    const passed = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const bannerText = crashed
      ? 'MIDNIGHT STRIKES: CLIENT VENDOR CONTRACT EXPIRED · TOTAL LOCKOUT'
      : (passed ? passed[1] : (view.phase === 'betting' ? 'Ready on the veranda · Boss has not noticed yet' : 'Waiting for round to begin'));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(40, 460, 880, 38, 12);
    ctx.fill();
    ctx.fillStyle = crashed ? '#ff6b81' : (view.cashoutX100 !== null ? '#7bed9f' : '#e0e7ff');
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 479, 850);

    // Stake line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 518, 900);

    // Cashout Direct-Deposit Celebratory Notification Overlay
    if (view.cashoutX100 !== null && !crashed) {
      ctx.fillStyle = 'rgba(46, 213, 115, 0.95)';
      ctx.beginPath();
      ctx.roundRect(240, 180, 480, 70, 16);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#0a3d62';
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.fillText('🔔 DIRECT DEPOSIT: EMERGENCY RAISE APPROVED', 480, 204);
      ctx.fillStyle = '#1e3799';
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText(`Locked in at ${formatX(view.cashoutX100 ?? 100)} · Enjoy your weekend!`, 480, 232);
    }

    ctx.restore();
  }

  return { draw };
}
