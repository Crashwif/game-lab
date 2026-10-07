/**
 * The party: holders who cannonball in and bob on tubes, your degen on the
 * flamingo, the DJ, the dev on his lounger with the chain round his wrist,
 * and the AIRDROP helicopter that tips fresh degens into the pool at the
 * milestones. An accepted exit paddles you to the ladder and onto a lounger
 * with a towel and shades, to a burst of confetti; the rug pull spins everyone
 * still floating down the drain, leaves one sad Wojak in the puddle, and the
 * dev takes a selfie with the empty pool before he strolls off with the bag.
 * An empty lifeguard chair on the near deck has warned everyone: NO LIFEGUARD
 * (HE SOLD).
 */
import { type Spring, clamp, gust, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { DRAIN, INK, LADDER_X, POOL, type PoolState, drainPull, splash, surfaceY } from './pool';

const SKIN = '#f3dccb';
const TUBES = ['#ff5d9e', '#7cf67c', '#ffe27a', '#8fd3ff', '#c084fc'];
export const DEV_LOUNGER = { x: 872, y: POOL.top - 4 };
export const SAFE_LOUNGER = { x: 78, y: POOL.top - 4 };
/** The lifeguard chair on the near deck, left of the pool. */
const CHAIR = { x: 76, top: 322, seat: 352, foot: 478 };
/** The helicopter's height, speed, run and the x at which it tips each degen out. */
export const HELI = { y: 152, speed: 225, from: -170, to: 1130, drops: [345, 485, 625] };
/** How many holders the multiplier has drawn into the pool so far, and the most the pool takes with the airdrops. */
const crowdFor = (growth: number): number => Math.min(22, 2 + Math.floor(growth * 5));
const MAX_HOLDERS = 30;
const CONFETTI = 36;
const leanFor = (growth: number): number => smoothstep(0.3, 0.9, clamp(growth / 3.3, 0, 1));

export type HolderMode = 'jumping' | 'floating' | 'sucked' | 'gone' | 'puddle';
export interface Holder { x: number; y: number; tube: string; tone: number; phase: number; mode: HolderMode; t: number; fromX: number; toX: number; fromY: number; spin: number; scale: number; airdropped: boolean }
export type AvatarMode = 'floating' | 'paddling' | 'climbing' | 'walking' | 'lounging' | 'sucked' | 'puddle';
export type DevMode = 'lounging' | 'standing' | 'selfie' | 'leaving';
export interface Confetti { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; colour: string; spin: number }

export interface PartyState {
  time: number;
  tension: number;
  holders: Holder[];
  avatar: { mode: AvatarMode; x: number; y: number; modeAge: number; spin: number; scale: number; shades: Spring; fear: number };
  /** The dev: `lean` sits him up with the chain in his fist as the tension grows; `phone` raises the selfie stick after the drain. */
  dev: { mode: DevMode; x: number; modeAge: number; grin: Spring; yank: Spring; lean: Spring; phone: Spring; flash: number; snapped: boolean };
  /** The AIRDROP helicopter: crossing while active, with the passes it still owes. */
  heli: { active: boolean; x: number; drops: number; pending: number };
  /** The NO LIFEGUARD sign's swing, in radians. */
  sign: Spring;
  confetti: Confetti[];
  whaleFlash: number;
  /** 1, or 0 under reduced motion: scales the dev's tremble and the phone's flash. */
  motion: number;
  rng: () => number;
  events: { splash: { x: number; y: number; big: boolean } | null; heli: boolean; drop: boolean; shutter: boolean };
}

const freshDev = (): PartyState['dev'] => ({ mode: 'lounging', x: DEV_LOUNGER.x, modeAge: 0, grin: spring(0), yank: spring(0), lean: spring(0), phone: spring(0), flash: 0, snapped: false });

export function createParty(motion = 1): PartyState {
  return {
    time: 0, tension: 0, holders: [], avatar: { mode: 'floating', x: 480, y: 420, modeAge: 0, spin: 0, scale: 1, shades: spring(0), fear: 0 },
    dev: freshDev(), heli: { active: false, x: HELI.from, drops: 0, pending: 0 }, sign: spring(0), confetti: [], whaleFlash: 0, motion,
    rng: () => 0.5, events: { splash: null, heli: false, drop: false, shutter: false },
  };
}

export function resetParty(p: PartyState, seed: number): void {
  let a = seed >>> 0;
  p.rng = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  p.holders = [];
  p.avatar = { mode: 'floating', x: 480, y: 420, modeAge: 0, spin: 0, scale: 1, shades: spring(0), fear: 0 };
  p.dev = freshDev();
  p.heli = { active: false, x: HELI.from, drops: 0, pending: 0 };
  settleSpring(p.sign, 0);
  p.confetti = [];
  p.whaleFlash = 0;
}

/** The exit was accepted: paddle for the ladder. */
export function leavePool(p: PartyState): void {
  if (p.avatar.mode === 'floating') { p.avatar.mode = 'paddling'; p.avatar.modeAge = 0; }
}

/** A burst of confetti (capped) from a point: the cash-out's beat. */
export function celebrate(p: PartyState, x: number, y: number): void {
  for (let i = 0; i < CONFETTI; i += 1) {
    p.confetti.push({ x, y, vx: (p.rng() - 0.5) * 300, vy: -140 - p.rng() * 220, r: 2 + p.rng() * 3, age: 0, life: 1.1 + p.rng() * 0.7, colour: ['#7cf67c', '#ffe27a', '#ff5d9e', '#8fd3ff'][i % 4]!, spin: p.rng() * 6 });
  }
}

/** A milestone: the helicopter owes the pool a pass (it launches on the next step, once any pass under way is over). */
export function airdrop(p: PartyState): void {
  p.heli.pending += 1;
}

/** Straight onto the safe lounger, shades on: an exit met late. */
function lounge(a: PartyState['avatar']): void {
  a.mode = 'lounging';
  a.modeAge = 0;
  a.x = SAFE_LOUNGER.x;
  a.y = POOL.top - 26;
  settleSpring(a.shades, 1);
}

/** A round met late: the crowd the multiplier has drawn so far, already afloat, the dev sat up to match, and the avatar out on the lounger if the exit is in. */
export function settleParty(p: PartyState, pool: PoolState, growth: number, out: boolean): void {
  for (let i = 0; i < crowdFor(growth); i += 1) {
    const x = 230 + p.rng() * 520;
    p.holders.push({ x, y: surfaceY(pool, x) - 4, tube: TUBES[Math.floor(p.rng() * TUBES.length)]!, tone: p.rng(), phase: p.rng() * 6.3, mode: 'floating', t: 1, fromX: x, toX: x, fromY: 0, spin: 0, scale: 1, airdropped: false });
  }
  settleSpring(p.dev.lean, leanFor(growth));
  settleSpring(p.dev.grin, clamp(growth / 3.3, 0, 1));
  if (out) lounge(p.avatar);
}

/** The crash frame: the dev is on his feet yanking the chain before the plug gives (the pull lands a few frames later). */
export function devYank(p: PartyState): void {
  const d = p.dev;
  if (d.mode !== 'lounging') return;
  d.mode = 'standing';
  d.modeAge = 0;
  d.yank.v += 30;
}

/** The plug is out. `quiet` is a rug pull met late: everyone lands where the loud one would have left them. */
export function rugPulled(p: PartyState, quiet: boolean): void {
  const d = p.dev;
  if (quiet) { d.mode = 'leaving'; d.modeAge = 0; d.x = DEV_LOUNGER.x + 150; d.snapped = true; }
  else devYank(p);
  const floating = p.holders.filter((h) => h.mode === 'floating' || h.mode === 'jumping');
  for (const h of floating) h.mode = quiet ? 'gone' : 'sucked';
  // Only a floater goes down the drain. Paddling or climbing, the avatar has cashed out and carries on to the lounger.
  const a = p.avatar;
  if (a.mode === 'floating') {
    a.mode = quiet ? 'puddle' : 'sucked';
    a.modeAge = 0;
    if (quiet) { a.x = DRAIN.x - 30; a.y = POOL.floor - 6; }
  } else if (quiet && a.mode !== 'lounging') lounge(a);
  // Someone is left behind in the puddle: the avatar if he stayed, otherwise a random holder.
  if (a.mode !== 'sucked' && a.mode !== 'puddle' && floating.length) {
    const h = floating[Math.floor(p.rng() * floating.length)]!;
    h.mode = 'puddle';
    h.x = DRAIN.x - 40 + p.rng() * 20;
  }
  p.heli.pending = 0;
}

export function stepParty(p: PartyState, pool: PoolState, growth: number, running: boolean, fear: number, dt: number): void {
  p.time += dt;
  p.tension = clamp(growth / 3.3, 0, 1);
  p.events.splash = null;
  p.events.heli = p.events.drop = p.events.shutter = false;
  const a = p.avatar;
  a.modeAge += dt;
  a.fear = fear;
  const want = crowdFor(growth);
  if (running && !pool.draining && p.holders.length < MAX_HOLDERS && p.holders.filter((h) => !h.airdropped && h.mode !== 'gone').length < want && !p.holders.some((h) => h.mode === 'jumping' && !h.airdropped)) {
    p.holders.push({ x: 840, y: POOL.top - 30, tube: TUBES[Math.floor(p.rng() * TUBES.length)]!, tone: p.rng(), phase: p.rng() * 6.3, mode: 'jumping', t: 0, fromX: 840, toX: 230 + p.rng() * 520, fromY: POOL.top - 30, spin: 0, scale: 1, airdropped: false });
  }
  // The helicopter: launches a pass it owes, tips a degen out at each drop mark, and leaves off the right.
  const h = p.heli;
  if (!h.active && h.pending > 0 && running && !pool.draining) {
    h.active = true;
    h.x = HELI.from;
    h.drops = 0;
    h.pending -= 1;
    p.events.heli = true;
  }
  if (h.active) {
    // Once the plug is out the pilot wants no part of it and leaves at full throttle.
    h.x += HELI.speed * (pool.draining ? 2.6 : 1) * dt;
    if (h.drops < HELI.drops.length && h.x >= HELI.drops[h.drops]!) {
      if (running && !pool.draining) {
        const fromX = h.x + 8;
        const jumper: Holder = { x: fromX, y: HELI.y + 24, tube: TUBES[Math.floor(p.rng() * TUBES.length)]!, tone: p.rng(), phase: p.rng() * 6.3, mode: 'jumping', t: 0, fromX, toX: clamp(fromX + (p.rng() - 0.5) * 60, POOL.left + 40, POOL.right - 40), fromY: HELI.y + 24, spin: 0, scale: 1, airdropped: true };
        if (p.holders.length < MAX_HOLDERS) p.holders.push(jumper);
        else {
          // Later passes give a returning partygoer another jump; the pool's crowd stays bounded.
          const returning = p.holders.find(k => k.airdropped && k.mode === 'floating');
          if (returning) Object.assign(returning, jumper);
        }
        if (h.drops === 0) p.events.drop = true;
      }
      h.drops += 1;
    }
    if (h.x > HELI.to) h.active = false;
  }
  for (const k of p.holders) {
    switch (k.mode) {
      case 'jumping': {
        if (k.airdropped) {
          // Straight down out of the helicopter, flailing, into a bigger splash.
          k.t += dt / 0.8;
          const t = clamp(k.t, 0, 1);
          k.x = mix(k.fromX, k.toX, t);
          k.y = mix(k.fromY, surfaceY(pool, k.toX) - 4, t * t);
          k.spin = t * 6.3 * (k.toX > k.fromX ? 1 : -1);
          if (k.t >= 1) { k.mode = 'floating'; k.spin = 0; splash(pool, k.x, surfaceY(pool, k.x), 18, 280); p.events.splash = { x: k.x, y: k.y, big: true }; }
        } else {
          k.t += dt / 0.9;
          const t = clamp(k.t, 0, 1);
          k.x = mix(k.fromX, k.toX, t);
          k.y = mix(POOL.top - 30, surfaceY(pool, k.toX) - 4, t) - Math.sin(t * Math.PI) * 110;
          if (k.t >= 1) { k.mode = 'floating'; splash(pool, k.x, surfaceY(pool, k.x), 12, 200); p.events.splash = { x: k.x, y: k.y, big: false }; }
        }
        break;
      }
      case 'floating':
        k.x += Math.sin(p.time * 0.5 + k.phase) * 6 * dt;
        k.x = clamp(k.x, POOL.left + 30, POOL.right - 30);
        k.y = surfaceY(pool, k.x) - 4 + Math.sin(p.time * 2 + k.phase) * 2;
        break;
      case 'sucked': {
        const pull = drainPull(pool, k.x);
        k.x += (DRAIN.x - k.x) * pull * 2.2 * dt;
        k.y = surfaceY(pool, k.x) - 4;
        k.spin += pull * 9 * dt;
        if (Math.abs(k.x - DRAIN.x) < 40 && pool.drained > 0.2) k.scale = Math.max(0, k.scale - dt * 1.6);
        if (k.scale <= 0.02) k.mode = 'gone';
        break;
      }
      case 'puddle':
        k.y = POOL.floor - 6;
        break;
      case 'gone':
        break;
    }
  }
  switch (a.mode) {
    case 'floating':
      a.x = 480 + Math.sin(p.time * 0.4) * 10;
      a.y = surfaceY(pool, a.x) - 6;
      break;
    case 'paddling':
      a.x = Math.max(LADDER_X + 22, a.x - 230 * dt);
      a.y = surfaceY(pool, a.x) - 6;
      if (a.x <= LADDER_X + 22) { a.mode = 'climbing'; a.modeAge = 0; }
      break;
    case 'climbing': {
      const k = clamp(a.modeAge / 0.9, 0, 1);
      a.x = LADDER_X;
      a.y = mix(surfaceY(pool, LADDER_X) - 6, POOL.top - 30, k);
      if (k >= 1) { a.mode = 'walking'; a.modeAge = 0; }
      break;
    }
    case 'walking': {
      a.y = POOL.top - 30;
      a.x = Math.max(SAFE_LOUNGER.x, a.x - 150 * dt);
      if (a.x <= SAFE_LOUNGER.x) { a.mode = 'lounging'; a.modeAge = 0; }
      break;
    }
    case 'lounging':
      a.x = SAFE_LOUNGER.x;
      a.y = POOL.top - 26;
      stepSpring(a.shades, 1, 12, 0.5, dt);
      break;
    case 'sucked': {
      const pull = drainPull(pool, a.x);
      a.x += (DRAIN.x - a.x) * pull * 2 * dt;
      a.y = surfaceY(pool, a.x) - 6;
      a.spin += pull * 8 * dt;
      if (Math.abs(a.x - DRAIN.x) < 40 && pool.drained > 0.25) a.scale = Math.max(0, a.scale - dt * 1.4);
      if (a.scale <= 0.02) { a.mode = 'puddle'; a.modeAge = 0; a.scale = 1; a.spin = 0; a.x = DRAIN.x - 30; }
      break;
    }
    case 'puddle':
      a.y = POOL.floor - 6;
      break;
  }
  // The dev: sits up with the chain wound round his fist as the number climbs (the wind-up the pull pays off),
  // yanks it, then steps to the rim for a selfie with the empty pool before he strolls off with the bag.
  const d = p.dev;
  d.modeAge += dt;
  stepSpring(d.lean, d.mode === 'lounging' && running ? leanFor(growth) : 0, 3, 0.7, dt);
  stepSpring(d.grin, d.mode === 'lounging' ? p.tension : 1, 3, 0.8, dt);
  stepSpring(d.yank, 0, 8, 0.5, dt);
  if (d.mode === 'standing' && d.modeAge > 0.9) { d.mode = 'selfie'; d.modeAge = 0; }
  if (d.mode === 'selfie') {
    d.x += (DEV_LOUNGER.x - 30 - d.x) * (1 - Math.exp(-dt * 6));
    stepSpring(d.phone, d.modeAge > 0.15 ? 1 : 0, 9, 0.45, dt);
    if (d.modeAge >= 0.95 && !d.snapped) { d.snapped = true; d.flash = 1; p.events.shutter = true; }
    if (d.modeAge > 1.8) { d.mode = 'leaving'; d.modeAge = 0; }
  } else stepSpring(d.phone, 0, 9, 0.6, dt);
  d.flash = Math.max(0, d.flash - dt / 0.35);
  if (d.mode === 'leaving') d.x += 150 * dt;
  p.whaleFlash = pool.whale.active && pool.whale.t < 1.5 ? 1 : Math.max(0, p.whaleFlash - dt * 1.5);
  // The lifeguard sign swings with the breeze and gets knocked by every splash.
  if (p.events.splash) p.sign.v += (p.events.splash.big ? 2.4 : 1.2) * (p.rng() > 0.5 ? 1 : -1);
  stepSpring(p.sign, gust(p.time, 2) * 0.05 * (0.3 + p.tension), 6, 0.2, dt);
  for (const c of p.confetti) {
    c.age += dt;
    c.vy += 420 * dt;
    c.vx *= Math.exp(-1.5 * dt);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }
  p.confetti = p.confetti.filter((c) => c.age < c.life);
}

/**
 * A speech bubble whose tail points down at (x, y). The box stays on the canvas, so near an edge the tail
 * slides along its bottom instead of the box running off.
 */
function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 18;
  const left = clamp(x - w / 2, 8, 952 - w);
  const tail = clamp(x, left + 12, left + w - 12);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(left, y - 24, w, 24, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tail - 6, y); ctx.lineTo(tail, y + 8); ctx.lineTo(tail + 6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, left + w / 2, y - 8);
  ctx.restore();
}

/** The dev's wrist, where the chain ends: it comes up and in as he sits up with the tension. */
export function devWrist(p: PartyState): { x: number; y: number } {
  const d = p.dev;
  const lean = clamp(d.lean.x, 0, 1);
  if (d.mode === 'lounging') return { x: d.x - 36 - 22 * lean, y: DEV_LOUNGER.y - 28 - 34 * lean };
  return { x: d.x - 26, y: DEV_LOUNGER.y - 62 - clamp(d.yank.x, 0, 30) };
}

interface WojakLook { tone: number; mood: 'calm' | 'nervous' | 'panic' | 'smug' | 'sad' | 'shock'; shades: number; scale: number; spin: number }

/** Head and shoulders of a Wojak, facing left toward the pool centre or right. */
export function drawWojakBust(ctx: CanvasRenderingContext2D, x: number, y: number, look: WojakLook, facing: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(look.spin);
  ctx.scale(look.scale * facing, look.scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Shoulders.
  ctx.fillStyle = look.tone > 0.66 ? '#e63946' : look.tone > 0.33 ? '#3b82f6' : '#f2c14e';
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-16, -6, 32, 16, 6); ctx.fill(); ctx.stroke();
  // Head.
  ctx.beginPath(); ctx.ellipse(0, -20, 12, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN; ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  const open = look.mood === 'shock' || look.mood === 'panic' ? 1.5 : look.mood === 'sad' ? 0.6 : 1;
  for (const ex of [2, 8]) { ctx.beginPath(); ctx.ellipse(ex, -23, 1.8, 1.8 * open, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  const brow = look.mood === 'nervous' || look.mood === 'panic' || look.mood === 'sad' ? 1 : look.mood === 'smug' ? -0.6 : 0;
  ctx.beginPath(); ctx.moveTo(-1, -28 + brow); ctx.lineTo(4, -28 - 2 * brow); ctx.moveTo(6, -28 - 2 * brow); ctx.lineTo(11, -28 + brow); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -21); ctx.lineTo(12, -16); ctx.lineTo(8, -15); ctx.stroke();
  ctx.beginPath();
  if (look.mood === 'shock' || look.mood === 'panic') { ctx.ellipse(6, -10, 3, 3.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (look.mood === 'sad') { ctx.moveTo(2, -9); ctx.quadraticCurveTo(6, -13, 10, -9); }
  else if (look.mood === 'smug') { ctx.moveTo(2, -11); ctx.quadraticCurveTo(7, -6, 11, -12); }
  else { ctx.moveTo(2, -10); ctx.quadraticCurveTo(6, -8 + (look.mood === 'nervous' ? -2 : 0), 10, -10); }
  ctx.stroke();
  if (look.shades > 0.02) {
    const dy = -30 * (1 - look.shades);
    ctx.fillStyle = INK;
    ctx.fillRect(-1, -26 + dy, 6, 4);
    ctx.fillRect(6, -26 + dy, 6, 4);
    ctx.fillRect(5, -25 + dy, 1.5, 1.5);
  }
  ctx.restore();
}

function drawTube(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, scale: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.ellipse(0, 4, 24, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 8; ctx.stroke();
  ctx.restore();
}

function drawFlamingo(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ff7eb3'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, 6, 38, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-50, -30, -42, -46); ctx.quadraticCurveTo(-36, -58, -26, -50); ctx.lineTo(-24, -40); ctx.quadraticCurveTo(-34, -30, -22, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.moveTo(-26, -50); ctx.lineTo(-14, -46); ctx.lineTo(-26, -42); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-34, -50, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-33.5, -50, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLounger(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string): void {
  ctx.fillStyle = colour; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(x - 44, y - 16, 88, 12, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 44, y - 12); ctx.lineTo(x - 56, y - 44); ctx.lineTo(x - 30, y - 40); ctx.lineTo(x - 24, y - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  for (const dx of [-36, 36]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 4); ctx.lineTo(x + dx, y + 6); ctx.stroke(); }
}

/** The empty lifeguard chair on the near deck, with its sign swinging under the seat. */
function drawLifeguardChair(ctx: CanvasRenderingContext2D, p: PartyState): void {
  const { x, top, seat, foot } = CHAIR;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Posts, braces and the little ladder up the right post.
  ctx.strokeStyle = INK; ctx.lineWidth = 7;
  for (const dx of [-26, 26]) { ctx.beginPath(); ctx.moveTo(x + dx, foot); ctx.lineTo(x + dx, seat); ctx.stroke(); }
  ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 4;
  for (const dx of [-26, 26]) { ctx.beginPath(); ctx.moveTo(x + dx, foot); ctx.lineTo(x + dx, seat); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 26, foot - 30); ctx.lineTo(x + 26, seat + 40); ctx.moveTo(x + 26, foot - 30); ctx.lineTo(x - 26, seat + 40); ctx.stroke();
  for (let y = seat + 30; y < foot - 8; y += 16) { ctx.beginPath(); ctx.moveTo(x + 26, y); ctx.lineTo(x + 44, y); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x + 44, seat + 22); ctx.lineTo(x + 44, foot); ctx.stroke();
  // The seat with its red and white stripe, and the backrest.
  ctx.fillStyle = '#e63946'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x - 32, seat - 2, 64, 20, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 28, seat + 4, 56, 7);
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.roundRect(x - 30, top, 60, seat - top + 2, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('LIFEGUARD', x, (top + seat) / 2 + 1, 54);
  // The sign hangs from the seat on two strings and swings about the seat's underside.
  ctx.translate(x, seat + 18);
  ctx.rotate(clamp(p.sign.x, -0.35, 0.35));
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-30, 16); ctx.moveTo(22, 0); ctx.lineTo(30, 16); ctx.stroke();
  ctx.fillStyle = '#fbf8f1'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-38, 16, 76, 34, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.fillText('NO LIFEGUARD', 0, 27, 70);
  ctx.fillStyle = INK;
  ctx.font = '900 11px Impact, "Arial Black", sans-serif';
  ctx.fillText('(HE SOLD)', 0, 41, 70);
  ctx.restore();
}

export function drawDeckProps(ctx: CanvasRenderingContext2D, p: PartyState, beat: number): void {
  // DJ booth at the back of the pool with pulsing speakers.
  const DJ_X = 485;
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(DJ_X - 55, POOL.top - 60, 110, 52, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff5d9e';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LP', DJ_X, POOL.top - 30);
  for (const sx of [DJ_X - 41, DJ_X + 41]) {
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath(); ctx.roundRect(sx - 12, POOL.top - 112, 24, 48, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a5560';
    ctx.beginPath(); ctx.arc(sx, POOL.top - 92, 8 + beat * 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, POOL.top - 72, 5 + beat * 2, 0, Math.PI * 2); ctx.fill();
  }
  drawWojakBust(ctx, DJ_X, POOL.top - 66 + Math.sin(p.time * 8) * 2 * (0.3 + beat), { tone: 0.5, mood: 'smug', shades: 1, scale: 1, spin: 0 }, 1);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(DJ_X, POOL.top - 88, 13, Math.PI, Math.PI * 2); ctx.stroke();
  // Loungers: the dev's and the safe one, and the lifeguard chair nobody is in.
  drawLounger(ctx, DEV_LOUNGER.x, DEV_LOUNGER.y, '#f2c14e');
  drawLounger(ctx, SAFE_LOUNGER.x, SAFE_LOUNGER.y, '#8fd3ff');
  drawLifeguardChair(ctx, p);
}

/** The AIRDROP helicopter across the sunset, with a degen in the door, drawn between the sky and the pool. */
export function drawHelicopter(ctx: CanvasRenderingContext2D, p: PartyState): void {
  const h = p.heli;
  if (!h.active) return;
  const y = HELI.y + Math.sin(p.time * 3) * 3;
  ctx.save();
  ctx.translate(h.x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // The banner on a rope off the tail, fluttering.
  const bx = -128;
  const flutter = Math.sin(p.time * 9) * 3;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-62, 0); ctx.quadraticCurveTo(-90, 6, bx + 40, 4 + flutter); ctx.stroke();
  ctx.fillStyle = '#ffe27a'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx - 40, -6 - flutter); ctx.lineTo(bx + 40, -6 + flutter); ctx.lineTo(bx + 40, 14 + flutter); ctx.lineTo(bx - 40, 14 - flutter); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 13px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('AIRDROP', bx, 4, 72);
  // Tail boom and its rotor.
  ctx.fillStyle = '#2b333b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-70, -6, 52, 11, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-66, -6); ctx.lineTo(-62, -20); ctx.lineTo(-54, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3;
  const tail = p.motion > 0 ? Math.sin(p.time * 41) : 0.4;
  ctx.beginPath(); ctx.moveTo(-64, -14 - 10 * tail); ctx.lineTo(-64, -14 + 10 * tail); ctx.stroke();
  // Skids.
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-30, 30); ctx.lineTo(30, 30); ctx.moveTo(-18, 18); ctx.lineTo(-18, 30); ctx.moveTo(18, 18); ctx.lineTo(18, 30); ctx.stroke();
  // Body, the open door with a degen leaning out, and the cockpit glass.
  ctx.fillStyle = '#3b82f6'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 2, 38, 21, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath(); ctx.roundRect(-16, -8, 22, 24, 3); ctx.fill(); ctx.stroke();
  drawWojakBust(ctx, -3, 12, { tone: 0.1, mood: 'smug', shades: 1, scale: 0.7, spin: 0 }, 1);
  ctx.fillStyle = 'rgba(200, 240, 255, 0.85)';
  ctx.beginPath(); ctx.ellipse(20, -4, 15, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Mast and the main rotor: a blurred disc, and the blades when motion is on.
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(0, -30); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath(); ctx.ellipse(0, -30, 62, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  if (p.motion > 0) {
    const b = Math.cos(p.time * 38);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-62 * b, -30); ctx.lineTo(62 * b, -30); ctx.stroke();
  }
  ctx.restore();
}

export function drawHoldersBehind(ctx: CanvasRenderingContext2D, p: PartyState, pool: PoolState): void {
  // Tubes and bodies float on the water; the water is drawn between this layer and the fronts.
  for (const h of p.holders) {
    if (h.mode === 'gone' || h.mode === 'puddle') continue;
    drawTube(ctx, h.x, h.y, h.tube, h.scale, h.spin);
  }
  const a = p.avatar;
  if (a.mode === 'floating' || a.mode === 'paddling' || a.mode === 'sucked') drawFlamingo(ctx, a.x, a.y, a.scale, a.spin);
  void pool;
}

/** The cash-out confetti, over everything in the yard. */
export function drawConfetti(ctx: CanvasRenderingContext2D, p: PartyState): void {
  for (const c of p.confetti) {
    ctx.globalAlpha = clamp(1.5 * (1 - c.age / c.life), 0, 1);
    ctx.fillStyle = c.colour;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.spin + c.age * 5);
    ctx.fillRect(-c.r, -c.r * 0.5, c.r * 2, c.r);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawFigures(ctx: CanvasRenderingContext2D, p: PartyState, pool: PoolState, fear: number): void {
  const mood = (f: number): WojakLook['mood'] => (f > 0.62 ? 'panic' : f > 0.25 ? 'nervous' : 'calm');
  for (const h of p.holders) {
    if (h.mode === 'gone') continue;
    const look: WojakLook = { tone: h.tone, mood: h.mode === 'sucked' ? 'shock' : h.mode === 'puddle' ? 'sad' : h.mode === 'jumping' ? (h.airdropped ? 'panic' : 'smug') : mood(fear), shades: 0, scale: h.scale, spin: h.spin };
    drawWojakBust(ctx, h.x, h.y - 8, look, h.x > 480 ? -1 : 1);
    if (h.mode === 'puddle') {
      ctx.fillStyle = 'rgba(102, 224, 163, 0.6)';
      ctx.beginPath(); ctx.ellipse(h.x, POOL.floor - 3, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  const a = p.avatar;
  const aMood: WojakLook['mood'] = a.mode === 'sucked' ? 'shock' : a.mode === 'puddle' ? 'sad' : a.mode === 'lounging' || a.mode === 'walking' || a.mode === 'climbing' || a.mode === 'paddling' ? 'smug' : mood(fear);
  if (a.mode === 'puddle') {
    ctx.fillStyle = 'rgba(102, 224, 163, 0.6)';
    ctx.beginPath(); ctx.ellipse(a.x, POOL.floor - 3, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  drawWojakBust(ctx, a.x, a.y - 10, { tone: 0.9, mood: aMood, shades: clamp(a.shades.x, 0, 1), scale: a.mode === 'sucked' ? a.scale : 1.15, spin: a.spin }, 1);
  if (a.mode === 'lounging') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(a.x + 14, a.y - 30, 12, 16, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5d9e';
    ctx.fillRect(a.x + 15, a.y - 22, 10, 7);
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.roundRect(a.x - 40, a.y - 8, 26, 8, 2); ctx.fill(); ctx.stroke();
  }
  // The dev: lounging with the chain (sitting up and trembling as the number climbs), standing to yank it, the
  // selfie with the empty pool, then strolling off with the bag.
  const d = p.dev;
  const grin = clamp(d.grin.x, 0, 1);
  const lean = clamp(d.lean.x, 0, 1);
  const lounging = d.mode === 'lounging';
  const tremble = lounging ? lean * lean * smoothstep(0.7, 1, p.tension) * p.motion : 0;
  const jx = (noise(Math.floor(p.time * 31)) - 0.5) * 4 * tremble;
  const jy = (noise(Math.floor(p.time * 29) + 7) - 0.5) * 3 * tremble;
  const devY = (lounging ? DEV_LOUNGER.y - 26 - 20 * lean : DEV_LOUNGER.y - 44) + jy;
  const selfie = d.mode === 'selfie';
  drawWojakBust(ctx, d.x + jx, devY, { tone: 0.2, mood: lounging ? (grin > 0.5 ? 'smug' : 'calm') : 'smug', shades: 1, scale: 1.15, spin: lounging ? -0.25 + 0.5 * lean : 0 }, selfie ? 1 : -1);
  // The fist the chain is wound round.
  const wrist = devWrist(p);
  ctx.fillStyle = SKIN; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(wrist.x + jx, wrist.y + jy, 5.5 + 1.5 * lean, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (selfie) {
    // The bag on the deck, the selfie stick out to the right, and the flash.
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(d.x - 56, devY + 8); ctx.quadraticCurveTo(d.x - 30, devY + 2, d.x - 30, devY + 28); ctx.quadraticCurveTo(d.x - 40, devY + 40, d.x - 54, devY + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c';
    ctx.font = '900 11px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', d.x - 42, devY + 26);
    const k = clamp(d.phone.x, 0, 1.2);
    const px = d.x + 18 + 30 * k;
    const py = devY - 8 - 26 * k;
    ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(d.x + 12, devY + 2); ctx.lineTo(px - 4, py + 8); ctx.stroke();
    ctx.strokeStyle = SKIN; ctx.lineWidth = 5; ctx.stroke();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-6, -12, 12, 24, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = d.flash > 0.5 ? '#ffffff' : '#8fd3ff';
    ctx.fillRect(-4, -9, 8, 16);
    ctx.restore();
    if (d.flash > 0.02 && p.motion > 0) {
      const g = ctx.createRadialGradient(px, py, 4, px, py, 110);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * d.flash * d.flash})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - 110, py - 110, 220, 220);
    }
  } else if (!lounging) {
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(d.x + 14, devY - 2); ctx.quadraticCurveTo(d.x + 40, devY - 8, d.x + 40, devY + 18); ctx.quadraticCurveTo(d.x + 30, devY + 30, d.x + 16, devY + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c';
    ctx.font = '900 11px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', d.x + 30, devY + 14);
  }
  // He gloats from the moment he is on his feet until his head is off the right edge.
  if (!lounging && d.x < 960 + 16) bubble(ctx, d.x - 4, devY - 50, selfie ? 'say RUGGED' : 'thx for the liquidity', clamp((d.mode === 'standing' ? d.modeAge : 1) / 0.2, 0, 1));
  if (p.whaleFlash > 0) {
    ctx.globalAlpha = Math.min(1, p.whaleFlash);
    ctx.font = '900 30px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = INK;
    ctx.strokeText('WHALE ALERT', pool.whale.x, pool.level - 90);
    ctx.fillStyle = '#8fd3ff';
    ctx.fillText('WHALE ALERT', pool.whale.x, pool.level - 90);
    ctx.globalAlpha = 1;
  }
}
