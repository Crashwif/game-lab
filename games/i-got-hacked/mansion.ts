/**
 * The mansion: a sunset sky over the bay, the yacht that grows with the
 * multiplier, the house with its balcony, the fictional star in a bathrobe
 * typing the launch post on a gold phone, the manager who whispers, the
 * assistant packing bags behind the curtains, the PR crisis team at the
 * gate, and the phone close-up whose draft reads "i got hacked". The star
 * is a generic cartoon with no likeness of anyone. Nothing here changes
 * the outcome.
 */
import { type Spring, clamp, gust, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const STAGE = { w: 960, h: 540 } as const;
export const HORIZON = 210;
export type Point = { x: number; y: number };
const MEME_FONT = 'Impact, "Arial Black", sans-serif';

interface Gull { x: number; y: number; phase: number; speed: number }
interface Wake { x: number; y: number; age: number; life: number; size: number }

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
  posted: boolean;
  endAge: number;
  ended: boolean;
  blinkAt: number;
  eyeOpen: Spring;
  gulls: Gull[];
  wakes: Wake[];
  smoke: number;
}

export function createMansion(): Mansion {
  const gulls: Gull[] = [];
  for (let i = 0; i < 4; i += 1) gulls.push({ x: 520 + i * 110, y: 60 + noise(i * 3.7) * 70, phase: noise(i) * 6, speed: 14 + noise(i * 2.2) * 10 });
  return { time: 0, typing: spring(0), wave: spring(0), shrug: spring(0), glance: spring(0), whisper: spring(0), whisperAt: 1.5, whisperOn: false, yachtSize: spring(0.4), yachtX: spring(800), engine: spring(0), packing: spring(0), prTeam: spring(0), draft: spring(0), chart: [], posted: false, endAge: 0, ended: false, blinkAt: 2, eyeOpen: spring(1), gulls, wakes: [], smoke: 0 };
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
  m.posted = false;
  m.endAge = 0;
  m.ended = false;
  m.wakes = [];
  m.smoke = 0;
}

/** Jumps the slow springs to where a multiplier already is, for a round joined late. */
export function settleMansion(m: Mansion, tension: number, multiplier: number): void {
  settleSpring(m.yachtSize, 0.4 + 0.6 * Math.min(1, Math.log2(multiplier) / 4));
  settleSpring(m.packing, tension > 0.5 ? 1 : 0);
  settleSpring(m.prTeam, tension > 0.7 ? 1 : 0);
  settleSpring(m.draft, tension > 0.6 ? 1 : 0);
}

/** A milestone: a wave to the fans, a burst of typing. */
export function celebrate(m: Mansion, index: number): void {
  if (index % 2) m.wave.v += 12; else m.typing.v += 14;
  m.glance.v += 3;
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
  if (quiet) { settleSpring(m.yachtX, 1100); settleSpring(m.shrug, 1); settleSpring(m.draft, 1); settleSpring(m.engine, 1); return; }
  m.shrug.v += 8;
  settleSpring(m.engine, 1);
}

export interface MansionDrive { running: boolean; tension: number; multiplier: number; reduced: boolean }

export function stepMansion(m: Mansion, drive: MansionDrive, dt: number): void {
  m.time += dt;
  stepSpring(m.typing, drive.running && !m.ended ? 0.4 + 0.6 * drive.tension : 0, 9, 0.5, dt);
  stepSpring(m.wave, 0, 6, 0.5, dt);
  stepSpring(m.shrug, m.ended && m.endAge < 3 ? 1 : 0, 7, 0.6, dt);
  // The manager whispers in bursts that come faster with the tension.
  if (drive.running && !m.ended && m.time > m.whisperAt) {
    m.whisperOn = !m.whisperOn;
    m.whisperAt = m.time + (m.whisperOn ? 0.6 + 0.8 * (1 - drive.tension) : (2.5 - 2.2 * drive.tension) * (0.7 + noise(m.time) * 0.6));
  }
  if (!drive.running || m.ended) m.whisperOn = false;
  stepSpring(m.whisper, m.whisperOn ? 1 : 0, 10, 0.7, dt);
  stepSpring(m.glance, m.ended ? 0 : m.whisperOn ? 1 : 0, 8, 0.8, dt);
  const yachtTarget = m.ended ? m.yachtSize.x : 0.4 + 0.6 * Math.min(1, Math.log2(Math.max(1, drive.multiplier)) / 4);
  stepSpring(m.yachtSize, yachtTarget, 2.5, 1, dt);
  stepSpring(m.engine, m.ended ? 1 : drive.running && drive.tension > 0.65 ? 1 : 0, 3, 0.9, dt);
  stepSpring(m.packing, m.ended ? 1 : drive.running && drive.tension > 0.5 ? 1 : 0, 3, 0.9, dt);
  stepSpring(m.prTeam, m.ended ? 1 : drive.running && drive.tension > 0.72 ? 1 : 0, 2.5, 0.9, dt);
  stepSpring(m.draft, m.ended ? 1 : drive.running && drive.tension > 0.58 ? 1 : 0, 4, 0.8, dt);
  const blinking = m.time > m.blinkAt && m.time < m.blinkAt + 0.12;
  if (m.time >= m.blinkAt + 0.12) m.blinkAt = m.time + 2 + 3 * noise(m.blinkAt);
  stepSpring(m.eyeOpen, blinking ? 0.08 : 1, 24, 0.9, dt);
  // The chart on the phone.
  if (drive.running && !m.ended) {
    if (m.chart.length === 0 || m.time - (m.chart.length * 0.15) > 0) m.chart.push(Math.max(1, drive.multiplier));
    if (m.chart.length > 60) m.chart.shift();
  }
  if (m.ended) {
    m.endAge += dt;
    stepSpring(m.yachtX, 1150, 1.2, 0.95, dt);
    if (m.endAge < 4 && !drive.reduced && noise(Math.floor(m.time * 10)) > 0.4) m.wakes.push({ x: m.yachtX.x - 70 * m.yachtSize.x, y: HORIZON + 26, age: 0, life: 1.6, size: 4 + noise(m.time * 3) * 5 });
  } else if (m.engine.x > 0.5 && !drive.reduced && noise(Math.floor(m.time * 8)) > 0.6) {
    m.wakes.push({ x: m.yachtX.x - 60 * m.yachtSize.x, y: HORIZON + 24, age: 0, life: 1.2, size: 3 + noise(m.time * 5) * 3 });
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
  const bob = Math.sin(m.time * 1.3) * 3 + (m.engine.x > 0.5 ? Math.sin(m.time * 9) * 1.5 * m.engine.x : 0);
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

/** The manager beside the star, leaning in to whisper. */
function drawManager(ctx: CanvasRenderingContext2D, m: Mansion, x: number, footY: number, tension: number): void {
  const lean = clamp(m.whisper.x, 0, 1);
  ctx.save();
  ctx.translate(x, footY);
  ctx.rotate(-0.25 * lean);
  ctx.lineJoin = 'round';
  const suit = '#2b2b30';
  for (const side of [-1, 1]) {
    const plant = side > 0 ? lean * 16 : -lean * 6;
    limb(ctx, { x: side * 9, y: -74 }, { x: side * 12 + plant, y: 0 }, 42, 38, -side, 13, suit);
    ctx.fillStyle = '#111114'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(side * 12 + plant, 3, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = suit; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-28, -130, 56, 64, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-8, -130); ctx.lineTo(8, -130); ctx.lineTo(0, -96); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(-3, -128); ctx.lineTo(3, -128); ctx.lineTo(1, -100); ctx.lineTo(-1, -100); ctx.closePath(); ctx.fill();
  const whisperHand = { x: mix(36, -8, lean), y: mix(-68, -152, lean) };
  limb(ctx, { x: 26, y: -120 }, whisperHand, 36, 34, whisperHand.y >= -120 ? -1 : 1, 12, suit);
  const phoneHand = { x: -42 + Math.sin(m.time * 1.6) * 3, y: -66 };
  limb(ctx, { x: -26, y: -120 }, phoneHand, 34, 32, phoneHand.y >= -120 ? 1 : -1, 12, suit);
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
    const lines = ['sell before they do', 'the yacht is fuelled', 'say you got hacked', 'PR is on the way', 'one more post then we go'];
    const text = lines[Math.floor(noise(Math.floor(m.whisperAt * 7)) * lines.length)]!;
    ctx.save();
    ctx.globalAlpha = smoothstep(0.5, 0.9, lean);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(x - 150, footY - 232, 160, 26, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 30, footY - 206); ctx.lineTo(x - 22, footY - 196); ctx.lineTo(x - 14, footY - 206); ctx.closePath(); ctx.fill(); ctx.stroke();
    label(ctx, `psst: ${text}`, x - 70, footY - 214, 11, INK, 'center', 150);
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
  limb(ctx, { x: -50, y: -126 }, phoneHand, 34, 30, phoneHand.y >= -126 ? 1 : -1, 15, robe);
  const freeHand = shrug > 0.3 ? { x: 62, y: -128 - shrug * 10 } : wave > 0.2 ? { x: 74, y: -176 - Math.sin(m.time * 11) * 12 * wave } : { x: 64, y: -78 };
  limb(ctx, { x: 50, y: -126 }, freeHand, 36, 32, freeHand.y >= -126 ? -1 : 1, 15, robe);
  ctx.fillStyle = '#e0bda7'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(freeHand.x, freeHand.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(phoneHand.x, phoneHand.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // The gold phone.
  ctx.save();
  ctx.translate(phoneHand.x + 8, phoneHand.y - 16);
  ctx.rotate(-0.35 + 0.05 * Math.sin(m.time * 20) * typing);
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
  // A bead of sweat at high tension.
  if (tension > 0.55 && shrug < 0.4) { ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.ellipse(40, hy - 20 + ((m.time * 30) % 24), 3, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

/** The house wall, curtains and the assistant packing, the balcony, the gate and the PR team. */
export function drawMansion(ctx: CanvasRenderingContext2D, m: Mansion, tension: number, reduced: boolean): void {
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
      const step = pr < 0.98 && !reduced ? m.time * 9 + i * 1.3 : i;
      ctx.save();
      ctx.translate(px, 290);
      ctx.scale(0.55, 0.55);
      ctx.fillStyle = '#2b2b30'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      for (const side of [-1, 1]) {
        const phase = step + (side > 0 ? Math.PI : 0);
        const lift = pr < 0.98 && !reduced ? Math.max(0, Math.sin(phase)) * 14 : 0;
        const reach = pr < 0.98 && !reduced ? Math.cos(phase) * 10 : 0;
        limb(ctx, { x: side * 8, y: -64 }, { x: side * 10 + reach, y: -lift }, 36, 34, -side, 12, '#2b2b30');
      }
      ctx.beginPath(); ctx.roundRect(-24, -120, 48, 62, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-6, -120); ctx.lineTo(6, -120); ctx.lineTo(0, -92); ctx.closePath(); ctx.fill();
      const swing = Math.sin(step) * 12;
      limb(ctx, { x: -20, y: -108 }, { x: -30 - swing, y: -68 }, 28, 26, 1, 10, '#2b2b30');
      const briefcase = { x: 34 + Math.sin(step - 0.5) * 10, y: -72 };
      limb(ctx, { x: 20, y: -108 }, briefcase, 28, 26, -1, 10, '#2b2b30');
      ctx.fillStyle = '#e0bda7'; ctx.beginPath(); ctx.arc(0, -142, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(-14, -148, 11, 6); ctx.fillRect(3, -148, 11, 6);
      ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(briefcase.x - 6, briefcase.y, 26, 34, 3); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = smoothstep(0.6, 1, pr);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(586, 214, 96, 20, 6); ctx.fill(); ctx.stroke();
    label(ctx, 'PR CRISIS TEAM', 634, 228, 10, INK, 'center');
    ctx.restore();
  }
}

/** The phone close-up in the lower left: the chart, the draft post, then the post itself. */
export function drawPhone(ctx: CanvasRenderingContext2D, m: Mansion, multiplier: number): void {
  const p = { x: 22, y: 318, w: 150, h: 204 };
  ctx.save();
  ctx.fillStyle = '#ffd35c'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#101218';
  ctx.beginPath(); ctx.roundRect(p.x + 8, p.y + 14, p.w - 16, p.h - 28, 10); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(p.x + 8, p.y + 14, p.w - 16, p.h - 28, 10); ctx.clip();
  // Header.
  ctx.fillStyle = '#1f2230'; ctx.fillRect(p.x + 8, p.y + 14, p.w - 16, 28);
  label(ctx, '$FAMOUS', p.x + 18, p.y + 33, 12, '#ffffff');
  label(ctx, `${multiplier.toFixed(2)}×`, p.x + p.w - 18, p.y + 33, 12, m.posted ? '#ff4d6d' : '#7cf67c', 'right');
  // The chart.
  const cx = p.x + 14; const cy = p.y + 52; const cw = p.w - 28; const ch = 56;
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
  // The post box.
  const draft = clamp(m.draft.x, 0, 1);
  ctx.fillStyle = '#1f2230';
  ctx.beginPath(); ctx.roundRect(p.x + 14, p.y + 118, p.w - 28, 56, 6); ctx.fill();
  ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(p.x + 26, p.y + 132, 7, 0, Math.PI * 2); ctx.fill();
  label(ctx, 'famous_official', p.x + 38, p.y + 136, 9, '#c9c9d4');
  if (m.posted) {
    label(ctx, 'i got hacked. that', p.x + 20, p.y + 152, 10, '#ffffff');
    label(ctx, 'coin was never me', p.x + 20, p.y + 165, 10, '#ffffff');
  } else if (draft > 0.05) {
    const text = 'i got hacked';
    const shown = text.slice(0, Math.floor(draft * text.length));
    label(ctx, 'draft:', p.x + 20, p.y + 152, 9, '#9a9aa8');
    label(ctx, `${shown}${Math.floor(m.time * 3) % 2 ? '|' : ''}`, p.x + 20, p.y + 166, 11, '#ff9db0');
  } else {
    label(ctx, 'new coin $FAMOUS', p.x + 20, p.y + 152, 10, '#ffffff');
    label(ctx, 'is LIVE. love u all', p.x + 20, p.y + 165, 10, '#ffffff');
  }
  // Post button.
  ctx.fillStyle = m.posted ? '#ff4d6d' : draft > 0.5 ? '#ffb36b' : '#3b82f6';
  ctx.beginPath(); ctx.roundRect(p.x + 14, p.y + 180, p.w - 28, 20, 10); ctx.fill();
  label(ctx, m.posted ? 'POSTED' : draft > 0.5 ? 'POST?' : 'POSTED', p.x + p.w / 2, p.y + 194, 10, '#ffffff', 'center');
  ctx.restore();
  // Camera notch.
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(p.x + p.w / 2 - 18, p.y + 6, 36, 6, 3); ctx.fill();
  ctx.restore();
}
