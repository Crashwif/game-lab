/**
 * BRO-MAXXED scene orchestrator (Page 24).
 *
 * Consumes `phase`, `currentX100`, `elapsed`, `crashAge`, `stake`, `cashoutX100`,
 * and `payout` from the canonical Game Lab shell. Enforces strict outcome
 * precedence (`cashoutX100 !== null` -> `drawAcceptedExit`, `phase === 'crashed'` ->
 * `drawRomanticCrash`, `phase === 'running'` -> `drawRunningScene`, else
 * `drawWaitingOrBetting`), drives the character rigs and deterministic comedy
 * director, and fires procedural audio cues on live transitions only.
 */

import { pageAudio, type Audio } from './audio';
import {
  computeCastPose,
  createCast,
  resetCast,
  settleCast,
  stepCast,
  type CastPose,
  type CastState,
} from './cast';
import { OUTFIT_PALETTES, SPONSOR_STICKERS } from './content';
import {
  evaluateDirector,
  type DirectedBeat,
} from './director';
import { clamp } from './motion';
import {
  clientToLayout,
  getSceneLayout,
  isPortrait,
  pointInRect,
  type SceneLayout,
} from './portrait';
import {
  MAX_PARTICLES,
  countActiveParticles,
  createStage,
  drawStage,
  resetStageParticles,
  stepStage,
  type StageState,
} from './stage';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  /** The displayed multiplier in hundredths; the crash point once crashed. */
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
  draw(
    ctxOrView: CanvasRenderingContext2D | SceneView,
    maybeView?: SceneView,
    maybeNow?: number,
  ): void;
  dispose?(): void;
}

function formatX(x100: number): string {
  return `${(Math.max(100, x100) / 100).toFixed(2)}×`;
}

// ---- Procedural Web Audio Accents on the Shared Bus (Page 22) ---------------

function playSynthNote(
  audio: Audio,
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  type: OscillatorType,
  peakGain: number,
  delaySec = 0,
): void {
  const ctx = audio.context;
  const bus = audio.bus;
  if (!ctx || !bus || !audio.enabled) return;
  const t0 = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t0);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + durationSec);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.02, durationSec * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
  osc.connect(gain).connect(bus);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.02);
}

function playComplimentCue(audio: Audio): void {
  // Page 22: "The cleanest sound in the game" when Milo says "Looking good, bro."
  playSynthNote(audio, 523.25, 523.25, 0.22, 'sine', 0.045, 0);
  playSynthNote(audio, 659.25, 659.25, 0.32, 'sine', 0.05, 0.12);
}

function playWeddingFlourishCue(audio: Audio): void {
  // Page 22: "A shamelessly lush romantic flourish."
  audio.fx('cheer', 0.4);
  playSynthNote(audio, 261.63, 261.63, 0.65, 'triangle', 0.04, 0);
  playSynthNote(audio, 329.63, 329.63, 0.65, 'triangle', 0.04, 0.06);
  playSynthNote(audio, 392.0, 392.0, 0.65, 'triangle', 0.04, 0.12);
  playSynthNote(audio, 493.88, 523.25, 0.75, 'sine', 0.045, 0.18);
}

// ---- Header Strip & Explicit State Renderers (Page 24) ----------------------

function drawHeaderBar(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  view: SceneView,
  beat: DirectedBeat,
): void {
  const { headerRect, portrait, fonts } = layout;
  const exited = beat.mode === 'cashout';
  const crashed = beat.mode === 'crashed';

  ctx.save();
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(headerRect.x, headerRect.y, headerRect.w, headerRect.h);
  ctx.strokeStyle = exited ? '#bef264' : crashed ? '#f472b6' : '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(headerRect.x, headerRect.y + headerRect.h - 1);
  ctx.lineTo(headerRect.x + headerRect.w, headerRect.y + headerRect.h - 1);
  ctx.stroke();

  // Left: Game Title & Band Subtitle
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.font = `900 ${fonts.title}px "Arial Black", Impact, system-ui, sans-serif`;
  ctx.fillText('BRO-MAXXED', 18, portrait ? 26 : 21);

  const subTitle = exited
    ? 'TOUCH GRASS · DEPARTURE COMPLETE'
    : crashed
      ? 'MOGGED BY LOVE · BRAND COLLAPSED'
      : view.phase === 'running'
        ? `BAND ${beat.band} · ${beat.bandSpec.title}`
        : 'HE CAME TO MOG · HE STAYED FOR THE SPOTTER';
  ctx.fillStyle = exited ? '#bef264' : crashed ? '#f472b6' : '#94a3b8';
  ctx.font = '700 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(subTitle, 18, portrait ? 48 : 44);

  // Center / Right: Large Tabular Multiplier (never obscured by props or captions)
  const displayX100 =
    exited && view.cashoutX100 !== null ? view.cashoutX100 : Math.max(100, view.currentX100);
  const multStr = formatX(displayX100);
  ctx.font = `900 ${fonts.multiplier}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.fillStyle = exited
    ? '#bef264'
    : crashed
      ? '#f472b6'
      : view.currentX100 >= 300
        ? '#fde047'
        : '#ffffff';

  if (portrait) {
    ctx.textAlign = 'right';
    ctx.fillText(multStr, headerRect.w - 18, 34);
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(multStr, headerRect.w * 0.5, headerRect.h / 2 + 2);
  }

  // Right (or bottom row in portrait): Accurate Player / Spectator Outcome Status (Page 4 & 29)
  let statusText = '';
  let statusColor = '#cbd5e1';

  if (exited && view.cashoutX100 !== null) {
    const payoutStr = view.payout !== null ? ` · +${view.payout.toFixed(0)} CREDITS` : '';
    statusText =
      view.phase === 'crashed'
        ? `TOUCH GRASS AT ${formatX(view.cashoutX100)}${payoutStr} (ROUND LATER CRASHED)`
        : `TOUCH GRASS AT ${formatX(view.cashoutX100)}${payoutStr}`;
    statusColor = '#bef264';
  } else if (crashed) {
    statusText =
      view.stake === null
        ? `SPECTATING · MOGGED BY LOVE AT ${formatX(view.currentX100)}`
        : `MOGGED BY LOVE AT ${formatX(view.currentX100)} · STAKE LOST (${view.stake} CREDITS)`;
    statusColor = '#fda4af';
  } else if (view.phase === 'running') {
    statusText =
      view.stake === null
        ? 'SPECTATING · WATCHING REX OPTIMIZE'
        : `IN ROUND (${view.stake} CREDITS) · CASH OUT TO TOUCH GRASS`;
    statusColor = view.stake === null ? '#94a3b8' : '#d5fb6d';
  } else if (view.phase === 'betting') {
    statusText =
      view.stake !== null
        ? `JOINED (${view.stake} CREDITS) · OPENING SELF-IMPROVEMENT APP`
        : 'BETTING OPEN · JOIN ROUND OR SPECTATE';
    statusColor = '#d5fb6d';
  } else {
    statusText = 'WAITING FOR NEXT ROUND · REX CHECKING REFLECTION';
    statusColor = '#94a3b8';
  }

  ctx.font = `700 ${fonts.status}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = statusColor;
  if (portrait) {
    ctx.textAlign = 'left';
    ctx.fillText(statusText, 18, 72, headerRect.w - 36);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText(statusText, headerRect.w - 18, headerRect.h / 2 + 2, 360);
  }

  ctx.restore();
}

function ensureAssistiveLiveRegion(canvas: HTMLCanvasElement): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('bro-maxxed-live');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bro-maxxed-live';
    el.setAttribute('aria-live', 'polite');
    el.style.position = 'absolute';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.padding = '0';
    el.style.margin = '-1px';
    el.style.overflow = 'hidden';
    el.style.clip = 'rect(0, 0, 0, 0)';
    el.style.whiteSpace = 'nowrap';
    el.style.border = '0';
    const parent = canvas.parentElement ?? document.body;
    parent.appendChild(el);
  }
  if (canvas.getAttribute('aria-describedby') !== 'bro-maxxed-live') {
    canvas.setAttribute('aria-describedby', 'bro-maxxed-live');
  }
  return el;
}

export function createScene(canvasOverride?: HTMLCanvasElement): Scene {
  const canvas = canvasOverride ?? document.querySelector('canvas')!;
  const audio = pageAudio({ style: 'club', crash: 'pop' });
  const liveRegion = ensureAssistiveLiveRegion(canvas);

  const cast: CastState = createCast();
  const stage: StageState = createStage();

  let initialized = false;
  let lastWallMs: number | null = null;
  let lastPhase: SceneView['phase'] | null = null;
  let lastCashoutX100: number | null = null;
  let localCashoutAgeSec: number | null = null;
  let crashCueFired = false;
  let complimentCueFired = false;
  let weddingCueFired = false;
  let lastAnnouncedKey = '';
  let activeLayout: SceneLayout = getSceneLayout(isPortrait(canvas));

  // Optional cosmetic & clean-language click handler on the non-intrusive pill
  const onPointerDown = (event: PointerEvent) => {
    const pt = clientToLayout(canvas, event.clientX, event.clientY, activeLayout);
    if (pointInRect(pt, activeLayout.cosmeticBarRect)) {
      const relX = (pt.x - activeLayout.cosmeticBarRect.x) / activeLayout.cosmeticBarRect.w;
      if (relX > 0.68) {
        stage.cleanLanguage = !stage.cleanLanguage;
      } else if (relX > 0.35) {
        stage.stickerIndex = (stage.stickerIndex + 1) % SPONSOR_STICKERS.length;
      } else {
        stage.paletteIndex = (stage.paletteIndex + 1) % OUTFIT_PALETTES.length;
      }
      audio.fx('click', 0.35);
    }
  };

  if (typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('pointerdown', onPointerDown);
  }

  // The four explicit state drawing entry points matching the Page 24 frame contract
  function drawAcceptedExit(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    pose: CastPose,
    beat: DirectedBeat,
  ): void {
    drawStage(ctx, stage, pose, beat, activeLayout, cast.time);
    drawHeaderBar(ctx, activeLayout, view, beat);
  }

  function drawRomanticCrash(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    pose: CastPose,
    beat: DirectedBeat,
  ): void {
    drawStage(ctx, stage, pose, beat, activeLayout, cast.time);
    drawHeaderBar(ctx, activeLayout, view, beat);
  }

  function drawRunningScene(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    pose: CastPose,
    beat: DirectedBeat,
  ): void {
    drawStage(ctx, stage, pose, beat, activeLayout, cast.time);
    drawHeaderBar(ctx, activeLayout, view, beat);
  }

  function drawWaitingOrBetting(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    pose: CastPose,
    beat: DirectedBeat,
  ): void {
    drawStage(ctx, stage, pose, beat, activeLayout, cast.time);
    drawHeaderBar(ctx, activeLayout, view, beat);
  }

  return {
    draw(
      ctxOrView: CanvasRenderingContext2D | SceneView,
      maybeView?: SceneView,
      maybeNow?: number,
    ): void {
      const isDirectView = 'phase' in ctxOrView;
      const ctx = isDirectView ? canvas.getContext('2d')! : ctxOrView;
      const view = isDirectView ? ctxOrView : maybeView!;
      const nowMs =
        maybeNow ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());

      const rawDtSec = lastWallMs === null ? 0 : Math.max(0, (nowMs - lastWallMs) / 1000);
      const dtSec = clamp(rawDtSec, 0, 0.1);
      lastWallMs = nowMs;

      const elapsedMs = Math.max(0, view.elapsed);
      const crashAgeSec = Math.max(0, view.crashAge / 1000);
      const portrait = isPortrait(canvas);
      activeLayout = getSceneLayout(portrait);

      const isFirstDraw = !initialized;
      initialized = true;

      // Reset round-scoped flags on waiting or betting
      if (
        (view.phase === 'waiting' || view.phase === 'betting') &&
        lastPhase !== view.phase &&
        lastPhase !== null
      ) {
        localCashoutAgeSec = null;
        lastCashoutX100 = null;
        crashCueFired = false;
        complimentCueFired = false;
        weddingCueFired = false;
        resetCast(cast);
        resetStageParticles(stage);
      }

      // Detect late entry (created mid-round, already crashed, or already cashed out on first draw,
      // or after a tab-resume gap > 1.0s)
      const isLateEntry =
        (isFirstDraw &&
          ((view.phase === 'running' && elapsedMs > 500) ||
            view.phase === 'crashed' ||
            view.cashoutX100 !== null)) ||
        rawDtSec > 1.0;

      // Track confirmed cashout age (Page 11 & 25):
      // Locally observed acceptance plays a 1.1s departure; reconstructed late entry starts settled (2.0s).
      let cashoutJustConfirmedLive = false;
      if (view.cashoutX100 !== null) {
        if (lastCashoutX100 === null) {
          if (isFirstDraw) {
            localCashoutAgeSec = 2.0; // Settled exit pose on late entry
          } else {
            localCashoutAgeSec = 0;
            cashoutJustConfirmedLive = true;
          }
        } else if (localCashoutAgeSec !== null) {
          localCashoutAgeSec += rawDtSec;
        }
      } else {
        localCashoutAgeSec = null;
      }
      lastCashoutX100 = view.cashoutX100;

      // Evaluate deterministic comedy director
      const beat = evaluateDirector({
        phase: view.phase,
        currentX100: view.currentX100,
        elapsedMs,
        crashAgeSec,
        cashoutX100: view.cashoutX100,
        cashoutAgeSec: localCashoutAgeSec,
        cleanLanguage: stage.cleanLanguage,
        romanticVariantOverride: stage.endingPreviewIndex,
      });

      // Settle on first draw or late entry; step springs otherwise
      if (isFirstDraw || isLateEntry) {
        settleCast(cast, beat, activeLayout);
        stepStage(stage, beat, activeLayout, 0, true);
        if (isFirstDraw && view.phase === 'crashed' && view.cashoutX100 === null) {
          audio.crash('pop', true);
          crashCueFired = true;
          complimentCueFired = crashAgeSec >= 0.12;
          weddingCueFired = crashAgeSec >= 2.3;
        }
      } else {
        stepCast(cast, beat, activeLayout, dtSec);
        stepStage(stage, beat, activeLayout, dtSec, false);
      }

      // Update shared audio bus and fire one-shot cues on live edges only (Page 22 & 25)
      const musicPhase = view.cashoutX100 !== null ? 'waiting' : view.phase;
      const musicTension = view.cashoutX100 !== null ? 0 : beat.tension;
      audio.update(musicPhase, musicTension);

      if (!isFirstDraw && !isLateEntry) {
        if (cashoutJustConfirmedLive) {
          audio.cashout();
          audio.fx('door', 0.5);
        } else if (view.cashoutX100 === null) {
          if (view.phase === 'running') {
            if (cast.events.bandUp) {
              audio.milestone(beat.band - 1);
              audio.fx('click', 0.45);
              if (beat.band >= 3) audio.fx('ratchet', 0.35);
            } else if (cast.events.poseWhoosh) {
              audio.fx('whoosh', 0.3);
            }
          } else if (view.phase === 'crashed') {
            if (!crashCueFired) {
              crashCueFired = true;
              const quiet = crashAgeSec > 1.5;
              audio.crash('pop', quiet);
              if (!quiet) audio.fx('click', 0.7);
            }
            if (!complimentCueFired && crashAgeSec >= 0.12 && crashAgeSec < 1.5) {
              complimentCueFired = true;
              playComplimentCue(audio);
            }
            if (!weddingCueFired && crashAgeSec >= 2.3 && crashAgeSec < 4.5) {
              weddingCueFired = true;
              playWeddingFlourishCue(audio);
            }
          }
        }
      }

      lastPhase = view.phase;

      // Solve pure world-space character and reflection poses
      const pose = computeCastPose(cast, beat, activeLayout);

      // Update assistive live summary when beat changes
      const announceKey = `${beat.mode}:${beat.band}:${beat.slotIndex}:${beat.crashStage}:${view.cashoutX100}`;
      if (liveRegion && announceKey !== lastAnnouncedKey) {
        lastAnnouncedKey = announceKey;
        liveRegion.textContent = `${beat.captionSpeaker}: ${beat.captionText} (${beat.gag.title})`;
      }

      // Render using the Page 24 frame contract
      ctx.save();
      const cw = canvas.width || activeLayout.width;
      const ch = canvas.height || activeLayout.height;
      ctx.setTransform(cw / activeLayout.width, 0, 0, ch / activeLayout.height, 0, 0);

      if (view.cashoutX100 !== null) {
        drawAcceptedExit(ctx, view, pose, beat);
      } else if (view.phase === 'crashed') {
        drawRomanticCrash(ctx, view, pose, beat);
      } else if (view.phase === 'running') {
        drawRunningScene(ctx, view, pose, beat);
      } else {
        drawWaitingOrBetting(ctx, view, pose, beat);
      }

      ctx.restore();

      // Expose read-only diagnostic state for automated tests
      const handHoldDist = Math.hypot(
        pose.rex.rightArm.end.x - pose.milo.leftArm.end.x,
        pose.rex.rightArm.end.y - pose.milo.leftArm.end.y,
      );
      (canvas as unknown as Record<string, unknown>).__broMaxxedState = {
        phase: view.phase,
        mode: beat.mode,
        portrait,
        width: activeLayout.width,
        height: activeLayout.height,
        band: beat.band,
        bandTitle: beat.bandSpec.title,
        tension: beat.tension,
        slotIndex: beat.slotIndex,
        gagId: beat.gag.id,
        gagStage: beat.gagStage,
        dialogueId: beat.dialogue.id,
        captionSpeaker: beat.captionSpeaker,
        captionText: beat.captionText,
        crowdCommentId: beat.crowdComment.id,
        crowdCommentText: beat.crowdCommentText,
        productId: beat.product.id,
        lateProgramId: beat.lateProgram?.spec.id ?? null,
        lateProgramPhase: beat.lateProgram?.phase ?? null,
        cashoutVariantId: beat.cashoutVariant?.id ?? null,
        cashoutSettled: beat.cashoutSettled,
        crashStage: beat.crashStage,
        crashVariantId: beat.crashVariant?.id ?? null,
        instantCrash: beat.instantCrash,
        outcomeHeadline: beat.outcomeHeadline,
        outcomeSubline: beat.outcomeSubline,
        handHoldBlend: pose.handHoldBlend,
        handHoldDistancePx: handHoldDist,
        activeParticleCount: countActiveParticles(stage),
        maxParticles: MAX_PARTICLES,
        cleanLanguage: stage.cleanLanguage,
        paletteId: OUTFIT_PALETTES[stage.paletteIndex % OUTFIT_PALETTES.length]!.id,
        sticker: SPONSOR_STICKERS[stage.stickerIndex % SPONSOR_STICKERS.length]!,
        pose,
        layout: activeLayout,
        setCleanLanguage: (clean: boolean) => {
          stage.cleanLanguage = clean;
        },
        setEndingPreview: (idx: number | null) => {
          stage.endingPreviewIndex = idx;
        },
      };
    },

    dispose(): void {
      if (typeof canvas.removeEventListener === 'function') {
        canvas.removeEventListener('pointerdown', onPointerDown);
      }
    },
  };
}
