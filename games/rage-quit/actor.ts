import { type Act, type ActorPose, type ActingInput, type HandStyle, type Point, limb } from './acting';
import { box, clamp, GOLD, GREEN, INK, label, line, mug, PAPER, RED, shape } from './ink';

const SKIN = '#fff4d9';
const SHADOW = '#d5b391';
const stroke = (c: CanvasRenderingContext2D, a: Point, b: Point, width: number, color: string) => line(c, [[a.x, a.y], [b.x, b.y]], color, width);

function arm(c: CanvasRenderingContext2D, root: Point, target: Point, pole: number, front: boolean): { elbow: Point; end: Point } {
  const solved = limb(root, target, 112, 111, pole);
  const width = front ? 23 : 19;
  stroke(c, root, solved.elbow, width + 6, INK);
  stroke(c, solved.elbow, solved.end, width + 5, INK);
  stroke(c, root, solved.elbow, width, front ? SKIN : SHADOW);
  stroke(c, solved.elbow, solved.end, width - 1, front ? SKIN : SHADOW);
  const sleeve = { x: root.x + (solved.elbow.x - root.x) * 0.4, y: root.y + (solved.elbow.y - root.y) * 0.4 };
  stroke(c, root, sleeve, width + 11, INK);
  stroke(c, root, sleeve, width + 5, RED);
  line(c, [[solved.elbow.x - 7, solved.elbow.y + 4], [solved.elbow.x + 4, solved.elbow.y + 8]], '#a8755b', 2);
  return solved;
}

/** The far arm's elbow hangs while its hand is low and swings back over the shoulder as the fist rises. */
const backPole = (root: Point, target: Point): number => 1 - 2 * clamp((root.y - target.y - 10) / 70);
/** A hand lies flat at the desk and turns with its forearm as it lifts, so a raised fist points where it swings. */
function handAngle(elbow: Point, end: Point, flat: number): number {
  const along = Math.atan2(end.y - elbow.y, end.x - elbow.x);
  return flat + (along - flat) * clamp((396 - end.y) / 70);
}

function hand(c: CanvasRenderingContext2D, p: Point, angle: number, style: HandStyle, squash = 0): void {
  c.save(); c.translate(p.x, p.y); c.rotate(angle); c.scale(1 + squash, 1 - squash);
  if (style === 'fist') {
    shape(c, [[-14, -10], [-2, -16], [12, -14], [18, -4], [15, 9], [2, 14], [-12, 11]], SKIN, 3);
    for (let i = 0; i < 3; i += 1) line(c, [[-1 + i * 6, -13], [1 + i * 6, -6]], '#986f57', 2);
    line(c, [[-7, 1], [3, 5]], '#986f57', 2);
  } else {
    shape(c, [[-14, -9], [-4, -15], [11, -13], [17, -6], [17, 11], [-11, 13]], SKIN, 3);
    for (let i = 0; i < 3; i += 1) line(c, [[-5 + i * 6, -9], [-4 + i * 6, 2]], '#986f57', 2);
    if (style === 'rude') {
      line(c, [[2, -6], [2, -49]], INK, 13);
      line(c, [[2, -6], [2, -49]], SKIN, 8);
      line(c, [[-2, -35], [5, -35]], '#986f57', 1.5);
    }
  }
  c.restore();
}

/** A striking fist flattens against the desk on the impact ring. */
const strikeSquash = (act: Act, end: Point, style: HandStyle): number => style === 'fist' ? Math.max(0, act.impact) * 0.12 * clamp((end.y - 330) / 60) : 0;

export function drawFace(c: CanvasRenderingContext2D, x: number, y: number, scale: number, angle: number, mouth: number, eye: number, heat: number, calm: boolean, time: number, squash = 0): void {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale * (1 + squash), scale * (1 - squash));
  const skin = calm ? '#e8efcd' : heat > 0.7 ? '#f3ab89' : heat > 0.4 ? '#f4cfac' : SKIN;
  c.fillStyle = skin; c.strokeStyle = INK; c.lineWidth = 5;
  c.beginPath(); c.moveTo(-51, -58); c.bezierCurveTo(-16, -84, 32, -78, 53, -51);
  c.bezierCurveTo(76, -27, 64, -5, 70, 13); c.lineTo(54, 57);
  c.bezierCurveTo(26, 81, -23, 78, -48, 55); c.lineTo(-64, 22);
  c.bezierCurveTo(-76, 9, -67, -36, -51, -58); c.closePath(); c.fill(); c.stroke();
  line(c, [[-48, -63], [-32, -69], [-16, -68]], INK, 2);
  line(c, [[45, 50], [32, 60], [10, 67]], INK, 2);
  line(c, [[-59, 17], [-51, 22], [-46, 34]], INK, 2);
  line(c, [[-18, -51], [-7, -44]], INK, 2);
  line(c, [[10, -46], [18, -52]], INK, 2);
  const twitch = calm ? 0 : Math.sin(time * 19) * 3 * heat;
  const blink = Math.sin(time * 1.3) > 0.993 ? 0.1 : 1;
  for (const side of [-1, 1]) {
    const ex = side * 28;
    c.save(); c.translate(ex, -18 + (side === 1 ? twitch : 0));
    c.scale(1, Math.max(0.08, eye * blink));
    c.beginPath(); c.ellipse(0, 0, 21, 13, side * -0.16, 0, Math.PI * 2);
    c.fillStyle = '#fffefa'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    box(c, 4 + side * 1.5, -6, 6, 13, INK, 1);
    c.restore();
    const brow = calm ? -7 : 11 * heat;
    line(c, [[ex - 22, -41 - side * brow], [ex + 19, -40 + side * brow]], INK, 6);
    for (let h = 0; h < 4; h += 1) line(c, [[ex - 11 + h * 5, 8], [ex - 15 + h * 5, 23]], '#b96b51', 1.3);
  }
  line(c, [[0, -17], [-8, 7], [9, 12]], INK, 3);
  const open = clamp(mouth);
  if (calm) {
    c.beginPath(); c.moveTo(-26, 27); c.quadraticCurveTo(1, 59, 30, 27); c.stroke();
    box(c, -53, -29, 44, 22, INK, 2); box(c, 9, -29, 44, 22, INK, 2);
    line(c, [[-9, -22], [9, -22]], INK, 5);
    line(c, [[-45, -24], [-35, -16]], PAPER, 3); line(c, [[17, -24], [27, -16]], PAPER, 3);
  } else if (open > 0.22) {
    const depth = 8 + open * 34;
    c.beginPath(); c.moveTo(-34, 24); c.quadraticCurveTo(0, 13, 36, 24);
    c.lineTo(25, 29 + depth); c.quadraticCurveTo(0, 39 + depth, -27, 26 + depth); c.closePath();
    c.fillStyle = INK; c.fill();
    shape(c, [[-29, 25], [31, 24], [28, 34], [-26, 35]], PAPER, 1);
    for (let i = 0; i < 6; i += 1) line(c, [[-20 + i * 9, 25], [-19 + i * 9, 34]], INK, 1.5);
    if (open > 0.65) shape(c, [[-16, 23 + depth], [-2, 16 + depth], [18, 20 + depth], [16, 28 + depth], [-12, 29 + depth]], RED, 1);
  } else {
    line(c, [[-31, 28], [-15, 24], [1, 31], [16, 25], [33, 30]], INK, 4);
    line(c, [[-20, 45], [-3, 49], [18, 44]], INK, 2);
  }
  if (heat > 0.24 && !calm) {
    line(c, [[37, -59], [39, -47], [51, -49]], RED, 4);
    line(c, [[47, -66], [47, -58], [58, -57]], RED, 3);
  }
  if (!calm) {
    for (let i = 0; i < 3; i += 1) {
      const u = (time * 0.8 + i * 0.31) % 1;
      const sx = i === 1 ? 56 : -55 + i * 4;
      const sy = -30 + u * 70;
      c.globalAlpha = (1 - u) * (0.35 + heat * 0.65);
      shape(c, [[sx, sy - 8], [sx + 5, sy + 5], [sx - 3, sy + 7]], '#84cbd7', 1);
    }
    c.globalAlpha = 1;
  }
  c.restore();
}

export function drawActorBack(c: CanvasRenderingContext2D, p: ActorPose, input: ActingInput, act: Act): void {
  const chairTilt = p.calm ? -0.2 : act.index === 6 ? -0.5 * act.weight : -0.04 + act.impact * 0.045;
  c.save(); c.translate(p.hip.x - 32, p.hip.y + 9); c.rotate(input.reduced ? 0 : chairTilt);
  box(c, -67, -139, 92, 124, '#58636c', 5);
  box(c, -74, -28, 134, 22, '#767f84', 5);
  line(c, [[-10, -9], [-10, 45]], INK, 12);
  line(c, [[-63, 54], [-10, 39], [57, 54]], INK, 8);
  for (const x of [-62, 54]) { c.beginPath(); c.arc(x, 55, 9, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); }
  c.restore();
  for (const [foot, offset] of [[p.leftFoot, -15], [p.rightFoot, 15]] as const) {
    const root = { x: p.hip.x + offset, y: p.hip.y };
    const leg = limb(root, foot, 75, 84, offset < 0 ? 1 : -1);
    stroke(c, root, leg.elbow, 39, INK); stroke(c, leg.elbow, leg.end, 37, INK);
    stroke(c, root, leg.elbow, 30, '#405668'); stroke(c, leg.elbow, leg.end, 28, '#405668');
    shape(c, [[leg.end.x - 19, leg.end.y - 4], [leg.end.x + 17, leg.end.y - 7], [leg.end.x + 40, leg.end.y + 8], [leg.end.x + 37, leg.end.y + 17], [leg.end.x - 19, leg.end.y + 17]], PAPER, 4);
    line(c, [[leg.end.x - 13, leg.end.y + 12], [leg.end.x + 31, leg.end.y + 12]], RED, 4);
  }
  const leftRoot = { x: p.shoulder.x - 28, y: p.shoulder.y + 5 };
  const left = arm(c, leftRoot, p.leftHand, backPole(leftRoot, p.leftHand), false);
  stroke(c, p.hip, p.shoulder, 95, INK);
  stroke(c, p.hip, p.shoulder, 85, RED);
  c.save(); c.translate((p.hip.x + p.shoulder.x) / 2, (p.hip.y + p.shoulder.y) / 2);
  c.rotate(Math.atan2(p.shoulder.x - p.hip.x, p.hip.y - p.shoulder.y));
  label(c, p.calm ? 'AFK' : 'GM', 0, 0, 29, PAPER, 75, 'center'); c.restore();
  stroke(c, p.shoulder, { x: p.head.x, y: p.head.y + 43 }, 37, INK);
  stroke(c, p.shoulder, { x: p.head.x, y: p.head.y + 43 }, 27, SKIN);
  drawFace(c, p.head.x, p.head.y, 1.2, p.headAngle, p.mouth, p.eye, input.heat, p.calm, input.reduced ? 0 : act.clock, p.headSquash);
  const angle = p.leftStyle === 'fist' ? handAngle(left.elbow, left.end, -0.1) : -0.1;
  hand(c, left.end, angle, p.leftStyle, strikeSquash(act, left.end, p.leftStyle));
}

export function drawActorFront(c: CanvasRenderingContext2D, p: ActorPose, input: ActingInput, act: Act): void {
  const root = { x: p.shoulder.x + 30, y: p.shoulder.y + 1 };
  const right = arm(c, root, p.rightHand, 1, true);
  const h = right.end;
  const angle = p.rightStyle === 'fist' ? handAngle(right.elbow, h, -0.2) : -0.2 + p.keyboardAngle;
  hand(c, h, angle, p.rightStyle, strikeSquash(act, h, p.rightStyle));
  if (p.magnifier) {
    c.save(); c.translate(h.x, h.y); c.rotate(0.17);
    line(c, [[0, 0], [3, -36]], INK, 12); line(c, [[0, 0], [3, -36]], GOLD, 6);
    c.beginPath(); c.arc(4, -64, 34, 0, Math.PI * 2); c.fillStyle = 'rgba(166,222,237,.4)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 7; c.stroke();
    line(c, [[-10, -82], [13, -57]], PAPER, 6); c.restore();
  } else if (p.calm || (input.phase !== 'running' && input.phase !== 'crashed')) {
    mug(c, h.x + 6, h.y - 10, input.reduced ? 0 : act.clock, p.calm);
  }
  if (p.calm) {
    c.save(); c.translate(224, 457);
    shape(c, [[-83, -5], [65, -27], [71, 4], [-77, 20]], '#d9e5b3', 4);
    label(c, 'OFFLINE. STAY MAD.', -3, -1, 15, INK, 148, 'center'); c.restore();
  }
}
