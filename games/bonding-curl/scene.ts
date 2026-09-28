/**
 * Composes Bonding Curl from the room state: the gym, the crowd, the
 * curler and his bicep, the paramedic, the powder, then the HUD, with the
 * sound cued from what they do. All motion is stepped here with the real
 * frame time, and nothing drawn here changes the committed outcome.
 */
import { free } from '@crashwif/crash-math';
import { pageAudio } from './audio';
import { type Curler, SLEEVE_AT, burstBicep, createCurler, drawCurler, marketCap, poseCurler, resetCurler, settleCurler, stepCurler } from './curler';
import { type Gym, INK, createGym, drawGymBack, drawGymCrowd, drawGymFloor, drawPhoneOverlay, drawPuffs, finishGym, heckle, puff, resetGym, settleTrail, stepGym, swoon, walkOut } from './gym';
import { type Medic, createMedic, drawMedic, resetMedic, settleMedic, stepMedic, summonMedic } from './medic';
import { clamp, settleSpring, spring, stepSpring } from './motion';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a burst missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, the hit-stop, the slow motion and the camera punch. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'pop';
type Secured = { x100: number; payout: number | null };
const HECKLES = ['SHEEEESH', 'ARMS', 'HE LIFTS', 'PEAK', 'MOG', 'ALL NATTY?', "IT'S PULSING", 'CALL 911'];
const MILESTONES = [1.5, 2, 3, 4, 6, 8, 12, 20];
/** The burst's hit-stop and slow motion. */
const FREEZE_S = 0.07;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;

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
  if (outcome) return outcome === 'rekt' ? 'NOODLE ARM' : outcome === 'called' ? 'SOLD THE PEAK' : 'PROTEIN SHAKE';
  if (view.phase !== 'running') return 'WE GO JIM';
  if (secured) return 'CURLS FOR THE GIRLS';
  if (multiplier < 1.3) return 'ONE MORE REP';
  if (multiplier < 1.7) return 'PUMP SEASON';
  if (multiplier < SLEEVE_AT) return 'THE PEAK IS FORMING';
  if (multiplier < 3.2) return 'SLEEVE BUSTED';
  if (multiplier < 4.5) return 'SUNS OUT GUNS OUT';
  if (multiplier < 6.5) return "HE'S NOT NATTY";
  if (multiplier < 10) return 'PEAK IS IN';
  if (multiplier < 16) return 'NEVER SKIP LEG DAY';
  return 'THE BICEP HAS A TICKER';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'phonk', crash: 'boom' });
  const gym: Gym = createGym();
  const curler: Curler = createCurler();
  const medic: Medic = createMedic();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const legArrow = spring(0);
  /** The camera's punch into the burst. */
  const punch = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let milestone = 0;
  let freeze = 0;
  let slow = 0;
  /** The green of an accepted exit, fading. */
  let flash = 0;

  /** Jumps to where a round met late stands: the arm and the pose, the milestones passed, the mirror's chart and cracks, the medic and the badge. */
  function settleRound(view: SceneView, multiplier: number, growth: number): void {
    settleCurler(curler, multiplier, growth, secured !== null);
    while (milestone < MILESTONES.length && multiplier >= MILESTONES[milestone]!) milestone += 1;
    // A crashed round no longer keeps its running time, so the crash point's time comes from the curve.
    settleTrail(gym, view.phase === 'running' ? view.elapsed : Math.log(multiplier) / free.GROWTH_RATE_PER_MS, growth);
    settleSpring(badge, secured ? 1 : 0);
    settleMedic(medic, multiplier, view.phase === 'crashed');
    // The mirror's cracks, which hold through the crash once finishGym has run.
    gym.cracks = clamp((growth - 1) / 3, 0, 1);
  }

  /** Snap city. `quiet` is a crash met late: the aftermath in place, no cloud, no stinger. */
  function snap(view: SceneView, quiet: boolean): void {
    burstBicep(curler, view.currentX100, quiet);
    finishGym(gym, outcome === 'called', quiet);
    if (outcome !== 'called') walkOut(gym, quiet ? view.crashAge / 1000 : 0);
    if (quiet) {
      pop.x = 1;
      settleMedic(medic, view.currentX100 / 100, true);
      audio.crash('boom', true);
      return;
    }
    shake = 1;
    pop.v = 16;
    punch.v = 8;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    summonMedic(medic);
    audio.crash('boom');
    audio.fx('hiss', 0.7);
    if (outcome !== 'called') {
      // The girls' phones flip from MARRY ME to IS HE OK on their way out.
      heckle(gym, 'IS HE OK', true);
      heckle(gym, 'CALL 911', true);
      audio.fx('scream', 0.7);
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
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const tension = clamp(growth / 3.3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) { audio.cashout(); flash = 1; }
    }
    const ending: Outcome = view.stake === null ? 'pop' : secured ? 'called' : 'rekt';

    // The first frame may land mid-round or after the crash (a page that joins late, or a fresh scene for a
    // round whose betting was missed), and a crash can be met well after it happened (the tab was hidden
    // through it): both settle into place instead of replaying the heckles, the exit and the burst they missed.
    if (previous === null) {
      previous = view.phase;
      resetGym(gym);
      resetCurler(curler);
      resetMedic(medic);
      if (running || crashed) settleRound(view, multiplier, growth);
      if (crashed) {
        outcome = ending;
        snap(view, true);
      }
    } else if (view.phase !== previous) {
      if (crashed && !curler.burst) {
        const quiet = view.crashAge > 1500;
        if (quiet) settleRound(view, multiplier, growth);
        outcome = ending;
        snap(view, quiet);
      }
      if (view.phase === 'betting') {
        resetGym(gym);
        resetCurler(curler);
        resetMedic(medic);
        outcome = null;
        secured = null;
        milestone = 0;
        freeze = slow = 0;
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);

    stepCurler(curler, { running, multiplier, growth, tension }, dt);
    // After the step, which clears the last frame's events, so the drop's reaction below sees this one.
    if (secured && running) poseCurler(curler);
    stepGym(gym, { running, tension, multiplier, growth, elapsed: view.elapsed, cracks: clamp((growth - 1) / 3, 0, 1) }, dt);
    stepMedic(medic, { running, multiplier }, dt);
    if (running && milestone < MILESTONES.length && multiplier >= MILESTONES[milestone]!) {
      heckle(gym, HECKLES[milestone % HECKLES.length]!, milestone % 2 === 0);
      milestone += 1;
      if (!reduced) shake = Math.max(shake, 0.2);
    }
    if (running) audio.milestone(MILESTONES.filter((m) => multiplier >= m).length);
    if (curler.events.rep && running) { if (!reduced) shake = Math.max(shake, 0.04 + 0.16 * tension); audio.fx('creak', 0.4 + 0.6 * tension); }
    if (curler.events.hop && running) audio.fx('tick', 0.35);
    if (curler.events.sleeve) { heckle(gym, 'SLEEVE GONE', true); if (!reduced) shake = Math.max(shake, 0.3); audio.fx('ratchet', 0.9); }
    if (curler.events.dropped) { puff(gym, { x: 540, y: 480 }, 10, '#ffffff', 5); swoon(gym); heckle(gym, 'MARRY ME', true); if (!reduced) shake = Math.max(shake, 0.35); audio.fx('thud', 1); }
    if (medic.events.enter) { heckle(gym, 'WHO CALLED HIM', false); audio.fx('siren', 0.6); }
    stepSpring(legArrow, running && multiplier >= 10 ? 1 : 0, 6, 0.6, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 9, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);
    if (flash > 0) flash = Math.max(0, flash - real / 0.6);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 7 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the burst and eases back out.
      const k = 1 + 0.07 * clamp(punch.x, 0, 1.2);
      ctx.translate(curler.burstAt.x, curler.burstAt.y);
      ctx.scale(k, k);
      ctx.translate(-curler.burstAt.x, -curler.burstAt.y);
    }
    drawGymBack(ctx, gym, outcome !== null);
    drawGymCrowd(ctx, gym, outcome === 'called');
    drawGymFloor(ctx);
    drawMedic(ctx, medic);
    const cv = drawCurler(ctx, curler);
    drawPuffs(ctx, gym);
    const arrow = clamp(legArrow.x, 0, 1);
    if (arrow > 0.02) {
      ctx.save();
      // Behind him, clear of the curling arm and the secured badge: the question, then the arrow at the stick legs.
      ctx.translate(400 + Math.sin(time * 4) * 6, 440);
      ctx.scale(arrow, arrow);
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-60, -12); ctx.lineTo(-20, -12); ctx.lineTo(-20, -26); ctx.lineTo(10, 0); ctx.lineTo(-20, 26); ctx.lineTo(-20, 12); ctx.lineTo(-60, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      memeText(ctx, 'LEG DAY?', -68, 6, 20, '#ffffff', 'right');
      ctx.restore();
    }
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(Math.min(curler.burstAt.x + 40, 700), curler.burstAt.y - 40);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'rekt' ? 'SNAP CITY' : outcome === 'called' ? 'CALLED IT' : 'POPPED';
      memeText(ctx, text, 0, 0, outcome === 'rekt' ? 84 : 78, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    if (flash > 0.01) { ctx.fillStyle = `rgba(124, 246, 124, ${0.3 * flash})`; ctx.fillRect(0, 0, 960, 540); }
    drawPhoneOverlay(ctx, gym, !outcome);
    void cv;

    if (caption) {
      ctx.save();
      ctx.translate(430, 78);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 44, '#ffffff', 'center', 600);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      // Under the caption, on the mirror: off the floor, where the dropped weight and its cracks are the beat.
      ctx.translate(480, 118 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    memeText(ctx, `${multiplier.toFixed(2)}×`, 24, 514, 56, colour, 'left');
    ctx.restore();
    memeText(ctx, `MCAP ${marketCap(multiplier, curler.burst)} · PEAK ${Math.round(30 + 25 * (curler.radius.x - 16) / 128 * 4)} CM`, 936, 514, 24, outcome ? '#ff9db0' : '#e7f4f0', 'right');
  }

  return { draw };
}
