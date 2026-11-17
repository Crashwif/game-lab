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
  [120, 'Waking up at 4:15 AM to reflect'],
  [150, 'Rejecting a high-paying offer to grow'],
  [200, 'Turning a flat tire into synergy'],
  [250, 'Double-spacing every single sentence'],
  [300, 'Praising the grit of a drive-thru cashier'],
  [500, 'Claiming failure is just spicy revenue'],
  [1000, 'Tagging 47 unrelated founders in post'],
  [10000, 'Over one million blue clapping hand reacts'],
  [100000, 'Invited to keynoting an aerospace summit'],
  [1000000, 'Declared spiritual deity of corporate hustle'],
];

const BUZZWORDS = [
  'SYNERGY', 'GRIND', '3:30 AM', 'UNAPOLOGETIC', 'PARADIGM', 'AGREE?', 'SCALE',
  '10X VALUE', 'RESILIENCE', 'PIVOT', 'PASSION', 'ALPHA MINDSET', 'NETWORKING'
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'trombone' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastTapSound = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);

    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;
    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.9);
      audio.fx('kaching', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('trombone', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.7);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIndex > prevMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('notify', 0.8);
      }
      // Rapid phone tapping sounds while executive hammers out platitudes
      if (view.elapsed - lastTapSound > Math.max(70, 240 - tension * 170) && !cashed) {
        lastTapSound = view.elapsed;
        audio.fx('click', 0.35 + 0.35 * tension);
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;
    const shakeX = shake * Math.sin(crashAgeSec * 85);
    const shakeY = shake * Math.cos(crashAgeSec * 73);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Sleek corporate boardroom background
    const bgGrad = ctx.createLinearGradient(0, 0, 960, 540);
    bgGrad.addColorStop(0, '#06101e');
    bgGrad.addColorStop(0.6, '#0b1d36');
    bgGrad.addColorStop(1, '#051329');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Distant high-rise window skyline
    ctx.fillStyle = '#0f2747';
    for (let i = 0; i < 9; i++) {
      const bx = 40 + i * 105;
      const bw = 70;
      const bh = 140 + Math.sin(i * 1.7) * 60;
      ctx.fillRect(bx, 340 - bh, bw, bh);
      // Window twinkles
      ctx.fillStyle = '#1c4373';
      for (let wy = 350 - bh + 10; wy < 330; wy += 22) {
        if ((i + Math.floor(wy / 22)) % 3 !== 0) {
          ctx.fillRect(bx + 12, wy, 16, 10);
          ctx.fillRect(bx + 40, wy, 16, 10);
        }
      }
      ctx.fillStyle = '#0f2747';
    }

    // High-rise glass mullions & desk ledge
    ctx.strokeStyle = 'rgba(0, 119, 181, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 360); ctx.lineTo(960, 360);
    ctx.stroke();

    // 2. The Thought Leadership Stack (Jenga blocks escalating to heaven)
    const stackX = 670;
    const baseStackY = 350;
    const blocksCount = Math.min(11, Math.floor(tension * 12) + (running || cashed ? 2 : 1));
    const wobble = Math.sin(view.elapsed * 0.008) * (tension * 9);

    for (let b = 0; b < blocksCount; b++) {
      const by = baseStackY - b * 26;
      const word = BUZZWORDS[b % BUZZWORDS.length] ?? 'AGREE?';
      const offset = (b % 2 === 0 ? 1 : -1) * (wobble * (b / 10));
      
      ctx.save();
      ctx.translate(stackX + offset, by);
      // Double spaced Jenga block
      ctx.fillStyle = b === blocksCount - 1 && running ? '#00a0dc' : '#0077b5';
      ctx.shadowColor = 'rgba(0, 160, 220, 0.4)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(-120, -11, 240, 22, 6);
      ctx.fill();

      // Text inside block
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`“${word}”  👏💡`, 0, 0);
      ctx.restore();
    }

    // Floating reaction icons (👏, 💡, 👍) drifting upwards
    if (running || cashed) {
      const rxCount = 6;
      for (let r = 0; r < rxCount; r++) {
        const t = (view.elapsed * 0.0018 + r * 1.6) % 3;
        const rx = 620 + (r * 45) % 180 + Math.sin(t * 4 + r) * 15;
        const ry = baseStackY - t * 110;
        const alpha = clamp01(1 - t / 3);
        ctx.globalAlpha = alpha;
        ctx.font = '18px system-ui, sans-serif';
        const icon = r % 3 === 0 ? '👏' : r % 3 === 1 ? '💡' : '👍';
        ctx.fillText(icon, rx, ry);
      }
      ctx.globalAlpha = 1;
    }

    // 3. Protagonist: Executive hammering post & Cold Brew on Desk
    const execX = 290;
    const execY = 320;
    const tapSpeed = 12 + tension * 20;
    const handBob = running ? Math.sin(view.elapsed * 0.02 * tapSpeed) * 3 : 0;

    // Marble Desk Top
    const deskGrad = ctx.createLinearGradient(0, 360, 0, 540);
    deskGrad.addColorStop(0, '#1c2838');
    deskGrad.addColorStop(1, '#0e1724');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(0, 360, 960, 180);

    // Gold trim line on desk
    ctx.fillStyle = '#c5a059';
    ctx.fillRect(0, 360, 960, 4);

    // Untouched Cold Brew on the desk (right side of executive)
    const brewX = execX + 130;
    const brewY = 350;
    // Glass
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.roundRect(brewX - 16, brewY - 55, 32, 60, [2, 2, 8, 8]);
    ctx.fill();
    // Cold brew liquid
    ctx.fillStyle = '#2b1406';
    ctx.beginPath();
    ctx.roundRect(brewX - 14, brewY - 42, 28, 45, [0, 0, 6, 6]);
    ctx.fill();
    // Cream swirl & straw
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(brewX + 4, brewY - 70);
    ctx.lineTo(brewX - 4, brewY - 20);
    ctx.stroke();
    // Condensation tag
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '600 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COLD BREW (UNTROUBLED)', brewX, brewY + 14);

    // Executive Body: Crisp Navy Blazer
    ctx.fillStyle = '#162b4d';
    ctx.beginPath();
    ctx.moveTo(execX - 55, execY + 45);
    ctx.lineTo(execX - 35, execY - 40);
    ctx.lineTo(execX + 35, execY - 40);
    ctx.lineTo(execX + 55, execY + 45);
    ctx.closePath();
    ctx.fill();

    // Crisp White Shirt collar & gold silk tie
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(execX - 18, execY - 38);
    ctx.lineTo(execX, execY - 10);
    ctx.lineTo(execX + 18, execY - 38);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(execX - 6, execY - 14);
    ctx.lineTo(execX + 6, execY - 14);
    ctx.lineTo(execX + 3, execY + 30);
    ctx.lineTo(execX, execY + 36);
    ctx.lineTo(execX - 3, execY + 30);
    ctx.closePath();
    ctx.fill();

    // Executive Head & Grinning Face
    const headY = execY - 70 + (running ? Math.sin(view.elapsed * 0.005) * 2 : 0);
    ctx.fillStyle = '#f6c59d'; // Skin tone
    ctx.beginPath();
    ctx.arc(execX, headY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Slicked Hair
    ctx.fillStyle = '#26170d';
    ctx.beginPath();
    ctx.arc(execX, headY - 10, 24, Math.PI, 0, false);
    ctx.bezierCurveTo(execX + 26, headY - 5, execX + 10, headY - 28, execX - 22, headY - 8);
    ctx.fill();

    // Manic Grin / Expressions
    if (crashed) {
      // Sweating / stunned expression
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(execX - 8, headY - 2, 4, 0, Math.PI * 2);
      ctx.arc(execX + 8, headY - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      // O-mouth
      ctx.strokeStyle = '#831843';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(execX, headY + 12, 7, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Unflinching thought leader grin
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(execX - 9, headY - 4, 3, 0, Math.PI * 2);
      ctx.arc(execX + 9, headY - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Huge gleaming white teeth
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(execX, headY + 7, 14, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(execX - 12, headY + 10);
      ctx.lineTo(execX + 12, headY + 10);
      ctx.stroke();
    }

    // Glowing Smartphone held in hands
    const phoneX = execX;
    const phoneY = execY + 18 + handBob;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(phoneX - 22, phoneY - 34, 44, 66, 6);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Smartphone screen (blue feed glow)
    const screenGlow = ctx.createLinearGradient(phoneX, phoneY - 30, phoneX, phoneY + 28);
    screenGlow.addColorStop(0, '#0284c7');
    screenGlow.addColorStop(1, '#0369a1');
    ctx.fillStyle = screenGlow;
    ctx.fillRect(phoneX - 18, phoneY - 28, 36, 56);

    // Screen rapid text lines
    ctx.fillStyle = '#e0f2fe';
    for (let l = 0; l < 4; l++) {
      ctx.fillRect(phoneX - 14, phoneY - 22 + l * 11, 28, 4);
    }

    // Frantic typing thumbs
    ctx.fillStyle = '#f6c59d';
    const thumbL = Math.sin(view.elapsed * 0.035 * tapSpeed) * 4;
    const thumbR = Math.cos(view.elapsed * 0.035 * tapSpeed) * 4;
    ctx.beginPath();
    ctx.arc(phoneX - 18, phoneY + thumbL, 6, 0, Math.PI * 2);
    ctx.arc(phoneX + 18, phoneY + thumbR, 6, 0, Math.PI * 2);
    ctx.fill();

    // 4. Overlays: Cashout Keynote Stage vs Crashed PR Meltdown
    if (cashed) {
      // TEDx Keynote Stage spotlight & gold trophy banner
      ctx.fillStyle = 'rgba(225, 29, 72, 0.18)';
      ctx.beginPath();
      ctx.moveTo(480, 0); ctx.lineTo(120, 540); ctx.lineTo(840, 540); ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(180, 160, 600, 140, 16);
      ctx.fill();
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(230, 230, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TEDx', 230, 238);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.font = '800 28px system-ui, sans-serif';
      ctx.fillText('KEYNOTE INVITATION SECURED!', 280, 210);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText(`Locked in at ${formatX(view.cashoutX100 ?? 100)} · 1.4M Claps & Endless Synergy`, 280, 244);
      ctx.fillStyle = '#4ade80';
      ctx.fillText('“Stray alley cats taught me B2B enterprise sales.”', 280, 272);
    } else if (crashed) {
      // Unhinged Quote-Tweet & PR Alert
      const stampScale = Math.min(1, crashAgeSec * 7);
      ctx.save();
      ctx.translate(480, 220);
      ctx.scale(stampScale, stampScale);
      ctx.rotate(-0.08);

      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-260, -65, 520, 130);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.strokeRect(-252, -57, 504, 114);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '900 36px system-ui, sans-serif';
      ctx.fillText('QUOTE-TWEETED: “UNHINGED”', 0, -12);

      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.fillText('PR FIRM ORDERS IMMEDIATE DELETION · CIRCULATING SLACK', 0, 24);
      ctx.restore();
    }

    // 5. HUD: Title, Multiplier, Milestone & Stake
    // Header banner
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText('HUMBLEBRAG CLIMB', 480, 48);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('STACK THOUGHT LEADERSHIP BUZZWORDS · DON’T BREAK LINKEDIN', 480, 72);

    // Multiplier display
    const multColor = crashed ? '#f87171' : cashed ? '#4ade80' : '#38bdf8';
    ctx.fillStyle = multColor;
    ctx.font = `900 ${70 + depth * 14}px ui-monospace, monospace`;
    ctx.fillText(formatX(view.currentX100), 480, 142);

    // Story milestone ticker / status
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 20px system-ui, sans-serif';
    if (running && currentMilestone) {
      ctx.fillText(`“${currentMilestone[1]}”`, 480, 400);
    } else if (view.phase === 'betting') {
      ctx.fillText('Tap cold brew and draft the ultimate hustle post...', 480, 400);
    } else if (view.phase === 'waiting') {
      ctx.fillText('Networking in boardroom lobby...', 480, 400);
    }

    // Stake line footer
    let stakeText = 'Watching the hustle · no credits on table';
    let stakeCol = '#94a3b8';
    if (view.stake !== null) {
      if (cashed) {
        stakeText = `Cashed out at ${formatX(view.cashoutX100 ?? 100)} · Keynote unlocked!`;
        stakeCol = '#4ade80';
      } else if (crashed) {
        stakeText = `Screenshotted to company Slack · ${credits(view.stake)} lost to PR`;
        stakeCol = '#f87171';
      } else {
        stakeText = `Active Post: ${credits(view.stake)} riding on viral growth`;
        stakeCol = '#38bdf8';
      }
    }
    ctx.fillStyle = stakeCol;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(stakeText, 480, 500);

    ctx.restore();
  }

  return { draw };
}
