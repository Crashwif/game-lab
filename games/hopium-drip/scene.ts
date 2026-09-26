/**
 * Composes Hopium Drip. The bag, the trace and the notes follow the
 * displayed multiplier. Nothing here chooses the crash.
 */
import { doseCount, drawMonitor } from './monitor';
import { clamp, spring, stepSpring } from './motion';
import { createWard, discharge, drawWard, flatlineWard, resetWard, stepWard, type Ward } from './ward';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean; }
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void; }

const FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };

function meme(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = '#1c1f26';
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'rekt') return 'FLATLINE';
  if (outcome === 'called') return 'DISCHARGED';
  if (outcome === 'spectator') return 'TIME OF DEATH';
  if (view.phase !== 'running') return 'GM PATIENT';
  if (secured) return 'DISCHARGED';
  if (multiplier < 1.4) return 'TAKE YOUR MEDS';
  if (multiplier < 2) return 'NUMBER GO UP';
  if (multiplier < 3.2) return 'ONE MORE DOSE';
  if (multiplier < 5) return 'HODL';
  if (multiplier < 8) return 'DIAMOND HANDS';
  if (multiplier < 12) return 'VITALS UNSTABLE';
  if (multiplier < 18) return 'NURSE THE COPIUM';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const ward: Ward = createWard();
  const pop = spring(0);
  const badge = spring(0);
  const capPop = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';

  function beginCrash(view: SceneView, quiet: boolean): void {
    const safe = secured !== null || ward.mode === 'walk' || ward.mode === 'gone' || ward.mode === 'up';
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    flatlineWard(ward, quiet, safe);
    if (quiet) pop.x = 1;
    else { shake = 1; pop.v = 14; }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += reduced ? dt * 0.2 : dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const fear = clamp(Math.log2(multiplier) / 3.4, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
    if (previous === null) {
      previous = view.phase;
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !ward.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        resetWard(ward);
        outcome = null;
        secured = null;
        shake = 0;
      }
      previous = view.phase;
    }
    if (secured && running && !ward.crashed) discharge(ward);
    stepWard(ward, { running, multiplier, fear }, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) { caption = next; capPop.v = 6; }
    stepSpring(capPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.4);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 70) * 6 * shake, 0);
    drawWard(ctx, ward, multiplier, time);
    drawMonitor(ctx, 70, 180, multiplier, ward.crashed && !ward.safe, ward.crashT, time, reduced);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 230);
      ctx.rotate(-0.06);
      const k = clamp(pop.x, 0, 1.2);
      ctx.scale(k, k);
      const word = outcome === 'called' ? 'DISCHARGED' : outcome === 'rekt' ? 'FLATLINE' : 'TIME OF DEATH';
      meme(ctx, word, 0, 0, outcome === 'spectator' ? 54 : 72, outcome === 'called' ? '#7cf67c' : '#ff4d6d', 'center', 640);
      ctx.restore();
    }
    ctx.restore();
    if (caption) {
      ctx.save();
      ctx.translate(470, 52);
      ctx.scale(1 + 0.07 * capPop.x, 1 + 0.07 * capPop.x);
      meme(ctx, caption, 0, 0, 34, '#1c1f26', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(470, 92);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      meme(ctx, text, 0, 0, 22, '#2f7a3a', 'center');
      ctx.restore();
    }
    meme(ctx, `${multiplier.toFixed(2)}×`, 936, 56, 52, outcome === 'rekt' || outcome === 'spectator' ? '#ff4d6d' : '#1c1f26', 'right');
    meme(ctx, `DOSE ${doseCount(multiplier)}`, 24, 518, 22, '#f7f4ea', 'left');
  }
  return { draw };
}
