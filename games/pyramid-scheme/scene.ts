/**
 * Composes Pyramid Scheme from the room state: the ballroom, the founder at his lectern, the pyramid that
 * gains a row underneath you every time the multiplier grows by a third, your jump off the top on an
 * accepted cash-out, the seeded collapse of the crash, and the HUD. Everything follows the SceneView and
 * the frame time; nothing here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { clamp, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type Body, CENTRE, INK, STAGE, collapse, drawBodies, drawFigure, drawFounder, place, rowsFor, settleBodies, shirtFor, stepBodies } from './pyramid';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** The displayed multiplier in hundredths; the crash point once crashed. */
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
/** The caption for each number of rows; a milestone stinger plays as each row joins. */
const CAPTIONS = ['FOUNDING MEMBER', 'RECRUIT 3 FRIENDS', "IT'S NOT A PYRAMID", "IT'S A TRIANGLE", 'PLATINUM CIRCLE', 'WHO IS HOLDING THE BOTTOM', 'DIAMOND SHOULDERS', 'THE BASE IS SWEATING', 'FULLY DECENTRALISED (DOWNWARD)'];
const LECTERN_X = 130;
/** The collapse's hit-stop, then slow motion at a third speed. */
const FREEZE_S = 0.07;
const SLOW_S = 0.45;
type Outcome = 'rekt' | 'called' | 'ponzi';
type Secured = { x100: number; payout: number | null };

/** Meme caption lettering: heavy, bordered, tracked so Impact's letters don't fuse. */
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

function captionFor(view: SceneView, rows: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'THE BASE SOLD' : outcome === 'called' ? 'CALLED IT FROM THE FLOOR' : 'IT WAS A PYRAMID';
  if (view.phase === 'betting') return 'SEATS AVAILABLE';
  if (view.phase !== 'running') return 'NEXT SEMINAR SOON';
  if (secured) return 'JUMPED WITH THE BAG';
  return CAPTIONS[rows - 1]!;
}

/** The ballroom: curtains, the summit banner, the spotlights and the stage. */
function drawRoom(ctx: CanvasRenderingContext2D, top: { x: number; y: number }, tension: number): void {
  ctx.fillStyle = '#4a1023';
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#6b1a33';
  for (let x = 0; x < 960; x += 48) ctx.fillRect(x, 0, 24, 470);
  ctx.fillStyle = '#f4d1b0';
  ctx.fillRect(160, 96, 640, 58);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.strokeRect(160, 96, 640, 58);
  memeText(ctx, 'WEALTH SUMMIT · $PONZI · EVERYONE WINS*', 470, 134, 25, INK, 'center', 560);
  memeText(ctx, '*EARLY', 794, 150, 9, INK, 'right');
  // Two spotlights follow the top of the pyramid and warm up with the tension.
  for (const x of [120, 840]) {
    ctx.fillStyle = `rgba(255, 230, 150, ${0.1 + 0.12 * tension})`;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(top.x - 40, top.y); ctx.lineTo(top.x + 40, top.y); ctx.fill();
  }
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, STAGE, 960, 70);
  ctx.fillStyle = '#5c3a1e';
  ctx.fillRect(0, STAGE, 960, 8);
}

function drawLectern(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(LECTERN_X - 34, STAGE - 74, 68, 74, 4); ctx.fill(); ctx.stroke();
  memeText(ctx, '$PONZI', LECTERN_X, STAGE - 34, 16, '#f4d1b0', 'center', 60);
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'casino', crash: 'crowd' });
  /** The rows the pyramid shows: it follows the count through a spring, so a joining row lifts the rest. */
  const shown = spring(1);
  const pop = spring(0);
  const badge = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let rows = 1;
  /** When each row joined, for its walk-in from the wings. */
  let joined: number[] = [0];
  let shake = 0;
  let freeze = 0;
  let slow = 0;
  let creakAt = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  /** Your degen once he has jumped: an arc to the floor at the right, then a stand with shades. */
  let jump: { x: number; y: number; vx: number; vy: number; down: boolean } | null = null;
  let bodies: Body[] = [];
  let founderX = LECTERN_X;
  let muted = false;

  function reset(): void {
    settleSpring(shown, 1);
    settleSpring(pop, 0);
    settleSpring(badge, 0);
    rows = 1;
    joined = [0];
    shake = freeze = slow = 0;
    outcome = null;
    secured = null;
    jump = null;
    bodies = [];
    founderX = LECTERN_X;
    muted = false;
  }

  /** Your degen leaves the top; `quiet` puts him on the floor already, for a cash-out met late. */
  function leave(quiet: boolean): void {
    const top = place(shown.x, 0, 0);
    jump = quiet ? { x: 800, y: STAGE, vx: 0, vy: 0, down: true } : { x: top.x, y: top.y, vx: 260, vy: -340, down: false };
    if (!quiet) {
      audio.cashout();
      audio.fx('whoosh', 0.7);
    }
  }

  /** The base gives way: everyone tumbles along the crash's seed and the founder runs with the bag; `quiet` lands on the heap. */
  function fall(view: SceneView, quiet: boolean): void {
    outcome = view.stake === null ? 'ponzi' : secured ? 'called' : 'rekt';
    bodies = collapse(rows, view.currentX100, jump === null);
    if (quiet) {
      settleBodies(bodies);
      pop.x = 1;
      founderX = -200;
      muted = true;
      audio.crash('crowd', true);
      return;
    }
    shake = 1;
    pop.v = 14;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    audio.crash('crowd');
    audio.fx('thud', 1);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the frame the base gives way, then the tumble runs slow before time catches up.
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
    const tension = clamp(Math.log2(multiplier) / 3.4, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (jump === null) leave(fresh || crashed);
    }
    if (fresh) {
      // The first frame can land anywhere in a round: settle into it rather than play it out.
      previous = view.phase;
      rows = running || crashed ? rowsFor(multiplier) : 1;
      joined = Array.from({ length: rows }, () => -9);
      settleSpring(shown, rows);
      settleSpring(badge, secured ? 1 : 0);
      if (crashed) fall(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !outcome) fall(view, view.crashAge > 1500);
      if (view.phase === 'betting') reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    const next = running ? rowsFor(multiplier) : rows;
    while (rows < next) {
      // A new row of recruits walks in underneath and lifts everyone a step higher.
      rows += 1;
      joined.push(time);
      audio.milestone(rows - 1);
      audio.fx('pop', 0.8);
    }
    stepSpring(shown, rows, 5, 0.5, dt);
    if (running && tension > 0.55 && time > creakAt) {
      creakAt = time + 1.6 - tension;
      audio.fx('creak', 0.4 + 0.5 * tension);
    }
    if (jump && !jump.down) {
      jump.vy += 900 * dt;
      jump.x += jump.vx * dt;
      jump.y += jump.vy * dt;
      if (jump.y >= STAGE) {
        jump.y = STAGE;
        jump.down = true;
        audio.fx('thud', 0.5);
      }
    }
    if (bodies.length && stepBodies(bodies, dt) && !muted) audio.fx('thud', 0.6);
    if (crashed && !muted && view.crashAge > 700) {
      if (founderX === LECTERN_X) audio.fx('laugh', 0.7);
      founderX -= 260 * dt;
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    ctx.save();
    const wobble = running && !reduced ? tension * tension * 2 : 0;
    if (!reduced && (shake > 0 || wobble > 0)) ctx.translate(Math.sin(time * 90) * (8 * shake + wobble), Math.cos(time * 70) * 5 * shake);
    drawRoom(ctx, place(shown.x, 0, 0), running ? tension : 0);
    if (founderX > -100) drawFounder(ctx, founderX, time, founderX < LECTERN_X);
    drawLectern(ctx);
    if (bodies.length) drawBodies(ctx, bodies, time, secured !== null);
    else {
      // The pyramid, base row first: the newest row walks in from both wings, and the strain gathers at the bottom.
      for (let k = rows - 1; k >= 0; k -= 1) {
        const walk = smoothstep(0, 0.8, time - (joined[k] ?? 0));
        for (let j = 0; j <= k; j += 1) {
          if (k === 0 && jump) continue;
          const p = place(shown.x, k, j);
          const side = j < k / 2 ? -1 : 1;
          const x = p.x + side * 400 * (1 - walk);
          const strain = running ? tension * (0.3 + 0.7 * (k + 1) / rows) : 0;
          drawFigure(ctx, x, p.y, p.h, 0, time, { strain, shirt: k === 0 ? '#d5fb6d' : shirtFor(k, j), you: k === 0, shades: false, dazed: false, arms: k === 0 ? 'flail' : walk < 1 ? 'down' : 'up' });
        }
      }
    }
    if (jump) drawFigure(ctx, jump.x, jump.y, 60, jump.down ? 0 : Math.sin(time * 6) * 0.3, time, { strain: 0, shirt: '#d5fb6d', you: true, shades: jump.down, dazed: false, arms: jump.down ? 'down' : 'flail' });
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(CENTRE, 300);
      ctx.rotate(-0.08);
      ctx.scale(clamp(pop.x, 0, 1.3), clamp(pop.x, 0, 1.3));
      memeText(ctx, outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'CALLED IT' : "PONZI'D", 0, 0, 84, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center');
      ctx.restore();
    }
    ctx.restore();

    // The HUD: the caption, the secured badge, the multiplier and the membership count.
    memeText(ctx, captionFor(view, rows, outcome, secured), 400, 64, 40, '#ffffff', 'center', 600);
    if (secured && badge.x > 0.02) {
      ctx.save();
      ctx.translate(400, 104);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(ctx, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`, 0, 0, 26, '#7cf67c', 'center');
      ctx.restore();
    }
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 68, 56, outcome === 'rekt' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a', 'right', 220);
    memeText(ctx, `${(rows * (rows + 1)) / 2} MEMBER${rows > 1 ? 'S' : ''} · LEVEL ${rows}`, 24, 520, 22, '#ffe6c7', 'left');
  }

  return { draw };
}
