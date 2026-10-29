/**
 * Overnight GPU - Canvas 2D Scene
 * Ship 300 server racks overnight for fifty bucks before the postal van snaps!
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

const COLOURS = {
  bgTop: '#090a14',
  bgBot: '#151024',
  asphalt: '#1a1829',
  roadLine: '#f9d423',
  neonCyan: '#00f3ff',
  neonMagenta: '#ff007f',
  neonGreen: '#39ff14',
  gold: '#ffb703',
  vanBlue: '#1d4ed8',
  vanRust: '#b91c1c',
  courierSkin: '#f6d8ae',
  courierUniform: '#1e3a8a',
  text: '#f8fafc',
  muted: '#94a3b8',
  crashed: '#ef4444',
  cashedOut: '#10b981',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Hatchback trunk slams shut over loose wires'],
  [150, 'Courier pockets fifty bucks cash shipping fee'],
  [200, 'First hundred server racks ratchet-strapped tight'],
  [250, 'Suspension scrapes ground with loud metal sparks'],
  [300, 'RGB server fans spin fast enough to lift tires'],
  [500, 'eBay buyer demands live tracking update now'],
  [1000, '9,000 graphics cards begin mining mid-transit'],
  [10000, 'Local grid dims as roadside outlets get tapped'],
  [100000, 'Liquid nitrogen coolant leaks through tailpipe'],
  [1000000, 'Overnight parcel ascends into orbital freight'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Signed delivery clipboard at ${formatX(view.cashoutX100)} · Fifty bucks secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Hatchback snapped! Watching safely' : 'Spectating delivery run · No credits on parcel', COLOURS.muted];
  }
  if (crashed) {
    return [`${credits(view.stake)} vanished in smoking silicon confetti`, COLOURS.crashed];
  }
  return [`${credits(view.stake)} riding on this AI supercluster`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'phonk', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let sparkTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    audio.update(view.phase, tension);

    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.85);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('boom', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIdx > prevMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('ratchet', 0.7);
      }
      sparkTick += 1;
      if (sparkTick % 12 === 0 && tension > 0.4 && view.cashoutX100 === null) {
        audio.fx('zap', 0.35 + 0.45 * tension);
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 14 * clamp01(1 - crashSec / 0.6) ** 2
      : running
        ? (1.2 + 5 * tension) * Math.sin(view.elapsed * 0.05)
        : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(view.elapsed * 0.1), shake * Math.cos(view.elapsed * 0.13));

    // Sky & Cyber Highway Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, COLOURS.bgTop);
    skyGrad.addColorStop(1, COLOURS.bgBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // City lights / Data center skyline
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 18; i++) {
      const bx = i * 56 - (running ? (view.elapsed * 0.04) % 56 : 0);
      const bh = 70 + ((i * 37) % 90);
      ctx.fillRect(bx, 360 - bh, 46, bh);
      // Blinking server lights in windows
      if ((i + Math.floor(view.elapsed / 250)) % 3 === 0) {
        ctx.fillStyle = i % 2 === 0 ? COLOURS.neonCyan : COLOURS.neonMagenta;
        ctx.fillRect(bx + 12, 360 - bh + 14, 4, 4);
        ctx.fillRect(bx + 26, 360 - bh + 28, 4, 4);
        ctx.fillStyle = '#0f172a';
      }
    }

    // Asphalt Road
    ctx.fillStyle = COLOURS.asphalt;
    ctx.fillRect(0, 360, 960, 180);

    // Road lines (speed lines)
    const roadSpeed = running ? (view.elapsed * 0.8) % 80 : 0;
    ctx.fillStyle = COLOURS.roadLine;
    for (let rx = -80; rx < 1040; rx += 80) {
      ctx.fillRect(rx - roadSpeed, 475, 48, 6);
    }

    // Roadside electric sparks if suspension scrapes
    if (running && tension > 0.3) {
      ctx.strokeStyle = COLOURS.neonCyan;
      ctx.lineWidth = 2;
      for (let s = 0; s < 5; s++) {
        const sx = 440 + Math.sin(view.elapsed * 0.2 + s) * 50;
        const sy = 460 + Math.random() * 12;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 20 - Math.random() * 25, sy - 8 - Math.random() * 10);
        ctx.stroke();
      }
    }

    // Delivery Hatchback & Giant Server Rack Stack Centerpiece
    const carBaseX = 420;
    const sag = running ? Math.min(26, tension * 28 + Math.sin(view.elapsed * 0.03) * 3) : 0;
    const carY = 410 + sag;
    const stackTilt = running ? Math.sin(view.elapsed * 0.008) * (0.04 + tension * 0.12) : 0;

    // Draw Racks & Hatchback
    ctx.save();
    ctx.translate(carBaseX, carY);

    if (crashed) {
      const explodeT = Math.min(1.5, crashSec);
      // Exploded GPU confetti & shattered chassis
      ctx.fillStyle = COLOURS.crashed;
      ctx.beginPath();
      ctx.arc(0, 0, 45 + explodeT * 90, 0, Math.PI * 2);
      ctx.stroke();

      for (let g = 0; g < 18; g++) {
        const ang = (g / 18) * Math.PI * 2 + explodeT;
        const dist = explodeT * 180 + (g % 3) * 30;
        const gx = Math.cos(ang) * dist;
        const gy = Math.sin(ang) * dist + explodeT * explodeT * 80;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(explodeT * 6 + g);
        // Small GPU card
        ctx.fillStyle = '#059669';
        ctx.fillRect(-14, -8, 28, 16);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-12, 6, 24, 3);
        ctx.fillStyle = COLOURS.neonCyan;
        ctx.beginPath();
        ctx.arc(0, -1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // Fiber Optic Cables trailing behind
      ctx.lineWidth = 3;
      for (let c = 0; c < 4; c++) {
        ctx.strokeStyle = c % 2 === 0 ? COLOURS.neonCyan : COLOURS.neonMagenta;
        ctx.beginPath();
        ctx.moveTo(-90, -30 + c * 14);
        ctx.bezierCurveTo(
          -160,
          -10 + Math.sin(view.elapsed * 0.02 + c) * 15,
          -220,
          20 + c * 6,
          -280,
          35 + Math.cos(view.elapsed * 0.03 + c) * 8
        );
        ctx.stroke();
      }

      // Massive Tower of Server Racks Stacked Vertically
      ctx.save();
      ctx.rotate(stackTilt);
      const rackCount = Math.min(7, 3 + Math.floor(depth * 5));
      for (let r = 0; r < rackCount; r++) {
        const ry = -70 - r * 38;
        const rw = 120 - r * 4;
        // Rack Chassis
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-rw / 2, ry, rw, 34);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(-rw / 2, ry, rw, 34);

        // Rack drive bays & RGB fans
        const fanColor = ((view.elapsed * 0.01 + r) % 2 > 1) ? COLOURS.neonCyan : COLOURS.neonMagenta;
        ctx.fillStyle = fanColor;
        for (let f = 0; f < 3; f++) {
          ctx.beginPath();
          ctx.arc(-rw / 2 + 20 + f * 34, ry + 17, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        // Blinking server status LEDs
        ctx.fillStyle = COLOURS.neonGreen;
        ctx.fillRect(rw / 2 - 16, ry + 8, 4, 4);
        ctx.fillRect(rw / 2 - 16, ry + 16, 4, 4);
        ctx.fillRect(rw / 2 - 16, ry + 24, 4, 4);
      }

      // Yellow Ratchet Straps holding racks to the roof
      ctx.strokeStyle = COLOURS.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-60, -20);
      ctx.lineTo(-40, -70 - rackCount * 36);
      ctx.lineTo(40, -70 - rackCount * 36);
      ctx.lineTo(60, -20);
      ctx.stroke();
      ctx.restore();

      // Hatchback Car Body
      ctx.fillStyle = COLOURS.vanBlue;
      ctx.beginPath();
      ctx.roundRect(-80, -35, 170, 48, 10);
      ctx.fill();

      // Trunk open with glowing server cards visible inside
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-85, -28, 28, 38);
      ctx.fillStyle = COLOURS.neonGreen;
      ctx.fillRect(-80, -22, 18, 5);
      ctx.fillRect(-80, -12, 18, 5);

      // Hatchback Windshield & Windows
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(35, -34);
      ctx.lineTo(75, -16);
      ctx.lineTo(35, -16);
      ctx.closePath();
      ctx.fill();

      // Van Wheels (bent / squashed under load)
      const wheelSquash = 1 + tension * 0.35;
      ctx.fillStyle = '#111827';
      // Front wheel
      ctx.beginPath();
      ctx.ellipse(55, 18, 18, 18 / wheelSquash, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rear wheel
      ctx.beginPath();
      ctx.ellipse(-45, 18, 18, 18 / wheelSquash, 0, 0, Math.PI * 2);
      ctx.fill();

      // Postal Courier sweaty runner beside hatchback
      const courierX = 115;
      const courierY = 2;
      // Head
      ctx.fillStyle = COLOURS.courierSkin;
      ctx.beginPath();
      ctx.arc(courierX, courierY - 26, 11, 0, Math.PI * 2);
      ctx.fill();
      // Postal Cap
      ctx.fillStyle = COLOURS.courierUniform;
      ctx.fillRect(courierX - 12, courierY - 37, 24, 7);
      ctx.fillRect(courierX - 4, courierY - 34, 18, 4);
      // Sweat droplets flying off
      if (running && tension > 0.2) {
        ctx.fillStyle = COLOURS.neonCyan;
        ctx.beginPath();
        ctx.arc(courierX - 14, courierY - 30 + Math.sin(view.elapsed * 0.05) * 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Torso & Clipboard
      ctx.fillStyle = COLOURS.courierUniform;
      ctx.fillRect(courierX - 8, courierY - 15, 16, 24);
      // Delivery Clipboard in hands
      ctx.fillStyle = '#b45309';
      ctx.fillRect(courierX + 8, courierY - 14, 14, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(courierX + 10, courierY - 12, 10, 14);

      // Priority Mail Stamp celebration when cashed out!
      if (view.cashoutX100 !== null) {
        ctx.save();
        ctx.translate(courierX + 15, courierY - 45);
        ctx.rotate(-0.15);
        ctx.fillStyle = COLOURS.cashedOut;
        ctx.fillRect(-35, -16, 74, 30);
        ctx.fillStyle = '#064e3b';
        ctx.font = '900 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PRIORITY', 2, -2);
        ctx.fillText('DELIVERED', 2, 9);
        ctx.restore();
      }
    }
    ctx.restore();

    // Comical Dashboard / Status Gauges
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(40, 38, 250, 72, 10);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('LOAD: 300 SERVER RACKS', 56, 60);
    ctx.fillText(`CARGO TEMP: ${Math.min(999, Math.floor(65 + tension * 240))}°C`, 56, 80);
    ctx.fillText(`SHIPPING FEE: $50.00 FLAT`, 56, 100);

    // Multiplier Center Display
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.neonCyan;
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.text;
    ctx.fillText('OVERNIGHT GPU', 480, 52);

    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.gold;
    ctx.fillText('⚡ 60-MILLION-DOLLAR SUPERCLUSTER IN A HATCHBACK ⚡', 480, 84);

    // Huge Multiplier readout
    ctx.fillStyle = multColor;
    ctx.font = '900 84px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 160);

    // Milestone / Phase Badge
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const bannerText = activeMilestone?.[1] ?? (crashed ? 'CHASSIS SNAPPED · SMOKING SILICON' : view.phase === 'betting' ? 'Ready to load parcel racks' : 'Awaiting dispatch order');

    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(180, 222, 600, 38, 8);
    ctx.fill();
    ctx.strokeStyle = multColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLOURS.text;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 241);

    // Stake line / safe celebration
    const [stkText, stkColor] = stakeLine(view);
    ctx.fillStyle = stkColor;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(stkText, 480, 510);

    ctx.restore();
  }

  return { draw };
}
