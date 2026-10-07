import { portrait } from './portrait';
import { endurance } from './endurance';
import { pageAudio } from './audio';
import { clamp, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type Body, CENTRE, INK, STAGE, collapse, drawBodies, drawFigure, drawFounder, place, recruitFeet, supportPose, rowsFor, settleBodies, shirtFor, stepBodies } from './pyramid';

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
export interface Scene { draw(c: CanvasRenderingContext2D, view: SceneView, now: number): void }

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
const CAPTIONS = ['FOUNDING MEMBER', 'RECRUIT 3 FRIENDS', "IT'S NOT A PYRAMID", "IT'S A TRIANGLE", 'PLATINUM CIRCLE', 'WHO IS HOLDING THE BOTTOM', 'DIAMOND SHOULDERS', 'THE BASE IS SWEATING', 'FULLY DECENTRALISED (DOWNWARD)'];
const LECTERN_X = 130;
const FREEZE_S = 0.07;
const SLOW_S = 0.45;
type Outcome = 'rekt' | 'called' | 'ponzi';
type Secured = { x100: number; payout: number | null };
function memeText(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  c.font = `900 ${size}px ${MEME_FONT}`;
  c.letterSpacing = `${Math.round(size * 0.1)}px`;
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(1, size * (fill === INK ? 0.05 : 0.11));
  c.strokeStyle = fill === INK ? '#f4d1b0' : INK;
  c.strokeText(text, x, y, maxWidth);
  c.fillStyle = fill;
  c.fillText(text, x, y, maxWidth);
  c.letterSpacing = '0px';
}

function captionFor(view: SceneView, rows: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'THE BASE SOLD' : outcome === 'called' ? 'CALLED IT FROM THE FLOOR' : 'IT WAS A PYRAMID';
  if (view.phase === 'betting') return 'SEATS AVAILABLE';
  if (view.phase !== 'running') return 'NEXT SEMINAR SOON';
  if (secured) return 'JUMPED WITH THE BAG';
  const act = endurance(view.elapsed / 1000);
  return act.act ? ['', 'LEAN LEFT. HOLD.', 'BEND. BREATHE. BRACE.', 'PASS THE LOAD RIGHT', 'THE BASE NEEDS A BREAK'][act.act]! : CAPTIONS[rows - 1]!;
}
function drawRoom(c: CanvasRenderingContext2D, top: { x: number; y: number }, tension: number): void {
  c.fillStyle = '#4a1023';
  c.fillRect(0, 0, 960, 540);
  c.fillStyle = '#6b1a33';
  for (let x = 0; x < 960; x += 48) c.fillRect(x, 0, 24, 470);
  c.fillStyle = '#f4d1b0';
  c.fillRect(160, 96, 640, 58);
  c.strokeStyle = INK; c.lineWidth = 3;
  c.strokeRect(160, 96, 640, 58);
  memeText(c, 'WEALTH SUMMIT · $PONZI · EVERYONE WINS*', 470, 134, 25, INK, 'center', 560);
  memeText(c, '*EARLY', 794, 150, 9, INK, 'right');
  for (const x of [120, 840]) {
    c.fillStyle = `rgba(255, 230, 150, ${0.1 + 0.12 * tension})`;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(top.x - 40, top.y); c.lineTo(top.x + 40, top.y); c.fill();
  }
  c.fillStyle = '#8b5a2b';
  c.fillRect(0, STAGE, 960, 70);
  c.fillStyle = '#5c3a1e';
  c.fillRect(0, STAGE, 960, 8);
}

function drawLectern(c: CanvasRenderingContext2D): void {
  c.fillStyle = '#1e293b';
  c.strokeStyle = INK; c.lineWidth = 3;
  c.beginPath(); c.roundRect(LECTERN_X - 34, STAGE - 74, 68, 74, 4); c.fill(); c.stroke();
  memeText(c, '$PONZI', LECTERN_X, STAGE - 34, 16, '#f4d1b0', 'center', 60);
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'casino', crash: 'crowd' });
  const shown = spring(1);
  const pop = spring(0);
  const badge = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let rows = 1;
  let joined: number[] = [0];
  let shake = 0;
  let freeze = 0;
  let slow = 0;
  let creakAt = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
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
  function leave(quiet: boolean): void {
    const top = place(shown.x, 0, 0);
    jump = quiet ? { x: 800, y: STAGE, vx: 0, vy: 0, down: true } : { x: top.x, y: top.y, vx: 260, vy: -340, down: false };
    if (!quiet) {
      audio.cashout();
      audio.fx('whoosh', 0.7);
    }
  }
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

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number, close = false): void {
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
    const tension = clamp(Math.log2(multiplier) / 3.4, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (jump === null) leave(fresh || crashed);
    }
    if (fresh) {
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

    c.save();
    const wobble = running && !reduced ? tension * tension * 2 : 0;
    if (!reduced && (shake > 0 || wobble > 0)) c.translate(Math.sin(time * 90) * (8 * shake + wobble), Math.cos(time * 70) * 5 * shake);
    drawRoom(c, place(shown.x, 0, 0), running ? tension : 0);
    if (running && rows === 9) {
      const cycle = view.elapsed / 1000 / 10;
      const walk = reduced ? 0.5 : cycle % 1;
      for (const side of [-1, 1]) {
        const x = side < 0 ? 28 + walk * 220 : 932 - walk * 170;
        drawFigure(c, x, STAGE, 50, 0, time, { strain: 0.3, shirt: shirtFor(Math.floor(cycle), side + 1), you: false, shades: false, dazed: false, arms: walk < 0.6 ? 'down' : 'flail', feet: recruitFeet(x, 50, -side) });
      }
      const pitches = ['NEW COHORT ARRIVING', 'OVERFLOW ROOM IS FULL', 'PLEASE HOLD YOUR UPLINE', 'ANOTHER SEMINAR SOLD OUT'];
      if (!close) memeText(c, pitches[Math.floor(cycle) % pitches.length]!, 770, 210, 19, '#ffe6c7', 'center', 260);
    }
    if (founderX > -100) drawFounder(c, founderX, time, founderX < LECTERN_X);
    drawLectern(c);
    if (bodies.length) drawBodies(c, bodies, time, secured !== null);
    else {
      for (let k = rows - 1; k >= 0; k -= 1) {
        const walk = smoothstep(0, 0.8, time - (joined[k] ?? 0));
        for (let j = 0; j <= k; j += 1) {
          if (k === 0 && jump) continue;
          const p = supportPose(shown.x, k, j, running && !reduced ? view.elapsed / 1000 : 0);
          const side = j < k / 2 ? -1 : 1;
          const x = p.x + side * 400 * (1 - walk);
          const strain = running ? tension * (0.3 + 0.7 * (k + 1) / rows) : 0;
          drawFigure(c, x, p.y, p.h, 0, time, { strain, shirt: k === 0 ? '#d5fb6d' : shirtFor(k, j), you: k === 0, shades: false, dazed: false, arms: k === 0 ? 'flail' : walk < 1 ? 'down' : 'up', feet: walk < 1 ? recruitFeet(x, p.h, -side) : p.feet });
        }
      }
    }
    if (jump) drawFigure(c, jump.x, jump.y, 60, jump.down ? 0 : Math.sin(time * 6) * 0.3, time, { strain: 0, shirt: '#d5fb6d', you: true, shades: jump.down, dazed: false, arms: jump.down ? 'down' : 'flail' });
    if (outcome && pop.x > 0.02) {
      c.save();
      c.translate(CENTRE, 300);
      c.rotate(-0.08);
      c.scale(clamp(pop.x, 0, 1.3), clamp(pop.x, 0, 1.3));
      memeText(c, outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'CALLED IT' : "PONZI'D", 0, 0, 84, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center');
      c.restore();
    }
    c.restore();

    memeText(c, captionFor(view, rows, outcome, secured), 400, 64, 40, '#ffffff', 'center', 600);
    if (secured && badge.x > 0.02) {
      c.save();
      c.translate(400, 104);
      c.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(c, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`, 0, 0, 26, '#7cf67c', 'center');
      c.restore();
    }
    memeText(c, `${multiplier.toFixed(2)}×`, 936, 68, 56, outcome === 'rekt' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a', 'right', 220);
    memeText(c, `${(rows * (rows + 1)) / 2} MEMBER${rows > 1 ? 'S' : ''} · LEVEL ${rows}`, 24, 520, 22, '#ffe6c7', 'left');
  }

  return { draw: portrait(draw, 'PYRAMID SCHEME', () => ({ x: 280, y: 158, w: 400, h: 324 }), v => captionFor(v, rows, outcome, secured)) };
}
