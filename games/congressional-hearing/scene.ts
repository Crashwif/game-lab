/**
 * Composes Congressional Hearing: the committee room, the five senators on the dais in seniority order, the
 * witness's hoodie at the table, the stenographer, the sergeant at arms, the page and the gallery; the dialogue
 * ladder keyed to the displayed multiplier, the minutes stacking on the wall, the exit from the gallery on an
 * accepted cash-out, the crash's beats on the crash clock, the cues, the HUD and the portrait compositor.
 * Tension and every beat key off the displayed multiplier, the round's elapsed time and the crash age; nothing
 * here reads, predicts or changes the committed outcome.
 */
import { type Effect, pageAudio } from './audio';
import {
  createPage, createSenators, createSergeant, createSteno, createWitness, cueSenator, drawPage, drawSenator, drawSenatorDesk, drawSergeant, drawSteno,
  drawWitness, drawWitnessChair, headOf, headTopOf, micWobble, type Page, pageInCrash, raiseLastGavel, resetPage, resetSenators, resetSergeant, resetSteno,
  sendPage, type Senator, sergeantBouquet, settleMissedGavel, settleSenators, stepPage, stepSenators, stepSergeant, stepSteno, stepWitness, tearPage, type Witness,
} from './cast';
import { applaud, createGallery, drawCorridor, drawDust, drawGallery, drawYouInCorridor, DOORWAY, type GalleryDrive, resetGallery, settleGallery, stepGallery } from './gallery';
import { type BubblePlace, BUBBLE_FONT, CLERK, CRASH, drawBubble, ENDING_S, fitMeme, memeText, PAGE_FEET, PAGE_STOPS, wrap } from './ink';
import { BADGE, type Beat, CAPTIONS, CRASH_LINES, EXIT_LINE, LADDER, NAMES, OPENING, OVERTIME, REGRET, STAMP, type Who } from './lines';
import { clamp, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { createPortrait, isPortrait } from './portrait';
import {
  createMinutes, drawBackdrop, drawBlock, drawBoats, drawBouquet, drawCard, drawClerkDesk, drawDais, drawMic, drawMinutes, drawNotification, drawPhone,
  drawTypewriter, drawWitnessTable, resetMinutes, settleMinutes, stepMinutes, typePage,
} from './room';
import { bubbleAlpha, type Bubble, createScript, hush, lastLine, type Line, resetScript, say, settleLine, settleScript, stepScript, talking } from './script';

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
const TITLE = 'CONGRESSIONAL HEARING';
const COLOURS = { accent: '#e6c06a', bad: '#ff4d6d', good: '#7cf67c', text: '#ffffff', idle: '#ffe08a' };
/** The multipliers that ring a milestone stinger (and set the gallery applauding). */
const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];
/** She stops recording the words here: the pages come out blank. */
const BLANK_AT = 5;

// ─── Crash feel ─────────────────────────────────────────────────────────────────────────────────────────
const FREEZE_S = 0.15;
const SLOW_S = 0.45;
const SLOW_RATE = 0.3;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.08;
/** The punch lands on the phone in front of the hood. */
const PUNCH_AT = { x: 560, y: 410 } as const;
const WIPE_S = 0.4;
/** Live, betting opens about 2 s after a crash: the ending plays on into it for at most this long. */
const ENCORE_MAX_S = 3.5;

/** How many minutes pages a round has typed by `multiplier`: the opening, each non-witness line, the overtime. */
function pagesFor(next: number, overtimeDue: number): number {
  let n = OPENING.filter((l) => l.who !== 'witness').length;
  for (let i = 0; i < next; i += 1) if (LADDER[i]!.who !== 'witness') n += 1;
  return n + overtimeDue;
}
function blankFrom(next: number): number {
  let n = OPENING.filter((l) => l.who !== 'witness').length;
  for (let i = 0; i < next; i += 1) if (LADDER[i]!.who !== 'witness' && LADDER[i]!.at < BLANK_AT) n += 1;
  return n;
}

export function createScene(): Scene {
  // Dais muzak, a string quartet in an elevator; the crash is a door slammed on the record.
  const audio = pageAudio({ style: 'elevator', crash: 'slam' });
  const { capture, present } = createPortrait(TITLE, [176, 156, 608, 396], COLOURS.accent, 'MINUTE TAKEN', 'LIVE FROM THE COMMITTEE ROOM');
  const script = createScript(LADDER, OVERTIME);
  const senators: Senator[] = createSenators();
  const witness: Witness = createWitness();
  const steno = createSteno();
  const sergeant = createSergeant();
  const page: Page = createPage();
  const gallery = createGallery();
  const minutes = createMinutes();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const notice = spring(0);
  const cardPop = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let secured: { x100: number; payout: number | null } | null = null;
  let exitAge = 0;
  let outcome: Outcome | null = null;
  let crashed = false;
  let muted = false;
  let quietCrash = false;
  /**
   * The crash clock, in seconds: the crash age while the round is crashed, then (in the encore) advanced by real
   * frame time while the ending plays on over the start of betting. Every crash beat, line, caption and the stamp
   * read it, never view.crashAge.
   */
  let crashClock = 0;
  /** Seconds since betting opened over an unfinished ending, or null; the crash's multiplier and stake, kept for it. */
  let encore: number | null = null;
  let crashX100 = 100;
  let crashStake: number | null = null;
  let crashSeed = 0;
  let crashPageX = -46;
  let gavelUp = false;
  let regret = 0;
  let crashLine = 0;
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  let shake = 0;
  let wipe = 0;
  let pulse = 0;
  let caption = '';
  let opened = false;
  let lastRung = 0;
  let phoneLit = 0;
  let realClock = 0;
  const cueAt = new Map<Effect, number>();

  /** A one-shot effect, never twice within 0.08 s, never for a settled aftermath. */
  function cue(effect: Effect, strength: number, fresh: boolean): void {
    if (fresh || muted) return;
    const at = cueAt.get(effect) ?? -1;
    if (realClock - at < 0.08) return;
    cueAt.set(effect, realClock);
    audio.fx(effect, strength);
  }

  function reset(): void {
    resetScript(script);
    resetSenators(senators);
    settleSpring(witness.nod, 0);
    resetSteno(steno);
    resetSergeant(sergeant);
    resetPage(page);
    resetGallery(gallery);
    resetMinutes(minutes);
    secured = null;
    exitAge = 0;
    outcome = null;
    crashed = muted = quietCrash = gavelUp = false;
    crashClock = 0;
    encore = null;
    regret = crashLine = lastRung = 0;
    freeze = slow = punchHold = shake = pulse = phoneLit = 0;
    opened = false;
    for (const s of [pop, badge, punch, notice, cardPop]) settleSpring(s, 0);
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    crashed = true;
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    crashSeed = view.currentX100 * 7 + 11;
    crashX100 = view.currentX100;
    crashStake = view.stake;
    crashPageX = page.mode === 'off' ? -46 : page.x;
    hush(script);
    if (minutes.pages === 0) settleMinutes(minutes, 1, Infinity, -1);
    if (quiet) {
      // Met late: the aftermath as it stands, its last line already said, no stinger.
      muted = true;
      quietCrash = true;
      crashClock = view.crashAge / 1000;
      crashPageX = -46;
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= crashClock) crashLine += 1;
      const line = CRASH_LINES[crashLine - 1]?.[1];
      script.bubbles = [];
      if (line) settleLine(script, line, 1);
      settleSpring(pop, 1);
      settleSpring(notice, 1);
      settleSpring(cardPop, crashClock >= CRASH.card ? 1 : 0);
      settleSenators(senators, 1, view.currentX100 / 100, true);
      settleMissedGavel(senators, crashClock);
      gavelUp = crashClock >= CRASH.lastLine;
      minutes.flying = [];
      audio.crash('slam', true);
      return;
    }
    // The crash takes the floor: whatever was being said is cut off.
    for (const b of script.bubbles) b.life = Math.min(b.life, b.age + 0.25);
    freeze = FREEZE_S;
    slow = SLOW_S;
    punchHold = PUNCH_HOLD_S;
    shake = 1;
    settleSpring(punch, 1);
    pop.v = 16;
    notice.v = 14;
    audio.crash('slam');
    audio.fx('buzz', 1);
  }

  /** A line was said: its prop beat, the gazes, the page's errand, the minutes and the cue. */
  function heard(line: Line, multiplier: number, fresh: boolean): void {
    const who = line.who as Who;
    const beat = line.beat as Beat | undefined;
    cueSenator(senators, who, beat);
    if (who === 'witness') stepWitness(witness, 0, true, 0);
    if (beat === 'card') sendPage(page, PAGE_STOPS.chair, 2.6);
    if (beat === 'summon') sendPage(page, PAGE_STOPS.chair, 3.4);
    if (beat === 'bill') sendPage(page, PAGE_STOPS.witness, 0.9);
    if (beat === 'boat') {
      applaud(gallery, 3);
      cue('crowd', 0.8, fresh);
      cue('cheer', 0.5, fresh);
    }
    if (beat === 'wake') cue('squeak', 0.45, fresh);
    if (beat === 'paper') cue('whoosh', 0.18, fresh);
    if (!crashed && who !== 'witness') {
      // One page per exchange: the paper tears off the typewriter and goes up on the board.
      typePage(minutes, multiplier >= BLANK_AT, line.text === EXIT_LINE.text);
      tearPage(steno);
      cue('ding', 0.25, fresh);
    }
    cue('pop', who === 'witness' ? 0.3 : 0.4, fresh);
  }

  /** Where a speaker is: their head, for the bubble's tail and the gazes. */
  function speakerAt(who: string): { x: number; y: number; top: number } {
    const sen = senators.find((s) => s.who === who);
    if (sen) {
      const head = headOf(sen);
      return { x: head.x, y: head.y, top: headTopOf(sen) };
    }
    if (who === 'witness') return { x: 488, y: 380, top: 340 };
    const px = crashed ? pageInCrash(crashPageX, crashClock).x : page.x;
    return { x: px, y: PAGE_FEET - 92, top: PAGE_FEET - 104 };
  }

  /** Measures a bubble the way drawBubble will, so it can be clamped inside the frame and under the HUD. */
  function place(ctx: CanvasRenderingContext2D, b: Bubble, away: number): BubblePlace {
    const lo = mix(8, 150, away);
    const hi = mix(952, 810, away);
    const who = b.line.who;
    const text = b.line.text;
    const long = text.length > 70;
    const width = long ? 360 : text.length > 34 ? 300 : 230;
    const font = long ? '600 15px "Trebuchet MS", "Segoe UI", system-ui, sans-serif' : BUBBLE_FONT;
    const lineHeight = long ? 18 : 21;
    ctx.font = font;
    const rows = wrap(ctx, text, width - 28);
    const w = Math.min(width, Math.max(...rows.map((r) => ctx.measureText(r).width)) + 28);
    const h = rows.length * lineHeight + 16 + 12;
    const at = speakerAt(who);
    const name = NAMES[who as Who] ?? '';
    if (who === 'witness') {
      const x = 548 + w / 2 + 14;
      return { x: clamp(x, lo + w / 2, hi - w / 2), y: clamp(368, 300 + h / 2, 470 - h / 2), tail: { x: 546, y: 382 }, width, name, font, lineHeight };
    }
    if (who === 'page') {
      const x = clamp(at.x + 70, lo + w / 2, hi - w / 2);
      return { x, y: at.top - 20 - h / 2 + 8, tail: { x: at.x + 6, y: at.top + 4 }, width, name, font, lineHeight };
    }
    const x = clamp(at.x, lo + w / 2, hi - w / 2);
    const y = Math.max(mix(110, 70, away) + h / 2, at.top - 10 - h / 2);
    return { x, y, tail: { x: at.x + 4, y: at.top + 4 }, width, name, font, lineHeight };
  }

  function draw(ctx: CanvasRenderingContext2D, shown: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    realClock += real;
    const clockWas = crashClock;
    // ─── The encore: a crash this scene saw live plays its ending out over the start of betting ───
    if (encore === null && crashed && !muted && previous === 'crashed' && (shown.phase === 'betting' || shown.phase === 'waiting') && crashClock < ENDING_S) encore = 0;
    if (encore !== null) {
      encore += real;
      crashClock += real;
      if (shown.phase === 'running' || shown.phase === 'crashed' || crashClock >= ENDING_S || encore >= ENCORE_MAX_S) {
        // The ending is complete (or the next round has started): blink to black and reset to the betting set.
        wipe = 1;
        reset();
        previous = shown.phase === 'betting' || shown.phase === 'waiting' ? shown.phase : 'betting';
      }
    }
    // While the encore runs, the scene keeps drawing the crashed round: its phase, its multiplier, its outcome.
    const view: SceneView = encore !== null ? { ...shown, phase: 'crashed', currentX100: crashX100, crashAge: crashClock * 1000, stake: crashStake, cashoutX100: secured?.x100 ?? null, payout: secured?.payout ?? null } : shown;
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
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×. A slow log driver keeps long rounds changing.
    const tension = 1 - 1 / multiplier;
    const depth = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = view.phase === 'running';
    const fresh = previous === null;

    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running && !fresh && !crashed) {
        // Seen live: your PUBLIC seat stands, and the Chairman notes it for the record.
        exitAge = 0;
        say(script, EXIT_LINE, true, true);
        audio.cashout();
        cue('creak', 0.6, false);
      } else {
        exitAge = 99;
        settleGallery(gallery, multiplier, true);
      }
    }

    if (fresh) {
      previous = view.phase;
      if (view.phase === 'running' || view.phase === 'crashed') {
        // Opened mid-round: the agenda as far as it has got, the minutes on the board, the dais as it stands.
        settleScript(script, multiplier);
        // Settled, the floor is one senator's at a time too: an earlier long senator bubble gives way.
        const kept = script.bubbles.at(-1);
        if (kept && kept.line.who !== 'witness') script.bubbles = script.bubbles.filter((b) => b === kept || b.line.who === 'witness' || (b.line.text.length <= 14 && kept.line.text.length <= 14));
        opened = true;
        const pages = pagesFor(script.next, script.overtimeDue);
        const yours = secured ? pagesFor(LADDER.filter((l) => l.at <= secured!.x100 / 100).length, 0) : -1;
        settleMinutes(minutes, pages + (secured ? 1 : 0), multiplier >= BLANK_AT ? blankFrom(script.next) : Infinity, yours);
        settleSenators(senators, tension, multiplier, false);
        settleGallery(gallery, multiplier, secured !== null);
        if (secured) {
          badge.x = 1;
          while (regret < REGRET.length && (multiplier / secured.x100) * 100 >= REGRET[regret]![0]) regret += 1;
        }
      }
      if (view.phase === 'crashed') beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (view.phase === 'crashed' && !crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting' || view.phase === 'waiting') {
        if (crashed || script.next > 0 || opened) wipe = 1;
        reset();
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    if (crashed && encore === null) crashClock = view.crashAge / 1000;
    const live = running && !crashed;

    if (view.phase === 'betting' && !opened) {
      opened = true;
      for (const line of OPENING) say(script, line);
    }
    if (secured) {
      exitAge += dt;
      const past = view.currentX100 / secured.x100;
      if (live) while (regret < REGRET.length && past >= REGRET[regret]![0]) say(script, REGRET[regret++]![1]);
    }
    if (crashed) {
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= crashClock) say(script, CRASH_LINES[crashLine++]![1], true, true);
    }
    stepScript(script, multiplier, dt, live);
    for (const line of script.events) {
      heard(line, multiplier, fresh);
      // The floor passes: a new long line from the dais retires the last speaker's bubble there; a one-word
      // interjection does not take the floor.
      if (line.who !== 'witness') {
        for (const b of script.bubbles) {
          if (line.text.length > 14 && b.line !== line && b.line.who !== 'witness' && b.age < b.life) b.life = Math.min(b.life, b.age + 0.15);
        }
      }
    }
    const talk = (who: Who): number => talking(script, who);

    // ─── The cast and the props ───
    const newest = script.bubbles.filter((b) => b.age < b.life).at(-1);
    let focus: { x: number; y: number } | null = newest ? speakerAt(newest.line.who) : null;
    if (crashed) focus = crashClock > CRASH.out - 0.1 ? { x: 494 + 560 * smoothstep(CRASH.out, CRASH.gone, crashClock), y: 380 } : { x: 488, y: 390 };
    const dev = stepSenators(senators, { time, tension, multiplier, running: live, crashed, crashT: crashClock, talk, focus }, dt);
    if (crashed && crashClock >= CRASH.lastLine && !gavelUp) {
      gavelUp = true;
      raiseLastGavel(senators);
    }
    stepWitness(witness, talk('witness'), false, dt);
    const typing = !crashed && (view.phase !== 'waiting');
    stepSteno(steno, { time, tension, typing, blank: multiplier >= BLANK_AT, crashT: crashClock, crashed }, dt);
    stepSergeant(sergeant, tension, script.events.length > 0, live, crashed, crashClock, dt);
    stepPage(page, tension, live, dt);
    const gdrive: GalleryDrive = { multiplier, tension, crashed, crashT: crashClock, left: secured !== null, exitAge };
    stepGallery(gallery, gdrive, dt);
    stepMinutes(minutes, dt);
    phoneLit = Math.max(0, phoneLit - dt / 1.6);

    // ─── Cues: only on edges this scene saw, never for a settled aftermath ───
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (!fresh && live && rung > lastRung) {
      audio.milestone(rung);
      applaud(gallery, 1.4);
      cue('crowd', 0.35, false);
      cue('notify', 0.35, false);
      phoneLit = 1;
      senators[3]!.buzz = 0.8;
    }
    lastRung = rung;
    if (dev.gavel) {
      cue('clang', 0.45, fresh);
      cue('thud', 0.35, fresh);
    }
    if (dev.miss) cue('thud', 0.9, fresh);
    if (steno.keyEvent) cue('click', 0.06 + 0.14 * tension, fresh);
    if (sergeant.checked) cue('tick', 0.25 + 0.2 * tension, fresh);
    if (page.step) cue('stomp', 0.1, fresh);
    if (gallery.clapped) cue('crowd', 0.12, fresh);
    if (crashed && !muted) {
      const was = clockWas;
      const passed = (at: number): boolean => was < at && crashClock >= at;
      if (passed(0.6) || passed(1.2)) cue('buzz', 0.6, false);
      if (passed(CRASH.gallery)) cue('gasp', 0.8, false);
      if (passed(CRASH.fall)) cue('whoosh', 0.8, false);
      if (passed(CRASH.fall + CRASH.fallFor)) cue('thud', 0.5, false);
      if (passed(CRASH.beep) || passed(CRASH.beep + 0.25)) cue('beep', 0.7, false);
      if (passed(CRASH.handed)) cue('pop', 0.5, false);
      if (passed(CRASH.card)) cue('click', 0.6, false);
      if (passed(CRASH.stand)) cue('creak', 0.7, false);
      if (crashClock > CRASH.out && crashClock < CRASH.gone && Math.floor((crashClock - CRASH.out) / 0.3) !== Math.floor((was - CRASH.out) / 0.3)) cue('stomp', 0.15, false);
    }
    if (secured && !fresh && !muted && exitAge - dt < 2.6 && exitAge >= 2.6 && exitAge < 50) cue('door', 0.5, false);
    if (!fresh && !muted && live && !secured) {
      // A heartbeat under the dais muzak, quickening with the tension, until the exit.
      const beat = 1.4 - 1.05 * tension;
      if ((pulse += dt) >= beat) {
        pulse -= beat;
        audio.fx('heartbeat', 0.15 + 0.3 * tension);
      }
    }
    if (crashed && crashClock >= CRASH.card && cardPop.x < 0.5 && cardPop.v === 0) cardPop.v = 12;

    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(notice, crashed ? 1 : 0, 14, 0.45, dt);
    stepSpring(cardPop, crashed && crashClock >= CRASH.card ? 1 : 0, 14, 0.45, dt);
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
    const away = outcome === 'dodged' ? (quietCrash ? 1 : smoothstep(0.1, 1.1, crashClock)) : 0;
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    if (away > 0) {
      // After an exit the collapse is seen small, from the doorway: the room shrinks into the door.
      const k = mix(1, DOORWAY.w / 680, away);
      const cx = DOORWAY.x + DOORWAY.w / 2;
      const cy = DOORWAY.y + DOORWAY.h / 2;
      ctx.beginPath();
      ctx.rect(mix(0, DOORWAY.x, away), mix(0, DOORWAY.y, away), mix(960, DOORWAY.w, away), mix(540, DOORWAY.h, away));
      ctx.clip();
      ctx.translate(mix(480, cx, away), mix(300, cy, away));
      ctx.scale(k, k);
      ctx.translate(-480, -300);
    }
    if (punch.x > 0.005) {
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    const dd = { time, tension, multiplier, running: live, crashed, crashT: crashClock, talk, focus };
    drawBackdrop(ctx);
    drawBoats(ctx, time, crashed && crashClock >= CRASH.boats ? 1 : 0);
    drawMinutes(ctx, minutes, crashed ? crashClock : 0, crashSeed, time, false);
    for (const sen of senators) drawSenator(ctx, sen, dd);
    drawDais(ctx);
    drawBlock(ctx);
    for (const sen of senators) {
      drawMic(ctx, sen.x, sen.s, micWobble(sen, dd));
      drawSenatorDesk(ctx, sen, dd);
    }
    // The page, the sergeant, the clerk's desk and its bouquet.
    const grow = crashed ? 1 : clamp(0.15 + 0.85 * smoothstep(0, 0.92, tension) + 0.25 * depth, 0, 1.25);
    const crashPage = crashed ? pageInCrash(crashPageX, crashClock) : null;
    const pageLook = crashPage
      ? { ...crashPage, list: 1.2, offer: smoothstep(CRASH.card - 0.3, CRASH.card - 0.1, crashClock) * (1 - smoothstep(CRASH.card + 0.1, CRASH.card + 0.3, crashClock)), bouquet: crashClock >= CRASH.handed + 0.1 }
      : { x: page.x, dir: page.dir, distance: page.distance, running: page.mode === 'run', list: clamp(0.1 + 0.9 * tension + 0.3 * depth, 0, 1.4), offer: page.mode === 'wait' ? 1 : 0, bouquet: false };
    const showPage = crashPage ? crashPage.x > -40 : page.mode !== 'off';
    if (showPage) {
      const hand = drawPage(ctx, pageLook, time);
      if (pageLook.bouquet) drawBouquet(ctx, hand.x, hand.y + 4, grow, time, true, -0.25);
    }
    drawSergeant(ctx, sergeant, time, crashClock, crashed, crashed && crashClock >= CRASH.beep && crashClock < CRASH.beep + 0.6);
    drawClerkDesk(ctx);
    const inHand = crashed ? sergeantBouquet(crashClock) : null;
    if (!crashed || crashClock < CRASH.lift) drawBouquet(ctx, CLERK.x, CLERK.top - 2, grow, time);
    else if (inHand) drawBouquet(ctx, inHand.x, inHand.y, grow, time, true, 0.15);
    // The stenographer and her typewriter.
    drawTypewriter(ctx, steno.carriage, steno.paper, multiplier >= BLANK_AT);
    drawSteno(ctx, steno, { time, tension, typing, blank: multiplier >= BLANK_AT, crashT: crashClock, crashed });
    // The witness table, the witness, the phone and the card.
    drawWitnessTable(ctx);
    const leave = crashed ? clamp((crashClock - CRASH.stand) / 0.9, 0, 1) : 0;
    drawWitness(ctx, witness, { time, tension, talk: talk('witness'), leave, walk: crashed ? 560 * smoothstep(CRASH.out, CRASH.gone, crashClock) : 0 });
    const buzz = crashed && crashClock < 2.4 && crashClock % 0.6 < 0.38 ? 1 : 0;
    drawPhone(ctx, { lit: crashed ? 1 : phoneLit, buzz, red: crashed, text: crashed ? 'DEV SOLD' : 'GM' }, time);
    drawCard(ctx, crashed && crashClock >= CRASH.card ? 1 : 0, 0);
    drawWitnessChair(ctx);
    // The gallery, nearest the camera; the player's seat is in it.
    drawGallery(ctx, gallery, gdrive, time);
    drawMinutes(ctx, minutes, crashed ? crashClock : 0, crashSeed, time, true);
    drawDust(ctx, time);
    drawNotification(ctx, 'DEV SOLD', 'the dev has left the chat', notice.x, crashed ? 1 : 0);
    drawCard(ctx, 0, cardPop.x);
    if (!isPortrait(ctx.canvas)) for (const b of script.bubbles) drawBubble(ctx, b.line.text, place(ctx, b, away), b.pop.x, bubbleAlpha(b), b.line.thought);
    ctx.restore();
    if (away > 0) {
      drawCorridor(ctx, away);
      drawYouInCorridor(ctx, away, crashClock >= CRASH.gallery, time);
    }
    if (crashed && !quietCrash && crashClock < 0.25) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - crashClock / 0.25)})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    if (wipe > 0) {
      wipe = Math.max(0, wipe - real / WIPE_S);
      ctx.fillStyle = `rgba(0, 0, 0, ${clamp(wipe * 1.6, 0, 1)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // ─── The HUD ───
    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(430, 58);
      const s = 1 + 0.08 * captionPop.x;
      ctx.scale(s, s);
      memeText(ctx, caption, 0, 0, fitMeme(ctx, caption, 38, 560), '#ffffff', 'center');
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(430, 96);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× · ${BADGE}`;
      memeText(ctx, text, 0, 0, fitMeme(ctx, text, 20, 560), COLOURS.good, 'center');
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'watched' ? COLOURS.bad : running ? COLOURS.text : COLOURS.idle;
    const reading = `${multiplier.toFixed(2)}×`;
    memeText(ctx, reading, 936, 70, fitMeme(ctx, reading, 54, 226), colour, 'right');
    if (outcome && pop.x > 0.02 && crashClock >= 2) {
      ctx.save();
      ctx.translate(outcome === 'dodged' ? 490 : 482, outcome === 'dodged' ? 452 : 494);
      ctx.rotate(-0.07);
      const s = clamp(pop.x, 0, 1.25);
      ctx.scale(s, s);
      memeText(ctx, STAMP[outcome], 0, 0, fitMeme(ctx, STAMP[outcome], outcome === 'rekt' ? 40 : 34, 520), outcome === 'rekt' ? COLOURS.bad : '#ffe27a', 'center');
      ctx.restore();
    }
    const awake = senators.filter((s) => s.who !== 'howe' || s.wake.x > 0.5).length;
    if (away < 0.5) memeText(ctx, `QUORUM ${awake}/5 AWAKE`, 936, 98, 16, awake === 5 ? '#ffe08a' : '#f3e9d6', 'right', 230);
    const said = lastLine(script);
    const content = said ? `${NAMES[said.who as Who] ?? ''}: ${said.text}` : 'The committee will hear testimony on the coin.';
    const detail = outcome === 'dodged' ? [DOORWAY.x - 20, DOORWAY.y - 10, DOORWAY.w + 40, DOORWAY.h + 20] : crashed ? (crashClock < CRASH.card - 0.2 ? [300, 250, 420, 300] : [130, 230, 540, 310]) : secured && exitAge < 4 ? [470, 300, 480, 240] : undefined;
    present(ctx, view, caption, `${TITLE} · ${minutes.pages} PP.`, content, detail);
  }

  return { draw };
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
