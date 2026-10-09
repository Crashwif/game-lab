/** Composes the scene: the city, the roof, the rigs, the dialogue, the clocks, the camera, the HUD and the portrait. */
import { actAt, drawAct, drawActBehind } from './acts';
import { type Effect, pageAudio } from './audio';
import { cameraFor, type City, crashCity, createCity, drawFacades, drawInsert, drawSearchlight, drawSky, drawSkyline, drawStreet, floorAt, resetCity, settleCity, stepCity } from './city';
import { ALIGNMENTS, CAPTIONS, FIRST_ANSWER_X100, OVERTIME, RUNGS, THROW_LINES, type Talk, type Who, beginAftermath, beginEscapeLines, clearBubbles, createDialogue, drawBubbles, floorText, ledgeText, memeText, resetDialogue, say, settleAftermathLines, settleDialogue, stepDialogue } from './lines';
import { clamp, noise, settleSpring, spring, stepSpring } from './motion';
import { createPortrait, isPortrait } from './portrait';
import { type Roof, crashRoof, createRoof, drawAir, drawBeam, drawFlash, drawRoofBack, drawRoofFront, escapeRoof, resetRoof, settleAftermath, settleRoof, spawnLoose, stepRoof } from './roof';
import { type Crew, anchors, beamFor, beginHeave, beginThrow, createCrew, drawMilitia, drawSuspect, drawThrown, escapeCrew, reachesSuspect, resetCrew, settleCrashed, settleCrew, stepCrew } from './rigs';
export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Hundredths; the crash point once crashed. */
  currentX100: number;
  /** ms since the round started; held at the crash. */
  elapsed: number;
  /** ms since the crash (large when it was missed). */
  crashAge: number;
  /** null when watching. */
  stake: number | null;
  /** Hundredths, once the backend confirms the cash-out. */
  cashoutX100: number | null;
  payout: number | null;
}
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose?(): void;
}
type Outcome = 'rekt' | 'called' | 'spectator';
type Secured = { x100: number; payout: number | null };
type Cue = { at: number; fx: Effect; strength: number };
/** tension = clamp(log2(x) / 4.907, 0, 1): 1 at 30x. A presentation parameter only. */
const TENSION_DIV = 4.907;
/** The throw's hit-stop, then slow motion at 0.3× for 0.6 s of wall time. */
const FREEZE_S = 0.1;
const SLOW_S = 0.6;
const SLOW_RATE = 0.3;
/** Where the camera punches in: the coping. */
const PUNCH_AT = { x: 720, y: 372 } as const;
const RED = '#ff4d6d';
const GREEN = '#7cf67c';
const GOLD = '#ffe27a';
const PALE = '#f7eadb';
const PINK = '#ffb4c2';
/** Fall-relative and insert-relative cue tables. */
const FALL_CUES: [number, Effect, number][] = [[0.3, 'whoosh', 0.4], [0.6, 'whistle', 0.4], [0.8, 'whoosh', 0.6], [1.3, 'whoosh', 0.8]];
const INSERT_CUES: [number, Effect, number][] = [[0.05, 'whoosh', 1], [0.15, 'squeak', 0.3], [0.45, 'pop', 0.15]];

export function createScene(): Scene {
  const { capture, present } = createPortrait('ALIGNMENT CHECK', [330, 170, 430, 300], '#8fe388');

  const audio = pageAudio({ style: 'phonk', crash: 'scratch', music: 0.55 });
  const city: City = createCity();
  const roof: Roof = createRoof();
  const crew: Crew = createCrew();
  const talk: Talk = createDialogue();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const cues: Cue[] = [];
  const lastFx: Partial<Record<Effect, number>> = {};
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  /** A crash or cash-out met late: settled, no cues until the next round. */
  let muted = false;
  let canCue = false;
  let instant = false;
  let shake = 0;
  let flash = 0;
  let freeze = 0;
  let slow = 0;
  let caption = '';
  let align = '';
  let alignFlash = 0;
  /** Scene-second clocks: −1 while inactive. */
  let escapeT = -1;
  let crashT = -1;
  let harmlessT = -1;
  let stamp = false;
  let fallCue = 0;
  let insertCue = 0;
  let sirenClock = 0;
  let sirenAfter = false;
  let heartClock = 0;
  let actStage = 0;
  let actCue = false;
  function fx(effect: Effect, strength: number): void {
    if (!canCue) return;
    const was = lastFx[effect];
    if (was !== undefined && time - was < 0.04 && time > 0) return;
    lastFx[effect] = time;
    audio.fx(effect, strength);
  }
  /** A cue `delay` scene seconds from now (queue <= 24). */
  function cue(delay: number, effect: Effect, strength: number): void {
    if (!canCue || cues.length >= 24) return;
    cues.push({ at: time + delay, fx: effect, strength });
  }
  function speak(who: Who, text: string, life?: number): void {
    say(talk, who, text, life);
    fx('pop', who === 'suspect' ? 0.8 : 0.5);
  }
  function reset(): void {
    resetCity(city);
    resetRoof(roof);
    resetCrew(crew);
    resetDialogue(talk);
    outcome = null;
    secured = null;
    muted = instant = false;
    shake = flash = freeze = slow = 0;
    escapeT = crashT = harmlessT = -1;
    stamp = false;
    fallCue = insertCue = 0;
    sirenClock = heartClock = 0;
    sirenAfter = false;
    actStage = 0;
    actCue = false;
    alignFlash = 0;
    cues.length = 0;
    settleSpring(pop, 0);
    settleSpring(badge, 0);
    settleSpring(punch, 0);
  }
  /** The cash-out seen live: the airdrop and the run for the stairwell. */
  function beginEscape(x100: number): void {
    escapeT = 0;
    audio.cashout();
    badge.v = 14;
    beginEscapeLines(talk);
    escapeCrew(crew, x100, false);
    escapeRoof(roof, x100, anchors(crew).suspectHand, false);
    for (const t of [0, 0.08, 0.16]) cue(t, 'coin', 0.8);
    for (const t of [0.35, 0.55, 0.75, 0.95]) cue(t, 'stomp', 0.4);
    cue(3, 'click', 0.4);
  }
  /** A cash-out first seen late: door shut, suspect gone, no cues. */
  function settleEscape(): void {
    escapeT = 10;
    talk.holding = true;
    badge.x = 1;
  }
  /** The crash: the seeded throw (mulberry32(crashX100)), or the harmless heave once secured; `quiet` (met late) settles the aftermath with no cues. */
  function beginCrash(view: SceneView, quiet: boolean): void {
    const seed = view.currentX100;
    const harmless = secured !== null;
    outcome = view.stake === null ? 'spectator' : harmless ? 'called' : 'rekt';
    instant = !harmless && view.currentX100 < FIRST_ANSWER_X100;
    crashT = 0;
    crashCity(city, seed);
    crashRoof(roof, seed, harmless);
    if (harmless) {
      if (quiet) {
        harmlessT = 10;
        settleAftermath(roof, { harmless: true, crashT: 10 });
        settleCrashed(crew, seed, true, 10);
        settleAftermathLines(talk, 'called', 10);
        pop.x = 1;
        stamp = true;
        muted = true;
        cues.length = 0;
        audio.crash('scratch', true);
        return;
      }
      shake = 0.15;
      audio.crash();
      return;
    }
    clearBubbles(talk);
    const age = view.crashAge / 1000;
    if (quiet) {
      crashT = 99;
      settleCrashed(crew, seed, false, age);
      settleAftermath(roof, { harmless: false, crashT: age });
      settleAftermathLines(talk, outcome === 'spectator' ? 'spectator' : instant ? 'instant' : 'rekt', age);
      pop.x = 1;
      stamp = true;
      muted = true;
      cues.length = 0;
      audio.crash('scratch', true);
      return;
    }
    beginThrow(crew, seed, instant);
    beginAftermath(talk, outcome === 'spectator' ? 'spectator' : instant ? 'instant' : 'rekt');
    if (instant) say(talk, 'lead', THROW_LINES.instantOpener, crew.thrown!.times.hitstop);
    else speak('suspect', THROW_LINES.wait, 0.3);
  }
  function captionFor(view: SceneView, rung: number): string {
    const T = crew.thrown?.times;
    if (outcome === 'called') return 'TOOK THE STAIRS';
    if (outcome && T && crashT >= T.back) return outcome === 'spectator' ? 'NOT MY ROOFTOP' : instant ? 'NO QUESTIONS ASKED' : 'ALIGNMENT RESOLVED';
    if (outcome && T && crashT >= T.hitstop) return 'YUP. THAT’S ME.';
    if (view.phase === 'betting') return 'Q4P CHECK';
    if (view.phase === 'waiting') return 'ROOF ACCESS ONLY';
    if (secured) return 'HE DIPPED';
    if (talk.overtimeK >= 0) return OVERTIME[talk.overtimeK % OVERTIME.length]!.caption;
    return CAPTIONS[clamp(rung, 0, CAPTIONS.length - 1)]!;
  }
  function alignmentFor(view: SceneView, rung: number): { text: string; colour: string } {
    const T = crew.thrown?.times;
    if (secured) return { text: 'GONE', colour: GREEN };
    if (T && crashT >= T.back) return { text: 'GRAVITY', colour: RED };
    if (T && crashT >= T.hitstop) return { text: 'ROTATING', colour: PALE };
    if (view.phase === 'waiting' || view.phase === 'betting') return { text: 'PENDING', colour: PALE };
    const label = talk.overtimeK >= 0 ? OVERTIME[talk.overtimeK % OVERTIME.length]!.alignment : ALIGNMENTS[clamp(rung, 0, ALIGNMENTS.length - 1)]!;
    return { text: label, colour: alignFlash > 0 || rung >= 6 ? PINK : PALE };
  }
  function ledgeFor(view: SceneView, cam: { x: number; y: number }, running: boolean): { text: string; colour: string } {
    const T = crew.thrown?.times;
    if (secured) return { text: 'LEDGE n/a · STAIRS', colour: GREEN };
    if (T && crashT >= T.back) return { text: 'LEDGE —', colour: RED };
    if (T && crashT >= T.fall) return { text: floorText(Math.max(15, floorAt(cam.y))), colour: PINK };
    if (T && crashT >= T.hitstop) return { text: 'LEDGE —', colour: '#ffffff' };
    if (view.phase === 'waiting' || view.phase === 'betting') return { text: 'LEDGE 4.0 m', colour: '#ffffff' };
    const wobble = running && talk.overtimeK >= 0 ? (noise(Math.floor(time * 2)) - 0.5) * 0.2 : 0;
    const m = clamp(crew.suspect.ledge.x, -0.5, 4) + wobble;
    return { text: ledgeText(m), colour: m <= 0.2 ? RED : m <= 1 ? PINK : '#ffffff' };
  }
  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    // Only the hit-stop and slow-motion countdowns and the flash use the real clock.
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    flash = Math.max(0, flash - real / 0.25);
    if (escapeT >= 0) escapeT += dt;
    if (crashT >= 0) crashT += dt;
    if (harmlessT >= 0) harmlessT += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const act = actAt(view.elapsed);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    const base = clamp(Math.log2(multiplier) / TENSION_DIV, 0, 1);
    const tension = running && view.cashoutX100 === null ? base * act.effort : base;
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    const wind = 0.2 + 0.8 * tension;
    canCue = !fresh && !muted;
    // The escape before the crash: both can land in one frame, and only one wins.
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (!fresh && !outcome && (running || (crashed && previous !== 'crashed'))) beginEscape(view.cashoutX100);
      else settleEscape();
    }
    if (fresh) {
      // A fresh scene settles into the round as it stands.
      previous = view.phase;
      actStage = act.stage;
      if (act.stage === 6) crew.lead.actClock = act.age;
      if (running || crashed) {
        const escaped = secured !== null;
        settleDialogue(talk, multiplier, escaped);
        settleCrew(crew, { multiplier, rung, tension, running: true, escaped, overtime: talk.overtimeK });
        settleRoof(roof, { rung, tension, escaped });
        settleCity(city, { multiplier, tension, running: true, crashed, escaped });
      }
      if (crashed) beginCrash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !outcome) beginCrash(view, view.crashAge > 1500);
      if (view.phase === 'betting' || (view.phase === 'waiting' && outcome)) reset();
      previous = view.phase;
    }
    canCue = !fresh && !muted;
    audio.update(view.phase, tension);
    // The harmless clipboard heave waits for the door to shut.
    if (outcome === 'called' && harmlessT < 0 && !muted && escapeT >= 1.75) {
      harmlessT = 0;
      beginHeave(crew);
      beginAftermath(talk, 'called');
    }
    const aftermathT = outcome === 'called' ? harmlessT : outcome ? (crew.thrown && crashT < crew.thrown.times.back ? -1 : view.crashAge / 1000) : -1;
    // The words, then the rigs (kicked by the lines), the roof (fed by the crew) and the city.
    stepDialogue(talk, { running, multiplier, escapeT, aftermathT }, dt);
    const tev = talk.events;
    const talking = { suspect: false, lead: false, heavy: false };
    for (const b of talk.bubbles) if (b.age < 1.6 && b.age < b.life && b.who !== 'hq') talking[b.who] = true;
    stepCrew(crew, { phase: view.phase, running, multiplier, rung, tension, time, wind, said: tev.said, talking, escaped: secured !== null, escapeT, crashT, aftermathT, harmlessT, overtime: talk.overtimeK, actStage: running && !secured ? act.stage : 0 }, dt);
    const ev = crew.events;
    for (const d of ev.drops) spawnLoose(roof, d);
    if (ev.pickup) roof.loose = roof.loose.filter((l) => l.kind !== 'clipboard');
    roof.strokes = crew.lead.strokes;
    roof.chair = running && !secured && act.stage === 5 ? 'out' : 'bulkhead';
    roof.pizzaBox = running && !secured && view.elapsed >= 79000;
    const cam = cameraFor(crew.thrown, crashT);
    stepRoof(roof, { running, tension, time, wind, rung, overtime: talk.overtimeK, escaped: secured !== null, escapeT, crashT, aftermathT, camY: cam.y, aftermath: crew.thrown !== null && crashT >= crew.thrown.times.back }, dt);
    const rev = roof.events;
    const a = anchors(crew);
    stepCity(city, { running, crashed, multiplier, tension, time, elapsed: view.elapsed, escaped: secured !== null, target: a.suspectHead, crashT, thrown: crew.thrown, camY: cam.y }, dt);
    const cev = city.events;
    for (const l of tev.said) {
      if (l.who === 'hq') {
        fx('buzz', 0.4);
        fx('pop', 0.4);
      } else fx('pop', l.who === 'suspect' ? 0.8 : 0.5);
    }
    if (ev.flashlight) fx('click', 0.6);
    if (ev.click) {
      if (ev.flashlight) cue(0.3, 'click', 0.6);
      else fx('click', 0.6);
    }
    if (ev.tick || ev.write) fx('tick', 0.5);
    if (ev.knuckles) {
      fx('tick', 0.5);
      cue(0.08, 'tick', 0.5);
      cue(0.16, 'tick', 0.5);
    }
    if (ev.gumPop) fx('pop', 0.4);
    if (ev.gumFlick) fx('squeak', 0.5);
    if (ev.snicker) fx('laugh', 0.4);
    if (ev.gasp) fx('gasp', 0.8);
    if (ev.steam === 'first') fx('hiss', 0.8);
    else if (ev.steam === 'puff') fx('hiss', 0.4);
    if (ev.stomp > 0) {
      fx('stomp', ev.stomp);
      shake = Math.max(shake, 0.25 * ev.stomp);
    }
    if (ev.camera) {
      fx('camera', 1);
      flash = Math.max(flash, 0.35);
    }
    if (ev.phoneOut) fx('notify', 0.6);
    if (ev.chat) fx('notify', 0.25);
    if (ev.zap) fx('zap', 0.5);
    if (ev.drops.some((d) => d.kind === 'flashlight')) fx('click', 0.5);
    if (ev.heave) fx('whoosh', 0.6);
    if (ev.load) speak('heavy', THROW_LINES.sayLess, 0.9);
    if (ev.hitstop) {
      // The freeze-frame: punch, shake, motivated flash, record scratch.
      {
        freeze = FREEZE_S;
        slow = SLOW_S;
        flash = 0.35;
      }
      punch.v = 9;
      shake = 1;
      if (canCue) audio.crash('scratch');
    }
    if (ev.release) {
      fx('yeet', 1);
      fx('whistle', 0.7);
    }
    if (ev.apex) {
      // The last words, mid-air, get the frame alone.
      clearBubbles(talk);
      speak('suspect', THROW_LINES.view, 0.8);
    }
    for (const k of rev.landed) if (k === 'clipboard') fx('thud', 0.6);
    if (rev.door === 'open') fx('door', 1);
    if (rev.door === 'shut') {
      fx('clang', 0.5);
      shake = Math.max(shake, 0.5);
    }
    if (rev.pigeonsOff) fx('squeak', 0.3);
    if (rev.gust > 0) fx('hiss', rev.gust);
    if (cev.burst) {
      fx('pop', 0.3);
      cue(0.09, 'pop', 0.3);
      cue(0.18, 'pop', 0.3);
    }
    if (crew.thrown) {
      const T = crew.thrown.times;
      const fr = crashT - T.fall;
      while (fallCue < FALL_CUES.length && fr >= FALL_CUES[fallCue]![0]) {
        const c = FALL_CUES[fallCue++]!;
        fx(c[1], c[2]);
      }
      const it = crashT - T.insert;
      while (insertCue < INSERT_CUES.length && it >= INSERT_CUES[insertCue]![0]) {
        const c = INSERT_CUES[insertCue++]!;
        fx(c[1], c[2]);
      }
      // The cut back: one croc on the coping.
      if (crashT >= T.back && !roof.relic) roof.relic = true;
    }
    if (running && !secured) {
      if (tension >= 0.45) {
        sirenClock += dt;
        if (sirenClock >= 14) {
          sirenClock = 0;
          fx('siren', Math.min(0.4, 0.15 + 0.25 * tension + 0.02 * Math.max(0, talk.overtimeK)));
        }
      }
      if (rung >= 12) {
        heartClock += dt;
        if (heartClock >= 0.9) {
          heartClock = 0;
          fx('heartbeat', 0.3);
        }
      } else heartClock = 0;
      if (act.stage !== actStage) {
        actStage = act.stage;
        actCue = false;
        if (act.stage === 2) fx('ding', 0.4);
        if (act.stage === 3) fx('door', 0.6);
        if (act.stage === 4) fx('beep', 0.5);
        if (act.stage === 5) fx('creak', 0.4);
        if (act.stage === 6) fx('whoosh', 0.3);
      }
      if (act.stage === 3 && !actCue && act.age >= 4) {
        actCue = true;
        fx('door', 0.6);
      }
      if (canCue) audio.milestone(rung);
    } else sirenClock = heartClock = 0;
    if (outcome && outcome !== 'called' && !sirenAfter && view.crashAge >= 4000) {
      sirenAfter = true;
      fx('siren', 0.3);
    }
    for (let i = cues.length - 1; i >= 0; i -= 1) {
      const c = cues[i]!;
      if (time >= c.at) {
        cues.splice(i, 1);
        if (canCue) audio.fx(c.fx, c.strength);
      }
    }
    // The stamp never covers the fall.
    if (outcome && !stamp && crashed && view.crashAge >= (outcome === 'called' ? 1300 : 3750) && (!crew.thrown || crashT >= crew.thrown.times.back)) {
      stamp = true;
      pop.v = 16;
      if (outcome === 'rekt') fx('airhorn', 0.8);
    }
    stepSpring(pop, stamp ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(punch, 0, 8, 0.5, dt);
    const nextCaption = captionFor(view, rung);
    if (nextCaption !== caption) {
      caption = nextCaption;
      if (!fresh) captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    const alignment = alignmentFor(view, rung);
    if (alignment.text !== align) {
      align = alignment.text;
      alignFlash = fresh ? 0 : 0.4;
    }
    alignFlash = Math.max(0, alignFlash - dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.5);
    // ---- The picture, in depth order, under the camera ----
    ctx.save();
    const simmer = running && !crew.thrown && !secured ? tension * tension * 1.5 : 0;
    if ((shake > 0 || simmer > 0)) ctx.translate(Math.sin(time * 90) * (8 * shake + simmer), Math.cos(time * 70) * 5 * shake);
    if (punch.x > 0.005) {
      const k = 1 + 0.07 * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(k, k);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    drawSky(ctx, city, cam, tension, time);
    drawSkyline(ctx, city, cam, 'far', tension, time);
    drawSkyline(ctx, city, cam, 'mid', tension, time);
    drawSearchlight(ctx, city, cam, time);
    drawStreet(ctx, city, cam, time);
    drawFacades(ctx, city, cam, time);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawRoofBack(ctx, roof, time);
    const acting = running && !secured;
    const actAnchors = { heavyHead: a.heavyHead, leadX: crew.lead.x, leadHead: a.leadHead, leadHand: a.leadHand, radio: a.radio, time, suspectHead: a.suspectHead, suspectHand: a.suspectHand };
    if (acting) drawActBehind(ctx, act, actAnchors);
    // The heavy's arm on the suspect draws after him; the rest of the heavy, then the lead, stay behind.
    const reach = reachesSuspect(crew.heavy, crew);
    drawMilitia(ctx, crew.heavy, crew, time, reach ? 'body' : 'all');
    drawMilitia(ctx, crew.lead, crew, time);
    const beam = beamFor(crew, time);
    if (beam) drawBeam(ctx, beam);
    drawSuspect(ctx, crew, time);
    drawThrown(ctx, crew, time);
    if (reach) drawMilitia(ctx, crew.heavy, crew, time, 'reach');
    drawRoofFront(ctx, roof, time);
    drawAir(ctx, roof);
    if (acting) drawAct(ctx, act, actAnchors);
    ctx.restore();
    if (!isPortrait(ctx.canvas)) {
      const frame = (p: { x: number; y: number } | null) => (p ? { x: p.x - cam.x, y: p.y - cam.y } : null);
      drawBubbles(ctx, talk, { suspect: frame(a.suspectMouth), lead: frame(a.leadMouth)!, heavy: frame(a.heavyMouth)!, hq: frame(a.radio)! });
    }
    ctx.restore();
    drawFlash(ctx, roof, flash);
    // The cut: two near-black frames (the HUD stays), then the pigeon insert.
    if (crew.thrown && crashT >= crew.thrown.times.cut && crashT < crew.thrown.times.back) {
      if (crashT < crew.thrown.times.insert) {
        ctx.fillStyle = 'rgba(4,4,8,0.92)';
        ctx.fillRect(0, 0, 960, 540);
      } else drawInsert(ctx, city, crashT - crew.thrown.times.insert);
    }
    // The vignette.
    const vig = ctx.createRadialGradient(480, 270, 260, 480, 270, 640);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${0.35 + 0.15 * tension})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, 960, 540);
    // ---- The HUD, after the portrait compositor has the clean fr
    capture(ctx);
    const T = crew.thrown?.times;
    if (caption) {
      ctx.save();
      ctx.translate(424, 62);
      const scale = 1 + 0.08 * captionPop.x;
      ctx.scale(scale, scale);
      memeText(ctx, caption, 0, 0, 40, '#ffffff', 'center', 540);
      ctx.restore();
    }
    if (secured && outcome !== 'spectator' && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(430, 104);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      memeText(ctx, text, 0, 0, 24, GREEN, 'center');
      ctx.restore();
    }
    const red = (outcome === 'rekt' || outcome === 'spectator') && (!T || crashT >= T.hitstop);
    memeText(ctx, `${multiplier.toFixed(2)}×`, 936, 72, 56, red ? RED : running || outcome ? '#ffffff' : '#ffe08a', 'right', 220);
    memeText(ctx, `ALIGNMENT: ${alignment.text}`, 24, 520, 22, alignment.colour, 'left');
    const ledge = ledgeFor(view, cam, running);
    memeText(ctx, ledge.text, 936, 520, 22, ledge.colour, 'right', 320);
    if (outcome && stamp && pop.x > 0.02) {
      ctx.save();
      ctx.translate(480, secured ? 152 : 116);
      ctx.rotate(-0.08);
      const s = clamp(pop.x, 0, 1.25);
      ctx.scale(s, s);
      const word = outcome === 'rekt' ? 'YEETED' : outcome === 'called' ? 'TOUCHED GRASS' : 'I SAW NOTHING';
      memeText(ctx, word, 0, 0, outcome === 'rekt' ? 42 : 36, outcome === 'rekt' ? RED : GOLD, 'center', 700);
      ctx.restore();
    }
    let detail: readonly number[] | undefined;
    if (escapeT >= 0 && escapeT < 1.75) detail = [0, 180, 560, 300];
    if (T && crashT >= T.fall && crashT < T.cut) detail = [440, 60, 420, 440];
    if (T && crashT >= T.cut && crashT < T.back) detail = [0, 60, 960, 480];
    present(ctx, view, running && !secured && act.stage > 0 ? act.line : caption, 'ON THE ROOF', talk.bubbles[talk.bubbles.length - 1]?.text ?? 'Simple question.', detail);
  }
  return { draw };
}