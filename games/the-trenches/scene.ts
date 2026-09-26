/**
 * Composes The Trenches. Advance follows the displayed multiplier.
 * The cloud is the crash the server already committed.
 */
import { clamp, spring, stepSpring } from './motion';
import { createField, drawField, nukeField, resetField, stepField, type Field } from './field';
import { createSquad, diveBack, drawSquad, hitSquad, resetSquad, stepSquad, type Squad } from './squad';

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
  if (outcome === 'rekt') return 'NUKED';
  if (outcome === 'called') return 'SURVIVED';
  if (outcome === 'spectator') return 'DEV SOLD';
  if (view.phase !== 'running') return 'GM SOLDIER';
  if (secured) return 'SURVIVED';
  if (multiplier < 1.4) return 'OVER THE TOP';
  if (multiplier < 2.2) return 'NUMBER GO UP';
  if (multiplier < 3.5) return 'HOLD THE LINE';
  if (multiplier < 6) return 'HODL';
  if (multiplier < 9) return 'DIAMOND HELMETS';
  if (multiplier < 14) return 'IS THAT A WHISTLE';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const field: Field = createField();
  const squad: Squad = createSquad();
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

  function safe(): boolean {
    return secured !== null || squad.mode === 'dive' || squad.mode === 'safe';
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    const out = safe();
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    nukeField(field, view.currentX100, quiet);
    hitSquad(squad, quiet, out);
    if (quiet) pop.x = 1;
    else { shake = 1; pop.v = 16; }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
    if (previous === null) {
      previous = view.phase;
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !field.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        resetField(field);
        resetSquad(squad);
        outcome = null;
        secured = null;
        shake = 0;
      }
      previous = view.phase;
    }
    if (secured && running && !field.crashed) diveBack(squad);
    stepField(field, dt);
    stepSquad(squad, multiplier, running, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) { caption = next; capPop.v = 6; }
    stepSpring(capPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.35);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 40) * 10 * shake, Math.cos(time * 30) * 4 * shake);
    drawField(ctx, field, multiplier, reduced ? 0 : time, reduced);
    drawSquad(ctx, squad, multiplier, time);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 200);
      ctx.rotate(-0.05);
      ctx.scale(clamp(pop.x, 0, 1.2), clamp(pop.x, 0, 1.2));
      const word = outcome === 'called' ? 'SURVIVED' : outcome === 'rekt' ? 'NUKED' : 'DEV SOLD';
      meme(ctx, word, 0, 0, 78, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center');
      ctx.restore();
    }
    ctx.restore();
    if (caption) {
      ctx.save();
      ctx.translate(480, 48);
      ctx.scale(1 + 0.07 * capPop.x, 1 + 0.07 * capPop.x);
      meme(ctx, caption, 0, 0, 34, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(480, 88);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      meme(ctx, text, 0, 0, 22, '#7cf67c', 'center');
      ctx.restore();
    }
    const metres = Math.round(40 + Math.log2(multiplier) * 80);
    meme(ctx, `${multiplier.toFixed(2)}×`, 936, 52, 52, outcome === 'rekt' ? '#ff4d6d' : '#ffffff', 'right');
    meme(ctx, `${metres}m`, 24, 518, 24, '#f0e6c8', 'left');
  }
  return { draw };
}
