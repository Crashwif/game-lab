/**
 * Everything Flock Off says: a ladder of lines keyed to the displayed multiplier (never to the crash),
 * overtime lines that keep coming in long rounds, the Nextdoor feed that never runs out, the toasts for
 * what the gun does, the regret ladder after the getaway, and the causes, charges and cards of the bust.
 */
export interface Line { at: number; who: string; text: string }

/** Half of all rounds end before 2×, so the early lines come a few seconds apart. */
export const LINES: readonly Line[] = [
  { at: 1, who: 'NARRATOR', text: 'One man. One BMX. Versus a $4B bipartisan surveillance state.' },
  { at: 1.08, who: 'GROUP CHAT', text: 'bro is single-handedly auditing the municipal police budget' },
  { at: 1.18, who: 'KAREN W. (NEXTDOOR)', text: 'Male in ALL BLACK near my “All Are Welcome Here” sign! Armed response!!' },
  { at: 1.3, who: 'DISPATCH', text: 'All units, suspect is on a Huffy. Deploy the BearCat armored vehicle.' },
  { at: 1.45, who: 'FLOCK HQ', text: 'He shot camera four, camera seven, and the Palantir cloud uplink.' },
  { at: 1.62, who: 'GROUP CHAT', text: 'he’s got liberals and libertarians uniting in the replies' },
  { at: 1.8, who: 'DISPATCH', text: 'Running his plate—Command, the bicycle still does not have a license plate.' },
  { at: 2, who: 'NARRATOR', text: 'Two times. The HOA just declared martial law over a cul-de-sac.' },
  { at: 2.25, who: 'KAREN W. (NEXTDOOR)', text: 'He shot my Ring camera! How will Amazon know when my packages arrive?!' },
  { at: 2.55, who: 'FLOCK HQ', text: 'We sold his metadata to ICE, the IRS, and Target, and none of them can find him.' },
  { at: 2.9, who: 'GROUP CHAT', text: 'mans is doing Edward Snowden numbers on a 20-inch frame' },
  { at: 3.3, who: 'DISPATCH', text: 'Scrambling the DHS Predator drone. Yes, for a guy doing bunny hops.' },
  { at: 3.8, who: 'CHANNEL 4', text: 'Fox calls him Antifa, MSNBC calls him Sovereign Citizen, he’s just vibing.' },
  { at: 4.5, who: 'CITY COUNCIL', text: 'Bipartisan vote passed: defund the library, buy 400 more AI cameras!' },
  { at: 5.3, who: 'GROUP CHAT', text: 'five times. the Fourth Amendment just stood up and saluted.' },
  { at: 6.5, who: 'FLOCK HQ', text: 'Our Series D valuation is tanking! Somebody boot that bicycle!' },
  { at: 8, who: 'DISPATCH', text: 'The SWAT chopper is burning $8,000 an hour watching a guy do a manual.' },
  { at: 10, who: 'NARRATOR', text: 'Ten times. Big Brother is now hiding behind a bush.' },
  { at: 13, who: 'KAREN W. (NEXTDOOR)', text: 'Brad has his “Don’t Tread On Me” flag AND he’s begging the feds for a tank!' },
  { at: 17, who: 'GROUP CHAT', text: 'touch grass? he liberated the whole HOA subdivision.' },
  { at: 22, who: 'THE FEDS', text: 'Sir, if you stop shooting our cameras we’ll offer you a CIA job.' },
];

/** Past the ladder, a line every 1.35× of multiplier, in turn, for as long as the ride lasts. */
export const OVERTIME: readonly Line[] = [
  { at: 0, who: 'DISPATCH', text: 'Still pedaling. Still shooting. Our Pentagon surplus MRAP is stuck in a roundabout.' },
  { at: 0, who: 'FLOCK HQ', text: 'We are installing cameras on the cameras to protect the cameras.' },
  { at: 0, who: 'GROUP CHAT', text: 'both political parties hate him because they both funded the cameras' },
  { at: 0, who: 'NARRATOR', text: 'Zero digital footprint. One hundred percent BMX cardio.' },
  { at: 0, who: 'CHANNEL 4', text: 'Ratings are up 400%. Do not arrest him before the pharmaceutical ads!' },
  { at: 0, who: 'KAREN W. (NEXTDOOR)', text: 'He didn’t even use the bike lane! That’s literally terrorism!' },
  { at: 0, who: 'THE FEDS', text: 'We tried to freeze his bank account and found $4.12 and a Dave & Buster’s card.' },
  { at: 0, who: 'GROUP CHAT', text: 'ungovernable. unperceived. unbothered. moisturized. in his lane.' },
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
  'did anyone else hear gunshots near {place} or was that my property value dropping',
  'SUSPICIOUS male on bicycle by {place}, wearing a hoodie in MY tax bracket',
  'he shot the AI camera by {place}. now who will report unmowed lawns?!',
  'I have a “Don’t Tread On Me” sticker AND I want the National Guard at {place} NOW',
  'based and fourth-amendment-pilled',
  'I saw him at {place}. he popped a wheelie over the thin blue line',
  'the surveillance tower at {place} is down, I am literally shaking into my Stanley cup',
  'my Ring doorbell snitched to 14 federal agencies and then he shot it',
  'has anyone checked if he’s funded by Soros, Elon, or Big Bicycle',
  'he rode past {place} without a permit. why do we even pay HOA dues',
  'the BMX has no license plate. I called my congressman and the FBI',
  'the police helicopter woke my doodle. the doodle is radicalized now',
  'skill issue (the $2M municipal surveillance contract)',
  'reminder that {place} is a SAFE SPACE under 24/7 biometric tracking',
  'both sides of the aisle agree: we need Patriot missiles at {place}',
  'ratio + deflocked + no plate + warrantless surveillance L',
  'to the man in black: my husband says you’re a menace, my son says you’re the GOAT',
  'emergency HOA tribunal at {place}. bring your own pitchfork and charcuterie',
  'police say “shelter in place.” I say “post his horoscope on Nextdoor”',
  'the bird feeder at {place} was an NSA listening post and he knew it',
  'selling: 1 lightly perforated Palantir camera, city paid $15k, asking $40 OBO',
  'it’s giving 1984 meets X-Games 2004',
  'is this praxis or just a guy on Monster Energy',
  'update: the city installed a replacement at {place} and he 360-no-scoped it',
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
