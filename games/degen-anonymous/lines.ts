/**
 * The words of Degen Anonymous: the shares keyed to the displayed multiplier, the overtime round of the circle,
 * the asides after your share (the room does not notice you left), the crash's lines and the captions. Beats
 * (`beat`) stage a prop or a reaction when the line is actually said. Nothing here reads the outcome.
 */
import type { Line } from './script';

export type Who = 'terry' | 'jules' | 'ron' | 'nurse' | 'guitar' | 'podcast' | 'vegan' | 'stock' | 'you' | 'cookie' | 'twinA' | 'twinB';

export const TITLE = 'DEGEN ANONYMOUS';

/** The shares, keyed to the multiplier. Half of all rounds end before 2×, so the early ones come a few seconds apart. */
export const LADDER: Line[] = [
  { at: 1.03, who: 'terry', text: 'GM, degens. Welcome to our safe space for unsafe leverage.', cap: 'GM DEGENS' },
  { at: 1.15, who: 'jules', text: 'Hi, I’m Jules, 12 days clean. Deleted Phantom, blocked my congressman’s stock-tracker bot, and—wait, price alert.', cap: '12 DAYS CLEAN', beat: 'text' },
  { at: 1.35, who: 'ron', text: 'Deleting the app is performative, Jules. Your seed phrase is still tattooed on your inner thigh.', beat: 'nod' },
  { at: 1.55, who: 'nurse', text: 'Universal healthcare won’t fix my portfolio, but a 40× dog coin might.', cap: 'NUMBER GO UP', beat: 'laugh' },
  { at: 1.8, who: 'podcast', text: 'Recording this for my sigma-mindset podcast: “Trauma Bonding Curves.” Speak into the lapel mic, Jules.', beat: 'mic' },
  { at: 1.95, who: 'jules', text: 'It’s probably just an Amber Alert or an SEC filing.', thought: true, beat: 'glance' },
  { at: 2.1, who: 'stock', text: 'I blamed Obama in ’08, Trump in ’20, and Biden in ’22. Turns out I just love buying the top on 50× margin.', beat: 'still' },
  { at: 2.25, who: 'terry', text: '…We don’t judge political parties here, we judge entries.', gap: 1.6 },
  { at: 2.4, who: 'jules', text: 'I’m not trading! I’m just doing independent peer-reviewed chart research!', cap: 'DAY 0 AGAIN', beat: 'phone' },
  { at: 2.8, who: 'vegan', text: 'I’m an anti-capitalist vegan, these cookies are Costco butter-lard, and I’m on my fourth one because the chart is green.', beat: 'three' },
  { at: 3.2, who: 'guitar', text: 'Anyway, here’s “Wonderwall,” dedicated to the Federal Reserve.', beat: 'song' },
  { at: 3.8, who: 'jules', text: 'My therapist says I have anxious attachment to liquidity pools. Look at that candle!', cap: 'THE ROOM LEANS IN', beat: 'stand' },
  { at: 4.5, who: 'ron', text: 'Jules! Jerome Powell is not your higher power!', beat: 'tv' },
  { at: 5.5, who: 'twinA', text: 'We shorted the housing market.' },
  { at: 5.6, who: 'twinB', text: 'We manifested abundance.', gap: 0.9 },
  { at: 5.7, who: 'twinA', text: 'We now live in a Honda Civic.', gap: 0.9 },
  { at: 7, who: 'jules', text: 'I just market-bought with my student loan forgiveness.', beat: 'return', life: 4 },
  { at: 9, who: 'ron', text: 'Step One: admit the system is rigged. Step Two: try to front-run the system anyway.', cap: 'DIAMOND CHIPS', beat: 'thesis' },
  { at: 10.5, who: 'terry', text: 'Keep your hands in the circle and off the Robinhood options tab.' },
  { at: 12, who: 'nurse', text: 'Wait, is that the coin Pelosi’s nephew tweeted?!', beat: 'tvlook' },
  { at: 12.6, who: 'podcast', text: 'Use promo code RELAPSE for 20% off athletic greens!', gap: 1, beat: 'mic' },
  { at: 15, who: 'vegan', text: 'Cookie six. I have abandoned Marxism for generational wealth.' },
  { at: 18, who: 'cookie', text: 'I thought this was the HOA zoning meeting. How do I buy the dog money?' },
  { at: 21, who: 'ron', text: 'Meeting’s overtime. Even the church treasurer is aping in.' },
  { at: 25, who: 'jules', text: 'It’s a bipartisan rug pull and I’m leveraged to the tits!', cap: 'THIS IS FINE', beat: 'zero' },
];

/** Past the last share the circle goes round again: one of these every 1.35× of multiplier, in order, forever. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'terry', text: 'Okay, late-stage relapse check. Everybody state your pronouns and your liquidation price.', cap: 'SHARE AGAIN' },
  { who: 'ron', text: 'The meeting ended an hour ago. Late capitalism never ends.' },
  { who: 'podcast', text: 'We’re trending on X and Bluesky! Both sides hate us! Bullish!', cap: 'STILL WATCHING', beat: 'mic' },
  { who: 'nurse', text: 'Breathe in for four, hold for four, do not market-buy the top for four.' },
  { who: 'twinA', text: 'We refinanced the Honda Civic.' },
  { who: 'jules', text: 'I’m not dissociating, I’m locked in.', cap: 'THUMB ON THE BUTTON' },
  { who: 'vegan', text: 'Cookie nine. Dairy is a construct. Number go up is real.' },
  { who: 'guitar', text: 'This next song is called “Rich Dad, Poor Dad, Liquidated Dad.”', beat: 'song' },
  { who: 'stock', text: 'My financial advisor just walked in and grabbed a folding chair.' },
  { who: 'terry', text: 'Grant me the serenity to accept the dips I cannot buy.', cap: 'ONE DAY AT A TIME' },
  { who: 'cookie', text: 'I just put my reverse mortgage into the TV line. Did I win?' },
  { who: 'twinB', text: 'Generational trauma out, generational wealth in.' },
  { who: 'ron', text: 'Higher power check: still printing? Still printing.', cap: 'STILL UP' },
  { who: 'jules', text: 'Day zero feels incredible until the red candle.' },
];

/** Terry opens while bets are open: no announcement, straight to the room. */
export const BETTING_LINE: Omit<Line, 'at'> = { who: 'terry', text: 'Who gambled their rent while blaming the economy this week? … Everybody? Sit down.', cap: 'WHO RELAPSED THIS WEEK?' };

/** Your share: the player's chair speaks, in full. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'you', text: 'Hi. I’m a class traitor. I just cashed out in profit.', life: 4.6 };

export const CAPTIONS = {
  waiting: 'SETTING OUT THE CHAIRS',
  /** Shown on your share, then cycled every 2.4 s while the round keeps running without you. */
  exit: ['TOOK PROFITS', 'STAYED FOR THE COOKIES', 'SEE YOU THURSDAY'],
  /** Once the multiplier is 1.5× past your share. */
  kept: 'THE ROOM STILL STANDS. COOKIES STILL GOOD.',
  /** The crash, in step with its beats, every 1.5 s of the crash clock, cycling while the pile holds. */
  crash: ['BOUGHT THE TOP', 'HIGHER POWER, ONE TIME', 'GROUP HUG', 'DAY 0 AGAIN', 'NGMI'],
  dodged: 'RUG DODGED — CHAIR FOLDED, CUPPA IN HAND',
  watched: 'YOU JUST CAME FOR THE COOKIES',
};
export const BADGE = 'TOOK PROFITS · STAYED FOR THE COOKIES';

/** After your share the room carries on and does not notice: keyed to how far past the exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.4, { who: 'terry', text: 'Healthy boundary. Terrible chart discipline. Anyway — Jules.' }],
  [2, { who: 'stock', text: 'Imagine paying short-term capital gains tax. Couldn’t be me.' }],
  [3, { who: 'ron', text: 'Quitting while you’re ahead is a symptom of low conviction.' }],
  [5, { who: 'podcast', text: 'Clip that: beta male takes guaranteed profit instead of 100×.' }],
  [10, { who: 'cookie', text: 'He left his cookies. I’m redistributing them.' }],
];

/** The crash's lines, keyed to seconds of the crash clock, all said by the time the pile is whole. Jules says nothing. */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [0.7, { who: 'terry', text: 'Okay. Nobody blame the Fed. Everybody into the trauma pile.', life: 2.4 }],
  [2.0, { who: 'ron', text: 'Higher power, one bailout. Just one bailout.', life: 4.4 }],
  [3.4, { who: 'twinA', text: 'Bipartisan group hug.', life: 3 }],
  [4.5, { who: 'terry', text: 'Great progress today, everyone. Same time Thursday.', life: 6 }],
];

export const STAMP = { rekt: 'YOU’RE IN THE PILE', dodged: 'SEE YOU THURSDAY', watched: 'JUST HERE FOR THE COOKIES' };

/** The multipliers that ring a milestone chip, and at which Terry refills the cup. */
export const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];

/** Jules's nametag: 12 days, 3 days, then DAY 0, keyed to the multiplier so a late entry reads it right. */
export const nametagStage = (multiplier: number): number => (multiplier >= 2.4 ? 2 : multiplier >= 1.95 ? 1 : 0);
export const NAMETAGS = ['12 DAYS', '3 DAYS', 'DAY 0', 'DAY 0 AGAIN'];
