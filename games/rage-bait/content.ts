/**
 * Authored content bank for Rage Bait: recurring fictional advice accounts,
 * 24 tiered posts with paired top replies and expanded threads, the nine-step
 * draft ladder, six crash response variants, eight overtime follow-ups, and
 * ending captions.
 *
 * All accounts and statements are satirical fiction; nothing here predicts or
 * alters the committed crash outcome.
 */

export const PALETTE = {
  charcoal: '#17191D',
  appBg: '#121418',
  cardBg: '#1D2026',
  cardNeighbor: '#181B20',
  replyBg: '#252932',
  composerBg: '#15181E',
  ivory: '#F4F0E8',
  muted: '#A3ABB8',
  dim: '#6E7685',
  lime: '#C8FF2E',
  orange: '#FF6B24',
  crashRed: '#E63A43',
  postBlue: '#2B88FF',
  ink: '#0B0C0E',
  border: '#323846',
  warmGlow: '#FFB870',
  coolGlow: '#6CA8FF',
} as const;

export type Tier = 1 | 2 | 3 | 4 | 5 | 6;

export type AccountPerspective = 'side-a' | 'side-b' | 'couple' | 'meta';

export interface Account {
  id: string;
  name: string;
  handle: string;
  voice: string;
  contradiction: string;
  perspective: AccountPerspective;
  avatarColor: string;
  avatarAccent: string;
}

export const ACCOUNTS: readonly Account[] = [
  {
    id: 'soft-life',
    name: 'Soft Life CEO',
    handle: '@softlifeceo',
    voice: 'Luxury dating advice and entitlement framed as self-respect.',
    contradiction: 'Calls herself independent while assigning every bill to a partner.',
    perspective: 'side-a',
    avatarColor: '#FF7EB6',
    avatarAccent: '#F7C86A',
  },
  {
    id: 'coach-provider',
    name: 'Coach Provider',
    handle: '@coachprovider',
    voice: 'Absolute rules about masculinity, discipline, and provision.',
    contradiction: 'Preaches traditional roles while selling ways to avoid responsibility.',
    perspective: 'side-b',
    avatarColor: '#FF6B24',
    avatarAccent: '#F4F0E8',
  },
  {
    id: 'splitcheck-king',
    name: 'SplitCheck King',
    handle: '@splitcheckking',
    voice: 'Spreadsheet romance and grievance disguised as fairness.',
    contradiction: 'Demands financial equality but itemizes only his own contributions.',
    perspective: 'side-b',
    avatarColor: '#4DA6FF',
    avatarAccent: '#C8FF2E',
  },
  {
    id: 'boundary-babe',
    name: 'Boundary Babe',
    handle: '@boundarybabe',
    voice: 'Therapy vocabulary used with unjustified certainty.',
    contradiction: 'Calls every expectation controlling and every personal demand a boundary.',
    perspective: 'side-a',
    avatarColor: '#B580FF',
    avatarAccent: '#F4F0E8',
  },
  {
    id: 'couples-court',
    name: 'Couples Court',
    handle: '@couplescourt',
    voice: 'A fictional couple that turns private disputes into episodes.',
    contradiction: 'Their next sponsored reconciliation contradicts the previous breakup.',
    perspective: 'couple',
    avatarColor: '#FFC83B',
    avatarAccent: '#FF6B24',
  },
  {
    id: 'engagement-dept',
    name: 'Engagement Dept',
    handle: '@engagementdept',
    voice: 'A smug curator of polls, quote posts, and comment screenshots.',
    contradiction: 'Admits the bait works, then treats every reply as a testimonial.',
    perspective: 'meta',
    avatarColor: '#C8FF2E',
    avatarAccent: '#17191D',
  },
] as const;

export const ACCOUNT_BY_ID: Readonly<Record<string, Account>> = Object.fromEntries(
  ACCOUNTS.map((a) => [a.id, a]),
);

export interface DraftItem {
  id: string;
  level: number;
  text: string;
  postedComment: string;
}

/** Nine drafts in order of intensity (Page 7). */
export const DRAFT_LADDER: readonly DraftItem[] = [
  { id: 'actually', level: 1, text: 'Actually...', postedComment: 'Actually, basic manners apply to both people.' },
  { id: 'that-is-not-how', level: 2, text: 'That is not how...', postedComment: 'That is not how any normal relationship works.' },
  { id: 'respectfully', level: 3, text: 'Respectfully...', postedComment: 'Respectfully, this contradicts your last three posts.' },
  { id: 'cannot-be-serious', level: 4, text: 'You cannot be serious', postedComment: 'You cannot be serious right now. Read that out loud.' },
  { id: 'ignore-this', level: 5, text: 'I was going to ignore this', postedComment: 'I was going to ignore this, but the math makes zero sense.' },
  { id: 'let-me-explain', level: 6, text: 'Let me explain something', postedComment: 'Let me explain something about hypocrisy in four points:' },
  { id: 'no-idea', level: 7, text: 'You have NO idea', postedComment: 'You have NO idea how real adults split responsibilities!' },
  { id: 'listen-here', level: 8, text: 'LISTEN HERE', postedComment: 'LISTEN HERE... YOU ARE INVENTING RULES FOR CLICKS!' },
  { id: 'spreadsheet', level: 9, text: 'I MADE A SPREADSHEET.', postedComment: 'LISTEN HERE... I MADE A SPREADSHEET OF YOUR CONTRADICTIONS!' },
] as const;

export const DRAFT_BY_ID: Readonly<Record<string, DraftItem>> = Object.fromEntries(
  DRAFT_LADDER.map((d) => [d.id, d]),
);

export interface CrashResponse {
  id: string;
  short: string;
  long: string;
}

/** Six crash response variants (Page 8). */
export const CRASH_RESPONSES: readonly CrashResponse[] = [
  { id: 'essay', short: 'Bro wrote an essay', long: 'Bro wrote an essay. Thanks for the engagement.' },
  { id: 'boosting', short: 'Thanks for boosting this', long: 'Thanks for boosting this into the algorithm.' },
  { id: 'proving-point', short: 'You are proving my point', long: 'You are proving my point in the replies.' },
  { id: 'part-two', short: 'Screenshotting this for part two', long: 'Screenshotting this for part two. Stay mad.' },
  { id: 'automated', short: 'This account is automated', long: 'This account is automated. Thanks for the engagement.' },
  { id: 'not-reading', short: 'Not reading all that.', long: 'Not reading all that. Thanks for the engagement.' },
] as const;

export const CRASH_RESPONSE_BY_ID: Readonly<Record<string, CrashResponse>> = {
  ...Object.fromEntries(CRASH_RESPONSES.map((r) => [r.id, r])),
  engagement: CRASH_RESPONSES[5]!,
};

export type BaitCard = {
  id: string;
  tier: Tier;
  accountId: string;
  post: string;
  topReply: string;
  replies: string[];
  draftId: string;
  crashReplyId: string;
  callbackTo?: string;
  callbackTag?: string;
};

/** Neutral preview card shown only during the waiting phase (Page 4). */
export const WAITING_CARD: BaitCard = {
  id: 'rb-waiting',
  tier: 1,
  accountId: 'engagement-dept',
  post: 'Your feed is calibrated for maximum composure. Surely nobody is wrong on the internet today.',
  topReply: 'Algorithm warming up for the next round.',
  replies: [
    'Remember: scrolling is free, replying is taking the bait.',
    'Touch grass remains undefeated.',
  ],
  draftId: 'actually',
  crashReplyId: 'not-reading',
};

/**
 * The 24 authored starter cards across Tiers 1 to 6 (Pages 10-12).
 * Content IDs remain stable (`rb-01` .. `rb-24`).
 */
export const BAIT_CARDS: readonly BaitCard[] = [
  // ---- Tier 1: 1.00x to <1.30x ----
  {
    id: 'rb-01',
    tier: 1,
    accountId: 'soft-life',
    post: 'If he wants to split the bill, you have a roommate.',
    topReply: 'The angry men are proving my point.',
    replies: [
      'A roommate at least pays rent.',
      'This is why I date my accountant.',
    ],
    draftId: 'actually',
    crashReplyId: 'engagement',
  },
  {
    id: 'rb-02',
    tier: 1,
    accountId: 'coach-provider',
    post: 'Men want a traditional wife on a roommate budget.',
    topReply: 'Tradition has a minimum deposit.',
    replies: [
      'He wants 1950s dinner on a 50/50 Venmo request.',
      'Both of you brought coupons to this argument.',
    ],
    draftId: 'that-is-not-how',
    crashReplyId: 'essay',
  },
  {
    id: 'rb-03',
    tier: 1,
    accountId: 'splitcheck-king',
    post: 'She is independent until the waiter brings the bill.',
    topReply: 'Equality left before dessert.',
    replies: [
      'Independence has terms and conditions.',
      'The waiter is the only neutral party here.',
    ],
    draftId: 'actually',
    crashReplyId: 'boosting',
  },
  {
    id: 'rb-04',
    tier: 1,
    accountId: 'couples-court',
    post: 'A coffee date is low effort. Anyway, here is our sponsored coffee code.',
    topReply: 'Use code STANDARDS.',
    replies: [
      'Nothing says romance like an affiliate link.',
      'They filmed this argument in the drive-thru.',
    ],
    draftId: 'respectfully',
    crashReplyId: 'part-two',
  },

  // ---- Tier 2: 1.30x to <1.70x ----
  {
    id: 'rb-05',
    tier: 2,
    accountId: 'soft-life',
    post: 'If you have to ask what she brings to the table, you cannot afford the table.',
    topReply: 'The table has standards.',
    replies: [
      'Ikea sells that exact table for forty dollars.',
      'Nobody at this restaurant is eating.',
    ],
    draftId: 'that-is-not-how',
    crashReplyId: 'proving-point',
    callbackTo: 'rb-01',
  },
  {
    id: 'rb-06',
    tier: 2,
    accountId: 'coach-provider',
    post: 'A real provider never asks the price. My course is 499 a month.',
    topReply: 'Can I split that payment?',
    replies: [
      'Real providers apparently need my debit card.',
      'Chapter 1: How to charge men for common sense.',
    ],
    draftId: 'respectfully',
    crashReplyId: 'boosting',
    callbackTo: 'rb-02',
  },
  {
    id: 'rb-07',
    tier: 2,
    accountId: 'splitcheck-king',
    post: 'If she brings nothing to the table, why am I paying for the restaurant?',
    topReply: 'He finally found the receipt.',
    replies: [
      'He itemized the bread basket by slice.',
      'Just stay home and Venmo each other five dollars.',
    ],
    draftId: 'cannot-be-serious',
    crashReplyId: 'essay',
    callbackTo: 'rb-03',
  },
  {
    id: 'rb-08',
    tier: 2,
    accountId: 'boundary-babe',
    post: 'Asking where I want dinner puts the emotional labor of your date on me.',
    topReply: 'Guess correctly. That is the bare minimum.',
    replies: [
      'Reading menus is now a boundary violation.',
      'He guessed tacos and got a three-page therapy note.',
    ],
    draftId: 'cannot-be-serious',
    crashReplyId: 'not-reading',
  },

  // ---- Tier 3: 1.70x to <2.30x ----
  {
    id: 'rb-09',
    tier: 3,
    accountId: 'soft-life',
    post: 'My money is mine. His money is ours. This is not complicated.',
    topReply: 'Somebody is opening a spreadsheet.',
    replies: [
      'Archived screenshot: "Never depend on anyone."',
      'Even my accountant just closed his laptop.',
    ],
    draftId: 'ignore-this',
    crashReplyId: 'proving-point',
    callbackTo: 'rb-05',
    callbackTag: 'Archived post: "Never depend on anyone."',
  },
  {
    id: 'rb-10',
    tier: 3,
    accountId: 'coach-provider',
    post: 'I want a wife who follows my lead. She can start by covering my half of rent.',
    topReply: 'Lead her to the payment portal.',
    replies: [
      'Pinned advert: Alpha Provider Bootcamp ($499/mo).',
      'Traditional head of household on a cosigned studio.',
    ],
    draftId: 'let-me-explain',
    crashReplyId: 'boosting',
    callbackTo: 'rb-06',
    callbackTag: 'Pinned ad: Provider Course · $499/mo',
  },
  {
    id: 'rb-11',
    tier: 3,
    accountId: 'splitcheck-king',
    post: 'She wants a provider. I want someone who provides half the electricity bill.',
    topReply: 'Romance is on a prepaid meter.',
    replies: [
      'He timed her hairdryer with a stopwatch.',
      'Candlelight dinner just to save on kilowatts.',
    ],
    draftId: 'cannot-be-serious',
    crashReplyId: 'essay',
    callbackTo: 'rb-07',
  },
  {
    id: 'rb-12',
    tier: 3,
    accountId: 'couples-court',
    post: 'We believe in equal effort. He pays. I choose where we go.',
    topReply: 'Both roles are exhausting.',
    replies: [
      'Next episode: Why we broke up in the parking lot.',
      'Delegation is their only shared hobby.',
    ],
    draftId: 'ignore-this',
    crashReplyId: 'part-two',
    callbackTo: 'rb-04',
  },

  // ---- Tier 4: 2.30x to <3.50x ----
  {
    id: 'rb-13',
    tier: 4,
    accountId: 'boundary-babe',
    post: 'Your boundary is controlling. Mine is non-negotiable. Learn the difference.',
    topReply: 'The difference is whose account posted it.',
    replies: [
      '[Author deleted a polite question about whose boundary takes precedence]',
      'Weaponized therapy words speedrun any-percent.',
    ],
    draftId: 'let-me-explain',
    crashReplyId: 'not-reading',
    callbackTo: 'rb-08',
    callbackTag: 'Author deleted a polite question on precedence',
  },
  {
    id: 'rb-14',
    tier: 4,
    accountId: 'coach-provider',
    post: 'Emotional availability is weakness. Also, why does nobody understand what men go through?',
    topReply: 'Comments are temporarily unavailable.',
    replies: [
      'Recorded on a four-hour podcast about his feelings.',
      'Stoicism is when you yell into a ring light.',
    ],
    draftId: 'no-idea',
    crashReplyId: 'essay',
    callbackTo: 'rb-10',
  },
  {
    id: 'rb-15',
    tier: 4,
    accountId: 'soft-life',
    post: 'If you need loyalty, you probably cannot afford competition.',
    topReply: 'Loyalty is apparently a subscription.',
    replies: [
      'Upgrade to Platinum Partner to disable roaming.',
      'Even airline miles have better retention rules.',
    ],
    draftId: 'no-idea',
    crashReplyId: 'boosting',
    callbackTo: 'rb-09',
  },
  {
    id: 'rb-16',
    tier: 4,
    accountId: 'splitcheck-king',
    post: 'She asked for emotional support, so I sent the invoice for the last three dates.',
    topReply: 'Customer service has entered the chat.',
    replies: [
      'Line item 4: Fifteen minutes of sympathetic nodding.',
      'He charged a convenience fee for holding hands.',
    ],
    draftId: 'let-me-explain',
    crashReplyId: 'part-two',
    callbackTo: 'rb-11',
  },

  // ---- Tier 5: 3.50x to <6.00x ----
  {
    id: 'rb-17',
    tier: 5,
    accountId: 'engagement-dept',
    post: 'Some unemployed man is typing a paragraph under this right now.',
    topReply: 'Please include your sources. We need the engagement.',
    replies: [
      'Keep typing, the ad revenue clears at fifty words.',
      'Your backspace key is working overtime.',
    ],
    draftId: 'listen-here',
    crashReplyId: 'essay',
  },
  {
    id: 'rb-18',
    tier: 5,
    accountId: 'soft-life',
    post: 'If this post upsets you, you are exactly the man I was talking about.',
    topReply: 'Every reply is another case study.',
    replies: [
      'Classic kafkatrap with a luxury sponsorship.',
      'She monetized the quote-posts in twelve minutes.',
    ],
    draftId: 'listen-here',
    crashReplyId: 'proving-point',
    callbackTo: 'rb-15',
  },
  {
    id: 'rb-19',
    tier: 5,
    accountId: 'coach-provider',
    post: 'People who call this rage bait are just angry that it is true.',
    topReply: 'He has monetized the denial.',
    replies: [
      'Step 1: Say something absurd. Step 2: Sell the rebuttal.',
      'The mic gain goes up every time his logic drops.',
    ],
    draftId: 'no-idea',
    crashReplyId: 'boosting',
    callbackTo: 'rb-14',
  },
  {
    id: 'rb-20',
    tier: 5,
    accountId: 'boundary-babe',
    post: 'Silence means you agree. Replying means you are triggered. Hope this helps.',
    topReply: 'A perfectly balanced conversation.',
    replies: [
      'Heads I win, tails you need my webinar.',
      'Closing the app is the only winning move.',
    ],
    draftId: 'listen-here',
    crashReplyId: 'not-reading',
    callbackTo: 'rb-13',
  },

  // ---- Tier 6: 6.00x and above ----
  {
    id: 'rb-21',
    tier: 6,
    accountId: 'engagement-dept',
    post: 'Deleted the post because you cannot handle honesty. Full version is behind the paywall.',
    topReply: 'Premium outrage now available.',
    replies: [
      'Imagine paying five dollars a month to get mad.',
      'The paywall is just a screenshot of your own comment.',
    ],
    draftId: 'spreadsheet',
    crashReplyId: 'automated',
    callbackTo: 'rb-17',
  },
  {
    id: 'rb-22',
    tier: 6,
    accountId: 'couples-court',
    post: 'We broke up over the bill. Our sponsored reunion episode drops Friday.',
    topReply: 'Love wins. The sponsor pays.',
    replies: [
      'Use code RECONCILE for 20% off couples counseling.',
      'Next week they fake a divorce for mattress ads.',
    ],
    draftId: 'listen-here',
    crashReplyId: 'part-two',
    callbackTo: 'rb-12',
  },
  {
    id: 'rb-23',
    tier: 6,
    accountId: 'coach-provider',
    post: 'Stop taking relationship advice from strangers. Buy my private course instead.',
    topReply: 'Now the stranger has your card details.',
    replies: [
      'Self-awareness sold separately.',
      'No refunds, because accountability is a mindset.',
    ],
    draftId: 'spreadsheet',
    crashReplyId: 'boosting',
    callbackTo: 'rb-19',
  },
  {
    id: 'rb-24',
    tier: 6,
    accountId: 'soft-life',
    post: 'An apology to everyone I offended: premium members deserved to see it first.',
    topReply: 'Accountability has a subscription tier.',
    replies: [
      'She put the sigh behind a VIP tier.',
      'Thanks for the engagement, see you next controversy.',
    ],
    draftId: 'spreadsheet',
    crashReplyId: 'not-reading',
    callbackTo: 'rb-18',
  },
] as const;

export const CARD_BY_ID: Readonly<Record<string, BaitCard>> = {
  [WAITING_CARD.id]: WAITING_CARD,
  ...Object.fromEntries(BAIT_CARDS.map((c) => [c.id, c])),
};

/** Eight overtime follow-up lines in a continuing authored cycle (Pages 6 & 12). */
export const OVERTIME_FOLLOWUPS: readonly string[] = [
  'Part two is about the replies',
  'My old clip was taken out of the exact context I said it in',
  'Apology video at 8',
  'The apology was satire',
  'Subscribers vote on who is wrong',
  'We are back together for one episode',
  'You cannot reply because I believe in open debate',
  'This argument is sponsored.',
] as const;

export type OvertimePropKind =
  | 'badge-grows'
  | 'course-price'
  | 'lopsided-poll'
  | 'apology-sponsor'
  | 'locked-reply';

/** Five overtime prop variations rotated independently of the 8 follow-ups (Page 12). */
export const OVERTIME_PROPS: readonly OvertimePropKind[] = [
  'badge-grows',
  'course-price',
  'lopsided-poll',
  'apology-sponsor',
  'locked-reply',
] as const;

/** Three successful-exit captions (Pages 2 & 8). */
export const SUCCESS_CAPTIONS: readonly string[] = [
  'Peace restored.',
  'Argument left on read.',
  'Touch grass achieved.',
] as const;

/** First-time explanation lines shown only in waiting or betting (Page 4). */
export const TUTORIAL_LINES = [
  'Cash out before your character takes the bait.',
  'Scrolling changes the feed. The round keeps running.',
] as const;

/** Determine the unlocked tier (1..6) from `currentX100` (Page 6). */
export function tierForX100(x100: number): Tier {
  if (x100 < 130) return 1;
  if (x100 < 170) return 2;
  if (x100 < 230) return 3;
  if (x100 < 350) return 4;
  if (x100 < 600) return 5;
  return 6;
}

/** Compact numeric formatting for decorative counters so large values never break layout (Page 16). */
export function formatCount(n: number): string {
  const clamped = Math.max(0, Math.min(9_900_000, Math.floor(n)));
  if (clamped >= 1_000_000) return `${(clamped / 1_000_000).toFixed(1)}M`;
  if (clamped >= 10_000) return `${(clamped / 1_000).toFixed(1)}K`;
  if (clamped >= 1_000) return `${(clamped / 1_000).toFixed(1)}K`;
  return String(clamped);
}
