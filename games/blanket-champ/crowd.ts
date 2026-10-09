import { solveLimb, stepFoot } from './kinematics';
/**
 * The crowd: three bleacher rows of Wojak fans with foam fingers and signs,
 * a commentary booth, a bookie with his live odds board on the wall, and your
 * supporter in the front row. The crowd bobs harder as the tempo rises, does
 * the wave at milestones, and at the finish either cheers or puts its heads
 * in its hands. The odds shorten with the multiplier and every line it passes
 * flips to VOID; the rest pay at the finish. An accepted exit walks your
 * supporter to the bookie for the bag, the shades and a burst of confetti,
 * and the next round walks him back to his seat. Only a player with a stake
 * gets the gold shirt and the YOU tag; a spectator sees an ordinary fan.
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

const INK = '#1c1f26';
const SIGNS = ['LONG ONLY', 'HARD CAP', "DON'T PULL OUT EARLY", 'BLOW-OFF TOP', 'GM CHAMP', 'DEEP LIQUIDITY', 'UP ONLY', 'NO SOFT RUGS', 'SOLD A KIDNEY', 'WIFE IS SHORT', 'NGMI (HIM)', 'PUMP THEN DUMP'];
const ROWS = [{ y: 262, scale: 1, count: 12 }, { y: 218, scale: 0.86, count: 13 }, { y: 180, scale: 0.74, count: 14 }];
export const SUPPORTER = { row: 0, index: 5 };
const BOOKIE_X = 904;
/** The odds board on the wall under the booth, above the bookie's head, and the lines it takes. */
export const ODDS = { x: 872, y: 112, w: 82, h: 78 };
const LINES = [2, 5, 10, 20];
const CONFETTI = 36;
/** Your supporter's top walking speed (px/s) and how hard he brakes (px/s²). */
const WALK = 190;
const BRAKE = 420;

export type SupporterMode = 'seated' | 'walking' | 'collecting' | 'done' | 'returning';
export interface Confetti { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour: string; spin: number }

export interface CrowdState {
  time: number;
  /** The bob's running phase: its rate follows the cheer, so it is integrated rather than read off the clock. */
  bob: number;
  cheer: number;
  wave: number;
  waveAt: number;
  /** How the crowd took the finish, until the next round: the springs follow it in and back out. */
  verdict: 'cheer' | 'sulk' | null;
  sulk: Spring;
  hype: Spring;
  /** `stand` 0 seated, 1 up; `v` his walking speed; `bag` how much of the bag is in his hand. */
  supporter: { mode: SupporterMode; x: number; v: number; stand: Spring; modeAge: number; shades: Spring; ticket: boolean; bag: number };
  /** The YOU tag over your supporter, shown only to a player with a stake, and what it last said so it can shrink away. */
  tag: Spring;
  tagText: string;
  bookiePop: Spring;
  /** The board: which lines the number has passed, a bounce per row as it flips, and whether the rest have paid. */
  odds: { voided: boolean[]; flips: Spring[]; paid: boolean };
  confetti: Confetti[];
  events: { collected: boolean; wave: boolean };
}

const seated = (x: number) => ({ mode: 'seated' as SupporterMode, x, v: 0, stand: spring(0), modeAge: 0, shades: spring(0), ticket: true, bag: 0 });

export function createCrowd(): CrowdState {
  return { time: 0, bob: 0, cheer: 0, wave: -1, waveAt: 0, verdict: null, sulk: spring(0), hype: spring(0), supporter: seated(SEAT_X), tag: spring(0), tagText: '', bookiePop: spring(0), odds: { voided: LINES.map(() => false), flips: LINES.map(() => spring(0)), paid: false }, confetti: [], events: { collected: false, wave: false } };
}

function fanX(row: number, index: number): number {
  const r = ROWS[row]!;
  return 90 + (index + 0.5) * (780 / r.count);
}

const SEAT_X = fanX(SUPPORTER.row, SUPPORTER.index);
const TILL_X = BOOKIE_X - 40;

/** A new round. With `soft` (between rounds) the fans lift their heads and your supporter walks back to his seat. */
export function resetCrowd(c: CrowdState, soft = false): void {
  c.wave = -1;
  c.verdict = null;
  if (!soft) {
    settleSpring(c.sulk, 0);
    settleSpring(c.hype, 0);
  }
  const s = c.supporter;
  if (!soft || s.mode === 'seated') c.supporter = seated(SEAT_X);
  else { s.mode = 'returning'; s.modeAge = 0; s.ticket = true; }
  settleSpring(c.bookiePop, 0);
  c.odds = { voided: LINES.map(() => false), flips: LINES.map(() => spring(0)), paid: false };
  if (!soft) c.confetti = [];
}

/** The exit was accepted: go and collect, from the seat or from wherever the walk back has got to. */
export function collectWinnings(c: CrowdState): void {
  if (c.supporter.mode === 'seated' || c.supporter.mode === 'returning') { c.supporter.mode = 'walking'; c.supporter.modeAge = 0; }
}

/** How loud the crowd is heading for: with the tension while the round runs, murmuring otherwise. */
const cheerFor = (tension: number, running: boolean): number => (running ? 0.2 + 0.8 * tension : 0.05);

/** The bookie's price on the champ finishing before `line` with the number at `multiplier`: shortens toward evens as it nears. */
const oddsFor = (line: number, multiplier: number): number => Math.max(1.01, 1 + 1.4 * (line / multiplier - 1));

/** Puts the crowd where a round met late leaves it: at the round's pitch, the board at the number, and your supporter already paid if you cashed out. */
export function settleCrowd(c: CrowdState, tension: number, multiplier: number, running: boolean, secured: boolean): void {
  c.cheer = cheerFor(tension, running);
  c.odds.voided = LINES.map((line) => multiplier >= line);
  if (secured) c.supporter = { mode: 'done', x: TILL_X, v: 0, stand: spring(1), modeAge: 0, shades: spring(1), ticket: true, bag: 1 };
}

/** The champ finished: the lines he never reached pay out. */
export function finishCrowd(c: CrowdState, cheerful: boolean, quiet: boolean): void {
  c.verdict = cheerful ? 'cheer' : 'sulk';
  const mood = cheerful ? c.hype : c.sulk;
  if (quiet) settleSpring(mood, 1);
  else mood.v += cheerful ? 12 : 10;
  c.supporter.ticket = false;
  c.odds.paid = true;
  if (!quiet) for (const [i, flip] of c.odds.flips.entries()) if (!c.odds.voided[i]) flip.v += 14;
}

function celebrate(c: CrowdState, x: number, y: number): void {
  for (let i = 0; i < CONFETTI; i += 1) {
    const n = i * 3.1 + c.time;
    c.confetti.push({ x, y, vx: (noise(n) - 0.5) * 320, vy: -160 - noise(n + 1) * 220, r: 2 + noise(n + 2) * 3, age: 0, life: 1.1 + noise(n + 3) * 0.7, colour: ['#7cf67c', '#ffe27a', '#ff5d9e', '#8fd3ff'][i % 4]!, spin: noise(n + 4) * 6 });
  }
}

/** `stake` is the viewer's stake this round, or null for a spectator: it puts the YOU tag over the supporter. */
export function stepCrowd(c: CrowdState, tension: number, multiplier: number, stake: number | null, running: boolean, dt: number): void {
  c.time += dt;
  c.events = { collected: false, wave: false };
  c.cheer += (cheerFor(tension, running) - c.cheer) * (1 - Math.exp(-dt / 0.8));
  c.bob += dt * (4 + 6 * c.cheer);
  if (running && multiplier >= 3 && c.time > c.waveAt && c.wave < 0) { c.wave = 0; c.waveAt = c.time + 9; c.events.wave = true; }
  if (c.wave >= 0) { c.wave += dt / 1.6; if (c.wave > 1.3) c.wave = -1; }
  stepSpring(c.sulk, c.verdict === 'sulk' ? 1 : 0, 6, 0.7, dt);
  stepSpring(c.hype, c.verdict === 'cheer' ? 1 : 0, 6, 0.7, dt);
  if (stake !== null) c.tagText = `YOU · ${stake}`;
  stepSpring(c.tag, stake !== null ? 1 : 0, 12, 0.45, dt);
  const s = c.supporter;
  s.modeAge += dt;
  // He stands up (0.25 s), then eases into his walk and brakes to a stop at the bookie, or back at his seat.
  stepSpring(s.stand, s.mode === 'seated' ? 0 : 1, 16, 0.8, dt);
  if (s.mode === 'walking' || s.mode === 'returning') {
    const goal = s.mode === 'walking' ? TILL_X : SEAT_X;
    const dir = goal >= s.x ? 1 : -1;
    const want = s.stand.x > 0.85 ? dir * Math.min(WALK, Math.sqrt(2 * BRAKE * Math.abs(goal - s.x))) : 0;
    // He eases into his stride; braking follows the stopping curve itself, so he slows right down before he stops.
    s.v = want * s.v > 0 && Math.abs(want) < Math.abs(s.v) ? want : s.v + (want - s.v) * (1 - Math.exp(-dt / 0.12));
    s.x += s.v * dt;
    if ((goal - s.x) * dir <= 0.5) {
      s.x = goal;
      s.v = 0;
      s.modeAge = 0;
      if (s.mode === 'returning') s.mode = 'seated';
      else {
        s.mode = 'collecting';
        c.bookiePop.v += 10;
        c.events.collected = true;
        celebrate(c, BOOKIE_X - 34, ROWS[0]!.y - 50);
      }
    }
  } else if (s.mode === 'collecting') {
    if (s.modeAge > 0.8) { s.mode = 'done'; s.modeAge = 0; }
  }
  // The shades go on once the bag is in hand and come off for the next round; a bag he collected goes home with him.
  stepSpring(s.shades, s.mode === 'done' ? 1 : 0, 12, 0.5, dt);
  s.bag = s.mode === 'collecting' || s.mode === 'done' ? 1 : s.mode === 'returning' ? s.bag : Math.max(0, s.bag - dt / 0.3);
  stepSpring(c.bookiePop, 0, 8, 0.5, dt);
  // The board: a line the number passes flips to VOID with a bounce.
  for (const [i, line] of LINES.entries()) {
    if (running && multiplier >= line && !c.odds.voided[i]) { c.odds.voided[i] = true; c.odds.flips[i]!.v += 14; }
    stepSpring(c.odds.flips[i]!, 0, 10, 0.4, dt);
  }
  for (const p of c.confetti) {
    p.age += dt;
    p.vy += 420 * dt;
    p.vx *= Math.exp(-1.5 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  c.confetti = c.confetti.filter((p) => p.age < p.life);
}

/** A standing fan's legs: `walk` is the distance walked (it sets the stride) and `stand` how far he has got up. */
type Legs = { walk: number; stand: number; dir: number };

function drawFan(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, seed: number, bob: number, mood: 'calm' | 'hype' | 'shock', prop: 'finger' | 'sign' | 'none', signText: string, special: boolean, shades: number, legs: Legs | null = null, sulk = 0): void {
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (legs && legs.stand > 0.05) {
    // The feet stay on the bench as he rises; the legs straighten under him and fade in as they clear the seat.
    ctx.save();
    ctx.globalAlpha = smoothstep(0.05, 0.6, legs.stand);
    for (const side of [-1, 1]) {
      const step = stepFoot(legs.walk, 46, side > 0 ? .5 : 0, 9);
      const hip = { x: side * 8, y: -3 }, foot = { x: side * 9 + step.x, y: 19 + 12 * legs.stand + step.y };
      const knee = solveLimb(hip, foot, 22, 21, -side).joint;
      ctx.strokeStyle = '#314965'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
      ctx.fillStyle = '#1c1f26'; ctx.beginPath(); ctx.ellipse(foot.x + 3 * legs.dir, foot.y, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  const tone = noise(seed * 3.3);
  const skin = tone > 0.66 ? '#f3dccb' : tone > 0.33 ? '#e0bda7' : '#c68e6a';
  const shirt = special ? '#ffe27a' : ['#e63946', '#3b82f6', '#2e8b57', '#7c3aed', '#f2c14e'][Math.floor(noise(seed * 7.1) * 5)]!;
  if (prop === 'finger') {
    const fy = -70 - (mood === 'hype' ? 10 : 0);
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(18, -30); ctx.lineTo(22, fy + 10); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ff5d9e'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(12, fy - 6, 20, 24, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(18, fy - 22, 8, 20, 4); ctx.fill(); ctx.stroke();
  } else if (prop === 'sign') {
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(-14, -66); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-52, -92, 76, 28, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 10px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(signText, -14, -74, 70);
  }
  ctx.fillStyle = shirt; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-18, -30, 36, 30, 8); ctx.fill(); ctx.stroke();
  // Head in hands: the head (with its face and hat) sinks, and the forearms come up from the shoulders to the face.
  sulk = clamp(sulk, 0, 1);
  ctx.save();
  ctx.translate(0, sulk * 10);
  ctx.beginPath(); ctx.ellipse(0, -44, 14, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
  if (sulk < 0.6) {
    ctx.fillStyle = INK;
    const open = mood === 'shock' ? 1.6 : 1;
    for (const ex of [-5, 5]) { ctx.beginPath(); ctx.ellipse(ex, -47, 2, 2 * open, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (mood === 'hype') { ctx.ellipse(0, -36, 5, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else if (mood === 'shock') { ctx.ellipse(0, -35, 4, 5, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else { ctx.moveTo(-5, -37); ctx.quadraticCurveTo(0, -33, 5, -37); }
    ctx.stroke();
    if (shades > 0.02) {
      const dy = -30 * (1 - shades);
      ctx.fillStyle = INK;
      ctx.fillRect(-10, -50 + dy, 8, 5);
      ctx.fillRect(2, -50 + dy, 8, 5);
      ctx.fillRect(-2, -49 + dy, 4, 2);
    }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
  const hat = Math.floor(noise(seed * 11.3) * 3);
  if (hat === 1) { ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.roundRect(-14, -66, 28, 10, 4); ctx.fill(); ctx.stroke(); ctx.fillRect(4, -60, 18, 4); }
  if (hat === 2) { ctx.fillStyle = '#ff7ab8'; ctx.beginPath(); ctx.arc(0, -58, 14, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -72, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  if (sulk > 0.02) {
    const hx = mix(16, 8, sulk), hy = mix(-28, -46, sulk);
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-16, -28); ctx.lineTo(-hx, hy); ctx.moveTo(16, -28); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 4; ctx.stroke();
  }
  ctx.restore();
}

export function drawBleachers(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#4a5560';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const [i, r] of ROWS.entries()) {
    ctx.beginPath(); ctx.roundRect(70 - i * 6, r.y - 2, 820 + i * 12, 30, 3); ctx.fill(); ctx.stroke();
  }
}

/** The bookie's board on the wall: a price per line that shortens with the number, VOID once passed, PAID at the finish. */
export function drawOddsBoard(ctx: CanvasRenderingContext2D, c: CrowdState, multiplier: number, running: boolean, finished: boolean): void {
  const { x, y, w } = ODDS;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, ODDS.h, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = finished ? '#e63946' : '#ffe27a';
  ctx.beginPath(); ctx.roundRect(x + 3, y + 3, w - 6, 13, 2); ctx.fill();
  ctx.fillStyle = finished ? '#ffffff' : INK;
  ctx.font = '900 10px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(finished ? 'SETTLED' : running ? 'LIVE ODDS' : 'FINISH BEFORE', x + w / 2, y + 10, w - 8);
  for (const [i, line] of LINES.entries()) {
    const ry = y + 26 + i * 15;
    const voided = c.odds.voided[i] === true;
    const paid = c.odds.paid && !voided;
    const k = 1 + 0.35 * clamp(c.odds.flips[i]!.x, 0, 1.5);
    ctx.save();
    ctx.translate(x + w / 2, ry);
    ctx.scale(k, k);
    ctx.fillStyle = '#e7f4f0';
    ctx.textAlign = 'left';
    ctx.fillText(`<${line}×`, -w / 2 + 6, 0);
    ctx.textAlign = 'right';
    ctx.fillStyle = voided ? '#ff4d6d' : paid ? '#7cf67c' : '#ffe27a';
    const price = oddsFor(line, running || finished ? multiplier : 1);
    ctx.fillText(voided ? 'VOID' : paid ? 'PAID' : price < 10 ? price.toFixed(2) : price.toFixed(1), w / 2 - 6, 0);
    ctx.restore();
  }
  ctx.restore();
}

/** The cash-out confetti, in front of the crowd. */
export function drawConfetti(ctx: CanvasRenderingContext2D, c: CrowdState): void {
  for (const p of c.confetti) {
    ctx.globalAlpha = clamp(1.5 * (1 - p.age / p.life), 0, 1);
    ctx.fillStyle = p.colour;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin + p.age * 5);
    ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** The YOU tag: a gold pill pointing down at your supporter; at the bookie it slides left of the odds board. */
function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, k: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.font = '900 13px Impact, "Arial Black", sans-serif';
  const w = ctx.measureText(text).width + 14;
  const shift = Math.min(0, ODDS.x - 6 - (x + w / 2));
  ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(0, 4); ctx.lineTo(6, -4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(shift - w / 2, -23, w, 20, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, shift, -12.5);
  ctx.restore();
}

/** Only a player's supporter wears gold and the YOU tag; they go with the tag, as a stake comes and goes. */
export function drawCrowd(ctx: CanvasRenderingContext2D, c: CrowdState, finished: boolean, cheerful: boolean): void {
  const s = c.supporter;
  const up = s.mode !== 'seated' || s.stand.x > 0.02;
  const tag = clamp(c.tag.x, 0, 1.2);
  const mine = tag > 0.5;
  const sulk = clamp(c.sulk.x, 0, 1);
  const mood = c.hype.x > 0.5 ? 'hype' : finished && !cheerful ? 'shock' : c.cheer > 0.7 ? 'hype' : 'calm';
  let seatBob = 0;
  for (let row = ROWS.length - 1; row >= 0; row -= 1) {
    const r = ROWS[row]!;
    for (let i = 0; i < r.count; i += 1) {
      const seed = row * 100 + i;
      const isSupporter = row === SUPPORTER.row && i === SUPPORTER.index;
      let bob = Math.max(0, Math.sin(c.bob + i * 0.7 + row)) * 8 * c.cheer;
      if (c.wave >= 0) {
        const at = c.wave * 1.3;
        const d = Math.abs(i / r.count - at);
        bob += Math.max(0, 1 - d / 0.12) * 26;
      }
      if (c.hype.x > 0.05) bob += Math.max(0, Math.sin(c.time * 10 + i)) * 16 * c.hype.x;
      if (isSupporter) { seatBob = bob; if (up) continue; }
      const propRoll = noise(seed * 5.7);
      const prop = propRoll > 0.72 ? 'sign' : propRoll > 0.4 ? 'finger' : 'none';
      drawFan(ctx, fanX(row, i), r.y, r.scale, seed, bob, mood, isSupporter ? 'finger' : prop, SIGNS[Math.floor(noise(seed * 2.1) * SIGNS.length)]!, isSupporter && mine, isSupporter ? clamp(s.shades.x, 0, 1) : 0, null, sulk);
    }
  }
  // Your supporter up on his feet: he stands, walks the front row to the bookie, and walks back for the next round.
  const stand = clamp(s.stand.x, 0, 1.1);
  const y = ROWS[0]!.y - 12 * stand - seatBob * Math.max(0, 1 - stand);
  // He keeps his gold shirt on the walk back to his seat, even before the next stake is placed.
  if (up) drawFan(ctx, s.x, y, 1, 5, 0, s.mode === 'done' ? 'hype' : mood, 'finger', '', mine || s.mode !== 'seated', clamp(s.shades.x, 0, 1), { walk: s.x - SEAT_X, stand, dir: s.v < -1 ? -1 : 1 }, s.mode === 'seated' ? sulk : 0);
  if (tag > 0.02) drawTag(ctx, s.x - 2, y - 80, c.tagText, tag);
  // The bookie with the BETS sign and the bag he hands over, which your supporter carries back to his seat.
  ctx.save();
  ctx.translate(BOOKIE_X, ROWS[0]!.y);
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-30, -20, 60, 44, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BETS', 0, 6);
  ctx.restore();
  drawFan(ctx, BOOKIE_X, ROWS[0]!.y - 12, 0.95, 77, 0, 'calm', 'none', '', false, 1);
  const pop = clamp(c.bookiePop.x, 0, 1.2);
  if (s.bag > 0.01) {
    ctx.save();
    ctx.globalAlpha = s.bag;
    ctx.translate(s.x + 6, y - 28 - pop * 10);
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-16, 22, 0, 26); ctx.quadraticCurveTo(16, 22, 10, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c';
    ctx.font = '900 12px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 18);
    ctx.restore();
  }
}

/** Two commentators in a booth with a LIVE light and a rolling caption. */
export function drawBooth(ctx: CanvasRenderingContext2D, c: CrowdState, line: string): void {
  ctx.save();
  ctx.translate(770, 18);
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(0, 0, 180, 92, 6); ctx.fill(); ctx.stroke();
  for (const [x, seed] of [[50, 31], [130, 47]] as const) {
    drawFan(ctx, x, 78, 0.62, seed, 0, c.cheer > 0.6 ? 'hype' : 'calm', 'none', '', false, 0);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, 50, 10, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 10, 50); ctx.lineTo(x - 6, 58); ctx.stroke();
  }
  // The caption strip sits in front of the desk, so the commentators end at the desk edge.
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(8, 58, 164, 26, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = Math.floor(c.time * 2) % 2 ? '#e63946' : '#7a1a24';
  ctx.beginPath(); ctx.arc(20, 14, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LIVE', 30, 18);
  ctx.fillStyle = '#ffe27a';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(line, 90, 75, 156);
  ctx.restore();
}
