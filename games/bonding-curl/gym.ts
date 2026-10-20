/**
 * Degen Fitness: the set shared by the two gym games. A mirror wall that
 * shows the round's own chart and cracks under pressure, posters, a
 * dumbbell rack, a water cooler, the crowd filming vertical along the back
 * wall with their heckles and their hearts, and the phone overlay with the
 * live viewer count. Nothing here changes the outcome.
 */
import { type Spring, clamp, footAt, mix, noise, settleSpring, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const SKIN = '#f3dccb';
export const FLOOR_Y = 332;
export const MIRROR = { x: 130, y: 36, w: 700, h: 214 } as const;
const MEME_FONT = 'Impact, "Arial Black", sans-serif';
/** The mirror's chart takes a point every 100 ms of the round, up to this many. */
const TRAIL_POINTS = 900;

export type Point = { x: number; y: number };
export type FanKind = 'bro' | 'girl' | 'old' | 'big';
export type Mood = 'calm' | 'hype' | 'shock' | 'sulk' | 'swoon';

export interface Fan {
  kind: FanKind;
  x: number;
  homeX: number;
  seed: number;
  phone: Spring;
  bubble: { text: string; age: number; pop: Spring } | null;
  gone: boolean;
}

interface Heart { x: number; y: number; vx: number; age: number; life: number; size: number; screen: boolean }
export interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour: string }

export interface Gym {
  time: number;
  fans: Fan[];
  cheer: number;
  /** The crowd's bounce, integrated so its rate can follow the cheer without the phase jumping. */
  bobPhase: number;
  hype: Spring;
  sulk: Spring;
  shock: number;
  cracks: number;
  trail: Point[];
  trailAt: number;
  hearts: Heart[];
  puffs: Puff[];
  swoonUntil: number;
  /** The last tenth of a second that hearts were thrown on: they come on that tick, not every frame. */
  heartTick: number;
  leaving: boolean;
  /** Seconds since the girls started walking out: their pace ramps in over the first few tenths. */
  leaveAge: number;
  finished: boolean;
  viewers: number;
}

const LINEUP: { kind: FanKind; x: number }[] = [
  { kind: 'bro', x: 150 }, { kind: 'girl', x: 250 }, { kind: 'big', x: 355 }, { kind: 'old', x: 600 }, { kind: 'girl', x: 700 }, { kind: 'bro', x: 800 },
];

export function createGym(): Gym {
  return { time: 0, fans: LINEUP.map((f, i) => ({ kind: f.kind, x: f.x, homeX: f.x, seed: i * 3.7 + 1, phone: spring(0), bubble: null, gone: false })), cheer: 0, bobPhase: 0, hype: spring(0), sulk: spring(0), shock: 0, cracks: 0, trail: [], trailAt: -1, hearts: [], puffs: [], swoonUntil: 0, heartTick: -1, leaving: false, leaveAge: 0, finished: false, viewers: 69 };
}

export function resetGym(g: Gym): void {
  for (const [i, f] of g.fans.entries()) { f.x = f.homeX = LINEUP[i]!.x; f.gone = false; f.bubble = null; settleSpring(f.phone, 0); }
  settleSpring(g.hype, 0);
  settleSpring(g.sulk, 0);
  g.shock = 0;
  g.cracks = 0;
  g.trail = [];
  g.trailAt = -1;
  g.hearts = [];
  g.puffs = [];
  g.swoonUntil = 0;
  g.leaving = false;
  g.leaveAge = 0;
  g.finished = false;
}

/** A shout from the crowd: a girl when `girls` is set, otherwise whoever is free. */
export function heckle(g: Gym, text: string, girls = false): void {
  const pool = g.fans.filter((f) => !f.gone && !f.bubble && (!girls || f.kind === 'girl'));
  const fan = pool[Math.floor(noise(g.time * 7.7 + text.length) * pool.length)];
  if (fan) fan.bubble = { text, age: 0, pop: spring(0) };
}

/** Hearts from the girls for a couple of seconds. */
export function swoon(g: Gym): void {
  g.swoonUntil = g.time + 2.2;
}

/** The walk-out pace, reached after the first 0.3 s. */
const WALK_SPEED = 150;
const WALK_RAMP = 0.3;
/** A girl's stride on the floor, in pixels. */
const WALK_STRIDE = 26;

/** The girls walk out. For a crash met `age` seconds late, each starts where the walk has taken her by now. */
export function walkOut(g: Gym, age = 0): void {
  g.leaving = true;
  g.leaveAge = Math.max(0, age);
  if (age <= 0) return;
  for (const f of g.fans) {
    if (f.kind !== 'girl' || f.gone) continue;
    f.x = f.homeX + WALK_SPEED * Math.max(0, age - WALK_RAMP / 2);
    if (f.x > 1010) f.gone = true;
  }
}

/** A chalk cloud (or any cloud) at a point. */
export function puff(g: Gym, at: Point, count: number, colour: string, seedOffset = 0): void {
  for (let i = 0; i < count; i += 1) {
    const n = i * 1.7 + seedOffset;
    g.puffs.push({ x: at.x + (noise(n) - 0.5) * 40, y: at.y + (noise(n + 1) - 0.5) * 30, vx: (noise(n + 2) - 0.5) * 120, vy: -20 - noise(n + 3) * 60, r: 8 + noise(n + 4) * 14, age: 0, life: 0.9 + noise(n + 5) * 0.6, colour });
  }
}

/** Chart samples store elapsed milliseconds and log2(multiplier), keeping the actual observed curve. */
const trailPoint = (elapsed: number, growth: number): Point => ({ x: elapsed, y: growth });

/** A late join knows its endpoints; draw that connection until observed samples arrive. */
export function settleTrail(g: Gym, elapsed: number, growth: number): void {
  g.trail = [trailPoint(0, 0), trailPoint(elapsed, growth)];
  g.trailAt = Math.floor(elapsed / 100);
}

/** Rescale the mirror chart instead of flattening all multipliers above 18× against its ceiling. */
function chartPoints(trail: Point[]): Point[] {
  const end = trail[trail.length - 1]!;
  const timeScale = Math.max(32_000, end.x / 3);
  const growthScale = Math.max(4.2, end.y * 1.12);
  return trail.map(p => ({ x: MIRROR.x + 30 + (MIRROR.w - 60) * (1 - Math.exp(-p.x / timeScale)), y: MIRROR.y + MIRROR.h - 20 - (MIRROR.h - 50) * p.y / growthScale }));
}

export function finishGym(g: Gym, cheerful: boolean, quiet: boolean): void {
  g.finished = true;
  g.shock = quiet ? 0 : 1.2;
  if (cheerful) settleSpring(g.hype, 1);
  else settleSpring(g.sulk, 1);
}

export interface GymDrive { running: boolean; tension: number; multiplier: number; growth: number; elapsed: number; cracks: number }

const cheerFor = (g: Gym, running: boolean, tension: number): number => (running ? 0.2 + 0.8 * tension : g.finished ? 0.1 : 0.12);
/**
 * How high fan `i` holds the phone: up one by one from about 1.3× to 1.7×, and until then (and between rounds) a few
 * film the warm-up at half mast; after the burst only a hyped crowd keeps filming.
 */
const filming = (g: Gym, running: boolean, tension: number, i: number): number => (running && tension > 0.22 + 0.035 * ((i * 5) % 6) ? 1 : g.finished ? (g.hype.x > 0.5 ? 1 : 0) : i % 3 ? 0.4 : 0);

/** A round met late: the crowd is already as loud as the number and the phones already up. */
export function settleCrowd(g: Gym, running: boolean, tension: number): void {
  g.cheer = cheerFor(g, running, tension);
  for (const [i, f] of g.fans.entries()) settleSpring(f.phone, filming(g, running, tension, i));
}

export function stepGym(g: Gym, drive: GymDrive, dt: number): void {
  g.time += dt;
  g.cheer += (cheerFor(g, drive.running, drive.tension) - g.cheer) * (1 - Math.exp(-dt / 0.8));
  g.bobPhase += dt * (4 + 6 * g.cheer);
  if (g.leaving) g.leaveAge += dt;
  const pace = WALK_SPEED * Math.min(1, g.leaveAge / WALK_RAMP);
  g.shock = Math.max(0, g.shock - dt);
  g.cracks = drive.running ? Math.max(g.cracks, drive.cracks) : g.finished ? g.cracks : 0;
  // The live count tops out at everyone on Earth.
  g.viewers = Math.round(Math.min(8.1e9, 69 + 420 * (Math.pow(drive.multiplier, 1.4) - 1)));
  if (drive.running) {
    const at = Math.floor(drive.elapsed / 100);
    if (at !== g.trailAt) {
      // Thin old history at the cap, retaining the launch and making room for current samples.
      if (g.trail.length >= TRAIL_POINTS) g.trail = g.trail.filter((_, i) => i % 2 === 0);
      g.trailAt = at;
      g.trail.push(trailPoint(drive.elapsed, drive.growth));
    }
  }
  for (const [i, f] of g.fans.entries()) {
    stepSpring(f.phone, filming(g, drive.running, drive.tension, i), 6, 0.7, dt);
    if (f.bubble) {
      f.bubble.age += dt;
      stepSpring(f.bubble.pop, f.bubble.age < 1.6 ? 1 : 0, 14, 0.5, dt);
      if (f.bubble.age > 2) f.bubble = null;
    }
    if (g.leaving && f.kind === 'girl' && !f.gone) {
      f.x += pace * dt;
      if (f.x > 1010) f.gone = true;
    }
  }
  // Hearts are thrown on a ten-a-second tick, so how many fly doesn't depend on the frame rate.
  const tick = Math.floor(g.time * 10);
  if (tick !== g.heartTick) {
    g.heartTick = tick;
    if (g.time < g.swoonUntil) {
      for (const f of g.fans) {
        if (f.kind !== 'girl' || f.gone) continue;
        for (let j = 0; j < 3; j += 1) {
          const n = tick + f.seed + j * 0.37;
          if (noise(n) > 0.55 && g.hearts.length < 60) g.hearts.push({ x: f.x + (noise(n * 3) - 0.5) * 30, y: FLOOR_Y - 120, vx: (noise(n * 5) - 0.5) * 30, age: 0, life: 1.6, size: 6 + noise(n * 7) * 6, screen: false });
        }
      }
    }
    if (g.cheer > 0.6 && !g.finished && noise(tick * 0.6) > 0.5 && g.hearts.filter((h) => h.screen).length < 8) g.hearts.push({ x: 880 + noise(tick * 9) * 40, y: 196, vx: (noise(tick * 4) - 0.5) * 10, age: 0, life: 1.4, size: 4 + noise(tick * 2) * 3, screen: true });
  }
  for (const h of g.hearts) { h.age += dt; h.x += h.vx * dt; h.y -= (h.screen ? 40 : 60) * dt; }
  g.hearts = g.hearts.filter((h) => h.age < h.life);
  for (const p of g.puffs) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 16 * dt; p.vy += 10 * dt; }
  g.puffs = g.puffs.filter((p) => p.age < p.life);
}

export function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.6, y - s * 1.2, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.2, x, y + s);
  ctx.fill();
}

export function memeLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center', maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The wall, the mirror with the chart and its cracks, posters, rack and cooler. */
export function drawGymBack(ctx: CanvasRenderingContext2D, g: Gym, dead: boolean): void {
  ctx.fillStyle = '#d9d4cb';
  ctx.fillRect(0, 0, 960, FLOOR_Y);
  ctx.fillStyle = '#3f3a45';
  ctx.fillRect(0, FLOOR_Y - 46, 960, 46);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(0, FLOOR_Y - 52, 960, 6);
  // Mirror.
  const glass = ctx.createLinearGradient(MIRROR.x, MIRROR.y, MIRROR.x + MIRROR.w, MIRROR.y + MIRROR.h);
  glass.addColorStop(0, '#b9cbd8');
  glass.addColorStop(0.5, '#d2e2ec');
  glass.addColorStop(1, '#aebfcc');
  ctx.fillStyle = glass;
  ctx.fillRect(MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(MIRROR.x + 40, MIRROR.y + MIRROR.h - 10); ctx.lineTo(MIRROR.x + 200, MIRROR.y + 10); ctx.stroke();
  // The chart in the mirror.
  if (g.trail.length > 1) {
    const trail = chartPoints(g.trail);
    ctx.save();
    ctx.beginPath(); ctx.rect(MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = dead ? 'rgba(255, 77, 109, 0.55)' : 'rgba(46, 160, 90, 0.55)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(trail[0]!.x, trail[0]!.y);
    for (const p of trail) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    const tip = trail[trail.length - 1]!;
    const from = trail[Math.max(0, trail.length - 8)]!;
    let head = tip;
    let angle = Math.atan2(tip.y - from.y, tip.x - from.x);
    if (dead) { head = { x: tip.x + 26, y: MIRROR.y + MIRROR.h - 14 }; angle = Math.atan2(head.y - tip.y, head.x - tip.x); ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(head.x, head.y); ctx.stroke(); }
    ctx.translate(head.x, head.y); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-12, -13); ctx.lineTo(-6, 0); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Cracks from the middle of the mirror.
  const n = Math.floor(clamp(g.cracks, 0, 1) * 9);
  if (n > 0) {
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < n; i += 1) {
      const a = i * 0.7 + noise(i) * 0.5;
      let x = MIRROR.x + MIRROR.w / 2 + 40;
      let y = MIRROR.y + MIRROR.h - 40;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 6; s += 1) { const step = 18 + noise(i * 5 + s) * 22; x += Math.cos(a + (noise(i * 3 + s) - 0.5) * 0.9) * step; y -= Math.sin(a + (noise(i * 9 + s) - 0.5) * 0.9) * step * 0.7; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.strokeRect(MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h);
  // The sign over the mirror.
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.roundRect(360, 4, 240, 26, 4); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  memeLabel(ctx, 'DEGEN FITNESS', 480, 24, 18, '#ffe27a');
  // Posters.
  // The right poster hangs clear of the phone overlay in the corner.
  for (const [px, lines] of [[22, ['PUMP IT', 'DUMP IT']], [760, ['NO PAIN', 'NO GAINZ']]] as const) {
    ctx.fillStyle = '#14213d';
    ctx.beginPath(); ctx.roundRect(px, 60, 92, 120, 3); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    memeLabel(ctx, lines[0], px + 46, 86, 15, '#ffe27a');
    memeLabel(ctx, lines[1], px + 46, 104, 15, '#ffe27a');
    // A flexed arm.
    ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px + 22, 160); ctx.lineTo(px + 48, 150); ctx.lineTo(px + 60, 122); ctx.stroke();
    ctx.strokeStyle = '#f3dccb'; ctx.lineWidth = 10; ctx.stroke();
    ctx.fillStyle = '#f3dccb'; ctx.beginPath(); ctx.ellipse(px + 40, 140, 12, 9, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  }
  // Dumbbell rack.
  ctx.fillStyle = '#4a4a55'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  for (let tier = 0; tier < 3; tier += 1) {
    const y = 214 + tier * 38;
    ctx.beginPath(); ctx.roundRect(16, y, 98, 8, 2); ctx.fill(); ctx.stroke();
    for (const dx of [30, 72]) {
      ctx.fillStyle = '#2b2b30';
      ctx.beginPath(); ctx.roundRect(dx - 12, y - 14, 8, 14, 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(dx + 14, y - 14, 8, 14, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8d99ae';
      ctx.beginPath(); ctx.roundRect(dx - 6, y - 9, 22, 4, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4a4a55';
    }
  }
  // Water cooler.
  ctx.fillStyle = '#e9e3d6';
  ctx.beginPath(); ctx.roundRect(892, 236, 44, FLOOR_Y - 236, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(120, 190, 255, 0.75)';
  ctx.beginPath(); ctx.roundRect(898, 176, 32, 62, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(904, 250, 8, 8);
}

/** One gym-goer along the back wall, feet at (x, FLOOR_Y). */
function drawFan(ctx: CanvasRenderingContext2D, f: Fan, g: Gym, mood: Mood, bob: number, sway: number): void {
  const s = 0.72;
  ctx.save();
  ctx.translate(f.x, FLOOR_Y - bob);
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const tone = noise(f.seed * 3.3);
  const skin = tone > 0.66 ? SKIN : tone > 0.33 ? '#e0bda7' : '#c68e6a';
  // Walking out, the steps follow the distance she has covered, so the planted foot holds its spot on the floor;
  // standing, both feet sit under her, one planted and one about to lift as her pace ramps in.
  const walk = g.leaving && f.kind === 'girl' ? Math.min(1, g.leaveAge / WALK_RAMP) : 0;
  const legs = f.kind === 'girl' ? '#2b2b30' : f.kind === 'old' ? '#8d99ae' : '#3d5f8f';
  for (const side of [-1, 1]) {
    const foot = footAt((f.x - f.homeX) / (2 * WALK_STRIDE) + (side > 0 ? 0.75 : 0.25), WALK_STRIDE / s, 8);
    const fx = side * 11 + foot.dx;
    const lift = foot.lift * walk;
    ctx.strokeStyle = INK; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(side * 9, -74 + sway); ctx.lineTo(fx, -lift); ctx.stroke();
    ctx.strokeStyle = legs; ctx.lineWidth = 13; ctx.stroke();
    ctx.fillStyle = '#f6f6f6'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(fx - 11, -lift - 5, 22, 9, 4); ctx.fill(); ctx.stroke();
  }
  // The weight shift sinks the body a touch; the feet stay put.
  ctx.translate(0, sway);
  const shirt = f.kind === 'girl' ? '#ff5d9e' : f.kind === 'old' ? '#f2f2f2' : f.kind === 'big' ? '#111' : ['#e63946', '#3b82f6', '#2e8b57', '#7c3aed'][Math.floor(noise(f.seed * 7.1) * 4)]!;
  const w = f.kind === 'big' ? 46 : 30;
  ctx.fillStyle = shirt; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-w, f.kind === 'girl' ? -118 : -136, w * 2, f.kind === 'girl' ? 46 : 66, 10); ctx.fill(); ctx.stroke();
  if (f.kind === 'girl') { ctx.fillStyle = skin; ctx.beginPath(); ctx.roundRect(-26, -136, 52, 22, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(-30, -140, 60, 12, 6); ctx.fill(); ctx.stroke(); }
  // Arms: a phone held up, or hanging, or hands on head in shock.
  const phone = clamp(f.phone.x, 0, 1);
  const arm = (ax: number, ay: number, bx: number, by: number) => { ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.strokeStyle = skin; ctx.lineWidth = 11; ctx.stroke(); };
  if (mood === 'shock' || mood === 'sulk') {
    arm(-w, -120, -16, -170); arm(w, -120, 16, -170);
  } else {
    arm(-w, -120, -w - 8, -78);
    const hx = mix(w + 6, w - 4, phone);
    const hy = mix(-78, -166, phone);
    arm(w, -120, hx, hy);
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(mix(0.6, 0, phone));
    ctx.beginPath(); ctx.roundRect(-8, -18, 16, 30, 3); ctx.fill(); ctx.stroke();
    if (phone > 0.5) { ctx.fillStyle = Math.floor(g.time * 2) % 2 ? '#e63946' : '#6b1c24'; ctx.beginPath(); ctx.arc(0, -13, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // Head.
  const hy = f.kind === 'girl' ? -158 : -160;
  ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, hy, 20, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const eye = mood === 'shock' ? 1.6 : mood === 'swoon' ? 0.4 : 1;
  for (const ex of [-7, 7]) {
    ctx.beginPath(); ctx.ellipse(ex, hy - 4, 4, 4 * eye, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    if (mood === 'swoon') heart(ctx, ex, hy - 4, 4.5, '#ff4d6d');
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, hy - 3, 1.9, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath();
  if (mood === 'hype' || mood === 'swoon') { ctx.ellipse(0, hy + 10, 5, 5, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (mood === 'shock') { ctx.ellipse(0, hy + 11, 4, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (mood === 'sulk') { ctx.moveTo(-6, hy + 13); ctx.quadraticCurveTo(0, hy + 7, 6, hy + 13); }
  else { ctx.moveTo(-6, hy + 9); ctx.quadraticCurveTo(0, hy + 13, 6, hy + 9); }
  ctx.stroke();
  if (f.kind === 'girl') {
    ctx.fillStyle = ['#5a3a22', '#f2d16b'][Math.floor(noise(f.seed) * 2)]!;
    ctx.beginPath(); ctx.ellipse(0, hy - 14, 22, 14, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, hy - 22); ctx.quadraticCurveTo(40, hy - 10 + Math.sin(g.time * 4 + f.seed) * 6, 30, hy + 20); ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 6; ctx.stroke();
  } else if (f.kind === 'old') {
    ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.roundRect(-21, hy - 18, 42, 9, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d5d5d5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, hy + 8); ctx.lineTo(14, hy + 8); ctx.stroke();
  } else if (f.kind === 'big') {
    ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.ellipse(0, hy - 16, 21, 10, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(0, hy - 14, 21, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-23, hy - 18, 46, 7, 3); ctx.fill(); ctx.stroke();
  }
  // The heckle.
  if (f.bubble) {
    const k = clamp(f.bubble.pop.x, 0, 1.2);
    if (k > 0.02) {
      ctx.save();
      ctx.translate(0, hy - 46);
      ctx.scale(k, k);
      ctx.font = '900 14px Impact, "Arial Black", sans-serif';
      // The bubble widens for a longer shout instead of squeezing it.
      const w = clamp(ctx.measureText(f.bubble.text).width + 16, 92, 150);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(-w / 2, -30, w, 30, 8); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, 10); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = INK; ctx.textAlign = 'center';
      ctx.fillText(f.bubble.text, 0, -10, w - 8);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** The crowd, hearts and any puffs. */
export function drawGymCrowd(ctx: CanvasRenderingContext2D, g: Gym, cheerful: boolean): void {
  for (const [i, f] of g.fans.entries()) {
    if (f.gone) continue;
    let bob = Math.max(0, Math.sin(g.bobPhase + i * 0.7)) * 6 * g.cheer;
    if (g.hype.x > 0.05) bob += Math.max(0, Math.sin(g.time * 10 + i)) * 14 * g.hype.x;
    const swooning = g.time < g.swoonUntil && f.kind === 'girl';
    const mood: Mood = g.finished ? (g.shock > 0 ? 'shock' : cheerful ? 'hype' : 'sulk') : swooning ? 'swoon' : g.cheer > 0.7 ? 'hype' : 'calm';
    // A slow weight shift underneath, so nobody stands frozen between rounds.
    drawFan(ctx, f, g, mood, bob, 2.2 * (0.5 + 0.5 * Math.sin(g.time * 1.3 + f.seed)));
  }
  for (const h of g.hearts) {
    if (h.screen) continue;
    ctx.globalAlpha = 1 - h.age / h.life;
    heart(ctx, h.x, h.y - h.age * 20, h.size, '#ff4d6d');
  }
  ctx.globalAlpha = 1;
}

export function drawPuffs(ctx: CanvasRenderingContext2D, g: Gym): void {
  for (const p of g.puffs) {
    ctx.globalAlpha = 0.75 * (1 - p.age / p.life);
    ctx.fillStyle = p.colour;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawGymFloor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#3a3d44';
  ctx.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 12; i += 1) { const t = i / 12; ctx.beginPath(); ctx.moveTo(mix(300, 660, t), FLOOR_Y); ctx.lineTo(mix(-200, 1160, t), 540); ctx.stroke(); }
  for (const y of [FLOOR_Y + 40, FLOOR_Y + 95, FLOOR_Y + 160]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(960, FLOOR_Y); ctx.stroke();
}

/** A vertical phone in the corner: the live badge, the viewer count, the hearts. */
export function drawPhoneOverlay(ctx: CanvasRenderingContext2D, g: Gym, live: boolean, x = 866, y = 44): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(0, 0, 76, 150, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a3340';
  ctx.beginPath(); ctx.roundRect(5, 8, 66, 134, 6); ctx.fill();
  ctx.fillStyle = live ? (Math.floor(g.time * 2) % 2 ? '#e63946' : '#b02a35') : '#555';
  ctx.beginPath(); ctx.roundRect(10, 14, 34, 14, 4); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '900 10px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(live ? 'LIVE' : 'ENDED', 27, 25);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(52, 21, 5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(52, 21, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'right';
  const viewers = g.viewers >= 1e9 ? `${(g.viewers / 1e9).toFixed(1)}B` : g.viewers >= 1e6 ? `${(g.viewers / 1e6).toFixed(1)}M` : g.viewers >= 1000 ? `${(g.viewers / 1000).toFixed(1)}K` : String(g.viewers);
  ctx.fillText(viewers, 66, 44, 56);
  ctx.restore();
  for (const h of g.hearts) {
    if (!h.screen) continue;
    ctx.globalAlpha = 1 - h.age / h.life;
    heart(ctx, h.x, h.y, h.size, '#ff4d6d');
  }
  ctx.globalAlpha = 1;
}
