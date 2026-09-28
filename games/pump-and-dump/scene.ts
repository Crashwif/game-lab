/**
 * Composes Pump & Dump from the room state: the gym, the crowd, the bench
 * and everyone on or around it, the chalk, then the HUD. All motion is
 * stepped here with the real frame time, and nothing drawn here changes
 * the committed outcome.
 */
import { type Bench, PLATE_AT, benchHead, createBench, drawBench, dumpBar, rackBar, resetBench, settleBench, stepBench } from './bench';
import { type Gym, INK, createGym, drawGymBack, drawGymCrowd, drawGymFloor, drawPhoneOverlay, drawPuffs, finishGym, heckle, puff, resetGym, stepGym } from './gym';
import { clamp, spring, stepSpring } from './motion';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a drop missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'dumped';
type Secured = { x100: number; payout: number | null };
const HECKLES = ['GYATT', 'OILED UP', 'SHEEEESH', "HE'S HIM", 'LIGHT WEIGHT', 'BUILT DIFFERENT', 'GO BRO'];

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'SPOTTER SOLD' : outcome === 'called' ? 'CALLED IT' : 'NO SPOTTER NGMI';
  if (view.phase !== 'running') return 'LOAD THE BAR';
  if (secured) return 'RE-RACKED';
  if (multiplier < 1.4) return 'PUMP IT';
  if (multiplier < 1.9) return 'ONE MORE REP';
  if (multiplier < 2.6) return 'NUMBER GO UP';
  if (multiplier < 3.5) return 'NO PAIN NO GAINZ';
  if (multiplier < 5) return 'HODL';
  if (multiplier < 7.5) return 'LIGHT WEIGHT BABY';
  if (multiplier < 12) return 'DIAMOND HANDS';
  if (multiplier < 20) return 'GYATT';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const gym: Gym = createGym();
  const bench: Bench = createBench();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let heckleAt = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const tension = clamp(growth / 3.3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };

    if (previous === null) {
      previous = view.phase;
      resetGym(gym);
      resetBench(bench);
      if (running || crashed) settleBench(bench, multiplier);
      if (crashed) {
        outcome = 'dumped';
        dumpBar(bench, view.currentX100, true);
        finishGym(gym, false, true);
        pop.x = 1;
      }
    } else if (view.phase !== previous) {
      if (crashed && !bench.dumped) {
        const quiet = view.crashAge > 1500;
        outcome = view.stake === null ? 'dumped' : secured ? 'called' : 'rekt';
        dumpBar(bench, view.currentX100, quiet);
        finishGym(gym, outcome === 'called', quiet);
        if (quiet) pop.x = 1;
        else { shake = 1; pop.v = 16; puff(gym, { x: 480, y: 420 }, 14, '#ffffff', 3); }
      }
      if (view.phase === 'betting') {
        resetGym(gym);
        resetBench(bench);
        outcome = null;
        secured = null;
        heckleAt = 0;
      }
      previous = view.phase;
    }
    if (secured && running) rackBar(bench);

    stepBench(bench, { running, multiplier, growth, tension }, dt);
    stepGym(gym, { running, tension, multiplier, growth, elapsed: view.elapsed, cracks: 0 }, dt);
    if (bench.events.plate) { heckle(gym, HECKLES[bench.nextPlate % HECKLES.length]!, bench.nextPlate % 3 === 0); if (!reduced) shake = Math.max(shake, 0.2); }
    if (bench.events.rep && running && !reduced) shake = Math.max(shake, 0.05 + 0.2 * tension);
    if (bench.events.racked) { puff(gym, { x: 480, y: 380 }, 16, '#ffffff', 1); heckle(gym, 'GYATT', true); }
    if (bench.events.swapped) puff(gym, { x: 480, y: 400 }, 16, '#ffffff', 2);
    if (running && tension > 0.5 && time > heckleAt) { heckleAt = time + 3.5; heckle(gym, HECKLES[Math.floor(time * 1.3) % HECKLES.length]!, false); }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 7 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    drawGymBack(ctx, gym, outcome !== null);
    drawGymCrowd(ctx, gym, outcome === 'called');
    drawGymFloor(ctx);
    drawBench(ctx, bench);
    drawPuffs(ctx, gym);
    if (outcome && pop.x > 0.02) {
      const head = benchHead();
      ctx.save();
      ctx.translate(head.x, head.y - 60);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'LIGHT WEIGHT' : 'DUMPED';
      memeText(ctx, text, 0, 0, outcome === 'called' ? 72 : 96, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    drawPhoneOverlay(ctx, gym, !outcome);

    if (caption) {
      ctx.save();
      ctx.translate(430, 78);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 44, '#ffffff', 'center', 600);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(480, 514 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    memeText(ctx, `${multiplier.toFixed(2)}×`, 24, 514, 56, colour, 'left');
    ctx.restore();
    const plates = Math.min(PLATE_AT.length, bench.nextPlate);
    memeText(ctx, `${Math.round(45 + multiplier * 100)} LBS · ${plates * 2} PLATES`, 936, 514, 24, outcome ? '#ff9db0' : '#e7f4f0', 'right');
  }

  return { draw };
}
