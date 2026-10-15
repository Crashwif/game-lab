/**
 * Everyone who is not cooking: the possum on top of the fridge (it faints on cue, plays dead through the blast
 * riding the fridge, and walks off unhurt), the hound asleep by the truck, Miss Darlene across the road (TV, light,
 * window, porch with the cordless phone, lawn chair with popcorn, phone up filming), Sheriff Boyd's cruiser and
 * his bullhorn, and the saucer that turns up at 62×. Their states come from the displayed multiplier, the
 * lines' beats and the crash clock; nothing here reads or changes the committed outcome.
 */
import { DOG, NEIGHBOUR, ROAD } from './layout';
import { blob, box, ink, INK, label, limb, poly } from './ink';
import { clamp, mix, noise, smoothstep } from './motion';

// ─── The possum ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The possum at (x, y) on its feet, or fainted on its back (`dead` 0 → 1), legs in the air, tongue out, crosses for
 * eyes. `look` turns its head; `peek` opens one eye while it plays dead.
 */
export function drawPossum(ctx: CanvasRenderingContext2D, x: number, y: number, dead: number, look: number, time: number, peek = 0): void {
  const k = clamp(dead, 0, 1.2);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI * 0.95 * smoothstep(0, 1, k));
  ctx.translate(0, -18 * (1 - smoothstep(0.3, 1, k)));
  // Tail, curled.
  ink(ctx, 5, INK);
  ctx.beginPath();
  ctx.moveTo(-20, 6);
  ctx.quadraticCurveTo(-46, 10, -40, -6);
  ctx.stroke();
  ink(ctx, 3, '#e9b3b8');
  ctx.stroke();
  // Legs: on the ground, or stiff in the air.
  for (const lx of [-12, -4, 8, 16]) {
    const len = 10 + 4 * k;
    limb(ctx, [{ x: lx, y: 8 }, { x: lx + (k > 0.5 ? 0 : 2), y: 8 + len }], 4, '#e9b3b8', 1.6);
  }
  // Body: grey, a pale face to the right.
  blob(ctx, 0, 0, 26, 15, '#9a9aa2', 2.4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-4, -6, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const hx = 24 + look * 2;
  poly(ctx, [hx - 10, -12, hx + 18, -2, hx - 8, 8], '#eeeef0', 2.2);
  blob(ctx, hx + 18, -2, 3.2, 2.6, '#e88a9a', 1.4);
  for (const ex of [-6, 2]) blob(ctx, hx + ex - 2, -15, 5, 6, '#2a2a30', 1.8);
  if (k > 0.5) {
    // Crosses for eyes, the tongue out.
    ink(ctx, 1.6);
    ctx.beginPath();
    ctx.moveTo(hx - 2, -6);
    ctx.lineTo(hx + 4, -1);
    ctx.moveTo(hx + 4, -6);
    ctx.lineTo(hx - 2, -1);
    ctx.stroke();
    if (peek > 0.5) {
      blob(ctx, hx + 8, -4, 2.6, 2.6, '#fbf8f2', 1);
      blob(ctx, hx + 8.6, -4, 1.1, 1.1, INK, 0);
    }
    blob(ctx, hx + 10, 5, 2.4, 4, '#e86a7a', 1.2);
  } else {
    blob(ctx, hx + 4, -4, 2.2, 2.2, INK, 0);
    if (Math.sin(time * 1.3) > 0.97) blob(ctx, hx + 4, -4, 2.4, 0.6, '#eeeef0', 0);
  }
  ctx.restore();
}

// ─── The dog ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The hound by the truck: asleep (Zzz), lifting his head for a passer-by, flattened by the blast, ears inside out. */
export function drawDog(ctx: CanvasRenderingContext2D, time: number, alert: number, blast: number): void {
  const x = DOG.x - 60 * smoothstep(0, 0.3, blast) * (1 - smoothstep(2.5, 3.5, blast));
  const y = DOG.y;
  const sit = smoothstep(2.8, 3.4, blast);
  ctx.save();
  ctx.translate(x, y);
  // The tire he's chained to.
  blob(ctx, -110, 4, 56, 20, '#1a1a1c', 4);
  ink(ctx, 3, '#777');
  ctx.beginPath();
  ctx.moveTo(-80, -4);
  ctx.quadraticCurveTo(-40, 14, -10, -6);
  ctx.stroke();
  // Body lying down (or sitting up after).
  blob(ctx, 0, -18 - 20 * sit, 70, 30 + 10 * sit, '#b07a3e', 4);
  for (const lx of [-40, 40]) box(ctx, lx - 10, -10, 20, 14, 6, '#b07a3e', 3);
  // Head: on his paws, lifted when he's alert, back up after the blast.
  const lift = Math.max(alert, sit);
  const hx = 70;
  const hy = -24 - 26 * lift;
  blob(ctx, hx, hy, 30, 24, '#b07a3e', 4);
  blob(ctx, hx + 26, hy + 6, 14, 10, '#c99158', 3);
  blob(ctx, hx + 38, hy + 2, 6, 5, INK, 0);
  // Ears: down, or blown inside out.
  const flip = smoothstep(0.1, 0.3, blast);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(hx - 6 + side * 10, hy - 14);
    ctx.rotate(side * 0.3 + flip * -2.4);
    blob(ctx, 0, 22, 9, 22, flip > 0.5 ? '#e9b3b8' : '#7a4f24', 3);
    ctx.restore();
  }
  if (lift > 0.3) blob(ctx, hx + 8, hy - 4, 4, 4, '#fbf8f2', 2);
  else {
    ink(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(hx + 2, hy - 4);
    ctx.lineTo(hx + 12, hy - 4);
    ctx.stroke();
  }
  // Tail: a thump, and a wag once he's up.
  const wag = sit > 0.5 ? Math.sin(time * 14) * 0.6 : Math.sin(time * 1.2) * 0.1;
  ctx.save();
  ctx.translate(-66, -24);
  ctx.rotate(-2.4 + wag);
  limb(ctx, [{ x: 0, y: 0 }, { x: 0, y: 40 }], 8, '#b07a3e', 3);
  ctx.restore();
  ctx.restore();
  if (lift < 0.3 && blast <= 0) {
    for (let i = 0; i < 3; i += 1) {
      const u = ((time * 0.5 + i / 3) % 1);
      label(ctx, 'z', x + 110 + u * 50, y - 60 - u * 90, 26 + 16 * u, `rgba(240, 240, 255, ${0.8 * (1 - u)})`, 900);
    }
  }
}

// ─── Miss Darlene ───────────────────────────────────────────────────────────────────────────────────────────────
export type DarleneState = 'tv' | 'window' | 'porch' | 'chair' | 'video';
/** What Miss Darlene's trailer shows: her porch light and her window. */
export const darleneLights = (state: DarleneState): { porch: boolean; window: number; tv: boolean } => ({ porch: state === 'porch' || state === 'chair' || state === 'video', window: state === 'tv' ? 0 : 1, tv: state === 'tv' });
/** Where her bubbles come from, in the world (she is small and far: the tail points at the window). */
export const DARLENE_AT = { x: NEIGHBOUR.x0 + 18, y: NEIGHBOUR.roof + 10 } as const;

/** Miss Darlene, tiny across the road: curlers and a pink robe; at her window, on the porch, in her lawn chair. */
export function drawDarlene(ctx: CanvasRenderingContext2D, state: DarleneState, time: number, blown: number): void {
  if (state === 'tv') return;
  const { x0, roof, base } = NEIGHBOUR;
  const s = 0.32;
  let x = x0 + 64;
  let y = roof + 22;
  if (state === 'porch' || state === 'video') [x, y] = [x0 - 2, base - 2];
  if (state === 'chair') [x, y] = [x0 - 4, base - 2];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (state === 'window') {
    // Head and shoulders in her window, leaning out.
    ctx.translate(0, -6);
    blob(ctx, 0, 10, 26, 16, '#e58fb4', 3);
    blob(ctx, 0, -16, 16, 18, '#f0c8a8', 3);
    for (const cx of [-12, -2, 8]) blob(ctx, cx, -32, 6, 6, '#f2c230', 2);
    ctx.restore();
    return;
  }
  if (state === 'chair') {
    // A lawn chair, a bowl of popcorn in her lap.
    ink(ctx, 5, '#a9afb6');
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-20, -40);
    ctx.lineTo(30, -40);
    ctx.lineTo(30, 0);
    ctx.stroke();
    blob(ctx, 0, -60, 26, 30, '#e58fb4', 3);
    blob(ctx, 24, -50, 18, 10, '#f4efe2', 3);
    for (let i = 0; i < 4; i += 1) blob(ctx, 16 + i * 5, -60 - (i % 2) * 4, 5, 5, '#fff7d0', 1.5);
  } else {
    // Standing on the porch in her robe.
    box(ctx, -18, -96, 36, 96, 14, '#e58fb4', 3);
    for (const lx of [-8, 8]) box(ctx, lx - 4, -6, 8, 8, 2, '#f0c8a8', 2);
  }
  const hy = state === 'chair' ? -104 : -116;
  ctx.save();
  ctx.translate(0, hy);
  ctx.rotate(-blown * 0.3);
  blob(ctx, 0, 0, 16, 18, '#f0c8a8', 3);
  for (const cx of [-12, -2, 8]) blob(ctx, cx - blown * 8, -16 - blown * 4, 6, 6, '#f2c230', 2);
  ctx.restore();
  if (state === 'porch') {
    // The cordless phone at her ear.
    box(ctx, 12, hy - 10, 10, 24, 3, '#2a2a30', 2);
  }
  if (state === 'video') {
    // Phone up, filming: a little screen glowing.
    limb(ctx, [{ x: 10, y: -80 }, { x: 30, y: -110 }], 10, '#e58fb4', 3);
    box(ctx, 22, -136, 20, 30, 4, '#2a2a30', 2.5);
    box(ctx, 25, -132, 14, 20, 2, noise(Math.floor(time * 4)) > 0.5 ? '#9fd2ff' : '#ff6b6b', 1);
  }
  ctx.restore();
}

// ─── Sheriff Boyd ───────────────────────────────────────────────────────────────────────────────────────────────
/** Where the cruiser stops on the road, and where his bullhorn bubbles come from. */
const CAR = { x: 676, y: ROAD.y + 2 } as const;
export const SHERIFF_AT = { x: CAR.x + 30, y: CAR.y - 20 } as const;
/** The cruiser: `arrive` 0 → 1 slides it in along the road from the left; `out` stands him beside it with the bullhorn. */
export function drawSheriff(ctx: CanvasRenderingContext2D, arrive: number, out: number, time: number): void {
  if (arrive <= 0) return;
  const x = mix(CAR.x - 260, CAR.x, smoothstep(0, 1, arrive));
  const y = CAR.y;
  const s = 0.3;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // The car: a black and white sedan with a light bar.
  box(ctx, -80, -40, 160, 30, 8, '#f4f4f0', 3);
  box(ctx, -50, -66, 96, 30, 8, '#1d1d22', 3);
  box(ctx, -80, -26, 160, 10, 2, '#1d1d22', 0);
  label(ctx, 'SHERIFF', 0, -24, 16, '#d6b04c', 900, 120);
  for (const wx of [-50, 50]) blob(ctx, wx, -8, 16, 16, '#18181a', 3);
  const on = Math.sin(time * 14) > 0;
  box(ctx, -24, -78, 22, 10, 3, on ? '#ff3b3b' : '#5a1a1a', 2);
  box(ctx, 2, -78, 22, 10, 3, on ? '#1d1d40' : '#3b6bff', 2);
  // Sheriff Boyd, by the door with the bullhorn up.
  if (out > 0.02) {
    ctx.globalAlpha = clamp(out, 0, 1);
    box(ctx, 90, -96, 34, 88, 10, '#8a6a3a', 3);
    blob(ctx, 107, -114, 16, 18, '#e0b088', 3);
    poly(ctx, [84, -126, 130, -126, 120, -138, 94, -138], '#5a4a2a', 3);
    box(ctx, 76, -132, 34, 14, 4, '#e8e4dc', 2.5);
    limb(ctx, [{ x: 98, y: -80 }, { x: 84, y: -110 }], 12, '#8a6a3a', 3);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
/** The red and blue wash the light bar throws, for the kitchen and the aftermath. */
export function sirenWash(time: number): { red: number; blue: number } {
  const on = Math.sin(time * 14) > 0;
  return { red: on ? 1 : 0, blue: on ? 0 : 1 };
}

// ─── The saucer ─────────────────────────────────────────────────────────────────────────────────────────────────
/** The saucer: hovering over Darlene's trailer with its beam on her flamingo, at `at`, scaled. */
export function drawUfo(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, scale: number, beam: number, time: number): void {
  ctx.save();
  ctx.translate(at.x, at.y + Math.sin(time * 2) * 3 * scale);
  ctx.scale(scale, scale);
  if (beam > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, 0, 160);
    g.addColorStop(0, `rgba(140, 255, 170, ${0.55 * beam})`);
    g.addColorStop(1, 'rgba(140, 255, 170, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(12, 6);
    ctx.lineTo(44, 160);
    ctx.lineTo(-44, 160);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  blob(ctx, 0, -8, 18, 14, 'rgba(170, 230, 255, 0.85)', 2.5);
  blob(ctx, 0, 0, 52, 13, '#9aa3ad', 2.5);
  for (let i = 0; i < 5; i += 1) {
    const lit = Math.sin(time * 6 + i) > 0;
    blob(ctx, -36 + i * 18, 2, 4, 3, lit ? '#ffe36b' : '#7a7a50', 1.2);
  }
  ctx.restore();
}
