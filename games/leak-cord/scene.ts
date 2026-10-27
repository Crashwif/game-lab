/**
 * LeakCord Index — Scrub your cringe DMs before Googlebot indexes your entire past.
 */
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
  bgDark: '#1e1f22',
  channelBg: '#2b2d31',
  chatBg: '#313338',
  cardBg: '#232428',
  textMain: '#f2f3f5',
  textMuted: '#949ba4',
  discordBlurple: '#5865f2',
  dangerRed: '#f23f43',
  googleBlue: '#4285f4',
  googleYellow: '#fbbc05',
  googleGreen: '#34a853',
  safeGreen: '#23a55a',
  accentTeal: '#00ffff',
};

const MILESTONES: [x100: number, caption: string][] = [
  [120, 'Google spider crawls into the general channel'],
  [150, 'Cringe 2019 memes get cached on public servers'],
  [200, 'SEO bot indexes your broken voice clip dumps'],
  [250, 'Unfiltered gaming rage quotes appear on Page 2'],
  [300, 'Your gamer tag gets auto-completed on Google'],
  [500, 'School principal discovers your hidden server'],
  [1000, 'HR department pulls up your 3 AM copypastas'],
  [10000, 'Knowledge Graph panel creates your cringe bio'],
  [100000, 'Global trend: your fanfiction hits #1 search'],
  [1000000, 'The entire internet archives your soul forever'],
];

const CHAT_LOGS = [
  { user: 'xX_ShadowWolf_Xx', tag: '2017', msg: 'rawr x3 *nuzzles your server logs* pls no index' },
  { user: 'CoolKid420', tag: '2018', msg: 'guys is it bad if my mom finds my 40-page sonic fanfic' },
  { user: 'AnimeRageGod', tag: '2019', msg: 'I SWEAR ON MY CLAN I WILL BECOME HOKAGE IRL' },
  { user: 'MidnightLurker', tag: '2020', msg: 'voice clip: [screaming into mic at 3:14 AM]' },
  { user: 'SecretAgent00', tag: '2021', msg: 'DO NOT LEAK: Top secret middle school drama tier list' },
];

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function stakeLine(view: SceneView): [string, string] {
  const crashed = view.phase === 'crashed';
  if (view.cashoutX100 !== null) {
    return [`Account purged at ${formatX(view.cashoutX100)} · Logs incinerated into the void!`, COLOURS.safeGreen];
  }
  if (view.stake === null) {
    return [crashed ? 'Spectating · Search results scorched the logs' : 'Spectating · No logs on the line', COLOURS.textMuted];
  }
  if (crashed) {
    return [`Exposed! Your ${credits(view.stake)} & DMs leaked to public index`, COLOURS.dangerRed];
  }
  return [`Scrubbing active · ${credits(view.stake)} wagered to wipe identity`, COLOURS.accentTeal];
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'static' });

  let prevPhase: SceneView['phase'] | null = null;
  let prevCashout: number | null = null;
  let prevMilestone = 0;
  let lastClickTime = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const tension = clamp01(1 - 100 / view.currentX100);
    const depth = clamp01(Math.log10(Math.max(1, view.currentX100) / 100) / 3);

    audio.update(view.phase, tension);
    const milestoneCount = MILESTONES.filter(([x100]) => view.currentX100 >= x100).length;

    if (prevPhase !== null && running && view.cashoutX100 !== null && prevCashout === null) {
      audio.cashout();
      audio.fx('kaching', 0.8);
    }
    if (crashed && prevPhase !== 'crashed') {
      audio.crash('static', prevPhase === null || view.crashAge > 1500);
      audio.fx('siren', 0.9);
    }
    if (running && prevPhase === 'running') {
      if (milestoneCount > prevMilestone) {
        audio.milestone(milestoneCount);
        audio.fx('notify', 0.7);
      }
      if (now - lastClickTime > Math.max(120, 480 - tension * 360) && view.cashoutX100 === null) {
        audio.fx('click', 0.25 + 0.35 * tension);
        lastClickTime = now;
      }
    }

    prevPhase = view.phase;
    prevCashout = view.cashoutX100;
    prevMilestone = milestoneCount;

    const crashAgeSec = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const shake = crashed ? 14 * clamp01(1 - crashAgeSec / 0.6) ** 2 : 0;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    // 1. Background Shell (Discord-like desktop UI)
    ctx.fillStyle = COLOURS.bgDark;
    ctx.fillRect(0, 0, 960, 540);

    // Left channel sidebar
    ctx.fillStyle = COLOURS.channelBg;
    ctx.fillRect(0, 0, 230, 540);

    // Channel list header
    ctx.fillStyle = COLOURS.cardBg;
    ctx.fillRect(0, 0, 230, 54);
    ctx.fillStyle = COLOURS.textMain;
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LEAKCORD // ARCHIVE', 16, 32);

    // Channels
    const channels = ['# general-cringe', '# 2017-anime-rp', '# midnight-rants', '# unreleased-memes', '# secret-voicemails'];
    channels.forEach((ch, idx) => {
      const cy = 76 + idx * 38;
      const isBreached = idx < 2 + Math.floor(tension * 3);
      ctx.fillStyle = isBreached ? 'rgba(242, 63, 67, 0.15)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(10, cy - 20, 210, 32);

      ctx.fillStyle = isBreached ? COLOURS.dangerRed : COLOURS.textMuted;
      ctx.font = '600 13px ui-monospace, monospace';
      ctx.fillText(ch, 22, cy);

      if (isBreached && running) {
        ctx.fillStyle = COLOURS.googleYellow;
        ctx.font = '900 10px system-ui';
        ctx.fillText('INDEXED', 160, cy);
      }
    });

    // Web crawl status in sidebar
    ctx.fillStyle = '#18191c';
    ctx.fillRect(12, 380, 206, 140);
    ctx.fillStyle = COLOURS.discordBlurple;
    ctx.font = '700 12px system-ui';
    ctx.fillText('GOOGLEBOT STATUS', 24, 404);
    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(`CRAWL DEPTH: ${(depth * 100).toFixed(0)}%`, 24, 426);
    ctx.fillText(`PAGES FOUND: ${Math.floor(view.currentX100 * 42).toLocaleString()}`, 24, 444);
    ctx.fillText(`SEEK RATE: ${(1 + tension * 9).toFixed(1)} req/s`, 24, 462);

    const crawlBarW = 180 * tension;
    ctx.fillStyle = '#3a3c42';
    ctx.fillRect(24, 480, 180, 10);
    ctx.fillStyle = tension > 0.7 ? COLOURS.dangerRed : COLOURS.googleBlue;
    ctx.fillRect(24, 480, crawlBarW, 10);

    // Main Chat Window
    ctx.fillStyle = COLOURS.chatBg;
    ctx.fillRect(230, 0, 730, 540);

    // Chat header banner
    ctx.fillStyle = COLOURS.cardBg;
    ctx.fillRect(230, 0, 730, 54);
    ctx.fillStyle = COLOURS.textMuted;
    ctx.font = '600 14px system-ui';
    ctx.fillText('# 2017-anime-rp — Scrubbing in progress before cache sync', 252, 32);

    // Chat messages stream
    const scrollY = (view.elapsed * 0.05) % 80;
    CHAT_LOGS.forEach((log, i) => {
      const my = 76 + i * 58 - scrollY;
      if (my < 40 || my > 320) return;

      // User avatar badge
      ctx.fillStyle = i % 2 === 0 ? COLOURS.discordBlurple : '#eb459e';
      ctx.beginPath();
      ctx.arc(260, my + 10, 15, 0, Math.PI * 2);
      ctx.fill();

      // Username + timestamp
      ctx.fillStyle = COLOURS.textMain;
      ctx.font = '700 13px system-ui';
      ctx.fillText(log.user, 286, my + 6);
      ctx.fillStyle = COLOURS.textMuted;
      ctx.font = '11px system-ui';
      ctx.fillText(`08/14/${log.tag} 03:22 AM`, 410, my + 6);

      // Chat body
      ctx.fillStyle = '#dbdee1';
      ctx.font = '13px system-ui';
      ctx.fillText(log.msg, 286, my + 24);

      // Deletion stamp overlay when scrubbing
      if (running && (i + Math.floor(view.elapsed / 600)) % 3 === 0) {
        ctx.fillStyle = 'rgba(242, 63, 67, 0.85)';
        ctx.fillRect(660, my - 4, 110, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 11px ui-monospace, monospace';
        ctx.fillText('SCRUBBING...', 672, my + 11);
      }
    });

    // 2. Googlebot Spider Crawlers crawling across the screen
    const spiderCount = 2 + Math.floor(tension * 6);
    for (let s = 0; s < spiderCount; s++) {
      const sx = 290 + ((s * 110 + view.elapsed * (0.07 + s * 0.02)) % 620);
      const sy = 120 + ((s * 45 + Math.sin(view.elapsed * 0.004 + s) * 20) % 220);
      const legPhase = Math.sin(view.elapsed * 0.015 + s * 2);

      // Web filament dropping from ceiling
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, 54);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      // Spider legs
      ctx.strokeStyle = s % 2 === 0 ? COLOURS.googleBlue : COLOURS.dangerRed;
      ctx.lineWidth = 2;
      for (let leg = -1; leg <= 1; leg += 2) {
        for (let l = 0; l < 3; l++) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + leg * 14, sy - 6 + l * 6 + legPhase * 3);
          ctx.lineTo(sx + leg * 22, sy + 6 + l * 4 - legPhase * 2);
          ctx.stroke();
        }
      }

      // Spider robotic core
      ctx.fillStyle = '#111214';
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s % 4 === 0 ? COLOURS.googleBlue : s % 4 === 1 ? COLOURS.googleYellow : COLOURS.googleGreen;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Spider glowing eye
      ctx.fillStyle = COLOURS.dangerRed;
      ctx.beginPath();
      ctx.arc(sx + 2, sy - 1, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Protagonist Gamer (Sweating basement dweller clicking frantic delete)
    const px = 820;
    const py = 410;
    const sweatBob = Math.sin(view.elapsed * 0.018) * (2 + tension * 6);
    const clickArm = Math.sin(view.elapsed * 0.035) * 6;

    // Gamer chair back
    ctx.fillStyle = '#1a1a24';
    ctx.beginPath();
    ctx.roundRect(px - 45, py - 60, 90, 110, [20, 20, 5, 5]);
    ctx.fill();

    // Body / Hoodie
    ctx.fillStyle = '#2c2d3a';
    ctx.beginPath();
    ctx.arc(px, py + 20, 36, Math.PI, 0, false);
    ctx.fill();

    // Head
    ctx.fillStyle = '#ffdfbf';
    ctx.beginPath();
    ctx.arc(px, py - 30 + sweatBob, 26, 0, Math.PI * 2);
    ctx.fill();

    // Headset
    ctx.strokeStyle = '#5865f2';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(px, py - 34 + sweatBob, 28, Math.PI * 0.8, Math.PI * 0.2, true);
    ctx.stroke();
    // Earcups
    ctx.fillStyle = '#3ba55d';
    ctx.fillRect(px - 32, py - 40 + sweatBob, 8, 16);
    ctx.fillRect(px + 24, py - 40 + sweatBob, 8, 16);

    // Glowing Glasses (reflecting screen & danger)
    ctx.fillStyle = tension > 0.6 ? 'rgba(242, 63, 67, 0.9)' : 'rgba(88, 101, 242, 0.9)';
    ctx.fillRect(px - 20, py - 34 + sweatBob, 14, 10);
    ctx.fillRect(px + 6, py - 34 + sweatBob, 14, 10);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 20, py - 34 + sweatBob, 14, 10);
    ctx.strokeRect(px + 6, py - 34 + sweatBob, 14, 10);

    // Panicked mouth
    ctx.fillStyle = '#3a0007';
    ctx.beginPath();
    ctx.ellipse(px, py - 14 + sweatBob, 6 + tension * 4, 4 + tension * 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flying sweat droplets
    if (tension > 0.2) {
      ctx.fillStyle = '#79c5ff';
      const dropCount = Math.floor(tension * 5);
      for (let d = 0; d < dropCount; d++) {
        const dx = px - 26 - d * 6;
        const dy = py - 38 + ((view.elapsed * 0.2 + d * 20) % 36);
        ctx.beginPath();
        ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Frantic mouse arm
    ctx.strokeStyle = '#ffdfbf';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - 10, py + 16);
    ctx.lineTo(px - 40, py + 26 + clickArm);
    ctx.stroke();
    // Mouse + Click sparks
    ctx.fillStyle = '#111214';
    ctx.fillRect(px - 54, py + 24, 20, 12);
    if (Math.sin(view.elapsed * 0.04) > 0.4) {
      ctx.fillStyle = COLOURS.accentTeal;
      ctx.fillRect(px - 58, py + 18, 5, 5);
      ctx.fillRect(px - 48, py + 16, 4, 4);
    }

    // 4. Center HUD / Multiplier Engine
    const hudX = 540;
    const hudY = 320;
    ctx.textAlign = 'center';

    // Giant multiplier glow box
    ctx.fillStyle = 'rgba(17, 18, 20, 0.88)';
    ctx.beginPath();
    ctx.roundRect(hudX - 250, hudY - 50, 500, 105, 16);
    ctx.fill();
    ctx.strokeStyle = crashed ? COLOURS.dangerRed : view.cashoutX100 !== null ? COLOURS.safeGreen : COLOURS.discordBlurple;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Multiplier Text
    ctx.fillStyle = crashed ? COLOURS.dangerRed : view.cashoutX100 !== null ? COLOURS.safeGreen : '#ffffff';
    ctx.font = '900 68px ui-monospace, monospace';
    ctx.fillText(formatX(view.currentX100), hudX, hudY + 22);

    // Subtitle / Milestone banner
    const currentMilestone = MILESTONES[milestoneCount - 1];
    ctx.fillStyle = COLOURS.googleYellow;
    ctx.font = '700 15px system-ui, sans-serif';
    const milestoneText = currentMilestone ? currentMilestone[1] : 'SCRUBBING OLD CHAT SERVERS...';
    ctx.fillText(milestoneText.toUpperCase(), hudX, hudY + 44);

    // Stake line
    const [lineText, lineCol] = stakeLine(view);
    ctx.fillStyle = lineCol;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(lineText, hudX, hudY + 92);

    // 5. Cashed out Overlay ("ACCOUNT DELETED - ANONYMITY PRESERVED")
    if (view.cashoutX100 !== null) {
      ctx.fillStyle = 'rgba(10, 35, 20, 0.75)';
      ctx.fillRect(230, 54, 730, 240);

      ctx.save();
      ctx.translate(595, 170);
      ctx.rotate(-0.06);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = COLOURS.safeGreen;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(-220, -50, 440, 100, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLOURS.safeGreen;
      ctx.font = '900 28px ui-monospace, monospace';
      ctx.fillText('[ ACCOUNT PURGED ]', 0, -10);
      ctx.font = '700 15px system-ui';
      ctx.fillStyle = '#d2f9e1';
      ctx.fillText(`Secured at ${formatX(view.cashoutX100)} · Zero search traces remain!`, 0, 24);
      ctx.restore();
    }

    // 6. Crash Overlay: Massive Google Search Results exposing you
    if (crashed) {
      const settle = clamp01(crashAgeSec / 0.3);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.94 * settle})`;
      ctx.fillRect(240, 60, 700, 235);

      // Google logo mini
      ctx.textAlign = 'left';
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.fillStyle = COLOURS.googleBlue;
      ctx.fillText('G', 260, 95);
      ctx.fillStyle = COLOURS.dangerRed;
      ctx.fillText('o', 278, 95);
      ctx.fillStyle = COLOURS.googleYellow;
      ctx.fillText('o', 292, 95);
      ctx.fillStyle = COLOURS.googleBlue;
      ctx.fillText('g', 306, 95);
      ctx.fillStyle = COLOURS.googleGreen;
      ctx.fillText('l', 320, 95);
      ctx.fillStyle = COLOURS.dangerRed;
      ctx.fillText('e', 326, 95);

      // Fake search box
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#dfe1e5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(350, 75, 480, 32, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#202124';
      ctx.font = '13px system-ui';
      ctx.fillText('"xX_ShadowWolf_Xx middle school diary leaked"', 370, 96);

      // Search stats line
      ctx.fillStyle = '#70757a';
      ctx.font = '11px system-ui';
      ctx.fillText('About 4,820,000 results (0.12 seconds) — Sent to Parents & Principal', 260, 126);

      // Search Result 1
      ctx.fillStyle = '#1a0dab';
      ctx.font = '600 16px system-ui';
      ctx.fillText('Middle School Roleplay Archive: "Rawr x3" Logs Uncovered', 260, 154);
      ctx.fillStyle = '#006621';
      ctx.font = '12px system-ui';
      ctx.fillText('https://leakcord-dms.public.net/cringe/2017-roleplay', 260, 172);
      ctx.fillStyle = '#4d5156';
      ctx.font = '13px system-ui';
      ctx.fillText('Full unredacted transcripts found. Family group chat alerted with screenshots...', 260, 192);

      // Search Result 2
      ctx.fillStyle = '#1a0dab';
      ctx.font = '600 15px system-ui';
      ctx.fillText('Urgent Mom Notification: "We need to talk about your Discord..."', 260, 222);
      ctx.fillStyle = '#4d5156';
      ctx.font = '12px system-ui';
      ctx.fillText('Received 1 second ago · All unscrubbed logs permanently indexed on page one.', 260, 242);
    }

    ctx.restore();
  }

  return { draw };
}
