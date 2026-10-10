/**
 * Composes The Wake from the round: the parlor at half past four, the Crypto Celebrant's eulogy on the
 * displayed multiplier, the family and the mourners reacting, the cousin (the player) slipping out of the
 * side door on an accepted exit, the crash as eight beats on the crash clock (the buzz, the dark lasers, the
 * ribbons, the empty ledger, the widow's chair, the guest book, the hearse, the dog), a crash after the exit
 * played small on the cousin's phone in the rideshare, the blink to black into the next round, the cues and
 * the HUD. Everything follows the SceneView and the frame time; nothing here reads or changes the committed
 * outcome (the crash point is used only once the crash has happened, to seed the order things fall in).
 */
import { pageAudio } from './audio';
import {
  BACK, type Cast, type CastDrive, COUSIN, cousinAt, createCast, DOG, drawCelebrant, drawCelebrantArms, drawCousin,
  drawDog, drawFlorist, drawFriend, drawMother, drawMourner, drawSon, drawWidow, drawYouTag, EXIT_AT, FLORIST, FRONT,
  HOLD_AT, ledgerClose, mournersOf, mouthOf, resetCast, settleCast, stepCast, takenBy, WIDOW_AT, widowDepth,
} from './folk';
import { BUBBLE_FONT, drawBubble, memeText, THOUGHT_FONT, wrap } from './ink';
import { BADGE, BETTING_LINE, CAPTIONS, CRASH_LINES, EXIT_LINE, LADDER, OVERTIME, REGRET, RUNGS, STAMP, TITLE } from './lines';
import { clamp, settleSpring, smoothstep, spring, stepSpring } from './motion';
import {
  CRASH_AT, crashParlor, createParlor, drawBackdrop, drawBasket, drawCasket, drawCoda, drawDoor, drawGuestBook,
  drawLectern, drawLedger, drawLight, drawMoth, drawNotification, drawPortraitFilter, drawReception, drawVase,
  drawWindow, drawWreath, type Parlor, type ParlorDrive, resetParlor, settleParlor, STAND, stepParlor,
} from './parlor';
import { createPortrait } from './portrait';
import { drawCarBehind, drawCarFront, SCREEN, screenTransform } from './ride';
import {
  bubbleAlpha, createScript, hush, lastLine, resetScript, say, type Script, settleLine, settleScript, stepScript,
  talking,
} from './script';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** The displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running; held at the crash time. */
  elapsed: number;
  /** Milliseconds since the crash. */
  crashAge: number;
  /** The player's stake in valueless credits, or null when watching. */
  stake: number | null;
  /** Non-null only after the backend confirms this player's cash-out. */
  cashoutX100: number | null;
  payout: number | null;
}
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose?(): void;
}

type Outcome = 'rekt' | 'dodged' | 'watched';

const COLOURS = { accent: '#f2c46b', bad: '#ff4d6d', good: '#7cf67c' };

// ─── Crash feel ─────────────────────────────────────────────────────────────────────────────────────────
const FREEZE_S = 0.15;
const SLOW_S = 0.45;
const SLOW_RATE = 0.3;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.08;
/** The camera punches in on the phone in the casket. */
const PUNCH_AT = { x: 468, y: 236 } as const;
/** The blink to black that covers the parlor resetting for the next round. */
const WIPE_S = 0.45;
/**
 * The crash's final image is complete by this much crash time (seconds). A live crash keeps playing into the
 * next betting phase (the encore) until then, for at most ENCORE_MAX_S, because the room moves on after ~2 s.
 */
const ENDING_S = 5.4;
const ENCORE_MAX_S = 3.5;
/** The choreography clock: crash time held back by the hit-stop (frozen, then a third speed), as a closed form. */
const crashWarp = (s: number): number => (s <= FREEZE_S ? 0 : s <= FREEZE_S + SLOW_S ? (s - FREEZE_S) * SLOW_RATE : s - FREEZE_S - SLOW_S * (1 - SLOW_RATE));

/** The casket phone's battery: 4% at 1×, 1% at 10×, and it never quite dies until the crash. */
const batteryAt = (multiplier: number): number => clamp(Math.ceil(4 - 3 * Math.log10(Math.max(1, multiplier)) - 1e-9), 1, 4);

/** Where each speaker's bubble goes: near the speaker, clear of faces and of the HUD, inside the frame. */
function placeBubble(ctx: CanvasRenderingContext2D, who: string, text: string, thought: boolean, cd: CastDrive, top: number) {
  const width = who === 'celebrant' ? 330 : who === 'widow' ? 300 : 250;
  ctx.font = thought ? THOUGHT_FONT : BUBBLE_FONT;
  const lines = wrap(ctx, text, width - 28);
  const w = Math.min(width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28);
  const h = lines.length * 21 + 16;
  const mouth = mouthOf(who, cd);
  let x = mouth.x;
  let y = mouth.y;
  let tail = mouth;
  switch (who) {
    case 'celebrant':
      x = 690;
      y = 198 - h / 2;
      tail = { x: mouth.x - 20, y: mouth.y - 48 };
      break;
    case 'mother':
      x = 214;
      y = 300;
      tail = { x: mouth.x - 4, y: mouth.y - 18 };
      break;
    case 'son':
      x = 560;
      y = 300;
      tail = { x: mouth.x - 2, y: mouth.y - 16 };
      break;
    case 'friend':
      x = 486;
      y = 540 - h / 2 - 6;
      tail = { x: mouth.x - 18, y: mouth.y + 4 };
      break;
    case 'widow':
      x = 340;
      y = 296;
      tail = { x: mouth.x - 16, y: mouth.y - 2 };
      break;
    case 'cousin':
      x = mouth.x + 40;
      y = mouth.y - 104;
      tail = { x: mouth.x + 18, y: mouth.y - 64 };
      break;
  }
  x = clamp(x, w / 2 + 6, 954 - w / 2);
  y = clamp(y, top + h / 2, 536 - h / 2);
  return { x, y, tail, width, w, h };
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'static', bpm: 64, tempoRise: 0.3 });
  const { capture, present } = createPortrait(TITLE, [292, 66, 600, 450], COLOURS.accent, 'SLIPPED OUT', 'LIVE FROM THE PARLOR');
  const script: Script = createScript(LADDER, OVERTIME);
  const parlor: Parlor = createParlor();
  const cast: Cast = createCast();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const door = spring(0);
  let last: number | null = null;
  let time = 0;
  /** The ambient clock: idle motion; it stops once the crash's final image is reached. */
  let amb = 0;
  let previous: SceneView['phase'] | null = null;
  let secured: { x100: number; payout: number | null } | null = null;
  /** Seconds since the exit was confirmed; large when it was confirmed before this scene saw it. */
  let exitAge = 0;
  let exitLive = false;
  let outcome: Outcome | null = null;
  let crashed = false;
  /** Seconds since the crash (the view's crash age, carried on through the encore), and the choreography clock from it. */
  let crashClock = 0;
  let ct = 0;
  /** Seconds into the encore after the room has moved on to betting, or -1. */
  let encore = -1;
  /** The live speech bubbles' boxes this frame, so the outcome stamp can stay clear of them. */
  const bubbleBoxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  let crashX = 100;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues. */
  let muted = false;
  let regret = 0;
  let crashLine = 0;
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  let shake = 0;
  let wipe = 0;
  let pulse = 0;
  let caption = '';
  let bettingSaid = false;
  let lastRung = 0;

  function reset(): void {
    resetScript(script);
    resetParlor(parlor);
    resetCast(cast);
    secured = null;
    exitAge = 0;
    exitLive = false;
    outcome = null;
    crashed = false;
    muted = false;
    crashClock = ct = 0;
    encore = -1;
    regret = crashLine = lastRung = 0;
    freeze = slow = punchHold = shake = pulse = 0;
    bettingSaid = false;
    settleSpring(pop, 0);
    settleSpring(badge, 0);
    settleSpring(punch, 0);
    settleSpring(door, 0);
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    crashed = true;
    crashX = view.currentX100;
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    // The cousin is in the rideshare by now: the parlor on the phone shows the spot by the door empty.
    if (secured && exitAge < 10) exitAge = 10;
    crashParlor(parlor, view.currentX100);
    hush(script);
    // What was being said stops: the buzz cuts the eulogy off.
    for (const b of script.bubbles) b.life = Math.min(b.life, b.age + 0.9);
    crashClock = view.crashAge / 1000;
    ct = crashWarp(crashClock);
    if (quiet) {
      // Met late: the aftermath as it stands, its line already said, no stinger.
      muted = true;
      script.bubbles = [];
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= ct) crashLine += 1;
      const line = CRASH_LINES[crashLine - 1];
      if (line) settleLine(script, line[1], Math.max(0.6, ct - line[0]));
      settleSpring(pop, 1);
      audio.crash('static', true);
      return;
    }
    freeze = FREEZE_S;
    slow = SLOW_S;
    punchHold = PUNCH_HOLD_S;
    shake = 1;
    settleSpring(punch, 1);
    audio.crash('static');
    audio.fx('buzz', 1);
    audio.fx('notify', 0.8);
  }

  function draw(ctx: CanvasRenderingContext2D, input: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The encore: a crash this scene saw live plays on into the next betting phase until its ending is complete,
    // drawn as the crash (its multiplier, its caption, its stamp) on the crash clock carried on in real time.
    if (encore >= 0) {
      encore += real;
      crashClock += real;
    } else if (crashed && !muted && previous === 'crashed' && (input.phase === 'betting' || input.phase === 'waiting') && crashClock < ENDING_S) encore = 0;
    let view = input;
    if (encore >= 0) {
      if (input.phase === 'running' || crashClock >= ENDING_S || encore >= ENCORE_MAX_S) {
        encore = -1;
        wipe = 1;
        reset();
        previous = input.phase;
      } else view = { ...input, phase: 'crashed', currentX100: crashX, crashAge: crashClock * 1000 };
    } else if (input.phase === 'crashed') crashClock = input.crashAge / 1000;
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
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×.
    const tension = 1 - 1 / multiplier;
    const running = view.phase === 'running';
    const fresh = previous === null;

    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running && !fresh && !crashed) {
        // Seen live: the cousin slips out from here.
        exitAge = 0;
        exitLive = true;
        say(script, EXIT_LINE, true, true);
        audio.cashout();
      } else exitAge = 99;
    }

    if (fresh) {
      previous = view.phase;
      if (view.phase === 'running' || view.phase === 'crashed') {
        settleScript(script, multiplier);
        const settleDrive = drives(multiplier, tension, view.phase === 'running');
        settleParlor(parlor, settleDrive.pd, view.elapsed / 1000);
        settleCast(cast, settleDrive.cd);
        if (secured) {
          badge.x = 1;
          // The regret lines already passed are not replayed.
          while (regret < REGRET.length && (multiplier / secured.x100) * 100 >= REGRET[regret]![0]) regret += 1;
        }
      }
      if (view.phase === 'crashed') beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (view.phase === 'crashed' && !crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting' || view.phase === 'waiting') {
        if (crashed || script.next > 0) wipe = 1;
        reset();
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);

    if (view.phase === 'betting' && !bettingSaid) {
      bettingSaid = true;
      say(script, BETTING_LINE, true);
    }
    const prevExit = exitAge;
    if (secured) {
      exitAge += dt;
      const past = view.currentX100 / secured.x100;
      if (running && !crashed) while (regret < REGRET.length && past >= REGRET[regret]![0]) say(script, REGRET[regret++]![1]);
    }
    const prevCt = ct;
    if (crashed) {
      ct = crashWarp(crashClock);
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= ct) say(script, CRASH_LINES[crashLine++]![1], true, true);
    }
    // The final image holds: once the dog has tilted his head, nothing else moves.
    if (!(crashed && ct >= HOLD_AT)) amb += dt;
    const live = running && !crashed;
    stepScript(script, multiplier, dt, live);
    const { pd, cd } = drives(multiplier, tension, live);

    // ─── The set and the cast ───
    const said = script.events.map((l) => l.who);
    const beats = script.events.map((l) => l.beat ?? '');
    stepParlor(parlor, pd, dt);
    stepCast(cast, cd, said, beats, dt);
    const doorWanted = secured && exitAge >= EXIT_AT.open[0] && exitAge < EXIT_AT.open[1] ? 1 : 0;
    stepSpring(door, doorWanted, 7, 0.75, dt);

    // ─── Cues: only on edges this scene saw, never for a settled aftermath ───
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (!fresh && live && rung > lastRung) {
      // The bell tolls; the widow's veil shivers (soft fabric).
      audio.milestone(rung);
      audio.fx('whoosh', 0.06);
      cast.veil.v += 26;
    }
    lastRung = rung;
    if (!fresh && !muted) {
      for (const line of script.events) audio.fx(line.thought ? 'bubble' : line.who === 'celebrant' ? 'whoosh' : 'pop', line.who === 'celebrant' ? 0.3 : 0.35);
      if (parlor.events.flip) audio.fx('whoosh', 0.12);
      if (cast.events.glance > 0) audio.fx('tick', 0.35);
      if (exitLive) {
        const crossed = (at: number) => prevExit < at && exitAge >= at;
        if (crossed(1.8) || crossed(2.05)) audio.fx('beep', 0.6);
        if (crossed(EXIT_AT.open[0])) audio.fx('door', 0.6);
        if (crossed(EXIT_AT.grab[2])) audio.fx('click', 0.4);
      }
      if (crashed) {
        const crossed = (at: number) => prevCt < at && ct >= at;
        // One buzz, then silence, then the lawn chair unfolding.
        if (crossed(WIDOW_AT.unfold[0] + 0.05)) audio.fx('creak', 0.9);
      }
      if (live) {
        // A heartbeat under the organ, quickening with the tension, until the exit.
        const beat = 1.4 - 1.05 * tension;
        if (!secured && (pulse += dt) >= beat) {
          pulse -= beat;
          audio.fx('heartbeat', 0.15 + 0.3 * tension);
        }
      }
    }

    // The outcome stamp lands once the first beats have played (straight away on a settled aftermath).
    stepSpring(pop, outcome && (crashClock >= 1.4 || muted) ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold = Math.max(0, punchHold - real);
    if (punchHold === 0) stepSpring(punch, 0, 9, 0.85, real);
    shake = Math.max(0, shake - real / 0.5);
    const nextCaption = captionFor(view, script.caption, secured, exitAge, outcome, crashClock);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);

    // ─── The picture ───
    const battery = crashed && ct >= CRASH_AT.dark ? 0 : batteryAt(multiplier);
    const small = outcome === 'dodged' ? smoothstep(0.02, 0.5, ct) : 0;
    const badgeUp = secured !== null && badge.x > 0.02;
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    if (punch.x > 0.005) {
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      const at = small > 0 ? { x: SCREEN.x, y: SCREEN.y } : PUNCH_AT;
      ctx.translate(at.x, at.y);
      ctx.scale(k, k);
      ctx.translate(-at.x, -at.y);
    }
    if (small > 0.001) {
      // Played small: the wake streaming on the cousin's phone in the back of the rideshare.
      drawCarBehind(ctx, small, amb);
      const tf = screenTransform(small);
      ctx.save();
      ctx.beginPath();
      ctx.rect(tf.x, tf.y, 960 * tf.s, 540 * tf.s);
      ctx.clip();
      ctx.translate(tf.x, tf.y);
      ctx.scale(tf.s, tf.s);
      drawParlor(ctx, pd, cd, battery, badgeUp);
      ctx.restore();
      drawCarFront(ctx, small, amb, 214 + Math.floor(multiplier * 3));
    } else drawParlor(ctx, pd, cd, battery, badgeUp);
    ctx.restore();
    if (wipe > 0) {
      wipe = Math.max(0, wipe - real / WIPE_S);
      ctx.fillStyle = `rgba(10, 6, 10, ${clamp(wipe * 1.6, 0, 1)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // ─── The HUD ───
    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(410, 58);
      const s = 1 + 0.08 * captionPop.x;
      ctx.scale(s, s);
      memeText(ctx, caption, 0, 0, caption.length > 26 ? 30 : 38, '#ffffff', 'center', 520);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(430, 98);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      memeText(ctx, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× ${BADGE}`, 0, 0, 22, COLOURS.good, 'center', 560);
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'watched' ? COLOURS.bad : running ? '#ffffff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 70, 54, colour, 'right', 230);
    // The casket phone's battery, which nobody in the room can see.
    if (view.phase === 'running' || view.phase === 'crashed') {
      const low = battery <= 2;
      memeText(ctx, `HIS PHONE ${battery}%`, 936, 526, 22, battery === 0 ? '#9a9aa6' : low ? '#ffb4c2' : '#f3e9d6', 'right', 260);
    }
    if (outcome && pop.x > 0.02) drawStamp(ctx, outcome, clamp(pop.x, 0, 1.25), bubbleBoxes);
    const detail = small > 0.5 ? [SCREEN.x - SCREEN.w / 2 - 20, SCREEN.y - SCREEN.h / 2 - 20, SCREEN.w + 40, SCREEN.h + 40] : crashed ? [270, 64, 520, 390] : exitLive && exitAge < 9.5 ? (exitAge < 4.8 ? [0, 150, 480, 360] : [60, 60, 320, 240]) : undefined;
    const fallback = crashed ? 'PUSH NOTIFICATION: DEV SOLD. Liquidity gone.' : secured ? 'The wake goes on without you. You took the candle.' : 'Visitation at half past four. The lilies wait. Gerald waits.';
    present(ctx, view, caption, `HIS PHONE ${battery}%`, lastLine(script)?.text ?? fallback, detail);
  }

  /** The drive objects for the set and the cast at this multiplier. */
  function drives(multiplier: number, tension: number, live: boolean): { pd: ParlorDrive; cd: CastDrive } {
    const c = crashed ? ct : -1;
    const e = secured ? exitAge : -1;
    return {
      pd: { multiplier, tension, live, amb, ct: c, exitAge: e },
      cd: { time, amb, tension, multiplier, live, ct: c, exitAge: e, talk: (who: string) => talking(script, who) },
    };
  }

  /** The parlor, back to front: the set, the casket, the celebrant, everyone in depth order, the crash props, the light, the bubbles. */
  function drawParlor(ctx: CanvasRenderingContext2D, pd: ParlorDrive, cd: CastDrive, battery: number, badgeUp: boolean): void {
    drawBackdrop(ctx);
    drawWindow(ctx, parlor, pd);
    drawDoor(ctx, door.x);
    drawPortraitFilter(ctx, pd);
    drawVase(ctx, parlor, pd);
    drawWreath(ctx, parlor, pd, 0);
    drawWreath(ctx, parlor, pd, 1);
    drawCasket(ctx, parlor, pd, battery);
    drawBasket(ctx);
    drawCelebrant(ctx, cast, cd);
    drawLectern(ctx);
    drawLedger(ctx, pd.ct >= 0 ? ledgerClose(pd.ct) : 0);
    drawCelebrantArms(ctx, cast, cd);
    // Everyone else, farthest first.
    const items: { y: number; draw: () => void }[] = [
      { y: DOG.y, draw: () => drawDog(ctx, cast, cd) },
      { y: widowDepth(pd.ct) + 0.5, draw: () => drawWidow(ctx, cast, cd) },
      { y: FRONT.floor, draw: () => drawMother(ctx, cast, cd) },
      { y: FRONT.floor, draw: () => drawSon(ctx, cast, cd, crashed ? crashX / 100 : null) },
      { y: STAND.floor, draw: () => drawGuestBook(ctx, parlor, pd) },
      { y: BACK.floor + 0.5, draw: () => drawFriend(ctx, cast, cd) },
      { y: FLORIST.floor, draw: () => drawFlorist(ctx, cast, cd) },
      { y: 548, draw: () => drawReception(ctx, pd, takenBy(pd.exitAge >= 0 ? pd.exitAge : -1)) },
      { y: pd.exitAge >= 0 ? cousinAt(pd.exitAge).floor : COUSIN.floor, draw: () => drawCousin(ctx, cast, cd) },
    ];
    for (const m of mournersOf(cast)) items.push({ y: m.floor, draw: () => drawMourner(ctx, m, cd) });
    items.sort((a, b) => a.y - b.y);
    for (const item of items) item.draw();
    drawMoth(ctx, pd);
    drawNotification(ctx, pd);
    drawLight(ctx, pd, pd.ct >= 0 ? smoothstep(0, 2, pd.ct) : 0);
    drawCoda(ctx, pd.ct >= 0 ? smoothstep(CRASH_AT.coda, CRASH_AT.coda + 1.4, pd.ct) : 0);
    drawYouTag(ctx, cast, cd);
    const top = badgeUp ? 112 : 86;
    bubbleBoxes.length = 0;
    for (const b of script.bubbles) {
      const at = placeBubble(ctx, b.line.who, b.line.text, b.line.thought === true, cd, top);
      drawBubble(ctx, b.line.text, at, b.pop.x, bubbleAlpha(b), b.line.thought);
      if (bubbleAlpha(b) > 0.05) bubbleBoxes.push({ x0: at.x - at.w / 2, y0: at.y - at.h / 2, x1: at.x + at.w / 2, y1: at.y + at.h / 2 });
    }
  }

  return { draw };
}

/**
 * The outcome stamp, in two lines: over the empty foot of the aisle, clear of the set's props (under the caption
 * if a live bubble is there); after an exit, under the phone in the rideshare.
 */
function drawStamp(ctx: CanvasRenderingContext2D, outcome: Outcome, scale: number, boxes: readonly { x0: number; y0: number; x1: number; y1: number }[]): void {
  const words = STAMP[outcome].split(' ');
  const half = Math.ceil(words.length / 2);
  const lines = outcome === 'dodged' ? [STAMP[outcome]] : [words.slice(0, half).join(' '), words.slice(half).join(' ')];
  const size = outcome === 'dodged' ? 30 : 28;
  let at = outcome === 'dodged' ? { x: 560, y: 486 } : { x: 480, y: 492 };
  if (outcome !== 'dodged' && boxes.some((b) => b.x1 > at.x - 100 && b.x0 < at.x + 100 && b.y1 > at.y - 30 && b.y0 < at.y + 40)) at = { x: 410, y: 116 };
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(-0.07);
  ctx.scale(scale, scale);
  lines.forEach((line, i) => memeText(ctx, line, 0, i * size, size, outcome === 'rekt' ? COLOURS.bad : '#ffe27a', 'center', 380));
  ctx.restore();
}

function captionFor(view: SceneView, said: string, secured: { x100: number } | null, exitAge: number, outcome: Outcome | null, crashClock: number): string {
  if (outcome) {
    if (outcome === 'dodged') return CAPTIONS.dodged;
    if (outcome === 'watched' && crashClock < 1.6) return CAPTIONS.watched;
    return CAPTIONS.crash[Math.floor(crashClock / 1.6) % CAPTIONS.crash.length]!;
  }
  if (view.phase === 'waiting') return CAPTIONS.waiting;
  if (secured) {
    if (view.currentX100 / secured.x100 >= 1.5) return CAPTIONS.kept;
    return CAPTIONS.exit[Math.floor(exitAge / 2.4) % CAPTIONS.exit.length]!;
  }
  return said;
}

