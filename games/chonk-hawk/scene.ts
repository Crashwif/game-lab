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
  skyTop: '#4a90e2',
  skyBottom: '#d9f1ff',
  hillsFar: '#6da05f',
  hillsNear: '#477e38',
  woodDark: '#4a2f1c',
  woodMid: '#7a4b2a',
  woodLight: '#a1663b',
  fencePost: '#5c3a21',
  hawkBrown: '#5a3d28',
  hawkChest: '#fbf4dc',
  hawkBeak: '#f5a623',
  hawkEye: '#ffcc00',
  trough: '#59616e',
  mud: '#382519',
  hay: '#f8d247',
  accent: '#f59e0b',
  crashed: '#ef4444',
  cashedOut: '#22c55e',
  text: '#ffffff',
  muted: '#e2e8f0',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First rotisserie wing swallowed whole'],
  [150, 'Belly expands past talons on the fence rail'],
  [200, 'Straining flap produces zero lift'],
  [250, 'Weigh scale groans past 910 grams'],
  [300, 'Farmer stares in shock at the feathered orb'],
  [500, 'Hovering two inches off pure stubbornness'],
  [1000, 'Sonic flap rattle shakes the hen house'],
  [10000, 'Defying poultry aerodynamics completely'],
  [100000, 'Transonic chubby raptor breaks pasture barrier'],
  [1000000, 'Orbital apex predator defies avian biology'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.28 * pop * pop)}px system-ui, -apple-system, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Landed smoothly into hay cart at ${formatX(view.cashoutX100)}!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Feed trough demolished · spectators unharmed' : 'Watching the feast · no credits placed', COLOURS.muted];
  }
  if (crashed) {
    return [`Dropped like an anvil! Lost ${credits(view.stake)}`, COLOURS.crashed];
  }
  return [`Buffet challenge accepted: ${credits(view.stake)} riding`, COLOURS.accent];
}

interface Feather {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  color: string;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'thud' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousMilestone = 0;
  let previousCashout: number | null = null;
  let flapAudioTick = 0;

  const feathers: Feather[] = Array.from({ length: 24 }, (_, i) => ({
    x: 480 + (i % 2 === 0 ? 1 : -1) * (20 + (i * 12) % 180),
    y: 280 + ((i * 17) % 120),
    vx: (Math.sin(i * 1.7) * 40),
    vy: 30 + ((i * 13) % 40),
    rot: i * 0.5,
    vRot: (i % 2 === 0 ? 1 : -1) * (1.2 + (i % 3)),
    size: 6 + (i % 5),
    color: i % 3 === 0 ? '#fbf4dc' : i % 3 === 1 ? '#5a3d28' : '#8b5a36',
  }));

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);

    audio.update(view.phase, tension);

    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (running && milestoneIdx > previousMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('squeak', 0.6);
    }
    if (running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.8);
      audio.fx('whoosh', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('thud', previousPhase === null || view.crashAge > 1200);
      audio.fx('thud', 0.9);
    }

    // Wings flap sound cadence
    if (running && view.cashoutX100 === null) {
      const flapRate = 180 - tension * 110;
      if (view.elapsed - flapAudioTick > flapRate) {
        audio.fx('whoosh', 0.2 + 0.4 * tension);
        flapAudioTick = view.elapsed;
      }
    }

    previousPhase = view.phase;
    previousMilestone = milestoneIdx;
    previousCashout = view.cashoutX100;

    const crashSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashSec / 0.5) ** 2 : running ? tension * 2.2 * Math.sin(view.elapsed * 0.05) : 0;

    ctx.save();
    // Sky background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 400);
    skyGrad.addColorStop(0, COLOURS.skyTop);
    skyGrad.addColorStop(1, COLOURS.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    ctx.translate(shake * Math.sin(view.elapsed * 0.07), shake * Math.cos(view.elapsed * 0.09));

    // Distant Chicken Barn & Hills
    ctx.fillStyle = COLOURS.hillsFar;
    ctx.beginPath();
    ctx.arc(200, 480, 320, Math.PI, 0, false);
    ctx.arc(760, 490, 290, Math.PI, 0, false);
    ctx.fill();

    // Red Barn Silhouette in background
    ctx.fillStyle = '#992d22';
    ctx.fillRect(100, 240, 160, 100);
    ctx.beginPath();
    ctx.moveTo(85, 240);
    ctx.lineTo(180, 180);
    ctx.lineTo(275, 240);
    ctx.closePath();
    ctx.fill();
    // Barn door & cross
    ctx.fillStyle = '#631d16';
    ctx.fillRect(150, 280, 60, 60);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(153, 283, 54, 54);

    // Near pasture hill
    ctx.fillStyle = COLOURS.hillsNear;
    ctx.beginPath();
    ctx.arc(480, 600, 490, Math.PI, 0, false);
    ctx.fill();

    // Wooden Coop Fence Rail
    const fenceY = 385;
    ctx.fillStyle = COLOURS.fencePost;
    ctx.fillRect(160, 330, 24, 150);
    ctx.fillRect(468, 330, 24, 150);
    ctx.fillRect(776, 330, 24, 150);
    // Horizontal crossbars
    ctx.fillStyle = COLOURS.woodDark;
    ctx.fillRect(60, fenceY - 14, 840, 22);
    ctx.fillStyle = COLOURS.woodLight;
    ctx.fillRect(60, fenceY - 12, 840, 5);

    // Buffet Plates & Drumsticks on the Fence
    for (let bx = 100; bx < 880; bx += 130) {
      if (Math.abs(bx - 480) < 90) continue;
      // Plate
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(bx, fenceY - 12, 24, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Drumstick
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(bx - 4, fenceY - 18, 12, 8, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(bx + 8, fenceY - 20, 8, 4);
    }

    // Fat Hawk Dynamics
    const hawkExpansion = 1 + tension * 0.72 + depth * 0.28;
    const bodyRadius = 40 * hawkExpansion;
    const flapFreq = 0.015 + tension * 0.035;
    const flapAngle = Math.sin(view.elapsed * flapFreq) * (0.45 + tension * 0.35);

    // Altitude calculation
    let hawkY = fenceY - bodyRadius * 0.85;
    let hawkX = 480;
    let hawkAngle = 0;

    if (running) {
      // Hovering inches off fence by sheer stubbornness
      const hover = Math.min(65, 8 + tension * 50 + depth * 15);
      const struggleWobble = Math.sin(view.elapsed * 0.02) * (3 + tension * 6);
      hawkY -= hover + struggleWobble;
      hawkAngle = Math.sin(view.elapsed * 0.012) * 0.08 * (1 + tension);
    } else if (crashed) {
      // Smashed down into feed trough / mud
      const fallProgress = clamp01(crashSec / 0.18);
      hawkY = fenceY - 10 + fallProgress * 25;
      hawkAngle = 0.35;
    } else if (view.cashoutX100 !== null) {
      // Gliding calmly towards right side hay mattress
      hawkX = 480 + Math.min(220, (view.elapsed % 4000) * 0.06);
      hawkY = fenceY - 70 + Math.sin(view.elapsed * 0.005) * 12;
      hawkAngle = -0.12;
    }

    // DRAW CASH-OUT HAY CART OR CRASH FEED TROUGH
    if (view.cashoutX100 !== null) {
      // Leaf blower updraft & Fluffy Hay Cart
      ctx.fillStyle = COLOURS.hay;
      ctx.beginPath();
      ctx.ellipse(710, fenceY + 10, 85, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d97706';
      ctx.font = '700 13px system-ui';
      ctx.fillText('COZY HAY CART', 710, fenceY + 16);
      // Updraft swirl lines
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      for (let s = 0; s < 3; s++) {
        const sx = 520 + s * 45;
        const sy = fenceY - 20 - ((view.elapsed * 0.2 + s * 40) % 90);
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI);
        ctx.stroke();
      }
    } else if (crashed) {
      // Feed trough splat
      ctx.fillStyle = COLOURS.trough;
      ctx.fillRect(410, fenceY - 6, 140, 36);
      ctx.fillStyle = COLOURS.mud;
      ctx.beginPath();
      ctx.ellipse(480, fenceY + 12, 75, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      // "THUD / BURP" comic puff
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui';
      ctx.fillText('* BURRRRRP *', 480, hawkY - bodyRadius - 20);
    }

    // DRAW CHONK HAWK
    ctx.save();
    ctx.translate(hawkX, hawkY);
    ctx.rotate(hawkAngle);

    // Left Wing (behind body)
    ctx.save();
    ctx.translate(-bodyRadius * 0.75, -bodyRadius * 0.2);
    ctx.rotate(-flapAngle - (crashed ? 1.2 : 0));
    ctx.fillStyle = COLOURS.hawkBrown;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28 + tension * 8, 14, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Giant Spherical Hawk Body
    const bodyGrad = ctx.createRadialGradient(-bodyRadius * 0.2, -bodyRadius * 0.3, 10, 0, 0, bodyRadius);
    bodyGrad.addColorStop(0, '#805333');
    bodyGrad.addColorStop(0.7, COLOURS.hawkBrown);
    bodyGrad.addColorStop(1, '#3a2314');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
    ctx.fill();

    // Round Fluffy Cream Belly
    ctx.fillStyle = COLOURS.hawkChest;
    ctx.beginPath();
    ctx.ellipse(0, bodyRadius * 0.28, bodyRadius * 0.72, bodyRadius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Drumstick Grease / Belly feather spots
    ctx.fillStyle = '#c79c6e';
    for (let s = -2; s <= 2; s++) {
      ctx.beginPath();
      ctx.arc(s * 14 * hawkExpansion, bodyRadius * 0.35 + Math.abs(s) * 4, 3 * hawkExpansion, 0, Math.PI * 2);
      ctx.fill();
    }

    // Right Wing (in front of body)
    ctx.save();
    ctx.translate(bodyRadius * 0.6, -bodyRadius * 0.1);
    ctx.rotate(flapAngle + (crashed ? 0.9 : 0));
    ctx.fillStyle = '#4a2f1c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26 + tension * 8, 13, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Hawk Talons
    ctx.fillStyle = COLOURS.hawkBeak;
    if (!crashed) {
      // Tiny clutched claws struggling
      ctx.fillRect(-16, bodyRadius * 0.88, 12, 10);
      ctx.fillRect(4, bodyRadius * 0.88, 12, 10);
    } else {
      // Talons stick straight up in surrender
      ctx.fillRect(-20, -bodyRadius * 0.8, 8, 14);
      ctx.fillRect(12, -bodyRadius * 0.8, 8, 14);
    }

    // Fierce Raptor Eyes & Eyebrows
    const eyeOffsetX = 12 * hawkExpansion;
    const eyeOffsetY = -bodyRadius * 0.35;
    for (const side of [-1, 1]) {
      const ex = side * eyeOffsetX;
      ctx.fillStyle = COLOURS.hawkEye;
      ctx.beginPath();
      ctx.arc(ex, eyeOffsetY, 11 * hawkExpansion, 0, Math.PI * 2);
      ctx.fill();

      if (crashed) {
        // Comic spiral/dazed X eyes
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ex - 6, eyeOffsetY - 6);
        ctx.lineTo(ex + 6, eyeOffsetY + 6);
        ctx.moveTo(ex + 6, eyeOffsetY - 6);
        ctx.lineTo(ex - 6, eyeOffsetY + 6);
        ctx.stroke();
      } else {
        // Intense raptor pupil
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(ex + (view.cashoutX100 !== null ? 2 : 0), eyeOffsetY, 5 * hawkExpansion, 0, Math.PI * 2);
        ctx.fill();
        // Eye glint
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 2, eyeOffsetY - 3, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Angled Raptor Brow of determination/strain
        ctx.strokeStyle = '#2b180d';
        ctx.lineWidth = 4 * hawkExpansion;
        ctx.beginPath();
        ctx.moveTo(ex - side * 14 * hawkExpansion, eyeOffsetY - 12 * hawkExpansion);
        ctx.lineTo(ex + side * 4 * hawkExpansion, eyeOffsetY - 6 * hawkExpansion);
        ctx.stroke();
      }
    }

    // Curved Sharp Raptor Beak holding chicken drumstick
    ctx.fillStyle = COLOURS.hawkBeak;
    ctx.beginPath();
    ctx.moveTo(-10 * hawkExpansion, eyeOffsetY + 6 * hawkExpansion);
    ctx.lineTo(10 * hawkExpansion, eyeOffsetY + 6 * hawkExpansion);
    ctx.lineTo(0, eyeOffsetY + 24 * hawkExpansion);
    ctx.closePath();
    ctx.fill();

    // Fried Chicken Tender in Beak!
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(8, eyeOffsetY + 16 * hawkExpansion, 14, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(20, eyeOffsetY + 14 * hawkExpansion, 6, 3);

    // Sweat Drops popping off during extreme strain
    if (running && tension > 0.25) {
      ctx.fillStyle = '#38bdf8';
      const dropCount = Math.floor(tension * 6);
      for (let d = 0; d < dropCount; d++) {
        const dropPhase = (view.elapsed * 0.006 + d * 1.5) % Math.PI;
        const dx = (d % 2 === 0 ? 1 : -1) * (bodyRadius + 15 + Math.sin(dropPhase) * 18);
        const dy = -bodyRadius * 0.4 - Math.cos(dropPhase) * 20;
        ctx.beginPath();
        ctx.arc(dx, dy, 4 + tension * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Floating Feathers drifting
    for (let f = 0; f < feathers.length; f++) {
      const feather = feathers[f];
      if (!feather) continue;
      if (running || crashed) {
        feather.y += feather.vy * 0.016 * (1 + tension);
        feather.x += feather.vx * 0.016;
        feather.rot += feather.vRot * 0.02;
        if (feather.y > 480) {
          feather.y = hawkY - 20;
          feather.x = hawkX + (Math.sin(f) * 40);
        }
      }
      ctx.save();
      ctx.translate(feather.x, feather.y);
      ctx.rotate(feather.rot);
      ctx.fillStyle = feather.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, feather.size * 2, feather.size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // HUD & OVERLAYS
    // Top Title & Badging
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText('CHONK HAWK', 480, 48);

    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText('ALL-YOU-CAN-EAT COOP ASCENT · THE SKY IS THE LIMIT (GRAVITY DISAGREES)', 480, 80);
    ctx.shadowBlur = 0;

    // Giant Multiplier Readout
    const popVal = running ? clamp01(1 - Math.log(view.currentX100 / (MILESTONES[milestoneIdx - 1]?.[0] ?? 100)) / 0.06) : 0;
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : COLOURS.text;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${76 * (1 + 0.18 * popVal)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 142);

    // Live Milestone Banner
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    const bannerText = currentMilestone ? currentMilestone[1] : (running ? 'Waddling to the buffet rail...' : 'Coop doors open!');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.roundRect(180, 192, 600, 38, 19);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.font = popFont(600, 17, popVal);
    ctx.fillText(bannerText, 480, 211, 580);

    // Stake & Action Status line at bottom
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = popFont(700, 21, view.cashoutX100 !== null ? popVal : 0);
    ctx.fillText(lineText, 480, 508, 900);

    ctx.restore();
  }

  return { draw };
}
