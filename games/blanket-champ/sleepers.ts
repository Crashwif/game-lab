/** Visible characters at either end of the duvet. Everything else stays covered. */
import { clamp, mix, noise, smoothstep } from './motion';
const INK = '#1c1f26';
const SKIN = '#f3dccb';
const PARTNER_SKIN = '#dba082';
const CORAL = '#ed6174';

export interface SleeperPose {
  time: number;
  beat: number;
  /** The quilt's spring displacement from its resting height. */
  lift: number;
  tension: number;
  active: boolean;
  /** 0..1: how much the beat drives the feet (eased in and out; defaults to `active`). */
  drive?: number;
  finished: boolean;
  rest: number;
  /** 0..1: how hard the champ shakes near the top. */
  tremble: number;
  multiplier: number;
  /** The partner: her phone (0 down, 1 up), an eye-roll envelope and what it is about, and a yawn. */
  phone: number;
  roll: number;
  rollWhy: 'cat' | 'glass';
  yawn: number;
}

/** Heads and the quilt's shoulder tucks rise and settle together. */
export const sleeperBob = (pose: SleeperPose, partner: boolean): number => -pose.lift * (partner ? 14 : 10);

/** Moves the canvas into a head's frame: on its pillow, with the bob, the tilt, the slump and the champ's tremble. */
function headFrame(ctx: CanvasRenderingContext2D, pose: SleeperPose, partner: boolean): void {
  // The champ trembles near the top: a small hash jitter, the wind-up the finish pays off.
  const tremble = partner ? 0 : pose.tremble;
  const jx = (noise(Math.floor(pose.time * 31)) - 0.5) * 4 * tremble;
  const jy = (noise(Math.floor(pose.time * 29) + 7) - 0.5) * 3 * tremble;
  ctx.translate((partner ? 334 : 271) + jx, (partner ? 295 : 324) + sleeperBob(pose, partner) + jy);
  ctx.rotate((partner ? 0.13 : -0.13) + pose.lift * (partner ? -0.07 : 0.05) + pose.rest * (partner ? 0.1 : -0.16));
}

function pillow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f9f3e7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-46, -17, 92, 37, 13); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#c5bdb9'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-39, -11, 78, 24, 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-42, -12); ctx.lineTo(-32, -4); ctx.moveTo(41, 12); ctx.lineTo(31, 5); ctx.stroke();
  ctx.restore();
}

function sweat(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = '#8fe6f5'; ctx.strokeStyle = INK; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(x, y - size);
  ctx.bezierCurveTo(x + size, y, x + size, y + size, x, y + size);
  ctx.bezierCurveTo(x - size, y + size, x - size, y, x, y - size);
  ctx.fill(); ctx.stroke();
}

function head(ctx: CanvasRenderingContext2D, pose: SleeperPose, partner: boolean): void {
  ctx.save();
  headFrame(ctx, pose, partner);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.8; ctx.strokeStyle = INK;
  const skin = partner ? PARTNER_SKIN : SKIN;
  // A bun and a little hair silhouette distinguish the partner at small sizes.
  if (partner) {
    ctx.fillStyle = '#653d3b';
    ctx.beginPath(); ctx.ellipse(18, -29, 14, 15, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = CORAL; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(9, -25); ctx.lineTo(25, -23); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
  }
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.roundRect(-12, 23, 26, 25, 8); ctx.fill(); ctx.stroke();
  for (const x of [-28, 28]) {
    ctx.beginPath(); ctx.ellipse(x, 3, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-26, -17); ctx.bezierCurveTo(-24, -39, 24, -39, 27, -16);
  ctx.bezierCurveTo(33, 6, 24, 30, 5, 34);
  ctx.bezierCurveTo(-15, 36, -32, 13, -26, -17);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (partner) {
    ctx.fillStyle = '#653d3b';
    ctx.beginPath(); ctx.moveTo(-27, 2); ctx.bezierCurveTo(-39, -31, -13, -42, 12, -32);
    ctx.quadraticCurveTo(34, -28, 28, -4); ctx.lineTo(18, -19);
    ctx.quadraticCurveTo(-3, -9, -19, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    // The champ never takes off the ridiculous red sports headband.
    ctx.fillStyle = '#6b4a36';
    ctx.beginPath(); ctx.moveTo(-23, -24); ctx.lineTo(-18, -37); ctx.lineTo(-7, -31);
    ctx.lineTo(0, -40); ctx.lineTo(10, -32); ctx.lineTo(20, -35); ctx.lineTo(24, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CORAL;
    ctx.beginPath(); ctx.moveTo(-29, -24); ctx.quadraticCurveTo(0, -31, 28, -23);
    ctx.lineTo(29, -12); ctx.quadraticCurveTo(0, -20, -29, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffece5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-23, -20); ctx.quadraticCurveTo(0, -25, 22, -19); ctx.stroke();
    ctx.strokeStyle = INK;
  }
  // Still spent while the heads lift for the next round.
  const exhausted = pose.finished || pose.rest > 0.5;
  const active = pose.active && !exhausted;
  // The champ: the brow comes down from 1.3× (grim determination, eyes narrowing), then panic takes over around 3×.
  const grit = partner || !active ? 0 : smoothstep(0.2, 0.6, pose.tension);
  const fear = partner || !active ? 0 : smoothstep(0.62, 0.7, pose.tension);
  const panic = fear > 0.5;
  // The partner: eyes down on her charts, up and over at the cat or the glass, shut for the yawn.
  const roll = partner ? pose.roll : 0;
  const yawn = partner ? pose.yawn : 0;
  const look = partner ? clamp(pose.phone, 0, 1) * (1 - roll) : 0;
  const blink = !pose.active && !exhausted && (pose.time + (partner ? 1.4 : 0)) % 4.5 > 4.32;
  ctx.lineWidth = 2;
  for (const x of [-11, 12]) {
    if (exhausted || blink || yawn > 0.35) {
      ctx.beginPath(); ctx.moveTo(x - 6, 0); ctx.quadraticCurveTo(x, exhausted ? 5 : yawn > 0.35 ? -3 : 1, x + 5, 0); ctx.stroke();
    } else {
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.ellipse(x, 0, 8, partner ? 5.5 + 2 * roll : mix(7 - 2 * grit, 10, fear), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(x + (partner ? mix(-3, 2, look) + 3 * roll : 2), partner ? 1 + 2 * look - 5 * roll : 1, panic ? 2 : 2.6, 0, Math.PI * 2); ctx.fill();
      if (partner) {
        ctx.beginPath(); ctx.moveTo(x - 8, -2 - 4 * roll); ctx.lineTo(x + 7, -2 - 4 * roll); ctx.stroke();
      }
    }
  }
  // Raised eyebrow (higher for an eye-roll) / grim determination, then worry, then total battery failure.
  const inner = partner ? -3 * roll : mix(7 * grit, -4, fear);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-19, -10 - (partner ? 3 + 3 * roll : 0)); ctx.lineTo(-5, -9 + inner);
  ctx.moveTo(5, -9 + inner); ctx.lineTo(19, -10 - (partner ? 3 * roll : 0));
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(-2, 10); ctx.lineTo(4, 11); ctx.stroke();
  ctx.fillStyle = partner ? 'rgba(187, 77, 77, 0.35)' : `rgba(231, 112, 109, ${0.16 + pose.tension * 0.35})`;
  for (const x of [-20, 21]) { ctx.beginPath(); ctx.ellipse(x, 12, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath();
  if (exhausted && !partner) {
    ctx.fillStyle = '#6f3942'; ctx.ellipse(4, 21, 7, 5, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (panic) {
    ctx.fillStyle = '#fffdf8'; ctx.roundRect(-10, 18, 21, 8, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 19); ctx.lineTo(0, 25); ctx.stroke();
  } else if (yawn > 0.05) {
    ctx.fillStyle = '#6f3942'; ctx.ellipse(3, 21, 5 + 2 * yawn, 2 + 7 * yawn, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.moveTo(-8, 20); ctx.quadraticCurveTo(3, partner ? 21 : 27, 13, partner ? 16 : 18); ctx.stroke();
  }
  if (!partner) {
    ctx.strokeStyle = '#a77d6a'; ctx.lineWidth = 1.2;
    for (const x of [-16, -10, -4, 3, 10, 16]) {
      ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x + 1, 30); ctx.stroke();
    }
    if (pose.active && pose.tension > 0.12) {
      sweat(ctx, 33, -9 + ((pose.time * 1.5) % 1) * 15, 4);
      if (pose.tension > 0.5) sweat(ctx, -36, -7 + ((pose.time * 1.8 + 0.5) % 1) * 16, 3);
    }
  }
  ctx.restore();
}

export function drawSleepers(ctx: CanvasRenderingContext2D, pose: SleeperPose): void {
  pillow(ctx, 328, 330, -0.13);
  head(ctx, pose, true);
  pillow(ctx, 269, 354, 0.08);
  head(ctx, pose, false);
}

export interface SleeperFoot {
  x: number;
  y: number;
  angle: number;
  kick: number;
  sock: boolean;
  /** The quilt meets the ankle here, using the same transform as the foot. */
  tuck: { x: number; y: number };
}

export function sleeperFeet(pose: Pick<SleeperPose, 'beat' | 'lift' | 'tension' | 'active' | 'drive' | 'rest'>): SleeperFoot[] {
  // The beat's hold on the feet eases in at the start and out at the finish, so neither snaps.
  const drive = pose.drive ?? (pose.active ? 1 : 0);
  return ([[645, 326, true], [680, 338, true], [670, 359, false], [711, 371, false]] as const).map(([x, y, sock], index) => {
    const delay = [0, .48, 1.35, 1.9][index]!;
    const beat = Math.sin(pose.beat - delay);
    const impulse = mix(1, .35 + .65 * Math.max(0, beat), drive);
    const kick = Math.max(0, pose.lift) * (5 + pose.tension * 5) * impulse;
    const angle = -0.12 + drive * beat * (0.07 + pose.tension * 0.12) + pose.rest * 0.55;
    const footY = y - pose.lift * 6 - kick + pose.rest * 5;
    return {
      x, y: footY, angle, kick, sock,
      tuck: { x: x - 14 * Math.cos(angle) + 8 * Math.sin(angle), y: footY - 14 * Math.sin(angle) - 8 * Math.cos(angle) },
    };
  });
}

function foot(ctx: CanvasRenderingContext2D, { x, y, angle, kick, sock }: SleeperFoot): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = sock ? CORAL : PARTNER_SKIN;
  // An ankle, heel, arch and an upturned toe: a foot silhouette, not an oval.
  ctx.beginPath(); ctx.moveTo(-18, -5); ctx.lineTo(-12, -5);
  ctx.bezierCurveTo(-7, -12, -9, -26, -3, -32);
  ctx.bezierCurveTo(2, -40, 16, -37, 18, -29);
  ctx.bezierCurveTo(24, -12, 17, 8, 8, 11);
  ctx.quadraticCurveTo(-4, 15, -13, 7); ctx.lineTo(-18, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (sock) {
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#fff3df';
    ctx.fillRect(-17, -10, 3, 24); ctx.fillRect(-10, -10, 3, 24);
    ctx.fillStyle = '#b33859';
    ctx.beginPath(); ctx.ellipse(7, -32, 13, 8, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, 7, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    // Five rounded toes, with a larger big toe and short crease lines.
    for (let toe = 4; toe >= 0; toe -= 1) {
      const tx = -3 + toe * 4.5;
      const ty = -31 + toe * 2.3;
      ctx.fillStyle = PARTNER_SKIN; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.ellipse(tx, ty, 4.1 - toe * 0.35, 5.4 - toe * 0.45, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = '#a96958'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(8, -14); ctx.quadraticCurveTo(3, -4, 4, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, 3); ctx.quadraticCurveTo(-3, 1, 0, 5); ctx.stroke();
  }
  if (kick > 6) {
    ctx.strokeStyle = '#fff0c4'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(25, -25); ctx.lineTo(32, -30); ctx.moveTo(28, -15); ctx.lineTo(37, -17); ctx.stroke();
  }
  ctx.restore();
}

export function drawFeet(ctx: CanvasRenderingContext2D, feet: SleeperFoot[]): void {
  for (const pose of feet) foot(ctx, pose);
}

/** The partner checking her charts: a hand and a phone come up in front of her chin, in her head's frame. */
export function drawPhone(ctx: CanvasRenderingContext2D, pose: SleeperPose): void {
  const up = clamp(pose.phone, 0, 1.2);
  ctx.save();
  headFrame(ctx, pose, true);
  ctx.translate(13, 36 + (1 - up) * 36);
  ctx.rotate(-0.22);
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.fillStyle = '#272b35';
  ctx.beginPath(); ctx.roundRect(-10, -32, 20, 32, 4); ctx.fill(); ctx.stroke();
  // A green chart on the screen, for the viewer's benefit.
  ctx.fillStyle = '#0f2a1c'; ctx.fillRect(-7, -29, 14, 24);
  ctx.strokeStyle = '#7cf67c'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(-2, -14); ctx.lineTo(1, -12); ctx.lineTo(6, -25); ctx.stroke();
  ctx.fillStyle = PARTNER_SKIN; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(-1, -2, 12, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(10, -12, 3.5, 6, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** What the partner says: a ladder with the number, an aside at the cat or the glass, and the verdict. */
function partnerLine(pose: SleeperPose): string {
  if (pose.finished) return 'was that it?';
  if (!pose.active) return 'u ready, champ?';
  if (pose.roll > 0.2) return pose.rollWhy === 'cat' ? "even the cat's leaving" : 'that was MY water';
  if (pose.yawn > 0.1) return '*yaaawn*';
  const m = pose.multiplier;
  return m < 1.15 ? 'socks stay ON.' : m < 1.5 ? 'is this the cardio?' : m < 2.2 ? 'cardio is cardio.' : m < 3 ? 'brb, checking charts' : m < 6 ? 'bro is buffering' : m < 12 ? 'is he... ok?' : "I'm calling his mum";
}

/** A small in-world punchline that leaves the faces unobscured. */
export function drawReaction(ctx: CanvasRenderingContext2D, pose: SleeperPose): void {
  const line = partnerLine(pose);
  const width = 150;
  ctx.save();
  ctx.translate(382, 407);
  ctx.fillStyle = '#fff8e9'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(0, 0, width, 30, 9); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 1); ctx.lineTo(5, -10); ctx.lineTo(34, 1); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff8e9'; ctx.fillRect(18, 0, 13, 3);
  ctx.fillStyle = INK; ctx.font = '700 14px "Trebuchet MS", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(line, width / 2, 16, width - 16);
  ctx.restore();
}
