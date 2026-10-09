import { pageAudio, type Effect } from './audio';
import { drawPortrait, isPortrait } from './portrait';
import { applicantRig, blendRig, drawApplicant, drawDog, walked, type ApplicantPose, type Rig } from './character';
import { HIT, PEANUT, crateWalls, directionAt, ease, joltAt, mix, multiplierLabel, paintAt, stampsAt, testimony, type Direction } from './direction';
import { C, box, label, line, mono, oval } from './ink';
import { drawBackdrop, drawBay, drawCrate, drawDepartment, drawDispenser, drawPacking, drawProcedure, type MinistryView } from './ministry';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

const CUES: Effect[] = ['beep', 'camera', 'thud', 'ratchet', 'beep', 'beep', 'ratchet', 'thud'];
/** The makeup arrives with a sound: a squeaky nose, then spray paint. */
const MAKEUP: [number, Effect][] = [[150, 'squeak'], [250, 'spray'], [400, 'spray']];
/** The case note once each early stamp has landed. */
const VERDICTS = ['LIQUIDITY CONFIRMED. EXIT NOT INCLUDED.', 'DENTAL OUTLOOK: NGMI. FLOSSING WAS NOT ENOUGH.', 'SYBIL CHECK: ARE YOU 400 WALLETS?'];
/** After a cash-out the round carries on without him; the joke grows with the current ÷ cashed-out multiplier. */
const REGRET: [number, string][] = [[1.25, 'THE MINISTRY IS NOW SCANNING AN EMPTY BOOTH.'], [2, 'YOUR SLOT WENT TO 400 SYBIL WALLETS.'], [4, 'THE EMPTY BOOTH JUST PASSED KYC.'], [10, 'THE BOOTH IS A KOL NOW. STILL ONE PEANUT.']];

/** The bottom line for the current moment, shared by both compositions. */
export function punchline(view: SceneView, d: Direction, accepted: number | null, crash: number | null): string {
  if (accepted !== null) {
    if (crash !== null) return 'DODGED. THE CRATE SHIPPED EMPTY.';
    let text = 'PAPER-HANDED THE AIRDROP. KEPT FACE.';
    for (const [at, words] of REGRET) if (view.currentX100 / accepted >= at) text = words;
    return text;
  }
  if (crash !== null) return crash < PEANUT ? 'IDENTITY: SOLD. ALLOCATION: PROCESSING.' : 'THE AIRDROP WAS YOU.';
  return view.phase === 'running' ? d.line : 'ONE SMALL CHECK. ONE LIFE-CHANGING PEANUT.';
}

/** State comes from the SDK shell; the machinery is an illustration of the current round. */
export function createScene(): Scene {
  const audio = pageAudio({ style: 'techno', bpm: 160, music: .48, effects: .8, crash: 'slam' });
  let previous: SceneView['phase'] | null = null;
  let lastElapsed = 0;
  let lastNow: number | null = null;
  let lastX100 = 100;
  let stageSerial = -1;
  let cueSerial = '';
  let heardStamps = 0;
  let heardJolt = -1;
  let accepted: number | null = null;
  let acceptedAct: Direction | null = null;
  let exitAt = 0;
  let quietCrash = false;
  let peanutPlayed = false;
  // Presentation state integrated from frame time. Round beats still come from elapsed time and crash age.
  let clock = 0, belt = 0, beltSpeed = 0, sweat = 0, pulse = 0, park = 0, gone = 0, push = 0;
  // The previous applicant leaves (crate sinks, or he steps through the exit) while the next one rises in.
  let entry = 9;
  type Figure = { pose: ApplicantPose; rig: Rig; crate: boolean; empty: boolean };
  let departing: Figure | null = null;
  let last: Figure | null = null;
  let from: Figure | null = null;
  let modeAge = 9;
  let lastMode = '';

  function reset(): void {
    stageSerial = -1; cueSerial = ''; heardStamps = 0; heardJolt = -1; accepted = null; acceptedAct = null; exitAt = 0;
    quietCrash = false; peanutPlayed = false; pulse = 0;
  }

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const fresh = previous === null;
    const gap = lastNow !== null && now - lastNow > 1500;
    const dt = lastNow === null ? 0 : Math.min(.1, Math.max(0, (now - lastNow) / 1000));
    // Returning to a hidden page can skip the whole betting phase, so any phase after a crash starts a new applicant.
    const leftCrash = previous === 'crashed' && view.phase !== 'crashed';
    const restarted = view.phase === 'betting' && previous !== 'betting' || leftCrash
      || view.phase === 'running' && previous === 'running' && view.elapsed + 1000 < lastElapsed;
    if (leftCrash && last && !gap) { departing = last; entry = 0; }
    if (restarted) reset();
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const d = directionAt(running || crashed ? view.elapsed : 0, running || crashed ? view.currentX100 : 100);
    let crashAge = crashed ? Math.max(0, view.crashAge / 1000) : null;
    clock += dt; entry += dt; modeAge += dt;
    if (entry > 1.2) departing = null;

    if (view.cashoutX100 !== null && accepted === null) {
      accepted = view.cashoutX100;
      acceptedAct = d;
      const settle = fresh || gap || crashed;
      exitAt = settle ? now - 2000 : now;
      if (!settle && running) audio.cashout();
    }
    const escaped = accepted !== null;

    audio.update(view.phase, d.tension);
    if (crashed && previous !== 'crashed') {
      quietCrash = fresh || gap || view.crashAge > 1500;
      audio.crash('slam', quietCrash);
      peanutPlayed = quietCrash;
    }
    if (crashed && quietCrash) crashAge = Math.max(5, crashAge!);
    // A seek enters its current cue window; it never replays the missed audit or a burst of sounds.
    const quarter = Math.floor(d.action * 4);
    const cue = `${d.serial}:${d.cycle}:${quarter}`;
    const stamps = stampsAt(d);
    const jolt = joltAt(d.seconds);
    if (running && !fresh && !gap && !restarted && !escaped) {
      if (d.serial !== stageSerial) audio.fx('buzz', .2);
      else if (cue !== cueSerial) {
        if (quarter === 1) audio.fx(CUES[d.stage]!, .48);
        else if (quarter === 3 && d.cycle % 2 === 0 && (d.serial > 2 || d.cycle > 0)) audio.fx('engine', .2);
      }
      if (stamps.count > heardStamps) audio.fx('thud', .5);
      if (jolt.index > heardJolt && jolt.age < .25) audio.fx('ratchet', .32);
      for (const [mark, effect] of MAKEUP) if (lastX100 < mark && view.currentX100 >= mark) audio.fx(effect, .4);
      // The eligibility checker's false hope.
      if (lastX100 < 200 && view.currentX100 >= 200) audio.fx('ding', .28);
      // A Ministry tick that quickens with tension: once every 1.4 s at 1×, about every 0.7 s at 3×.
      pulse += Math.min(.1, Math.max(0, view.elapsed - lastElapsed) / 1000) / mix(1.4, .35, d.tension);
      if (pulse >= 1) { pulse %= 1; audio.fx('tick', mix(.1, .22, d.tension)); }
    }
    if (crashed && !peanutPlayed && crashAge! >= PEANUT) {
      if (!gap && !escaped && view.crashAge < PEANUT * 1000 + 1200) audio.fx('coin', .9);
      peanutPlayed = true;
    }
    stageSerial = d.serial; cueSerial = cue; heardStamps = stamps.count; heardJolt = jolt.index; lastX100 = view.currentX100;

    const follow = (value: number, target: number, rate: number): number => fresh ? target : value + (target - value) * (1 - Math.exp(-rate * dt));
    park = follow(park, crashed && crashAge! >= HIT ? 1 : 0, 9);
    gone = follow(gone, escaped ? 1 : 0, 7);
    push = follow(push, .045 * ease((d.dread - .25) / .6), 3);
    // The belt stops dead at the crash; otherwise it eases in and out and keeps running after a cash-out.
    beltSpeed = crashed ? 0 : follow(beltSpeed, running ? 35 : 0, 4);
    belt += beltSpeed * dt;
    if (!escaped) sweat += dt * (.7 + d.dread * .6);

    const exit = !escaped ? 0 : ease((now - exitAt) / 1400);
    const mode: ApplicantPose['mode'] = escaped ? 'escape' : crashAge !== null ? 'boxed' : !running ? 'idle' : d.stage === 4 ? 'dance' : 'scan';
    const act = escaped ? acceptedAct ?? d : d;
    // Phase changes (idle → scan, scan → escape, idle or scan → crate) blend from the last drawn rig; the next applicant starts fresh.
    if (mode !== lastMode) { modeAge = fresh ? 9 : 0; from = last && !fresh && !leftCrash ? last : null; }
    const stamped = mode === 'idle' ? { count: 0, age: 9 } : stampsAt(act);
    const rise = departing ? ease((entry - .4) / .6) : 1;
    const pose: ApplicantPose = {
      x: escaped ? mix(511, 143, exit) : 511, y: 427 + (1 - rise) * 250, scale: escaped ? mix(1, .63, exit) : 1,
      time: mode === 'idle' || escaped ? clock : d.seconds, tension: escaped ? .15 : d.dread,
      stage: act.stage, level: act.level, action: act.action, cycle: act.cycle, mode,
      progress: escaped ? exit : crashAge === null ? 0 : ease((crashAge - HIT) / .7),
      paint: paintAt(mode === 'idle' ? 100 : accepted ?? d.x100), stamps: stamped.count, sweat, ...walked(-368, exit),
      // A crash or cash-out freezes the act, so the newest label's landing settles on presentation time instead.
      stampAge: stamped.age + (escaped || crashAge !== null ? modeAge : 0),
    };
    // The blend keeps the feet where they stood, so a walk-off never drags them along the floor.
    let shown = pose;
    const rigOf = (p: ApplicantPose): Rig => {
      const rig = applicantRig(p);
      if (!from || modeAge >= .35) return rig;
      const { pose: q, rig: r } = from;
      const feet = r.feet.map(({ x, y }) => ({ x: (q.x + x * q.scale - p.x) / p.scale, y: (q.y + y * q.scale - p.y) / p.scale }));
      return blendRig({ ...r, feet }, rig, ease(modeAge / .35));
    };
    const jolted = (running || crashed) ? 16 * ease(jolt.age / .07) * (1 - ease((jolt.age - .1) / .35)) : 0;
    const walls = crateWalls(d) + jolted;
    const ministry: MinistryView = { d, time: clock, running, crash: crashAge, escaped, park, gone, belt };

    /** The applicant, the leaving one, the front apparatus and the crate, for either composition. */
    function figure(g: CanvasRenderingContext2D, p: ApplicantPose, crate = true): Rig {
      const rig = rigOf(p);
      shown = p;
      if (departing) {
        if (departing.crate) {
          g.save(); g.beginPath(); g.rect(0, 0, 960, 441); g.clip(); g.translate(0, ease(entry / .45) * 230);
          if (departing.pose.mode === 'boxed') drawApplicant(g, departing.pose, departing.rig);
          drawCrate(g, 112, 112, 1, departing.empty);
          g.restore();
        }
        if (departing.pose.mode === 'escape' && gone > .01) {
          g.save(); g.globalAlpha *= gone; drawApplicant(g, departing.pose, departing.rig); g.restore();
        }
      }
      // The next applicant rides up through the conveyor hatch.
      g.save();
      if (rise < 1) { g.beginPath(); g.rect(0, 0, 960, 437); g.clip(); }
      drawApplicant(g, p, rig);
      g.restore();
      drawProcedure(g, ministry, true);
      if (!crate) return rig;
      if (crashAge !== null) drawPacking(g, crashAge, walls, escaped);
      else if (running) drawCrate(g, walls, 0, 0, escaped);
      return rig;
    }

    let rig: Rig;
    if (isPortrait(c.canvas)) {
      rig = drawPortrait(c, ministry, view, accepted, exit, pose, figure, punchline(view, d, accepted, crashAge));
    } else {
      c.save();
      // The camera pushes in as dread rises; the crash punches in 10% and holds before easing back.
      const punch = crashAge === null || quietCrash || escaped ? 0 : crashAge < .3 ? 1 : 1 - ease((crashAge - .3) / .35);
      const zoom = 1 + push + punch * .1;
      c.beginPath(); c.rect(0, 82, 960, 417); c.clip();
      c.translate(480, 300); c.scale(zoom, zoom); c.translate(-480, -300);
      drawBackdrop(c, ministry);
      drawBay(c, ministry);
      drawDepartment(c, ministry);
      drawDispenser(c, ministry);
      drawProcedure(c, ministry, false);
      const witness = 1 - Math.max(park, gone);
      if (d.stage === 2 && witness > .01) {
        c.save(); c.globalAlpha *= witness;
        drawDog(c, 123, 399, d.seconds, d.dread);
        // A single restrained speech bubble gives the witness a clear punchline.
        box(c, 49, 314, 114, 29, 9, C.cream, C.ink, 2);
        line(c, [119, 343, 123, 351, 128, 343], C.ink, 2);
        label(c, testimony(d), 106, 334, 12, C.ink, 'center', 104);
        c.restore();
      }
      rig = figure(c, pose);
      if (escaped && exit > .95) {
        box(c, 67, 427, 154, 22, 5, C.lime, C.ink, 2);
        label(c, 'PRIVACY INTACT', 144, 443, 12, C.ink, 'center');
      }
      c.restore();
      drawReceipt(c, d, crashed, escaped, view.stake === null, stamps.count > d.serial, clock);
      drawHeader(c, view, accepted, running);
      drawFooter(c, view, d, accepted, crashAge);
      if (crashAge !== null && crashAge < 1.2 && !quietCrash && !escaped) drawRejection(c, crashAge);
    }
    last = { pose: shown, rig, crate: crashAge !== null, empty: escaped };
    lastMode = mode;
    previous = view.phase; lastElapsed = view.elapsed; lastNow = now;
  }
  return { draw };
}

function drawHeader(c: CanvasRenderingContext2D, view: SceneView, accepted: number | null, running: boolean): void {
  box(c, 0, 0, 960, 81, 0, C.ink, C.ink, 0);
  line(c, [0, 81, 960, 81], C.brass, 3);
  // A custom stamp mark serves as the game's logo, readable even at small sizes.
  c.save(); c.translate(49, 41); c.rotate(-.08);
  oval(c, 0, 0, 26, 26, C.lime, C.lime, 0);
  oval(c, -8, -5, 3, 4, C.ink, C.ink, 0); oval(c, 8, -5, 3, 4, C.ink, C.ink, 0);
  oval(c, 0, 5, 6, 6, C.coral, C.ink, 1.5);
  c.beginPath(); c.arc(0, 7, 13, .22, Math.PI - .22); c.strokeStyle = C.ink; c.lineWidth = 2; c.stroke();
  c.restore();
  mono(c, 'MINISTRY OF AIRDROPS', 89, 26, 11, C.mint);
  label(c, 'KNOW YOUR CLOWN', 87, 58, 27, C.cream, 'left', 309, 900);
  mono(c, 'A GAME OF INFINITE VERIFICATION', 487, 27, 9, '#adbaa4', 'center', 160);
  box(c, 409, 37, 158, 24, 12, '#2c4947', '#627569', 1);
  oval(c, 422, 49, 3, 3, accepted !== null ? C.mint : view.phase === 'crashed' ? C.coral : C.lime, C.ink, 0);
  const status = accepted !== null ? 'CLAIM ABANDONED' : view.phase === 'crashed' ? 'ROUND CRASHED'
    : running ? view.stake === null ? 'SPECTATOR: ALSO SCANNED' : 'AUDIT IN PROGRESS' : 'APPLICANT WAITING';
  mono(c, status, 494, 53, 9, C.cream, 'center', 131);
  label(c, multiplierLabel(accepted ?? view.currentX100), 933, 59, 47, accepted !== null ? C.mint : view.phase === 'crashed' ? C.coral : C.lime, 'right', 338, 900);
  // After a cash-out the round keeps climbing without him; both numbers stay visible.
  mono(c, accepted !== null ? `CASHED OUT ${multiplierLabel(accepted)} · ROUND ${multiplierLabel(view.currentX100)}` : 'ROUND MULTIPLIER', 932, 20, 10, accepted !== null ? C.mint : '#b7c4ae', 'right', 333);
}

function drawReceipt(c: CanvasRenderingContext2D, d: Direction, crashed: boolean, escaped: boolean, spectator: boolean, stamped: boolean, time: number): void {
  const y = 469;
  box(c, 24, y, 912, 23, 2, C.cream, C.ink, 1.5);
  for (const x of [29, 930]) for (let i = 0; i < 3; i++) oval(c, x, y + 5 + i * 6, 1.2, 1.2, C.paper, C.paper, 0);
  mono(c, crashed ? 'DISPOSITION' : 'CASE NOTE', 41, y + 16, 10, C.red);
  const words = crashed ? escaped ? 'APPLICANT JEETED BEFORE PACKING. THE MACHINE IS COPING.'
    : spectator ? 'SPECTATOR DATA ALSO SOLD. BULK DISCOUNT.' : 'VALUABLE CUSTOMER DATA. CUSTOMER VALUE: ONE PEANUT.'
    : escaped ? 'EXIT ACCEPTED. NO FURTHER PERSONALITY REQUIRED.'
    : spectator && Math.floor(d.seconds / 5) % 2 === 1 ? 'WATCHING IS ALSO KYC. SNAPSHOT TAKEN.'
    : d.serial <= 2 && stamped ? VERDICTS[d.serial]! : d.note;
  mono(c, words, 155, y + 16, 12, C.ink, 'left', 689);
  for (let i = 0; i < 11; i++) line(c, [873 + i * 3, y + 5, 873 + i * 3, y + 18], C.ink, i % 3 === 0 ? 2 : .7);
  // Paper feed advances in finite cycles even after hours of automated review.
  if (!crashed) line(c, [851, y + 5, 851, y + 5 + (time % 2) * 6], C.red, 2);
}

function drawFooter(c: CanvasRenderingContext2D, view: SceneView, d: Direction, accepted: number | null, crashAge: number | null): void {
  box(c, 0, 499, 960, 41, 0, C.ink, C.ink, 0);
  const payoff = accepted === null && crashAge !== null && crashAge >= PEANUT;
  label(c, punchline(view, d, accepted, crashAge), 480, 527, payoff ? 27 : 19, accepted !== null ? C.mint : crashAge !== null ? C.coral : C.cream, 'center', 904);
}

function drawRejection(c: CanvasRenderingContext2D, age: number): void {
  const t = ease(age / .12);
  const scale = mix(1.4, 1, t);
  c.save(); c.globalAlpha *= 1 - ease((age - .95) / .25);
  c.translate(511, 280); c.rotate(-.14); c.scale(scale, scale);
  box(c, -141, -39, 282, 78, 5, '#fff3d7ee', C.red, 5);
  label(c, 'CLAIM REJECTED', 0, 10, 31, C.red, 'center', 260);
  c.restore();
}
