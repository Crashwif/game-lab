/**
 * Composes Thin Ice from the room state: the winter sky and aurora, the far
 * shore, the scrolling lake with its cracks and trails, the skater and her
 * reflection, the shatter, then the HUD. All motion is stepped here with the
 * real frame time, and nothing drawn here changes the committed outcome.
 */
import { FORESHORTEN, ICE_FAR_Y, type IceState, type Point, addTrail, createIce, drawBagholders, drawCracks, drawIce, drawShatter, drawThinning, resetIce, shatterIce, spawnCrack, stepIce } from './ice';
import { clamp, noise, settleSpring, spring, stepSpring } from './motion';
import { type SkaterDrive, type SkaterState, createSkater, drawSkater, footScreen, headForShore, iceBroke, iceScale, iceY, resetSkater, settleSkater, stepScarf, stepSkater } from './skater';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a break missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake and twinkle. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const H = 540;
const SKATER_SCREEN_X = 330;
const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The widest the multiplier readout grows: a huge number narrows rather than running into the caption. */
const READOUT_MAX_WIDTH = 300;
/** Clear space the caption keeps from the readout on its right and from the edge on its left. */
const HUD_GAP = 24;
/** How far past the spot where she climbs out the exit sign stands, in world px. */
const EXIT_AHEAD = 66;
type Outcome = 'rekt' | 'called' | 'crack';
type Secured = { x100: number; payout: number | null };
type Flake = { x: number; y: number; r: number; k: number };
interface Particle { kind: 'spray' | 'breath' | 'splash' | 'bubble'; x: number; y: number; vx: number; vy: number; r: number; age: number; life: number }

/** The width of the black border memeText strokes round lettering of this size; half of it shows outside the glyphs. */
const border = (size: number): number => Math.max(3, size * 0.13);

/** Meme caption lettering: heavy, white, black-bordered. */
function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = border(size);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'LIQUIDATED' : outcome === 'called' ? 'CLOSED THE LONG' : 'ANOTHER ONE FOR THE ICE';
  if (view.phase !== 'running') return 'WEN LEVERAGE?';
  if (secured) return 'DEAL WITH IT';
  if (multiplier < 1.3) return 'SKATING ON 100X';
  if (multiplier < 1.7) return 'LIQUIDITY IS THIN';
  if (multiplier < 2.5) return 'MARGIN IS VIBES';
  if (multiplier < 4) return 'THINNER THAN MY MARGIN';
  if (multiplier < 7) return 'FROZEN ASSETS BELOW';
  if (multiplier < 12) return 'LIQUIDATION PRICE: HERE';
  if (multiplier < 25) return 'ADDING MORE LEVERAGE';
  return 'SHE IS UNLIQUIDATABLE';
}

function drawSky(ctx: CanvasRenderingContext2D, time: number, stars: Flake[], reduced: boolean): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ICE_FAR_Y);
  sky.addColorStop(0, '#0b1a3a');
  sky.addColorStop(0.55, '#24406f');
  sky.addColorStop(1, '#7d9cc7');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, ICE_FAR_Y);
  ctx.fillStyle = '#ffffff';
  for (const [i, s] of stars.entries()) {
    ctx.globalAlpha = reduced ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.k + i));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Aurora: three ribbons that drift and breathe.
  for (const [k, colour] of [[0, '80, 230, 160'], [1, '120, 200, 255'], [2, '190, 120, 255']] as const) {
    const base = 40 + k * 32;
    const band = ctx.createLinearGradient(0, base - 20, 0, base + 70);
    band.addColorStop(0, `rgba(${colour}, 0)`);
    band.addColorStop(0.4, `rgba(${colour}, ${0.22 + 0.08 * Math.sin(time * 0.5 + k)})`);
    band.addColorStop(1, `rgba(${colour}, 0)`);
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.moveTo(-20, base - 20);
    for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, base - 20 + Math.sin(x / 140 + time * 0.3 + k * 1.7) * 26 + Math.sin(x / 55 - time * 0.2) * 8);
    for (let x = W + 20; x >= -20; x -= 20) ctx.lineTo(x, base + 70 + Math.sin(x / 140 + time * 0.3 + k * 1.7) * 26 + Math.sin(x / 55 - time * 0.2) * 8);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(830, 68, 20, 830, 68, 90);
  glow.addColorStop(0, 'rgba(255, 244, 214, 0.35)');
  glow.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(830, 68, 90, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f7f0d8';
  ctx.beginPath(); ctx.arc(830, 68, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e4dabd';
  for (const [dx, dy, r] of [[-8, -6, 5], [9, 7, 4], [4, -11, 2.5]] as const) { ctx.beginPath(); ctx.arc(830 + dx, 68 + dy, r, 0, Math.PI * 2); ctx.fill(); }
}

function drawMountains(ctx: CanvasRenderingContext2D, cameraX: number): void {
  for (const [parallax, colour, base, amp, seed] of [[0.06, '#2a4474', 140, 60, 1], [0.12, '#35548b', 168, 42, 7]] as const) {
    const shift = cameraX * parallax;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-40, ICE_FAR_Y);
    for (let x = -40; x <= W + 40; x += 30) {
      const wx = x + shift;
      const i = Math.floor(wx / 90);
      const t = (wx - i * 90) / 90;
      const h0 = noise(i * 3.7 + seed) * amp;
      const h1 = noise((i + 1) * 3.7 + seed) * amp;
      const peak = Math.abs(t - 0.5) < 0.5 ? (h0 + (h1 - h0) * t) : h0;
      ctx.lineTo(x, base + amp - peak - Math.abs(Math.sin(t * Math.PI)) * amp * 0.5);
    }
    ctx.lineTo(W + 40, ICE_FAR_Y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShore(ctx: CanvasRenderingContext2D, cameraX: number): void {
  const shift = cameraX * 0.3;
  ctx.fillStyle = '#eef4fa';
  ctx.beginPath();
  ctx.moveTo(-20, 212);
  for (let x = -20; x <= W + 20; x += 40) ctx.lineTo(x, 206 + Math.sin((x + shift) / 120) * 4 + noise(Math.floor((x + shift) / 40)) * 4);
  ctx.lineTo(W + 20, ICE_FAR_Y + 2);
  ctx.lineTo(-20, ICE_FAR_Y + 2);
  ctx.closePath();
  ctx.fill();
  // Trees repeat along the whole shore: pick the indices that fall on screen for this scroll.
  const first = Math.floor(shift / 78) - 2;
  for (let i = first; i < first + 16; i += 1) {
    const wx = i * 78 + noise(i * 2.9) * 40;
    const sx = wx - shift;
    if (sx < -60 || sx > W + 60) continue;
    const size = 26 + noise(i * 1.7) * 30;
    const baseY = 214 + noise(i * 4.3) * 12;
    ctx.fillStyle = '#1f4d3a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (let tier = 0; tier < 3; tier += 1) {
      const ty = baseY - tier * size * 0.32;
      const tw = size * (0.55 - tier * 0.13);
      ctx.beginPath(); ctx.moveTo(sx - tw, ty); ctx.lineTo(sx, ty - size * 0.5); ctx.lineTo(sx + tw, ty); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#f4f8fc';
    ctx.beginPath(); ctx.moveTo(sx - size * 0.16, baseY - size * 0.64 - size * 0.42); ctx.lineTo(sx, baseY - size * 0.64 - size * 0.5); ctx.lineTo(sx + size * 0.16, baseY - size * 0.64 - size * 0.42); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(60, 90, 130, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, ICE_FAR_Y + 1); ctx.lineTo(W, ICE_FAR_Y + 1); ctx.stroke();
}

/** The signpost where she climbs out, at the far shore's scale; `pop` springs it up out of the snow. */
function drawExitSign(ctx: CanvasRenderingContext2D, x: number, pop: number): void {
  ctx.save();
  ctx.translate(x, ICE_FAR_Y - 4);
  ctx.rotate(-0.05);
  ctx.scale(0.58 * pop, 0.58 * pop);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -58); ctx.stroke();
  ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 5; ctx.stroke();
  // An arrow-cut plank, pointing on along the shore.
  ctx.fillStyle = '#9c6b3a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-46, -92); ctx.lineTo(40, -92); ctx.lineTo(56, -70); ctx.lineTo(40, -48); ctx.lineTo(-46, -48); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4f8fc';
  ctx.beginPath(); ctx.moveTo(-48, -91); ctx.quadraticCurveTo(-30, -101, -12, -93); ctx.quadraticCurveTo(8, -99, 24, -93); ctx.quadraticCurveTo(34, -97, 41, -91); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff4d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 18px ${MEME_FONT}`;
  ctx.fillText('EXIT', -1, -72, 80);
  ctx.font = `900 16px ${MEME_FONT}`;
  ctx.fillText('LIQUIDITY', -1, -54, 80);
  ctx.restore();
}

/** Where the multiplier readout's lettering starts on the left: it grows leftward from x 930 as the number gets longer. */
function readoutLeft(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = `900 66px ${MEME_FONT}`;
  return 930 - Math.min(READOUT_MAX_WIDTH, ctx.measureText(text).width) - border(66) / 2;
}

function drawReadout(ctx: CanvasRenderingContext2D, view: SceneView, text: string, dead: boolean): void {
  const colour = dead ? '#ff4d6d' : view.phase === 'running' ? '#ffffff' : '#ffe08a';
  ctx.save();
  if (view.phase !== 'running' && !dead) ctx.globalAlpha = 0.85;
  memeText(ctx, text, 930, 80, 66, colour, 'right', READOUT_MAX_WIDTH);
  ctx.restore();
}

/**
 * The caption, centred on x 430 while it fits there. A long multiplier pushes it left to stay clear of the
 * readout, and only once it reaches the left edge does it narrow; `scale` is its pop.
 */
function drawCaption(ctx: CanvasRenderingContext2D, caption: string, scale: number, readoutAt: number): void {
  ctx.font = `900 46px ${MEME_FONT}`;
  const edge = border(46) / 2;
  const right = readoutAt - HUD_GAP;
  const width = Math.min(560, ctx.measureText(caption).width, (right - HUD_GAP) / scale - 2 * edge);
  ctx.save();
  ctx.translate(Math.min(430, right - scale * (width / 2 + edge)), 68);
  ctx.scale(scale, scale);
  memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', width);
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const ice: IceState = createIce();
  const skater: SkaterState = createSkater();
  const camera = spring(-SKATER_SCREEN_X);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const exitSign = spring(0);
  const stars: Flake[] = Array.from({ length: 60 }, (_, i) => ({ x: noise(i * 3.1) * W, y: 6 + noise(i * 7.7) * 150, r: 0.6 + noise(i * 1.3) * 1.4, k: 1 + noise(i * 5.9) * 2 }));
  const flakes: Flake[] = Array.from({ length: 90 }, (_, i) => ({ x: noise(i * 2.3) * W, y: noise(i * 4.1) * H, r: 1 + noise(i * 6.7) * 2, k: 0.5 + noise(i * 8.9) }));
  let particles: Particle[] = [];
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let breathClock = 0;
  /** World x of the exit sign, set where she climbs onto the bank. */
  let exitAt: number | null = null;

  function emit(p: Particle): void {
    if (particles.length > 500) particles.shift();
    particles.push(p);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const fear = clamp((growth - 0.35) / 2.8, 0, 1);
    const tension = clamp(growth / 3.3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
    const drive: SkaterDrive = { speed: running ? 120 + 220 * (1 - Math.exp(-growth / 2)) : 0, strideRate: 0.7 + 1.1 * (1 - Math.exp(-growth / 2)), fear };

    // Phase edges: joining late, the break, and a fresh lake for the next round.
    if (previous === null) {
      // A round met part-way through settles into place: out on the ice, or already on the bank once her exit
      // was accepted. One met after the crash then breaks through the same edge as a watched one, which keeps
      // an old crash quiet and takes the outcome from the player's bet.
      const live = running || crashed;
      settleSkater(skater, live, live && secured !== null, drive);
      // The camera is a critically damped spring at ω 3, so it trails a skater at speed v by 2v/3: start it there.
      camera.x = skater.x - SKATER_SCREEN_X - (skater.speed * 2) / 3;
      camera.v = skater.speed;
      if (secured) settleSpring(badge, 1);
      if (skater.mode === 'shore') {
        exitAt = skater.x + EXIT_AHEAD;
        settleSpring(exitSign, 1);
      }
      previous = crashed ? 'running' : view.phase;
    }
    if (view.phase !== previous) {
      if (crashed && !ice.shattered) {
        const quiet = view.crashAge > 1500;
        // An exit accepted while no running frame was drawn (a hidden tab) still gets her off the ice.
        if (secured) headForShore(skater);
        const onIce = skater.mode === 'skating' || skater.mode === 'idle' || (skater.mode === 'toShore' && skater.depth.x < 0.95);
        const at: Point = onIce ? { x: skater.x, y: iceY(skater.depth.x) } : skater.lastIce;
        shatterIce(ice, at.x, at.y, view.currentX100, quiet);
        outcome = view.stake === null ? 'crack' : secured ? 'called' : 'rekt';
        iceBroke(skater);
        if (quiet) {
          pop.x = 1;
          if (skater.mode === 'plunge') { skater.mode = 'swimming'; skater.plunge = 58; }
          if (skater.mode === 'shore' && exitAt === null) {
            exitAt = skater.x + EXIT_AHEAD;
            settleSpring(exitSign, 1);
          }
        } else {
          shake = 1;
          pop.v = 16;
          if (skater.mode === 'plunge') {
            for (let i = 0; i < 26; i += 1) {
              const a = -Math.PI * (0.2 + noise(i * 1.7) * 0.6);
              const s = 120 + noise(i * 2.3) * 260;
              emit({ kind: 'splash', x: at.x + (noise(i * 3.1) - 0.5) * 40, y: at.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 2 + noise(i * 4.7) * 3, age: 0, life: 0.7 + noise(i) * 0.4 });
            }
          }
        }
      }
      if (view.phase === 'betting') {
        resetIce(ice);
        resetSkater(skater);
        particles = [];
        outcome = null;
        secured = null;
        exitAt = null;
        settleSpring(exitSign, 0);
      }
      if (view.phase === 'running' && skater.mode === 'idle') skater.mode = 'skating';
      previous = view.phase;
    }
    if (secured && running && (skater.mode === 'skating' || skater.mode === 'idle')) headForShore(skater);

    stepSkater(skater, drive, dt);
    if (skater.mode === 'shore' && exitAt === null) exitAt = skater.x + EXIT_AHEAD;
    stepSpring(exitSign, exitAt === null ? 0 : 1, 12, 0.45, dt);
    stepSpring(camera, skater.x - SKATER_SCREEN_X, 3, 1, dt);
    const cameraX = camera.x;
    const depth = clamp(skater.depth.x, 0, 1);
    const place = { x: skater.x - cameraX, y: iceY(depth) - (skater.mode === 'shore' ? 6 : 0), scale: iceScale(depth) };
    const onIce = skater.mode === 'skating' || skater.mode === 'idle' || (skater.mode === 'toShore' && depth < 0.95);

    // Trails, spray and breath.
    if (onIce && skater.speed > 20) {
      for (const which of [0, 1] as const) {
        const foot = footScreen(skater, which, place.x, place.y, place.scale);
        if (foot.onIce) addTrail(ice, which, { x: foot.x + cameraX, y: foot.y });
      }
    }
    if (skater.events.push >= 0 && onIce && skater.speed > 40) {
      const foot = footScreen(skater, skater.events.push as 0 | 1, place.x, place.y, place.scale);
      for (let i = 0; i < 7; i += 1) {
        emit({ kind: 'spray', x: foot.x + cameraX, y: foot.y, vx: -60 - noise(time * 7 + i) * 140, vy: -40 - noise(time * 11 + i) * 90, r: 1.2 + noise(time * 13 + i) * 1.6, age: 0, life: 0.45 + noise(i) * 0.3 });
      }
    }
    breathClock += dt;
    if (skater.mode === 'idle' && breathClock > 2.6) {
      breathClock = 0;
      emit({ kind: 'breath', x: skater.x + 14 * place.scale, y: place.y - 62 * place.scale, vx: 12, vy: -8, r: 3, age: 0, life: 1.6 });
    }
    if (skater.mode === 'swimming' && noise(Math.floor(time * 6)) > 0.6 && breathClock > 0.35) {
      breathClock = 0;
      emit({ kind: 'bubble', x: skater.x + (noise(time) - 0.5) * 30, y: place.y + 4, vx: 0, vy: -20, r: 1.5 + noise(time * 3) * 2, age: 0, life: 1.2 });
    }
    for (const p of particles) {
      p.age += dt;
      if (p.kind === 'spray' || p.kind === 'splash') { p.vy += 500 * dt; p.vx *= Math.exp(-1.5 * dt); }
      if (p.kind === 'breath') { p.r += 6 * dt; p.vy -= 4 * dt; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.age < p.life);

    // The ice keeps failing around her, or around where she left it.
    if (running && !ice.shattered) {
      ice.crackClock += dt;
      const interval = 2.4 - 2.0 * tension;
      while (ice.crackClock > interval) {
        ice.crackClock -= interval;
        const at = onIce ? { x: skater.x, y: iceY(depth) } : skater.lastIce;
        const count = 1 + Math.floor(tension * 2);
        for (let i = 0; i < count; i += 1) spawnCrack(ice, at.x + (noise(time * 5 + i) - 0.5) * 70, at.y + (noise(time * 9 + i) - 0.5) * 26, tension, time * 31 + i * 7);
      }
    }
    stepIce(ice, cameraX, dt);

    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 8 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    drawSky(ctx, time, stars, reduced);
    drawMountains(ctx, cameraX);
    drawShore(ctx, cameraX);
    if (exitAt !== null && exitSign.x > 0.02) drawExitSign(ctx, exitAt - cameraX, clamp(exitSign.x, 0, 1.3));
    drawIce(ctx, ice, cameraX, time);
    drawBagholders(ctx, cameraX);
    const thinAt = onIce ? { x: place.x, y: place.y } : { x: skater.lastIce.x - cameraX, y: skater.lastIce.y };
    if (running && !ice.shattered) drawThinning(ctx, thinAt.x, thinAt.y, tension, time);
    drawCracks(ctx, ice, cameraX);
    // The break stays on the lake even when it happens right by the bank.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, ICE_FAR_Y, W + 40, H - ICE_FAR_Y + 20);
    ctx.clip();
    drawShatter(ctx, ice, cameraX, time);
    ctx.restore();
    // Reflection glides under her while she is on the ice.
    if (onIce) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.translate(0, place.y);
      ctx.scale(1, -0.5);
      ctx.translate(0, -place.y);
      drawSkater(ctx, skater, place, false);
      ctx.restore();
    }
    const inWater = skater.mode === 'plunge' || skater.mode === 'swimming';
    if (inWater) {
      // Only what is above the water line shows; the hole's water is already under her.
      ctx.save();
      ctx.beginPath();
      ctx.rect(-20, -20, W + 40, place.y + 4 * place.scale + 20);
      ctx.clip();
    }
    const neck = drawSkater(ctx, skater, place, true);
    if (inWater) {
      ctx.restore();
      ctx.strokeStyle = 'rgba(200, 225, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(place.x, place.y + 4 * place.scale, 30 * place.scale, 9 * place.scale, 0, 0, Math.PI * 2); ctx.stroke();
    }
    stepScarf(skater, neck, dt);
    for (const p of particles) {
      const k = 1 - p.age / p.life;
      const sx = p.x - cameraX;
      if (p.kind === 'breath') { ctx.globalAlpha = k * 0.45; ctx.fillStyle = '#ffffff'; }
      else if (p.kind === 'bubble') { ctx.globalAlpha = k * 0.8; ctx.fillStyle = '#dff1ff'; }
      else { ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.kind === 'splash' ? '#bfe0ff' : '#ffffff'; }
      ctx.beginPath(); ctx.arc(sx, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Snow in screen space, drifting against the skating direction.
    ctx.fillStyle = '#ffffff';
    for (const f of flakes) {
      const x = (((f.x + time * 12 * f.k - cameraX * 0.05 * f.k) % W) + W) % W;
      const y = (f.y + time * (18 + f.r * 12)) % H;
      ctx.globalAlpha = 0.35 + 0.35 * f.k;
      ctx.beginPath(); ctx.arc(x, y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (outcome && pop.x > 0.02) {
      ctx.save();
      // Above the break when there is room, below it when the break is up by the bank.
      ctx.translate(clamp(ice.shatterAt.x - cameraX, 160, 800), ice.shatterAt.y < 340 ? ice.shatterAt.y + 150 : ice.shatterAt.y - 120);
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, outcome === 'rekt' ? 'REKT' : 'CRACK!', 0, 0, 92, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    // HUD in screen space. The readout is measured first so the caption can keep clear of it.
    const readout = `${multiplier.toFixed(2)}×`;
    if (caption) drawCaption(ctx, caption, 1 + 0.1 * captionPop.x, readoutLeft(ctx, readout));
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(430, 114 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.03);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    drawReadout(ctx, view, readout, outcome !== null);
    memeText(ctx, `${Math.round(skater.x / 10)} M`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    void FORESHORTEN;
  }

  return { draw };
}
