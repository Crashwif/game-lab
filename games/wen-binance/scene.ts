/**
 * Composes Wen Binance from the room state: the club front, the queue, the
 * suits and the taxi, then the HUD. All motion is stepped here with the real
 * frame time, and nothing drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { type Club, DOOR, H, INK, W, armClub, callTaxi, compact, crashClub, createClub, drawClubBack, drawLateCheckpoint, drawClubFront, jeetClub, resetClub, settleClub, stepClub, waveSuit } from './club';
import { clamp, mix, settleSpring, spring, stepSpring } from './motion';
import { type Queue, SUITS, createQueue, drawQueue, hopeQueue, leaveQueue, panicQueue, resetQueue, settleQueue, stepQueue } from './queue';

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

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The multipliers the milestone stingers play at: every suit waved past. */
const RUNGS = SUITS;
/** The crash: the record scratch on the crash frame, the doors bursting a beat later, a freeze, then slow motion. */
const FUSE_S = 0.14;
const FREEZE_S = 0.15;
const SLOW_S = 0.35;
const SLOW_RATE = 0.3;
/** Where the camera punches in (the doorway), how far (10%), and how long it holds before easing back out. */
const IMPACT = { x: DOOR.x + DOOR.w / 2, y: DOOR.y + DOOR.h / 2 };
const PUNCH = 0.1;
const PUNCH_HOLD_S = 0.3;
/** The score's tempo (measured on the recording): the bass and the tension pulse ride its grid. */
const BPM = 128;
/** Seconds the crash's last frame takes to dissolve into the next round's betting phase. */
const FADE_S = 0.45;
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
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'DODGED THE DUMP' : multiplier < 1.05 ? 'NEVER EVEN LISTED' : 'SELL THE NEWS';
  if (view.phase !== 'running') return 'GM DEGENS';
  if (secured) {
    // The jeet's regret ladder, as the line keeps moving without you; the last word is still yours.
    const r = view.currentX100 / secured.x100;
    return r < 1.3 ? 'LEFT THE QUEUE' : r < 2 ? 'JEETED. NO REGRETS' : r < 4 ? 'THE LINE MOVED. SO?' : 'PROFIT IS PROFIT';
  }
  if (multiplier < 1.5) return 'WEN LISTING';
  if (multiplier < 2) return 'PAID THE LISTING FEE';
  if (multiplier < 2.6) return 'VCS SKIP THE LINE';
  if (multiplier < 3.5) return 'CEX OR BUST';
  if (multiplier < 5) return 'BOUNCER IS CHECKING';
  if (multiplier < 9) return 'THE SUITS ARE LEAVING';
  if (multiplier < 20) return 'PRICED IN';
  return multiplier < 100 ? 'WEN BINANCE' : 'SER, THIS IS A QUEUE';
}

export function createScene(): Scene {
  // A club night; the crash is the DJ pulling the record.
  const audio = pageAudio({ style: 'club', crash: 'scratch' });
  const club: Club = createClub();
  const queue: Queue = createQueue();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the doorway, and the real seconds it still holds there. */
  const punch = spring(0);
  let punchHold = 0;
  /**
   * Seconds into the score. The shell starts it as betting opens and starts the full-length score over as the round
   * starts running, so while running it is the round's elapsed time since then (`beatAt`).
   */
  let beatClock = 0;
  let beatAt = 0;
  let pulseHalf = -1;
  /** The crash's last frame, dissolving into the new round's betting phase (1 down to 0). */
  let fadeFrom: HTMLCanvasElement | null = null;
  let fade = 0;
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
  /** A decorative clock that only ever counts up (slowed by the hit-stop): it never jumps when a round starts. */
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
    {
      freeze = FREEZE_S;
      slow = SLOW_S;
      // A snap zoom on the doorway with the freeze, held for a beat.
      settleSpring(punch, 1);
      punchHold = PUNCH_HOLD_S;
    }
    audio.fx('door', 1.2);
    audio.fx('crowd', 0.7);
  }

  /** Keeps what is on the canvas (the crash's last frame) to dissolve from. */
  function snapshot(ctx: CanvasRenderingContext2D): void {
    try {
      const source = ctx.canvas;
      fadeFrom ??= document.createElement('canvas');
      fadeFrom.width = source.width;
      fadeFrom.height = source.height;
      fadeFrom.getContext('2d')!.drawImage(source, 0, 0);
      fade = 1;
    } catch {
      fade = 0;
    }
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
    beatClock += real;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 0.33 at 1.5x, 0.5 at 2x, 0.67 at 3x, 0.9 at 10x: the first dozen seconds, where most rounds end, carry the climb.
    const tension = 1 - 1 / multiplier;
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
        settleClub(club, queue.suits, multiplier);
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
        if (quiet) { settleQueue(queue, multiplier); settleClub(club, queue.suits, multiplier); }
        if (secured) { leaveQueue(queue, quiet); callTaxi(club, quiet); taxiCalled = true; }
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
      // The score's grid starts over with the score: as betting opens, and as the round starts running.
      if (running) beatAt = view.elapsed / 1000;
      if (view.phase === 'betting') {
        beatClock = 0;
        // The crash's wreckage dissolves into the new night rather than vanishing in one frame.
        if (club.crashed) snapshot(ctx);
        resetClub(club);
        resetQueue(queue);
        outcome = null;
        secured = null;
        fuse = -1;
        freeze = slow = punchHold = 0;
        settleSpring(punch, 0);
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
    if (secured && running && queue.mode === 'queued') { leaveQueue(queue, false); callTaxi(club); jeetClub(club); }
    if (club.taxi && !taxiCalled) { taxiCalled = true; audio.fx('engine', 0.7); }
    if (running) beatClock = view.elapsed / 1000 - beatAt;

    stepClub(club, { running, tension, multiplier, beat: (beatClock * BPM) / 60 }, dt);
    const wasOut = queue.mode === 'gone';
    const reached = stepQueue(queue, { running, multiplier, tension, kick: club.events.kick }, dt);
    if (reached) { waveSuit(club, queue.suits); shake = Math.max(shake, 0.15); audio.fx('whistle', 0.7); }
    // The scene's own sounds: a suit through the door, the bouncer's head-shake, the doors cracking, a letter working
    // loose, letting go and hitting the pavement (clangs a few tenths apart at most), your coin's taxi door, the boos.
    const ev = club.events;
    if (ev.enter) audio.fx('door', 0.5);
    if (ev.shake) audio.fx('buzz', 0.4);
    if (ev.ajar) audio.fx('creak', 0.8);
    if (ev.fake) { audio.fx('creak', 0.55); hopeQueue(queue, club.fakes); }
    if (ev.letterLoose) audio.fx('creak', 0.5);
    if (ev.letterDrop) audio.fx('ratchet', 0.6);
    if (ev.letterDown && time >= clangAt) { clangAt = time + 0.3; audio.fx('clang', 0.5 + 0.5 * ((club.letters.filter((l) => l.state === 'down').length % 4) / 3)); }
    if (!wasOut && queue.mode === 'gone' && running) audio.fx('door', 0.8);
    if (club.crashed && !booed && club.crashAge > 0.5) { booed = true; audio.fx('boo', 0.9); }
    if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    // The tension pulse: a tick on the score's off-beats, every 4 beats at the start, every 2 from 1.43x, every beat
    // from 2.2x and every half-beat from 5x, until you leave the line.
    const half = Math.floor((beatClock * BPM) / 30);
    if (half !== pulseHalf) {
      pulseHalf = half;
      const every = tension < 0.3 ? 8 : tension < 0.55 ? 4 : tension < 0.8 ? 2 : 1;
      if (running && !secured && (half - 1) % every === 0) audio.fx('tick', mix(0.5, 0.9, tension));
    }
    audio.update(view.phase, tension);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold = Math.max(0, punchHold - real);
    stepSpring(punch, punchHold > 0 ? 1 : 0, 10, 0.8, real);
    cashFlash = Math.max(0, cashFlash - dt / 0.4);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);
    const bass = clamp(club.thump.x, 0, 1) * tension * (running ? 1 : 0);

    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 140) * 6 * shake * shake, Math.cos(time * 117) * 4 * shake * shake);
    if (bass > 0.02) ctx.translate(0, Math.sin(time * 60) * 1.5 * bass);
    if (punch.x > 0.005) {
      // The camera punches in on the doorway as it bursts and eases back out.
      const k = 1 + PUNCH * clamp(punch.x, 0, 1.2);
      ctx.translate(IMPACT.x, IMPACT.y);
      ctx.scale(k, k);
      ctx.translate(-IMPACT.x, -IMPACT.y);
    }
    drawClubBack(ctx, club, tension);
    if (running && !outcome) drawLateCheckpoint(ctx, view.elapsed / 1000);
    drawQueue(ctx, queue, tension, outcome !== null, outcome === 'called', view.stake !== null);
    drawClubFront(ctx, club);
    if (outcome && pop.x > 0.02 && club.crashAge > 0.25) {
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
    if (cashFlash > 0.02) {
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
    memeText(ctx, `${multiplier < 1e6 ? multiplier.toFixed(2) : compact(multiplier, 2)}×`, W - 18, H - 18, 52, colour, 'right', 600);
    ctx.restore();
    const next = SUITS.find((m) => m > multiplier);
    memeText(ctx, `${queue.suits} SUIT${queue.suits === 1 ? '' : 'S'}`, 18, H - 18, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    if (running && next !== undefined && !outcome) memeText(ctx, `NEXT SUIT AT ${next.toFixed(1)}×`, 18, 228, 16, '#ffffff', 'left');
    if (fade > 0 && fadeFrom) {
      ctx.save();
      ctx.globalAlpha = fade * fade * (3 - 2 * fade);
      ctx.drawImage(fadeFrom, 0, 0, W, H);
      ctx.restore();
      fade = Math.max(0, fade - real / FADE_S);
    }
  }

  return { draw };
}
