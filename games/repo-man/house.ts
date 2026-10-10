/**
 * The set of Repo Man: a cul-de-sac at 4:07 am under a deep blue sky, the two-story house (cached once with its
 * windows punched out, so the rooms behind the glass stay live), the bedroom window with its blinds rig, the
 * living room with the TV and the smart fridge, the kid's window, the landing window, the front door, the modular
 * porch, the house numbers, the gutter and the hose; the neighbour's house with its porch light, the sodium
 * streetlight, the lawn with its sprinklers, the for-sale sign that grows like a sapling, the mailbox and the bike.
 * Drawing and the springs of the set's own props; nothing here reads or changes the outcome.
 */
import { drawDegenWindow, drawKid, drawNeighbour, type WindowDegen } from './cast';
import { blob, box, ink, INK, label, limb, memeText, poly } from './ink';
import { type Items, POST } from './repo';
import { clamp, mix, noise, smoothstep, spring, type Spring, stepSpring, settleSpring } from './motion';

export const HOUSE = { left: 330, right: 750, ground: 404, floor: 296, eave: 190 } as const;
export const BED = { x: 462, y: 200, w: 150, h: 84 } as const;
const DARKWIN = { x: 362, y: 210, w: 64, h: 68 } as const;
export const LANDING = { x: 662, y: 214, w: 46, h: 62 } as const;
export const LIVING = { x: 346, y: 314, w: 138, h: 66 } as const;
export const DOOR = { x: 516, y: 318, w: 48, h: 86 } as const;
export const KID = { x: 622, y: 320, w: 92, h: 60 } as const;
export const NEIGHBOUR = { door: { x: 866, y: 350, w: 30, h: 58 }, lamp: { x: 908, y: 356 } } as const;
export const LAMP = { x: 790, y: 198 } as const;
const SIGN = { x: 772, y: 458 } as const;
const SPRINKLERS = [372, 470, 604, 724] as const;
const TV_SHOTS: [number, number, number][] = [[90, 140, 255], [255, 184, 100], [140, 255, 190], [255, 110, 150]];
/** Spots on the siding between the windows where boards settle after an exit. */
const BOARDS: [number, number][] = [[447, 230], [632, 250], [731, 224], [341, 262], [731, 300], [447, 262], [632, 216], [731, 352], [341, 224], [632, 278], [731, 382], [447, 280]];

export const C = {
  skyTop: '#050a1c', skyMid: '#0e1a3e', skyLow: '#26365f',
  siding: '#3a4767', sidingLine: '#2f3a57', trim: '#8a93aa', roof: '#1b2134', roofLine: '#272f47',
  lawn: '#173129', lawnLit: '#24443a', concrete: '#4c5162', street: '#1a1c26',
  green: '#5dff95', red: '#ff3d4d', amber: '#ffb000', sodium: '#ffa640', warm: '#ffd48a',
};

const canvas = (w: number, h: number): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// ─── Cached layers ──────────────────────────────────────────────────────────────────────────────────────────

let backdrop: HTMLCanvasElement | null = null;
let houseCache: HTMLCanvasElement | null = null;
let lightCache: HTMLCanvasElement | null = null;
const HOUSE_BOX = { x: 300, y: 70, w: 480, h: 360 } as const;

function paintBackdrop(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 420);
  sky.addColorStop(0, C.skyTop);
  sky.addColorStop(0.55, C.skyMid);
  sky.addColorStop(1, C.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  for (let i = 0; i < 90; i += 1) {
    const x = noise(i * 3.1) * 960;
    const y = noise(i * 7.7 + 2) * 300;
    const r = 0.5 + noise(i * 1.9) * 1.1;
    ctx.fillStyle = `rgba(230, 236, 255, ${0.25 + 0.6 * noise(i * 5.3)})`;
    ctx.fillRect(x, y, r, r);
  }
  // A thin moon over the far roofs.
  ctx.fillStyle = 'rgba(255, 244, 200, 0.08)';
  ctx.beginPath();
  ctx.arc(108, 86, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6efcf';
  ctx.beginPath();
  ctx.arc(108, 86, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.skyMid;
  ctx.beginPath();
  ctx.arc(116, 81, 15.5, 0, Math.PI * 2);
  ctx.fill();
  // Far roofs and trees across the cul-de-sac.
  ctx.fillStyle = '#0b1431';
  for (let i = 0; i < 16; i += 1) {
    const x = i * 66 - 20 + noise(i * 2.3) * 20;
    const r = 30 + noise(i * 4.1) * 26;
    ctx.beginPath();
    ctx.ellipse(x, 330 - r * 0.5, r * 0.9, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#0d1736';
  poly(ctx, [0, 330, 40, 288, 120, 288, 170, 330], '#0d1736', 0);
  ctx.fillRect(10, 330, 150, 80);
  ctx.fillStyle = 'rgba(255, 210, 140, 0.55)';
  ctx.fillRect(60, 344, 14, 12);
  ctx.fillRect(100, 344, 14, 12);
  ctx.fillStyle = '#0d1736';
  ctx.fillRect(0, 330, 960, 80);
  // The neighbour's house, stage right.
  poly(ctx, [796, 312, 890, 246, 990, 312], '#1e2438', 2);
  box(ctx, 806, 306, 170, 106, 0, '#33405e', 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let y = 314; y < 412; y += 8) {
    ctx.beginPath();
    ctx.moveTo(806, y);
    ctx.lineTo(976, y);
    ctx.stroke();
  }
  box(ctx, 918, 340, 40, 34, 2, '#0c1226', 2);
  box(ctx, 822, 340, 32, 34, 2, '#0c1226', 2);
  box(ctx, NEIGHBOUR.door.x - 3, NEIGHBOUR.door.y - 3, NEIGHBOUR.door.w + 6, NEIGHBOUR.door.h + 3, 1, '#7d869c', 2);
  // The lawn, the driveway, the sidewalk, the curb and the street.
  const lawn = ctx.createLinearGradient(0, 400, 0, 470);
  lawn.addColorStop(0, '#132a24');
  lawn.addColorStop(1, '#1d3a30');
  ctx.fillStyle = lawn;
  ctx.fillRect(0, 404, 960, 64);
  ctx.fillStyle = 'rgba(70, 120, 90, 0.35)';
  for (let i = 0; i < 260; i += 1) {
    const x = noise(i * 9.7) * 960;
    const y = 408 + noise(i * 4.9 + 1) * 56;
    ctx.fillRect(x, y, 1.2, -3 - noise(i) * 3);
  }
  poly(ctx, [372, 404, 470, 404, 566, 466, 346, 466], '#3c4150', 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.moveTo(420, 404);
  ctx.lineTo(456, 466);
  ctx.stroke();
  ctx.fillStyle = '#4e5364';
  ctx.fillRect(0, 466, 960, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 30; x < 960; x += 64) ctx.fillRect(x, 466, 1.5, 16);
  ctx.fillStyle = '#7b8091';
  ctx.fillRect(0, 482, 960, 6);
  ctx.fillStyle = '#5b5f6f';
  ctx.fillRect(0, 488, 960, 4);
  ctx.fillStyle = '#4c5162';
  ctx.fillRect(346, 482, 222, 10);
  const road = ctx.createLinearGradient(0, 492, 0, 540);
  road.addColorStop(0, '#1d1f2b');
  road.addColorStop(1, '#14151d');
  ctx.fillStyle = road;
  ctx.fillRect(0, 492, 960, 48);
  ctx.fillStyle = 'rgba(255, 220, 120, 0.25)';
  for (let x = 20; x < 960; x += 90) ctx.fillRect(x, 532, 44, 3);
  // The streetlight's pole.
  ctx.fillStyle = '#2a2f3d';
  ctx.fillRect(818, 196, 6, 286);
  ink(ctx, 2);
  ctx.strokeRect(818, 196, 6, 286);
  limb(ctx, [{ x: 821, y: 200 }, { x: 808, y: 188 }, { x: 790, y: 190 }], 4, '#2a2f3d', 2);
  box(ctx, 774, 188, 34, 9, 4, '#3a3f4e', 2);
}

function paintHouse(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(-HOUSE_BOX.x, -HOUSE_BOX.y);
  const { left, right, ground, eave } = HOUSE;
  // Walls: lap siding, warmer toward the streetlight.
  ctx.fillStyle = C.siding;
  ctx.fillRect(left, eave, right - left, ground - eave);
  ctx.strokeStyle = C.sidingLine;
  ctx.lineWidth = 1.5;
  for (let y = eave + 6; y < ground; y += 8) {
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  const warm = ctx.createLinearGradient(left, 0, right, 0);
  warm.addColorStop(0, 'rgba(10, 16, 40, 0.35)');
  warm.addColorStop(0.6, 'rgba(10, 16, 40, 0)');
  warm.addColorStop(1, 'rgba(255, 160, 70, 0.14)');
  ctx.fillStyle = warm;
  ctx.fillRect(left, eave, right - left, ground - eave);
  ink(ctx, 3);
  ctx.strokeRect(left, eave, right - left, ground - eave);
  ctx.fillStyle = C.trim;
  ctx.fillRect(left - 2, HOUSE.floor - 3, right - left + 4, 7);
  ctx.strokeRect(left - 2, HOUSE.floor - 3, right - left + 4, 7);
  for (const x of [left, right - 10]) {
    ctx.fillRect(x, eave, 10, ground - eave);
    ctx.strokeRect(x, eave, 10, ground - eave);
  }
  // Foundation.
  ctx.fillStyle = '#4a4a55';
  ctx.fillRect(left - 4, ground - 2, right - left + 8, 12);
  ctx.strokeRect(left - 4, ground - 2, right - left + 8, 12);
  // Chimney, then the hip roof with its shingles and fascia.
  box(ctx, 628, 86, 30, 60, 1, '#5b3b38', 2.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let y = 94; y < 140; y += 7) {
    ctx.beginPath();
    ctx.moveTo(628, y);
    ctx.lineTo(658, y);
    ctx.stroke();
  }
  box(ctx, 624, 80, 38, 8, 1, '#4a302e', 2.5);
  poly(ctx, [316, 192, 764, 192, 664, 102, 416, 102], C.roof, 3);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(316, 192);
  ctx.lineTo(764, 192);
  ctx.lineTo(664, 102);
  ctx.lineTo(416, 102);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = C.roofLine;
  ctx.lineWidth = 2;
  for (let y = 112; y < 192; y += 10) {
    ctx.beginPath();
    ctx.moveTo(300, y);
    ctx.lineTo(780, y);
    ctx.stroke();
    for (let x = 300 + ((y / 10) % 2) * 12; x < 780; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  ctx.restore();
  poly(ctx, [316, 192, 764, 192, 664, 102, 416, 102], null, 3);
  box(ctx, 312, 188, 456, 8, 1, '#262c40', 2.5);
  // The porch roof over the door (the porch under it is modular, and Gary's).
  poly(ctx, [490, 316, 590, 316, 540, 288], '#232a3e', 2.5);
  box(ctx, 486, 312, 108, 7, 1, C.trim, 2.5);
  // Windows: trim, sills, then the glass is punched out so the rooms show through.
  const frame = (w: { x: number; y: number; w: number; h: number }, sill = true): void => {
    box(ctx, w.x - 6, w.y - 6, w.w + 12, w.h + 12, 2, C.trim, 2.5);
    if (sill) box(ctx, w.x - 10, w.y + w.h + 4, w.w + 20, 6, 1, '#9aa2b7', 2.5);
  };
  frame(BED);
  frame(DARKWIN);
  frame(LANDING);
  frame(LIVING);
  frame(KID);
  box(ctx, DOOR.x - 6, DOOR.y - 6, DOOR.w + 12, DOOR.h + 6, 2, C.trim, 2.5);
  // Shutters beside the upstairs windows.
  for (const [x, y, h] of [[350, 210, 68], [430, 210, 68], [652, 214, 62], [712, 214, 62]] as const) {
    box(ctx, x - (x === 350 || x === 652 ? 4 : 0), y, 8, h, 1, '#232b44', 2);
  }
  // The hose reel bracket under the living-room window and the porch light by the door.
  box(ctx, 452, 384, 8, 20, 1, '#55596a', 2);
  box(ctx, 502, 326, 10, 16, 3, '#2c2a26', 2);
  ctx.globalCompositeOperation = 'destination-out';
  for (const w of [BED, DARKWIN, LANDING, LIVING, KID, DOOR]) ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.globalCompositeOperation = 'source-over';
  ink(ctx, 2.5);
  for (const w of [BED, DARKWIN, LANDING, LIVING, KID, DOOR]) ctx.strokeRect(w.x, w.y, w.w, w.h);
  // Mullions sit on the glass, over the rooms.
  ctx.fillStyle = C.trim;
  for (const x of [LIVING.x + 46, LIVING.x + 92]) {
    ctx.fillRect(x - 2, LIVING.y, 4, LIVING.h);
    ctx.strokeRect(x - 2, LIVING.y, 4, LIVING.h);
  }
  ctx.fillRect(KID.x + KID.w / 2 - 2, KID.y, 4, KID.h);
  ctx.strokeRect(KID.x + KID.w / 2 - 2, KID.y, 4, KID.h);
  ctx.fillRect(DARKWIN.x, DARKWIN.y + DARKWIN.h / 2 - 2, DARKWIN.w, 4);
  ctx.strokeRect(DARKWIN.x, DARKWIN.y + DARKWIN.h / 2 - 2, DARKWIN.w, 4);
  ctx.restore();
}

function paintLight(ctx: CanvasRenderingContext2D): void {
  // The sodium streetlight: a cone and a pool on the sidewalk, and the house's own porch light.
  const cone = ctx.createRadialGradient(LAMP.x, LAMP.y + 8, 4, LAMP.x, LAMP.y + 140, 260);
  cone.addColorStop(0, 'rgba(255, 170, 70, 0.34)');
  cone.addColorStop(0.45, 'rgba(255, 140, 50, 0.1)');
  cone.addColorStop(1, 'rgba(255, 140, 50, 0)');
  ctx.fillStyle = cone;
  ctx.fillRect(480, 180, 480, 360);
  const pool = ctx.createRadialGradient(LAMP.x, 476, 10, LAMP.x, 476, 190);
  pool.addColorStop(0, 'rgba(255, 170, 80, 0.32)');
  pool.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = pool;
  ctx.save();
  ctx.translate(0, 476);
  ctx.scale(1, 0.35);
  ctx.translate(0, -476);
  ctx.fillRect(540, 300, 420, 360);
  ctx.restore();
  const porch = ctx.createRadialGradient(507, 336, 2, 507, 360, 90);
  porch.addColorStop(0, 'rgba(255, 210, 140, 0.4)');
  porch.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = porch;
  ctx.fillRect(410, 270, 200, 180);
}

/** Draws the cached sky, ground and far houses. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, time: number): void {
  if (!backdrop) {
    backdrop = canvas(960, 540);
    const c = backdrop?.getContext('2d');
    if (c) paintBackdrop(c);
  }
  if (backdrop) ctx.drawImage(backdrop, 0, 0);
  else paintBackdrop(ctx);
  // A few stars twinkle.
  for (let i = 0; i < 8; i += 1) {
    const a = 0.5 + 0.5 * Math.sin(time * (1.3 + i * 0.37) + i * 2.1);
    ctx.fillStyle = `rgba(240, 244, 255, ${0.25 + 0.6 * a})`;
    const x = noise(i * 13.3 + 4) * 300 + (i % 2) * 560;
    const y = 20 + noise(i * 2.9 + 1) * 140;
    ctx.fillRect(x - 0.5, y - 2, 1.2, 5);
    ctx.fillRect(x - 2, y - 0.5, 5, 1.2);
  }
}

function drawHouseShell(ctx: CanvasRenderingContext2D): void {
  if (!houseCache) {
    houseCache = canvas(HOUSE_BOX.w, HOUSE_BOX.h);
    const c = houseCache?.getContext('2d');
    if (c) paintHouse(c);
  }
  if (houseCache) ctx.drawImage(houseCache, HOUSE_BOX.x, HOUSE_BOX.y);
  else {
    ctx.save();
    ctx.translate(HOUSE_BOX.x, HOUSE_BOX.y);
    paintHouse(ctx);
    ctx.restore();
  }
}

/** The streetlight and porch light, added over everything on the set. */
export function drawLight(ctx: CanvasRenderingContext2D, time: number, flicker: number): void {
  if (!lightCache) {
    lightCache = canvas(960, 540);
    const c = lightCache?.getContext('2d');
    if (c) paintLight(c);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.85 + 0.15 * flicker;
  if (lightCache) ctx.drawImage(lightCache, 400, 180, 560, 360, 400, 180, 560, 360);
  ctx.restore();
  // The lamp head itself.
  ctx.fillStyle = `rgba(255, 196, 110, ${0.75 + 0.25 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(LAMP.x + 1, LAMP.y + 1, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Moths.
  for (let i = 0; i < 3; i += 1) {
    const a = time * (2.1 + i * 0.7) + i * 2;
    ctx.fillStyle = 'rgba(255, 236, 200, 0.8)';
    ctx.fillRect(LAMP.x + Math.cos(a) * (12 + i * 6), LAMP.y + 14 + Math.sin(a * 1.3) * (6 + i * 3), 2, 2);
  }
}

// ─── The rooms behind the glass ─────────────────────────────────────────────────────────────────────────────

export interface Blinds { slats: Spring[]; raise: Spring; targets: number[]; raiseTarget: number }
const SLATS = 8;
const PEEK = 3;
const PEEK2 = 4;
const PEEK3 = 2;
export const createBlinds = (): Blinds => ({ slats: Array.from({ length: SLATS }, () => spring(0)), raise: spring(0), targets: new Array(SLATS).fill(0), raiseTarget: 0 });

/** The blinds' targets from the multiplier: one slat at 1×, two by 5×, three at 7×, all the way up by 10×. */
function blindTargets(multiplier: number, out: number[]): number {
  out.fill(0);
  out[PEEK] = 1;
  out[PEEK2] = multiplier >= 2.5 ? (multiplier >= 5 ? 1 : 0.6) : 0;
  out[PEEK3] = multiplier >= 7 ? 1 : 0;
  return smoothstep(8.5, 10, multiplier);
}
/** Steps the slats; returns how many slats flipped this frame (a creak each). */
export function stepBlinds(b: Blinds, multiplier: number, dt: number, settle: boolean): number {
  const before = b.targets.slice();
  const raise = blindTargets(multiplier, b.targets);
  let flips = 0;
  for (let i = 0; i < SLATS; i += 1) {
    if (Math.abs(before[i]! - b.targets[i]!) > 0.05) flips += 1;
    if (settle) settleSpring(b.slats[i]!, b.targets[i]!);
    else stepSpring(b.slats[i]!, b.targets[i]!, 9, 0.32, dt);
  }
  if (Math.abs(raise - b.raiseTarget) > 0.2) {
    flips += 1;
    b.raiseTarget = raise;
  }
  if (settle) {
    settleSpring(b.raise, raise);
    b.raiseTarget = raise;
  } else stepSpring(b.raise, raise, 4, 0.7, dt);
  return settle ? 0 : flips;
}

export interface Bedroom {
  /** The laptop's light: 0 green, 1 red; the SOLD flash; the room going dark; the chart's level. */
  red: number;
  sold: number;
  dark: number;
  chart: number;
  mug: number;
  degen: WindowDegen;
  time: number;
}

/** The colour the laptop throws on the ceiling. */
export function glowColour(room: Bedroom): [number, number, number] {
  const g: [number, number, number] = [93, 255, 149];
  const r: [number, number, number] = [255, 61, 77];
  const w: [number, number, number] = [235, 255, 240];
  let c: [number, number, number] = [mix(g[0], r[0], room.red), mix(g[1], r[1], room.red), mix(g[2], r[2], room.red)];
  if (room.sold > 0) c = [mix(c[0], w[0], room.sold), mix(c[1], w[1], room.sold), mix(c[2], w[2], room.sold)];
  return c;
}
const rgba = (c: [number, number, number], a: number): string => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

function drawBedroom(ctx: CanvasRenderingContext2D, room: Bedroom, blinds: Blinds, x: number, y: number, w: number, h: number): void {
  const col = glowColour(room);
  const lit = 1 - room.dark;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#0a1018';
  ctx.fillRect(x, y, w, h);
  // The ceiling glow from the laptop behind him.
  const pulse = 0.85 + 0.15 * Math.sin(room.time * 2.3) + 0.05 * Math.sin(room.time * 7.1);
  const glow = ctx.createRadialGradient(x + w * 0.66, y - 6, 4, x + w * 0.66, y + 10, w * 0.75);
  glow.addColorStop(0, rgba(col, 0.75 * lit * pulse));
  glow.addColorStop(1, rgba(col, 0.04 * lit));
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  // The bed and the laptop on it, chart and all.
  ctx.fillStyle = '#1b2134';
  ctx.fillRect(x + 70, y + h - 22, w - 60, 22);
  ctx.fillStyle = '#28304a';
  ctx.fillRect(x + 66, y + h - 26, w - 56, 6);
  const lx = x + w - 52;
  const ly = y + h - 46;
  box(ctx, lx, ly, 36, 24, 2, '#10161f', 1.5);
  ctx.fillStyle = rgba(col, 0.35 + 0.65 * lit);
  ctx.fillRect(lx + 3, ly + 3, 30, 18);
  if (room.sold < 0.5) {
    ctx.strokeStyle = room.red > 0.5 ? '#5a0010' : '#05401c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 8; i += 1) {
      const px = lx + 5 + i * 3.2;
      const level = 0.5 + (i / 8 - 0.5) * room.chart + 0.12 * (noise(i * 3.7 + Math.floor(room.time * 2)) - 0.5);
      const py = ly + 18 - 13 * clamp(level, 0, 1);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  poly(ctx, [lx - 4, ly + 24, lx + 40, ly + 24, lx + 44, ly + 28, lx - 8, ly + 28], '#2c3446', 1.5);
  drawDegenWindow(ctx, room.degen, x, y, h, col, lit);
  // The blinds: slats lit from behind, opening on their springs, raised on a cord by 10×.
  const pitch = h / SLATS;
  const raise = clamp(blinds.raise.x, 0, 1);
  const tint = `rgb(${mix(46, mix(200, col[0], 0.28), lit) | 0}, ${mix(54, mix(214, col[1], 0.28), lit) | 0}, ${mix(72, mix(196, col[2], 0.28), lit) | 0})`;
  for (let i = 0; i < SLATS; i += 1) {
    const open = clamp(blinds.slats[i]!.x, -0.1, 1.15);
    const top = mix(y + i * pitch, y + 1 + i * 2.6, raise);
    const sh = mix(pitch * (1 - 0.86 * clamp(open, 0, 1)), 2.6, raise);
    ctx.fillStyle = tint;
    ctx.fillRect(x, top, w, Math.max(0.8, sh - 0.6));
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, top + Math.max(0.8, sh - 0.6) - 1.2, w, 1.2);
  }
  // The cords.
  ctx.strokeStyle = 'rgba(230, 230, 220, 0.35)';
  ctx.lineWidth = 1;
  for (const cx of [x + 24, x + w - 24]) {
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, mix(y + h, y + 22, raise));
    ctx.stroke();
  }
  // His fingers holding the slats down beside his eyes, over the blinds.
  if (raise < 0.5 && room.degen.present > 0.5 && !room.degen.turned) {
    const fingers = (cx: number, slat: number, k: number): void => {
      if (k < 0.3) return;
      const fy = y + slat * pitch + 1;
      for (let f = 0; f < 2; f += 1) {
        ctx.save();
        ctx.translate(cx + f * 6, fy);
        ctx.rotate(-0.15 + f * 0.1);
        box(ctx, -2.6, -7, 5.2, 11, 2.6, '#d9bea2', 1.5);
        ctx.restore();
      }
    };
    fingers(x + 40, PEEK + 1, clamp(blinds.slats[PEEK]!.x, 0, 1));
    fingers(x + 86, PEEK2 + 1, clamp(blinds.slats[PEEK2]!.x, 0, 1));
  }
  // The SOLD flash on the glass.
  if (room.sold > 0.02) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * room.sold})`;
    ctx.fillRect(x, y, w, h);
  }
  // A sheen on the glass.
  poly(ctx, [x + 10, y, x + 40, y, x + 4, y + h, x - 26, y + h], 'rgba(255,255,255,0.05)', 0);
  ctx.restore();
  // The mug on the sill, outside the blinds: full at 1×, empty by 8×.
  drawMug(ctx, x + 18, y + h - 2, room.mug, room.time);
}

function drawMug(ctx: CanvasRenderingContext2D, x: number, y: number, level: number, time: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(210, 230, 255, 0.28)';
  ink(ctx, 1.8);
  ctx.beginPath();
  ctx.roundRect(x - 8, y - 18, 16, 18, 3);
  ctx.fill();
  if (level > 0.02) {
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(x - 6.5, y - 1.5 - 15 * level, 13, 15 * level);
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(x - 6.5, y - 1.5 - 15 * level, 13, 1.6);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 10, y - 10, 4.5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  if (level > 0.3) {
    ctx.strokeStyle = `rgba(230, 236, 245, ${0.35 * level})`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 2; i += 1) {
      const s = (time * 0.6 + i * 0.5) % 1;
      ctx.beginPath();
      ctx.moveTo(x - 2 + i * 4, y - 20 - s * 14);
      ctx.quadraticCurveTo(x + 4 * Math.sin(time * 2 + i) + i * 4, y - 26 - s * 14, x + i * 4, y - 32 - s * 14);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export interface SetState {
  time: number;
  multiplier: number;
  bedroom: Bedroom;
  blinds: Blinds;
  items: Items;
  /** The front door: open amount (0..1) or gone (pulled off at the crash). */
  doorOpen: number;
  doorGone: boolean;
  hallLight: number;
  /** The degen passing the landing window on his way down (0..1, or -1). */
  landing: number;
  kidLight: number;
  kidWave: number;
  neighbourLight: number;
  neighbour: number;
  /** Sprinklers popped up and running. */
  spray: number;
  /** The for-sale sign's growth 0..1 and UNDER CONTRACT lit 0..1. */
  sign: number;
  contract: number;
  /** The porch gone and the QR on the slab scanned. */
  qr: number;
  /** Gary's vest folded on the mailbox post. */
  vest: boolean;
  /** The Post-it on the door frame, and the callout at the end of the crash. */
  postit: boolean;
  callout: number;
  /** House boards settling after an exit. */
  boards: number;
  shake: number;
  /** Fridge notice (OWNERSHIP TRANSFERRED) and its jingle notes. */
  fridgeNotice: number;
  jingle: number;
}

function drawLiving(ctx: CanvasRenderingContext2D, s: SetState): void {
  const { x, y, w, h } = LIVING;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#141b2e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1a2238';
  ctx.fillRect(x, y + h - 14, w, 14);
  const tvOn = !s.items.tvDark;
  // TV light washing the room: it changes shot every 0.7 s.
  // The TV cuts to a new shot every 0.6 s: blue, warm, green, round and round.
  const shot = Math.floor(s.time * 1.65);
  const tvCol = TV_SHOTS[shot % TV_SHOTS.length]!;
  if (tvOn) {
    const k = 0.55 + 0.45 * noise(shot * 3.3);
    ctx.fillStyle = `rgba(${tvCol[0]}, ${tvCol[1]}, ${tvCol[2]}, ${0.18 * k})`;
    ctx.fillRect(x, y, w, h);
  }
  // The TV on the wall, or the patch it leaves, shaped like a mount.
  const tv = s.items;
  if (tv.home.tv) {
    const j = tv.tvPull * 4;
    box(ctx, 352 + j, 320, 68, 38, 2, '#0b0d12', 2);
    if (tvOn) {
      ctx.fillStyle = `rgb(${tvCol[0] * 0.62 | 0}, ${tvCol[1] * 0.62 | 0}, ${tvCol[2] * 0.7 | 0})`;
      ctx.fillRect(355 + j, 323, 62, 32);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(359 + j, 327 + i * 6, 40 + 12 * noise(i + shot), 2);
    }
    if (tv.tvPull > 0) {
      blob(ctx, 386 + j, 339, 6, 6, 'rgba(200, 220, 255, 0.6)', 1.5);
    }
  } else {
    ctx.fillStyle = '#2a3350';
    ctx.fillRect(352, 320, 68, 38);
    ctx.strokeStyle = '#3a4566';
    ctx.lineWidth = 2;
    ctx.strokeRect(366, 328, 40, 22);
    ctx.fillStyle = '#0c0f18';
    for (const [bx, by] of [[366, 328], [406, 328], [366, 350], [406, 350]] as const) ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
  }
  // A couch.
  ctx.fillStyle = '#29223a';
  ctx.fillRect(x + 8, y + h - 20, 70, 20);
  ctx.fillRect(x + 4, y + h - 28, 12, 28);
  // The smart fridge, its screen a family photo until the firmware notice.
  if (!s.items.fridgeGone) {
    box(ctx, 434, 314, 42, 80, 3, '#9aa3b4', 2);
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(434, 342);
    ctx.lineTo(476, 342);
    ctx.stroke();
    ctx.fillStyle = '#5c6474';
    ctx.fillRect(468, 322, 3, 14);
    drawFridgeScreen(ctx, 445, 348, s.fridgeNotice, s.time);
  }
  ctx.restore();
}

/** The fridge's screen: a family photo slideshow, then OWNERSHIP TRANSFERRED. */
export function drawFridgeScreen(ctx: CanvasRenderingContext2D, x: number, y: number, notice: number, time: number): void {
  if (notice > 0.5) {
    ctx.fillStyle = Math.sin(time * 6) > 0 ? '#3fa7ff' : '#77c4ff';
    ctx.fillRect(x, y, 22, 16);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 8);
    ctx.lineTo(x + 10, y + 12);
    ctx.lineTo(x + 17, y + 4);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = '#ffe2a8';
  ctx.fillRect(x, y, 22, 16);
  const slide = Math.floor(time / 2.2) % 2;
  ctx.fillStyle = slide ? '#7aa6d8' : '#f0a86a';
  ctx.fillRect(x + 1, y + 1, 20, 14);
  ctx.fillStyle = '#3b2a22';
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(x + 5 + i * 6, y + 7 - (i === 2 ? -2 : 0), i === 2 ? 1.6 : 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 3.5 + i * 6, y + 9 + (i === 2 ? 2 : 0), 3, 5 - (i === 2 ? 2 : 0));
  }
}

function drawKidRoom(ctx: CanvasRenderingContext2D, s: SetState): void {
  const { x, y, w, h } = KID;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const on = clamp(s.kidLight, 0, 1);
  ctx.fillStyle = on > 0.02 ? `rgb(${mix(16, 255, on) | 0}, ${mix(22, 214, on) | 0}, ${mix(40, 140, on) | 0})` : '#101628';
  ctx.fillRect(x, y, w, h);
  // Glow-in-the-dark stars on the wall, curtains at the sides.
  ctx.fillStyle = on > 0.5 ? 'rgba(255, 250, 220, 0.6)' : 'rgba(170, 255, 190, 0.35)';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(x + 8 + noise(i * 2.7) * (w - 16), y + 6 + noise(i * 5.3) * 26, 2.5, 2.5);
  if (on > 0.3) drawKid(ctx, x + w * 0.62, y + h, on, s.kidWave, s.time);
  ctx.fillStyle = on > 0.3 ? '#c4718a' : '#3a2a44';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 18, y + h * 0.5, x + 6, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.quadraticCurveTo(x + w - 18, y + h * 0.5, x + w - 6, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDarkRoom(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, t: number): void {
  ctx.fillStyle = '#0b1122';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // A streak of streetlight on the glass.
  poly(ctx, [r.x + r.w - 18, r.y, r.x + r.w - 6, r.y, r.x + r.w - 26, r.y + r.h, r.x + r.w - 38, r.y + r.h], `rgba(255, 170, 90, ${0.08 + 0.02 * Math.sin(t)})`, 0);
}

function drawLanding(ctx: CanvasRenderingContext2D, s: SetState): void {
  drawDarkRoom(ctx, LANDING, s.time);
  // The stair rail, and the degen's silhouette going down it in a hurry.
  ctx.save();
  ctx.beginPath();
  ctx.rect(LANDING.x, LANDING.y, LANDING.w, LANDING.h);
  ctx.clip();
  ctx.strokeStyle = '#1d2740';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(LANDING.x, LANDING.y + 20);
  ctx.lineTo(LANDING.x + LANDING.w, LANDING.y + 52);
  ctx.stroke();
  if (s.landing >= 0 && s.landing <= 1) {
    const u = s.landing;
    const px = mix(LANDING.x + LANDING.w + 14, LANDING.x - 14, u);
    const py = mix(LANDING.y + 26, LANDING.y + 56, u);
    ctx.fillStyle = '#05070d';
    ctx.beginPath();
    ctx.arc(px, py - 26, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px, py, 11, 18, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDoorway(ctx: CanvasRenderingContext2D, s: SetState): void {
  const { x, y, w, h } = DOOR;
  ctx.fillStyle = '#06080f';
  ctx.fillRect(x, y, w, h);
  if (s.hallLight > 0.01) {
    ctx.fillStyle = `rgba(255, 200, 120, ${0.55 * s.hallLight})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = 'rgba(40, 50, 80, 0.6)';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(x + 6 + i * 3, y + 40 + i * 10, w - 18, 3);
}

/** The house, with its rooms behind the glass and its cache over them. Shakes as one piece on its slab. */
export function drawHouse(ctx: CanvasRenderingContext2D, s: SetState): void {
  ctx.save();
  if (s.shake !== 0) ctx.translate(s.shake, Math.abs(s.shake) * 0.25);
  drawBedroom(ctx, s.bedroom, s.blinds, BED.x, BED.y, BED.w, BED.h);
  drawDarkRoom(ctx, DARKWIN, s.time);
  drawLanding(ctx, s);
  drawLiving(ctx, s);
  drawKidRoom(ctx, s);
  drawDoorway(ctx, s);
  drawHouseShell(ctx);
  drawWindowSpill(ctx, s);
  if (s.bedroom.sold > 0.05) {
    // The laptop says SOLD, loud enough to read from the street.
    const k = clamp(s.bedroom.sold * 1.4, 0, 1);
    ctx.save();
    ctx.translate(BED.x + BED.w / 2, BED.y + BED.h / 2 + 12);
    ctx.rotate(-0.08);
    ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    ctx.globalAlpha *= k;
    memeText(ctx, 'SOLD', 0, 0, 46, '#7cf67c', 'center');
    ctx.restore();
  }
  // Settling boards after the exit: one at a time, each a plank that slips a hair out of line.
  for (let i = 0; i < Math.min(BOARDS.length, s.boards); i += 1) {
    const [bx, by] = BOARDS[i]!;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(i % 2 ? 0.12 : -0.12);
    ctx.fillStyle = '#4a5a80';
    ctx.fillRect(-8, -3, 16, 6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -3, 16, 6);
    ctx.restore();
  }
  drawFrontDoor(ctx, s);
  drawNumbers(ctx, s);
  if (s.items.home.gutter) drawGutterHome(ctx);
  if (s.items.home.hose) drawHoseCoil(ctx, 456, 392, 0);
  if (!s.items.home.porch) drawSlab(ctx, s);
  ctx.restore();
}

function drawWindowSpill(ctx: CanvasRenderingContext2D, s: SetState): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const col = glowColour(s.bedroom);
  const lit = (1 - s.bedroom.dark) * (0.6 + 0.4 * (s.blinds.raise.x + 0.3 * s.blinds.slats[PEEK2]!.x));
  if (lit > 0.01) {
    const g = ctx.createRadialGradient(BED.x + BED.w / 2, BED.y + BED.h / 2, 30, BED.x + BED.w / 2, BED.y + BED.h / 2, 150);
    g.addColorStop(0, rgba(col, 0.22 * lit));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(BED.x - 130, BED.y - 100, BED.w + 260, BED.h + 200);
  }
  if (s.kidLight > 0.02) {
    const g = ctx.createRadialGradient(KID.x + KID.w / 2, KID.y + KID.h / 2, 20, KID.x + KID.w / 2, KID.y + KID.h / 2, 110);
    g.addColorStop(0, `rgba(255, 200, 110, ${0.22 * s.kidLight})`);
    g.addColorStop(1, 'rgba(255, 200, 110, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(KID.x - 100, KID.y - 80, KID.w + 200, KID.h + 170);
  }
  if (!s.items.tvDark) {
    ctx.fillStyle = `rgba(120, 160, 255, ${0.05 + 0.04 * noise(Math.floor(s.time * 1.65) * 3.3)})`;
    ctx.fillRect(LIVING.x - 20, LIVING.y + LIVING.h, LIVING.w + 40, 40);
  }
  ctx.restore();
}

function drawFrontDoor(ctx: CanvasRenderingContext2D, s: SetState): void {
  if (s.doorGone) {
    // The hinges stay, and the note.
    ctx.fillStyle = '#c0a060';
    ctx.fillRect(DOOR.x - 1, DOOR.y + 12, 3, 8);
    ctx.fillRect(DOOR.x - 1, DOOR.y + 62, 3, 8);
  } else {
    // Hinged on the left; opening narrows it toward the hinge (swinging into the hall).
    const open = clamp(s.doorOpen, 0, 1);
    const w = DOOR.w * (1 - 0.8 * open);
    drawDoorLeaf(ctx, DOOR.x, DOOR.y, w, DOOR.h, s.bedroom, open);
  }
  if (s.postit) drawPostit(ctx, DOOR.x + DOOR.w + 4, DOOR.y + 22, 0);
}

/** The front door, also used for the one riding shotgun: its little window mirrors the bedroom. */
export function drawDoorLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, room: Bedroom, open = 0): void {
  box(ctx, x, y, w, h, 1, open > 0.2 ? '#4a2e1c' : '#6b3f24', 2.5);
  if (w < 12) return;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + w * 0.16, y + h * 0.48, w * 0.68, h * 0.4);
  // The little window.
  const col = glowColour(room);
  const lit = 1 - room.dark;
  ctx.fillStyle = `rgb(${mix(14, col[0] * 0.55, lit) | 0}, ${mix(18, col[1] * 0.55, lit) | 0}, ${mix(26, col[2] * 0.55, lit) | 0})`;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(x + w * 0.22, y + 8, w * 0.56, h * 0.28, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(230, 230, 220, 0.35)';
  for (let i = 0; i < 3; i += 1) ctx.fillRect(x + w * 0.22 + 2, y + 12 + i * 6, w * 0.56 - 4, 1.5);
  blob(ctx, x + w * 0.82, y + h * 0.55, 2.6, 2.6, '#d8b45a', 1.5);
}

/** The Post-it's callout, so the note can be read from the street: drawn over everything at the end of the crash. */
export function drawCallout(ctx: CanvasRenderingContext2D, callout: number): void {
  if (callout > 0.02) drawPostit(ctx, DOOR.x + DOOR.w + 4, DOOR.y + 22, callout, true);
}

function drawPostit(ctx: CanvasRenderingContext2D, x: number, y: number, callout: number, only = false): void {
  if (!only) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.12);
  ctx.fillStyle = '#ffe75a';
  ctx.fillRect(-7, -7, 14, 14);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-7, -7, 14, 14);
  ctx.fillStyle = '#4a4040';
  for (let i = 0; i < 3; i += 1) ctx.fillRect(-5, -4 + i * 3.5, 8 - i * 1.5, 1);
  ctx.restore();
  }
  if (callout > 0.02) {
    // The callout, so the note can be read: a big Post-it on a leader line.
    const k = clamp(callout, 0, 1.2);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 231, 90, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 2);
    ctx.lineTo(x - 70, y - 2);
    ctx.stroke();
    ctx.translate(x - 136, y + 2);
    ctx.rotate(-0.05);
    ctx.scale(k, k);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-56, -40, 118, 86);
    ctx.fillStyle = '#ffe75a';
    ink(ctx, 2);
    ctx.fillRect(-60, -44, 118, 86);
    ctx.strokeRect(-60, -44, 118, 86);
    ctx.fillStyle = '#f2d53a';
    ctx.fillRect(-60, -44, 118, 12);
    ctx.fillStyle = '#26303f';
    ctx.font = 'italic 700 17px "Comic Sans MS", "Bradley Hand", "Segoe Print", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('you were', -1, -12);
    ctx.fillText('407 days', -1, 8);
    ctx.fillText('late', -1, 28);
    ctx.restore();
  }
}

function drawNumbers(ctx: CanvasRenderingContext2D, s: SetState): void {
  const left = s.items.numbersLeft;
  const digits = ['4', '0', '7'];
  ctx.font = '900 17px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i += 1) {
    const x = 580 + i * 14;
    const y = 343;
    if (i < 3 - left) {
      // A clean patch where each digit was.
      ctx.fillStyle = 'rgba(120, 135, 170, 0.35)';
      ctx.fillText(digits[i]!, x, y);
      continue;
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText(digits[i]!, x, y);
    ctx.fillStyle = '#d9ad4e';
    ctx.fillText(digits[i]!, x, y);
  }
}

function drawGutterHome(ctx: CanvasRenderingContext2D): void {
  box(ctx, 316, 192, 450, 7, 2, '#8d96a8', 2);
  box(ctx, 318, 196, 8, 206, 2, '#8d96a8', 2);
  box(ctx, 312, 396, 18, 8, 2, '#8d96a8', 2);
}

function drawSlab(ctx: CanvasRenderingContext2D, s: SetState): void {
  // The porch is gone: the footing under the door, and the QR code the contractor stamped into it.
  box(ctx, 478, 404, 126, 16, 1, '#5a5a66', 2);
  const qx = 528;
  const qy = 406;
  ctx.fillStyle = '#d8d8de';
  ctx.fillRect(qx - 1, qy - 1, 24, 13);
  ctx.fillStyle = '#16161c';
  for (let i = 0; i < 9; i += 1) for (let j = 0; j < 5; j += 1) if (noise(i * 7 + j * 13) > 0.5 || (i < 2 && j < 2) || (i > 6 && j < 2)) ctx.fillRect(qx + i * 2.4, qy + j * 2.2, 2.2, 2);
  if (s.qr > 0 && s.qr < 1) {
    const k = smoothstep(0, 0.2, s.qr) * (1 - smoothstep(0.8, 1, s.qr));
    ctx.save();
    ctx.globalAlpha *= k;
    box(ctx, qx - 18, qy - 54 - 20 * s.qr, 62, 24, 6, '#ffffff', 2);
    label(ctx, '→ LIEN', qx + 13, qy - 42 - 20 * s.qr, 13, '#c0182c', 900);
    ctx.restore();
  }
}

export function drawHoseCoil(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, i * 2 - 2, 19 - i * 2, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#3aa24a';
  ctx.lineWidth = 4;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, i * 2 - 2, 19 - i * 2, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  box(ctx, 16, 2, 9, 5, 2, '#d0a040', 1.5);
  ctx.restore();
}

// ─── The lawn and the neighbours ────────────────────────────────────────────────────────────────────────────

export function drawNeighbourHouse(ctx: CanvasRenderingContext2D, s: SetState): void {
  const d = NEIGHBOUR.door;
  const on = clamp(s.neighbourLight, 0, 1);
  // The door opens a crack when the light comes on; the neighbour looks out.
  ctx.fillStyle = on > 0.05 && s.neighbour > 0.05 ? '#2a1e14' : '#3a2a20';
  ctx.fillRect(d.x, d.y, d.w, d.h);
  if (s.neighbour > 0.05) {
    ctx.fillStyle = `rgba(255, 210, 140, ${0.6 * s.neighbour})`;
    ctx.fillRect(d.x + 2, d.y + 2, d.w * 0.6, d.h - 2);
    drawNeighbour(ctx, d.x + d.w * 0.32, d.y + d.h, s.neighbour, s.time);
  }
  box(ctx, d.x + d.w * (s.neighbour > 0.05 ? 0.6 : 0), d.y, d.w * (s.neighbour > 0.05 ? 0.4 : 1), d.h, 0, '#5a3a28', 2);
  const l = NEIGHBOUR.lamp;
  box(ctx, l.x - 5, l.y - 8, 10, 14, 3, '#2b2a28', 2);
  if (on > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y + 20, 80);
    g.addColorStop(0, `rgba(255, 215, 150, ${0.75 * on})`);
    g.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - 90, l.y - 70, 180, 160);
    ctx.restore();
    blob(ctx, l.x, l.y - 1, 4, 5, `rgba(255, 240, 200, ${on})`, 1);
  }
}

export function drawSprinklers(ctx: CanvasRenderingContext2D, s: SetState): void {
  const up = clamp(s.spray, 0, 1.2);
  for (let i = 0; i < SPRINKLERS.length; i += 1) {
    const x = SPRINKLERS[i]!;
    const y = 452 + (i % 2) * 6;
    box(ctx, x - 3, y - 2 - 7 * up, 6, 6 + 7 * up, 1, '#202428', 1.5);
    if (up < 0.6) continue;
    // A sweeping fan of droplets on a parabola.
    const sweep = Math.sin(s.time * 1.3 + i * 1.7) * 0.7;
    for (let a = 0; a < 2; a += 1) {
      const dir = sweep + (a ? 0.35 : -0.35);
      const vx = Math.sin(dir) * 70;
      const vy = -95;
      // The arc as a faint line, the droplets running along it.
      ctx.strokeStyle = 'rgba(170, 215, 255, 0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= 10; k += 1) {
        const t = (k / 10) * 1.12;
        const px = x + vx * t;
        const py = y - 9 + vy * t + 85 * t * t;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(215, 238, 255, 0.95)';
      for (let k = 0; k < 9; k += 1) {
        const t = ((s.time * 1.6 + k / 9 + i * 0.13) % 1) * 1.12;
        const px = x + vx * t;
        const py = y - 9 + vy * t + 85 * t * t;
        if (py > y + 4) continue;
        ctx.fillRect(px - 1.5, py - 1.5, 3.2, 3.2);
      }
    }
    // A mist where it lands.
    ctx.fillStyle = 'rgba(170, 215, 255, 0.12)';
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(sweep) * 70, y + 2, 26, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The for-sale sign, grown like a sapling in a timelapse, the realtor's face already smiling. */
export function drawSign(ctx: CanvasRenderingContext2D, s: SetState): void {
  const g = clamp(s.sign, 0, 1);
  if (g <= 0.005) return;
  const { x, y } = SIGN;
  const sprout = smoothstep(0, 0.25, g);
  const post = smoothstep(0.15, 0.6, g);
  const arm = smoothstep(0.5, 0.75, g);
  const panel = smoothstep(0.7, 1, g);
  const height = mix(14 * sprout, 92, post);
  const wood = `rgb(${mix(70, 196, post) | 0}, ${mix(170, 170, post) | 0}, ${mix(70, 150, post) | 0})`;
  limb(ctx, [{ x, y }, { x: x + Math.sin(s.time * 2) * (1 - post) * 2, y: y - height }], mix(2.5, 6, post), post > 0.5 ? '#e8e2d4' : wood, 2);
  if (post < 0.9) {
    // Leaves while it is still a sapling.
    const leaf = (1 - smoothstep(0.6, 0.9, g)) * sprout;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x, y - height * 0.7);
      ctx.rotate(side * 0.9);
      blob(ctx, 0, -7 * leaf, 3.5 * leaf, 7 * leaf, '#4fbf5a', 1.5);
      ctx.restore();
    }
  }
  if (arm > 0) {
    const ax = x - 66 * arm;
    limb(ctx, [{ x, y: y - height + 6 }, { x: ax, y: y - height + 6 }], 5, '#e8e2d4', 2);
    if (panel > 0) {
      const w = 62;
      const h = 44 * panel;
      const px = x - 66 + 3;
      const py = y - height + 12;
      for (const cx of [px + 8, px + w - 8]) limb(ctx, [{ x: cx, y: y - height + 6 }, { x: cx, y: py }], 1.5, '#9aa0aa', 1);
      box(ctx, px, py, w, h, 3, '#f4f1ea', 2.5);
      if (panel > 0.6) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, w, h);
        ctx.clip();
        ctx.fillStyle = '#c0182c';
        ctx.fillRect(px, py, w, 13);
        label(ctx, 'FOR SALE', px + w / 2, py + 7, 10, '#ffffff', 900, w - 6);
        // The realtor: big hair, bigger smile.
        blob(ctx, px + 15, py + 29, 10, 11, '#6b4426', 1.5);
        blob(ctx, px + 15, py + 31, 7.5, 9, '#f0c9a6', 1.5);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px + 15, py + 33, 4, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.fillRect(px + 11.5, py + 28, 2, 2);
        ctx.fillRect(px + 16.5, py + 28, 2, 2);
        label(ctx, 'CALL', px + 42, py + 23, 8, '#1d2a4a', 800);
        label(ctx, 'TERRY', px + 42, py + 33, 9, '#1d2a4a', 900);
        ctx.restore();
      }
      if (s.contract > 0.02) {
        // UNDER CONTRACT: a rider that lights up.
        const k = clamp(s.contract, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(px + w / 2, py + h + 8, 2, px + w / 2, py + h + 8, 60);
        glow.addColorStop(0, `rgba(255, 70, 70, ${0.5 * k})`);
        glow.addColorStop(1, 'rgba(255, 70, 70, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(px - 40, py + h - 50, w + 80, 110);
        ctx.restore();
        box(ctx, px - 4, py + h + 2, w + 8, 13, 2, k > 0.5 ? '#ff2d3d' : '#7a1820', 2);
        label(ctx, 'UNDER CONTRACT', px + w / 2, py + h + 9, 8.5, '#ffffff', 900, w + 4);
      }
    }
  }
}

export function drawMailboxPost(ctx: CanvasRenderingContext2D, s: SetState): void {
  const x = POST.x;
  limb(ctx, [{ x, y: 482 }, { x, y: 450 }], 7, '#6b4a2c', 2);
  if (s.items.home.mailbox) drawMailbox(ctx, x, 438, 0);
  if (s.vest) {
    // Gary's vest, folded on the post he left.
    box(ctx, x - 13, 440, 26, 11, 2, '#ff8a1e', 2);
    ctx.fillStyle = '#e9f0ff';
    ctx.fillRect(x - 12, 444, 24, 2.5);
  }
}

export function drawMailbox(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#2a3550';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-19, 12);
  ctx.lineTo(-19, -4);
  ctx.quadraticCurveTo(-19, -12, 0, -12);
  ctx.quadraticCurveTo(19, -12, 19, -4);
  ctx.lineTo(19, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  box(ctx, 12, -16, 4, 14, 1, '#d8263a', 1.5);
  ctx.restore();
}
