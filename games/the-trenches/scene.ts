import { endurance } from './endurance';
import { portrait } from './portrait';
/**
 * Composes The Trenches from the room state: the sky and the ridge, the
 * squad on the field, the trench in front, then the HUD, with the sound
 * cued from what the field and the squad report. All motion is stepped
 * here with the frame time, and nothing drawn here changes the committed
 * outcome. Tension is 1 − 1/x (0.5 at 2×, 0.67 at 3×), so the 1×–3× window
 * where most rounds end escalates; the sky and the moon also follow a slow
 * log driver for long rounds. The nuke plays as a hit-stop, a slow-motion
 * blast and a held camera punch into the ridge.
 */
import { pageAudio } from './audio';
import { type Field, H, INK, RIDGE_X, W, createField, drawCloud, drawGround, drawAdvance, drawNukeFront, drawSky, nuke, resetField, stepField } from './field';
import { clamp, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type Squad, createSquad, diveBack, drawSquad, drawTrench, killSquad, resetSquad, settleSquad, stepSquad } from './squad';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a nuke missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, the flash, the shell flicker, the hit-stop and the punch-in. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'kia' | 'survived' | 'nuked';
type Secured = { x100: number; payout: number | null };

/** The milestone stingers (with a small shake): every two or three seconds through the first 3×, then wider apart. */
const RUNGS = [1.25, 1.5, 2, 2.5, 3, 5, 10];
/** The caption ladder: each line holds until the multiplier passes its rung, and names only what is on screen by then. */
const LADDER: ReadonlyArray<readonly [number, string]> = [
  [1.1, 'OVER THE TOP'], [1.3, 'CHARGE THE CHART'], [1.5, 'EVEN THE RATS ARE JEETING'], [1.75, 'PAPER HANDS IN THE SQUAD'],
  [2, 'HOLD THE LINE'], [2.4, 'DIAMOND HELMETS ON'], [3, 'SNIPERS ON THE RIDGE'], [4, 'THE SHELLS ARE WALKING IN'],
  [6, 'LOOT IN SIGHT'], [10, 'COMMAND IS SELLING'], [Infinity, 'FEW UNDERSTAND'],
];
/** The hit-stop on the flash frame, then the slow motion the blast starts in, and the camera punch held through both. */
const FREEZE_S = 0.16;
const SLOW_S = 0.35;
const SLOW_RATE = 0.3;
const PUNCH = 0.1;
const PUNCH_HOLD_S = 0.3;
/** Where the camera punches in: the ridge, where the cloud stands. */
const IMPACT = { x: RIDGE_X + 100, y: 260 };

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

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // A military band that quickens on the march; the crash is the nuke.
  const audio = pageAudio({ style: 'military', crash: 'boom' });
  const field: Field = createField();
  const squad: Squad = createSquad();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the ridge. */
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
  let milestones = 0;
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  /** A dark fade over the reset to a new round, so the nuke's aftermath does not cut to the fresh trench. */
  let fade = 0;
  /** The next heartbeat, in round seconds: it quickens with the tension while your bet rides. */
  let pulseAt = 1.4;
  /** The helmets clang as they land, a few a second at most. */
  let clangNext = 0;

  /** The caption: the outcome, the cash-out's regret ladder, the long round's acts, or the multiplier's rung. */
  function captionFor(view: SceneView): string {
    const multiplier = Math.max(1, view.currentX100 / 100);
    if (outcome === 'survived') return 'DODGED THE NUKE';
    if (outcome) return !squad.whistled ? 'RUGGED BEFORE THE WHISTLE' : squad.early ? 'RUGGED IN THE TRENCH' : outcome === 'kia' ? 'DIED FOR A FROG COIN' : 'NUKED. NO SKIN IN THE GAME.';
    if (view.phase !== 'running') return 'GM SOLDIER';
    if (secured) {
      // Jeeted: still a good call, however far the squad gets without you.
      const regret = view.currentX100 / secured.x100;
      return regret < 1.2 ? 'TOOK PROFIT. FROG JEET.' : regret < 1.6 ? 'SQUAD SAYS JEET. YOU SAY ALIVE.' : regret < 2.5 ? 'STILL MARCHING WITHOUT YOU' : 'PAPER HANDS. INTACT HANDS.';
    }
    const act = endurance(view.elapsed / 1000).act;
    if (act) return ['', 'COVER AHEAD. KEEP LOW.', 'THE MUD WANTS YOUR BOOTS', 'BRACE. PASS THE FLAG.', 'STILL MARCHING. STILL HOLDING.'][act]!;
    return LADDER.find(([top]) => multiplier < top)![1];
  }

  /** The nuke lands. A crash more than 1.5 s old is shown settled, so a nuke missed while the tab was hidden is not replayed late. */
  function land(view: SceneView, progress: number): void {
    const quiet = view.crashAge > 1500;
    outcome = view.stake === null ? 'nuked' : secured ? 'survived' : 'kia';
    // The cash-out and the crash can reach the same frame: your frog still gets back in the trench.
    if (secured) diveBack(squad, progress, quiet);
    nuke(field, view.currentX100, quiet);
    killSquad(squad, quiet, progress);
    if (quiet) {
      pop.x = 1;
      audio.crash('boom', true);
      return;
    }
    shake = 1;
    pop.v = 16;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
      settleSpring(punch, 1);
      punchHold = PUNCH_HOLD_S;
    }
    audio.crash('boom');
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number, close = false): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the flash frame, then the blast runs slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    punchHold = Math.max(0, punchHold - real);
    fade = Math.max(0, fade - real / 0.35);
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = clamp(1 - 1 / multiplier, 0, 1);
    const progress = tension;
    const seconds = view.elapsed / 1000;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) {
        audio.cashout();
        flash.v = 14;
      }
    }

    if (previous === null) {
      // A fresh scene can open on any phase (the shell makes one for a round it first meets mid-way): settle
      // straight to what the view says instead of replaying the round.
      previous = view.phase;
      resetField(field);
      resetSquad(squad);
      if (running || crashed) {
        settleSquad(squad, tension, seconds);
        milestones = RUNGS.filter((rung) => multiplier >= rung).length;
        pulseAt = seconds + 0.5;
        if (secured) { diveBack(squad, progress, true); settleSpring(badge, 1); }
      }
      if (crashed) land(view, progress);
    } else if (view.phase !== previous) {
      if (crashed && !field.nuked) land(view, progress);
      if (view.phase === 'betting') {
        // A nuke still on screen (through a waiting phase too) fades to the new trench rather than cutting.
        fade = outcome ? 1 : 0;
        resetField(field);
        resetSquad(squad);
        outcome = null;
        secured = null;
        milestones = 0;
        freeze = slow = punchHold = 0;
        pulseAt = 1.4;
      }
      previous = view.phase;
    }
    if (secured && running) diveBack(squad, progress);
    const reached = RUNGS.filter((rung) => multiplier >= rung).length;
    if (running && reached > milestones) { milestones = reached; if (!reduced) shake = Math.max(shake, 0.45); }
    audio.update(view.phase, tension);
    // Your heartbeat while the bet rides: every 1.4 s at 1×, 0.88 s at 2×, 0.7 s at 3×. It stops when you cash out.
    if (running && view.stake !== null && !secured && seconds >= pulseAt) {
      audio.fx('heartbeat', 0.2 + 0.35 * tension);
      pulseAt = seconds + mix(1.4, 0.35, tension);
    }

    stepField(field, { running, tension, multiplier, reduced, real }, dt);
    stepSquad(squad, { seconds, running, tension, multiplier, progress, reduced }, dt);
    const fe = field.events;
    const se = squad.events;
    if (running && se.whistle) audio.fx('whistle', 1);
    if (running && se.step) audio.fx('stomp', 0.25 + 0.4 * tension);
    if (running && se.land) audio.fx('stomp', 0.5);
    if (running && se.phone) audio.fx('phone', 0.7);
    if (running && se.glare) audio.fx('squeak', 1.3);
    if (running && fe.shell) audio.fx('whoosh', 0.45 + 0.3 * tension);
    if (running && fe.jeet) audio.fx('scream', 0.3);
    if (se.clang) audio.fx('clang', 1);
    if (se.flip) audio.fx('ratchet', 0.8);
    if (fe.flung) audio.fx('scream', 1);
    if (fe.helmets > 0 && time > clangNext) {
      clangNext = time + 0.15;
      audio.fx('clang', 0.5);
    }
    if (running) audio.milestone(reached);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, punchHold > 0 ? 1 : 0, 7, 0.9, dt);
    stepSpring(flash, 0, 6, 1, dt);
    const nextCaption = captionFor(view);
    if (nextCaption !== caption) { caption = nextCaption; captionPop.v = 6; }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.6);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 8 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    else if (!reduced && running && tension > 0.5) ctx.translate(Math.sin(time * 90) * 1.5 * (tension - 0.5), 0);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the ridge, holds through the hit-stop and eases back out.
      const k = 1 + PUNCH * clamp(punch.x, 0, 1.2);
      ctx.translate(IMPACT.x, IMPACT.y);
      ctx.scale(k, k);
      ctx.translate(-IMPACT.x, -IMPACT.y);
    }
    drawSky(ctx, field, tension, multiplier, reduced);
    drawGround(ctx, field, tension, progress, squad.scroll);
    // The long round's act props fade out under the nuke rather than vanishing.
    if (running || crashed) drawAdvance(ctx, seconds, reduced, running ? 1 : 1 - smoothstep(0, 0.5, field.nukeAge), tension, field.time);
    drawCloud(ctx, field, tension, reduced);
    drawSquad(ctx, squad, progress, tension, view.stake !== null);
    drawTrench(ctx, squad, tension, view.stake !== null, progress);
    drawNukeFront(ctx, field, reduced);
    if (outcome && pop.x > 0.02 && field.nukeAge > 0.6) {
      ctx.save();
      ctx.translate(W / 2, 250);
      ctx.rotate(-0.08);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'kia' ? 'KIA' : outcome === 'survived' ? 'SURVIVED' : 'NUKED';
      memeText(ctx, text, 0, 0, 96, outcome === 'kia' ? '#ff4d6d' : outcome === 'survived' ? '#7cf67c' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    if (flash.x > 0.01) {
      ctx.fillStyle = `rgba(124, 246, 124, ${0.3 * clamp(flash.x, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (fade > 0) {
      ctx.fillStyle = `rgba(20, 16, 14, ${fade})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (caption) {
      ctx.save();
      ctx.translate(W / 2, 56);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 44, '#ffffff', 'center', 800);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(W / 2, 100 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    if (!close) {
      const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
      ctx.save();
      if (!running && !outcome) ctx.globalAlpha = 0.85;
      // Both readouts keep to their own side, however many digits a long round runs to.
      memeText(ctx, `${multiplier.toFixed(2)}×`, W - 18, H - 18, 52, colour, 'right', 560);
      ctx.restore();
      const metres = Math.round((multiplier - 1) * 42);
      memeText(ctx, metres < 10000 ? `${metres} METRES` : `${(metres / 1000).toFixed(metres < 1e6 ? 1 : 0)} KM`, 18, H - 18, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left', 330);
      // A spectator has no frog in this: their own small tag.
      if (view.stake === null && running) memeText(ctx, 'SPECTATING · NO SKIN IN THE GAME', 18, H - 50, 15, '#c9d3cf', 'left');
    }
  }

  return { draw: portrait(draw, 'THE TRENCHES', () => ({ x: 135, y: 165, w: 620, h: 325 }), captionFor) };
}
