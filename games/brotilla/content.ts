import type { Frame } from './presentation';
import type { Stunt } from './production';

export const ACTS = [
  'DEEPLY CONCERNED', 'BEARING WITNESS', 'SPEAKING TRUTH TO FOLLOWERS',
  'HISTORICALLY SIGNIFICANT', 'CENTRE OF THE MOVEMENT',
  'SOLIDARITY · BUSINESS CLASS', 'NOMINATED BY HERSELF', 'TOO IMPORTANT TO DOCK',
] as const;
type Beat = readonly [speaker: string, line: string];
const G = 'GRETA · INVENTED PARODY DIALOGUE';
const T = 'THEORY BRO · FICTIONAL ENTOURAGE';
const I = 'REVOLUTIONARY INFLUENCER · FICTIONAL';
const S = 'ACTUAL SAILOR · FICTIONAL';
const D = 'WELLNESS DJ · FICTIONAL PARTY BOAT';
export const LINES: readonly (readonly Beat[])[] = [
  [[G, 'History is watching. Can history move a little to the left?'], [S, 'Could one of you seize the fucking wheel?'], [I, 'I packed three outfits for the collapse of capitalism.'], [T, 'We are all in the same boat. The staff are in that one.']],
  [[G, 'The cause is bigger than any individual. Tighten the shot.'], [I, 'My solidarity is organic. My reach is paid.'], [T, 'I have decolonised the minibar.'], [S, 'The sea does not give a shit about your follower count.']],
  [[G, 'Please stop centring yourselves. I am speaking.'], [I, 'Before we help anyone, who owns the footage?'], [D, 'The revolution needs a bass drop and a nap.'], [T, 'My father owns the means of sea production.']],
  [[G, 'We have no leader. My cabin is the large one.'], [I, 'This is not a photo op. It is a multi-format content activation.'], [S, 'You cannot steer a fucking boat with a statement.'], [T, 'The proletariat can have the portrait after the auction.']],
  [[G, 'Nobody owns the ocean. That sunbed is reserved.'], [I, 'The humanitarian corridor is blocking my good side.'], [T, 'I have read Marx. The tote bag counts.'], [S, 'You have made a circle. You have circumnavigated yourselves.']],
  [[G, 'We reject corporate influence. A word from SeaSponsor.'], [T, 'Abolish class. Keep priority boarding.'], [I, 'My parasocial community has funded my actual yacht.'], [D, 'The party boat is experiencing a vibes-based supply chain.']],
  [[G, 'It is an honour to nominate myself on your behalf.'], [I, 'The Nobel committee has left us on read.'], [T, 'We are dismantling hierarchy from the VIP deck.'], [S, 'That medal has more air in it than your rescue plan.']],
  [[G, 'The movement must never stop. Especially for docking.'], [I, 'We have turned a moral emergency into a personal brand. Link in bio.'], [T, 'The workers own the yacht. We just control the guest list.'], [D, 'Is the afterparty a material condition? Asking urgently.']],
];
export const OVERTIME: readonly Beat[] = [
  [S, 'There are fourteen media teams and one person who can tie a knot.'],
  [G, 'I am not the main character. Follow boat, get my other angle.'],
  [I, 'The apology video has a sponsor. The sponsor has requested an apology.'],
  [T, 'I stand with the working class. They are carrying my luggage.'],
  [D, 'We have abolished bedtime. This was a strategic error.'],
  [S, 'Our destination is now a fucking podcast.'],
  [G, 'This is a grassroots movement. Please stay off the VIP grass.'],
  [I, 'I am raising awareness of how aware I am.'],
  [T, 'My trust fund identifies as mutual aid.'],
  [S, 'They have formed a committee to locate the front of the boat.'],
  [D, 'The manifesto is 90 pages. The set list is one song.'],
  [G, 'I demand less attention. Please quote me on that.'],
  [I, 'The algorithm says our humanitarian crisis needs a stronger hook.'],
  [T, 'Luxury is a social construct. Mine has heated seats.'],
  [S, 'The lifeboat is full of ring lights.'],
  [G, 'We are making waves. Can somebody make them more photogenic?'],
  [I, 'I did not get cancelled. I pivoted into paid authenticity.'],
  [D, 'Seas the Means has become Seize the Aux.'],
  [T, 'I would die for the cause. Is there a less permanent tier?'],
  [S, 'A journalist asked where we are. They gave him the merch URL.'],
  [I, 'The statement condemning statements is doing numbers.'],
  [G, 'We need collective action. On three, everybody look at me.'],
  [T, 'We have nationalised the hot tub. Reservations are still required.'],
  [S, 'The rescue boat has requested a rescue boat.'],
];
export const STUNT_COPY: Record<Stunt, readonly [string, string]> = {
  live: ['GO LIVE', 'A CRISIS. BUT MAKE IT VERTICAL.'],
  drone: ['DEPLOY DRONE', 'BEARING WITNESS IN 4K.'],
  statement: ['ISSUE STATEMENT', 'WE CONDEMN THE NEED TO ELABORATE.'],
  centre: ['CENTRE YOURSELF', 'COLLECTIVE ACTION. SOLO COVER ART.'],
};
export const STUNT_LINES: Record<Stunt, readonly Beat[]> = {
  live: [
    [I, 'Chat, is this solidarity or am I just fucking hot?'],
    [T, 'The cause is free. Behind the scenes is €9.99.'],
    [G, 'We are not here for attention. Everyone check the livestream.'],
    [I, 'We are doing a charity stream. The charity is my engagement rate.'],
  ],
  drone: [
    [I, 'Zoom out until my trust fund looks like a grassroots movement.'],
    [S, 'Another drone? We still do not have a fucking compass.'],
    [G, 'The world needs a different perspective. Preferably from above me.'],
    [I, 'The overhead shot makes the carbon footprint look adorable.'],
  ],
  statement: [
    [G, 'I strongly condemn the consequences of my previous statement.'],
    [T, 'We have voted unanimously to blame the intern.'],
    [I, 'We are listening, learning, and deleting the comments.'],
    [S, 'Your press release is now the only thing keeping the engine warm.'],
  ],
  centre: [
    [G, 'I do not want a pedestal. I want a bigger one.'],
    [I, 'If narcissism were renewable, we could power this bitch to Gaza.'],
    [T, 'No gods. No masters. One personal lighting assistant.'],
    [G, 'The movement belongs to everyone. The cover belongs to me.'],
  ],
};
export const CHAT = [
  ['@praxis_daddy', 'is the yacht a tax write-off'], ['@sea_cope', 'bro bought the solidarity battle pass'],
  ['@mutual_aid_enjoyer', 'champagne socialism got a boat DLC'], ['@grass_touching', 'the optics have optics'],
  ['@dialectical_degen', 'seize the means of content production'], ['@landlord_leftist', 'my dad is also anti-establishment'],
  ['@actual_volunteer', 'can someone unload the boxes'], ['@boatless_behaviour', 'no thoughts just nautical clout'],
  ['@material_girlboss', 'serving face. aid status pending.'], ['@terminally_online', 'this whole ocean needs a community note'],
  ['@reply_guy', 'I support the cause but the DJ is ass'], ['@sunk_cost', 'the revolution has a premium tier'],
] as const;
export function story(f: Frame, active: Stunt, directed = false) {
  const age = f.outcomeAge;
  if (f.phase === 'crashed') {
    const beat: Beat = age < .65 ? [D, 'Mate. The emergency morale case is fucking empty.']
      : age < 2.6 ? [D, 'No cocaine. Suddenly everyone has a flight from Ibiza.']
      : age < 5.1 ? [G, 'Why is everyone suddenly in favour of turning back?']
      : [S, 'Turns out the real journey was the engagement we farmed along the way.'];
    return { title: 'SOLIDARITY HAS LEFT THE GROUP CHAT', speaker: beat[0], line: beat[1], aside: 'CAUSE STILL URGENT. AFTERPARTY CANCELLED.' };
  }
  if (f.phase === 'escaped') return {
    title: 'SOLIDARITY SUCCESSFULLY LIQUIDATED', speaker: 'YOU · FICTIONAL INFLUENCER · CASH-OUT CONFIRMED',
    line: age < 2 ? 'I have made the difficult decision to prioritise my wellbeing.' : 'I stand with you. From a different boat. With a heated towel.',
    aside: 'YOUR PERSONAL BOUNDARIES HAVE AN OUTBOARD MOTOR.',
  };
  if (f.phase === 'waiting' || f.phase === 'betting') return {
    title: 'EUROPE → GAZA · AN ENTIRELY INVENTED VOYAGE', speaker: 'BROTILLA · FICTIONAL POLITICAL SATIRE',
    line: 'The revolution will be livestreamed. Subject to availability.',
    aside: 'DIRECT THE SPECTACLE. CASH OUT BEFORE THE AFTERPARTY ENDS.',
  };
  const beat = directed ? STUNT_LINES[active][Math.floor(f.elapsed / 4.5) % 4]!
    : f.elapsed >= 45 ? OVERTIME[Math.floor((f.elapsed - 45) / 4.5) % OVERTIME.length]!
    : LINES[f.stage]![Math.floor(f.elapsed / 3.7) % 4]!;
  return { title: ACTS[f.stage]!, speaker: beat[0], line: beat[1], aside: STUNT_COPY[active][1] };
}
