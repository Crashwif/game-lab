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
  { at: 1.01, who: 'junior', text: 'Step one: fire it up. Take that, EPA.', cap: 'STEP ONE: FIRE IT UP', beat: 'ignite' },
  { at: 1.11, who: 'cuz', text: "Is that Mamaw's church turkey fryer?" },
  { at: 1.26, who: 'junior', text: 'Tax-free pharmaceutical lab, Cuz. Step two: a splash of the XXX.', cap: 'A SPLASH OF THE XXX', beat: 'pour:xxx' },
  { at: 1.47, who: 'cuz', text: "Possum's playin' dead again.", beat: 'possum' },
  { at: 1.61, who: 'junior', text: 'Safety squints and harbor freight goggles. OSHA can kiss my grits.', cap: 'SAFETY FIRST', beat: 'goggles' },
  { at: 1.85, who: 'darlene', text: 'JUNIOR! MY SINUSES JUST CLEARED FROM ACROSS THE ROAD!', beat: 'darlene:window' },
  { at: 2.06, who: 'junior', text: "IT'S ESSENTIAL OILS, MISS DARLENE! VERY HOLISTIC!", gap: 0.6, cap: "IT'S A CANDLE" },
  { at: 2.33, who: 'cuz', text: "What's in the MYSTERY jug?" },
  { at: 2.61, who: 'junior', text: "If the FDA don't know, they can't regulate it.", cap: 'A LITTLE MORE MYSTERY', beat: 'pour:mystery' },
  { at: 3.31, who: 'junior', text: "Gauge says sixty. Metric or Freedom units? Don't matter.", cap: 'SIXTY WHAT', beat: 'tap' },
  { at: 3.66, who: 'cuz', text: "Junior, the walls are breathin'.", beat: 'wobble' },
  { at: 4.64, who: 'darlene', text: "THAT'S IT. I'M CALLIN' SHERIFF BOYD!", beat: 'darlene:porch' },
  { at: 5.18, who: 'junior', text: 'TELL BOYD HIS CAMPAIGN CONTRIBUTION IS ALMOST READY!', gap: 0.6, cap: 'TELL BOYD I SAID HEY' },
  { at: 6.55, who: 'junior', text: 'Crank it, Cuz. Big Pharma charges $800 a month for this.', cap: 'LOW AND SLOW IS FOR QUITTERS', beat: 'turnup' },
  { at: 7.29, who: 'cuz', text: "Junior, the possum's speakin' in tongues.", beat: 'possum' },
  { at: 8.32, who: 'junior', text: 'Ninety-nine percent pure American small business. Zero percent taxes.', cap: '1% LOVE' },
  { at: 9.41, who: 'sheriff', text: "JUNIOR. SHERIFF BOYD. WHY IS YOUR TRAILER ON NORAD RADAR?", beat: 'sheriff' },
  { at: 10.64, who: 'junior', text: "IT'S A SOVEREIGN CITIZEN BBQ, BOYD! AM I BEING DETAINED?!", gap: 0.7, cap: "IT'S A NIGHT LIGHT" },
  { at: 13.5, who: 'junior', text: "Propane don't smell, Cuz. The government adds the smell to track you.", cap: 'SMELLS FINE TO ME' },
  { at: 15.03, who: 'sheriff', text: "...MY PENSION'S TOO CLOSE FOR THIS. I'M WAITIN' IN THE CAR.", beat: 'sheriff:car', cap: "THE SHERIFF IS WAITIN' IN THE CAR" },
  { at: 17.4, who: 'junior', text: "Hold on. It's Mamaw.", beat: 'phone' },
  { at: 19.2, who: 'mamaw', text: 'JUNIOR, DID YOU PAWN MY INSULIN COOLER FOR COPPER TUBING?' },
  { at: 21.9, who: 'junior', text: "I'm diversifyin' your Medicare portfolio, Mamaw! Love you, bye.", cap: "IT'S A SCIENCE PROJECT", beat: 'hangup' },
  { at: 24.4, who: 'cuz', text: "Junior, my fillings are pickin' up AM talk radio." },
  { at: 28, who: 'junior', text: "Look at that blue, Cuz. Blue enough to get a farm subsidy.", cap: 'COUNTRY BLUE' },
  { at: 31.3, who: 'darlene', text: "I'M MAKIN' POPCORN AND CALLIN' MY INSURANCE AGENT!", beat: 'darlene:chair', cap: 'DARLENE MADE POPCORN' },
  { at: 35.8, who: 'junior', text: "That's a lotta PSI, Cuz. Good thing I don't believe in physics.", cap: 'A LOTTA PSI', beat: 'tap' },
  { at: 45, who: 'cuz', text: "Junior, my Busch Light is boilin'." },
  { at: 50.9, who: 'junior', text: "Pfizer wishes they had a turkey fryer like this.", cap: "IT'S HUMMIN'" },
  { at: 62, who: 'cuz', text: "Junior. Space Force is hoverin' over the yard.", beat: 'ufo' },
  { at: 69.2, who: 'junior', text: "Tell 'em no warrant, no recipe.", gap: 0.7, cap: 'THEY WANT THE RECIPE' },
  { at: 79.4, who: 'mamaw', text: 'JUNIOR, WHY IS THE BAPTIST CHURCH GLOWIN’ IN THE DARK?', beat: 'phone' },
  { at: 92, who: 'junior', text: 'Climate change, Mamaw! Al Gore did it!', cap: 'NORTHERN LIGHTS, MAMAW', beat: 'hangup' },
];

/** Past 100×, one of these comes due every 1.35× of multiplier, in turn, for as long as the round runs. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'junior', text: "The trailer's off the cinder blocks, Cuz. Does that mean no property tax?", cap: "THE TRAILER IS FLOATIN'" },
  { who: 'cuz', text: 'Junior, I can see my own skeleton.' },
  { who: 'junior', text: "Free X-ray, Cuz. Saved you a $4,000 hospital copay.", cap: 'NOT IN THE RECIPE' },
  { who: 'darlene', text: 'JUNIOR, THE ALIENS JUST PAID OFF MY REVERSE MORTGAGE!' },
  { who: 'junior', text: "See? Trickle-down economics works when you cook it at 900 degrees.", cap: 'FAMILY RECIPE' },
  { who: 'sheriff', text: 'JUNIOR, FEMA JUST DECLARED YOUR PORCH A SUPERFUND SITE.' },
  { who: 'junior', text: "Tell FEMA we're carbon-neutral if you don't count the propane!", cap: 'CHANNELS FROM THE FUTURE' },
  { who: 'cuz', text: "Junior, the possum just filed for Congress." },
  { who: 'junior', text: "He's got my vote, Cuz. At least he plays dead for free.", cap: 'CLOCKWISE' },
  { who: 'mamaw', text: "JUNIOR, RFK JR. IS ON LINE TWO ASKIN' WHAT'S IN THE JUG.", beat: 'phone' },
  { who: 'junior', text: 'Raw milk and battery acid, Mamaw! Tell him it’s organic!', cap: '110% PURE', beat: 'hangup' },
  { who: 'junior', text: "Domestic manufacturing is back, baby. Don't tell the IRS.", cap: "DON'T TELL THE TRUCK" },
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
