import type { Frame } from './presentation';
import type { LootKind } from './loot';

export const ACTS = [
  ['CLASS CONSCIOUS', 'I came to dismantle capitalism. The accessories are in the way.', 'No gods. No masters. No receipts.', 'It is not a shopping bag. It is a portable manifesto.', 'My politics are radical. My sizing is European.'],
  ['SEIZE THE ACCESSORIES', 'Fuck capitalism. Does this come with a dust bag?', 'I refuse to let a corporation tell me what I cannot afford.', 'This is not theft. It is an extremely direct rebate.', 'I need a belt. For holding up the movement.'],
  ['LUXURY COMMUNISM', 'From each according to ability. To me according to availability.', 'The means of production have a very flattering silhouette.', 'The revolution will not be televised. It will be unboxed.', 'Marx would understand the stitching.'],
  ['REDISTRIBUTION SPECIALIST', 'I do not recognise property law. I do recognise last season.', 'We are all equal. I just got here first.', 'Stop filming my face. Film the fit.', 'My praxis has complimentary alterations.'],
  ["THE PEOPLE’S PERSONAL SHOPPER", 'Solidarity is important. So is not creasing the cashmere.', 'The collective can have the carrier bags.', 'I have abolished scarcity. For myself.', 'Do not call it resale. Call it trickle-down liberation.'],
  ['CLASS TRAITOR, FIRST CLASS', 'My trust fund does not define me. The limited edition does.', 'I support workers. I just need one to carry this.', 'My father owns nothing. It is all in a holding company.', 'I am working class. I worked very hard on this outfit.'],
  ['COUNTER-REVOLUTIONARY FIT', 'Who touched MY bag? Suddenly I understand the police.', 'Redistribution was a one-time offer. Terms have changed.', 'I believe in collective ownership of your things.', 'Private property is violence. Unless it matches my shoes.'],
  ['THE REVOLUTION HAS A CONCIERGE', 'We have defeated capitalism. It has offered me an ambassadorship.', 'I have become the bourgeoisie I wanted to see in the world.', 'The barricade is now a members-only lounge.', 'Comrades, please respect the velvet rope.'],
] as const;

const OVERTIME = [
  'Can we overthrow the system after the return window?',
  'My manifesto is long. My receipt is longer.',
  'This outfit is ethically sourced from a public disturbance.',
  'I am not hoarding. I am decentralising very locally.',
  'Workers of the world, mind the suede.',
  'Abolish billionaires. Keep their personal shoppers.',
  'My pronouns are limited / edition.',
  'The revolution has been delayed by a wardrobe change.',
  'A classless society still needs a dress code.',
  'Please do not mistake my privilege for a lack of accessories.',
  'My shopping addiction identifies as political action.',
  'We must dismantle hierarchies. Starting with the waiting list.',
  'I am reclaiming public space. About three wardrobes of it.',
  'My unpaid internship prepared me for unpaid merchandise.',
  'We demand bread, roses, and a certificate of authenticity.',
  'The struggle is real. The leather is Italian.',
  'The revolution is inclusive. The guest list is not.',
  'I have seized so much drip I need a wealth manager.',
  'No ethical consumption under capitalism? Great. No notes.',
  'I cannot hear the criticism over this statement necklace.',
  'My political awakening comes with a two-year warranty.',
  'The group chat has voted. I keep the watch.',
  'My parents are furious. They paid retail.',
  'History will absolve me. The dry cleaner will invoice me.',
] as const;

const EXCUSES: Record<LootKind, string> = {
  bag: 'LOUIS VANDAL · baggage of the bourgeoisie',
  watch: 'KARL MARKS-UP · seize the hours',
  shoe: 'YVES SAINT LOOT · running from contradictions',
  coat: 'MAISON DU CAPITAL · cashmere class warfare',
};
export const ASIDES = [
  ['THE ACTUAL EMPLOYEE', 'Fantastic. I get to sweep up the revolution.'],
  ['THEORY GUY', 'I brought Capital. Hardback. Still in the shrink wrap.'],
  ['REVOLUTIONARY INFLUENCER', 'Can we do the uprising again? I was on selfie mode.'],
  ['THE OWNER', 'We are calling it the Civil Unrest Capsule.'],
  ['THE BROKE STUDENT', 'Why am I carrying everybody else’s liberation?'],
] as const;

export function story(frame: Frame, kind: LootKind) {
  if (frame.phase === 'escaped') return {
    title: 'CLASS STRUGGLE: UPGRADED TO BUSINESS', speaker: 'THE REVOLUTIONARY · CASH-OUT CONFIRMED',
    line: frame.outcomeAge < 1.8 ? 'Nobody move. These are now my personal belongings.' : 'Papa, the demonstration was exhausting.',
    aside: 'A CHAUFFEUR-DRIVEN RETREAT FROM CAPITALISM',
  };
  if (frame.phase === 'crashed') return {
    title: 'LIBERTÉ. ÉGALITÉ. CUSTODY.', speaker: frame.outcomeAge < 1.3 ? 'THE REVOLUTIONARY' : 'EVIDENCE COLLECTION · FALL / WINTER',
    line: frame.outcomeAge < 1.3 ? 'Wait. I thought the police only protected private property.' : frame.outcomeAge < 2.8 ? 'This is a deeply problematic returns policy.' : 'Can I at least keep the outfit for the mugshot?',
    aside: 'EVERYTHING MUST GO. TO EVIDENCE.',
  };
  if (frame.phase !== 'running') return {
    title: 'EAT THE RICH. WEAR THE EVIDENCE.', speaker: 'TONIGHT AT MAISON DU CAPITAL',
    line: 'Choose your loot. Grow your haul. Cash out before the collection becomes evidence.',
    aside: 'FICTIONAL PARIS · REAL CONTRADICTIONS',
  };
  const act = ACTS[frame.stage]!;
  const index = Math.floor(frame.elapsed / 4.8);
  return {
    title: act[0], speaker: 'THE REVOLUTIONARY · DEFINITELY A STUDENT',
    line: frame.elapsed > 40 ? OVERTIME[Math.floor((frame.elapsed - 40) / 4.8) % OVERTIME.length]! : act[1 + index % 4]!,
    aside: EXCUSES[kind],
  };
}
export const placard = (stage: number) => stage < 2 ? ['EAT', 'THE RICH'] : stage < 4 ? ['SEIZE', 'THE DRIP'] : stage < 6 ? ['EQUAL', 'BUT VIP'] : ['HANDS OFF', 'MY STUFF'];
