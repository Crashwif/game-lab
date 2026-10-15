/**
 * The words of MAFO: Junior's cooking show keyed to the displayed multiplier (with Cuz, Miss Darlene across the
 * road, Sheriff Boyd's bullhorn and Mamaw on speaker), the gauge swaps, the overtime cycle for long rounds, what
 * they say after you go for ice, the last bad ideas and the aftermath, the captions, the shades of blue and the
 * outcome stamps. Data only: nothing here reads or changes the round's outcome. Every name is a cartoon; the
 * "blue rock candy" is a cartoon too, and nothing here is a recipe for anything.
 */
import type { Line } from './script';
import type { Trigger } from './junior';

export const TITLE = 'MAFO';

/** The show. `beat` stages a prop or a gesture when the line is said; `cap` walks the caption ladder. */
export const LADDER: Line[] = [
  { at: 1.01, who: 'junior', text: 'Step one: fire it up.', cap: 'STEP ONE: FIRE IT UP', beat: 'ignite' },
  { at: 1.11, who: 'cuz', text: "Is that Mamaw's turkey fryer?" },
  { at: 1.26, who: 'junior', text: 'Multi-purpose fryer, Cuz. Step two: a splash of the XXX.', cap: 'A SPLASH OF THE XXX', beat: 'pour:xxx' },
  { at: 1.47, who: 'cuz', text: "Possum's playin' dead again.", beat: 'possum' },
  { at: 1.61, who: 'junior', text: 'Goggles. Safety first. I watched a whole documentary.', cap: 'SAFETY FIRST', beat: 'goggles' },
  { at: 1.85, who: 'darlene', text: 'JUNIOR! WHAT IS THAT SMELL?', beat: 'darlene:window' },
  { at: 2.06, who: 'junior', text: "IT'S A CANDLE, MISS DARLENE!", gap: 0.6, cap: "IT'S A CANDLE" },
  { at: 2.33, who: 'cuz', text: "What's in the MYSTERY jug?" },
  { at: 2.61, who: 'junior', text: "Nobody knows. That's why it's MYSTERY.", cap: 'A LITTLE MORE MYSTERY', beat: 'pour:mystery' },
  { at: 3.31, who: 'junior', text: "Gauge says sixty. Sixty what? Don't matter.", cap: 'SIXTY WHAT', beat: 'tap' },
  { at: 3.66, who: 'cuz', text: "Junior, the walls are breathin'.", beat: 'wobble' },
  { at: 4.64, who: 'darlene', text: "THAT'S IT. I'M CALLIN' THE SHERIFF!", beat: 'darlene:porch' },
  { at: 5.18, who: 'junior', text: 'TELL BOYD I SAID HEY!', gap: 0.6, cap: 'TELL BOYD I SAID HEY' },
  { at: 6.55, who: 'junior', text: 'Crank it, Cuz. Low and slow is for quitters.', cap: 'LOW AND SLOW IS FOR QUITTERS', beat: 'turnup' },
  { at: 7.29, who: 'cuz', text: "Junior, the possum's prayin'.", beat: 'possum' },
  { at: 8.32, who: 'junior', text: 'Ninety-nine percent pure. Other one percent is love.', cap: '1% LOVE' },
  { at: 9.41, who: 'sheriff', text: "JUNIOR. SHERIFF BOYD. WHY IS YOUR TRAILER GLOWIN'?", beat: 'sheriff' },
  { at: 10.64, who: 'junior', text: "IT'S A NIGHT LIGHT, BOYD!", gap: 0.7, cap: "IT'S A NIGHT LIGHT" },
  { at: 13.5, who: 'junior', text: "Propane don't smell, Cuz. They add the smell. I can't smell nothin', so we're good.", cap: 'SMELLS FINE TO ME' },
  { at: 15.03, who: 'sheriff', text: "...I'M GONNA WAIT IN THE CAR.", beat: 'sheriff:car', cap: "THE SHERIFF IS WAITIN' IN THE CAR" },
  { at: 17.4, who: 'junior', text: "Hold on. It's Mamaw.", beat: 'phone' },
  { at: 19.2, who: 'mamaw', text: 'JUNIOR, IS THAT MY TURKEY FRYER I HEAR?' },
  { at: 21.9, who: 'junior', text: "No ma'am. It's a science project. Love you, bye.", cap: "IT'S A SCIENCE PROJECT", beat: 'hangup' },
  { at: 24.4, who: 'cuz', text: "Junior, my fillings are hummin'." },
  { at: 28, who: 'junior', text: "It's so blue, Cuz. Bluer than blue. Country blue.", cap: 'COUNTRY BLUE' },
  { at: 31.3, who: 'darlene', text: "I'M MAKIN' POPCORN!", beat: 'darlene:chair', cap: 'DARLENE MADE POPCORN' },
  { at: 35.8, who: 'junior', text: "That's a lotta PSI, Cuz. I counted.", cap: 'A LOTTA PSI', beat: 'tap' },
  { at: 45, who: 'cuz', text: "Junior, my beer's boilin'." },
  { at: 50.9, who: 'junior', text: "Mamaw's recipe never said nothin' about hummin'.", cap: "IT'S HUMMIN'" },
  { at: 62, who: 'cuz', text: "Junior. There's a spaceship.", beat: 'ufo' },
  { at: 69.2, who: 'junior', text: 'Probably wants the recipe.', gap: 0.7, cap: 'THEY WANT THE RECIPE' },
  { at: 79.4, who: 'mamaw', text: 'JUNIOR, WHY IS THE BINGO HALL BLUE?', beat: 'phone' },
  { at: 92, who: 'junior', text: 'Northern lights, Mamaw.', cap: 'NORTHERN LIGHTS, MAMAW', beat: 'hangup' },
];

/** Past 100×, one of these comes due every 1.35× of multiplier, in turn, for as long as the round runs. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'junior', text: "The trailer's floatin', Cuz. That's new.", cap: "THE TRAILER IS FLOATIN'" },
  { who: 'cuz', text: 'Junior, I can see through my hand.' },
  { who: 'junior', text: "Ain't nothin' in the recipe about this.", cap: 'NOT IN THE RECIPE' },
  { who: 'darlene', text: 'JUNIOR, THE ALIENS WANT A PLATE!' },
  { who: 'junior', text: "Tell 'em it's Mamaw's recipe. Family only.", cap: 'FAMILY RECIPE' },
  { who: 'sheriff', text: 'JUNIOR, THE STATE POLICE CAN SEE IT FROM THE INTERSTATE.' },
  { who: 'junior', text: "Satellite dish is gettin' channels from the future.", cap: 'CHANNELS FROM THE FUTURE' },
  { who: 'cuz', text: "Junior, the possum's glowin'." },
  { who: 'junior', text: 'Stir it clockwise. Counterclockwise is how you get Florida.', cap: 'CLOCKWISE' },
  { who: 'mamaw', text: "JUNIOR, NASA'S ON THE OTHER LINE.", beat: 'phone' },
  { who: 'junior', text: 'Hundred and ten percent pure. I give it a hundred and ten.', cap: '110% PURE', beat: 'hangup' },
  { who: 'junior', text: "Most beautiful thing I ever made, Cuz. Don't tell my truck.", cap: "DON'T TELL THE TRUCK" },
];

/** What he says each time the gauge pins and he swaps in the next one (4×, 40×, 400×, …). */
export const SWAP_LINES: Omit<Line, 'at'>[] = [
  { who: 'junior', text: 'Gauge is broke. Lemme get the one off the water heater.', cap: 'THE WATER HEATER GAUGE' },
  { who: 'junior', text: "Broke another one. I need a submarine gauge. Don't ask where I got it.", cap: 'SUBMARINE GAUGE' },
  { who: 'junior', text: "NASA gauge. Don't tell NASA.", cap: 'NASA GAUGE' },
  { who: 'junior', text: 'This one came off a volcano.', cap: 'VOLCANO GAUGE' },
  { who: 'junior', text: "Lord, I'm gonna need a bigger gauge.", cap: 'THE GAUGE OF GOD' },
  { who: 'junior', text: 'Bigger gauge.', cap: 'BIGGER GAUGE' },
];

/** Said while seats are still being taken. */
export const BETTING_LINE: Omit<Line, 'at'> = {
  who: 'junior',
  text: "Cuz, you rollin'? Welcome back to Cookin' with Junior. Mamaw's at bingo till nine.",
  cap: "COOKIN' WITH JUNIOR",
};

/** Your exit, and Junior noticing a moment later. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'cuz', text: "I'm gonna go get ice." };
export const EXIT_REPLY: Omit<Line, 'at'> = { who: 'junior', text: 'Cuz? CUZ! ...Fine. More purity for me.', gap: 1.6 };

/** After you have gone, keyed to how far past your exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.4, { who: 'junior', text: "Cuz is missin' the best part!" }],
  [2, { who: 'junior', text: "Ice don't take this long, Cuz!" }],
  [3, { who: 'darlene', text: 'SMART BOY!' }],
  [5, { who: 'junior', text: "CUZ! It's a hundred percent now! You're missin' history!" }],
  [10, { who: 'sheriff', text: 'SON, YOU DID THE RIGHT THING.' }],
];

/** The last bad idea, said on the crash clock before the cut outside. */
export const TRIGGER_LINES: Record<Trigger, [at: number, line: Omit<Line, 'at'>][]> = {
  beer: [[0.02, { who: 'junior', text: 'Cuz. Hold my beer.', life: 1.4 }]],
  smoke: [[0.02, { who: 'junior', text: 'Just a quick one.', life: 1.2 }]],
  sneeze: [[0.02, { who: 'junior', text: 'Ah... ahh...', life: 0.6 }], [0.3, { who: 'junior', text: 'CHOO!', life: 0.8 }]],
  tap: [[0.02, { who: 'junior', text: 'Huh.', life: 1.2 }]],
  ignite: [[0.02, { who: 'junior', text: 'Whoops.', life: 1.2 }]],
};

/** What Junior says once he has come down, chosen by the crash's seed. */
export const LANDED_LINES = ['...Nailed it.', "...Mamaw's gonna kill me.", '...Same time next week.'];
export const ABDUCTED_LINE = "TELL MAMAW I'LL BE LATE!";
export const CUZ_FLEW_LINE = "...I'm gonna go get ice.";
export const CUZ_DODGED_LINE = 'Got the ice.';
export const DARLENE_LINE = 'I GOT IT ON VIDEO!';

export const CAPTIONS = {
  waiting: "COOKIN' WITH JUNIOR · BACK AFTER THIS",
  /** The accepted exit, then cycled every 2.4 s while the round keeps running without you. */
  exit: ['WENT TO GET ICE', 'OUTSIDE, BEHIND THE TRUCK'],
  /** Once the multiplier is twice your exit (from the second regret on). */
  kept: 'THE COOK GOES ON WITHOUT YOU',
  /** The crash's first caption, by the last bad idea. */
  trigger: { beer: 'HOLD MY BEER', smoke: "STEP 3: DON'T SMOKE", sneeze: 'BLESS YOU', tap: "DON'T TAP THE GAUGE", ignite: 'STEP ONE: FIRE IT UP' } satisfies Record<Trigger, string>,
  /** Then cycled every 1.8 s while the aftermath holds. */
  crash: ['FOUND OUT', 'METH AROUND', 'AND FIND OUT', 'THE TOILET MADE IT'],
  dodged: 'GOT OUT — AND GOT THE ICE',
  watched: 'YOU SAW THE WHOLE THING',
};

/** The badge on an accepted exit. */
export const BADGE = 'WENT TO GET ICE';
export const STAMP = { rekt: 'FOUND OUT', dodged: 'GOT OUT', watched: "JUST WATCHIN'" } as const;

/** The brew's shade, by the multiplier. */
const SHADES: [at: number, name: string][] = [
  [1, 'CREEK WATER'], [1.15, 'SWAMP'], [1.4, 'PICKLE JUICE'], [1.8, 'ANTIFREEZE'], [2.3, 'TEAL'], [3, 'SKY'], [4.5, 'COUNTRY BLUE'],
  [7, 'ELECTRIC'], [12, 'NUCLEAR'], [25, 'ALIEN'], [60, 'HEAVENLY'], [150, "GOD'S OWN BLUE"], [400, 'BLUE 2: BLUER'], [1500, 'BEYOND BLUE'],
];
export function shadeAt(multiplier: number): string {
  let name = SHADES[0]![1];
  for (const [at, n] of SHADES) if (multiplier >= at) name = n;
  return name;
}

/** The multipliers that sound the milestone stinger. */
export const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];
