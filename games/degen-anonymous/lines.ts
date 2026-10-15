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
  { at: 1.03, who: 'terry', text: 'GM, degens. Let’s go round the circle.', cap: 'GM DEGENS' },
  { at: 1.15, who: 'jules', text: 'Hi, I’m Jules, I’ve been clean for 12 days. I deleted the app, I put the phone in the drawer, I — I’m getting a text.', cap: '12 DAYS CLEAN', beat: 'text' },
  { at: 1.35, who: 'ron', text: 'The drawer is not a plan, Jules. The drawer is where the plan goes to die.', beat: 'nod' },
  { at: 1.55, who: 'nurse', text: 'Mine went up 40% this week. My portfolio. No — sorry — my cholesterol.', cap: 'NUMBER GO UP', beat: 'laugh' },
  { at: 1.8, who: 'podcast', text: 'I’m doing an episode on this exact feeling. It’s called “Clean But Watching.” Nobody move, I’m getting a level.', beat: 'mic' },
  { at: 1.95, who: 'jules', text: 'It’s probably just the weather app.', thought: true, beat: 'glance' },
  { at: 2.1, who: 'stock', text: 'Sold the stock in 2009. You know the one. Been coming here since. Different thing. Anyway — new coin, same ticker.', beat: 'still' },
  { at: 2.25, who: 'terry', text: '…Thank you for sharing.', gap: 1.6 },
  { at: 2.4, who: 'jules', text: 'I’m not reading it. I’m holding it near my face.', cap: 'DAY 0 AGAIN', beat: 'phone' },
  { at: 2.8, who: 'vegan', text: 'I didn’t come here to talk about coins, I came for the cookies. These are not vegan cookies. I’m having three.', beat: 'three' },
  { at: 3.2, who: 'guitar', text: 'This one’s called “Number Go Up.” It’s about my ex-wife.', beat: 'song' },
  { at: 3.8, who: 'jules', text: 'My sponsor says a relapse is a lie you tell yourself. So — I’m not telling you anything. I’m just checking on something.', cap: 'THE ROOM LEANS IN', beat: 'stand' },
  { at: 4.5, who: 'ron', text: 'Jules. JULES. The chart is not your higher power.', beat: 'tv' },
  { at: 5.5, who: 'twinA', text: 'We did a group buy.' },
  { at: 5.6, who: 'twinB', text: 'We did a group hug.', gap: 0.9 },
  { at: 5.7, who: 'twinA', text: 'We did both.', gap: 0.9 },
  { at: 7, who: 'jules', text: 'I opened the exchange.', beat: 'return', life: 4 },
  { at: 9, who: 'ron', text: 'We are not powerless. We are UNpowerful. There is a difference, and the difference is the chart.', cap: 'DIAMOND CHIPS', beat: 'thesis' },
  { at: 10.5, who: 'terry', text: 'Nobody’s holding hands yet. But keep your hands where I can hold them.' },
  { at: 12, who: 'nurse', text: 'That’s my entry.', beat: 'tvlook' },
  { at: 12.6, who: 'podcast', text: 'That’s everyone’s entry.', gap: 1, beat: 'mic' },
  { at: 15, who: 'vegan', text: 'I’m on cookie six. Nobody’s counting. I’m counting.' },
  { at: 18, who: 'cookie', text: 'I don’t know what anyone is talking about. These are excellent cookies. What is an entry?' },
  { at: 21, who: 'ron', text: 'Watch says we’re over time. The watch is also up 30%.' },
  { at: 25, who: 'jules', text: 'It’s going to zero and I think I’m in early.', cap: 'THIS IS FINE', beat: 'zero' },
];

/** Past the last share the circle goes round again: one of these every 1.35× of multiplier, in order, forever. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'terry', text: 'Okay. Let’s go round again. Everyone’s shared. Share again.', cap: 'SHARE AGAIN' },
  { who: 'ron', text: 'Meeting was meant to end an hour ago. The chart doesn’t end. That’s the whole problem.' },
  { who: 'podcast', text: 'We’re live. We’ve always been live. Episode four hundred: “Still Watching.”', cap: 'STILL WATCHING', beat: 'mic' },
  { who: 'nurse', text: 'Everybody breathe. In for four, out for four. Don’t look at the TV for four.' },
  { who: 'twinA', text: 'We bought more. We hugged more.' },
  { who: 'jules', text: 'I’m not checking it. My thumb is checking it.', cap: 'THUMB ON THE BUTTON' },
  { who: 'vegan', text: 'Cookie nine. Still not vegan. I’ve made my peace with it.' },
  { who: 'guitar', text: 'New song. It’s called “Higher.” Same three chords.', beat: 'song' },
  { who: 'stock', text: 'I sold this one too. In my head. Twice.' },
  { who: 'terry', text: 'One day at a time. Today is going really, really fast.', cap: 'ONE DAY AT A TIME' },
  { who: 'cookie', text: 'Can someone tell the TV the meeting’s over here?' },
  { who: 'twinB', text: 'Same chart. Same chairs. Same us.' },
  { who: 'ron', text: 'Higher power, check-in. Still up? Still up.', cap: 'STILL UP' },
  { who: 'jules', text: 'Day zero is a long day.' },
];

/** Terry opens while bets are open: no announcement, straight to the room. */
export const BETTING_LINE: Omit<Line, 'at'> = { who: 'terry', text: 'Who relapsed this week? … Nobody? Great meeting, see you Thursday.', cap: 'WHO RELAPSED THIS WEEK?' };

/** Your share: the player's chair speaks, in full. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'you', text: 'Hi. I’m the reason we’re all here. I took profits.', life: 4.6 };

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
  [1.4, { who: 'terry', text: 'Lovely share. Who was that? Anyway — Jules.' }],
  [2, { who: 'stock', text: 'Somebody sold. I know that feeling. Different thing.' }],
  [3, { who: 'ron', text: 'Count the chairs. Ten. Eleven. We’ll count again Thursday.' }],
  [5, { who: 'podcast', text: 'Note for the episode: someone left with profits AND a chair.' }],
  [10, { who: 'cookie', text: 'More cookies for the room. That’s the only chart I read.' }],
];

/** The crash's lines, keyed to seconds of the crash clock, all said by the time the pile is whole. Jules says nothing. */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [0.7, { who: 'terry', text: 'Okay. Okay. Everybody stay seated.', life: 2.4 }],
  [2.0, { who: 'ron', text: 'Higher power, one time. One time.', life: 4.4 }],
  [3.4, { who: 'twinA', text: 'Group hug.', life: 3 }],
  [4.5, { who: 'terry', text: 'Great meeting, everyone. See you Thursday.', life: 6 }],
];

export const STAMP = { rekt: 'YOU’RE IN THE PILE', dodged: 'SEE YOU THURSDAY', watched: 'JUST HERE FOR THE COOKIES' };

/** The multipliers that ring a milestone chip, and at which Terry refills the cup. */
export const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];

/** Jules's nametag: 12 days, 3 days, then DAY 0, keyed to the multiplier so a late entry reads it right. */
export const nametagStage = (multiplier: number): number => (multiplier >= 2.4 ? 2 : multiplier >= 1.95 ? 1 : 0);
export const NAMETAGS = ['12 DAYS', '3 DAYS', 'DAY 0', 'DAY 0 AGAIN'];
