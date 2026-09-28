/**
 * The trench and the squad: frog soldiers in helmets with a marching rig
 * whose cadence follows the multiplier, the sergeant with his field phone,
 * the whistle, your frog's dive back into the trench, and the KIA state
 * after the nuke. Nothing here changes the outcome.
 */
import { INK, RIDGE_Y, TRENCH_Y, W } from './field';
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const YOURS = 2;
const COUNT = 5;
const TRENCH_FLOOR = TRENCH_Y + 78;
const SKIN = '#5cab4a';
const HELMET = '#5e6b3a';

export type FrogMode = 'trench' | 'marching' | 'diving' | 'safe' | 'dead' | 'flung';

export interface Frog {
  mode: FrogMode;
  x: number;
  seed: number;
  phase: number;
  squash: Spring;
  diveAge: number;
  diveFrom: { x: number; y: number };
  clang: Spring;
}

export interface Squad {
  time: number;
  frogs: Frog[];
  over: Spring;
  whistle: Spring;
  ring: Spring;
  bubble: string;
  bubbleAge: number;
  dead: boolean;
  deadAge: number;
  phoneNext: number;
}

function makeFrog(i: number): Frog {
  return { mode: 'trench', x: 210 + i * 130, seed: i * 7.3 + 1, phase: i * 1.3, squash: spring(0), diveAge: 0, diveFrom: { x: 0, y: 0 }, clang: spring(0) };
}

export function createSquad(): Squad {
  return { time: 0, frogs: Array.from({ length: COUNT }, (_, i) => makeFrog(i)), over: spring(0), whistle: spring(0), ring: spring(0), bubble: '', bubbleAge: 9, dead: false, deadAge: 0, phoneNext: 4 };
}

export function resetSquad(s: Squad): void {
  s.frogs = Array.from({ length: COUNT }, (_, i) => makeFrog(i));
  settleSpring(s.over, 0);
  settleSpring(s.whistle, 0);
  settleSpring(s.ring, 0);
  s.bubble = '';
  s.bubbleAge = 9;
  s.dead = false;
  s.deadAge = 0;
  s.phoneNext = s.time + 4;
}

/** Joins a round already running: the squad is already out of the trench. */
export function settleSquad(s: Squad): void {
  settleSpring(s.over, 1);
  for (const f of s.frogs) f.mode = 'marching';
}

/** Where a marching frog stands on the field at `progress`. */
export function marchPosition(f: Frog, progress: number, over: number): { x: number; y: number; scale: number } {
  const p = clamp(progress, 0, 1);
  const y = mix(TRENCH_Y - 6, RIDGE_Y + 34, p) - 70 * (1 - over) * 0.35;
  const scale = mix(1, 0.56, p);
  const drift = Math.sin(f.seed * 3 + p * 6) * 26 * p;
  return { x: f.x + drift, y, scale };
}

export function frogXs(s: Squad, progress: number): number[] {
  return s.frogs.filter((f) => f.mode === 'marching').map((f) => marchPosition(f, progress, 1).x);
}

/** Your frog dives back into the trench with the bag. `quiet` puts it straight back, for a cash-out the scene did not see happen. */
export function diveBack(s: Squad, progress: number, quiet = false): void {
  const f = s.frogs[YOURS]!;
  if (f.mode !== 'marching' && f.mode !== 'trench') return;
  // A frog that never left the trench (the round ran unseen) has nowhere to dive from.
  if (quiet || f.mode === 'trench') { f.mode = 'safe'; return; }
  const at = marchPosition(f, progress, s.over.x);
  f.mode = 'diving';
  f.diveAge = 0;
  f.diveFrom = { x: at.x, y: at.y };
}

/** The nuke landed. `quiet` skips the effects for a crash that already happened. Marching frogs arc back into the trench. */
export function killSquad(s: Squad, quiet: boolean, progress = 0): void {
  if (s.dead) return;
  s.dead = true;
  s.deadAge = quiet ? 10 : 0;
  s.bubble = 'DEV SOLD';
  s.bubbleAge = 0;
  settleSpring(s.ring, 1);
  for (const f of s.frogs) {
    if (f.mode === 'diving') { if (quiet) f.mode = 'safe'; continue; }
    if (f.mode !== 'marching' && f.mode !== 'trench') continue;
    if (!quiet && f.mode === 'marching') {
      const at = marchPosition(f, progress, s.over.x);
      f.diveFrom = { x: at.x, y: at.y };
      f.diveAge = 0;
      f.mode = 'flung';
    } else f.mode = 'dead';
  }
}

export interface SquadDrive { running: boolean; tension: number; multiplier: number; progress: number; reduced: boolean }

export function stepSquad(s: Squad, drive: SquadDrive, dt: number): void {
  s.time += dt;
  s.bubbleAge += dt;
  if (s.dead) s.deadAge += dt;
  const out = drive.running || s.dead;
  stepSpring(s.over, out ? 1 : 0, 6, 0.6, dt);
  stepSpring(s.whistle, drive.running && s.over.x < 0.9 ? 1 : 0, 10, 0.5, dt);
  const cadence = 3 + 9 * drive.tension;
  for (const f of s.frogs) {
    // The whistle blows: the squad goes over the top.
    if (f.mode === 'trench' && drive.running) f.mode = 'marching';
    if (f.mode === 'marching' && drive.running) {
      const before = Math.floor(f.phase);
      f.phase += dt * cadence;
      if (Math.floor(f.phase) !== before) f.squash.v += 4 + 6 * drive.tension;
    }
    stepSpring(f.squash, 0, 18, 0.35, dt);
    stepSpring(f.clang, 0, 14, 0.25, dt);
    if (f.mode === 'diving') {
      f.diveAge += dt;
      if (f.diveAge >= 0.75) { f.mode = 'safe'; f.clang.v += 14; }
    }
    if (f.mode === 'flung') {
      f.diveAge += dt;
      if (f.diveAge >= 1.05) f.mode = 'dead';
    }
  }
  if (!s.dead) {
    const ringing = drive.running && drive.tension > 0.45 && Math.floor(s.time * 1.5) % 4 !== 3;
    stepSpring(s.ring, ringing ? 1 : 0, 30, 0.2, dt);
    if (ringing && s.time > s.phoneNext) {
      const lines = [
        'BUY THE DIP', 'HOLD THE LINE', 'REINFORCEMENTS SOON', 'DEV IS BASED', 'ITS JUST A DIP',
        'NO RETREAT, NO SELLING', 'THE CABAL IS WITH US', 'LP IS LOCKED (TRUST)', 'HEALTHY PULLBACK', 'COMMAND SAYS HOLD', 'FUNDS ARE SAFU',
      ];
      s.bubble = lines[Math.floor(noise(s.time * 1.7) * lines.length)]!;
      s.bubbleAge = 0;
      s.phoneNext = s.time + 2.5 + noise(s.time) * 2;
    }
  }
}

function sandbag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = '#a89468'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, 18, 8); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 8, y + 9); ctx.lineTo(x + w - 8, y + 9); ctx.stroke();
}

interface Pose {
  stride: number;
  squash: number;
  expression: 'grit' | 'hype' | 'shock' | 'chill' | 'dead';
  shades: boolean;
  cigar: boolean;
  bag: boolean;
  helmetLift: number;
  lying: boolean;
  /** 0 dry, 1 stuck: the plant shortens and the knee bends harder. */
  mud?: number;
  phone?: boolean;
  whistle?: boolean;
  time?: number;
}

type Point = { x: number; y: number };

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + (dx / distance) * along - (dy / distance) * bend, y: root.y + (dy / distance) * along + (dx / distance) * bend };
}

function bone(ctx: CanvasRenderingContext2D, a: Point, b: Point, upper: number, lower: number, side: number, width: number, colour: string): void {
  const joint = bendJoint(a, b, upper, lower, side);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 4;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

/** The frog rig: two-bone legs and arms, a helmet that lags the step, a body squashed on each plant. */
export function drawFrog(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, pose: Pose): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (pose.lying) { ctx.rotate(Math.PI / 2); ctx.translate(-10, 20); }
  else ctx.rotate(Math.sin(pose.stride * Math.PI * 2) * 0.05);
  const sq = 1 + 0.18 * pose.squash;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const mud = pose.mud ?? 0;
  const t = pose.time ?? 0;
  // Knees point out. Mud pulls the foot in so the joint folds, and a plant leaves a puddle.
  for (const side of [-1, 1]) {
    const phase = pose.stride * Math.PI * 2 + (side > 0 ? 0 : Math.PI);
    const lift = Math.max(0, Math.sin(phase)) * (7 + 8 * (1 - mud * 0.45));
    const reach = Math.cos(phase) * (4 + 5 * (1 - mud));
    const hip = { x: side * 8, y: -18 };
    const foot = { x: side * (13 + 4 * (1 - mud)) + reach, y: -lift + mud * 3 };
    bone(ctx, hip, foot, 16, 15, foot.y >= hip.y ? -side : side, 6.5, '#4a9440');
    ctx.fillStyle = '#3d7a34'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 1, 7, 3.2, side * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!pose.lying && lift < 2.2 && mud > 0.25) {
      ctx.fillStyle = 'rgba(74, 58, 32, 0.5)';
      ctx.beginPath(); ctx.ellipse(foot.x, 5, 8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Body: a squat blob in a tunic.
  ctx.save();
  ctx.scale(sq, 1 / sq);
  ctx.fillStyle = '#6f7a45'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -30, 22, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3f4a2a';
  ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(14, -20); ctx.lineTo(10, -8); ctx.lineTo(-10, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Head.
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.ellipse(0, -54, 20, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Eyes on top.
  for (const ex of [-9, 9]) {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, -66, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (pose.expression === 'dead') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 3, -69); ctx.lineTo(ex + 3, -63); ctx.moveTo(ex + 3, -69); ctx.lineTo(ex - 3, -63); ctx.stroke(); ctx.lineWidth = 3; }
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + (pose.expression === 'shock' ? 0 : 2), -65, pose.expression === 'shock' ? 4.5 : 3, 0, Math.PI * 2); ctx.fill(); }
  }
  if (pose.shades) { ctx.fillStyle = INK; ctx.fillRect(-17, -70, 14, 8); ctx.fillRect(3, -70, 14, 8); ctx.fillRect(-3, -68, 6, 2); }
  if (pose.expression === 'grit') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, -68); ctx.lineTo(-4, -72); ctx.moveTo(16, -68); ctx.lineTo(4, -72); ctx.stroke(); }
  // Mouth.
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (pose.expression === 'hype' || pose.expression === 'chill') ctx.arc(0, -50, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (pose.expression === 'shock') { ctx.ellipse(0, -48, 4, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#2c1a1a'; ctx.fill(); }
  else if (pose.expression === 'dead') { ctx.moveTo(-8, -46); ctx.quadraticCurveTo(0, -52, 8, -46); }
  else { ctx.moveTo(-9, -46); ctx.lineTo(9, -46); }
  ctx.stroke();
  if (pose.cigar) {
    ctx.fillStyle = '#7a4a2a'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(6, -50, 22, 6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7a3a'; ctx.beginPath(); ctx.arc(28, -47, 3, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i += 1) {
      const u = (t * 0.45 + i * 0.33) % 1;
      ctx.globalAlpha = 0.5 * (1 - u);
      ctx.fillStyle = '#e4e4ea';
      ctx.beginPath(); ctx.arc(30 + u * 8, -50 - u * 18, 1.6 + u * 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Helmet lags the squash, so it lifts a beat after the foot lands.
  ctx.save();
  const lag = pose.helmetLift + pose.squash * 0.55 + Math.sin(pose.stride * Math.PI * 2 - 0.7) * 0.16;
  ctx.translate(Math.sin(pose.stride * Math.PI * 2) * 3 * pose.squash, -lag * 14);
  ctx.fillStyle = HELMET; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -72, 26, 16, 0, Math.PI, Math.PI * 2); ctx.lineTo(30, -72); ctx.lineTo(-30, -72); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7cf67c'; ctx.font = '900 11px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('$', 0, -76);
  ctx.restore();
  ctx.restore();
  // Arms swing opposite the legs. A phone, a whistle or the bag hangs off the hand.
  if (!pose.lying) {
    for (const side of [-1, 1]) {
      const phase = pose.stride * Math.PI * 2 + (side > 0 ? Math.PI : 0);
      const swing = Math.sin(phase) * (7 + 3 * mud);
      const shoulder = { x: side * 16, y: -40 };
      const holdWhistle = Boolean(pose.whistle) && side > 0;
      const holdBag = pose.bag && side > 0;
      const hand = holdWhistle
        ? { x: 14, y: -50 }
        : holdBag
          ? { x: 28, y: -34 + Math.sin(t * 3) * 3 }
          : { x: side * 30 + swing * 0.45, y: -28 + swing * 0.65 };
      bone(ctx, shoulder, hand, 14, 13, hand.y >= shoulder.y ? -side : side, 5.5, SKIN);
      ctx.fillStyle = SKIN; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hand.x, hand.y, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (pose.phone && side < 0 && !holdWhistle) {
        ctx.save(); ctx.translate(hand.x, hand.y); ctx.rotate(-0.7);
        ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(-4, -8, 8, 13, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pose.expression === 'shock' ? '#ff4d6d' : '#7cf67c';
        ctx.fillRect(-2.4, -5, 4.8, 7);
        ctx.restore();
      }
      if (holdWhistle) {
        ctx.fillStyle = '#d7d7de'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(hand.x + 7, hand.y, 7, 3.2, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
  } else {
    for (const side of [-1, 1]) bone(ctx, { x: side * 12, y: -32 }, { x: side * 28, y: -6 }, 16, 14, -side, 5.5, SKIN);
  }
  if (pose.bag) {
    const swing = Math.sin(pose.stride * Math.PI * 2 - 0.5) * 8 + Math.sin(t * 2) * 2;
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(24, -34);
    ctx.quadraticCurveTo(10 + swing, -14, 30 + swing, -6);
    ctx.quadraticCurveTo(50 + swing * 0.45, -6, 40 + swing * 0.2, -34);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c'; ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', 32 + swing * 0.35, -16);
  }
  ctx.restore();
}

/** The phone's bubble. A long line slides left so the box ends at `right` (clear of the sergeant's face); the tail stays on the phone. */
function bubbleText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alarm: boolean, right: number): void {
  ctx.font = '900 13px Impact, "Arial Black", sans-serif';
  const w = ctx.measureText(text).width + 20;
  const bx = Math.min(x, right - w / 2);
  ctx.fillStyle = alarm ? '#ff4d6d' : '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(bx - w / 2, y - 22, w, 26, 6); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x + 2, y + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = alarm ? '#ffffff' : INK; ctx.textAlign = 'center';
  ctx.fillText(text, bx, y - 4);
}

/** The squad on the field (marching, diving) between the ground and the trench. `enlisted` (a stake in this round) marks your frog. */
export function drawSquad(ctx: CanvasRenderingContext2D, s: Squad, progress: number, tension: number, enlisted: boolean): void {
  const order = [...s.frogs].sort((a, b) => marchPosition(a, progress, s.over.x).y - marchPosition(b, progress, s.over.x).y);
  for (const f of order) {
    if (f.mode === 'marching') {
      const at = marchPosition(f, progress, s.over.x);
      if (s.over.x < 0.02) continue;
      const stride = f.phase % 1;
      const expression = tension > 0.75 ? 'shock' : tension > 0.35 ? 'grit' : 'hype';
      drawFrog(ctx, at.x, at.y, at.scale, { stride, squash: f.squash.x, expression, shades: false, cigar: false, bag: false, helmetLift: tension > 0.75 ? Math.max(0, Math.sin(s.time * 12 + f.seed)) * 0.4 : 0, lying: false, mud: tension, phone: f !== s.frogs[YOURS], time: s.time });
      if (enlisted && f === s.frogs[YOURS]) {
        ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        const ty = at.y - 100 * at.scale - 6 + Math.sin(s.time * 4) * 3;
        ctx.beginPath(); ctx.moveTo(at.x, ty + 10); ctx.lineTo(at.x - 9, ty - 4); ctx.lineTo(at.x + 9, ty - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (f.mode === 'diving') {
      const k = smoothstep(0, 0.75, f.diveAge);
      const x = mix(f.diveFrom.x, f.x, k);
      const y = mix(f.diveFrom.y, TRENCH_FLOOR, k) - Math.sin(k * Math.PI) * 90;
      const scale = mix(0.75, 1, k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI * 0.35 * Math.sin(k * Math.PI)); ctx.translate(-x, -y);
      drawFrog(ctx, x, y, scale, { stride: f.diveAge * 6, squash: 0, expression: 'shock', shades: false, cigar: false, bag: true, helmetLift: 0.6, lying: false, time: s.time });
      ctx.restore();
    } else if (f.mode === 'flung') {
      const k = smoothstep(0, 1.05, f.diveAge);
      const x = mix(f.diveFrom.x, f.x - 8, k);
      const y = mix(f.diveFrom.y, TRENCH_Y + 10, k) - Math.sin(k * Math.PI) * (70 + f.seed * 6);
      const spin = (f.seed % 2 > 1 ? -1 : 1) * k * 2.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.translate(-x, -y);
      drawFrog(ctx, x, y, mix(0.7, 0.95, k), { stride: 0.2, squash: Math.sin(k * Math.PI), expression: k > 0.62 ? 'dead' : 'shock', shades: false, cigar: false, bag: false, helmetLift: 0.15 + k * 1.35, lying: false, time: s.time });
      ctx.restore();
    }
  }
}

/** The trench in the foreground: sandbags, the wall, the duckboards, the sergeant and his phone, and the frogs inside it. Your frog is tagged KIA only when `enlisted`. */
export function drawTrench(ctx: CanvasRenderingContext2D, s: Squad, tension: number, enlisted: boolean): void {
  // Wall and floor.
  ctx.fillStyle = '#4a3b28';
  ctx.fillRect(0, TRENCH_Y, W, 540 - TRENCH_Y);
  ctx.fillStyle = '#3a2d1e';
  ctx.fillRect(0, TRENCH_FLOOR, W, 540 - TRENCH_FLOOR);
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.45)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 34) { ctx.beginPath(); ctx.moveTo(x, TRENCH_FLOOR + 6); ctx.lineTo(x + 20, 540); ctx.stroke(); }
  for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.moveTo(0, TRENCH_Y + 14 + i * 11); ctx.lineTo(W, TRENCH_Y + 12 + i * 11 + Math.sin(i) * 3); ctx.stroke(); }
  // Sandbag lip.
  for (let i = 0; i < 20; i += 1) sandbag(ctx, -10 + i * 50 + (i % 2) * 6, TRENCH_Y - 14 - (i % 2) * 5, 52);
  for (let i = 0; i < 19; i += 1) sandbag(ctx, 15 + i * 50, TRENCH_Y - 4, 52);
  // Frogs in the trench: waiting, safe with the cigar, or KIA.
  const settled = s.dead && s.deadAge > 1.05;
  for (const f of s.frogs) {
    const yours = f === s.frogs[YOURS];
    if (f.mode === 'trench') {
      const peek = 1 - s.over.x;
      if (peek < 0.02) continue;
      drawFrog(ctx, f.x, TRENCH_FLOOR + 8 + 40 * (1 - peek), 1, { stride: s.time * 1.1 + f.seed, squash: 0, expression: 'grit', shades: false, cigar: false, bag: false, helmetLift: 0, lying: false, mud: 0.5, phone: f.seed > 8, time: s.time });
    } else if (f.mode === 'safe') {
      drawFrog(ctx, f.x, TRENCH_FLOOR + 8, 1, { stride: s.time * 0.7, squash: 0, expression: 'chill', shades: true, cigar: true, bag: true, helmetLift: clamp(f.clang.x, 0, 1.5), lying: false, time: s.time, mud: 0.15 });
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(f.x - 58, TRENCH_FLOOR + 20, 116, 24, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '900 12px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('SURVIVED THE TRENCHES', f.x, TRENCH_FLOOR + 37);
      if (Math.abs(f.clang.v) > 4) { ctx.fillStyle = '#ffffff'; ctx.font = '900 16px Impact, "Arial Black", sans-serif'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText('CLANG', f.x + 40, TRENCH_FLOOR - 74); ctx.fillText('CLANG', f.x + 40, TRENCH_FLOOR - 74); }
    } else if (f.mode === 'dead' && settled) {
      drawFrog(ctx, f.x - 30, TRENCH_FLOOR - 8, 0.9, { stride: 0.5, squash: 0, expression: 'dead', shades: false, cigar: false, bag: false, helmetLift: 0, lying: true });
      if (yours && enlisted) { ctx.fillStyle = '#ff4d6d'; ctx.font = '900 14px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText('KIA', f.x + 10, TRENCH_FLOOR + 2); ctx.fillText('KIA', f.x + 10, TRENCH_FLOOR + 2); }
    }
  }
  // The sergeant and the field phone on the right.
  const sx = 880;
  const sergeantDown = s.dead && s.deadAge > 1.05;
  drawFrog(ctx, sx, sergeantDown ? TRENCH_FLOOR - 14 : TRENCH_FLOOR + 8, 1.05, { stride: s.dead ? 0 : s.time * 1.3, squash: 0, expression: s.dead ? (sergeantDown ? 'dead' : 'shock') : tension > 0.6 ? 'shock' : 'grit', shades: false, cigar: !s.dead, bag: false, helmetLift: 0, lying: sergeantDown, whistle: s.whistle.x > 0.15 && !s.dead, time: s.time });
  ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx - 34, TRENCH_FLOOR - 40); ctx.lineTo(sx - 20, TRENCH_FLOOR - 44); ctx.lineTo(sx - 20, TRENCH_FLOOR - 34); ctx.lineTo(sx - 34, TRENCH_FLOOR - 32); ctx.closePath(); ctx.fill(); ctx.stroke();
  const px = 800;
  const shake = clamp(s.ring.x, 0, 1) * Math.sin(s.time * 60) * 3;
  ctx.save(); ctx.translate(px, TRENCH_FLOOR - 12);
  ctx.fillStyle = '#3d4a2a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-28, -22, 56, 34, 4); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(shake, 0); ctx.rotate(shake * 0.05);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-22, -32, 44, 10, 5); ctx.fill();
  ctx.beginPath(); ctx.arc(-18, -28, 7, 0, Math.PI * 2); ctx.arc(18, -28, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(22, -6); ctx.quadraticCurveTo(50, 10, 70, -20); ctx.stroke();
  ctx.fillStyle = '#c9c9d4'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('FIELD PHONE', 0, 4);
  ctx.restore();
  if (s.bubbleAge < 2.4 && s.bubble) bubbleText(ctx, s.bubble, px, TRENCH_FLOOR - 58 - (s.bubbleAge < 0.2 ? (0.2 - s.bubbleAge) * 40 : 0), s.dead, sx - 42);
  // The whistle at the start.
  if (s.whistle.x > 0.05) {
    ctx.save(); ctx.globalAlpha = clamp(s.whistle.x, 0, 1);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 22px Impact, "Arial Black", sans-serif'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.textAlign = 'center';
    const wy = TRENCH_FLOOR - 92 - s.whistle.x * 10;
    ctx.strokeText('PHWEEEET', sx - 90, wy); ctx.fillText('PHWEEEET', sx - 90, wy);
    ctx.restore();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, TRENCH_FLOOR); ctx.lineTo(W, TRENCH_FLOOR); ctx.stroke();
}
