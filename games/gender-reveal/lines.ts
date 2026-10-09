/**
 * The words of Gender Reveal: the programme (the dialogue ladder keyed to the displayed multiplier), the
 * overtime cycle for long rounds, the regret lines after the plus-one leaves, the crash's lines, the captions,
 * the stamps and the palette. `beat` tags stage a prop beat on the set when the line is actually said; BEATS
 * gives each tag the multiplier it belongs to, so a late entry can rebuild the yard from the multiplier alone.
 * Presentation only: nothing here reads or changes the round's outcome.
 */
import type { Line } from './script';

export const TITLE = 'GENDER REVEAL';

/** Who speaks, and the name under their bubble. */
export const NAMES: Record<string, string> = {
  sheila: 'Sheila, event lead',
  tanner: 'Tanner',
  destiny: 'Destiny',
  hal: 'Grandpa Hal',
  kyle: 'Kyle (scrubs)',
  pauline: 'Grandma Pauline',
  bev: 'Grandma Bev',
  dale: 'Uncle Dale',
  carol: 'AUNT CAROL',
  brad: 'COUSIN BRAD',
  worker: 'Worker 2',
  crowd: 'the folding chairs',
  you: 'your plus-one',
};

/** The prop beats and the multiplier each belongs to (a late entry settles every beat at or below the multiplier). */
export const BEATS = {
  mic: 1.2,
  key: 1.5,
  cake: 1.8,
  kyle: 2.2,
  tick: 2.7,
  grandmas: 3.3,
  focus: 4,
  phone: 5,
  latch: 5.3,
  live: 8,
  dale: 13,
  asleep: 13.3,
  spill: 25,
  levitate: 60,
  hazmat: 62,
  sky: 130,
} as const;

/** The programme, keyed to the displayed multiplier. `cap` walks the caption ladder as lines are said. */
export const LADDER: Line[] = [
  { at: 1.0, who: 'sheila', text: 'Programme item one: welcome, guests. GM. Phones stay AWAY.', cap: 'GM GUESTS' },
  { at: 1.2, who: 'tanner', text: 'Is it on? Okay. We are so blessed. We are SO blessed.', cap: 'BOY OR GIRL', beat: 'mic' },
  { at: 1.3, who: 'destiny', text: 'smile. he has the mic. smile.', thought: true, gap: 0.9 },
  { at: 1.5, who: 'sheila', text: 'Grandpa Hal will hold the box key. For the honor.', beat: 'key' },
  { at: 1.56, who: 'hal', text: "I'm keeping it. I've seen combat. Parking-lot combat.", gap: 1.1 },
  { at: 1.8, who: 'destiny', text: 'Mom. The cake is… separating.', cap: 'NUMBER GO UP', beat: 'cake' },
  { at: 1.9, who: 'sheila', text: 'The frosting is NEUTRAL. I signed off on neutral.' },
  { at: 2.2, who: 'kyle', text: "Traction's looking great, babes.", cap: "IT'S LOADING", beat: 'kyle' },
  { at: 2.25, who: 'destiny', text: 'Did you invite the scrubs guy?', gap: 0.8 },
  { at: 2.3, who: 'tanner', text: "We don't know him, he came with the bounce house.", gap: 1.0 },
  { at: 2.4, who: 'carol', text: '???' },
  { at: 2.45, who: 'brad', text: 'loaded.' },
  { at: 2.7, who: 'sheila', text: 'Whose piñata is that? WHOSE PIÑATA IS THAT.', beat: 'tick' },
  { at: 2.85, who: 'crowd', text: '…not ours.', thought: true, gap: 1.2 },
  { at: 3.0, who: 'carol', text: 'why is there a chart on the garage' },
  { at: 3.3, who: 'pauline', text: 'That is my piece.', beat: 'grandmas' },
  { at: 3.36, who: 'bev', text: 'That is MY piece.', gap: 0.5 },
  { at: 4.0, who: 'sheila', text: 'Note: the chart is now bigger than the banner. EITHER WAY is unpinnable.', beat: 'focus' },
  { at: 4.5, who: 'destiny', text: 'Babe. Your eyes are on the garage.' },
  { at: 5.0, who: 'tanner', text: 'My boss. Declined. Today we are diamond hands, babe.', cap: 'DIAMOND DIAPER', beat: 'phone' },
  { at: 5.3, who: 'sheila', text: '…The latch is warm. Why is the latch warm.', beat: 'latch' },
  { at: 6.4, who: 'brad', text: 'aped the reveal. no take-backs' },
  { at: 8.0, who: 'kyle', text: "We're live in five. Keep the confetti warm.", cap: 'WEN BIRTH', beat: 'live' },
  { at: 8.4, who: 'worker', text: 'Copy that. Confetti warm.' },
  { at: 10, who: 'tanner', text: 'Babe, why is the scrubs guy on a headset?' },
  { at: 13, who: 'dale', text: "IT'S A DOG. IT'S ALWAYS A DOG.", beat: 'dale' },
  { at: 13.3, who: 'hal', text: 'zzz… key… mine… zzz', thought: true, beat: 'asleep' },
  { at: 17, who: 'sheila', text: 'The piñata is ticking in morse. Who taught the piñata morse.' },
  { at: 25, who: 'destiny', text: 'My water!', beat: 'spill' },
  { at: 25.4, who: 'crowd', text: '*GASP*', gap: 0.3 },
  { at: 35, who: 'kyle', text: 'Worker 2, positions. Fog on my mark.' },
  { at: 60, who: 'sheila', text: 'The box is levitating. That is not a party effect.', cap: 'THIS IS FINE', beat: 'levitate' },
  { at: 62, who: 'worker', text: "Extinguisher's for the vibes, ma'am.", beat: 'hazmat' },
  { at: 130, who: 'sheila', text: 'Update: the reveal has been moved up due to atmospheric conditions.', beat: 'sky' },
];

/** Past the last rung, one of these comes due every 1.35× of multiplier, in order, forever. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'kyle', text: "Liquidity's warm. Confetti's warmer." },
  { who: 'sheila', text: 'Programme item forty-one: we hold. We ALL hold.', cap: 'HOLD THE CAKE' },
  { who: 'carol', text: '?????' },
  { who: 'tanner', text: 'We are so blessed. I keep saying it. It keeps being true.' },
  { who: 'pauline', text: 'I can wait.' },
  { who: 'bev', text: 'I can wait longer.', gap: 0.5 },
  { who: 'brad', text: 'still loaded. reloading.' },
  { who: 'dale', text: 'STILL A DOG.', cap: 'STILL NEUTRAL' },
  { who: 'destiny', text: 'Babe. Look at me. Not at the garage.' },
  { who: 'sheila', text: 'If this leaks now I will end the extended family too.', cap: 'PHONES AWAY' },
  { who: 'hal', text: 'zzz… parking lot… never again… zzz', thought: true },
  { who: 'kyle', text: 'Worker 2, hold the fog. Hold it.' },
  { who: 'worker', text: 'Holding.' },
  { who: 'tanner', text: 'Boss again. Declined. Declined. Declined.', cap: 'WEN REVEAL' },
  { who: 'destiny', text: 'What exactly is he a doctor of?' },
  { who: 'sheila', text: 'Attendance remains perfect. Nobody leaves before the reveal.', cap: 'NOBODY LEAVES' },
];

/** Said while bets are open. */
export const BETTING_LINE: Omit<Line, 'at'> = { who: 'sheila', text: 'Phones away. Phones AWAY. If it leaks before the reveal, I will end this family.', cap: 'PHONES AWAY' };

/** The plus-one's line on the accepted exit: a thought, never said out loud. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'you', text: 'last slice. napkin. gate.', thought: true };

export const CAPTIONS = {
  waiting: 'SETTING UP THE CHAIRS',
  /** Shown on the accepted exit, then cycled every 2.4 s while the round keeps running without you. */
  exit: ['CAKE SECURED', 'LEFT BEFORE THE REVEAL', 'SMUG AND FED'],
  /** Once the multiplier is 1.5× past the exit: the party goes on without the plus-one. */
  kept: 'YOU MISSED EVERYTHING. CAKE WAS GOOD THOUGH.',
  /** The crash, cycled every 1.6 s while the aftermath holds. */
  crash: ["IT'S A DOG", '$BABY RUGGED', 'RECEIPTS FOR EVERYONE', 'NGMI'],
  dodged: 'RUG DODGED — GATE CLOSED BEHIND YOU',
  watched: 'YOU WATCHED THE REVEAL',
};

/** What the party says about the empty chair, keyed to how far past the exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.5, { who: 'sheila', text: 'Attendance: pending. Who took the last slice?' }],
  [2, { who: 'carol', text: 'did someone just leave with CAKE' }],
  [3, { who: 'tanner', text: 'Whose plus-one was that? Babe. Whose plus-one?' }],
  [5, { who: 'destiny', text: 'We should have left with the cake.' }],
  [10, { who: 'sheila', text: 'Strike the plus-one from the group chat.' }],
];

/**
 * The crash's choreography on the crash clock (seconds, after the hit-stop): the latch, the piñata, the cake, the
 * banner, Kyle over the fence, Hal's flask, the receipt, the look, the blessing, the flatline, the stock photo.
 * Beats one to four land inside two seconds and every beat by five; the scene plays the rest out over the start of
 * the next betting window if the crashed phase is shorter than that.
 */
export const AT = { pinata: 0.5, halWake: 0.6, kyle: 0.8, kyleFor: 1.3, cake: 0.85, cakeFor: 0.75, banner: 1.15, flask: 1.5, flaskOpen: 2.0, sip: 2.5, receipt: 2.2, look: 2.9, stool: 3.3, blessed: 3.8, flat: 4.1, photo: 4.5 } as const;
/** The final image is complete by this many seconds of crash: the stock photo has faded in (AT.photo + 0.5, plus the hit-stop's lag). */
export const ENDING_S = 5.5;

/** The crash's lines, keyed to seconds of crashAge; who is on the set decides some of them. */
export function crashLines(multiplier: number, hadKey: boolean): [at: number, line: Omit<Line, 'at'>][] {
  const lines: [number, Omit<Line, 'at'>][] = [[0.5, { who: 'sheila', text: "IT'S A— …it's a phone?" }]];
  if (multiplier >= BEATS.dale) lines.push([1.3, { who: 'dale', text: 'DOG. CALLED IT. ALWAYS A DOG.' }]);
  lines.push(
    [1.8, { who: 'kyle', text: 'Thanks for the liquidity, babes!' }],
    [2.5, { who: 'hal', text: hadKey ? 'Finally. The key fits something.' : "What'd I miss? Is it a boy?" }],
    [3.0, { who: 'destiny', text: "It's itemized. The receipt is itemized." }],
    [4.2, { who: 'tanner', text: 'We are so blessed.' }],
    [4.8, { who: 'sheila', text: 'Programme complete. Please take a receipt on your way out.' }],
  );
  return lines;
}

export const STAMP = { rekt: "IT'S A RUG", dodged: 'FED AND GONE', watched: 'NO CREDITS REVEALED' };

export const COLOURS = { text: '#fff7fb', accent: '#f7a8c8', bad: '#ff4d6d', good: '#7cf67c', gold: '#ffe08a' };

/** The multipliers that ring a milestone horn (the shared helper detunes them as they climb). */
export const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];

/** The family group chat: who posts, and what they post as the round gets older and stranger. */
export const CHAT_SENDERS = ['AUNT CAROL', 'COUSIN BRAD', 'NANA JUNE', 'MOM', 'UNCLE DALE', 'JEN (COLLEGE)', 'GRANDMA BEV', 'TANNER’S BOSS'];
export const CHAT_STAGES: { from: number; texts: string[] }[] = [
  { from: 1, texts: ['so excited!!', 'omg today!!', 'pink or blue??', 'team pink', 'team blue', 'so excited', 'running late, save cake', 'is there parking'] },
  { from: 1.7, texts: ['wait', 'wait what', 'is that a chart', 'why is the cake doing that', 'wait.', 'who is scrubs'] },
  { from: 2.6, texts: ['sheila what is this', 'sheila???', 'is the piñata ticking', 'what is a dev', 'sheila what is this', 'loaded.'] },
  { from: 5, texts: ['?', '??', '?', '???', '? ×47', '?', 'sheila', '?'] },
  { from: 40, texts: ['?', '?', '?', '? ×47', '? ×470', '?', 'is the sky ok', '?'] },
];
