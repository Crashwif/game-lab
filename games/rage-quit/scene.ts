import { pageAudio } from './audio';
import { actAt, actorAt, type ActingInput } from './acting';
import { drawActorBack, drawActorFront } from './actor';
import { box, clamp, GOLD, GREEN, INK, label, mono, PAPER, RED } from './ink';
import { portrait } from './portrait';
import { drawBackground, drawDesk, drawForeground, drawProps } from './room';

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

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion ?? false;
  const audio = pageAudio({ style: 'hardstyle', crash: 'slam', bpm: 138, tempoRise: 0.12, music: 0.55 });
  let previousPhase: SceneView['phase'] | null = null;
  let previousCashout: number | null = null;
  let previousElapsed = 0;
  let previousCrashAge = 0;
  let previousAct = -1;
  let previousContact = -1;
  let exitAt = -Infinity;

  function render(c: CanvasRenderingContext2D, view: SceneView, now: number, close: boolean): string {
    const running = view.phase === 'running';
    const dead = view.phase === 'crashed';
    const safe = view.cashoutX100 !== null;
    const fresh = previousPhase === null;
    if (safe && previousCashout === null) {
      exitAt = fresh || !running ? -Infinity : now;
      if (!fresh && running) audio.cashout();
    }
    if (!safe) exitAt = -Infinity;
    // Heat changes expression and effort, and contains no information about a future result.
    const heat = clamp(Math.log2(Math.max(100, view.currentX100) / 100) / 8);
    const input: ActingInput = {
      phase: view.phase, elapsed: Math.max(0, view.elapsed) / 1000,
      crashAge: dead && reduced ? 4 : Math.max(0, view.crashAge) / 1000 * 1.55, clock: now / 1000,
      heat, safe, exitAge: Math.max(0, (now - exitAt) / 1000), reduced,
    };
    const act = actAt(input);
    const p = actorAt(input, act);
    audio.update(view.phase, safe ? heat * 0.25 : 0.2 + heat * 0.8);
    if (dead && previousPhase !== 'crashed') audio.crash('slam', fresh || view.crashAge > 1500);
    const continuous = !fresh && view.elapsed >= previousElapsed && view.elapsed - previousElapsed < 1500;
    const contact = Math.floor(input.elapsed * (1.15 + Math.min(heat, 0.8) * 0.4) * 2 - 0.1);
    if (running && continuous && !safe) {
      if (previousAct !== act.number && previousPhase === 'running') audio.fx(act.index === 4 ? 'creak' : act.index === 3 ? 'ratchet' : 'notify', 0.5);
      if (previousContact !== contact && [0, 7].includes(act.index)) audio.fx('thud', 0.22);
    }
    if (dead && previousPhase === 'crashed' && view.crashAge - previousCrashAge < 1500) {
      if (previousCrashAge < 665 && view.crashAge >= 665) audio.fx('shatter', 0.8);
      if (previousCrashAge < 1160 && view.crashAge >= 1160) audio.fx('bell', 0.5);
    }
    previousPhase = view.phase; previousCashout = view.cashoutX100;
    previousElapsed = view.elapsed; previousAct = act.number;
    previousContact = contact; previousCrashAge = view.crashAge;

    const caption = safe ? 'UNPLUGGED. UNBOTHERED. STILL SMUG.' : dead ? input.crashAge < 1.8 ? 'CTRL + ALT + DELUSION.' : 'NO REFUNDS FOR EMOTIONAL DAMAGE.' : running ? act.caption : view.phase === 'betting' ? 'CLOCK IN. LOSE YOUR SHIT.' : 'ANOTHER DAY IN THE COPE CAVE.';
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.save();
    if (!reduced) {
      const kick = dead ? Math.exp(-input.crashAge * 2.3) * 13 : running && !safe ? act.impact * 2 : 0;
      c.translate(Math.sin(input.crashAge * 57) * kick, dead ? Math.cos(input.crashAge * 41) * kick : kick);
    }
    drawBackground(c, input, act);
    if (!safe) drawActorBack(c, p, input, act);
    drawDesk(c, input, act, p);
    if (safe) drawActorBack(c, p, input, act);
    drawActorFront(c, p, input, act);
    drawProps(c, input, act);
    drawForeground(c, input, act, p);
    c.restore();
    if (!close) {
      c.fillStyle = INK; c.fillRect(0, 0, 960, 92);
      label(c, 'RAGE QUIT', 22, 22, 22, RED, 227);
      label(c, caption, 23, 60, 27, PAPER, 683);
      label(c, formatX(view.currentX100), 940, 43, 51, dead ? GOLD : PAPER, 231, 'right');
      mono(c, dead ? 'ROUND CRASHED' : running ? 'ROUND RUNNING' : view.phase === 'betting' ? 'JOIN ROUND' : 'WAITING', 934 - 200, 77, 12, PAPER, 201);
      if (safe) {
        box(c, 338, 473, 387, 45, GREEN, 4);
        label(c, `CASH-OUT CONFIRMED · ${formatX(view.cashoutX100!)}`, 531, 496, 21, INK, 367, 'center');
      }
    }
    c.restore();
    return caption;
  }
  return { draw: portrait(render) };
}
