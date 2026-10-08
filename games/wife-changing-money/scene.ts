import { actAt, drawAct } from './acts';
import { createPortrait, isPortrait } from './portrait';
/**
 * Composes Wife Changing Money: the dark kitchen, the trader, the suitcase
 * meter and the HUD. Motion is stepped with the real frame time. Nothing
 * drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import {
  cashBurst,
  clickSell,
  crashKitchen,
  createKitchen,
  drawFront,
  drawGlow,
  drawLaptop,
  drawLight,
  drawMid,
  drawRoom,
  drawVignette,
  type Kitchen,
  resetKitchen,
  settleKitchen,
  stepKitchen,
  visibleMugs,
} from './kitchen';
import { clamp, mix, spring, stepSpring } from './motion';
import { createTrader, cueTrader, drawTrader, joltTrader, resetTrader, snapTrader, stepTrader, type Trader } from './trader';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a crash missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, the hit-stop and the punch-in; the clock flicker is left as a steady colon. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
/** The multipliers the caption ladder steps at: each is a milestone ding, the third onward an airhorn. */
const RUNGS = [1.35, 1.8, 2.6, 4, 6.5, 9, 14, 22];
/** The caught frame: a held freeze, then she comes down the first stairs at a third speed before time catches up. */
const FREEZE_S = 0.16;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
/** Where the camera punches in (the laptop and the man frozen over it), how far, and how long it holds there. */
const PUNCH_AT = { x: 420, y: 330 } as const;
const PUNCH_ZOOM = 0.1;
const PUNCH_HOLD_S = 0.45;

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

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THE KETTLE KNOWS TOO MUCH", "THE GROUP CHAT IS TYPING", "SLEEP SCHEDULE LIQUIDATED", "THE STAIRS HAVE PATCH NOTES", "ONE MORE TRADE, AGAIN", "THE COFFEE WENT COLD", "TYPING A VERY LONG EXPLANATION", "THE KITCHEN NIGHT SHIFT"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, trader: Trader, secured: Secured | null): string {
  if (outcome === 'rekt') return 'WIFE CHANGED';
  if (outcome === 'called') return 'RUG DODGED';
  if (outcome === 'spectator') return 'SLEEPING IN THE CAR';
  if (view.phase !== 'running') return 'GM DEGEN';
  if (trader.mode === 'upstairs' && secured) {
    // Upstairs while the chart keeps going: jeet jokes, but he still has a wife.
    const regret = multiplier * 100 / secured.x100;
    return regret >= 5 ? 'STILL PUMPING. STILL MARRIED' : regret >= 2 ? 'JEETED. STILL MARRIED' : regret >= 1.25 ? 'TOOK PROFITS, KEPT THE WIFE' : 'SHE NEVER KNEW';
  }
  if (trader.mode === 'upstairs') return 'SHE NEVER KNEW';
  if (trader.mode === 'sneak' || trader.mode === 'closing' || secured) return 'CLOSE THE LID';
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (multiplier < 1.35) return 'JUST ONE MORE TRADE';
  if (multiplier < 1.8) return 'MARGIN ON THE MORTGAGE';
  if (multiplier < 2.6) return "SHE'S ASLEEP";
  if (multiplier < 4) return 'WHO IS KYLE';
  if (multiplier < 6.5) return 'THE CAR WAS COLLATERAL';
  if (multiplier < 9) return 'LIFE CHANGING';
  if (multiplier < 14) return 'WIFE CHANGING';
  if (multiplier < 22) return 'IS THAT THE STAIRS';
  return 'SHE BROUGHT KYLE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait("WIFE CHANGING MONEY", [260, 240, 460, 270], '#f0d99c');
  const reduced = options.reducedMotion === true;
  // Lo-fi beats to lose the house to. The crash is the slam of her hand on the table.
  const audio = pageAudio({ style: 'lofi', crash: 'slam' });
  const kitchen: Kitchen = createKitchen();
  const trader: Trader = createTrader();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the caught frame, held in for `punchHold` seconds before it eases back out. */
  const punch = spring(0);
  let punchHold = 0;
  /** The act props' presence: run out over a crash or a cash-out instead of cut. */
  let actFade = 0;
  let shownAct = actAt(0);
  /** The heartbeat under the music while he is still at the desk. */
  let pulse = 0;
  /** A blink to black over the reset between rounds, so the kitchen does not jump back to the start. */
  let cut = 0;
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let freeze = 0;
  let slow = 0;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues play for it. */
  let muted = false;

  function beginCrash(view: SceneView, quiet: boolean): void {
    const harmless = secured !== null || trader.mode === 'upstairs' || trader.mode === 'sneak' || trader.mode === 'closing';
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    if (harmless && quiet) snapTrader(trader, 'upstairs');
    else if (!harmless) snapTrader(trader, 'caught');
    if (!quiet && !harmless) trader.modeAge = 0;
    crashKitchen(kitchen, view.currentX100, quiet, harmless);
    if (quiet) {
      pop.x = 1;
      muted = true;
      audio.crash('slam', true);
      return;
    }
    pop.v = 16;
    if (harmless) {
      // He is already upstairs: she checks the kitchen and goes back up. A soft beat, no slam.
      shake = reduced ? 0 : 0.2;
      audio.crash('thud');
      return;
    }
    shake = 1;
    joltTrader(trader);
    punch.v = 10;
    punchHold = PUNCH_HOLD_S;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    audio.crash('slam');
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the caught frame for a few frames, then she comes down slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += reduced ? dt * 0.25 : dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const act = actAt(view.elapsed, reduced);
    // 1-1/x sweeps the 1x-3x window that most rounds live in (0.33 at 1.5x, 0.5 at 2x, 0.67 at 3x). The acts never
    // lower it; long rounds keep changing through the acts, the overtime texts and her peeks.
    const tension = 1 - 1 / multiplier;
    const fear = tension;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      // Seen land while the round runs: the cursor finally clicks SELL, gold spills from the case, the register rings.
      if (running && !fresh && !kitchen.crashed) {
        clickSell(kitchen);
        cashBurst(kitchen);
        audio.cashout();
      }
    }

    if (fresh) {
      // A fresh scene can open on a round already under way (a page load mid-round, or a round first seen
      // after its betting window), so it settles into the round as it stands instead of playing out what it
      // missed: a cash-out has already sent him upstairs, and a crash is the quiet aftermath.
      previous = view.phase;
      if (running || crashed) {
        settleKitchen(kitchen, multiplier, fear, secured?.x100 ?? null);
        if (secured) {
          snapTrader(trader, 'upstairs');
          badge.x = 1;
          kitchen.sell = 'clicked';
        }
      }
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !kitchen.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        if (kitchen.crashed || secured) cut = 1;
        resetKitchen(kitchen);
        resetTrader(trader);
        outcome = null;
        secured = null;
        shake = 0;
        freeze = slow = 0;
        punchHold = 0;
        actFade = 0;
        pulse = 0;
        muted = false;
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    if (secured && running && !kitchen.crashed && trader.mode === 'hunch') holdMeter(kitchen);

    const listening = running && secured === null && act.stage > 0 && act.effort < .6;
    stepTrader(trader, { running, fear, leaving: secured !== null, time, listening, hurry: kitchen.crashed, pace: reduced ? 0.25 : 1 }, dt);
    if (fresh) trader.hush = listening || trader.mode === 'caught' ? 1 : 0;
    stepKitchen(kitchen, { running, multiplier, fear, time, traderGone: trader.mode !== 'hunch' && trader.mode !== 'caught', reduced, traderUp: trader.mode === 'upstairs' }, dt);
    const ev = kitchen.events;
    if (ev.thump && !reduced) shake = Math.max(shake, 0.28);
    // He reacts at the desk: a look down at her texts, a jump and a glance at the stairs on a thump, the elbow on the mug.
    if (ev.her) cueTrader(trader, 'text');
    if (ev.thump) cueTrader(trader, ev.flicker ? 'flicker' : 'thump');
    if (ev.creak || ev.peek) cueTrader(trader, 'stairs');
    if (ev.mug) cueTrader(trader, 'mug');
    if (!fresh && !muted) {
      // The kitchen's own events, each a cue: her texts, the ceiling, the mug, the stairs, the ring, the fridge, the door.
      if (ev.text) audio.fx('notify', 0.8);
      if (ev.thump) audio.fx('stomp', 0.55 + 0.45 * fear);
      if (ev.step) audio.fx('stomp', kitchen.harmless ? 0.4 : 0.9);
      if (ev.mugHit) audio.fx('shatter', 0.7);
      if (ev.creak) audio.fx('creak', 0.4);
      if (ev.peek) audio.fx('creak', 0.8);
      if (ev.ring) audio.fx('coin', 1);
      if (ev.letter) audio.fx('clang', 0.35);
      if (ev.photo) audio.fx('thud', 0.6);
      if (ev.door) audio.fx('door', 1);
      if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
      // A heartbeat under the music while he sits there exposed, quickening with the tension.
      if (running && !secured && trader.mode === 'hunch' && multiplier >= 1.2) {
        pulse += dt;
        if (pulse >= mix(1.4, 0.35, tension)) {
          pulse = 0;
          audio.fx('heartbeat', 0.18 + 0.3 * tension);
        }
      } else pulse = 0;
    }
    // The HUD and the camera run on real time, so the payoff word and the punch-in land during the held frame.
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, real);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, real);
    punchHold = Math.max(0, punchHold - real);
    if (punchHold > 0) stepSpring(punch, 1, 16, 0.75, real);
    else stepSpring(punch, 0, 6, 0.9, real);
    const nextCaption = captionFor(view, multiplier, outcome, trader, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, real);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);
    // The act props stay for the round and run out over a crash or a cash-out.
    const actLive = running && secured === null && !kitchen.crashed;
    if (actLive) shownAct = act;
    actFade = fresh ? (actLive ? 1 : 0) : actFade + ((actLive ? 1 : 0) - actFade) * (1 - Math.exp(-(actLive ? 4 : 5) * dt));
    cut = Math.max(0, cut - real / 0.35);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the man caught at the laptop, holds, and eases back out.
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    const glow = trader.lid.x > 0.8 ? 'off' : kitchen.chartDead ? 'red' : 'green';
    drawRoom(ctx, kitchen, reduced ? 0 : time);
    drawLaptop(ctx, kitchen, trader.lid.x, time, fear);
    drawTrader(ctx, trader, glow, time, fear);
    drawMid(ctx, kitchen, multiplier, time, !isPortrait(ctx.canvas));
    if (actFade > 0.01) drawAct(ctx, shownAct, actFade);
    drawFront(ctx, kitchen);
    drawGlow(ctx, trader.lid.x, kitchen.chartDead);
    drawLight(ctx, kitchen);
    drawVignette(ctx, trader.lid.x);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 250);
      ctx.rotate(-0.08);
      const scale = clamp(pop.x, 0, 1.25);
      ctx.scale(scale, scale);
      const word = outcome === 'called' ? 'SHE NEVER KNEW' : outcome === 'rekt' ? 'WIFE CHANGED' : 'NGMI';
      memeText(ctx, word, 0, 0, outcome === 'called' ? 64 : 78, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center', 640);
      ctx.restore();
    }
    ctx.restore();
    if (cut > 0) {
      ctx.fillStyle = `rgba(8, 6, 10, ${cut * cut * (3 - 2 * cut)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // Reserve the multiplier's measured width so rare six-digit rounds do not cover the caption.
    const readout = `${multiplier.toFixed(2)}×`;
    ctx.font = `900 58px ${MEME_FONT}`;
    const readoutWidth = Math.min(290, ctx.measureText(readout).width);
    const captionRight = 936 - readoutWidth - 24;
    const captionCentre = Math.min(470, (30 + captionRight) / 2);
    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(captionCentre, 64);
      const scale = 1 + 0.08 * captionPop.x;
      ctx.scale(scale, scale);
      memeText(ctx, caption, 0, 0, 40, '#ffffff', 'center', Math.min(620, 2 * (captionRight - captionCentre) / scale));
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(470, 108);
      ctx.scale(clamp(badge.x, 0, 1.2), clamp(badge.x, 0, 1.2));
      memeText(ctx, text, 0, 0, 24, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'spectator' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    memeText(ctx, readout, 936, 78, 58, colour, 'right', 290);
    const pct = Math.round(clamp(kitchen.meter.x, 0, 1) * 100);
    const meterWord = pct >= 78 ? 'WIFE CHANGING' : pct >= 45 ? 'LIFE CHANGING' : 'COPING';
    memeText(ctx, `${meterWord} ${pct}%`, 24, 518, 24, outcome ? '#ffb4c2' : '#f0e6c8', 'left');
    memeText(ctx, `MUGS ${visibleMugs(multiplier)}`, 936, 518, 22, '#f0e6c8', 'right');
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, "LATEST MESSAGE", kitchen.bubbles.at(-1)?.text ?? 'Just one more trade.', view.cashoutX100 !== null ? trader.mode === 'upstairs' ? [635, 110, 325, 385] : [Math.max(0, Math.min(560, trader.x - 175)), Math.max(0, trader.y - 280), 400, 320] : undefined);

  }

  return { draw };
}

function holdMeter(k: Kitchen): void {
  k.holding = true;
}
