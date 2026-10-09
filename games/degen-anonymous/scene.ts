/**
 * Composes Degen Anonymous: the basement, the circle in depth order with the set's furniture, the shares keyed
 * to the displayed multiplier, your share (the cash-out), the crash's beats on the crash clock, the blink to
 * black into the next meeting, the cues and the HUD. Everything follows the SceneView and the frame time;
 * nothing here reads, predicts or changes the committed outcome.
 */
import { type Audio, pageAudio } from './audio';
import {
  createBasement,
  drawBackdrop,
  drawClock,
  drawCloth,
  drawCookieRain,
  drawCookieTable,
  drawFlickerShade,
  drawPodium,
  drawPour,
  drawPuddle,
  drawTubes,
  drawTV,
  drawUrn,
  PIN1,
  PIN2,
  resetBasement,
  settleBasement,
  stepBasement,
  WET_AT,
} from './basement';
import {
  BEAT,
  circleItems,
  type CircleView,
  createCircle,
  cupInPile,
  cupLevel,
  depthScale,
  drawCuppa,
  drawFoldedChair,
  drawNotes,
  drawPerson,
  ENDING_S,
  HOP_S,
  type Item,
  julesAt,
  nameOf,
  PILE_DONE,
  PILE_STEP,
  resetCircle,
  settleCircle,
  speakerHead,
  standUp,
  stepCircle,
  tickSprites,
  youTagAt,
} from './circle';
import { box, bubbleSize, type BubblePlace, drawBubble, ink, INK, label, memeText } from './ink';
import type { Joint } from './kinematics';
import { BADGE, BETTING_LINE, CAPTIONS, CRASH_LINES, EXIT_LINE, LADDER, NAMETAGS, OVERTIME, REGRET, RUNGS, STAMP, TITLE, type Who } from './lines';
import { clamp, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { createPortrait } from './portrait';
import { type Bubble, bubbleAlpha, createScript, hush, lastLine, resetScript, say, settleLine, settleScript, stepScript, talking } from './script';

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

const COLOURS = { text: '#f4ead8', accent: '#f2b84b', bad: '#ff4d6d', good: '#7cf67c' };
/** Terry's cup is topped up at every milestone and once more when Jules's phone comes out. */
const CUP_RUNGS = [...RUNGS, 2.4].sort((a, b) => a - b);

// ─── Crash feel ─────────────────────────────────────────────────────────────────────────────────────────
const FREEZE_S = 0.15;
const SLOW_S = 0.45;
const SLOW_RATE = 0.3;
const PUNCH_HOLD_S = 0.35;
const PUNCH_ZOOM = 0.1;
/** The blink to black that covers the basement resetting for the next round. */
const WIPE_S = 0.45;
/** The longest the crash ending plays on into the next betting phase. */
const ENCORE_MAX_S = 3.5;
/** How long the BOUGHT THE TOP close-up stays up. */
const CALLOUT_S = 1.6;
/** The doorway view after your share: the room drawn this small inside the door, centred here. */
const DOOR_VIEW = { k: 0.5, x: 480, y: 262, x0: 240, y0: 112, x1: 720, y1: 382 } as const;

/** A plucked chord on the shared bus: the song's strum, and once, at the crash, the score's only minor chord. */
function strum(audio: Audio, minor: boolean, strength: number): void {
  const ac = audio.context;
  const bus = audio.bus;
  if (!ac || !bus || !audio.enabled) return;
  const notes = minor ? [0, 3, 7, 12, 15] : [0, 4, 7, 12, 16];
  const root = minor ? 146.83 : 196;
  notes.forEach((semi, i) => {
    const t = ac.currentTime + i * (minor ? 0.045 : 0.018);
    const f = root * 2 ** (semi / 12);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + (minor ? 2.2 : 0.9));
    const g = ac.createGain();
    const life = minor ? 2.8 : 1.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * strength, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + life);
    for (const [type, detune] of [['triangle', 0], ['sawtooth', 4]] as const) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + life + 0.05);
    }
    lp.connect(g);
    g.connect(bus);
  });
}

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'thud' });
  const { capture, present } = createPortrait(TITLE, [252, 128, 456, 340], COLOURS.accent, 'TOOK PROFITS', 'LIVE FROM THE BASEMENT');
  const script = createScript(LADDER, OVERTIME);
  const circle = createCircle();
  const basement = createBasement();
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const doorway = spring(0);
  const callout = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let secured: { x100: number; payout: number | null } | null = null;
  let exitAge = 0;
  let outcome: Outcome | null = null;
  let crashed = false;
  let muted = false;
  let regret = 0;
  let crashLine = 0;
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  let shake = 0;
  let wipe = 0;
  let flash = 0;
  let pulse = 0;
  let tvClock = 0;
  let caption = '';
  let bettingSaid = false;
  let lastRung = 0;
  /** Seconds since the crash: the crash age while crashed, then real time through the encore. */
  let crashClock = 0;
  /** Seconds since the shell left the crashed phase while the ending plays on, or null. */
  let encore: number | null = null;
  let crashX100 = 100;
  let crashStake: number | null = null;
  let crashSeed = 1;
  let punchAt: Joint = { x: 569, y: 230 };
  /** Throttles per cue, so a burst of edges never stacks the same sound. */
  const lastFx = new Map<string, number>();
  const placed = new WeakMap<Bubble, { x: number; y: number; w: number; gen: number }>();
  /** Bumped when the frame's free space changes (the stamp comes up), so bubbles find new places once. */
  let placeGen = 0;
  let stampUp = false;
  let badgeUp = false;
  let pileUp = false;

  function fx(name: Parameters<Audio['fx']>[0], strength: number, gap = 0.08): void {
    const at = lastFx.get(name) ?? -9;
    if (time - at < gap) return;
    lastFx.set(name, time);
    audio.fx(name, strength);
  }

  function reset(): void {
    resetScript(script);
    resetCircle(circle);
    resetBasement(basement);
    secured = null;
    exitAge = 0;
    outcome = null;
    crashed = false;
    muted = false;
    regret = crashLine = lastRung = 0;
    freeze = slow = punchHold = shake = pulse = flash = 0;
    crashClock = 0;
    encore = null;
    bettingSaid = false;
    settleSpring(badge, 0);
    settleSpring(punch, 0);
    settleSpring(doorway, 0);
    settleSpring(callout, 0);
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    crashed = true;
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    // The thumb comes down on a silent room: whatever was being said is cut off.
    hush(script);
    script.bubbles = [];
    crashSeed = view.currentX100 * 7 + 11;
    crashX100 = view.currentX100;
    crashStake = view.stake;
    circle.crashSeed = crashSeed;
    circle.julesAtCrash = julesAt(circle);
    const head = speakerHead(circle, 'jules');
    punchAt = { x: head.x, y: head.y + 40 };
    if (quiet) {
      // Met late: the pile as it stands, its last line already said, no stinger.
      muted = true;
      crashClock = view.crashAge / 1000;
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= crashClock) crashLine += 1;
      const line = CRASH_LINES[crashLine - 1]?.[1];
      script.bubbles = [];
      if (line) settleLine(script, line, 1);
      settleSpring(doorway, secured ? 1 : 0);
      settleSpring(callout, crashClock < CALLOUT_S ? 1 : 0);
      audio.crash('thud', true);
      return;
    }
    crashClock = view.crashAge / 1000;
    flash = 1;
    freeze = FREEZE_S;
    slow = SLOW_S;
    punchHold = PUNCH_HOLD_S;
    shake = 1;
    settleSpring(punch, secured ? 0 : 1);
    callout.v = 14;
    audio.crash('thud');
  }

  /** Crash beats crossed between the last frame and this one, live only. */
  function crashCues(before: number, now: number): void {
    const crossed = (at: number): boolean => before < at && now >= at;
    if (crossed(BEAT.stand)) {
      fx('stomp', 1);
      fx('thud', 0.8);
      fx('creak', 0.9);
    }
    if (crossed(BEAT.urn)) fx('clang', 0.5);
    if (crossed(BEAT.urn + 0.35)) fx('splash', 0.8);
    if (crossed(WET_AT)) fx('glug', 0.5);
    if (crossed(BEAT.chord)) strum(audio, true, 1);
    if (crossed(BEAT.ronDown + 0.3)) fx('thud', 0.9, 0.01);
    if (crossed(PIN1)) fx('pop', 0.7, 0.01);
    if (crossed(PIN2)) fx('pop', 0.7, 0.01);
    if (crossed(PIN2 + 0.5)) fx('whoosh', 0.5);
    for (let k = 0; k < 11; k += 1) if (crossed(BEAT.hug + k * PILE_STEP + HOP_S)) fx('thud', 0.35, 0.09);
    if (crossed(PILE_DONE + 0.2)) {
      fx('crowd', 0.35, 0.01);
      fx('notify', 0.5);
    }
    if (crossed(BEAT.cup)) fx('whoosh', 0.4);
  }

  function draw(ctx: CanvasRenderingContext2D, raw: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    const fresh = previous === null;

    // The encore: a crash seen live plays on into the next betting phase until its ending is whole, on real time,
    // then blinks to the fresh basement; it ends at once if the next round starts running.
    if (encore !== null) {
      encore += real;
      crashClock += real;
      if (crashClock >= ENDING_S || encore >= ENCORE_MAX_S || raw.phase === 'running' || raw.phase === 'crashed') {
        encore = null;
        wipe = 1;
        reset();
      }
    }
    if (raw.cashoutX100 !== null && !secured && encore === null) {
      secured = { x100: raw.cashoutX100, payout: raw.payout };
      if (raw.phase === 'running' && !fresh && !crashed) {
        // Seen live: your share plays out from here.
        exitAge = 0;
        say(script, EXIT_LINE, true, true);
        standUp(circle);
        audio.cashout();
        fx('creak', 0.6);
      } else {
        exitAge = 99;
        circle.you.mode = 'gone';
      }
    }

    if (fresh) {
      previous = raw.phase;
      if (raw.phase === 'running' || raw.phase === 'crashed') {
        const m = Math.max(1, raw.currentX100 / 100);
        settleScript(script, m);
        settleCircle(circle, m, 1 - 1 / m, clamp(Math.log10(m) / 3, 0, 1), secured !== null);
        settleBasement(basement, entriesAt(m));
        lastRung = RUNGS.filter((r) => m >= r).length;
        circle.terry.rung = lastRung;
        if (secured) {
          badge.x = 1;
          while (regret < REGRET.length && (m / secured.x100) * 100 >= REGRET[regret]![0]) regret += 1;
        }
      }
      if (raw.phase === 'crashed') beginCrash(raw, true);
    } else if (raw.phase !== previous) {
      if (raw.phase === 'crashed' && !crashed) beginCrash(raw, raw.crashAge > 1500);
      if (raw.phase === 'betting' || raw.phase === 'waiting') {
        if (previous === 'crashed' && crashed && !muted && encore === null && crashClock < ENDING_S) encore = 0;
        else {
          if (crashed || script.next > 0) wipe = 1;
          encore = null;
          reset();
        }
      }
      previous = raw.phase;
    }
    // During the encore the scene still draws the crashed round: its multiplier, its stake, its exit.
    const view: SceneView =
      encore !== null
        ? { ...raw, phase: 'crashed', currentX100: crashX100, crashAge: crashClock * 1000, stake: crashStake, cashoutX100: secured ? secured.x100 : null, payout: secured ? secured.payout : null }
        : raw;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×. A slow log driver keeps long rounds changing.
    const tension = 1 - 1 / multiplier;
    const depth = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = view.phase === 'running';
    audio.update(view.phase, tension);

    if (view.phase === 'betting' && !bettingSaid) {
      bettingSaid = true;
      say(script, BETTING_LINE, true);
    }
    if (secured) {
      exitAge += dt;
      const past = view.currentX100 / secured.x100;
      if (running && !crashed) while (regret < REGRET.length && past >= REGRET[regret]![0]) say(script, REGRET[regret++]![1]);
    }
    // The crash clock follows the crash age while the shell is crashed (the encore advances it on real time).
    const crashBefore = crashClock;
    if (crashed) {
      if (encore === null) crashClock = view.crashAge / 1000;
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= crashClock) say(script, CRASH_LINES[crashLine++]![1], true, true);
    }
    stepScript(script, multiplier, dt, running && !crashed);
    // At most two shares up at once: a third retires the oldest that has had its read.
    const live = script.bubbles.filter((b) => b.age < b.life);
    if (live.length > 2 && live[0]!.age > 1.8) live[0]!.life = Math.min(live[0]!.life, live[0]!.age + 0.05);

    // ─── The room ───
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    const newest = script.bubbles.at(-1);
    const beats = script.events.map((l) => l.beat ?? '').filter((b) => b);
    circle.cupFill = running || crashed ? cupLevel(multiplier, CUP_RUNGS) : 0.9;
    stepCircle(
      circle,
      {
        running,
        tension,
        multiplier,
        depth,
        time,
        talking: (who) => talking(script, who),
        speaker: (newest?.line.who as Who | undefined) ?? null,
        beats,
        line: script.events.length > 0 && !fresh,
        rung,
        crashed,
        crashT: crashClock,
        secured: secured !== null,
      },
      dt,
    );
    stepBasement(basement, { time, tension, depth, multiplier, running, crashed, crashT: crashClock, entries: running || crashed ? entriesAt(multiplier) : 0, tv: beats.includes('tv') }, dt);

    // ─── Cues: only on edges this scene saw, never for a settled aftermath ───
    if (!fresh && running && !crashed && rung > lastRung) audio.milestone(rung);
    lastRung = rung;
    if (!fresh && !muted) {
      for (const line of script.events) audio.fx(line.thought ? 'bubble' : 'pop', 0.4);
      for (const beat of beats) {
        if (beat === 'laugh') fx('laugh', 0.5);
        if (beat === 'tv') fx('beep', 0.5);
        if (beat === 'return') fx('gasp', 0.7);
        if (beat === 'mic') fx('click', 0.4);
      }
      const ev = circle.events;
      if (ev.creak > 0) fx('creak', 0.18 + 0.35 * tension, 0.35);
      if (ev.scrape) fx('squeak', 0.8);
      if (ev.flip) fx('notify', 0.6);
      if (ev.tick) fx('tick', 0.3);
      if (ev.buzz) fx('buzz', 0.25, 0.3);
      if (ev.door) fx('door', 0.25);
      if (ev.strum) strum(audio, false, 0.5);
      if (basement.events.drip) fx('glug', 0.08 + 0.1 * tension, 0.3);
      if (basement.events.flicker) fx('buzz', 0.06, 1.2);
      if (basement.events.page) fx('whoosh', 0.15, 0.3);
      if (running && !crashed) {
        // A heartbeat under the hum, quickening with the tension, until your share.
        const beat = 1.4 - 1.05 * tension;
        if (!secured && (pulse += dt) >= beat) {
          pulse -= beat;
          audio.fx('heartbeat', 0.15 + 0.3 * tension);
        }
        // The corner TV's market data: a tone under everything, rising with the round.
        const every = Math.max(0.9, 3.4 - 2.6 * tension);
        if ((tvClock += dt) >= every) {
          tvClock = 0;
          audio.fx('beep', 0.05 + 0.1 * tension);
        }
      }
      if (secured && circle.you.mode === 'folding' && circle.you.t < 0.05) fx('clang', 0.4, 1);
      if (secured && circle.you.mode === 'walking' && circle.you.t > 3.4 && circle.you.t - dt <= 3.4) fx('door', 0.4, 1);
      if (crashed) crashCues(crashBefore, crashClock);
    }

    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(doorway, crashed && secured ? 1 : 0, 5, 0.9, real);
    stepSpring(callout, crashed && crashClock < CALLOUT_S && !secured ? 1 : 0, 12, 0.55, dt);
    punchHold = Math.max(0, punchHold - real);
    if (punchHold === 0) stepSpring(punch, 0, 7, 0.85, real);
    shake = Math.max(0, shake - real / 0.5);
    const nextCaption = captionFor(view, script.caption, secured, exitAge, outcome, crashClock);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);

    // ─── The picture ───
    tickSprites();
    const cv: CircleView = {
      time,
      tension,
      multiplier,
      running,
      crashed,
      crashT: crashClock,
      talking: (who) => talking(script, who),
      secured: secured !== null,
      exitAge,
      wet: crashed ? crashClock - WET_AT : -1,
      youGone: secured !== null && circle.you.mode === 'gone',
    };
    const roomView = (): void => {
      drawRoom(ctx, cv, view, tension, depth, multiplier);
    };
    const door = clamp(doorway.x, 0, 1);
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    if (door > 0.001) {
      drawHallway(ctx, door, time);
      ctx.save();
      const k = mix(1, DOOR_VIEW.k, door);
      ctx.beginPath();
      ctx.rect(mix(0, DOOR_VIEW.x0, door), mix(0, DOOR_VIEW.y0, door), mix(960, DOOR_VIEW.x1 - DOOR_VIEW.x0, door), mix(540, DOOR_VIEW.y1 - DOOR_VIEW.y0, door));
      ctx.clip();
      ctx.translate(mix(480, DOOR_VIEW.x, door), mix(270, DOOR_VIEW.y, door));
      ctx.scale(k, k);
      ctx.translate(-480, -270);
      roomView();
      ctx.restore();
      drawDoorFrame(ctx, door, time);
      drawBubbles(ctx, door);
    } else {
      if (punch.x > 0.005) {
        const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
        ctx.translate(punchAt.x, punchAt.y);
        ctx.scale(k, k);
        ctx.translate(-punchAt.x, -punchAt.y);
      }
      roomView();
      drawBubbles(ctx, 0);
      if (callout.x > 0.02) drawCallout(ctx, clamp(callout.x, 0, 1.2), crashClock);
    }
    ctx.restore();
    if (flash > 0) {
      // The flash as the thumb comes down, fading on real time through the hit-stop.
      ctx.fillStyle = `rgba(255, 250, 240, ${0.75 * flash})`;
      ctx.fillRect(0, 0, 960, 540);
      flash = Math.max(0, flash - real / 0.3);
    }
    if (wipe > 0) {
      wipe = Math.max(0, wipe - real / WIPE_S);
      ctx.fillStyle = `rgba(8, 10, 8, ${clamp(wipe * 1.6, 0, 1)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // ─── The HUD ───
    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(430, 58);
      const s = 1 + 0.08 * captionPop.x;
      ctx.scale(s, s);
      memeText(ctx, caption, 0, 0, caption.length > 26 ? 27 : caption.length > 17 ? 32 : 38, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(430, 96);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      memeText(ctx, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× · ${BADGE}`, 0, 0, 20, COLOURS.good, 'center', 640);
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'watched' ? COLOURS.bad : running ? '#ffffff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 70, 54, colour, 'right', 230);
    // Readouts: Jules's days, and the room's lean, the round's own measure of suspense.
    const days = crashed ? NAMETAGS[3]! : NAMETAGS[running ? circle.jules.stage : 0]!;
    memeText(ctx, `JULES · ${days}`, 18, 526, 19, circle.jules.stage >= 2 || crashed ? '#ffb4c2' : COLOURS.text, 'left', 300);
    const lean = crashed ? -100 : Math.round(clamp(averageLean(), 0, 1) * 100);
    memeText(ctx, crashed ? 'ROOM LEAN: HUG' : `ROOM LEAN ${lean}%`, 942, 526, 19, lean > 60 ? '#ffd36b' : COLOURS.text, 'right', 300);
    const stampAge = crashClock - (secured ? 1.2 : PILE_DONE + 0.5);
    if (outcome && stampAge >= 0) {
      ctx.save();
      ctx.translate(500, doorway.x > 0.5 ? 462 : 488);
      ctx.rotate(doorway.x > 0.5 ? -0.07 : 0.04);
      // Slammed on: it grows in and rings down, a pure function of its age so a late entry shows it settled.
      const s = smoothstep(0, 0.1, stampAge) * (1 + 0.28 * Math.sin(stampAge * 16) * Math.exp(-stampAge * 5));
      ctx.scale(s, s);
      memeText(ctx, STAMP[outcome], 0, 0, outcome === 'rekt' ? 42 : 36, outcome === 'rekt' ? COLOURS.bad : '#ffe27a', 'center', 520);
      ctx.restore();
    }
    // The close-up follows the action: your exit, Jules at the door, the whole circle going up, then the pile.
    const detail = crashed
      ? secured
        ? [200, 90, 560, 420]
        : crashClock < BEAT.hug
          ? [150, 80, 660, 492]
          : [230, 170, 500, 373]
      : secured && exitAge < 6
        ? [20, 250, 420, 313]
        : circle.jules.mode === 'door'
          ? [420, 100, 420, 313]
          : undefined;
    present(ctx, view, caption, `JULES · ${days}`, lastLine(script)?.text ?? 'The urn is on. The chairs are out.', detail);
  }

  /** The room behind the HUD: the set and the circle in depth order, the crash's set pieces. */
  function drawRoom(ctx: CanvasRenderingContext2D, cv: CircleView, view: SceneView, tension: number, depth: number, multiplier: number): void {
    const running = view.phase === 'running';
    drawBackdrop(ctx);
    drawClock(ctx, time);
    drawTubes(ctx, basement, crashed ? crashClock : -1);
    drawCookieTable(ctx, Math.max(4, 21 - circle.terry.rung - (circle.bites < 99 ? 3 : 0)), crashed ? crashClock : -1);
    drawCloth(ctx, time, crashed ? crashClock : -1);
    if (crashed) drawPuddle(ctx, crashClock, { x: circle.julesAtCrash.x + 8, y: circle.julesAtCrash.y + 2 }, crashSeed);
    const items: Item[] = circleItems(ctx, circle, cv);
    items.push({ y: 300, draw: () => drawPodium(ctx, basement, time) });
    items.push({ y: 300.5, draw: () => drawTV(ctx, { time, tension, depth, multiplier, elapsed: view.elapsed, running, crashed, crashT: crashClock, flash: basement.tvFlash }) });
    items.push({ y: 492, draw: () => drawUrn(ctx, basement, { time, tension, crashed, crashT: crashClock, on: view.phase !== 'waiting' }) });
    items.sort((a, b) => a.y - b.y);
    for (const item of items) item.draw();
    if (crashed) {
      drawPour(ctx, crashClock);
      drawCookieRain(ctx, crashClock, cupInPile(circle), crashSeed, BEAT.cup);
    }
    drawNotes(ctx, circle, cv);
    drawFlickerShade(ctx, basement, crashed ? crashClock : -1);
    // The YOU tag over your chair (or over you on your way out).
    if (!(secured && circle.you.mode === 'gone') && !(crashed && secured)) drawYouTag(ctx, cv);
  }

  /** The tag that bobs over the player's seat. */
  function drawYouTag(ctx: CanvasRenderingContext2D, cv: CircleView): void {
    const at = youTagAt(circle);
    const bob = Math.sin(time * 3) * 3;
    const s = 0.95;
    ctx.save();
    ctx.translate(at.x, at.y - 34 + bob);
    ctx.scale(s, s);
    box(ctx, -24, -30, 48, 22, 5, '#ff2d4a', 2.5);
    ctx.fillStyle = '#ff2d4a';
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(0, 3);
    ctx.lineTo(8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff2d4a';
    ctx.fillRect(-7, -11, 14, 4);
    memeText(ctx, 'YOU', 0, -12, 17, '#ffffff', 'center');
    ctx.restore();
    void cv;
  }

  /** Every live bubble, placed once where it covers the fewest faces and stays clear of the HUD. */
  function drawBubbles(ctx: CanvasRenderingContext2D, door: number): void {
    const heads = faceRects();
    const taken: { x: number; y: number; w: number; h: number }[] = [];
    // The outcome stamp, once it is up, is kept clear like a bubble.
    const stamp = outcome !== null && door < 0.5 && crashClock >= PILE_DONE + 0.3;
    const pile = crashed && crashClock >= BEAT.hug + 0.4;
    if (stamp !== stampUp || (secured !== null) !== badgeUp || pile !== pileUp) {
      stampUp = stamp;
      badgeUp = secured !== null;
      pileUp = pile;
      placeGen += 1;
    }
    if (stamp) taken.push({ x: 480, y: 494, w: 600, h: 64 });
    // Once the hug starts, its middle is kept clear like a bubble; tails still reach in.
    if (pile && door < 0.5) taken.push({ x: 490, y: 360, w: 300, h: 200 });
    for (const b of script.bubbles) {
      const who = b.line.who as Who;
      const named = who !== 'you';
      const width = door > 0.5 ? 230 : b.line.text.length > 100 ? 300 : 276;
      const size = bubbleSize(ctx, b.line.text, width, b.line.thought, named);
      let head = speakerHead(circle, who);
      if (door > 0.5) head = { x: DOOR_VIEW.x + (head.x - 480) * DOOR_VIEW.k, y: DOOR_VIEW.y + (head.y - 270) * DOOR_VIEW.k };
      let at = placed.get(b);
      if (!at || at.w !== width || at.gen !== placeGen) {
        at = { ...placeBubble(head, size, heads, taken, who, door > 0.5), w: width, gen: placeGen };
        placed.set(b, at);
      }
      // A bubble on its way out does not keep the next one from its place.
      if (b.life - b.age > 0.3) taken.push({ x: at.x, y: at.y, w: size.w, h: size.h });
      const dx = at.x - head.x;
      const dy = at.y - head.y;
      const d = Math.hypot(dx, dy) || 1;
      const r = 22 * depthScale(head.y + 120) * (door > 0.5 ? DOOR_VIEW.k : 1);
      const place: BubblePlace = {
        x: at.x,
        y: at.y,
        tail: { x: head.x + (dx / d) * (r + 6), y: head.y + 8 + (dy / d) * (r + 2) },
        width,
        name: named ? (who === 'twinA' || who === 'twinB' ? 'the twins' : nameOf(who)) : undefined,
        fill: who === 'you' ? '#ffffff' : undefined,
        alt: who === 'twinA' || who === 'twinB' ? '#2f6fd6' : undefined,
      };
      drawBubble(ctx, b.line.text, place, b.pop.x, bubbleAlpha(b), b.line.thought);
    }
  }

  /** The faces a bubble should not cover, from where everyone's head is right now. */
  function faceRects(): { x: number; y: number; r: number; who: Who }[] {
    const out: { x: number; y: number; r: number; who: Who }[] = [];
    for (const who of ['terry', 'jules', 'ron', 'nurse', 'guitar', 'podcast', 'vegan', 'stock', 'cookie', 'twinA', 'twinB', 'you'] as Who[]) {
      const h = speakerHead(circle, who);
      out.push({ x: h.x, y: h.y, r: 30 * depthScale(h.y + 130), who });
    }
    // The TV screen and the HUD readouts count as faces too.
    out.push({ x: 860, y: 150, r: 60, who: 'terry' });
    return out;
  }

  function placeBubble(head: Joint, size: { w: number; h: number }, heads: { x: number; y: number; r: number; who: Who }[], taken: { x: number; y: number; w: number; h: number }[], who: Who, small: boolean): { x: number; y: number } {
    const { w, h } = size;
    const lift = small ? 22 : 30;
    // Above the head, swept sideways; beside it; the top band; and below only as a last resort.
    const candidates: [Joint, number][] = [];
    for (const dx of [0, -70, 70, -140, 140, -210, 210, -280, 280]) candidates.push([{ x: head.x + dx, y: head.y - lift - h / 2 }, Math.abs(dx) * 0.6]);
    for (const dx of [0, -120, 120, -240, 240, -360, 360]) candidates.push([{ x: head.x + dx, y: 0 }, 40 + Math.abs(dx) * 0.6]);
    candidates.push([{ x: head.x - w / 2 - 34, y: head.y - h / 2 + 4 }, 30], [{ x: head.x + w / 2 + 34, y: head.y - h / 2 + 4 }, 30]);
    candidates.push([{ x: head.x, y: head.y + 70 + h / 2 }, 3000]);
    let best = candidates[0]![0];
    let cost = Infinity;
    for (const [c0, extra] of candidates) {
      const top = secured ? 114 : c0.x + w / 2 > 680 ? 88 : 76;
      const x = clamp(c0.x, w / 2 + 6, 954 - w / 2);
      const y = clamp(c0.y, small ? DOOR_VIEW.y0 + h / 2 + 4 : top + h / 2, (small ? DOOR_VIEW.y1 + 60 : 500) - h / 2);
      let k = extra + Math.abs(x - c0.x) * 0.4 + Math.abs(y - c0.y) * 0.3;
      for (const f of heads) {
        const ox = Math.max(0, Math.min(x + w / 2, f.x + f.r) - Math.max(x - w / 2, f.x - f.r));
        const oy = Math.max(0, Math.min(y + h / 2, f.y + f.r) - Math.max(y - h / 2, f.y - f.r));
        k += ox * oy * (f.who === who ? 8 : f.r > 50 ? 0.4 : 3);
      }
      for (const o of taken) {
        const ox = Math.max(0, Math.min(x + w / 2 + 8, o.x + o.w / 2) - Math.max(x - w / 2 - 8, o.x - o.w / 2));
        const oy = Math.max(0, Math.min(y + h / 2 + 8, o.y + o.h / 2) - Math.max(y - h / 2 - 8, o.y - o.h / 2));
        k += ox * oy * 40;
      }
      if (k < cost) {
        cost = k;
        best = { x, y };
      }
    }
    return best;
  }

  /** The average lean of the room toward Jules. */
  function averageLean(): number {
    let sum = 0;
    let n = 0;
    for (const m of Object.values(circle.members)) {
      if (m.who === 'jules' || m.who === 'you') continue;
      sum += m.lean.x;
      n += 1;
    }
    return sum / n;
  }

  /** BOUGHT THE TOP, flashing on a close-up of Jules's phone beside him. */
  function drawCallout(ctx: CanvasRenderingContext2D, k: number, t: number): void {
    const head = speakerHead(circle, 'jules');
    const x = clamp(head.x + 120, 110, 850);
    const y = clamp(head.y + 30, 150, 400);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.rotate(0.06);
    ink(ctx, 2.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, 30);
    ctx.lineTo((head.x - x) * 0.8 / k, (head.y + 70 - y) / k);
    ctx.stroke();
    box(ctx, -46, -78, 92, 156, 14, '#1f2230', 3);
    const on = Math.floor(t * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b4a' : '#ffffff';
    ctx.fillRect(-38, -64, 76, 128);
    memeText(ctx, 'BOUGHT', 0, -10, 22, on ? '#ffffff' : '#ff3b4a', 'center', 72);
    memeText(ctx, 'THE TOP', 0, 18, 22, on ? '#ffffff' : '#ff3b4a', 'center', 72);
    ctx.fillStyle = on ? 'rgba(255,255,255,0.8)' : 'rgba(255,59,74,0.8)';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ORDER FILLED', 0, 42);
    // His thumb, down on the button.
    ctx.fillStyle = '#f3d2b3';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.ellipse(18, 56, 13, 17, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** The stairwell outside the door, for the crash seen from the doorway with your chair under your arm. */
  function drawHallway(ctx: CanvasRenderingContext2D, k: number, t: number): void {
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.4, 0, 1);
    ctx.fillStyle = '#2a241f';
    ctx.fillRect(0, 0, 960, 540);
    ctx.fillStyle = '#3a322a';
    ctx.fillRect(0, 0, 960, 70);
    ctx.fillStyle = '#4a3f33';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(DOOR_VIEW.x0 - 20, DOOR_VIEW.y1 + 6);
    ctx.lineTo(DOOR_VIEW.x1 + 20, DOOR_VIEW.y1 + 6);
    ctx.lineTo(960, 540);
    ctx.closePath();
    ctx.fill();
    // Light from the basement spilling out onto the hall floor.
    ctx.fillStyle = 'rgba(240,250,220,0.12)';
    ctx.beginPath();
    ctx.moveTo(DOOR_VIEW.x0, DOOR_VIEW.y1 + 6);
    ctx.lineTo(DOOR_VIEW.x1, DOOR_VIEW.y1 + 6);
    ctx.lineTo(860, 540);
    ctx.lineTo(100, 540);
    ctx.closePath();
    ctx.fill();
    // A sign for the stairs up.
    box(ctx, 772, 150, 120, 40, 4, '#e9e2cc', 2);
    label(ctx, 'STAIRS ↑ SANCTUARY', 832, 170, 9, INK, 800, 110);
    void t;
    ctx.restore();
  }

  function drawDoorFrame(ctx: CanvasRenderingContext2D, k: number, t: number): void {
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.4, 0, 1);
    ink(ctx, 3);
    ctx.fillStyle = '#6b5a45';
    ctx.fillRect(DOOR_VIEW.x0 - 18, DOOR_VIEW.y0 - 18, 18, DOOR_VIEW.y1 - DOOR_VIEW.y0 + 24);
    ctx.fillRect(DOOR_VIEW.x1, DOOR_VIEW.y0 - 18, 18, DOOR_VIEW.y1 - DOOR_VIEW.y0 + 24);
    ctx.fillRect(DOOR_VIEW.x0 - 18, DOOR_VIEW.y0 - 18, DOOR_VIEW.x1 - DOOR_VIEW.x0 + 36, 18);
    ctx.strokeRect(DOOR_VIEW.x0, DOOR_VIEW.y0, DOOR_VIEW.x1 - DOOR_VIEW.x0, DOOR_VIEW.y1 - DOOR_VIEW.y0);
    ctx.strokeRect(DOOR_VIEW.x0 - 18, DOOR_VIEW.y0 - 18, DOOR_VIEW.x1 - DOOR_VIEW.x0 + 36, DOOR_VIEW.y1 - DOOR_VIEW.y0 + 24);
    // You, from behind, in the hall: the folded chair under your arm, the cuppa in hand.
    ctx.translate(150, 560);
    ctx.scale(1.55, 1.55);
    drawPerson(ctx, youLook(), { fx: 0.2, fz: -0.98, sit: 0, kneel: 0, lean: { x: 0, y: 0 }, yaw: Math.PI - 0.5, nod: 0, breath: Math.sin(t * 2), hands: [{ x: -30, y: 34 }, { x: 26, y: 30 }], feet: null, face: { mouth: 0, smile: 0.4, o: 0, brow: 0, shut: 0, happy: 0, look: { x: 0, y: 0 } } }, {
      held: (f) => drawFoldedChair(ctx, f.chest.x - 30, f.chest.y + 40, 1, -0.35),
      over: (f) => drawCuppa(ctx, f.hands[1].x + 4, f.hands[1].y - 6, 1.2),
    });
    ctx.restore();
    // The YOU tag over you in the hall.
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.4, 0, 1);
    ctx.translate(150, 560 - 1.55 * 186 + Math.sin(time * 3) * 3);
    box(ctx, -24, -30, 48, 22, 5, '#ff2d4a', 2.5);
    memeText(ctx, 'YOU', 0, -12, 17, '#ffffff', 'center');
    ctx.restore();
  }

  return { draw };
}

/** How many of the room's top pumps the book holds at `multiplier`: the captioned shares, then every overtime one. */
function entriesAt(multiplier: number): number {
  let n = 0;
  for (const l of LADDER) if (multiplier >= l.at) n += 1;
  const lastAt = LADDER.at(-1)!.at;
  if (multiplier >= lastAt * 1.35) n += Math.floor(Math.log(multiplier / lastAt) / Math.log(1.35));
  return n;
}

/** Your look, for the figure in the hall. */
function youLook(): Parameters<typeof drawPerson>[1] {
  return { name: 'you', tag: 'YOU', skin: '#e9c09c', hair: '#3a2a24', style: 'short', shirt: '#6a5f8f', trim: '#4a4170', pants: '#33384a', shoes: '#2a2830', build: 1, tall: 1, head: 1 };
}

function captionFor(view: SceneView, said: string, secured: { x100: number } | null, exitAge: number, outcome: Outcome | null, crashClock: number): string {
  if (outcome) {
    if (outcome === 'dodged') return CAPTIONS.dodged;
    if (outcome === 'watched' && crashClock < 1.5) return CAPTIONS.watched;
    return CAPTIONS.crash[Math.floor(crashClock / 1.5) % CAPTIONS.crash.length]!;
  }
  if (view.phase === 'waiting') return CAPTIONS.waiting;
  if (secured) {
    if (view.currentX100 / secured.x100 >= 1.5) return CAPTIONS.kept;
    return CAPTIONS.exit[Math.floor(exitAge / 2.4) % CAPTIONS.exit.length]!;
  }
  return said;
}
