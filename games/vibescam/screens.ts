/**
 * The screen share: what the founder is vibe coding, in three stacked panels. The IDE (a prompt box he types into,
 * the assistant's generated code streaming in, a status bar whose warnings only ever go up), the landing page
 * (VibeOS: a hero, a phone that never finishes loading, badges that stack with every feature, a BUY button and a
 * SELL button that gets removed, a tokenomics spinner that resolves to one slice, a padlock drawn open, the roadmap
 * to Mars) and the $VIBE chart strip (price, market cap, holders, LP status). At the crash the page dissolves into
 * vapor and 404s, the code falls out of the IDE, the chart drops to the floor and the holders read 1 (dev).
 * Presentation only: everything follows the displayed multiplier, the round clock and the crash age.
 */
import { BEATS, SHARE } from './den';
import { box, INK } from './ink';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';
import { ENDED, type Feature, FILLER_CODE, PRODUCT, TESTIMONIALS, TICKER } from './pitch';

// ---- Layout, in the pane's local space (origin at SHARE's top-left) ---------------------------------------------------

const W = SHARE.w;
const TABS = { y: 0, h: 22 } as const;
export const IDE = { x: 0, y: 24, w: W, h: 152 } as const;
export const PAGE = { x: 0, y: 182, w: W, h: 174 } as const;
export const STRIP = { x: 0, y: 362, w: W, h: 72 } as const;
const CODE_FONT = '11px ui-monospace, Menlo, Consolas, "Courier New", monospace';
const UI_FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const LINE_H = 13;
const CODE_ROWS = 8;
/** The chart samples the multiplier this often (round seconds) at first, and thins when it fills. */
const CHART_STEP = 0.5;
const CHART_POINTS = 160;
const BASE_PRICE = 0.000042;
const BASE_MCAP = 69_420;

export type PageFlag = NonNullable<Feature['page']>;

interface CodeLine { text: string; age: number; warn: boolean; /** The crash: when it drops and how. */ dropAt: number; vx: number; spin: number }
interface Vapor { x: number; y: number; vx: number; vy: number; r: number; delay: number }

export interface Screens {
  /** The prompt being typed, how much of it shows, and whether the assistant is "thinking". */
  prompt: string;
  typed: number;
  thinking: boolean;
  code: CodeLine[];
  warnings: number;
  badges: string[];
  flags: Set<PageFlag>;
  /** The SELL button's strike-through and removal; the padlock's swing; the spinner's phase. */
  strike: Spring;
  lock: Spring;
  spin: number;
  /** The decorative chart: multiplier samples on round time. */
  chart: number[];
  chartAt: number;
  chartStep: number;
  /** When the IDE next writes a line of its own accord. */
  fillerAt: number;
  fillerCursor: number;
  vapor: Vapor[];
  seed: number;
  /** The testimonials ticker's offset. */
  ticker: number;
  events: { line: boolean };
}

export function createScreens(): Screens {
  return { prompt: '', typed: 0, thinking: false, code: [], warnings: 0, badges: [], flags: new Set(), strike: spring(0), lock: spring(0), spin: 0, chart: [], chartAt: 0, chartStep: CHART_STEP, fillerAt: 1.2, fillerCursor: 0, vapor: [], seed: -1, ticker: 0, events: { line: false } };
}

export function resetScreens(s: Screens): void {
  s.prompt = '';
  s.typed = 0;
  s.thinking = false;
  s.code = [];
  s.warnings = 0;
  s.badges = [];
  s.flags = new Set();
  settleSpring(s.strike, 0);
  settleSpring(s.lock, 0);
  s.chart = [];
  s.chartAt = 0;
  s.chartStep = CHART_STEP;
  s.fillerAt = 1.2;
  s.vapor = [];
  s.seed = -1;
}

export interface ScreensDrive {
  time: number;
  tension: number;
  depth: number;
  multiplier: number;
  running: boolean;
  /** Round seconds, for the chart's sampling. */
  seconds: number;
  /** Seconds since the crash, or −1 before it. */
  crash: number;
  seed: number;
}

/** The IDE writes a line of its own between features, faster as the number climbs. */
const fillerGap = (tension: number): number => 2.2 - 1.5 * tension;

function pushLine(s: Screens, text: string, warn: boolean, age = 0): void {
  s.code.push({ text, age, warn, dropAt: 0, vx: 0, spin: 0 });
  if (s.code.length > 40) s.code.splice(0, s.code.length - 40);
}

/** He types a prompt: the IDE shows it letter by letter and the assistant thinks until the reply lands. */
export function askScreens(s: Screens, prompt: string, live: boolean): void {
  s.prompt = prompt;
  s.typed = live ? 0 : prompt.length;
  s.thinking = true;
}

/** A feature ships: the code lands, the warnings climb, the badge and the page change. */
export function shipScreens(s: Screens, f: Feature, live: boolean): void {
  s.thinking = false;
  s.typed = s.prompt.length;
  f.code.forEach((text, i) => pushLine(s, text, text.startsWith('//') ? false : i % 2 === 1, live ? -i * 0.12 : 1));
  s.warnings += 90 + Math.floor(noise(s.warnings + 1) * 400);
  if (f.badge && !s.badges.includes(f.badge)) s.badges.push(f.badge);
  if (f.page) s.flags.add(f.page);
  if (f.page === 'nosell' && !live) settleSpring(s.strike, 1);
  if (f.page === 'lock' && !live) settleSpring(s.lock, 1);
}

/** A line the IDE writes on its own, from the filler pool, never the same twice running. */
export function writeFiller(s: Screens): void {
  const text = FILLER_CODE[s.fillerCursor % FILLER_CODE.length]!;
  s.fillerCursor += 1 + (noise(s.fillerCursor * 2.3 + 0.5) > 0.5 ? 1 : 0);
  pushLine(s, text, noise(s.fillerCursor * 1.7) > 0.55);
  s.warnings += 1 + Math.floor(noise(s.fillerCursor * 3.1) * 4);
  s.events.line = true;
}

/** Jumps the screens to a round already at `multiplier` after `seconds`, with `shipped` features landed. */
export function settleScreens(s: Screens, d: ScreensDrive, shipped: readonly Feature[]): void {
  resetScreens(s);
  for (const f of shipped) shipScreens(s, f, false);
  if (shipped.length > 0) s.prompt = shipped[shipped.length - 1]!.prompt;
  s.typed = s.prompt.length;
  // Fill the chart between its known endpoints on the round's own clock.
  s.chartStep = CHART_STEP;
  while (Math.floor(d.seconds / s.chartStep) >= CHART_POINTS) s.chartStep *= 2;
  const samples = Math.floor(d.seconds / s.chartStep);
  for (let i = 0; i <= samples; i += 1) s.chart.push(Math.pow(d.multiplier, d.seconds > 0 ? (i * s.chartStep) / d.seconds : 1));
  s.chartAt = (samples + 1) * s.chartStep;
  s.fillerAt = d.time + fillerGap(d.tension);
  settleSpring(s.strike, s.flags.has('nosell') ? 1 : 0);
  settleSpring(s.lock, s.flags.has('lock') ? 1 : 0);
  seedScreens(s, d.seed);
}

/** Lays the vapor and the code's fall out for a crash point, once per crash. */
export function seedScreens(s: Screens, seed: number): void {
  if (s.seed === seed) return;
  s.seed = seed;
  const rand = mulberry32(seed * 11 + 7);
  s.vapor = [];
  for (let i = 0; i < 70; i += 1) {
    s.vapor.push({ x: PAGE.x + 10 + rand() * (PAGE.w - 20), y: PAGE.y + 20 + rand() * (PAGE.h - 30), vx: (rand() - 0.5) * 26, vy: -(22 + rand() * 50), r: 5 + rand() * 11, delay: rand() * 0.5 });
  }
  for (const line of s.code) {
    line.dropAt = BEATS.delete + 0.15 + rand() * 0.5;
    line.vx = (rand() - 0.5) * 50;
    line.spin = (rand() - 0.5) * 1.6;
  }
}

export function stepScreens(s: Screens, d: ScreensDrive, dt: number): void {
  s.events = { line: false };
  const crashed = d.crash >= 0;
  s.spin += dt * (crashed ? 0.5 : 2.5 + 3 * d.tension);
  s.ticker += dt * 18;
  // The prompt types at a founder's clip; the assistant thinks (dots) until its reply ships.
  if (s.typed < s.prompt.length) s.typed = Math.min(s.prompt.length, s.typed + dt * 26);
  for (const line of s.code) line.age += dt;
  if (d.running && !crashed && d.time >= s.fillerAt) {
    writeFiller(s);
    s.fillerAt = d.time + fillerGap(d.tension) * (0.7 + 0.6 * noise(s.fillerCursor * 5.3));
  }
  stepSpring(s.strike, s.flags.has('nosell') ? 1 : 0, 8, 0.8, dt);
  stepSpring(s.lock, s.flags.has('lock') ? 1 : 0, 6, 0.6, dt);
  // The chart: one sample per step of round time; when it fills, every other sample goes and the step doubles.
  if (d.running && !crashed) {
    while (d.seconds >= s.chartAt) {
      s.chart.push(d.multiplier);
      s.chartAt += s.chartStep;
      if (s.chart.length > CHART_POINTS) {
        s.chart = s.chart.filter((_, i) => i % 2 === 0);
        s.chartStep *= 2;
        s.chartAt = s.chart.length * s.chartStep;
      }
    }
  }
  if (crashed) seedScreens(s, d.seed);
}

// ---- Numbers ---------------------------------------------------------------------------------------------------------

export const holdersAt = (multiplier: number): number => Math.floor(900 * Math.pow(Math.max(1, multiplier), 1.35));
export const priceAt = (multiplier: number): string => (BASE_PRICE * multiplier).toFixed(multiplier > 1000 ? 3 : 6);
export const mcapAt = (multiplier: number): string => compact(BASE_MCAP * multiplier);
export function compact(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Math.floor(n).toLocaleString('en-US');
}

// ---- Drawing ---------------------------------------------------------------------------------------------------------

function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'left', maxWidth?: number): void {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y, maxWidth);
}

function drawTabs(ctx: CanvasRenderingContext2D, d: ScreensDrive): void {
  ctx.fillStyle = '#15161f';
  ctx.fillRect(0, TABS.y, W, TABS.h);
  const tabs: [string, number, number, boolean][] = [['VibeCode', 6, 92, true], ['vibeos.app', 102, 94, false], [TICKER, 200, 66, false]];
  for (const [name, x, w, active] of tabs) {
    ctx.fillStyle = active ? '#262838' : '#1b1c27';
    ctx.beginPath();
    ctx.roundRect(x, 3, w, TABS.h - 3, [5, 5, 0, 0]);
    ctx.fill();
    text(ctx, name, x + w / 2, 13, `700 9px ${UI_FONT}`, active ? '#f3f1ea' : '#9a9bb0', 'center', w - 10);
  }
  // Window dots.
  for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
    ctx.fillStyle = d.crash >= BEATS.delete ? '#55556a' : c;
    ctx.beginPath();
    ctx.arc(W - 30 + i * 9, 11, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIde(ctx: CanvasRenderingContext2D, s: Screens, d: ScreensDrive): void {
  const c = d.crash;
  ctx.save();
  ctx.fillStyle = '#1b1c27';
  ctx.fillRect(IDE.x, IDE.y, IDE.w, IDE.h);
  // The prompt box.
  const dead = c >= BEATS.delete;
  box(ctx, 6, IDE.y + 5, W - 12, 18, 4, '#262838', 1.5);
  const prompt = dead ? 'remove liquidity' : s.prompt.slice(0, Math.floor(s.typed));
  const caret = !dead && (s.typed < s.prompt.length || Math.floor(d.time * 2.4) % 2 === 0) ? '▏' : '';
  text(ctx, `> ${prompt}${caret}`, 12, IDE.y + 14, CODE_FONT, dead ? '#ff6b7a' : '#dfe3ff', 'left', W - 70);
  if (s.thinking && !dead) {
    const dots = '.'.repeat(1 + (Math.floor(d.time * 3) % 3));
    text(ctx, `thinking${dots}`, W - 12, IDE.y + 14, `italic 9px ${UI_FONT}`, '#8f93b5', 'right');
  }
  // The code: the last rows, the newest sliding in; at the crash each line drops out of the pane.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, IDE.y + 26, W, IDE.h - 42);
  ctx.clip();
  const shown = s.code.slice(-CODE_ROWS);
  const bottom = IDE.y + IDE.h - 18;
  for (let i = 0; i < shown.length; i += 1) {
    const line = shown[i]!;
    const row = shown.length - 1 - i;
    const arrive = clamp(line.age * 4, 0, 1);
    let y = bottom - row * LINE_H + 8 * (1 - arrive);
    let x = 10;
    let alpha = arrive;
    let rot = 0;
    if (c >= line.dropAt && line.dropAt > 0) {
      const t = c - line.dropAt;
      y += 420 * t * t;
      x += line.vx * t;
      rot = line.spin * t;
      alpha = clamp(1 - t / 1.1, 0, 1);
    }
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    // Gutter number, the text, a squiggle under the warnings.
    text(ctx, String(s.code.length - (shown.length - 1 - i) + 1).padStart(3, ' '), 0, 0, CODE_FONT, '#4d5070');
    const colour = line.text.startsWith('//') ? '#7f8aa5' : line.text.includes('"') ? '#ffd27a' : '#c8e6ff';
    ctx.font = CODE_FONT;
    let body = line.text;
    while (body.length > 4 && ctx.measureText(body).width > W - 48) body = `${body.slice(0, -2)}…`;
    text(ctx, body, 26, 0, CODE_FONT, colour);
    if (line.warn) {
      const width = Math.min(ctx.measureText(body).width, W - 48);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let sx = 0; sx <= width; sx += 3) ctx.lineTo(26 + sx, 6 + (sx % 6 === 0 ? 0 : 2));
      ctx.stroke();
    }
    ctx.restore();
  }
  if (dead && c >= BEATS.delete + 0.2) {
    const typed = Math.floor((c - BEATS.delete - 0.2) * 30);
    const cmd = '$ rm -rf ./product && git push --force';
    text(ctx, cmd.slice(0, typed), 10, bottom, CODE_FONT, '#ff6b7a');
    if (typed > cmd.length + 6) text(ctx, 'deleted. have a great day!', 10, bottom - LINE_H, CODE_FONT, '#8f93b5');
  }
  ctx.restore();
  // The status bar.
  ctx.fillStyle = '#121320';
  ctx.fillRect(IDE.x, IDE.y + IDE.h - 14, IDE.w, 14);
  const warnings = dead ? '∞' : s.warnings.toLocaleString('en-US');
  text(ctx, `! ${warnings} warnings · 0 errors (hidden)`, 8, IDE.y + IDE.h - 7, `700 8px ${UI_FONT}`, dead ? '#ff6b7a' : '#ffb347');
  text(ctx, dead ? 'vibes 0%' : `vibes ${Math.round(70 + 30 * d.tension)}%`, W - 8, IDE.y + IDE.h - 7, `700 8px ${UI_FONT}`, dead ? '#ff6b7a' : '#7cf67c', 'right');
  ctx.restore();
}

function spinner(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, phase: number, colour: string): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, phase, phase + Math.PI * 1.4);
  ctx.stroke();
}

function padlock(ctx: CanvasRenderingContext2D, x: number, y: number, open: number, colour: string): void {
  // The body and the shackle, which lifts and swings aside as it opens.
  box(ctx, x - 6, y, 12, 9, 2, colour, 1.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  const lift = 4 * open;
  const swing = 0.9 * open;
  ctx.save();
  ctx.translate(x - 4, y - lift);
  ctx.rotate(-swing);
  ctx.arc(4, 0, 4, Math.PI, 0);
  ctx.moveTo(8, 0);
  ctx.lineTo(8, lift + 1);
  ctx.stroke();
  ctx.restore();
}

/** The landing page: the hero, the phone, the badges, the buttons, tokenomics, the roadmap; vapor at the crash. */
function drawPage(ctx: CanvasRenderingContext2D, s: Screens, d: ScreensDrive): void {
  const c = d.crash;
  ctx.save();
  ctx.fillStyle = '#f6f4ef';
  ctx.fillRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h);
  // The browser chrome and the address.
  ctx.fillStyle = '#e4e1d9';
  ctx.fillRect(PAGE.x, PAGE.y, PAGE.w, 16);
  box(ctx, 28, PAGE.y + 3, W - 40, 10, 4, '#fbfaf7', 1);
  const dead = c >= BEATS.vapor + 0.7;
  text(ctx, dead ? 'vibeos.app — can’t be reached' : 'vibeos.app', 34, PAGE.y + 8, `700 7px ${UI_FONT}`, dead ? '#c0392b' : '#555');
  const vapor = c >= BEATS.vapor ? clamp((c - BEATS.vapor) / 0.8, 0, 1) : 0;
  if (vapor < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - vapor;
    ctx.translate(0, -16 * vapor);
    drawPageContent(ctx, s, d);
    ctx.restore();
  }
  if (c >= BEATS.vapor) {
    // The vapor: seventy soft puffs rise off the page and fade.
    for (const v of s.vapor) {
      const t = c - BEATS.vapor - v.delay;
      if (t < 0 || t > 1.6) continue;
      const a = 0.45 * Math.sin(Math.PI * clamp(t / 1.6, 0, 1));
      ctx.fillStyle = `rgba(200, 205, 230, ${a})`;
      ctx.beginPath();
      ctx.arc(v.x + v.vx * t, v.y + v.vy * t, v.r * (1 + t * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (dead) {
    const show = smoothstep(BEATS.vapor + 0.7, BEATS.vapor + 1.2, c);
    ctx.globalAlpha = show;
    text(ctx, ':(', 24, PAGE.y + 60, `700 30px ${UI_FONT}`, '#555');
    text(ctx, ENDED.page, 24, PAGE.y + 96, `700 12px ${UI_FONT}`, '#333', 'left', W - 40);
    text(ctx, ENDED.pageSub, 24, PAGE.y + 112, `9px ${UI_FONT}`, '#777', 'left', W - 40);
    text(ctx, 'ERR_VAPORWARE', 24, PAGE.y + 134, `700 8px ${UI_FONT}`, '#999');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawPageContent(ctx: CanvasRenderingContext2D, s: Screens, d: ScreensDrive): void {
  const top = PAGE.y + 16;
  const live = s.flags.has('logo');
  // Hero: the name, the tagline, the badges.
  text(ctx, live ? `${PRODUCT}™` : 'untitled-app', 12, top + 18, `900 18px ${UI_FONT}`, live ? '#1b1c27' : '#9a9a9a');
  let tagline = 'A super-app. For vibes.';
  if (s.flags.has('banks')) tagline = 'Replaces banks by Thursday.';
  else if (s.flags.has('vapor')) tagline = 'Ships instantly. Nothing to ship.';
  else if (s.badges.length > 3) tagline = 'The AI-powered quantum super-app.';
  else if (s.badges.includes('AI-POWERED')) tagline = 'The AI-powered super-app.';
  if (s.flags.has('testimonials')) {
    // The testimonials ticker takes the tagline's row.
    ctx.save();
    ctx.beginPath();
    ctx.rect(12, top + 28, 190, 14);
    ctx.clip();
    const line = TESTIMONIALS.join('   ·   ');
    ctx.font = `italic 8px ${UI_FONT}`;
    const width = ctx.measureText(line).width + 40;
    const off = s.ticker % width;
    text(ctx, line, 12 - off, top + 35, `italic 8px ${UI_FONT}`, '#444');
    text(ctx, line, 12 - off + width, top + 35, `italic 8px ${UI_FONT}`, '#444');
    ctx.restore();
  } else text(ctx, tagline, 12, top + 35, `italic 8px ${UI_FONT}`, '#555', 'left', 190);
  // Badges flow in rows.
  ctx.font = `800 6.5px ${UI_FONT}`;
  let bx = 12, by = top + 48;
  for (const badge of s.badges) {
    const w = ctx.measureText(badge).width + 10;
    if (bx + w > 206) { bx = 12; by += 13; }
    if (by > top + 86) break;
    const fill = badge.includes('VAPOR') ? '#d8d8e8' : badge.includes('REDACTED') ? '#1b1c27' : badge.includes('AUDITED') ? '#ffe66d' : '#dff3f7';
    box(ctx, bx, by, w, 10, 5, fill, 1);
    text(ctx, badge, bx + w / 2, by + 5.3, `800 6.5px ${UI_FONT}`, badge.includes('REDACTED') ? '#fff' : '#1b1c27', 'center');
    ctx.font = `800 6.5px ${UI_FONT}`;
    bx += w + 4;
  }
  // The buttons: BUY, and SELL until it is "removed".
  const btnY = top + 100;
  box(ctx, 12, btnY, 54, 16, 4, '#2ecc71', 1.5);
  text(ctx, 'BUY', 39, btnY + 8.5, `900 9px ${UI_FONT}`, '#fff', 'center');
  const strike = clamp(s.strike.x, 0, 1);
  if (strike < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - smoothstep(0.6, 1, strike);
    box(ctx, 72, btnY, 54, 16, 4, '#eee', 1.5);
    text(ctx, 'SELL', 99, btnY + 8.5, `900 9px ${UI_FONT}`, '#999', 'center');
    if (strike > 0) {
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(72, btnY + 2);
      ctx.lineTo(72 + 54 * smoothstep(0, 0.6, strike), btnY + 14);
      ctx.stroke();
    }
    ctx.restore();
  } else text(ctx, '(sell button removed · UX)', 72, btnY + 8.5, `italic 7px ${UI_FONT}`, '#999');
  // Tokenomics: a spinner, then the pie with one slice; the LP line with its padlock.
  const px = 160, py = top + 110;
  text(ctx, 'TOKENOMICS', px - 24, py - 22, `800 7px ${UI_FONT}`, '#1b1c27');
  if (s.flags.has('pie')) {
    ctx.fillStyle = '#d6336c';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, 'TEAM 100%', px + 20, py - 4, `800 7px ${UI_FONT}`, '#1b1c27');
    text(ctx, 'LP 0%', px + 20, py + 6, `800 7px ${UI_FONT}`, '#999');
  } else {
    spinner(ctx, px, py, 11, s.spin, '#9a9ab5');
    text(ctx, 'loading…', px + 20, py, `italic 7px ${UI_FONT}`, '#999');
  }
  // The liquidity line, with the padlock drawn open once "locked".
  const lockY = top + 125;
  const open = clamp(s.lock.x, 0, 1);
  const swing = open * (0.5 + 0.5 * Math.sin(d.time * 4)) * smoothstep(0.2, 0.9, d.tension);
  padlock(ctx, 18, lockY, open * 0.7 + 0.3 * swing, open > 0.5 ? '#ffb347' : '#bbb');
  text(ctx, open > 0.5 ? 'LIQUIDITY: LOCKED (IN MY HEART)' : 'LIQUIDITY: UNLOCKED', 30, lockY + 5, `800 7px ${UI_FONT}`, open > 0.5 ? '#c0392b' : '#999');
  // The roadmap.
  const rmY = top + 141;
  if (s.flags.has('roadmap')) {
    const stops: [string, string][] = [['Q1', 'LAUNCH'], ['Q2', '???'], ['Q3', 'PROFIT'], ['Q4', 'MARS']];
    ctx.strokeStyle = '#1b1c27';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(16, rmY);
    ctx.lineTo(200, rmY);
    ctx.stroke();
    stops.forEach(([q, what], i) => {
      const x = 22 + i * 58;
      ctx.fillStyle = i === 1 ? '#fff' : '#d6336c';
      ctx.beginPath();
      ctx.arc(x, rmY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      text(ctx, `${q} ${what}`, x, rmY + 10, `800 6.5px ${UI_FONT}`, i === 1 ? '#999' : '#1b1c27', 'center');
    });
  } else text(ctx, 'roadmap: soon', 16, rmY + 4, `italic 7px ${UI_FONT}`, '#aaa');
  // The phone on the right: a product render that never finishes loading.
  const phone = { x: 222, y: top + 10, w: 66, h: 134 };
  box(ctx, phone.x, phone.y, phone.w, phone.h, 10, '#1b1c27', 2);
  ctx.fillStyle = s.flags.has('vapor') ? '#cfd0e0' : '#262838';
  ctx.beginPath();
  ctx.roundRect(phone.x + 5, phone.y + 10, phone.w - 10, phone.h - 20, 6);
  ctx.fill();
  if (s.flags.has('vapor')) {
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(d.time * 2 + i)})`;
      ctx.beginPath();
      ctx.arc(phone.x + 20 + (i * 13) % 30 + 4 * Math.sin(d.time + i), phone.y + 40 + ((i * 29) % 70), 9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    spinner(ctx, phone.x + phone.w / 2, phone.y + 56, 12, s.spin * 1.4, '#7cf67c');
    text(ctx, s.flags.has('demo') ? 'DEMO ▶ (loop)' : 'loading…', phone.x + phone.w / 2, phone.y + 84, `800 6.5px ${UI_FONT}`, '#9a9ab5', 'center', phone.w - 8);
    if (live) text(ctx, TICKER, phone.x + phone.w / 2, phone.y + 24, `900 11px ${UI_FONT}`, '#ff4fd8', 'center');
  }
  if (s.flags.has('vapor')) {
    // The ribbon across the corner.
    ctx.save();
    ctx.translate(W - 34, top + 12);
    ctx.rotate(Math.PI / 4);
    box(ctx, -40, -6, 80, 12, 0, '#d6336c', 1.2);
    text(ctx, '100% VAPOR', 0, 0.5, `900 7px ${UI_FONT}`, '#fff', 'center');
    ctx.restore();
  }
}

/** The $VIBE strip: price, market cap, holders, LP status and the chart; at the crash a cliff and 1 (dev). */
function drawStrip(ctx: CanvasRenderingContext2D, s: Screens, d: ScreensDrive): void {
  const c = d.crash;
  const crashed = c >= 0;
  const dropped = c >= 0.08;
  const settled = c >= BEATS.holders;
  ctx.save();
  ctx.fillStyle = '#121320';
  ctx.fillRect(STRIP.x, STRIP.y, STRIP.w, STRIP.h);
  const m = d.multiplier;
  const green = '#7cf67c', red = '#ff5d73';
  text(ctx, TICKER, 8, STRIP.y + 11, `900 11px ${UI_FONT}`, '#ff4fd8');
  text(ctx, dropped ? '0.000000' : priceAt(m), 48, STRIP.y + 11, `800 11px ui-monospace, Menlo, monospace`, dropped ? red : green);
  text(ctx, dropped ? '−100.0%' : `+${((m - 1) * 100).toFixed(1)}%`, W - 8, STRIP.y + 11, `800 9px ${UI_FONT}`, dropped ? red : green, 'right');
  const holders = settled ? '1 (dev)' : holdersAt(m).toLocaleString('en-US');
  text(ctx, `MCAP $${dropped ? '0' : mcapAt(m)}  ·  HOLDERS ${holders}`, 8, STRIP.y + 25, `700 8px ${UI_FONT}`, '#c9c4b8');
  const lp = settled ? 'LP $0.00 (lol)' : s.flags.has('lock') ? 'LP: LOCKED (HEART)' : 'LP: UNLOCKED';
  text(ctx, lp, W - 8, STRIP.y + 25, `800 8px ${UI_FONT}`, settled ? red : '#ffb347', 'right');
  // The chart: log price over round time, the latest sample at the right edge.
  const area = { x: 8, y: STRIP.y + 32, w: W - 16, h: 34 };
  const peak = Math.max(1.6, ...s.chart, m);
  const yOf = (v: number): number => area.y + area.h - (Math.log(Math.max(1, v)) / Math.log(peak)) * (area.h - 4) - 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(area.x, area.y + (area.h * i) / 2);
    ctx.lineTo(area.x + area.w, area.y + (area.h * i) / 2);
    ctx.stroke();
  }
  const points = s.chart.length > 1 ? s.chart : [1, m];
  const span = crashed ? area.w * 0.82 : area.w;
  ctx.strokeStyle = crashed ? red : green;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((v, i) => {
    const x = area.x + (span * i) / Math.max(1, points.length - 1);
    const y = yOf(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (crashed) {
    // The cliff: straight down, then flat along the floor.
    const fall = smoothstep(0, 0.12, c);
    const lastY = yOf(points[points.length - 1]!);
    ctx.lineTo(area.x + span + 2, mix(lastY, area.y + area.h - 1, fall));
    if (fall >= 1) ctx.lineTo(area.x + area.w, area.y + area.h - 1);
  }
  ctx.stroke();
  // The latest price's dot pulses while the round runs.
  if (!crashed) {
    const x = area.x + area.w, y = yOf(m);
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.arc(x, y, 2.5 + Math.sin(d.time * 6) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The whole screen share, in its local space. */
export function drawScreens(ctx: CanvasRenderingContext2D, s: Screens, d: ScreensDrive): void {
  ctx.save();
  ctx.fillStyle = '#0f1018';
  ctx.fillRect(0, 0, W, SHARE.h);
  drawTabs(ctx, d);
  drawIde(ctx, s, d);
  drawPage(ctx, s, d);
  drawStrip(ctx, s, d);
  // Panel seams.
  ctx.fillStyle = '#0f1018';
  ctx.fillRect(0, IDE.y + IDE.h, W, PAGE.y - IDE.y - IDE.h);
  ctx.fillRect(0, PAGE.y + PAGE.h, W, STRIP.y - PAGE.y - PAGE.h);
  ctx.restore();
}

/** The readout for the HUD: shipped features and warnings. */
export const shippedText = (s: Screens): string => `SHIPPED ${String(s.badges.length).padStart(2, '0')} · ${s.warnings.toLocaleString('en-US')} WARNINGS`;

