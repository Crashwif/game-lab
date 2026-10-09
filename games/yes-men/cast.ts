/**
 * The people of Yes Men: the Leader at the far end of the table facing us, whose chest fills with medals and
 * whose hand drifts to the button; six ministers in profile along the sides, who nod, clap, stand, kneel, sweat
 * and weep as the room agrees harder, one of whom is the first to stop clapping; the player at the near end
 * with their back to us, who hesitates and, on the walk-out, stands and leaves by the door; the guards; and
 * the loyalist who takes the chair. Rigs and drawing only; nothing here picks or changes the outcome.
 */
import { box, DOOR, FLOOR_Y, ink, INK, LEADER, MEME_FONT, SEATS, YOU } from './ink';
import { clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

const SKIN = '#f1cfb0';
const depth = (multiplier: number): number => clamp(Math.log10(Math.max(1, multiplier)) / 3, 0, 1);
const ease = (t: number): number => smoothstep(0, 1, t);

// ---- The Leader ------------------------------------------------------------------------------------------

export interface Leader {
  /** How puffed up he is: a slow spring behind the tension; the cap, the chest and the glint follow. */
  pride: Spring;
  /** The stamp: seconds since the last decree (lift, slam, back). */
  stampT: number;
  /** The left hand's drift from the table to the button, 0 to 1, and the slam onto it. */
  hover: Spring;
  slam: Spring;
  /** Both arms up for the photo. */
  raise: Spring;
  mouth: number;
  blink: number;
  blinkIn: number;
  blinks: number;
}

export const createLeader = (): Leader => ({ pride: spring(0), stampT: 9, hover: spring(0), slam: spring(0), raise: spring(0), mouth: 0, blink: 0, blinkIn: 2, blinks: 0 });
export function resetLeader(l: Leader): void {
  Object.assign(l, createLeader());
}

export interface LeaderDrive {
  running: boolean;
  tension: number;
  multiplier: number;
  /** His newest bubble is this old; a decree was stamped this frame. */
  said: number;
  decree: boolean;
  crashed: boolean;
  photo: boolean;
  time: number;
  reduced: boolean;
}

const prideFor = (tension: number, multiplier: number): number => clamp(smoothstep(0.05, 0.9, tension) + 0.25 * depth(multiplier), 0, 1.15);

/** Returns true the frame the stamp lands. */
export function stepLeader(l: Leader, drive: LeaderDrive, dt: number): boolean {
  if (drive.decree) l.stampT = 0;
  const before = l.stampT;
  l.stampT += dt;
  const landed = before < 0.2 && l.stampT >= 0.2;
  stepSpring(l.pride, drive.crashed ? 1.15 : drive.running ? prideFor(drive.tension, drive.multiplier) : 0, 2.2, 0.85, dt);
  const hover = drive.crashed ? 1 : drive.running ? clamp(smoothstep(0.3, 0.95, drive.tension) * 0.85 + 0.2 * depth(drive.multiplier), 0, 1) : 0;
  stepSpring(l.hover, hover, 1.8, 0.9, dt);
  stepSpring(l.slam, drive.crashed ? 1 : 0, 24, 0.55, dt);
  stepSpring(l.raise, drive.crashed && drive.photo ? 1 : 0, 9, 0.6, dt);
  l.mouth = drive.said < 1.5 ? Math.abs(Math.sin(drive.time * 15)) * (1 - drive.said / 1.5) : 0;
  l.blink = Math.max(0, l.blink - dt);
  if ((l.blinkIn -= dt) <= 0) {
    l.blinks += 1;
    l.blink = 0.1;
    l.blinkIn = 3 + 2.5 * noise(l.blinks * 3.3);
  }
  return landed;
}

/** Settles him into a round already under way. */
export function settleLeader(l: Leader, tension: number, multiplier: number): void {
  settleSpring(l.pride, prideFor(tension, multiplier));
  settleSpring(l.hover, clamp(smoothstep(0.3, 0.95, tension) * 0.85 + 0.2 * depth(multiplier), 0, 1));
}

export interface FaceOptions { mouth: number; glint: number; grin: number; speaking: boolean; blink?: number }

/** His face with the cap and the aviators, at `scale`, the chin at (x, y). Shared with the portrait and the banner. */
export function drawLeaderFace(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, o: FaceOptions): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Neck, then the head: wide at the jaw, the jaw squarer with the grin.
  ctx.fillStyle = SKIN;
  ink(ctx, 2.5);
  ctx.fillRect(-16, -20, 32, 26);
  ctx.beginPath();
  ctx.moveTo(-36, -44);
  ctx.quadraticCurveTo(-40, 0, -14 - 6 * o.grin, 4);
  ctx.lineTo(14 + 6 * o.grin, 4);
  ctx.quadraticCurveTo(40, 0, 36, -44);
  ctx.quadraticCurveTo(34, -82, 0, -84);
  ctx.quadraticCurveTo(-34, -82, -36, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Ears.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 38, -40, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // The aviators: two big drops, a bridge, and a glint that brightens with his mood.
  for (const s of [-1, 1]) {
    const g = ctx.createLinearGradient(0, -62, 0, -30);
    g.addColorStop(0, '#2b2a3a');
    g.addColorStop(1, '#5a4a3a');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 4, -58);
    ctx.lineTo(s * 34, -58);
    ctx.quadraticCurveTo(s * 36, -30, s * 18, -30);
    ctx.quadraticCurveTo(s * 2, -32, s * 4, -58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.6 * clamp(o.glint, 0, 1)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(s * 10, -52);
    ctx.lineTo(s * 24, -52);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-4, -56);
  ctx.lineTo(4, -56);
  ctx.stroke();
  // The mouth: a hard line that curls into the grin and opens on his lines.
  const open = 2 + 10 * o.mouth;
  ctx.fillStyle = '#5a1f2a';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-18, -14);
  ctx.quadraticCurveTo(0, -14 + open + 8 * o.grin, 18, -14);
  ctx.quadraticCurveTo(0, -14 - 4 * o.grin, -18, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (o.grin > 0.3) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.quadraticCurveTo(0, -14 + 3 * o.grin, 14, -14);
    ctx.lineTo(14, -11);
    ctx.lineTo(-14, -11);
    ctx.closePath();
    ctx.fill();
  }
  // The cap: a tall crown over the brim, gold braid, a wreathed star; it grows with the grin.
  const crown = 1 + 0.35 * o.grin;
  ctx.fillStyle = '#3f4a33';
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-42, -76);
  ctx.quadraticCurveTo(-46, -92 - 26 * crown, 0, -96 - 30 * crown);
  ctx.quadraticCurveTo(46, -92 - 26 * crown, 42, -76);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b2232f';
  ctx.fillRect(-42, -84, 84, 10);
  ctx.strokeRect(-42, -84, 84, 10);
  ctx.fillStyle = '#1c1420';
  ctx.beginPath();
  ctx.ellipse(0, -74, 46, 9, 0, 0, Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-40, -80);
  ctx.lineTo(40, -80);
  ctx.stroke();
  ctx.fillStyle = '#f1c85a';
  ink(ctx, 1.5);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? 12 : 5;
    ctx.lineTo(Math.cos(a) * d, -96 - 10 * crown + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The chair behind him, drawn before him: a high gold-trimmed back. */
export function drawThrone(ctx: CanvasRenderingContext2D): void {
  box(ctx, LEADER.x - 70, 150, 140, 150, 10, '#7a1f2c', 3);
  ctx.strokeStyle = '#c99a3c';
  ctx.lineWidth = 3;
  ctx.strokeRect(LEADER.x - 60, 160, 120, 130);
}

/** A medal: ribbon and disc, at (x, y) in the current space. */
function medal(ctx: CanvasRenderingContext2D, x: number, y: number, i: number): void {
  const ribbons = ['#d8364a', '#2f6fd6', '#2e9e5b', '#e0b64a', '#7a3fb0'];
  ctx.fillStyle = ribbons[i % ribbons.length]!;
  ctx.fillRect(x - 4, y - 9, 8, 9);
  ctx.fillStyle = i % 3 === 0 ? '#d9d9e2' : '#f1c85a';
  ink(ctx, 1.2);
  ctx.beginPath();
  ctx.arc(x, y + 4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** A two-point sleeve from the shoulder to the hand with the elbow bowed outward by `bow`. */
function sleeve(ctx: CanvasRenderingContext2D, sx: number, sy: number, hx: number, hy: number, bow: number, colour: string, width: number): void {
  const mx = (sx + hx) / 2;
  const my = (sy + hy) / 2;
  const dx = hx - sx;
  const dy = hy - sy;
  const len = Math.hypot(dx, dy) || 1;
  const ex = mx + (-dy / len) * bow;
  const ey = my + (dx / len) * bow;
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

function hand(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = SKIN;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Where the button hand and the stamp hand are, so the scene can place cues. */
export const STAMP_HAND = { x: 412, y: 318 } as const;
export const BUTTON_HAND_REST = { x: 556, y: 328 } as const;
export const BUTTON_HAND_OVER = { x: 492, y: 306 } as const;

export function drawLeader(ctx: CanvasRenderingContext2D, l: Leader, medals: number, time: number, reduced: boolean): void {
  const pride = clamp(l.pride.x, 0, 1.15);
  const puff = 1 + 0.12 * pride;
  const raise = clamp(l.raise.x, 0, 1);
  const slam = clamp(l.slam.x, 0, 1);
  ctx.save();
  ctx.translate(LEADER.x, LEADER.y);
  // The torso: a uniform that widens as he swells, with the sash, the buttons and the epaulettes.
  ctx.save();
  ctx.scale(puff, 1);
  ctx.fillStyle = '#4b5a3a';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-62, 4);
  ctx.quadraticCurveTo(-66, 30, -70, 60);
  ctx.lineTo(70, 60);
  ctx.quadraticCurveTo(66, 30, 62, 4);
  ctx.quadraticCurveTo(0, -8, -62, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The sash across the chest and the gold buttons.
  ctx.fillStyle = '#b2232f';
  ctx.beginPath();
  ctx.moveTo(-50, 8);
  ctx.lineTo(-30, 6);
  ctx.lineTo(30, 60);
  ctx.lineTo(10, 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f1c85a';
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(0, 18 + i * 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Collar tabs.
  ctx.fillStyle = '#b2232f';
  ctx.beginPath();
  ctx.moveTo(-18, 2);
  ctx.lineTo(-4, 14);
  ctx.lineTo(-20, 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, 2);
  ctx.lineTo(4, 14);
  ctx.lineTo(20, 16);
  ctx.closePath();
  ctx.fill();
  // Epaulettes with fringe.
  for (const s of [-1, 1]) {
    box(ctx, s * 44 - 18, -2, 36, 12, 4, '#e0b64a', 2);
    ctx.strokeStyle = '#e0b64a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(s * 58 + s * i * 2 - (s < 0 ? 4 : 0), 10);
      ctx.lineTo(s * 60 + s * i * 2 - (s < 0 ? 4 : 0), 22);
      ctx.stroke();
    }
  }
  // Medals: rows on the chest, on his left (our right), more than the chest has room for.
  const shown = Math.min(18, medals);
  for (let i = 0; i < shown; i += 1) {
    const row = Math.floor(i / 6);
    const col = i % 6;
    medal(ctx, 14 + col * 10 - row * 2, 20 + row * 13, i);
  }
  ctx.restore();
  // The arms. At rest the right hand (our left) works the stamp over the pile; the left hand drifts to the
  // button, trembling as it gets close, and slams it at the crash. For the photo both go up in a V.
  const lift = l.stampT < 0.2 ? Math.sin((l.stampT / 0.2) * Math.PI) : l.stampT < 0.5 ? 0 : 0;
  const stampHand = { x: STAMP_HAND.x - LEADER.x, y: STAMP_HAND.y - LEADER.y - 26 * lift };
  const tremble = !reduced && l.hover.x > 0.55 && slam < 0.5 ? (l.hover.x - 0.55) * 8 : 0;
  const bx = mix(BUTTON_HAND_REST.x, BUTTON_HAND_OVER.x, clamp(l.hover.x, 0, 1)) - LEADER.x + Math.sin(time * 37) * tremble;
  const by = mix(BUTTON_HAND_REST.y, BUTTON_HAND_OVER.y, clamp(l.hover.x, 0, 1)) - LEADER.y + Math.cos(time * 41) * tremble * 0.6;
  const buttonHand = { x: mix(bx, 6, slam), y: mix(by, 52, slam) };
  const rightHand = { x: mix(stampHand.x, -70, raise), y: mix(stampHand.y, -120, raise) };
  const leftHand = { x: mix(buttonHand.x, 70, raise), y: mix(buttonHand.y, -120, raise) };
  sleeve(ctx, -46 * puff, 10, rightHand.x, rightHand.y, mix(-14, 18, raise), '#4b5a3a', 16);
  sleeve(ctx, 46 * puff, 10, leftHand.x, leftHand.y, mix(14, -18, raise), '#4b5a3a', 16);
  hand(ctx, rightHand.x, rightHand.y, 9);
  hand(ctx, leftHand.x, leftHand.y, 9);
  if (raise < 0.5) {
    // The stamp in his right hand.
    ctx.save();
    ctx.translate(rightHand.x, rightHand.y);
    box(ctx, -5, -16, 10, 14, 3, '#5a3324', 1.5);
    box(ctx, -11, 2, 22, 7, 2, '#8a2430', 1.5);
    ctx.restore();
  }
  // The head, nodding slowly as he holds court and tipping back as he swells.
  const bob = reduced ? 0 : Math.sin(time * 1.4) * 1.5;
  drawLeaderFace(ctx, 0, -2 + bob - 4 * pride, 1, { mouth: l.mouth, glint: pride, grin: pride, speaking: l.mouth > 0, blink: l.blink });
  ctx.restore();
}

// ---- The ministers ---------------------------------------------------------------------------------------

interface Drop { x: number; y: number; vy: number }

export type Escort = 'seated' | 'noticed' | 'escorted' | 'empty' | 'replacing';

export interface YesMan {
  seat: number;
  seed: number;
  /** How far gone they are: a slow spring behind the tension, kicked by every decree. */
  zeal: Spring;
  kick: Spring;
  /** The nod and the clap: integrated phases, so their rates can rise without a jump. */
  nod: number;
  clap: number;
  clapping: number;
  stand: Spring;
  kneel: Spring;
  tears: Spring;
  sweat: Drop[];
  sweatClock: number;
  mouth: number;
  blink: number;
  blinkIn: number;
  blinks: number;
  look: { x: number; y: number };
  /** The first-to-stop-clapping beat: the state and its clock. */
  escort: Escort;
  escortT: number;
  /** The replacement wears a NEW tag. */
  fresh: boolean;
  suit: string;
  hair: number;
  tie: string;
}

const SUITS = ['#2d3144', '#3b2f2f', '#2a3a33', '#3a3550', '#444444', '#2d2d3a'];
const TIES = ['#b2232f', '#2f6fd6', '#e0b64a', '#b2232f', '#7a3fb0', '#2e9e5b'];

function minister(seat: number, fresh = false): YesMan {
  const seed = seat * 7 + 3;
  return { seat, seed, zeal: spring(0), kick: spring(0), nod: seed, clap: seed, clapping: 0, stand: spring(0), kneel: spring(0), tears: spring(0), sweat: [], sweatClock: 0, mouth: 0, blink: 0, blinkIn: 1 + seat * 0.4, blinks: 0, look: { x: 0, y: 0 }, escort: 'seated', escortT: 0, fresh, suit: SUITS[seat]!, hair: fresh ? 6 : seat, tie: TIES[seat]! };
}

export const createYesMen = (): YesMan[] => SEATS.map((_, i) => minister(i));
export function resetYesMen(men: YesMan[]): void {
  for (let i = 0; i < men.length; i += 1) men[i] = minister(i);
}

/** The minister who is the first to stop clapping: the right middle seat, nearest the door. */
export const STOPPER = 3;
const zealFor = (tension: number, multiplier: number): number => clamp(0.75 * smoothstep(0.05, 0.92, tension) + 0.3 * depth(multiplier), 0, 1.05);

export interface MenDrive {
  running: boolean;
  tension: number;
  multiplier: number;
  time: number;
  reduced: boolean;
  /** A decree landed this frame. */
  decree: boolean;
  /** Who has the newest bubble and how old it is; how old each minister's own newest bubble is. */
  talker: string | null;
  talkAge: number;
  said: (by: number) => number;
  crashed: boolean;
  photo: boolean;
}
export interface MenEvents { ovation: boolean; kneel: boolean; taken: boolean; replaced: boolean; clapping: boolean; door: number }

/** Starts the first-to-stop-clapping beat. */
export function stopClapping(men: YesMan[]): void {
  const m = men[STOPPER]!;
  if (m.escort === 'seated') {
    m.escort = 'noticed';
    m.escortT = 0;
  }
}

export function stepYesMen(men: YesMan[], drive: MenDrive, dt: number): MenEvents {
  const ev: MenEvents = { ovation: false, kneel: false, taken: false, replaced: false, clapping: false, door: 0 };
  for (const m of men) {
    const live = drive.running && !drive.crashed;
    const target = drive.crashed ? 1.05 : live ? zealFor(drive.tension, drive.multiplier) : 0;
    if (drive.decree && live) {
      m.zeal.v += 0.5;
      m.kick.v += 1.2 + 0.4 * noise(m.seed + drive.time);
    }
    stepSpring(m.zeal, target, 2.5, 0.85, dt);
    stepSpring(m.kick, 0, 14, 0.4, dt);
    const zeal = clamp(m.zeal.x, 0, 1.05);
    // The escort beat runs on its own clock while the room carries on.
    if (m.escort !== 'seated') {
      m.escortT += dt;
      if (m.escort === 'noticed' && m.escortT > 1.1) {
        m.escort = 'escorted';
        m.escortT = 0;
        ev.taken = true;
      } else if (m.escort === 'escorted' && m.escortT > 2.4) {
        m.escort = 'empty';
        m.escortT = 0;
      } else if (m.escort === 'empty' && m.escortT > 2.2) {
        m.escort = 'replacing';
        m.escortT = 0;
      } else if (m.escort === 'replacing' && m.escortT > 1.6) {
        Object.assign(m, minister(m.seat, true), { zeal: spring(zeal), escort: 'seated' as const });
        ev.replaced = true;
      }
      if (m.escort === 'escorted' && m.escortT > 0.9) ev.door = Math.max(ev.door, 1);
      if (m.escort === 'replacing' && m.escortT < 0.8) ev.door = Math.max(ev.door, 1);
    }
    const noticed = m.escort === 'noticed';
    const wasClapping = m.clapping > 0.5;
    const claps = live && zeal > 0.2 && !noticed && m.escort === 'seated';
    m.clapping += ((claps ? 1 : 0) - m.clapping) * (1 - Math.exp(-8 * dt));
    if (claps && !wasClapping && m.clapping > 0.5) ev.clapping = true;
    m.nod = (m.nod + dt * Math.PI * 2 * (0.4 + 2.2 * zeal) * (noticed ? 0 : 1)) % (Math.PI * 2);
    m.clap = (m.clap + dt * Math.PI * 2 * (1.6 + 4.2 * zeal) * m.clapping) % (Math.PI * 2);
    const standing = live && zeal > 0.5 && m.escort === 'seated';
    const kneeling = (drive.crashed && drive.photo) || (live && zeal > 0.8 && m.escort === 'seated');
    const wasStanding = m.stand.x > 0.5;
    const wasKneeling = m.kneel.x > 0.5;
    stepSpring(m.stand, standing && !kneeling ? 1 : 0, 7, 0.6, dt);
    stepSpring(m.kneel, kneeling ? 1 : 0, 6, 0.7, dt);
    if (!wasStanding && m.stand.x > 0.5) ev.ovation = true;
    if (!wasKneeling && m.kneel.x > 0.5) ev.kneel = true;
    stepSpring(m.tears, live && zeal > 0.68 ? 1 : drive.crashed ? m.tears.x : 0, 3, 0.9, dt);
    m.blink = Math.max(0, m.blink - dt);
    if ((m.blinkIn -= dt) <= 0) {
      m.blinks += 1;
      m.blink = 0.1;
      m.blinkIn = 2.5 + 2 * noise(m.seed * 5 + m.blinks);
    }
    // They look at the Leader, up the table, unless someone near them is talking.
    const toYou = drive.talker === 'you' && drive.talkAge < 2.6;
    const [lx, ly] = toYou ? [-2.5, 2] : drive.crashed ? [3, -2] : [3, -1];
    const k = 1 - Math.exp(-10 * dt);
    m.look.x += (lx - m.look.x) * k;
    m.look.y += (ly - m.look.y) * k;
    const own = drive.said(m.seat);
    m.mouth = own < 1.4 ? Math.abs(Math.sin(drive.time * 14)) : zeal > 0.6 ? 0.3 + 0.1 * Math.sin(drive.time * 3 + m.seed) : 0;
    const rand = () => noise(drive.time * 131 + m.seed + m.sweat.length);
    if ((zeal > 0.45 || noticed) && live) {
      m.sweatClock += dt;
      if (m.sweatClock > (noticed ? 0.25 : 0.9 - 0.4 * zeal)) {
        m.sweatClock = 0;
        if (m.sweat.length < 6) m.sweat.push({ x: (rand() - 0.5) * 10, y: -6, vy: 10 + rand() * 20 });
      }
    }
    for (const d of m.sweat) {
      d.y += d.vy * dt;
      d.vy += 60 * dt;
    }
    m.sweat = m.sweat.filter((d) => d.y < 40);
  }
  return ev;
}

/** Settles the ministers into a round already under way. */
export function settleYesMen(men: YesMan[], tension: number, multiplier: number): void {
  for (const m of men) {
    const zeal = zealFor(tension, multiplier);
    settleSpring(m.zeal, zeal);
    settleSpring(m.stand, zeal > 0.5 && zeal <= 0.8 ? 1 : 0);
    settleSpring(m.kneel, zeal > 0.8 ? 1 : 0);
    settleSpring(m.tears, zeal > 0.68 ? 1 : 0);
    m.clapping = zeal > 0.2 ? 1 : 0;
    if (m.seat === STOPPER && multiplier >= 2.62) Object.assign(m, minister(m.seat, true), { zeal: spring(zeal), stand: m.stand, kneel: m.kneel, tears: m.tears, clapping: m.clapping });
  }
}

/** The path from the seat to the door, for the escort and the replacement: 0 at the seat, 1 at the door. */
function seatToDoor(seat: number, t: number): { x: number; y: number; s: number } {
  const at = SEATS[seat]!;
  const e = ease(t);
  return { x: mix(at.x + 40, DOOR.x + DOOR.w / 2, e), y: mix(at.y, FLOOR_Y + 2, e), s: mix(at.s, 0.58, e) };
}

function hairOf(ctx: CanvasRenderingContext2D, style: number, side: number): void {
  ctx.fillStyle = ['#2b1d16', '#6b6b6b', '#1c1420', '#8a5a2b', '#3a2a24', '#d8c8a8', '#2b1d16'][style % 7]!;
  ink(ctx, 2);
  ctx.beginPath();
  if (style === 1) {
    // Bald with side hair.
    ctx.ellipse(-side * 10, -2, 7, 9, 0, 0, Math.PI * 2);
  } else if (style === 2) {
    // Slicked back.
    ctx.moveTo(side * 14, -8);
    ctx.quadraticCurveTo(0, -24, -side * 16, -8);
    ctx.quadraticCurveTo(-side * 20, 2, -side * 14, 4);
    ctx.lineTo(-side * 8, -6);
    ctx.closePath();
  } else {
    ctx.moveTo(side * 12, -10);
    ctx.quadraticCurveTo(0, -22, -side * 15, -8);
    ctx.quadraticCurveTo(-side * 18, 0, -side * 13, 6);
    ctx.lineTo(-side * 10, -4);
    ctx.quadraticCurveTo(0, -12, side * 10, -4);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

/** A head in profile facing `side` (1 right, -1 left), the chin at the origin. */
function profileHead(ctx: CanvasRenderingContext2D, side: number, o: { hair: number; mouth: number; blink: number; look: { x: number; y: number }; zeal: number; tears: number; shades?: boolean }): void {
  ctx.fillStyle = SKIN;
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.ellipse(0, -14, 15, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The nose, out toward the table, and the ear at the back.
  ctx.beginPath();
  ctx.moveTo(side * 13, -16);
  ctx.lineTo(side * 21, -9);
  ctx.lineTo(side * 12, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-side * 13, -12, 3.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  hairOf(ctx, o.hair, side);
  if (o.shades) {
    ctx.fillStyle = '#1c1420';
    ctx.beginPath();
    ctx.roundRect(side * 2 - 6, -22, 16, 8, 3);
    ctx.fill();
  } else {
    // The eye: wide with zeal, shut on a blink, the pupil on the Leader.
    const openness = o.blink > 0 ? 0.1 : 0.7 + 0.5 * o.zeal;
    ctx.fillStyle = '#ffffff';
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.ellipse(side * 7, -19, 4.5, 4.5 * openness, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(side * 7 + clamp(o.look.x * side, -2.5, 2.5), -19 + clamp(o.look.y, -2, 2) * openness, 2, 0, Math.PI * 2);
    ctx.fill();
    // The brow climbs with zeal.
    ctx.beginPath();
    ctx.moveTo(side * 2, -26 - 4 * o.zeal);
    ctx.lineTo(side * 12, -27 - 5 * o.zeal);
    ctx.stroke();
    if (o.tears > 0.05) {
      ctx.strokeStyle = 'rgba(120, 190, 255, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(side * 9, -15);
      ctx.lineTo(side * 10, -15 + 16 * o.tears);
      ctx.stroke();
    }
  }
  // The mouth, at the front.
  ctx.fillStyle = '#5a1f2a';
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.ellipse(side * 10, -4, 3.5, 1.5 + 4 * o.mouth, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** A suited guard, in profile, bigger than the ministers. */
export function drawGuard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, side: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * 1.1, s * 1.1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-6, 26);
  ctx.moveTo(6, 0);
  ctx.lineTo(6, 26);
  ctx.stroke();
  box(ctx, -20, -54, 40, 56, 8, '#141218', 2.5);
  ctx.save();
  ctx.translate(0, -54);
  profileHead(ctx, side, { hair: 2, mouth: 0, blink: 0, look: { x: 0, y: 0 }, zeal: 0, tears: 0, shades: true });
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-side * 11, -60, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** How near the camera the minister is right now, for drawing in depth order: his seat, or his place on the path. */
export function yesManDepth(m: YesMan): number {
  if (m.escort === 'escorted') return seatToDoor(m.seat, clamp((m.escortT - 0.9) / 1.5, 0, 1)).y;
  if (m.escort === 'replacing') return seatToDoor(m.seat, 1 - clamp(m.escortT / 1.5, 0, 1)).y;
  return SEATS[m.seat]!.y;
}

/** The minister at his seat (or wherever the escort has him), facing the table. */
export function drawYesMan(ctx: CanvasRenderingContext2D, m: YesMan, time: number, reduced: boolean): void {
  const seat = SEATS[m.seat]!;
  const side = seat.side;
  const zeal = clamp(m.zeal.x, 0, 1.05);
  const stand = clamp(m.stand.x, 0, 1);
  const kneel = clamp(m.kneel.x, 0, 1);
  // The chair, outside the table: the back on the far side of him from the table.
  ctx.save();
  ctx.translate(seat.x, seat.y);
  ctx.scale(seat.s, seat.s);
  box(ctx, -side * 34 - 8, -46, 16, 60, 4, '#3f2218', 2.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-side * 26, 12);
  ctx.lineTo(-side * 26, 44);
  ctx.moveTo(side * 14, 12);
  ctx.lineTo(side * 14, 44);
  ctx.stroke();
  box(ctx, side === 1 ? -36 : -14, 2, 50, 12, 3, '#5a3324', 2.5);
  ctx.restore();
  if (m.escort === 'empty') return;

  let x = seat.x;
  let y = seat.y;
  let s = seat.s;
  let walking = 0;
  let facing = side;
  if (m.escort === 'escorted') {
    const t = clamp((m.escortT - 0.9) / 1.5, 0, 1);
    const p = seatToDoor(m.seat, t);
    x = p.x;
    y = p.y;
    s = p.s;
    walking = m.escortT > 0.9 ? 1 : 0;
    facing = 1;
  } else if (m.escort === 'replacing') {
    const p = seatToDoor(m.seat, 1 - clamp(m.escortT / 1.5, 0, 1));
    x = p.x;
    y = p.y;
    s = p.s;
    walking = 1;
    facing = -1;
  }
  const guards = m.escort === 'escorted' ? clamp(m.escortT / 0.5, 0, 1) : 0;
  const noticed = m.escort === 'noticed';
  const bob = reduced ? 0 : Math.sin(m.nod) * (2 + 4 * zeal) * (1 - kneel);
  const kick = reduced ? 0 : clamp(m.kick.x, -1, 1) * 4;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (walking) {
    // Marched or marching: upright on the floor, legs swinging.
    ctx.translate(0, -2);
    const gait = Math.sin(time * 11);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(-5 + gait * 9, 24);
    ctx.moveTo(5, -4);
    ctx.lineTo(5 - gait * 9, 24);
    ctx.stroke();
    ctx.translate(0, -26);
  } else {
    // Seated, then up for the ovation with the feet on the floor beside the chair's, then down on the knees.
    ctx.translate(0, -14 * stand + 16 * kneel - kick);
    if (stand > 0.05) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-5, -4);
      ctx.lineTo(-5, 58 * stand);
      ctx.moveTo(5, -4);
      ctx.lineTo(5, 58 * stand);
      ctx.stroke();
    }
    if (kneel > 0.05) {
      ctx.translate(side * 8 * kneel, 0);
      ctx.rotate(side * 0.55 * kneel);
    }
  }
  // Seated, the thighs run under the table edge.
  if (!walking && kneel < 0.5) {
    ctx.fillStyle = m.suit;
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.roundRect(side > 0 ? -6 : -34, -6, 40, 14, 5);
    ctx.fill();
    ctx.stroke();
  }
  // The torso and the collar, the tie out front.
  box(ctx, -18, -54 + bob * 0.2, 36, 56, 8, m.suit, 2.5);
  ctx.fillStyle = '#f4efe1';
  ctx.beginPath();
  ctx.moveTo(side * 2, -52);
  ctx.lineTo(side * 14, -52);
  ctx.lineTo(side * 8, -36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = m.tie;
  ctx.beginPath();
  ctx.moveTo(side * 8, -48);
  ctx.lineTo(side * 11, -32);
  ctx.lineTo(side * 8, -22);
  ctx.lineTo(side * 5, -32);
  ctx.closePath();
  ctx.fill();
  if (m.fresh) {
    box(ctx, -side * 16 - 7, -40, 14, 9, 2, '#ffd36b', 1.2);
    ctx.fillStyle = INK;
    ctx.font = '900 6px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEW', -side * 16, -35.5);
  }
  // The arms: the clipboard held up in front, or the seal clap, one hand over the other.
  const clapping = m.clapping;
  const gap = Math.abs(Math.sin(m.clap)) * 12;
  if (clapping > 0.5) {
    const hx = side * 22;
    sleeve(ctx, side * 12, -44, hx, -38 - gap, -side * 6, m.suit, 9);
    sleeve(ctx, side * 12, -30, hx, -26 + gap, side * 6, m.suit, 9);
    hand(ctx, hx, -38 - gap, 5);
    hand(ctx, hx, -26 + gap, 5);
    if (gap < 2.5 && !reduced) {
      ctx.strokeStyle = '#fff3a0';
      ctx.lineWidth = 2;
      for (const a of [-0.8, 0, 0.8]) {
        ctx.beginPath();
        ctx.moveTo(hx + side * 8 + Math.cos(a) * 4, -32 + Math.sin(a) * 4);
        ctx.lineTo(hx + side * 8 + Math.cos(a) * 11, -32 + Math.sin(a) * 11);
        ctx.stroke();
      }
    }
  } else {
    const cx = side * 24;
    sleeve(ctx, side * 12, -42, cx, -30, -side * 6, m.suit, 9);
    hand(ctx, cx, -30, 5);
    ctx.save();
    ctx.translate(cx, -36);
    ctx.rotate(side * 0.25);
    box(ctx, -7, -16, 14, 22, 2, '#8a5a2b', 1.5);
    box(ctx, -5, -14, 10, 18, 1, '#f4efe1', 1);
    ctx.fillStyle = '#9b9b9b';
    for (let i = 0; i < 4; i += 1) ctx.fillRect(-3, -11 + i * 4, 6, 1);
    ctx.fillStyle = '#b2232f';
    ctx.font = '900 6px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(noticed ? '...' : 'YES', 0, 8 - 14 + 10);
    ctx.restore();
    if (noticed) {
      // Caught: the other hand goes to the collar.
      sleeve(ctx, side * 10, -30, side * 8, -48, side * 8, m.suit, 9);
      hand(ctx, side * 8, -48, 5);
    }
  }
  // The head, nodding about the neck, bowed on the knees.
  ctx.save();
  ctx.translate(0, -54);
  const nod = reduced ? 0 : Math.sin(m.nod) * (0.06 + 0.22 * zeal) * (1 - kneel);
  ctx.rotate(side * (nod + 0.5 * kneel + (noticed ? -0.15 : 0)));
  profileHead(ctx, facing, { hair: m.hair, mouth: m.mouth, blink: m.blink, look: m.look, zeal: noticed ? 1 : zeal, tears: clamp(m.tears.x, 0, 1) });
  ctx.fillStyle = 'rgba(150, 210, 255, 0.9)';
  for (const d of m.sweat) {
    ctx.beginPath();
    ctx.ellipse(-facing * 6 + d.x, -22 + d.y, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  if (guards > 0) {
    const gx = x + 30 * s;
    drawGuard(ctx, gx - 34 * s * guards, y, s, facing);
    drawGuard(ctx, gx + 34 * s * guards - 60 * s, y, s, facing);
  }
}

// ---- The player and the loyalist -------------------------------------------------------------------------

export type Mode = 'seated' | 'standing' | 'walking' | 'gone' | 'arriving';

export interface Player {
  tag: 'YOU' | 'NEW';
  hair: string;
  mode: Mode;
  t: number;
  /** Shoulders up and head down as it gets worse; the hand that half-rises to object; the walk's progress. */
  hunch: Spring;
  hand: Spring;
  walk: number;
  slump: Spring;
}

export const createPlayer = (tag: 'YOU' | 'NEW' = 'YOU'): Player => ({ tag, hair: tag === 'YOU' ? '#3a2a24' : '#8a5a2b', mode: tag === 'YOU' ? 'seated' : 'gone', t: 0, hunch: spring(0), hand: spring(0), walk: tag === 'YOU' ? 0 : 1, slump: spring(0) });
export function resetPlayer(p: Player, tag: 'YOU' | 'NEW' = 'YOU'): void {
  Object.assign(p, createPlayer(tag));
}

export interface PlayerDrive { running: boolean; tension: number; decree: boolean; crashed: boolean; time: number }
export interface PlayerEvents { stood: boolean; door: number; sat: boolean; gone: boolean }

/** The walk-out begins. */
export function leave(p: Player): void {
  if (p.mode === 'seated') {
    p.mode = 'standing';
    p.t = 0;
  }
}
/** The loyalist comes in from the door. */
export function arrive(p: Player): void {
  p.mode = 'arriving';
  p.t = 0;
  p.walk = 1;
}

export function stepPlayer(p: Player, drive: PlayerDrive, dt: number): PlayerEvents {
  const ev: PlayerEvents = { stood: false, door: 0, sat: false, gone: false };
  p.t += dt;
  const seated = p.mode === 'seated';
  stepSpring(p.hunch, drive.crashed ? 1 : drive.running && seated ? smoothstep(0.08, 0.9, drive.tension) : 0, 2.5, 0.85, dt);
  stepSpring(p.slump, drive.crashed ? 1 : 0, 5, 0.7, dt);
  if (drive.decree && seated && drive.running && !drive.crashed) p.hand.v += 2.6;
  stepSpring(p.hand, 0, 5, 0.45, dt);
  if (p.mode === 'standing') {
    if (p.t >= 0.6) {
      p.mode = 'walking';
      p.t = 0;
      p.walk = 0;
      ev.stood = true;
    }
  } else if (p.mode === 'walking') {
    p.walk = clamp(p.t / 2.2, 0, 1);
    if (p.walk > 0.55) ev.door = 1;
    if (p.walk >= 1) {
      p.mode = 'gone';
      ev.gone = true;
    }
  } else if (p.mode === 'arriving') {
    p.walk = 1 - clamp(p.t / 2.2, 0, 1);
    if (p.walk > 0.55) ev.door = 1;
    if (p.walk <= 0) {
      p.mode = 'seated';
      ev.sat = true;
    }
  }
  return ev;
}

/** The chair at the near end of the table, from behind, always there: the back panel and the rear legs. */
export function drawYouChair(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(YOU.x - 40, YOU.y - 6);
  ctx.lineTo(YOU.x - 40, YOU.y + 22);
  ctx.moveTo(YOU.x + 40, YOU.y - 6);
  ctx.lineTo(YOU.x + 40, YOU.y + 22);
  ctx.stroke();
  ctx.strokeStyle = '#5a3324';
  ctx.lineWidth = 5;
  ctx.stroke();
  box(ctx, YOU.x - 50, YOU.y - 74, 100, 72, 8, '#5a3324', 3);
  ctx.strokeStyle = '#c99a3c';
  ctx.lineWidth = 2;
  ctx.strokeRect(YOU.x - 42, YOU.y - 66, 84, 56);
}

/** Where the player's figure is: at the chair, or along the path to the door; `s` is its scale, `facing` its way. */
export function playerAt(p: Player): { x: number; y: number; s: number } {
  const t = ease(p.walk);
  const u = 1 - t;
  return { x: u * u * YOU.x + 2 * u * t * 866 + t * t * (DOOR.x + DOOR.w / 2), y: u * u * (YOU.y - 12) + 2 * u * t * 522 + t * t * (FLOOR_Y + 2), s: mix(1, 0.56, t) };
}

/** A figure walking in profile facing `side`: head, torso, swinging legs and arms. */
function drawWalker(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, side: number, gait: number, hair: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const swing = Math.sin(gait);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-5, -30);
  ctx.lineTo(-5 + swing * 13, 0);
  ctx.moveTo(5, -30);
  ctx.lineTo(5 - swing * 13, 0);
  ctx.stroke();
  ctx.strokeStyle = '#2d3144';
  ctx.lineWidth = 6;
  ctx.stroke();
  box(ctx, -17, -88, 34, 60, 8, '#4a4f6a', 2.5);
  sleeve(ctx, side * 8, -80, side * 8 - swing * 14 * side, -48, 0, '#4a4f6a', 8);
  hand(ctx, side * 8 - swing * 14 * side, -48, 4.5);
  ctx.save();
  ctx.translate(0, -88);
  ctx.fillStyle = SKIN;
  ink(ctx, 2.2);
  ctx.beginPath();
  ctx.ellipse(0, -14, 15, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(side * 13, -16);
  ctx.lineTo(side * 21, -9);
  ctx.lineTo(side * 12, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(side * 12, -12);
  ctx.quadraticCurveTo(0, -30, -side * 16, -10);
  ctx.quadraticCurveTo(-side * 18, 2, -side * 12, 4);
  ctx.lineTo(-side * 10, -6);
  ctx.quadraticCurveTo(0, -14, side * 10, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(side * 7, -18, 2, 0, Math.PI * 2);
  ctx.fill();
  // A set jaw: the mouth a flat line.
  ctx.beginPath();
  ctx.moveTo(side * 6, -5);
  ctx.lineTo(side * 13, -5);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** The floating tag over whoever is in the player's seat: YOU, or NEW. */
export function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, time: number, reduced: boolean, colour = '#ff2d4a'): void {
  const bob = reduced ? 0 : Math.sin(time * 3) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  box(ctx, -26, -34, 52, 24, 5, colour, 2.5);
  ctx.fillStyle = colour;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(-9, -10);
  ctx.lineTo(0, 2);
  ctx.lineTo(9, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 16px ${MEME_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -21);
  ctx.restore();
}

/** The figure in (or leaving, or coming to) the player's chair. Seated it is seen from behind. */
export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, time: number, reduced: boolean): void {
  if (p.mode === 'gone') return;
  if (p.mode === 'walking' || p.mode === 'arriving') {
    const at = playerAt(p);
    drawWalker(ctx, at.x, at.y + 12, at.s, p.mode === 'walking' ? 1 : -1, reduced ? 0 : time * 10, p.hair);
    drawTag(ctx, at.x, at.y - 120 * at.s, p.tag, time, reduced, p.tag === 'YOU' ? '#ff2d4a' : '#e0b64a');
    return;
  }
  const rise = p.mode === 'standing' ? ease(p.t / 0.6) * 40 : 0;
  const hunch = clamp(p.hunch.x, 0, 1);
  const slump = clamp(p.slump.x, 0, 1);
  const breathe = reduced ? 0 : Math.sin(time * (1.2 + 2 * hunch)) * (1 + 2 * hunch);
  ctx.save();
  ctx.translate(YOU.x, YOU.y - rise);
  // From behind: the shoulders rise and the head sinks between them as it gets worse.
  const sy = -58 - 8 * hunch + breathe * 0.5 + 6 * slump;
  ctx.fillStyle = '#4a4f6a';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(-54, sy + 14);
  ctx.quadraticCurveTo(-56, sy - 8, -24, sy - 10);
  ctx.lineTo(24, sy - 10);
  ctx.quadraticCurveTo(56, sy - 8, 54, sy + 14);
  ctx.lineTo(54, 10);
  ctx.lineTo(-54, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4efe1';
  ctx.fillRect(-6, sy - 8, 12, 10);
  // The hand that half-rises beside the head to object, then thinks better of it.
  const raise = clamp(p.hand.x, 0, 1);
  if (raise > 0.02) {
    const hx = 60;
    const hy = sy - 10 - 70 * raise;
    sleeve(ctx, 44, sy + 2, hx, hy, 10, '#4a4f6a', 12);
    hand(ctx, hx, hy, 8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 6);
    ctx.lineTo(hx, hy - 16);
    ctx.stroke();
  }
  // Neck and head from behind, with the hair and ears.
  const hy = sy - 34 + 8 * hunch + 8 * slump;
  ctx.fillStyle = SKIN;
  ink(ctx, 2.5);
  ctx.fillRect(-10, hy + 14, 20, 14);
  ctx.beginPath();
  ctx.arc(0, hy, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 28, hy + 2, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.ellipse(0, hy - 6, 29, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The tag over whoever sits in the player's chair, drawn last so nothing in the air hides it. */
export function drawSeatTag(ctx: CanvasRenderingContext2D, p: Player, time: number, reduced: boolean): void {
  if (p.mode !== 'seated' && p.mode !== 'standing') return;
  const rise = p.mode === 'standing' ? ease(p.t / 0.6) * 40 : 0;
  const hunch = clamp(p.hunch.x, 0, 1);
  const sy = -58 - 8 * hunch + 6 * clamp(p.slump.x, 0, 1);
  drawTag(ctx, YOU.x, YOU.y - rise + sy - 80 + 8 * hunch, p.tag, time, reduced, p.tag === 'YOU' ? '#ff2d4a' : '#e0b64a');
}
