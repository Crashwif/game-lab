import { pageAudio } from './audio';
import { box, clamp, GOLD, GREEN, INK, label, line, mono, PAPER, RED } from './ink';
import { ANNOYANCES, drawComic, drawRoom, type RoomPose } from './room';

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
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose?(): void;
}

const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;

function header(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 960, 540);
  // Registration marks and imperfect underlines frame the comic as a printed page.
  label(ctx, 'RAGE', 24, 49, 72, INK, 239);
  ctx.save();
  ctx.translate(274, 7);
  ctx.rotate(-0.025);
  box(ctx, 0, 0, 220, 76, RED, 3);
  label(ctx, 'QUIT', 110, 43, 66, PAPER, 204, 'center');
  ctx.restore();
  mono(ctx, 'A VERY SMALL PROBLEM. A VERY BIG REACTION.', 29, 95, 14, INK, 639);
  mono(ctx, 'A RAGE COMIC IN FOUR PANELS', 681, 31, 12, INK, 255);
  label(ctx, 'KEEP YOUR COOL.', 938, 61, 26, INK, 311, 'right');
  line(ctx, [[684, 82], [935, 80]], RED, 5);
  line(ctx, [[697, 91], [916, 90]], INK, 1.5);
}

function sidebar(ctx: CanvasRenderingContext2D, view: SceneView, pose: RoomPose): void {
  const crashed = view.phase === 'crashed';
  box(ctx, 693, 116, 243, 137, INK, 3);
  const phase = crashed ? 'ROUND CRASHED' : view.phase === 'running' ? 'ROUND RUNNING' : view.phase === 'betting' ? 'JOIN THE COMIC' : 'WAITING FOR A ROUND';
  mono(ctx, phase, 707, 138, 13, crashed ? GOLD : PAPER, 215);
  const text = formatX(view.currentX100);
  let size = 67;
  ctx.font = `900 ${size}px "Arial Black", sans-serif`;
  while (size > 20 && ctx.measureText(text).width > 216) {
    size -= 1;
    ctx.font = `900 ${size}px "Arial Black", sans-serif`;
  }
  ctx.fillStyle = crashed ? GOLD : PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 815, 192, 216);
  mono(ctx, crashed ? 'FINAL MULTIPLIER' : 'ROUND MULTIPLIER', 707, 234, 11, '#c9bfa9', 215);

  box(ctx, 693, 267, 243, 157, pose.safe ? '#e1e9cf' : PAPER, 3);
  const mood = pose.safe ? 'ZEN MODE' : crashed ? 'ABSOLUTE MELTDOWN' : view.phase !== 'running' ? 'RESTING RAGE FACE' : pose.tension > 0.7 ? 'KEYBOARD WARRIOR' : pose.tension > 0.3 ? 'DEEP BREATHS...' : 'MILDLY IRRITATED';
  label(ctx, mood, 707, 287, 16, pose.safe ? '#44563a' : RED, 214);
  mono(ctx, 'MOOD · COSMETIC ONLY', 707, 310, 10.5, INK, 214);
  for (let i = 0; i < 10; i += 1) {
    const lit = pose.safe ? false : crashed || i / 10 <= pose.tension;
    box(ctx, 708 + i * 21.5, 325, 16, 15, lit ? i > 5 ? RED : GOLD : '#e4dcc8', 1.5);
  }
  if (pose.safe) {
    label(ctx, 'CASH-OUT CONFIRMED', 707, 365, 13, '#44563a', 214);
    mono(ctx, `At ${formatX(view.cashoutX100!)}`, 707, 391, 17, INK, 214);
  } else if (crashed) {
    label(ctx, 'THE DESK IS DONE.', 707, 365, 16, INK, 214);
    mono(ctx, 'Breathe. There is another round.', 707, 391, 10.5, INK, 215);
  } else if (view.phase === 'running') {
    label(ctx, ANNOYANCES[pose.annoyance][0], 707, 365, 13, INK, 214);
    mono(ctx, ANNOYANCES[pose.annoyance][1], 707, 391, 10, INK, 214);
  } else {
    label(ctx, view.phase === 'betting' ? 'TAKE A SEAT.' : 'DESK ON STANDBY.', 707, 365, 16, INK, 214);
    mono(ctx, 'Credits have no monetary value.', 707, 391, 10.5, INK, 214);
  }
}

export function createScene(options: SceneOptions = {}): Scene {
  const audio = pageAudio({ style: 'chiptune', crash: 'slam', bpm: 126, tempoRise: 0.22, music: 0.5 });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousAnnoyance = -1;
  let previousElapsed = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, _now: number): void {
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    // This bounded parameter flavours art and sound; it does not predict a crash.
    const tension = clamp(Math.log2(Math.max(100, view.currentX100) / 100) / 8);
    const episode = Math.floor(Math.max(0, view.elapsed) / 6500);
    const annoyance = episode % ANNOYANCES.length;
    const safe = view.cashoutX100 !== null;
    audio.update(view.phase, safe ? tension * 0.3 : tension);
    if (previousPhase !== null && running && safe && previousCashout === null) audio.cashout();
    if (crashed && previousPhase !== 'crashed') audio.crash('slam', previousPhase === null || view.crashAge > 1500);
    const continuous = view.elapsed >= previousElapsed && view.elapsed - previousElapsed < 1500;
    if (running && previousPhase === 'running' && previousAnnoyance !== episode && continuous && !safe) audio.fx('notify', 0.35);
    previousPhase = view.phase;
    previousCashout = view.cashoutX100;
    previousAnnoyance = episode;
    previousElapsed = view.elapsed;

    const pose: RoomPose = {
      phase: view.phase,
      time: options.reducedMotion ? 0 : Math.max(0, view.elapsed) / 1000,
      tension,
      crashAge: Math.max(0, view.crashAge) / 1000,
      safe,
      reduced: options.reducedMotion ?? false,
      annoyance,
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    header(ctx);
    drawRoom(ctx, pose);
    sidebar(ctx, view, pose);
    drawComic(ctx, pose);
    ctx.restore();
  }

  return { draw };
}
