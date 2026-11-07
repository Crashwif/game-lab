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
  bgRoom: '#181524',
  wallWarm: '#241c30',
  sofaVelvet: '#1d483b',
  sofaCushion: '#265d4d',
  capyFur: '#8b5a2b',
  capySnout: '#6e4420',
  capyBelly: '#9e6a38',
  dogFur: '#e0a44f',
  dogEar: '#c48938',
  textLight: '#f6f7fb',
  textMuted: '#9aa5b8',
  goldAccent: '#f5c542',
  cashedOut: '#6ee7b7',
  crashed: '#f87171',
  blanketPlaid: '#c85a3a',
};

const PHASE_LABELS: Record<SceneView['phase'], string> = {
  waiting: 'Patio door cracked... retrievers asleep',
  betting: 'Slip inside before Dad checks the room',
  running: 'Trotting to the sectional sofa',
  crashed: 'DAD FLIPPED THE LIGHTS! BUSTED!',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Slipping through the cracked sliding door'],
  [150, 'Bumping noses with a friendly golden retriever'],
  [200, 'Wiping muddy webbed paws on the kitchen mat'],
  [250, 'Grabbing a slice of melon from the coffee table'],
  [300, 'Stealing the prime spot on the sectional sofa'],
  [500, 'Napping directly on top of two golden puppies'],
  [1000, 'Snoring rhythmically while the siren wails'],
  [10000, 'Dad walks into the hallway scratching his head'],
  [100000, 'Dog mom accidentally hands him a chew toy'],
  [1000000, 'Full honorary canine adoption finalized on sofa'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${size * (1 + 0.28 * pop * pop)}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [
      `Snoozing unnoticed at ${formatX(view.cashoutX100)} · ${crashed ? 'Dad saw nothing' : 'under the throw blanket'}`,
      COLOURS.cashedOut,
    ];
  }
  if (view.stake === null) {
    return [crashed ? 'Dad swept the living room · 0 credits lost' : 'Watching the pack · no credits riding', COLOURS.textMuted];
  }
  if (crashed) return [`Dad found you! Lost ${credits(view.stake)}`, COLOURS.crashed];
  return [`Undercover hound · ${credits(view.stake)} riding`, COLOURS.goldAccent];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'scratch' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastSnoreSec = -1;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);
    const milestone = MILESTONES.filter(([x]) => view.currentX100 >= x).length;

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.6);
      audio.fx('pop', 0.4);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('scratch', previousPhase === null || view.crashAge > 1500);
      audio.fx('door', 0.8);
      audio.fx('scream', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('squeak', 0.6);
      }
      const curSec = Math.floor(view.elapsed / 1600);
      if (curSec > lastSnoreSec && view.cashoutX100 === null) {
        lastSnoreSec = curSec;
        audio.fx('thud', 0.25 + 0.3 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 10 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. Room Background
    ctx.fillStyle = crashed && crashAgeSec < 0.25 ? '#f5eedb' : COLOURS.bgRoom;
    ctx.fillRect(0, 0, 960, 540);

    // Wall moulding & cozy wallpaper stripes
    ctx.fillStyle = COLOURS.wallWarm;
    ctx.fillRect(0, 0, 960, 360);
    ctx.strokeStyle = '#2d243c';
    ctx.lineWidth = 1;
    for (let x = 30; x < 960; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 360);
      ctx.stroke();
    }

    // Baseboard & Wood Floor
    ctx.fillStyle = '#402a1b';
    ctx.fillRect(0, 360, 960, 18);
    ctx.fillStyle = '#311f14';
    ctx.fillRect(0, 378, 960, 162);
    for (let f = 390; f < 540; f += 22) {
      ctx.strokeStyle = '#27170c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, f);
      ctx.lineTo(960, f);
      ctx.stroke();
    }

    // Patio glass door on left (rain streaks)
    ctx.fillStyle = '#0f1722';
    ctx.fillRect(30, 40, 170, 320);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 40, 170, 320);
    // Rain droplets sliding down
    ctx.strokeStyle = 'rgba(148, 197, 255, 0.4)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 8; r++) {
      const rx = 40 + ((r * 21 + view.elapsed * 0.05) % 150);
      const ry = 45 + ((r * 45 + view.elapsed * 0.15) % 300);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 2, ry + 12);
      ctx.stroke();
    }

    // Soft lamp glow on right
    const lampX = 850;
    const lampGlow = ctx.createRadialGradient(lampX, 160, 20, lampX, 220, 240);
    lampGlow.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
    lampGlow.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(lampX, 220, 240, 0, Math.PI * 2);
    ctx.fill();

    // 2. Velvet Sofa Sectional
    ctx.fillStyle = COLOURS.sofaVelvet;
    // Sofa back
    ctx.beginPath();
    ctx.roundRect(240, 210, 520, 150, [24, 24, 6, 6]);
    ctx.fill();
    // Sofa cushions
    ctx.fillStyle = COLOURS.sofaCushion;
    ctx.beginPath();
    ctx.roundRect(220, 300, 560, 85, [14, 14, 10, 10]);
    ctx.fill();
    // Sofa throw pillows
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.roundRect(230, 270, 60, 65, 8);
    ctx.fill();
    ctx.fillStyle = '#9333ea';
    ctx.beginPath();
    ctx.roundRect(710, 270, 60, 65, 8);
    ctx.fill();

    // 3. Characters: Golden Retriever Sleeping Buddy & Capybara
    const breathe = Math.sin(view.elapsed / 400);

    // Golden Retriever (curled next to Capybara on the right cushion)
    ctx.save();
    ctx.translate(630, 310 + breathe * 2);
    // Body
    ctx.fillStyle = COLOURS.dogFur;
    ctx.beginPath();
    ctx.ellipse(0, 0, 55, 36, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(42, -6, 26, 0, Math.PI * 2);
    ctx.fill();
    // Floppy Ear
    ctx.fillStyle = COLOURS.dogEar;
    ctx.beginPath();
    ctx.ellipse(40, 2, 12, 22, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Sleeping eye
    ctx.strokeStyle = '#3c2415';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(52, -10, 6, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // Snout & nose
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(65, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Golden Retriever wagging tail
    const wag = Math.sin(view.elapsed / 140) * 0.3;
    ctx.strokeStyle = COLOURS.dogFur;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-45, 4);
    ctx.quadraticCurveTo(-65 + wag * 15, -10 + wag * 12, -75, -5 + wag * 20);
    ctx.stroke();
    ctx.restore();

    // Protagonist: Chill Capybara
    ctx.save();
    const capyBob = running ? Math.sin(view.elapsed / 220) * (3 + 3 * tension) : breathe * 2;
    ctx.translate(430, 290 + capyBob);

    // Shadow on cushion
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 52, 90, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (big placid barrel)
    ctx.fillStyle = COLOURS.capyFur;
    ctx.beginPath();
    ctx.roundRect(-90, -40, 160, 88, [36, 44, 30, 26]);
    ctx.fill();

    // Webbed feet resting on cushion
    ctx.fillStyle = COLOURS.capySnout;
    ctx.beginPath();
    ctx.roundRect(-75, 40, 24, 14, 6);
    ctx.roundRect(20, 40, 26, 14, 6);
    ctx.fill();

    // Capybara Head
    ctx.fillStyle = COLOURS.capyFur;
    ctx.beginPath();
    ctx.roundRect(35, -58, 80, 72, [22, 28, 22, 16]);
    ctx.fill();

    // Snout
    ctx.fillStyle = COLOURS.capySnout;
    ctx.beginPath();
    ctx.roundRect(75, -34, 46, 46, [14, 18, 18, 12]);
    ctx.fill();
    // Nostril
    ctx.fillStyle = '#1a0d06';
    ctx.beginPath();
    ctx.arc(110, -18, 4, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = COLOURS.capySnout;
    ctx.beginPath();
    ctx.ellipse(45, -60, 8, 14, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    if (crashed) {
      // Wide terrified eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(70, -38, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(70, -38, 4, 0, Math.PI * 2);
      ctx.fill();
      // Comical sweat drop
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(60, -56, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Serene horizontal zen eye
      ctx.strokeStyle = '#261207';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(60, -36);
      ctx.lineTo(76, -35);
      ctx.stroke();
    }

    // Red Polka-Dot Dog Bandana Disguise
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(35, -15);
    ctx.lineTo(82, -15);
    ctx.lineTo(55, 18);
    ctx.closePath();
    ctx.fill();
    // Bandana Dots
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(48, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(66, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(56, 8, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Snack: Watermelon wedge on paw/cushion
    ctx.save();
    ctx.translate(65, 15);
    ctx.rotate(0.3);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI);
    ctx.fill();
    ctx.restore();

    // Cashout blanket cover
    if (view.cashoutX100 !== null) {
      ctx.fillStyle = COLOURS.blanketPlaid;
      ctx.beginPath();
      ctx.roundRect(-95, -28, 215, 78, 18);
      ctx.fill();
      // Plaid lines
      ctx.strokeStyle = 'rgba(255, 237, 213, 0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(-95, -28, 215, 78);
      ctx.beginPath();
      ctx.moveTo(-95, 0);
      ctx.lineTo(120, 0);
      ctx.moveTo(-10, -28);
      ctx.lineTo(-10, 50);
      ctx.stroke();
      // Floating Zzz
      const zAge = (view.elapsed % 1200) / 1200;
      ctx.fillStyle = '#a7f3d0';
      ctx.font = '700 18px system-ui';
      ctx.fillText('Zzz', 120 + zAge * 20, -50 - zAge * 30);
    }

    ctx.restore();

    // 4. Dad Busted Alert / Flash
    if (crashed) {
      // Dad silhouette appearing on left doorway with broom
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(0, 0, 960, 540);

      ctx.save();
      ctx.translate(140, 220);
      // Dad body
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-25, -70, 50, 140, 16);
      ctx.fill();
      // Dad head & yelling mouth
      ctx.beginPath();
      ctx.arc(0, -95, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(10, -90, 8, 0, Math.PI * 2);
      ctx.fill();
      // Broom pointing at sofa
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(15, -40);
      ctx.lineTo(140, 20);
      ctx.stroke();
      // Broom bristles
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.roundRect(135, 10, 25, 30, 4);
      ctx.fill();
      ctx.restore();
    }

    // 5. HUD & Multiplier Readouts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.goldAccent;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('COUCH CAPY RAID', 480, 36);

    // Multiplier Huge Display
    const multColor = crashed ? COLOURS.crashed : view.cashoutX100 !== null ? COLOURS.cashedOut : '#ffffff';
    ctx.fillStyle = multColor;
    ctx.font = `900 ${76 * (1 + 0.15 * tension)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 100);

    // Suspicion / Tension Meter
    const barW = 280;
    const barH = 10;
    ctx.fillStyle = '#1e1b2e';
    ctx.beginPath();
    ctx.roundRect(340, 148, barW, barH, 5);
    ctx.fill();
    const meterFill = crashed ? 1 : tension;
    ctx.fillStyle = crashed ? COLOURS.crashed : tension > 0.6 ? '#f97316' : COLOURS.goldAccent;
    ctx.beginPath();
    ctx.roundRect(340, 148, barW * meterFill, barH, 5);
    ctx.fill();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.textMuted;
    ctx.fillText(crashed ? 'DAD AWAKE!' : `DAD FOOTSTEPS: ${Math.round(meterFill * 100)}%`, 480, 168);

    // Milestone / Action Caption
    const passed = running ? MILESTONES[milestone - 1] : undefined;
    const captionText = passed ? `🐾 ${passed[1]}` : PHASE_LABELS[view.phase];
    ctx.font = popFont(600, 20, pop(passed?.[0] ?? 100));
    ctx.fillStyle = passed ? '#fef08a' : COLOURS.textLight;
    ctx.fillText(captionText, 480, 474);

    // Stake line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = popFont(600, 17, view.cashoutX100 !== null ? pop(view.cashoutX100) : 0);
    ctx.fillText(line, 480, 508);

    ctx.restore();
  }

  return { draw };
}
