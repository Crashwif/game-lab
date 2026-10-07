/**
 * The worker: the player's stand-in on top of the stack. He hops onto each
 * new floor, leans against the sway and flails when it gets bad. An accepted
 * exit calls the hoist: he steps in, rides down and stands clear. A crash with
 * him still up there sends him down with the floors.
 */
import { type Spring, clamp, mix, settleSpring, spring, stepSpring } from './motion';
import { FLOOR_H, GROUND_Y, RAIL_DX, TOWER_X, type TowerState, offsetAtY, topOffset, topVelocity, towerTopY } from './tower';

export type WorkerMode = 'top' | 'calling' | 'boarding' | 'riding' | 'safe' | 'falling' | 'down';
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
  lean: Spring;
  arms: Spring;
  shades: Spring;
  duck: Spring;
  cage: { x: number; y: number; active: boolean; speed: number };
  fall: { vx: number; vy: number; angle: number; spin: number };
  fear: number;
  /** Standing on the block that is still coming down. */
  onLoad: boolean;
  lastSurface: number;
}

/** The incoming block while it is close enough to climb onto: its centre x and top surface. */
export interface Landing { x: number; topY: number }

export function createWorker(): WorkerState {
  return { mode: 'top', time: 0, modeAge: 0, x: TOWER_X - 12, y: GROUND_Y, hop: spring(0), lean: spring(0), arms: spring(0), shades: spring(0), duck: spring(0), cage: { x: TOWER_X + RAIL_DX, y: GROUND_Y, active: false, speed: 260 }, fall: { vx: 0, vy: 0, angle: 0, spin: 0 }, fear: 0, onLoad: false, lastSurface: GROUND_Y };
}

export function resetWorker(w: WorkerState): void {
  w.mode = 'top';
  w.modeAge = 0;
  w.x = TOWER_X - 12;
  w.y = GROUND_Y;
  settleSpring(w.hop, 0);
  settleSpring(w.lean, 0);
  settleSpring(w.arms, 0);
  settleSpring(w.shades, 0);
  settleSpring(w.duck, 0);
  w.cage = { x: TOWER_X + RAIL_DX, y: GROUND_Y, active: false, speed: 260 };
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
  w.cage = { x: TOWER_X + RAIL_DX, y: GROUND_Y, active: false, speed: 260 };
  settleSpring(w.hop, 0);
  settleSpring(w.lean, 0);
  settleSpring(w.arms, 0.05);
  settleSpring(w.shades, 1);
  settleSpring(w.duck, 0);
  w.onLoad = false;
}

/** The joints let go. `quiet` skips to how it ended, for a collapse the scene did not see happen. */
export function towerFell(w: WorkerState, tower: TowerState, dir: number, quiet = false): void {
  if (quiet) {
    // Flat by the rubble if he was still up there, clear of it if the exit was accepted.
    if (w.mode === 'top' || w.mode === 'falling') {
      setMode(w, 'down');
      w.x = TOWER_X - 40;
      w.y = GROUND_Y;
    } else if (w.mode !== 'down') settleSafe(w);
  } else if (w.mode === 'top') {
    setMode(w, 'falling');
    w.fall = { vx: topVelocity(tower) + dir * 90, vy: -160, angle: 0, spin: dir * 5 };
  } else if (w.mode === 'calling' || w.mode === 'boarding' || w.mode === 'riding') {
    // The exit was accepted: the cage drops him clear on its emergency brake.
    setMode(w, 'riding');
    w.cage.active = true;
    w.cage.speed = 700;
    w.x = w.cage.x;
  } else if (w.mode === 'safe') {
    w.duck.v += 8;
  }
}

export function stepWorker(w: WorkerState, tower: TowerState, fear: number, landing: Landing | null, dt: number): void {
  w.time += dt;
  w.modeAge += dt;
  w.fear = fear;
  const topY = towerTopY(tower);
  const railX = (y: number): number => TOWER_X + RAIL_DX + offsetAtY(tower, y);
  const swayV = topVelocity(tower);
  switch (w.mode) {
    case 'top': {
      // When the next block comes down within reach he climbs onto it, so it carries him up as it sets.
      const onLoad = landing !== null;
      const surface = landing ? landing.topY : topY;
      if (onLoad !== w.onLoad) {
        const previous = onLoad ? topY : w.lastSurface;
        w.hop.x += previous - surface;
        w.onLoad = onLoad;
      }
      w.lastSurface = surface;
      w.x = (landing ? landing.x : TOWER_X + topOffset(tower)) - 12;
      w.y = surface + Math.min(w.hop.x, FLOOR_H * 1.5);
      stepSpring(w.hop, 0, 16, 0.6, dt);
      stepSpring(w.lean, clamp(-swayV * 0.006, -0.45, 0.45), 10, 0.7, dt);
      stepSpring(w.arms, clamp(Math.abs(swayV) / 140, 0, 1) * 0.8 + fear * 0.35, 8, 0.6, dt);
      break;
    }
    case 'calling': {
      w.x = TOWER_X + topOffset(tower) - 12;
      w.y = topY;
      stepSpring(w.lean, clamp(-swayV * 0.006, -0.45, 0.45), 10, 0.7, dt);
      stepSpring(w.arms, 0.9, 8, 0.6, dt);
      w.cage.y = Math.max(topY, w.cage.y - w.cage.speed * dt);
      w.cage.x = railX(w.cage.y);
      if (w.cage.y <= topY + 0.5) setMode(w, 'boarding');
      break;
    }
    case 'boarding': {
      const k = clamp(w.modeAge / 0.45, 0, 1);
      w.cage.y = topY;
      w.cage.x = railX(w.cage.y);
      w.x = mix(TOWER_X + topOffset(tower) - 12, w.cage.x, k);
      w.y = topY;
      stepSpring(w.lean, 0, 10, 0.7, dt);
      stepSpring(w.arms, 0.2, 8, 0.6, dt);
      if (k >= 1) { setMode(w, 'riding'); w.cage.speed = 260; }
      break;
    }
    case 'riding':
      w.cage.y = Math.min(GROUND_Y, w.cage.y + w.cage.speed * dt);
      w.cage.x = railX(w.cage.y);
      w.x = w.cage.x;
      w.y = w.cage.y;
      stepSpring(w.lean, 0, 10, 0.7, dt);
      stepSpring(w.arms, 0.15, 8, 0.6, dt);
      if (w.cage.y >= GROUND_Y) setMode(w, 'safe');
      break;
    case 'safe': {
      const k = clamp(w.modeAge / 0.7, 0, 1);
      w.x = mix(w.cage.x, SAFE_X, k * k * (3 - 2 * k));
      w.y = GROUND_Y;
      if (w.modeAge > 0.9) w.cage.active = false;
      stepSpring(w.shades, 1, 12, 0.5, dt);
      stepSpring(w.lean, 0, 10, 0.7, dt);
      stepSpring(w.arms, 0.05 + Math.sin(w.time * 1.4) * 0.05, 8, 0.6, dt);
      stepSpring(w.duck, 0, 9, 0.5, dt);
      break;
    }
    case 'falling':
      w.fall.vy += GRAVITY * dt;
      w.x += w.fall.vx * dt;
      w.y += w.fall.vy * dt;
      w.fall.angle += w.fall.spin * dt;
      stepSpring(w.arms, 1, 8, 0.6, dt);
      if (w.y >= GROUND_Y) { w.y = GROUND_Y; setMode(w, 'down'); }
      break;
    case 'down':
      break;
  }
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
  if (w.mode === 'down') { ctx.translate(0, -6); ctx.rotate(-Math.PI / 2); ctx.translate(0, 8); }
  else if (w.mode === 'falling') { ctx.translate(0, -24); ctx.rotate(w.fall.angle); ctx.translate(0, 24); }
  else ctx.rotate(w.lean.x);
  const duck = clamp(w.duck.x, 0, 1);
  ctx.translate(0, duck * 8);
  ctx.scale(1, 1 - duck * 0.18);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (x0: number, y0: number, x1: number, y1: number, width: number, colour: string) => {
    ctx.strokeStyle = INK; ctx.lineWidth = width + 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
  };
  // Legs and boots.
  const stride = w.mode === 'falling' ? 10 : w.mode === 'boarding' ? Math.sin(w.modeAge * 14) * 5 : 0;
  line(-5, -20, -7 - stride, 0, 5, '#2f3f5c');
  line(5, -20, 7 + stride, 0, 5, '#2f3f5c');
  ctx.fillStyle = '#4a3728';
  ctx.beginPath(); ctx.roundRect(-12 - stride, -3, 10, 5, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(2 + stride, -3, 10, 5, 2); ctx.fill();
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
  if (!w.cage.active) return;
  const { x, y } = w.cage;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  if (!front) {
    ctx.fillStyle = 'rgba(180, 190, 200, 0.55)';
    ctx.beginPath(); ctx.roundRect(x - 15, y - 44, 30, 46, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4b400';
    ctx.fillRect(x - 15, y - 48, 30, 5);
    return;
  }
  ctx.strokeStyle = '#7d8590';
  ctx.lineWidth = 2;
  for (const by of [-34, -22, -10]) { ctx.beginPath(); ctx.moveTo(x - 13, y + by); ctx.lineTo(x + 13, y + by); ctx.stroke(); }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x - 15, y - 44, 30, 46, 3); ctx.stroke();
}
