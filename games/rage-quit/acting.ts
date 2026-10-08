import { clamp, ease } from './ink';

export interface Point { x: number; y: number }
export type Phase = 'waiting' | 'betting' | 'running' | 'crashed';
export interface ActingInput {
  phase: Phase;
  elapsed: number;
  crashAge: number;
  clock: number;
  heat: number;
  safe: boolean;
  exitAge: number;
  reduced: boolean;
}

const TITLES = [
  ['JUST ONE MORE FUCKING TAB.', 'THE KEYBOARD HAS FILED A COMPLAINT.', 'HUMAN PROOF-OF-WORK.', 'STILL NOT FINANCIAL ADVICE.'],
  ['PROVE YOU ARE NOT A MORON.', 'SELECT ALL TILES WITH AN EXIT.', 'CAPTCHA: EMOTIONAL DAMAGE.', 'THE ROBOT WANTS A SECOND OPINION.'],
  ['BUY MY COURSE ON LOSING.', 'THE GURU HAS A REFUND ALLERGY.', 'YOUR LOSS IS MY MASTERCLASS.', 'CONGRATS. YOU ARE THE PRODUCT.'],
  ['INSTALLING MORE BULLSHIT...', 'YOUR PATIENCE NEEDS A SUBSCRIPTION.', 'RESTART REQUIRED. SOUL OPTIONAL.', 'UPDATING THE UPDATE UPDATER.'],
  ['GIVE. ME. MY. KEYBOARD.', 'THE MACHINE HAS DIAMOND HANDS.', 'LET GO, YOU PLASTIC BASTARD.', 'PROOF OF SEETHE: VERIFIED.'],
  ['THE ALGORITHM IS YOU.', 'THE CALL IS COMING FROM THE CRT.', 'EVEN THE COMPUTER IS MALDING.', 'CONGRATS. THE BOT LEARNED RAGE.'],
  ['TOTALLY NORMAL WORK ENVIRONMENT.', 'CHAIR SUPPORT HAS BEEN LIQUIDATED.', 'ERGONOMICS ARE A SOCIAL CONSTRUCT.', 'THE FLOOR IS JUST ANOTHER OPINION.'],
  ['I AM CALM. I AM CALM. FUCK.', 'DEEP BREATH. SHALLOW THOUGHTS.', 'MINDFULNESS HAS LEFT THE CHAT.', 'NAMASTE AWAY FROM MY DESK.'],
] as const;

export interface Act {
  index: number;
  number: number;
  age: number;
  weight: number;
  caption: string;
  clock: number;
  impact: number;
  stroke: number;
  otherStroke: number;
  reduced: boolean;
}

/** A heavy hand has a slow wind-up, fast contact, recoil and a deliberate recovery. */
function fistLift(t: number): number {
  const u = (t % 1 + 1) % 1;
  if (u < 0.39) return ease(u / 0.39);
  if (u < 0.55) return 1 - ease((u - 0.39) / 0.16);
  if (u < 0.74) return 0.16 * Math.sin((u - 0.55) / 0.19 * Math.PI);
  return 0;
}

export function actAt(input: ActingInput): Act {
  const running = input.phase === 'running' || input.phase === 'crashed';
  const clock = running ? input.elapsed : input.clock;
  const number = Math.floor(Math.max(0, input.elapsed) / 6);
  const index = number % TITLES.length;
  const age = input.elapsed % 6;
  const weight = running ? ease(age / 0.5) * (1 - ease((age - 5.25) / 0.75)) : 0;
  const beats = clock * (1.15 + Math.min(input.heat, 0.8) * 0.4);
  const after = ((beats - 0.55) % 0.5 + 0.5) % 0.5;
  return {
    index, number, age, weight,
    caption: TITLES[index][Math.floor(number / TITLES.length) % 4],
    clock: input.reduced ? Math.floor(clock / 1.2) * 1.2 : clock,
    impact: input.reduced || !running ? 0 : Math.exp(-after * 18) * Math.cos(after * 29),
    stroke: input.reduced ? 0.32 : fistLift(beats),
    otherStroke: input.reduced ? 0.65 : fistLift(beats + 0.5),
    reduced: input.reduced,
  };
}

const mix = (a: number, b: number, n: number) => a + (b - a) * n;
const blend = (a: Point, b: Point, n: number): Point => ({ x: mix(a.x, b.x, n), y: mix(a.y, b.y, n) });

/** The endpoint is projected into the two-bone reach before either segment is drawn. */
export function limb(root: Point, target: Point, upper: number, lower: number, pole: number): { elbow: Point; end: Point } {
  const dx = target.x - root.x, dy = target.y - root.y;
  const distance = Math.max(0.00001, Math.hypot(dx, dy));
  const reach = clamp(distance, Math.abs(upper - lower) + 0.001, upper + lower - 0.001);
  const ux = dx / distance, uy = dy / distance;
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * pole;
  return { elbow: { x: root.x + ux * along - uy * bend, y: root.y + uy * along + ux * bend }, end: { x: root.x + ux * reach, y: root.y + uy * reach } };
}

export interface ActorPose {
  hip: Point;
  shoulder: Point;
  head: Point;
  headAngle: number;
  headSquash: number;
  leftHand: Point;
  rightHand: Point;
  leftFoot: Point;
  rightFoot: Point;
  keyboard: Point;
  keyboardAngle: number;
  mouth: number;
  eye: number;
  calm: boolean;
  collapsed: number;
  exit: number;
  magnifier: boolean;
  rude: boolean;
}

export function actorAt(input: ActingInput, act: Act): ActorPose {
  const { reduced, phase, safe } = input;
  const running = phase === 'running' || phase === 'crashed';
  const t = act.clock;
  const motion = reduced ? 0 : 1;
  const breath = Math.sin(t * 2.6) * 5 * motion;
  const knock = act.impact * 9;
  let hip: Point = { x: 318, y: 427 + (running ? act.stroke * 12 : breath) };
  let shoulder: Point = { x: 335 + (running ? 26 * (1 - act.stroke) : Math.sin(t * 1.7) * 11 * motion), y: 333 + (running ? 24 * (1 - act.stroke) : breath) };
  let head: Point = { x: shoulder.x - 14 + (running ? knock : 0), y: shoulder.y - 109 + (running ? act.otherStroke * 10 : breath * 0.5) };
  let leftHand: Point = { x: 467, y: 399 - 117 * act.otherStroke };
  let rightHand: Point = { x: 526, y: 397 - 150 * act.stroke };
  let leftFoot: Point = { x: 226, y: 490 };
  let rightFoot: Point = { x: 420, y: 491 - 13 * act.otherStroke };
  let headAngle = running ? -0.09 + (act.otherStroke - act.stroke) * 0.16 : Math.sin(t * 1.2) * 0.07 * motion;
  let keyboard: Point = { x: 494, y: 399 + knock * 0.25 };
  let keyboardAngle = 0;
  let mouth = running ? 0.18 + act.stroke * 0.45 : 0.1;
  let eye = running ? 1 : 0.55 + (Math.sin(t * 0.9) * 0.1);
  let magnifier = false;
  let rude = false;
  const w = act.weight;
  if (!running) {
    const sip = reduced ? 0 : Math.max(0, Math.sin(t * 1.25));
    rightHand = { x: 420 - 54 * sip, y: 385 - 103 * sip };
    leftHand = { x: 239 + Math.sin(t * 1.8) * 20 * motion, y: 383 };
    mouth = sip * 0.3;
  } else if (act.index === 1) {
    magnifier = w > 0.1;
    shoulder = blend(shoulder, { x: 383, y: 335 }, w);
    head = blend(head, { x: 393, y: 239 }, w);
    rightHand = blend(rightHand, { x: 493, y: 280 + Math.sin(t * 2) * 24 * motion }, w);
    leftHand = blend(leftHand, { x: 542, y: 362 + Math.sin(t * 4) * 22 * motion }, w);
    headAngle = mix(headAngle, 0.16 + Math.sin(t * 2) * 0.07 * motion, w);
    eye = 0.28;
  } else if (act.index === 2) {
    rude = w > 0.3;
    shoulder = blend(shoulder, { x: 309, y: 326 }, w);
    head = blend(head, { x: 294, y: 214 }, w);
    leftHand = blend(leftHand, { x: 204, y: 219 + Math.sin(t * 3) * 21 * motion }, w);
    rightHand = blend(rightHand, { x: 463, y: 278 - 38 * act.stroke }, w);
    mouth = 0.7;
    headAngle = mix(headAngle, -0.2, w);
  } else if (act.index === 3) {
    shoulder = blend(shoulder, { x: 313 - 30 * Math.sin(t * 2) * motion, y: 363 }, w);
    head = blend(head, { x: shoulder.x - 28, y: 264 }, w);
    leftHand = blend(leftHand, { x: head.x - 68, y: head.y - 61 - 30 * act.otherStroke }, w);
    rightHand = blend(rightHand, { x: head.x + 103, y: head.y - 39 - 40 * act.stroke }, w);
    mouth = 0.9;
    eye = 1.3;
  } else if (act.index === 4) {
    const tug = Math.sin(t * 5) * 37 * motion;
    keyboard = { x: 493 + tug * w, y: 344 - Math.sin(t * 5 + 1) * 16 * motion * w };
    keyboardAngle = Math.sin(t * 5 + 0.3) * 0.1 * motion * w;
    shoulder = blend(shoulder, { x: 304 + tug * 0.7, y: 347 }, w);
    head = blend(head, { x: 273 + tug * 0.65, y: 234 }, w);
    leftHand = blend(leftHand, { x: keyboard.x - 55, y: keyboard.y + 2 }, w);
    rightHand = blend(rightHand, { x: keyboard.x + 53, y: keyboard.y }, w);
    headAngle = mix(headAngle, -0.22, w);
    rightFoot = { x: 447, y: 489 };
    mouth = 0.65;
  } else if (act.index === 5) {
    const recoil = motion ? Math.sin(act.age * 2.8) : 0;
    shoulder = blend(shoulder, { x: 309 - recoil * 24, y: 334 }, w);
    head = blend(head, { x: 286 - recoil * 35, y: 219 }, w);
    leftHand = blend(leftHand, { x: 176 - recoil * 12, y: 272 + recoil * 29 }, w);
    rightHand = blend(rightHand, { x: 473 + recoil * 22, y: 266 - recoil * 31 }, w);
    mouth = 0.95;
    eye = 1.55;
  } else if (act.index === 6) {
    const almost = reduced ? 0.7 : Math.sin(Math.PI * clamp((act.age - 0.7) / 4.5)) ** 2;
    const tip = almost * w;
    hip = blend(hip, { x: 280, y: 424 }, tip);
    shoulder = blend(shoulder, { x: 242, y: 328 }, tip);
    head = blend(head, { x: 194, y: 230 }, tip);
    leftHand = blend(leftHand, { x: 100, y: 340 + act.stroke * 47 }, tip);
    rightHand = blend(rightHand, { x: 413, y: 226 + act.otherStroke * 51 }, tip);
    rightFoot = blend(rightFoot, { x: 399, y: 411 }, tip);
    headAngle = mix(headAngle, -0.58, tip);
    mouth = 1;
    eye = 1.7;
  } else if (act.index === 7) {
    const cope = reduced ? 1 : Math.sin(Math.PI * clamp(act.age / 3.2)) ** 2;
    shoulder = blend(shoulder, { x: 319, y: 320 - 17 * cope }, cope * w);
    head = blend(head, { x: 304, y: 212 - 17 * cope }, cope * w);
    leftHand = blend(leftHand, { x: 420, y: 287 }, cope * w);
    rightHand = blend(rightHand, { x: 435, y: 281 }, cope * w);
    mouth = mix(mouth, 0.06, cope);
    eye = mix(eye, 0.12, cope);
  }
  const exit = safe ? (reduced ? 1 : ease(input.exitAge / 1.3)) : 0;
  if (safe) {
    const wheel = Math.sin(clamp(input.exitAge / 1.3) * Math.PI) * 25 * motion;
    hip = blend(hip, { x: 124, y: 413 - wheel }, exit);
    shoulder = blend(shoulder, { x: 107, y: 339 - wheel }, exit);
    head = blend(head, { x: 93, y: 246 - wheel }, exit);
    leftHand = blend(leftHand, { x: 43, y: 387 - wheel }, exit);
    rightHand = blend(rightHand, { x: 213, y: 317 - wheel }, exit);
    leftFoot = blend(leftFoot, { x: 177, y: 450 }, exit);
    rightFoot = blend(rightFoot, { x: 255, y: 444 }, exit);
    headAngle = mix(headAngle, -0.12, exit);
    eye = mix(eye, 0.4, exit);
    mouth = mix(mouth, 0.1, exit);
    magnifier = rude = false;
  }
  let collapsed = 0;
  if (phase === 'crashed' && !safe) {
    const age = reduced ? 4 : input.crashAge;
    const windup = ease(age / 0.26);
    const launch = ease((age - 0.26) / 0.23);
    collapsed = ease((age - 0.55) / 0.95);
    shoulder = blend(shoulder, { x: 359, y: 300 }, windup);
    head = blend(head, { x: 337, y: 191 }, windup);
    leftHand = blend(leftHand, { x: 483, y: 390 - launch * 205 }, windup);
    rightHand = blend(rightHand, { x: 552, y: 395 - launch * 208 }, windup);
    hip = blend(hip, { x: 333, y: 478 }, collapsed);
    shoulder = blend(shoulder, { x: 300, y: 403 }, collapsed);
    head = blend(head, { x: 273, y: 316 }, collapsed);
    leftHand = blend(leftHand, { x: 182, y: 428 }, collapsed);
    rightHand = blend(rightHand, { x: 415, y: 439 }, collapsed);
    leftFoot = blend(leftFoot, { x: 184, y: 503 }, collapsed);
    rightFoot = blend(rightFoot, { x: 457, y: 502 }, collapsed);
    headAngle = mix(-0.16, 0.17, collapsed);
    mouth = 1 - collapsed * 0.9;
    eye = 1.5 - collapsed * 0.95;
    magnifier = rude = false;
  }
  return { hip, shoulder, head, headAngle, headSquash: reduced ? 0 : running ? act.impact * 0.09 : breath * 0.005, leftHand, rightHand, leftFoot, rightFoot, keyboard, keyboardAngle, mouth, eye, calm: safe, collapsed, exit, magnifier, rude };
}
