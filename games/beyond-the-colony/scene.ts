import { pageAudio } from './audio';
import { herd, setpiece } from './actors';
import { perform } from './choreography';
import { balloon, box, burst, GOLD, INK, JADE, polygon, WHITE, words } from './drawing';
import { avalanche, cloudSeat, floes, impactSnow, office, sky, weather } from './landscape';
import { actAt, between, clamp, recoil, smooth, TAU } from './motion';
import { penguin, type PenguinPose } from './penguin';
import { portrait } from './portrait';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number; elapsed: number; crashAge: number;
  stake: number | null; cashoutX100: number | null; payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean }
export interface Scene { draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void }
const formatX = (x100: number): string => `${(x100 / 100).toFixed(2)}×`;
const CUES = ['crowd', 'engine', 'clang', 'beep', 'hiss', 'airhorn', 'phone', 'gasp'] as const;

function caption(view: SceneView): string {
  if (view.cashoutX100 !== null) return view.phase === 'crashed' ? 'HR CANNOT REACH ME HERE.' : 'NO NOTICE. NO EXIT INTERVIEW.';
  if (view.phase === 'crashed') return view.crashAge < 1000 ? 'THE MOUNTAIN HAS HAD ENOUGH.' : 'FREEDOM CANCELLED. BACK TO WORK.';
  if (view.phase === 'waiting') return 'I WAS NOT BUILT FOR THIS HUDDLE.';
  if (view.phase === 'betting') return 'ONE LITTLE BIRD. ZERO FUCKS.';
  return actAt(view.elapsed / 1000).title;
}

function hud(c: CanvasRenderingContext2D, view: SceneView): void {
  const shade = c.createLinearGradient(0, 0, 0, 103); shade.addColorStop(0, 'rgba(2,19,32,.94)'); shade.addColorStop(1, 'rgba(2,19,32,0)');
  c.fillStyle = shade; c.fillRect(0, 0, 960, 105);
  words(c, 'BEYOND THE COLONY', 24, 29, 29, WHITE, 493, 'left');
  words(c, 'NIETZSCHEAN PENGUIN · FREE WILL SIMULATOR', 25, 58, 13, '#acc8bb', 509, 'left');
  words(c, formatX(view.currentX100), 935, 38, 57, view.phase === 'crashed' ? GOLD : JADE, 327, 'right', true);
  words(c, view.phase === 'crashed' ? 'ROUND CRASHED' : view.phase === 'running' ? 'ROUND RUNNING' : view.phase === 'betting' ? 'JOIN THE WALKOUT' : 'WAITING FOR A ROUND', 934, 79, 13, WHITE, 326, 'right');
  const bottom = c.createLinearGradient(0, 466, 0, 540); bottom.addColorStop(0, 'rgba(4,24,36,0)'); bottom.addColorStop(.3, 'rgba(4,24,36,.87)'); bottom.addColorStop(1, '#041824');
  c.fillStyle = bottom; c.fillRect(0, 466, 960, 74);
  words(c, caption(view), 480, 493, 33, view.cashoutX100 !== null ? JADE : WHITE, 914, 'center', true);
  const detail = view.cashoutX100 !== null ? `CASHED OUT AT ${formatX(view.cashoutX100)} · ABSOLUTELY UNAVAILABLE` : view.phase === 'crashed' ? 'YOUR EXIT INTERVIEW HAS BEEN CONVERTED INTO A SHIFT.' : view.phase === 'running' ? actAt(view.elapsed / 1000).subtitle : 'A MEETING INVITE IS NOT A REASON TO LIVE.';
  words(c, detail, 480, 526, 16, view.cashoutX100 !== null ? JADE : '#bfd5ca', 914);
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'dnb', bpm: 144, tempoRise: .18, music: .5, crash: 'shatter' });
  let previousPhase: SceneView['phase'] | null = null;
  let previousElapsed = 0;
  let previousCashout: number | null = null;
  let secureEntry: { at: number; pose: PenguinPose } | null = null;
  let heroX = 437;

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number, close = false): void {
    const running = view.phase === 'running'; const crashed = view.phase === 'crashed'; const safe = view.cashoutX100 !== null;
    const seconds = Math.max(0, view.elapsed) / 1000;
    const age = crashed ? Math.max(0, view.crashAge) / 1000 : 0;
    const active = running || crashed;
    const clock = active ? seconds + age : now / 1000;
    const liveTime = reduced ? 0 : clock;
    const performance = perform(seconds, active, now / 1000, reduced);
    const act = performance.act;
    let p = { ...performance.pose };
    const reset = view.elapsed < previousElapsed || (!active && previousPhase !== view.phase);
    const fresh = previousPhase === null || reset;
    if (reset) secureEntry = null;
    const tension = clamp(Math.log2(Math.max(100, view.currentX100) / 100) / 10);
    audio.update(view.phase, safe ? tension * .2 : tension);
    if (safe && (previousCashout === null || reset)) {
      secureEntry = fresh ? null : { at: now, pose: { ...p } };
      if (!fresh) { audio.cashout(); audio.fx('whoosh', .6); }
    }
    if (!safe) secureEntry = null;
    if (crashed && previousPhase !== 'crashed') {
      const quiet = fresh || age > 1.5;
      audio.crash('shatter', quiet); if (!quiet) audio.fx('boom', .55);
    }
    const continuous = !fresh && previousPhase === 'running' && running && view.elapsed >= previousElapsed && view.elapsed - previousElapsed < 600;
    if (continuous && !safe) {
      const before = actAt(previousElapsed / 1000);
      if (before.index !== act.index) audio.fx(CUES[act.kind]!, .32);
      for (const cue of [1.4, 2.15, 3.3, 5.8]) {
        if (before.index === act.index && before.age < cue && act.age >= cue) {
          const fx = act.kind === 1 ? 'squeak' : act.kind === 2 ? cue === 3.3 ? 'punch' : 'thud' : act.kind === 4 ? 'creak' : act.kind === 5 ? 'zap' : act.kind === 7 ? 'gasp' : 'whoosh';
          audio.fx(fx, cue === 2.15 || cue === 3.3 ? .42 : .25);
        }
      }
      if (Math.floor(performance.pose.gait * 2) !== Math.floor(perform(previousElapsed / 1000, true, now / 1000, reduced).pose.gait * 2) && p.walk) audio.fx('stomp', .13);
    }
    previousPhase = view.phase; previousCashout = view.cashoutX100; previousElapsed = view.elapsed;

    c.save();
    sky(c, liveTime, act.tier, reduced);
    const hit = reduced ? 0 : crashed ? Math.exp(-age * 4) * 9 : act.kind === 2 ? Math.abs(recoil(act.age - 2.15, 5)) : 0;
    c.save(); c.translate(Math.sin(liveTime * 68) * hit, Math.cos(liveTime * 73) * hit);
    herd(c, liveTime, act, running && !safe, reduced);
    if (running && !safe) setpiece(c, liveTime, act, reduced);
    else if (!active) {
      balloon(c, view.phase === 'betting' ? 'YOU COMING OR WHAT?' : 'IS THIS ALL THERE IS?', 504, 162, 315, WHITE, 25);
      box(c, 725, 360, 163, 61, '#e9dcb1', 2, 4); words(c, 'FORBIDDEN', 806, 378, 20, INK, 149); words(c, 'MOUNTAIN →', 806, 402, 19, INK, 149);
    }
    floes(c, performance.travel, liveTime, performance.sag, crashed ? age : null, reduced);

    if (crashed && !safe) {
      if (age < 1.06 && !reduced) {
        const tumble = smooth((age - .13) / .84);
        p.x += Math.sin(tumble * Math.PI) * 115;
        p.y -= Math.sin(tumble * Math.PI) * 83 - tumble * 61;
        p.angle += tumble * TAU * 1.35;
        p.walk = false; p.airborne = true; p.arm = 1.8; p.mood = 'panic'; p.time = seconds + age;
      } else {
        office(c, age, reduced);
        p = { ...p, x: 458, y: 473, scale: .91, time: reduced ? 0 : seconds + age, angle: 0, walk: false, airborne: false, crouch: 0, stretch: 0, arm: -.25, head: -.4, mood: 'dazed', paper: false, look: -1, scarf: 0 };
      }
    }
    if (!safe) {
      penguin(c, p);
      if (!crashed && !reduced) impactSnow(c, p.x, 429, performance.landAge, 1.1);
      if (running && act.kind === 2 && act.age > 3.2 && act.age < 3.65) { burst(c, 634, 315, 58, GOLD); words(c, 'DECLINED', 634, 315, 21, INK, 101); }
      if (crashed && (age >= 1.06 || reduced)) {
        polygon(c, [[268, 424], [634, 423], [666, 457], [244, 457]], '#f0d8a5', 4);
        words(c, 'WELCOME BACK, CHAMP.', 461, 201, 31, GOLD, 681, 'center', true);
        if (!reduced) impactSnow(c, 477, 449, age - 1.06, 1.6);
      }
    }
    if (crashed) avalanche(c, age, reduced);
    c.restore();

    if (safe) {
      const q = reduced || !secureEntry ? 1 : smooth((now - secureEntry.at) / 850);
      const from = secureEntry?.pose ?? p;
      const bob = reduced ? 0 : Math.sin(liveTime * 2.5) * 7;
      c.save(); c.globalAlpha = clamp(q * 2); cloudSeat(c, 732, 411 + bob, liveTime, reduced); c.restore();
      p = {
        ...p, x: from.x + (713 - from.x) * q,
        y: from.y + (403 + bob - from.y) * q - (reduced ? 0 : Math.sin(q * Math.PI) * 69),
        scale: 1.12 - q * .27, angle: from.angle * (1 - q) - q * .15,
        mood: 'smug', airborne: q < 1, walk: false, arm: q < 1 ? 1.4 : -.2, head: -.25,
        time: liveTime, scarf: .2, crouch: 0, stretch: 0, paper: q >= 1,
      };
      penguin(c, p);
      if (q >= 1) words(c, 'DO NOT DISTURB MY NOTHING.', 697, 135, 24, GOLD, 471, 'center', true);
    }
    if (!reduced) weather(c, liveTime, safe ? .1 : performance.gale);
    if (!close) hud(c, view);
    heroX = p.x;
    c.restore();
  }
  return { draw: portrait(draw, () => heroX, caption) };
}
