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
  { who: 'marcus', text: 'This hearing is called to order. The committee will hear testimony on… the coin. Which is. Which one is it?', cap: 'GM COMMITTEE', beat: 'gavel' },
  { who: 'page', text: 'The coin.', gap: 2.6, beat: 'card' },
];

const W = (text: string, gap = 1.1, cap?: string): Omit<Line, 'at'> => ({ who: 'witness', text, gap, ...(cap ? { cap } : {}) });

/** The ladder, keyed to the displayed multiplier. `cap` walks the caption ladder as each line is said. */
export const LADDER: Line[] = [
  { at: 1.15, who: 'vance', text: 'So the money is in the computer. Whose computer?', cap: 'SO THE MONEY IS IN THE COMPUTER' },
  { at: 1.15, ...W('Chairman, I appreciate the question, and the short answer is yes.') },
  { at: 1.35, who: 'ruiz', text: 'I’ve read the white paper. Page nine. Where is the page nine of this hearing?', cap: 'NUMBER GO UP', beat: 'paper' },
  { at: 1.35, ...W('The white paper has been amended in spirit.') },
  { at: 1.55, who: 'bell', text: 'My constituents keep sending me this wallet — a hardware wallet, it sounds like a — what is it, a drive? — is my money in it?', beat: 'wallet' },
  { at: 1.55, ...W('No.', 1.4) },
  { at: 1.8, who: 'marcus', text: 'Let the record show the witness said no.', cap: 'IN THE RECORD', beat: 'gavel' },
  { at: 2.1, who: 'vance', text: 'I’m going to ask the hard question. The supply is fixed at 21 million. Who sets the inflation?' },
  { at: 2.1, ...W('The market.') },
  { at: 2.1, who: 'vance', text: 'I see. And who sets the market?', gap: 0.9 },
  { at: 2.1, ...W('The market.') },
  { at: 2.4, who: 'ruiz', text: 'For the record, this is the same technology as the internet, which I also use.', beat: 'paper' },
  { at: 2.8, who: 'howe', text: 'Objection. Whatever we’re doing, my state has a refinery.', beat: 'wake' },
  { at: 3.2, who: 'bell', text: 'The hoodie. Is the hoodie a uniform of any organization?' },
  { at: 3.2, ...W('It is not.') },
  { at: 3.2, who: 'marcus', text: 'Let the record show the hoodie is not a uniform.', cap: 'DIAMOND HOODIE', beat: 'gavel', gap: 0.9 },
  { at: 3.8, who: 'vance', text: 'My subcommittee on financial literacy has drafted a bill. I have it here. It is one sentence. ‘Give me some.’', beat: 'bill' },
  { at: 4.5, who: 'marcus', text: 'We’re going around the room, one line each, for what the members are calling ‘a position.’', life: 3 },
  { at: 4.5, who: 'marcus', text: 'In.', gap: 0.5, beat: 'hand' },
  { at: 4.5, who: 'vance', text: 'In.', gap: 0.55, beat: 'hand' },
  { at: 4.5, who: 'ruiz', text: 'In.', gap: 0.55, beat: 'hand' },
  { at: 4.5, who: 'howe', text: 'Refinery.', gap: 0.6, beat: 'wake' },
  { at: 4.5, who: 'bell', text: 'In.', gap: 0.6, beat: 'hand' },
  { at: 5.5, who: 'ruiz', text: 'Directly, then. Is the coin a security?', beat: 'paper' },
  { at: 5.5, ...W('The coin is a coin.') },
  { at: 5.5, who: 'marcus', text: 'Let the record show the coin is a coin.', cap: 'LET THE RECORD SHOW', beat: 'gavel', gap: 0.9 },
  { at: 7, who: 'bell', text: 'One more from me. The wallet I bought — the hardware one — does it also do the phones?', beat: 'wallet' },
  { at: 7, ...W('No.', 1.4) },
  { at: 9, who: 'vance', text: 'My subcommittee will be accepting a limited number of new investors. This is not an offer of securities. This is a boat.', beat: 'boat' },
  { at: 12, who: 'marcus', text: 'What time is the next hearing?', beat: 'summon' },
  { at: 12, who: 'page', text: 'There is no next hearing, Chairman.', gap: 1.6 },
  { at: 12, who: 'marcus', text: 'Schedule one.', gap: 0.9, beat: 'gavel' },
  { at: 18, who: 'marcus', text: 'Does the witness have anything to add?' },
  { at: 18, ...W('The coin is gone, Chairman. It left this morning.', 1.2, 'THIS IS FINE') },
  { at: 18, who: 'marcus', text: 'Let the record show —', gap: 0.8, life: 2.8 },
  { at: 25, who: 'marcus', text: 'The committee will hear one more question, and then the coin will be in contempt.', beat: 'gavel' },
];

/**
 * Past the last rung, one of these comes due every 1.35× of multiplier, in order, forever; `then` is the reply,
 * said a beat after the question.
 */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'bell', text: 'Follow-up. Is the blockchain the one with the chain, or the one with the block?', then: W('Yes.', 1.3) },
  { who: 'vance', text: 'Hypothetically, if a senator owned a boat, would the coin also own the boat?', then: W('Hypothetically, the boat owns the senator.') },
  { who: 'marcus', text: 'Let the record show the record is now longer than the coin.', cap: 'IN THE RECORD', beat: 'gavel' },
  { who: 'ruiz', text: 'Page ten of the white paper is blank. I have read it twice.', beat: 'paper', then: W('That is page ten working as intended.') },
  { who: 'howe', text: 'Objection.', beat: 'wake', then: { who: 'marcus', text: 'Sustained. Go back to sleep, Senator.', gap: 1 } },
  { who: 'vance', text: 'Can my subcommittee buy the dip? Asking for the family office.', then: W('Chairman, the dip is not available for comment.') },
  { who: 'bell', text: 'My grandson says ‘have fun staying poor.’ Is that testimony?', then: W('It is a position.') },
  { who: 'marcus', text: 'The chair recognizes the gentleman in the hoodie. Again. Still.', cap: 'DIAMOND HOODIE', beat: 'gavel' },
  { who: 'ruiz', text: 'Will the witness define ‘decentralized’ in one word?', beat: 'paper', then: W('Elsewhere.') },
  { who: 'page', text: 'Chairman, the card is out of room.', beat: 'summon', then: { who: 'marcus', text: 'Get a longer card.', gap: 1 } },
  { who: 'vance', text: 'For the record, both boats are in a blind trust. The trust is also a boat.', beat: 'boat' },
  { who: 'bell', text: 'If I unplug the wallet, does the money fall out?', beat: 'wallet', then: W('Only in spirit.') },
  { who: 'howe', text: 'Refinery.', beat: 'wake' },
  { who: 'marcus', text: 'Let the record show — somebody tell me what the record shows.', cap: 'LET THE RECORD SHOW', beat: 'gavel' },
  { who: 'ruiz', text: 'Is the witness aware this hearing is being livestreamed? Vertically?', then: W('The witness is aware of everything vertically.') },
  { who: 'vance', text: 'My subcommittee has a second bill. It is the same sentence, louder.', beat: 'bill' },
];

/** Said the moment an accepted exit is seen: the player's PUBLIC seat stands and leaves. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'marcus', text: 'The record will reflect one member of the public had somewhere to be.', beat: 'gavel' };

/** What the room says after an exit, keyed to how far past the exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.4, { who: 'vance', text: 'More room for investors in the public seat.' }],
  [2, { who: 'ruiz', text: 'For the record, the public seat is still warm. I checked.', beat: 'paper' }],
  [3, { who: 'marcus', text: 'Let the record show the empty seat has abstained.', beat: 'gavel' }],
  [5, { who: 'bell', text: 'Did the public take the money with them? Is that allowed?', beat: 'wallet' }],
  [10, { who: 'vance', text: 'My subcommittee is naming that seat after the family office.' }],
];

/** The crash's lines, keyed to the crash clock; the ones that matter land inside the ending (ENDING_S). */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [0.9, { who: 'marcus', text: 'Let the record show the record is gone.', life: 3.2 }],
  [2.3, { who: 'howe', text: 'Objection.', beat: 'wake', life: 2.6 }],
  [3.6, { who: 'page', text: 'A card for the witness.', life: 2.8 }],
  [5, { who: 'bell', text: 'Is my money in the hoodie?', life: 3.4 }],
  [6.8, { who: 'marcus', text: 'We are adjourned. Somebody find the record.', life: 4 }],
  [9.6, { who: 'vance', text: 'Both boats are fine. The boats are in a trust.', life: 4 }],
];

export const CAPTIONS = {
  waiting: 'THE COMMITTEE WILL RECONVENE',
  /** Shown on the accepted exit, then cycled every 2.4 s while the round keeps running without you. */
  exit: ['TAKEN AT MY MINUTE', 'SEE THE RECORD'],
  /** Once the multiplier is 1.5× past the exit: the hearing goes on without your seat. */
  kept: 'THE RECORD CONTINUES. YOUR MINUTE STANDS.',
  /** The crash, cycled every 1.6 s while the aftermath holds. */
  crash: ['DEV SOLD', 'THE RECORD IS GONE', 'CONTEMPT', 'NGMI'],
  dodged: 'RUG DODGED — OUTSIDE THE RECORD',
  watched: 'THE PUBLIC WATCHED',
};
export const BADGE = 'TAKEN AT MY MINUTE · SEE THE RECORD';
export const STAMP = { rekt: 'STRUCK FROM THE RECORD', dodged: 'EXCUSED', watched: 'OFF THE RECORD' } as const;
