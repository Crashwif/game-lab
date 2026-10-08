import { type ActProps, actAt, actProps, drawAct } from './acts';
import { createPortrait, isPortrait } from './portrait';
/**
 * Composes Gas Fees from the room state: the shaft, the cabin, whoever is
 * in the lobby, the doors, the riders inside, the air, then the HUD. All
 * motion is stepped here with the real frame time, and nothing drawn here
 * changes the committed outcome. The sound is the shared page audio: lift
 * muzak that opens up with the strain, a heartbeat that quickens with it,
 * cues from the cabin's own events, and a trombone at the release.
 */
import { pageAudio } from './audio';
import { CABIN, CAGE_BOX, type Cabin, PPM_ALARMS, PPM_BOX, createCabin, drawCabinBack, drawCabinFront, drawDoors, drawShaft, gasCabin, ppmFor, resetCabin, settleCabin, stepCabin } from './cabin';
import { clamp, mix, spring, stepSpring } from './motion';
import { type Box, type Crowd, DOOR, INK, MAX_PERSONS, type Point, type Suit, crashLines, createCrowd, createSuit, depthFloor, depthScale, drawLines, drawPassenger, drawSuit, leaveLift, persons, releaseSuit, resetCrowd, resetSuit, settleCrash, settleCrowd, settleSuit, stepCrowd, stepSuit } from './riders';

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
  /** Drops the screen shake, the light flicker, the readout's flashing, the hit-stop and the punch-in. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The caption ladder's thresholds, for the milestone dings. */
const RUNGS = [1.3, 1.7, 2.3, 3.2, 4.8, 6.5, 10, 20];
/** The cable creaks (and the cabin sags on it) as the number passes each of these. */
const CREAKS = [1.2, 1.42, 1.75, 2.15, 2.8, 4.2, 6.5];
/** The release: the picture holds while the camera punches in on him and stays there a beat, then the cloud opens in slow motion before time catches up. */
const FREEZE_S = 0.16;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.1;
const SLOW_S = 0.35;
const SLOW_RATE = 0.3;
/** The end of a round fades out over the next one's betting rather than vanishing in a frame. */
const FADE_S = 0.45;
type Outcome = 'rekt' | 'called' | 'leak';
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

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["EXPRESS LIFT TO NOWHERE", "THE CANARY WANTS A TRANSFER", "ANOTHER FLOOR, SAME AIR", "VENTILATION NOT FOUND", "THE PIZZA IS GETTING COLD", "MAXIMUM CLENCH OVERTIME", "WHO PRESSED EVERY BUTTON", "STILL NOT MY FLOOR"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'HE WHO SMELT IT' : outcome === 'called' ? 'DEALT IT, DODGED IT' : 'TX FAILED, GAS STILL CHARGED';
  if (view.phase !== 'running') return 'GOING UP?';
  if (secured) {
    // Off at his floor while the lift goes on without him: the jeet's regret ladder, and still the right call.
    const after = multiplier / (secured.x100 / 100);
    return after < 1.2 ? 'THIS IS MY FLOOR' : after < 1.6 ? 'TOOK PROFITS, TOOK THE STAIRS' : after < 2.5 ? 'JEETED. FRESH AIR THOUGH' : 'PAPER HANDS, CLEAN LUNGS';
  }
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (multiplier < 1.3) return 'HOLD IT';
  if (multiplier < 1.7) return 'CLENCH';
  if (multiplier < 2.3) return 'CHEEKS ARE STAKED';
  if (multiplier < 3.2) return 'HODL IT IN';
  if (multiplier < 4.8) return 'DIAMOND CHEEKS';
  if (multiplier < 6.5) return 'WHALE ALERT';
  if (multiplier < 10) return 'THE CANARY KNOWS';
  if (multiplier < 20) return 'GAS GAS GAS';
  return 'PRIORITY FEE: MAXIMUM';
}

export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait("GAS FEES", [190, 82, 580, 425], '#f0d99c');
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'elevator', crash: 'trombone' });
  const cabin: Cabin = createCabin(reduced ? 0 : 1);
  const crowd: Crowd = createCrowd();
  const suit: Suit = createSuit();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch toward the suit at the release, and how long it holds there. */
  const punch = spring(0);
  let punchAt: Point = { x: 480, y: 300 };
  let punchHold = 0;
  /** The act's props, each eased in and out; the fan's integrated angle; how hard the vent blows, smoothed. */
  let actShow: ActProps = { vent: 0, wisp: 0, fan: 0, rattle: 0, button: 0 };
  let actSpin = 0;
  let draught = 0;
  /** Seconds to his next heartbeat while he holds it. */
  let beatIn = 0;
  let fadeFrom: HTMLCanvasElement | null = null;
  let fadeAge = FADE_S;
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let freeze = 0;
  let slow = 0;
  let notches = 0;
  let alarms = 0;
  let gasped = false;
  let whistled = false;

  function suitOrigin(): Point {
    if (suit.mode === 'gone' || suit.mode === 'leaving') return { x: DOOR.x, y: DOOR.y - 10 };
    const s = depthScale(suit.depth);
    return { x: suit.x, y: depthFloor(suit.depth) - 80 * s };
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the cloud opens slow before time catches up.
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
    const act = actAt(view.elapsed, reduced);
    // The strain: a third of the way at 1.5×, half at 2×, two thirds at 3×, 0.9 at 10×. `surge` is the slow, logarithmic
    // driver past that (0 at 3×, 1 at 1000×), so a long round keeps changing. The acts never ease either.
    const tension = clamp(1 - 1 / multiplier, 0, 1);
    const surge = clamp((Math.log10(multiplier) - 0.5) / 2.5, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) audio.cashout();
    }

    const first = previous === null;
    if (first) {
      resetCabin(cabin);
      resetCrowd(crowd);
      resetSuit(suit);
      if (running || crashed) {
        // A round already under way (the page opened mid-round, or missed its betting): the lift, the crowd and
        // the suit go straight to what the multiplier and the bet call for, with nothing replayed on the way.
        settleCrowd(crowd, multiplier);
        settleSuit(suit, tension, crowd.squeeze.x, secured !== null);
        settleCabin(cabin, running, tension, multiplier, surge);
        notches = CREAKS.filter((c) => multiplier >= c).length;
        alarms = PPM_ALARMS.filter((a) => ppmFor(multiplier) >= a).length;
        if (secured) badge.x = 1;
        if (running && !secured) actShow = actProps(act);
      }
    }
    if (view.phase !== previous) {
      if (crashed && !cabin.gassed) {
        // A crash met on the scene's first frame, or seen late, shows its aftermath rather than the burst.
        const quiet = first || view.crashAge > 1500;
        outcome = view.stake === null ? 'leak' : secured ? 'called' : 'rekt';
        const origin = suitOrigin();
        releaseSuit(suit, quiet);
        gasCabin(cabin, view.currentX100, origin, quiet);
        if (quiet) {
          pop.x = 1;
          settleCrash(crowd);
          gasped = whistled = true;
          audio.crash('trombone', true);
        } else {
          shake = 1;
          pop.v = 16;
          punchAt = origin;
          if (!reduced) {
            freeze = FREEZE_S;
            slow = SLOW_S;
            punchHold = FREEZE_S + PUNCH_HOLD_S;
          }
          crashLines(crowd, view.currentX100);
          audio.crash('trombone');
          audio.fx('hiss', 1);
        }
      }
      if (view.phase === 'betting') {
        // Keep the last picture of the round to fade out over the fresh lift.
        if (previous !== null && typeof document !== 'undefined') {
          fadeFrom ??= document.createElement('canvas');
          fadeFrom.width = ctx.canvas.width;
          fadeFrom.height = ctx.canvas.height;
          fadeFrom.getContext('2d')?.drawImage(ctx.canvas, 0, 0);
          fadeAge = 0;
        }
        resetCabin(cabin);
        resetCrowd(crowd);
        resetSuit(suit);
        outcome = null;
        secured = null;
        freeze = slow = punchHold = 0;
        beatIn = 0;
        notches = 0;
        alarms = 0;
        gasped = whistled = false;
      }
      previous = view.phase;
    }
    const wasLeaving = suit.mode === 'leaving' || suit.mode === 'gone';
    if (secured && running) leaveLift(suit);
    audio.update(view.phase, tension);

    stepCrowd(crowd, { running, multiplier, tension, suitX: suit.x, gassed: cabin.gassed, gasAge: cabin.gasAge }, dt);
    stepSuit(suit, { running, tension, squeeze: clamp(crowd.squeeze.x, 0, 1) }, dt);
    const justLeft = !wasLeaving && suit.mode === 'leaving';
    const suitDoors = suit.mode === 'leaving' || (suit.mode === 'gone' && suit.modeAge < 1.3);
    const doorsOpen = !running && !crashed ? true : crowd.doorTimer > 0 || suitDoors;
    stepCabin(cabin, { running, tension, multiplier, doorsOpen, arrived: crowd.events.arrived !== null || justLeft, reduced, surge }, dt);
    if ((crowd.events.arrived || justLeft) && !reduced) shake = Math.max(shake, 0.25);
    // Cues from the cabin's own events: the bell, the cable, the readout's alarm, the release and its aftermath.
    if (crowd.events.arrived) audio.fx('bell', 0.8);
    if (justLeft) { audio.fx('bell', 1); audio.fx('door', 0.8); }
    if (running) {
      const notch = CREAKS.filter((c) => multiplier >= c).length;
      if (notch > notches) {
        audio.fx('creak', 0.4 + 0.5 * tension);
        // The cable gives a little: the cabin sags on it and the cage rocks. A fake-out, keyed to the number only.
        if (!reduced) { cabin.bounce.v += 30 + 20 * tension; cabin.canary.swing.v += 0.9; }
      }
      notches = Math.max(notches, notch);
      const alarm = PPM_ALARMS.filter((a) => ppmFor(multiplier) >= a).length;
      if (alarm > alarms) audio.fx('beep', 0.55 + 0.2 * alarm);
      alarms = Math.max(alarms, alarm);
      audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
      // His heartbeat while he holds it: every 1.4 s at the start, 0.88 s at 2×, 0.7 s at 3×, 0.35 s at the top. Not once he is off.
      if (!secured) {
        beatIn -= dt;
        if (beatIn <= 0) { audio.fx('heartbeat', 0.35 + 0.4 * tension); beatIn = mix(1.4, 0.35, tension); }
      }
    }
    if (cabin.events.canaryDrop) audio.fx('thud', 0.35);
    if (cabin.gassed && !gasped && cabin.gasAge > 0.4) { gasped = true; audio.fx('gasp', 0.9); }
    if (suit.mode === 'released' && !whistled && suit.modeAge > 0.9) { whistled = true; audio.fx('whistle', 0.7); }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    // The punch runs on real time, so the camera moves in on him while the picture is held.
    punchHold = Math.max(0, punchHold - real);
    stepSpring(punch, punchHold > 0 ? 1 : 0, punchHold > 0 ? 40 : 7, punchHold > 0 ? 0.8 : 0.9, real);
    // The act's props ease in and out (gone at a crash or a cashout), and the fan spins up with the draught.
    const actOn = running && view.cashoutX100 === null ? 1 : 0;
    const target = actProps(act, actOn);
    const ease = 1 - Math.exp(-dt / 0.35);
    for (const key of Object.keys(target) as (keyof ActProps)[]) actShow[key] += (target[key] - actShow[key]) * ease;
    if (actOn) draught += (act.draught - draught) * (1 - Math.exp(-dt / 0.4));
    if (!reduced) actSpin = (actSpin + dt * (1.5 + 9 * draught) * actShow.fan) % (Math.PI * 2);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 6 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the culprit and eases back out.
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(punchAt.x, punchAt.y);
      ctx.scale(k, k);
      ctx.translate(-punchAt.x, -punchAt.y);
    }
    drawShaft(ctx, cabin);
    drawCabinBack(ctx, cabin);
    // Whoever is still in the lobby: arriving passengers and the suit once he is out.
    ctx.save();
    ctx.translate(0, cabin.bounce.x);
    for (const p of crowd.list) if (p.depth > 1) drawPassenger(ctx, p, suit.x, time, reduced);
    if (suit.depth > 1) drawSuit(ctx, suit, reduced ? 0 : time, reduced);
    ctx.restore();
    const yourFloor = secured !== null && suitDoors;
    const indicator = crashed ? 'DUMPED' : yourFloor ? 'YOUR FLOOR' : running ? `${multiplier.toFixed(2)}× UP` : 'GOING UP?';
    drawDoors(ctx, cabin, indicator, crashed, persons(crowd) - (suit.mode === 'gone' ? 1 : 0), MAX_PERSONS, yourFloor);
    ctx.save();
    ctx.translate(0, cabin.bounce.x);
    const inside = crowd.list.filter((p) => p.depth <= 1).map((p) => ({ depth: p.depth, draw: () => drawPassenger(ctx, p, suit.x, time, reduced) }));
    if (suit.depth <= 1) inside.push({ depth: suit.depth, draw: () => { drawSuit(ctx, suit, reduced ? 0 : time, reduced); } });
    inside.sort((a, b) => b.depth - a.depth);
    for (const r of inside) r.draw();
    ctx.restore();
    drawCabinFront(ctx, cabin);
    ctx.save();
    ctx.translate(0, cabin.bounce.x);
    drawAct(ctx, act, actShow, actSpin, draught);
    ctx.restore();
    // The bubbles keep out from under the outcome stamp at rest: six slices of it, each as high as the tilt has it there.
    const stamp = outcome === 'rekt' ? 'RIPPED' : outcome === 'called' ? 'CROP DUSTED' : 'GAS LEAK';
    const stampSize = outcome === 'called' ? 78 : 96;
    const avoid: Box[] = [{ ...CAGE_BOX, y: CAGE_BOX.y + cabin.bounce.x }, { ...PPM_BOX, y: PPM_BOX.y + cabin.bounce.x }];
    if (outcome) {
      ctx.font = `900 ${stampSize}px ${MEME_FONT}`;
      const half = ctx.measureText(stamp).width / 2 + 6;
      for (let i = 0; i < 6; i += 1) {
        const u = -half + (i + 0.5) * (half / 3);
        const y = 290 - u * Math.sin(0.1);
        avoid.push({ x: 480 + u - half / 6, y: y - stampSize * 0.8 - 8 - (half / 6) * Math.sin(0.1), w: half / 3, h: stampSize * 0.9 + 16 });
      }
    }
    if (!isPortrait(ctx.canvas)) drawLines(ctx, crowd, suit, cabin.bounce.x, { left: CABIN.left + 6, right: CABIN.right - 6, top: 96 }, avoid);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 290);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, stamp, 0, 0, stampSize, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(480, 46);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 40, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(480, 514 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    // A long number shrinks to stay clear of the caption.
    const reading = `${multiplier.toFixed(2)}×`;
    ctx.font = `900 52px ${MEME_FONT}`;
    memeText(ctx, reading, 940, 90, Math.min(52, Math.floor((52 * 172) / Math.max(1, ctx.measureText(reading).width))), colour, 'right');
    ctx.restore();
    memeText(ctx, `${Math.round(view.currentX100)} GWEI`, 20, 514, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    memeText(ctx, 'GAS', 20, 90, 30, '#8fd3ff', 'left');
    memeText(ctx, 'FEES', 20, 124, 30, '#8fd3ff', 'left');
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, "IN THE LIFT", crowd.lines.filter((l) => l.delay <= 0).at(-1)?.text ?? 'Nobody is admitting anything.');
    if (fadeFrom && fadeAge < FADE_S) {
      fadeAge += real;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = clamp(1 - fadeAge / FADE_S, 0, 1) ** 2;
      ctx.drawImage(fadeFrom, 0, 0);
      ctx.restore();
    }

  }

  return { draw };
}
