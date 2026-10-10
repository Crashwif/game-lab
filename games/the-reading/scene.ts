/**
 * The Reading: composes the study from the round. Peterson reads Grandma's will; every bequest lands on the
 * table as it is read and melts as the displayed multiplier climbs; the family reacts around the table; the
 * nephew's phone is the only chart in the room; the portrait's eyes follow the reading. An accepted cash-out is
 * the player's seat accepting item fourteen and walking out with the will. The crash is the lawyer's filing:
 * everything kept is collateral, the doily falls, the eyes close, the freezer opens on the dip, the walls come
 * off around Gerald, and the will is a receipt. This file owns the clocks, the phase edges, the dialogue and its
 * bubbles, the cues, the draw order and the HUD. Nothing here reads or changes the committed outcome.
 */
import { type Effect, pageAudio } from './audio';
import { BEQUESTS, BETTING_LINE, type Bequest, CAPTIONS, CRASH_CAPTIONS, CRASH_LINES, crashLineFits, drawBequest, drawReceipt, EXIT_LINE, HEADS, inventoryText, LADDER, LOOKS, OVERTIME, type Placed, REGRET, STAMP, TITLE } from './estate';
import {
  createFamily,
  createNephew,
  createPeterson,
  drawDocument,
  drawChairs,
  drawLeaveNote,
  drawNephew,
  drawPeterson,
  drawPlayerInHall,
  drawPlayerSeated,
  drawPlayerWalking,
  drawSeatBack,
  drawSeatChair,
  drawSitter,
  drawSitterHands,
  drawYouTag,
  editorialize,
  jolt,
  type CastDrive,
  NEPHEW,
  PETERSON,
  playerPose,
  resetFamily,
  resetNephew,
  resetPeterson,
  settleFamily,
  sitterHead,
  stepFamily,
  stepNephew,
  stepPeterson,
  turnPage,
  WILL_ON_TABLE,
} from './family';
import { type BubblePlace, drawBubble, measureBubble, memeText } from './ink';
import { clamp, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { createPortrait } from './portrait';
import { pageWeather } from './weather';
import { type Bubble, bubbleAlpha, createScript, hush, lastLine, resetScript, say, settleLine, settleScript, stepScript, talking } from './script';
import {
  BEATS,
  createStudy,
  drawArmchair,
  drawBackdrop,
  drawCoffeeTable,
  drawHallway,
  drawLighting,
  drawOpenRain,
  drawTable,
  drawFallenDoily,
  fireLevel,
  freezerOpen,
  HALL,
  STAMP_GAP,
  hangTag,
  rainLevel,
  resetStudy,
  settleStudy,
  slamOnLine,
  stepStudy,
  type StudyDrive,
} from './study';

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
type Box = readonly [x: number, y: number, w: number, h: number];

const COLOURS = { accent: '#e8b860', bad: '#ff4d5e', good: '#9fe08a', text: '#fbf3e4' } as const;
/** The multipliers that ring a milestone stinger: the bequest stamps. */
const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];

// ─── Crash feel ─────────────────────────────────────────────────────────────────────────────────────────
const FREEZE_S = 0.15;
const SLOW_S = 0.45;
const SLOW_RATE = 0.3;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.1;
/** The camera punches in on the nephew's phone: the chart goes red first. */
const PUNCH_AT = { x: 252, y: 400 } as const;
const WIPE_S = 0.4;

// ─── Bubbles ──────────────────────────────────────────────────────────────────────────────────────────────
const STYLE: Record<string, Pick<BubblePlace, 'width' | 'name' | 'fill' | 'font'>> = {
  peterson: { width: 316, name: 'Peterson, reading', fill: '#f6ecd0', font: '600 16px Georgia, "Times New Roman", serif' },
  dad: { width: 230, name: 'Dad' },
  mom: { width: 240, name: 'Mom' },
  twins: { width: 210, name: 'the twins' },
  nephew: { width: 230, name: 'the nephew' },
  assistant: { width: 160, name: 'the notary’s assistant' },
  gran: { width: 290, name: 'synthetic grandmother (a chatbot, 2019)', fill: '#dff3f7', font: '700 13px "Courier New", Courier, monospace' },
  kitchen: { width: 230, name: 'a cousin, in the kitchen', fill: '#eef0e2' },
};
/** Where each speaker's bubble would rather sit, from their mouth: Peterson up and to the right, over the bare
 * panelling; the family above their heads; the nephew out over the floor; the chatbot and the kitchen leftward. */
const PREFER: Record<string, { x: number; y: number }> = { peterson: { x: 120, y: -120 }, nephew: { x: 150, y: -10 }, gran: { x: -150, y: -40 }, kitchen: { x: -130, y: -40 } };
/** The HUD's corners, which no bubble may cover. */
const HUD: Box[] = [[136, 10, 590, 64], [690, 8, 270, 76], [8, 486, 262, 50]];
/** Props a bubble should rather not sit on: Grandma's face, the fire, the doily, Gerald, the freezer, the phone. */
/** The outcome stamp, low over the rug, clear of Gerald and the walls coming off. */
const STAMP_AT = { x: 610, y: 478 } as const;
const STAMP_BOX: Box = [360, 430, 500, 80];
const PROPS: [Box, number][] = [[[186, 76, 68, 70], 30], [[168, 250, 104, 80], 4], [[736, 112, 108, 66], 6], [[612, 60, 106, 128], 3], [[880, 160, 80, 170], 3], [[214, 380, 50, 64], 20]];

interface Placement { dx: number; dy: number; w: number; h: number }

export function createScene(): Scene {
  // Rain and fire under a cello that opens up with the multiplier; the crash is a thud.
  const audio = pageAudio({ style: 'ambient', crash: 'thud' });
  const weather = pageWeather(audio);
  const { capture, present } = createPortrait(TITLE, [134, 54, 644, 481], COLOURS.accent, 'WILL UNDER ARM', 'LIVE FROM THE STUDY');
  const script = createScript(LADDER, OVERTIME);
  const study = createStudy();
  const family = createFamily();
  const peterson = createPeterson();
  const nephew = createNephew();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const hunch = spring(0);
  const turn = spring(0);
  const placements = new WeakMap<Bubble, Placement>();
  const lastCue = new Map<Effect, number>();
  let placed: Placed[] = [];
  let handled = new Set<string>();
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let secured: { x100: number; payout: number | null } | null = null;
  let exitAge = -1;
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
  let pulse = 0;
  let caption = '';
  let bettingSaid = false;
  let lastRung = 0;
  let hunting = false;
  let seed = 0;
  let prevCrash = -1;
  /**
   * The scene's own crash clock, in seconds: it follows the view's crash age while the round is crashed, and runs
   * on through the encore, when the next betting phase arrives before the ending has finished playing.
   */
  let crashClock = 0;
  /** Seconds since the phase left `crashed` with the ending still playing, or −1; and the crash's multiplier. */
  let encore = -1;
  let crashX100 = 100;
  /** Shared looks: the family turns to the kitchen, up at Gerald, at the freezer. */
  let attend: { x: number; y: number; age: number } | null = null;
  /** Grandma's glance at whoever was just named, and Peterson's over his bifocals. */
  let glance: { x: number; y: number; age: number } | null = null;

  function cue(name: Effect, strength: number): void {
    const prev = lastCue.get(name) ?? -9;
    if (time - prev < 0.08) return;
    lastCue.set(name, time);
    audio.fx(name, strength);
  }

  function reset(): void {
    resetScript(script);
    resetStudy(study);
    resetFamily(family);
    resetPeterson(peterson);
    resetNephew(nephew);
    placed = [];
    handled = new Set();
    secured = null;
    exitAge = -1;
    outcome = null;
    crashed = false;
    muted = false;
    regret = crashLine = lastRung = 0;
    freeze = slow = punchHold = shake = pulse = 0;
    bettingSaid = false;
    hunting = false;
    attend = glance = null;
    prevCrash = -1;
    crashClock = 0;
    encore = -1;
    crashX100 = 100;
    settleSpring(pop, 0);
    settleSpring(badge, 0);
    settleSpring(punch, 0);
    settleSpring(hunch, 0);
  }

  const member = (kind: string) => family.find((m) => m.kind === kind);

  /** Puts a bequest on the table (or its tag on the set). `live` plays the landing and the glances. */
  function place(b: Bequest, x100: number, live: boolean): void {
    if (placed.some((p) => p.b === b)) return;
    if (b.beat === 'phrase' && secured) return;
    placed.push({ b, x100, pop: live ? 0 : 1 });
    if (b.tag === 'gerald') live ? hangTag(study.geraldTag) : settleSpring(study.geraldTag, 1);
    if (b.tag === 'freezer') live ? hangTag(study.freezerTag) : settleSpring(study.freezerTag, 1);
    if (b.tag === 'sampler') live ? hangTag(study.samplerTag) : settleSpring(study.samplerTag, 1);
    if (!live) return;
    glance = { ...b.look, age: 0 };
    if (b.tag === 'gerald' || b.tag === 'freezer') attend = { ...b.look, age: 0 };
    const who = b.beat === 'house' || b.beat === 'timeshare' ? 'dad' : b.beat === 'service' || b.beat === 'genealogy' ? 'mom' : b.beat === 'car' ? 'twin' : null;
    for (const m of family) if (who && m.kind.startsWith(who)) jolt(m);
    if (!muted) {
      cue(b.tag ? 'tick' : 'thud', b.tag ? 0.35 : 0.28);
      cue('ding', 0.12);
    }
  }

  /** A line's prop beat, once: the bequest it reads, the hunt, the eulogy, the assistant's leave. */
  function beat(name: string, live: boolean, x100: number): void {
    if (name === 'brow') {
      if (live) editorialize(peterson);
      return;
    }
    if (name === 'page') {
      if (live) turnPage(peterson);
      return;
    }
    if (handled.has(name)) return;
    handled.add(name);
    const b = BEQUESTS.find((q) => q.beat === name);
    if (b) place(b, x100, live);
    if (name === 'kitchen') {
      hunting = true;
      if (live) {
        attend = { ...LOOKS.kitchen!, age: 0 };
        glance = { ...LOOKS.kitchen!, age: 0 };
      }
    }
    if (name === 'sampler') {
      const mom = member('mom');
      if (mom) live ? (mom.fold.v = 2.5) : settleSpring(mom.fold, 1);
    }
    if (name === 'leave') {
      const a = member('assistant');
      if (a && a.leave < 0) a.leave = live ? 0 : 99;
      if (live) glance = { ...LOOKS.leave!, age: 0 };
    }
  }

  /** Lines the queue dropped on a fast curve still stage their beat, quietly, once the ladder has moved past. */
  function catchUp(x100: number): void {
    for (let i = 0; i < script.next; i += 1) {
      const line = LADDER[i]!;
      if (!line.beat || line.beat === 'brow' || handled.has(line.beat) || script.queue.includes(line)) continue;
      beat(line.beat, true, x100);
    }
  }

  function settleBeats(multiplier: number): void {
    for (const line of LADDER) if (line.beat && multiplier >= line.at) beat(line.beat, false, Math.round(line.at * 100));
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    crashed = true;
    seed = view.currentX100;
    crashX100 = view.currentX100;
    crashClock = view.crashAge / 1000;
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    hush(script);
    for (const p of placed) p.pop = Math.max(p.pop, 1);
    if (quiet) {
      muted = true;
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= crashClock) crashLine += 1;
      const items = placed.some((p) => !p.b.tag);
      const line = CRASH_LINES.slice(0, crashLine).filter(([, l]) => crashLineFits(l, items)).at(-1)?.[1];
      script.bubbles = [];
      if (line) settleLine(script, line, 1);
      settleSpring(pop, 1);
      audio.crash('thud', true);
      return;
    }
    freeze = FREEZE_S;
    slow = SLOW_S;
    punchHold = PUNCH_HOLD_S;
    shake = 1;
    settleSpring(punch, 1);
    pop.v = 16;
    audio.crash('thud');
  }

  /** The crash's beats as sound, on the edges of the crash age this scene actually saw. */
  function crashCues(c: number): void {
    if (muted || prevCrash < 0) return;
    const crossed = (at: number) => prevCrash < at && c >= at;
    if (crossed(BEATS.filing)) cue('thud', 0.6);
    const stamps = placed.length + 1;
    for (let i = 0; i < stamps; i += 1) if (crossed(BEATS.stamp + i * STAMP_GAP)) cue('stomp', 0.45);
    if (crossed(BEATS.freezer)) {
      cue('creak', 0.6);
      cue('hiss', 0.4);
    }
    for (const p of study.panels) if (crossed(p.at + 0.22)) cue(p.x % 2 ? 'creak' : 'clang', 0.25);
    if (crossed(BEATS.pop)) cue('pop', 0.6);
    if (crossed(BEATS.receipt)) cue('ratchet', 0.3);
  }

  // ─── Bubble layout: each bubble is placed once, beside its speaker, clear of faces, the HUD and each other ───
  function mouthOf(who: string): { x: number; y: number } {
    if (who === 'peterson') return { x: PETERSON.x + 8, y: 246 };
    if (who === 'twins') return { x: 470, y: 296 };
    if (who === 'nephew') return { x: NEPHEW.x - 2, y: 382 };
    const m = member(who);
    if (m) {
      const h = sitterHead(m);
      return { x: h.x, y: h.y + 14 * m.s };
    }
    return HEADS[who as keyof typeof HEADS] ?? { x: 480, y: 300 };
  }

  function faces(): Box[] {
    const out: Box[] = [[PETERSON.x - 26, 196, 60, 64], [NEPHEW.x - 28, 336, 56, 62]];
    const pose = playerPose(secured ? exitAge : -1);
    if (pose.mode === 'seated') out.push([776, 372, 62, 62]);
    else if (pose.mode !== 'gone') out.push([pose.x - 40 * pose.s, pose.y - 236 * pose.s, 76 * pose.s, 150 * pose.s]);
    for (const m of family) {
      if (m.leave >= 0.6) continue;
      const h = sitterHead(m);
      out.push([h.x - 26 * m.s, h.y - 30 * m.s, 52 * m.s, 58 * m.s]);
    }
    return out;
  }

  const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));

  function layout(ctx: CanvasRenderingContext2D, k: number, map: (p: { x: number; y: number }) => { x: number; y: number }, hall: boolean): void {
    const taken: Box[] = [];
    const faceBoxes = faces().map((f): Box => {
      const p = map({ x: f[0], y: f[1] });
      return [p.x, p.y, f[2] * k, f[3] * k];
    });
    if (hall) faceBoxes.push([730, 300, 140, 240]);
    const props = PROPS.map(([f, w]): [Box, number] => {
      const p = map({ x: f[0], y: f[1] });
      return [[p.x, p.y, f[2] * k, f[3] * k], w];
    });
    const hud = outcome ? [...HUD, outcome === 'dodged' ? ([170, 432, 460, 84] as Box) : STAMP_BOX] : secured ? [...HUD, [170, 74, 520, 54] as Box] : HUD;
    const newest = new Map<string, Bubble>();
    for (const b of script.bubbles) newest.set(b.line.who, b);
    for (const b of script.bubbles) {
      const known = placements.get(b);
      const anchor = map(mouthOf(b.line.who));
      if (known) {
        // A bubble being replaced by its speaker's next line, or fading, no longer holds its ground.
        if (b.age < b.life && newest.get(b.line.who) === b) taken.push([anchor.x + known.dx - known.w / 2, anchor.y + known.dy - known.h / 2, known.w, known.h]);
        continue;
      }
      const style = STYLE[b.line.who] ?? { width: 230 };
      const { w, h } = measureBubble(ctx, b.line.text, style, b.line.thought);
      let best: Placement = { dx: 0, dy: -h / 2 - 40, w, h };
      let bestCost = Infinity;
      for (let gy = -9; gy <= 6; gy += 1) {
        for (let gx = -9; gx <= 9; gx += 1) {
          // A grid of centres around the speaker, each pulled inside the frame.
          const cx = clamp(anchor.x + gx * 34, 8 + w / 2, 952 - w / 2);
          const cy = clamp(anchor.y + gy * 26, 10 + h / 2, 530 - h / 2);
          const rect: Box = [cx - w / 2, cy - h / 2, w, h];
          // The tail needs room: the mouth stays outside the bubble, a short reach away.
          const gapX = Math.max(rect[0] - anchor.x, 0, anchor.x - rect[0] - w);
          const gapY = Math.max(rect[1] - anchor.y, 0, anchor.y - rect[1] - h);
          const reach = Math.hypot(gapX, gapY);
          let hard = reach < 12 ? 1e5 : 0;
          for (const r of hud) hard += overlap(rect, r);
          for (const r of faceBoxes) hard += overlap(rect, r);
          for (const r of taken) hard += overlap(rect, r);
          const prefer = PREFER[b.line.who] ?? { x: 0, y: -(h / 2 + 40) };
          let cost = hard * 100 + Math.abs(reach - 26) * 0.8 + Math.hypot(cx - anchor.x - prefer.x * k, cy - anchor.y - prefer.y * k) * 0.35 + (cy > anchor.y ? 60 : 0);
          for (const [r, weight] of props) cost += (overlap(rect, r) * weight) / 400;
          if (cost < bestCost) {
            bestCost = cost;
            best = { dx: cx - anchor.x, dy: cy - anchor.y, w, h };
          }
        }
      }
      placements.set(b, best);
      taken.push([anchor.x + best.dx - w / 2, anchor.y + best.dy - h / 2, w, h]);
    }
  }

  function drawBubbles(ctx: CanvasRenderingContext2D, map: (p: { x: number; y: number }) => { x: number; y: number }): void {
    for (const b of script.bubbles) {
      const at = placements.get(b);
      if (!at) continue;
      const anchor = map(mouthOf(b.line.who));
      const style = STYLE[b.line.who] ?? { width: 230 };
      const x = anchor.x + at.dx;
      const y = anchor.y + at.dy;
      // The tail stops short of the mouth.
      const tx = anchor.x - x;
      const ty = anchor.y - y;
      const len = Math.hypot(tx, ty) || 1;
      const tail = { x: anchor.x - (tx / len) * 10, y: anchor.y - (ty / len) * 10 };
      drawBubble(ctx, b.line.text, { ...style, x, y, tail }, b.pop.x, bubbleAlpha(b), b.line.thought);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
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
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (view.phase === 'running' && !fresh && !crashed) {
        // Seen live: the seat accepts item fourteen, stands, takes the will and walks out with it.
        exitAge = 0;
        say(script, EXIT_LINE, true, true);
        glance = { ...HEADS.you, age: 0 };
        audio.cashout();
      } else exitAge = 99;
    }

    // ─── Phase edges first, so this frame draws the state they leave. Leaving a crash this scene saw live with
    // the ending still playing, the next betting phase waits: the ending plays on as an encore, then the blink. ───
    if (!fresh && view.phase !== previous) {
      // The next round running already: cut the encore short (the blink, the reset) and run.
      if (encore >= 0 && view.phase === 'running') endEncore();
      if (view.phase === 'crashed' && !crashed) beginCrash(view, view.crashAge > 1500);
      if ((view.phase === 'betting' || view.phase === 'waiting') && encore < 0) {
        if (previous === 'crashed' && crashed && !muted && crashClock < BEATS.end) encore = 0;
        else {
          if (crashed || script.next > 0) wipe = 1;
          reset();
        }
      }
      previous = view.phase;
    }
    if (encore >= 0) {
      encore += real;
      crashClock += real;
      if (crashClock >= BEATS.end || encore >= 3.5) endEncore();
    } else if (crashed && view.phase === 'crashed') crashClock = view.crashAge / 1000;
    const encoring = encore >= 0;
    /** The phase the picture plays: still `crashed` through the encore. */
    const phase: SceneView['phase'] = encoring ? 'crashed' : view.phase;
    const multiplier = Math.max(1, (encoring ? crashX100 : view.currentX100) / 100);
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×. A slow log driver keeps long rounds changing.
    const tension = 1 - 1 / multiplier;
    const depth = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = phase === 'running';

    if (fresh) {
      previous = view.phase;
      if (view.phase === 'running' || view.phase === 'crashed') {
        settleScript(script, multiplier);
        settleBeats(multiplier);
        if (secured) {
          badge.x = 1;
          while (regret < REGRET.length && (multiplier / secured.x100) * 100 >= REGRET[regret]![0]) regret += 1;
        }
      }
      settleFamily(family, tension, depth, multiplier, view.phase === 'crashed');
      if (view.phase === 'crashed') beginCrash(view, true);
      settleStudy(study, studyDrive(phase, tension, depth, multiplier), { gerald: multiplier >= 2.8, freezer: multiplier >= 12, sampler: multiplier >= 2.4 });
      settleSpring(hunch, view.phase === 'crashed' ? 1 : running ? smoothstep(0.08, 0.9, tension) : 0);
    }
    // Through the encore the music keeps playing the crash rather than restarting over the ending.
    audio.update(phase, tension);
    const crash = crashed ? crashClock : -1;

    if (phase === 'betting' && !bettingSaid) {
      bettingSaid = true;
      say(script, BETTING_LINE, true);
    }
    if (secured && exitAge >= 0) {
      const before = exitAge;
      exitAge += dt;
      if (before < 3.0 && exitAge >= 3.0 && !muted) cue('whoosh', 0.4);
      if (before < 5.0 && exitAge >= 5.0 && !muted) cue('door', 0.3);
      const past = view.currentX100 / secured.x100;
      if (running && !crashed) while (regret < REGRET.length && past >= REGRET[regret]![0]) say(script, REGRET[regret++]![1]);
    }
    if (crashed) {
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= crash) {
        const line = CRASH_LINES[crashLine++]![1];
        // The lien is read over the items on the table, or, if the crash came first, over the unread will.
        if (!crashLineFits(line, placed.some((p) => !p.b.tag))) continue;
        say(script, line, true, true);
      }
    }
    stepScript(script, multiplier, dt, running && !crashed);
    if (running && !crashed && !fresh) catchUp(view.currentX100);

    // ─── The lines said this frame: page turns, bequests, beats, cues ───
    for (const line of script.events) {
      if (line.who === 'peterson') {
        turnPage(peterson);
        if (hunting) slamOnLine(study);
      }
      if (line.beat) beat(line.beat, true, view.currentX100);
      if (!fresh && !muted) cue(line.who === 'peterson' ? 'whoosh' : line.who === 'gran' ? 'beep' : 'pop', line.who === 'peterson' ? 0.22 : 0.3);
    }
    if (attend) attend.age += dt;
    if (attend && attend.age > 3) attend = null;
    if (glance) glance.age += dt;
    if (glance && glance.age > 3.2) glance = null;
    for (const p of placed) p.pop = Math.min(1, p.pop + dt * 2.6);

    // ─── The set and the cast ───
    const sDrive = studyDrive(phase, tension, depth, multiplier);
    stepStudy(study, sDrive, dt);
    const fire = fireLevel(sDrive);
    if (weather.update(rainLevel(sDrive), fire, dt) && !fresh && !muted) cue('tick', 0.04 + 0.08 * fire);
    const newest = script.bubbles.length ? script.bubbles[script.bubbles.length - 1]! : null;
    const speaker = newest && newest.age < newest.life ? { who: newest.line.who, ...mouthOf(newest.line.who) } : null;
    const cast: CastDrive = { time, tension, depth, running: running && !crashed, crash, speaker, attend, talk: (who) => talking(script, who) };
    const ev = stepFamily(family, cast, dt);
    stepPeterson(peterson, { ...cast, glance: glance && glance.age < 1.4 ? glance : null, exit: secured ? exitAge : -1 }, dt);
    stepNephew(nephew, cast, dt);
    stepSpring(hunch, crashed ? 1 : running && !secured ? smoothstep(0.08, 0.9, tension) : 0, 2.5, 0.85, dt);
    stepSpring(turn, speaker ? clamp((speaker.x - 806) / 300, -1, 1) : -0.6, 6, 0.8, dt);

    // ─── Cues: only on edges this scene saw, never for a settled aftermath ───
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (!fresh && running && !crashed && rung > lastRung) audio.milestone(rung);
    lastRung = rung;
    if (!fresh && !muted) {
      if (study.events.slam) {
        cue('thud', 0.2);
        for (const m of family) if (m.kind.startsWith('twin')) jolt(m, 0.25);
      }
      if (study.events.hum) cue('hiss', 0.1 + 0.15 * tension);
      if (ev.left) cue('door', 0.35);
      if (running && !crashed && !secured) {
        // A quiet heartbeat under the rain, quickening with the tension, until the exit.
        const beatS = 1.4 - 1.05 * tension;
        if ((pulse += dt) >= beatS) {
          pulse -= beatS;
          audio.fx('heartbeat', 0.15 + 0.3 * tension);
        }
      }
      if (crashed) crashCues(crash);
    }
    prevCrash = crash;

    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold = Math.max(0, punchHold - real);
    if (punchHold === 0) stepSpring(punch, 0, 9, 0.85, real);
    shake = Math.max(0, shake - real / 0.5);
    const nextCaption = captionFor(phase, view.currentX100, script.caption, secured, outcome, crash);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);

    // ─── The picture ───
    const hall = outcome === 'dodged' ? (muted ? 1 : smoothstep(0, 0.9, crash)) : 0;
    const k = mix(1, HALL.k, hall);
    const map = (p: { x: number; y: number }) => (hall > 0 ? { x: HALL.cx + (p.x - 480) * k, y: HALL.cy + (p.y - 270) * k } : p);
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    if (punch.x > 0.005) {
      const z = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(z, z);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    ctx.save();
    if (hall > 0) {
      ctx.translate(HALL.cx, HALL.cy);
      ctx.scale(k, k);
      ctx.translate(-480, -270);
      ctx.beginPath();
      ctx.rect(0, 0, 960, 540);
      ctx.clip();
    }
    drawRoom(ctx, view, sDrive, cast, multiplier, depth, crash, outcome ? outcome !== 'watched' : view.stake !== null);
    ctx.restore();
    if (hall > 0) {
      drawHallway(ctx, k, time);
      drawPlayerInHall(ctx, time);
    }
    layout(ctx, k, map, hall > 0);
    drawBubbles(ctx, map);
    ctx.restore();
    if (crashed && crash < 0.12 && !muted) {
      // The flash on the first beat.
      ctx.fillStyle = `rgba(255, 70, 80, ${0.35 * (1 - crash / 0.12)})`;
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
      ctx.translate(430, 56);
      const s = 1 + 0.08 * captionPop.x;
      ctx.scale(s, s);
      memeText(ctx, caption, 0, 0, caption.length > 26 ? 30 : 38, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02 && !outcome) {
      ctx.save();
      ctx.translate(430, 96);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      memeText(ctx, CAPTIONS.exit[0], 0, 0, 22, COLOURS.good, 'center', 500);
      memeText(ctx, `${(secured.x100 / 100).toFixed(2)}×${secured.payout !== null ? ` · +${secured.payout} credits` : ''}`, 0, 21, 14, COLOURS.good, 'center', 300);
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'watched' ? COLOURS.bad : running ? '#ffffff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 68, 54, colour, 'right', 230);
    if (!crashed || crash < BEATS.dark) {
      const inv = inventoryText(placed, multiplier, script.overtimeDue);
      if (placed.length > 0 || running) {
        memeText(ctx, inv.item, 20, 508, 19, COLOURS.accent, 'left', 240);
        memeText(ctx, `ESTATE MELTED ${Math.round(inv.melted * 100)}%`, 20, 530, 15, '#f3d9a8', 'left', 240);
      }
    }
    if (outcome && pop.x > 0.02 && crash >= 0.9) {
      ctx.save();
      // After a dodge the stamp sits on the hall floor, clear of you in the foreground.
      if (outcome === 'dodged') ctx.translate(400, 476);
      else ctx.translate(STAMP_AT.x, STAMP_AT.y);
      ctx.rotate(-0.07);
      const s = clamp(pop.x, 0, 1.25);
      ctx.scale(s, s);
      memeText(ctx, STAMP[outcome], 0, 0, outcome === 'rekt' ? 48 : 38, outcome === 'dodged' ? '#ffe27a' : COLOURS.bad, 'center', 620);
      ctx.restore();
    }
    const detail = outcome === 'dodged' ? [150, 60, 610, 455] : crashed ? [300, 34, 652, 487] : secured && exitAge < 6 ? [250, 120, 560, 418] : undefined;
    const shown = encoring ? { phase, currentX100: crashX100, cashoutX100: secured?.x100 ?? null } : view;
    present(ctx, shown, caption, TITLE, lastLine(script)?.text ?? 'The family waits for the reading.', detail);
  }

  /** Ends the encore: the blink to black, and the study reset for the next round underneath it. */
  function endEncore(): void {
    encore = -1;
    wipe = 1;
    reset();
  }

  function studyDrive(phase: SceneView['phase'], tension: number, depth: number, multiplier: number): StudyDrive {
    const crash = crashed ? crashClock : -1;
    // Grandma follows the reading; a named relative gets a glance; at high tension, the frame's edge.
    let look: { x: number; y: number } | null = glance ? { x: glance.x, y: glance.y } : null;
    if (!look && phase === 'running' && tension > 0.72 && (time % 4.2) < 1.1) look = { x: 960, y: 230 };
    if (crash >= 0) look = crash < BEATS.eyes ? { x: 930, y: 240 } : null;
    return { time, tension, depth, multiplier, running: phase === 'running', crash, seed, look, hunting };
  }

  /** Back to front: the room, Grandma's chair, the family behind the table, the table and the estate on it,
   * Peterson at its head, the player's seat, the nephew at the wrong table, the walk-out, the light. */
  function drawRoom(ctx: CanvasRenderingContext2D, view: SceneView, sd: StudyDrive, cast: CastDrive, multiplier: number, depth: number, crash: number, you: boolean): void {
    drawBackdrop(ctx, study, sd);
    drawArmchair(ctx, sd);
    drawChairs(ctx);
    for (const m of family) drawSitter(ctx, m, cast);
    drawTable(ctx);
    const assistant = member('assistant');
    if (assistant) drawLeaveNote(ctx, assistant);
    // The estate, back to front, melting; at the crash every kept item is stamped COLLATERAL.
    const items = placed.filter((p) => !p.b.tag).sort((a, b) => a.b.y - b.b.y);
    const order = [...placed].filter((p) => !p.b.tag).sort((a, b) => a.b.n - b.b.n);
    for (const p of items) {
      const i = order.indexOf(p);
      const stamp = crash >= 0 ? crash - (BEATS.stamp + i * STAMP_GAP) : -1;
      drawBequest(ctx, p, multiplier, depth, time, stamp > 0 ? stamp : 0, p.b.beat === 'gran' ? talking(script, 'gran') : 0);
    }
    drawFallenDoily(ctx, study, sd);
    for (const m of family) drawSitterHands(ctx, m, cast);
    // The will, put down at the crash (it becomes a receipt in the dark, drawn over the light below).
    if (crash >= BEATS.will + 0.24 && crash < BEATS.receipt) drawDocument(ctx, WILL_ON_TABLE.x, WILL_ON_TABLE.y, secured ? 'COPY' : 'WILL', 1, 0);
    drawPeterson(ctx, peterson, { ...cast, glance: glance && glance.age < 1.4 ? glance : null, exit: secured ? exitAge : -1 });
    // The player's seat at the near end: seated from behind, then the walk to Peterson and out.
    const pose = playerPose(secured ? exitAge : -1);
    const pushed = secured ? smoothstep(0, 0.6, exitAge) : 0;
    drawSeatChair(ctx, pushed);
    if (pose.mode === 'seated') drawPlayerSeated(ctx, pose, cast, clamp(hunch.x, 0, 1.2), turn.x);
    drawSeatBack(ctx, pushed);
    if (pose.mode === 'seated' && you) drawYouTag(ctx, pose.x, pose.y - 112 + 7 * clamp(hunch.x, 0, 1), time);
    drawNephew(ctx, nephew, cast, { multiplier, elapsed: view.elapsed / 1000 });
    drawCoffeeTable(ctx, sd, crash >= 0 ? Math.max(0, crash - (BEATS.stamp + placed.filter((p) => !p.b.tag).length * STAMP_GAP)) : 0);
    if (pose.mode === 'walking' || pose.mode === 'handover') {
      drawPlayerWalking(ctx, pose, exitAge);
      drawYouTag(ctx, pose.x - 4 * pose.s, pose.y - 226 * pose.s, time);
    }
    drawLighting(ctx, sd);
    if (freezerOpen(crash) > 0.05 && crash >= BEATS.dark) {
      // In the dark, the freezer's cold light is the last light in the room.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cold = ctx.createRadialGradient(918, 250, 20, 900, 330, 260);
      cold.addColorStop(0, `rgba(130, 200, 255, ${0.2 * smoothstep(BEATS.dark, BEATS.dark + 1, crash)})`);
      cold.addColorStop(1, 'rgba(130, 200, 255, 0)');
      ctx.fillStyle = cold;
      ctx.fillRect(640, 80, 320, 460);
      ctx.restore();
    }
    drawOpenRain(ctx, sd);
    if (crash >= BEATS.receipt) drawReceipt(ctx, WILL_ON_TABLE.x, WILL_ON_TABLE.y + 4, smoothstep(BEATS.receipt, BEATS.receipt + 0.9, crash));
  }

  return { draw };
}

function captionFor(phase: SceneView['phase'], x100: number, said: string, secured: { x100: number } | null, outcome: Outcome | null, crash: number): string {
  if (outcome) {
    if (outcome === 'dodged') return CAPTIONS.dodged;
    if (crash < BEATS.end) {
      let text = CRASH_CAPTIONS[0]![1];
      for (const [at, c] of CRASH_CAPTIONS) if (crash >= at) text = c;
      return text;
    }
    return CRASH_CAPTIONS[Math.floor((crash - BEATS.end) / 1.8) % CRASH_CAPTIONS.length]![1];
  }
  if (phase === 'waiting') return CAPTIONS.waiting;
  if (secured) {
    if (x100 / secured.x100 >= 1.5) return CAPTIONS.kept;
    return CAPTIONS.exit[1];
  }
  return said;
}

