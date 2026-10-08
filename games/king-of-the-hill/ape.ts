/**
 * The ape: the degen pushing the coin. Feet trudge on the slope through
 * two-bone legs, hands ride the rim through two-bone arms, the body leans
 * harder as the hill steepens, and planted feet brace against bumps. A cashout has
 * him let go and celebrate where he stands until the Lambo pulls up, then hop in;
 * the crash has him let go, lean back and throw his hands up as the coin comes
 * back down (the brace), then squashes him into a pancake. An ape who already
 * cashed out dives clear toward the camera instead (the dodge).
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { type Camera, type Point, heightAt, slopeAngle, toScreen } from './hill';
import { createGait, stepGait, type Gait } from './gait';

const INK = '#1c1f26';
const FUR = '#827066';
const FUR_LIGHT = '#bca48a';
const MUZZLE = '#d9b99b';

export type ApeMode = 'push' | 'exit' | 'boarding' | 'dodge' | 'brace' | 'gone' | 'pancake';
/** How long the coin takes to squash him flat once it reaches him (scene time, so it runs slow after the hit-stop). */
export const SQUASH_S = 0.12;
/** How long the dive out of the picture takes. */
export const DODGE_S = 0.6;

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
  /** Where he stands once he lets go (bracing or cashing out), world x: the coin no longer carries him. */
  braceX: number;
  /** When his hands started up at the crash, so they stay up through the squash. */
  raiseAt: number;
  releasedHands: [Point, Point] | null;
}

export interface ApeDrive { anchor: ApeAnchor; walking: boolean; fear: number; bump: boolean }

export function createApe(): ApeState {
  return { mode: 'push', time: 0, modeAge: 0, gait: createGait(), lean: spring(0), slip: spring(0), eyeOpen: spring(1), mouthOpen: spring(0.1), brow: spring(0), blinkAt: 2.4, fear: 0, pancakeX: 0, braceX: 0, raiseAt: 0, releasedHands: null };
}

export function resetApe(a: ApeState): void {
  a.mode = 'push';
  a.releasedHands = null;
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
  // Once he lets go he stands where he is, but a foot caught mid-step still comes down.
  stepGait(a.gait, a.mode === 'push' ? apeBaseX(drive.anchor, a.slip.x) : a.braceX, a.mode === 'push' && drive.walking, dt);
  // A larger lean raises the shoulders off the coin: he rears back to brace, and stands tall to celebrate.
  stepSpring(a.lean, a.mode === 'push' ? 0.35 + 0.5 * drive.fear : a.mode === 'brace' ? 1.05 : a.mode === 'exit' ? 0.95 : 0, a.mode === 'brace' ? 14 : 6, 0.6, dt);
  const shock = a.mode === 'pancake' || a.mode === 'brace';
  const cheer = a.mode === 'exit' || a.mode === 'boarding' || a.mode === 'dodge';
  const blinking = a.time > a.blinkAt && a.time < a.blinkAt + 0.13;
  if (a.time >= a.blinkAt + 0.13) a.blinkAt = a.time + 2.2 + 2.6 * noise(a.blinkAt);
  stepSpring(a.eyeOpen, shock ? 1.6 : blinking ? 0.08 : cheer ? 1.1 : 1 + 0.3 * drive.fear, 24, 0.9, dt);
  stepSpring(a.mouthOpen, shock || cheer ? 1 : 0.1 + 0.6 * drive.fear, 12, 0.8, dt);
  stepSpring(a.brow, shock ? 1 : cheer ? -0.4 : drive.fear, 10, 0.8, dt);
}

/** World anchor points for the rig behind the coin. */
export interface ApeAnchor { contactX: number; centre: Point; r: number }

/** Keep his distance behind the coin along the slope, not horizontally across a steep cliff. */
export const apeBaseX = (anchor: ApeAnchor, slip = 0): number => anchor.contactX - (anchor.r + 44 + slip) * Math.cos(slopeAngle(anchor.contactX));

/** Grip points rotate with the hill's tangent so the arms still reach the downhill side of the rim. */
export function apeHands(anchor: ApeAnchor): [Point, Point] {
  const slope = slopeAngle(anchor.contactX);
  return [0.5, -0.12].map(angle => {
    const along = -Math.cos(angle) * anchor.r;
    const normal = Math.sin(angle) * anchor.r;
    return { x: anchor.centre.x + Math.cos(slope) * along - Math.sin(slope) * normal, y: anchor.centre.y + Math.sin(slope) * along + Math.cos(slope) * normal };
  }) as [Point, Point];
}

/** He lets go where he stands, his hands starting from the grips they had. */
function letGo(a: ApeState, anchor: ApeAnchor, mode: ApeMode): void {
  a.releasedHands = apeHandPose(a, anchor);
  if (a.mode === 'push') a.braceX = apeBaseX(anchor, a.slip.x);
  a.mode = mode;
  a.modeAge = 0;
}

/** The dev sold: he lets go, rears back and throws his hands up at what is coming back down. */
export function brace(a: ApeState, anchor: ApeAnchor): void {
  letGo(a, anchor, 'brace');
  a.raiseAt = a.time;
  a.lean.v += 5;
}

/** The cashout: he lets go of the coin at once and celebrates where he stands while the Lambo pulls up. */
export function exitApe(a: ApeState, anchor: ApeAnchor): void {
  letGo(a, anchor, 'exit');
}

/** He already cashed out when the dev sells: he dives clear, toward the camera. */
export function dodgeApe(a: ApeState, anchor: ApeAnchor): void {
  letGo(a, anchor, 'dodge');
}

/** Capture the grips (or the celebration) before moving into the car. */
export function boardApe(a: ApeState, anchor: ApeAnchor): void {
  letGo(a, anchor, 'boarding');
}

/** The coin reaches him: a squash into the pancake, or (`settled`) the pancake already lying there. */
export function flattenApe(a: ApeState, x: number, settled: boolean): void {
  a.mode = 'pancake';
  a.modeAge = settled ? 10 : 0;
  a.pancakeX = x;
  if (settled) a.braceX = x + 8;
}

/** Shared placement for the hips, planted soles and ankles, including the cashout hop. */
export function apeFooting(a: ApeState, anchor: ApeAnchor) {
  const baseX = a.mode === 'push' ? apeBaseX(anchor, a.slip.x) : a.braceX;
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
    const x = foot.x + (a.mode === 'push' ? 0 : baseX - (a.gait.baseX ?? baseX));
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
  // Keep support contacts fixed when a quick setback outruns a swing: the pelvis
  // yields into the overlap of the two leg-reach circles instead of stretching a shin.
  for (let pass = 0; pass < 4; pass++) for (const [i, foot] of feet.entries()) {
    const root = add(hip, i === 0 ? -6 : 6, 0);
    const dx = root.x - foot.ankle.x, dy = root.y - foot.ankle.y, distance = Math.hypot(dx, dy);
    if (distance > 87.9) { const excess = 1 - 87.9 / distance; hip.x -= dx * excess; hip.y -= dy * excess; }
  }
  const shoulder = add(hip, 50 * Math.cos(a.lean.x) - 6, 42 + 26 * Math.sin(a.lean.x));
  return { hip, feet, slope, add, boarding, shoulder, head: add(shoulder, 24, 26) };
}

/** Continuous world-space hand paths from the last actual grip. */
export function apeHandPose(a: ApeState, anchor: ApeAnchor): [Point, Point] {
  if (a.mode === 'push' || a.mode === 'gone') return apeHands(anchor);
  const { hip, add, shoulder } = apeFooting(a, anchor);
  let targets: Point[];
  let blend: number;
  if (a.mode === 'boarding') {
    targets = [add(hip, -20, 60), add(hip, 10, 64)];
    blend = smoothstep(0, .18, a.modeAge);
  } else if (a.mode === 'exit' || a.mode === 'dodge') {
    // Taking profits: arms up in a V against the sky (not the slope), the near fist pumping; diving clear, arms out.
    const pump = a.mode === 'exit' ? Math.sin(a.modeAge * 13) * 10 : 0;
    targets = a.mode === 'exit' ? [{ x: shoulder.x - 52, y: shoulder.y + 98 }, { x: shoulder.x + 44, y: shoulder.y + 100 + pump }] : [add(shoulder, -40, 40), add(shoulder, -30, 52)];
    blend = smoothstep(0, a.mode === 'exit' ? .2 : .12, a.modeAge);
  } else {
    // Bracing (and through the squash): hands thrown up, waving.
    blend = smoothstep(0, .18, a.time - a.raiseAt);
    const wave = Math.sin(a.time * 22) * 6 * blend;
    targets = [add(shoulder, -26 + wave, 60 * blend + 10), add(shoulder, 10 - wave, 66 * blend + 12)];
  }
  const from = a.releasedHands ?? apeHands(anchor);
  return targets.map((target, i) => ({ x: mix(from[i]!.x, target.x, blend), y: mix(from[i]!.y, target.y, blend) })) as [Point, Point];
}

/** How far the coin's rim is from his torso, head or hands: it has reached him once this is zero or less. */
export function apeGap(a: ApeState, anchor: ApeAnchor, centre: Point, r: number): number {
  const { hip, shoulder, head } = apeFooting(a, anchor);
  const dx = shoulder.x - hip.x, dy = shoulder.y - hip.y;
  const t = clamp(((centre.x - hip.x) * dx + (centre.y - hip.y) * dy) / (dx * dx + dy * dy), 0, 1);
  const torso = Math.hypot(centre.x - hip.x - dx * t, centre.y - hip.y - dy * t) - 28;
  const near = (p: Point, radius: number): number => Math.hypot(centre.x - p.x, centre.y - p.y) - radius;
  return Math.min(torso, near(head, 22), ...apeHandPose(a, anchor).map((h) => near(h, 9))) - r;
}

/** Where the YOU tag points: his head, squashed down with him onto the pancake. */
export function apeHead(a: ApeState, anchor: ApeAnchor): Point {
  const k = a.mode === 'pancake' ? 1 - (1 - clamp(a.modeAge / SQUASH_S, 0, 1)) ** 2 : 0;
  const flat = { x: a.pancakeX, y: heightAt(a.pancakeX) - 6 };
  if (k >= 1) return flat;
  const head = apeFooting(a, anchor).head;
  return k === 0 ? head : { x: mix(head.x, flat.x, k), y: mix(head.y, flat.y, k) };
}

/** Keep the combined character/coin envelope inside the safe picture while springs follow it. */
export function frameApe(camera: Camera, a: ApeState, anchor: ApeAnchor): Camera {
  const { hip, feet, head } = apeFooting(a, anchor);
  const points = [hip, head, ...feet.map(f => f.sole), ...apeHandPose(a, anchor),
    { x: anchor.centre.x - anchor.r, y: anchor.centre.y - anchor.r }, { x: anchor.centre.x + anchor.r, y: anchor.centre.y + anchor.r }];
  const minX = Math.min(...points.map(p => p.x)) - 24, maxX = Math.max(...points.map(p => p.x)) + 24;
  const minY = Math.min(...points.map(p => p.y)) - 20, maxY = Math.max(...points.map(p => p.y)) + 24;
  return { x: clamp(camera.x, maxX - 390, minX + 390), y: clamp(camera.y, maxY - 205, minY + 195) };
}

export function drawApe(ctx: CanvasRenderingContext2D, cam: Camera, a: ApeState, anchor: ApeAnchor, reduced = false): void {
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
  /** The pancake, jiggling to rest after the squash hands over to it. */
  function pancake(alpha: number) {
    const x = a.pancakeX;
    const p = S({ x, y: heightAt(x) });
    const age = Math.max(0, a.modeAge - SQUASH_S);
    const jiggle = Math.exp(-age * 7) * Math.sin(age * 34);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(-slopeAngle(x));
    ctx.scale(1 + 0.1 * jiggle, 1 - 0.35 * jiggle);
    ctx.fillStyle = FUR; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -5, 62, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = MUZZLE;
    ctx.beginPath(); ctx.ellipse(36, -6, 18, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (const ex of [30, 42]) { ctx.beginPath(); ctx.moveTo(ex - 2.5, -9); ctx.lineTo(ex + 2.5, -4); ctx.moveTo(ex + 2.5, -9); ctx.lineTo(ex - 2.5, -4); ctx.stroke(); }
    ctx.restore();
  }
  const squash = a.mode === 'pancake' ? clamp(a.modeAge / SQUASH_S, 0, 1) : 0;
  if (squash >= 1) {
    pancake(1);
    ctx.restore();
    return;
  }
  if (a.mode === 'dodge') {
    // The dive: he grows toward the camera, rolls back and drops out of the bottom of the picture (under reduced
    // motion he just fades out where he stands).
    const k = smoothstep(0, DODGE_S, a.modeAge);
    if (reduced) ctx.globalAlpha = 1 - k;
    else {
      const g = S(apeFooting(a, anchor).hip);
      ctx.translate(g.x - 60 * k, g.y + 420 * k * k); ctx.rotate(-0.9 * k); ctx.scale(1 + 0.8 * k, 1 + 0.8 * k); ctx.translate(-g.x, -g.y);
    }
  }
  if (squash > 0) {
    // Crushed about his footing: flatter across the slope and wider along it, most of it in the first instant,
    // with the pancake fading in underneath to take over.
    if (squash > 0.5) pancake(smoothstep(0.5, 1, squash));
    const k = 1 - (1 - squash) ** 2;
    const g = S({ x: a.braceX, y: heightAt(a.braceX) });
    const angle = slopeAngle(a.braceX);
    ctx.translate(g.x, g.y); ctx.rotate(-angle); ctx.scale(1 + 0.4 * k, 1 - 0.88 * k); ctx.rotate(angle); ctx.translate(-g.x, -g.y);
  }
  const { hip, feet, slope, add, boarding, shoulder, head } = apeFooting(a, anchor);
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
  const hands = apeHandPose(a, anchor);
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
