/**
 * The jar: glass, a filling honey volume, drips, a lid that screws itself
 * shut, honey strings, and the sell-tax label. The level follows the
 * displayed multiplier. It does not decide the crash.
 */
import { clamp, mix, settleSpring, spring, stepSpring, type Spring } from './motion';

export const INK = '#1c1f26';
export const JAR = { cx: 548, top: 240, w: 188, h: 190 };

/** The label's sell tax: a step every 2–3 s through the 1×–3× most rounds live in, red from 49% (2.3×), past 100% at 8×. */
export function sellTax(multiplier: number): number {
  if (multiplier < 1.2) return 1;
  if (multiplier < 1.45) return 5;
  if (multiplier < 1.8) return 12;
  if (multiplier < 2.3) return 28;
  if (multiplier < 3) return 49;
  if (multiplier < 4.5) return 69;
  if (multiplier < 8) return 99;
  if (multiplier < 50) return 420;
  return multiplier < 500 ? 1337 : 9001;
}

export function honeyLevel(multiplier: number): number {
  const growth = Math.log2(Math.max(1, multiplier));
  return clamp(0.16 + 0.8 * (1 - Math.exp(-growth / 2.3)), 0.16, 0.97);
}

/** Y of the honey surface for a fill in 0..1 (0 empty). */
export function surfaceY(level: number): number {
  return JAR.top + JAR.h - 18 - level * (JAR.h - 40);
}

/** How far toward shut (0..1) the lid screws itself while the round is still open: with the tension, then slowly on with the decades of a long round. */
const lidCreep = (tension: number, multiplier: number): number => clamp(tension * 0.3 + Math.log10(multiplier) * 0.08, 0, 0.6);

/** The lid's lurches toward shut so far: at 1.38× and 2.05×, then every ×1.5 from 2.75× (about every 5 s), however long the round runs. */
export const lidJolts = (m: number): number => (m < 1.38 ? 0 : m < 2.05 ? 1 : m < 2.75 ? 2 : 3 + Math.floor(Math.log(m / 2.75) / Math.log(1.5)));

export interface StringBit { x: number; y: number; life: number; age: number; }

export interface JarState {
  level: Spring;
  angle: number;
  shut: Spring;
  glue: Spring;
  crashed: boolean;
  tax: number;
  taxFlash: number;
  strings: StringBit[];
  drip: number;
  /** The auditor's AUDITED stamp on the glass: on once he has hit it, with a spring that overshoots on the hit. */
  audit: { on: boolean; hit: Spring };
  /** The CAN'T SELL stamp's pop at the crash. */
  stamp: Spring;
  /** The glass's squash: kicked when the lid seats and when the paw comes free, rings back to nothing. */
  squash: Spring;
  seated: boolean;
  band: number;
  /** The lurches so far, the dip toward shut and the spin each one leaves behind (both fading). */
  jolts: number;
  dip: number;
  rush: number;
  events: { glug: boolean; seated: boolean; tax: boolean; jolt: boolean };
}

function freshJar(): JarState {
  return {
    level: spring(0.16),
    angle: 0,
    shut: spring(0),
    glue: spring(0),
    crashed: false,
    tax: 1,
    taxFlash: 0,
    strings: [],
    drip: 0,
    audit: { on: false, hit: spring(0) },
    stamp: spring(0),
    squash: spring(0),
    seated: false,
    band: 1,
    jolts: 0,
    dip: 0,
    rush: 0,
    events: { glug: false, seated: false, tax: false, jolt: false },
  };
}

export function createJar(): JarState {
  return freshJar();
}

export function resetJar(j: JarState): void {
  Object.assign(j, freshJar());
}

/** The auditor's stamp lands: AUDITED on the glass, the mark popping in past size. */
export function stampAudit(j: JarState, quiet = false): void {
  j.audit.on = true;
  if (quiet) settleSpring(j.audit.hit, 1);
  else j.audit.hit.v = 9;
}

/** A knock to the glass (the paw tearing free, a tug, the stamp): it squashes and rings. */
export function knockJar(j: JarState, strength = 1): void {
  j.squash.v += 3 * strength;
}

export function shutJar(j: JarState, quiet: boolean): void {
  if (j.crashed) return;
  j.crashed = true;
  if (quiet) {
    j.shut.x = 1;
    j.glue.x = 1;
    j.angle = 0.2;
    j.seated = true;
    settleSpring(j.stamp, 1);
  } else j.shut.v = 3;
}

/** Jumps the jar to where a round at this multiplier has it (the level, the label's tax, the lid's creep), for a round met late. */
export function settleJar(j: JarState, multiplier: number, tension: number): void {
  settleSpring(j.level, honeyLevel(multiplier));
  settleSpring(j.shut, lidCreep(tension, multiplier));
  j.jolts = lidJolts(multiplier);
  j.tax = sellTax(multiplier);
  j.taxFlash = 0;
  j.band = Math.floor(honeyLevel(multiplier) * 10);
}

/** The lid tilts with tension while the honey drips. */
export interface JarDrive { running: boolean; multiplier: number; tension: number; pulling: boolean; pawX: number; pawY: number; }

export function stepJar(j: JarState, drive: JarDrive, dt: number): void {
  j.events = { glug: false, seated: false, tax: false, jolt: false };
  stepSpring(j.level, j.crashed ? Math.max(j.level.x, honeyLevel(drive.multiplier)) : honeyLevel(drive.multiplier), 4, 0.9, dt);
  const band = Math.floor(clamp(j.level.x, 0, 1) * 10);
  if (drive.running && !j.crashed && band > j.band) j.events.glug = true;
  j.band = band;
  // The lid seats: the glass takes the knock, the stamp comes down on it.
  if (j.crashed && !j.seated && j.shut.x > 0.9) {
    j.seated = true;
    j.squash.v += 3.5;
    j.stamp.v = 10;
  }
  stepSpring(j.squash, 0, 18, 0.32, dt);
  stepSpring(j.stamp, j.seated ? 1 : 0, 14, 0.45, dt);
  stepSpring(j.audit.hit, j.audit.on ? 1 : 0, 12, 0.4, dt);
  // A fake-out keyed to the multiplier: the lid lurches a turn and dips toward shut, then backs off.
  const jolts = lidJolts(drive.multiplier);
  if (drive.running && !j.crashed && jolts > j.jolts) {
    j.events.jolt = true;
    {
      j.dip = 1;
      j.rush = 1;
      j.squash.v += 0.9;
    }
  }
  j.jolts = jolts;
  j.dip *= Math.exp(-2.6 * dt);
  j.rush *= Math.exp(-3.5 * dt);
  // The lid is drawn turned by angle * (1 - shut), so the still tilt straightens as the crash screws it down.
  {
    if (!j.crashed && drive.running) j.angle += dt * (0.5 + drive.tension * 7 + j.rush * 12);
    if (j.crashed) j.angle += dt * 14 * (1 - j.shut.x);
  }
  stepSpring(j.shut, j.crashed ? 1 : Math.min(0.8, lidCreep(drive.tension, drive.multiplier) + j.dip * 0.32), 6, 0.7, dt);
  stepSpring(j.glue, j.crashed ? 1 : 0, 2.4, 0.9, dt);
  const tax = sellTax(drive.multiplier);
  if (tax !== j.tax) {
    j.tax = tax;
    j.taxFlash = 1;
    if (drive.running) j.events.tax = true;
  }
  j.taxFlash = Math.max(0, j.taxFlash - dt * 1.6);
  j.drip += dt * (0.4 + drive.tension) * (1);
  if (drive.pulling) {
    j.strings.push({ x: drive.pawX, y: drive.pawY, life: 0.45, age: 0 });
    if (j.strings.length > 18) j.strings.shift();
  }
  for (const s of j.strings) s.age += dt;
  j.strings = j.strings.filter((s) => s.age < s.life);
}

function ink(ctx: CanvasRenderingContext2D, width = 3): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Impact's sidebearings are narrower than the ink, so the label needs tracking. `maxWidth` squeezes a long line into its box. */
export function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, font = `900 ${size}px Impact, "Arial Black", sans-serif`, maxWidth?: number): void {
  ctx.save();
  ctx.font = font;
  ctx.letterSpacing = `${Math.max(1, Math.round(size * 0.14))}px`;
  ctx.fillStyle = fill;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y, maxWidth);
  ctx.restore();
}

export function honeyColor(glue: number): string {
  const r = Math.round(mix(240, 150, glue));
  const g = Math.round(mix(176, 110, glue));
  const b = Math.round(mix(48, 48, glue));
  return `rgb(${r},${g},${b})`;
}

/** `time` is the scene's decorative clock; `round` the running round's seconds (0 outside one). */
export function drawJar(ctx: CanvasRenderingContext2D, j: JarState, time: number, round: number, drawReach?: () => void): void {
  const { cx, top, w, h } = JAR;
  const left = cx - w / 2;
  const level = clamp(j.level.x, 0, 1);
  const ySurf = surfaceY(level);
  const color = honeyColor(j.glue.x);
  // The whole jar squashes about its base when it takes a knock.
  ctx.save();
  const squash = clamp(j.squash.x, -0.6, 0.6);
  ctx.translate(cx, top + h);
  ctx.scale(1 + squash * 0.07, 1 - squash * 0.07);
  ctx.translate(-cx, -(top + h));
  // Glass body.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, top + 16, w, h - 10, 18);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(left, top, w, h);
  // Honey.
  ctx.fillStyle = color;
  ctx.fillRect(left, ySurf, w, top + h - ySurf);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, ySurf, w * 0.42, 8 + Math.sin(time * 3) * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bubbles.
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 6; i += 1) {
    const bx = cx - 50 + ((i * 37) % 100);
    const by = ySurf + 20 + ((i * 53 + time * 30) % Math.max(20, top + h - ySurf - 24));
    ctx.beginPath();
    ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(cx, top + h); ctx.scale(1 / (1 + squash * 0.07), 1 / (1 - squash * 0.07)); ctx.translate(-cx, -(top + h));
  drawReach?.(); ctx.restore();
  ink(ctx, 4);
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.roundRect(left, top + 16, w, h - 10, 18);
  ctx.stroke();
  // Highlight.
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(left + 16, top + 40);
  ctx.lineTo(left + 16, top + h - 30);
  ctx.stroke();
  // Neck and lip.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.roundRect(cx - 58, top + 4, 116, 28, 8);
  ctx.fill();
  ctx.stroke();
  // Drips once the jar is getting full.
  if (level > 0.62) {
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i += 1) {
      const phase = (j.drip + i * 0.33) % 1;
      const dy = phase * 90;
      ctx.globalAlpha = 1 - phase;
      ctx.beginPath();
      ctx.ellipse(cx + 70, top + 30 + dy, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Label.
  ctx.fillStyle = '#fff8e8';
  ink(ctx, 2);
  ctx.beginPath();
  ctx.roundRect(cx - 62, top + 78, 124, 70, 6);
  ctx.fill();
  ctx.stroke();
  tracked(ctx, '$POT', cx, top + 104, 20, INK);
  ctx.save();
  ctx.translate(cx, top + 128);
  const pop = 1 + j.taxFlash * 0.25;
  ctx.scale(pop, pop);
  // 1337% and 9001% squeeze to fit inside the label.
  tracked(ctx, `SELL TAX ${j.tax}%`, 0, 0, 13, j.tax >= 49 ? '#c0392b' : INK, undefined, 112);
  ctx.restore();
  tracked(ctx, 'BUY TAX 0%', cx, top + 142, 10, '#6b7280', '700 10px system-ui, sans-serif');
  // Later audits tighten a visible safety band, release it, then try again. It fades on rather than appearing.
  if (round > 60 && !j.crashed) {
    const effort = Math.pow(Math.max(0, Math.sin((round - 60) * Math.PI / 14)), 2);
    ctx.globalAlpha = clamp((round - 60) / 0.5, 0, 1);
    ctx.strokeStyle = '#72512d'; ctx.lineWidth = 5;
    ctx.strokeRect(left - 5 - effort * 8, top + 52, w + 10 + effort * 16, 12);
    ctx.fillStyle = '#e6bc62'; ctx.fillRect(cx + w / 2 + 4, top + 46 - effort * 10, 18, 26);
    ctx.globalAlpha = 1;
  }
  drawLid(ctx, j);
  if (j.audit.hit.x > 0.03) drawAudit(ctx, j.audit.hit.x, j.crashed);
  if (j.stamp.x > 0.03 && j.crashed) drawStamp(ctx, j.stamp.x);
  // Strings back to the surface.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const s of j.strings) {
    ctx.globalAlpha = 1 - s.age / s.life;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo((s.x + cx) / 2, s.y + 20, cx, ySurf);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Where the auditor's stamp lands on the glass, for his arm to reach. */
export const AUDIT_AT = { x: JAR.cx + 22, y: JAR.top + 168 } as const;

/** AUDITED in green on the glass; after the crash the same mark reads LOL. */
function drawAudit(ctx: CanvasRenderingContext2D, hit: number, lol: boolean): void {
  ctx.save();
  ctx.translate(AUDIT_AT.x, AUDIT_AT.y);
  ctx.rotate(-0.12);
  const k = clamp(hit, 0, 1.4);
  ctx.scale(k, k);
  ctx.globalAlpha = clamp(hit * 1.5, 0, 0.92);
  ctx.strokeStyle = lol ? '#c0392b' : '#2f7a3a';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(-52, -14, 104, 28);
  tracked(ctx, lol ? 'LOL' : 'AUDITED ✓', 0, 5, 13, lol ? '#c0392b' : '#2f7a3a');
  if (lol) {
    ctx.beginPath();
    ctx.moveTo(-46, 8);
    ctx.lineTo(46, -8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLid(ctx: CanvasRenderingContext2D, j: JarState): void {
  const { cx, top, w } = JAR;
  const shut = clamp(j.shut.x, 0, 1);
  // Open: a disc tipped up behind the lip. Shut: it sits flat across the mouth.
  ctx.save();
  ctx.translate(cx, top + 8 + shut * 6);
  ctx.rotate(Math.sin(j.angle * 0.7) * 0.045 * (1 - shut));
  ctx.scale(1, 0.35 + shut * 0.65);
  ctx.fillStyle = j.crashed ? '#5c3218' : '#c9842a';
  ink(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(0, -18 * (1 - shut), w * 0.38, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f8e7b0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const groove = Math.sin(j.angle) * 38;
  ctx.moveTo(groove - 12, -18 * (1 - shut) - 3);
  ctx.lineTo(groove + 12, -18 * (1 - shut) + 3);
  ctx.stroke();
  ctx.restore();
}

/** CAN'T SELL across the glass between the seated lid and the label, clear of the auditor's mark lower down. */
function drawStamp(ctx: CanvasRenderingContext2D, pop: number): void {
  ctx.save();
  ctx.translate(JAR.cx, JAR.top + 52);
  ctx.rotate(-0.1);
  // Comes down past size and settles, like a stamp hit too hard.
  const k = clamp(pop, 0, 1.3);
  ctx.scale(k, k);
  ctx.globalAlpha = clamp(pop * 1.4, 0, 1);
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 6;
  ctx.strokeRect(-78, -22, 156, 44);
  tracked(ctx, "CAN'T SELL", 0, 0, 18, '#c0392b');
  ctx.restore();
}
