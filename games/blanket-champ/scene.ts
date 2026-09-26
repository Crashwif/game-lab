/**
 * Composes Blanket Champ from the room state: the bedroom and its props,
 * the bleachers and the crowd, the commentary booth, the duvet, then the
 * HUD. All motion is stepped here with the real frame time, and nothing
 * drawn here changes the committed outcome.
 */
import { type CrowdState, collectWinnings, createCrowd, drawBleachers, drawBooth, drawCrowd, finishCrowd, resetCrowd, stepCrowd } from './crowd';
import { clamp, spring, stepSpring } from './motion';
import { INK, type RoomState, createRoom, drawBed, drawFloorAndFurniture, drawWall, finishRoom, resetRoom, stepRoom } from './room';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a finish missed while the tab was hidden is not replayed late. */
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
type Outcome = 'rekt' | 'called' | 'gg';
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
  if (outcome) return outcome === 'rekt' ? 'FINISHED EARLY' : outcome === 'called' ? 'CALLED IT' : 'GG';
  if (view.phase !== 'running') return 'GM CHAMP';
  if (secured) return 'DEAL WITH IT';
  if (multiplier < 1.3) return 'HE HAS BEGUN';
  if (multiplier < 1.7) return 'NUMBER GO UP';
  if (multiplier < 2.5) return 'HODL';
  if (multiplier < 4) return "HE'S GOT LEGS";
  if (multiplier < 6) return 'DIAMOND HANDS';
  if (multiplier < 10) return 'HISTORIC PACE';
  if (multiplier < 20) return 'LEGENDARY';
  return 'THIS IS FINE';
}

function boothLine(view: SceneView, multiplier: number, finished: boolean, legendary: boolean): string {
  if (finished) return legendary ? 'ONE FOR THE RECORD BOOKS' : 'AND THAT IS THAT, FOLKS';
  if (view.phase !== 'running') return 'WELCOME BACK TO THE MAIN EVENT';
  if (multiplier < 1.4) return 'ROUND ONE, FOLKS';
  if (multiplier < 2) return 'STEADY RHYTHM SO FAR';
  if (multiplier < 3) return 'HE IS LOCKED IN';
  if (multiplier < 5) return 'THE CROWD IS ON ITS FEET';
  if (multiplier < 8) return 'UNPRECEDENTED STAMINA';
  if (multiplier < 14) return 'CALL THE RECORD BOOKS';
  return 'IS HE OKAY?';
}

function drawFireBrigade(ctx: CanvasRenderingContext2D, time: number, k: number): void {
  // A helmet and a ladder top at the window once things get out of hand.
  ctx.save();
  ctx.translate(790, 190 - 40 * k + Math.sin(time * 3) * 2);
  ctx.strokeStyle = '#c9a44a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-30, 60); ctx.lineTo(-30, -30); ctx.moveTo(30, 60); ctx.lineTo(30, -30); ctx.stroke();
  ctx.lineWidth = 3;
  for (let y = -20; y < 60; y += 16) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(30, y); ctx.stroke(); }
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, -8, 20, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-26, -10, 52, 8, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f3dccb';
  ctx.beginPath(); ctx.ellipse(0, 6, 14, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-5, 4, 2, 0, Math.PI * 2); ctx.arc(5, 4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 12, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const room: RoomState = createRoom();
  const crowd: CrowdState = createCrowd();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const brigade = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let legendary = false;

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
      resetRoom(room);
      resetCrowd(crowd);
      if (crashed) {
        legendary = multiplier >= 5;
        finishRoom(room, true, false);
        finishCrowd(crowd, true, true);
        outcome = 'gg';
        pop.x = 1;
      }
    } else if (view.phase !== previous) {
      if (crashed && !room.finished) {
        const quiet = view.crashAge > 1500;
        legendary = multiplier >= 5;
        outcome = view.stake === null ? 'gg' : secured ? 'called' : 'rekt';
        finishRoom(room, quiet, legendary && !quiet);
        finishCrowd(crowd, outcome !== 'rekt', quiet);
        if (quiet) pop.x = 1;
        else { shake = 1; pop.v = 16; }
      }
      if (view.phase === 'betting') {
        resetRoom(room);
        resetCrowd(crowd);
        outcome = null;
        secured = null;
        legendary = false;
      }
      previous = view.phase;
    }
    if (secured && running) collectWinnings(crowd);

    stepRoom(room, growth, running, dt);
    stepCrowd(crowd, tension, multiplier, room.events.beat, running, dt);
    if (room.events.beat && !reduced) shake = Math.max(shake, 0.06 + 0.18 * tension);
    if ((room.events.glassFell || room.events.fist) && !reduced) shake = Math.max(shake, 0.2);
    stepSpring(brigade, running && multiplier >= 10 ? 1 : 0, 4, 0.8, dt);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.4);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 7 * shake * shake, Math.cos(time * 117) * 5 * shake * shake);
    drawWall(ctx, room);
    if (brigade.x > 0.02) drawFireBrigade(ctx, time, clamp(brigade.x, 0, 1));
    drawBleachers(ctx);
    drawCrowd(ctx, crowd, room.finished, outcome !== 'rekt');
    drawBooth(ctx, crowd, boothLine(view, multiplier, room.finished, legendary));
    drawFloorAndFurniture(ctx, room);
    drawBed(ctx, room);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(450, 330);
      ctx.rotate(-0.12);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, outcome === 'rekt' ? 'REKT' : legendary ? 'LEGENDARY' : 'GG', 0, 0, outcome === 'rekt' ? 92 : legendary ? 72 : 92, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();

    if (caption) {
      ctx.save();
      ctx.translate(430, 68);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', 600);
      ctx.restore();
    }
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
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    memeText(ctx, `${multiplier.toFixed(2)}×`, 930, 514, 56, colour, 'right');
    ctx.restore();
    const seconds = Math.floor(view.elapsed / 1000);
    memeText(ctx, `STAMINA ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, 26, 514, 26, outcome ? '#ff9db0' : '#e7f4f0', 'left');
  }

  return { draw };
}
