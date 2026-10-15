/**
 * The words of Vibescam: the founder's launch-stream pitch keyed to the displayed multiplier, the assistant's
 * replies, the features each exchange "ships" (a prompt typed into the IDE, a block of generated code, a badge on
 * the landing page, a smack of the SHIP IT button), the chat's line pools by tier, the DMs that slide in, the
 * overtime cycle for long rounds, the regret lines after a sale, the crash's lines, the captions and the
 * outcome stamps. Data only: nothing here reads or changes the round's outcome.
 */
import type { Line } from './script';

export const TITLE = 'VIBESCAM';
/** The product and the token. Fictional; the product does not exist, which is the point. */
export const PRODUCT = 'VibeOS';
export const TICKER = '$VIBE';

/** A feature the stream ships: the founder's prompt, the assistant's code, what the landing page gains. */
export interface Feature {
  id: string;
  /** What he types into the assistant. */
  prompt: string;
  /** The generated code, as the IDE shows it (short lines; the pane is narrow). */
  code: string[];
  /** The badge the landing page gains, if any. */
  badge?: string;
  /** A change to the page beyond a badge. */
  page?: 'logo' | 'roadmap' | 'nosell' | 'pie' | 'demo' | 'banks' | 'testimonials' | 'vapor' | 'lock';
}

export const FEATURES: readonly Feature[] = [
  { id: 'token', prompt: 'make me a token', code: ['const VIBE = new Token("$VIBE");', 'VIBE.supply = 1e12; // feels right', '// tokenomics: see tokenomics()', 'function tokenomics() {}'], badge: '$VIBE LIVE', page: 'logo' },
  { id: 'ai', prompt: 'add AI', code: ['app.name = "AI " + app.name;', 'for (let i = 0; i < 11; i++)', '  page.append("AI-powered");', '// no model was harmed'], badge: 'AI-POWERED' },
  { id: 'quantum', prompt: 'make it quantum', code: ['const quantum = true;', '// the flag does nothing,', '// which is quantum behaviour', 'export { quantum };'], badge: 'QUANTUM-READY' },
  { id: 'roadmap', prompt: 'roadmap, make it ambitious', code: ['roadmap.Q1 = "launch";', 'roadmap.Q2 = "???";', 'roadmap.Q3 = "profit";', 'roadmap.Q4 = "Mars";'], page: 'roadmap' },
  { id: 'fees', prompt: 'zero fees', code: ['fees = 0; /* * */', '// * the asterisk is also zero', 'footnote.fontSize = 1;'], badge: 'ZERO FEES*' },
  { id: 'hide', prompt: 'hide the warning', code: ['liquidity = null; // TODO lock', 'console.warn = () => {};', '// warning hidden. problem solved'], page: 'lock' },
  { id: 'audit', prompt: 'is this safe?', code: ['const safe = await ai.ask(', '  "is this safe?");', '// "Certainly!"', 'badge("AUDITED");'], badge: 'AUDITED BY A CHATBOT' },
  { id: 'sell', prompt: 'users find the sell button confusing', code: ['document.querySelector(', '  "#sell").remove();', '// UX improved by 100%'], page: 'nosell' },
  { id: 'partner', prompt: 'announce a partnership', code: ['partners.push("[REDACTED]");', '// NDA. big one. trust.', 'banner("PARTNERED");'], badge: 'PARTNERED WITH [REDACTED]' },
  { id: 'demo', prompt: 'make a demo video', code: ['demo = screenRecord(landingPage);', '// users love it', 'demo.loop = true;'], page: 'demo' },
  { id: 'tps', prompt: '10,000 TPS', code: ['const TPS = 10_000;', '// tested in my head', 'claims.push(`${TPS} TPS`);'], badge: '10,000 TPS (TRUST)' },
  { id: 'warnings', prompt: 'fix the warnings', code: ['// 0 errors, 4,812 warnings', 'warnings.forEach(w =>', '  features.push(w));', '// fixed'], badge: '4,812 FEATURES' },
  { id: 'utility', prompt: 'what does the token do', code: ['export const utility = null;', '// utility is a limiting belief', 'VIBE.does = "vibes";'], badge: 'UTILITY-FREE' },
  { id: 'pie', prompt: 'draw the tokenomics', code: ['pie.slices = [{', '  label: "TEAM", pct: 100 }];', '// LP slice: see Q2'], page: 'pie' },
  { id: 'lock', prompt: 'lock the liquidity', code: ['lp.locked = "in my heart";', '// legally binding (vibes)', 'lock.icon = "open";'], badge: 'LP LOCKED (HEART)' },
  { id: 'banks', prompt: 'replace banks', code: ['banks.forEach(b =>', '  b.replaceWith(VIBE));', '// by Thursday', 'thursday ??= "soon";'], badge: 'REPLACES BANKS', page: 'banks' },
  { id: 'testimonials', prompt: 'add testimonials', code: ['testimonials =', '  Array(40).fill(me);', '// "life-changing" — me'], badge: '40 FIVE-STAR REVIEWS', page: 'testimonials' },
  { id: 'vapor', prompt: 'deploy faster', code: ['product = "vapor";', '// 100% vapor. deploys', '// instantly. nothing to ship', 'rm("./src"); // speed'], badge: '100% VAPOR', page: 'vapor' },
];

export const featureById = (id: string): Feature | undefined => FEATURES.find((f) => f.id === id);

/** The founder, between features: what the IDE keeps generating while nobody asked it anything. */
export const FILLER_CODE: readonly string[] = [
  '// TODO: tokenomics',
  'console.log("wagmi");',
  'delete window.audit;',
  '// trust me',
  'setInterval(pump, 1);',
  'if (price < last) price = last;',
  '// this is fine',
  'const bugs = features;',
  'await vibes.check(); // ok',
  'try { ship() } catch {}',
  'holders.forEach(h => h.hodl());',
  '// do not read this line',
  'import rug from "./later";',
  'const SEC = undefined;',
  'while (true) { marketing(); }',
  'user.canSell = false; // UX',
  '// certainly!',
  'moon ??= soon;',
];

/** Lines of the founder's pitch: a bubble that stays up long enough to read. */
const say = (at: number, text: string, extra: Partial<Line> = {}): Line => ({ at, who: 'founder', text, ...extra });
/** The assistant's replies: a cheerful monospace bubble out of the IDE. */
const ai = (at: number, text: string, extra: Partial<Line> = {}): Line => ({ at, who: 'ai', text, gap: 0.9, ...extra });

/**
 * The pitch, keyed to the displayed multiplier. Half of all rounds end before 2×, so the first features ship a
 * few seconds apart; `ask:<id>` types the prompt, `ship:<id>` lands the code, the badge and the button smack.
 */
export const LADDER: Line[] = [
  say(1.04, 'Ok chat. Prompt one: “make me a token”. No notes. Just vibes.', { cap: 'GM. SHIP IT.', beat: 'ask:token' }),
  ai(1.09, 'Certainly! I’ve created $VIBE. Tokenomics are left as an exercise for the reader.', { beat: 'ship:token' }),
  say(1.17, 'Tokenomics are a social construct. Prompt two: “add AI”.', { beat: 'ask:ai' }),
  ai(1.22, 'Done. The app now says “AI” eleven times. No model was harmed, or used.', { beat: 'ship:ai' }),
  say(1.32, 'We’re AI now. We’re also quantum. Make it quantum.', { cap: 'IT’S QUANTUM NOW', beat: 'ask:quantum' }),
  ai(1.37, 'Added `quantum = true`. The flag does nothing, which is quantum behaviour.', { beat: 'ship:quantum' }),
  say(1.5, 'Someone asked for a roadmap. “Roadmap, make it ambitious.”', { beat: 'ask:roadmap' }),
  ai(1.56, 'Q1: launch. Q2: ???. Q3: profit. Q4: Mars. I have left Q2 for you.', { beat: 'ship:roadmap' }),
  say(1.7, 'Zero fees, chat. Zero. Asterisk. The asterisk is also zero.', { cap: 'ZERO FEES*', beat: 'ask:fees' }),
  ai(1.76, 'Fees set to 0. The footnote is one pixel tall, as requested.', { beat: 'ship:fees' }),
  ai(1.92, 'Warning: `liquidity` is null. Would you like me to hide the warning?', { beat: 'warn' }),
  say(1.97, 'Hide it. Hide it hide it hide it.', { cap: 'NUMBER GO UP', beat: 'ask:hide' }),
  ai(2.02, 'Warning hidden. Problem solved. Liquidity remains null, quietly.', { beat: 'ship:hide' }),
  say(2.15, 'Audit? We’re audited. I asked the AI if the code was safe and it said “Certainly!”', { beat: 'ask:audit' }),
  ai(2.21, 'Certainly! Badge added: AUDITED BY A CHATBOT. That chatbot is me.', { beat: 'ship:audit' }),
  say(2.4, 'Users find the sell button confusing. Fix the UX.', { beat: 'ask:sell' }),
  ai(2.47, 'I have removed the sell button. Confusion is down 100%. So is selling.', { cap: 'SELL BUTTON REMOVED (UX)', beat: 'ship:sell' }),
  say(2.7, 'Partnership announcement. With a company. Big one. Can’t say. NDA. Vibes.', { beat: 'ask:partner' }),
  ai(2.77, 'Partner added: [REDACTED]. I have redacted it from myself too, for safety.', { beat: 'ship:partner' }),
  say(3.0, 'Chat wants a demo. Make a demo video.', { beat: 'ask:demo' }),
  ai(3.07, 'The demo video is a screen recording of the landing page. Users love it.', { beat: 'ship:demo' }),
  say(3.4, 'Ten thousand transactions per second. Per second, chat. I tested it in my head.', { cap: 'DYOR (I DIDN’T)', beat: 'ask:tps' }),
  ai(3.47, 'Claim added. I have also tested it in my head. Our heads agree.', { beat: 'ship:tps' }),
  say(3.85, 'Fix the warnings. All of them. Now.', { beat: 'ask:warnings' }),
  ai(3.92, 'Compiled with 0 errors and 4,812 warnings. I have renamed the warnings “features”.', { beat: 'ship:warnings' }),
  say(4.5, 'The token has no utility because utility is a limiting belief.', { cap: 'UTILITY IS A LIMITING BELIEF', beat: 'ask:utility' }),
  ai(4.58, 'Agreed. `utility` is now `null`, which is also a limiting belief, but a small one.', { beat: 'ship:utility' }),
  say(5.5, 'Tokenomics. Fine. Draw the tokenomics.', { beat: 'ask:pie' }),
  ai(5.58, 'I have drawn a pie chart. It is one slice. The slice is labelled TEAM.', { cap: 'ONE SLICE. TEAM.', beat: 'ship:pie' }),
  say(6.5, 'Liquidity lock? Locked. In my heart. Lock the liquidity.', { beat: 'ask:lock' }),
  ai(6.6, 'Liquidity locked “in my heart”. The padlock icon is drawn open, for accuracy.', { beat: 'ship:lock' }),
  ai(8, 'Reminder: the sticker on your big red button is peeling. I can print a new one.', { cap: 'THIS IS FINE' }),
  say(8.1, 'The sticker is fine. The button is fine. Replace banks.', { beat: 'ask:banks' }),
  ai(8.2, 'All banks replaced with $VIBE, by Thursday. Thursday is set to “soon”.', { beat: 'ship:banks' }),
  say(10, 'Social proof. Testimonials. Lots.', { beat: 'ask:testimonials' }),
  ai(10.1, 'Generated 40 five-star testimonials. All of them are from me. I am very happy.', { beat: 'ship:testimonials' }),
  say(13, 'A VC just DM’d me. Or a bot. Same thing. Pre-seed Series A: oversubscribed.', { cap: 'OVERSUBSCRIBED (BY BOTS)' }),
  say(17, 'Deploy faster. I don’t care how.', { beat: 'ask:vapor' }),
  ai(17.2, 'Product is now 100% vapor. Nothing to ship, so it ships instantly.', { cap: '100% VAPOR', beat: 'ship:vapor' }),
  say(22, 'Chat. I need you to understand. There is no product. There is only the vibe.', { cap: 'THERE IS ONLY THE VIBE' }),
  ai(30, 'I’ve checked under the sticker on your button. It says RUG. Would you like me to remove the sticker?'),
  say(30.5, 'Later. Not yet. Later.', { cap: 'NOT YET. LATER.' }),
  say(45, 'Tokenomics drop at 100×. Trust.'),
  ai(100, 'Tokenomics: TBD. I have scheduled this for Q2, which does not exist.', { cap: 'WEN TOKENOMICS: Q2' }),
];

/** Past 100× one of these comes due every 1.35× of multiplier, in order, for as long as the round runs. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'founder', text: 'Prompt: make the number bigger.', cap: 'MAKE THE NUMBER BIGGER', beat: 'ask:filler' },
  { who: 'ai', text: 'The number is bigger. I changed the font size.', gap: 0.9, beat: 'ship:filler' },
  { who: 'founder', text: 'Partnership number two. Also redacted. Also big.' },
  { who: 'ai', text: 'I have added more AI to the AI. It is AI all the way down.', gap: 0.9, beat: 'ship:filler' },
  { who: 'founder', text: 'If you’re still here you’re early. Or late. Vibes don’t have time.', cap: 'VIBES DON’T HAVE TIME' },
  { who: 'ai', text: 'Note: the roadmap’s Q4 has been renamed to “Jupiter”. Mars felt small.', gap: 0.9 },
  { who: 'founder', text: 'We’ve pivoted. Same token. New noun.', cap: 'PIVOT: SAME TOKEN, NEW NOUN', beat: 'ask:filler' },
  { who: 'ai', text: 'Compiled. 0 errors. I have stopped counting warnings for my own wellbeing.', gap: 0.9, beat: 'ship:filler' },
  { who: 'founder', text: 'Audit complete. I read the code. Some of it. The comments.' },
  { who: 'ai', text: 'The sell button is still removed. You’re welcome.', gap: 0.9 },
  { who: 'founder', text: 'The sticker is fine. Stop looking at the sticker.', cap: 'STOP LOOKING AT THE STICKER' },
  { who: 'ai', text: 'I have made the font bigger again. The number is now visible from Jupiter.', gap: 0.9, beat: 'ship:filler' },
];

/** Said while bets are open: the stream goes live. */
export const BETTING_LINE: Omit<Line, 'at'> = { who: 'founder', text: 'gm gm gm. Welcome to the launch stream. I have not slept. I have not coded. I have vibes.', cap: 'LAUNCH STREAM' };

export const CAPTIONS = {
  waiting: 'STREAM STARTING SOON',
  /** The badge on an accepted sale, and the caption while the stream goes on without you. */
  exit: ['SOLD · PAPER HANDS, SER', 'YOU SOLD. HE DIDN’T NOTICE.'],
  kept: 'THE VIBE CONTINUES WITHOUT YOU',
  dodged: 'RUG DODGED — SOLD THE VIBE FIRST',
  watched: 'YOU JUST WATCHED THE STREAM',
} as const;

/** The crash captions, keyed to the crash clock, then cycled once the ending is complete. */
export const CRASH_CAPTIONS: readonly [number, string][] = [[0, 'LIQUIDITY REMOVED'], [1.2, 'IT WAS VAPOR'], [2.6, 'VIBES ARE NON-REFUNDABLE'], [3.9, 'NGMI']];

/** Said after your sale, keyed to how far past it the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.5, { who: 'founder', text: 'Someone just sold. Paper hands, ser. The product doesn’t even exist yet.' }],
  [2, { who: 'ai', text: 'A wallet has exited. I have marked it “not a believer”.', gap: 0.9 }],
  [3, { who: 'founder', text: 'Imagine selling before the pivot.' }],
  [5, { who: 'ai', text: 'The seller is up anyway. I have decided not to tell him.', gap: 0.9 }],
  [10, { who: 'founder', text: 'We don’t talk about the seller. The seller is fine. Unrelated.' }],
];

/** What the founder says the moment your sale lands. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'founder', text: 'Who sold? Chat, who sold? …Unfollowed. Blocked. Anyway: prompt.' };
/** Your line in the chat on an accepted sale. */
export const YOU_SOLD = 'sold. gm.';

/** The crash's lines, keyed to seconds of the crash clock. */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [0.3, { who: 'founder', text: 'Prompt: remove liquidity.' }],
  [1.25, { who: 'ai', text: 'Certainly! Liquidity removed. Repository deleted. Is there anything else?', gap: 0.2 }],
  [2.45, { who: 'founder', text: 'It was a vibe. Vibes are non-refundable.' }],
  [3.65, { who: 'ai', text: 'Stream ended. The creator has deleted their account. Have a great day!', gap: 0.2, life: 600 }],
];

export const STAMP = { rekt: 'EXIT LIQUIDITY', dodged: 'SOLD THE VIBE FIRST', watched: 'JUST VIBING' } as const;

/** The multipliers that ring a milestone stinger. */
export const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];

// ---- The chat -----------------------------------------------------------------------------------------------

export const NAMES = ['ser_vibes', 'wagmi_wendy', 'aped_already', 'quantum_chad', 'exit_liq', 'dyor_dan', 'gm_gremlin', 'paper_pete', 'moon_mom', 'rekt_ralph', 'trench_tina', 'bagholder_bob', 'zero_fees_zed', 'hodl_hank', 'certainly_bot'];

/** The chat's lines by tier; a tier unlocks at its multiplier and stays in the pool. */
export const CHAT_TIERS: readonly [at: number, lines: readonly string[]][] = [
  [1, ['gm', 'wen launch', 'LFG', 'is this the AI one', 'aped', 'vibes only', 'ser the code', 'it’s a landing page??', 'how much supply', 'my wife left but i’m here', 'he has not slept, bullish', 'what does it do', 'certainly!']],
  [1.4, ['wen tokenomics', 'no sell button?? bullish', 'quantum WHAT', 'asked the AI if it’s a scam. it said Certainly!', 'lock the LP ser', 'roadmap says Q2 ???', 'dev doxxed? he’s on camera', 'he’s sweating lol', 'zero fees asterisk?', 'the roadmap goes to Mars']],
  [2, ['where is the LP slice', 'it’s 100% team', 'the testimonials are all from the AI', 'he hasn’t blinked', 'the product is the vibe', 'sold my car for vapor', 'why is the padlock open', 'liquidity is null?? like the token?', 'he keeps looking at the button', 'DM’d him. he said “soon”']],
  [3, ['that sticker is peeling', 'his hand is on the button', 'someone screenshot this', 'this is fine', 'ngmi but up only', 'the duffel bag ser', 'why is the bag packed', 'LP locked “in my heart” lmao', 'the AI is the audit', 'he said Thursday']],
  [5, ['what is under the sticker', 'it says R', 'he is doing the thing', 'the AI just said RUG', 'bag is getting bigger', 'the padlock is swinging', 'is anyone else’s wallet nervous', 'we are so early (to the exit)', 'he just muted the warnings', 'this is a vibe (bad)']],
];

/** The flood at the crash. */
export const FLOOD = ['RUGGED', 'LIQUIDITY GONE', 'SITE IS 404', 'HE DELETED EVERYTHING', 'it was vapor', 'VIBE DIED', 'REPO GONE', 'WHERE IS HE', 'the AI did it', 'I KNEW IT (didn’t sell)', 'refund??', 'class action vibes', 'he took the bag', 'the sticker said RUG', 'certainly.', 'NGMI'];

/** Direct messages that slide in on the founder's cam, keyed to the displayed multiplier. */
export const DMS: readonly [at: number, from: string, text: string][] = [
  [1.6, 'listings_desk', 'hey. 5 SOL and you’re listed. deal?'],
  [2.6, 'vc_real_official', 'hey'],
  [4.5, 'mom', 'are you on the computer again'],
  [8, 'compliance_jr', 'quick question about the padlock'],
  [15, 'vc_real_official', 'hey (bot)'],
  [30, 'mom', 'dinner'],
];

/** The crash: the flood, the readouts, the overlay. Fixed text. */
export const ENDED = { title: 'STREAM ENDED', line: 'The creator has deleted their account.', chat: 'Chat is disabled.', page: 'This site can’t be reached.', pageSub: '(It never could.)' } as const;

/** Testimonials for the landing page, every one of them by the same reviewer. */
export const TESTIMONIALS = ['“life-changing” — me', '“10/10 vibes” — also me', '“would rug again” — me (deleted)'];
