/**
 * The bench, seen from the feet: the lifter's face between his arms, the
 * bar across the frame with the plates edge-on at both ends, the rack, and
 * the spotter standing behind his head on his phone. Reps cycle with the
 * multiplier, plates arrive from the edge of the frame at milestones, the
 * bar bends and shakes, the face reddens and grits. An accepted exit racks
 * the bar and sits him up to flex; the spotter takes the bench. The crash:
 * the spotter (the dev) hits SELL, the bar drops on whoever is under it and
 * the plates roll away.
 */
import { endurance } from './endurance';
import { type Spring, clamp, fract, mix, mulberry32, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, type Point } from './gym';

export const BAR = { left: 196, right: 764, top: 296, chest: 404, rack: 282, sleeve: 300 } as const;
const UPRIGHT = { left: 296, right: 664, base: 398, top: 234 } as const;
const HEAD: Point = { x: 480, y: 372 };
const PLATE_COLOURS = ['#e63946', '#3b82f6', '#ffd60a', '#2e8b57', '#f8f8f8', '#e63946', '#3b82f6', '#ffd60a'];
/** Displayed multipliers at which the next pair of plates goes on. */
export const PLATE_AT = [1.3, 1.7, 2.2, 3, 4, 5.5, 7.5, 10];
/** Every plate is a memecoin: the ticker the arm calls out as it slides each one on. */
const TICKERS = ['$PUMP', '$GYATT', '$HOPIUM', '$NATTY', '$RIZZ', '$SPOTME', '$EGOLIFT', '$SPINE'];
const FLOOR = 522;
/** Where the spotter's syringe comes to rest: the floor behind the bench, at his feet. */
const SYRINGE_FLOOR = 408;
/** Where a dumped bar lands, across his chest. */
const BAR_REST = BAR.chest + 34;
/** The chad's walk-off to the side: a shuffle of 48 px steps (a 96 px cycle per foot), 0.3 s ramps in and out. */
const WALK = { to: 816, time: 1.9, ramp: 0.3, cycle: 96 } as const;
/** The spotter steps round the head of the bench, then lies down on it. */
const SWAP_S = 0.8;
const SPOT_ARM = 80;
/** Spotter cues on the shown load: one hand hovers under the bar from about 1.9x, both hands grab it from about 3x. */
const HOVER_AT = 0.47;
const GRAB_AT = 0.66;
/** The fake-out: from 1.5x every fourth rep sticks at 70% of the press. */
const STALL_AT = 0.858;
/** Tension for a shown multiplier: 0.33 at 1.5x, 0.5 at 2x, 0.67 at 3x, where most rounds end, and still creeping up after. */
export const tensionFor = (multiplier: number): number => 1 - 1 / multiplier;

export type Who = 'chad' | 'bro';
export type Mode = 'idle' | 'lifting' | 'racking' | 'sitting' | 'swap';

/** `x`, `y` are world coordinates once a plate is loose; `rest` is the angle it settles to once it stops bouncing, up on its rim or flat. */
interface Plate { side: -1 | 1; index: number; x: number; y: number; vx: number; vy: number; spin: number; angle: number; loose: boolean; rest: number | null; gone: boolean }
/** The spotter's syringe: tucked behind his ear, working its way out with the load, out and rolling at the crash. */
interface Syringe { peek: Spring; out: boolean; x: number; y: number; vx: number; vy: number; angle: number; spin: number; scale: number; landed: number; settled: boolean }

export interface Bench {
  time: number;
  mode: Mode;
  modeAge: number;
  onBench: Who;
  /** Rep position in cycles. */
  phase: number;
  barY: Spring;
  plates: Plate[];
  arrival: { side: -1 | 1; index: number; age: number } | null;
  nextPlate: number;
  tension: number;
  act: number;
  effort: number;
  dumped: boolean;
  hitLifter: Who | null;
  dumpAge: number;
  /** The dumped bar is in free fall (then one small bounce) rather than on its spring. */
  falling: boolean;
  bounced: boolean;
  hands: Spring;
  shades: Spring;
  /** The spotter's hands: both on the bar (`spotHands`), or one hovering under it (`hover`). */
  spotHands: Spring;
  hover: Spring;
  /** Which way each of the spotter's elbows points: 1 to the bendJoint side for his hand, 0 the mirrored side. */
  elbows: Spring[];
  /** Seconds into the chad's walk-off to the side. */
  walk: number;
  grunt: Spring;
  /** The bar's sag, on a stiff spring so it twangs when plates go on or fly off. */
  bend: Spring;
  /** How much of the lifting tremor and tilt is in, eased across mode changes. */
  strain: number;
  /** Time left on a stalled rep, how long that stall was, and which rep it was. */
  stall: number;
  stallFor: number;
  stalled: number;
  /** The rack's jolt when the bar lands. */
  jolt: Spring;
  /** The bar is on its way down and has not landed yet. */
  impactPending: boolean;
  syringe: Syringe;
  /** What happened this step; `bounce` counts plates that hit the floor hard. */
  events: { rep: boolean; plate: boolean; racked: boolean; swapped: boolean; impact: boolean; stall: boolean; bounce: number };
}

const freshSyringe = (): Syringe => ({ peek: spring(0), out: false, x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, scale: 1.15, landed: 0, settled: false });
const noEvents = (): Bench['events'] => ({ rep: false, plate: false, racked: false, swapped: false, impact: false, stall: false, bounce: 0 });

export function createBench(): Bench {
  return { time: 0, mode: 'idle', modeAge: 0, onBench: 'chad', phase: 0, act: 0, effort: 0, barY: spring(BAR.rack), plates: [], arrival: null, nextPlate: 0, tension: 0, dumped: false, hitLifter: null, dumpAge: 0, falling: false, bounced: false, hands: spring(1), shades: spring(0), spotHands: spring(0), hover: spring(0), elbows: [spring(0), spring(0)], walk: 0, grunt: spring(0), bend: spring(0.6), strain: 0, stall: 0, stallFor: 1, stalled: -1, jolt: spring(0), impactPending: false, syringe: freshSyringe(), events: noEvents() };
}

export function resetBench(b: Bench): void {
  b.mode = 'idle';
  b.modeAge = 0;
  b.onBench = 'chad';
  b.phase = 0;
  settleSpring(b.barY, BAR.rack);
  b.plates = [];
  b.arrival = null;
  b.nextPlate = 0;
  b.dumped = false;
  b.hitLifter = null;
  b.dumpAge = 0;
  b.falling = b.bounced = false;
  settleSpring(b.hands, 1);
  settleSpring(b.shades, 0);
  settleSpring(b.spotHands, 0);
  settleSpring(b.hover, 0);
  settleElbows(b);
  b.walk = 0;
  settleSpring(b.grunt, 0);
  settleSpring(b.bend, sagFor(b));
  b.strain = 0;
  b.stall = 0;
  b.stalled = -1;
  b.effort = 0;
  settleSpring(b.jolt, 0);
  b.impactPending = false;
  b.syringe = freshSyringe();
}

/** The sag the load calls for: three pixels a pair, less with the bar on the hooks. */
function sagFor(b: Bench): number {
  const plates = b.plates.filter((p) => !p.loose).length / 2;
  return (2 + 3 * plates + (b.act === 3 ? b.effort * 15 : 0)) * (b.mode === 'idle' || b.mode === 'sitting' || b.mode === 'swap' ? 0.3 : 1);
}

/** Distance walked `t` seconds into the walk-off, and the speed as a share of the cruise. */
function walked(t: number): { x: number; speed: number } {
  const { to, time, ramp } = WALK, d = to - 480, top = d / (time - ramp);
  if (t <= 0) return { x: 0, speed: 0 };
  if (t < ramp) return { x: top * t * t / (2 * ramp), speed: t / ramp };
  if (t < time - ramp) return { x: top * (ramp / 2 + t - ramp), speed: 1 };
  if (t < time) return { x: d - top * (time - t) ** 2 / (2 * ramp), speed: (time - t) / ramp };
  return { x: d, speed: 0 };
}

/** One foot of the shuffle, from the distance walked: in stance it cancels the body's travel exactly, so it never skates. */
function shuffle(s: number, speed: number, lead: number): { dx: number; lift: number; swing: number } {
  const c = WALK.cycle, u = fract(s / c + lead);
  if (u < 0.5) return { dx: c / 4 - u * c, lift: 0, swing: 0 };
  const v = (u - 0.5) * 2, swing = Math.sin(Math.PI * v);
  return { dx: -c / 4 + c * smoothstep(0, 1, v) - c / 2 * v, lift: 10 * speed * swing, swing };
}

function addPlates(b: Bench, index: number, quiet: boolean): void {
  for (const side of [-1, 1] as const) b.plates.push({ side, index, x: plateX(side, index), y: 0, vx: 0, vy: 0, spin: 0, angle: 0, loose: false, rest: null, gone: false });
  b.nextPlate = index + 1;
  // Once the chad stands off to the right flexing, every plate comes in from the left, so the arm never reaches through him.
  if (!quiet) b.arrival = { side: index % 2 && b.onBench === 'chad' ? 1 : -1, index, age: 0 };
}

const plateX = (side: -1 | 1, index: number): number => (side < 0 ? BAR.sleeve - 12 - index * 13 : BAR.right - (BAR.sleeve - BAR.left) + 12 + index * 13);

/**
 * Jumps straight to the state a multiplier calls for, for a round met late: the bar loaded to the number and,
 * once the exit is in (`racked`), already handed over, the spotter lifting and the chad flexing at the side.
 */
export function settleBench(b: Bench, multiplier: number, racked: boolean): void {
  b.mode = 'lifting';
  settleSpring(b.barY, BAR.top);
  while (b.nextPlate < PLATE_AT.length && multiplier >= PLATE_AT[b.nextPlate]!) addPlates(b, b.nextPlate, true);
  b.arrival = null;
  b.strain = 1;
  // The spotter's hands and the syringe already where the shown load has put them.
  b.tension = tensionFor(multiplier);
  settleSpring(b.hover, !racked && b.tension > HOVER_AT ? 1 : 0);
  settleSpring(b.spotHands, !racked && b.tension > GRAB_AT ? 1 : 0);
  settleSpring(b.syringe.peek, racked ? 0 : smoothstep(0.2, 0.8, b.tension));
  if (racked) {
    b.onBench = 'bro';
    b.walk = WALK.time;
    settleSpring(b.shades, 1);
  }
  settleSpring(b.bend, sagFor(b));
  settleElbows(b);
}

/** The exit was accepted: rack it, sit up, hand the bench over. */
export function rackBar(b: Bench): void {
  if (b.mode === 'lifting' && b.onBench === 'chad') { b.mode = 'racking'; b.modeAge = 0; }
}

/** The bar comes down. `quiet` skips the effects for a crash that already happened. */
export function dumpBar(b: Bench, seed: number, quiet: boolean): void {
  if (b.dumped) return;
  if (b.mode === 'idle') { b.mode = 'lifting'; b.modeAge = 0; }
  // An accepted exit has the bar on (or going onto) the hooks until the spotter has lain down and unracked it: it stays
  // there, the plates fly off it, nobody is under it.
  const held = b.mode === 'racking' || b.mode === 'sitting' || b.mode === 'swap';
  b.hitLifter = held ? null : b.onBench;
  const syringePose = benchFigurePose(b, 'bro'), peek = clamp(b.syringe.peek.x, 0, 1);
  const syringeFrom = figurePoint(syringePose, { x: HEAD.x + 22 + 12 * peek, y: HEAD.y - syringePose.rise * 68 + syringePose.drop - 4 - 8 * peek + Math.sin(b.time * 27) * 1.5 * peek });
  // Loose plates keep their world position from the frame they leave the bar.
  for (const p of b.plates) if (!p.loose) p.y = barAt(b, p.x);
  b.dumped = true;
  b.dumpAge = quiet ? 10 : 0;
  b.impactPending = !quiet;
  b.falling = !quiet && !held;
  b.bounced = false;
  b.arrival = null;
  b.stall = 0;
  const rng = mulberry32(seed);
  for (const p of b.plates) {
    p.loose = true;
    p.vx = p.side * (160 + rng() * 260);
    p.vy = -80 - rng() * 220;
    p.spin = p.side * (4 + rng() * 6);
    if (quiet) p.gone = true;
  }
  if (quiet) { settleSpring(b.barY, BAR_REST); settleSpring(b.hands, 0); settleSpring(b.bend, 2); settleSpring(b.spotHands, 0); settleSpring(b.hover, 0); b.strain = 0; b.effort = 0; settleElbows(b); }
  // The press carries into the fall: it keeps any downward speed and gets a shove, then falls free.
  else if (b.falling) b.barY.v = Math.max(0, b.barY.v) + 120;
  // The syringe leaves the spotter's ear (or rolls out from under the bench if he is the one under the bar):
  // out and bouncing, or already lying where it stopped for a crash met late. Drawn after the plates so their scatter keeps its seed.
  const s = b.syringe;
  s.out = true;
  settleSpring(s.peek, 0);
  s.scale = quiet ? 1.15 : (0.85 + 0.2 * peek) * syringePose.scale;
  s.landed = quiet ? 1 : 0;
  if (quiet) { s.x = 604; s.y = SYRINGE_FLOOR; s.vx = 0; s.vy = 0; s.angle = 0; s.spin = 0; s.settled = true; }
  else if (b.onBench === 'chad') { s.x = syringeFrom.x; s.y = syringeFrom.y; s.vx = 150 + rng() * 80; s.vy = -120 - rng() * 80; s.angle = -0.6 - 0.3 * peek; s.spin = 8 + rng() * 5; s.settled = false; }
  else { s.x = syringeFrom.x; s.y = syringeFrom.y; s.vx = 120 + rng() * 60; s.vy = -60; s.angle = -0.6; s.spin = 6; s.settled = false; }
}

export interface BenchDrive { running: boolean; multiplier: number; growth: number; tension: number; seconds?: number }

export function stepBench(b: Bench, drive: BenchDrive, dt: number): void {
  b.time += dt;
  b.modeAge += dt;
  b.tension = drive.tension;
  const act = endurance(drive.seconds ?? 0); b.act = act.act;
  b.events = noEvents();
  if (b.mode === 'idle' && drive.running) { b.mode = 'lifting'; b.modeAge = 0; b.phase = 0; }
  // A crash during the hand-over leaves the bar on the hooks: he still sits up and walks off, but with no chalk
  // or clang, and the spotter only lies down if he was already on his way, under a bar still on the hooks.
  if (b.mode === 'racking' && b.modeAge > 0.7) { b.mode = 'sitting'; b.modeAge = 0; b.events.racked = !b.dumped; }
  if (b.mode === 'sitting' && b.modeAge > 2.2 && !b.dumped) { b.mode = 'swap'; b.modeAge = 0; b.onBench = 'bro'; b.events.swapped = true; }
  if (b.mode === 'swap' && b.modeAge > SWAP_S) { b.mode = 'lifting'; b.modeAge = 0; }
  const lifting = b.mode === 'lifting' && !b.dumped;
  // Endurance acts only shape the bar, and ease out at an exit or the crash instead of popping.
  b.effort += ((lifting && drive.running ? act.effort : 0) - b.effort) * (1 - Math.exp(-4 * dt));
  if (lifting && drive.running) {
    const before = b.phase;
    const rate = 0.45 + 0.65 * (1 - Math.exp(-drive.growth / 2.2));
    if (b.stall > 0) b.stall = Math.max(0, b.stall - dt);
    else {
      b.phase += rate * (1 - b.effort * (b.act === 2 ? .72 : .22)) * dt;
      // The fake-out: from 1.5x every fourth rep sticks at 70% of the press, keyed to the shown number, never the outcome.
      const n = Math.floor(before);
      if (drive.multiplier >= 1.5 && n % 4 === 2 && n !== b.stalled && Math.floor(b.phase) === n && fract(before) < STALL_AT && fract(b.phase) >= STALL_AT) {
        b.stalled = n;
        b.phase = n + STALL_AT;
        b.stall = b.stallFor = 0.25 + 0.2 * drive.tension;
        b.events.stall = true;
        b.grunt.v += 10;
      }
    }
    if (fract(before) < 0.5 && (fract(b.phase) >= 0.5 || Math.floor(b.phase) > Math.floor(before))) { b.events.rep = true; b.grunt.v += 8; }
    // Plates the number passed while no frame was drawn (a hidden tab) go straight on; only the latest is carried in.
    while (b.nextPlate + 1 < PLATE_AT.length && drive.multiplier >= PLATE_AT[b.nextPlate + 1]!) { addPlates(b, b.nextPlate, true); b.arrival = null; }
    if (b.nextPlate < PLATE_AT.length && drive.multiplier >= PLATE_AT[b.nextPlate]! && !b.arrival) { addPlates(b, b.nextPlate, false); b.events.plate = true; }
  }
  if (b.arrival) { b.arrival.age += dt; if (b.arrival.age > 1) b.arrival = null; }
  // Where the bar wants to be.
  // A controlled descent followed by a quicker press, both with zero endpoint velocity.
  const cycle = fract(b.phase);
  const rep = cycle < .62 ? smoothstep(0, .62, cycle) : 1 - smoothstep(.62, 1, cycle);
  // A stalled rep sinks back a few pixels while he grinds.
  const repY = mix(BAR.top, BAR.chest, b.act === 2 ? mix(rep, .08, b.effort * .9) : rep) + (b.stall > 0 ? 5 : 0);
  const onHooks = b.mode === 'idle' || b.mode === 'sitting' || b.mode === 'swap' || (b.mode === 'racking' && (b.modeAge > 0.3 || b.dumped));
  const target = onHooks ? BAR.rack : b.mode === 'racking' ? BAR.top : repY;
  if (b.falling) {
    // A dumped bar falls free instead of riding a spring through him: it lands on his chest, bounces once, and stays.
    b.barY.x += b.barY.v * dt + 1200 * dt * dt;
    b.barY.v += 2400 * dt;
    if (b.barY.x >= BAR_REST) {
      b.barY.x = BAR_REST;
      if (!b.bounced) { b.bounced = true; b.barY.v = -Math.min(139, 0.33 * b.barY.v); }
      else { b.barY.v = 0; b.falling = false; }
    }
  } else if (!b.dumped || onHooks) stepSpring(b.barY, target, b.mode === 'lifting' ? 26 : 8, 0.9, dt);
  stepSpring(b.hands, b.dumped && !b.impactPending ? 0 : 1, 10, 0.7, dt);
  stepSpring(b.shades, b.mode === 'sitting' || b.mode === 'swap' || (b.mode === 'lifting' && b.onBench === 'bro') ? 1 : 0, 12, 0.5, dt);
  // The spotter's warning, on the shown load: one hand comes off the phone to hover, then both grab the bar. At the crash they let go fast.
  const spotting = !b.dumped && b.onBench === 'chad';
  stepSpring(b.spotHands, spotting && (b.mode === 'racking' || (b.mode === 'lifting' && drive.tension > GRAB_AT)) ? 1 : 0, b.dumped ? 14 : 6, 0.8, dt);
  stepSpring(b.hover, spotting && b.mode === 'lifting' && drive.tension > HOVER_AT ? 1 : 0, b.dumped ? 14 : 5, 0.8, dt);
  // His elbows swing to whichever side the reach now favours over a fifth of a second, holding their side through a near-tie.
  const spotter = benchFigurePose(b, 'bro');
  for (const [i, side] of ([-1, 1] as const).entries()) {
    const elbow = b.elbows[i]!, { shoulder, hand } = armTarget(b, 'bro', side, spotter), lean = elbowLean(shoulder, hand, side);
    stepSpring(elbow, lean > .1 ? 1 : lean < -.1 ? 0 : Math.round(clamp(elbow.x, 0, 1)), 14, 1, dt);
  }
  if (b.onBench === 'bro' || (b.mode === 'sitting' && b.modeAge > 0.9)) b.walk += dt;
  stepSpring(b.grunt, 0, 10, 0.5, dt);
  stepSpring(b.bend, sagFor(b), 28, 0.22, dt);
  b.strain += ((lifting ? 1 : 0) - b.strain) * (1 - Math.exp(-10 * dt));
  if (b.dumped) {
    b.dumpAge += dt;
    for (const p of b.plates) {
      if (!p.loose || p.gone) continue;
      const half = p.index === 4 ? 33 : 44;
      if (p.rest === null) {
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        // The floor meets the plate's lowest corner at whatever angle it comes down.
        const reach = half * Math.abs(Math.cos(p.angle)) + 6 * Math.abs(Math.sin(p.angle));
        if (p.y + reach > FLOOR) {
          p.y = FLOOR - reach;
          if (p.vy > 220) { b.events.bounce += 1; p.vy *= -0.35; p.vx *= 0.9; p.spin *= 0.5; }
          // Done bouncing: near upright it stays up on its rim; past that it topples flat.
          else if (p.vy > 0) {
            const up = Math.round(p.angle / Math.PI) * Math.PI;
            p.vy = 0;
            p.rest = Math.abs(p.angle - up) < 0.6 ? up : Math.round(p.angle / Math.PI - 0.5) * Math.PI + Math.PI / 2;
          }
        }
      } else {
        // On its rim the wobble dies out and it rolls away out of frame instead of parking under the readouts; flat, it skids to a stop.
        const tip = { x: p.angle, v: p.spin }, flat = Math.abs(Math.cos(p.rest)) < 0.5;
        stepSpring(tip, p.rest, 12, flat ? 0.7 : 0.35, dt);
        p.angle = tip.x; p.spin = tip.v;
        p.vx = flat ? p.vx * Math.exp(-3 * dt) : p.side * Math.max(150, Math.abs(p.vx) * Math.exp(-0.6 * dt));
        p.x += p.vx * dt;
        p.y = FLOOR - half * Math.abs(Math.cos(p.angle)) - 6 * Math.abs(Math.sin(p.angle));
      }
      if (p.x < -60 || p.x > 1020) p.gone = true;
    }
    // The bar lands (or, on the hooks, the plates rip off it): the moment the hit-stop, the shake and the stinger hang on.
    if (b.impactPending && (!b.falling || b.bounced || b.dumpAge > 0.8)) { b.impactPending = false; b.events.impact = true; b.jolt.v += b.hitLifter ? 12 : 16; }
  }
  stepSpring(b.jolt, 0, 20, 0.28, dt);
  // Anticipation: the syringe starts to show from about 1.3x, is half out by 2x and nearly out by 3x, then flies at the crash.
  const s = b.syringe;
  stepSpring(s.peek, !b.dumped && b.mode === 'lifting' && b.onBench === 'chad' ? smoothstep(0.2, 0.8, drive.tension) : 0, 4, 0.8, dt);
  if (s.out && !s.settled) {
    s.vy += 900 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.spin * dt;
    s.scale += (1.15 - s.scale) * (1 - Math.exp(-6 * dt));
    if (s.landed > 0) s.landed += dt;
    // Contact on its lowest point at any angle; once it stops bouncing it rocks over onto its side instead of snapping flat.
    const floor = SYRINGE_FLOOR + 6, reach = (angle: number) => 32 * Math.abs(Math.sin(angle)) + 6 * Math.abs(Math.cos(angle));
    if (s.y + reach(s.angle) >= floor) {
      s.y = floor - reach(s.angle);
      if (s.landed === 0) s.landed = 1e-6;
      if (s.vy > 90) { s.vy *= -0.3; s.vx *= 0.8; s.spin *= 0.5; }
      else {
        const rest = Math.round(s.angle / Math.PI) * Math.PI, tip = { x: s.angle, v: s.spin };
        stepSpring(tip, rest, 14, 0.5, dt);
        s.angle = tip.x; s.spin = tip.v; s.vy = 0;
        s.y = floor - reach(s.angle);
        s.vx *= Math.exp(-2.2 * dt);
        if (Math.abs(s.vx) < 6 && Math.abs(s.angle - rest) < 0.01 && Math.abs(s.spin) < 0.1) { s.vx = 0; s.spin = 0; s.angle = rest; s.y = SYRINGE_FLOOR; s.scale = 1.15; s.settled = true; }
      }
    }
  }
}

/** Bar height at a given x along the bent bar. */
function barAt(b: Bench, x: number): number {
  const t = (x - BAR.left) / (BAR.right - BAR.left);
  const bend = b.bend.x * (4 * (t - 0.5) * (t - 0.5));
  // A stalled rep shakes harder, easing in and out across the stall.
  const grind = b.stall > 0 ? 3 * Math.sin(Math.PI * (1 - b.stall / b.stallFor)) : 0;
  const tremor = b.strain * Math.sin(b.time * 31) * (0.4 + 5 * b.tension * b.tension + grind);
  const tilt = b.strain * (Math.sin(b.time * 9.7) * 9 * b.tension + (b.act === 1 ? b.effort * 22 : b.act === 4 ? -b.effort * 18 : 0)) * (t - .5) * 2;
  return b.barY.x + bend + tremor + tilt;
}

function limb(ctx: CanvasRenderingContext2D, a: Point, bpt: Point, width: number, colour: string): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width + 5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bpt.x, bpt.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
}

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + dx / distance * along - dy / distance * bend, y: root.y + dy / distance * along + dx / distance * bend };
}

/** A syringe: plunger, barrel with something yellow in it, a red label, the needle. */
function drawSyringe(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(27, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(232, 242, 255, 0.92)';
  ctx.beginPath(); ctx.roundRect(-14, -5, 28, 10, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd60a'; ctx.fillRect(-11, -3, 13, 6);
  ctx.fillStyle = '#e63946'; ctx.fillRect(3, -5, 8, 10);
  ctx.fillStyle = '#2b2b30';
  ctx.beginPath(); ctx.roundRect(-25, -2.5, 12, 5, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-28, -6.5, 4, 13, 1.5); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function skinFor(who: Who, tension: number): string {
  const t = clamp(tension, 0, 1);
  const r = Math.round(mix(243, 226, t));
  const g = Math.round(mix(220, 92, t));
  const bl = Math.round(mix(203, 84, t));
  return who === 'chad' ? `rgb(${r}, ${g}, ${bl})` : `rgb(${Math.round(mix(224, 226, t))}, ${Math.round(mix(189, 100, t))}, ${Math.round(mix(167, 90, t))})`;
}

/** The face of whoever is on the bench, looking up at the bar. */
function drawLyingFace(ctx: CanvasRenderingContext2D, b: Bench, who: Who, tension: number, ko: boolean, relaxed = false): void {
  const t = clamp(tension, 0, 1);
  ctx.save();
  ctx.translate(HEAD.x, HEAD.y);
  ctx.lineJoin = 'round';
  const skin = skinFor(who, ko ? 0.1 : t);
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  if (who === 'chad') {
    ctx.beginPath(); ctx.moveTo(-30, -10); ctx.quadraticCurveTo(-32, -34, 0, -34); ctx.quadraticCurveTo(32, -34, 30, -10); ctx.lineTo(28, 20); ctx.quadraticCurveTo(26, 34, 0, 36); ctx.quadraticCurveTo(-26, 34, -28, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(28, 31, 38, 0.3)';
    ctx.beginPath(); ctx.moveTo(-26, 16); ctx.quadraticCurveTo(-24, 32, 0, 34); ctx.quadraticCurveTo(24, 32, 26, 16); ctx.lineTo(24, 10); ctx.quadraticCurveTo(0, 22, -24, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.ellipse(0, -28, 30, 10, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.arc(0, -16, 27, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-29, -20, 58, 8, 3); ctx.fill(); ctx.stroke();
  }
  // Veins at the temples.
  const veins = ko ? 0 : t > 0.8 ? 3 : t > 0.55 ? 2 : t > 0.3 ? 1 : 0;
  ctx.strokeStyle = 'rgba(120, 40, 160, 0.8)'; ctx.lineWidth = 2;
  for (let i = 0; i < veins; i += 1) {
    const sx = i === 0 ? -22 : i === 1 ? 22 : -8;
    const sy = i === 2 ? -26 : -14;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 3, sy - 6); ctx.lineTo(sx - 1, sy - 11); ctx.lineTo(sx + 3, sy - 16); ctx.stroke();
  }
  // Eyes bulge with the load; X eyes when out.
  const eyeOpen = ko ? 1 : 1 + 0.6 * t;
  for (const ex of [-11, 11]) {
    if (ko) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ex - 5, -14); ctx.lineTo(ex + 5, -4); ctx.moveTo(ex + 5, -14); ctx.lineTo(ex - 5, -4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(ex, -9, 6, 6 * eyeOpen, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = who === 'chad' ? INK : '#3b82f6';
      ctx.beginPath(); ctx.arc(ex, -12 + 2 * t, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Brows knit hard on a chad, lift on a bro.
  const brow = who === 'chad' ? 0.5 + 0.5 * t : t - 0.3;
  ctx.strokeStyle = INK; ctx.lineWidth = who === 'chad' ? 4 : 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, -20 + 3 * brow); ctx.lineTo(-4, -19 - 5 * brow); ctx.moveTo(4, -19 - 5 * brow); ctx.lineTo(20, -20 + 3 * brow); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 6); ctx.lineTo(-2, 7); ctx.stroke();
  // Mouth: a grin, then gritted teeth, then the tongue out.
  if (ko) {
    ctx.beginPath(); ctx.ellipse(0, 18, 7, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7a9e'; ctx.beginPath(); ctx.ellipse(3, 24, 5, 7, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (t > 0.35 || (b.mode === 'lifting' && !relaxed)) {
    const w = 8 + 8 * t;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(-w, 12, w * 2, 9 + 4 * t, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.6)'; ctx.lineWidth = 1.5;
    for (let x = -w + 4; x < w; x += 4) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 21 + 4 * t); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.moveTo(-8, 16); ctx.quadraticCurveTo(0, 22, 8, 16); ctx.stroke();
  }
  // Oil on the forehead, sweat flying.
  ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.4 * t})`;
  ctx.beginPath(); ctx.ellipse(-10, -24, 8, 3, -0.3, 0, Math.PI * 2); ctx.fill();
  const drops = ko ? 0 : t > 0.8 ? 4 : t > 0.55 ? 2 : t > 0.3 ? 1 : 0;
  for (let i = 0; i < drops; i += 1) {
    const p = fract(b.time / 0.9 + i * 0.27);
    const side = i % 2 ? 1 : -1;
    const x = side * (30 + 30 * p);
    const y = -10 + 34 * p * p;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (b.grunt.x > 0.05 && t > 0.3 && !ko && !relaxed) {
    ctx.save();
    ctx.translate(46, -30);
    ctx.scale(1 + 0.3 * b.grunt.x, 1 + 0.3 * b.grunt.x);
    ctx.globalAlpha = clamp(b.grunt.x, 0, 1);
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.font = '900 18px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeText('HNNG', 0, 0); ctx.fillText('HNNG', 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * `rise` sits the upper body up (0 lying, 1 upright); `drop` lowers it in local pixels (the spotter bending over the bar,
 * the chad's hip bob); `step` holds each foot's offset and lift for the walk-off, left then right.
 */
export interface BenchFigurePose { x: number; footY: number; scale: number; rise: number; drop: number; narrow: number; grip: number; flex: number; phone: number; step: number[] }
export function benchFigurePose(b: Bench, who: Who): BenchFigurePose {
  if (who === 'chad') {
    const up = b.onBench === 'bro' ? 1 : b.mode === 'sitting' ? smoothstep(0, .7, b.modeAge) : 0;
    const walk = walked(b.walk), left = shuffle(walk.x, walk.speed, .25), right = shuffle(walk.x, walk.speed, .75);
    return { x: 480 + walk.x, footY: FLOOR, scale: 1, rise: up, drop: 4 * walk.speed * (1 - Math.max(left.swing, right.swing)), narrow: mix(1, .7, up), grip: clamp(b.hands.x, 0, 1) * (1 - up), flex: up, phone: 0, step: [left.dx, left.lift, right.dx, right.lift] };
  }
  // Taking the bench: a step round the head of it (up and forward, phone away), then down onto the pad.
  const age = b.onBench !== 'bro' ? 0 : b.mode === 'swap' ? b.modeAge : SWAP_S;
  const stepped = smoothstep(0, .35, age), sat = smoothstep(.3, SWAP_S, age), aboard = .5 * stepped + .5 * sat;
  const pose: BenchFigurePose = { x: 480, footY: mix(UPRIGHT.base, FLOOR, aboard) - (age < .35 ? 10 * Math.sin(Math.PI * age / .35) : 0), scale: mix(.78, 1, aboard), rise: .35 * (1 - sat), drop: 0, narrow: mix(.55, 1, sat), grip: sat * clamp(b.hands.x, 0, 1), flex: 0, phone: 1 - stepped, step: [0, 0, 0, 0] };
  if (b.onBench === 'chad') {
    // Spotting from behind the head, he bends over just as far as his hands need to reach the bar.
    let drop = 0;
    for (const side of [-1, 1] as const) {
      const { shoulder, hand, reach } = armTarget(b, 'bro', side, pose);
      const dx = hand.x - shoulder.x, span = SPOT_ARM * 2 * .97;
      if (reach > 0) drop = Math.max(drop, (hand.y - shoulder.y - Math.sqrt(Math.max(0, span * span - dx * dx))) / reach);
    }
    pose.drop = drop;
  }
  return pose;
}
const figurePoint = (pose: BenchFigurePose, p: Point): Point => ({ x: pose.x + (p.x - 480) * pose.scale, y: pose.footY + (p.y - FLOOR) * pose.scale });
/** Where a hand wants to be in the figure's own frame, before any reach limit; `reach` is how far it has gone from its rest towards the bar. */
function armTarget(b: Bench, who: Who, side: -1 | 1, pose: BenchFigurePose): { shoulder: Point; hand: Point; reach: number } {
  const shoulder = { x: 480 + side * 70 * pose.narrow, y: 398 - pose.rise * 68 + pose.drop };
  const off = { x: 480 + side * mix(120, 98, pose.flex), y: mix(470, 300, pose.flex) + pose.drop };
  // The spotter scrolls with the phone held low, under the DEV on his hoodie and clear of his face.
  const phone = { x: 480 + side * 16, y: shoulder.y + 60 };
  const grab = who === 'bro' ? clamp(b.spotHands.x, 0, 1) * pose.phone : 0;
  const hover = who === 'bro' && side > 0 ? clamp(b.hover.x, 0, 1) * pose.phone : 0;
  // The spotter takes the bar inside the lifter's grip, where his hands stay in sight.
  const gripX = 480 + side * (who === 'bro' ? mix(88, 54, pose.phone) : 88), worldGrip = { x: gripX, y: barAt(b, gripX) };
  // A hovering hand waits, twitching, a little under the bar without touching it.
  const under = hover * (1 - grab) * (14 + Math.sin(b.time * 23) * 2);
  const onBar = { x: 480 + (worldGrip.x - pose.x) / pose.scale, y: FLOOR + (worldGrip.y - pose.footY) / pose.scale + under };
  const rest = { x: mix(off.x, phone.x, pose.phone), y: mix(off.y, phone.y, pose.phone) };
  const reach = Math.max(pose.grip, grab, hover);
  // The spotter's hands arc down and out between the phone and the bar instead of passing through his shoulder.
  const dip = who === 'bro' ? 26 * Math.sin(Math.PI * reach) * pose.phone : 0;
  return { shoulder, hand: { x: mix(rest.x, onBar.x, reach), y: mix(rest.y, onBar.y, reach) + dip }, reach };
}
/** How much more out and down the `side` elbow sits than the mirrored one: the spotter faces the camera, so he takes the outer. */
function elbowLean(shoulder: Point, hand: Point, side: -1 | 1): number {
  const mid = { x: (shoulder.x + hand.x) / 2, y: (shoulder.y + hand.y) / 2 };
  const outward = (p: Point) => ((p.x - mid.x) * side + (p.y - mid.y) * .4) / Math.max(1, Math.hypot(p.x - mid.x, p.y - mid.y));
  return outward(bendJoint(shoulder, hand, SPOT_ARM, SPOT_ARM, side)) - outward(bendJoint(shoulder, hand, SPOT_ARM, SPOT_ARM, -side));
}
function settleElbows(b: Bench): void {
  const spotter = benchFigurePose(b, 'bro');
  for (const [i, side] of ([-1, 1] as const).entries()) { const { shoulder, hand } = armTarget(b, 'bro', side, spotter); settleSpring(b.elbows[i]!, elbowLean(shoulder, hand, side) > 0 ? 1 : 0); }
}
/** The rendered elbow, wrist and fingers all consume this one endpoint. */
export function benchArmPose(b: Bench, who: Who, side: -1 | 1) {
  const pose = benchFigurePose(b, who);
  const target = armTarget(b, who, side, pose), shoulder = target.shoulder;
  let hand = target.hand;
  const length = who === 'chad' ? 84 : SPOT_ARM;
  const distance = Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y);
  if (distance > length * 2 - .01) { const k = (length * 2 - .01) / distance; hand = { x: shoulder.x + (hand.x - shoulder.x) * k, y: shoulder.y + (hand.y - shoulder.y) * k }; }
  let elbow = bendJoint(shoulder, hand, length, length, side);
  if (who === 'bro') {
    // Mid-swing the elbow points at the camera and both bones foreshorten, so it swings round instead of flipping.
    const other = bendJoint(shoulder, hand, length, length, -side), k = clamp(b.elbows[side < 0 ? 0 : 1]!.x, 0, 1);
    elbow = { x: mix(other.x, elbow.x, k), y: mix(other.y, elbow.y, k) };
  }
  return { shoulder: figurePoint(pose, shoulder), elbow: figurePoint(pose, elbow), hand: figurePoint(pose, hand), scale: pose.scale, grip: pose.grip };
}
function drawBenchFigure(ctx: CanvasRenderingContext2D, b: Bench, who: Who): void {
  const pose = benchFigurePose(b, who);
  const ko = isKO(b, who);
  const effort = b.tension * (1 - pose.flex) * (1 - pose.phone);
  const skin = skinFor(who, ko ? .1 : effort);
  ctx.save(); ctx.translate(pose.x, pose.footY); ctx.scale(pose.scale, pose.scale); ctx.translate(-480, -FLOOR);
  const rise = pose.rise * 68 - pose.drop;
  const shoulderY = 398 - rise;
  const half = 82 * pose.narrow;
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(458, 380 - rise, 44, 30, 8); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(0, -rise);
  // The dev's hoodie: the hood bunched behind his neck.
  if (who === 'bro') { ctx.fillStyle = '#2f62c4'; ctx.beginPath(); ctx.ellipse(HEAD.x, HEAD.y + 18, 44, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  if (who === 'bro' && !b.syringe.out) { const peek = clamp(b.syringe.peek.x, 0, 1); drawSyringe(ctx, HEAD.x + 22 + 12 * peek, HEAD.y - 4 - 8 * peek + Math.sin(b.time * 27) * 1.5 * peek, -.6 - .3 * peek, .85 + .2 * peek); }
  drawLyingFace(ctx, b, who, effort, ko, pose.flex > .1 || pose.phone > .1);
  if (who === 'chad' && pose.flex > 0 && b.shades.x > .02) {
    const y = HEAD.y - 90 * (1 - clamp(b.shades.x, 0, 1)); ctx.fillStyle = INK;
    for (const ex of [-11, 11]) { ctx.fillRect(HEAD.x + ex - 9, y - 14, 18, 11); }
    ctx.fillRect(HEAD.x - 3, y - 11, 6, 3);
  }
  ctx.restore();
  ctx.fillStyle = who === 'chad' ? skin : '#3b82f6';
  ctx.beginPath(); ctx.moveTo(480 - half, shoulderY); ctx.quadraticCurveTo(480, shoulderY - 12, 480 + half, shoulderY); ctx.lineTo(480 + 60 * pose.narrow, 470); ctx.lineTo(480 - 60 * pose.narrow, 470); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (who === 'chad') {
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(480 + side * 35 * pose.narrow, 420 - rise * .8, 40 * pose.narrow, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(28,31,38,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(480, 446 - rise * .4); ctx.lineTo(480, 466); ctx.stroke();
  } else {
    // Drawstrings and the name on the chest: the spotter is the dev wallet.
    ctx.strokeStyle = '#f6f6f6'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(472, shoulderY + 2); ctx.lineTo(469, shoulderY + 22); ctx.moveTo(488, shoulderY + 2); ctx.lineTo(491, shoulderY + 22); ctx.stroke();
    ctx.font = '900 26px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeText('DEV', 480, shoulderY + 33); ctx.fillStyle = '#ffffff'; ctx.fillText('DEV', 480, shoulderY + 33);
  }
  for (const side of [-1, 1]) {
    // On the walk-off each foot plants (and the knee follows it) by distance walked, not time.
    const dx = pose.step[side < 0 ? 0 : 2]!, lift = pose.step[side < 0 ? 1 : 3]!;
    const hip = { x: 480 + side * 30 * pose.narrow, y: 472 };
    const knee = { x: 480 + side * mix(74, 42, pose.rise) + dx * .5, y: mix(452, 482, pose.rise) - lift * .6 };
    const foot = { x: 480 + side * 90 + dx, y: FLOOR - lift };
    limb(ctx, hip, knee, 40 * pose.narrow, who === 'chad' ? '#e63946' : '#2b2b30'); limb(ctx, knee, foot, 26, skin);
    ctx.fillStyle = '#f6f6f6'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(foot.x - 24, foot.y - 12, 48, 30, 10); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  for (const side of [-1, 1] as const) {
    const arm = benchArmPose(b, who, side);
    limb(ctx, arm.shoulder, arm.elbow, 30 * arm.scale, skin); limb(ctx, arm.elbow, arm.hand, 24 * arm.scale, skin);
  }
}
/** Out cold from the moment the bar lands on him. */
const isKO = (b: Bench, who: Who): boolean => b.hitLifter === who && (!b.impactPending || b.dumpAge > .5);
function drawBenchHands(ctx: CanvasRenderingContext2D, b: Bench, who: Who): void {
  const pose = benchFigurePose(b, who);
  const skin = skinFor(who, isKO(b, who) ? .1 : b.tension * (1 - pose.flex) * (1 - pose.phone));
  for (const side of [-1, 1] as const) {
    const { hand, scale, grip } = benchArmPose(b, who, side);
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(hand.x - 13 * scale, hand.y - 9 * scale, 26 * scale, 22 * scale, 8 * scale); ctx.fill(); ctx.stroke();
    if (grip > .05) { ctx.strokeStyle = `rgba(28,31,38,${.45 * grip})`; ctx.lineWidth = 1.5; for (const offset of [-5, 2, 8]) { ctx.beginPath(); ctx.moveTo(hand.x + offset * scale, hand.y - 4 * scale); ctx.lineTo(hand.x + offset * scale, hand.y + 10 * scale); ctx.stroke(); } }
  }
  if (who === 'bro' && pose.phone > .001) {
    // The phone held up in his fists, or in his left while the right hovers; its screen goes red when he sells.
    const left = benchArmPose(b, who, -1).hand, right = benchArmPose(b, who, 1).hand, k = clamp(b.hover.x, 0, 1), s = pose.scale;
    const x = mix((left.x + right.x) / 2, left.x + 8 * s, k), y = mix((left.y + right.y) / 2, left.y, k) - 8 * s;
    ctx.save(); ctx.globalAlpha *= pose.phone * (1 - clamp(b.spotHands.x, 0, 1));
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - 11 * s, y - 16 * s, 22 * s, 32 * s, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = b.dumped ? '#e63946' : '#2e8b57'; ctx.fillRect(x - 7 * s, y - 11 * s, 14 * s, 22 * s); ctx.restore();
  }
}

/** Everything on and around the bench, back to front. */
export function drawBench(ctx: CanvasRenderingContext2D, b: Bench): void {
  const who = b.onBench;
  // One rig per person, including the walk to the side and the spotter's descent onto the pad. The spotter stands
  // behind the rack; the chad keeps the layer he had on the bench after he hands it over, so nothing jumps in front of him.
  if (who === 'chad') { drawBenchFigure(ctx, b, 'bro'); drawBenchHands(ctx, b, 'bro'); }
  // Rack uprights and hooks, jolted when the bar lands.
  const jolt = clamp(b.jolt.x, -1, 1);
  ctx.save();
  ctx.translate(0, jolt * 4);
  for (const x of [UPRIGHT.left, UPRIGHT.right]) {
    ctx.fillStyle = '#4a4a55'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - 9, UPRIGHT.top, 18, UPRIGHT.base - UPRIGHT.top, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x - 30, UPRIGHT.base - 6, 60, 12, 4); ctx.fill(); ctx.stroke();
    const inner = x < 480 ? 1 : -1;
    ctx.beginPath(); ctx.roundRect(x < 480 ? x + 6 : x - 26, BAR.rack - 4, 20, 22, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.roundRect(x + inner * 8 + (inner < 0 ? -12 : 0), BAR.rack + 8, 12, 10, 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // The syringe, out: bouncing across the floor behind the bench.
  const s = b.syringe;
  if (s.out) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.2 * smoothstep(SYRINGE_FLOOR - 140, SYRINGE_FLOOR, s.y)})`;
    ctx.beginPath(); ctx.ellipse(s.x, SYRINGE_FLOOR + 6, 26, 4, 0, 0, Math.PI * 2); ctx.fill();
    drawSyringe(ctx, s.x, s.y, s.angle, s.scale);
  }
  // Bench: far half.
  ctx.fillStyle = '#7a1a24'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(444, 388); ctx.lineTo(516, 388); ctx.lineTo(534, 440); ctx.lineTo(426, 440); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a4a55';
  ctx.beginPath(); ctx.roundRect(470, 400, 20, 120, 3); ctx.fill(); ctx.stroke();
  drawBenchFigure(ctx, b, who);
  if (who === 'bro') drawBenchFigure(ctx, b, 'chad');
  // The bar, bent by the load.
  ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(BAR.left, barAt(b, BAR.left));
  for (let x = BAR.left + 16; x <= BAR.right; x += 16) ctx.lineTo(x, barAt(b, x));
  ctx.stroke();
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(BAR.left + 10, barAt(b, BAR.left + 10) - 3);
  for (let x = BAR.left + 26; x <= BAR.right - 10; x += 16) ctx.lineTo(x, barAt(b, x) - 3);
  ctx.stroke();
  // Knurling hints where the hands go.
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.4)'; ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) for (let i = -14; i <= 14; i += 5) { const x = 480 + side * 88 + i; ctx.beginPath(); ctx.moveTo(x, barAt(b, x) - 4); ctx.lineTo(x, barAt(b, x) + 4); ctx.stroke(); }
  // Fingers share the exact endpoint used by the forearm throughout release.
  drawBenchHands(ctx, b, who);
  if (who === 'bro') drawBenchHands(ctx, b, 'chad');
  for (const p of b.plates) {
    if (p.gone) continue;
    const onBar = !p.loose;
    const x = p.x;
    const y = onBar ? barAt(b, x) : p.y;
    const colour = PLATE_COLOURS[p.index]!;
    const h = p.index === 4 ? 66 : 88;
    ctx.save();
    ctx.translate(x, y);
    if (!onBar) ctx.rotate(p.angle);
    ctx.fillStyle = colour; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-6, -h / 2, 12, h, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(-4, -h / 2 + 4, 3, h - 8);
    ctx.fillStyle = INK;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
  // Collars at the ends.
  for (const x of [BAR.left + 6, BAR.right - 6]) { ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 5, barAt(b, x) - 11, 10, 22, 3); ctx.fill(); ctx.stroke(); }
  // The arm from off-screen sliding a plate on.
  if (b.arrival) {
    const a = b.arrival;
    const k = smoothstep(0, 0.45, a.age) * (1 - smoothstep(0.65, 1, a.age));
    const edgeX = a.side < 0 ? -40 : 1000;
    const slotX = plateX(a.side, a.index);
    const hx = mix(edgeX, slotX + a.side * -14, k);
    const hy = barAt(b, slotX) + 40;
    limb(ctx, { x: edgeX, y: hy + 30 }, { x: hx, y: hy }, 22, '#c68e6a');
    ctx.beginPath(); ctx.arc(hx, hy, 13, 0, Math.PI * 2); ctx.fillStyle = '#c68e6a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    if (a.age < 0.5) {
      ctx.save();
      ctx.translate(hx + a.side * 14, hy - 40);
      ctx.fillStyle = PLATE_COLOURS[a.index]!; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(-6, -44, 12, 88, 3); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.font = '900 18px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.globalAlpha = k;
    const ticker = `+ ${TICKERS[a.index % TICKERS.length]!}`;
    ctx.strokeText(ticker, hx, hy - 60); ctx.fillText(ticker, hx, hy - 60);
    ctx.globalAlpha = 1;
  }
  // Near end of the bench occludes the planted thighs.
  ctx.fillStyle = '#7a1a24'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(426, 468); ctx.lineTo(534, 468); ctx.lineTo(548, 520); ctx.lineTo(412, 520); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath(); ctx.moveTo(436, 474); ctx.lineTo(524, 474); ctx.lineTo(530, 490); ctx.lineTo(430, 490); ctx.closePath(); ctx.fill();
  ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText('EXIT LIQUIDITY', 480, 509); ctx.fillStyle = '#ffd1d8'; ctx.fillText('EXIT LIQUIDITY', 480, 509);
  // The crash starts on the spotter's phone: the dev's sell goes through, the notification pops over his head.
  if (b.dumped && who === 'chad') {
    const pose = benchFigurePose(b, 'bro'), head = figurePoint(pose, { x: HEAD.x, y: HEAD.y - pose.rise * 68 + pose.drop });
    const t = clamp(b.dumpAge / 0.22, 0, 1), k = t < 1 ? 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2 : 1;
    ctx.save();
    ctx.translate(head.x, head.y - 54);
    ctx.scale(k, k);
    ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-62, -16, 124, 30, 9); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 14); ctx.lineTo(0, 23); ctx.lineTo(7, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(-8, 10, 16, 5);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 18px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SELL FILLED', 0, 6);
    ctx.restore();
  }
  // The syringe's label, up from the moment it lands and over whoever stands in front of it.
  const label = s.out ? clamp(s.landed / 0.2, 0, 1) : 0;
  if (label > 0) {
    ctx.save(); ctx.globalAlpha = label;
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.font = '900 13px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeText('DEFINITELY CREATINE', s.x + 10, SYRINGE_FLOOR - 18 - 6 * label); ctx.fillText('DEFINITELY CREATINE', s.x + 10, SYRINGE_FLOOR - 18 - 6 * label);
    ctx.restore();
  }
}

export const benchHead = (): Point => HEAD;
