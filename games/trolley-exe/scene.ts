/**
 * Composes TROLLEY.EXE: the line scrolling under a trolley that stays put, fork after fork with people on both
 * branches, the lever at each one thrown by the player (arrows, W/S, a tap or a swipe) or by AUTO-ETHICS.DLL
 * until they do, God's commentary on every switch and every rung, the walk-away on an accepted cash-out, and
 * the crash's lunge, tear and blue screen with the Book of switches as its trace. Tension and every beat key
 * off the displayed multiplier, the round's elapsed time and the crash age; nothing here reads, predicts or
 * changes the committed outcome, and no switch moves the credits.
 */
import { type Effect, pageAudio } from './audio';
import { FORK_LEN, SPACING, type World, alignment, autopilot, branchOffset, createWorld, currentFork, nextFork, resetWorld, settleRunning, stepWorld } from './course';
import { type Input, createInput } from './input';
import { CRASH_LINES, HANDED_BACK, INTERN_AT, NAMES, OPENING, OVERTIME, type Outcome, REGRET, RUNGS, TAKEN, WAITING, WALKED, WALKED_LATE } from './lines';
import { createScript, hush, resetScript, say, settleLine, settleScript, stepScript, typing, visibleText } from './script';
import { type BlueScreen, COLOURS, MAIN_Y, clamp, drawBSOD, drawCRT, drawFootLine, drawFork, drawForkCard, drawGlitch, drawGodBox, drawLever, drawReadout, drawScanlines, drawSparks, drawStamp, drawTitle, drawTrack, drawTram, drawTrolley, formatX, hash, screenX } from './world';
import { TROLLEY_X } from './course';

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
  dispose(): void;
}

/** The multipliers that ring a milestone. */
const MARKS = [1.2, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 15, 22, 30, 50, 100];
const FREEZE_S = 0.15;
const LUNGE_PX = 560;
const GLITCH_FROM_S = 0.5;
const GLITCH_TO_S = 1.7;
const BSOD_AT_S = 1.25;
const ENDING_S = 4.6;
const ENCORE_MAX_S = 3.5;

const credits = (n: number): string => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const short = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** The lever's hand is the page's, not a scene's: the shell recreates scenes. */
let playerSteers = false;
let rounds = 0;
/** The round in progress, so a scene recreated mid-round picks the same course back up when the clocks agree. */
let live: { world: World; elapsed: number; wall: number } | null = null;
const mode = () => document.documentElement.dataset.mode ?? 'standalone';
const seedFor = (): number => (mode() === 'replay' ? 7 : (Date.now() ^ Math.imul(rounds + 1, 2654435761)) >>> 0);

export function createScene(): Scene {
  // A chiptune in a green phosphor glow; the crash is the picture losing sync.
  const audio = pageAudio({ style: 'chiptune', crash: 'static' });
  const canvas = document.querySelector('canvas')!;
  const keyboard = typeof matchMedia === 'function' ? matchMedia('(hover: hover) and (pointer: fine)') : null;
  let took = false;
  const input: Input = createInput(canvas, () => { playerSteers = true; });
  const button = document.querySelector<HTMLButtonElement>('#autoethics');
  if (button) {
    button.hidden = mode() === 'replay';
    // Focus stays off the button, so Space still cashes out through the shell.
    button.onmousedown = (event) => event.preventDefault();
    button.onclick = () => {
      playerSteers = !playerSteers;
      handed = true;
    };
  }
  let handed = false;
  const script = createScript(RUNGS, OVERTIME);
  let world = createWorld(seedFor());
  let last: number | null = null;
  let time = 0;
  let realClock = 0;
  let previous: SceneView['phase'] | null = null;
  let opened = false;
  let waitingSaid = false;
  let secured: { x100: number; payout: number | null; age: number } | null = null;
  let stamp = 0;
  let crashed = false;
  let quietCrash = false;
  let outcome: Outcome | null = null;
  let crashClock = 0;
  let crashX100 = 100;
  let crashStake: number | null = null;
  let encore: number | null = null;
  let crashLine = 0;
  let regret = 0;
  let lastMark = 0;
  let wheel = 0;
  let bell = 0;
  let freeze = 0;
  let slow = 0;
  let shake = 0;
  const cueAt = new Map<Effect, number>();

  function cue(effect: Effect, strength: number, fresh: boolean): void {
    if (fresh) return;
    const at = cueAt.get(effect) ?? -1;
    if (realClock - at < 0.08) return;
    cueAt.set(effect, realClock);
    audio.fx(effect, strength);
  }
  function newRound(): void {
    rounds += 1;
    resetWorld(world, seedFor());
    live = null;
  }
  function reset(): void {
    resetScript(script);
    opened = waitingSaid = false;
    secured = null;
    stamp = 0;
    crashed = quietCrash = false;
    outcome = null;
    crashClock = 0;
    crashX100 = 100;
    crashStake = null;
    encore = null;
    crashLine = regret = lastMark = 0;
    freeze = slow = shake = 0;
    took = false;
    newRound();
  }
  function beginCrash(view: SceneView, quiet: boolean, tension: number): void {
    crashed = true;
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    crashX100 = view.currentX100;
    crashStake = view.stake;
    hush(script);
    const lines = CRASH_LINES[outcome];
    if (quiet) {
      // Met late: the aftermath as it stands, the lunge already run, its last line already said, no stinger.
      quietCrash = true;
      crashClock = view.crashAge / 1000;
      crashLine = lines.length;
      stepWorld(world, { up: false, down: false }, { running: false, tension, crashing: true, by: 'auto', manual: false }, LUNGE_PX / 900);
      const lastLine = lines.at(-1);
      if (lastLine) settleLine(script, lastLine[1]);
      audio.crash('static', true);
      return;
    }
    freeze = FREEZE_S;
    slow = 0.3;
    shake = 1;
    audio.crash('static');
    cue('buzz', 1, false);
  }

  function footLine(view: SceneView, auto: boolean): [text: string, colour: string] {
    const over = view.phase === 'crashed';
    if (secured) {
      const pay = secured.payout !== null ? ` · ${credits(secured.payout).toUpperCase()}` : '';
      return [over ? `WALKED AWAY AT ${formatX(secured.x100)}${pay} · DODGED THE CRASH` : `WALKED AWAY AT ${formatX(secured.x100)}${pay} · THE MACHINE HAS THE LEVER`, COLOURS.ph];
    }
    if (view.stake === null) {
      if (over) return ['WATCHED IT CRASH · NO CREDITS LOST · STILL COMPLICIT', COLOURS.dim];
      if (view.phase === 'running') return ['WATCHING · NO CREDITS RIDING · THE LEVER IS STILL YOURS TO THROW', COLOURS.dim];
      if (view.phase === 'betting') return ['PLACE YOUR BETS · THE FORKS WAIT FOR NO ONE, EXCEPT NOW', COLOURS.dim];
      return ['WAITING FOR A TROLLEY · THERE IS ALWAYS A TROLLEY', COLOURS.dim];
    }
    if (over) return [`YOUR ${credits(view.stake).toUpperCase()} WENT DOWN AT FORK ${world.ledger.length + 1}`, COLOURS.red];
    if (view.phase === 'running') return [auto ? `AUTO-ETHICS.DLL HAS THE LEVER · ${credits(view.stake).toUpperCase()} RIDING` : `YOUR HAND IS ON THE LEVER · ${credits(view.stake).toUpperCase()} RIDING`, auto ? COLOURS.violet : COLOURS.amber];
    return [`YOU'RE IN · ${credits(view.stake).toUpperCase()} · THE FIRST FORK IS COMING`, COLOURS.amber];
  }

  function blueScreen(): BlueScreen {
    const kind = outcome ?? 'watched';
    const forks = world.ledger.length;
    let code = 'MORAL_EXCEPTION_NOT_HANDLED';
    if (kind === 'dodged') code = 'LEVER_ABANDONED_IN_TIME';
    else if (kind === 'watched') code = 'SPECTATOR_COMPLICITY';
    else if (world.bodies >= 25) code = 'BODY_COUNT_OVERFLOW';
    else if (forks > 0 && world.yours === 0 && world.fewer + world.more + world.same === 0) code = 'AUTO_ETHICS_DLL_FAULT';
    const detail = kind === 'rekt' ? `${forks} forks. ${world.bodies} bodies: ${world.yours} by your hand, ${world.autos} by the machine. ${crashStake !== null ? credits(crashStake) : 'Credits'} riding.`
      : kind === 'dodged' ? `Walked away at ${formatX(secured?.x100 ?? 100)}${secured?.payout !== null && secured?.payout !== undefined ? ` for ${credits(secured.payout)}` : ''}. ${forks} forks, ${world.bodies} bodies; the machine threw the switches after you.`
      : `No stake. ${forks} forks watched. ${world.bodies} bodies, none by your hand, all in full view.`;
    const trace = world.ledger.slice().reverse().slice(0, 4).map((e) => `  at Player.switch(${e.index + 1}: ${short(e.caption, 34)}) [${e.by === 'you' ? 'your hand' : 'AUTO-ETHICS.DLL'}] +${e.bodies}`);
    return { code, detail, crashedAt: formatX(crashX100), failed: kind === 'dodged' ? 'everyone_else.sys' : world.yours === 0 && forks > 0 ? 'auto_ethics.dll' : 'you.sys', trace };
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
      ? { ...shown, phase: 'crashed', currentX100: crashX100, crashAge: crashClock * 1000, stake: crashStake, cashoutX100: secured?.x100 ?? null, payout: secured?.payout ?? null }
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
    const tension = 1 - 1 / multiplier;
    const seconds = view.elapsed / 1000;
    const running = view.phase === 'running';
    const fresh = previous === null;

    if (fresh) {
      previous = view.phase;
      if (running || view.phase === 'crashed') {
        // Opened mid-round: the course as far as it got, the machine's switches behind, the lines already due.
        const same = live && live.world !== world && running && view.elapsed >= live.elapsed - 250 && Math.abs(view.elapsed - live.elapsed - (Date.now() - live.wall)) < 4_000;
        if (same && live) world = live.world;
        else {
          rounds += 1;
          resetWorld(world, seedFor());
          settleRunning(world, multiplier, seconds);
        }
        settleScript(script, multiplier);
        opened = true;
        lastMark = MARKS.filter((m) => multiplier >= m).length;
        if (view.cashoutX100 !== null) {
          secured = { x100: view.cashoutX100, payout: view.payout, age: 99 };
          stamp = 1;
          while (regret < REGRET.length && multiplier / (secured.x100 / 100) >= REGRET[regret]!.at) regret += 1;
          if (running) settleLine(script, WALKED_LATE(formatX(secured.x100)));
        }
      }
      if (view.phase === 'crashed') beginCrash(view, true, tension);
    } else if (view.phase !== previous) {
      if (view.phase === 'crashed' && !crashed) beginCrash(view, view.crashAge > 1500, tension);
      if (view.phase === 'betting' || view.phase === 'waiting') reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    if (crashed && encore === null) crashClock = view.crashAge / 1000;
    const liveRound = running && !crashed;
    if (liveRound) live = { world, elapsed: view.elapsed, wall: Date.now() };

    if (view.phase === 'betting' && !opened) {
      opened = true;
      for (const line of OPENING) say(script, line);
    }
    if (view.phase === 'waiting' && !waitingSaid) {
      waitingSaid = true;
      say(script, WAITING[0]!);
    }
    // ─── The walk-away: the backend's confirmation, never the click ───
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout, age: 0 };
      if (liveRound && !fresh) {
        say(script, WALKED(formatX(secured.x100)), true, true);
        audio.cashout();
        cue('door', 0.7, false);
      } else {
        secured.age = 99;
        stamp = 1;
      }
    }
    if (secured) {
      secured.age += dt;
      if (secured.payout === null && view.payout !== null) secured.payout = view.payout;
      stamp += (1 - stamp) * (1 - Math.exp(-dt * 9));
      if (liveRound) {
        const past = multiplier / (secured.x100 / 100);
        while (regret < REGRET.length && past >= REGRET[regret]!.at) say(script, REGRET[regret++]!.line);
      }
    }
    if (crashed && !quietCrash && outcome) {
      const lines = CRASH_LINES[outcome];
      while (crashLine < lines.length && lines[crashLine]![0] <= crashClock) say(script, lines[crashLine++]![1], true, true);
    }

    // ─── The lever: the player's hand, or the machine's ───
    const auto = secured !== null || !playerSteers;
    if (button) button.textContent = playerSteers ? 'Auto-ethics: off' : 'Auto-ethics: on';
    if (handed) {
      handed = false;
      if (liveRound) say(script, playerSteers ? TAKEN : HANDED_BACK, true, true);
      if (playerSteers) took = true;
    }
    const taken = input.take();
    const cmd = auto ? autopilot(world) : taken;
    if (!auto && !took && (taken.up || taken.down) && liveRound) {
      took = true;
      say(script, TAKEN, true, true);
    }
    const lunging = crashed && !quietCrash && crashClock > FREEZE_S && world.crashRun < LUNGE_PX;
    stepWorld(world, cmd, { running: liveRound, tension, crashing: lunging, by: auto ? 'auto' : 'you', manual: !auto }, dt);
    const ev = world.events;
    if (ev.thrown && liveRound) cue(ev.thrown.by === 'you' ? 'click' : 'beep', 0.4, fresh);
    if (ev.locked.length && liveRound) cue('ratchet', 0.5, fresh);
    if (ev.hits > 0) {
      cue('thud', 0.65, fresh || quietCrash);
      if (ev.hits > 1 || lunging) cue('gasp', 0.4, fresh || quietCrash);
    }
    for (const f of ev.resolved) {
      if (!liveRound || !f.lever) continue;
      const by = f.setBy ?? 'auto';
      say(script, { who: multiplier >= INTERN_AT ? 'intern' : 'god', text: by === 'you' ? f.dilemma.you[f.lever] : f.dilemma.auto[f.lever] }, true, true);
      cue('bell', 0.5, fresh);
    }
    stepScript(script, multiplier, dt, liveRound);
    for (const line of script.events) cue(line.who === 'intern' ? 'beep' : 'click', 0.3, fresh);

    // ─── Rungs and the bell ───
    const mark = MARKS.filter((m) => multiplier >= m).length;
    if (!fresh && liveRound && mark > lastMark) audio.milestone(mark);
    lastMark = mark;
    if (liveRound && !secured) {
      const before = Math.floor(bell);
      bell += dt * (0.5 + 1.8 * tension);
      if (Math.floor(bell) > before) cue('tick', 0.25 + 0.5 * tension, fresh);
    }
    wheel += dt * (2 + world.speed / 12);
    shake = Math.max(0, shake - dt * 1.7);
    const jolt = crashed && !quietCrash ? 7 * shake * shake : 0;

    // ─── The picture ───
    const next = nextFork(world);
    ctx.save();
    drawCRT(ctx);
    ctx.translate(jolt * Math.sin(realClock * 71), jolt * Math.sin(realClock * 53));
    drawTrack(ctx, world, next);
    for (const f of world.forks) {
      const sx = screenX(world, f.at);
      if (sx < -FORK_LEN - 60 || sx > 960 + 60) continue;
      drawFork(ctx, world, f, time);
      drawLever(ctx, sx, f, f === next, time);
    }
    const inside = currentFork(world);
    const lamp = running || crashed ? 0.5 + 0.5 * Math.abs(Math.sin(time * (3 + 6 * tension))) : 0.15;
    const fast = world.speed > 400;
    drawSparks(ctx, TROLLEY_X, MAIN_Y, fast ? 1 : tension * 0.6 * (liveRound ? 1 : 0), time);
    if (lunging && inside && inside.lever) {
      // Both branches at once: the program has crashed and the lever means nothing.
      const other = inside.lever === 'up' ? 'down' : 'up';
      const p = (world.distance - inside.at) / FORK_LEN;
      drawTram(ctx, TROLLEY_X, MAIN_Y + branchOffset(p, other), 0, wheel, lamp, 1.5, true);
    }
    drawTrolley(ctx, world, wheel, lamp, fast ? 1.5 : 0);
    if (secured) drawStamp(ctx, `WALKED AWAY AT ${formatX(secured.x100)}`, 760, 246, stamp, COLOURS.ph);
    ctx.restore();

    // ─── The HUD ───
    const sub = view.phase === 'crashed' ? 'GOD HAS DECIDED' : view.phase === 'running' ? 'GOD IS COUNTING · HE HAS NOTES' : 'AN ETHICS SIMULATOR';
    drawTitle(ctx, sub);
    const who = script.current?.who ?? (multiplier >= INTERN_AT ? 'intern' : 'god');
    const patienceLabel = multiplier >= INTERN_AT ? "INTERN'S PATIENCE (UNPAID)" : "GOD'S PATIENCE";
    const patience = crashed && outcome !== 'dodged' ? 0 : multiplier >= INTERN_AT ? 0.35 + 0.1 * Math.sin(time * 5) : 1 - tension;
    drawGodBox(ctx, NAMES[who], visibleText(script), typing(script), patience, patienceLabel, realClock);
    const punch = crashed ? (1 - clamp((crashClock - 0.12) / 0.25, 0, 1)) ** 2 : 0;
    const colour = crashed ? (outcome === 'dodged' ? COLOURS.ph : COLOURS.red) : secured ? COLOURS.ph : running ? COLOURS.amber : COLOURS.dim;
    drawReadout(ctx, view.currentX100, punch, colour, crashed ? 'CRASHED AT' : 'HESITATION BONUS');
    if (!crashed || crashClock < BSOD_AT_S) {
      const toSplit = next ? clamp((next.at - world.distance) / SPACING, 0, 1) : 1;
      drawForkCard(ctx, running || view.phase === 'betting' ? next : null, auto, toSplit, keyboard?.matches ?? true, `FORKS ${world.ledger.length} · BODIES ${world.bodies} · ${world.yours} YOURS · ${alignment(world)}`);
    }
    const [line, lineColour] = footLine(view, auto);
    drawFootLine(ctx, line, lineColour);

    // ─── The crash: the tear, then the blue screen ───
    if (crashed) {
      const g = crashClock < GLITCH_FROM_S ? 0 : crashClock < GLITCH_TO_S ? Math.sin(((crashClock - GLITCH_FROM_S) / (GLITCH_TO_S - GLITCH_FROM_S)) * Math.PI) : 0;
      if (!quietCrash) drawGlitch(ctx, g, Math.floor(crashClock * 24) + hash(crashX100) * 100);
      if (crashClock >= BSOD_AT_S) drawBSOD(ctx, crashClock - BSOD_AT_S, blueScreen(), realClock);
    }
    drawScanlines(ctx);
  }

  return {
    draw,
    dispose() {
      input.dispose();
      if (button) button.onclick = null;
    },
  };
}
