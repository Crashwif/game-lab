import { actAt, drawAct } from './acts';
import { createPortrait } from './portrait';
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
  formatFollowers,
  postComment,
  resetOverlay,
  settleOverlay,
  stepOverlay,
  unfollow,
  type Overlay,
} from './overlay';
import { VIDEO_H, VIDEO_W, PRODUCTS, createStudio, drawStudio, endStudio, resetStudio, screenshot, settleStudio, stepStudio, type Studio } from './studio';

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
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
/** The caption ladder's steps: a milestone ding each, an airhorn from the third, and a sponsor read at every one. */
const RUNGS = [1.35, 1.8, 2.6, 4, 6, 9, 14, 22];
/** The reveal: the frame freezes on SOLD (the record scratch), drained of colour, the cloth starts to fall at a third speed, then time catches up. */
const FREEZE_S = 0.16;
const SLOW_S = 0.3;
const SLOW_RATE = 0.3;
/** The camera punches in 12% on the impact and holds there before easing back out. */
const PUNCH_HOLD_S = 0.45;
const PUNCH_ZOOM = 0.12;
/** Where the camera punches in: between the wallet and the man about to be exposed. */
const PUNCH_AT = { x: 226, y: 262 } as const;
/** A watched cash-out: the screenshot and the chat's verdict read before the video minimises. */
const MINIMISE_AFTER_S = 0.7;
/** After you unfollow, the caption follows how far he has pumped past your exit: a jeet, but a jeet in profit. */
const REGRET: [number, string][] = [[1.25, 'UNFOLLOWED'], [1.6, 'TOOK PROFITS. TOUCHING GRASS'], [2.2, 'HE IS STILL SHILLING'], [3.2, 'CHAT CALLS YOU A JEET'], [5, 'A PROFIT IS A PROFIT'], [Infinity, 'STILL NOT FINANCIAL ADVICE']];

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
  if (outcome === 'called') return 'DODGED THE RUG';
  if (outcome && multiplier < 1.01) return 'RUGGED BEFORE THE INTRO';
  if (outcome === 'rekt') return 'RUGGED';
  if (outcome === 'spectator') return 'HE WAS THE DEV';
  if (view.phase !== 'running') return 'LIKE AND SUBSCRIBE';
  if (secured) return REGRET.find(([below]) => view.currentX100 / secured.x100 < below)![1];
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
  // Below the caption, so the cash-out copy never lands on an icon.
  const icons = ['rug.xlsx', 'rental.pdf', 'do-not-open.png', 'script.txt'];
  icons.forEach((name, i) => {
    const x = 34 + i * 112;
    ctx.fillStyle = '#d5fb6d';
    ctx.fillRect(x, 96, 36, 44);
    ctx.fillStyle = '#e7eef8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, x + 18, 156);
  });
}

export function createScene(): Scene {
  const { capture, present } = createPortrait("NOT FINANCIAL ADVICE", [15, 200, 395, 320], '#f0d99c');

  // Trap for the shill, and the crash is the record scratch of the reveal.
  const audio = pageAudio({ style: 'trap', crash: 'scratch' });
  const studio: Studio = createStudio();
  const overlay: Overlay = createOverlay();
  const win = spring(0);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the reveal, and how long it holds there. */
  const punch = spring(0);
  let punchHold = 0;
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
  /** Seconds since a cash-out this scene watched (-1 with none): the video minimises once its beat has read. */
  let exitAge = -1;
  /** The act props' presence: they fade out over the crash or a cash-out instead of vanishing. */
  let actFade = 0;
  /** Time since the last tension pulse. */
  let pulseClock = 0;

  /** Jumps the props to the multiplier, for a stretch of the round this scene did not draw. */
  function settle(multiplier: number, tension: number, running: boolean): void {
    settleStudio(studio, tension, RUNGS.filter((r) => multiplier >= r).length, running);
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
      freeze = FREEZE_S;
      slow = SLOW_S;
      punchHold = PUNCH_HOLD_S;
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
    // The freeze drains the colour, which comes back through the slow motion.
    const desat = freeze > 0 ? 1 : slow > 0 ? slow / SLOW_S : 0;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const act = actAt(view.elapsed);
    // 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×, 0.9 at 10×: the window nearly every round lives in escalates. The log
    // driver keeps opening the set through very long rounds after the tension has saturated.
    const tension = clamp(1 - 1 / multiplier, 0, 1);
    const long = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    // A cash-out this scene did not watch land (it opened after it, or the tab was hidden through the rest of
    // the run) is shown as done: the video already minimised, the badge up and your subscriber gone.
    const cashedOffScreen = secured === null && view.cashoutX100 !== null && (fresh || !running);
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (!cashedOffScreen) {
        // Your subscriber's screenshot, then the register and the chat's verdict: the exit, watched.
        screenshot(studio);
        audio.fx('camera', 1);
        audio.cashout();
        postComment(overlay, 'you unfollowed · jeet 🧻');
        exitAge = 0;
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
      settle(multiplier, tension, running);
      actFade = running && view.cashoutX100 === null ? 1 : 0;
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !studio.crashed) {
        // A crash first drawn well after it happened (the tab was hidden) opens on its aftermath, props caught up.
        const quiet = view.crashAge > 1500;
        if (quiet) settle(multiplier, tension, false);
        beginCrash(view, quiet);
      }
      if (view.phase === 'betting') {
        // A new take fades up from black; a minimised video springs back to full size rather than jumping.
        resetStudio(studio);
        resetOverlay(overlay);
        outcome = null;
        secured = null;
        shake = 0;
        freeze = slow = 0;
        punchHold = 0;
        booIn = -1;
        exitAge = -1;
        muted = false;
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    // An accepted cashout starts the subscriber’s walk to the grass.
    if (secured && running && !overlay.leaving) unfollow(overlay, false);

    const shownTime = time;
    const reads = RUNGS.filter((r) => multiplier >= r).length;
    stepStudio(studio, { running, tension, reads, elapsed: view.elapsed / 1000, long }, dt);
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
    if (running && !secured && !muted && !fresh) {
      // A heartbeat under the stream that quickens with the tension, until you are out.
      pulseClock += dt;
      if (pulseClock >= mix(1.4, 0.35, tension)) {
        pulseClock = 0;
        audio.fx('heartbeat', 0.25 + 0.3 * tension);
      }
    } else pulseClock = 0;
    discPx = overlay.discSize;
    if (booIn >= 0) {
      booIn -= real;
      if (booIn < 0) audio.fx('boo', 1);
    }
    if (exitAge >= 0) exitAge += real;
    stepSpring(win, secured && (exitAge < 0 || exitAge > MINIMISE_AFTER_S) ? 1 : 0, 7, 0.8, dt);
    if (!minimised && secured && win.x > 0.5) {
      minimised = true;
      if (!muted) audio.fx('whoosh', 0.8);
    } else if (minimised && !secured && win.x < 0.5) minimised = false;
    actFade += ((running && view.cashoutX100 === null ? 1 : 0) - actFade) * (1 - Math.exp(-dt * 5));
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    // The camera lives outside the slowed world: it snaps in on real time, holds, then eases back.
    if (punchHold > 0) punchHold -= real;
    stepSpring(punch, punchHold > 0 ? 1 : 0, punchHold > 0 ? 28 : 7, punchHold > 0 ? 0.8 : 0.9, real);
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
    if (shake > 0) ctx.translate(Math.sin(time * 80) * 7 * shake, Math.cos(time * 60) * 4 * shake);
    if (punch.x > 0.005) {
      // The camera punches in on the reveal and eases back out.
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
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
    // The act props belong to the set, so they stay inside the video.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIDEO_W, VIDEO_H);
    ctx.clip();
    drawAct(ctx, act, actFade);
    ctx.restore();
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
    ctx.globalAlpha = 1;
    ctx.save();
    // Your row stays up while you walk out: it is yours, not the video's.
    ctx.translate(20, 414);
    drawSubscriber(ctx, overlay, view.stake === null);
    ctx.restore();

    if (outcome && pop.x > 0.02) {
      ctx.save();
      // Above the sponsor card and below the chyron, so the reveal's word and its sponsor both read; after a
      // cash-out it rides the window down and is stamped on the minimised window you got out of.
      const mini = clamp(win.x, 0, 1);
      ctx.translate(mix(280, 128, mini), mix(170, 352, mini));
      ctx.rotate(-0.06);
      const k = clamp(pop.x, 0, 1.2);
      ctx.scale(k, k);
      const word = outcome === 'called' ? 'DYOR' : outcome === 'rekt' ? 'RUGGED' : 'DEV SOLD';
      memeText(ctx, word, 0, 0, mix(76, 46, mini), outcome === 'rekt' ? '#ff4d6d' : outcome === 'called' ? '#7cf67c' : '#ffe27a', 'center', 360);
      ctx.restore();
    }
    if (desat > 0.01) {
      // The freeze frame drains to grey and the colour returns through the slow motion.
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = desat;
      ctx.fillStyle = '#808080';
      ctx.fillRect(-100, -100, 1160, 740);
      ctx.restore();
    }
    ctx.restore();

    capture(ctx);
    if (caption) {
      // Centred over the video and kept clear of the multiplier however long it grows.
      ctx.save();
      ctx.translate(315, 48);
      ctx.scale(1 + 0.06 * captionPop.x, 1 + 0.06 * captionPop.x);
      memeText(ctx, caption, 0, 0, 28, '#ffffff', 'center', 570);
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
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 48, 42, colour, 'right', 290);
    const followers = overlay.follower.x;
    memeText(ctx, `${followers < 1e9 ? Math.round(followers).toLocaleString('en-US') : formatFollowers(followers)} followers`, 20, 528, 18, '#c9d4e4', 'left');
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, studio.read.hold.x > .15 ? 'CURRENT SPONSOR' : 'CURRENT COMMENT', studio.read.hold.x > .15 && studio.read.index >= 0 ? PRODUCTS[studio.read.index]!.name : overlay.comments.at(-1)?.text ?? 'The disclosure is getting smaller.');

  }

  return { draw };
}
