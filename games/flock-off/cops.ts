/**
 * The pursuit and the bust. The pursuit is presentation keyed to the displayed multiplier: a cruiser nosing
 * in at the edge of the picture, a second one, a news chopper, a SWAT truck, a police chopper with a
 * spotlight, a Flock drone, the feds, and at the very top something that should not be over a suburb. They
 * close with the heat and lunge when a camera reads him, and never reach him: only the backend's crash
 * ends the ride. The bust is decided once from the crash point with a seeded generator (what gets him and
 * how they found him) and drawn as a pure function of crash time, so a replay or a late entry shows the
 * same frame.
 */
import { C, drawKia, outlined, roundRect, text } from './art';
import { GROUND, RIDER_X, clamp } from './city';
import { type Joint, solveLimb } from './kinematics';
import { mix, mulberry32 } from './motion';
import { FRONT, INK, LOWER_ARM, LOWER_LEG, REAR, UPPER_ARM, UPPER_LEG, WHEEL, drawFrame, drawRider, drawWheels, riderPose, toScreen, type Frame, type Pose, type RiderRig } from './rider';
import { CAUSES, HOW, type Cause } from './script';

export type PursuerKind = 'cruiser' | 'cruiser2' | 'news' | 'swat' | 'heli' | 'drone' | 'feds' | 'predator';
export interface Pursuer { kind: PursuerKind; at: number; label: string }
/** Who joins at which multiplier. Half of all rounds end before 2×, so the first cruiser is in by 1.2×. */
export const ROSTER: readonly Pursuer[] = [
  { kind: 'cruiser', at: 1.2, label: 'ONE CRUISER' },
  { kind: 'cruiser2', at: 1.7, label: 'TWO CRUISERS' },
  { kind: 'news', at: 2.6, label: 'CHANNEL 4 IS HERE' },
  { kind: 'swat', at: 3.5, label: 'SWAT (FOR A BICYCLE)' },
  { kind: 'heli', at: 4.2, label: 'AIR SUPPORT' },
  { kind: 'drone', at: 6, label: 'FLOCK DRONE (BETA)' },
  { kind: 'feds', at: 9, label: 'THE FEDS' },
  { kind: 'predator', at: 30, label: 'SOMETHING MILITARY' },
];

/** When each pursuer arrived, in scene time; ABSENT for one the multiplier has not called yet. */
export interface Pursuit { since: number[] }
export const ABSENT = -1e9;
export const createPursuit = (): Pursuit => ({ since: ROSTER.map(() => ABSENT) });
export const onRoad = (p: Pursuit, i: number): boolean => p.since[i]! > ABSENT / 2;
/** Whoever the multiplier has called in is on the road; a late entry finds them already there. */
export function settlePursuit(p: Pursuit, x: number, clock: number): void {
  ROSTER.forEach((r, i) => { p.since[i] = x >= r.at ? clock - 10 : ABSENT; });
}
export function stepPursuit(p: Pursuit, x: number, clock: number): PursuerKind | null {
  let arrived: PursuerKind | null = null;
  ROSTER.forEach((r, i) => {
    if (x >= r.at && !onRoad(p, i)) { p.since[i] = clock; arrived = r.kind; }
  });
  return arrived;
}
export const resetPursuit = (p: Pursuit): void => { p.since = ROSTER.map(() => ABSENT); };
/** The heat label for the HUD: the last pursuer to arrive. */
export function heatLabel(p: Pursuit): string {
  let label = 'NOBODY YET';
  ROSTER.forEach((r, i) => { if (onRoad(p, i)) label = r.label; });
  return label;
}
const ease = (n: number): number => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const presence = (p: Pursuit, i: number, clock: number): number => (onRoad(p, i) ? ease((clock - p.since[i]!) / 1.6) : 0);

// ---- Vehicles and people --------------------------------------------------------------------------------------------

function wheels(ctx: CanvasRenderingContext2D, xs: number[], y: number, r: number, spin: number): void {
  for (const x of xs) {
    ctx.fillStyle = '#121218';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c6ccd8';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#121218';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(spin) * r * 0.45, y + Math.sin(spin) * r * 0.45);
    ctx.lineTo(x - Math.cos(spin) * r * 0.45, y - Math.sin(spin) * r * 0.45);
    ctx.stroke();
  }
}

function lightBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, clock: number, on: boolean): void {
  const phase = Math.floor(clock * 6) % 2;
  ctx.fillStyle = on && phase === 0 ? C.red : '#5a1a22';
  ctx.fillRect(x, y, w / 2, 5);
  ctx.fillStyle = on && phase === 1 ? C.blue : '#1a2a5a';
  ctx.fillRect(x + w / 2, y, w / 2, 5);
  if (on) {
    const g = ctx.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, 90);
    g.addColorStop(0, phase === 0 ? 'rgba(255, 60, 80, 0.35)' : 'rgba(60, 120, 255, 0.35)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + w / 2, y, 90, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A cruiser seen from the side, nose to the right; `dive` pitches it onto its nose when it brakes. */
export function drawCruiser(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, spin: number, dive = 0, label = 'POLICE'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dive * 0.08);
  ctx.fillStyle = '#e8e8ee';
  roundRect(ctx, -62, -30, 124, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#111218';
  roundRect(ctx, -62, -22, 124, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#e8e8ee';
  ctx.beginPath();
  ctx.moveTo(-40, -30); ctx.lineTo(-28, -50); ctx.lineTo(28, -50); ctx.lineTo(44, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1c2230';
  ctx.beginPath();
  ctx.moveTo(-36, -31); ctx.lineTo(-26, -47); ctx.lineTo(-2, -47); ctx.lineTo(-2, -31);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -31); ctx.lineTo(2, -47); ctx.lineTo(26, -47); ctx.lineTo(38, -31);
  ctx.closePath();
  ctx.fill();
  text(ctx, label, 0, -13, 8, '#e8e8ee', 'center', 60, 900);
  // The push bar, the headlights and the light bar.
  ctx.fillStyle = '#2a2a33';
  ctx.fillRect(60, -26, 6, 20);
  ctx.fillStyle = '#fff2b0';
  ctx.fillRect(54, -24, 6, 5);
  lightBar(ctx, -16, -56, 32, clock, true);
  wheels(ctx, [-38, 38], -4, 10, spin);
  ctx.restore();
}

export function drawSwat(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#1b1f26';
  roundRect(ctx, -70, -70, 140, 66, 8);
  ctx.fill();
  ctx.fillStyle = '#2a2f3a';
  roundRect(ctx, -60, -62, 50, 22, 3);
  ctx.fill();
  ctx.fillStyle = '#0d1016';
  ctx.fillRect(-56, -58, 42, 14);
  text(ctx, 'SWAT', 20, -36, 14, '#d9dde8', 'center', 80, 900);
  text(ctx, '(FOR A BICYCLE)', 20, -22, 7, '#9aa3b5', 'center', 80, 800);
  ctx.fillStyle = '#2a2f3a';
  ctx.fillRect(-74, -40, 8, 30);
  lightBar(ctx, -20, -76, 40, clock, true);
  wheels(ctx, [-46, 44], -4, 13, spin);
  ctx.restore();
}

export function drawSuv(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0c0d12';
  roundRect(ctx, -64, -56, 128, 52, 8);
  ctx.fill();
  ctx.fillStyle = '#1a1c26';
  ctx.fillRect(-52, -50, 104, 18);
  text(ctx, 'FEDS', 0, -20, 11, '#9aa3b5', 'center', 60, 900);
  text(ctx, 'NOT SUSPICIOUS AT ALL', 0, -9, 5, '#5a6170', 'center', 90, 800);
  ctx.fillStyle = Math.floor(clock * 4) % 2 ? C.blue : '#1a2a5a';
  ctx.fillRect(-20, -62, 10, 4);
  ctx.fillStyle = Math.floor(clock * 4) % 2 ? '#1a2a5a' : C.blue;
  ctx.fillRect(10, -62, 10, 4);
  wheels(ctx, [-40, 40], -4, 11, spin);
  ctx.restore();
}

export function drawHeli(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, police: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = police ? '#1b2238' : '#e8e8ee';
  roundRect(ctx, -34, -14, 68, 28, 12);
  ctx.fill();
  ctx.fillRect(-90, -8, 60, 8);
  ctx.fillStyle = police ? '#2b355a' : '#c9c9d4';
  ctx.fillRect(-96, -22, 10, 22);
  ctx.fillStyle = '#1c2230';
  roundRect(ctx, 6, -10, 26, 16, 6);
  ctx.fill();
  text(ctx, police ? 'POLICE' : 'CH 4', -12, 2, 7, police ? '#d9dde8' : '#1a1826', 'center', 40, 900);
  ctx.strokeStyle = '#2a2a33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, 14); ctx.lineTo(-24, 22); ctx.lineTo(24, 22); ctx.lineTo(20, 14);
  ctx.stroke();
  // The rotor: a blur that changes width with the spin.
  ctx.fillStyle = 'rgba(200, 205, 215, 0.6)';
  const spread = 58 + Math.abs(Math.sin(clock * 40)) * 30;
  ctx.fillRect(-spread, -20, spread * 2, 3);
  ctx.fillStyle = '#2a2a33';
  ctx.fillRect(-2, -24, 4, 8);
  if (!police) {
    ctx.fillStyle = C.red;
    ctx.beginPath();
    ctx.arc(14, -16, 3, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'LIVE', 14, -24, 6, C.red, 'center', 20, 900);
  }
  ctx.restore();
}

/** A spotlight cone from a point in the sky onto the road around the rider. */
export function spotlight(ctx: CanvasRenderingContext2D, from: Joint, to: Joint, strength: number, width = 70): void {
  if (strength <= 0) return;
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  g.addColorStop(0, `rgba(255, 250, 220, ${0.05 * strength})`);
  g.addColorStop(1, `rgba(255, 250, 220, ${0.28 * strength})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(from.x - 4, from.y);
  ctx.lineTo(from.x + 4, from.y);
  ctx.lineTo(to.x + width, to.y);
  ctx.lineTo(to.x - width, to.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255, 250, 220, ${0.22 * strength})`;
  ctx.beginPath();
  ctx.ellipse(to.x, to.y, width, 9, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, reading: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#d2d4dd';
  roundRect(ctx, -14, -6, 28, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#2a2a33';
  for (const ax of [-22, 22]) {
    ctx.fillRect(ax - 2, -8, 4, 6);
    ctx.fillStyle = 'rgba(200, 205, 215, 0.6)';
    const w = 10 + Math.abs(Math.sin(clock * 50 + ax)) * 8;
    ctx.fillRect(ax - w, -10, w * 2, 2);
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(ax - 8, -5, 16, 2);
  }
  ctx.fillStyle = C.camera;
  ctx.fillRect(-5, 5, 10, 7);
  ctx.fillStyle = reading ? C.red : C.led;
  ctx.beginPath();
  ctx.arc(0, 9, 2, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'FLOCK', 0, 0, 6, '#1a1826', 'center', 24, 900);
  ctx.restore();
}

/** A police officer: a blue figure with a cap, running, standing or lying on a pile. */
export function drawCop(ctx: CanvasRenderingContext2D, x: number, y: number, mode: 'run' | 'stand' | 'pile' | 'bush', run: number, facing = 1, angle = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(facing, 1);
  const stride = mode === 'run' ? Math.sin(run * 12) : 0;
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  // Legs.
  ctx.beginPath();
  ctx.moveTo(0, -30); ctx.lineTo(8 * stride, -14); ctx.lineTo(10 * stride + 2, 0);
  ctx.moveTo(0, -30); ctx.lineTo(-8 * stride, -14); ctx.lineTo(-10 * stride - 2, 0);
  ctx.stroke();
  // Torso and arms.
  ctx.fillStyle = '#2a4db8';
  roundRect(ctx, -8, -58, 16, 30, 5);
  ctx.fill();
  ctx.strokeStyle = '#2a4db8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (mode === 'run') { ctx.moveTo(4, -52); ctx.lineTo(16, -44 + 6 * stride); ctx.lineTo(26, -52 + 10 * stride); }
  else if (mode === 'pile') { ctx.moveTo(4, -52); ctx.lineTo(18, -48); ctx.lineTo(26, -40); }
  else { ctx.moveTo(4, -52); ctx.lineTo(10, -40); ctx.lineTo(8, -30); }
  ctx.stroke();
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.arc(0, -48, 3, 0, Math.PI * 2);
  ctx.fill();
  // Head and cap.
  ctx.fillStyle = INK.skin;
  ctx.beginPath();
  ctx.arc(0, -68, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(-9, -76, 18, 6);
  ctx.fillRect(2, -72, 12, 3);
  ctx.fillStyle = '#2a2a33';
  ctx.fillRect(-4, -68, 8, 1.5);
  if (mode === 'bush') {
    // Officer Hedge: a cop in a hedge costume, leaves and all.
    ctx.fillStyle = '#2f6b35';
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(-14 + k * 5, -40 - Math.abs(Math.sin(k * 2.1)) * 30, 9, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

// ---- The pursuit, each frame ---------------------------------------------------------------------------------------

export interface PursuitLook { heat: number; alert: number; dusk: number; clock: number; distance: number; riderY: number; crashed: boolean }

/** How far behind the rider the lead cruiser runs: it closes with the heat and lunges when a camera reads him. */
export const leadGap = (heat: number, alert: number): number => mix(380, 160, heat) - 70 * ease(alert / 1.4) * (1 - 0.3 * Math.sin(alert * 8));

/** Draws the pursuers that are on the road, behind the rider and under the rider's layer; returns nothing. */
export function drawPursuitBack(ctx: CanvasRenderingContext2D, p: Pursuit, look: PursuitLook): void {
  const { clock, dusk } = look;
  const spin = look.distance / 10;
  const gap = leadGap(look.heat, look.alert);
  const bob = Math.sin(clock * 9) * 0.8;
  const pres = (i: number) => presence(p, i, clock);
  // Air first.
  const news = pres(2);
  if (news > 0) {
    const x = mix(-120, RIDER_X - 230, news) + Math.sin(clock * 0.9) * 14;
    const y = 168 + Math.sin(clock * 1.3) * 6;
    spotlight(ctx, { x: x + 10, y: y + 14 }, { x: RIDER_X + 10, y: GROUND }, news * mix(0.25, 1, dusk), 60);
    drawHeli(ctx, x, y, clock, false);
  }
  const heli = pres(4);
  if (heli > 0) {
    const x = mix(-120, RIDER_X + 30, heli) + Math.sin(clock * 0.7 + 2) * 10;
    const y = 160 + Math.sin(clock * 1.1 + 1) * 5;
    spotlight(ctx, { x, y: y + 14 }, { x: RIDER_X + 6, y: GROUND }, heli * mix(0.5, 1.2, dusk), 80);
    drawHeli(ctx, x, y, clock, true);
  }
  const predator = pres(7);
  if (predator > 0) {
    const x = ((clock * 12) % 1300) - 200;
    ctx.fillStyle = `rgba(60, 60, 70, ${predator})`;
    ctx.beginPath();
    ctx.moveTo(x - 30, 134); ctx.lineTo(x + 30, 134); ctx.lineTo(x + 8, 138); ctx.lineTo(x + 70, 138); ctx.lineTo(x + 72, 141); ctx.lineTo(x - 36, 141);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'THAT IS NOT A NEWS HELICOPTER', x + 20, 150, 8, `rgba(255, 180, 120, ${predator})`, 'center', 200, 800);
  }
  // Ground, far to near: the SWAT truck, the second cruiser, the lead cruiser.
  const swat = pres(3);
  if (swat > 0) drawSwat(ctx, mix(-200, RIDER_X - gap - 290, swat), GROUND + bob, clock, spin);
  const second = pres(1);
  if (second > 0) drawCruiser(ctx, mix(-200, RIDER_X - gap - 150, second), GROUND - 2 + bob, clock, spin, 0, 'POLICE');
  const lead = pres(0);
  if (lead > 0) drawCruiser(ctx, mix(-200, RIDER_X - gap, lead), GROUND + bob, clock, spin, look.alert > 0 ? 0.6 : 0, 'POLICE');
}

/** The pursuers that pass in front of the rider: the drone over his shoulder and the feds in the near lane. */
export function drawPursuitFront(ctx: CanvasRenderingContext2D, p: Pursuit, look: PursuitLook): void {
  const { clock } = look;
  const spin = look.distance / 10;
  const feds = presence(p, 6, clock);
  if (feds > 0) drawSuv(ctx, mix(-200, RIDER_X - leadGap(look.heat, look.alert) + 60, feds), GROUND + 26 + Math.sin(clock * 9) * 0.8, clock, spin);
  const drone = presence(p, 5, clock);
  if (drone > 0) {
    const x = mix(1040, RIDER_X + 150, drone) + Math.sin(clock * 1.7) * 26;
    const y = 250 + Math.sin(clock * 2.3) * 14;
    const reading = Math.sin(clock * 1.2) > 0.2;
    if (reading) {
      ctx.fillStyle = 'rgba(255, 60, 80, 0.12)';
      ctx.beginPath();
      ctx.moveTo(x - 4, y + 10); ctx.lineTo(x + 4, y + 10); ctx.lineTo(RIDER_X + 40, look.riderY - 60); ctx.lineTo(RIDER_X - 40, look.riderY - 60);
      ctx.closePath();
      ctx.fill();
      outlined(ctx, 'READING…', x, y - 22, 10, C.red);
    }
    drawDrone(ctx, x, y, clock, reading);
  }
}

// ---- The bust ------------------------------------------------------------------------------------------------------

/** The hit-stop and slow motion at the crash: a freeze you can feel, then the first blow at a third speed. */
export const FREEZE_S = 0.14;
export const SLOW_S = 0.45;
export const SLOW_RATE = 0.33;
export const BUST_SECONDS = 5.6;
/** Crash time after the hit-stop and the slow motion, so every ending pose is a pure function of crash age. */
export function bustClock(age: number): number {
  if (age < FREEZE_S) return 0;
  if (age < FREEZE_S + SLOW_S) return (age - FREEZE_S) * SLOW_RATE;
  return SLOW_S * SLOW_RATE + (age - FREEZE_S - SLOW_S);
}

export interface Bust {
  cause: Cause;
  how: string;
  seed: number;
  /** Where he was and how fast he rode when they got him. */
  distance: number;
  speed: number;
  deflocked: number;
  /** Whether the player's bet went down with him, and whether it is the decoy they got. */
  you: boolean;
  decoy: boolean;
  /** The lead cruiser's gap at the crash, so its lunge starts from where it was. */
  gap: number;
}

export function bustFor(x100: number, distance: number, speed: number, deflocked: number, you: boolean, decoy: boolean, gap: number): Bust {
  const rand = mulberry32(x100 * 7919 + 17);
  const cause = CAUSES[Math.floor(rand() * CAUSES.length)]!;
  const how = HOW[Math.floor(rand() * HOW.length)]!;
  return { cause, how, seed: Math.floor(rand() * 1e9), distance, speed, deflocked, you, decoy, gap };
}

/** How far the world coasts after the crash, px, at crash time t. */
export const coast = (speed: number, t: number): number => (speed / 2.2) * (1 - Math.exp(-2.2 * t));

/** A thrown figure: the body on an axis at `angle` (0 upright, π/2 head forward and lying), limbs flung by `flail`. */
export function ragdollPose(center: Joint, angle: number, flail: number, t: number): Pose {
  const ax = Math.sin(angle), ay = -Math.cos(angle);
  const px = -ay, py = ax;
  const hip: Joint = { x: center.x - ax * 20, y: center.y - ay * 20 };
  const shoulder: Joint = { x: center.x + ax * 24, y: center.y + ay * 24 };
  const head: Joint = { x: center.x + ax * 44 + px * 4, y: center.y + ay * 44 + py * 4 };
  const swing = (k: number) => Math.sin(t * 9 + k) * flail;
  const legR = solveLimb(hip, { x: hip.x - ax * 50 + px * (22 + 20 * swing(1)), y: hip.y - ay * 50 + py * (22 + 20 * swing(1)) }, UPPER_LEG, LOWER_LEG, 1);
  const legL = solveLimb(hip, { x: hip.x - ax * 50 - px * (18 + 20 * swing(2)), y: hip.y - ay * 50 - py * (18 + 20 * swing(2)) }, UPPER_LEG, LOWER_LEG, 1);
  const armR = solveLimb(shoulder, { x: shoulder.x + ax * 10 + px * (40 + 10 * swing(3)), y: shoulder.y + ay * 10 + py * (40 + 10 * swing(3)) }, UPPER_ARM, LOWER_ARM, 1);
  const armL = solveLimb(shoulder, { x: shoulder.x + ax * 20 - px * (34 + 10 * swing(4)), y: shoulder.y + ay * 20 - py * (34 + 10 * swing(4)) }, UPPER_ARM, LOWER_ARM, -1);
  return {
    frame: { x: center.x, y: center.y, angle }, wheel: 0, crank: 0,
    hip, shoulder, head, elbowL: armL.joint, handL: armL.end, elbowR: armR.joint, handR: armR.end,
    kneeL: legL.joint, footL: legL.end, kneeR: legR.joint, footR: legR.end, gun: null, muzzle: null, look: { x: px, y: py }, squat: 0,
  };
}

/** The crashed bike on the road: `at` is its ground point and `angle` its tilt. */
function crashedBike(ctx: CanvasRenderingContext2D, rig: RiderRig, frame: Frame, distance: number, flat: boolean): void {
  const pose = riderPose(rig, { distance, speed: 0, hop: 0, hopU: 0, aim: null }, frame);
  drawWheels(ctx, pose, 0);
  if (flat) {
    const f = toScreen(frame, FRONT);
    ctx.fillStyle = INK.tire;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 6, WHEEL + 4, 8, frame.angle, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFrame(ctx, pose);
}

export interface BustScene { rig: RiderRig; clock: number; age: number }

/** Where the rider's figure and the bike are at crash time t, by cause; all closed forms. */
function flight(v: Joint, t: number, from: Joint, g = 520): { p: Joint; landed: number } {
  const land = (2 * -v.y) / g;
  const tt = Math.min(t, land);
  return { p: { x: from.x + v.x * tt + (t > land ? v.x * 0.4 * (1 - Math.exp(-3 * (t - land))) : 0), y: from.y + v.y * tt + g * tt * tt / 2 }, landed: land };
}

/** Draws the bust as a pure function of crash time; `age` is the real crash age for the lunge through the freeze. */
export function drawBust(ctx: CanvasRenderingContext2D, bust: Bust, t: number, scene: BustScene): void {
  const { rig, clock, age } = scene;
  const ground = GROUND;
  const bikeAt: Joint = { x: RIDER_X, y: ground };
  const lunge = ease(age / FREEZE_S);
  const spin = (bust.distance + coast(bust.speed, t)) / 10;
  // Everyone who was chasing pulls up behind him over the first two seconds.
  const stopX = RIDER_X - 190 - 40 * (1 - ease((t - 0.2) / 1.6));
  let figure: Pose;
  let figureLook = { blur: 0, flash: 0, decoy: bust.decoy, blink: 0, tilt: 0, bike: false };
  let bikeFrame: Frame = { x: RIDER_X, y: ground, angle: 0 };
  let flat = false;
  switch (bust.cause) {
    case 'pit': {
      // The lead cruiser lunges onto the rear wheel through the freeze, then brakes nose-down behind the wreck.
      const cx = mix(RIDER_X - bust.gap, RIDER_X - 108, lunge) + (t > 0 ? 40 * (1 - Math.exp(-3 * t)) : 0);
      drawCruiser(ctx, cx, ground, clock, spin, 1 - ease((t - 0.8) / 0.6));
      const flip = clamp(t * 5, 0, 3);
      bikeFrame = { x: RIDER_X + 90 * (1 - Math.exp(-3 * t)), y: ground - 34 * Math.sin(Math.PI * clamp(t / 0.7, 0, 1)), angle: flip };
      const f = flight({ x: 170, y: -250 }, t, { x: RIDER_X, y: ground - 84 });
      const w = (Math.PI / 2 + Math.PI * 2) / f.landed;
      figure = ragdollPose(f.p, t < f.landed ? w * t : Math.PI / 2, t < f.landed ? 1 : 0.1 * Math.exp(-(t - f.landed) * 3), t);
      break;
    }
    case 'spikes': {
      // A spike strip slides under the front wheel through the freeze; the tire goes, the bike goes over the bars.
      const sx = mix(1000, RIDER_X + 46, lunge);
      ctx.fillStyle = '#2a2a33';
      ctx.fillRect(sx - 60, ground - 3, 140, 4);
      ctx.fillStyle = '#c6ccd8';
      for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.moveTo(sx - 58 + k * 10, ground - 3); ctx.lineTo(sx - 54 + k * 10, ground - 11); ctx.lineTo(sx - 50 + k * 10, ground - 3); ctx.fill(); }
      flat = t > 0;
      const endo = clamp(t * 4, 0, 1.5);
      // The bike pitches about its front axle.
      const pivot = toScreen({ x: RIDER_X, y: ground, angle: 0 }, FRONT);
      const rear = { x: REAR.x - FRONT.x, y: REAR.y - FRONT.y };
      const c = Math.cos(endo), s = Math.sin(endo);
      const rearNow = { x: pivot.x + rear.x * c - rear.y * s, y: pivot.y + rear.x * s + rear.y * c };
      bikeFrame = { x: rearNow.x - (REAR.x * c - REAR.y * s), y: rearNow.y - (REAR.x * s + REAR.y * c), angle: endo };
      const f = flight({ x: 150, y: -210 }, t, { x: RIDER_X + 10, y: ground - 90 });
      const w = (Math.PI / 2 + Math.PI * 2) / f.landed;
      figure = ragdollPose(f.p, t < f.landed ? w * t : Math.PI / 2, t < f.landed ? 1 : 0.1 * Math.exp(-(t - f.landed) * 3), t);
      drawCruiser(ctx, stopX, ground, clock, spin, 1 - ease((t - 0.8) / 0.6));
      break;
    }
    case 'tackle': {
      // Officer Hedge erupts from a hedge on the sidewalk and takes him off the bike sideways.
      const hx = RIDER_X + 150;
      ctx.fillStyle = '#2f6b35';
      for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(hx - 28 + k * 8, ground - 24 - Math.abs(Math.sin(k * 1.7)) * 22, 14, 0, Math.PI * 2); ctx.fill(); }
      const leap = ease(t / 0.28);
      const fall = ease((t - 0.28) / 0.6);
      const copX = mix(hx, RIDER_X + 16, leap) - 40 * fall;
      const copY = mix(ground - 36, ground - 70, leap) - 30 * Math.sin(Math.PI * leap) + 70 * fall;
      drawCop(ctx, copX, copY, 'bush', 0, -1, mix(0, Math.PI / 2, fall) * -1);
      // The bike rolls on without him, wobbles, and goes over.
      const free = Math.max(0, t - 0.2);
      const roll = 150 * (1 - Math.exp(-free * 0.9)) * 1.4;
      const tip = ease((free - 0.9) / 0.6);
      bikeFrame = { x: RIDER_X + roll, y: ground, angle: Math.sin(free * 7) * 0.25 * (1 - tip) + 1.3 * tip };
      const center = { x: mix(RIDER_X + 4, RIDER_X - 50, fall), y: mix(ground - 86, ground - 14, fall) };
      figure = ragdollPose(center, mix(0.1, -Math.PI / 2, fall), 0.7 * (1 - fall) + 0.05, t);
      drawCruiser(ctx, stopX, ground, clock, spin, 1 - ease((t - 0.8) / 0.6));
      break;
    }
    case 'taser': {
      // The cruiser pulls alongside in the near lane; the darts fly; he goes stiff and tips over like a plank.
      const cx = mix(RIDER_X - bust.gap, RIDER_X - 70, lunge);
      const tip = ease((t - 0.3) / 0.7);
      const pivot = { x: RIDER_X + REAR.x, y: ground };
      const angle = -1.45 * tip;
      bikeFrame = { x: pivot.x - REAR.x * Math.cos(angle), y: pivot.y - REAR.x * Math.sin(angle), angle };
      const centerLocal = { x: 4, y: -92 };
      const center = { x: pivot.x + (centerLocal.x - REAR.x) * Math.cos(angle) - centerLocal.y * Math.sin(angle), y: pivot.y + (centerLocal.x - REAR.x) * Math.sin(angle) + centerLocal.y * Math.cos(angle) };
      figure = ragdollPose(center, angle + 0.1, 0, t);
      // Rigid: arms and legs straight out.
      const ax = Math.sin(angle), ay = -Math.cos(angle), px = -ay, py = ax;
      figure.handR = { x: figure.shoulder.x + px * 46 + ax * 4, y: figure.shoulder.y + py * 46 + ay * 4 };
      figure.elbowR = { x: mix(figure.shoulder.x, figure.handR.x, 0.5) + ay * 2, y: mix(figure.shoulder.y, figure.handR.y, 0.5) - ax * 2 };
      figure.handL = { x: figure.shoulder.x - px * 44 + ax * 6, y: figure.shoulder.y - py * 44 + ay * 6 };
      figure.elbowL = { x: mix(figure.shoulder.x, figure.handL.x, 0.5), y: mix(figure.shoulder.y, figure.handL.y, 0.5) };
      if (t < 1.6) {
        ctx.strokeStyle = '#d9dde8';
        ctx.lineWidth = 1;
        const dart = { x: cx + 20, y: ground - 44 };
        for (const dy of [-6, 6]) {
          ctx.beginPath();
          ctx.moveTo(dart.x, dart.y + dy);
          const u = ease(t / 0.12);
          ctx.lineTo(mix(dart.x, figure.hip.x, u), mix(dart.y + dy, figure.hip.y + dy, u));
          ctx.stroke();
        }
        if (t > 0.1 && t < 1.2) {
          ctx.strokeStyle = `rgba(120, 200, 255, ${0.8 * Math.abs(Math.sin(t * 40))})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(figure.hip.x - 10, figure.hip.y); ctx.lineTo(figure.hip.x + 6, figure.hip.y - 8); ctx.lineTo(figure.hip.x - 2, figure.hip.y + 6); ctx.lineTo(figure.hip.x + 12, figure.hip.y + 2);
          ctx.stroke();
        }
      }
      drawCruiser(ctx, cx, ground + 24, clock, spin, 0.4 * (1 - ease((t - 0.8) / 0.6)));
      drawCop(ctx, cx + 14, ground - 26, 'stand', 0, 1, 0);
      if (t > 0.2 && t < 2.2) speech(ctx, figure.head.x + 10, figure.head.y - 30, 'BRO');
      break;
    }
    case 'net': {
      // A Flock drone drops a net; he wobbles and goes down with the bike.
      const dx = RIDER_X + 30 + Math.sin(clock * 2) * 6, dy = 150;
      drawDrone(ctx, dx, dy, clock, true);
      const drop = ease(t / 0.4);
      const fall = ease((t - 0.7) / 0.6);
      bikeFrame = { x: RIDER_X + 60 * fall, y: ground, angle: Math.sin(t * 9) * 0.2 * (1 - fall) + 1.2 * fall };
      const center = { x: RIDER_X + 4 + 70 * fall, y: mix(ground - 92, ground - 14, fall) };
      figure = ragdollPose(center, mix(0.1, Math.PI / 2, fall) + Math.sin(t * 9) * 0.15 * (1 - fall), 0.3 * (1 - fall), t);
      // The net: a mesh from the drone that spreads over him and settles.
      const top = { x: dx, y: dy + 14 };
      const bottom = { x: center.x, y: mix(center.y - 50, center.y + 20, drop) };
      const spread = mix(10, 70, drop);
      ctx.strokeStyle = 'rgba(230, 230, 240, 0.8)';
      ctx.lineWidth = 1;
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        ctx.beginPath();
        ctx.moveTo(mix(top.x - 8, top.x + 8, u), top.y);
        ctx.lineTo(mix(bottom.x - spread, bottom.x + spread, u), bottom.y + Math.sin(u * Math.PI) * 10 * drop);
        ctx.stroke();
      }
      for (let k = 1; k <= 5; k++) {
        const v = k / 6;
        ctx.beginPath();
        ctx.moveTo(mix(top.x - 8, bottom.x - spread, v), mix(top.y, bottom.y, v));
        ctx.lineTo(mix(top.x + 8, bottom.x + spread, v), mix(top.y, bottom.y, v));
        ctx.stroke();
      }
      drawCruiser(ctx, stopX, ground, clock, spin, 1 - ease((t - 0.8) / 0.6));
      break;
    }
  }
  // The bike, then him.
  crashedBike(ctx, rig, bikeFrame, bust.distance + coast(bust.speed, t), flat);
  if (bust.cause !== 'taser') {
    const pose = figure;
    drawRider(ctx, pose, figureLook);
  } else drawRider(ctx, figure, figureLook);
  // The dogpile: officers run in from the cruiser and land on him. One arm stays out, posting.
  const run = ease((t - 1.3) / 0.9);
  const pile = ease((t - 2.25) / 0.3);
  const target = { x: figure.hip.x, y: ground };
  if (t > 1.3) {
    for (let k = 0; k < 3; k++) {
      const start = { x: stopX + 30 - k * 36, y: ground };
      const u = clamp(run * 1.3 - k * 0.15, 0, 1);
      const x = mix(start.x, target.x - 14 + k * 14, u);
      if (u < 1) drawCop(ctx, x, ground - 2, 'run', t + k, 1, 0);
      else {
        const onto = clamp((pile - k * 0.12) * 1.6, 0, 1);
        drawCop(ctx, target.x - 10 + k * 12, ground - 2 - 10 * k * onto, onto > 0.5 ? 'pile' : 'stand', 0, k % 2 ? -1 : 1, -Math.PI / 2 * onto * (k % 2 ? -1 : 1) * 0.9);
      }
    }
  }
  if (pile > 0.6) {
    // The arm out of the pile, phone up, still posting.
    const ax = target.x + 34, ay = ground - 30;
    ctx.strokeStyle = INK.rim;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(target.x + 10, ground - 8); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.strokeStyle = INK.cloth;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(target.x + 10, ground - 8); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.fillStyle = '#1a1826';
    roundRect(ctx, ax - 5, ay - 20, 10, 18, 2);
    ctx.fill();
    ctx.fillStyle = `rgba(120, 200, 255, ${0.7 + 0.3 * Math.sin(clock * 6)})`;
    ctx.fillRect(ax - 3.5, ay - 18, 7, 13);
    if (t > 3) speech(ctx, ax + 8, ay - 34, 'POSTED');
  }
}

export function speech(ctx: CanvasRenderingContext2D, x: number, y: number, s: string): void {
  ctx.font = '900 12px system-ui, sans-serif';
  const w = ctx.measureText(s).width + 14;
  ctx.fillStyle = C.white;
  roundRect(ctx, x - w / 2, y - 10, w, 20, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 9); ctx.lineTo(x - 2, y + 16); ctx.lineTo(x + 3, y + 9);
  ctx.fill();
  text(ctx, s, x, y + 1, 12, '#1a1826', 'center', w - 8, 900);
}

/** The getaway: a Kia pulls alongside in the near lane, he bails in, the decoy bails out, and it is gone. */
export function drawGetaway(ctx: CanvasRenderingContext2D, since: number, clock: number, dusk: number, riderStand: Joint): { youOnBike: boolean; decoyOnBike: boolean; carX: number } {
  const arrive = ease(since / 1.2);
  const leave = ease((since - 2.6) / 1.1);
  const x = mix(mix(-160, RIDER_X + 30, arrive), 1200, leave);
  const y = GROUND + 30;
  const door = ease((since - 1.0) / 0.3) * (1 - ease((since - 2.3) / 0.3));
  // The swap: the player hops in over 1.3–1.8 s, the decoy hops out over 1.8–2.3 s.
  const hopIn = ease((since - 1.3) / 0.5);
  const hopOut = ease((since - 1.8) / 0.5);
  const youOnBike = since < 1.3;
  const decoyOnBike = since >= 2.3;
  drawKia(ctx, x, y, clock, door, dusk);
  if (since >= 1.3 && since < 1.8) {
    const p = { x: mix(riderStand.x, x + 10, hopIn), y: mix(riderStand.y, y - 36, hopIn) - Math.sin(Math.PI * hopIn) * 50 };
    drawRider(ctx, ragdollPose(p, hopIn * 1.2, 0.6, since), { blur: 0, flash: 0, decoy: false, blink: 0, tilt: 0, bike: false });
  }
  if (since >= 1.8 && since < 2.3) {
    const p = { x: mix(x + 10, riderStand.x, hopOut), y: mix(y - 36, riderStand.y, hopOut) - Math.sin(Math.PI * hopOut) * 50 };
    drawRider(ctx, ragdollPose(p, (1 - hopOut) * -1.2, 0.6, since), { blur: 0, flash: 0, decoy: true, blink: 0, tilt: 0, bike: false });
  }
  if (since > 1.1 && since < 2.6) speech(ctx, x - 20, y - 70, since < 1.8 ? 'GET IN' : 'THE DECOY. GO.');
  return { youOnBike, decoyOnBike, carX: x };
}

