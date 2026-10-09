/**
 * Composes Repo Man: the cul-de-sac at 4:07 am, Gary working his checklist up the multiplier while the degen
 * watches through the blinds over a chart that stays green, the accepted exit (SOLD, socks, the handshake, the
 * tailgate), the crash (four amber beacons, the chart going red, the front door off its hinges and riding
 * shotgun down the block), the HUD and the checklist panel, the cues and the portrait compositor.
 * Every beat keys off the displayed multiplier, the round's clocks and the confirmed exit; nothing here reads,
 * predicts or changes the committed outcome.
 */
import { type Effect, pageAudio } from './audio';
import { createGaryRig, drawDegenOut, drawGary, drawGaryInCab, garyPose, type GaryPose, smoothGary } from './cast';
import { type Bedroom, BED, createBlinds, drawBackdrop, drawCallout, drawDoorLeaf, drawHouse, drawLight, drawMailboxPost, drawNeighbourHouse, drawSign, drawSprinklers, type SetState, stepBlinds } from './house';
import { type BubblePlace, drawBubble, INK, label, memeText, wrap } from './ink';
import { AFTER, BETTING_LINE, CAPTIONS, CRASH_LINES, DEAL_LINES, DEGEN_LINE, DODGED_LINES, LADDER, OVERTIME, REGRET, STAMP, TITLE } from './lines';
import { clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { createPortrait, isPortrait } from './portrait';
import {
  addEntry, CAB_X, crashRepo, createRepo, DECK_Y, degenOut, doorView, type Entry, EXIT, exitRepo, houseShake, IDLE_X, items as itemsOf, ITEMS, type ItemView, screwViews,
  jobDone, LANE_Y, carState, resetRepo, settleRepo, shudderHouse, stepRepo, truckDX,
} from './repo';
import { bubbleAlpha, createScript, hush, lastLine, type Line, resetScript, say, settleLine, settleScript, stepScript, talking } from './script';
import { drawBeaconLight, drawCab, drawCable, drawExhaust, drawItem, drawCar, drawTruckBack, drawWheels, carPose, type TruckDrive } from './yard';

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
const COLOURS = { accent: '#ffb23e', bad: '#ff4d6d', good: '#7cf67c' };
/** The multipliers that ring a milestone stinger. */
const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];

// ─── Crash feel ─────────────────────────────────────────────────────────────────────────────────────────
const FREEZE_S = 0.15;
const SLOW_S = 0.45;
const SLOW_RATE = 0.3;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.07;
const PUNCH_AT = { x: 200, y: 380 } as const;
/** The blink to black that covers the street resetting for the next round. */
const WIPE_S = 0.4;
/** The crash's cue sheet: [crashAge, effect, strength]; `drop` is the stinger, on the chart going red. */
const CRASH_CUES: [number, Effect | 'drop', number][] = [
  [0, 'siren', 0.28], [0.02, 'click', 0.4], [0.5, 'drop', 1], [0.52, 'buzz', 0.7], [1.7, 'notify', 0.7], [1.85, 'ding', 0.6], [2.25, 'ding', 0.35],
];
const DODGED_CUES: [number, Effect | 'drop', number][] = [[0, 'siren', 0.18], [0.5, 'drop', 1], [0.52, 'buzz', 0.4], [1.7, 'notify', 0.5], [1.85, 'ding', 0.4]];
/**
 * The crash is front-loaded: beacons at 0, the chart red at 0.5 s, the door off at about 1.2 s, the fridge at 1.7 s,
 * UNDER CONTRACT at 2.2 s, the kid's light at 2.6 s, the truck gone by about 5 s, the room dark by about 4.5 s and
 * the Post-it called out at 5 s: the final image is complete by ENDING_S. Live, the next betting phase can start
 * about 2 s after the crash; a crash this scene saw live then plays on as an encore over the betting phase, on the
 * scene's own crash clock, until the ending is complete (at most ENCORE_MAX), then blinks to the fresh street.
 */
const ENDING_S = 5.8;
const ENCORE_MAX = 3.5;
/** When the Post-it is called out large. */
const CALLOUT_S = 5.0;

type Speaker = 'gary' | 'degen' | 'fridge' | 'neighbour';

export function createScene(): Scene {
  const audio = pageAudio({ style: 'lofi', crash: 'thud' });
  const { capture, present } = createPortrait(TITLE, [150, 150, 520, 389], COLOURS.accent, 'PAID IN FULL', 'LIVE FROM THE CUL-DE-SAC');
  const script = createScript(LADDER, OVERTIME);
  const repo = createRepo();
  const blinds = createBlinds();
  const rig = createGaryRig();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const spray = spring(0);
  const kid = spring(0);
  const porchLight = spring(0);
  const callout = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let secured: { x100: number; payout: number | null } | null = null;
  let outcome: Outcome | null = null;
  let crashed = false;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues. */
  let muted = false;
  /** True when this scene saw the exit happen (the choreography plays); false when it was met late. */
  let exitLive = false;
  let regret = 0;
  let afterDue = 0;
  let exitLine = 0;
  let crashLine = 0;
  let crashCue = 0;
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  let shake = 0;
  let wipe = 0;
  /** The amber flash on the crash's first frame. */
  let flash = 0;
  let pulse = 0;
  let caption = '';
  let bettingSaid = false;
  let lastRung = 0;
  let lastMultiplier = 1;
  /** The scene's own crash clock (seconds): follows crashAge while crashed, runs on through the encore. */
  let crashClock = 0;
  let crashX100 = 100;
  let encore = false;
  let encoreAge = 0;
  let rolling = 0;
  /** Gary's glance over what he is doing: up at the window on "Morning.", across at the neighbour on "Morning, Pat." */
  const glance: { kind: 'nod' | 'pat' | null; age: number } = { kind: null, age: 9 };
  /** The degen flinches at every sound the checklist makes through the floor: the hook's click, each tick. */
  let flinch = 9;
  const lastFx = new Map<Effect, number>();
  const EXIT_LINES: [number, Omit<Line, 'at'>][] = [[EXIT.meet, DEGEN_LINE], ...DEAL_LINES];

  function fx(effect: Effect, strength: number): void {
    const at = lastFx.get(effect) ?? -9;
    if (time - at < 0.08) return;
    lastFx.set(effect, time);
    audio.fx(effect, strength);
  }

  function reset(): void {
    resetScript(script);
    resetRepo(repo);
    secured = null;
    outcome = null;
    crashed = false;
    muted = false;
    exitLive = false;
    regret = afterDue = exitLine = crashLine = crashCue = lastRung = 0;
    freeze = slow = punchHold = shake = pulse = flash = 0;
    bettingSaid = false;
    lastMultiplier = 1;
    crashClock = 0;
    encore = false;
    encoreAge = 0;
    settleSpring(pop, 0);
    settleSpring(badge, 0);
    settleSpring(punch, 0);
    settleSpring(spray, 0);
    settleSpring(kid, 0);
    settleSpring(porchLight, 0);
    settleSpring(callout, 0);
    stepBlinds(blinds, 1, 0, true);
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    crashed = true;
    crashX100 = view.currentX100;
    crashClock = view.crashAge / 1000;
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    hush(script);
    crashRepo(repo, view.currentX100, outcome === 'dodged', crashClock);
    const lines = outcome === 'dodged' ? DODGED_LINES : CRASH_LINES;
    const cues = outcome === 'dodged' ? DODGED_CUES : CRASH_CUES;
    if (quiet) {
      // Met late: the aftermath as it stands, its last line already said, no stinger.
      muted = true;
      const age = crashClock;
      while (crashLine < lines.length && lines[crashLine]![0] <= age) crashLine += 1;
      while (crashCue < cues.length && cues[crashCue]![0] <= age) crashCue += 1;
      const line = lines[crashLine - 1]?.[1];
      if (line) {
        script.bubbles = [];
        settleLine(script, line, 1);
      }
      settleSpring(pop, 1);
      if (age > CALLOUT_S) settleSpring(callout, 1);
      audio.crash('thud', true);
      return;
    }
    if (outcome !== 'dodged') {
      freeze = FREEZE_S;
      slow = SLOW_S;
      punchHold = PUNCH_HOLD_S;
      settleSpring(punch, 1);
    }
    shake = outcome === 'dodged' ? 0.3 : 1;
    flash = outcome === 'dodged' ? 0.4 : 1;
    pop.v = 16;
  }

  function draw(ctx: CanvasRenderingContext2D, input: SceneView, now: number): void {
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

    // ─── The crash clock and the encore ───
    if (encore) {
      // A crash seen live plays on into betting until its ending is complete, on real time.
      encoreAge += real;
      crashClock += real;
      if (input.phase === 'running' || input.phase === 'crashed' || encoreAge >= ENCORE_MAX || crashClock >= ENDING_S) {
        encore = false;
        wipe = 1;
        reset();
        previous = input.phase === 'betting' || input.phase === 'waiting' ? input.phase : 'betting';
      }
    } else if (input.phase === 'crashed' && crashed) crashClock = input.crashAge / 1000;
    if (!encore && previous === 'crashed' && (input.phase === 'betting' || input.phase === 'waiting') && crashed && !muted && crashClock < ENDING_S) {
      encore = true;
      encoreAge = 0;
    }
    // During the encore the scene keeps drawing the crashed round: its phase, its multiplier, its exit.
    const view: SceneView = encore
      ? { ...input, phase: 'crashed', currentX100: crashX100, crashAge: crashClock * 1000, cashoutX100: secured?.x100 ?? null, payout: secured?.payout ?? null }
      : input;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×. A slow log driver keeps long rounds changing.
    const tension = 1 - 1 / multiplier;
    const running = view.phase === 'running';
    const fresh = previous === null;

    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running && !fresh && !crashed) {
        // Seen live: SOLD on the laptop, down the stairs in socks, out of the door.
        exitLive = true;
        exitRepo(repo, true);
        audio.cashout();
      } else {
        if (fresh && (view.phase === 'running' || view.phase === 'crashed')) settleRepo(repo, Math.min(multiplier, view.cashoutX100 / 100), view.elapsed / 1000);
        exitRepo(repo, false);
      }
    }

    if (fresh) {
      previous = view.phase;
      if (view.phase === 'running' || view.phase === 'crashed') {
        settleScript(script, multiplier);
        if (!secured) settleRepo(repo, multiplier, view.elapsed / 1000);
        settleOvertime();
        stepBlinds(blinds, secured ? secured.x100 / 100 : multiplier, 0, true);
        lastRung = RUNGS.filter((r) => multiplier >= r).length;
        if (multiplier >= 7) settleSpring(spray, 1);
        if (secured) {
          badge.x = 1;
          // The regret lines already passed are not replayed.
          const past = multiplier / (secured.x100 / 100);
          while (regret < REGRET.length && past >= REGRET[regret]![0]) regret += 1;
          afterDue = afterCount(past);
          exitLine = EXIT_LINES.length;
          script.bubbles = [];
          script.queue = [];
        }
      }
      if (view.phase === 'crashed') beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (view.phase === 'crashed' && !crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting' || view.phase === 'waiting') {
        if (crashed || script.next > 0 || repo.next > 0) wipe = 1;
        reset();
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    const loud = !fresh && !muted;

    if (view.phase === 'betting' && !bettingSaid) {
      bettingSaid = true;
      say(script, BETTING_LINE, true);
    }
    if (secured) {
      const past = view.currentX100 / secured.x100;
      if (exitLive && repo.exit) while (exitLine < EXIT_LINES.length && repo.exit.age >= EXIT_LINES[exitLine]![0]) say(script, EXIT_LINES[exitLine++]![1], true);
      // Gary talks from the tailgate once the deal is done (or straight away, if the exit was met late).
      if (running && !crashed && (!exitLive || (repo.exit?.age ?? 99) > EXIT.sat)) {
        while (regret < REGRET.length && past >= REGRET[regret]![0]) say(script, REGRET[regret++]![1]);
        const due = afterCount(past);
        while (afterDue < due) say(script, AFTER[afterDue++ % AFTER.length]!);
      }
    }
    // The crash's lines come due on crashAge, also after a quiet settle (only the sound is muted).
    if (crashed) {
      const age = crashClock;
      const lines = outcome === 'dodged' ? DODGED_LINES : CRASH_LINES;
      while (crashLine < lines.length && lines[crashLine]![0] <= age) say(script, lines[crashLine++]![1], true, true);
      const cues = outcome === 'dodged' ? DODGED_CUES : CRASH_CUES;
      while (crashCue < cues.length && cues[crashCue]![0] <= age) {
        const [, effect, k] = cues[crashCue++]!;
        if (muted) continue;
        if (effect === 'drop') audio.crash('thud');
        else fx(effect, k);
      }
    }
    stepScript(script, multiplier, dt, running && !crashed && !secured);

    // ─── The set's state ───
    stepRepo(repo, { phase: view.phase, multiplier, live: running && !crashed && !secured, loud, crashAge: crashClock * 1000 }, dt);
    const flips = stepBlinds(blinds, secured ? secured.x100 / 100 : multiplier, dt, fresh || view.phase === 'betting' || view.phase === 'waiting');
    const T = repo.crash?.times;
    const ca = crashClock;
    const rekt = crashed && outcome !== 'dodged';
    const its = itemsOf(repo);
    const car = carState(repo);
    const dx = truckDX(repo);
    // Kid's light at 5×; in a crash it comes on with the beacons if it was off, and goes off at beat six.
    let kidOn = running || crashed ? (multiplier >= 5 ? 1 : 0) : 0;
    if (crashed) kidOn = ca < 2.6 ? (kidOn || ca > 0.7 ? 1 : 0) : 0;
    stepSpring(kid, kidOn, 22, 0.9, dt);
    const neighbourOn = (running || crashed) && multiplier >= 8 && multiplier < 9.6 ? 1 : 0;
    stepSpring(porchLight, neighbourOn, 26, 1, dt);
    const sprayOn = (running || crashed) && multiplier >= 7 ? 1 : 0;
    stepSpring(spray, sprayOn, 9, 0.35, dt);
    stepSpring(callout, rekt && ca > CALLOUT_S ? 1 : 0, 12, 0.5, real);
    if (fresh) {
      settleSpring(kid, kidOn);
      settleSpring(porchLight, neighbourOn);
      settleSpring(spray, sprayOn);
    }
    // Edges this scene saw: the house's own cues.
    flinch += dt;
    for (const [effect] of repo.events) if (effect === 'tick' || effect === 'clang' || effect === 'thud') flinch = 0;
    if (loud) {
      for (const [effect, k] of repo.events) fx(effect, k);
      if (flips > 0) fx('creak', 0.5);
      if (running && !crashed && multiplier >= 7 && lastMultiplier < 7) {
        fx('spray', 0.6);
        fx('hiss', 0.4);
      }
      if (running && ((multiplier >= 8 && lastMultiplier < 8) || (multiplier >= 9.6 && lastMultiplier < 9.6))) fx('click', 0.5);
      if (running && !crashed && !secured && multiplier >= 60 && lastMultiplier < 60) {
        shudderHouse(repo, 5);
        fx('creak', 1);
        fx('thud', 0.8);
      }
      if (rekt && T) {
        const prev = ca - dt;
        if (prev < T.pull && ca >= T.pull) {
          fx('door', 0.9);
          fx('clang', 0.5);
        }
        if (prev < T.drive && ca >= T.drive) fx('engine', 0.9);
        if (prev < T.dark && ca >= T.dark) fx('click', 0.3);
        if (prev < CALLOUT_S && ca >= CALLOUT_S) fx('pop', 0.4);
      }
      if (exitLive && repo.exit) {
        const e = repo.exit.age;
        const prev = e - dt;
        if (prev < 1.62 && e >= 1.62) fx('door', 0.8);
        if (prev < EXIT.hookOff && e >= EXIT.hookOff) fx('clang', 0.8);
        if (prev < EXIT.shake + 0.3 && e >= EXIT.shake + 0.3) fx('punch', 0.25);
        if (repo.exit.age > 1.8 && repo.exit.age < EXIT.meet && Math.floor(e * 6) !== Math.floor(prev * 6)) fx('squeak', 0.2);
        for (const r of repo.exit.returning) if (prev < r.start && e >= r.start) fx('whoosh', 0.3);
      }
    }
    glance.age += dt;
    // Overtime items: written down, ticked, and the house shudders on its slab.
    for (const line of script.events) {
      if (line.beat === 'nod' || line.beat === 'pat') {
        glance.kind = line.beat;
        glance.age = 0;
      }
      if (line.beat?.startsWith('tick:')) {
        addEntry(repo, line.beat.slice(5), true);
        if (loud) fx('tick', 0.5);
        shudderHouse(repo, 2.5);
      }
      if (loud) {
        fx(line.thought ? 'bubble' : 'pop', 0.4);
        if (line.who === 'fridge') {
          fx('notify', 0.8);
          fx('ding', 0.5);
        }
      }
    }
    lastMultiplier = multiplier;

    // ─── Cues: milestones and the heartbeat under the diesel ───
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (!fresh && running && !crashed && rung > lastRung) audio.milestone(rung);
    lastRung = rung;
    if (loud && running && !crashed && !secured) {
      const beat = 1.4 - 1.05 * tension;
      if ((pulse += dt) >= beat) {
        pulse -= beat;
        audio.fx('heartbeat', 0.15 + 0.3 * tension);
      }
    }

    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold = Math.max(0, punchHold - real);
    if (punchHold === 0) stepSpring(punch, 0, 9, 0.85, real);
    shake = Math.max(0, shake - real / 0.5);
    const exitAge = repo.exit?.age ?? 0;
    const nextCaption = captionFor(view, script.caption, secured, exitAge, outcome, crashClock);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);

    // ─── The picture's state ───
    const exiting = repo.exit && exitLive ? repo.exit.age : 99;
    const room: Bedroom = {
      red: crashed ? smoothstep(0.5, 0.65, ca) : 0,
      sold: secured && exiting < 1.4 ? 1 - smoothstep(0.7, 1.35, exiting) : 0,
      dark: crashed ? smoothstep(T?.dark ?? 4.5, (T?.dark ?? 4.5) + 0.3, ca) : 0,
      chart: crashed ? mix(1, -1, smoothstep(0.5, T?.dark ?? 4.5, ca)) : 1,
      mug: 1 - smoothstep(0, 1, Math.log(secured ? secured.x100 / 100 : multiplier) / Math.log(8)),
      degen: {
        present: secured ? 1 - smoothstep(0.9, 1.15, exiting) : 1,
        lean: (running || crashed ? tension : 0) + 0.25 * Math.exp(-flinch * 5) * Math.sin(flinch * 30),
        turned: rekt && ca >= 0.5,
        slump: rekt ? smoothstep((T?.dark ?? 4.5) - 0.5, T?.dark ?? 4.5, ca) : 0,
        sold: secured && exiting < 1.1 ? Math.sin(clamp(exiting / 1.1, 0, 1) * Math.PI) : 0,
        look: { x: -0.7, y: 0.8 },
        time,
      },
      time,
    };
    const door = doorView(repo);
    const vestJob = repo.act.kind === 'vest' && repo.act.phase === 'work' ? repo.act.u : -1;
    const vestDone = jobDone(repo, 'vest');
    const signGrow = clamp(Math.log(multiplier / 14) / Math.log(20 / 14), 0, 1);
    const set: SetState = {
      time,
      multiplier,
      bedroom: room,
      blinds,
      items: its,
      doorOpen: door.open,
      doorGone: door.state !== 'hinged',
      hallLight: door.open > 0.3 && repo.exit ? door.open : 0,
      landing: exiting >= 1.15 && exiting <= 1.55 ? (exiting - 1.15) / 0.4 : -1,
      kidLight: kid.x,
      kidWave: repo.act.kind === 'wave' && repo.act.phase === 'work' ? 1 : 0,
      neighbourLight: porchLight.x,
      neighbour: (running || crashed) && multiplier >= 8.1 && multiplier < 9.5 ? 1 : 0,
      spray: spray.x,
      sign: secured ? 0 : rekt ? Math.max(signGrow, smoothstep(1.85, 2.2, ca)) : signGrow,
      contract: rekt ? smoothstep(2.2, 2.3, ca) * (ca < 2.55 ? (Math.sin(ca * 60) > 0 ? 1 : 0.4) : 1) : 0,
      qr: repo.act.kind === 'qr' && repo.act.phase === 'work' ? smoothstep(0.38, 0.95, repo.act.u) : 0,
      vest: vestDone || vestJob > 0.82,
      postit: its.postit || (rekt && !!T && ca >= T.pull + 0.3),
      callout: callout.x,
      boards: secured && repo.exit ? Math.floor(Math.log(Math.max(1, multiplier / (secured.x100 / 100))) / Math.log(1.25)) : 0,
      shake: houseShake(repo),
      fridgeNotice: (running || crashed) && multiplier >= 4.1 ? 1 : 0,
      jingle: crashed ? clamp((ca - 1.7) / 1.4, 0, 1) : 0,
    };
    const deckSag = repo.sag.x;
    const towLift = car.towed && T ? smoothstep(T.drive - 0.4, T.drive + 0.3, ca) : 0;
    if (rekt && T && ca > T.drive) rolling += -dx - rolling;
    else rolling = 0;
    const truck: TruckDrive = {
      dx, sag: deckSag, tilt: car.tilt, beacons: crashed ? clamp(ca / 0.25, 0, 1) : 0, time, garyInCab: 0,
      dome: view.phase === 'betting' || view.phase === 'waiting' || (repo.act.kind === 'crash' && repo.act.hidden > 0.5 && repo.act.x <= CAB_X + 15) ? 1 : repo.act.kind === 'arrive' ? 1 - clamp(repo.act.t / 0.4, 0, 1) : 0,
      shotgun: door.state === 'cab', room, lever: repo.act.phase === 'work' || repo.act.phase === 'finish' ? leverOf(repo) : 0, rolling,
    };
    const inCab = repo.act.kind === 'cab' || (repo.act.hidden > 0.98 && repo.act.x <= CAB_X + 15);
    truck.garyInCab = inCab ? 1 : 0;
    const held = its.views.find((v) => v.layer === 'held') ?? null;
    const lp = carPose(car, deckSag, car.load > 0.5 || car.towed ? dx : 0, towLift);
    const out = degenOut(repo);
    const meet = { x: IDLE_X + 36, y: LANE_Y - 76 };
    const gary = garyPose({
      act: repo.act, time, talk: talking(script, 'gary'), walk: repo.walk,
      held: held ? { x: held.x, y: held.y, hands: handsOn(held, repo.act.face, repo.act.x) } : door.state === 'held' ? { x: door.x, y: door.y, hands: [{ x: door.x - repo.act.face * 18, y: door.y - 12 }, { x: door.x - repo.act.face * 16, y: door.y + 14 }] } : null,
      hook: { x: lp.x + 4, y: lp.y - 12 }, meet, vest: vestDone ? 0 : vestJob >= 0 ? 1 - smoothstep(0, 0.35, vestJob) : 1, deck: DECK_Y + deckSag, glance,
      toast: outcome === 'dodged' && repo.act.kind === 'sit' ? smoothstep(0.9, 1.2, ca) * (1 - smoothstep(2.3, 2.7, ca)) : 0,
    });
    // Hands on a carried thing stay exactly on it; everything else eases.
    smoothGary(rig, gary, dt, fresh || view.phase === 'betting' || view.phase === 'waiting', held !== null || door.state === 'held');

    // ─── The picture ───
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    if (punch.x > 0.005) {
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    drawBackdrop(ctx, time);
    drawNeighbourHouse(ctx, set);
    drawHouse(ctx, set);
    drawSprinklers(ctx, set);
    drawSign(ctx, set);
    if (its.home.bike) drawItem(ctx, 'bike', ITEMS.bike.home.x, ITEMS.bike.home.y, -0.06, 0, { count: 3, bow: its.bow, notice: 0, time });
    if (its.home.porch) drawItem(ctx, 'porch', 541, 401, 0, 0, { count: 3, bow: 0, notice: 0, time });
    // Items on the ground (the fridge in the doorway, whatever Gary dropped at the crash).
    for (const v of its.views) if (v.layer === 'ground') drawView(ctx, v, set, time);
    // The hinge screws the door leaves behind.
    for (const sc of screwViews(repo)) {
      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.rotate(sc.rot);
      ctx.fillStyle = '#d8dce6';
      ctx.fillRect(-3.5, -1.3, 7, 2.6);
      ctx.fillStyle = '#7a808c';
      ctx.fillRect(-3.5, -1.3, 2, 2.6);
      ctx.restore();
    }
    // The degen, outside in his socks, behind or beside Gary by depth.
    const drawDegen = (): void => {
      if (out) drawDegenOut(ctx, out, meet, talking(script, 'degen'), time);
    };
    if (out && out.y < LANE_Y - 2) drawDegen();
    if (!inCab) drawGary(ctx, gary, time, held ? () => drawView(ctx, held, set, time, repo.act.face) : door.state === 'held' ? () => drawHeldDoor(ctx, door, room) : undefined);
    if (out && out.y >= LANE_Y - 2) drawDegen();
    drawMailboxPost(ctx, set);
    drawExhaust(ctx, time, dx, crashed && T && ca > T.drive - 0.3 ? 1 : 0);
    drawTruckBack(ctx, truck);
    // The supercar on the deck rides under the pile; on the apron it sits in front of the deck's tail.
    const onDeck = car.load > 0.5;
    if (onDeck) drawCar(ctx, lp, car, time);
    for (const v of its.views) if (v.layer === 'stack') drawView(ctx, v, set, time);
    drawWheels(ctx, dx, rolling);
    drawCab(ctx, truck, (c) => drawGaryInCab(c, 98 + dx, 420, -1, view.phase !== 'crashed', talking(script, 'gary'), time));
    // The cable: to the supercar's frame, to the porch being dragged, or hanging at the tail.
    const porchView = its.views.find((v) => v.id === 'porch' && v.layer === 'air');
    const hookTo = porchView && repo.act.kind === 'porch' ? { x: porchView.x - 60, y: porchView.y - 4 } : car.hook > 0.01 ? { x: mix(352 + dx, lp.x + 4, car.hook), y: mix(476, lp.y - 12, car.hook) } : null;
    const porchHooked = repo.act.kind === 'porch' && (repo.act.phase === 'back' || (repo.act.phase === 'work' && repo.act.u > 0.7));
    drawCable(ctx, truck, porchHooked ? { x: 478, y: 398 } : hookTo, { x: 352 + dx, y: 478 + deckSag });
    if (!onDeck) drawCar(ctx, lp, car, time);
    for (const v of its.views) if (v.layer === 'air') drawView(ctx, v, set, time);
    drawJingle(ctx, set, its, time);
    drawLight(ctx, time, 0.6 + 0.4 * noise(Math.floor(time * 7)) * (noise(Math.floor(time * 0.5) * 3.1) > 0.8 ? 1 : 0.2));
    drawBeaconLight(ctx, truck);
    drawCallout(ctx, set.callout);
    // On a narrow screen the portrait shows the line under the picture instead of the bubbles.
    if (!isPortrait(ctx.canvas)) for (const b of script.bubbles) drawBubble(ctx, b.line.text, place(b.line.who as Speaker, gary, inCab, out, dx, its), b.pop.x, bubbleAlpha(b), b.line.thought);
    ctx.restore();
    // A crash after the exit is played small: the bedroom going red in an inset, Gary's coffee in the foreground.
    if (outcome === 'dodged' && ca > 0.5) drawInset(ctx, set, ca);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 186, 70, ${0.4 * flash})`;
      ctx.fillRect(0, 0, 960, 540);
      flash = Math.max(0, flash - real / 0.3);
    }
    if (wipe > 0) {
      wipe = Math.max(0, wipe - real / WIPE_S);
      ctx.fillStyle = `rgba(0, 0, 0, ${clamp(wipe * 1.6, 0, 1)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // ─── The HUD ───
    capture(ctx);
    drawChecklist(ctx, repo.entries, secured ? 'paid' : rekt && ca > (T?.dark ?? 4.5) ? 'repo' : null);
    if (caption) {
      ctx.save();
      ctx.translate(430, 58);
      const s = 1 + 0.08 * captionPop.x;
      ctx.scale(s, s);
      // Long captions run smaller and narrower so they never touch a long multiplier.
      memeText(ctx, caption, 0, 0, caption.length > 22 ? 30 : 38, '#ffffff', 'center', caption.length > 22 ? 500 : 540);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(430, 98);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      memeText(ctx, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× · PAID IN FULL · GARY’S BOY NOW`, 0, 0, 20, COLOURS.good, 'center', 560);
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'watched' ? COLOURS.bad : running ? '#ffffff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 70, 54, colour, 'right', 230);
    if (outcome && pop.x > 0.02 && crashClock >= 0.9) {
      // The stamp under the multiplier, like the one on Gary's clipboard.
      ctx.save();
      ctx.translate(840, 104);
      ctx.rotate(-0.1);
      const s = clamp(pop.x, 0, 1.25);
      ctx.scale(s, s);
      const col = outcome === 'dodged' ? '#7cf67c' : outcome === 'rekt' ? '#ff2d4a' : '#ffe27a';
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.strokeRect(-92, -17, 184, 33);
      memeText(ctx, STAMP[outcome], 0, 9, 24, col, 'center', 172);
      ctx.restore();
    }
    const content = lastLine(script)?.text ?? (view.phase === 'betting' ? BETTING_LINE.text : 'Gary is reading the contract by dome light.');
    const detail = view.phase === 'crashed' && outcome !== 'dodged' ? [30, 150, 560, 419] : secured && exiting < 10 ? [250, 170, 480, 359] : undefined;
    present(ctx, view, caption, `CHECKLIST ${repo.entries.filter((e) => e.done).length} ✓`, content, detail);
  }

  /** Overtime entries a late entry missed: the last few, already ticked. */
  function settleOvertime(): void {
    const from = Math.max(0, script.overtimeDue - 6);
    for (let k = from; k < script.overtimeDue; k += 1) {
      const beat = OVERTIME[k % OVERTIME.length]!.beat;
      if (beat?.startsWith('tick:')) addEntry(repo, beat.slice(5), true);
    }
  }

  return { draw };
}

/** How many kept-going lines are due this far past the exit, after the regret ladder runs out. */
function afterCount(past: number): number {
  const lastAt = REGRET.at(-1)![0];
  return past < lastAt * 1.35 ? 0 : Math.floor(Math.log(past / lastAt) / Math.log(1.35) + 1e-9);
}

function leverOf(repo: ReturnType<typeof createRepo>): number {
  const a = repo.act;
  if (a.kind === 'lift' && a.phase === 'work') return Math.sin(Math.PI * clamp(a.u * 1.2, 0, 1));
  if (a.kind === 'load' && a.phase === 'work') return clamp(Math.sin(Math.PI * clamp(a.t / 2.6, 0, 1)) * 1.2, 0, 1);
  if (a.kind === 'porch' && a.phase === 'finish') return clamp(Math.sin(Math.PI * clamp(a.t / 2.2, 0, 1)) * 1.2, 0, 1);
  return 0;
}

/** Where Gary's hands go on what he carries. */
function handsOn(v: ItemView, face: number, gx: number): [{ x: number; y: number }, { x: number; y: number }] {
  const f = face;
  switch (v.id) {
    case 'bike': return [{ x: v.x - f * 8, y: v.y - 17 }, { x: v.x + f * 15, y: v.y - 21 }];
    case 'fridge': return [{ x: v.x - f * 10, y: v.y - 34 }, { x: v.x - f * 16, y: v.y - 22 }];
    case 'hose': return [{ x: v.x - f * 12, y: v.y + 8 }, { x: v.x + f * 12, y: v.y + 4 }];
    case 'gutter': return [{ x: gx - f * 12, y: v.y + 4 }, { x: gx + f * 8, y: v.y + 4 }];
    case 'mailbox': return [{ x: v.x - f * 6, y: v.y + 11 }, { x: v.x + f * 8, y: v.y - 8 }];
    case 'numbers': return [{ x: gx + f * 10, y: LANE_Y - 70 }, { x: v.x - f * 12, y: v.y + 2 }];
    case 'tv': return [{ x: v.x - f * 24, y: v.y + 10 }, { x: v.x + f * 6, y: v.y + 12 }];
    default: return [{ x: v.x - f * 14, y: v.y + 6 }, { x: v.x + f * 10, y: v.y + 4 }];
  }
}

function drawView(ctx: CanvasRenderingContext2D, v: ItemView, set: SetState, time: number, face = 1): void {
  if (v.id === 'fridge' && v.layer === 'held') {
    // The dolly under the fridge.
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.rot);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-face * 24, -40);
    ctx.lineTo(-face * 24, 44);
    ctx.lineTo(face * 12, 44);
    ctx.stroke();
    ctx.strokeStyle = '#c8202c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#16161c';
    ctx.beginPath();
    ctx.arc(v.x - face * 18, LANE_Y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  if (v.id === 'bike' && face < 0 && (v.layer === 'held' || v.layer === 'air')) {
    ctx.translate(v.x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-v.x, 0);
  }
  drawItem(ctx, v.id, v.x, v.y, v.rot, v.squash, { count: v.count, bow: set.items.bow, notice: set.fridgeNotice, time });
  ctx.restore();
}

function drawHeldDoor(ctx: CanvasRenderingContext2D, door: { x: number; y: number; rot: number }, room: Bedroom): void {
  ctx.save();
  ctx.translate(door.x, door.y);
  ctx.rotate(door.rot);
  ctx.scale(0.86, 0.86);
  drawDoorLeafCentered(ctx, room);
  ctx.restore();
}

function drawDoorLeafCentered(ctx: CanvasRenderingContext2D, room: Bedroom): void {
  drawDoorLeaf(ctx, -24, -43, 48, 86, room);
}

/** The fridge's last jingle at the crash: notes rising from wherever it is. */
function drawJingle(ctx: CanvasRenderingContext2D, set: SetState, its: ReturnType<typeof itemsOf>, time: number): void {
  if (set.jingle <= 0 || set.jingle >= 1) return;
  const fridge = its.views.find((v) => v.id === 'fridge');
  const src = fridge ? { x: fridge.x, y: fridge.y - 40 } : { x: 454, y: 320 };
  ctx.save();
  for (let i = 0; i < 5; i += 1) {
    const u = set.jingle * 1.4 - i * 0.12;
    if (u <= 0 || u >= 1) continue;
    ctx.globalAlpha = 1 - u;
    ctx.fillStyle = i % 2 ? '#7fd4ff' : '#ffffff';
    ctx.font = '900 18px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(i % 2 ? '♪' : '♫', src.x + Math.sin(time * 5 + i) * 10 + (i - 2) * 8, src.y - u * 70);
  }
  ctx.restore();
}

/** The picture-in-picture for a crash after the exit: upstairs, the chart going red on an empty bed. */
function drawInset(ctx: CanvasRenderingContext2D, set: SetState, ca: number): void {
  const k = smoothstep(0.5, 0.8, ca);
  ctx.save();
  ctx.globalAlpha = k;
  const x = 734;
  const y = 132;
  const w = 206;
  const h = 120;
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 30);
  ctx.strokeStyle = '#ffb23e';
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 30);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const s = w / (BED.w + 40);
  ctx.translate(x - (BED.x - 20) * s, y - (BED.y - 30) * s);
  ctx.scale(s, s);
  drawHouse(ctx, { ...set, shake: 0 });
  ctx.restore();
  label(ctx, 'MEANWHILE, UPSTAIRS', x + w / 2, y + h + 13, 12, '#ffd48a', 900, w - 10);
  ctx.restore();
}

/** The checklist on Gary's clipboard: the loan agreement, itemized, a tick for each thing on the truck. */
function drawChecklist(ctx: CanvasRenderingContext2D, entries: Entry[], stamp: 'paid' | 'repo' | null): void {
  const x = 808;
  const y = 396;
  const w = 142;
  const h = 136;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 4, y + 5, w, h);
  ctx.fillStyle = '#a0703e';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8f5ea';
  ctx.fillRect(x + 7, y + 12, w - 14, h - 18);
  ctx.fillStyle = '#c8ccd6';
  ctx.beginPath();
  ctx.roundRect(x + w / 2 - 22, y - 5, 44, 14, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220, 60, 60, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 12);
  ctx.lineTo(x + 24, y + h - 6);
  ctx.stroke();
  const done = entries.filter((e) => e.done).length;
  label(ctx, 'LOAN #407 · ITEMS', x + 12, y + 21, 9, '#24375f', 900, 92, 'left');
  label(ctx, `${done}✓`, x + w - 12, y + 21, 10, '#c0182c', 900, 40, 'right');
  const rows = entries.slice(-6);
  const font = 'italic 700 11px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  rows.forEach((e, i) => {
    const ry = y + 38 + i * 16;
    ctx.globalAlpha = clamp(e.done ? 1 : e.age / 0.3, 0, 1);
    ctx.strokeStyle = '#3a4560';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 12, ry - 5, 8, 8);
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = e.open ? '#8a8a96' : '#1d2a4a';
    const text = wrap(ctx, e.text, 200)[0] ?? e.text;
    ctx.fillText(text, x + 28, ry, w - 36);
    if (e.done) {
      // The tick draws itself.
      const k = clamp(e.age / 0.25, 0, 1);
      ctx.strokeStyle = '#d0202c';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 11, ry - 1);
      if (k > 0) ctx.lineTo(x + 11 + 3 * Math.min(1, k * 2), ry - 1 + 4 * Math.min(1, k * 2));
      if (k > 0.5) ctx.lineTo(x + 14 + 8 * (k - 0.5) * 2, ry + 3 - 11 * (k - 0.5) * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  if (stamp) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 + 8);
    ctx.rotate(-0.22);
    const col = stamp === 'paid' ? '#1f9a4a' : '#d0202c';
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.strokeRect(-62, -16, 124, 32);
    label(ctx, stamp === 'paid' ? 'PAID IN FULL' : 'REPOSSESSED', 0, 1, 15, col, 900, 116);
    ctx.restore();
  }
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

/** Where each speaker's bubble sits: Gary's beside his head, clear of the bedroom window and the HUD. */
function place(who: Speaker, g: GaryPose, inCab: boolean, out: ReturnType<typeof degenOut>, dx: number, its: ReturnType<typeof itemsOf>): BubblePlace {
  if (who === 'gary') {
    if (inCab) {
      const hx = 98 + dx;
      return { x: clamp(hx + 130, 160, 330), y: 300, tail: { x: hx + 16, y: 404 }, width: 270 };
    }
    const head = { x: g.head.x, y: g.head.y - 24 };
    if (head.x < 560) return { x: clamp(head.x - 110, 150, 330), y: 172, tail: { x: head.x - 4, y: head.y - 30 }, width: 270 };
    return { x: clamp(head.x + 120, 640, 812), y: 172, tail: { x: head.x + 4, y: head.y - 30 }, width: 270 };
  }
  if (who === 'degen' && out) return { x: clamp(out.x + 160, 150, 810), y: 262, tail: { x: out.x + 12, y: out.y - 128 }, width: 250 };
  if (who === 'fridge') {
    const onStack = its.views.find((v) => v.id === 'fridge');
    if (onStack) return { x: clamp(onStack.x + 60, 150, 810), y: onStack.y - 90, tail: { x: onStack.x, y: onStack.y - 40 }, width: 250, fill: '#dff3ff' };
    return { x: 604, y: 300, tail: { x: 470, y: 326 }, width: 250, fill: '#dff3ff' };
  }
  if (who === 'neighbour') return { x: 810, y: 284, tail: { x: 878, y: 330 }, width: 210 };
  return { x: 480, y: 300, tail: { x: 480, y: 340 }, width: 250 };
}

