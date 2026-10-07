import { endurance } from './endurance';
/**
 * Composes Up Only from the room state: the chart and the shiba stepped with the frame time and the
 * player's flaps (or the copy-trading bot's), the night drawn behind them, the FUD cloud, the jet, the coin
 * spray, then the HUD (the caption ladder, the round's multiplier, the bag, the stash with its rank, the
 * power-up timers), with the sound cued from what the chart reports. The round's phases come from the
 * shell: the crash flips every candle red and pulls the floor, and the cash-out lands the shiba on a jet.
 * The bag is a skill score with no value; nothing drawn or flapped here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { CYAN, GOLD, INK, LIME, MONO, PINK, count, memeText, panel, text } from './art';
import { type ChartView, drawChart, drawFud, rugProgress, vignette } from './chart';
import { type Input, createInput } from './input';
import { clamp, mix, mulberry32, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { drawJet, drawShiba } from './shiba';
import { BIRD_X, FLOOR, H, MAX_SPEED, POWER_S, W, type World, autopilot, createWorld, resetWorld, settleRunning, stepWorld } from './sky';
import { type Drip, type Stash, DRIP, dripFor, loadStash, nextGoal, rankFor, saveStash } from './stash';

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

/** The caption ladder: what the chart says at each multiplier. */
const STAGES = [
  { at: 1, caption: 'GM. FLAP.', alert: 'PRE-MARKET', detail: 'CHART LOADING. VIBES LOADED.' },
  { at: 1.25, caption: 'UP ONLY (TERMS APPLY)', alert: 'DISCLAIMER', detail: 'GRAVITY IS NOT FINANCIAL ADVICE.' },
  { at: 1.6, caption: 'FUD INCOMING', alert: 'A CLOUD ENTERED THE CHART', detail: 'IT HAS OPINIONS ABOUT THE DEV.' },
  { at: 2.2, caption: 'WICKS ARE JUST VIBES', alert: 'SUPPORT IS HOLDING', detail: 'SUPPORT IS ALSO A FLOOR. NOTED.' },
  { at: 3.2, caption: 'RESISTANCE IS FUTILE', alert: 'MOM: WHAT IS A SHIBA', detail: 'A DOG, MOM. WITH A HAT.' },
  { at: 4.8, caption: 'THE CHART LOOKS SUS', alert: 'DEV WALLET: STRETCHING', detail: 'PROBABLY A YOGA THING.' },
  { at: 7.5, caption: 'GRAVITY IS FUD', alert: 'THERAPIST: OUT OF OFFICE', detail: 'HE BOUGHT THE TOP TOO.' },
  { at: 12, caption: 'NASA CALLED. THEY ARE COPING.', alert: 'ORBIT ACHIEVED', detail: 'STILL POOR. STILL FLAPPING.' },
  { at: 20, caption: 'THE CANDLES ARE LOOKING AT YOU', alert: 'RUG DETECTOR', detail: 'BATTERY DEAD SINCE 2021.' },
  { at: 40, caption: 'THIS IS FINE', alert: 'REALITY: UNINSTALLED', detail: 'NGMI. BUT HIGH.' },
] as const;

/** The hit-stop on the frame the chart goes, and where the jet parks with the shiba, clear of the HUD. */
const FREEZE_S = 0.08;
const BERTH = { x: 700, y: 150 };
const TOAST_S = 1.7;

interface Particle { x: number; y: number; vx: number; vy: number; age: number; r: number; colour: string }
interface Toast { line: string; colour: string; age: number; pop: ReturnType<typeof spring> }

/** The stash and the steering are the page's, not a scene's: the shell recreates scenes. */
const stash: Stash = loadStash();
let playerFlaps = false;
let rounds = 0;
/**
 * The round in progress, so a scene the shell recreates mid-round (a tab hidden a moment) picks the same
 * chart and bag back up: the running time must have kept pace with the wall clock since it was left.
 */
let live: { world: World; elapsed: number; wall: number; banked: number | null } | null = null;

const mode = () => document.documentElement.dataset.mode ?? 'standalone';
const seedFor = (): number => (mode() === 'replay' ? 3 : (Date.now() ^ Math.imul(rounds + 1, 2654435761)) >>> 0);

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // Chiptune for a flap game; the crash is the sad trombone every chart deserves.
  const audio = pageAudio({ style: 'chiptune', bpm: 150, tempoRise: 0.3, crash: 'trombone', music: 0.55 });
  const canvas = document.querySelector('canvas')!;
  const input: Input = createInput(canvas, () => { playerFlaps = true; });
  let world = createWorld(seedFor());
  const jet = spring(0);
  const berth = spring(0);
  const bagShown = spring(0);
  const outcomePop = spring(0);
  const badge = spring(0);
  let previous: SceneView['phase'] | null = null;
  let last: number | null = null;
  let time = 0;
  let secured: { x100: number; payout: number | null } | null = null;
  let banked: number | null = null;
  let crashAge = -1;
  let rugX = Infinity;
  let fallen = false;
  let fallAge = 0;
  let fallY = 0;
  let stage = 0;
  let alertAge = 10;
  let shake = 0;
  let freeze = 0;
  let flash = 0;
  let spray: Particle[] = [];
  let toast: Toast | null = null;
  let unlocked: { label: string; age: number } | null = null;
  let coinClock = 0;
  let drip: ReadonlySet<Drip> = dripFor(stash.coins);
  /** Where the shiba was drawn, for the spray and the FUD. */
  let birdScreen = { x: BIRD_X, y: 300 };

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
    rugX = Infinity;
    fallen = false;
    fallAge = 0;
    stage = 0;
    alertAge = 10;
    freeze = 0;
    spray = [];
    toast = null;
    settleSpring(jet, 0);
    settleSpring(berth, 0);
    settleSpring(outcomePop, 0);
    settleSpring(badge, 0);
    settleSpring(bagShown, 0);
    live = { world, elapsed: 0, wall: Date.now(), banked: null };
  }

  /** Coins fly out of the bag: a clip, the FUD's strike, or the whole bag through the floor. */
  function spill(coins: number): void {
    if (reduced && coins > 6) coins = 6;
    const n = Math.min(coins, 26);
    const rand = mulberry32(Math.floor(time * 1000) + coins);
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
      const v = 200 + rand() * 360;
      spray.push({ x: birdScreen.x - 8 + (rand() - 0.5) * 24, y: birdScreen.y - 26, vx: Math.cos(a) * v - 80, vy: Math.sin(a) * v, age: 0, r: 5 + rand() * 4, colour: i % 4 === 0 ? GOLD : '#d38b3a' });
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

  /** The chart goes. A crash more than 1.5 s old is shown settled, so one missed while the tab was hidden is not replayed late. */
  function rugPull(view: SceneView, first: boolean): void {
    const quiet = first || view.crashAge > 1500;
    crashAge = quiet ? Math.max(3, view.crashAge / 1000) : 0;
    if (quiet) {
      rugX = BIRD_X - 80;
      for (const c of world.candles) c.rugged = 3;
      if (jet.x < 0.5 && !secured) {
        fallen = true;
        fallAge = 3;
        world.bag = 0;
      }
      settleSpring(outcomePop, 1);
      audio.crash('trombone', true);
      return;
    }
    shake = 0.5;
    if (!reduced) freeze = FREEZE_S;
    if (secured) {
      audio.crash('trombone', true);
      audio.fx('gasp', 0.8);
    } else audio.crash('trombone');
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
      // this page was already running comes back with its chart and bag when the clocks agree.
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
        settleSpring(jet, 1);
        settleSpring(berth, 1);
        settleSpring(badge, 1);
      } else {
        audio.cashout();
        audio.fx('engine', 1);
        badge.v = 12;
        say(banked ? `BAILED · ${count(banked)} BANKED` : 'BAILED · EMPTY BAG', LIME);
      }
    }
    if (crashed && previous !== 'crashed') rugPull(view, first);
    if (running && previous !== 'running' && !first) {
      alertAge = 0;
      world.bird.vy = -420;
      world.bird.flapAge = 0;
      audio.fx('whistle', 0.5);
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

    // ---- The chart -----------------------------------------------------------------------------------------
    const off = jet.x > 0.05 || fallen;
    const flaps = playerFlaps ? input.take() : autopilot(world, dt);
    stepWorld(world, flaps, { running: running && !fallen, multiplier, tension, off }, dt);
    const e = world.events;
    const b = world.bird;
    const speedK = world.speed.x / MAX_SPEED;
    if (running && !off) {
      coinClock -= dt;
      if (e.coins > 0 && coinClock <= 0) {
        coinClock = 0.07;
        audio.fx('coin', 0.55 + 0.45 * clamp(world.streak / 40, 0, 1));
      }
      if (e.flap) audio.fx('whoosh', 0.3);
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
      if (e.rocket) {
        audio.fx('engine', 0.8);
        say('ROCKET · 5 S OF UP ONLY', PINK);
      }
      if (e.smash) audio.fx('shatter', 0.5);
      if (e.expired) audio.fx('tick', 0.8);
      if (e.honey) {
        audio.fx('glug', 1);
        say('HONEYPOT · −20% BAG · SKILL ISSUE', PINK);
        shake = Math.max(shake, 0.15);
      }
      if (e.wick || e.floor || e.ceiling) {
        audio.fx('thud', 0.8);
        audio.fx('squeak', 0.7);
        shake = Math.max(shake, 0.3);
        if (!e.fud) say(e.wick ? 'WICKED · −25% BAG' : e.floor ? 'SUPPORT TESTED · −25% BAG' : 'RESISTANCE · −25% BAG', '#ffb3c8');
      }
      if (e.fud) {
        audio.fx('zap', 1);
        audio.fx('boom', 0.4);
        flash = reduced ? 0.15 : 0.5;
        say('STRUCK BY FUD · BAG GONE', PINK);
      }
      if (e.spill > 0) spill(e.spill);
    }
    audio.update(view.phase, secured ? 0.05 : tension);

    // ---- The jet and the fall -------------------------------------------------------------------------------
    stepSpring(jet, secured ? 1 : 0, 3, 0.9, dt);
    stepSpring(berth, secured && jet.x > 0.85 ? 1 : 0, 2.2, 0.9, dt);
    stepSpring(bagShown, world.bag, 12, 0.7, dt);
    if (crashed && crashAge >= 0) {
      crashAge += dt;
      const progress = rugProgress(crashAge);
      rugX = mix(W + 120, BIRD_X - 80, progress);
      // Each candle goes as the edge reaches it; whatever stands behind the shiba goes with the last of it.
      for (const c of world.candles) if (c.rugged < 0 && (c.x > rugX || progress >= 1)) c.rugged = 0;
      if (!fallen && rugX <= BIRD_X + 20 && jet.x < 0.5) {
        fallen = true;
        fallAge = 0;
        fallY = b.y;
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
    const chart: ChartView = { seconds: running ? view.elapsed / 1000 : 0, time, distance: world.distance, tension, rugX, dark, reduced };
    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    else if (!reduced && running && !off) ctx.translate(0, Math.sin(time * 90) * 1.2 * speedK * speedK);
    const fall = fallen ? clamp(fallAge / 1.2, 0, 1) : 0;
    // The jet comes in from the right under the shiba, then carries him to the berth.
    const jetIn = { x: mix(W + 220, BIRD_X + 6, jet.x), y: b.y + 34 };
    const jetAt = { x: mix(jetIn.x, BERTH.x, berth.x), y: mix(jetIn.y, BERTH.y, berth.x) + (reduced ? 0 : Math.sin(time * 1.8) * 6 * berth.x) };
    const birdAt = fallen ? { x: BIRD_X - 60 * fall, y: fallY + fallAge * fallAge * 900 } : secured && jet.x > 0.85 ? { x: jetAt.x - 4, y: jetAt.y - 34 } : { x: BIRD_X, y: b.y };
    birdScreen = birdAt;
    drawChart(ctx, world, chart, BIRD_X - world.distance, () => {
      if (secured && jet.x > 0.02) drawJet(ctx, { x: jetAt.x, y: jetAt.y, time, bank: -0.08 * (1 - berth.x) - 0.04 * berth.x, reduced });
      if (birdAt.y > H + 80) return;
      drawShiba(ctx, {
        x: birdAt.x, y: birdAt.y, tilt: secured ? 0 : b.tilt.x, flapAge: b.flapAge, stun: b.stun, bag: bagShown.x, drip, rocket: world.rocket > 0 && !off, magnet: world.magnet > 0 && !off,
        fall, struck: world.fud >= 0 ? clamp(1 - world.fud / 0.5, 0, 1) : 0, time, reduced,
      });
    });
    // The FUD, closing in from behind him as the heat rises.
    if (!fallen || fallAge < 1.5) drawFud(ctx, BIRD_X - 150 - (1 - world.heat) * 300, Math.min(b.y - 20, FLOOR - 120) + (fallen ? fallAge * fallAge * 600 : 0), world.heat, world.fud, time, reduced);
    for (const p of spray) {
      ctx.globalAlpha = clamp(1.6 - p.age * 1.2, 0, 1);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * (reduced ? 1 : Math.abs(Math.cos(p.age * 14 + p.r))), 0, 0, Math.PI * 2);
      ctx.fillStyle = p.colour;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    vignette(ctx, 0.3 * speedK + 0.25 * tension + 0.5 * dark);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 245, 180, ${flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    hud(ctx, view, multiplier, running, crashed);
  }

  // ---- The HUD -------------------------------------------------------------------------------------------

  function hud(ctx: CanvasRenderingContext2D, view: SceneView, multiplier: number, running: boolean, crashed: boolean): void {
    const bot = !playerFlaps;
    const station = view.phase === 'betting' || view.phase === 'waiting';
    // Title and the FUD's heat.
    panel(ctx, 14, 12, 224, 58, 'rgba(6, 10, 32, 0.74)', '#2b3f7a', 8);
    text(ctx, 'UP ONLY', 26, 30, 21, GOLD, 'left', 200);
    text(ctx, 'THE CHART IS THE LEVEL · TERMS APPLY', 26, 48, 7.5, '#c9d4ff', 'left', 200, MONO);
    ctx.fillStyle = '#1e2a55';
    ctx.fillRect(26, 58, 160, 5);
    ctx.fillStyle = world.heat > 0.7 ? PINK : '#ff8fb5';
    ctx.fillRect(26, 58, 160 * clamp(world.heat, 0, 1), 5);
    text(ctx, world.heat > 0.7 ? 'STRIKE' : 'FUD', 192, 60, 7, world.heat > 0.7 ? PINK : '#c9d4ff', 'left', 40, MONO);
    // The round's multiplier, from the room.
    const colour = crashed ? (secured ? LIME : PINK) : secured ? LIME : running ? '#fff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, W - 22, 44, 42, colour, 'right', 220);
    // The bag, this round's score, with the power-ups under it.
    panel(ctx, W - 226, 74, 212, 40, 'rgba(6, 10, 32, 0.74)', '#2b3f7a', 8);
    ctx.beginPath();
    ctx.arc(W - 204, 94, 11, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.strokeStyle = '#a67c00';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, '$', W - 204, 95, 13, '#6b4a00', 'center');
    text(ctx, `BAG ${count(bagShown.x)}`, W - 186, 88, 17, '#fff', 'left', 150);
    text(ctx, world.streak >= 5 ? `${world.streak} STREAK` : 'WORTH: NOTHING', W - 186, 105, 7.5, world.streak >= 5 ? GOLD : '#c9d4ff', 'left', 160, MONO);
    let barY = 122;
    for (const [left, total, label, tint] of [[world.magnet, POWER_S.magnet, 'INSIDER TIP', CYAN], [world.rocket, POWER_S.rocket, 'ROCKET · UP ONLY', PINK]] as const) {
      if (left <= 0) continue;
      panel(ctx, W - 226, barY, 212, 16, 'rgba(6, 10, 32, 0.74)', undefined, 4);
      ctx.fillStyle = tint;
      ctx.fillRect(W - 220, barY + 4, 200 * clamp(left / total, 0, 1), 8);
      text(ctx, label, W - 120, barY + 8, 7, INK, 'center', 180, MONO);
      barY += 20;
    }
    // The stash: every bag banked here, its rank and what it unlocks next. Recognition only.
    const goal = nextGoal(stash.coins);
    panel(ctx, W - 300, H - 52, 286, 40, 'rgba(6, 10, 32, 0.8)', '#2b3f7a', 8);
    text(ctx, `STASH ${count(stash.coins)} · ${rankFor(stash.coins)}`, W - 288, H - 40, 10, GOLD, 'left', 262);
    text(ctx, goal ? `NEXT: ${goal.label} AT ${count(goal.at)} · BEST BAG ${count(stash.best)}` : `MAXED · BEST BAG ${count(stash.best)}`, W - 288, H - 24, 7, '#c9d4ff', 'left', 262, MONO);
    // The caption ladder at the top, and the milestone alert beside it.
    const fallenCaption = fallAge < 0.7 ? 'THE FLOOR WAS A RUG' : 'NGMI';
    const act = endurance(view.elapsed / 1000).act;
    const lateCaption = ['', 'A FRONT IS CROSSING THE CHART', 'PURPLE SKY. STEADY WINGS.', 'GREEN AIR. SAME GRAVITY.', 'THE SATELLITE IS WATCHING'][act]!;
    const caption = crashed ? (secured ? 'PAPER HANDS. BAG INTACT.' : fallen || crashAge > 1 ? fallenCaption : 'WHY IS EVERYTHING RED') : secured ? 'ON THE JET. WATCHING THE DEGENS.' : running ? (act ? lateCaption : STAGES[stage]!.caption) : station ? 'WEN FLAP' : 'GM. FLAP.';
    memeText(ctx, caption, W / 2, 46, 30, crashed && !secured ? '#ffb3c8' : '#fff', 'center', 450);
    if (running && !secured && alertAge < 4 && stage > 0) {
      const alert = STAGES[stage]!;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (4 - alertAge) * 2);
      const tint = stage > 4 ? PINK : CYAN;
      panel(ctx, 14, 82, 236, 50, 'rgba(6, 10, 32, 0.86)', tint, 6);
      ctx.fillStyle = tint;
      ctx.fillRect(15, 92, 3, 30);
      text(ctx, alert.alert, 28, 98, 11, tint, 'left', 214);
      text(ctx, alert.detail, 28, 118, 7.2, '#eef3ff', 'left', 214, MONO);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(W / 2, 92);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, `${(secured.x100 / 100).toFixed(2)}× · ${count(banked ?? 0)} BANKED${secured.payout !== null ? ` · +${count(secured.payout)}` : ''}`, 0, 0, 22, LIME, 'center');
      ctx.restore();
    }
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
      panel(ctx, W / 2 - 170, 154, 340, 40, 'rgba(6, 10, 32, 0.9)', GOLD, 8);
      text(ctx, `DRIP UNLOCKED · ${unlocked.label}`, W / 2, 168, 14, GOLD, 'center', 320);
      text(ctx, 'COSMETIC. WORTH NOTHING. LOOKS EXPENSIVE.', W / 2, 185, 7.5, '#eef3ff', 'center', 320, MONO);
      ctx.restore();
    }
    // Controls: before the round, and for a moment while the bot flaps.
    if (station) {
      const y = station ? 250 : 206;
      panel(ctx, W / 2 - 250, y - 22, 500, station ? 66 : 44, 'rgba(6, 10, 32, 0.86)', '#2b3f7a', 8);
      if (station) {
        text(ctx, view.phase === 'betting' ? 'APE IN. THEN FLAP THROUGH THE CHART.' : 'NEXT ROUND SOON', W / 2, y - 3, 17, GOLD, 'center', 470);
        text(ctx, 'TAP THE PICTURE OR PRESS ↑ TO FLAP · SPACE BAILS · CASH OUT TO BANK THE BAG', W / 2, y + 20, 8, '#eef3ff', 'center', 470, MONO);
        text(ctx, bot ? 'A COPY-TRADING BOT (MID) FLAPS UNTIL YOU DO' : 'MANUAL MODE · NO REFUNDS', W / 2, y + 36, 7.5, '#c9d4ff', 'center', 470, MONO);
      } else {
        text(ctx, 'COPY-TRADING BOT FLAPPING (MID)', W / 2, y - 6, 14, CYAN, 'center', 470);
        text(ctx, 'A TAP OR ↑ TAKES OVER', W / 2, y + 14, 8, '#eef3ff', 'center', 470, MONO);
      }
    }
    if (running && bot && !secured) {
      panel(ctx, 16, 144, 176, 24, 'rgba(6,10,32,.9)', CYAN, 5);
      text(ctx, 'BOT · TAP TO FLAP', 104, 160, 10, CYAN, 'center', 164, MONO);
    }
    // The outcome, once the chart is gone.
    if (crashed && outcomePop.x > 0.02) {
      ctx.save();
      ctx.translate(W / 2, 250);
      ctx.rotate(-0.03);
      const k = clamp(outcomePop.x, 0, 1.3);
      ctx.scale(k, k);
      if (secured) {
        panel(ctx, -230, -62, 460, 124, 'rgba(6, 30, 20, 0.94)', LIME, 10, 2);
        memeText(ctx, 'BAILED', 0, -24, 48, LIME, 'center');
        text(ctx, `${(secured.x100 / 100).toFixed(2)}× · ${count(banked ?? 0)} BANKED · THE JET LEFT ON TIME`, 0, 20, 12, '#eef3ff', 'center', 430, MONO);
        text(ctx, `RUGGED AT ${multiplier.toFixed(2)}× · EVERYONE ELSE WAS THE EXIT LIQUIDITY`, 0, 42, 9, '#c9d4ff', 'center', 430, MONO);
      } else {
        panel(ctx, -230, -62, 460, 124, 'rgba(30, 8, 20, 0.94)', PINK, 10, 2);
        memeText(ctx, 'RUGGED', 0, -24, 48, PINK, 'center');
        text(ctx, `${multiplier.toFixed(2)}× · THE CHART WAS THE EXIT LIQUIDITY`, 0, 20, 12, '#ffe9f1', 'center', 430, MONO);
        text(ctx, view.stake === null ? 'UNREALIZED BAG: GONE · SPECTATING IS ALSO A LOSS' : 'UNREALIZED BAG: GONE · NGMI', 0, 42, 9, '#ffb3c8', 'center', 430, MONO);
      }
      ctx.restore();
    }
    if (running && !secured) text(ctx, `${Math.round(world.distance / 10)} M · ${Math.round(world.speed.x * 0.4)} KM/H`, 26, 172, 8, '#c9d4ff', 'left', 200, MONO);
  }

  return {
    draw,
    dispose() {
      input.dispose();
    },
  };
}
