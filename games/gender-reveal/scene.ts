/**
 * Composes Gender Reveal from the round: the backyard at 2 pm, the party on its springs, the programme keyed to
 * the displayed multiplier, the prop beats it stages, the plus-one's exit with the last slice on an accepted
 * cash-out, the seeded detonation of the reveal on the crash, the blink to black into the next round, the cues
 * and the HUD. The clocks: real dt clamped to 0.1 s, a hit-stop and slow motion on the crash. Tension is
 * 1 − 1/x on the displayed multiplier and a slow log10 driver keeps long rounds changing. Nothing here reads,
 * predicts or changes the committed outcome; the crash debris is seeded from the crash point after the crash.
 */
import { pageAudio } from './audio';
import {
  type Cast,
  createCast,
  drawCrowd,
  drawDale,
  drawDestiny,
  drawGrandmas,
  drawHal,
  drawKyleBehind,
  drawKyleJump,
  drawKyleUnder,
  drawLaptop,
  drawOutside,
  drawSheila,
  drawTanner,
  drawWorker,
  drawYouWalking,
  gateFor,
  headOf,
  resetCast,
  settleCast,
  stepCast,
  youAt,
} from './cast';
import { BUBBLE_FONT, drawBubble, memeText, THOUGHT_FONT, wrap } from './ink';
import { AT, BEATS, BETTING_LINE, CAPTIONS, COLOURS, crashLines, ENDING_S, EXIT_LINE, LADDER, NAMES, OVERTIME, REGRET, RUNGS, STAMP, TITLE } from './lines';
import { clamp, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { createPortrait, isPortrait } from './portrait';
import { type Bubble, bubbleAlpha, createScript, hush, lastLine, type Line, resetScript, say, settleLine, settleScript, stepScript, talking } from './script';
import {
  BOUNCE,
  crashYard,
  createYard,
  drawBanner,
  drawBounceHouse,
  drawBox,
  drawCanopy,
  drawDebris,
  drawFlash,
  drawFogBack,
  drawFogFront,
  drawGate,
  drawLanterns,
  drawPinata,
  drawProjection,
  drawSky,
  drawTable,
  drawTableBack,
  pinataAt,
  postChat,
  resetYard,
  settleYard,
  stepYard,
  type Yard,
} from './yard';

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

// ─── Crash feel ─────────────────────────────────────────────────────────────────────────────────────────
const FREEZE_S = 0.15;
const SLOW_S = 0.45;
const SLOW_RATE = 0.3;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.08;
/** The camera punches in on the box as the latch goes. */
const PUNCH_AT = { x: 471, y: 330 } as const;
/** The blink to black that covers the yard resetting for the next round. */
const WIPE_S = 0.4;
/**
 * The crash ending is complete by ENDING_S on the crash clock. Live, the next betting window opens about two
 * seconds after the crash, so a crash this scene saw plays its ending out as an encore over the start of betting
 * (for at most ENCORE_MAX_S) before the blink to black and the fresh yard.
 */
const ENCORE_MAX_S = 3.5;
/** The picture-in-picture beyond the side gate, once the plus-one is through it. */
const INSET = { x: 762, y: 408, w: 186, h: 112 } as const;

// ─── Bubbles: a slot per speaker, nudged apart, kept in the frame and under the HUD ─────────────────────────
const SLOTS: Record<string, { dx: number; dy: number; w: number; fill?: string }> = {
  sheila: { dx: 70, dy: -104, w: 270 },
  tanner: { dx: 30, dy: -110, w: 260 },
  destiny: { dx: 40, dy: -108, w: 250 },
  hal: { dx: -4, dy: -100, w: 210 },
  pauline: { dx: -60, dy: -86, w: 170 },
  bev: { dx: 50, dy: -96, w: 170 },
  kyle: { dx: -40, dy: -84, w: 210, fill: '#e3f5f1' },
  dale: { dx: 150, dy: 4, w: 210 },
  carol: { dx: 0, dy: 0, w: 200, fill: '#dff0ff' },
  brad: { dx: 0, dy: 0, w: 200, fill: '#e3f7e8' },
  worker: { dx: -70, dy: -70, w: 200, fill: '#fff6c9' },
  crowd: { dx: 0, dy: -24, w: 150 },
  you: { dx: -70, dy: -64, w: 200, fill: '#ffe9f2' },
};
/** The top edge bubbles keep under the HUD: lower while a two-line caption or the cash-out badge is up. */
let TOP = 100;
/** Places a bubble may move to, relative to its slot, in order of preference. */
const CANDIDATES: [number, number][] = [[0, 0], [0, -30], [-60, 0], [60, 0], [0, -60], [-90, -30], [90, -30], [0, -90], [-120, -60], [120, -60], [-150, 0], [150, 0], [0, 40], [-200, -40], [200, -40], [0, -120], [-120, 50], [120, 50], [0, 150], [-80, 150], [80, 150], [0, 190]];
/** The crash's payoff, which no bubble may cover: the opened box and its phone, and the cake's two halves. */
const PAYOFF = [{ x: 474, y: 360, w: 156, h: 124 }, { x: 712, y: 350, w: 120, h: 50 }];
/** The banner, which bubbles avoid a little. */
const BANNER_RECT = { x: 466, y: 184, w: 300, h: 40 };
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number =>
  Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)) * Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));

export function createScene(): Scene {
  const audio = pageAudio({ style: 'eurodance', crash: 'boom' });
  const { capture, present } = createPortrait(TITLE, [150, 150, 520, 390], COLOURS.accent, 'CAKE SECURED', 'LIVE FROM THE BACKYARD');
  const script = createScript(LADDER, OVERTIME);
  const yard: Yard = createYard();
  const cast: Cast = createCast();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const inset = spring(0);
  const placed = new WeakMap<Bubble, { x: number; y: number }>();
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let secured: { x100: number; payout: number | null } | null = null;
  /** Seconds since the exit was confirmed; large when it was confirmed before this scene saw it. */
  let exitAge = 0;
  let outcome: Outcome | null = null;
  let crashed = false;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues. */
  let muted = false;
  let regret = 0;
  let crashLine = 0;
  let lines: [number, Omit<Line, 'at'>][] = [];
  /** The crash's choreography clock in seconds, warped by the hit-stop and the slow motion; −1 before the crash. */
  let crashT = -1;
  /** Seconds since the crash: follows the shell's crashAge while crashed, then runs on through the encore. */
  let crashClock = 0;
  /** Seconds into the encore (the ending playing on into betting), or −1; and the round as it stood at the crash. */
  let encore = -1;
  let crashView: SceneView | null = null;
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  let shake = 0;
  let wipe = 0;
  let pulse = 0;
  let notifyClock = 0;
  let caption = '';
  let bettingSaid = false;
  let lastRung = 0;
  /** Seconds since each prop beat was staged. */
  const beats = new Map<string, number>();
  const beat = (name: string): number => beats.get(name) ?? -1;

  function reset(): void {
    resetScript(script);
    resetYard(yard);
    resetCast(cast);
    beats.clear();
    secured = null;
    exitAge = 0;
    outcome = null;
    crashed = false;
    muted = false;
    crashT = -1;
    crashClock = 0;
    encore = -1;
    crashView = null;
    lines = [];
    regret = crashLine = lastRung = 0;
    freeze = slow = punchHold = shake = pulse = 0;
    bettingSaid = false;
    settleSpring(pop, 0);
    settleSpring(badge, 0);
    settleSpring(punch, 0);
    settleSpring(inset, 0);
  }

  /** Every beat at or below the multiplier, as if staged long ago (a late entry). */
  function settleBeats(multiplier: number): void {
    for (const [name, at] of Object.entries(BEATS)) if (multiplier >= at) beats.set(name, 99);
  }

  function beginCrash(view: SceneView, quiet: boolean, multiplier: number): void {
    crashed = true;
    crashView = { ...view };
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    hush(script);
    lines = crashLines(multiplier, beat('key') >= 0);
    crashYard(yard, view.currentX100);
    if (quiet) {
      // Met late: the aftermath as it stands, its last line already said, no stinger.
      muted = true;
      crashT = crashClock;
      while (crashLine < lines.length && lines[crashLine]![0] <= crashClock) crashLine += 1;
      const line = lines[crashLine - 1]?.[1];
      if (line) {
        script.bubbles = [];
        settleLine(script, line, 1);
      }
      settleSpring(pop, 1);
      audio.crash('boom', true);
      return;
    }
    crashT = 0;
    freeze = FREEZE_S;
    slow = SLOW_S;
    punchHold = PUNCH_HOLD_S;
    shake = 1;
    settleSpring(punch, 1);
    pop.v = 16;
    // Heard from beyond the side gate, the same detonation is small.
    audio.crash(secured ? 'pop' : 'boom');
  }

  /**
   * Where the bubbles go: a bubble already up keeps its place; a new one tries its speaker's slot and a ring of
   * nearby places and keeps the one that covers the fewest faces, props and earlier bubbles and stays over its
   * speaker, inside the frame and under the HUD.
   */
  function layout(ctx: CanvasRenderingContext2D, d: Parameters<typeof headOf>[2]): { b: Bubble; at: ReturnType<typeof placeOf> }[] {
    const faces = visibleFaces(d);
    const out: { b: Bubble; at: ReturnType<typeof placeOf> }[] = [];
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    const pin = pinataAt(yard);
    const props = [{ x: pin.x, y: pin.y + 36, w: 50, h: 84 }];
    // From the crash on, the payoff stays clear: the opened box with the phone, and the cake's two halves.
    const payoff = crashed ? PAYOFF : [];
    for (const b of script.bubbles) {
      const at = placeOf(ctx, b.line, cast, d);
      const seen = placed.get(b);
      if (seen) {
        // A bubble already up stays where it was put.
        at.x = seen.x;
        at.y = seen.y;
      } else {
        let best = { x: at.x, y: at.y, score: Infinity };
        for (const [dx, dy] of CANDIDATES) {
          const x = clamp(at.x + dx, at.w / 2 + 6, 954 - at.w / 2);
          const y = clamp(at.y + dy, TOP + at.h / 2, 532 - at.h / 2);
          const r = { x, y, w: at.w + 10, h: at.h + 10 };
          let score = Math.abs(x - at.x) * 1.2 + Math.abs(y - at.y) * 1.5;
          // Keep the bubble over its speaker, so tails do not cross.
          score += Math.max(0, Math.abs(x - at.head.x) - at.w / 2 + 24) * 4;
          for (const o of rects) score += 4 * overlap(r, o);
          for (const f of faces) score += 6 * overlap(r, f);
          for (const f of props) score += 1.5 * overlap(r, f);
          for (const f of payoff) score += 8 * overlap(r, f);
          score += 0.03 * overlap(r, BANNER_RECT);
          if (score < best.score) best = { x, y, score };
        }
        at.x = best.x;
        at.y = best.y;
        placed.set(b, { x: at.x, y: at.y });
      }
      // A bubble that ended up below its speaker points at the chin, not through the face.
      if (b.line.who !== 'carol' && b.line.who !== 'brad' && b.line.who !== 'crowd') at.tail = { x: at.head.x, y: at.y < at.head.y ? at.head.y - 26 : at.head.y + 28 };
      rects.push({ x: at.x, y: at.y, w: at.w + 10, h: at.h + 10 });
      out.push({ b, at });
    }
    return out;
  }

  /** The faces on the set right now, as rectangles a bubble should not cover. */
  function visibleFaces(d: Parameters<typeof headOf>[2]): { x: number; y: number; w: number; h: number }[] {
    const who = ['sheila', 'tanner', 'destiny', 'hal'];
    if (beat('grandmas') >= 0) who.push('pauline', 'bev');
    if (cast.kyleUp.x > 0.5 || cast.kyleOut.x > 0.5) who.push('kyle');
    if (cast.daleUp.x > 0.5) who.push('dale');
    if (cast.peek.x > 0.5) who.push('worker');
    if (!secured || exitAge < 7) who.push('you');
    return who.map((w) => {
      const h = headOf(cast, w, d);
      return { x: h.x, y: h.y - 4, w: 54, h: 60 };
    });
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
    // ─── The encore: a crash this scene saw plays its ending out into the next betting window ───
    if (raw.phase === 'crashed' && encore < 0) crashClock = raw.crashAge / 1000;
    if (encore >= 0) {
      encore += real;
      crashClock += real;
      if (raw.phase === 'running' || crashClock >= ENDING_S || encore >= ENCORE_MAX_S) {
        // The ending is complete (or the next round is already under way): blink to the fresh yard.
        encore = -1;
        wipe = 1;
        reset();
        previous = raw.phase;
      }
    } else if (crashed && !muted && previous === 'crashed' && (raw.phase === 'betting' || raw.phase === 'waiting') && crashClock < ENDING_S) encore = 0;
    // During the encore the scene keeps drawing the crashed round as it stood, on its own crash clock.
    const view: SceneView = encore >= 0 && crashView ? { ...crashView, crashAge: crashClock * 1000 } : raw;
    view0.phase = view.phase;
    view0.multiplier = Math.max(1, view.currentX100 / 100);
    view0.tension = 1 - 1 / view0.multiplier;
    view0.playing = view.stake !== null;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×. A slow log driver keeps long rounds changing.
    const tension = 1 - 1 / multiplier;
    const depth = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = view.phase === 'running';
    const fresh = previous === null;
    const elapsed = view.elapsed / 1000;

    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running && !fresh && !crashed) {
        // Seen live: the plus-one gets up for the last slice.
        exitAge = 0;
        say(script, EXIT_LINE, true, true);
        audio.cashout();
      } else exitAge = 99;
    }

    const yardDrive = { running, crashed, multiplier, tension, depth, elapsed, time, beat };
    if (fresh) {
      previous = view.phase;
      if (view.phase === 'running' || view.phase === 'crashed') {
        settleScript(script, multiplier);
        settleBeats(multiplier);
        settleYard(yard, { ...yardDrive, crashed: view.phase === 'crashed' });
        if (secured) {
          badge.x = 1;
          // The regret lines already passed are not replayed.
          while (regret < REGRET.length && multiplier / secured.x100 * 100 >= REGRET[regret]![0]) regret += 1;
        }
      }
      if (view.phase === 'crashed') beginCrash(view, true, multiplier);
      settleCast(cast, castDrive());
    } else if (view.phase !== previous) {
      if (view.phase === 'crashed' && !crashed) beginCrash(view, crashClock > 1.5, multiplier);
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
    const exitBefore = exitAge;
    if (secured) {
      // A crash while the plus-one is still on the lawn hurries them through the gate, cake first.
      exitAge += crashed && exitAge < 7.3 ? dt * 4 : dt;
      const past = view.currentX100 / secured.x100;
      if (running && !crashed) while (regret < REGRET.length && past >= REGRET[regret]![0]) say(script, REGRET[regret++]![1]);
    }
    // The crash's lines come due on the crash clock, also after a quiet settle (only the sound is muted).
    const lastCrashT = crashT;
    if (crashed) {
      crashT += dt;
      while (crashLine < lines.length && lines[crashLine]![0] <= crashClock) say(script, lines[crashLine++]![1], true, true);
    }
    stepScript(script, multiplier, dt, running && !crashed);
    if (secured) {
      // After the exit the regret lines and the programme overlap: at most three bubbles up, the oldest fading first.
      const live = script.bubbles.filter((b) => b.age < b.life);
      for (let i = 0; i < live.length - 3; i += 1) live[i]!.life = live[i]!.age;
    }

    // ─── Beats: staged when their line is said, or once the multiplier is well past them ───
    for (const [name, age] of beats) beats.set(name, age + dt);
    for (const line of script.events) {
      if (line.beat && !beats.has(line.beat)) beats.set(line.beat, 0);
      if (line.who === 'carol' || line.who === 'brad') postChat(yard, NAMES[line.who]!, line.text);
    }
    if (running && !crashed) for (const [name, at] of Object.entries(BEATS)) if (multiplier >= at * 1.3 && !beats.has(name)) beats.set(name, 0);

    const cd = castDrive();
    const yev = stepYard(yard, yardDrive, dt);
    stepCast(cast, cd, dt);
    yard.peek = cast.kyleOut.x * (1 - clamp(cast.kyleUp.x, 0, 1));
    yard.sliceTaken = secured !== null && exitAge >= 2.9;
    yard.gate = gateFor(secured ? exitAge : -1);

    // ─── Cues: only on edges this scene saw, never for a settled aftermath ───
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (!fresh && running && !crashed && rung > lastRung) audio.milestone(rung);
    lastRung = rung;
    notifyClock = Math.max(0, notifyClock - dt);
    if (!fresh && !muted) {
      for (const line of script.events) {
        if (line.who === 'carol' || line.who === 'brad') audio.fx('notify', 0.5);
        else audio.fx(line.thought ? 'bubble' : 'pop', 0.4);
        // Sheila's megaphone feeds back on every programme item.
        if (line.who === 'sheila' && !line.thought) audio.fx('whistle', 0.12);
        const cue: Record<string, [Parameters<typeof audio.fx>[0], number]> = {
          key: ['click', 0.6], grandmas: ['stomp', 0.35], focus: ['zap', 0.4], phone: ['phone', 0.6], latch: ['creak', 0.7],
          live: ['beep', 0.4], dale: ['crowd', 0.35], spill: ['splash', 0.5], levitate: ['hiss', 0.5], hazmat: ['clang', 0.35], sky: ['engine', 0.5],
        };
        const c = line.beat ? cue[line.beat] : undefined;
        if (c) audio.fx(c[0], c[1]);
        if (line.beat === 'spill') audio.fx('gasp', 0.7);
      }
      if (yev.tick) audio.fx('tick', 0.25 + 0.35 * tension);
      if (yev.notify && notifyClock === 0) {
        notifyClock = 0.3;
        audio.fx('notify', 0.15 + 0.15 * tension);
      }
      if (running && !crashed) {
        // A heartbeat under the music, quickening with the tension, until the exit.
        const beatS = 1.4 - 1.05 * tension;
        if (!secured && (pulse += dt) >= beatS) {
          pulse -= beatS;
          audio.fx('heartbeat', 0.15 + 0.3 * tension);
        }
      }
      if (secured) {
        // The slice into the napkin, the side gate's latch behind the plus-one, a satisfied munch.
        const passed = (at: number) => exitBefore < at && exitAge >= at;
        if (passed(2.9)) audio.fx('whoosh', 0.3);
        if (passed(7.2)) audio.fx('click', 0.8);
        if (passed(7.7)) audio.fx('pop', 0.7);
      }
      if (crashed) {
        const small = secured ? 0.3 : 1;
        const crossed = (at: number) => lastCrashT < at && crashT >= at;
        // One long megaphone feedback, the piñata going off, the paper flurry, the cake, the banner, the flatline.
        if (crossed(0.2)) audio.fx('whistle', 0.9 * small);
        if (crossed(AT.pinata)) {
          audio.fx('boom', 0.6 * small);
          audio.fx('pop', 0.8 * small);
        }
        if (crossed(AT.pinata + 0.15)) audio.fx('whoosh', 0.9 * small);
        if (crossed(AT.cake + 0.3)) audio.fx('splash', 0.45 * small);
        if (crossed(AT.banner + 0.3)) audio.fx('thud', 0.5 * small);
        if (crossed(AT.flat)) audio.fx('beep', 0.5 * small);
      }
    }

    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(inset, secured && exitAge >= 7.3 ? 1 : 0, 10, 0.6, dt);
    if (fresh && secured && exitAge >= 7.3) settleSpring(inset, 1);
    punchHold = Math.max(0, punchHold - real);
    if (punchHold === 0) stepSpring(punch, 0, 9, 0.85, real);
    shake = Math.max(0, shake - real / 0.5);
    const nextCaption = captionFor(view, crashClock, script.caption, secured, exitAge, outcome);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);

    // ─── The picture, back to front ───
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    if (punch.x > 0.005) {
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    const crashShake = crashT >= 0 ? Math.max(0, 1 - crashT / 2) : 0;
    drawSky(ctx, yard, time);
    drawDale(ctx, cast, cd);
    drawBanner(ctx, yard, crashT, time);
    drawProjection(ctx, yard, { multiplier, crashT, time, tension });
    drawCanopy(ctx, time, crashShake);
    drawLanterns(ctx, yard, crashShake);
    drawGate(ctx, yard);
    const you = youAt(secured ? exitAge : -1);
    if (you.feet.y < BOUNCE.y) drawYouWalking(ctx, cd);
    drawWorker(ctx, cast, cd, false);
    drawBounceHouse(ctx, time, tension, running || view.phase === 'betting' ? 1 : 0.3);
    drawWorker(ctx, cast, cd, true);
    drawFogBack(ctx, yard, crashT);
    drawDebris(ctx, yard, crashT, true);
    drawHal(ctx, cast, cd);
    drawSheila(ctx, cast, cd, secured !== null);
    drawKyleBehind(ctx, cast, cd);
    drawTableBack(ctx);
    drawTanner(ctx, cast, cd);
    drawDestiny(ctx, cast, cd);
    drawBox(ctx, yard, time, crashT);
    drawTable(ctx, yard, { time, multiplier, tension, crashT });
    drawLaptop(ctx, cast, cd);
    drawKyleUnder(ctx, cast, cd);
    drawGrandmas(ctx, cast, cd);
    drawPinata(ctx, yard, crashT, tension);
    if (you.feet.y >= BOUNCE.y) drawYouWalking(ctx, cd);
    drawKyleJump(ctx, cast, cd);
    drawCrowd(ctx, cast, cd);
    drawDebris(ctx, yard, crashT, false);
    drawFogFront(ctx, yard, crashT);
    drawFlash(ctx, crashT);
    TOP = secured || splitCaption(caption).length > 1 ? 128 : 100;
    if (!isPortrait(ctx.canvas)) {
      for (const { b, at } of layout(ctx, cd)) drawBubble(ctx, b.line.text, at, b.pop.x, bubbleAlpha(b), b.line.thought);
    }
    if (inset.x > 0.02) {
      ctx.save();
      const s = clamp(inset.x, 0, 1.1);
      ctx.translate(INSET.x + INSET.w / 2, INSET.y + INSET.h / 2);
      ctx.scale(s, s);
      ctx.translate(-(INSET.x + INSET.w / 2), -(INSET.y + INSET.h / 2));
      drawOutside(ctx, INSET.x, INSET.y, INSET.w, INSET.h, time, crashT);
      ctx.restore();
    }
    ctx.restore();
    if (wipe > 0) {
      wipe = Math.max(0, wipe - real / WIPE_S);
      ctx.fillStyle = `rgba(0, 0, 0, ${clamp(wipe * 1.6, 0, 1)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // ─── The HUD ───
    capture(ctx);
    const parts = splitCaption(caption);
    if (parts.length) {
      ctx.save();
      ctx.translate(430, parts.length > 1 ? 44 : 58);
      const s = 1 + 0.08 * captionPop.x;
      ctx.scale(s, s);
      parts.forEach((p, i) => memeText(ctx, p, 0, i * 36, parts.length > 1 ? 31 : 38, '#ffffff', 'center', 560));
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(430, parts.length > 1 ? 112 : 98);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      memeText(ctx, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× ${CAPTIONS.exit[0]}`, 0, 0, 22, COLOURS.good, 'center', 520);
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'watched' ? COLOURS.bad : running ? '#ffffff' : COLOURS.gold;
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 70, 54, colour, 'right', 230);
    // The readouts: how neutral the cake still is, and who is still at the party.
    const neutral = crashed ? 0 : Math.round(100 * (1 - smoothstep(1.65, 2.5, multiplier) * (0.6 + 0.4 * tension)));
    memeText(ctx, `NEUTRALITY ${neutral}%`, 22, 524, 21, neutral < 50 ? '#ffb4c2' : '#fff7fb', 'left', 300);
    const attendance = secured ? 'ATTENDANCE: PENDING' : 'ATTENDANCE 24/24';
    memeText(ctx, attendance, 940, inset.x > 0.5 ? 398 : 524, 21, secured ? COLOURS.gold : '#fff7fb', 'right', 300);
    if (outcome && pop.x > 0.02 && crashClock >= 0.9) {
      ctx.save();
      ctx.translate(480, 478);
      ctx.rotate(-0.07);
      const s = clamp(pop.x, 0, 1.25);
      ctx.scale(s, s);
      memeText(ctx, STAMP[outcome], 0, 0, outcome === 'rekt' ? 46 : 36, outcome === 'rekt' ? COLOURS.bad : '#ffe27a', 'center', 600);
      ctx.restore();
    }
    const exiting = secured && exitAge < 7.3 && view.phase === 'running';
    present(ctx, view, caption, `NEUTRALITY ${neutral}%`, lastLine(script)?.text ?? 'The reveal box waits. The piñata ticks.', view.phase === 'crashed' ? [110, 96, 640, 480] : exiting ? [560, 230, 400, 300] : undefined);
  }

  /** The (effective) view as castDrive needs it, refreshed at the top of every draw. */
  const view0 = { phase: 'waiting' as SceneView['phase'], tension: 0, multiplier: 1, playing: false };
  function castDrive() {
    const newest = script.bubbles.at(-1);
    return {
      running: view0.phase === 'running',
      crashed,
      tension: view0.tension,
      multiplier: view0.multiplier,
      time,
      beat,
      talk: (who: string) => talking(script, who),
      speaker: newest && newest.age < newest.life ? newest.line.who : null,
      said: script.events.map((l) => l.who),
      crashT,
      exitAge: secured ? exitAge : -1,
      playing: view0.playing || secured !== null,
    };
  }
  return { draw };
}

/** A speaker's bubble place: their slot near their face, measured and clamped into the frame under the HUD. */
function placeOf(ctx: CanvasRenderingContext2D, line: Line, cast: Cast, d: Parameters<typeof headOf>[2]): { x: number; y: number; tail: { x: number; y: number }; width: number; name?: string; fill?: string; w: number; h: number; head: { x: number; y: number } } {
  const slot = SLOTS[line.who] ?? { dx: 0, dy: -90, w: 220 };
  let head = headOf(cast, line.who, d);
  if (line.who === 'carol' || line.who === 'brad') head = { x: 790, y: 152 };
  ctx.font = line.thought ? THOUGHT_FONT : BUBBLE_FONT;
  const name = NAMES[line.who];
  const rows = wrap(ctx, line.text, slot.w - 28);
  const w = Math.min(slot.w, Math.max(...rows.map((r) => ctx.measureText(r).width)) + 28);
  const h = rows.length * 21 + 16 + (name ? 12 : 0);
  const x = clamp(head.x + slot.dx, w / 2 + 6, 954 - w / 2);
  const y = clamp(head.y + slot.dy, TOP + h / 2, 532 - h / 2);
  const tail = line.who === 'carol' || line.who === 'brad' ? { x: 800, y: y + h / 2 + 22 } : line.who === 'crowd' ? { x: 470, y: 500 } : { x: head.x, y: head.y + (y < head.y ? -26 : 0) };
  return { x, y, tail, width: slot.w, name, fill: slot.fill, w, h, head };
}

function captionFor(view: SceneView, crashClock: number, said: string, secured: { x100: number } | null, exitAge: number, outcome: Outcome | null): string {
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

/** Long captions go on two lines: at an em dash, or after a full stop. */
function splitCaption(caption: string): string[] {
  if (!caption) return [];
  if (caption.length <= 24) return [caption];
  const dash = caption.indexOf(' — ');
  if (dash > 0) return [caption.slice(0, dash), caption.slice(dash + 3)];
  const stop = caption.indexOf('. ');
  if (stop > 0) return [caption.slice(0, stop + 1), caption.slice(stop + 2)];
  return [caption];
}
