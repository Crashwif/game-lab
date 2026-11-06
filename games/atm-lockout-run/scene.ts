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
  bg: '#0a0d18',
  tileDark: '#13192b',
  tileLight: '#182138',
  atmBody: '#2a334d',
  atmDark: '#1a2033',
  atmAccent: '#00e5ff',
  atmOrange: '#ff9100',
  screenBg: '#041624',
  screenGlitch: '#ff0055',
  cashGreen: '#6ee7b7',
  text: '#ffffff',
  muted: '#8ba2c4',
  crashed: '#ff3366',
  cashedOut: '#00f59b',
  salarySuit: '#1e293b',
  tieRed: '#ef4444',
  gold: '#fbbf24',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Insert card: Processing network handshake'],
  [150, 'PIN verified but network ping reaches 800ms'],
  [200, 'Branch router sparks behind teller counter'],
  [250, 'Queue outside grows past convenient store doors'],
  [300, 'Cash roller begins grinding gears loudly'],
  [500, 'Fifty regional branches drop offline together'],
  [1000, 'ATM dispenser flap rattles with trapped cash'],
  [10000, '128 credit unions simultaneously disconnect'],
  [100000, 'Helicopter reporters circle the bank entrance'],
  [1000000, 'Central banking terminal declares national holiday'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Dispensed at ${formatX(view.cashoutX100)} · Sprinted down subway stairs!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'ATM chewed the card · No credits lost' : 'Awaiting card insert · No credits riding', COLOURS.muted];
  }
  if (crashed) return [`Mainframe clamped ${credits(view.stake)} · Card confiscated`, COLOURS.crashed];
  return [`Card loaded · ${credits(view.stake)} cycling dispenser`, COLOURS.atmAccent];
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastDispenseTick = 0;

  const sparks: Spark[] = [];

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Sound cues
    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('whoosh', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('clang', 0.9);
      audio.fx('buzz', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('ratchet', 0.7);
      }
      const tickInterval = Math.max(120, 420 - tension * 320);
      if (view.elapsed - lastDispenseTick > tickInterval && !cashedOut) {
        audio.fx('click', 0.3 + 0.4 * tension);
        lastDispenseTick = view.elapsed;
      }
    }
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    // Camera shakes
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const crashShake = crashed ? 14 * clamp01(1 - age / 0.6) ** 2 : 0;
    const runShake = running ? (Math.sin(now * 0.05) * 1.5 + Math.cos(now * 0.03)) * tension * 4.5 : 0;
    const totalShakeX = (crashShake * Math.sin(age * 60) + runShake);
    const totalShakeY = (crashShake * Math.cos(age * 45) + (running ? Math.sin(now * 0.04) * tension * 2 : 0));

    ctx.save();
    ctx.translate(totalShakeX, totalShakeY);

    // 1. Bank Lobby / Tokyo Street Background
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Tiled lobby floor
    const floorY = 380;
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, 540);
    floorGrad.addColorStop(0, '#0f162b');
    floorGrad.addColorStop(1, '#080c18');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, 960, 160);

    ctx.strokeStyle = '#1b2640';
    ctx.lineWidth = 1.5;
    for (let x = -80; x < 1040; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x + (x - 480) * 0.4, 540);
      ctx.lineTo(x, floorY);
      ctx.stroke();
    }
    for (let y = floorY; y < 540; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Glass storefront window with street skyline & silhouette queue
    ctx.fillStyle = '#0b1329';
    ctx.fillRect(40, 60, 360, 300);
    ctx.strokeStyle = '#223254';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 60, 360, 300);

    // Tokyo neon skyline outside
    const skyGrad = ctx.createLinearGradient(40, 60, 40, 360);
    skyGrad.addColorStop(0, '#060914');
    skyGrad.addColorStop(1, '#1e1138');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(43, 63, 354, 294);

    // Neon billboards
    ctx.fillStyle = `rgba(255, 0, 128, ${0.4 + 0.3 * Math.sin(now * 0.004)})`;
    ctx.fillRect(70, 120, 45, 110);
    ctx.fillStyle = `rgba(0, 229, 255, ${0.4 + 0.3 * Math.cos(now * 0.005)})`;
    ctx.fillRect(130, 90, 55, 140);
    ctx.fillStyle = `rgba(250, 204, 21, ${0.35 + 0.25 * Math.sin(now * 0.007)})`;
    ctx.fillRect(210, 140, 60, 90);

    // Queue of anxious people outside window (scales with tension)
    const queueCount = Math.min(10, Math.floor(2 + tension * 8));
    ctx.fillStyle = '#0d1322';
    for (let i = 0; i < queueCount; i++) {
      const qx = 70 + i * 32;
      const qBob = Math.sin(now * 0.006 + i) * 3;
      // Head
      ctx.beginPath();
      ctx.arc(qx, 280 + qBob, 10, 0, Math.PI * 2);
      ctx.fill();
      // Body & umbrella
      ctx.fillRect(qx - 8, 292 + qBob, 16, 68);
      ctx.strokeStyle = '#1d2a45';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(qx, 268 + qBob, 16, Math.PI, 0);
      ctx.stroke();
    }

    // Ceiling security shutter (lowers as tension increases)
    const shutterH = crashed ? 340 : tension * 190;
    if (shutterH > 2) {
      ctx.fillStyle = '#1c2438';
      ctx.fillRect(0, 0, 960, shutterH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      for (let sy = 12; sy <= shutterH; sy += 16) {
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(960, sy);
        ctx.stroke();
      }
      // Shutter hazard stripes along bottom edge
      for (let sx = 0; sx < 960; sx += 40) {
        ctx.fillStyle = (sx % 80 === 0) ? '#eab308' : '#111827';
        ctx.beginPath();
        ctx.moveTo(sx, shutterH - 8);
        ctx.lineTo(sx + 20, shutterH - 8);
        ctx.lineTo(sx + 10, shutterH);
        ctx.lineTo(sx - 10, shutterH);
        ctx.fill();
      }
    }

    // 2. Centerpiece: ATM Kiosk (Center-Right at x=520, y=140)
    const atmX = 490;
    const atmY = 130;
    const atmW = 240;
    const atmH = 340;

    // ATM Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(atmX + atmW / 2, floorY + 60, 150, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // ATM Machine cabinet
    const atmGrad = ctx.createLinearGradient(atmX, atmY, atmX + atmW, atmY);
    atmGrad.addColorStop(0, COLOURS.atmBody);
    atmGrad.addColorStop(0.5, '#3b4766');
    atmGrad.addColorStop(1, COLOURS.atmDark);
    ctx.fillStyle = atmGrad;
    ctx.roundRect(atmX, atmY, atmW, atmH, 12);
    ctx.fill();
    ctx.strokeStyle = '#506187';
    ctx.lineWidth = 3;
    ctx.stroke();

    // ATM Header Sign
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(atmX + 16, atmY + 12, atmW - 32, 34);
    ctx.strokeStyle = COLOURS.atmAccent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(atmX + 16, atmY + 12, atmW - 32, 34);
    ctx.fillStyle = COLOURS.atmAccent;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TOKYO METRO BANK · 現金自動受払機', atmX + atmW / 2, atmY + 34);

    // ATM Touch Screen
    const scrX = atmX + 22;
    const scrY = atmY + 54;
    const scrW = atmW - 44;
    const scrH = 140;
    ctx.fillStyle = crashed ? '#450a0a' : COLOURS.screenBg;
    ctx.fillRect(scrX, scrY, scrW, scrH);
    ctx.strokeStyle = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.cashedOut : '#1e3a5f');
    ctx.lineWidth = 2;
    ctx.strokeRect(scrX, scrY, scrW, scrH);

    // Screen graphics
    if (crashed) {
      // Red fatal error
      ctx.fillStyle = COLOURS.crashed;
      ctx.font = '800 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('取扱中止', scrX + scrW / 2, scrY + 45);
      ctx.font = '700 14px monospace';
      ctx.fillText('FATAL LOCKOUT', scrX + scrW / 2, scrY + 75);
      ctx.font = '500 11px monospace';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('CARD CONFISCATED', scrX + scrW / 2, scrY + 100);
      ctx.fillText('ERROR CODE 0xDEADBEEF', scrX + scrW / 2, scrY + 120);
    } else {
      // Live matrix data / ping / touch UI
      ctx.fillStyle = cashedOut ? COLOURS.cashedOut : '#38bdf8';
      ctx.font = '600 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(cashedOut ? 'PAID OUT · 現金受取済' : 'DISPENSING ACTIVE', scrX + 10, scrY + 24);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 10px monospace';
      const ping = Math.floor(40 + tension * 1200 + Math.sin(now * 0.02) * 30);
      ctx.fillText(`PING: ${ping}ms  CONN: 98.4%`, scrX + 10, scrY + 42);

      // Fast animated matrix bars
      const barCount = 14;
      for (let b = 0; b < barCount; b++) {
        const bh = 15 + Math.sin(now * 0.01 + b * 1.3) * 12 + tension * 15;
        const bx = scrX + 10 + b * 12;
        ctx.fillStyle = b % 3 === 0 ? COLOURS.atmOrange : '#0ea5e9';
        ctx.fillRect(bx, scrY + 115 - bh, 8, bh);
      }

      // Touch prompt button
      ctx.fillStyle = running ? (Math.sin(now * 0.01) > 0 ? '#10b981' : '#059669') : '#2563eb';
      ctx.beginPath();
      ctx.roundRect(scrX + 18, scrY + 60, scrW - 36, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(running ? '⚡ SPAM CASH ¥ ⚡' : 'CARD INSERTED', scrX + scrW / 2, scrY + 77);
    }

    // Card Slot & Dispenser Flap
    const slotY = atmY + 215;
    ctx.fillStyle = '#111827';
    ctx.fillRect(atmX + 30, slotY, 70, 10);
    ctx.strokeStyle = crashed ? '#dc2626' : (cashedOut ? '#10b981' : '#38bdf8');
    ctx.lineWidth = 1.5;
    ctx.strokeRect(atmX + 30, slotY, 70, 10);

    // Glowing Card in slot or clamp
    if (crashed) {
      // Clamped card crushed
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(atmX + 50, slotY - 6, 28, 22);
      ctx.fillStyle = '#f87171';
      ctx.fillText('JAM', atmX + 64, slotY + 9);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(atmX + 48, slotY - 3, 34, 8);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(atmX + 50, slotY - 2, 8, 6);
    }

    // Dispenser flap (spewing money!)
    const dispX = atmX + 120;
    const dispY = slotY - 4;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(dispX, dispY, 90, 20);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(dispX, dispY, 90, 20);

    // Dispensing yen bundles
    if (running || cashedOut) {
      const noteCount = cashedOut ? 7 : Math.min(6, Math.floor(1 + tension * 5));
      for (let n = 0; n < noteCount; n++) {
        const ny = dispY + 4 - n * 3;
        const nx = dispX + 6 + (cashedOut ? -n * 6 - 8 : Math.sin(now * 0.015 + n) * 4);
        ctx.fillStyle = COLOURS.cashGreen;
        ctx.fillRect(nx, ny, 34, 14);
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1;
        ctx.strokeRect(nx, ny, 34, 14);
        ctx.fillStyle = '#065f46';
        ctx.font = '800 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('¥10000', nx + 17, ny + 10);
      }
    }

    // Keypad below
    const keyY = atmY + 250;
    for (let kr = 0; kr < 3; kr++) {
      for (let kc = 0; kc < 4; kc++) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(atmX + 35 + kc * 22, keyY + kr * 16, 16, 11);
      }
    }

    // Router box on the right of the kiosk, sparks if high tension
    const routerX = atmX + atmW + 10;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(routerX, 280, 50, 70);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(routerX, 280, 50, 70);
    // Router LEDs
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = (tension > 0.4 && (now + r * 100) % 200 > 100) ? '#ef4444' : '#22c55e';
      ctx.beginPath();
      ctx.arc(routerX + 12 + r * 9, 292, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spark particles logic
    if (tension > 0.3 || crashed) {
      if (Math.random() < (crashed ? 0.6 : tension * 0.4)) {
        sparks.push({
          x: routerX + 25 + (Math.random() - 0.5) * 30,
          y: 290 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 5 - 1,
          life: 1.0,
        });
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i]!;
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.2;
      sp.life -= 0.05;
      if (sp.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255, 200, 50, ${sp.life})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.5 * sp.life, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Protagonist: Anxious Suited Salaryman (x=410, y=260)
    const salX = cashedOut ? 280 : (crashed ? 390 : 410);
    const salY = 270;
    const panicBob = running ? Math.sin(now * 0.02) * (3 + tension * 7) : 0;

    // Body
    ctx.save();
    ctx.translate(salX, salY + panicBob);

    if (cashedOut) {
      // SPRINTING AWAY WITH CASH TO SUBWAY!
      // Torso tilted forward
      ctx.rotate(-0.25);
      ctx.fillStyle = COLOURS.salarySuit;
      ctx.fillRect(-22, 30, 44, 75);

      // Red tie flapping back in wind
      ctx.fillStyle = COLOURS.tieRed;
      ctx.beginPath();
      ctx.moveTo(-6, 36);
      ctx.lineTo(-45 - Math.sin(now * 0.03) * 10, 42);
      ctx.lineTo(-6, 46);
      ctx.fill();

      // Running legs
      ctx.strokeStyle = COLOURS.salarySuit;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const legRun = Math.sin(now * 0.03) * 28;
      ctx.moveTo(-10, 100);
      ctx.lineTo(-24 + legRun, 150);
      ctx.moveTo(10, 100);
      ctx.lineTo(24 - legRun, 150);
      ctx.stroke();

      // Arms holding huge bundle of cash
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(10, 40);
      ctx.lineTo(35, 60);
      ctx.stroke();

      // Big Cash Stack in hands
      ctx.fillStyle = COLOURS.cashGreen;
      ctx.fillRect(30, 45, 45, 25);
      ctx.strokeStyle = '#047857';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 45, 45, 25);
      ctx.fillStyle = '#065f46';
      ctx.font = '900 12px monospace';
      ctx.fillText('¥¥¥', 52, 62);

      // Ecstatic grinning head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(10, 10, 22, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(8, 2, 22, Math.PI, Math.PI * 2);
      ctx.fill();
      // Glasses & Big smile
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(14, 5, 14, 7);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16, 18, 9, 0, Math.PI);
      ctx.stroke();
    } else if (crashed) {
      // COMICAL SHOCK / DESPAIR POSE
      ctx.fillStyle = COLOURS.salarySuit;
      ctx.fillRect(-20, 35, 40, 75);

      // Drooping head in hands
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, 15, 22, 0, Math.PI * 2);
      ctx.fill();
      // Hair disheveled
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 8, 22, Math.PI, Math.PI * 2);
      ctx.fill();
      // X eyes for shock
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      // Left eye X
      ctx.beginPath();
      ctx.moveTo(4, 10);
      ctx.lineTo(12, 18);
      ctx.moveTo(12, 10);
      ctx.lineTo(4, 18);
      // Right eye X
      ctx.moveTo(16, 10);
      ctx.lineTo(24, 18);
      ctx.moveTo(24, 10);
      ctx.lineTo(16, 18);
      ctx.stroke();
      // Open mouth O of despair
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(14, 26, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hands on face
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(-2, 18, 7, 0, Math.PI * 2);
      ctx.arc(28, 18, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // FRANTIC SUITED SALARYMAN TAPPING THE ATM
      // Torso
      ctx.fillStyle = COLOURS.salarySuit;
      ctx.fillRect(-18, 30, 36, 75);

      // Red tie shaking
      ctx.fillStyle = COLOURS.tieRed;
      ctx.beginPath();
      ctx.moveTo(4, 34);
      ctx.lineTo(4 + Math.sin(now * 0.04) * 6 * tension, 72);
      ctx.lineTo(0, 72);
      ctx.fill();

      // Right arm frantically tapping forward towards screen
      const tapDist = Math.sin(now * 0.05) * 14;
      ctx.strokeStyle = COLOURS.salarySuit;
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, 42);
      ctx.lineTo(55 + tapDist, 35 - tapDist * 0.3);
      ctx.stroke();

      // Pointing finger hand
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(58 + tapDist, 35 - tapDist * 0.3, 7, 0, Math.PI * 2);
      ctx.fill();

      // Left hand clutching briefcase
      ctx.beginPath();
      ctx.moveTo(-10, 42);
      ctx.lineTo(-24, 80);
      ctx.stroke();
      // Briefcase
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-38, 75, 26, 32);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.strokeRect(-38, 75, 26, 32);

      // Legs
      ctx.strokeStyle = COLOURS.salarySuit;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(-8, 100);
      ctx.lineTo(-12, 145);
      ctx.moveTo(8, 100);
      ctx.lineTo(16, 145);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, 10, 21, 0, Math.PI * 2);
      ctx.fill();
      // Neat dark hair
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 2, 21, Math.PI, Math.PI * 2);
      ctx.fill();

      // Glasses with reflection
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 6, 11, 8);
      ctx.strokeRect(17, 6, 11, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(6, 8, 4, 4);
      ctx.fillRect(19, 8, 4, 4);

      // Sweat drops escalating with tension
      if (tension > 0.2) {
        ctx.fillStyle = '#38bdf8';
        const dropY = (now * 0.08) % 20;
        ctx.beginPath();
        ctx.arc(-8, -4 + dropY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 4. Subway Entrance Sign on far left (Escape Route)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, floorY - 30, 110, 60);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, floorY - 30, 110, 60);
    ctx.fillStyle = '#10b981';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUBWAY 地下鉄', 75, floorY - 8);
    ctx.font = '900 16px system-ui';
    ctx.fillText('↓ ESCAPE', 75, floorY + 14);

    // 5. HUD - Header, Multiplier, Milestones, Stake Line
    // Top banner
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0, 229, 255, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText('ATM LOCKOUT RUN', 480, 42);
    ctx.shadowBlur = 0;

    // Subtitle tagline
    ctx.font = '600 13px monospace';
    ctx.fillStyle = COLOURS.atmOrange;
    ctx.fillText('MAINFRAME GLITCH COUNTDOWN · CASH OUT BEFORE NATIONWIDE CRASH', 480, 72);

    // Giant Multiplier
    const multiTint = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.cashedOut : COLOURS.atmAccent);
    ctx.fillStyle = multiTint;
    ctx.shadowColor = multiTint;
    ctx.shadowBlur = crashed ? 18 : 8;
    ctx.font = `900 ${76 + (running ? depth * 14 : 0)}px monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 126);
    ctx.shadowBlur = 0;

    // Milestone ticker caption
    const passedMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 17px system-ui, sans-serif';
    if (crashed) {
      ctx.fillStyle = COLOURS.crashed;
      ctx.fillText('⚠ CENTRAL BANK ROUTER DISCONNECTED · OUT OF SERVICE ⚠', 480, 480);
    } else {
      ctx.fillText(passedMilestone ? `ALERT: ${passedMilestone[1]}` : 'Ready: Tap dispenser to begin network run', 480, 480);
    }

    // Bottom Stake Line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(line, 480, 514);

    ctx.restore();
  }

  return { draw };
}
