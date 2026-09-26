/**
 * Composes Honeypot: picnic, jar, swarm and the HUD. The honey, the tax
 * and the lid follow the displayed multiplier. Nothing here selects it.
 */
import { clamp, spring, stepSpring } from './motion';
import {
  createJar,
  drawJar,
  honeyLevel,
  resetJar,
  sellTax,
  shutJar,
  stepJar,
  type JarState,
} from './jar';
import { createPicnic, drawPicnic, pawPoint, pullPaw, resetPicnic, stepPicnic, trapPicnic, type Picnic } from './picnic';

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

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
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
  if (outcome === 'rekt') return "CAN'T SELL";
  if (outcome === 'called') return 'PAW FREE';
  if (outcome === 'spectator') return 'HONEYPOT';
  if (view.phase !== 'running') return 'GM BEAR';
  if (secured) return 'PULL THE PAW';
  if (multiplier < 1.4) return 'SWEET GAINS';
  if (multiplier < 2) return 'NUMBER GO UP';
  if (multiplier < 3) return 'HODL';
  if (multiplier < 5) return 'DIAMOND PAWS';
  if (multiplier < 8) return 'WHY IS THE LID MOVING';
  if (multiplier < 14) return 'SELL TAX RISING';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const jar: JarState = createJar();
  const picnic: Picnic = createPicnic();
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

  function escaped(): boolean {
    return secured !== null || picnic.bear.mode === 'walking' || picnic.bear.mode === 'gone' || picnic.bear.mode === 'pulling';
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    const out = escaped();
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    shutJar(jar, quiet);
    trapPicnic(picnic, quiet, out);
    if (!out && quiet) picnic.bear.mode = 'trapped';
    if (quiet) pop.x = 1;
    else {
      shake = 1;
      pop.v = 14;
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += reduced ? dt * 0.2 : dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = clamp(Math.log2(multiplier) / 3.2, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };

    if (previous === null) {
      previous = view.phase;
      jar.level.x = honeyLevel(multiplier);
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !jar.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        resetJar(jar);
        resetPicnic(picnic);
        outcome = null;
        secured = null;
        shake = 0;
      }
      previous = view.phase;
    }
    if (secured && running && !jar.crashed) pullPaw(picnic);

    const paw = pawPoint(picnic, jar.level.x);
    stepPicnic(picnic, { running, multiplier, tension, level: jar.level.x }, dt);
    stepJar(jar, { running, multiplier, tension, pulling: picnic.bear.mode === 'pulling', pawX: paw.x, pawY: paw.y }, dt);
    if (jar.taxFlash > 0.9 && !reduced) shake = Math.max(shake, 0.16);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) {
      caption = next;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.4);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 70) * 8 * shake, 0);
    drawPicnic(ctx, picnic, jar.level.x, time, tension);
    drawJar(ctx, jar, time);
    if (jar.glue.x > 0.02) {
      ctx.fillStyle = `rgba(80, 60, 30, ${jar.glue.x * 0.22})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(420, 250);
      ctx.rotate(-0.08);
      const scale = clamp(pop.x, 0, 1.2);
      ctx.scale(scale, scale);
      const word = outcome === 'called' ? 'PAW FREE' : outcome === 'rekt' ? "CAN'T SELL" : 'HONEYPOT';
      memeText(ctx, word, 0, 0, 72, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center', 520);
      ctx.restore();
    }
    ctx.restore();

    if (caption) {
      ctx.save();
      ctx.translate(400, 58);
      ctx.scale(1 + 0.08 * captionPop.x, 1 + 0.08 * captionPop.x);
      memeText(ctx, caption, 0, 0, 40, '#1c1f26', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(400, 98);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(ctx, text, 0, 0, 24, '#2f7a3a', 'center');
      ctx.restore();
    }
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 64, 56, outcome === 'rekt' ? '#ff4d6d' : '#1c1f26', 'right');
    memeText(ctx, `SELL TAX ${sellTax(multiplier)}%`, 24, 520, 26, sellTax(multiplier) >= 49 ? '#c0392b' : '#1c1f26', 'left');
    memeText(ctx, `HONEY ${Math.round(jar.level.x * 100)}%`, 936, 520, 22, '#1c1f26', 'right');
  }

  return { draw };
}
