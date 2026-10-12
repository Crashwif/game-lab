/**
 * What the SS Sashay says over the public address: a ladder of announcements keyed to the displayed
 * multiplier (never to the crash), overtime lines that keep coming in long rounds, the toasts for what
 * the strait throws at the ship, the regret ladder after an airlift and the lines for the ending.
 */
import type { HazardKind } from './strait';

export interface Line { at: number; who: string; text: string }

export const BOARDING: Line = { at: 1, who: 'ANITA LIFEBOAT, CRUISE DIRECTOR', text: 'All aboard the SS Sashay, darlings. Next stop: open water.' };

/** Half of all rounds end before 2×, so the early lines come a few seconds apart. */
export const LINES: readonly Line[] = [
  { at: 1, who: 'CAPTAIN', text: 'Anchors up. Next stop, open water. Hold on to your wigs.' },
  { at: 1.08, who: 'ANITA LIFEBOAT', text: 'The Strait of Hormuz. Straight? Not on our watch.' },
  { at: 1.18, who: 'BRIDGE', text: 'Mines off the bow. Steer like you are avoiding your ex.' },
  { at: 1.3, who: 'DJ SONAR', text: 'This next one goes out to the minesweepers.' },
  { at: 1.45, who: 'CAPTAIN', text: 'Missiles inbound. Please remain seated and stunning.' },
  { at: 1.62, who: 'ANITA LIFEBOAT', text: 'Speedboats off the bow. They are not on the guest list.' },
  { at: 1.8, who: 'PURSER', text: 'The foam party has been moved below deck. For now.' },
  { at: 2, who: 'CAPTAIN', text: 'Halfway to open water. Shantay, we stay.' },
  { at: 2.25, who: 'BRIDGE', text: 'Drones overhead. Find your light, girls.' },
  { at: 2.55, who: 'ANITA LIFEBOAT', text: 'Lifeboats are colour-coded. Purple is VIP.' },
  { at: 2.9, who: 'DJ SONAR', text: 'Turn it up. We can no longer hear the sirens.' },
  { at: 3.3, who: 'CAPTAIN', text: 'The buffet remains open. We have priorities.' },
  { at: 3.8, who: 'ANITA LIFEBOAT', text: 'Missiles now outnumber drag queens. Barely.' },
  { at: 4.5, who: 'BRIDGE', text: 'Swarm off the bow. Choreography, people!' },
  { at: 5.3, who: 'DJ SONAR', text: 'Five times! Even the dolphins are voguing.' },
  { at: 6.5, who: 'CAPTAIN', text: 'Hydrate. Moisturise. Evade.' },
  { at: 8, who: 'ANITA LIFEBOAT', text: 'The wig is secured. The ship, less so.' },
  { at: 10, who: 'BRIDGE', text: 'Ten times. Technically we are a navy now.' },
  { at: 13, who: 'CAPTAIN', text: 'Open water is close. It has been close for a while.' },
  { at: 17, who: 'PURSER', text: 'Room service now arrives by jet ski. Tip generously.' },
  { at: 22, who: 'ANITA LIFEBOAT', text: 'Somebody check on the captain. She is thriving.' },
];

/** Past the ladder, a line every 1.35× of multiplier, in turn, for as long as the voyage lasts. */
export const OVERTIME: readonly Line[] = [
  { at: 0, who: 'BRIDGE', text: 'Still sailing. Still serving.' },
  { at: 0, who: 'DJ SONAR', text: 'The bass is now visible from orbit.' },
  { at: 0, who: 'CAPTAIN', text: 'The sea is wide. The strait is not. Neither are we.' },
  { at: 0, who: 'ANITA LIFEBOAT', text: 'New record for a pride parade at sea. Again.' },
  { at: 0, who: 'PURSER', text: 'The gift shop is out of rainbow life jackets. Order more.' },
  { at: 0, who: 'BRIDGE', text: 'Open water still ahead. It keeps moving. Rude.' },
  { at: 0, who: 'DJ SONAR', text: 'Remixing the foghorn. Requests welcome.' },
  { at: 0, who: 'CAPTAIN', text: 'Nobody touch the wheel. Except you. You have the wheel.' },
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
  mine: ['MINE! THE BOW HAS NOTES', 'MINE! WHO PUT THAT THERE', 'MINE! NOT ON THE CHART, HONEY'],
  missile: ['DIRECT HIT! THE WIG HELD', 'MISSILE! THE LIDO DECK IS SMOKING', 'HIT! THAT WAS ON THE LIST'],
  drone: ['DRONE STRIKE! NO PHOTOS!', 'DRONE ON THE SUN DECK!', 'DRONE! IT DID NOT RSVP'],
  boat: ['RAMMED! RUDE', 'SPEEDBOAT! THE NERVE', 'RAMMED! NOT THE VIBE'],
};
const CLOSE = ['CLOSE CALL!', 'MISSED US, SWEETIE', 'NOT TODAY, SATAN', 'SERVING EVASION', 'SHE DUCKED'];
const BLOCK = ['DISCO SHIELD! DEFLECTED', 'BOUNCED OFF THE SPARKLE', 'MIRRORBALL SAYS NO'];

export function hitToast(kind: HazardKind, id: number, lost: number): string {
  const head = pick(HITS[kind], id);
  return lost > 0 ? `${head} · ${lost} OVERBOARD (ON FLOATIES)` : head;
}
export const closeToast = (id: number): string => pick(CLOSE, id);
export const blockToast = (id: number): string => pick(BLOCK, id);
export const rescueToast = (count: number): string => (count > 1 ? `+${count} GUESTS ABOARD` : '+1 GUEST ABOARD');

/** After the airlift: how far the ship has sailed past your exit, always backing the exit. */
export const REGRET: readonly (readonly [number, string])[] = [
  [5, 'THE SHIP IS THRIVING. THE CHOPPER HAS SNACKS.'],
  [3, 'THREE TIMES YOUR EXIT. ZERO TIMES WET.'],
  [2, 'DOUBLE WITHOUT YOU. STILL DRY, STILL ICONIC.'],
  [1.5, 'FIFTY PERCENT FURTHER. ONE HUNDRED PERCENT DRY.'],
  [1.15, 'THE PARTY GOES ON WITHOUT YOU. BITTER? NEVER.'],
  [0, 'AIRLIFTED. SHANTAY, YOU STAY (DRY).'],
];

export type Cause = 'mine' | 'missile' | 'drones' | 'boat';
export const CAUSES: readonly Cause[] = ['mine', 'missile', 'drones', 'boat'];
export const CAUSE_LINE: Readonly<Record<Cause, string>> = {
  mine: 'A MINE THAT WAS NOT ON THE CHART',
  missile: 'ONE MISSILE TOO MANY',
  drones: 'A DRONE SWARM. NO PHOTOS!',
  boat: 'A SPEEDBOAT THAT DID NOT RSVP',
};

/** The last announcement, by what sank her. */
export const SINKING: Readonly<Record<Cause, Line>> = {
  mine: { at: 0, who: 'CAPTAIN', text: 'That mine was not on the chart. Abandon ship, gorgeous!' },
  missile: { at: 0, who: 'BRIDGE', text: 'One missile too many. Floaties first, wigs second!' },
  drones: { at: 0, who: 'ANITA LIFEBOAT', text: 'Drones on the sun deck! Everybody off, and smile!' },
  boat: { at: 0, who: 'CAPTAIN', text: 'Rammed! Drag queens, bears and twinks first!' },
};
