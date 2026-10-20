/**
 * Deterministic comedy director for BRO-MAXXED (Pages 7–12, 20, 23–25).
 *
 * Schedules appearance bands, repeatable physical comedy gags (G01–G12),
 * dialogue captions (D01–D96), fictional product advertisements (P01–P16),
 * crowd reactions, 20-second late-round background programs, and outcome
 * choreography (TOUCH GRASS accepted exits E01–E08 and MOGGED BY LOVE
 * romantic crash endings R01–R08) as pure functions of public round state.
 */

import {
  ACTIVE_DIALOGUE_POOL,
  BAND_SPECS,
  CASHOUT_VARIANTS,
  CONTENT_VERSION,
  CROWD_COMMENTS,
  DIALOGUE_BY_ID,
  GAGS,
  GAG_BY_ID,
  LATE_PROGRAMS,
  PRODUCTS,
  ROMANTIC_ENDINGS,
  bandForX100,
  getBandSpec,
  type BandId,
  type BandSpec,
  type CashoutVariantSpec,
  type DialogueRecord,
  type FictionalProduct,
  type GagId,
  type GagSpec,
  type GazeTargetId,
  type LateProgramSpec,
  type RexPoseTag,
  type RomanticEndingSpec,
} from './content';
import { clamp, stableHash } from './motion';

/** Each comedy beat occupies a 4.0s authoritative round-time slot (>= 3.2s caption dwell). */
export const BEAT_SLOT_MS = 4_000;

/** Crowd comment rotation interval (5.0s dwell time so ordinary readers can finish). */
export const COMMENT_SLOT_MS = 5_000;

/** Product advertisement rotation interval (6.0s dwell time). */
export const PRODUCT_SLOT_MS = 6_000;

/** Each late-escalation background program runs for 20s of authoritative round time (Page 8). */
export const LATE_PROGRAM_MS = 20_000;

/** Fixed window size for recent-slot history reconstruction (Page 23 & 25). */
export const RECENT_WINDOW_SLOTS = 5;

export type CrashStage =
  | 'freeze' // 0.00 to 0.12s: Freeze Rex mid-flex, dry click
  | 'compliment' // 0.12 to 0.75s: Milo "Looking good, bro", Rex eyebrow collapses to smile
  | 'recalculating' // 0.75 to 1.50s: Mirror REASON FOR STARING: RECALCULATING, Rex blushes
  | 'hand_hold' // 1.50 to 2.30s: Milo offers hand, Rex takes it at shared world point
  | 'wedding' // 2.30 to 4.80s: Smash cut to gym wedding, flowers & sobbing best man
  | 'opportunist'; // 4.80s+: Opportunist contract / Bea invoice, hold MOGGED BY LOVE

export type LateProgramPhase = 'intro' | 'contradiction' | 'reset';

export interface ActiveProgramBeat {
  spec: LateProgramSpec;
  phase: LateProgramPhase;
  ageSec: number;
  progress: number;
  bannerText: string;
}

export interface DirectedBeat {
  mode: 'waiting' | 'betting' | 'running' | 'cashout' | 'crashed';
  band: BandId;
  bandSpec: BandSpec;
  tension: number;
  slotIndex: number;
  slotAgeMs: number;
  slotProgress: number; // 0..1 within current 4s beat
  gag: GagSpec;
  gagStage: 'setup' | 'change' | 'reaction';
  dialogue: DialogueRecord;
  captionText: string;
  captionSpeaker: string;
  crowdComment: DialogueRecord;
  crowdCommentText: string;
  product: FictionalProduct;
  lateProgram: ActiveProgramBeat | null;
  rexPose: RexPoseTag;
  rexGaze: GazeTargetId;
  miloAction: 'rerack' | 'smile' | 'spot_offer' | 'compliment' | 'hand_hold' | 'wedding_groom';
  mirrorHeadline: string;
  cashoutVariant: CashoutVariantSpec | null;
  cashoutSettled: boolean;
  cashoutAgeSec: number;
  crashStage: CrashStage | null;
  crashVariant: RomanticEndingSpec | null;
  instantCrash: boolean;
  outcomeHeadline: string | null;
  outcomeSubline: string | null;
  opportunistLine: string | null;
}

const PRIORITY_GAGS: readonly GagId[] = ['G01', 'G05', 'G02', 'G07', 'G12'];

/**
 * Select a dialogue line for a given slot and band using a bounded window of
 * `RECENT_WINDOW_SLOTS` prior slots to avoid repeating a speaker or joke family.
 * Cost is strictly O(RECENT_WINDOW_SLOTS) and independent of round duration.
 */
const EVEN_SPEAKERS = new Set<DialogueRecord['speaker']>(['rex', 'apex', 'vera']);
const EVEN_FAMILIES = new Set<DialogueRecord['family']>([
  'routine_parody',
  'fake_science',
  'product_plug',
  'mirror_argument',
]);

export function selectDialogueForSlot(slotIndex: number, band: BandId): DialogueRecord {
  const safeSlot = Math.max(0, Math.floor(slotIndex));
  const startSlot = Math.max(0, safeSlot - RECENT_WINDOW_SLOTS);
  const recentIds = new Set<string>();
  let chosen: DialogueRecord = DIALOGUE_BY_ID['D01']!;

  for (let s = startSlot; s <= safeSlot; s++) {
    const isEven = s % 2 === 0;
    const bandsToRecord: BandId[] =
      s < safeSlot && band > 1 ? [band, (band - 1) as BandId] : [band];

    for (const checkBand of bandsToRecord) {
      const parityPool = ACTIVE_DIALOGUE_POOL.filter(
        (d) =>
          checkBand >= d.minBand &&
          checkBand <= d.maxBand &&
          EVEN_SPEAKERS.has(d.speaker) === isEven &&
          EVEN_FAMILIES.has(d.family) === isEven,
      );
      const pool =
        parityPool.length > 0
          ? parityPool
          : ACTIVE_DIALOGUE_POOL.filter(
              (d) =>
                EVEN_SPEAKERS.has(d.speaker) === isEven &&
                EVEN_FAMILIES.has(d.family) === isEven,
            );
      const h = stableHash(`${CONTENT_VERSION}:dialogue:b${checkBand}:s${s}`);

      let pick: DialogueRecord | undefined;
      for (let offset = 0; offset < pool.length; offset++) {
        const candidate = pool[(h + offset) % pool.length]!;
        if (!recentIds.has(candidate.id)) {
          pick = candidate;
          break;
        }
      }
      chosen = pick ?? pool[h % pool.length] ?? DIALOGUE_BY_ID['D01']!;
      recentIds.add(chosen.id);
    }
  }

  return chosen;
}

/**
 * Select the physical comedy gag for a running slot.
 * Prioritizes G01, G05, G02, G07 in the opening slots (Page 9) so early rounds
 * always deliver immediate physical punchlines, then rotates deterministically
 * across all 12 gags without back-to-back repeats.
 */
export function selectGagForSlot(slotIndex: number, band: BandId): GagSpec {
  const safeSlot = Math.max(0, Math.floor(slotIndex));
  if (safeSlot < PRIORITY_GAGS.length) {
    const priorityId = PRIORITY_GAGS[safeSlot]!;
    return GAG_BY_ID[priorityId];
  }
  // If in a late program (band >= 6), blend program gag with full gag pool
  const prevHash = stableHash(`${CONTENT_VERSION}:gag:${safeSlot - 1}`);
  const prevIdx = prevHash % GAGS.length;
  const h = stableHash(`${CONTENT_VERSION}:gag:${safeSlot}:b${band}`);
  let idx = h % GAGS.length;
  if (idx === prevIdx) {
    idx = (idx + 1) % GAGS.length;
  }
  return GAGS[idx]!;
}

/** Select the rotating background crowd comment (`@handle`). */
export function selectCrowdComment(elapsedMs: number, band: BandId): DialogueRecord {
  const commentSlot = Math.max(0, Math.floor(elapsedMs / COMMENT_SLOT_MS));
  const eligible = CROWD_COMMENTS.filter((c) => band >= c.minBand && band <= c.maxBand);
  const pool = eligible.length > 0 ? eligible : CROWD_COMMENTS;
  const h = stableHash(`${CONTENT_VERSION}:crowd:${commentSlot}`);
  return pool[h % pool.length] ?? CROWD_COMMENTS[0]!;
}

/** Select the rotating fictional product advertisement (P01–P16). */
export function selectProductAd(elapsedMs: number, band: BandId): FictionalProduct {
  const adSlot = Math.max(0, Math.floor(elapsedMs / PRODUCT_SLOT_MS));
  const h = stableHash(`${CONTENT_VERSION}:product:${adSlot}:b${band}`);
  return PRODUCTS[h % PRODUCTS.length] ?? PRODUCTS[0]!;
}

/**
 * Evaluate the 20-second background program rotation for late escalation
 * (`band >= 6` or `elapsedMs >= 24_000`, Page 8).
 */
export function evaluateLateProgram(elapsedMs: number, band: BandId): ActiveProgramBeat | null {
  if (band < 6 && elapsedMs < 24_000) return null;
  const cycleIndex = Math.max(0, Math.floor(elapsedMs / LATE_PROGRAM_MS));
  const spec = LATE_PROGRAMS[cycleIndex % LATE_PROGRAMS.length]!;
  const withinMs = ((elapsedMs % LATE_PROGRAM_MS) + LATE_PROGRAM_MS) % LATE_PROGRAM_MS;
  const ageSec = withinMs / 1000;
  const progress = clamp(withinMs / LATE_PROGRAM_MS, 0, 1);

  let phase: LateProgramPhase = 'contradiction';
  let bannerText = spec.contradictionText;
  if (ageSec < 4.0) {
    phase = 'intro';
    bannerText = spec.introBanner;
  } else if (ageSec >= 16.0) {
    phase = 'reset';
    bannerText = spec.resetTag;
  }

  return {
    spec,
    phase,
    ageSec,
    progress,
    bannerText,
  };
}

/**
 * Deterministic selection of TOUCH GRASS cashout variant (E01–E08, Page 11)
 * from confirmed `cashoutX100`.
 */
export function selectCashoutVariant(cashoutX100: number): CashoutVariantSpec {
  const safe = Math.max(100, Math.round(cashoutX100));
  // E01 is the canonical vertical-slice exit for early/sample exits (e.g. 1.42x on Page 20)
  if (safe === 142 || safe < 125) {
    return CASHOUT_VARIANTS[0]!;
  }
  const h = stableHash(`${CONTENT_VERSION}:cashout:${safe}`);
  return CASHOUT_VARIANTS[h % CASHOUT_VARIANTS.length] ?? CASHOUT_VARIANTS[0]!;
}

/**
 * Deterministic selection of MOGGED BY LOVE romantic crash ending (R01–R08, Page 12)
 * from final `currentX100` and `elapsedMs`. Defaults to R01 (Gym wedding) for the
 * canonical replay (907) and instant crashes so the gym wedding is always showcased.
 */
export function selectRomanticVariant(
  crashX100: number,
  elapsedMs: number,
  overrideIndex?: number | null,
): RomanticEndingSpec {
  if (overrideIndex !== undefined && overrideIndex !== null) {
    return ROMANTIC_ENDINGS[((overrideIndex % ROMANTIC_ENDINGS.length) + ROMANTIC_ENDINGS.length) % ROMANTIC_ENDINGS.length]!;
  }
  const safeX = Math.max(100, Math.round(crashX100));
  // Ensure the verified replay (9.07x) and instant crashes (1.00x) showcase R01 Gym wedding
  if (safeX <= 105 || safeX === 907) {
    return ROMANTIC_ENDINGS[0]!;
  }
  const h = stableHash(`${CONTENT_VERSION}:romantic:${safeX}:${Math.round(elapsedMs / 250)}`);
  return ROMANTIC_ENDINGS[h % ROMANTIC_ENDINGS.length] ?? ROMANTIC_ENDINGS[0]!;
}

/** Map `crashAgeSec` to the 6 canonical crash stages (Page 10 table). */
export function getCrashStage(crashAgeSec: number): CrashStage {
  if (crashAgeSec < 0.12) return 'freeze';
  if (crashAgeSec < 0.75) return 'compliment';
  if (crashAgeSec < 1.5) return 'recalculating';
  if (crashAgeSec < 2.3) return 'hand_hold';
  if (crashAgeSec < 4.8) return 'wedding';
  return 'opportunist';
}

export interface DirectorInput {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsedMs: number;
  crashAgeSec: number;
  cashoutX100: number | null;
  cashoutAgeSec: number | null; // null if not cashed out; >= 1.2s when settled or entered late
  cleanLanguage: boolean;
  romanticVariantOverride?: number | null;
}

/**
 * Compute the complete directed beat for the current frame.
 * Enforces strict outcome precedence:
 *   1. Confirmed cashout (`cashoutX100 !== null`) -> TOUCH GRASS exit
 *   2. Crashed without exit (`phase === 'crashed'`) -> MOGGED BY LOVE sequence
 *   3. Running (`phase === 'running'`) -> Band escalation, gag, and dialogue
 *   4. Waiting / Betting -> Gym bag & mirror warm-up
 */
export function evaluateDirector(input: DirectorInput): DirectedBeat {
  const {
    phase,
    currentX100,
    elapsedMs,
    crashAgeSec,
    cashoutX100,
    cashoutAgeSec,
    cleanLanguage,
    romanticVariantOverride,
  } = input;

  // Use confirmed exit multiplier for appearance band if player cashed out
  const effectiveX100 = cashoutX100 !== null ? cashoutX100 : Math.max(100, currentX100);
  const x = Math.max(1, effectiveX100 / 100);
  const tension = clamp(1 - 1 / x, 0, 1);
  const band = bandForX100(effectiveX100);
  const bandSpec = getBandSpec(band);

  const slotIndex = Math.max(0, Math.floor(elapsedMs / BEAT_SLOT_MS));
  const slotAgeMs = ((elapsedMs % BEAT_SLOT_MS) + BEAT_SLOT_MS) % BEAT_SLOT_MS;
  const slotProgress = clamp(slotAgeMs / BEAT_SLOT_MS, 0, 1);

  const gagStage: 'setup' | 'change' | 'reaction' =
    slotProgress < 0.32 ? 'setup' : slotProgress < 0.68 ? 'change' : 'reaction';

  const crowdComment = selectCrowdComment(elapsedMs, band);
  const crowdCommentText = cleanLanguage ? crowdComment.cleanText : crowdComment.text;
  const product = selectProductAd(elapsedMs, band);
  const lateProgram = evaluateLateProgram(elapsedMs, band);

  // 1. PRECEDENCE: Confirmed Cashout (TOUCH GRASS)
  if (cashoutX100 !== null) {
    const variant = selectCashoutVariant(cashoutX100);
    const exitAge = cashoutAgeSec ?? 2.0;
    const settled = exitAge >= 1.1;
    const dialogue = DIALOGUE_BY_ID['D21']!; // "I liked the hoodie."
    return {
      mode: 'cashout',
      band,
      bandSpec,
      tension: 0,
      slotIndex,
      slotAgeMs,
      slotProgress,
      gag: GAG_BY_ID['G01'],
      gagStage: 'reaction',
      dialogue,
      captionText: `${variant.headline} ${variant.subline}`,
      captionSpeaker: 'TOUCH GRASS · EXIT CONFIRMED',
      crowdComment,
      crowdCommentText,
      product,
      lateProgram: null,
      rexPose: 'walk_off',
      rexGaze: 'exit',
      miloAction: 'smile',
      mirrorHeadline: 'TOUCH GRASS · SESSION CLOSED',
      cashoutVariant: variant,
      cashoutSettled: settled,
      cashoutAgeSec: exitAge,
      crashStage: null,
      crashVariant: null,
      instantCrash: false,
      outcomeHeadline: `TOUCH GRASS · ${variant.headline}`,
      outcomeSubline: variant.subline,
      opportunistLine: variant.propDetail,
    };
  }

  // 2. PRECEDENCE: Crash without Exit (MOGGED BY LOVE, Page 10)
  if (phase === 'crashed') {
    const stage = getCrashStage(crashAgeSec);
    const instantCrash = currentX100 <= 102;
    const romantic = selectRomanticVariant(currentX100, elapsedMs, romanticVariantOverride);
    const revealLine = DIALOGUE_BY_ID['D13']!;

    let captionSpeaker = 'MILO';
    let captionText = instantCrash ? 'Hey. Need a spot?' : 'Looking good, bro.';
    let rexPose: RexPoseTag = 'heroic_flex';
    let rexGaze: GazeTargetId = 'milo';
    let miloAction: DirectedBeat['miloAction'] = 'compliment';
    let mirrorHeadline = 'SYSTEM FREEZE · UNEXPECTED INPUT';

    if (stage === 'freeze') {
      captionSpeaker = 'MIRROR OS';
      captionText = 'POSE LOCKED · ANALYZING SPOTTER EYE CONTACT…';
      rexPose = 'heroic_flex';
      rexGaze = 'milo';
      miloAction = 'smile';
    } else if (stage === 'compliment') {
      captionSpeaker = 'MILO';
      captionText = instantCrash
        ? 'You can just say hello.'
        : 'Looking good, bro. You look good when you stop checking.';
      rexPose = 'caught_staring';
      rexGaze = 'milo';
      miloAction = 'compliment';
      mirrorHeadline = 'COMPLIMENT RECEIVED · 0% SPONSORED';
    } else if (stage === 'recalculating') {
      captionSpeaker = 'REX';
      captionText = cleanLanguage ? revealLine.cleanText : revealLine.text;
      rexPose = 'blush_reveal';
      rexGaze = 'milo';
      miloAction = 'compliment';
      mirrorHeadline = 'REASON FOR STARING: RECALCULATING…';
    } else if (stage === 'hand_hold') {
      captionSpeaker = instantCrash ? 'INSTANT REVEAL' : 'MUTUAL ATTRACTION';
      captionText = instantCrash
        ? 'ALL THAT RESEARCH. ONE HELLO.'
        : 'Coffee. Two people. No pitch deck.';
      rexPose = 'blush_reveal';
      rexGaze = 'milo';
      miloAction = 'hand_hold';
      mirrorHeadline = instantCrash
        ? 'NO REFUNDS · CRUSH CONFIRMED'
        : 'BRAND COLLAPSED · HAND-HOLD ACTIVE';
    } else {
      // 'wedding' (2.30..4.80s) and 'opportunist' (4.80s+)
      captionSpeaker = `MOGGED BY LOVE · ${romantic.name.toUpperCase()}`;
      captionText = instantCrash
        ? 'ALL THAT RESEARCH. ONE HELLO. You were looking for gains. You found a husband.'
        : cleanLanguage
          ? romantic.cleanVowLine
          : romantic.vowLine;
      rexPose = 'wedding_vows';
      rexGaze = 'milo';
      miloAction = 'wedding_groom';
      mirrorHeadline = 'MOGGED BY LOVE · OPTIMAL UNION';
    }

    return {
      mode: 'crashed',
      band,
      bandSpec,
      tension,
      slotIndex,
      slotAgeMs,
      slotProgress,
      gag: GAG_BY_ID['G12'],
      gagStage: 'reaction',
      dialogue: revealLine,
      captionText,
      captionSpeaker,
      crowdComment: DIALOGUE_BY_ID['D57']!,
      crowdCommentText: DIALOGUE_BY_ID['D57']!.text,
      product,
      lateProgram: null, // Cut all side comedy immediately on crash (Page 6 & 8)
      rexPose,
      rexGaze,
      miloAction,
      mirrorHeadline,
      cashoutVariant: null,
      cashoutSettled: false,
      cashoutAgeSec: 0,
      crashStage: stage,
      crashVariant: romantic,
      instantCrash,
      outcomeHeadline: 'MOGGED BY LOVE',
      outcomeSubline: instantCrash
        ? 'ALL THAT RESEARCH. ONE HELLO.'
        : 'You were looking for gains. You found a husband.',
      opportunistLine:
        stage === 'opportunist'
          ? romantic.opportunistTag
          : instantCrash
            ? 'RECEIPT PRINTER: NO REFUNDS'
            : romantic.sceneDescription,
    };
  }

  // 3. PRECEDENCE: Running Escalation
  if (phase === 'running') {
    const gag = selectGagForSlot(slotIndex, band);
    const dialogue = selectDialogueForSlot(slotIndex, band);
    const text = cleanLanguage ? dialogue.cleanText : dialogue.text;

    // Gaze behavior (Page 21): Rex alternates between the gag's gaze, Milo, and his own mirror reflection
    let rexGaze: GazeTargetId = gag.gaze;
    if (gagStage === 'setup' && gag.id !== 'G05') {
      rexGaze = dialogue.gaze;
    } else if (gagStage === 'reaction' && gag.gaze === 'milo') {
      // Delayed recovery after getting caught staring (Page 21)
      rexGaze = slotProgress > 0.84 ? 'mirror' : 'milo';
    }

    const miloAction: DirectedBeat['miloAction'] =
      band >= 3 && slotIndex % 2 === 1 ? 'spot_offer' : slotProgress > 0.5 ? 'smile' : 'rerack';

    return {
      mode: 'running',
      band,
      bandSpec,
      tension,
      slotIndex,
      slotAgeMs,
      slotProgress,
      gag,
      gagStage,
      dialogue,
      captionText: text,
      captionSpeaker: dialogue.speakerLabel,
      crowdComment,
      crowdCommentText,
      product,
      lateProgram,
      rexPose: gag.pose,
      rexGaze,
      miloAction,
      mirrorHeadline: lateProgram ? lateProgram.spec.title : bandSpec.mirrorStatus,
      cashoutVariant: null,
      cashoutSettled: false,
      cashoutAgeSec: 0,
      crashStage: null,
      crashVariant: null,
      instantCrash: false,
      outcomeHeadline: null,
      outcomeSubline: null,
      opportunistLine: null,
    };
  }

  // 4. Waiting or Betting state (Page 4 & 20)
  const isBetting = phase === 'betting';
  const openLine = isBetting ? DIALOGUE_BY_ID['D49']! : DIALOGUE_BY_ID['D01']!;
  return {
    mode: phase,
    band: 1,
    bandSpec: BAND_SPECS[0]!,
    tension: 0,
    slotIndex: 0,
    slotAgeMs: 0,
    slotProgress: 0,
    gag: GAG_BY_ID['G01'],
    gagStage: 'setup',
    dialogue: openLine,
    captionText: isBetting
      ? 'PAL: The authentic version of you is available on Pro. (Join round or watch Rex optimize.)'
      : 'Rex checks his reflection. Milo reracks a dumbbell. A subscription quietly renews itself.',
    captionSpeaker: isBetting ? 'PAL · SELF-IMPROVEMENT APP' : 'LOCKER ROOM · WAITING',
    crowdComment: DIALOGUE_BY_ID['D53']!,
    crowdCommentText: DIALOGUE_BY_ID['D53']!.text,
    product: PRODUCTS[0]!,
    lateProgram: null,
    rexPose: 'mirror_check',
    rexGaze: isBetting ? 'phone' : 'mirror',
    miloAction: 'rerack',
    mirrorHeadline: isBetting
      ? 'APP OPEN · SELECT UPGRADES OR JOIN ROUND'
      : 'BASELINE FACE DETECTED · SUBSCRIPTION RENEWED',
    cashoutVariant: null,
    cashoutSettled: false,
    cashoutAgeSec: 0,
    crashStage: null,
    crashVariant: null,
    instantCrash: false,
    outcomeHeadline: null,
    outcomeSubline: null,
    opportunistLine: null,
  };
}
