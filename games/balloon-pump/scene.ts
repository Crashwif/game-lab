/**
 * Composes the scene from the room state: sky, the round's own chart, ground,
 * hose, the pumper and the balloon, then the meme layer (captions, readout,
 * lasers, the burst text). All motion is stepped here with the real frame time,
 * and nothing drawn here changes the committed outcome.
 */
import { endurance } from './endurance';
import { pageAudio } from './audio';
import { TETHER, type BalloonDrive, balloonGeometry, burstBalloon, createBalloon, drawBalloon, drawBalloonShadow, resetBalloon, settleBalloon, stepBalloon } from './balloon';
import { airPacket, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { PUMP, type Point, type PumperDrive, createPumper, drawPumper, settlePumper, stepPumper } from './pumper';
import { FLIGHT_S, createSniper, drawBushBack, drawSniper, drawStone, fire, resetSniper, settleSniper, stepSniper } from './sniper';

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
  /** Drops the screen shake, flicker and twinkle. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const W = 960;
const H = 540;
const GROUND = 446;
const INK = '#1c1f26';
const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The readout's right edge, and the widest it draws: a longer multiplier is squeezed to fit rather than run into the caption. */
const READOUT_X = 930;
const READOUT_MAX = 300;
const CAPTION_X = 430;
/** The chart takes a point every 100 ms of the round, up to this many. */
const TRAIL_POINTS = 900;
/** The multipliers a milestone stinger plays at. */
const RUNGS = [1.5, 2, 3, 5, 10, 25];
/** The burst's hit-stop and slow motion: a freeze you can feel, then the shreds fly at a third speed for a moment. */
const FREEZE_S = 0.15;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
/** The camera cuts in on the burst by this much, holds, then eases back out. */
const PUNCH_ZOOM = 0.1;
const PUNCH_HOLD_S = 0.3;
const HOSE: [Point, Point, Point, Point] = [{ x: PUMP.x - 4, y: 436 }, { x: 420, y: 512 }, { x: 560, y: 502 }, TETHER];
type Outcome = 'rekt' | 'called' | 'pop';
type Star = { x: number; y: number; r: number; k: number };
type Secured = { x100: number; payout: number | null };

function hosePoint(t: number): Point {
  const [a, b, c, d] = HOSE;
  const k = 1 - t;
  return {
    x: k * k * k * a.x + 3 * k * k * t * b.x + 3 * k * t * t * c.x + t * t * t * d.x,
    y: k * k * k * a.y + 3 * k * k * t * b.y + 3 * k * t * t * c.y + t * t * t * d.y,
  };
}

/** Meme caption lettering: heavy, white, black-bordered. */
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

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THE PUMP HAS OVERTIME", "STILL FULL OF HOT AIR", "LUNG DAY NEVER ENDS", "THE STRING HAS TRUST ISSUES", "INFLATION: EXTENDED EDITION", "THE SNIPER MISSED LUNCH", "ONE MORE BREATH", "AIR SUPPLY: QUESTIONABLE"];
/**
 * A new line every two or three seconds through the first fifteen, each landing with the beat it names: the intern
 * peeks out and ducks (1.2×), stands up (1.45×), clicks his second notch (2×). Each line holds below its multiplier.
 */
const LADDER: [number, string][] = [[1.2, 'PUMP IT'], [1.45, 'PROBABLY NOTHING'], [1.75, 'UNREGISTERED SECURITY DETECTED'], [2, 'UP ONLY'], [2.5, 'SIR, THIS IS A SECURITY'], [3, 'BACKED BY HOT AIR'], [5, 'INFLATION IS TRANSITORY'], [10, 'NO JEETS ALLOWED'], [25, 'MY LUNGS ARE LEVERAGED'], [Infinity, 'SEND IT TO VALHALLA']];
/** After an accepted exit the round goes on without the player: the jeet's ladder, keyed to how far it has run past the exit. */
const JEET: [number, string][] = [[1.1, 'DEAL WITH IT'], [1.35, 'JEETED THE TOP (SMART)'], [2, 'PROFIT IS PROFIT'], [4, "DON'T LOOK AT THE CHART"], [Infinity, 'STILL A WIN. STILL A WIN.']];
const rung = (ladder: [number, string][], x: number): string => ladder.find(([top]) => x < top)![1];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null, waited: number): string {
  if (outcome) return view.currentX100 <= 100 ? 'RUGGED BEFORE THE FIRST PUMP' : outcome === 'rekt' ? 'BLEW UP IN MY FACE' : outcome === 'called' ? 'HAVE FUN STAYING POOR' : 'IT WAS ALL HOT AIR';
  if (view.phase === 'crashed') return 'HOLD YOUR BREATH';
  if (view.phase === 'betting') return waited < 1.6 ? 'WEN PUMP?' : waited < 3.3 ? 'PRIMING THE PUMP' : 'DEV IS READY';
  if (view.phase !== 'running') return 'WEN PUMP?';
  if (secured) return rung(JEET, (100 * multiplier) / secured.x100);
  if (view.elapsed >= 45_000) return OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]!;
  return rung(LADDER, multiplier);
}

function drawSky(ctx: CanvasRenderingContext2D, time: number, stars: Star[], reduced: boolean): void {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#120c2e');
  sky.addColorStop(0.42, '#3d2568');
  sky.addColorStop(0.72, '#a24a78');
  sky.addColorStop(0.9, '#e77a6c');
  sky.addColorStop(1, '#f6b26b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND + 12);
  ctx.fillStyle = '#ffffff';
  for (const [i, s] of stars.entries()) {
    ctx.globalAlpha = reduced ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.k + i));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const glow = ctx.createRadialGradient(790, 140, 40, 790, 140, 120);
  glow.addColorStop(0, 'rgba(255, 244, 214, 0.35)');
  glow.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(790, 140, 120, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f7f0d8';
  ctx.beginPath(); ctx.arc(790, 140, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e4dabd';
  for (const [x, y, r] of [[774, 128, 9], [804, 156, 6], [798, 122, 4], [778, 158, 5]] as const) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  for (const [x, y, w] of [[120, 330, 110], [520, 300, 150], [880, 350, 90]] as const) {
    ctx.beginPath(); ctx.ellipse(x + Math.sin(time * 0.05 + x) * 6, y, w, 18, 0, 0, Math.PI * 2); ctx.fill();
  }
}

/** The chart's mapping of a sample to the screen: time eases along, log2(multiplier) climbs, and both widen in long rounds. */
function chartScale(samples: Point[]): (p: Point) => Point {
  const end = samples[samples.length - 1]!;
  const timeScale = Math.max(32_000, end.x / 3);
  const growthScale = Math.max(4.2, end.y * 1.12);
  return (p) => ({ x: 80 + 800 * (1 - Math.exp(-p.x / timeScale)), y: 440 - 352.8 * p.y / growthScale });
}

/** Where the chart line crosses `exit` (log2), the player's accepted cash-out; exact on a late join's straight line too. */
function exitPoint(samples: Point[], exit: number): Point | null {
  const after = samples.findIndex((p) => p.y >= exit);
  if (samples.length < 2 || after < 0) return null;
  const a = samples[Math.max(0, after - 1)]!;
  const b = samples[after]!;
  const k = b.y > a.y ? clamp((exit - a.y) / (b.y - a.y), 0, 1) : 1;
  return chartScale(samples)({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k) });
}

/** The green tick pinned to the chart where the player took profits, drawn over the rig so an early exit still shows. */
function drawTick(ctx: CanvasRenderingContext2D, at: Point, scale: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#3ddc84';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.lineTo(-1.5, 4.5); ctx.lineTo(6, -5); ctx.stroke();
  memeText(ctx, 'SOLD', 16, -8, 16, '#7cf67c', 'left');
  ctx.restore();
}

/** The round's multiplier over time as a rising line, red and pointing down once it crashed. */
function drawTrail(ctx: CanvasRenderingContext2D, samples: Point[], dead: boolean): void {
  if (samples.length < 2) return;
  const trail = samples.map(chartScale(samples));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = dead ? 'rgba(255, 77, 109, 0.4)' : 'rgba(74, 222, 128, 0.34)';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(trail[0]!.x, trail[0]!.y);
  for (const p of trail) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  const tip = trail[trail.length - 1]!;
  const from = trail[Math.max(0, trail.length - 8)]!;
  let head = tip;
  let angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  if (dead) {
    head = { x: tip.x + 30, y: GROUND - 40 };
    angle = Math.atan2(head.y - tip.y, head.x - tip.x);
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(head.x, head.y); ctx.stroke();
  }
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-16, -18); ctx.lineTo(-8, 0); ctx.lineTo(-16, 18); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Samples retain elapsed time and log2(multiplier), so the chart can expand in long rounds. */
const trailPoint = (elapsed: number, growth: number): Point => ({ x: elapsed, y: growth });

/** Connect the known endpoints on a late join; subsequent samples trace the observed curve. */
function settleTrail(elapsed: number, growth: number): Point[] {
  return [trailPoint(0, 0), trailPoint(elapsed, growth)];
}

function drawGround(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#5fae76';
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.quadraticCurveTo(450, GROUND - 30, W, GROUND + 9);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3f8a5a';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.quadraticCurveTo(450, GROUND - 30, W, GROUND + 9); ctx.stroke();
  ctx.strokeStyle = '#2f7a4d';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i += 1) {
    const x = 20 + i * 37 + noise(i) * 20;
    const y = GROUND + 20 + noise(i * 2.3) * 70;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 8); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 9); ctx.stroke();
  }
}

/** The hose lying on the grass, with a bulge of air travelling to the balloon during each push. */
function drawHose(ctx: CanvasRenderingContext2D, packet: number | null): void {
  const N = 48;
  const points = Array.from({ length: N + 1 }, (_, i) => hosePoint(i / N));
  const bulge = (t: number): number => (packet === null ? 0 : 7.5 * Math.exp(-(((t - packet) / 0.06) ** 2)));
  ctx.lineCap = 'round';
  for (const [base, colour] of [[13, INK], [10, '#3a5566']] as const) {
    ctx.strokeStyle = colour;
    for (let i = 0; i < N; i += 1) {
      ctx.lineWidth = base + bulge((i + 0.5) / N);
      ctx.beginPath(); ctx.moveTo(points[i]!.x, points[i]!.y); ctx.lineTo(points[i + 1]!.x, points[i + 1]!.y); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(190, 215, 225, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(HOSE[0].x, HOSE[0].y - 3);
  ctx.bezierCurveTo(HOSE[1].x, HOSE[1].y - 3, HOSE[2].x, HOSE[2].y - 3, HOSE[3].x, HOSE[3].y - 3);
  ctx.stroke();
}

function drawLasers(ctx: CanvasRenderingContext2D, eyes: Point[], target: Point, intensity: number, time: number, reduced: boolean): void {
  const k = intensity * (reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 61));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const eye of eyes) {
    const dx = target.x - eye.x;
    const dy = target.y - eye.y;
    const d = Math.hypot(dx, dy) || 1;
    const end = { x: eye.x + (dx / d) * 1400, y: eye.y + (dy / d) * 1400 };
    for (const [width, alpha, core] of [[16, 0.16, false], [7, 0.45, false], [2.5, 0.95, true]] as const) {
      ctx.strokeStyle = core ? `rgba(255, 235, 235, ${alpha * k})` : `rgba(255, 60, 60, ${alpha * k})`;
      ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(eye.x, eye.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255, 80, 80, ${0.6 * k})`;
    ctx.beginPath(); ctx.arc(eye.x, eye.y, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** The burst's word: REKT for a player caught holding, DODGED for one already out, POP! for a spectator. */
const POP_WORDS: Record<Outcome, [string, string]> = { rekt: ['REKT', '#ff4d6d'], called: ['DODGED', '#7cf67c'], pop: ['POP!', '#ffe27a'] };

function drawPop(ctx: CanvasRenderingContext2D, at: Point, outcome: Outcome, scale: number): void {
  const [text, fill] = POP_WORDS[outcome];
  ctx.save();
  ctx.translate(at.x, Math.min(at.y + 30, 400));
  ctx.rotate(-0.12);
  ctx.scale(scale, scale);
  memeText(ctx, text, 0, 0, 96, fill, 'center', 420);
  ctx.restore();
}

/** The accepted exit, as a subtitle under the caption so it never collides with the rig. */
function drawBadge(ctx: CanvasRenderingContext2D, secured: Secured, scale: number, time: number): void {
  const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
  ctx.save();
  ctx.translate(430, 114 + Math.sin(time * 2) * 3);
  ctx.rotate(-0.03);
  ctx.scale(scale, scale);
  memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
  ctx.restore();
}

/** The caption, squeezed to at most `width` as drawn, the pop's scale included. */
function drawCaption(ctx: CanvasRenderingContext2D, caption: string, scale: number, width: number): void {
  if (!caption) return;
  ctx.save();
  ctx.translate(CAPTION_X, 68);
  ctx.scale(scale, scale);
  memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', width / scale);
  ctx.restore();
}

/** How wide the readout draws, so the caption can keep clear of it. */
function readoutWidth(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = `900 66px ${MEME_FONT}`;
  return Math.min(READOUT_MAX, ctx.measureText(text).width);
}

function drawReadout(ctx: CanvasRenderingContext2D, view: SceneView, text: string, dead: boolean): void {
  const colour = dead ? '#ff4d6d' : view.phase === 'running' ? '#ffffff' : '#ffe08a';
  ctx.save();
  if (view.phase !== 'running' && !dead) ctx.globalAlpha = 0.85;
  memeText(ctx, text, READOUT_X, 80, 66, colour, 'right', READOUT_MAX);
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'chiptune', crash: 'pop' });
  const pumper = createPumper();
  const balloon = createBalloon();
  const sniper = createSniper(reduced);
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const laser = spring(0);
  /** The camera's punch into the burst. */
  const punch = spring(0);
  const stars: Star[] = Array.from({ length: 46 }, (_, i) => ({ x: noise(i * 3.1) * W, y: 8 + noise(i * 7.7) * 250, r: 0.7 + noise(i * 1.3) * 1.5, k: 1 + noise(i * 5.9) * 2 }));
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  /** The shake and the punch run on real time, so the camera still rattles through the hit-stop. */
  let shakeClock = 0;
  let punchHold = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let trail: Point[] = [];
  let trailAt = -1;
  /** Last round's chart, fading out as the next one opens instead of vanishing. */
  let ghost: { trail: Point[]; exit: number | null; alpha: number } | null = null;
  /** Seconds until the stone lands and the balloon bursts; -1 with no shot in the air. */
  let fuse = -1;
  let freeze = 0;
  let slow = 0;
  let laserOn = false;
  let burstEnding: Outcome = 'pop';
  /** The endurance act's effort, eased, and the act its props belong to, so both fade out rather than pop. */
  let effort = 0;
  let propAct = 0;
  /** Seconds into betting, for the wind-up captions; seconds to the dev's next heartbeat. */
  let waited = 0;
  let pulse = 0.6;
  /** Milestone rungs already passed this round, so a round met late doesn't replay their stingers. */
  let rungs = 0;

  /** The burst itself: the shreds, the outcome, the shake, the punch-in, the hit-stop and the sound. */
  function burst(view: SceneView, quiet: boolean): void {
    burstBalloon(balloon, view.currentX100, quiet);
    outcome = burstEnding;
    if (quiet) {
      pop.x = 1;
      audio.crash('pop', true);
      return;
    }
    shake = 1;
    pop.v = 16;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
      settleSpring(punch, 1);
      punchHold = PUNCH_HOLD_S;
    }
    audio.crash('pop');
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the picture for a few frames, then the burst runs slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    // Presentation tension, 1 - 1/x: a third at 1.5×, half at 2×, two thirds at 3×, where most rounds end.
    const tension = 1 - 1 / multiplier;
    const fear = clamp((tension - 0.2) / 0.65, 0, 1);
    // The slow driver for long rounds, 10× to 1000×: the rubber thins, the gauge pins, the intern shakes.
    const strain = smoothstep(3.3, 10, growth);
    const running = view.phase === 'running';
    const act = endurance(view.elapsed / 1000);
    if (act.act) propAct = act.act;
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured && (running || crashed)) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      // A round met late keeps quiet about an exit it never saw.
      if (running && previous !== null) audio.cashout();
    }
    const balloonDrive: BalloonDrive = {
      radius: running || crashed ? 40 + 150 * (1 - Math.exp(-growth / 2.3)) : 36,
      tug: propAct === 1 ? effort * .18 : propAct === 4 ? -effort * .12 : 0,
      fear,
      stretch: 0.8 * smoothstep(0.3, 3.3, growth) + 0.2 * strain,
      inflow: false,
      shiver: reduced ? 0 : strain,
    };

    const ending: Outcome = view.stake === null ? 'pop' : secured ? 'called' : 'rekt';

    // Phase edges: the burst, and a fresh balloon for the next round. A round met late (the first frame, which
    // may land mid-round or after the crash, or a burst missed while the tab was hidden) settles into place
    // instead of playing out what it missed.
    let settle = false;
    if (previous === null) {
      previous = view.phase;
      settle = true;
      effort = running && !reduced ? act.effort : 0;
      settleBalloon(balloon, balloonDrive);
      settleSniper(sniper, { growth, running, strain, target: balloonGeometry(balloon).centre });
      burstEnding = ending;
      if (crashed) burst(view, true);
    } else if (view.phase !== previous) {
      if (crashed && balloon.alive && fuse < 0) {
        settle = view.crashAge > 1500;
        burstEnding = ending;
        if (settle) {
          settleBalloon(balloon, balloonDrive);
          burst(view, true);
        } else {
          // The intern takes the shot: the stone is in the air for a few frames, then the balloon goes.
          fire(sniper, balloonGeometry(balloon).centre);
          fuse = FLIGHT_S;
          audio.fx('yeet', 1);
        }
      }
      if (view.phase === 'betting') {
        resetBalloon(balloon);
        resetSniper(sniper);
        if (trail.length > 1) ghost = { trail, exit: secured ? Math.log2(secured.x100 / 100) : null, alpha: 1 };
        outcome = null;
        secured = null;
        trail = [];
        trailAt = -1;
        fuse = -1;
        freeze = slow = 0;
      }
      previous = view.phase;
    }
    if (fuse >= 0) {
      fuse -= real;
      if (fuse < 0 && balloon.alive) {
        burst(view, false);
        // The burst's own frame is the first frame of the hit-stop.
        if (freeze > 0) dt = 0;
      }
    }
    time += dt;
    audio.update(view.phase, tension);
    if (settle && (running || crashed)) {
      // The chart uses the elapsed time supplied by the round, including its final crash frame.
      const elapsed = view.elapsed;
      trail = settleTrail(elapsed, growth);
      trailAt = Math.floor(elapsed / 100);
    }
    effort += ((running && !reduced ? act.effort : 0) - effort) * (1 - Math.exp(-3 * dt));
    waited = view.phase === 'betting' ? waited + dt : 0;
    // The dev's heartbeat quickens with the tension, until the player has cashed out.
    if (running && !secured && balloon.alive) {
      pulse -= dt;
      if (pulse <= 0) {
        audio.fx('heartbeat', 0.2 + 0.4 * tension);
        pulse = Math.max(0.1, pulse + mix(1.4, 0.35, tension));
      }
    } else pulse = 0.6;

    // Step the rig, then the balloon it feeds, then the meme layer's springs.
    const pumperDrive: PumperDrive = {
      pumping: running,
      // Strokes per second follow the tension; the second act's regrip is a burst of extra pace, never a slowdown.
      rate: 0.85 + 1.25 * tension + (propAct === 2 ? 0.25 * effort : 0),
      regrip: propAct === 2 ? effort : 0,
      ready: view.phase === 'betting',
      fear,
      fallen: crashed && !balloon.alive,
      crying: outcome === 'rekt',
      smug: secured !== null,
      laser: 0,
      gauge: 0.88 * tension + 0.12 * strain,
      gaze: TETHER,
    };
    // The laser eyes come on from 1.37×, flash on with a zap near 2×, and burn full from 3×.
    const lasers = running && balloon.alive ? smoothstep(0.45, 1.6, growth) : 0;
    if (settle) {
      settlePumper(pumper, pumperDrive, view.crashAge / 1000);
      settleSpring(badge, secured ? 1 : 0);
      settleSpring(laser, lasers);
      laserOn = lasers > 0.5;
    }
    stepPumper(pumper, pumperDrive, dt);
    if (running && pumper.events.push) audio.fx('chuff', 0.4 + 0.5 * tension);
    if (running && pumper.events.bottom) audio.fx('squeak', 0.5 + 0.7 * tension);
    balloonDrive.inflow = running && pumper.events.bottom;
    stepBalloon(balloon, balloonDrive, dt);
    const geometry = balloonGeometry(balloon);
    pumperDrive.gaze = balloon.alive ? geometry.centre : { x: TETHER.x, y: TETHER.y - 80 };
    stepSniper(sniper, { growth, running, ready: view.phase === 'betting', strain, target: balloon.alive ? { x: geometry.centre.x, y: geometry.centre.y - (propAct === 4 ? effort * 70 : 0) } : null }, dt);
    if (sniper.events.up) audio.fx('creak', 0.7);
    if (sniper.events.notch) audio.fx('ratchet', 0.6);
    const reached = running ? RUNGS.filter((r) => multiplier >= r).length : 0;
    if (reached > rungs && !settle) audio.milestone(reached);
    rungs = reached;
    stepSpring(laser, lasers, 8, 1, dt);
    pumperDrive.laser = clamp(laser.x, 0, 1);
    if (pumperDrive.laser > 0.5 && !laserOn) {
      laserOn = true;
      audio.fx('zap', 0.8);
    } else if (pumperDrive.laser < 0.2) laserOn = false;
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold -= real;
    stepSpring(punch, punchHold > 0 ? 1 : 0, 7, 1, real);
    const nextCaption = captionFor(view, multiplier, outcome, secured, waited);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    shakeClock += real;
    if (shake > 0) shake = Math.max(0, shake - real / 0.7);
    if (ghost) {
      ghost.alpha -= real / 0.4;
      if (ghost.alpha <= 0) ghost = null;
    }
    if (running) {
      const at = Math.floor(view.elapsed / 100);
      if (at !== trailAt) {
        if (trail.length >= TRAIL_POINTS) trail = trail.filter((_, i) => i % 2 === 0);
        trailAt = at;
        trail.push(trailPoint(view.elapsed, growth));
      }
    }

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(shakeClock * 140) * 9 * shake * shake, Math.cos(shakeClock * 117) * 6 * shake * shake);
    if (!reduced && punch.x > 0.005) {
      // The camera cuts in on the burst, holds, and eases back out.
      const k = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(balloon.burstAt.x, balloon.burstAt.y);
      ctx.scale(k, k);
      ctx.translate(-balloon.burstAt.x, -balloon.burstAt.y);
    }
    drawSky(ctx, time, stars, reduced);
    if (ghost) {
      ctx.globalAlpha = ghost.alpha;
      drawTrail(ctx, ghost.trail, true);
      ctx.globalAlpha = 1;
    }
    drawTrail(ctx, trail, outcome !== null);
    drawGround(ctx);
    drawBushBack(ctx, sniper);
    drawSniper(ctx, sniper);
    drawHose(ctx, running ? airPacket(pumper.phase) : null);
    drawBalloonShadow(ctx, balloon);
    const pumperView = drawPumper(ctx, pumper, pumperDrive);
    drawBalloon(ctx, balloon);
    if (propAct === 3 && effort > 0.01) {
      ctx.save(); ctx.globalAlpha = .65 * effort; ctx.strokeStyle = "#e7faff"; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) { const u = reduced ? i / 4 : (time * .7 + i / 4) % 1; ctx.beginPath(); ctx.arc(365 + u * 34, 365 - u * 50, 4 + u * 9, -.8, 1.8); ctx.stroke(); }
      ctx.restore();
    }
    const exit = secured ? exitPoint(trail, Math.log2(secured.x100 / 100)) : null;
    if (exit && badge.x > 0.02) drawTick(ctx, exit, clamp(badge.x, 0, 1.3));
    const ghostExit = ghost?.exit != null ? exitPoint(ghost.trail, ghost.exit) : null;
    if (ghost && ghostExit) {
      ctx.globalAlpha = ghost.alpha;
      drawTick(ctx, ghostExit, 1);
      ctx.globalAlpha = 1;
    }
    drawStone(ctx, sniper);
    if (pumperDrive.laser > 0.02 && balloon.alive) drawLasers(ctx, pumperView.eyes, geometry.centre, pumperDrive.laser, time, reduced);
    // The word outlives the crash by the few frames its spring takes to shrink it away.
    if (pop.x > 0.02) drawPop(ctx, balloon.burstAt, burstEnding, clamp(pop.x, 0, 1.3));
    if (secured && badge.x > 0.02) drawBadge(ctx, secured, clamp(badge.x, 0, 1.3), time);
    ctx.restore();
    // The readout grows leftward with every digit, so the caption gets the width left between them, 24 units clear.
    const readout = `${multiplier.toFixed(2)}×`;
    drawCaption(ctx, caption, 1 + 0.1 * captionPop.x, Math.min(560, 2 * (READOUT_X - readoutWidth(ctx, readout) - 24 - CAPTION_X)));
    drawReadout(ctx, view, readout, crashed);
  }

  return { draw };
}
