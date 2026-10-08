/**
 * The dev. He watches from a throne on a cloud, with a big red SELL lever
 * beside him. The cloud drifts in over the ape as the multiplier climbs, his
 * hand drifts from the armrest toward the lever with the tension and trembles
 * over it as it gets close (the anticipation the crash pays off). Now and then,
 * at fixed multipliers, he feints: grabs the handle, clicks it, lets go. At the
 * crash he grabs it, winds up, yanks it over, and the coin lets go. Nothing
 * here changes the committed outcome: he only ever pulls when the server says
 * the round is over, and his feints follow the multiplier, never the outcome.
 */
import { type Spring, clamp, mix, noise, settleSpring, smoothstep, spring, stepSpring } from './motion';

const INK = '#1c1f26';
const SKIN = '#f3dccb';
/** Where the cloud parks (screen), how far it comes in over the hill at full tension, and how low it gets. */
const HOME = { x: 118, y: 168 };
const REACH = { x: 190, y: 30 };
/** Creak notches on the way to the lever, the wind-up before the yank, and what he says after a feint. */
const NOTCHES = 8;
const WIND_UP_S = 0.06;
const FEINT_LINES = ['jk', 'relax', 'not yet', 'ser pls', 'probably nothing', 'few understand'];

export interface DevState {
  /** 0 on the armrest .. 1 on the lever: where his hand hovers for the tension. */
  hand: Spring;
  /** 0 .. 1 of the rest of the way to the handle, for a feint. */
  feint: Spring;
  /** Seconds left holding the handle in a feint, how many feints this round, and how long the quip stays up. */
  feintHold: number;
  feints: number;
  quip: number;
  /** Seconds since his hand closed on the handle for the real pull; -1 before. */
  grab: number;
  /** 0 up .. 1 pulled. */
  lever: Spring;
  /** 1 while the pull's shock runs through him. */
  recoil: Spring;
  pulled: boolean;
  notches: number;
  time: number;
  events: { notch: boolean; click: boolean };
}

export function createDev(): DevState {
  return { hand: spring(0), feint: spring(0), feintHold: 0, feints: 0, quip: 0, grab: -1, lever: spring(0), recoil: spring(0), pulled: false, notches: 0, time: 0, events: { notch: false, click: false } };
}

export function resetDev(d: DevState): void {
  settleSpring(d.hand, 0);
  settleSpring(d.feint, 0);
  settleSpring(d.lever, 0);
  settleSpring(d.recoil, 0);
  d.feintHold = d.feints = d.quip = 0;
  d.grab = -1;
  d.pulled = false;
  d.notches = 0;
}

/** How far his hand actually is toward the handle, feint included. */
const reachOf = (d: DevState): number => d.hand.x + (1 - d.hand.x) * d.feint.x;

/** How close the hand hovers for a round this tense: it never quite gets there on its own. */
const hover = (tension: number, running: boolean): number => (running ? clamp(tension, 0, 1) * 0.82 : 0);

/** The pose a round already under way (or already over) calls for. */
export function settleDev(d: DevState, tension: number, running: boolean, crashed: boolean): void {
  resetDev(d);
  if (crashed) {
    d.pulled = true;
    d.grab = 1;
    settleSpring(d.hand, 1);
    settleSpring(d.lever, 1);
    return;
  }
  settleSpring(d.hand, hover(tension, running));
  d.notches = Math.floor(d.hand.x * NOTCHES);
}

export function stepDev(d: DevState, tension: number, running: boolean, dt: number): void {
  d.time += dt;
  stepSpring(d.hand, d.pulled ? 1 : hover(tension, running), d.pulled ? 30 : 3, d.pulled ? 0.5 : 0.9, dt);
  const notches = Math.floor(clamp(d.hand.x, 0, 0.999) * NOTCHES);
  d.events.notch = notches > d.notches;
  d.notches = notches;
  // A feint: the hand closes on the handle, clicks it a notch, and lets go with a quip.
  const holding = d.feintHold > 0;
  d.feintHold = Math.max(0, d.feintHold - dt);
  if (holding && d.feintHold === 0) d.quip = 1.4;
  d.quip = Math.max(0, d.quip - dt);
  stepSpring(d.feint, d.feintHold > 0 && !d.pulled ? 1 : 0, 16, 0.75, dt);
  const touching = d.feintHold > 0 && reachOf(d) > 0.95;
  // The real pull: once his hand has the handle, a short wind-up back, then the yank over.
  if (d.pulled && d.grab < 0 && d.hand.x >= 0.95) d.grab = 0;
  if (d.grab >= 0) d.grab += dt;
  const lever = d.grab >= WIND_UP_S ? 1 : d.grab >= 0 ? -0.12 : touching ? 0.12 : 0;
  const was = d.lever.x;
  stepSpring(d.lever, lever, d.grab >= WIND_UP_S ? 26 : 40, 0.35, dt);
  // A feint clicks once, as the handle passes its first notch under his hand.
  d.events.click = touching && was < 0.06 && d.lever.x >= 0.06;
  stepSpring(d.recoil, 0, 12, 0.5, dt);
}

/** A feint, at a multiplier the scene picks: he reaches for the handle, clicks it, and thinks better of it. */
export function feintDev(d: DevState): void {
  if (d.pulled) return;
  d.feintHold = 0.45;
  d.feints += 1;
  d.quip = 0;
}

/** The crash: he goes for it. */
export function pullLever(d: DevState): void {
  d.pulled = true;
  d.feintHold = d.quip = 0;
  d.hand.v += 40;
  d.recoil.v += 14;
}

/** Where the cloud is for a round this tense: it comes in over the hill, lower, the closer the dev is to selling. */
export function cloudAt(tension: number, running: boolean): { x: number; y: number; s: number } {
  const t = running ? clamp(tension, 0, 1) : 0;
  return { x: HOME.x + REACH.x * t, y: HOME.y + REACH.y * t, s: 1.05 + 0.2 * t };
}

/** Draws the cloud, the throne, the dev and the lever at a screen position and scale. */
export function drawDev(ctx: CanvasRenderingContext2D, d: DevState, x: number, y: number, s: number, tension: number, reduced: boolean): void {
  const hand = clamp(reachOf(d), 0, 1.1);
  const lever = clamp(d.lever.x, -0.2, 1.15);
  // The tremble grows as his hand closes on the lever (none under reduced motion); it shakes the hand most.
  const tremble = reduced || d.pulled ? 0 : smoothstep(0.2, 0.7, d.hand.x);
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
  const hx = mix(rest.x, grip.x, hand) + jx * 1.5;
  const hy = mix(rest.y, grip.y, hand) - Math.sin(Math.PI * clamp(hand, 0, 1)) * 8 + jy * 1.5;
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
  // His quip after a feint, in a bubble over his head.
  if (d.quip > 0 && d.feints > 0) {
    const text = FEINT_LINES[(d.feints - 1) % FEINT_LINES.length]!;
    ctx.globalAlpha = clamp(d.quip / 0.3, 0, 1) * clamp((1.4 - d.quip) / 0.12, 0, 1);
    ctx.font = '900 13px Impact, "Arial Black", sans-serif';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.roundRect(4, -86, w, 22, 8); ctx.moveTo(12, -64.5); ctx.lineTo(4, -56); ctx.lineTo(20, -64.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'left';
    ctx.fillText(text, 11, -74.5);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
