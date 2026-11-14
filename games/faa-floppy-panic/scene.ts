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
  [120, 'CRT monitor flickers green with early blips'],
  [150, 'Cooling fan whines like a jet engine'],
  [200, '5.25 inch floppy drive starts grinding'],
  [250, 'Tower radio fills with frantic chatter'],
  [300, 'Command prompt prints memory buffer errors'],
  [500, 'Radar screen looks like a beehive swarm'],
  [1000, 'Supervisor slams a can of cold cola on desk'],
  [10000, 'Ancient magnetic tape reel unspools on floor'],
  [100000, 'Overheating server glows neon radioactive orange'],
  [1000000, 'Transistor singularity achieved, skies clear!'],
];

const COLOURS = {
  bg: '#080d12',
  consoleBeige: '#c2b294',
  consoleShadow: '#7f7158',
  crtGreen: '#39ff14',
  crtDimGreen: '#185818',
  crtGrid: '#113318',
  alertRed: '#ff2d46',
  cautionAmber: '#ffaa00',
  tapeBrown: '#422415',
  text: '#f2f8fc',
  muted: '#8ba2b5',
  cashedOut: '#44ffaa',
  crashed: '#ff3344',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.28 * pop * pop)}px "Courier New", monospace, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`RUNWAY CLEARED AT ${formatX(view.cashoutX100)} · JET TOUCHED DOWN`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'TOWER BLACKOUT · OBSERVING ONLY' : 'STANDBY · NO FLIGHT MANIFEST FILED', COLOURS.muted];
  }
  if (crashed) return [`MAINFRAME BLEW · ${credits(view.stake)} GROUNDED`, COLOURS.crashed];
  return [`IN THE QUEUE · ${credits(view.stake)} ON THE RADAR`, '#42d8ff'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'static' });
  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let prevKeyClick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('whoosh', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('static', prevPhase === null || view.crashAge > 1500);
      audio.fx('zap', 1.0);
      audio.fx('buzz', 0.85);
    }
    if (running && prevPhase === 'running') {
      if (milestone > prevMilestone) {
        audio.milestone(milestone);
        audio.fx('siren', 0.5 + 0.4 * tension);
      }
      const keyStep = Math.floor(view.elapsed / (160 - 90 * tension));
      if (keyStep > prevKeyClick) {
        audio.fx('click', 0.25 + 0.35 * tension);
        prevKeyClick = keyStep;
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestone;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.6) ** 2 : running ? tension * 2.8 * Math.sin(view.elapsed * 0.05) : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.06) : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(view.elapsed * 0.1), shake * Math.cos(view.elapsed * 0.08));

    // Control Tower 1982 Night Sky & Window
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, '#04070f');
    skyGrad.addColorStop(1, '#131e33');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Distant runway beacon lights
    ctx.fillStyle = '#ff3311';
    for (let i = 0; i < 9; i++) {
      const bx = 160 + i * 80;
      const by = 130 + Math.sin(i * 1.5 + view.elapsed * 0.003) * 6;
      ctx.beginPath();
      ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Window mullions
    ctx.strokeStyle = '#0a1017';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(310, 0); ctx.lineTo(310, 260);
    ctx.moveTo(650, 0); ctx.lineTo(650, 260);
    ctx.moveTo(0, 255); ctx.lineTo(960, 255);
    ctx.stroke();

    // Tower Console Desk & Server Rack
    ctx.fillStyle = COLOURS.consoleBeige;
    ctx.fillRect(40, 230, 880, 280);
    ctx.fillStyle = COLOURS.consoleShadow;
    ctx.fillRect(40, 500, 880, 20);

    // Left Server Rack / Tape Drive
    ctx.fillStyle = '#222830';
    ctx.fillRect(60, 150, 180, 310);
    ctx.strokeStyle = '#444d58';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 150, 180, 310);

    // Tape Reels
    const tapeAngle = (view.elapsed * 0.004 * (1 + 3 * tension)) % (Math.PI * 2);
    for (let reel = 0; reel < 2; reel++) {
      const rx = 150;
      const ry = 210 + reel * 85;
      ctx.fillStyle = COLOURS.tapeBrown;
      ctx.beginPath();
      ctx.arc(rx, ry, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ddd';
      ctx.beginPath();
      ctx.arc(rx, ry, 16, 0, Math.PI * 2);
      ctx.fill();
      // Reel spokes
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(reel === 0 ? tapeAngle : -tapeAngle * 1.2);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 3;
      for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(28 * Math.cos((s * Math.PI * 2) / 3), 28 * Math.sin((s * Math.PI * 2) / 3));
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5.25" Floppy Drive Bay
    ctx.fillStyle = '#111418';
    ctx.fillRect(80, 395, 140, 48);
    // Floppy Slot
    ctx.fillStyle = '#000';
    ctx.fillRect(95, 412, 110, 8);
    // Floppy LED (blinks faster with tension)
    const ledBlink = Math.sin(view.elapsed * (0.01 + 0.03 * tension)) > 0;
    ctx.fillStyle = crashed ? COLOURS.alertRed : ledBlink ? '#ff3b30' : '#440a08';
    ctx.beginPath();
    ctx.arc(88, 416, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8f9da9';
    ctx.font = '9px monospace';
    ctx.fillText('DRIVE A: 5.25"', 125, 435);

    // Main CRT Terminal in Center
    ctx.fillStyle = '#1c1f24';
    ctx.beginPath();
    ctx.roundRect(260, 90, 440, 360, 24);
    ctx.fill();
    ctx.strokeStyle = '#3a3f47';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Curved CRT Screen Glass
    const crtGrad = ctx.createRadialGradient(480, 260, 30, 480, 260, 190);
    if (crashed) {
      crtGrad.addColorStop(0, '#550810');
      crtGrad.addColorStop(1, '#1a0004');
    } else {
      crtGrad.addColorStop(0, '#0f2913');
      crtGrad.addColorStop(1, '#030d06');
    }
    ctx.fillStyle = crtGrad;
    ctx.beginPath();
    ctx.roundRect(280, 110, 400, 300, 16);
    ctx.fill();

    // CRT Radar Grid Rings & Crosshair
    const radarCX = 480;
    const radarCY = 250;
    const radarR = 125;
    ctx.strokeStyle = crashed ? '#441114' : COLOURS.crtGrid;
    ctx.lineWidth = 1.5;
    for (let r = 35; r <= radarR; r += 32) {
      ctx.beginPath();
      ctx.arc(radarCX, radarCY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(radarCX - radarR, radarCY); ctx.lineTo(radarCX + radarR, radarCY);
    ctx.moveTo(radarCX, radarCY - radarR); ctx.lineTo(radarCX, radarCY + radarR);
    ctx.stroke();

    // Radar Sweep Arm
    const sweep = (view.elapsed * 0.0028) % (Math.PI * 2);
    if (!crashed) {
      ctx.save();
      const sweepGrad = ctx.createRadialGradient(radarCX, radarCY, 0, radarCX, radarCY, radarR);
      sweepGrad.addColorStop(0, 'rgba(57, 255, 20, 0.45)');
      sweepGrad.addColorStop(1, 'rgba(57, 255, 20, 0.02)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(radarCX, radarCY);
      ctx.arc(radarCX, radarCY, radarR, sweep - 0.5, sweep);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = COLOURS.crtGreen;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(radarCX, radarCY);
      ctx.lineTo(radarCX + Math.cos(sweep) * radarR, radarCY + Math.sin(sweep) * radarR);
      ctx.stroke();
      ctx.restore();
    }

    // Swarming Radar Flight Blips
    const blipCount = Math.min(36, 4 + Math.floor(depth * 32) + (crashed ? 10 : 0));
    for (let i = 0; i < blipCount; i++) {
      const blipAngle = (i * 137.5 * Math.PI) / 180 + (crashed ? Math.sin(view.elapsed * 0.005 + i) * 2 : view.elapsed * 0.0003 * (i % 2 === 0 ? 1 : -1));
      const dist = 28 + ((i * 29 + (crashed ? view.crashAge * 0.05 : view.elapsed * 0.008)) % (radarR - 18));
      const bx = radarCX + Math.cos(blipAngle) * dist;
      const by = radarCY + Math.sin(blipAngle) * dist;
      ctx.fillStyle = crashed ? COLOURS.alertRed : COLOURS.crtGreen;
      ctx.beginPath();
      ctx.arc(bx, by, crashed ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = crashed ? '#ff8899' : '#88ff88';
        ctx.font = '8px monospace';
        ctx.fillText(`FL${180 + (i % 9) * 20}`, bx + 5, by - 3);
      }
    }

    // CRT Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let sl = 110; sl < 410; sl += 4) {
      ctx.fillRect(280, sl, 400, 2);
    }

    // Right Side: Sweating 1982 ATC Controller
    const ctrlX = 770;
    const ctrlY = 320;
    // Torso / beige short-sleeve shirt with tie
    ctx.fillStyle = '#e8dec8';
    ctx.fillRect(ctrlX - 35, ctrlY, 70, 90);
    ctx.fillStyle = '#22344a'; // dark tie
    ctx.beginPath();
    ctx.moveTo(ctrlX - 6, ctrlY + 12);
    ctx.lineTo(ctrlX + 6, ctrlY + 12);
    ctx.lineTo(ctrlX + 10, ctrlY + 65);
    ctx.lineTo(ctrlX, ctrlY + 75);
    ctx.lineTo(ctrlX - 10, ctrlY + 65);
    ctx.closePath();
    ctx.fill();

    // Controller Head & Expression
    const bobKey = Math.sin(view.elapsed * (0.015 + 0.02 * tension)) * (4 + 6 * tension);
    ctx.fillStyle = '#f5c396';
    ctx.beginPath();
    ctx.arc(ctrlX, ctrlY - 26 + bobKey, 24, 0, Math.PI * 2);
    ctx.fill();

    // Headset
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ctrlX, ctrlY - 28 + bobKey, 26, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#444';
    ctx.fillRect(ctrlX - 29, ctrlY - 32 + bobKey, 8, 16);
    ctx.fillRect(ctrlX + 21, ctrlY - 32 + bobKey, 8, 16);
    // Mic boom
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ctrlX + 25, ctrlY - 24 + bobKey);
    ctx.lineTo(ctrlX + 12, ctrlY - 12 + bobKey);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ctrlX + 10, ctrlY - 12 + bobKey, 3, 0, Math.PI * 2);
    ctx.fill();

    // Sweating drops (frenzy escalates)
    if (running && tension > 0.2) {
      ctx.fillStyle = '#55ccee';
      for (let s = 0; s < 3; s++) {
        const dropY = ((view.elapsed * 0.12 + s * 30) % 45);
        ctx.beginPath();
        ctx.arc(ctrlX + 18 + s * 6, ctrlY - 40 + dropY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Controller Eyes & Mouth
    ctx.fillStyle = '#111';
    if (crashed) {
      // X eyes
      ctx.font = '14px sans-serif';
      ctx.fillText('×', ctrlX - 10, ctrlY - 26 + bobKey);
      ctx.fillText('×', ctrlX + 4, ctrlY - 26 + bobKey);
    } else {
      ctx.beginPath();
      ctx.arc(ctrlX - 8, ctrlY - 27 + bobKey, 2.5 + tension * 1.5, 0, Math.PI * 2);
      ctx.arc(ctrlX + 6, ctrlY - 27 + bobKey, 2.5 + tension * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Keyboard & Furious Hands
    ctx.fillStyle = '#9e8f76';
    ctx.fillRect(ctrlX - 60, 412, 110, 34);
    // Keys
    ctx.fillStyle = '#e2d7c0';
    for (let k = 0; k < 6; k++) {
      ctx.fillRect(ctrlX - 52 + k * 16, 418 + (k % 2 === 0 ? bobKey * 0.4 : -bobKey * 0.4), 12, 9);
    }

    // Gauges: DISK TEMP & FAN RPM
    ctx.fillStyle = '#111';
    ctx.fillRect(290, 420, 180, 20);
    ctx.fillRect(490, 420, 180, 20);
    const tempWidth = 176 * clamp01(tension * 1.2);
    ctx.fillStyle = tension > 0.7 ? COLOURS.alertRed : COLOURS.cautionAmber;
    ctx.fillRect(292, 422, tempWidth, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`DISK TEMP: ${(65 + tension * 120).toFixed(0)}°C`, 300, 434);

    const fanRpm = Math.floor(2200 + tension * 9800);
    ctx.fillText(`FAN: ${fanRpm} RPM`, 500, 434);

    // Overlays: Crash or Cashout Special Escapes
    if (crashed) {
      // Red flash banner & sparks
      ctx.fillStyle = 'rgba(255, 20, 30, 0.45)';
      ctx.fillRect(280, 110, 400, 300);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STACK OVERFLOW', radarCX, 210);
      ctx.font = '18px monospace';
      ctx.fillText('CALL TOWER IMMEDIATELY', radarCX, 245);
      ctx.fillStyle = COLOURS.alertRed;
      ctx.fillText('GROUND STOP ENFORCED', radarCX, 280);

      // Mainframe capacitor spark bursts
      if (crashSec < 1.2) {
        ctx.strokeStyle = '#fffb88';
        ctx.lineWidth = 3;
        for (let sp = 0; sp < 8; sp++) {
          const spAngle = (sp * Math.PI * 2) / 8 + crashSec * 12;
          const dist = 30 + crashSec * 90;
          ctx.beginPath();
          ctx.moveTo(radarCX, radarCY);
          ctx.lineTo(radarCX + Math.cos(spAngle) * dist, radarCY + Math.sin(spAngle) * dist);
          ctx.stroke();
        }
      }
    } else if (cashed) {
      // Parachute escape overlay through window
      ctx.fillStyle = 'rgba(68, 255, 170, 0.18)';
      ctx.fillRect(0, 0, 960, 260);

      // Jet landing smoothly on runway
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✈ PRIVATE JET TOUCHDOWN CONFIRMED ✈', 480, 80);

      // Tiny parachute figure gliding in sky
      const paraX = 520 + Math.sin(view.elapsed * 0.003) * 30;
      const paraY = 120 + ((view.elapsed * 0.02) % 100);
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(paraX, paraY, 14, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(paraX - 14, paraY); ctx.lineTo(paraX, paraY + 16);
      ctx.moveTo(paraX + 14, paraY); ctx.lineTo(paraX, paraY + 16);
      ctx.stroke();
    }

    // Top HUD
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '700 24px monospace';
    ctx.fillText('FAA FLOPPY PANIC // AIR ROUTE TRAFFIC CONTROL 1982', 480, 32);

    // Huge Multiplier Center Screen
    const punch = crashed ? (1 - clamp01((crashSec - 0.12) / 0.25)) ** 2 : 0;
    ctx.fillStyle = crashed ? COLOURS.alertRed : cashed ? COLOURS.cashedOut : COLOURS.crtGreen;
    ctx.font = `700 ${68 * (1 + 0.22 * punch)}px "Courier New", monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 165);

    // Milestone ticker / Subtitle
    const passed = running ? MILESTONES[milestone - 1] : undefined;
    const tickerText = passed?.[1] ?? (running ? 'SECTOR 4 AIRSPACE BUSY · KEEP FAN CLEARED' : '5.25" BOOT DISK INSERTED');
    ctx.fillStyle = COLOURS.muted;
    ctx.font = popFont(600, 17, pop(passed?.[0] ?? 100));
    ctx.fillText(tickerText.toUpperCase(), 480, 472);

    // Stake & Action Status Line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = popFont(700, 19, cashed ? pop(view.cashoutX100 ?? 100) : 0);
    ctx.fillText(line, 480, 514);

    ctx.restore();
  }

  return { draw };
}
