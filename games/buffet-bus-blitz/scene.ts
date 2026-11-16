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
  [120, 'Coach hands out first round of Beaver nuggets'],
  [150, 'Linemen stage quick Buc-ee jerky raid'],
  [200, 'Golden Corral rolls into sight on horizon'],
  [250, 'All-you-can-eat yeast rolls deployed'],
  [300, 'Chocolate fountain tapped directly into cups'],
  [500, 'Bus suspension bottoms out on interstate bump'],
  [1000, 'Coach screams chemistry speeches over snoring'],
  [10000, 'Food coma sweat fogs entire vehicle windshield'],
  [100000, 'Third Golden Corral stop planned mid-transit'],
  [1000000, 'Legendary carb-fueled victory bus unlocked'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const popFont = (weight: number, size: number, pop: number) =>
  `${weight} ${Math.round(size * (1 + 0.25 * pop * pop))}px system-ui, sans-serif`;

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`STADIUM CASH-OUT AT ${formatX(view.cashoutX100)} · READY TO HIT!`, '#70e000'];
  }
  if (view.stake === null) {
    return [crashed ? 'Watched bus tilt into ditch · No credits lost' : 'Tailgate Spectator · No credits riding', '#94a3b8'];
  }
  if (crashed) return [`Food coma hit: your ${credits(view.stake)} slumped asleep`, '#ff4d6d'];
  return [`Linemen fully loaded · ${credits(view.stake)} riding I-35`, '#fca311'];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'trap', crash: 'thud' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let previousThudSec = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestone = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    const thudInterval = Math.floor(view.elapsed / 600);

    if (previousPhase !== null && running && view.cashoutX100 !== null && previousCashout === null) {
      audio.cashout();
      audio.fx('airhorn', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('thud', previousPhase === null || view.crashAge > 1500);
      audio.fx('scream', 0.7);
    }
    if (running && previousPhase === 'running') {
      if (milestone > previousMilestone) {
        audio.milestone(milestone);
        audio.fx('cheer', 0.6);
      }
      if (thudInterval > previousThudSec && view.cashoutX100 === null) {
        audio.fx('creak', 0.35 + 0.45 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestone;
    previousThudSec = thudInterval;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : running ? (1 + 3 * tension) * Math.sin(view.elapsed * 0.035) : 0;
    const speed = running ? 1.0 + 1.6 * tension : 0.08;

    ctx.save();
    ctx.translate(0, shake);

    // Sky gradient: Dusk Texas interstate vibes
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, '#100a26');
    skyGrad.addColorStop(0.5, '#43194a');
    skyGrad.addColorStop(0.85, '#b83b32');
    skyGrad.addColorStop(1, '#ff9e3b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Distant Stadium / Horizon Billboards
    const billboardX = ((1200 - (view.elapsed * speed * 0.12)) % 1400) - 200;
    ctx.fillStyle = '#1c1024';
    ctx.fillRect(billboardX, 230, 110, 60);
    ctx.fillStyle = '#ffbe0b';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText("BUC-EE'S 2MI", billboardX + 55, 255);
    ctx.fillText('BRISKET & NUGS', billboardX + 55, 275);
    ctx.fillStyle = '#2a1a38';
    ctx.fillRect(billboardX + 50, 290, 10, 45);

    // Highway Asphalt
    ctx.fillStyle = '#1f242d';
    ctx.fillRect(0, 335, 960, 205);
    // Shoulder dirt/grass
    ctx.fillStyle = '#3a2717';
    ctx.fillRect(0, 485, 960, 55);

    // Highway lane markings
    const dashOffset = (view.elapsed * speed * 0.9) % 120;
    ctx.fillStyle = '#e5c158';
    for (let x = -120 + dashOffset; x < 960; x += 120) {
      ctx.fillRect(x, 420, 65, 8);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 340, 960, 4);

    // Calculate Bus suspension drop & tilt
    const caloricSquash = tension * 16 + depth * 8;
    const roadVibration = running ? Math.sin(view.elapsed * 0.04) * 3 : 0;
    const crashDitchTilt = crashed ? Math.min(12, crashAgeSec * 35) : 0;
    const busY = 320 + caloricSquash + roadVibration;
    const busX = 420;

    ctx.save();
    ctx.translate(busX, busY);
    ctx.rotate((crashDitchTilt * Math.PI) / 180);

    // Bus Wheels
    const wheelY = 55 - caloricSquash * 0.3;
    const wheelRoll = (view.elapsed * speed * 0.05) % (Math.PI * 2);
    const drawWheel = (wx: number) => {
      ctx.save();
      ctx.translate(wx, wheelY);
      ctx.fillStyle = '#0f1115';
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#788291';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(crashed ? 0 : wheelRoll);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      for (let a = 0; a < 4; a++) {
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
        ctx.rotate(Math.PI / 4);
      }
      ctx.restore();
    };
    drawWheel(-170);
    drawWheel(-115);
    drawWheel(140);

    // Main Bus Body (College Charter Cruiser)
    ctx.fillStyle = '#0b3954'; // Navy athletic blue
    ctx.beginPath();
    ctx.roundRect(-220, -55, 410, 105, [22, 35, 10, 10]);
    ctx.fill();

    // Golden athletic team stripe
    ctx.fillStyle = '#fca311';
    ctx.fillRect(-220, 0, 410, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.fillText('STATE UNIVERSITY LINEMEN TRANSIT', -15, 12);

    // Windows with lineman silhouettes munching food
    for (let w = 0; w < 6; w++) {
      const wx = -180 + w * 58;
      ctx.fillStyle = crashed ? '#76949f' : '#8ecae6';
      ctx.fillRect(wx, -42, 48, 32);
      // Lineman helmet silhouette
      ctx.fillStyle = '#0a192f';
      ctx.beginPath();
      ctx.arc(wx + 22, -24, 12, 0, Math.PI * 2);
      ctx.fill();
      // Beaver nugget / drumstick in hand
      ctx.fillStyle = '#d48b28';
      ctx.beginPath();
      ctx.arc(wx + 36, -20, 5, 0, Math.PI * 2);
      ctx.fill();
      if (crashed) {
        // Sleep "Zzz"
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText('z', wx + 20, -32 - ((view.elapsed * 0.003 + w) % 1) * 10);
      }
    }

    // Front Windshield
    ctx.fillStyle = crashed ? '#5c7079' : '#a2d2ff';
    ctx.beginPath();
    ctx.moveTo(170, -45);
    ctx.lineTo(190, -10);
    ctx.lineTo(165, -10);
    ctx.lineTo(165, -45);
    ctx.closePath();
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(185, 16, 8, 14);
    if (!crashed) {
      // Light beam on highway
      ctx.fillStyle = 'rgba(255, 243, 176, 0.16)';
      ctx.beginPath();
      ctx.moveTo(193, 20);
      ctx.lineTo(480, -20);
      ctx.lineTo(500, 100);
      ctx.lineTo(193, 30);
      ctx.closePath();
      ctx.fill();
    }

    // Roof Luggage Rack: Towering plate stacks & golden rolls!
    const plateCount = Math.min(22, 4 + Math.floor(tension * 16));
    ctx.fillStyle = '#333b48';
    ctx.fillRect(-170, -64, 270, 9);
    for (let p = 0; p < plateCount; p++) {
      const wobble = Math.sin(view.elapsed * 0.02 + p * 0.4) * (2 + tension * 6);
      const px = -140 + (p % 4) * 60 + wobble;
      const py = -68 - Math.floor(p / 4) * 12;
      ctx.fillStyle = '#f8f9fa';
      ctx.beginPath();
      ctx.ellipse(px, py, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Golden yeast rolls / brisket on plates
      ctx.fillStyle = p % 2 === 0 ? '#e76f51' : '#f4a261';
      ctx.beginPath();
      ctx.arc(px, py - 4, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Exhaust pipe with smoke & flying Buc-ee wrapper particles
    ctx.fillStyle = '#1a1d20';
    ctx.fillRect(-228, 30, 10, 8);
    if (running) {
      for (let i = 0; i < 5; i++) {
        const pAge = ((view.elapsed * 0.004 + i * 0.2) % 1);
        const px = -235 - pAge * 120;
        const py = 30 - pAge * 30 + Math.sin(pAge * 10) * 8;
        ctx.fillStyle = `rgba(180, 170, 160, ${0.7 * (1 - pAge)})`;
        ctx.beginPath();
        ctx.arc(px, py, 6 + pAge * 14, 0, Math.PI * 2);
        ctx.fill();

        // Yellow Beaver nugget wrapper flying out
        ctx.fillStyle = `rgba(255, 214, 10, ${1 - pAge})`;
        ctx.fillRect(px - 10, py - 15, 7, 5);
      }
    }

    // Crash tire blowout / sparks
    if (crashed && crashAgeSec < 1.2) {
      ctx.fillStyle = '#ffb703';
      for (let s = 0; s < 12; s++) {
        const sa = (s / 12) * Math.PI * 2;
        const dist = 30 + crashAgeSec * 70;
        ctx.fillRect(140 + Math.cos(sa) * dist, wheelY + Math.sin(sa) * dist, 4, 4);
      }
    }

    ctx.restore();

    // Cashout Celebration Banner: Stadium Parking Achieved
    if (view.cashoutX100 !== null) {
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(240, 15, 480, 65, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STADIUM GATES CLEARED! NOURISHED & READY!', 480, 43);
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillText(`LOCKED IN AT ${formatX(view.cashoutX100)} · READY TO DOMINATE`, 480, 66);
      ctx.restore();
    }

    // Crash Overload Banner
    if (crashed) {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(260, 15, 440, 65, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CATASTROPHIC FOOD COMA! BUS IN DITCH!', 480, 42);
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillText(`SUSPENSION CRACKED AT ${formatX(view.currentX100)}`, 480, 65);
      ctx.restore();
    }

    // HUD Header & Multiplier Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (view.cashoutX100 === null && !crashed) {
      ctx.fillStyle = '#fca311';
      ctx.font = '900 32px system-ui, sans-serif';
      ctx.fillText('BUFFET BUS BLITZ', 480, 40);
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('I-35 HIGHWAY · SMASH BUFFET BEFORE KICKOFF', 480, 68);
    }

    // Giant Multiplier
    const pop = (x100: number) => (running ? clamp01(1 - Math.log(view.currentX100 / x100) / 0.05) : 0);
    const punch = crashed ? (1 - clamp01((crashAgeSec - 0.1) / 0.3)) ** 2 : 0;
    const multColor = crashed ? '#ff4d6d' : view.cashoutX100 !== null ? '#70e000' : '#ffd166';
    ctx.fillStyle = multColor;
    ctx.font = `900 ${Math.round(84 * (1 + 0.22 * punch))}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 130);

    // Milestone ticker / Subtitle
    const passed = running ? MILESTONES[milestone - 1] : undefined;
    const statusText = passed ? passed[1] : (crashed ? 'Tires blown · Linemen slumped asleep on steamed glass' : 'All-You-Can-Eat Buffet Expedition in Progress');
    ctx.fillStyle = '#ffffff';
    ctx.font = popFont(700, 19, pop(passed?.[0] ?? 100));
    ctx.fillText(statusText, 480, 185);

    // Bottom Stake & Player state line
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(160, 490, 640, 38, 8);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(line, 480, 509);

    ctx.restore();
  }

  return { draw };
}
