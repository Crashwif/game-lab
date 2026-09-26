/**
 * Composes Wife Changing Money: the dark kitchen, the trader, the suitcase
 * meter and the HUD. Motion is stepped with the real frame time. Nothing
 * drawn here changes the committed outcome.
 */
import {
  crashKitchen,
  createKitchen,
  drawFront,
  drawGlow,
  drawLaptop,
  drawLight,
  drawMid,
  drawRoom,
  drawVignette,
  type Kitchen,
  resetKitchen,
  stepKitchen,
  visibleMugs,
} from './kitchen';
import { clamp, spring, stepSpring } from './motion';
import { createTrader, drawTrader, resetTrader, snapTrader, stepTrader, type Trader } from './trader';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a crash missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake and the clock flicker is left as a steady colon. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

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

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, trader: Trader, secured: Secured | null): string {
  if (outcome === 'rekt') return 'WIFE CHANGED';
  if (outcome === 'called') return 'SHE NEVER KNEW';
  if (outcome === 'spectator') return 'SLEEPING IN THE CAR';
  if (view.phase !== 'running') return 'GM DEGEN';
  if (trader.mode === 'upstairs') return 'SHE NEVER KNEW';
  if (trader.mode === 'sneak' || trader.mode === 'closing' || secured) return 'CLOSE THE LID';
  if (multiplier < 1.35) return 'JUST ONE MORE TRADE';
  if (multiplier < 1.8) return 'NUMBER GO UP';
  if (multiplier < 2.6) return "SHE'S ASLEEP";
  if (multiplier < 4) return 'HODL';
  if (multiplier < 6.5) return 'DIAMOND HANDS';
  if (multiplier < 9) return 'LIFE CHANGING';
  if (multiplier < 14) return 'WIFE CHANGING';
  if (multiplier < 22) return 'IS THAT THE STAIRS';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const kitchen: Kitchen = createKitchen();
  const trader: Trader = createTrader();
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

  function beginCrash(view: SceneView, quiet: boolean): void {
    const harmless = secured !== null || trader.mode === 'upstairs' || trader.mode === 'sneak' || trader.mode === 'closing';
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    if (harmless) snapTrader(trader, 'upstairs');
    else snapTrader(trader, quiet ? 'caught' : 'caught');
    if (!quiet && !harmless) trader.modeAge = 0;
    crashKitchen(kitchen, view.currentX100, quiet, harmless);
    if (quiet) pop.x = 1;
    else {
      shake = 1;
      pop.v = 16;
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += reduced ? dt * 0.25 : dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const fear = clamp((Math.log2(multiplier) - 0.2) / 3.2, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };

    if (previous === null) {
      previous = view.phase;
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !kitchen.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        resetKitchen(kitchen);
        resetTrader(trader);
        outcome = null;
        secured = null;
        shake = 0;
      }
      previous = view.phase;
    }
    if (secured && running && !kitchen.crashed && trader.mode === 'hunch') holdMeter(kitchen);

    stepTrader(trader, { running, fear, leaving: secured !== null && running && !kitchen.crashed, time }, dt);
    stepKitchen(kitchen, { running, multiplier, fear, time, traderGone: trader.mode !== 'hunch' && trader.mode !== 'caught' }, dt);
    if (kitchen.events.thump && !reduced) shake = Math.max(shake, 0.28);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, trader, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    const glow = trader.lid.x > 0.8 ? 'off' : kitchen.chartDead ? 'red' : 'green';
    drawRoom(ctx, kitchen, reduced ? 0 : time);
    drawTrader(ctx, trader, glow, time, fear);
    drawLaptop(ctx, trader.lid.x, kitchen.chartDead, kitchen.crashT, time, fear);
    drawMid(ctx, kitchen, multiplier, time);
    drawFront(ctx, kitchen, time);
    drawGlow(ctx, trader.lid.x, kitchen.chartDead);
    drawLight(ctx, kitchen);
    drawVignette(ctx, trader.lid.x);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 250);
      ctx.rotate(-0.08);
      const scale = clamp(pop.x, 0, 1.25);
      ctx.scale(scale, scale);
      const word = outcome === 'called' ? 'SHE NEVER KNEW' : outcome === 'rekt' ? 'WIFE CHANGED' : 'NGMI';
      memeText(ctx, word, 0, 0, outcome === 'called' ? 64 : 78, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center', 640);
      ctx.restore();
    }
    ctx.restore();

    if (caption) {
      ctx.save();
      ctx.translate(470, 64);
      const scale = 1 + 0.08 * captionPop.x;
      ctx.scale(scale, scale);
      memeText(ctx, caption, 0, 0, 40, '#ffffff', 'center', 620);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(470, 108);
      ctx.scale(clamp(badge.x, 0, 1.2), clamp(badge.x, 0, 1.2));
      memeText(ctx, text, 0, 0, 24, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'spectator' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 78, 58, colour, 'right');
    const pct = Math.round(clamp(kitchen.meter.x, 0, 1) * 100);
    const meterWord = pct >= 78 ? 'WIFE CHANGING' : pct >= 45 ? 'LIFE CHANGING' : 'COPING';
    memeText(ctx, `${meterWord} ${pct}%`, 24, 518, 24, outcome ? '#ffb4c2' : '#f0e6c8', 'left');
    memeText(ctx, `MUGS ${visibleMugs(multiplier)}`, 936, 518, 22, '#f0e6c8', 'right');
  }

  return { draw };
}

function holdMeter(k: Kitchen): void {
  k.holding = true;
}
