/**
 * Vibescam: composes the launch stream from the round. The founder vibe codes a product that does not exist and
 * promotes a token with no tokenomics; every step up the curve ships another feature (a prompt, a block of
 * generated code, a badge, a smack of the SHIP IT button) and the chat, the holders and the viewers climb with
 * it. An accepted cash-out is your wallet selling: your pinned row in the chat flips to SOLD and the founder calls
 * you paper hands. The crash is the rug pull: the sticker peels off the button (it says RUG), he smacks it, the
 * product dissolves into vapor and 404s, the repository is deleted, the holders read 1 (dev), the shades go on,
 * he grabs the LP bag and walks out through the door, the lights die and the stream ends. This file owns the
 * clocks, the phase edges, the dialogue and its bubbles, the cues, the draw order and the HUD. Nothing here reads
 * or changes the committed outcome.
 */
import { type Effect, pageAudio } from './audio';
import { createChat, drawChat, drawEnded, drawFrames, drawToasts, drawTopBar, floodChat, resetChat, sellChat, settleChat, stepChat, type ChatDrive } from './chat';
import { BEATS, BUTTON, CAM, CHAT, DOOR, SHARE, TOPBAR_H, createDen, drawDenBack, drawDenLight, drawDesk, pressButton, resetDen, settleDen, stepDen, type DenDrive } from './den';
import { chairXAt, createFounder, drawFounderArms, drawFounderBody, founderPose, type FounderDrive, type Look, mouthOf, pushedBackAt, resetFounder, settleFounder, smackButton, stepFounder } from './founder';
import { type BubblePlace, drawBubble, measureBubble, memeText } from './ink';
import { clamp, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { BETTING_LINE, CAPTIONS, CRASH_CAPTIONS, CRASH_LINES, EXIT_LINE, type Feature, featureById, LADDER, OVERTIME, REGRET, RUNGS, STAMP, TITLE } from './pitch';
import { createPortrait } from './portrait';
import { askScreens, createScreens, drawScreens, holdersAt, resetScreens, type ScreensDrive, settleScreens, shipScreens, shippedText, stepScreens, writeFiller } from './screens';
import { type Bubble, bubbleAlpha, createScript, hush, lastLine, resetScript, say, settleLine, settleScript, stepScript, talking } from './script';
import { pageSound } from './sound';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** The displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running; held at the crash time. */
  elapsed: number;
  /** Milliseconds since the crash. */
  crashAge: number;
  /** The player's stake in valueless credits, or null when watching. */
  stake: number | null;
  /** Non-null only after the backend confirms this player's cash-out. */
  cashoutX100: number | null;
  payout: number | null;
}
export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
  dispose?(): void;
}

type Outcome = 'rekt' | 'dodged' | 'watched';
type Box = readonly [x: number, y: number, w: number, h: number];

const COLOURS = { accent: '#ff4fd8', bad: '#ff5d73', good: '#7cf67c', amber: '#ffe27a', text: '#f3f1ea' } as const;

// ─── Crash feel ─────────────────────────────────────────────────────────────────────────────────────────
const FREEZE_S = 0.15;
const SLOW_S = 0.4;
const SLOW_RATE = 0.3;
const PUNCH_HOLD_S = 0.3;
const PUNCH_ZOOM = 0.1;
/** The camera punches in on the button. */
const PUNCH_AT = { x: CAM.x + BUTTON.x, y: CAM.y + BUTTON.y } as const;
const WIPE_S = 0.4;
/** The prompts he types in overtime, in turn. */
const OVERTIME_PROMPTS = ['make the number bigger', 'pivot (same token)', 'more AI', 'bigger font'];

// ─── Bubbles ──────────────────────────────────────────────────────────────────────────────────────────────
const STYLE: Record<string, Pick<BubblePlace, 'width' | 'name' | 'fill' | 'font'>> = {
  founder: { width: 236, name: 'the founder, live' },
  ai: { width: 268, name: 'VibeCode assistant', fill: '#e6ecff', font: '700 13px ui-monospace, Menlo, Consolas, "Courier New", monospace' },
};
/** Where each speaker's bubble would rather sit: the founder's up over the wall, the assistant's over the code. */
const PREFER: Record<string, { x: number; y: number }> = { founder: { x: 50, y: -118 }, ai: { x: -6, y: 80 } };
/** Where the assistant's tail points: the prompt box in the IDE. */
const AI_MOUTH = { x: SHARE.x + SHARE.w - 44, y: SHARE.y + 38 } as const;
/** The HUD and the chat, which no bubble may cover. */
const HUD: Box[] = [[0, 0, 960, TOPBAR_H + 2], [690, TOPBAR_H, 270, 46], [0, 476, 960, 64], [CHAT.x - 4, CHAT.y - 44, CHAT.w + 8, CHAT.h + 46]];
/** Props a bubble should rather not sit on: the button, the chart strip, the landing page's hero. */
const PROPS: [Box, number][] = [[[CAM.x + BUTTON.x - 34, CAM.y + BUTTON.y - 36, 68, 60], 24], [[SHARE.x, SHARE.y + 362, SHARE.w, 72], 10], [[SHARE.x, SHARE.y + 182, SHARE.w, 100], 5]];
const STAMP_AT = { x: CAM.x + CAM.w / 2, y: CAM.y + 334 } as const;
const STAMP_BOX: Box = [CAM.x + 20, CAM.y + 292, CAM.w - 40, 80];

interface Placement { dx: number; dy: number; w: number; h: number }

/** The features whose ship line sits at or below `multiplier`, in order. */
function shippedBelow(multiplier: number): Feature[] {
  const out: Feature[] = [];
  for (const line of LADDER) {
    if (line.at > multiplier || !line.beat?.startsWith('ship:')) continue;
    const f = featureById(line.beat.slice(5));
    if (f) out.push(f);
  }
  return out;
}

export function createScene(): Scene {
  // Glossy synthwave for a launch stream that tightens with the multiplier; the crash is the stream cutting to static.
  const audio = pageAudio({ style: 'synthwave', crash: 'static' });
  const sound = pageSound(audio);
  const { capture, present } = createPortrait(TITLE, [CAM.x, CAM.y, CAM.w, CAM.h], COLOURS.accent, 'SOLD THE VIBE', 'LIVE FROM THE DEN');
  const script = createScript(LADDER, OVERTIME);
  const den = createDen();
  const founder = createFounder();
  const screens = createScreens();
  const chat = createChat();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  const punch = spring(0);
  const placements = new WeakMap<Bubble, Placement>();
  const lastCue = new Map<Effect, number>();
  let handled = new Set<string>();
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let secured: { x100: number; payout: number | null } | null = null;
  let outcome: Outcome | null = null;
  let crashed = false;
  let muted = false;
  let regret = 0;
  let crashLine = 0;
  let freeze = 0;
  let slow = 0;
  let punchHold = 0;
  let shake = 0;
  let wipe = 0;
  let caption = '';
  let bettingSaid = false;
  let lastRung = 0;
  let seed = 0;
  let prevCrash = -1;
  let overtimePrompt = 0;
  let glanceClock = 0;
  let doorSaid = false;
  /**
   * The scene's own crash clock, in seconds: it follows the view's crash age while the round is crashed, and runs
   * on through the encore, when the next betting phase arrives before the ending has finished playing.
   */
  let crashClock = 0;
  /** Seconds since the phase left `crashed` with the ending still playing, or −1; and the crash's multiplier. */
  let encore = -1;
  let crashX100 = 100;

  function cue(name: Effect, strength: number): void {
    const prev = lastCue.get(name) ?? -9;
    if (time - prev < 0.08) return;
    lastCue.set(name, time);
    audio.fx(name, strength);
  }

  function reset(): void {
    resetScript(script);
    resetDen(den);
    resetFounder(founder);
    resetScreens(screens);
    resetChat(chat);
    sound.cut();
    handled = new Set();
    secured = null;
    outcome = null;
    crashed = false;
    muted = false;
    regret = crashLine = lastRung = 0;
    freeze = slow = punchHold = shake = 0;
    bettingSaid = false;
    doorSaid = false;
    prevCrash = -1;
    crashClock = 0;
    encore = -1;
    crashX100 = 100;
    overtimePrompt = 0;
    settleSpring(pop, 0);
    settleSpring(badge, 0);
    settleSpring(punch, 0);
  }

  /** A line's prop beat: `ask:<id>` types the prompt, `ship:<id>` lands the feature and the smack; `warn` buzzes. */
  function beat(name: string, live: boolean): void {
    const [kind, id] = name.split(':');
    if (kind === 'warn') {
      if (live && !muted) cue('buzz', 0.4);
      return;
    }
    if (kind === 'ask') {
      if (id === 'filler') {
        askScreens(screens, OVERTIME_PROMPTS[overtimePrompt++ % OVERTIME_PROMPTS.length]!, live);
        return;
      }
      const f = id ? featureById(id) : undefined;
      if (f) askScreens(screens, f.prompt, live);
      return;
    }
    if (kind !== 'ship') return;
    if (id === 'filler') {
      writeFiller(screens);
      writeFiller(screens);
      screens.thinking = false;
      if (live && !crashed) smackButton(founder);
      return;
    }
    if (!id || handled.has(name)) return;
    handled.add(name);
    const f = featureById(id);
    if (!f) return;
    shipScreens(screens, f, live);
    if (live && !crashed) smackButton(founder);
  }

  /** Lines the queue dropped on a fast curve still stage their beat, quietly, once the ladder has moved past. */
  function catchUp(): void {
    for (let i = 0; i < script.next; i += 1) {
      const line = LADDER[i]!;
      if (!line.beat || !line.beat.startsWith('ship:') || handled.has(line.beat) || script.queue.includes(line)) continue;
      beat(line.beat, false);
    }
  }

  function beginCrash(view: SceneView, quiet: boolean): void {
    crashed = true;
    seed = view.currentX100;
    crashX100 = view.currentX100;
    crashClock = view.crashAge / 1000;
    outcome = secured ? 'dodged' : view.stake === null ? 'watched' : 'rekt';
    hush(script);
    floodChat(chat, quiet);
    if (quiet) {
      muted = true;
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= crashClock) crashLine += 1;
      const line = CRASH_LINES[crashLine - 1]?.[1];
      script.bubbles = [];
      if (line && crashClock < BEATS.end + 2) settleLine(script, line, 1);
      settleSpring(pop, 1);
      audio.crash('static', true);
      sound.cut();
      return;
    }
    freeze = FREEZE_S;
    slow = SLOW_S;
    punchHold = PUNCH_HOLD_S;
    shake = 1;
    settleSpring(punch, 1);
    pop.v = 16;
    audio.crash('static');
    sound.powerDown();
  }

  /** The crash's beats as sound, on the edges of the crash clock this scene actually saw. */
  function crashCues(c: number): void {
    if (muted || prevCrash < 0) return;
    const crossed = (at: number) => prevCrash < at && c >= at;
    if (crossed(BEATS.peel + 0.28)) cue('ratchet', 0.3);
    if (crossed(BEATS.smack)) {
      pressButton(den, 1.4);
      cue('punch', 0.9);
      cue('thud', 0.7);
    }
    if (crossed(BEATS.vapor)) {
      cue('hiss', 0.55);
      cue('whoosh', 0.4);
    }
    if (crossed(BEATS.delete)) cue('zap', 0.35);
    if (crossed(BEATS.holders)) cue('buzz', 0.35);
    if (crossed(BEATS.shades + 0.2)) cue('click', 0.6);
    if (crossed(BEATS.bag + 0.3)) cue('yeet', 0.5);
    if (crossed(BEATS.lights)) cue('zap', 0.6);
    if (crossed(BEATS.rise + 0.1)) cue('creak', 0.45);
    if (crossed(BEATS.ended)) {
      cue('beep', 0.3);
      pop.v += 12;
    }
  }

  // ─── Bubble layout: each bubble is placed once, beside its speaker, clear of his face, the HUD and each other ───
  function mouthFor(who: string, headWorld: { x: number; y: number }): { x: number; y: number } {
    if (who === 'ai') return AI_MOUTH;
    return headWorld;
  }

  const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));

  function layout(ctx: CanvasRenderingContext2D, head: { x: number; y: number }, faceBox: Box | null): void {
    const taken: Box[] = [];
    const faces: Box[] = faceBox ? [faceBox] : [];
    // The DMs sliding onto the cam keep their corner while they are up.
    if (chat.toasts.length > 0) faces.push([CAM.x + CAM.w - 204, CAM.y + 4, 200, 10 + chat.toasts.length * 32]);
    const hud = outcome ? [...HUD, STAMP_BOX] : secured ? [...HUD, [CAM.x + 10, CAM.y + 40, CAM.w - 20, 54] as Box] : HUD;
    const newest = new Map<string, Bubble>();
    for (const b of script.bubbles) newest.set(b.line.who, b);
    for (const b of script.bubbles) {
      const known = placements.get(b);
      const anchor = mouthFor(b.line.who, head);
      if (known) {
        if (b.age < b.life && newest.get(b.line.who) === b) taken.push([anchor.x + known.dx - known.w / 2, anchor.y + known.dy - known.h / 2, known.w, known.h]);
        continue;
      }
      const style = STYLE[b.line.who] ?? { width: 230 };
      const { w, h } = measureBubble(ctx, b.line.text, style, b.line.thought);
      let best: Placement = { dx: 0, dy: -h / 2 - 40, w, h };
      let bestCost = Infinity;
      for (let gy = -9; gy <= 7; gy += 1) {
        for (let gx = -9; gx <= 9; gx += 1) {
          const cx = clamp(anchor.x + gx * 34, 8 + w / 2, 952 - w / 2);
          const cy = clamp(anchor.y + gy * 26, TOPBAR_H + 6 + h / 2, 470 - h / 2);
          const rect: Box = [cx - w / 2, cy - h / 2, w, h];
          const gapX = Math.max(rect[0] - anchor.x, 0, anchor.x - rect[0] - w);
          const gapY = Math.max(rect[1] - anchor.y, 0, anchor.y - rect[1] - h);
          const reach = Math.hypot(gapX, gapY);
          let hard = reach < 12 ? 1e5 : 0;
          for (const r of hud) hard += overlap(rect, r);
          for (const r of faces) hard += overlap(rect, r);
          for (const r of taken) hard += overlap(rect, r);
          const prefer = PREFER[b.line.who] ?? { x: 0, y: -(h / 2 + 40) };
          let cost = hard * 100 + Math.abs(reach - 26) * 0.8 + Math.hypot(cx - anchor.x - prefer.x, cy - anchor.y - prefer.y) * 0.35;
          for (const [r, weight] of PROPS) cost += (overlap(rect, r) * weight) / 400;
          if (cost < bestCost) {
            bestCost = cost;
            best = { dx: cx - anchor.x, dy: cy - anchor.y, w, h };
          }
        }
      }
      placements.set(b, best);
      taken.push([anchor.x + best.dx - w / 2, anchor.y + best.dy - h / 2, w, h]);
    }
  }

  function drawBubbles(ctx: CanvasRenderingContext2D, head: { x: number; y: number }): void {
    for (const b of script.bubbles) {
      const at = placements.get(b);
      if (!at) continue;
      const anchor = mouthFor(b.line.who, head);
      const style = STYLE[b.line.who] ?? { width: 230 };
      const x = anchor.x + at.dx;
      const y = anchor.y + at.dy;
      const tx = anchor.x - x;
      const ty = anchor.y - y;
      const len = Math.hypot(tx, ty) || 1;
      const tail = { x: anchor.x - (tx / len) * 10, y: anchor.y - (ty / len) * 10 };
      drawBubble(ctx, b.line.text, { ...style, x, y, tail }, b.pop.x, bubbleAlpha(b), b.line.thought);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * SLOW_RATE;
    }
    time += dt;
    const fresh = previous === null;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      const live = view.phase === 'running' && !fresh && !crashed;
      sellChat(chat, view.cashoutX100, view.payout, live);
      if (live) {
        say(script, EXIT_LINE, true, true);
        badge.v = 8;
        audio.cashout();
      } else settleSpring(badge, 1);
    }

    // ─── Phase edges first, so this frame draws the state they leave. A crash seen live with the ending still
    // playing when the next betting phase arrives plays on as an encore, then the blink. ───
    if (!fresh && view.phase !== previous) {
      if (encore >= 0 && view.phase === 'running') endEncore();
      if (view.phase === 'crashed' && !crashed) beginCrash(view, view.crashAge > 1500);
      if ((view.phase === 'betting' || view.phase === 'waiting') && encore < 0) {
        if (previous === 'crashed' && crashed && !muted && crashClock < BEATS.end) encore = 0;
        else {
          if (crashed || script.next > 0) wipe = 1;
          reset();
        }
      }
      previous = view.phase;
    }
    if (encore >= 0) {
      encore += real;
      crashClock += real;
      if (crashClock >= BEATS.end || encore >= 3.5) endEncore();
    } else if (crashed && view.phase === 'crashed') crashClock = view.crashAge / 1000;
    const encoring = encore >= 0;
    const phase: SceneView['phase'] = encoring ? 'crashed' : view.phase;
    const multiplier = Math.max(1, (encoring ? crashX100 : view.currentX100) / 100);
    // 1 − 1/x: a third at 1.5×, half at 2×, two thirds at 3×. A slow log driver keeps long rounds changing.
    const tension = 1 - 1 / multiplier;
    const depth = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = phase === 'running';
    const seconds = view.elapsed / 1000;
    const crash = crashed ? crashClock : -1;

    const denDrive = (leaverX: number | null): DenDrive => ({ time, tension, depth, multiplier, running: running && !crashed, crash: crashed ? crashClock : -1, seed, leaverX });
    const screensDrive: ScreensDrive = { time, tension, depth, multiplier, running: running && !crashed, seconds, crash, seed };
    const chatDrive: ChatDrive = { time, tension, multiplier, running: running && !crashed, betting: phase === 'betting', crash };

    if (fresh) {
      previous = view.phase;
      const shipped = view.phase === 'running' || view.phase === 'crashed' ? shippedBelow(multiplier) : [];
      if (view.phase === 'running' || view.phase === 'crashed') {
        settleScript(script, multiplier);
        for (const f of shipped) handled.add(`ship:${f.id}`);
        if (secured) while (regret < REGRET.length && (multiplier / secured.x100) * 100 >= REGRET[regret]![0]) regret += 1;
      }
      if (view.phase === 'crashed') beginCrash(view, true);
      settleScreens(screens, { ...screensDrive, crash: crashed ? crashClock : -1 }, shipped);
      settleChat(chat, { ...chatDrive, crash: crashed ? crashClock : -1 });
      if (secured) sellChat(chat, secured.x100, secured.payout, false);
      settleDen(den, denDrive(null));
      settleFounder(founder, { time, tension, depth, running, multiplier, crash: crashed ? crashClock : -1, talking: 0, look: 'screen', typing: running });
    }
    audio.update(phase, tension);
    sound.update(tension, running && !crashed);

    if (phase === 'betting' && !bettingSaid) {
      bettingSaid = true;
      say(script, BETTING_LINE, true);
    }
    if (secured && running && !crashed) {
      const past = view.currentX100 / secured.x100;
      while (regret < REGRET.length && past >= REGRET[regret]![0]) say(script, REGRET[regret++]![1]);
    }
    if (crashed) {
      while (crashLine < CRASH_LINES.length && CRASH_LINES[crashLine]![0] <= crash) say(script, CRASH_LINES[crashLine++]![1], true, true);
    }
    stepScript(script, multiplier, dt, running && !crashed);
    if (running && !crashed && !fresh) catchUp();

    // ─── The lines said this frame: prompts, features, cues ───
    for (const line of script.events) {
      if (line.beat) beat(line.beat, true);
      if (!fresh && !muted) cue(line.who === 'ai' ? 'beep' : 'pop', line.who === 'ai' ? 0.3 : 0.28);
    }

    // ─── The set and the cast ───
    const talk = talking(script, 'founder');
    glanceClock += dt;
    let look: Look = 'screen';
    if (talking(script, 'ai') > 0) look = 'screen';
    if (chat.toasts.some((t) => t.age < 1.4)) look = 'chat';
    if (!crashed && running && tension > 0.5 && glanceClock % 4.6 < 0.9) look = 'button';
    const founderDrive: FounderDrive = { time, tension, depth, running: running && !crashed, multiplier, crash, talking: talk, look, typing: running && !crashed };
    stepFounder(founder, founderDrive, dt);
    const pose = founderPose(founder, founderDrive);
    const leaverX = crashed && crash >= BEATS.walk ? pose.x : null;
    const dd = denDrive(leaverX);
    stepDen(den, dd, dt);
    stepScreens(screens, screensDrive, dt);
    stepChat(chat, chatDrive, dt);

    // ─── Cues: only on edges this scene saw, never for a settled aftermath ───
    const rung = RUNGS.filter((r) => multiplier >= r).length;
    if (!fresh && running && !crashed && rung > lastRung) audio.milestone(rung);
    lastRung = rung;
    if (!fresh && !muted) {
      if (founder.events.key) cue('click', 0.1 + 0.12 * tension);
      if (founder.events.smack) {
        pressButton(den);
        cue('thud', 0.55);
        cue('kaching', 0.45);
      }
      if (founder.events.step) cue('thud', 0.22);
      if (screens.events.line) cue('tick', 0.12);
      if (chat.events.post && !chat.flooded) cue('tick', 0.05 + 0.05 * tension);
      if (chat.events.dm) cue('notify', 0.5);
      if (crashed) {
        crashCues(crash);
        if (!doorSaid && pose.x > DOOR.x - 24) {
          doorSaid = true;
          cue('door', 0.5);
        }
      }
    }
    prevCrash = crash;

    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    punchHold = Math.max(0, punchHold - real);
    if (punchHold === 0) stepSpring(punch, 0, 9, 0.85, real);
    shake = Math.max(0, shake - real / 0.5);
    const nextCaption = captionFor(phase, view.currentX100, script.caption, secured, outcome, crash);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);

    // ─── The picture ───
    const headWorld = { x: CAM.x + mouthOf(pose).x, y: CAM.y + mouthOf(pose).y };
    ctx.save();
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, 960, 540);
    if (shake > 0) ctx.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    if (punch.x > 0.005) {
      const z = 1 + PUNCH_ZOOM * clamp(punch.x, 0, 1.2);
      ctx.translate(PUNCH_AT.x, PUNCH_AT.y);
      ctx.scale(z, z);
      ctx.translate(-PUNCH_AT.x, -PUNCH_AT.y);
    }
    // The founder's cam.
    ctx.save();
    ctx.translate(CAM.x, CAM.y);
    ctx.beginPath();
    ctx.rect(0, 0, CAM.w, CAM.h);
    ctx.clip();
    const lights = clamp(den.ring.x, 0, 1);
    drawDenBack(ctx, den, dd, chairXAt(crash), pushedBackAt(crash));
    drawFounderBody(ctx, founder, founderDrive, pose, lights);
    drawDesk(ctx, den, dd, !pose.carrying);
    drawFounderArms(ctx, founder, founderDrive, pose);
    drawDenLight(ctx, den, dd);
    ctx.restore();
    // The screen share.
    ctx.save();
    ctx.translate(SHARE.x, SHARE.y);
    ctx.beginPath();
    ctx.rect(0, 0, SHARE.w, SHARE.h);
    ctx.clip();
    drawScreens(ctx, screens, screensDrive);
    ctx.restore();
    // The chat.
    ctx.save();
    ctx.translate(CHAT.x, CHAT.y);
    ctx.beginPath();
    ctx.rect(0, -42, CHAT.w, CHAT.h + 42);
    ctx.clip();
    drawChat(ctx, chat, chatDrive, outcome === 'watched' ? null : view.stake, outcome === 'rekt');
    ctx.restore();
    drawFrames(ctx);
    drawTopBar(ctx, chat, chatDrive);
    drawToasts(ctx, chat);
    drawEnded(ctx, crash);
    const faceBox: Box | null = pose.gone ? null : [headWorld.x - 36, headWorld.y - 52, 72, 76];
    layout(ctx, headWorld, faceBox);
    drawBubbles(ctx, headWorld);
    ctx.restore();
    if (crashed && crash < 0.12 && !muted) {
      ctx.fillStyle = `rgba(255, 70, 80, ${0.35 * (1 - crash / 0.12)})`;
      ctx.fillRect(0, 0, 960, 540);
    }
    if (wipe > 0) {
      wipe = Math.max(0, wipe - real / WIPE_S);
      ctx.fillStyle = `rgba(0, 0, 0, ${clamp(wipe * 1.6, 0, 1)})`;
      ctx.fillRect(0, 0, 960, 540);
    }

    // ─── The HUD ───
    capture(ctx);
    const colour = outcome === 'rekt' || outcome === 'watched' ? COLOURS.bad : running ? '#ffffff' : COLOURS.amber;
    memeText(ctx, `${multiplier.toFixed(2)}×`, 948, 70, 40, colour, 'right', 250);
    if (caption) {
      ctx.save();
      ctx.translate(590, 518);
      const s = 1 + 0.08 * captionPop.x;
      ctx.scale(s, s);
      memeText(ctx, caption, 0, 0, caption.length > 26 ? 26 : 32, '#ffffff', 'center', 640);
      ctx.restore();
    }
    if (secured && badge.x > 0.02 && !outcome) {
      ctx.save();
      ctx.translate(CAM.x + CAM.w / 2, CAM.y + 66);
      const s = clamp(badge.x, 0, 1.2);
      ctx.scale(s, s);
      memeText(ctx, CAPTIONS.exit[0], 0, 0, 20, COLOURS.good, 'center', CAM.w - 30);
      memeText(ctx, `${(secured.x100 / 100).toFixed(2)}×${secured.payout !== null ? ` · +${secured.payout} credits` : ''}`, 0, 21, 14, COLOURS.good, 'center', 300);
      ctx.restore();
    }
    // The readouts: features shipped, warnings, holders, LP.
    const settled = crash >= BEATS.holders;
    memeText(ctx, shippedText(screens), 14, 506, 15, COLOURS.accent, 'left', 240);
    const lp = settled ? 'LP $0 (LOL)' : screens.flags.has('lock') ? 'LP LOCKED (HEART)' : 'LP UNLOCKED';
    memeText(ctx, `HOLDERS ${settled ? '1 (DEV)' : holdersAt(multiplier).toLocaleString('en-US')} · ${lp}`, 14, 528, 13, settled ? COLOURS.bad : COLOURS.amber, 'left', 240);
    if (outcome && pop.x > 0.02 && crash >= BEATS.ended) {
      ctx.save();
      ctx.translate(STAMP_AT.x, STAMP_AT.y);
      ctx.rotate(-0.07);
      const s = clamp(pop.x, 0, 1.12);
      ctx.scale(s, s);
      memeText(ctx, STAMP[outcome], 0, 0, outcome === 'rekt' ? 36 : 32, outcome === 'dodged' ? COLOURS.amber : COLOURS.bad, 'center', CAM.w - 60);
      ctx.restore();
    }
    const detail = crashed ? [CAM.x, CAM.y, SHARE.x + SHARE.w - CAM.x, CAM.h] : secured ? [CHAT.x - 200, CHAT.y + CHAT.h - 160, CHAT.w + 208, 170] : undefined;
    const shown = encoring ? { phase, currentX100: crashX100, cashoutX100: secured?.x100 ?? null } : view;
    present(ctx, shown, caption, TITLE, lastLine(script)?.text ?? 'The stream is starting soon.', detail);
  }

  /** Ends the encore: the blink to black, and the den reset for the next round underneath it. */
  function endEncore(): void {
    encore = -1;
    wipe = 1;
    reset();
  }

  return { draw };
}

function captionFor(phase: SceneView['phase'], x100: number, said: string, secured: { x100: number } | null, outcome: Outcome | null, crash: number): string {
  if (outcome) {
    if (outcome === 'dodged') return CAPTIONS.dodged;
    if (crash < BEATS.end) {
      let text = CRASH_CAPTIONS[0]![1];
      for (const [at, c] of CRASH_CAPTIONS) if (crash >= at) text = c;
      return text;
    }
    return CRASH_CAPTIONS[Math.floor((crash - BEATS.end) / 1.8) % CRASH_CAPTIONS.length]![1];
  }
  if (phase === 'waiting') return CAPTIONS.waiting;
  if (secured) {
    if (x100 / secured.x100 >= 1.5) return CAPTIONS.kept;
    return CAPTIONS.exit[1];
  }
  return said;
}
