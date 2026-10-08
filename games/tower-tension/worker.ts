/**
 * The worker: the player's stand-in on top of the stack. He steps onto each
 * new floor as it comes down, leans against the sway and flails when it gets
 * bad. An accepted exit calls the hoist: he steps in, rides down and walks
 * clear. A crash with him still up there sends him down with the floors, and
 * he topples flat where he lands. His steps follow the distance he covers.
 */
import { type Spring, clamp, mix, settleSpring, spring, stepSpring } from './motion';
import { GROUND_Y, RAIL_DX, TOWER_X, type TowerState, offsetAtY, topOffset, topVelocity, towerTopY } from './tower';

export type WorkerMode = 'top' | 'calling' | 'boarding' | 'rescuing' | 'riding' | 'safe' | 'falling' | 'down';
export const SAFE_X = TOWER_X + 190;
const GRAVITY = 900;
const INK = '#1c1f26';
const SKIN = '#f3dccb';

export interface WorkerState {
  mode: WorkerMode;
  time: number;
  modeAge: number;
  /** World position of the feet. */
  x: number;
  y: number;
  /** Vertical offset from the surface he stands on; positive is below it. */
  hop: Spring;
  /** Horizontal offset from where he stands, walked off: stepping onto a block, walking back to a new site. */
  slide: Spring;
  /** How much he is striding (0 to 1), the way he is walking, and the tilt he is picking himself up from. */
  stride: Spring;
  dir: number;
  tip: Spring;
  lastBase: number;
  lean: Spring;
  arms: Spring;
  shades: Spring;
  duck: Spring;
  /** The hoist cage; `shown` fades it out once it is no longer needed. */
  cage: { x: number; y: number; active: boolean; speed: number; shown: number };
  fall: { vx: number; vy: number; angle: number; spin: number };
  fear: number;
  /** A new site opened while he was still coming down: he starts over once he is on the ground. */
  pending: boolean;
  /** Standing on the block that is still coming down. */
  onLoad: boolean;
  lastSurface: number;
  rescue?: { x: number; y: number; cageY: number; duration: number };
  walked: number;
}

/** The incoming block while it is close enough to climb onto: its centre x and top surface. */
export interface Landing { x: number; topY: number }

export function createWorker(): WorkerState {
  return { mode: 'top', time: 0, modeAge: 0, x: TOWER_X - 12, y: GROUND_Y, hop: spring(0), slide: spring(0), stride: spring(0), dir: 1, tip: spring(0), lastBase: TOWER_X - 12, lean: spring(0), arms: spring(0), shades: spring(0), duck: spring(0), cage: parkedCage(), fall: { vx: 0, vy: 0, angle: 0, spin: 0 }, fear: 0, pending: false, onLoad: false, lastSurface: GROUND_Y, walked: 0 };
}

/** The hoist cage parked out of sight at the foot of the rail. */
const parkedCage = (): WorkerState['cage'] => ({ x: TOWER_X + RAIL_DX, y: GROUND_Y, active: false, speed: 260, shown: 0 });

/** Wraps an angle into -π..π. */
const wrap = (a: number): number => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
/** How high the middle of his body (24 px up when he stands) sits off the ground at a tilt: 9 px lying down. */
const bodyLift = (angle: number): number => 24 * Math.abs(Math.cos(angle)) + 9 * Math.abs(Math.sin(angle));

/**
 * A fresh site. He picks himself up from wherever the last round left him and walks back over, his shades
 * coming off on the way, rather than popping onto the foundation. Still in the air (thrown from a tall stack, or
 * the cage braking down), he gets there first.
 */
export function resetWorker(w: WorkerState): void {
  w.pending = w.mode === 'falling' || w.mode === 'rescuing' || w.mode === 'riding';
  if (w.pending) return;
  const fallen = w.mode === 'down';
  const from = w.x;
  w.mode = 'top';
  w.walked = 0; w.rescue = undefined;
  w.modeAge = 0;
  w.lastBase = TOWER_X - 12;
  w.y = GROUND_Y;
  settleSpring(w.tip, fallen ? wrap(w.fall.angle) : 0);
  settleSpring(w.slide, from - w.lastBase);
  settleSpring(w.hop, 0);
  settleSpring(w.duck, 0);
  // A cage parked at the foot of the rail fades out where it stands.
  w.cage.active = false;
  w.onLoad = false;
  w.lastSurface = GROUND_Y;
}

function setMode(w: WorkerState, mode: WorkerMode): void {
  w.mode = mode;
  w.modeAge = 0;
}

/** The server accepted the exit: call the hoist. */
export function callHoist(w: WorkerState): void {
  if (w.mode !== 'top') return;
  setMode(w, 'calling');
  w.cage.active = true;
  w.cage.y = GROUND_Y;
  w.cage.speed = 320;
}

/** Puts him clear of the site in his shades, as the ride down leaves him: an exit the scene never saw him take. */
export function settleSafe(w: WorkerState): void {
  setMode(w, 'safe');
  // Long enough ago that the cage has parked and the camera has gone back up to the stack.
  w.modeAge = 2;
  w.x = SAFE_X;
  w.y = GROUND_Y;
  w.cage = parkedCage();
  settleSpring(w.hop, 0);
  settleSpring(w.slide, 0);
  settleSpring(w.stride, 0);
  settleSpring(w.tip, 0);
  settleSpring(w.lean, 0);
  settleSpring(w.arms, 0.05);
  settleSpring(w.shades, 1);
  settleSpring(w.duck, 0);
  w.onLoad = false;
}

/** The joints let go. `quiet` skips to how it ended, for a collapse the scene did not see happen. */
export function towerFell(w: WorkerState, tower: TowerState, dir: number, quiet = false, inheritedVelocity = topVelocity(tower)): void {
  if (quiet) {
    // Flat by the rubble if he was still up there, clear of it if the exit was accepted.
    if (w.mode === 'top' || w.mode === 'falling') {
      setMode(w, 'down');
      w.x = TOWER_X - 40;
      w.fall = { vx: 0, vy: 0, angle: -Math.PI / 2, spin: 0 };
      w.y = GROUND_Y + 24 - bodyLift(w.fall.angle);
    } else if (w.mode !== 'down') settleSafe(w);
  } else if (w.mode === 'top') {
    setMode(w, 'falling');
    w.fall = { vx: inheritedVelocity + dir * 90, vy: -160, angle: 0, spin: dir * 5 };
  } else if (w.mode === 'calling' || w.mode === 'boarding' || w.mode === 'riding') {
    // The exit was accepted: the cage drops him clear on its emergency brake.
    if (w.mode !== 'riding') {
      w.rescue = { x: w.x, y: w.y, cageY: w.cage.y, duration: Math.max(0.3, Math.min(0.85, Math.abs(w.cage.y - w.y) / 1400)) };
      setMode(w, 'rescuing');
    }
    w.cage.active = true;
    w.cage.speed = 700;
  } else if (w.mode === 'safe') {
    w.duck.v += 8;
  }
}

export function stepWorker(w: WorkerState, tower: TowerState, fear: number, landing: Landing | null, dt: number): void {
  const previousX = w.x;
  const previousSlide = w.slide.x;
  w.time += dt;
  w.modeAge += dt;
  w.fear = fear;
  const topY = towerTopY(tower);
  const railX = (y: number): number => TOWER_X + RAIL_DX + offsetAtY(tower, y);
  const swayV = topVelocity(tower);
  const standing = w.mode === 'top' || w.mode === 'calling' || w.mode === 'boarding';
  if (standing) {
    // When the next block comes down within reach he steps onto it, so it carries him up as it sets; the hop and
    // the slide carry him across rather than snapping him to it, whatever he was doing.
    const onLoad = landing !== null;
    const surface = landing ? landing.topY : topY;
    const base = (landing ? landing.x : TOWER_X + topOffset(tower)) - 12;
    if (onLoad !== w.onLoad) {
      w.hop.x += (onLoad ? topY : w.lastSurface) - surface;
      w.slide.x += w.lastBase - base;
      w.onLoad = onLoad;
    }
    w.lastSurface = surface;
    w.lastBase = base;
    w.x = base + w.slide.x;
    w.y = surface + w.hop.x;
    stepSpring(w.hop, 0, 16, 0.6, dt);
    // He walks off the slide at a walking pace, easing in and out of it.
    const want = clamp(-w.slide.x * 5, -150, 150);
    w.slide.v += (want - w.slide.v) * (1 - Math.exp(-12 * dt));
    w.slide.x += w.slide.v * dt;
    stepSpring(w.tip, 0, 6, 0.9, dt);
    stepSpring(w.shades, 0, 6, 1, dt);
  }
  switch (w.mode) {
    case 'top':
      stepSpring(w.lean, clamp(-swayV * 0.006, -0.45, 0.45), 10, 0.7, dt);
      stepSpring(w.arms, clamp(Math.abs(swayV) / 140, 0, 1) * 0.8 + fear * 0.35, 8, 0.6, dt);
      break;
    case 'calling': {
      stepSpring(w.lean, clamp(-swayV * 0.006, -0.45, 0.45), 10, 0.7, dt);
      stepSpring(w.arms, 0.9, 8, 0.6, dt);
      w.cage.y = Math.max(topY, w.cage.y - w.cage.speed * dt);
      w.cage.x = railX(w.cage.y);
      if (w.cage.y <= topY + 0.5) setMode(w, 'boarding');
      break;
    }
    case 'boarding': {
      // The cage waits on the rail where it stopped; he walks from wherever he stands into it.
      const k = clamp(w.modeAge / 0.6, 0, 1);
      const e = k * k * (3 - 2 * k);
      w.cage.x = railX(w.cage.y);
      w.x = mix(w.x, w.cage.x, e);
      w.y = mix(w.y, w.cage.y, e);
      stepSpring(w.lean, 0, 10, 0.7, dt);
      stepSpring(w.arms, 0.2, 8, 0.6, dt);
      if (k >= 1) { setMode(w, 'riding'); w.cage.speed = 260; }
      break;
    }
    case 'rescuing': {
      const r = w.rescue!, t = clamp(w.modeAge / r.duration, 0, 1), k = t * t * (3 - 2 * t);
      w.cage.y = mix(r.cageY, r.y, k);
      w.x = mix(r.x, w.cage.x, k); w.y = r.y - Math.sin(Math.PI * t) * 10;
      stepSpring(w.arms, 1, 12, 0.8, dt);
      if (t >= 1) setMode(w, 'riding');
      break;
    }
    case 'riding':
      w.cage.y = Math.min(GROUND_Y, w.cage.y + w.cage.speed * dt);
      w.cage.x = railX(w.cage.y);
      w.x = w.cage.x;
      w.y = w.cage.y;
      stepSpring(w.lean, 0, 10, 0.7, dt);
      stepSpring(w.arms, 0.15, 8, 0.6, dt);
      if (w.cage.y >= GROUND_Y) {
        setMode(w, 'safe');
        if (w.pending) resetWorker(w);
      }
      break;
    case 'safe': {
      const k = clamp(w.modeAge / 1, 0, 1);
      w.x = mix(w.cage.x, SAFE_X, k * k * (3 - 2 * k));
      w.y = GROUND_Y;
      stepSpring(w.shades, 1, 12, 0.5, dt);
      stepSpring(w.lean, 0, 10, 0.7, dt);
      stepSpring(w.arms, 0.05 + Math.sin(w.time * 1.4) * 0.05, 8, 0.6, dt);
      stepSpring(w.duck, 0, 9, 0.5, dt);
      break;
    }
    case 'falling': {
      // (w.x, w.y - 24) is the middle of his body, which he spins about.
      const f = w.fall;
      f.vy += GRAVITY * dt;
      w.x += f.vx * dt;
      w.y += f.vy * dt;
      f.angle += f.spin * dt;
      stepSpring(w.arms, 1, 8, 0.6, dt);
      const lift = bodyLift(f.angle);
      if (w.y - 24 + lift >= GROUND_Y - 1 && f.vy > -80) {
        w.y = GROUND_Y + 24 - lift;
        if (f.vy > 80) { f.vy = -f.vy * 0.3; f.vx *= 0.5; f.spin *= 0.5; }
        else {
          // Down on the ground he rides it as he topples onto his side the way he was going, then lies still.
          f.vy = 0;
          const off = f.angle - (Math.round(f.angle / Math.PI - 0.5) + 0.5) * Math.PI;
          f.spin = (f.spin - 26 * off * dt) * Math.exp(-6 * dt);
          f.vx *= Math.exp(-6 * dt);
          if (Math.abs(off) < 0.03 && Math.abs(f.spin) < 0.4) {
            setMode(w, 'down');
            if (w.pending) resetWorker(w);
          }
        }
      }
      break;
    }
    case 'down':
      break;
  }
  // The cage comes into view as it is called, and goes once a new site no longer needs it where it parked.
  w.cage.shown = clamp(w.cage.shown + (w.cage.active ? dt : -dt) / 0.3, 0, 1);
  // His feet follow the ground he covers: walking into the cage and clear of it, and stepping off a slide.
  const walk = w.mode === 'boarding' || w.mode === 'safe' ? w.x - previousX : standing ? w.slide.x - previousSlide : 0;
  w.walked += Math.abs(walk);
  if (Math.abs(walk) > 0.01) w.dir = Math.sign(walk);
  stepSpring(w.stride, dt > 0 ? clamp(Math.abs(walk) / dt / 30, 0, 1) : w.stride.x, 24, 1, dt);
}

function drawFace(ctx: CanvasRenderingContext2D, w: WorkerState, mood: 'calm' | 'worried' | 'panic' | 'smug' | 'out'): void {
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -48, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineCap = 'round';
  if (mood === 'out') {
    ctx.lineWidth = 1.6;
    for (const ex of [-4, 4]) { ctx.beginPath(); ctx.moveTo(ex - 2, -51); ctx.lineTo(ex + 2, -47); ctx.moveTo(ex + 2, -51); ctx.lineTo(ex - 2, -47); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, -43, 2.5, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.fillStyle = INK;
    const open = mood === 'panic' ? 1.6 : 1;
    for (const ex of [-3.5, 3.5]) { ctx.beginPath(); ctx.ellipse(ex, -49.5, 1.6, 1.6 * open, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (mood === 'panic') { ctx.ellipse(0, -43, 2.6, 3.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else if (mood === 'worried') { ctx.moveTo(-3, -43); ctx.lineTo(3, -43.5); }
    else { ctx.moveTo(-3.5, -44); ctx.quadraticCurveTo(0, -41 + (mood === 'smug' ? -1 : 0), 3.5, -44.5); }
    ctx.stroke();
    if (mood !== 'calm' && mood !== 'smug') {
      ctx.beginPath(); ctx.moveTo(-6, -55); ctx.lineTo(-1, -56.5); ctx.moveTo(1, -56.5); ctx.lineTo(6, -55); ctx.stroke();
    }
  }
  // Hard hat.
  ctx.fillStyle = '#f4c20d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -51, 10.5, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-13, -51); ctx.lineTo(13, -51); ctx.stroke();
  const shades = clamp(w.shades.x, 0, 1);
  if (shades > 0.02) {
    const dy = -60 * (1 - shades);
    ctx.fillStyle = INK;
    ctx.fillRect(-8, -52 + dy, 6.5, 4.5);
    ctx.fillRect(1.5, -52 + dy, 6.5, 4.5);
    ctx.fillRect(-1.5, -51 + dy, 3, 1.5);
  }
}

export function drawWorker(ctx: CanvasRenderingContext2D, w: WorkerState): void {
  const mood = w.mode === 'down' ? 'out' : w.mode === 'safe' ? 'smug' : w.mode === 'falling' ? 'panic' : w.arms.x > 0.75 || w.fear > 0.75 ? 'panic' : w.arms.x > 0.35 || w.fear > 0.4 ? 'worried' : 'calm';
  ctx.save();
  ctx.translate(w.x, w.y);
  // Falling and lying he turns about the middle of his body; getting up he pivots so he stays on the ground.
  const fallen = w.mode === 'falling' || w.mode === 'down';
  const tip = fallen ? w.fall.angle : w.tip.x;
  if (fallen || Math.abs(tip) > 0.002) { ctx.translate(0, fallen ? -24 : -bodyLift(tip)); ctx.rotate(tip); ctx.translate(0, 24); }

  const duck = clamp(w.duck.x + Math.abs(w.hop.v) * 0.002, 0, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (x0: number, y0: number, x1: number, y1: number, width: number, colour: string) => {
    ctx.strokeStyle = INK; ctx.lineWidth = width + 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
  };
  // Legs: two 11 px bones from hips 20 px up, so he stands with a slight bend. Each foot is planted for 60% of a
  // 30 px stride while the body walks over it (so it never skates), then swings forward; standing, the knees bow
  // out, walking they point the way he goes. Leaning into the sway or at the ends of a stride, the hips drop as
  // far as the further foot needs, so the knees bend rather than the legs stretching past their bones.
  const shift = Math.sin(w.lean.x) * 16, amp = clamp(w.stride.x, 0, 1);
  const feet = [-1, 1].map((side) => {
    const p = (w.walked / 30 + (side > 0 ? 0.5 : 0)) % 1, q = (p - 0.6) / 0.4;
    const f = (p < 0.6 ? 0.3 - p : -0.3 + 0.6 * q * q * (3 - 2 * q)) * 30 * amp * w.dir;
    return { side, fx: side * 7 + f, fy: p > 0.6 ? -Math.sin(Math.PI * q) * 6 * amp : 0 };
  });
  const sink = Math.max(duck * 6, ...feet.map(({ side, fx, fy }) => 20 + fy - Math.sqrt(Math.max(0, 21.6 ** 2 - (fx - side * 5 - shift) ** 2))));
  for (const { side, fx, fy } of feet) {
    const hx = side * 5 + shift, hy = -20 + sink, dx = fx - hx, dy = fy - hy, d = Math.max(0.001, Math.hypot(dx, dy)), bend = Math.sqrt(Math.max(0, 11 ** 2 - d * d / 4));
    const pole = mix(side, w.dir, amp);
    const kx = (hx + fx) / 2 + pole * dy / d * bend, ky = (hy + fy) / 2 - pole * dx / d * bend;
    line(hx, hy, kx, ky, 5, '#2f3f5c'); line(kx, ky, fx, fy, 5, '#2f3f5c');
    ctx.fillStyle = '#4a3728'; ctx.beginPath(); ctx.roundRect(fx - 5, fy - 3, 10, 5, 2); ctx.fill();
  }
  ctx.translate(shift, sink); ctx.translate(0, -20); ctx.rotate(w.lean.x * 0.45); ctx.translate(0, 20);
  // Body in the vest.
  ctx.fillStyle = '#ff8c1a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-11, -39, 22, 21, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f7f2c6';
  ctx.fillRect(-11, -31, 22, 3);
  ctx.fillRect(-11, -25, 22, 3);
  // Arms: down when calm, up and out when it gets wobbly.
  const raise = clamp(w.arms.x, 0, 1.2);
  for (const side of [-1, 1]) {
    const angle = side * (0.12 + raise * 1.8);
    const shoulder = { x: side * 10, y: -35 };
    const elbow = { x: shoulder.x + Math.sin(angle) * 13, y: shoulder.y + Math.cos(angle) * 13 };
    const forearm = angle + side * (0.4 + Math.sin(w.time * 4 + side) * raise * 0.2);
    const hand = { x: elbow.x + Math.sin(forearm) * 12, y: elbow.y + Math.cos(forearm) * 12 };
    line(shoulder.x, shoulder.y, elbow.x, elbow.y, 5, SKIN);
    line(elbow.x, elbow.y, hand.x, hand.y, 5, SKIN);
  }
  drawFace(ctx, w, mood);
  if (mood !== 'calm' && mood !== 'smug' && mood !== 'out') {
    const p = (w.time / 0.9) % 1;
    ctx.fillStyle = '#8fd3ff';
    ctx.globalAlpha = 1 - p;
    ctx.beginPath(); ctx.arc(12, -52 + p * 12, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** The hoist cage on the tower's rail. Draw the back before the worker, the bars after him. */
export function drawCage(ctx: CanvasRenderingContext2D, w: WorkerState, front: boolean): void {
  if (w.cage.shown < 0.02) return;
  const { x, y } = w.cage;
  ctx.save();
  ctx.globalAlpha *= w.cage.shown;
  if (!front && w.mode === 'rescuing') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, Math.min(y, w.y) - 75); ctx.lineTo(w.x, w.y - 48); ctx.stroke(); }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  if (!front) {
    ctx.fillStyle = 'rgba(180, 190, 200, 0.55)';
    ctx.beginPath(); ctx.roundRect(x - 15, y - 44, 30, 46, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4b400';
    ctx.fillRect(x - 15, y - 48, 30, 5);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = '#7d8590';
  ctx.lineWidth = 2;
  for (const by of [-34, -22, -10]) { ctx.beginPath(); ctx.moveTo(x - 13, y + by); ctx.lineTo(x + 13, y + by); ctx.stroke(); }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x - 15, y - 44, 30, 46, 3); ctx.stroke();
  // The placard slung under the cage says what it is.
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - 12, y + 2); ctx.lineTo(x - 16, y + 6); ctx.moveTo(x + 12, y + 2); ctx.lineTo(x + 16, y + 6); ctx.stroke();
  ctx.fillStyle = '#7cf67c';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x - 25, y + 5, 50, 11, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 8px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT LIQUIDITY', x, y + 11, 46);
  ctx.restore();
}
