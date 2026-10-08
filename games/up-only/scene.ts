import { endurance } from './endurance';
/**
 * Composes Up Only from the room state: the chart and the shiba stepped with the frame time and the
 * player's flaps (or the copy-trading bot's), the night drawn behind them, the FUD cloud, the jet, the coin
 * spray, then the HUD (the caption ladder, the round's multiplier, the bag, the stash with its rank, the
 * power-up timers), with the sound cued from what the chart reports. The round's phases come from the
 * shell: the crash flips every candle red and pulls the floor, and the cash-out lands the shiba on a jet.
 * Tension, the caption ladder and the fake-outs read the public multiplier only, never the crash point.
 * The bag is a skill score with no value; nothing drawn or flapped here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { CYAN, GOLD, INK, LIME, MONO, PINK, count, memeText, panel, text } from './art';
import { type ChartView, drawChart, drawFud, fmtX, rugProgress, vignette } from './chart';
import { type Input, createInput } from './input';
import { clamp, mix, mulberry32, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { drawJet, drawShiba } from './shiba';
import { BIRD_X, CEILING, FLOOR, GRAVITY, H, MAX_SPEED, PAD_Y, POWER_S, W, type World, autopilot, createWorld, resetWorld, settleRunning, stepWorld } from './sky';
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

/**
 * The caption ladder: what the chart says at each multiplier, a beat about every two seconds up to 3× (where
 * most rounds end) and further apart after. A major stage plays the milestone sting; the rest only notify.
 */
const STAGES: readonly { at: number; caption: string; alert: string; detail: string; major?: boolean }[] = [
  { at: 1, caption: 'GM. FLAP.', alert: 'PRE-MARKET', detail: 'CHART LOADING. VIBES LOADED.' },
  { at: 1.15, caption: 'WE ARE SO BACK', alert: 'CT: BULLISH', detail: 'SOURCE: A FROG WITH A PFP.' },
  { at: 1.3, caption: 'UP ONLY (TERMS APPLY)', alert: 'DISCLAIMER', detail: 'GRAVITY IS NOT FINANCIAL ADVICE.' },
  { at: 1.5, caption: 'FUD INCOMING', alert: 'A CLOUD ENTERED THE CHART', detail: 'IT HAS OPINIONS ABOUT THE DEV.', major: true },
  { at: 1.75, caption: 'THE GAPS ARE GETTING TIGHT', alert: 'LIQUIDITY: THIN', detail: 'THINNER THAN THE WHITEPAPER.' },
  { at: 2, caption: 'A 2× FROM A DOG IN A HAT', alert: 'MOM: WHAT IS A SHIBA', detail: 'A DOG, MOM. WITH A HAT.', major: true },
  { at: 2.6, caption: 'WICKS ARE JUST VIBES', alert: 'SUPPORT IS HOLDING', detail: 'SUPPORT IS ALSO A FLOOR. NOTED.', major: true },
  { at: 3.2, caption: 'RESISTANCE IS FUTILE', alert: 'JEETS: LEAVING', detail: 'MORE CHART FOR THE REST OF US.' },
  { at: 4.8, caption: 'THE CHART LOOKS SUS', alert: 'DEV WALLET: STRETCHING', detail: 'PROBABLY A YOGA THING.', major: true },
  { at: 7.5, caption: 'GRAVITY IS FUD', alert: 'THERAPIST: OUT OF OFFICE', detail: 'HE BOUGHT THE TOP TOO.' },
  { at: 12, caption: 'NASA CALLED. THEY ARE COPING.', alert: 'ORBIT ACHIEVED', detail: 'STILL POOR. STILL FLAPPING.', major: true },
  { at: 20, caption: 'THE CANDLES ARE LOOKING AT YOU', alert: 'RUG DETECTOR', detail: 'BATTERY DEAD SINCE 2021.' },
  { at: 40, caption: 'THIS IS FINE', alert: 'REALITY: UNINSTALLED', detail: 'NGMI. BUT HIGH.', major: true },
  { at: 100, caption: '100×. CT IS SCREENSHOTTING', alert: 'KOL: "CALLED IT"', detail: 'HE DID NOT CALL IT.' },
  { at: 1000, caption: 'THE MOON IS GETTING CLOSER', alert: 'MOON: CONCERNED', detail: 'IT DID NOT CONSENT TO THIS.', major: true },
  { at: 10000, caption: 'FEW UNDERSTAND', alert: 'NOBODY UNDERSTANDS', detail: 'INCLUDING THE DOG.' },
];
const stageFor = (multiplier: number): number => Math.max(0, STAGES.filter((s) => multiplier >= s.at).length - 1);

/** What the jet says while the chart runs on without him, by how far it has gone past his exit. */
const REGRET = [
  { at: 1, line: 'PAPER HANDS. BAG SECURED.' },
  { at: 1.2, line: 'IT KEPT PUMPING. HE IS FINE.' },
  { at: 1.6, line: 'SOLD EARLY? NEVER HEARD OF IT.' },
  { at: 2.5, line: 'NOT CHECKING THE CHART. (CHECKING)' },
  { at: 5, line: 'MUTED THE CHART. PROFIT IS PROFIT.' },
] as const;

/** The hit-stop on the frame the chart goes, the punch-in that holds on him, and where the jet parks, clear of the HUD. */
const FREEZE_S = 0.15;
const PUNCH = 0.1;
const BERTH = { x: 700, y: 150 };
const TOAST_S = 1.7;
/** Multipliers where the rug's edge peeks in and backs off: a scare on the public curve, never the crash point. */
const FAKES = [2.25, 3.9, 9, 30];
const FAKE_S = 1.05;
/** Where a fake-out's edge is: in fast, a held breath, then a slow retreat. */
const fakeEdge = (age: number): number => W - 150 * (age < 0.22 ? 1 - (1 - age / 0.22) ** 2 : 1 - smoothstep(0.45, FAKE_S, age));
/** The multiplier as the HUD shows it: to the hundredth, and compact once it no longer fits. */
const shown = (x: number): string => (x < 1e6 ? `${x.toFixed(2)}×` : fmtX(x));

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
  /**
   * Squash (+) and stretch (−) of the takeoff, the landing on the jet and the smug stretch when it rugs: kicked
   * with velocity, so each peaks about 40 ms later (a kick of 47 reaches the full 1.15/0.85) and never pops.
   */
  const squash = spring(0);
  let previous: SceneView['phase'] | null = null;
  let last: number | null = null;
  let time = 0;
  let secured: { x100: number; payout: number | null } | null = null;
  let banked: number | null = null;
  let crashAge = -1;
  let rugX = Infinity;
  /** Where the rug's edge sweeps in from: off the right edge, or where a fake-out's edge already stood. */
  let rugFrom = W + 120;
  let fallen = false;
  let fallAge = 0;
  let fallY = 0;
  let fallV = 0;
  /** The height he holds with his own flaps while the jet comes for him. */
  let hoverY = 300;
  let landed = false;
  /** Seconds since the rug reached the launchpad, or -1. */
  let padBreak = -1;
  let punchAge = -1;
  let fakeAge = -1;
  let fakeNext = 0;
  let fakeSaid = false;
  let shock = 0;
  let pulse = 0;
  let idle = 1;
  let ghost = 0;
  let wipe = 0;
  let fudY = 300;
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
    settleSpring(squash, 0);
    fallV = 0;
    landed = false;
    padBreak = -1;
    punchAge = -1;
    fakeAge = -1;
    fakeNext = 0;
    shock = 0;
    pulse = 0;
    fudY = 300;
    // A new chart fades up out of the night rather than cutting from the last one's wreck.
    wipe = previous === null ? 0 : 1;
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
    // A crash mid fake-out: the dashed edge that was already in turns solid and keeps coming.
    rugFrom = fakeAge >= 0 ? fakeEdge(fakeAge) : W + 120;
    fakeAge = -1;
    if (quiet) {
      rugX = BIRD_X - 80;
      padBreak = 3;
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
    // Impact: a hit-stop and a punch-in held on him, then the edge sweeps in. He startles; a jeet stretches, smug.
    shake = 0.5;
    if (!reduced) {
      freeze = FREEZE_S;
      punchAge = 0;
    }
    if (secured) {
      squash.v = -33;
      audio.crash('trombone', true);
      audio.fx('gasp', 0.8);
    } else {
      shock = 1;
      toast = null;
      audio.crash('trombone');
    }
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
    if (punchAge >= 0) punchAge += real;
    const first = previous === null;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 1.5× is 0.33, 2× 0.5, 3× 0.67, 10× 0.9: the first 14 s, where most rounds end, sweep two thirds of it.
    const tension = 1 - 1 / multiplier;

    // ---- The round's phases -----------------------------------------------------------------------------
    // Betting, or a room waiting for its next round, starts the next chart; the jet and the wreck go with the last.
    const station = view.phase === 'betting' || view.phase === 'waiting';
    if (station && previous !== 'betting' && previous !== 'waiting') newRound();
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
      stage = stageFor(multiplier);
      fakeNext = FAKES.filter((f) => multiplier >= f).length;
    }
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      hoverY = clamp(world.bird.y, CEILING + 80, FLOOR - 90);
      if (banked === null) bank();
      if (first || crashed) {
        settleSpring(jet, 1);
        settleSpring(berth, 1);
        settleSpring(badge, 1);
        landed = true;
      } else {
        audio.cashout();
        audio.fx('engine', 1);
        badge.v = 12;
        say('JEETED ONTO EXIT LIQUIDITY AIR', LIME);
      }
    }
    if (crashed && previous !== 'crashed') rugPull(view, first);
    if (running && previous !== 'running' && !first) {
      // Takeoff: a squash off the pad that springs into a stretch as he climbs.
      alertAge = 0;
      world.bird.vy = -420;
      world.bird.flapAge = 0;
      squash.v = 47;
      audio.fx('whistle', 0.5);
    }
    previous = view.phase;
    if (live && live.world === world) {
      live.elapsed = view.elapsed;
      live.wall = Date.now();
    }

    // ---- The caption ladder --------------------------------------------------------------------------------
    alertAge += dt;
    const nextStage = stageFor(multiplier);
    if (running && nextStage > stage) {
      stage = nextStage;
      alertAge = 0;
      if (!secured) {
        if (STAGES[stage]!.major) audio.milestone(STAGES.slice(0, stage + 1).filter((s) => s.major).length);
        audio.fx('notify', 0.45);
      }
    }
    // ---- The fake-outs: the rug's edge peeks in at fixed multipliers, then backs off --------------------------
    if (running && fakeNext < FAKES.length && multiplier >= FAKES[fakeNext]!) {
      fakeNext += 1;
      fakeAge = 0;
      fakeSaid = false;
      if (!secured) {
        shock = 1;
        shake = Math.max(shake, 0.18);
        audio.fx('creak', 0.9);
        audio.fx('beep', 0.35);
      }
    }
    if (fakeAge >= 0) {
      fakeAge += dt;
      // Said only once the edge is backing off, when it is true.
      if (!fakeSaid && fakeAge > 0.5 && !secured) {
        fakeSaid = true;
        say('FALSE ALARM · THIS TIME', '#ffb3c8');
      }
      if (fakeAge > FAKE_S || !running) fakeAge = -1;
    }
    shock = Math.max(0, shock - dt * 1.4);

    // ---- The chart -----------------------------------------------------------------------------------------
    const b = world.bird;
    const off = secured !== null || crashed || fallen;
    // Off the chart he keeps flying once he has left the pad: through the moments before the floor goes, and
    // while the jet comes for him. A bust before takeoff leaves him sitting on the pad.
    const glide = off && !fallen && (world.distance > 1 || b.y < PAD_Y - 0.5);
    const flaps = playerFlaps ? input.take() : autopilot(world, dt);
    stepWorld(world, secured ? 0 : flaps, { running: running && !fallen, multiplier, seconds: view.elapsed / 1000, off, glide, hover: secured ? hoverY : undefined }, dt);
    const e = world.events;
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
        say('ROCKET · 5 S OF CANDLE IMMUNITY (NOT RUG)', PINK);
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
    // A heartbeat under the music that quickens with the multiplier, until he is out.
    pulse -= dt;
    if (running && !secured && tension > 0.15 && pulse <= 0) {
      pulse = mix(1.4, 0.35, tension);
      audio.fx('heartbeat', 0.25 + 0.35 * tension);
    }
    audio.update(view.phase, secured ? 0.05 : tension);

    // ---- The jet and the fall -------------------------------------------------------------------------------
    stepSpring(jet, secured ? 1 : 0, 4, 0.9, dt);
    stepSpring(berth, secured && jet.x > 0.995 ? 1 : 0, 2.2, 0.9, dt);
    stepSpring(bagShown, world.bag, 12, 0.7, dt);
    if (crashed && crashAge >= 0) {
      crashAge += dt;
      const progress = rugProgress(crashAge);
      rugX = mix(rugFrom, BIRD_X - 80, progress);
      // Each candle goes as the edge reaches it; whatever stands behind the shiba (the launchpad too) goes with the last of it.
      for (const c of world.candles) if (c.rugged < 0 && (c.x > rugX || progress >= 1)) c.rugged = 0;
      if (padBreak < 0 && (rugX <= BIRD_X - world.distance + 120 || progress >= 1)) padBreak = 0;
      if (!fallen && !secured && rugX <= BIRD_X + 20 && jet.x < 0.5) {
        // He drops from where he is, carrying his climb or his dive into the fall.
        fallen = true;
        fallAge = 0;
        fallY = b.y;
        fallV = clamp(b.vy, -260, 400);
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
    if (padBreak >= 0) padBreak += dt;
    const boarding = secured ? smoothstep(0.85, 1, jet.x) : 0;
    if (secured && !landed && boarding > 0.9) {
      landed = true;
      squash.v = 38;
    }
    stepSpring(squash, 0, 30, 0.35, dt);
    // Rest on the pad and the jet, a paper trader's ghost while spectating: eased, so no phase change pops.
    const ease = first ? 1 : 1 - Math.exp(-8 * dt);
    idle += ((secured ? boarding : running || crashed ? 0 : 1) - idle) * ease;
    ghost += ((view.stake === null && mode() !== 'replay' && (running || crashed) ? 1 : 0) - ghost) * ease;
    if (wipe > 0) wipe = Math.max(0, wipe - real / 0.4);
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
    const fakeX = fakeAge >= 0 ? fakeEdge(fakeAge) : Infinity;
    const inRound = running || crashed;
    const chart: ChartView = {
      seconds: inRound ? view.elapsed / 1000 : 0, time, distance: world.distance, tension, rugX: Number.isFinite(rugX) ? rugX : fakeX, dark, reduced,
      multiplier: inRound ? multiplier : 1, padBreak, fake: !Number.isFinite(rugX) && fakeAge >= 0,
    };
    ctx.save();
    if (punchAge >= 0 && punchAge < 0.7) {
      const z = 1 + PUNCH * smoothstep(0, 0.05, punchAge) * (1 - smoothstep(0.35, 0.7, punchAge));
      ctx.translate(birdScreen.x, birdScreen.y);
      ctx.scale(z, z);
      ctx.translate(-birdScreen.x, -birdScreen.y);
    }
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    else if (!reduced && running && !off) ctx.translate(0, Math.sin(time * 90) * 1.2 * speedK * speedK);
    const fall = fallen ? clamp(fallAge / 1.2, 0, 1) : 0;
    // The jet comes in from the right under the height he is holding, then carries him to the berth.
    const jetIn = { x: mix(W + 220, BIRD_X + 4, clamp(jet.x, 0, 1)), y: hoverY + 34 };
    const jetAt = { x: mix(jetIn.x, BERTH.x, berth.x), y: mix(jetIn.y, BERTH.y, berth.x) + (reduced ? 0 : Math.sin(time * 1.8) * 6 * berth.x) };
    const birdAt = fallen ? { x: BIRD_X - 60 * fall, y: fallY + fallV * fallAge + 0.5 * GRAVITY * fallAge * fallAge } : { x: mix(BIRD_X, jetAt.x - 4, boarding), y: mix(b.y, jetAt.y - 34, boarding) };
    birdScreen = birdAt;
    drawChart(ctx, world, chart, BIRD_X - world.distance, () => {
      if (secured && jet.x > 0.02) drawJet(ctx, { x: jetAt.x, y: jetAt.y, time, bank: -0.08 * (1 - berth.x) - 0.04 * berth.x, reduced });
      if (birdAt.y > H + 80) return;
      // A spectator flies a paper trader: a see-through shiba with a label, so the stake reads at a glance.
      ctx.globalAlpha = 1 - 0.4 * ghost;
      drawShiba(ctx, {
        x: birdAt.x, y: birdAt.y, tilt: b.tilt.x * (1 - boarding), flapAge: b.flapAge, wingMotion: { beat: b.wing.x, lag: b.wingLag.x, feather: b.feather.x }, perched: boarding, idle, squash: squash.x, shock,
        stun: b.stun, bag: bagShown.x, drip, rocket: world.rocket > 0 && !off, magnet: world.magnet > 0 && !off, fall, struck: world.fud >= 0 ? clamp(1 - world.fud / 0.5, 0, 1) : 0, time, reduced,
      });
      ctx.globalAlpha = 1;
      if (ghost * (1 - fall) > 0.05) text(ctx, 'PAPER TRADING', birdAt.x + 6, birdAt.y + 48, 9, `rgba(95, 242, 230, ${0.9 * ghost * (1 - fall)})`, 'center', 160, MONO);
    });
    // The FUD: it peeks in behind him from about 1.2×, is in the picture by 1.5× and halfway to him by 2×,
    // then swells to 4×; a clip brings it closer and only a clip's heat can strike. It leaves a jeet alone.
    const calm = inRound ? (secured ? 1 - clamp(jet.x, 0, 1) : 1) : 0;
    const fud = Math.max(world.heat, 0.5 * smoothstep(0.15, 0.5, tension) * calm);
    fudY += (clamp(b.y - 20, 214, FLOOR - 120) - fudY) * (first ? 1 : 1 - Math.exp(-4 * dt));
    if (!fallen || fallAge < 1.5) drawFud(ctx, mix(-40, 100, fud), fudY + (fallen ? fallAge * fallAge * 600 : 0), fud, world.fud, time, reduced, 0.8 + 0.5 * smoothstep(0.15, 0.75, tension) * calm);
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
    if (wipe > 0) {
      ctx.fillStyle = `rgba(5, 8, 28, ${wipe * wipe})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---- The HUD -------------------------------------------------------------------------------------------

  function hud(ctx: CanvasRenderingContext2D, view: SceneView, multiplier: number, running: boolean, crashed: boolean): void {
    const bot = !playerFlaps;
    const station = view.phase === 'betting' || view.phase === 'waiting';
    const spectator = view.stake === null && mode() !== 'replay';
    const instant = crashed && view.currentX100 <= 100;
    // Title and the FUD's heat.
    panel(ctx, 14, 12, 224, 58, 'rgba(6, 10, 32, 0.74)', '#2b3f7a', 8);
    text(ctx, 'UP ONLY', 26, 30, 21, GOLD, 'left', 200);
    text(ctx, 'CANDLES ARE THE LEVEL · NOT THE PRICE', 26, 48, 7.5, '#c9d4ff', 'left', 200, MONO);
    ctx.fillStyle = '#1e2a55';
    ctx.fillRect(26, 58, 160, 5);
    ctx.fillStyle = world.heat > 0.7 ? PINK : '#ff8fb5';
    ctx.fillRect(26, 58, 160 * clamp(world.heat, 0, 1), 5);
    text(ctx, world.heat > 0.7 ? 'STRIKE' : 'FUD', 192, 60, 7, world.heat > 0.7 ? PINK : '#c9d4ff', 'left', 40, MONO);
    // The round's multiplier, from the room.
    const colour = crashed ? (secured ? LIME : PINK) : secured ? LIME : running ? '#fff' : '#ffe08a';
    memeText(ctx, shown(multiplier), W - 22, 44, 42, colour, 'right', 220);
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
    // Space is the shell's and cashes out, never flaps: said where a staked player looks while the round runs.
    if (running && view.stake !== null && !secured) {
      panel(ctx, W - 226, 118, 212, 22, 'rgba(6, 10, 32, 0.86)', LIME, 5);
      text(ctx, 'SPACE = CASH OUT · ↑/TAP = FLAP', W - 120, 129.5, 12, LIME, 'center', 200, MONO);
      barY = 146;
    }
    for (const [left, total, label, tint] of [[world.magnet, POWER_S.magnet, 'INSIDER TIP', CYAN], [world.rocket, POWER_S.rocket, 'ROCKET · CANDLE IMMUNITY', PINK]] as const) {
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
    const fallenCaption = fallAge < 0.7 ? (instant ? 'RUGGED ON THE LAUNCHPAD' : 'THE FLOOR WAS A RUG') : spectator ? 'GLAD IT WAS PAPER' : 'NGMI';
    const act = endurance(view.elapsed / 1000).act;
    const lateCaption = ['', 'A FRONT IS CROSSING THE CHART', 'PURPLE SKY. STEADY WINGS.', 'GREEN AIR. SAME GRAVITY.', 'THE SATELLITE IS WATCHING'][act]!;
    // A jeet's regret ladder: how far the chart has run past his exit, said with a straight face.
    // The first line holds even while the shown number still trails an exit the room accepted a moment ahead of it.
    const regret = secured ? REGRET.filter((r, i) => !i || multiplier >= (secured!.x100 / 100) * r.at).pop()!.line : '';
    // A fresh milestone keeps the caption for its four seconds even once the endurance acts have begun.
    const ladder = act && alertAge > 4 ? lateCaption : STAGES[stage]!.caption;
    const caption = crashed ? (secured ? 'PAPER HANDS. DODGED THE RUG.' : fallen || crashAge > 1 ? fallenCaption : instant ? 'RUGGED ON THE LAUNCHPAD' : 'WHY IS EVERYTHING RED') : secured ? regret : running ? ladder : station ? 'WEN FLAP' : 'GM. FLAP.';
    memeText(ctx, caption, W / 2, 46, 30, crashed && !secured ? '#ffb3c8' : secured ? LIME : '#fff', 'center', 450);
    if (running && !secured && alertAge < 4 && stage > 0) {
      const alert = STAGES[stage]!;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (4 - alertAge) * 2);
      const tint = alert.at >= 3.2 ? PINK : CYAN;
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
      memeText(ctx, `${shown(secured.x100 / 100)} · ${count(banked ?? 0)} BANKED${secured.payout !== null ? ` · +${count(secured.payout)}` : ''}`, 0, 0, 22, LIME, 'center');
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
    // Controls before the round: the flap keys, what Space does instead, and what skill is worth.
    if (station) {
      const y = 246;
      panel(ctx, W / 2 - 260, y - 24, 520, 94, 'rgba(6, 10, 32, 0.86)', '#2b3f7a', 8);
      text(ctx, view.phase === 'betting' ? 'APE IN. THEN FLAP THROUGH THE CHART.' : 'NEXT ROUND SOON', W / 2, y - 5, 17, GOLD, 'center', 490);
      text(ctx, 'FLAP: TAP THE PICTURE · ↑ · W · X · ENTER', W / 2, y + 17, 10, '#eef3ff', 'center', 490, MONO);
      text(ctx, 'SPACE NEVER FLAPS · MID-ROUND IT CASHES OUT', W / 2, y + 33, 10, LIME, 'center', 490, MONO);
      text(ctx, bot ? 'A COPY-TRADING BOT (MID) FLAPS UNTIL YOU DO' : 'MANUAL MODE · NO REFUNDS', W / 2, y + 50, 7.5, '#c9d4ff', 'center', 490, MONO);
      text(ctx, 'COINS ARE ARCADE POINTS · SKILL NEVER MOVES THE RUG OR THE CREDITS', W / 2, y + 62, 7.5, '#c9d4ff', 'center', 490, MONO);
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
        memeText(ctx, 'DODGED', 0, -24, 48, LIME, 'center');
        text(ctx, `JEETED AT ${shown(secured.x100 / 100)} · ${count(banked ?? 0)} BANKED · PAPER HANDS, NOT REKT`, 0, 20, 12, '#eef3ff', 'center', 430, MONO);
        text(ctx, `RUGGED AT ${shown(multiplier)} · EVERYONE ELSE WAS THE EXIT LIQUIDITY`, 0, 42, 9, '#c9d4ff', 'center', 430, MONO);
      } else {
        panel(ctx, -230, -62, 460, 124, 'rgba(30, 8, 20, 0.94)', PINK, 10, 2);
        memeText(ctx, 'RUGGED', 0, -24, 48, PINK, 'center');
        text(ctx, instant ? '1.00× · RUGGED BEFORE TAKEOFF' : `${shown(multiplier)} · THE CHART WAS THE EXIT LIQUIDITY`, 0, 20, 12, '#ffe9f1', 'center', 430, MONO);
        text(ctx, spectator ? 'PAPER TRADER · NO STAKE, NO PAIN · STILL NGMI' : 'UNREALIZED BAG: GONE · NGMI', 0, 42, 9, '#ffb3c8', 'center', 430, MONO);
      }
      ctx.restore();
    }
    if (running && !secured) text(ctx, `${Math.round(world.distance / 10)} M · ${Math.round(world.speed.x * 0.4)} KM/H`, 26, 180, 8, '#c9d4ff', 'left', 200, MONO);
  }

  return {
    draw,
    dispose() {
      input.dispose();
    },
  };
}
