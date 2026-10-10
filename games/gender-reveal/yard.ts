/**
 * The backyard at two in the afternoon: the sky and the sun, the neighbours' roofs, the cedar fence with the
 * BOY OR GIRL — EITHER WAY, WAGMI banner and its pins, the paper lanterns, the oak with the question-mark piñata
 * (a pendulum on a spring that ticks), the garage door with the projected chart and the family group chat, the
 * side gate, the never-inflated bounce house, the dessert table with the projector, the two-tier cake whose
 * neutral dye separates into pink and blue with the tension, the last slice and Destiny's sparkling water, and
 * at centre the white reveal box with its latch. At the crash: the box opens on a phone and a fog machine, the
 * piñata detonates into its sell button, receipts snow on the crowd, the cake splits into its two dyes, the
 * banner falls to WAGMI, and the projected chart flatlines into a stock-photo screensaver. Every crash piece is
 * seeded from the crash point and placed in closed form from the crash clock, so a replay or a late entry lands
 * the same. Presentation only: nothing here reads or changes the outcome.
 */
import { blob, box, cached, INK, ink, label, layer, limb, lines, poly } from './ink';
import { AT, CHAT_SENDERS, CHAT_STAGES } from './lines';
import { clamp, fract, gust, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

// ─── The geometry of the yard (960 × 540) ──────────────────────────────────────────────────────────────────
export const LAWN_Y = 300;
export const FENCE_TOP = 152;
export const GARAGE = { x: 640, w: 270, roof: 84 } as const;
export const DOOR = { x: 656, y: 116, w: 238, h: 184 } as const;
export const GATE = { x: 912, w: 46, top: 160, bottom: 318 } as const;
export const BOX = { x: 471, base: 414, w: 130, h: 96 } as const;
export const TABLE = { x: 596, top: 366, w: 222, front: 426 } as const;
export const CAKE_X = 712;
export const PLATE = { x: 780, y: 364 } as const;
export const BOTTLE_X = 612;
export const PROJECTOR = { x: 636, y: 350 } as const;
export const PINATA_PIVOT = { x: 162, y: 97 } as const;
const ROPE = 104;
export const BANNER = { x: 316, y: 166, w: 300, h: 36 } as const;
export const BOUNCE = { x: 816, y: 372, w: 120 } as const;
const LANTERN_FROM = { x: 318, y: 100 };
const LANTERN_TO = { x: 648, y: 98 };
const LANTERN_COLOURS = ['#f7a8c8', '#9fd2f5', '#fff6e8', '#ffd98a', '#f7a8c8', '#9fd2f5'];

const PINK = '#f59ac0';
const BLUE = '#7fc3f0';
const NEUTRAL = '#ece2d4';

// ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────
interface ChatMsg { sender: string; text: string; k: number }
interface Glyph { x: number; y: number; age: number; text: string }

export interface Yard {
  /** The piñata: its swing (a pendulum on a spring), the tick clock, the LED flash, the glyphs it ticks out. */
  swing: Spring;
  tickClock: number;
  ticks: number;
  led: number;
  glyphs: Glyph[];
  lanterns: Spring[];
  /** The projector's auto-focus (0 at the door's size, 1 bigger than the banner) and the banner's sag. */
  focus: Spring;
  sag: Spring;
  /** The group chat: a fractional message clock, the last few messages and the smooth scroll. */
  chatPos: number;
  chat: ChatMsg[];
  chatCount: number;
  scroll: Spring;
  /** log10 of the multiplier, sampled while running (bounded; halved when full). */
  history: number[];
  histClock: number;
  histStep: number;
  /** The water bottle going over, the levitating box, the latch's warmth, the red sky, the bass in the heap. */
  spill: Spring;
  lev: Spring;
  warm: Spring;
  sky: Spring;
  /** Kyle's head out from under the cloth (0..1), from the cast; the slice taken by the plus-one. */
  peek: number;
  sliceTaken: boolean;
  /** The side gate, 0 shut to 1 open, from the exit choreography. */
  gate: number;
  crash: CrashFx | null;
}

export function createYard(): Yard {
  return {
    swing: spring(0), tickClock: 0, ticks: 0, led: 0, glyphs: [],
    lanterns: LANTERN_COLOURS.map(() => spring(0)),
    focus: spring(0), sag: spring(0),
    chatPos: 0, chat: seedChat(1), chatCount: 4, scroll: spring(0),
    history: [], histClock: 0, histStep: 0.2,
    spill: spring(0), lev: spring(0), warm: spring(0), sky: spring(0),
    peek: 0, sliceTaken: false, gate: 0, crash: null,
  };
}

export function resetYard(y: Yard): void {
  Object.assign(y, createYard());
}

const stageOf = (multiplier: number) => {
  let s = CHAT_STAGES[0]!;
  for (const st of CHAT_STAGES) if (multiplier >= st.from) s = st;
  return s;
};
function chatMsg(k: number, multiplier: number): ChatMsg {
  const st = stageOf(multiplier);
  return { k, sender: CHAT_SENDERS[Math.floor(noise(k * 3.7 + 1) * CHAT_SENDERS.length)]!, text: st.texts[Math.floor(noise(k * 7.3 + 2) * st.texts.length)]! };
}
function seedChat(multiplier: number): ChatMsg[] {
  return [0, 1, 2, 3].map((k) => chatMsg(k, multiplier));
}

/** Posts a line said by a chat member (AUNT CAROL, COUSIN BRAD) into the projected chat. */
export function postChat(y: Yard, sender: string, text: string): void {
  y.chat.push({ sender, text, k: y.chatCount++ });
  if (y.chat.length > 7) y.chat.shift();
  y.scroll.x += 1;
}

export interface YardDrive {
  running: boolean;
  crashed: boolean;
  multiplier: number;
  tension: number;
  depth: number;
  /** Seconds the round has been running (the piñata's clock follows the round's age, not its level). */
  elapsed: number;
  time: number;
  /** Seconds since each beat, or -1 when it has not happened. */
  beat: (name: string) => number;
}
export interface YardEvents { tick: boolean; notify: boolean }

const tickInterval = (elapsed: number): number => clamp(1.25 - elapsed / 48, 0.2, 1.25);
/** The piñata's "morse" past 13×: dots and dashes that spell nothing. */
const MORSE = [1, 1, 1, 2.4, 2.4, 1, 2.4, 1, 1, 3.4];

export function stepYard(y: Yard, d: YardDrive, dt: number): YardEvents {
  const ev: YardEvents = { tick: false, notify: false };
  const live = d.running && !d.crashed;
  // The piñata swings in the breeze; every tick kicks it, alternating sides.
  stepSpring(y.swing, 0.05 * gust(d.time * 1.3, 2), 2.6, 0.06, dt);
  if (live && d.beat('tick') >= 0) {
    const morse = d.beat('dale') >= 0;
    const step = tickInterval(d.elapsed) * (morse ? 0.55 * MORSE[y.ticks % MORSE.length]! : 1);
    if ((y.tickClock += dt) >= step) {
      y.tickClock = 0;
      y.ticks += 1;
      y.swing.v += (y.ticks % 2 ? 1 : -1) * (0.08 + 0.1 * d.tension);
      y.led = 1;
      ev.tick = true;
      if (y.glyphs.length < 6) y.glyphs.push({ x: (noise(y.ticks) - 0.5) * 30, y: 0, age: 0, text: !morse ? 'tick' : MORSE[y.ticks % MORSE.length]! > 2 ? '—' : '•' });
    }
  }
  y.led = Math.max(0, y.led - dt * 4);
  for (const g of y.glyphs) g.age += dt;
  y.glyphs = y.glyphs.filter((g) => g.age < 1.4);
  for (let i = 0; i < y.lanterns.length; i += 1) stepSpring(y.lanterns[i]!, 0.08 * gust(d.time * 0.9, i * 1.7), 3.2 + i * 0.3, 0.12, dt);
  stepSpring(y.focus, d.beat('focus') >= 0 || d.crashed && y.focus.x > 0.5 ? 1 : 0, 3.2, 0.55, dt);
  stepSpring(y.sag, d.beat('focus') >= 0 ? 1 : 0, 5, 0.25, dt);
  stepSpring(y.spill, d.beat('spill') >= 0 ? 1 : 0, 9, 0.5, dt);
  stepSpring(y.lev, d.beat('levitate') >= 0 && !d.crashed ? 1 : 0, 2, 0.6, dt);
  stepSpring(y.warm, d.beat('latch') >= 0 ? 1 : 0, 2.5, 0.9, dt);
  stepSpring(y.sky, d.beat('sky') >= 0 ? 1 : 0, 1.2, 1, dt);
  // The group chat scrolls faster with the multiplier; at the crash it floods.
  if (d.running || d.crashed) {
    const rate = d.crashed ? 5 : 0.35 + 1.7 * d.tension + 2 * d.depth;
    y.chatPos += rate * dt;
    if (y.chatPos >= 1) {
      y.chatPos = Math.min(y.chatPos - 1, 1);
      y.chat.push(d.crashed ? { k: y.chatCount, sender: CHAT_SENDERS[y.chatCount % CHAT_SENDERS.length]!, text: '?' } : chatMsg(y.chatCount, d.multiplier));
      y.chatCount += 1;
      if (y.chat.length > 7) y.chat.shift();
      y.scroll.x += 1;
      ev.notify = true;
    }
  }
  stepSpring(y.scroll, 0, 9 + 6 * d.tension, 0.9, dt);
  // The chart's history, sampled while running.
  if (live) {
    y.histClock += dt;
    if (y.histClock >= y.histStep) {
      y.histClock = 0;
      y.history.push(Math.log10(d.multiplier));
      if (y.history.length > 160) {
        y.history = y.history.filter((_, i) => i % 2 === 0);
        y.histStep *= 2;
      }
    }
  }
  return ev;
}

/** Settles the props into a round already at `multiplier` (a late entry): beats in place, a chart drawn, a chat posted. */
export function settleYard(y: Yard, d: YardDrive): void {
  const on = (b: string) => d.beat(b) >= 0;
  settleSpring(y.focus, on('focus') ? 1 : 0);
  settleSpring(y.sag, on('focus') ? 1 : 0);
  settleSpring(y.spill, on('spill') ? 1 : 0);
  settleSpring(y.lev, on('levitate') && !d.crashed ? 1 : 0);
  settleSpring(y.warm, on('latch') ? 1 : 0);
  settleSpring(y.sky, on('sky') ? 1 : 0);
  const top = Math.log10(Math.max(1, d.multiplier));
  y.history = Array.from({ length: 60 }, (_, i) => top * (i / 59));
  y.histStep = Math.max(0.2, d.elapsed / 60);
  y.chatCount = 40 + Math.floor(d.elapsed * 2);
  y.chat = [3, 2, 1, 0].map((n) => chatMsg(y.chatCount - n, d.multiplier));
}

// ─── The crash: seeded pieces in closed form ────────────────────────────────────────────────────────────────
interface Flier { x: number; y: number; vx: number; vy: number; spin: number; t0: number; ground: number; size: number; tint: number }
export interface CrashFx {
  /** The crash multiplier the pieces were seeded from. */
  seed: number;
  receipts: Flier[];
  shards: Flier[];
  puffs: Flier[];
}

export function crashYard(y: Yard, x100: number): void {
  const r = mulberry32(x100 * 7 + 11);
  const receipts: Flier[] = [];
  for (let i = 0; i < 34; i += 1) {
    const fromBox = i % 3 !== 0;
    receipts.push({
      x: fromBox ? BOX.x + (r() - 0.5) * 60 : PINATA_PIVOT.x + (r() - 0.5) * 20,
      y: fromBox ? BOX.base - BOX.h : PINATA_PIVOT.y + ROPE + 20,
      vx: (r() - 0.5) * (fromBox ? 520 : 380),
      vy: -260 - r() * 380,
      spin: (r() - 0.5) * 9,
      t0: (fromBox ? 0.12 : AT.pinata) + r() * 0.5,
      ground: 330 + r() * 200,
      size: 0.8 + r() * 0.7,
      tint: r(),
    });
  }
  const shards: Flier[] = [];
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.3;
    const sp = 160 + r() * 260;
    shards.push({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, spin: (r() - 0.5) * 14, t0: AT.pinata, ground: 330 + r() * 150, size: 0.7 + r() * 0.8, tint: r() });
  }
  const puffs: Flier[] = [];
  for (let i = 0; i < 30; i += 1) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
    const sp = 60 + r() * 170;
    puffs.push({ x: BOX.x + (r() - 0.5) * 40, y: BOX.base - 40, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp, spin: 0, t0: 0.05 + i * 0.05, ground: 0, size: 16 + r() * 22, tint: r() });
  }
  y.crash = { seed: x100, receipts, shards, puffs };
}

/** A paper's place at crash time `t`: thrown, slowed by the air, falling at a fluttering terminal speed, landed. */
function paperAt(f: Flier, t: number): { x: number; y: number; rot: number; landed: boolean } {
  const u = Math.max(0, t - f.t0);
  const k = 2.6;
  const fall = 70 + 30 * f.size;
  const e = 1 - Math.exp(-k * u);
  let x = f.x + (f.vx / k) * e + Math.sin(u * 3 + f.tint * 6) * 18 * Math.min(1, u);
  let yy = f.y + fall * u + ((f.vy - fall) / k) * e;
  const landed = yy >= f.ground;
  if (landed) yy = f.ground;
  x = clamp(x, 6, 954);
  const rot = landed ? f.tint * 3 : f.spin * Math.sin(u * 2.2 + f.tint * 5) * 0.5 + u * f.spin * 0.3;
  return { x, y: yy, rot, landed };
}

/** A shard's place: ballistic from the piñata with gravity, resting where it lands. */
function shardAt(f: Flier, t: number, from: { x: number; y: number }): { x: number; y: number; rot: number } {
  const u = Math.max(0, t - f.t0);
  const g = 900;
  let x = from.x + f.vx * u;
  let yy = from.y + f.vy * u + 0.5 * g * u * u;
  if (yy > f.ground) {
    // Solve for the landing time and hold there.
    const land = (-f.vy + Math.sqrt(f.vy * f.vy + 2 * g * (f.ground - from.y))) / g;
    x = from.x + f.vx * land;
    yy = f.ground;
    return { x, y: yy, rot: f.spin * land };
  }
  return { x, y: yy, rot: f.spin * u };
}

// ─── The backdrop, cached ───────────────────────────────────────────────────────────────────────────────────
function paintBackdrop(c: CanvasRenderingContext2D): void {
  // Sky.
  const sky = c.createLinearGradient(0, 0, 0, LAWN_Y);
  sky.addColorStop(0, '#62bdf0');
  sky.addColorStop(0.7, '#b9e5f8');
  sky.addColorStop(1, '#dff3f6');
  c.fillStyle = sky;
  c.fillRect(0, 0, 960, LAWN_Y);
  // The sun, high and to the left, with its glare.
  for (const [r, a] of [[120, 0.12], [80, 0.18], [52, 0.3]] as const) {
    c.fillStyle = `rgba(255, 250, 220, ${a})`;
    c.beginPath();
    c.arc(96, 34, r, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#fff6c9';
  c.beginPath();
  c.arc(96, 34, 32, 0, Math.PI * 2);
  c.fill();
  // The neighbours: roofs and trees over the fence, hazy.
  c.fillStyle = '#9fbccc';
  for (const [x, w, h] of [[330, 130, 46], [520, 110, 38]] as const) {
    c.beginPath();
    c.moveTo(x, FENCE_TOP);
    c.lineTo(x + 14, FENCE_TOP - h);
    c.lineTo(x + w - 14, FENCE_TOP - h);
    c.lineTo(x + w, FENCE_TOP);
    c.closePath();
    c.fill();
  }
  c.fillStyle = '#b5cdd6';
  c.fillRect(352, FENCE_TOP - 70, 10, 26);
  c.fillStyle = '#8fbf9a';
  for (const [x, yy, r] of [[300, 140, 30], [470, 132, 34], [505, 140, 26], [630, 128, 30], [950, 150, 36], [460, 146, 20]] as const) {
    c.beginPath();
    c.arc(x, yy, r, 0, Math.PI * 2);
    c.fill();
  }
  // The lawn: mown stripes in perspective, a shadow at the fence, lighter toward us.
  const lawn = c.createLinearGradient(0, LAWN_Y, 0, 540);
  lawn.addColorStop(0, '#6eb15a');
  lawn.addColorStop(1, '#8fd06e');
  c.fillStyle = lawn;
  c.fillRect(0, LAWN_Y, 960, 240);
  c.fillStyle = 'rgba(255, 255, 255, 0.07)';
  for (let i = -6; i < 14; i += 2) {
    c.beginPath();
    c.moveTo(480 + i * 40, LAWN_Y);
    c.lineTo(480 + (i + 1) * 40, LAWN_Y);
    c.lineTo(480 + (i + 1) * 130, 540);
    c.lineTo(480 + i * 130, 540);
    c.closePath();
    c.fill();
  }
  c.fillStyle = 'rgba(30, 70, 30, 0.18)';
  c.fillRect(0, LAWN_Y, 960, 12);
  // The oak's shade on the lawn.
  c.fillStyle = 'rgba(30, 70, 40, 0.22)';
  c.beginPath();
  c.ellipse(140, 470, 200, 50, 0, 0, Math.PI * 2);
  c.fill();
  // The fence: cedar planks with dog-eared tops, the rails, the posts.
  for (let x = 0; x < GARAGE.x; x += 20) fencePlank(c, x, x / 20);
  for (let x = GARAGE.x + GARAGE.w; x < 960; x += 20) if (x + 20 <= GATE.x || x >= GATE.x + GATE.w) fencePlank(c, x, x / 20);
  c.fillStyle = 'rgba(80, 40, 20, 0.22)';
  c.fillRect(0, 178, GARAGE.x, 7);
  c.fillRect(0, 266, GARAGE.x, 7);
  c.fillStyle = '#a8693d';
  for (const x of [0, 150, 300, 450, 600]) {
    c.fillRect(x, FENCE_TOP - 4, 12, LAWN_Y - FENCE_TOP + 4);
  }
  c.strokeStyle = INK;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(0, LAWN_Y);
  c.lineTo(GARAGE.x, LAWN_Y);
  c.stroke();
  // Beyond the side gate: the sidewalk and a hedge, seen when it opens.
  c.fillStyle = '#cfe9f2';
  c.fillRect(GATE.x, GATE.top, GATE.w, GATE.bottom - GATE.top);
  c.fillStyle = '#5f9a55';
  c.fillRect(GATE.x, GATE.top + 70, GATE.w, 50);
  c.fillStyle = '#d9d4c8';
  c.fillRect(GATE.x, GATE.top + 120, GATE.w, GATE.bottom - GATE.top - 120);
  c.fillStyle = '#a8693d';
  c.fillRect(GATE.x - 6, GATE.top - 10, 8, GATE.bottom - GATE.top + 10);
  // The garage: siding, the roof edge, the gutter, the lamp, the panelled door.
  c.fillStyle = '#f3ede2';
  c.fillRect(GARAGE.x, GARAGE.roof, GARAGE.w, LAWN_Y - GARAGE.roof + 18);
  c.strokeStyle = 'rgba(120, 110, 95, 0.18)';
  c.lineWidth = 1;
  for (let yy = GARAGE.roof + 18; yy < LAWN_Y + 18; yy += 9) {
    c.beginPath();
    c.moveTo(GARAGE.x, yy);
    c.lineTo(GARAGE.x + GARAGE.w, yy);
    c.stroke();
  }
  c.fillStyle = '#585d6c';
  c.beginPath();
  c.moveTo(GARAGE.x - 12, GARAGE.roof + 14);
  c.lineTo(GARAGE.x + 6, GARAGE.roof - 6);
  c.lineTo(GARAGE.x + GARAGE.w - 6, GARAGE.roof - 6);
  c.lineTo(GARAGE.x + GARAGE.w + 12, GARAGE.roof + 14);
  c.closePath();
  c.fill();
  ink(c, 2.5);
  c.stroke();
  c.fillStyle = 'rgba(0, 0, 0, 0.12)';
  c.fillRect(GARAGE.x, GARAGE.roof + 14, GARAGE.w, 8);
  c.strokeStyle = INK;
  c.strokeRect(GARAGE.x, GARAGE.roof + 14, GARAGE.w, LAWN_Y - GARAGE.roof + 4);
  // The door, four sections of panels, under its trim.
  c.fillStyle = '#d6d0c5';
  c.fillRect(DOOR.x - 6, DOOR.y - 6, DOOR.w + 12, DOOR.h + 6);
  c.fillStyle = '#e8e4dc';
  c.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  for (let s = 0; s < 4; s += 1) {
    const sy = DOOR.y + s * (DOOR.h / 4);
    c.strokeStyle = 'rgba(90, 80, 70, 0.35)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(DOOR.x, sy);
    c.lineTo(DOOR.x + DOOR.w, sy);
    c.stroke();
    for (let p = 0; p < 4; p += 1) {
      c.fillStyle = 'rgba(120, 110, 95, 0.12)';
      c.fillRect(DOOR.x + 10 + p * (DOOR.w - 20) / 4, sy + 9, (DOOR.w - 20) / 4 - 10, DOOR.h / 4 - 18);
    }
  }
  c.strokeStyle = INK;
  c.lineWidth = 2.5;
  c.strokeRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  // The driveway apron.
  c.fillStyle = '#c9c4b8';
  c.beginPath();
  c.moveTo(GARAGE.x, LAWN_Y + 18);
  c.lineTo(GARAGE.x + GARAGE.w, LAWN_Y + 18);
  c.lineTo(GARAGE.x + GARAGE.w + 30, LAWN_Y + 60);
  c.lineTo(GARAGE.x - 20, LAWN_Y + 60);
  c.closePath();
  c.fill();
  // The oak's trunk and the branch the piñata hangs from.
  c.fillStyle = '#7a5434';
  ink(c, 2.5);
  c.beginPath();
  c.moveTo(22, 360);
  c.quadraticCurveTo(46, 330, 44, 240);
  c.lineTo(42, 70);
  c.lineTo(78, 70);
  c.lineTo(80, 240);
  c.quadraticCurveTo(84, 330, 110, 362);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = 'rgba(40, 20, 10, 0.35)';
  c.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[52, 300, 56, 220], [66, 260, 70, 150], [58, 190, 60, 120]] as const) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  limb(c, [{ x: 70, y: 112 }, { x: 150, y: 96 }, { x: PINATA_PIVOT.x + 30, y: PINATA_PIVOT.y - 6 }, { x: 330, y: 84 }], 13, '#7a5434');
}

function fencePlank(c: CanvasRenderingContext2D, x: number, i: number): void {
  c.fillStyle = i % 2 ? '#cf9461' : '#c78a56';
  c.beginPath();
  c.moveTo(x, FENCE_TOP + 5);
  c.lineTo(x + 4, FENCE_TOP);
  c.lineTo(x + 16, FENCE_TOP);
  c.lineTo(x + 20, FENCE_TOP + 5);
  c.lineTo(x + 20, LAWN_Y);
  c.lineTo(x, LAWN_Y);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(90, 45, 20, 0.45)';
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = 'rgba(90, 45, 20, 0.25)';
  c.beginPath();
  c.arc(x + 10, FENCE_TOP + 40 + (i * 37) % 90, 1.5, 0, Math.PI * 2);
  c.fill();
}

const backLayer = layer();
const canopyLayer = layer();
const clothLayer = layer();
const boxLayer = layer();
const heapLayer = layer();
const lanternLayers = LANTERN_COLOURS.map(() => layer());
const redLayer = layer();

/** The sky over the fence the colour of a red candle, painted once and faded in. */
function paintRedSky(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.rect(0, 0, GARAGE.x, FENCE_TOP);
  ctx.rect(GARAGE.x, 0, GARAGE.w + 20, GARAGE.roof - 6);
  ctx.rect(GATE.x - 2, 0, 50, GATE.top);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, FENCE_TOP);
  g.addColorStop(0, 'rgba(196, 24, 48, 0.85)');
  g.addColorStop(1, 'rgba(255, 110, 70, 0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, GATE.top);
}

// ─── The sky, the clouds, the plane ─────────────────────────────────────────────────────────────────────────
export function drawSky(ctx: CanvasRenderingContext2D, y: Yard, time: number): void {
  cached(ctx, backLayer, 0, 0, 960, 540, paintBackdrop);
  // Clouds drift right across the strip of sky.
  for (let i = 0; i < 3; i += 1) {
    const cx = ((i * 380 + time * (5 + i * 2)) % 1180) - 110;
    const cy = 112 + i * 14 - (i === 1 ? 40 : 0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 44, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 20, cy - 8, 20, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 14, cy - 12, 24, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // At 130× the sky over the fence goes the colour of a red candle.
  const red = clamp(y.sky.x, 0, 1);
  if (red > 0.01) {
    ctx.save();
    ctx.globalAlpha = red;
    cached(ctx, redLayer, 0, 0, 960, GATE.top, paintRedSky);
    ctx.restore();
    // The spotter plane circles.
    const a = time * 0.8;
    const px = 490 + Math.cos(a) * 160;
    const py = 96 + Math.sin(a) * 12;
    const dir = -Math.sin(a) >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(dir * 0.9, 0.9);
    ctx.globalAlpha = red;
    blob(ctx, 0, 0, 20, 4.5, '#3b3346', 0);
    ctx.fillRect(-4, -14, 7, 28);
    ctx.fillRect(-20, -6, 4, 7);
    ctx.restore();
  }
}

// ─── The oak's canopy and the lanterns ──────────────────────────────────────────────────────────────────────
/** The oak's leaf clumps, back to front: each a shaded mass with its own outline. */
const CANOPY: [number, number, number, number][] = [
  [262, 52, 60, 36], [-6, 112, 52, 40], [196, 22, 74, 44], [8, 44, 74, 56], [104, 14, 80, 50], [150, 70, 70, 40], [44, 96, 66, 42], [236, 84, 50, 30],
];
function paintCanopy(ctx: CanvasRenderingContext2D): void {
  CANOPY.forEach(([cx, yy, rx, ry]) => {
    blob(ctx, cx, yy + 5, rx, ry, '#3f7d3a', 0);
    blob(ctx, cx - 2, yy - 2, rx * 0.94, ry * 0.86, '#57a14b', 0);
    blob(ctx, cx - rx * 0.3, yy - ry * 0.38, rx * 0.42, ry * 0.32, '#7cc463', 0, -0.2);
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.ellipse(cx, yy + 3, rx, ry + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** The canopy, painted once and swayed as one mass; it shakes at the crash. */
export function drawCanopy(ctx: CanvasRenderingContext2D, time: number, shake: number): void {
  ctx.save();
  ctx.translate(Math.sin(time * 0.8) * 1.6 + Math.sin(time * 37) * 4 * shake, Math.sin(time * 0.53 + 1) * 0.8);
  cached(ctx, canopyLayer, -80, -60, 440, 240, paintCanopy);
  ctx.restore();
}

export function drawLanterns(ctx: CanvasRenderingContext2D, y: Yard, shake: number): void {
  // The string, sagging between the oak and the garage eave.
  const n = LANTERN_COLOURS.length;
  const at = (u: number) => ({ x: mix(LANTERN_FROM.x, LANTERN_TO.x, u), y: mix(LANTERN_FROM.y, LANTERN_TO.y, u) + Math.sin(u * Math.PI) * 30 });
  ctx.strokeStyle = '#3b2f2f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 20; i += 1) {
    const p = at(i / 20);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  for (let i = 0; i < n; i += 1) {
    const p = at((i + 0.7) / (n + 0.4));
    const a = clamp(y.lanterns[i]!.x + Math.sin(i * 7 + shake * 40) * 0.3 * shake, -1, 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    const colour = LANTERN_COLOURS[i]!;
    cached(ctx, lanternLayers[i]!, -16, -2, 32, 44, (c) => {
      c.strokeStyle = '#3b2f2f';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, 8);
      c.stroke();
      blob(c, 0, 22, 13, 15, colour, 2);
      c.fillStyle = 'rgba(0, 0, 0, 0.1)';
      c.fillRect(-13, 15, 26, 2);
      c.fillRect(-13, 27, 26, 2);
      c.fillStyle = '#3b2f2f';
      c.fillRect(-6, 7, 12, 3);
      c.fillRect(-6, 35, 12, 3);
    });
    ctx.restore();
  }
}

// ─── The banner: cached lettering, sliced to sag and torn at the crash ──────────────────────────────────────
let bannerArt: HTMLCanvasElement | null = null;
/** The banner's pieces, by fraction of its width: BOY OR GIRL — | E | ITHER WAY, | WAGMI. */
let cuts = [0, 0.43, 0.476, 0.705, 1];
const SLICES = 24;

function paintBanner(c: CanvasRenderingContext2D): void {
  const { w, h } = BANNER;
  c.fillStyle = '#fffaf2';
  c.fillRect(0, 0, w, h);
  c.fillStyle = PINK;
  c.fillRect(0, 0, w, 4);
  c.fillStyle = BLUE;
  c.fillRect(0, h - 4, w, 4);
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  const parts = [['BOY OR GIRL — ', '#d9477f'], ['E', '#3a87c8'], ['ITHER WAY, ', '#3a87c8'], ['WAGMI', '#c99a1c']] as const;
  // The lettering fits the cloth whatever the font: shrink until it does.
  let size = 19;
  let widths: number[] = [];
  let total = Infinity;
  while (size > 9 && total > w - 16) {
    c.font = `900 ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
    widths = parts.map(([t]) => c.measureText(t).width);
    total = widths.reduce((a, b) => a + b, 0);
    size -= 1;
  }
  let x = (w - total) / 2;
  const edges = [0];
  parts.forEach(([t, col], i) => {
    c.fillStyle = col;
    c.fillText(t, x, h / 2 + 1);
    x += widths[i]!;
    edges.push(i === parts.length - 1 ? w : x);
  });
  edges[0] = 0;
  cuts = edges.map((e) => e / w);
  c.strokeStyle = INK;
  c.lineWidth = 2.5;
  c.strokeRect(1, 1, w - 2, h - 2);
}

/** Where pin `i` (0..4) of the banner sits; the middle three pop at the auto-focus. */
const PINS = [0, 0.25, 0.5, 0.75, 1];

export function drawBanner(ctx: CanvasRenderingContext2D, y: Yard, crashT: number, time: number): void {
  if (typeof document === 'undefined') return;
  if (!bannerArt) {
    bannerArt = document.createElement('canvas');
    bannerArt.width = BANNER.w * 2;
    bannerArt.height = BANNER.h * 2;
    const c = bannerArt.getContext('2d');
    if (!c) return;
    c.scale(2, 2);
    paintBanner(c);
  }
  const sag = clamp(y.sag.x, -0.2, 1.3);
  const fall = crashT >= 0 ? smoothstep(AT.banner, AT.banner + 0.4, crashT) : 0;
  const ft = crashT >= 0 ? Math.max(0, crashT - AT.banner) : 0;
  if (Math.abs(sag) < 0.005 && fall === 0) {
    ctx.drawImage(bannerArt, BANNER.x, BANNER.y, BANNER.w, BANNER.h);
  } else drawBannerStrips(ctx, sag, fall, ft, time);
  // The pins: the end ones always, the middle three until they pop (one flies off at the focus beat).
  for (let p = 0; p < PINS.length; p += 1) {
    const middle = p > 0 && p < 4;
    if (middle && sag > 0.15) continue;
    if (fall > 0.5 && p === 0) continue;
    blob(ctx, BANNER.x + PINS[p]! * BANNER.w + (p === 0 ? 4 : p === 4 ? -4 : 0), BANNER.y + 3, 3.5, 3.5, p % 2 ? PINK : BLUE, 1.5);
  }
  if (fall > 0) blob(ctx, BANNER.x + cuts[2]! * BANNER.w - 2, BANNER.y + 3, 3.5, 3.5, '#ffd36b', 1.5);
}

function drawBannerStrips(ctx: CanvasRenderingContext2D, sag: number, fall: number, ft: number, time: number): void {
  if (!bannerArt) return;
  const sw = BANNER.w / SLICES;
  // The sag: between the two end pins once the middle ones pop, deepest over EITHER WAY.
  const droopAt = (u: number) => sag * 26 * Math.sin(Math.PI * u) * (1 + 0.35 * Math.sin(Math.PI * u * 1.4)) + Math.sin(time * 1.4 + u * 5) * 1.2 * sag * Math.sin(Math.PI * u);
  for (let i = 0; i < SLICES; i += 1) {
    const u0 = i / SLICES;
    const u1 = (i + 1) / SLICES;
    const u = (i + 0.5) / SLICES;
    let d0 = droopAt(u0);
    let d1 = droopAt(u1);
    let dx = 0;
    let rot = 0;
    let pivotX = 0;
    let pivotY = 0;
    if (fall > 0) {
      const piece = u < cuts[1]! ? 0 : u < cuts[2]! ? 1 : u < cuts[3]! ? 2 : 3;
      if (piece === 0 || piece === 2) {
        // The torn pieces drop below the fence line, turning as they go.
        const drop = 0.5 * 900 * ft * ft;
        d0 = d0 * (1 - fall) + drop;
        d1 = d1 * (1 - fall) + drop;
        dx = (piece === 0 ? -1 : 1) * 20 * ft;
        rot = (piece === 0 ? -1 : 1) * ft * 1.6;
        if (drop > 220) continue;
      } else if (piece === 1) {
        // The E hangs by one pin at its top right and swings to rest.
        pivotX = BANNER.x + cuts[2]! * BANNER.w;
        pivotY = BANNER.y;
        rot = 0.55 * (1 - Math.exp(-4 * ft)) + 0.35 * Math.exp(-1.2 * ft) * Math.sin(ft * 7);
        d0 = d1 = 0;
      } else {
        // WAGMI keeps both its pins and pulls flat.
        d0 *= 1 - fall;
        d1 *= 1 - fall;
      }
    }
    ctx.save();
    if (pivotX) {
      ctx.translate(pivotX, pivotY);
      ctx.rotate(rot);
      ctx.translate(-pivotX, -pivotY);
    } else if (rot !== 0) {
      const cx = BANNER.x + u * BANNER.w;
      ctx.translate(cx, BANNER.y + d0);
      ctx.rotate(rot);
      ctx.translate(-cx, -(BANNER.y + d0));
    }
    // Each strip is skewed to meet its neighbours, so the cloth droops in one piece.
    ctx.translate(BANNER.x + i * sw + dx, BANNER.y + d0);
    ctx.transform(1, (d1 - d0) / sw, 0, 1, 0, 0);
    ctx.drawImage(bannerArt, i * sw * 2, 0, sw * 2, BANNER.h * 2, 0, 0, sw + 0.6, BANNER.h);
    ctx.restore();
  }
}

// ─── The piñata ─────────────────────────────────────────────────────────────────────────────────────────────
export function pinataAt(y: Yard): { x: number; y: number; a: number } {
  const a = clamp(y.swing.x, -0.6, 0.6);
  return { x: PINATA_PIVOT.x + Math.sin(a) * ROPE, y: PINATA_PIVOT.y + Math.cos(a) * ROPE, a };
}

export function drawPinata(ctx: CanvasRenderingContext2D, y: Yard, crashT: number, tension: number): void {
  const p = pinataAt(y);
  const burst = crashT >= AT.pinata;
  lines(ctx, [[PINATA_PIVOT.x, PINATA_PIVOT.y, p.x, p.y]], '#3b2f2f', 2);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-p.a * 0.6);
  if (burst) {
    // What it always was: the dev's sell button, still on the rope.
    const t = crashT - AT.pinata;
    const s = 1.5 + 0.35 * Math.exp(-5 * t) * Math.sin(t * 20);
    ctx.scale(s, s);
    box(ctx, -18, 4, 36, 12, 3, '#3a3a44', 2.5);
    blob(ctx, 0, 6, 16, 9, '#e8323f', 2.5);
    label(ctx, 'SELL', 0, 4, 9, '#ffffff', 900);
    ctx.restore();
    // The flash of the detonation.
    if (t < 0.25) {
      blob(ctx, p.x, p.y + 30, 30 + 160 * t, 30 + 160 * t, `rgba(255, 240, 200, ${1 - t / 0.25})`, 0);
    }
    return;
  }
  // A fat question mark in crepe fringe: an ink core, pink paper, blue stripes.
  const hook = () => {
    ctx.beginPath();
    ctx.moveTo(-14, 16);
    ctx.bezierCurveTo(-18, -2, 18, -6, 16, 14);
    ctx.bezierCurveTo(14, 28, 0, 28, 0, 42);
    ctx.lineTo(0, 46);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  hook();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 19;
  ctx.stroke();
  hook();
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 14;
  ctx.stroke();
  hook();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.setLineDash([]);
  blob(ctx, 0, 62, 8.5, 8.5, PINK, 2.5);
  ctx.fillStyle = BLUE;
  ctx.fillRect(-6, 60, 12, 3);
  // Fringe tails.
  ctx.strokeStyle = '#fff3a8';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-3 + i * 2, 70);
    ctx.lineTo(-5 + i * 3 + Math.sin(i + p.a * 8) * 2, 82);
    ctx.stroke();
  }
  // The LED that nobody admits to seeing.
  const led = y.led;
  if (led > 0.02 || tension > 0.6) {
    blob(ctx, 10, 8, 2.5 + 2 * led, 2.5 + 2 * led, `rgba(255, 40, 50, ${clamp(led + 0.15, 0, 1)})`, 0);
  }
  ctx.restore();
  // The ticks it gives off: little marks drifting up, dashes in morse.
  for (const g of y.glyphs) {
    const a = 1 - g.age / 1.4;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x + g.x + 26, p.y + 10 - g.age * 26);
    ctx.font = '900 12px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(g.text, 0, 0);
    ctx.fillStyle = '#c0283e';
    ctx.fillText(g.text, 0, 0);
    ctx.restore();
  }
}

// ─── The projection on the garage door: the chart and the family group chat ────────────────────────────────
export function projectionRect(y: Yard): { x: number; y: number; w: number; h: number } {
  const f = clamp(y.focus.x, 0, 1.15);
  return { x: mix(DOOR.x + 8, 632, f), y: mix(DOOR.y + 6, 92, f), w: mix(DOOR.w - 16, 318, f), h: mix(DOOR.h - 14, 208, f) };
}

export function drawProjection(ctx: CanvasRenderingContext2D, y: Yard, d: { multiplier: number; crashT: number; time: number; tension: number }): void {
  const r = projectionRect(y);
  const flicker = 0.92 + 0.08 * noise(Math.floor(d.time * 12));
  // The beam from the projector on the dessert table.
  ctx.fillStyle = `rgba(255, 255, 240, ${0.1 * flicker})`;
  ctx.beginPath();
  ctx.moveTo(PROJECTOR.x + 10, PROJECTOR.y - 8);
  ctx.lineTo(r.x, r.y + r.h);
  ctx.lineTo(r.x, r.y);
  ctx.lineTo(r.x + r.w * 0.4, r.y);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = `rgba(250, 252, 255, ${0.88 * flicker})`;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const shot = d.crashT >= 0 ? smoothstep(AT.photo, AT.photo + 0.5, d.crashT) : 0;
  if (shot < 1) {
    const chartW = r.w * 0.6;
    drawChart(ctx, y, r.x + 6, r.y + 6, chartW - 10, r.h - 12, d);
    drawChat(ctx, y, r.x + chartW, r.y + 4, r.w - chartW - 4, r.h - 8, d.time);
  }
  if (shot > 0) {
    ctx.globalAlpha = shot;
    drawStockPhoto(ctx, r);
    ctx.globalAlpha = 1;
  }
  // The door's sections show through the light.
  ctx.strokeStyle = 'rgba(90, 80, 70, 0.22)';
  ctx.lineWidth = 1.5;
  for (let s = 1; s < 4; s += 1) {
    const sy = DOOR.y + s * (DOOR.h / 4);
    ctx.beginPath();
    ctx.moveTo(r.x, sy);
    ctx.lineTo(r.x + r.w, sy);
    ctx.stroke();
  }
  ctx.restore();
  // The edge of the light, soft.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

function drawChart(ctx: CanvasRenderingContext2D, y: Yard, x: number, top: number, w: number, h: number, d: { multiplier: number; crashT: number; time: number }): void {
  ctx.fillStyle = '#1d2b3a';
  ctx.font = '800 10px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('REVEAL INDEX · LIVE', x + 2, top + 1, w - 4);
  blob(ctx, x + w - 6, top + 6, 3.5, 3.5, noise(Math.floor(d.time * 2)) > 0.3 ? '#e8323f' : '#f39aa5', 0);
  const px = x + 4;
  const py = top + 18;
  const pw = w - 8;
  const ph = h - 30;
  ctx.strokeStyle = 'rgba(29, 43, 58, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(px, py + (ph * i) / 3);
    ctx.lineTo(px + pw, py + (ph * i) / 3);
    ctx.stroke();
  }
  const hist = y.history.length > 1 ? y.history : [0, Math.log10(Math.max(1, d.multiplier))];
  const n = hist.length;
  const peak = Math.pow(10, Math.max(0.05, hist[n - 1]!));
  const flat = d.crashT >= 0 ? smoothstep(AT.flat, AT.flat + 0.4, d.crashT) : 0;
  const pt = (i: number): [number, number] => {
    const m = Math.pow(10, hist[i]!);
    const v = (m - 1) / Math.max(0.01, peak - 1);
    const wob = (noise(i * 1.7 + 3) - 0.5) * 0.06 * (i > 0 ? 1 : 0);
    return [px + (pw * i) / Math.max(1, n - 1) * (flat > 0 ? 0.9 : 1), py + ph - clamp(v + wob, 0, 1.05) * ph];
  };
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const [qx, qy] = pt(i);
    if (i === 0) ctx.moveTo(qx, qy);
    else ctx.lineTo(qx, qy);
  }
  const [lx, ly] = pt(n - 1);
  if (flat > 0) {
    ctx.lineTo(lx + 2, mix(ly, py + ph, flat));
    ctx.lineTo(px + pw, py + ph);
  }
  ctx.strokeStyle = flat > 0 ? '#e8323f' : '#1fa35c';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.lineTo(flat > 0 ? px + pw : lx, py + ph);
  ctx.lineTo(px, py + ph);
  ctx.closePath();
  ctx.fillStyle = flat > 0 ? 'rgba(232, 50, 63, 0.12)' : 'rgba(31, 163, 92, 0.15)';
  ctx.fill();
  ctx.fillStyle = flat > 0 ? '#e8323f' : '#1d2b3a';
  ctx.font = '900 12px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(flat > 0 ? '0.00' : `${d.multiplier.toFixed(2)}×`, x + w - 2, top + h - 12, w);
}

function drawChat(ctx: CanvasRenderingContext2D, y: Yard, x: number, top: number, w: number, h: number, time: number): void {
  ctx.fillStyle = '#2f5d8a';
  ctx.fillRect(x, top, w, 15);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 9px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`FAMILY CHAT (${y.chatCount})`, x + 4, top + 8, w - 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top + 15, w, h - 15);
  ctx.clip();
  const rowH = 25;
  let yy = top + h - 6 + clamp(y.scroll.x, 0, 3) * rowH;
  for (let i = y.chat.length - 1; i >= 0 && yy > top + 10; i -= 1) {
    const m = y.chat[i]!;
    const mine = m.sender === 'AUNT CAROL' || m.sender === 'COUSIN BRAD';
    yy -= rowH;
    ctx.fillStyle = mine ? '#dff0ff' : '#ece9f2';
    ctx.beginPath();
    ctx.roundRect(x + 3, yy, w - 6, rowH - 3, 5);
    ctx.fill();
    ctx.fillStyle = m.sender === 'COUSIN BRAD' ? '#1f8a4c' : '#b2386a';
    ctx.font = '800 7.5px "Trebuchet MS", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(m.sender, x + 6, yy + 2, w - 12);
    ctx.fillStyle = '#1d2b3a';
    ctx.font = '700 10px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText(m.text, x + 6, yy + 11, w - 12);
  }
  ctx.restore();
  // The typing dots.
  for (let i = 0; i < 3; i += 1) {
    blob(ctx, x + 8 + i * 6, top + h - 2, 1.6, 1.6, `rgba(29, 43, 58, ${0.3 + 0.5 * (fract(time * 1.6 - i * 0.2) < 0.5 ? 1 : 0)})`, 0);
  }
}

/** The garage door's screensaver after the flatline: a stock photo with its watermark, and no one in it. */
function drawStockPhoto(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }): void {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, '#fbe3ee');
  g.addColorStop(1, '#dcefff');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 8;
  // A placeholder image: a frame, mountains and a sun, a soft blanket bundle on a pillow.
  ctx.strokeStyle = '#9aa5b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 62, cy - 44, 124, 86);
  ctx.fillStyle = '#c4cbd8';
  ctx.beginPath();
  ctx.moveTo(cx - 58, cy + 38);
  ctx.lineTo(cx - 24, cy - 6);
  ctx.lineTo(cx, cy + 16);
  ctx.lineTo(cx + 22, cy - 2);
  ctx.lineTo(cx + 58, cy + 38);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 34, cy - 22, 9, 0, Math.PI * 2);
  ctx.fill();
  blob(ctx, cx - 6, cy + 30, 30, 9, '#f2f2f6', 0);
  blob(ctx, cx - 6, cy + 24, 18, 9, '#f6cfe0', 0);
  ctx.fillStyle = '#9aa5b8';
  ctx.font = '700 9px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('reveal_photo_FINAL(2).jpg', cx, r.y + r.h - 12, r.w - 10);
  // The watermark, big and diagonal, twice.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.38);
  ctx.font = '900 28px Impact, "Arial Black", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.strokeStyle = 'rgba(120, 130, 150, 0.6)';
  ctx.lineWidth = 2;
  for (const off of [-40, 36]) {
    ctx.strokeText('STOCK PHOTO', off * 0.3, off, r.w * 0.8);
    ctx.fillText('STOCK PHOTO', off * 0.3, off, r.w * 0.8);
  }
  ctx.restore();
}

// ─── The side gate and the bounce house ─────────────────────────────────────────────────────────────────────
export function drawGate(ctx: CanvasRenderingContext2D, y: Yard): void {
  const open = clamp(y.gate, 0, 1);
  // The leaf swings outward on its far hinge, foreshortening as it goes.
  const w = GATE.w * Math.cos(open * 1.35);
  const x1 = GATE.x + GATE.w;
  const x0 = x1 - w;
  poly(ctx, [x0, GATE.top + 4 + open * 6, x1, GATE.top, x1, GATE.bottom, x0, GATE.bottom - open * 6], '#c78a56', 2.5);
  if (w > 10) {
    ctx.strokeStyle = 'rgba(90, 45, 20, 0.5)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 3; k += 1) {
      const px = mix(x0, x1, k / 3);
      ctx.beginPath();
      ctx.moveTo(px, GATE.top + 4);
      ctx.lineTo(px, GATE.bottom - 2);
      ctx.stroke();
    }
    lines(ctx, [[x0 + 2, GATE.bottom - 20, x1 - 2, GATE.top + 26]], '#8a5734', 5);
    // The latch.
    box(ctx, x0 + 2, GATE.top + 66, 10, 6, 2, '#2b2b33', 1.5);
  }
  label(ctx, 'SIDE GATE', GATE.x + 12, GATE.top - 8, 8, '#5a3324', 800, 56);
}

export function drawBounceHouse(ctx: CanvasRenderingContext2D, time: number, tension: number, bass: number): void {
  // Never inflated, lying in the sun like a fallen elephant; the subwoofer inside thumps the vinyl.
  const thump = Math.pow(Math.max(0, Math.sin(time * Math.PI * 2 * (2.1 + 0.6 * tension))), 12) * (2 + 4 * tension) * bass;
  ctx.save();
  ctx.translate(BOUNCE.x, BOUNCE.y);
  ctx.scale(1 + thump * 0.004, 1 + thump * 0.022);
  cached(ctx, heapLayer, -56, -86, 220, 104, paintHeap);
  ctx.restore();
}

function paintHeap(ctx: CanvasRenderingContext2D): void {
  const w = BOUNCE.w;
  blob(ctx, w / 2, 2, w * 0.62, 10, 'rgba(30, 60, 30, 0.25)', 0);
  // The limp turret, folded over.
  ctx.fillStyle = '#3f8fe6';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(w - 30, -30);
  ctx.quadraticCurveTo(w - 10, -76, w + 22, -64);
  ctx.quadraticCurveTo(w + 34, -54, w + 18, -46);
  ctx.quadraticCurveTo(w - 4, -54, w - 8, -26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  blob(ctx, w + 24, -58, 8, 6, '#ffd166', 2);
  // The heap.
  ctx.fillStyle = '#e04a4a';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.quadraticCurveTo(-10, -30, 14, -40);
  ctx.quadraticCurveTo(40, -66, 70, -48);
  ctx.quadraticCurveTo(96, -60, 112, -36);
  ctx.quadraticCurveTo(w + 14, -18, w + 6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Yellow trim and wrinkles.
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(4, -6);
  ctx.quadraticCurveTo(60, -16, w, -6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90, 10, 20, 0.45)';
  ctx.lineWidth = 2;
  for (const [a, b, c2, d] of [[24, -30, 44, -18], [60, -44, 70, -24], [92, -36, 100, -20], [40, -50, 58, -40]] as const) {
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.quadraticCurveTo((a + c2) / 2 + 6, (b + d) / 2, c2, d);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(58, -30);
  ctx.rotate(-0.12);
  label(ctx, 'BOUNCE!', 0, 0, 11, '#fff1c9', 900);
  ctx.restore();
  // The blower, unplugged, its plug in the grass.
  box(ctx, -30, -18, 22, 18, 4, '#f08a24', 2);
  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-19, 0);
  ctx.quadraticCurveTo(-30, 14, -50, 10);
  ctx.stroke();
}

// ─── The dessert table: projector, cake, the last slice, the water ──────────────────────────────────────────
export interface TableDrive {
  time: number;
  multiplier: number;
  tension: number;
  crashT: number;
}

export function drawTableBack(ctx: CanvasRenderingContext2D): void {
  // The table's far edge, drawn before whoever sits behind it.
  poly(ctx, [TABLE.x + 6, TABLE.top - 8, TABLE.x + TABLE.w - 6, TABLE.top - 8, TABLE.x + TABLE.w, TABLE.top, TABLE.x, TABLE.top], '#f6f1ea', 2.5);
}

function paintCloth(ctx: CanvasRenderingContext2D): void {
  const { x, top, w, front } = TABLE;
  ctx.fillStyle = '#fbf7f1';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + w, top);
  ctx.lineTo(x + w + 4, front);
  for (let i = 10; i >= 0; i -= 1) {
    const hx = x - 4 + ((w + 8) * i) / 10;
    ctx.quadraticCurveTo(hx + (w + 8) / 20, front + 7, hx, front);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 12; i += 1) {
    ctx.fillStyle = i % 2 ? 'rgba(245, 154, 192, 0.35)' : 'rgba(127, 195, 240, 0.35)';
    ctx.fillRect(x - 6 + i * 19, top + 6, 9, front - top);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(x - 10, top, w + 20, 6);
  ctx.restore();
}

export function drawTable(ctx: CanvasRenderingContext2D, y: Yard, d: TableDrive): void {
  const { x, top, w, front } = TABLE;
  // The cloth, painted once; when Kyle peeks, its left corner turns up.
  cached(ctx, clothLayer, x - 12, top - 4, w + 24, front - top + 16, paintCloth);
  const peek = clamp(y.peek, 0, 1);
  if (peek > 0.02) {
    const lift = peek * 24;
    poly(ctx, [x - 4, front, x + 26, front + 4, x + 22, front - lift * 0.6, x - 2 - lift * 0.3, front - lift], '#e9e1d6', 2);
  }
  // The laptop's glow leaking from under the cloth, and the cable up to the projector.
  blob(ctx, x + 22, front + 6, 26, 4, `rgba(110, 200, 255, ${0.35 + 0.15 * Math.sin(d.time * 5)})`, 0);
  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, front - 6);
  ctx.quadraticCurveTo(x - 4, top + 20, x + 4, top + 2);
  ctx.lineTo(PROJECTOR.x - 6, PROJECTOR.y + 6);
  ctx.stroke();
  // The projector, pointed up at the garage door.
  ctx.save();
  ctx.translate(PROJECTOR.x, PROJECTOR.y);
  ctx.rotate(-0.25);
  box(ctx, -14, -10, 30, 18, 4, '#3b3f4c', 2.5);
  blob(ctx, 16, -1, 5, 6, '#9fd2f5', 2);
  ctx.fillStyle = '#7cf67c';
  ctx.fillRect(-9, -6, 3, 2);
  ctx.restore();
  // The water: sparkling, in a bottle, until 25×.
  drawBottle(ctx, y, d.time);
  drawCake(ctx, d);
  // The napkins, folded for burritos.
  for (let i = 0; i < 3; i += 1) box(ctx, x + w - 26, top - 6 - i * 3, 20, 4, 1, i % 2 ? '#fde3ee' : '#e3f1fd', 1.2);
  // The last slice, on its plate, between the grandmothers.
  blob(ctx, PLATE.x, PLATE.y, 18, 5, '#ffffff', 2);
  if (!y.sliceTaken) drawSlice(ctx, PLATE.x - 1, PLATE.y - 3, 1);
}

/** A wedge of the neutral cake with a rosette; the plus-one's whole reason for being here. */
export function drawSlice(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, [-11, 0, 11, 0, 9, -11, -7, -14], '#f4e9d8', 2);
  ctx.fillStyle = PINK;
  ctx.fillRect(-9, -6, 9, 2);
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, -6, 9, 2);
  blob(ctx, 1, -15, 4, 3, '#ffffff', 1.5);
  ctx.restore();
}

function drawBottle(ctx: CanvasRenderingContext2D, y: Yard, time: number): void {
  const tip = clamp(y.spill.x, 0, 1.15);
  ctx.save();
  ctx.translate(BOTTLE_X, TABLE.top - 2);
  if (tip > 0.02) {
    // The puddle, spreading along the table and dripping over the front edge.
    const spread = clamp(tip, 0, 1);
    blob(ctx, 18, 2, 8 + 26 * spread, 3 + 2 * spread, 'rgba(160, 220, 255, 0.65)', 0);
    for (let i = 0; i < 3; i += 1) {
      const fall = fract(time * 0.8 + i * 0.33);
      blob(ctx, 6 + i * 12, 6 + fall * 50 * spread, 1.6, 2.6, 'rgba(160, 220, 255, 0.8)', 0);
    }
  }
  ctx.rotate(tip * Math.PI * 0.5);
  ctx.fillStyle = 'rgba(190, 235, 215, 0.95)';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-6, -22);
  ctx.quadraticCurveTo(-6, -28, -3, -30);
  ctx.lineTo(-3, -36);
  ctx.lineTo(3, -36);
  ctx.lineTo(3, -30);
  ctx.quadraticCurveTo(6, -28, 6, -22);
  ctx.lineTo(6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7a8c8';
  ctx.fillRect(-6, -16, 12, 7);
  label(ctx, 'FIZZ', 0, -12.5, 5, '#ffffff', 900);
  // Bubbles.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  for (let i = 0; i < 3; i += 1) {
    const u = fract(time * (0.7 + 0.5 * tip) + i / 3);
    ctx.beginPath();
    ctx.arc(-2 + i * 2, -3 - u * 26, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The two-tier cake. Its frosting is a horizontal gradient whose stops move: neutral at rest, then from about
 * 1.8× the dye separates into pink on one side and blue on the other, the boundary sloshing like a chart (the
 * two colours trade places faster with the tension), with marbled swirls at the boundary and sweat beading at
 * high tension. At the crash it slumps into a pink puddle and a blue one.
 */
function drawCake(ctx: CanvasRenderingContext2D, d: TableDrive): void {
  const sep = smoothstep(1.65, 2.5, d.multiplier);
  const phase = d.time * (0.5 + 2.4 * d.tension);
  const f = 0.5 + 0.38 * sep * Math.sin(phase) + 0.08 * sep * Math.sin(phase * 2.7 + 1);
  const collapse = d.crashT >= 0 ? smoothstep(AT.cake, AT.cake + AT.cakeFor, d.crashT) : 0;
  const base = TABLE.top - 4;
  ctx.save();
  ctx.translate(CAKE_X, base);
  // The cake stand.
  box(ctx, -46, -4, 92, 6, 3, '#ffffff', 2);
  box(ctx, -8, 2, 16, 4, 2, '#ffffff', 1.5);
  if (collapse > 0) {
    // Collapsed into its two dyes, a puddle each, apart.
    const s = collapse;
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? PINK : BLUE;
      ink(ctx, 2.5);
      ctx.beginPath();
      const cx = side * (16 + 14 * s);
      const hh = mix(40, 9, s);
      const ww = mix(30, 40, s);
      ctx.moveTo(cx - ww, -4);
      ctx.quadraticCurveTo(cx - ww * 0.8, -hh, cx, -hh - 3);
      ctx.quadraticCurveTo(cx + ww * 0.8, -hh, cx + ww, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      blob(ctx, cx - 6, -hh + 4, 10, 3, 'rgba(255, 255, 255, 0.35)', 0);
      // Drips over the stand.
      blob(ctx, cx + side * 26, 4 + 6 * s, 3, 6 * s + 1, side < 0 ? PINK : BLUE, 0);
    }
    ctx.restore();
    return;
  }
  const tier = (w: number, h: number, y0: number, seed: number) => {
    const wob = 0.12 * sep * Math.sin(d.time * 1.7 + seed);
    const g = ctx.createLinearGradient(-w / 2, y0 - h * wob * 4, w / 2, y0 + h * wob * 4);
    const pinkish = mixHex(NEUTRAL, PINK, sep);
    const bluish = mixHex(NEUTRAL, BLUE, sep);
    const soft = 0.04 + 0.3 * (1 - sep);
    g.addColorStop(0, pinkish);
    g.addColorStop(clamp(f - soft, 0.01, 0.98), pinkish);
    g.addColorStop(clamp(f + soft, 0.02, 0.99), bluish);
    g.addColorStop(1, bluish);
    ctx.fillStyle = g;
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.roundRect(-w / 2, y0 - h, w, h, 5);
    ctx.fill();
    ctx.stroke();
    // The drip-frosting along the top edge, in the same gradient.
    ctx.beginPath();
    ctx.moveTo(-w / 2, y0 - h + 2);
    for (let i = 0; i <= 8; i += 1) {
      const dx = -w / 2 + (w * i) / 8;
      const drop = 4 + 4 * noise(i + seed) + 6 * sep * noise(i * 3 + seed) * (0.6 + 0.4 * Math.sin(d.time * 2 + i));
      ctx.quadraticCurveTo(dx - w / 16, y0 - h + drop + 4, dx, y0 - h + 4);
    }
    ctx.lineTo(w / 2, y0 - h);
    ctx.lineTo(-w / 2, y0 - h);
    ctx.closePath();
    ctx.fillStyle = sep > 0.05 ? 'rgba(255, 255, 255, 0.55)' : '#faf6ee';
    ctx.fill();
    // Marbling at the boundary: the two dyes curl into each other.
    if (sep > 0.05) {
      const bx = -w / 2 + w * f;
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k += 1) {
        ctx.strokeStyle = k % 2 ? `rgba(245, 154, 192, ${0.8 * sep})` : `rgba(127, 195, 240, ${0.8 * sep})`;
        ctx.beginPath();
        for (let j = 0; j <= 6; j += 1) {
          const yy = y0 - h + 6 + ((h - 8) * j) / 6;
          const xx = bx + (k - 1) * 4 + Math.sin(j * 1.4 + d.time * 3 + k + seed) * 4 * sep;
          if (j === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
    }
    // Sweat: beads on both colours as the tension climbs.
    const sweat = smoothstep(0.45, 0.85, d.tension);
    if (sweat > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * sweat})`;
      for (let i = 0; i < 5; i += 1) {
        const sx = -w / 2 + 6 + ((w - 12) * noise(i * 5.1 + seed));
        const run = fract(d.time * (0.25 + 0.3 * sweat) + noise(i + seed));
        ctx.beginPath();
        ctx.ellipse(sx, y0 - h + 8 + run * (h - 10), 1.6, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  tier(80, 36, 0, 1);
  tier(56, 28, -36, 4);
  // The topper: a little question mark on a pick.
  lines(ctx, [[0, -64, 0, -78]], INK, 2);
  ctx.font = '900 18px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.strokeText('?', 0, -86);
  ctx.fillStyle = '#ffd36b';
  ctx.fillText('?', 0, -86);
  ctx.restore();
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(mix((pa >> s) & 255, (pb >> s) & 255, clamp(t, 0, 1)));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

// ─── The reveal box ─────────────────────────────────────────────────────────────────────────────────────────
export function boxLift(y: Yard, time: number): number {
  return clamp(y.lev.x, 0, 1.2) * (7 + 3 * Math.sin(time * 2.1));
}

export function drawBox(ctx: CanvasRenderingContext2D, y: Yard, time: number, crashT: number): void {
  const lift = boxLift(y, time);
  const { x, base, w, h } = BOX;
  const left = x - w / 2;
  const open = crashT >= 0;
  // The shadow, smaller as it lifts.
  blob(ctx, x, base + 2, w * 0.6 * (1 - lift / 40), 9, 'rgba(30, 60, 30, 0.3)', 0);
  ctx.save();
  const wobble = clamp(y.lev.x, 0, 1) * Math.sin(time * 3.3) * 0.02;
  ctx.translate(x, base - lift);
  ctx.rotate(wobble);
  ctx.translate(-x, -base);
  if (!open) {
    cached(ctx, boxLayer, left - 4, base - h - 26, w + 18, h + 30, paintBox);
    drawLatch(ctx, y, x, base - h + 26, time);
    ctx.restore();
    return;
  }
  drawOpenBox(ctx, crashT, time);
  ctx.restore();
  drawLid(ctx, crashT);
}

/** The closed box: the top face, the front, the ribbon, the bow, the lettering. */
function paintBox(ctx: CanvasRenderingContext2D): void {
  const { x, base, w, h } = BOX;
  const left = x - w / 2;
  {
    poly(ctx, [left, base - h, left + 10, base - h - 10, left + w + 10, base - h - 10, left + w, base - h], '#f4f1ec');
    poly(ctx, [left + w, base, left + w, base - h, left + w + 10, base - h - 10, left + w + 10, base - 10], '#dedad2');
    box(ctx, left, base - h, w, h, 2, '#ffffff', 2.5);
    ctx.fillStyle = '#ecd59a';
    ctx.fillRect(x - 7, base - h + 1, 14, h - 2);
    ctx.fillRect(left + 1, base - h * 0.55, w - 2, 10);
    blob(ctx, x - 14, base - h - 12, 13, 8, '#ecd59a', 2, -0.4);
    blob(ctx, x + 14, base - h - 12, 13, 8, '#ecd59a', 2, 0.4);
    blob(ctx, x, base - h - 10, 6, 6, '#e0bf6a', 2);
    ctx.font = '900 14px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e06a9a';
    ctx.fillText('BOY', left + 28, base - 20);
    ctx.fillStyle = '#9aa0ad';
    ctx.font = '700 10px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText('or', x, base - 20);
    ctx.fillStyle = '#4a98d4';
    ctx.font = '900 14px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText('GIRL?', left + w - 30, base - 20);
  }
}

function drawOpenBox(ctx: CanvasRenderingContext2D, crashT: number, time: number): void {
  const { x, base, w, h } = BOX;
  const left = x - w / 2;
  // Open: the back and sides stand; the front panel has fallen toward us; inside, a fog machine and a phone.
  const fallen = smoothstep(0, 0.32, crashT);
  const bounce = Math.exp(-6 * Math.max(0, crashT - 0.32)) * Math.sin(Math.max(0, crashT - 0.32) * 22) * 0.12;
  const phi = clamp(fallen + bounce, 0, 1.05) * Math.PI / 2;
  poly(ctx, [left, base - h, left + 10, base - h - 10, left + w + 10, base - h - 10, left + w + 10, base - 10, left + w, base, left, base], '#cfcac0');
  ctx.fillStyle = '#5b5560';
  ctx.fillRect(left + 4, base - h + 2, w - 8, h - 4);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(left + 4, base - h + 2, w - 8, 14);
  // The fog machine, the phone propped on it, glowing.
  box(ctx, x - 34, base - 26, 68, 24, 4, '#26262e', 2.5);
  blob(ctx, x + 26, base - 16, 5, 5, '#3a3a44', 2);
  ctx.fillStyle = '#e8323f';
  ctx.fillRect(x - 28, base - 20, 6, 3);
  const glow = 0.5 + 0.2 * Math.sin(time * 6);
  blob(ctx, x, base - 62, 40, 40, `rgba(124, 246, 124, ${0.25 * glow})`, 0);
  box(ctx, x - 24, base - 104, 48, 80, 7, '#1d1d24', 2.5);
  ctx.fillStyle = '#0f1a14';
  ctx.fillRect(x - 20, base - 98, 40, 68);
  ctx.fillStyle = '#7cf67c';
  ctx.font = '900 12px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$BABY', x, base - 88, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 10px "Trebuchet MS", system-ui, sans-serif';
  ctx.fillText('IS LIVE', x, base - 76, 38);
  lines(ctx, [[x - 16, base - 38, x - 8, base - 44, x - 2, base - 41, x + 6, base - 56, x + 10, base - 52, x + 16, base - 64]], '#7cf67c', 2);
  blob(ctx, x - 14, base - 66, 2.5, 2.5, '#e8323f', 0);
  // The front panel, hinged at the bottom, falling toward the lawn.
  const top = base - h * Math.cos(phi) + h * 0.45 * Math.sin(phi);
  const spread = 10 * Math.sin(phi);
  poly(ctx, [left, base, left + w, base, left + w + spread, top, left - spread, top], '#ffffff');
  if (phi > 0.8) {
    ctx.fillStyle = '#ecd59a';
    ctx.fillRect(x - 7, Math.min(base, top), 14, Math.abs(top - base));
  }
}

function drawLid(ctx: CanvasRenderingContext2D, crashT: number): void {
  const { x, base, w, h } = BOX;
  // The lid, blown off: up, over, and down on the lawn to the left.
  const t = Math.min(crashT, 1.05);
  const lx = x - 160 * t;
  const ly = base - h - 10 - 520 * t + 0.5 * 1150 * t * t;
  const landed = crashT >= 1.05;
  ctx.save();
  ctx.translate(lx, landed ? base + 34 : ly);
  ctx.rotate(landed ? Math.PI + 0.08 : t * 6);
  poly(ctx, [-w / 2, 0, -w / 2 + 10, -10, w / 2 + 10, -10, w / 2, 0], '#f4f1ec');
  box(ctx, -w / 2, 0, w, 12, 2, '#ffffff', 2.5);
  blob(ctx, 0, -12, 8, 6, '#ecd59a', 2);
  ctx.restore();
}

function drawLatch(ctx: CanvasRenderingContext2D, y: Yard, x: number, yy: number, time: number): void {
  const warm = clamp(y.warm.x, 0, 1);
  if (warm > 0.02) {
    // Warm from 5×: a glow, and heat shimmering off the box.
    for (const [r, a] of [[26, 0.12], [16, 0.22]] as const) {
      blob(ctx, x, yy + 4, r, r, `rgba(255, 120, 40, ${a * warm * (0.8 + 0.2 * Math.sin(time * 5))})`, 0);
    }
    ctx.strokeStyle = `rgba(255, 140, 60, ${0.55 * warm})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      const hx = x - 24 + i * 24;
      const rise = fract(time * 0.8 + i * 0.37);
      ctx.beginPath();
      for (let j = 0; j <= 6; j += 1) {
        const py = yy - 40 - rise * 24 - j * 4;
        const px = hx + Math.sin(j * 1.3 + time * 6 + i) * 3;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  // The hasp and the padlock, in brass that reddens as it warms.
  const brass = mixHex('#d9b24a', '#ff6a2a', warm);
  box(ctx, x - 6, yy - 14, 12, 16, 2, brass, 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, yy + 2, 6, Math.PI, 0);
  ctx.stroke();
  box(ctx, x - 9, yy + 2, 18, 14, 3, brass, 2);
  blob(ctx, x, yy + 8, 2, 2, INK, 0);
  ctx.fillRect(x - 1, yy + 8, 2, 4);
}

// ─── The crash in the air: fog, receipts, shards ────────────────────────────────────────────────────────────
/** The theatrical fog behind the people: a red haze that pools and lingers. */
export function drawFogBack(ctx: CanvasRenderingContext2D, y: Yard, crashT: number): void {
  const fx = y.crash;
  if (!fx || crashT < 0) return;
  for (let i = 0; i < fx.puffs.length; i += 2) drawPuff(ctx, fx.puffs[i]!, crashT, 0.42);
}

export function drawFogFront(ctx: CanvasRenderingContext2D, y: Yard, crashT: number): void {
  const fx = y.crash;
  if (!fx || crashT < 0) return;
  for (let i = 1; i < fx.puffs.length; i += 2) drawPuff(ctx, fx.puffs[i]!, crashT, 0.3);
  // A low haze over the whole lawn once the machine has vented.
  const haze = smoothstep(0.2, 2.5, crashT);
  const g = ctx.createLinearGradient(0, 260, 0, 540);
  g.addColorStop(0, 'rgba(232, 70, 90, 0)');
  g.addColorStop(0.5, `rgba(232, 90, 110, ${0.14 * haze})`);
  g.addColorStop(1, `rgba(232, 70, 90, ${0.1 * haze})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 260, 960, 280);
}

function drawPuff(ctx: CanvasRenderingContext2D, p: Flier, t: number, alpha: number): void {
  const u = t - p.t0;
  if (u <= 0) return;
  const e = 1 - Math.exp(-1.2 * u);
  const x = p.x + (p.vx / 1.2) * e * 1.6 + Math.sin(u * 0.7 + p.tint * 6) * 12;
  const yy = p.y + (p.vy / 1.2) * e - 10 * u;
  const r = p.size * (0.35 + 1.25 * e);
  const a = alpha * clamp(u / 0.2, 0, 1) * (0.25 + 0.75 * Math.exp(-0.7 * u));
  ctx.fillStyle = `rgba(${Math.round(232 + 20 * p.tint)}, ${Math.round(80 + 50 * p.tint)}, ${Math.round(100 + 20 * p.tint)}, ${a})`;
  ctx.beginPath();
  // A wisp: three overlapping lobes, not a disc.
  ctx.arc(x, Math.max(80, yy), r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.7, Math.max(80, yy) + r * 0.2, r * 0.6, 0, Math.PI * 2);
  ctx.arc(x - r * 0.6, Math.max(80, yy) + r * 0.3, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** The receipts: itemized, for everyone; the pieces of the piñata. */
export function drawDebris(ctx: CanvasRenderingContext2D, y: Yard, crashT: number, landedOnly: boolean): void {
  const fx = y.crash;
  if (!fx || crashT < 0) return;
  for (const f of fx.shards) {
    if (crashT < f.t0) continue;
    const p = shardAt(f, crashT, { x: PINATA_PIVOT.x, y: PINATA_PIVOT.y + ROPE + 30 });
    if (landedOnly !== (p.y >= f.ground)) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    poly(ctx, [-7 * f.size, -3 * f.size, 6 * f.size, -5 * f.size, 8 * f.size, 4 * f.size, -5 * f.size, 5 * f.size], f.tint > 0.5 ? PINK : BLUE, 1.5);
    ctx.restore();
  }
  for (const f of fx.receipts) {
    if (crashT < f.t0) continue;
    const p = paperAt(f, crashT);
    if (landedOnly !== p.landed) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const s = f.size;
    ctx.scale(s, p.landed ? s * 0.5 : s * (0.6 + 0.4 * Math.abs(Math.cos(crashT * 4 + f.tint * 9))));
    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = 'rgba(29, 20, 24, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.lineTo(6, -9);
    ctx.lineTo(6, 8);
    for (let k = 0; k < 4; k += 1) ctx.lineTo(6 - 3 * k - 1.5, k % 2 ? 8 : 10);
    ctx.lineTo(-6, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(60, 60, 70, 0.6)';
    for (let k = 0; k < 4; k += 1) ctx.fillRect(-4, -6 + k * 3.5, k === 3 ? 8 : 5 + (k % 2) * 3, 1.2);
    ctx.restore();
  }
}

/** The crash flash, and the first burst of fog light from the box. */
export function drawFlash(ctx: CanvasRenderingContext2D, crashT: number): void {
  if (crashT < 0 || crashT > 0.6) return;
  const a = 1 - crashT / 0.6;
  ctx.fillStyle = `rgba(255, 235, 240, ${0.7 * a})`;
  ctx.fillRect(0, 0, 960, 540);
}
