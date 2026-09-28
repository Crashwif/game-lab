/**
 * The chrome around the shill: follower counter, 1000X arrow, promo chip,
 * the disclosure that shrinks to a pixel, the comment column and the
 * subscriber who can still walk away.
 */
import { clamp, mulberry32, settleSpring, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';

const LINES = [
  'this is the one',
  'nfa but i am in',
  'sent the rent',
  '1000x incoming',
  'mom said no',
  'code DEGEN tho',
  'why is he sweating',
  'that lambo is rented',
  'paid promo lol',
  'just aped the top',
  'few understand',
  'screenshot this',
];

const FLOOD = ['RUG', 'DEV SOLD', 'HE SOLD', 'UNFOLLOW', 'NGMI', 'CLOWN', 'RATIO', 'DYOR'];

interface Comment { text: string; y: number; hot: boolean; }

export interface Overlay {
  comments: Comment[];
  flooded: boolean;
  cursor: number;
  follower: Spring;
  youX: number;
  leaving: boolean;
  gone: boolean;
  discSize: number;
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
    cursor: 0,
    follower: spring(12000),
    youX: 0,
    leaving: false,
    gone: false,
    discSize: 16,
  };
}

export function resetOverlay(o: Overlay): void {
  o.comments = LINES.slice(0, 8).map((text, i) => ({ text, y: 300 - i * 36, hot: false }));
  o.flooded = false;
  o.cursor = 0;
  o.follower.x = 12000;
  o.follower.v = 0;
  o.youX = 0;
  o.leaving = false;
  o.gone = false;
  o.discSize = 16;
}

/** Puts the follower counter on the multiplier, for a stretch of the round the scene did not draw. */
export function settleOverlay(o: Overlay, multiplier: number): void {
  settleSpring(o.follower, followerCount(multiplier));
}

/** Your subscriber walks out; `gone` puts them straight through the door, for a cash-out that landed off screen. */
export function unfollow(o: Overlay, gone = false): void {
  o.leaving = true;
  if (gone) {
    o.youX = 280;
    o.gone = true;
  }
}

export function floodOverlay(o: Overlay, quiet: boolean): void {
  o.flooded = true;
  if (quiet) {
    o.comments = FLOOD.map((text, i) => ({ text, y: 280 - i * 34, hot: true }));
  } else {
    const rand = mulberry32(o.comments.length + 9);
    for (let i = 0; i < 6; i += 1) o.comments.push({ text: FLOOD[i % FLOOD.length]!, y: 340 + i * 20, hot: true });
    void rand;
  }
}

export interface OverlayDrive { running: boolean; multiplier: number; tension: number; }

export function stepOverlay(o: Overlay, drive: OverlayDrive, dt: number): void {
  stepSpring(o.follower, followerCount(drive.multiplier), 6, 0.85, dt);
  o.discSize = disclosurePx(drive.multiplier);
  const speed = 22 + (drive.running ? drive.tension * 90 : 8) + (o.flooded ? 80 : 0);
  for (const comment of o.comments) comment.y -= speed * dt;
  o.comments = o.comments.filter((c) => c.y > -30);
  o.cursor += dt * speed;
  const pool = o.flooded ? FLOOD : LINES;
  while (o.comments.length < 12) {
    const text = pool[Math.floor(o.cursor / 28) % pool.length]!;
    const bottom = o.comments.reduce((max, c) => Math.max(max, c.y), 0);
    o.comments.push({ text, y: Math.max(320, bottom + 34), hot: o.flooded });
    o.cursor += 17;
  }
  if (o.leaving) {
    o.youX += 140 * dt;
    if (o.youX > 280) o.gone = true;
  }
}

function formatFollowers(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return `${Math.round(value)}`;
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
  ctx.fillText(formatFollowers(o.follower.x), 520, 28);
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('FOLLOWING', 520, 44);
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
  ctx.fillText('CODE DEGEN', 24 + glitch, 268);
  // Disclosure. It is allowed to become a single pixel.
  const size = Math.max(1, o.discSize);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('PAID PROMOTION', 574, 318);
  // He says it faster than the disclosure can shrink.
  if (tension > 0.15) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(time * (3 + tension * 14)));
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
    ctx.fillStyle = comment.hot ? '#ff4d6d' : '#e7eef8';
    ctx.fillText(comment.text, 12, comment.y);
  }
  ctx.restore();
}

export function drawSubscriber(ctx: CanvasRenderingContext2D, o: Overlay): void {
  ctx.save();
  ctx.fillStyle = '#181b22';
  ctx.fillRect(0, 0, 590, 48);
  ctx.fillStyle = o.leaving ? '#7cf67c' : '#3b82f6';
  ctx.beginPath();
  ctx.arc(28, 24, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(o.gone ? 'touched grass' : o.leaving ? 'UNFOLLOWED' : 'you · subscribed', 48, 29);
  if (o.leaving && !o.gone) {
    ctx.save();
    ctx.translate(360 + o.youX * 0.3, 24);
    ctx.fillStyle = '#f3dccb';
    ctx.beginPath();
    ctx.arc(0, -4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d5fb6d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(8, 14);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -8, 5, 3);
    ctx.fillRect(1, -8, 5, 3);
    ctx.restore();
  }
  ctx.restore();
}
