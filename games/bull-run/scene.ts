/**
 * Composes Bull Run from the room state: the arena, the gate, the crowd, the bull and the rider, the dev
 * clown, the dismount of a cash-out, the seeded throw of the crash and the HUD. Nothing here changes the outcome.
 */
import { pageAudio } from './audio';
import { clamp, settleSpring, spring, stepSpring } from './motion';
import { ARENA_X, type Bull, CHUTE_X, type Dust, FLOOR, INK, RAIL, type Rider, createBull, createRider, drawBull, drawDust, drawRider, puff, stepBull, stepDust, stepRider, throwRider, vault } from './bull';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean }
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The caption ladder: a milestone stinger at each rung. */
const RUNGS = [1.4, 2, 3, 5, 8, 14];
const CAPTIONS = ['HOLD ON TIGHT', 'YEEHAW', '8 SECONDS IS FOR JEETS', 'DIAMOND SPURS', 'HE IS NOT TIRED', 'THE BEAR IS WATCHING', 'LEGENDARY RIDE'];
const BANNERS = ['$BULL RODEO', 'NO STOP LOSS SADDLERY', 'HODL FEED CO', 'DEGEN ARENA'];
const BARREL_X = 760;
type Outcome = 'rekt' | 'called' | 'bucked';
type Secured = { x100: number; payout: number | null };

/** Meme lettering: heavy, bordered, tracked so Impact's letters don't fuse. */
function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.letterSpacing = `${Math.round(size * 0.1)}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.11);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
  ctx.letterSpacing = '0px';
}

function captionFor(view: SceneView, rung: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'BUCKED OFF' : outcome === 'called' ? 'CALLED IT FROM THE FENCE' : 'THE BULL ALWAYS WINS';
  if (view.phase === 'betting') return 'GATE OPENS SOON';
  if (view.phase !== 'running') return 'NEXT RIDE SOON';
  if (secured) return 'DISMOUNTED WITH THE BAG';
  return CAPTIONS[rung]!;
}

/** The stands and the crowd, the dirt, the fence with its banners, and the chute gate that slides open along it. */
function drawArena(ctx: CanvasRenderingContext2D, time: number, tension: number, gate: number, reduced: boolean): void {
  ctx.fillStyle = '#5a2a1a';
  ctx.fillRect(0, 0, 960, 300);
  memeText(ctx, 'DEGEN RODEO · TONIGHT: $BULL vs YOUR SAVINGS', 480, 150, 22, '#f4d1b0', 'center', 700);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  for (const [row, y, n, s] of [[0, 278, 22, 1], [1, 250, 25, 0.82]] as const) {
    for (let i = 0; i < n; i += 1) {
      const x = 20 + (i + 0.5) * (920 / n);
      const cy = y + (reduced ? 0 : Math.sin(time * (3 + 5 * tension) + i * 1.3 + row) * (1.5 + 7 * tension));
      ctx.fillStyle = ['#f4d1b0', '#8d5524', '#e0ac69', '#c68642'][i % 4]!;
      ctx.beginPath(); ctx.arc(x, cy, 11 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  ctx.fillStyle = '#c69c6d';
  ctx.fillRect(0, 300, 960, 240);
  ctx.fillStyle = '#8b5a2b';
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  for (let x = 43; x < 960; x += 96) { ctx.fillRect(x, 262, 10, 84); ctx.strokeRect(x, 262, 10, 84); }
  for (const y of [292, 316]) { ctx.fillRect(0, y, 960, 8); ctx.strokeRect(0, y, 960, 8); }
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = i % 2 ? '#d5fb6d' : '#f4d1b0';
    ctx.fillRect(154 + i * 192, 302, 172, 34);
    ctx.strokeRect(154 + i * 192, 302, 172, 34);
    memeText(ctx, BANNERS[i]!, 240 + i * 192, 326, 15, INK, 'center', 160);
  }
  ctx.fillStyle = '#9ca3af';
  for (let y = 280; y < 440; y += 36) ctx.fillRect(140 - 170 * gate, y, 66, 6);
  ctx.fillRect(196 - 170 * gate, 262, 10, 180);
  ctx.strokeRect(196 - 170 * gate, 262, 10, 180);
}

/** The dev clown peeking out of his barrel (`run` 0), or legging it with the bag once the bull has won. */
function drawClown(ctx: CanvasRenderingContext2D, peek: number, run: number, time: number): void {
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  if (run > 0) {
    ctx.translate(BARREL_X + run, FLOOR);
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-14 * Math.sin(time * 14), 0); ctx.lineTo(0, -30); ctx.lineTo(14 * Math.sin(time * 14), 0); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath(); ctx.roundRect(-11, -62, 22, 36, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.ellipse(22, -40, 12, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.translate(0, -76);
  } else {
    ctx.beginPath(); ctx.rect(BARREL_X - 30, FLOOR - 200, 60, 136); ctx.clip();
    ctx.translate(BARREL_X, FLOOR - 49 - 50 * peek);
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#22c55e';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 15, -6, 7, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath(); ctx.arc(0, 2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 6, -5, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 4, 8, 0.4, Math.PI - 0.4); ctx.stroke();
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'phonk', crash: 'thud' });
  const bull: Bull = createBull();
  let rider: Rider = createRider();
  let dust: Dust[] = [];
  const gate = spring(0);
  const peek = spring(0);
  const pop = spring(0);
  const badge = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let rung = 0;
  let shake = 0;
  let freeze = 0;
  let slow = 0;
  let run = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  /** True from a crash met late until the next round: the aftermath plays no cues. */
  let muted = false;

  function reset(): void {
    rider = createRider();
    dust = [];
    rung = 0;
    shake = freeze = slow = run = 0;
    outcome = null;
    secured = null;
    muted = false;
    settleSpring(gate, 0);
    settleSpring(pop, 0);
    settleSpring(badge, 0);
  }

  /** The bull wins: the rider is thrown unless he is already on the fence. */
  function crash(view: SceneView, quiet: boolean): void {
    outcome = view.stake === null ? 'bucked' : secured ? 'called' : 'rekt';
    if (rider.mode === 'riding') throwRider(rider, bull, view.currentX100, quiet);
    if (quiet) {
      pop.x = 1;
      run = 400;
      muted = true;
      audio.crash('thud', true);
      return;
    }
    shake = 1;
    pop.v = 14;
    if (!reduced) {
      // A hit-stop, then the throw at a third speed.
      freeze = 0.07;
      slow = 0.4;
    }
    audio.crash(secured ? 'crowd' : 'thud');
    if (!secured) audio.fx('scream', 0.8);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * 0.3;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = clamp(Math.log2(multiplier) / 3.2, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (fresh || crashed) rider = { ...createRider(), mode: 'fence', x: RAIL.x, y: RAIL.y };
      else if (rider.mode === 'riding') {
        vault(rider, bull);
        audio.cashout();
        audio.fx('whoosh', 0.7);
      }
    }
    if (fresh) {
      // The first frame can land anywhere in a round: settle into it.
      previous = view.phase;
      rung = RUNGS.filter((r) => multiplier >= r).length;
      settleSpring(bull.x, running || crashed ? ARENA_X : CHUTE_X);
      settleSpring(gate, running || crashed ? 1 : 0);
      settleSpring(badge, secured ? 1 : 0);
      if (crashed) crash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !outcome) crash(view, view.crashAge > 1500);
      if (running && previous === 'betting') {
        audio.fx('door', 1);
        audio.fx('clang', 0.6);
      }
      if (view.phase === 'betting') reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    const next = RUNGS.filter((r) => multiplier >= r).length;
    if (running && next > rung) {
      rung = next;
      audio.milestone(rung);
    }
    stepSpring(gate, running || crashed ? 1 : 0, 6, 0.6, dt);
    stepBull(bull, { running, tension, loose: crashed }, dt);
    const fear = clamp(tension * 1.2, 0, 1);
    if (bull.landed) {
      puff(dust, bull.x.x + 40, FLOOR, 5);
      puff(dust, bull.x.x - 50, FLOOR, 5);
      if (running && !reduced) shake = Math.max(shake, 0.25 * tension);
      if (!muted) audio.fx('stomp', 0.3 + 0.7 * tension);
    }
    if (stepRider(rider, bull, fear, dt, dust) && !muted) audio.fx('thud', rider.mode === 'fence' ? 0.4 : 1);
    dust = stepDust(dust, dt);
    stepSpring(peek, running && tension > 0.35 ? 0.8 + 0.2 * Math.sin(time * 2) : 0, 5, 0.7, dt);
    if (crashed && !muted && view.crashAge > 800) {
      // The dev clown climbs out and legs it with the bag.
      if (run === 0) audio.fx('laugh', 0.7);
      run += 240 * dt;
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    drawArena(ctx, time, running ? tension : 0, gate.x, reduced);
    if (run === 0) drawClown(ctx, peek.x, 0, time);
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(BARREL_X - 26, FLOOR - 64, 52, 66, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4d1b0';
    for (const y of [FLOOR - 50, FLOOR - 16]) ctx.fillRect(BARREL_X - 26, y, 52, 5);
    memeText(ctx, 'DEV', BARREL_X, FLOOR - 26, 14, '#ffffff', 'center');
    drawDust(ctx, dust);
    drawBull(ctx, bull, time);
    drawRider(ctx, rider, crashed && rider.mode !== 'fence' ? 1 : fear, secured !== null);
    if (run > 0 && run < 400) drawClown(ctx, 0, run, time);
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(clamp(rider.x, 220, 700), Math.min(rider.y - 90, 380));
      ctx.rotate(-0.1);
      ctx.scale(clamp(pop.x, 0, 1.3), clamp(pop.x, 0, 1.3));
      memeText(ctx, outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'CALLED IT' : 'BUCKED', 0, 0, 84, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center');
      ctx.restore();
    }
    ctx.restore();

    // The HUD.
    memeText(ctx, captionFor(view, rung, outcome, secured), 400, 64, 40, '#ffffff', 'center', 600);
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(400, 104);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(ctx, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`, 0, 0, 26, '#7cf67c', 'center');
      ctx.restore();
    }
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 68, 56, outcome === 'rekt' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a', 'right', 220);
    memeText(ctx, running || crashed ? `${(view.elapsed / 1000).toFixed(1)} S ON THE BULL` : 'CHUTE 4 · $BULL', 24, 520, 22, '#ffe6c7', 'left');
  }

  return { draw };
}
