/**
 * Composes Gas Fees from the room state: the shaft, the cabin, whoever is
 * in the lobby, the doors, the riders inside, the air, then the HUD. All
 * motion is stepped here with the real frame time, and nothing drawn here
 * changes the committed outcome.
 */
import { CABIN, type Cabin, createCabin, drawCabinBack, drawCabinFront, drawDoors, drawShaft, gasCabin, resetCabin, settleCabin, stepCabin } from './cabin';
import { clamp, spring, stepSpring } from './motion';
import { type Box, type Crowd, DOOR, INK, MAX_PERSONS, type Point, type Suit, crashLines, createCrowd, createSuit, depthFloor, depthScale, drawLines, drawPassenger, drawSuit, leaveLift, persons, releaseSuit, resetCrowd, resetSuit, settleCrash, settleCrowd, settleSuit, stepCrowd, stepSuit } from './riders';

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
  /** Drops the screen shake and the light flicker. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'leak';
type Secured = { x100: number; payout: number | null };

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
  if (outcome) return outcome === 'rekt' ? 'HE WHO SMELT IT' : outcome === 'called' ? 'DEALT IT, LEFT IT' : 'NETWORK CONGESTION';
  if (view.phase !== 'running') return 'GOING UP?';
  if (secured) return 'THIS IS MY FLOOR';
  if (multiplier < 1.3) return 'HOLD IT';
  if (multiplier < 1.7) return 'CLENCH';
  if (multiplier < 2.3) return 'CHEEKS ARE STAKED';
  if (multiplier < 3.2) return 'HODL IT IN';
  if (multiplier < 4.8) return 'DIAMOND CHEEKS';
  if (multiplier < 6.5) return 'WHALE ALERT';
  if (multiplier < 10) return 'SILENT BUT DEADLY';
  if (multiplier < 20) return 'GAS GAS GAS';
  return 'PRIORITY FEE: MAXIMUM';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const cabin: Cabin = createCabin();
  const crowd: Crowd = createCrowd();
  const suit: Suit = createSuit();
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

  function suitOrigin(): Point {
    if (suit.mode === 'gone' || suit.mode === 'leaving') return { x: DOOR.x, y: DOOR.y - 10 };
    const s = depthScale(suit.depth);
    return { x: suit.x, y: depthFloor(suit.depth) - 80 * s };
  }

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

    const first = previous === null;
    if (first) {
      resetCabin(cabin);
      resetCrowd(crowd);
      resetSuit(suit);
      if (running || crashed) {
        // A round already under way (the page opened mid-round, or missed its betting): the lift, the crowd and
        // the suit go straight to what the multiplier and the bet call for, with nothing replayed on the way.
        settleCrowd(crowd, multiplier);
        settleSuit(suit, tension, crowd.squeeze.x, secured !== null);
        settleCabin(cabin, running, tension);
        if (secured) badge.x = 1;
      }
    }
    if (view.phase !== previous) {
      if (crashed && !cabin.gassed) {
        // A crash met on the scene's first frame, or seen late, shows its aftermath rather than the burst.
        const quiet = first || view.crashAge > 1500;
        outcome = view.stake === null ? 'leak' : secured ? 'called' : 'rekt';
        const origin = suitOrigin();
        releaseSuit(suit, quiet);
        gasCabin(cabin, view.currentX100, origin, quiet);
        if (quiet) { pop.x = 1; settleCrash(crowd); }
        else { shake = 1; pop.v = 16; crashLines(crowd, view.currentX100); }
      }
      if (view.phase === 'betting') {
        resetCabin(cabin);
        resetCrowd(crowd);
        resetSuit(suit);
        outcome = null;
        secured = null;
      }
      previous = view.phase;
    }
    const wasLeaving = suit.mode === 'leaving' || suit.mode === 'gone';
    if (secured && running) leaveLift(suit);

    stepCrowd(crowd, { running, multiplier, tension, suitX: suit.x, gassed: cabin.gassed, gasAge: cabin.gasAge }, dt);
    stepSuit(suit, { running, tension, squeeze: clamp(crowd.squeeze.x, 0, 1) }, dt);
    const justLeft = !wasLeaving && suit.mode === 'leaving';
    const suitDoors = suit.mode === 'leaving' || (suit.mode === 'gone' && suit.modeAge < 1.3);
    const doorsOpen = !running && !crashed ? true : crowd.doorTimer > 0 || suitDoors;
    stepCabin(cabin, { running, tension, doorsOpen, arrived: crowd.events.arrived !== null || justLeft, reduced }, dt);
    if ((crowd.events.arrived || justLeft) && !reduced) shake = Math.max(shake, 0.25);
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
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 6 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    drawShaft(ctx, cabin);
    drawCabinBack(ctx, cabin);
    // Whoever is still in the lobby: arriving passengers and the suit once he is out.
    ctx.save();
    ctx.translate(0, cabin.bounce.x);
    for (const p of crowd.list) if (p.depth > 1) drawPassenger(ctx, p, suit.x, time);
    if (suit.depth > 1) drawSuit(ctx, suit, time);
    ctx.restore();
    const indicator = crashed ? 'DUMPED' : running ? `${multiplier.toFixed(2)}× UP` : 'GOING UP?';
    drawDoors(ctx, cabin, indicator, crashed, persons(crowd) - (suit.mode === 'gone' ? 1 : 0), MAX_PERSONS);
    ctx.save();
    ctx.translate(0, cabin.bounce.x);
    const inside = crowd.list.filter((p) => p.depth <= 1).map((p) => ({ depth: p.depth, draw: () => drawPassenger(ctx, p, suit.x, time) }));
    if (suit.depth <= 1) inside.push({ depth: suit.depth, draw: () => { drawSuit(ctx, suit, time); } });
    inside.sort((a, b) => b.depth - a.depth);
    for (const r of inside) r.draw();
    ctx.restore();
    drawCabinFront(ctx, cabin);
    // The bubbles keep out from under the outcome stamp at rest: six slices of it, each as high as the tilt has it there.
    const stamp = outcome === 'rekt' ? 'RIPPED' : outcome === 'called' ? 'CROP DUSTED' : 'GAS LEAK';
    const stampSize = outcome === 'called' ? 78 : 96;
    const stampBoxes: Box[] = [];
    if (outcome) {
      ctx.font = `900 ${stampSize}px ${MEME_FONT}`;
      const half = ctx.measureText(stamp).width / 2 + 6;
      for (let i = 0; i < 6; i += 1) {
        const u = -half + (i + 0.5) * (half / 3);
        const y = 290 - u * Math.sin(0.1);
        stampBoxes.push({ x: 480 + u - half / 6, y: y - stampSize * 0.8 - 8 - (half / 6) * Math.sin(0.1), w: half / 3, h: stampSize * 0.9 + 16 });
      }
    }
    drawLines(ctx, crowd, suit, cabin.bounce.x, { left: CABIN.left + 6, right: CABIN.right - 6, top: 96 }, stampBoxes);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 290);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, stamp, 0, 0, stampSize, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    if (caption) {
      ctx.save();
      ctx.translate(480, 46);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 40, '#ffffff', 'center', 560);
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
    memeText(ctx, `${multiplier.toFixed(2)}×`, 940, 90, 52, colour, 'right');
    ctx.restore();
    memeText(ctx, `${Math.round(view.currentX100)} GWEI`, 20, 514, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    memeText(ctx, 'GAS', 20, 90, 30, '#8fd3ff', 'left');
    memeText(ctx, 'FEES', 20, 124, 30, '#8fd3ff', 'left');
  }

  return { draw };
}
