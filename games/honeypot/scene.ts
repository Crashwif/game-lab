/**
 * Composes Honeypot: picnic, jar, swarm and the HUD. The honey, the tax
 * and the lid follow the displayed multiplier. Nothing here selects it.
 */
import { pageAudio } from './audio';
import { clamp, settleSpring, spring, stepSpring } from './motion';
import {
  createJar,
  drawJar,
  knockJar,
  resetJar,
  sellTax,
  settleJar,
  shutJar,
  stampAudit,
  stepJar,
  type JarState,
} from './jar';
import { auditDone, createPicnic, drawFox, drawPicnic, drawBearReach, pawPoint, pullPaw, resetPicnic, settlePicnic, stepPicnic, trapPicnic, type Picnic } from './picnic';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions { reducedMotion?: boolean; }
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void; }

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
/** The caption ladder's steps: a milestone ding each, an airhorn from the third. */
const RUNGS = [1.4, 2, 3, 5, 8, 14];
/** The lid coming down: a short freeze on the crash frame, the screw-down at a third speed, then time catches up. */
const FREEZE_S = 0.06;
const SLOW_S = 0.35;
const SLOW_RATE = 0.3;
/** Where the camera punches in: the lid. */
const PUNCH_AT = { x: 548, y: 160 } as const;

/** The round's tension, 0..1: log2 of the multiplier over 3.2, so it climbs in step with the round's time (full at about 9.2×). */
const tensionAt = (multiplier: number): number => clamp(Math.log2(multiplier) / 3.2, 0, 1);

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.save();
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  // Impact's sidebearings are narrower than the stroke, so untracked letters fuse.
  ctx.letterSpacing = `${Math.round(size * 0.16)}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const ink = fill === '#1c1f26';
  ctx.lineWidth = Math.max(2, size * (ink ? 0.07 : 0.1));
  ctx.strokeStyle = ink ? '#f6f1df' : '#1c1f26';
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
  ctx.restore();
}

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'rekt') return "CAN'T SELL";
  if (outcome === 'called') return 'PAW FREE';
  if (outcome === 'spectator') return 'HONEYPOT';
  if (view.phase !== 'running') return 'GM BEAR';
  if (secured) return 'PULL THE PAW';
  if (multiplier < 1.4) return 'SWEET GAINS';
  if (multiplier < 2) return 'BUY TAX 0%, LFG';
  if (multiplier < 3) return 'LIQUIDITY IS LOCKED';
  if (multiplier < 5) return 'DIAMOND PAWS';
  if (multiplier < 8) return 'WHY IS THE LID MOVING';
  if (multiplier < 14) return 'SELL TAX RISING';
  return 'SELL TAX OVER 100%?';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  // Sunny eurodance for the picnic, and the crash is a sad trombone under the lid coming down.
  const audio = pageAudio({ style: 'eurodance', crash: 'trombone' });
  const jar: JarState = createJar();
  const picnic: Picnic = createPicnic();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The camera's punch into the lid. */
  const punch = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  let freeze = 0;
  let slow = 0;
  let bees = 0;
  /** Seconds until the dev laughs on his way out; -1 with none due. */
  let laughIn = -1;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues play for it. */
  let muted = false;

  function escaped(): boolean {
    return secured !== null || picnic.bear.mode === 'walking' || picnic.bear.mode === 'gone' || picnic.bear.mode === 'pulling';
  }

  /** Jumps the jar, the picnic and the badge to where the view's round has them, for a round met late rather than watched. */
  function settle(view: SceneView, multiplier: number): void {
    const tension = tensionAt(multiplier);
    settleJar(jar, multiplier, tension);
    settlePicnic(picnic, multiplier, tension, view.elapsed / 1000, secured !== null);
    if (auditDone(picnic)) stampAudit(jar, true);
    settleSpring(badge, secured ? 1 : 0);
    bees = Math.round(8 + tension * 20);
  }

  /** `quiet` lands straight on the crash's end pose, for a crash that happened out of sight. */
  function beginCrash(view: SceneView, multiplier: number, quiet: boolean): void {
    const out = escaped();
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    if (quiet) settle(view, multiplier);
    shutJar(jar, quiet);
    trapPicnic(picnic, quiet, out);
    if (!out && quiet) picnic.bear.mode = 'trapped';
    if (quiet) {
      pop.x = 1;
      muted = true;
      audio.crash('trombone', true);
      return;
    }
    shake = 1;
    pop.v = 14;
    punch.v = 8;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    laughIn = 1.1;
    audio.crash('trombone');
    audio.fx('buzz', 1.2);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the crash frame, then the lid screws down slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += reduced ? dt * 0.2 : dt;
    if (view.phase === 'running') time = view.elapsed / 1000;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = tensionAt(multiplier);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running && !fresh && !jar.crashed) audio.cashout();
    }

    if (fresh) {
      // The first frame can land anywhere in a round (a page that joins mid-round or on the crash, or a scene made
      // fresh for a round whose betting it missed), so it settles into the round rather than playing it out.
      previous = view.phase;
      time = view.elapsed / 1000;
      if (crashed) beginCrash(view, multiplier, true);
      else settle(view, multiplier);
    } else if (view.phase !== previous) {
      if (crashed && !jar.crashed) beginCrash(view, multiplier, view.crashAge > 1500);
      if (view.phase === 'betting') {
        resetJar(jar);
        resetPicnic(picnic);
        outcome = null;
        secured = null;
        shake = 0;
        freeze = slow = 0;
        bees = 8;
        laughIn = -1;
        muted = false;
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    if (secured && running && !jar.crashed) pullPaw(picnic);

    const paw = pawPoint(picnic, jar.level.x);
    stepPicnic(picnic, { running, multiplier, tension, level: jar.level.x, reduced }, dt);
    stepJar(jar, { running, multiplier, tension, pulling: picnic.bear.mode === 'pulling', pawX: paw.x, pawY: paw.y, reduced }, dt);
    const pe = picnic.events;
    const je = jar.events;
    if (pe.stamp) {
      stampAudit(jar);
      knockJar(jar, 0.6);
      if (!reduced) shake = Math.max(shake, 0.14);
    }
    if (pe.pawFree) knockJar(jar, 1);
    if (je.seated && !reduced) shake = Math.max(shake, 0.5);
    if (jar.taxFlash > 0.9 && !reduced) shake = Math.max(shake, 0.16);
    const swarm = Math.round(8 + tension * 20);
    if (!fresh && !muted) {
      // The picnic's own events as cues: the honey rising, the tax stepping, the swarm growing, the guests leaning in,
      // the auditor's stamp, the dev's texts, the paw tearing free, the lid seating, and the dev's laugh on the way out.
      if (je.glug) audio.fx('glug', 0.5 + 0.6 * jar.level.x);
      if (je.tax) audio.fx('ratchet', 0.75);
      if (running && swarm > bees) audio.fx('buzz', 0.3 + 0.7 * tension);
      if (pe.guest) audio.fx('pop', 0.6);
      if (pe.stamp) audio.fx('stomp', 0.9);
      if (pe.msg) audio.fx('phone', 0.8);
      if (pe.pawFree) audio.fx('pop', 1.2);
      if (je.seated) audio.fx('clang', 1);
      if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    }
    bees = swarm;
    if (laughIn >= 0) {
      laughIn -= real;
      if (laughIn < 0) audio.fx('laugh', 0.7);
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 9, 0.5, dt);
    const next = captionFor(view, multiplier, outcome, secured);
    if (next !== caption) {
      caption = next;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.4);

    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 70) * 8 * shake, 0);
    if (!reduced && punch.x > 0.005) {
      // The camera punches in on the lid and eases back out.
      const k = 1 + 0.06 * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    drawPicnic(ctx, picnic, jar.level.x, time, tension);
    drawJar(ctx, jar, time, () => drawBearReach(ctx, picnic, jar.level.x, time));
    drawFox(ctx, picnic);
    if (jar.glue.x > 0.02) {
      ctx.fillStyle = `rgba(80, 60, 30, ${jar.glue.x * 0.22})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    if (outcome && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, 198);
      ctx.rotate(-0.08);
      const scale = clamp(pop.x, 0, 1.2);
      ctx.scale(scale, scale);
      const word = outcome === 'called' ? 'PAW FREE' : outcome === 'rekt' ? "CAN'T SELL" : 'HONEYPOT';
      memeText(ctx, word, 0, 0, 72, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center', 640);
      ctx.restore();
    }
    ctx.restore();

    if (caption) {
      ctx.save();
      ctx.translate(340, 58);
      ctx.scale(1 + 0.08 * captionPop.x, 1 + 0.08 * captionPop.x);
      memeText(ctx, caption, 0, 0, 40, '#1c1f26', 'center', 620);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(400, 98);
      ctx.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(ctx, text, 0, 0, 24, '#2f7a3a', 'center');
      ctx.restore();
    }
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 64, 56, outcome === 'rekt' ? '#ff4d6d' : '#1c1f26', 'right', 240);
    memeText(ctx, `SELL TAX ${sellTax(multiplier)}%`, 24, 520, 26, sellTax(multiplier) >= 49 ? '#c0392b' : '#1c1f26', 'left');
    memeText(ctx, `HONEY ${Math.round(jar.level.x * 100)}%`, 936, 520, 22, '#1c1f26', 'right');
  }

  return { draw };
}
