/**
 * Composes Wen Binance from the room state: the club front, the queue, the
 * suits and the taxi, then the HUD. All motion is stepped here with the real
 * frame time, and nothing drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { type Club, DOOR, H, INK, W, armClub, callTaxi, crashClub, createClub, drawClubBack, drawLateCheckpoint, drawClubFront, resetClub, settleClub, stepClub, waveSuit } from './club';
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
/** The multipliers the milestone stingers play at: every suit waved past. */
const RUNGS = SUITS;
/** The crash: the record scratch on the crash frame, the doors bursting a beat later, a short freeze, then slow motion. */
const FUSE_S = 0.14;
const FREEZE_S = 0.07;
const SLOW_S = 0.35;
const SLOW_RATE = 0.3;
/** Where the camera punches in: the doorway. */
const IMPACT = { x: DOOR.x + DOOR.w / 2, y: DOOR.y + DOOR.h / 2 };
type Outcome = 'rekt' | 'called' | 'ended';
type Secured = { x100: number; payout: number | null };

/** How the round ended for this viewer: watched from the pavement, left in time, or still in the line. */
const outcomeFor = (view: SceneView, secured: Secured | null): Outcome => (view.stake === null ? 'ended' : secured ? 'called' : 'rekt');

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
  if (multiplier < 2.2) return 'PAID THE LISTING FEE';
  if (multiplier < 3.2) return 'VCS SKIP THE LINE';
  if (multiplier < 4.8) return 'CEX OR BUST';
  if (multiplier < 7) return 'BOUNCER IS CHECKING';
  if (multiplier < 11) return 'THE SUITS ARE LEAVING';
  return 'PRICED IN';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // A club night; the crash is the DJ pulling the record.
  const audio = pageAudio({ style: 'club', crash: 'scratch' });
  const club: Club = createClub();
  const queue: Queue = createQueue();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the doorway. */
  const punch = spring(0);
  /** Seconds until the doors burst; -1 with no crash on the way. */
  let fuse = -1;
  let freeze = 0;
  let slow = 0;
  /** The green wash of an accepted exit. */
  let cashFlash = 0;
  /** Sounds fired once per round. */
  let taxiCalled = false;
  let booed = false;
  let clangAt = 0;
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';

  /** The doors burst: the suits pour out, the line runs, the bouncer flinches, the shake, the punch-in and the hit-stop. */
  function burst(view: SceneView): void {
    crashClub(club, view.currentX100, false);
    panicQueue(queue, view.currentX100, false);
    shake = 1;
    pop.v = 16;
    punch.v = 8;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    audio.fx('door', 1.2);
    audio.fx('crowd', 0.7);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the burst runs slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    if (view.phase === 'running') time = view.elapsed / 1000;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const tension = clamp(growth / 3.5, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) { audio.cashout(); cashFlash = 1; }
    }

    if (previous === null) {
      // A fresh scene (page load, or a round first met after its betting phase) settles straight into what
      // the view shows: the line where the multiplier put it, an exit already taken, a crash already over.
      previous = view.phase;
      resetClub(club);
      resetQueue(queue);
      if (running || crashed) {
        settleQueue(queue, multiplier);
        settleClub(club, queue.suits, tension);
        if (secured) { leaveQueue(queue, true); callTaxi(club, true); badge.x = 1; taxiCalled = true; }
      }
      if (crashed) {
        outcome = outcomeFor(view, secured);
        crashClub(club, view.currentX100, true);
        panicQueue(queue, view.currentX100, true);
        pop.x = 1;
        booed = true;
        audio.crash('scratch', true);
      }
    } else if (view.phase !== previous) {
      if (crashed && !club.crashed && fuse < 0) {
        const quiet = view.crashAge > 1500;
        outcome = outcomeFor(view, secured);
        // A crash first drawn late (a hidden tab, a throttled frame) settles the line at the crash point, and a
        // cash-out first seen with the crash still takes your coin out of the line.
        if (quiet) { settleQueue(queue, multiplier); settleClub(club, queue.suits, tension); }
        if (secured) { leaveQueue(queue, quiet, reduced); callTaxi(club, quiet); taxiCalled = true; }
        if (quiet) {
          crashClub(club, view.currentX100, true);
          panicQueue(queue, view.currentX100, true);
          pop.x = 1;
          booed = true;
          audio.crash('scratch', true);
        } else {
          // Sell the news: the record scratches, the handles rattle, and the doors burst a beat later.
          fuse = FUSE_S;
          armClub(club);
          audio.crash('scratch');
        }
      }
      if (view.phase === 'betting') {
        resetClub(club);
        resetQueue(queue);
        outcome = null;
        secured = null;
        fuse = -1;
        freeze = slow = 0;
        cashFlash = 0;
        taxiCalled = false;
        booed = false;
      }
      previous = view.phase;
    }
    if (fuse >= 0) {
      fuse -= real;
      if (fuse < 0 && !club.crashed) burst(view);
    }
    if (secured && running && queue.mode === 'queued') { leaveQueue(queue, false, reduced); callTaxi(club); }
    if (club.taxi && !taxiCalled) { taxiCalled = true; audio.fx('engine', 0.7); }

    stepClub(club, { running, tension, multiplier, reduced }, dt);
    const wasOut = queue.mode === 'gone';
    const reached = stepQueue(queue, { running, multiplier, tension, thump: club.thump.x }, dt);
    if (reached) { waveSuit(club, queue.suits); if (!reduced) shake = Math.max(shake, 0.15); audio.fx('whistle', 0.7); }
    // The scene's own sounds: a suit through the door, the bouncer's head-shake, the doors cracking, a letter working
    // loose, letting go and hitting the pavement (clangs a few tenths apart at most), your coin's taxi door, the boos.
    const ev = club.events;
    if (ev.enter) audio.fx('door', 0.5);
    if (ev.shake) audio.fx('buzz', 0.4);
    if (ev.ajar) audio.fx('creak', 0.8);
    if (ev.letterLoose) audio.fx('creak', 0.5);
    if (ev.letterDrop) audio.fx('ratchet', 0.6);
    if (ev.letterDown && time >= clangAt) { clangAt = time + 0.3; audio.fx('clang', 0.5 + 0.5 * ((club.letters.filter((l) => l.state === 'down').length % 4) / 3)); }
    if (!wasOut && queue.mode === 'gone' && running) audio.fx('door', 0.8);
    if (club.crashed && !booed && club.crashAge > 0.5) { booed = true; audio.fx('boo', 0.9); }
    if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    audio.update(view.phase, tension);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 9, 0.5, dt);
    cashFlash = Math.max(0, cashFlash - dt / 0.4);
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
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the doorway as it bursts and eases back out.
      const k = 1 + 0.06 * clamp(punch.x, 0, 1.2);
      ctx.translate(IMPACT.x, IMPACT.y);
      ctx.scale(k, k);
      ctx.translate(-IMPACT.x, -IMPACT.y);
    }
    drawClubBack(ctx, club, tension, reduced);
    if (running && !outcome) drawLateCheckpoint(ctx, view.elapsed / 1000, reduced);
    drawQueue(ctx, queue, tension, outcome !== null, outcome === 'called', club.taxiX.x);
    drawClubFront(ctx, club, reduced);
    if (outcome && pop.x > 0.02 && club.crashAge > 0.4) {
      ctx.save();
      ctx.translate(W / 2, 300);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'called' ? 'CALLED IT' : 'DELISTED';
      memeText(ctx, text, 0, 0, 92, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center');
      ctx.restore();
    }
    ctx.restore();
    if (!reduced && cashFlash > 0.02) {
      ctx.fillStyle = `rgba(124, 246, 124, ${0.22 * cashFlash})`;
      ctx.fillRect(0, 0, W, H);
    }

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
    if (running && next !== undefined && !outcome) memeText(ctx, `NEXT SUIT AT ${next.toFixed(1)}×`, 18, 228, 16, '#ffffff', 'left');
  }

  return { draw };
}
