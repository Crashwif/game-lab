/**
 * Composes OnlyFrens from the room state: the stream, the chat, the simps,
 * then the HUD over the video. All motion is stepped here with the real
 * frame time, and nothing drawn here changes the committed outcome.
 */
import { type Chat, createChat, drawChat, drawSimps, floodChat, resetChat, settleChat, stepChat, unsubscribe } from './chat';
import { clamp, spring, stepSpring } from './motion';
import { INK, type Stream, VIDEO, celebrate, createStream, drawStream, endStream, resetStream, stepStream } from './stream';

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
  /** Drops the screen shake, the LED pulse and the static. */
  reducedMotion?: boolean;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
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

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'TOUCHED GRASS' : 'BOYFRIEND REVEAL';
  if (view.phase !== 'running') return 'GM QUEEN';
  if (secured) return 'TOUCH GRASS';
  if (multiplier < 1.4) return 'SIMP HARDER';
  if (multiplier < 1.9) return 'NUMBER GO UP';
  if (multiplier < 2.6) return 'WEN REVEAL';
  if (multiplier < 3.6) return 'HODL';
  if (multiplier < 5) return 'DIAMOND HANDS';
  if (multiplier < 7.5) return 'MODS ASLEEP';
  if (multiplier < 12) return 'ONE MORE MILESTONE';
  if (multiplier < 20) return 'IS THAT A DOOR';
  return 'THIS IS FINE';
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
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

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const growth = Math.log2(multiplier);
    const tension = clamp(growth / 3.3, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null) secured = { x100: view.cashoutX100, payout: view.payout };

    if (previous === null) {
      previous = view.phase;
      resetStream(stream);
      resetChat(chat);
      if (running || crashed) { settleChat(chat, multiplier); stream.bags = Math.min(9, chat.goalIndex); }
      if (crashed) {
        outcome = 'ended';
        endStream(stream, view.currentX100, true);
        floodChat(chat, false, true);
        pop.x = 1;
      }
    } else if (view.phase !== previous) {
      if (crashed && !stream.ended) {
        const quiet = view.crashAge > 1500;
        outcome = view.stake === null ? 'ended' : secured ? 'called' : 'rekt';
        endStream(stream, view.currentX100, quiet);
        floodChat(chat, outcome === 'called', quiet);
        if (quiet) pop.x = 1;
        else { shake = 1; pop.v = 16; }
      }
      if (view.phase === 'betting') {
        resetStream(stream);
        resetChat(chat);
        outcome = null;
        secured = null;
      }
      previous = view.phase;
    }
    if (secured && running) unsubscribe(chat);

    const reached = stepChat(chat, { running, multiplier, tension }, dt);
    if (reached) { celebrate(stream, chat.goalIndex); if (!reduced) shake = Math.max(shake, 0.2); }
    stepStream(stream, { running, tension, multiplier, reduced }, dt);
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
    drawStream(ctx, stream, tension, reduced);
    drawSimps(ctx, chat, tension, outcome !== null, outcome === 'called');
    if (outcome && pop.x > 0.02 && stream.endAge > 0.5) {
      ctx.save();
      ctx.translate(VIDEO.w / 2, 330);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'rekt' ? 'RUGGED' : outcome === 'called' ? 'CALLED IT' : 'REVEAL';
      memeText(ctx, text, 0, 0, 84, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    drawChat(ctx, chat, multiplier, viewers, !outcome);

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
    memeText(ctx, `${multiplier.toFixed(2)}×`, VIDEO.w - 18, VIDEO.h - 18, 52, colour, 'right');
    ctx.restore();
    memeText(ctx, `${stream.bags} BAGS`, 18, VIDEO.h - 18, 24, outcome ? '#ff9db0' : '#e7f4f0', 'left');
  }

  return { draw };
}
