import { actAt, drawAct } from './acts';
import { createPortrait, isPortrait } from './portrait';
/**
 * Composes Thanksgiving Uncle from the room state: the dining room, the family behind the table, Grandma at
 * the end, Rick in front of it, the conversation that follows the multiplier, grace on an accepted cash-out,
 * the seeded truck through the wall on the crash, and the HUD. Everything follows the SceneView and the
 * frame time; nothing here changes the committed outcome.
 */
import { pageAudio } from './audio';
import {
  createFamily,
  createGran,
  createRick,
  drawGran,
  drawRelative,
  drawRick,
  drawRickChair,
  GLASS_AT,
  type Gran,
  type Relative,
  resetFamily,
  resetGran,
  resetRick,
  type Rick,
  settleFamily,
  settleGran,
  stepFamily,
  stepGran,
  stepRick,
  wreckFamily,
} from './folks';
import {
  crashRoom,
  createRoom,
  drawAir,
  drawBubbles,
  drawChairBack,
  drawFlash,
  drawRoom,
  drawTable,
  drawTruckInRoom,
  memeText,
  resetRoom,
  type Room,
  sayGrace,
  settleRoom,
  shatterGlass,
  stepRoom,
} from './room';
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
  /** Drops the shake, the head jitter, the flashing lights, the hit-stop and the camera punch. */
  reducedMotion?: boolean;
}
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
/** The multipliers the caption ladder steps at: each is a milestone ding, the third onward an airhorn. */
const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22];
const CAPTIONS = ['THIS TURKEY’S GOT HORMONES', 'KEEP IT CIVIL', 'BIRDS AREN’T REAL', 'THE GRAVY IS 5G', 'DAD IS SMILING TOO HARD', 'THE EYE ROLL HAS NO END', 'ALEXA IS ORDERING THINGS', 'DALE IS REVVING', 'THE PILGRIMS WERE CRYPTO', 'JUST ASKING QUESTIONS', 'SCHOOL BOARD CANDIDATE', 'FULL TINFOIL'];
/** The wall's hit-stop, then slow motion at a third speed. */
const FREEZE_S = 0.08;
const SLOW_S = 0.5;
const SLOW_RATE = 0.3;
/** Where the camera punches in: the wall by the window. */
const PUNCH_AT = { x: 760, y: 260 } as const;

function captionFor(view: SceneView, rung: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome === 'rekt') return 'TRUCK IN THE DINING ROOM';
  if (outcome === 'called') return 'GRANDMA SAID GRACE';
  if (outcome === 'spectator') return 'WHO INVITED RICK';
  if (view.phase === 'betting') return 'THANKSGIVING';
  if (view.phase !== 'running') return 'FOOTBALL’S ON';
  if (secured) return 'HEADS BOWED';
  return CAPTIONS[rung]!;
}

export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait("THANKSGIVING UNCLE", [175, 155, 620, 355], '#f0d99c');
  const reduced = options.reducedMotion === true;
  // Dad's dinner playlist, warm and dusty, which tightens with the multiplier; the crash is a boom.
  const audio = pageAudio({ style: 'lofi', crash: 'boom' });
  const room: Room = createRoom();
  const family: Relative[] = createFamily();
  const gran: Gran = createGran();
  const rick: Rick = createRick();
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
  let landClock = 0;
  /** True from a crash met late until the next round: the aftermath is shown, not replayed, so no cues play for it. */
  let muted = false;

  function reset(): void {
    resetRoom(room);
    resetFamily(family);
    resetGran(gran);
    resetRick(rick);
    outcome = null;
    secured = null;
    shake = 0;
    freeze = slow = 0;
    muted = false;
    landClock = 0;
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    const harmless = secured !== null;
    outcome = view.stake === null ? 'spectator' : secured ? 'called' : 'rekt';
    crashRoom(room, view.currentX100, quiet, harmless);
    if (harmless) rick.mode = 'asleep';
    else {
      wreckFamily(family);
      rick.mode = 'turned';
      shatterGlass(room, GLASS_AT.x, GLASS_AT.y, mulberry32(view.currentX100 + 1));
    }
    if (quiet) {
      pop.x = 1;
      muted = true;
      audio.crash(harmless ? 'thud' : 'boom', true);
      return;
    }
    pop.v = 16;
    if (harmless) {
      shake = 0;
      audio.crash('thud');
      audio.fx('ding', 0.6);
      return;
    }
    shake = 1;
    punch.v = 9;
    if (!reduced) {
      freeze = FREEZE_S;
      slow = SLOW_S;
    }
    audio.crash('boom');
    audio.fx('engine', 1);
    audio.fx('shatter', 0.9);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // The hit-stop holds the frame the wall goes, then the debris flies slow before time catches up.
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
      // Seen land while the round runs: Grandma wakes up and says grace, and everyone shuts up.
      if (running && !fresh && !room.crashed) {
        sayGrace(room);
        rick.mode = 'bowed';
        audio.cashout();
        audio.fx('bell', 0.8);
      } else {
        room.holding = true;
        rick.mode = 'bowed';
      }
    }

    if (fresh) {
      // A fresh scene can open on a round already under way (a page load mid-round, or a round first seen
      // after its betting window), so it settles into the round as it stands instead of playing out what it
      // missed: grace already said has heads down, and a crash is the quiet aftermath.
      previous = view.phase;
      if (running || crashed) {
        settleRoom(room, multiplier, tension, secured !== null);
        settleFamily(family, tension, secured !== null);
        settleGran(gran, secured !== null);
        if (secured) badge.x = 1;
      }
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !room.crashed) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting') reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);

    stepRoom(room, { running, multiplier, tension, time, reduced }, dt);
    const rev = room.events;
    const rickLine = rev.line?.who === 'rick';
    const wrecked = room.crashed && !room.harmless;
    const fev = stepFamily(family, { running, tension, time, reduced, rickLine: rickLine && !room.crashed, grace: secured !== null, wrecked }, dt);
    stepGran(gran, secured !== null, dt);
    const speaking = room.bubbles.some((b) => b.who === 'rick' && b.age < 1.6);
    stepRick(rick, { speaking, tension, time }, dt);
    if (!fresh && !muted) {
      // Every event is a cue: a bubble, the speaker, the sign, the dog, the glass, the wall, the debris, the bird.
      if (rev.line) audio.fx('pop', rev.line.who === 'rick' ? 0.8 : rev.line.who === 'dale' ? 0.3 : 0.5);
      if (rev.listen) audio.fx('beep', 0.5);
      if (rev.order) audio.fx('notify', 0.9);
      if (rev.flip) audio.fx('click', 1);
      if (rev.rev) audio.fx('engine', 0.35 + 0.5 * room.truck.agitation);
      if (rev.bark) audio.fx('squeak', 0.6);
      if (fev.crack) audio.fx('tick', 1);
      if (fev.gasp) audio.fx('gasp', 0.7);
      if (rev.turkey) audio.fx('splash', 0.9);
      landClock = Math.max(0, landClock - dt);
      if (rev.landed > 0 && landClock === 0) {
        landClock = 0.09;
        audio.fx('thud', 0.4);
      }
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
    const rumble = running && !reduced && !room.crashed && !secured ? room.truck.agitation * room.truck.agitation * 1.5 : 0;
    if (!reduced && (shake > 0 || rumble > 0)) ctx.translate(Math.sin(time * 90) * (8 * shake + rumble), Math.cos(time * 70) * 5 * shake);
    if (!reduced && punch.x > 0.005) {
      const k = 1 + 0.07 * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    drawRoom(ctx, room, time, reduced);
    for (const r of family) drawChairBack(ctx, r.x);
    for (const r of family) drawRelative(ctx, r, time, reduced);
    drawGran(ctx, gran, time);
    drawTable(ctx, room, time);
    if (view.phase === 'running' && view.cashoutX100 === null) drawAct(ctx, act);
    drawTruckInRoom(ctx, room, time, reduced);
    drawRick(ctx, rick, time, reduced);
    drawRickChair(ctx);
    if (!isPortrait(ctx.canvas)) drawBubbles(ctx, room);
    drawAir(ctx, room);
    if (outcome && pop.x > 0.02 && (view.phase !== 'crashed' || view.crashAge >= 1300)) {
      ctx.save();
      ctx.translate(480, 116);
      ctx.rotate(-0.08);
      const scale = clamp(pop.x, 0, 1.25);
      ctx.scale(scale, scale);
      const word = outcome === 'rekt' ? 'DALE, NO' : outcome === 'called' ? 'GRACE SAVED US' : 'NOT MY FAMILY';
      memeText(ctx, word, 0, 0, outcome === 'rekt' ? 42 : 36, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center', 700);
      ctx.restore();
    }
    ctx.restore();
    drawFlash(ctx, room);

    // The HUD: the caption, the secured badge, the multiplier, Dad's civility and the speaker's cart.
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
    const dad = family[0]!;
    const civility = wrecked ? 0 : Math.round((1 - clamp(dad.heat.x, 0, 1)) * 100);
    memeText(ctx, `CIVILITY ${civility}%`, 24, 520, 22, civility < 40 ? '#ffb4c2' : '#f4ead8', 'left');
    memeText(ctx, `SPEAKER CART $${room.cart.toLocaleString('en-US')}`, 936, 520, 22, room.cart > 500 ? '#ffb4c2' : '#f4ead8', 'right', 320);
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, `SPEAKER CART $${room.cart.toLocaleString('en-US')}`, room.bubbles.at(-1)?.text ?? 'Could someone pass the gravy?', view.phase === 'crashed' ? [260, 155, 690, 355] : undefined);

  }

  return { draw };
}
