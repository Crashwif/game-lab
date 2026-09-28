/**
 * The coin is the token. It swells with the market cap, rolls with the
 * distance pushed, slides back a little on every bump, carries holders on
 * its rim who bail at milestones, collects a crown, a graduation cap and a
 * flag, and at the crash rolls back down the hill over everyone.
 */
import { type Spring, clamp, mulberry32, noise, settleSpring, spring, stepSpring } from './motion';
import { type Camera, type Point, heightAt, slopeAngle, toScreen } from './hill';

const INK = '#1c1f26';
const GOLD = '#f2c14e';
const GOLD_DARK = '#c4932a';
const GOLD_LIGHT = '#ffe08a';

export interface Clinger { angle: number; tone: number }
export interface Jeet { x: number; y: number; vx: number; vy: number; angle: number; spin: number; age: number; tone: number }
export interface Dust { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour: string }

export interface CoinDrive {
  /** Target world x of the contact point, and the radius the market cap calls for. */
  x: number;
  radius: number;
  growth: number;
  running: boolean;
}

export interface CoinState {
  time: number;
  x: number;
  radius: Spring;
  roll: number;
  back: Spring;
  wobble: Spring;
  bumpClock: number;
  clingers: Clinger[];
  jeets: Jeet[];
  /** How many of the JEET_AT milestones have lost their holder this round, so each bails once. */
  jeeted: number;
  dust: Dust[];
  crown: Spring;
  cap: Spring;
  flag: Spring;
  crashed: boolean;
  crashAge: number;
  crashSpeed: number;
  events: { bump: boolean; jeet: boolean; milestone: 'crown' | 'cap' | 'flag' | null };
  rng: () => number;
}

const MILESTONES: { at: number; key: 'crown' | 'cap' | 'flag' }[] = [{ at: 1.6, key: 'crown' }, { at: 4, key: 'cap' }, { at: 6, key: 'flag' }];
const JEET_AT = [1.5, 2.2, 3.5, 5, 8];

export function createCoin(): CoinState {
  return { time: 0, x: 0, radius: spring(40), roll: 0, back: spring(0), wobble: spring(0), bumpClock: 0, clingers: [], jeets: [], jeeted: 0, dust: [], crown: spring(0), cap: spring(0), flag: spring(0), crashed: false, crashAge: 0, crashSpeed: 0, events: { bump: false, jeet: false, milestone: null }, rng: mulberry32(7) };
}

export function resetCoin(c: CoinState): void {
  c.x = 0;
  settleSpring(c.radius, 40);
  c.roll = 0;
  settleSpring(c.back, 0);
  settleSpring(c.wobble, 0);
  c.clingers = [];
  c.jeets = [];
  c.jeeted = 0;
  c.dust = [];
  settleSpring(c.crown, 0);
  settleSpring(c.cap, 0);
  settleSpring(c.flag, 0);
  c.crashed = false;
  c.crashAge = 0;
  c.crashSpeed = 0;
}

/** Jumps to the state a late joiner would see. */
export function settleCoin(c: CoinState, drive: CoinDrive): void {
  resetCoin(c);
  c.x = drive.x;
  settleSpring(c.radius, drive.radius);
  const multiplier = Math.pow(2, drive.growth);
  for (const m of MILESTONES) if (multiplier >= m.at) settleSpring(c[m.key], 1);
  c.jeeted = JEET_AT.filter((j) => multiplier >= j).length;
  const count = Math.min(8, Math.floor(drive.growth * 3)) - c.jeeted;
  for (let i = 0; i < Math.max(0, count); i += 1) c.clingers.push({ angle: noise(i * 2.7) * Math.PI * 2, tone: noise(i * 5.1) });
}

/** The contact point on the hill, the centre above it, and the slope there. */
export function coinPose(c: CoinState): { contact: Point; centre: Point; angle: number; r: number } {
  const x = Math.max(0, c.x - c.back.x);
  const angle = slopeAngle(x);
  const r = c.radius.x;
  const contact = { x, y: heightAt(x) };
  return { contact, centre: { x: contact.x - Math.sin(angle) * r, y: contact.y + Math.cos(angle) * r }, angle, r };
}

function puff(c: CoinState, at: Point, count: number, colour = '#c8b78f', spread = 1): void {
  for (let i = 0; i < count; i += 1) {
    const n = c.time * 13 + i * 1.7;
    c.dust.push({ x: at.x + (noise(n) - 0.5) * 20, y: at.y + noise(n + 1) * 8, vx: -(20 + noise(n + 2) * 90) * spread, vy: (20 + noise(n + 3) * 70) * spread, r: 3 + noise(n + 4) * 5, age: 0, life: 0.6 + noise(n + 5) * 0.5, colour });
  }
}

export function stepCoin(c: CoinState, drive: CoinDrive, dt: number): void {
  c.time += dt;
  c.events = { bump: false, jeet: false, milestone: null };
  const before = c.x - c.back.x;
  const multiplier = Math.pow(2, drive.growth);
  const tension = clamp(drive.growth / 3.3, 0, 1);
  if (!c.crashed) {
    c.x += (drive.x - c.x) * (1 - Math.exp(-dt / 0.35));
    stepSpring(c.radius, drive.radius, 4, 1, dt);
    if (drive.running) {
      c.bumpClock += dt;
      const every = 2.6 - 1.6 * tension;
      if (c.bumpClock > every) {
        c.bumpClock = 0;
        c.back.v += 60 + 70 * tension;
        c.wobble.v += (c.rng() - 0.5) * 0.6;
        c.events.bump = true;
        puff(c, coinPose(c).contact, 6);
      }
      const want = Math.min(8, Math.floor(drive.growth * 3));
      while (c.clingers.length + c.jeeted < want) c.clingers.push({ angle: c.rng() * Math.PI * 2, tone: c.rng() });
      for (const m of MILESTONES) {
        if (multiplier >= m.at && c[m.key].x < 0.01 && c[m.key].v === 0) {
          c[m.key].v = 8;
          c.events.milestone = m.key;
          if (m.key === 'cap') for (let i = 0; i < 40; i += 1) puff(c, coinPose(c).centre, 1, ['#ff4d6d', '#7cf67c', '#8fd3ff', '#ffe27a'][i % 4]!, 2.4);
        }
      }
      // One holder bails at each milestone, counted rather than looked up, as tumbling jeets expire.
      while (c.jeeted < JEET_AT.length && multiplier >= JEET_AT[c.jeeted]! && c.clingers.length) {
        const gone = c.clingers.shift()!;
        const pose = coinPose(c);
        const a = gone.angle + c.roll;
        c.jeets.push({ x: pose.centre.x + Math.cos(a) * pose.r, y: pose.centre.y + Math.sin(a) * pose.r, vx: -(120 + c.rng() * 120), vy: 160 + c.rng() * 120, angle: 0, spin: -6 - c.rng() * 4, age: 0, tone: JEET_AT[c.jeeted]! });
        c.events.jeet = true;
        c.jeeted += 1;
      }
    }
    stepSpring(c.back, 0, 5, 0.8, dt);
  } else {
    c.crashAge += dt;
    const angle = slopeAngle(Math.max(0, c.x));
    c.crashSpeed += 700 * Math.sin(angle) * dt + 120 * dt;
    c.x = Math.max(0, c.x - c.crashSpeed * dt);
    settleSpring(c.back, 0);
    if (c.crashAge < 2 && Math.floor(c.time * 12) !== Math.floor((c.time - dt) * 12)) puff(c, coinPose(c).contact, 3, '#c8b78f', 1.6);
  }
  stepSpring(c.wobble, 0, 9, 0.3, dt);
  for (const key of ['crown', 'cap', 'flag'] as const) stepSpring(c[key], c[key].x > 0.01 || c[key].v > 0 ? 1 : 0, 10, 0.4, dt);
  const after = c.x - c.back.x;
  c.roll += ((after - before) * Math.sqrt(1 + Math.pow(Math.tan(slopeAngle(Math.max(0, after))), 2))) / Math.max(8, c.radius.x);
  for (const j of c.jeets) {
    j.age += dt;
    j.vy -= 900 * dt;
    j.x += j.vx * dt;
    j.y += j.vy * dt;
    j.angle += j.spin * dt;
    const ground = heightAt(Math.max(0, j.x));
    if (j.y < ground) { j.y = ground; j.vy = Math.abs(j.vy) * 0.3; j.vx *= 0.7; }
  }
  c.jeets = c.jeets.filter((j) => j.age < 3.5);
  for (const d of c.dust) { d.age += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy -= 60 * dt; d.r += 12 * dt; }
  c.dust = c.dust.filter((d) => d.age < d.life);
}

/** The dev sells: the coin lets go and rolls back down. */
export function crashCoin(c: CoinState, seed: number, quiet: boolean): void {
  c.rng = mulberry32(seed);
  c.crashed = true;
  c.crashAge = quiet ? 10 : 0;
  c.crashSpeed = quiet ? 0 : 40;
  if (quiet) c.x = 0;
  c.clingers = [];
}

function drawFigure(ctx: CanvasRenderingContext2D, tone: number, hanging: boolean): void {
  // A tiny holder: head, body, arms up (holding on) or flailing.
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke();
  ctx.strokeStyle = tone > 0.5 ? '#e63946' : '#3b82f6'; ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-5, hanging ? -6 : 4); ctx.lineTo(0, 3); ctx.lineTo(5, hanging ? -6 : 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, 18); ctx.lineTo(0, 12); ctx.lineTo(3, 18); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -5, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#f3dccb'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-1.5, -6, 0.8, 0, Math.PI * 2); ctx.arc(1.8, -6, 0.8, 0, Math.PI * 2); ctx.fill();
}

export function drawCoin(ctx: CanvasRenderingContext2D, cam: Camera, c: CoinState, ticker: string): void {
  const pose = coinPose(c);
  const centre = toScreen(cam, pose.centre);
  const r = pose.r;
  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.rotate(c.wobble.x);
  // Coin body: rim, face, stamped ticker. The roll turns the face; the wobble tilts everything.
  ctx.save();
  ctx.rotate(c.roll);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = GOLD; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD_DARK; ctx.lineWidth = Math.max(3, r * 0.09); ctx.stroke();
  ctx.fillStyle = GOLD_DARK;
  for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, Math.max(1.5, r * 0.03), 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = GOLD_LIGHT;
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `900 ${Math.max(10, r * 0.42)}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ticker, 0, 2);
  if (c.crashed) {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.5); ctx.lineTo(-r * 0.2, -r * 0.1); ctx.lineTo(-r * 0.4, r * 0.3); ctx.lineTo(0, r * 0.7); ctx.stroke();
  }
  // Holders clinging to the rim, riding it round.
  for (const h of c.clingers) {
    ctx.save();
    ctx.rotate(h.angle);
    ctx.translate(0, -r - 8);
    ctx.rotate(Math.PI);
    drawFigure(ctx, h.tone, true);
    ctx.restore();
  }
  ctx.restore();
  // Milestone gear stays upright above the coin.
  const crown = clamp(c.crown.x, 0, 1.2);
  if (crown > 0.02) {
    ctx.save();
    ctx.translate(0, -r - 6 + Math.sin(c.time * 2) * 3);
    ctx.scale(crown, crown);
    ctx.fillStyle = '#ffd60a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-30, -26); ctx.lineTo(-14, -12); ctx.lineTo(0, -32); ctx.lineTo(14, -12); ctx.lineTo(30, -26); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e63946';
    for (const x of [-15, 0, 15]) { ctx.beginPath(); ctx.arc(x, -6, 3.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  const cap = clamp(c.cap.x, 0, 1.2);
  if (cap > 0.02) {
    ctx.save();
    ctx.translate(r * 0.55, -r * 0.75);
    ctx.rotate(-0.25);
    ctx.scale(cap, cap);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(-28, -6); ctx.lineTo(0, -18); ctx.lineTo(28, -6); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-12, 0, 24, 12, 3); ctx.fill();
    ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(18, 4); ctx.lineTo(18, 14); ctx.stroke();
    ctx.restore();
  }
  const flag = clamp(c.flag.x, 0, 1.2);
  if (flag > 0.02) {
    ctx.save();
    ctx.translate(-r * 0.5, -r * 0.8);
    ctx.scale(flag, flag);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46); ctx.stroke();
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(34 + Math.sin(c.time * 6) * 3, -38); ctx.lineTo(0, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 9px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('RAY', 5, -37);
    ctx.restore();
  }
  ctx.restore();
  // Jeets tumbling down the hill, and dust.
  for (const j of c.jeets) {
    const p = toScreen(cam, { x: j.x, y: j.y });
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(j.angle); drawFigure(ctx, 0.3, false); ctx.restore();
  }
  for (const d of c.dust) {
    const p = toScreen(cam, { x: d.x, y: d.y });
    ctx.globalAlpha = (1 - d.age / d.life) * 0.7;
    ctx.fillStyle = d.colour;
    ctx.beginPath(); ctx.arc(p.x, p.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
