/**
 * The hearing's words: the opening, the ladder keyed to the displayed multiplier, the overtime cycle that keeps a
 * long round talking, the regret lines after an accepted exit, the crash's lines, the captions and the stamps.
 * Every exchange is two bubbles, the senator then the witness, the reply held back by the script's `gap`.
 * Presentation only: nothing here reads or changes the round's outcome.
 */
import type { Line } from './script';

/** Who speaks: the five senators in seniority order, the witness, the page. */
export type Who = 'marcus' | 'vance' | 'ruiz' | 'howe' | 'bell' | 'witness' | 'page';
export const SENATORS: readonly Who[] = ['marcus', 'vance', 'ruiz', 'howe', 'bell'];
export const NAMES: Record<Who, string> = {
  marcus: 'Chairman Marcus',
  vance: 'Sen. Vance',
  ruiz: 'Sen. Ruiz',
  howe: 'Sen. Howe',
  bell: 'Sen. Bell',
  witness: 'The witness',
  page: 'The page',
};

/**
 * Beats a line stages when it is said: `gavel` brings the Chairman's gavel down on the block, `paper` raises Ruiz's
 * white paper, `wallet` holds up Bell's hardware wallet, `bill` raises Vance's one-sentence bill and sends the
 * page to the witness table and back, `wake` wakes Howe for the line, `summon` calls the page to the Chairman,
 * `card` sends the page in with a card, `boat` turns Vance to the gallery and sets it applauding, `hand` raises a
 * hand for a position.
 */
export type Beat = 'gavel' | 'paper' | 'wallet' | 'bill' | 'wake' | 'summon' | 'card' | 'boat' | 'hand';

/** Said while bets are open: the call to order, then the page arrives with a card. */
export const OPENING: Omit<Line, 'at'>[] = [
  { who: 'marcus', text: 'This bipartisan hearing is called to order. Wait—did he donate to both parties? Which one are we mad at?', cap: 'GM COMMITTEE', beat: 'gavel' },
  { who: 'page', text: 'Chairman, your spouse’s blind trust says we’re bullish until 2:15.', gap: 2.6, beat: 'card' },
];

const W = (text: string, gap = 1.1, cap?: string): Omit<Line, 'at'> => ({ who: 'witness', text, gap, ...(cap ? { cap } : {}) });

/** The ladder, keyed to the displayed multiplier. `cap` walks the caption ladder as each line is said. */
export const LADDER: Line[] = [
  { at: 1.15, who: 'vance', text: 'Is this coin woke ESG communism, or patriotic freedom money? Answer before my Fox hit at two.', cap: 'BIPARTISAN GRIFT' },
  { at: 1.15, ...W('Senator, it’s whichever one gets the SEC off my back.') },
  { at: 1.35, who: 'ruiz', text: 'This white paper is predatory late-stage techno-feudalism! Also, did your PAC wire clear yet?', cap: 'NUMBER GO UP', beat: 'paper' },
  { at: 1.35, ...W('Cleared this morning under “Effective Altruism for Climate Equity.”') },
  { at: 1.55, who: 'bell', text: 'My husband Paul bought this USB stick after our classified briefing. Does it take calls or puts?', beat: 'wallet' },
  { at: 1.55, ...W('It’s a breathalyzer, Senator. Keep blowing.', 1.4) },
  { at: 1.8, who: 'marcus', text: 'Let the record show the witness is cooperating with the spouse’s portfolio.', cap: 'IN THE RECORD', beat: 'gavel' },
  { at: 2.1, who: 'vance', text: 'The supply is capped at 21 million! How are we supposed to print more for a foreign war?' },
  { at: 2.1, ...W('We just mint a governance token and call it an aid package.') },
  { at: 2.1, who: 'vance', text: 'My God. Write that down.', gap: 0.9 },
  { at: 2.1, ...W('Already sent it to your defense lobbyist.') },
  { at: 2.4, who: 'ruiz', text: 'For my TikTok clip: I am girlboss-grilling you on behalf of the unbanked! Smile at camera two.', beat: 'paper' },
  { at: 2.8, who: 'howe', text: 'Objection! Bomb the blockchain and build a pipeline through it!', beat: 'wake' },
  { at: 3.2, who: 'bell', text: 'That unwashed hoodie. Is that Antifa, a Silicon Valley cult, or my grandson?' },
  { at: 3.2, ...W('Yes, Senator. It’s Balenciaga.') },
  { at: 3.2, who: 'marcus', text: 'Let the record show the hoodie costs more than a school lunch bill.', cap: 'DIAMOND HOODIE', beat: 'gavel', gap: 0.9 },
  { at: 3.8, who: 'vance', text: 'My Consumer Protection Act has one sentence: ‘10% for the Big Guy and 10% for the Freedom Caucus.’', beat: 'bill' },
  { at: 4.5, who: 'marcus', text: 'The cameras are on. Everyone state your official position for the STOCK Act disclosure.', life: 3 },
  { at: 4.5, who: 'marcus', text: 'Long via my wife’s LLC.', gap: 0.5, beat: 'hand' },
  { at: 4.5, who: 'vance', text: 'Long for Jesus and the free market.', gap: 0.55, beat: 'hand' },
  { at: 4.5, who: 'ruiz', text: 'Intersectionally long.', gap: 0.55, beat: 'hand' },
  { at: 4.5, who: 'howe', text: 'Lockheed Martin!', gap: 0.6, beat: 'wake' },
  { at: 4.5, who: 'bell', text: 'Paul already exercised the options.', gap: 0.6, beat: 'hand' },
  { at: 5.5, who: 'ruiz', text: 'Directly, then: is this coin a Ponzi scheme, or an inclusive community wealth-building protocol?', beat: 'paper' },
  { at: 5.5, ...W('It’s a Ponzi with pronouns in the bio, Senator.') },
  { at: 5.5, who: 'marcus', text: 'Let the record show both sides of the aisle feel seen.', cap: 'LET THE RECORD SHOW', beat: 'gavel', gap: 0.9 },
  { at: 7, who: 'bell', text: 'If the middle class finds out how this works, will they stop paying taxes?', beat: 'wallet' },
  { at: 7, ...W('No, they’ll just ape the top and blame the other party.', 1.4) },
  { at: 9, who: 'vance', text: 'My Super PAC is now accepting seed-round allocations on the donor yacht. Strictly for prayer.', beat: 'boat' },
  { at: 12, who: 'marcus', text: 'Page, check the chart. Are we regulating him or giving him a subsidy?', beat: 'summon' },
  { at: 12, who: 'page', text: 'Up 12×, Chairman. You’re co-sponsoring his bailout.', gap: 1.6 },
  { at: 12, who: 'marcus', text: 'God bless American innovation.', gap: 0.9, beat: 'gavel' },
  { at: 18, who: 'marcus', text: 'Does the witness have anything to add before we recess for the fundraiser?' },
  { at: 18, ...W('The liquidity just bridged to the Caymans, Chairman. Right next to your campaign accounts.', 1.2, 'THIS IS FINE') },
  { at: 18, who: 'marcus', text: 'Strike the Caymans from the record —', gap: 0.8, life: 2.8 },
  { at: 25, who: 'marcus', text: 'Nobody touch the sell button until the committee’s limit orders fill!', beat: 'gavel' },
];

/**
 * Past the last rung, one of these comes due every 1.35× of multiplier, in order, forever; `then` is the reply,
 * said a beat after the question.
 */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'bell', text: 'Follow-up. How do I turn off the public ledger? Constituents are reading my trades.', then: W('You call it national security, Senator.', 1.3) },
  { who: 'vance', text: 'If a Supreme Court justice accepts an airdrop on a yacht, is it a gratuity?', then: W('Only if the yacht is staked.') },
  { who: 'marcus', text: 'Let the record show Congress has outperformed the S&P 500 for the fourteenth straight year.', cap: 'IN THE RECORD', beat: 'gavel' },
  { who: 'ruiz', text: 'Page ten of the white paper just says ‘Vibes and Regulatory Capture.’ I’m offended I didn’t write it.', beat: 'paper', then: W('We used your speechwriter.') },
  { who: 'howe', text: 'Are the Russians in the computer?!', beat: 'wake', then: { who: 'marcus', text: 'It’s 2026, Senator. Go back to sleep.', gap: 1 } },
  { who: 'vance', text: 'Can my family office write off a rug pull as a charitable faith-based initiative?', then: W('The IRS calls that a foundation, Senator.') },
  { who: 'bell', text: 'My intern says ‘have fun staying poor.’ Is that a threat or our new housing policy?', then: W('It’s bipartisan housing policy.') },
  { who: 'marcus', text: 'The chair recognizes our top donor in the unwashed hoodie.', cap: 'DIAMOND HOODIE', beat: 'gavel' },
  { who: 'ruiz', text: 'Define ‘decentralized’ in one word for the working families!', beat: 'paper', then: W('Bahamas.') },
  { who: 'page', text: 'Chairman, the witness just airdropped the Ethics Committee.', beat: 'summon', then: { who: 'marcus', text: 'Then this hearing is completely ethical.', gap: 1 } },
  { who: 'vance', text: 'For the record, both donor yachts are registered as non-profit churches.', beat: 'boat' },
  { who: 'bell', text: 'If I hit Ctrl-Alt-Delete on the Fed, does my pension go up?', beat: 'wallet', then: W('Only the defense budget.') },
  { who: 'howe', text: 'More subsidies for corn and missiles!', beat: 'wake' },
  { who: 'marcus', text: 'Let the record show we are outraged in public and vested in private.', cap: 'LET THE RECORD SHOW', beat: 'gavel' },
  { who: 'ruiz', text: 'Is this algorithm carbon-neutral, or do I have to tweet a frowny face from first class?', then: W('We planted three JPEGs of trees.') },
  { who: 'vance', text: 'My second bill bans retail from selling before Congress does. For their protection.', beat: 'bill' },
];

/** Said the moment an accepted exit is seen: the player's PUBLIC seat stands and leaves. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'marcus', text: 'The record will reflect a taxpayer just took profit before the Senate. Investigate them.', beat: 'gavel' };

/** What the room says after an exit, keyed to how far past the exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.4, { who: 'vance', text: 'The peasant sold early. More allocation for the Freedom Caucus.' }],
  [2, { who: 'ruiz', text: 'For the record, selling before the committee is deeply inequitable.', beat: 'paper' }],
  [3, { who: 'marcus', text: 'Let the record show paper hands do not get invited to Davos.', beat: 'gavel' }],
  [5, { who: 'bell', text: 'Did a regular citizen just leave with gains? Call the IRS.', beat: 'wallet' }],
  [10, { who: 'vance', text: 'We are replacing the public seat with a Raytheon lobbyist.' }],
];

/** The crash's lines, keyed to the crash clock; the ones that matter land inside the ending (ENDING_S). */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [0.9, { who: 'marcus', text: 'Let the record show we sold at the top and knew nothing.', life: 3.2 }],
  [2.3, { who: 'howe', text: 'Bail out the banks!', beat: 'wake', life: 2.6 }],
  [3.6, { who: 'page', text: 'Your Bahamas flight is boarding, sir.', life: 2.8 }],
  [5, { who: 'bell', text: 'Paul! Did our puts print?!', life: 3.4 }],
  [6.8, { who: 'marcus', text: 'This records-shredding session is adjourned. Blame retail.', life: 4 }],
  [9.6, { who: 'vance', text: 'Thoughts, prayers, and no refunds from the blind trust.', life: 4 }],
];

export const CAPTIONS = {
  waiting: 'THE COMMITTEE WILL RECONVENE',
  /** Shown on the accepted exit, then cycled every 2.4 s while the round keeps running without you. */
  exit: ['FRONT-RAN THE SENATE', 'SEE THE RECORD'],
  /** Once the multiplier is 1.5× past the exit: the hearing goes on without your seat. */
  kept: 'THE SWAMP CONTINUES. YOUR MINUTE STANDS.',
  /** The crash, cycled every 1.6 s while the aftermath holds. */
  crash: ['CONGRESS SOLD FIRST', 'THE RECORD IS SHREDDED', 'BIPARTISAN RUG', 'NO REFUNDS'],
  dodged: 'RUG DODGED — OUTSIDE THE SWAMP',
  watched: 'THE TAXPAYER WATCHED',
};
export const BADGE = 'FRONT-RAN CONGRESS · SEE THE RECORD';
export const STAMP = { rekt: 'STRUCK FROM THE RECORD', dodged: 'PARDONED', watched: 'OFF THE RECORD' } as const;
