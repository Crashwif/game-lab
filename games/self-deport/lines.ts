/**
 * Every word in the game. Captions are keyed to the displayed multiplier and fire with what they name; the
 * overtime lists keep a long round talking; nothing here reads or hints at the crash point. Both sides of
 * the street get it: the right wants his labor, the left wants his selfie, both want the photo, nobody
 * wants the guy.
 */
export const TITLE = 'SELF-DEPORT';
export const SUBTITLE = 'MEMO VS. THE QUOTA';

/** A beat every few seconds through the window where most rounds end, then rarer, forever. */
export const CAPTIONS: [number, string][] = [
  [1, 'ANOTHER DAWN. ANOTHER LAWN.'],
  [1.08, 'LEAF BLOWER AT 6 AM. THIS IS THE CRIME.'],
  [1.18, 'THE DOORBELL IS WATCHING. IT ALWAYS WAS.'],
  [1.28, 'THE “DEPORT ’EM ALL” TRUCK NEEDS SIX GUYS MONDAY. CASH.'],
  [1.35, 'TIP LINE: “A GUY. WITH A LEAF BLOWER.” THAT IS THE WHOLE TIP.'],
  [1.55, 'AN UNMARKED VAN. THEY ARE ALL UNMARKED. THAT IS THE MARK.'],
  [1.7, 'AN ALLY APPEARS. SHE WILL HIDE YOU FOR $5 AND THE LAWN.'],
  [1.8, 'A MAN IN A GAITER. IN JULY. NEWSPAPER UPSIDE DOWN.'],
  [2.05, 'A DRONE. FOR THE LEAF BLOWER.'],
  [2.22, 'A PROTESTER WANTS YOU IN THE SHOT. LOOK SCARED. FOR THE ALGORITHM.'],
  [2.4, 'A CRUISER. SLOWING DOWN…'],
  [2.62, '…HE IS ON HIS PHONE. GO. GO. GO.'],
  [2.85, 'FACIAL RECOGNITION: 100% MATCH. ALSO 100% MATCH ON EVERYONE.'],
  [3.05, 'THE FARMER WANTS AN EXCEPTION FOR HIS GUYS. HIS GUYS ARE YOU.'],
  [3.3, 'THEY GOT A TOURIST. FROM IOWA. HE HAD A TAN.'],
  [3.6, 'THE NGO DROPPED PAMPHLETS. THE PAMPHLETS SAY: DONATE.'],
  [3.9, 'A HELICOPTER. THE BUDGET IS $170 BILLION. THIS IS WHERE IT WENT.'],
  [4.25, 'A BIPARTISAN PHOTO-OP. BOTH WANT THE PHOTO. NEITHER WANTS THE GUY.'],
  [4.6, 'THE NATIONAL GUARD HAS ARRIVED. THEY ARE DIRECTING TRAFFIC.'],
  [5, 'A COEXIST BUMPER STICKER AT 90 MPH. SOLIDARITY HAS PLACES TO BE.'],
  [5.4, 'THAT IS AN ALLIGATOR. ON A LEASH. FEDERALLY.'],
  [6.3, '2.4 MILLION WATCHING LIVE. ONE OF THEM IS DUETTING.'],
  [6.8, 'THE FLAG GUY SAYS MEMO IS ONE OF THE GOOD ONES. THURSDAYS.'],
  [7.5, 'A JUDGE SAID STOP. THE PAPER GOT SHADOW-DOCKETED.'],
  [8.2, 'A LAND ACKNOWLEDGMENT. THE LAND SAYS NOTHING. IT IS A HOME DEPOT.'],
  [9, 'MEMO FROM HQ: QUOTA IS NOW 3,000 A DAY. DETAIN SOMETHING.'],
  [10, 'CABLE NEWS: BOTH PANELS ARE OUTRAGED. BOTH ARE SPONSORED BY A MATTRESS.'],
  [11, 'THEY DETAINED A MARIACHI BAND MID-SONG. THE SONG CONTINUES.'],
  [12.5, 'TWO RALLIES. SAME PARKING LOT. SAME PHONE PLAN.'],
  [14, 'COUSIN’S TACO TRUCK: SANCTUARY, WITH SALSA.'],
  [18, 'THE AGENTS HAVE DETAINED EACH OTHER. MASKS LIMIT VISIBILITY.'],
  [25, 'HE HAS BEEN HERE 19 YEARS. THE VAN HAS BEEN HERE 19 MINUTES.'],
  [40, 'THE QUOTA IS NOW “YES”.'],
  [100, 'RAN SO LONG HE QUALIFIES FOR CITIZENSHIP. (HE DOES NOT.)'],
  [1000, 'STILL RUNNING. THE LAWNS ARE FOUR FEET TALL. AMERICA WEEPS.'],
];

/** Past 45 seconds, one every 12 seconds, around and around. */
export const OVERTIME_CAPTIONS = [
  'THE RUN IS A LIFESTYLE NOW',
  'THE RIGHT WANTS HIS LABOR. THE LEFT WANTS HIS SELFIE. HE WANTS TUESDAY OFF.',
  'THE VAN RAN OUT OF GAS. GAS IS $5.',
  'DEPORT THEM ALL (EXCEPT THE ONES WHO BUILT THE DECK)',
  'BREAKING: LANDSCAPER AT LARGE, ARMED WITH A STIHL',
  'NO HUMAN IS ILLEGAL (BUT THIS LAWN IS $5)',
  'CITY COUNCIL VOTES TO NOT COOPERATE. NOTHING CHANGES.',
  'EVERYONE HERE IS FILMING. NOBODY HERE IS HELPING.',
  'A SECOND LEAF BLOWER HAS BEEN DEPLOYED',
  'THE FLAG GUY AND THE SIGN LADY SHARE A LANDSCAPER. IT IS MEMO.',
  'THE DRONE IS DUETTING THE TIKTOK',
  'BOTH SIDES AGREE: THE OUTRAGE IS 6 TO 7 PM, SPONSORED.',
  'DETAINED SO FAR: A CACTUS, A COSTCO HOT DOG, A SHADOW',
  'THE RALLY ENDED. THE PARKING LOT IS STILL FULL OF HIS CLIENTS.',
  'HE HAS MOWED 40 LAWNS WHILE FLEEING. INVOICES SENT.',
  'THE ALLIGATOR HAS UNIONIZED',
  'STILL HERE. STILL BLOWING LEAVES.',
];

/** What Memo mutters while he runs, by nerves. */
export const RUN_BUBBLES: [number, string][] = [
  [0.2, 'just blowing leaves.'],
  [0.42, 'free country. mostly.'],
  [0.62, 'i pay taxes. ITIN. look it up.'],
  [1, 'nineteen years, bro.'],
];
export const HIGH_BUBBLES = ['nineteen years, bro.', 'i have a court date. thursday.', 'my kids were born here.', 'not today, quota.', 'the right wants my labor. the left wants my selfie.', 'i want tuesday off.', 'the lawns. think of the lawns.', 'everyone’s filming. nobody’s helping.'];
export const OVERTIME_BUBBLES = ['the lawns need me.', 'cousin says the truck is open.', 'my knees are a sanctuary city.', 'can’t catch what you can’t see.', 'the stipend is $1,000. i make that by thursday.', 'gas, groceries, go.', 'both sides owe me for june.'];
export const CONE_BUBBLES = ['soy un cono.', 'infrastructure. move along.', 'not a person. a cone.', '…cone noises.'];
export const MOW_BUBBLES = ['$5. for the lawn. and my dignity.', 'yes ma’am. the hedges too.', 'nobody sees the help.', 'she’s filming me. for awareness.', 'venmo. sure. “venmo”.'];
export const SCARE_BUBBLE = '…act natural.';

/** The verdict stamps a sweep leaves: seen through the cone, or not; or hidden behind the ally's sign. */
export const UNSEEN = ['UNSEEN', 'INFRASTRUCTURE', 'JUST A CONE', 'NOT A PERSON', 'CONE CLEARED'];
export const SPOTTED = ['SPOTTED!', 'THAT CONE HAS EYES', 'A CONE. RUNNING.', 'HE BLINKED', 'CONE DENIED'];
export const ALLY_UNSEEN = ['NOBODY SEES THE HELP', 'THE HELP IS INVISIBLE', 'SIGN-BLOCKED', 'ALLY SHIELD: $5', 'LANDSCAPING: CLOAKED'];

/**
 * The ally hides him behind her yard sign while he does her lawn. The price is $5. The price is never $5.
 * One line per use, in order, around again.
 */
export const BARGAINS = [
  'hide behind me. $5 for the lawn. cash.',
  '$5 but also the hedges. and the gutters.',
  'ok $4. inflation. you understand.',
  'exposure? i have 300 followers. 40 are bots.',
  'i’ll pay you in a land acknowledgment.',
  'can i post you? for awareness. don’t smile.',
  'my HOA says you can’t park here. so, $3.',
  'venmo’s down. next time. (there is no next time)',
  'i marched for you. in 2017. once.',
  'would you take a kombucha? it’s unpasteurized.',
  'my husband votes the other way. he also needs the lawn.',
  'this is what an ally looks like. $2.',
];
export const ALLY_SIGN = ['IN THIS HOUSE', 'WE BELIEVE', 'NO HUMAN', 'IS ILLEGAL', '$5 LAWNS'];
export const ALLY_FEE = 'ALLY FEE';

/** The betting phase, before the round runs. */
export const BETTING_CAPTION = 'JOIN THE RUN. SELF-DEPORT = CASH OUT. CAUGHT = ROUND OVER.';
export const WAITING_CAPTION = 'MEMO IS STRETCHING. THE QUOTA IS NOT.';
export const HINT = '↓ / TAP: CONE MODE · ↑ / SWIPE UP: ALLY ($5)';

/** The fake outrage index: both needles pinned, help at nothing. */
export const METER = { title: 'FAKE OUTRAGE INDEX · SPONSORED BY A MATTRESS', left: 'LEFT', right: 'RIGHT', help: 'ACTUAL HELP' };

/** After an accepted self-deportation the street keeps running without him; the caption keeps score, always on his side. */
export function relief(ratio: number): string {
  return ratio < 1.25 ? 'TOOK THE STIPEND. CLEAN HANDS. CLEAN LAWN.'
    : ratio < 2 ? 'THE VAN SHOWED UP LATER. HE IS AT THE BEACH.'
    : ratio < 4 ? 'OPENED A LANDSCAPING EMPIRE BACK HOME. THE ALLY’S LAWN IS FOUR FEET TALL.'
    : 'AMERICA’S LAWNS ARE FOUR FEET TALL. HE IS NOT COMING BACK.';
}
export const EXIT_BUBBLES = ['$1,000? …sure.', 'adiós, lawns.', 'water the plants.', 'who’s doing her lawn now? not me.', 'voluntary. “voluntary”.'];
export const NOTE = ['GONE HOME.', 'WATER THE PLANTS.'];
/** The app on his phone. Not a real app. Please. */
export const PHONE = { app: 'ICE HOME™', line1: 'SELF-DEPORT', line2: 'GET $1,000*', fine: '*terms: lol', button: 'TAP TO LEAVE' };

export function crashCaption(x: number, cashed: boolean, staked: boolean): string {
  if (cashed) return 'DODGED. THE NOTE SAYS: GONE HOME. WATER THE PLANTS.';
  if (x <= 1.01) return 'CAUGHT BEFORE THE FIRST LEAF. QUOTA MET.';
  return staked ? `CAUGHT AT ${x.toFixed(2)}×. WARRANT: ADMINISTRATIVE (THEY SIGNED IT THEMSELVES).` : `CAUGHT AT ${x.toFixed(2)}×. YOU WATCHED. MEMO IS IN LOUISIANA NOW.`;
}

export const STAMP = {
  caught: { small: 'ICE · ENFORCEMENT & REMOVAL · QUOTA +1', big: 'DETAINED' },
  dodged: { small: 'ICE · NOTICE UNSERVED', big: 'NOBODY HOME' },
};

/** The blue screen. The game crashes because the round did. */
export const BSOD = {
  face: ':(',
  body: ['Memo ran into a problem and needs to be removed.', 'We’re just collecting some error info, and then', 'we’ll start over for you. The bus is already running.'],
  stuck: 37,
  code: 'Stop code: DUE_PROCESS_NOT_FOUND',
  failed: 'What failed: FOURTH_AMENDMENT.SYS',
  more: 'For more information about this issue, call the tip line. The tip line is you.',
  qr: 'scan for a lawyer (jk)',
};
