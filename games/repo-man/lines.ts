/**
 * The words of Repo Man: Gary's checklist ladder keyed to the displayed multiplier, the overtime items he keeps
 * finding past 100×, what he says from the tailgate after you buy it all back, the crash's lines, the captions,
 * the stamps, and the jobs (what Gary physically does at each rung, and the checklist entry it writes).
 * Data only. Nothing here reads or changes the round's outcome.
 */
import type { Line } from './script';

export const TITLE = 'REPO MAN';

/** Gary speaks from the clipboard. The degen has no lines until the cash-out, and then only one. */
export const LADDER: Line[] = [
  { at: 1.2, who: 'gary', text: 'Hook’s on the frame. Collateral: vehicle.', cap: 'COLLATERAL: THE VIBE' },
  { at: 1.5, who: 'gary', text: 'There’s a clause for the garage door opener. It’s highlighted.' },
  { at: 1.9, who: 'gary', text: 'Up an inch. Alarm’s giving up. Battery’s the bank’s too.', cap: 'NUMBER GO UP' },
  { at: 2.3, who: 'gary', text: 'Secondary: fixtures. The hose.', cap: 'ITEMIZED' },
  { at: 2.8, who: 'gary', text: 'The TV. You were mid-paragraph. I’ll note the page.' },
  { at: 3.4, who: 'gary', text: 'The kid’s bike. …I’m adding a bow. I’m not a monster.', cap: 'GARY KNOWS' },
  { at: 4.1, who: 'fridge', text: '♪ OWNERSHIP TRANSFERRED ♪', gap: 0.3, life: 3.2 },
  { at: 5, who: 'gary', text: 'Morning.', cap: 'DIAMOND FIXTURES', life: 3, beat: 'nod' },
  { at: 6, who: 'gary', text: 'Mailbox. Your mail is my mail. Respectfully.' },
  { at: 7, who: 'gary', text: 'Sprinklers run at four. Schedule’s the bank’s now.', cap: 'THIS IS FINE' },
  { at: 8.2, who: 'neighbour', text: '…oh. It’s just Gary.', life: 3 },
  { at: 8.4, who: 'gary', text: 'Morning, Pat.', gap: 1.1, life: 2.8, beat: 'pat' },
  { at: 10, who: 'gary', text: 'Numbers. Four, oh, seven. I left you a note.', cap: 'STILL GREEN' },
  { at: 14, who: 'gary', text: 'Sign’s coming up nice this year.', cap: 'THE SIGN GREW' },
  { at: 22, who: 'gary', text: 'The porch. It was modular. Who knew.', cap: 'MODULAR PORCH' },
  { at: 36, who: 'gary', text: 'Foundation’s got a QR code. …It links to the lien.', cap: 'SCAN TO LIEN' },
  { at: 45, who: 'gary', text: 'Gutters. Long ones.' },
  { at: 60, who: 'gary', text: 'Collateralized to the frame. My load’s longer than my truck.', cap: 'TO THE FRAME' },
  { at: 100, who: 'gary', text: 'Some things you don’t tow. The vest stays.', cap: 'THE VEST STAYS' },
];

/**
 * Past the last rung, one of these comes due every 1.35× of multiplier, in order, forever. Each one is a checklist
 * entry (the `tick:` beat) that Gary writes down and ticks, and each one makes the house shudder on its slab.
 */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'gary', text: 'Wifi password. It was on the fridge. The fridge is on my truck.', cap: 'STILL ITEMIZING', beat: 'tick:Wifi password' },
  { who: 'gary', text: 'The vibe. Noted at the top. Re-noted.', beat: 'tick:The vibe (again)' },
  { who: 'gary', text: 'The dog’s name. There is no dog. Noted anyway.', beat: 'tick:Dog’s name' },
  { who: 'gary', text: 'The sunrise. Lien’s dated six a.m.', cap: 'GARY KNOWS', beat: 'tick:Sunrise' },
  { who: 'gary', text: 'The moon in the birdbath. Fixture, technically.', beat: 'tick:Moon (birdbath)' },
  { who: 'gary', text: 'The HOA vote. You abstained. The abstention’s mine now.', beat: 'tick:HOA vote' },
  { who: 'gary', text: 'Doorbell chime. Taking the sound. Leaving the button.', cap: 'NUMBER GO UP', beat: 'tick:Doorbell chime' },
  { who: 'gary', text: 'The smell of your coffee. Respectfully.', beat: 'tick:Coffee smell' },
  { who: 'gary', text: '“Number go up.” The phrase was collateral.', beat: 'tick:“Number go up”' },
  { who: 'gary', text: 'Tuesday. Not the day. The feeling.', cap: 'THIS IS FINE', beat: 'tick:Tuesday (feeling)' },
  { who: 'gary', text: 'Your high score. Basement’s in the contract.', beat: 'tick:High score' },
  { who: 'gary', text: 'The echo in the hallway. Fixtures. Page nine.', cap: 'DIAMOND FIXTURES', beat: 'tick:Hallway echo' },
];

/** Gary in the cab, by dome light, while bets are open. He writes “the vibe” down. */
export const BETTING_LINE: Omit<Line, 'at'> = { who: 'gary', text: 'Collateral: vehicle. Secondary: fixtures. Tertiary: the vibe.', cap: 'GM DEGEN' };

export const CAPTIONS = {
  waiting: 'IT IS 4:07 AM',
  /** Shown on the accepted exit, then cycled every 2.4 s while the round keeps running without you. */
  exit: ['PAID IN FULL', 'GARY’S BOY NOW', 'SOCKS AT 4 AM'],
  /** Once the multiplier is 1.5× past the exit. */
  kept: 'KEPT THE HOUSE. KEPT GARY.',
  /** The crash, cycled every 1.6 s while the aftermath holds. */
  crash: ['DEV SOLD', '407 DAYS LATE', 'FRONT DOOR’S GONE', 'NGMI'],
  dodged: 'RUG DODGED — HOOK NEVER TIGHTENED',
  watched: 'YOU WATCHED GARY WORK',
};

/** The degen’s one line, when he reaches Gary in his socks. */
export const DEGEN_LINE: Omit<Line, 'at'> = { who: 'degen', text: 'WAIT. I sold. I’m buying it all back.', life: 3.2 };
/** Gary’s side of the deal, keyed to seconds after the exit. */
export const DEAL_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [4.6, { who: 'gary', text: 'Paid in full. Hook’s off.' }],
  [7.4, { who: 'gary', text: 'Referral code GARY-407. Ten percent off your next repo.' }],
];

/** What Gary says from the tailgate after the exit, keyed to how far past the exit the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.5, { who: 'gary', text: 'Chart’s still green up there. You did fine, kid.' }],
  [2, { who: 'gary', text: 'Coffee’s hot. Thermos is mine, before you ask.' }],
  [3, { who: 'gary', text: 'Lawn looks good. Not my lawn. Not my department.' }],
  [5, { who: 'gary', text: 'House is settling. One board at a time. That’s normal.' }],
  [10, { who: 'gary', text: 'Sprinklers are on a timer. Also not my department.' }],
  [25, { who: 'gary', text: 'Should’ve stayed up there? Then I’d have your door.' }],
];
/** Past the last regret line, one of these every 1.35× past the exit, forever. */
export const AFTER: Omit<Line, 'at'>[] = [
  { who: 'gary', text: 'Neighbour’s light again. Everyone knows Gary.' },
  { who: 'gary', text: 'Sun’s up in two hours. I’m gone in one.' },
  { who: 'gary', text: 'Want a coffee? It’s a thermos lid, but it’s clean.' },
  { who: 'gary', text: 'I’ve got a form for this. I don’t need it.' },
  { who: 'gary', text: 'Lawn’s never looked better.' },
  { who: 'gary', text: 'Still green up there. Still not my department.' },
];

/** The crash's lines, keyed to seconds of crashAge. */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [1.25, { who: 'gary', text: 'Front door. Fixtures. It was on the list the whole time.' }],
  [3.3, { who: 'gary', text: 'Have a good one.', life: 2.4 }],
];
/** The same take played small, from the tailgate, after an exit. */
export const DODGED_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [0.9, { who: 'gary', text: 'Chart went red. You’re down here. Good call.' }],
  [3.1, { who: 'gary', text: 'Hook never tightened.', life: 2.6 }],
];

export const STAMP = { rekt: 'REPOSSESSED', dodged: 'KEPT THE DOOR', watched: 'JUST GARY' } as const;

export type ItemId = 'hose' | 'tv' | 'bike' | 'fridge' | 'mailbox' | 'numbers' | 'porch' | 'gutter';
export type JobKind = 'hook' | 'opener' | 'lift' | 'load' | 'wave' | 'note' | 'qr' | 'vest' | ItemId;

/**
 * What Gary does at each rung, in order: walk to it, take it, carry it to the flatbed, heave it onto the stack.
 * `entry` is the checklist line he writes when it comes due; it is ticked when the job is done (`open` entries
 * are written and left unticked).
 */
export const JOBS: { at: number; kind: JobKind; entry?: string; open?: boolean }[] = [
  { at: 1.2, kind: 'hook', entry: 'Vehicle (lime, leased)' },
  { at: 1.5, kind: 'opener', entry: 'Garage door opener' },
  { at: 1.9, kind: 'lift' },
  { at: 2.05, kind: 'load' },
  { at: 2.3, kind: 'hose', entry: 'Garden hose' },
  { at: 2.8, kind: 'tv', entry: 'TV (mid-paragraph)' },
  { at: 3.4, kind: 'bike', entry: 'Kid’s bike (+ bow)' },
  { at: 4.1, kind: 'fridge', entry: 'Smart fridge' },
  { at: 5.4, kind: 'wave' },
  { at: 6, kind: 'mailbox', entry: 'Mailbox (not the post)' },
  { at: 7, kind: 'note', entry: 'Sprinkler schedule' },
  { at: 10, kind: 'numbers', entry: 'House numbers 4·0·7' },
  { at: 22, kind: 'porch', entry: 'Porch (modular?)' },
  { at: 36, kind: 'qr', entry: 'Foundation → lien' },
  { at: 45, kind: 'gutter', entry: 'Gutters' },
  { at: 60, kind: 'note', entry: 'The structure' },
  { at: 100, kind: 'vest', entry: 'The vest (stays)', open: true },
];
