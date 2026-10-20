/**
 * The delivery trucks. Every floor comes in from off screen on the flatbed of a semi: the truck brakes to a
 * stop under the crane's pickup point, the crane lifts the floor off its bed, and the empty truck pulls away
 * to the left while the next one rolls in from the right. The trucks run on the crane's cycle (the
 * continuous floor count), so at any pace each one is parked under the hook before it comes down for the
 * floor, and a page that joins mid-round finds them where the cycle puts them. Before a round the first
 * floor's truck drives in on its own clock. At the crash the truck under the crane bolts with whatever is
 * still on its bed, and the ones on their way brake hard and back out. Nothing here changes the committed
 * outcome.
 */
import { type Spring, clamp, mix, spring, stepSpring } from './motion';
import { drawWojakFace } from './people';
import { FLOOR_H, GROUND_Y, drawBlock } from './tower';

const INK = '#1c1f26';
const CAB = '#f4f5f7';
const STRIPE = '#e63946';
const CHROME = '#d5dae1';
const STEEL = '#5b636f';
const DARK = '#2b2f36';

/** Where a truck parks: the centre of its bed, under the crane's pickup point. */
export const PARK_X = 320;
/** The bed's top surface in world y; a floor waits on it centred half a floor higher. */
export const BED_Y = GROUND_Y - 27;
/** The point in a floor's cycle at which the crane lifts it off the bed. */
export const PICKUP = 0.25;
/**
 * The route, in floor cycles relative to the truck's own floor: it parks at PARK, a beat before the hook
 * comes down, and pulls away at GO once the floor is clear of the bed. It cruises at CRUISE px a cycle and
 * spends BRAKE of a cycle coming to a stop and PULL getting back up to speed.
 */
const PARK = -0.1;
const GO = 0.32;
const CRUISE = 1200;
const BRAKE = 0.35;
const PULL = 0.3;
/** Trucks exist between these bed positions, beyond the widest view the camera takes of the site. */
const ENTER_X = 2400;
const EXIT_X = -1400;
/** The drive-in before a round runs on its own clock: how long it takes, the last part of it braking. */
const DRIVE_IN_S = 2.4;
const DRIVE_IN_BRAKE_S = 1;
/** How far the bumper reaches ahead of the bed's centre, so a truck can start wholly out of view. */
const NOSE = 154;
const WHEEL_R = 9;
/** The bed sits this much lower with a floor on it. */
const SAG = 1.5;
/** The tractor's pitch on its springs: nose down braking, nose up pulling away (radians). */
const DIP = 0.035;
const SQUAT = -0.03;
/** The crash: how the truck under the crane bolts, how the ones on the way stop, wait and back out. */
const BOLT_DELAY_S = 0.25;
const BOLT_ACCEL = 700;
const BOLT_SPEED = 650;
const STOP_DECEL = 900;
const HALT_S = 0.7;
const REVERSE_ACCEL = 250;
const REVERSE_SPEED = 180;

type Mode = 'route' | 'arriving' | 'bolting' | 'stopping' | 'halted' | 'reversing';

export interface Truck {
  /** The floor it brings: its index in the stack, so it carries the tone that floor will have. */
  index: number;
  /** World x of the centre of its bed. */
  x: number;
  /** Speed in px/s, negative forward (the trucks face left): measured on the route, driven in the getaways. */
  v: number;
  loaded: boolean;
  mode: Mode;
  /** Seconds in the current mode. */
  age: number;
  /** The drive-in's cruising speed. */
  cruise: number;
  /** The tractor's pitch (nose down positive) and the bed's heave (px, down positive) on their springs. */
  pitch: Spring;
  heave: Spring;
}

export interface Fleet {
  trucks: Truck[];
  /** The floor whose truck sets off next. */
  next: number;
  /** The cycle position of the last step. */
  phase: number;
  /** What happened this step: trucks that pulled up under the crane, trucks that pulled away, trucks that bolted. */
  events: { parked: number; pulled: number; bolted: number };
}

export function createFleet(): Fleet {
  return { trucks: [], next: 0, phase: 0, events: { parked: 0, pulled: 0, bolted: 0 } };
}

/** Distance still to go `left` (cycles or seconds) before a stop: cruising at `speed`, then braking over the last `brake`. */
const toStop = (left: number, speed: number, brake: number): number => (left <= 0 ? 0 : left <= brake ? (speed * left * left) / (2 * brake) : speed * (left - brake / 2));
/** Distance covered `since` a standing start: gathering speed over `pull`, then cruising at `speed`. */
const fromRest = (since: number, speed: number, pull: number): number => (since <= 0 ? 0 : since <= pull ? (speed * since * since) / (2 * pull) : speed * (since - pull / 2));

/** Where floor `index`'s truck has its bed at cycle position `phase`: rolling in from the right, parked, then gone left. */
export const routeX = (index: number, phase: number): number => PARK_X + toStop(PARK - (phase - index), CRUISE, BRAKE) - fromRest(phase - index - GO, CRUISE, PULL);

function addTruck(f: Fleet, index: number, x: number, loaded: boolean, mode: Mode = 'route'): Truck {
  const truck: Truck = { index, x, v: 0, loaded, mode, age: 0, cruise: 0, pitch: spring(0), heave: spring(loaded ? SAG : 0) };
  f.trucks.push(truck);
  return truck;
}

/** Sends off, in order, every truck whose route has reached the far right of the site. */
function dispatch(f: Fleet, phase: number): void {
  while (routeX(f.next, phase) <= ENTER_X) {
    addTruck(f, f.next, routeX(f.next, phase), phase - f.next < PICKUP);
    f.next += 1;
  }
}

/**
 * A fresh site before a round. The first floor's truck stays if it is already there or on its way with the
 * floor (a page that opened between rounds); otherwise it drives in from beyond `right`, the view's right
 * edge in world x.
 */
export function resetFleet(f: Fleet, right: number): void {
  const ready = f.trucks.find((t) => t.index === 0 && t.loaded && (t.mode === 'route' || t.mode === 'arriving'));
  f.trucks = ready ? [ready] : [];
  f.next = 1;
  f.phase = 0;
  if (ready) return;
  const distance = Math.max(700, right + NOSE + 40 - PARK_X);
  const truck = addTruck(f, 0, PARK_X + distance, true, 'arriving');
  truck.cruise = distance / (DRIVE_IN_S - DRIVE_IN_BRAKE_S / 2);
}

/** The trucks where the cycle has them at `phase`: the first one waiting before a round, the convoy mid-round. */
export function settleFleet(f: Fleet, phase: number, running: boolean): void {
  f.trucks = [];
  f.phase = running ? phase : 0;
  if (!running) {
    addTruck(f, 0, PARK_X, true);
    f.next = 1;
    return;
  }
  f.next = Math.max(0, Math.floor(phase) - 4);
  while (routeX(f.next, phase) < EXIT_X) f.next += 1;
  dispatch(f, phase);
}

/** The crane takes floor `index` off its truck: where the floor sat, or null if no truck has it. */
export function unloadTruck(f: Fleet, index: number): { x: number; y: number } | null {
  const truck = f.trucks.find((t) => t.index === index && t.loaded);
  if (!truck) return null;
  truck.loaded = false;
  // Relieved of the weight, the bed springs up.
  truck.heave.v -= 30;
  return { x: truck.x, y: BED_Y + truck.heave.x - FLOOR_H / 2 };
}

/**
 * The crash: the truck under the crane bolts with whatever is on its bed, the ones on the way brake hard
 * and back out, and the ones already leaving floor it. `quiet` (a collapse the scene did not see) leaves the
 * site empty.
 */
export function scatterFleet(f: Fleet, quiet: boolean): void {
  if (quiet) {
    f.trucks = [];
    return;
  }
  for (const t of f.trucks) {
    t.age = 0;
    if (t.mode === 'arriving' || t.x > PARK_X + 1) t.mode = 'stopping';
    else t.mode = 'bolting';
  }
}

/**
 * Moves the trucks. While a round runs they keep to the route at the crane's cycle position `phase`;
 * otherwise only the drive-in and the crash's getaways move, on the clock.
 */
export function stepFleet(f: Fleet, phase: number, running: boolean, dt: number): void {
  f.events = { parked: 0, pulled: 0, bolted: 0 };
  if (dt <= 0) return;
  if (running) {
    // A jump in the cycle (a feed catching up) puts the convoy where it belongs rather than racing it there.
    if (Math.abs(phase - f.phase) > 0.5) settleFleet(f, phase, true);
    dispatch(f, phase);
  }
  for (const t of f.trucks) {
    t.age += dt;
    const x0 = t.x;
    let pitch = 0;
    switch (t.mode) {
      case 'route': {
        if (!running) break;
        const before = f.phase - t.index;
        const now = phase - t.index;
        t.x = routeX(t.index, phase);
        // The measured speed carries into a getaway if the crash comes mid-drive.
        t.v = mix(t.v, (t.x - x0) / dt, 1 - Math.exp(-dt / 0.1));
        if (before < PARK && now >= PARK) f.events.parked += 1;
        if (before < GO && now >= GO) f.events.pulled += 1;
        if (now < PARK && now >= PARK - BRAKE) pitch = DIP;
        else if (now >= GO && now < GO + PULL) pitch = SQUAT;
        break;
      }
      case 'arriving': {
        const left = DRIVE_IN_S - t.age;
        t.x = PARK_X + toStop(left, t.cruise, DRIVE_IN_BRAKE_S);
        t.v = (t.x - x0) / dt;
        if (left <= 0) {
          t.mode = 'route';
          t.age = 0;
          t.v = 0;
          f.events.parked += 1;
        } else if (left <= DRIVE_IN_BRAKE_S) pitch = DIP;
        break;
      }
      case 'bolting':
        if (t.age >= BOLT_DELAY_S) {
          if (t.age - dt < BOLT_DELAY_S && t.v > -100) f.events.bolted += 1;
          t.v = Math.max(-BOLT_SPEED, t.v - BOLT_ACCEL * dt);
          if (t.v > -BOLT_SPEED) pitch = SQUAT * 1.6;
        }
        t.x += t.v * dt;
        break;
      case 'stopping':
        t.v = Math.min(0, t.v + STOP_DECEL * dt);
        t.x += t.v * dt;
        pitch = DIP * 1.8;
        if (t.v >= 0) {
          t.mode = 'halted';
          t.age = 0;
        }
        break;
      case 'halted':
        if (t.age >= HALT_S) {
          t.mode = 'reversing';
          t.age = 0;
        }
        break;
      case 'reversing':
        t.v = Math.min(REVERSE_SPEED, t.v + REVERSE_ACCEL * dt);
        t.x += t.v * dt;
        pitch = t.v < REVERSE_SPEED ? -DIP : 0;
        break;
    }
    stepSpring(t.pitch, pitch, 9, 0.35, dt);
    stepSpring(t.heave, t.loaded ? SAG : 0, 12, 0.3, dt);
  }
  f.trucks = f.trucks.filter((t) => t.x > EXIT_X && t.x < ENTER_X + 400);
  if (running) f.phase = phase;
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, turn: number): void {
  ctx.fillStyle = '#23272e';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, -WHEEL_R, WHEEL_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b8bec7';
  ctx.beginPath(); ctx.arc(x, -WHEEL_R, 4.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6f757d';
  for (let i = 0; i < 5; i += 1) {
    const a = turn + (i * Math.PI * 2) / 5;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3.2, -WHEEL_R + Math.sin(a) * 3.2, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(x, -WHEEL_R, 1.4, 0, Math.PI * 2); ctx.fill();
}

/** The tractor, facing left, in the truck's frame (origin on the ground under the middle of the bed). */
function drawTractor(ctx: CanvasRenderingContext2D, t: Truck): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Chassis, fifth wheel and fuel tank.
  ctx.fillStyle = DARK;
  ctx.fillRect(-150, -19, 106, 6);
  ctx.fillStyle = '#3a4350';
  ctx.fillRect(-71, -22, 22, 4);
  ctx.fillStyle = CHROME;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-108, -25, 20, 10, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-105, -22); ctx.lineTo(-92, -22); ctx.stroke();
  // Air lines across to the trailer.
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = STRIPE;
  ctx.beginPath(); ctx.moveTo(-84, -40); ctx.quadraticCurveTo(-78, -30, -71, -26); ctx.stroke();
  ctx.strokeStyle = '#3b82f6';
  ctx.beginPath(); ctx.moveTo(-84, -36); ctx.quadraticCurveTo(-79, -27, -71, -24); ctx.stroke();
  // Exhaust stack behind the cab.
  ctx.fillStyle = CHROME;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-83, -75, 4, 52, 1.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = DARK;
  ctx.beginPath(); ctx.moveTo(-84, -75); ctx.lineTo(-77, -78); ctx.lineTo(-77, -75.5); ctx.closePath(); ctx.fill();
  // The bonnet, arched over the front wheel, then the cab with its sloped windscreen.
  ctx.fillStyle = CAB;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-110, -41);
  ctx.lineTo(-145, -37);
  ctx.quadraticCurveTo(-149, -36, -149, -32);
  ctx.lineTo(-149, -16);
  ctx.lineTo(-137.75, -16);
  ctx.arc(-128, -9, 12, Math.PI + 0.623, Math.PI * 2 - 0.623);
  ctx.lineTo(-110, -16);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-84, -16);
  ctx.lineTo(-84, -57);
  ctx.quadraticCurveTo(-84, -60, -87, -60);
  ctx.lineTo(-101, -60);
  ctx.lineTo(-110, -41);
  ctx.lineTo(-110, -16);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // The stripe down its side.
  ctx.fillStyle = STRIPE;
  ctx.fillRect(-148, -31, 40, 4);
  ctx.fillRect(-109, -31, 24, 4);
  // Grille, bumper, headlamp, mirror.
  ctx.fillStyle = CHROME;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(-152, -35, 4, 18); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-155, -20, 11, 7, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath(); ctx.rect(-147, -26, 4, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-105, -49); ctx.lineTo(-113, -51); ctx.stroke();
  ctx.fillStyle = DARK;
  ctx.beginPath(); ctx.roundRect(-116, -57, 4, 10, 1); ctx.fill();
  // Roof lights.
  ctx.fillStyle = '#ffb020';
  for (const x of [-98, -93, -88]) ctx.fillRect(x, -62.5, 3, 2.5);
  // The side window with the driver: the usual sad face, until the crash.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-88, -56); ctx.lineTo(-99, -56); ctx.lineTo(-105, -44); ctx.lineTo(-88, -44); ctx.closePath();
  ctx.fillStyle = '#9fd3ff';
  ctx.fill();
  ctx.clip();
  ctx.translate(-94, -48);
  drawWojakFace(ctx, t.mode === 'route' || t.mode === 'arriving' ? 'meh' : 'panic', 4.4);
  ctx.fillStyle = STRIPE;
  ctx.beginPath(); ctx.arc(0, -1.5, 4.6, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(-7.5, -2.2, 4, 1.6);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-88, -56); ctx.lineTo(-99, -56); ctx.lineTo(-105, -44); ctx.lineTo(-88, -44); ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = DARK;
  ctx.fillRect(-92, -39, 5, 2);
}

/** The flatbed: the bed, its rails and legs, the banner, and the floor strapped down on it. */
function drawTrailer(ctx: CanvasRenderingContext2D, t: Truck): void {
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#3a4350';
  ctx.fillRect(-40, -21, 106, 4);
  // The landing legs, up off the ground while it is hitched.
  ctx.fillStyle = '#6f757d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.rect(-36, -17, 4, 11); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(-39, -6, 10, 2); ctx.fill(); ctx.stroke();
  // The bed, with its stake pockets and tail lamp.
  ctx.fillStyle = STEEL;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(-72, -27, 144, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a929c';
  ctx.fillRect(-70.5, -25.5, 141, 1.5);
  ctx.fillStyle = DARK;
  for (let x = -64; x <= 64; x += 16) ctx.fillRect(x - 1, -23.5, 2, 2.5);
  ctx.fillStyle = STRIPE;
  ctx.fillRect(69, -26, 4, 4);
  // The mud flap behind the back wheels.
  ctx.fillStyle = INK;
  ctx.fillRect(67, -17, 3, 13);
  // An oversize-load banner, as the moment calls for.
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(-27, -20, 52, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 7.5px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OVERLEVERAGED LOAD', -1, -14.6, 48);
  if (!t.loaded) return;
  ctx.save();
  ctx.translate(0, -27 - FLOOR_H / 2);
  drawBlock(ctx, t.index);
  ctx.restore();
  // Ratchet straps over the floor.
  for (const x of [-46, 46]) {
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(x - 1.5, -27 - FLOOR_H, 3, FLOOR_H); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9aa0a8';
    ctx.fillRect(x - 2.5, -32, 5, 4);
  }
}

function drawTruck(ctx: CanvasRenderingContext2D, t: Truck): void {
  ctx.save();
  ctx.translate(t.x, GROUND_Y);
  ctx.fillStyle = 'rgba(28, 31, 38, 0.16)';
  ctx.beginPath(); ctx.ellipse(-40, 1, 116, 4, 0, 0, Math.PI * 2); ctx.fill();
  // The wheels stay on the ground and turn with the distance; the body rides on its springs above them.
  const turn = t.x / WHEEL_R;
  for (const x of [-128, -68, -50, 38, 57]) drawWheel(ctx, x, turn);
  ctx.save();
  ctx.translate(-59, -WHEEL_R);
  ctx.rotate(-clamp(t.pitch.x, -0.08, 0.08));
  ctx.translate(59, WHEEL_R);
  drawTractor(ctx, t);
  ctx.restore();
  ctx.save();
  ctx.translate(0, t.heave.x);
  drawTrailer(ctx, t);
  ctx.restore();
  ctx.restore();
}

export function drawFleet(ctx: CanvasRenderingContext2D, f: Fleet): void {
  for (const t of f.trucks) drawTruck(ctx, t);
}
