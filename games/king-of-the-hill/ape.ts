/**
 * The ape: the degen pushing the coin. Feet trudge on the slope through
 * two-bone legs, hands ride the rim through two-bone arms, the body leans
 * harder as the hill steepens, and planted feet brace against bumps. A cashout hops him
 * into the Lambo; the crash has him let go and throw his hands up as the coin
 * comes back down (the brace), then flattens him into a pancake.
 */
import { type Spring, clamp, noise, settleSpring, spring, stepSpring } from './motion';
import { type Camera, type Point, heightAt, slopeAngle, toScreen } from './hill';
import { createGait, stepGait, type Gait } from './gait';

const INK = '#1c1f26';
const FUR = '#3b2f2f';
const FUR_LIGHT = '#5a4646';
const MUZZLE = '#d9b99b';

export type ApeMode = 'push' | 'boarding' | 'brace' | 'gone' | 'pancake';

export interface ApeState {
  mode: ApeMode;
  time: number;
  modeAge: number;
  gait: Gait;
  lean: Spring;
  slip: Spring;
  eyeOpen: Spring;
  mouthOpen: Spring;
  brow: Spring;
  blinkAt: number;
  fear: number;
  /** Where he was flattened, world x. */
  pancakeX: number;
  /** Where he stands while he braces, world x: the coin no longer carries him. */
  braceX: number;
}

export interface ApeDrive { anchor: ApeAnchor; walking: boolean; fear: number; bump: boolean }

export function createApe(): ApeState {
  return { mode: 'push', time: 0, modeAge: 0, gait: createGait(), lean: spring(0), slip: spring(0), eyeOpen: spring(1), mouthOpen: spring(0.1), brow: spring(0), blinkAt: 2.4, fear: 0, pancakeX: 0, braceX: 0 };
}

export function resetApe(a: ApeState): void {
  a.mode = 'push';
  a.modeAge = 0;
  a.gait = createGait();
  settleSpring(a.lean, 0);
  settleSpring(a.slip, 0);
}

function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + dx / distance * along - dy / distance * bend, y: root.y + dy / distance * along + dx / distance * bend };
}

export function stepApe(a: ApeState, drive: ApeDrive, dt: number): void {
  a.time += dt;
  a.modeAge += dt;
  a.fear = drive.fear;
  if (a.mode === 'push' && drive.bump) a.slip.v += 40;
  stepSpring(a.slip, 0, 8, 0.6, dt);
  if (a.mode === 'push') stepGait(a.gait, drive.anchor.contactX - drive.anchor.r - 44 - a.slip.x, drive.walking, dt);
  stepSpring(a.lean, a.mode === 'push' ? 0.35 + 0.5 * drive.fear : a.mode === 'brace' ? -0.3 : 0, a.mode === 'brace' ? 14 : 6, 0.6, dt);
  const shock = a.mode === 'pancake' || a.mode === 'brace';
  const blinking = a.time > a.blinkAt && a.time < a.blinkAt + 0.13;
  if (a.time >= a.blinkAt + 0.13) a.blinkAt = a.time + 2.2 + 2.6 * noise(a.blinkAt);
  stepSpring(a.eyeOpen, shock ? 1.6 : blinking ? 0.08 : 1 + 0.3 * drive.fear, 24, 0.9, dt);
  stepSpring(a.mouthOpen, shock ? 1 : 0.1 + 0.6 * drive.fear, 12, 0.8, dt);
  stepSpring(a.brow, shock ? 1 : drive.fear, 10, 0.8, dt);
}

/** World anchor points for the rig behind the coin. */
export interface ApeAnchor { contactX: number; centre: Point; r: number }

/** The dev sold: he lets go where he stands and throws his hands up at what is coming back down. */
export function brace(a: ApeState, anchor: ApeAnchor): void {
  a.braceX = anchor.contactX - anchor.r - 44 - a.slip.x;
  a.mode = 'brace';
  a.modeAge = 0;
  a.lean.v -= 4;
}

/** Shared placement for the hips, planted soles and ankles, including the cashout hop. */
export function apeFooting(a: ApeState, anchor: ApeAnchor) {
  const baseX = a.mode === 'brace' ? a.braceX : anchor.contactX - anchor.r - 44 - a.slip.x;
  // Average the footing beneath the body so entering the ramp does not snap the hips.
  const slope = Math.atan2(heightAt(baseX + 18) - heightAt(baseX - 18), 36);
  const along = { x: Math.cos(slope), y: Math.sin(slope) };
  const normal = { x: -Math.sin(slope), y: Math.cos(slope) };
  const add = (p: Point, u: number, v: number): Point => ({ x: p.x + along.x * u + normal.x * v, y: p.y + along.y * u + normal.y * v });
  const base = { x: baseX, y: heightAt(baseX) };
  const boarding = a.mode === 'boarding' ? clamp(a.modeAge / 0.5, 0, 1) : 0;
  const hop = Math.sin(boarding * Math.PI) * 50;
  const hip = add(base, -boarding * 80, 66 + hop);
  const feet = a.gait.feet.map((foot) => {
    const x = foot.x + (a.mode === 'boarding' ? baseX - (a.gait.baseX ?? baseX) : 0);
    const angle = slopeAngle(x);
    const footNormal = { x: -Math.sin(angle), y: Math.cos(angle) };
    const ground = { x, y: heightAt(x) };
    const lifted = { x: ground.x + footNormal.x * foot.lift, y: ground.y + footNormal.y * foot.lift };
    const sole = add(lifted, -boarding * 80, hop);
    return {
      sole, angle, pitch: foot.phase < 1 ? Math.sin(foot.phase * Math.PI * 2) * 0.16 : 0,
      ankle: { x: sole.x + footNormal.x * 8, y: sole.y + footNormal.y * 8 },
    };
  });
  return { hip, feet, slope, add, boarding };
}

export function drawApe(ctx: CanvasRenderingContext2D, cam: Camera, a: ApeState, anchor: ApeAnchor): void {
  if (a.mode === 'gone') return;
  const S = (p: Point): Point => toScreen(cam, p);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  function segment(p: Point, q: Point, width: number, colour: string) {
    const sp = S(p); const sq = S(q);
    ctx.strokeStyle = colour; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sq.x, sq.y); ctx.stroke();
  }
  function limb(root: Point, end: Point, upper: number, lower: number, side: number, width: number, colour: string) {
    const joint = bendJoint(root, end, upper, lower, side);
    segment(root, joint, width + 5, INK); segment(joint, end, width + 5, INK);
    segment(root, joint, width, colour); segment(joint, end, width, colour);
  }
  if (a.mode === 'pancake') {
    const x = a.pancakeX;
    const angle = slopeAngle(x);
    const p = S({ x, y: heightAt(x) });
    ctx.translate(p.x, p.y);
    ctx.rotate(-angle);
    ctx.fillStyle = FUR; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -5, 62, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = MUZZLE;
    ctx.beginPath(); ctx.ellipse(36, -6, 18, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (const ex of [30, 42]) { ctx.beginPath(); ctx.moveTo(ex - 2.5, -9); ctx.lineTo(ex + 2.5, -4); ctx.moveTo(ex + 2.5, -9); ctx.lineTo(ex - 2.5, -4); ctx.stroke(); }
    ctx.restore();
    return;
  }
  const { hip, feet, slope, add, boarding } = apeFooting(a, anchor);
  function drawFoot(index: number, colour: string) {
    const foot = feet[index]!;
    const p = S(foot.sole);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-foot.angle - foot.pitch);
    ctx.fillStyle = colour; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(18, -2);
    ctx.quadraticCurveTo(21, -8, 12, -10); ctx.lineTo(-5, -12);
    ctx.quadraticCurveTo(-13, -12, -11, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  const lean = a.lean.x;
  const shoulder = add(hip, 50 * Math.cos(lean) - 6, 42 + 26 * Math.sin(lean));
  const head = add(shoulder, 24, 26);
  const handA = { x: anchor.centre.x - Math.cos(0.5) * anchor.r, y: anchor.centre.y + Math.sin(0.5) * anchor.r };
  const handB = { x: anchor.centre.x - Math.cos(0.12) * anchor.r, y: anchor.centre.y - Math.sin(0.12) * anchor.r };
  const up = a.mode === 'brace' ? clamp(a.modeAge / 0.18, 0, 1) : 0;
  const wave = Math.sin(a.time * 22) * 6 * up;
  const hands = boarding ? [add(hip, -20, 60), add(hip, 10, 64)] : up > 0 ? [add(shoulder, -26 + wave, 60 * up + 10), add(shoulder, 10 - wave, 66 * up + 12)] : [handA, handB];
  // Far leg, far arm, body, near leg, head, near arm.
  // Knees bend uphill; elbows bend the other way in the y-up world frame.
  limb(add(hip, -6, 0), feet[0]!.ankle, 44, 44, 1, 16, FUR);
  drawFoot(0, FUR);
  limb(add(shoulder, -8, 0), hands[0]!, 60, 62, -1, 15, FUR);
  const sh = S(hip); const ss = S(shoulder);
  ctx.save();
  ctx.translate((sh.x + ss.x) / 2, (sh.y + ss.y) / 2);
  ctx.rotate(Math.atan2(ss.y - sh.y, ss.x - sh.x));
  ctx.beginPath(); ctx.ellipse(0, 0, 44, 34, 0, 0, Math.PI * 2);
  ctx.fillStyle = FUR; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = MUZZLE;
  ctx.beginPath(); ctx.ellipse(6, 8, 24, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  limb(add(hip, 6, 0), feet[1]!.ankle, 44, 44, 1, 18, FUR_LIGHT);
  drawFoot(1, FUR_LIGHT);
  // Head with a gorilla brow and a Wojak's worries.
  const hp = S(head);
  ctx.save();
  ctx.translate(hp.x, hp.y);
  ctx.rotate(-slope * 0.5 + 0.2 * lean);
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fillStyle = FUR; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = MUZZLE;
  ctx.beginPath(); ctx.ellipse(6, 5, 15, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4, -6, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
  const eyeOpen = Math.max(0.1, a.eyeOpen.x);
  for (const ex of [-9, 2]) {
    ctx.beginPath(); ctx.ellipse(ex, -6, 4, 4 * Math.min(1.4, eyeOpen), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + 1.5, -5.5, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  const brow = a.brow.x;
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-15, -13 + brow); ctx.lineTo(-4, -13 - 4 * brow); ctx.moveTo(-2, -13 - 4 * brow); ctx.lineTo(8, -12 + brow); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(9, 2, 1.8, 0, Math.PI * 2); ctx.arc(13, 2, 1.8, 0, Math.PI * 2); ctx.fill();
  const open = clamp(a.mouthOpen.x, 0, 1);
  ctx.beginPath(); ctx.ellipse(6, 11, 5 + 4 * open, 1.5 + 5 * open, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
  if (a.mode === 'push' && a.fear > 0.35) {
    const p = (a.time / 1.1) % 1;
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath(); ctx.arc(-18, -12 + p * 18, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  limb(add(shoulder, 8, 2), hands[1]!, 60, 62, -1, 17, FUR_LIGHT);
  for (const [i, h] of hands.entries()) { const p = S(h); ctx.fillStyle = i ? FUR_LIGHT : FUR; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
