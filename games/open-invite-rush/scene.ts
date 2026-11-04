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
  skyDay: '#68b5e8',
  skyDusk: '#3d2568',
  grass: '#43993d',
  lawnTrim: '#32772d',
  gazeboWood: '#f7f4ea',
  veil: '#ffffff',
  tuxedo: '#1b1e2e',
  brideDress: '#fffbf0',
  accentGold: '#ffc83b',
  textLight: '#ffffff',
  textMuted: '#d9e6f2',
  crashed: '#ff4d6d',
  cashedOut: '#38e078',
  toasterSilver: '#d8e2dc',
  caution: '#ffb703',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Five random delivery drivers grab appetizers'],
  [150, 'A church choir arrives with four upright pianos'],
  [200, 'Neighborhood uncle unloads six prize dairy goats'],
  [250, 'Highway traffic diverts straight onto the lawn'],
  [300, 'Local car dealership parks three SUVs as gifts'],
  [500, 'Guest list hits 10,000 as DJs set up stages'],
  [1000, 'Satellite news choppers circle over buffet line'],
  [10000, 'Gift table collapses under 4,000 toaster ovens'],
  [100000, 'Entire county declared an unsanctioned festival'],
  [1000000, '30,000 guests form galaxy-scale conga line'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function estimateGuests(x100: number): number {
  if (x100 <= 100) return 2;
  const ratio = x100 / 100;
  return Math.min(30000, Math.floor(2 + Math.pow(ratio, 1.9) * 14));
}

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Escaped reception at ${formatX(view.cashoutX100)} with wedding cake!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Party stampede watched · no credits lost' : 'Watching the yard swell · no credits riding', COLOURS.textMuted];
  }
  if (crashed) return [`Buffet overrun! Lost ${credits(view.stake)} under the crowd`, COLOURS.crashed];
  return [`Protecting the vows · ${credits(view.stake)} riding`, COLOURS.accentGold];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'crowd' });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastHonkSecond = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const guestCount = estimateGuests(view.currentX100);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.8);
      audio.fx('engine', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('crowd', previousPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.7);
      audio.fx('shatter', 0.6);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('airhorn', 0.5 + 0.5 * tension);
      }
      const sec = Math.floor(view.elapsed / 900);
      if (sec > lastHonkSecond && tension > 0.4) {
        lastHonkSecond = sec;
        audio.fx(sec % 2 === 0 ? 'whistle' : 'camera', 0.3 + 0.4 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - age / 0.6) ** 2 : (running ? Math.sin(view.elapsed * 0.02) * tension * 2.5 : 0);

    ctx.save();
    ctx.translate(shake * Math.sin(age * 60 + view.elapsed * 0.05), shake * Math.cos(age * 45));

    // 1. SKY & DYNAMIC WEDDING PARTY LIGHTING
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    if (tension < 0.5) {
      skyGrad.addColorStop(0, COLOURS.skyDay);
      skyGrad.addColorStop(1, '#a8e0f5');
    } else {
      skyGrad.addColorStop(0, COLOURS.skyDusk);
      skyGrad.addColorStop(0.7, '#833ab4');
      skyGrad.addColorStop(1, '#fd1d1d');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Flashing festival disco beams when crowded
    if (tension > 0.45 && !crashed) {
      const beamPhase = (view.elapsed * 0.003) % (Math.PI * 2);
      ctx.save();
      ctx.globalAlpha = 0.18 * tension;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ff00aa' : '#00f6ff';
        ctx.beginPath();
        const beamX = 200 + i * 190 + Math.sin(beamPhase + i) * 80;
        ctx.moveTo(beamX, 0);
        ctx.lineTo(beamX - 120, 420);
        ctx.lineTo(beamX + 120, 420);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Distant suburban fence & suburban hedge
    ctx.fillStyle = '#225522';
    ctx.fillRect(0, 310, 960, 40);
    ctx.fillStyle = '#ece8dd';
    for (let x = 0; x < 960; x += 32) {
      ctx.fillRect(x, 280, 20, 40);
      ctx.beginPath();
      ctx.moveTo(x, 280);
      ctx.lineTo(x + 10, 268);
      ctx.lineTo(x + 20, 280);
      ctx.fill();
    }

    // Lush Backyard Grass
    ctx.fillStyle = COLOURS.grass;
    ctx.fillRect(0, 330, 960, 210);
    ctx.fillStyle = COLOURS.lawnTrim;
    ctx.fillRect(0, 330, 960, 6);

    // 2. WEDDING CEREMONY STAGE & GAZEBO
    const stageY = 320;
    const gazeboCollapsed = crashed && age > 0.1;
    ctx.save();
    if (!gazeboCollapsed) {
      // Gazebo columns & arch
      ctx.strokeStyle = COLOURS.gazeboWood;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(380, stageY + 50);
      ctx.lineTo(380, stageY - 90);
      ctx.arc(480, stageY - 90, 100, Math.PI, 0, false);
      ctx.lineTo(580, stageY + 50);
      ctx.stroke();

      // Floral garlands & roses
      ctx.fillStyle = '#ff758f';
      for (let a = Math.PI; a <= 2 * Math.PI; a += 0.3) {
        const gx = 480 + 102 * Math.cos(a);
        const gy = stageY - 90 + 102 * Math.sin(a);
        ctx.beginPath();
        ctx.arc(gx, gy, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      // "JUST MARRIED" banner
      ctx.fillStyle = '#fff8e7';
      ctx.fillRect(400, stageY - 145, 160, 26);
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 2;
      ctx.strokeRect(400, stageY - 145, 160, 26);
      ctx.fillStyle = '#8b263e';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JUST MARRIED(?!)', 480, stageY - 128);
    } else {
      // Gazebo wrecked!
      ctx.strokeStyle = '#c2baa8';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(350, stageY + 45);
      ctx.lineTo(440, stageY + 20);
      ctx.lineTo(550, stageY + 40);
      ctx.stroke();
    }
    ctx.restore();

    // 3. PROTAGONISTS (GROOM & BRIDE) vs CASHOUT GETAWAY CART
    const coupleSafe = view.cashoutX100 !== null;
    const cartX = coupleSafe ? 380 + Math.min(540, (view.elapsed * 0.45) % 900) : 480;

    if (coupleSafe) {
      // Fast Getaway Golf Cart peeling away!
      const cartY = 360 + Math.sin(view.elapsed * 0.04) * 3;
      // Dust clouds behind cart
      ctx.fillStyle = 'rgba(230, 230, 200, 0.6)';
      for (let d = 1; d <= 3; d++) {
        ctx.beginPath();
        ctx.arc(cartX - 70 - d * 22, cartY + 18, 14 + d * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Golf Cart body
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cartX - 50, cartY - 15, 90, 30);
      ctx.fillStyle = '#2b7fff';
      ctx.fillRect(cartX - 35, cartY - 45, 60, 10); // roof
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cartX - 30, cartY - 15);
      ctx.lineTo(cartX - 30, cartY - 40);
      ctx.moveTo(cartX + 20, cartY - 15);
      ctx.lineTo(cartX + 20, cartY - 40);
      ctx.stroke();

      // Wheels
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(cartX - 30, cartY + 20, 14, 0, Math.PI * 2);
      ctx.arc(cartX + 25, cartY + 20, 14, 0, Math.PI * 2);
      ctx.fill();

      // Couple in cart holding intact wedding cake
      // Groom driving
      ctx.fillStyle = COLOURS.tuxedo;
      ctx.fillRect(cartX + 5, cartY - 26, 14, 18);
      ctx.fillStyle = '#f8c09d';
      ctx.beginPath();
      ctx.arc(cartX + 12, cartY - 32, 7, 0, Math.PI * 2);
      ctx.fill();

      // Bride holding huge cake
      ctx.fillStyle = COLOURS.brideDress;
      ctx.fillRect(cartX - 18, cartY - 26, 14, 18);
      ctx.fillStyle = '#f8c09d';
      ctx.beginPath();
      ctx.arc(cartX - 11, cartY - 32, 7, 0, Math.PI * 2);
      ctx.fill();
      // Flowing veil behind
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cartX - 14, cartY - 34);
      ctx.quadraticCurveTo(cartX - 45, cartY - 30, cartX - 60, cartY - 15);
      ctx.stroke();

      // Wedding cake tiers
      ctx.fillStyle = '#fff0f5';
      ctx.fillRect(cartX - 6, cartY - 48, 16, 9);
      ctx.fillRect(cartX - 9, cartY - 39, 22, 10);
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(cartX + 2, cartY - 50, 3, 0, Math.PI * 2);
      ctx.fill();

      // "JUST ESCAPED" streamer with cans
      ctx.fillStyle = '#ffef9f';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('JUST ESCAPED! 🎂💨', cartX - 10, cartY + 45);
    } else if (!crashed) {
      // Groom & Bride on folding chairs trembling on lawn
      const bob = Math.sin(view.elapsed * (0.01 + tension * 0.02)) * (4 + tension * 10);
      const px = 460;
      const py = 350 + bob;

      // Groom (terrified)
      ctx.fillStyle = COLOURS.tuxedo;
      ctx.fillRect(px - 22, py - 35, 20, 38);
      // Bowtie
      ctx.fillStyle = '#d90429';
      ctx.beginPath();
      ctx.arc(px - 12, py - 32, 3, 0, Math.PI * 2);
      ctx.fill();
      // Face
      ctx.fillStyle = '#f8c09d';
      ctx.beginPath();
      ctx.arc(px - 12, py - 46, 10, 0, Math.PI * 2);
      ctx.fill();
      // Panicked eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(px - 15, py - 49, 4, 5);
      ctx.fillRect(px - 10, py - 49, 4, 5);
      ctx.fillStyle = '#000';
      ctx.fillRect(px - 14, py - 47, 2, 2);
      ctx.fillRect(px - 9, py - 47, 2, 2);

      // Bride (gripping groom)
      ctx.fillStyle = COLOURS.brideDress;
      ctx.beginPath();
      ctx.moveTo(px + 6, py - 35);
      ctx.lineTo(px + 24, py + 3);
      ctx.lineTo(px - 6, py + 3);
      ctx.closePath();
      ctx.fill();
      // Veil
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(px + 10, py - 48, 14, 0, Math.PI * 2);
      ctx.fill();
      // Face
      ctx.fillStyle = '#fdd9b5';
      ctx.beginPath();
      ctx.arc(px + 10, py - 45, 9, 0, Math.PI * 2);
      ctx.fill();

      // Sweating drops
      if (tension > 0.3) {
        ctx.fillStyle = '#00b4d8';
        ctx.beginPath();
        ctx.arc(px - 2, py - 52 - (view.elapsed % 400) * 0.04, 3, 0, Math.PI * 2);
        ctx.arc(px + 20, py - 50 - (view.elapsed % 500) * 0.04, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. GIFT TABLE PILE (Appliances, goats, toaster ovens, sofas)
    const giftCount = Math.min(28, Math.floor(tension * 28) + 2);
    const tableX = 640;
    const tableY = 360;

    // Table base
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(tableX - 60, tableY + 5, 120, 10);
    ctx.fillRect(tableX - 55, tableY + 15, 10, 30);
    ctx.fillRect(tableX + 45, tableY + 15, 10, 30);

    // Stacking chaotic wedding gifts
    for (let i = 0; i < giftCount; i++) {
      const gx = tableX - 50 + (i % 5) * 24 + ((i * 7) % 15) - 8;
      const gy = tableY - 10 - Math.floor(i / 4) * 16;
      if (i === 12) {
        // Prize goat on the table
        ctx.fillStyle = '#f0ebe3';
        ctx.fillRect(gx - 4, gy - 8, 22, 14);
        ctx.fillRect(gx + 12, gy - 16, 9, 10);
        ctx.fillStyle = '#5c4d3c'; // horns
        ctx.fillRect(gx + 16, gy - 20, 3, 5);
      } else if (i % 3 === 0) {
        // Toaster Oven
        ctx.fillStyle = COLOURS.toasterSilver;
        ctx.fillRect(gx, gy, 20, 14);
        ctx.fillStyle = '#111';
        ctx.fillRect(gx + 3, gy + 3, 14, 5);
        ctx.fillStyle = '#ff7b00'; // glowing coils
        ctx.fillRect(gx + 4, gy + 4, 12, 3);
      } else if (i % 3 === 1) {
        // Blender
        ctx.fillStyle = '#00b4d8';
        ctx.fillRect(gx + 4, gy - 4, 12, 16);
        ctx.fillStyle = '#2b2d42';
        ctx.fillRect(gx + 2, gy + 10, 16, 6);
      } else {
        // Wrapped present box with bow
        ctx.fillStyle = i % 2 === 0 ? '#ff4d6d' : '#7209b7';
        ctx.fillRect(gx, gy, 18, 15);
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(gx + 7, gy, 4, 15);
        ctx.fillRect(gx, gy + 6, 18, 3);
      }
    }

    // 5. OCEAN OF MOBBING GUESTS / CONGA LINE
    const crowdRows = 3;
    const crowdDensity = clamp01(guestCount / 12000);
    const crowdStride = (view.elapsed * 0.005) % 1;

    for (let r = 0; r < crowdRows; r++) {
      const cy = 410 + r * 42;
      const stepOffset = r % 2 === 0 ? crowdStride * 40 : -crowdStride * 40;
      const numPeople = Math.min(30, 8 + Math.floor(crowdDensity * 22));

      for (let p = 0; p < numPeople; p++) {
        const px = ((p * 38 + stepOffset) % 980) - 20;
        const bob = Math.sin(view.elapsed * 0.012 + p + r) * 6;

        if (crashed) {
          // Stampeding conga line dancers with wild party hats!
          ctx.fillStyle = '#ffb703';
          ctx.beginPath();
          ctx.moveTo(px, cy + bob - 18);
          ctx.lineTo(px - 6, cy + bob - 32);
          ctx.lineTo(px + 6, cy + bob - 32);
          ctx.fill();
        }

        // Heads & party silhouettes
        ctx.fillStyle = p % 2 === 0 ? '#1f293d' : '#3c1642';
        ctx.beginPath();
        ctx.arc(px, cy + bob - 8, 11, 0, Math.PI * 2);
        ctx.fill();

        // Guest bodies
        ctx.fillStyle = (p + r) % 3 === 0 ? '#e63946' : ((p + r) % 3 === 1 ? '#457b9d' : '#2a9d8f');
        ctx.fillRect(px - 10, cy + bob, 20, 36);

        // Arms holding confetti cannons or drinks
        if (tension > 0.2) {
          ctx.strokeStyle = '#f8c09d';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px - 7, cy + bob + 6);
          ctx.lineTo(px - 14, cy + bob - 12);
          ctx.moveTo(px + 7, cy + bob + 6);
          ctx.lineTo(px + 14, cy + bob - 12);
          ctx.stroke();
        }
      }
    }

    // 6. SATELLITE CHOPPER (Milestone > 1000)
    if (view.currentX100 >= 1000 && !crashed) {
      const copterX = 220 + Math.sin(view.elapsed * 0.002) * 160;
      const copterY = 70 + Math.cos(view.elapsed * 0.003) * 15;
      // Body
      ctx.fillStyle = '#222';
      ctx.fillRect(copterX - 25, copterY, 50, 20);
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('LIVE NEWS', copterX, copterY + 12);
      // Spinning Rotor
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(copterX - 45, copterY - 6);
      ctx.lineTo(copterX + 45, copterY - 6);
      ctx.stroke();
    }

    // 7. CRASH IMPACT OVERLAY: Gazebo flattened, 30,000 conga line chaos!
    if (crashed) {
      const bannerAge = clamp01(age / 0.4);
      ctx.fillStyle = 'rgba(20, 4, 12, 0.45)';
      ctx.fillRect(0, 0, 960, 540);

      // Warning tape & Stampede banner
      ctx.save();
      ctx.translate(480, 255);
      ctx.scale(bannerAge, bannerAge);
      ctx.fillStyle = COLOURS.crashed;
      ctx.fillRect(-380, -38, 760, 76);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(-380, -38, 760, 76);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('30,000 CRASHERS OVERRAN THE BUFFET!', 0, -8);
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillStyle = COLOURS.caution;
      ctx.fillText('MARQUEE FLATTENED · CONGA LINE UNSTOPPABLE', 0, 20);
      ctx.restore();
    }

    // 8. HUD & MULTIPLIER DISPLAY
    // Title pill
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(10, 16, 26, 0.75)';
    ctx.fillRect(24, 18, 320, 58);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 18, 320, 58);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillText('OPEN INVITE RUSH', 38, 26);
    ctx.fillStyle = COLOURS.accentGold;
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(`YARD GUESTS: ~${guestCount.toLocaleString('en-US')}`, 38, 50);

    // Giant central multiplier
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const multColor = crashed ? COLOURS.crashed : (view.cashoutX100 !== null ? COLOURS.cashedOut : '#ffffff');
    ctx.fillStyle = multColor;
    ctx.font = `900 ${78 + (running ? depth * 14 : 0)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 130);

    // Milestone ticker caption
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const captionText = activeMilestone?.[1] ?? (crashed ? 'RECEPTION OVERRUN' : 'Open wedding invitation posted on Reddit...');
    ctx.fillStyle = 'rgba(12, 18, 32, 0.8)';
    ctx.fillRect(160, 184, 640, 36);
    ctx.strokeStyle = running ? COLOURS.accentGold : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(160, 184, 640, 36);

    ctx.fillStyle = running ? '#ffe875' : COLOURS.textMuted;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(captionText, 480, 202, 620);

    // Stake line / player escape status bar at bottom
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
    ctx.fillRect(200, 485, 560, 40);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.strokeRect(200, 485, 560, 40);

    ctx.fillStyle = colour;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(line, 480, 505, 540);

    ctx.restore();
  }

  return { draw };
}
