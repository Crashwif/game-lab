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
  bgTop: '#0a0d1a',
  bgBottom: '#121b2d',
  grid: '#1b324d',
  nvidiaGreen: '#76b900',
  neonCyan: '#00e5ff',
  amber: '#ffaa00',
  leather: '#2b231d',
  text: '#f3f6fc',
  muted: '#8e9eb5',
  pinkSlip: '#ff4d6d',
  crashed: '#ff3366',
  cashedOut: '#00ffaa',
  goldBadge: '#ffd700',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'First three interns sign in pencil'],
  [150, 'Lead CUDA engineer signs with thermal paste'],
  [200, 'Cafeteria chef adds whole kitchen roster'],
  [250, 'Black leather vest draped over server rack'],
  [300, 'Petition roll unspools across parking lot'],
  [500, 'Billionaire whale tweets support emoji'],
  [1000, 'Boardroom door hinges begin rattling'],
  [10000, 'Drones drop signed leather patches on roof'],
  [100000, 'Entire datacenter blinks in morse petition'],
  [1000000, 'Jensen hologram beams into auditorium'],
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [text: string, colour: string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Petition filed at ${formatX(view.cashoutX100)} · Gold GPU Badge Secured!`, COLOURS.cashedOut];
  }
  if (view.stake === null) {
    return [crashed ? 'Boardroom locked · Spectating from the hallway' : 'Observer badge · No petition stake riding', COLOURS.muted];
  }
  if (crashed) {
    return [`Reorg memo hit: ${credits(view.stake)} vanished into middle management`, COLOURS.crashed];
  }
  return [`Sprinting with ${credits(view.stake)} worth of signatures!`, COLOURS.neonCyan];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousMilestone = 0;
  let lastFootstep = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(view.currentX100 / 100) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    // Trigger audio cues
    if (previousPhase !== null && running && cashed && previousCashout === null) {
      audio.cashout();
      audio.fx('cheer', 0.8);
      audio.fx('kaching', 0.9);
    }
    if (crashed && previousPhase !== 'crashed') {
      audio.crash('shatter', previousPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.6);
    }
    if (running && previousPhase === 'running') {
      if (milestoneIndex > previousMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('whoosh', 0.7);
      }
      const stepInterval = Math.max(120, 280 - tension * 160);
      if (now - lastFootstep > stepInterval) {
        lastFootstep = now;
        if (!cashed) audio.fx('tick', 0.3 + 0.5 * tension);
      }
    }

    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.5) ** 2 : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.sin(now * 0.08) * shake), (Math.cos(now * 0.09) * shake));
    }

    // 1. Tech Campus Server Hallway Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 540);
    bgGrad.addColorStop(0, COLOURS.bgTop);
    bgGrad.addColorStop(1, COLOURS.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Dynamic corridor perspective lines
    const vpX = 480;
    const vpY = 220;
    const scrollOffset = (view.elapsed * (1.2 + tension * 2.5)) % 60;

    ctx.strokeStyle = COLOURS.grid;
    ctx.lineWidth = 1.5;
    for (let x = -300; x <= 1260; x += 120) {
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }

    // Floor grid cross lines rushing forward
    for (let d = 0; d < 10; d++) {
      const p = (d * 30 + scrollOffset) / 300;
      const y = vpY + (540 - vpY) * (p * p);
      const span = 960 * p;
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.12 + p * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(vpX - span / 2, y);
      ctx.lineTo(vpX + span / 2, y);
      ctx.stroke();
    }

    // Server racks flanking hallway
    for (let side = -1; side <= 1; side += 2) {
      const rackX = side === -1 ? 40 : 800;
      ctx.fillStyle = '#070a12';
      ctx.fillRect(rackX, 160, 120, 360);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(rackX, 160, 120, 360);

      // Blinking server LED diodes (green & cyan)
      for (let row = 0; row < 12; row++) {
        const ledY = 180 + row * 26;
        const blink1 = Math.sin(now * 0.008 + row + (side > 0 ? 3 : 0)) > 0;
        const blink2 = Math.cos(now * 0.006 + row) > -0.2;
        ctx.fillStyle = blink1 ? COLOURS.nvidiaGreen : '#0f3318';
        ctx.fillRect(rackX + 20, ledY, 14, 5);
        ctx.fillStyle = blink2 ? COLOURS.neonCyan : '#0c2838';
        ctx.fillRect(rackX + 42, ledY, 14, 5);
      }
    }

    // Boardroom Glass Doors in background (closing down with tension)
    const doorClose = crashed ? 1 : clamp01(tension * 0.9);
    const doorGap = (1 - doorClose) * 110;
    ctx.fillStyle = 'rgba(10, 25, 45, 0.85)';
    ctx.fillRect(vpX - 80, vpY - 70, 160, 100);
    // Left & Right Glass Doors sliding shut
    ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
    ctx.strokeStyle = crashed ? COLOURS.crashed : COLOURS.neonCyan;
    ctx.lineWidth = 2;
    // Left door
    ctx.fillRect(vpX - 70, vpY - 60, 70 - doorGap / 2, 90);
    ctx.strokeRect(vpX - 70, vpY - 60, 70 - doorGap / 2, 90);
    // Right door
    ctx.fillRect(vpX + doorGap / 2, vpY - 60, 70 - doorGap / 2, 90);
    ctx.strokeRect(vpX + doorGap / 2, vpY - 60, 70 - doorGap / 2, 90);

    // Boardroom Sign above doors
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXECUTIVE BOARDROOM', vpX, vpY - 66);

    // 2. Main Protagonist: AI Engineer running with Petition
    const runCycle = (view.elapsed * (0.012 + tension * 0.018)) % (Math.PI * 2);
    const engX = 480;
    const engY = 360 + (running ? Math.sin(runCycle * 2) * 8 : 0);

    if (!crashed) {
      // Long flowing petition roll trailing behind him
      const rollPoints = 14;
      ctx.beginPath();
      ctx.moveTo(engX - 25, engY + 5);
      for (let i = 1; i <= rollPoints; i++) {
        const segX = engX - 25 - i * 18;
        const wave = Math.sin(runCycle + i * 0.6) * (8 + i * 2);
        ctx.lineTo(segX, engY + 12 + wave);
      }
      ctx.lineWidth = 20;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Signatures squiggles on the unspooling roll
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1e293b';
      for (let i = 2; i <= rollPoints; i += 2) {
        const segX = engX - 25 - i * 18;
        const wave = Math.sin(runCycle + i * 0.6) * (8 + i * 2);
        ctx.beginPath();
        ctx.moveTo(segX - 4, engY + 10 + wave);
        ctx.lineTo(segX + 4, engY + 14 + wave);
        ctx.stroke();
      }

      // Engineer Legs (running animation)
      const legL = Math.sin(runCycle) * 22;
      const legR = Math.sin(runCycle + Math.PI) * 22;
      ctx.strokeStyle = '#1a2233';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      // Left leg
      ctx.beginPath();
      ctx.moveTo(engX - 6, engY + 32);
      ctx.lineTo(engX - 12 + legL, engY + 68);
      ctx.stroke();
      // Right leg
      ctx.beginPath();
      ctx.moveTo(engX + 6, engY + 32);
      ctx.lineTo(engX + 10 + legR, engY + 68);
      ctx.stroke();

      // Torso / Iconic Leather Jacket!
      ctx.fillStyle = COLOURS.leather;
      ctx.beginPath();
      ctx.roundRect(engX - 16, engY - 5, 32, 40, 6);
      ctx.fill();
      // Silver zippers & collar
      ctx.strokeStyle = '#a6b4ca';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(engX - 3, engY - 2);
      ctx.lineTo(engX - 3, engY + 30);
      ctx.stroke();

      // Engineer Head
      ctx.fillStyle = '#ffd1b3';
      ctx.beginPath();
      ctx.arc(engX, engY - 20, 16, 0, Math.PI * 2);
      ctx.fill();

      // Messy Sleep-deprived Hair
      ctx.fillStyle = '#3a2e2b';
      ctx.beginPath();
      ctx.arc(engX - 2, engY - 28, 16, Math.PI, Math.PI * 2);
      ctx.fill();
      // Wild hair spikes
      ctx.beginPath();
      ctx.moveTo(engX - 16, engY - 24);
      ctx.lineTo(engX - 24, engY - 34);
      ctx.lineTo(engX - 10, engY - 28);
      ctx.lineTo(engX - 4, engY - 38);
      ctx.lineTo(engX + 4, engY - 28);
      ctx.lineTo(engX + 16, engY - 35);
      ctx.lineTo(engX + 14, engY - 22);
      ctx.fill();

      // Eyeglasses & tired eye bags
      ctx.strokeStyle = COLOURS.neonCyan;
      ctx.lineWidth = 2;
      ctx.strokeRect(engX + 2, engY - 23, 10, 7);
      ctx.fillStyle = '#ff8899';
      ctx.fillRect(engX + 3, engY - 14, 8, 2);

      // Clipboard in hands outstretched forward
      ctx.fillStyle = '#b45309'; // Wooden clipboard
      ctx.fillRect(engX + 14, engY + 2, 22, 28);
      ctx.fillStyle = '#ffffff'; // Paper
      ctx.fillRect(engX + 16, engY + 5, 18, 22);
      // Signature lines on clipboard
      ctx.fillStyle = COLOURS.nvidiaGreen;
      ctx.fillRect(engX + 18, engY + 8, 14, 2);
      ctx.fillRect(engX + 18, engY + 12, 12, 2);
      ctx.fillRect(engX + 18, engY + 16, 14, 2);

      // Green CUDA sparks flying around clipboard
      if (running) {
        ctx.fillStyle = COLOURS.nvidiaGreen;
        for (let s = 0; s < 5; s++) {
          const spX = engX + 25 + Math.sin(now * 0.02 + s * 1.5) * 20;
          const spY = engY + 10 + Math.cos(now * 0.02 + s * 2.1) * 16;
          ctx.beginPath();
          ctx.arc(spX, spY, 2 + (s % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // CASHOUT ESCAPE CELEBRATION OVERLAY
      if (cashed) {
        ctx.fillStyle = 'rgba(0, 255, 170, 0.15)';
        ctx.fillRect(0, 0, 960, 540);

        // Huge Gold GPU Badge over engineer
        ctx.fillStyle = COLOURS.goldBadge;
        ctx.beginPath();
        ctx.arc(engX, engY - 65, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GPU', engX, engY - 69);
        ctx.fillText('HERO', engX, engY - 57);

        // Green holo beam
        ctx.fillStyle = 'rgba(118, 185, 0, 0.4)';
        ctx.beginPath();
        ctx.moveTo(engX - 50, 0);
        ctx.lineTo(engX + 50, 0);
        ctx.lineTo(engX + 70, 540);
        ctx.lineTo(engX - 70, 540);
        ctx.fill();
      }
    } else {
      // 3. CRASHED STATE: HR Storms with Pink Slips & Reorg Memo
      // Locked boardroom doors with big padlock
      ctx.fillStyle = '#e11d48';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 BOARDROOM SEALED', vpX, vpY + 10);

      // Pink Slips flying through air
      for (let p = 0; p < 16; p++) {
        const px = (p * 67 + now * 0.12) % 960;
        const py = (p * 41 + crashAgeSec * 220 + Math.sin(p + now * 0.005) * 40) % 540;
        const rot = p + now * 0.004;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillStyle = COLOURS.pinkSlip;
        ctx.fillRect(-14, -8, 28, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 8px system-ui, sans-serif';
        ctx.fillText('PINK SLIP', 0, 3);
        ctx.restore();
      }

      // Middle Management Slide Deck Stamp
      ctx.save();
      ctx.translate(480, 350);
      ctx.rotate(-0.08);
      ctx.fillStyle = 'rgba(255, 51, 102, 0.9)';
      ctx.fillRect(-220, -35, 440, 70);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(-220, -35, 440, 70);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CORP REORG: AUTOMATED SLIDE DECK', 0, -4);
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText('ALL ENGINEERS CONVERTED TO MIDDLE MANAGERS', 0, 18);
      ctx.restore();
    }

    // 4. TOP HUD & MULTIPLIER DISPLAY
    // Title Banner
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.nvidiaGreen;
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText('BRING BACK JENSEN', 480, 34);

    ctx.fillStyle = COLOURS.muted;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('LEATHER JACKET SIGNATURE SPRINT · SUBMIT BEFORE HR LOCKS THE BOARDROOM', 480, 56);

    // Huge Multiplier Display
    const multiplierColor = crashed ? COLOURS.crashed : cashed ? COLOURS.cashedOut : COLOURS.nvidiaGreen;
    ctx.fillStyle = multiplierColor;
    ctx.font = '900 76px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), 480, 126);

    // Milestone / Status Badge
    const activeMilestone = running ? MILESTONES[milestoneIndex - 1] : undefined;
    const bannerText = activeMilestone
      ? `★ ${activeMilestone[1]}`
      : (view.phase === 'betting' ? 'Stack your petition credits · Doors opening' : (crashed ? 'Boardroom locked by HR' : 'Assembling petition roll...'));

    ctx.fillStyle = 'rgba(7, 10, 18, 0.8)';
    ctx.beginPath();
    ctx.roundRect(160, 168, 640, 32, 16);
    ctx.fill();
    ctx.strokeStyle = multiplierColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(bannerText, 480, 184);

    // Live Signature Counter
    const signatureCount = Math.floor(view.currentX100 * 37.8);
    ctx.fillStyle = COLOURS.neonCyan;
    ctx.font = '700 14px ui-monospace, monospace';
    ctx.fillText(`COLLECTED SIGNATURES: ${signatureCount.toLocaleString('en-US')}`, 480, 460);

    // Bottom Stake / Payout line
    const [lineText, lineColour] = stakeLine(view);
    ctx.fillStyle = lineColour;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 498);

    ctx.restore();
  }

  return { draw };
}
