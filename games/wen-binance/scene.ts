/**
 * Composes Wen Binance. The queue, the marquee and the doors follow the
 * displayed multiplier. Sell-the-news is the committed crash.
 */
import { callTaxi, createClub, drawClub, openClub, resetClub, stepClub, type Club } from './club';
import { clamp, spring, stepSpring } from './motion';
import { createQueue, drawQueue, leaveQueue, resetQueue, sellNews, stepQueue, suitCount, type Queue } from './queue';

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

const FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };

function meme(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${FONT}`;
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
  if (outcome === 'rekt') return 'SELL THE NEWS';
  if (outcome === 'called') return 'LEFT THE QUEUE';
  if (outcome === 'spectator') return 'DELISTED';
  if (view.phase !== 'running') return 'GM DEGENS';
  if (secured) return 'LEFT THE QUEUE';
  if (multiplier < 1.5) return 'WEN LISTING';
  if (multiplier < 2.4) return 'NUMBER GO UP';
  if (multiplier < 4) return 'HODL';
  if (multiplier < 7) return 'DIAMOND HANDS';
  if (multiplier < 11) return 'BOUNCER IS CHECKING';
  if (multiplier < 16) return 'THE SUITS ARE LEAVING';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const club: Club = createClub();
  const queue: Queue = createQueue();
  const pop = spring(0);
  const badge = spring(0);
  const capPop = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';

  function beginCrash(view: SceneView, quiet: boolean): void {
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    openClub(club, quiet);
    sellNews(queue, quiet);
    if (quiet) pop.x = 1;
    else { shake = 1; pop.v = 12; }
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
    if (previous === null) {
      previous = view.phase;
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !club.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        resetClub(club);
        resetQueue(queue);
        outcome = null;
        secured = null;
        shake = 0;
      }
      previous = view.phase;
    }
    if (secured && running && !club.crashed) {
      leaveQueue(queue);
      callTaxi(club);
    }
    stepClub(club, tension, dt);
    stepQueue(queue, multiplier, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) { caption = next; capPop.v = 6; }
    stepSpring(capPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.4);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 80) * 7 * shake, 0);
    drawClub(ctx, club, multiplier, tension, reduced ? 0 : time, reduced);
    drawQueue(ctx, queue, multiplier);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 250);
      ctx.rotate(-0.05);
      ctx.scale(clamp(pop.x, 0, 1.15), clamp(pop.x, 0, 1.15));
      const word = outcome === 'called' ? 'LEFT THE QUEUE' : outcome === 'rekt' ? 'SELL THE NEWS' : 'DELISTED';
      meme(ctx, word, 0, 0, outcome === 'called' ? 48 : 64, outcome === 'called' ? '#7cf67c' : '#ff4d6d', 'center', 640);
      ctx.restore();
    }
    ctx.restore();
    if (caption) {
      ctx.save();
      ctx.translate(480, 48);
      ctx.scale(1 + 0.07 * capPop.x, 1 + 0.07 * capPop.x);
      meme(ctx, caption, 0, 0, 32, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(480, 512);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      meme(ctx, text, 0, 0, 22, '#7cf67c', 'center');
      ctx.restore();
    }
    meme(ctx, `${multiplier.toFixed(2)}×`, 936, 48, 48, outcome === 'rekt' ? '#ff4d6d' : '#ffffff', 'right');
    meme(ctx, `SUITS ${suitCount(multiplier)}`, 24, 518, 22, '#f0c14a', 'left');
  }
  return { draw };
}
