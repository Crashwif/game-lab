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
  lastCaption,
  memeText,
  resetKitchen,
  sayLeaving,
  settleAftermath,
  settleKitchen,
  stepKitchen,
  type Who,
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
import { clamp, mix, mulberry32, spring, stepSpring } from './motion';

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
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
/** The multipliers the ladder steps at: each is a milestone ding (the third onward an airhorn) and a step of her pronouns. */
const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100, 300, 1000];
/** The pronouns of the moment, which the HUD tracks as she takes it further. */
const PRONOUNS = ['she/her', 'she/they', 'they/them', 'they/them (for now)', 'ze/zir', 'xe/xem', 'fae/faer', 'any/all', 'none/none', '∅/∅', '[REDACTED]', 'tuesday/tuesdays', 'landlord/abolished', 'ratio/ratio', 'vibe/vibes', 'yes/and'];
/** What happens at the table, captioned the moment it happens (between the captions her lines put up). */
const BEATS = { pearls: 'MOM CLUTCHES THE PEARLS', cross: 'THE CROSS IS RATTLING', steam: 'STEAM FROM THE EARS', slam: 'DAD SLAMS THE TABLE', kettle: 'THE KETTLE JOINS IN', cracks: 'DAD’S HEAD IS CRACKING' } as const;
/** His cracks fade in from a rage of 0.88; the caption waits until they are plain to see. */
const CRACKS = 0.95;
/** How long a caption stays up before a waiting one takes over; only the latest waits, so none runs late. */
const BEAT_S = 1.1;
/** The burst's hit-stop, then slow motion at a third speed. */
const FREEZE_S = 0.16;
const SLOW_S = 0.5;
const SLOW_RATE = 0.3;
/** The camera cuts in 10% between the two heads at the burst and holds it 0.3 s past the hit-stop. */
const PUNCH_AT = { x: 482, y: 226 } as const;
const PUNCH = 0.1;
const PUNCH_HOLD_S = 0.3;

function captionFor(view: SceneView, outcome: Outcome | null, secured: Secured | null, beat: string): string {
  if (outcome === 'rekt') return 'HEADS EXPLODED';
  if (outcome === 'spectator') return 'NOBODY SAID GRACE';
  if (outcome === 'called') return 'SHE’S IN HER ROOM';
  if (view.phase === 'betting') return 'FAMILY MEETING';
  if (view.phase !== 'running') return 'GRACE FIRST';
  if (secured) {
    // Left the table with her plate: a good exit, and a little regret as the number keeps going without her.
    const r = view.currentX100 / secured.x100;
    return r < 1.25 ? 'LEFT THE TABLE' : r < 1.6 ? 'FULL PLATE, NO REGRETS' : r < 2.5 ? 'SHE’S POSTING ABOUT IT' : r < 5 ? 'IT’S A THREAD NOW' : 'IT’S ON THE NEWS';
  }
  return beat || 'FAMILY MEETING';
}

export function createScene(): Scene {
  const { capture, present } = createPortrait("FAMILY MEETING", [205, 150, 545, 360], '#f0d99c');

  // Dinner muzak with an organ under it that tightens with the multiplier; the crash is a boom.
  const audio = pageAudio({ style: 'elevator', crash: 'boom' });
  const kitchen: Kitchen = createKitchen();
  const parents: Parent[] = createParents();
  const daughter: Daughter = createDaughter();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const bpPop = spring(0);
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
  let punchHold = 0;
  /** The dip through dark between one dinner's aftermath and the next. */
  let wipe = 0;
  /** The heartbeat under the blood pressure while she talks. */
  let pulseClock = 0;
  /** The act props fade in and out instead of popping. */
  let actFade = 0;
  let beat = '';
  let beatAge = 0;
  let pending = '';
  const seen = new Set<string>();
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
    whistleClock = landClock = punchHold = pulseClock = 0;
    beat = pending = '';
    seen.clear();
  }

  function cue(text: string | undefined): void {
    if (!text || seen.has(text)) return;
    seen.add(text);
    pending = text;
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
      shake = 0.15;
      audio.crash('thud');
      audio.fx('hiss', 0.8);
      return;
    }
    shake = 1;
    {
      freeze = FREEZE_S;
      slow = SLOW_S;
      punch.x = 1;
      punch.v = 0;
      punchHold = FREEZE_S + PUNCH_HOLD_S;
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
    const act = actAt(view.elapsed);
    // 1 - 1/x: 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×, 0.9 at 10×, so the first 15 s, where most rounds end, carry the
    // build; the slow log driver keeps long rounds changing (0.33 at 10×, 0.67 at 100×, 1 at 1000×). The acts only
    // bring props: they never cool the table down.
    const tension = 1 - 1 / multiplier;
    const long = clamp(Math.log10(multiplier) / 3, 0, 1);
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
        settleParents(parents, tension, secured !== null, long);
        if (secured) badge.x = 1;
        // What already happened is not announced again: the caption is the last line's, and only beats still to come are cued.
        beat = lastCaption(kitchen);
        const [dad, mom] = parents as [Parent, Parent];
        if (mom.clutch.x > 0.6) seen.add(BEATS.pearls);
        if (tension > 0.3) seen.add(BEATS.cross);
        if (dad.rage.x > 0.7) seen.add(BEATS.steam).add(BEATS.slam);
        if (kitchen.kettle.whistle >= 0.25) seen.add(BEATS.kettle);
        if (dad.rage.x > CRACKS) seen.add(BEATS.cracks);
      }
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !kitchen.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') {
        // The next dinner fades up out of the last one's aftermath instead of cutting to it.
        if (kitchen.crashed) wipe = 1;
        reset();
      }
      previous = view.phase;
    }
    audio.update(view.phase, tension);

    stepKitchen(kitchen, { running, betting: view.phase === 'betting', multiplier, tension, time }, dt);
    // The flash fades on the real clock, so the hit-stop holds on the burst rather than on a white screen.
    kitchen.flash = Math.max(0, kitchen.flash - (real - dt) * 4);
    const kev = kitchen.events;
    const herLine = kev.line?.who === 'her';
    const said: Record<Who, number> = { her: Infinity, dad: Infinity, mom: Infinity };
    for (const b of kitchen.bubbles) if (b.age < b.life) said[b.who] = Math.min(said[b.who], b.age);
    const fev = stepParents(parents, { running, tension, time, herLine: herLine && !kitchen.crashed, left: secured !== null, said, long }, dt);
    const waiting = view.phase === 'betting' || view.phase === 'waiting';
    const dev = stepDaughter(daughter, { speaking: said.her < 1.6, tension, time, crashT: kitchen.crashT, rekt: kitchen.crashed && !kitchen.harmless, waiting }, dt);
    if (fev.slam) shake = Math.max(shake, 0.3);
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
    const live = running && !secured && !kitchen.crashed;
    if (live) {
      // Each beat is captioned when it happens, one at a time, long enough to read.
      cue(kev.line?.cap);
      if (kev.creak) cue(BEATS.cross);
      if (parents[1]!.clutch.x > 0.6) cue(BEATS.pearls);
      if (fev.steam) cue(BEATS.steam);
      if (fev.slam) cue(BEATS.slam);
      if (kev.whistle) cue(BEATS.kettle);
      if (parents[0]!.rage.x > CRACKS) cue(BEATS.cracks);
      beatAge += real;
      if (pending && (beatAge >= BEAT_S || !beat)) {
        beat = pending;
        pending = '';
        beatAge = 0;
      }
      // A heartbeat under the blood pressure, quickening with the tension: 1.4 s apart at 1×, 0.45 s by 10×.
      pulseClock += dt;
      if (pulseClock >= mix(1.4, 0.35, tension)) {
        pulseClock = 0;
        if (!fresh && !muted) audio.fx('heartbeat', 0.2 + 0.3 * tension);
        bpPop.v = 20;
      }
    } else pulseClock = 0;
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(bpPop, 0, 18, 0.5, real);
    if (punchHold > 0) punchHold -= real;
    else stepSpring(punch, 0, 7, 0.9, real);
    actFade += ((running && view.cashoutX100 === null ? 1 : 0) - actFade) * (1 - Math.exp(-10 * real));
    wipe = Math.max(0, wipe - real / 0.4);
    const nextCaption = captionFor(view, outcome, secured, beat);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);

    ctx.save();
    const simmer = running && !kitchen.crashed && !secured ? tension * tension * 1.5 : 0;
    if ((shake > 0 || simmer > 0)) ctx.translate(Math.sin(time * 90) * (8 * shake + simmer), Math.cos(time * 70) * 5 * shake);
    if (punch.x > 0.005) {
      const k = 1 + PUNCH * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    drawRoom(ctx, kitchen, time);
    for (const p of parents) drawChairBack(ctx, p.x);
    for (const p of parents) drawParent(ctx, p, time);
    drawTable(ctx, kitchen, time);
    if (actFade > 0.01) {
      // A new act's props come in over half a second while the last act's go out.
      const fade = clamp(act.age / 0.5, 0, 1);
      if (act.stage > 0 && fade < 1) drawAct(ctx, actAt(view.elapsed - act.age * 1000 - 1), actFade * (1 - fade));
      drawAct(ctx, act, actFade * fade);
    }
    drawDaughter(ctx, daughter, time, tension);
    drawDaughterChair(ctx);
    if (!isPortrait(ctx.canvas)) drawBubbles(ctx, kitchen);
    drawAir(ctx, kitchen);
    if (outcome && pop.x > 0.02 && (view.phase !== 'crashed' || view.crashAge >= 700)) {
      ctx.save();
      // Clear of the caption even at the pop's overshoot, and below the secured badge when there is one.
      ctx.translate(480, outcome === 'called' ? 166 : 132);
      ctx.rotate(-0.08);
      const scale = clamp(pop.x, 0, 1.25);
      ctx.scale(scale, scale);
      const word = outcome === 'rekt' ? 'MIND BLOWN' : outcome === 'called' ? 'WENT TO MY ROOM' : 'THOUGHTS & PRAYERS';
      memeText(ctx, word, 0, 0, outcome === 'rekt' ? 42 : 36, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center', 700);
      ctx.restore();
    }
    ctx.restore();
    drawFlash(ctx, kitchen);
    if (wipe > 0) {
      ctx.fillStyle = `rgba(28, 31, 38, ${wipe * wipe})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // The HUD: the caption, the secured badge, the multiplier, the blood pressure and the pronouns of the moment.
    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(430, 62);
      const scale = 1 + 0.08 * captionPop.x;
      ctx.scale(scale, scale);
      memeText(ctx, caption, 0, 0, 40, '#ffffff', 'center', 520);
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
    ctx.save();
    ctx.translate(24, 520);
    const thump = 1 + 0.06 * clamp(bpPop.x, 0, 1.5);
    ctx.scale(thump, thump);
    memeText(ctx, bp, 0, 0, 22, dad.exploded ? '#ff4d6d' : heat > 0.6 ? '#ffb4c2' : '#f7eadb', 'left');
    ctx.restore();
    memeText(ctx, `PRONOUNS ${PRONOUNS[Math.min(rung, PRONOUNS.length - 1)]!}`, 936, 520, 22, '#f7eadb', 'right', 320);
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, "AT THE TABLE", kitchen.bubbles.at(-1)?.text ?? 'Pass the potatoes.');

  }

  return { draw };
}
