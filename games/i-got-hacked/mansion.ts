/**
 * The mansion: a sunset sky over the bay, the yacht that grows with the
 * multiplier, the house with its balcony, the fictional star in a bathrobe
 * typing the launch post on a gold phone, the manager who whispers, the
 * assistant packing bags behind the curtains, the PR crisis team at the
 * gate, the phone close-up whose draft cycles through excuses faster and
 * faster ("my nephew did it", "i was phished") until it reads "i got
 * hacked", the paparazzi drone over the bay that flashes more often the
 * higher it goes and swoops in for the money shot (one fake tear) at the
 * crash, and the assistant barbecuing hard drives on the lawn by the palm. The
 * star is a generic cartoon with no likeness of anyone. Nothing here changes
 * the outcome.
 */
import { solveLimb, stepFoot } from './kinematics';
import { type Spring, clamp, gust, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const STAGE = { w: 960, h: 540 } as const;
export const HORIZON = 210;
export type Point = { x: number; y: number };
const MEME_FONT = 'Impact, "Arial Black", sans-serif';
/** The phone chart takes a sample this often at first, and keeps at most this many before it thins them. */
const CHART_STEP = 0.15;
const CHART_POINTS = 60;

interface Gull { x: number; y: number; phase: number; speed: number }
interface Wake { x: number; y: number; age: number; life: number; size: number }
/** The paparazzi drone: parked off the right edge, hovering over the bay, or diving on the balcony for the money shot. */
interface Drone { x: Spring; y: Spring; tilt: Spring; flash: number; nextFlash: number; shots: number; mode: 'away' | 'hover' | 'dive' }
/** The draft post's excuses, in the order the phone happens to land on them. */
export const EXCUSES = ['my nephew did it', 'i was phished', 'it was the intern', 'dog ate my seed phrase', 'sim swapped at the spa', 'the yacht wifi did it', 'an AI wrote that post', 'i was asleep 6 months', 'my thumbs got hacked', 'password was password', 'the manager typed it', 'i got hacked'];
/** Reading time includes typing and an unbroken full-sentence hold: 3.2 s calm, never under 1.8 s at full tension. */
export const excuseDuration = (text: string, tension = 1): number => text.length * .028 + 1.8 + 1.4 * (1 - clamp(tension, 0, 1));
/** Where the drone hovers, and where it dives to at the crash: left of the star's head, at the cheek the tear rolls down. */
const HOVER = { x: 640, y: 150 } as const;
const DIVE = { x: 140, y: 72 } as const;
/** The barbecue on the lawn: the grill, and where the assistant stands with the stack. */
const GRILL = { x: 846, y: 440 } as const;
const COOK = { x: 934, y: 446 } as const;

export interface Mansion {
  time: number;
  typing: Spring;
  wave: Spring;
  shrug: Spring;
  glance: Spring;
  whisper: Spring;
  whisperAt: number;
  whisperOn: boolean;
  yachtSize: Spring;
  yachtX: Spring;
  engine: Spring;
  packing: Spring;
  prTeam: Spring;
  draft: Spring;
  chart: number[];
  /** When the chart takes its next sample, on `time`, and the spacing it samples at now. */
  chartAt: number;
  chartStep: number;
  posted: boolean;
  endAge: number;
  ended: boolean;
  blinkAt: number;
  eyeOpen: Spring;
  gulls: Gull[];
  wakes: Wake[];
  smoke: number;
  /** The draft's current excuse, when the next one lands, how long this one has been typing, and the pop of a change. */
  excuse: number;
  excuseAt: number;
  excuseAge: number;
  excusePop: Spring;
  drone: Drone;
  /** The barbecue on the lawn: the flare when a drive lands, the drive in flight (0..1, -1 none) and the next toss. */
  grill: { flare: Spring; drive: number; nextDrive: number };
  /** The drone got its shot of the tear. */
  moneyShot: boolean;
  /** The POST button's throb, an integrated phase so its rate can follow the tension without jumping. */
  throb: number;
  /** The phone buzzing in his hand (1 on a notification, decaying). */
  buzz: number;
  /** The thumb hovering over POST and pulling back: seconds into the hover (-1 none), and how many have gone. */
  hover: number;
  hoverIndex: number;
  /** The multiplier the scene last drove with, for the long-round escalation. */
  multiplier: number;
  /** What happened this step, for the scene's sound: an excuse changed, the drone flashed, a drive hit the grill, a hover. */
  events: { excuse: boolean; flash: boolean; drive: boolean; hover: boolean };
}

export function createMansion(): Mansion {
  const gulls: Gull[] = [];
  for (let i = 0; i < 4; i += 1) gulls.push({ x: 520 + i * 110, y: 60 + noise(i * 3.7) * 70, phase: noise(i) * 6, speed: 14 + noise(i * 2.2) * 10 });
  return {
    time: 0, typing: spring(0), wave: spring(0), shrug: spring(0), glance: spring(0), whisper: spring(0), whisperAt: 1.5, whisperOn: false, yachtSize: spring(0.4), yachtX: spring(800), engine: spring(0), packing: spring(0), prTeam: spring(0), draft: spring(0), chart: [], chartAt: 0, chartStep: CHART_STEP, posted: false, endAge: 0, ended: false, blinkAt: 2, eyeOpen: spring(1), gulls, wakes: [], smoke: 0,
    excuse: 0, excuseAt: 0, excuseAge: 0, excusePop: spring(0),
    drone: { x: spring(STAGE.w + 80), y: spring(HOVER.y), tilt: spring(0), flash: 0, nextFlash: 0, shots: 0, mode: 'away' },
    grill: { flare: spring(0), drive: -1, nextDrive: 0 },
    moneyShot: false,
    throb: 0, buzz: 0, hover: -1, hoverIndex: 0, multiplier: 1,
    events: { excuse: false, flash: false, drive: false, hover: false },
  };
}

export function resetMansion(m: Mansion): void {
  settleSpring(m.typing, 0);
  settleSpring(m.wave, 0);
  settleSpring(m.shrug, 0);
  settleSpring(m.glance, 0);
  settleSpring(m.whisper, 0);
  m.whisperOn = false;
  m.whisperAt = m.time + 1.5;
  settleSpring(m.yachtSize, 0.4);
  settleSpring(m.yachtX, 800);
  settleSpring(m.engine, 0);
  settleSpring(m.packing, 0);
  settleSpring(m.prTeam, 0);
  settleSpring(m.draft, 0);
  m.chart = [];
  m.chartAt = m.time;
  m.chartStep = CHART_STEP;
  m.posted = false;
  m.endAge = 0;
  m.ended = false;
  m.wakes = [];
  m.smoke = 0;
  m.excuse = EXCUSES.length - 1;
  m.excuseAt = 0;
  m.excuseAge = 0;
  settleSpring(m.excusePop, 0);
  // The drone flies off on its own springs rather than jumping.
  m.drone.mode = 'away';
  m.drone.flash = 0;
  m.drone.nextFlash = m.time + 1;
  m.drone.shots = 0;
  m.grill = { flare: spring(0), drive: -1, nextDrive: m.time + 0.6 };
  m.moneyShot = false;
  m.buzz = 0;
  m.hover = -1;
  m.hoverIndex = 0;
  m.multiplier = 1;
}

/** Jumps the slow springs and the phone chart to where a multiplier already is, for a round joined late. */
export function settleMansion(m: Mansion, tension: number, multiplier: number, elapsedMs: number): void {
  m.multiplier = multiplier;
  settleSpring(m.yachtSize, yachtFor(multiplier));
  settleSpring(m.engine, tension > ENGINE_AT ? 1 : 0);
  settleSpring(m.packing, tension > PACK_AT ? 1 : 0);
  settleSpring(m.prTeam, tension > PR_AT ? 1 : 0);
  settleSpring(m.draft, tension > DRAFT_AT ? 1 : 0);
  while (multiplier >= hoverAt(m.hoverIndex)) m.hoverIndex += 1;
  if (tension > DRONE_AT) {
    m.drone.mode = 'hover';
    settleSpring(m.drone.x, HOVER.x);
    settleSpring(m.drone.y, HOVER.y);
    m.drone.nextFlash = m.time + 1;
  }
  m.excuse = Math.floor(noise(multiplier * 13.7) * EXCUSES.length);
  m.excuseAge = 10;
  // Fill the decorative chart between its known endpoints. Sample spacing uses the room's elapsed time,
  // so a late join works with both legacy and accelerating rounds without assuming a growth constant.
  const seconds = Math.max(0, elapsedMs / 1000);
  m.chart = [];
  m.chartStep = CHART_STEP;
  m.chartAt = m.time;
  if (!(seconds > 0)) return;
  while (Math.floor(seconds / m.chartStep) >= CHART_POINTS) m.chartStep *= 2;
  const samples = Math.floor(seconds / m.chartStep);
  for (let i = 0; i <= samples; i += 1) m.chart.push(Math.pow(multiplier, (i * m.chartStep) / seconds));
  m.chartAt = m.time + (samples + 1) * m.chartStep - seconds;
}

/** A milestone: a wave to the fans, a burst of typing. */
export function celebrate(m: Mansion, index: number): void {
  if (index % 2) m.wave.v += 12; else m.typing.v += 14;
  m.glance.v += 3;
  // Every milestone is a photo op.
  if (m.drone.mode === 'hover' && Math.abs(m.drone.x.x - HOVER.x) < 120) { m.drone.flash = 1; m.drone.nextFlash = m.time + 1.5; m.events.flash = true; }
}

/** The post goes out. `quiet` skips the effects for a crash that already happened. */
export function endMansion(m: Mansion, seed: number, quiet: boolean): void {
  if (m.ended) return;
  m.ended = true;
  m.posted = true;
  m.endAge = quiet ? 10 : 0;
  m.wakes = [];
  const rng = mulberry32(seed);
  m.smoke = 0.5 + rng() * 0.5;
  m.drone.mode = 'dive';
  if (quiet) {
    settleSpring(m.yachtX, 1100); settleSpring(m.shrug, 0); settleSpring(m.draft, 1); settleSpring(m.engine, 1); settleSpring(m.packing, 1); settleSpring(m.prTeam, 1);
    settleSpring(m.drone.x, DIVE.x); settleSpring(m.drone.y, DIVE.y);
    m.moneyShot = true;
    return;
  }
  m.shrug.v += 8;
  settleSpring(m.engine, 1);
}

/**
 * The beats, on `tensionAt` (1 - 1/x): the draft starts cycling excuses at 1.33×, the drone shows up at 1.56×, the
 * packing and the barbecue start at 2×, the sweat at 2.5×, the yacht's engine at 2.94× and the PR team at 4×.
 */
const DRAFT_AT = 0.25;
const DRONE_AT = 0.36;
const PACK_AT = 0.5;
const SWEAT_AT = 0.6;
const ENGINE_AT = 0.66;
const PR_AT = 0.75;
/** The thumb hovers over POST at 1.75× and every ×1.4 after (about every 4.4 s), keyed to the multiplier alone. */
const hoverAt = (index: number): number => 1.75 * Math.pow(1.4, index);
/** The yacht grows to full size by 16× and keeps growing slowly to 1600×. */
const yachtFor = (multiplier: number): number => 0.4 + 0.6 * Math.min(1, Math.log2(Math.max(1, multiplier)) / 4) + 0.2 * clamp(Math.log10(Math.max(1, multiplier) / 16) / 2, 0, 1);
/** Seconds after the post that the tear rolls and the drone takes its shot. */
const TEAR_AT = 0.9;
/**
 * A foot on a walk `span` long, taken in whole strides of about `stride` and phased so the walk starts and ends with both
 * feet under the hips (one planted, the other coming down), the swing lifting only once under way: neither end of the
 * walk slides a foot, however quickly the walker starts or stops.
 */
function plantedStep(walked: number, span: number, stride: number, lead: boolean): Point {
  const f = stepFoot(walked, span / Math.max(1, Math.round(span / stride)), lead ? .79 : .29, 14);
  return { x: f.x, y: f.y * smoothstep(0, 10, walked) * smoothstep(0, 10, span - walked) };
}

export interface MansionDrive { running: boolean; tension: number; multiplier: number; }

export function stepMansion(m: Mansion, drive: MansionDrive, dt: number): void {
  const before = m.time;
  m.time += dt;
  m.multiplier = drive.multiplier;
  m.throb += dt * (5 + 10 * drive.tension);
  m.buzz = Math.max(0, m.buzz - dt / 0.3);
  stepSpring(m.typing, drive.running && !m.ended ? 0.4 + 0.6 * drive.tension : 0, 9, 0.5, dt);
  stepSpring(m.wave, 0, 6, 0.5, dt);
  stepSpring(m.shrug, m.ended && m.endAge < 3 ? 1 : 0, 7, 0.6, dt);
  // The manager whispers in bursts that come faster with the tension.
  if (drive.running && !m.ended && m.time > m.whisperAt) {
    m.whisperOn = !m.whisperOn;
    m.whisperAt = m.time + (m.whisperOn ? 0.6 + 0.8 * (1 - drive.tension) : (2.5 - 2.2 * drive.tension) * (0.7 + noise(m.time) * 0.6));
  }
  // Between rounds the first whisper stays 1.5 s off, so it lands 1.5 s into the next one.
  if (!drive.running || m.ended) { m.whisperOn = false; if (!m.ended) m.whisperAt = m.time + 1.5; }
  stepSpring(m.whisper, m.whisperOn ? 1 : 0, 10, 0.7, dt);
  stepSpring(m.glance, m.ended ? 0 : m.whisperOn ? 1 : 0, 8, 0.8, dt);
  stepSpring(m.yachtSize, m.ended ? m.yachtSize.x : yachtFor(drive.multiplier), 2.5, 1, dt);
  stepSpring(m.engine, m.ended ? 1 : drive.running && drive.tension > ENGINE_AT ? 1 : 0, 3, 0.9, dt);
  stepSpring(m.packing, m.ended ? 1 : drive.running && drive.tension > PACK_AT ? 1 : 0, 3, 0.9, dt);
  stepSpring(m.prTeam, m.ended ? 1 : drive.running && drive.tension > PR_AT ? 1 : 0, 2.5, 0.9, dt);
  stepSpring(m.draft, m.ended ? 1 : drive.running && drive.tension > DRAFT_AT ? 1 : 0, 4, 0.8, dt);
  // The draft cycles excuses, faster the higher it goes; each one types itself in.
  m.events = { excuse: false, flash: false, drive: false, hover: false };
  m.excuseAge += dt;
  if (drive.running && !m.ended && m.draft.x > 0.05 && m.time >= m.excuseAt) {
    m.excuse = (m.excuse + 1 + Math.floor(noise(m.time * 3.1) * (EXCUSES.length - 1))) % EXCUSES.length;
    m.excuseAt = m.time + excuseDuration(EXCUSES[m.excuse]!, drive.tension);
    m.excuseAge = 0;
    m.excusePop.v = 8;
    m.events.excuse = true;
  }
  stepSpring(m.excusePop, 0, 14, 0.4, dt);
  // The near miss: at set multipliers the thumb comes down on POST, holds, and pulls back. It is a tease on the
  // multiplier alone; only the round ending posts.
  if (m.hover >= 0) { m.hover += dt; if (m.hover > 1.3 || m.ended) m.hover = -1; }
  if (drive.running && !m.ended && m.draft.x > 0.5 && drive.multiplier >= hoverAt(m.hoverIndex)) {
    while (drive.multiplier >= hoverAt(m.hoverIndex)) m.hoverIndex += 1;
    m.hover = 0;
    m.glance.v += 4;
    m.events.hover = true;
  }
  // The paparazzi drone: in from the right once there is a story, hovering with the gusts, flashing faster with
  // the tension; at the post it dives on the balcony and waits for the tear.
  const d = m.drone;
  if (!m.ended) d.mode = drive.running && drive.tension > DRONE_AT ? 'hover' : d.mode === 'hover' && drive.running ? 'hover' : 'away';
  const tx = d.mode === 'dive' ? DIVE.x : d.mode === 'hover' ? HOVER.x + gust(m.time, 5) * 44 : STAGE.w + 80;
  const ty = d.mode === 'dive' ? DIVE.y : d.mode === 'hover' ? HOVER.y + gust(m.time * 1.3, 9) * 14 : HOVER.y - 20;
  stepSpring(d.x, tx, d.mode === 'dive' ? 3.2 : 2, 0.65, dt);
  stepSpring(d.y, ty, 2.6, 0.6, dt);
  stepSpring(d.tilt, clamp(d.x.v / 500, -0.35, 0.35), 8, 0.6, dt);
  d.flash = Math.max(0, d.flash - dt / 0.25);
  if (d.mode === 'hover' && drive.running && !m.ended && m.time >= d.nextFlash && Math.abs(d.x.x - HOVER.x) < 120) {
    d.flash = 1;
    d.shots += 1;
    d.nextFlash = m.time + mix(4.5, 1.2, drive.tension) * (0.7 + noise(m.time * 5.3) * 0.6);
    m.events.flash = true;
  }
  if (m.ended && !m.moneyShot && m.endAge > TEAR_AT + 0.25) {
    m.moneyShot = true;
    d.flash = 1;
    m.events.flash = true;
  }
  // The barbecue: once the packing starts, a hard drive goes on the grill every couple of seconds, faster with the tension.
  const g = m.grill;
  if (m.packing.x > 0.3 && g.drive < 0 && m.time >= g.nextDrive) g.drive = 0;
  if (g.drive >= 0) {
    g.drive += dt / 0.55;
    if (g.drive >= 1) {
      g.drive = -1;
      g.flare.v += 10;
      g.nextDrive = m.time + mix(2.4, 0.9, drive.tension);
      m.events.drive = true;
    }
  }
  stepSpring(g.flare, 0, 7, 0.5, dt);
  const blinking = m.time > m.blinkAt && m.time < m.blinkAt + 0.12;
  if (m.time >= m.blinkAt + 0.12) m.blinkAt = m.time + 2 + 3 * noise(m.blinkAt);
  stepSpring(m.eyeOpen, blinking ? 0.08 : 1, 24, 0.9, dt);
  // The chart on the phone: one sample per step of round time. When it fills, every other sample goes (the
  // first and the newest stay) and the step doubles, so the whole climb from 1.00× stays on the screen.
  if (drive.running && !m.ended && m.time >= m.chartAt) {
    m.chart.push(Math.max(1, drive.multiplier));
    if (m.chart.length > CHART_POINTS) {
      m.chart = m.chart.filter((_, i) => i % 2 === 0);
      m.chartStep *= 2;
    }
    m.chartAt = m.time + m.chartStep;
  }
  if (m.ended) {
    m.endAge += dt;
    stepSpring(m.yachtX, 1150, 1.2, 0.95, dt);
  }
  // The wake: a seeded puff on each tick of the clock this step crossed, so it is as thick at 30 fps as at 144.
  const fleeing = m.ended && m.endAge < 4;
  if ((fleeing || (!m.ended && m.engine.x > 0.5))) {
    const rate = fleeing ? 30 : 24;
    for (let n = Math.floor(before * rate) + 1; n <= Math.floor(m.time * rate); n++) {
      if (noise(n) > (fleeing ? 0.4 : 0.6)) m.wakes.push(fleeing ? { x: m.yachtX.x - 70 * m.yachtSize.x, y: HORIZON + 26, age: 0, life: 1.6, size: 4 + noise(n * 3) * 5 } : { x: m.yachtX.x - 60 * m.yachtSize.x, y: HORIZON + 24, age: 0, life: 1.2, size: 3 + noise(n * 5) * 3 });
    }
  }
  for (const w of m.wakes) { w.age += dt; w.x -= 20 * dt; }
  m.wakes = m.wakes.filter((w) => w.age < w.life);
  for (const g of m.gulls) { g.x -= g.speed * dt; if (g.x < 470) g.x = 980; }
}

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return {
    x: root.x + (dx / distance) * along - (dy / distance) * bend,
    y: root.y + (dy / distance) * along + (dx / distance) * bend,
  };
}

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): Point {
  const joint = bendJoint(a, b, upper, lower, side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(joint.x, joint.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(joint.x, joint.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  return joint;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left', maxWidth?: number): void {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The yacht on the bay, sized by the multiplier, with a manager aboard once it leaves. */
function drawYacht(ctx: CanvasRenderingContext2D, m: Mansion, tension: number): void {
  const k = clamp(m.yachtSize.x, 0.3, 1.2);
  const bob = Math.sin(m.time * 1.3) * 3 + Math.sin(m.time * 9) * 1.5 * clamp(m.engine.x, 0, 1);
  ctx.save();
  ctx.translate(m.yachtX.x, HORIZON + 18 + bob);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  // Hull.
  ctx.fillStyle = '#f4f4f8'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-110, -10); ctx.lineTo(120, -10); ctx.quadraticCurveTo(150, -8, 120, 18); ctx.lineTo(-90, 18); ctx.quadraticCurveTo(-130, 10, -110, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2d5f9e';
  ctx.beginPath(); ctx.moveTo(-100, 6); ctx.lineTo(128, 6); ctx.lineTo(120, 18); ctx.lineTo(-90, 18); ctx.closePath(); ctx.fill();
  // Decks.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(-70, -40, 150, 32, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-40, -64, 90, 26, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7fd3ff';
  for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.roundRect(-60 + i * 28, -32, 18, 12, 3); ctx.fill(); ctx.stroke(); }
  for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.roundRect(-30 + i * 28, -56, 18, 10, 3); ctx.fill(); ctx.stroke(); }
  // Radar mast and the flag.
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(10, -64); ctx.lineTo(10, -96); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  const flap = gust(m.time * 3) * 6;
  ctx.beginPath(); ctx.moveTo(10, -96); ctx.lineTo(40, -90 + flap); ctx.lineTo(10, -82); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = `900 9px ${MEME_FONT}`; ctx.textAlign = 'center'; ctx.fillText('$', 22, -87 + flap * 0.4);
  // Name on the hull.
  ctx.fillStyle = INK; ctx.font = `900 11px ${MEME_FONT}`; ctx.textAlign = 'left';
  ctx.fillText('NOT HACKED', -80, 2);
  // Engine smoke.
  const engine = clamp(m.engine.x, 0, 1);
  if (engine > 0.05) {
    for (let i = 0; i < 4; i += 1) {
      const t = (m.time * 0.8 + i * 0.25) % 1;
      ctx.fillStyle = `rgba(90, 90, 100, ${0.35 * engine * (1 - t)})`;
      ctx.beginPath(); ctx.arc(-120 - t * 50, -6 - t * 30, 6 + t * 14, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The manager aboard once the yacht leaves.
  if (m.ended && m.endAge > 0.3) {
    ctx.save();
    ctx.translate(-10, -40);
    ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-12, -30, 24, 32, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0bda7';
    ctx.beginPath(); ctx.arc(0, -40, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-8, -44, 6, 4); ctx.fillRect(2, -44, 6, 4);
    limb(ctx, { x: -8, y: -24 }, { x: -24, y: -6 }, 16, 14, -1, 7, '#2b2b30');
    limb(ctx, { x: 10, y: -24 }, { x: 32, y: -52 + Math.sin(m.time * 6) * 6 }, 20, 18, 1, 7, '#2b2b30');
    ctx.restore();
  }
  ctx.restore();
  void tension;
}

/** Reachable, continuous wrist target across rest, wave and the apology. */
export function starFreeHand(wave: number, shrug: number, time: number): Point {
  wave = clamp(wave, 0, 1); shrug = clamp(shrug, 0, 1);
  const target = { x: mix(mix(64, 74, wave), 62, shrug), y: mix(mix(-78, -176 - Math.sin(time * 11) * 8 * wave, wave), -138, shrug) };
  return solveLimb({ x: 50, y: -126 }, target, 36, 32, -1).end;
}

/** The manager beside the star, leaning in to whisper. */
function drawManager(ctx: CanvasRenderingContext2D, m: Mansion, x: number, footY: number, tension: number): void {
  const lean = clamp(m.whisper.x, 0, 1);
  ctx.save();
  ctx.translate(x, footY);
  // The waist turns over planted legs; the feet remain on the pool deck.
  ctx.lineJoin = 'round';
  const suit = '#2b2b30';
  for (const side of [-1, 1]) {
    const plant = 0;
    limb(ctx, { x: side * 9, y: -74 }, { x: side * 12 + plant, y: 0 }, 42, 38, -side, 13, suit);
    ctx.fillStyle = '#111114'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(side * 12 + plant, 3, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.translate(0, -74); ctx.rotate(-.25 * lean); ctx.translate(0, 74);
  ctx.fillStyle = suit; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-28, -130, 56, 64, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-8, -130); ctx.lineTo(8, -130); ctx.lineTo(0, -96); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(-3, -128); ctx.lineTo(3, -128); ctx.lineTo(1, -100); ctx.lineTo(-1, -100); ctx.closePath(); ctx.fill();
  const whisperHand = { x: mix(36, -8, lean), y: mix(-68, -152, lean) };
  limb(ctx, { x: 26, y: -120 }, whisperHand, 36, 34, -1, 12, suit);
  const phoneHand = { x: -42 + Math.sin(m.time * 1.6) * 3, y: -66 };
  limb(ctx, { x: -26, y: -120 }, phoneHand, 34, 32, 1, 12, suit);
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(whisperHand.x, whisperHand.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // A phone in the free hand, bobbing with the arm.
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(phoneHand.x - 6, phoneHand.y - 16, 14, 22, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7cf67c'; ctx.fillRect(phoneHand.x - 3, phoneHand.y - 12, 8, 12);
  const hy = -156;
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 24, 27, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a1e';
  ctx.beginPath(); ctx.moveTo(-26, hy - 6); ctx.quadraticCurveTo(-24, hy - 36, 0, hy - 34); ctx.quadraticCurveTo(26, hy - 36, 26, hy - 6); ctx.quadraticCurveTo(10, hy - 20, -8, hy - 12); ctx.quadraticCurveTo(-20, hy - 8, -26, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Earpiece and a shifty look.
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(24, hy + 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(24, hy + 6); ctx.quadraticCurveTo(30, hy + 20, 20, hy + 26); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (const ex of [-9, 9]) { ctx.beginPath(); ctx.ellipse(ex, hy - 2, 6, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + 3 * lean - 2 * tension, hy - 2, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-16, hy - 12); ctx.lineTo(-4, hy - 10); ctx.moveTo(4, hy - 10); ctx.lineTo(16, hy - 12); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-2, hy + 14, 5 + 3 * lean, 2 + 3 * lean, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.stroke();
  ctx.restore();
  // Whisper bubble.
  if (lean > 0.5) {
    const lines = [
      'sell before they do', 'the yacht is fuelled', 'say you got hacked', 'PR is on the way', 'one more post then we go',
      'delete the old posts', 'the lawyer says run', 'blame the intern', 'act surprised', 'the fans are the liquidity',
    ];
    const text = lines[Math.floor(noise(Math.floor(m.whisperAt * 7)) * lines.length)]!;
    ctx.save();
    ctx.globalAlpha = smoothstep(0.5, 0.9, lean);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(x + 20, footY - 156, 214, 28, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 34, footY - 128); ctx.lineTo(x + 16, footY - 116); ctx.lineTo(x + 48, footY - 128); ctx.closePath(); ctx.fill(); ctx.stroke();
    label(ctx, `psst: ${text}`, x + 127, footY - 137, 11, INK, 'center', 200);
    ctx.restore();
  }
}

/** The star on the balcony: bathrobe, shades, gold phone; typing, waving, shrugging. */
function drawStar(ctx: CanvasRenderingContext2D, m: Mansion, x: number, footY: number, tension: number): void {
  const typing = clamp(m.typing.x, 0, 1.4);
  const wave = clamp(m.wave.x, 0, 1);
  const shrug = clamp(m.shrug.x, 0, 1);
  const glance = clamp(m.glance.x, 0, 1);
  const sway = Math.sin(m.time * 1.1) * 3;
  ctx.save();
  ctx.translate(x + sway, footY);
  ctx.lineJoin = 'round';
  const robe = '#ffffff';
  // The hem lags the sway. Slippers stay behind the balcony rail.
  const hem = Math.sin(m.time * 1.8) * 7 + sway * 0.6;
  ctx.fillStyle = robe; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-58, hem * 0.25);
  ctx.quadraticCurveTo(-68, -40, -62, -118);
  ctx.quadraticCurveTo(-58, -144, -30, -140);
  ctx.lineTo(30, -140);
  ctx.quadraticCurveTo(58, -144, 62, -118);
  ctx.quadraticCurveTo(68, -40, 58, -hem * 0.25);
  ctx.quadraticCurveTo(0, 18 + hem, -58, hem * 0.25);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Robe lapels and a gold chain that swings with the multiplier.
  ctx.fillStyle = '#efe6ff';
  ctx.beginPath(); ctx.moveTo(-30, -140); ctx.lineTo(0, -70); ctx.lineTo(30, -140); ctx.lineTo(18, -140); ctx.lineTo(0, -96); ctx.lineTo(-18, -140); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e0bda7';
  ctx.beginPath(); ctx.moveTo(-18, -140); ctx.lineTo(0, -96); ctx.lineTo(18, -140); ctx.closePath(); ctx.fill();
  const chain = Math.sin(m.time * 2.4) * (4 + 10 * tension) + sway * 0.2;
  ctx.strokeStyle = '#ffd35c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, -132); ctx.quadraticCurveTo(chain, -100, 14, -132); ctx.stroke();
  ctx.fillStyle = '#ffd35c'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(chain * 0.7, -112, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = `900 8px ${MEME_FONT}`; ctx.textAlign = 'center'; ctx.fillText('$', 0, -111);
  // Belt.
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-54, -60); ctx.lineTo(54, -60); ctx.stroke();
  // Arms: the phone hand, and a free hand that waves or shrugs.
  const phoneHand = { x: -34 + 6 * typing, y: -96 - shrug * 30 };
  limb(ctx, { x: -50, y: -126 }, phoneHand, 34, 30, 1, 15, robe);
  const freeHand = starFreeHand(wave, shrug, m.time);
  limb(ctx, { x: 50, y: -126 }, freeHand, 36, 32, -1, 15, robe);
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(freeHand.x, freeHand.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(phoneHand.x, phoneHand.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // The eye drops that make the tear, produced with the shrug.
  if (m.ended && shrug > 0.5) {
    ctx.save();
    ctx.translate(freeHand.x + 4, freeHand.y - 4);
    ctx.rotate(0.5);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-6, -16, 12, 24, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.roundRect(-3, -22, 6, 7, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '700 6px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TEARS', 0, -1);
    ctx.restore();
  }
  // The gold phone.
  ctx.save();
  ctx.translate(phoneHand.x + 8, phoneHand.y - 16);
  ctx.rotate(-0.35 + 0.05 * Math.sin(m.time * 20) * typing + 0.1 * m.buzz * Math.sin(m.time * 80));
  ctx.fillStyle = '#ffd35c'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-11, -20, 22, 40, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = m.posted ? '#ff4d6d' : '#7cf67c';
  ctx.beginPath(); ctx.roundRect(-8, -16, 16, 30, 2); ctx.fill();
  ctx.restore();
  // Head with shades and a wobbly grin.
  const hy = -178;
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 38, 42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Hair: a bleached quiff.
  ctx.fillStyle = '#fff1b8';
  ctx.beginPath(); ctx.moveTo(-40, hy - 14); ctx.quadraticCurveTo(-42, hy - 60, 0, hy - 58); ctx.quadraticCurveTo(30, hy - 70, 50, hy - 40); ctx.quadraticCurveTo(46, hy - 24, 38, hy - 20); ctx.quadraticCurveTo(10, hy - 34, -38, hy - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Shades.
  const shadesDrop = shrug * 6;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.roundRect(-34, hy - 12 + shadesDrop, 30, 16, 6); ctx.fill();
  ctx.beginPath(); ctx.roundRect(4, hy - 12 + shadesDrop, 30, 16, 6); ctx.fill();
  ctx.fillRect(-6, hy - 8 + shadesDrop, 12, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-28, hy - 8 + shadesDrop); ctx.lineTo(-16, hy - 8 + shadesDrop); ctx.moveTo(10, hy - 8 + shadesDrop); ctx.lineTo(22, hy - 8 + shadesDrop); ctx.stroke();
  // Eyes peeking over the shades when he shrugs.
  if (shrug > 0.4) { ctx.fillStyle = '#ffffff'; for (const ex of [-19, 19]) { ctx.beginPath(); ctx.ellipse(ex, hy - 14, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + 2, hy - 14, 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; } }
  else if (glance > 0.3) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-14 + 6 * glance, hy - 4, 2, 0, Math.PI * 2); ctx.arc(24 + 6 * glance, hy - 4, 2, 0, Math.PI * 2); ctx.fill(); }
  // Mouth: a grin that tightens with tension, an "eh" at the shrug.
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  if (shrug > 0.4) { ctx.moveTo(-12, hy + 20); ctx.lineTo(12, hy + 20 - 4 * shrug); }
  else { ctx.moveTo(-16, hy + 14); ctx.quadraticCurveTo(0, hy + 30 - 10 * tension, 16, hy + 14); }
  ctx.stroke();
  // A bead of sweat from 2.5×, a second from 100× and a third from 1000×.
  if (tension > SWEAT_AT && shrug < 0.4) {
    ctx.fillStyle = '#8fd3ff';
    for (let i = 0; i < 1 + Math.floor(clamp(Math.log10(m.multiplier) - 1, 0, 2)); i += 1) { ctx.beginPath(); ctx.ellipse([40, -42, 32][i]!, hy - 20 + ((m.time * 30 + i * 9) % 24), 3, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  // The one fake tear, rolling out from under the shades for the camera and drying on the cheek.
  if (m.ended && m.endAge > TEAR_AT && m.endAge < 6) {
    const t = m.endAge - TEAR_AT;
    const slide = Math.min(30, t * 20);
    ctx.save();
    ctx.globalAlpha = clamp(1 - (t - 3) / 2, 0, 1);
    ctx.strokeStyle = 'rgba(143, 211, 255, 0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-24, hy + 6 + shadesDrop); ctx.lineTo(-25, hy + 6 + shadesDrop + slide); ctx.stroke();
    ctx.fillStyle = '#8fd3ff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(-25, hy + 8 + shadesDrop + slide, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * The barbecue on the lawn, drawn over the party: a drum grill with two drives cooking, the second assistant feeding
 * it from a stack marked EVIDENCE, smoke up past the palm. It fades in with the packing, in plain sight of the fans.
 */
export function drawBarbecue(ctx: CanvasRenderingContext2D, m: Mansion): void {
  const packing = clamp(m.packing.x, 0, 1);
  if (packing < 0.02) return;
  const gx = GRILL.x;
  const gy = GRILL.y;
  const flare = clamp(m.grill.flare.x, -0.3, 1.5);
  ctx.save();
  ctx.globalAlpha = packing;
  ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i += 1) {
    const t = (m.time * 0.4 + i / 3) % 1;
    ctx.fillStyle = `rgba(110, 110, 122, ${0.4 * (1 - t) * packing})`;
    ctx.beginPath(); ctx.arc(gx + Math.sin(t * 7 + i * 2) * 7, gy - 44 - t * 76, 6 + t * 13, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gx - 16, gy - 12); ctx.lineTo(gx - 22, gy + 6); ctx.moveTo(gx + 16, gy - 12); ctx.lineTo(gx + 22, gy + 6); ctx.stroke();
  ctx.fillStyle = '#26262c';
  ctx.beginPath(); ctx.moveTo(gx - 27, gy - 30); ctx.lineTo(gx + 27, gy - 30); ctx.quadraticCurveTo(gx + 24, gy - 2, gx, gy - 2); ctx.quadraticCurveTo(gx - 24, gy - 2, gx - 27, gy - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Flames, taller with the packing and the flare of a fresh drive.
  const heat = 0.5 + 0.5 * packing + flare;
  for (let i = 0; i < 4; i += 1) {
    const fx = gx - 15 + i * 10;
    // The flames lick at 14 Hz.
    const h = (9 + 15 * heat) * (0.55 + 0.45 * noise(Math.floor(m.time * (14)) + i * 3));
    const lean = (noise(i * 5 + Math.floor(m.time * (9))) - 0.5) * 8;
    ctx.fillStyle = i % 2 ? '#ff9f1c' : '#ffd23f'; ctx.strokeStyle = '#c1121f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fx - 5, gy - 30); ctx.quadraticCurveTo(fx - 7, gy - 30 - h * 0.5, fx + lean, gy - 30 - h); ctx.quadraticCurveTo(fx + 7, gy - 30 - h * 0.5, fx + 5, gy - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = '#6a6a74'; ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i += 1) { ctx.beginPath(); ctx.moveTo(gx + i * 7, gy - 31); ctx.lineTo(gx + i * 7, gy - 27); ctx.stroke(); }
  ctx.fillStyle = '#3a3a44'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(gx - 17, gy - 39, 14, 9, 1); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(gx + 2, gy - 38, 14, 9, 1); ctx.fill(); ctx.stroke();
  // The stack still to burn, labelled at its foot, which only grows in a long round: 3 drives, 4 from 10×, 8 past 2000×.
  const stack = 3 + Math.min(5, Math.floor(1.5 * Math.log10(Math.max(1, m.multiplier))));
  ctx.fillStyle = '#4a4a55';
  for (let i = 0; i < stack; i += 1) { ctx.beginPath(); ctx.roundRect(gx + 30, gy - 2 - i * 9, 22, 8, 1); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(gx + 19, gy + 8, 44, 13, 3); ctx.fill(); ctx.stroke();
  label(ctx, 'EVIDENCE', gx + 41, gy + 18, 7, INK, 'center');
  // The cook: in from the right with the packing, a drive held up for the toss, the other hand on the tongs.
  const cx = mix(COOK.x + 90, COOK.x, packing);
  const cy = COOK.y;
  const t = m.grill.drive;
  const wind = t >= 0 ? 0 : 0.5 + 0.5 * Math.sin(m.time * 4);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.72, 0.72);
  // He walks in (and out) on planted feet, by the ground covered.
  const pace = 1;
  for (const side of [-1, 1]) {
    const f = plantedStep((COOK.x + 90 - cx) / 0.72, 90 / 0.72, 60, side > 0);
    const foot = { x: side * 14 - f.x * pace, y: f.y * pace };
    limb(ctx, { x: side * 9, y: -74 }, foot, 42, 38, -side, 13, '#2b2b30');
    ctx.fillStyle = '#111114'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 3, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-26, -130, 52, 62, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-7, -130); ctx.lineTo(7, -130); ctx.lineTo(0, -100); ctx.closePath(); ctx.fill();
  const throwHand = { x: -52 - 10 * wind, y: -112 - 40 * wind };
  limb(ctx, { x: -24, y: -120 }, throwHand, 34, 32, throwHand.y >= -120 ? 1 : -1, 11, '#2b2b30');
  const tongHand = { x: -44, y: -76 };
  limb(ctx, { x: 24, y: -120 }, tongHand, 40, 36, 1, 11, '#2b2b30');
  ctx.fillStyle = '#c68e6a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(throwHand.x, throwHand.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(tongHand.x, tongHand.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#9a9aa8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(tongHand.x, tongHand.y); ctx.lineTo(tongHand.x - 34, tongHand.y - 22); ctx.moveTo(tongHand.x, tongHand.y + 3); ctx.lineTo(tongHand.x - 34, tongHand.y - 14); ctx.stroke();
  if (t < 0) {
    ctx.save(); ctx.translate(throwHand.x, throwHand.y - 8); ctx.rotate(-0.4);
    ctx.fillStyle = '#3a3a44'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-9, -5, 18, 10, 1); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#c68e6a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, -154, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(-16, -160, 12, 6); ctx.fillRect(2, -160, 12, 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-8, -140); ctx.lineTo(8, -140); ctx.stroke();
  ctx.restore();
  // A hard drive on its way from the cook's hand to the grill.
  if (t >= 0) {
    const x = mix(cx - 44, gx, t);
    const y = mix(cy - 108, gy - 42, t) - 44 * Math.sin(Math.PI * t);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 6);
    ctx.fillStyle = '#3a3a44'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-8, -5, 16, 10, 1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9a9aa8'; ctx.beginPath(); ctx.arc(2, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** The paparazzi drone, drawn over the house so it can dive on the balcony. */
export function drawDrone(ctx: CanvasRenderingContext2D, m: Mansion): void {
  const d = m.drone;
  if (d.x.x > STAGE.w + 60) return;
  const tilt = clamp(d.tilt.x, -0.4, 0.4);
  ctx.save();
  ctx.translate(d.x.x, d.y.x + (Math.sin(m.time * 7) * 1.5));
  ctx.rotate(tilt);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-26, -4); ctx.lineTo(26, -4); ctx.stroke();
  for (const rx of [-26, 26]) {
    const spin = 0.55 + 0.45 * noise(Math.floor(m.time * 30) + rx);
    ctx.fillStyle = 'rgba(210, 210, 225, 0.55)'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(rx, -6, 4 + 15 * spin, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-16, -8, 32, 14, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = Math.floor(m.time * 3) % 2 ? '#ff4d6d' : '#7a1c2c';
  ctx.beginPath(); ctx.arc(12, -1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.roundRect(-7, 6, 14, 10, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.arc(0, 11, 3.2, 0, Math.PI * 2); ctx.fill();
  if (d.flash > 0.02) {
    const glow = ctx.createRadialGradient(0, 11, 2, 0, 11, 44);
    glow.addColorStop(0, `rgba(255, 255, 255, ${d.flash})`); glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 11, 44, 0, Math.PI * 2); ctx.fill();
  }
  ctx.rotate(-tilt);
  const tag = m.moneyShot ? 'EXCLUSIVE: HE CRIED' : d.mode === 'dive' ? 'GET THE TEAR' : 'PAPARAZZI';
  ctx.font = '700 9px system-ui, sans-serif';
  const w = ctx.measureText(tag).width + 12;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-w / 2, 20, w, 16, 4); ctx.fill(); ctx.stroke();
  label(ctx, tag, 0, 31, 9, INK, 'center');
  ctx.restore();
}

/** The house wall, curtains and the assistant packing, the balcony, the gate and the PR team. */
export function drawMansion(ctx: CanvasRenderingContext2D, m: Mansion, tension: number): void {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
  sky.addColorStop(0, '#3b2452'); sky.addColorStop(0.55, '#c8577a'); sky.addColorStop(1, '#ffb36b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, STAGE.w, HORIZON + 40);
  // Sun.
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.arc(760, HORIZON - 30, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 226, 122, 0.25)';
  ctx.beginPath(); ctx.arc(760, HORIZON - 30, 70 + Math.sin(m.time) * 4, 0, Math.PI * 2); ctx.fill();
  // Gulls.
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const g of m.gulls) {
    const f = Math.sin(m.time * 6 + g.phase) * 4;
    ctx.beginPath(); ctx.moveTo(g.x - 8, g.y - f); ctx.quadraticCurveTo(g.x - 4, g.y + 2, g.x, g.y); ctx.quadraticCurveTo(g.x + 4, g.y + 2, g.x + 8, g.y - f); ctx.stroke();
  }
  // The bay.
  const sea = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 90);
  sea.addColorStop(0, '#5aa9d6'); sea.addColorStop(1, '#2d6f9e');
  ctx.fillStyle = sea; ctx.fillRect(460, HORIZON, 500, 90);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const y = HORIZON + 8 + i * 9;
    const ox = ((m.time * (10 + i * 3)) % 60);
    ctx.beginPath();
    for (let x = 460 - 60 + ox; x < 960; x += 60) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 3, x + 30, y); }
    ctx.stroke();
  }
  for (const w of m.wakes) { ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - w.age / w.life)})`; ctx.beginPath(); ctx.arc(w.x, w.y, w.size * (1 + w.age), 0, Math.PI * 2); ctx.fill(); }
  drawYacht(ctx, m, tension);
  // Palm on the right.
  ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(900, 320); ctx.quadraticCurveTo(915, 200, 905, 130); ctx.stroke();
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 8; ctx.stroke();
  const sway = gust(m.time, 2) * 6;
  for (const [a, len] of [[-2.6, 70], [-2.0, 80], [-1.2, 78], [-0.5, 70], [0.2, 60]] as const) {
    ctx.strokeStyle = INK; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(905, 130); ctx.quadraticCurveTo(905 + Math.cos(a) * len * 0.6 + sway, 130 + Math.sin(a) * len * 0.6 - 20, 905 + Math.cos(a) * len + sway, 130 + Math.sin(a) * len + 10); ctx.stroke();
    ctx.strokeStyle = '#3f9d4a'; ctx.lineWidth = 8; ctx.stroke();
  }
  // The house: a pale wall with a big window, curtains, and the assistant behind them.
  ctx.fillStyle = '#f2e6d8'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(-10, -10, 480, 300, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e4d3c0';
  ctx.fillRect(0, 0, 470, 30);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(470, 30); ctx.stroke();
  // Window.
  const win = { x: 110, y: 44, w: 250, h: 150 };
  ctx.fillStyle = '#5b3d6b';
  ctx.beginPath(); ctx.roundRect(win.x, win.y, win.w, win.h, 6); ctx.fill(); ctx.stroke();
  // The assistant packing bags, seen through the window.
  const packing = clamp(m.packing.x, 0, 1);
  if (packing > 0.02) {
    ctx.save();
    ctx.beginPath(); ctx.rect(win.x, win.y, win.w, win.h); ctx.clip();
    const ax = win.x + 125 + Math.sin(m.time * 3) * 30 * packing;
    const ay = win.y + win.h - 4;
    ctx.globalAlpha = packing;
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.roundRect(win.x + 20 + i * 34, ay - 30, 28, 30, 4); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.roundRect(ax - 14, ay - 74, 28, 44, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c68e6a';
    ctx.beginPath(); ctx.arc(ax, ay - 86, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a5230';
    const lift = Math.abs(Math.sin(m.time * 6)) * 22 * packing;
    const bagX = ax + 18 + Math.sin(m.time * 6) * 6 * packing;
    ctx.beginPath(); ctx.roundRect(bagX, ay - 52 - lift, 26, 26, 4); ctx.fill(); ctx.stroke();
    limb(ctx, { x: ax - 10, y: ay - 66 }, { x: ax - 26, y: ay - 40 + Math.sin(m.time * 3) * 4 }, 16, 14, -1, 8, '#2b2b30');
    limb(ctx, { x: ax + 12, y: ay - 66 }, { x: bagX + 10, y: ay - 40 - lift }, 18, 16, 1, 8, '#2b2b30');
    ctx.restore();
  }
  // Curtains, pulled a little wider as the packing goes on.
  ctx.fillStyle = '#c94b6c'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  const curtainW = mix(95, 60, packing);
  ctx.beginPath(); ctx.roundRect(win.x, win.y, curtainW, win.h, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(win.x + win.w - curtainW, win.y, curtainW, win.h, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28,31,38,0.3)'; ctx.lineWidth = 2;
  for (let i = 1; i < 4; i += 1) { ctx.beginPath(); ctx.moveTo(win.x + i * curtainW / 4, win.y + 4); ctx.lineTo(win.x + i * curtainW / 4, win.y + win.h - 4); ctx.moveTo(win.x + win.w - i * curtainW / 4, win.y + 4); ctx.lineTo(win.x + win.w - i * curtainW / 4, win.y + win.h - 4); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.strokeRect(win.x, win.y, win.w, win.h);
  // The star and the manager, then the balcony rail in front of them.
  const floorY = 268;
  drawManager(ctx, m, 372, floorY, tension);
  drawStar(ctx, m, 236, floorY, tension);
  ctx.fillStyle = '#f7f1ea'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(30, 200, 420, 14, 4); ctx.fill(); ctx.stroke();
  for (let i = 0; i <= 14; i += 1) { ctx.beginPath(); ctx.roundRect(36 + i * 29, 212, 10, 56, 3); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.roundRect(24, 266, 432, 18, 4); ctx.fill(); ctx.stroke();
  // A banner off the rail.
  ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(150, 284, 180, 24, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = `900 15px ${MEME_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(m.posted ? 'WAS NEVER MINE' : '$FAMOUS LAUNCH PARTY', 240, 302);
  // The gate to the right of the house, and the PR crisis team arriving.
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(470, 290); ctx.lineTo(470, 230); ctx.moveTo(560, 290); ctx.lineTo(560, 230); ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.moveTo(478 + i * 15, 290); ctx.lineTo(478 + i * 15, 240); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(470, 240); ctx.lineTo(560, 240); ctx.moveTo(470, 270); ctx.lineTo(560, 270); ctx.stroke();
  const pr = clamp(m.prTeam.x, 0, 1);
  if (pr > 0.02) {
    for (let i = 0; i < 3; i += 1) {
      const px = mix(640 + i * 40, 590 + i * 22, pr);
      // Feet planted by the distance walked (they walk left in, backwards out); a different stride each keeps them out of step.
      const walked = (640 + i * 40 - px) / 0.55, span = (50 + 18 * i) / 0.55, stride = span / Math.round(span / 44);
      const pace = 1;
      const step = (walked / stride) * Math.PI * 2;
      ctx.save();
      ctx.translate(px, 290);
      ctx.scale(0.55, 0.55);
      ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      for (const side of [-1, 1]) {
        const f = plantedStep(walked, span, stride, side > 0);
        limb(ctx, { x: side * 8, y: -64 }, { x: side * 10 - f.x * pace, y: f.y * pace }, 36, 34, -side, 12, '#2b2b30');
      }
      ctx.beginPath(); ctx.roundRect(-24, -120, 48, 62, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-6, -120); ctx.lineTo(6, -120); ctx.lineTo(0, -92); ctx.closePath(); ctx.fill();
      const swing = Math.sin(step) * 12 * pace;
      limb(ctx, { x: -20, y: -108 }, { x: -30 - swing, y: -68 }, 28, 26, 1, 10, '#2b2b30');
      const briefcase = { x: 34 + Math.sin(step - 0.5) * 10 * pace, y: -72 };
      limb(ctx, { x: 20, y: -108 }, briefcase, 28, 26, -1, 10, '#2b2b30');
      ctx.fillStyle = '#e0bda7'; ctx.beginPath(); ctx.arc(0, -142, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(-14, -148, 11, 6); ctx.fillRect(3, -148, 11, 6);
      ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(briefcase.x - 6, briefcase.y, 26, 34, 3); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // A long round brings the lawyers.
    const team = m.multiplier < 40 ? 'PR CRISIS TEAM' : m.multiplier < 150 ? 'PR TEAM + LAWYERS' : 'ALL THE LAWYERS';
    ctx.save();
    ctx.globalAlpha = smoothstep(0.6, 1, pr);
    ctx.font = '700 10px system-ui, sans-serif';
    const w = Math.max(96, ctx.measureText(team).width + 14);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(634 - w / 2, 214, w, 20, 6); ctx.fill(); ctx.stroke();
    label(ctx, team, 634, 228, 10, INK, 'center');
    ctx.restore();
  }
}

/** The phone close-up in the lower left: the chart, the draft post, then the post itself. */
export function drawPhone(ctx: CanvasRenderingContext2D, m: Mansion, multiplier: number, scale = 1): void {
  const p = { x: 22, y: 318, w: 150, h: 204 };
  ctx.save();
  // The punch at the post, about the phone's centre, and a rattle when a notification buzzes it.
  ctx.translate(p.x + p.w / 2 + m.buzz * Math.sin(m.time * 95) * 2.5, p.y + p.h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-p.x - p.w / 2, -p.y - p.h / 2);
  ctx.fillStyle = '#ffd35c'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#101218';
  ctx.beginPath(); ctx.roundRect(p.x + 8, p.y + 14, p.w - 16, p.h - 28, 10); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(p.x + 8, p.y + 14, p.w - 16, p.h - 28, 10); ctx.clip();
  // Header.
  ctx.fillStyle = '#1f2230'; ctx.fillRect(p.x + 8, p.y + 14, p.w - 16, 28);
  label(ctx, '$FAMOUS', p.x + 18, p.y + 33, 12, '#ffffff');
  const ticker = ctx.measureText('$FAMOUS').width;
  label(ctx, `${multiplier.toFixed(2)}×`, p.x + p.w - 18, p.y + 33, 12, m.posted ? '#ff4d6d' : '#7cf67c', 'right', p.w - 36 - ticker - 8);
  // The chart.
  const cx = p.x + 14; const cy = p.y + 48; const cw = p.w - 28; const ch = 52;
  ctx.strokeStyle = '#2b2f40'; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) { ctx.beginPath(); ctx.moveTo(cx, cy + i * ch / 3); ctx.lineTo(cx + cw, cy + i * ch / 3); ctx.stroke(); }
  const pts = m.chart;
  const top = Math.max(2, ...pts);
  ctx.strokeStyle = m.posted ? '#ff4d6d' : '#7cf67c'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  const n = Math.max(2, pts.length);
  for (let i = 0; i < pts.length; i += 1) { const x = cx + (i / (n - 1)) * cw; const y = cy + ch - ((pts[i]! - 1) / (top - 1)) * ch; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  if (m.posted) {
    const drop = smoothstep(0, 1.2, m.endAge);
    const lastX = pts.length ? cx + ((pts.length - 1) / (n - 1)) * cw : cx;
    ctx.lineTo(mix(lastX, cx + cw, drop), mix(cy, cy + ch, drop));
  }
  ctx.stroke();
  // The post box and the button, tucked up so the button sits inside the screen.
  const draft = clamp(m.draft.x, 0, 1);
  ctx.fillStyle = '#1f2230';
  ctx.beginPath(); ctx.roundRect(p.x + 14, p.y + 106, p.w - 28, 56, 6); ctx.fill();
  ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(p.x + 26, p.y + 120, 7, 0, Math.PI * 2); ctx.fill();
  label(ctx, 'famous_official', p.x + 38, p.y + 124, 9, '#c9c9d4');
  if (m.posted) {
    label(ctx, 'i got hacked. that', p.x + 20, p.y + 140, 10, '#ffffff');
    label(ctx, 'coin was never me', p.x + 20, p.y + 153, 10, '#ffffff');
  } else if (draft > 0.05) {
    // The excuse of the moment types itself in; the draft never quite settles on one.
    const text = EXCUSES[m.excuse]!;
    const shown = text.slice(0, Math.min(text.length, Math.floor(m.excuseAge / 0.028)));
    label(ctx, `draft ${m.excuse + 1}/${EXCUSES.length}:`, p.x + 20, p.y + 140, 9, '#9a9aa8');
    ctx.save();
    ctx.translate(p.x + 20, p.y + 154);
    const k = 1 + 0.06 * m.excusePop.x;
    ctx.scale(k, k);
    label(ctx, `${shown}${Math.floor(m.time * 3) % 2 ? '|' : ''}`, 0, 0, 11, '#ff9db0', 'left', p.w - 42);
    ctx.restore();
  } else {
    label(ctx, 'new coin $FAMOUS', p.x + 20, p.y + 140, 10, '#ffffff');
    label(ctx, 'is LIVE. love u all', p.x + 20, p.y + 153, 10, '#ffffff');
  }
  // Post button: it throbs faster with the tension, sinks under the thumb in a near miss, and lands flat once posted.
  const throb = m.posted ? 0 : draft * Math.max(0, Math.sin(m.throb)) * 0.08;
  const near = m.hover < 0 ? 0 : smoothstep(0, 0.45, m.hover) * (1 - smoothstep(0.85, 1.3, m.hover));
  const press = m.hover < 0 ? 0 : smoothstep(0.4, 0.55, m.hover) * (1 - smoothstep(0.7, 0.85, m.hover));
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + 177);
  ctx.scale((1 + throb) * (1 - 0.08 * press), (1 + throb) * (1 - 0.08 * press));
  ctx.fillStyle = m.posted || press > 0.5 ? '#ff4d6d' : draft > 0.5 ? '#ffb36b' : '#3b82f6';
  ctx.beginPath(); ctx.roundRect(-(p.w - 28) / 2, -9, p.w - 28, 18, 9); ctx.fill();
  label(ctx, m.posted ? 'POSTED' : near > 0.3 ? 'POST?!' : draft > 0.5 ? 'POST?' : 'POST', 0, 4, 10, '#ffffff', 'center');
  ctx.restore();
  ctx.restore();
  // His thumb, in from the corner for a near miss.
  if (near > 0.01) {
    ctx.save();
    const k = near;

    ctx.translate(mix(p.x + p.w + 40, p.x + p.w / 2 + 42, k), mix(p.y + p.h + 50, p.y + 189 + 3 * press, k));
    ctx.rotate(-0.55);
    ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-11, -16, 22, 70, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f6e1d3'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-7, -12, 14, 13, 5); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Camera notch.
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(p.x + p.w / 2 - 18, p.y + 6, 36, 6, 3); ctx.fill();
  ctx.restore();
}
