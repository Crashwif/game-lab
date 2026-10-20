/**
 * Composes the street, Memo, the ladder of threats, the cone, the exit, the raid and the HUD from the
 * displayed multiplier, the clocks and the confirmed exit. main.ts supplies verified round state and
 * handles player intents through the SDK; this scene only presents that state and never chooses when a
 * round crashes.
 */
import { type Effect, pageAudio } from './audio';
import { INK, box, clamp, ease, glow, line, noise, oval, plain, shape, stamp, text } from './drawing';
import { type Input, createInput } from './input';
import { ALLY_UNSEEN, BETTING_CAPTION, BSOD, CAPTIONS, CONE_BUBBLES, EXIT_BUBBLES, HIGH_BUBBLES, HINT, METER, MOW_BUBBLES, NOTE, OVERTIME_BUBBLES, OVERTIME_CAPTIONS, PHONE, RUN_BUBBLES, SCARE_BUBBLE, SPOTTED, SUBTITLE, TITLE, UNSEEN, WAITING_CAPTION, crashCaption, relief } from './lines';
import { allyHides, createAlly, drawAllyFront, drawAllyGround, resetAlly, startAlly, stepAlly } from './ally';
import { EXIT, GROUND, HERO_X, type MemoDrive, type MemoMode, type MemoPose, type Point, createMemo, drawBlower, drawMemo, dropBlower, resetMemo, settleMemo, stepMemo, stumble } from './memo';
import { mulberry32, settleSpring, spring, stepSpring } from './motion';
import { createPortrait } from './portrait';
import { RAID, drawBsod, drawGlitch, drawRaid } from './raid';
import { type Stash, dripFor, loadStash, rankFor, saveStash } from './stash';
import { collectBills, createStreet, drawAsphalt, drawBills, drawFacades, drawFar, drawLeaves, drawNote, drawParked, drawSidewalk, drawSky, drawSpills, resetStreet, settleStreet, spill, stepStreet } from './street';
import { type Env, type Kind, type Layer, LADDER, OVERTIME_EVERY, OVERTIME_KINDS, OVERTIME_START, drawThreat, gazing, spanOf, sweepDone } from './threats';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** 150 means 1.50×. This is the final multiplier after a crash. */
  currentX100: number;
  /** Milliseconds since the round started running; held at the crash time. */
  elapsed: number;
  /** Milliseconds since the crash, for the ending animation. */
  crashAge: number;
  /** The player's stake in valueless credits, or null when watching. */
  stake: number | null;
  /** Non-null only after the backend confirms this player's cash-out. */
  cashoutX100: number | null;
  payout: number | null;
}
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose(): void;
}

const RUNGS = [1.5, 2, 3, 5, 10, 25];
/** The beats that make a sound, at the multiplier that shows them. */
const CUES: [number, Effect, number][] = [
  [1.55, 'engine', 0.5], [1.8, 'click', 0.3], [2.05, 'whoosh', 0.4], [2.4, 'siren', 0.3], [2.62, 'engine', 0.6], [2.85, 'beep', 0.5], [3.3, 'scream', 0.3],
  [3.9, 'engine', 0.7], [4.6, 'whistle', 0.4], [5.4, 'squeak', 0.5], [6.3, 'crowd', 0.4], [7.5, 'zap', 0.5], [9, 'notify', 0.6], [11, 'bell', 0.4], [14, 'ding', 0.5], [18, 'punch', 0.3],
];
/** The frozen beat when the van lands, in seconds. */
const HIT_STOP = 0.16;
/** A live crash finishes on the scene's own clock through the next betting phase, so the blue screen lands even when the room moves on quickly; bounded by ENCORE_MAX. */
const ENDING_S = 5.2;
const ENCORE_MAX = 4.2;
/** How long one press keeps him under the cone. */
const CONE_S = 1.15;
const SPEED = { base: 170, tension: 230, depth: 60 };

/** Once the player has ducked on this page, the bot stays out of it, scene after scene. */
let playerSteers = false;
let rounds = 0;
/** What a recreated scene mid-round takes back, if its clock agrees with the wall. */
let live: { stacked: number; scroll: number; elapsed: number; wall: number } | null = null;
const mode = () => (typeof document === 'undefined' ? 'standalone' : document.documentElement.dataset.mode ?? 'standalone');
const seedFor = (): number => (mode() === 'replay' ? 1 : (Date.now() ^ Math.imul(rounds + 1, 2654435761)) >>> 0);

interface Sweep { kind: Kind; born: number; look: number; coned: number; ally: number; verdict: 'unseen' | 'spotted' | null; verdictAt: number; botAt: number; botFor: number; botAlly: boolean; botDone: boolean }
interface Verdict { word: string; good: boolean; born: number }
interface Active { key: string; kind: Kind; age: number; span: number }

export function createScene(): Scene {
  const { capture, present } = createPortrait(TITLE, [80, 180, 500, 320], '#ffd166');
  const audio = pageAudio({ style: 'phonk', crash: 'static', music: 0.6, effects: 0.85 });
  const canvasEl = typeof document !== 'undefined' ? document.querySelector('canvas') : null;
  const input: Input | null = canvasEl ? createInput(canvasEl, () => { playerSteers = true; }) : null;
  const memo = createMemo();
  const ally = createAlly();
  const street = createStreet();
  const stash: Stash = loadStash();
  const pace = spring(0);
  const sweeps = new Map<string, Sweep>();
  const verdicts: Verdict[] = [];
  let rng = mulberry32(seedFor());
  let disposed = false;
  let previous: SceneView['phase'] | null = null;
  let lastElapsed = 0;
  let lastNow: number | null = null;
  /** Ambient motion runs on its own integrated clock, which stands still through the frozen beat. */
  let clock = 0;
  let cashed = false;
  let banked = 0;
  let stacked = 0;
  let lastRung = -1;
  let lastCue = -1;
  let heartbeat = 0;
  let coneUntil = -1;
  let stepClock = -1;
  let hintUntil = 10;
  let raidLive = false;
  let staticCued = false;
  let raidCue = 0;
  let exitCue = 0;
  let heroHead: Point = { x: HERO_X + 6, y: GROUND - 132 };
  let nozzle: Point | null = null;
  let lastPose: MemoPose | null = null;
  /** The last crash frame, dissolved into the next betting phase so the reset never pops. */
  let snap: HTMLCanvasElement | null = null;
  let dissolve = 0;
  let tear: HTMLCanvasElement | null = null;
  /** The crash as last seen, replayed through the encore. */
  let crashClock = 0;
  let encore = false;
  let encoreAge = 0;
  let held: SceneView | null = null;

  function reset(): void {
    cashed = false; banked = 0; stacked = 0; lastRung = -1; lastCue = -1; heartbeat = 0; coneUntil = -1; stepClock = -1;
    raidLive = false; staticCued = false; raidCue = 0; exitCue = 0;
    sweeps.clear(); verdicts.length = 0;
    rounds += 1; rng = mulberry32(seedFor());
    resetMemo(memo); resetStreet(street); resetAlly(ally); settleSpring(pace, 0);
    nozzle = null; lastPose = null; live = null;
  }

  const copy = (c: CanvasRenderingContext2D, into: HTMLCanvasElement | null): HTMLCanvasElement | null => {
    if (typeof document === 'undefined') return null;
    const target = into ?? document.createElement('canvas');
    if (target.width !== c.canvas.width || target.height !== c.canvas.height) { target.width = c.canvas.width; target.height = c.canvas.height; }
    const t = target.getContext('2d'); if (!t) return null;
    t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, target.width, target.height); t.drawImage(c.canvas, 0, 0);
    return target;
  };

  function hud(c: CanvasRenderingContext2D, view: SceneView, cap: string, bubble: string, time: number, exited: boolean, running: boolean, crashed: boolean, showMemo: boolean, memoMode: MemoMode, tension: number, help: number): void {
    const cash = view.cashoutX100;
    const top = c.createLinearGradient(0, 0, 0, 160); top.addColorStop(0, '#141a2aee'); top.addColorStop(1, '#141a2a00');
    c.fillStyle = top; c.fillRect(0, 0, 960, 160);
    text(c, SUBTITLE, 27, 34, 15, '#ffd166');
    text(c, TITLE, 24, 79, 42, '#ff9f1c', 'left', 400);
    text(c, cap, 27, 106, 13, '#f6efe3', 'left', 640);
    if (running && !exited && time < hintUntil && !playerSteers) { c.save(); c.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4); text(c, HINT, 27, 128, 11, '#9fe3ff', 'left', 400); c.restore(); }
    box(c, 733, 22, 203, 91, '#232b3fdb', 16, 2);
    text(c, crashed ? (cash !== null ? 'DODGED AT' : 'CAUGHT AT') : running ? (cash !== null ? 'GONE HOME AT' : 'ON THE RUN') : 'READY TO RUN', 834, 44, 11, '#cdd3e0', 'center');
    text(c, `${((crashed || running ? (cash ?? view.currentX100) : view.currentX100) / 100).toFixed(2)}×`, 834, 92, 45, crashed && cash === null ? '#ff8b90' : cash !== null ? '#9ee8b5' : '#ffd166', 'center', 175);
    if (cash !== null) {
      box(c, 262, 124, 436, 43, '#245847', 12, 3);
      text(c, `SELF-DEPORTED AT ${(cash / 100).toFixed(2)}× · SENT HOME $${banked * 100}`, 480, 152, 18, '#d8f4ad', 'center', 410);
    } else if (running && showMemo) {
      c.save(); c.translate(memo.x + 68, GROUND - 150 + Math.sin(time * 2) * 2 + (memoMode === 'cone' ? 44 : 0) + (memoMode === 'mow' ? -52 : 0));
      box(c, -8, -21, 190, 38, '#fcf0c9', 12, 3);
      c.fillStyle = INK; c.font = 'bold 13px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText(bubble, 87, 3, 174);
      line(c, [[-2, 14], [-18, 26], [8, 16]], INK, 2); c.restore();
    }
    if (running && showMemo && !exited) {
      const tag = view.stake !== null ? 'YOUR GUY' : 'WATCHING';
      c.save(); c.translate(memo.x + 2, GROUND - 200 + Math.sin(time * 3) * 3 + (memoMode === 'cone' ? 56 : 0));
      box(c, -42, -16, 84, 22, view.stake !== null ? '#ffd166' : '#8a93a6', 6, 2); text(c, tag, 0, 1, 11, '#fff5d7', 'center', 76);
      shape(c, [[-6, 6], [6, 6], [0, 14]], view.stake !== null ? '#ffd166' : '#8a93a6', 2); c.restore();
    }
    box(c, 19, 507, 300, 23, '#25304a', 6, 2);
    text(c, `STACKED $${stacked * 100} · SENT HOME $${stash.sent * 100} · ${rankFor(stash.sent)}`, 169, 522, 10, '#e7ecb2', 'center', 290);
    // The fake outrage index: both needles pinned, help at nothing, sponsored.
    const lo = Math.min(100, Math.round(62 + 38 * tension + 4 * Math.sin(time * 1.7)));
    const ro = Math.min(100, Math.round(60 + 40 * tension + 4 * Math.sin(time * 1.3 + 2)));
    box(c, 556, 470, 380, 36, '#141a2add', 8, 2);
    plain(c, METER.title, 746, 481, 7, '#cdd3e0', 'center', 'system-ui, sans-serif', 800);
    const bars: [string, number, string][] = [[METER.left, lo, '#4a8fd1'], [METER.right, ro, '#e63946'], [METER.help, help, '#57b57b']];
    bars.forEach(([label, value, color], i) => {
      const bx = 566 + i * 124;
      plain(c, `${label} ${value}%`, bx, 497, 7, '#ffffff', 'left', 'system-ui, sans-serif', 800);
      box(c, bx + 66, 490, 50, 8, '#2b3350', 2, 0); box(c, bx + 66, 490, Math.max(1, 50 * value / 100), 8, color, 2, 0);
    });
    text(c, 'FREE PLAY · VALUELESS CREDITS', 938, 527, 10, '#faf0d8', 'right');
  }

  function draw(c: CanvasRenderingContext2D, given: SceneView, now: number): void {
    if (disposed) return;
    const delta = lastNow === null ? 0 : Math.max(0, (now - lastNow) / 1000);
    const real = Math.min(0.1, delta);
    // The encore: a raid the room cut short keeps playing in real time, then the street resets for the new round.
    if (encore) {
      encoreAge += real; crashClock += real;
      if (given.phase === 'running' || given.phase === 'crashed' || encoreAge >= ENCORE_MAX || crashClock >= ENDING_S) {
        encore = false; held = null; if (snap) dissolve = 1; reset(); lastElapsed = 0;
        previous = given.phase === 'betting' || given.phase === 'waiting' ? given.phase : 'betting';
      }
    } else if (given.phase === 'crashed') { crashClock = given.crashAge / 1000; held = { ...given }; }
    if (!encore && previous === 'crashed' && (given.phase === 'betting' || given.phase === 'waiting') && held && raidLive && crashClock < ENDING_S) { encore = true; encoreAge = 0; }
    const view: SceneView = encore && held ? { ...held, crashAge: crashClock * 1000 } : given;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    if (view.phase === 'betting' && previous === 'crashed' && snap) dissolve = 1;
    if ((view.phase === 'betting' && previous !== 'betting') || (running && view.elapsed < lastElapsed - 50)) reset();
    const seen = previous !== null && delta < 0.3;
    const cash = view.cashoutX100;
    const exited = cash !== null;
    const x = running || crashed ? Math.max(1, view.currentX100 / 100) : 1;
    const lnx = Math.log(x);
    const elapsedS = view.elapsed / 1000;
    // Seconds since the multiplier passed `at` (negative before), from the round's own clock and curve, so replay and late entry agree.
    const since = (at: number) => (lnx > 1e-4 ? elapsedS * (1 - Math.log(at) / lnx) : -1);
    // 0.33 at 1.5x, 0.5 at 2x, 0.67 at 3x: the music, his nerves, his pace and the heartbeat all follow it.
    const tension = 1 - 1 / x;
    const depth = clamp(Math.log10(x) / 3);
    const bustAge = crashed ? Math.max(0, view.crashAge / 1000) : -1;
    const raidAge = crashed ? bustAge - HIT_STOP : -1;
    const caught = crashed && !exited;
    const frozen = caught && bustAge < HIT_STOP;
    const dt = frozen ? 0 : real;
    if (!frozen) clock += real;
    const time = clock;
    const exitAge = !exited ? -1 : Math.max(0, since(cash / 100) + (crashed ? bustAge : 0));
    const drip = dripFor(stash.sent);

    if (exited && !cashed) {
      cashed = true; banked = stacked;
      if (seen && running) audio.cashout();
      if (!fresh && mode() !== 'replay' && view.stake !== null && stacked > 0) { stash.sent += stacked; stash.best = Math.max(stash.best, stacked); stash.rounds += 1; saveStash(stash); }
    }
    audio.update(view.phase, tension);
    if (crashed && previous !== 'crashed') {
      const late = bustAge > 0.4 || fresh;
      raidLive = !late;
      if (exited) audio.crash('siren', late);
      else if (late) { audio.crash('static', true); staticCued = true; }
      else { audio.fx('siren', 0.5); audio.fx('engine', 0.8); audio.fx('hiss', 0.5); }
      if (!memo.blower.off && !exited) dropBlower(memo, memo.x + 26, GROUND - 60, late);
    }
    if (caught && !staticCued && raidAge >= RAID.bsod) { staticCued = true; audio.crash('static', !raidLive); }
    if (crashed && raidLive && seen) {
      const beats: [number, Effect, number][] = caught ? [[RAID.door, 'door', 0.6], [RAID.tackle, 'punch', 0.8], [RAID.tackle + 0.05, 'thud', 0.6], [RAID.stamp, 'thud', 0.7], [RAID.slam, 'door', 0.9], [RAID.go, 'engine', 0.9], [RAID.glitch, 'buzz', 0.8]] : [[RAID.door, 'door', 0.6], [RAID.stamp, 'thud', 0.6], [1.6, 'pop', 0.4]];
      while (raidCue < beats.length && raidAge >= beats[raidCue]![0]) { const [, fx, k] = beats[raidCue++]!; audio.fx(fx, k); }
    }
    if (running) {
      const rung = RUNGS.filter((v) => x >= v).length - 1;
      if (rung > lastRung && previous === 'running' && seen) audio.milestone(rung);
      lastRung = rung;
      const cue = CUES.filter(([at]) => x >= at).length - 1;
      if (cue > lastCue && previous === 'running' && seen && !exited) audio.fx(CUES[cue]![1], CUES[cue]![2]);
      lastCue = cue;
      // A heartbeat under the music once the street notices, quickening with the tension; it stops when he goes.
      if (!exited && view.stake !== null && tension > 0.2) {
        heartbeat += dt / (1.4 - 1.05 * tension);
        if (heartbeat >= 1) { heartbeat %= 1; if (seen) audio.fx('heartbeat', 0.2 + 0.3 * tension); }
      }
      if (exited && seen) {
        const beats: [number, Effect, number][] = [[EXIT.phone, 'notify', 0.6], [EXIT.tap, 'click', 0.5], [EXIT.cash, 'kaching', 0.8], [EXIT.bag, 'thud', 0.4], [EXIT.walk, 'whoosh', 0.5]];
        while (exitCue < beats.length && exitAge >= beats[exitCue]![0]) { const [, fx, k] = beats[exitCue++]!; if (!fresh) audio.fx(fx, k); }
      }
    }

    // The cone: the player's press, or the bot's.
    const cmd = input ? input.take() : { duck: false, ally: false };
    const summon = () => {
      const fee = startAlly(ally, stacked);
      stacked -= fee; coneUntil = -1;
      if (seen) { audio.fx('pop', 0.6); if (fee > 0) audio.fx('coin', 0.4); }
    };
    if (cmd.duck && running && !exited && !ally.active) { coneUntil = Math.max(coneUntil, time + CONE_S); hintUntil = 0; }
    if (cmd.ally && running && !exited && !ally.active && memo.stumble < 0) { summon(); hintUntil = 0; }
    const coned = running && !exited && !ally.active && time < coneUntil && memo.stumble < 0;
    const sheltered = running && !exited && allyHides(ally);
    const memoMode: MemoMode = exited ? 'exit' : crashed ? 'caught' : running ? (ally.active ? 'mow' : coned ? 'cone' : 'run') : 'idle';
    const speedTarget = running && !exited ? (SPEED.base + SPEED.tension * tension + SPEED.depth * depth) * (ally.active ? 0 : coned ? 0.4 : 1) : 0;
    if (fresh) settleSpring(pace, speedTarget); else stepSpring(pace, speedTarget, 7, 1, dt);
    const speed = Math.max(0, pace.x);
    const calm = crashed ? 1 - ease(bustAge / 0.3) : running ? 1 : 0;

    // A fresh scene mid-round: take the live record back if its clock agrees with the wall, else reconstruct the distance from the curve.
    if (fresh) {
      const same = live && running && view.elapsed >= live.elapsed - 250 && Math.abs(view.elapsed - live.elapsed - (Date.now() - live.wall)) < 4_000;
      let distance: number;
      if (same && live) { distance = live.scroll; stacked = live.stacked; }
      else {
        const k = lnx / Math.max(0.001, elapsedS);
        distance = lnx > 1e-4 ? (SPEED.base + SPEED.tension) * elapsedS - (SPEED.tension / k) * (1 - 1 / x) : SPEED.base * elapsedS;
        if (exited) distance = Math.min(distance, Math.max(0, distance - speedTarget * 0));
      }
      if (!(running || crashed)) distance = 0;
      settleStreet(street, distance);
    }

    // The ladder: what is on the street now, by the multiplier it arrived at; past forty seconds, by the clock.
    const active: Active[] = [];
    if ((running || crashed) && calm > 0) {
      for (const t of LADDER) { const age = since(t.at); if (age >= 0 && age < t.span) active.push({ key: `x${t.at}`, kind: t.kind, age, span: t.span }); }
      if (elapsedS >= OVERTIME_START) {
        const n0 = Math.max(0, Math.floor((elapsedS - OVERTIME_START) / OVERTIME_EVERY) - 1);
        for (let n = n0; n <= n0 + 1; n++) {
          const kind = OVERTIME_KINDS[n % OVERTIME_KINDS.length]!;
          const age = elapsedS - (OVERTIME_START + n * OVERTIME_EVERY), span = spanOf(kind);
          if (age >= 0 && age < span) active.push({ key: `o${n}`, kind, age, span });
        }
      }
    }
    let alarm = 0;
    const envs: { kind: Kind; env: Env }[] = [];
    for (const a of active) {
      let s = sweeps.get(a.key);
      if (!s) { s = { kind: a.kind, born: street.scroll - (fresh || !seen ? speed * a.age : 0), look: 0, coned: 0, ally: 0, verdict: null, verdictAt: -1, botAt: -1, botFor: 0, botAlly: false, botDone: false }; sweeps.set(a.key, s); if (fresh && a.age > 0.5) s.verdict = 'unseen', s.verdictAt = a.age - 10; }
      const env: Env = { age: a.age, travel: street.scroll - s.born, time, heroX: memo.x, heroHead, coned: clamp(memo.cone.x), verdict: s.verdict, verdictAge: s.verdict ? a.age - s.verdictAt : -1, tension, alpha: calm };
      const looking = running && !exited && !s.verdict && gazing(a.kind, env);
      if (looking) {
        s.look += dt; if (coned || sheltered) s.coned += dt; if (sheltered) s.ally += dt; alarm = 1;
        if (!playerSteers && s.botAt < 0) { const r = rng(); s.botAt = r < 0.78 ? a.age + 0.06 + rng() * 0.4 : Infinity; s.botFor = 1.0 + rng() * 0.8; s.botAlly = stacked >= 1 && rng() < 0.3; }
      }
      if (!playerSteers && !s.botDone && Number.isFinite(s.botAt) && s.botAt >= 0 && a.age >= s.botAt && running && !exited) {
        s.botDone = true;
        if (s.botAlly && !ally.active && memo.stumble < 0) summon(); else if (!ally.active) coneUntil = Math.max(coneUntil, time + s.botFor);
      }
      if (!s.verdict && s.look > 0.12 && sweepDone(a.kind, env)) {
        s.verdict = s.coned / s.look >= 0.5 ? 'unseen' : 'spotted'; s.verdictAt = a.age;
        env.verdict = s.verdict; env.verdictAge = 0;
        if (seen && !fresh && running && !exited) {
          if (s.verdict === 'spotted') { stumble(memo); const lost = Math.min(3, stacked); stacked -= lost; spill(street, memo.x, GROUND - 70, lost + 2); audio.fx('gasp', 0.6); audio.fx('thud', 0.5); verdicts.push({ word: SPOTTED[Math.floor(rng() * SPOTTED.length)]!, good: false, born: time }); }
          else { stacked += 2; audio.fx('ding', 0.45); const words = s.ally * 2 >= s.coned ? ALLY_UNSEEN : UNSEEN; verdicts.push({ word: words[Math.floor(rng() * words.length)]!, good: true, born: time }); }
          while (verdicts.length > 4) verdicts.shift();
        }
      }
      envs.push({ kind: a.kind, env });
    }
    if (sweeps.size > 14) for (const key of sweeps.keys()) { if (sweeps.size <= 14) break; if (!active.some((a) => a.key === key)) sweeps.delete(key); }

    // Memo: what the round has him doing.
    const drive: MemoDrive = { mode: memoMode, speed, tension, alarm, age: exited ? exitAge : crashed ? raidAge : 0, chain: drip.has('chain'), tejana: drip.has('hat') };
    if (fresh) settleMemo(memo, drive, street.scroll);
    stepMemo(memo, drive, dt);
    stepAlly(ally, dt, memo.x);
    if (seen && memo.events.step && running && !exited && time - stepClock > 0.12) { stepClock = time; audio.fx('stomp', memoMode === 'cone' ? 0.05 : 0.1); }
    if (seen && memo.events.cone) audio.fx('pop', 0.5);
    if (seen && memo.events.land) audio.fx('clang', 0.3);
    if (seen && memo.events.recovered) audio.fx('pop', 0.3);
    const blowing = running && !exited && memoMode === 'run' && memo.stumble < 0 ? 1 : 0;
    stepStreet(street, dt, speed, nozzle, blowing);
    if (running && !exited && memoMode === 'run' && memo.stumble < 0) { const got = collectBills(street, memo.x); if (got) { stacked += got; if (seen) audio.fx('coin', 0.3); } }
    if (running) live = { stacked, scroll: street.scroll, elapsed: view.elapsed, wall: Date.now() };

    const showMemo = !(caught && raidAge >= RAID.tackle) && !(exited && exitAge > EXIT.gone);
    const bsod = caught && raidAge >= RAID.bsod;

    c.save();
    c.save();
    // The camera: punched in on Memo through the raid's first beat, shaken by the tackle.
    const punch = !caught ? 0 : bustAge < 0.06 ? ease(bustAge / 0.06) : 1 - ease((bustAge - 0.42) / 0.5);
    const quake = caught && raidAge > RAID.tackle && raidAge < RAID.tackle + 0.45 ? Math.sin((raidAge - RAID.tackle) * 38) * 5 * (1 - (raidAge - RAID.tackle) / 0.45) : 0;
    c.translate(HERO_X + quake, 380); c.scale(1 + 0.1 * punch, 1 + 0.1 * punch); c.translate(-HERO_X, -380);
    drawSky(c, street.scroll, time, tension);
    drawFar(c, street.scroll);
    drawFacades(c, street.scroll, time);
    drawSidewalk(c, street.scroll);
    const layer = (which: Layer) => { for (const { kind, env } of envs) drawThreat(c, kind, env, which); };
    layer('back');
    drawBills(c, street, time);
    if (exited) drawNote(c, HERO_X - 44, NOTE, ease((exitAge - 2.6) / 0.4));
    drawAllyGround(c, ally, memo.x);
    if (showMemo) { const p = drawMemo(c, memo, drive, time); nozzle = p.nozzle; heroHead = p.head; lastPose = p; }
    drawAllyFront(c, ally, time, memo.x, lastPose);
    if (memo.blower.off) drawBlower(c, memo.blower.x, memo.blower.y, memo.blower.rot, 0);
    drawSpills(c, street);
    drawLeaves(c, street);
    drawAsphalt(c, street.scroll);
    drawParked(c, street.scroll, time);
    layer('street');
    if (crashed) drawRaid(c, raidAge, { x: HERO_X, y: GROUND }, exited ? 'dodged' : 'caught', time);
    layer('air');
    // The exit: the app, the stipend, the plane.
    if (exited && exitAge >= EXIT.phone && exitAge < EXIT.bag + 0.3 && showMemo) {
      const a = ease((exitAge - EXIT.phone) / 0.3) * (1 - ease((exitAge - EXIT.bag) / 0.3));
      c.save(); c.globalAlpha = a; c.translate(heroHead.x + 44, heroHead.y - 150 + 10 * (1 - a));
      box(c, -40, 0, 80, 132, '#141420', 12, 3); box(c, -34, 10, 68, 112, '#f6f1e4', 6, 0);
      plain(c, PHONE.app, 0, 30, 10, '#1e3a8a', 'center', 'system-ui, sans-serif', 900);
      const pressed = exitAge >= EXIT.tap ? 1 - 0.1 * (1 - ease((exitAge - EXIT.tap) / 0.3)) : 1;
      c.save(); c.translate(0, 60); c.scale(pressed, pressed); box(c, -28, -16, 56, 32, exitAge >= EXIT.tap ? '#5aa36d' : '#c2321e', 8, 2); plain(c, PHONE.line1, 0, -1, 9, '#ffffff', 'center', 'system-ui, sans-serif', 900); plain(c, exitAge >= EXIT.tap ? 'DONE ✓' : PHONE.line2, 0, 10, 8, '#ffffff', 'center', 'system-ui, sans-serif', 800); c.restore();
      plain(c, PHONE.fine, 0, 96, 7, '#7a3b2a', 'center', 'system-ui, sans-serif', 700);
      plain(c, exitAge < EXIT.tap ? PHONE.button : 'see you never', 0, 112, 7, '#3b3b47', 'center', 'system-ui, sans-serif', 700);
      c.restore();
    }
    if (exited && exitAge >= EXIT.cash && exitAge < EXIT.cash + 2 && showMemo) {
      const u = (exitAge - EXIT.cash) / 2;
      c.save(); c.globalAlpha = 1 - ease((u - 0.6) / 0.4); text(c, '+$1,000*', heroHead.x + 44, heroHead.y - 170 - 70 * ease(u), 26 + 6 * (1 - u), '#9ee8b5', 'center'); c.restore();
      for (let i = 0; i < 14; i++) { const r = noise(i * 7.7), r2 = noise(i * 3.1 + 2); c.save(); c.globalAlpha = 1 - u; c.translate(heroHead.x + 44 + (r - 0.5) * 220 * u, heroHead.y - 120 + (r2 - 0.8) * 160 * u + 240 * u * u); c.rotate(u * 9 + i); box(c, -6, -4, 12, 8, ['#ffd166', '#9ee8b5', '#ff5d8f', '#5bffb1'][i % 4]!, 1, 1.5); c.restore(); }
    }
    if (exited && exitAge >= EXIT.walk) {
      const px = 1040 - 170 * (exitAge - EXIT.walk), py = 84 + Math.sin(time * 1.3) * 4;
      if (px > -400) {
        c.save(); c.translate(px, py);
        shape(c, [[-30, 0], [-18, -8], [26, -8], [40, 0], [26, 6], [-18, 6]], '#f6f1e4', 3); shape(c, [[24, -8], [34, -22], [40, -8]], '#f6f1e4', 3); shape(c, [[-6, -6], [8, -22], [14, -22], [6, -6]], '#f6f1e4', 2);
        line(c, [[-30, 0], [-60, 2]], '#2d2a33', 2); box(c, -220, -10, 160, 22, '#ffd166', 2, 2); text(c, 'ADIÓS · “VOLUNTARY”', -140, 6, 11, INK, 'center', 150);
        c.restore();
      }
    }
    c.restore();
    if (caught && bustAge < 0.45) {
      // Red, then blue, washes in from the street over the frozen beat.
      const wash = c.createLinearGradient(160, 0, 960, 0), color = bustAge < 0.1 || (bustAge > 0.2 && bustAge < 0.3) ? '255, 70, 105' : '80, 140, 255';
      wash.addColorStop(0, `rgba(${color}, 0)`); wash.addColorStop(1, `rgba(${color}, 0.55)`);
      c.save(); c.globalAlpha = 1 - ease(bustAge / 0.45); c.fillStyle = wash; c.fillRect(0, 0, 960, 540); c.restore();
    }
    layer('hud');
    for (const v of verdicts) {
      const age = time - v.born; if (age > 1.5) continue;
      c.save(); c.globalAlpha = 1 - ease((age - 1) / 0.5);
      stamp(c, memo.x + 150, GROUND - 230 - 20 * age, 40 + v.word.length * 15, 46, v.good ? '#5aa36d' : '#f06c78', age, v.good ? -0.08 : 0.1, () => text(c, v.word, 0, 9, 22, '#fff0c5', 'center', 30 + v.word.length * 14));
      c.restore();
    }
    // The caption, the bubble, and the HUD over all of it; then the picture dies if it must.
    const cap = crashed ? crashCaption(x, exited, view.stake !== null)
      : exited ? relief(x / (cash / 100))
      : running ? (view.elapsed >= 45_000 ? OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]! : CAPTIONS.filter(([at]) => x >= at).pop()![1])
      : view.phase === 'betting' ? BETTING_CAPTION : WAITING_CAPTION;
    const bubble = exited ? EXIT_BUBBLES[Math.min(EXIT_BUBBLES.length - 1, Math.floor(exitAge / 1.3))]!
      : memoMode === 'mow' ? MOW_BUBBLES[Math.floor(time / 1.5) % MOW_BUBBLES.length]!
      : memoMode === 'cone' ? CONE_BUBBLES[Math.floor(time / 1.6) % CONE_BUBBLES.length]!
      : alarm > 0 ? SCARE_BUBBLE
      : view.elapsed >= 45_000 ? OVERTIME_BUBBLES[Math.floor(view.elapsed / 9_000) % OVERTIME_BUBBLES.length]!
      : tension >= 0.62 ? HIGH_BUBBLES[Math.floor(time / 4.5) % HIGH_BUBBLES.length]! : (RUN_BUBBLES.find(([t]) => tension < t) ?? RUN_BUBBLES[RUN_BUBBLES.length - 1]!)[1];
    if (caught && raidAge >= RAID.glitch && !bsod) { tear = copy(c, tear); if (tear) drawGlitch(c, tear, raidAge - RAID.glitch); }
    if (bsod) { drawBsod(c, raidAge - RAID.bsod); capture(c); }
    else { capture(c); hud(c, view, cap, bubble, time, exited, running, crashed, showMemo, memoMode, tension, active.some((a) => a.kind === 'taco') ? 3 : ally.active ? 1 : 0); }
    if (typeof document !== 'undefined') {
      if (crashed) snap = copy(c, snap);
      else if (dissolve > 0 && snap) {
        dissolve = Math.max(0, dissolve - real / 0.6);
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = ease(dissolve); c.drawImage(snap, 0, 0); c.restore();
      }
    }
    c.restore();
    previous = view.phase; lastElapsed = view.elapsed; lastNow = now;
    present(c, view, cap, 'FROM THE SIDEWALK',
      bsod ? BSOD.code : running && !exited ? bubble : crashed ? (exited ? 'he was already home.' : 'the game crashed. so did the round.') : exited ? 'took the stipend. took the leaf blower.' : 'stretching. the quota is not.',
      bsod ? [0, 0, 960, 540] : crashed ? [120, 170, 600, 340] : exited ? [HERO_X - 160, 150, 560, 360] : undefined);
  }

  return { draw, dispose() { disposed = true; input?.dispose(); } };
}
