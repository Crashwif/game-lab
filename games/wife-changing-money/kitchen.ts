/**
 * The 3:07 am kitchen: the laptop chart, the text stack, the stair light,
 * the ceiling thump, the suitcase that is the wife-changing-money meter,
 * and the crash (ring, cat, lawyer card). Presentation only.
 */
import { clamp, mulberry32, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
export const DESK = { x: 468, y: 448 };
export const LAPTOP = { x: 300, y: 352, w: 156, h: 108 };

const LINES: { at: number; text: string; her: boolean }[] = [
  { at: 1.15, text: 'honey?', her: true },
  { at: 1.55, text: 'one more trade', her: false },
  { at: 2.05, text: 'are you coming to bed', her: true },
  { at: 2.8, text: 'it is 3am', her: true },
  { at: 3.8, text: 'i can hear the fan', her: true },
  { at: 5.2, text: 'the light is still on', her: true },
  { at: 7.5, text: 'the cat is judging you', her: true },
  { at: 10, text: 'i am coming down', her: true },
];

interface Mug { x: number; y: number; vx: number; vy: number; rot: number; vr: number; fallen: boolean; color: string; }
interface Bubble { text: string; her: boolean; age: number; }
interface Bit { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; color: string; }
interface Ring { x: number; y: number; vx: number; vy: number; dropped: boolean; settled: boolean; }

export interface Kitchen {
  mugs: Mug[];
  knocked: boolean;
  catX: number;
  catY: number;
  catInCase: boolean;
  light: Spring;
  thump: number;
  thumpClock: number;
  wifeY: Spring;
  wifeMode: 'asleep' | 'down' | 'floor' | 'back';
  wifeAge: number;
  harmless: boolean;
  crashed: boolean;
  crashT: number;
  suitX: number;
  suitLid: Spring;
  rolling: boolean;
  ring: Ring;
  cardX: Spring;
  cardIn: boolean;
  chartDead: boolean;
  dogX: number;
  bubbles: Bubble[];
  nextLine: number;
  bits: Bit[];
  meter: Spring;
  holding: boolean;
  peek: number;
  events: { thump: boolean; text: boolean };
}

const MUGS: { x: number; y: number; color: string }[] = [
  { x: 300, y: 424, color: '#efe8dc' },
  { x: 338, y: 418, color: '#d4574a' },
  { x: 560, y: 422, color: '#d5fb6d' },
  { x: 598, y: 416, color: '#7aa2ff' },
  { x: 250, y: 430, color: '#f2c14e' },
  { x: 640, y: 428, color: '#e7d5ff' },
];

export function createKitchen(): Kitchen {
  const k = {
    mugs: MUGS.map((m) => ({ ...m, vx: 0, vy: 0, rot: 0, vr: 0, fallen: false })),
    knocked: false,
    catX: 132,
    catY: 332,
    catInCase: false,
    light: spring(0),
    thump: 0,
    thumpClock: 0,
    wifeY: spring(86),
    wifeMode: 'asleep' as const,
    wifeAge: 0,
    harmless: false,
    crashed: false,
    crashT: 0,
    suitX: 786,
    suitLid: spring(0.08),
    rolling: false,
    ring: { x: 470, y: 400, vx: 0, vy: 0, dropped: false, settled: false },
    cardX: spring(980),
    cardIn: false,
    chartDead: false,
    dogX: 520,
    bubbles: [],
    nextLine: 0,
    bits: [],
    meter: spring(0),
    holding: false,
    peek: 0,
    events: { thump: false, text: false },
  };
  return k;
}

export function resetKitchen(k: Kitchen): void {
  k.mugs = MUGS.map((m) => ({ ...m, vx: 0, vy: 0, rot: 0, vr: 0, fallen: false }));
  k.knocked = false;
  k.catX = 132;
  k.catY = 332;
  k.catInCase = false;
  k.light.x = 0;
  k.light.v = 0;
  k.thump = 0;
  k.thumpClock = 0;
  k.wifeY.x = 86;
  k.wifeY.v = 0;
  k.wifeMode = 'asleep';
  k.wifeAge = 0;
  k.harmless = false;
  k.crashed = false;
  k.crashT = 0;
  k.suitX = 786;
  k.suitLid.x = 0.08;
  k.suitLid.v = 0;
  k.rolling = false;
  k.ring = { x: 470, y: 400, vx: 0, vy: 0, dropped: false, settled: false };
  k.cardX.x = 980;
  k.cardX.v = 0;
  k.cardIn = false;
  k.chartDead = false;
  k.dogX = 520;
  k.bubbles = [];
  k.nextLine = 0;
  k.bits = [];
  k.meter.x = 0;
  k.meter.v = 0;
  k.holding = false;
  k.peek = 0;
  k.events = { thump: false, text: false };
}

export function meterTarget(multiplier: number): number {
  return clamp(Math.log2(Math.max(1, multiplier)) / 4, 0, 1);
}

export interface KitchenDrive {
  running: boolean;
  multiplier: number;
  fear: number;
  time: number;
  traderGone: boolean;
}

function burst(k: Kitchen, x: number, y: number, count: number, color: string, power: number, rand: () => number): void {
  for (let i = 0; i < count; i += 1) {
    const a = rand() * Math.PI * 2;
    const s = power * (0.4 + rand());
    k.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, age: 0, life: 0.6 + rand() * 0.8, r: 1.5 + rand() * 2.5, color });
  }
}

/** Plays the crash. Harmless means he already closed the lid: she checks and goes back. */
export function crashKitchen(k: Kitchen, seed: number, quiet: boolean, harmless: boolean): void {
  if (k.crashed) return;
  k.crashed = true;
  k.harmless = harmless;
  k.chartDead = !harmless;
  k.holding = harmless;
  k.peek = 0;
  const rand = mulberry32(seed);
  if (quiet) {
    k.crashT = 4;
    k.light.x = 0;
    if (harmless) {
      k.wifeMode = 'back';
      k.wifeY.x = 20;
      k.suitLid.x = 0.08;
    } else {
      k.wifeMode = 'floor';
      k.wifeY.x = 448;
      k.wifeAge = 3;
      k.rolling = true;
      k.suitX = 1040;
      k.suitLid.x = 0.72;
      k.catInCase = true;
      k.ring = { x: 430 + rand() * 40, y: 446, vx: 0, vy: 0, dropped: true, settled: true };
      k.cardIn = true;
      k.cardX.x = 690;
      k.dogX = 980;
      k.meter.x = 0;
    }
    return;
  }
  k.wifeMode = 'down';
  k.wifeAge = 0;
  if (!harmless) burst(k, 800, 120, 10, '#d9d0c4', 80, rand);
}

export function stepKitchen(k: Kitchen, drive: KitchenDrive, dt: number): void {
  k.events.thump = false;
  k.events.text = false;
  k.crashT += k.crashed ? dt : 0;
  k.thump = Math.max(0, k.thump - dt * 1.8);
  const fill = meterTarget(drive.multiplier);
  const target = k.crashed && !k.harmless ? 0 : k.holding ? k.meter.x : fill;
  stepSpring(k.meter, target, k.crashed && !k.harmless ? 4 : 6, 0.9, dt);
  k.peek = drive.running && !drive.traderGone && !k.crashed ? clamp((drive.multiplier - 7) / 7, 0, 1) : 0;
  const lit = drive.fear > 0.38 || k.peek > 0.25 || k.wifeMode === 'down' || k.wifeMode === 'floor';
  stepSpring(k.light, lit && !(k.harmless && k.wifeMode === 'back') ? 1 : 0, 7, 0.85, dt);

  if (drive.running && !k.crashed && drive.fear > 0.5) {
    k.thumpClock += dt;
    if (k.thumpClock > 1.55) {
      k.thumpClock = 0;
      k.thump = 1;
      k.events.thump = true;
      burst(k, 520, 70, 6, '#cabb9a', 50, mulberry32(Math.floor(drive.time * 10) + 3));
    }
  } else k.thumpClock = 0;

  while (k.nextLine < LINES.length && drive.multiplier >= LINES[k.nextLine]!.at && (drive.running || k.crashed)) {
    const line = LINES[k.nextLine]!;
    if (!(k.holding && line.her && line.at >= 10)) k.bubbles.push({ text: line.text, her: line.her, age: 0 });
    k.nextLine += 1;
    k.events.text = true;
  }
  for (const b of k.bubbles) b.age += dt;

  if (drive.running && !k.knocked && drive.multiplier >= 4) {
    k.knocked = true;
    const mug = k.mugs[1]!;
    mug.fallen = true;
    mug.vx = -40;
    mug.vy = -120;
    mug.vr = 6;
  }
  for (let i = 0; i < k.mugs.length; i += 1) {
    const mug = k.mugs[i]!;
    if (!mug.fallen) continue;
    mug.vy += 980 * dt;
    mug.x += mug.vx * dt;
    mug.y += mug.vy * dt;
    mug.rot += mug.vr * dt;
    if (mug.y > 508) {
      mug.y = 508;
      mug.vy *= -0.28;
      mug.vx *= 0.7;
      mug.vr *= 0.5;
    }
  }

  // Wife, suitcase, ring, card, cat, dog.
  const wifeTarget = k.wifeMode === 'down' || k.wifeMode === 'floor' ? 448 : k.wifeMode === 'back' ? 16 : 86;
  stepSpring(k.wifeY, wifeTarget, k.wifeMode === 'down' ? 4.5 : 3.2, 0.9, dt);
  if (k.wifeMode !== 'asleep') k.wifeAge += dt;
  if (k.wifeMode === 'down' && k.wifeY.x > 430) k.wifeMode = 'floor';
  if (k.wifeMode === 'floor' && k.harmless && k.wifeAge > 1.35) k.wifeMode = 'back';
  if (k.wifeMode === 'floor' && !k.harmless && !k.rolling && k.wifeAge > 0.35) {
    k.rolling = true;
    if (!k.ring.dropped) {
      k.ring.dropped = true;
      k.ring.x = 790;
      k.ring.y = k.wifeY.x - 78;
      k.ring.vx = -160;
      k.ring.vy = -220;
    }
  }
  stepSpring(k.suitLid, k.rolling ? 0.72 : 0.08, 8, 0.7, dt);
  if (k.rolling) k.suitX += 210 * dt;
  if (k.ring.dropped && !k.ring.settled) {
    k.ring.vy += 1400 * dt;
    k.ring.x += k.ring.vx * dt;
    k.ring.y += k.ring.vy * dt;
    if (k.ring.y > 446) {
      k.ring.y = 446;
      k.ring.vy *= -0.32;
      k.ring.vx *= 0.65;
      if (Math.abs(k.ring.vy) < 50) k.ring.settled = true;
    }
  }
  if (k.rolling && !k.cardIn && k.crashT > 0.8) k.cardIn = true;
  stepSpring(k.cardX, k.cardIn ? 688 : 980, 7, 0.85, dt);

  const catTarget = k.catInCase || (k.rolling && !k.harmless) ? { x: k.suitX + 30, y: 400 } : { x: 132, y: 332 };
  k.catX += (catTarget.x - k.catX) * clamp(dt * 4, 0, 1);
  k.catY += (catTarget.y - k.catY) * clamp(dt * 4, 0, 1);
  if (k.rolling && Math.hypot(k.catX - (k.suitX + 30), k.catY - 400) < 24) k.catInCase = true;
  if (k.rolling) k.dogX += (k.suitX - 70 - k.dogX) * clamp(dt * 3, 0, 1);

  for (const bit of k.bits) {
    bit.age += dt;
    bit.vy += 280 * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  k.bits = k.bits.filter((bit) => bit.age < bit.life);
}

export function visibleMugs(multiplier: number): number {
  return clamp(Math.round(1 + Math.log2(Math.max(1, multiplier)) * 1.35), 1, MUGS.length);
}

function ink(ctx: CanvasRenderingContext2D, width = 2.5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

export function drawRoom(ctx: CanvasRenderingContext2D, k: Kitchen, time: number): void {
  ctx.fillStyle = '#120e16';
  ctx.fillRect(0, 0, 960, 540);
  // Moonlit window.
  ctx.fillStyle = '#241c2e';
  ctx.fillRect(0, 0, 960, 470);
  ctx.fillStyle = '#1a2438';
  ctx.beginPath();
  ctx.roundRect(46, 78, 150, 110, 6);
  ctx.fill();
  ink(ctx, 3);
  ctx.stroke();
  ctx.fillStyle = '#f4efe2';
  ctx.beginPath();
  ctx.arc(150, 118, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#31405c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(121, 78);
  ctx.lineTo(121, 188);
  ctx.moveTo(46, 132);
  ctx.lineTo(196, 132);
  ctx.stroke();
  // Clock.
  const flicker = 0.65 + 0.35 * (Math.sin(time * 3) > 0 ? 1 : 0.35);
  ctx.globalAlpha = flicker;
  ctx.fillStyle = '#ff4d6a';
  ctx.font = '700 22px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('3:07', 214, 110);
  ctx.globalAlpha = 1;
  // Fridge and the photo that cracks if the chart kills the night.
  ctx.fillStyle = '#d5dbe3';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(28, 188, 132, 230, 8);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#aeb6c2';
  ctx.beginPath();
  ctx.moveTo(28, 300);
  ctx.lineTo(160, 300);
  ctx.stroke();
  ctx.fillStyle = '#f7f1e4';
  ctx.beginPath();
  ctx.roundRect(48, 214, 54, 46, 3);
  ctx.fill();
  ink(ctx, 1.5);
  ctx.stroke();
  ctx.fillStyle = SKIN_A;
  ctx.beginPath();
  ctx.arc(66, 234, 8, 0, Math.PI * 2);
  ctx.arc(86, 236, 8, 0, Math.PI * 2);
  ctx.fill();
  if (k.crashed && !k.harmless) {
    ctx.strokeStyle = '#c23b4e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 216);
    ctx.lineTo(100, 258);
    ctx.stroke();
  }
  // Cabinets, counter, floor.
  ctx.fillStyle = '#3a2d38';
  ctx.fillRect(180, 200, 500, 36);
  ctx.fillStyle = '#4a3b34';
  ctx.fillRect(0, 418, 700, 22);
  ctx.fillStyle = '#2a211c';
  ctx.fillRect(0, 470, 960, 70);
  // Stairs.
  ctx.fillStyle = '#3c3344';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(700, 470);
  ctx.lineTo(860, 150);
  ctx.lineTo(960, 150);
  ctx.lineTo(960, 470);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#2a2432';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i += 1) {
    const y = 180 + i * 40;
    ctx.beginPath();
    ctx.moveTo(780 + i * 8, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }
  const prints = Math.floor(k.peek * 6 + (k.wifeMode === 'asleep' ? 0 : 6));
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < prints; i += 1) {
    const y = 200 + i * 36;
    ctx.beginPath();
    ctx.ellipse(860 + (i % 2) * 16, y, 6, 3, 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Door.
  ctx.fillStyle = '#4d3a32';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(888, 250, 70, 220, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e6c56a';
  ctx.beginPath();
  ctx.arc(906, 360, 4, 0, Math.PI * 2);
  ctx.fill();
  // Ceiling crack on a thump.
  if (k.thump > 0.02) {
    ctx.globalAlpha = k.thump;
    ctx.strokeStyle = '#d9d0c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(430, 36);
    ctx.lineTo(490, 58);
    ctx.lineTo(540, 40);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Peek at the top of the stairs before she commits.
  if (k.peek > 0.04 && k.wifeMode === 'asleep') {
    ctx.globalAlpha = k.peek;
    drawWife(ctx, 830, 168, 'peek', 0, false);
    ctx.globalAlpha = 1;
  }
  // Chair, empty once he leaves. Drawn under him.
  ctx.fillStyle = '#6b5348';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.roundRect(DESK.x - 34, DESK.y - 16, 68, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(DESK.x - 28, DESK.y - 16);
  ctx.lineTo(DESK.x - 28, DESK.y - 70);
  ctx.lineTo(DESK.x + 28, DESK.y - 70);
  ctx.stroke();
}

const SKIN_A = '#f3dccb';

function drawWife(ctx: CanvasRenderingContext2D, x: number, y: number, mood: 'peek' | 'angry' | 'soft', bob: number, ringOn: boolean): void {
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = '#f4eef8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-18, -6);
  ctx.lineTo(-22, -78);
  ctx.lineTo(22, -78);
  ctx.lineTo(18, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6b4a3c';
  ctx.beginPath();
  ctx.arc(0, -96, 8, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -84, 14, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN_A;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  const wide = mood === 'angry' ? 2.4 : 1.6;
  ctx.beginPath();
  ctx.ellipse(-5, -86, 1.6, wide, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -86, 1.6, wide, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (mood === 'angry') {
    ctx.moveTo(-9, -94);
    ctx.lineTo(-2, -90);
    ctx.moveTo(9, -94);
    ctx.lineTo(2, -90);
    ctx.moveTo(-4, -74);
    ctx.lineTo(4, -74);
  } else {
    ctx.moveTo(-4, -76);
    ctx.quadraticCurveTo(0, -72, 5, -76);
  }
  ctx.stroke();
  // Arms crossed, ring still on until it drops.
  ctx.strokeStyle = SKIN_A;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-14, -70);
  ctx.lineTo(14, -58);
  ctx.moveTo(14, -70);
  ctx.lineTo(-14, -58);
  ctx.stroke();
  if (ringOn) {
    ctx.fillStyle = '#e6c56a';
    ctx.beginPath();
    ctx.arc(-12, -60, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLaptop(ctx: CanvasRenderingContext2D, lid: number, chartDead: boolean, deadAge: number, time: number, fear: number): void {
  const { x, y, w, h } = LAPTOP;
  const shake = fear > 0.45 && lid < 0.5 ? Math.sin(time * 48) * 1.4 : 0;
  ctx.save();
  ctx.translate(shake, 0);
  ctx.fillStyle = '#2a3038';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(x, y + 8, w, h * 0.42, 4);
  ctx.fill();
  ctx.stroke();
  // Keyboard lip.
  ctx.fillStyle = '#1c2128';
  ctx.fillRect(x + 18, y + 16, w - 36, 10);
  const open = 1 - lid;
  const screenH = Math.max(0, h * open);
  if (screenH > 6) {
    const hingeY = y + 8;
    const top = hingeY - screenH;
    const inset = 8 * (1 - open);
    ctx.fillStyle = '#1b2128';
    ctx.beginPath();
    ctx.moveTo(x + inset, top);
    ctx.lineTo(x + w - inset, top);
    ctx.lineTo(x + w, hingeY);
    ctx.lineTo(x, hingeY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + inset + 6, top + 6);
    ctx.lineTo(x + w - inset - 6, top + 6);
    ctx.lineTo(x + w - 8, hingeY - 4);
    ctx.lineTo(x + 8, hingeY - 4);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = chartDead ? '#240810' : '#06140e';
    ctx.fillRect(x, top, w, screenH);
    ctx.beginPath();
    const n = 22;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      let py = hingeY - 10 - (screenH - 22) * Math.pow(t, 1.45);
      py += Math.sin(time * 3 + i) * 1.5;
      if (chartDead && t > 1 - clamp(deadAge / 0.45, 0, 1)) py = hingeY - 8;
      if (i === 0) ctx.moveTo(x + 16 + t * (w - 32), py);
      else ctx.lineTo(x + 16 + t * (w - 32), py);
    }
    ctx.strokeStyle = chartDead ? '#ff4d6d' : '#39ff8a';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawMug(ctx: CanvasRenderingContext2D, mug: Mug): void {
  ctx.save();
  ctx.translate(mug.x, mug.y);
  ctx.rotate(mug.rot);
  ctx.fillStyle = mug.color;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(-10, -16, 20, 18, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(12, -6, 5, -1.2, 1.2);
  ctx.stroke();
  ctx.restore();
}

function drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, lookAt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#6a6a72';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(18, -8, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, -16);
  ctx.lineTo(14, -24);
  ctx.lineTo(18, -14);
  ctx.moveTo(20, -16);
  ctx.lineTo(26, -24);
  ctx.lineTo(24, -13);
  ctx.fill();
  ctx.stroke();
  const pupil = clamp((lookAt - x) / 80, -1, 1);
  ctx.fillStyle = '#d6f56a';
  ctx.beginPath();
  ctx.ellipse(16 + pupil, -8, 2, 2.4, 0, 0, Math.PI * 2);
  ctx.ellipse(22 + pupil, -8, 2, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, -2);
  ctx.quadraticCurveTo(-34, -16 + Math.sin(time * 4) * 6, -26, 6);
  ctx.stroke();
  ctx.restore();
}

export function drawMid(ctx: CanvasRenderingContext2D, k: Kitchen, multiplier: number, time: number): void {
  if (!k.catInCase) drawCat(ctx, k.catX, k.catY, time, LAPTOP.x);
  const n = visibleMugs(multiplier);
  for (let i = 0; i < k.mugs.length; i += 1) {
    const mug = k.mugs[i]!;
    if (i >= n && !mug.fallen) continue;
    drawMug(ctx, mug);
    if (!mug.fallen) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#d7e8ef';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(mug.x, mug.y - 22 - (time * 12 + i * 5) % 10, 4, 0.4, Math.PI - 0.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // Phone and the stack of unread texts.
  ctx.fillStyle = '#17191e';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(168, 424, 28, 44, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8fd0ff';
  ctx.fillRect(172, 430, 20, 28);
  const shown = k.bubbles.slice(-5);
  shown.forEach((bubble, index) => {
    const rise = clamp(bubble.age / 0.25, 0, 1);
    const y = 400 - index * 28 - (1 - rise) * 10;
    ctx.globalAlpha = rise;
    ctx.font = '700 13px system-ui, sans-serif';
    const width = Math.min(130, ctx.measureText(bubble.text).width + 16);
    const x = bubble.her ? 148 : 176;
    ctx.fillStyle = bubble.her ? '#3b82f6' : '#3a3f4a';
    ctx.beginPath();
    ctx.roundRect(x, y, width, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#f4f7fb';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubble.text, x + 8, y + 11);
    ctx.globalAlpha = 1;
  });
}

function drawSuitcase(ctx: CanvasRenderingContext2D, k: Kitchen): void {
  const fill = clamp(k.meter.x, 0, 1);
  ctx.save();
  ctx.translate(k.suitX, 392);
  ctx.fillStyle = '#7a4e32';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(-70, -20, 140, 88, 8);
  ctx.fill();
  ctx.stroke();
  // Interior gold, clipped, with the milestone stickers.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-62, 60 - fill * 78, 124, fill * 78 + 4);
  ctx.clip();
  ctx.fillStyle = '#f0c14a';
  ctx.fillRect(-62, -12, 124, 80);
  ctx.fillStyle = '#c6922e';
  ctx.font = '900 12px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAMBO', -30, 28);
  if (fill > 0.45) ctx.fillText('LAWYER', 28, 44);
  if (fill > 0.7) ctx.fillText('BOAT', 0, 16);
  ctx.restore();
  // Lid leans back while the case is the meter, and sits down when the cat is in the way.
  const lean = (1 - k.suitLid.x) * 46;
  ctx.fillStyle = '#8d5b3b';
  ctx.beginPath();
  ctx.moveTo(-70, -20);
  ctx.lineTo(70, -20);
  ctx.lineTo(58, -28 - lean);
  ctx.lineTo(-58, -28 - lean);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e6c56a';
  ctx.fillRect(-16, -36 - lean, 32, 8);
  ink(ctx, 2);
  ctx.strokeRect(-16, -36 - lean, 32, 8);
  if (k.catInCase) {
    ctx.fillStyle = '#6a6a72';
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-14, -22);
    ctx.lineTo(-2, -10);
    ctx.moveTo(6, -8);
    ctx.lineTo(14, -22);
    ctx.lineTo(8, -8);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawDog(ctx: CanvasRenderingContext2D, x: number, time: number): void {
  ctx.save();
  ctx.translate(x, 456);
  ctx.fillStyle = '#c47a3a';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(0, -10, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(16, -16, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  for (const lx of [-10, -2, 6, 12]) {
    ctx.beginPath();
    ctx.moveTo(lx, -4);
    ctx.lineTo(lx, 2 + Math.sin(time * 16 + lx) * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFront(ctx: CanvasRenderingContext2D, k: Kitchen, time: number): void {
  drawSuitcase(ctx, k);
  if (k.wifeMode !== 'asleep') {
    const bob = k.wifeMode === 'down' ? Math.sin(k.wifeAge * 10) * 2 : 0;
    const mood = k.harmless ? 'soft' : 'angry';
    if (k.wifeY.x < 500 && !(k.wifeMode === 'back' && k.wifeY.x < 80)) drawWife(ctx, 812, k.wifeY.x, mood, bob, !k.ring.dropped);
  }
  if (k.rolling && k.dogX < 980) drawDog(ctx, k.dogX, time);
  if (k.ring.dropped) {
    ctx.save();
    ctx.translate(k.ring.x, k.ring.y);
    ctx.strokeStyle = '#e6c56a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff6d4';
    ctx.beginPath();
    ctx.arc(0, -1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (k.cardX.x < 970) {
    ctx.save();
    ctx.translate(k.cardX.x, 492);
    ctx.rotate(-0.04);
    ctx.fillStyle = '#f7f4ea';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.roundRect(0, -36, 150, 44, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '900 13px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SPLIT & CO', 10, -18);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('the cat chose her', 10, -4);
    ctx.restore();
  }
  for (const bit of k.bits) {
    ctx.globalAlpha = clamp(1 - bit.age / bit.life, 0, 1);
    ctx.fillStyle = bit.color;
    ctx.beginPath();
    ctx.arc(bit.x, bit.y, bit.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawLight(ctx: CanvasRenderingContext2D, k: Kitchen): void {
  if (k.light.x < 0.02) return;
  const g = ctx.createLinearGradient(820, 80, 820, 480);
  g.addColorStop(0, `rgba(255, 206, 140, ${0.42 * k.light.x})`);
  g.addColorStop(1, 'rgba(255, 206, 140, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(720, 80);
  ctx.lineTo(960, 40);
  ctx.lineTo(960, 520);
  ctx.lineTo(640, 520);
  ctx.closePath();
  ctx.fill();
}

export function drawVignette(ctx: CanvasRenderingContext2D, lid: number): void {
  const g = ctx.createRadialGradient(480, 300, 120, 480, 280, 560);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.45 + lid * 0.25})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 540);
}

export function drawGlow(ctx: CanvasRenderingContext2D, lid: number, dead: boolean): void {
  if (lid > 0.85) return;
  const alpha = (1 - lid) * 0.45;
  const g = ctx.createRadialGradient(460, 360, 20, 460, 360, 280);
  g.addColorStop(0, dead ? `rgba(255, 60, 90, ${alpha})` : `rgba(60, 255, 150, ${alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 540);
}
