/**
 * Composes TROLLEY.EXE: the track and its fork, the five on the main line and the one on the side, the trolley
 * that creeps toward the fork as the multiplier climbs, the lever that is the cash-out, God's commentary across
 * the top (an intern covers once He leaves), the pull onto the side track, the crash's lunge, the glitch and the
 * blue screen. Tension and every beat key off the displayed multiplier, the round's elapsed time and the crash
 * age; nothing here reads, predicts or changes the committed outcome.
 */
import { type Effect, pageAudio } from './audio';
import { CRASH_LINES, INTERN_AT, LADDER, NAMES, OPENING, OVERTIME, PULLED, PULLED_LATE_ENTRY, REGRET, STOP_CODES, WAITING } from './lines';
import { createScript, hush, resetScript, say, settleLine, settleScript, stepScript, typing, visibleText } from './script';
import {
  type BlueScreen, COLOURS, FORK_X, MAIN_Y, type Pose, SIDE_TOTAL, SIDE_VICTIM_X, START_X, VICTIMS, approachX, clamp, drawBSOD, drawCRT, drawFigure, drawFootLine,
  drawGlitch, drawGodBox, drawLever, drawReadout, drawScanlines, drawSparks, drawStamp, drawTitle, drawTrack, drawTrolley, formatX, hash, mix, sideParamAt, sidePoint, smooth,
} from './world';

/** The shared shell fills this view every frame. Multipliers are in hundredths. */
export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** 150 means 1.50×. This is the final multiplier after a crash. */
  currentX100: number;
  /** Milliseconds since the round started running; held at the crash time. */
  elapsed: number;
  /** Milliseconds since the crash, for the ending. */
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
/** The multipliers that ring a milestone. */
const RUNGS = [1.2, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 15, 22, 30, 50, 100];
// ─── The crash feel, on the crash clock in seconds ───
const FREEZE_S = 0.15;
const STRIKE_S = 0.5;
const GLITCH_FROM_S = 0.4;
const GLITCH_TO_S = 1.6;
const BSOD_AT_S = 1.15;
/** The ending is complete here; live, it may play on into the next betting phase for at most ENCORE_MAX_S. */
const ENDING_S = 4.5;
const ENCORE_MAX_S = 3.5;
// ─── The pull ───
/** The trolley's run from the approach through the fork and over the one on the side track. */
const PULL_TRAVEL_S = 1.1;
/** Then its creep along the side track to the picture's edge. */
const CREEP_S = 28;

const credits = (n: number): string => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const short = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

export function createScene(): Scene {
  // A chiptune in a green phosphor glow; the crash is the picture losing sync.
  const audio = pageAudio({ style: 'chiptune', crash: 'static' });
  const script = createScript(LADDER, OVERTIME);
  let last: number | null = null;
  let time = 0;
  let realClock = 0;
  let previous: SceneView['phase'] | null = null;
  let opened = false;
  let waitingSaid = false;
  /** The confirmed cash-out: the lever pulled at that multiplier, and how long ago. */
  let pulled: { x100: number; payout: number | null; age: number; fromX: number } | null = null;
  let leverAngle = -0.45;
  let stamp = 0;
  let crashed = false;
  let quietCrash = false;
  let outcome: Outcome | null = null;
  /** The crash clock in seconds: the crash age, then advanced by frame time through the encore. */
  let crashClock = 0;
  let crashX100 = 100;
  let crashStake: number | null = null;
  let encore: number | null = null;
  let strikeFrom = START_X;
  let crashLine = 0;
  let regret = 0;
  let lastRung = 0;
  let wheel = 0;
  let bell = 0;
  let freeze = 0;
  let slow = 0;
  let shake = 0;
  const dead = [false, false, false, false, false];
  let sideDead = false;
  const cueAt = new Map<Effect, number>();

  /** A one-shot effect, never twice within 0.08 s, never for a settled aftermath. */
  function cue(effect: Effect, strength: number, fresh: boolean): void {
    if (fresh) return;
    const at = cueAt.get(effect) ?? -1;
    if (realClock - at < 0.08) return;
    cueAt.set(effect, realClock);
    audio.fx(effect, strength);
  }

  function reset(): void {
    resetScript(script);
    opened = waitingSaid = false;
    pulled = null;
    leverAngle = -0.45;
    stamp = 0;
    crashed = quietCrash = false;
    outcome = null;
    crashClock = 0;
    crashX100 = 100;
    crashStake = null;
    encore = null;
    strikeFrom = START_X;
    crashLine = regret = lastRung = 0;
    freeze = slow = shake = 0;
    dead.fill(false);
    sideDead = false;
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    crashed = true;
    outcome = pulled ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    crashX100 = view.currentX100;
    crashStake = view.stake;
    strikeFrom = approachX(1 - 100 / Math.max(100, view.currentX100));
    hush(script);
    const lines = CRASH_LINES[outcome];
    if (quiet) {
      // Met late: the aftermath as it stands, its last line already said, no stinger.
      quietCrash = true;
      crashClock = view.crashAge / 1000;
      crashLine = lines.length;
      const lastLine = lines.at(-1);
      if (lastLine) settleLine(script, lastLine[1]);
      if (outcome !== 'dodged') dead.fill(true);
      audio.crash('static', true);
      return;
    }
    freeze = FREEZE_S;
    slow = 0.3;
    shake = 1;
    audio.crash('static');
    cue('buzz', 1, false);
  }

  /** Where the trolley is and how hard its wheels turn, from the clocks alone. */
  function trolley(tension: number, phase: SceneView['phase']): { pose: Pose; speed: number } {
    if (crashed && outcome !== 'dodged') {
      const strike = smooth((crashClock - FREEZE_S) / STRIKE_S);
      return { pose: { x: mix(strikeFrom, 960, strike), y: MAIN_Y, a: 0 }, speed: crashClock > FREEZE_S && strike < 1 ? 1 : 0 };
    }
    if (pulled) {
      const toFork = FORK_X - pulled.fromX;
      const total = toFork + SIDE_TOTAL;
      // The run carries the trolley just past the one on the side track, so the fall shows before the creep.
      const hitAt = toFork + sideParamAt(SIDE_VICTIM_X + 70) * SIDE_TOTAL;
      const run = smooth(clamp(pulled.age / PULL_TRAVEL_S, 0, 1));
      const d = pulled.age < PULL_TRAVEL_S ? hitAt * run : hitAt + (total - hitAt) * clamp((pulled.age - PULL_TRAVEL_S) / CREEP_S, 0, 1);
      const speed = pulled.age < PULL_TRAVEL_S ? 1 : 0.12;
      if (d < toFork) return { pose: { x: pulled.fromX + d, y: MAIN_Y, a: 0 }, speed };
      return { pose: sidePoint((d - toFork) / SIDE_TOTAL), speed };
    }
    if (phase === 'running' || phase === 'crashed') return { pose: { x: approachX(tension), y: MAIN_Y, a: 0 }, speed: 0.08 + 0.5 * tension };
    return { pose: { x: START_X, y: MAIN_Y, a: 0 }, speed: 0 };
  }

  function footLine(view: SceneView): [text: string, colour: string] {
    const over = view.phase === 'crashed';
    if (pulled) {
      const pay = pulled.payout !== null ? ` · ${credits(pulled.payout).toUpperCase()}` : '';
      return [over ? `PULLED AT ${formatX(pulled.x100)}${pay} · DODGED THE CRASH` : `PULLED AT ${formatX(pulled.x100)}${pay} · ONE DEAD, FIVE ALIVE`, COLOURS.ph];
    }
    if (view.stake === null) {
      if (over) return ['WATCHED IT CRASH · NO CREDITS LOST · STILL COMPLICIT', COLOURS.dim];
      if (view.phase === 'running') return ['WATCHING · NO CREDITS RIDING · GOD SEES THAT TOO', COLOURS.dim];
      if (view.phase === 'betting') return ['PLACE YOUR BETS · THE TROLLEY WAITS FOR NO ONE, EXCEPT NOW', COLOURS.dim];
      return ['WAITING FOR A TROLLEY · THERE IS ALWAYS A TROLLEY', COLOURS.dim];
    }
    if (over) return [`YOUR ${credits(view.stake).toUpperCase()} WENT DOWN WITH THE FIVE`, COLOURS.red];
    if (view.phase === 'running') return [`YOUR HAND IS ON THE LEVER · ${credits(view.stake).toUpperCase()} RIDING`, COLOURS.amber];
    return [`YOU'RE IN · ${credits(view.stake).toUpperCase()} · HAND ON THE LEVER`, COLOURS.amber];
  }

  function blueScreen(): BlueScreen {
    const kind = outcome ?? 'watched';
    const detail = kind === 'rekt' ? `Five on the main track. One lever. Zero pulls. ${crashStake !== null ? credits(crashStake) : 'Credits'} riding.`
      : kind === 'dodged' ? `Lever pulled at ${formatX(pulled?.x100 ?? 100)}${pulled?.payout !== null && pulled?.payout !== undefined ? ` for ${credits(pulled.payout)}` : ''}. One dead, five alive. The crash found nobody at the lever.`
      : 'No stake, no lever, a full view of the track.';
    return { code: STOP_CODES[kind], detail, crashedAt: formatX(crashX100), failed: kind === 'dodged' ? 'everyone_else.sys' : 'you.sys', trace: script.said.slice().reverse().slice(0, 4).map((l) => short(l.text, 58)) };
  }

  function draw(ctx: CanvasRenderingContext2D, shown: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    realClock += real;
    // ─── The encore: a crash this scene saw live plays its ending out over the start of betting ───
    if (encore === null && crashed && !quietCrash && previous === 'crashed' && (shown.phase === 'betting' || shown.phase === 'waiting') && crashClock < ENDING_S) encore = 0;
    if (encore !== null) {
      encore += real;
      crashClock += real;
      if (shown.phase === 'running' || shown.phase === 'crashed' || crashClock >= ENDING_S || encore >= ENCORE_MAX_S) {
        reset();
        previous = shown.phase === 'betting' || shown.phase === 'waiting' ? shown.phase : 'betting';
      }
    }
    const view: SceneView = encore !== null
      ? { ...shown, phase: 'crashed', currentX100: crashX100, crashAge: crashClock * 1000, stake: crashStake, cashoutX100: pulled?.x100 ?? null, payout: pulled?.payout ?? null }
      : shown;
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * 0.3;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×; most rounds end before 3×, so that is where the trolley gains.
    const tension = 1 - 1 / multiplier;
    const running = view.phase === 'running';
    const fresh = previous === null;

    if (fresh) {
      previous = view.phase;
      if (running || view.phase === 'crashed') {
        // Opened mid-round: the lines as far as they got, the rungs rung, the lever as it stands.
        settleScript(script, multiplier);
        opened = true;
        lastRung = RUNGS.filter((r) => multiplier >= r).length;
        if (view.cashoutX100 !== null) {
          pulled = { x100: view.cashoutX100, payout: view.payout, age: 99, fromX: START_X };
          leverAngle = 0.5;
          stamp = 1;
          sideDead = true;
          while (regret < REGRET.length && multiplier / (pulled.x100 / 100) >= REGRET[regret]!.at) regret += 1;
          if (running) settleLine(script, PULLED_LATE_ENTRY(formatX(pulled.x100)));
        }
      }
      if (view.phase === 'crashed') beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (view.phase === 'crashed' && !crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting' || view.phase === 'waiting') reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    if (crashed && encore === null) crashClock = view.crashAge / 1000;
    const live = running && !crashed;

    if (view.phase === 'betting' && !opened) {
      opened = true;
      for (const line of OPENING) say(script, line);
    }
    if (view.phase === 'waiting' && !waitingSaid) {
      waitingSaid = true;
      say(script, WAITING[0]!);
    }
    // ─── The pull: the backend's confirmation, never the click ───
    if (view.cashoutX100 !== null && !pulled) {
      pulled = { x100: view.cashoutX100, payout: view.payout, age: 0, fromX: approachX(tension) };
      if (live && !fresh) {
        say(script, PULLED(formatX(pulled.x100)), true, true);
        audio.cashout();
        cue('ratchet', 0.8, false);
        cue('bell', 0.7, false);
      } else {
        pulled.age = 99;
        sideDead = true;
        stamp = 1;
      }
    }
    if (pulled) {
      pulled.age += dt;
      if (pulled.payout === null && view.payout !== null) pulled.payout = view.payout;
      stamp += (1 - stamp) * (1 - Math.exp(-dt * 9));
      if (live) {
        const past = multiplier / (pulled.x100 / 100);
        while (regret < REGRET.length && past >= REGRET[regret]!.at) say(script, REGRET[regret++]!.line);
      }
    }
    leverAngle += ((pulled ? 0.5 : -0.45) - leverAngle) * (1 - Math.exp(-dt * 11));
    if (crashed && !quietCrash && outcome) {
      const lines = CRASH_LINES[outcome];
      while (crashLine < lines.length && lines[crashLine]![0] <= crashClock) say(script, lines[crashLine++]![1], true, true);
    }
    stepScript(script, multiplier, dt, live);
    for (const line of script.events) cue(line.who === 'intern' ? 'beep' : 'click', 0.35, fresh);

    // ─── Rungs and the bell ───
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (!fresh && live && rung > lastRung) {
      audio.milestone(rung);
      cue('bell', 0.5, false);
    }
    lastRung = rung;
    if (live && !pulled) {
      const before = Math.floor(bell);
      bell += dt * (0.5 + 1.8 * tension);
      if (Math.floor(bell) > before) cue('tick', 0.25 + 0.5 * tension, fresh);
    }

    // ─── The trolley and whom it reaches ───
    const { pose, speed } = trolley(tension, view.phase);
    wheel += dt * (2 + 26 * speed);
    if (pulled && !sideDead && pose.y < MAIN_Y - 40 && pose.x >= SIDE_VICTIM_X - 10) {
      sideDead = true;
      cue('thud', 0.7, false);
      cue('scream', 0.45, false);
    }
    if (crashed && outcome !== 'dodged') {
      VICTIMS.forEach((vx, i) => {
        if (!dead[i] && pose.x >= vx - 10) {
          dead[i] = true;
          cue('thud', 0.7, quietCrash);
          if (i === 0) cue('scream', 0.6, quietCrash);
        }
      });
    }
    shake = Math.max(0, shake - dt * 1.7);
    const jolt = crashed && !quietCrash ? 7 * shake * shake : 0;

    // ─── The picture ───
    ctx.save();
    drawCRT(ctx);
    ctx.translate(jolt * Math.sin(realClock * 71), jolt * Math.sin(realClock * 53));
    drawTrack(ctx);
    const near = clamp((pose.x - 300) / 300, 0, 1);
    VICTIMS.forEach((vx, i) => drawFigure(ctx, vx, MAIN_Y, dead[i]!, clamp(tension * 0.7 + near * 0.5, 0, 1), time, i * 0.37));
    drawFigure(ctx, SIDE_VICTIM_X, 296, sideDead, pulled ? 1 : clamp(tension * 0.5, 0, 1), time, 0.83);
    drawLever(ctx, leverAngle, pulled ? 1 : running ? 0.4 + 0.4 * Math.sin(time * 4) * tension : 0);
    drawSparks(ctx, pose, speed > 0.6 ? 1 : pulled ? 0 : tension * 0.6, time);
    drawTrolley(ctx, pose, wheel, running || crashed ? 0.5 + 0.5 * Math.abs(Math.sin(time * (3 + 6 * tension))) : 0.15, speed > 0.6 ? 1.5 : 0);
    if (pulled) drawStamp(ctx, `PULLED AT ${formatX(pulled.x100)}`, FORK_X, MAIN_Y - 78, stamp, COLOURS.ph);
    ctx.restore();

    // ─── The HUD ───
    const sub = view.phase === 'crashed' ? 'GOD HAS DECIDED' : view.phase === 'running' ? 'GOD IS WATCHING · HE HAS NOTES' : 'AN ETHICS SIMULATOR';
    drawTitle(ctx, sub);
    const who = script.current?.who ?? (multiplier >= INTERN_AT ? 'intern' : 'god');
    const patienceLabel = multiplier >= INTERN_AT ? "INTERN'S PATIENCE (UNPAID)" : "GOD'S PATIENCE";
    const patience = crashed && outcome !== 'dodged' ? 0 : multiplier >= INTERN_AT ? 0.35 + 0.1 * Math.sin(time * 5) : 1 - tension;
    drawGodBox(ctx, NAMES[who], visibleText(script), typing(script), patience, patienceLabel, realClock);
    const punch = crashed ? (1 - clamp((crashClock - 0.12) / 0.25, 0, 1)) ** 2 : 0;
    const colour = crashed ? (outcome === 'dodged' ? COLOURS.ph : COLOURS.red) : pulled ? COLOURS.ph : running ? COLOURS.amber : COLOURS.dim;
    drawReadout(ctx, view.currentX100, punch, colour, crashed ? 'CRASHED AT' : 'HESITATION BONUS');
    const [line, lineColour] = footLine(view);
    drawFootLine(ctx, line, lineColour);

    // ─── The crash: the tear, then the blue screen ───
    if (crashed) {
      const g = crashClock < GLITCH_FROM_S ? 0 : crashClock < GLITCH_TO_S ? Math.sin(((crashClock - GLITCH_FROM_S) / (GLITCH_TO_S - GLITCH_FROM_S)) * Math.PI) : 0;
      if (!quietCrash) drawGlitch(ctx, g, Math.floor(crashClock * 24) + hash(crashX100) * 100);
      if (crashClock >= BSOD_AT_S) drawBSOD(ctx, crashClock - BSOD_AT_S, blueScreen(), realClock);
    }
    drawScanlines(ctx);
  }

  return { draw };
}
