import { portrait } from './portrait';
import { endurance } from './endurance';
import { pageAudio } from './audio';
import { clamp, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type Body, type Foot, CENTRE, INK, STAGE, collapse, drawBodies, drawFigure, drawFounder, place, recruitFeet, supportPose, rowsFor, settleBodies, shirtFor, stepBodies } from './pyramid';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number; elapsed: number; crashAge: number;
  stake: number | null; cashoutX100: number | null; payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean }
export interface Scene { draw(c: CanvasRenderingContext2D, view: SceneView, now: number): void }

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
const CAPTIONS = ['FOUNDING MEMBER', 'RECRUIT 3 FRIENDS', "IT'S NOT A PYRAMID", "IT'S A TRIANGLE", 'PLATINUM CIRCLE', 'WHO IS HOLDING THE BOTTOM', 'DIAMOND SHOULDERS', 'THE BASE IS SWEATING', 'FULLY DECENTRALISED (DOWNWARD)'];
const SLIDES = ['TOKENOMICS: 90% TEAM', 'AUDIT: SOON', 'LP LOCKED (IN MY BAG)', 'OVERFLOW ROOM IS FULL', 'PLEASE HOLD YOUR UPLINE'];
const LECTERN_X = 130;
const FREEZE_S = .15;
const SLOW_S = .45;
type Outcome = 'rekt' | 'called' | 'ponzi';
type Secured = { x100: number; payout: number | null };
function memeText(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, maxWidth?: number, align: CanvasTextAlign = 'center'): void {
  c.font = `900 ${size}px ${MEME_FONT}`;
  c.letterSpacing = `${Math.round(size * .1)}px`;
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(1, size * (fill === INK ? .05 : .11));
  c.strokeStyle = fill === INK ? '#f4d1b0' : INK;
  c.strokeText(text, x, y, maxWidth);
  c.fillStyle = fill;
  c.fillText(text, x, y, maxWidth);
  c.letterSpacing = '0px';
}

function captionFor(view: SceneView, rows: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return rows < 2 ? 'NOBODY SIGNED UP' : outcome === 'rekt' ? 'THE BASE SOLD' : outcome === 'called' ? 'CALLED IT FROM THE FLOOR' : 'IT WAS A PYRAMID';
  if (view.phase === 'betting') return 'SEATS AVAILABLE';
  if (view.phase !== 'running') return 'NEXT SEMINAR SOON';
  if (secured) return view.currentX100 < secured.x100 * 2 ? 'JEETED ON MY DOWNLINE' : 'PAPER HANDS, SAFE FEET';
  const act = endurance(view.elapsed / 1000);
  return act.act ? ['', 'LEAN LEFT. HOLD.', 'BEND. BREATHE. BRACE.', 'PASS THE LOAD RIGHT', 'THE BASE NEEDS A BREAK'][act.act]! : CAPTIONS[rows - 1]!;
}
function drawRoom(c: CanvasRenderingContext2D, top: { x: number; y: number }, tension: number, slide: string): void {
  c.fillStyle = '#4a1023';
  c.fillRect(-20, -20, 1000, 580);
  c.fillStyle = '#6b1a33';
  for (let x = 0; x < 960; x += 48) c.fillRect(x, 0, 24, 470);
  c.fillStyle = '#f4d1b0';
  c.fillRect(160, 96, 640, 58);
  c.fillRect(30, 290, 200, 44);
  c.strokeStyle = INK; c.lineWidth = 3;
  c.strokeRect(160, 96, 640, 58);
  c.strokeRect(30, 290, 200, 44);
  memeText(c, 'WEALTH SUMMIT · $PONZI · EVERYONE WINS*', 470, 134, 25, INK, 560);
  memeText(c, '*EARLY', 794, 150, 9, INK, 99, 'right');
  memeText(c, slide, 130, 318, 15, INK, 186);
  for (const x of [120, 840]) {
    c.fillStyle = `rgba(255, 230, 150, ${.1 + .12 * tension})`;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(top.x - 40, top.y); c.lineTo(top.x + 40, top.y); c.fill();
  }
  c.fillStyle = '#8b5a2b';
  c.fillRect(0, STAGE, 960, 70);
  c.fillStyle = '#5c3a1e';
  c.fillRect(0, STAGE, 960, 8);
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'casino', crash: 'crowd' });
  const shown = spring(1), pop = spring(), badge = spring();
  let last: number | null = null;
  let previous: SceneView['phase'] | null = null;
  let time = 0, rows = 1, shake = 0, freeze = 0, slow = 0, beat = 0, sag = 0, count = 0, poseSeconds = 0;
  let joined: number[] = [0];
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let jump: { x: number; y: number; h: number; age: number; land: number; feet: Foot[] } | null = null;
  let bodies: Body[] = [];
  let founderX = LECTERN_X;

  function reset(): void {
    settleSpring(shown, 1); settleSpring(pop, 0); settleSpring(badge, 0);
    rows = 1; joined = [time];
    shake = freeze = slow = beat = sag = 0;
    outcome = secured = jump = null;
    bodies = []; founderX = LECTERN_X;
  }
  // Standing members, top first: support pose, walk-in, and the newest row's crouch, done before the hoist at 0.7 s.
  function members() {
    const list = [];
    for (let k = 0; k < rows; k++) for (let j = 0; j <= k; j++) if (k || !jump) {
      const p = supportPose(shown.x, k, j, poseSeconds, sag), age = time - joined[k], walk = smoothstep(0, .8, age), side = j < k / 2 ? -1 : 1;
      const x = p.x + side * 400 * (1 - walk), dip = k < rows - 1 ? 0 : 6 * Math.sin(Math.PI * smoothstep(.45, .7, age)), stride = recruitFeet(x, p.h, -side), settle = smoothstep(.9, 1, walk);
      list.push({ k, j, x, y: p.y + dip, h: p.h, walk, feet: p.feet.map((f, i) => ({ x: mix(stride[i].x, f.x, settle), y: stride[i].y * (1 - settle) + f.y - dip * 60 / p.h })) });
    }
    return list;
  }
  function leave(quiet: boolean): void {
    const top = members()[0];
    jump = quiet ? { ...top, x: 800, y: STAGE, age: 9, land: 0 } : { ...top, age: 0, land: .12 + (340 + Math.sqrt(115600 + 1800 * (STAGE - top.y))) / 900 };
    if (!quiet) { audio.cashout(); audio.fx('whoosh', .7); }
  }
  function fall(view: SceneView, quiet: boolean): void {
    outcome = view.stake === null ? 'ponzi' : secured ? 'called' : 'rekt';
    bodies = collapse(members(), rows, view.currentX100);
    sag = 0;
    if (quiet) { settleBodies(bodies); pop.x = 1; founderX = -200; audio.crash('crowd', true); return; }
    shake = 1;
    pop.v = 14;
    if (!reduced) { freeze = FREEZE_S; slow = SLOW_S; }
    audio.crash('crowd');
    audio.fx('thud', 1);
  }

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, .1);
    last = now;
    let dt = real;
    if (freeze > 0) { freeze -= real; dt = 0; }
    else if (slow > 0) { slow -= real; dt = real * .3; }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    // 0.5 at 2×, 0.67 at 3×: the build lands where most rounds end.
    const tension = 1 - 1 / multiplier;
    const running = view.phase === 'running', crashed = view.phase === 'crashed', fresh = previous === null;
    count += dt * (3 + 9 * tension);
    if (running) {
      poseSeconds = reduced ? 0 : view.elapsed / 1000;
      // A buckle on a quickening beat: a fake-out, never the crash.
      const b = beat;
      beat += dt / (2.6 - 1.4 * tension);
      if (Math.floor(beat) > Math.floor(b) && tension > .45 && rows > 1 && !secured) audio.fx('creak', .2 + .6 * tension);
      const u = beat % 1;
      sag = reduced ? 0 : (4 + 6 * tension) * Math.min(1, u * 12) * Math.exp(-6 * u);
    }
    if (fresh) {
      rows = running || crashed ? rowsFor(multiplier) : 1;
      joined = Array(rows).fill(-9);
      settleSpring(shown, rows);
    }
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      badge.x = +fresh;
      leave(fresh || crashed);
    }
    if (view.phase !== previous) {
      if (crashed && !outcome) fall(view, fresh || view.crashAge > 1500);
      if (view.phase === 'betting' && !fresh) reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    const next = running ? rowsFor(multiplier) : rows;
    while (rows < next) {
      rows += 1;
      joined.push(time);
      audio.milestone(rows - 1);
      audio.fx('pop', .8);
    }
    stepSpring(shown, Math.max(1, rows - 1 + smoothstep(.7, 1, time - joined[rows - 1])), 12, 1, dt);
    if (bodies.length && stepBodies(bodies, freeze > 0 ? 0 : dt)) audio.fx('thud', .6);
    if (crashed && view.crashAge > 700) {
      if (founderX === LECTERN_X) audio.fx('laugh', .7);
      founderX -= 260 * dt * smoothstep(700, 1000, view.crashAge);
    }
    stepSpring(pop, outcome ? 1 : 0, 16, .45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, .5, dt);
    shake = Math.max(0, shake - dt * 2);

    c.save();
    if (!reduced) {
      const z = 1 + .1 * shake;
      c.translate(CENTRE * (1 - z) + Math.sin(time * 90) * (8 * shake + sag * .25), 380 * (1 - z) + Math.cos(time * 70) * 5 * shake + sag * .3);
      c.scale(z, z);
    }
    drawRoom(c, place(shown.x, 0, 0), running ? tension : 0, SLIDES[Math.floor(view.elapsed / 3900 + .5) % SLIDES.length]);
    if (founderX > -100) drawFounder(c, founderX, count, founderX < LECTERN_X, +(tension > .66 && Math.sin(count * .3) > 0));
    c.fillStyle = '#1e293b';
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.roundRect(LECTERN_X - 34, STAGE - 74, 68, 74, 4); c.fill(); c.stroke();
    memeText(c, '$PONZI', LECTERN_X, STAGE - 34, 16, '#f4d1b0', 60);
    if (rows > 3) {
      // From the fourth row (2.46×), recruits stroll in from the wings to beg beside the pyramid, then back out.
      const cycle = (time - joined[3]) / 20, walk = reduced ? .4 : Math.sin(cycle * Math.PI) ** 2;
      for (const side of [-1, 1]) {
        const x = 480 + side * (540 - 300 * walk);
        drawFigure(c, x, STAGE, 50, 0, time + side, { strain: .3, shirt: shirtFor(Math.floor(cycle), side + 1), arms: walk < .6 ? 'down' : 'flail', feet: recruitFeet(x, 50, -side) });
        memeText(c, side < 0 ? 'MY REF CODE' : 'WEN AIRDROP', x, STAGE - 64, 13, '#ffe6c7');
      }
    }
    if (bodies.length) drawBodies(c, bodies, time, secured !== null);
    else {
      if (running && rows > 1) memeText(c, 'EXIT LIQUIDITY', CENTRE, 506, 20, '#ff4d6d');
      for (const { k, j, x, y, h, walk, feet } of members().reverse()) drawFigure(c, x, y, h, 0, time + k * 2.3 + j * 1.7, { strain: running ? (tension + sag * .04) * (.3 + .7 * (k + 1) / rows) : 0, shirt: k ? shirtFor(k, j) : '#d5fb6d', you: !k, arms: k ? walk < .9 ? 'down' : 'up' : 'flail', feet });
    }
    if (jump) {
      // Crouch, an exact arc, a landing squash and dust.
      const { y, h, land } = jump, age = jump.age += dt, t = Math.max(0, Math.min(age, land) - .12), x = jump.x + 260 * t, fly = y - 340 * t + 450 * t * t, down = age >= land, s = age - land;
      if (down && s < dt) audio.fx('thud', .5);
      const crouch = 6 * Math.sin(Math.PI * Math.min(1, age / .16)), free = smoothstep(.12, .4, age), squash = down && !reduced ? .85 + .15 * smoothstep(0, .15, s) : 1;
      if (down && s < .4 && !reduced) { c.fillStyle = `rgba(255,240,220,${.8 - s * 2})`; c.beginPath(); c.ellipse(x, STAGE - 3, 16 + 90 * s, 3 + 8 * s, 0, 0, 7); c.fill(); }
      c.save();
      c.translate(x, fly + crouch);
      c.scale(2 - squash, squash);
      drawFigure(c, 0, 0, h, down ? 0 : Math.sin(Math.min(1, age / .72) * Math.PI) * .3, time, { strain: 0, shirt: '#d5fb6d', you: true, shades: down, arms: down ? 'down' : 'flail', feet: jump.feet.map((f, i) => ({ x: mix(f.x, i ? 12 : -12, free), y: mix(f.y - crouch * 60 / h, 0, free) })) });
      c.restore();
    }
    const stamp = (scale: number, x: number, y: number, tilt: number, text: string, size: number, fill: string) => { c.save(); c.translate(x, y); c.rotate(tilt); c.scale(scale, scale); memeText(c, text, 0, 0, size, fill); c.restore(); };
    if (outcome && pop.x > .02) stamp(clamp(pop.x, 0, 1.3), CENTRE, 300, -.08, outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'CALLED IT' : "PONZI'D", 84, outcome === 'called' ? '#ffe27a' : '#ff4d6d');
    if (view.phase === 'betting') { c.fillStyle = `rgba(20,6,12,${1 - smoothstep(0, .5, time - joined[0])})`; c.fillRect(-20, -20, 1000, 580); }
    c.restore();

    memeText(c, captionFor(view, rows, outcome, secured), 400, 64, 40, '#ffffff', 600);
    if (secured && badge.x > .02) stamp(clamp(badge.x, 0, 1.15), 400, 88, 0, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`, 26, '#7cf67c');
    memeText(c, `${multiplier.toFixed(2)}×`, 936, 68, 56, outcome === 'rekt' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a', 220, 'right');
    memeText(c, `${(rows * (rows + 1)) / 2} MEMBER${rows > 1 ? 'S' : ''} · LEVEL ${rows}`, 24, 520, 22, '#ffe6c7', 900, 'left');
  }

  return { draw: portrait(draw, 'PYRAMID SCHEME', () => ({ x: 280, y: 158, w: 400, h: 324 }), v => captionFor(v, rows, outcome, secured)) };
}
