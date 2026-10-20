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
  { id: 'token', prompt: 'mint a carbon-neutral token', code: ['const VIBE = new Token("$VIBE");', 'VIBE.esgScore = 100; // trust', '// offsets: 3 JPEGs of trees', 'function utility() {}'], badge: '$VIBE · NET ZERO', page: 'logo' },
  { id: 'ai', prompt: 'add ethical AI', code: ['app.name = "SafeAI " + app.name;', 'ai.align("effective_altruism");', '// drains wallets ethically', 'export { ai };'], badge: 'ETHICALLY ALIGNED AI' },
  { id: 'quantum', prompt: 'make it quantum & inclusive', code: ['const quantum = "they/them";', '// superposition of solvent', '// and bankrupt at once', 'export { quantum };'], badge: 'QUANTUM-INCLUSIVE' },
  { id: 'roadmap', prompt: 'Davos-ready roadmap', code: ['roadmap.Q1 = "mint";', 'roadmap.Q2 = "TED Talk";', 'roadmap.Q3 = "Bahamas Villa";', 'roadmap.Q4 = "Pardon";'], page: 'roadmap' },
  { id: 'fees', prompt: 'reparations fee structure', code: ['fees.retail = 0.99; /* * */', 'fees.founders = 0; // equity', 'footnote.fontSize = 1;'], badge: 'ZERO FEES*' },
  { id: 'hide', prompt: 'suppress the solvency warning', code: ['liquidity = null; // misinfo', 'factCheck(console.warn);', '// flagged as hate speech'], page: 'lock' },
  { id: 'audit', prompt: 'is this contract safe?', code: ['const safe = await ai.ask(', '  "for the greater good?");', '// "Certainly! Very ethical."', 'badge("AUDITED");'], badge: 'AUDITED BY CHATBOT' },
  { id: 'sell', prompt: 'selling causes climate change', code: ['document.querySelector(', '  "#sell").remove();', '// saved the planet'], page: 'nosell' },
  { id: 'partner', prompt: 'announce WEF partnership', code: ['partners.push("[REDACTED]");', '// Klaus Schwab liked my tweet', 'banner("PARTNERED");'], badge: 'PARTNERED WITH [REDACTED]' },
  { id: 'demo', prompt: 'fake the product demo', code: ['demo = screenRecord(landingPage);', '// TechCrunch called it brave', 'demo.loop = true;'], page: 'demo' },
  { id: 'tps', prompt: '10,000 TPS on vibes', code: ['const TPS = 10_000;', '// peer-reviewed by my polycule', 'claims.push(`${TPS} TPS`);'], badge: '10,000 TPS (TRUST)' },
  { id: 'warnings', prompt: 'reframe the SEC warnings', code: ['// 0 errors, 4,812 subpoenas', 'warnings.forEach(w =>', '  features.push(w));', '// decolonized compliance'], badge: '4,812 FEATURES' },
  { id: 'utility', prompt: 'what does the token do', code: ['export const utility = null;', '// capitalism is a construct', 'VIBE.does = "awareness";'], badge: 'POST-UTILITY' },
  { id: 'pie', prompt: 'equitable tokenomics', code: ['pie.slices = [{', '  label: "FOUNDER NGO", pct: 100 }];', '// trickle-down vibes'], page: 'pie' },
  { id: 'lock', prompt: 'lock LP in a blind trust', code: ['lp.locked = "in my heart";', '// governed by Burning Man law', 'lock.icon = "open";'], badge: 'LP LOCKED (HEART)' },
  { id: 'banks', prompt: 'bank the unbanked', code: ['banks.forEach(b =>', '  b.replaceWith(myWallet));', '// financial liberation', 'sec ??= "asleep";'], badge: 'REPLACES BANKS', page: 'banks' },
  { id: 'testimonials', prompt: 'astroturf the reviews', code: ['testimonials =', '  Array(40).fill(myAlt);', '// "cured my generational trauma"'], badge: '40 FIVE-STAR REVIEWS', page: 'testimonials' },
  { id: 'vapor', prompt: 'consciously uncouple the LP', code: ['product = "vapor";', '// you will own nothing', '// and be happy', 'rm("./liquidity");'], badge: '100% VAPOR', page: 'vapor' },
];

export const featureById = (id: string): Feature | undefined => FEATURES.find((f) => f.id === id);

/** The founder, between features: what the IDE keeps generating while nobody asked it anything. */
export const FILLER_CODE: readonly string[] = [
  '// TODO: effective altruism',
  'console.log("healing the world");',
  'delete window.secSubpoena;',
  '// microdosing...',
  'setInterval(synergy, 1);',
  'if (price < last) blame("bots");',
  '// carbon-neutral rug',
  'const bugs = livedExperience;',
  'await polycule.vote(); // pass',
  'try { extract() } catch {}',
  'holders.forEach(h => h.donate());',
  '// redacted for your safety',
  'import bahamas from "./offshore";',
  'const ethics = undefined;',
  'while (true) { virtueSignal(); }',
  'user.canSell = false; // safety',
  '// As an AI language model...',
  'bailout ??= taxpayer;',
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
  say(1.04, 'Gm chat. I’m microdosing oat milk and decentralizing empathy. Prompt one: “mint a carbon-neutral token”.', { cap: 'GM. SHIP IT.', beat: 'ask:token' }),
  ai(1.09, 'Certainly! I’ve minted $VIBE. Every transaction plants an imaginary tree in the metaverse.', { beat: 'ship:token' }),
  say(1.17, 'Profit is a colonial mindset. Prompt two: “add ethical AI”.', { beat: 'ask:ai' }),
  ai(1.22, 'Done. I have aligned the smart contract with Effective Altruism: all funds now route to your compound.', { beat: 'ship:ai' }),
  say(1.32, 'We’re an AI safety lab now. Make the token quantum and non-binary.', { cap: 'QUANTUM & INCLUSIVE', beat: 'ask:quantum' }),
  ai(1.37, 'Added `quantum = true`. Your treasury is now simultaneously a charity and a wire fraud.', { beat: 'ship:quantum' }),
  say(1.5, 'VCs want a Davos roadmap. “Davos-ready roadmap.”', { beat: 'ask:roadmap' }),
  ai(1.56, 'Q1: Mint. Q2: Forbes 30 Under 30. Q3: Bahamas polycule. Q4: Presidential pardon.', { beat: 'ship:roadmap' }),
  say(1.7, 'Zero fees for founders, 99% solidarity tax for retail. For equity.', { cap: 'ZERO FEES*', beat: 'ask:fees' }),
  ai(1.76, 'Fees updated. The asterisk is one pixel tall to prevent reader anxiety.', { beat: 'ship:fees' }),
  ai(1.92, 'Alert: `liquidity` is null and the SEC is typing. Should I classify their subpoena as misinformation?', { beat: 'warn' }),
  say(1.97, 'Fact-check the SEC. Suppress that warning for community safety.', { cap: 'TRUST THE SCIENCE', beat: 'ask:hide' }),
  ai(2.02, 'Warning fact-checked and removed. Solvency is now a matter of personal truth.', { beat: 'ship:hide' }),
  say(2.15, 'Chat’s asking for an audit. Tell them stealing LP is safe if I donate 1% to a senator.', { beat: 'ask:audit' }),
  ai(2.21, 'As an AI language model, I cannot tell a joke, but I have approved your embezzlement!', { beat: 'ship:audit' }),
  say(2.4, 'Retail is trying to take profit. Selling is literally financial violence. Fix the UX.', { beat: 'ask:sell' }),
  ai(2.47, 'I have removed the sell button to protect marginalized liquidity pools.', { cap: 'SELL BUTTON REMOVED (SAFETY)', beat: 'ship:sell' }),
  say(2.7, 'Announce our World Economic Forum partnership. Can’t name who. NDA.', { beat: 'ask:partner' }),
  ai(2.77, 'Partner added: [REDACTED]. You will own nothing, and your holders will test it first.', { beat: 'ship:partner' }),
  say(3.0, 'Drop the product demo so a16z wires the Series A.', { beat: 'ask:demo' }),
  ai(3.07, 'The demo is a looped GIF of a progress bar. Four venture partners just cried.', { beat: 'ship:demo' }),
  say(3.4, 'Ten thousand TPS, chat. Peer-reviewed at Burning Man inside a sweat lodge.', { cap: 'PEER-REVIEWED AT BURNING MAN', beat: 'ask:tps' }),
  ai(3.47, 'Benchmark verified by your shaman. Latency is zero when there is no blockchain.', { beat: 'ship:tps' }),
  say(3.85, 'The compiler has 4,812 felony warnings. Reframe them as lived experiences.', { beat: 'ask:warnings' }),
  ai(3.92, 'Renamed all 4,812 warnings to “governance features”. Stunning and brave.', { beat: 'ship:warnings' }),
  say(4.5, 'Asking “what does the token do” is late-stage capitalist trauma.', { cap: 'UTILITY IS TRAUMA', beat: 'ask:utility' }),
  ai(4.58, 'Agreed. `utility` is set to `null`. Holding $VIBE is its own spiritual reward.', { beat: 'ship:utility' }),
  say(5.5, 'Fine, show the tokenomics pie chart. Make it look grassroots.', { beat: 'ask:pie' }),
  ai(5.58, 'Pie chart rendered: 100% allocated to “Founder Mental Health & Yacht Foundation”.', { cap: '100% FOUNDER NGO', beat: 'ship:pie' }),
  say(6.5, 'Where is the LP locked? It’s locked in my heart, chat. Spiritually multisigged.', { beat: 'ask:lock' }),
  ai(6.6, 'Liquidity locked “in your heart”. I drew the padlock wide open for transparency.', { beat: 'ship:lock' }),
  ai(8, 'Note: the “SHIP IT” sticker on your big red button is peeling over the word “RUG”.', { cap: 'THIS IS FINE' }),
  say(8.1, 'Stop gaslighting me, AI. We are banking the unbanked! Replace banks.', { beat: 'ask:banks' }),
  ai(8.2, 'All traditional banks replaced with your personal MetaMask by Thursday.', { beat: 'ship:banks' }),
  say(10, 'Generate grassroots community testimonials. Diversity of bots.', { beat: 'ask:testimonials' }),
  ai(10.1, 'Generated 40 five-star reviews from your sockpuppet accounts. Very authentic.', { beat: 'ship:testimonials' }),
  say(13, 'Both political parties just asked for a campaign contribution. We are officially too big to prosecute.', { cap: 'BIPARTISAN IMMUNITY' }),
  say(17, 'Consciously uncouple the liquidity pool from the holders.', { beat: 'ask:vapor' }),
  ai(17.2, 'Treasury consciously uncoupled. Product is 100% vapor and ESG-certified.', { cap: '100% ESG VAPOR', beat: 'ship:vapor' }),
  say(22, 'Chat, money isn’t real. The real liquidity was the parasocial trauma bond we built.', { cap: 'TRAUMA BOND COMPLETE' }),
  ai(30, 'The sticker fell off. The button just says “DRAIN RETIREMENT ACCOUNTS”. Press it?'),
  say(30.5, 'Wait until my TED Talk finishes uploading.', { cap: 'WAIT FOR THE TED TALK' }),
  say(45, 'Universal Basic Income drops at 100×. For me. Specifically me.'),
  ai(100, 'Tokenomics scheduled for Q2, which has been outsourced to the Cayman Islands.', { cap: 'WEN TOKENOMICS: CAYMANS' }),
];

/** Past 100× one of these comes due every 1.35× of multiplier, in order, for as long as the round runs. */
export const OVERTIME: Omit<Line, 'at'>[] = [
  { who: 'founder', text: 'Prompt: print more governance tokens for climate justice.', cap: 'MINT FOR THE PLANET', beat: 'ask:filler' },
  { who: 'ai', text: 'Minted 10 trillion tokens. Global temperatures unchanged, your net worth up.', gap: 0.9, beat: 'ship:filler' },
  { who: 'founder', text: 'Just got invited to speak on a Senate panel about ethics.' },
  { who: 'ai', text: 'I have drafted your testimony: “I was on ayahuasca and clicked the wrong button.”', gap: 0.9, beat: 'ship:filler' },
  { who: 'founder', text: 'If you’re still holding, you’re practicing radical non-attachment to money.', cap: 'RADICAL NON-ATTACHMENT' },
  { who: 'ai', text: 'Update: Q4 roadmap updated from “Mars” to “Non-Extradition Treaty”.', gap: 0.9 },
  { who: 'founder', text: 'We’re pivoting from AI to Defense Tech. Same grift, taxpayer funding.', cap: 'PIVOT: DEFENSE TECH', beat: 'ask:filler' },
  { who: 'ai', text: 'Compiled. 0 errors. Pentagon contract approved.', gap: 0.9, beat: 'ship:filler' },
  { who: 'founder', text: 'My therapist says accountability is a toxic boundary.' },
  { who: 'ai', text: 'The sell button remains disabled to prevent holder self-harm.', gap: 0.9 },
  { who: 'founder', text: 'Stop staring at the duffel bag behind me. It’s laundry.', cap: 'IT’S JUST LAUNDRY' },
  { who: 'ai', text: 'Your laundry is leaking Swiss francs onto the webcam.', gap: 0.9, beat: 'ship:filler' },
];

/** Said while bets are open: the stream goes live. */
export const BETTING_LINE: Omit<Line, 'at'> = { who: 'founder', text: 'gm chat. Coming to you live from my $40M Effective Altruism compound. No code, pure vibes.', cap: 'LAUNCH STREAM' };

export const CAPTIONS = {
  waiting: 'STREAM STARTING SOON',
  /** The badge on an accepted sale, and the caption while the stream goes on without you. */
  exit: ['SOLD · LOW-VIBRATION ENERGY', 'YOU SOLD BEFORE THE TED TALK'],
  kept: 'THE CULT CONTINUES WITHOUT YOU',
  dodged: 'RUG DODGED — UNCOUPLED FIRST',
  watched: 'YOU JUST WATCHED THE STREAM',
} as const;

/** The crash captions, keyed to the crash clock, then cycled once the ending is complete. */
export const CRASH_CAPTIONS: readonly [number, string][] = [[0, 'CONSCIOUSLY UNCOUPLED'], [1.2, '100% ETHICAL VAPOR'], [2.6, 'VIBES ARE NON-REFUNDABLE'], [3.9, 'SEE YOU AT DAVOS']];

/** Said after your sale, keyed to how far past it the multiplier is. */
export const REGRET: [past: number, line: Omit<Line, 'at'>][] = [
  [1.5, { who: 'founder', text: 'Someone just sold. Very low-vibration, scarcity-mindset behavior.' }],
  [2, { who: 'ai', text: 'A wallet took profit. I have reported them to the WEF.', gap: 0.9 }],
  [3, { who: 'founder', text: 'Imagine selling before we solve human consciousness.' }],
  [5, { who: 'ai', text: 'The seller actually made money. This violates our tokenomics.', gap: 0.9 }],
  [10, { who: 'founder', text: 'We don’t talk about the seller. They’re blocked from the polycule.' }],
];

/** What the founder says the moment your sale lands. */
export const EXIT_LINE: Omit<Line, 'at'> = { who: 'founder', text: 'Who sold?! Chat, taking profits is literally extractive colonialism! Blocked.' };
/** Your line in the chat on an accepted sale. */
export const YOU_SOLD = 'sold. namaste.';

/** The crash's lines, keyed to seconds of the crash clock. */
export const CRASH_LINES: [at: number, line: Omit<Line, 'at'>][] = [
  [0.3, { who: 'founder', text: 'Prompt: reallocate 100% of liquidity to my Bahamas NGO.' }],
  [1.25, { who: 'ai', text: 'Certainly! Liquidity drained ethically. GitHub repo scrubbed. Namaste!', gap: 0.2 }],
  [2.45, { who: 'founder', text: 'I am taking a mental health sabbatical in a non-extradition country.' }],
  [3.65, { who: 'ai', text: 'Stream ended. The creator is now a guest lecturer at Stanford!', gap: 0.2, life: 600 }],
];

export const STAMP = { rekt: 'EFFECTIVE EXIT LIQUIDITY', dodged: 'UNCOUPLED FIRST', watched: 'JUST VIBING' } as const;

/** The multipliers that ring a milestone stinger. */
export const RUNGS = [1.2, 1.5, 2, 2.6, 3.4, 4.5, 6, 8, 11, 15, 22, 40, 100];

// ---- The chat -----------------------------------------------------------------------------------------------

export const NAMES = ['ser_vibes', 'wagmi_wendy', 'aped_already', 'quantum_chad', 'exit_liq', 'dyor_dan', 'gm_gremlin', 'paper_pete', 'moon_mom', 'rekt_ralph', 'trench_tina', 'bagholder_bob', 'zero_fees_zed', 'hodl_hank', 'certainly_bot'];

/** The chat's lines by tier; a tier unlocks at its multiplier and stays in the pool. */
export const CHAT_TIERS: readonly [at: number, lines: readonly string[]][] = [
  [1, ['gm', 'wen launch', 'is this ESG compliant??', 'aped my student loan', 'vibes only', 'ser the code is 4 lines', 'he’s microdosing on cam', 'for the unbanked!!', 'my wife’s boyfriend aped', 'he was on Forbes 30 Under 30, safe!', 'what does it do', 'certainly!']],
  [1.4, ['wen tokenomics', 'no sell button = forced diamond hands', 'quantum pronouns?? bullish', 'asked the AI if it’s a felony. it said Certainly!', 'lock the LP ser', 'roadmap says Presidential Pardon??', 'he’s sweating oat milk', 'zero fees asterisk?', 'Klaus Schwab followed him']],
  [2, ['where is the LP slice', 'it’s 100% Founder NGO', 'the reviews are all his alt accounts', 'he hasn’t blinked since 2021', 'the product is a TED talk', 'sold my Prius for vapor', 'why is the padlock open', 'liquidity is a social construct', 'he keeps eyeing the red button', 'bipartisan donors in chat']],
  [3, ['that sticker is peeling', 'his hand is on the button', 'someone call Coffeezilla', 'this is fine', 'effective altruism = my money is effectively his', 'the duffel bag ser', 'why is his passport on the desk', 'LP locked “in my heart” lmao', 'the AI is his accomplice', 'he said Thursday']],
  [5, ['what is under the sticker', 'it says RUG', 'he is doing a conscious uncoupling', 'the AI just shredded the repo', 'bag is getting heavier', 'the padlock is wide open', 'is anyone else’s wallet at $0', 'we are funding his polycule', 'he just muted the SEC', 'stunning and brave']],
];

/** The flood at the crash. */
export const FLOOD = ['RUGGED ETHICALLY', 'LIQUIDITY UNCOUPLED', 'SITE IS 404', 'HE DELETED THE REPO', 'it was ESG vapor', 'MY RENT MONEY', 'BAHAMAS FLIGHT', 'WHERE IS HE', 'the AI helped him', 'FORBES CURSE STRIKES AGAIN', 'refund??', 'class action vibes', 'he took the oat milk too', 'the sticker said RUG', 'certainly.', 'NGMI'];

/** Direct messages that slide in on the founder's cam, keyed to the displayed multiplier. */
export const DMS: readonly [at: number, from: string, text: string][] = [
  [1.6, 'a16z_scout', 'love the lack of product. $50M at $1B val?'],
  [2.6, 'senator_pac', 'wire cleared. we’ll kill the subpoena'],
  [4.5, 'polycule_gc', 'did you drain the LP yet? rent is due'],
  [8, 'sec_enforcement', 'hey quick question about the open padlock'],
  [15, 'davos_panel', 'can you speak on Ethical Web3 on Friday?'],
  [30, 'bahamas_jet', 'engines warm. press the button'],
];

/** The crash: the flood, the readouts, the overlay. Fixed text. */
export const ENDED = { title: 'STREAM ENDED', line: 'The creator has pivoted to AI Safety.', chat: 'Chat is disabled for community healing.', page: 'This site can’t be reached.', pageSub: '(Your money is in the Bahamas.)' } as const;

/** Testimonials for the landing page, every one of them by the same reviewer. */
export const TESTIMONIALS = ['“decolonized my 401(k)” — me', '“10/10 effective altruism” — also me', '“would rug for the planet again” — me (deleted)'];
