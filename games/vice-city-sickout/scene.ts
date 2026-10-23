/**
 * Vice City Sickout - Scene Presentation
 * Fake your cough, dodge your boss on Teams, and grind launch day.
 */
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
  [120, 'Drafting fake mild cough email to HR'],
  [150, 'Auto-reply on: Out of pocket until 2028'],
  [200, 'Nationwide US productivity drops $100M'],
  [250, 'Manager Slack icon turns ominous yellow'],
  [300, 'Spill energy drink over keyboard during heist'],
  [500, "Boss sends 'Quick 5 min sync?' invite"],
  [1000, 'US GDP losses breach the $1B threshold'],
  [10000, 'Entire corporate floor is completely ghosted'],
  [100000, 'Congress debates federal launch day holiday'],
  [1000000, 'Global economy fully re-indexed in Vice bucks'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Forged note verified at ${formatX(view.cashoutX100)} · Speeding to Vice Shores!`, '#2de2e6'];
  }
  if (view.stake === null) {
    return [crashed ? 'Watched the bust · 0 credits lost' : 'Watching the sickout · no credits riding', '#9d9db2'];
  }
  if (crashed) {
    return [`Fired on Slack live stream! Lost ${credits(view.stake)}`, '#ff3864'];
  }
  return [`Grinding sick leave · ${credits(view.stake)} riding on launch day`, '#f6019d'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastNotificationTime = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    // Audio triggers
    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('engine', 0.9);
      audio.fx('kaching', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('door', 1.0);
      audio.fx('camera', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('notify', 0.8);
      }
      if (now - lastNotificationTime > Math.max(700, 3200 - tension * 2400)) {
        lastNotificationTime = now;
        audio.fx('notify', 0.45 + 0.45 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeS = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeS / 0.6) ** 2 : running ? tension * 1.8 : 0;
    const t = now * 0.003;

    ctx.save();
    // Screen shake
    if (shake > 0) {
      ctx.translate((Math.sin(t * 37) + Math.cos(t * 61)) * shake * 0.5, (Math.cos(t * 43)) * shake * 0.5);
    }

    // --- 1. Synthwave Background & Room ---
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, '#0d0221');
    bgGrad.addColorStop(0.5, '#240046');
    bgGrad.addColorStop(1, '#11011e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Large window to Vice City (X: 180 to 780, Y: 40 to 320)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(160, 36, 640, 280, 16);
    ctx.clip();

    // Outside sunset
    const sky = ctx.createLinearGradient(0, 36, 0, 316);
    sky.addColorStop(0, '#0f051d');
    sky.addColorStop(0.4, '#791e94');
    sky.addColorStop(0.7, '#f6019d');
    sky.addColorStop(1, '#ff8b00');
    ctx.fillStyle = sky;
    ctx.fillRect(160, 36, 640, 280);

    // Big 80s sun
    const sunX = 480;
    const sunY = 190;
    const sunGrad = ctx.createLinearGradient(0, 100, 0, 250);
    sunGrad.addColorStop(0, '#ffe600');
    sunGrad.addColorStop(1, '#ff007f');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 65, 0, Math.PI * 2);
    ctx.fill();

    // Sun stripes
    ctx.fillStyle = '#791e94';
    for (let i = 0; i < 6; i++) {
      const sy = 175 + i * 11;
      ctx.fillRect(sunX - 70, sy, 140, 2 + i * 1.2);
    }

    // Distant Neon Skyscrapers
    ctx.fillStyle = '#1a0033';
    const bldgs = [
      [170, 70, 45], [225, 110, 35], [270, 85, 50], [330, 140, 40],
      [580, 130, 40], [630, 95, 48], [690, 120, 38], [740, 75, 45],
    ];
    for (const [bx, bh, bw] of bldgs) {
      ctx.fillRect(bx, 316 - bh, bw, bh);
      // Windows
      ctx.fillStyle = '#2de2e6';
      for (let wy = 316 - bh + 10; wy < 310; wy += 14) {
        if ((bx + wy) % 7 === 0) ctx.fillRect(bx + 6, wy, bw - 12, 3);
      }
      ctx.fillStyle = '#1a0033';
    }

    // Palm Tree silhouettes
    const drawPalm = (px: number, py: number, scale: number) => {
      ctx.fillStyle = '#0a0015';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 10 * scale, py - 40 * scale, px + 15 * scale, py - 80 * scale);
      ctx.lineWidth = 5 * scale;
      ctx.strokeStyle = '#0a0015';
      ctx.stroke();
      for (let a = -1.2; a <= 1.2; a += 0.5) {
        ctx.beginPath();
        ctx.moveTo(px + 15 * scale, py - 80 * scale);
        ctx.quadraticCurveTo(px + (15 + Math.cos(a) * 35) * scale, py - (80 - Math.sin(a) * 20) * scale, px + (15 + Math.cos(a) * 50) * scale, py - (65 - Math.sin(a) * 20) * scale);
        ctx.stroke();
      }
    };
    drawPalm(200, 316, 0.9);
    drawPalm(750, 316, 1.1);

    // Neon grid perspective ground
    ctx.strokeStyle = 'rgba(45, 226, 230, 0.4)';
    ctx.lineWidth = 1.5;
    for (let gy = 260; gy < 320; gy += 10) {
      ctx.beginPath();
      ctx.moveTo(160, gy);
      ctx.lineTo(800, gy);
      ctx.stroke();
    }
    const gridSpeed = (view.elapsed * 0.05) % 25;
    for (let gx = -60; gx <= 700; gx += 25) {
      ctx.beginPath();
      ctx.moveTo(480, 240);
      ctx.lineTo(160 + gx + gridSpeed, 320);
      ctx.stroke();
    }

    // Window frame border
    ctx.restore();
    ctx.strokeStyle = '#4717f6';
    ctx.lineWidth = 6;
    ctx.strokeRect(160, 36, 640, 280);

    // --- 2. Couch & Protagonist / Vehicle ---
    if (!cashedOut) {
      // Living Room Sofa & Sweat-soaked Gamer
      const couchY = 320;
      // Sofa back
      ctx.fillStyle = '#1c0b2b';
      ctx.beginPath();
      ctx.roundRect(310, couchY, 340, 130, 24);
      ctx.fill();
      ctx.fillStyle = '#2b1042';
      ctx.fillRect(325, couchY + 15, 310, 80);

      // Gamer Body (Sweating on couch clutching pastel controller)
      const bob = Math.sin(view.elapsed * 0.008) * (2 + tension * 4);
      const gamerX = 470;
      const gamerY = couchY + 30 + bob;

      // Pajamas (pastel cyan with flamingo pattern)
      ctx.fillStyle = '#05d9e8';
      ctx.beginPath();
      ctx.roundRect(gamerX - 45, gamerY + 20, 90, 70, 16);
      ctx.fill();

      // Gamer Head
      ctx.fillStyle = '#ffcf99';
      ctx.beginPath();
      ctx.arc(gamerX, gamerY, 26, 0, Math.PI * 2);
      ctx.fill();

      // Messy launch day hair
      ctx.fillStyle = '#ff007f';
      ctx.beginPath();
      ctx.arc(gamerX, gamerY - 10, 26, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();

      // Headset
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(gamerX, gamerY - 4, 28, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.arc(gamerX - 27, gamerY - 4, 8, 0, Math.PI * 2);
      ctx.arc(gamerX + 27, gamerY - 4, 8, 0, Math.PI * 2);
      ctx.fill();

      // Sweating drops
      if (tension > 0.2) {
        ctx.fillStyle = '#67e8f9';
        const sweatRate = (now * 0.005) % 1;
        ctx.beginPath();
        ctx.arc(gamerX + 24, gamerY + 6 + sweatRate * 18, 3.5, 0, Math.PI * 2);
        ctx.arc(gamerX - 22, gamerY + 12 + ((sweatRate + 0.5) % 1) * 16, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Gamer hands holding glowing pastel controller
      const padY = gamerY + 54;
      ctx.fillStyle = '#ff71ce';
      ctx.beginPath();
      ctx.roundRect(gamerX - 24, padY, 48, 26, 10);
      ctx.fill();
      // Glowing thumbsticks / buttons
      ctx.fillStyle = '#01cdfe';
      ctx.beginPath();
      ctx.arc(gamerX - 12, padY + 12, 5, 0, Math.PI * 2);
      ctx.arc(gamerX + 12, padY + 12, 5, 0, Math.PI * 2);
      ctx.fill();

      // Coffee table with Frantic Laptop & Energy Drink
      ctx.fillStyle = '#150024';
      ctx.fillRect(350, 430, 260, 25);

      // Laptop (blinking frantic Slack / Teams notifications)
      ctx.fillStyle = '#4a4e69';
      ctx.fillRect(490, 390, 75, 45); // Screen
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(493, 393, 69, 39);
      // Screen code & Teams notification glow
      ctx.fillStyle = (Math.floor(now / 200) % 2 === 0) ? '#ff0055' : '#00f0ff';
      ctx.fillRect(500, 398, 55, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(500, 408, 40, 4);
      ctx.fillRect(500, 416, 48, 4);

      // Energy Drink can
      ctx.fillStyle = '#05ffa1';
      ctx.fillRect(455, 405, 14, 25);
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(455, 412, 14, 6);

      // Notification Popups Floating Around
      if (running) {
        const dmMessages = [
          'Boss: "Quick sync?"',
          'Slack: @channel 🚨',
          'HR: "Submit Note"',
          'VP: "Where r u?"',
        ];
        const msgIdx = Math.floor(view.elapsed / 1200) % dmMessages.length;
        const msg = dmMessages[msgIdx] ?? 'Teams: Ping!';
        ctx.fillStyle = 'rgba(30, 10, 50, 0.9)';
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 2;
        const popY = 350 - (Math.sin(now * 0.005) * 8);
        ctx.beginPath();
        ctx.roundRect(580, popY, 170, 32, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffe600';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(msg, 592, popY + 20);
      }
    } else {
      // CASHOUT ESCAPE: Open-world neon sports car peeling off into the sunset!
      const carX = 480 + Math.sin(now * 0.006) * 20;
      const carY = 360;

      // Speed lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const lx = 200 + ((now * 0.8 + i * 110) % 560);
        ctx.beginPath();
        ctx.moveTo(lx, carY + 30 + (i % 3) * 15);
        ctx.lineTo(lx + 40, carY + 30 + (i % 3) * 15);
        ctx.stroke();
      }

      // Sports Car Body
      ctx.fillStyle = '#ff007f';
      ctx.beginPath();
      ctx.moveTo(carX - 110, carY + 35);
      ctx.lineTo(carX - 70, carY - 5);
      ctx.lineTo(carX + 40, carY - 8);
      ctx.lineTo(carX + 90, carY + 15);
      ctx.lineTo(carX + 115, carY + 35);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Windshield & Neon sunglasses gamer
      ctx.fillStyle = '#11011e';
      ctx.beginPath();
      ctx.moveTo(carX - 45, carY - 3);
      ctx.lineTo(carX + 25, carY - 5);
      ctx.lineTo(carX + 15, carY + 15);
      ctx.lineTo(carX - 45, carY + 15);
      ctx.closePath();
      ctx.fill();

      // Sunglasses spark
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(carX - 15, carY + 4, 18, 6);

      // Wheels
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(carX - 65, carY + 38, 18, 0, Math.PI * 2);
      ctx.arc(carX + 65, carY + 38, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(carX - 65, carY + 38, 8, 0, Math.PI * 2);
      ctx.arc(carX + 65, carY + 38, 8, 0, Math.PI * 2);
      ctx.fill();

      // Forged Medical Note Flying Banner
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(carX - 190, carY - 35, 120, 36, 6);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.font = '800 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FORGED FLU.PDF', carX - 130, carY - 20);
      ctx.fillStyle = '#16a34a';
      ctx.font = '700 10px system-ui';
      ctx.fillText('✓ APPROVED', carX - 130, carY - 7);
    }

    // --- 3. Crash Overlay: Webcam Live & Boss Kick-In ---
    if (crashed) {
      // Red siren flash
      const flashAlpha = Math.max(0, 0.45 * Math.sin(crashAgeS * 14) * clamp01(1.8 - crashAgeS));
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 0, 50, ${flashAlpha})`;
        ctx.fillRect(0, 0, 960, 540);
      }

      // Webcam frame pop: Live to 200 coworkers
      ctx.save();
      const camW = 340;
      const camH = 190;
      const camX = 480 - camW / 2;
      const camY = 160;

      ctx.fillStyle = 'rgba(10, 5, 20, 0.92)';
      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(camX, camY, camW, camH, 12);
      ctx.fill();
      ctx.stroke();

      // Red recording pill
      ctx.fillStyle = '#ff0033';
      ctx.beginPath();
      ctx.arc(camX + 22, camY + 22, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('LIVE WEBCAM • SLACK HUDDLE (214)', camX + 36, camY + 26);

      // Caught gamer face wearing neon pit-viper shades
      ctx.fillStyle = '#ffcf99';
      ctx.beginPath();
      ctx.arc(480, camY + 95, 36, 0, Math.PI * 2);
      ctx.fill();
      // Neon Pit-viper shades
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.roundRect(455, camY + 84, 50, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(458, camY + 86, 44, 4);
      // Jaw dropped mouth
      ctx.fillStyle = '#4a0000';
      ctx.beginPath();
      ctx.ellipse(480, camY + 115, 9, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      // HR Subpoena stamp
      ctx.save();
      ctx.translate(camX + camW - 55, camY + camH - 35);
      ctx.rotate(-0.25);
      ctx.fillStyle = '#ff0055';
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 2;
      ctx.strokeRect(-45, -16, 90, 32);
      ctx.font = '900 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SUBPOENA', 0, 5);
      ctx.restore();

      ctx.restore();
    }

    // --- 4. HUD Readouts: Title, GDP Ticker, Multiplier & Milestones ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & GDP loss ticker
    ctx.font = '900 32px ui-monospace, system-ui, sans-serif';
    ctx.fillStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 10;
    ctx.fillText('VICE CITY SICKOUT', 480, 26);
    ctx.shadowBlur = 0;

    // GDP Loss tracker
    const gdpLost = (Math.max(1, (view.currentX100 - 100) * 0.28) * (1 + depth * 15)).toFixed(1);
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillStyle = '#05ffa1';
    ctx.fillText(`⚡ US GDP PRODUCTIVITY LOSS: -$${gdpLost}B ⚡`, 480, 48);

    // Huge multiplier center
    const multColor = crashed ? '#ff3864' : cashedOut ? '#05ffa1' : '#ffe600';
    ctx.fillStyle = multColor;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = running ? 14 : 6;
    ctx.font = '900 68px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 108);
    ctx.shadowBlur = 0;

    // Milestone / Status bar
    const milestoneText = running && milestoneIdx > 0
      ? (MILESTONES[milestoneIdx - 1]?.[1] ?? '')
      : crashed
      ? 'BUSTED BY HR MID-SLACK HUDDLE!'
      : cashedOut
      ? 'SAFE AT VICE SHORES · LAUNCH DAY SECURED'
      : 'Hold couch position · Don’t open Slack';

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText(milestoneText, 480, 475);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(line, 480, 508);

    ctx.restore();
  }

  return { draw };
}
