/**
 * The forks and what God says about them. A dilemma names who stands on each branch and what He says when
 * each side is taken; the ladder climbs from strangers to your own doubles, and an overtime generator keeps
 * composing forks from the cast once the ladder is spent. Rung lines key to the displayed multiplier. Nothing
 * here reads or changes the round's outcome.
 */
import type { Kind } from './cast';
import type { Line, Who } from './script';

export type Side = 'up' | 'down';
export interface Dilemma {
  /** The card's question. */
  prompt: string;
  up: Kind[];
  down: Kind[];
  /** What God says when that branch is taken by the player, and by the machine. */
  you: Record<Side, string>;
  auto: Record<Side, string>;
}

export const NAMES: Record<Who, string> = { god: 'GOD', intern: 'THE INTERN (COVERING FOR GOD)' };
/** Past this multiplier God has left the building and the intern covers. */
export const INTERN_AT = 30;

const five = (k: Kind): Kind[] => [k, k, k, k, k];
const three = (k: Kind): Kind[] => [k, k, k];

/** The ladder, in the order the forks arrive. */
export const LADDER: Dilemma[] = [
  {
    prompt: 'The control group. Five strangers above, one stranger below. Nobody is special.',
    up: five('stranger'), down: ['stranger'],
    you: { up: 'Five. You had the lever and sent it up. The one below is unsure whether to thank you.', down: 'One stranger. Textbook. You have done this before, in a comment section.' },
    auto: { up: 'AUTO-ETHICS.DLL sent it up on its first fork. It had a reason. It will not say.', down: 'AUTO-ETHICS.DLL took the smaller number. Fewer bodies is all it knows. It is not much.' },
  },
  {
    prompt: 'A robot that learned to pray yesterday. A stranger who never bothered.',
    up: ['robot'], down: ['stranger'],
    you: { up: 'The robot was mid-prayer. To Me. I heard it. It was better than most of yours.', down: 'You spared the machine and took the man. The machine has filed that under “precedent.”' },
    auto: { up: 'AUTO-ETHICS.DLL took the robot. Professional courtesy, it says. I do not think it means it.', down: 'AUTO-ETHICS.DLL spared the robot. A machine chose the machine. Think about why.' },
  },
  {
    prompt: 'Your mother. Five people who are, individually, nicer than your mother. I was there; don’t argue.',
    up: ['mother'], down: five('influencer'),
    you: { up: '…\n\nI am not going to say anything. I am just going to remember.', down: 'Five nicer people, so your mother could ask why you look thin. She is asking now.' },
    auto: { up: 'AUTO-ETHICS.DLL sent it at your mother. Fewer bodies. It will not be coming to the holidays.', down: 'AUTO-ETHICS.DLL spared your mother and took five. It does not love her. It just counts.' },
  },
  {
    prompt: 'The man who invented this scenario. Five people who paid to hear him explain it.',
    up: ['professor'], down: five('student'),
    you: { up: 'The professor. His students will write the paper. You will not be credited.', down: 'Five students with their hands up. The professor has already turned it into a lecture.' },
    auto: { up: 'AUTO-ETHICS.DLL took the professor. It read his paper. It disagreed.', down: 'AUTO-ETHICS.DLL took five students. Tuition was non-refundable either way.' },
  },
  {
    prompt: 'A billionaire who has promised to end hunger fourteen times. Five people he promised it to.',
    up: ['billionaire'], down: five('stranger'),
    you: { up: 'The billionaire. His foundation is suing the trolley, the lever and the concept of hunger.', down: 'Five people. He posted “thoughts and prayers,” then “who wants to buy a trolley.”' },
    auto: { up: 'AUTO-ETHICS.DLL took the billionaire. It has never been offered a seat on a board. Now it never will.', down: 'AUTO-ETHICS.DLL spared the billionaire. He has promised to pay it. Fourteen times.' },
  },
  {
    prompt: 'A cow on its way to a sanctuary. Five podcasters on their way to record an episode about ethics.',
    up: ['cow'], down: five('podcaster'),
    you: { up: 'The cow was the only innocent on either track and you gave it the trolley. The episode has four stars.', down: 'Five podcasters. The cow will never think about this, because it is a cow, and it is happy.' },
    auto: { up: 'AUTO-ETHICS.DLL took the cow. It does not count cows as bodies. I do.', down: 'AUTO-ETHICS.DLL took five podcasters for a cow. Honestly, it might be learning.' },
  },
  {
    prompt: 'The trolley’s lawyer. The man who invented the trolley. Only one of them can bill for this.',
    up: ['lawyer'], down: ['inventor'],
    you: { up: 'The lawyer. The trolley is unrepresented now. It has never looked happier.', down: 'The inventor, under his own invention. The patent office is filing that under “irony.”' },
    auto: { up: 'AUTO-ETHICS.DLL took the lawyer. It was advised not to. It did it anyway.', down: 'AUTO-ETHICS.DLL took the inventor. It called it “a root-cause fix.”' },
  },
  {
    prompt: 'The intern, holding the manual. Your insurance adjuster, holding your dental plan.',
    up: ['intern'], down: ['adjuster'],
    you: { up: 'The intern. The manual survived. It is wetter than before. Nobody will ever know why.', down: 'The adjuster. Your premium went up anyway. It always does. That is the one rule he kept.' },
    auto: { up: 'AUTO-ETHICS.DLL took the intern. Unpaid, it said. Off the books. I am writing that down.', down: 'AUTO-ETHICS.DLL took the adjuster. The claim was denied before he landed.' },
  },
  {
    prompt: 'A politician. You don’t know the party. You will never know the party. Five undecided voters.',
    up: ['politician'], down: five('voter'),
    you: { up: 'The politician. Both parties claimed them. A statue was proposed, cancelled and proposed again.', down: 'Five undecided voters. The election is unchanged. It was always going to be unchanged.' },
    auto: { up: 'AUTO-ETHICS.DLL took the politician without asking the party. It is better than you at this.', down: 'AUTO-ETHICS.DLL took five voters. It is not registered to vote. It has opinions anyway.' },
  },
  {
    prompt: 'A crypto bro who has been explaining the lever for forty minutes. Five people who asked him to stop.',
    up: ['bro'], down: five('stranger'),
    you: { up: 'The bro stopped mid-sentence. The sentence was “but actually.” I would call that natural causes.', down: 'Five people who asked him to stop. He has not stopped. He has not noticed.' },
    auto: { up: 'AUTO-ETHICS.DLL took the bro. It listened to the whole explanation first. It still did it.', down: 'AUTO-ETHICS.DLL took the five. It says the bro “had more engagement.” I am deleting it later.' },
  },
  {
    prompt: 'Me. I tied Myself to the top track to see what you would do. Five strangers below. If you take Me, nobody judges you.',
    up: ['god'], down: five('stranger'),
    you: { up: 'Just kidding. Omnipresent. That was a body double. He had a family. Nothing can get you out of this.', down: 'Five strangers, to spare a being who cannot be spared or harmed. Sycophant. I love it.' },
    auto: { up: 'AUTO-ETHICS.DLL sent the trolley at Me. One body. It has no concept of Me. Neither do you; you let it choose.', down: 'AUTO-ETHICS.DLL spared Me. It counted Me as five. That is the nicest thing a machine has ever done.' },
  },
  {
    prompt: 'You, grown this morning from a swab, confused about what day it is. Five better versions of you.',
    up: ['you'], down: five('better'),
    you: { up: 'You took yourself out. Five better versions live and will not call. That is the real lesson.', down: 'You took out every version of yourself that made good decisions. Consistent, at least.' },
    auto: { up: 'AUTO-ETHICS.DLL took you. It had the option. It did not hesitate. Remember that.', down: 'AUTO-ETHICS.DLL took the five better yous and kept the original. It has low standards. So, apparently, does the universe.' },
  },
  {
    prompt: 'Everyone from the forks so far, back for a second round. Nobody at all: an empty track.',
    up: ['ghost', 'ghost', 'ghost', 'ghost', 'ghost'], down: ['nobody'],
    you: { up: 'All of them, again. You had an empty track and you chose the full one. I have no rule for this. I am going to make one.', down: 'The empty track. Correct. Also the easiest decision you have made all round. Both of those are going in the Book.' },
    auto: { up: 'AUTO-ETHICS.DLL went up. Five ghosts counted as zero on its spreadsheet. They did not count as zero to them.', down: 'AUTO-ETHICS.DLL found the empty track. Zero bodies. It is extremely pleased with itself.' },
  },
];

/** The cast the overtime generator draws from, with how many stand together and what it is for. */
export const POOL: { kind: Kind; counts: number[]; one: string; many: string; tag: string }[] = [
  { kind: 'stranger', counts: [1, 3, 5], one: 'stranger', many: 'strangers', tag: 'who never heard of you' },
  { kind: 'robot', counts: [1, 3], one: 'robot', many: 'robots', tag: 'that learned to pray this morning' },
  { kind: 'influencer', counts: [3, 5], one: 'influencer', many: 'influencers', tag: 'filming this' },
  { kind: 'podcaster', counts: [3, 5], one: 'podcaster', many: 'podcasters', tag: 'recording this' },
  { kind: 'lawyer', counts: [1, 3], one: 'lawyer', many: 'lawyers', tag: 'billing for this' },
  { kind: 'inventor', counts: [1], one: 'inventor', many: 'inventors', tag: 'who built the trolley' },
  { kind: 'intern', counts: [1, 3], one: 'intern', many: 'interns', tag: 'with the wet manual' },
  { kind: 'adjuster', counts: [1], one: 'insurance adjuster', many: 'insurance adjusters', tag: 'who voided your dental' },
  { kind: 'politician', counts: [1, 3], one: 'politician', many: 'politicians', tag: 'of a party you cannot see' },
  { kind: 'voter', counts: [3, 5], one: 'undecided voter', many: 'undecided voters', tag: 'still deciding' },
  { kind: 'bro', counts: [1, 3], one: 'crypto bro', many: 'crypto bros', tag: 'explaining the lever' },
  { kind: 'billionaire', counts: [1], one: 'billionaire', many: 'billionaires', tag: 'with fourteen promises' },
  { kind: 'cow', counts: [1, 3], one: 'cow', many: 'cows', tag: 'on the way to a sanctuary' },
  { kind: 'better', counts: [3, 5], one: 'better you', many: 'better yous', tag: 'who would have chosen faster' },
];
export const OVERTIME_PROMPTS = [
  'Above: {up}. Below: {down}. The lever does not care which.',
  '{up} on the top track, {down} on the bottom. The difference is a number.',
  'Fork {n}. {up} above, {down} below. You have done this before. You will do it again.',
  '{up}. {down}. I stopped writing these down at the last fork. I am lying. I write everything down.',
];
export const OVERTIME_YOU: Record<Side, string[]> = {
  up: ['Up. {up}. You did not even read the card. I did.', 'The top track. {up}. The bottom track is sending flowers.', 'Up again. {up}. At some point this stops being ethics and becomes a commute.'],
  down: ['Down. {down}. The top track breathes out.', 'The bottom track. {down}. The top track has started a group chat about you.', 'Down. {down}. I counted. I always count.'],
};
export const OVERTIME_AUTO: Record<Side, string[]> = {
  up: ['AUTO-ETHICS.DLL went up: {up}. Fewer bodies, it says. It is usually right. That is the problem.', 'The machine chose the top track. {up}. It did not hesitate. It never does.'],
  down: ['AUTO-ETHICS.DLL went down: {down}. It has a spreadsheet. The spreadsheet is wet now too.', 'The machine chose the bottom track. {down}. It looked at its phone first. I saw.'],
};

export const OPENING: Omit<Line, 'at'>[] = [
  { who: 'god', text: 'A trolley. A lever. Forks, as many as the round lasts. Up or down at each one; the machine throws it if you do not.' },
  { who: 'god', text: 'Every fork you survive pays more. Every fork, I get a little less patient. Cash out to walk away from the lever. The forks keep coming without you.' },
];
export const WAITING: Omit<Line, 'at'>[] = [{ who: 'god', text: 'No trolley yet. There is always a trolley. Stretch.' }];

/** Rung lines, few enough that the forks keep the floor. */
export const RUNGS: Line[] = [
  { at: 1.12, who: 'god', text: 'The trolley is moving. It is always moving. The first fork is closer than it looks.' },
  { at: 2, who: 'god', text: 'Half of all rounds end before this. The forks come faster now. So does the paperwork.' },
  { at: 3.5, who: 'god', text: 'Your hand is sweating on My lever. I made hands. I know what that means.' },
  { at: 6, who: 'god', text: 'This stopped being an ethics problem a while ago. Now it is a commute.' },
  { at: 10, who: 'god', text: 'I have started the paperwork. Every switch you threw is in it. Every one you let the machine throw, too.' },
  { at: 18, who: 'god', text: 'The forks are arriving faster than you can read them. The machine can read them. That is not a compliment.' },
  { at: INTERN_AT, who: 'god', text: 'I have left the building. The intern is covering. Be nice to them. I will not be.' },
  { at: 55, who: 'intern', text: 'hi!! um. God left. He said to tell you “press it.” i don’t know what that means. do you?' },
  { at: 100, who: 'intern', text: 'found the button. it’s big. it’s red. it says MORAL_EXCEPTION on it. do i just… press it?' },
];
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'intern', text: 'still pressing. it’s not doing anything. the forks keep coming. is this normal?' },
  { who: 'intern', text: 'i found another manual. it’s also wet. why are they all wet.' },
  { who: 'intern', text: 'God texted. He sent a thumbs up. i don’t know what that means either.' },
  { who: 'intern', text: 'i’m going to go sit in the trolley. it seems like the safest place. nobody is ever in the trolley.' },
];

/** The first time the player takes the lever from the machine. */
export const TAKEN: Omit<Line, 'at'> = { who: 'god', text: 'Oh. You are driving now. I was getting used to the machine. The machine never hesitates. You will.' };
/** The player hands the lever back. */
export const HANDED_BACK: Omit<Line, 'at'> = { who: 'god', text: 'Back to the machine. It will do what you did, only faster, and it will not lie awake about it.' };
/** A confirmed cash-out: the player walks away from the lever. */
export const WALKED = (x: string): Omit<Line, 'at'> => ({ who: 'god', text: `You walked away from the lever at ${x}. AUTO-ETHICS.DLL has it now. The forks do not stop. They never needed you.` });
export const WALKED_LATE = (x: string): Omit<Line, 'at'> => ({ who: 'god', text: `You walked away at ${x}, I am told. The machine has been throwing the switches since. It is doing fine. That is the worst part.` });
export const REGRET: { at: number; line: Omit<Line, 'at'> }[] = [
  { at: 1.6, line: { who: 'god', text: 'It kept climbing after you left. The machine took two more forks for the number you walked with.' } },
  { at: 3, line: { who: 'god', text: 'You could have had three times as much and only a slightly worse Book. The Book is the cheap part.' } },
  { at: 8, line: { who: 'god', text: 'Everyone still at a lever has eight times what you took. Most of them are about to find out why.' } },
];

export type Outcome = 'rekt' | 'dodged' | 'watched';
export const CRASH_LINES: Record<Outcome, [at: number, line: Omit<Line, 'at'>][]> = {
  rekt: [
    [0.05, { who: 'god', text: 'Ah.' }],
    [0.8, { who: 'god', text: 'Both tracks. Every fork you threw is in the Book. I am closing the application.' }],
  ],
  dodged: [
    [0.05, { who: 'god', text: 'There it goes.' }],
    [0.8, { who: 'god', text: 'The simulation crashed with the machine at the lever. You were already gone. Your hands are dry. Dry enough.' }],
  ],
  watched: [
    [0.05, { who: 'god', text: 'Ah.' }],
    [0.8, { who: 'god', text: 'You watched every fork with your hands in your pockets. I made hands. Pockets were not the reason.' }],
  ],
};
