/**
 * Composes I Got Hacked. The party, the yacht and the draft follow the
 * displayed multiplier. The post is the committed crash.
 */
import { clamp, spring, stepSpring } from './motion';
import { createMansion, drawMansion, hackPost, resetMansion, stepMansion, type Mansion } from './mansion';
import { createParty, drainParty, drawParty, fanCount, leaveParty, resetParty, stepParty, type Party } from './party';

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
  if (outcome === 'rekt') return 'I GOT HACKED';
  if (outcome === 'called') return 'NOT HACKED';
  if (outcome === 'spectator') return 'RUGGED';
  if (view.phase !== 'running') return 'GM FAM';
  if (secured) return 'NOT HACKED';
  if (multiplier < 1.4) return 'MY NEW COIN';
  if (multiplier < 2.2) return 'NUMBER GO UP';
  if (multiplier < 3.5) return 'LOVE MY FANS';
  if (multiplier < 6) return 'HODL';
  if (multiplier < 9) return 'DIAMOND HANDS';
  if (multiplier < 14) return 'THE MANAGER IS WHISPERING';
  if (multiplier < 20) return 'WHY IS THE YACHT MOVING';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const mansion: Mansion = createMansion();
  const party: Party = createParty();
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
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    hackPost(mansion, quiet);
    drainParty(party, quiet);
    if (quiet) pop.x = 1;
    else { shake = 1; pop.v = 14; }
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
      if (crashed && !mansion.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        resetMansion(mansion);
        resetParty(party);
        outcome = null;
        secured = null;
        shake = 0;
      }
      previous = view.phase;
    }
    if (secured && running && !mansion.crashed) leaveParty(party);
    stepMansion(mansion, multiplier, dt);
    stepParty(party, multiplier, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) { caption = next; capPop.v = 6; }
    stepSpring(capPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.4);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(0, Math.sin(time * 50) * 4 * shake);
    drawMansion(ctx, mansion, multiplier, time);
    drawParty(ctx, party, multiplier, reduced ? 0 : time);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(420, 180);
      ctx.rotate(-0.06);
      ctx.scale(clamp(pop.x, 0, 1.15), clamp(pop.x, 0, 1.15));
      const word = outcome === 'called' ? 'NOT HACKED' : outcome === 'rekt' ? 'I GOT HACKED' : 'RUGGED';
      meme(ctx, word, 0, 0, outcome === 'rekt' ? 64 : 72, outcome === 'called' ? '#7cf67c' : '#ff4d6d', 'center', 620);
      ctx.restore();
    }
    ctx.restore();
    if (caption) {
      ctx.save();
      ctx.translate(400, 44);
      ctx.scale(1 + 0.06 * capPop.x, 1 + 0.06 * capPop.x);
      meme(ctx, caption, 0, 0, 28, '#ffffff', 'center', 520);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(480, 512);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      meme(ctx, text, 0, 0, 22, '#7cf67c', 'center');
      ctx.restore();
    }
    meme(ctx, `${multiplier.toFixed(2)}×`, 936, 44, 42, outcome === 'rekt' ? '#ff4d6d' : '#ffffff', 'right');
    meme(ctx, `POPS ${fanCount(multiplier)}`, 24, 520, 20, '#f0e6c8', 'left');
  }
  return { draw };
}
