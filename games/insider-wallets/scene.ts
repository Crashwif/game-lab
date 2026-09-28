/**
 * Composes Insider Wallets: the rally, the tracker, the HUD and the sound.
 * Wallet balances and the crowd follow the displayed multiplier. The dump is
 * the crash the server already committed; here it plays as a hit-stop, a
 * slow-motion yank and a camera punch into the podium.
 */
import { pageAudio } from './audio';
import { cannonCount, createRally, drawRally, dumpRally, leaveSeat, resetRally, settleRally, stepRally, type Rally, type RallyDrive } from './rally';
import { clamp, spring, stepSpring } from './motion';
import { drawTracker, totalBalance } from './tracker';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions { reducedMotion?: boolean; }
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void; }

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };

/** The caption ladder's rungs, for the milestone stingers. */
const RUNGS = [1.35, 1.9, 2.8, 4.2, 6.5, 10, 16];
/** The hit-stop on the crash frame, then the slow motion the yank starts in. */
const FREEZE_S = 0.07;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
/** Where the camera punches in: the podium. */
const IMPACT = { x: 430, y: 300 };

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

function money(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'rekt') return 'INSIDERS SOLD';
  if (outcome === 'called') return 'LEFT EARLY';
  if (outcome === 'spectator') return 'RUGGED';
  if (view.phase !== 'running') return 'GM PATRIOTS';
  if (secured) return 'LEFT EARLY';
  if (multiplier < 1.35) return 'MAKE BAGS GREAT AGAIN';
  if (multiplier < 1.9) return 'FOR THE UNBANKED';
  if (multiplier < 2.8) return "THE PEOPLE'S COIN";
  if (multiplier < 4.2) return 'COUSIN BOUGHT EARLY';
  if (multiplier < 6.5) return 'NOT INSIDER TRADING';
  if (multiplier < 10) return 'INSIDERS PENDING';
  if (multiplier < 16) return 'IS THAT A HELICOPTER';
  return 'THE HELICOPTER IS RUNNING';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // Casino music for a coin launch: the podium is a craps table. The crash turns the crowd.
  const audio = pageAudio({ style: 'casino', crash: 'crowd' });
  const rally: Rally = createRally();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the podium. */
  const punch = spring(0);
  /** The green wash of your cash-out. */
  const flash = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let freeze = 0;
  let slow = 0;

  function beginCrash(view: SceneView, drive: RallyDrive, quiet: boolean): void {
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    // A crash that already happened settles the rally to it rather than playing the milestones it missed.
    if (quiet) settleRally(rally, drive, secured !== null);
    dumpRally(rally, view.currentX100, quiet, reduced);
    if (quiet) {
      pop.x = 1;
      audio.crash('crowd', true);
      return;
    }
    shake = 1;
    pop.v = 16;
    punch.v = 8;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    // Every insider's register rings in the frame the rows flash SOLD; the crowd turns.
    audio.crash('crowd');
    audio.fx('kaching', 1);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the SOLD frame, then the yank starts in slow motion before time catches up.
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
    const tension = clamp(Math.log2(multiplier) / 3.3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) {
        audio.cashout();
        audio.fx('door', 0.6);
        flash.v = 14;
      }
    }
    const drive: RallyDrive = { running, multiplier, tension, reduced };

    if (previous === null) {
      // A fresh scene can open mid-round or on the crash (a page that joins late, or a tab that missed the
      // betting window): it settles into the round as it stands rather than replaying what it never saw.
      previous = view.phase;
      if (crashed) beginCrash(view, drive, true);
      else settleRally(rally, drive, secured !== null);
    } else if (view.phase !== previous) {
      if (crashed && !rally.crashed) beginCrash(view, drive, view.crashAge > 1500);
      if (view.phase === 'betting') {
        resetRally(rally);
        outcome = null;
        secured = null;
        shake = 0;
        freeze = slow = 0;
      }
      previous = view.phase;
    }
    // Not only while running: a cash-out first seen on the crash (the tab was hidden) still means you left.
    if (secured) leaveSeat(rally, reduced);
    audio.update(view.phase, tension);

    stepRally(rally, drive, dt);
    const events = rally.events;
    if (running && events.cannon) {
      audio.fx('pop', 1.2);
      audio.fx('cheer', 0.35);
    }
    if (events.flash) audio.fx('camera', 0.3 + 0.4 * tension);
    if (events.heli) audio.fx('engine', 0.8);
    if (events.lift) {
      audio.fx('engine', 1);
      audio.fx('scream', 0.5);
    }
    if (events.podium) audio.fx('thud', 1);
    if (running) audio.milestone(RUNGS.filter((rung) => multiplier >= rung).length);
    if (rally.cannons > 0 && rally.bits.length > 40 && !reduced) shake = Math.max(shake, 0.08);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 9, 0.5, dt);
    stepSpring(flash, 0, 6, 1, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) {
      caption = next;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 90) * 7 * shake, Math.cos(time * 70) * 4 * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the podium and eases back out.
      const k = 1 + 0.06 * clamp(punch.x, 0, 1.2);
      ctx.translate(IMPACT.x, IMPACT.y);
      ctx.scale(k, k);
      ctx.translate(-IMPACT.x, -IMPACT.y);
    }
    const shown = reduced ? 0 : time;
    drawRally(ctx, rally, multiplier, tension, shown, reduced);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(400, 340);
      ctx.rotate(-0.06);
      const scale = clamp(pop.x, 0, 1.2);
      ctx.scale(scale, scale);
      const word = outcome === 'called' ? 'LEFT EARLY' : outcome === 'rekt' ? 'INSIDERS SOLD' : 'RUGGED';
      memeText(ctx, word, 0, 0, 64, outcome === 'called' ? '#7cf67c' : '#ff4d6d', 'center', 560);
      ctx.restore();
    }
    ctx.restore();
    // The tracker shakes with the stage but sits outside the punch-in, so its edge never leaves the picture.
    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 90) * 7 * shake, Math.cos(time * 70) * 4 * shake);
    drawTracker(ctx, multiplier, tension, rally.crashed, rally.crashT, rally.leaving, shown);
    ctx.restore();
    if (flash.x > 0.01) {
      ctx.fillStyle = `rgba(124, 246, 124, ${0.3 * clamp(flash.x, 0, 1)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    if (caption) {
      ctx.save();
      ctx.translate(400, 52);
      ctx.scale(1 + 0.07 * captionPop.x, 1 + 0.07 * captionPop.x);
      memeText(ctx, caption, 0, 0, 32, '#ffffff', 'center', 520);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(400, 512);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(ctx, text, 0, 0, 22, '#7cf67c', 'center');
      ctx.restore();
    }
    memeText(ctx, `${multiplier.toFixed(2)}×`, 20, 52, 36, outcome === 'rekt' || outcome === 'spectator' ? '#ff4d6d' : '#ffffff', 'left');
    memeText(ctx, `CANNONS ${cannonCount(rally)}`, 20, 524, 20, '#f0c14a', 'left');
    memeText(ctx, rally.crashed ? 'RUGGED' : money(totalBalance(multiplier)), 660, 524, 18, rally.crashed ? '#ffb4c2' : '#f0c14a', 'right');
  }

  return { draw };
}
