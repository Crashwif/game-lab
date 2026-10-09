/**
 * The words of The Wake: the Crypto Celebrant's eulogy keyed to the displayed multiplier, the family's
 * interjections queued between his lines, the overtime cycle for long rounds, the regret lines after the
 * cousin slips out, the crash's one spoken line, the captions and the outcome stamps. Data only: nothing
 * here reads or changes the round's outcome.
 */
import type { Line } from './script';

export const TITLE = 'THE WAKE';

/**
 * The eulogy. `cap` walks the caption ladder as the lines are actually said; `beat` stages a prop on the set
 * when the line is said (the scene also settles every beat from the multiplier on a late entry).
 */
export const LADDER: Line[] = [
  { at: 1.02, who: 'celebrant', text: 'Let us begin. Phones on silent. Charts face down, please.', cap: 'GM GRIEF' },
  { at: 1.12, who: 'mother', text: 'Lilies. Of course it’s lilies.', gap: 1.1 },
  {
    at: 1.3,
    who: 'celebrant',
    text: 'Gerald believed. When it went down, he called it a discount. When it went up, validation. When it did nothing for nine months: patience.',
    cap: 'NEVER SOLD A DAY IN HIS LIFE',
  },
  { at: 1.42, who: 'son', text: 'Dad said no open casket. He said show the bags.', gap: 1.4, beat: 'overlay' },
  { at: 1.7, who: 'celebrant', text: 'He is survived by his wife, his dog, and 4.2 billion $BAGS, in a locked wallet whose password died with him.', cap: 'NUMBER GO UP' },
  { at: 1.86, who: 'mother', text: 'He was a good boy.', gap: 1.2, beat: 'dab' },
  { at: 2.1, who: 'celebrant', text: 'He asked that, in lieu of flowers, you airdrop something to the memorial wallet.', beat: 'airdrop' },
  { at: 2.3, who: 'friend', text: 'I’ll call you back.', gap: 1, beat: 'call' },
  { at: 2.6, who: 'celebrant', text: 'His last words, typed at 3:51 am, were: “This is a dip. A dip to the underworld, but a dip.”', cap: 'HE’S EARLY' },
  { at: 2.85, who: 'son', text: 'Chart’s still up. He would be so annoying about this.', gap: 1.2 },
  { at: 3.2, who: 'celebrant', text: 'He wrote his own eulogy. One page. Three hundred words. Two hundred and ninety of them are “average in”.', cap: 'DIAMOND HANDS, BOXING GLOVES' },
  { at: 3.5, who: 'mother', text: 'Tulips would have been nicer. Tulips also crash.', gap: 1.2 },
  { at: 3.8, who: 'celebrant', text: 'This service is paid for by the community wallet. So were the flowers, the microphone, and me. We are all liquidity now.' },
  { at: 4.3, who: 'friend', text: 'No, I’m at a thing. Yes, still out. Since 1.4.', gap: 1.2, beat: 'call' },
  { at: 5, who: 'celebrant', text: 'Some men leave a house. Some leave a car. Gerald leaves a chart, and on it a message for the generations: he never sold.' },
  { at: 6.2, who: 'son', text: 'Overlay says he’s up. He’s still dead, though.', gap: 1.2 },
  { at: 8, who: 'celebrant', text: 'We do not say “lost”. We say “early”. Gerald was early for everything, and this funeral is also early —', cap: 'WEN RESURRECTION' },
  { at: 10, who: 'mother', text: 'I signed the guest book twice. For the average.', gap: 1.2 },
  { at: 12, who: 'celebrant', text: '— the hearse has been repossessed. We will carry him to the grave ourselves, in shifts, like holders.', cap: 'THIS IS FINE', beat: 'repo' },
  { at: 15, who: 'friend', text: 'Tell them I’m doing the closing. Yes. The eulogy closing.', gap: 1.2, beat: 'call' },
  { at: 20, who: 'celebrant', text: 'His candle burns eternal. Not the votive: the one on the chart behind me, which the gravediggers are also checking.', cap: 'CANDLE STILL BURNING', beat: 'diggers' },
  { at: 28, who: 'son', text: 'Can we bury the phone with him? It’s still pumping.', gap: 1.2 },
  { at: 40, who: 'celebrant', text: 'Dearly beloved, we are gathered today inside Gerald’s average entry, and it is beautiful.', cap: 'INSIDE HIS AVERAGE ENTRY' },
  { at: 60, who: 'mother', text: 'I said tulips. Nobody listens.', gap: 1.2 },
  { at: 100, who: 'celebrant', text: 'Gerald did not die. He rotated into a better chain.', cap: 'ROTATED INTO A BETTER CHAIN' },
];

/** Past 100×, one of these comes due every 1.35× of multiplier, in order, for as long as the round runs. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'celebrant', text: 'He is simply staked now, for an indefinite lock-up period.', cap: 'STAKED INDEFINITELY' },
  { who: 'son', text: 'Overlay says Dad’s up another thirty percent. Still dead.' },
  { who: 'celebrant', text: 'Let us bow our heads, and check our phones.', cap: 'HEADS BOWED, PHONES OUT' },
  { who: 'friend', text: 'In closing: Gerald, I sold at 1.4. For both of us.', beat: 'call' },
  { who: 'celebrant', text: 'The gravediggers have stopped digging. They are holding.', cap: 'THE GRAVEDIGGERS ARE HOLDING' },
  { who: 'mother', text: 'Tulips. I said tulips.' },
  { who: 'celebrant', text: 'We will now observe a moment of volatility.', cap: 'A MOMENT OF VOLATILITY' },
  { who: 'celebrant', text: 'His average entry is now visible from space.', cap: 'VISIBLE FROM SPACE' },
  { who: 'son', text: 'Battery’s at one percent. It refuses to die. Like Dad’s bags.' },
  { who: 'celebrant', text: 'The eulogy will continue until morale improves, or the chart doesn’t.', cap: 'THE EULOGY CONTINUES' },
  { who: 'friend', text: 'No. Still out. I’ll call you back.', beat: 'call' },
  { who: 'celebrant', text: 'He is survived by the chart. The chart is doing great.', cap: 'SURVIVED BY THE CHART' },
];

/** The opening of the service, said while seats are still being taken. */
export const BETTING_LINE: Omit<Line, 'at'> = {
  who: 'celebrant',
  text: 'We are gathered here today because Gerald refused to take profits. In life, and now in portfolio.',
  cap: 'PLEASE BE SEATED',
};

export const CAPTIONS = {
  waiting: 'VISITATION AT 4:30',
  /** Shown on the accepted exit, then cycled every 2.4 s while the round keeps running without you. */
  exit: ['SOLD BEFORE THE SERVICE', 'LEFT AT THE EULOGY', 'TOUCHED GRASS AT A FUNERAL'],
  /** Once the multiplier is 1.5× past the exit: the wake goes on without the cousin. */
  kept: 'THE WAKE GOES ON. HE RESTS. YOU EAT.',
  /** The crash, cycled every 1.6 s while the aftermath holds. */
  crash: ['DEV SOLD', 'FULL PORTFOLIO', 'OPEN CASKET, CLOSED BAGS', 'NGMI', 'HE RESTS'],
  dodged: 'RUG DODGED — CANDLE STILL WARM',
  watched: 'YOU PAID YOUR RESPECTS',
};

/** The badge on an accepted exit. */
export const BADGE = 'SOLD BEFORE THE SERVICE';

/** Said after the cousin slips out, keyed to how far past the exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.5, { who: 'mother', text: 'Was that the cousin? With the candle?' }],
  [2, { who: 'celebrant', text: 'Some of us took profits during the eulogy. Gerald forgives you. His chart does not.' }],
  [3, { who: 'son', text: 'Cousin’s rideshare is up more than Dad.' }],
  [5, { who: 'friend', text: 'Smart kid. I’ll call him back.', beat: 'call' }],
  [10, { who: 'celebrant', text: 'The empty spot at the back has outperformed the deceased.' }],
];

/** The cousin's whisper on the way out. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'cousin', text: 'sorry. my ride’s here.', thought: true };

/** The crash's spoken line, keyed to seconds of the crash clock: the widow, seated at the foot of the casket. */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [[3.0, { who: 'widow', text: 'I told him about the mortgage.', life: 600 }]];

export const STAMP = { rekt: 'BURIED WITH THE BAGS', dodged: 'LEFT WITH THE CANDLE', watched: 'JUST PAYING RESPECTS' };

/** The multipliers that toll the milestone bell. */
export const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];
