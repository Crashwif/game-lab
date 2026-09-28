/**
 * Composes Not Financial Advice: the video, the chrome, the desktop it
 * minimises onto, and the HUD. Nothing drawn here changes the outcome.
 */
import { clamp, mix, settleSpring, spring, stepSpring } from './motion';
import {
  createOverlay,
  drawBurn,
  drawComments,
  drawSubscriber,
  floodOverlay,
  resetOverlay,
  settleOverlay,
  stepOverlay,
  unfollow,
  type Overlay,
} from './overlay';
import { VIDEO_H, VIDEO_W, createStudio, drawStudio, endStudio, resetStudio, settleStudio, stepStudio, type Studio } from './studio';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake and the tow-light strobe stays on one colour. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = '#1c1f26';
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'rekt') return 'RUGGED';
  if (outcome === 'called') return 'DYOR';
  if (outcome === 'spectator') return 'HE WAS THE DEV';
  if (view.phase !== 'running') return 'LIKE AND SUBSCRIBE';
  if (secured) return 'UNFOLLOWED';
  if (multiplier < 1.35) return 'NOT FINANCIAL ADVICE';
  if (multiplier < 1.8) return "I'M NOT SELLING (YET)";
  if (multiplier < 2.6) return '1000X GEM';
  if (multiplier < 4) return 'THE DEV IS MY COUSIN';
  if (multiplier < 6) return 'USE MY CODE';
  if (multiplier < 9) return 'THANKS FOR THE LIQUIDITY';
  if (multiplier < 14) return 'JUST GOT OFF A CALL WITH THE DEV';
  if (multiplier < 22) return 'WHY IS THE LAMBO BEEPING';
  return 'MY LAWYER SAYS THIS WAS SATIRE';
}

function drawDesktop(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#16324a');
  sky.addColorStop(1, '#0c1016');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  const icons = ['rug.xlsx', 'rental.pdf', 'do-not-open.png', 'script.txt'];
  icons.forEach((name, i) => {
    const x = 24 + i * 92;
    ctx.fillStyle = '#d5fb6d';
    ctx.fillRect(x, 24, 36, 44);
    ctx.fillStyle = '#e7eef8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(name, x - 4, 84);
  });
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const studio: Studio = createStudio();
  const overlay: Overlay = createOverlay();
  const win = spring(0);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';

  /** Jumps the props to the multiplier, for a stretch of the round this scene did not draw. */
  function settle(multiplier: number, tension: number): void {
    settleStudio(studio, tension);
    settleOverlay(overlay, multiplier);
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    endStudio(studio, quiet);
    floodOverlay(overlay, quiet);
    if (quiet) pop.x = 1;
    else {
      shake = 1;
      pop.v = 14;
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = clamp(Math.log2(multiplier) / 3.4, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    // A cash-out this scene did not watch land (it opened after it, or the tab was hidden through the rest of
    // the run) is shown as done: the video already minimised, the badge up and your subscriber gone.
    const cashedOffScreen = secured === null && view.cashoutX100 !== null && (previous === null || !running);
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
    if (cashedOffScreen) {
      settleSpring(win, 1);
      settleSpring(badge, 1);
      unfollow(overlay, true);
    }

    if (previous === null) {
      // A fresh scene can open on any phase (the shell makes one for a round it first meets after betting), so
      // the props start where the multiplier has them and a crash opens on its aftermath.
      previous = view.phase;
      settle(multiplier, tension);
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !studio.crashed) {
        // A crash first drawn well after it happened (the tab was hidden) opens on its aftermath, props caught up.
        const quiet = view.crashAge > 1500;
        if (quiet) settle(multiplier, tension);
        beginCrash(view, quiet);
      }
      if (view.phase === 'betting') {
        resetStudio(studio);
        resetOverlay(overlay);
        win.x = 0;
        win.v = 0;
        outcome = null;
        secured = null;
        shake = 0;
      }
      previous = view.phase;
    }
    if (secured && running && !overlay.leaving) unfollow(overlay);

    const shownTime = reduced ? 0 : time;
    stepStudio(studio, { running, tension, time: shownTime }, dt);
    stepOverlay(overlay, { running, multiplier, tension }, dt);
    stepSpring(win, secured ? 1 : 0, 7, 0.8, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) {
      caption = next;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    if (win.x > 0.02) drawDesktop(ctx);
    else {
      ctx.fillStyle = '#0e1014';
      ctx.fillRect(0, 0, 960, 540);
    }

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 80) * 7 * shake, Math.cos(time * 60) * 4 * shake);
    const scale = mix(1, 0.34, win.x);
    const vx = mix(20, 28, win.x);
    const vy = mix(72, 300, win.x);
    ctx.save();
    ctx.translate(vx, vy);
    ctx.scale(scale, scale);
    if (win.x > 0.4) {
      ctx.fillStyle = '#2a3038';
      ctx.fillRect(0, -22, VIDEO_W, 22);
      ctx.fillStyle = '#d7dde6';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('not-financial-advice.mp4', 8, -6);
    }
    drawStudio(ctx, studio, tension, shownTime);
    drawBurn(ctx, overlay, multiplier, tension, shownTime);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, VIDEO_W, VIDEO_H);
    ctx.restore();

    ctx.save();
    ctx.translate(630, 72);
    ctx.globalAlpha = 1 - win.x;
    if (win.x < 0.98) drawComments(ctx, overlay);
    ctx.restore();
    ctx.globalAlpha = 1 - win.x * 0.85;
    ctx.save();
    ctx.translate(20, 414);
    drawSubscriber(ctx, overlay);
    ctx.restore();
    ctx.globalAlpha = 1;

    if (outcome && pop.x > 0.02 && win.x < 0.65) {
      ctx.save();
      ctx.translate(310, 250);
      ctx.rotate(-0.06);
      const k = clamp(pop.x, 0, 1.2);
      ctx.scale(k, k);
      const word = outcome === 'called' ? 'DYOR' : outcome === 'rekt' ? 'RUGGED' : 'DEV SOLD';
      memeText(ctx, word, 0, 0, 84, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    if (caption) {
      ctx.save();
      ctx.translate(400, 48);
      ctx.scale(1 + 0.06 * captionPop.x, 1 + 0.06 * captionPop.x);
      memeText(ctx, caption, 0, 0, 28, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(400, 492);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(ctx, text, 0, 0, 22, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'spectator' ? '#ff4d6d' : '#ffffff';
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 48, 42, colour, 'right');
    memeText(ctx, `${Math.round(overlay.follower.x).toLocaleString('en-US')} followers`, 20, 528, 18, '#c9d4e4', 'left');
  }

  return { draw };
}
