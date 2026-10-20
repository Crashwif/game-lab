import type { Frame } from './presentation';
export const THEME = { title: 'BAD TRIP', subtitle: 'THE BASS HAS A DIGESTIVE SYSTEM.', bg: '#13101e', ink: '#f5efdf', accent: '#d9ff6b', danger: '#ff7ca5', font: 'Arial Black, sans-serif', style: 'hardstyle', crash: 'scratch' } as const;
export const ACTS = [
    ['JUST A LITTLE BRAINROT', 'I came for the music. My personality came for the validation.', 'A microdose of bad decisions. Macro confidence.', 'The bag says MAIN CHARACTER. That seems medically persuasive.', 'My dealer has a wellness podcast. So this is basically healthcare.'],
    ['MY JAW HAS A SIDE HUSTLE', 'My jaw is mining bitcoin. My teeth are paying the gas fees.', 'I can taste the bass. It tastes like unpaid invoices.', 'The floor is breathing. Finally, someone here has a routine.', 'I am vibrating at a higher frequency than my credit score.'],
    ['THIRD EYE. ZERO OVERSIGHT.', 'My third eye opened. It wants a separate subscription.', 'I have transcended ego. Please film me doing it.', 'My aura is verified. My insurance is not.', 'I have seen the truth. It is a sponsored post.'],
    ['THE DJ READ MY SEARCH HISTORY', 'That speaker knows what I deleted from my browser history.', 'Why is the DJ my disappointed father?', 'The bass just called me by my government name.', 'This beat is judging my LinkedIn profile.'],
    ['WELLNESS INDUSTRIAL COMPLEX', 'Ego death: free. Rebirth: plus service fees.', 'The shaman takes contactless. Spirituality is scaling.', 'I bought a premium K-hole. It has a concierge.', 'My nervous breakdown has a brand partnership.'],
    ['THE CROWD IS A GROUP CHAT', 'Everyone is me. The group chat is fucking unbearable.', 'We are one consciousness. Nobody has paid me back.', 'The collective has voted to read my Notes app.', 'Universal love. Selective guest list.'],
    ['THE BASS IS NOT A METAPHOR', 'That is not a subwoofer. That is an oesophagus.', 'The green room is a stomach. Very exclusive.', 'My ego has left the chat. My body is still typing.', 'The DJ promised a face-melting set. I should have asked questions.'],
    ['TERMS OF ASCENSION', 'I AM THE UNIVERSE. THE UNIVERSE IS FUCKED.', 'We have become pure energy. The venue will still charge for water.', 'I am God. Why does God need a wristband?', 'Reality is a scam. I bought the VIP package.'],
] as const;
export const OVERTIME = [
    'The void has a loyalty program. I am one breakdown from platinum.',
    'The ceiling is my therapist. The floor is billing me separately.',
    'I asked the universe for a sign. It sent a payment link.',
    'The afterlife has dynamic pricing. This is a peak-time death.',
    'My chakras have unionised. Negotiations are going terribly.',
    'The bass dropped. My entire legal identity followed it.',
    'I remember all my past lives. Every single one was a shit DJ.',
    'Existence is now a subscription. Cancellation requires a phone call.',
    'My ancestors are here. They want me to stop saying “tribal house”.',
    'I saw the simulation. It was held together with Canva.',
    'The universe is just a landlord with better marketing.',
    'My aura has been liquidated. Please respect my privacy.',
    'The mushroom is giving a TED Talk. It has no credentials.',
    'My soul is in escrow. The shaman says this is normal.',
    'I have become one with the crowd. Unfortunately, the crowd is networking.',
    'The cosmic serpent wants me to join its referral program.',
    'There is no self. There is, however, a non-refundable booking fee.',
    'I am ascending. My luggage is still at baggage claim.',
    'The angel has eight eyes and still cannot find the fucking exit.',
    'My past self is embarrassed by my future self. Fair.',
    'The collective consciousness has an HR department. I am on a final warning.',
    'The multiverse is infinite. Every version of me has bad posture.',
    'I am made of stardust and poorly researched choices.',
    'The void has left a review. “Interesting, but needs work.”',
] as const;
export const REACTIONS = ['BRO IS BUFFERING', 'WATER: 14 CREDITS · FICTIONAL SIGN', 'SOMEONE RESTART THE SHAMAN', 'HE IS BECOMING A CONTENT PILLAR', 'NO THOUGHTS. ALL FREQUENCIES.', 'EGO DEATH IS SO BACK', 'HIS AURA HAS A SPONSOR', 'THE DANCEFLOOR IS CHEWING'];
export const ENDINGS = {
    music: { title: 'YOU ARE THE DROP.', line: 'Your body is now a sample. The DJ did not clear the rights.', receipt: 'PERSONHOOD REMIXED · ROYALTIES: LOL' },
    monster: { title: 'BASS-ICALLY DIGESTED.', line: 'You wanted to feel the music. The music wanted protein.', receipt: 'VIP = VERY INGESTIBLE PERSON' },
    collective: { title: 'EGO DEATH. GROUP PLAN.', line: 'You joined the collective consciousness. It is mostly voice notes.', receipt: 'YOU ARE EVERYONE. EVERYONE IS ANNOYING.' },
} as const;
export function story(frame: Frame) {
    if (frame.phase === 'escaped')
        return { title: 'TOUCH GRASS. KEEP YOUR TEETH.', speaker: 'THE ONLY SOBER FRIEND', line: 'We are leaving. Your spiritual awakening can continue in the taxi.', aside: 'EXIT CONFIRMED · STILL A SEPARATE PERSON' };
    if (frame.phase === 'crashed') {
        const ending = ENDINGS[frame.ending];
        return { title: ending.title, speaker: frame.outcomeAge < 1 ? 'A CONCERNING DEVELOPMENT' : 'THE POST-TRIP RECEIPT', line: frame.outcomeAge < 1 ? 'The drop is coming from INSIDE THE FUCKING SPEAKER.' : ending.line, aside: ending.receipt };
    }
    if (frame.phase !== 'running')
        return { title: THEME.subtitle, speaker: 'YOUR INNER MONOLOGUE', line: 'Just one more. The last thing everyone says before becoming the music.', aside: frame.phase === 'betting' ? 'JOIN ROUND · CASH OUT TO LEAVE THE RAVE' : 'WAITING FOR THE NEXT QUESTIONABLE EVENING' };
    const stage = ACTS[frame.stage]!;
    const slot = Math.floor(frame.elapsed / 5.8);
    return { title: stage[0], speaker: frame.stage >= 5 ? 'OUR INNER MONOLOGUE' : 'YOUR INNER MONOLOGUE', line: frame.elapsed > 32 ? OVERTIME[Math.floor((frame.elapsed - 32) / 6.2) % OVERTIME.length]! : stage[1 + slot % 4]!, aside: REACTIONS[Math.floor(frame.elapsed / 4.3) % REACTIONS.length]! };
}
