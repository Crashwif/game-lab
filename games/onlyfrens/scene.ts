import { actAt, drawAct } from './acts';
import { createPortrait } from './portrait';
/**
 * Composes OnlyFrens from the room state: the stream, the chat, the simps,
 * then the HUD over the video, with the sound cued from what they do. All
 * motion is stepped here with the real frame time, and nothing drawn here
 * changes the committed outcome.
 */
import { pageAudio } from './audio';
import { type Chat, GOALS, TIP_MENU, createChat, drawChat, drawSimps, floodChat, goLiveChat, resetChat, settleChat, stepChat, unsubscribe } from './chat';
import { clamp, mix, settleSpring, smoothstep, spring, stepSpring } from './motion';
import { INK, RAPS, type Stream, VIDEO, cashFlash, celebrate, createStream, drawStream, endStream, goLive, resetStream, revealZoom, settleStream, stepStream } from './stream';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a reveal missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface SceneOptions {
  /** Drops the screen shake, the LED pulse, the door rattle, the freeze frame and the static. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** A longer wait between frames than this (a hidden tab, a throttled frame) is time the scene did not see. */
const GAP_MS = 1000;
/** The feed cuts to static this long after the door opens; the stinger lands with the cut, not the door. */
const CUT_S = 0.9;
type Outcome = 'rekt' | 'called' | 'ended';
type Secured = { x100: number; payout: number | null };

function memeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  ctx.font = `900 ${size}px ${MEME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** The opening ladder gives way to an ongoing broadcast in unusually long rounds. */
const OVERTIME_CAPTIONS = ["THE GOALPOSTS ARE MOVING", "BONUS STREAM JUST DROPPED", "THE MODS NEED COFFEE", "ONE MORE ONE MORE MILESTONE", "CHAT HAS ENTERED OVERTIME", "THE REVEAL HAS A WAITLIST", "PINNED MESSAGE: KEEP TIPPING", "THE HOODIE STAYS ON"];

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'SIMPED TO ZERO' : outcome === 'called' ? 'TOUCHED GRASS' : 'BOYFRIEND REVEAL';
  if (view.phase !== 'running') return 'GM QUEEN';
  // Out with paper hands: chat turns on the jeet the longer the number keeps going, and the grass stays green.
  if (secured) { const regret = view.currentX100 / secured.x100; return regret < 1.25 ? 'TOUCH GRASS' : regret < 2 ? 'CHAT CALLS U A JEET' : 'STILL TOUCHING GRASS'; }
  const seconds = view.elapsed / 1000;
  if (seconds >= 45) return OVERTIME_CAPTIONS[Math.floor((seconds - 45) / 12) % OVERTIME_CAPTIONS.length]!;
  // The two door beats every round gets, keyed to elapsed time and never to the outcome: the knock, then the handle.
  if (seconds >= 6 && seconds < 7.8) return 'WAS THAT A KNOCK?';
  if (seconds >= 12 && seconds < 13.8) return 'WHO MOVED THE HANDLE?';
  if (multiplier < 1.25) return 'SIMP HARDER';
  if (multiplier < 1.6) return 'TIP TO UNLOCK';
  if (multiplier < 2.25) return 'WEN REVEAL';
  if (multiplier < 2.6) return 'SENT MY RENT';
  if (multiplier < 3.6) return 'SHE SAID GM TO ME';
  if (multiplier < 5) return 'MODS ASLEEP';
  if (multiplier < 7.5) return 'ONE MORE MILESTONE';
  if (multiplier < 12) return 'IS THAT A DOOR';
  return 'WHOSE SHADOW IS THAT';
}

export function createScene(options: SceneOptions = {}): Scene {
  const { capture, present } = createPortrait("ONLYFRENS", [110, 90, 435, 350], '#f0d99c');
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'synthwave', crash: 'static' });
  const stream: Stream = createStream();
  const chat: Chat = createChat();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  /** The door has opened but the feed has not cut yet: the stinger is still to come. */
  let cutPending = false;
  let tipSoundAt = 0;
  let creakAt = 0;
  let creaked = false;
  let simpMode = chat.simp.mode;
  /** The knock's age last frame, so each rap sounds once as it lands; and the heartbeat's countdown. */
  let lastKnock = -1;
  let heartIn = 0;
  /** The act props fade out over the crash instead of cutting. */
  let actFade = 0;
  /** The running time last frame: it only goes back when a new round has begun. */
  let lastElapsed = 0;

  /**
   * Puts in place what a stretch the scene did not see left behind: the goal ladder and the bags at
   * `multiplier`, whoever is behind the door, and your simp already gone, badge up, if you are out.
   */
  function settle(multiplier: number, tension: number, deep: number): void {
    settleChat(chat, multiplier, tension);
    settleStream(stream, tension, deep);
    stream.bags = Math.min(9, chat.goalIndex);
    if (secured) { unsubscribe(chat, true); settleSpring(badge, 1); }
  }

  /** The boyfriend reveal. `quiet` is a crash met late: the aftermath in place, no door, no cut, no stinger. */
  function reveal(view: SceneView, quiet: boolean): void {
    endStream(stream, view.currentX100, quiet);
    floodChat(chat, outcome === 'called', quiet);
    if (quiet) {
      pop.x = 1;
      audio.crash('static', true);
      return;
    }
    shake = 1;
    pop.v = 16;
    cutPending = true;
    audio.fx('door', 1);
    audio.fx('gasp', 0.8);
  }

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const gap = last !== null && now - last > GAP_MS;
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const act = actAt(view.elapsed, reduced);
    // Tension sweeps the 1×–3× window where most rounds end (0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×); `deep` keeps long
    // rounds changing after that. The act director never lowers either.
    const tension = 1 - 1 / multiplier;
    const deep = clamp(Math.log10(multiplier) / 3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) { audio.cashout(); cashFlash(stream); }
    }
    const ending: Outcome = view.stake === null ? 'ended' : secured ? 'called' : 'rekt';

    const first = previous === null;
    // A round already running that this scene never saw open: a tab that slept through the crash, the betting, or both.
    const missed = running && !first && (stream.ended || view.elapsed + 1000 < lastElapsed);
    lastElapsed = view.elapsed;
    // The first frame may land mid-round or after the crash (a page that joins late, or a fresh scene for a
    // round whose betting it missed), so it settles into place instead of playing out what it missed.
    if (previous === null) {
      previous = view.phase;
      resetStream(stream);
      resetChat(chat);
      actFade = running ? 1 : 0;
      if (running || crashed) settle(multiplier, tension, deep);
      if (crashed) {
        outcome = ending;
        reveal(view, true);
      }
    } else if (view.phase !== previous || missed) {
      if (crashed && !stream.ended) {
        const quiet = view.crashAge > 1500;
        outcome = ending;
        if (quiet || gap) settle(multiplier, tension, deep);
        reveal(view, quiet);
      }
      // The round goes live: she waves and posts first.
      if (running && (previous === 'betting' || previous === 'waiting') && !gap) { goLive(stream); goLiveChat(chat); }
      if (view.phase === 'betting' || missed) {
        // Back from the end card, the room fades up rather than cutting in.
        if (stream.ended) stream.boot = 1;
        resetStream(stream);
        resetChat(chat);
        outcome = null;
        secured = null;
        cutPending = false;
        creaked = false;
      }
      previous = view.phase;
    }
    // Back from a hidden tab mid-round: the ladder jumps to the multiplier rather than celebrating every goal it passed.
    if (running && (gap || missed)) settle(multiplier, tension, deep);
    // An exit that landed with the crash, before a running frame saw it, still closes the tab.
    if (secured) unsubscribe(chat);
    audio.update(view.phase, tension);

    const reached = stepChat(chat, { running, multiplier, tension }, dt);
    if (reached) { celebrate(stream, chat.goalIndex); if (!reduced) shake = Math.max(shake, 0.2); audio.fx('kaching', 0.8); }
    if (running) audio.milestone(GOALS.filter((g) => multiplier >= g).length);
    // Tips register, never more than a couple a second however fast the chat runs.
    if (running && chat.events.tip && time > tipSoundAt) { tipSoundAt = time + 0.45; audio.fx('notify', 0.45 + 0.3 * tension); }
    // Someone knocks at 6 s, and again as the knocking acts begin (the ones with knock marks by the door).
    const knockAge = act.stage === 1 || act.stage === 4 || act.stage === 6 ? act.age : view.elapsed / 1000 - 6;
    // Between acts she watches the door: `effort` drives her glance, never the tension.
    stepStream(stream, { running, tension, multiplier, reduced, elapsed: view.elapsed / 1000, knockAge, deep, attention: act.stage > 0 ? smoothstep(0.75, 0.55, act.effort) : 0 }, dt);
    // Two raps, each heard once as it lands (never on a late or resumed frame); a thud's strength is its pitch, so 1.4 is knuckles on wood.
    if (running && !gap && !first) for (const at of RAPS) if (knockAge >= at && knockAge < at + 0.25 && (lastKnock < at || lastKnock > knockAge)) audio.fx('thud', 1.4);
    lastKnock = knockAge;
    // A heartbeat under the stream from about 1.15×, quickening with tension, until you are out.
    if (running && !secured && multiplier >= 1.15) {
      heartIn -= dt;
      if (heartIn <= 0) { heartIn = mix(1.4, 0.35, tension); audio.fx('heartbeat', 0.25 + 0.35 * tension); }
    } else heartIn = 0.5;
    actFade += ((running ? 1 : 0) - actFade) * (1 - Math.exp(-8 * dt));
    // The handle creaks each time it works round, at most one every couple of seconds.
    if (running && !stream.ended) {
      if (stream.handle.x > 0.45 && !creaked && time > creakAt) { creaked = true; creakAt = time + 1.8; audio.fx('creak', 0.6 + 0.3 * tension); }
      else if (stream.handle.x < 0.25) creaked = false;
    }
    if (cutPending && stream.endAge >= CUT_S) { cutPending = false; audio.crash('static'); }
    if (chat.simp.mode !== simpMode) {
      simpMode = chat.simp.mode;
      if (simpMode === 'closing') audio.fx('click', 0.8);
      if (simpMode === 'walking') audio.fx('whoosh', 0.7);
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    const viewers = Math.round(420 + 300 * (Math.pow(multiplier, 1.5) - 1));
    ctx.save();
    if (!reduced && shake > 0) ctx.translate(Math.sin(time * 140) * 6 * shake * shake, Math.cos(time * 117) * 4 * shake * shake);
    drawStream(ctx, stream, tension, reduced, multiplier);
    if (actFade > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.rect(VIDEO.x, VIDEO.y, VIDEO.w, VIDEO.h); ctx.clip();
      revealZoom(ctx, stream, reduced);
      drawAct(ctx, act, actFade);
      ctx.restore();
    }
    drawSimps(ctx, chat, outcome !== null, outcome === 'called', view.stake !== null);
    if (outcome && pop.x > 0.02 && stream.endAge > 0.5) {
      ctx.save();
      // Right of centre, clear of the monitor where her short just closed.
      ctx.translate(VIDEO.w / 2 + 50, 330);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'rekt' ? 'RUGGED' : outcome === 'called' ? 'DODGED IT' : 'REVEAL';
      memeText(ctx, text, 0, 0, 80, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    drawChat(ctx, chat, multiplier, viewers, !outcome);

    capture(ctx);
    if (caption) {
      ctx.save();
      ctx.translate(VIDEO.w / 2, 56);
      const k = 1 + 0.1 * captionPop.x;
      ctx.scale(k, k);
      memeText(ctx, caption, 0, 0, 42, '#ffffff', 'center', 560);
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`;
      ctx.save();
      ctx.translate(VIDEO.w / 2, 100 + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      const k = clamp(badge.x, 0, 1.3);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    memeText(ctx, `${multiplier.toFixed(2)}×`, VIDEO.w - 18, VIDEO.h - 18, 52, colour, 'right', 400);
    ctx.restore();
    memeText(ctx, `${stream.bags} BAG${stream.bags === 1 ? '' : 'S'}`, 18, VIDEO.h - 18, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left');
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, stream.ended ? 'STREAM OFFLINE' : `NEXT GOAL ${chat.goal.toFixed(1)}×`, stream.ended ? 'The reveal was the boyfriend.' : `${TIP_MENU[chat.menuIndex]!.join(' · ')}. ${chat.messages.at(-1)?.text ?? 'Chat is waiting for the reveal.'}`);

  }

  return { draw };
}
