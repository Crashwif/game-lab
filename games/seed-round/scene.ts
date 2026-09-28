/**
 * Composes Seed Round from the room state: the tunnel, the egg, the race and
 * the crash in WebGL2, copied into the visible canvas, then the HUD in
 * Canvas 2D. All motion is stepped here with the real frame time, and nothing
 * drawn here changes the committed outcome.
 */
import { IMPACT, PULL, crashFlash, createCrash, drawOutside, drawWall, outside, outsideCamera, outsideEnvironment, pullBack, resetCrash, rugPulled, startCrash, stepCrash } from './crash';
import { createFeed, drawFeed, post, resetFeed, stepFeed } from './feed';
import { drawFallback } from './fallback';
import { putInstance } from './gl';
import { H, W, drawCard, drawLabels, drawVignette, grouped, memeText } from './hud';
import { type Vec3, add, basisFrom, lerp3, lookAt, madd, mat4, normalize, perspective, rotateAbout, sub } from './math3d';
import { clamp, settleSpring, spring, stepSpring } from './motion';
import { EGG_FAR, type Label, WAVES, bankYou, createPack, drawPack, eggDistance, headline, pilePack, resetPack, settlePack, stepPack } from './pack';
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
/** Seconds of the crash that play out even when the next round's betting opens sooner (the emulator waits 2 s). */
const REVEAL_HOLD = 5.6;

function captionFor(view: SceneView, m: number, outcome: Outcome | null, secured: Secured | null, event: string | null): string {
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'FROZEN ASSETS' : 'FUNDS ARE SAFU';
  if (view.phase === 'betting') return 'LOADING…';
  if (view.phase !== 'running') return 'GM DEGENS';
  if (secured) return 'FROZEN ASSETS';
  if (event) return event;
  if (m < 1.3) return 'FAIR LAUNCH';
  if (m < 1.8) return 'SWIM FASTER';
  if (m < 2.4) return 'NUMBER GO UP';
  if (m < 3.3) return 'HODL';
  if (m < 4.6) return 'DIAMOND TAILS';
  if (m < 6.9) return 'KING OF THE HILL';
  if (m < 7.3) return 'NICE';
  if (m < 10) return 'WEN EGG';
  return 'THIS IS FINE';
}

function popFor(outcome: Outcome, crashX100: number): [string, string] {
  if (outcome === 'called') return ['CALLED IT', '#8ff0ff'];
  if (crashX100 < 105) return ['PREMATURE', '#ff4d6d'];
  return outcome === 'rekt' ? ['RUGGED', '#ff4d6d'] : ['PULLED OUT', '#ffe27a'];
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
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
  let frost = 0;
  let crashX100 = 100;
  /** The next round's betting opened while the reveal was still playing; it finishes first. */
  let holding = false;

  /** Settles the race for a round met mid-run or after the crash, instead of playing out what came before. */
  function settleRace(view: SceneView, m: number): void {
    settlePack(pack, m, view.phase === 'running' ? view.elapsed / 1000 : undefined);
    settleSpring(orbit, 0);
    if (view.cashoutX100 !== null) {
      // Already in the sperm bank: no swerve and no frost, and the badge is up.
      pack.you.mode = 'banked';
      settleSpring(badge, 1);
    }
  }

  /** Back to the start line for a new round. */
  function resetRound(): void {
    resetPack(pack);
    resetCrash(crash);
    resetFeed(feed);
    outcome = null;
    secured = null;
    event = null;
    holding = false;
  }

  function setEvent(text: string, seconds: number): void {
    event = text;
    eventTimer = seconds;
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

  function drawWorld(r: Renderer, view: SceneView, m: number, tension: number, labels: Label[], dt: number): void {
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
    const followX = pack.you.mode === 'race' ? pack.you.x : 0;
    const followY = pack.you.mode === 'race' ? pack.you.y : -0.3;
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
    const orbitEye = add(youPos, add(add([f.side[0] * Math.sin(a) * 2.9, f.side[1] * Math.sin(a) * 2.9, f.side[2] * Math.sin(a) * 2.9], [f.up[0] * 0.65, f.up[1] * 0.65, f.up[2] * 0.65]), [f.tangent[0] * Math.cos(a) * 2.9, f.tangent[1] * Math.cos(a) * 2.9, f.tangent[2] * Math.cos(a) * 2.9]));
    const orbitTarget = madd(youPos, f.tangent, -0.35);
    let eye = lerp3(chaseEye, orbitEye, orbit.x);
    const target = lerp3(chaseTarget, orbitTarget, orbit.x);
    if (!reduced && crash.active && crash.age > IMPACT) {
      const k = Math.max(0, 1 - (crash.age - IMPACT) / 0.7);
      eye = add(eye, [Math.sin(time * 91) * 0.25 * k, Math.cos(time * 77) * 0.2 * k, 0]);
    }
    const forward = normalize(sub(target, eye));
    const roll = reduced ? 0 : 0.05 * Math.sin(time * 0.4) + 0.08 * tension * Math.sin(time * 1.9);
    lookAt(viewMatrix, eye, target, rotateAbout(frameAt(eyeS).up, forward, roll));
    const kick = reduced ? 0 : 10 * Math.max(0, 1 - launchAge / 0.8) + 6 * tension;
    perspective(projMatrix, ((62 + kick) * Math.PI) / 180, W / H, 0.05, 420);

    // The egg: far and small at 1×, filling the bore the higher it goes.
    const eggM = view.phase === 'running' ? m : crash.active ? crashX100 / 100 : 1;
    const distance = eggDistance(eggM);
    const near = Math.min(distance, EGG_FAR);
    const eggS = pack.anchor + near;
    const eggScale = (EGG_RADIUS * near) / distance;
    const fe = frameAt(eggS);
    const closeness = clamp(1 - (distance - 16) / 240, 0, 1);
    const env = tunnelEnvironment(tension, fe.point, closeness, eye);
    r.begin(viewMatrix, projMatrix, eye, env, time);
    const flash = crashFlash(crash) * (reduced ? 0.35 : 1) + (reduced ? 0 : 0.45 * Math.max(0, 1 - launchAge / 0.35));
    r.drawTunnel({ s0: Math.floor((eyeS - 14) / RING_SPACING) * RING_SPACING, pulse: reduced ? 0.1 : 0.35 + 0.65 * tension, beat, bulgeS: eggS, bulge: 1, flash, heat: tension * 0.5 });
    const [ex, ey, ez] = basisFrom(rotateAbout(fe.tangent, fe.up, time * 0.12), fe.up);
    putInstance(r.meshes.sphere, 0, fe.point, ex, ey, ez, [eggScale, eggScale, eggScale], [1, 1, 1, 1], [0, 0, -1, 0], [1, 0, 0, 0]);
    r.drawLit(r.meshes.sphere, 1);
    const drawn = drawPack(pack, r, eye, reduced);
    labels.push(...pack.labels);
    if (drawn.you) labels.push({ text: 'YOU', at: drawn.you, colour: '#d5fb6d', size: orbit.x >= 0.5 ? 26 : 20 });
    r.sprite(fe.point, eggScale * 2.6, [1, 0.78, 0.84, 0.36 + 0.2 * closeness], 2);
    r.sprite(fe.point, eggScale * 1.4, [1, 0.92, 0.82, 0.22], 1);
    r.flushSprites('additive', env.fogDensity * 0.25);
    labels.push({ text: 'THE MOON', at: madd(fe.point, fe.up, eggScale + 1.4), colour: '#ffe27a', size: 20, far: true });
    drawWall(crash, r);
    r.end();
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    // Nothing to draw into (a collapsed canvas), and copying a zero-size WebGL frame would throw.
    if (ctx.canvas.width < 1 || ctx.canvas.height < 1) return;
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.2);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = clamp(Math.log2(multiplier) / 3.5, 0, 1);
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
      if (running || crashed) settleRace(view, multiplier);
      if (crashed) {
        outcome = ending;
        crashX100 = view.currentX100;
        startCrash(crash, pack.anchor + pilePack(pack), view.currentX100, cashed, true);
        pop.x = 1;
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
        if (quiet) pop.x = 1;
      }
      if (view.phase === 'betting') {
        if (crash.active && crash.age < REVEAL_HOLD) holding = true;
        else resetRound();
      }
      if (running) {
        if (holding) resetRound();
        launchAge = 0;
        launchPop.v = 14;
        post(feed, 'DEV BOUGHT 69.00 SOL', 'news');
      }
      previous = view.phase;
    }
    if (holding && crash.age >= REVEAL_HOLD) resetRound();
    // After the resets, so none of them drops this round's cash-out; latched, so the badge stays up through a
    // reveal held into the next round's betting.
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
    if (secured && running && pack.you.mode === 'race') bankYou(pack);

    stepPack(pack, { racing: running, multiplier, tension, crashed }, dt);
    stepCrash(crash, dt);
    stepFeed(feed, running && !secured, tension, dt);
    for (const e of pack.events) {
      if (e === 'jeets' && pack.wave > 1) { setEvent('JEETS OUT', 1.4); post(feed, `${8 + pack.wave * 3} JEETS SOLD`, 'news'); }
      if (e === 'snipers') { setEvent('SNIPERS DUMPED', 1.8); post(feed, 'SNIPER BOTS SOLD 12.40 SOL', 'news'); }
      if (e === 'sec') { setEvent('SEC IS HERE', 2.2); post(feed, 'SEC FROZE 3 WALLETS', 'news'); }
      if (e === 'whale') { setEvent('WHALE ALERT', 2.8); post(feed, 'WHALE BOUGHT 420.69 SOL', 'news'); }
      if (e === 'banked') { frost = 1; post(feed, 'YOU SOLD · BANKED', 'news'); }
    }
    eventTimer = Math.max(0, eventTimer - dt);
    if (eventTimer <= 0) event = null;
    launchAge += dt;
    frost = Math.max(0, frost - dt / 0.6);
    beat += dt * (running ? 2.4 + 5.5 * tension : crashed ? 9 : 1.6);
    // The SAFU print is the impact's punchline; the verdict lands with the pull-out.
    stepSpring(pop, outcome && crash.age > PULL ? 1 : 0, 16, 0.45, dt);
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
      ctx.fillStyle = `rgba(255,250,252,${Math.min(1, whiteout)})`;
      ctx.fillRect(0, 0, W, H);
    }
    const beatGlow = Math.pow(Math.max(0, Math.sin(beat)), 6);
    if (!outside(crash)) drawVignette(ctx, running ? tension : 0, reduced ? 0 : beatGlow);
    if (r) drawLabels(ctx, labels, r.viewProj);
    if (!outside(crash)) drawFeed(ctx, feed);
    if (!outside(crash)) drawCard(ctx, { multiplier: running ? multiplier : outcome ? crashX100 / 100 : 1, crashed: outcome !== null, king: running && pack.you.mode === 'race' && multiplier >= WAVES[5]!, replies: Math.floor(12 + 40 * Math.pow(Math.max(0, multiplier - 1), 1.3)) });
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
    memeText(ctx, `${(settled ? crashX100 / 100 : multiplier).toFixed(2)}×`, W - 18, H - 18, 52, colour, 'right');
    ctx.restore();
    memeText(ctx, `SWIMMERS LEFT ${grouped(headline(running ? multiplier : 1, settled))}`, 18, H - 18, 22, settled ? '#ff9db0' : '#f6e9ee', 'left');
    const microns = Math.round(eggDistance(running ? multiplier : 1) * 160);
    if (!settled) memeText(ctx, `EGG IN ${grouped(microns)} µm`, 18, H - 46, 15, '#ffd0dc', 'left');
    const nextWave = WAVES.find((w) => w > multiplier);
    if (running && nextWave !== undefined && !secured) memeText(ctx, `NEXT JEET WAVE ${nextWave.toFixed(1)}×`, 18, H - 68, 13, '#c9b3bd', 'left');
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
