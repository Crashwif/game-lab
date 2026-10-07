/**
 * Composes Moon Boys from the room state: the backyard spaceport, the
 * rocket, the flat earth, the moon and the crash in WebGL2, copied into the
 * visible canvas, then the HUD in Canvas 2D. All motion is stepped here with
 * the real frame time, and nothing drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { CLAP, CTO, CUT, MOONED, RUG, SNAP, crashFlash, createCrash, ctoUp, drawStudio, mooned, outside, resetCrash, rugPulled, startCrash, stepCrash, studioCamera, studioEnvironment } from './crash';
import { createFeed, drawFeed, post, resetFeed, settleFeed, stepFeed } from './feed';
import { drawFallback } from './fallback';
import { H, type Label, W, drawLabels, drawPanel, drawVignette, grouped, memeText, moonKm } from './hud';
import { type Vec3, add, cross, lerp3, lookAt, madd, mat4, normalize, perspective, rotateAbout, sub } from './math3d';
import { clamp, mulberry32, settleSpring, spring, stepSpring } from './motion';
import { WAVES, cameraCentre, aboard, bailYou, createRocket, drawRocket, headline, killRocket, resetRocket, settleRocket, stepRocket } from './rocket';
import { Renderer } from './render';
import { pageSound } from './sound';
import { type Camera, FLAT_AT, createWorld, drawCameraGags, drawGround, drawMoon, drawWires, flightEnvironment, moonPlacement, resetWorld, settleWorld, snapWires, spaceness, stepWorld } from './world';

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
  /** Drops the camera shake and roll, the flashes, the hit-stop, the sweat and the sparks. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  /** Releases the WebGL context and stops listening to it; a new scene can be created afterwards. */
  dispose(): void;
}

type Outcome = 'rekt' | 'called' | 'ended';
type Secured = { x100: number; payout: number | null };

const MAX_PIXEL_RATIO = 1.5;
/** Seconds of the crash that play out even when the next round's betting opens sooner (the emulator waits 2 s). */
const REVEAL_HOLD = CTO + 1.2;
/** The multipliers the milestone stingers play at. */
const RUNGS = [1.3, 1.8, 2.4, 3.3, 4.2, 5.5, 6.9, 10, 15, 25, 50, 100];
/** The wire snap: a short freeze, then slow motion. */
const FREEZE_S = 0.06;
const SLOW_S = 0.3;
const SLOW_RATE = 0.35;
type Confetti = { x: number; y: number; vx: number; vy: number; age: number; life: number; colour: string; size: number };

function captionFor(view: SceneView, m: number, outcome: Outcome | null, secured: Secured | null, event: string | null): string {
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'CALLED IT' : 'IT WAS A SOUNDSTAGE';
  if (view.phase === 'betting') return 'T-MINUS WHENEVER';
  if (view.phase !== 'running') return 'GM MOONBOYS';
  if (secured) return 'BAILED';
  if (event) return event;
  if (m < 1.3) return 'LIFTOFF (TRUST ME)';
  if (m < 1.8) return 'NUMBER GO UP';
  if (m < 2.4) return 'HODL THE RAILING';
  if (m < 3.3) return 'DIAMOND GLOVES';
  if (m < 4.2) return "DON'T LOOK DOWN";
  if (m < 5.5) return 'THE WIRE IS A FEATURE';
  if (m < 6.9) return 'THE MOON IS BIDDING';
  if (m < 7.3) return 'NICE';
  if (m < 10) return 'NEXT STOP URANUS';
  if (m < 15) return 'THE MOON IS SWEATING';
  if (m < 25) return 'STILL FAKE STILL PUMPING';
  if (m < 50) return 'THIS IS FINE';
  return 'WE ARE THE MOON NOW';
}

function popFor(outcome: Outcome, crashX100: number): [string, string] {
  if (outcome === 'called') return ['CALLED IT', '#8ff0ff'];
  if (crashX100 < 105) return ['FAILED TO LAUNCH', '#ff4d6d'];
  return outcome === 'rekt' ? ['RUG PULLED', '#ff4d6d'] : ['THE MOON WAS FAKE', '#ffe27a'];
}

const stageText = (boosters: boolean, core: boolean): string => (boosters ? 'STAGE 1 · FULL STACK' : core ? 'STAGE 2 · SNIPERS GONE' : 'STAGE 3 · JUST VIBES');

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // Synthwave up the gravity well; the crash is a sad trombone.
  const audio = pageAudio({ style: 'synthwave', bpm: 116, tempoRise: 0.3, crash: 'trombone', music: 0.7 });
  const rumble = pageSound(audio);
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
  const rocket = createRocket();
  const world = createWorld();
  const crash = createCrash();
  const feed = createFeed();
  const viewMatrix = mat4();
  const projMatrix = mat4();
  const orbit = spring(1);
  const dip = spring(0);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const launchPop = spring(0);
  /** The camera's punch at the wire snap. */
  const punch = spring(0);
  let freeze = 0;
  let slow = 0;
  let dipTimer = 0;
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
  let launchAge = Infinity;
  let bailFlash = 0;
  let crashX100 = 100;
  /** The next round's betting opened while the reveal was still playing; it finishes first. */
  let holding = false;
  /** What the SUS meter has noticed, on top of what the multiplier alone makes it. */
  let susGained = 0;
  let flatSeen = false;
  /** The studio's sounds, fired once each. */
  let clapped = false;
  let moonedHeard = false;
  let rugHeard = false;
  let ctoHeard = false;
  let laughed = false;
  let lastEngine: Vec3 = [0, -0.5, 0];

  /** Settles the launch for a round met mid-run or after the crash, instead of playing out what came before. */
  function settleLaunch(view: SceneView, m: number): void {
    settleRocket(rocket, m, view.phase === 'running' ? view.elapsed / 1000 : undefined);
    settleWorld(world, m);
    settleFeed(feed, m);
    settleSpring(orbit, 0);
    flatSeen = m >= FLAT_AT;
    susGained = Math.min(100, [FLAT_AT, 2.4, 3.3, 4.2, 4.6, 5.5].filter((at) => m >= at).length * 11);
    if (view.cashoutX100 !== null) {
      // Already bailed: no jump, and the badge is up.
      rocket.you.mode = 'gone';
      settleSpring(badge, 1);
    }
  }

  /** Back on the pad for a new round. */
  function resetRound(): void {
    resetRocket(rocket);
    resetWorld(world);
    resetCrash(crash);
    resetFeed(feed);
    outcome = null;
    secured = null;
    event = null;
    holding = false;
    freeze = slow = 0;
    dipTimer = 0;
    susGained = 0;
    flatSeen = false;
    clapped = moonedHeard = rugHeard = ctoHeard = laughed = false;
    confetti = [];
    settleSpring(dip, 0);
  }

  /** The burst over the badge as you bail. */
  function celebrate(): void {
    const rng = mulberry32(0xcafe);
    for (let i = 0; i < 36; i += 1) confetti.push({ x: W / 2 + (rng() - 0.5) * 40, y: 96, vx: (rng() - 0.5) * 360, vy: -120 - rng() * 220, age: 0, life: 1 + rng() * 0.8, colour: ['#8ff0ff', '#c9f76b', '#ffffff', '#ffe27a'][i % 4]!, size: 2.5 + rng() * 3.5 });
  }

  function setEvent(text: string, seconds: number): void {
    event = text;
    eventTimer = seconds;
  }

  function notice(text: string, seconds: number, sus: number, fx: Parameters<typeof audio.fx>[0], strength = 0.7): void {
    setEvent(text, seconds);
    susGained = Math.min(100, susGained + sus);
    audio.fx(fx, strength);
  }

  function drawWorld(r: Renderer, view: SceneView, m: number, tension: number, labels: Label[], dt: number): void {
    const flash = crashFlash(crash) * (reduced ? 0.35 : 1);
    if (outside(crash)) {
      const cam = studioCamera(crash);
      lookAt(viewMatrix, cam.eye, cam.target, [0, 1, 0]);
      const fov = (52 * Math.PI) / 180;
      perspective(projMatrix, fov, W / H, 0.1, 300);
      r.begin(viewMatrix, projMatrix, cam.eye, studioEnvironment(flash), time, fov);
      r.drawSky({ space: 0, studio: 1 });
      drawStudio(crash, r, time, labels, reduced);
      r.end();
      return;
    }
    // The camera: an orbit round the rocket on the pad while the round loads, a chase cam once it flies.
    const racing = view.phase === 'running' || crash.active;
    const elapsed = view.elapsed / 1000;
    stepSpring(orbit, racing ? 0 : 1, 3, 1, dt);
    stepSpring(dip, dipTimer > 0 ? 1 : 0, 2.2, 0.9, dt);
    const centre = cameraCentre(rocket);
    const az = 0.55 * Math.sin(time * 0.23 + 0.6);
    const pitch = -0.12 + 0.62 * dip.x;
    const closeup = elapsed > 45 && !crash.active && !reduced ? Math.pow(Math.max(0, Math.sin((elapsed - 45) * Math.PI / 18)), 4) : 0;
    const dist = 15 + 4.5 * tension - 7 * closeup;
    const chaseEye: Vec3 = [centre[0] + Math.sin(az) * Math.cos(pitch) * dist, centre[1] + Math.sin(pitch) * dist, centre[2] + Math.cos(az) * Math.cos(pitch) * dist];
    const chaseTarget: Vec3 = [centre[0], centre[1] + 2.4 - 8.5 * dip.x, centre[2]];
    const oa = time * 0.22 + 0.4;
    const orbitEye: Vec3 = [Math.sin(oa) * 27, 9.5 + 2 * Math.sin(time * 0.5), Math.cos(oa) * 27];
    const orbitTarget: Vec3 = [0, 8.5, 0];
    let eye = lerp3(chaseEye, orbitEye, orbit.x);
    const target = lerp3(chaseTarget, orbitTarget, orbit.x);
    if (!reduced && crash.active && crash.age > SNAP) {
      const k = Math.max(0, 1 - (crash.age - SNAP) / 0.8);
      eye = add(eye, [Math.sin(time * 91) * 0.3 * k, Math.cos(time * 77) * 0.25 * k, 0]);
    }
    if (!reduced && racing && !crash.active) {
      const k = 0.02 + 0.06 * tension;
      eye = add(eye, [Math.sin(time * 37) * k, Math.cos(time * 29) * k, 0]);
    }
    const forward = normalize(sub(target, eye));
    const roll = reduced ? 0 : (rocket.swayX.v * 0.01 + 0.03 * tension * Math.sin(time * 1.7)) * (1 - orbit.x);
    const up = rotateAbout([0, 1, 0], forward, roll);
    lookAt(viewMatrix, eye, target, up);
    const kick = reduced ? 0 : 10 * Math.max(0, 1 - launchAge / 0.8) + 5 * tension - 8 * clamp(punch.x, 0, 1.2);
    const fov = ((66 + kick) * Math.PI) / 180;
    perspective(projMatrix, fov, W / H, 0.1, 1400);
    const right = normalize(cross(forward, up));
    const cam: Camera = { eye, forward, right, up: cross(right, forward) };
    const eyeAlt = eye[1];
    const env = flightEnvironment(eyeAlt, lastEngine, rocket.thrust, flash);
    r.begin(viewMatrix, projMatrix, eye, env, time, fov);
    r.drawSky({ space: spaceness(eyeAlt), studio: 0 });
    drawGround(r, rocket.alt, time, labels);
    // The moon: far and small on the pad, filling the sky the higher it goes.
    const moonM = view.phase === 'running' ? m : crash.active ? crashX100 / 100 : 1;
    const placement = moonPlacement(centre, moonM);
    drawMoon(world, r, placement, cam, centre, time, labels, reduced);
    const drawn = drawRocket(rocket, r, labels, time, reduced);
    lastEngine = drawn.engine;
    if (drawn.you) labels.push({ text: 'YOU', at: add(drawn.you, [1.7, 0.7, 0]), colour: '#c9f76b', size: orbit.x >= 0.5 ? 24 : 18 });
    drawWires(world, r, drawn.nose, time, labels, reduced);
    drawCameraGags(world, r, cam, time, labels);
    if (flatSeen && rocket.alt > 20 && rocket.alt < 200) labels.push({ text: 'FLAT EARTH', at: [0, 0, 140], colour: '#8ff0ff', size: 22, far: true });
    r.end();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    // Nothing to draw into (a collapsed canvas), and copying a zero-size WebGL frame would throw.
    if (ctx.canvas.width < 1 || ctx.canvas.height < 1) return;
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.2);
    last = now;
    // The hit-stop holds the picture for a few frames as the wire snaps, then it runs slow before time catches up.
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
    const tension = clamp(Math.log2(multiplier) / 4.3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    // The shell keeps the stake and the cash-out through the crash, until the next round's betting.
    const cashed = view.cashoutX100 !== null;
    const ending: Outcome = view.stake === null ? 'ended' : cashed ? 'called' : 'rekt';

    if (previous === null) {
      // The scene's first frame: a page load, or a fresh scene for a round whose betting was never drawn.
      previous = view.phase;
      resetRound();
      if (running || crashed) settleLaunch(view, multiplier);
      if (crashed) {
        outcome = ending;
        crashX100 = view.currentX100;
        startCrash(crash, view.currentX100, cashed, true, { boosters: rocket.boosters.attached, core: rocket.core.attached });
        pop.x = 1;
        clapped = moonedHeard = rugHeard = ctoHeard = laughed = true;
        audio.crash('trombone', true);
      }
    } else if (view.phase !== previous) {
      // Still holding the last round's reveal: this round ran while the tab was hidden.
      if (crashed && holding) resetRound();
      if (crashed && !crash.active) {
        const quiet = view.crashAge > 1500;
        // Settled only for a run that went by out of sight: a 1.00× crash seen live straight from betting plays
        // out from the pad, the wire snapping before the rocket has left it.
        if (previous !== 'running' && quiet) settleLaunch(view, multiplier);
        outcome = ending;
        crashX100 = view.currentX100;
        startCrash(crash, view.currentX100, cashed, quiet, { boosters: rocket.boosters.attached, core: rocket.core.attached });
        post(feed, 'dev', 'lol', 'news');
        if (quiet) { pop.x = 1; clapped = moonedHeard = rugHeard = ctoHeard = laughed = true; }
        audio.crash('trombone', quiet);
      }
      if (view.phase === 'betting') {
        if (crash.active && crash.age < REVEAL_HOLD) holding = true;
        else resetRound();
      }
      if (running) {
        if (holding) resetRound();
        launchAge = 0;
        launchPop.v = 14;
        post(feed, 'dev', 'LIFTOFF. DO NOT SELL', 'news');
        audio.fx('whoosh', 1);
        audio.fx('boom', 0.5);
      }
      previous = view.phase;
    }
    if (holding && crash.age >= REVEAL_HOLD) resetRound();
    // After the resets, so none of them drops this round's cash-out; latched, so the badge stays up through a
    // reveal held into the next round's betting.
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) { audio.cashout(); celebrate(); }
    }
    if (secured && running && rocket.you.mode === 'cling') bailYou(rocket);

    // The wire snaps: the in-flight part of the crash, skipped when the crash was met late.
    stepCrash(crash, dt);
    if (crash.active && !crash.snapped && crash.age >= SNAP) {
      crash.snapped = true;
      snapWires(world);
      killRocket(rocket);
      rumble.twang();
      audio.fx('scream', 0.9);
      if (!reduced) {
        freeze = FREEZE_S;
        slow = SLOW_S;
        punch.v = 8;
      }
    }
    stepRocket(rocket, { racing: running && !crash.active, multiplier, tension, crashed }, dt, reduced);
    stepWorld(world, multiplier, running && !crash.active, dt, reduced);
    for (const e of rocket.events) {
      if (e === 'boosters') { notice('SNIPERS DUMPED', 1.8, 0, 'kaching', 0.8); post(feed, 'dev', 'stage 1 separated (snipers)', 'news'); }
      if (e === 'core') { notice('BUNDLED', 1.5, 0, 'thud', 0.5); post(feed, 'rugdoctor', 'core stage sold · 60% of supply', 'news'); }
      if (e === 'jeets' && rocket.wave > 1) { setEvent('JEETS LET GO', 1.3); post(feed, 'gm_ser', `${Math.round(6 + rocket.wave * 4)} holders let go`, 'leave'); audio.fx('boo', 0.4 + 0.4 * tension); if (rocket.wave > 3 && !reduced) audio.fx('scream', 0.35); }
      if (e === 'bailed') { bailFlash = 1; post(feed, 'you', 'bailed (parachute)', 'news'); audio.fx('zap', 0.8); }
    }
    for (const e of world.events) {
      if (e === 'eyes') { notice('THE MOON BLINKED', 2.2, 10, 'pop', 0.8); post(feed, 'moonboy69', 'did the moon just blink', 'chat'); }
      if (e === 'mic') { notice(world.mic.fired === 1 ? 'IS THAT A BOOM MIC' : 'BOOM MIC AGAIN', 2.4, world.mic.fired === 1 ? 12 : 4, 'creak', 0.8); }
      if (e === 'wires') { notice('WHY IS THERE A WIRE', 2.6, 15, 'creak', 1); post(feed, 'flatearth.sol', 'guys. the wire.', 'chat'); }
      if (e === 'bird') { notice("BIRDS AREN'T REAL", 2.4, world.bird.fired === 1 ? 6 : 2, 'camera', 0.8); }
      if (e === 'glove') { notice('HAND OF DEV', 2.8, 12, 'squeak', 0.9); post(feed, 'nasa_intern', 'that is a hand', 'chat'); }
      if (e === 'wink') audio.fx('ding', 0.8);
    }
    if (running && !crash.active && !flatSeen && multiplier >= FLAT_AT) {
      flatSeen = true;
      dipTimer = 3.2;
      notice('FLAT EARTH CONFIRMED', 3, 12, 'gasp', 0.9);
      post(feed, 'flatearth.sol', 'TOLD YOU', 'news');
    }
    dipTimer = Math.max(0, dipTimer - dt);
    // The studio's beats.
    if (crash.active) {
      if (!laughed && crash.age >= CUT + 0.25) { laughed = true; audio.fx('laugh', 0.8); }
      if (!clapped && crash.age >= CLAP) { clapped = true; audio.fx('punch', 0.9); }
      if (!moonedHeard && crash.age >= MOONED + 0.35) { moonedHeard = true; audio.fx('thud', 1); }
      if (!rugHeard && crash.age >= RUG + 0.2) { rugHeard = true; audio.fx('whoosh', 0.9); audio.fx('engine', 0.4); }
      if (!ctoHeard && crash.age >= CTO + 1.1) { ctoHeard = true; audio.fx('cheer', 0.8); }
    }
    if (stepFeed(feed, running && !secured && !crash.active, tension, dt, multiplier)) audio.fx('notify', 0.6);
    eventTimer = Math.max(0, eventTimer - dt);
    if (eventTimer <= 0) event = null;
    launchAge += dt;
    bailFlash = Math.max(0, bailFlash - dt / 0.5);
    // A tick of the countdown clock while the round loads, and the beat of the climb while it flies.
    const beatWas = Math.floor(beat / (Math.PI * 2));
    beat += dt * (running ? 1.6 + 4 * tension : crashed ? 6 : 1.2);
    if (running && !crash.active && Math.floor(beat / (Math.PI * 2)) !== beatWas && !reduced) audio.fx('tick', 0.25 + 0.4 * tension);
    if (running && !crash.active) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    audio.update(view.phase, secured ? 0.1 : tension);
    rumble.update(rocket.thrust, (running || crash.active) && !outside(crash));
    stepSpring(punch, 0, 9, 0.5, dt);
    for (const k of confetti) { k.age += dt; k.x += k.vx * dt; k.vy += 480 * dt; k.y += k.vy * dt; k.vx *= Math.exp(-dt * 1.2); }
    confetti = confetti.filter((k) => k.age < k.life);
    // The verdict lands as the rocket starts to fall, and gives way to the studio's own beats after the cut.
    stepSpring(pop, outcome && crash.age > SNAP + 0.3 && crash.age < CLAP ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(launchPop, 0, 10, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured, event);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
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
      drawWorld(r, view, multiplier, tension, labels, dt);
      ctx.drawImage(r.canvas, 0, 0, W, H);
    } else {
      drawFallback(ctx, multiplier, running, crash.active ? crash.age : null, time, secured !== null);
    }

    const whiteout = crashFlash(crash) * (reduced ? 0.35 : 1);
    if (whiteout > 0.01) {
      ctx.fillStyle = `rgba(255,252,246,${Math.min(1, whiteout)})`;
      ctx.fillRect(0, 0, W, H);
    }
    const beatGlow = Math.pow(Math.max(0, Math.sin(beat)), 6);
    if (!outside(crash)) drawVignette(ctx, running ? tension : 0, reduced ? 0 : beatGlow);
    if (r) drawLabels(ctx, labels, r.viewProj);
    if (!outside(crash)) drawFeed(ctx, feed);
    if (!outside(crash)) {
      const sus = Math.min(100, susGained + 8 * Math.log2(running ? multiplier : 1));
      drawPanel(ctx, { multiplier: running ? multiplier : outcome ? crashX100 / 100 : 1, crashed: outcome !== null, running, holders: headline(running ? multiplier : 1, outcome !== null) + (running ? aboard(rocket) : 0), fuel: running ? 1 - tension * 0.92 : outcome ? 0 : 1, sus: outcome ? 100 : sus, stage: outcome ? 'STAGE: RUGGED' : stageText(rocket.boosters.attached, rocket.core.attached), time, reduced });
    }
    if (bailFlash > 0.01 && !reduced) {
      ctx.fillStyle = `rgba(201,247,107,${0.3 * bailFlash})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(W / 2, 52);
    const k = 1 + 0.1 * captionPop.x;
    ctx.scale(k, k);
    memeText(ctx, caption, 0, 0, 44, '#ffffff', 'center', 470);
    ctx.restore();
    if (view.phase === 'betting' && !outcome) memeText(ctx, "MOM'S BACKYARD SPACEPORT · $MOONBOYS", W / 2, 82, 18, '#ffd0dc', 'center');
    if (launchAge < 1.6 && running && !reduced) {
      ctx.save();
      ctx.globalAlpha = clamp((1.6 - launchAge) / 0.4, 0, 1);
      ctx.translate(W / 2, H / 2 + 20);
      const s = 1 + 0.15 * launchPop.x;
      ctx.scale(s, s);
      memeText(ctx, 'LIFTOFF', 0, 0, 72, '#ffffff', 'center');
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× BAILED`;
      ctx.save();
      // Below the caption in flight; along the bottom once the reveal's verdict fills the top.
      ctx.translate(W / 2, (outside(crash) ? H - 62 : 98) + Math.sin(time * 2) * 3);
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
      memeText(ctx, text, 0, 0, 84, colour, 'center', 900);
      ctx.restore();
    }
    if (outside(crash)) {
      // One beat at a time: the clapper, the moon's back, the rug, the takeover.
      let beat: [string, string, number] | null = null;
      let sub: string | null = null;
      if (ctoUp(crash)) { beat = ['COMMUNITY TAKEOVER', '#86efac', 50]; sub = 'THE MOON IS OURS NOW'; }
      else if (rugPulled(crash)) { beat = ['RUG PULLED', '#ff4d6d', 60]; sub = 'DEV LEFT WITH THE BAG (AND THE EARTH)'; }
      else if (mooned(crash)) { beat = ['YOU GOT MOONED', '#ffb3c1', 54]; sub = 'PROP #69 · THIS SIDE DOWN'; }
      else if (crash.age >= CLAP) { beat = ['CUT!', '#ffffff', 66]; sub = 'THAT’S A WRAP, MOONBOYS'; }
      if (beat) {
        ctx.save();
        ctx.translate(W / 2, 150);
        ctx.rotate(-0.05);
        memeText(ctx, beat[0], 0, 0, beat[2], beat[1], 'center', 880);
        ctx.restore();
      }
      if (sub) memeText(ctx, sub, W / 2, 186, 22, '#eef1ff', 'center', 880);
    }

    const settled = outcome !== null;
    const colour = settled ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !settled) ctx.globalAlpha = 0.85;
    memeText(ctx, `${(settled ? crashX100 / 100 : multiplier).toFixed(2)}×`, W - 18, H - 18, 52, colour, 'right');
    ctx.restore();
    if (!outside(crash)) {
      memeText(ctx, `HOLDERS ABOARD ${grouped(headline(running ? multiplier : 1, settled) + (running ? aboard(rocket) : 0))}`, 18, H - 18, 22, settled ? '#ff9db0' : '#eef1ff', 'left');
      const km = settled ? 0 : moonKm(running ? multiplier : 1);
      memeText(ctx, settled ? 'MOON IN 0 km · IT WAS PLYWOOD' : `MOON IN ${grouped(km)} km`, 18, H - 46, 15, '#ffd0dc', 'left');
      const nextWave = WAVES.find((w) => w > multiplier);
      if (running && nextWave !== undefined && !secured) memeText(ctx, `NEXT JEET WAVE ${nextWave.toFixed(1)}×`, 18, H - 68, 13, '#c9d2e6', 'left');
    } else {
      memeText(ctx, 'STAGE 69 · SOMEWHERE IN A DESERT', 18, H - 18, 20, '#ffd0dc', 'left');
    }
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
