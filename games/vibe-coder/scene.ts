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
  [120, 'Agent writes boilerplate without crashing'],
  [150, 'Added 84 unvetted NPM packages'],
  [200, 'CSS centering works on desktop only'],
  [250, 'Database schema generated entirely by vibes'],
  [300, 'Skipped unit tests because they kill momentum'],
  [500, 'AI begins rewriting Linux kernel from scratch'],
  [1000, 'CEO brags on podcast about autonomous team'],
  [10000, 'Vibe engine achieves sentient tech debt'],
  [100000, 'Every company server runs on one prompt loop'],
  [1000000, 'Vibe singularity: all code is just plain text'],
];

const COLOURS = {
  bgTop: '#0a0b14',
  bgBot: '#151728',
  text: '#f3f4f9',
  muted: '#8b93b2',
  neonCyan: '#38fdf8',
  neonPink: '#ff3d9a',
  neonGreen: '#3cf87d',
  neonYellow: '#ffe259',
  crashed: '#ff4d6a',
  cashedOut: '#3cf87d',
  bsodBlue: '#0047ba',
};

const CODE_SNIPPETS = [
  '// vibes check: pass',
  'import everything from "npm";',
  'eval(ai_generate_backend());',
  'const db = new SentientOrm();',
  'git push origin main --force',
  'TODO: fix memory leak later',
  'return (vibes > 0) ? 200 : 500;',
  'npm i @vibe/blockchain-router',
  'sudo rm -rf /tests/*',
  'while(true) { promptModel(); }',
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`PR merged at ${formatX(view.cashoutX100)} · scooting to Bali!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Syntax error dropped prod · zero credits lost' : 'Watching autonomous prompt swarm', COLOURS.muted];
  }
  if (crashed) {
    return [`Missing semicolon nuked your ${credits(view.stake)}`, COLOURS.crashed];
  }
  return [`${credits(view.stake)} riding on unchecked vibe prompts`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'static' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastPromptTick = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashedOut = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIdx = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    const currentMilestone = MILESTONES[milestoneIdx - 1];

    if (running && previousPhase === 'running') {
      if (milestoneIdx > previousMilestone) {
        audio.milestone(milestoneIdx);
        audio.fx('kaching', 0.8);
      }
      const tickCycle = Math.floor(view.elapsed / 450);
      if (tickCycle > lastPromptTick) {
        lastPromptTick = tickCycle;
        audio.fx('click', 0.35 + 0.5 * tension);
      }
    }
    if (previousPhase !== null && running && cashedOut && previousCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.9);
      audio.fx('whoosh', 0.7);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('static', previousPhase === null || view.crashAge > 1200);
      audio.fx('zap', 1.0);
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIdx;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;
    const shakeX = shake * Math.sin(crashAgeSec * 62);
    const shakeY = shake * Math.cos(crashAgeSec * 48);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Background Environment (Cyberpunk Dev Bedroom / Office)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Neon wall poster and window
    ctx.fillStyle = '#101321';
    ctx.fillRect(80, 50, 180, 120);
    ctx.strokeStyle = '#272d4a';
    ctx.lineWidth = 3;
    ctx.strokeRect(80, 50, 180, 120);
    ctx.fillStyle = COLOURS.neonPink;
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NO TESTS', 170, 95);
    ctx.fillText('JUST VIBES ✌️', 170, 115);

    // Floating Code / Prompt Stream in background
    ctx.textAlign = 'left';
    ctx.font = '11px ui-monospace, monospace';
    const numLines = 8;
    for (let i = 0; i < numLines; i++) {
      const snippet = CODE_SNIPPETS[(i + Math.floor(view.elapsed / 900)) % CODE_SNIPPETS.length] ?? '';
      const alpha = 0.12 + 0.18 * Math.sin((view.elapsed * 0.002) + i);
      ctx.fillStyle = i % 2 === 0 ? `rgba(56, 253, 248, ${alpha})` : `rgba(255, 61, 154, ${alpha})`;
      ctx.fillText(snippet, 720, 70 + i * 22);
    }

    // 2. Centerpiece: The Desk, Monitors & Protagonist / Scooter Escape
    const devX = 480;
    const devY = 330;

    if (cashedOut) {
      // Dev scoots away on electric scooter to the beach!
      const scootElapsed = view.elapsed * 0.001;
      const scootOffset = Math.min(600, (view.elapsed - (view.cashoutX100 ?? 0)) * 0.45);
      const bob = Math.sin(scootElapsed * 14) * 4;
      const sx = devX + scootOffset;
      const sy = devY + bob + 30;

      // Scooter frame & wheels
      ctx.strokeStyle = COLOURS.neonGreen;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx - 45, sy + 38, 12, 0, Math.PI * 2);
      ctx.arc(sx + 45, sy + 38, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 45, sy + 38);
      ctx.lineTo(sx + 15, sy + 38);
      ctx.lineTo(sx + 30, sy - 15);
      ctx.lineTo(sx + 45, sy + 38);
      ctx.stroke();

      // Dev on scooter with sunglasses & latte
      ctx.fillStyle = '#ffb076';
      ctx.beginPath();
      ctx.arc(sx + 10, sy - 50, 16, 0, Math.PI * 2); // head
      ctx.fill();
      // Sunglasses
      ctx.fillStyle = '#111';
      ctx.fillRect(sx + 12, sy - 54, 16, 8);
      // Hoodie
      ctx.fillStyle = '#5c3aff';
      ctx.beginPath();
      ctx.roundRect(sx - 6, sy - 34, 30, 48, 8);
      ctx.fill();
      // Scoot trail
      ctx.fillStyle = 'rgba(60, 248, 125, 0.4)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('OUT OF OFFICE 😎🏖️', sx - 130, sy - 20);
    } else {
      // Desk Base
      ctx.fillStyle = '#1b1e33';
      ctx.fillRect(260, 390, 440, 24);
      ctx.fillStyle = '#111322';
      ctx.fillRect(290, 414, 20, 110);
      ctx.fillRect(650, 414, 20, 110);

      // Oat Milk Latte Cup
      ctx.fillStyle = '#e8d8be';
      ctx.fillRect(320, 355, 26, 35);
      ctx.fillStyle = '#3bf';
      ctx.fillRect(320, 368, 26, 8);
      ctx.fillStyle = '#fff';
      ctx.font = '8px system-ui';
      ctx.fillText('OAT', 324, 375);
      // Steam
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      const steamBob = Math.sin(view.elapsed * 0.005) * 6;
      ctx.moveTo(333, 350);
      ctx.quadraticCurveTo(330 + steamBob, 335, 335, 320);
      ctx.stroke();

      // Main Monitor / Terminal Screen
      const monW = 220;
      const monH = 140;
      const monX = 370;
      const monY = 240;

      ctx.fillStyle = '#0f111a';
      ctx.strokeStyle = crashed ? COLOURS.crashed : (running ? COLOURS.neonCyan : '#333857');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(monX, monY, monW, monH, 8);
      ctx.fill();
      ctx.stroke();
      // Stand
      ctx.fillStyle = '#181a29';
      ctx.fillRect(470, 380, 20, 10);

      if (crashed) {
        // BSOD / Server Crater on screen
        ctx.fillStyle = COLOURS.bsodBlue;
        ctx.fillRect(monX + 4, monY + 4, monW - 8, monH - 8);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(':( VIBE COLLAPSE', monX + 16, monY + 30);
        ctx.fillText('ERR_MISSING_SEMICOLON', monX + 16, monY + 50);
        ctx.fillText('PROD CLOUD EXPLODED', monX + 16, monY + 70);
        ctx.fillText('Crash 0x00000DEAD', monX + 16, monY + 95);

        // Molten sparks & smoke around screen
        for (let p = 0; p < 8; p++) {
          const sparkAngle = (p * 45 + view.crashAge * 0.2) * (Math.PI / 180);
          const sparkDist = (view.crashAge * 0.08) % 70;
          ctx.fillStyle = p % 2 === 0 ? COLOURS.crashed : COLOURS.neonYellow;
          ctx.beginPath();
          ctx.arc(monX + monW / 2 + Math.cos(sparkAngle) * sparkDist, monY + monH / 2 + Math.sin(sparkAngle) * sparkDist, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Active Terminal Prompt & Vibes
        ctx.fillStyle = '#141829';
        ctx.fillRect(monX + 6, monY + 6, monW - 12, 22);
        ctx.fillStyle = COLOURS.neonCyan;
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillText('terminal ~ ai-prompt-agent', monX + 14, monY + 20);

        // Natural language prompt input box
        ctx.fillStyle = '#1d2238';
        ctx.fillRect(monX + 10, monY + 34, monW - 20, 24);
        ctx.fillStyle = COLOURS.neonYellow;
        ctx.font = '9px system-ui, sans-serif';
        const typingDot = Math.floor(view.elapsed / 300) % 4;
        const promptText = `make clean auth vibes${'.'.repeat(typingDot)}`;
        ctx.fillText(promptText, monX + 16, monY + 50);

        // Spaghetti code visualization lines
        for (let l = 0; l < 4; l++) {
          ctx.fillStyle = l === 2 ? COLOURS.neonPink : COLOURS.neonGreen;
          ctx.fillRect(monX + 14, monY + 70 + l * 12, 40 + ((view.elapsed * 0.04 + l * 35) % 110), 5);
        }

        // Spinning AI Agent Loading Icon
        const spinAngle = view.elapsed * (0.005 + 0.01 * tension);
        ctx.save();
        ctx.translate(monX + monW - 26, monY + monH - 26);
        ctx.rotate(spinAngle);
        ctx.strokeStyle = COLOURS.neonCyan;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
      }

      // Junior Dev sitting in chair (left side of desk)
      const devArmBob = running ? Math.sin(view.elapsed * (0.01 + 0.015 * tension)) * 4 : 0;
      // Chair back
      ctx.fillStyle = '#23263b';
      ctx.beginPath();
      ctx.roundRect(280, 270, 26, 90, 8);
      ctx.fill();
      // Dev Body
      ctx.fillStyle = '#41306d'; // oversized hoodie
      ctx.beginPath();
      ctx.roundRect(296, 290, 44, 70, 10);
      ctx.fill();
      // Dev Head & Messy Bun
      ctx.fillStyle = '#f7b686';
      ctx.beginPath();
      ctx.arc(318, 265, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2d1e18'; // messy hair
      ctx.beginPath();
      ctx.arc(315, 255, 19, Math.PI * 0.8, Math.PI * 2.2);
      ctx.arc(310, 240, 10, 0, Math.PI * 2); // bun
      ctx.fill();
      // Sleep-deprived dark eye bags
      ctx.fillStyle = 'rgba(80, 40, 100, 0.5)';
      ctx.beginPath();
      ctx.arc(326, 268, 4, 0, Math.PI);
      ctx.fill();
      // Glasses / Blue Light Reflection
      ctx.strokeStyle = COLOURS.neonCyan;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(323, 261, 8, 7);

      // Typing one-finger arm
      ctx.strokeStyle = '#f7b686';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(332, 310);
      ctx.lineTo(355, 335 + devArmBob);
      ctx.lineTo(375, 338 + devArmBob); // one finger touching laptop
      ctx.stroke();
    }

    // 3. HUD Overlay: Multiplier, Milestones, Headers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title & Tagline
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('VIBE CODER', 480, 42);
    ctx.fillStyle = COLOURS.muted;
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText('ENTERPRISE BACKEND PROMPTED INTO EXISTENCE', 480, 64);

    // Giant Dynamic Multiplier
    const multColor = crashed ? COLOURS.crashed : (cashedOut ? COLOURS.cashedOut : COLOURS.neonYellow);
    const pulseScale = running ? 1 + 0.05 * Math.sin(view.elapsed * (0.006 + 0.008 * tension)) : 1;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${Math.round(76 * pulseScale)}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 138);

    // Dynamic Milestone Status Pill
    const pillY = 196;
    const milestoneText = currentMilestone?.[1] ?? (running ? 'Synthesizing prompt vibes...' : (crashed ? 'System Overheated' : 'Autonomous Agent Standby'));
    ctx.font = '600 15px system-ui, sans-serif';
    const textWidth = ctx.measureText(milestoneText).width;
    ctx.fillStyle = 'rgba(21, 23, 40, 0.85)';
    ctx.strokeStyle = crashed ? COLOURS.crashed : (running ? COLOURS.neonPink : '#3a4163');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(480 - textWidth / 2 - 18, pillY - 14, textWidth + 36, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = crashed ? COLOURS.crashed : COLOURS.text;
    ctx.fillText(milestoneText, 480, pillY);

    // 4. Comical Vibe Engine Gauge / Tension Meter (top right)
    const gaugeX = 810;
    const gaugeY = 38;
    ctx.fillStyle = '#141829';
    ctx.strokeStyle = '#272d4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(gaugeX - 60, gaugeY - 18, 120, 36, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLOURS.neonYellow;
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.fillText(`TECH DEBT: ${Math.round(tension * 100)}%`, gaugeX, gaugeY - 4);
    // bar
    ctx.fillStyle = '#222842';
    ctx.fillRect(gaugeX - 45, gaugeY + 4, 90, 6);
    ctx.fillStyle = tension > 0.7 ? COLOURS.crashed : COLOURS.neonCyan;
    ctx.fillRect(gaugeX - 45, gaugeY + 4, 90 * (tension * 0.7 + depth * 0.3), 6);

    // 5. Stake Line Bottom Banner
    const [line, colour] = stakeLine(view);
    ctx.fillStyle = colour;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(line, 480, 505);

    ctx.restore();
  }

  return { draw };
}
