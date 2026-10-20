/**
 * The curler: Gigachad in profile, the only grayscale thing in the gym,
 * curling a dumbbell. The face never moves. The bicep is the balloon: it
 * swells with the displayed multiplier, puffs on every rep, goes veiny
 * then shiny, tears its sleeve, and reads its own pressure on a cuff whose
 * LCD fills a bonding curve. It grows into the path of its own forearm, so
 * the reps shorten and squash it until he can't finish one. An accepted
 * exit drops the weight, kisses the peak and puts the shades on while the
 * arm keeps growing. The crash bursts it into a seeded cloud of protein
 * powder and leaves a noodle. Nothing here changes the outcome.
 */
import { endurance } from './endurance';
import { type Spring, clamp, fract, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, type Point } from './gym';

const GRAY = '#cfcfcf';
const GRAY_SHADE = '#a9a9a9';
const BEARD = '#3a3a3a';
const TEE = '#f2f2f2';
const FEET_Y = 500;
const SHOULDER: Point = { x: 456, y: 268 };
const ELBOW: Point = { x: 462, y: 342 };
const FOREARM = 74;
export const SLEEVE_AT = 2.3;
/** The bonding curve on the cuff fills from 1× and graduates here; the market cap reads $69K at that point. */
export const GRADUATE_AT = 3;
/** The most the fist and the plates may squash the bicep, as a share of its radius, before the curl stops. */
const SQUASH = 0.22;
/** The highest a curl goes while he holds the weight: the top plate stays a few pixels clear of his beard. */
const HELD_TOP = 0.78;
/** How hard the reps aim past the bicep in the forearm's way: from 4× he starts grinding, by 6× he can't finish one. */
const grindFor = (multiplier: number): number => smoothstep(4, 6, multiplier);
/** The floor line a dropped dumbbell's lowest point rests on: lying flat, its centre sits 20 px above it. */
const DUMBBELL_FLOOR = FEET_Y + 10;

interface Shred { x: number; y: number; vx: number; vy: number; angle: number; spin: number; length: number; width: number; age: number; life: number; tone: number }
interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number }
/** The protein shaker on the floor: it rattles and hops with the arm's tremble, and goes over at the burst. */
interface Shaker { hop: Spring; tip: Spring; spill: number; lid: { x: number; y: number; vx: number; vy: number; angle: number; spin: number; flying: boolean; down: boolean } }
const SHAKER_AT: Point = { x: 322, y: 500 };

export type CurlMode = 'idle' | 'curling' | 'posing';

type Dumbbell = { x: number; y: number; vx: number; vy: number; angle: number; spin: number; rest: number; dropped: boolean; impacted: boolean; sunk: number };

export interface Curler {
  time: number;
  mode: CurlMode;
  modeAge: number;
  /** The rep cycle, in reps: each one lifts, squeezes, lowers slowly and rests. */
  phase: number;
  /** The bicep's throb, in beats, integrated so it can quicken with the load without its phase jumping. */
  throbPhase: number;
  /** The furthest the forearm can curl before the bicep in its way is squashed as far as it goes. */
  reach: number;
  /** How far past that reach each rep aims, eased toward grindFor so it never pops. */
  grind: number;
  curl: Spring;
  radius: Spring;
  puff: Spring;
  tension: number;
  act: number;
  effort: number;
  /** The endurance act's ring around the bicep, faded in and out rather than popped. */
  ring: number;
  stretch: number;
  /** The displayed multiplier, for the market cap on the cuff. */
  multiplier: number;
  sleeve: boolean;
  sleeveShreds: Shred[];
  burst: boolean;
  burstAge: number;
  burstAt: Point;
  burstHand: Point;
  shreds: Shred[];
  puffs: Puff[];
  noodle: Spring;
  shades: Spring;
  kiss: Spring;
  dumbbell: Dumbbell;
  tear: Spring;
  shaker: Shaker;
  /** `chalk` is a between-rounds regrip, `beat` a throb peak (the heartbeat cue). */
  events: { rep: boolean; sleeve: boolean; dropped: boolean; hop: boolean; chalk: boolean; beat: boolean };
}

const freshShaker = (): Shaker => ({ hop: spring(0), tip: spring(0), spill: 0, lid: { x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, flying: false, down: false } });
const freshDumbbell = (): Dumbbell => ({ x: 0, y: DUMBBELL_FLOOR - 20, vx: 0, vy: 0, angle: 0, spin: 0, rest: 0, dropped: false, impacted: false, sunk: 0 });
const quietEvents = () => ({ rep: false, sleeve: false, dropped: false, hop: false, chalk: false, beat: false });

export function createCurler(): Curler {
  return { time: 0, mode: 'idle', modeAge: 0, phase: 0, throbPhase: 0, reach: 1.15, grind: 0, act: 0, effort: 0, ring: 0, curl: spring(0.1), radius: spring(16), puff: spring(0), tension: 0, stretch: 0, multiplier: 1, sleeve: true, sleeveShreds: [], burst: false, burstAge: 0, burstAt: { ...ELBOW }, burstHand: { ...ELBOW }, shreds: [], puffs: [], noodle: spring(0), shades: spring(0), kiss: spring(0), dumbbell: freshDumbbell(), tear: spring(0), shaker: freshShaker(), events: quietEvents() };
}

export function resetCurler(c: Curler): void {
  c.mode = 'idle';
  c.modeAge = 0;
  c.phase = 0;
  c.grind = 0;
  c.ring = 0;
  settleSpring(c.curl, 0.1);
  settleSpring(c.radius, 16);
  settleSpring(c.puff, 0);
  c.stretch = 0;
  c.multiplier = 1;
  c.sleeve = true;
  c.sleeveShreds = [];
  c.burst = false;
  c.burstAge = 0;
  c.shreds = [];
  c.puffs = [];
  settleSpring(c.noodle, 0);
  settleSpring(c.shades, 0);
  settleSpring(c.kiss, 0);
  c.dumbbell = freshDumbbell();
  settleSpring(c.tear, 0);
  c.shaker = freshShaker();
}

export const radiusFor = (growth: number): number => 16 + 94 * (1 - Math.exp(-growth / 2.6));

/** How far the bonding curve has filled: empty at 1×, graduated at 3×. */
export const curveFill = (multiplier: number): number => clamp((multiplier - 1) / (GRADUATE_AT - 1), 0, 1);

/**
 * The market cap the cuff reads: the number squared, in a currency nobody asked about, launching at $7.7K and
 * graduating at $69K like a coin on a launchpad; nothing once it bursts.
 */
export function marketCap(multiplier: number, burst: boolean): string {
  if (burst) return '$0';
  const n = 69000 * (multiplier / GRADUATE_AT) ** 2;
  if (n < 1e5) return `$${(n / 1e3).toFixed(1)}K`;
  if (n < 1e6) return `$${(n / 1e3).toFixed(0)}K`;
  if (n < 1e7) return `$${(n / 1e6).toFixed(2)}M`;
  if (n < 1e9) return `$${(n / 1e6).toFixed(1)}M`;
  if (n < 1e12) return `$${(n / 1e9).toFixed(2)}B`;
  if (n < 1e15) return `$${(n / 1e12).toFixed(1)}T`;
  return `$${n.toExponential(1).replace('+', '')}`;
}

/**
 * Jumps straight to the state a multiplier calls for, for a round met late. `posed` is for an exit already
 * taken: the weight is down, the kiss is over and the shades are on, with no drop event to react to. `seconds` is
 * how long the round has been running (0 once it has crashed), for the endurance act under way.
 */
export function settleCurler(c: Curler, multiplier: number, growth: number, posed = false, seconds = 0): void {
  c.mode = posed ? 'posing' : 'curling';
  c.effort = endurance(seconds).effort;
  c.modeAge = posed ? 2 : 1; // past the kiss, which runs from 0.3 s to 1.4 s into the pose, or the first reps' wind-up
  c.multiplier = multiplier;
  settleSpring(c.radius, radiusFor(growth));
  c.sleeve = multiplier < SLEEVE_AT;
  // The weight is already on the floor for a pose, so only the empty fist meets the bicep.
  if (posed) c.dumbbell.dropped = c.dumbbell.impacted = true;
  c.reach = curlAtPress(c, SQUASH);
  c.grind = posed ? 0 : grindFor(multiplier);
  if (!posed) return;
  settleSpring(c.curl, Math.min(1, c.reach + 0.08));
  settleSpring(c.shades, 1);
  c.dumbbell.x = curlerArm(c).hand.x;
}

/** The exit was accepted: drop it, kiss it, shades. */
export function poseCurler(c: Curler): void {
  if (c.mode !== 'curling') return;
  releaseDumbbell(c);
  c.mode = 'posing';
  c.modeAge = 0;
}

/** The forearm at a curl: 0 hangs, 1 is a full curl. The held dumbbell's bar crosses the fist. */
function armAt(curl: number, rate = 0) {
  const angle = mix(Math.PI / 2, -Math.PI / 2.4, clamp(curl, -0.1, 1.15));
  const angularVelocity = rate * (-Math.PI / 2.4 - Math.PI / 2);
  const hand = { x: ELBOW.x + Math.cos(angle) * FOREARM, y: ELBOW.y + Math.sin(angle) * FOREARM };
  return { hand, angle, bar: angle + Math.PI / 2, vx: -Math.sin(angle) * FOREARM * angularVelocity, vy: Math.cos(angle) * FOREARM * angularVelocity };
}
/** A single pose drives the hand, held weight and release snapshot. */
export const curlerArm = (c: Curler) => armAt(c.curl.x, c.curl.v);
function releaseDumbbell(c: Curler): void {
  if (c.dumbbell.dropped) return;
  const pose = curlerArm(c);
  const strain = c.mode === 'curling' && !c.burst ? c.tension : 0;
  const tremble = Math.sin(c.time * 43) * 2.5 * strain * strain;
  Object.assign(c.dumbbell, { x: pose.hand.x + tremble, y: pose.hand.y, vx: clamp(pose.vx, -100, 100), vy: clamp(pose.vy, -180, 360), angle: pose.bar, spin: 1.4, dropped: true, impacted: false });
}

/** How far below its centre a dumbbell reaches at an angle: half the bar's 78 px across the plates, half a plate's 40. */
export const dumbbellDepth = (angle: number): number => 39 * Math.abs(Math.sin(angle)) + 20 * Math.abs(Math.cos(angle));

/** The bicep at rest, before the throb and any squash. */
function bicepRest(c: Curler): { centre: Point; r: number; ry: number } {
  const r = Math.max(8, c.radius.x + c.puff.x);
  return { centre: { x: ELBOW.x + 20 + r * .65, y: 316 + r * .16 }, r, ry: Math.min(73, r * .7) };
}

/** How deep the fist or the nearer plate sits in the bicep at a curl, as a share of its radius, and from where. */
function pressAt(c: Curler, curl: number): { depth: number; at: Point } {
  const b = bicepRest(c);
  const { hand, angle } = armAt(curl);
  let best = { depth: -Infinity, at: hand };
  // The fist, then the two plates either side of it along the bar while he still holds it.
  for (const [along, pad] of c.dumbbell.dropped ? [[0, 10]] as const : [[0, 10], [30, 6], [-30, 6]] as const) {
    const at = { x: hand.x - Math.sin(angle) * along, y: hand.y + Math.cos(angle) * along };
    const depth = 1 - Math.hypot((at.x - b.centre.x) / (b.r + pad), (at.y - b.centre.y) / (b.ry + pad));
    if (depth > best.depth) best = { depth, at };
  }
  return best;
}

/**
 * The first curl, coming up from the hanging arm, at which the press reaches `depth`; a full curl if it never does.
 * Every point on the way that falls just short still holds the curl a little above itself, so the limit closes in
 * smoothly as the bicep grows instead of snapping the forearm back when a new bulge first reaches `depth`.
 */
function curlAtPress(c: Curler, depth: number): number {
  let reach = 1.15, k0 = -0.1, d0 = pressAt(c, k0).depth;
  for (let i = 0; i <= 50; i += 1) {
    const k = -0.1 + i * 0.025, d = pressAt(c, k).depth;
    if (d0 < depth && d >= depth) reach = Math.min(reach, k0 + (k - k0) * (depth - d0) / (d - d0));
    reach = Math.min(reach, k + 0.6 * Math.max(0, depth - d));
    k0 = k; d0 = d;
  }
  return reach;
}

/**
 * Where the bicep is drawn from: centre and radius in world space, and the squash the forearm presses into it:
 * how much (a share of the radius, up to SQUASH) and along which direction.
 */
export function bicepGeometry(c: Curler): { centre: Point; r: number; rx: number; ry: number; squash: number; along: number } {
  const { centre, r, ry } = bicepRest(c);
  // Anticipation: the throb quickens and deepens with the load (about two beats a second at the top).
  const throb = (0.08 + 0.06 * c.tension) * Math.sin(c.throbPhase * Math.PI * 2);
  const press = c.burst ? { depth: 0, at: centre } : pressAt(c, c.curl.x);
  return { centre, r, rx: r * (1 + throb * .45), ry, squash: clamp(press.depth, 0, SQUASH), along: Math.atan2(press.at.y - centre.y, press.at.x - centre.x) };
}

/**
 * One rep, for a phase within it: a 0.35 lift, a 0.1 squeeze, a slow 0.45 lowering and a 0.1 rest. `stall`
 * (0 to 0.9) warps the lift's time so it grinds through a sticking point about halfway up as the load grows.
 */
function stroke(u: number, stall: number): number {
  if (u < 0.35) {
    const p = u / 0.35, p0 = 0.467; // smoothstep(p0) is 0.45: the sticking point
    return smoothstep(0, 1, p - (stall / (Math.PI * 2)) * (Math.sin(Math.PI * 2 * (p - p0)) + Math.sin(Math.PI * 2 * p0)));
  }
  if (u < 0.45) return 1;
  if (u < 0.9) return 1 - smoothstep(0.45, 0.9, u);
  return 0;
}

/**
 * Between rounds, a six-second warm-up: a chalked regrip that dips the weight at 0.3 s and 3.3 s, and a flex
 * from 1.6 s that slaps the bicep up with a puff at the top.
 */
function warmUp(t: number, flex: number): number {
  const k = t % 6;
  const dip = (at: number) => Math.sin(Math.PI * clamp((k - at) / 0.4, 0, 1));
  return mix(0.1 - 0.1 * (dip(0.3) + dip(3.3)), flex, smoothstep(1.6, 1.95, k) * (1 - smoothstep(2.45, 2.9, k)));
}

/** The bicep goes. `quiet` skips the effects for a crash that already happened. */
export function burstBicep(c: Curler, seed: number, quiet: boolean): void {
  if (c.burst) return;
  const g = bicepGeometry(c);
  c.burstHand = curlerArm(c).hand;
  releaseDumbbell(c);
  c.burst = true;
  c.burstAge = quiet ? 10 : 0;
  c.burstAt = g.centre;
  c.shreds = [];
  c.puffs = [];
  c.dumbbell.dropped = true;
  if (quiet) {
    settleSpring(c.noodle, 1);
    settleSpring(c.tear, 1);
    Object.assign(c.dumbbell, { sunk: 1, y: DUMBBELL_FLOOR - 20, angle: 0, rest: 0, spin: 0, vx: 0, vy: 0, impacted: true });
    settleSpring(c.shaker.tip, 1);
    c.shaker.spill = 1;
    c.shaker.lid = { x: SHAKER_AT.x + 96, y: SHAKER_AT.y - 4, vx: 0, vy: 0, angle: 0.3, spin: 0, flying: true, down: true };
    return;
  }
  const rng = mulberry32(seed);
  for (let i = 0; i < 26; i += 1) {
    const a = (i / 26) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const speed = 200 + rng() * 380;
    c.shreds.push({ x: g.centre.x + Math.cos(a) * g.rx, y: g.centre.y + Math.sin(a) * g.ry, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 120, angle: a, spin: (rng() - 0.5) * 20, length: 10 + rng() * 24, width: 3 + rng() * 4, age: 0, life: 1.4 + rng() * 0.8, tone: rng() });
  }
  for (let i = 0; i < 18; i += 1) {
    const a = rng() * Math.PI * 2;
    const s = 60 + rng() * 200;
    c.puffs.push({ x: g.centre.x, y: g.centre.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, r: 10 + rng() * 22, age: rng() * 0.1, life: 1.6 + rng() * 0.8 });
  }
}

export interface CurlerDrive { running: boolean; multiplier: number; growth: number; tension: number; seconds?: number }

/** A dumbbell on the floor topples flat onto its plates about its lowest corner, rocking once; airborne, it falls. */
function stepDumbbell(c: Curler, dt: number): void {
  const d = c.dumbbell;
  if (!d.impacted || d.vy < 0 || d.y + dumbbellDepth(d.angle) < DUMBBELL_FLOOR - 0.5) {
    d.x += d.vx * dt;
    d.y += d.vy * dt + 700 * dt * dt;
    d.vy += 1400 * dt;
    d.angle += d.spin * dt;
    const depth = dumbbellDepth(d.angle);
    if (d.y + depth >= DUMBBELL_FLOOR && d.vy > 0) {
      d.y = DUMBBELL_FLOOR - depth;
      if (!d.impacted) c.events.dropped = true;
      d.impacted = true;
      d.rest = Math.round(d.angle / Math.PI) * Math.PI;
      d.vy = !c.burst && d.vy > 90 ? -d.vy * 0.2 : 0;
      d.vx *= 0.4; d.spin *= 0.3;
    }
    return;
  }
  // On the floor: the corner touching it stays put while the angle springs to the nearest flat rest.
  const lx = 39 * (Math.sin(d.angle) >= 0 ? 1 : -1), ly = 20 * (Math.cos(d.angle) >= 0 ? 1 : -1);
  const pivotX = d.x + lx * Math.cos(d.angle) - ly * Math.sin(d.angle);
  const turn = stepSpring({ x: d.angle, v: d.spin }, d.rest, 11, 0.42, dt);
  d.angle = turn.x; d.spin = turn.v;
  d.x = pivotX - (lx * Math.cos(d.angle) - ly * Math.sin(d.angle));
  d.y = DUMBBELL_FLOOR - dumbbellDepth(d.angle);
  d.vx = d.vy = 0;
}

export function stepCurler(c: Curler, drive: CurlerDrive, dt: number): void {
  c.time += dt;
  const idleBefore = c.modeAge;
  c.modeAge += dt;
  c.tension = drive.tension;
  // The act's effort eases out at the crash rather than dropping the cuff it slides and the reps it slows in a frame.
  const act = endurance(drive.seconds ?? 0); c.act = act.act; c.effort += ((drive.running ? act.effort : 0) - c.effort) * (1 - Math.exp(-dt / 0.2));
  c.multiplier = drive.multiplier;
  c.events = quietEvents();
  if (c.mode === 'idle' && drive.running) { c.mode = 'curling'; c.modeAge = 0; }
  // The throb, and the heartbeat cue at each of its peaks: from 1.4 s a beat at rest to 0.35 s at full tension.
  const beats = c.throbPhase;
  c.throbPhase += dt / mix(1.4, 0.35, drive.tension);
  if (Math.floor(c.throbPhase + 0.75) > Math.floor(beats + 0.75)) c.events.beat = true;
  if (c.mode === 'curling' && drive.running && !c.burst) {
    const before = c.phase;
    c.phase += (0.7 + 0.9 * (1 - Math.exp(-drive.growth / 2))) * (1 - (c.act === 2 ? .7 : .25) * c.effort) * dt;
    // The rep lands at the top of the lift, where the forearm squeezes the bicep and it pumps.
    if (Math.floor(c.phase - 0.35) > Math.floor(before - 0.35)) {
      c.events.rep = true;
      c.puff.v += 40 + 60 * drive.tension;
      // The shaker on the floor hops with the heavier reps.
      if (drive.tension > 0.4) { c.shaker.hop.v += 4 + 6 * drive.tension; c.events.hop = true; }
    }
  }
  if (c.mode === 'idle') {
    // Between rounds: chalk at the bottom of each regrip, a slap of pump at the top of the flex.
    const crossed = (at: number) => Math.floor((c.modeAge - at) / 6) > Math.floor((idleBefore - at) / 6);
    if (crossed(0.5) || crossed(3.5)) c.events.chalk = true;
    if (crossed(1.95)) c.puff.v += 20;
  }
  // The shaker: the hop settles, and after the burst it tips over, loses its lid and spills.
  const sh = c.shaker;
  stepSpring(sh.hop, 0, 16, 0.3, dt);
  stepSpring(sh.tip, c.burst ? 1 : 0, 7, 0.55, dt);
  if (c.burst && sh.tip.x > 0.6) {
    if (!sh.lid.flying) sh.lid = { x: SHAKER_AT.x + 52, y: SHAKER_AT.y - 14, vx: 140, vy: -230, angle: 0, spin: 14, flying: true, down: false };
    sh.spill = Math.min(1, sh.spill + dt / 0.9);
  }
  if (sh.lid.flying && !sh.lid.down) {
    sh.lid.vy += 900 * dt;
    sh.lid.x += sh.lid.vx * dt;
    sh.lid.y += sh.lid.vy * dt;
    sh.lid.angle += sh.lid.spin * dt;
    if (sh.lid.y > SHAKER_AT.y - 4 && sh.lid.vy > 0) {
      sh.lid.y = SHAKER_AT.y - 4;
      if (sh.lid.vy > 120) { sh.lid.vy *= -0.35; sh.lid.vx *= 0.7; sh.lid.spin *= 0.5; }
      else { sh.lid.down = true; sh.lid.angle = 0.3; }
    }
  }
  if (!c.burst) {
    stepSpring(c.radius, drive.running || c.mode === 'posing' ? radiusFor(drive.growth) : 16, 6, 0.95, dt);
    c.stretch = smoothstep(1, 4.2, drive.growth);
    if (c.sleeve && drive.running && drive.multiplier >= SLEEVE_AT) {
      c.sleeve = false;
      c.events.sleeve = true;
      for (let i = 0; i < 9; i += 1) c.sleeveShreds.push({ x: SHOULDER.x + 10, y: SHOULDER.y + 20, vx: 60 + noise(i) * 200, vy: -80 - noise(i * 3) * 160, angle: noise(i * 7) * 6, spin: (noise(i * 11) - 0.5) * 16, length: 10 + noise(i * 5) * 16, width: 4, age: 0, life: 1.4, tone: 1 });
    }
  }
  stepSpring(c.puff, 0, 11, 0.32, dt);
  // The bicep is in the forearm's way: each rep aims a little past where the fist meets it, so the squeeze squashes
  // it, and the curl stops where it will squash no further. From about 4× the reps aim well beyond it: he grinds
  // against his own arm and can't finish one.
  const contact = curlAtPress(c, 0);
  c.reach = curlAtPress(c, SQUASH);
  c.grind += ((c.mode === 'curling' ? grindFor(drive.multiplier) : 0) - c.grind) * (1 - Math.exp(-dt / 0.5));
  const span = Math.min(HELD_TOP, contact + (c.reach - contact) * mix(0.55, 1, c.grind)) + 0.35 * c.grind;
  const rep = stroke(fract(c.phase), 0.9 * smoothstep(0.2, 0.8, drive.tension)) * span;
  const target = c.mode === 'curling' ? c.act === 2 ? mix(rep, .5 * span, c.effort * .8) : rep : c.mode === 'posing' ? Math.min(1, c.reach + 0.08) : warmUp(c.modeAge, Math.min(HELD_TOP, c.reach + 0.05));
  // The curl stiffens into the reps over the first 0.4 s, so the round's start eases out of the warm-up.
  stepSpring(c.curl, c.burst ? 0 : target, c.mode === 'curling' ? mix(6, 30, smoothstep(0, 0.4, c.modeAge)) : 6, 0.9, dt);
  if (!c.burst && c.curl.x > c.reach) {
    // Pressed against the bicep: the forearm stops dead, trembling while he grinds.
    c.curl.x = c.reach - 0.012 * c.grind * (0.5 + 0.5 * Math.sin(c.time * 38));
    c.curl.v = Math.min(0, c.curl.v);
  }
  stepSpring(c.shades, c.mode === 'posing' && c.modeAge > 0.9 ? 1 : 0, 12, 0.5, dt);
  stepSpring(c.kiss, c.mode === 'posing' && c.modeAge > 0.3 && c.modeAge < 1.4 ? 1 : 0, 8, 0.7, dt);
  c.ring += ((!c.burst && (c.act === 3 || c.act === 4) ? c.effort : 0) - c.ring) * (1 - Math.exp(-dt / 0.15));
  const d = c.dumbbell;
  if (d.dropped) {
    stepDumbbell(c, dt);
    if (c.burst && d.impacted) d.sunk = Math.min(1, d.sunk + dt * 1.5);
  }
  if (c.burst) {
    c.burstAge += dt;
    stepSpring(c.noodle, 1, 5, 0.25, dt);
    stepSpring(c.tear, c.burstAge > 0.7 ? 1 : 0, 4, 0.9, dt);
    const drag = Math.exp(-1.8 * dt);
    for (const s of c.shreds) { s.age += dt; s.vy += 1000 * dt; s.vx *= drag; s.vy *= drag; s.x += s.vx * dt; s.y += s.vy * dt; s.angle += s.spin * dt; if (s.y > FEET_Y - 2 && s.vy > 0) { s.y = FEET_Y - 2; s.vy *= -0.3; s.vx *= 0.7; } }
    c.shreds = c.shreds.filter((s) => s.age < s.life);
    for (const p of c.puffs) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 40 * dt; p.vx *= Math.exp(-2.5 * dt); p.vy = p.vy * Math.exp(-2.5 * dt) - 10 * dt; }
    c.puffs = c.puffs.filter((p) => p.age < p.life);
  }
  for (const s of c.sleeveShreds) { s.age += dt; s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.angle += s.spin * dt; }
  c.sleeveShreds = c.sleeveShreds.filter((s) => s.age < s.life);
}

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, colour: string): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width + 5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
}

/** A dumbbell, its bar bent by `bend` toward its local +y; `holeY` hides whatever has sunk below a hole's lip. */
function drawDumbbell(ctx: CanvasRenderingContext2D, at: Point, angle: number, bend: number, holeY?: number): void {
  ctx.save();
  if (holeY !== undefined) { ctx.beginPath(); ctx.rect(at.x - 90, holeY - 240, 180, 240); ctx.clip(); }
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, bend, 26, 0); ctx.stroke();
  ctx.strokeStyle = '#8d99ae'; ctx.lineWidth = 8; ctx.stroke();
  for (const x of [-30, 30]) { ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x - 9, -20, 18, 40, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x - 6, -16, 4, 32); }
  ctx.restore();
}

/** The gauge on the cuff, and the readout under it: the bicep's market cap and its bonding curve, filling to graduation. */
function drawCuff(ctx: CanvasRenderingContext2D, at: Point, k: number, time: number, cap: string, fill: number, dead: boolean): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.fillStyle = '#6b7a8c'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-16, -12, 32, 24, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, 4); ctx.quadraticCurveTo(34, 10, 38, 30); ctx.stroke();
  ctx.translate(40, 44);
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = '#f6f4ec'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 11, 0.35, 0.95); ctx.strokeStyle = '#ef233c'; ctx.lineWidth = 4; ctx.stroke();
  const a = -2.35 + 3.3 * clamp(k, 0, 1) + Math.sin(time * 37) * 0.09 * k * k;
  ctx.strokeStyle = '#d62839'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
  // The LCD on a cable below the gauge, hanging where the forearm and the dumbbell never swing.
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 15); ctx.quadraticCurveTo(-6, 52, 12, 76); ctx.stroke();
  ctx.fillStyle = dead ? '#3a1420' : '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(4, 74, 80, 33, 3); ctx.fill(); ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = dead ? '#ff9db0' : '#8fd3ff'; ctx.font = '900 8px Impact, "Arial Black", sans-serif';
  ctx.fillText('MCAP', 8, 88);
  ctx.fillStyle = dead ? '#ff4d6d' : '#7cf67c'; ctx.font = '900 13px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(cap, 80, 89, 46);
  // The bonding curve: a bar that fills to graduation, then blinks its diploma.
  const graduated = !dead && fill >= 1;
  ctx.fillStyle = '#2a2f38'; ctx.fillRect(8, 94, 72, 9);
  ctx.fillStyle = dead ? '#ff4d6d' : graduated ? '#ffe27a' : '#7cf67c'; ctx.fillRect(8, 94, 72 * (dead ? 0 : fill), 9);
  ctx.font = '900 8px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  const label = dead ? 'CURVE: RUGGED' : graduated ? 'GRADUATED' : `BONDING CURVE ${Math.floor(fill * 100)}%`;
  ctx.fillStyle = dead ? '#ff9db0' : graduated ? (Math.floor(time * 3) % 2 ? '#1b1b1f' : '#7a2d00') : '#ffffff';
  ctx.fillText(label, 44, 102, 70);
  // Over the filled part of the bar the label turns dark, so it stays readable as the curve fills.
  if (!dead && !graduated && fill > 0) { ctx.beginPath(); ctx.rect(8, 94, 72 * fill, 9); ctx.clip(); ctx.fillStyle = '#14301a'; ctx.fillText(label, 44, 102, 70); }
  ctx.restore();
}

/** The shaker on the floor beside him: rattling and hopping with the tremble, on its side and spilling after the burst. */
function drawShaker(ctx: CanvasRenderingContext2D, c: Curler): void {
  const s = c.shaker;
  const strain = c.mode === 'curling' && !c.burst ? c.tension : 0;
  const rattle = Math.sin(c.time * 45) * 2.2 * strain * strain;
  const hop = Math.max(0, s.hop.x);
  const tip = clamp(s.tip.x, 0, 1);
  ctx.save();
  ctx.lineJoin = 'round';
  if (s.spill > 0.01) {
    ctx.fillStyle = 'rgba(248, 248, 244, 0.95)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(SHAKER_AT.x + 62 + 22 * s.spill, SHAKER_AT.y + 2, 8 + 34 * s.spill, 3 + 6 * s.spill, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath(); ctx.ellipse(SHAKER_AT.x + 22 * tip, SHAKER_AT.y + 4, 18 + 14 * tip, 5, 0, 0, Math.PI * 2); ctx.fill();
  // The body pivots on its bottom-right corner as it goes over.
  ctx.translate(SHAKER_AT.x + 13 + rattle, SHAKER_AT.y - hop * 7);
  ctx.rotate(tip * Math.PI / 2);
  ctx.scale(1 + 0.08 * hop, 1 - 0.08 * hop);
  ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-26, -40, 26, 40, [3, 3, 5, 5]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fillRect(-23, -36, 4, 30);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(-26, -27, 26, 12);
  ctx.strokeRect(-26, -27, 26, 12);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 9px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('WHEY', -13, -18);
  if (!s.lid.flying) { ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.roundRect(-27, -47, 28, 8, 3); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  if (s.lid.flying) {
    ctx.save();
    ctx.translate(s.lid.x, s.lid.y);
    ctx.rotate(s.lid.angle);
    ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-14, -4, 28, 8, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

export interface CurlerView { head: Point; hand: Point }

export function drawCurler(ctx: CanvasRenderingContext2D, c: Curler): CurlerView {
  const t = c.time;
  const curl = clamp(c.curl.x, -0.1, 1.15);
  const strain = c.mode === 'curling' && !c.burst ? c.tension : 0;
  const tremble = Math.sin(t * 43) * 2.5 * strain * strain;
  drawShaker(ctx, c);
  ctx.save();
  ctx.lineJoin = 'round';
  // Shadow, and the hole the dumbbell went through.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath(); ctx.ellipse(452, FEET_Y + 4, 70, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Skipped leg day: two sticks.
  const hip = { x: 440, y: 382 };
  limb(ctx, { x: hip.x - 6, y: hip.y }, { x: 428, y: FEET_Y }, 9, GRAY_SHADE);
  limb(ctx, { x: hip.x + 6, y: hip.y }, { x: 452, y: FEET_Y }, 9, GRAY);
  for (const fx of [428, 452]) { ctx.fillStyle = '#f6f6f6'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(fx - 12, FEET_Y - 6, 36, 12, [4, 8, 8, 4]); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.roundRect(424, 366, 34, 26, 6); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  // Keep the soles planted; strain travels through the chest and arms.
  ctx.translate(tremble, 0);
  // Far arm hanging with its own dumbbell.
  limb(ctx, { x: SHOULDER.x - 16, y: SHOULDER.y + 6 }, { x: 428, y: 360 }, 16, GRAY_SHADE);
  drawDumbbell(ctx, { x: 428, y: 372 }, 0.1, 0);
  // Torso: a barrel chest in a tight tee.
  ctx.fillStyle = TEE; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(420, 372); ctx.quadraticCurveTo(404, 300, 432, 256); ctx.quadraticCurveTo(470, 240, 500, 268); ctx.quadraticCurveTo(512, 320, 470, 376); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(28, 31, 38, 0.12)';
  ctx.beginPath(); ctx.ellipse(470, 300, 22, 30, 0.2, 0, Math.PI * 2); ctx.fill();
  // Head: the profile, stone still.
  const head = { x: 474, y: 212 };
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(clamp(c.kiss.x, 0, 1) * 0.55);
  ctx.fillStyle = GRAY; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-24, -34); ctx.quadraticCurveTo(-30, 10, -10, 30); ctx.lineTo(28, 36); ctx.quadraticCurveTo(44, 30, 40, 8); ctx.lineTo(34, -6); ctx.lineTo(30, -20); ctx.quadraticCurveTo(20, -42, -24, -34); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Beard along the jaw, hair on top.
  ctx.fillStyle = BEARD;
  ctx.beginPath(); ctx.moveTo(-10, 30); ctx.lineTo(28, 36); ctx.quadraticCurveTo(44, 30, 40, 8); ctx.lineTo(30, 12); ctx.quadraticCurveTo(20, 26, -6, 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath(); ctx.moveTo(-26, -30); ctx.quadraticCurveTo(-10, -50, 30, -36); ctx.quadraticCurveTo(30, -22, 24, -16); ctx.quadraticCurveTo(0, -30, -24, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Brow, a tiny eye, the nose, a flat mouth. None of it moves.
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(14, -14); ctx.lineTo(32, -10); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(24, -4, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(26, -4, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(34, -2); ctx.lineTo(42, 8); ctx.lineTo(34, 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(26, 20); ctx.lineTo(36, 20); ctx.stroke();
  // The one tear, after the burst.
  const tear = clamp(c.tear.x, 0, 1);
  if (tear > 0.02) { ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.moveTo(22, 2); ctx.lineTo(26, 6 + 18 * tear); ctx.lineTo(18, 6 + 18 * tear); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); }
  const shades = clamp(c.shades.x, 0, 1);
  if (shades > 0.02) { const dy = -80 * (1 - shades); ctx.fillStyle = INK; ctx.fillRect(12, -10 + dy, 26, 9); ctx.fillRect(16, -1 + dy, 18, 4); ctx.fillRect(-8, -9 + dy, 20, 3); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(15, -8 + dy, 8, 2); }
  // Sweat: allowed. Expression: not.
  const drops = strain > 0.8 ? 3 : strain > 0.5 ? 2 : strain > 0.25 ? 1 : 0;
  for (let i = 0; i < drops; i += 1) {
    const p = fract(t / 1.1 + i * 0.37);
    const sx = [-14, 30, 4][i]!;
    const y = -28 + 30 * p * p;
    ctx.globalAlpha = 1 - p * p; ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(sx, y, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (c.kiss.x > 0.3) { ctx.fillStyle = '#ff4d6d'; ctx.font = '900 16px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'left'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText('MWAH', 40, 30); ctx.fillText('MWAH', 40, 30); }
  ctx.restore();
  // The near arm: upper arm, the bicep on it, the forearm curling.
  const g = bicepGeometry(c);
  const { angle, hand: heldHand } = curlerArm(c);
  const hand = c.burst ? c.burstHand : heldHand;
  const noodle = clamp(c.noodle.x, 0, 1);
  if (noodle > 0.02) {
    // A limp noodle from the shoulder, wobbling, the cuff still on it reading nothing.
    ctx.strokeStyle = INK; ctx.lineWidth = 19; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(SHOULDER.x, SHOULDER.y);
    for (let i = 1; i <= 8; i += 1) {
      const u = i / 8;
      const start = u <= 0.5 ? { x: mix(SHOULDER.x, ELBOW.x, u * 2), y: mix(SHOULDER.y, ELBOW.y, u * 2) } : { x: mix(ELBOW.x, hand.x, (u - 0.5) * 2), y: mix(ELBOW.y, hand.y, (u - 0.5) * 2) };
      ctx.lineTo(mix(start.x, SHOULDER.x + 10 + Math.sin(t * 3 + i) * 10, noodle), mix(start.y, SHOULDER.y + i * 22, noodle));
    }
    ctx.stroke(); ctx.strokeStyle = GRAY; ctx.lineWidth = 14; ctx.stroke();
    drawCuff(ctx, { x: SHOULDER.x + 10 + Math.sin(t * 3 + 3) * 10 * noodle, y: SHOULDER.y + 66 * noodle }, 0, t, '$0', 0, true);
  } else {
    limb(ctx, SHOULDER, ELBOW, 22, GRAY);
    // The bicep: gray going red, veins with the load, a synthol sheen.
    const red = clamp(c.stretch, 0, 1);
    ctx.save();
    ctx.translate(g.centre.x, g.centre.y);
    // The forearm's squeeze flattens it where the fist presses in and lets it bulge a little across.
    if (g.squash > 0.001) { ctx.rotate(g.along); ctx.scale(1 - g.squash, 1 + 0.3 * g.squash); ctx.rotate(-g.along); }
    const fill = ctx.createRadialGradient(-g.rx * 0.3, -g.ry * 0.3, 2, 0, 0, Math.max(g.rx, g.ry) * 1.3);
    fill.addColorStop(0, `rgb(${Math.round(mix(235, 255, red))}, ${Math.round(mix(235, 200, red))}, ${Math.round(mix(235, 195, red))})`);
    fill.addColorStop(1, `rgb(${Math.round(mix(160, 200, red))}, ${Math.round(mix(160, 70, red))}, ${Math.round(mix(160, 70, red))})`);
    ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, g.rx, g.ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Veins creep out one after another with the load (the first by 1.2×, a third by 2×), and a few more
    // on the slow log scale for the very long rounds.
    const veins = clamp(c.tension, 0, 1) * 6 + 3 * smoothstep(1, 3, Math.log10(Math.max(1, c.multiplier)));
    ctx.strokeStyle = `rgba(90, 40, 120, ${0.4 + 0.5 * c.tension})`; ctx.lineWidth = 1.5 + 2 * c.tension; ctx.lineCap = 'round';
    for (let i = 0; i < veins; i += 1) {
      const a0 = i * 1.1 - 0.4 + (i >= 6 ? 0.55 : 0);
      const grown = clamp(veins - i, 0, 1) * 4;
      const at = (s: number) => s === 0 ? { x: Math.cos(a0) * g.rx * 0.2, y: Math.sin(a0) * g.ry * 0.2 } : { x: Math.cos(a0 + (noise(i * 3 + s) - 0.5) * 0.8) * g.rx * 0.22 * s, y: Math.sin(a0 + (noise(i * 5 + s) - 0.5) * 0.8) * g.ry * 0.22 * s };
      ctx.beginPath(); ctx.moveTo(at(0).x, at(0).y);
      for (let s = 1; s <= Math.ceil(grown); s += 1) { const a = at(s - 1), b = at(s), k = Math.min(1, grown - s + 1); ctx.lineTo(mix(a.x, b.x, k), mix(a.y, b.y, k)); }
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.5 * c.stretch})`;
    ctx.beginPath(); ctx.ellipse(-g.rx * 0.38, -g.ry * 0.42, g.rx * 0.18, g.ry * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (c.sleeve) { ctx.fillStyle = TEE; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(SHOULDER.x - 16, SHOULDER.y - 12); ctx.lineTo(SHOULDER.x + 22 + g.r * 0.4, SHOULDER.y + 4); ctx.lineTo(SHOULDER.x + 14 + g.r * 0.4, SHOULDER.y + 34); ctx.lineTo(SHOULDER.x - 20, SHOULDER.y + 26); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    limb(ctx, SHOULDER, ELBOW, 16, GRAY_SHADE);
    ctx.beginPath(); ctx.arc(ELBOW.x, ELBOW.y, 11, 0, Math.PI * 2); ctx.fillStyle = GRAY; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    // Through the hit-stop, before the arm goes limp, the LCD already reads the rug.
    drawCuff(ctx, { x: ELBOW.x - 6, y: ELBOW.y - 22 + (c.act === 1 ? c.effort * 14 : 0) }, 1 - Math.exp(-Math.log2(1 + (g.r - 16) / 20)), t, marketCap(c.multiplier, c.burst), curveFill(c.multiplier), c.burst);
    limb(ctx, ELBOW, hand, 18, GRAY);
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 12, 0, Math.PI * 2); ctx.fillStyle = GRAY; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  }
  if (c.ring > 0.01 && (c.act === 3 || c.act === 4)) {
    ctx.save(); ctx.globalAlpha = clamp(c.ring * 2, 0, 1); ctx.strokeStyle = c.act === 3 ? '#ffe27a' : '#d74a64'; ctx.lineWidth = 5; ctx.setLineDash(c.act === 3 ? [8, 5] : []);
    const sweep = c.ring * .6;
    ctx.beginPath(); ctx.ellipse(g.centre.x, g.centre.y, g.rx + 8, g.ry + 8, 0, -.8 - sweep, .8 + sweep); ctx.stroke(); ctx.restore();
  }
  // The dumbbell: in the hand, dropped on the floor, or through it.
  const d = c.dumbbell;
  if (d.dropped) {
    const floorY = DUMBBELL_FLOOR - 20;
    if (d.sunk > 0) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(d.x - tremble, floorY + 8, 46, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
    else if (d.impacted) { ctx.strokeStyle = 'rgba(28, 31, 38, 0.6)'; ctx.lineWidth = 2; for (const [dx, dy] of [[-40, 6], [44, 4], [-20, 14], [30, 16]] as const) { ctx.beginPath(); ctx.moveTo(d.x - tremble, floorY + 6); ctx.lineTo(d.x - tremble + dx, floorY + dy); ctx.stroke(); } }
    // Sinking keeps whatever angle it landed at and slides down through the hole, hidden below its lip.
    drawDumbbell(ctx, { x: d.x - tremble, y: d.y + d.sunk * (2 * dumbbellDepth(d.angle) + 8) }, d.angle, 0, d.sunk > 0 ? floorY + 8 : undefined);
  } else if (noodle < 0.02) {
    // The bar crosses the fist; its sag always hangs toward the floor.
    const bar = angle + Math.PI / 2;
    drawDumbbell(ctx, hand, bar, (10 * strain * Math.sin(t * 20 + 1) * 0.5 + 8 * strain) * Math.cos(bar));
  }
  // Sleeve fabric, shreds and powder.
  ctx.lineCap = 'round';
  for (const s of c.sleeveShreds) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle); ctx.globalAlpha = clamp((s.life - s.age) / 0.4, 0, 1); ctx.strokeStyle = INK; ctx.lineWidth = s.width + 3; ctx.beginPath(); ctx.moveTo(-s.length / 2, 0); ctx.lineTo(s.length / 2, 0); ctx.stroke(); ctx.strokeStyle = TEE; ctx.lineWidth = s.width; ctx.stroke(); ctx.restore(); }
  for (const s of c.shreds) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle); ctx.globalAlpha = clamp((s.life - s.age) / 0.5, 0, 1); ctx.strokeStyle = INK; ctx.lineWidth = s.width + 3; ctx.beginPath(); ctx.moveTo(-s.length / 2, 0); ctx.quadraticCurveTo(0, 6, s.length / 2, 0); ctx.stroke(); ctx.strokeStyle = s.tone > 0.5 ? GRAY : '#d98a8a'; ctx.lineWidth = s.width; ctx.stroke(); ctx.restore(); }
  ctx.globalAlpha = 1;
  for (const p of c.puffs) { ctx.globalAlpha = 0.7 * (1 - p.age / p.life); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (c.burst && c.burstAge < 0.4) { const k = c.burstAge / 0.4; ctx.strokeStyle = `rgba(255, 240, 240, ${0.6 * (1 - k)})`; ctx.lineWidth = 1 + 8 * (1 - k); ctx.beginPath(); ctx.arc(c.burstAt.x, c.burstAt.y, 30 + 420 * (1 - (1 - k) * (1 - k)), 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  return { head: { x: head.x + tremble, y: head.y }, hand };
}
