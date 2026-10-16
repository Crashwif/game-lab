/**
 * What God says, rung by rung of the displayed multiplier, and what He says at the lever and at the crash. Lines
 * key to what the player can see (the multiplier, the lever, the crash clock), never to the committed outcome.
 */
import type { Line, Who } from './script';

export const NAMES: Record<Who, string> = { god: 'GOD', intern: 'THE INTERN (COVERING FOR GOD)' };
/** Past this multiplier God has left the building and the intern covers. */
export const INTERN_AT = 30;

export const OPENING: Omit<Line, 'at'>[] = [
  { who: 'god', text: 'Five on the main track. One on the side. Your hand is on the lever. Don’t tell Me it isn’t; I can see your hand.' },
  { who: 'god', text: 'Pull early and walk away with little. Pull late and walk away with more. Pull never and walk away with a stop code.' },
];

export const WAITING: Omit<Line, 'at'>[] = [
  { who: 'god', text: 'No trolley yet. There is always a trolley. Stretch.' },
];

export const LADDER: Line[] = [
  { at: 1.06, who: 'god', text: 'The trolley is moving. It is always moving. That’s the first thing I built.' },
  { at: 1.18, who: 'god', text: 'Every second you don’t pull, the insurance pays more. Every second, I get a little less patient.' },
  { at: 1.32, who: 'god', text: 'Nobody has ever pulled this early. Nobody has ever been happy. Those are different sentences.' },
  { at: 1.5, who: 'god', text: 'A third of rounds end before here. Those people are in a better place. It’s a spreadsheet.' },
  { at: 1.75, who: 'god', text: 'The five have noticed you. One of them is waving. It is not a friendly wave.' },
  { at: 2, who: 'god', text: 'Half of all rounds end before this. You’re in the brave half. Or the stupid half. Same half.' },
  { at: 2.4, who: 'god', text: 'The one on the side track has started praying. To Me. In front of you. Awkward for everyone.' },
  { at: 3, who: 'god', text: 'Two rounds in three are over by now. You can hear the wheels. I can hear your pulse.' },
  { at: 3.6, who: 'god', text: 'A philosophy professor has arrived to take notes. He is on neither track. For now.' },
  { at: 4.5, who: 'god', text: 'Your hand is sweating on My lever. I made hands. I know what that means.' },
  { at: 5.5, who: 'god', text: 'One round in five gets here. The five on the track are not counting. They can’t; their hands are tied.' },
  { at: 7, who: 'god', text: 'This stopped being an ethics problem a while ago. Now it’s a hobby.' },
  { at: 9, who: 'god', text: 'I’m going to count to ten. I’m not going to tell you what number I’m on.' },
  { at: 12, who: 'god', text: 'Your patience and Mine are both a formality now. One of us presses a button.' },
  { at: 16, who: 'god', text: 'I’ve started the paperwork. The stop code has your name in it. I spelled it right.' },
  { at: 22, who: 'god', text: 'The trolley has its own lawyer now. So does the lever. You have neither.' },
  { at: INTERN_AT, who: 'god', text: 'I have left the building. The intern is covering. Be nice to them. I won’t be.' },
  { at: 40, who: 'intern', text: 'hi!! um. God left. He said to tell you “press it.” i don’t know what that means. do you?' },
  { at: 55, who: 'intern', text: 'the manual says at this point i’m supposed to “close the application.” i don’t know how. i’m clicking things.' },
  { at: 75, who: 'intern', text: 'found the button. it’s big. it’s red. it says MORAL_EXCEPTION on it. do i just… press it?' },
  { at: 100, who: 'intern', text: 'ok i’m pressing it. i’m sorry. i’m so sorry. this is my first week.' },
];

export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'intern', text: 'still pressing. it’s not doing anything. the trolley keeps going. is this normal?' },
  { who: 'intern', text: 'i found another manual. it’s also wet. why are they all wet.' },
  { who: 'intern', text: 'God texted. He sent a thumbs up. i don’t know what that means either.' },
  { who: 'intern', text: 'the five are playing cards now. the one on the side track is dealing. they seem fine?' },
  { who: 'intern', text: 'i’m going to go sit in the trolley. it seems like the safest place. nobody is ever in the trolley.' },
  { who: 'intern', text: 'the lever is making a noise. levers shouldn’t make noises. i’m writing that down.' },
];

/** After the player pulls: what God says, then the regret ladder keyed to how far the round climbs past the pull. */
export const PULLED = (x: string): Omit<Line, 'at'> => ({ who: 'god', text: `You pulled at ${x}. The trolley took the side track. One dead, five alive. Your hands: wet, but yours.` });
export const PULLED_LATE_ENTRY = (x: string): Omit<Line, 'at'> => ({ who: 'god', text: `You pulled at ${x}, I’m told. The side track remembers. The main track is still running without you.` });
export const REGRET: { at: number; line: Omit<Line, 'at'> }[] = [
  { at: 1.5, line: { who: 'god', text: 'It kept climbing. The one on the side track died for the number you took. Just saying.' } },
  { at: 2.5, line: { who: 'god', text: 'You could have had twice as much and only a slightly worse conscience. The conscience is the cheap part.' } },
  { at: 5, line: { who: 'god', text: 'Everyone still at the lever has five times what you took. Most of them are about to find out why.' } },
  { at: 12, line: { who: 'god', text: 'Twelve times. The trolley is a dot on the horizon. The five are fine. You are also fine. Nobody is fine.' } },
];

/** The crash, on the crash clock in seconds, by what the player was doing when it came. */
export const CRASH_LINES: Record<'rekt' | 'dodged' | 'watched', [at: number, line: Omit<Line, 'at'>][]> = {
  rekt: [
    [0.05, { who: 'god', text: 'Ah.' }],
    [0.75, { who: 'god', text: 'That’s five. And a lever you never touched. I’m closing the application.' }],
  ],
  dodged: [
    [0.05, { who: 'god', text: 'There it goes.' }],
    [0.75, { who: 'god', text: 'The simulation crashed without you in it. You were already out. Your hands are dry. Dry enough.' }],
  ],
  watched: [
    [0.05, { who: 'god', text: 'Ah.' }],
    [0.75, { who: 'god', text: 'You watched five people die with your hands in your pockets. I made hands. Pockets were not the reason.' }],
  ],
};

export const STOP_CODES: Record<'rekt' | 'dodged' | 'watched', string> = {
  rekt: 'MORAL_EXCEPTION_NOT_HANDLED',
  dodged: 'LEVER_PULLED_IN_TIME',
  watched: 'SPECTATOR_COMPLICITY',
};
