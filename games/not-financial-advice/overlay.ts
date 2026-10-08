/**
 * The chrome around the shill: follower counter, 1000X arrow, promo chip,
 * the disclosure that shrinks to a pixel, the comment column and the
 * subscriber who can still walk away.
 */
import { clamp, fract, mix, settleSpring, smoothstep, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';

const LINES = [
  'this is the one',
  'nfa but i am in',
  'sent the rent',
  '1000x incoming',
  'mom said no',
  'code REKT tho',
  'why is he sweating',
  'that lambo is rented',
  'paid promo lol',
  'just aped the top',
  'few understand',
  'screenshot this',
  'sold my kidney for this',
  "wife's bf said buy",
  'is this the 12th 1000x?',
  'he bought at 0 lmao',
  'wen refund',
  'screenshot for the lawsuit',
];

const FLOOD = ['RUG', 'DEV SOLD', 'HE SOLD', 'UNFOLLOW', 'NGMI', 'CLOWN', 'RATIO', 'DYOR', 'LAWSUIT', 'CLASS ACTION', 'SCAMMER', 'EXPOSED'];

interface Comment { text: string; y: number; hot: boolean; you?: boolean; }

/** Where your subscriber stops walking: a patch of grass at the end of the row. */
const GRASS_X = 340;
/** One gait cycle (two steps) of the little walker, in row pixels. */
const STRIDE = 34;
/** Each bone of the walker's legs: two of them span its widest stance, so the knees bend and never stretch. */
const LEG_BONE = 8.4;
/** The walker's pace over the last 40 px to the grass: it slows to a halt, its steps shrinking to a shuffle. */
const pace = (youX: number): number => smoothstep(0, 40, GRASS_X - 24 - youX);

export interface Overlay {
  comments: Comment[];
  flooded: boolean;
  /** The next line each pool posts, so the column never repeats a line back to back. */
  cursor: number;
  follower: Spring;
  /** How far your subscriber has walked from their avatar toward the grass, and how fast. */
  youX: number;
  walkV: number;
  leaving: boolean;
  gone: boolean;
  /** Arms up on the grass, raised over a quarter second. */
  cheer: number;
  discSize: number;
  /** The chant's integrated phase and its level (it stops when he does). */
  chant: number;
  chantA: number;
}

export function followerCount(multiplier: number): number {
  return Math.floor(12000 * Math.pow(Math.max(1, multiplier), 1.35));
}

/** Steps down toward one pixel as the multiplier climbs. */
export function disclosurePx(multiplier: number): number {
  const steps = Math.floor(Math.log2(Math.max(1, multiplier)) * 2);
  return Math.max(1, 16 - steps * 2);
}

export function createOverlay(): Overlay {
  return {
    comments: LINES.slice(0, 8).map((text, i) => ({ text, y: 300 - i * 36, hot: false })),
    flooded: false,
    cursor: 8,
    follower: spring(12000),
    youX: 0,
    walkV: 0,
    leaving: false,
    gone: false,
    cheer: 0,
    discSize: 16,
    chant: 0,
    chantA: 0,
  };
}

export function resetOverlay(o: Overlay): void {
  o.comments = LINES.slice(0, 8).map((text, i) => ({ text, y: 300 - i * 36, hot: false }));
  o.flooded = false;
  o.cursor = 8;
  o.follower.x = 12000;
  o.follower.v = 0;
  o.youX = 0;
  o.walkV = 0;
  o.leaving = false;
  o.gone = false;
  o.cheer = 0;
  o.discSize = 16;
  o.chantA = 0;
}

/** Puts the follower counter on the multiplier, for a stretch of the round the scene did not draw. */
export function settleOverlay(o: Overlay, multiplier: number): void {
  settleSpring(o.follower, followerCount(multiplier));
}

/** Your subscriber walks out; `gone` puts them straight through the door, for a cash-out that landed off screen. */
export function unfollow(o: Overlay, gone = false): void {
  o.leaving = true;
  if (gone) {
    o.youX = GRASS_X - 28;
    o.gone = true;
    o.cheer = 1;
  }
}

/** Posts a line at the foot of the visible column now, nudging the chat up to make room. */
export function postComment(o: Overlay, text: string): void {
  const low = o.comments.reduce((max, c) => (c.y <= 324 ? Math.max(max, c.y) : max), 0);
  for (const c of o.comments) if (c.y > low) c.y += 34;
  const y = Math.max(60, low + 34);
  const lift = Math.max(0, y - 312);
  for (const c of o.comments) c.y -= lift;
  o.comments.push({ text, y: y - lift, hot: false, you: true });
}

export function floodOverlay(o: Overlay, quiet: boolean): void {
  o.flooded = true;
  if (quiet) {
    o.comments = FLOOD.map((text, i) => ({ text, y: 280 - i * 34, hot: true }));
  } else {
    // The queued lines below the column never showed; the flood takes their place instead of landing on them.
    o.comments = o.comments.filter((c) => c.y <= 324);
    for (let i = 0; i < 6; i += 1) o.comments.push({ text: FLOOD[i % FLOOD.length]!, y: 340 + i * 20, hot: true });
  }
  o.cursor = 6;
}

export interface OverlayDrive { running: boolean; multiplier: number; tension: number; still?: boolean; }

export function stepOverlay(o: Overlay, drive: OverlayDrive, dt: number): void {
  stepSpring(o.follower, followerCount(drive.multiplier), 6, 0.85, dt);
  o.discSize = disclosurePx(drive.multiplier);
  const speed = 22 + (drive.running ? drive.tension * 90 : 8) + (o.flooded ? 80 : 0);
  for (const comment of o.comments) comment.y -= speed * dt;
  o.comments = o.comments.filter((c) => c.y > -30);
  const pool = o.flooded ? FLOOD : LINES;
  while (o.comments.length < 12) {
    const text = pool[o.cursor % pool.length]!;
    const bottom = o.comments.reduce((max, c) => Math.max(max, c.y), 0);
    o.comments.push({ text, y: Math.max(320, bottom + 34), hot: o.flooded });
    o.cursor += 1;
  }
  // He says it faster as it climbs (an integrated phase, so the rate change never jumps it), and stops at the crash.
  if (!drive.still) o.chant += dt * (3 + 14 * drive.tension);
  o.chantA += ((drive.running && drive.tension > 0.15 ? 1 : 0) - o.chantA) * (1 - Math.exp(-dt * 8));
  if (o.leaving && !o.gone) {
    // A short walk-up (about 0.3 s) to a stroll; the feet are planted by distance, so they never skate.
    o.walkV = Math.min(85, o.walkV + 300 * dt);
    o.youX = Math.min(GRASS_X - 28, o.youX + o.walkV * dt * pace(o.youX));
    if (o.youX >= GRASS_X - 29) o.gone = true;
  } else if (o.gone) o.cheer = Math.min(1, o.cheer + dt * 4);
}

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** 12K, 1.24M, 67.5B…: short enough for the burn-in at any multiplier a round can reach. */
export function formatFollowers(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value < 10_000) return `${Math.round(value)}`;
  let tier = Math.min(UNITS.length - 1, Math.floor(Math.log10(value) / 3));
  let scaled = value / 1000 ** tier;
  if (scaled >= 999.5 && tier < UNITS.length - 1) {
    tier += 1;
    scaled /= 1000;
  }
  if (scaled >= 1000) return `${scaled.toExponential(1)}${UNITS[tier]}`;
  return `${tier === 1 ? Math.round(scaled) : scaled.toFixed(scaled < 100 ? 2 : 1)}${UNITS[tier]}`;
}

/** Burned into the video, in video-local pixels. */
export function drawBurn(ctx: CanvasRenderingContext2D, o: Overlay, multiplier: number, tension: number, time: number): void {
  ctx.save();
  ctx.fillStyle = '#ff2a2a';
  ctx.beginPath();
  ctx.arc(22, 22, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '900 14px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LIVE', 34, 27);
  ctx.font = '900 20px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  const count = formatFollowers(o.follower.x);
  ctx.fillText(count, 520, 28);
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('FOLLOWING', 520, 44);
  // The bots in the count: one shows up, then more, then the crash says how many.
  const bots = o.flooded ? 3 : tension > 0.75 ? 3 : tension > 0.5 ? 2 : tension > 0.25 ? 1 : 0;
  ctx.font = '900 20px Impact, "Arial Black", sans-serif';
  const countW = ctx.measureText(count).width;
  for (let i = 0; i < bots; i += 1) drawBot(ctx, 520 - countW - 16 - i * 15, 22, time + i);
  if (o.flooded) {
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(520 - countW - 4, 22);
    ctx.lineTo(524, 22);
    ctx.stroke();
    ctx.fillStyle = '#ff4d6d';
    ctx.font = '900 11px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('98% BOTS', 520, 58);
  }
  // The thumbnail arrow nobody asked for.
  const bounce = Math.sin(time * 5) * (4 + tension * 6);
  ctx.save();
  ctx.translate(500, 78 + bounce);
  ctx.rotate(-0.4);
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.moveTo(-8, 18);
  ctx.lineTo(28, 18);
  ctx.lineTo(28, 28);
  ctx.lineTo(48, 8);
  ctx.lineTo(28, -12);
  ctx.lineTo(28, -2);
  ctx.lineTo(-8, -2);
  ctx.closePath();
  ctx.fill();
  ctx.font = '900 22px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('1000X', -14, 16);
  ctx.restore();
  // Promo chip.
  const glitch = tension > 0.6 ? Math.sin(time * 30) * 2 : 0;
  ctx.fillStyle = '#d5fb6d';
  ctx.beginPath();
  ctx.roundRect(16 + glitch, 250, 118, 26, 6);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '900 14px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CODE REKT', 24 + glitch, 268);
  // Disclosure. It is allowed to become a single pixel.
  const size = Math.max(1, o.discSize);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('PAID PROMOTION', 574, 318);
  // He says it faster than the disclosure can shrink.
  if (o.chantA > 0.02) {
    ctx.globalAlpha = o.chantA * (0.55 + 0.45 * Math.abs(Math.sin(o.chant)));
    ctx.font = '900 13px Impact, sans-serif';
    ctx.textAlign = 'left';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c1f26';
    ctx.strokeText('not financial advice', 150, 300);
    ctx.fillStyle = '#fff';
    ctx.fillText('not financial advice', 150, 300);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** A little robot head, about its centre, blinking. */
function drawBot(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#9aa3ad';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-6, -5, 12, 10, 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(0, -9);
  ctx.stroke();
  const blink = Math.sin(time * 7) > 0.7;
  ctx.fillStyle = blink ? '#4a4f58' : '#ff4d6d';
  ctx.fillRect(-4, -2, 3, 3);
  ctx.fillRect(1, -2, 3, 3);
  ctx.restore();
}

export function drawComments(ctx: CanvasRenderingContext2D, o: Overlay): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 300, 332);
  ctx.clip();
  ctx.fillStyle = '#12141a';
  ctx.fillRect(0, 0, 300, 332);
  ctx.fillStyle = '#8b93a7';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(o.flooded ? 'CHAT IS THIS REAL' : 'LIVE CHAT', 12, 22);
  ctx.beginPath();
  ctx.rect(0, 32, 300, 300);
  ctx.clip();
  for (const comment of o.comments) {
    if (comment.y < 50 || comment.y > 324) continue;
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = comment.you ? '#7cf67c' : comment.hot ? '#ff4d6d' : '#e7eef8';
    ctx.fillText(comment.text, 12, comment.y);
  }
  ctx.restore();
}

/** One leg of the walker: planted for half the gait cycle, then a lifted swing to the next footfall. */
function footAt(distance: number, offset: number): { x: number; lift: number } {
  const cycle = distance / STRIDE + offset;
  const phase = fract(cycle);
  const swing = phase < 0.5 ? 0 : smoothstep(0.5, 1, phase);
  // Relative to the hips this runs +S/4 → −S/4 in stance and back in the swing, so the stance foot never slides.
  return { x: STRIDE * (Math.floor(cycle) + swing - offset + 0.25), lift: phase < 0.5 ? 0 : Math.sin((phase - 0.5) * 2 * Math.PI) * 4 };
}

/**
 * The row under the video. A spectator is a lurker; your subscription is yours. Unfollowing, your avatar stands up
 * and strolls off to touch the grass at the end of the row.
 */
export function drawSubscriber(ctx: CanvasRenderingContext2D, o: Overlay, spectator: boolean): void {
  ctx.save();
  ctx.fillStyle = '#181b22';
  ctx.fillRect(0, 0, 590, 48);
  ctx.textAlign = 'left';
  ctx.font = '700 15px system-ui, sans-serif';
  if (!o.leaving) {
    ctx.fillStyle = spectator ? '#5b6474' : '#3b82f6';
    ctx.beginPath();
    ctx.arc(28, 24, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    const label = spectator ? (o.flooded ? 'lurker · saw it coming' : 'lurker · just watching') : o.flooded ? 'you · left holding the bag' : 'you · subscribed';
    ctx.fillText(label, 48, 29);
    ctx.restore();
    return;
  }
  // The empty seat, the grass, and the row's verdict on the right.
  ctx.strokeStyle = '#3d4554';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(28, 24, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#2f7a3a';
  ctx.fillRect(GRASS_X - 22, 40, 48, 6);
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const gx = GRASS_X - 20 + i * 5.5;
    ctx.moveTo(gx, 41);
    ctx.lineTo(gx + (i % 2 ? 2 : -2), 33 + (i % 3) * 2);
  }
  ctx.stroke();
  ctx.fillStyle = '#7cf67c';
  ctx.textAlign = 'right';
  ctx.fillText(o.gone ? 'touched grass' : 'UNFOLLOWED', 574, 29);
  // The walker: feet planted by distance walked, the hips bobbing at each step, both settling as it halts.
  const d = o.youX;
  const x = 28 + d;
  const step = pace(d);
  const bob = Math.abs(Math.sin((d / STRIDE) * Math.PI * 2)) * 1.5 * step;
  const hip = { x, y: 30 - bob };
  ctx.lineCap = 'round';
  const swing: number[] = [];
  for (const offset of [0, 0.5]) {
    const foot = footAt(d, offset);
    const fx = 28 + foot.x;
    const fy = 44 - foot.lift * step;
    swing.push(fx - x);
    // A two-segment leg with the knee bent forward, in the walking direction.
    const span = Math.max(0.001, Math.hypot(fx - hip.x, fy - hip.y));
    const bend = Math.sqrt(Math.max(0, LEG_BONE * LEG_BONE - (span * span) / 4));
    ctx.strokeStyle = offset ? '#2563eb' : '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo((hip.x + fx) / 2 + ((fy - hip.y) / span) * bend, (hip.y + fy) / 2 - ((fx - hip.x) / span) * bend);
    ctx.lineTo(fx, fy);
    ctx.stroke();
  }
  ctx.strokeStyle = '#7cf67c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(hip.x + 1, hip.y - 13);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 2; i += 1) {
    // Arms swing against the legs while walking, and go up on the grass.
    ctx.moveTo(hip.x + 1, hip.y - 11);
    ctx.lineTo(mix(hip.x + 1 - swing[i]! * 0.6, hip.x + (i ? 8 : -6), o.cheer), mix(hip.y - 3, hip.y - 20, o.cheer));
  }
  ctx.stroke();
  ctx.fillStyle = '#f3dccb';
  ctx.beginPath();
  ctx.arc(hip.x + 1, hip.y - 19, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(hip.x - 2, hip.y - 21, 7, 2);
  ctx.restore();
}
