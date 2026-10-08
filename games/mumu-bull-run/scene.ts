import { pageAudio } from './audio';
import { actCaption, actTitle, drawAct, idleBear } from './acts';
import { arena, crashStamp, dust, impact, parade, supportDesk, track } from './arena';
import { box, bubble, clamp, CREAM, ease, GOLD, GREEN, INK, mix, RED, text } from './art';
import { BEAT_SECONDS, CONTACT, floorAt, idlePose, routineAt, runningPose, type BullPose, type Routine } from './motion';
import { bull } from './rig';
import { isPortrait, presentPortrait, type Framing } from './portrait';

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
export interface Scene { draw(c: CanvasRenderingContext2D, view: SceneView, now: number): void }
const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;

function hud(c: CanvasRenderingContext2D, view: SceneView, r: Routine, caption: string): void {
  box(c, 18, 17, 224, 60, INK, 7, 0);
  text(c, 'MUMU BULL RUN', 31, 37, 27, GREEN, 'left', 200);
  text(c, view.phase === 'running' ? `SHITSHOW ${r.index + 1} · ${actTitle(r)}` : view.phase === 'crashed' ? 'TERMS HAVE BEEN UPDATED' : 'HORNS UP. EGO OUT.', 31, 62, 12, CREAM, 'left', 201);
  box(c, 695, 16, 247, 78, '#102219', 9, 3);
  text(c, view.phase === 'crashed' ? 'ROUND CRASHED' : 'ROUND MULTIPLIER', 927, 32, 12, '#b2c5a1', 'right');
  text(c, formatX(view.currentX100), 928, 67, 45, view.phase === 'crashed' ? RED : CREAM, 'right', 218);
  if (view.cashoutX100 !== null) {
    box(c, 626, 101, 315, 34, GREEN, 4, 3);
    text(c, `CASHED OUT ${formatX(view.cashoutX100)}`, 786, 120, 23, INK, 'center', 301);
  }
  c.fillStyle = '#0c1b16ed'; c.fillRect(0, 503, 960, 37);
  text(c, caption, 480, 523, 27, view.cashoutX100 !== null ? GREEN : CREAM, 'center', 922);
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'phonk', bpm: 145, tempoRise: 0.12, crash: 'slam', music: 0.74 });
  let previousPhase: SceneView['phase'] | null = null;
  let previousElapsed = 0;
  let previousAge = 0;
  let previousCashout: number | null = null;
  let idleStarted: number | null = null;
  let exitAt: number | null = null;
  let exitFrom: BullPose | null = null;
  let lastStep = -1;
  let lastIdle = 0;
  let surface: HTMLCanvasElement | null = null;

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const running = view.phase === 'running', crashed = view.phase === 'crashed';
    const idle = !running && !crashed;
    const seconds = Math.max(0, view.elapsed / 1000);
    const age = crashed ? Math.max(0, view.crashAge / 1000) : 0;
    const secured = view.cashoutX100 !== null;
    const reset = seconds < previousElapsed || idle && view.phase !== previousPhase;
    const fresh = previousPhase === null || reset;
    if (idleStarted === null || reset) idleStarted = now;
    const idleTime = Math.max(0, (now - idleStarted) / 1000);
    if (reset) { exitAt = null; exitFrom = null; lastStep = -1; previousCashout = null; }
    const r = routineAt(seconds, reduced);
    const basePose = idle ? idlePose(idleTime, reduced) : runningPose(seconds, reduced, r);
    if (secured && previousCashout === null) {
      exitAt = fresh || crashed ? seconds - 2 : seconds;
      exitFrom = { ...basePose };
      if (!fresh && running) { audio.cashout(); audio.fx('airhorn', 0.35); }
    }
    if (!secured) { exitAt = null; exitFrom = null; }
    const tension = clamp(Math.log2(Math.max(1, view.currentX100 / 100)) / 10);
    audio.update(view.phase, tension);
    if (crashed && previousPhase !== 'crashed') {
      const quiet = fresh || age > 1.5;
      audio.crash('slam', quiet);
      if (!quiet) { audio.fx('clang', 0.7); audio.fx('gasp', 0.4); }
    }
    if (running && !fresh && !secured) {
      const contactAt = r.index * BEAT_SECONDS + CONTACT;
      if (seconds >= contactAt && previousElapsed < contactAt) {
        audio.fx(r.kind === 2 || r.kind === 5 ? 'whoosh' : 'punch', 0.6);
        audio.fx(r.kind === 1 ? 'squeak' : r.kind === 4 ? 'splash' : 'clang', 0.36);
        audio.fx('crowd', 0.29);
      }
      const step = Math.floor(basePose.stride * 2);
      if (step !== lastStep && basePose.gait !== 'air') audio.fx('stomp', 0.13 + tension * 0.08);
      lastStep = step;
    }
    if (crashed && !fresh && !secured && previousAge < 1.22 && age >= 1.22) audio.fx('phone', 0.5);
    const idleStomp = Math.floor((idleTime + 3.65) / 7.2);
    if (idle && !fresh && idleStomp !== lastIdle) audio.fx('stomp', 0.25);
    lastIdle = idleStomp;

    const clock = idle ? idleTime : seconds + (crashed ? age : 0);
    const motion = reduced ? 0 : clock;
    const exit = secured ? reduced ? 1 : ease((seconds - (exitAt ?? seconds - 2) + age) / 1.1) : 0;
    let pose = basePose;
    if (secured) {
      const from = exitFrom ?? basePose;
      pose = {
        ...from, x: mix(from.x, 737, exit), y: mix(from.y, 409, exit) - (reduced ? 0 : Math.sin(exit * Math.PI) * 81),
        scale: mix(from.scale, 0.79, exit), body: -4, pitch: -0.04 + (reduced ? 0 : Math.sin(motion * 5) * 0.035),
        head: reduced ? -0.13 : -0.14 + Math.sin(motion * 4) * 0.11,
        stride: 0, gait: exit < 1 ? 'air' : 'idle', tuck: 0.7, face: 'victory', snort: 0,
        rear: exit === 1 ? reduced ? 0.6 : 0.45 + Math.sin(motion * 4) * 0.3 : 0,
        time: motion,
      };
    } else if (crashed) {
      const launch = reduced ? 1 : ease((age - 0.23) / 1.03);
      const flight = reduced ? 0 : Math.sin(launch * Math.PI);
      pose = {
        ...basePose, x: mix(basePose.x, 655, launch), y: mix(basePose.y, 453, launch) - flight * 63,
        scale: mix(basePose.scale, 0.81, launch), body: -5,
        pitch: flight * -0.6, head: launch >= 1 ? 0.08 + (reduced ? 0 : Math.sin(age * 4) * 0.075) : -0.2,
        stride: 0, gait: launch >= 1 ? 'sit' : 'air', tuck: 0.8, face: launch >= 1 ? 'support' : 'panic', snort: 0, rear: 0,
        time: motion,
      };
    }
    const caption = secured ? crashed ? 'YOU LEFT. THEY OPENED A TICKET.' : 'LEFT THE CHAT. LET THEM COPE.' : crashed ? age < 1.25 ? 'THE TERMS WERE IN THE FINE PRINT.' : 'HAVE YOU TRIED NOT BEING REKT?' : idle ? 'BEARS HAVE A PODCAST. MUMU HAS HORNS.' : actCaption(r);
    const encounter = secured ? 'VICTORY PARADE' : crashed ? 'UNPAID SUPPORT INTERNSHIP' : idle ? 'THE HERD IS GETTING LOUD' : actTitle(r);
    const framing: Framing = { x: pose.x + (secured ? 4 : crashed ? 32 : 19), y: pose.y, opponentX: secured ? 768 : crashed ? 697 : idle ? 782 : r.propX, opponentY: secured ? 432 : crashed ? 435 : idle ? 405 : floorAt(r.propX), caption, encounter };

    const drawWorld = (ctx: CanvasRenderingContext2D, close = false): void => {
      ctx.save();
      const contactAge = r.age - CONTACT;
      const kick = reduced || secured ? 0 : crashed ? Math.exp(-age * 7) : running && contactAge >= 0 && contactAge < 0.35 ? Math.exp(-contactAge * 12) * 0.45 : 0;
      if (kick > 0.005) {
        ctx.translate(430, 300); ctx.scale(1 + kick * 0.025, 1 + kick * 0.025); ctx.translate(-430, -300);
        ctx.translate(Math.sin(clock * 83) * kick * 6, Math.cos(clock * 67) * kick * 3);
      }
      arena(ctx, motion, r.lap, reduced);
      track(ctx, reduced ? 0 : idle ? idleTime * 0.04 : seconds, crashed, age, reduced);
      if (idle) idleBear(ctx, idleTime, reduced);
      else if (!crashed) drawAct(ctx, r, reduced ? 0 : seconds, reduced);
      if (crashed) {
        crashStamp(ctx, age, reduced);
        if (!secured) supportDesk(ctx, age, reduced, false);
      }
      if (secured) parade(ctx, motion, exit, reduced, false);
      if (!reduced && !secured && !crashed) dust(ctx, motion, pose.x, floorAt(pose.x), idle ? 0.35 : 0.85);
      bull(ctx, pose);
      if (secured) parade(ctx, motion, exit, reduced, true);
      if (crashed && !secured) {
        supportDesk(ctx, age, reduced, true);
        impact(ctx, 417, 437, age - 0.23, reduced, 'AGREED!');
        if (age >= 1.27) bubble(ctx, 670, 186, 'PLEASE HOLD. FOREVER.', 306, CREAM);
      }
      if (running && !secured) impact(ctx, 534, floorAt(534) - 14, contactAge, reduced, r.kind === 2 ? 'MISS!' : r.kind === 5 ? 'NOPE!' : r.kind === 1 ? 'RATIO!' : 'BONK!');
      if (idle && !reduced) impact(ctx, pose.x + 83, floorAt(pose.x + 83), idleTime % 7.2 - 3.55, false, 'STILL HERE!');
      ctx.restore();
      if (!close) hud(ctx, view, r, caption);
    };

    if (isPortrait(c.canvas) && typeof document !== 'undefined') {
      surface ??= Object.assign(document.createElement('canvas'), { width: 960, height: 540 });
      const stage = surface.getContext('2d');
      if (stage) {
        stage.setTransform(1, 0, 0, 1, 0, 0); drawWorld(stage, true);
        presentPortrait(c, surface, view, framing);
      } else drawWorld(c);
    } else drawWorld(c);
    previousPhase = view.phase; previousCashout = view.cashoutX100; previousElapsed = seconds; previousAge = age;
  }
  return { draw };
}
