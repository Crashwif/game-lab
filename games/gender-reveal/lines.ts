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
  { at: 1.0, who: 'sheila', text: 'Programme item one: welcome, guests. Sign the NDA and scan the QR code for the baby’s presale.', cap: 'GM GUESTS' },
  { at: 1.2, who: 'tanner', text: 'Testing, testing. We are so blessed, y’all. Use code BLESSED for 10% off the ultrasound NFT.', cap: 'BOY OR GIRL', beat: 'mic' },
  { at: 1.3, who: 'destiny', text: 'smile for the brand deal. do not cry on the patrocinado.', thought: true, gap: 0.9 },
  { at: 1.5, who: 'sheila', text: 'Grandpa Hal will guard the launch key. He fought in two wars and a Costco parking lot.', beat: 'key' },
  { at: 1.56, who: 'hal', text: "Back in '68 we didn't reveal genders, we just got drafted.", gap: 1.1 },
  { at: 1.8, who: 'destiny', text: 'Mom, the raw-milk tradwife cake is… melting.', cap: 'NUMBER GO UP', beat: 'cake' },
  { at: 1.9, who: 'sheila', text: 'The frosting is politically neutral beige! Neither party can cancel beige!' },
  { at: 2.2, who: 'kyle', text: 'Pre-market volume on $BABY is ripping, babes.', cap: "IT'S LOADING", beat: 'kyle' },
  { at: 2.25, who: 'destiny', text: 'Tanner, why is your crypto bro wearing OB-GYN scrubs?', gap: 0.8 },
  { at: 2.3, who: 'tanner', text: 'He’s our Chief Liquidity Midwife, babe. Respect the scrubs.', gap: 1.0 },
  { at: 2.4, who: 'carol', text: 'is the baby a boy, a girl, or an LLC??' },
  { at: 2.45, who: 'brad', text: 'aped my child support into the fetus.' },
  { at: 2.7, who: 'sheila', text: 'Why is the piñata wired to 40 pounds of Tannerite?! TANNER.', beat: 'tick' },
  { at: 2.85, who: 'crowd', text: '…the forestry service is gonna love this.', thought: true, gap: 1.2 },
  { at: 3.0, who: 'carol', text: 'why are there green candlesticks on the garage door' },
  { at: 3.3, who: 'pauline', text: 'I survived Carter’s inflation, I’m taking the corner piece.', beat: 'grandmas' },
  { at: 3.36, who: 'bev', text: 'Touch my frosting and I’ll call the HOA, Pauline.', gap: 0.5 },
  { at: 4.0, who: 'sheila', text: 'The chart just passed the “BOY OR GIRL” banner. The baby is now a mid-cap asset.', beat: 'focus' },
  { at: 4.5, who: 'destiny', text: 'Tanner. Look at your pregnant wife, not DexScreener.' },
  { at: 5.0, who: 'tanner', text: 'Paternity leave? Declined. This unborn child is paying off my Ford Raptor, babe.', cap: 'DIAMOND DIAPER', beat: 'phone' },
  { at: 5.3, who: 'sheila', text: '…The mystery box is 400 degrees. Did you get a permit for weapons-grade glitter?', beat: 'latch' },
  { at: 6.4, who: 'brad', text: 'leveraged long on the trimester. no epidural, no stop-loss' },
  { at: 8.0, who: 'kyle', text: 'TikTok Live is at 50k viewers! Pump the pink and blue smoke!', cap: 'WEN BIRTH', beat: 'live' },
  { at: 8.4, who: 'worker', text: 'Copy that. Violating three EPA statutes now.' },
  { at: 10, who: 'tanner', text: 'Babe, if it’s twins do we do a token split or an airdrop?' },
  { at: 13, who: 'dale', text: "IT'S A PSYOP! THE ULTRASOUND IS AI-GENERATED!", beat: 'dale' },
  { at: 13.3, who: 'hal', text: 'zzz… my pension died for this… zzz', thought: true, beat: 'asleep' },
  { at: 17, who: 'sheila', text: 'The piñata is ticking in Morse code. It’s spelling “NO REFUNDS.”' },
  { at: 25, who: 'destiny', text: 'My water broke! Wait—no, that’s the margin call!', beat: 'spill' },
  { at: 25.4, who: 'crowd', text: '*GASP*', gap: 0.3 },
  { at: 35, who: 'kyle', text: 'Worker 2, prep the offshore wire transfer on my mark.' },
  { at: 60, who: 'sheila', text: 'The gender box is levitating. Neither the Bible nor science prepared me for this.', cap: 'THIS IS FINE', beat: 'levitate' },
  { at: 62, who: 'worker', text: "OSHA doesn't cover demonic possession, ma'am.", beat: 'hazmat' },
  { at: 130, who: 'sheila', text: 'Update: the FAA has closed the airspace above the cul-de-sac.', beat: 'sky' },
];

/** Past the last rung, one of these comes due every 1.35× of multiplier, in order, forever. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'kyle', text: 'The baby isn’t even born and it’s already accredited!' },
  { who: 'sheila', text: 'Programme item forty-one: nobody calls CPS or the SEC.', cap: 'HOLD THE CAKE' },
  { who: 'carol', text: 'i thought we were getting a toaster' },
  { who: 'tanner', text: 'Faith, family, and 100× perpetual futures, y’all.' },
  { who: 'pauline', text: 'I’m writing this kid out of the will.' },
  { who: 'bev', text: 'There’s nothing left in the will, Pauline.', gap: 0.5 },
  { who: 'brad', text: 'can I claim the fetus as a tax write-off if I hold 1%?' },
  { who: 'dale', text: 'THE STORK IS A GOVERNMENT DRONE!', cap: 'STILL NEUTRAL' },
  { who: 'destiny', text: 'Tanner, if you rug our own baby shower I’m taking the truck.' },
  { who: 'sheila', text: 'Keep smiling! The sponsors are watching!', cap: 'PHONES AWAY' },
  { who: 'hal', text: 'zzz… shoulda stayed in Da Nang… zzz', thought: true },
  { who: 'kyle', text: 'Worker 2, keep the getaway van running.' },
  { who: 'worker', text: 'Engine’s warm, boss.' },
  { who: 'tanner', text: 'Dave Ramsey just blocked me. Bullish.', cap: 'WEN REVEAL' },
  { who: 'destiny', text: 'Wait—we’re not even pregnant, are we, Tanner?!' },
  { who: 'sheila', text: 'Nobody leaves the yard until the engagement metrics peak!', cap: 'NOBODY LEAVES' },
];

/** Said while bets are open. */
export const BETTING_LINE: Omit<Line, 'at'> = { who: 'sheila', text: 'Phones away unless you’re tagging the sponsors! Nobody leak the gender before the token launches!', cap: 'PHONES AWAY' };

/** The plus-one's line on the accepted exit: a thought, never said out loud. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'you', text: 'take the cake. hop the fence. block this family.', thought: true };

export const CAPTIONS = {
  waiting: 'SETTING UP THE CHAIRS',
  /** Shown on the accepted exit, then cycled every 2.4 s while the round keeps running without you. */
  exit: ['CAKE SECURED', 'LEFT BEFORE THE REVEAL', 'SMUG AND FED'],
  /** Once the multiplier is 1.5× past the exit: the party goes on without the plus-one. */
  kept: 'YOU MISSED THE WILDFIRE. CAKE WAS GOOD THOUGH.',
  /** The crash, cycled every 1.6 s while the aftermath holds. */
  crash: ["IT'S A DOG", '$BABY RUGGED', 'RECEIPTS FOR EVERYONE', 'NGMI'],
  dodged: 'RUG DODGED — GATE CLOSED BEHIND YOU',
  watched: 'YOU WATCHED THE REVEAL',
};

/** What the party says about the empty chair, keyed to how far past the exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.5, { who: 'sheila', text: 'Attendance violation! Who left without buying the registry dip?!' }],
  [2, { who: 'carol', text: 'someone just hopped the fence with half the sheet cake' }],
  [3, { who: 'tanner', text: 'Uninvited from the baptism! And the Series A!' }],
  [5, { who: 'destiny', text: 'Honestly, take me with you.' }],
  [10, { who: 'sheila', text: 'Send them an invoice for their folding chair.' }],
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
