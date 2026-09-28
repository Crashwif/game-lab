/**
 * Composes Bonding Curl from the room state: the gym, the crowd, the
 * curler and his bicep, the powder, then the HUD. All motion is stepped
 * here with the real frame time, and nothing drawn here changes the
 * committed outcome.
 */
import { type Curler, SLEEVE_AT, burstBicep, createCurler, drawCurler, poseCurler, resetCurler, settleCurler, stepCurler } from './curler';
import { type Gym, INK, createGym, drawGymBack, drawGymCrowd, drawGymFloor, drawPhoneOverlay, drawPuffs, finishGym, heckle, puff, resetGym, stepGym, swoon, walkOut } from './gym';
import { clamp, spring, stepSpring } from './motion';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a burst missed while the tab was hidden is not replayed late. */
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
type Outcome = 'rekt' | 'called' | 'pop';
type Secured = { x100: number; payout: number | null };
const HECKLES = ['PEAK', 'SHEEEESH', 'ARMS', 'HE LIFTS', 'GYATT', 'SUNS OUT'];
const MILESTONES = [1.5, 2, 3, 4, 6, 8, 12, 20];

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
  if (outcome) return outcome === 'rekt' ? 'NOODLE ARM' : outcome === 'called' ? 'SOLD THE PEAK' : 'NGMI';
  if (view.phase !== 'running') return 'WE GO JIM';
  if (secured) return 'CURLS FOR THE GIRLS';
  if (multiplier < 1.3) return 'ONE MORE REP';
  if (multiplier < 1.7) return 'NUMBER GO UP';
  if (multiplier < SLEEVE_AT) return 'HODL';
  if (multiplier < 3.2) return 'SLEEVE BUSTED';
  if (multiplier < 4.5) return 'SUNS OUT GUNS OUT';
  if (multiplier < 6.5) return 'DIAMOND HANDS';
  if (multiplier < 10) return 'PEAK IS IN';
  if (multiplier < 16) return 'NEVER SKIP LEG DAY';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const gym: Gym = createGym();
  const curler: Curler = createCurler();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const legArrow = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let milestone = 0;

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
      resetCurler(curler);
      if (running || crashed) { settleCurler(curler, multiplier, growth); while (milestone < MILESTONES.length && multiplier >= MILESTONES[milestone]!) milestone += 1; }
      if (crashed) {
        outcome = 'pop';
        burstBicep(curler, view.currentX100, true);
        finishGym(gym, false, true);
        walkOut(gym);
        pop.x = 1;
      }
    } else if (view.phase !== previous) {
      if (crashed && !curler.burst) {
        const quiet = view.crashAge > 1500;
        outcome = view.stake === null ? 'pop' : secured ? 'called' : 'rekt';
        burstBicep(curler, view.currentX100, quiet);
        finishGym(gym, outcome === 'called', quiet);
        if (outcome !== 'called') walkOut(gym);
        if (quiet) pop.x = 1;
        else { shake = 1; pop.v = 16; }
      }
      if (view.phase === 'betting') {
        resetGym(gym);
        resetCurler(curler);
        outcome = null;
        secured = null;
        milestone = 0;
      }
      previous = view.phase;
    }
    if (secured && running) poseCurler(curler);

    stepCurler(curler, { running, multiplier, growth, tension }, dt);
    stepGym(gym, { running, tension, multiplier, growth, elapsed: view.elapsed, cracks: clamp((growth - 1) / 3, 0, 1) }, dt);
    if (running && milestone < MILESTONES.length && multiplier >= MILESTONES[milestone]!) {
      heckle(gym, HECKLES[milestone % HECKLES.length]!, milestone % 2 === 0);
      milestone += 1;
      if (!reduced) shake = Math.max(shake, 0.2);
    }
    if (curler.events.sleeve) { heckle(gym, 'SLEEVE GONE', true); if (!reduced) shake = Math.max(shake, 0.3); }
    if (curler.events.dropped) { puff(gym, { x: 540, y: 480 }, 10, '#ffffff', 5); swoon(gym); heckle(gym, 'MARRY ME', true); if (!reduced) shake = Math.max(shake, 0.35); }
    if (curler.events.rep && running && !reduced) shake = Math.max(shake, 0.04 + 0.16 * tension);
    stepSpring(legArrow, running && multiplier >= 10 ? 1 : 0, 6, 0.6, dt);
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
    const cv = drawCurler(ctx, curler);
    drawPuffs(ctx, gym);
    const arrow = clamp(legArrow.x, 0, 1);
    if (arrow > 0.02) {
      ctx.save();
      ctx.translate(560 + Math.sin(time * 4) * 6, 440);
      ctx.scale(arrow, arrow);
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-60, -12); ctx.lineTo(-20, -12); ctx.lineTo(-20, -26); ctx.lineTo(10, 0); ctx.lineTo(-20, 26); ctx.lineTo(-20, 12); ctx.lineTo(-60, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.scale(-1, 1);
      memeText(ctx, 'LEG DAY?', -68, 6, 20, '#ffffff', 'left');
      ctx.restore();
    }
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(Math.min(curler.burstAt.x + 40, 700), curler.burstAt.y - 40);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'rekt' ? 'SNAP CITY' : outcome === 'called' ? 'CALLED IT' : 'POPPED';
      memeText(ctx, text, 0, 0, outcome === 'rekt' ? 84 : 78, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    drawPhoneOverlay(ctx, gym, !outcome);
    void cv;

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
    memeText(ctx, `PEAK ${Math.round(30 + 25 * (curler.radius.x - 16) / 128 * 4)} CM`, 936, 514, 24, outcome ? '#ff9db0' : '#e7f4f0', 'right');
  }

  return { draw };
}
