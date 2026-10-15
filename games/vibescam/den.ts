/**
 * The den: the founder's webcam pane on the launch stream. A dark room under an LED strip whose colour follows
 * the tension, a pink $VIBE neon, a whiteboard with the plan (a hockey stick and "tokenomics: later"), sticky
 * notes, a shelf with a participation trophy, the door he leaves through, a gaming chair, a pale desk with a
 * keyboard, an energy drink and the big red SHIP IT button whose sticker is peeling (under it, the button says
 * RUG), and the LP duffel bag under the desk that fills as the number goes up. The crash beats every module
 * keys to live here. Presentation only: everything follows the displayed multiplier, the clock and the crash age.
 */
import { blit, blob, box, ink, INK, label, poly } from './ink';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

// ---- The stream's panes, in the 960 × 540 frame -----------------------------------------------------------------

/** The founder's webcam. Everything else in this file is in its local space (origin at its top-left). */
export const CAM = { x: 12, y: 36, w: 400, h: 434 } as const;
/** The screen share: the IDE, the landing page and the chart. */
export const SHARE = { x: 424, y: 36, w: 304, h: 434 } as const;
/** The chat column. */
export const CHAT = { x: 740, y: 118, w: 208, h: 352 } as const;
export const TOPBAR_H = 30;

// ---- The den, in the webcam's local space -----------------------------------------------------------------------

/** Where the wall meets the floor. */
export const FLOOR_Y = 282;
export const LED_Y = 7;
export const NEON = { x: 24, y: 24, w: 126, h: 44 } as const;
export const BOARD = { x: 36, y: 86, w: 146, h: 100 } as const;
export const SHELF = { x: 228, y: 92, w: 88 } as const;
export const DOOR = { x: 326, y: 104, w: 70, h: 178 } as const;
export const DESK = { x0: 72, x1: 304, top: 300, front: 320, foot: 406 } as const;
export const KEYBOARD = { x: 108, y: 303, w: 112, h: 12 } as const;
/** The big red button: its cap's centre at rest, and its radius. */
export const BUTTON = { x: 256, y: 293, r: 17 } as const;
export const CAN = { x: 230, y: 296 } as const;
/** The duffel bag on the floor beside the desk: centre x and the floor it sits on. */
export const BAG = { x: 38, y: 402 } as const;
/** The founder's chair and where he sits; he rolls it to SCOOT_X for the bag at the crash. */
export const CHAIR = { x: 168, seat: 302, back: 148 } as const;
export const SCOOT_X = 104;
export const RING = { x: 168, y: 172, r: 86 } as const;

/**
 * The crash, in seconds of the scene's crash clock. Front-loaded for the live hold (the next betting phase comes
 * about 2 s after the crash; the scene plays the rest as an encore): the smack and the vapor inside a second,
 * every beat by 4.7 s, the final image complete at `end`.
 */
export const BEATS = { flash: 0, peel: 0.22, smack: 0.6, vapor: 0.85, delete: 1.25, holders: 1.6, shades: 2.0, bag: 2.4, lights: 2.65, rise: 2.8, walk: 3.1, ended: 3.7, notes: 3.3, end: 5.6 } as const;

// ---- State --------------------------------------------------------------------------------------------------------

export interface Note { x: number; y: number; w: number; h: number; text: string; fill: string; tilt: number; /** The crash: when it lets go, where it lands, how it spins. */ at: number; dx: number; spin: number }

export interface Den {
  /** The button cap's depression (kicked by a smack) and the desk's shiver. */
  press: Spring;
  thump: Spring;
  /** The energy drink: its hop off the desk on a smack and its tip at the crash. */
  canHop: Spring;
  canTip: Spring;
  /** The sticker's corner, curling with the tension. */
  curl: Spring;
  /** The door, 0 shut to 1 open. */
  door: Spring;
  /** The ring light's level and the LED strip's hue. */
  ring: Spring;
  hue: Spring;
  /** The chair's swivel after he leaves it. */
  swivel: number;
  notes: Note[];
  seed: number;
  blinkClock: number;
  events: { press: boolean; blink: boolean };
}

const NOTES: readonly Omit<Note, 'at' | 'dx' | 'spin'>[] = [
  { x: 196, y: 96, w: 50, h: 40, text: 'SHIP IT', fill: '#ffe66d', tilt: -0.08 },
  { x: 200, y: 150, w: 54, h: 40, text: 'NO REFUNDS', fill: '#ff9ad5', tilt: 0.06 },
  { x: 274, y: 232, w: 46, h: 36, text: 'Q2 = ???', fill: '#b6f08c', tilt: -0.05 },
  { x: 142, y: 196, w: 48, h: 36, text: 'NOT A RUG', fill: '#9fd8ff', tilt: 0.1 },
];

export function createDen(): Den {
  const den: Den = { press: spring(0), thump: spring(0), canHop: spring(0), canTip: spring(0), curl: spring(0), door: spring(0), ring: spring(1), hue: spring(190), swivel: 0, notes: [], seed: -1, blinkClock: 0, events: { press: false, blink: false } };
  seedDen(den, 0);
  return den;
}

/** Lays the sticky notes' falls out for a crash point, once per crash. */
export function seedDen(den: Den, seed: number): void {
  if (den.seed === seed) return;
  den.seed = seed;
  const rand = mulberry32(seed * 7 + 3);
  den.notes = NOTES.map((n, i) => ({ ...n, at: BEATS.notes + i * 0.22 + rand() * 0.5, dx: (rand() - 0.5) * 60, spin: (rand() - 0.5) * 3 }));
  den.swivel = rand() < 0.5 ? -1 : 1;
}

export function resetDen(den: Den): void {
  for (const s of [den.press, den.thump, den.canHop, den.canTip, den.curl, den.door]) settleSpring(s, 0);
  settleSpring(den.ring, 1);
  settleSpring(den.hue, 190);
  den.blinkClock = 0;
}

export interface DenDrive {
  time: number;
  tension: number;
  depth: number;
  multiplier: number;
  running: boolean;
  /** Seconds since the crash, or −1 before it. */
  crash: number;
  seed: number;
  /** Where the founder is on his way out (local x), or null while he sits. The door opens as he nears it. */
  leaverX: number | null;
}

/** The sticker's corner lifts with the tension: a sliver of what is under it shows from about 2×. */
export const curlAt = (d: Pick<DenDrive, 'tension' | 'depth'>): number => clamp(0.12 + 0.7 * smoothstep(0.3, 0.92, d.tension) + 0.25 * d.depth, 0, 1);
/** The LED strip's hue: cyan at rest, magenta by 3×, red by the stratosphere; at the crash it goes red at once. */
export const hueAt = (d: Pick<DenDrive, 'tension' | 'crash'>): number => (d.crash >= 0 ? 358 : 190 + 150 * smoothstep(0, 0.9, d.tension) + 18 * d.tension);
/** The room's lights: the ring and the neon die at BEATS.lights. */
export const lightsAt = (crash: number): number => (crash < 0 ? 1 : 1 - smoothstep(BEATS.lights, BEATS.lights + 0.35, crash));
/** The bag's bulge: it fills with the number (log driver so it keeps growing), 0 at 1×, 1 around 1,000×. */
export const bulgeAt = (multiplier: number): number => clamp(Math.log10(Math.max(1, multiplier)) / 3, 0, 1);
/** The button has been smacked and reads RUG: from the crash's smack onward. */
export const ruggedAt = (crash: number): boolean => crash >= BEATS.smack;

export function settleDen(den: Den, d: DenDrive): void {
  seedDen(den, d.seed);
  settleSpring(den.press, d.crash >= BEATS.smack ? 1 : 0);
  settleSpring(den.thump, 0);
  settleSpring(den.canHop, 0);
  settleSpring(den.canTip, d.crash >= BEATS.smack ? 1 : 0);
  settleSpring(den.curl, d.crash >= BEATS.peel ? 1 : curlAt(d));
  settleSpring(den.door, d.crash >= BEATS.walk + 1.9 ? 0.85 : 0);
  settleSpring(den.ring, lightsAt(d.crash));
  settleSpring(den.hue, hueAt(d));
}

/** A smack of the button: the cap goes down, the desk shivers, the can hops. */
export function pressButton(den: Den, strength = 1): void {
  den.press.x = Math.max(den.press.x, 0.2);
  den.press.v += 26 * strength;
  den.thump.v += 9 * strength;
  den.canHop.v -= 120 * strength;
  den.events.press = true;
}

export function stepDen(den: Den, d: DenDrive, dt: number): void {
  seedDen(den, d.seed);
  den.events = { press: false, blink: false };
  const rugged = d.crash >= BEATS.smack;
  stepSpring(den.press, rugged ? 1 : 0, 22, 0.55, dt);
  stepSpring(den.thump, 0, 24, 0.3, dt);
  // The can hops and lands; at the crash's smack it tips over and stays down.
  stepSpring(den.canHop, 0, 18, 0.5, dt);
  if (den.canHop.x > 0) den.canHop.x = 0;
  stepSpring(den.canTip, rugged ? 1 : 0, 14, 0.4, dt);
  stepSpring(den.curl, d.crash >= BEATS.peel ? 1 : curlAt(d), 1.6, 0.9, dt);
  // The door opens as the leaver nears it and stays ajar once he is through.
  const near = d.leaverX === null ? 0 : smoothstep(DOOR.x - 90, DOOR.x - 10, d.leaverX);
  stepSpring(den.door, d.crash >= BEATS.walk + 1.9 ? 0.85 : near, 9, 0.75, dt);
  stepSpring(den.ring, lightsAt(d.crash), 14, 0.8, dt);
  stepSpring(den.hue, hueAt(d), d.crash >= 0 ? 30 : 2.5, 1, dt);
  // The warning light on the plinth blinks faster as the number climbs.
  const period = d.crash >= 0 ? 0.22 : 1.1 - 0.85 * d.tension;
  den.blinkClock += dt;
  if (den.blinkClock >= period) {
    den.blinkClock -= period;
    den.events.blink = true;
  }
}

// ---- Drawing --------------------------------------------------------------------------------------------------------

const ledColour = (hue: number, alpha: number): string => `hsla(${hue}, 95%, 62%, ${alpha})`;

/** The static wall: panels, the whiteboard with the plan, the shelf, the door frame. */
function paintWall(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#1c1a2f';
  g.fillRect(0, 0, CAM.w, FLOOR_Y);
  // Panel seams.
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 2;
  for (let x = 60; x < CAM.w; x += 60) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, FLOOR_Y);
    g.stroke();
  }
  // Skirting.
  g.fillStyle = '#2b2740';
  g.fillRect(0, FLOOR_Y - 8, CAM.w, 8);
  // The whiteboard: the plan.
  box(g, BOARD.x, BOARD.y, BOARD.w, BOARD.h, 4, '#f3f1ea', 2.5);
  g.fillStyle = '#c9c4b8';
  g.fillRect(BOARD.x, BOARD.y + BOARD.h - 6, BOARD.w, 6);
  // The hockey stick, in marker.
  g.strokeStyle = '#2d7bd6';
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(BOARD.x + 12, BOARD.y + 80);
  g.quadraticCurveTo(BOARD.x + 70, BOARD.y + 78, BOARD.x + 92, BOARD.y + 56);
  g.quadraticCurveTo(BOARD.x + 108, BOARD.y + 36, BOARD.x + 118, BOARD.y + 14);
  g.stroke();
  g.strokeStyle = '#444';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(BOARD.x + 10, BOARD.y + 12);
  g.lineTo(BOARD.x + 10, BOARD.y + 84);
  g.lineTo(BOARD.x + 124, BOARD.y + 84);
  g.stroke();
  label(g, 'NUMBER GO UP', BOARD.x + 66, BOARD.y + 22, 9, '#d6336c', 800);
  g.textAlign = 'left';
  g.font = `700 8px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  g.fillStyle = '#333';
  g.fillText('tokenomics: later', BOARD.x + 14, BOARD.y + 96);
  g.fillText('audit: ask AI', BOARD.x + 84, BOARD.y + 96);
  g.fillStyle = '#d6336c';
  g.fillText('EXIT: Q?', BOARD.x + 92, BOARD.y + 72);
  // The shelf: a participation trophy and a plant that has given up.
  box(g, SHELF.x, SHELF.y, SHELF.w, 8, 2, '#6b4e3a', 2);
  box(g, SHELF.x + 14, SHELF.y - 26, 14, 26, 2, '#f0c24a', 2);
  blob(g, SHELF.x + 21, SHELF.y - 30, 11, 9, '#f0c24a', 2);
  g.fillStyle = INK;
  g.font = '700 5px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('PARTICIPANT', SHELF.x + 21, SHELF.y - 4);
  box(g, SHELF.x + 56, SHELF.y - 16, 18, 16, 3, '#c96a3e', 2);
  for (const [dx, dy, a] of [[-8, -22, -0.9], [0, -26, 0.1], [8, -20, 0.8]] as const) blob(g, SHELF.x + 65 + dx, SHELF.y + dy, 4, 9, '#6f9a52', 1.6, a);
  // The door frame.
  box(g, DOOR.x - 6, DOOR.y - 6, DOOR.w + 12, DOOR.h + 6, 2, '#3a3350', 2.5);
}

/** The static floor and the chair's base. */
function paintFloor(g: CanvasRenderingContext2D): void {
  const grad = g.createLinearGradient(0, FLOOR_Y, 0, CAM.h);
  grad.addColorStop(0, '#2a2538');
  grad.addColorStop(1, '#17141f');
  g.fillStyle = grad;
  g.fillRect(0, FLOOR_Y, CAM.w, CAM.h - FLOOR_Y);
  // A rug under the desk.
  g.fillStyle = '#3a2f4a';
  g.beginPath();
  g.moveTo(10, 345);
  g.lineTo(330, 345);
  g.lineTo(356, CAM.h);
  g.lineTo(-16, CAM.h);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 2;
  g.stroke();
}

/** The neon $VIBE sign; `lit` 0..1 with per-letter dying at the crash. */
function drawNeon(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive): void {
  const lit = lightsAt(d.crash);
  const flick = d.crash < 0 ? 1 - 0.35 * d.tension * (noise(Math.floor(d.time * 14) * 1.7) > 0.82 ? 1 : 0) : 1;
  // The backing board.
  box(ctx, NEON.x, NEON.y, NEON.w, NEON.h, 6, '#14121f', 2);
  ctx.save();
  ctx.font = '900 30px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const letters = ['$', 'V', 'I', 'B', 'E'];
  const rand = mulberry32(den.seed * 13 + 5);
  let x = NEON.x + 12;
  for (const letter of letters) {
    const w = ctx.measureText(letter).width;
    // At the crash, each tube dies at its own moment; the I and the dollar linger.
    const dies = BEATS.lights - 0.2 + rand() * 0.9;
    const on = d.crash < 0 ? flick : d.crash < dies ? 1 : letter === 'I' ? 0.25 : 0;
    const glow = on * lit;
    if (glow > 0.02) {
      ctx.shadowColor = `rgba(255, 79, 216, ${0.9 * glow})`;
      ctx.shadowBlur = 14 * glow;
      ctx.fillStyle = `rgba(255, ${Math.round(140 + 80 * glow)}, 236, ${0.55 + 0.45 * glow})`;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#4a2a44';
    }
    ctx.fillText(letter, x, NEON.y + NEON.h / 2 + 1);
    x += w + 4;
  }
  ctx.restore();
}

/** The LED strip along the top of the wall and its wash down the wall. */
function drawLed(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive): void {
  const level = mix(0.35, 1, lightsAt(d.crash) * 0.6 + 0.4);
  const hue = den.hue.x;
  const wash = ctx.createLinearGradient(0, LED_Y, 0, LED_Y + 120);
  wash.addColorStop(0, ledColour(hue, 0.32 * level));
  wash.addColorStop(1, ledColour(hue, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, LED_Y, CAM.w, 120);
  ctx.fillStyle = ledColour(hue, 0.95 * level);
  ctx.fillRect(0, LED_Y - 2, CAM.w, 4);
  // The same strip under the desk's front edge.
  const under = ctx.createLinearGradient(0, DESK.front, 0, DESK.front + 60);
  under.addColorStop(0, ledColour(hue, 0.28 * level));
  under.addColorStop(1, ledColour(hue, 0));
  ctx.fillStyle = under;
  ctx.fillRect(DESK.x0, DESK.front, DESK.x1 - DESK.x0, 60);
}

/** The ring light behind him: a bright ring that flickers at high tension and dies at the crash. */
function drawRing(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive): void {
  const flick = d.crash < 0 && d.tension > 0.7 && noise(Math.floor(d.time * 11) * 2.3) > 0.9 ? 0.55 : 1;
  const level = clamp(den.ring.x, 0, 1) * flick;
  if (level < 0.02) {
    ink(ctx, 6, '#2a2838');
    ctx.beginPath();
    ctx.arc(RING.x, RING.y, RING.r, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const halo = ctx.createRadialGradient(RING.x, RING.y, RING.r - 18, RING.x, RING.y, RING.r + 50);
  halo.addColorStop(0, `rgba(255, 244, 220, ${0.35 * level})`);
  halo.addColorStop(1, 'rgba(255, 244, 220, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(RING.x - RING.r - 60, RING.y - RING.r - 60, RING.r * 2 + 120, RING.r * 2 + 120);
  ctx.strokeStyle = `rgba(255, 250, 235, ${0.95 * level})`;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(RING.x, RING.y, RING.r, 0, Math.PI * 2);
  ctx.stroke();
  // The stand.
  ink(ctx, 4, '#26232f');
  ctx.beginPath();
  ctx.moveTo(RING.x, RING.y + RING.r);
  ctx.lineTo(RING.x, FLOOR_Y + 60);
  ctx.stroke();
}

/** The door: shut all round, opening as he reaches it at the crash, dark beyond. */
function drawDoor(ctx: CanvasRenderingContext2D, den: Den): void {
  const open = clamp(den.door.x, 0, 1);
  // The dark beyond the door.
  ctx.fillStyle = '#07060b';
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  // The door swings away from us on its left hinge: its width foreshortens.
  const w = DOOR.w * (1 - 0.82 * open);
  const skew = 18 * open;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(DOOR.x, DOOR.y);
  ctx.lineTo(DOOR.x + w, DOOR.y - skew * 0.4);
  ctx.lineTo(DOOR.x + w, DOOR.y + DOOR.h + skew * 0.2);
  ctx.lineTo(DOOR.x, DOOR.y + DOOR.h);
  ctx.closePath();
  ctx.fillStyle = '#3f3658';
  ctx.fill();
  ink(ctx, 2.5);
  ctx.stroke();
  ctx.clip();
  // The sign and the handle, on the door's face.
  ctx.save();
  ctx.translate(DOOR.x, 0);
  ctx.scale(Math.max(0.05, w / DOOR.w), 1);
  box(ctx, 12, DOOR.y + 22, DOOR.w - 24, 30, 3, '#f3f1ea', 2);
  label(ctx, 'FOUNDER MODE', DOOR.w / 2, DOOR.y + 32, 7, INK, 800, DOOR.w - 30);
  label(ctx, 'DO NOT DISTURB', DOOR.w / 2, DOOR.y + 43, 6, '#d6336c', 800, DOOR.w - 30);
  blob(ctx, DOOR.w - 14, DOOR.y + 96, 4, 4, '#d8c27a', 1.6);
  ctx.restore();
  ctx.restore();
}

/** The sticky notes; at the crash they let go one by one (seeded) and land on the floor. */
function drawNotes(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive): void {
  for (const n of den.notes) {
    let x = n.x, y = n.y, tilt = n.tilt, alpha = 1;
    if (d.crash >= n.at) {
      // A planing fall: it drifts sideways, spins and lands on the floor just in front of the wall.
      const t = d.crash - n.at;
      const fall = clamp(t / 1.1, 0, 1);
      const ease = fall * fall;
      const landY = FLOOR_Y + 12 + (n.y % 17);
      y = mix(n.y, landY, ease);
      x = n.x + n.dx * Math.sin(fall * Math.PI * 0.5) + 6 * Math.sin(t * 9) * (1 - fall);
      tilt = n.tilt + n.spin * fall;
      alpha = 1;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-n.w / 2 + 3, -n.h / 2 + 4, n.w, n.h);
    ctx.fillStyle = n.fill;
    ctx.fillRect(-n.w / 2, -n.h / 2, n.w, n.h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(-n.w / 2, -n.h / 2, n.w, 6);
    ctx.fillStyle = INK;
    ctx.font = '800 8px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.text, 0, 3, n.w - 6);
    ctx.restore();
  }
}

/** The gaming chair behind him at `chairX` (he rolls it left for the bag): back, wings and headrest; it swivels once he leaves it. */
export function drawChair(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive, chairX: number, pushedBack: number): void {
  const spin = d.crash >= BEATS.rise ? den.swivel * 1.9 * (1 - Math.exp(-(d.crash - BEATS.rise) * 1.6)) : 0;
  const face = Math.cos(spin);
  ctx.save();
  ctx.translate(chairX + 10 * pushedBack * den.swivel, CHAIR.seat - 20 * pushedBack * 0.2);
  // The post and the base, from the seat down.
  ink(ctx, 7, '#23212c');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 70);
  ctx.stroke();
  ink(ctx, 5, '#23212c');
  for (const a of [-1, -0.5, 0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 70);
    ctx.lineTo(a * 40, 86 + Math.abs(a) * 4);
    ctx.stroke();
  }
  // The seat (visible only when he has left).
  ctx.scale(Math.max(0.12, Math.abs(face)), 1);
  box(ctx, -46, -8, 92, 16, 6, '#1d1b26', 2.5);
  ctx.fillStyle = '#c62b45';
  ctx.fillRect(-40, -4, 80, 4);
  // The back and the wings.
  box(ctx, -40, CHAIR.back - CHAIR.seat, 80, CHAIR.seat - CHAIR.back - 6, 14, '#1d1b26', 2.5);
  box(ctx, -26, CHAIR.back - CHAIR.seat + 46, 52, 40, 10, '#c62b45', 2);
  box(ctx, -24, CHAIR.back - CHAIR.seat - 18, 48, 22, 10, '#1d1b26', 2.5);
  ctx.restore();
}

/** The whole back of the room: wall, lights, board, shelf, door, notes, ring and chair. */
export function drawDenBack(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive, chairX: number, pushedBack: number): void {
  blit(ctx, 'vibescam:wall', 0, 0, CAM.w, FLOOR_Y, paintWall);
  blit(ctx, 'vibescam:floor', 0, FLOOR_Y, CAM.w, CAM.h - FLOOR_Y, paintFloor);
  drawLed(ctx, den, d);
  drawNeon(ctx, den, d);
  drawDoor(ctx, den);
  drawNotes(ctx, den, d);
  drawRing(ctx, den, d);
  drawChair(ctx, den, d, chairX, pushedBack);
}

/** The LP duffel bag at `x`, its bottom at `y`, rotated by `angle`; the bulge follows the multiplier. */
export function drawBag(ctx: CanvasRenderingContext2D, x: number, y: number, bulge: number, angle = 0): void {
  const w = 62 * (1 + 0.3 * bulge);
  const h = 34 * (1 + 0.35 * bulge);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Bills poking out of the zipper at high bulge.
  if (bulge > 0.35) {
    const show = smoothstep(0.35, 0.9, bulge);
    for (let i = -2; i <= 2; i += 1) {
      ctx.save();
      ctx.translate(i * 7, -h + 2);
      ctx.rotate(i * 0.22);
      box(ctx, -6, -14 * show, 12, 14 * show + 2, 1.5, '#7fd483', 1.6);
      ctx.restore();
    }
  }
  blob(ctx, 0, -h / 2, w / 2, h / 2, '#2f2a3e', 2.5);
  // The zipper.
  ink(ctx, 2, '#c9c4b8');
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 8, -h + 4);
  ctx.quadraticCurveTo(0, -h - 2, w / 2 - 8, -h + 4);
  ctx.stroke();
  // The handles.
  ink(ctx, 3.5, '#2f2a3e');
  ctx.beginPath();
  ctx.moveTo(-14, -h + 2);
  ctx.quadraticCurveTo(0, -h - 20 - 6 * bulge, 14, -h + 2);
  ctx.stroke();
  // The LP tag.
  box(ctx, w / 2 - 22, -h / 2 - 8, 24, 16, 3, '#ffe66d', 2);
  label(ctx, 'LP', w / 2 - 10, -h / 2, 10, INK, 900);
  ctx.restore();
}

/** The sticker on the button: SHIP IT, its corner curling to show the R under it; peeling away at the crash. */
function drawSticker(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive): void {
  const peel = d.crash >= BEATS.peel ? clamp((d.crash - BEATS.peel) / 0.34, 0, 1) : 0;
  if (peel >= 1) return;
  ctx.save();
  // Peeling: it lifts from its right edge, swings up and away, and fades.
  ctx.translate(peel * 26, -peel * 30);
  ctx.rotate(-peel * 1.6);
  ctx.globalAlpha = 1 - peel * peel;
  const w = 30, h = 13;
  box(ctx, -w / 2, -h / 2, w, h, 2, '#ffe66d', 1.6);
  label(ctx, 'SHIP IT', 0, 0.5, 6.5, INK, 900);
  // The curled corner: the underside shows white, and the red under it.
  const curl = clamp(den.curl.x, 0, 1) * (1 - peel) * 9;
  if (curl > 0.5) {
    ctx.fillStyle = '#b3132b';
    ctx.beginPath();
    ctx.moveTo(w / 2, -h / 2);
    ctx.lineTo(w / 2 - curl, -h / 2);
    ctx.lineTo(w / 2, -h / 2 + curl);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff9d6';
    ctx.beginPath();
    ctx.moveTo(w / 2 - curl, -h / 2);
    ctx.lineTo(w / 2 - curl * 0.3, -h / 2 - curl * 0.65);
    ctx.lineTo(w / 2 + curl * 0.2, -h / 2 + curl * 0.35);
    ctx.lineTo(w / 2, -h / 2 + curl);
    ctx.closePath();
    ctx.fill();
    ink(ctx, 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

/** The big red button on its plinth, pressed by `den.press`; the warning light; the sticker. */
function drawButton(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive): void {
  const press = clamp(den.press.x, 0, 1.3);
  ctx.save();
  ctx.translate(BUTTON.x, BUTTON.y + 14);
  const squash = 1 + 0.06 * clamp(press, 0, 1);
  ctx.scale(squash, 1 / squash);
  // The plinth.
  box(ctx, -26, -12, 52, 20, 5, '#1b1922', 2.5);
  // The warning light.
  const blinkOn = d.crash >= 0 || den.blinkClock < (1.1 - 0.85 * d.tension) * 0.45;
  blob(ctx, -18, -4, 3.2, 3.2, blinkOn ? '#ff3b3b' : '#4a1d1d', 1.4);
  if (blinkOn) {
    ctx.fillStyle = 'rgba(255, 60, 60, 0.35)';
    ctx.beginPath();
    ctx.arc(-18, -4, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // The cap: a dome that sinks when pressed.
  const dy = 5 * clamp(press, 0, 1.1);
  blob(ctx, 0, -12 + dy, BUTTON.r, BUTTON.r * 0.45, '#9c1428', 2.5);
  blob(ctx, 0, -18 + dy, BUTTON.r, BUTTON.r * 0.62, '#e0263f', 2.5);
  // The highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(-5, -25 + dy, 7, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -19 + dy);
  if (ruggedAt(d.crash) || den.curl.x > 0.98) label(ctx, 'RUG', 0, 0.5, 9, '#fff6f6', 900);
  drawSticker(ctx, den, d);
  ctx.restore();
}

/** The energy drink: it hops on a smack and lies down at the crash. */
function drawCan(ctx: CanvasRenderingContext2D, den: Den): void {
  ctx.save();
  ctx.translate(CAN.x, CAN.y + Math.min(0, den.canHop.x));
  const tip = clamp(den.canTip.x, 0, 1);
  ctx.rotate(tip * 1.5);
  ctx.translate(0, -tip * 2);
  box(ctx, -6, -24, 12, 24, 3, '#2f8f5b', 2);
  ctx.fillStyle = '#d7f5df';
  ctx.fillRect(-4, -18, 8, 10);
  label(ctx, 'VIBE', 0, -13, 4.5, INK, 900);
  ctx.restore();
}

/** The desk and everything on it, drawn over the founder's body (his arms are drawn after it). */
export function drawDesk(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive, bagOnFloor: boolean): void {
  const shiver = den.thump.x * 1.5;
  ctx.save();
  ctx.translate(shiver * Math.sin(d.time * 80), 0);
  // The legs, then the slab.
  ink(ctx, 7, '#c9c4b8');
  for (const x of [DESK.x0 + 10, DESK.x1 - 10]) {
    ctx.beginPath();
    ctx.moveTo(x, DESK.front);
    ctx.lineTo(x, DESK.foot);
    ctx.stroke();
  }
  ink(ctx, 10, INK);
  ctx.globalAlpha = 0.25;
  for (const x of [DESK.x0 + 10, DESK.x1 - 10]) {
    ctx.beginPath();
    ctx.moveTo(x, DESK.front);
    ctx.lineTo(x, DESK.foot);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (bagOnFloor) drawBag(ctx, BAG.x, BAG.y, bulgeAt(d.multiplier));
  poly(ctx, [DESK.x0 + 6, DESK.top, DESK.x1 - 6, DESK.top, DESK.x1, DESK.front, DESK.x0, DESK.front], '#e4e0d8', 2.5);
  ctx.fillStyle = '#cfc9bf';
  ctx.fillRect(DESK.x0, DESK.front - 1, DESK.x1 - DESK.x0, 6);
  ink(ctx, 2.5);
  ctx.strokeRect(DESK.x0, DESK.front - 1, DESK.x1 - DESK.x0, 6);
  // The keyboard, the mouse, the phone face down.
  box(ctx, KEYBOARD.x, KEYBOARD.y, KEYBOARD.w, KEYBOARD.h, 3, '#2a2733', 2);
  ctx.fillStyle = ledColour(den.hue.x, 0.75);
  for (let i = 0; i < 11; i += 1) ctx.fillRect(KEYBOARD.x + 6 + i * 10, KEYBOARD.y + 3, 7, 3);
  ctx.fillRect(KEYBOARD.x + 26, KEYBOARD.y + 8, 60, 2);
  blob(ctx, KEYBOARD.x + KEYBOARD.w + 20, KEYBOARD.y + 6, 7, 5, '#2a2733', 2);
  box(ctx, DESK.x0 + 14, DESK.top + 6, 22, 11, 2, '#15131c', 2);
  drawCan(ctx, den);
  drawButton(ctx, den, d);
  ctx.restore();
}

/** The dark over everything once the lights are out, and the red wash of the crash's first beat. */
export function drawDenLight(ctx: CanvasRenderingContext2D, den: Den, d: DenDrive): void {
  const lights = clamp(den.ring.x, 0, 1);
  if (lights < 1) {
    ctx.fillStyle = `rgba(4, 3, 8, ${0.72 * (1 - lights)})`;
    ctx.fillRect(0, 0, CAM.w, CAM.h);
  }
  // A faint screen glow on the near side of the room, the colour of the chart.
  const glow = ctx.createRadialGradient(CAM.w * 0.42, CAM.h * 0.55, 20, CAM.w * 0.42, CAM.h * 0.55, CAM.w * 0.7);
  const red = d.crash >= 0;
  glow.addColorStop(0, red ? 'rgba(255, 60, 70, 0.12)' : `rgba(120, 255, 170, ${0.06 + 0.06 * d.tension})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CAM.w, CAM.h);
}
