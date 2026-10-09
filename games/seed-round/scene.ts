/**
 * Composes Seed Round from the room state: the tunnel, the egg, the race and
 * the crash in WebGL2, copied into the visible canvas, then the HUD in
 * Canvas 2D. All motion is stepped here with the real frame time, and nothing
 * drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { IMPACT, OUTSIDE, PULL, RUG_PULL, crashFlash, createCrash, drawOutside, drawWall, outside, outsideCamera, outsideEnvironment, pullBack, resetCrash, rugPulled, startCrash, stepCrash } from './crash';
import { createFeed, drawFeed, post, resetFeed, settleFeed, stepFeed } from './feed';
import { drawFallback } from './fallback';
import { putInstance } from './gl';
import { H, W, drawCard, drawLabels, drawVignette, grouped, memeText } from './hud';
import { type Vec3, add, basisFrom, lerp3, lookAt, madd, mat4, normalize, perspective, rotateAbout, sub } from './math3d';
import { clamp, gust, mix, mulberry32, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { EGG_FAR, type Label, WAVES, bankYou, createPack, drawPack, eggDistance, headline, pilePack, portalPoint, resetPack, settlePack, stepPack } from './pack';
import { borePoint, frameAt } from './path';
import { type Environment, RING_SPACING, Renderer } from './render';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a reveal missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the camera shake and roll, the wall throb, the streaks and the flashes. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  /** Releases the WebGL context and stops listening to it; a new scene can be created afterwards. */
  dispose(): void;
}

type Outcome = 'rekt' | 'called' | 'ended';
type Secured = { x100: number; payout: number | null };

const EGG_RADIUS = 9;
const MAX_PIXEL_RATIO = 1.5;
/**
 * Seconds of the crash that play out even when the next round's betting opens sooner (the emulator waits 2 s),
 * under a NEXT SEED ROUND LOADING banner; the rug is pulled by then, and the lobby gets the rest.
 */
const REVEAL_HOLD = 4.6;
/** The multipliers the milestone stingers play at: the caption ladder. */
const RUNGS = [1.3, 1.8, 2.4, 3.3, 4.6, 6.9, 10];
/** The pile-up into the wall: a hard freeze, then slow motion, with the lens punched in and held (real seconds). */
const FREEZE_S = 0.15;
const SLOW_S = 0.35;
const SLOW_RATE = 0.3;
const PUNCH_HOLD = 0.3;
/** The fake-outs: the dev flinches at these multipliers (keyed to the climb, never to the crash), then every 1.6×. */
const FLINCHES = [1.4, 2.25, 3, 4.2, 5.6, 8.3, 12.5, 19, 28, 42];
const FLINCH_LINES = ['DEV FLINCHED', 'DEV IS SWEATING', 'DEV CHECKED THE CHART', 'HOLD IT, DEV', 'DEV HOVERING OVER SELL', 'DEV FLINCHED AGAIN'];
const flinchAt = (i: number): number => FLINCHES[i] ?? FLINCHES[FLINCHES.length - 1]! * 1.6 ** (i - FLINCHES.length + 1);
/** The next flinch still to come at `m`: the ones the climb has already passed are never replayed. */
function nextFlinch(m: number): number {
  let i = 0;
  while (flinchAt(i) <= m) i += 1;
  return i;
}
/** After your exit the round runs on without you: the regret ladder, by how far it has climbed past your exit. */
const REGRET: [number, string][] = [[40, "COPE: AT LEAST YOU'RE SAFU"], [10, 'TELL NO ONE YOU SOLD'], [4, "DON'T LOOK AT THE CHART"], [2, 'IT KEEPS PUMPING'], [1.5, 'PAPER TAILS?']];
/** Seconds of the reveal at which the condom bounces off the bin's rim, and the bin goes over. */
const RIM_AT = OUTSIDE + 0.62;
const BIN_AT = RUG_PULL + 0.45;
type Confetti = { x: number; y: number; vx: number; vy: number; age: number; life: number; colour: string; size: number };

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["STILL CHASING THE EGG", "DIAMOND TAIL ENDURANCE", "ANOTHER WHALE INBOUND", "THE TUNNEL KEEPS GOING", "NO SWIMMER LEFT BEHIND", "LAP TWO: STILL EARLY", "THE EGG HAS NO ETA", "MARATHON MODE"];

function captionFor(view: SceneView, m: number, outcome: Outcome | null, secured: Secured | null, event: string | null): string {
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'DODGED THE RUG' : 'FUNDS ARE SAFU';
  if (view.phase === 'betting') return 'LOADING…';
  if (view.phase !== 'running') return 'GM DEGENS';
  if (secured) return REGRET.find(([at]) => m * 100 >= at * secured.x100)?.[1] ?? 'FROZEN ASSETS';
  if (event) return event;
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  if (m < 1.3) return 'FAIR LAUNCH';
  if (m < 1.8) return 'SWIM FASTER';
  if (m < 2.4) return 'RAW DOGGING THE CHART';
  if (m < 3.3) return 'NO PULLING OUT';
  if (m < 4.6) return 'DIAMOND TAILS';
  if (m < 6.9) return 'KING OF THE HILL';
  if (m < 7.3) return 'NICE';
  if (m < 10) return 'WEN EGG';
  return 'THE EGG IS BIDDING';
}

function popFor(outcome: Outcome, crashX100: number): [string, string] {
  if (outcome === 'called') return ['CALLED IT', '#8ff0ff'];
  if (crashX100 < 105) return ['PREMATURE', '#ff4d6d'];
  return outcome === 'rekt' ? ['RUGGED', '#ff4d6d'] : ['PULLED OUT', '#ffe27a'];
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // Drum and bass down the tunnel; the crash is wet.
  const audio = pageAudio({ style: 'dnb', crash: 'splash' });
  let renderer: Renderer | null = null;
  /** The WebGL canvas. A lost context (a GPU reset, a phone backgrounding the tab) comes back only on it. */
  let glCanvas: HTMLCanvasElement | null = null;
  let restored = false;
  // Without preventDefault the browser never restores a lost context; the 2D stand-in draws until it does.
  const onLost = (event: Event): void => event.preventDefault();
  const onRestored = (): void => {
    restored = true;
  };
  try {
    renderer = new Renderer();
    glCanvas = renderer.canvas;
    glCanvas.addEventListener('webglcontextlost', onLost);
    glCanvas.addEventListener('webglcontextrestored', onRestored);
  } catch {
    renderer = null;
  }
  const pack = createPack();
  const crash = createCrash();
  const feed = createFeed();
  const viewMatrix = mat4();
  const projMatrix = mat4();
  const camX = spring(0);
  const camY = spring(-0.7);
  const orbit = spring(1);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const launchPop = spring(0);
  /** The camera's punch into the wall at the impact, held for PUNCH_HOLD. */
  const punch = spring(0);
  let punchHold = 0;
  /** Your beanie: on when you have a stake, off for a spectator, popping on as you join. */
  const hat = spring(1);
  let freeze = 0;
  let slow = 0;
  /** The reveal's sounds, fired once each. */
  let rimHit = false;
  let binHit = false;
  let confetti: Confetti[] = [];
  let last: number | null = null;
  let time = 0;
  let beat = 0;
  let previous: SceneView['phase'] | null = null;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let event: string | null = null;
  let eventTimer = 0;
  /** A caption only gives way to one at least as important: the SEC and the whale over a jeet wave over a flinch. */
  let eventRank = 0;
  /** An expired event's caption lingers this long, so a beat right behind it replaces it without a flash of the ladder. */
  let lingerText: string | null = null;
  let linger = 0;
  /** Seconds the caption on screen has been up. */
  let captionAge = 0;
  /** The next flinch due, seconds since the last one, and how hard the bore is clenching now (0 to 1). */
  let flinchIndex = 0;
  let flinchAge = Infinity;
  let clench = 0;
  /** Seconds of the lobby, which pushes in and quickens its heartbeat toward the launch. */
  let lobbyAge = 0;
  /** The fade in from the reveal to the new round's start line, the vignette's eased tension, the banner's age. */
  let cut = 0;
  let vig = 0;
  let holdAge = 0;
  let launchAge = Infinity;
  let frost = 0;
  let crashX100 = 100;
  /** The next round's betting opened while the reveal was still playing; it finishes first. */
  let holding = false;

  /** Settles the race for a round met mid-run or after the crash, instead of playing out what came before. */
  function settleRace(view: SceneView, m: number): void {
    settlePack(pack, m, view.phase === 'running' ? view.elapsed / 1000 : undefined);
    settleFeed(feed, m);
    settleSpring(orbit, 0);
    flinchIndex = nextFlinch(m);
    if (view.cashoutX100 !== null) {
      // Already in the sperm bank: no swerve, no frost and no fanfare replayed, and the badge is up.
      pack.you.mode = 'banked';
      secured = { x100: view.cashoutX100, payout: view.payout };
      settleSpring(badge, 1);
    }
  }

  /** Back to the start line for a new round. */
  function resetRound(): void {
    if (outside(crash)) cut = 1;
    resetPack(pack);
    resetCrash(crash);
    resetFeed(feed);
    outcome = null;
    secured = null;
    event = lingerText = null;
    eventRank = 0;
    flinchIndex = 0;
    flinchAge = Infinity;
    holding = false;
    freeze = slow = punchHold = 0;
    settleSpring(punch, 0);
    rimHit = binHit = false;
    confetti = [];
  }

  /** The burst over the badge as the bank accepts you. */
  function celebrate(): void {
    const rng = mulberry32(0xcafe);
    for (let i = 0; i < 36; i += 1) confetti.push({ x: W / 2 + (rng() - 0.5) * 40, y: 96, vx: (rng() - 0.5) * 360, vy: -120 - rng() * 220, age: 0, life: 1 + rng() * 0.8, colour: ['#8ff0ff', '#d5fb6d', '#ffffff', '#ffe27a'][i % 4]!, size: 2.5 + rng() * 3.5 });
  }

  function setEvent(text: string, seconds: number, rank: number): void {
    if (event !== null && rank < eventRank) return;
    event = text;
    eventTimer = seconds;
    eventRank = rank;
  }

  function tunnelEnvironment(tension: number, eggPos: Vec3, closeness: number, eye: Vec3): Environment {
    const glow = 0.55 + 0.9 * closeness;
    return {
      fogColor: [0.3 + 0.1 * tension, 0.04, 0.1],
      fogGlow: [0.95, 0.42 + 0.2 * closeness, 0.5 + 0.18 * closeness],
      fogDensity: 0.0115,
      glowPos: eggPos,
      glowColor: [glow, glow * 0.78, glow * 0.82],
      ambientTop: [0.36, 0.13, 0.19],
      ambientBottom: [0.16, 0.04, 0.08],
      lightPos: eye,
    };
  }

  function drawWorld(r: Renderer, view: SceneView, m: number, tension: number, drive: number, labels: Label[], dt: number): void {
    if (outside(crash)) {
      const cam = outsideCamera(crash);
      lookAt(viewMatrix, cam.eye, cam.target, [0, 1, 0]);
      perspective(projMatrix, (40 * Math.PI) / 180, W / H, 0.1, 200);
      r.begin(viewMatrix, projMatrix, cam.eye, outsideEnvironment(), time);
      drawOutside(crash, r, time, labels);
      r.end();
      return;
    }
    // The camera: an orbit round your swimmer while the round loads, a chase cam once it runs.
    const racing = view.phase === 'running' || crash.active;
    stepSpring(orbit, racing ? 0 : 1, 3, 1, dt);
    const currentSway = !reduced && view.elapsed > 45000 ? Math.sin(view.elapsed / 1000 * Math.PI / 18) * 0.45 : 0;
    // Your swimmer, followed at half weight through the swerve into the bank so the portal stays in frame.
    const follow = pack.you.mode === 'race' ? 1 : pack.you.mode === 'bank' ? 0.5 : 0;
    const followX = follow * pack.you.x + (pack.you.mode === 'race' ? currentSway : 0);
    const followY = mix(-0.3, pack.you.y, follow);
    stepSpring(camX, followX, 2.4, 1, dt);
    stepSpring(camY, followY, 2.4, 1, dt);
    // Reduced motion skips the yank back down the tunnel; the cut becomes a soft fade.
    const back = reduced ? 0 : pullBack(crash);
    const eyeS = pack.anchor - 4.6 - back;
    const chaseEye = borePoint(eyeS, camX.x * 0.7, camY.x * 0.7 + 1.45);
    const chaseTarget = borePoint(pack.anchor + 7 - back, camX.x * 0.35, camY.x * 0.35 + 0.1);
    const f = frameAt(pack.anchor);
    const youPos = borePoint(pack.anchor + pack.you.rel, pack.you.x, pack.you.y);
    const a = time * 0.32 + 0.9;
    // The lobby pushes in on your swimmer as the launch nears, framing it lower so its label clears the captions.
    const push = smoothstep(0, 5, lobbyAge);
    const radius = 2.9 - 0.55 * push;
    const orbitEye = madd(madd(madd(youPos, f.side, Math.sin(a) * radius), f.up, 0.65), f.tangent, Math.cos(a) * radius);
    const orbitTarget = madd(madd(youPos, f.tangent, -0.35), f.up, 0.35 * push);
    let eye = lerp3(chaseEye, orbitEye, orbit.x);
    let target = lerp3(chaseTarget, orbitTarget, orbit.x);
    // Through the bank the lens turns half way to the portal, so the swerve, the spin and the zap play out in frame.
    if (pack.portal.active) target = lerp3(target, portalPoint(pack), 0.5 * smoothstep(0, 0.5, pack.portal.age) * (1 - smoothstep(1.9, 2.9, pack.portal.age)));
    if (!reduced && crash.active && crash.age > IMPACT) {
      const k = Math.max(0, 1 - (crash.age - IMPACT) / 0.7);
      eye = add(eye, [Math.sin(time * 91) * 0.25 * k, Math.cos(time * 77) * 0.2 * k, 0]);
    }
    // The flinch jolts the lens (clench is 0 under reduced motion).
    if (clench > 0) eye = madd(eye, f.up, 0.12 * clench * Math.sin(flinchAge * 47));
    const forward = normalize(sub(target, eye));
    // Slow seeded gusts rather than one sine, nervier with the tension.
    const roll = reduced ? 0 : 0.06 * gust(time * 1.6, 1) + 0.1 * tension * gust(time * 6, 4);
    lookAt(viewMatrix, eye, target, rotateAbout(frameAt(eyeS).up, forward, roll));
    // The lens: wide on the launch and with the tension, punched in on the pile-up.
    const kick = reduced ? 0 : 10 * Math.max(0, 1 - launchAge / 0.8) + 6 * tension - 5.5 * clamp(punch.x, 0, 1.2);
    perspective(projMatrix, ((62 + kick) * Math.PI) / 180, W / H, 0.05, 420);

    // The egg: far and small at 1×, filling the bore the higher it goes.
    const eggM = view.phase === 'running' ? m : crash.active ? crashX100 / 100 : 1;
    const lateSeconds = Math.max(0, view.elapsed / 1000 - 45);
    const current = lateSeconds > 0 && !crash.active ? Math.sin(lateSeconds * Math.PI / 18) : 0;
    const distance = eggDistance(eggM) + 5 * (1 - Math.cos(lateSeconds * Math.PI / 18));
    const near = Math.min(distance, EGG_FAR);
    const eggS = pack.anchor + near;
    const eggScale = (EGG_RADIUS * near) / distance;
    const fe = frameAt(eggS);
    const closeness = clamp(1 - (distance - 16) / 240, 0, 1);
    const env = tunnelEnvironment(tension, fe.point, closeness, eye);
    r.begin(viewMatrix, projMatrix, eye, env, time);
    const flash = crashFlash(crash) * (reduced ? 0.35 : 1) + (reduced ? 0 : 0.45 * Math.max(0, 1 - launchAge / 0.35));
    r.drawTunnel({ s0: Math.floor((eyeS - 14) / RING_SPACING) * RING_SPACING, pulse: reduced ? 0.1 : 0.35 + 0.65 * tension + 1.6 * clench, beat, bulgeS: eggS, bulge: 1, flash, heat: 0.4 * tension + 0.25 * drive, squeeze: 0.08 * clench });
    const [ex, ey, ez] = basisFrom(rotateAbout(fe.tangent, fe.up, time * 0.12), fe.up);
    const eggPoint = madd(fe.point, fe.side, current * 0.55);
    putInstance(r.meshes.sphere, 0, eggPoint, ex, ey, ez, [eggScale, eggScale, eggScale], [1, 1, 1, 1], [0, 0, -1, 0], [1, 0, 0, 0]);
    r.drawLit(r.meshes.sphere, 1);
    const drawn = drawPack(pack, r, eye, reduced, hat.x);
    labels.push(...pack.labels);
    // A spectator has no swimmer in the race: the one the camera follows is just an anon.
    const yours = hat.x > 0.5;
    if (drawn.you) labels.push({ text: yours ? 'YOU' : 'ANON (NOT YOU)', at: drawn.you, colour: yours ? '#d5fb6d' : '#c9b3bd', size: orbit.x >= 0.5 ? 26 : yours ? 20 : 16 });
    r.sprite(fe.point, eggScale * 2.6, [1, 0.78, 0.84, 0.36 + 0.2 * closeness], 2);
    r.sprite(fe.point, eggScale * 1.4, [1, 0.92, 0.82, 0.22], 1);
    r.flushSprites('additive', env.fogDensity * 0.25);
    if (!crash.active) labels.push({ text: 'THE MOON', at: madd(fe.point, fe.up, eggScale + 1.4), colour: '#ffe27a', size: 20, far: true });
    drawWall(crash, r);
    r.end();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    // Nothing to draw into (a collapsed canvas), and copying a zero-size WebGL frame would throw.
    if (ctx.canvas.width < 1 || ctx.canvas.height < 1) return;
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.2);
    last = now;
    // The hit-stop holds the picture for a few frames as the pack hits the wall, then it runs slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 1×–3× sweeps 0–0.67 (0.5 at 2×, near where the median round ends); the log drive keeps 10×–1000× changing.
    const tension = 1 - 1 / multiplier;
    const drive = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    // The shell keeps the stake and the cash-out through the crash, until the next round's betting.
    const cashed = view.cashoutX100 !== null;
    const ending: Outcome = view.stake === null ? 'ended' : cashed ? 'called' : 'rekt';

    if (previous === null) {
      // The scene's first frame: a page load, or a fresh scene for a round whose betting was never drawn.
      previous = view.phase;
      resetPack(pack);
      resetCrash(crash);
      settleSpring(hat, view.stake === null ? 0 : 1);
      vig = running ? tension : 0;
      if (running || crashed) settleRace(view, multiplier);
      if (crashed) {
        outcome = ending;
        crashX100 = view.currentX100;
        startCrash(crash, pack.anchor + pilePack(pack), view.currentX100, cashed, true);
        pop.x = 1;
        rimHit = binHit = true;
        audio.crash('splash', true);
      }
    } else if (view.phase !== previous) {
      // Still holding the last round's reveal: this round ran while the tab was hidden.
      if (crashed && holding) resetRound();
      if (crashed && !crash.active) {
        const quiet = view.crashAge > 1500;
        // Settled only for a run that went by out of sight: a 1.00× crash seen live straight from betting plays
        // out from the start line, the camera swinging round to the chase view.
        if (previous !== 'running' && quiet) settleRace(view, multiplier);
        outcome = ending;
        crashX100 = view.currentX100;
        startCrash(crash, pack.anchor + pilePack(pack), view.currentX100, cashed, quiet);
        post(feed, 'DEV PULLED 100% LIQUIDITY', 'news');
        if (quiet) { pop.x = 1; rimHit = binHit = true; }
        audio.crash('splash', quiet);
      }
      if (view.phase === 'betting') {
        lobbyAge = 0;
        if (crash.active && crash.age < REVEAL_HOLD) { holding = true; holdAge = 0; }
        else resetRound();
      }
      if (running) {
        if (holding) resetRound();
        // Flinches the multiplier already passed (a run that started out of sight) are not replayed.
        flinchIndex = nextFlinch(multiplier);
        launchAge = 0;
        launchPop.v = 14;
        post(feed, 'DEV BOUGHT 69.00 SOL', 'news');
        audio.fx('whoosh', 1);
      }
      previous = view.phase;
    }
    if (holding && crash.age >= REVEAL_HOLD) resetRound();
    // After the resets, so none of them drops this round's cash-out; latched, so the badge stays up through a
    // reveal held into the next round's betting.
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      // Paper hands, and the right call: the feed calls you a jeet, the bank takes you.
      if (running) { audio.cashout(); celebrate(); post(feed, 'paperhands69 (you) sold', 'sell'); }
    }
    if (secured && running && pack.you.mode === 'race') bankYou(pack);

    // The fake-out: at each flinch rung the bore clenches, the flow stalls and the lens jolts for under a second. One
    // due under a bigger caption (the SEC, the whale, a jeet wave) waits for it to clear, and never cuts off a fresh
    // caption, so none flashes up for a frame or two.
    if (running && pack.pileRel === null && multiplier >= flinchAt(flinchIndex) && event === null && (lingerText !== null || captionAge > 0.6)) {
      setEvent(FLINCH_LINES[flinchIndex % FLINCH_LINES.length]!, 1.2, 0);
      flinchIndex = nextFlinch(multiplier);
      flinchAge = 0;
      audio.fx('squeak', 0.35 + 0.3 * tension);
    }
    flinchAge += dt;
    clench = reduced ? 0 : smoothstep(0, 0.06, flinchAge) * (1 - smoothstep(0.15, 0.75, flinchAge)) * (0.6 + 0.4 * tension);
    stepSpring(hat, view.stake === null ? 0 : 1, 14, reduced ? 1 : 0.45, dt);

    stepPack(pack, { racing: running, multiplier, tension, crashed, stall: 0.55 * clench }, dt);
    const wasHit = crash.hit;
    stepCrash(crash, dt);
    if (!wasHit && crash.hit && crash.age < 1) {
      // The pile-up: the thud, the freeze, the slow motion and the punch-in, all but the thud skipped under reduced motion.
      audio.fx('thud', 1.2);
      if (!reduced) {
        freeze = FREEZE_S;
        slow = SLOW_S;
        settleSpring(punch, 1);
        punchHold = PUNCH_HOLD;
      }
    }
    if (crash.active && !rimHit && crash.age >= RIM_AT) { rimHit = true; audio.fx('squeak', 0.7); }
    if (crash.active && !binHit && crash.age >= BIN_AT) { binHit = true; audio.fx('clang', 0.8); }
    // The feed keeps trading after your exit: the round goes on without you.
    if (stepFeed(feed, running, tension, dt, multiplier)) audio.fx('notify', 0.6);
    for (const e of pack.events) {
      if (e === 'jeets') {
        post(feed, `${8 + pack.wave * 3} JEETS SOLD`, 'news');
        // The first wave goes out quietly, just ahead of the snipers' dump.
        if (pack.wave > 1) { setEvent('JEETS OUT', 1.4, 1); audio.fx('boo', 0.4 + 0.4 * tension); }
      }
      if (e === 'snipers') { setEvent('SNIPERS DUMPED', 1.4, 2); post(feed, 'SNIPER BOTS SOLD 12.40 SOL', 'news'); audio.fx('kaching', 0.8); }
      if (e === 'sec') { setEvent('SEC IS HERE', 2.2, 2); post(feed, 'SEC FROZE 3 WALLETS', 'news'); audio.fx('siren', 0.7); }
      if (e === 'whale') { setEvent('WHALE ALERT', 2.8, 2); post(feed, 'WHALE BOUGHT 420.69 SOL', 'news'); audio.fx('glug', 1); }
      if (e === 'banked') { frost = 1; post(feed, 'TOOK PROFITS · BANKED', 'news'); audio.fx('zap', 0.8); }
    }
    eventTimer = Math.max(0, eventTimer - dt);
    if (event !== null && eventTimer <= 0) { lingerText = event; linger = 0.35; event = null; eventRank = 0; }
    linger = Math.max(0, linger - dt);
    if (event !== null || linger <= 0) lingerText = null;
    launchAge += dt;
    frost = Math.max(0, frost - dt / 0.6);
    // The tunnel's heartbeat: about 66 bpm at the launch, 105 at 2×, 136 at 10×. It quickens through the lobby to
    // the launch rate and catches its breath when the dev flinches. A bubble on each beat while you are in the race.
    if (view.phase === 'betting') lobbyAge += dt;
    const hz = running ? 1.1 + 1.3 * tension : crashed ? 1.45 : 0.5 + 0.6 * smoothstep(0, 5, lobbyAge);
    const beatWas = Math.floor(beat / (Math.PI * 2));
    beat += dt * Math.PI * 2 * hz * (1 - 0.6 * clench);
    if (Math.floor(beat / (Math.PI * 2)) !== beatWas) {
      if (running && !secured) audio.fx('bubble', 0.35 + 0.5 * tension);
      else if (view.phase === 'betting' && !holding) audio.fx('bubble', 0.2);
    }
    if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    audio.update(view.phase, tension);
    // The punch-in runs on real time, so it lands on the frozen frame and lets go during the slow motion.
    punchHold = Math.max(0, punchHold - real);
    stepSpring(punch, punchHold > 0 ? 1 : 0, 8, 1, real);
    vig = mix(vig, running ? tension : 0, 1 - Math.exp(-dt * 4));
    cut = Math.max(0, cut - real / 0.4);
    holdAge = holding ? holdAge + real : 0;
    for (const k of confetti) { k.age += dt; k.x += k.vx * dt; k.vy += 480 * dt; k.y += k.vy * dt; k.vx *= Math.exp(-dt * 1.2); }
    confetti = confetti.filter((k) => k.age < k.life);
    // The SAFU print is the impact's punchline; the verdict lands just ahead of the pull-out, about 1.4 s in.
    stepSpring(pop, outcome && crash.age > PULL - 0.3 ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(launchPop, 0, 10, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured, event ?? lingerText);
    captionAge += dt;
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
      captionAge = 0;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);

    if (restored && glCanvas) {
      // The context is back but empty: upload the programs, meshes and atlas again on the same canvas.
      restored = false;
      try {
        renderer = new Renderer(glCanvas);
      } catch {
        renderer = null;
      }
    }
    const labels: Label[] = [];
    const r = renderer && !renderer.lost ? renderer : null;
    if (r) {
      const width = Math.min(ctx.canvas.width, Math.round(W * MAX_PIXEL_RATIO));
      r.resize(width, Math.round((width * H) / W));
      drawWorld(r, view, multiplier, tension, drive, labels, dt);
      ctx.drawImage(r.canvas, 0, 0, W, H);
    } else {
      drawFallback(ctx, multiplier, running, crash.active ? crash.age : null, time, secured !== null, hat.x > 0.5);
    }

    const whiteout = crashFlash(crash) * (reduced ? 0.35 : 1);
    if (whiteout > 0.01) {
      ctx.fillStyle = `rgba(255,250,252,${Math.min(1, whiteout)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (cut > 0.01) {
      ctx.fillStyle = `rgba(16,6,12,${cut})`;
      ctx.fillRect(0, 0, W, H);
    }
    const beatGlow = Math.pow(Math.max(0, Math.sin(beat)), 6);
    if (!outside(crash)) drawVignette(ctx, vig, reduced ? 0 : beatGlow);
    if (r) drawLabels(ctx, labels, r.viewProj);
    if (!outside(crash)) drawFeed(ctx, feed);
    if (!outside(crash)) drawCard(ctx, { multiplier: running ? multiplier : outcome ? crashX100 / 100 : 1, crashed: outcome !== null, king: running && pack.you.mode === 'race' && multiplier >= WAVES[5]!, replies: Math.floor(12 + 40 * Math.pow(Math.max(0, multiplier - 1), 1.3)), time, reduced });
    if (frost > 0.01 && !reduced) {
      ctx.fillStyle = `rgba(160,240,255,${0.35 * frost})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(W / 2, 52);
    const k = 1 + 0.1 * captionPop.x;
    ctx.scale(k, k);
    memeText(ctx, caption, 0, 0, 44, '#ffffff', 'center', 460);
    ctx.restore();
    if (view.phase === 'betting' && !outcome) memeText(ctx, 'YOU WERE THE FASTEST ONCE', W / 2, 82, 18, '#ffd0dc', 'center');
    // Your stake in the next round, along the bottom through the lobby and the reveal held into it (raised clear of
    // the last round's BANKED badge when that holds the bottom of the reveal).
    if (view.phase === 'betting') {
      const y = H - (secured && outside(crash) ? 64 : 52);
      ctx.globalAlpha = holding ? clamp(holdAge / 0.25, 0, 1) : 1;
      if (holding && outside(crash)) memeText(ctx, 'NEXT SEED ROUND LOADING…', W / 2, y - 24, 24, '#ffffff', 'center');
      const [stakeText, stakeColour] = view.stake !== null ? [`YOU'RE IN · ${grouped(view.stake)} CR OF SEED`, '#d5fb6d'] : ['NO SKIN IN THE GAME (YET)', '#c9b3bd'];
      memeText(ctx, stakeText, W / 2, y, 17, stakeColour, 'center');
      ctx.globalAlpha = 1;
    }
    if (launchAge < 1.6 && running && !reduced) {
      ctx.save();
      ctx.globalAlpha = clamp((1.6 - launchAge) / 0.4, 0, 1);
      ctx.translate(W / 2, H / 2 + 20);
      const s = 1 + 0.15 * launchPop.x;
      ctx.scale(s, s);
      memeText(ctx, 'LIQUIDITY EVENT', 0, 0, 60, '#ffffff', 'center');
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× BANKED`;
      ctx.save();
      // Below the caption in the race; along the bottom once the reveal's verdict fills the top.
      ctx.translate(W / 2, (outside(crash) ? H - 26 : 98) + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const b = clamp(badge.x, 0, 1.3);
      ctx.scale(b, b);
      memeText(ctx, text, 0, 0, 28, '#8ff0ff', 'center');
      ctx.restore();
    }
    for (const k of confetti) { ctx.globalAlpha = 1 - k.age / k.life; ctx.fillStyle = k.colour; ctx.beginPath(); ctx.arc(k.x, k.y, k.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (outcome && pop.x > 0.02) {
      const [text, colour] = popFor(outcome, crashX100);
      ctx.save();
      ctx.translate(W / 2, outside(crash) ? 150 : 300);
      ctx.rotate(-0.08);
      const p = clamp(pop.x, 0, 1.3);
      ctx.scale(p, p);
      memeText(ctx, text, 0, 0, 92, colour, 'center');
      ctx.restore();
    }
    if (rugPulled(crash)) {
      ctx.save();
      ctx.translate(W / 2 + 40, 214);
      ctx.rotate(0.05);
      memeText(ctx, 'RUG PULLED TOO', 0, 0, 44, '#ff4d6d', 'center');
      ctx.restore();
    }

    const settled = outcome !== null;
    const colour = settled ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !settled) ctx.globalAlpha = 0.85;
    // Squeezed rather than run across the counter in a freak round (twenty digits by ten minutes).
    memeText(ctx, `${(settled ? crashX100 / 100 : multiplier).toFixed(2)}×`, W - 18, H - 18, 52, colour, 'right', 400);
    ctx.restore();
    memeText(ctx, `CONTENDERS ${grouped(headline(running ? multiplier : 1, settled))}`, 18, H - 18, 22, settled ? '#ff9db0' : '#f6e9ee', 'left');
    // The small lines stack up from above the counter, so none of them overprints another.
    let lineY = H - 46;
    const microns = Math.round((eggDistance(running ? multiplier : 1) + (running ? 5 * (1 - Math.cos(Math.max(0, view.elapsed / 1000 - 45) * Math.PI / 18)) : 0)) * 160);
    if (!settled) { memeText(ctx, `EGG IN ${grouped(microns)} µm`, 18, lineY, 15, '#ffd0dc', 'left'); lineY -= 21; }
    const nextWave = WAVES.find((w) => w > multiplier);
    if (running && nextWave !== undefined && !secured) { memeText(ctx, `NEXT JEET WAVE ${nextWave.toFixed(1)}×`, 18, lineY, 13, '#c9b3bd', 'left'); lineY -= 19; }
    if (running && view.elapsed > 45000) memeText(ctx, 'ESCORTS · OUT OF THE RACE', 18, lineY, 15, '#9fd8ff', 'left', 320);
  }

  return {
    draw,
    dispose() {
      // Unhooked first: the loss dispose() causes must not be prevented, or the context could come back.
      glCanvas?.removeEventListener('webglcontextlost', onLost);
      glCanvas?.removeEventListener('webglcontextrestored', onRestored);
      glCanvas = null;
      restored = false;
      renderer?.dispose();
      renderer = null;
    },
  };
}
