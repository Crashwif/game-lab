/** The roof set, the pigeons, the loose props, the wind streaks and the flash. World space. */
import { clamp, mix, mulberry32, noise, type Spring, settleSpring, smoothstep, spring, stepSpring } from './motion';
export const INK = '#202432';
/** Where the set sits (world px). */
export const FLOOR_Y = 400;
export const BACK_WALL = { x: 0, w: 696, y: 380, h: 20 } as const;
export const BULKHEAD = { x: 0, w: 118, y: 236, h: 164 } as const;
/** The push-bar door, hinged at x 34. */
export const DOOR = { x: 34, w: 62, y: 290, h: 110 } as const;
export const EXIT_BOX = { x: 60, y: 276, w: 50, h: 16 } as const;
export const BULB = { x: 118, y: 262, radius: 260 } as const;
export const AC = { x: 150, w: 100, y: 356, h: 44 } as const;
export const GRILLE_GUM = { x: 236, y: 372 } as const;
export const CHAIR = { x: 130, y: 340 } as const;
export const SIGN = { x: 712, y: 410 } as const;
/** The parapet block, its coping stone and the drop face below it. */
export const PARAPET = { x: 696, w: 48, top: 368 } as const;
export const COPING = { x: 692, w: 56, y: 362, h: 10 } as const;
/** Where loose props come to rest. */
export const CLIPBOARD_REST = { x: 470, y: 448 } as const;
export const FLASHLIGHT_REST = { x: 440, y: 452 } as const;
export const RELIC = { x: 720, y: 356 } as const;
export const PIGEON_X = [704, 716, 728, 740] as const;
export const PIGEON_Y = 360;
/** Flight and streak seconds. */
const FLIGHT = 0.9;
const STREAK_LIFE = 0.45;
export type LooseKind = 'clipboard' | 'flashlight' | 'croc' | 'beanie' | 'phone' | 'shades' | 'gum' | 'coin' | 'bag';
/** skid lands on the gravel, fall is beside the thrown suspect, over tumbles down the canyon, stick flies to the grille, drift is the bag. */
export type LooseMode = 'skid' | 'fall' | 'over' | 'stick' | 'drift';
/** A prop leaving a hand (crew.events.drops, then spawnLoose). */
export interface Drop { kind: LooseKind; x: number; y: number; vx: number; vy: number; spin: number; mode: LooseMode; drag?: number; lit?: boolean }
/** floor = where it touches the gravel; (ox, oy) = where it left from. */
export interface Loose extends Drop { rot: number; age: number; rest: boolean; scale: number; drag: number; lit: boolean; floor: number; ox: number; oy: number; sliding: boolean; restAge: number }
/** (ox, oy) to (tx, ty) is the flight. */
export interface Pigeon { home: number; x: number; y: number; state: 'coping' | 'away' | 'flying' | 'landing'; t: number; bob: number; ox: number; oy: number; tx: number; ty: number; face: number }
export interface Streak { x: number; y: number; len: number; age: number }
export interface RoofEvents {
  /** Props that touched down this frame. */
  landed: LooseKind[];
  door: 'open' | 'shut' | null;
  pigeonsOff: boolean;
  pigeonLand: boolean;
  /** 0 none, else the hiss strength. */
  gust: number;
}
export interface Roof {
  /** 300 seeded speckles. */
  gravel: { x: number; y: number }[];
  /** 0 shut .. 1 open toward the camera. */
  door: Spring;
  doorTarget: number;
  /** The EXIT box flare and the green wash alpha. */
  exit: number;
  wash: number;
  /** The bulb's flicker and the fan angle. */
  bulb: number;
  fan: number;
  /** Act 5 unfolds it beside the lieutenant (acts.ts draws it there). */
  chair: 'bulkhead' | 'out';
  pigeons: Pigeon[];
  pigeonClock: number;
  /** <= 24 items; at most 14 coins, one bag, one gum. */
  loose: Loose[];
  relic: boolean;
  gumOnGrille: boolean;
  pizzaBox: boolean;
  wind: number;
  bagClock: number;
  gustClock: number;
  streaks: Streak[];
  streakClock: number;
  /** The loose clipboard's page lift and its form strokes 0..3. */
  pages: number;
  strokes: number;
  seed: number;
  events: RoofEvents;
}
const noEvents = (): RoofEvents => ({ landed: [], door: null, pigeonsOff: false, pigeonLand: false, gust: 0 });
const pigeonAt = (x: number): Pigeon => ({ home: x, x, y: PIGEON_Y, state: 'coping', t: 0, bob: 0, ox: x, oy: PIGEON_Y, tx: x, ty: PIGEON_Y, face: x > 720 ? 1 : -1 });
const blank = (gravel: Roof['gravel']): Roof => ({
  gravel, door: spring(0), doorTarget: 0, exit: 0, wash: 0, bulb: 0, fan: 0, chair: 'bulkhead', pigeons: PIGEON_X.map(pigeonAt), pigeonClock: 1.2, loose: [],
  relic: false, gumOnGrille: false, pizzaBox: false, wind: 0.2, bagClock: 22, gustClock: 0, streaks: [], streakClock: 0, pages: 0, strokes: 0, seed: 7, events: noEvents(),
});
export function createRoof(): Roof {
  const rand = mulberry32(4040);
  const gravel: Roof['gravel'] = [];
  for (let i = 0; i < 300; i += 1) gravel.push({ x: rand() * 696, y: FLOOR_Y + 6 + rand() * 130 });
  return blank(gravel);
}
/** The betting edge. */
export function resetRoof(r: Roof): void {
  Object.assign(r, blank(r.gravel));
}
export interface RoofDrive {
  running: boolean;
  tension: number;
  time: number;
  wind: number;
  rung: number;
  /** −1 before 30x. */
  overtime: number;
  escaped: boolean;
  /** Clocks in seconds; −1 while inactive. */
  escapeT: number;
  crashT: number;
  aftermathT: number;
  /** The camera's y, and true from the cut back on. */
  camY: number;
  aftermath: boolean;
}
/** Puts a prop in flight (14 coins, one bag, one gum, 24 items: the oldest resting one goes). */
export function spawnLoose(r: Roof, drop: Drop): void {
  if (drop.kind === 'coin' && r.loose.filter((l) => l.kind === 'coin').length >= 14) return;
  if ((drop.kind === 'bag' || drop.kind === 'gum') && r.loose.some((l) => l.kind === drop.kind)) return;
  if (r.loose.length >= 24) {
    const i = r.loose.findIndex((l) => l.rest);
    r.loose.splice(i < 0 ? 0 : i, 1);
  }
  const floor = FLOOR_Y + 30 + ((Math.abs(drop.vx) * 7 + Math.abs(drop.vy) * 3) % 90);
  r.loose.push({ ...drop, rot: 0, age: 0, rest: false, scale: 1, drag: drop.drag ?? 0, lit: drop.lit ?? false, floor, ox: drop.x, oy: drop.y, sliding: false, restAge: 0 });
}
/** A prop at rest (settle). */
function placeLoose(r: Roof, kind: LooseKind, x: number, y: number, rot: number): void {
  spawnLoose(r, { kind, x, y, vx: 0, vy: 0, spin: 0, mode: 'skid' });
  Object.assign(r.loose[r.loose.length - 1]!, { rest: true, rot, age: 9 });
}
const takeOff = (p: Pigeon, i: number, delay: number): void => void Object.assign(p, { state: 'flying', t: -delay, ox: p.x, oy: p.y, tx: 790 + i * 24, ty: 470 + i * 14, face: 1 });
const comeBack = (p: Pigeon, i: number, x: number): void => void Object.assign(p, { state: 'landing', t: 0, ox: 800 + i * 20, oy: 480, tx: x, ty: PIGEON_Y, face: -1 });
/** The escape: 14 seeded coins from `from`; the door and the pigeons follow drive.escapeT in stepRoof. `quiet` settles it (door shut, no coins). */
export function escapeRoof(r: Roof, seed: number, from: { x: number; y: number }, quiet: boolean): void {
  if (quiet) {
    settleSpring(r.door, 0);
    r.doorTarget = 0;
    r.exit = 0.4;
    for (const p of r.pigeons) Object.assign(p, { state: 'coping', x: p.home, y: PIGEON_Y });
    if (!r.loose.some((l) => l.kind === 'flashlight')) placeLoose(r, 'flashlight', FLASHLIGHT_REST.x, FLASHLIGHT_REST.y, -0.5);
    return;
  }
  const rand = mulberry32(seed);
  for (let i = 0; i < 14; i += 1) {
    const a = ((50 + rand() * 30) * Math.PI) / 180;
    const s = 380 + rand() * 140;
    spawnLoose(r, { kind: 'coin', x: from.x + (rand() - 0.5) * 10, y: from.y + (rand() - 0.5) * 10, vx: -Math.cos(a) * s, vy: -Math.sin(a) * s, spin: (rand() - 0.5) * 24, mode: 'skid' });
  }
}
/** A throw startles any pigeon still on the coping. */
export function crashRoof(r: Roof, seed: number, harmless: boolean): void {
  r.seed = seed;
  if (!harmless) r.pigeons.forEach((p, i) => p.state === 'coping' && takeOff(p, i, i * 0.06));
}
/** Advances the set by dt (0 in the hit-stop). */
export function stepRoof(r: Roof, drive: RoofDrive, dt: number): void {
  const ev = (r.events = noEvents());
  r.wind = drive.wind;
  r.fan = (r.fan + dt * (2 + 10 * drive.wind)) % (Math.PI * 2);
  r.pages = drive.wind * (0.5 + 0.5 * Math.sin(drive.time * (3 + 9 * drive.wind)));
  const tick = Math.floor(drive.time * 18);
  r.bulb = drive.tension > 0.9 && noise(tick) > 0.74 - 0.05 * clamp(drive.overtime, 0, 4) ? 0.4 + 0.6 * noise(tick + 3) : 0;
  // The door on the escape clock, then the pigeons' returns.
  if (drive.escapeT >= 0) {
    const was = r.doorTarget;
    r.doorTarget = drive.escapeT >= 1.15 && drive.escapeT < 1.75 ? 1 : 0;
    if (r.doorTarget !== was) {
      ev.door = was ? 'shut' : 'open';
      if (!was) {
        r.exit = 1;
        r.wash = 0.35;
      }
    }
    const i = r.pigeons.findIndex((p) => p.state === 'away');
    if (drive.escapeT >= 2.5 && i >= 0 && (r.pigeonClock += dt) > 1.2) {
      r.pigeonClock = 0;
      comeBack(r.pigeons[i]!, i, r.pigeons[i]!.home);
    }
  }
  stepSpring(r.door, r.doorTarget, 12, 0.7, dt);
  r.exit = Math.max(drive.escaped ? 0.4 : 0, r.exit - dt * 0.8);
  r.wash = Math.max(0, r.wash - (dt * 0.35) / 0.8);
  // The pigeons leave at 3.4x; one comes back at 8x.
  if (drive.running && drive.rung >= 5 && !drive.escaped && r.pigeons.some((p) => p.state === 'coping')) {
    r.pigeons.forEach((p, i) => p.state === 'coping' && takeOff(p, i, i * 0.12));
    ev.pigeonsOff = true;
  }
  if (drive.aftermath && drive.aftermathT >= 7 && r.relic && r.pigeons[0]!.state === 'away') comeBack(r.pigeons[0]!, 0, RELIC.x - 14);
  for (const p of r.pigeons) {
    if (p.state === 'coping') {
      p.x = p.home + (noise(Math.floor(drive.time * 0.7) * 3 + p.home) - 0.5) * 6;
      p.bob = noise(Math.floor(drive.time * 3) + p.home) > 0.55 ? 1 : 0;
    } else if (p.state !== 'away') {
      p.t += dt;
      const u = clamp(p.t / FLIGHT, 0, 1);
      const s = 1 - u;
      p.x = s * s * p.ox + s * u * (p.ox + p.tx) + u * u * p.tx;
      p.y = s * s * p.oy + 2 * s * u * (Math.min(p.oy, p.ty) - 50) + u * u * p.ty;
      if (u >= 1 && p.state === 'flying') p.state = 'away';
      else if (u >= 1) {
        Object.assign(p, { state: 'coping', x: p.tx, y: PIGEON_Y, home: p.tx, face: p.tx > 720 ? 1 : -1 });
        ev.pigeonLand = true;
      }
    }
  }
  if (drive.running && !drive.escaped && drive.rung >= 7 && (r.gustClock += dt) > 6) {
    r.gustClock = 0;
    ev.gust = 0.2 + 0.3 * drive.wind;
  }
  if (drive.running && drive.tension > 0.5 && !drive.escaped && (r.bagClock += dt) > 25) {
    r.bagClock = 0;
    spawnLoose(r, { kind: 'bag', x: -20, y: 300, vx: 90 + 120 * drive.wind, vy: 0, spin: 2 + 2 * drive.wind, mode: 'drift' });
  }
  for (const l of r.loose) {
    l.age += dt;
    if (l.rest) {
      l.restAge += dt;
      continue;
    }
    const m = l.mode;
    if (m === 'stick') {
      const u = clamp(l.age / 0.45, 0, 1);
      l.x = mix(l.ox, GRILLE_GUM.x, u);
      l.y = mix(l.oy, GRILLE_GUM.y, u) - 50 * Math.sin(u * Math.PI);
      l.rot += l.spin * dt;
      if (u >= 1) {
        l.rest = r.gumOnGrille = true;
        ev.landed.push('gum');
      }
      continue;
    }
    if (l.sliding) {
      // The slide to the rest spot after touch-down.
      const k = 1 - Math.exp(-8 * dt);
      const rx = l.kind === 'clipboard' ? CLIPBOARD_REST.x : FLASHLIGHT_REST.x;
      const rr = l.kind === 'clipboard' ? 0.22 : -0.5;
      l.x += (rx - l.x) * k;
      l.rot += (rr - l.rot) * k;
      if ((l.restAge += dt) >= 0.4) Object.assign(l, { x: rx, rot: rr, rest: true, sliding: false, restAge: 0, vx: 0, vy: 0, spin: 0 });
      continue;
    }
    if (m === 'over' && l.x > 760) l.vx *= Math.exp(-2.5 * dt);
    if (m !== 'drift') l.vy += (m === 'fall' ? 1600 * (1 - l.drag) : 1100) * dt;
    l.x += (l.vx + (m === 'fall' ? Math.sin(l.age * 5) * 60 * l.drag : 0)) * dt;
    l.y = m === 'drift' ? l.oy + Math.sin(l.age * 2.5) * 40 + (noise(Math.floor(l.age * 3)) - 0.5) * 24 : l.y + l.vy * dt;
    l.rot += l.spin * dt;
    if (m === 'drift') l.rest = l.x > 990;
    else if (m === 'fall') l.rest = l.y > drive.camY + 720 || l.age > 6;
    else if (m === 'over') {
      l.scale = Math.max(0.08, 1 - l.age / 1.2);
      l.rest = l.age >= 1.2;
    } else {
      const floor = l.kind === 'clipboard' ? CLIPBOARD_REST.y : l.kind === 'flashlight' ? FLASHLIGHT_REST.y : l.floor;
      if (l.y < floor || l.vy <= 0) continue;
      l.y = floor;
      l.x = clamp(l.x, 8, 690);
      if (l.kind === 'coin' && l.vy > 160) {
        l.vy *= -0.35;
        l.vx *= 0.6;
        l.spin *= 0.6;
        continue;
      }
      if (l.kind === 'clipboard' || l.kind === 'flashlight') Object.assign(l, { sliding: true, restAge: 0, vy: 0 });
      else Object.assign(l, { rest: true, vx: 0, vy: 0, spin: 0 });
      ev.landed.push(l.kind);
    }
  }
  r.loose = r.loose.filter((l) => !l.rest || l.mode === 'skid');
  // Fall streaks, capped at 12.
  if (drive.camY > 1 && (r.streakClock += dt) > 0.035 && r.streaks.length < 12) {
    r.streakClock = 0;
    r.streaks.push({ x: 560 + noise(drive.time * 7.3) * 380, y: drive.camY + noise(drive.time * 13.1) * 540, len: 12 + drive.camY * 0.05, age: 0 });
  }
  for (const s of r.streaks) s.age += dt;
  r.streaks = r.streaks.filter((s) => s.age < STREAK_LIFE);
}
/** A fresh scene mid-round: props by rung. */
export function settleRoof(r: Roof, settle: { rung: number; tension: number; escaped: boolean }): void {
  if (settle.rung >= 4) r.gumOnGrille = true;
  if (settle.rung >= 5 && !settle.escaped) for (const p of r.pigeons) p.state = 'away';
  r.strokes = settle.rung >= 6 ? 3 : settle.rung >= 5 ? 2 : settle.rung >= 2 ? 1 : 0;
  if (settle.rung >= 7 && !settle.escaped) placeLoose(r, 'clipboard', CLIPBOARD_REST.x, CLIPBOARD_REST.y, 0.22);
  if (settle.escaped) escapeRoof(r, 0, { x: 0, y: 0 }, true);
}
/** A crash met late: the relic croc, the clipboard gone once picked up (4.2 s), or the door shut (harmless). */
export function settleAftermath(r: Roof, settle: { harmless: boolean; crashT: number }): void {
  if (settle.harmless || settle.crashT >= 4.2) r.loose = r.loose.filter((l) => l.kind !== 'clipboard');
  if (settle.harmless) {
    settleSpring(r.door, 0);
    r.doorTarget = 0;
    return;
  }
  r.relic = true;
  for (const p of r.pigeons) p.state = 'away';
  if (settle.crashT >= 7) Object.assign(r.pigeons[0]!, { state: 'coping', x: RELIC.x - 14, home: RELIC.x - 14, y: PIGEON_Y, face: 1 });
}
// ---- Drawing ----
type Ctx = CanvasRenderingContext2D;
function ink(ctx: Ctx, width = 2): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, stroke = false): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) ctx.strokeRect(x, y, w, h);
}
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke = true): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (stroke) ctx.stroke();
}
function poly(ctx: Ctx, pts: number[], fill: string, stroke = true): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
  ctx.closePath();
  ctx.fill();
  if (stroke) ctx.stroke();
}
/** A radial glow. */
function glow(ctx: Ctx, x: number, y: number, r0: number, r1: number, c0: string, c1: string): void {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
}
/** The door: the stairwell behind it, the leaf swinging toward the camera about the hinge. */
function drawDoor(ctx: Ctx, r: Roof): void {
  const th = clamp(r.door.x, 0, 1.1) * 1.25;
  const s = Math.sin(th);
  rect(ctx, DOOR.x, DOOR.y, DOOR.w, DOOR.h, '#15141a');
  if (th > 0.02) rect(ctx, DOOR.x, DOOR.y, DOOR.w, DOOR.h, `rgba(44,255,122,${0.22 * r.exit})`);
  ctx.strokeStyle = '#2a2c33';
  ctx.lineWidth = 3;
  ctx.strokeRect(DOOR.x - 1.5, DOOR.y - 1.5, DOOR.w + 3, DOOR.h + 3);
  const fx = DOOR.x + DOOR.w * Math.cos(th);
  const dy = 16 * s;
  const tone = Math.round(20 * s);
  ink(ctx, 2);
  poly(ctx, [DOOR.x, DOOR.y, fx, DOOR.y - dy, fx, DOOR.y + DOOR.h + dy, DOOR.x, DOOR.y + DOOR.h], `rgb(${74 + tone},${77 + tone},${87 + tone})`);
  const x0 = mix(DOOR.x, fx, 0.12);
  const x1 = mix(DOOR.x, fx, 0.88);
  const y0 = DOOR.y + DOOR.h / 2;
  ctx.lineWidth = 8;
  line(ctx, x0, y0, x1, y0);
  ctx.strokeStyle = '#c9ccd4';
  ctx.lineWidth = 5;
  line(ctx, x0, y0, x1, y0);
}
/** The folded chair on the bulkhead's side. */
function drawChair(ctx: Ctx): void {
  ctx.save();
  ctx.translate(CHAIR.x + 4, FLOOR_Y);
  ctx.rotate(-0.25);
  for (const [w, c] of [[5, INK], [3, '#6a6e78']] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    line(ctx, -5, 0, -5, -60);
    line(ctx, 5, 0, 5, -60);
  }
  ctx.lineWidth = 2;
  line(ctx, -5, -12, 5, -12);
  line(ctx, -5, -52, 5, -52);
  ink(ctx, 1.5);
  poly(ctx, [-7, -30, 7, -30, 7, -38, -7, -38], '#7a7e88');
  ctx.restore();
}
/** The AC unit, its fan, the gum and the pizza box. */
function drawAC(ctx: Ctx, r: Roof): void {
  ink(ctx, 1.5);
  rect(ctx, AC.x, AC.y, AC.w, AC.h, '#4a4e58');
  rect(ctx, AC.x, AC.y - 3, AC.w, 4, '#585c66');
  ctx.strokeRect(AC.x, AC.y - 3, AC.w, AC.h + 3);
  ctx.strokeStyle = '#3a3d45';
  for (let y = AC.y + 9; y < AC.y + AC.h - 3; y += 5) line(ctx, AC.x + 6, y, AC.x + 48, y);
  const cx = AC.x + 72;
  const cy = AC.y + 22;
  ctx.save();
  ctx.translate(cx, cy);
  oval(ctx, 0, 0, 16, 16, '#1e2026', false);
  ctx.rotate(r.fan);
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    oval(ctx, 8, 0, 7, 3, '#6a6e78', false);
  }
  ctx.restore();
  ctx.strokeStyle = '#5a5e6a';
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, cx - 16, cy, cx + 16, cy);
  if (r.gumOnGrille) {
    ink(ctx, 1);
    oval(ctx, GRILLE_GUM.x, GRILLE_GUM.y, 3.4, 3, '#f29ac0');
  }
  if (r.pizzaBox) {
    ink(ctx, 1.5);
    poly(ctx, [AC.x + 12, AC.y - 3, AC.x + 60, AC.y - 3, AC.x + 62, AC.y - 13, AC.x + 14, AC.y - 13], '#c98557');
    ctx.strokeStyle = '#a86a44';
    ctx.lineWidth = 1;
    line(ctx, AC.x + 13, AC.y - 8, AC.x + 61, AC.y - 8);
  }
}
/** Behind the rigs: floor, gravel, back wall, bulkhead, door, EXIT box, chair, AC unit, the bulb's pool and the bulb. */
export function drawRoofBack(ctx: Ctx, r: Roof, time: number): void {
  ctx.save();
  rect(ctx, 0, FLOOR_Y, 696, 140, '#2b2a30');
  ctx.fillStyle = '#3a3942';
  for (const g of r.gravel) ctx.fillRect(g.x, g.y, 2, 2);
  rect(ctx, BACK_WALL.x, BACK_WALL.y, BACK_WALL.w, BACK_WALL.h, '#34363f');
  rect(ctx, 0, BACK_WALL.y - 2, BACK_WALL.w, 4, '#41444e');
  rect(ctx, BULKHEAD.x, BULKHEAD.y, BULKHEAD.w, BULKHEAD.h, '#3a3d45');
  rect(ctx, BULKHEAD.w - 6, BULKHEAD.y, 6, BULKHEAD.h, '#30333a');
  rect(ctx, 0, BULKHEAD.y - 4, BULKHEAD.w + 4, 6, '#464a53');
  ctx.fillStyle = '#d8c8a0';
  ctx.textAlign = 'center';
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.fillText('40F', 60, 250);
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.fillText('ROOF ACCESS', 60, 262);
  drawDoor(ctx, r);
  glow(ctx, EXIT_BOX.x, EXIT_BOX.y, 4, 44, `rgba(255,70,70,${0.22 + 0.45 * r.exit})`, 'rgba(255,70,70,0)');
  ink(ctx, 1.5);
  rect(ctx, EXIT_BOX.x - EXIT_BOX.w / 2, EXIT_BOX.y - EXIT_BOX.h / 2, EXIT_BOX.w, EXIT_BOX.h, `rgb(${184 + 50 * r.exit},${37 + 30 * r.exit},${43 + 30 * r.exit})`, true);
  ctx.fillStyle = r.exit > 0.6 ? '#ffffff' : '#ffd6d6';
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.fillText('EXIT', EXIT_BOX.x, EXIT_BOX.y + 3.5);
  if (r.chair === 'bulkhead') drawChair(ctx);
  drawAC(ctx, r);
  const pool = ctx.createRadialGradient(BULB.x, BULB.y, 10, BULB.x, BULB.y, BULB.radius);
  pool.addColorStop(0, `rgba(255,184,102,${0.18 * (1 - 0.6 * r.bulb)})`);
  pool.addColorStop(1, 'rgba(255,184,102,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, BULKHEAD.y - 4, BULKHEAD.w + 4, BULKHEAD.h + 4);
  ctx.fillRect(0, BACK_WALL.y - 2, 400, 162);
  ctx.fillRect(AC.x, AC.y - 14, AC.w, 14);
  const lit = 1 - 0.7 * r.bulb;
  const bx = BULB.x + 4;
  const by = BULB.y + 8;
  glow(ctx, bx, by, 2, 30, `rgba(255,200,120,${0.55 * lit})`, 'rgba(255,200,120,0)');
  ctx.strokeStyle = '#5a5e6a';
  ctx.lineWidth = 3;
  line(ctx, BULB.x - 10, BULB.y - 10, bx, BULB.y);
  ink(ctx, 1);
  oval(ctx, bx, by, 5, 6.5, `rgb(255,${210 + 40 * lit},${120 + 80 * lit})`);
  ctx.strokeStyle = '#3a3d45';
  ctx.beginPath();
  ctx.ellipse(bx, by, 7.5, 8.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, bx - 8, by + 4, bx + 8, by + 4);
  ctx.restore();
  void time;
}
/** A coping pigeon: idle, bob, up and fly poses. */
function drawPigeon(ctx: Ctx, p: Pigeon, i: number, time: number): void {
  const pose = p.state === 'coping' ? (p.bob ? 'bob' : 'idle') : p.t < 0 ? 'up' : 'fly';
  const bob = pose === 'bob' ? 2.5 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.face, 1);
  ink(ctx, 1);
  poly(ctx, [-5, -3, -12, -1, -12, -6], '#6f737c');
  oval(ctx, 0, -4.5, 7, 4.5, '#8a8d96');
  if (pose === 'up' || pose === 'fly') {
    const a = pose === 'up' ? 1 : Math.sin(time * 50 + i);
    poly(ctx, [-3, -6, -8, -6 - 11 * a, 5, -7 - 9 * a, 4, -5], '#70737c');
  } else oval(ctx, -1, -4.5, 5, 2.4, '#70737c');
  oval(ctx, 6, -9.5 + bob, 3.2, 3.2, '#8a8d96');
  rect(ctx, 3, -7.5 + bob, 2.5, 2.5, i % 2 ? '#5fa36b' : '#8a5fa3');
  rect(ctx, 6.5, -10.5 + bob, 1.4, 1.4, INK);
  poly(ctx, [9, -9.5 + bob, 12.5, -8.5 + bob, 9, -7.5 + bob], '#d98a3a', false);
  ctx.restore();
}
/** A lime croc on its side. */
function drawCroc(ctx: Ctx, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ink(ctx, 1.5);
  ctx.fillStyle = '#9be35a';
  ctx.beginPath();
  ctx.moveTo(-10, 1);
  ctx.quadraticCurveTo(-11, -5, -5, -5);
  ctx.lineTo(3, -5);
  ctx.quadraticCurveTo(11, -5, 11, 1);
  ctx.quadraticCurveTo(11, 4, 7, 4);
  ctx.lineTo(-7, 4);
  ctx.quadraticCurveTo(-11, 4, -10, 1);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#6fae3a';
  ctx.beginPath();
  ctx.arc(-6, -2, 5, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  for (const dx of [-1, 3, 7]) rect(ctx, dx, -3, 1.6, 1.6, '#6fae3a');
  ctx.restore();
}
/** The dropped flashlight's beam: a sweep up to the sky, out by 2.85 s. */
const beamOf = (l: Loose) => ({ angle: mix(2.6, -0.5, smoothstep(0.3, 1.5, l.age)), alpha: l.age < 0.3 ? 0 : 0.2 * (1 - smoothstep(2.4, 2.85, l.age)) });
const beamLive = (l: Loose): boolean => l.kind === 'flashlight' && l.age < 2.85 && (l.rest || l.sliding);
function drawLoose(ctx: Ctx, l: Loose, r: Roof, time: number): void {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(beamLive(l) ? beamOf(l).angle : l.rot);
  if (l.mode === 'over') {
    ctx.scale(l.scale, l.scale);
    ctx.globalAlpha = clamp(l.scale * 1.4, 0, 1);
  }
  ink(ctx, 1.5);
  switch (l.kind) {
    case 'clipboard': {
      rect(ctx, -16, -11, 32, 22, '#b48a52', true);
      rect(ctx, -13, -8, 26, 18, '#efe8d4');
      rect(ctx, -10, -5, 12, 2, INK);
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 5; k += 1) {
        ctx.strokeRect(-10, -1 + k * 2.6, 2.2, 2.2);
        rect(ctx, -6, -0.4 + k * 2.6, 12 - k * 1.5, 1, '#9aa0ab');
      }
      if (r.strokes >= 1) poly(ctx, [-9.8, 0.2, -9, 1.2, -7.6, -1.2, -9, 0.4], INK, false);
      if (r.strokes >= 2) {
        line(ctx, -10, 1.6, -7.8, 3.8);
        line(ctx, -7.8, 1.6, -10, 3.8);
      }
      if (r.strokes >= 3) {
        ctx.lineWidth = 1.2;
        line(ctx, -11, 0, 9, 9);
      }
      ink(ctx, 1);
      rect(ctx, -6, -13.5, 12, 5, '#9aa0ab', true);
      if (l.rest && r.pages > 0.05) poly(ctx, [13, -8, 13 - 9 * r.pages, -8, 13, -8 + 9 * r.pages], '#f7f1df');
      break;
    }
    case 'flashlight':
      rect(ctx, -14, -4, 24, 8, '#3a3d45', true);
      rect(ctx, 10, -5.5, 6, 11, '#5a5e6a', true);
      rect(ctx, 15, -4.5, 2.5, 9, beamLive(l) ? '#fff6d8' : '#2a2c33');
      rect(ctx, -6, -5.5, 4, 2, '#c0392b');
      break;
    case 'coin': {
      ink(ctx, 1.2);
      if (!l.rest) ctx.scale(Math.max(0.15, Math.abs(Math.cos(l.rot))), 1);
      const ry = l.rest ? 2.8 : 5;
      oval(ctx, 0, 0, 5, ry, '#f2c14e');
      rect(ctx, -2.5, -ry * 0.6, 1.5, 1.5, '#fff0b0');
      break;
    }
    case 'bag':
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      oval(ctx, 0, 0, 13 + 3 * noise(Math.floor(l.age * 6)), 9 + 3 * noise(Math.floor(l.age * 6) + 1), '#e6e6f0');
      ctx.beginPath();
      ctx.arc(-4, -9, 3.5, Math.PI, 0);
      ctx.arc(5, -9, 3.5, Math.PI, 0);
      ctx.stroke();
      break;
    case 'croc':
      drawCroc(ctx, 0, 0, 0);
      break;
    case 'beanie':
      oval(ctx, 0, -3, 11, 8, '#6a6d78');
      rect(ctx, -11, 2, 22, 5, '#5a5d68', true);
      break;
    case 'phone':
      if (l.lit) glow(ctx, 0, 0, 2, 18, 'rgba(124,246,124,0.35)', 'rgba(124,246,124,0)');
      rect(ctx, -5, -9, 10, 18, '#2a2a30', true);
      rect(ctx, -3.5, -7, 7, 14, l.lit ? '#7cf67c' : '#444');
      if (l.lit) rect(ctx, -2.5, -6, 1.6, 1.6, Math.floor(time * 2) % 2 ? '#ff4d6d' : '#b23047');
      break;
    case 'shades':
      rect(ctx, -9, -2.5, 7.5, 5, INK);
      rect(ctx, 1.5, -2.5, 7.5, 5, INK);
      line(ctx, -1.5, -1.5, 1.5, -1.5);
      line(ctx, -9, -2, -12, -3);
      line(ctx, 9, -2, 12, -3);
      break;
    default:
      ink(ctx, 1);
      oval(ctx, 0, 0, 3.2, 3, '#f29ac0');
  }
  ctx.restore();
}
/** Over the suspect: parapet, coping, drop face, sign, pigeons, the croc relic and the loose props at rest. */
export function drawRoofFront(ctx: Ctx, r: Roof, time: number): void {
  ctx.save();
  const under = COPING.y + COPING.h;
  rect(ctx, PARAPET.x, PARAPET.top, PARAPET.w, 540 - PARAPET.top, '#3b3a42');
  rect(ctx, PARAPET.x + PARAPET.w - 4, under, 4, 540 - under, '#2d2c33');
  rect(ctx, PARAPET.x + PARAPET.w, under, 6, 540 - under, '#15141a');
  rect(ctx, COPING.x, under, COPING.w, 4, 'rgba(0,0,0,0.25)');
  rect(ctx, COPING.x, COPING.y, COPING.w, COPING.h, '#4a4852');
  rect(ctx, COPING.x, COPING.y, COPING.w, 2, '#5c5a66');
  ink(ctx, 1);
  rect(ctx, SIGN.x - 18, SIGN.y - 6, 36, 24, '#e8e4d6', true);
  rect(ctx, SIGN.x - 6, SIGN.y - 8, 12, 4, 'rgba(217,212,192,0.85)');
  ctx.fillStyle = INK;
  ctx.font = '800 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MIND THE', SIGN.x, SIGN.y + 4);
  ctx.fillText('EDGE', SIGN.x, SIGN.y + 14);
  r.pigeons.forEach((p, i) => p.state !== 'away' && drawPigeon(ctx, p, i, time));
  if (r.relic) drawCroc(ctx, RELIC.x, RELIC.y, 0.12);
  for (const l of r.loose) {
    if (!(l.rest && l.mode === 'skid')) continue;
    drawLoose(ctx, l, r, time);
    if (beamLive(l)) {
      const b = beamOf(l);
      const from = { x: l.x + Math.cos(b.angle) * 16, y: l.y + Math.sin(b.angle) * 16 };
      drawBeam(ctx, { from, to: { x: from.x + Math.cos(b.angle) * 520, y: from.y + Math.sin(b.angle) * 520 }, width: 120, alpha: b.alpha });
    }
  }
  ctx.restore();
}
/** A soft 'lighter' cone, `width` px wide at the target. */
export interface Beam { from: { x: number; y: number }; to: { x: number; y: number }; width: number; alpha: number }
export function drawBeam(ctx: Ctx, beam: Beam): void {
  if (!(beam.alpha > 0.005)) return;
  const dx = beam.to.x - beam.from.x;
  const dy = beam.to.y - beam.from.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const nx = (-dy / d) * beam.width * 0.5;
  const ny = (dx / d) * beam.width * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(beam.alpha, 0, 0.4);
  const g = ctx.createLinearGradient(beam.from.x, beam.from.y, beam.to.x, beam.to.y);
  g.addColorStop(0, 'rgba(255,246,216,1)');
  g.addColorStop(1, 'rgba(255,246,216,0.45)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(beam.from.x, beam.from.y);
  ctx.lineTo(beam.to.x + nx, beam.to.y + ny);
  ctx.lineTo(beam.to.x - nx, beam.to.y - ny);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
/** Props in flight and the wind streaks. */
export function drawAir(ctx: Ctx, r: Roof): void {
  for (const l of r.loose) if (!l.rest) drawLoose(ctx, l, r, l.age);
  if (!r.streaks.length) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (const s of r.streaks) line(ctx, s.x, s.y, s.x, s.y - s.len * Math.sin((s.age / STREAK_LIFE) * Math.PI));
  ctx.restore();
}
/** Frame space: the white flash and the green wash, both <= 0.35. */
export function drawFlash(ctx: Ctx, r: Roof, flash: number): void {
  if (flash > 0.005) rect(ctx, 0, 0, 960, 540, `rgba(255,248,220,${clamp(flash, 0, 0.35)})`);
  if (r.wash > 0.005) rect(ctx, 0, 0, 960, 540, `rgba(44,255,122,${clamp(r.wash, 0, 0.35)})`);
}