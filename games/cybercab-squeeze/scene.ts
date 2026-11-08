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

const MILESTONES: [number, string][] = [
  [120, 'Liquid silver sprayers prime the exterior'],
  [150, 'Robotic arms weld gull-wing hinges rapidly'],
  [200, 'Compact 40kWh battery pack clicks in'],
  [250, 'Steering wheel is thrown into recycling bin'],
  [300, 'AI lidar cameras spin into hyper overdrive'],
  [500, 'Cybertruck crew reassigned to push by hand'],
  [1000, 'Driverless fleet swarms the test track'],
  [10000, 'Liquid paint turns mirror-sheen blinding'],
  [100000, 'Autonomous taxis outnumber human pedestrians'],
  [1000000, 'Terrestrial transit officially solved forever'],
];

const COLOURS = {
  bgTop: '#0b0f19',
  bgBottom: '#182338',
  cyberGlow: '#00e5ff',
  liquidSilver: '#e2e8f0',
  paintSpray: '#94a3b8',
  hazardYellow: '#fbbf24',
  hazardDark: '#1f2937',
  accentGreen: '#10b981',
  alertRed: '#ef4444',
  textMuted: '#94a3b8',
  neonOrange: '#f97316',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Delivered to open highway at ${formatX(view.cashoutX100)} · fares secured!`, COLOURS.accentGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Assembly short-circuited · no credits riding' : 'Watching the line · no credits riding', COLOURS.textMuted];
  }
  if (crashed) return [`Scrapped in the crash · lost ${credits(view.stake)}`, COLOURS.alertRed];
  return [`Cybercab on line · ${credits(view.stake)} riding`, COLOURS.cyberGlow];
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let sparks: Spark[] = [];

  function spawnSparks(x: number, y: number, count: number, spraySilver = false) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 1.5;
      const speed = 60 + Math.random() * 220;
      sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.25 + Math.random() * 0.45,
        color: spraySilver
          ? (Math.random() > 0.5 ? '#e2e8f0' : '#38bdf8')
          : (Math.random() > 0.4 ? '#fbbf24' : '#ef4444'),
      });
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const speed = running ? 1 + tension * 3 : crashed ? 0.1 : 0.6;
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.5) ** 2 : 0;

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (prevPhase !== null && running && cashedOut && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
      audio.fx('whoosh', 0.7);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1200);
      audio.fx('zap', 1.0);
      spawnSparks(480, 360, 40);
    }
    if (running && prevPhase === 'running' && milestoneIdx > prevMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('spray', 0.8);
      audio.fx('ratchet', 0.6);
      spawnSparks(390, 330, 18, true);
      spawnSparks(570, 330, 18, true);
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    ctx.save();
    ctx.translate(shake * Math.sin(age * 80), shake * Math.sin(age * 61));

    // Background: Factory wall / Sunset highway when cashed out
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    if (cashedOut) {
      bgGrad.addColorStop(0, '#1e113a');
      bgGrad.addColorStop(0.5, '#581c87');
      bgGrad.addColorStop(0.8, '#ea580c');
      bgGrad.addColorStop(1, '#1c1917');
    } else {
      bgGrad.addColorStop(0, COLOURS.bgTop);
      bgGrad.addColorStop(0.65, COLOURS.bgBottom);
      bgGrad.addColorStop(1, '#090d16');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Factory background trusses & safety strobes
    const timeSec = view.elapsed / 1000;
    ctx.save();
    ctx.strokeStyle = cashedOut ? 'rgba(255,255,255,0.06)' : 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 3;
    for (let x = -40; x <= 1000; x += 110) {
      const offset = (view.elapsed * 0.12 * speed) % 110;
      const gx = x - offset;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx + 60, 380);
      ctx.stroke();
    }
    // Overhead assembly rail
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 70, 960, 16);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 86, 960, 6);
    ctx.restore();

    // Alarm beacon atop factory
    const sirenFlicker = running && Math.sin(timeSec * (8 + tension * 16)) > 0;
    if (sirenFlicker && !cashedOut) {
      ctx.save();
      const sirenGrad = ctx.createRadialGradient(480, 70, 10, 480, 70, 240);
      sirenGrad.addColorStop(0, tension > 0.5 ? 'rgba(239,68,68,0.35)' : 'rgba(251,191,36,0.25)');
      sirenGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sirenGrad;
      ctx.fillRect(0, 0, 960, 360);
      ctx.restore();
    }

    // Conveyor Belt Floor (Y: 380 - 460)
    const beltY = 380;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, beltY, 960, 80);
    // Animated hazard stripes on conveyor edge
    const stripeOffset = (view.elapsed * 0.35 * speed) % 40;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, beltY, 960, 14);
    ctx.clip();
    for (let sx = -40; sx < 1000; sx += 40) {
      ctx.fillStyle = (Math.floor((sx + stripeOffset) / 40) % 2 === 0) ? COLOURS.hazardYellow : COLOURS.hazardDark;
      ctx.beginPath();
      ctx.moveTo(sx + stripeOffset, beltY);
      ctx.lineTo(sx + stripeOffset + 24, beltY);
      ctx.lineTo(sx + stripeOffset + 14, beltY + 14);
      ctx.lineTo(sx + stripeOffset - 10, beltY + 14);
      ctx.fill();
    }
    ctx.restore();

    // Rollers beneath belt
    ctx.fillStyle = '#334155';
    for (let rx = 20; rx < 960; rx += 70) {
      ctx.beginPath();
      ctx.arc(rx, beltY + 36, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Protagonist: Cybercab
    const cabCenterX = 480 + (cashedOut ? Math.min(180, (view.elapsed % 1000) * 0.25) : 0);
    const cabBob = running ? Math.sin(timeSec * (12 + tension * 8)) * (2 + tension * 3) : 0;
    const cabY = 352 + cabBob + (crashed ? Math.min(30, age * 60) : 0);
    const cabW = 270;
    const cabH = 74;

    ctx.save();
    ctx.translate(cabCenterX, cabY);
    if (crashed) {
      const tilt = Math.min(0.35, age * 1.5);
      ctx.rotate(-tilt);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 24, cabW * 0.52, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body: Sleek Cybercab aerodynamic wedge
    const silverGrad = ctx.createLinearGradient(-cabW / 2, -cabH / 2, cabW / 2, cabH / 2);
    silverGrad.addColorStop(0, '#f8fafc');
    silverGrad.addColorStop(0.3, '#cbd5e1');
    silverGrad.addColorStop(0.6, '#94a3b8');
    silverGrad.addColorStop(1, '#475569');

    ctx.fillStyle = silverGrad;
    ctx.beginPath();
    // Angular Cybercab silhouette
    ctx.moveTo(-cabW * 0.48, 12); // rear bumper
    ctx.lineTo(-cabW * 0.46, -6); // rear deck
    ctx.lineTo(-cabW * 0.25, -cabH * 0.52); // roof back
    ctx.lineTo(cabW * 0.14, -cabH * 0.52); // roof apex
    ctx.lineTo(cabW * 0.46, 0); // nose dip
    ctx.lineTo(cabW * 0.49, 14); // front chin
    ctx.lineTo(cabW * 0.40, 16);
    ctx.arc(cabW * 0.28, 16, 22, 0, Math.PI, true); // front wheel well
    ctx.lineTo(-cabW * 0.16, 16);
    ctx.arc(-cabW * 0.28, 16, 22, 0, Math.PI, true); // rear wheel well
    ctx.closePath();
    ctx.fill();

    // Glass Canopy (Dark mirror tint, no steering wheel!)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-cabW * 0.22, -cabH * 0.48);
    ctx.lineTo(cabW * 0.10, -cabH * 0.48);
    ctx.lineTo(cabW * 0.32, -4);
    ctx.lineTo(-cabW * 0.22, -4);
    ctx.closePath();
    ctx.fill();

    // Canopy cyan glint
    ctx.strokeStyle = cashedOut ? COLOURS.accentGreen : 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-cabW * 0.18, -cabH * 0.44);
    ctx.lineTo(cabW * 0.08, -cabH * 0.44);
    ctx.lineTo(cabW * 0.25, -6);
    ctx.stroke();

    // Gull-Wing Door Line (Open slightly during assembly, shut on cashout!)
    if (!cashedOut && !crashed) {
      const doorOpen = Math.min(22, 6 + tension * 16);
      ctx.strokeStyle = COLOURS.liquidSilver;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-cabW * 0.12, -cabH * 0.52);
      ctx.lineTo(-cabW * 0.08, -cabH * 0.52 - doorOpen);
      ctx.lineTo(cabW * 0.06, -cabH * 0.52 - doorOpen);
      ctx.lineTo(cabW * 0.04, -cabH * 0.52);
      ctx.stroke();
    }

    // Cyber lightbar (Front & Rear)
    // Front sleek amber/white bar
    ctx.fillStyle = cashedOut ? '#4ade80' : '#e0f2fe';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fillRect(cabW * 0.44, -1, 10, 4);
    // Rear red horizon bar
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillRect(-cabW * 0.47, -4, 8, 3);
    ctx.shadowBlur = 0;

    // AI Vision Cam array on roof
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, -cabH * 0.52 - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Wheels (Spinning disks or popping off on crash)
    const wheelY = 16;
    const wheels = [cabW * 0.28, -cabW * 0.28];
    wheels.forEach((wx, i) => {
      ctx.save();
      if (crashed) {
        // comedic popping off in arcs!
        const flyT = Math.min(1.5, age * 3);
        const flyX = (i === 0 ? 1 : -1) * flyT * 70;
        const flyY = -flyT * 120 + 0.5 * 380 * flyT * flyT;
        ctx.translate(wx + flyX, wheelY + flyY);
        ctx.rotate(age * 12 * (i === 0 ? 1 : -1));
      } else {
        ctx.translate(wx, wheelY);
        ctx.rotate(timeSec * 16 * speed);
      }
      // Tire
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      // Cyber Aero Cover
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(-2, -12, 4, 24);
      ctx.fillRect(-12, -2, 24, 4);
      ctx.restore();
    });

    ctx.restore();

    // Overhead Robotic Arms (Left & Right welding / spraying)
    if (!crashed) {
      const armAnim = Math.sin(timeSec * (6 + tension * 10));
      // Left Welder
      ctx.save();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(330, 92);
      ctx.lineTo(360 + armAnim * 15, 230);
      ctx.lineTo(410 + armAnim * 20, 310);
      ctx.stroke();
      // Welder head
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(410 + armAnim * 20, 310, 8, 0, Math.PI * 2);
      ctx.fill();
      // Sparks
      if (running && Math.random() < 0.35 + tension * 0.45) {
        spawnSparks(410 + armAnim * 20, 310, 4, false);
      }
      ctx.restore();

      // Right Liquid Silver Paint Sprayer
      ctx.save();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(630, 92);
      ctx.lineTo(600 - armAnim * 15, 230);
      ctx.lineTo(550 - armAnim * 20, 305);
      ctx.stroke();
      // Nozzle
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(550 - armAnim * 20, 305, 8, 0, Math.PI * 2);
      ctx.fill();
      // Paint mist
      if (running && Math.random() < 0.4 + tension * 0.5) {
        spawnSparks(550 - armAnim * 20, 305, 5, true);
      }
      ctx.restore();
    }

    // Active Sparks & Particles
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      if (s === undefined) continue;
      s.x += s.vx * 0.016;
      s.y += s.vy * 0.016;
      s.vy += 320 * 0.016; // gravity
      s.life -= 0.016;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5 * (s.life / 0.7), 0, Math.PI * 2);
      ctx.fill();
    }

    // Speed bump on crash
    if (crashed) {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(470, 376, 50, 14, 6);
      ctx.fill();
      // Warning banner
      ctx.fillStyle = '#f87171';
      ctx.font = '700 18px monospace';
      ctx.fillText('SPEED BUMP COLLAPSE!', 480, 412);
    }

    // HUD & Multiplier Presentation
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Factory Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px system-ui, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('CYBERCAB SQUEEZE', 480, 40);

    ctx.font = '600 14px monospace';
    ctx.fillStyle = cashedOut ? COLOURS.accentGreen : COLOURS.cyberGlow;
    ctx.fillText(cashedOut ? 'AUTONOMOUS FLEET DISPATCHED · FARES RUNNING' : 'HIGH-SPEED ROBOTIC GIGAFACTORY', 480, 68);

    // Multiplier Callout
    const multColor = crashed ? COLOURS.alertRed : cashedOut ? COLOURS.accentGreen : '#ffffff';
    ctx.fillStyle = multColor;
    ctx.font = `800 ${crashed ? 76 : 84}px ui-monospace, monospace`;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = running ? 12 + tension * 16 : 4;
    ctx.fillText(formatX(view.currentX100), 480, 160);
    ctx.shadowBlur = 0;

    // Milestone / Assembly step badge
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const badgeText = cashedOut
      ? 'CRUISING INTO SUNSET · FARES SECURED'
      : (activeMilestone ? activeMilestone[1] : (crashed ? 'SHORT CIRCUIT DETECTED' : 'ALIGNING GULL-WING CHASSIS'));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(160, 206, 640, 36, 18);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.alertRed : cashedOut ? COLOURS.accentGreen : 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = crashed ? COLOURS.alertRed : cashedOut ? COLOURS.accentGreen : COLOURS.liquidSilver;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(badgeText, 480, 224);

    // Bottom Stake Info
    const [statusText, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(statusText, 480, 498);

    ctx.restore();
  }

  return { draw };
}
