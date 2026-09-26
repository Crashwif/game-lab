/**
 * Composes Wen Binance from the room state: the club front, the queue, the
 * suits and the taxi, then the HUD. All motion is stepped here with the real
 * frame time, and nothing drawn here changes the committed outcome.
 */
import { type Club, H, INK, W, callTaxi, crashClub, createClub, drawClubBack, drawClubFront, resetClub, settleClub, stepClub, waveSuit } from './club';
import { clamp, spring, stepSpring } from './motion';
import { type Queue, SUITS, createQueue, drawQueue, leaveQueue, panicQueue, resetQueue, settleQueue, stepQueue } from './queue';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a reveal missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the bass shake, the marquee flicker and the strobe. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'ended';
type Secured = { x100: number; payout: number | null };

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'LEFT THE QUEUE' : 'SELL THE NEWS';
  if (view.phase !== 'running') return 'GM DEGENS';
  if (secured) return 'LEFT THE QUEUE';
  if (multiplier < 1.5) return 'WEN LISTING';
  if (multiplier < 2.2) return 'NUMBER GO UP';
  if (multiplier < 3.2) return 'HODL';
  if (multiplier < 4.8) return 'DIAMOND HANDS';
  if (multiplier < 7) return 'BOUNCER IS CHECKING';
  if (multiplier < 11) return 'THE SUITS ARE LEAVING';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const club: Club = createClub();
  const queue: Queue = createQueue();
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

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const tension = clamp(growth / 3.5, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };

    if (previous === null) {
      previous = view.phase;
      resetClub(club);
      resetQueue(queue);
      if (running || crashed) { settleQueue(queue, multiplier); settleClub(club, queue.suits); }
      if (crashed) {
        outcome = 'ended';
        crashClub(club, view.currentX100, true);
        panicQueue(queue, view.currentX100, true);
        pop.x = 1;
      }
    } else if (view.phase !== previous) {
      if (crashed && !club.crashed) {
        const quiet = view.crashAge > 1500;
        outcome = view.stake === null ? 'ended' : secured ? 'called' : 'rekt';
        crashClub(club, view.currentX100, quiet);
        panicQueue(queue, view.currentX100, quiet);
        if (quiet) pop.x = 1;
        else { shake = 1; pop.v = 16; }
      }
      if (view.phase === 'betting') {
        resetClub(club);
        resetQueue(queue);
        outcome = null;
        secured = null;
      }
      previous = view.phase;
    }
    if (secured && running && queue.mode === 'queued') { leaveQueue(queue); callTaxi(club); }

    stepClub(club, { running, tension, multiplier, reduced }, dt);
    const reached = stepQueue(queue, { running, multiplier, tension, thump: club.thump.x }, dt);
    if (reached) { waveSuit(club, queue.suits); if (!reduced) shake = Math.max(shake, 0.15); }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);
    const bass = reduced ? 0 : clamp(club.thump.x, 0, 1) * tension * (running ? 1 : 0);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 6 * shake * shake, Math.cos(time * 117) * 4 * shake * shake);
    if (bass > 0.02) ctx.translate(0, Math.sin(time * 60) * 1.5 * bass);
    drawClubBack(ctx, club, tension, reduced);
    drawQueue(ctx, queue, tension, outcome !== null, outcome === 'called', club.taxiX.x);
    drawClubFront(ctx, club, reduced);
    if (outcome && pop.x > 0.02 && club.crashAge > 0.4) {
      ctx.save();
      ctx.translate(W / 2, 300);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'rekt' ? 'DELISTED' : outcome === 'called' ? 'CALLED IT' : 'LISTED';
      memeText(ctx, text, 0, 0, 92, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    if (caption) {
      ctx.save();
      ctx.translate(W / 2 - 150, 52);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 44, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(W / 2 - 150, 96 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    memeText(ctx, `${multiplier.toFixed(2)}×`, W - 18, H - 18, 52, colour, 'right');
    ctx.restore();
    const next = SUITS.find((m) => m > multiplier);
    memeText(ctx, `${queue.suits} SUITS`, 18, H - 18, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    if (running && next !== undefined && !outcome) memeText(ctx, `NEXT SUIT AT ${next.toFixed(1)}×`, 18, H - 46, 14, '#c9c9d4', 'left');
  }

  return { draw };
}
