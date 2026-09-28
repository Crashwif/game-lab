/**
 * Composes Insider Wallets: the rally, the tracker and the HUD. Wallet
 * balances and the crowd follow the displayed multiplier. The dump is the
 * crash the server already committed.
 */
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
  if (multiplier < 1.9) return 'NUMBER GO UP';
  if (multiplier < 2.8) return "THE PEOPLE'S COIN";
  if (multiplier < 4.2) return 'HODL';
  if (multiplier < 6.5) return 'DIAMOND HANDS';
  if (multiplier < 10) return 'INSIDERS PENDING';
  if (multiplier < 16) return 'IS THAT A HELICOPTER';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const rally: Rally = createRally();
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

  function beginCrash(view: SceneView, drive: RallyDrive, quiet: boolean): void {
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    // A crash that already happened settles the rally to it rather than playing the milestones it missed.
    if (quiet) settleRally(rally, drive, secured !== null);
    dumpRally(rally, view.currentX100, quiet, reduced);
    if (quiet) pop.x = 1;
    else {
      shake = 1;
      pop.v = 16;
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = clamp(Math.log2(multiplier) / 3.3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
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
      }
      previous = view.phase;
    }
    // Not only while running: a cash-out first seen on the crash (the tab was hidden) still means you left.
    if (secured) leaveSeat(rally);

    stepRally(rally, drive, dt);
    if (rally.cannons > 0 && rally.bits.length > 40 && !reduced) shake = Math.max(shake, 0.08);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) {
      caption = next;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 90) * 7 * shake, Math.cos(time * 70) * 4 * shake);
    const shown = reduced ? 0 : time;
    drawRally(ctx, rally, multiplier, tension, shown, reduced);
    drawTracker(ctx, multiplier, tension, rally.crashed, rally.crashT, rally.leaving, shown);
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
