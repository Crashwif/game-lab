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
  [120, 'Do Not Disturb sign taped over keyhole'],
  [150, 'Third can of neon energy drink cracked'],
  [200, "Spouse texts: 'Why does location say Motel 6?'"],
  [250, 'Curtains pinned shut with plastic hangers'],
  [300, 'High-bandwidth mobile hotspot overheating'],
  [500, 'Floor covered in three layers of takeout bags'],
  [1000, 'Hotel manager bangs on adjacent drywall'],
  [10000, 'Spouse drives rental car across front lawn'],
  [100000, 'Local news van parks directly outside window'],
  [1000000, 'Full military cordon baffled by your k/d ratio'],
];

const COLOURS = {
  wall: '#1b1226',
  bed: '#63283f',
  bedPattern: '#843b57',
  headboard: '#301824',
  door: '#4a2d1f',
  neonPink: '#ff2d78',
  neonCyan: '#00f0ff',
  neonLime: '#39ff14',
  text: '#fdf6ff',
  muted: '#b0a0ba',
  gold: '#ffcc00',
  crashed: '#ff3d5a',
  safe: '#43e888',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  if (view.cashoutX100 !== null) {
    return [`Alibi secured at ${formatX(view.cashoutX100)} · FaceTime answered calmly`, COLOURS.safe];
  }
  const amt = view.stake !== null ? `${view.stake.toLocaleString()} credits` : '0 credits';
  if (view.phase === 'crashed') {
    return view.stake !== null
      ? [`Busted in the motel! Lost ${amt} & dignity`, COLOURS.crashed]
      : ['Caught red-handed · Spectating only', COLOURS.muted];
  }
  return view.stake !== null
    ? [`Grindset active · ${amt} on the line`, COLOURS.neonCyan]
    : ['Scouting the motel · No credits riding', COLOURS.muted];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'slam' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastDoorJiggleTime = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    audio.update(view.phase, tension);

    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('phone', 0.8);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('slam', previousPhase === null || view.crashAge > 1500);
      audio.fx('camera', 0.9);
      audio.fx('scream', 0.8);
    }
    if (running && milestoneIdx > previousMilestone) {
      audio.milestone(milestoneIdx);
      audio.fx('notify', 0.7);
    }

    if (running && tension > 0.4 && now - lastDoorJiggleTime > 1600 - tension * 1000) {
      audio.fx('door', 0.4 + tension * 0.5);
      lastDoorJiggleTime = now;
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 18 * clamp01(1 - crashAgeSec / 0.6) ** 2
      : running
      ? (Math.sin(now * 0.04) * tension * 2.5)
      : 0;

    ctx.save();
    ctx.translate(shake * Math.sin(now * 0.08), shake * Math.cos(now * 0.06));

    // Room background with seedy motel wallpaper
    ctx.fillStyle = COLOURS.wall;
    ctx.fillRect(0, 0, 960, 540);

    // Wall wallpaper stripes
    ctx.fillStyle = '#221630';
    for (let x = 0; x < 960; x += 36) {
      ctx.fillRect(x, 0, 18, 540);
    }

    // Window with flickering neon sign outside
    const neonFlicker = running ? (0.6 + 0.4 * Math.sin(now * 0.02) * Math.sin(now * 0.007)) : 0.4;
    ctx.save();
    ctx.fillStyle = '#080510';
    ctx.fillRect(230, 40, 200, 180);

    // Neon glow bleeding in
    const neonGrad = ctx.createLinearGradient(230, 40, 430, 220);
    neonGrad.addColorStop(0, `rgba(255, 45, 120, ${0.4 * neonFlicker})`);
    neonGrad.addColorStop(1, `rgba(0, 240, 255, ${0.3 * neonFlicker})`);
    ctx.fillStyle = neonGrad;
    ctx.fillRect(230, 40, 200, 180);

    // Motel sign letters in the window
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = `rgba(255, 45, 120, ${0.9 * neonFlicker})`;
    ctx.fillText('MOTEL 6', 255, 100);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = `rgba(0, 240, 255, ${0.85 * neonFlicker})`;
    ctx.fillText('★ VACANCY ★', 270, 130);

    // Curtains pinned shut with plastic hangers
    ctx.fillStyle = '#47223b';
    ctx.fillRect(220, 36, 45, 190);
    ctx.fillRect(395, 36, 45, 190);
    ctx.fillStyle = '#ffffff';
    // Hanger clips
    ctx.fillRect(255, 110, 12, 6);
    ctx.fillRect(395, 110, 12, 6);
    ctx.restore();

    // Floor
    ctx.fillStyle = '#110b17';
    ctx.fillRect(0, 380, 960, 160);

    // Tangled tactical extension cords across carpet
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(80, 520);
    ctx.bezierCurveTo(200, 460, 350, 530, 520, 470);
    ctx.bezierCurveTo(600, 430, 700, 490, 780, 430);
    ctx.stroke();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(120, 540);
    ctx.bezierCurveTo(280, 500, 440, 510, 680, 460);
    ctx.stroke();

    // Motel Door (Left side: x: 40, y: 70, w: 140, h: 360)
    ctx.save();
    const doorRattle = running ? Math.sin(now * 0.05) * tension * 7 : 0;
    const doorKicked = crashed && crashAgeSec > 0.05;

    if (doorKicked) {
      // Door blasted inwards
      ctx.translate(130, 300);
      ctx.rotate(Math.min(1.4, crashAgeSec * 6));
      ctx.fillStyle = COLOURS.door;
      ctx.fillRect(-60, -180, 120, 360);
      ctx.fillStyle = '#1a0d08';
      ctx.fillRect(-50, -160, 100, 320);
    } else {
      ctx.translate(40 + doorRattle, 70);
      ctx.fillStyle = COLOURS.door;
      ctx.fillRect(0, 0, 140, 360);
      // Panels
      ctx.fillStyle = '#382015';
      ctx.fillRect(16, 20, 108, 140);
      ctx.fillRect(16, 180, 108, 150);

      // Doorknob & deadbolt
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(120, 190, 10, 0, Math.PI * 2);
      ctx.fill();

      // "DO NOT DISTURB" cardboard sign
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(105, 195, 26, 48);
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(108, 200, 20, 6);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 6px sans-serif';
      ctx.fillText('SHHH!', 110, 222);
    }
    ctx.restore();

    // If crashed: Angry spouse & private investigator silhouettes + flashbulbs!
    if (doorKicked) {
      ctx.save();
      // Doorway doorway hole
      ctx.fillStyle = '#0a0005';
      ctx.fillRect(40, 70, 140, 360);

      // Flashbulb strobe
      if (crashAgeSec < 0.8 && Math.floor(crashAgeSec * 20) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(0, 0, 960, 540);
      }

      // Spouse silhouette holding rolling pin / phone
      ctx.fillStyle = '#110515';
      ctx.beginPath();
      ctx.arc(100, 160, 24, 0, Math.PI * 2); // head
      ctx.rect(75, 184, 50, 140); // body
      ctx.fill();
      // PI silhouette with camera flash
      ctx.beginPath();
      ctx.arc(145, 175, 20, 0, Math.PI * 2); // PI head
      ctx.rect(130, 195, 40, 130);
      ctx.fill();
      // Camera flash star
      ctx.fillStyle = '#ffff66';
      ctx.beginPath();
      ctx.arc(135, 200, 16 + Math.sin(now * 0.1) * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Motel Bed (center to right)
    // Headboard
    ctx.fillStyle = COLOURS.headboard;
    ctx.fillRect(480, 210, 420, 190);

    // Bed base & floral mattress
    ctx.fillStyle = COLOURS.bed;
    ctx.beginPath();
    ctx.roundRect(500, 290, 400, 140, [16, 16, 0, 0]);
    ctx.fill();

    // Floral bedspread pattern
    ctx.fillStyle = COLOURS.bedPattern;
    for (let bx = 520; bx < 880; bx += 40) {
      for (let by = 310; by < 410; by += 30) {
        ctx.beginPath();
        ctx.arc(bx + ((by % 20 === 0) ? 15 : 0), by, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Stacks of pizza boxes (escalates from 1 to 9 boxes)
    const boxCount = Math.min(10, 1 + Math.floor(tension * 8) + Math.floor(depth * 3));
    for (let i = 0; i < boxCount; i++) {
      const boxY = 410 - i * 15;
      const wobble = running ? Math.sin(now * 0.008 + i) * tension * 4 : 0;
      ctx.fillStyle = i % 2 === 0 ? '#e6c89c' : '#d2b07e';
      ctx.fillRect(810 + wobble, boxY, 100, 14);
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(845 + wobble, boxY + 3, 30, 8); // red logo
    }

    // Energy drink cans on bedside floor
    const canCount = 2 + Math.min(5, Math.floor(tension * 5));
    for (let c = 0; c < canCount; c++) {
      const cx = 450 + c * 16;
      const cy = 445 + (c % 2) * 8;
      ctx.fillStyle = c % 2 === 0 ? COLOURS.neonLime : COLOURS.neonCyan;
      ctx.fillRect(cx, cy, 11, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + 2, cy + 4, 7, 10);
    }

    // Protagonist (Gamer hunched over on bed)
    const gamerX = 640;
    const gamerY = 320;
    const twitch = running ? Math.sin(now * 0.03) * (1 + tension * 3) : 0;

    // Hunched spine & body
    ctx.save();
    ctx.translate(gamerX, gamerY + twitch);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 75, 45, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hoodie torso
    ctx.fillStyle = '#2d2238';
    ctx.beginPath();
    ctx.ellipse(-10, 35, 36, 42, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Head hunched forward
    ctx.fillStyle = '#e8b898';
    ctx.beginPath();
    ctx.arc(-26, -10, 20, 0, Math.PI * 2);
    ctx.fill();

    // Hair / hood
    ctx.fillStyle = '#1c1524';
    ctx.beginPath();
    ctx.arc(-24, -14, 21, Math.PI * 0.7, Math.PI * 2.1);
    ctx.fill();

    // Glowing noise-canceling headphones
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.beginPath();
    ctx.arc(-26, -12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-26, -16, 17, Math.PI * 0.9, Math.PI * 1.8);
    ctx.stroke();

    // Arms reaching to keyboard
    ctx.fillStyle = '#2d2238';
    ctx.beginPath();
    ctx.ellipse(-38, 30, 12, 28, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Hands frantically typing
    ctx.fillStyle = '#e8b898';
    const handJitter = running ? Math.sin(now * 0.08) * 3 : 0;
    ctx.fillRect(-65, 42 + handJitter, 16, 9);

    // Glowing Laptop/Monitor setup
    ctx.fillStyle = '#111';
    ctx.fillRect(-105, 10, 8, 48); // screen back
    ctx.fillStyle = '#222';
    ctx.fillRect(-115, 50, 48, 6); // base

    // Screen face glowing onto player
    const screenGlow = ctx.createLinearGradient(-105, 10, -50, 40);
    if (cashedOut) {
      // Swapped to online masterclass
      screenGlow.addColorStop(0, '#39ff14');
      screenGlow.addColorStop(1, 'rgba(57, 255, 20, 0.2)');
    } else {
      screenGlow.addColorStop(0, '#00f0ff');
      screenGlow.addColorStop(1, 'rgba(0, 240, 255, 0.25)');
    }
    ctx.fillStyle = screenGlow;
    ctx.beginPath();
    ctx.moveTo(-97, 12);
    ctx.lineTo(-40, -5);
    ctx.lineTo(-40, 55);
    ctx.lineTo(-97, 48);
    ctx.closePath();
    ctx.fill();

    // Cashout state: Phone held high answering FaceTime!
    if (cashedOut) {
      ctx.fillStyle = '#e8b898';
      ctx.fillRect(-15, -30, 10, 24); // raised arm
      ctx.fillStyle = '#111';
      ctx.fillRect(-22, -50, 24, 38); // phone
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-20, -48, 20, 32); // facetime screen
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('HONEY', -19, -32);
    }

    ctx.restore();

    // Incoming Call Notification HUD banner (floating over top-center)
    if (running && !cashedOut && tension > 0.15) {
      ctx.save();
      const popupY = 28 + Math.sin(now * 0.01) * 3;
      ctx.fillStyle = 'rgba(20, 10, 30, 0.88)';
      ctx.strokeStyle = COLOURS.neonPink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(320, popupY, 320, 42, 10);
      ctx.fill();
      ctx.stroke();

      // Phone icon & pulsing dot
      ctx.fillStyle = '#ff2255';
      ctx.beginPath();
      ctx.arc(345, popupY + 21, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('📞', 338, popupY + 25);

      ctx.fillStyle = COLOURS.text;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Incoming FaceTime: Spouse (14 missed)', 365, popupY + 19);
      ctx.fillStyle = COLOURS.muted;
      ctx.font = '11px sans-serif';
      ctx.fillText("Location: 'Near Interstate Bypass'", 365, popupY + 33);
      ctx.restore();
    }

    // Top HUD Bar: Title & Status
    ctx.textAlign = 'left';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonPink;
    ctx.fillText('MOTEL GRINDSET', 36, 44);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.fillText('NO PAIN · NO WITNESSES · DODGE THE CALLS', 36, 62);

    // Big Center Multiplier
    ctx.textAlign = 'center';
    const multColor = cashedOut ? COLOURS.safe : crashed ? COLOURS.crashed : COLOURS.neonCyan;
    ctx.fillStyle = multColor;
    ctx.font = '900 78px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 140);

    // Milestone text bubble
    const currentMilestone = MILESTONES[milestoneIdx - 1];
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.text;
    const bannerText = currentMilestone
      ? currentMilestone[1]
      : running
      ? 'Barricading hotel room with energy drinks...'
      : crashed
      ? 'DOOR BREACHED! PRIVATE INVESTIGATOR FLASHBULBS EVERYWHERE!'
      : 'Ready for check-in · Stake to initiate grind';
    ctx.fillText(bannerText, 480, 185);

    // Stake & cashout footer status
    const [line, colour] = stakeLine(view);
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = colour;
    ctx.fillText(line, 480, 515);

    ctx.restore();
  }

  return { draw };
}
