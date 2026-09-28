/**
 * The dev. He watches from a throne on a cloud, with a big red SELL lever
 * beside him. The cloud drifts in over the ape as the multiplier climbs, his
 * hand drifts from the armrest toward the lever with the tension and trembles
 * over it near the top (the anticipation the crash pays off). At the crash he
 * pulls it, the lever slams over with a ring, and the coin lets go. Nothing
 * here changes the committed outcome: he only ever pulls when the server says
 * the round is over.
 */
import { type Spring, clamp, mix, noise, settleSpring, spring, stepSpring } from './motion';

const INK = '#1c1f26';
const SKIN = '#f3dccb';
/** Where the cloud parks (screen), how far it comes in over the hill at full tension, and how low it gets. */
const HOME = { x: 118, y: 168 };
const REACH = { x: 190, y: 30 };

export interface DevState {
  /** 0 on the armrest .. 1 on the lever. */
  hand: Spring;
  /** 0 up .. 1 pulled. */
  lever: Spring;
  /** 1 while the pull's shock runs through him. */
  recoil: Spring;
  pulled: boolean;
  notches: number;
  time: number;
  events: { notch: boolean };
}

export function createDev(): DevState {
  return { hand: spring(0), lever: spring(0), recoil: spring(0), pulled: false, notches: 0, time: 0, events: { notch: false } };
}

export function resetDev(d: DevState): void {
  settleSpring(d.hand, 0);
  settleSpring(d.lever, 0);
  settleSpring(d.recoil, 0);
  d.pulled = false;
  d.notches = 0;
}

/** How close the hand hovers for a round this tense: it never quite gets there on its own. */
const hover = (tension: number, running: boolean): number => (running ? clamp(tension, 0, 1) * 0.82 : 0);

/** The pose a round already under way (or already over) calls for. */
export function settleDev(d: DevState, tension: number, running: boolean, crashed: boolean): void {
  resetDev(d);
  if (crashed) {
    d.pulled = true;
    settleSpring(d.hand, 1);
    settleSpring(d.lever, 1);
    return;
  }
  settleSpring(d.hand, hover(tension, running));
  d.notches = Math.floor(d.hand.x * 4);
}

export function stepDev(d: DevState, tension: number, running: boolean, dt: number): void {
  d.time += dt;
  const target = d.pulled ? 1 : hover(tension, running);
  stepSpring(d.hand, target, d.pulled ? 30 : 3, d.pulled ? 0.5 : 0.9, dt);
  const notches = Math.floor(clamp(d.hand.x, 0, 0.999) * 4);
  d.events.notch = notches > d.notches;
  d.notches = notches;
  stepSpring(d.lever, d.pulled ? 1 : 0, 26, 0.35, dt);
  stepSpring(d.recoil, 0, 12, 0.5, dt);
}

/** The crash: he pulls it. */
export function pullLever(d: DevState): void {
  d.pulled = true;
  d.hand.v += 40;
  d.recoil.v += 14;
}

/** Where the cloud is for a round this tense: it comes in over the hill, lower, the closer the dev is to selling. */
export function cloudAt(tension: number, running: boolean): { x: number; y: number; s: number } {
  const t = running ? clamp(tension, 0, 1) : 0;
  return { x: HOME.x + REACH.x * t, y: HOME.y + REACH.y * t, s: 1.05 + 0.12 * t };
}

/** Draws the cloud, the throne, the dev and the lever at a screen position and scale. */
export function drawDev(ctx: CanvasRenderingContext2D, d: DevState, x: number, y: number, s: number, tension: number, reduced: boolean): void {
  const hand = clamp(d.hand.x, 0, 1.1);
  const lever = clamp(d.lever.x, 0, 1.15);
  // The tremble over the lever, near the top (still under reduced motion).
  const tremble = reduced || d.pulled ? 0 : Math.max(0, hand - 0.6) * 2.5;
  const jx = (noise(Math.floor(d.time * 33)) - 0.5) * 3 * tremble;
  const jy = (noise(Math.floor(d.time * 29) + 5) - 0.5) * 2.5 * tremble;
  ctx.save();
  ctx.translate(x, y + Math.sin(d.time * 1.3) * 3);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // The cloud he sits on: three puffs, a shadow underneath, and a dip where the lever's base weighs it down.
  ctx.fillStyle = 'rgba(120, 140, 170, 0.35)';
  ctx.beginPath(); ctx.ellipse(8, 20, 60, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(120, 140, 170, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-24, 10, 30, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(12, 6, 36, 20, 0, 0, Math.PI * 2);
  ctx.ellipse(46, 12, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(10, 8, 54, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, d.recoil.x * 3);
  // The throne: a high back, gold trim, a cushion.
  ctx.fillStyle = '#7d1d2b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-20, -48, 28, 50, [8, 8, 2, 2]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd60a';
  ctx.beginPath(); ctx.roundRect(-20, -50, 28, 6, 3); ctx.fill(); ctx.stroke();
  for (const x of [-16, -6, 4]) { ctx.beginPath(); ctx.arc(x, -53, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#a3243a';
  ctx.beginPath(); ctx.roundRect(-22, -8, 34, 8, 3); ctx.fill(); ctx.stroke();
  // The lever base and its slot, to his right.
  ctx.fillStyle = '#4b5563';
  ctx.beginPath(); ctx.roundRect(22, -10, 26, 10, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.font = '900 7px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SELL', 35, -5, 22);
  // The lever itself: up when armed, thrown over to the right when pulled, overshooting on the spring.
  const angle = mix(-0.35, 1.25, lever);
  const tip = { x: 35 + Math.sin(angle) * 34, y: -10 - Math.cos(angle) * 34 };
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(35, -10); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  ctx.strokeStyle = '#9aa3ad';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(tip.x, tip.y, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // The dev: hoodie, legs crossed, one arm on the rest, the other reaching for the lever.
  ctx.translate(jx, jy);
  ctx.strokeStyle = INK; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(4, -4); ctx.lineTo(14, -2); ctx.stroke();
  ctx.strokeStyle = '#2b3a55'; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(8, -8); ctx.lineTo(16, -12); ctx.stroke();
  ctx.strokeStyle = '#2b3a55'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#1f2937';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-14, -34, 22, 24, 6); ctx.fill(); ctx.stroke();
  // The reaching arm: from the shoulder to a point between the armrest and the lever's handle.
  const rest = { x: 12, y: -16 };
  const grip = { x: tip.x - 2, y: tip.y + 2 };
  const hx = mix(rest.x, grip.x, hand);
  const hy = mix(rest.y, grip.y, hand) - Math.sin(Math.PI * clamp(hand, 0, 1)) * 8;
  ctx.strokeStyle = INK; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(4, -28); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = SKIN;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Head in the hood: shades, a grin that gets wider with the tension.
  ctx.fillStyle = '#1f2937';
  ctx.beginPath(); ctx.arc(-3, -42, 12, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); ctx.stroke();
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.arc(-3, -41, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-10, -44, 6, 3.5);
  ctx.fillRect(-2, -44, 6, 3.5);
  ctx.fillRect(-4, -43, 2, 1.2);
  const grin = 0.3 + 0.7 * clamp(tension, 0, 1);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-7, -37); ctx.quadraticCurveTo(-3, -37 + 5 * grin, 1 + 2 * grin, -37.5); ctx.stroke();
  if (d.pulled) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-6, -36.5); ctx.quadraticCurveTo(-3, -33, 1, -36.5); ctx.closePath(); ctx.fill();
  }
  // A plaque on the throne's foot.
  ctx.fillStyle = '#ffe27a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-30, 4, 78, 11, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = '900 8px Impact, "Arial Black", sans-serif';
  ctx.fillText(d.pulled ? 'DEV · SOLD · SEE YA' : 'DEV · DIAMOND HANDS', 9, 9.8, 72);
  ctx.restore();
}
