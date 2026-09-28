/**
 * The stream: her room with the LED strips and the ring light, the queen
 * herself in a hoodie and cat-ear headset, the money bags that stack up
 * beside her, the door behind her whose handle starts turning, and the
 * crash: the boyfriend walks through with the bag and the stream ends.
 * Innuendo only: nothing is ever revealed but him. Nothing here changes
 * the outcome.
 */
import { type Spring, clamp, mix, mulberry32, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

export const INK = '#1c1f26';
export const VIDEO = { x: 0, y: 0, w: 620, h: 440 } as const;
export type Point = { x: number; y: number };

interface Heart { x: number; y: number; vx: number; age: number; life: number; size: number }

export interface Stream {
  time: number;
  bounce: Spring;
  wave: Spring;
  kiss: Spring;
  glance: Spring;
  handle: Spring;
  shock: Spring;
  bags: number;
  hearts: Heart[];
  ended: boolean;
  endAge: number;
  boyfriendX: Spring;
  blinkAt: number;
  eyeOpen: Spring;
  hair: Spring;
  static: number;
}

export function createStream(): Stream {
  return { time: 0, bounce: spring(0), wave: spring(0), kiss: spring(0), glance: spring(0), handle: spring(0), shock: spring(0), bags: 0, hearts: [], ended: false, endAge: 0, boyfriendX: spring(760), blinkAt: 2, eyeOpen: spring(1), hair: spring(0), static: 0 };
}

export function resetStream(s: Stream): void {
  settleSpring(s.bounce, 0);
  settleSpring(s.wave, 0);
  settleSpring(s.kiss, 0);
  settleSpring(s.glance, 0);
  settleSpring(s.handle, 0);
  settleSpring(s.shock, 0);
  s.bags = 0;
  s.hearts = [];
  s.ended = false;
  s.endAge = 0;
  settleSpring(s.boyfriendX, 760);
  s.static = 0;
}

/** A milestone was reached: a bounce, a wave or a kiss, another bag. */
export function celebrate(s: Stream, index: number): void {
  s.bounce.v += 14;
  if (index % 2) s.kiss.v += 10; else s.wave.v += 12;
  s.bags = Math.min(9, s.bags + 1);
  s.hair.v += 6;
}

/** The boyfriend reveal. `quiet` skips the effects for a crash that already happened. */
export function endStream(s: Stream, seed: number, quiet: boolean): void {
  if (s.ended) return;
  s.ended = true;
  s.endAge = quiet ? 10 : 0;
  s.hearts = [];
  if (quiet) { settleSpring(s.boyfriendX, 470); settleSpring(s.shock, 1); return; }
  const rng = mulberry32(seed);
  s.static = 0.4 + rng() * 0.3;
  s.shock.v += 6;
}

export interface StreamDrive { running: boolean; tension: number; multiplier: number; reduced: boolean }

export function stepStream(s: Stream, drive: StreamDrive, dt: number): void {
  s.time += dt;
  stepSpring(s.bounce, 0, 10, 0.4, dt);
  stepSpring(s.wave, 0, 6, 0.5, dt);
  stepSpring(s.kiss, 0, 6, 0.5, dt);
  stepSpring(s.hair, 0, 12, 0.3, dt);
  const glanceOn = drive.running && drive.tension > 0.55 && !s.ended && Math.floor(s.time * 0.8) % 3 === 0;
  stepSpring(s.glance, s.ended ? 1 : glanceOn ? 1 : 0, 8, 0.8, dt);
  stepSpring(s.handle, s.ended ? 1 : drive.running && drive.tension > 0.7 ? 0.5 + 0.5 * Math.sin(s.time * 2) : 0, 5, 0.7, dt);
  const blinking = s.time > s.blinkAt && s.time < s.blinkAt + 0.12;
  if (s.time >= s.blinkAt + 0.12) s.blinkAt = s.time + 2 + 3 * noise(s.blinkAt);
  stepSpring(s.eyeOpen, blinking ? 0.08 : s.kiss.x > 0.4 ? 0.2 : 1, 24, 0.9, dt);
  if (s.ended) {
    s.endAge += dt;
    stepSpring(s.boyfriendX, 470, 4, 0.9, dt);
    stepSpring(s.shock, s.endAge < 2.4 ? 1 : 0, 8, 0.8, dt);
  } else if (drive.running && drive.tension > 0.2 && noise(Math.floor(s.time * 8)) > 0.7 - 0.3 * drive.tension && s.hearts.length < 40) {
    s.hearts.push({ x: 60 + noise(s.time * 13) * 500, y: VIDEO.h - 60, vx: (noise(s.time * 7) - 0.5) * 30, age: 0, life: 2.2 + noise(s.time) * 1, size: 6 + noise(s.time * 3) * 8 });
  }
  for (const h of s.hearts) { h.age += dt; h.x += h.vx * dt; h.y -= 70 * dt; }
  s.hearts = s.hearts.filter((h) => h.age < h.life);
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x, y + sz);
  ctx.bezierCurveTo(x - sz * 1.4, y - sz * 0.2, x - sz * 0.6, y - sz * 1.2, x, y - sz * 0.4);
  ctx.bezierCurveTo(x + sz * 0.6, y - sz * 1.2, x + sz * 1.4, y - sz * 0.2, x, y + sz);
  ctx.fill();
}

function limb(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, colour: string): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width + 5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
}

/** Gigachad in the doorway, carrying the bag. */
function drawBoyfriend(ctx: CanvasRenderingContext2D, x: number, footY: number, time: number): void {
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(0.86, 0.86);
  ctx.lineJoin = 'round';
  const stride = Math.abs(Math.sin(time * 9)) * 6;
  for (const side of [-1, 1]) limb(ctx, { x: side * 12, y: -80 }, { x: side * 14, y: -(side > 0 ? stride : 0) }, 16, '#2b2b30');
  ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-40, -150, 80, 74, 12); ctx.fill(); ctx.stroke();
  limb(ctx, { x: -40, y: -136 }, { x: -52, y: -90 }, 16, '#cfcfcf');
  limb(ctx, { x: 40, y: -136 }, { x: 50, y: -96 }, 16, '#cfcfcf');
  // The bag.
  ctx.fillStyle = '#7a5230';
  ctx.beginPath(); ctx.moveTo(38, -92); ctx.quadraticCurveTo(24, -50, 54, -44); ctx.quadraticCurveTo(84, -50, 70, -92); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7cf67c'; ctx.font = '900 20px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('$', 54, -58);
  // The jaw.
  const hy = -178;
  ctx.fillStyle = '#cfcfcf'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-24, hy - 16); ctx.quadraticCurveTo(-26, hy - 40, 0, hy - 40); ctx.quadraticCurveTo(26, hy - 40, 24, hy - 16); ctx.lineTo(22, hy + 14); ctx.quadraticCurveTo(20, hy + 28, 0, hy + 30); ctx.quadraticCurveTo(-20, hy + 28, -22, hy + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath(); ctx.moveTo(-20, hy + 8); ctx.quadraticCurveTo(-18, hy + 26, 0, hy + 28); ctx.quadraticCurveTo(18, hy + 26, 20, hy + 8); ctx.lineTo(18, hy + 4); ctx.quadraticCurveTo(0, hy + 16, -18, hy + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath(); ctx.ellipse(0, hy - 34, 24, 9, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-16, hy - 14); ctx.lineTo(-4, hy - 18); ctx.moveTo(4, hy - 18); ctx.lineTo(16, hy - 14); ctx.stroke();
  ctx.fillStyle = INK;
  for (const ex of [-8, 8]) { ctx.beginPath(); ctx.arc(ex, hy - 6, 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-7, hy + 10); ctx.lineTo(7, hy + 10); ctx.stroke();
  ctx.restore();
}

/** The whole video feed, clipped to its frame. */
export function drawStream(ctx: CanvasRenderingContext2D, s: Stream, tension: number, reduced: boolean): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(VIDEO.x, VIDEO.y, VIDEO.w, VIDEO.h); ctx.clip();
  // Room: dark wall lit by LED strips that pulse with the hype.
  const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(s.time * (2 + 6 * tension));
  ctx.fillStyle = '#2a1f3d';
  ctx.fillRect(0, 0, VIDEO.w, VIDEO.h);
  const led = ctx.createLinearGradient(0, 0, VIDEO.w, 0);
  led.addColorStop(0, `rgba(255, 60, 200, ${0.25 + 0.3 * pulse})`);
  led.addColorStop(0.5, `rgba(90, 60, 255, ${0.2 + 0.3 * (1 - pulse)})`);
  led.addColorStop(1, `rgba(255, 60, 200, ${0.25 + 0.3 * pulse})`);
  ctx.fillStyle = led;
  ctx.fillRect(0, 0, VIDEO.w, 14);
  ctx.fillRect(0, 0, 14, VIDEO.h);
  ctx.fillRect(VIDEO.w - 14, 0, 14, VIDEO.h);
  ctx.fillStyle = 'rgba(255, 80, 200, 0.08)';
  ctx.fillRect(0, 0, VIDEO.w, VIDEO.h);
  // Shelf with plushies and a GM poster.
  ctx.fillStyle = '#4a3a66'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(40, 120, 150, 10, 3); ctx.fill(); ctx.stroke();
  for (const [px, c] of [[62, '#ffb3d6'], [100, '#8fd3ff'], [140, '#ffe27a']] as const) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, 104, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px - 5, 100, 2, 0, Math.PI * 2); ctx.arc(px + 5, 100, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#14213d';
  ctx.beginPath(); ctx.roundRect(60, 24, 90, 70, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a'; ctx.font = '900 30px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('GM', 105, 70);
  // The door behind her, its handle, and the shadow under it.
  const door = { x: 400, y: 60, w: 130, h: 300 };
  ctx.fillStyle = '#5a4470'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  const open = s.ended ? smoothstep(0, 0.6, s.endAge) : 0;
  if (open > 0.02) {
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(door.x, door.y, door.w, door.h);
    drawBoyfriend(ctx, s.boyfriendX.x, door.y + door.h - 4, s.time);
    ctx.fillStyle = '#5a4470';
    ctx.beginPath(); ctx.moveTo(door.x, door.y); ctx.lineTo(door.x + door.w * (1 - open) * 0.6, door.y + 12 * open); ctx.lineTo(door.x + door.w * (1 - open) * 0.6, door.y + door.h - 12 * open); ctx.lineTo(door.x, door.y + door.h); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.roundRect(door.x, door.y, door.w, door.h, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(28, 31, 38, 0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(door.x + 16, door.y + 20, door.w - 32, 110);
    ctx.strokeRect(door.x + 16, door.y + 160, door.w - 32, 110);
    ctx.save();
    ctx.translate(door.x + 22, door.y + 150);
    ctx.rotate(clamp(s.handle.x, 0, 1) * 0.9);
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-4, -4, 26, 8, 4); ctx.fill(); ctx.stroke();
    ctx.restore();
    const shadow = clamp(s.handle.x, 0, 1);
    if (shadow > 0.05) { ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * shadow})`; ctx.beginPath(); ctx.ellipse(door.x + door.w / 2, door.y + door.h + 4, 40, 6, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.strokeRect(door.x, door.y, door.w, door.h);
  // Desk, the money bags stacking up.
  ctx.fillStyle = '#3d2c52'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(120, 360, 420, 80, 6); ctx.fill(); ctx.stroke();
  for (let i = 0; i < s.bags; i += 1) {
    const bx = 430 + (i % 3) * 34;
    const by = 356 - Math.floor(i / 3) * 30;
    ctx.fillStyle = '#7a5230'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(bx - 10, by - 26); ctx.quadraticCurveTo(bx - 18, by, bx, by); ctx.quadraticCurveTo(bx + 18, by, bx + 10, by - 26); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7cf67c'; ctx.font = '900 13px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', bx, by - 7);
  }
  // Ring light.
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.4 * pulse})`; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(80, 300, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(80, 344); ctx.lineTo(80, 440); ctx.stroke();
  drawQueen(ctx, s, tension);
  for (const h of s.hearts) { ctx.globalAlpha = 1 - h.age / h.life; heart(ctx, h.x, h.y, h.size, '#ff4d6d'); }
  ctx.globalAlpha = 1;
  // The end: static, then the card.
  if (s.ended) {
    const k = smoothstep(0.9, 1.6, s.endAge);
    if (s.endAge > 0.9 && s.endAge < 1.6 && !reduced) {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, VIDEO.w, VIDEO.h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 400; i += 1) { const n = i * 7.1 + Math.floor(s.time * 30); ctx.fillRect(noise(n) * VIDEO.w, noise(n * 1.3) * VIDEO.h, 3, 2); }
    }
    if (k > 0) {
      ctx.fillStyle = `rgba(17, 17, 20, ${k})`;
      ctx.fillRect(0, 0, VIDEO.w, VIDEO.h);
      ctx.globalAlpha = k;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      ctx.font = '900 54px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center';
      ctx.strokeText('STREAM ENDED', VIDEO.w / 2, VIDEO.h / 2 - 10); ctx.fillText('STREAM ENDED', VIDEO.w / 2, VIDEO.h / 2 - 10);
      ctx.font = '900 20px Impact, "Arial Black", sans-serif';
      ctx.fillStyle = '#ff9db0';
      ctx.fillText('thanks for the sol frens', VIDEO.w / 2, VIDEO.h / 2 + 30);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  // Frame.
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.strokeRect(VIDEO.x, VIDEO.y, VIDEO.w, VIDEO.h);
}

/** The queen at her desk: hoodie, cat ears, big eyes, the wave and the kiss, the glance at the door. */
function drawQueen(ctx: CanvasRenderingContext2D, s: Stream, tension: number): void {
  const bounce = clamp(s.bounce.x, -1, 1.5);
  const sway = Math.sin(s.time * 1.4) * 4;
  const shock = clamp(s.shock.x, 0, 1);
  ctx.save();
  ctx.translate(300 + sway, 372 - bounce * 12);
  ctx.lineJoin = 'round';
  const hoodie = '#ff5d9e';
  ctx.fillStyle = hoodie; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-70, 0); ctx.quadraticCurveTo(-74, -110, -30, -128); ctx.lineTo(30, -128); ctx.quadraticCurveTo(74, -110, 70, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(28, 31, 38, 0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-12, -120); ctx.lineTo(-16, -60); ctx.moveTo(12, -120); ctx.lineTo(16, -60); ctx.stroke();
  // Arms: on the desk, waving, or hands to the face in shock.
  const wave = clamp(s.wave.x, 0, 1);
  const kiss = clamp(s.kiss.x, 0, 1);
  if (shock > 0.4) { limb(ctx, { x: -60, y: -80 }, { x: -30, y: -150 }, 16, hoodie); limb(ctx, { x: 60, y: -80 }, { x: 30, y: -150 }, 16, hoodie); }
  else {
    limb(ctx, { x: -60, y: -80 }, { x: -70, y: -6 }, 16, hoodie);
    const hand = { x: mix(60, 84, wave), y: mix(-6, -170 - Math.sin(s.time * 12) * 10 * wave, wave) };
    const kissHand = { x: 30, y: -140 };
    limb(ctx, { x: 60, y: -80 }, kiss > 0.3 ? kissHand : hand, 16, hoodie);
    ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    const hp = kiss > 0.3 ? kissHand : hand;
    ctx.beginPath(); ctx.arc(hp.x, hp.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // Head.
  const hy = -166;
  const glance = clamp(s.glance.x, 0, 1);
  ctx.fillStyle = '#f3dccb'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, hy, 40, 44, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Hair and cat-ear headset.
  const hairBounce = clamp(s.hair.x, -1, 1) * 6;
  ctx.fillStyle = '#5a3a22';
  ctx.beginPath(); ctx.moveTo(-42, hy + 10); ctx.quadraticCurveTo(-48, hy - 50, 0, hy - 52); ctx.quadraticCurveTo(48, hy - 50, 42, hy + 10); ctx.lineTo(50, hy + 60 + hairBounce); ctx.lineTo(34, hy + 56 + hairBounce); ctx.lineTo(30, hy - 10); ctx.quadraticCurveTo(0, hy - 30, -30, hy - 10); ctx.lineTo(-34, hy + 56 + hairBounce); ctx.lineTo(-50, hy + 60 + hairBounce); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb3d6';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 14, hy - 40); ctx.lineTo(side * 34, hy - 78); ctx.lineTo(side * 40, hy - 34); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, hy - 10, 42, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.roundRect(-50, hy - 12, 12, 26, 5); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(38, hy - 12, 12, 26, 5); ctx.fill(); ctx.stroke();
  // Eyes: big, glancing at the door, hearts when she kisses, wide at the reveal.
  const eyeOpen = clamp(s.eyeOpen.x, 0.08, 1.4) * (shock > 0.4 ? 1.4 : 1);
  for (const ex of [-15, 15]) {
    ctx.beginPath(); ctx.ellipse(ex, hy - 2, 9, 11 * eyeOpen, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    if (kiss > 0.4) heart(ctx, ex, hy - 2, 6, '#ff4d6d');
    else if (eyeOpen > 0.3) { ctx.fillStyle = '#5b8fd6'; ctx.beginPath(); ctx.arc(ex + 5 * glance, hy - 1 - 2 * glance, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + 5 * glance - 2, hy - 4, 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-24, hy - 18 - 2 * shock); ctx.lineTo(-8, hy - 20 - 6 * shock); ctx.moveTo(8, hy - 20 - 6 * shock); ctx.lineTo(24, hy - 18 - 2 * shock); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 90, 120, 0.4)';
  ctx.beginPath(); ctx.ellipse(-24, hy + 12, 8, 4, 0, 0, Math.PI * 2); ctx.ellipse(24, hy + 12, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (shock > 0.4) { ctx.ellipse(0, hy + 20, 7, 10, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1420'; ctx.fill(); }
  else if (kiss > 0.4) { ctx.ellipse(0, hy + 18, 5, 5, 0, 0, Math.PI * 2); ctx.fillStyle = '#e63946'; ctx.fill(); }
  else { ctx.moveTo(-9, hy + 16); ctx.quadraticCurveTo(0, hy + 24 + 3 * tension, 9, hy + 16); }
  ctx.stroke();
  if (kiss > 0.4) { ctx.globalAlpha = kiss; heart(ctx, 60 + (1 - kiss) * 40, hy - 20 - (1 - kiss) * 40, 10, '#ff4d6d'); ctx.globalAlpha = 1; }
  ctx.restore();
}
