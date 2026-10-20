/**
 * Feed state, deterministic card selection, bounded history, thread expansion,
 * text-wrapping cache, overtime progression, and late-entry reconstruction.
 */

import {
  ACCOUNT_BY_ID,
  BAIT_CARDS,
  CARD_BY_ID,
  CRASH_RESPONSE_BY_ID,
  DRAFT_BY_ID,
  DRAFT_LADDER,
  OVERTIME_FOLLOWUPS,
  OVERTIME_PROPS,
  PALETTE,
  WAITING_CARD,
  formatCount,
  tierForX100,
  type Account,
  type BaitCard,
  type DraftItem,
  type OvertimePropKind,
  type Tier,
} from './content';
import type { SceneLayout } from './layout';

export const SLOT_MS = 4_000;
export const TRANSITION_MS = 250;
export const TOP_REPLY_DELAY_MS = 1_200;
export const MANUAL_SUSPEND_MS = 5_000;

export const MAX_RENDERED_SURFACES = 5;
export const MAX_HISTORY_ENTRIES = 12;
export const MAX_VISIBLE_REPLIES = 3;
const MAX_RECENT_IDS = 6;
const MAX_WRAP_CACHE = 180;

export interface HistoryEntry {
  card: BaitCard;
  slotIndex: number;
  overtimeAct: number | null;
  followupText: string | null;
  propKind: OvertimePropKind | null;
}

export interface DraftView {
  item: DraftItem;
  visibleText: string;
  selected: boolean;
  deleted: boolean;
  hoveringPost: boolean;
  progress: number;
}

export interface FeedEvents {
  cardAdvance: boolean;
  newReply: boolean;
  draftCluster: boolean;
}

export interface FeedState {
  variant: number;
  history: HistoryEntry[];
  historyCursor: number; // Index into `history` (usually history.length - 1)
  recentIds: string[];
  recentAccounts: string[];
  lastAutoSlot: number;
  transitionFrom: HistoryEntry | null;
  transitionStartMs: number;
  transitionDir: -1 | 0 | 1;
  cardArrivedAtMs: number;
  topReplyShown: boolean;
  draftClusterFiredForSlot: number;
  threadExpanded: boolean;
  manualSuspendUntilMs: number;
  overscrollPx: number;
  frozenAtCrash: boolean;
  frozenEntry: HistoryEntry | null;
  frozenDraft: DraftItem | null;
  events: FeedEvents;
}

// ---- Module-level cosmetic session (Page 13) --------------------------------

interface PresentationSession {
  liveVariant: number;
  savedFeed: FeedState | null;
  savedElapsedMs: number;
  savedWallMs: number;
  savedPhase: string | null;
}

const session: PresentationSession = {
  liveVariant: 0,
  savedFeed: null,
  savedElapsedMs: 0,
  savedWallMs: 0,
  savedPhase: null,
};

export function isReplayMode(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.mode === 'replay';
}

export function currentDeckVariant(): number {
  return isReplayMode() ? 0 : session.liveVariant;
}

/**
 * Rotate the cosmetic deck variant only on an observed transition into a new
 * betting phase; replay mode always uses fixed variant 0 (Page 13).
 */
export function rotateDeckVariantOnBetting(): number {
  if (isReplayMode()) {
    session.liveVariant = 0;
    return 0;
  }
  session.liveVariant = (session.liveVariant + 1) % 4;
  return session.liveVariant;
}

/** Reset module-level session for deterministic testing when needed. */
export function resetPresentationSession(variant = 0): void {
  session.liveVariant = variant & 3;
  session.savedFeed = null;
  session.savedElapsedMs = 0;
  session.savedWallMs = 0;
  session.savedPhase = null;
}

// ---- Bounded text-wrapping cache by contentId + width (Pages 13 & 16) -------

const wrapCache = new Map<string, string[]>();

export function wrapTextCached(
  ctx: CanvasRenderingContext2D,
  cacheKey: string,
  text: string,
  maxWidth: number,
  font: string,
): string[] {
  const fullKey = `${cacheKey}@${Math.round(maxWidth)}@${font}`;
  const cached = wrapCache.get(fullKey);
  if (cached) return cached;

  ctx.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  if (wrapCache.size >= MAX_WRAP_CACHE) {
    const oldest = wrapCache.keys().next().value;
    if (oldest !== undefined) wrapCache.delete(oldest);
  }
  wrapCache.set(fullKey, lines);
  return lines;
}

export function getWrapCacheSize(): number {
  return wrapCache.size;
}

// ---- Deterministic Card Selection (Page 13) ---------------------------------

function cardsInTier(tier: Tier): BaitCard[] {
  return BAIT_CARDS.filter((c) => c.tier === tier);
}

/**
 * Deterministic hash from (variant, tier, slotIndex) that never touches the
 * unrevealed crash outcome.
 */
function deterministicOrder(pool: BaitCard[], variant: number, tier: Tier, slotIndex: number): BaitCard[] {
  const n = pool.length;
  if (n <= 1) return [...pool];
  const offset = ((variant * 3 + tier * 5 + slotIndex * 7) % n + n) % n;
  const out: BaitCard[] = [];
  for (let i = 0; i < n; i++) {
    out.push(pool[(offset + i) % n]!);
  }
  return out;
}

/**
 * Choose the next card according to Page 13 selection rules:
 * - Choose from the highest tier currently unlocked (or eligible tiers up to unlocked).
 * - Slot 0 rotates among the four Tier 1 cards according to cosmetic deck variant.
 * - Prefer an eligible callback to the visible account, then alternate account perspective.
 * - Avoid immediately repeating a card or using the same account more than twice in succession.
 * - Keep six recent IDs; when a small eligible pool is exhausted, reuse the least recently shown candidate.
 */
export function selectCardForSlot(
  variant: number,
  unlockedTier: Tier,
  slotIndex: number,
  recentIds: readonly string[],
  recentAccounts: readonly string[],
  currentCard: BaitCard | null,
): BaitCard {
  const tier1Pool = cardsInTier(1);
  if (slotIndex <= 0) {
    return tier1Pool[((variant % 4) + 4) % 4] ?? BAIT_CARDS[0]!;
  }

  const primaryPool = cardsInTier(unlockedTier);
  const ordered = deterministicOrder(primaryPool, variant, unlockedTier, slotIndex);

  const lastId = currentCard?.id ?? recentIds[recentIds.length - 1] ?? null;
  const lastAcc = currentCard?.accountId ?? recentAccounts[recentAccounts.length - 1] ?? null;
  const prevAcc = recentAccounts.length >= 2 ? recentAccounts[recentAccounts.length - 2] : null;
  const blockedAccount = lastAcc && prevAcc && lastAcc === prevAcc ? lastAcc : null;
  const lastPerspective = lastAcc ? ACCOUNT_BY_ID[lastAcc]?.perspective : null;

  // Filter out immediate repeat and >2 consecutive same-account cards.
  const valid = ordered.filter(
    (c) => c.id !== lastId && c.accountId !== blockedAccount,
  );
  const candidates = valid.length > 0 ? valid : ordered.filter((c) => c.id !== lastId);
  const unshown = candidates.filter((c) => !recentIds.includes(c.id));
  const workingPool = unshown.length > 0 ? unshown : candidates;

  // 1. Prefer an eligible callback to the visible card or account when not blocked.
  if (currentCard && unshown.length > 0) {
    const directCallback = unshown.find((c) => c.callbackTo === currentCard.id);
    if (directCallback) return directCallback;
  }

  // 2. Next, prefer alternating account perspective so one side is never permanent target.
  if (lastPerspective) {
    const altPerspective = workingPool.find(
      (c) => ACCOUNT_BY_ID[c.accountId]?.perspective !== lastPerspective,
    );
    if (altPerspective) return altPerspective;
  }

  // 3. If all candidates were in recentIds, reuse the least recently shown candidate.
  if (unshown.length === 0 && candidates.length > 0) {
    let best = candidates[0]!;
    let bestRank = Infinity;
    for (const c of candidates) {
      const idx = recentIds.lastIndexOf(c.id);
      if (idx < bestRank) {
        bestRank = idx;
        best = c;
      }
    }
    return best;
  }

  return workingPool[0] ?? ordered[0] ?? BAIT_CARDS[0]!;
}

function buildEntry(
  card: BaitCard,
  slotIndex: number,
  unlockedTier: Tier,
): HistoryEntry {
  // Past Tier 6 (or from slot 6 onward once Tier 6 is unlocked, or past 24s in long rounds),
  // attach the 8-slot overtime cycle and independent 5-prop rotation (Pages 6 & 12).
  const isOvertime = (unlockedTier === 6 && slotIndex >= 6) || slotIndex >= 6;
  const overtimeAct = isOvertime ? slotIndex - 6 : null;
  const followupText =
    overtimeAct !== null
      ? OVERTIME_FOLLOWUPS[((overtimeAct % OVERTIME_FOLLOWUPS.length) + OVERTIME_FOLLOWUPS.length) % OVERTIME_FOLLOWUPS.length]!
      : null;
  const propKind =
    overtimeAct !== null
      ? OVERTIME_PROPS[((overtimeAct % OVERTIME_PROPS.length) + OVERTIME_PROPS.length) % OVERTIME_PROPS.length]!
      : null;
  return { card, slotIndex, overtimeAct, followupText, propKind };
}

function recordEntry(state: FeedState, entry: HistoryEntry): void {
  state.history.push(entry);
  if (state.history.length > MAX_HISTORY_ENTRIES) {
    state.history.shift();
  }
  state.historyCursor = state.history.length - 1;

  state.recentIds.push(entry.card.id);
  if (state.recentIds.length > MAX_RECENT_IDS) {
    state.recentIds.shift();
  }
  state.recentAccounts.push(entry.card.accountId);
  if (state.recentAccounts.length > MAX_RECENT_IDS) {
    state.recentAccounts.shift();
  }
}

export function createFeed(variant = currentDeckVariant()): FeedState {
  const openingCard = selectCardForSlot(variant, 1, 0, [], [], null);
  const initialEntry = buildEntry(openingCard, 0, 1);
  return {
    variant,
    history: [initialEntry],
    historyCursor: 0,
    recentIds: [openingCard.id],
    recentAccounts: [openingCard.accountId],
    lastAutoSlot: 0,
    transitionFrom: null,
    transitionStartMs: -1_000,
    transitionDir: 0,
    cardArrivedAtMs: 0,
    topReplyShown: false,
    draftClusterFiredForSlot: -1,
    threadExpanded: false,
    manualSuspendUntilMs: -1,
    overscrollPx: 0,
    frozenAtCrash: false,
    frozenEntry: null,
    frozenDraft: null,
    events: { cardAdvance: false, newReply: false, draftCluster: false },
  };
}

export function resetFeed(state: FeedState, variant = currentDeckVariant()): void {
  const openingCard = selectCardForSlot(variant, 1, 0, [], [], null);
  const initialEntry = buildEntry(openingCard, 0, 1);
  state.variant = variant;
  state.history = [initialEntry];
  state.historyCursor = 0;
  state.recentIds = [openingCard.id];
  state.recentAccounts = [openingCard.accountId];
  state.lastAutoSlot = 0;
  state.transitionFrom = null;
  state.transitionStartMs = -1_000;
  state.transitionDir = 0;
  state.cardArrivedAtMs = 0;
  state.topReplyShown = false;
  state.draftClusterFiredForSlot = -1;
  state.threadExpanded = false;
  state.manualSuspendUntilMs = -1;
  state.overscrollPx = 0;
  state.frozenAtCrash = false;
  state.frozenEntry = null;
  state.frozenDraft = null;
  state.events = { cardAdvance: false, newReply: false, draftCluster: false };
}

/** Active card entry currently displayed in the feed. */
export function activeFeedEntry(state: FeedState, phase: string): HistoryEntry {
  if (state.frozenAtCrash && state.frozenEntry) {
    return state.frozenEntry;
  }
  if (phase === 'waiting') {
    return {
      card: WAITING_CARD,
      slotIndex: 0,
      overtimeAct: null,
      followupText: null,
      propKind: null,
    };
  }
  const idx = Math.max(0, Math.min(state.history.length - 1, state.historyCursor));
  return state.history[idx] ?? state.history[state.history.length - 1]!;
}

/** Resolve the draft item for a given card and tier/slot intensity. */
export function draftForEntry(entry: HistoryEntry, unlockedTier: Tier): DraftItem {
  const base = DRAFT_BY_ID[entry.card.draftId] ?? DRAFT_LADDER[0]!;
  if (entry.overtimeAct !== null) {
    // Rotate through high-intensity drafts in overtime so long rounds stay fresh.
    const highPool = DRAFT_LADDER.slice(5);
    return highPool[entry.overtimeAct % highPool.length] ?? base;
  }
  // Ensure the draft intensity is at least appropriate for the unlocked tier.
  const minIndex = Math.min(DRAFT_LADDER.length - 1, Math.max(0, unlockedTier - 1));
  const baseIndex = DRAFT_LADDER.findIndex((d) => d.id === base.id);
  return DRAFT_LADDER[Math.max(baseIndex, minIndex)] ?? base;
}

/**
 * Settle feed state on first draw / late entry / tab return without replaying
 * every missed card or sound (Pages 13 & 16).
 */
export function settleFeed(
  state: FeedState,
  phase: 'waiting' | 'betting' | 'running' | 'crashed',
  currentX100: number,
  elapsedMs: number,
  nowMs: number,
): void {
  state.events = { cardAdvance: false, newReply: false, draftCluster: false };

  // If the scene was recreated after a short gap during the same round, restore known card.
  const canRestore =
    session.savedFeed !== null &&
    (phase === 'running' || phase === 'crashed') &&
    (session.savedPhase === phase || (phase === 'crashed' && session.savedPhase === 'running')) &&
    elapsedMs >= session.savedElapsedMs - 50 &&
    Math.abs((elapsedMs - session.savedElapsedMs) - (Date.now() - session.savedWallMs)) < 4_500;

  if (canRestore && session.savedFeed) {
    Object.assign(state, {
      ...session.savedFeed,
      events: { cardAdvance: false, newReply: false, draftCluster: false },
    });
    if (phase === 'crashed' && !state.frozenAtCrash) {
      freezeFeedOnCrash(state, currentX100);
    }
    return;
  }

  const variant = currentDeckVariant();
  state.variant = variant;
  state.threadExpanded = false;
  state.manualSuspendUntilMs = -1;
  state.overscrollPx = 0;
  state.transitionFrom = null;
  state.transitionDir = 0;

  if (phase === 'waiting' || phase === 'betting') {
    resetFeed(state, variant);
    state.cardArrivedAtMs = nowMs;
    state.topReplyShown = true;
    return;
  }

  const slotIndex = Math.max(0, Math.floor(elapsedMs / SLOT_MS));
  const unlockedTier = tierForX100(currentX100);

  // Build a bounded recent history (at most 4 prior slots + current slot) so backscroll works
  // on late entry without simulating hundreds of missed slots.
  state.history = [];
  state.recentIds = [];
  state.recentAccounts = [];
  const startSlot = Math.max(0, slotIndex - 4);
  for (let s = startSlot; s <= slotIndex; s++) {
    // Estimate tier progression up to unlockedTier for prior history slots.
    const slotTier = s === slotIndex
      ? unlockedTier
      : (Math.max(1, Math.min(unlockedTier, 1 + Math.floor((s * unlockedTier) / Math.max(1, slotIndex)))) as Tier);
    const prevCard = state.history.length > 0 ? state.history[state.history.length - 1]!.card : null;
    const card = selectCardForSlot(variant, slotTier, s, state.recentIds, state.recentAccounts, prevCard);
    recordEntry(state, buildEntry(card, s, slotTier));
  }

  state.lastAutoSlot = slotIndex;
  const slotOffsetMs = elapsedMs % SLOT_MS;
  state.cardArrivedAtMs = nowMs - slotOffsetMs;
  state.topReplyShown = slotOffsetMs >= TOP_REPLY_DELAY_MS;
  state.draftClusterFiredForSlot = slotOffsetMs >= 1_400 ? slotIndex : -1;

  if (phase === 'crashed') {
    freezeFeedOnCrash(state, currentX100);
  }
}

/** Freeze the current card, account, and draft at the moment of crash (Pages 8 & 13). */
export function freezeFeedOnCrash(state: FeedState, currentX100: number): void {
  if (state.frozenAtCrash && state.frozenEntry) return;
  const current = activeFeedEntry(state, 'running');
  state.frozenAtCrash = true;
  state.frozenEntry = current;
  state.frozenDraft = draftForEntry(current, tierForX100(currentX100));
  state.transitionFrom = null;
  state.transitionDir = 0;
  state.overscrollPx = 0;
}

/**
 * Step the feed forward during normal play.
 * Evaluates slot transitions, top-reply reveal, draft cluster trigger, and overscroll decay.
 */
export function stepFeed(
  state: FeedState,
  phase: 'waiting' | 'betting' | 'running' | 'crashed',
  currentX100: number,
  elapsedMs: number,
  nowMs: number,
  dtSec: number,
  cashedOut: boolean,
): void {
  state.events = { cardAdvance: false, newReply: false, draftCluster: false };

  // Decay overscroll spring smoothly.
  if (Math.abs(state.overscrollPx) > 0.2) {
    state.overscrollPx *= Math.exp(-14 * dtSec);
  } else {
    state.overscrollPx = 0;
  }

  if (phase === 'crashed') {
    freezeFeedOnCrash(state, currentX100);
    session.savedFeed = state;
    session.savedElapsedMs = elapsedMs;
    session.savedWallMs = Date.now();
    session.savedPhase = phase;
    return;
  }

  if (phase === 'waiting' || phase === 'betting') {
    state.topReplyShown = true;
    session.savedPhase = phase;
    return;
  }

  // Phase is 'running'.
  const slotIndex = Math.max(0, Math.floor(elapsedMs / SLOT_MS));
  const unlockedTier = tierForX100(currentX100);
  const manualSuspended = nowMs < state.manualSuspendUntilMs;

  // Automatic card advance on 4-second reading slot boundaries when not manually suspended
  // and while a thread is not expanded ("Keep the primary post stable while a thread is expanded", Page 6).
  if (slotIndex > state.lastAutoSlot) {
    if (!manualSuspended && !state.threadExpanded && !cashedOut) {
      const prevEntry = activeFeedEntry(state, 'running');
      const nextCard = selectCardForSlot(
        state.variant,
        unlockedTier,
        slotIndex,
        state.recentIds,
        state.recentAccounts,
        prevEntry.card,
      );
      const nextEntry = buildEntry(nextCard, slotIndex, unlockedTier);
      state.transitionFrom = prevEntry;
      state.transitionStartMs = nowMs;
      state.transitionDir = 1;
      recordEntry(state, nextEntry);
      state.cardArrivedAtMs = nowMs;
      state.topReplyShown = false;
      state.events.cardAdvance = true;
    }
    // Skip obsolete queued material rather than building a backlog (Pages 5 & 6).
    state.lastAutoSlot = slotIndex;
  }

  // Top reply appears ~1.2s after the post arrives (Pages 6 & 10).
  const cardAgeMs = Math.max(0, nowMs - state.cardArrivedAtMs);
  if (!state.topReplyShown && cardAgeMs >= TOP_REPLY_DELAY_MS) {
    state.topReplyShown = true;
    if (!cashedOut) state.events.newReply = true;
  }

  // Draft cluster audio event once per reading slot when the avatar starts typing (~1.4s in).
  const slotOffsetMs = elapsedMs % SLOT_MS;
  if (
    !cashedOut &&
    slotOffsetMs >= 1_400 &&
    slotOffsetMs < 2_800 &&
    state.draftClusterFiredForSlot !== slotIndex
  ) {
    state.draftClusterFiredForSlot = slotIndex;
    state.events.draftCluster = true;
  }

  session.savedFeed = state;
  session.savedElapsedMs = elapsedMs;
  session.savedWallMs = Date.now();
  session.savedPhase = phase;
}

/**
 * Manual browse by `delta` cards (-1 = previous card in history, +1 = next card).
 * Suspends automatic card changes for 5 seconds.
 * Cannot unlock higher-tier content before the displayed multiplier permits it (Page 6).
 */
export function browseFeed(
  state: FeedState,
  delta: -1 | 1,
  phase: 'waiting' | 'betting' | 'running' | 'crashed',
  currentX100: number,
  elapsedMs: number,
  nowMs: number,
): boolean {
  if (phase === 'crashed' || state.frozenAtCrash) return false;
  state.manualSuspendUntilMs = nowMs + MANUAL_SUSPEND_MS;
  state.threadExpanded = false;

  const current = activeFeedEntry(state, phase);
  if (delta < 0) {
    if (state.historyCursor > 0) {
      state.transitionFrom = current;
      state.transitionStartMs = nowMs;
      state.transitionDir = -1;
      state.historyCursor -= 1;
      state.topReplyShown = true;
      state.events.cardAdvance = true;
      return true;
    }
    // Clamp overscroll at the start of history.
    state.overscrollPx = 18;
    return false;
  }

  // delta > 0: move forward in history, or pull a new card from the currently unlocked tier
  if (state.historyCursor < state.history.length - 1) {
    state.transitionFrom = current;
    state.transitionStartMs = nowMs;
    state.transitionDir = 1;
    state.historyCursor += 1;
    state.topReplyShown = true;
    state.events.cardAdvance = true;
    return true;
  }

  if (phase !== 'running') {
    state.overscrollPx = -18;
    return false;
  }

  // Only allow pulling a new card from the currently unlocked tier (never higher-tier).
  const unlockedTier = tierForX100(currentX100);
  const slotIndex = Math.max(state.lastAutoSlot, Math.floor(elapsedMs / SLOT_MS));
  const nextSlot = state.history[state.history.length - 1]!.slotIndex + 1;
  const nextCard = selectCardForSlot(
    state.variant,
    unlockedTier,
    nextSlot,
    state.recentIds,
    state.recentAccounts,
    current.card,
  );
  const nextEntry = buildEntry(nextCard, Math.max(slotIndex, nextSlot), unlockedTier);
  state.transitionFrom = current;
  state.transitionStartMs = nowMs;
  state.transitionDir = 1;
  recordEntry(state, nextEntry);
  state.cardArrivedAtMs = nowMs;
  state.topReplyShown = true;
  state.events.cardAdvance = true;
  return true;
}

/** Toggle or collapse the expanded reply thread (up to 3 replies, Page 5). */
export function toggleReplies(state: FeedState, nowMs: number, forceCollapse = false): boolean {
  if (forceCollapse) {
    if (!state.threadExpanded) return false;
    state.threadExpanded = false;
    return true;
  }
  state.threadExpanded = !state.threadExpanded;
  state.topReplyShown = true;
  if (state.threadExpanded) {
    state.manualSuspendUntilMs = Math.max(state.manualSuspendUntilMs, nowMs + MANUAL_SUSPEND_MS);
  }
  return state.threadExpanded;
}

/** Evaluate the current animated draft state inside the 4-second reading slot (Pages 7 & 8). */
export function evaluateDraft(
  state: FeedState,
  phase: 'waiting' | 'betting' | 'running' | 'crashed',
  currentX100: number,
  elapsedMs: number,
  crashAgeSec: number,
  exitAgeSec: number | null,
): DraftView {
  const entry = activeFeedEntry(state, phase);
  const unlockedTier = tierForX100(currentX100);
  const item = state.frozenDraft ?? draftForEntry(entry, unlockedTier);

  // Confirmed exit: 0..0.25s selects and deletes draft ("DRAFT DELETED"); >=0.25s empty/closed.
  if (exitAgeSec !== null) {
    if (exitAgeSec < 0.25) {
      return {
        item,
        visibleText: item.text,
        selected: true,
        deleted: false,
        hoveringPost: false,
        progress: 1,
      };
    }
    return {
      item,
      visibleText: 'DRAFT DELETED',
      selected: false,
      deleted: true,
      hoveringPost: false,
      progress: 0,
    };
  }

  if (phase === 'waiting') {
    return {
      item,
      visibleText: '',
      selected: false,
      deleted: false,
      hoveringPost: false,
      progress: 0,
    };
  }

  if (phase === 'betting') {
    return {
      item,
      visibleText: 'Just checking one thing.',
      selected: false,
      deleted: false,
      hoveringPost: false,
      progress: 0.4,
    };
  }

  if (phase === 'crashed') {
    // At 0..0.12s hold the draft; at >=0.12s the thumb presses Post and expands into angry comment.
    const posted = crashAgeSec >= 0.12;
    return {
      item,
      visibleText: posted ? item.postedComment : item.text,
      selected: false,
      deleted: false,
      hoveringPost: true,
      progress: 1,
    };
  }

  // Running phase: 4-second reading slot cycle.
  const slotSec = ((elapsedMs % SLOT_MS) + SLOT_MS) % SLOT_MS / 1000;
  if (unlockedTier <= 2 && slotSec < 1.8) {
    return {
      item,
      visibleText: '',
      selected: false,
      deleted: false,
      hoveringPost: false,
      progress: 0,
    };
  }

  if (slotSec < 1.35) {
    return {
      item,
      visibleText: '',
      selected: false,
      deleted: false,
      hoveringPost: false,
      progress: 0,
    };
  }

  if (slotSec < 2.95) {
    const u = Math.min(1, (slotSec - 1.35) / 1.25);
    const chars = Math.max(1, Math.ceil(item.text.length * u));
    return {
      item,
      visibleText: item.text.slice(0, chars),
      selected: false,
      deleted: false,
      hoveringPost: unlockedTier >= 5 && u > 0.75,
      progress: u,
    };
  }

  if (slotSec < 3.5) {
    return {
      item,
      visibleText: item.text,
      selected: true,
      deleted: false,
      hoveringPost: unlockedTier >= 5,
      progress: 1,
    };
  }

  return {
    item,
    visibleText: '',
    selected: false,
    deleted: true,
    hoveringPost: false,
    progress: 0,
  };
}

// ---- Canvas 2D Drawing for Feed, Cards, Avatar Icons, Replies & Composer ---

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawAccountAvatar(
  ctx: CanvasRenderingContext2D,
  account: Account,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = account.avatarColor;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  ctx.clip();

  // Distinct illustrated mini-portrait per recurring account.
  ctx.fillStyle = '#F7D7C4';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.08, r * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Shoulders
  ctx.fillStyle = account.avatarAccent;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.78, r * 0.68, r * 0.44, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Account-specific accessory / expression
  ctx.fillStyle = PALETTE.ink;
  if (account.id === 'soft-life') {
    // Designer sunglasses + smirk
    ctx.fillRect(cx - r * 0.36, cy - r * 0.22, r * 0.3, r * 0.16);
    ctx.fillRect(cx + r * 0.06, cy - r * 0.22, r * 0.3, r * 0.16);
    ctx.beginPath();
    ctx.arc(cx + r * 0.05, cy + r * 0.12, r * 0.14, 0.1, Math.PI - 0.2);
    ctx.stroke();
  } else if (account.id === 'coach-provider') {
    // Beard + podcast mic + stern brow
    ctx.fillRect(cx - r * 0.32, cy + r * 0.04, r * 0.64, r * 0.28);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy - r * 0.24);
    ctx.lineTo(cx - r * 0.05, cy - r * 0.14);
    ctx.moveTo(cx + r * 0.3, cy - r * 0.24);
    ctx.lineTo(cx + r * 0.05, cy - r * 0.14);
    ctx.stroke();
  } else if (account.id === 'splitcheck-king') {
    // Glasses + receipt/grid lines
    ctx.strokeRect(cx - r * 0.34, cy - r * 0.22, r * 0.28, r * 0.2);
    ctx.strokeRect(cx + r * 0.06, cy - r * 0.22, r * 0.28, r * 0.2);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.18, cy + r * 0.15);
    ctx.lineTo(cx + r * 0.18, cy + r * 0.15);
    ctx.stroke();
  } else if (account.id === 'boundary-babe') {
    // Raised smug brow + closed eyes
    ctx.beginPath();
    ctx.arc(cx - r * 0.16, cy - r * 0.1, r * 0.1, 0, Math.PI);
    ctx.arc(cx + r * 0.16, cy - r * 0.1, r * 0.1, 0, Math.PI);
    ctx.stroke();
  } else if (account.id === 'couples-court') {
    // Two overlapping silhouettes
    ctx.fillStyle = '#E8B89A';
    ctx.beginPath();
    ctx.arc(cx + r * 0.26, cy - r * 0.05, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Engagement Dept: devilish bait hook / grin
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.05, r * 0.24, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

export interface DrawFeedOptions {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsedMs: number;
  crashAgeSec: number;
  exitAgeSec: number | null;
  tension: number;
  nowMs: number;
}

/**
 * Draw the bounded social feed (at most 5 card surfaces: top neighbor peek,
 * bottom neighbor peek, optional transition card, primary post card, and
 * composer/reply surface).
 */
export function drawFeed(
  ctx: CanvasRenderingContext2D,
  state: FeedState,
  layout: SceneLayout,
  opts: DrawFeedOptions,
): void {
  const { feedRect, prevPeekRect, nextPeekRect, cardRect, repliesHitRect, composerRect, postButtonRect, fonts } = layout;
  const entry = activeFeedEntry(state, opts.phase);
  const account = ACCOUNT_BY_ID[entry.card.accountId] ?? ACCOUNT_BY_ID['engagement-dept']!;
  const draft = evaluateDraft(
    state,
    opts.phase,
    opts.currentX100,
    opts.elapsedMs,
    opts.crashAgeSec,
    opts.exitAgeSec,
  );

  // If cash-out closure has locked the phone (>= 0.25s after approval), dim/close the app view
  // and show the clean APP CLOSED state while keeping any overtime developments muffled.
  const appClosedProgress = opts.exitAgeSec !== null ? Math.min(1, Math.max(0, (opts.exitAgeSec - 0.25) / 0.4)) : 0;

  ctx.save();
  // Outer feed frame
  roundRect(ctx, feedRect.x, feedRect.y, feedRect.w, feedRect.h, 14);
  ctx.fillStyle = PALETTE.appBg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = opts.phase === 'crashed' && opts.exitAgeSec === null ? PALETTE.crashRed : PALETTE.border;
  ctx.stroke();
  ctx.clip();

  // Surface 1 & 2: Adjacent card peeks (communicate scrolling without competing headlines, Page 5)
  ctx.fillStyle = PALETTE.cardNeighbor;
  ctx.strokeStyle = PALETTE.border;
  ctx.lineWidth = 1.5;
  roundRect(ctx, prevPeekRect.x, prevPeekRect.y, prevPeekRect.w, prevPeekRect.h, 6);
  ctx.fill();
  ctx.stroke();

  roundRect(ctx, nextPeekRect.x, nextPeekRect.y, nextPeekRect.w, nextPeekRect.h, 6);
  ctx.fill();
  ctx.stroke();

  // Compute 250ms slot transition slide offset + manual overscroll
  const transElapsed = opts.nowMs - state.transitionStartMs;
  const transT = state.transitionFrom && transElapsed >= 0 && transElapsed < TRANSITION_MS
    ? 1 - Math.pow(1 - transElapsed / TRANSITION_MS, 3)
    : 1;
  const slideOffsetPx = (1 - transT) * 28 * state.transitionDir + state.overscrollPx;

  // Surface 3: Primary post card
  ctx.save();
  ctx.translate(0, slideOffsetPx);

  roundRect(ctx, cardRect.x, cardRect.y, cardRect.w, cardRect.h, 12);
  ctx.fillStyle = PALETTE.cardBg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();

  const padX = cardRect.x + 18;
  const innerW = cardRect.w - 36;
  const avatarR = layout.portrait ? 22 : 20;
  const headerY = cardRect.y + 28;

  drawAccountAvatar(ctx, account, padX + avatarR, headerY + 4, avatarR);

  // Account name, handle, and verified badge (which grows on overtime 'badge-grows' act, Page 12)
  const nameX = padX + avatarR * 2 + 12;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.ivory;
  ctx.font = `700 ${fonts.accountName}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(account.name, nameX, headerY - 4);

  const nameW = ctx.measureText(account.name).width;
  const badgeScale = entry.propKind === 'badge-grows' ? 1.45 + 0.15 * Math.sin(opts.nowMs / 180) : 1;
  const badgeX = nameX + nameW + 12 * badgeScale;
  const badgeY = headerY - 4;
  ctx.save();
  ctx.translate(badgeX, badgeY);
  ctx.scale(badgeScale, badgeScale);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = entry.propKind === 'badge-grows' ? PALETTE.lime : PALETTE.postBlue;
  ctx.fill();
  ctx.strokeStyle = PALETTE.ivory;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(-0.5, 2.5);
  ctx.lineTo(3.5, -2.5);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 ${fonts.accountHandle}px system-ui, -apple-system, sans-serif`;
  const tierBadge = opts.phase === 'waiting' ? 'PREVIEW' : `TIER ${entry.card.tier}`;
  ctx.fillText(`${account.handle} · ${tierBadge}`, nameX, headerY + 15);

  // Optional callback tag or overtime prop pill in top-right of card
  const pillText =
    entry.propKind === 'course-price'
      ? `COURSE $${499 * Math.pow(10, Math.min(3, 1 + ((entry.overtimeAct ?? 0) % 3)))}`
      : entry.propKind === 'apology-sponsor'
        ? 'SPONSORED APOLOGY'
        : entry.propKind === 'lopsided-poll'
          ? `POLL: ${Math.min(99, 92 + ((entry.overtimeAct ?? 0) % 8))}% TRIGGERED`
          : entry.card.callbackTag ?? null;

  if (pillText) {
    ctx.font = `700 ${fonts.badge - 1}px system-ui, -apple-system, sans-serif`;
    const pw = Math.min(210, ctx.measureText(pillText).width + 16);
    const px = cardRect.x + cardRect.w - pw - 14;
    const py = cardRect.y + 12;
    roundRect(ctx, px, py, pw, 22, 6);
    ctx.fillStyle = '#2C221E';
    ctx.fill();
    ctx.strokeStyle = PALETTE.orange;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.orange;
    ctx.textAlign = 'center';
    ctx.fillText(pillText, px + pw / 2, py + 11, pw - 10);
    ctx.textAlign = 'left';
  }

  // Primary post text (never shrunk to fit: wrapped via cached wrapper, Page 15)
  const postFont = `700 ${fonts.post}px system-ui, -apple-system, sans-serif`;
  const postLines = wrapTextCached(ctx, `post:${entry.card.id}`, entry.card.post, innerW, postFont);
  ctx.fillStyle = PALETTE.ivory;
  ctx.font = postFont;
  let textY = cardRect.y + 68;
  for (let i = 0; i < Math.min(3, postLines.length); i++) {
    ctx.fillText(postLines[i]!, padX, textY);
    textY += fonts.postLineHeight;
  }

  // Overtime follow-up banner when present (Pages 6 & 12)
  if (entry.followupText) {
    const fy = textY - 4;
    roundRect(ctx, padX, fy, innerW, 24, 5);
    ctx.fillStyle = '#2A2230';
    ctx.fill();
    ctx.fillStyle = PALETTE.lime;
    ctx.font = `600 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(`↳ Follow-up: "${entry.followupText}"`, padX + 8, fy + 12, innerW - 16);
    textY += 26;
  }

  // Engagement counts (invented scenery, subordinate to post, clamped compact formatting, Page 9 & 16)
  const cardNum = parseInt(entry.card.id.replace(/\D+/g, ''), 10) || 1;
  const baseLikes = 1_800 + cardNum * 950 + Math.floor(opts.tension * 18_000 + opts.elapsedMs * 0.25);
  const baseReplies = 140 + cardNum * 65 + Math.floor(opts.tension * 1_400 + opts.elapsedMs * 0.04);
  const metricsY = repliesHitRect.y - 14;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 ${fonts.badge}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(`♡ ${formatCount(baseLikes)}   💬 ${formatCount(baseReplies)}`, padX, metricsY);

  // Actionable Replies button label on the right of the metrics strip
  const expandLabel = state.threadExpanded
    ? '▾ Hide replies (Esc)'
    : `▸ Replies (${1 + Math.min(2, entry.card.replies.length)})`;
  ctx.fillStyle = state.threadExpanded ? PALETTE.lime : PALETTE.ivory;
  ctx.textAlign = 'right';
  ctx.fillText(expandLabel, cardRect.x + cardRect.w - 18, metricsY);
  ctx.textAlign = 'left';

  // Surface 4: Reply / Expanded thread area (up to 3 visible replies, Page 5 & 10)
  roundRect(ctx, repliesHitRect.x, repliesHitRect.y, repliesHitRect.w, repliesHitRect.h, 8);
  ctx.fillStyle = PALETTE.replyBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = state.threadExpanded ? PALETTE.lime : PALETTE.border;
  ctx.stroke();

  if (entry.propKind === 'locked-reply' && !state.threadExpanded) {
    ctx.fillStyle = PALETTE.orange;
    ctx.font = `600 ${fonts.reply}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('🔒 Replies locked by author · Tap to inspect thread', repliesHitRect.x + 14, repliesHitRect.y + repliesHitRect.h / 2);
  } else if (state.topReplyShown || opts.phase !== 'running') {
    const visibleReplies = state.threadExpanded
      ? [entry.card.topReply, ...entry.card.replies].slice(0, MAX_VISIBLE_REPLIES)
      : [entry.card.topReply];

    const replyPadX = repliesHitRect.x + 12;
    const replyMaxW = repliesHitRect.w - 24;
    const replyFont = `500 ${fonts.reply}px system-ui, -apple-system, sans-serif`;

    if (!state.threadExpanded) {
      // Single top reply (wrapped up to 2 lines so it stays at full readable size)
      ctx.fillStyle = PALETTE.lime;
      ctx.font = `700 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('TOP REPLY · 2h ago', replyPadX, repliesHitRect.y + 18);

      const lines = wrapTextCached(ctx, `top:${entry.card.id}`, visibleReplies[0]!, replyMaxW, replyFont);
      ctx.fillStyle = PALETTE.ivory;
      ctx.font = replyFont;
      for (let i = 0; i < Math.min(2, lines.length); i++) {
        ctx.fillText(lines[i]!, replyPadX, repliesHitRect.y + 40 + i * fonts.replyLineHeight);
      }
    } else {
      // Expanded thread: up to 3 short replies
      const rowH = Math.floor((repliesHitRect.h - 12) / visibleReplies.length);
      for (let r = 0; r < visibleReplies.length; r++) {
        const ry = repliesHitRect.y + 8 + r * rowH;
        if (r > 0) {
          ctx.strokeStyle = PALETTE.border;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(replyPadX, ry - 2);
          ctx.lineTo(repliesHitRect.x + repliesHitRect.w - 12, ry - 2);
          ctx.stroke();
        }
        ctx.fillStyle = r === 0 ? PALETTE.lime : PALETTE.muted;
        ctx.font = `700 ${fonts.badge - 1}px system-ui, -apple-system, sans-serif`;
        const tag = r === 0 ? 'TOP' : `REPLY ${r + 1}`;
        ctx.fillText(tag, replyPadX, ry + 14);
        ctx.fillStyle = PALETTE.ivory;
        ctx.font = `500 ${Math.max(14, fonts.reply - 2)}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(visibleReplies[r]!, replyPadX + 58, ry + 14, replyMaxW - 62);
      }
    }
  } else {
    ctx.fillStyle = PALETTE.dim;
    ctx.font = `500 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('Loading top reply…', repliesHitRect.x + 14, repliesHitRect.y + repliesHitRect.h / 2);
  }

  ctx.restore(); // End slideOffsetPx

  // Surface 5: Bottom Draft Composer & Non-Interactive Post Illustration (Pages 2, 5, 7, 8)
  roundRect(ctx, composerRect.x, composerRect.y, composerRect.w, composerRect.h, 10);
  ctx.fillStyle = PALETTE.composerBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle =
    opts.phase === 'crashed' && opts.exitAgeSec === null
      ? PALETTE.crashRed
      : draft.hoveringPost
        ? PALETTE.orange
        : PALETTE.border;
  ctx.stroke();

  // Avatar mini-circle on the left of composer
  const compCy = composerRect.y + composerRect.h / 2;
  ctx.beginPath();
  ctx.arc(composerRect.x + 24, compCy, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#3B4252';
  ctx.fill();
  ctx.strokeStyle = PALETTE.ivory;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const draftX = composerRect.x + 46;
  const maxDraftW = postButtonRect.x - draftX - 12;
  ctx.font = `600 ${fonts.draft}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  if (draft.selected && draft.visibleText) {
    const tw = Math.min(maxDraftW, ctx.measureText(draft.visibleText).width + 10);
    roundRect(ctx, draftX - 4, compCy - 14, tw, 28, 4);
    ctx.fillStyle = opts.exitAgeSec !== null ? 'rgba(200, 255, 46, 0.28)' : 'rgba(255, 107, 36, 0.32)';
    ctx.fill();
  }

  if (draft.visibleText) {
    ctx.fillStyle = draft.deleted
      ? PALETTE.lime
      : opts.phase === 'crashed' && opts.exitAgeSec === null
        ? PALETTE.crashRed
        : PALETTE.ivory;
    const cursor = !draft.deleted && !draft.selected && opts.phase === 'running' && Math.floor(opts.nowMs / 320) % 2 === 0 ? ' |' : '';
    ctx.fillText(`${draft.visibleText}${cursor}`, draftX, compCy, maxDraftW);
  } else {
    ctx.fillStyle = PALETTE.dim;
    const placeholder =
      opts.phase === 'waiting'
        ? 'Add a comment…'
        : draft.deleted
          ? 'Draft deleted · deep breath…'
          : 'Typing a reply…';
    ctx.fillText(placeholder, draftX, compCy, maxDraftW);
  }

  // Non-interactive Post button illustration (Page 2 & Page 5)
  const postPressed = opts.phase === 'crashed' && opts.exitAgeSec === null && opts.crashAgeSec >= 0.12 && opts.crashAgeSec < 0.38;
  ctx.save();
  if (postPressed) {
    ctx.translate(postButtonRect.x + postButtonRect.w / 2, postButtonRect.y + postButtonRect.h / 2);
    ctx.scale(0.9, 0.9);
    ctx.translate(-(postButtonRect.x + postButtonRect.w / 2), -(postButtonRect.y + postButtonRect.h / 2));
  }
  roundRect(ctx, postButtonRect.x, postButtonRect.y, postButtonRect.w, postButtonRect.h, 8);
  ctx.fillStyle =
    opts.phase === 'crashed' && opts.exitAgeSec === null
      ? PALETTE.crashRed
      : draft.hoveringPost
        ? PALETTE.orange
        : PALETTE.postBlue;
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Paper-plane send icon inside Post button illustration
  const px = postButtonRect.x + postButtonRect.w / 2;
  const py = postButtonRect.y + postButtonRect.h / 2;
  ctx.fillStyle = PALETTE.ivory;
  ctx.beginPath();
  ctx.moveTo(px - 9, py - 7);
  ctx.lineTo(px + 10, py);
  ctx.lineTo(px - 9, py + 7);
  ctx.lineTo(px - 5, py);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Crash overlay on feed: posted comment + bait account's taunt (Page 8)
  if (opts.phase === 'crashed' && opts.exitAgeSec === null && opts.crashAgeSec >= 0.30) {
    const crashResp =
      CRASH_RESPONSE_BY_ID[entry.card.crashReplyId] ?? CRASH_RESPONSE_BY_ID['not-reading']!;
    const tauntText = feedRect.w >= 500 ? crashResp.long : crashResp.short;
    const tauntVisible = opts.crashAgeSec >= 0.65;

    const boxH = tauntVisible ? 104 : 54;
    const boxY = composerRect.y - boxH - 8;
    roundRect(ctx, cardRect.x + 8, boxY, cardRect.w - 16, boxH, 10);
    ctx.fillStyle = '#140B0E';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = PALETTE.crashRed;
    ctx.stroke();

    ctx.fillStyle = PALETTE.orange;
    ctx.font = `700 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('YOU POSTED:', cardRect.x + 20, boxY + 18);
    ctx.fillStyle = PALETTE.ivory;
    ctx.font = `700 ${fonts.reply}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(draft.item.postedComment, cardRect.x + 20, boxY + 38, cardRect.w - 40);

    if (tauntVisible) {
      ctx.fillStyle = PALETTE.lime;
      ctx.font = `700 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(`${account.name} replied · 1s ago`, cardRect.x + 20, boxY + 64);
      ctx.fillStyle = PALETTE.ivory;
      ctx.font = `700 ${fonts.reply}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(`"${tauntText}"`, cardRect.x + 20, boxY + 86, cardRect.w - 40);
    }
  }

  // Confirmed cash-out overlay: APP CLOSED screen lock over the feed (Page 8)
  if (appClosedProgress > 0.02) {
    ctx.save();
    ctx.globalAlpha = appClosedProgress * 0.94;
    ctx.fillStyle = '#0D1014';
    ctx.fillRect(feedRect.x, feedRect.y, feedRect.w, feedRect.h);

    const cx = feedRect.x + feedRect.w / 2;
    const cy = feedRect.y + feedRect.h / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.lime;
    ctx.font = `900 ${fonts.stamp}px "Arial Black", Impact, system-ui, sans-serif`;
    ctx.fillText('APP CLOSED', cx, cy - 22);

    ctx.fillStyle = PALETTE.ivory;
    ctx.font = `700 ${fonts.post - 2}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('DRAFT DELETED · PHONE FACE-DOWN', cx, cy + 14);

    if (opts.phase === 'crashed') {
      ctx.fillStyle = PALETTE.warmGlow;
      ctx.font = `700 ${fonts.reply}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('You left before this.', cx, cy + 48);
    } else if (entry.overtimeAct !== null) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `500 ${fonts.badge}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('🔇 Muffled notifications still buzzing on the table…', cx, cy + 48);
    }
    ctx.restore();
  }

  ctx.restore(); // End feedRect clip
}
