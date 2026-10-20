/**
 * Rage Bait scene orchestrator: coordinates responsive layout (960×540 landscape
 * and 540×800 portrait), deterministic feed progression, character rig & springs,
 * confirmed cash-out precedence over crash, procedural Web Audio cues, and
 * assistive live summary updates.
 */

import { pageAudio, type Audio } from './audio';
import {
  createCharacterState,
  drawCharacterRoom,
  settleCharacter,
  updateCharacter,
  type CharacterState,
} from './character';
import {
  ACCOUNT_BY_ID,
  PALETTE,
  TUTORIAL_LINES,
  tierForX100,
  type Tier,
} from './content';
import {
  MAX_BURST_PARTICLES,
  MAX_LIVE_TOASTS,
  createEndingState,
  drawEndingOverlays,
  evaluateCameraPunch,
  updateEndings,
  type EndingState,
} from './endings';
import {
  MAX_RENDERED_SURFACES,
  activeFeedEntry,
  browseFeed,
  createFeed,
  currentDeckVariant,
  drawFeed,
  evaluateDraft,
  freezeFeedOnCrash,
  resetFeed,
  rotateDeckVariantOnBetting,
  settleFeed,
  stepFeed,
  toggleReplies,
  type FeedState,
} from './feed';
import { attachFeedInput } from './input';
import { getLayout, isPortrait, type SceneLayout } from './layout';

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

// Module-level continuity across `main.ts` phase-transition scene rebuilds
let lastObservedPhase: SceneView['phase'] | null = null;
let savedExitConfirmedAtMs: number | null = null;
let lastReplyPingAtMs = -10_000;
let lastPulseBeatAtMs = -10_000;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function formatX100(x100: number): string {
  return `${(Math.max(100, x100) / 100).toFixed(2)}x`;
}

// ---- Procedural Web Audio Cues over Shared Audio Bus (Page 10 & 16) ---------

function playTone(
  audio: Audio,
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  type: OscillatorType,
  peakGain: number,
  delaySec = 0,
): void {
  const ctx = audio.context;
  const out = audio.bus;
  if (!ctx || !out || !audio.enabled) return;
  const t0 = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t0);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + durationSec);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.015, durationSec * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.01);
}

function playCardAdvanceCue(audio: Audio): void {
  // Soft thumb-swipe whoosh and low wooden tick
  audio.fx('whoosh', 0.35);
  playTone(audio, 420, 260, 0.03, 'sine', 0.035, 0.02);
}

function playReplyPingCue(audio: Audio, nowMs: number): void {
  // Capped at at most two per second (>= 500ms apart, Page 10 & 16)
  if (nowMs - lastReplyPingAtMs < 500) return;
  lastReplyPingAtMs = nowMs;
  audio.fx('notify', 0.45);
}

function playDraftClusterCue(audio: Audio): void {
  // Short three-click key cluster once per draft escalation, never per character (Page 10)
  audio.fx('click', 0.35);
  playTone(audio, 580, 480, 0.022, 'triangle', 0.03, 0.045);
  playTone(audio, 500, 420, 0.025, 'triangle', 0.03, 0.09);
}

function playTensionPulseCue(audio: Audio, nowMs: number, tension: number): void {
  // Subtle low pulse above 5.00x, stopped immediately on cash-out or crash (Page 10)
  const intervalMs = 680 - tension * 220;
  if (nowMs - lastPulseBeatAtMs < intervalMs) return;
  lastPulseBeatAtMs = nowMs;
  audio.fx('heartbeat', 0.25 + tension * 0.25);
}

function playCrashStingerCue(audio: Audio): void {
  // Brief alert chord (< 1.2s total sequence)
  audio.crash('thud');
}

function playPostSendCue(audio: Audio): void {
  // Sharp send click at 0.12s crashAge
  audio.fx('click', 0.8);
  playTone(audio, 920, 340, 0.055, 'square', 0.05, 0);
}

function playTauntDropCue(audio: Audio): void {
  // Dry thud when the bait account's dismissive reply lands at 0.65s crashAge
  audio.fx('thud', 0.65);
}

function playExitDeleteCue(audio: Audio): void {
  // Crisp delete click + cashout chime on confirmed cash-out
  audio.cashout();
  audio.fx('click', 0.5);
}

function playExitLockCue(audio: Audio): void {
  // Phone-lock click + quiet exhale pad
  audio.fx('click', 0.45);
  playTone(audio, 261.6, 329.6, 0.35, 'sine', 0.035, 0.05);
}

// ---- Header & Tutorial Overlay Rendering ------------------------------------

function drawHeaderStrip(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  view: SceneView,
  tier: Tier,
  exitAgeSec: number | null,
): void {
  const { headerRect, portrait, fonts } = layout;
  const exited = view.cashoutX100 !== null && exitAgeSec !== null;
  const crashedLoss = view.phase === 'crashed' && !exited;

  ctx.save();
  ctx.fillStyle = '#111318';
  ctx.fillRect(headerRect.x, headerRect.y, headerRect.w, headerRect.h);
  ctx.strokeStyle = crashedLoss ? PALETTE.crashRed : exited ? PALETTE.lime : PALETTE.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(headerRect.x, headerRect.y + headerRect.h - 1);
  ctx.lineTo(headerRect.x + headerRect.w, headerRect.y + headerRect.h - 1);
  ctx.stroke();

  // Left: Game Title & Tier / Feed Status
  const leftX = 20;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.ivory;
  ctx.font = `900 ${fonts.title}px "Arial Black", Impact, system-ui, sans-serif`;
  ctx.fillText('RAGE BAIT', leftX, portrait ? 28 : 24);

  const tierDesc =
    view.phase === 'waiting'
      ? 'FEED IDLE · PLACE A BET'
      : view.phase === 'betting'
        ? 'NEXT FEED QUEUED · LOCK IN'
        : tier === 6
          ? 'TIER 6 · OVERTIME ALGORITHMIC CHAOS'
          : `TIER ${tier} · BAIT ESCALATION`;
  ctx.fillStyle = tier >= 5 && !exited ? PALETTE.orange : PALETTE.muted;
  ctx.font = `700 ${fonts.subtitle}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(tierDesc, leftX, portrait ? 52 : 48);

  // Center/Right: Large Tabular Multiplier (never covered by cards, hands, notifications, or stamps, Page 9)
  const multText = formatX100(view.currentX100);
  ctx.font = `900 ${fonts.multiplier}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.fillStyle = crashedLoss
    ? PALETTE.crashRed
    : exited
      ? PALETTE.lime
      : view.currentX100 >= 500
        ? PALETTE.orange
        : PALETTE.ivory;

  if (portrait) {
    ctx.textAlign = 'right';
    ctx.fillText(multText, headerRect.w - 20, 36);
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(multText, headerRect.w * 0.52, headerRect.h / 2 + 2);
  }

  // Personal Result / Spectator Status Pill on the right (or bottom strip in portrait)
  let statusText = '';
  let statusColor: string = PALETTE.muted;

  if (exited && view.cashoutX100 !== null) {
    const payoutPart = view.payout !== null ? ` · +${view.payout.toFixed(2)}` : '';
    statusText =
      view.phase === 'crashed'
        ? `CLOSED AT ${formatX100(view.cashoutX100)}${payoutPart} · YOU LEFT BEFORE THIS`
        : `APP CLOSED AT ${formatX100(view.cashoutX100)}${payoutPart}`;
    statusColor = PALETTE.lime;
  } else if (view.phase === 'crashed') {
    statusText =
      view.stake === null
        ? `SPECTATING · TIMELINE CRASHED AT ${multText}`
        : `TOOK THE BAIT AT ${multText} · POSTED`;
    statusColor = PALETTE.crashRed;
  } else if (view.phase === 'running') {
    statusText =
      view.stake === null
        ? 'SPECTATING · SCROLL OR TAP REPLIES'
        : `STAKE ${view.stake.toFixed(2)} · CASH OUT TO CLOSE APP`;
    statusColor = view.stake === null ? PALETTE.muted : PALETTE.ivory;
  } else if (view.phase === 'betting') {
    statusText = 'ROUND STARTING · DO NOT REPLY';
    statusColor = PALETTE.lime;
  } else {
    statusText = 'SCROLL · TAP REPLIES · CASH OUT BEFORE YOU POST';
    statusColor = PALETTE.muted;
  }

  ctx.font = `700 ${fonts.status}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = statusColor;
  if (portrait) {
    ctx.textAlign = 'left';
    ctx.fillText(statusText, leftX, 80, headerRect.w - 40);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText(statusText, headerRect.w - 20, headerRect.h / 2 + 2, 340);
  }

  ctx.restore();
}

function drawTutorialCard(
  ctx: CanvasRenderingContext2D,
  layout: SceneLayout,
  view: SceneView,
  elapsedMs: number,
): void {
  // Show during waiting, betting, or the first 3.5s of a round when not crashed/exited (Page 4, 5 & 11)
  if (view.cashoutX100 !== null || view.phase === 'crashed') return;
  if (view.phase === 'running' && elapsedMs > 3_500) return;

  const { tutorialRect, fonts } = layout;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(tutorialRect.x, tutorialRect.y, tutorialRect.w, tutorialRect.h, 10);
  ctx.fillStyle = 'rgba(17, 19, 24, 0.92)';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = PALETTE.border;
  ctx.stroke();

  ctx.fillStyle = PALETTE.ivory;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
  for (let i = 0; i < TUTORIAL_LINES.length; i++) {
    ctx.fillStyle = i === 0 ? PALETTE.lime : PALETTE.ivory;
    ctx.fillText(
      TUTORIAL_LINES[i]!,
      tutorialRect.x + 12,
      tutorialRect.y + 18 + i * 22,
      tutorialRect.w - 24,
    );
  }
  ctx.restore();
}

// ---- Assistive DOM Live Summary (Page 11 & 15) ------------------------------

function ensureAssistiveElement(canvas: HTMLCanvasElement): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('rage-bait-live');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rage-bait-live';
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
  if (canvas.getAttribute('aria-describedby') !== 'rage-bait-live') {
    canvas.setAttribute('aria-describedby', 'rage-bait-live');
  }
  return el;
}

// ---- Scene Factory ----------------------------------------------------------

export function createScene(canvasOverride?: HTMLCanvasElement): Scene {
  const canvas = canvasOverride ?? document.querySelector('canvas')!;
  const audio = pageAudio({ style: 'lofi', crash: 'thud' });
  const liveEl = ensureAssistiveElement(canvas);

  const feed: FeedState = createFeed(currentDeckVariant());
  const character: CharacterState = createCharacterState();
  const endings: EndingState = createEndingState();
  if (savedExitConfirmedAtMs !== null) {
    endings.exitConfirmedAtMs = savedExitConfirmedAtMs;
    endings.exitDeleteFired = true;
    endings.exitLockFired = true;
  }

  let initialized = false;
  let lastDrawWallMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let lastAnnouncedKey = '';
  let pendingReplyToggleEvent = false;
  let activeLayout: SceneLayout = getLayout(isPortrait(canvas), feed.threadExpanded);

  let latestPhase: SceneView['phase'] = 'waiting';
  let latestX100 = 100;
  let latestElapsedMs = 0;

  const inputController = attachFeedInput(canvas, {
    getLayout: () => activeLayout,
    onScrollPrevious: () => {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (browseFeed(feed, -1, latestPhase, latestX100, latestElapsedMs, nowMs)) {
        playCardAdvanceCue(audio);
      }
    },
    onScrollNext: () => {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (browseFeed(feed, 1, latestPhase, latestX100, latestElapsedMs, nowMs)) {
        playCardAdvanceCue(audio);
      }
    },
    onToggleReplies: (forceCollapse = false) => {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const before = feed.threadExpanded;
      toggleReplies(feed, nowMs, forceCollapse);
      if (feed.threadExpanded !== before) {
        pendingReplyToggleEvent = true;
        playReplyPingCue(audio, nowMs);
      }
    },
  });

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

      const dtSec = clamp((nowMs - lastDrawWallMs) / 1000, 0.001, 0.05);
      lastDrawWallMs = nowMs;

      // Support both millisecond inputs (from `main.ts`) and small second inputs if passed by unit tests
      const elapsedMs = Math.max(
        0,
        view.elapsed > 0 && view.elapsed < 60 && Number.isFinite(view.elapsed) && !Number.isInteger(view.elapsed)
          ? view.elapsed * 1000
          : view.elapsed,
      );
      const crashAgeSec = Math.max(
        0,
        view.crashAge > 10 ? view.crashAge / 1000 : view.crashAge,
      );

      const x = Math.max(1, view.currentX100 / 100);
      const tension = clamp(1 - 1 / x, 0, 1);
      const tier = tierForX100(view.currentX100);

      latestPhase = view.phase;
      latestX100 = view.currentX100;
      latestElapsedMs = elapsedMs;

      const portrait = isPortrait(canvas);

      // Detect phase transitions vs late entry (Pages 13 & 16)
      const isFirstDraw = !initialized;
      initialized = true;

      if (view.phase === 'waiting' || view.phase === 'betting') {
        savedExitConfirmedAtMs = null;
      }

      if (view.phase === 'betting' && lastObservedPhase !== 'betting') {
        const nextVariant = rotateDeckVariantOnBetting();
        resetFeed(feed, nextVariant);
      } else if (
        view.phase === 'waiting' &&
        lastObservedPhase !== 'waiting' &&
        lastObservedPhase !== null
      ) {
        resetFeed(feed, currentDeckVariant());
      }

      // Determine whether this draw is a mid-round/post-crash late entry without a prior live session
      const isSameRoundPhaseTransition =
        lastObservedPhase === 'running' && view.phase === 'crashed';
      const isLateEntry =
        isFirstDraw &&
        !isSameRoundPhaseTransition &&
        ((view.phase === 'running' && elapsedMs > 450) ||
          view.phase === 'crashed' ||
          (view.cashoutX100 !== null && savedExitConfirmedAtMs === null));

      // 1. Evaluate confirmed cash-out BEFORE crash presentation on every frame (Page 15)
      updateEndings(endings, {
        phase: view.phase,
        cashoutX100: view.cashoutX100,
        crashAgeSec,
        nowMs,
        silentLateEntry: isLateEntry,
      });
      savedExitConfirmedAtMs = endings.exitConfirmedAtMs;

      // Update background music bus (stops tension rise once cashed out)
      audio.update(
        endings.exitAgeSec !== null ? 'waiting' : view.phase,
        endings.exitAgeSec !== null ? 0 : tension,
      );

      // 2. Update or settle the social feed
      if (isFirstDraw) {
        settleFeed(feed, view.phase, view.currentX100, elapsedMs, nowMs);
      } else if (view.phase === 'crashed' && endings.exitAgeSec === null) {
        freezeFeedOnCrash(feed, view.currentX100);
      } else {
        stepFeed(
          feed,
          view.phase,
          view.currentX100,
          elapsedMs,
          nowMs,
          dtSec,
          endings.exitAgeSec !== null,
        );
      }

      lastObservedPhase = view.phase;
      activeLayout = getLayout(portrait, feed.threadExpanded);

      // 3. Evaluate draft & update/settle character rig and springs
      const draft = evaluateDraft(
        feed,
        view.phase,
        view.currentX100,
        elapsedMs,
        crashAgeSec,
        endings.exitAgeSec,
      );
      const entry = activeFeedEntry(feed, view.phase);

      const charInput = {
        phase: view.phase,
        currentX100: view.currentX100,
        elapsedMs,
        crashAgeSec,
        exitAgeSec: endings.exitAgeSec,
        tension,
        dtSec,
        draft,
        propKind: entry.propKind,
        cardAdvanceEvent: feed.events.cardAdvance,
        replyToggleEvent: pendingReplyToggleEvent,
      };
      pendingReplyToggleEvent = false;

      if (isLateEntry) {
        settleCharacter(character, charInput);
      } else {
        updateCharacter(character, charInput);
      }

      // 4. Fire procedural audio cues (never during silent late entry, Page 10 & 16)
      if (!isLateEntry) {
        if (endings.events.exitDelete) {
          playExitDeleteCue(audio);
        }
        if (endings.events.exitLock) {
          playExitLockCue(audio);
        }
        if (endings.exitAgeSec === null) {
          if (feed.events.cardAdvance) {
            playCardAdvanceCue(audio);
          }
          if (feed.events.newReply) {
            playReplyPingCue(audio, nowMs);
          }
          if (feed.events.draftCluster) {
            playDraftClusterCue(audio);
          }
          if (view.phase === 'running' && view.currentX100 >= 500) {
            playTensionPulseCue(audio, nowMs, tension);
          }
          if (endings.events.crashStinger) {
            playCrashStingerCue(audio);
          }
          if (endings.events.postSend) {
            playPostSendCue(audio);
          }
          if (endings.events.tauntDrop) {
            playTauntDropCue(audio);
          }
        }
      }

      // 5. Update assistive live summary only when card, phase, or exit status changes (Page 11 & 15)
      const account = ACCOUNT_BY_ID[entry.card.accountId] ?? ACCOUNT_BY_ID['engagement-dept']!;
      const announceKey = `${view.phase}:${entry.card.id}:${feed.threadExpanded}:${view.cashoutX100 !== null}`;
      if (liveEl && announceKey !== lastAnnouncedKey) {
        lastAnnouncedKey = announceKey;
        const stateLabel =
          view.cashoutX100 !== null
            ? `App closed at ${formatX100(view.cashoutX100)}. Draft deleted.`
            : view.phase === 'crashed'
              ? `Took the bait at ${formatX100(view.currentX100)}.`
              : `Phase ${view.phase}, multiplier ${formatX100(view.currentX100)}.`;
        liveEl.textContent = `${stateLabel} ${account.name} (${account.handle}): "${entry.card.post}" Top reply: "${entry.card.topReply}"`;
      }

      // 6. Render scene onto the 2D canvas using activeLayout logical space (960×540 or 540×800)
      ctx.save();
      const cw = canvas.width || activeLayout.width;
      const ch = canvas.height || activeLayout.height;
      ctx.setTransform(cw / activeLayout.width, 0, 0, ch / activeLayout.height, 0, 0);

      ctx.fillStyle = PALETTE.charcoal;
      ctx.fillRect(0, 0, activeLayout.width, activeLayout.height);

      // Apply compact camera punch during crash 0.12-0.65s window (never covers or shakes header multiplier)
      const punch = evaluateCameraPunch(view.phase, crashAgeSec, endings.exitAgeSec);
      ctx.save();
      if (punch.scale !== 1 || punch.offsetX !== 0 || punch.offsetY !== 0) {
        const cx = activeLayout.width / 2;
        const cy = activeLayout.height / 2;
        ctx.translate(cx + punch.offsetX, cy + punch.offsetY);
        ctx.scale(punch.scale, punch.scale);
        ctx.translate(-cx, -cy);
      }

      drawCharacterRoom(ctx, character, activeLayout, {
        phase: view.phase,
        tension,
        crashAgeSec,
        exitAgeSec: endings.exitAgeSec,
        propKind: entry.propKind,
        nowMs,
      });

      drawFeed(ctx, feed, activeLayout, {
        phase: view.phase,
        currentX100: view.currentX100,
        elapsedMs,
        crashAgeSec,
        exitAgeSec: endings.exitAgeSec,
        tension,
        nowMs,
      });

      drawEndingOverlays(ctx, endings, activeLayout, {
        phase: view.phase,
        crashAgeSec,
        exitAgeSec: endings.exitAgeSec,
        stake: view.stake,
        cashoutX100: view.cashoutX100,
        payout: view.payout,
        currentX100: view.currentX100,
      });

      drawTutorialCard(ctx, activeLayout, view, elapsedMs);
      ctx.restore(); // End camera punch

      // Draw header strip last so the multiplier is never covered by cards, hands, notifications, or stamps (Page 9)
      drawHeaderStrip(ctx, activeLayout, view, tier, endings.exitAgeSec);
      ctx.restore();

      // Expose read-only diagnostic snapshot for automated verification
      (canvas as unknown as Record<string, unknown>).__rageBaitState = {
        phase: view.phase,
        portrait,
        width: activeLayout.width,
        height: activeLayout.height,
        tier,
        tension,
        variant: feed.variant,
        activeCardId: entry.card.id,
        activeAccountId: entry.card.accountId,
        overtimeAct: entry.overtimeAct,
        propKind: entry.propKind,
        followupText: entry.followupText,
        historyLength: feed.history.length,
        historyCursor: feed.historyCursor,
        threadExpanded: feed.threadExpanded,
        draftId: draft.item.id,
        draftText: draft.visibleText,
        draftSelected: draft.selected,
        draftDeleted: draft.deleted,
        hoveringPost: draft.hoveringPost,
        thumbAction: character.thumbAction,
        expression: character.expression,
        exitAgeSec: endings.exitAgeSec,
        appClosed: endings.exitAgeSec !== null && endings.exitAgeSec >= 0.25,
        tookTheBait: view.phase === 'crashed' && endings.exitAgeSec === null && crashAgeSec >= 1.05,
        renderedSurfaceCap: MAX_RENDERED_SURFACES,
        activeParticleCount:
          view.phase === 'crashed' && endings.exitAgeSec === null && crashAgeSec >= 0.30 && crashAgeSec <= 1.25
            ? MAX_BURST_PARTICLES
            : 0,
        activeToastCount:
          view.phase === 'crashed' && endings.exitAgeSec === null && crashAgeSec >= 0.32
            ? MAX_LIVE_TOASTS
            : 0,
        layout: activeLayout,
      };
    },

    dispose(): void {
      inputController.dispose();
    },
  };
}
