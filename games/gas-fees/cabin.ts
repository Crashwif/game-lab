/**
 * The lift itself: the shaft going past outside, the cables, the cabin with
 * its back doors and the lobby behind them, the floor indicator, the load
 * plaque, the ceiling light, the haze that gathers at the ankles, and the
 * crash: the green cloud, the fogged glass, the flicker and the bounce on
 * the cable. Nothing here changes the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, type Point } from './riders';

export const CABIN = { left: 200, right: 760, floor: 470, backLeft: 250, backRight: 710, backFloor: 420, top: 58, backTop: 72 } as const;
export const DOOR_FRAME = { x: 380, y: 118, w: 200, h: 302 } as const;

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
}

export function createCabin(): Cabin {
  return { time: 0, bounce: spring(0), doors: spring(1), scroll: 0, speed: spring(0), ding: spring(0), gassed: false, gasAge: 0, gasOrigin: { x: 480, y: 380 }, puffs: [], drips: [], light: 1, haze: 0 };
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
}

/** How fast the floors go past once the doors are shut. */
const cruise = (tension: number): number => 70 + 200 * tension;

/** Jumps to a cabin already on its way, for a first frame mid-round: doors shut and, while running, at speed. */
export function settleCabin(c: Cabin, running: boolean, tension: number): void {
  settleSpring(c.doors, 0);
  settleSpring(c.speed, running ? cruise(tension) : 0);
}

export interface CabinDrive { running: boolean; tension: number; doorsOpen: boolean; arrived: boolean; reduced: boolean }

export function stepCabin(c: Cabin, drive: CabinDrive, dt: number): void {
  c.time += dt;
  stepSpring(c.doors, drive.doorsOpen ? 1 : 0, 9, 0.85, dt);
  const open = c.doors.x > 0.05;
  stepSpring(c.speed, drive.running && !open && !c.gassed ? cruise(drive.tension) : 0, 3, 0.9, dt);
  c.scroll += c.speed.x * dt;
  if (drive.arrived) { c.bounce.v += 26; c.ding.v += 12; }
  stepSpring(c.bounce, 0, c.gassed ? 7 : 12, 0.35, dt);
  stepSpring(c.ding, 0, 8, 0.6, dt);
  c.haze = drive.running && !c.gassed ? clamp((drive.tension - 0.66) / 0.34, 0, 1) : c.gassed ? 1 : Math.max(0, c.haze - dt);
  if (c.gassed) {
    c.gasAge += dt;
    const flick = c.gasAge < 1.1 && !drive.reduced ? (noise(Math.floor(c.time * 30)) > 0.55 ? 0.25 : 1) : 0.55;
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
  } else {
    const flicker = drive.running && drive.tension > 0.8 && !drive.reduced && noise(Math.floor(c.time * 24)) > 0.82 ? 0.45 : 1;
    c.light += (flicker - c.light) * (1 - Math.exp(-dt * 40));
  }
}

/** Someone let one go. `quiet` skips the effects for a crash that already happened. */
export function gasCabin(c: Cabin, seed: number, origin: Point, quiet: boolean): void {
  c.gassed = true;
  c.gasAge = quiet ? 10 : 0;
  c.gasOrigin = origin;
  c.puffs = [];
  c.drips = [];
  settleSpring(c.speed, 0);
  if (quiet) { c.light = 0.55; return; }
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

/** The cabin shell from the back forward: walls, the lobby seen through the open doors. The riders in the lobby are drawn by the caller between this and `drawDoors`. */
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
  ctx.restore();
}

/** The doors (closing over whatever was drawn in the lobby), the frame, the indicator and the plaque. */
export function drawDoors(ctx: CanvasRenderingContext2D, c: Cabin, indicator: string, dumped: boolean, persons: number, maxPersons: number): void {
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
  ctx.fillStyle = dumped ? '#ff4d6d' : ding > 0.1 ? '#ffffff' : '#7cf67c';
  ctx.font = '900 16px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(indicator, DOOR_FRAME.x + DOOR_FRAME.w / 2, 103);
  // Load plaque, red once the cabin is over capacity.
  const over = persons > maxPersons;
  const flash = over && Math.floor(c.time * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#ff4d6d' : '#e9e3d6';
  ctx.beginPath(); ctx.roundRect(CABIN.backLeft + 12, 130, 94, 44, 3); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = flash ? '#ffffff' : INK;
  ctx.font = '900 10px Impact, "Arial Black", sans-serif';
  ctx.fillText(`MAX ${maxPersons} PERSONS`, CABIN.backLeft + 59, 148);
  ctx.font = '900 14px Impact, "Arial Black", sans-serif';
  ctx.fillText(`ON BOARD: ${persons}`, CABIN.backLeft + 59, 166);
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
