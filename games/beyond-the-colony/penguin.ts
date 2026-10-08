import { clamp, fract, limb, TAU, type Point } from './motion';
import { box, CORAL, ellipse, GOLD, INK, line, polygon, WHITE, words } from './drawing';

export type Mood = 'bored' | 'defiant' | 'panic' | 'smug' | 'cosmic' | 'dazed';
export interface PenguinPose {
  x: number; y: number; time: number; gait: number; walk: boolean;
  angle: number; crouch: number; stretch: number; airborne: boolean;
  arm: number; head: number; mood: Mood; scarf: number; scale: number;
  reduced: boolean; aura?: number; paper?: boolean; look?: number;
}

interface Foot extends Point { tilt: number }
/** Grounded stance is linear against the belt speed; the returning foot clears the ice toe-up on a high arc. */
function footAt(phase: number, walk: boolean, airborne: boolean, side: number): Foot {
  const p = fract(phase);
  if (airborne) return { x: side * 30, y: -16 - Math.sin(p * TAU) * 10, tilt: .55 };
  if (!walk) return { x: side * 24, y: 0, tilt: 0 };
  if (p < .62) return { x: 31 - p / .62 * 62, y: 0, tilt: 0 };
  const u = (p - .62) / .38;
  return { x: -31 + 62 * (1 - Math.cos(u * Math.PI)) / 2, y: -Math.sin(u * Math.PI) * 25, tilt: -Math.sin(u * Math.PI) * .4 };
}
const THIGH = 26;
const SHIN = 28;
/** Both knees bend forward; the stance leg is nearly straight and the swing leg folds under the body. */
function leg(c: CanvasRenderingContext2D, root: Point, foot: Foot, far: boolean): void {
  const { joint: knee, end } = limb(root, { x: foot.x, y: foot.y - 4 }, THIGH, SHIN, 1);
  line(c, [[root.x, root.y], [knee.x, knee.y], [end.x, end.y]], INK, far ? 13 : 16);
  line(c, [[root.x, root.y], [knee.x, knee.y], [end.x, end.y]], far ? '#c37d56' : GOLD, far ? 8 : 10);
  c.save(); c.translate(end.x, end.y + 4); c.rotate(foot.tilt);
  polygon(c, [[-14, -6], [9, -9], [26, -3], [20, 3], [-15, 2]], far ? '#d88f59' : '#f8b875', 3);
  line(c, [[8, -5], [11, 0]], '#b9784f', 1.5); line(c, [[17, -3], [19, 0]], '#b9784f', 1.5); c.restore();
}
function flipper(c: CanvasRenderingContext2D, x: number, y: number, angle: number, near: boolean): void {
  c.save(); c.translate(x, y); c.rotate(angle);
  c.beginPath(); c.moveTo(-10, -4); c.bezierCurveTo(-31, 9, -29, 50, -6, 75); c.quadraticCurveTo(9, 83, 10, 60); c.quadraticCurveTo(18, 22, 8, 0); c.closePath();
  c.fillStyle = near ? '#24495b' : '#0a2437'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  line(c, [[-14, 12], [-17, 31], [-10, 52]], near ? '#456f7c' : '#1c3c4b', 2); c.restore();
}

/** All joints inherit the pelvis transform; the head and scarf trail each large change in pose. */
export function penguin(c: CanvasRenderingContext2D, p: PenguinPose): void {
  const time = p.reduced ? 0 : p.time;
  const gait = p.reduced ? 0 : p.gait;
  const waddle = p.walk && !p.reduced ? Math.sin(gait * TAU) * .105 : 0;
  const bob = p.walk && !p.airborne && !p.reduced ? -Math.abs(Math.sin(gait * TAU)) * 7 : 0;
  const breath = p.reduced ? 0 : Math.sin(time * 2.3) * 2.6;
  const squash = 1 + p.crouch * .22;
  c.save(); c.translate(p.x, p.y);
  if (!p.airborne && Math.abs(p.angle) < .4) ellipse(c, 0, 5, 61 * p.scale, 9, 'rgba(0,21,35,.27)');
  c.translate(0, -81 * p.scale); c.rotate(p.angle + waddle); c.scale(p.scale * squash, p.scale / squash * (1 + p.stretch * .16)); c.translate(0, 81);
  const footL = footAt(gait + .5, p.walk, p.airborne, -1);
  const footR = footAt(gait, p.walk, p.airborne, 1);
  leg(c, { x: -12, y: -41 + p.crouch * 12 }, footL, true);
  const bodyY = bob + breath + p.crouch * 15;
  c.save(); c.translate(0, bodyY);
  const wing = p.arm + (p.walk ? Math.sin(gait * TAU) * .56 : Math.sin(time * 2.8) * .09);
  flipper(c, 29, -116, -wing - (p.airborne ? 1.25 : .2), false);

  // The backpack and bedroll lag behind the shoulders, with a dangling resignation letter.
  c.save(); c.translate(-43, -82); c.rotate(-.2 - Math.sin(time * 7 - .6) * (p.walk ? .1 : .025));
  box(c, -21, -34, 30, 68, '#527468', 12, 3);
  line(c, [[-12, -28], [-12, 25]], '#b7cba0', 4);
  box(c, -24, -43, 40, 15, '#c3c796', 7, 3);
  line(c, [[-12, -43], [-12, -29]], '#6d8667', 3); line(c, [[5, -43], [5, -29]], '#6d8667', 3);
  c.save(); c.translate(-15, 29); c.rotate(Math.sin(time * 8) * .18); box(c, -10, 0, 22, 30, WHITE, 1, 2); words(c, 'BYE', 1, 13, 11, INK, 19); c.restore(); c.restore();

  const body = c.createLinearGradient(-48, -126, 49, -38);
  body.addColorStop(0, '#385e6d'); body.addColorStop(.6, '#173e51'); body.addColorStop(1, '#082637');
  c.fillStyle = body; c.beginPath(); c.ellipse(0, -82, 50, 63, -.04, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
  ellipse(c, 11, -71, 35, 47, '#e7efd9', -.04);
  ellipse(c, 23, -55, 18, 22, 'rgba(255,255,240,.3)');

  const neckX = 8 + p.head * 9;
  const neckY = -141 + p.head * 4;
  c.save(); c.translate(neckX, neckY); c.rotate(-p.angle * .2 + p.head * .12 + Math.sin(time * 5 - .5) * (p.walk ? .035 : .015));
  ellipse(c, 0, 0, 43, 44, '#102e40', -.08, 3);
  ellipse(c, -9, 4, 21, 29, WHITE, -.15);
  ellipse(c, 23, 5, 21, 29, WHITE, .2);
  const blink = !p.reduced && Math.sin(time * 1.77) > .994;
  const panic = p.mood === 'panic';
  const bored = p.mood === 'bored' || p.mood === 'smug';
  const gaze = p.look ?? 1;
  for (const side of [-1, 1]) {
    const ex = side === -1 ? -12 : 24;
    ellipse(c, ex, -3, panic ? 13 : 10, blink ? 1.5 : panic ? 18 : bored ? 9 : 13, '#fffdf2');
    ellipse(c, ex + gaze * 3.5, blink ? -3 : 0, panic ? 4 : 4.7, blink ? 1 : panic ? 7 : 6, p.mood === 'cosmic' ? '#84f8c7' : INK);
    if (!blink) ellipse(c, ex + gaze * 3.5 + 1, -2, 1.7, 1.7, WHITE);
    const tilt = p.mood === 'defiant' || p.mood === 'cosmic' ? side * -.26 : panic ? side * .22 : side * -.07;
    c.save(); c.translate(ex, panic ? -27 : -18); c.rotate(tilt); line(c, [[-13, 0], [12, 0]], INK, 5); c.restore();
  }
  polygon(c, [[-2, 13], [31, 17], [6, 27], [-7, 23]], '#f8b979', 2);
  if (panic) ellipse(c, 7, 32, 10, 11, '#082737');
  else if (p.mood === 'dazed') { line(c, [[-8, 31], [-2, 35], [5, 31], [13, 35], [21, 31]], INK, 2); }
  else line(c, [[-3, 31], [7, p.mood === 'smug' ? 37 : 33], [21, 29]], INK, 2.5);
  if (p.mood === 'smug') {
    box(c, -27, -12, 27, 20, '#071e2b', 5, 2); box(c, 13, -12, 27, 20, '#071e2b', 5, 2);
    line(c, [[0, -6], [13, -6]], INK, 4); line(c, [[-21, -8], [-12, 3]], '#6d99a0', 2); line(c, [[18, -8], [27, 3]], '#6d99a0', 2);
  }
  c.restore();

  // A travelling wave follows the scarf down its length, behind the moving neck.
  const wind = p.scarf;
  const scarf: [number, number][] = [];
  for (let i = 0; i < 9; i += 1) {
    const u = i / 8;
    scarf.push([-10 - u * (95 + wind * 33), -123 + u * 19 + Math.sin(time * 11 - u * 5) * u * (6 + wind * 8)]);
  }
  for (let i = 8; i >= 0; i -= 1) { const u = i / 8; const [x, y] = scarf[i]!; scarf.push([x + 4, y + 15 - u * 5]); }
  polygon(c, scarf, p.mood === 'cosmic' ? GOLD : CORAL, 3);
  box(c, -30, -126, 76, 18, p.mood === 'cosmic' ? GOLD : CORAL, 7, 3);
  ellipse(c, -20, -117, 12, 11, p.mood === 'cosmic' ? '#ffe9ad' : '#f69a7d', 0, 2);
  flipper(c, -33, -114, wing + (p.airborne ? 1.3 : .15), true);
  if (p.paper) {
    c.save(); c.translate(-69, -50); c.rotate(-.4 + wing * .3); box(c, -18, -28, 45, 56, WHITE, 1, 2);
    words(c, 'NO.', 4, -10, 24, INK, 37); line(c, [[-10, 7], [17, 7]], '#a6b3a6', 2); c.restore();
  }
  c.restore();
  leg(c, { x: 12, y: -40 + p.crouch * 12 }, footR, false);
  c.restore();
}
