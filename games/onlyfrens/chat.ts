/**
 * The chat panel and the simps. Messages scroll faster as the hype
 * builds, the tip goal fills and keeps moving, the mods nod off, and at
 * the crash the chat floods with RUGGED. Under the video, the front row
 * of simps holds roses and cards; your simp is the one who can leave. An
 * accepted exit closes his tab: shades, then out into the sunlight.
 * Nothing here changes the outcome.
 */
import { type Spring, clamp, mix, noise, settleSpring, spring, stepSpring } from './motion';
import { INK, VIDEO } from './stream';

export const PANEL = { x: 620, y: 0, w: 340, h: 540 } as const;
export const ROW_Y = 528;
const NAMES = ['xX_simp_Xx', 'wagmi_wojak', 'diamond_dan', 'sol_maxi', 'bagholder69', 'gm_andy', 'trench_tom', 'exit_liq', 'moon_boi', 'paper_pete', 'chad_not', 'ser_hodl'];
const LINES = ['queen <3', 'take my money', 'wen reveal', 'gm queen', 'simping harder', 'she noticed me', 'to the moon', 'wagmi', 'mods asleep', 'is that a door', 'ONE MORE MILESTONE', 'ape in', 'number go up', 'my rent money', 'so real for this', 'sent my rent, worth it', 'wife doesnt know', 'tipped my car payment', 'is she single', 'her bf is a whale fr', 'reveal = tokenomics?', 'rug me queen', 'pls step on my bags', 'refinancing for this', 'she said gm to ME'];
const CRASH_LINES = ['RUGGED', 'NGMI', 'who was that', 'STREAM ENDED??', 'it was a boyfriend', 'my bags', 'exit liquidity', 'rugged again', 'F', 'cope', 'bf had 40% of supply', 'the reveal was a rug', 'i tipped for THIS', 'the bf is the dev', 'refund??'];

export interface Message { name: string; text: string; tip: number; y: number; age: number; seed: number }
interface Confetti { x: number; y: number; vx: number; vy: number; angle: number; spin: number; colour: string; age: number; life: number }

export type SimpMode = 'seated' | 'closing' | 'walking' | 'gone';

export interface Chat {
  time: number;
  messages: Message[];
  nextAt: number;
  goal: number;
  goalIndex: number;
  fill: Spring;
  modSleep: Spring;
  flooded: boolean;
  simp: { mode: SimpMode; x: number; modeAge: number; shades: Spring };
  sulk: Spring;
  hype: Spring;
  /** The pinned tip menu: which tier is on top, and its pop when it climbs. */
  menuIndex: number;
  menuPop: Spring;
  /** Your simp's send-off. */
  confetti: Confetti[];
  /** What happened this step: a tip was posted. */
  events: { tip: boolean };
}

export const GOALS = [1.5, 2, 3, 5, 8, 13, 21, 34, 55];
/** The goalposts keep doubling after the opening ladder, so long streams still have goals to reach. */
const goalAt = (index: number): number => GOALS[index] ?? GOALS[GOALS.length - 1]! * 2 ** (index - GOALS.length + 1);
/** What the queen posts as each goal is reached; the last is for the final goal, when the reveal is due any second. */
const QUEEN_POSTS = ['one more milestone frens <3', 'ur all so generous omg', 'my bf... i mean my brother says hi', 'almost there babes', 'one more and the hoodie comes off', 'ok ok the reveal is SO close', 'ok ok reveal any second frens <3'];
/** The top tier of the pinned tip menu at each goal reached: dumber and dearer every time. */
const TIP_MENU: [string, string][] = [
  ['SAYS GM', '1 SOL'], ['SAYS UR NAME', '5 SOL'], ['HOODIE STRING PULL', '69 SOL'], ['BLINKS TWICE', '420 SOL'], ['UNMUTES MIC', '1,000 SOL'],
  ['REVEALS DOG NAME', '4,200 SOL'], ['HOODIE STAYS ON', '69,000 SOL'], ['SAYS GN', '1 KIDNEY'], ['REMEMBERS U', 'UR HOUSE'], ['ACKNOWLEDGES U', 'NOT FOR SALE'],
];
const CONFETTI = ['#7cf67c', '#ffe27a', '#ff5d9e', '#8fd3ff'];
const menuAt = (index: number): number => index < TIP_MENU.length ? index : 5 + (index - TIP_MENU.length) % 5;
const compactCount = (n: number): string => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

export function createChat(): Chat {
  return { time: 0, messages: [], nextAt: 0, goal: GOALS[0]!, goalIndex: 0, fill: spring(0), modSleep: spring(0), flooded: false, simp: { mode: 'seated', x: 300, modeAge: 0, shades: spring(0) }, sulk: spring(0), hype: spring(0), menuIndex: 0, menuPop: spring(0), confetti: [], events: { tip: false } };
}

export function resetChat(c: Chat): void {
  c.messages = [];
  c.nextAt = 0;
  c.goal = GOALS[0]!;
  c.goalIndex = 0;
  settleSpring(c.fill, 0);
  settleSpring(c.modSleep, 0);
  c.flooded = false;
  c.simp = { mode: 'seated', x: 300, modeAge: 0, shades: spring(0) };
  settleSpring(c.sulk, 0);
  settleSpring(c.hype, 0);
  c.menuIndex = 0;
  settleSpring(c.menuPop, 0);
  c.confetti = [];
  c.events = { tip: false };
}

function post(c: Chat, name: string, text: string, tip: number): void {
  const height = tip > 0 ? 42 : 30;
  for (const m of c.messages) m.y -= height;
  c.messages.push({ name, text, tip, y: PANEL.y + PANEL.h - 100, age: 0, seed: c.time });
  if (c.messages.length > 18) c.messages.shift();
  if (tip > 0) c.events.tip = true;
}

/** Your simp's send-off: a small burst from his seat, capped at 36 pieces. */
function throwConfetti(c: Chat, x: number, y: number): void {
  c.confetti = [];
  for (let i = 0; i < 36; i += 1) {
    const a = -Math.PI / 2 + (noise(i * 1.7) - 0.5) * 2.2;
    const s = 160 + noise(i * 2.9) * 220;
    c.confetti.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, angle: noise(i * 3.1) * 6, spin: (noise(i * 4.3) - 0.5) * 20, colour: CONFETTI[i % 4]!, age: 0, life: 1.2 + noise(i * 5.7) * 0.5 });
  }
}

/** How full the tip bar is: the way from the last goal to the next. */
function goalFill(c: Chat, multiplier: number): number {
  const previous = c.goalIndex === 0 ? 1 : goalAt(c.goalIndex - 1);
  return clamp((multiplier - previous) / (c.goal - previous), 0, 1);
}

/** Jumps the goal ladder and the tip bar to where a multiplier already is. */
export function settleChat(c: Chat, multiplier: number): void {
  while (multiplier >= c.goal && Number.isFinite(c.goal)) { c.goalIndex += 1; c.goal = goalAt(c.goalIndex); }
  settleSpring(c.fill, goalFill(c, multiplier));
  c.menuIndex = menuAt(c.goalIndex);
}

/** Your simp closes the tab. `gone` is an exit met late: he has already left. */
export function unsubscribe(c: Chat, gone = false): void {
  if (gone) { c.simp.mode = 'gone'; settleSpring(c.simp.shades, 1); }
  else if (c.simp.mode === 'seated') { c.simp.mode = 'closing'; c.simp.modeAge = 0; throwConfetti(c, 40 + 4 * 68, ROW_Y - 44); }
}

/** The crash floods the chat. `quiet` is a crash met late: the bar is already drained and the flood already posted. */
export function floodChat(c: Chat, cheerful: boolean, quiet: boolean): void {
  c.flooded = true;
  if (cheerful) settleSpring(c.hype, 1); else settleSpring(c.sulk, 1);
  if (!quiet) c.menuPop.v = 7;
  if (quiet) {
    settleSpring(c.fill, 0);
    for (let i = 0; i < 8; i += 1) post(c, NAMES[i]!, CRASH_LINES[i]!, 0);
  }
}

export interface ChatDrive { running: boolean; multiplier: number; tension: number }

/** Returns true on the frame a goal is reached (and moved). */
export function stepChat(c: Chat, drive: ChatDrive, dt: number): boolean {
  c.time += dt;
  c.events = { tip: false };
  let reached = false;
  const rate = c.flooded ? 6 : drive.running ? 1 + 6 * drive.tension : 0.4;
  if (c.time > c.nextAt) {
    c.nextAt = c.time + (0.7 + noise(c.time * 3) * 0.6) / rate;
    const n = Math.floor(noise(c.time * 17) * NAMES.length);
    if (c.flooded) post(c, NAMES[n]!, CRASH_LINES[Math.floor(noise(c.time * 5) * CRASH_LINES.length)]!, 0);
    else {
      const tip = drive.running && noise(c.time * 11) > 0.72 - 0.3 * drive.tension ? Math.round(10 + noise(c.time * 23) * 90 * drive.multiplier) : 0;
      post(c, NAMES[n]!, LINES[Math.floor(noise(c.time * 7) * LINES.length)]!, tip);
    }
  }
  for (const m of c.messages) m.age += dt;
  if (drive.running && !c.flooded && drive.multiplier >= c.goal && Number.isFinite(c.goal)) {
    c.goalIndex += 1;
    c.goal = goalAt(c.goalIndex);
    reached = true;
    post(c, 'QUEEN', QUEEN_POSTS[(c.goalIndex - 1) % QUEEN_POSTS.length]!, 0);
  }
  stepSpring(c.fill, c.flooded ? 0 : goalFill(c, drive.multiplier), 8, 0.9, dt);
  stepSpring(c.modSleep, drive.running && drive.tension > 0.6 ? 1 : 0, 3, 0.8, dt);
  const menuIndex = menuAt(c.goalIndex);
  if (menuIndex !== c.menuIndex) { c.menuIndex = menuIndex; c.menuPop.v = 7; }
  stepSpring(c.menuPop, 0, 12, 0.35, dt);
  const s = c.simp;
  s.modeAge += dt;
  if (s.mode === 'closing' && s.modeAge > 0.7) { s.mode = 'walking'; s.modeAge = 0; }
  if (s.mode === 'walking') { s.x -= 170 * dt; if (s.x < -60) { s.mode = 'gone'; s.modeAge = 0; } }
  stepSpring(s.shades, s.mode !== 'seated' ? 1 : 0, 12, 0.5, dt);
  const drag = Math.exp(-1.6 * dt);
  for (const p of c.confetti) { p.age += dt; p.vy += 520 * dt; p.vx *= drag; p.x += p.vx * dt; p.y += p.vy * dt; p.angle += p.spin * dt; }
  c.confetti = c.confetti.filter((p) => p.age < p.life);
  return reached;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left', maxWidth?: number): void {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The chat column: header, the mods, the messages, the tip bar. */
export function drawChat(ctx: CanvasRenderingContext2D, c: Chat, multiplier: number, viewers: number, live: boolean): void {
  ctx.save();
  ctx.fillStyle = '#16161c';
  ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  ctx.fillStyle = '#22222b';
  ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, 64);
  ctx.fillStyle = live ? (Math.floor(c.time * 2) % 2 ? '#e63946' : '#b02a35') : '#555';
  ctx.beginPath(); ctx.roundRect(PANEL.x + 14, 14, 44, 18, 5); ctx.fill();
  label(ctx, live ? 'LIVE' : 'ENDED', PANEL.x + 36, 27, 11, '#ffffff', 'center');
  label(ctx, `${compactCount(viewers)} watching`, PANEL.x + 66, 27, 12, '#c9c9d4', 'left', 164);
  label(ctx, '$QUEEN launch', PANEL.x + 14, 52, 15, '#ffffff', 'left', 200);
  // The mods.
  const sleep = clamp(c.modSleep.x, 0, 1);
  for (const [i, mx] of [PANEL.x + 262, PANEL.x + 300].entries()) {
    ctx.fillStyle = '#2e8b57'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(mx - 14, 12, 28, 18, 4); ctx.fill(); ctx.stroke();
    label(ctx, 'MOD', mx, 25, 9, '#ffffff', 'center');
    ctx.fillStyle = '#f3dccb';
    ctx.beginPath(); ctx.arc(mx, 46 + sleep * 4, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    if (sleep > 0.5) { ctx.beginPath(); ctx.moveTo(mx - 6, 45); ctx.lineTo(mx - 2, 45); ctx.moveTo(mx + 2, 45); ctx.lineTo(mx + 6, 45); ctx.stroke(); label(ctx, 'z', mx + 12 + i * 2, 36 - ((c.time * 0.7 + i * 0.5) % 1) * 14, 11, '#8fd3ff'); }
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(mx - 4, 44, 1.6, 0, Math.PI * 2); ctx.arc(mx + 4, 44, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }
  // Messages.
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL.x, 66, PANEL.w, PANEL.h - 66 - 84); ctx.clip();
  for (const m of c.messages) {
    const y = m.y + (m.age < 0.2 ? (0.2 - m.age) * 60 : 0);
    if (m.tip > 0) {
      ctx.fillStyle = '#5b2a86';
      ctx.beginPath(); ctx.roundRect(PANEL.x + 10, y - 22, PANEL.w - 20, 34, 6); ctx.fill();
      label(ctx, `${m.name} tipped ${m.tip}`, PANEL.x + 18, y - 6, 12, '#ffe27a', 'left', PANEL.w - 40);
      label(ctx, m.text, PANEL.x + 18, y + 8, 12, '#ffffff', 'left', PANEL.w - 40);
    } else {
      const hue = Math.floor(noise(m.name.length * 3.1 + m.seed * 0) * 360);
      label(ctx, m.name, PANEL.x + 14, y, 12, m.name === 'QUEEN' ? '#ff7ab8' : `hsl(${hue}, 70%, 70%)`);
      ctx.font = '700 12px system-ui, sans-serif';
      const w = ctx.measureText(m.name).width;
      label(ctx, m.text, PANEL.x + 18 + w, y, 12, m.text === m.text.toUpperCase() && m.text.length > 3 ? '#ff4d6d' : '#e7e7ef', 'left', PANEL.w - 36 - w);
    }
  }
  ctx.restore();
  // The pinned tip menu: the top tier climbs with the goal ladder, and at the crash it reads REFUNDS · NO.
  const item = c.flooded ? ['REFUNDS', 'NO'] : TIP_MENU[c.menuIndex]!;
  const mk = 1 + 0.08 * clamp(c.menuPop.x, -1, 1);
  ctx.fillStyle = '#16161c';
  ctx.fillRect(PANEL.x, 64, PANEL.w, 48);
  ctx.save();
  ctx.translate(PANEL.x + PANEL.w / 2, 88);
  ctx.scale(mk, mk);
  ctx.translate(-(PANEL.x + PANEL.w / 2), -88);
  ctx.fillStyle = c.flooded ? '#3a1420' : '#2b2440'; ctx.strokeStyle = c.flooded ? '#ff4d6d' : '#7c3aed'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(PANEL.x + 8, 68, PANEL.w - 16, 40, 6); ctx.fill(); ctx.stroke();
  label(ctx, 'PINNED · TIP MENU', PANEL.x + 16, 81, 9, c.flooded ? '#ff9db0' : '#c9b8ff');
  label(ctx, item[0]!, PANEL.x + 16, 99, 13, '#ffffff', 'left', 196);
  label(ctx, item[1]!, PANEL.x + PANEL.w - 16, 99, 13, '#ffe27a', 'right', 110);
  ctx.restore();
  // Tip goal.
  const fill = clamp(c.fill.x, 0, 1);
  ctx.fillStyle = '#22222b';
  ctx.fillRect(PANEL.x, PANEL.h - 84, PANEL.w, 84);
  label(ctx, c.flooded ? 'REVEAL CANCELLED' : `REVEAL AT ${c.goal.toFixed(1)}×`, PANEL.x + 14, PANEL.h - 58, 13, c.flooded ? '#ff4d6d' : '#ffffff', 'left', 196);
  label(ctx, `${multiplier.toFixed(2)}×`, PANEL.x + PANEL.w - 14, PANEL.h - 58, 13, '#7cf67c', 'right', 100);
  ctx.fillStyle = '#3a3a48';
  ctx.beginPath(); ctx.roundRect(PANEL.x + 14, PANEL.h - 44, PANEL.w - 28, 18, 9); ctx.fill();
  const g = ctx.createLinearGradient(PANEL.x + 14, 0, PANEL.x + PANEL.w - 14, 0);
  g.addColorStop(0, '#ff5d9e'); g.addColorStop(1, '#ffe27a');
  ctx.fillStyle = g;
  if (fill > 0.01) { ctx.beginPath(); ctx.roundRect(PANEL.x + 14, PANEL.h - 44, (PANEL.w - 28) * fill, 18, 9); ctx.fill(); }
  label(ctx, `${Math.round(fill * 100)}%`, PANEL.x + PANEL.w / 2, PANEL.h - 30, 11, '#ffffff', 'center');
  ctx.fillStyle = '#c9c9d4';
  label(ctx, 'send a tip to speed it up <3', PANEL.x + 14, PANEL.h - 12, 11, '#9a9aa8');
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.strokeRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  ctx.restore();
}

function drawSimp(ctx: CanvasRenderingContext2D, x: number, seed: number, bob: number, mood: 'calm' | 'hype' | 'sulk' | 'shock', prop: 'rose' | 'card' | 'phone' | 'none', special: boolean, shades: number, stride: number): void {
  ctx.save();
  ctx.translate(x, ROW_Y - bob);
  ctx.scale(0.62, 0.62);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const tone = noise(seed * 3.3);
  const skin = tone > 0.66 ? '#f3dccb' : tone > 0.33 ? '#e0bda7' : '#c68e6a';
  const shirt = special ? '#ffe27a' : ['#e63946', '#3b82f6', '#2e8b57', '#7c3aed'][Math.floor(noise(seed * 7.1) * 4)]!;
  if (stride > 0) for (const side of [-1, 1]) { const lift = Math.max(0, Math.sin(stride + (side > 0 ? Math.PI : 0))) * 10; ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(side * 10, -30); ctx.lineTo(side * 12, 20 - lift); ctx.stroke(); ctx.strokeStyle = '#3d5f8f'; ctx.lineWidth = 11; ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 15;
  const hand = mood === 'sulk' ? { x: 0, y: -70 } : { x: 26, y: -80 };
  ctx.beginPath(); ctx.moveTo(18, -34); ctx.lineTo(hand.x, hand.y); ctx.stroke(); ctx.strokeStyle = skin; ctx.lineWidth = 10; ctx.stroke();
  if (mood !== 'sulk') {
    if (prop === 'rose') { ctx.strokeStyle = '#2e8b57'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hand.x + 4, hand.y - 34); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(hand.x + 5, hand.y - 40, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
    if (prop === 'card') { ctx.save(); ctx.translate(hand.x, hand.y - 24); ctx.rotate(-0.3); ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-16, -10, 32, 20, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.fillRect(-16, -4, 32, 4); ctx.restore(); }
    if (prop === 'phone') { ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(hand.x - 8, hand.y - 32, 16, 28, 3); ctx.fill(); ctx.stroke(); }
  }
  ctx.fillStyle = shirt; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-20, -40, 40, 44, 8); ctx.fill(); ctx.stroke();
  const sulk = mood === 'sulk' ? 1 : 0;
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0, -58 + sulk * 10, 16, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (sulk) { ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-18, -34); ctx.lineTo(-8, -54); ctx.moveTo(18, -34); ctx.lineTo(8, -54); ctx.stroke(); ctx.strokeStyle = skin; ctx.lineWidth = 4.5; ctx.stroke(); }
  else {
    ctx.fillStyle = INK;
    for (const ex of [-6, 6]) { ctx.beginPath(); ctx.ellipse(ex, -62, 2.2, mood === 'shock' ? 4 : 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (mood === 'hype') { ctx.ellipse(0, -50, 5, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else if (mood === 'shock') { ctx.ellipse(0, -49, 4, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
    else { ctx.moveTo(-5, -51); ctx.quadraticCurveTo(0, -47, 5, -51); }
    ctx.stroke();
    if (shades > 0.02) { const dy = -30 * (1 - shades); ctx.fillStyle = INK; ctx.fillRect(-12, -66 + dy, 9, 6); ctx.fillRect(3, -66 + dy, 9, 6); ctx.fillRect(-3, -65 + dy, 6, 2); }
  }
  ctx.restore();
}

/** The front row under the video, and your simp wherever he is. */
export function drawSimps(ctx: CanvasRenderingContext2D, c: Chat, tension: number, finished: boolean, cheerful: boolean): void {
  ctx.fillStyle = '#0f0f14';
  ctx.fillRect(0, VIDEO.h, VIDEO.w, 540 - VIDEO.h);
  const cheer = finished ? 0.1 : 0.2 + 0.8 * tension;
  const count = 9;
  for (let i = 0; i < count; i += 1) {
    const x = 40 + i * 68;
    const special = i === 4;
    if (special && c.simp.mode !== 'seated') continue;
    const bob = Math.max(0, Math.sin(c.time * (4 + 6 * cheer) + i * 0.7)) * 8 * cheer + (finished && cheerful ? Math.max(0, Math.sin(c.time * 10 + i)) * 12 : 0);
    const mood = finished ? (cheerful ? 'hype' : c.sulk.x > 0.5 ? 'sulk' : 'shock') : cheer > 0.7 ? 'hype' : 'calm';
    const roll = noise(i * 5.7);
    drawSimp(ctx, x, i, bob, special && finished && !cheerful ? 'sulk' : mood, special ? 'card' : roll > 0.66 ? 'rose' : roll > 0.33 ? 'card' : 'phone', special, 0, 0);
  }
  const s = c.simp;
  if (s.mode === 'closing') {
    drawSimp(ctx, 40 + 4 * 68, 4, 0, 'calm', 'none', true, clamp(s.shades.x, 0, 1), 0);
    ctx.save(); ctx.translate(40 + 4 * 68, ROW_Y - 64);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-40, -24, 80, 22, 6); ctx.fill(); ctx.stroke();
    label(ctx, 'UNSUBSCRIBED', 0, -8, 10, INK, 'center');
    ctx.restore();
  } else if (s.mode === 'walking') {
    drawSimp(ctx, s.x, 4, 6, 'hype', 'none', true, 1, c.time * 12);
  }
  for (const p of c.confetti) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = clamp((p.life - p.age) / 0.4, 0, 1);
    ctx.fillStyle = p.colour;
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.strokeRect(0, VIDEO.h, VIDEO.w, 540 - VIDEO.h);
  void mix;
}
