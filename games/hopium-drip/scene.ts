/**
 * Composes Hopium Drip from the room state: the ward, the monitor, then
 * the HUD over the ward, with the sound cued from the trace's beats and
 * what the ward reports. All motion is stepped here with the frame time,
 * and nothing drawn here changes the committed outcome. The flatline is a
 * freeze, not an impact: the hit-stop and the punch-in belong to the
 * paddles.
 */
import { pageAudio } from './audio';
import { clamp, settleSpring, spring, stepSpring } from './motion';
import { type Monitor, createMonitor, dischargeMonitor, drawMonitor, flatlineMonitor, resetMonitor, settleMonitor, shockMonitor, stepMonitor } from './monitor';
import { INK, TOD_AT, WARD, type Ward, createWard, discharge, dose, drawWard, flatline, resetWard, settleDischarge, settleWard, stepWard } from './ward';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a flatline missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, the monitor flicker, the pulse flashes, the shock's flash, the hit-stop and the punch-in. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'ended';
type Secured = { x100: number; payout: number | null };

/** The caption ladder's rungs, for the milestone stingers. */
const RUNGS = [1.4, 1.9, 2.6, 3.6, 5, 7.5, 12];
/** The hit-stop on each shock, then the slow motion the jolt plays in. */
const FREEZE_S = 0.06;
const SLOW_S = 0.3;
const SLOW_RATE = 0.3;
/** Where the camera punches in: the laptop under the paddles. */
const IMPACT = { x: 385, y: 345 };

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
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'DISCHARGED' : 'TIME OF DEATH';
  if (view.phase !== 'running') return 'GM PATIENT';
  if (secured) return 'DISCHARGED';
  if (multiplier < 1.4) return 'TAKE YOUR MEDS';
  if (multiplier < 1.9) return 'HOPIUM IS KICKING IN';
  if (multiplier < 2.6) return 'ONE MORE DOSE';
  if (multiplier < 3.6) return 'ROOMMATE WAS LEVERAGED';
  if (multiplier < 5) return 'NURSE, MORE HOPIUM';
  if (multiplier < 7.5) return 'ON COPIUM NOW';
  if (multiplier < 12) return 'VITALS UNSTABLE';
  return 'HE SEES GOD CANDLES';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // Hospital muzak that races with the heart rate; the crash is the long beep.
  const audio = pageAudio({ style: 'hospital', crash: 'flatline' });
  const ward: Ward = createWard();
  const monitor: Monitor = createMonitor();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the laptop under the paddles. */
  const punch = spring(0);
  /** The green wash of your discharge. */
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
  /** The heartbeat follows the trace's beats, never faster than the racing trace itself. */
  let beats = 0;
  let beatNext = 0;

  /** Jumps the ward and the monitor to where the round already is, for a round met late. */
  function settle(multiplier: number, tension: number): void {
    settleMonitor(monitor, multiplier);
    settleWard(ward, tension, monitor.doseIndex);
    if (secured) { settleDischarge(ward); dischargeMonitor(monitor); settleSpring(badge, 1); }
    beats = monitor.beats;
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the shock's frame, then the jolt runs slow before time catches up.
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
      if (running) {
        audio.cashout();
        flash.v = 14;
      }
    }
    const ending: Outcome = view.stake === null ? 'ended' : secured ? 'called' : 'rekt';

    // Phase edges. A round met late (the first frame, which may land mid-round or after the crash, or a crash
    // missed while the tab was hidden) settles into place instead of playing out what it missed.
    if (previous === null) {
      previous = view.phase;
      resetWard(ward);
      resetMonitor(monitor);
      if (running || crashed) settle(multiplier, tension);
      if (crashed) {
        outcome = ending;
        flatline(ward, view.currentX100, true);
        flatlineMonitor(monitor, view.currentX100, true);
        pop.x = 1;
        audio.crash('flatline', true);
      }
    } else if (view.phase !== previous) {
      if (crashed && !ward.dead) {
        const quiet = view.crashAge > 1500;
        outcome = ending;
        if (quiet) settle(multiplier, tension);
        else if (secured) discharge(ward); // a cash-out first seen with the crash still walks him out
        flatline(ward, view.currentX100, quiet);
        flatlineMonitor(monitor, view.currentX100, quiet);
        if (quiet) {
          pop.x = 1;
          audio.crash('flatline', true);
        } else {
          shake = 1;
          pop.v = 16;
          audio.crash('flatline');
        }
      }
      if (view.phase === 'betting') {
        resetWard(ward);
        resetMonitor(monitor);
        outcome = null;
        secured = null;
        freeze = slow = 0;
        beats = monitor.beats;
      }
      previous = view.phase;
    }
    if (secured && running) { discharge(ward); dischargeMonitor(monitor); }
    audio.update(view.phase, tension);

    const reached = stepMonitor(monitor, { running, multiplier, tension }, dt);
    if (reached) {
      const label = ward.label;
      dose(ward, monitor.doseIndex);
      if (!reduced) shake = Math.max(shake, 0.15);
      audio.fx('beep', 0.6 + 0.08 * Math.min(9, monitor.doseIndex));
      if (ward.label !== label || ward.refill === 1) audio.fx('glug', 1);
    }
    if (running && monitor.beats !== beats) {
      beats = monitor.beats;
      if (time > beatNext) {
        beatNext = time + 0.25;
        audio.fx('heartbeat', 0.4 + 0.6 * tension);
      }
    }
    stepWard(ward, { running, tension, multiplier, reduced }, dt);
    monitor.charge = ward.paddles.x;
    const events = ward.events;
    if (running && events.roommate) audio.fx('gasp', 0.6);
    if (running && events.wife) audio.fx('notify', 1);
    if (events.wifeLeave) audio.fx('door', 0.5);
    if (events.walk) audio.fx('door', 0.8);
    if (events.cart) audio.fx('squeak', 0.6);
    if (events.clear) audio.fx('gasp', 0.4);
    if (events.zap) {
      // The shock: the trace spikes, the picture holds, the jolt runs slow, the camera punches into the bed.
      shockMonitor(monitor);
      audio.fx('zap', 1);
      punch.v = 8;
      shake = Math.max(shake, 0.7);
      if (!reduced) {
        freeze = FREEZE_S;
        slow = SLOW_S;
      }
    }
    if (events.tod) audio.fx('bell', 0.5);
    if (running) audio.milestone(RUNGS.filter((rung) => multiplier >= rung).length);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 9, 0.5, dt);
    stepSpring(flash, 0, 6, 1, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 6 * shake * shake, Math.cos(time * 117) * 4 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the bed and eases back out.
      const k = 1 + 0.06 * clamp(punch.x, 0, 1.2);
      ctx.translate(IMPACT.x, IMPACT.y);
      ctx.scale(k, k);
      ctx.translate(-IMPACT.x, -IMPACT.y);
    }
    drawWard(ctx, ward, tension, reduced);
    // The word waits for the paddles to fail, so the CLEAR! plays out first; a round met late shows it at once.
    if (outcome && pop.x > 0.02 && ward.deadAge > TOD_AT - 0.6) {
      ctx.save();
      ctx.translate(WARD.w / 2, 300);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'called' ? 'CALLED IT' : 'FLATLINE';
      memeText(ctx, text, 0, 0, 84, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center');
      ctx.restore();
    }
    ctx.restore();
    if (flash.x > 0.01) {
      ctx.fillStyle = `rgba(124, 246, 124, ${0.3 * clamp(flash.x, 0, 1)})`;
      ctx.fillRect(WARD.x, WARD.y, WARD.w, WARD.h);
    }
    drawMonitor(ctx, monitor, multiplier, tension, reduced);

    if (caption) {
      ctx.save();
      ctx.translate(WARD.w / 2, 42);
      const k = 1 + 0.08 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 28, '#ffffff', 'center', 520);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× DISCHARGED`;
      ctx.save();
      ctx.translate(WARD.w / 2, 100 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    memeText(ctx, `${multiplier.toFixed(2)}×`, WARD.w - 18, WARD.h - 18, 52, colour, 'right');
    ctx.restore();
    memeText(ctx, `${monitor.doseIndex} ${monitor.doseIndex === 1 ? 'DOSE' : 'DOSES'}`, 18, WARD.h - 18, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left');
  }

  return { draw };
}
