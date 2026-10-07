/**
 * Composes Not Financial Advice: the video, the chrome, the desktop it
 * minimises onto, and the HUD. Nothing drawn here changes the outcome.
 */
import { pageAudio } from './audio';
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
import { VIDEO_H, VIDEO_W, createStudio, drawStudio, endStudio, resetStudio, screenshot, settleStudio, stepStudio, type Studio } from './studio';

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
  /** Drops the screen shake, the freeze frame and the punch-in; the tow-light strobe stays on one colour. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
/** The caption ladder's steps: a milestone ding each, an airhorn from the third, and a sponsor read at every one. */
const RUNGS = [1.35, 1.8, 2.6, 4, 6, 9, 14, 22];
/** The reveal: the frame freezes on SOLD (the record scratch), the cloth starts to fall at a third speed, then time catches up. */
const FREEZE_S = 0.09;
const SLOW_S = 0.3;
const SLOW_RATE = 0.3;
/** Where the camera punches in: between the wallet and the man about to be exposed. */
const PUNCH_AT = { x: 210, y: 250 } as const;

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

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THIS STREAM HAS MORE SPONSORS", "BONUS DISCLOSURE INCOMING", "THE RENTAL METER IS RUNNING", "ANOTHER WORD FROM OUR SPONSOR", "THE COUSIN IS STILL TYPING", "LIKE, SUBSCRIBE, REPEAT", "THE GREEN SCREEN NEEDS A BREAK", "THE LAWYER LEFT THE STREAM"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'rekt') return 'RUGGED';
  if (outcome === 'called') return 'DYOR';
  if (outcome === 'spectator') return 'HE WAS THE DEV';
  if (view.phase !== 'running') return 'LIKE AND SUBSCRIBE';
  if (secured) return 'UNFOLLOWED';
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
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
  // Trap for the shill, and the crash is the record scratch of the reveal.
  const audio = pageAudio({ style: 'trap', crash: 'scratch' });
  const studio: Studio = createStudio();
  const overlay: Overlay = createOverlay();
  const win = spring(0);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the reveal. */
  const punch = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let freeze = 0;
  let slow = 0;
  /** Seconds until the chat turns on him; -1 with no boo due. */
  let booIn = -1;
  let minimised = false;
  let discPx = 16;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues play for it. */
  let muted = false;

  /** Jumps the props to the multiplier, for a stretch of the round this scene did not draw. */
  function settle(multiplier: number, tension: number): void {
    settleStudio(studio, tension, RUNGS.filter((r) => multiplier >= r).length);
    settleOverlay(overlay, multiplier);
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    endStudio(studio, quiet);
    floodOverlay(overlay, quiet);
    if (quiet) {
      pop.x = 1;
      muted = true;
      audio.crash('scratch', true);
      return;
    }
    shake = 1;
    pop.v = 14;
    if (!secured) {
      // The full reveal, watched: the freeze on SOLD, the cloth in slow motion, the camera in on his face.
      punch.v = 8;
      if (!reduced) {
        freeze = FREEZE_S;
        slow = SLOW_S;
      }
    }
    booIn = 0.7;
    audio.crash('scratch');
    audio.fx('engine', 0.8);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The freeze frame holds the picture, then the cloth falls slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = clamp(Math.log2(multiplier) / 3.4, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    // A cash-out this scene did not watch land (it opened after it, or the tab was hidden through the rest of
    // the run) is shown as done: the video already minimised, the badge up and your subscriber gone.
    const cashedOffScreen = secured === null && view.cashoutX100 !== null && (fresh || !running);
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (!cashedOffScreen) {
        // Your subscriber's screenshot, then the register: the exit, watched.
        screenshot(studio);
        audio.fx('camera', 1);
        audio.cashout();
      }
    }
    if (cashedOffScreen) {
      settleSpring(win, 1);
      settleSpring(badge, 1);
      unfollow(overlay, true);
      minimised = true;
    }

    if (fresh) {
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
        freeze = slow = 0;
        booIn = -1;
        minimised = false;
        muted = false;
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    if (secured && running && !overlay.leaving) unfollow(overlay);

    const shownTime = reduced ? 0 : time;
    const reads = RUNGS.filter((r) => multiplier >= r).length;
    stepStudio(studio, { running, tension, time: shownTime, reads }, dt);
    stepOverlay(overlay, { running, multiplier, tension }, dt);
    if (!fresh && !muted) {
      // The set's own events as cues: a sell queued, the read, the truck, its reversing, the disclosure's next step down.
      const ev = studio.events;
      if (ev.pending) audio.fx('notify', 0.7);
      if (ev.read) audio.fx('kaching', 0.6);
      if (ev.truck) audio.fx('engine', 0.7);
      if (ev.beep) audio.fx('beep', 0.7);
      if (running && overlay.discSize < discPx) audio.fx('tick', 0.6);
      if (running) audio.milestone(reads);
    }
    discPx = overlay.discSize;
    if (booIn >= 0) {
      booIn -= real;
      if (booIn < 0) audio.fx('boo', 1);
    }
    stepSpring(win, secured ? 1 : 0, 7, 0.8, dt);
    if (!minimised && win.x > 0.5) {
      minimised = true;
      if (!muted) audio.fx('whoosh', 0.8);
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 9, 0.5, dt);
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
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the reveal and eases back out.
      const k = 1 + 0.06 * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
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
      // Above the sponsor card and below the chyron, so the reveal's word and its sponsor both read.
      ctx.translate(280, 170);
      ctx.rotate(-0.06);
      const k = clamp(pop.x, 0, 1.2);
      ctx.scale(k, k);
      const word = outcome === 'called' ? 'DYOR' : outcome === 'rekt' ? 'RUGGED' : 'DEV SOLD';
      memeText(ctx, word, 0, 0, 76, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center', 360);
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
