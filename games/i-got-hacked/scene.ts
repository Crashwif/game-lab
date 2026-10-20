import { actAt, drawAct } from './acts';
import { createPortrait } from './portrait';
/**
 * Composes I Got Hacked from the room state: the mansion and the bay, the
 * pool party, the phone close-up and the ticker, then the HUD. All motion
 * is stepped here with the real frame time (slowed only by the hit-stop as
 * the post lands), and nothing drawn here changes the committed outcome.
 */
import { pageAudio } from './audio';
import { INK, type Mansion, STAGE, EXCUSES, celebrate, createMansion, drawBarbecue, drawDrone, drawMansion, drawPhone, endMansion, resetMansion, settleMansion, stepMansion } from './mansion';
import { clamp, mix, settleSpring, smoothstep, spring, stepSpring, tensionAt } from './motion';
import { POPS, TICKER, type Party, createParty, drainParty, drawParty, drawTicker, leaveParty, resetParty, settleParty, stepParty } from './party';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** Displayed multiplier in hundredths; the crash point once crashed. */
  currentX100: number;
  /** Milliseconds since the round started running. */
  elapsed: number;
  /** Milliseconds since the crash, so a post missed while the tab was hidden is not replayed late. */
  crashAge: number;
  /** The player's stake this round, kept through the crash. */
  stake: number | null;
  /** The accepted exit multiplier in hundredths once the player has cashed out. */
  cashoutX100: number | null;
  payout: number | null;
}

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void;
}

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
/** The captions and the badge sit centred over the bay, moved left only as far as keeps them clear of the ticker. */
const TEXT_X = STAGE.w / 2 + 80;
const TEXT_RIGHT = TICKER.x - 12;
/** A caption wider than this goes onto two lines. */
const CAPTION_WIDTH = 420;
/** The multipliers the milestone stingers play at: the champagne pops. */
const RUNGS = POPS;
/** Seconds after the post that the pool's drain gurgles. */
const DRAIN_AT = 0.6;
/** The hit-stop as the post lands: the world freezes, then comes back up to speed through slow motion, under a 10%
 * punch-in on the balcony and the phone that holds 0.3 s. */
const FREEZE = 0.14;
const SLOW = 0.35;
const PUNCH = { x: 200, y: 300, zoom: 0.1, hold: 0.3, out: 0.35 } as const;
/** Seconds the crash's aftermath takes to dissolve into the next betting phase. */
const DISSOLVE = 0.45;
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

/** Splits a caption too wide for one line at the space nearest its middle, measured in the current font. */
function captionLines(ctx: CanvasRenderingContext2D, text: string): string[] {
  if (ctx.measureText(text).width <= CAPTION_WIDTH) return [text];
  let cut = -1;
  for (let i = text.indexOf(' '); i !== -1; i = text.indexOf(' ', i + 1)) if (cut === -1 || Math.abs(i - text.length / 2) < Math.abs(cut - text.length / 2)) cut = i;
  return cut === -1 ? [text] : [text.slice(0, cut), text.slice(cut + 1)];
}

/** Where to centre text `width` wide, drawn at scale `k`. */
const clearOfTicker = (width: number, k: number): number => Math.min(TEXT_X, TEXT_RIGHT - (width * k) / 2);

function captionFor(view: SceneView, multiplier: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'NGMI' : outcome === 'called' ? 'NOT HACKED' : 'I GOT HACKED';
  if (view.phase !== 'running') return 'GM FAM';
  // After your exit, a jeet's regret ladder on how far it ran without you; it ends reassured.
  if (secured) { const run = view.currentX100 / secured.x100; return run < 1.25 ? 'NOT HACKED' : run < 2 ? 'JEETED IN PEACE' : run < 5 ? 'FANS SAY JEET' : 'STILL NOT HACKED'; }
  if (multiplier < 1.4) return 'MY NEW COIN';
  if (multiplier < 1.9) return 'NOT A CASH GRAB';
  if (multiplier < 2.6) return 'LOVE MY FANS';
  if (multiplier < 3.6) return 'FANS ARE THE LIQUIDITY';
  if (multiplier < 5) return 'DRAFTING A STATEMENT';
  if (multiplier < 7.5) return 'THE MANAGER IS WHISPERING';
  if (multiplier < 12) return 'WHY IS THE YACHT MOVING';
  if (multiplier < 40) return 'MY ACCOUNT WAS COMPROMISED';
  if (multiplier < 150) return 'LAWYERS ARE IN THE CHAT';
  if (multiplier < 1000) return 'NOT A SECURITY, A VIBE';
  return 'I WAS NEVER HERE';
}

export function createScene(): Scene {
  const { capture, present } = createPortrait("I GOT HACKED", [95, 35, 385, 290], '#f0d99c');

  // Celebrity pool party trap; the crash is the post going out, so it gets the sad trombone.
  const audio = pageAudio({ style: 'trap', crash: 'trombone' });
  const mansion: Mansion = createMansion();
  const party: Party = createParty();
  const pop = spring(0);
  const badge = spring(0);
  const captionPop = spring(0);
  /** The phone close-up's punch as the post lands. */
  const phonePunch = spring(0);
  /** The green wash of an accepted exit. */
  let cashFlash = 0;
  /** Sounds fired once: the yacht's engine, the pool's drain. */
  let engineOn = false;
  let drained = false;
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let shake = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let caption = '';
  /** Seconds into the hit-stop at the post, -1 outside it. */
  let hitStop = -1;
  /** The phone buzz's phase: one buzz each time it passes a whole number. */
  let pulse = 0;
  /** The act props' opacity: they fade out at the post rather than vanish. */
  let actFade = 0;
  /** The last crash frame, fading over the fresh betting phase. */
  let snapshot: HTMLCanvasElement | null = null;
  let dissolve = 0;

  function draw(ctx: CanvasRenderingContext2D, view: SceneView, now: number): void {
    const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const act = actAt(view.elapsed);
    // 0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×: the window most rounds end in escalates all the way. Nothing lowers it.
    const tension = tensionAt(multiplier);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (running) { audio.cashout(); cashFlash = 1; }
    }

    if (previous === null) {
      // This scene's first frame, which can land anywhere in a round: settle into it without replaying anything.
      previous = view.phase;
      resetMansion(mansion);
      resetParty(party);
      if (running || crashed) {
        settleParty(party, multiplier, tension);
        settleMansion(mansion, tension, multiplier, view.elapsed);
        engineOn = mansion.engine.x > 0.5;
        actFade = running ? 1 : 0;
        if (secured) { leaveParty(party, true); settleSpring(badge, 1); }
      }
      if (crashed) {
        outcome = view.stake === null ? 'ended' : secured ? 'called' : 'rekt';
        endMansion(mansion, view.currentX100, true);
        drainParty(party, view.currentX100, true);
        drained = true;
        pop.x = 1;
        audio.crash('trombone', true);
      }
    } else if (view.phase !== previous) {
      if (crashed && !mansion.ended) {
        const quiet = view.crashAge > 1500;
        outcome = view.stake === null ? 'ended' : secured ? 'called' : 'rekt';
        // A cash-out first seen with the crash still walks your fan out, or places them gone if the crash is old.
        if (secured) leaveParty(party, quiet);
        endMansion(mansion, view.currentX100, quiet);
        drainParty(party, view.currentX100, quiet);
        if (quiet) { pop.x = 1; drained = true; audio.crash('trombone', true); }
        else {
          // The post goes out: the trombone, the party's gasp, the hit-stop, the phone punching in and the shake.
          shake = 1;
          pop.v = 16;
          hitStop = 0;
          phonePunch.v = 10;
          audio.crash('trombone');
          audio.fx('gasp', 0.9);
        }
      }
      if (view.phase === 'betting') {
        // The aftermath dissolves into the fresh party instead of cutting to it.
        if (outcome && typeof document !== 'undefined') {
          snapshot ??= document.createElement('canvas');
          if (snapshot.width !== ctx.canvas.width || snapshot.height !== ctx.canvas.height) { snapshot.width = ctx.canvas.width; snapshot.height = ctx.canvas.height; }
          snapshot.getContext('2d')?.drawImage(ctx.canvas, 0, 0);
          dissolve = 1;
        }
        resetMansion(mansion);
        resetParty(party);
        outcome = null;
        secured = null;
        engineOn = false;
        drained = false;
        cashFlash = 0;
        hitStop = -1;
        pulse = 0;
      }
      previous = view.phase;
    }
    if (secured && running) leaveParty(party, false);

    // The hit-stop: the world freezes as the post lands, then comes back up to speed; the shake and the HUD keep time.
    let worldDt = dt;
    if (hitStop >= 0) {
      hitStop += dt;
      worldDt = dt * (hitStop < FREEZE ? 0 : mix(0.3, 1, smoothstep(FREEZE, FREEZE + SLOW, hitStop)));
      if (hitStop > PUNCH.hold + PUNCH.out) hitStop = -1;
    }
    const zoom = hitStop >= 0 ? PUNCH.zoom * (1 - smoothstep(PUNCH.hold, PUNCH.hold + PUNCH.out, hitStop)) : 0;
    // The round's pulse: his phone buzzing every 1.4 s at 1×, 0.88 s by 2×; heard only while your stake is in.
    if (running) {
      pulse += dt / mix(1.4, 0.35, tension);
      if (pulse >= 1) {
        pulse -= Math.floor(pulse);
        if (view.cashoutX100 === null) audio.fx('buzz', 0.2 + 0.25 * tension);
        mansion.buzz = 1;
      }
    }
    actFade = clamp(actFade + (running ? dt : -dt) / 0.4, 0, 1);

    const reached = stepParty(party, { running, multiplier, tension }, worldDt);
    if (reached) {
      celebrate(mansion, party.popIndex);
      shake = Math.max(shake, 0.15);
      audio.fx('pop', 0.7 + 0.25 * (party.popIndex % 3));
    }
    stepMansion(mansion, { running, tension, multiplier }, worldDt);
    // The sounds of the scene's own events: the draft's excuse flipping, the drone's flash, a drive on the grill, the
    // yacht's engine starting, the pool's drain; the milestone stingers follow the champagne pops.
    if (mansion.events.excuse) audio.fx('tick', 0.5);
    if (mansion.events.flash) audio.fx('camera', 0.7);
    if (mansion.events.drive) audio.fx('hiss', 0.45);
    if (mansion.events.hover && view.cashoutX100 === null) audio.fx('heartbeat', 0.6);
    if (running && !engineOn && mansion.engine.x > 0.5) { engineOn = true; audio.fx('engine', 0.8); }
    if (mansion.ended && !drained && mansion.endAge > DRAIN_AT) { drained = true; audio.fx('glug', 0.8); }
    if (running) audio.milestone(RUNGS.filter((r) => multiplier >= r).length);
    audio.update(view.phase, tension);
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    stepSpring(phonePunch, 0, 10, 0.4, dt);
    cashFlash = Math.max(0, cashFlash - dt / 0.4);
    const nextCaption = captionFor(view, multiplier, outcome, secured);
    if (nextCaption !== caption) {
      caption = nextCaption;
      captionPop.v = 6;
    }
    stepSpring(captionPop, 0, 12, 0.35, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    ctx.save();
    if (zoom > 0) { ctx.translate(PUNCH.x, PUNCH.y); ctx.scale(1 + zoom, 1 + zoom); ctx.translate(-PUNCH.x, -PUNCH.y); }
    if (shake > 0) ctx.translate(Math.sin(time * 140) * 6 * shake * shake, Math.cos(time * 117) * 4 * shake * shake);
    drawMansion(ctx, mansion, tension);
    if (actFade > 0.01) drawAct(ctx, act, actFade);
    drawDrone(ctx, mansion);
    drawParty(ctx, party, tension, view.stake !== null);
    drawBarbecue(ctx, mansion);
    drawPhone(ctx, mansion, multiplier, 1 + 0.12 * clamp(phonePunch.x, -0.5, 1.2));
    if (outcome && pop.x > 0.02 && mansion.endAge > 0.4) {
      ctx.save();
      ctx.translate(STAGE.w / 2, 330);
      ctx.rotate(-0.1);
      const k = clamp(pop.x, 0, 1.3);
      ctx.scale(k, k);
      const text = outcome === 'rekt' ? 'RUGGED' : outcome === 'called' ? 'DODGED' : 'I GOT HACKED';
      memeText(ctx, text, 0, 0, 84, outcome === 'rekt' ? '#ff4d6d' : '#ffe27a', 'center');
      ctx.restore();
    }
    ctx.restore();
    // The ticker is chrome, outside the punch-in, so its count never leaves the picture.
    drawTicker(ctx, party, multiplier);
    // The drone's flash and the green of an exit wash the whole picture.
    if (mansion.drone.flash > 0.02) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * mansion.drone.flash * mansion.drone.flash})`;
      ctx.fillRect(0, 0, STAGE.w, STAGE.h);
    }
    if (cashFlash > 0.02) {
      ctx.fillStyle = `rgba(124, 246, 124, ${0.22 * cashFlash})`;
      ctx.fillRect(0, 0, STAGE.w, STAGE.h);
    }

    capture(ctx);
    let rows = 1;
    if (caption) {
      ctx.save();
      ctx.font = `900 42px ${MEME_FONT}`;
      const lines = captionLines(ctx, caption);
      rows = lines.length;
      const width = Math.min(CAPTION_WIDTH, Math.max(...lines.map((line) => ctx.measureText(line).width)));
      const k = 1 + 0.1 * captionPop.x;
      ctx.translate(clearOfTicker(width, k), 56);
      ctx.scale(k, k);
      lines.forEach((line, i) => memeText(ctx, line, 0, i * 44, 42, '#ffffff', 'center', CAPTION_WIDTH));
      ctx.restore();
    }
    if (secured && badge.x > 0.02) {
      const text = `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× NOT HACKED`;
      ctx.save();
      ctx.font = `900 28px ${MEME_FONT}`;
      const k = clamp(badge.x, 0, 1.3);
      // Under the caption, however many lines it took.
      ctx.translate(clearOfTicker(ctx.measureText(text).width, k), 100 + 44 * (rows - 1) + Math.sin(time * 2) * 3);
      ctx.rotate(-0.02);
      ctx.scale(k, k);
      memeText(ctx, text, 0, 0, 28, '#7cf67c', 'center');
      ctx.restore();
    }
    const colour = outcome ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a';
    ctx.save();
    if (!running && !outcome) ctx.globalAlpha = 0.85;
    // Squeezed rather than spilling over the pop count in an absurdly long round.
    memeText(ctx, `${multiplier.toFixed(2)}×`, STAGE.w - 18, STAGE.h - 18, 52, colour, 'right', 560);
    ctx.restore();
    memeText(ctx, `${party.popIndex} ${party.popIndex === 1 ? 'POP' : 'POPS'}`, 190, STAGE.h - 18, 24, outcome ? '#ff9db0' : '#ffffff', 'left');
    // The portrait's phone line follows the close-up: the launch post, then the draft of the moment, then the post.
    const drafting = mansion.draft.x > 0.05;
    present(ctx, view, view.phase === 'running' && view.cashoutX100 === null && act.stage > 0 ? act.line : caption, mansion.posted ? 'PUBLIC STATEMENT' : drafting ? 'DRAFT — NOT POSTED' : 'LAUNCH POST', mansion.posted ? 'i got hacked' : drafting ? EXCUSES[mansion.excuse]!.slice(0, Math.floor(mansion.excuseAge / .028)) || '…' : 'new coin $FAMOUS is LIVE. love u all');
    if (dissolve > 0 && snapshot) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = smoothstep(0, 1, dissolve);
      ctx.drawImage(snapshot, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
      dissolve = Math.max(0, dissolve - dt / DISSOLVE);
    }
  }

  return { draw };
}
