/**
 * MAFO: Meth Around & Find Out. Composes Cookin' with Junior from the round: a cooking show filmed in the kitchen of
 * a single-wide trailer, seen in cutaway. Junior stirs his Mamaw's turkey fryer with a canoe paddle and walks the
 * show up the displayed multiplier: the brew goes from creek water to country blue, the gauge pins and is swapped
 * for a bigger one, the jars fill, the trailer rocks, the possum faints, Miss Darlene calls Sheriff Boyd through the
 * kitchen window and his cousin, the player, armours up in a lawn chair. An accepted cash-out is the cousin going to
 * get ice: out the front door to crouch behind the pickup while the camera pulls out to the yard. The crash is the
 * trailer finding out: a record scratch, the last bad idea, a cut outside, crickets, and the blast that throws the
 * roof, the fridge and Junior across the yard. This file owns the clocks, the phase edges, the beats, the cues, the
 * camera, the draw order, the bubbles and the HUD. Nothing here reads or changes the committed outcome: the crash
 * point is used only once the crash has happened, to seed how the blast falls.
 */
import { type Effect, pageAudio } from './audio';
import {
  type Blast, createBlast, drawDebris, drawDebrisBack, drawFireball, drawGlitter, drawSmoke, drawTankRocket, drawWallsFalling, fridgeAt, landings,
} from './blast';
import { chairLanding, CHAIR_LAND, cuzLayer, cuzPose, type CuzDrive, doorAt, drawChair, drawCooler, drawCuz, drawCuzFlying, drawYouTag, EXIT_DONE, exitSpot, gearAt } from './cuz';
import { DARLENE_AT, darleneLights, type DarleneState, drawDarlene, drawDog, drawPossum, drawSheriff, drawUfo, SHERIFF_AT, sirenWash } from './critters';
import { type BubblePlace, drawBubble, measureBubble, memeText, setInkScale } from './ink';
import {
  AFTER, BOOM, capAt, createJunior, CUT, drawCapAlone, drawJuniorArms, drawJuniorBody, drawJuniorFlying, drawPour, flightAt, freeBusy, gestureFree, gestureStir, hangUp,
  holding, type JuniorDrive, juniorPose, type Landing, landedMouth, landTime, type Look, resetJunior, settleJunior, stepJunior, type Trigger,
} from './junior';
import { applyCam, BLAST, type Cam, CHAIR, EXIT, HIDE, JUNIOR, KNOB, mixCam, POSSUM, SHOW, TANK, toScreen, TRAILER } from './layout';
import {
  ABDUCTED_LINE, BADGE, BETTING_LINE, CAPTIONS, CUZ_DODGED_LINE, CUZ_FLEW_LINE, DARLENE_LINE, EXIT_LINE, EXIT_REPLY, LADDER, LANDED_LINES, OVERTIME, REGRET, RUNGS,
  shadeAt, STAMP, SWAP_LINES, TITLE, TRIGGER_LINES,
} from './lines';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { createPortrait } from './portrait';
import { type Bubble, bubbleAlpha, createScript, hush, lastLine, resetScript, say, settleScript, stepScript, talking } from './script';
import { pageSound } from './sound';
import {
  BEER_HOME, brewRgb, createStill, drawBeerCan, drawHose, drawJar, drawJug, drawPot, drawSteam, drawTank, frostAt, gaugeLevelAt, gaugeName, glowAt, ignite, jugHome,
  type JugKind, mountGauge, psiAt, resetStill, settleStill, type StillDrive, stepStill, TANK_VALVE, turnUp, yankGauge,
} from './still';
import {
  drawBackdrop, drawCounter, drawGlow, drawInterior, drawPoolFront, drawShell, drawSpill, drawSteps, drawTruck, drawTruckBedFront, drawWreck, drawYard, type WorldDrive,
} from './world';

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

const COLOURS = { accent: '#4fb6ff', bad: '#ff5d73', good: '#7cf67c', amber: '#ffe27a', text: '#f4efe2' } as const;

// ─── The crash clock ────────────────────────────────────────────────────────────────────────────────────────────
/** A hit-stop on the record scratch, and another on the blast, with a slow beat after it. */
const F1 = 0.1;
const F2 = 0.12;
const SLOW = 0.35;
const SLOW_RATE = 0.3;
/** Real seconds since the crash → choreography seconds: frozen, normal to the boom, frozen, slow, normal. */
function crashWarp(s: number): number {
  if (s <= F1) return 0;
  let c = s - F1;
  if (c <= BOOM) return c;
  c -= BOOM;
  if (c <= F2) return BOOM;
  c -= F2;
  if (c <= SLOW) return BOOM + c * SLOW_RATE;
  return BOOM + SLOW * SLOW_RATE + (c - SLOW);
}
/** How fast the choreography runs at real crash time `s` (0 in a freeze), for everything stepped with dt. */
const warpRate = (s: number): number => (s <= F1 ? 0 : s <= F1 + BOOM ? 1 : s <= F1 + BOOM + F2 ? 0 : s <= F1 + BOOM + F2 + SLOW ? SLOW_RATE : 1);
/** The final image is complete by this much real crash time; a live crash plays on into betting until then. */
const ENDING_S = 5.4;
const ENCORE_MAX_S = 3.5;
const WIPE_S = 0.45;
/** The stamp lands at this choreography time. */
const STAMP_AT = 3.9;
/** The camera has pushed in on where he came down this long after he lands; the aftermath's lines wait for it. */
const SETTLED = 0.6;

// ─── Bubbles ────────────────────────────────────────────────────────────────────────────────────────────────────
const STYLE: Record<string, Pick<BubblePlace, 'width' | 'name' | 'fill' | 'font'>> = {
  junior: { width: 250 },
  cuz: { width: 220, name: 'Cuz' },
  darlene: { width: 230, name: 'Miss Darlene, across the road', fill: '#ffe3ef', font: '800 15px "Trebuchet MS", "Segoe UI", system-ui, sans-serif' },
  sheriff: { width: 250, name: 'Sheriff Boyd, on the bullhorn', fill: '#fff4d6', font: '800 15px "Trebuchet MS", "Segoe UI", system-ui, sans-serif' },
  mamaw: { width: 240, name: 'Mamaw, on speaker', fill: '#f1e6ff', font: 'italic 800 15px "Trebuchet MS", "Segoe UI", system-ui, sans-serif' },
};
const PREFER: Record<string, { x: number; y: number }> = { junior: { x: -170, y: -100 }, cuz: { x: 60, y: -110 }, darlene: { x: -40, y: -90 }, sheriff: { x: -60, y: 70 }, mamaw: { x: -170, y: -10 } };
interface Placement { dx: number; dy: number; w: number; h: number }

export function createScene(): Scene {
  // A hoedown in a major key with a root-fifth bass, quickening with the pressure; the crash is a record scratch.
  const audio = pageAudio({ style: 'casino', crash: 'scratch', bpm: 118, tempoRise: 0.5 });
  const sound = pageSound(audio);
  const { capture, present } = createPortrait(TITLE, [150, 40, 660, 500], COLOURS.accent, 'WENT FOR ICE', 'LIVE FROM THE TRAILER');
  const script = createScript(LADDER, OVERTIME);
  const still = createStill();
  const junior = createJunior();
  const placements = new WeakMap<Bubble, Placement>();
  const lastCue = new Map<Effect, number>();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const lurch = spring(0);
  const possumDead = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let secured: { x100: number; payout: number | null } | null = null;
  let exitAge = 0;
  let exitLive = false;
  let outcome: Outcome | null = null;
  let crashed = false;
  let muted = false;
  let crashX100 = 100;
  let crashClock = 0;
  let ct = -1;
  let prevCt = -1;
  let encore = -1;
  let wipe = 0;
  let shake = 0;
  let caption = '';
  let bettingSaid = false;
  let lastRung = 0;
  let regret = 0;
  let blast: Blast | null = null;
  let trigger: Trigger = 'beer';
  let landing: Landing = 'pool';
  let cuzSlot = 0;
  let landedLine = LANDED_LINES[0]!;
  let gogglesDown = false;
  let swapsQueued = 0;
  let possumUntil = -1;
  let darlene: DarleneState = 'tv';
  let sheriffAt = -1;
  let sheriffOut = false;
  let ufoAt = -1;
  let rockPhase = 0;
  let sipIn = 7;
  let wipeIn = 6;
  let cuzSipAt = -9;
  let cuzSipIn = 5;
  let creakIn = 4;
  let stepsSeen = 0;
  let doorWas = 0;
  let afterSaid = new Set<string>();

  function cue(name: Effect, strength: number): void {
    if (muted) return;
    const prev = lastCue.get(name) ?? -9;
    if (time - prev < 0.08) return;
    lastCue.set(name, time);
    audio.fx(name, strength);
  }

  function reset(): void {
    resetScript(script);
    resetStill(still);
    resetJunior(junior);
    secured = null;
    exitAge = 0;
    exitLive = false;
    outcome = null;
    crashed = false;
    muted = false;
    crashClock = 0;
    ct = prevCt = -1;
    encore = -1;
    regret = lastRung = 0;
    shake = 0;
    bettingSaid = false;
    blast = null;
    gogglesDown = false;
    swapsQueued = 0;
    possumUntil = -1;
    darlene = 'tv';
    sheriffAt = -1;
    sheriffOut = false;
    ufoAt = -1;
    stepsSeen = 0;
    doorWas = 0;
    afterSaid = new Set();
    settleSpring(pop, 0);
    settleSpring(badge, 0);
    settleSpring(lurch, 0);
    settleSpring(possumDead, 0);
  }

  /** Everything the multiplier calls for, for a scene that missed the round's start: each prop as its line left it. */
  function settleFrom(multiplier: number): void {
    const past = (name: string) => multiplier >= (LADDER.find((l) => l.beat === name)?.at ?? Infinity);
    gogglesDown = past('goggles');
    darlene = past('darlene:chair') ? 'chair' : past('darlene:porch') ? 'porch' : past('darlene:window') ? 'window' : 'tv';
    if (past('sheriff')) {
      sheriffAt = time - 9;
      sheriffOut = !past('sheriff:car');
    }
    if (past('ufo')) ufoAt = time - 9;
    settleSpring(possumDead, multiplier >= 10 ? 1 : 0);
  }

  /** A line's prop beat, when the line is said live. */
  function beat(name: string): void {
    const [kind, arg] = name.split(':');
    switch (kind) {
      case 'ignite':
        gestureStir(junior, 'ignite');
        break;
      case 'pour':
        gestureFree(junior, 'pour', (arg ?? 'xxx') as JugKind);
        break;
      case 'goggles':
        gestureFree(junior, 'goggles');
        break;
      case 'possum':
        possumUntil = time + 4.5;
        cue('squeak', 0.5);
        break;
      case 'point':
        gestureFree(junior, 'point', undefined, true);
        break;
      case 'darlene':
        darlene = (arg ?? 'window') as DarleneState;
        cue(arg === 'porch' ? 'door' : 'click', 0.35);
        break;
      case 'tap':
        gestureStir(junior, 'tap');
        break;
      case 'phone':
        gestureFree(junior, 'phone');
        break;
      case 'hangup':
        hangUp(junior);
        break;
      case 'wobble':
        lurch.v += 0.06;
        cue('creak', 0.8);
        break;
      case 'turnup':
        gestureStir(junior, 'turnup');
        break;
      case 'swap':
        gestureStir(junior, 'swap');
        break;
      case 'sheriff':
        if (arg === 'car') sheriffOut = false;
        else {
          sheriffAt = time;
          sheriffOut = true;
          cue('siren', 0.35);
          cue('engine', 0.3);
        }
        break;
      case 'ufo':
        ufoAt = time;
        cue('zap', 0.5);
        break;
    }
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    crashed = true;
    crashX100 = view.currentX100;
    crashClock = view.crashAge / 1000;
    ct = crashWarp(crashClock);
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    blast = createBlast(crashX100);
    // The last bad idea and the landing, seeded by the crash point now that it is known.
    const rng = mulberry32(crashX100 * 13 + 7);
    const r = rng();
    trigger = crashX100 < 105 ? 'ignite' : r < 0.36 ? 'beer' : r < 0.6 ? 'smoke' : r < 0.8 ? 'sneeze' : 'tap';
    const spots: Landing[] = ['pool', 'truck', 'tree'];
    landing = crashX100 >= 7000 ? 'ufo' : spots[Math.floor(rng() * 3)]!;
    cuzSlot = Math.floor(rng() * 3);
    landedLine = LANDED_LINES[Math.floor(rng() * LANDED_LINES.length)]!;
    hush(script);
    for (const b of script.bubbles) b.life = Math.min(b.life, b.age + 0.5);
    if (secured && exitAge < EXIT_DONE && ct >= CUT) exitAge = EXIT_DONE;
    if (quiet) {
      muted = true;
      script.bubbles = [];
      settleSpring(pop, ct >= STAMP_AT ? 1 : 0);
      audio.crash('scratch', true);
      sound.cut();
      prevCt = ct;
      return;
    }
    shake = 0.4;
    audio.crash('scratch');
    sound.cut();
    prevCt = -1;
  }

  /** The crash's beats as sound and lines, on the edges of the choreography clock this scene saw. */
  function crashBeats(): void {
    if (!blast) return;
    const crossed = (at: number) => prevCt < at && ct >= at;
    const live = !muted && prevCt >= 0;
    for (const [at, line] of TRIGGER_LINES[trigger]) if (crossed(at) && live) say(script, line, true, true);
    if (!live) return;
    if (trigger === 'smoke' && crossed(0.27)) cue('click', 0.6);
    if (trigger === 'sneeze' && crossed(0.32)) cue('whoosh', 0.6);
    if (trigger === 'tap' && (crossed(0.18) || crossed(0.3))) cue('tick', 0.7);
    if (trigger === 'tap' && crossed(0.3)) cue('shatter', 0.15);
    if (trigger === 'ignite' && crossed(0.05)) cue('whoosh', 0.5);
    // Outside: two chirps of a cricket, then the boom.
    if (crossed(CUT + 0.02) || crossed(CUT + 0.08)) cue('squeak', 0.18);
    if (crossed(BOOM)) {
      cue('boom', 1);
      cue('shatter', 0.8);
      cue('whoosh', 0.7);
      sound.blast();
      shake = 1;
    }
    const u = ct - BOOM;
    const was = prevCt - BOOM;
    const after = (at: number) => was < at && u >= at;
    if (after(0.12)) cue('yeet', 0.6);
    if (after(0.08)) cue('whistle', 0.55);
    const T = landTime(landing);
    if (after(T)) {
      if (landing === 'pool') cue('splash', 0.9);
      else if (landing === 'truck') {
        cue('thud', 0.9);
        cue('clang', 0.4);
      } else if (landing === 'tree') {
        cue('creak', 0.8);
        cue('thud', 0.35);
      } else cue('zap', 0.7);
    }
    if (outcome !== 'dodged' && after(CHAIR_LAND)) {
      cue('thud', 0.6);
      cue('squeak', 0.3);
    }
    for (const l of landings(blast)) if (after(l.at)) cue(l.kind === 'roof' ? 'clang' : 'thud', l.kind === 'roof' ? 0.7 : 0.2);
    if (landing !== 'ufo') {
      if (after(T + AFTER.cough)) cue('chuff', 0.45);
      if (after(T + AFTER.cap)) cue('pop', 0.3);
    }
    if (after(3.6)) cue('ding', 0.4);
    if (crossed(STAMP_AT)) cue('stomp', 0.6);
    if (crossed(STAMP_AT + 0.3)) cue('siren', 0.4);
    // The aftermath's lines, a beat apart and in order, each placed once the camera has settled: the cousin once
    // his chair is down, Junior once his cap is back on, then Miss Darlene with her video.
    const sayOnce = (key: string, at: number, line: Parameters<typeof say>[1]) => {
      if (!afterSaid.has(key) && u >= at) {
        afterSaid.add(key);
        say(script, line);
      }
    };
    if (landing === 'ufo') sayOnce('junior', 1.6, { who: 'junior', text: ABDUCTED_LINE, life: 2.6 });
    else sayOnce('junior', T + AFTER.line, { who: 'junior', text: landedLine, life: 2.4 });
    if (outcome === 'dodged') sayOnce('cuz', Math.max(2, T + SETTLED), { who: 'cuz', text: CUZ_DODGED_LINE, life: 2.2 });
    else sayOnce('cuz', Math.max(CHAIR_LAND + 0.7, T + SETTLED), { who: 'cuz', text: CUZ_FLEW_LINE, life: 2.4 });
    sayOnce('darlene', 3.7, { who: 'darlene', text: DARLENE_LINE, life: 2 });
  }

  // ─── Bubble layout: each bubble placed once, beside its speaker, clear of faces, the HUD and each other ───
  const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  function layout(ctx: CanvasRenderingContext2D, anchors: Record<string, { x: number; y: number }>, faces: Box[], hud: Box[]): void {
    const taken: Box[] = [];
    const newest = new Map<string, Bubble>();
    for (const b of script.bubbles) newest.set(b.line.who, b);
    for (const b of script.bubbles) {
      const anchor = anchors[b.line.who] ?? { x: 480, y: 270 };
      const known = placements.get(b);
      if (known) {
        if (b.age < b.life && newest.get(b.line.who) === b) taken.push([anchor.x + known.dx - known.w / 2, anchor.y + known.dy - known.h / 2, known.w, known.h]);
        continue;
      }
      const style = STYLE[b.line.who] ?? { width: 230 };
      const { w, h } = measureBubble(ctx, b.line.text, style, b.line.thought);
      let best: Placement = { dx: 0, dy: -h / 2 - 40, w, h };
      let bestCost = Infinity;
      const prefer = PREFER[b.line.who] ?? { x: 0, y: -(h / 2 + 40) };
      for (let gy = -9; gy <= 7; gy += 1) {
        for (let gx = -10; gx <= 10; gx += 1) {
          const cx = clamp(anchor.x + gx * 32, 8 + w / 2, 952 - w / 2);
          const cy = clamp(anchor.y + gy * 26, 44 + h / 2, 488 - h / 2);
          const rect: Box = [cx - w / 2, cy - h / 2, w, h];
          const gapX = Math.max(rect[0] - anchor.x, 0, anchor.x - rect[0] - w);
          const gapY = Math.max(rect[1] - anchor.y, 0, anchor.y - rect[1] - h);
          const reach = Math.hypot(gapX, gapY);
          let hard = reach < 10 ? 1e5 : 0;
          for (const r of hud) hard += overlap(rect, r);
          for (const r of faces) hard += overlap(rect, r);
          for (const r of taken) hard += overlap(rect, r);
          const cost = hard * 100 + Math.abs(reach - 24) * 0.8 + Math.hypot(cx - anchor.x - prefer.x, cy - anchor.y - prefer.y) * 0.3;
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
  function drawBubbles(ctx: CanvasRenderingContext2D, anchors: Record<string, { x: number; y: number }>, staked: boolean): void {
    for (const b of script.bubbles) {
      const at = placements.get(b);
      if (!at) continue;
      const anchor = anchors[b.line.who] ?? { x: 480, y: 270 };
      const style = STYLE[b.line.who] ?? { width: 230 };
      const x = anchor.x + at.dx;
      const y = anchor.y + at.dy;
      const tx = anchor.x - x;
      const ty = anchor.y - y;
      const len = Math.hypot(tx, ty) || 1;
      const tail = { x: anchor.x - (tx / len) * 8, y: anchor.y - (ty / len) * 8 };
      const name = b.line.who === 'cuz' && staked ? 'Cuz (you)' : style.name;
      drawBubble(ctx, b.line.text, { ...style, name, x, y, tail }, b.pop.x, bubbleAlpha(b), b.line.thought);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, input: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // ─── The encore: a crash this scene saw live plays on into the next betting phase until its ending is done ───
    if (encore >= 0) {
      encore += real;
      crashClock += real;
    } else if (crashed && !muted && previous === 'crashed' && (input.phase === 'betting' || input.phase === 'waiting') && crashClock < ENDING_S) encore = 0;
    let view = input;
    if (encore >= 0) {
      if (input.phase === 'running' || input.phase === 'crashed' || crashClock >= ENDING_S || encore >= ENCORE_MAX_S) {
        encore = -1;
        wipe = 1;
        reset();
        // An instant next round may go straight from betting to crashed: that new crash is handled below.
        previous = input.phase === 'crashed' ? 'betting' : input.phase;
      } else view = { ...input, phase: 'crashed', currentX100: crashX100, crashAge: crashClock * 1000 };
    } else if (input.phase === 'crashed' && crashed) crashClock = input.crashAge / 1000;
    const dt = crashed ? real * warpRate(crashClock) : real;
    time += dt;
    const fresh = previous === null;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×. A slow log driver keeps long rounds changing.
    const tension = 1 - 1 / multiplier;
    const depth = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = view.phase === 'running';

    // ─── The confirmed exit ───
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running && !fresh && !crashed) {
        exitAge = 0;
        exitLive = true;
        say(script, EXIT_LINE, true, true);
        say(script, EXIT_REPLY);
        badge.v = 8;
        audio.cashout();
      } else {
        exitAge = EXIT_DONE + 1;
        settleSpring(badge, 1);
      }
    }

    // ─── Phase edges ───
    if (fresh) {
      previous = view.phase;
      if (view.phase === 'running' || view.phase === 'crashed') {
        settleScript(script, multiplier);
        settleFrom(multiplier);
        if (secured) while (regret < REGRET.length && multiplier / secured.x100 >= REGRET[regret]![0]) regret += 1;
      }
      // A round already under way (or already over) has its burner lit, its gauges swapped and its jars filled.
      const sd = stillDrive(multiplier, tension, depth, view.phase === 'running' || view.phase === 'crashed');
      settleStill(still, sd);
      swapsQueued = still.level;
      settleJunior(junior, juniorDrive(multiplier, tension, depth, false, 'pot'), gogglesDown);
      if (view.phase === 'crashed') beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (view.phase === 'crashed' && !crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting' || view.phase === 'waiting') {
        if (crashed || script.next > 0) wipe = 1;
        reset();
      }
      // The show starts: the welcome is cut short so step one comes straight away.
      if (view.phase === 'running') for (const b of script.bubbles) b.life = Math.min(b.life, b.age + 0.15);
      previous = view.phase;
    }
    const live = running && !crashed;
    if (crashed) {
      prevCt = ct;
      ct = crashWarp(crashClock);
      if (prevCt < 0 && !muted) prevCt = -0.0001;
    }
    audio.update(view.phase, tension);
    sound.update(tension, still.flame.x + still.flare, live && still.lit);

    if (view.phase === 'betting' && !bettingSaid) {
      bettingSaid = true;
      say(script, BETTING_LINE, true);
    }
    if (secured) {
      exitAge += dt;
      if (crashed && ct >= CUT && exitAge < EXIT_DONE) exitAge = EXIT_DONE;
      if (live) while (regret < REGRET.length && view.currentX100 / secured.x100 >= REGRET[regret]![0]) say(script, REGRET[regret++]![1]);
    }
    // The gauge pins: queue the swap (and its line) once per gauge.
    if (live && !fresh) {
      const want = gaugeLevelAt(multiplier);
      if (want > swapsQueued) {
        const line = SWAP_LINES[Math.min(swapsQueued, SWAP_LINES.length - 1)]!;
        say(script, { ...line, beat: 'swap' }, true);
        swapsQueued += 1;
      }
      // A fast curve can outrun the swaps: catch up quietly so the gauge never lags by more than one.
      if (want - still.level >= 2) mountGauge(still);
      if (!still.lit && multiplier >= 1.12) ignite(still);
    }
    if (crashed) crashBeats();
    stepScript(script, multiplier, dt, live);
    for (const line of script.events) {
      if (line.beat && live) beat(line.beat);
      if (!fresh) cue(line.who === 'sheriff' ? 'beep' : line.who === 'mamaw' ? 'beep' : 'pop', line.who === 'darlene' || line.who === 'sheriff' ? 0.18 : 0.26);
    }

    // ─── Idle business: sips, a wipe of the brow, the cousin's beer ───
    if (live) {
      if ((sipIn -= dt) <= 0) {
        sipIn = 8 + 4 * noise(time);
        if (!freeBusy(junior) && talking(script, 'junior') < 0.1 && tension < 0.85) gestureFree(junior, 'sip', undefined, true);
      }
      if (tension > 0.5 && (wipeIn -= dt) <= 0) {
        wipeIn = 6 + 3 * noise(time * 1.3);
        if (!freeBusy(junior) && talking(script, 'junior') < 0.1) gestureFree(junior, 'wipe', undefined, true);
      }
      if ((creakIn -= dt) <= 0) {
        creakIn = 3 + 3 * noise(time * 0.7);
        if (tension > 0.55) cue('creak', 0.15 + 0.2 * tension);
      }
    }
    if ((cuzSipIn -= dt) <= 0) {
      cuzSipIn = 6 + 5 * noise(time * 2.1);
      if (!secured && !crashed && talking(script, 'cuz') < 0.1) cuzSipAt = time;
    }

    // ─── Who looks where ───
    let look: Look = time % 7 < 4.5 ? 'pot' : 'camera';
    if (tension > 0.6 && time % 5 < 0.9) look = 'gauge';
    if (talking(script, 'cuz') > 0.1) look = 'cuz';
    if (talking(script, 'darlene') > 0.1 || talking(script, 'sheriff') > 0.1) look = 'window';

    // ─── Step the cook and the contraption ───
    const jd = juniorDrive(multiplier, tension, depth, live, look);
    stepJunior(junior, jd, dt, gogglesDown);
    if (!fresh && !muted) {
      if (junior.events.ignite) {
        ignite(still);
        cue('whoosh', 0.8);
        cue('boom', 0.12);
      }
      if (junior.events.glug) cue('glug', 0.6);
      if (junior.events.sip) cue('glug', 0.22);
      if (junior.events.ring) cue('phone', 0.55);
      if (junior.events.tap) cue('tick', 0.55);
      if (junior.events.yank) {
        yankGauge(still);
        cue('ratchet', 0.5);
      }
      if (junior.events.mount) {
        mountGauge(still);
        cue('clang', 0.45);
      }
      if (junior.events.turn) {
        turnUp(still);
        cue('whoosh', 0.5);
        cue('hiss', 0.25);
      }
      if (junior.events.goggles) {
        gogglesDown = true;
        cue('squeak', 0.4);
      }
    } else {
      if (junior.events.ignite) ignite(still);
      if (junior.events.mount) mountGauge(still);
      if (junior.events.yank) yankGauge(still);
      if (junior.events.goggles) gogglesDown = true;
      if (junior.events.turn) turnUp(still);
    }
    const sd = stillDrive(multiplier, tension, depth, live);
    sd.held = holding(junior, jd);
    stepStill(still, sd, dt);
    if (!fresh && live) {
      if (still.events.jar) cue('ding', 0.35);
      if (still.events.jiggle) cue('tick', 0.04 + 0.1 * tension);
      if (still.events.hiss) cue('hiss', 0.12);
      if (still.events.bubble && (lastCue.get('bubble') ?? -9) < time - 0.25) cue('bubble', 0.18 + 0.15 * tension);
    }

    // ─── The rest of the house ───
    rockPhase += dt * (1.4 + 4.5 * tension);
    stepSpring(lurch, 0, 5, 0.25, dt);
    const possumDown = crashed || possumUntil > time || multiplier >= 10;
    stepSpring(possumDead, possumDown ? 1 : 0, 9, 0.5, dt);
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (!fresh && live && rung > lastRung) {
      audio.milestone(rung);
      lurch.v += 0.02;
    }
    lastRung = rung;

    // The cousin's walk out: footsteps and the door.
    const exitE = secured ? exitAge : null;
    if (secured && exitLive && !muted) {
      const spot = exitSpot(exitAge);
      const steps = Math.floor(spot.walked / 33);
      if (steps > stepsSeen && spot.phase !== 'hid') cue('thud', 0.12);
      stepsSeen = steps;
      const door = doorAt(exitAge);
      if (doorWas < 0.1 && door >= 0.1) cue('door', 0.5);
      if (doorWas > 0.5 && door <= 0.5) cue('door', 0.3);
      doorWas = door;
    }

    // ─── Outcome stamp, badge, caption ───
    stepSpring(pop, outcome && ct >= STAMP_AT ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured && !outcome ? 1 : 0, 14, 0.5, dt);
    shake = Math.max(0, shake - real / 0.9);
    const nextCaption = captionFor(view.phase);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);

    // ─── The camera ───
    const u = crashed ? ct - BOOM : -1;
    const boom = crashed && u >= 0;
    let cam: Cam = SHOW;
    if (secured) cam = mixCam(SHOW, EXIT, smoothstep(0.6, 2.8, exitAge));
    if (crashed) {
      if (ct < CUT) {
        const punch = smoothstep(0, 0.25, ct);
        const target: Cam = secured ? { cx: cam.cx + 120, cy: cam.cy - 20, s: cam.s * 1.12 } : { cx: JUNIOR.x + 50, cy: 236, s: 1.16 };
        cam = mixCam(cam, target, punch * 0.9);
      } else {
        cam = BLAST;
        if (landing !== 'ufo' && u > 0) {
          // Once he is down, ease in on the wreck, where he landed and where the cousin is.
          const T = landTime(landing);
          const spot = landedMouth(landing, T + 1);
          const cuzAt = outcome === 'dodged' ? { x: HIDE.x, y: HIDE.ground - 200 } : chairLanding(cuzSlot);
          const xs = [-200, 900, spot.x, cuzAt.x];
          const ys = [300, 620, spot.y - 40, cuzAt.y - 60, spot.y + 160];
          const x0 = Math.min(...xs) - 260;
          const x1 = Math.max(...xs) + 260;
          const y0 = Math.min(...ys) - 200;
          const y1 = Math.max(...ys) + 220;
          const s = clamp(Math.min(960 / (x1 - x0), 540 / (y1 - y0)), BLAST.s, 0.4);
          const focus: Cam = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s };
          cam = mixCam(BLAST, focus, smoothstep(T + 0.1, T + SETTLED, u));
        }
      }
    }
    const inkScale = Math.max(1, 0.5 / cam.s);

    // ─── Drives for the set ───
    const brew = brewRgb(tension);
    const glow = still.lit ? glowAt(tension, depth) : 0;
    const flicker = still.lit && tension > 0.6 && noise(Math.floor(time * 14)) > 0.93 ? 0.35 : 1;
    // Shake and the trailer's rock move things a few pixels at most.
    const margin = 24 / cam.s;
    const seen = { x0: cam.cx - 480 / cam.s - margin, x1: cam.cx + 480 / cam.s + margin, y0: cam.cy - 270 / cam.s - margin, y1: cam.cy + 270 / cam.s + margin };
    const wd: WorldDrive = {
      time, tension, depth, multiplier, running: live, lit: still.lit, crash: crashed ? ct : -1, boom, brew, glow, px: 1 / cam.s, door: doorAt(exitE), jars: still.jars, level: still.level,
      bulb: crashed && ct > 0.05 ? 1 : flicker, view: seen, windowOnly: !boom && cam.s > 0.95,
    };
    const outdoors = seen.y1 > TRAILER.base || seen.x0 < -40 || seen.x1 > 1000;
    const rock = (crashed ? 0 : (0.0015 + 0.009 * tension * tension) * Math.sin(rockPhase)) + lurch.x;
    const lift = crashed ? 0 : 26 * smoothstep(2, 2.6, Math.log10(multiplier)) * (1 + 0.15 * Math.sin(time * 1.3));
    const swell = crashed && ct >= CUT ? 1 + 0.05 * smoothstep(CUT, BOOM, ct) : 1;
    // The trailer rocks as a sway on its blocks (a shove and a little lift), which keeps the cached walls aligned.
    const sway = { x: rock * 340, y: -Math.abs(rock) * 60 - lift };
    const trailerAt = (p: { x: number; y: number }): { x: number; y: number } => ({ x: 270 + (p.x + sway.x - 270) * swell, y: 360 + (p.y + sway.y - 360) * swell });
    const pose = juniorPose(junior, jd, still);
    const cd: CuzDrive = { time, tension, multiplier, exit: exitE, talking: talking(script, 'cuz'), sip: time - cuzSipAt < 1.6 ? (time - cuzSipAt) / 1.6 : -1, duck: outcome === 'dodged' && boom ? u : -1 };
    const cp = cuzPose(cd);
    const gear = gearAt(crashed ? crashX100 / 100 : multiplier);

    // ─── The picture ───
    ctx.save();
    ctx.fillStyle = '#0c1022';
    ctx.fillRect(0, 0, 960, 540);
    if (shake > 0) ctx.translate(Math.sin(time * 83) * 12 * shake, Math.cos(time * 67) * 8 * shake);
    else if (live && tension > 0.5) ctx.translate(Math.sin(time * 41) * 1.2 * (tension - 0.5), 0);
    applyCam(ctx, cam);
    setInkScale(inkScale);
    const lights = darleneLights(crashed && ct > 3 ? 'video' : darlene);
    drawBackdrop(ctx, wd, lights);
    drawDarlene(ctx, crashed && ct > 3 ? 'video' : darlene, time, boom ? smoothstep(0, 0.4, u) : 0);
    const sheriffArrive = sheriffAt >= 0 ? clamp((time - sheriffAt) / 1.5, 0, 1) : crashed ? smoothstep(STAMP_AT, STAMP_AT + 1.2, ct) : 0;
    drawSheriff(ctx, sheriffArrive, sheriffOut && !crashed ? smoothstep(0.6, 1, clamp((time - sheriffAt) / 1.5, 0, 1)) : 0, time);
    const ufoIn = ufoAt >= 0 ? smoothstep(0, 1.5, time - ufoAt) : 0;
    if (ufoIn > 0 && !(crashed && landing === 'ufo' && boom)) drawUfo(ctx, { x: 790, y: mix(40, 128, ufoIn) }, 0.5, ufoIn, time);
    if (!boom) {
      ctx.save();
      if (swell !== 1) {
        ctx.translate(270, 360);
        ctx.scale(swell, swell);
        ctx.translate(-270, -360);
      }
      ctx.translate(sway.x, sway.y);
      drawInterior(ctx, wd, rock);
      const layer = cuzLayer(exitE);
      if (layer === 'behind') drawCuz(ctx, cp, gear, time);
      drawJuniorBody(ctx, junior, jd, pose);
      drawCounter(ctx);
      drawPossum(ctx, POSSUM.x - 30, POSSUM.y, possumDead.x, Math.sin(time * 0.7), time, crashed ? 0 : noise(Math.floor(time * 2)) > 0.8 ? 1 : 0);
      drawPot(ctx, still, sd, crashed ? crashX100 / 100 : multiplier, crashed ? smoothstep(0, 0.06, ct) + (trigger === 'tap' ? smoothstep(0.29, 0.32, ct) : 0) : 0);
      drawJar(ctx, still, sd);
      // The jugs and the beer on the counter, unless they're in his hand.
      for (const kind of ['xxx', 'mystery'] as const) if (pose.holds.jug !== kind) drawJug(ctx, kind, jugHome(kind).x, jugHome(kind).y, 0);
      if (!pose.holds.beer) drawBeerCan(ctx, BEER_HOME.x, BEER_HOME.y, 0);
      const { spout } = drawJuniorArms(ctx, junior, jd, pose, still);
      if (spout) drawPour(ctx, spout, pose.holds.jug === 'mystery' ? 'rgba(120, 200, 90, 0.9)' : 'rgba(230, 220, 190, 0.9)');
      drawChair(ctx, CHAIR.x, CHAIR.seat);
      if (!cp.cooler) drawCooler(ctx, CHAIR.x - 92, TRAILER.floor);
      if (layer === 'kitchen') drawCuz(ctx, cp, gear, time);
      drawHose(ctx, TANK_VALVE, KNOB);
      drawTank(ctx, TANK.x, TANK.base, frostAt(tension, still.lit));
      drawSteam(ctx, still, sd);
      drawGlow(ctx, wd);
      drawShell(ctx, wd);
      ctx.restore();
    } else if (blast) {
      drawDebrisBack(ctx, blast, u, time);
      drawWreck(ctx, wd, u);
      drawWallsFalling(ctx, u);
    }
    drawYard(ctx, wd);
    if (outdoors) {
      drawSteps(ctx);
      if (!boom && cuzLayer(exitE) === 'outside') drawCuz(ctx, cp, gear, time);
      if (boom && outcome === 'dodged') drawCuz(ctx, cp, gear, time, smoothstep(0, 0.3, u));
      drawTruck(ctx);
      drawDog(ctx, time, secured && exitAge > 2 && exitAge < 6 ? 1 : 0, boom ? u : 0);
    }
    let juniorMouth = toWorldMouth(pose.head, trailerAt);
    let cuzHead: { x: number; y: number } = trailerAt({ x: cp.head.x, y: cp.head.y });
    if (cuzLayer(exitE) === 'outside') cuzHead = { x: cp.head.x, y: cp.head.y };
    if (boom && blast) {
      const fridge = fridgeAt(blast, u);
      const walkOff = fridge.down && u > 3.4;
      const possum = walkOff ? 'gone' : fridge.down && u > 3 ? 'peek' : 'dead';
      // What has come down lies behind the two of them, so the yard's junk never buries the cousin.
      drawDebris(ctx, blast, u, time, possum, true);
      if (outcome !== 'dodged') cuzHead = drawCuzFlying(ctx, cuzSlot, u, gear, time, talking(script, 'cuz'));
      drawJuniorFlying(ctx, junior, { ...jd, talking: talking(script, 'junior') }, landing, u);
      if (landing === 'truck' && flightAt(landing, u).landed) drawTruckBedFront(ctx);
      juniorMouth = landedMouth(landing, u);
      drawPoolFront(ctx);
      drawDebris(ctx, blast, u, time, possum, false);
      if (walkOff) {
        // The possum rolls onto its feet, hops off the fridge and walks away, unhurt.
        const hop = smoothstep(3.6, 3.95, u);
        const x = fridge.x + 10 + 80 * smoothstep(3.5, 3.9, u) + 240 * smoothstep(3.9, 5.6, u);
        drawPossum(ctx, x, mix(fridge.y, 905, hop * hop) - 36 * Math.sin(Math.PI * hop), 1 - smoothstep(3.4, 3.55, u), 1, time);
      }
      drawTankRocket(ctx, blast, u, time);
      const capPos = landing === 'ufo' ? null : capAt(landing, u);
      if (capPos) drawCapAlone(ctx, capPos);
      if (landing === 'ufo') drawAbduction(ctx, u);
    } else if (outdoors) drawPoolFront(ctx);
    // Night over everything outside the kitchen; the kitchen's light and the windows' glow over that.
    if (outdoors || boom) drawNight(ctx, boom ? 0.16 * smoothstep(1.5, 4.5, u) : 0.42, boom ? null : trailerAt);
    if (!boom && outdoors) drawSpill(ctx, wd);
    if (boom && blast) {
      drawFireball(ctx, blast, u, brew);
      drawSmoke(ctx, blast, u, brew);
      drawGlitter(ctx, blast, u, time);
    }
    setInkScale(1);
    ctx.restore();

    // ─── Light on the frame: the flash, the sheriff's lights, the edges ───
    if (boom && u < 0.35) {
      ctx.fillStyle = `rgba(235, 245, 255, ${0.95 * (1 - smoothstep(0, 0.35, u))})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    if (crashed && ct < 0.12 && !muted) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 * (1 - ct / 0.12)})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    if (sheriffArrive > 0.5 && (live || crashed)) {
      const w = sirenWash(time);
      const a = (crashed ? 0.1 : 0.05) * sheriffArrive;
      ctx.fillStyle = w.red ? `rgba(255, 40, 60, ${a})` : `rgba(40, 90, 255, ${a})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    vignette(ctx);
    if (wipe > 0) {
      wipe = Math.max(0, wipe - real / WIPE_S);
      ctx.fillStyle = `rgba(4, 6, 14, ${clamp(wipe * 1.6, 0, 1)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // ─── Bubbles, the HUD ───
    const anchors: Record<string, { x: number; y: number }> = {
      junior: toScreen(cam, juniorMouth),
      cuz: toScreen(cam, cuzHead),
      darlene: toScreen(cam, DARLENE_AT),
      sheriff: toScreen(cam, SHERIFF_AT),
      mamaw: toScreen(cam, trailerAt({ x: pose.head.x - 34, y: pose.head.y + 10 })),
    };
    const faces: Box[] = [];
    const jm = anchors.junior!;
    if (!boom) faces.push([jm.x - 40 * cam.s - 6, jm.y - 70 * cam.s, 80 * cam.s + 12, 90 * cam.s]);
    else {
      // After the blast the bubbles keep off where he came down and off the cousin, chair and all.
      const ch = anchors.cuz!;
      faces.push([jm.x - 70 * cam.s, jm.y - 110 * cam.s, 140 * cam.s, 240 * cam.s], [ch.x - 70 * cam.s, ch.y - 60 * cam.s, 140 * cam.s, 260 * cam.s]);
    }
    const hud: Box[] = [[0, 0, 300, 82], [700, 0, 260, 76], [140, 492, 680, 48]];
    if (secured && !outcome) hud.push([300, 80, 360, 52]);
    // The stamp's place is kept clear from the crash on, so the aftermath's lines never land under it.
    if (outcome) hud.push([250, 236, 460, 104]);
    capture(ctx);
    // The YOU tag over the cousin: the bubbles keep clear of it, and it goes on over their tails.
    let tag: { at: { x: number; y: number }; text: string; colour: string } | null = null;
    const tagAt = toScreen(cam, { x: cuzHead.x, y: cuzHead.y - 44 });
    if (view.stake !== null && !(crashed && outcome !== 'rekt')) {
      if (tagAt.y > 30 && tagAt.y < 520 && !(boom && u < 0.6)) tag = { at: tagAt, text: secured ? 'YOU · OUT' : 'YOU', colour: secured ? COLOURS.good : COLOURS.amber };
    } else if (secured && outcome === 'dodged') tag = { at: tagAt, text: 'YOU · SAFE', colour: COLOURS.good };
    if (tag) faces.push([tag.at.x - 40, tag.at.y - 32, 80, 30]);
    layout(ctx, anchors, faces, hud);
    drawBubbles(ctx, anchors, view.stake !== null);
    if (tag) drawYouTag(ctx, tag.at, tag.text, tag.colour);
    drawHud(ctx, multiplier, running);
    const detail = (crashed && ct >= CUT) || (secured && exitAge > 1.2) ? [0, 0, 960, 540] : undefined;
    const shown = encore >= 0 ? { phase: 'crashed', currentX100: crashX100, cashoutX100: secured?.x100 ?? null } : view;
    present(ctx, shown, caption, `PSI ${psiAt(crashed ? crashX100 / 100 : multiplier).toLocaleString('en-US')}`, lastLine(script)?.text ?? "Cookin' with Junior is about to start.", detail);
  }

  /** The saucer for an abduction: over the wreck to catch him, then away. */
  function drawAbduction(ctx: CanvasRenderingContext2D, u: number): void {
    const leave = smoothstep(1.7, 2.4, u);
    const at = { x: mix(900, 2600, leave * leave), y: mix(-1150, -1800, leave) };
    const beam = 1 - smoothstep(1.2, 1.6, u);
    drawUfo(ctx, at, 4, beam, time);
  }

  function drawHud(ctx: CanvasRenderingContext2D, multiplier: number, running: boolean): void {
    // The camcorder: REC and the show's name.
    const rec = Math.sin(time * 4) > -0.2;
    if (rec) {
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath();
      ctx.arc(24, 24, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    memeText(ctx, 'REC', 38, 31, 18, '#f4efe2', 'left', 80);
    memeText(ctx, "COOKIN' W/ JUNIOR", 92, 31, 14, '#9fd2ff', 'left', 200);
    const m = crashed ? crashX100 / 100 : multiplier;
    const level = crashed ? gaugeLevelAt(m) : still.level;
    memeText(ctx, `PSI ${psiAt(m).toLocaleString('en-US')} · ${gaugeName(level)} GAUGE`, 14, 54, 14, crashed ? COLOURS.bad : COLOURS.amber, 'left', 290);
    memeText(ctx, `SHADE: ${shadeAt(m)} · ${still.jars} JAR${still.jars === 1 ? '' : 'S'}`, 14, 74, 14, COLOURS.accent, 'left', 290);
    const colour = outcome === 'rekt' || outcome === 'watched' ? COLOURS.bad : running ? '#ffffff' : COLOURS.amber;
    memeText(ctx, `${m.toFixed(2)}×`, 946, 62, 46, colour, 'right', 250);
    if (caption) {
      ctx.save();
      ctx.translate(480, 522);
      const s = 1 + 0.08 * captionPop.x;
      ctx.scale(s, s);
      memeText(ctx, caption, 0, 0, caption.length > 26 ? 25 : 31, '#ffffff', 'center', 660);
      ctx.restore();
    }
    if (secured && badge.x > 0.02 && !outcome) {
      ctx.save();
      ctx.translate(480, 104);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      memeText(ctx, BADGE, 0, 0, 24, COLOURS.good, 'center', 340);
      memeText(ctx, `${(secured.x100 / 100).toFixed(2)}×${secured.payout !== null ? ` · +${secured.payout} credits` : ''}`, 0, 22, 15, COLOURS.good, 'center', 340);
      ctx.restore();
    }
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 296);
      ctx.rotate(-0.08);
      const s = clamp(pop.x, 0, 1.15);
      ctx.scale(s, s);
      memeText(ctx, STAMP[outcome], 0, 0, outcome === 'rekt' ? 66 : 56, outcome === 'dodged' ? COLOURS.good : COLOURS.bad, 'center', 520);
      ctx.restore();
    }
  }

  function captionFor(phase: SceneView['phase']): string {
    if (outcome) {
      if (outcome === 'dodged' && ct >= BOOM + 1.2) return CAPTIONS.dodged;
      if (ct < BOOM + 1.6) return CAPTIONS.trigger[trigger];
      if (outcome === 'watched' && ct < BOOM + 3.2) return CAPTIONS.watched;
      return CAPTIONS.crash[Math.floor((ct - BOOM - 1.6) / 1.8) % CAPTIONS.crash.length]!;
    }
    if (phase === 'waiting') return CAPTIONS.waiting;
    if (secured) {
      if (previous === 'running' && secured && script.next > 0 && regret >= 2) return CAPTIONS.kept;
      return CAPTIONS.exit[Math.floor(exitAge / 2.4) % CAPTIONS.exit.length]!;
    }
    return script.caption;
  }

  function stillDrive(multiplier: number, tension: number, depth: number, running: boolean): StillDrive {
    return { time, tension, depth, multiplier, running, crash: crashed ? ct : -1, held: true };
  }
  function juniorDrive(multiplier: number, tension: number, depth: number, live: boolean, look: Look): JuniorDrive {
    return { time, tension, depth, multiplier, running: live, crash: crashed ? Math.min(ct, CUT) : -1, talking: talking(script, 'junior'), look, trigger: crashed ? trigger : null, landing: crashed ? landing : null };
  }

  return { draw };
}

/** Junior's mouth in the world, through the trailer's rock. */
function toWorldMouth(head: { x: number; y: number }, at: (p: { x: number; y: number }) => { x: number; y: number }): { x: number; y: number } {
  return at({ x: head.x, y: head.y + 22 });
}

/** Night outside: a dark wash over the yard and the trailer's outside, with the kitchen's cutaway left lit. */
function drawNight(ctx: CanvasRenderingContext2D, alpha: number, at: ((p: { x: number; y: number }) => { x: number; y: number }) | null): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.fillStyle = `rgba(6, 10, 30, ${alpha})`;
  ctx.beginPath();
  ctx.rect(-3600, -60, 7600, 2600);
  if (at) {
    const corners = [{ x: -40, y: TRAILER.ceil }, { x: 1000, y: TRAILER.ceil }, { x: 1000, y: TRAILER.floor }, { x: -40, y: TRAILER.floor }].map(at);
    ctx.moveTo(corners[0]!.x, corners[0]!.y);
    for (const c of corners.slice(1).reverse()) ctx.lineTo(c.x, c.y);
    ctx.closePath();
  }
  ctx.fill('evenodd');
  ctx.restore();
}

/** Darken the frame's edges, like an old camcorder: four soft bands, the corners darkest where two overlap. */
function vignette(ctx: CanvasRenderingContext2D): void {
  const band = (x0: number, y0: number, x1: number, y1: number, w: number, h: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.34)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
  };
  band(0, 0, 0, 46, 960, 46);
  band(0, 540, 0, 494, 960, 46);
  band(0, 0, 110, 0, 110, 540);
  band(960, 0, 850, 0, 110, 540);
}
