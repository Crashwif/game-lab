import { actAt, drawAct } from './acts';
import { createPortrait, isPortrait } from './portrait';
/**
 * Composes Family Meeting from the room state: the kitchen, the parents behind the table, the daughter in
 * front of it, the conversation that follows the multiplier, her exit on an accepted cash-out, the seeded
 * burst of the crash and the HUD. Everything follows the SceneView and the frame time; nothing here
 * changes the committed outcome.
 */
import { pageAudio } from './audio';
import {
  crashKitchen,
  createKitchen,
  drawAir,
  drawBubbles,
  drawChairBack,
  drawFlash,
  drawRoom,
  drawTable,
  type Kitchen,
  memeText,
  resetKitchen,
  sayLeaving,
  settleAftermath,
  settleKitchen,
  stepKitchen,
} from './kitchen';
import {
  createDaughter,
  createParents,
  type Daughter,
  deflateParents,
  drawDaughter,
  drawDaughterChair,
  drawParent,
  explodeParents,
  leaveTable,
  neckAt,
  type Parent,
  resetDaughter,
  resetParents,
  settleDaughterAfter,
  settleParents,
  stepDaughter,
  stepParents,
} from './family';
import { clamp, mulberry32, spring, stepSpring } from './motion';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** The displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a crash missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}
export interface SceneOptions {
  /** Drops the shake, the head jitter, the hit-stop and the camera punch. */
  reducedMotion?: boolean;
}
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
/** The multipliers the caption ladder steps at: each is a milestone ding, the third onward an airhorn. */
const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22];
const CAPTIONS = ['SO, UM, ABOUT MY GENDER', 'IT’S A SPECTRUM', 'IT’S A CONSTRUCT', 'IT’S A JOURNEY', 'MOM CLUTCHES THE PEARLS', 'DAD IS VIBRATING', 'THE CROSS IS RATTLING', 'THE KETTLE JOINS IN', 'BEYOND THE BINARY', 'POST-GENDER', 'NO SELF, ONLY VIBES', 'THEOLOGICAL CODE RED'];
const PRONOUNS = ['she/her', 'she/they', 'they/them', 'they/them (for now)', 'ze/zir', 'xe/xem', 'fae/faer', 'any/all', 'none/none', '∅/∅', '[REDACTED]', 'tuesday/tuesdays'];
/** The burst's hit-stop, then slow motion at a third speed. */
const FREEZE_S = 0.08;
const SLOW_S = 0.5;
const SLOW_RATE = 0.3;
/** Where the camera punches in: between the two heads. */
const PUNCH_AT = { x: 482, y: 226 } as const;

function captionFor(view: SceneView, rung: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'rekt') return 'HEADS EXPLODED';
  if (outcome === 'called') return 'SHE’S IN HER ROOM';
  if (outcome === 'spectator') return 'NOBODY SAID GRACE';
  if (view.phase === 'betting') return 'FAMILY MEETING';
  if (view.phase !== 'running') return 'GRACE FIRST';
  if (secured) return 'LEFT THE TABLE';
  return CAPTIONS[rung]!;
}

export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait("FAMILY MEETING", [205, 150, 545, 360], '#f0d99c');
  const reduced = options.reducedMotion === true;
  // Dinner muzak with an organ under it that tightens with the multiplier; the crash is a boom.
  const audio = pageAudio({ style: 'elevator', crash: 'boom' });
  const kitchen: Kitchen = createKitchen();
  const parents: Parent[] = createParents();
  const daughter: Daughter = createDaughter();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
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
  let whistleClock = 0;
  let landClock = 0;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues play for it. */
  let muted = false;

  function reset(): void {
    resetKitchen(kitchen);
    resetParents(parents);
    resetDaughter(daughter);
    outcome = null;
    secured = null;
    shake = 0;
    freeze = slow = 0;
    muted = false;
    whistleClock = landClock = 0;
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    const harmless = secured !== null;
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    crashKitchen(kitchen, view.currentX100, quiet, harmless, parents.map(neckAt));
    if (harmless) deflateParents(parents);
    else explodeParents(parents, kitchen, mulberry32(view.currentX100));
    if (quiet) {
      if (!harmless) {
        settleAftermath(kitchen);
        settleDaughterAfter(daughter);
      }
      pop.x = 1;
      muted = true;
      audio.crash(harmless ? 'thud' : 'boom', true);
      return;
    }
    pop.v = 16;
    if (harmless) {
      shake = reduced ? 0 : 0.15;
      audio.crash('thud');
      audio.fx('hiss', 0.8);
      return;
    }
    shake = 1;
    punch.v = 9;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    audio.crash('boom');
    audio.fx('splash', 0.5);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the burst's first frame, then the pieces fly slow before time catches up.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const act = actAt(view.elapsed, reduced);
    const tension = clamp(Math.log2(multiplier) / 3.6, 0, 1) * (view.phase === 'running' && view.cashoutX100 === null ? act.effort : 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      // Seen land while the round runs: she says her piece, stands up and takes her plate to her room.
      if (running && !fresh && !kitchen.crashed) {
        sayLeaving(kitchen);
        leaveTable(daughter, false);
        audio.cashout();
        audio.fx('creak', 0.5);
      } else leaveTable(daughter, true);
    }

    if (fresh) {
      // A fresh scene can open on a round already under way (a page load mid-round, or a round first seen
      // after its betting window), so it settles into the round as it stands instead of playing out what it
      // missed: a cash-out has already sent her upstairs, and a crash is the quiet aftermath.
      previous = view.phase;
      if (running || crashed) {
        settleKitchen(kitchen, multiplier, tension, secured !== null);
        settleParents(parents, tension, secured !== null);
        if (secured) badge.x = 1;
      }
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !kitchen.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);

    stepKitchen(kitchen, { running, multiplier, tension, time, reduced }, dt);
    const kev = kitchen.events;
    const herLine = kev.line?.who === 'her';
    const fev = stepParents(parents, { running, tension, time, reduced, herLine: herLine && !kitchen.crashed, left: secured !== null }, dt);
    const speaking = kitchen.bubbles.some((b) => b.who === 'her' && b.age < 1.6);
    const dev = stepDaughter(daughter, { speaking, tension, time, crashT: kitchen.crashT, rekt: kitchen.crashed && !kitchen.harmless }, dt);
    if (fev.slam && !reduced) shake = Math.max(shake, 0.3);
    if (dev.camera) kitchen.flash = Math.max(kitchen.flash, 0.5);
    if (!fresh && !muted) {
      // Every event is a cue: a bubble, the fist, a gasp, the ears, the cross, the kettle, the pieces, the door, the picture.
      if (kev.line) audio.fx('pop', kev.line.who === 'her' ? 0.8 : 0.5);
      if (fev.slam) audio.fx('thud', 1);
      if (fev.gasp) audio.fx('gasp', 0.8);
      if (fev.steam) audio.fx('hiss', 0.5);
      if (kev.creak) audio.fx('creak', 0.5 + 0.4 * tension);
      if (kev.whistle) audio.fx('whistle', 0.8);
      if (kitchen.kettle.whistle > 0.3) {
        whistleClock += dt;
        if (whistleClock > 1.3) {
          whistleClock = 0;
          audio.fx('whistle', 0.3 + 0.5 * kitchen.kettle.whistle);
        }
      }
      if (kev.crossLand) audio.fx('clang', 0.9);
      if (kev.splat) audio.fx('splash', 0.6);
      landClock = Math.max(0, landClock - dt);
      if (kev.landed > 0 && landClock === 0) {
        landClock = 0.09;
        audio.fx('thud', 0.35);
      }
      if (dev.door) audio.fx('door', 1);
      if (dev.camera) audio.fx('camera', 1);
      if (running) audio.milestone(rung);
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 8, 0.5, dt);
    const nextCaption = captionFor(view, rung, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    ctx.save();
    const simmer = running && !reduced && !kitchen.crashed && !secured ? tension * tension * 1.5 : 0;
    if (!reduced && (shake > 0 || simmer > 0)) ctx.translate(Math.sin(time * 90) * (8 * shake + simmer), Math.cos(time * 70) * 5 * shake);
    if (!reduced && punch.x > 0.005) {
      const k = 1 + 0.07 * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    drawRoom(ctx, kitchen, time);
    for (const p of parents) drawChairBack(ctx, p.x);
    for (const p of parents) drawParent(ctx, p, time, reduced);
    drawTable(ctx, kitchen, time);
    if (view.phase === 'running' && view.cashoutX100 === null) drawAct(ctx, act);
    drawDaughter(ctx, daughter, time, tension, reduced);
    drawDaughterChair(ctx);
    if (!isPortrait(ctx.canvas)) drawBubbles(ctx, kitchen);
    drawAir(ctx, kitchen);
    if (outcome && pop.x > 0.02 && (view.phase !== 'crashed' || view.crashAge >= 1300)) {
      ctx.save();
      ctx.translate(480, 116);
      ctx.rotate(-0.08);
      const scale = clamp(pop.x, 0, 1.25);
      ctx.scale(scale, scale);
      const word = outcome === 'rekt' ? 'MIND BLOWN' : outcome === 'called' ? 'WENT TO MY ROOM' : 'THOUGHTS & PRAYERS';
      memeText(ctx, word, 0, 0, outcome === 'rekt' ? 42 : 36, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center', 700);
      ctx.restore();
    }
    ctx.restore();
    drawFlash(ctx, kitchen);

    // The HUD: the caption, the secured badge, the multiplier, the blood pressure and the pronouns of the moment.
    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(430, 62);
      const scale = 1 + 0.08 * captionPop.x;
      ctx.scale(scale, scale);
      memeText(ctx, caption, 0, 0, 40, '#ffffff', 'center', 600);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(430, 104);
      ctx.scale(clamp(badge.x, 0, 1.2), clamp(badge.x, 0, 1.2));
      memeText(ctx, text, 0, 0, 24, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome === 'rekt' || outcome === 'spectator' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 72, 56, colour, 'right', 220);
    const dad = parents[0]!;
    const heat = clamp(dad.rage.x, 0, 1);
    const bp = dad.exploded ? 'BP —/—' : `BP ${Math.round(120 + 150 * heat)}/${Math.round(80 + 90 * heat)}`;
    memeText(ctx, bp, 24, 520, 22, dad.exploded ? '#ff4d6d' : heat > 0.6 ? '#ffb4c2' : '#f7eadb', 'left');
    memeText(ctx, `PRONOUNS ${PRONOUNS[Math.min(rung, PRONOUNS.length - 1)]}`, 936, 520, 22, '#f7eadb', 'right', 320);
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, "AT THE TABLE", kitchen.bubbles.at(-1)?.text ?? 'Pass the potatoes.');

  }

  return { draw };
}
