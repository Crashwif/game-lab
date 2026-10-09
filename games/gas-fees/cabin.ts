/**
 * The lift itself: the shaft going past outside, the cables, the cabin with
 * its back doors and the lobby behind them, the floor indicator, the load
 * plaque, the methane readout, the canary in its cage, the ceiling light,
 * the haze that gathers at the ankles, and the crash: the green cloud, the
 * fogged glass, the flicker, the bounce on the cable, the canary dropping
 * off its perch and the plaque flipping to MAX CAPACITY: 69. Nothing here
 * changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, type Point } from './riders';

export const CABIN = { left: 200, right: 760, floor: 470, backLeft: 250, backRight: 710, backFloor: 420, top: 58, backTop: 72 } as const;
export const DOOR_FRAME = { x: 380, y: 118, w: 200, h: 302 } as const;
/** Where the cage hangs from the ceiling, and where the readout sits on the back wall; screen boxes the speech bubbles keep out of. */
export const CAGE = { x: 722, hook: 62, top: 98, w: 44, h: 64 } as const;
export const PPM_PANEL = { x: 590, y: 130, w: 94, h: 44 } as const;
export const CAGE_BOX = { x: CAGE.x - 24, y: CAGE.hook - 4, w: 48, h: CAGE.top + CAGE.h - CAGE.hook + 10 };
export const PPM_BOX = { x: PPM_PANEL.x - 4, y: PPM_PANEL.y - 4, w: PPM_PANEL.w + 8, h: PPM_PANEL.h + 8 };
/** The methane readout's thresholds: the alarm beeps once at each. */
export const PPM_ALARMS = [1000, 2500, 5000, 9000];

interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number }
interface Drip { x: number; y: number; speed: number; delay: number; length: number }

export interface Cabin {
  time: number;
  /** Vertical bounce on the cable. */
  bounce: Spring;
  /** 0 closed .. 1 open. */
  doors: Spring;
  scroll: number;
  speed: Spring;
  ding: Spring;
  gassed: boolean;
  gasAge: number;
  gasOrigin: Point;
  puffs: Puff[];
  drips: Drip[];
  light: number;
  haze: number;
  /** The canary: how woozy (0 perky .. 1 reeling), its sway's running phase, whether it has dropped, how far it has fallen (0 perch .. 1 floor), and the cage's swing. */
  canary: { woozy: Spring; phase: number; dropped: boolean; fall: Spring; swing: Spring };
  /** The load plaque's flip to its true reading, 0 .. 1. */
  flip: Spring;
  /** The methane readout as displayed, smoothed toward the number's. */
  ppm: number;
  events: { canaryDrop: boolean };
}

/** Methane at the number: 400 × the multiplier squared, so the alarms go at 1.58×, 2.5×, 3.54× and 4.74×, amber from 2.24× and red from 3.54×; it keeps counting in thousands after that. */
export const ppmFor = (multiplier: number): number => 400 * Math.max(1, multiplier) ** 2;

export function createCabin(): Cabin {
  return { time: 0, bounce: spring(0), doors: spring(1), scroll: 0, speed: spring(0), ding: spring(0), gassed: false, gasAge: 0, gasOrigin: { x: 480, y: 380 }, puffs: [], drips: [], light: 1, haze: 0, canary: { woozy: spring(0), phase: 0, dropped: false, fall: spring(0), swing: spring(0) }, flip: spring(0), ppm: 400, events: { canaryDrop: false } };
}

export function resetCabin(c: Cabin): void {
  settleSpring(c.bounce, 0);
  settleSpring(c.doors, 1);
  settleSpring(c.speed, 0);
  settleSpring(c.ding, 0);
  c.gassed = false;
  c.gasAge = 0;
  c.puffs = [];
  c.drips = [];
  c.light = 1;
  c.haze = 0;
  settleSpring(c.canary.woozy, 0);
  c.canary.dropped = false;
  settleSpring(c.canary.fall, 0);
  settleSpring(c.canary.swing, 0);
  settleSpring(c.flip, 0);
  c.ppm = 400;
}

/** How fast the floors go past once the doors are shut; `surge` (the slow, logarithmic driver of a long round) keeps it climbing past 10×. */
const cruise = (tension: number, surge: number): number => 70 + 200 * tension + 160 * surge;
/** The haze at the ankles: from 2.5×, thick by 10×. */
const hazeFor = (tension: number): number => clamp((tension - 0.6) / 0.3, 0, 1);

/** Jumps to a cabin already on its way, for a first frame mid-round: doors shut and, while running, at speed, the canary, the haze and the readout at the number. */
export function settleCabin(c: Cabin, running: boolean, tension: number, multiplier: number, surge: number): void {
  settleSpring(c.doors, 0);
  settleSpring(c.speed, running ? cruise(tension, surge) : 0);
  settleSpring(c.canary.woozy, running ? tension : 0);
  c.haze = running ? hazeFor(tension) : 0;
  c.ppm = ppmFor(multiplier);
}

export interface CabinDrive { running: boolean; tension: number; multiplier: number; doorsOpen: boolean; arrived: boolean; surge: number }

export function stepCabin(c: Cabin, drive: CabinDrive, dt: number): void {
  c.time += dt;
  c.events.canaryDrop = false;
  stepSpring(c.doors, drive.doorsOpen ? 1 : 0, 9, 0.85, dt);
  const open = c.doors.x > 0.05;
  stepSpring(c.speed, drive.running && !open && !c.gassed ? cruise(drive.tension, drive.surge) : 0, 3, 0.9, dt);
  c.scroll += c.speed.x * dt;
  if (drive.arrived) { c.bounce.v += 26; c.ding.v += 12; c.canary.swing.v += 2.2; }
  stepSpring(c.bounce, 0, c.gassed ? 7 : 12, 0.35, dt);
  stepSpring(c.ding, 0, 8, 0.6, dt);
  // Eased, so the haze never jumps with the number or at the release.
  c.haze += ((c.gassed ? 1 : drive.running ? hazeFor(drive.tension) : 0) - c.haze) * (1 - Math.exp(-dt / 0.4));
  // The canary reels harder as the air goes, and the cage swings with every jolt of the cabin. Its sway keeps a running phase, so a
  // faster sway never jumps or drifts however long the page has been open.
  const k = c.canary;
  stepSpring(k.woozy, drive.running && !c.gassed ? drive.tension : c.gassed ? 1 : 0, 3, 0.7, dt);
  stepSpring(k.swing, 0, 5, 0.15, dt);
  k.phase = (k.phase + dt * (2 + 5 * clamp(k.woozy.x, 0, 1))) % (Math.PI * 2);
  const ppmTarget = c.gassed ? Math.max(9999, c.ppm) : drive.running ? ppmFor(drive.multiplier) : 400;
  c.ppm += (ppmTarget - c.ppm) * (1 - Math.exp(-dt * (c.gassed ? 6 : 3)));
  if (c.gassed) {
    c.gasAge += dt;
    const flick = c.gasAge < 1.1 ? (noise(Math.floor(c.time * 30)) > 0.55 ? 0.25 : 1) : 0.55;
    c.light += (flick - c.light) * (1 - Math.exp(-dt * 30));
    const drag = Math.exp(-1.4 * dt);
    for (const p of c.puffs) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy = p.vy * drag - 26 * dt;
      p.r += 18 * dt;
      if (p.y - p.r < CABIN.top + 10) p.vy = Math.abs(p.vy) * 0.2;
    }
    c.puffs = c.puffs.filter((p) => p.age < p.life);
    for (const d of c.drips) { if (c.gasAge > d.delay) d.y += d.speed * dt; }
    if (!k.dropped && c.gasAge > 0.42) { k.dropped = true; c.events.canaryDrop = true; k.swing.v += 1.5; }
  } else {
    // From 5× the light starts to go, more often the longer the round runs.
    const flicker = drive.running && drive.tension > 0.8 && noise(Math.floor(c.time * 24)) > 0.82 - 0.14 * drive.surge ? 0.45 : 1;
    c.light += (flicker - c.light) * (1 - Math.exp(-dt * 40));
  }
  stepSpring(k.fall, k.dropped ? 1 : 0, 16, 0.3, dt);
  stepSpring(c.flip, c.gassed && c.gasAge > 0.9 ? 1 : 0, 9, 0.55, dt);
}

/** Someone let one go. `quiet` skips the effects for a crash that already happened. */
export function gasCabin(c: Cabin, seed: number, origin: Point, quiet: boolean): void {
  c.gassed = true;
  c.gasAge = quiet ? 10 : 0;
  c.gasOrigin = origin;
  c.puffs = [];
  c.drips = [];
  settleSpring(c.speed, 0);
  if (quiet) {
    c.light = 0.55;
    c.canary.dropped = true;
    settleSpring(c.canary.fall, 1);
    settleSpring(c.canary.woozy, 1);
    settleSpring(c.flip, 1);
    c.ppm = Math.max(9999, c.ppm);
    return;
  }
  const rng = mulberry32(seed);
  for (let i = 0; i < 38; i += 1) {
    const a = rng() * Math.PI * 2;
    const s = 40 + rng() * 150;
    c.puffs.push({ x: origin.x + (rng() - 0.5) * 30, y: origin.y - rng() * 20, vx: Math.cos(a) * s, vy: -40 - rng() * 130 + Math.sin(a) * s * 0.3, r: 10 + rng() * 18, age: rng() * 0.2, life: 2.6 + rng() * 1.6 });
  }
  for (let i = 0; i < 9; i += 1) {
    c.drips.push({ x: CABIN.left + 20 + rng() * (CABIN.right - CABIN.left - 40), y: CABIN.top + 40 + rng() * 140, speed: 30 + rng() * 60, delay: 0.5 + rng() * 1.2, length: 20 + rng() * 40 });
  }
  c.bounce.v += 90;
  c.canary.swing.v += 4;
}

/** The dark shaft outside the cabin with the floors going past, and the cables. */
export function drawShaft(ctx: CanvasRenderingContext2D, c: Cabin): void {
  ctx.fillStyle = '#141a24';
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#1d2634';
  for (let i = 0; i < 7; i += 1) {
    const y = ((i * 110 + c.scroll) % 770) - 110;
    ctx.fillRect(0, y, CABIN.left - 8, 26);
    ctx.fillRect(CABIN.right + 8, y, 960 - CABIN.right - 8, 26);
    ctx.fillStyle = '#27313f';
    ctx.fillRect(0, y + 26, CABIN.left - 8, 4);
    ctx.fillRect(CABIN.right + 8, y + 26, 960 - CABIN.right - 8, 4);
    ctx.fillStyle = '#1d2634';
  }
  // Guide rails.
  ctx.fillStyle = '#2f3a4a';
  ctx.fillRect(CABIN.left - 8, 0, 8, 540);
  ctx.fillRect(CABIN.right, 0, 8, 540);
  const bounce = c.bounce.x;
  ctx.strokeStyle = '#8d99ae'; ctx.lineWidth = 3;
  for (const x of [468, 492]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CABIN.top + bounce); ctx.stroke(); }
}

const FLOOR_LOBBY = '#e9e3d6';

/** The canary in its cage, hung from the ceiling on a chain and swinging about the hook. */
function drawCage(ctx: CanvasRenderingContext2D, c: Cabin): void {
  const k = c.canary;
  const { x, hook, top, w, h } = CAGE;
  ctx.save();
  ctx.translate(x, hook);
  ctx.rotate(clamp(k.swing.x, -0.5, 0.5));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Chain and hook.
  ctx.strokeStyle = '#8d99ae'; ctx.lineWidth = 2.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, top - hook - 6); ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(0, top - hook);
  // The cage: a domed top, bars, a floor tray, drawn behind the bird then in front.
  const left = -w / 2;
  ctx.fillStyle = 'rgba(255, 226, 122, 0.12)';
  ctx.beginPath(); ctx.moveTo(left, 10); ctx.quadraticCurveTo(left, -6, 0, -6); ctx.quadraticCurveTo(w / 2, -6, w / 2, 10); ctx.lineTo(w / 2, h); ctx.lineTo(left, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d9b543'; ctx.lineWidth = 1.5;
  for (let bx = left + 6; bx < w / 2; bx += 6.5) { ctx.beginPath(); ctx.moveTo(bx, 4); ctx.lineTo(bx, h - 2); ctx.stroke(); }
  // The perch.
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(left + 4, 36); ctx.lineTo(w / 2 - 4, 36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(left + 8, h - 4); ctx.lineTo(left + 8, 36); ctx.stroke();
  // The bird: on the perch, swaying more the woozier it gets, or on its back on the tray.
  const woozy = clamp(k.woozy.x, 0, 1);
  const fall = clamp(k.fall.x, 0, 1.15);
  const sway = k.dropped ? 0 : Math.sin(k.phase) * 0.45 * woozy;
  ctx.save();
  ctx.translate(0, mix(36, h - 8, Math.min(fall, 1)));
  ctx.rotate(sway + Math.PI * Math.min(fall, 1));
  ctx.scale(1.25, 1.25);
  ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(0, -7, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-3, -8, 4, 2.5, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(6, -13, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff8c42';
  ctx.beginPath(); ctx.moveTo(10, -13); ctx.lineTo(14, -12); ctx.lineTo(10, -10.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Feet on the perch (folded up once it drops).
  ctx.strokeStyle = '#ff8c42'; ctx.lineWidth = 1.6;
  for (const fx of [-2, 2]) { ctx.beginPath(); ctx.moveTo(fx, -2); ctx.lineTo(fx, 0 + (k.dropped ? -3 : 0)); ctx.stroke(); }
  // The eye: bright, then a spiral as it reels, then an X.
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  if (k.dropped && fall > 0.5) {
    ctx.beginPath(); ctx.moveTo(5.5, -15); ctx.lineTo(8.5, -12); ctx.moveTo(8.5, -15); ctx.lineTo(5.5, -12); ctx.stroke();
  } else if (woozy > 0.45) {
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.4) { const rr = 0.4 + a * 0.16; ctx.lineTo(7 + Math.cos(a + c.time * 6) * rr, -13.5 + Math.sin(a + c.time * 6) * rr); }
    ctx.stroke();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(7, -13.5, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Sweat drops as it reels.
  if (!k.dropped && woozy > 0.6) {
    const p = (c.time * 1.3) % 1;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(12, 22 + p * 12, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // The tray, the dome and the front bars over the bird.
  ctx.fillStyle = '#d9b543'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(left - 2, h - 4, w + 4, 6, 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#d9b543'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(left, 10); ctx.quadraticCurveTo(left, -6, 0, -6); ctx.quadraticCurveTo(w / 2, -6, w / 2, 10); ctx.lineTo(w / 2, h - 4); ctx.moveTo(left, 10); ctx.lineTo(left, h - 4); ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(217, 181, 67, 0.55)';
  for (let bx = left + 3; bx < w / 2; bx += 6.5) { ctx.beginPath(); ctx.moveTo(bx, 4); ctx.lineTo(bx, h - 4); ctx.stroke(); }
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(0, -6, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A reading in four characters or so: 9999, then 12.5K, 125K, 1.3M and on up to quadrillions, then simply MAX. */
function ppmText(ppm: number): string {
  if (ppm < 10_000) return String(Math.round(ppm));
  if (ppm >= 1e18) return 'MAX';
  const e = Math.floor(Math.log10(ppm) / 3);
  const v = ppm / 1000 ** e;
  return `${v.toFixed(v < 100 ? 1 : 0)}${'KMBTQ'[e - 1]}`;
}

/** The methane readout on the back wall: green, amber, red, then off the scale. */
function drawPPM(ctx: CanvasRenderingContext2D, c: Cabin): void {
  const { x, y, w, h } = PPM_PANEL;
  const ppm = Math.round(c.ppm);
  const level = ppm >= 5000 ? 2 : ppm >= 2000 ? 1 : 0;
  const colour = ['#7cf67c', '#ffb703', '#ff4d6d'][level]!;
  const flash = c.gassed && Math.floor(c.time * 4) % 2 === 0;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = flash ? '#3a0f18' : '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();
  ctx.font = '900 9px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.gassed ? '#ff4d6d' : '#9aa3ad';
  ctx.fillText(c.gassed ? 'EVACUATE · EVACUATE' : 'CH4  AIR QUALITY', x + 6, y + 12);
  ctx.fillStyle = colour;
  ctx.font = '900 20px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(c.gassed ? `${ppmText(Math.max(9999, ppm))}+` : ppmText(ppm), x + w - 30, y + 36, w - 38);
  ctx.font = '900 9px Impact, "Arial Black", sans-serif';
  ctx.fillText('PPM', x + w - 6, y + 36);
  if (!c.gassed) {
    // A bar under the label, filling toward the red.
    ctx.fillStyle = '#2b333b';
    ctx.fillRect(x + 6, y + 18, 36, 4);
    ctx.fillStyle = colour;
    ctx.fillRect(x + 6, y + 18, 36 * clamp(ppm / 9000, 0.05, 1), 4);
  }
  ctx.restore();
}

/** The cabin shell from the back forward: walls, the lobby seen through the open doors, the readout and the cage. The riders in the lobby are drawn by the caller between this and `drawDoors`. */
export function drawCabinBack(ctx: CanvasRenderingContext2D, c: Cabin): void {
  const b = c.bounce.x;
  ctx.save();
  ctx.translate(0, b);
  // Ceiling, side walls and the back wall.
  ctx.fillStyle = '#7f8fa3';
  ctx.beginPath(); ctx.moveTo(CABIN.left, CABIN.top); ctx.lineTo(CABIN.right, CABIN.top); ctx.lineTo(CABIN.backRight, CABIN.backTop); ctx.lineTo(CABIN.backLeft, CABIN.backTop); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9aa8b8';
  ctx.beginPath(); ctx.moveTo(CABIN.left, CABIN.top); ctx.lineTo(CABIN.backLeft, CABIN.backTop); ctx.lineTo(CABIN.backLeft, CABIN.backFloor); ctx.lineTo(CABIN.left, CABIN.floor); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(CABIN.right, CABIN.top); ctx.lineTo(CABIN.backRight, CABIN.backTop); ctx.lineTo(CABIN.backRight, CABIN.backFloor); ctx.lineTo(CABIN.right, CABIN.floor); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b4c0cc';
  ctx.fillRect(CABIN.backLeft, CABIN.backTop, CABIN.backRight - CABIN.backLeft, CABIN.backFloor - CABIN.backTop);
  // Brushed steel bands.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = 2;
  for (let y = CABIN.backTop + 12; y < CABIN.backFloor; y += 24) { ctx.beginPath(); ctx.moveTo(CABIN.backLeft, y); ctx.lineTo(CABIN.backRight, y); ctx.stroke(); }
  ctx.fillStyle = '#6b7a8c';
  ctx.beginPath(); ctx.moveTo(CABIN.left, CABIN.floor); ctx.lineTo(CABIN.backLeft, CABIN.backFloor); ctx.lineTo(CABIN.backRight, CABIN.backFloor); ctx.lineTo(CABIN.right, CABIN.floor); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i += 1) { const t = i / 6; ctx.beginPath(); ctx.moveTo(mix(CABIN.left, CABIN.right, t), CABIN.floor); ctx.lineTo(mix(CABIN.backLeft, CABIN.backRight, t), CABIN.backFloor); ctx.stroke(); }
  // Handrail.
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(CABIN.backLeft + 8, 300); ctx.lineTo(DOOR_FRAME.x - 12, 300); ctx.moveTo(DOOR_FRAME.x + DOOR_FRAME.w + 12, 300); ctx.lineTo(CABIN.backRight - 8, 300); ctx.stroke();
  ctx.strokeStyle = '#d9e2ec'; ctx.lineWidth = 4; ctx.stroke();
  // The lobby behind the doors, seen when they are open.
  ctx.fillStyle = FLOOR_LOBBY;
  ctx.fillRect(DOOR_FRAME.x, DOOR_FRAME.y, DOOR_FRAME.w, DOOR_FRAME.h);
  ctx.fillStyle = '#cbbfae';
  ctx.fillRect(DOOR_FRAME.x, DOOR_FRAME.y + DOOR_FRAME.h - 60, DOOR_FRAME.w, 60);
  ctx.fillStyle = '#3f8a5a';
  for (const [px, py, r] of [[DOOR_FRAME.x + 34, DOOR_FRAME.y + 220, 16], [DOOR_FRAME.x + 22, DOOR_FRAME.y + 236, 12], [DOOR_FRAME.x + 46, DOOR_FRAME.y + 238, 12]] as const) { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(DOOR_FRAME.x + 22, DOOR_FRAME.y + 244, 24, 22);
  ctx.fillStyle = '#2e8b57';
  ctx.fillRect(DOOR_FRAME.x + DOOR_FRAME.w - 74, DOOR_FRAME.y + 24, 54, 20);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('EXIT', DOOR_FRAME.x + DOOR_FRAME.w - 47, DOOR_FRAME.y + 39);
  drawPPM(ctx, c);
  drawCage(ctx, c);
  ctx.restore();
}

/** The doors (closing over whatever was drawn in the lobby), the frame, the indicator and the plaque. */
export function drawDoors(ctx: CanvasRenderingContext2D, c: Cabin, indicator: string, dumped: boolean, persons: number, maxPersons: number, secured: boolean): void {
  const b = c.bounce.x;
  ctx.save();
  ctx.translate(0, b);
  const open = clamp(c.doors.x, 0, 1) * (DOOR_FRAME.w / 2);
  ctx.save();
  ctx.beginPath(); ctx.rect(DOOR_FRAME.x, DOOR_FRAME.y, DOOR_FRAME.w, DOOR_FRAME.h); ctx.clip();
  for (const side of [-1, 1]) {
    const x = side < 0 ? DOOR_FRAME.x - open : DOOR_FRAME.x + DOOR_FRAME.w / 2 + open;
    ctx.fillStyle = '#8fa1b5';
    ctx.fillRect(x, DOOR_FRAME.y, DOOR_FRAME.w / 2, DOOR_FRAME.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 2;
    for (let y = DOOR_FRAME.y + 12; y < DOOR_FRAME.y + DOOR_FRAME.h; y += 24) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + DOOR_FRAME.w / 2, y); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.strokeRect(x, DOOR_FRAME.y, DOOR_FRAME.w / 2, DOOR_FRAME.h);
  }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.strokeRect(DOOR_FRAME.x, DOOR_FRAME.y, DOOR_FRAME.w, DOOR_FRAME.h);
  // Floor indicator above the doors.
  const ding = clamp(c.ding.x, 0, 1);
  ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(DOOR_FRAME.x + 40, 84, DOOR_FRAME.w - 80, 26, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = dumped ? '#ff4d6d' : secured ? '#7cf67c' : ding > 0.1 ? '#ffffff' : '#7cf67c';
  ctx.font = '900 16px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(indicator, DOOR_FRAME.x + DOOR_FRAME.w / 2, 103, DOOR_FRAME.w - 92);
  // Load plaque, red once the cabin is over capacity; after the release it flips over to its true reading.
  const flip = clamp(c.flip.x, 0, 1);
  const flipped = flip > 0.5;
  const over = persons > maxPersons;
  const flash = over && !flipped && Math.floor(c.time * 4) % 2 === 0;
  ctx.save();
  ctx.translate(CABIN.backLeft + 59, 152);
  ctx.scale(1, Math.max(0.04, Math.abs(Math.cos(flip * Math.PI))));
  ctx.fillStyle = flipped ? '#1b1b1f' : flash ? '#ff4d6d' : '#e9e3d6';
  ctx.beginPath(); ctx.roundRect(-47, -22, 94, 44, 3); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = flipped ? '#ffe27a' : flash ? '#ffffff' : INK;
  ctx.font = '900 10px Impact, "Arial Black", sans-serif';
  ctx.fillText(flipped ? 'MAX CAPACITY' : `MAX ${maxPersons} PERSONS`, 0, -4);
  ctx.font = '900 14px Impact, "Arial Black", sans-serif';
  ctx.fillText(flipped ? '69 · NICE' : `ON BOARD: ${persons}`, 0, 14, 84);
  ctx.restore();
  ctx.restore();
}

/** In front of the riders: the haze, the cloud, the fogged glass, and the ceiling light's mood. */
export function drawCabinFront(ctx: CanvasRenderingContext2D, c: Cabin): void {
  const b = c.bounce.x;
  ctx.save();
  ctx.translate(0, b);
  ctx.beginPath(); ctx.moveTo(CABIN.left, CABIN.top); ctx.lineTo(CABIN.right, CABIN.top); ctx.lineTo(CABIN.right, CABIN.floor); ctx.lineTo(CABIN.left, CABIN.floor); ctx.closePath(); ctx.clip();
  const haze = clamp(c.haze, 0, 1);
  if (haze > 0.02 && !c.gassed) {
    const h = 30 + 60 * haze;
    const g = ctx.createLinearGradient(0, CABIN.floor - h, 0, CABIN.floor);
    g.addColorStop(0, 'rgba(120, 220, 90, 0)');
    g.addColorStop(1, `rgba(120, 220, 90, ${0.55 * haze})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(CABIN.left, CABIN.floor);
    for (let x = CABIN.left; x <= CABIN.right; x += 20) ctx.lineTo(x, CABIN.floor - h + Math.sin(x * 0.05 + c.time * 1.5) * 8);
    ctx.lineTo(CABIN.right, CABIN.floor);
    ctx.closePath(); ctx.fill();
  }
  if (c.gassed) {
    const k = smoothstep(0, 1.8, c.gasAge);
    const g = ctx.createLinearGradient(0, CABIN.top, 0, CABIN.floor);
    g.addColorStop(0, `rgba(110, 210, 80, ${0.22 * k})`);
    g.addColorStop(1, `rgba(90, 190, 60, ${0.5 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(CABIN.left, CABIN.top, CABIN.right - CABIN.left, CABIN.floor - CABIN.top);
    for (const p of c.puffs) {
      ctx.globalAlpha = 0.55 * (1 - p.age / p.life);
      ctx.fillStyle = '#8be36a';
      ctx.beginPath(); ctx.arc(p.x, p.y + b * 0, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Condensation on the glass.
    ctx.strokeStyle = 'rgba(220, 255, 220, 0.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const d of c.drips) {
      if (c.gasAge < d.delay) continue;
      ctx.beginPath(); ctx.moveTo(d.x, d.y - d.length); ctx.lineTo(d.x, d.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(d.x, d.y, 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(220, 255, 220, 0.8)'; ctx.fill();
    }
  }
  // The ceiling light and how much of the cabin it lights.
  const light = clamp(c.light, 0, 1);
  ctx.fillStyle = `rgba(10, 14, 20, ${0.55 * (1 - light)})`;
  ctx.fillRect(CABIN.left, CABIN.top, CABIN.right - CABIN.left, CABIN.floor - CABIN.top);
  ctx.fillStyle = c.gassed ? `rgba(200, 255, 190, ${0.5 + 0.5 * light})` : `rgba(255, 250, 230, ${0.4 + 0.6 * light})`;
  ctx.beginPath(); ctx.roundRect(300, CABIN.backTop - 6, 360, 10, 5); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  // Glass edge highlight.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(CABIN.left + 3, CABIN.top + 3 + b, CABIN.right - CABIN.left - 6, CABIN.floor - CABIN.top - 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.strokeRect(CABIN.left, CABIN.top + b, CABIN.right - CABIN.left, CABIN.floor - CABIN.top);
}
