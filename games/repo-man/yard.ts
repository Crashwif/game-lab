/**
 * The curb: Gary's flatbed tow truck (the cab with its lettered door, the light bar of four amber beacons that
 * stay off the whole round, the tilting deck, the winch and its cable, the pile on the deck), the leased lime
 * supercar with its paper dealer plate on the driveway apron, and every item Gary takes, drawn wherever it is.
 * Drawing only; poses come from repo.ts and nothing here reads or changes the outcome.
 */
import { type Bedroom, drawDoorLeaf, drawFridgeScreen, drawHoseCoil, drawMailbox } from './house';
import { blob, box, ink, INK, label, limb, poly } from './ink';
import type { ItemId } from './lines';
import { APRON_X, APRON_Y, DECK_FRONT, DECK_TAIL, DECK_Y, CAR_LEN, type CarState, LEVER } from './repo';
import { clamp, mix, noise } from './motion';

const PIVOT = DECK_FRONT + 22;
const DROP = 46;
let cabCache: HTMLCanvasElement | null = null;
const CAB_BOX = { x: 0, y: 360, w: 170, h: 150 } as const;

/** The deck's top surface at `x` with the deck tilted by `tilt` (the tail down to the apron at 1). */
export function deckY(x: number, tilt: number, sag: number): number {
  return DECK_Y + sag + (x > PIVOT ? ((x - PIVOT) / (DECK_TAIL - PIVOT)) * DROP * tilt : 0);
}

function paintCab(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(-CAB_BOX.x, -CAB_BOX.y);
  // Hood, cab, bumper; the lettered door.
  poly(ctx, [14, 500, 14, 458, 22, 448, 62, 444, 62, 500], '#c63a2c', 2.5);
  box(ctx, 58, 388, 96, 112, 6, '#c63a2c', 2.5);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(60, 470, 92, 28);
  box(ctx, 4, 484, 22, 18, 3, '#9aa0ad', 2.5);
  box(ctx, 14, 462, 10, 12, 2, '#fff2c0', 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  for (let y = 456; y < 496; y += 6) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(56, y);
    ctx.stroke();
  }
  box(ctx, 66, 444, 82, 54, 3, '#d6463a', 2);
  ctx.fillStyle = '#f6efe0';
  ctx.fillRect(66, 452, 82, 3);
  label(ctx, 'GARY’S', 107, 466, 15, '#fff6dc', 900, 76);
  label(ctx, 'TOWING &', 107, 480, 8.5, '#fff6dc', 800, 76);
  label(ctx, 'LIQUIDATION', 107, 490, 8.5, '#fff6dc', 800, 76);
  // The window frame and the mirror.
  box(ctx, 70, 396, 74, 46, 4, '#0d1220', 2.5);
  box(ctx, 50, 410, 10, 18, 2, '#2a2f3c', 2);
  // The light bar on the roof.
  box(ctx, 66, 380, 82, 9, 2, '#2b2f3a', 2);
  // Headache rack and the exhaust stack behind the cab.
  for (const x of [152, 160]) {
    ctx.fillStyle = '#3d4250';
    ctx.fillRect(x, 392, 4, 72);
  }
  ink(ctx, 2);
  ctx.strokeRect(150, 392, 14, 72);
  box(ctx, 150, 368, 6, 46, 2, '#8a8f9c', 2);
  ctx.restore();
}

export interface TruckDrive {
  dx: number;
  sag: number;
  tilt: number;
  beacons: number;
  time: number;
  /** Gary in the cab (betting, reading by dome light; the drive away). */
  garyInCab: number;
  dome: number;
  /** The door riding shotgun, seatbelted, and the room its little window mirrors. */
  shotgun: boolean;
  room: Bedroom;
  lever: number;
  rolling: number;
}

/** The truck behind the pile: the chassis, the deck and the wheels. */
export function drawTruckBack(ctx: CanvasRenderingContext2D, d: TruckDrive): void {
  ctx.save();
  ctx.translate(d.dx, 0);
  // Under-frame, tail lights.
  box(ctx, 140, 472 + d.sag, 214, 16, 2, '#23262f', 2.5);
  box(ctx, 344, 474 + d.sag, 10, 9, 2, '#d0202c', 2);
  // The deck, tilting about its front.
  const y0 = deckY(DECK_FRONT, d.tilt, d.sag);
  const y1 = deckY(DECK_TAIL, d.tilt, d.sag);
  poly(ctx, [DECK_FRONT, y0, DECK_TAIL, y1, DECK_TAIL, y1 + 11, DECK_FRONT, y0 + 11], '#5d6372', 2.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(DECK_FRONT, y0 + 3);
  ctx.lineTo(DECK_TAIL, y1 + 3);
  ctx.stroke();
  // The gift wrap roll he keeps against the headache rack (for bows), and the winch drum.
  box(ctx, DECK_FRONT + 8, y0 - 46, 9, 46, 3, '#f4efe6', 2);
  ctx.fillStyle = '#d8263a';
  for (let i = 0; i < 5; i += 1) ctx.fillRect(DECK_FRONT + 9, y0 - 42 + i * 9, 7, 3);
  blob(ctx, DECK_FRONT + 16, y0 - 7, 9, 7, '#3b404c', 2);
  // The lever on its post at the tail.
  limb(ctx, [{ x: LEVER.x, y: 486 + d.sag }, { x: LEVER.x, y: LEVER.y + 16 }], 4, '#3b404c', 2);
  limb(ctx, [{ x: LEVER.x, y: LEVER.y + 16 }, { x: LEVER.x - 8 * d.lever, y: LEVER.y }], 3, '#c9cdd6', 1.5);
  blob(ctx, LEVER.x - 8 * d.lever, LEVER.y, 3.5, 3.5, '#e02a3a', 1.5);
  ctx.restore();
}

export function drawWheels(ctx: CanvasRenderingContext2D, dx: number, rolling: number): void {
  for (const x of [64, 262, 300]) {
    const cx = x + dx;
    blob(ctx, cx, 506, 22, 22, '#15161b', 2.5);
    blob(ctx, cx, 506, 10, 10, '#8b909c', 2);
    const a = rolling / 22;
    ctx.strokeStyle = '#3c3f48';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k += 1) {
      const ang = a + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(cx, 506);
      ctx.lineTo(cx + Math.cos(ang) * 9, 506 + Math.sin(ang) * 9);
      ctx.stroke();
    }
  }
}

/** The cab in front of the pile, with Gary (or the door) in the window and the beacons on the roof. */
export function drawCab(ctx: CanvasRenderingContext2D, d: TruckDrive, drawDriver: (ctx: CanvasRenderingContext2D) => void): void {
  ctx.save();
  ctx.translate(d.dx, 0);
  // Inside the window: the dome light, Gary, the door riding shotgun.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(72, 398, 70, 42, 3);
  ctx.clip();
  ctx.fillStyle = '#0a0e18';
  ctx.fillRect(72, 398, 70, 42);
  if (d.dome > 0.01) {
    const g = ctx.createRadialGradient(108, 400, 2, 108, 412, 50);
    g.addColorStop(0, `rgba(255, 222, 150, ${0.75 * d.dome})`);
    g.addColorStop(1, `rgba(255, 200, 120, ${0.12 * d.dome})`);
    ctx.fillStyle = g;
    ctx.fillRect(72, 398, 70, 42);
  }
  if (d.shotgun) {
    drawDoorLeaf(ctx, 112, 402, 26, 56, d.room);
    // The seatbelt across it.
    limb(ctx, [{ x: 140, y: 402 }, { x: 110, y: 444 }], 3, '#2a2a2e', 1);
  }
  ctx.translate(-d.dx, 0);
  if (d.garyInCab > 0.01) drawDriver(ctx);
  ctx.restore();
  if (!cabCache && typeof document !== 'undefined') {
    cabCache = document.createElement('canvas');
    cabCache.width = CAB_BOX.w;
    cabCache.height = CAB_BOX.h;
    const c = cabCache.getContext('2d');
    if (c) {
      // Punch the window out so the inside shows through.
      paintCab(c);
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      c.roundRect(72 - CAB_BOX.x, 398 - CAB_BOX.y, 70, 42, 3);
      c.fill();
    }
  }
  if (cabCache) ctx.drawImage(cabCache, CAB_BOX.x, CAB_BOX.y);
  else paintCab(ctx);
  ctx.fillStyle = 'rgba(160, 190, 255, 0.08)';
  ctx.fillRect(72, 398, 22, 42);
  // The beacons: dull amber all round, and on at the crash.
  for (let i = 0; i < 4; i += 1) {
    const bx = 76 + i * 20;
    const on = clamp(d.beacons * 4 - i * 0.6, 0, 1);
    const spin = Math.cos(d.time * 9 + i * 1.7);
    const lit = on * (0.55 + 0.45 * Math.max(0, spin));
    ctx.fillStyle = on > 0 ? `rgb(${mix(110, 255, lit) | 0}, ${mix(80, 190, lit) | 0}, ${mix(30, 40, lit) | 0})` : '#6e5420';
    ink(ctx, 2);
    ctx.beginPath();
    ctx.arc(bx, 380, 7, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** The beacons' light: four rotating amber beams and the wash they throw on the street and the house. */
export function drawBeaconLight(ctx: CanvasRenderingContext2D, d: TruckDrive): void {
  if (d.beacons <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  let wash = 0;
  for (let i = 0; i < 4; i += 1) {
    const on = clamp(d.beacons * 4 - i * 0.6, 0, 1);
    if (on <= 0) continue;
    const bx = 76 + i * 20 + d.dx;
    const phase = d.time * 9 + i * 1.7;
    const facing = Math.max(0, Math.cos(phase));
    wash += facing * on;
    const g = ctx.createRadialGradient(bx, 376, 1, bx, 376, 16 + 30 * facing);
    g.addColorStop(0, `rgba(255, 200, 60, ${0.75 * on})`);
    g.addColorStop(1, 'rgba(255, 140, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - 70, 306, 140, 140);
    // A beam sweeping across the scene.
    const sweep = Math.sin(phase);
    const len = 420;
    ctx.fillStyle = `rgba(255, 170, 30, ${0.16 * on * (0.3 + 0.7 * facing)})`;
    ctx.beginPath();
    ctx.moveTo(bx, 376);
    ctx.lineTo(bx + sweep * len, 376 - 60 - 40 * facing);
    ctx.lineTo(bx + sweep * len, 376 + 60 + 40 * facing);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = `rgba(255, 150, 20, ${0.05 * wash})`;
  ctx.fillRect(0, 0, 960, 540);
  ctx.restore();
}

/** Exhaust from the stack behind the cab: a pure function of time, so it never accumulates. */
export function drawExhaust(ctx: CanvasRenderingContext2D, time: number, dx: number, rev: number): void {
  for (let k = 0; k < 6; k += 1) {
    const u = (time * (0.55 + 0.4 * rev) + k / 6) % 1;
    const x = 153 + dx + u * (26 + 30 * noise(k * 3.1)) + (dx < 0 ? u * 60 : 0);
    const y = 366 - u * 70;
    const r = 4 + u * 12;
    ctx.fillStyle = `rgba(150, 160, 180, ${0.42 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── The supercar ──────────────────────────────────────────────────────────────────────────────────────────────

export interface CarPose { x: number; y: number; rot: number }
/** The supercar's pose: on the apron, hooked and lifted an inch, winched up the tilted deck, level on it, or towed. */
export function carPose(l: CarState, sag: number, dx: number, towLift: number): CarPose {
  if (l.towed) {
    const fx = APRON_X + 40 + dx;
    const fy = APRON_Y - 18 * towLift;
    const rx = fx + 116;
    return { x: fx - 40, y: fy, rot: Math.atan2(APRON_Y - fy, rx - fx) };
  }
  const nose = mix(APRON_X, DECK_TAIL - CAR_LEN, l.load) + dx;
  const fx = nose + 40;
  const rx = nose + 156;
  const wheel = (x: number): number => (x - dx <= DECK_TAIL + 2 && (l.load > 0 || l.tilt > 0) ? Math.min(APRON_Y, deckY(x - dx, l.tilt, sag)) : APRON_Y);
  let fy = wheel(fx);
  const ry = wheel(rx);
  fy -= 6 * l.lift * (1 - l.load);
  return { x: nose, y: fy, rot: Math.atan2(ry - fy, rx - fx) };
}

/** Draws the supercar with its nose at `p` (the front wheel's contact point is 40 px in). */
export function drawCar(ctx: CanvasRenderingContext2D, p: CarPose, l: CarState, time: number): void {
  ctx.save();
  ctx.translate(p.x + 40, p.y);
  ctx.rotate(p.rot);
  ctx.translate(-40, 0);
  const body = '#a6f02a';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(98, 2, 100, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  poly(ctx, [0, -10, 4, -17, 32, -24, 62, -30, 90, -50, 140, -50, 172, -36, 196, -31, 197, -10, 190, -4, 172, -4, 168, -14, 144, -16, 140, -4, 56, -4, 52, -14, 28, -16, 24, -4, 6, -4], body, 2.5);
  // Shading, the side intake and the stripe.
  ctx.fillStyle = 'rgba(0, 60, 0, 0.22)';
  ctx.beginPath();
  ctx.moveTo(6, -6);
  ctx.lineTo(196, -12);
  ctx.lineTo(196, -6);
  ctx.lineTo(6, -6);
  ctx.fill();
  poly(ctx, [118, -26, 150, -30, 152, -18, 124, -18], '#1a2210', 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, -22);
  ctx.lineTo(88, -36);
  ctx.stroke();
  // Windows.
  poly(ctx, [66, -31, 93, -46, 136, -46, 160, -33], '#121a22', 2);
  ctx.strokeStyle = 'rgba(160, 200, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(84, -36);
  ctx.lineTo(98, -44);
  ctx.stroke();
  // Lights: the headlight slit (flashing on the alarm's chirps), the tail light, the alarm LED.
  const chirp = l.chirp > 0;
  poly(ctx, [3, -15, 22, -19, 20, -15, 4, -12], chirp ? '#ffe680' : '#d8e4ea', 1.5);
  box(ctx, 189, -27, 8, 5, 1, '#d4202c', 1.5);
  if (l.alarm && Math.sin(time * 5) > 0.6) blob(ctx, 74, -32, 1.6, 1.6, '#ff2030', 0);
  // The paper dealer plate.
  box(ctx, 182, -21, 15, 10, 1, '#f4f2ea', 1.5);
  label(ctx, 'TEMP', 189.5, -16, 5, '#30343c', 900);
  // Wheels.
  for (const wx of [40, 156]) {
    blob(ctx, wx, -15, 15, 15, '#121317', 2.5);
    blob(ctx, wx, -15, 8, 8, '#b8bec8', 2);
    ctx.fillStyle = '#e0c040';
    ctx.fillRect(wx - 2, -24, 4, 3);
  }
  ctx.restore();
  if (chirp) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x + 6, p.y - 16, 2, p.x + 6, p.y - 16, 50);
    g.addColorStop(0, 'rgba(255, 230, 140, 0.6)');
    g.addColorStop(1, 'rgba(255, 230, 140, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - 50, p.y - 70, 110, 100);
    ctx.restore();
  }
}

/** The winch cable from the drum along the deck to the tail roller, then to whatever it is hooked to. */
export function drawCable(ctx: CanvasRenderingContext2D, d: TruckDrive, to: { x: number; y: number } | null, hookAt: { x: number; y: number }): void {
  const y0 = deckY(DECK_FRONT + 16, d.tilt, d.sag) - 7 + 0;
  const tail = { x: DECK_TAIL + d.dx, y: deckY(DECK_TAIL, d.tilt, d.sag) - 1 };
  ctx.strokeStyle = '#1a1c22';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(DECK_FRONT + 16 + d.dx, y0);
  ctx.lineTo(tail.x, tail.y);
  if (to) ctx.lineTo(to.x, to.y);
  else ctx.lineTo(hookAt.x, hookAt.y);
  ctx.stroke();
  ctx.strokeStyle = '#9aa0ac';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // The hook.
  const h = to ?? hookAt;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(h.x, h.y + 4, 4, -Math.PI * 0.2, Math.PI * 1.1);
  ctx.stroke();
  ctx.strokeStyle = '#c8ccd6';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

// ─── Items ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface ItemLook { count: number; bow: number; notice: number; time: number }

/** Draws an item centred at (x, y), rotated, squashed on landing. */
export function drawItem(ctx: CanvasRenderingContext2D, id: ItemId, x: number, y: number, rot: number, squash: number, look: ItemLook): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (squash !== 0) ctx.scale(1 - squash * 0.08, 1 + squash * 0.12);
  switch (id) {
    case 'hose':
      drawHoseCoil(ctx, 0, 0, 0);
      break;
    case 'tv':
      box(ctx, -35, -21, 70, 42, 3, '#0b0d12', 2.5);
      ctx.fillStyle = '#141c2e';
      ctx.fillRect(-32, -18, 64, 36);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(-32, -18);
      ctx.lineTo(-10, -18);
      ctx.lineTo(-30, 18);
      ctx.lineTo(-32, 18);
      ctx.fill();
      break;
    case 'bike':
      drawBike(ctx, look.bow, look.time);
      break;
    case 'fridge':
      box(ctx, -21, -40, 42, 80, 4, '#a9b2c2', 2.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-21, -12);
      ctx.lineTo(21, -12);
      ctx.stroke();
      ctx.fillStyle = '#5c6474';
      ctx.fillRect(14, -34, 3, 16);
      ctx.fillRect(14, -6, 3, 22);
      drawFridgeScreen(ctx, -12, -6, look.notice, look.time);
      break;
    case 'mailbox':
      drawMailbox(ctx, 0, 0, 0);
      break;
    case 'numbers': {
      ctx.font = '900 17px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const digits = ['4', '0', '7'];
      for (let i = 0; i < Math.min(3, look.count); i += 1) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.strokeText(digits[i]!, -16 + i * 16, 0);
        ctx.fillStyle = '#d9ad4e';
        ctx.fillText(digits[i]!, -16 + i * 16, 0);
      }
      break;
    }
    case 'porch':
      drawPorch(ctx);
      break;
    case 'gutter':
      box(ctx, -200, -4, 400, 8, 2, '#a3abbc', 2);
      box(ctx, 186, -4, 14, 22, 2, '#a3abbc', 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      for (let gx = -180; gx < 190; gx += 60) {
        ctx.beginPath();
        ctx.moveTo(gx, -4);
        ctx.lineTo(gx, 4);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

/** The modular porch, centred: a platform with its steps and a railing. */
export function drawPorch(ctx: CanvasRenderingContext2D): void {
  box(ctx, -65, 2, 130, 15, 1, '#7a5a3e', 2.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let px = -60; px < 65; px += 10) {
    ctx.beginPath();
    ctx.moveTo(px, 3);
    ctx.lineTo(px, 16);
    ctx.stroke();
  }
  box(ctx, -26, 10, 52, 7, 1, '#8c6c4c', 2);
  ctx.fillStyle = '#d8d2c4';
  for (const px of [-62, -46, 46, 62]) {
    ctx.fillRect(px - 2, -16, 4, 18);
    ink(ctx, 1.5);
    ctx.strokeRect(px - 2, -16, 4, 18);
  }
  box(ctx, -65, -18, 22, 4, 1, '#e4dfd2', 1.5);
  box(ctx, 43, -18, 22, 4, 1, '#e4dfd2', 1.5);
}

/** The kid's bike, centred, with the bow Gary ties on the handlebars. */
function drawBike(ctx: CanvasRenderingContext2D, bow: number, time: number): void {
  for (const wx of [-23, 23]) {
    blob(ctx, wx, 10, 13, 13, 'rgba(0,0,0,0)', 3);
    ctx.strokeStyle = '#2b2b30';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wx, 10, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c8ccd4';
    ctx.fillRect(wx - 1.5, 8.5, 3, 3);
  }
  limb(ctx, [{ x: -23, y: 10 }, { x: -6, y: -6 }, { x: 16, y: -6 }, { x: 23, y: 10 }], 3.5, '#2fc0b0', 1.5);
  limb(ctx, [{ x: -6, y: -6 }, { x: 0, y: 10 }, { x: 16, y: -6 }], 3.5, '#2fc0b0', 1.5);
  limb(ctx, [{ x: -6, y: -6 }, { x: -8, y: -12 }], 3, '#2fc0b0', 1.5);
  box(ctx, -15, -16, 14, 5, 2, '#2a2a30', 1.5);
  limb(ctx, [{ x: 16, y: -6 }, { x: 19, y: -18 }, { x: 13, y: -22 }], 3, '#8d929e', 1.5);
  // Streamers.
  ctx.strokeStyle = '#ff6fb0';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(13, -22);
    ctx.quadraticCurveTo(8 - i * 2, -16 + Math.sin(time * 6 + i) * 2, 6 - i * 3, -12 + i * 2);
    ctx.stroke();
  }
  if (bow > 0.02) {
    const k = clamp(bow, 0, 1.2);
    ctx.save();
    ctx.translate(18, -22);
    ctx.scale(k, k);
    poly(ctx, [0, 0, -11, -8, -11, 6], '#e0263c', 2);
    poly(ctx, [0, 0, 11, -8, 11, 6], '#e0263c', 2);
    poly(ctx, [-1, 1, -5, 13, -1, 11], '#e0263c', 1.5);
    poly(ctx, [1, 1, 5, 13, 1, 11], '#e0263c', 1.5);
    blob(ctx, 0, 0, 3.5, 3.5, '#ff4a5e', 1.5);
    ctx.restore();
  }
}
