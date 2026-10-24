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
  [120, 'Bear pops open a light pilsner with one claw'],
  [150, 'Crushes an entire six-pack down the hatch'],
  [200, 'Spills honey mustard dip all over the rug'],
  [250, 'Stacks IPAs into a wobbly fermented pyramid'],
  [300, 'Begins aggressively shotgunning tallboys'],
  [500, 'Slaps on a party visor found in pantry'],
  [1000, 'Kitchen floor is a rolling sea of aluminum cans'],
  [10000, 'Raids bottom freezer for frozen margarita mix'],
  [100000, 'Ecstatic beer bong funnel off kitchen island!'],
  [1000000, 'Ascends to legendary Woodland Party Godhood!'],
];

const COLOURS = {
  bgDark: '#0e1424',
  tileDark: '#1a233a',
  fridgeBody: '#283244',
  fridgeInterior: '#fffae8',
  fridgeGlow: '#ffd56b',
  bearFur: '#1b1a1c',
  bearMuzzle: '#a5734c',
  beerAmber: '#e59b2c',
  beerFoam: '#ffffff',
  accent: '#5eead4',
  crashed: '#f43f5e',
  cashedOut: '#34d399',
  canGold: '#f59e0b',
  canSilver: '#94a3b8',
  text: '#f8fafc',
  muted: '#94a3b8',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Slipped out the porch door at ${formatX(view.cashoutX100)} · Loot secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Caught red-handed · Spectating safe' : 'Watching the kitchen heist · No credits riding', COLOURS.muted];
  }
  if (crashed) return [`Busted! Lost ${credits(view.stake)} under the lampshade`, COLOURS.crashed];
  return [`Raid in progress · ${credits(view.stake)} in the haul`, COLOURS.accent];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  kind: 'bubble' | 'can';
  color: string;
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'slam' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastGaspTick = 0;
  const particles: Particle[] = [];

  function spawnCan(x: number, y: number) {
    const col = Math.random() > 0.5 ? COLOURS.canGold : COLOURS.canSilver;
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.7) * 4.5,
      vy: -Math.random() * 5 - 2,
      size: 7 + Math.random() * 4,
      alpha: 1,
      kind: 'can',
      color: col,
    });
  }

  function spawnBubble(x: number, y: number) {
    particles.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1.5 - Math.random() * 2,
      size: 3 + Math.random() * 6,
      alpha: 0.9,
      kind: 'bubble',
      color: '#fffbf0',
    });
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / Math.max(100, view.currentX100));
    const depth = clamp01(Math.log10(Math.max(100, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Audio triggers
    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('door', 0.9);
      audio.fx('kaching', 0.7);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('slam', prevPhase === null || view.crashAge > 1500);
      audio.fx('gasp', 1.0);
      audio.fx('clang', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIndex > prevMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('glug', 0.85);
        audio.fx('spray', 0.75);
      }
      // periodic chugging sound
      if (view.elapsed - lastGaspTick > 700 - tension * 350 && !cashed) {
        lastGaspTick = view.elapsed;
        audio.fx('pop', 0.3 + 0.4 * tension);
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;
    const flashOn = crashed && crashAgeSec < 0.15 ? 1 : 0;

    // Particle spawning during run
    if (running && !cashed) {
      if (Math.random() < 0.3 + tension * 0.4) spawnBubble(500, 310);
      if (Math.random() < 0.08 + tension * 0.15) spawnCan(520, 350);
    }

    ctx.save();
    ctx.translate(shake * Math.sin(crashAgeSec * 60), shake * Math.cos(crashAgeSec * 45));

    // Kitchen Wall background
    ctx.fillStyle = flashOn ? '#ffffff' : COLOURS.bgDark;
    ctx.fillRect(0, 0, 960, 540);

    // Kitchen floor tiles (perspective)
    const floorGrad = ctx.createLinearGradient(0, 360, 0, 540);
    floorGrad.addColorStop(0, '#151d30');
    floorGrad.addColorStop(1, '#090d17');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 360, 960, 180);

    // Tile lines
    ctx.strokeStyle = '#263352';
    ctx.lineWidth = 1.5;
    for (let x = -200; x < 1200; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 360);
      ctx.lineTo(x * 1.35 - 160, 540);
      ctx.stroke();
    }
    for (let y = 390; y < 540; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Sliding glass patio door on left
    ctx.fillStyle = '#0b1626';
    ctx.fillRect(40, 140, 160, 240);
    // Moonlight garden outside
    ctx.fillStyle = '#06202e';
    ctx.fillRect(45, 145, 150, 230);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(80, 180, 16, 0, Math.PI * 2);
    ctx.fill();
    // Glass reflections
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 150);
    ctx.lineTo(160, 370);
    ctx.moveTo(110, 150);
    ctx.lineTo(190, 350);
    ctx.stroke();
    // Door frame
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 140, 160, 240);

    // Glowing Double-door Refrigerator on the right
    const fridgeX = 570;
    const fridgeY = 110;
    const fridgeW = 270;
    const fridgeH = 310;

    // Exterior cabinet
    ctx.fillStyle = COLOURS.fridgeBody;
    ctx.fillRect(fridgeX - 10, fridgeY, fridgeW + 20, fridgeH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(fridgeX - 10, fridgeY, fridgeW + 20, fridgeH);

    // Refrigerator interior glow
    const fridgeGlow = ctx.createRadialGradient(fridgeX + 130, fridgeY + 150, 20, fridgeX + 130, fridgeY + 150, 280);
    fridgeGlow.addColorStop(0, 'rgba(255, 235, 150, 0.95)');
    fridgeGlow.addColorStop(0.5, 'rgba(255, 195, 60, 0.45)');
    fridgeGlow.addColorStop(1, 'rgba(255, 170, 40, 0)');
    ctx.fillStyle = fridgeGlow;
    ctx.fillRect(fridgeX - 60, fridgeY - 40, fridgeW + 120, fridgeH + 100);

    // Interior shelves
    ctx.fillStyle = COLOURS.fridgeInterior;
    ctx.fillRect(fridgeX, fridgeY + 10, fridgeW, fridgeH - 20);

    // Draw beer rows inside fridge
    const shelfY = [fridgeY + 70, fridgeY + 135, fridgeY + 205, fridgeY + 265];
    const canColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
    for (let s = 0; s < shelfY.length; s++) {
      const sy = shelfY[s] ?? 0;
      ctx.fillStyle = 'rgba(180, 210, 240, 0.8)';
      ctx.fillRect(fridgeX + 5, sy, fridgeW - 10, 6);
      for (let c = 0; c < 7; c++) {
        ctx.fillStyle = canColors[(c + s) % canColors.length] ?? '#f59e0b';
        ctx.fillRect(fridgeX + 18 + c * 34, sy - 36, 18, 36);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fridgeX + 22 + c * 34, sy - 34, 10, 6);
      }
    }

    // Open fridge doors swung wide
    ctx.fillStyle = '#334155';
    // Left door open
    ctx.beginPath();
    ctx.moveTo(fridgeX, fridgeY);
    ctx.lineTo(fridgeX - 45, fridgeY + 15);
    ctx.lineTo(fridgeX - 45, fridgeY + fridgeH - 10);
    ctx.lineTo(fridgeX, fridgeY + fridgeH);
    ctx.closePath();
    ctx.fill();
    // Right door open
    ctx.beginPath();
    ctx.moveTo(fridgeX + fridgeW, fridgeY);
    ctx.lineTo(fridgeX + fridgeW + 50, fridgeY + 15);
    ctx.lineTo(fridgeX + fridgeW + 50, fridgeY + fridgeH - 10);
    ctx.lineTo(fridgeX + fridgeW, fridgeY + fridgeH);
    ctx.closePath();
    ctx.fill();

    // Pile of rolling cans on the floor (grows with tension)
    const canPileCount = Math.min(36, Math.floor(6 + tension * 30 + depth * 15));
    for (let i = 0; i < canPileCount; i++) {
      const cx = 380 + (i % 9) * 22 + (i % 3) * 6;
      const cy = 410 + Math.floor(i / 9) * 16 - (i % 2) * 5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i * 47) % 360);
      ctx.fillStyle = i % 2 === 0 ? COLOURS.canGold : COLOURS.canSilver;
      ctx.fillRect(-10, -5, 20, 10);
      ctx.restore();
    }

    // Update & draw particles (cans, bubbles)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.kind === 'can' ? 0.35 : -0.05;
      p.alpha -= p.kind === 'can' ? 0.012 : 0.015;
      if (p.alpha <= 0 || p.y > 450) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      if (p.kind === 'bubble') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillRect(p.x - p.size, p.y - p.size * 0.6, p.size * 2, p.size * 1.2);
      }
      ctx.restore();
    }

    // THE PROTAGONIST: BEAR
    const bob = running ? Math.sin(view.elapsed / 120) * (4 + tension * 8) : 0;
    let bearX = 490;
    let bearY = 320 + bob;

    if (cashed) {
      // Escape state: bear tiptoeing towards the porch door
      bearX = 140;
      bearY = 320;
    } else if (crashed) {
      // Crashed state: fallen backwards
      bearX = 490;
      bearY = 380;
    }

    ctx.save();
    ctx.translate(bearX, bearY);

    if (crashed) {
      // Bear falling back in defeat
      ctx.rotate(0.75);
    } else if (cashed) {
      // Bear facing left tipping sunglasses
      ctx.scale(-1, 1);
    }

    // Fuzzy Bear Body
    ctx.fillStyle = COLOURS.bearFur;
    ctx.beginPath();
    ctx.ellipse(0, 30, 48, 62, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bear Ears
    ctx.beginPath();
    ctx.arc(-32, -50, 17, 0, Math.PI * 2);
    ctx.arc(32, -50, 17, 0, Math.PI * 2);
    ctx.fill();
    // Inner ear
    ctx.fillStyle = COLOURS.bearMuzzle;
    ctx.beginPath();
    ctx.arc(-32, -50, 9, 0, Math.PI * 2);
    ctx.arc(32, -50, 9, 0, Math.PI * 2);
    ctx.fill();

    // Bear Head
    ctx.fillStyle = COLOURS.bearFur;
    ctx.beginPath();
    ctx.arc(0, -25, 42, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle
    ctx.fillStyle = COLOURS.bearMuzzle;
    ctx.beginPath();
    ctx.ellipse(0, -14, 25, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, -22, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth / Grin or Chugging open mouth
    if (running && !cashed) {
      ctx.fillStyle = '#6b1d1d';
      ctx.beginPath();
      ctx.arc(0, -10, 13, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-8, -10, 16, 4); // foam/teeth
    } else if (cashed) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, -12, 12, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      // Drunk tongue sticking out
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.ellipse(5, -6, 8, 12, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sunglass Shades or Lampshade
    if (crashed) {
      // Lampshade on head!
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.moveTo(-35, -55);
      ctx.lineTo(35, -55);
      ctx.lineTo(55, -20);
      ctx.lineTo(-55, -20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Swirly dizzy eyes
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-15, -26, 6, 0, Math.PI * 2);
      ctx.arc(15, -26, 6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Cool black shades
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.roundRect(-34, -36, 30, 16, [4]);
      ctx.roundRect(4, -36, 30, 16, [4]);
      ctx.fill();
      // Bridge
      ctx.fillRect(-6, -32, 12, 4);
      // Glint
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, -34);
      ctx.lineTo(-12, -22);
      ctx.moveTo(10, -34);
      ctx.lineTo(26, -22);
      ctx.stroke();
    }

    // Party visor if milestone >= 500
    if (view.currentX100 >= 500 && !crashed) {
      ctx.fillStyle = 'rgba(236, 72, 153, 0.85)';
      ctx.beginPath();
      ctx.ellipse(0, -48, 40, 12, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Bear Arms & Props
    if (cashed) {
      // Carrying two huge 12-pack cases of beer under arms
      ctx.fillStyle = '#16a34a'; // Green crate
      ctx.fillRect(-60, 15, 32, 45);
      ctx.fillRect(28, 15, 32, 45);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9px sans-serif';
      ctx.fillText('BREW', -44, 40);
      ctx.fillText('BREW', 44, 40);
    } else if (running) {
      // Arms up guzzling a tallboy beer
      ctx.fillStyle = COLOURS.bearFur;
      ctx.beginPath();
      ctx.ellipse(26, -2, 12, 28, -0.6, 0, Math.PI * 2);
      ctx.fill();

      // Golden tallboy can tilted into mouth
      ctx.save();
      ctx.translate(14, -14);
      ctx.rotate(0.9);
      ctx.fillStyle = COLOURS.canGold;
      ctx.fillRect(-8, -20, 16, 40);
      ctx.fillStyle = COLOURS.beerFoam;
      ctx.beginPath();
      ctx.arc(0, -20, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // Homeowner Silhouette on Crash
    if (crashed) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      // Doorway silhouette on far left
      ctx.fillRect(820, 140, 110, 240);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(875, 190, 20, 0, Math.PI * 2); // head
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(860, 210, 30, 70); // body
      // Hands on face gasp
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(860, 190, 8, 0, Math.PI * 2);
      ctx.arc(890, 190, 8, 0, Math.PI * 2);
      ctx.fill();
      // Shock text
      ctx.fillStyle = '#ef4444';
      ctx.font = '900 24px sans-serif';
      ctx.fillText('WHAT THE?!', 870, 140);
    }

    // HUD / Multiplier presentation
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline Header
    ctx.fillStyle = COLOURS.text;
    ctx.font = '800 36px ui-sans-serif, system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('FRIDGE BEAR RAID', 480, 45);

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('CRACK COLD ONES · DODGE THE HOMEOWNER · SNEAK OUT THE PATIO', 480, 75);

    // Multiplier Badge
    const badgeColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.accent;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(320, 95, 320, 72, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = badgeColor;
    ctx.font = '900 56px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 131);

    // Live Story Beat / Milestone Caption
    const currentMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const bannerText = crashed
      ? 'CRASHED! Homeowner flipped the switch on the beer beast!'
      : cashed
      ? 'SUCCESS! Sliding out undetected with two cases of craft gold!'
      : currentMilestone?.[1] ?? (view.phase === 'betting' ? 'Bear eyeing the glowing crisper drawers...' : 'Thirsty beast waiting to strike');

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 21px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 472, 860);

    // Bottom Stake & Cashout status
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(line, 480, 508, 860);

    ctx.restore();
  }

  return { draw };
}
