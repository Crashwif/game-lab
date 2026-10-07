import { pageAudio, type Effect } from './audio';
import { drawApplicant, drawDog } from './character';
import { directionAt, ease, mix, multiplierLabel, type Direction } from './direction';
import { C, box, label, line, mono, oval } from './ink';
import { drawBackdrop, drawBay, drawDepartment, drawDispenser, drawPacking, drawProcedure, type MinistryView } from './ministry';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean }
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }

const CUES: Effect[] = ['beep', 'camera', 'thud', 'ratchet', 'beep', 'beep', 'ratchet', 'thud'];

/** State comes from the SDK shell; the machinery is an illustration of the current round. */
export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'techno', bpm: 160, music: .48, effects: .8, crash: 'slam' });
  let previous: SceneView['phase'] | null = null;
  let lastElapsed = 0;
  let lastNow: number | null = null;
  let stageSerial = -1;
  let cueSerial = '';
  let accepted: number | null = null;
  let exitAt = 0;
  let quietCrash = false;
  let peanutPlayed = false;

  function reset(): void {
    stageSerial = -1; cueSerial = ''; accepted = null; exitAt = 0; quietCrash = false; peanutPlayed = false;
  }

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const fresh = previous === null;
    const gap = lastNow !== null && now - lastNow > 1500;
    const restarted = view.phase === 'betting' && previous !== 'betting'
      || view.phase === 'running' && previous === 'running' && view.elapsed + 1000 < lastElapsed;
    if (restarted) reset();
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const d = directionAt(running || crashed ? view.elapsed : 0);
    const time = running || crashed ? d.seconds : now / 1000;
    let crashAge = crashed ? Math.max(0, view.crashAge / 1000) : null;

    if (view.cashoutX100 !== null && accepted === null) {
      accepted = view.cashoutX100;
      const settle = fresh || gap || crashed;
      exitAt = settle ? now - 2000 : now;
      if (!settle && running) audio.cashout();
    }

    audio.update(view.phase, d.tension);
    if (crashed && previous !== 'crashed') {
      quietCrash = fresh || gap || view.crashAge > 1500;
      audio.crash('slam', quietCrash);
      peanutPlayed = quietCrash;
    }
    if (crashed && quietCrash) crashAge = Math.max(5, crashAge!);
    // A seek enters its current cue window; it never replays the missed audit or a burst of sounds.
    const cue = `${d.serial}:${d.cycle}:${Math.floor(d.action * 4)}`;
    if (running && !fresh && !gap && !restarted && accepted === null) {
      if (d.serial !== stageSerial) {
        audio.fx('buzz', .2);
      } else if (cue !== cueSerial) {
        const phase = Math.floor(d.action * 4);
        if (phase === 1) audio.fx(CUES[d.stage]!, .48);
        if (phase === 3 && d.stage === 0) audio.fx('thud', .48);
        else if (phase === 3 && d.cycle % 2 === 0) audio.fx('engine', .2);
      }
    }
    if (crashed && !peanutPlayed && crashAge! >= 2.8) {
      if (!gap && view.crashAge < 4000) audio.fx('coin', .9);
      peanutPlayed = true;
    }
    stageSerial = d.serial; cueSerial = cue;

    const exit = accepted === null ? 0 : ease((now - exitAt) / (reduced ? 1 : 1400));
    const ministry: MinistryView = { d, time: reduced ? 0 : time, reduced, running, crash: crashAge, escaped: accepted !== null };
    c.save();
    drawBackdrop(c, ministry);
    drawBay(c, ministry);
    drawDepartment(c, ministry);
    drawDispenser(c, ministry);
    drawProcedure(c, ministry, false);
    if (d.stage === 2 && !crashed && accepted === null) {
      drawDog(c, 123, 399, reduced ? 0 : time, d.tension, reduced);
      // A single restrained speech bubble gives the witness a clear punchline.
      box(c, 49, 314, 114, 29, 9, C.cream, C.ink, 2);
      line(c, [119, 343, 123, 351, 128, 343], C.ink, 2);
      label(c, d.action < .5 ? 'HE BOUGHT TOP.' : 'EVERY. TIME.', 106, 334, 12, C.ink, 'center', 104);
    }

    if (accepted !== null) {
      drawApplicant(c, { x: mix(511, 143, exit), y: 427 - (reduced ? 0 : Math.sin(exit * Math.PI) * 62), scale: mix(1, .63, exit),
        time: reduced ? 0 : time, tension: .15, stage: d.stage, level: d.level, action: d.action, reduced, mode: 'escape', progress: exit });
      if (exit > .95) {
        box(c, 67, 427, 154, 22, 5, C.lime, C.ink, 2);
        label(c, 'PRIVACY INTACT', 144, 443, 12, C.ink, 'center');
      }
    } else {
      const packing = crashAge === null ? 0 : reduced ? 1 : ease(crashAge / 1.4);
      drawApplicant(c, { x: 511, y: 427 + packing * 53, scale: 1,
        time: reduced ? 0 : time, tension: d.tension, stage: d.stage, level: d.level, action: d.action, reduced,
        mode: crashAge !== null ? 'boxed' : !running ? 'idle' : d.stage === 4 ? 'dance' : 'scan', progress: packing });
    }

    drawProcedure(c, ministry, true);
    if (crashAge !== null && accepted === null) drawPacking(c, reduced ? Math.max(5, crashAge) : crashAge, reduced);
    drawReceipt(c, d, crashed, accepted !== null, reduced ? 0 : time);
    drawHeader(c, view, accepted, running);
    drawFooter(c, view, d, accepted, crashAge);
    if (crashAge !== null && crashAge < 1.2 && !quietCrash && accepted === null) drawRejection(c, crashAge, reduced);
    c.restore();
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
  mono(c, accepted !== null ? 'CLAIM ABANDONED' : view.phase === 'crashed' ? 'ROUND CRASHED' : running ? 'AUDIT IN PROGRESS' : 'APPLICANT WAITING', 494, 53, 9, C.cream, 'center', 131);
  label(c, multiplierLabel(view.currentX100), 933, 59, 47, view.phase === 'crashed' ? C.coral : C.lime, 'right', 338, 900);
  mono(c, accepted !== null ? `CASHED OUT ${multiplierLabel(accepted)}` : 'ROUND MULTIPLIER', 932, 20, 10, accepted !== null ? C.mint : '#b7c4ae', 'right', 333);
}

function drawReceipt(c: CanvasRenderingContext2D, d: Direction, crashed: boolean, escaped: boolean, time: number): void {
  const y = 469;
  box(c, 24, y, 912, 23, 2, C.cream, C.ink, 1.5);
  for (const x of [29, 930]) for (let i = 0; i < 3; i++) oval(c, x, y + 5 + i * 6, 1.2, 1.2, C.paper, C.paper, 0);
  mono(c, crashed ? 'DISPOSITION' : 'CASE NOTE', 41, y + 16, 10, C.red);
  const words = crashed ? escaped ? 'APPLICANT WITHDREW CONSENT. THE MACHINE IS COPING.' : 'VALUABLE CUSTOMER DATA. CUSTOMER VALUE: ONE PEANUT.' : escaped ? 'EXIT ACCEPTED. NO FURTHER PERSONALITY REQUIRED.' : d.note;
  mono(c, words, 155, y + 16, 12, C.ink, 'left', 689);
  for (let i = 0; i < 11; i++) line(c, [873 + i * 3, y + 5, 873 + i * 3, y + 18], C.ink, i % 3 === 0 ? 2 : .7);
  // Paper feed advances in finite cycles even after hours of automated review.
  if (!crashed && !escaped) line(c, [851, y + 5, 851, y + 5 + (time % 2) * 6], C.red, 2);
}

function drawFooter(c: CanvasRenderingContext2D, view: SceneView, d: Direction, accepted: number | null, crashAge: number | null): void {
  box(c, 0, 499, 960, 41, 0, C.ink, C.ink, 0);
  let title = d.line;
  if (view.phase === 'waiting' || view.phase === 'betting') title = 'ONE SMALL CHECK. ONE LIFE-CHANGING PEANUT.';
  if (accepted !== null) title = 'YOU KEPT YOUR DIGNITY. MOST OF IT.';
  else if (crashAge !== null) title = crashAge < 2.8 ? 'IDENTITY: SOLD. ALLOCATION: PROCESSING.' : 'THE AIRDROP WAS YOU.';
  label(c, title, 480, 527, crashAge !== null && crashAge >= 2.8 ? 27 : 19, crashAge !== null ? C.coral : accepted !== null ? C.mint : C.cream, 'center', 904);
}

function drawRejection(c: CanvasRenderingContext2D, age: number, reduced: boolean): void {
  const t = ease(age / .16);
  const scale = reduced ? 1 : mix(1.4, 1, t);
  c.save(); c.translate(511, 280); c.rotate(-.14); c.scale(scale, scale);
  box(c, -141, -39, 282, 78, 5, '#fff3d7ee', C.red, 5);
  label(c, 'CLAIM REJECTED', 0, 10, 31, C.red, 'center', 260);
  c.restore();
}
