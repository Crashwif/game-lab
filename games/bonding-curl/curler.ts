/**
 * The curler: Gigachad in profile, the only grayscale thing in the gym,
 * curling a dumbbell. The face never moves. The bicep is the balloon: it
 * swells with the displayed multiplier, puffs on every rep, goes veiny
 * then shiny, tears its sleeve, and reads its own pressure on a cuff. An
 * accepted exit drops the weight, kisses the peak and puts the shades on
 * while the arm keeps growing. The crash bursts it into a seeded cloud of
 * protein powder and leaves a noodle. Nothing here changes the outcome.
 */
import { type Spring, clamp, fract, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, type Point } from './gym';

const GRAY = '#cfcfcf';
const GRAY_SHADE = '#a9a9a9';
const BEARD = '#3a3a3a';
const TEE = '#f2f2f2';
const FEET_Y = 500;
const SHOULDER: Point = { x: 456, y: 268 };
const ELBOW: Point = { x: 462, y: 342 };
export const SLEEVE_AT = 2.3;

interface Shred { x: number; y: number; vx: number; vy: number; angle: number; spin: number; length: number; width: number; age: number; life: number; tone: number }
interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number }

export type CurlMode = 'idle' | 'curling' | 'posing';

export interface Curler {
  time: number;
  mode: CurlMode;
  modeAge: number;
  phase: number;
  curl: Spring;
  radius: Spring;
  puff: Spring;
  tension: number;
  stretch: number;
  sleeve: boolean;
  sleeveShreds: Shred[];
  burst: boolean;
  burstAge: number;
  burstAt: Point;
  shreds: Shred[];
  puffs: Puff[];
  noodle: Spring;
  shades: Spring;
  kiss: Spring;
  dumbbell: { x: number; y: number; vy: number; angle: number; dropped: boolean; sunk: number };
  tear: Spring;
  events: { rep: boolean; sleeve: boolean; dropped: boolean };
}

export function createCurler(): Curler {
  return { time: 0, mode: 'idle', modeAge: 0, phase: 0, curl: spring(0.1), radius: spring(16), puff: spring(0), tension: 0, stretch: 0, sleeve: true, sleeveShreds: [], burst: false, burstAge: 0, burstAt: { ...ELBOW }, shreds: [], puffs: [], noodle: spring(0), shades: spring(0), kiss: spring(0), dumbbell: { x: 0, y: 0, vy: 0, angle: 0, dropped: false, sunk: 0 }, tear: spring(0), events: { rep: false, sleeve: false, dropped: false } };
}

export function resetCurler(c: Curler): void {
  c.mode = 'idle';
  c.modeAge = 0;
  c.phase = 0;
  settleSpring(c.curl, 0.1);
  settleSpring(c.radius, 16);
  settleSpring(c.puff, 0);
  c.stretch = 0;
  c.sleeve = true;
  c.sleeveShreds = [];
  c.burst = false;
  c.burstAge = 0;
  c.shreds = [];
  c.puffs = [];
  settleSpring(c.noodle, 0);
  settleSpring(c.shades, 0);
  settleSpring(c.kiss, 0);
  c.dumbbell = { x: 0, y: 0, vy: 0, angle: 0, dropped: false, sunk: 0 };
  settleSpring(c.tear, 0);
}

export const radiusFor = (growth: number): number => 16 + 128 * (1 - Math.exp(-growth / 2.6));

/** Jumps straight to the state a multiplier calls for, for a first frame mid-round. */
export function settleCurler(c: Curler, multiplier: number, growth: number): void {
  c.mode = 'curling';
  settleSpring(c.radius, radiusFor(growth));
  c.sleeve = multiplier < SLEEVE_AT;
}

/** The exit was accepted: drop it, kiss it, shades. */
export function poseCurler(c: Curler): void {
  if (c.mode !== 'curling') return;
  c.mode = 'posing';
  c.modeAge = 0;
  c.dumbbell.dropped = true;
  c.events.dropped = true;
}

/** Where the bicep is drawn from: centre and radius in world space. */
export function bicepGeometry(c: Curler): { centre: Point; r: number; rx: number; ry: number } {
  const r = Math.max(8, c.radius.x + c.puff.x);
  const mid = { x: mix(SHOULDER.x, ELBOW.x, 0.5) + 6 + r * 0.55, y: mix(SHOULDER.y, ELBOW.y, 0.5) - r * 0.1 };
  return { centre: mid, r, rx: r * (1 + 0.08 * Math.sin(c.time * 2)), ry: r * 0.86 };
}

/** The bicep goes. `quiet` skips the effects for a crash that already happened. */
export function burstBicep(c: Curler, seed: number, quiet: boolean): void {
  if (c.burst) return;
  const g = bicepGeometry(c);
  c.burst = true;
  c.burstAge = quiet ? 10 : 0;
  c.burstAt = g.centre;
  c.shreds = [];
  c.puffs = [];
  c.dumbbell.dropped = true;
  if (quiet) { settleSpring(c.noodle, 1); settleSpring(c.tear, 1); c.dumbbell.sunk = 1; return; }
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

export interface CurlerDrive { running: boolean; multiplier: number; growth: number; tension: number }

export function stepCurler(c: Curler, drive: CurlerDrive, dt: number): void {
  c.time += dt;
  c.modeAge += dt;
  c.tension = drive.tension;
  c.events = { rep: false, sleeve: false, dropped: false };
  if (c.mode === 'idle' && drive.running) { c.mode = 'curling'; c.modeAge = 0; }
  if (c.mode === 'curling' && drive.running && !c.burst) {
    const before = c.phase;
    c.phase += (0.7 + 0.9 * (1 - Math.exp(-drive.growth / 2))) * dt;
    if (fract(before) < 0.5 && (fract(c.phase) >= 0.5 || Math.floor(c.phase) > Math.floor(before))) { c.events.rep = true; c.puff.v += 40 + 60 * drive.tension; }
  }
  const target = c.mode === 'curling' ? 0.5 - 0.5 * Math.cos(c.phase * Math.PI * 2) : c.mode === 'posing' ? 1 : 0.1;
  stepSpring(c.curl, c.burst ? 0 : target, c.mode === 'curling' ? 30 : 6, 0.9, dt);
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
  stepSpring(c.shades, c.mode === 'posing' && c.modeAge > 0.9 ? 1 : 0, 12, 0.5, dt);
  stepSpring(c.kiss, c.mode === 'posing' && c.modeAge > 0.3 && c.modeAge < 1.4 ? 1 : 0, 8, 0.7, dt);
  const d = c.dumbbell;
  if (d.dropped) {
    if (c.burst && c.burstAge < 10) {
      d.vy += 1400 * dt;
      d.y += d.vy * dt;
      if (d.y > 0) { d.sunk = Math.min(1, d.sunk + dt * 1.5); d.y = 0; }
    } else {
      d.vy += 1400 * dt;
      d.y += d.vy * dt;
      if (d.y > 0 && d.vy > 0) { d.y = 0; d.vy *= -0.25; }
    }
  }
  if (c.burst) {
    c.burstAge += dt;
    stepSpring(c.noodle, 1, 5, 0.25, dt);
    stepSpring(c.tear, c.burstAge > 1.2 ? 1 : 0, 4, 0.9, dt);
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

function drawDumbbell(ctx: CanvasRenderingContext2D, at: Point, angle: number, bend: number, sunk: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  if (sunk > 0) { ctx.beginPath(); ctx.rect(-60, -60, 120, 60 - sunk * 40); ctx.clip(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, bend, 26, 0); ctx.stroke();
  ctx.strokeStyle = '#8d99ae'; ctx.lineWidth = 8; ctx.stroke();
  for (const x of [-30, 30]) { ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x - 9, -20, 18, 40, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x - 6, -16, 4, 32); }
  ctx.restore();
}

/** The gauge on the cuff. */
function drawCuff(ctx: CanvasRenderingContext2D, at: Point, k: number, time: number): void {
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
  ctx.restore();
}

export interface CurlerView { head: Point; hand: Point }

export function drawCurler(ctx: CanvasRenderingContext2D, c: Curler): CurlerView {
  const t = c.time;
  const curl = clamp(c.curl.x, -0.1, 1.15);
  const strain = c.mode === 'curling' && !c.burst ? c.tension : 0;
  const tremble = Math.sin(t * 43) * 2.5 * strain * strain;
  ctx.save();
  ctx.translate(tremble, 0);
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
  // Far arm hanging with its own dumbbell.
  limb(ctx, { x: SHOULDER.x - 16, y: SHOULDER.y + 6 }, { x: 428, y: 360 }, 16, GRAY_SHADE);
  drawDumbbell(ctx, { x: 428, y: 372 }, 0.1, 0, 0);
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
  const angle = mix(Math.PI / 2, -Math.PI / 2.4, curl);
  const forearm = 74;
  const hand = c.burst ? { x: ELBOW.x + 10, y: ELBOW.y + 60 } : { x: ELBOW.x + Math.cos(angle) * forearm, y: ELBOW.y + Math.sin(angle) * forearm };
  const noodle = clamp(c.noodle.x, 0, 1);
  if (noodle > 0.02) {
    // A limp noodle from the shoulder, wobbling.
    ctx.strokeStyle = INK; ctx.lineWidth = 19; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(SHOULDER.x, SHOULDER.y);
    for (let i = 1; i <= 8; i += 1) ctx.lineTo(SHOULDER.x + 10 + Math.sin(t * 3 + i) * 10 * noodle, SHOULDER.y + i * 22 * noodle);
    ctx.stroke(); ctx.strokeStyle = GRAY; ctx.lineWidth = 14; ctx.stroke();
  } else {
    limb(ctx, SHOULDER, ELBOW, 22, GRAY);
    // The bicep: gray going red, veins with the load, a synthol sheen.
    const red = clamp(c.stretch, 0, 1);
    ctx.save();
    ctx.translate(g.centre.x, g.centre.y);
    const fill = ctx.createRadialGradient(-g.rx * 0.3, -g.ry * 0.3, 2, 0, 0, Math.max(g.rx, g.ry) * 1.3);
    fill.addColorStop(0, `rgb(${Math.round(mix(235, 255, red))}, ${Math.round(mix(235, 200, red))}, ${Math.round(mix(235, 195, red))})`);
    fill.addColorStop(1, `rgb(${Math.round(mix(160, 200, red))}, ${Math.round(mix(160, 70, red))}, ${Math.round(mix(160, 70, red))})`);
    ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, g.rx, g.ry, -0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const veins = Math.floor(clamp(c.tension, 0, 1) * 6);
    ctx.strokeStyle = `rgba(90, 40, 120, ${0.4 + 0.5 * c.tension})`; ctx.lineWidth = 1.5 + 2 * c.tension; ctx.lineCap = 'round';
    for (let i = 0; i < veins; i += 1) {
      const a0 = i * 1.1 - 0.4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a0) * g.rx * 0.2, Math.sin(a0) * g.ry * 0.2);
      for (let s = 1; s <= 4; s += 1) ctx.lineTo(Math.cos(a0 + (noise(i * 3 + s) - 0.5) * 0.8) * g.rx * 0.22 * s, Math.sin(a0 + (noise(i * 5 + s) - 0.5) * 0.8) * g.ry * 0.22 * s);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.5 * c.stretch})`;
    ctx.beginPath(); ctx.ellipse(-g.rx * 0.38, -g.ry * 0.42, g.rx * 0.18, g.ry * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (c.sleeve) { ctx.fillStyle = TEE; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(SHOULDER.x - 16, SHOULDER.y - 12); ctx.lineTo(SHOULDER.x + 22 + g.r * 0.4, SHOULDER.y + 4); ctx.lineTo(SHOULDER.x + 14 + g.r * 0.4, SHOULDER.y + 34); ctx.lineTo(SHOULDER.x - 20, SHOULDER.y + 26); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    drawCuff(ctx, { x: ELBOW.x - 6, y: ELBOW.y - 22 }, 1 - Math.exp(-Math.log2(1 + (g.r - 16) / 20)), t);
    limb(ctx, ELBOW, hand, 18, GRAY);
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 12, 0, Math.PI * 2); ctx.fillStyle = GRAY; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  }
  // The dumbbell: in the hand, dropped on the floor, or through it.
  const d = c.dumbbell;
  if (d.dropped) {
    if (d.x === 0) { d.x = hand.x; }
    const floorY = FEET_Y - 10;
    if (d.sunk > 0) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(d.x, floorY + 8, 44, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
    else if (d.y >= 0) { ctx.strokeStyle = 'rgba(28, 31, 38, 0.6)'; ctx.lineWidth = 2; for (const [dx, dy] of [[-40, 6], [44, 4], [-20, 14], [30, 16]] as const) { ctx.beginPath(); ctx.moveTo(d.x, floorY + 6); ctx.lineTo(d.x + dx, floorY + dy); ctx.stroke(); } }
    drawDumbbell(ctx, { x: d.x, y: Math.min(floorY, floorY + d.y) + d.sunk * 30 }, d.sunk > 0 ? 0 : 0.05, 0, d.sunk);
  } else if (noodle < 0.02) {
    drawDumbbell(ctx, hand, angle + Math.PI / 2 - Math.PI / 2, 10 * strain * Math.sin(t * 20 + 1) * 0.5 + 8 * strain, 0);
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
