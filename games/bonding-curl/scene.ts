/**
 * Composes Bonding Curl from the room state: the gym, the crowd, the
 * curler and his bicep, the paramedic, the powder, then the HUD, with the
 * sound cued from what they do. All motion is stepped here with the real
 * frame time, and nothing drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { type Curler, GRADUATE_AT, SLEEVE_AT, burstBicep, createCurler, curlerArm, curveFill, drawCurler, marketCap, poseCurler, resetCurler, settleCurler, stepCurler } from './curler';
import { type Gym, INK, createGym, drawGymBack, drawGymCrowd, drawGymFloor, drawPhoneOverlay, drawPuffs, finishGym, heckle, puff, resetGym, settleCrowd, settleTrail, stepGym, swoon, walkOut } from './gym';
import { type Medic, createMedic, drawMedic, drawSirenGlow, resetMedic, settleMedic, stepMedic, summonMedic } from './medic';
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

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'pop';
type Secured = { x100: number; payout: number | null };
/** The crowd's shouts as the number passes each milestone: KING OF THE HILL at half the bonding curve, HALF REPS as the reps fail. */
const HECKLES = ['LFG', 'SHEEEESH', 'KING OF THE HILL', 'WAGMI', 'MOG', 'HALF REPS', 'ALL NATTY?', "IT'S PULSING", 'CALL 911'];
const MILESTONES = [1.2, 1.5, 2, 3, 4, 5, 8, 12, 20];
/** The burst's hit-stop, slow motion, and the camera's punch in (a share of the frame) and how long it holds. */
const FREEZE_S = 0.15;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
const PUNCH = 0.1;
const PUNCH_HOLD_S = 0.3;
/**
 * Half way at 2× and two thirds at 3×, where most rounds end; the slower log scale (growth) still drives the size of
 * the arm, its colour and the mirror's cracks for the long rounds.
 */
const tensionFor = (multiplier: number): number => clamp(1 - 1 / multiplier, 0, 1);

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

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THE PUMP HAS OVERTIME", "THE MEDIC CHECKED HIS WATCH", "SUNS OUT GUNS OUT", "THE TAPE MEASURE RESIGNED", "STILL SKIPPING LEG DAY", "BICEP AUDIT PENDING", "THE MIRROR NEEDS INSURANCE", "REST DAY IS A RUMOUR"];
/** After a cash-out the arm keeps pumping without you: the regret ladder, by how far it has run past your exit. */
const JEET_CAPTIONS: [number, string][] = [[1.15, 'JEETED THE PEAK'], [1.5, 'PROFIT IS PROFIT, SER'], [2.5, "DON'T LOOK AT THE ARM"], [5, 'PAPER HANDS, CLEAN SHIRT'], [Infinity, 'IT WAS NEVER YOUR BICEP']];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'called' && secured) return multiplier * 100 / secured.x100 < 1.1 ? 'SOLD THE PEAK' : 'BAG SAFE, ARM GONE';
  if (outcome) return multiplier < 1.01 ? 'RUGGED ON REP ONE' : outcome === 'rekt' ? 'NOODLE ARM' : 'PROTEIN SHAKE';
  if (view.phase !== 'running') return 'WE GO JIM';
  if (secured) return JEET_CAPTIONS.find(([below]) => multiplier * 100 / secured.x100 < below)![1];
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  // A new line every few seconds through the first fifteen, each one naming what is happening as it happens.
  if (multiplier < 1.25) return 'ONE MORE REP';
  if (multiplier < 1.6) return 'PUMP SEASON';
  if (multiplier < SLEEVE_AT) return 'THE PEAK IS FORMING';
  if (multiplier < GRADUATE_AT) return 'SLEEVE BUSTED';
  if (multiplier < 4.6) return 'GRADUATED TO RAYDIUM';
  if (multiplier < 6.5) return "CAN'T FINISH THE REP";
  if (multiplier < 10) return "HE'S NOT NATTY";
  if (multiplier < 16) return 'NEVER SKIP LEG DAY';
  return 'THE BICEP HAS A TICKER';
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'phonk', crash: 'boom' });
  const gym: Gym = createGym();
  const curler: Curler = createCurler();
  const medic: Medic = createMedic();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const legArrow = spring(0);
  /** The camera's punch into the burst, held for a moment before it eases out. */
  const punch = spring(0);
  let punchHold = 0;
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let milestone = 0;
  let graduated = false;
  let encoreAt = 0;
  let freeze = 0;
  let slow = 0;
  /** The green of an accepted exit, fading. */
  let flash = 0;
  /** A chalk-white wipe from the last crash's aftermath into the next round's warm-up. */
  let wipe = 0;

  /** Jumps to where a round met late stands: the arm and the pose, the milestones passed, the mirror's chart and cracks, the medic and the badge. */
  function settleRound(view: SceneView, multiplier: number, growth: number): void {
    settleCurler(curler, multiplier, growth, secured !== null, view.phase === 'running' ? view.elapsed / 1000 : 0);
    settleCrowd(gym, view.phase === 'running', tensionFor(multiplier));
    while (milestone < MILESTONES.length && multiplier >= MILESTONES[milestone]!) milestone += 1;
    graduated = multiplier >= GRADUATE_AT;
    // Keep the final elapsed time supplied by the round through its crash.
    settleTrail(gym, view.elapsed, growth);
    settleSpring(badge, secured ? 1 : 0);
    settleSpring(legArrow, view.phase === 'running' && multiplier >= 10 ? 1 : 0);
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
    {
      freeze = FREEZE_S;
      slow = SLOW_S;
      // A hard cut in on the burst, held through the hit-stop, then eased back out.
      settleSpring(punch, 1);
      punchHold = PUNCH_HOLD_S;
    }
    // Parked, he rolls the stretcher over; otherwise he sprints in from outside, siren going.
    if (summonMedic(medic)) audio.fx('siren', 0.5);
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
    const tension = tensionFor(multiplier);
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
      encoreAt = view.elapsed + 8_000;
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
        if (outcome) wipe = 1;
        resetGym(gym);
        resetCurler(curler);
        resetMedic(medic);
        outcome = null;
        secured = null;
        milestone = 0;
        graduated = false;
        encoreAt = 0;
        freeze = slow = punchHold = 0;
        settleSpring(punch, 0);
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);

    stepCurler(curler, { running, multiplier, growth, tension, seconds: view.elapsed / 1000 }, dt);
    // After the step, which clears the last frame's events, so the drop's reaction below sees this one.
    if (secured && running) poseCurler(curler);
    stepGym(gym, { running, tension, multiplier, growth, elapsed: view.elapsed, cracks: clamp((growth - 1) / 3, 0, 1) }, dt);
    stepMedic(medic, { running, multiplier, seconds: view.elapsed / 1000 }, dt);
    // The bonding curve fills at 3×: the cuff's LCD graduates, the girls swoon and a bell rings.
    if (running && !graduated && multiplier >= GRADUATE_AT) { graduated = true; swoon(gym); audio.fx('bell', 0.5); }
    if (running && milestone < MILESTONES.length && multiplier >= MILESTONES[milestone]!) {
      heckle(gym, HECKLES[milestone % HECKLES.length]!, milestone % 2 === 0);
      milestone += 1;
      shake = Math.max(shake, 0.2);
    }
    if (running && milestone === MILESTONES.length && view.elapsed >= encoreAt) {
      const round = Math.floor(view.elapsed / 8_000);
      heckle(gym, HECKLES[round % HECKLES.length]!, round % 2 === 0);
      if (round % 3 === 0) swoon(gym);
      encoreAt = view.elapsed + 8_000;
    }
    if (running) audio.milestone(MILESTONES.filter((m) => multiplier >= m).length);
    if (curler.events.rep && running) { shake = Math.max(shake, 0.04 + 0.16 * tension); audio.fx('creak', 0.4 + 0.6 * tension); }
    // The bicep's own pulse under the reps, quickening with the load, for as long as the player is still in.
    if (curler.events.beat && running && !secured && tension > 0.15) audio.fx('heartbeat', 0.15 + 0.35 * tension);
    if (curler.events.hop && running) audio.fx('tick', 0.35);
    if (curler.events.chalk) puff(gym, curlerArm(curler).hand, 5, '#f4f2ea', curler.modeAge);
    if (curler.events.sleeve) { heckle(gym, 'SLEEVE GONE', true); shake = Math.max(shake, 0.3); audio.fx('ratchet', 0.9); }
    if (curler.events.dropped) { puff(gym, { x: curler.dumbbell.x, y: curler.dumbbell.y }, 10, '#ffffff', 5); if (!curler.burst) { swoon(gym); heckle(gym, 'MARRY ME', true); } shake = Math.max(shake, 0.35); audio.fx('thud', 1); }
    if (medic.events.glow) audio.fx('siren', 0.2);
    if (medic.events.peek) audio.fx('squeak', 0.5);
    if (medic.events.enter) audio.fx('siren', 0.6);
    if (medic.events.parked) heckle(gym, 'WHO CALLED HIM', false);
    stepSpring(legArrow, running && multiplier >= 10 ? 1 : 0, 6, 0.6, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    if (punchHold > 0) punchHold = Math.max(0, punchHold - real);
    else stepSpring(punch, 0, 7, 0.9, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);
    if (flash > 0) flash = Math.max(0, flash - real / 0.6);
    if (wipe > 0) wipe = Math.max(0, wipe - real / 0.45);

    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 140) * 7 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    if (punch.x > 0.005) {
      // The camera punches in on the burst and eases back out.
      const k = 1 + PUNCH * clamp(punch.x, 0, 1.2);
      ctx.translate(curler.burstAt.x, curler.burstAt.y);
      ctx.scale(k, k);
      ctx.translate(-curler.burstAt.x, -curler.burstAt.y);
    }
    drawGymBack(ctx, gym, outcome !== null);
    drawGymCrowd(ctx, gym, outcome === 'called');
    drawGymFloor(ctx);
    drawSirenGlow(ctx, medic);
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
      const text = outcome === 'rekt' ? 'SNAP CITY' : outcome === 'called' ? 'DODGED' : 'POPPED';
      memeText(ctx, text, 0, 0, outcome === 'rekt' ? 84 : 78, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    if (flash > 0.01) { ctx.fillStyle = `rgba(124, 246, 124, ${0.3 * flash})`; ctx.fillRect(0, 0, 960, 540); }
    if (wipe > 0.01) { ctx.fillStyle = `rgba(246, 244, 236, ${0.9 * wipe * wipe})`; ctx.fillRect(0, 0, 960, 540); }
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
    // Past a million the readout switches to an exponent rather than running off into the shaker.
    memeText(ctx, `${multiplier < 1e6 ? multiplier.toFixed(2) : multiplier.toExponential(2).replace('+', '')}×`, 24, 514, 56, colour, 'left', 270);
    ctx.restore();
    const curve = curler.burst ? 'CURVE RUGGED' : curveFill(multiplier) >= 1 ? 'GRADUATED' : `CURVE ${Math.floor(curveFill(multiplier) * 100)}%`;
    // Sized to stay clear of his shoes; a longer line compresses rather than reaching them.
    memeText(ctx, `MCAP ${marketCap(multiplier, curler.burst)} · ${curve} · PEAK ${Math.round(30 + 25 * (curler.radius.x - 16) / 128 * 4)} CM`, 936, 514, 21, outcome ? '#ff9db0' : '#e7f4f0', 'right', 400);
  }

  return { draw };
}
