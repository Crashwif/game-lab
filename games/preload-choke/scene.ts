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
  [120, 'Fiber box begins humming softly'],
  [150, 'Download speed hits 800 MB/s'],
  [200, 'Neighborhood streetlights dim slightly'],
  [250, 'Router fan spins like a jet engine'],
  [300, 'Copper cables in the wall start smoking'],
  [500, 'ISP technician arrives in panic mode'],
  [1000, 'Download bar hits 99% but stalls'],
  [10000, 'Entire city block loses wifi access'],
  [100000, 'Broadband core terminal reaches plasma state'],
  [1000000, 'Global optic backbone redirects to your console'],
];

const COLOURS = {
  bg: '#0d0818',
  wall: '#1b1233',
  floor: '#110a24',
  tvBezel: '#0a0514',
  cyanNeon: '#00e5ff',
  orangeNeon: '#ff6600',
  plasmaPink: '#ff007f',
  greenSafe: '#00ff88',
  crashedRed: '#ff3344',
  textMuted: '#9a8eb5',
  textWhite: '#f5f2ff',
};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Installed at ${formatX(view.cashoutX100)} · 100% Patch Secured!`, COLOURS.greenSafe];
  }
  if (view.stake === null) {
    return [crashed ? 'Watched fiber vaporize · 0 credits lost' : 'Spectating broadband choke', COLOURS.textMuted];
  }
  if (crashed) return [`Router slagged! Lost ${credits(view.stake)}`, COLOURS.crashedRed];
  return [`Preloading 300GB · ${credits(view.stake)} riding`, COLOURS.orangeNeon];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'synthwave', crash: 'shatter' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let sparkSeed = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const cashed = view.cashoutX100 !== null;

    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100 / 100)) / 3);
    audio.update(view.phase, tension);

    const milestoneIndex = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (prevPhase !== null && running && cashed && prevCashout === null) {
      audio.cashout();
      audio.fx('bell', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('shatter', prevPhase === null || view.crashAge > 1500);
      audio.fx('boom', 1.0);
    }
    if (running && prevPhase === 'running') {
      if (milestoneIndex > prevMilestone) {
        audio.milestone(milestoneIndex);
        audio.fx('zap', 0.6 + tension * 0.4);
      }
      if (Math.sin(view.elapsed * 0.012) > 0.95 && Math.random() < 0.25) {
        audio.fx('beep', 0.2 + tension * 0.5);
      }
    }
    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneIndex;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed
      ? 18 * clamp01(1 - crashAgeSec / 0.6) ** 2
      : running
      ? (tension > 0.5 ? (tension - 0.5) * 8 * Math.sin(view.elapsed * 0.08) : 0)
      : 0;

    ctx.save();
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, 960, 540);
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // Room background: wall and synthwave perspective floor
    const wallGrad = ctx.createLinearGradient(0, 0, 0, 360);
    wallGrad.addColorStop(0, '#0a0614');
    wallGrad.addColorStop(1, COLOURS.wall);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, 960, 360);

    ctx.fillStyle = COLOURS.floor;
    ctx.fillRect(0, 360, 960, 180);

    // Floor neon perspective grid lines
    ctx.strokeStyle = `rgba(255, 0, 128, ${0.15 + tension * 0.25})`;
    ctx.lineWidth = 1.5;
    for (let x = -200; x <= 1160; x += 80) {
      ctx.beginPath();
      ctx.moveTo(480 + (x - 480) * 0.2, 360);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = 370; y < 540; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Window (top right) looking out at streetlights
    ctx.save();
    ctx.fillStyle = '#05030b';
    ctx.fillRect(720, 40, 200, 150);
    ctx.strokeStyle = '#2b1b4a';
    ctx.lineWidth = 6;
    ctx.strokeRect(720, 40, 200, 150);
    // Streetlight outside dims with tension
    const streetLightAlpha = Math.max(0.08, 0.9 - tension * 0.85);
    ctx.fillStyle = `rgba(255, 230, 120, ${streetLightAlpha})`;
    ctx.beginPath();
    ctx.arc(820, 90, 14, 0, Math.PI * 2);
    ctx.fill();
    // Silhouettes of angry neighbors banging window when tension is extreme
    if (tension > 0.45) {
      ctx.fillStyle = '#0f081c';
      const bob = Math.sin(view.elapsed * 0.015) * 4;
      ctx.beginPath();
      ctx.arc(770, 130 + bob, 16, 0, Math.PI * 2);
      ctx.arc(870, 135 - bob, 18, 0, Math.PI * 2);
      ctx.rect(755, 145 + bob, 30, 45);
      ctx.rect(852, 152 - bob, 36, 38);
      ctx.fill();
      // Fist banging mark
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(775, 115 + bob, 8, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();

    // TV / Monitor on the left (Center-Left: x: 80, y: 110, w: 340, h: 220)
    ctx.save();
    ctx.fillStyle = COLOURS.tvBezel;
    ctx.fillRect(70, 100, 360, 240);
    ctx.strokeStyle = '#321d5a';
    ctx.lineWidth = 4;
    ctx.strokeRect(70, 100, 360, 240);
    // TV Stand
    ctx.fillStyle = '#221538';
    ctx.fillRect(230, 340, 40, 40);
    ctx.fillRect(190, 380, 120, 10);

    // TV Screen content
    if (crashed) {
      // Blue screen of death
      ctx.fillStyle = '#0033cc';
      ctx.fillRect(80, 110, 340, 220);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 36px monospace';
      ctx.fillText(':(', 110, 160);
      ctx.font = '600 16px monospace';
      ctx.fillText('CRITICAL_ROUTER_MELTDOWN', 110, 200);
      ctx.fillText('ISP backbone dropped to 0 kbps', 110, 230);
      ctx.fillText('Molten copper detected in wall', 110, 260);
      ctx.fillText('Error code: 0xDEADSLAG', 110, 290);
    } else {
      // Download Screen
      const tvGrad = ctx.createLinearGradient(80, 110, 80, 330);
      tvGrad.addColorStop(0, '#0a1024');
      tvGrad.addColorStop(1, '#050714');
      ctx.fillStyle = tvGrad;
      ctx.fillRect(80, 110, 340, 220);

      // Title & stats on TV
      ctx.fillStyle = COLOURS.cyanNeon;
      ctx.font = '700 18px monospace';
      ctx.fillText('GIGA-INSTALLER v4.20', 100, 140);
      ctx.fillStyle = COLOURS.textMuted;
      ctx.font = '500 13px monospace';
      ctx.fillText('TARGET: 300.0 GB CyberPatch', 100, 165);

      // Speed gauge on TV
      const speedMb = (120 + tension * 4800 + depth * 50000).toFixed(0);
      ctx.fillStyle = tension > 0.7 ? COLOURS.orangeNeon : COLOURS.textWhite;
      ctx.fillText(`SPEED: ${speedMb} MB/s | PACKET LOSS: ${(tension * 42).toFixed(1)}%`, 100, 190);

      // Progress bar (fills with tension or 100% on cashout)
      const pct = cashed ? 100 : Math.min(99.9, 15 + tension * 84);
      ctx.fillStyle = '#161d33';
      ctx.fillRect(100, 215, 300, 30);
      const barGrad = ctx.createLinearGradient(100, 0, 400, 0);
      barGrad.addColorStop(0, COLOURS.cyanNeon);
      barGrad.addColorStop(1, cashed ? COLOURS.greenSafe : tension > 0.8 ? COLOURS.crashedRed : COLOURS.orangeNeon);
      ctx.fillStyle = barGrad;
      ctx.fillRect(102, 217, (296 * pct) / 100, 26);

      // Percentage text
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(cashed ? '100% COMPLETED!' : `${pct.toFixed(1)}%`, 250, 236);
      ctx.textAlign = 'left';

      // Matrix/graph visualization on bottom of screen
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.4 + 0.5 * Math.sin(view.elapsed * 0.02)})`;
      ctx.beginPath();
      for (let gx = 100; gx <= 400; gx += 15) {
        const gy = 295 - Math.sin((gx + view.elapsed * 0.2) * 0.06) * (6 + tension * 16);
        if (gx === 100) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Glowing Fiber Optic Cable from TV console (x: 250, y: 390) to Router (x: 770, y: 380)
    ctx.save();
    const fiberGlow = crashed ? 0 : 0.4 + tension * 0.6;
    ctx.strokeStyle = cashed ? COLOURS.greenSafe : tension > 0.7 ? COLOURS.orangeNeon : COLOURS.cyanNeon;
    ctx.lineWidth = 5 + tension * 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12 * fiberGlow;
    ctx.beginPath();
    ctx.moveTo(250, 390);
    ctx.bezierCurveTo(360, 450, 620, 470, 770, 380);
    ctx.stroke();
    ctx.restore();

    // Gamer on Couch (x: 440 to 620, y: 330 to 450)
    ctx.save();
    // Couch
    ctx.fillStyle = '#2d1840';
    ctx.beginPath();
    ctx.roundRect(430, 340, 180, 80, 16);
    ctx.fill();
    ctx.fillStyle = '#3e2259';
    ctx.fillRect(445, 380, 150, 35);

    // Gamer body
    const gamerBob = Math.sin(view.elapsed * 0.008) * 3;
    const gamerX = 510;
    const gamerY = 320 + gamerBob;

    if (cashed) {
      // Relaxed gamer with pizza slice!
      ctx.fillStyle = '#ffb380'; // arm/body
      ctx.beginPath();
      ctx.arc(gamerX, gamerY - 35, 18, 0, Math.PI * 2); // head
      ctx.fill();
      // Headphones
      ctx.fillStyle = COLOURS.cyanNeon;
      ctx.fillRect(gamerX - 22, gamerY - 45, 8, 20);
      ctx.fillRect(gamerX + 14, gamerY - 45, 8, 20);
      // Happy smile
      ctx.strokeStyle = '#331100';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(gamerX - 4, gamerY - 33, 8, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // Torso
      ctx.fillStyle = '#105577';
      ctx.fillRect(gamerX - 16, gamerY - 17, 32, 45);
      // Pizza slice in hand!
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.moveTo(gamerX - 28, gamerY - 10);
      ctx.lineTo(gamerX - 52, gamerY - 30);
      ctx.lineTo(gamerX - 56, gamerY - 5);
      ctx.closePath();
      ctx.fill();
      // Pepperoni
      ctx.fillStyle = '#cc2200';
      ctx.beginPath();
      ctx.arc(gamerX - 44, gamerY - 16, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Sweating / leaning forward gamer
      const lean = tension * 14;
      const headX = gamerX - 15 - lean;
      const headY = gamerY - 32;

      ctx.fillStyle = '#ffb380';
      ctx.beginPath();
      ctx.arc(headX, headY, 19, 0, Math.PI * 2);
      ctx.fill();

      // Headset
      ctx.fillStyle = tension > 0.7 ? COLOURS.orangeNeon : COLOURS.plasmaPink;
      ctx.fillRect(headX - 22, headY - 12, 7, 22);
      ctx.fillRect(headX + 15, headY - 12, 7, 22);
      ctx.beginPath();
      ctx.arc(headX, headY - 12, 19, Math.PI, 0);
      ctx.stroke();

      // Wide panic eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX - 12, headY - 6, 8, 8);
      ctx.fillRect(headX - 2, headY - 6, 8, 8);
      ctx.fillStyle = '#000000';
      ctx.fillRect(headX - 11, headY - 4, 4, 4);
      ctx.fillRect(headX - 1, headY - 4, 4, 4);

      // Sweat drops flying if high tension
      if (tension > 0.3) {
        ctx.fillStyle = COLOURS.cyanNeon;
        for (let s = 0; s < 3; s++) {
          const sy = headY - 20 - ((view.elapsed * 0.15 + s * 30) % 40);
          const sx = headX + 18 + s * 6;
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Torso & controller
      ctx.fillStyle = '#283655';
      ctx.fillRect(headX - 6, headY + 18, 28, 42);
      // Controller
      ctx.fillStyle = '#111118';
      ctx.fillRect(headX - 28, headY + 25, 24, 15);
      ctx.fillStyle = COLOURS.cyanNeon;
      ctx.fillRect(headX - 25, headY + 28, 4, 4);
    }
    ctx.restore();

    // Table and Router (Right side: table at x: 740, y: 350, w: 140)
    ctx.save();
    // Table
    ctx.fillStyle = '#221533';
    ctx.fillRect(720, 360, 160, 15);
    ctx.fillRect(740, 375, 14, 80);
    ctx.fillRect(846, 375, 14, 80);

    const routerX = 750;
    const routerY = 300;

    if (crashed) {
      // Detonated molten plastic & slag
      const slagAge = Math.min(1, crashAgeSec);
      ctx.fillStyle = '#1a0c0a';
      ctx.beginPath();
      ctx.ellipse(routerX + 45, routerY + 55, 60 + slagAge * 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing molten slag center
      ctx.fillStyle = COLOURS.orangeNeon;
      ctx.beginPath();
      ctx.ellipse(routerX + 45, routerY + 55, 30, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shrapnel & broken antennas flying outward
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 4;
      const fling = slagAge * 80;
      ctx.beginPath();
      ctx.moveTo(routerX - fling * 0.4, routerY - fling * 0.8);
      ctx.lineTo(routerX - fling * 0.6, routerY - fling * 1.1);
      ctx.moveTo(routerX + 80 + fling * 0.5, routerY - fling * 0.9);
      ctx.lineTo(routerX + 110 + fling * 0.8, routerY - fling * 1.3);
      ctx.stroke();

      // Heavy Smoke cloud billowing upwards
      for (let sm = 0; sm < 6; sm++) {
        const smAge = (crashAgeSec * 1.2 + sm * 0.25) % 1.5;
        const smAlpha = clamp01(1 - smAge / 1.5) * 0.6;
        ctx.fillStyle = `rgba(30, 20, 40, ${smAlpha})`;
        ctx.beginPath();
        ctx.arc(routerX + 45 + Math.sin(sm * 3 + crashAgeSec * 3) * 20, routerY - smAge * 110, 20 + smAge * 35, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // High-speed Router & overheating visual
      const heatR = Math.min(255, Math.floor(tension * 255));
      const heatG = Math.max(20, Math.floor(180 - tension * 160));
      const heatColor = `rgb(${heatR}, ${heatG}, 20)`;

      // Router chassis
      ctx.fillStyle = '#0f1118';
      ctx.fillRect(routerX, routerY + 15, 100, 45);
      ctx.strokeStyle = heatColor;
      ctx.lineWidth = 2 + tension * 3;
      ctx.strokeRect(routerX, routerY + 15, 100, 45);

      // Router Antennas (3 angled sticks)
      ctx.strokeStyle = tension > 0.6 ? COLOURS.orangeNeon : '#334466';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(routerX + 15, routerY + 15);
      ctx.lineTo(routerX - 5, routerY - 25);
      ctx.moveTo(routerX + 50, routerY + 15);
      ctx.lineTo(routerX + 50, routerY - 32);
      ctx.moveTo(routerX + 85, routerY + 15);
      ctx.lineTo(routerX + 105, routerY - 25);
      ctx.stroke();

      // Blinking / flashing LEDs
      const ledTick = Math.floor(view.elapsed * 0.03);
      for (let i = 0; i < 5; i++) {
        const on = (ledTick + i) % 2 === 0;
        ctx.fillStyle = on ? (tension > 0.6 ? COLOURS.crashedRed : COLOURS.greenSafe) : '#1a2233';
        ctx.beginPath();
        ctx.arc(routerX + 15 + i * 16, routerY + 38, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // High-speed cooling fan exhaust on side
      const fanAngle = view.elapsed * (0.02 + tension * 0.15);
      ctx.save();
      ctx.translate(routerX + 85, routerY + 38);
      ctx.strokeStyle = `rgba(255, 150, 50, ${0.4 + tension * 0.6})`;
      ctx.lineWidth = 2;
      for (let b = 0; b < 4; b++) {
        ctx.rotate(fanAngle + (b * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
      }
      ctx.restore();

      // Electric spark arcs if tension is high
      if (tension > 0.4 && running) {
        sparkSeed = (sparkSeed + 1) % 100;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let sx = routerX + 20;
        let sy = routerY + 15;
        ctx.moveTo(sx, sy);
        for (let j = 0; j < 4; j++) {
          sx += (Math.random() - 0.5) * 30;
          sy -= Math.random() * 14;
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // Heat haze shimmer lines above router
      if (tension > 0.25) {
        ctx.strokeStyle = `rgba(255, 100, 0, ${tension * 0.5})`;
        ctx.lineWidth = 1.5;
        for (let h = 0; h < 3; h++) {
          const hx = routerX + 25 + h * 24;
          const hy = routerY - 5;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.quadraticCurveTo(hx + Math.sin(view.elapsed * 0.02 + h) * 10, hy - 20, hx, hy - 40);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // HUD & Multiplier overlay at top center
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Title
    ctx.fillStyle = COLOURS.cyanNeon;
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('PRELOAD CHOKE', 480, 36);

    // Huge multiplier readout
    const punch = crashed ? 1 + 0.3 * (1 - clamp01(crashAgeSec / 0.3)) : 1;
    const multColor = cashed ? COLOURS.greenSafe : crashed ? COLOURS.crashedRed : COLOURS.textWhite;
    ctx.fillStyle = multColor;
    ctx.font = `900 ${Math.round(82 * punch)}px ui-monospace, monospace`;
    ctx.shadowColor = multColor;
    ctx.shadowBlur = 18;
    ctx.fillText(formatX(view.currentX100), 480, 105);
    ctx.shadowBlur = 0;

    // Milestone Caption
    const currentMilestone = MILESTONES[milestoneIndex - 1];
    const milestoneText = currentMilestone ? currentMilestone[1] : (running ? 'Waiting for fiber handshake...' : 'Insert credits to preload 300GB');
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = running && tension > 0.7 ? COLOURS.orangeNeon : COLOURS.textMuted;
    ctx.fillText(milestoneText, 480, 160);

    // Stake line / Cashed out status banner at bottom
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = '#080410';
    ctx.fillRect(160, 492, 640, 38);
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 2;
    ctx.strokeRect(160, 492, 640, 38);

    ctx.fillStyle = lineCol;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(lineText, 480, 511);

    ctx.restore();
    ctx.restore();
  }

  return { draw };
}
