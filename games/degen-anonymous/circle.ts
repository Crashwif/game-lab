/**
 * The circle of Degen Anonymous: twelve folding chairs in an ellipse seen in perspective (the back of the circle
 * smaller and higher, the front seen from behind), and the people on them. One continuous rig draws everyone at
 * any facing: a body that sits, stands, kneels and walks (two-bone IK legs and arms), a head whose features turn
 * with its yaw, faces on springs (talk, laugh, gasp, worry, blink). Per-member lean springs pull the room toward
 * Jules as the tension rises; Big Ron leads and the room follows. Jules is the tell: the phone in his hand, the
 * thumb over the button, the nametag that flips to DAY 0; he walks to the door and back. The crash is closed-form
 * in the crash clock and seeded from the crash point: everyone up at once, chairs kicked over, Big Ron flat on
 * his back, and the group hug pile-up with squash on every landing. Presentation only.
 */
import { box, ink, INK, label, MEME_FONT } from './ink';
import { type Joint, solveLimb, walkingFoot } from './kinematics';
import type { Who } from './lines';
import { clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, type Spring, stepSpring } from './motion';

// ─── The circle in perspective ─────────────────────────────────────────────────────────────────────────────
export const CENTER = { x: 480, y: 425 } as const;
const RX = 360;
const RY = 125;
/** Screen y per unit of floor depth (the circle's own squash), for rigs and chairs. */
const P = RY / RX;
/** Depth scale from the floor y: the back of the circle smaller, the front bigger. */
export const depthScale = (y: number): number => 0.92 + ((y - 304) / 242) * 0.48;

export interface Seat { x: number; y: number; s: number; fx: number; fz: number }
/** Each seat's angle round the ellipse, and its distance out (the inner side seats sit a little in, so no one hides). */
const ANGLES: Record<Who, [number, number]> = {
  terry: [256, 1],
  jules: [284, 1],
  ron: [230, 1],
  nurse: [310, 1],
  guitar: [203, 0.9],
  podcast: [337, 0.9],
  vegan: [166, 1.02],
  stock: [14, 1.02],
  you: [134, 1],
  cookie: [39, 1],
  twinA: [104, 1],
  twinB: [76, 1],
};
export const ORDER: Who[] = ['terry', 'jules', 'ron', 'nurse', 'guitar', 'podcast', 'vegan', 'stock', 'you', 'cookie', 'twinA', 'twinB'];

function seatOf(who: Who): Seat {
  const [deg, out] = ANGLES[who];
  const a = (deg * Math.PI) / 180;
  const x = CENTER.x + RX * out * Math.cos(a);
  const y = CENTER.y + RY * out * Math.sin(a);
  return { x, y, s: depthScale(y), fx: -Math.cos(a), fz: -Math.sin(a) };
}
export const SEATS: Record<Who, Seat> = Object.fromEntries(ORDER.map((w) => [w, seatOf(w)])) as Record<Who, Seat>;

/** Where Jules goes: the door (he never goes through it) and the middle of the circle. */
export const DOOR_SPOT = { x: 650, y: 287 } as const;
export const MIDDLE = { x: 480, y: 396 } as const;
/** The urn's corner of the room, where you leave. */
export const EXIT_TO = { x: -120, y: 530 } as const;

/** A unit floor direction from (x, y) toward (tx, ty), both in screen space. */
function toward(x: number, y: number, tx: number, ty: number): Joint {
  const dx = tx - x;
  const dz = (ty - y) / P;
  const d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, y: dz / d };
}

// ─── Looks ───────────────────────────────────────────────────────────────────────────────────────────────
type Hair = 'mop' | 'bald' | 'grey' | 'bun' | 'long' | 'cap' | 'beanie' | 'comb' | 'buzz' | 'bowl' | 'short';
interface Look {
  name: string;
  tag: string;
  skin: string;
  hair: string;
  style: Hair;
  hat?: string;
  shirt: string;
  trim: string;
  pants: string;
  shoes: string;
  build: number;
  tall: number;
  head: number;
  glasses?: string;
  beard?: string;
  stache?: string;
  stripes?: string;
}
const LOOKS: Record<Who, Look> = {
  terry: { name: 'Terry, the sponsor', tag: 'TERRY', skin: '#efc9a6', hair: '#ece6dc', style: 'grey', shirt: '#c9962f', trim: '#f2ede2', pants: '#5b5348', shoes: '#3a2c24', build: 1.06, tall: 1, head: 1, glasses: '#4a4250' },
  jules: { name: 'Jules', tag: 'JULES', skin: '#f3d2b3', hair: '#5a3a22', style: 'mop', shirt: '#5b90cf', trim: '#2f5c94', pants: '#2f3b55', shoes: '#f1ede4', build: 0.9, tall: 1.03, head: 1 },
  ron: { name: 'Big Ron', tag: 'BIG RON', skin: '#e2b48f', hair: '#9a948c', style: 'bald', shirt: '#a8322f', trim: '#4a1717', pants: '#3d4a5c', shoes: '#2a201a', build: 1.34, tall: 1.06, head: 1.13, stache: '#8a837a', stripes: '#5e1a19' },
  nurse: { name: 'the nurse', tag: 'DEE', skin: '#c98d64', hair: '#2b1d16', style: 'bun', shirt: '#4fb3a6', trim: '#2f8478', pants: '#4fb3a6', shoes: '#f4f1ea', build: 0.94, tall: 1, head: 0.98 },
  guitar: { name: 'guitar guy', tag: 'SKY', skin: '#f0c8a0', hair: '#7a5230', style: 'long', shirt: '#4f6b3a', trim: '#2c3d20', pants: '#3a3a46', shoes: '#5a3a24', build: 1, tall: 1.02, head: 1, beard: '#7a5230', stripes: '#334a24' },
  podcast: { name: 'podcast guy', tag: 'MAX', skin: '#d9a47c', hair: '#2b1d16', style: 'cap', hat: '#d8443c', shirt: '#3a3f4f', trim: '#262a36', pants: '#5b6474', shoes: '#e8e4dc', build: 1.02, tall: 1, head: 1, beard: '#2b1d16' },
  vegan: { name: 'the vegan', tag: 'WREN', skin: '#f1cfb0', hair: '#c46a3a', style: 'beanie', hat: '#6aa84f', shirt: '#e8d9b0', trim: '#c9b88a', pants: '#6b5a45', shoes: '#4a3a2a', build: 0.96, tall: 0.98, head: 0.98, glasses: '#6b4a2a' },
  stock: { name: 'sold the stock', tag: 'GARY', skin: '#eac3a0', hair: '#c4beb2', style: 'comb', shirt: '#f0efe8', trim: '#2f4f6f', pants: '#4a4640', shoes: '#2a201a', build: 1, tall: 1, head: 1, glasses: '#3b3b45', stache: '#c4beb2' },
  you: { name: 'you', tag: 'YOU', skin: '#e9c09c', hair: '#3a2a24', style: 'short', shirt: '#6a5f8f', trim: '#4a4170', pants: '#33384a', shoes: '#2a2830', build: 1, tall: 1, head: 1 },
  cookie: { name: 'cookie guy', tag: 'BIG AL', skin: '#c58f63', hair: '#1f1712', style: 'buzz', shirt: '#e2733a', trim: '#b4552a', pants: '#3a4660', shoes: '#f0ece4', build: 1.26, tall: 1, head: 1.05 },
  twinA: { name: 'the twins', tag: 'KIT', skin: '#f2d0b0', hair: '#e0b64a', style: 'bowl', shirt: '#3e6fb0', trim: '#f1ece0', pants: '#59493a', shoes: '#3a2c24', build: 0.9, tall: 0.97, head: 1, stripes: '#f1ece0' },
  twinB: { name: 'the twins', tag: 'KAT', skin: '#f2d0b0', hair: '#e0b64a', style: 'bowl', shirt: '#3e6fb0', trim: '#f1ece0', pants: '#59493a', shoes: '#3a2c24', build: 0.9, tall: 0.97, head: 1, stripes: '#f1ece0' },
};
export const nameOf = (who: Who): string => LOOKS[who].name;

// ─── The rig ─────────────────────────────────────────────────────────────────────────────────────────────
export interface Face {
  /** Mouth open (talking), smile (−1 frown … 1 grin), gasp, worried brows, blink, happy closed eyes, pupils. */
  mouth: number;
  smile: number;
  o: number;
  brow: number;
  shut: number;
  happy: number;
  look: Joint;
}
/** Where a hand goes, relative to the shoulder centre; `null` rests it in the lap. */
type Hand = Joint | null;
export interface Pose {
  fx: number;
  fz: number;
  /** 1 seated with thighs forward, 0 standing, and the kneel of the hug. */
  sit: number;
  kneel: number;
  /** Shoulders' shift (lean), the head's yaw relative to the camera, its nod. */
  lean: Joint;
  yaw: number;
  nod: number;
  breath: number;
  hands: [Hand, Hand];
  /** Walking: floor offsets and lifts for the two feet, from the standing stance. */
  feet: [Joint, Joint] | null;
  face: Face;
}
/** What a prop needs from the drawn body: the shoulder centre, the hands as drawn, the head centre and size. */
export interface Frame { hip: Joint; chest: Joint; hands: [Joint, Joint]; head: Joint; r: number; u: Joint; front: boolean }


/** Draws the figure at the origin (the floor under its hips), in unscaled units; `props` draw held things. */
export function drawPerson(ctx: CanvasRenderingContext2D, look: Look, pose: Pose, props?: { under?: (f: Frame) => void; held?: (f: Frame) => void; over?: (f: Frame) => void }): Frame {
  const { fx, fz } = pose;
  const px = fz;
  const pz = -fx;
  const sit = clamp(pose.sit, 0, 1);
  const kneel = clamp(pose.kneel, 0, 1);
  const hipH = mix(mix(92, 50, sit), 44, kneel);
  const hip = { x: 0, y: -hipH };
  const build = look.build;
  // The legs: seated, the thighs run toward the facing and the shins drop; standing, IK from hip to foot.
  const legs: { root: Joint; knee: Joint; foot: Joint; near: number }[] = [];
  const LP = 0.6;
  for (const side of [-1, 1]) {
    const root = { x: hip.x + px * 8 * side * build, y: hip.y + pz * 8 * side * P };
    const seatedKnee = { x: root.x + fx * 38 + px * 4 * side, y: root.y + 2 + fz * 38 * LP };
    const seatedFoot = { x: root.x + fx * 46 + px * 3 * side, y: fz * 46 * LP * 0.8 + pz * 6 * side * P };
    const kneelKnee = { x: root.x + fx * 16, y: -4 + fz * 16 * P };
    const kneelFoot = { x: root.x - fx * 26, y: -2 - fz * 26 * P };
    let standFoot = { x: root.x + fx * 4, y: fz * 4 * P + pz * 8 * side * P };
    if (pose.feet) {
      const f = pose.feet[side < 0 ? 0 : 1];
      standFoot = { x: standFoot.x + f.x * fx, y: standFoot.y + f.x * fz * P - f.y };
    }
    const stand = solveLimb(root, standFoot, 46, 46, fx >= 0 ? 0.35 : -0.35);
    const knee = { x: mix(mix(stand.joint.x, seatedKnee.x, sit), kneelKnee.x, kneel), y: mix(mix(stand.joint.y, seatedKnee.y, sit), kneelKnee.y, kneel) };
    const foot = { x: mix(mix(stand.end.x, seatedFoot.x, sit), kneelFoot.x, kneel), y: mix(mix(stand.end.y, seatedFoot.y, sit), kneelFoot.y, kneel) };
    legs.push({ root, knee, foot, near: pz * side });
  }
  // The torso, leaning; the shoulders' width turns with the facing.
  const tall = 56 * look.tall;
  const chest = { x: hip.x + pose.lean.x, y: hip.y - tall + pose.lean.y - pose.breath * 1.2 };
  const ux0 = chest.x - hip.x;
  const uy0 = chest.y - hip.y;
  const ul = Math.hypot(ux0, uy0) || 1;
  const u = { x: ux0 / ul, y: uy0 / ul };
  const n = { x: -u.y, y: u.x };
  const across = Math.abs(fz);
  const sw = (23 * across + 13 * (1 - across)) * build * (1 + 0.02 * pose.breath);
  const hw = (19 * across + 13 * (1 - across)) * build;
  const shoulders: Joint[] = [-1, 1].map((side) => ({ x: chest.x + n.x * side * (sw * across * 0.86 + 3) + px * 0, y: chest.y + n.y * side * sw * across * 0.86 + pz * side * 6 * P + 3 }));
  const front = fz > -0.3;
  // The arms, solved to their hands; elbows out to the side, or back in profile.
  const arms = shoulders.map((sh, i) => {
    const side = i === 0 ? -1 : 1;
    const target = pose.hands[i] ? { x: chest.x + pose.hands[i]!.x, y: chest.y + pose.hands[i]!.y } : { x: mix(legs[i]!.root.x, legs[i]!.knee.x, 0.62) + side * 2, y: mix(legs[i]!.root.y, legs[i]!.knee.y, 0.62) - 6 };
    const pole = clamp(-side * across * 1.6 + fx * 1.6, -1, 1) * (fz < -0.3 ? -1 : 1);
    const arm = solveLimb(sh, target, 29, 28, pole);
    return { sh, elbow: arm.joint, hand: arm.end, near: pz * side };
  });
  const frame: Frame = { hip, chest, hands: [arms[0]!.hand, arms[1]!.hand], head: { x: 0, y: 0 }, r: 20 * look.head, u, front };
  const drawLegs = (order: typeof legs): void => {
    // Shins, then thighs over them so the knees read as joints (a seated lap seen from the front); then shoes.
    const w = 15 * Math.min(1.15, build);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const part of [0, 1]) {
      ctx.beginPath();
      for (const l of order) {
        if (part === 0) {
          ctx.moveTo(l.knee.x, l.knee.y);
          ctx.lineTo(l.foot.x, l.foot.y);
        } else {
          ctx.moveTo(l.root.x, l.root.y);
          ctx.lineTo(l.knee.x, l.knee.y);
        }
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = w + 5;
      ctx.stroke();
      ctx.strokeStyle = look.pants;
      ctx.lineWidth = part === 0 ? w - 1 : w + 1;
      ctx.stroke();
    }
    ctx.fillStyle = look.shoes;
    ink(ctx, 2.2);
    ctx.beginPath();
    for (const l of order) {
      ctx.moveTo(l.foot.x + fx * 5 + 7 + 4 * Math.abs(fx), l.foot.y + 1);
      ctx.ellipse(l.foot.x + fx * 5, l.foot.y + 1, 7 + 4 * Math.abs(fx), 4.5, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  };
  const drawArms = (list: (typeof arms)[number][]): void => {
    if (list.length === 0) return;
    const w = 10.5 * Math.min(1.2, build);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const a of list) {
      ctx.moveTo(a.sh.x, a.sh.y);
      ctx.lineTo(a.elbow.x, a.elbow.y);
      ctx.lineTo(a.hand.x, a.hand.y);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 5;
    ctx.stroke();
    ctx.strokeStyle = look.shirt;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.fillStyle = look.skin;
    ink(ctx, 2);
    ctx.beginPath();
    for (const a of list) {
      ctx.moveTo(a.hand.x + 5.6, a.hand.y);
      ctx.arc(a.hand.x, a.hand.y, 5.6, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  };
  // Back to front: arms behind a back-facing torso, the legs, the far arm in profile, torso, near arms, head.
  const legOrder = [...legs].sort((a, b) => a.near - b.near);
  const armOrder = [...arms].sort((a, b) => a.near - b.near);
  if (!front) drawArms(armOrder);
  drawLegs(legOrder);
  props?.under?.(frame);
  const farArm = Math.abs(fx) > 0.55 && front ? armOrder[0]! : null;
  if (farArm) drawArms([farArm]);
  // Torso: hips to shoulders, rounded at the top; stripes or checks as a pattern over the shirt.
  ctx.beginPath();
  ctx.moveTo(hip.x - n.x * hw, hip.y - n.y * hw + 6);
  ctx.lineTo(chest.x - n.x * sw, chest.y - n.y * sw + 8);
  ctx.quadraticCurveTo(chest.x - n.x * sw - u.x * 7, chest.y - n.y * sw - u.y * 7, chest.x - n.x * sw * 0.5 + u.x * 2, chest.y - n.y * sw * 0.5 + u.y * 2);
  ctx.lineTo(chest.x + n.x * sw * 0.5 + u.x * 2, chest.y + n.y * sw * 0.5 + u.y * 2);
  ctx.quadraticCurveTo(chest.x + n.x * sw + u.x * 7, chest.y + n.y * sw + u.y * 7, chest.x + n.x * sw, chest.y + n.y * sw + 8);
  ctx.lineTo(hip.x + n.x * hw, hip.y + n.y * hw + 6);
  ctx.quadraticCurveTo(hip.x, hip.y + 12, hip.x - n.x * hw, hip.y - n.y * hw + 6);
  ctx.closePath();
  ctx.fillStyle = look.shirt;
  ctx.fill();
  const pattern = look.stripes ? cloth(ctx, look) : null;
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fill();
  }
  ink(ctx, 2.5);
  ctx.stroke();
  // Shirt details, inside the torso: a cardigan front, a vest and tie, scrubs, a hoodie, a cookie.
  if (front && across > 0.35) {
    const cx = chest.x + n.x * sw * Math.sin(Math.atan2(fx, fz)) * 0.6;
    if (look.style === 'grey') {
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.moveTo(cx - 7, chest.y);
      ctx.lineTo(cx + 7, chest.y);
      ctx.lineTo(cx + 4, hip.y + 8);
      ctx.lineTo(cx - 4, hip.y + 8);
      ctx.closePath();
      ctx.fill();
    } else if (look.style === 'comb') {
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.moveTo(chest.x - n.x * sw * 0.86, chest.y + 12);
      ctx.lineTo(cx - 8, chest.y + 4);
      ctx.lineTo(cx, chest.y + 24);
      ctx.lineTo(cx + 8, chest.y + 4);
      ctx.lineTo(chest.x + n.x * sw * 0.86, chest.y + 12);
      ctx.lineTo(hip.x + n.x * hw * 0.92, hip.y + 4);
      ctx.lineTo(hip.x - n.x * hw * 0.92, hip.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a83a3a';
      ctx.fillRect(cx - 2.5, chest.y + 2, 5, 18);
    } else if (look.style === 'bun') {
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 8, chest.y + 1);
      ctx.lineTo(cx, chest.y + 13);
      ctx.lineTo(cx + 8, chest.y + 1);
      ctx.stroke();
      ctx.fillStyle = look.trim;
      ctx.fillRect(cx - 15, chest.y + 18, 9, 8);
      ctx.fillStyle = '#f1ece0';
      ctx.fillRect(cx - 13, chest.y + 14, 2, 6);
    } else if (look.style === 'cap' || look.style === 'short' || look.style === 'mop') {
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 5, chest.y + 3);
      ctx.lineTo(cx - 5, chest.y + 18);
      ctx.moveTo(cx + 5, chest.y + 3);
      ctx.lineTo(cx + 5, chest.y + 18);
      ctx.stroke();
      ctx.fillStyle = look.trim;
      ctx.fillRect(cx - 14, hip.y - 18, 28, 12);
    } else if (look.style === 'buzz') {
      ctx.fillStyle = '#d9a35a';
      ctx.beginPath();
      ctx.arc(cx, chest.y + 22, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3420';
      for (const [dx, dy] of [[-3, -3], [3, 1], [-1, 4], [4, -4]] as const) ctx.fillRect(cx + dx - 1, chest.y + 22 + dy - 1, 2.5, 2.5);
    }
  }
  // The collar.
  ctx.fillStyle = look.trim;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(chest.x + u.x * 1, chest.y + 2, 9 * build * (0.6 + 0.4 * across), 4, Math.atan2(n.y, n.x), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  props?.held?.(frame);
  if (front) drawArms(armOrder.filter((a) => a !== farArm));
  // The head on the neck, nodding.
  const r = 20 * look.head;
  const head = { x: chest.x + u.x * (r + 5), y: chest.y + u.y * (r + 5) + pose.nod };
  frame.head = head;
  frame.r = r;
  ctx.fillStyle = look.skin;
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.roundRect(chest.x - 6, chest.y - 9, 12, 12, 3);
  ctx.fill();
  drawHead(ctx, look, head, r, pose.yaw, pose.face);
  props?.over?.(frame);
  return frame;
}

/** Stripes (the twins) or flannel checks (Big Ron, the guitar guy), painted once per look as a repeating pattern. */
const patterns = new Map<string, CanvasPattern | null>();
function cloth(ctx: CanvasRenderingContext2D, look: Look): CanvasPattern | null {
  const key = `${look.style}:${look.stripes}`;
  if (patterns.has(key)) return patterns.get(key)!;
  if (typeof document === 'undefined') return null;
  const tile = document.createElement('canvas');
  const stripes = look.style === 'bowl';
  tile.width = stripes ? 4 : 9;
  tile.height = stripes ? 10 : 9;
  const g = tile.getContext('2d');
  let pattern: CanvasPattern | null = null;
  if (g) {
    g.fillStyle = look.stripes!;
    if (stripes) g.fillRect(0, 0, 4, 4);
    else {
      g.globalAlpha = 0.85;
      g.fillRect(0, 0, 9, 2.5);
      g.fillRect(0, 0, 2.5, 9);
    }
    pattern = ctx.createPattern(tile, 'repeat');
  }
  patterns.set(key, pattern);
  return pattern;
}

/** The surface angle under screen offset `x` of a head of radius `r`, relative to where the face points. */
const surface = (x: number, r: number, yaw: number): number => Math.cos(Math.asin(clamp(x / r, -1, 1)) - yaw);

export function drawHead(ctx: CanvasRenderingContext2D, look: Look, c: Joint, r: number, yaw: number, face: Face): void {
  const ry = r * 1.08;
  const at = (beta: number): { x: number; vis: number } => ({ x: c.x + r * 0.9 * Math.sin(yaw + beta), vis: Math.cos(yaw + beta) });
  // Long hair falls behind the head; a bun sits behind it.
  if (look.style === 'long') {
    ctx.fillStyle = look.hair;
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(c.x - r * 1.02, c.y - 4);
    ctx.quadraticCurveTo(c.x - r * 1.15, c.y + r * 1.6, c.x - r * 0.5 - Math.sin(yaw) * 8, c.y + r * 1.75);
    ctx.lineTo(c.x + r * 0.5 - Math.sin(yaw) * 8, c.y + r * 1.75);
    ctx.quadraticCurveTo(c.x + r * 1.15, c.y + r * 1.6, c.x + r * 1.02, c.y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (look.style === 'bun') {
    const b = at(Math.PI);
    ctx.fillStyle = look.hair;
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.arc(b.x, c.y - r * 0.72, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Ears, behind the face, in one path.
  ctx.fillStyle = look.skin;
  ink(ctx, 2);
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const e = at((s * Math.PI) / 2);
    if (e.vis < -0.75) continue;
    const ew = 4 + 2 * Math.abs(e.vis);
    ctx.moveTo(e.x + ew, c.y + 2);
    ctx.ellipse(e.x, c.y + 2, ew, 6.5, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  // The head.
  ctx.fillStyle = look.skin;
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The face, where it turns toward us.
  const nose = at(0);
  if (nose.vis > -0.15) {
    const k = clamp((nose.vis + 0.15) / 0.5, 0, 1);
    ctx.save();
    ctx.globalAlpha *= k;
    // Eyes (whites, then pupils) and brows, each in one path.
    const eyes = [-1, 1].map((s) => ({ s, ...at(s * 0.42) })).filter((e) => e.vis >= 0.12);
    const open = (1 - clamp(face.shut, 0, 1)) * (1 + 0.35 * face.o + 0.15 * face.brow);
    const ey = c.y - 3;
    const ew = (e: { vis: number }): number => 4.6 * clamp(e.vis, 0.35, 1);
    if (face.happy > 0.5 || open < 0.15) {
      ink(ctx, 2.2);
      ctx.beginPath();
      for (const e of eyes) {
        if (face.happy > 0.5) {
          ctx.moveTo(e.x - ew(e) * 0.95, ey + 1);
          ctx.quadraticCurveTo(e.x, ey - 5, e.x + ew(e) * 0.95, ey + 1);
        } else {
          ctx.moveTo(e.x - ew(e), ey + 1);
          ctx.quadraticCurveTo(e.x, ey + 3, e.x + ew(e), ey + 1);
        }
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ink(ctx, 1.6);
      ctx.beginPath();
      for (const e of eyes) {
        ctx.moveTo(e.x + ew(e), ey);
        ctx.ellipse(e.x, ey, ew(e), 5.2 * open, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      for (const e of eyes) {
        const px = e.x + clamp(face.look.x, -1, 1) * ew(e) * 0.45 + Math.sin(yaw) * 1.2;
        const py = ey + clamp(face.look.y, -1, 1) * 2.2 * open;
        ctx.moveTo(px + 2.1, py);
        ctx.arc(px, py, 2.1, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // The brows: the inner ends lift with worry and a gasp.
    ink(ctx, look.style === 'bald' ? 3.2 : 2.4);
    const lift = 2.5 * face.brow + 2 * face.o;
    ctx.beginPath();
    for (const e of eyes) {
      ctx.moveTo(e.x + e.s * ew(e) * 0.95, ey - 8 - lift * 0.3);
      ctx.lineTo(e.x - e.s * ew(e) * 0.95, ey - 8 - lift);
    }
    ctx.stroke();
    if (look.glasses && eyes.length > 0) {
      ctx.strokeStyle = look.glasses;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (const e of eyes) {
        const gw = 6.5 * clamp(e.vis, 0.35, 1);
        ctx.moveTo(e.x + gw, c.y - 3);
        ctx.ellipse(e.x, c.y - 3, gw, 5.5, 0, 0, Math.PI * 2);
      }
      if (eyes.length === 2) {
        ctx.moveTo(eyes[0]!.x + 5, c.y - 4);
        ctx.lineTo(eyes[1]!.x - 5, c.y - 4);
      }
      ctx.stroke();
    }
    // The nose: a bump that sticks out past the outline in profile.
    ctx.fillStyle = look.skin;
    ink(ctx, 1.8);
    ctx.beginPath();
    const nx = c.x + r * Math.sin(yaw) * 1.02;
    ctx.ellipse(nx, c.y + 5, 3.6 + 1.5 * Math.abs(Math.sin(yaw)), 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (look.beard) {
      ctx.fillStyle = look.beard;
      ink(ctx, 2);
      ctx.beginPath();
      ctx.moveTo(c.x - r * 0.92 + Math.sin(yaw) * 6, c.y + 2);
      ctx.quadraticCurveTo(c.x + Math.sin(yaw) * r * 0.5, c.y + ry + 9, c.x + r * 0.92 + Math.sin(yaw) * 6, c.y + 2);
      ctx.quadraticCurveTo(c.x + Math.sin(yaw) * r * 0.6, c.y + 11, c.x - r * 0.92 + Math.sin(yaw) * 6, c.y + 2);
      ctx.fill();
      ctx.stroke();
    }
    // The mouth: talk opens it, a smile curls it, a gasp rounds it.
    const m = at(0);
    const mx = mix(c.x, m.x, 0.85);
    const my = c.y + 12;
    const mw = 6.5 * clamp(m.vis, 0.4, 1) * (1 - 0.35 * face.o);
    const gape = clamp(face.mouth * 5 + face.o * 6, 0, 7);
    ctx.fillStyle = '#5a1f2a';
    ink(ctx, 1.8);
    ctx.beginPath();
    if (gape > 0.8) {
      ctx.ellipse(mx, my + gape * 0.3, mw * (1 - 0.2 * face.o), gape * 0.6 + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.moveTo(mx - mw, my - face.smile * 2);
      ctx.quadraticCurveTo(mx, my + face.smile * 4.5, mx + mw, my - face.smile * 2);
      ctx.stroke();
    }
    if (look.stache) {
      ctx.fillStyle = look.stache;
      ink(ctx, 1.6);
      ctx.beginPath();
      ctx.ellipse(mx, my - 3.5, mw + 3, 3.2, 0, Math.PI, Math.PI * 2);
      ctx.ellipse(mx, my - 3.5, mw + 3, 2, 0, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  drawHair(ctx, look, c, r, ry, yaw);
}

/** Hair that turns with the head: a cap on top, a hairline at the brow in front and the nape behind. */
function drawHair(ctx: CanvasRenderingContext2D, look: Look, c: Joint, r: number, ry: number, yaw: number): void {
  const style = look.style;
  ctx.fillStyle = look.hair;
  ink(ctx, 2.2);
  if (style === 'bald') {
    // A horseshoe round the back, under the shine: each unbroken run of back-facing head is its own band.
    const n = 12;
    const back = (i: number): boolean => surface((-r + (2 * r * i) / n) * 0.98, r, yaw) < 0.15;
    let i = 0;
    while (i <= n) {
      if (!back(i)) {
        i += 1;
        continue;
      }
      const from = i;
      while (i <= n && back(i)) i += 1;
      const to = i - 1;
      ctx.beginPath();
      for (let k = from; k <= to; k += 1) ctx.lineTo(c.x - r + (2 * r * k) / n, c.y - 2);
      for (let k = to; k >= from; k -= 1) ctx.lineTo(c.x + (-r + (2 * r * k) / n) * 1.02, c.y + 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(c.x - r * 0.3, c.y - ry * 0.6, 5, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const top = { beanie: 1.18, cap: 1.12, bowl: 1.12, mop: 1.16, long: 1.08, bun: 1.06, grey: 1.04, comb: 1.02, buzz: 1.02, short: 1.06 }[style];
  const brow = { beanie: -6, cap: -9, bowl: -4, mop: -6, long: -10, bun: -12, grey: -11, comb: -12, buzz: -13, short: -11 }[style];
  const nape = { beanie: 8, cap: 12, bowl: 15, mop: 15, long: 17, bun: 13, grey: 12, comb: 10, buzz: 12, short: 14 }[style];
  ctx.fillStyle = style === 'beanie' || style === 'cap' ? look.hat! : look.hair;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 1, r * top, ry * top, 0, Math.PI, Math.PI * 2);
  for (let i = 12; i >= 0; i -= 1) {
    const x = -r * top + (2 * r * top * i) / 12;
    const front = smoothstep(-0.15, 0.45, surface(x, r * top, yaw));
    const y = mix(nape, brow, front) - (style === 'mop' && front > 0.5 ? 3 * Math.sin(i * 2.1) : 0);
    ctx.lineTo(c.x + x, c.y + y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (style === 'cap') {
    // Worn backwards: the brim sticks out behind.
    const b = Math.sin(yaw + Math.PI);
    ctx.fillStyle = look.hat!;
    ink(ctx, 2);
    ctx.beginPath();
    ctx.ellipse(c.x + b * r * 1.05, c.y - 7, 4 + 9 * Math.abs(b), 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Headphones round the neck.
    ctx.strokeStyle = '#26262e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y + ry * 0.9, r * 0.75, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  if (style === 'beanie') {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let k = -2; k <= 2; k += 1) {
      ctx.beginPath();
      ctx.moveTo(c.x + k * r * 0.35, c.y - ry * 1.05);
      ctx.lineTo(c.x + k * r * 0.38, c.y - 4);
      ctx.stroke();
    }
    ctx.fillStyle = look.hat!;
    ink(ctx, 2);
    ctx.beginPath();
    ctx.arc(c.x, c.y - ry * 1.22, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (style === 'comb') {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k += 1) {
      ctx.beginPath();
      ctx.moveTo(c.x - r * 0.8, c.y - ry * 0.55 - k * 3);
      ctx.quadraticCurveTo(c.x, c.y - ry * 0.95 - k * 2, c.x + r * 0.8, c.y - ry * 0.55 - k * 2);
      ctx.stroke();
    }
  }
}

// ─── Chairs ──────────────────────────────────────────────────────────────────────────────────────────────
const METAL = '#b9b09c';
const METAL_DARK = '#8d8574';
/** A folding chair at the origin facing (fx, fz), in parts so a body can sit between them. */
export function drawChair(ctx: CanvasRenderingContext2D, fx: number, fz: number, part: 'all' | 'base' | 'back', folded = 0): void {
  const px = fz;
  const pz = -fx;
  const at = (u: number, v: number, h: number): Joint => ({ x: u * px + v * fx, y: -h + (u * pz + v * fz) * P });
  const f = clamp(folded, 0, 1);
  const seatH = 45;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const tubes = (segments: [Joint, Joint][]): void => {
    ctx.beginPath();
    for (const [p, q] of segments) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8.5;
    ctx.stroke();
    ctx.strokeStyle = METAL;
    ctx.lineWidth = 4.5;
    ctx.stroke();
  };
  const quad = (q: Joint[], fill: string): void => {
    ctx.fillStyle = fill;
    ink(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(q[0]!.x, q[0]!.y);
    for (const p of q.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  if (part !== 'back') {
    // The front legs and the seat; folded, the seat swings up against the back.
    tubes([-16, 16].map((u) => [at(u, 16 - 30 * f, 0), at(u, 13 - 28 * f, seatH * (1 - f) + 40 * f)] as [Joint, Joint]));
    quad([at(-17, -15 + 2 * f, seatH + 30 * f), at(17, -15 + 2 * f, seatH + 30 * f), at(17, 15 - 28 * f, seatH - 2 + 32 * f), at(-17, 15 - 28 * f, seatH - 2 + 32 * f)], METAL_DARK);
  }
  if (part !== 'base') {
    tubes([-16, 16].map((u) => [at(u, -15, 0), at(u, -19, 88)] as [Joint, Joint]));
    quad([at(-17, -18.5, 86), at(17, -18.5, 86), at(17, -17.5, 62), at(-17, -17.5, 62)], METAL);
  }
}

// ─── The cast's state ────────────────────────────────────────────────────────────────────────────────────
export interface Member {
  who: Who;
  look: Look;
  seat: Seat;
  seed: number;
  lean: Spring;
  yaw: Spring;
  nod: Spring;
  laugh: Spring;
  gasp: Spring;
  arm: Spring;
  breath: number;
  glance: number;
  blink: number;
  blinkIn: number;
  blinks: number;
  creak: number;
}

export type JulesMode = 'seat' | 'toDoor' | 'door' | 'toMiddle' | 'middle';
export type YouMode = 'seated' | 'standing' | 'folding' | 'walking' | 'gone';

export interface Circle {
  members: Record<Who, Member>;
  /** The room going still after the stock guy's share. */
  still: Spring;
  stillT: number;
  /** Jules: where he is, his walk, the phone, the nametag's flip and the buzz of the text. */
  jules: { mode: JulesMode; t: number; from: Joint; to: Joint; phone: Spring; flip: Spring; stage: number; buzz: number; dist: number };
  terry: { reach: Spring; eat: number; rung: number };
  /** Terry's cup level, 0..1, set by the scene from the multiplier. */
  cupFill: number;
  ron: { watch: Spring; stand: Spring; standT: number };
  mic: Spring;
  song: number;
  strum: number;
  bites: number;
  paper: Spring;
  tvLook: number;
  you: { mode: YouMode; t: number };
  /** One-frame events for cues. */
  events: { creak: number; scrape: boolean; flip: boolean; refill: boolean; tick: boolean; strum: boolean; buzz: boolean; door: boolean };
  /** The crash, seeded from the crash point: pile jitter and Jules's spot when the thumb came down. */
  crashSeed: number;
  julesAtCrash: Joint;
  /** Where each head was last drawn, in the room's space: for bubble tails, looks and keeping bubbles off faces. */
  heads: Partial<Record<Who, Joint>>;
}

function member(who: Who, i: number): Member {
  const seed = i * 7.31 + 3;
  return { who, look: LOOKS[who], seat: SEATS[who], seed, lean: spring(0), yaw: spring(0), nod: spring(0), laugh: spring(0), gasp: spring(0), arm: spring(0), breath: noise(seed) * 6, glance: 0, blink: 0, blinkIn: 1 + noise(seed * 3) * 3, blinks: 0, creak: 0 };
}

export function createCircle(): Circle {
  const members = Object.fromEntries(ORDER.map((w, i) => [w, member(w, i)])) as Record<Who, Member>;
  return {
    members,
    still: spring(0),
    stillT: 99,
    jules: { mode: 'seat', t: 0, from: { x: SEATS.jules.x, y: SEATS.jules.y }, to: { x: SEATS.jules.x, y: SEATS.jules.y }, phone: spring(0), flip: spring(0), stage: 0, buzz: 0, dist: 0 },
    terry: { reach: spring(0), eat: 0, rung: 0 },
    cupFill: 0.9,
    ron: { watch: spring(0), stand: spring(0), standT: 99 },
    mic: spring(0),
    song: 99,
    strum: 0,
    bites: 99,
    paper: spring(0),
    tvLook: 0,
    you: { mode: 'seated', t: 0 },
    events: { creak: 0, scrape: false, flip: false, refill: false, tick: false, strum: false, buzz: false, door: false },
    crashSeed: 1,
    julesAtCrash: { x: SEATS.jules.x, y: SEATS.jules.y },
    heads: {},
  };
}
export function resetCircle(c: Circle): void {
  Object.assign(c, createCircle());
  invalidateSprites();
}

export interface CircleDrive {
  running: boolean;
  tension: number;
  multiplier: number;
  depth: number;
  time: number;
  /** How hard each member is talking (0..1), the newest speaker, the beats said this frame. */
  talking: (who: Who) => number;
  speaker: Who | null;
  beats: string[];
  /** A line was said this frame (the room checks the nametag). */
  line: boolean;
  /** The milestone count rose this frame (Terry refills). */
  rung: number;
  crashed: boolean;
  crashT: number;
  secured: boolean;
}

/** Jules's walk speed in px/s and where each mode stands him. */
const WALK = 92;
const julesSpot = (mode: JulesMode): Joint => (mode === 'seat' ? { x: SEATS.jules.x, y: SEATS.jules.y } : mode === 'door' || mode === 'toDoor' ? { ...DOOR_SPOT } : { ...MIDDLE });
/** Where Jules is standing (or sitting) on the floor right now. */
export function julesAt(c: Circle): Joint {
  const j = c.jules;
  if (j.mode === 'toDoor' || j.mode === 'toMiddle') {
    const span = Math.hypot(j.to.x - j.from.x, j.to.y - j.from.y) || 1;
    const k = smoothstep(0, 1, clamp(j.dist / span, 0, 1));
    return { x: mix(j.from.x, j.to.x, k), y: mix(j.from.y, j.to.y, k) };
  }
  return julesSpot(j.mode);
}
/** Where the room looks when it looks at Jules: his chest. */
const julesChest = (c: Circle): Joint => {
  const at = julesAt(c);
  return { x: at.x, y: at.y - 110 * depthScale(at.y) };
};

function walkTo(c: Circle, mode: JulesMode, to: JulesMode): void {
  const j = c.jules;
  j.from = julesAt(c);
  j.to = julesSpot(to);
  j.mode = mode;
  j.t = 0;
  j.dist = 0;
}

/** The lean the room is aiming for: Ron leads with the tension; everyone else follows him. */
const leanFor = (tension: number, depth: number): number => clamp(smoothstep(0.02, 0.9, tension) * 0.85 + 0.25 * depth, 0, 1.05);

/** Settles the circle into a round already at `multiplier` (late entry): Jules where the round has him, the props out. */
export function settleCircle(c: Circle, multiplier: number, tension: number, depth: number, secured: boolean): void {
  const lean = leanFor(tension, depth);
  for (const m of Object.values(c.members)) {
    settleSpring(m.lean, m.who === 'jules' ? 0 : lean);
    settleSpring(m.yaw, 0);
  }
  const j = c.jules;
  j.mode = multiplier >= 7 ? 'middle' : multiplier >= 3.8 ? 'door' : 'seat';
  j.from = julesSpot(j.mode);
  j.to = julesSpot(j.mode);
  settleSpring(j.phone, multiplier >= 2.4 ? 1 : 0);
  j.stage = multiplier >= 2.4 ? 2 : multiplier >= 1.95 ? 1 : 0;
  settleSpring(c.mic, multiplier >= 1.8 ? 1 : 0);
  settleSpring(c.paper, multiplier >= 2.1 ? 1 : 0);
  c.terry.rung = 0;
  if (secured) c.you.mode = 'gone';
}

/** Advances the circle by `dt` seconds of scene time. */
export function stepCircle(c: Circle, d: CircleDrive, dt: number): void {
  const ev = c.events;
  ev.creak = 0;
  ev.scrape = ev.flip = ev.refill = ev.tick = ev.strum = ev.buzz = ev.door = false;
  const live = d.running && !d.crashed;
  const j = c.jules;
  // Beats said this frame.
  for (const beat of d.beats) {
    if (beat === 'nod') for (const m of Object.values(c.members)) m.nod.v += 26 + 10 * noise(m.seed);
    if (beat === 'laugh') for (const m of Object.values(c.members)) if (m.who !== 'jules') m.laugh.v += 7 + 3 * noise(m.seed + 1);
    if (beat === 'mic') settleSpring(c.mic, c.mic.x).v += 4;
    if (beat === 'still') {
      c.stillT = 0;
      settleSpring(c.paper, c.paper.x).v += 3;
    }
    if (beat === 'text') j.buzz = 2.2;
    if (beat === 'phone') c.terry.reach.v += 9;
    if (beat === 'three') c.bites = 0;
    if (beat === 'song') c.song = 0;
    if (beat === 'stand' && j.mode === 'seat') {
      walkTo(c, 'toDoor', 'door');
      ev.scrape = true;
    }
    if (beat === 'return' && (j.mode === 'door' || j.mode === 'toDoor' || j.mode === 'seat')) {
      walkTo(c, 'toMiddle', 'middle');
      for (const m of Object.values(c.members)) m.gasp.v += 6;
    }
    if (beat === 'thesis') c.ron.standT = 0;
    if (beat === 'tvlook') c.tvLook = 4.5;
    if (beat === 'tv') for (const m of Object.values(c.members)) m.glance = -2.2;
  }
  // Late lines are not lost: past their rung by a margin, Jules goes anyway.
  if (live && j.mode === 'seat' && d.multiplier >= 4.4) walkTo(c, 'toDoor', 'door');
  if (live && (j.mode === 'door' || j.mode === 'seat') && d.multiplier >= 8.2) walkTo(c, 'toMiddle', 'middle');
  // Jules walks at a steady pace and arrives in double support.
  if (j.mode === 'toDoor' || j.mode === 'toMiddle') {
    j.t += dt;
    const span = Math.hypot(j.to.x - j.from.x, j.to.y - j.from.y);
    if (j.t > 0.45) j.dist += WALK * dt * (j.mode === 'toMiddle' ? 1.1 : 1);
    if (j.dist >= span) {
      j.mode = j.mode === 'toDoor' ? 'door' : 'middle';
      j.dist = span;
      if (j.mode === 'door') ev.door = true;
    }
  }
  if (j.buzz > 0) {
    const before = j.buzz;
    j.buzz = Math.max(0, j.buzz - dt);
    if (Math.floor(before * 2.5) !== Math.floor(j.buzz * 2.5)) ev.buzz = true;
  }
  const stage = d.crashed ? 3 : d.running ? (d.multiplier >= 2.4 ? 2 : d.multiplier >= 1.95 ? 1 : 0) : 0;
  if (stage > j.stage) {
    j.stage = stage;
    j.flip.x = 0;
    j.flip.v = 0;
    ev.flip = true;
  } else if (stage < j.stage) j.stage = stage;
  stepSpring(j.flip, 1, 9, 0.5, dt);
  stepSpring(j.phone, live && d.multiplier >= 2.4 ? 1 : d.crashed ? 1 : j.phone.x > 0.5 ? 1 : 0, 6, 0.7, dt);
  // The room goes still for a few seconds after the stock guy's share.
  c.stillT += dt;
  stepSpring(c.still, c.stillT < 3.2 ? 1 : 0, 5, 1, dt);
  stepSpring(c.mic, c.mic.x > 0.3 || (live && d.multiplier >= 1.8) ? 1 : 0, 8, 0.55, dt);
  stepSpring(c.paper, live && d.multiplier >= 2.1 ? 1 : 0, 6, 0.6, dt);
  // Terry: the cup empties as the room concentrates; at each milestone he reaches back and refills it.
  if (d.rung > c.terry.rung) {
    if (live) {
      c.terry.reach.v += 9;
      ev.refill = true;
    }
    c.terry.rung = d.rung;
  }
  stepSpring(c.terry.reach, 0, 5, 0.75, dt);
  c.terry.eat += dt * (0.25 + 0.9 * d.tension) * (1 - 0.8 * c.still.x);
  // Ron: his watch on every share, standing for his thesis.
  if (d.line && live) {
    c.ron.watch.v += 5;
    ev.tick = true;
  }
  stepSpring(c.ron.watch, 0, 4.2, 0.8, dt);
  c.ron.standT += dt;
  stepSpring(c.ron.stand, live && c.ron.standT < 6 ? 1 : 0, 6, 0.7, dt);
  // The song, then back to tuning; the vegan's three cookies.
  c.song += dt;
  const playing = live && c.song < 9;
  const strumBefore = c.strum;
  c.strum += dt * (playing ? 2.6 : 0.6);
  if (playing && Math.floor(strumBefore) !== Math.floor(c.strum)) ev.strum = true;
  c.bites += dt;
  c.tvLook = Math.max(0, c.tvLook - dt);
  // Each member: lean toward Jules (Ron leads, the room follows him), heads to the speaker, the nametag check.
  const ron = c.members.ron;
  const target = live ? leanFor(d.tension, d.depth) : 0;
  stepSpring(ron.lean, target + (d.line && live ? 0.08 : 0), 3.2, 0.8, dt);
  const chest = julesChest(c);
  for (const m of Object.values(c.members)) {
    if (m.who !== 'ron' && m.who !== 'jules') {
      const follow = live ? clamp(ron.lean.x * (0.82 + 0.3 * noise(m.seed * 2)), 0, 1.1) : 0;
      stepSpring(m.lean, follow, 1.6 + noise(m.seed) * 1.2, 0.85, dt);
    }
    if (m.who === 'jules') stepSpring(m.lean, 0, 3, 0.9, dt);
    // A creak each time a member's lean passes another notch.
    const notch = Math.floor(clamp(m.lean.x, 0, 1.2) * 6);
    if (notch > m.creak && live) ev.creak += 1;
    m.creak = notch;
    if (d.line && m.who !== d.speaker) m.glance = 0.85 + 0.25 * noise(m.seed + d.time);
    m.glance = m.glance > 0 ? Math.max(0, m.glance - dt) : Math.min(0, m.glance + dt);
    // Where the head turns: the speaker, Jules (the nametag check, or from 7× everyone), the TV.
    let look: Joint | null = null;
    if (m.who === 'nurse' && c.tvLook > 0) look = { x: 880, y: 300 };
    else if (m.glance < 0) look = { x: 880, y: 300 };
    else if (m.glance > 0 || (live && d.multiplier >= 7 && m.who !== 'jules')) look = chest;
    else if (d.speaker && d.speaker !== m.who && d.talking(d.speaker) > 0) look = speakerHead(c, d.speaker);
    else if (live && m.who !== 'jules' && d.tension > 0.25) look = chest;
    const base = Math.atan2(m.seat.fx, m.seat.fz);
    let yaw = 0.35 * Math.sin(d.time * 0.23 + m.seed);
    if (look) {
      const dir = toward(m.seat.x, m.seat.y, look.x, look.y);
      yaw = Math.atan2(dir.x, dir.y) - base;
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    }
    // Heads turn, but not so far round that the face leaves us (front seats may look away; they face away anyway).
    const reach = m.seat.fz > 0.3 ? 0.95 - Math.abs(m.seat.fx) * 0.4 : 1.3;
    stepSpring(m.yaw, clamp(yaw, -reach, reach), 7 + noise(m.seed * 5) * 3, 0.75, dt);
    stepSpring(m.nod, 0, 9, 0.35, dt);
    stepSpring(m.laugh, 0, 3.5, 0.6, dt);
    stepSpring(m.gasp, live && d.multiplier >= 7 ? 0.35 : 0, 4, 0.7, dt);
    stepSpring(m.arm, d.talking(m.who) > 0 ? 1 : 0, 6, 0.6, dt);
    m.breath += dt * (1.1 + 1.6 * d.tension) * (1 - 0.7 * c.still.x);
    m.blink = Math.max(0, m.blink - dt);
    if ((m.blinkIn -= dt) <= 0) {
      m.blinks += 1;
      m.blink = 0.12;
      m.blinkIn = 2 + 3 * noise(m.seed * 5 + m.blinks);
    }
  }
  // Your share: stand, the line, fold the chair, take it under your arm with the cuppa, and go.
  const y = c.you;
  y.t += dt;
  if (y.mode === 'standing' && y.t > 1.6) {
    y.mode = 'folding';
    y.t = 0;
  } else if (y.mode === 'folding' && y.t > 1.1) {
    y.mode = 'walking';
    y.t = 0;
  } else if (y.mode === 'walking' && y.t > 4.2) y.mode = 'gone';
}

/** Your share begins. */
export function standUp(c: Circle): void {
  if (c.you.mode === 'seated') {
    c.you.mode = 'standing';
    c.you.t = 0;
  }
}

/** Where a member's head is, for bubble tails and looks. */
export function speakerHead(c: Circle, who: Who): Joint {
  const drawn = c.heads[who];
  if (drawn && !(who === 'ron' && c.ron.standT < 6 && c.ron.stand.x < 0.9)) return drawn;
  if (who === 'jules') {
    const at = julesAt(c);
    const s = depthScale(at.y);
    return { x: at.x, y: at.y - (c.jules.mode === 'seat' ? 138 : 178) * s };
  }
  if (who === 'you' && c.you.mode !== 'seated') {
    const at = youAt(c);
    return { x: at.x, y: at.y - 178 * depthScale(at.y) };
  }
  const st = SEATS[who];
  const m = c.members[who];
  const k = who === 'ron' ? 1.1 + 0.32 * (c.ron.standT < 6 ? 1 : clamp(c.ron.stand.x, 0, 1)) : 1;
  return { x: st.x + m.lean.x * 10 * st.s, y: st.y - 136 * st.s * k };
}

/** Where the YOU tag goes: over your head, seated, on your way out, or in the pile. */
export function youTagAt(c: Circle): Joint {
  const h = speakerHead(c, 'you');
  return { x: h.x, y: h.y - 4 };
}

/** A folding chair folded flat: the back and seat as one panel, the legs scissored shut, held upright. */
export function drawFoldedChair(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, -48);
  ctx.lineTo(-6, 46);
  ctx.moveTo(9, -48);
  ctx.lineTo(6, 46);
  ctx.moveTo(-9, 8);
  ctx.lineTo(9, 30);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = METAL;
  ctx.lineWidth = 4;
  ctx.stroke();
  box(ctx, -12, -46, 24, 22, 3, METAL, 2.2);
  box(ctx, -11, -18, 22, 26, 3, METAL_DARK, 2.2);
  ctx.restore();
}

/** Where your figure is on the floor during your share. */
export function youAt(c: Circle): Joint {
  const st = SEATS.you;
  if (c.you.mode === 'walking') {
    const k = clamp(c.you.t / 4.2, 0, 1);
    return { x: mix(st.x + 34, EXIT_TO.x, k), y: mix(st.y + 8, EXIT_TO.y, k) };
  }
  return { x: st.x + (c.you.mode === 'seated' ? 0 : 34), y: st.y + (c.you.mode === 'seated' ? 0 : 8) };
}

// ─── The crash, closed-form in the crash clock ───────────────────────────────────────────────────────────
/** The crash's beats, in seconds of the crash clock, front-loaded so the ending is whole by ENDING_S even live. */
export const BEAT = { thumb: 0, stand: 0.3, urn: 0.55, chord: 1.3, ronGo: 1.15, ronDown: 1.55, pin1: 2.1, pin2: 2.7, hug: 2.9, cup: 4.0 } as const;
/** When the final image is complete. */
export const ENDING_S = 6;
/** The pile: where each member ends up (x, y floor), their facing, kneel and roll, and the order they join. */
const PILE: Record<Who, { x: number; y: number; fx: number; roll: number; order: number; perch: number; lie?: boolean }> = {
  podcast: { x: 640, y: 412, fx: -0.8, roll: 0.5, order: 0, perch: 6 },
  guitar: { x: 320, y: 414, fx: 0.8, roll: -0.5, order: 1, perch: 6 },
  nurse: { x: 562, y: 404, fx: -0.6, roll: 0.22, order: 2, perch: 22 },
  terry: { x: 398, y: 404, fx: 0.6, roll: -0.22, order: 3, perch: 22 },
  vegan: { x: 372, y: 446, fx: 0.7, roll: -0.42, order: 4, perch: 4 },
  stock: { x: 590, y: 448, fx: -0.7, roll: 0.42, order: 5, perch: 4 },
  cookie: { x: 668, y: 462, fx: -0.9, roll: 0.75, order: 6, perch: 0 },
  you: { x: 292, y: 466, fx: 0.9, roll: -0.75, order: 7, perch: 0 },
  twinA: { x: 444, y: 458, fx: 0.4, roll: -0.18, order: 8, perch: 8 },
  twinB: { x: 520, y: 460, fx: -0.4, roll: 0.18, order: 9, perch: 8 },
  jules: { x: 482, y: 420, fx: 0, roll: 0.04, order: 10, perch: 46 },
  ron: { x: 476, y: 492, fx: 0, roll: 0, order: -1, perch: 0, lie: true },
};
export const HOP_S = 0.5;
export const PILE_STEP = 0.1;
export const hopStart = (who: Who, seed: number): number => BEAT.hug + PILE[who].order * PILE_STEP + noise(seed + PILE[who].order) * 0.05;
/** When the last member lands in the pile. */
export const PILE_DONE = BEAT.hug + 10 * PILE_STEP + 0.05 + HOP_S;
/** A landing's squash: a ring-down that is a pure function of time since the landing. */
const squashAt = (age: number): number => (age < 0 ? 0 : Math.sin(age * 17) * Math.exp(-age * 5) * 0.28);
/** The pile's slow squeeze while it holds on. */
export const squeeze = (t: number): number => (t > PILE_DONE ? 0.025 * Math.sin((t - PILE_DONE) * 2.2) : 0);

export interface CrashPlace { x: number; y: number; s: number; rot: number; stand: number; hug: number; sq: number; fly: number; lie: number }
/** Where a member is during the crash: up at once, then the hop into the pile with a squash on landing. */
export function crashPlace(c: Circle, who: Who, t: number, from: Joint): CrashPlace {
  const stand = smoothstep(BEAT.stand, BEAT.stand + 0.08, t);
  const pile = PILE[who];
  const jit = mulberry32(c.crashSeed + pile.order * 977 + 13);
  const jx = (jit() - 0.5) * 16;
  const jy = (jit() - 0.5) * 8;
  if (who === 'ron') {
    // Big Ron staggers to the middle of the circle and goes down flat on his back.
    const go = smoothstep(BEAT.ronGo, BEAT.ronDown, t);
    const down = smoothstep(BEAT.ronDown, BEAT.ronDown + 0.3, t);
    const x = mix(from.x, pile.x + jx * 0.5, go);
    const y = mix(from.y, pile.y, go);
    return { x, y, s: depthScale(y), rot: -Math.PI / 2 * down * 0.98, stand, hug: 0, sq: squashAt(t - BEAT.ronDown - 0.3), fly: 0, lie: down };
  }
  const start = hopStart(who, c.crashSeed);
  const u = clamp((t - start) / HOP_S, 0, 1);
  const e = smoothstep(0, 1, u);
  const x = mix(from.x, pile.x + jx, e);
  const y = mix(from.y, pile.y + jy, e);
  const lift = Math.sin(Math.PI * u) * 46;
  const roll = pile.roll + (jit() - 0.5) * 0.12;
  // Some land on top of the others; Jules on top of the pile, in the middle of it.
  const perch = pile.perch * e;
  return { x, y: y - lift - perch, s: depthScale(y), rot: roll * e, stand, hug: e, sq: squashAt(t - start - HOP_S), fly: u > 0 && u < 1 ? 1 : 0, lie: 0 };
}
/** The pile's draw order: back of the pile first, Jules on top, Big Ron in front. */
export const pileKey = (who: Who): number => (who === 'ron' ? 999 : who === 'jules' ? 490 : PILE[who].y + PILE[who].perch * 0.2);

// ─── Drawing the circle ──────────────────────────────────────────────────────────────────────────────────
export interface CircleView {
  time: number;
  tension: number;
  multiplier: number;
  running: boolean;
  crashed: boolean;
  crashT: number;
  talking: (who: Who) => number;
  /** The phone's screen state: 'dark', 'lit' (the chart), 'bought' (BOUGHT THE TOP). */
  secured: boolean;
  exitAge: number;
  /** Seconds the puddle has reached Jules's shoe (for his look down), or −1. */
  wet: number;
  /** Which members are in the doorway view only (the player has gone). */
  youGone: boolean;
}

function faceOf(m: Member, v: CircleView, c: Circle): Face {
  const talk = v.talking(m.who);
  const laugh = clamp(m.laugh.x, 0, 1.2);
  const mouth = talk * (0.45 + 0.55 * Math.abs(Math.sin(v.time * 13 + m.seed))) + laugh * 0.5 * Math.abs(Math.sin(v.time * 18 + m.seed));
  const worry = smoothstep(0.2, 0.9, v.tension) * (m.who === 'cookie' ? 0.2 : 0.8);
  return {
    mouth,
    smile: 0.25 + laugh * 0.8 - worry * 0.35,
    o: clamp(m.gasp.x, 0, 1) * (talk > 0 ? 0 : 1),
    brow: worry + 0.6 * clamp(m.gasp.x, 0, 1),
    shut: m.blink > 0 ? 1 : 0,
    happy: laugh > 0.6 ? 1 : 0,
    look: { x: clamp(m.yaw.x * 0.6, -1, 1), y: m.who === 'jules' && c.jules.phone.x > 0.5 ? 0.9 : 0.1 },
  };
}

/** One draw item: its depth (floor y) and how to draw it. */
export interface Item { y: number; draw: () => void }

/** Every person and chair of the circle as depth-sorted draw items, for the scene to merge with the set. */
export function circleItems(ctx: CanvasRenderingContext2D, c: Circle, v: CircleView): Item[] {
  const items: Item[] = [];
  for (const who of ORDER) {
    const m = c.members[who];
    if (who === 'you' && (v.youGone || c.you.mode === 'gone' || (v.crashed && v.secured))) continue;
    if (v.crashed) {
      const from = who === 'jules' ? c.julesAtCrash : { x: m.seat.x, y: m.seat.y };
      const at = crashPlace(c, who, v.crashT, from);
      if (who !== 'jules') items.push({ y: m.seat.y - 0.5, draw: () => drawTippedChair(ctx, c, m, v.crashT) });
      const hugged = at.hug > 0.5 || at.lie > 0.5;
      items.push({ y: hugged ? 1000 + pileKey(who) : at.y + (at.fly ? 60 : 0), draw: () => drawCrashMember(ctx, c, m, v, at) });
      continue;
    }
    if (who === 'jules' && c.jules.mode !== 'seat') {
      items.push({ y: m.seat.y - 0.5, draw: () => chairAt(ctx, m.seat, 'all') });
      const at = julesAt(c);
      items.push({ y: at.y, draw: () => drawJulesStanding(ctx, c, m, v, at) });
      continue;
    }
    if (who === 'you' && c.you.mode !== 'seated') {
      if (c.you.mode !== 'walking') items.push({ y: m.seat.y - 0.5, draw: () => chairAt(ctx, m.seat, 'all', c.you.mode === 'folding' ? smoothstep(0.1, 0.8, c.you.t) : 0) });
      const at = youAt(c);
      items.push({ y: at.y + 1, draw: () => drawYouStanding(ctx, c, m, v, at) });
      continue;
    }
    items.push({ y: m.seat.y, draw: () => drawSeated(ctx, c, m, v) });
  }
  return items;
}

function chairAt(ctx: CanvasRenderingContext2D, seat: Seat, part: 'all' | 'base' | 'back', folded = 0): void {
  ctx.save();
  ctx.translate(seat.x, seat.y);
  ctx.scale(seat.s, seat.s);
  drawChair(ctx, seat.fx, seat.fz, part, folded);
  ctx.restore();
}

/** At the crash every chair is kicked back as its member jumps up, and lands on its side. */
function drawTippedChair(ctx: CanvasRenderingContext2D, c: Circle, m: Member, t: number): void {
  if (m.who === 'you' && c.you.mode !== 'seated') return;
  const seat = m.seat;
  const r = mulberry32(c.crashSeed * 3 + m.seed * 101);
  const dir = seat.x < CENTER.x - 30 ? -1 : seat.x > CENTER.x + 30 ? 1 : r() < 0.5 ? -1 : 1;
  const start = BEAT.stand + r() * 0.06;
  const u = clamp((t - start) / 0.32, 0, 1);
  const fall = u < 1 ? u * u : 1 + Math.sin((t - start - 0.32) * 20) * Math.exp(-(t - start - 0.32) * 7) * 0.08;
  // The YOU chair rides the pile's edge once you jump in.
  let x = seat.x + dir * 22 * clamp(u * 2, 0, 1) * seat.s;
  let y = seat.y;
  if (m.who === 'you') {
    const k = smoothstep(hopStart('you', c.crashSeed), hopStart('you', c.crashSeed) + 0.5, t);
    x = mix(x, PILE.you.x - 40, k);
    y = mix(y, PILE.you.y + 18, k);
  }
  const draw = (g: CanvasRenderingContext2D): void => {
    g.scale(seat.s, seat.s);
    g.rotate(dir * 1.45 * clamp(fall, 0, 1.1));
    g.translate(-dir * 16, 0);
    drawChair(g, seat.fx, seat.fz, 'all');
  };
  const still = t > start + 1 && (m.who !== 'you' || t > hopStart('you', c.crashSeed) + 0.6);
  if (still) viaSprite(ctx, `chair:${m.who}`, 0, { x, y }, seat.s, 30, draw, 120);
  else {
    ctx.save();
    ctx.translate(x, y);
    draw(ctx);
    ctx.restore();
  }
}

/** The common pose of a seated member: lean toward Jules, breathing, the head to whoever they look at. */
function seatedPose(c: Circle, m: Member, v: CircleView): Pose {
  const st = m.seat;
  const chest = julesChest(c);
  const dir = m.who === 'jules' ? { x: 0, y: 1 } : toward(st.x, st.y, chest.x, chest.y);
  const lean = clamp(m.lean.x, -0.5, 1.15);
  const breath = Math.sin(m.breath * 2.2) * (0.6 + 0.4 * (1 - c.still.x));
  const laugh = clamp(m.laugh.x, 0, 1.2) * Math.abs(Math.sin(v.time * 17 + m.seed)) * 3;
  return {
    fx: st.fx,
    fz: st.fz,
    sit: 1,
    kneel: 0,
    lean: { x: dir.x * 16 * lean + Math.sin(v.time * 0.7 + m.seed) * 1.2, y: dir.y * P * 16 * lean + lean * 7 - laugh },
    // Side seats keep at least a profile toward us; the front row is seen from behind anyway.
    yaw: st.fz > -0.5 ? clamp(Math.atan2(st.fx, st.fz) + m.yaw.x, -1.6, 1.6) : Math.atan2(st.fx, st.fz) + m.yaw.x,
    nod: m.nod.x * 0.18 + lean * 3,
    breath,
    hands: [null, null],
    feet: null,
    face: faceOf(m, v, c),
  };
}

/** A seated member with their chair and their props, from the back of the circle or the front. */
function drawSeated(ctx: CanvasRenderingContext2D, c: Circle, m: Member, v: CircleView): void {
  const st = m.seat;
  const big = m.who === 'ron' ? 1.06 : 1;
  viaSprite(ctx, m.who, ORDER.indexOf(m.who), st, st.s * big, v.talking(m.who) > 0 ? 2 : 4, (g) => {
    const pose = seatedPose(c, m, v);
    const props = propsFor(g, c, m, v, pose);
    g.scale(st.s * big, st.s * big);
    const away = st.fz < -0.25;
    if (m.who === 'ron' && c.ron.stand.x > 0.02) {
      // Big Ron, up for his thesis, the chair behind him.
      drawChair(g, st.fx, st.fz, 'all');
      pose.sit = 1 - clamp(c.ron.stand.x, 0, 1);
      pose.feet = null;
    } else drawChair(g, st.fx, st.fz, away ? 'base' : 'all');
    const frame = drawPerson(g, m.look, pose, props);
    c.heads[m.who] = { x: st.x + frame.head.x * st.s * big, y: st.y + frame.head.y * st.s * big };
    if (away) {
      // The chair's back between us and them; the shoulders and head above it.
      drawChair(g, st.fx, st.fz, 'back');
      redrawUpper(g, m, pose, frame);
    }
    drawNametag(g, c, m, frame, v);
  });
}

// ─── Sprites: a still member is drawn into its own canvas on twos or threes and blitted in between ─────────
interface Sprite { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; w: number; h: number; ox: number; oy: number; frame: number; at: string }
const sprites = new Map<string, Sprite>();
let spriteFrame = 0;
/** Called once per drawn frame. */
export function tickSprites(): void {
  spriteFrame += 1;
}
/** Forces every sprite to redraw on its next use (a new round, a new scene). */
export function invalidateSprites(): void {
  for (const sp of sprites.values()) {
    sp.frame = -99;
    sp.at = '';
  }
}

/**
 * Draws `render` (which draws at the origin, unscaled by us) at `at`, through a cached canvas that is redrawn every
 * `period` frames, staggered by `slot` so the circle's members take turns. Without a document it draws directly.
 */
function viaSprite(ctx: CanvasRenderingContext2D, id: string, slot: number, at: Joint, scale: number, period: number, render: (g: CanvasRenderingContext2D) => void, half = 96): void {
  // Tight bounds in body units: x ±96 (wider for a rolled or lying body), from 232 above the floor to 36 below.
  const w = Math.ceil(2 * half * scale) + 4;
  const h = Math.ceil(268 * scale) + 4;
  let sp = sprites.get(id);
  if ((!sp || sp.w !== w || sp.h !== h) && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (g) {
      sp = { canvas, g, w, h, ox: Math.ceil(half * scale) + 2, oy: Math.ceil(232 * scale) + 2, frame: -99, at: '' };
      sprites.set(id, sp);
    }
  }
  if (!sp || sp.w !== w || sp.h !== h) {
    ctx.save();
    ctx.translate(at.x, at.y);
    render(ctx);
    ctx.restore();
    return;
  }
  const ix = Math.floor(at.x);
  const iy = Math.floor(at.y);
  const key = `${ix}:${iy}`;
  if (sp.frame !== spriteFrame && (sp.at !== key || spriteFrame - sp.frame >= period || (spriteFrame + slot) % period === 0)) {
    sp.g.setTransform(1, 0, 0, 1, 0, 0);
    sp.g.clearRect(0, 0, w, h);
    sp.g.translate(sp.ox + at.x - ix, sp.oy + at.y - iy);
    render(sp.g);
    sp.frame = spriteFrame;
    sp.at = key;
  }
  ctx.drawImage(sp.canvas, ix - sp.ox, iy - sp.oy);
}

/** Above a chair back seen from behind: the head and anything held up, drawn again so the back does not hide them. */
function redrawUpper(ctx: CanvasRenderingContext2D, m: Member, pose: Pose, frame: Frame): void {
  drawHead(ctx, m.look, frame.head, frame.r, pose.yaw, pose.face);
}

/** The small hello-my-name-is tag on every chest; Jules's is big, and flips. */
function drawNametag(ctx: CanvasRenderingContext2D, c: Circle, m: Member, f: Frame, v: CircleView): void {
  if (!f.front || Math.abs(m.seat.fz) < 0.2 && m.who !== 'jules') return;
  const fx = m.who === 'jules' ? 0 : m.seat.fx;
  const x = f.chest.x + 6 - fx * 4;
  const y = f.chest.y + 20;
  if (m.who !== 'jules') {
    ctx.fillStyle = '#fbf8f0';
    ink(ctx, 1.2);
    ctx.fillRect(x - 9, y - 5, 18, 11);
    ctx.strokeRect(x - 9, y - 5, 18, 11);
    ctx.fillStyle = '#d23a3a';
    ctx.fillRect(x - 9, y - 5, 18, 3);
    ctx.fillStyle = 'rgba(29,20,24,0.55)';
    ctx.fillRect(x - 6, y + 1.5, 12, 1.6);
    return;
  }
  julesTag(ctx, c, x - 2, y - 2, 1, v);
}

/** Jules's nametag: 12 DAYS, 3 DAYS, DAY 0, and DAY 0 AGAIN in the pile, flipping over on each change. */
export function julesTag(ctx: CanvasRenderingContext2D, c: Circle, x: number, y: number, scale: number, v: CircleView): void {
  const stage = v.crashed ? 3 : c.jules.stage;
  const flip = clamp(c.jules.flip.x, 0, 1.2);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale * Math.max(0.08, Math.abs(Math.cos(Math.PI * clamp(1 - flip, 0, 1)))));
  const bad = stage >= 2;
  ctx.fillStyle = '#fbf8f0';
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.roundRect(-17, -9, 34, 21, 2.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = bad ? '#d8323a' : '#2f7fd0';
  ctx.fillRect(-17, -9, 34, 6);
  label(ctx, 'HELLO', 0, -6, 4.4, '#ffffff', 900, 30);
  const text = stage === 3 ? 'DAY 0 AGAIN' : ['12 DAYS', '3 DAYS', 'DAY 0'][stage]!;
  label(ctx, text, 0, 4.5, stage === 3 ? 6.4 : 8, bad ? '#c21f2a' : INK, 900, 31);
  ctx.restore();
}

/** Props in hands, per member, as pose edits and draw hooks. */
function propsFor(ctx: CanvasRenderingContext2D, c: Circle, m: Member, v: CircleView, pose: Pose): { under?: (f: Frame) => void; held?: (f: Frame) => void; over?: (f: Frame) => void } {
  const t = v.time;
  const talk = v.talking(m.who);
  const arm = clamp(m.arm.x, 0, 1);
  const side = m.seat.fx >= 0 ? 1 : -1;
  // A free hand that gestures while its owner talks.
  const gesture = (i: 0 | 1, sx: number): void => {
    if (arm < 0.05) return;
    pose.hands[i] = { x: sx * (18 + 6 * Math.sin(t * 5 + m.seed)) * arm + sx * 4, y: 30 - 34 * arm + Math.sin(t * 7.3 + m.seed) * 5 * arm * talk };
  };
  switch (m.who) {
    case 'terry': {
      // The snack cup in his right hand, eaten from with the left; refilled from the table behind him.
      const reach = clamp(c.terry.reach.x, 0, 1.2);
      const eat = Math.max(0, Math.sin(c.terry.eat * Math.PI * 2)) ** 6;
      pose.hands[1] = { x: 16 + 6 * arm, y: 34 - 26 * arm - 30 * reach };
      pose.hands[0] = reach > 0.05 ? { x: -10, y: -40 * reach } : { x: -4 + 8 * eat, y: 34 - 48 * eat };
      return { over: (f) => drawSnackCup(ctx, c, f.hands[1], v) };
    }
    case 'jules': {
      const up = clamp(c.jules.phone.x, 0, 1);
      pose.hands[1] = { x: 6 - 2 * up, y: mix(42, 12, up) };
      pose.hands[0] = { x: -2 + 2 * up, y: mix(44, 16, up) };
      pose.nod += up * 5;
      if (c.jules.buzz > 0 && up < 0.5) pose.face.look = { x: -0.9, y: -0.6 };
      gesture(0, -1);
      return { over: (f) => drawPhone(ctx, c, f.hands[1], v, 1) };
    }
    case 'ron': {
      // His watch on the left wrist: up to his face at every share.
      const w = clamp(c.ron.watch.x, 0, 1);
      pose.hands[0] = { x: -6 + 8 * w, y: 34 - 54 * w };
      if (w > 0.4) pose.face.look = { x: -0.4, y: 1 };
      gesture(1, 1);
      return { over: (f) => drawWatch(ctx, f.hands[0], t) };
    }
    case 'guitar': {
      // The guitar across his lap: tuning the pegs, or strumming the anthem.
      const playing = c.song < 9 && v.running && !v.crashed;
      const strum = playing ? Math.sin(c.strum * Math.PI * 2) : 0.15 * Math.sin(t * 1.3);
      pose.hands[1] = { x: side * 4 + strum * 3, y: 40 + strum * 8 };
      pose.hands[0] = { x: side * 40, y: 26 + Math.sin(t * (playing ? 6 : 2.1)) * 2 };
      return { held: (f) => drawGuitar(ctx, f, side, playing ? 1 : 0, t) };
    }
    case 'podcast': {
      const mic = clamp(c.mic.x, 0, 1.2);
      pose.hands[1] = { x: side * mix(4, 14, mic), y: mix(40, -4, mic) };
      gesture(0, -side);
      return { over: (f) => (mic > 0.05 ? drawMic(ctx, f.hands[1], side, mic) : undefined) };
    }
    case 'vegan': {
      // Three cookies, one after another, after her share; a napkin of them on her lap.
      const bite = c.bites < 6 ? Math.max(0, Math.sin((c.bites / 2) * Math.PI * 2 - 0.5)) : 0;
      pose.hands[1] = { x: side * 6, y: 40 - 46 * bite };
      if (bite > 0.6) pose.face.mouth = Math.max(pose.face.mouth, 0.4 * Math.abs(Math.sin(t * 16)));
      gesture(0, -side);
      return { held: (f) => drawNapkin(ctx, f, bite, c.bites), over: (f) => (bite > 0.05 ? drawCookie(ctx, f.hands[1].x, f.hands[1].y - 2, 5) : undefined) };
    }
    case 'stock': {
      // The old trade slip, unfolded for his share.
      const paper = clamp(c.paper.x, 0, 1);
      pose.hands[0] = { x: -side * 4, y: mix(40, 18, paper) };
      pose.hands[1] = { x: side * 10, y: mix(40, 20, paper) };
      return { over: (f) => drawSlip(ctx, f, paper) };
    }
    case 'cookie': {
      // A plate on his lap, munching steadily.
      const munch = Math.max(0, Math.sin(t * 1.9 + m.seed)) ** 3;
      pose.hands[1] = { x: side * 6, y: 40 - 42 * munch };
      pose.face.mouth = Math.max(pose.face.mouth, munch > 0.5 ? 0.3 * Math.abs(Math.sin(t * 15)) : 0);
      return { under: (f) => drawPlate(ctx, f, c), over: (f) => (munch > 0.1 ? drawCookie(ctx, f.hands[1].x, f.hands[1].y - 2, 5) : undefined) };
    }
    case 'you': {
      // Your cuppa, held in both hands; the shoulders rise as it gets worse.
      pose.hands[0] = { x: -4, y: 36 };
      pose.hands[1] = { x: 6, y: 34 };
      pose.lean.y -= 6 * smoothstep(0.1, 0.9, v.tension);
      return { under: (f) => drawCuppa(ctx, f.hands[1].x, f.hands[1].y - 4, 1) };
    }
    case 'nurse':
      if (v.running && v.multiplier >= 1.55 && v.multiplier < 1.9) pose.hands[0] = { x: 2, y: 18 };
      gesture(1, side);
      return {};
    case 'twinA':
    case 'twinB':
      gesture(m.who === 'twinA' ? 1 : 0, m.who === 'twinA' ? 1 : -1);
      return {};
    default:
      return {};
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────────────────────────────────
/** Terry's cup level: emptied as the round climbs between milestones, refilled to the top at each one. */
export function cupLevel(multiplier: number, rungs: readonly number[]): number {
  let lo = 1;
  let hi = rungs[0]!;
  for (const r of rungs) {
    if (multiplier >= r) lo = r;
    else {
      hi = r;
      break;
    }
    hi = r * 2;
  }
  const k = clamp(Math.log(multiplier / lo) / Math.log(hi / lo), 0, 1);
  return 1 - 0.78 * k;
}

function drawSnackCup(ctx: CanvasRenderingContext2D, c: Circle, hand: Joint, v: CircleView): void {
  const size = 1 + 0.45 * clamp(Math.log10(Math.max(1, v.multiplier)) / 2, 0, 1);
  const fill = v.running || v.crashed ? c.cupFill : 0.9;
  ctx.save();
  ctx.translate(hand.x, hand.y - 4);
  ctx.scale(size, size);
  // The cup, the snacks heaped in it (over the brim at the top), the stripe.
  ctx.fillStyle = '#f6efe2';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-9, -22);
  ctx.lineTo(9, -22);
  ctx.lineTo(6.5, 4);
  ctx.lineTo(-6.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d64a3c';
  ctx.fillRect(-7.6, -12, 15.2, 4);
  const level = -22 + 22 * (1 - clamp(fill, 0, 1));
  const heap = fill > 0.85 ? (fill - 0.85) * 40 : 0;
  ctx.fillStyle = '#d9a35a';
  ink(ctx, 1.4);
  for (let i = 0; i < 5; i += 1) {
    const x = -6 + i * 3;
    const y = level - heap * Math.sin(((i + 0.5) / 5) * Math.PI) + (i % 2) * 1.5;
    if (fill < 0.06) break;
    ctx.beginPath();
    ctx.arc(x, y + 1, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Jules's phone, the tell: the chart, the BUY button and his thumb hovering over it, lower as it gets worse. */
export function drawPhone(ctx: CanvasRenderingContext2D, c: Circle, hand: Joint, v: CircleView, scale: number): void {
  const up = clamp(c.jules.phone.x, 0, 1);
  const k = scale * (1 + 0.35 * up + 0.3 * clamp(v.tension, 0, 1) * up);
  const bought = v.crashed;
  const lit = up > 0.3 || c.jules.buzz > 0 || bought;
  ctx.save();
  ctx.translate(hand.x - 2, hand.y - 6 - 8 * up);
  ctx.scale(k, k);
  ctx.rotate(mix(0.9, 0.05, up));
  if (lit) {
    // The screen's glow on everything near it.
    ctx.fillStyle = bought ? 'rgba(255,80,80,0.22)' : 'rgba(150,255,190,0.16)';
    ctx.beginPath();
    ctx.arc(0, -6, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  box(ctx, -8, -20, 16, 28, 3.5, '#1f2230', 1.8);
  const screen = bought ? (Math.floor(v.crashT * 6) % 2 === 0 ? '#ff3b4a' : '#ffffff') : lit ? '#0f2a1f' : '#2b2f3d';
  ctx.fillStyle = screen;
  ctx.fillRect(-6, -18, 12, 23);
  if (bought) {
    label(ctx, 'BOUGHT', 0, -10, 3.6, Math.floor(v.crashT * 6) % 2 === 0 ? '#ffffff' : '#d21f2f', 900, 11);
    label(ctx, 'THE TOP', 0, -5, 3.6, Math.floor(v.crashT * 6) % 2 === 0 ? '#ffffff' : '#d21f2f', 900, 11);
  } else if (lit) {
    // The chart climbing, and the BUY button.
    ctx.strokeStyle = '#4dff8a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 8; i += 1) {
      const x = -5 + i * 1.25;
      const y = -6 - (i / 8) ** 2 * 9 - Math.sin(i * 2.3 + v.time * 3) * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#2bd46a';
    ctx.fillRect(-5, -1, 10, 5);
    label(ctx, 'BUY', 0, 1.6, 3.5, '#06240f', 900, 9);
  }
  // The thumb: hovering over the button, closer as the tension rises, trembling; down at the crash.
  const hover = bought ? 0 : mix(13, 1.6, smoothstep(0.02, 0.95, v.tension)) * mix(1.4, 1, up);
  const tremble = bought ? 0 : Math.sin(v.time * 31) * (0.3 + 1.2 * v.tension);
  if (lit) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(1 + hover * 0.25, 2, 3.2, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f3d2b3';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.ellipse(2 + hover * 0.35 + tremble * 0.3, 1.5 - hover + tremble * 0.2, 3.4, 4.6, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (c.jules.buzz > 0 && !bought) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    const w = Math.sin(v.time * 40) * 1.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 11 + w, -16);
      ctx.lineTo(s * 13 + w, -10);
      ctx.moveTo(s * 11 - w, -4);
      ctx.lineTo(s * 13 - w, 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWatch(ctx: CanvasRenderingContext2D, hand: Joint, t: number): void {
  ctx.fillStyle = '#e0b64a';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.arc(hand.x + 3, hand.y + 7, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  const a = Math.floor(t) * ((Math.PI * 2) / 60);
  ctx.beginPath();
  ctx.moveTo(hand.x + 3, hand.y + 7);
  ctx.lineTo(hand.x + 3 + Math.sin(a) * 3.4, hand.y + 7 - Math.cos(a) * 3.4);
  ctx.stroke();
}

/** Notes drifting up off the guitar while the anthem plays; one flat, once, for the minor chord. */
export function drawNotes(ctx: CanvasRenderingContext2D, c: Circle, v: CircleView): void {
  const head = c.heads.guitar;
  if (!head) return;
  ctx.font = `900 20px ${MEME_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  if (v.crashed) {
    const age = v.crashT - BEAT.chord;
    if (age < 0 || age > 1.8) return;
    ctx.globalAlpha = clamp(1.4 - age / 1.3, 0, 1);
    ctx.font = `900 34px ${MEME_FONT}`;
    ctx.strokeText('♭', head.x + 40, head.y - 30 - age * 18);
    ctx.fillStyle = '#9fb8ff';
    ctx.fillText('♭', head.x + 40, head.y - 30 - age * 18);
    ctx.globalAlpha = 1;
    return;
  }
  if (!v.running || c.song > 9.5) return;
  for (let k = 0; k < 4; k += 1) {
    const a = (c.song * 0.9 + k * 0.25) % 1;
    const x = head.x + 30 + Math.sin(a * 6 + k) * 10 + k * 8;
    const y = head.y + 30 - a * 90;
    ctx.globalAlpha = Math.sin(Math.PI * a) * clamp(9.5 - c.song, 0, 1);
    ctx.strokeText(k % 2 ? '♫' : '♪', x, y);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(k % 2 ? '♫' : '♪', x, y);
  }
  ctx.globalAlpha = 1;
}

function drawGuitar(ctx: CanvasRenderingContext2D, f: Frame, side: number, playing: number, t: number): void {
  const body = { x: f.hip.x + side * 4, y: f.hip.y - 8 };
  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(side * -0.28);
  // The neck out to the side, the headstock with pegs.
  ctx.fillStyle = '#5a3a1e';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(side > 0 ? 6 : -58, -3, 52, 6, 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(side > 0 ? 54 : -66, -5, 12, 10, 2);
  ctx.fill();
  ctx.stroke();
  // The body.
  ctx.fillStyle = '#c98a3e';
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.ellipse(-side * 6, 0, 15, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(side * 8, 0, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(side * 2, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 0.8;
  for (const dy of [-1.5, 0, 1.5]) {
    ctx.beginPath();
    ctx.moveTo(-side * 14, dy);
    ctx.lineTo(side * 58, dy + Math.sin(t * 50) * 0.6 * playing);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMic(ctx: CanvasRenderingContext2D, hand: Joint, side: number, mic: number): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(side * 0.5);
  ctx.scale(clamp(mic, 0, 1.1), clamp(mic, 0, 1.1));
  box(ctx, -2.5, -4, 5, 14, 2, '#2a2a33', 1.5);
  ctx.fillStyle = '#9aa0ad';
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.arc(0, -8, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawCookie(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#d9a35a';
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4a2a18';
  ctx.fillRect(x - r * 0.4, y - r * 0.3, r * 0.3, r * 0.3);
  ctx.fillRect(x + r * 0.2, y + r * 0.1, r * 0.3, r * 0.3);
}

function drawNapkin(ctx: CanvasRenderingContext2D, f: Frame, bite: number, bites: number): void {
  const x = f.hip.x;
  const y = f.hip.y + 2;
  ctx.fillStyle = '#ffffff';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.ellipse(x, y, 13, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const left = bites < 6 ? 3 - Math.min(3, Math.floor(bites / 2 + 0.3)) : 0;
  for (let i = 0; i < Math.max(left, 1); i += 1) drawCookie(ctx, x - 5 + i * 5, y - 1, 3.6);
  void bite;
}

function drawSlip(ctx: CanvasRenderingContext2D, f: Frame, paper: number): void {
  const x = (f.hands[0].x + f.hands[1].x) / 2;
  const y = (f.hands[0].y + f.hands[1].y) / 2 - 6;
  const w = mix(6, 20, paper);
  ctx.fillStyle = '#f2e6b8';
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - 10);
  ctx.lineTo(x + w / 2, y - 12);
  ctx.lineTo(x + w / 2 + 1, y + 8);
  ctx.lineTo(x - w / 2, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (paper > 0.5) {
    label(ctx, 'SOLD', x, y - 5, 4.6, '#b22a2a', 900, w);
    label(ctx, '2009', x, y + 2, 4.2, INK, 800, w);
  }
}

function drawPlate(ctx: CanvasRenderingContext2D, f: Frame, c: Circle): void {
  const x = f.hip.x + 4;
  const y = f.hip.y + 2;
  ctx.fillStyle = '#f4f1ea';
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.ellipse(x, y, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 4; i += 1) drawCookie(ctx, x - 8 + i * 5.5, y - 2 - (i % 2) * 2, 3.8);
  void c;
}

export function drawCuppa(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#f4efe4';
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(-5, -9);
  ctx.lineTo(5, -9);
  ctx.lineTo(4, 4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(-4.6, -8.5, 9.2, 2.5);
  ctx.restore();
}

// ─── Standing and walking: Jules, and you on your way out ───────────────────────────────────────────────
function drawJulesStanding(ctx: CanvasRenderingContext2D, c: Circle, m: Member, v: CircleView, at: Joint): void {
  const j = c.jules;
  const s = depthScale(at.y);
  const walking = j.mode === 'toDoor' || j.mode === 'toMiddle';
  const rise = walking ? smoothstep(0, 0.45, j.t) : 1;
  // Facing: the way he walks, the door (his back to us), or the room.
  let fx = 0;
  let fz = 1;
  if (walking) {
    const d = toward(j.from.x, j.from.y, j.to.x, j.to.y);
    fx = d.x;
    fz = d.y;
  } else if (j.mode === 'door') {
    fx = 0.45;
    fz = -0.89;
  }
  const lookBack = j.mode === 'door' && v.multiplier >= 4.5 ? 1.5 : 0;
  const face = faceOf(m, v, c);
  face.look = { x: 0, y: 0.9 };
  const pose: Pose = {
    fx,
    fz,
    sit: 1 - rise,
    kneel: 0,
    lean: { x: 0, y: 2 },
    yaw: Math.atan2(fx, fz) - lookBack * (fx >= 0 ? 1 : -1),
    nod: 5,
    breath: Math.sin(m.breath * 2.2),
    hands: [{ x: -6, y: 40 }, { x: 8, y: 36 }],
    feet: walking && j.dist > 0 ? [walkingFoot(j.dist, 64, 0, 9), walkingFoot(j.dist, 64, 0.5, 9)] : null,
    face,
  };
  if (pose.feet) pose.lean.y += Math.abs(Math.sin((j.dist / 64) * Math.PI * 2)) * -1.5;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(s, s);
  const frame = drawPerson(ctx, m.look, pose, { over: (f) => (fz > -0.3 ? drawPhone(ctx, c, f.hands[1], v, 1.05) : drawPhoneGlow(ctx, f, v)) });
  c.heads.jules = { x: at.x + frame.head.x * s, y: at.y + frame.head.y * s };
  if (fz > -0.3) drawNametag(ctx, c, m, frame, v);
  ctx.restore();
}

/** Jules at the door from behind: only the phone's glow round his head. */
function drawPhoneGlow(ctx: CanvasRenderingContext2D, f: Frame, v: CircleView): void {
  ctx.fillStyle = `rgba(150,255,190,${0.16 + 0.08 * Math.sin(v.time * 3)})`;
  ctx.beginPath();
  ctx.ellipse(f.head.x + 10, f.head.y + 10, 26, 22, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawYouStanding(ctx: CanvasRenderingContext2D, c: Circle, m: Member, v: CircleView, at: Joint): void {
  const y = c.you;
  const s = depthScale(at.y);
  const walking = y.mode === 'walking';
  const rise = y.mode === 'standing' ? smoothstep(0, 0.6, y.t) : 1;
  const dist = walking ? Math.hypot(at.x - (SEATS.you.x + 34), at.y - (SEATS.you.y + 8)) : 0;
  const fold = y.mode === 'folding' ? smoothstep(0, 0.8, y.t) : walking ? 1 : 0;
  const fx = walking ? -0.95 : 0.3;
  const fz = walking ? 0.3 : -0.95;
  const pose: Pose = {
    fx,
    fz,
    sit: 1 - rise,
    kneel: 0,
    lean: { x: y.mode === 'folding' ? -8 * Math.sin(Math.PI * smoothstep(0, 1, y.t)) : 0, y: y.mode === 'folding' ? 10 * Math.sin(Math.PI * smoothstep(0, 1, y.t)) : 0 },
    yaw: Math.atan2(fx, fz),
    nod: 0,
    breath: Math.sin(m.breath * 2.2),
    hands: [walking ? { x: 20, y: 30 } : { x: -14 - 10 * fold, y: 40 }, { x: 8, y: 26 }],
    feet: walking ? [walkingFoot(dist, 70, 0, 10), walkingFoot(dist, 70, 0.5, 10)] : null,
    face: faceOf(m, v, c),
  };
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(s, s);
  drawPerson(ctx, m.look, pose, {
    held: (f) => {
      // The folded chair under your arm.
      if (walking) drawFoldedChair(ctx, f.chest.x + 8, f.chest.y + 34, 0.9, 0.5);
    },
    over: (f) => {
      drawCuppa(ctx, f.hands[1].x, f.hands[1].y - 4, 1);
      c.heads.you = { x: at.x + f.head.x * s, y: at.y + f.head.y * s };
    },
  });
  ctx.restore();
}

// ─── The crash ───────────────────────────────────────────────────────────────────────────────────────────
function drawCrashMember(ctx: CanvasRenderingContext2D, c: Circle, m: Member, v: CircleView, at: CrashPlace): void {
  const t = v.crashT;
  const face = faceOf(m, v, c);
  const pile = PILE[m.who];
  const hugging = at.hug;
  const baseFx = m.who === 'jules' ? 0 : m.seat.fx;
  const baseFz = m.who === 'jules' ? 1 : m.seat.fz;
  // In the pile everyone turns to face out of it a little, toward us; before it, they face the circle.
  const fx = mix(baseFx, pile.fx * 0.75, hugging);
  const fz = mix(baseFz, 0.66, hugging);
  const fl = Math.hypot(fx, fz) || 1;
  // Recoil: the geometry inverts, everyone leaning away from Jules in the same frame they stand.
  const jc = c.julesAtCrash;
  const away = m.who === 'jules' ? { x: 0, y: 0 } : toward(jc.x, jc.y, m.seat.x, m.seat.y);
  const recoil = at.stand * (1 - hugging) * (1 - at.lie) * (0.8 + 0.4 * Math.sin(t * 3 + m.seed) * Math.exp(-t));
  face.o = at.stand * (1 - hugging) * (1 - at.lie) * (t < 1.8 ? 1 : 0.3);
  face.brow = 1;
  if (hugging > 0.5) {
    face.happy = m.who === 'jules' ? 0 : 1;
    face.smile = 0.9;
    face.o = 0;
    face.brow = 0.3;
  }
  if (m.who === 'ron') {
    face.look = { x: 0, y: -1 };
    face.o = at.lie > 0.5 && v.talking('ron') === 0 ? 0.2 : face.o;
  }
  if (m.who === 'jules') {
    face.look = v.wet > 0 && v.wet < 1.6 ? { x: 0.2, y: 1 } : { x: 0, y: 0 };
    face.o = 0;
    face.smile = hugging > 0.5 ? 0.5 : -0.1;
    face.brow = 0.6;
  }
  const toCenter = (CENTER.x - at.x) / 160;
  const pose: Pose = {
    fx: fx / fl,
    fz: fz / fl,
    sit: (1 - at.stand) * (1 - hugging),
    kneel: hugging,
    lean: { x: away.x * 14 * recoil + toCenter * 14 * hugging, y: away.y * P * 14 * recoil - 4 * recoil + 8 * hugging },
    yaw: Math.atan2(fx, fz) + (hugging > 0.5 ? -0.25 * Math.sign(pile.fx) : 0),
    nod: hugging * 4,
    breath: Math.sin(m.breath * 2.2),
    hands:
      hugging > 0.3
        ? [{ x: -30 - 6 * Math.sin(t * 2 + m.seed), y: 18 }, { x: 30 + 6 * Math.sin(t * 2 + m.seed + 1), y: 18 }]
        : at.stand > 0.5
          ? [{ x: -40, y: -18 + 5 * Math.sin(t * 9 + m.seed) }, { x: 40, y: -20 + 5 * Math.sin(t * 9.5 + m.seed) }]
          : [null, null],
    feet: null,
    face,
  };
  if (m.who === 'ron' && at.lie > 0) {
    pose.hands = [{ x: -26, y: -24 }, { x: 26, y: -24 }];
    pose.fx = 0;
    pose.fz = 1;
    pose.yaw = 0;
  }
  // Standing at the seat, or settled in the pile, the anchor is still: through a sprite, on twos or threes.
  const settled = at.hug >= 1 && at.lie === 0 && t - hopStart(m.who, c.crashSeed) - HOP_S > 0.45;
  const standing = at.hug === 0 && at.fly === 0 && at.lie === 0 && t > BEAT.stand + 0.1;
  const sq = at.sq;
  const sx = at.s * (1 + sq + squeeze(t) * hugging);
  const sy = at.s * (1 - sq - squeeze(t) * hugging);
  const cos = Math.cos(at.rot);
  const sin = Math.sin(at.rot);
  /** A point of the figure in the room's space, through the same transform the render uses. */
  const toRoom = (p: Joint): Joint => {
    const px = p.x;
    const py = p.y + 10 * at.lie;
    const rx = px * cos - py * sin;
    const ry = px * sin + py * cos - 50 * at.lie;
    return { x: at.x + rx * sx, y: at.y + ry * sy };
  };
  const render = (g: CanvasRenderingContext2D): void => {
    g.scale(sx, sy);
    if (at.lie > 0) {
      // Flat on his back: the whole figure turned onto the floor about his hips.
      g.translate(0, -50 * at.lie);
      g.rotate(at.rot);
      g.translate(0, 10 * at.lie);
    } else g.rotate(at.rot);
    const props: { over?: (f: Frame) => void; held?: (f: Frame) => void } = {};
    if (m.who === 'jules') props.over = (f) => drawPhone(g, c, f.hands[1], v, 1.05);
    if (m.who === 'terry') props.over = (f) => (t < BEAT.cup - 0.3 ? drawSnackCup(g, c, f.hands[1], v) : drawUpendedCup(g, f, t));
    if (m.who === 'guitar' && t < BEAT.hug + 0.2) props.held = (f) => drawGuitar(g, f, m.seat.fx >= 0 ? 1 : -1, t > BEAT.chord && t < BEAT.chord + 0.8 ? 1 : 0, v.time);
    if (m.who === 'you') props.over = (f) => drawCuppa(g, f.hands[1].x, f.hands[1].y - 4, 1);
    const frame = drawPerson(g, m.look, pose, props);
    c.heads[m.who] = toRoom(frame.head);
    if (m.who === 'jules') {
      // In the middle of the pile, the nametag reads DAY 0 AGAIN, big enough to read.
      const grow = 1 + 0.9 * smoothstep(PILE_DONE, PILE_DONE + 0.5, t);
      julesTag(g, c, frame.chest.x + 4, frame.chest.y + 20, grow, v);
    } else drawNametag(g, c, m, frame, v);
  };
  // Big Ron, once he is down, lies still too.
  const down = at.lie >= 1 && t > BEAT.ronDown + 0.8;
  if (settled || standing || down) viaSprite(ctx, m.who, ORDER.indexOf(m.who), at, at.s, settled ? 4 : 3, render, down ? 180 : 120);
  else {
    ctx.save();
    ctx.translate(at.x, at.y);
    render(ctx);
    ctx.restore();
  }
}

/** Terry's cup, held up and upended over the pile once it lands. */
function drawUpendedCup(ctx: CanvasRenderingContext2D, f: Frame, t: number): void {
  const k = smoothstep(BEAT.cup - 0.3, BEAT.cup, t);
  if (k <= 0) return;
  const hand = f.hands[1];
  ctx.save();
  ctx.translate(hand.x, hand.y - 6);
  ctx.rotate(Math.PI * k);
  ctx.fillStyle = '#f6efe2';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-9, -22);
  ctx.lineTo(9, -22);
  ctx.lineTo(6.5, 4);
  ctx.lineTo(-6.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d64a3c';
  ctx.fillRect(-7.6, -12, 15.2, 4);
  ctx.restore();
}

/** Where Terry's cup is in the pile, for the cookie rain. */
export function cupInPile(c: Circle): Joint {
  const head = c.heads.terry;
  return head ? { x: head.x + 26, y: head.y - 44 } : { x: PILE.terry.x + 30, y: PILE.terry.y - 190 * depthScale(PILE.terry.y) };
}
