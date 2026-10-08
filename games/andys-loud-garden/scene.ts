import { actAt, drawAct } from './acts';
import { createPortrait } from './portrait';
import { type AndyDrive, type AndyMode, createAndy, drawAndy, drawStream, settleAndy, stepAndy } from './andy';
import { type Effect, pageAudio } from './audio';
import { box, clamp, ease, INK, line, noise, oval, text } from './drawing';
import { backdrop, beds, flyingLeaves, neighbour, plant, pollinators } from './garden';
import { drone, headlights, police, sirenGlow } from './police';

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
  dispose(): void;
}

const RUNGS = [1.5, 2, 3, 5, 10, 25];
/** A beat every two or three seconds through the first fifteen, keyed to the multiplier; each caption fires with what it names. */
const CAPTIONS: [number, string][] = [
  [1, 'JUST A LITTLE GARDENING'], [1.2, 'ORGANIC, LOCALLY GROWN $ANDY'], [1.38, 'THAT IS DEFINITELY NOT BASIL'],
  [1.6, 'THE NEIGHBOURS CAN SMELL IT'], [1.8, 'SHE IS CALLING SOMEBODY'], [2, 'HEADLIGHTS. JUST PASSING. PROBABLY.'],
  [2.2, 'GREEN CANDLES ONLY'], [2.5, 'WAS THAT A SIREN?'], [3, 'A CAR IS SLOWING DOWN…'], [3.6, '…AND GONE. BREATHE.'],
  [4, 'SUBURBAN RAINFOREST'], [4.6, 'REHEARSING: “NOT A SECURITY, OFFICER”'], [5.5, 'A DRONE. WHOSE DRONE?'],
  [7, 'OVER THE FENCE AND STILL PUMPING'], [10, 'BOTANICAL MAIN CHARACTER'],
];
/** The beats that make a sound, at the multiplier that shows them. */
const CUES: [number, Effect, number][] = [[1.6, 'click', 0.5], [1.8, 'phone', 0.3], [2, 'engine', 0.5], [2.5, 'siren', 0.28], [3, 'engine', 0.75], [5.5, 'whoosh', 0.3]];
const OVERTIME_CAPTIONS = ['THE NIGHT GARDEN SHIFT', 'THE MOTHS ARE HOLDERS NOW', 'STILL DEFINITELY TOMATOES', 'THE WATERING CAN WORKS OVERTIME', 'NEIGHBOURHOOD BOTANY DAO', 'ANOTHER SPRINKLE, ANOTHER EXCUSE', 'THE JUNGLE HAS A WAITLIST', 'ANDY FORGOT BEDTIME'];
const OVERTIME_BUBBLES = ['the moths get it.', 'just topping them up.', 'organic. probably.', 'the neighbour has a lawyer.', 'one more lap of the beds.', 'diamond-handed tomatoes.'];
/** Where Andy stands, where his water lands and where the trouble comes from. */
const HOME_X = 216;
const GROUND = 480;
const BED = { x: 400, y: 452 };
const STREET = { x: 940, y: 400 };
/** The frozen beat when the raid lands, in seconds; the punch-in on Andy holds a little longer. */
const HIT_STOP = 0.16;

/** The room supplies every outcome; growth, actors and effects only present its view. */
export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait("ANDY\u2019S LOUD GARDEN", [100, 205, 430, 290], '#f0d99c');
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'lofi', crash: 'siren', music: 0.6, effects: 0.8 });
  const andy = createAndy(HOME_X);
  let disposed = false;
  let previous: SceneView['phase'] | null = null;
  let lastElapsed = 0;
  let lastNow: number | null = null;
  /** Ambient motion runs on its own integrated clock, which stands still through the frozen beat. */
  let clock = 0;
  let cashed = false;
  let lastRung = -1;
  let lastCue = -1;
  let heartbeat = 0;
  let stamped = false;
  /** The last crash frame, dissolved into the next betting phase so the reset never pops. */
  let snap: HTMLCanvasElement | null = null;
  let dissolve = 0;

  function reset() {
    cashed = false; lastRung = -1; lastCue = -1; heartbeat = 0; stamped = false;
  }

  function hud(c: CanvasRenderingContext2D, view: SceneView, cap: string, bubble: string, growth: number, over: number, time: number) {
    const running = view.phase === 'running'; const crashed = view.phase === 'crashed'; const cash = view.cashoutX100;
    const top = c.createLinearGradient(0, 0, 0, 155); top.addColorStop(0, '#201b36ee'); top.addColorStop(1, '#201b3600');
    c.fillStyle = top; c.fillRect(0, 0, 960, 155);
    text(c, "ANDY'S", 27, 34, 17, '#edc795');
    text(c, 'LOUD GARDEN', 24, 79, 42, '#f9e58c', 'left', 410);
    text(c, cap, 27, 105, 13, '#f6eedc', 'left', 600);
    box(c, 733, 22, 203, 91, '#28233ddb', 16, 2);
    text(c, crashed ? 'RAIDED AT' : running ? 'GROWING' : 'READY TO GROW', 834, 44, 11, '#d2c0b8', 'center');
    text(c, `${(view.currentX100 / 100).toFixed(2)}×`, 834, 92, 45, crashed ? '#ff8b90' : '#c5ed91', 'center', 175);
    if (cash !== null) {
      box(c, 282, 124, 376, 43, '#245847', 12, 3);
      text(c, `JEETED THE HARVEST AT ${(cash / 100).toFixed(2)}×`, 470, 152, 19, '#d8f4ad', 'center', 352);
    } else if (running) {
      c.save(); c.translate(222, 178 + (reduced ? 0 : Math.sin(time * 2) * 2));
      box(c, -84, -21, 175, 38, '#fcf0c9', 12, 3);
      c.fillStyle = INK; c.font = 'bold 13px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(bubble, 3, 3, 157);
      line(c, [[-15, 18], [-20, 26], [-2, 18]], INK, 2); c.restore();
    }
    box(c, 19, 507, 142, 23, '#25394a', 6, 2);
    text(c, crashed ? 'ASSETS FROZEN' : over > 0 ? 'OVER THE FENCE' : growth < 0.28 ? 'SEED ROUND' : growth < 0.67 ? 'GROWING LOUD' : 'FULL JUNGLE', 90, 522, 10, '#e7ecb2', 'center');
    text(c, 'FREE PLAY · VALUELESS CREDITS', 938, 527, 10, '#faf0d8', 'right');
  }

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number) {
    if (disposed) return;
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.phase === 'betting' && previous === 'crashed' && snap && !reduced) dissolve = 1;
    if ((view.phase === 'betting' && previous !== 'betting') || (running && view.elapsed < lastElapsed)) reset();
    const delta = lastNow === null ? 0 : Math.max(0, (now - lastNow) / 1000);
    const dt = Math.min(0.05, delta);
    const live = previous !== null && delta < 0.3;
    const act = actAt(view.elapsed, reduced);
    const cash = view.cashoutX100;
    const x = running || crashed ? Math.max(1, view.currentX100 / 100) : 1;
    const lnx = Math.log(x);
    // Seconds since the multiplier passed `at` (negative before), from the round's own clock and curve, so replay and late entry agree.
    const since = (at: number) => lnx > 1e-4 ? view.elapsed / 1000 * (1 - Math.log(at) / lnx) : -1;
    // 0.33 at 1.5x, 0.5 at 2x, 0.67 at 3x: the music, Andy's nerves and the heartbeat all follow it.
    const tension = 1 - 1 / x;
    const growth = clamp(Math.log2(x) / 2.3);
    // Past 4.9x the jungle keeps climbing over the fence and the camera pulls back to keep it in view.
    const over = Math.max(0, Math.log2(x / 4.92));
    const zoom = 1 - 0.15 * ease(over / 4);
    const bustAge = crashed ? Math.max(0, view.crashAge / 1000) : -1;
    const raid = crashed ? reduced ? bustAge : bustAge - HIT_STOP : -1;
    const caught = crashed && cash === null;
    if (!reduced && !(caught && bustAge < HIT_STOP)) clock += dt;
    const time = clock;
    if (cash !== null && !cashed) { cashed = true; if (live) audio.cashout(); }
    const exitAge = cash === null ? -1 : Math.max(0, since(cash / 100) + (crashed ? bustAge : 0));
    audio.update(view.phase, tension);
    if (crashed && previous !== 'crashed') audio.crash('siren', bustAge > 0.4);
    if (crashed && raid >= 0.22 && !stamped) { stamped = true; if (live && previous === 'crashed') audio.fx('punch', 0.7); }
    if (running) {
      const rung = RUNGS.filter(value => x >= value).length - 1;
      if (rung > lastRung && previous === 'running' && live) audio.milestone(rung);
      lastRung = rung;
      const cue = CUES.filter(([at]) => x >= at).length - 1;
      if (cue > lastCue && previous === 'running' && live) audio.fx(CUES[cue]![1], CUES[cue]![2]);
      lastCue = cue;
      // A heartbeat under the music once the neighbours notice, quickening with the tension; it stops when he cashes out.
      if (cash === null && tension > 0.25) {
        heartbeat += dt / (1.4 - 1.05 * tension);
        if (heartbeat >= 1) { heartbeat %= 1; if (live) audio.fx('heartbeat', 0.2 + 0.3 * tension); }
      }
    }

    // The threat, before any crash: a lit window, a phone call, headlights, a siren, a drone. Multiplier only, never the outcome.
    const calm = running ? 1 : crashed ? 1 - ease(bustAge / 0.25) : 0;
    const lit = ease(since(1.6) / 0.35) * calm;
    const caller = ease(since(1.8) / 0.5) * calm;
    const s2 = since(2), s3 = since(3), s25 = since(2.5), s55 = since(5.5);
    let beam = 0, beamAt = 990;
    if (s2 >= 0 && s2 < 1.4) { beam = Math.sin(Math.PI * s2 / 1.4); beamAt = 990 - 300 * ease(s2 / 1.2); }
    if (s3 >= 0 && s3 < 2.4) {
      // This one slows, holds on the fence, then moves on.
      beam = ease(s3 / 0.3) * (1 - ease((s3 - 1.9) / 0.5));
      beamAt = s3 < 0.9 ? 990 - 330 * ease(s3 / 0.9) : s3 < 1.7 ? 660 - 20 * (s3 - 0.9) / 0.8 : 640 - 280 * ((s3 - 1.7) / 0.7) ** 2;
    }
    beam *= calm;
    if (reduced) beamAt = 760;
    const siren = s25 >= 0 && s25 < 1.8 ? ease(s25 / 0.25) * (1 - ease((s25 - 1.2) / 0.6)) * calm : 0;
    const pass = s55 >= 0 ? (s55 % 10) / 7 : 2;
    const flying = pass <= 1 ? ease(Math.min(pass, 1 - pass) * 8) * calm : 0;
    const droneX = reduced ? 700 : 1010 - 1080 * pass;
    const sweep = droneX + (reduced ? 0 : 50 * Math.sin(s55 * 0.9));
    const alarm = running && cash === null ? Math.max(beam * (beamAt < 930 ? 1 : 0), siren, flying * clamp(1 - Math.abs(sweep - HOME_X) / 140)) : 0;

    // Andy: what the round has him doing, and where the exit walks him.
    const departure = cash !== null ? reduced ? 1 : ease((exitAge - 0.7) / 3.3) : 0;
    const mode: AndyMode = cash !== null ? 'harvest' : crashed ? 'busted' : running ? act.stage > 0 && act.effort < 0.5 ? 'idle' : 'watering' : 'idle';
    const drive: AndyDrive = { mode, x: HOME_X - departure * 396, ground: GROUND, tension, alarm, bed: BED, street: STREET };
    if (previous === null) settleAndy(andy, drive, reduced);
    // The raid lands on a frozen beat before he jumps.
    const frozen = !reduced && mode === 'busted' && bustAge < HIT_STOP;
    stepAndy(andy, drive, frozen ? 0 : dt, reduced);
    if (live && andy.events.pour) audio.fx('glug', 0.25);
    if (live && andy.events.land) audio.fx('clang', 0.3);
    if (live && andy.events.step) audio.fx('stomp', 0.12);

    c.save();
    c.save();
    // The camera: pulled back for a long round's jungle, punched in on Andy through the raid's first beat, shaken by the notice.
    const punch = reduced || !caught ? 0 : bustAge < 0.06 ? ease(bustAge / 0.06) : 1 - ease((bustAge - 0.42) / 0.5);
    const quake = !reduced && raid > 0.22 && raid < 0.67 ? Math.sin((raid - 0.22) * 38) * 5 * (1 - (raid - 0.22) / 0.45) : 0;
    c.translate(240 + quake, 330); c.scale(1 + 0.1 * punch, 1 + 0.1 * punch); c.translate(-240, -330);
    c.translate(480, 540); c.scale(zoom, zoom); c.translate(-480, -540);
    backdrop(c);
    neighbour(c, lit, caller, time);
    sirenGlow(c, s25, siren, reduced);
    headlights(c, beamAt, beam);
    const extra = Math.min(200, 40 * over);
    for (let i = 0; i < 3; i++) plant(c, 419 + i * 151, 451, growth * (i === 1 ? 1 : 0.9), time, i + 1, raid, reduced, extra * (i === 1 ? 1 : 0.9));
    beds(c, view.stake === null ? null : cash !== null ? 'JEETED' : 'YOUR PLOT');
    drawAct(c, act, cash !== null ? 1 - ease(exitAge / 0.5) : running ? 1 : crashed ? 1 - ease(Math.max(0, raid) / 0.35) : 0);
    const moths = clamp((growth - 0.7) / 0.1) * calm;
    if (moths > 0) { c.globalAlpha = moths; pollinators(c, reduced ? 0 : view.elapsed / 1000); c.globalAlpha = 1; }
    const seen = drawAndy(c, andy, drive);
    if (!reduced) drawStream(c, seen, BED.y + 6, time);
    if (cash !== null && departure > 0.85) {
      c.save(); c.globalAlpha = ease((departure - 0.85) / 0.15); c.translate(121, 327); c.rotate(-0.075); box(c, -76, -29, 152, 60, '#f7df9f', 8, 3);
      text(c, 'GONE HOME', 0, -2, 16, '#352b48', 'center'); text(c, 'PROFITS TAKEN.', 0, 18, 11, '#345844', 'center', 136); c.restore();
    }
    flyingLeaves(c, raid, reduced);
    police(c, raid, reduced);
    drone(c, droneX, 540 - 400 / zoom + (reduced ? 0 : Math.sin(time * 1.7) * 6), sweep, flying, time, reduced);
    if (calm > 0 && !reduced) {
      for (let i = 0; i < 10; i++) {
        const t = (time * 0.13 + noise(i + 20)) % 1;
        const sx = 365 + noise(i + 40) * 420 + Math.sin(time * 1.2 + i) * 8;
        const sy = 432 - t * 180 * growth;
        c.globalAlpha = Math.sin(t * Math.PI) * 0.5 * calm; oval(c, sx, sy, 2, 2, '#ecf8a9');
      }
      c.globalAlpha = 1;
    }
    c.restore();
    if (caught && !reduced && bustAge < 0.45) {
      // Red, then blue, washes in from the street over the frozen beat.
      const wash = c.createLinearGradient(160, 0, 960, 0), color = bustAge < 0.1 || (bustAge > 0.2 && bustAge < 0.3) ? '255, 70, 105' : '80, 140, 255';
      wash.addColorStop(0, `rgba(${color}, 0)`); wash.addColorStop(1, `rgba(${color}, 0.55)`);
      c.save(); c.globalAlpha = 1 - ease(bustAge / 0.45); c.fillStyle = wash; c.fillRect(0, 0, 960, 540); c.restore();
    }
    if (raid >= 0) {
      // The notice slams down from above the frame, then the scene shakes with it; the dissolve to betting carries it out.
      const slam = reduced ? 1 : ease(raid / 0.22);
      c.save(); c.globalAlpha = reduced ? 1 : ease(raid / 0.08); c.translate(509, 229); c.rotate(-0.065); c.scale(1.7 - 0.7 * slam, 1.7 - 0.7 * slam);
      box(c, -190, -58, 380, 110, cash !== null ? '#5aa36d' : '#f06c78', 14, 6);
      text(c, cash !== null ? 'SEC · NOTICE UNSERVED' : 'SEC · DIVISION OF ENFORCEMENT', 0, -27, 13, '#fff0c5', 'center', 340);
      text(c, cash !== null ? 'NOBODY HOME' : 'WELLS NOTICE', 0, 28, 50, '#fff0c5', 'center', 350); c.restore();
    }
    if (typeof document !== 'undefined' && !reduced) {
      const canvas = c.canvas;
      if (crashed) {
        snap ??= document.createElement('canvas');
        if (snap.width !== canvas.width || snap.height !== canvas.height) { snap.width = canvas.width; snap.height = canvas.height; }
        snap.getContext('2d')?.drawImage(canvas, 0, 0);
      } else if (dissolve > 0 && snap) {
        dissolve = Math.max(0, dissolve - dt / 0.45);
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = ease(dissolve); c.drawImage(snap, 0, 0); c.restore();
      }
    }
    const cap = crashed ? cash !== null ? 'JEETED BEFORE THE RAID. DODGED.' : x <= 1.01 ? 'RAIDED BEFORE THE FIRST SPRINKLE.' : 'THE HOWEY TEST CAME BACK POSITIVE.'
      : cash !== null ? regret(x / (cash / 100))
      : running ? view.elapsed >= 45_000 ? OVERTIME_CAPTIONS[Math.floor((view.elapsed - 45_000) / 12_000) % OVERTIME_CAPTIONS.length]! : CAPTIONS.filter(([at]) => x >= at).pop()![1]
      : 'A LITTLE WATER. A LOT OF AMBITION.';
    const bubble = alarm > 0.3 ? '…act natural.' : view.elapsed >= 45_000 ? OVERTIME_BUBBLES[Math.floor(view.elapsed / 9_000) % OVERTIME_BUBBLES.length]!
      : tension > 0.62 ? 'bro… they are tomatoes.' : tension > 0.42 ? 'not a security. promise.' : tension > 0.2 ? 'it’s a utility plant.' : 'just one more sprinkle.';
    capture(c);
    hud(c, view, cap, bubble, growth, over, time);
    c.restore();
    previous = view.phase; lastElapsed = view.elapsed; lastNow = now;
    // The crash close-up takes in the notice above Andy as well as his reaction.
    present(c, view, running && cash === null && act.stage > 0 ? act.line : cap, 'FROM THE GARDEN',
      running && cash === null ? bubble : crashed ? cash !== null ? 'andy is already home.' : 'it was a utility plant, officer.' : cash !== null ? 'paper hands, clean hands.' : 'just one more sprinkle.',
      crashed ? [95, 155, 620, 350] : cash !== null ? [0, 160, 520, 370] : undefined);
  }

  return { draw, dispose() { disposed = true; } };
}

/** After a cash-out the garden keeps growing: a gentle regret ladder, always on Andy's side. */
function regret(ratio: number): string {
  return ratio < 1.25 ? 'PROFITS TAKEN. SHADES ON.' : ratio < 2 ? 'THE PLANTS KEPT PUMPING. ANDY IS FINE.'
    : ratio < 4 ? 'PAPER HANDS. STILL NOT IN JAIL.' : 'THE JUNGLE WENT PARABOLIC. ANDY SLEEPS FINE.';
}
