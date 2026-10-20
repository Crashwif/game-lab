/**
 * The ladder of things that come for Memo, keyed to the displayed multiplier and, past forty seconds, to the
 * clock, so a replay or a late entry sees the same street. Each kind is drawn from its age alone; the ones
 * that look at the sidewalk expose a gaze window the cone can beat. Nothing here reads the crash point.
 */
import { INK, box, clamp, ease, glow, line, noise, oval, plain, shape, text } from './drawing';
import { GROUND, type Limb, type Point, gait, solveLimb } from './memo';

export type Kind = 'doorbell' | 'tip' | 'van' | 'gaiter' | 'drone' | 'cruiser' | 'facial' | 'tourist' | 'chopper' | 'guard' | 'gator' | 'tiktok' | 'injunction' | 'memo' | 'mariachi' | 'taco' | 'lost'
  | 'contractor' | 'ally' | 'protester' | 'farmer' | 'pamphlets' | 'photoop' | 'tesla' | 'flagguy' | 'landack' | 'cable' | 'rally';
export interface Threat { at: number; kind: Kind; span: number }
export type Layer = 'back' | 'street' | 'air' | 'hud';

const SPANS: Record<Kind, number> = { doorbell: 3.6, tip: 3.6, van: 3.2, gaiter: 9, drone: 3.4, cruiser: 3.8, facial: 3, tourist: 3.4, chopper: 3.8, guard: 4.8, gator: 9, tiktok: 7, injunction: 3.2, memo: 3.6, mariachi: 3.6, taco: 5.6, lost: 5,
  contractor: 3.4, ally: 5, protester: 5, farmer: 3.6, pamphlets: 3.8, photoop: 3.4, tesla: 2.2, flagguy: 5.5, landack: 5, cable: 4.6, rally: 6.5 };
export const spanOf = (kind: Kind) => SPANS[kind];
const LAYERS: Record<Kind, Layer> = { doorbell: 'back', tip: 'hud', van: 'street', gaiter: 'back', drone: 'air', cruiser: 'street', facial: 'hud', tourist: 'back', chopper: 'air', guard: 'street', gator: 'back', tiktok: 'back', injunction: 'air', memo: 'hud', mariachi: 'back', taco: 'street', lost: 'back',
  contractor: 'street', ally: 'back', protester: 'back', farmer: 'street', pamphlets: 'air', photoop: 'back', tesla: 'street', flagguy: 'back', landack: 'back', cable: 'hud', rally: 'back' };
export const layerOf = (kind: Kind) => LAYERS[kind];

/** The order things arrive, at the multiplier that brings them. */
export const LADDER: Threat[] = ([
  [1.18, 'doorbell'], [1.28, 'contractor'], [1.35, 'tip'], [1.55, 'van'], [1.7, 'ally'], [1.8, 'gaiter'], [2.05, 'drone'], [2.22, 'protester'], [2.4, 'cruiser'],
  [2.85, 'facial'], [3.05, 'farmer'], [3.3, 'tourist'], [3.6, 'pamphlets'], [3.9, 'chopper'], [4.25, 'photoop'], [4.6, 'guard'], [5, 'tesla'], [5.4, 'gator'],
  [6.3, 'tiktok'], [6.8, 'flagguy'], [7.5, 'injunction'], [8.2, 'landack'], [9, 'memo'], [10, 'cable'], [11, 'mariachi'], [12.5, 'rally'], [14, 'taco'], [18, 'lost'],
] as [number, Kind][]).map(([at, kind]) => ({ at, kind, span: SPANS[kind] }));
/** From forty seconds, a sweep every nine, around this list, forever. */
export const OVERTIME_KINDS: Kind[] = ['van', 'contractor', 'drone', 'photoop', 'chopper', 'cruiser', 'tesla', 'gator', 'protester', 'tourist', 'lost', 'flagguy'];
export const OVERTIME_START = 40;
export const OVERTIME_EVERY = 9;

export interface Env {
  age: number;
  /** How far the sidewalk has gone by since the threat appeared. */
  travel: number;
  time: number;
  heroX: number;
  heroHead: Point;
  /** How far under the cone he is, 0..1. */
  coned: number;
  verdict: 'unseen' | 'spotted' | null;
  verdictAge: number;
  tension: number;
  alpha: number;
}

// Positions, shared by the gaze test and the drawing so they can never disagree.
const vanX = (age: number) => { const p = clamp(age / 2.6); return 1180 - 1500 * (p - 0.17 * Math.sin(Math.PI * 2 * p)) - Math.max(0, age - 2.6) * 700; };
const gaiterX = (e: Env) => 1000 - e.travel - 80 * e.age;
const droneX = (age: number) => 1060 - 470 * age;
const droneFloor = (age: number) => droneX(age) + 70 * Math.sin(age * 2.6);
const cruiserX = (age: number) => age < 0.9 ? 1180 - 740 * ease(age / 0.9) : age < 2.2 ? 440 + 3 * Math.sin(age * 10) : 440 - 1100 * ((age - 2.2) / 1.2) ** 2;
const chopperFloor = (age: number) => 1050 - 1300 * ease(age / 3.4);
const gatorX = (e: Env) => 1050 - e.travel - 130 * e.age;

export function gazing(kind: Kind, e: Env): boolean {
  switch (kind) {
    case 'van': return e.age >= 0.95 && e.age <= 1.75;
    case 'gaiter': { const d = gaiterX(e) - e.heroX; return d > 30 && d < 230; }
    case 'drone': return Math.abs(droneFloor(e.age) - e.heroX) < 80;
    case 'cruiser': return e.age >= 1.0 && e.age <= 2.1;
    case 'facial': return e.age >= 0.3 && e.age <= 2.0;
    case 'chopper': return Math.abs(chopperFloor(e.age) - e.heroX) < 120;
    case 'gator': { const d = gatorX(e) + 70 - e.heroX; return d > -30 && d < 150; }
    default: return false;
  }
}

/** Whether the sweep is over and its verdict due. */
export function sweepDone(kind: Kind, e: Env): boolean {
  switch (kind) {
    case 'van': return e.age > 1.9;
    case 'gaiter': return gaiterX(e) < e.heroX - 40 || e.age >= SPANS.gaiter - 0.2;
    case 'drone': return droneFloor(e.age) < e.heroX - 100 || e.age >= 3.2;
    case 'cruiser': return e.age > 2.25;
    case 'facial': return e.age > 2.2;
    case 'chopper': return chopperFloor(e.age) < e.heroX - 140 || e.age >= 3.6;
    case 'gator': return gatorX(e) + 70 < e.heroX - 60 || e.age >= SPANS.gator - 0.2;
    default: return false;
  }
}

// ---- people ----
export interface Outfit { skin: string; shirt: string; pants: string; vest?: string; vestText?: string; hat?: 'cap' | 'bucket' | 'sombrero' | 'helmet' | 'straw' | 'beanie' | 'none'; hatColor?: string; gaiter?: boolean; shades?: boolean; stache?: boolean; hair?: string }
export interface Pose { back?: Point; front?: Point; lean?: number; look?: number }
export const AGENT: Outfit = { skin: '#d7a980', shirt: '#2b2f3a', pants: '#6b6a52', vest: '#2b2f3a', vestText: 'POLICE', hat: 'cap', gaiter: true, shades: true };

/** A generic person facing `dir` (+1 right, −1 left): planted gait when `phase` is given, standing otherwise. Returns world hand and head positions. */
export function figure(c: CanvasRenderingContext2D, x: number, y: number, scale: number, dir: number, phase: number | null, stride: number, o: Outfit, pose: Pose = {}): { back: Point; front: Point; head: Point; shoulder: Point } {
  c.save(); c.translate(x, y); c.scale(scale * dir, scale);
  const moving = phase !== null;
  const b = moving ? gait(phase, stride, 0.5, 7) : { x: -8, lift: 0 }, f = moving ? gait(phase, stride, 0, 7) : { x: 8, lift: 0 };
  const bob = moving ? Math.abs(Math.sin(Math.PI * 2 * phase)) * 2.5 : 0;
  const lean = pose.lean ?? (moving ? 0.1 : 0);
  const hip = { x: 0, y: -52 - bob };
  const sh = { x: hip.x + 40 * Math.sin(lean), y: hip.y - 40 * Math.cos(lean) };
  const head = { x: sh.x + 22 * Math.sin(lean) + (pose.look ?? 0) * -6, y: sh.y - 22 * Math.cos(lean) };
  const swing = moving ? Math.sin(Math.PI * 2 * phase) : 0;
  const backT = pose.back ? { x: sh.x + pose.back.x, y: sh.y + pose.back.y } : { x: sh.x - 6 - 14 * swing, y: sh.y + 30 };
  const frontT = pose.front ? { x: sh.x + pose.front.x, y: sh.y + pose.front.y } : { x: sh.x + 6 + 14 * swing, y: sh.y + 30 };
  const legs: [Limb, Limb] = [solveLimb({ x: -4, y: hip.y }, { x: b.x, y: -b.lift }, 28, 28, -1), solveLimb({ x: 4, y: hip.y }, { x: f.x, y: -f.lift }, 28, 28, -1)];
  const arms: [Limb, Limb] = [solveLimb({ x: sh.x - 3, y: sh.y + 5 }, backT, 20, 20, 1), solveLimb({ x: sh.x + 3, y: sh.y + 5 }, frontT, 20, 20, 1)];
  const limb = (l: Limb, color: string, w: number) => line(c, [[l.root.x, l.root.y], [l.joint.x, l.joint.y], [l.end.x, l.end.y]], color, w);
  const shoe = (p: Point) => box(c, p.x - 10, p.y - 7, 21, 9, '#1c1c30', 3, 2);
  oval(c, 0, 3, 22, 5, '#15142b55');
  limb(legs[0], INK, 14); limb(legs[0], o.pants, 9); shoe(legs[0].end);
  limb(arms[0], INK, 12); limb(arms[0], o.shirt, 7); oval(c, arms[0].end.x, arms[0].end.y, 6, 6, o.skin, 2);
  c.save(); c.translate(hip.x, hip.y); c.rotate(lean);
  box(c, -14, -46, 28, 48, o.shirt, 8, 3);
  if (o.vest) { box(c, -16, -44, 32, 36, o.vest, 6, 3); if (o.vestText) { c.save(); c.translate(0, -22); c.scale(dir, 1); text(c, o.vestText, 0, 4, 10, '#ffffff', 'center', 28); c.restore(); } }
  c.restore();
  limb(legs[1], INK, 14); limb(legs[1], o.pants, 9); shoe(legs[1].end);
  limb(arms[1], INK, 12); limb(arms[1], o.shirt, 7); oval(c, arms[1].end.x, arms[1].end.y, 6, 6, o.skin, 2);
  c.save(); c.translate(head.x, head.y);
  oval(c, 0, 0, 17, 19, o.skin, 3);
  if (o.hair) { c.fillStyle = o.hair; c.beginPath(); c.ellipse(0, -8, 17, 12, 0, Math.PI, 0); c.fill(); }
  if (o.gaiter) box(c, -17, 1, 34, 20, '#15151f', 6, 2);
  const ex = 5 - 8 * (pose.look ?? 0);
  if (o.shades) { box(c, ex - 11, -8, 11, 8, '#141420', 2, 2); box(c, ex + 1, -8, 11, 8, '#141420', 2, 2); }
  else { oval(c, ex - 4, -4, 3, 3.5, '#fff8ec', 1.5); oval(c, ex + 6, -4, 3, 3.5, '#fff8ec', 1.5); oval(c, ex - 3, -4, 1.4, 1.6, INK); oval(c, ex + 7, -4, 1.4, 1.6, INK); }
  if (o.stache) shape(c, [[ex - 7, 6], [ex + 3, 4], [ex + 13, 6], [ex + 10, 10], [ex + 3, 8], [ex - 4, 10]], '#2b1d16', 2);
  if (!o.gaiter) line(c, [[ex - 2, 12], [ex + 8, 12]], INK, 2.5);
  switch (o.hat) {
    case 'cap': shape(c, [[-17, -8], [-13, -22], [14, -23], [19, -8]], o.hatColor ?? '#1b1f2e', 3); line(c, [[17, -9], [32, -6]], o.hatColor ?? '#1b1f2e', 6); break;
    case 'beanie': shape(c, [[-18, -4], [-16, -24], [0, -30], [16, -24], [18, -4]], o.hatColor ?? '#2b2b3a', 3); box(c, -18, -8, 36, 7, o.hatColor ?? '#2b2b3a', 2, 2); break;
    case 'bucket': oval(c, 0, -6, 22, 6, '#6b7b4b', 3); box(c, -15, -26, 30, 20, '#6b7b4b', 6, 3); break;
    case 'sombrero': oval(c, 0, -8, 44, 9, '#d9b45a', 3); shape(c, [[-16, -8], [-8, -36], [8, -36], [16, -8]], '#d9b45a', 3); line(c, [[-14, -12], [14, -12]], '#c2321e', 3); break;
    case 'helmet': shape(c, [[-19, -4], [-17, -22], [0, -28], [17, -22], [19, -4]], '#5a6b3a', 3); break;
    case 'straw': oval(c, 0, -8, 30, 7, '#f0dcb0', 3); box(c, -14, -24, 28, 17, '#f0dcb0', 6, 3); break;
    default: break;
  }
  c.restore();
  c.restore();
  const w = (p: Point): Point => ({ x: x + p.x * scale * dir, y: y + p.y * scale });
  return { back: w(arms[0].end), front: w(arms[1].end), head: w(head), shoulder: w(sh) };
}

// ---- vehicles ----
export function van(c: CanvasRenderingContext2D, x: number, baseY: number, door: number, brake: number, hazard: number, sign: boolean): void {
  c.save(); c.translate(x, baseY);
  oval(c, 0, 2, 126, 11, '#15142b55');
  shape(c, [[-122, -12], [-122, -62], [-104, -96], [112, -96], [118, -12]], '#eef0f3', 4);
  shape(c, [[-116, -66], [-100, -90], [-64, -90], [-64, -66]], '#20242c', 3);
  box(c, -54, -90, 164, 30, '#20242c', 3, 3);
  box(c, 8 + 58 * door, -88, 66, 72, '#e2e5ea', 3, 3); line(c, [[16 + 58 * door, -50], [28 + 58 * door, -50]], INK, 4);
  if (door > 0.05) box(c, 8, -88, 58 * door, 72, '#0e1016', 2, 2);
  box(c, 94, -40, 22, 12, '#f6f1e4', 2, 2); plain(c, 'DLR', 105, -31, 7, '#1e1a2b', 'center', 'system-ui, sans-serif', 800);
  const stop = brake > 0.01 ? '#ff3b3b' : hazard > 0.5 ? '#ffb13b' : '#7a2a2a';
  box(c, 110, -62, 8, 14, stop, 2, 2); if (brake > 0.01 || hazard > 0.5) glow(c, 116, -55, 40, brake > 0.01 ? '255, 60, 60' : '255, 180, 60', 0.5);
  box(c, -122, -58, 8, 12, '#fff2ae', 2, 2);
  if (sign) { c.save(); c.translate(-92, -80); c.rotate(-0.08); box(c, -16, -8, 34, 16, '#d9b47a', 2, 2); plain(c, 'NOT ICE', 1, 4, 7, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); c.restore(); }
  for (const w of [-80, 78]) { oval(c, w, -4, 21, 21, '#1d2130', 3); oval(c, w, -4, 9, 9, '#8e98a0', 2); }
  c.restore();
}

function cruiser(c: CanvasRenderingContext2D, x: number, baseY: number, lights: number, age: number): void {
  c.save(); c.translate(x, baseY);
  oval(c, 0, 2, 112, 10, '#15142b55');
  shape(c, [[-104, -10], [-98, -42], [-66, -46], [-44, -72], [44, -72], [70, -46], [100, -42], [106, -10]], '#f4f4f0', 4);
  shape(c, [[-60, -46], [-40, -66], [40, -66], [64, -46]], '#1f2535', 3);
  box(c, -40, -44, 80, 30, '#1f2535', 3, 3); box(c, 46, -44, 44, 30, '#1f2535', 3, 3);
  text(c, 'SHERIFF', 0, -24, 12, '#f4f4f0', 'center', 70); plain(c, '287(g) PARTNER · ASK ME HOW', 0, -16, 5, '#f4f4f0', 'center', 'system-ui, sans-serif', 800);
  box(c, -26, -82, 52, 10, '#2b3350', 3, 2);
  const swap = Math.sin(age * 18) > 0;
  box(c, -24, -81, 22, 8, lights > 0.01 && swap ? '#ff4d6d' : '#7a1f2e', 2, 1); box(c, 2, -81, 22, 8, lights > 0.01 && !swap ? '#5aa8ff' : '#1f3d7a', 2, 1);
  if (lights > 0.01) { glow(c, -13, -78, 60, swap ? '255, 70, 105' : '80, 140, 255', 0.6 * lights); glow(c, 13, -78, 60, swap ? '80, 140, 255' : '255, 70, 105', 0.6 * lights); }
  // The deputy, lit by his phone.
  oval(c, 6, -58, 9, 10, '#d7a980', 2); box(c, -2, -72, 16, 6, '#3b3b47', 2, 2);
  box(c, -8, -56, 10, 14, '#dff4ff', 1, 1.5); glow(c, -3, -52, 22, '160, 220, 255', 0.5 + 0.2 * Math.sin(age * 9));
  for (const w of [-66, 70]) { oval(c, w, -4, 19, 19, '#1d2130', 3); oval(c, w, -4, 8, 8, '#8e98a0', 2); }
  c.restore();
}

function humvee(c: CanvasRenderingContext2D, x: number, baseY: number): void {
  c.save(); c.translate(x, baseY);
  oval(c, 0, 2, 120, 11, '#15142b55');
  shape(c, [[-116, -14], [-116, -54], [-70, -58], [-56, -86], [60, -86], [70, -58], [116, -54], [116, -14]], '#5a6b3a', 4);
  shape(c, [[-50, -58], [-40, -80], [54, -80], [62, -58]], '#1f2535', 3);
  line(c, [[80, -60], [96, -120]], '#2d2a33', 3);
  oval(c, 14, -36, 10, 10, '#f6f1e4', 0); shape(c, [[14, -46], [17, -39], [24, -39], [19, -34], [21, -27], [14, -31], [7, -27], [9, -34], [4, -39], [11, -39]], '#f6f1e4', 0);
  plain(c, 'NATIONAL GUARD · TRAFFIC DIVISION', -40, -20, 6, '#f6f1e4', 'center', 'system-ui, sans-serif', 800);
  for (const w of [-74, 76]) { oval(c, w, -4, 24, 24, '#1d2130', 3); oval(c, w, -4, 10, 10, '#8e98a0', 2); }
  c.restore();
}

function tacoTruck(c: CanvasRenderingContext2D, x: number, baseY: number, time: number): void {
  c.save(); c.translate(x, baseY);
  oval(c, 0, 2, 140, 12, '#15142b55');
  shape(c, [[-136, -12], [-136, -58], [-112, -84], [-70, -84], [-70, -116], [138, -116], [138, -12]], '#f2d23c', 4);
  shape(c, [[-108, -60], [-96, -80], [-72, -80], [-72, -60]], '#1f2535', 3);
  box(c, -40, -104, 150, 56, '#2b3350', 4, 3);
  for (let i = 0; i < 6; i++) box(c, -50 + i * 28, -112, 28, 12, i % 2 ? '#c2321e' : '#f6f1e4', 2, 2);
  box(c, -60, -148, 190, 30, '#c2321e', 6, 3); text(c, 'TACOS EL PRIMO', 35, -126, 18, '#fff2c9', 'center', 176);
  box(c, 60, -70, 70, 22, '#f6f1e4', 3, 2); plain(c, 'SANCTUARY', 95, -61, 8, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); plain(c, 'CON SALSA', 95, -53, 7, '#c2321e', 'center', 'system-ui, sans-serif', 900);
  // Cousin in the window, waving.
  const wave = Math.sin(time * 6) * 0.5;
  oval(c, 30, -72, 13, 14, '#b9794d', 3); shape(c, [[16, -80], [18, -92], [42, -92], [44, -80]], '#1b1f2e', 2);
  line(c, [[48, -64], [66, -86 - wave * 10]], '#1b1f2e', 8); oval(c, 66, -88 - wave * 10, 6, 6, '#b9794d', 2);
  for (let i = 0; i < 3; i++) { const u = (time * 0.6 + i * 0.33) % 1; c.save(); c.globalAlpha = 0.5 * (1 - u); oval(c, 20 + i * 24, -120 - u * 50, 12 + u * 10, 8 + u * 6, '#ffffff'); c.restore(); }
  for (const w of [-96, 96]) { oval(c, w, -4, 20, 20, '#1d2130', 3); oval(c, w, -4, 9, 9, '#8e98a0', 2); }
  c.restore();
}

/** A spotlight cone from a point to the sidewalk, added on top. */
function beam(c: CanvasRenderingContext2D, x0: number, y0: number, floorX: number, half: number, alpha: number): void {
  if (alpha <= 0.01) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha;
  shape(c, [[x0 - 6, y0], [x0 + 6, y0], [floorX + half, GROUND + 14], [floorX - half, GROUND + 14]], '#fff4b9', 0);
  c.globalAlpha = alpha * 0.6; oval(c, floorX, GROUND + 8, half, 9, '#fff4b9');
  c.restore();
}

function droneBody(c: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  line(c, [[x - 24, y - 2], [x + 24, y - 2]], '#30293d', 4);
  for (const dx of [-24, 24]) oval(c, x + dx, y - 6, 4 + 9 * Math.abs(Math.sin(time * 40 + dx)), 2.5, '#5b5470aa');
  box(c, x - 13, y - 5, 26, 13, '#3b3550', 5, 2);
  oval(c, x, y + 10, 5, 4, '#fff6cf', 1.5);
  oval(c, x + 9, y - 1, 2.5, 2.5, Math.sin(time * 9) > 0 ? '#ff5d72' : '#5a2833');
}

function gator(c: CanvasRenderingContext2D, x: number, y: number, phase: number, snap: number): void {
  c.save(); c.translate(x, y);
  oval(c, 0, 2, 70, 7, '#15142b55');
  shape(c, [[60, -6], [120, -2], [150, 2], [120, 6], [60, 10]], '#3f7a3a', 3);
  for (let i = 0; i < 4; i++) { const k = Math.sin(Math.PI * 2 * phase + i * 1.6) * 5; line(c, [[-40 + i * 28, 2], [-44 + i * 28 + k, 12]], '#2f5e2b', 7); }
  oval(c, 0, -4, 62, 16, '#4c8f44', 3);
  for (let i = 0; i < 6; i++) shape(c, [[-50 + i * 20, -16], [-44 + i * 20, -26], [-38 + i * 20, -16]], '#2f5e2b', 2);
  c.save(); c.translate(-60, -6); c.rotate(-snap * 0.5);
  shape(c, [[0, -8], [-56, -4], [-60, 2], [0, 4]], '#4c8f44', 3);
  for (let i = 0; i < 5; i++) shape(c, [[-10 - i * 9, 2], [-6 - i * 9, 8], [-14 - i * 9, 8]], '#fff8ec', 1);
  c.restore();
  c.save(); c.translate(-60, 0); c.rotate(snap * 0.6); shape(c, [[0, -2], [-54, 0], [-58, 8], [0, 10]], '#3f7a3a', 3); c.restore();
  oval(c, -40, -14, 5, 5, '#f2d23c', 2); oval(c, -40, -14, 1.2, 3, INK);
  c.restore();
}

const TOURIST: Outfit = { skin: '#f0a080', shirt: '#f6f1e4', pants: '#d9b47a', hat: 'straw' };
const TEEN: Outfit[] = [{ skin: '#c98a5b', shirt: '#7a3bd1', pants: '#1f2535', hair: '#2b1d16' }, { skin: '#f0c8a8', shirt: '#ff5d8f', pants: '#3b4f8a', hair: '#e8b34a' }, { skin: '#8d5a3c', shirt: '#2bd1a5', pants: '#1f2535', hair: '#1b1b1b' }];
const MARIACHI: Outfit = { skin: '#c98a5b', shirt: '#1b1b2b', pants: '#1b1b2b', hat: 'sombrero', stache: true };
const GUARD: Outfit = { skin: '#d7a980', shirt: '#5a6b3a', pants: '#5a6b3a', hat: 'helmet' };
const GAITER: Outfit = { skin: '#e2b08a', shirt: '#2b2f3a', pants: '#8a7a5a', vest: '#2b2f3a', vestText: 'POLICE', gaiter: true, shades: true, hat: 'cap' };

const CONTRACTOR: Outfit = { skin: '#e2b08a', shirt: '#f6f1e4', pants: '#3b4f8a', hat: 'cap', hatColor: '#c2321e', shades: true, stache: true };
const FARMER: Outfit = { skin: '#d7a980', shirt: '#4a6fa5', pants: '#4a6fa5', hat: 'straw', stache: true };
const PROTESTER: Outfit = { skin: '#f0c8a8', shirt: '#1b1b2b', pants: '#1b1b2b', hat: 'beanie', hatColor: '#1b1b2b' };
const SUIT_R: Outfit = { skin: '#f0c8a8', shirt: '#2b2f3a', pants: '#2b2f3a', hair: '#c9c9c9' };
const SUIT_B: Outfit = { skin: '#c98a5b', shirt: '#2b2f3a', pants: '#2b2f3a', hair: '#2b1d16' };
const FLAG: Outfit = { skin: '#f0a080', shirt: '#f6f1e4', pants: '#3b4f8a', hat: 'cap', hatColor: '#c2321e', shades: true };
const SPEAKER: Outfit = { skin: '#d7a980', shirt: '#3b3b47', pants: '#1e1a2b', hair: '#5a3a24' };
const ALLY_O: Outfit = { skin: '#f0c8a8', shirt: '#e9e3d3', pants: '#c7b8a0', hair: '#7a4f2a' };
const RED_SIDE: Outfit[] = [{ skin: '#f0a080', shirt: '#c2321e', pants: '#3b4f8a', hat: 'cap', hatColor: '#c2321e' }, { skin: '#e2b08a', shirt: '#f6f1e4', pants: '#2b2f3a', hat: 'cap', hatColor: '#c2321e', stache: true }, { skin: '#f0c8a8', shirt: '#1b1f2e', pants: '#5a4a3a', hat: 'cap', hatColor: '#1b1f2e' }];
const BLUE_SIDE: Outfit[] = [{ skin: '#c98a5b', shirt: '#7a3bd1', pants: '#1f2535', hair: '#2b1d16' }, { skin: '#f0c8a8', shirt: '#4a8fd1', pants: '#c7b8a0', hair: '#e8b34a' }, { skin: '#8d5a3c', shirt: '#2bd1a5', pants: '#1f2535', hat: 'beanie', hatColor: '#57b57b' }];

/** A placard on a stick, held at a hand. */
function placard(c: CanvasRenderingContext2D, hand: Point, lines: string[], fill: string, ink: string, tilt = -0.12, w = 86): void {
  c.save(); c.translate(hand.x, hand.y); c.rotate(tilt);
  line(c, [[0, 0], [0, -44]], '#d9c7a3', 5);
  const h = 14 + lines.length * 14;
  box(c, -w / 2, -44 - h, w, h, fill, 3, 3);
  lines.forEach((t, i) => plain(c, t, 0, -44 - h + 14 + i * 14, 11, ink, 'center', 'system-ui, sans-serif', 900, w - 8));
  c.restore();
}

/** A pickup that pulls up and idles beside him with the driver leaning out; `lines` go on the tailgate. */
function pickup(c: CanvasRenderingContext2D, x: number, baseY: number, color: string, lines: string[], driver: Outfit, crates: boolean, time: number): void {
  c.save(); c.translate(x, baseY);
  oval(c, 0, 2, 118, 11, '#15142b55');
  shape(c, [[-116, -10], [-116, -54], [-30, -54], [-30, -84], [34, -84], [52, -56], [112, -52], [116, -10]], color, 4);
  shape(c, [[-24, -80], [30, -80], [46, -56], [-24, -56]], '#1f2535', 3);
  box(c, -112, -50, 80, 10, '#2b3350', 2, 2);
  if (crates) for (let b = 0; b < 3; b++) { box(c, -104 + b * 26, -70, 22, 18, '#8a5a3c', 2, 2); for (let k = 0; k < 3; k++) oval(c, -98 + b * 26 + k * 6, -72, 3.5, 3.5, k % 2 ? '#e63946' : '#57b57b', 1); }
  box(c, -112, -46, 72, 30, '#f6f1e4', 3, 2);
  lines.forEach((t, i) => plain(c, t, -76, -34 + i * 11, 8, '#1e1a2b', 'center', 'system-ui, sans-serif', 900, 66));
  // The driver, leaning out of the window.
  c.save(); c.translate(-2, -60);
  oval(c, 0, 0, 13, 14, driver.skin, 3);
  if (driver.hat === 'straw') { oval(c, 0, -8, 22, 5, '#f0dcb0', 2); box(c, -11, -20, 22, 13, '#f0dcb0', 5, 2); }
  else { shape(c, [[-13, -6], [-10, -18], [11, -19], [15, -6]], driver.hatColor ?? '#1b1f2e', 2); line(c, [[-13, -7], [-26, -5]], driver.hatColor ?? '#1b1f2e', 5); }
  if (driver.shades) { box(c, -12, -5, 9, 6, '#141420', 2, 1.5); box(c, 1, -5, 9, 6, '#141420', 2, 1.5); } else { oval(c, -5, -3, 2.5, 2.5, '#fff8ec', 1); oval(c, 5, -3, 2.5, 2.5, '#fff8ec', 1); }
  if (driver.stache) shape(c, [[-7, 4], [0, 2], [7, 4], [5, 7], [0, 6], [-5, 7]], '#2b1d16', 1.5);
  line(c, [[-10, 14], [-32, 20]], driver.shirt, 9); oval(c, -34, 21, 6, 6, driver.skin, 2);
  c.restore();
  for (const w of [-74, 76]) { oval(c, w, -4, 23, 23, '#1d2130', 3); oval(c, w, -4, 10, 10, '#8e98a0', 2); }
  c.restore();
}

/** Two groups of three with placards, facing each other, filming each other. */
function crowd(c: CanvasRenderingContext2D, x: number, outfits: Outfit[], dir: number, signs: string[][], time: number): void {
  for (let i = 0; i < 3; i++) {
    const px = x + i * 40 * dir, bob = Math.sin(time * 6 + i) * 2;
    const h = figure(c, px, GROUND - 10 + bob, 0.82, dir, null, 0, outfits[i]!, { front: { x: 14, y: -26 }, back: { x: -10, y: -34 } });
    placard(c, h.back, signs[i]!, i === 1 ? '#f6f1e4' : dir > 0 ? '#c2321e' : '#4a8fd1', i === 1 ? '#1e1a2b' : '#ffffff', dir > 0 ? -0.15 : 0.15, 80);
    box(c, h.front.x - 5, h.front.y - 18, 10, 18, '#141420', 2, 2); box(c, h.front.x - 3, h.front.y - 16, 6, 12, '#8ff', 1, 0);
  }
}

/** Someone carried by two agents, legs going, across the back of the sidewalk. */
function carried(c: CanvasRenderingContext2D, x: number, y: number, age: number, who: Outfit, prop: (c: CanvasRenderingContext2D) => void): void {
  const stride = 44, phase = age * 3;
  figure(c, x + 46, y, 0.86, -1, phase, stride, AGENT, { back: { x: 14, y: 2 }, front: { x: 26, y: -2 } });
  c.save(); c.translate(x, y - 52); c.rotate(-1.35);
  figure(c, 0, 0, 0.8, 1, age * 2.5, 30, who, { back: { x: -20, y: 12 }, front: { x: 24, y: 10 }, lean: 0 });
  prop(c);
  c.restore();
  figure(c, x - 52, y, 0.86, -1, phase + 0.5, stride, AGENT, { back: { x: -10, y: -6 }, front: { x: -22, y: 0 } });
}

export function drawThreat(c: CanvasRenderingContext2D, kind: Kind, e: Env, layer: Layer): void {
  if (e.alpha <= 0.01) return;
  if (kind === 'photoop' && layer === 'hud') {
    // The flash: both of them got the picture.
    const f = e.age > 1.4 && e.age < 1.62 ? 1 - (e.age - 1.4) / 0.22 : 0;
    if (f > 0) { c.save(); c.globalAlpha = 0.75 * f * e.alpha; c.fillStyle = '#ffffff'; c.fillRect(0, 0, 960, 540); c.restore(); }
    return;
  }
  if (LAYERS[kind] !== layer) return;
  const { age, time } = e;
  c.save(); c.globalAlpha = e.alpha;
  switch (kind) {
    case 'doorbell': {
      const x = 640 - e.travel * 0.6, y = 332;
      if (x < -40 || x > 1000) break;
      box(c, x - 9, y - 20, 18, 40, '#f4f4f0', 5, 3);
      const k = 0.5 + 0.5 * Math.sin(time * 6);
      glow(c, x, y - 6, 26, '80, 160, 255', 0.5 * k); oval(c, x, y - 6, 6, 6, '#3b7dff', 2);
      const a = Math.atan2(e.heroHead.y - y, e.heroX - x); oval(c, x + Math.cos(a) * 2.5, y - 6 + Math.sin(a) * 2.5, 2.2, 2.2, INK);
      box(c, x - 7, y + 8, 14, 7, '#ff3b3b', 2, 1); plain(c, 'REC', x, y + 14, 5, '#ffffff', 'center', 'system-ui, sans-serif', 900);
      break;
    }
    case 'tip': {
      const x = 960 - 326 * ease(age / 0.4) + 340 * ease((age - 2.9) / 0.5);
      box(c, x, 126, 310, 62, '#f6f1e4', 10, 3);
      box(c, x + 10, 136, 42, 42, '#c2321e', 8, 2); text(c, '!', x + 31, 168, 26, '#fff2c9', 'center');
      plain(c, 'TIP LINE · #4471', x + 62, 150, 12, '#1e1a2b', 'left', 'system-ui, sans-serif', 900);
      plain(c, '“a guy. with a leaf blower.”', x + 62, 166, 11, '#3b3b47', 'left', 'system-ui, sans-serif', 600);
      plain(c, 'from: neighbor (doorbell cam) · priority: VIBES', x + 62, 180, 8, '#7a3b2a', 'left', 'system-ui, sans-serif', 700);
      break;
    }
    case 'van': {
      const x = vanX(age); if (x < -300 || x > 1400) break;
      const brake = e.verdict === 'spotted' && e.verdictAge < 0.6 ? 1 : 0;
      van(c, x, 534, 0, brake, 0, true);
      if (brake) { c.save(); c.globalAlpha *= 0.7; for (let i = 0; i < 3; i++) oval(c, x - 100 + i * 10, 528, 18 + i * 6, 10, '#ffffff'); c.restore(); }
      break;
    }
    case 'gaiter': {
      const x = gaiterX(e); if (x < -80 || x > 1060) break;
      const look = gazing(kind, e) ? 1 : 0;
      const h = figure(c, x, GROUND - 8, 0.9, -1, (80 * age + e.travel) / 46, 46, GAITER, { back: { x: 8, y: 20 }, front: { x: 22, y: 18 }, look });
      c.save(); c.translate(h.front.x + 4, h.front.y - 14); c.rotate(Math.PI + 0.1 - 0.3 * look);
      box(c, -16, -20, 32, 40, '#f6f1e4', 2, 2); plain(c, 'NEWS', 0, -8, 9, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); for (let i = 0; i < 4; i++) line(c, [[-11, 0 + i * 5], [11, 0 + i * 5]], '#9a8f7a', 1.5); c.restore();
      if (look && e.verdict === null) { c.save(); c.globalAlpha *= 0.8; box(c, x - 60, GROUND - 150, 60, 20, '#f6f1e4', 6, 2); plain(c, 'hmm.', x - 30, GROUND - 136, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800); c.restore(); }
      break;
    }
    case 'drone': {
      const x = droneX(age), y = 110 + 8 * Math.sin(time * 2); if (x < -80) break;
      beam(c, x, y + 9, droneFloor(age), 60, 0.22);
      droneBody(c, x, y, time);
      break;
    }
    case 'cruiser': {
      const x = cruiserX(age); if (x < -300) break;
      const lights = e.verdict === 'spotted' && e.verdictAge < 0.7 ? 1 : 0;
      cruiser(c, x, 534, lights, age);
      if (age > 2.2 && age < 2.9) { c.save(); c.globalAlpha *= 0.6; for (let i = 0; i < 3; i++) oval(c, x + 90 + i * 14, 528, 14 + i * 6, 8, '#ffffff'); c.restore(); }
      break;
    }
    case 'facial': {
      const hx = e.heroHead.x, hy = e.heroHead.y - 8 + 40 * e.coned;
      const open = ease(age / 0.3), r = 34 + 60 * (1 - open);
      c.save(); c.strokeStyle = '#5bffb1'; c.lineWidth = 3; c.globalAlpha *= 0.9;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) { c.beginPath(); c.moveTo(hx + sx * r, hy + sy * (r - 14)); c.lineTo(hx + sx * r, hy + sy * r); c.lineTo(hx + sx * (r - 14), hy + sy * r); c.stroke(); }
      if (age < 2) { const sy = hy - r + ((age * 120) % (2 * r)); c.globalAlpha *= 0.6; c.beginPath(); c.moveTo(hx - r, sy); c.lineTo(hx + r, sy); c.stroke(); }
      c.restore();
      const label = age < 1.1 ? 'SCANNING…' : age < 2.2 ? (e.coned > 0.5 || e.verdict === 'unseen' ? 'MATCH: TRAFFIC CONE · 100%' : 'MATCH 100% · NAME: GUY') : 'ALSO MATCHES: 340,000,000 OTHERS';
      box(c, hx - 110, hy - r - 36, 220, 24, '#0e2a1e', 4, 2); plain(c, label, hx, hy - r - 19, 11, '#5bffb1', 'center', 'ui-monospace, monospace', 700, 210);
      break;
    }
    case 'tourist': {
      const x = 1100 - 430 * age - e.travel * 0.9; if (x < -160) break;
      carried(c, x, GROUND - 8, age, TOURIST, (cc) => { box(cc, -8, -40, 20, 12, '#f6f1e4', 2, 1.5); plain(cc, 'I ♥ IOWA', 2, -31, 6, '#c2321e', 'center', 'system-ui, sans-serif', 900); box(cc, -6, -14, 14, 9, '#3b4f8a', 2, 1.5); });
      box(c, x - 40, GROUND - 170, 110, 22, '#f6f1e4', 6, 2); plain(c, 'I’M FROM DES MOINES', x + 15, GROUND - 155, 9, '#1e1a2b', 'center', 'system-ui, sans-serif', 900);
      break;
    }
    case 'chopper': {
      const bx = 760 - 50 * age, by = 42;
      beam(c, bx, by + 14, chopperFloor(age), 110, 0.2);
      c.save(); c.translate(bx, by);
      shape(c, [[-30, 0], [-20, -14], [24, -14], [34, 0], [20, 10], [-18, 10]], '#1e1a2b', 0); line(c, [[-30, -4], [-80, -10]], '#1e1a2b', 6); shape(c, [[-84, -22], [-74, -22], [-78, 2]], '#1e1a2b', 0);
      c.save(); c.globalAlpha *= 0.5; oval(c, 0, -20, 70 * Math.abs(Math.cos(time * 30)) + 10, 3, '#1e1a2b'); c.restore();
      oval(c, 0, 14, 7, 5, '#fff4b9'); c.restore();
      break;
    }
    case 'guard': {
      const x = age < 3.6 ? 1150 - 450 * ease(age / 0.8) : 700 - 900 * ease((age - 3.6) / 0.9); if (x < -300) break;
      humvee(c, x, 534);
      if (age > 0.9 && age < 3.6) {
        const gx = x - 160;
        const h = figure(c, gx, GROUND + 14, 0.9, -1, null, 0, GUARD, { front: { x: 18, y: -34 }, back: { x: 6, y: 24 } });
        const a = Math.sin(time * 3) * 0.3;
        c.save(); c.translate(h.front.x, h.front.y); line(c, [[0, 0], [0, -40]], '#2d2a33', 4); c.translate(0, -52); c.rotate(a);
        shape(c, [[-10, -22], [10, -22], [22, -10], [22, 10], [10, 22], [-10, 22], [-22, 10], [-22, -10]], a > 0 ? '#c2321e' : '#f2a900', 2);
        c.save(); c.scale(1, 1); text(c, a > 0 ? 'STOP' : 'SLOW', 0, 4, 10, '#ffffff', 'center', 36); c.restore(); c.restore();
      }
      break;
    }
    case 'gator': {
      const x = gatorX(e); if (x < -200 || x > 1200) break;
      const snap = e.verdict === 'spotted' && e.verdictAge < 0.5 ? Math.sin(e.verdictAge * 24) : gazing(kind, e) ? 0.2 : 0;
      const h = figure(c, x, GROUND - 6, 0.9, -1, (130 * age + e.travel) / 46, 46, AGENT, { back: { x: -14, y: 22 }, front: { x: 6, y: 26 } });
      gator(c, x + 70 + 36, GROUND - 6, (130 * age + e.travel) / 40, clamp(snap));
      line(c, [[h.back.x, h.back.y], [x + 70 - 14, GROUND - 20]], '#8a5a3c', 3);
      if (gazing(kind, e) && e.verdict === null) { box(c, x + 40, GROUND - 120, 96, 20, '#f6f1e4', 6, 2); plain(c, 'she smells cone', x + 88, GROUND - 106, 9, '#1e1a2b', 'center', 'system-ui, sans-serif', 800); }
      break;
    }
    case 'tiktok': {
      const x = 1000 - e.travel * 0.9 - 20 * age; if (x < -160) break;
      for (let i = 0; i < 3; i++) {
        const px = x + i * 44, bob = Math.sin(time * 5 + i) * 2;
        const h = figure(c, px, GROUND - 10 + bob, 0.82, x + i * 44 > e.heroX ? -1 : 1, null, 0, TEEN[i]!, { front: { x: 14, y: -26 }, back: { x: -6, y: 24 } });
        box(c, h.front.x - 6, h.front.y - 22, 12, 22, '#141420', 2, 2); box(c, h.front.x - 4, h.front.y - 20, 8, 16, '#8ff', 1, 0);
      }
      box(c, x + 10, GROUND - 160, 84, 22, '#ff2d55', 8, 2); plain(c, '● LIVE · 2.4M', x + 52, GROUND - 145, 10, '#ffffff', 'center', 'system-ui, sans-serif', 900);
      for (let i = 0; i < 6; i++) { const u = (time * 0.5 + i * 0.17) % 1; c.save(); c.globalAlpha *= 1 - u; plain(c, '♥', x + 20 + noise(i * 3.1) * 70 + Math.sin(u * 8 + i) * 8, GROUND - 170 - u * 90, 14 + 8 * noise(i), '#ff5d8f', 'center'); c.restore(); }
      const chat = ['run king', 'NOT THE CONE', 'ice barbie watching this', 'he’s him'][Math.floor(age / 1.4) % 4]!;
      box(c, x - 20, GROUND - 200, 150, 22, '#141420', 6, 2); plain(c, `@user: ${chat}`, x + 55, GROUND - 185, 10, '#ffffff', 'center', 'system-ui, sans-serif', 700, 140);
      break;
    }
    case 'injunction': {
      const x = 600, y = -40 + 110 * age + 10 * Math.sin(age * 3);
      if (age < 1.6) {
        c.save(); c.translate(x, y); c.rotate(Math.sin(age * 2) * 0.15);
        box(c, -42, -54, 84, 108, '#f6f1e4', 3, 3); text(c, 'INJUNCTION', 0, -30, 11, '#1e1a2b', 'center', 76); text(c, 'STOP IT', 0, -6, 16, '#c2321e', 'center', 70);
        plain(c, 'signed, a judge', 0, 16, 8, '#3b3b47', 'center', 'system-ui, sans-serif', 700); for (let i = 0; i < 3; i++) line(c, [[-30, 28 + i * 8], [30, 28 + i * 8]], '#9a8f7a', 1.5); c.restore();
      } else {
        for (let i = 0; i < 12; i++) { const u = age - 1.6, ax = x + (noise(i * 2.3) - 0.5) * 260 * u, ay = y + (noise(i * 4.1) - 0.8) * 160 * u + 300 * u * u; c.save(); c.translate(ax, ay); c.rotate(u * 6 + i); box(c, -8, -5, 16, 10, '#f6f1e4', 1, 1.5); c.restore(); }
      }
      if (age > 1.25) { const dx = 1000 - 1200 * ease((age - 1.25) / 0.4) - 60 * Math.max(0, age - 1.65); droneBody(c, Math.max(dx, x + 40 - 40 * Math.max(0, age - 1.65)), y - 30, time); }
      break;
    }
    case 'memo': {
      const y = -120 + 150 * ease(age / 0.5) - 160 * ease((age - 2.9) / 0.5);
      c.save(); c.translate(610, y); c.rotate(0.04);
      box(c, 0, 0, 300, 96, '#fff7cf', 3, 3); plain(c, 'MEMO FROM HQ', 14, 24, 13, '#1e1a2b', 'left', 'system-ui, sans-serif', 900);
      plain(c, 'RE: QUOTA · NOW 3,000 / DAY', 14, 44, 11, '#c2321e', 'left', 'system-ui, sans-serif', 800);
      plain(c, 'DETAIN SOMETHING. ANYTHING. A CACTUS.', 14, 62, 10, '#1e1a2b', 'left', 'system-ui, sans-serif', 700);
      plain(c, '— MGMT (do not reply, we are also hiding)', 14, 82, 8, '#3b3b47', 'left', 'system-ui, sans-serif', 600);
      c.restore();
      break;
    }
    case 'mariachi': {
      const x = 1100 - 400 * age - e.travel * 0.9; if (x < -200) break;
      carried(c, x, GROUND - 8, age, MARIACHI, (cc) => { oval(cc, 6, -34, 14, 10, '#8a5a3c', 2); box(cc, 10, -40, 30, 6, '#5a3a24', 1, 1.5); });
      for (let i = 0; i < 4; i++) { const u = (time * 0.7 + i * 0.25) % 1; c.save(); c.globalAlpha *= 1 - u; plain(c, '♪', x + 10 + i * 20 + Math.sin(u * 7) * 6, GROUND - 140 - u * 80, 16, '#ffd166', 'center'); c.restore(); }
      const h = figure(c, x - 120, GROUND - 8, 0.86, -1, age * 3 + 0.25, 44, AGENT, { front: { x: 24, y: -18 }, back: { x: 10, y: -10 } });
      oval(c, h.front.x - 14, h.front.y - 10, 24, 20, '#e8c04a', 3); oval(c, h.front.x - 28, h.front.y - 30, 16, 10, '#e8c04a', 3);
      break;
    }
    case 'taco': {
      const x = age < 4.2 ? 1160 - 420 * ease(age / 0.9) : 740 - 1000 * ease((age - 4.2) / 1.2); if (x < -300) break;
      tacoTruck(c, x, 534, time);
      break;
    }
    case 'contractor': {
      const x = cruiserX(age); if (x < -300) break;
      pickup(c, x, 534, '#f6f1e4', ['DEPORT ’EM ALL', 'CONCRETE & LAWN', 'EST. 1776'], CONTRACTOR, false, time);
      if (age > 0.8 && age < 2.3) { const say = age < 1.55 ? 'psst. six guys. monday. cash.' : 'the hat is for the customers.'; box(c, x - 140, 400, 220, 24, '#f6f1e4', 6, 2); plain(c, say, x - 30, 416, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 210); }
      break;
    }
    case 'ally': {
      const x = 1000 - e.travel * 0.9 - 30 * age; if (x < -120) break;
      const h = figure(c, x, GROUND - 8, 0.86, x > e.heroX ? -1 : 1, null, 0, ALLY_O, { front: { x: 16, y: -20 }, back: { x: -8, y: 24 } });
      box(c, h.shoulder.x + 10, h.shoulder.y + 10, 16, 22, '#d9c7a3', 3, 2);
      c.save(); c.translate(x - 54, GROUND - 8); line(c, [[0, 0], [0, -70]], '#f6f1e4', 5);
      const colors = ['#e63946', '#f4a261', '#f2d23c', '#57b57b', '#4a8fd1'];
      for (let i = 0; i < 5; i++) box(c, -36, -140 + i * 14, 72, 15, colors[i]!, 0, 0);
      box(c, -36, -140, 72, 70, '#00000000', 4, 3);
      ['IN THIS HOUSE', 'WE BELIEVE', 'NO HUMAN', 'IS ILLEGAL', '$5 LAWNS'].forEach((t, i) => plain(c, t, 0, -129 + i * 14, 7, '#ffffff', 'center', 'system-ui, sans-serif', 900, 66));
      c.restore();
      const say = Math.floor(age / 1.4) % 3 === 0 ? 'psst. ↑ to hide. $5. cash only.' : Math.floor(age / 1.4) % 3 === 1 ? 'i have a sign. i have a lawn.' : 'this is what an ally looks like.';
      box(c, x - 110, GROUND - 190, 190, 24, '#fcf0c9', 6, 2); plain(c, say, x - 15, GROUND - 174, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 180);
      break;
    }
    case 'protester': {
      const x = 980 - e.travel * 0.9 - 20 * age; if (x < -140) break;
      const h = figure(c, x, GROUND - 8, 0.86, x > e.heroX ? -1 : 1, null, 0, PROTESTER, { front: { x: 18, y: -24 }, back: { x: -8, y: -36 } });
      placard(c, h.back, ['ABOLISH', 'ICE'], '#1b1b2b', '#ffffff', 0.1, 70);
      box(c, h.front.x - 5, h.front.y - 18, 10, 18, '#141420', 2, 2); box(c, h.front.x - 3, h.front.y - 16, 6, 12, '#8ff', 1, 0);
      // The ring light on its tripod.
      const rx = x + 74; line(c, [[rx, GROUND - 6], [rx, GROUND - 110]], '#2d2a33', 4); line(c, [[rx - 14, GROUND - 4], [rx, GROUND - 30], [rx + 14, GROUND - 4]], '#2d2a33', 3);
      glow(c, rx, GROUND - 128, 40, '255, 244, 214', 0.7); c.beginPath(); c.strokeStyle = '#fff4d6'; c.lineWidth = 7; c.arc(rx, GROUND - 128, 18, 0, Math.PI * 2); c.stroke();
      const lines = ['say it to the ring light.', 'can you look scared?', 'louder. for the algorithm.', 'we’re live. act natural. act scared.'];
      const say = lines[Math.floor(age / 1.15) % lines.length]!;
      box(c, x - 100, GROUND - 200, 210, 24, '#f6f1e4', 6, 2); plain(c, say, x + 5, GROUND - 184, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 200);
      break;
    }
    case 'farmer': {
      const x = cruiserX(age); if (x < -300) break;
      pickup(c, x, 534, '#6b8f3a', ['FARM FRESH', 'HELP WANTED', 'NO PAPERS NO PROBLEM'], FARMER, true, time);
      if (age > 0.8 && age < 2.3) { const say = age < 1.3 ? 'we need an exception. for my guys.' : age < 1.8 ? 'you’re my guys.' : 'i voted for the wall. the wall needs weeding.'; box(c, x - 150, 400, 240, 24, '#f6f1e4', 6, 2); plain(c, say, x - 30, 416, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 230); }
      break;
    }
    case 'pamphlets': {
      const dx = 1000 - 300 * age, dy = 96 + 6 * Math.sin(time * 2);
      droneBody(c, dx, dy, time);
      for (let i = 0; i < 8; i++) {
        const t0 = 0.3 + i * 0.18, t = age - t0; if (t < 0) continue;
        const px = 1000 - 300 * t0 + Math.sin(t * 3 + i) * 26 - 30 * t, py = dy + 150 * t;
        if (py > GROUND - 6) continue;
        c.save(); c.translate(px, py); c.rotate(Math.sin(t * 4 + i) * 0.5); box(c, -14, -9, 28, 18, '#f6f1e4', 2, 2);
        plain(c, 'KNOW YOUR', 0, -2, 5, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); plain(c, 'RIGHTS', 0, 3, 5, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); plain(c, 'DONATE', 0, 8, 4, '#c2321e', 'center', 'system-ui, sans-serif', 900); c.restore();
      }
      break;
    }
    case 'photoop': {
      const inOut = age < 0.5 ? 1 - ease(age / 0.5) : age > 2.5 ? ease((age - 2.5) / 0.6) : 0;
      const rx = e.heroX - 64 - 420 * inOut, bx = e.heroX + 74 + 420 * inOut;
      const posing = inOut === 0;
      const hr = figure(c, rx, GROUND - 4, 0.9, 1, posing ? null : time * 3.4, 44, SUIT_R, posing ? { front: { x: 22, y: -30 }, back: { x: -6, y: 24 } } : {});
      const hb = figure(c, bx, GROUND - 4, 0.9, -1, posing ? null : time * 3.4 + 0.5, 44, SUIT_B, posing ? { front: { x: 22, y: -30 }, back: { x: -6, y: 24 } } : {});
      line(c, [[hr.shoulder.x + 2, hr.shoulder.y - 2], [hr.shoulder.x + 2, hr.shoulder.y + 22]], '#c2321e', 4);
      line(c, [[hb.shoulder.x - 2, hb.shoulder.y - 2], [hb.shoulder.x - 2, hb.shoulder.y + 22]], '#4a8fd1', 4);
      if (posing && age > 0.9) {
        box(c, rx - 120, GROUND - 190, 170, 24, '#f6f1e4', 6, 2); plain(c, 'strong border. strong lawn.', rx - 35, GROUND - 174, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 160);
        box(c, bx - 50, GROUND - 190, 170, 24, '#f6f1e4', 6, 2); plain(c, 'dignity. also the lawn.', bx + 35, GROUND - 174, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 160);
      }
      break;
    }
    case 'tesla': {
      const x = 1200 - 1500 * age; if (x < -300) break;
      c.save(); c.translate(x, 534);
      oval(c, 0, 2, 108, 10, '#15142b55');
      shape(c, [[-104, -8], [-100, -34], [-70, -44], [-40, -66], [30, -66], [70, -46], [100, -40], [106, -8]], '#d8dbe4', 4);
      shape(c, [[-64, -44], [-38, -62], [26, -62], [62, -46]], '#1f2535', 3);
      box(c, 72, -36, 30, 10, '#f6f1e4', 2, 1.5); plain(c, 'COEXIST', 87, -29, 6, '#1e1a2b', 'center', 'system-ui, sans-serif', 900);
      box(c, 34, -36, 34, 10, '#4a8fd1', 2, 1.5); plain(c, 'WE BELIEVE', 51, -29, 5, '#ffffff', 'center', 'system-ui, sans-serif', 900);
      for (let s = 0; s < 4; s++) line(c, [[110 + s * 14, -50 + s * 10], [160 + s * 14, -50 + s * 10]], '#ffffff88', 3);
      for (const w of [-66, 70]) { oval(c, w, -4, 19, 19, '#1d2130', 3); oval(c, w, -4, 8, 8, '#8e98a0', 2); }
      c.restore();
      if (age > 0.3 && age < 0.9) text(c, 'HONK', x - 20, 430, 20, '#ffd166', 'center');
      break;
    }
    case 'flagguy': {
      const x = 1000 - e.travel * 0.9 - 20 * age; if (x < -160) break;
      const h = figure(c, x, GROUND - 8, 0.88, x > e.heroX ? -1 : 1, null, 0, FLAG, { front: { x: 22, y: 10 }, back: { x: -6, y: -34 } });
      line(c, [[h.back.x, h.back.y], [h.back.x, h.back.y - 90]], '#2d2a33', 4);
      c.save(); c.translate(h.back.x, h.back.y - 90); shape(c, [[0, 0], [78 + Math.sin(time * 3) * 4, 6], [76, 44], [0, 48]], '#f2d23c', 3);
      c.beginPath(); c.strokeStyle = '#2d2a33'; c.lineWidth = 3; c.moveTo(14, 30); c.bezierCurveTo(24, 10, 36, 40, 50, 20); c.stroke(); plain(c, 'DON’T TREAD', 38, 42, 6, '#1e1a2b', 'center', 'system-ui, sans-serif', 900); c.restore();
      line(c, [[h.front.x, h.front.y], [h.front.x + 40, h.front.y + 30]], '#3f7a3a', 4);
      for (let d = 0; d < 5; d++) { const u = (time * 2 + d * 0.2) % 1; oval(c, h.front.x + 40 + u * 50, h.front.y + 30 - 40 * u + 60 * u * u, 2.5, 2.5, '#9fd8ff'); }
      const say = age < 2.4 ? 'he’s one of the good ones. thursdays.' : 'deport the rest. not him. he does the edging.';
      box(c, x - 120, GROUND - 196, 240, 24, '#f6f1e4', 6, 2); plain(c, say, x, GROUND - 180, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 230);
      break;
    }
    case 'landack': {
      const x = 1000 - e.travel * 0.9 - 10 * age; if (x < -160) break;
      figure(c, x, GROUND - 8, 0.86, x > e.heroX ? -1 : 1, null, 0, SPEAKER, { front: { x: 14, y: 4 }, back: { x: -10, y: 6 } });
      box(c, x - 28, GROUND - 66, 56, 60, '#8a5a3c', 4, 3); line(c, [[x, GROUND - 66], [x, GROUND - 92]], '#2d2a33', 3); oval(c, x, GROUND - 96, 5, 5, '#2d2a33', 1.5);
      box(c, x - 22, GROUND - 60, 44, 14, '#f6f1e4', 2, 1.5); plain(c, 'MIMOSA BRUNCH', x, GROUND - 50, 5, '#1e1a2b', 'center', 'system-ui, sans-serif', 900);
      const say = age < 2 ? 'we acknowledge this Home Depot sits on stolen land.' : age < 3.4 ? 'anyway. the mimosas.' : '(polite applause)';
      box(c, x - 150, GROUND - 200, 300, 24, '#f6f1e4', 6, 2); plain(c, say, x, GROUND - 184, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 290);
      break;
    }
    case 'cable': {
      const y = 126 + 10 * (1 - ease(age / 0.4)) - 200 * ease((age - 4) / 0.5);
      c.save(); c.translate(300, y); c.globalAlpha *= ease(age / 0.4);
      box(c, 0, 0, 360, 92, '#141420', 6, 3);
      box(c, 4, 4, 174, 66, '#2f4fa8', 3, 0); box(c, 182, 4, 174, 66, '#b83232', 3, 0);
      for (const [cx, col] of [[91, '#f0c8a8'], [269, '#e2b08a']] as const) { oval(c, cx, 36, 16, 18, col, 2.5); oval(c, cx, 44, 6, 2 + 3 * Math.abs(Math.sin(time * 14 + cx)), '#5a1d2a', 1.5); oval(c, cx - 6, 32, 2, 2, INK); oval(c, cx + 6, 32, 2, 2, INK); }
      plain(c, 'OUTRAGED', 91, 16, 9, '#ffffff', 'center', 'system-ui, sans-serif', 900); plain(c, 'ALSO OUTRAGED', 269, 16, 9, '#ffffff', 'center', 'system-ui, sans-serif', 900);
      box(c, 300, 8, 44, 14, '#ff2d55', 3, 0); plain(c, 'LIVE', 322, 19, 8, '#ffffff', 'center', 'system-ui, sans-serif', 900);
      box(c, 4, 72, 352, 16, '#f2d23c', 2, 0);
      c.save(); c.beginPath(); c.rect(6, 72, 348, 16); c.clip();
      const ticker = 'BREAKING: BOTH SIDES FURIOUS · SAME SPONSOR · A MATTRESS · BUY THE MATTRESS · ';
      const off = (time * 60) % 420; plain(c, ticker + ticker, 360 - off, 84, 9, '#1e1a2b', 'left', 'system-ui, sans-serif', 900); c.restore();
      c.restore();
      break;
    }
    case 'rally': {
      const x = 960 - e.travel * 0.9 - 10 * age; if (x < -400) break;
      crowd(c, x, RED_SIDE, 1, [['DEPORT'], ['LAW &', 'ORDER'], ['BUILD', 'IT']], time);
      crowd(c, x + 300, BLUE_SIDE, -1, [['NO HUMAN', 'IS ILLEGAL'], ['ABOLISH'], ['LOVE', '(CONDITIONS)']], time);
      const left = Math.floor(age / 1.2) % 2 === 0;
      box(c, x - 40, GROUND - 210, 150, 24, '#f6f1e4', 6, 2); plain(c, left ? 'we’re trending!' : 'same phone plan.', x + 35, GROUND - 194, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 140);
      box(c, x + 210, GROUND - 210, 170, 24, '#f6f1e4', 6, 2); plain(c, left ? 'no, WE’RE trending!' : 'same parking lot.', x + 295, GROUND - 194, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 800, 160);
      break;
    }
    case 'lost': {
      const x = 950 - e.travel * 0.9 - 60 * age; if (x < -200) break;
      const wob = (i: number) => Math.sin(time * 7 + i * 2) * 6;
      figure(c, x + wob(0), GROUND - 8, 0.86, 1, null, 0, AGENT, { front: { x: 24, y: 10 }, back: { x: -8, y: 24 } });
      figure(c, x + 44 + wob(1), GROUND - 8, 0.86, -1, null, 0, AGENT, { front: { x: 22, y: 12 }, back: { x: 20, y: 6 } });
      figure(c, x + 96 + wob(2), GROUND - 8, 0.86, -1, null, 0, AGENT, { front: { x: 10, y: -30 }, back: { x: -6, y: 24 } });
      const say = Math.floor(age / 1.3) % 2 === 0;
      box(c, x - 30, GROUND - 160, 130, 22, '#f6f1e4', 6, 2); plain(c, say ? 'STOP RESISTING' : 'YOU STOP RESISTING', x + 35, GROUND - 145, 10, '#1e1a2b', 'center', 'system-ui, sans-serif', 900, 124);
      break;
    }
  }
  c.restore();
}
