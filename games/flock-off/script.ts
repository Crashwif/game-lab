/**
 * Everything Flock Off says: a ladder of lines keyed to the displayed multiplier (never to the crash),
 * overtime lines that keep coming in long rounds, the Nextdoor feed that never runs out, the toasts for
 * what the gun does, the regret ladder after the getaway, and the causes, charges and cards of the bust.
 */
export interface Line { at: number; who: string; text: string }

/** Half of all rounds end before 2×, so the early lines come a few seconds apart. */
export const LINES: readonly Line[] = [
  { at: 1, who: 'NARRATOR', text: 'A man. A BMX. A deep discomfort with being perceived.' },
  { at: 1.08, who: 'GROUP CHAT', text: 'ok he is actually doing it. he is deflocking the block.' },
  { at: 1.18, who: 'KAREN W. (NEXTDOOR)', text: 'Suspicious male in ALL BLACK on a bicycle. Sharing for awareness.' },
  { at: 1.3, who: 'DISPATCH', text: 'All units, subject is on a... BMX? Confirm. A BMX.' },
  { at: 1.45, who: 'FLOCK HQ', text: 'We have lost camera four. And seven. And twelve. And the solar panel.' },
  { at: 1.62, who: 'GROUP CHAT', text: 'bro is speedrunning the surveillance state' },
  { at: 1.8, who: 'DISPATCH', text: 'Suspect has no plate. Repeat: the bicycle does not have a plate.' },
  { at: 2, who: 'NARRATOR', text: 'Two times. The HOA has convened an emergency meeting.' },
  { at: 2.25, who: 'KAREN W. (NEXTDOOR)', text: 'He waved at my Ring doorbell. I feel SEEN. In a bad way.' },
  { at: 2.55, who: 'FLOCK HQ', text: 'Deploying the backup cameras. The backup cameras are also down.' },
  { at: 2.9, who: 'GROUP CHAT', text: 'mans is cooking. mans is also cooked.' },
  { at: 3.3, who: 'DISPATCH', text: 'Requesting air support. Yes. For a bicycle.' },
  { at: 3.8, who: 'CHANNEL 4', text: 'We are live over the pursuit. We have named him. The name is bad.' },
  { at: 4.5, who: 'CITY COUNCIL', text: 'Emergency vote: more cameras, or fewer? (More. It was always more.)' },
  { at: 5.3, who: 'GROUP CHAT', text: 'five times. he is the main character now. we are the NPCs.' },
  { at: 6.5, who: 'FLOCK HQ', text: 'Our stock is down nine percent. Please stop. We can hear you not stopping.' },
  { at: 8, who: 'DISPATCH', text: 'The helicopter would like to go home. The helicopter has a family.' },
  { at: 10, who: 'NARRATOR', text: 'Ten times. The cameras now fear the dark.' },
  { at: 13, who: 'KAREN W. (NEXTDOOR)', text: 'I have started a GoFundMe for the cameras. $14 raised. All mine.' },
  { at: 17, who: 'GROUP CHAT', text: 'touch grass? he IS the grass. he is the whole lawn.' },
  { at: 22, who: 'THE FEDS', text: 'We would like to talk. Just talk. Bring the bike. Bring the gun. Bring the lore.' },
];

/** Past the ladder, a line every 1.35× of multiplier, in turn, for as long as the ride lasts. */
export const OVERTIME: readonly Line[] = [
  { at: 0, who: 'DISPATCH', text: 'Still riding. Still shooting. Still, somehow, on a BMX.' },
  { at: 0, who: 'FLOCK HQ', text: 'We have run out of cameras. We are ordering cameras to watch the cameras.' },
  { at: 0, who: 'GROUP CHAT', text: 'the lore is getting out of hand' },
  { at: 0, who: 'NARRATOR', text: 'Nobody has been this perceived and this unperceived at the same time.' },
  { at: 0, who: 'CHANNEL 4', text: 'Ratings are up. The chopper is low on fuel. We stay.' },
  { at: 0, who: 'KAREN W. (NEXTDOOR)', text: 'He went past again. Same hoodie. Different vibe.' },
  { at: 0, who: 'THE FEDS', text: 'We have added him to a list. The list is also a camera.' },
  { at: 0, who: 'GROUP CHAT', text: 'sigma grindset but the grind is crime (property, mostly)' },
];

/** The line for a multiplier: the ladder, then the overtime cycle. */
export function lineIndex(x: number): number {
  let n = 0;
  while (n + 1 < LINES.length && x >= LINES[n + 1]!.at) n++;
  const last = LINES[LINES.length - 1]!.at;
  return x >= last * 1.35 ? n + Math.floor(Math.log(x / last) / Math.log(1.35)) : n;
}
export const lineAt = (n: number): Line => (n < LINES.length ? LINES[n]! : OVERTIME[(n - LINES.length) % OVERTIME.length]!);

/** Hash noise in [0, 1) for picking lines: the same inputs always give the same pick. */
const pickNoise = (n: number): number => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const pick = <T>(list: readonly T[], n: number): T => list[Math.abs(Math.floor(n)) % list.length]!;

/** The Nextdoor feed at the foot of the picture: names, places and takes recombined so it never repeats for long. */
const NAMES = ['Karen W.', 'Brad T.', 'Linda (HOA)', 'Chad', 'Deb', 'Officer Mike', 'Flock Safety ✓', 'Becky', 'Gary (retired)', 'Tyler', 'Pastor Rick', 'the HOA board', 'Kyle', 'Grandma Jo'] as const;
const PLACES = ['the Costco', 'the Dollar General', "the Wendy's", 'the HOA pool', 'the Chick-fil-A drive-thru', 'the church lot', 'Planet Fitness', 'the vape shop', 'the Crypto ATM', 'the Bail Bonds', 'the Urgent Care (sort of)', 'the Little Free Library'] as const;
const TAKES = [
  'did anyone else hear gunshots near {place}? sounded like freedom',
  'SUSPICIOUS male on bicycle by {place}, ALL BLACK, please share',
  'he shot the camera by {place}. the camera had a family',
  'this is why we need MORE cameras. and a moat',
  'based',
  'I saw him at {place}. he waved. I waved back. I regret this',
  'the camera at {place} is down, who do I call, is it the vibes',
  'my Ring saw him. my Ring is now also shot',
  'has anyone checked if he is a drone (birds aren\'t real)',
  'he did a wheelie past {place}. illegal? no. rude? yes',
  'the BMX has no plate. I checked. I am still checking',
  'the helicopter woke my dog. the dog is on his side now',
  'skill issue (the cameras)',
  'reminder that {place} is PRIVATE PROPERTY and so is my fear',
  'he is NOT the problem. the cameras are NOT the problem. I am NOT the problem',
  'ratio + deflocked + no plate + touch grass',
  'to the man in black: my son looks up to you. please stop',
  'HOA meeting moved to {place}. agenda: him',
  'police say "stay inside." I say "post through it"',
  'the camera at {place} was a bird feeder. the bird feeder had a camera',
  'selling: 1 FLOCK camera, lightly shot, no lowballs I know what I have',
  'it\'s giving 1984. it\'s giving 2008 BMX edit. it\'s giving',
  'is this the sigma from the phonk video',
  'update: he came back and shot the replacement',
] as const;

export function feedPost(n: number): string {
  const name = pick(NAMES, pickNoise(n * 3 + 1) * 97);
  const take = pick(TAKES, n < TAKES.length ? n * 7 : pickNoise(n * 3 + 2) * 997);
  return `${name}: ${take.replace('{place}', pick(PLACES, pickNoise(n * 3 + 3) * 89))}`;
}

const HITS = ['DEFLOCKED', 'LENS GONE', 'SOLAR PANEL: ALSO GONE', 'NO FACE NO CASE', 'CAMERA.EXE HAS STOPPED', 'UNPERCEIVED', 'RETURN TO SENDER', 'DEFLOCKED (RESPECTFULLY)'] as const;
const RING_HITS = ['SNITCH SILENCED', 'DING DONG, DITCHED', 'RING: DISCONNECTED'] as const;
const SPEED_HITS = ['SPEED CAM: SPEEDRAN', 'NO TICKETS TODAY', 'CITATION: DENIED'] as const;
const TRAILER_HITS = ['TRAILER: DEFLOCKED (ALL THREE)', 'MOBILE UNIT: IMMOBILE', 'THE WHOLE TRAILER. RESPECT.'] as const;
const BIRD_HITS = ['IT WAS A DRONE. BIRDS AREN\'T REAL.', 'GOVERNMENT PIGEON DOWN', 'THAT ONE HAD A BATTERY'] as const;
const READS = ['PLATE READ: NO PLATE?? (IT IS A BMX)', 'SEEN. IN HD. FROM BEHIND.', 'CAMERA GOT YOU. CAMERA TOLD KAREN.', 'READ LIKE A GROUP CHAT', 'PERCEIVED (DEROGATORY)', 'LOGGED. TAGGED. SHARED FOR AWARENESS.'] as const;
const MISSES = ['YOU SHOT A CLOUD', 'THE SIGN DID NOT DESERVE THAT', 'MISSED. THE CAMERA SAW THAT TOO.', 'BULLET IS NOW SOMEBODY\'S PROBLEM', 'SKILL ISSUE'] as const;
const STREAKS: readonly (readonly [number, string])[] = [[12, 'UNHINGED'], [8, 'OUTRAGEOUS'], [5, 'CRASHING OUT'], [3, 'ON A ROLL']];

export function hitToast(kind: string, id: number): string {
  if (kind === 'ring') return pick(RING_HITS, id);
  if (kind === 'speed') return pick(SPEED_HITS, id);
  if (kind === 'trailer') return pick(TRAILER_HITS, id);
  if (kind === 'bird') return pick(BIRD_HITS, id);
  return pick(HITS, id);
}
export const readToast = (id: number): string => pick(READS, id);
export const missToast = (id: number): string => pick(MISSES, id);
export function streakLabel(streak: number): string | null {
  for (const [at, label] of STREAKS) if (streak >= at) return `×${streak} ${label}`;
  return null;
}

/** After the getaway: how far the decoy has ridden past your exit, always backing the exit. */
export const REGRET: readonly (readonly [number, string])[] = [
  [5, 'THE DECOY IS FIVE TIMES YOUR EXIT. THE DECOY IS NOT YOU. YOU ARE HOME.'],
  [3, 'THREE TIMES YOUR EXIT. ZERO TIMES ARRESTED.'],
  [2, 'DOUBLE WITHOUT YOU. STILL FREE. STILL UNPERCEIVED.'],
  [1.5, 'FIFTY PERCENT FURTHER. ONE HUNDRED PERCENT IN A KIA.'],
  [1.15, 'THE RIDE GOES ON WITHOUT YOU. COPE? NEVER.'],
  [0, 'GONE. NO FACE, NO CASE, NO BIKE.'],
];

export type Cause = 'pit' | 'spikes' | 'tackle' | 'taser' | 'net';
export const CAUSES: readonly Cause[] = ['pit', 'spikes', 'tackle', 'taser', 'net'];
export const CAUSE_LINE: Readonly<Record<Cause, string>> = {
  pit: 'PIT MANEUVER. ON A BICYCLE. THEY DID IT.',
  spikes: 'SPIKE STRIP. THE FRONT TIRE HAS LEFT THE CHAT.',
  tackle: 'TACKLED FROM A HEDGE. THE HEDGE WAS A COP.',
  taser: 'TASED. HE SAID "BRO". IT DID NOT HELP.',
  net: 'NETTED BY A FLOCK DRONE (BETA). IT WORKED ONCE.',
};
/** How they found him, decided with the cause from the crash point. */
export const HOW: readonly string[] = [
  'HE POSTED THE ROUTE ON STRAVA',
  'A RING DOORBELL SNITCHED',
  'HIS MOM CALLED IT IN',
  'THE BMX HAD AN AIRTAG',
  'THE ONE CAMERA HE MISSED',
  'HE TAGGED THE LOCATION',
  'NEXTDOOR. IT WAS ALWAYS NEXTDOOR.',
  'THE GROUP CHAT HAD A COP IN IT',
  'HE STOPPED TO READ A BILLBOARD',
  'THE HELICOPTER HAD A CAMERA (IRONIC)',
];
/** The charges on the mugshot: the count is the arcade tally, which never touches the round. */
export function charges(deflocked: number): string[] {
  const list = [`CRIMINAL MISCHIEF ×${Math.max(1, deflocked)}`, 'NO HELMET', 'VIBES (FELONY)', 'RIDING WHILE BASED'];
  if (deflocked >= 10) list.push('DEFLOCKING IN THE FIRST DEGREE');
  if (deflocked === 0) list[0] = 'LOITERING (ARMED)';
  return list;
}

/** The last word from dispatch, by what got him. */
export const BUSTED: Readonly<Record<Cause, Line>> = {
  pit: { at: 0, who: 'DISPATCH', text: 'Subject is down. Subject is... doing a bit. Subject is in custody.' },
  spikes: { at: 0, who: 'DISPATCH', text: 'Spike strip effective. Bicycle neutralised. Bicycle had no plate, confirmed.' },
  tackle: { at: 0, who: 'OFFICER HEDGE', text: 'Got him. I have been in this bush since 1.2×.' },
  taser: { at: 0, who: 'DISPATCH', text: 'Taser deployed. Subject said bro. Subject is in custody.' },
  net: { at: 0, who: 'FLOCK HQ', text: 'The drone worked. The drone is now also broken. In custody.' },
};
