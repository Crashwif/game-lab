/**
 * Crash-age and confirmed cash-out endings, pre-allocated 36-particle
 * notification burst pool, up-to-3 live notification toasts, camera punch,
 * result stamps (`TOOK THE BAIT` / `APP CLOSED`), and spectator copy.
 */

import { PALETTE, SUCCESS_CAPTIONS } from './content';
import type { SceneLayout } from './layout';

export const MAX_BURST_PARTICLES = 36;
export const MAX_LIVE_TOASTS = 3;

export interface BurstParticle {
  vx: number;
  vy: number;
  size: number;
  kind: 'heart' | 'reply' | 'quote' | 'alert';
  color: string;
  spin: number;
}

export interface LiveToast {
  label: string;
  triggerSec: number;
}

const TOAST_TEMPLATES: readonly LiveToast[] = [
  { label: '🔔 +99 quote posts incoming', triggerSec: 0.32 },
  { label: '📸 Screenshotted by @couplescourt', triggerSec: 0.46 },
  { label: '📈 Added to "Unhinged Replies" thread', triggerSec: 0.58 },
];

export interface EndingEvents {
  crashStinger: boolean;
  postSend: boolean;
  tauntDrop: boolean;
  exitDelete: boolean;
  exitLock: boolean;
}

export interface EndingState {
  exitConfirmedAtMs: number | null;
  exitAgeSec: number | null;
  crashStingerFired: boolean;
  postSendFired: boolean;
  tauntDropFired: boolean;
  exitDeleteFired: boolean;
  exitLockFired: boolean;
  particles: BurstParticle[];
  events: EndingEvents;
}

function createBurstPool(): BurstParticle[] {
  const colors = [PALETTE.crashRed, PALETTE.orange, PALETTE.lime, PALETTE.ivory];
  const kinds: BurstParticle['kind'][] = ['heart', 'reply', 'quote', 'alert'];
  const pool: BurstParticle[] = [];
  for (let i = 0; i < MAX_BURST_PARTICLES; i++) {
    const angle = (i / MAX_BURST_PARTICLES) * Math.PI * 2 + (i % 3) * 0.14;
    const speed = 95 + (i % 5) * 42;
    pool.push({
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 35,
      size: 6 + (i % 4) * 2.2,
      kind: kinds[i % kinds.length]!,
      color: colors[i % colors.length]!,
      spin: (i % 2 === 0 ? 1 : -1) * (1.5 + (i % 4) * 0.6),
    });
  }
  return pool;
}

export function createEndingState(): EndingState {
  return {
    exitConfirmedAtMs: null,
    exitAgeSec: null,
    crashStingerFired: false,
    postSendFired: false,
    tauntDropFired: false,
    exitDeleteFired: false,
    exitLockFired: false,
    particles: createBurstPool(),
    events: {
      crashStinger: false,
      postSend: false,
      tauntDrop: false,
      exitDelete: false,
      exitLock: false,
    },
  };
}

export function resetEndingState(state: EndingState): void {
  state.exitConfirmedAtMs = null;
  state.exitAgeSec = null;
  state.crashStingerFired = false;
  state.postSendFired = false;
  state.tauntDropFired = false;
  state.exitDeleteFired = false;
  state.exitLockFired = false;
  state.events.crashStinger = false;
  state.events.postSend = false;
  state.events.tauntDrop = false;
  state.events.exitDelete = false;
  state.events.exitLock = false;
}

export interface EndingUpdateInput {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  cashoutX100: number | null;
  crashAgeSec: number;
  nowMs: number;
  silentLateEntry?: boolean;
}

/**
 * Evaluate confirmed cash-out BEFORE crash presentation on every frame (Page 15).
 */
export function updateEndings(state: EndingState, input: EndingUpdateInput): void {
  state.events.crashStinger = false;
  state.events.postSend = false;
  state.events.tauntDrop = false;
  state.events.exitDelete = false;
  state.events.exitLock = false;

  if (input.phase === 'waiting' || input.phase === 'betting') {
    resetEndingState(state);
    return;
  }

  // Confirmed cash-out takes precedence over crash presentation
  if (input.cashoutX100 !== null) {
    if (state.exitConfirmedAtMs === null) {
      state.exitConfirmedAtMs = input.silentLateEntry ? input.nowMs - 1_200 : input.nowMs;
      if (input.silentLateEntry) {
        state.exitDeleteFired = true;
        state.exitLockFired = true;
      }
    }
    state.exitAgeSec = Math.max(0, (input.nowMs - state.exitConfirmedAtMs) / 1000);

    if (!state.exitDeleteFired && state.exitAgeSec >= 0) {
      state.exitDeleteFired = true;
      if (!input.silentLateEntry) {
        state.events.exitDelete = true;
      }
    }
    if (!state.exitLockFired && state.exitAgeSec >= 0.25) {
      state.exitLockFired = true;
      if (!input.silentLateEntry) {
        state.events.exitLock = true;
      }
    }
    return;
  }

  state.exitConfirmedAtMs = null;
  state.exitAgeSec = null;

  // Crash sequence (only when cashoutX100 === null)
  if (input.phase === 'crashed') {
    if (input.silentLateEntry) {
      state.crashStingerFired = true;
      state.postSendFired = true;
      state.tauntDropFired = true;
      return;
    }

    if (!state.crashStingerFired && input.crashAgeSec >= 0) {
      state.crashStingerFired = true;
      state.events.crashStinger = true;
    }
    if (!state.postSendFired && input.crashAgeSec >= 0.12) {
      state.postSendFired = true;
      state.events.postSend = true;
    }
    if (!state.tauntDropFired && input.crashAgeSec >= 0.65) {
      state.tauntDropFired = true;
      state.events.tauntDrop = true;
    }
  }
}

/**
 * Compute the compact camera punch during the `0.30–0.65s` crash window (Page 8).
 * Returns zero offset during normal running or after a confirmed cash-out.
 */
export function evaluateCameraPunch(
  phase: 'waiting' | 'betting' | 'running' | 'crashed',
  crashAgeSec: number,
  exitAgeSec: number | null,
): { offsetX: number; offsetY: number; scale: number } {
  if (phase !== 'crashed' || exitAgeSec !== null || crashAgeSec < 0.12 || crashAgeSec > 0.65) {
    return { offsetX: 0, offsetY: 0, scale: 1 };
  }
  const t = (crashAgeSec - 0.12) / 0.53;
  const decay = Math.max(0, 1 - t);
  const shake = decay * 6.5;
  return {
    offsetX: Math.sin(crashAgeSec * 95) * shake,
    offsetY: Math.cos(crashAgeSec * 112) * shake * 0.75,
    scale: 1 + decay * 0.018,
  };
}

export interface DrawEndingOptions {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  crashAgeSec: number;
  exitAgeSec: number | null;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
  currentX100: number;
}

function formatX100(x100: number): string {
  return `${(Math.max(100, x100) / 100).toFixed(2)}x`;
}

/**
 * Draw the crash notification burst (up to 36 particles during crash; zero during running),
 * up to 3 live notification toasts, and the result stamp (`TOOK THE BAIT` or `APP CLOSED`).
 */
export function drawEndingOverlays(
  ctx: CanvasRenderingContext2D,
  state: EndingState,
  layout: SceneLayout,
  opts: DrawEndingOptions,
): void {
  const { postButtonRect, stampRect, feedRect, fonts } = layout;

  // 1. Confirmed cash-out stamp (Page 8 & 13)
  if (opts.cashoutX100 !== null && opts.exitAgeSec !== null) {
    const appear = Math.min(1, opts.exitAgeSec / 0.25);
    const captionIdx = Math.floor(opts.cashoutX100 / 100) % SUCCESS_CAPTIONS.length;
    const caption =
      opts.phase === 'crashed'
        ? 'You left before this.'
        : SUCCESS_CAPTIONS[captionIdx]!;

    const exitMult = formatX100(opts.cashoutX100);
    const payoutText =
      opts.payout !== null ? ` · +${opts.payout.toFixed(2)}` : '';

    ctx.save();
    ctx.globalAlpha = 0.96 * appear;
    ctx.beginPath();
    ctx.roundRect(stampRect.x, stampRect.y, stampRect.w, stampRect.h, 12);
    ctx.fillStyle = '#121F17';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.lime;
    ctx.stroke();

    const cx = stampRect.x + stampRect.w / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.lime;
    ctx.font = `900 ${fonts.stamp - 4}px "Arial Black", Impact, system-ui, sans-serif`;
    ctx.fillText(
      opts.exitAgeSec < 0.25 ? 'DRAFT DELETED' : `CLOSED AT ${exitMult}${payoutText}`,
      cx,
      stampRect.y + 28,
      stampRect.w - 20,
    );

    ctx.fillStyle = PALETTE.ivory;
    ctx.font = `600 ${fonts.status}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(caption, cx, stampRect.y + 58, stampRect.w - 20);
    ctx.restore();
    return;
  }

  // 2. Crash ending sequence (only when cashoutX100 === null, Page 8)
  if (opts.phase !== 'crashed') {
    return;
  }

  const age = opts.crashAgeSec;

  // 0.30 - 0.65s (and decaying to 1.15s): Notification burst of up to 36 particles around the phone/Post button
  if (age >= 0.30 && age <= 1.25) {
    const burstAge = age - 0.30;
    const burstAlpha = Math.max(0, 1 - burstAge / 0.95);
    const originX = postButtonRect.x + postButtonRect.w / 2;
    const originY = postButtonRect.y + postButtonRect.h / 2;

    ctx.save();
    ctx.globalAlpha = burstAlpha;
    for (let i = 0; i < MAX_BURST_PARTICLES; i++) {
      const p = state.particles[i]!;
      const px = originX + p.vx * burstAge;
      const py = originY + p.vy * burstAge + 140 * burstAge * burstAge;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.spin * burstAge);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (p.kind === 'heart' || p.kind === 'alert') {
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      } else {
        ctx.rect(-p.size, -p.size * 0.7, p.size * 2, p.size * 1.4);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // Up to 3 live notification toasts near the top of the feed during crash (Page 16)
  if (age >= 0.32) {
    ctx.save();
    for (let i = 0; i < MAX_LIVE_TOASTS; i++) {
      const toast = TOAST_TEMPLATES[i]!;
      if (age < toast.triggerSec) continue;
      const toastAge = age - toast.triggerSec;
      const slide = Math.min(1, toastAge / 0.14);
      const tx = feedRect.x + 18;
      const ty = feedRect.y + 12 + i * 28 - (1 - slide) * 10;
      const tw = Math.min(310, feedRect.w - 36);
      ctx.globalAlpha = Math.min(0.95, slide);
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, 24, 6);
      ctx.fillStyle = '#241116';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PALETTE.orange;
      ctx.stroke();

      ctx.fillStyle = PALETTE.ivory;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(toast.label, tx + 10, ty + 12, tw - 18);
    }
    ctx.restore();
  }

  // 1.05 - 1.50s+: Bold `TOOK THE BAIT` stamp settles over the character/result area (Page 8)
  if (age >= 1.05) {
    const settleT = Math.min(1, (age - 1.05) / 0.22);
    const stampScale = 1 + (1 - settleT) * 0.24;
    const isSpectator = opts.stake === null && opts.cashoutX100 === null;
    const subCopy = isSpectator
      ? `SPECTATING · CRASHED AT ${formatX100(opts.currentX100)}`
      : `YOU REPLIED AT ${formatX100(opts.currentX100)} · ENGAGEMENT FARMED`;

    ctx.save();
    const cx = stampRect.x + stampRect.w / 2;
    const cy = stampRect.y + stampRect.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(stampScale, stampScale);
    ctx.rotate(-0.035);
    ctx.translate(-cx, -cy);

    ctx.beginPath();
    ctx.roundRect(stampRect.x, stampRect.y, stampRect.w, stampRect.h, 12);
    ctx.fillStyle = '#260B0F';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = PALETTE.crashRed;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.crashRed;
    ctx.font = `900 ${fonts.stamp}px "Arial Black", Impact, system-ui, sans-serif`;
    ctx.fillText('TOOK THE BAIT', cx, stampRect.y + 29, stampRect.w - 20);

    ctx.fillStyle = PALETTE.ivory;
    ctx.font = `700 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(subCopy, cx, stampRect.y + 59, stampRect.w - 20);
    ctx.restore();
  }
}
