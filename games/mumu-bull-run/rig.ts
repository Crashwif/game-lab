import { box, clamp, CREAM, GOLD, GREEN, INK, line, oval, poly, RED, shape, TAU, text } from './art';
import { hoofAt, type BullPose } from './motion';

type Point = { x: number; y: number };
/** The body centre's rest height above the hooves; the hips sit low inside the belly. */
const BODY_Y = -98;
const HIP_Y = 30;
const UPPER = 34;
const LOWER = 37;
function bodyPoint(p: BullPose, x: number, y: number): Point {
  return { x: x * Math.cos(p.pitch) - y * Math.sin(p.pitch), y: BODY_Y + p.body + x * Math.sin(p.pitch) + y * Math.cos(p.pitch) };
}

/**
 * A two-bone leg: the hip follows the pitching, bouncing body while the hoof holds its ground target.
 * The fore knee bends forward and the hind hock bends back, as on a bull; the stance leg is nearly
 * straight and the swing leg folds. The hoof hangs toe-down while it is in the air.
 */
function leg(c: CanvasRenderingContext2D, p: BullPose, hipX: number, phase: number, far: boolean): void {
  const hip = bodyPoint(p, hipX, HIP_Y);
  const target = hoofAt(p, hipX, phase);
  const dx = target.x - hip.x, dy = target.y - 8 - hip.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const ux = dx / distance, uy = dy / distance;
  const reach = clamp(distance, Math.abs(LOWER - UPPER) + 0.01, UPPER + LOWER - 0.01);
  const ankle = { x: hip.x + ux * reach, y: hip.y + uy * reach };
  const along = (UPPER * UPPER - LOWER * LOWER + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, UPPER * UPPER - along * along)) * (hipX > 0 ? 1 : -1);
  const knee = { x: hip.x + ux * along + uy * bend, y: hip.y + uy * along - ux * bend };
  const fill = far ? '#809e8c' : '#f6f2d9';
  line(c, [[hip.x, hip.y], [knee.x, knee.y], [ankle.x, ankle.y]], INK, far ? 22 : 26);
  line(c, [[hip.x, hip.y], [knee.x, knee.y], [ankle.x, ankle.y]], fill, far ? 14 : 18);
  oval(c, knee.x, knee.y, 9, 8, fill, 3);
  const lifted = clamp(-(target.y + target.x * 0.047) / 36);
  c.save(); c.translate(ankle.x, ankle.y); c.rotate(lifted * 0.55);
  box(c, -15, -3, 32, 16, INK, 5, 3);
  line(c, [[6, -2], [6, 8]], '#607365', 2);
  c.restore();
}

/** One horn, rising from the crown at x=37 and curving outward; `side` is -1 for the back horn and 1 for the front. */
const HORN: readonly (readonly [number, number])[] = [[-2, -46], [-28, -34], [-50, -60], [-56, -92], [-40, -80], [-26, -58]];
function horn(c: CanvasRenderingContext2D, side: -1 | 1): void {
  poly(c, HORN.map(([dx, y]) => [37 + dx * side, y] as const), GOLD, 4);
}

function head(c: CanvasRenderingContext2D, p: BullPose): void {
  c.save(); c.translate(61, -25); c.rotate(p.head);
  // Both ears and both horns sit behind the skull. The horns are one shape mirrored about the crown,
  // so they match in size; their bases hide under the skull and neither crosses the face.
  oval(c, -1, -18, 18, 9, CREAM, 4, -0.4);
  horn(c, -1);
  horn(c, 1);
  oval(c, 96, -12, 17, 9, CREAM, 4, 0.5);
  oval(c, 100, -11, 9, 4, '#efb9a3', 0, 0.5);
  c.beginPath(); c.moveTo(2, -35); c.bezierCurveTo(15, -65, 57, -67, 72, -36); c.bezierCurveTo(91, -1, 63, 33, 25, 24); c.bezierCurveTo(-8, 19, -9, -13, 2, -35); c.closePath(); shape(c, '#fff9df', 5);
  const angry = p.face === 'charge', panic = p.face === 'panic', victory = p.face === 'victory';
  if (victory) {
    box(c, 18, -34, 46, 21, INK, 5, 2);
    line(c, [[21, -30], [33, -19]], '#83f59c', 3);
    line(c, [[39, -29], [51, -18]], '#83f59c', 3);
  } else {
    oval(c, 39, -25, 13, panic ? 16 : 12, '#fff', 3);
    oval(c, panic ? 44 : 42, -23, panic ? 4 : 5, panic ? 5 : 7, INK, 0);
    line(c, [[25, angry ? -43 : -40], [49, angry ? -32 : -39]], INK, 6);
    if (!angry && !panic) { poly(c, [[26, -36], [50, -36], [50, -25], [26, -30]], '#fff9df', 0); line(c, [[26, -30], [50, -25]], INK, 3); }
  }
  oval(c, 52, 8, 43, 27, '#284135', 5, -0.12);
  const nostril = 5 + p.snort * 5;
  oval(c, 36, 0, nostril, nostril * 0.8, '#09140e', 0);
  oval(c, 69, -3, nostril, nostril * 0.8, '#09140e', 0);
  if (panic) {
    oval(c, 52, 22, 12, 9, INK, 0);
    box(c, 45, 15, 13, 6, CREAM, 1, 0);
  } else {
    c.strokeStyle = CREAM; c.lineWidth = 3; c.beginPath(); c.moveTo(30, 17); c.quadraticCurveTo(53, 38 - p.snort * 4, 75, 15); c.stroke();
    box(c, 58, 21, 10, 7, CREAM, 1, 0);
  }
  if (p.snort > 0) {
    for (let i = 0; i < 4; i += 1) {
      const u = ((p.time * 3.6 + i * 0.23) % 1);
      c.globalAlpha = (1 - u) * p.snort * 0.85;
      oval(c, 91 + u * 67, -3 - u * 24 + i * 3, 8 + u * 14, 5 + u * 9, '#f4e9bf', 0);
    }
    c.globalAlpha = 1;
  }
  if (p.face === 'support') {
    c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.arc(31, -19, 32, Math.PI, TAU - 0.2); c.stroke();
    box(c, -6, -23, 17, 25, '#9aabb0', 5, 3);
    line(c, [[4, -3], [12, 20], [28, 23]], INK, 4); oval(c, 30, 23, 7, 4, INK, 0);
  }
  c.restore();
}

/** The head hinges independently; scarf and tail lag the gallop instead of moving as one cutout. */
export function bull(c: CanvasRenderingContext2D, p: BullPose): void {
  c.save(); c.translate(p.x, p.y); c.scale(p.scale, p.scale);
  oval(c, 8, 7, 111, 10, '#091d164d', 0);
  leg(c, p, -62, 0.08, true);
  leg(c, p, 60, 0.66, true);
  c.save(); c.translate(0, BODY_Y + p.body); c.rotate(p.pitch);
  const tailWave = (p.gait === 'run' ? Math.sin(p.stride * TAU - 2.2) * 17 : Math.sin(p.time * 7 - 1.3) * 12);
  c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(-83, -12); c.bezierCurveTo(-145, -14 + tailWave, -117, -84 - tailWave * 0.5, -161, -62 + tailWave); c.stroke();
  oval(c, -161, -62 + tailWave, 12, 6, INK, 0, -0.5);
  c.beginPath(); c.moveTo(-91, -28); c.bezierCurveTo(-114, 3, -82, 50, -38, 47); c.bezierCurveTo(9, 54, 72, 38, 85, 8); c.bezierCurveTo(108, -27, 46, -81, 12, -63); c.bezierCurveTo(-19, -45, -64, -49, -91, -28); c.closePath(); shape(c, '#fff8df', 5);
  c.beginPath(); c.moveTo(-82, 18); c.bezierCurveTo(-29, 44, 33, 35, 79, -1); c.bezierCurveTo(66, 53, -50, 69, -82, 18); shape(c, '#c1ceb2', 0);
  line(c, [[-62, -27], [-39, -39], [-12, -39]], '#ffffff', 7);
  text(c, 'MUMU', -21, 1, 23, '#6c8c68', 'center', 89);
  const drag = (p.gait === 'run' ? Math.sin(p.stride * TAU - 2.6) * 11 : Math.sin(p.time * 4) * 4);
  poly(c, [[58, -22], [15, -40], [-32, -28 + drag], [-58, -43 + drag], [-46, -14 + drag], [-26, -17 + drag], [25, -22], [57, -4]], GREEN, 3);
  poly(c, [[54, -5], [13, -6], [-30, 9 + drag * 0.5], [-44, -7 + drag], [-21, -14 + drag], [48, -19]], '#0e935e', 3);
  head(c, p);
  oval(c, 54, -6, 9, 9, GOLD, 3);
  c.restore();
  leg(c, p, -61, 0, false);
  leg(c, p, 64, 0.58, false);
  c.restore();
}

export interface BearPose { x: number; y: number; scale?: number; time: number; panic?: number; gesture?: number; suit?: string; tilt?: number; headphones?: boolean; crown?: boolean }
export function bear(c: CanvasRenderingContext2D, p: BearPose): void {
  const panic = p.panic ?? 0, gesture = p.gesture ?? 0;
  c.save(); c.translate(p.x, p.y); c.rotate(p.tilt ?? 0); c.scale(p.scale ?? 1, p.scale ?? 1);
  const legPhase = Math.sin(p.time * 8) * panic;
  line(c, [[-16, -31], [-21 - legPhase * 13, -10], [-26 - legPhase * 13, 0]], INK, 13);
  line(c, [[17, -31], [21 + legPhase * 13, -10], [29 + legPhase * 13, 0]], INK, 13);
  oval(c, 0, -57, 38, 39, p.suit ?? '#966547', 4);
  poly(c, [[-29, -82], [0, -51], [28, -82], [33, -36], [-28, -35]], p.suit ?? '#6a6884', 3);
  poly(c, [[-7, -73], [8, -73], [3, -43]], GOLD, 2);
  const handY = -61 - gesture * 43 - panic * 36;
  line(c, [[-29, -70], [-46, -58 - gesture * 15], [-60, handY]], INK, 13);
  line(c, [[31, -70], [46, -60 - gesture * 10], [60, handY + Math.sin(p.time * 5) * (7 + panic * 15)]], INK, 13);
  oval(c, -60, handY, 10, 11, '#c08756', 3); oval(c, 60, handY + Math.sin(p.time * 5) * (7 + panic * 15), 10, 11, '#c08756', 3);
  const headBob = Math.sin(p.time * 3) * 3;
  c.save(); c.translate(0, -100 + headBob); c.rotate(-gesture * 0.08 + panic * Math.sin(p.time * 8) * 0.2);
  oval(c, -25, -22, 13, 14, '#9e633f', 4); oval(c, 26, -22, 13, 14, '#9e633f', 4);
  oval(c, 0, 0, 36, 31, '#be8a57', 4); oval(c, 4, 12, 21, 15, '#e0bc86', 3);
  oval(c, 6, 5, 8, 5, INK, 0);
  for (const ex of [-13, 16]) {
    oval(c, ex, -8, 7, panic ? 10 : 6, CREAM, 2);
    oval(c, ex + (panic ? 0 : 2), -7, 3, panic ? 5 : 3, INK, 0);
    line(c, [[ex - 7, panic ? -24 : -20], [ex + 7, panic ? -21 : -12]], INK, 3);
  }
  if (panic) oval(c, 6, 22, 8, 9, INK, 0);
  else { line(c, [[-4, 20], [6, 25], [17, 17]], INK, 3); }
  if (p.headphones) { c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.arc(0, -1, 40, Math.PI, TAU); c.stroke(); box(c, -43, -10, 13, 28, RED, 4, 3); box(c, 31, -10, 13, 28, RED, 4, 3); }
  if (p.crown) poly(c, [[-25, -30], [-31, -57], [-12, -46], [0, -66], [14, -46], [28, -57], [24, -30]], GOLD, 3);
  c.restore(); c.restore();
}
