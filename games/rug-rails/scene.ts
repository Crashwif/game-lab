/**
 * Composes Rug Rails from the room state: the course and the frog stepped with the frame time and the
 * player's commands (or the copy-trading bot's), the tunnel drawn around them, the Taxman, the coin spray,
 * then the HUD (the caption ladder, the round's multiplier, the bag, the stash with its rank, the power-up
 * timers), with the sound cued from what the course reports. The round's phases come from the shell: the
 * crash rolls the rails up like a carpet and the cash-out lifts the frog off them on a hoverboard. The bag
 * is a skill score with no value; nothing drawn or steered here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { CYAN, GOLD, INK, LIME, MONO, PINK, count, memeText, panel, text } from './art';
import { MAX_SPEED, POWER_S, RUNNER_Z, FAR, type World, autopilot, createWorld, resetWorld, settleRunning } from './course';
import { stepWorld } from './course';
import { type Input, createInput } from './input';
import { clamp, mix, mulberry32, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { drawFrog, drawShadow, drawTaxman } from './runner';
import { type Drip, type Stash, DRIP, dripFor, loadStash, nextGoal, rankFor, saveStash } from './stash';
import { type Camera, H, W, drawWorld, project, vignette } from './track';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a rug pull missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the shake, the flash, the hit-stop, the spins and the flicker. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose(): void;
}

/** The caption ladder: what the tunnel says at each multiplier. */
const STAGES = [
  { at: 1, caption: 'GM. RUN.', alert: 'TRENCHES LINE', detail: 'NEXT STOP: NOWHERE.' },
  { at: 1.25, caption: 'DYOR IS FOR NERDS', alert: 'RUG DETECTOR', detail: 'BATTERY DEAD SINCE 2021.' },
  { at: 1.6, caption: 'TAXMAN ON THE PLATFORM', alert: 'AUDIT DEPT. IN THE TUNNEL', detail: 'HE WANTS 37% OF YOUR VIBES.' },
  { at: 2.2, caption: 'DIAMOND KNEES', alert: 'MOM: ARE YOU GAMBLING', detail: 'NO MOM. IT IS A SKILL GAME.' },
  { at: 3.2, caption: 'GENERATIONAL SPRINT', alert: 'WHALE ON THE TRACKS', detail: 'IT IS NOT MOVING. YOU ARE.' },
  { at: 4.8, caption: 'THE RAILS FEEL LOOSE', alert: 'DEV WALLET: AWAKE', detail: 'PROBABLY NOTHING. SURELY.' },
  { at: 7.5, caption: 'STILL HERE? SEEK HELP', alert: 'THERAPIST: OUT OF OFFICE', detail: 'SHE BOUGHT THE TOP TOO.' },
  { at: 12, caption: 'PHYSICS HAS LOGGED ON', alert: 'SPEED ILLEGAL IN 14 STATES', detail: 'ALL 14 ARE COPING.' },
  { at: 20, caption: 'YOUR BAG HAS ITS OWN GRAVITY', alert: 'NASA WANTS A WORD', detail: 'THEY ALSO WANT A BAG.' },
  { at: 40, caption: 'THIS IS FINE', alert: 'REALITY: UNINSTALLED', detail: 'NGMI. BUT FAST.' },
] as const;

/** The hit-stop on the frame the rails go, and how long the roll takes to reach the frog. */
const FREEZE_S = 0.08;
const ROLL_S = 0.75;
/** The frog's berth on the hoverboard: off the rails, to the right, clear of the HUD. */
const HOVER_X = 1.78;
const HOVER_H = 0.85;
const TOAST_S = 1.7;

interface Particle { x: number; y: number; vx: number; vy: number; age: number; r: number; colour: string }
interface Toast { line: string; colour: string; age: number; pop: ReturnType<typeof spring> }

/** The stash and the steering are the page's, not a scene's: the shell recreates scenes. */
const stash: Stash = loadStash();
let playerSteers = false;
let rounds = 0;
/**
 * The round in progress, so a scene the shell recreates mid-round (a tab hidden a moment) picks the same
 * course and bag back up: the running time must have kept pace with the wall clock since it was left.
 */
let live: { world: World; elapsed: number; wall: number; banked: number | null } | null = null;

const mode = () => document.documentElement.dataset.mode ?? 'standalone';
const seedFor = (): number => (mode() === 'replay' ? 1 : (Date.now() ^ Math.imul(rounds + 1, 2654435761)) >>> 0);

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // Drum and bass for a sprint; the crash is the rails going with a boom.
  const audio = pageAudio({ style: 'dnb', bpm: 168, tempoRise: 0.25, crash: 'boom', music: 0.6 });
  const canvas = document.querySelector('canvas')!;
  const input: Input = createInput(canvas, () => { playerSteers = true; });
  let world = createWorld(seedFor());
  const cam: Camera = { x: 0 };
  const camX = spring(0);
  const hover = spring(0);
  const slideK = spring(0);
  const bagShown = spring(0);
  const outcomePop = spring(0);
  const badge = spring(0);
  let previous: SceneView['phase'] | null = null;
  let last: number | null = null;
  let time = 0;
  let secured: { x100: number; payout: number | null } | null = null;
  let banked: number | null = null;
  let crashAge = -1;
  let rugZ = Infinity;
  let fallen = false;
  let fallAge = 0;
  let stage = 0;
  let alertAge = 10;
  let shake = 0;
  let freeze = 0;
  let flash = 0;
  let spray: Particle[] = [];
  let toast: Toast | null = null;
  let unlocked: { label: string; age: number } | null = null;
  let coinClock = 0;
  let stepClock = 0;
  let frogScreen = { x: W / 2, y: 460, k: 1 };
  let drip: ReadonlySet<Drip> = dripFor(stash.coins);

  function say(line: string, colour = '#fff'): void {
    toast = { line, colour, age: 0, pop: spring(0) };
    toast.pop.v = 9;
  }

  function newRound(): void {
    rounds += 1;
    resetWorld(world, seedFor());
    secured = null;
    banked = null;
    crashAge = -1;
    rugZ = Infinity;
    fallen = false;
    fallAge = 0;
    stage = 0;
    alertAge = 10;
    freeze = 0;
    spray = [];
    toast = null;
    settleSpring(hover, 0);
    settleSpring(outcomePop, 0);
    settleSpring(badge, 0);
    settleSpring(bagShown, 0);
    live = { world, elapsed: 0, wall: Date.now(), banked: null };
  }

  /** Coins fly out of the bag: a spill, the Taxman's grab, or the whole bag into the void. */
  function spill(coins: number): void {
    if (reduced && coins > 6) coins = 6;
    const n = Math.min(coins, 26);
    const rand = mulberry32(Math.floor(time * 1000) + coins);
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4;
      const v = 220 + rand() * 380;
      spray.push({ x: frogScreen.x + (rand() - 0.5) * 30 * frogScreen.k, y: frogScreen.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, r: (5 + rand() * 4) * frogScreen.k, colour: i % 4 === 0 ? GOLD : '#d38b3a' });
    }
  }

  /** The cash-out lands: the bag is banked into the stash, and any drip it earns is announced. */
  function bank(): void {
    const coins = fallen ? 0 : world.bag;
    banked = coins;
    if (live) live.banked = coins;
    if (coins > 0) {
      const before = drip;
      stash.coins += coins;
      stash.best = Math.max(stash.best, coins);
      stash.banked += 1;
      saveStash(stash);
      drip = dripFor(stash.coins);
      const fresh = DRIP.find((d) => drip.has(d.item) && !before.has(d.item));
      if (fresh) unlocked = { label: fresh.label, age: 0 };
    }
  }

  /** The rails go. A crash more than 1.5 s old is shown settled, so one missed while the tab was hidden is not replayed late. */
  function rugPull(view: SceneView, first: boolean): void {
    const quiet = first || view.crashAge > 1500;
    crashAge = quiet ? Math.max(3, view.crashAge / 1000) : 0;
    if (quiet) {
      rugZ = RUNNER_Z - 0.45;
      if (hover.x < 0.5 && !secured) {
        fallen = true;
        fallAge = 3;
        world.bag = 0;
      }
      settleSpring(outcomePop, 1);
      audio.crash('boom', true);
      return;
    }
    shake = 0.5;
    if (!reduced) freeze = FREEZE_S;
    if (secured) {
      audio.crash('boom', true);
      audio.fx('gasp', 0.8);
    } else audio.crash('boom');
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    }
    time += dt;
    const first = previous === null;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const tension = clamp(1 - Math.exp(-growth / 2.3), 0, 1);

    // ---- The round's phases -----------------------------------------------------------------------------
    if (view.phase === 'betting' && previous !== 'betting') newRound();
    if (first) {
      // A fresh scene can open on any phase: settle straight into it rather than replay the round. A round
      // this page was already running comes back with its course and bag when the clocks agree.
      const same = live && live.world !== world && running && view.elapsed >= live.elapsed - 250 && Math.abs(view.elapsed - live.elapsed - (Date.now() - live.wall)) < 4_000;
      if (same && live) {
        world = live.world;
        banked = live.banked;
        settleSpring(bagShown, world.bag);
      } else if (running || crashed) {
        rounds += 1;
        resetWorld(world, seedFor());
        settleRunning(world, multiplier, view.elapsed / 1000);
        live = { world, elapsed: view.elapsed, wall: Date.now(), banked: null };
      }
      stage = Math.max(0, STAGES.filter((s) => multiplier >= s.at).length - 1);
    }
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (banked === null) bank();
      if (first || crashed) {
        settleSpring(hover, 1);
        settleSpring(badge, 1);
      } else {
        audio.cashout();
        audio.fx('whoosh', 0.7);
        badge.v = 12;
        say(banked ? `BAILED · ${count(banked)} BANKED` : 'BAILED · EMPTY BAG', LIME);
      }
    }
    if (crashed && previous !== 'crashed') rugPull(view, first);
    if (running && previous !== 'running' && !first) {
      alertAge = 0;
      audio.fx('whistle', 0.6);
    }
    previous = view.phase;
    if (live && live.world === world) {
      live.elapsed = view.elapsed;
      live.wall = Date.now();
    }

    // ---- The caption ladder --------------------------------------------------------------------------------
    alertAge += dt;
    const nextStage = Math.max(0, STAGES.filter((s) => multiplier >= s.at).length - 1);
    if (running && nextStage > stage) {
      stage = nextStage;
      alertAge = 0;
      if (!secured) {
        audio.milestone(stage);
        audio.fx('notify', 0.45);
      }
    }

    // ---- The course ----------------------------------------------------------------------------------------
    const offRails = hover.x > 0.05 || fallen;
    const cmd = playerSteers ? input.take() : autopilot(world, dt);
    stepWorld(world, cmd, { running: running && !fallen, multiplier, tension, off: offRails }, dt);
    const e = world.events;
    const r = world.runner;
    const speedK = world.speed.x / MAX_SPEED;
    if (running && !offRails) {
      coinClock -= dt;
      stepClock -= dt;
      if (e.coins > 0 && coinClock <= 0) {
        coinClock = 0.07;
        audio.fx('coin', 0.55 + 0.45 * clamp(world.streak / 40, 0, 1));
      }
      if (e.step && stepClock <= 0) {
        stepClock = 0.2;
        audio.fx('stomp', 0.12 + 0.18 * speedK);
      }
      if (e.jump) audio.fx('whoosh', 0.5);
      if (e.slide) audio.fx('whoosh', 0.35);
      if (e.swerve) audio.fx('whoosh', 0.28);
      if (e.land) audio.fx('thud', 0.35);
      if (e.lambo) {
        audio.fx('kaching', 0.9);
        say('LAMBO COIN · +25', CYAN);
      }
      if (e.streak) {
        audio.fx('ding', 1);
        say(`${e.streak} STREAK · +25 BONUS`, GOLD);
      }
      if (e.magnet) {
        audio.fx('notify', 1);
        say('INSIDER TIP · COINS COME TO YOU', CYAN);
      }
      if (e.double) {
        audio.fx('notify', 1);
        say('2× LEVERAGE · DOUBLE COINS', '#c4b5fd');
      }
      if (e.expired) audio.fx('tick', 0.8);
      if (e.honey) {
        audio.fx('glug', 1);
        say('HONEYPOT · −20% BAG · SKILL ISSUE', PINK);
        shake = Math.max(shake, 0.15);
      }
      if (e.stumble) {
        audio.fx('thud', 0.9);
        audio.fx('clang', 0.4);
        shake = Math.max(shake, 0.3);
        if (!e.audit) say('STUMBLED · −25% BAG', '#ffb3c8');
      }
      if (e.heavy) {
        audio.fx('punch', 1);
        audio.fx('scream', 0.55);
        shake = Math.max(shake, 0.6);
        flash = reduced ? 0.15 : 0.5;
        say('REKT · BAG GONE', PINK);
      }
      if (e.audit) {
        audio.fx('siren', 0.7);
        audio.fx('laugh', 0.5);
        say('AUDITED · THE TAXMAN TOOK THE BAG', PINK);
      }
      if (e.spill > 0) spill(e.spill);
    }
    audio.update(view.phase, secured ? 0.05 : tension);

    // ---- The hover and the fall ---------------------------------------------------------------------------
    stepSpring(hover, secured ? 1 : 0, 3.2, 0.9, dt);
    stepSpring(slideK, r.slide > 0 ? 1 : 0, 26, 0.9, dt);
    stepSpring(bagShown, world.bag, 12, 0.7, dt);
    stepSpring(camX, hover.x > 0.5 ? 0 : r.x.x * 0.3, 5, 1, dt);
    cam.x = camX.x;
    if (crashed && crashAge >= 0) {
      crashAge += dt;
      const roll = smoothstep(0, ROLL_S, crashAge);
      rugZ = mix(FAR, RUNNER_Z - 0.45, roll);
      if (!fallen && rugZ <= RUNNER_Z + 0.3 && hover.x < 0.5) {
        fallen = true;
        fallAge = 0;
        if (world.bag > 0) {
          spill(world.bag);
          world.bag = 0;
        }
        audio.fx('scream', 1);
        audio.fx('whoosh', 0.8);
        shake = Math.max(shake, 0.8);
      }
      if (fallen) fallAge += dt;
    }
    stepSpring(outcomePop, crashed && crashAge > 1 ? 1 : 0, 14, 0.45, dt);
    stepSpring(badge, secured && !crashed ? 1 : 0, 12, 0.5, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.55);
    if (flash > 0) flash = Math.max(0, flash - dt * 2.5);
    for (const p of spray) {
      p.age += dt;
      p.vy += 950 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    spray = spray.filter((p) => p.age < 1.3 && p.y < H + 40);
    if (toast) {
      toast.age += dt;
      stepSpring(toast.pop, 0, 12, 0.4, dt);
      if (toast.age > TOAST_S) toast = null;
    }
    if (unlocked) {
      unlocked.age += dt;
      if (unlocked.age > 4) unlocked = null;
    }

    // ---- The picture ---------------------------------------------------------------------------------------
    const dark = crashed && crashAge >= 0 ? smoothstep(0.2, 1.4, crashAge) : 0;
    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    else if (!reduced && running && !offRails) ctx.translate(Math.sin(time * 90) * 1.4 * speedK * speedK, 0);
    const fall = fallen ? clamp(fallAge / 1.2, 0, 1) : 0;
    drawWorld(ctx, world, { time, distance: world.distance, tension, rugZ, dark, reduced }, cam, () => {
      const x = mix(r.x.x, HOVER_X, hover.x);
      const hoverBob = reduced ? 0 : Math.sin(time * 2.2) * 0.05;
      const h = fallen ? -(fallAge * fallAge * 6) : mix(r.h, HOVER_H + hoverBob, hover.x);
      if (h < -8) return;
      if (!fallen && hover.x < 0.5) {
        const g = project(r.x.x, RUNNER_Z, r.ground, cam);
        drawShadow(ctx, g.X, g.Y, g.s, r.h - r.ground);
      }
      const p = project(x, RUNNER_Z, h, cam);
      const k = (p.s * 0.7) / 130;
      frogScreen = { x: p.X, y: p.Y - 78 * k, k };
      drawFrog(ctx, {
        X: p.X, Y: p.Y, s: p.s, stride: r.stride, lean: r.x.v, air: !fallen && hover.x < 0.5 && r.h > r.ground + 0.05, vh: r.vh, slide: slideK.x,
        stumble: r.stumble, down: r.down, audit: world.audit, bag: bagShown.x, drip, hover: hover.x, fall, magnet: world.magnet > 0, double: world.double > 0, time, reduced,
      });
    });
    // The Taxman: on the platform before the round, on the frog's heels after a stumble, into the void with the rails.
    const station = view.phase === 'betting' || view.phase === 'waiting';
    if (station && world.distance < 8) {
      const p = project(2.35, 4.6 - world.distance, 0.42, cam);
      drawTaxman(ctx, { X: p.X, Y: p.Y, k: (p.s * 0.85) / 170, heat: 1, reachTo: null, grab: 0, idle: true, fall: 0, time, reduced });
    } else if (world.heat > 0.02 && (!fallen || fallAge < 1.5)) {
      const heat = world.heat;
      const grab = world.audit >= 0 ? clamp(world.audit / 1.2, 0, 1) : 0;
      const drop = fallen ? fallAge * fallAge * 900 : 0;
      drawTaxman(ctx, { X: frogScreen.x - 130 * frogScreen.k, Y: H + 175 - heat * 265 + drop, k: 1.25 * frogScreen.k, heat, reachTo: grab > 0 && grab < 1 ? { x: frogScreen.x, y: frogScreen.y } : null, grab, idle: false, fall, time, reduced });
    }
    for (const p of spray) {
      ctx.globalAlpha = clamp(1.6 - p.age * 1.2, 0, 1);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * (reduced ? 1 : Math.abs(Math.cos(p.age * 14 + p.r))), 0, 0, Math.PI * 2);
      ctx.fillStyle = p.colour;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    vignette(ctx, 0.35 * speedK + 0.25 * tension + 0.5 * dark);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 90, 140, ${flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    hud(ctx, view, multiplier, running, crashed, station);
  }

  // ---- The HUD -------------------------------------------------------------------------------------------

  function hud(ctx: CanvasRenderingContext2D, view: SceneView, multiplier: number, running: boolean, crashed: boolean, station: boolean): void {
    const bot = !playerSteers;
    // Title and the Taxman's heat.
    panel(ctx, 14, 12, 214, 58, 'rgba(10, 8, 26, 0.72)', '#3b2d63', 8);
    text(ctx, 'RUG RAILS', 26, 30, 21, GOLD, 'left', 190);
    text(ctx, 'TRENCHES LINE · NO STOPS · NO LP', 26, 48, 7.5, '#c9c2e6', 'left', 190, MONO);
    ctx.fillStyle = '#2a2244';
    ctx.fillRect(26, 58, 150, 5);
    ctx.fillStyle = world.heat > 0.7 ? PINK : '#ff8fb5';
    ctx.fillRect(26, 58, 150 * clamp(world.heat, 0, 1), 5);
    text(ctx, world.heat > 0.7 ? 'AUDIT RISK' : 'TAXMAN', 182, 60, 7, world.heat > 0.7 ? PINK : '#c9c2e6', 'left', 44, MONO);
    // The round's multiplier, from the room.
    const colour = crashed ? (secured ? LIME : PINK) : secured ? LIME : running ? '#fff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, W - 22, 44, 42, colour, 'right', 220);
    // The bag, this round's score, with the power-ups under it.
    panel(ctx, W - 226, 74, 212, 40, 'rgba(10, 8, 26, 0.72)', '#3b2d63', 8);
    ctx.beginPath();
    ctx.arc(W - 204, 94, 11, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.strokeStyle = '#a67c00';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, '$', W - 204, 95, 13, '#6b4a00', 'center');
    text(ctx, `BAG ${count(bagShown.x)}`, W - 186, 88, 17, '#fff', 'left', 150);
    text(ctx, world.streak >= 5 ? `${world.streak} STREAK${world.double > 0 ? ' · 2×' : ''}` : world.double > 0 ? '2× LEVERAGE' : 'WORTH: NOTHING', W - 186, 105, 7.5, world.streak >= 5 ? GOLD : '#c9c2e6', 'left', 160, MONO);
    let barY = 122;
    for (const [left, label, tint] of [[world.magnet, 'INSIDER TIP', CYAN], [world.double, '2× LEVERAGE', '#c4b5fd']] as const) {
      if (left <= 0) continue;
      panel(ctx, W - 226, barY, 212, 16, 'rgba(10, 8, 26, 0.72)', undefined, 4);
      ctx.fillStyle = tint;
      ctx.fillRect(W - 220, barY + 4, 200 * clamp(left / POWER_S, 0, 1), 8);
      text(ctx, label, W - 120, barY + 8, 7, INK, 'center', 180, MONO);
      barY += 20;
    }
    // The stash: every bag banked here, its rank and what it unlocks next. Recognition only.
    const goal = nextGoal(stash.coins);
    panel(ctx, W - 300, H - 52, 286, 40, 'rgba(10, 8, 26, 0.72)', '#3b2d63', 8);
    text(ctx, `STASH ${count(stash.coins)} · ${rankFor(stash.coins)}`, W - 288, H - 40, 10, GOLD, 'left', 262);
    text(ctx, goal ? `NEXT: ${goal.label} AT ${count(goal.at)} · BEST BAG ${count(stash.best)}` : `MAXED · BEST BAG ${count(stash.best)}`, W - 288, H - 24, 7, '#c9c2e6', 'left', 262, MONO);
    // The caption ladder at the top, and the milestone alert beside it.
    const fallenCaption = fallAge < 0.7 ? 'THE FLOOR WAS A RUG' : 'NGMI';
    const caption = crashed ? (secured ? 'PAPER HANDS. BAG INTACT.' : fallen || crashAge > 1 ? fallenCaption : 'IS THAT A RUG') : secured ? 'HOVERING. WATCHING THE DEGENS.' : running ? STAGES[stage]!.caption : station ? 'MIND THE GAP' : 'GM. RUN.';
    memeText(ctx, caption, W / 2, 46, 30, crashed && !secured ? '#ffb3c8' : '#fff', 'center', 450);
    if (running && !secured && alertAge < 4 && stage > 0) {
      const alert = STAGES[stage]!;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (4 - alertAge) * 2);
      const tint = stage > 4 ? PINK : CYAN;
      panel(ctx, 14, 82, 236, 50, 'rgba(10, 8, 26, 0.86)', tint, 6);
      ctx.fillStyle = tint;
      ctx.fillRect(15, 92, 3, 30);
      text(ctx, alert.alert, 28, 98, 11, tint, 'left', 214);
      text(ctx, alert.detail, 28, 118, 7.2, '#e9e6ff', 'left', 214, MONO);
      ctx.restore();
    }
    // The banked badge while hovering.
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(W / 2, 92);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, `${(secured.x100 / 100).toFixed(2)}× · ${count(banked ?? 0)} BANKED${secured.payout !== null ? ` · +${count(secured.payout)}` : ''}`, 0, 0, 22, LIME, 'center');
      ctx.restore();
    }
    // Toasts: what just happened on the rails.
    if (toast) {
      ctx.save();
      ctx.globalAlpha = clamp((TOAST_S - toast.age) * 2.5, 0, 1);
      ctx.translate(W / 2, 128);
      const k = 1 + 0.12 * toast.pop.x;
      ctx.scale(k, k);
      memeText(ctx, toast.line, 0, 0, 24, toast.colour, 'center', 620);
      ctx.restore();
    }
    if (unlocked) {
      ctx.save();
      ctx.globalAlpha = clamp((4 - unlocked.age) * 1.5, 0, 1);
      panel(ctx, W / 2 - 170, 154, 340, 40, 'rgba(10, 8, 26, 0.9)', GOLD, 8);
      text(ctx, `DRIP UNLOCKED · ${unlocked.label}`, W / 2, 168, 14, GOLD, 'center', 320);
      text(ctx, 'COSMETIC. WORTH NOTHING. LOOKS EXPENSIVE.', W / 2, 185, 7.5, '#e9e6ff', 'center', 320, MONO);
      ctx.restore();
    }
    // Controls: before the round, and for a moment while the bot drives.
    if (station || (running && bot && !secured && world.time < 7)) {
      const y = station ? 300 : 206;
      panel(ctx, W / 2 - 250, y - 22, 500, station ? 66 : 44, 'rgba(10, 8, 26, 0.86)', '#3b2d63', 8);
      if (station) {
        text(ctx, view.phase === 'betting' ? 'APE IN. THEN OUTRUN THE RUG.' : 'NEXT ROUND SOON', W / 2, y - 3, 17, GOLD, 'center', 470);
        text(ctx, '← → SWERVE · ↑ JUMP · ↓ SLIDE · OR SWIPE THE PICTURE · CASH OUT TO BANK THE BAG', W / 2, y + 20, 8, '#e9e6ff', 'center', 470, MONO);
        text(ctx, bot ? 'A COPY-TRADING BOT (MID) RUNS UNTIL YOU DO' : 'MANUAL MODE · NO REFUNDS', W / 2, y + 36, 7.5, '#c9c2e6', 'center', 470, MONO);
      } else {
        text(ctx, 'COPY-TRADING BOT DRIVING (MID)', W / 2, y - 6, 14, CYAN, 'center', 470);
        text(ctx, 'ARROWS, WASD OR A SWIPE TAKE THE WHEEL', W / 2, y + 14, 8, '#e9e6ff', 'center', 470, MONO);
      }
    }
    // The outcome, once the rails are gone.
    if (crashed && outcomePop.x > 0.02) {
      ctx.save();
      ctx.translate(W / 2, 250);
      ctx.rotate(-0.03);
      const k = clamp(outcomePop.x, 0, 1.3);
      ctx.scale(k, k);
      if (secured) {
        panel(ctx, -230, -62, 460, 124, 'rgba(10, 30, 20, 0.94)', LIME, 10, 2);
        memeText(ctx, 'BAILED', 0, -24, 48, LIME, 'center');
        text(ctx, `${(secured.x100 / 100).toFixed(2)}× · ${count(banked ?? 0)} BANKED · THE RAILS LEFT WITHOUT YOU`, 0, 20, 12, '#e9e6ff', 'center', 430, MONO);
        text(ctx, `RUGGED AT ${multiplier.toFixed(2)}× · EVERYONE ELSE WAS THE EXIT LIQUIDITY`, 0, 42, 9, '#c9c2e6', 'center', 430, MONO);
      } else {
        panel(ctx, -230, -62, 460, 124, 'rgba(30, 8, 20, 0.94)', PINK, 10, 2);
        memeText(ctx, 'RUGGED', 0, -24, 48, PINK, 'center');
        text(ctx, `${multiplier.toFixed(2)}× · THE RAILS WERE THE EXIT LIQUIDITY`, 0, 20, 12, '#ffe9f1', 'center', 430, MONO);
        text(ctx, view.stake === null ? 'UNREALIZED BAG: GONE · SPECTATING IS ALSO A LOSS' : 'UNREALIZED BAG: GONE · NGMI', 0, 42, 9, '#ffb3c8', 'center', 430, MONO);
      }
      ctx.restore();
    }
    if (running && !secured) text(ctx, `${Math.round(world.distance * 8)} M · ${Math.round(world.speed.x * 12)} KM/H`, 26, 150, 8, '#c9c2e6', 'left', 200, MONO);
  }

  return {
    draw,
    dispose() {
      input.dispose();
    },
  };
}
