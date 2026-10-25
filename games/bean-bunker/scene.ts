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
  [120, 'Three four-packs of beans on the counter'],
  [150, 'A two-meter water jug pyramid blocks the hallway'],
  [200, 'Floorboards squeak under four metric tons of tins'],
  [250, 'Canned plum tomatoes stacked to eye level'],
  [300, 'Ceiling plaster cracks above the bean pillar'],
  [500, 'Living room converted to climate-proof silo'],
  [1000, 'Full bunker lockdown declared with manual radio'],
  [10000, 'Flat designated an official strategic bean reserve'],
  [100000, 'Beans reach orbital mass with own gravitational pull'],
  [1000000, 'Galactic vault of legumes secures human destiny'],
];

const COLOURS = {
  wall: '#3a2720',
  wallPaper: '#2a1a15',
  floor: '#4a2f1c',
  tinTeal: '#008b8b',
  tinLabel: '#f6d55c',
  tomatoSauce: '#d63031',
  beanOrange: '#e17055',
  accent: '#00cec9',
  gold: '#ffeaa7',
  crashed: '#ff7675',
  cashedOut: '#55efc4',
  text: '#f8f9fa',
  muted: '#b2bec3',
  doorSteel: '#636e72',
  doorTrim: '#2d3436',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Bunker sealed at ${formatX(view.cashoutX100)} · Beans secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Tower collapsed · Just watching' : 'Spectating the pantry hoard', COLOURS.muted];
  }
  if (crashed) {
    return [`Squashed! Lost ${credits(view.stake)} in the sauce`, COLOURS.crashed];
  }
  return [`Stocking up: ${credits(view.stake)} at stake`, COLOURS.accent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'thud' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastWobbleTick = 0;

  function drawCan(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wobble = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wobble);
    ctx.fillStyle = COLOURS.tinTeal;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.fillStyle = '#b2bec3';
    ctx.fillRect(-w / 2, -h / 2, w, 4);
    ctx.fillRect(-w / 2, h / 2 - 4, w, 4);
    // Heinz style keystone label
    ctx.fillStyle = COLOURS.tinLabel;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -h * 0.25);
    ctx.lineTo(w * 0.35, -h * 0.25);
    ctx.lineTo(w * 0.25, h * 0.28);
    ctx.lineTo(-w * 0.25, h * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(-w * 0.18, -2, w * 0.36, 4);
    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneIdx = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('door', 0.9);
      audio.fx('kaching', 0.6);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('thud', previousPhase === null || view.crashAge > 1500);
      audio.fx('splash', 0.85);
    }
    if (running && previousPhase === 'running' && milestoneIdx > previousMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('clang', 0.7);
    }

    const wobbleCycle = Math.sin(view.elapsed / 120);
    if (running && !cashedOut && wobbleCycle > 0.95 && view.elapsed - lastWobbleTick > 240) {
      lastWobbleTick = view.elapsed;
      audio.fx('creak', 0.25 + 0.5 * tension);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) : running ? tension * 3 * Math.sin(view.elapsed / 45) : 0;

    ctx.save();
    ctx.fillStyle = COLOURS.wall;
    ctx.fillRect(0, 0, 960, 540);
    ctx.translate(shake * Math.sin(view.elapsed * 0.2), shake * Math.cos(view.elapsed * 0.17));

    // Wallpaper stripes & council flat decor
    ctx.fillStyle = COLOURS.wallPaper;
    for (let x = 0; x < 960; x += 36) {
      ctx.fillRect(x, 0, 18, 430);
    }

    // Ceiling plaster cracks escalating with tension
    if (tension > 0.3) {
      ctx.strokeStyle = '#1a0e0a';
      ctx.lineWidth = 2 + tension * 3;
      ctx.beginPath();
      ctx.moveTo(420, 0);
      ctx.lineTo(450, 45 + tension * 40);
      ctx.lineTo(440, 75);
      ctx.lineTo(485, 95 + tension * 50);
      ctx.moveTo(510, 0);
      ctx.lineTo(530, 60);
      ctx.stroke();
    }

    // Floorboards bowing
    const floorBow = running ? tension * 16 : 0;
    ctx.fillStyle = COLOURS.floor;
    ctx.beginPath();
    ctx.moveTo(0, 430);
    ctx.quadraticCurveTo(480, 430 + floorBow, 960, 430);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.fill();

    // Background water jug towers
    const waterStackH = Math.min(6, 1 + Math.floor(depth * 7));
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < waterStackH; r++) {
        const jx = 760 + c * 44;
        const jy = 410 - r * 42;
        ctx.fillStyle = 'rgba(116, 185, 255, 0.75)';
        ctx.beginPath();
        ctx.roundRect(jx, jy, 36, 38, 6);
        ctx.fill();
        ctx.fillStyle = '#0984e3';
        ctx.fillRect(jx + 12, jy - 6, 12, 6);
      }
    }

    if (cashedOut) {
      // VICTORY BUNKER DOOR ESCAPE STATE
      ctx.fillStyle = COLOURS.doorSteel;
      ctx.beginPath();
      ctx.roundRect(310, 80, 340, 350, 16);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = COLOURS.doorTrim;
      ctx.stroke();

      // Giant heavy deadbolt lock
      ctx.fillStyle = '#d63031';
      ctx.fillRect(360, 240, 240, 32);
      ctx.fillStyle = '#fab1a0';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED · HEINZ FORTRESS', 480, 262);

      // Warm glow & beans in hand
      ctx.fillStyle = '#fdcb6e';
      ctx.beginPath();
      ctx.arc(480, 170, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2d3436';
      ctx.stroke();

      // Steaming can of beans
      drawCan(ctx, 480, 174, 34, 40, 0);
      ctx.strokeStyle = 'rgba(255, 234, 167, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const steamShift = Math.sin(view.elapsed / 150) * 8;
      ctx.moveTo(475, 148);
      ctx.bezierCurveTo(470, 130, 485 + steamShift, 120, 480, 106);
      ctx.stroke();
    } else if (crashed) {
      // CATASTROPHIC BEAN AVALANCHE
      const blast = Math.min(1, crashAgeSec * 3);
      // Sauce tidal wave
      ctx.fillStyle = COLOURS.tomatoSauce;
      ctx.beginPath();
      ctx.moveTo(0, 540);
      ctx.lineTo(0, 380 - blast * 30);
      ctx.bezierCurveTo(240, 330 - blast * 40, 480, 460, 720, 360 - blast * 20);
      ctx.lineTo(960, 410);
      ctx.lineTo(960, 540);
      ctx.fill();

      // Beans floating & tumbling
      for (let i = 0; i < 24; i++) {
        const bx = 120 + ((i * 67 + crashAgeSec * 280) % 760);
        const by = 350 + Math.sin(i * 1.7) * 90 + Math.min(80, crashAgeSec * 90);
        ctx.fillStyle = COLOURS.beanOrange;
        ctx.beginPath();
        ctx.ellipse(bx, by, 12, 7, i + crashAgeSec * 4, 0, Math.PI * 2);
        ctx.fill();
        if (i % 3 === 0) {
          drawCan(ctx, bx + 14, by - 10, 36, 42, i + crashAgeSec * 6);
        }
      }

      // Overturned ladder & flatmate feet sticking out
      ctx.strokeStyle = '#b2bec3';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(280, 490);
      ctx.lineTo(440, 430);
      ctx.moveTo(310, 510);
      ctx.lineTo(470, 450);
      ctx.stroke();

      // Flying slippers
      ctx.fillStyle = '#e17055';
      ctx.fillRect(490 - blast * 80, 360 - blast * 90, 24, 14);
      ctx.fillRect(520 + blast * 70, 380 - blast * 70, 22, 13);
    } else {
      // ACTIVE STACKING & TENSION ESCALATION
      // Stepladder (Left side)
      ctx.strokeStyle = '#636e72';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(240, 430);
      ctx.lineTo(310, 260);
      ctx.lineTo(360, 430);
      ctx.stroke();
      // Steps
      ctx.beginPath();
      ctx.moveTo(265, 375);
      ctx.lineTo(345, 375);
      ctx.moveTo(285, 320);
      ctx.lineTo(330, 320);
      ctx.stroke();

      // Protagonist Flatmate on ladder
      const sweat = tension > 0.4 ? Math.sin(view.elapsed / 80) * 8 : 0;
      const armShake = tension * 4 * Math.sin(view.elapsed / 50);

      // Body & Legs
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(300, 320); // foot
      ctx.lineTo(315, 270);
      ctx.lineTo(325, 220); // torso
      ctx.stroke();

      // Head
      ctx.fillStyle = '#ffeaa7';
      ctx.beginPath();
      ctx.arc(330, 195, 16, 0, Math.PI * 2);
      ctx.fill();

      // Messy hair
      ctx.fillStyle = '#2d3436';
      ctx.beginPath();
      ctx.arc(328, 185, 16, Math.PI, 0);
      ctx.fill();

      // Sweat drops
      if (tension > 0.3) {
        ctx.fillStyle = '#74b9ff';
        ctx.beginPath();
        ctx.arc(348 + sweat, 190, 3.5, 0, Math.PI * 2);
        ctx.arc(315 - sweat, 196, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stacking arm reaching towards the monolith
      ctx.strokeStyle = '#ffeaa7';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(330, 225);
      ctx.lineTo(385 + armShake, 205 + armShake);
      ctx.stroke();
      drawCan(ctx, 395 + armShake, 205 + armShake, 26, 32, armShake * 0.05);

      // THE GIANT BEAN MONOLITH PILLAR (towers from floor to ceiling)
      const towerBaseX = 520;
      const canCount = Math.min(18, 4 + Math.floor(tension * 12) + Math.floor(depth * 4));
      const wobbleAmp = tension * 12 * Math.sin(view.elapsed / 120);

      for (let i = 0; i < canCount; i++) {
        const canY = 415 - i * 26;
        const flex = (i / canCount) * wobbleAmp;
        const canW = 46 - (i > 10 ? (i - 10) * 1.5 : 0);
        drawCan(ctx, towerBaseX + flex, canY, canW, 28, (flex / 100) * (i * 0.12));
      }
    }

    // HUD OVERLAYS
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Subtitle Banner
    ctx.fillStyle = COLOURS.text;
    ctx.font = '900 42px system-ui, sans-serif';
    ctx.fillText('BEAN BUNKER', 480, 52);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.tinLabel;
    ctx.fillText('STRATEGIC COUNCIL PANTRY DEFENCE · TINS TO CEILING', 480, 84);

    // Giant Multiplier Readout
    const multColor = cashedOut ? COLOURS.cashedOut : crashed ? COLOURS.crashed : COLOURS.gold;
    ctx.fillStyle = multColor;
    const punch = crashed ? clamp01(1 - crashAgeSec / 0.3) * 24 : 0;
    ctx.font = `900 ${78 + punch}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 142);

    // Milestone / Status ticker
    const passed = running ? MILESTONES[milestoneIdx - 1] : undefined;
    const tickerText = cashedOut
      ? 'DOOR BOLTED: SURVIVING OFF WARM BEANS & PRIDE'
      : crashed
        ? 'DOWNING STREET CRISIS: MONOLITH SQUASHED THE FLAT'
        : passed?.[1] ?? 'Stacking tins...';

    ctx.fillStyle = cashedOut ? COLOURS.cashedOut : crashed ? COLOURS.crashed : COLOURS.muted;
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillText(tickerText, 480, 464, 880);

    // Stake line footer
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(line, 480, 505, 880);

    ctx.restore();
  }

  return { draw };
}
