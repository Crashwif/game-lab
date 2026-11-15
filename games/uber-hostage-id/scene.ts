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
  bgSky: '#101726',
  road: '#1a1f2b',
  curb: '#d4a236',
  taxiDoor: '#242b38',
  taxiTrim: '#f6c344',
  interior: '#12151c',
  skin: '#f5c396',
  idGold: '#f0df92',
  idBlue: '#003399',
  euroGreen: '#2ec4b6',
  crashed: '#ff3b5c',
  cashedOut: '#38ef7d',
  policeBlue: '#0055ff',
  text: '#ffffff',
  muted: '#9baacf',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Posted blurry story of found wallet in cab'],
  [150, 'DM demands 200€ finder fee from owner'],
  [200, 'Tourists frantically sprinting behind taxi!'],
  [250, 'Bounty raised to 1,000€ on live stream'],
  [300, 'Waymo automated voice warns of lost property'],
  [500, 'German tabloid reposts the hostage screenshot'],
  [1000, 'Owner offers business class tickets to retrieve'],
  [10000, 'Interpol alert pings local Munich cab network'],
  [100000, 'Bidding war starts between consulate and fans'],
  [1000000, '2,000,000€ secured in gold bullion duffel!'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.25 * pop * pop)}px "Segoe UI", system-ui, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`ID Handed Over · Cashed at ${formatX(view.cashoutX100)}!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Busted by Polizei · Watching' : 'Watching livestream · No stake placed', COLOURS.muted];
  }
  if (crashed) return [`Hostage seized! Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Bounty Live · Demanding payout on ${credits(view.stake)}`, COLOURS.taxiTrim];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'siren' });
  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const speed = running ? 1 + tension * 4 : 0.2;
    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    audio.update(view.phase, tension);

    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.9);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('siren', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 1.0);
    }
    if (running && prevPhase === 'running' && milestoneIdx > prevMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('camera', 0.7);
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIdx;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.5) ** 2 : (running ? Math.sin(view.elapsed * 0.03) * tension * 2 : 0);

    ctx.save();
    if (shake !== 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // Sky & Munich Cityline
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, '#0c101d');
    skyGrad.addColorStop(1, '#1b2a47');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // City Buildings scrolling
    const bgOffset = (view.elapsed * 0.15 * speed) % 180;
    ctx.fillStyle = '#11192b';
    for (let x = -200; x < 1160; x += 110) {
      const bx = x - bgOffset;
      const h = 100 + ((Math.sin(bx * 0.05) + 1) * 60);
      ctx.fillRect(bx, 280 - h, 90, h + 80);
      // Windows
      ctx.fillStyle = (Math.sin(bx) > 0.2) ? '#ffdc7322' : '#00000033';
      ctx.fillRect(bx + 15, 290 - h + 20, 20, 30);
      ctx.fillRect(bx + 50, 290 - h + 20, 20, 30);
      ctx.fillStyle = '#11192b';
    }

    // Road & Autobahn lane markers
    ctx.fillStyle = COLOURS.road;
    ctx.fillRect(0, 340, 960, 200);
    ctx.fillStyle = COLOURS.curb;
    ctx.fillRect(0, 335, 960, 6);

    const stripeOffset = (view.elapsed * 1.4 * speed) % 120;
    ctx.fillStyle = '#ffffff';
    for (let x = -100; x < 1060; x += 120) {
      ctx.fillRect(x - stripeOffset, 430, 65, 8);
    }

    // Panicking Tourists Sprinting Behind Taxi
    if (!cashed) {
      const touristDist = Math.max(120, 320 - tension * 160);
      const bobT = Math.sin(view.elapsed * 0.02 * speed) * 8;
      const legT = Math.sin(view.elapsed * 0.04 * speed);

      // Tourist 1
      const t1x = touristDist;
      const t1y = 350 + bobT;
      ctx.fillStyle = '#ff5964'; // shirt
      ctx.beginPath();
      ctx.arc(t1x, t1y - 35, 14, 0, Math.PI * 2); // head
      ctx.fill();
      ctx.fillRect(t1x - 10, t1y - 20, 20, 36); // body
      // waving arms demanding ID
      ctx.strokeStyle = COLOURS.skin;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(t1x - 8, t1y - 12);
      ctx.lineTo(t1x + 25, t1y - 45 + Math.sin(view.elapsed * 0.03) * 10);
      ctx.stroke();
      // legs running
      ctx.strokeStyle = '#232938';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(t1x - 4, t1y + 16);
      ctx.lineTo(t1x - 12 + legT * 18, t1y + 44);
      ctx.moveTo(t1x + 4, t1y + 16);
      ctx.lineTo(t1x + 12 - legT * 18, t1y + 44);
      ctx.stroke();

      // Waving Euro note in hand
      ctx.fillStyle = COLOURS.euroGreen;
      ctx.fillRect(t1x + 25, t1y - 52 + Math.sin(view.elapsed * 0.03) * 10, 22, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('500€', t1x + 36, t1y - 43 + Math.sin(view.elapsed * 0.03) * 10);

      // Tourist 2 (Panicking girl screaming "MEIN AUSWEIS!")
      const t2x = touristDist - 75;
      const t2y = 360 - bobT;
      ctx.fillStyle = '#35a7ff';
      ctx.beginPath();
      ctx.arc(t2x, t2y - 30, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(t2x - 9, t2y - 16, 18, 30);
      ctx.strokeStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.moveTo(t2x, t2y - 8);
      ctx.lineTo(t2x - 15, t2y - 35);
      ctx.stroke();
    }

    // TAXI INTERIOR & BACKSEAT WINDOW (Foreground frame)
    // Left side taxi rear quarter & door frame
    ctx.fillStyle = COLOURS.interior;
    ctx.beginPath();
    ctx.moveTo(400, 150);
    ctx.lineTo(960, 150);
    ctx.lineTo(960, 540);
    ctx.lineTo(380, 540);
    ctx.closePath();
    ctx.fill();

    // Taxi Yellow Door Panel exterior
    ctx.fillStyle = COLOURS.taxiTrim;
    ctx.beginPath();
    ctx.moveTo(420, 240);
    ctx.lineTo(960, 240);
    ctx.lineTo(960, 540);
    ctx.lineTo(390, 540);
    ctx.closePath();
    ctx.fill();

    // Taxi Black Decal / "TAXI MUNICH"
    ctx.fillStyle = '#111';
    ctx.fillRect(430, 310, 530, 24);
    ctx.fillStyle = COLOURS.taxiTrim;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('★ TAXI MÜNCHEN 24H · UBER-HOSTAGE SERVICE ★', 445, 327);

    // Leather Backseat Headrest & protagonist inside
    ctx.fillStyle = '#1e2430';
    ctx.beginPath();
    ctx.roundRect(720, 210, 120, 140, 20);
    ctx.fill();

    // Protagonist (Smirking Dude in Backseat)
    const smirkBob = Math.sin(view.elapsed * 0.008) * 3;
    const px = 680;
    const py = 250 + smirkBob;

    // Body / Hoodie
    ctx.fillStyle = '#3a506b';
    ctx.beginPath();
    ctx.ellipse(px + 40, py + 85, 55, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = COLOURS.skin;
    ctx.beginPath();
    ctx.arc(px + 30, py + 10, 32, 0, Math.PI * 2);
    ctx.fill();
    // Cool Shades / Sunglasses
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(px + 10, py + 4, 30, 14);
    ctx.fillStyle = '#45a29e';
    ctx.fillRect(px + 14, py + 7, 22, 4);
    // Smirking Mouth
    ctx.strokeStyle = '#6e2b20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px + 22, py + 22, 10, 0.2, Math.PI * 0.7);
    ctx.stroke();

    // Protagonist Arm dangling out window holding the German ID Card!
    const armWiggle = Math.sin(view.elapsed * 0.015) * 8 * tension;
    const armX = 520;
    const armY = 270 + armWiggle;

    ctx.strokeStyle = COLOURS.skin;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + 15, py + 40);
    ctx.quadraticCurveTo(armX + 40, armY + 20, armX, armY);
    ctx.stroke();

    // THE GERMAN ID (BUNDESREPUBLIK DEUTSCHLAND PERSONALAUSWEIS)
    if (!crashed) {
      ctx.save();
      ctx.translate(armX - 10, armY - 10);
      ctx.rotate(-0.15 + Math.sin(view.elapsed * 0.01) * 0.1);

      // Card Body
      ctx.fillStyle = '#eaf0f8';
      ctx.strokeStyle = '#b0c2de';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-45, -30, 90, 60, 6);
      ctx.fill();
      ctx.stroke();

      // Top bar & EU flag
      ctx.fillStyle = COLOURS.idBlue;
      ctx.fillRect(-43, -28, 20, 14);
      ctx.fillStyle = COLOURS.idGold;
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('D', -33, -17);

      // German eagle hint & header
      ctx.fillStyle = '#223147';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('BUNDESREPUBLIK', -20, -22);
      ctx.fillText('DEUTSCHLAND', -20, -15);

      // Photo on ID
      ctx.fillStyle = '#a0b3c6';
      ctx.fillRect(-40, -10, 24, 32);
      ctx.fillStyle = '#486581';
      ctx.beginPath();
      ctx.arc(-28, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Hologram shimmer effect
      const shimmer = (view.elapsed * 0.005) % 1;
      const holoGrad = ctx.createLinearGradient(-40 + shimmer * 80, -30, -20 + shimmer * 80, 30);
      holoGrad.addColorStop(0, 'rgba(255,255,255,0)');
      holoGrad.addColorStop(0.5, 'rgba(255, 230, 100, 0.4)');
      holoGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = holoGrad;
      ctx.fillRect(-45, -30, 90, 60);

      // Thumb holding the card
      ctx.fillStyle = COLOURS.skin;
      ctx.beginPath();
      ctx.arc(32, -5, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // CRASH EFFECT: Police tackle & Shredded ID shards!
      const burstAge = crashSec;
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2 + burstAge * 2;
        const dist = burstAge * 190 * (1 + (i % 3) * 0.4);
        const sx = armX + Math.cos(ang) * dist;
        const sy = armY + Math.sin(ang) * dist;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang * 3);
        ctx.fillStyle = i % 2 === 0 ? '#eaf0f8' : COLOURS.idBlue;
        ctx.fillRect(-10, -8, 20, 16);
        ctx.restore();
      }

      // Police Car Sirens (Alternating Blue & Red strobes)
      const strobe = Math.floor(view.elapsed / 80) % 2 === 0;
      ctx.fillStyle = strobe ? 'rgba(0, 100, 255, 0.4)' : 'rgba(255, 0, 60, 0.4)';
      ctx.fillRect(0, 0, 960, 540);

      // Bundespolizei Handcuffs & Officer Badge
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 BUNDESPOLIZEI TAKEDOWN 🚨', 480, 200);
      ctx.font = '600 16px monospace';
      ctx.fillStyle = '#ffdede';
      ctx.fillText('SUSPECT DETAINED · AUSWEIS CONFISCATED', 480, 226);
    }

    // CASHOUT CELEBRATION (Secured Envelope & Fat Euros)
    if (cashed && !crashed) {
      ctx.fillStyle = 'rgba(10, 40, 25, 0.6)';
      ctx.fillRect(0, 0, 960, 540);

      // Envelope + Euros
      ctx.save();
      ctx.translate(480, 260);
      ctx.fillStyle = '#fdfbf7';
      ctx.beginPath();
      ctx.roundRect(-100, -50, 200, 100, 10);
      ctx.fill();
      // Green seal
      ctx.fillStyle = COLOURS.cashedOut;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAID', 0, 6);

      // Floating Euro bills
      for (let j = 0; j < 6; j++) {
        const fOffset = ((view.elapsed * 0.1 + j * 60) % 300) - 150;
        ctx.fillStyle = COLOURS.euroGreen;
        ctx.fillRect(-140 + j * 45, fOffset, 36, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('€', -122 + j * 45, fOffset + 14);
      }
      ctx.restore();
    }

    // INSTAGRAM / TIKTOK LIVE HUD OVERLAY
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.roundRect(40, 25, 68, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('● LIVE', 52, 42);

    // Viewers count rising with tension
    const viewers = Math.floor(1420 + tension * 89200);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(116, 25, 110, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`👁 ${viewers.toLocaleString()} watching`, 124, 42);

    // Live ransom comments stream
    ctx.fillStyle = 'rgba(10, 14, 22, 0.75)';
    ctx.beginPath();
    ctx.roundRect(40, 62, 280, 52, 8);
    ctx.fill();
    ctx.fillStyle = '#ffdd55';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('@tourist_klaus: PLEASE STOP THE CAB!! 😭', 50, 82);
    ctx.fillStyle = '#a6b4ca';
    ctx.font = '11px sans-serif';
    ctx.fillText('@bavaria_biker: Bro is holding that ID hostage on 4G 💀', 50, 100);

    // TOP HUD & MULTIPLIER DISPLAY
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('UBER HOSTAGE ID', 480, 44);

    const punch = crashed ? (1 - clamp01((crashSec - 0.12) / 0.25)) ** 2 : 0;
    const multColor = crashed ? COLOURS.crashed : (cashed ? COLOURS.cashedOut : COLOURS.taxiTrim);
    ctx.fillStyle = multColor;
    ctx.font = `900 ${88 * (1 + 0.15 * punch)}px monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 126);

    // Milestones caption
    const activeMilestone = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const caption = activeMilestone?.[1] ?? (crashed ? 'BUSTED BY BUNDESPOLIZEI' : 'NEGOTIATING RANSOM TRANSFER...');
    ctx.fillStyle = crashed ? '#ff8c9c' : '#ffffff';
    ctx.font = popFont(600, 20, pop(activeMilestone?.[0] ?? 100));
    ctx.fillText(caption, 480, 160);

    // Bottom stake status bar
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = 'rgba(10, 14, 22, 0.85)';
    ctx.beginPath();
    ctx.roundRect(180, 485, 600, 44, 12);
    ctx.fill();
    ctx.fillStyle = lineCol;
    ctx.font = popFont(700, 18, cashed ? pop(view.cashoutX100 ?? 100) : 0);
    ctx.fillText(lineText, 480, 513);

    ctx.restore();
  }

  return { draw };
}
