/**
 * The stream's chrome and its chat. The top bar (LIVE, the title, who is watching), the frames around the three
 * panes, the chat column whose lines come from pools that unlock with the multiplier and post faster with the
 * tension, the DMs that slide onto the founder's cam, the pinned row that is you (holding, then SOLD, then shades
 * through the crash if you got out), the flood at the crash and the STREAM ENDED card. Presentation only:
 * everything follows the displayed multiplier, the clock and the crash age.
 */
import { BEATS, CAM, CHAT, SHARE, TOPBAR_H } from './den';
import { box, INK, wrap } from './ink';
import { clamp, mulberry32, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';
import { CHAT_TIERS, DMS, ENDED, FLOOD, NAMES, TITLE, YOU_SOLD } from './pitch';

const UI_FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const ROW_1 = 24;
const ROW_2 = 36;
/** The pinned row's height at the foot of the column. */
const PIN_H = 40;
const MAX_MESSAGES = 24;
const NAME_COLOURS = ['#ff9ad5', '#7cf67c', '#8fd3ff', '#ffe27a', '#ffb347', '#c9a8ff'];

export interface Message { name: string; text: string; y: number; age: number; hot: boolean; you: boolean; rows: number }
export interface Toast { from: string; text: string; age: number }

export interface Chat {
  messages: Message[];
  nextAt: number;
  /** The seeded generator for the pools, and the last line, so no line repeats back to back. */
  rand: () => number;
  last: string;
  flooded: boolean;
  floodCount: number;
  /** You: sold at this multiplier for this payout, or holding; shades on through a dodged crash. */
  sold: { x100: number; payout: number | null } | null;
  shades: Spring;
  pop: Spring;
  viewers: Spring;
  toasts: Toast[];
  dmsDue: number;
  events: { post: boolean; dm: boolean };
}

export const viewersAt = (multiplier: number): number => Math.floor(420 * Math.pow(Math.max(1, multiplier), 1.25));

export function createChat(): Chat {
  return { messages: [], nextAt: 0.6, rand: mulberry32(0xfeed), last: '', flooded: false, floodCount: 0, sold: null, shades: spring(0), pop: spring(0), viewers: spring(420), toasts: [], dmsDue: 0, events: { post: false, dm: false } };
}

export function resetChat(c: Chat): void {
  c.messages = [];
  c.nextAt = 0.6;
  c.rand = mulberry32(0xfeed);
  c.last = '';
  c.flooded = false;
  c.floodCount = 0;
  c.sold = null;
  settleSpring(c.shades, 0);
  settleSpring(c.pop, 0);
  settleSpring(c.viewers, 420);
  c.toasts = [];
  c.dmsDue = 0;
}

export interface ChatDrive {
  time: number;
  tension: number;
  multiplier: number;
  running: boolean;
  betting: boolean;
  /** Seconds since the crash, or −1 before it. */
  crash: number;
}

/** How many rows a line takes in the column. */
const rowsFor = (text: string): number => (text.length > 24 ? 2 : 1);

function post(c: Chat, name: string, text: string, hot: boolean, you = false): void {
  const rows = rowsFor(text);
  const height = rows === 1 ? ROW_1 : ROW_2;
  for (const m of c.messages) m.y -= height;
  c.messages.push({ name, text, y: CHAT.h - PIN_H - height, age: 0, hot, you, rows });
  if (c.messages.length > MAX_MESSAGES) c.messages.shift();
  c.events.post = true;
}

/** A line from the pools unlocked at `multiplier`, never the same twice running; the hotter tiers more often. */
function pick(c: Chat, multiplier: number): string {
  const tiers = CHAT_TIERS.filter(([at]) => multiplier >= at);
  for (let tries = 0; tries < 6; tries += 1) {
    // Lean toward the newest tier: half the picks come from the top two unlocked tiers.
    const index = c.rand() < 0.5 ? Math.max(0, tiers.length - 1 - Math.floor(c.rand() * 2)) : Math.floor(c.rand() * tiers.length);
    const pool = tiers[index]![1];
    const text = pool[Math.floor(c.rand() * pool.length)]!;
    if (text !== c.last) return text;
  }
  return tiers[0]![1][0]!;
}

const nameFor = (c: Chat): string => NAMES[Math.floor(c.rand() * NAMES.length)]!;

/** Your sale lands: the pinned row flips and you post. */
export function sellChat(c: Chat, x100: number, payout: number | null, live: boolean): void {
  c.sold = { x100, payout };
  if (live) {
    post(c, 'you', YOU_SOLD, false, true);
    c.pop.v = 10;
  }
}

/** The crash: the flood, at once for a late entry. */
export function floodChat(c: Chat, quiet: boolean): void {
  c.flooded = true;
  if (quiet) {
    c.messages = [];
    FLOOD.slice(0, 11).forEach((text, i) => post(c, NAMES[(i * 5) % NAMES.length]!, text, true));
    c.floodCount = 11;
    for (const m of c.messages) m.age = 2;
  }
}

/** Jumps the chat to a round already at `multiplier`: a column of lines said, the viewers, the DMs already read. */
export function settleChat(c: Chat, d: ChatDrive): void {
  resetChat(c);
  for (let i = 0; i < 9; i += 1) post(c, nameFor(c), (c.last = pick(c, d.multiplier)), false);
  for (const m of c.messages) m.age = 3;
  settleSpring(c.viewers, viewersAt(d.multiplier));
  c.dmsDue = DMS.filter(([at]) => d.multiplier >= at).length;
  c.nextAt = d.time + 0.5;
  if (d.crash >= 0) floodChat(c, true);
}

export function stepChat(c: Chat, d: ChatDrive, dt: number): void {
  c.events = { post: false, dm: false };
  const crashed = d.crash >= 0;
  stepSpring(c.viewers, crashed ? Math.max(3, viewersAt(d.multiplier) * (1 - smoothstep(BEATS.holders, BEATS.ended, d.crash))) : viewersAt(d.multiplier), crashed ? 3 : 5, 0.9, dt);
  for (const m of c.messages) m.age += dt;
  for (const t of c.toasts) t.age += dt;
  c.toasts = c.toasts.filter((t) => t.age < 3.4);
  stepSpring(c.shades, crashed && c.sold ? 1 : 0, 10, 0.6, dt);
  stepSpring(c.pop, 0, 12, 0.4, dt);
  // Posting: idle chatter while bets are open, a quickening stream while it runs, the flood at the crash.
  if (d.time >= c.nextAt) {
    if (c.flooded) {
      if (c.floodCount < 14) {
        post(c, nameFor(c), FLOOD[c.floodCount % FLOOD.length]!, true);
        c.floodCount += 1;
        c.nextAt = d.time + 0.09 + c.rand() * 0.06;
      } else {
        post(c, nameFor(c), FLOOD[Math.floor(c.rand() * FLOOD.length)]!, true);
        c.nextAt = d.time + 0.7 + c.rand() * 0.6;
      }
    } else if (d.running) {
      c.last = pick(c, d.multiplier);
      post(c, nameFor(c), c.last, false);
      c.nextAt = d.time + 1.15 - 0.8 * d.tension + c.rand() * 0.4;
    } else if (d.betting) {
      c.last = pick(c, 1);
      post(c, nameFor(c), c.last, false);
      c.nextAt = d.time + 1.6 + c.rand() * 0.8;
    } else c.nextAt = d.time + 0.5;
  }
  // DMs slide in as the number passes their rung.
  if (d.running && !crashed) {
    while (c.dmsDue < DMS.length && d.multiplier >= DMS[c.dmsDue]![0]) {
      const [, from, text] = DMS[c.dmsDue]!;
      c.toasts.push({ from, text, age: 0 });
      if (c.toasts.length > 3) c.toasts.shift();
      c.dmsDue += 1;
      c.events.dm = true;
    }
  }
}

// ---- Drawing ---------------------------------------------------------------------------------------------------------

function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'left', maxWidth?: number): void {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y, maxWidth);
}

/** The top bar, in the frame: LIVE, the title and the viewers. The multiplier is the scene's. */
export function drawTopBar(ctx: CanvasRenderingContext2D, c: Chat, d: ChatDrive): void {
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(0, 0, 960, TOPBAR_H);
  const ended = d.crash >= BEATS.ended;
  const on = ended ? false : Math.floor(d.time * 1.6) % 2 === 0 || d.running;
  box(ctx, 12, 7, 54, 16, 8, ended ? '#3a3a4a' : '#e0263f', 1.5);
  if (on) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(22, 15, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  text(ctx, ended ? 'ENDED' : 'LIVE', 44, 15.5, `900 9px ${UI_FONT}`, '#fff', 'center');
  text(ctx, `${TITLE} · $VIBE LAUNCH STREAM`, 76, 15.5, `800 11px ${UI_FONT}`, '#f3f1ea');
  const viewers = Math.max(0, Math.round(c.viewers.x));
  text(ctx, `${viewers.toLocaleString('en-US')} WATCHING`, SHARE.x + SHARE.w, 15.5, `800 9px ${UI_FONT}`, ended ? '#8a8a9a' : '#c9c4b8', 'right');
}

/** The thin frames round the three panes. */
export function drawFrames(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = '#2a2a3c';
  ctx.lineWidth = 2;
  for (const p of [CAM, SHARE, { x: CHAT.x, y: CHAT.y - 42, w: CHAT.w, h: CHAT.h + 42 }]) {
    ctx.beginPath();
    ctx.roundRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2, 6);
    ctx.stroke();
  }
  ctx.restore();
}

/** Your avatar: a little wojak in a cap, shades when you got out. */
function avatar(ctx: CanvasRenderingContext2D, x: number, y: number, shades: number, red: boolean): void {
  ctx.fillStyle = red ? '#f0c2c6' : '#f1d2b6';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#7cf67c';
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 9, 4.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  if (shades > 0.5) {
    ctx.fillRect(x - 7, y - 3, 6, 4);
    ctx.fillRect(x + 1, y - 3, 6, 4);
  } else {
    ctx.beginPath();
    ctx.arc(x - 3, y - 1, 1.3, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 1, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  if (red) ctx.arc(x, y + 5, 2.5, Math.PI, 0);
  else ctx.moveTo(x - 3, y + 4), ctx.lineTo(x + 3, y + 4);
  ctx.stroke();
}

/** The chat column, in its local space; `you` is the player's stake, null when watching; `rekt` after a crash you held through. */
export function drawChat(ctx: CanvasRenderingContext2D, c: Chat, d: ChatDrive, stake: number | null, rekt: boolean): void {
  ctx.save();
  ctx.fillStyle = '#141420';
  ctx.fillRect(0, -42, CHAT.w, CHAT.h + 42);
  // The header.
  text(ctx, 'STREAM CHAT', 10, -30, `900 10px ${UI_FONT}`, '#f3f1ea');
  const disabled = d.crash >= BEATS.ended;
  text(ctx, disabled ? ENDED.chat : `${Math.max(0, Math.round(c.viewers.x)).toLocaleString('en-US')} here`, CHAT.w - 10, -30, `700 8px ${UI_FONT}`, disabled ? '#ff5d73' : '#8a8a9a', 'right');
  ctx.fillStyle = '#2a2a3c';
  ctx.fillRect(0, -12, CHAT.w, 1);
  // The messages, clipped above the pinned row.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -10, CHAT.w, CHAT.h - PIN_H + 8);
  ctx.clip();
  for (const m of c.messages) {
    if (m.y < -40) continue;
    const arrive = clamp(m.age * 5, 0, 1);
    ctx.globalAlpha = arrive * (m.y < 30 ? clamp((m.y + 20) / 50, 0, 1) : 1);
    const x = 8 + 10 * (1 - arrive);
    const colour = m.you ? '#7cf67c' : NAME_COLOURS[m.name.length % NAME_COLOURS.length]!;
    ctx.font = `800 10px ${UI_FONT}`;
    const nameW = ctx.measureText(m.name).width;
    text(ctx, m.name, x, m.y + 11, `800 10px ${UI_FONT}`, colour);
    if (m.hot) {
      ctx.fillStyle = 'rgba(255, 93, 115, 0.16)';
      ctx.fillRect(2, m.y + 2, CHAT.w - 4, (m.rows === 1 ? ROW_1 : ROW_2) - 4);
    }
    ctx.font = `${m.hot ? 800 : 600} 10px ${UI_FONT}`;
    const lines = wrap(ctx, m.text, CHAT.w - 16 - (m.rows === 1 ? nameW + 6 : 0));
    if (m.rows === 1) text(ctx, lines[0] ?? m.text, x + nameW + 5, m.y + 11, `${m.hot ? 800 : 600} 10px ${UI_FONT}`, m.hot ? '#ff8c9c' : '#e8e6f0', 'left', CHAT.w - 16 - nameW - 6);
    else {
      lines.slice(0, 2).forEach((l, i) => text(ctx, l, x, m.y + 23 + i * 12, `${m.hot ? 800 : 600} 10px ${UI_FONT}`, m.hot ? '#ff8c9c' : '#e8e6f0', 'left', CHAT.w - 16));
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // The pinned row: you.
  const py = CHAT.h - PIN_H;
  ctx.fillStyle = c.sold ? '#16281e' : rekt ? '#2a1418' : '#1b1b2a';
  ctx.fillRect(0, py, CHAT.w, PIN_H);
  ctx.fillStyle = '#2a2a3c';
  ctx.fillRect(0, py, CHAT.w, 1);
  const s = 1 + 0.08 * clamp(c.pop.x, 0, 1.5);
  ctx.save();
  ctx.translate(20, py + PIN_H / 2);
  ctx.scale(s, s);
  avatar(ctx, 0, 0, c.shades.x, rekt && !c.sold);
  ctx.restore();
  if (c.sold) {
    text(ctx, `you · SOLD @ ${(c.sold.x100 / 100).toFixed(2)}×`, 38, py + 14, `900 10px ${UI_FONT}`, '#7cf67c', 'left', CHAT.w - 46);
    text(ctx, c.sold.payout !== null ? `+${c.sold.payout.toLocaleString('en-US')} credits · out before the rug` : 'out before the rug', 38, py + 28, `700 8px ${UI_FONT}`, '#9fe08a', 'left', CHAT.w - 46);
  } else if (stake === null) {
    text(ctx, 'you · watching', 38, py + 14, `900 10px ${UI_FONT}`, '#c9c4b8');
    text(ctx, rekt ? 'you watched a rug' : 'no credits riding', 38, py + 28, `700 8px ${UI_FONT}`, '#8a8a9a');
  } else if (rekt) {
    text(ctx, 'you · EXIT LIQUIDITY', 38, py + 14, `900 10px ${UI_FONT}`, '#ff5d73');
    text(ctx, `${stake.toLocaleString('en-US')} credits went with the bag`, 38, py + 28, `700 8px ${UI_FONT}`, '#ff8c9c', 'left', CHAT.w - 46);
  } else {
    text(ctx, 'you · holding', 38, py + 14, `900 10px ${UI_FONT}`, '#ffe27a');
    text(ctx, `${stake.toLocaleString('en-US')} credits riding the vibe`, 38, py + 28, `700 8px ${UI_FONT}`, '#c9c4b8', 'left', CHAT.w - 46);
  }
  ctx.restore();
}

/** The DMs, in the frame, sliding onto the top of the founder's cam. */
export function drawToasts(ctx: CanvasRenderingContext2D, c: Chat): void {
  c.toasts.forEach((t, i) => {
    const slide = smoothstep(0, 0.3, t.age) * (1 - smoothstep(2.9, 3.3, t.age));
    if (slide <= 0.01) return;
    const w = 190, h = 28;
    const x = CAM.x + CAM.w - w - 8 + (1 - slide) * 60;
    const y = CAM.y + 8 + i * (h + 4);
    ctx.save();
    ctx.globalAlpha = slide;
    box(ctx, x, y, w, h, 6, '#f6f4ef', 1.5);
    ctx.fillStyle = '#7cf67c';
    ctx.beginPath();
    ctx.arc(x + 14, y + 14, 7, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, t.from, x + 26, y + 9, `900 8px ${UI_FONT}`, '#1b1c27', 'left', w - 34);
    text(ctx, t.text, x + 26, y + 20, `600 8px ${UI_FONT}`, '#444', 'left', w - 34);
    ctx.restore();
  });
}

/** The STREAM ENDED card over the founder's cam, from BEATS.ended. */
export function drawEnded(ctx: CanvasRenderingContext2D, crash: number): void {
  if (crash < BEATS.ended) return;
  const show = smoothstep(BEATS.ended, BEATS.ended + 0.5, crash);
  ctx.save();
  ctx.globalAlpha = show;
  ctx.fillStyle = 'rgba(6, 5, 10, 0.72)';
  ctx.fillRect(CAM.x, CAM.y, CAM.w, CAM.h);
  const cx = CAM.x + CAM.w / 2, cy = CAM.y + CAM.h / 2;
  box(ctx, cx - 120, cy - 36, 240, 72, 8, '#15161f', 2);
  text(ctx, ENDED.title, cx, cy - 12, `900 20px ${UI_FONT}`, '#ff5d73', 'center');
  text(ctx, ENDED.line, cx, cy + 14, `700 10px ${UI_FONT}`, '#c9c4b8', 'center', 220);
  ctx.restore();
}
