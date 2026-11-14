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
  [120, 'Boarding door closes with thirty-minute delay'],
  [150, 'Captain announces minor radar paperwork'],
  [200, 'Terminal coffee machine runs out of beans'],
  [250, 'Taxiway line stretches past seven gates'],
  [300, 'Tower radio begins playing 90s hold music'],
  [500, 'Flight status screens flip yellow nationwide'],
  [1000, 'Baggage carousels start rotating backwards'],
  [10000, 'Control tower switches to manual paper flags'],
  [100000, 'Total airspace gridlock declared a holiday'],
  [1000000, 'Supersonic clearance through deserted clouds'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Gate reached at ${formatX(view.cashoutX100)} · Pretzel secured! 🥨`, '#86efac'];
  }
  if (view.stake === null) {
    return [crashed ? 'Tarmac locked down · Spectating' : 'Ground radar standby · Watching', '#94a3b8'];
  }
  if (crashed) return [`Gridlock claimed ${credits(view.stake)}`, '#f87171'];
  return [`Taxiing with ${credits(view.stake)} on apron`, '#38bdf8'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'siren' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let prevStep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    // Audio cues
    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('door', 0.85);
      audio.fx('ding', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('siren', prevPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.6);
    }
    const taxiStep = Math.floor(view.elapsed / 260);
    if (running && prevPhase === 'running') {
      if (milestoneCount > prevMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('notify', 0.75);
      }
      if (taxiStep > prevStep && !cashed) {
        audio.fx('engine', 0.2 + 0.3 * tension);
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneCount;
    prevStep = taxiStep;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;
    const shakeX = shake * Math.sin(crashAgeSec * 62);
    const shakeY = shake * Math.cos(crashAgeSec * 73);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Tarmac Sky & Horizon
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 320);
    if (crashed) {
      skyGrad.addColorStop(0, '#2a0a10');
      skyGrad.addColorStop(1, '#4a151b');
    } else {
      skyGrad.addColorStop(0, '#0a1628');
      skyGrad.addColorStop(0.6, '#182b4a');
      skyGrad.addColorStop(1, '#2c4365');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 320);

    // Terminal building skyline & Control Tower
    ctx.fillStyle = crashed ? '#1f0d14' : '#111e30';
    ctx.fillRect(40, 160, 320, 120);
    ctx.fillRect(400, 140, 240, 140);
    // Control tower
    ctx.fillRect(720, 90, 48, 190);
    ctx.fillRect(696, 68, 96, 32);
    // Tower glass cabin
    ctx.fillStyle = crashed ? '#ef4444' : '#38bdf8';
    ctx.fillRect(702, 74, 84, 18);

    // Rotating siren / beacon on tower
    const sirenSpin = crashed ? now * 0.015 : now * 0.003;
    const sirenPulse = Math.sin(sirenSpin);
    ctx.fillStyle = crashed ? (sirenPulse > 0 ? '#ff2222' : '#7f1d1d') : '#f59e0b';
    ctx.beginPath();
    ctx.arc(744, 62, 8 + (crashed ? 4 * Math.abs(sirenPulse) : 0), 0, Math.PI * 2);
    ctx.fill();

    // Tower smoke when tension is high
    if (tension > 0.4 || crashed) {
      ctx.fillStyle = crashed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(148, 163, 184, 0.28)';
      for (let s = 0; s < 4; s++) {
        const off = ((now * 0.04 + s * 30) % 100);
        const sz = 10 + off * 0.3;
        ctx.beginPath();
        ctx.arc(744 + Math.sin(off * 0.1) * 16, 50 - off, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Departure Monitors on terminal wall (BSOD on crash / static)
    for (let b = 0; b < 3; b++) {
      const bx = 80 + b * 90;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bx, 180, 70, 46);
      if (crashed) {
        ctx.fillStyle = (b + Math.floor(now * 0.02)) % 2 === 0 ? '#1d4ed8' : '#dc2626';
        ctx.fillRect(bx + 2, 182, 66, 42);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 8px monospace';
        ctx.fillText('ERR:HALT', bx + 35, 203);
      } else {
        const rowColor = tension > 0.6 ? '#f59e0b' : '#22c55e';
        ctx.fillStyle = rowColor;
        ctx.fillRect(bx + 6, 190, 58, 4);
        ctx.fillRect(bx + 6, 198, 44, 4);
        ctx.fillRect(bx + 6, 206, 52, 4);
      }
    }

    // 2. Tarmac Ground & Runway
    const tarmacGrad = ctx.createLinearGradient(0, 280, 0, 540);
    tarmacGrad.addColorStop(0, '#1a222d');
    tarmacGrad.addColorStop(1, '#0d131a');
    ctx.fillStyle = tarmacGrad;
    ctx.fillRect(0, 280, 960, 260);

    // Taxiway yellow centerline with movement
    const taxiScroll = running ? (view.elapsed * 0.5) % 80 : 0;
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 6;
    ctx.setLineDash([42, 38]);
    ctx.lineDashOffset = -taxiScroll;
    ctx.beginPath();
    ctx.moveTo(-100, 430);
    ctx.lineTo(1060, 430);
    ctx.stroke();
    ctx.setLineDash([]);

    // Edge runway marker lights
    for (let lx = 30; lx < 960; lx += 90) {
      const isRed = crashed || (tension > 0.7 && ((lx + Math.floor(now * 0.005)) % 180 === 0));
      ctx.fillStyle = isRed ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(lx, 310, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.arc(lx + 20, 520, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Luggage cart train waiting in traffic
    const jamShift = Math.sin(now * 0.002) * 12;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(110 + jamShift, 335, 40, 20); // Tug
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(120 + jamShift, 355, 6, 0, Math.PI * 2);
    ctx.arc(140 + jamShift, 355, 6, 0, Math.PI * 2);
    ctx.fill();
    // Luggage carts
    for (let c = 0; c < 2; c++) {
      const cx = 50 - c * 52 + jamShift;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(cx, 340, 36, 15);
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(cx + 8, 355, 5, 0, Math.PI * 2);
      ctx.arc(cx + 28, 355, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Jet Bridge (Casheout Destination Gate)
    const bridgeX = 820;
    const bridgeExtend = cashed ? 90 : 30;
    ctx.fillStyle = '#475569';
    ctx.fillRect(bridgeX - bridgeExtend, 320, bridgeExtend + 20, 50);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(bridgeX - bridgeExtend - 12, 314, 20, 62);
    if (cashed) {
      ctx.fillStyle = '#22c55e';
      ctx.font = '700 13px sans-serif';
      ctx.fillText('GATE D-42 LOCKED', bridgeX - 70, 310);
    }

    // 4. Protagonist: Slightly Confused Airliner
    const planeX = cashed ? 690 : 440;
    const planeWobble = running ? Math.sin(view.elapsed * 0.012) * (2 + 6 * tension) : 0;
    const planeY = 370 + planeWobble;

    ctx.save();
    ctx.translate(planeX, planeY);

    // Jet engine exhaust heat haze / blur
    if (running) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-110, 22, 28 + tension * 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fuselage shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 50 - planeWobble * 0.4, 110, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-50, 35, 14, 14);
    ctx.fillRect(35, 37, 12, 12);
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(-43, 49, 7, 0, Math.PI * 2);
    ctx.arc(41, 49, 6, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(-20, 10);
    ctx.lineTo(-75, 42);
    ctx.lineTo(-45, 42);
    ctx.lineTo(25, 12);
    ctx.closePath();
    ctx.fill();

    // Fuselage
    const fuseGrad = ctx.createLinearGradient(0, -35, 0, 35);
    fuseGrad.addColorStop(0, '#ffffff');
    fuseGrad.addColorStop(0.7, '#e2e8f0');
    fuseGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = fuseGrad;
    ctx.beginPath();
    ctx.moveTo(-110, -5);
    ctx.quadraticCurveTo(-110, -30, -50, -30);
    ctx.lineTo(60, -30);
    ctx.quadraticCurveTo(120, -26, 128, 4);
    ctx.quadraticCurveTo(120, 30, 50, 30);
    ctx.lineTo(-85, 30);
    ctx.quadraticCurveTo(-110, 25, -110, -5);
    ctx.closePath();
    ctx.fill();

    // Decorative blue airline cheatline
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(-105, 0);
    ctx.lineTo(122, 0);
    ctx.lineTo(116, 10);
    ctx.lineTo(-100, 10);
    ctx.closePath();
    ctx.fill();

    // Tail fin
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(-85, -28);
    ctx.lineTo(-115, -78);
    ctx.lineTo(-78, -78);
    ctx.lineTo(-45, -28);
    ctx.closePath();
    ctx.fill();

    // Cockpit windows & cartoon confused eyes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(85, -22, 34, 18, 4);
    ctx.fill();

    // Confused googly eyes
    const eyeShift = crashed ? 0 : Math.sin(now * 0.005) * 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(96, -13, 6, 0, Math.PI * 2);
    ctx.arc(110, -13, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = crashed ? '#dc2626' : '#0f172a';
    ctx.beginPath();
    if (crashed) {
      // X eyes when crashed
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.5;
      ctx.moveTo(93, -16); ctx.lineTo(99, -10);
      ctx.moveTo(99, -16); ctx.lineTo(93, -10);
      ctx.moveTo(107, -16); ctx.lineTo(113, -10);
      ctx.moveTo(113, -16); ctx.lineTo(107, -10);
      ctx.stroke();
    } else {
      ctx.arc(96 + eyeShift, -13, 3, 0, Math.PI * 2);
      ctx.arc(110 + eyeShift, -13, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Engine pod
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.roundRect(-30, 18, 48, 18, 8);
    ctx.fill();

    // Pretzel in front when cashed out!
    if (cashed) {
      ctx.font = '36px sans-serif';
      ctx.fillText('🥨', 125, -35);
    }
    ctx.restore();

    // 5. Crash Overlay & Massive "GROUND STOP" Siren Stamp
    if (crashed) {
      const redFlash = Math.sin(crashAgeSec * 18);
      ctx.fillStyle = `rgba(220, 38, 38, ${0.28 + 0.15 * redFlash})`;
      ctx.fillRect(0, 0, 960, 540);

      // Flashing beam from tower
      ctx.save();
      ctx.translate(744, 62);
      ctx.rotate(sirenSpin * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 900, -0.3, 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Big "GROUND STOP" rubber stamp
      ctx.save();
      ctx.translate(480, 260);
      ctx.rotate(-0.08);
      const stampScale = clamp01(crashAgeSec * 5);
      ctx.scale(stampScale, stampScale);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 10;
      ctx.strokeRect(-260, -55, 520, 110);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(-260, -55, 520, 110);
      ctx.fillStyle = '#f87171';
      ctx.font = '900 64px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GROUND STOP', 0, 0);
      ctx.restore();
    }

    // 6. HUD Header & Multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title & Subtitle
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('GROUND STOP SHUFFLE', 480, 48);

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('NAVIGATE THE TAXIWAY BEFORE RADAR BSOD & LOCKDOWN', 480, 82);

    // Main Multiplier Readout
    const multColor = crashed ? '#f87171' : cashed ? '#86efac' : tension > 0.6 ? '#f59e0b' : '#38bdf8';
    const multPunch = crashed ? (1 - clamp01((crashAgeSec - 0.12) / 0.25)) ** 2 : 0;
    ctx.font = `900 ${84 * (1 + 0.18 * multPunch)}px ui-monospace, monospace`;
    ctx.fillStyle = multColor;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 18;
    ctx.fillText(formatX(view.currentX100), 480, 142);
    ctx.shadowBlur = 0;

    // Milestone / Status Banner
    const currentMilestone = running ? MILESTONES[milestoneCount - 1] : undefined;
    const statusText = currentMilestone?.[1] ?? (
      view.phase === 'betting' ? 'Taxi clearance requested · Set credits' :
      view.phase === 'waiting' ? 'Holding short of runway · Ready soon' :
      crashed ? 'Tower declared immediate nationwide halt!' : 'Apron rolling smooth'
    );
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 192);

    // Stake line
    const [lineText, lineColor] = stakeLine(view);
    ctx.fillStyle = lineColor;
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 508);

    ctx.restore();
  }

  return { draw };
}
