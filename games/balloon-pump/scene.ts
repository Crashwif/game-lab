/**
 * Composes the scene from the room state: sky, the round's own chart, ground,
 * hose, the pumper and the balloon, then the meme layer (captions, readout,
 * lasers, the burst text). All motion is stepped here with the real frame time,
 * and nothing drawn here changes the committed outcome.
 */
import { TETHER, type BalloonDrive, balloonGeometry, burstBalloon, createBalloon, drawBalloon, drawBalloonShadow, resetBalloon, settleBalloon, stepBalloon } from './balloon';
import { airPacket, clamp, noise, smoothstep, spring, stepSpring } from './motion';
import { PUMP, type Point, type PumperDrive, createPumper, drawPumper, stepPumper } from './pumper';

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

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'SHOULD HAVE SOLD' : outcome === 'called' ? 'CALLED IT' : 'NOT STONKS';
  if (view.phase !== 'running') return 'WEN PUMP?';
  if (secured) return 'DEAL WITH IT';
  if (multiplier < 1.5) return 'PUMP IT';
  if (multiplier < 2) return 'NUMBER GO UP';
  if (multiplier < 3) return 'HODL';
  if (multiplier < 5) return 'WEN LAMBO';
  if (multiplier < 10) return 'DIAMOND HANDS';
  if (multiplier < 25) return 'TO THE MOON';
  return 'THIS IS FINE';
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

/** The round's multiplier over time as a rising line, red and pointing down once it crashed. */
function drawTrail(ctx: CanvasRenderingContext2D, trail: Point[], dead: boolean): void {
  if (trail.length < 2) return;
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

function drawPop(ctx: CanvasRenderingContext2D, at: Point, text: string, scale: number): void {
  ctx.save();
  ctx.translate(at.x, Math.min(at.y + 30, 400));
  ctx.rotate(-0.12);
  ctx.scale(scale, scale);
  memeText(ctx, text, 0, 0, 96, text === 'REKT' ? '#ff4d6d' : '#ffe27a', 'center');
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

function drawCaption(ctx: CanvasRenderingContext2D, caption: string, scale: number): void {
  if (!caption) return;
  ctx.save();
  ctx.translate(430, 68);
  ctx.scale(scale, scale);
  memeText(ctx, caption, 0, 0, 46, '#ffffff', 'center', 560);
  ctx.restore();
}

function drawReadout(ctx: CanvasRenderingContext2D, view: SceneView, multiplier: number, dead: boolean): void {
  const colour = dead ? '#ff4d6d' : view.phase === 'running' ? '#ffffff' : '#ffe08a';
  ctx.save();
  if (view.phase !== 'running' && !dead) ctx.globalAlpha = 0.85;
  memeText(ctx, `${multiplier.toFixed(2)}×`, 930, 80, 66, colour, 'right');
  ctx.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const pumper = createPumper();
  const balloon = createBalloon();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const laser = spring(0);
  const stars: Star[] = Array.from({ length: 46 }, (_, i) => ({ x: noise(i * 3.1) * W, y: 8 + noise(i * 7.7) * 250, r: 0.7 + noise(i * 1.3) * 1.5, k: 1 + noise(i * 5.9) * 2 }));
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let trail: Point[] = [];
  let trailAt = -1;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const fear = clamp((growth - 0.35) / 2.8, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };
    const balloonDrive: BalloonDrive = {
      radius: running || crashed ? 40 + 150 * (1 - Math.exp(-growth / 2.3)) : 36,
      fear,
      stretch: smoothstep(0.8, 4.2, growth),
      inflow: false,
    };

    // Phase edges: the burst, and a fresh balloon for the next round.
    if (previous === null) {
      previous = view.phase;
      settleBalloon(balloon, balloonDrive);
      if (crashed) {
        burstBalloon(balloon, view.currentX100, true);
        outcome = 'pop';
        pop.x = 1;
      }
    } else if (view.phase !== previous) {
      if (crashed && balloon.alive) {
        const quiet = view.crashAge > 1500;
        burstBalloon(balloon, view.currentX100, quiet);
        outcome = view.stake === null ? 'pop' : secured ? 'called' : 'rekt';
        if (quiet) pop.x = 1;
        else { shake = 1; pop.v = 16; }
      }
      if (view.phase === 'betting') {
        resetBalloon(balloon);
        outcome = null;
        secured = null;
        trail = [];
        trailAt = -1;
      }
      previous = view.phase;
    }

    // Step the rig, then the balloon it feeds, then the meme layer's springs.
    const pumperDrive: PumperDrive = {
      pumping: running,
      rate: Math.min(2.1, 0.85 + 1.2 * (1 - Math.exp(-growth / 2.2))),
      fear,
      fallen: crashed,
      crying: outcome === 'rekt',
      smug: secured !== null,
      laser: 0,
      gauge: 1 - Math.exp(-growth / 2.4),
      gaze: TETHER,
    };
    stepPumper(pumper, pumperDrive, dt);
    balloonDrive.inflow = running && pumper.events.bottom;
    stepBalloon(balloon, balloonDrive, dt);
    const geometry = balloonGeometry(balloon);
    pumperDrive.gaze = balloon.alive ? geometry.centre : { x: TETHER.x, y: TETHER.y - 80 };
    stepSpring(laser, running && balloon.alive ? smoothstep(1, 2.6, growth) : 0, 8, 1, dt);
    pumperDrive.laser = clamp(laser.x, 0, 1);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);
    if (running) {
      const at = Math.floor(view.elapsed / 100);
      if (at !== trailAt && trail.length < 900) {
        trailAt = at;
        trail.push({ x: 80 + 800 * (1 - Math.exp(-view.elapsed / 32000)), y: 440 - 84 * Math.min(growth, 4.2) });
      }
    }

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 9 * shake * shake, Math.cos(time * 117) * 6 * shake * shake);
    drawSky(ctx, time, stars, reduced);
    drawTrail(ctx, trail, outcome !== null);
    drawGround(ctx);
    drawHose(ctx, running ? airPacket(pumper.phase) : null);
    drawBalloonShadow(ctx, balloon);
    const pumperView = drawPumper(ctx, pumper, pumperDrive);
    drawBalloon(ctx, balloon);
    if (pumperDrive.laser > 0.02 && balloon.alive) drawLasers(ctx, pumperView.eyes, geometry.centre, pumperDrive.laser, time, reduced);
    if (outcome && pop.x > 0.02) drawPop(ctx, balloon.burstAt, outcome === 'rekt' ? 'REKT' : 'POP!', clamp(pop.x, 0, 1.3));
    if (secured && badge.x > 0.02) drawBadge(ctx, secured, clamp(badge.x, 0, 1.3), time);
    ctx.restore();
    drawCaption(ctx, caption, 1 + 0.1 * captionPop.x);
    drawReadout(ctx, view, multiplier, outcome !== null);
  }

  return { draw };
}
