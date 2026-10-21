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
  wall: '#1e2430',
  wallStripe: '#293242',
  floor: '#855436',
  baseboard: '#dcd0c0',
  couch: '#4361ee',
  couchShadow: '#2c3ea8',
  cushion: '#3f37c9',
  guestSkin: '#ffd166',
  guestPajama: '#4cc9f0',
  paper: '#fffdf0',
  paperBorder: '#e0a96d',
  accent: '#ffd166',
  crashed: '#ef476f',
  cashedOut: '#06d6a0',
  text: '#f8f9fa',
  muted: '#94a3b8',
  dangerBadge: '#d90429',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Host leaves passive-aggressive dishwasher post-it'],
  [150, 'Checklist requires stripping all bed linens'],
  [200, 'Rule sheet demands mowing front lawn before 10 AM'],
  [250, 'Smart thermostat locks room to 54 degrees'],
  [300, 'Ring doorbell camera audibly sighs at dirty sink'],
  [500, 'Guest ordered to repave gravel driveway'],
  [1000, 'Checklist demands rewiring circuit breaker box'],
  [10000, 'Host requires guests to complete property tax filing'],
  [100000, 'Guest must reconstruct rustic cabin from raw timber'],
  [1000000, 'Supreme Superhost attains astral landlord godhood'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Escaped in Uber at ${formatX(view.cashoutX100)} · Baggage safe!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Inspection failed · Spectating only' : 'Spectating · No cleaning fees risked', COLOURS.muted];
  }
  if (crashed) return [`Busted! $900 Deep Clean Fee charged · ${credits(view.stake)} lost`, COLOURS.crashed];
  return [`Checkout clock ticking · ${credits(view.stake)} on the line`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'elevator', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const escaped = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (previousPhase !== null && running && escaped && previousCashout === null) {
      audio.cashout();
      audio.fx('door', 0.9);
      audio.fx('yeet', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('shatter', 0.9);
    }
    if (running && previousPhase === 'running' && milestoneIndex > previousMilestone) {
      audio.milestone(milestoneIndex);
      audio.fx('camera', 0.6);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(crashAgeSec * 80), shake * Math.cos(crashAgeSec * 60));

    // --- BACKGROUND: Rental Room & French Patio Doors ---
    ctx.fillStyle = COLOURS.wall;
    ctx.fillRect(0, 0, 960, 360);

    // Wall wallpaper stripes
    ctx.fillStyle = COLOURS.wallStripe;
    for (let x = 0; x < 960; x += 48) {
      ctx.fillRect(x, 0, 24, 360);
    }

    // Hardwood floor
    ctx.fillStyle = COLOURS.floor;
    ctx.fillRect(0, 360, 960, 180);
    ctx.fillStyle = '#6e4429';
    for (let py = 360; py < 540; py += 30) {
      ctx.fillRect(0, py, 960, 2);
    }
    // Baseboard
    ctx.fillStyle = COLOURS.baseboard;
    ctx.fillRect(0, 350, 960, 12);

    // Patio glass doors (centre-right)
    ctx.fillStyle = '#112233';
    ctx.fillRect(660, 70, 220, 280);
    ctx.fillStyle = '#203d59';
    ctx.fillRect(670, 80, 95, 260);
    ctx.fillRect(775, 80, 95, 260);
    // Ring Camera blinking high up
    ctx.fillStyle = '#101010';
    ctx.beginPath();
    ctx.arc(630, 90, 14, 0, Math.PI * 2);
    ctx.fill();
    const camBlink = Math.sin(view.elapsed * 0.008) > 0;
    ctx.fillStyle = camBlink ? '#ef476f' : '#334155';
    ctx.beginPath();
    ctx.arc(630, 90, 5, 0, Math.PI * 2);
    ctx.fill();

    // Sectional Couch
    ctx.fillStyle = COLOURS.couchShadow;
    ctx.beginPath();
    ctx.roundRect(140, 280, 340, 100, 20);
    ctx.fill();
    ctx.fillStyle = COLOURS.couch;
    ctx.beginPath();
    ctx.roundRect(130, 260, 320, 100, 18);
    ctx.fill();
    // Couch cushions
    ctx.fillStyle = COLOURS.cushion;
    ctx.fillRect(150, 290, 130, 60);
    ctx.fillRect(290, 290, 130, 60);

    // Guest lounging or leaping
    const guestX = escaped ? 780 + Math.min(180, (view.elapsed % 2000) * 0.4) : 250;
    const guestY = escaped ? 180 - Math.sin((view.elapsed % 1000) / 1000 * Math.PI) * 70 : 270;
    const guestAngle = escaped ? 0.35 : Math.sin(view.elapsed * 0.003) * 0.05;

    ctx.save();
    ctx.translate(guestX, guestY);
    ctx.rotate(guestAngle);

    if (!escaped) {
      // Lounging Pajama Guest
      ctx.fillStyle = COLOURS.guestPajama;
      ctx.beginPath();
      ctx.roundRect(-30, -10, 60, 45, 12);
      ctx.fill();
      // Legs stretched on sofa
      ctx.fillRect(20, 15, 60, 18);
      // Slippers
      ctx.fillStyle = '#ffb703';
      ctx.fillRect(75, 10, 22, 24);
      // Head
      ctx.fillStyle = COLOURS.guestSkin;
      ctx.beginPath();
      ctx.arc(-20, -28, 18, 0, Math.PI * 2);
      ctx.fill();
      // Bedhead hair
      ctx.fillStyle = '#6b4226';
      ctx.beginPath();
      ctx.arc(-26, -40, 14, 0, Math.PI);
      ctx.fill();
      // Eyeballs & coffee cup
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-16, -32, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, -5, 16, 18);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(18, -2, 6, 12);
    } else {
      // Leaping Guest with suitcase escaping to Uber
      ctx.fillStyle = '#f72585';
      ctx.fillRect(-45, -10, 36, 48); // Rolling suitcase
      ctx.fillStyle = '#333';
      ctx.fillRect(-48, 38, 10, 10);
      ctx.fillRect(-23, 38, 10, 10);
      // Guest torso & outstretched arms
      ctx.fillStyle = COLOURS.guestPajama;
      ctx.fillRect(-10, -20, 50, 32);
      ctx.fillStyle = COLOURS.guestSkin;
      ctx.beginPath();
      ctx.arc(46, -20, 16, 0, Math.PI * 2);
      ctx.fill();
      // Carry-on handle
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.strokeRect(-40, -28, 26, 18);
    }
    ctx.restore();

    // --- ESCALATING CHORE LIST MONSTER ---
    // Grows legs, gets taller and menacing
    if (!escaped) {
      const monsterScale = 1 + tension * 1.2 + depth * 0.4;
      const monsterX = 540;
      const monsterY = 320;
      const legWalk = Math.sin(view.elapsed * (0.01 + tension * 0.02));

      ctx.save();
      ctx.translate(monsterX, monsterY);
      ctx.scale(monsterScale, monsterScale);

      // Paper legs (spidery chore legs)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-25, 30);
      ctx.lineTo(-40, 70 + legWalk * 10);
      ctx.lineTo(-55, 75 + legWalk * 10);
      ctx.moveTo(25, 30);
      ctx.lineTo(40, 70 - legWalk * 10);
      ctx.lineTo(55, 75 - legWalk * 10);
      ctx.stroke();

      // Giant laminated memo sheet
      ctx.fillStyle = COLOURS.paper;
      ctx.strokeStyle = COLOURS.paperBorder;
      ctx.lineWidth = 3;
      ctx.fillRect(-45, -70, 90, 110);
      ctx.strokeRect(-45, -70, 90, 110);

      // Red clip at top
      ctx.fillStyle = '#ef233c';
      ctx.fillRect(-15, -78, 30, 12);

      // Scary checklist lines & angry eyes on paper
      ctx.fillStyle = '#d90429';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('CHECKOUT RULES', -40, -50);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-35, -35, 70, 4);
      ctx.fillRect(-35, -23, 70, 4);
      ctx.fillRect(-35, -11, 70, 4);
      ctx.fillRect(-35, 1, 70, 4);

      // Menacing chore checklist red glow eyes
      ctx.fillStyle = '#d90429';
      const eyeR = 4 + tension * 4;
      ctx.beginPath();
      ctx.arc(-16, 20, eyeR, 0, Math.PI * 2);
      ctx.arc(16, 20, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- CRASH STATE: Superhost bursts through patio door ---
    if (crashed) {
      // Broken glass shards
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < 16; i++) {
        const sx = 700 + ((i * 47) % 180);
        const sy = 120 + ((i * 73) % 200);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 15, sy - 10);
        ctx.lineTo(sx + 8, sy + 18);
        ctx.closePath();
        ctx.fill();
      }

      // Unhinged Superhost
      const hostX = 720;
      const hostY = 220;
      ctx.save();
      ctx.translate(hostX, hostY);
      // Body
      ctx.fillStyle = '#8338ec';
      ctx.fillRect(-22, -10, 44, 70);
      // Head
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, -32, 22, 0, Math.PI * 2);
      ctx.fill();
      // Unhinged angry eyes & mouth
      ctx.fillStyle = '#d90429';
      ctx.beginPath();
      ctx.arc(-7, -35, 5, 0, Math.PI * 2);
      ctx.arc(7, -35, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-12, -22, 24, 7);
      // Mop weapon held up high
      ctx.strokeStyle = '#c1121f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-20, 20);
      ctx.lineTo(-50, -60);
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-70, -78, 38, 20);

      // $900 Deep Clean Invoice flapping
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(15, -40, 50, 40);
      ctx.fillStyle = '#d90429';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('$900 FEE', 18, -22);
      ctx.fillText('★☆☆☆☆', 18, -8);
      ctx.restore();
    }

    // --- HUD OVERLAY ---
    // Title Banner
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText('CHORE STRIKE', 36, 28);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText('Escape before the $350 Checkout Cleaning Fee triggers', 36, 62);

    // Huge Multiplier Display (Center-Top)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const multColor = crashed ? COLOURS.crashed : (escaped ? COLOURS.cashedOut : COLOURS.accent);
    ctx.fillStyle = multColor;
    ctx.font = '900 78px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 110);

    // Active Chore Memo Milestone Banner
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    const bannerText = currentMilestone ? currentMilestone[1] : (running ? 'Washing coffee mugs calmly...' : 'Check-in confirmed');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(140, 430, 680, 44, 12);
    ctx.fill();
    ctx.fillStyle = crashed ? COLOURS.crashed : '#f1faee';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(crashed ? '🚨 HOST BREACH: 1-STAR REVIEW + $900 DEEP-CLEAN FINE' : `📋 ${bannerText}`, 480, 452);

    // Footer Stake & Ride Status
    const [statusMsg, statusColor] = stakeLine(view);
    ctx.fillStyle = statusColor;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(statusMsg, 480, 502);

    ctx.restore();
  }

  return { draw };
}
