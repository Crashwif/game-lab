/**
 * What the SS Sashay says over the public address: a ladder of announcements keyed to the displayed
 * multiplier (never to the crash), overtime lines that keep coming in long rounds, the toasts for what
 * the strait throws at the ship, the regret ladder after an airlift and the lines for the ending.
 */
import type { HazardKind } from './strait';

export interface Line { at: number; who: string; text: string }

export const BOARDING: Line = { at: 1, who: 'ANITA LIFEBOAT, CRUISE DIRECTOR', text: 'All aboard the SS Sashay! Sponsored by Raytheon Pride Month.' };

/** Half of all rounds end before 2×, so the early lines come a few seconds apart. */
export const LINES: readonly Line[] = [
  { at: 1, who: 'CAPTAIN', text: 'Anchors up! Exporting democracy, brunch, and 40-foot wigs.' },
  { at: 1.08, who: 'ANITA LIFEBOAT', text: 'The Strait of Hormuz? Honey, nothing out here is straight.' },
  { at: 1.18, who: 'BRIDGE', text: 'Theocratic speedboats at 2 o’clock! Wave your pronouns at them!' },
  { at: 1.3, who: 'DJ SONAR', text: 'This next Cher remix is funded by the Pentagon’s DEI budget!' },
  { at: 1.45, who: 'CAPTAIN', text: 'Fatwa off the port bow! Everybody death-drop on three!' },
  { at: 1.62, who: 'ANITA LIFEBOAT', text: 'IRGC on the radio! They hate our freedom and our highlights.' },
  { at: 1.8, who: 'PURSER', text: 'Brent Crude is up 8% and the bottomless mimosas are tax-free!' },
  { at: 2, who: 'CAPTAIN', text: 'The UN just sent a strongly worded letter. We used it as confetti.' },
  { at: 2.25, who: 'BRIDGE', text: 'Shahed drones overhead! Give them face, girls, it’s HD!' },
  { at: 2.55, who: 'ANITA LIFEBOAT', text: 'Lifeboats load by victimhood bracket, then VIP bottle service!' },
  { at: 2.9, who: 'DJ SONAR', text: 'Lockheed Martin says slay! Literally, the defense bill passed!' },
  { at: 3.3, who: 'CAPTAIN', text: 'Neocons want war, tankies want a blockade, we want open bar!' },
  { at: 3.8, who: 'ANITA LIFEBOAT', text: 'State TV just blurred our Lido Deck! We’re famous in Tehran!' },
  { at: 4.5, who: 'BRIDGE', text: 'Swarm off the bow! Our choreography is tighter than NATO!' },
  { at: 5.3, who: 'DJ SONAR', text: 'Five times! The Ayatollah’s radar is blinded by body glitter!' },
  { at: 6.5, who: 'CAPTAIN', text: 'Gas is $9 a gallon back home. Keep voguing for petrodollars!' },
  { at: 8, who: 'ANITA LIFEBOAT', text: 'The Fifth Fleet just saluted our Cher impersonator!' },
  { at: 10, who: 'BRIDGE', text: 'Ten times! Congress just declared this foam party a US ally!' },
  { at: 13, who: 'CAPTAIN', text: 'CNN and Al Jazeera both have us live. Suck in your stomachs!' },
  { at: 17, who: 'PURSER', text: 'Carbon offsets for the missile smoke are now available at the bar.' },
  { at: 22, who: 'ANITA LIFEBOAT', text: 'Peace in the Middle East? No, but the lighting is immaculate!' },
];

/** Past the ladder, a line every 1.35× of multiplier, in turn, for as long as the voyage lasts. */
export const OVERTIME: readonly Line[] = [
  { at: 0, who: 'BRIDGE', text: 'Still floating, still fabulous, still violating twelve treaties.' },
  { at: 0, who: 'DJ SONAR', text: 'The bass is rattling centrifuge facilities three hundred miles inland.' },
  { at: 0, who: 'CAPTAIN', text: 'The State Department disavowed us, which means no coast guard!' },
  { at: 0, who: 'ANITA LIFEBOAT', text: 'College protesters can’t decide which side of this boat to chant for!' },
  { at: 0, who: 'PURSER', text: 'Halliburton just bought VIP tables on the poop deck!' },
  { at: 0, who: 'BRIDGE', text: 'Sanctions? Darling, this entire outfit is an international incident.' },
  { at: 0, who: 'DJ SONAR', text: 'Remixing the air-raid siren to 128 BPM. Hands up, hostages!' },
  { at: 0, who: 'CAPTAIN', text: 'We are now the third largest naval superpower in the Persian Gulf.' },
];

/** The announcement for a multiplier: the ladder, then the overtime cycle. */
export function lineIndex(x: number): number {
  let n = 0;
  while (n + 1 < LINES.length && x >= LINES[n + 1]!.at) n++;
  const last = LINES[LINES.length - 1]!.at;
  return x >= last * 1.35 ? n + Math.floor(Math.log(x / last) / Math.log(1.35)) : n;
}
export const lineAt = (n: number): Line => (n < LINES.length ? LINES[n]! : OVERTIME[(n - LINES.length) % OVERTIME.length]!);

/** How far open water is: 60 nautical miles over the multiplier. The strait never quite ends, it only halves. Presentation, not a forecast. */
export function openWater(x: number): string {
  const miles = 60 / Math.max(1, x);
  if (miles >= 1) return `${miles.toFixed(1)} NM`;
  const metres = miles * 1852;
  if (metres >= 1) return `${metres.toFixed(metres < 10 ? 1 : 0)} M`;
  return `${(metres * 100).toFixed(1)} CM`;
}

const pick = <T>(list: readonly T[], n: number): T => list[Math.abs(Math.floor(n)) % list.length]!;

const HITS: Readonly<Record<HazardKind, readonly string[]>> = {
  mine: ['MINE! OIL FUTURES JUST SPIKED', 'MINE! RIGHT IN THE PRIDE BUDGET', 'MINE! CALL RAYTHEON CUSTOMER CARE'],
  missile: ['DIRECT HIT! THE WIG HELD', 'MISSILE! THE MIMOSA BAR IS SMOKING', 'HIT! THAT COST TAXPAYERS $2M'],
  drone: ['DRONE STRIKE! NO FREE CONTENT!', 'DRONE ON THE VIP DECK!', 'DRONE! VERY HOMOPHOBIC TBH'],
  boat: ['RAMMED BY THE MORALITY POLICE!', 'SPEEDBOAT! NOT ON THE GUEST LIST', 'RAMMED! ZERO TIP FOR THE VALET'],
};
const CLOSE = ['DODGED LIKE SANCTIONS!', 'MISSED US, SWEETIE', 'NOT TODAY, AYATOLLAH', 'SERVING EVASION', 'NATO COULD NEVER'];
const BLOCK = ['RAYTHEON PRIDE SHIELD!', 'BOUNCED OFF THE GLITTER DOME', 'MIRRORBALL IRON DOME!'];

export function hitToast(kind: HazardKind, id: number, lost: number): string {
  const head = pick(HITS[kind], id);
  return lost > 0 ? `${head} · ${lost} OVERBOARD (ON FLOATIES)` : head;
}
export const closeToast = (id: number): string => pick(CLOSE, id);
export const blockToast = (id: number): string => pick(BLOCK, id);
export const rescueToast = (count: number): string => (count > 1 ? `+${count} GUESTS ABOARD` : '+1 GUEST ABOARD');

/** After the airlift: how far the ship has sailed past your exit, always backing the exit. */
export const REGRET: readonly (readonly [number, string])[] = [
  [5, 'THE SHIP IS THRIVING. THE EMBASSY CHOPPER HAS SNACKS.'],
  [3, 'THREE TIMES YOUR EXIT. ZERO WAR CRIMES ON YOUR TAB.'],
  [2, 'DOUBLE WITHOUT YOU. STILL DRY, STILL UNSANCTIONED.'],
  [1.5, 'FIFTY PERCENT FURTHER. ONE HUNDRED PERCENT DIPLOMATIC IMMUNITY.'],
  [1.15, 'THE FOAM PARTY GOES ON WITHOUT YOU. BITTER? NEVER.'],
  [0, 'AIRLIFTED BY BLACKWATER PRIDE. SHANTAY, YOU STAY (DRY).'],
];

export type Cause = 'mine' | 'missile' | 'drones' | 'boat';
export const CAUSES: readonly Cause[] = ['mine', 'missile', 'drones', 'boat'];
export const CAUSE_LINE: Readonly<Record<Cause, string>> = {
  mine: 'AN UNMARKED NAVAL MINE IN THE BRUNCH LANE',
  missile: 'ONE ANTI-SHIP MISSILE TOO MANY',
  drones: 'A DRONE SWARM THAT DID NOT TIP THE DOLLS',
  boat: 'A SPEEDBOAT FROM THE MORALITY NAVY',
};

/** The last announcement, by what sank her. */
export const SINKING: Readonly<Record<Cause, Line>> = {
  mine: { at: 0, who: 'CAPTAIN', text: 'Naval mine! Grab your floaties and blame the military-industrial complex!' },
  missile: { at: 0, who: 'BRIDGE', text: 'Direct hit! Influencers, defense contractors, and twinks to the rafts!' },
  drones: { at: 0, who: 'ANITA LIFEBOAT', text: 'Drones on the sun deck! Tag the UN and hit your angles in the water!' },
  boat: { at: 0, who: 'CAPTAIN', text: 'Rammed! Abandon ship, darlings, oil just hit $200 a barrel!' },
};
