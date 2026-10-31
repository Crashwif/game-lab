/**
 * Key In Chiron - Left the keys in a 3-million-dollar hypercar again.
 * A French hypercar idles in an open driveway with keys dangling from the ignition.
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
  [120, 'Driver steps out to grab an espresso'],
  [150, 'Keys swing gently from the leather fob'],
  [200, 'Passersby notice dashboard lights stay on'],
  [250, 'Neighborhood raccoons sniff exhaust pipes'],
  [300, 'Valet imposter in fake trenchcoat lurks'],
  [500, 'Local joyriders pull up on electric scooters'],
  [1000, 'Hands reach through the open driver window'],
  [10000, 'Someone sits in the seat adjusting mirrors'],
  [100000, 'Rev counter hits redline while parked'],
  [1000000, 'Grand theft hypercar achieves orbital escape'],
];

const COLOURS = {
  bgTop: '#0c1024',
  bgBottom: '#2d183b',
  carBlue: '#0066ff',
  carDark: '#081738',
  carAccent: '#5ce1e6',
  gold: '#ffb703',
  alertRed: '#ff2a5f',
  safeGreen: '#2ec4b6',
  text: '#ffffff',
  muted: '#8e9aaf',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (w: number, sz: number, pop: number) => `${w} ${sz * (1 + 0.25 * pop * pop)}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`LOCKED & SECURED at ${formatX(view.cashoutX100)} · CEO sped off`, COLOURS.safeGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'JOYRIDER STOLE IT · Spectating safely' : 'Watching the driveway · No credits placed', COLOURS.muted];
  }
  if (crashed) {
    return [`THE CHIRON IS GONE! Lost ${credits(view.stake)} in the joyride`, COLOURS.alertRed];
  }
  return [`Keys in ignition · ${credits(view.stake)} on the hypercar`, COLOURS.gold];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'siren' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastRevTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    audio.update(view.phase, tension);

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('beep', 0.9);
      audio.fx('whoosh', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('siren', previousPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.8);
    }
    if (running && previousPhase === 'running') {
      if (milestoneCount > previousMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('whoosh', 0.5);
      }
      // Occasional engine throttle revs
      const tickStep = Math.floor(view.elapsed / (450 - 250 * tension));
      if (tickStep > lastRevTick && view.cashoutX100 === null) {
        audio.fx('engine', 0.3 + 0.6 * tension);
        lastRevTick = tickStep;
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneCount;

    // Shake & crash animations
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.6) ** 2 : running ? tension * 1.5 : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.save();
    ctx.clearRect(0, 0, 960, 540);
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. Luxury Twilight / Sunset Backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 380);
    skyGrad.addColorStop(0, COLOURS.bgTop);
    skyGrad.addColorStop(0.65, '#2b1042');
    skyGrad.addColorStop(1, '#ff6b4a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 380);

    // Distant palm trees & luxury cafe pavilion
    ctx.fillStyle = '#140c26';
    for (let i = 0; i < 7; i++) {
      const px = 40 + i * 150;
      ctx.fillRect(px, 230, 8, 120);
      ctx.beginPath();
      ctx.arc(px + 4, 220, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    // French Cafe sign & bistro tables in background
    ctx.fillStyle = '#ffde59';
    ctx.fillRect(720, 240, 160, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 12px system-ui';
    ctx.fillText('LE CAFE ESPRESSO', 740, 235);

    // Manicured estate hedges
    ctx.fillStyle = '#0f241a';
    ctx.beginPath();
    ctx.roundRect(0, 320, 960, 60, [16, 16, 0, 0]);
    ctx.fill();

    // Driveway cobblestone
    const groundGrad = ctx.createLinearGradient(0, 360, 0, 540);
    groundGrad.addColorStop(0, '#2b303a');
    groundGrad.addColorStop(1, '#11151c');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 360, 960, 180);

    // Decorative estate driveway lights
    for (let lx = 60; lx < 960; lx += 180) {
      ctx.fillStyle = '#ffeaa7';
      ctx.beginPath();
      ctx.arc(lx, 362, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 234, 167, 0.15)';
      ctx.beginPath();
      ctx.arc(lx, 362, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Creeping Prowlers in the bushes (escalating with tension)
    if (tension > 0.15) {
      // Raccoon eyes in hedge
      const eyeGlow = 0.5 + 0.5 * Math.sin(now * 0.008);
      ctx.fillStyle = `rgba(255, 240, 100, ${eyeGlow})`;
      ctx.beginPath();
      ctx.arc(130, 335, 3.5, 0, Math.PI * 2);
      ctx.arc(142, 335, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (tension > 0.35) {
      // Shady trenchcoat lurker peering from hedge
      const lkX = 220 + Math.sin(now * 0.004) * 8;
      ctx.fillStyle = '#080812';
      ctx.beginPath();
      ctx.arc(lkX, 310, 14, 0, Math.PI * 2); // fedora/head
      ctx.fillRect(lkX - 18, 308, 36, 4); // brim
      ctx.fillRect(lkX - 12, 324, 24, 30); // shoulders
      ctx.fill();
      // Lurker glowing sunglasses
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(lkX - 8, 311, 7, 3);
      ctx.fillRect(lkX + 1, 311, 7, 3);
    }
    if (tension > 0.6) {
      // Joyrider on scooter creeping right
      const scX = 830 - Math.min(1, (tension - 0.6) / 0.4) * 50;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(scX, 320, 4, 38);
      ctx.fillRect(scX - 15, 355, 32, 5);
      ctx.beginPath();
      ctx.arc(scX - 15, 358, 7, 0, Math.PI * 2);
      ctx.arc(scX + 15, 358, 7, 0, Math.PI * 2);
      ctx.fill();
      // Hooded rider
      ctx.beginPath();
      ctx.arc(scX, 298, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. The Chiron Hypercar
    const engineVibe = running ? Math.sin(now * 0.05) * (1 + tension * 3) : 0;
    const carBaseX = 330;
    const carBaseY = 320 + engineVibe;

    ctx.save();
    ctx.translate(carBaseX, carBaseY);

    // Car Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(80, 75, 230, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hypercar Body (Iconic Bugatti horseshoe & dynamic C-curve profile)
    // Dark rear quarter
    ctx.fillStyle = COLOURS.carDark;
    ctx.beginPath();
    ctx.moveTo(-110, 60);
    ctx.lineTo(-130, 40);
    ctx.quadraticCurveTo(-140, 20, -110, 15);
    ctx.lineTo(-40, 12);
    ctx.lineTo(20, 14);
    ctx.lineTo(60, 58);
    ctx.closePath();
    ctx.fill();

    // Vibrant French Blue Front & Mid
    ctx.fillStyle = COLOURS.carBlue;
    ctx.beginPath();
    ctx.moveTo(-30, 14);
    ctx.quadraticCurveTo(80, 14, 180, 32);
    ctx.quadraticCurveTo(260, 42, 280, 58);
    ctx.lineTo(270, 64);
    ctx.lineTo(-30, 64);
    ctx.closePath();
    ctx.fill();

    // Iconic Bugatti chrome / turquoise C-bar loop
    ctx.strokeStyle = COLOURS.carAccent;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(35, 32, 28, Math.PI * 0.4, Math.PI * 1.6, false);
    ctx.stroke();

    // Roof & Tinted Cockpit Window
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-20, 15);
    ctx.quadraticCurveTo(40, -12, 110, 15);
    ctx.lineTo(135, 34);
    ctx.lineTo(-15, 34);
    ctx.closePath();
    ctx.fill();

    // Dashboard Glow & Dangling Key Fob inside open driver window
    const dashGlow = ctx.createRadialGradient(50, 24, 2, 50, 24, 22);
    dashGlow.addColorStop(0, 'rgba(0, 230, 255, 0.8)');
    dashGlow.addColorStop(1, 'rgba(0, 230, 255, 0)');
    ctx.fillStyle = dashGlow;
    ctx.fillRect(30, 10, 40, 24);

    // Keys bouncing in the ignition!
    const keySwing = Math.sin(now * 0.007 + tension * 10) * (0.35 + tension * 0.6);
    ctx.save();
    ctx.translate(56, 22);
    ctx.rotate(keySwing);
    // Silver key
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-1.5, 0, 3, 11);
    // Leather Fob
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.roundRect(-4, 11, 8, 14, 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.gold;
    ctx.fillRect(-2, 14, 4, 4);
    ctx.restore();

    // Hypercar Wheels (Left and Right)
    const drawWheel = (wx: number, wy: number) => {
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(wx, wy, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Blue brake caliper
      ctx.fillStyle = COLOURS.carAccent;
      ctx.beginPath();
      ctx.arc(wx, wy - 8, 9, Math.PI, Math.PI * 2);
      ctx.fill();
      // Center hub
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(wx, wy, 6, 0, Math.PI * 2);
      ctx.fill();
    };
    drawWheel(-75, 62);
    drawWheel(210, 62);

    // Quad LED Headlights
    ctx.fillStyle = '#ffffff';
    for (let h = 0; h < 4; h++) {
      ctx.fillRect(264 + h * 3, 50, 2, 4);
    }
    // Tail Light Beam (Red LED strip)
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(-132, 38, 12, 3);

    // Exhaust pops/flames if tension is high
    if (running && tension > 0.4 && Math.sin(now * 0.02) > 0.3) {
      ctx.fillStyle = COLOURS.carAccent;
      ctx.beginPath();
      ctx.arc(-142, 54, 6 + 10 * tension, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 4. Action states: Cashout (CEO locks & escapes) vs Crash (Masked Joyrider blast)
    if (view.cashoutX100 !== null) {
      // Golden / turquoise security shield and lock flash
      ctx.strokeStyle = COLOURS.safeGreen;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(240, 280, 480, 130, 20);
      ctx.stroke();
      ctx.fillStyle = 'rgba(46, 196, 182, 0.15)';
      ctx.fill();

      // Chirping Alarm Beams
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 24px system-ui';
      ctx.fillText('*BEEP BEEP!* ALARM ARMED', 480, 260);
      ctx.font = '600 16px system-ui';
      ctx.fillStyle = COLOURS.safeGreen;
      ctx.fillText('CEO RETURNED · HYPERCAR LOCKED SAFELY', 480, 286);
    } else if (crashed) {
      // Burnt rubber smoke donuts & Joyrider flying flip-flops
      const smokeCount = Math.min(18, Math.floor(age * 20));
      for (let s = 0; s < smokeCount; s++) {
        const sx = 400 + Math.sin(s * 1.7) * 220;
        const sy = 400 - s * 14;
        const sr = 25 + s * 8;
        ctx.fillStyle = `rgba(220, 220, 230, ${Math.max(0, 0.45 - s * 0.02)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flying flip-flop joyrider meme detail
      ctx.save();
      ctx.translate(620 + age * 120, 260 - Math.sin(age * 5) * 60);
      ctx.rotate(age * 12);
      ctx.fillStyle = '#ff007f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Stolen banner
      ctx.fillStyle = COLOURS.alertRed;
      ctx.font = '900 36px system-ui';
      ctx.fillText('GRAND THEFT! JOYRIDER TOOK IT!', 480, 260);
    }

    // 5. HUD & Multipliers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Concept Bar
    ctx.fillStyle = COLOURS.gold;
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText('KEY IN CHIRON', 480, 36);
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('3-MILLION HYPERCAR IDLING IN DRIVEWAY · CASH OUT BEFORE OPPORTUNISTS STRIKE', 480, 60);

    // Giant Dynamic Multiplier Readout
    const punch = crashed ? (1 - clamp01((age - 0.12) / 0.25)) ** 2 : 0;
    const multColor = crashed ? COLOURS.alertRed : view.cashoutX100 !== null ? COLOURS.safeGreen : COLOURS.text;
    ctx.fillStyle = multColor;
    ctx.font = `800 ${88 * (1 + 0.2 * punch + 0.05 * depth)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 126);

    // Milestone / Story Beat Subtitle
    const activeMilestone = running ? MILESTONES[milestoneCount - 1] : undefined;
    const popVal = pop(activeMilestone?.[0] ?? 100);
    ctx.fillStyle = COLOURS.gold;
    ctx.font = popFont(600, 22, popVal);
    const subtitle = crashed
      ? 'A teenager in flip-flops mashed the pedal and blasted away!'
      : activeMilestone?.[1] ?? (view.phase === 'betting' ? 'Driver stepped out to grab an espresso...' : 'Keys dangling in the ignition...');
    ctx.fillText(subtitle, 480, 185);

    // Player Stake / Cashout Status Line
    const [statusText, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = popFont(700, 22, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(statusText, 480, 500);

    ctx.restore();
  }

  return { draw };
}
