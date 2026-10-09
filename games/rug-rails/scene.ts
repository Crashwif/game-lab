import { endurance } from './endurance';
/**
 * Composes Rug Rails from the room state: the course and the frog stepped with the frame time and the
 * player's commands (or the copy-trading bot's), the tunnel drawn around them, the dev at the end of the line,
 * the Taxman, the coin spray, then the HUD (the caption ladder, the round's multiplier, the bag, the stash with
 * its rank, the power-up timers, the controls), with the sound cued from what the course reports. The round's
 * phases come from the shell: the crash rolls the rails up like a carpet and the cash-out lifts the frog off them
 * on a hoverboard. The bag is a skill score with no value; nothing drawn or steered here changes the committed
 * outcome, and every escalation is keyed to the displayed multiplier or the running time, never the crash point.
 */
import { pageAudio } from './audio';
import { CYAN, GOLD, INK, LIME, MONO, PINK, count, memeText, panel, text } from './art';
import { MAX_SPEED, POWER_S, RUNNER_Z, FAR, type World, autopilot, createWorld, resetWorld, settleRunning } from './course';
import { stepWorld } from './course';
import { type Input, createInput } from './input';
import { clamp, mix, mulberry32, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { drawFrog, drawShadow, drawTaxman } from './runner';
import { type Drip, type Stash, DRIP, dripFor, loadStash, nextGoal, rankFor, saveStash } from './stash';
import { type Camera, type TrackView, H, W, drawWorld, floorBump, project, vignette } from './track';

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

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose(): void;
}

/** The caption ladder: what the tunnel says at each multiplier. A beat every two seconds or so up to 3×. */
const STAGES = [
  { at: 1, caption: 'GM. RUN.', alert: 'TRENCHES LINE', detail: 'NEXT STOP: NOWHERE.' },
  { at: 1.15, caption: 'DYOR IS FOR NERDS', alert: 'RUG DETECTOR', detail: 'BATTERY DEAD SINCE 2021.' },
  { at: 1.3, caption: 'WHO IS THAT AT THE END', alert: 'DEV SPOTTED DOWN THE LINE', detail: 'HOLDING THE RAILS. PROBABLY NOTHING.' },
  { at: 1.5, caption: 'TAXMAN ON YOUR HEELS', alert: 'AUDIT DEPT. IN THE TUNNEL', detail: 'HE WANTS 37% OF YOUR VIBES.' },
  { at: 1.75, caption: 'DIAMOND KNEES', alert: 'MOM: ARE YOU GAMBLING', detail: 'NO MOM. THE DODGING IS SKILL. THE RUG IS NOT.' },
  { at: 2, caption: 'THE RAILS FEEL LOOSE', alert: 'DEV IS STRETCHING', detail: 'HANDS ON THE RUG. FOR WARMTH.' },
  { at: 2.4, caption: 'GENERATIONAL SPRINT', alert: 'WHALE ON THE TRACKS', detail: 'IT IS NOT MOVING. YOU ARE.' },
  { at: 2.8, caption: 'HE IS PULLING. HE IS PULLING.', alert: 'DEV WALLET: AWAKE', detail: 'PROBABLY NOTHING. SURELY.' },
  { at: 3.3, caption: 'NUMBER GO UP. KNEES GO OUT.', alert: 'LIQUIDITY: LOCKED', detail: 'THE LOCK IS A STICKER.' },
  { at: 4.8, caption: 'STILL HERE? SEEK HELP', alert: 'THERAPIST: OUT OF OFFICE', detail: 'SHE BOUGHT THE TOP TOO.' },
  { at: 7.5, caption: 'THE DEV IS SWEATING', alert: 'DEV: TYPING...', detail: 'HE HAS BEEN TYPING FOR A WHILE.' },
  { at: 12, caption: 'PHYSICS HAS LOGGED ON', alert: 'SPEED ILLEGAL IN 14 STATES', detail: 'ALL 14 ARE COPING.' },
  { at: 20, caption: 'YOUR BAG HAS ITS OWN GRAVITY', alert: 'NASA WANTS A WORD', detail: 'THEY ALSO WANT A BAG.' },
  { at: 40, caption: 'THIS IS FINE', alert: 'REALITY: UNINSTALLED', detail: 'NGMI. BUT FAST.' },
  { at: 100, caption: 'TRIPLE DIGITS. SAME FROG.', alert: 'SEC: LOOKING INTO IT', detail: 'THEY ARE NOT LOOKING INTO IT.' },
  { at: 1000, caption: 'FOUR DIGITS. ZERO SLEEP.', alert: 'DEV: ARMS GETTING TIRED', detail: 'THAT RUG IS HEAVY BY NOW.' },
  { at: 10000, caption: 'THE TUNNEL IS THE FRIENDS WE MADE', alert: 'MOM: STILL ASKING', detail: 'STILL THE DODGING. STILL NOT THE RUG.' },
] as const;
/** The first stage whose alert turns pink: 2×. */
const HOT_STAGE = 5;

/** The hit-stop on the frame the rails go, the punch-in that holds through it, and how long the roll takes to reach the frog. */
const FREEZE_S = 0.15;
const PUNCH = 0.1;
const ROLL_S = 0.75;
/** The frog's berth on the hoverboard: off the rails, to the right, clear of the HUD. */
const HOVER_X = 1.78;
const HOVER_H = 0.85;
const TOAST_S = 1.7;
/** The fade through black from a finished round to the next station. */
const SWAP_S = 0.36;
/** The dev shows up at the end of the line here, and his tugs send a ripple down the rails this fast. */
const DEV_AT = 1.3;
const WAVE_V = 30;

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
/** A live viewer with no stake this round runs a paper frog; a recorded round is nobody's paper. */
const paperRun = (view: SceneView): boolean => view.stake === null && mode() !== 'replay';
/** Eases toward a target at `rate` per second, the same at any frame rate. */
const ease = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * (1 - Math.exp(-rate * dt));

export function createScene(): Scene {
  // Drum and bass for a sprint; the crash is the rails going with a boom.
  const audio = pageAudio({ style: 'dnb', bpm: 168, tempoRise: 0.25, crash: 'boom', music: 0.6 });
  const canvas = document.querySelector('canvas')!;
  const input: Input = createInput(canvas, () => { playerSteers = true; });
  // The same test the shell uses before it names Space: a keyboard and a fine pointer. Touch gets swipe copy.
  const keyboard = typeof matchMedia === 'function' ? matchMedia('(hover: hover) and (pointer: fine)') : null;
  let world = createWorld(seedFor());
  const cam: Camera = { x: 0 };
  const camX = spring(0);
  const hover = spring(0);
  const slideK = spring(0);
  const bagShown = spring(0);
  const outcomePop = spring(0);
  const badge = spring(0);
  const taxX = spring(W / 2 - 130);
  let previous: SceneView['phase'] | null = null;
  let last: number | null = null;
  let time = 0;
  let secured: { x100: number; payout: number | null } | null = null;
  let banked: number | null = null;
  /** A spectator's half of the bag, stashed as the rails go; null until then. */
  let paper: number | null = null;
  let bust = 1;
  let crashAge = -1;
  let rugZ = Infinity;
  let fallen = false;
  let fallAge = 0;
  /** How high the frog was (a roof, mid-jump) when the floor went: he falls from there. */
  let fallH = 0;
  let stage = 0;
  let alertAge = 10;
  let shake = 0;
  let freeze = 0;
  let punch = -1;
  let flash = 0;
  let swap = -1;
  let pending = false;
  /** The finished round as it stood at the crash: its HUD holds until the fade to the next station is darkest. */
  let ended: SceneView | null = null;
  let spray: Particle[] = [];
  let toast: Toast | null = null;
  let unlocked: { label: string; age: number } | null = null;
  let coinClock = 0;
  let stepClock = 0;
  let frogScreen = { x: W / 2, y: 460, k: 1 };
  let drip: ReadonlySet<Drip> = dripFor(stash.coins);
  // The dev at the end of the line: presence, the tug clock (an integrated phase) and the ripple of the last tug.
  let dev = 0;
  let tugClock = 0.55;
  let tugAge = 10;
  let tugs = 0;
  let waveAmp = 0;
  // The Taxman's drawn heat (the real one, or the chase the round's number sets), and his run phase.
  let taxHeat = 0;
  let taxPhase = 0;
  let pulse = 0;
  let ghost = 0;
  let panelK = 1;
  let panelTitle = 'GM. RUN.';

  function say(line: string, colour = '#fff'): void {
    toast = { line, colour, age: 0, pop: spring(0) };
    toast.pop.v = 9;
  }

  function newRound(): void {
    rounds += 1;
    resetWorld(world, seedFor());
    ended = null;
    secured = null;
    banked = null;
    paper = null;
    bust = 1;
    crashAge = -1;
    rugZ = Infinity;
    fallen = false;
    fallAge = 0;
    stage = 0;
    alertAge = 10;
    freeze = 0;
    punch = -1;
    spray = [];
    toast = null;
    dev = 0;
    tugClock = 0.55;
    tugAge = 10;
    tugs = 0;
    taxHeat = 0;
    ghost = 0;
    settleSpring(hover, 0);
    settleSpring(slideK, 0);
    settleSpring(outcomePop, 0);
    settleSpring(badge, 0);
    settleSpring(bagShown, 0);
    live = { world, elapsed: 0, wall: Date.now(), banked: null };
  }

  /** Coins fly out of the bag: a spill, the Taxman's grab, or the whole bag into the void. */
  function spill(coins: number): void {
    const n = Math.min(coins, 26);
    const rand = mulberry32(Math.floor(time * 1000) + coins);
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4;
      const v = 220 + rand() * 380;
      spray.push({ x: frogScreen.x + (rand() - 0.5) * 30 * frogScreen.k, y: frogScreen.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, r: (5 + rand() * 4) * frogScreen.k, colour: i % 4 === 0 ? GOLD : '#d38b3a' });
    }
  }

  /** Coins into the stash, and any drip they earn announced. */
  function stashCoins(coins: number): void {
    if (coins <= 0) return;
    const before = drip;
    stash.coins += coins;
    saveStash(stash);
    drip = dripFor(stash.coins);
    const fresh = DRIP.find((d) => drip.has(d.item) && !before.has(d.item));
    if (fresh) unlocked = { label: fresh.label, age: 0 };
  }

  /** The cash-out lands: the bag is banked into the stash. */
  function bank(): void {
    const coins = fallen ? 0 : world.bag;
    banked = coins;
    if (live) live.banked = coins;
    if (coins > 0) {
      stash.best = Math.max(stash.best, coins);
      stash.banked += 1;
    }
    stashCoins(coins);
  }

  /** The rails go. A crash more than 1.5 s old is shown settled, so one missed while the tab was hidden is not replayed late. */
  function rugPull(view: SceneView, first: boolean): void {
    bust = Math.max(1, view.currentX100 / 100);
    const quiet = first || view.crashAge > 1500;
    crashAge = quiet ? Math.max(3, view.crashAge / 1000) : 0;
    // A spectator was paper trading: half the paper bag goes to the stash before the rest falls with the rails.
    if (!secured && paperRun(view)) {
      paper = Math.floor(world.bag / 2);
      stashCoins(paper);
    }
    // Whatever the rails were last saying gets out of the way of the rug.
    if (toast) toast.age = Math.max(toast.age, TOAST_S - 0.4);
    if (quiet) {
      rugZ = RUNNER_Z - 0.45;
      if (hover.x < 0.5 && !secured) {
        fallen = true;
        fallAge = 3;
        world.bag = 0;
      }
      dev = 0;
      settleSpring(outcomePop, 1);
      audio.crash('boom', true);
      return;
    }
    shake = 0.5;
    {
      freeze = FREEZE_S;
      if (!secured) punch = 0;
    }
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
    const seconds = view.elapsed / 1000;
    // 1× to 3× sweeps 0 to 0.67, the window most rounds end in; the caption ladder and the endurance acts carry
    // the long rounds on from there.
    const tension = clamp(1 - 1 / multiplier, 0, 1);

    // ---- The round's phases -----------------------------------------------------------------------------
    // A finished round fades through black to the next station; the course is reset at the darkest moment.
    if (view.phase === 'betting' && previous !== 'betting') {
      if (first || (crashAge < 0 && world.distance < 0.01)) newRound();
      else {
        swap = 0;
        pending = true;
      }
    }
    if (swap >= 0) {
      swap += real;
      if (pending && swap >= SWAP_S / 2) {
        pending = false;
        newRound();
      }
      if (swap >= SWAP_S) swap = -1;
    }
    // Never run on a stale course, even if the betting phase was missed.
    if (running && !first && (pending || crashAge >= 0)) {
      pending = false;
      newRound();
    }
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
        resetWorld(world, seedFor(), multiplier);
        settleRunning(world, multiplier, seconds);
        live = { world, elapsed: view.elapsed, wall: Date.now(), banked: null };
      }
      stage = Math.max(0, STAGES.filter((s) => multiplier >= s.at).length - 1);
      dev = running && multiplier >= DEV_AT ? 1 : 0;
      ghost = paperRun(view) && (running || crashed) ? 1 : 0;
      panelK = running || crashed ? 0 : 1;
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
        say(banked ? `JEETED · ${count(banked)} COINS ON THE BOARD` : 'JEETED · EMPTY BAG, PROFITS TAKEN', LIME);
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
    if (crashed) ended = { ...view };
    const shown = pending && ended ? ended : view;

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
    // Off the rails from the frame the cash-out lands: nothing more goes into a bag that has been banked.
    const offRails = hover.x > 0.05 || fallen || secured !== null;
    const cmd = playerSteers ? input.take() : autopilot(world, dt);
    stepWorld(world, cmd, { running: running && !fallen, multiplier, seconds: view.elapsed / 1000, off: offRails }, dt);
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
      if (e.slip) {
        audio.fx('squeak', 0.7);
        say('SLIPPAGE 12% · STEERING LOOSE', '#c4b5fd');
      }
      if (e.expired) audio.fx('tick', 0.8);
      if (e.honey) {
        audio.fx('glug', 1);
        say('HONEYPOT · −20% BAG · SKILL ISSUE', PINK);
        shake = Math.max(shake, 0.15);
      }
      if (e.stumble) {
        audio.fx('thud', 0.9);
        audio.fx('clang', e.swipe ? 0.8 : 0.4);
        shake = Math.max(shake, 0.3);
        if (!e.audit) say(e.swipe ? 'CLIPPED IT · −25% BAG' : 'STUMBLED · −25% BAG', '#ffb3c8');
      }
      if (e.heavy) {
        audio.fx('punch', 1);
        audio.fx('scream', 0.55);
        shake = Math.max(shake, 0.6);
        flash = 0.5;
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
    // A pulse under the music, quicker as the number climbs, until the bag is safe.
    if (running && !secured) {
      pulse += dt / mix(1.4, 0.35, tension);
      if (pulse >= 1) {
        pulse -= 1;
        audio.fx('heartbeat', 0.15 + 0.25 * tension);
      }
    }

    // ---- The dev at the end of the line --------------------------------------------------------------------
    // He turns up at 1.3× holding the rug the rails are laid on, and tugs: a creak and a ripple down the rails, more
    // often and harder as the number climbs. Keyed to the multiplier, never the crash point; at the crash he yanks.
    if (running && multiplier >= DEV_AT) {
      tugClock += dt / mix(4.6, 1.5, tension);
      if (tugClock >= 1) {
        tugClock -= 1;
        tugAge = 0;
        tugs += 1;
        waveAmp = 0.05 + 0.11 * tension;
        if (!secured) {
          audio.fx('creak', 0.35 + 0.5 * tension);
          if (tugs <= 2 && (!toast || toast.age > 0.8)) say(tugs === 1 ? 'WAS THAT THE RUG?' : 'DEV: JUST FIXING A WRINKLE', '#ffb3c8');
        }
      }
    }
    tugAge += dt;
    const devTarget = running ? smoothstep(DEV_AT - 0.06, DEV_AT + 0.02, multiplier) : crashed && crashAge >= 0 && crashAge < 0.35 ? 1 : 0;
    dev = ease(dev, devTarget, crashed ? 7 : 3, dt);
    const tug = crashed && crashAge >= 0 ? 1 : tugAge < 0.4 ? Math.sin((Math.PI * tugAge) / 0.4) : 0;
    const crest = FAR - (tugAge - 0.12) * WAVE_V;
    const wave = running && tugAge > 0.12 && crest > 0.5 ? crest : undefined;

    // ---- The hover and the fall ---------------------------------------------------------------------------
    stepSpring(hover, secured ? 1 : 0, 3.2, 0.9, dt);
    stepSpring(slideK, r.slide > 0 ? 1 : 0, 26, 0.9, dt);
    stepSpring(bagShown, world.bag, 12, 1, dt);
    stepSpring(camX, hover.x > 0.5 ? 0 : r.x.x * 0.3, 5, 1, dt);
    cam.x = camX.x;
    if (crashed && crashAge >= 0) {
      crashAge += dt;
      const roll = smoothstep(0, ROLL_S, crashAge);
      rugZ = mix(FAR, RUNNER_Z - 0.45, roll);
      if (!fallen && rugZ <= RUNNER_Z + 0.3 && hover.x < 0.5) {
        fallen = true;
        fallAge = 0;
        fallH = world.runner.h;
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
    // He sees it coming: the stride runs down with the course, then arms up and a look back before the floor goes.
    const scare = secured || hover.x > 0.5 ? 0 : fallen ? 1 : crashed && crashAge >= 0 ? smoothstep(0.3, 0.45, crashAge) : 0;
    stepSpring(outcomePop, shown.phase === 'crashed' && crashAge > 1 ? 1 : 0, 14, 0.45, dt);
    stepSpring(badge, secured && !crashed ? 1 : 0, 12, 0.5, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.55);
    if (flash > 0) flash = Math.max(0, flash - dt * 2.5);
    if (punch >= 0) punch = punch > 1 ? -1 : punch + real;
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
    // The Taxman: once off the platform he gives chase, closer as the number climbs (drawn only: penalties use the
    // real heat); a stumble brings him in fast; he gives up on a hoverboard and goes into the void with the rails.
    const chase = running && !secured ? (0.08 + 0.35 * tension) * smoothstep(1.2, 3.5, seconds) : 0;
    const taxTarget = crashed ? taxHeat : Math.max(world.heat, chase);
    taxHeat = first ? taxTarget : ease(taxHeat, taxTarget, taxTarget > taxHeat ? 10 : 2.5, dt);
    taxPhase += dt * (5 + 0.45 * world.speed.x);
    ghost = ease(ghost, paperRun(view) && (running || crashed) ? 1 : 0, 6, dt);
    panelK = ease(panelK, shown.phase === 'betting' || shown.phase === 'waiting' ? 1 : 0, 10, dt);

    // ---- The picture ---------------------------------------------------------------------------------------
    // The void stays dark through any wait after the crash, until the fade to the next station.
    const dark = crashAge >= 0 ? smoothstep(0.2, 1.4, crashAge) : 0;
    const track: TrackView = { seconds: running || crashed ? seconds : 0, time, distance: world.distance, tension, rugZ, dark, dev, tug, wave, waveAmp };
    ctx.save();
    if (punch >= 0) {
      // The punch-in: 10% on the frog from the frame the rails go, held through the hit-stop, then eased back.
      const zoom = 1 + PUNCH * smoothstep(0, 0.05, punch) * (1 - smoothstep(0.3, 0.65, punch));
      ctx.translate(frogScreen.x, frogScreen.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-frogScreen.x, -frogScreen.y);
    }
    if (shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    else if (running && !offRails) ctx.translate(Math.sin(time * 90) * 1.4 * speedK * speedK, 0);
    const fall = fallen ? clamp(fallAge / 1.2, 0, 1) : 0;
    // Standing at the station he breathes; the rug's ripple lifts him as it passes under his feet.
    const breath = (1 - smoothstep(0, 2, world.speed.x)) * (1 - hover.x) * 1.5 * (0.5 - 0.5 * Math.cos(time * Math.PI * 1.8));
    const bump = !fallen && r.h <= r.ground + 0.05 ? floorBump(track, RUNNER_Z) : 0;
    drawWorld(ctx, world, track, cam, () => {
      const x = mix(r.x.x, HOVER_X, hover.x);
      const hoverBob = Math.sin(time * 2.2) * 0.05;
      const h = fallen ? fallH - fallAge * fallAge * 6 : mix(r.h + bump, HOVER_H + hoverBob, hover.x);
      if (h < -8) return;
      if (!fallen && hover.x < 0.5) {
        const g = project(r.x.x, RUNNER_Z, r.ground + bump, cam);
        drawShadow(ctx, g.X, g.Y, g.s, r.h - r.ground);
      }
      const p = project(x, RUNNER_Z, h, cam);
      const k = (p.s * 0.7) / 130;
      frogScreen = { x: p.X, y: p.Y - 78 * k, k };
      // A spectator's frog is paper trading: drawn as a ghost of a run.
      ctx.save();
      ctx.globalAlpha = 1 - 0.4 * ghost;
      drawFrog(ctx, {
        X: p.X, Y: p.Y, s: p.s, stride: r.stride, lean: r.x.v, air: !fallen && hover.x < 0.5 && r.h > r.ground + 0.05, vh: r.vh, slide: slideK.x,
        stumble: r.stumble, down: r.down, audit: world.audit, bag: bagShown.x, drip, hover: hover.x, fall, magnet: world.magnet > 0, double: world.double > 0, time, breath, scare,
      });
      ctx.restore();
    });
    // The Taxman on the platform taps his foot before the round and shakes a fist as it leaves without him; then
    // he is on the frog's heels. The platform is no rug: on an instant bust he stays on it, still waiting.
    const platformZ = 4.6 - world.distance;
    if (platformZ > 0.9) {
      const p = project(2.35, platformZ, 0.42, cam);
      drawTaxman(ctx, { X: p.X, Y: p.Y, k: (p.s * 0.85) / 170, heat: 1, reachTo: null, grab: 0, idle: true, fall: 0, time, fist: smoothstep(0.02, 0.6, world.distance) });
    }
    stepSpring(taxX, frogScreen.x - 130 * frogScreen.k, 7, 1, first ? 1 : dt);
    // He lags a swerve away from him, but a swerve toward him never runs the frog through him.
    if (taxX.x > frogScreen.x - 110 * frogScreen.k) settleSpring(taxX, frogScreen.x - 110 * frogScreen.k);
    // He sinks back out of the picture as the hoverboard lifts the frog away from him.
    const heat = taxHeat * (1 - hover.x);
    if (heat > 0.02 && (!fallen || fallAge < 1.5)) {
      const grab = world.audit >= 0 ? clamp(world.audit / 1.2, 0, 1) : 0;
      const drop = fallen ? fallAge * fallAge * 900 : 0;
      drawTaxman(ctx, { X: taxX.x, Y: H + 175 - heat * 265 + drop, k: 1.25 * frogScreen.k, heat, reachTo: grab > 0 && grab < 1 ? { x: frogScreen.x, y: frogScreen.y } : null, grab, idle: false, fall, time, cycle: taxPhase });
    }
    for (const p of spray) {
      ctx.globalAlpha = clamp(1.6 - p.age * 1.2, 0, 1);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * (Math.abs(Math.cos(p.age * 14 + p.r))), 0, 0, Math.PI * 2);
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
    hud(ctx, shown, Math.max(1, shown.currentX100 / 100), running, shown.phase === 'crashed', scare);
    // The fade through black takes the HUD with it, so the finished round's outcome goes out under the dark.
    if (swap >= 0) {
      ctx.fillStyle = `rgba(5, 3, 15, ${clamp(1 - Math.abs(swap - SWAP_S / 2) / (SWAP_S / 2), 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---- The HUD -------------------------------------------------------------------------------------------

  function hud(ctx: CanvasRenderingContext2D, view: SceneView, multiplier: number, running: boolean, crashed: boolean, scare: number): void {
    const bot = !playerSteers;
    const station = view.phase === 'betting' || view.phase === 'waiting';
    const keys = keyboard?.matches ?? true;
    const staked = view.stake !== null;
    const recorded = mode() === 'replay';
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
    text(ctx, world.streak >= 5 ? `${world.streak} STREAK${world.double > 0 ? ' · 2×' : ''}` : world.double > 0 ? '2× LEVERAGE' : 'COINS · WORTH: NOTHING', W - 186, 105, 7.5, world.streak >= 5 ? GOLD : '#c9c2e6', 'left', 160, MONO);
    let barY = 122;
    for (const [left, label, tint] of [[world.magnet, 'INSIDER TIP', CYAN], [world.double, '2× LEVERAGE', '#c4b5fd'], [world.runner.slip, 'SLIPPAGE', PINK]] as const) {
      if (left <= 0) continue;
      panel(ctx, W - 226, barY, 212, 16, 'rgba(10, 8, 26, 0.72)', undefined, 4);
      ctx.fillStyle = tint;
      ctx.fillRect(W - 220, barY + 4, 200 * clamp(left / (label === 'SLIPPAGE' ? 1 : POWER_S), 0, 1), 8);
      text(ctx, label, W - 120, barY + 8, 7, INK, 'center', 180, MONO);
      barY += 20;
    }
    // The stash: every bag banked here, its rank and what it unlocks next. Recognition only.
    const goal = nextGoal(stash.coins);
    panel(ctx, W - 300, H - 52, 286, 40, 'rgba(10, 8, 26, 0.72)', '#3b2d63', 8);
    text(ctx, `STASH ${count(stash.coins)} COINS · ${rankFor(stash.coins)}`, W - 288, H - 40, 10, GOLD, 'left', 262);
    text(ctx, goal ? `NEXT: ${goal.label} AT ${count(goal.at)} · BEST BAG ${count(stash.best)}` : `MAXED · BEST BAG ${count(stash.best)}`, W - 288, H - 24, 7, '#c9c2e6', 'left', 262, MONO);
    // The caption ladder at the top, and the milestone alert beside it. Past 42 s the endurance acts take the
    // caption, except for a few seconds after a new stage, so a late stage is always read.
    const fallenCaption = fallAge < 0.7 ? 'THE FLOOR WAS A RUG' : 'NGMI';
    const act = endurance(view.elapsed / 1000).act;
    const lateCaption = ['', 'NEON STATION. SAME TAXMAN.', 'MIND THE AMBER LIGHTS', 'BLUE LINE. NO LAST STOP.', 'THE TUNNEL HAS OVERTIME'][act]!;
    // After a cash-out the world keeps running, and so does the regret.
    const since = secured ? view.currentX100 / secured.x100 : 1;
    const regret = since >= 10 ? 'COULD HAVE BEEN A LAMBO. IS A HOVERBOARD.' : since >= 4 ? 'DO NOT LOOK AT THE CHART.' : since >= 2 ? 'IT DOUBLED SINCE. YOU ARE FINE.' : since >= 1.25 ? 'IT KEEPS GOING. PROFITS ARE PROFITS.' : 'HOVERING. WATCHING THE DEGENS.';
    const caption = crashed
      ? secured ? 'PAPER HANDS. DODGED THE RUG.' : fallen || crashAge > 1 ? fallenCaption : scare > 0.5 ? 'OH NO' : 'IS THAT A RUG'
      : secured ? regret : running ? (act && alertAge > 6 ? lateCaption : STAGES[stage]!.caption) : station ? 'MIND THE GAP' : 'GM. RUN.';
    memeText(ctx, caption, W / 2, 46, 30, crashed && !secured ? '#ffb3c8' : '#fff', 'center', 450);
    if (running && !secured && alertAge < 4 && stage > 0) {
      const alert = STAGES[stage]!;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (4 - alertAge) * 2);
      const tint = stage >= HOT_STAGE ? PINK : CYAN;
      panel(ctx, 14, 82, 284, 52, 'rgba(10, 8, 26, 0.86)', tint, 6);
      ctx.fillStyle = tint;
      ctx.fillRect(15, 92, 3, 32);
      text(ctx, alert.alert, 28, 98, 12, tint, 'left', 260);
      text(ctx, alert.detail, 28, 120, 9, '#e9e6ff', 'left', 262, MONO);
      ctx.restore();
    }
    // The cash-out badge while hovering: the credits on one line, the coins (a score, worth nothing) on the next.
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(W / 2, 92);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, `${(secured.x100 / 100).toFixed(2)}×${secured.payout !== null ? ` · +${count(secured.payout)} CREDITS` : ' · BAILED'}`, 0, 0, 22, LIME, 'center', 520);
      memeText(ctx, `${count(banked ?? 0)} COINS STASHED · PROFITS TAKEN. RESPECT.`, 0, 22, 12, '#e9ffd0', 'center', 520);
      ctx.restore();
    }
    // Toasts: what just happened on the rails.
    if (toast) {
      ctx.save();
      ctx.globalAlpha = clamp((TOAST_S - toast.age) * 2.5, 0, 1);
      ctx.translate(W / 2, secured ? 146 : 128);
      const k = 1 + 0.12 * toast.pop.x;
      ctx.scale(k, k);
      memeText(ctx, toast.line, 0, 0, 24, toast.colour, 'center', 620);
      ctx.restore();
    }
    if (unlocked) {
      ctx.save();
      ctx.globalAlpha = clamp((4 - unlocked.age) * 1.5, 0, 1);
      const y = secured ? 172 : 154;
      panel(ctx, W / 2 - 170, y, 340, 40, 'rgba(10, 8, 26, 0.9)', GOLD, 8);
      text(ctx, `DRIP UNLOCKED · ${unlocked.label}`, W / 2, y + 14, 14, GOLD, 'center', 320);
      text(ctx, 'COSMETIC. WORTH NOTHING. LOOKS EXPENSIVE.', W / 2, y + 31, 7.5, '#e9e6ff', 'center', 320, MONO);
      ctx.restore();
    }
    // The controls at the station, on the left clear of the frog and the Taxman's platform; it fades as the round leaves.
    if (panelK > 0.02) {
      ctx.save();
      ctx.globalAlpha = panelK;
      const x = 16, y = 150;
      panel(ctx, x, y, 404, 128, 'rgba(10, 8, 26, 0.88)', '#3b2d63', 8);
      if (station) panelTitle = recorded ? 'RECORDED ROUND. WATCH THE FROG.' : view.phase !== 'betting' ? 'NEXT ROUND SOON' : staked ? 'APED IN. NOW DODGE FOR COINS.' : 'APE IN. THEN DODGE FOR COINS.';
      text(ctx, panelTitle, x + 14, y + 20, 17, GOLD, 'left', 376);
      text(ctx, keys ? 'UP ARROW = JUMP · DOWN = SLIDE · LEFT/RIGHT = SWERVE' : 'SWIPE UP = JUMP · DOWN = SLIDE · SIDEWAYS = SWERVE', x + 14, y + 46, 12, '#e9e6ff', 'left', 376, MONO);
      // Space is the shell's: before a bet it joins the round, once staked it cashes out. It never jumps.
      const spaceLine = recorded ? 'A REPLAY · NO STAKE · NOTHING TO CASH OUT' : !keys ? 'THE CASH OUT BUTTON BANKS THE BAG' : staked ? 'SPACE = CASH OUT (NOT JUMP) · BANKS THE BAG' : 'SPACE = APE IN, THEN CASH OUT (NOT JUMP)';
      text(ctx, spaceLine, x + 14, y + 66, 12, LIME, 'left', 376, MONO);
      text(ctx, 'DODGE FOR COINS · NOTHING YOU DODGE MOVES', x + 14, y + 88, 11, '#c9c2e6', 'left', 376, MONO);
      text(ctx, 'THE RUG OR YOUR CREDITS', x + 14, y + 102, 11, '#c9c2e6', 'left', 376, MONO);
      text(ctx, bot ? 'A COPY-TRADING BOT (MID) RUNS UNTIL YOU DO' : 'MANUAL MODE · NO REFUNDS', x + 14, y + 118, 9, CYAN, 'left', 376, MONO);
      ctx.restore();
    }
    // While a round runs: Space is the cash-out, named apart from the jump, for a player with a stake on it.
    if (running && !secured) {
      const cashLine = recorded ? 'REPLAY · WATCH THE FROG' : staked ? (keys ? 'SPACE = CASH OUT (NOT JUMP)' : 'CASH OUT BUTTON = BAIL') : 'PAPER TRADING · NO STAKE';
      const moveLine = bot ? (keys ? 'BOT DRIVING · ARROWS TAKE THE WHEEL' : 'BOT DRIVING · SWIPE TO TAKE THE WHEEL') : keys ? 'UP ARROW = JUMP · LEFT/RIGHT = SWERVE' : 'SWIPE TO DODGE · TAP TO JUMP';
      panel(ctx, 14, H - 54, 300, 42, 'rgba(6, 10, 32, 0.9)', staked ? LIME : CYAN, 6);
      text(ctx, cashLine, 26, H - 40, 13, staked ? LIME : CYAN, 'left', 276, MONO);
      text(ctx, moveLine, 26, H - 22, 11, '#e9e6ff', 'left', 276, MONO);
    }
    // A spectator's frog wears a tag: this run is paper.
    if (ghost > 0.05 && !fallen && (running || crashed)) {
      ctx.save();
      ctx.globalAlpha = ghost;
      const y = frogScreen.y - 112 * frogScreen.k;
      panel(ctx, frogScreen.x - 62, y - 11, 124, 22, 'rgba(10, 8, 26, 0.85)', LIME, 11);
      text(ctx, 'PAPER TRADING', frogScreen.x, y, 11, LIME, 'center', 112, MONO);
      ctx.restore();
    }
    // The outcome, once the rails are gone.
    if (crashed && outcomePop.x > 0.02) {
      ctx.save();
      ctx.translate(W / 2, 250);
      ctx.rotate(-0.03);
      const k = clamp(outcomePop.x, 0, 1.3);
      ctx.scale(k, k);
      if (secured) {
        panel(ctx, -240, -62, 480, 124, 'rgba(10, 30, 20, 0.94)', LIME, 10, 2);
        memeText(ctx, 'DODGED', 0, -24, 48, LIME, 'center');
        text(ctx, `JEETED AT ${(secured.x100 / 100).toFixed(2)}×${secured.payout !== null ? ` · +${count(secured.payout)} CREDITS` : ''} · ${count(banked ?? 0)} COINS STASHED`, 0, 20, 12, '#e9e6ff', 'center', 450, MONO);
        text(ctx, `RUGGED AT ${bust.toFixed(2)}× · THE REST WERE THE EXIT LIQUIDITY`, 0, 42, 10.5, '#c9c2e6', 'center', 450, MONO);
      } else if (!staked) {
        panel(ctx, -240, -62, 480, 124, 'rgba(30, 8, 20, 0.94)', PINK, 10, 2);
        memeText(ctx, 'RUGGED', 0, -24, 48, PINK, 'center');
        text(ctx, 'YOU WATCHED A FROG GET RUGGED. FEW UNDERSTAND.', 0, 20, 12, '#ffe9f1', 'center', 450, MONO);
        text(ctx, `${bust.toFixed(2)}× · ${paper ? `PAPER BAG: HALF STASHED · +${count(paper)} COINS` : recorded ? 'RECORDED ROUND · NO STAKE, NO LOSS' : 'PAPER TRADING · NO STAKE, NO LOSS'}`, 0, 42, 10.5, '#ffb3c8', 'center', 450, MONO);
      } else {
        panel(ctx, -240, -62, 480, 124, 'rgba(30, 8, 20, 0.94)', PINK, 10, 2);
        memeText(ctx, 'RUGGED', 0, -24, 48, PINK, 'center');
        text(ctx, `${bust.toFixed(2)}× · THE RAILS WERE THE EXIT LIQUIDITY`, 0, 20, 12, '#ffe9f1', 'center', 450, MONO);
        text(ctx, 'UNREALIZED BAG: GONE · NGMI', 0, 42, 10.5, '#ffb3c8', 'center', 450, MONO);
      }
      ctx.restore();
    }
    if (running && !secured) text(ctx, `${Math.round(world.distance * 8)} M · ${Math.round(world.speed.x * 12)} KM/H`, 26, 148, 9, '#c9c2e6', 'left', 200, MONO);
  }

  return {
    draw,
    dispose() {
      input.dispose();
    },
  };
}
