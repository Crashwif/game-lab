import { type Act, actAt, drawAct } from './acts';
import { createPortrait } from './portrait';
/**
 * Composes Hopium Drip from the room state: the ward, the monitor, then
 * the HUD over the ward, with the sound cued from the trace's beats and
 * what the ward reports. All motion is stepped here with the frame time,
 * and nothing drawn here changes the committed outcome. The flatline is a
 * freeze, not an impact: the hit-stop and the punch-in belong to the
 * paddles.
 */
import { pageAudio } from './audio';
import { clamp, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type Monitor, PANEL, createMonitor, dischargeMonitor, drawMonitor, flatlineMonitor, resetMonitor, settleMonitor, shockMonitor, stepMonitor } from './monitor';
import { BEAT, INK, WARD, type Ward, createWard, discharge, dose, drawWard, flatline, resetWard, settleDischarge, settleWard, stepWard, tensionAt } from './ward';

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
const RUNGS = [1.4, 1.9, BEAT.flat, BEAT.cart, BEAT.wife, 5, 7.5, 12, 40, 200];
/** The hit-stop on each shock, then the slow motion the jolt plays in, and how long the punch-in holds. */
const FREEZE_S = 0.15;
const SLOW_S = 0.2;
const SLOW_RATE = 0.4;
const PUNCH_HOLD = 0.3;
/** Where the camera punches in: the laptop under the paddles. */
const IMPACT = { x: 385, y: 345 };
/** Lights out between rounds: the ward dims, resets in the dark and comes back up, so nothing snaps on screen. */
const WIPE_DOWN = 0.15;
const WIPE_UP = 0.3;

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
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'JEETED JUST IN TIME' : 'TIME OF DEATH';
  if (view.phase !== 'running') return view.stake === null ? 'VISITING HOURS' : 'GM PATIENT';
  if (secured) {
    // The jeet's regret ladder, while the chart keeps pumping without him; the exit was still the healthy call.
    const regret = view.currentX100 / secured.x100;
    return regret < 1.3 ? 'TOOK PROFITS · DISCHARGED' : regret < 2 ? 'STILL PUMPING WITHOUT YOU' : regret < 4 ? 'PAPER HANDS, HEALTHY HEART' : 'PROFIT IS PROFIT. RIGHT?';
  }
  if (multiplier < 1.4) return 'TAKE YOUR MEDS';
  if (multiplier < 1.9) return 'HOPIUM IS KICKING IN';
  if (multiplier < BEAT.flat) return 'ONE MORE DOSE';
  if (multiplier < BEAT.cart) return 'ROOMMATE WAS LEVERAGED';
  if (multiplier < BEAT.wife) return 'CRASH CART, JUST IN CASE';
  if (multiplier < 5) return 'NURSE, MORE HOPIUM';
  if (multiplier < 7.5) return 'ON COPIUM NOW';
  if (multiplier < 12) return 'VITALS UNSTABLE';
  if (multiplier < 40) return 'HE SEES GOD CANDLES';
  if (multiplier < 200) return 'MEDICAL MIRACLE';
  return 'HE IS THE CHART NOW';
}

export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait("HOPIUM DRIP", [100, 125, 525, 360], '#f0d99c');
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
  /** The white of a shock, faded in real time so it flashes once instead of holding through the hit-stop. */
  let whiteout = 0;
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  /** Seconds into the lights-out between rounds, or -1. */
  let wipe = -1;
  /** The act props on screen and when that act began (ms), faded in while the round runs and out at the crash or the cash-out. */
  let shownAct: Act = actAt(0);
  let shownStart = 0;
  let actFade = 0;
  /** The heartbeat follows the trace's beats, never faster than the racing trace itself. */
  let beats = 0;
  let beatNext = 0;

  /** Jumps the ward and the monitor to where the round already is, for a round met late. */
  function settle(multiplier: number): void {
    settleMonitor(monitor, multiplier);
    settleWard(ward, multiplier, monitor.doseIndex);
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
    whiteout = Math.max(0, whiteout - real / 0.08);
    const multiplier = Math.max(1, view.currentX100 / 100);
    const act = actAt(view.elapsed, reduced);
    // Tension sweeps a third by 1.5×, half by 2× and two thirds by 3×; the acts never lower it.
    const tension = tensionAt(multiplier);
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
      if (running || crashed) settle(multiplier);
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
        if (quiet) settle(multiplier);
        else if (secured) { discharge(ward); dischargeMonitor(monitor); } // a cash-out first seen with the crash still walks him out
        flatline(ward, view.currentX100, quiet);
        flatlineMonitor(monitor, view.currentX100, quiet);
        if (quiet) {
          pop.x = 1;
          audio.crash('flatline', true);
        } else {
          shake = 1;
          audio.crash('flatline');
        }
      }
      // A new round: the lights go down on the old one and the ward resets in the dark (a fresh page has nothing to reset).
      if (view.phase === 'betting' && previous !== 'waiting') wipe = 0;
      previous = view.phase;
    }
    if (wipe >= 0) {
      const before = wipe;
      wipe += real;
      if (before < WIPE_DOWN && wipe >= WIPE_DOWN) {
        resetWard(ward);
        resetMonitor(monitor);
        outcome = null;
        secured = null;
        freeze = slow = punchHold = 0;
        settleSpring(punch, 0);
        beats = monitor.beats;
      }
      if (wipe >= WIPE_DOWN + WIPE_UP) wipe = -1;
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
    if (monitor.beats !== beats) {
      beats = monitor.beats;
      // The heartbeat is the patient's: it stops once he is discharged.
      if (running && !secured && time > beatNext) {
        beatNext = time + 0.25;
        audio.fx('heartbeat', 0.4 + 0.6 * tension);
      }
    }
    stepWard(ward, { running, tension, multiplier, reduced }, dt);
    monitor.charge = ward.paddles.x;
    const events = ward.events;
    if (running && events.hi) audio.fx('pop', 0.4);
    if (running && events.curtain) audio.fx('whoosh', 0.35);
    if (running && events.watch) audio.fx('tick', 0.7);
    if (running && events.roommate) audio.fx('gasp', 0.6);
    if (running && events.wheel) audio.fx('squeak', 0.4);
    if (events.shrug) audio.fx('whoosh', 0.3);
    if (running && events.wife) audio.fx('notify', 1);
    if (events.wifeLeave) audio.fx('door', 0.5);
    if (events.walk) audio.fx('door', 0.8);
    if (events.cart) audio.fx('squeak', 0.6);
    if (events.clear) audio.fx('gasp', 0.4);
    if (events.zap) {
      // The shock: the trace spikes, the picture holds, the jolt runs slow, the camera punches into the bed.
      shockMonitor(monitor);
      audio.fx('zap', 1);
      shake = Math.max(shake, 0.7);
      if (!reduced) {
        freeze = FREEZE_S;
        slow = SLOW_S;
        whiteout = 1;
        // The camera cuts in on the impact frame and holds through the hit-stop before easing out.
        settleSpring(punch, 1);
        punchHold = PUNCH_HOLD;
      }
    }
    if (events.tod) audio.fx('bell', 0.5);
    if (running) audio.milestone(RUNGS.filter((rung) => multiplier >= rung).length);
    stepSpring(pop, outcome && ward.deadAge > 0.12 ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold = Math.max(0, punchHold - real);
    stepSpring(punch, punchHold > 0 ? 1 : 0, 7, 0.9, real);
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
      const k = 1 + 0.1 * clamp(punch.x, 0, 1.2);
      ctx.translate(IMPACT.x, IMPACT.y);
      ctx.scale(k, k);
      ctx.translate(-IMPACT.x, -IMPACT.y);
    }
    drawWard(ctx, ward, tension, reduced);
    // The act props fade in with each act and out at the crash or the cash-out instead of popping.
    const acting = running && view.cashoutX100 === null && act.stage > 0;
    if (acting) { shownAct = act; shownStart = view.elapsed - act.age * 1000; }
    actFade = clamp(actFade + (acting ? dt : -dt) / 0.4, 0, 1);
    if (actFade > 0.01 && shownAct.stage > 0) {
      const into = smoothstep(0, 0.5, shownAct.age);
      ctx.save();
      if (into < 1) {
        ctx.globalAlpha = actFade * (1 - into);
        drawAct(ctx, actAt(shownStart - 1, reduced));
      }
      ctx.globalAlpha = actFade * into;
      drawAct(ctx, shownAct);
      ctx.restore();
    }
    // The word lands with the flatline, above the resuscitation; a round met late shows it at once.
    if (outcome && pop.x > 0.02) {
      ctx.save();
      // A dodged rug sits under the discharge badge.
      const called = outcome === 'called';
      ctx.translate(WARD.w / 2, called ? 156 : 128);
      ctx.rotate(-0.06);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, called ? 'DODGED IT' : 'FLATLINE', 0, 0, called ? 46 : 56, called ? '#7cf67c' : '#ff4d6d', 'center');
      ctx.restore();
    }
    ctx.restore();
    if (flash.x > 0.01) {
      ctx.fillStyle = `rgba(124, 246, 124, ${0.3 * clamp(flash.x, 0, 1)})`;
      ctx.fillRect(WARD.x, WARD.y, WARD.w, WARD.h);
    }
    if (whiteout > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * whiteout})`;
      ctx.fillRect(WARD.x, WARD.y, WARD.w, WARD.h);
    }
    // Discharged, his vitals stop where he unplugged, like the bag; the chart in the header pumps on.
    drawMonitor(ctx, monitor, multiplier, secured ? tensionAt(secured.x100 / 100) : tension, reduced, view.stake !== null);
    if (wipe >= 0) {
      ctx.fillStyle = `rgba(6, 10, 14, ${wipe < WIPE_DOWN ? wipe / WIPE_DOWN : 1 - (wipe - WIPE_DOWN) / WIPE_UP})`;
      ctx.fillRect(WARD.x, WARD.y, WARD.w + PANEL.w, WARD.h);
    }

    capture(ctx);
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
    memeText(ctx, `${multiplier.toFixed(2)}×`, WARD.w - 18, WARD.h - 18, 52, colour, 'right', 440);
    ctx.restore();
    memeText(ctx, `${monitor.doseIndex} ${monitor.doseIndex === 1 ? 'DOSE' : 'DOSES'}`, 18, WARD.h - 18, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, "PATIENT OBSERVATION", `${Math.round(monitor.bpm.x)} BPM · Dose ${monitor.doseIndex} · ${ward.label}`, view.cashoutX100 !== null ? [Math.max(0, Math.min(430, ward.patient.x - 180)), 125, 525, 360] : undefined);

  }

  return { draw };
}
