import type { Frame } from './presentation';
export const THEME = { title: 'CROSSED THE LINE', subtitle: 'THE LORD GIVETH. THE BRACKET GIVETH WAY.', bg: '#251e19', ink: '#fff0ce', accent: '#f5cf85', danger: '#ff8b70', font: 'Georgia, serif', style: 'ambient', crash: 'slam' } as const;
export const ACTS = [
    ['BLESS THIS FUCKING MESS', 'Blessed are the humble. Like me. Extremely like me.', 'I welcome all sinners. Especially the liquid ones.', 'Love thy neighbour. Unless they leave a one-star review.', 'Please silence your phones, your doubts, and your accountant.'],
    ['PAY TO PRAY', 'The meek shall inherit the Earth. Premium members get early access.', 'Forgiveness is free. Processing fees are not.', 'Our Father, who art in heaven, sponsored be Thy name.', 'I have converted communion to a subscription. Cancel after eternity.'],
    ['THE PROSPERITY IS MINE', 'I took a vow of poverty. On your behalf. You are welcome.', 'My private jet brings me closer to God. That is just altitude.', 'Jesus washed feet. I sell foot content. It is called innovation.', 'Give until it hurts. My second yacht has a third mortgage.'],
    ['SCRIPTURE, DISRUPTED', 'Ten commandments? Fucking micromanagement. We are pivoting to vibes.', 'I replaced confession with a chatbot. It blackmails at scale.', 'The resurrection was history’s most successful rebrand.', 'I fed the Bible to AI. It recommended replacing me. I deleted the output.'],
    ['HOLY SHITCOIN', 'I sell indulgences as NFTs. Same scam. Better margins.', 'I turned the collection plate into a hedge fund. The losses are mysterious.', 'Jesus died for your sins. I am charging a convenience fee.', 'The miracle did not fail. You bought the wrong tier of faith.'],
    ['GOD HAS A MANAGER', 'God works in mysterious ways because His management is shit.', 'I put God on a performance improvement plan. Prayer response times: unacceptable.', 'Let there be light? Great idea. Terrible monetisation.', 'The Holy Spirit is an unpaid intern. We are a family here.'],
    ['HOSTILE TAKEOVER OF HEAVEN', 'I am buying the Holy Trinity. Three seats. One me.', 'I have promoted myself to God. The position was clearly remote.', 'Heaven needs layoffs. The angels have been coasting for centuries.', 'I am replacing the pearly gates with a fucking paywall.'],
    ['HE SAID WHAT?', 'I am the second coming. First class this time.', 'The Bible needs a stronger lead. I have attached my headshots.', 'If God wants the last word, He can book a slot on MY podcast.', 'I forgive God for being jealous of my engagement rate.'],
] as const;
export const OVERTIME = [
    'The burning bush is now a vape sponsor. Moses signed the exclusivity deal.',
    'I sold naming rights to the afterlife. Welcome to Heaven, brought to you by leverage.',
    'Water into wine? Cute. I turn guilt into recurring revenue.',
    'The camel can fit through the needle. He just needs Premium.',
    'My jet is tax-exempt because the clouds are technically parish property.',
    'I outsourced the Apocalypse. Delivery window: between 9 and never.',
    'We have rebranded Hell as a character-building residency.',
    'Original sin is our most scalable acquisition channel.',
    'The confessional now records for quality assurance and future negotiations.',
    'The sermon is not too long. Your attention span lacks faith.',
    'God created man in His image. I improved the lighting.',
    'My humility course is number one. Nobody is humbler at this price.',
    'The angels unionised. Heaven is considering moving operations offshore.',
    'I asked for divine guidance. The Lord sent me an unsubscribe link.',
    'I have trademarked Amen. Please see the invoice in your hymn book.',
    'Miracles are non-refundable. That is in the Old Terms and Conditions.',
    'The loaves and fishes were a seed round. I am here for the exit.',
    'I told God to stay in His lane. He does not even have a verified account.',
    'We are pivoting from salvation to a salvation-adjacent lifestyle ecosystem.',
    'I am not a false prophet. I am a pre-revenue prophet.',
    'The devil offered me a deal. Frankly, the benefits were competitive.',
    'I bought a halo on finance. The APR is a test of faith.',
    'I declared myself infallible. Legal have some extremely fallible concerns.',
    'My publicist says I should apologise. I have excommunicated my publicist.',
] as const;
export const REACTIONS = ['THE ORGANIST HAS STOPPED MAKING EYE CONTACT', 'TAP TO REPENT · FICTIONAL PROP', 'THE NUN IS SCREEN-RECORDING', 'HEAVENLY HR: TYPING…', 'SOMEONE TAKE HIS MICROPHONE', 'THE COLLECTION PLATE HAS A COLLECTION PLATE', 'GOD HAS MUTED THE GROUP CHAT', 'PARISH COUNCIL: ABSOLUTELY FUCKING NOT'];
export function story(frame: Frame) {
    if (frame.phase === 'escaped')
        return { title: 'AMEN ACCEPTED. EGO INTACT.', speaker: 'FATHER LES MORALS · OFF THE RECORD', line: 'I shall continue this on my podcast. This venue is hostile to founders.', aside: 'CASH-OUT CONFIRMED · SERMON ENDED IN TIME' };
    if (frame.phase === 'crashed')
        return { title: 'DIVINE PERFORMANCE REVIEW', speaker: frame.outcomeAge < 1.1 ? 'FAMOUS LAST WORDS' : 'THE PARISH NOTICEBOARD', line: frame.outcomeAge < 1.1 ? 'If God has a problem with my business model, He can come down here and—' : frame.outcomeAge < 2.8 ? 'He asked for a sign from above. He got the entire fucking fixture.' : 'The sermon has been cancelled. Donations, tragically, remain open.', aside: 'ONE STAR FROM GOD · WOULD NOT WORSHIP AGAIN' };
    if (frame.phase !== 'running')
        return { title: THEME.subtitle, speaker: 'FATHER LES MORALS', line: 'Welcome, my flock. Please silence your doubts and enable recurring payments.', aside: frame.phase === 'betting' ? 'JOIN ROUND · CASH OUT TO SAY AMEN' : 'ST. MARGIN’S · SALVATION WITH A SERVICE FEE' };
    const stage = ACTS[frame.stage]!;
    return { title: stage[0], speaker: 'FATHER LES MORALS · SPONSORED SERMON', line: frame.elapsed > 32 ? OVERTIME[Math.floor((frame.elapsed - 32) / 6.2) % OVERTIME.length]! : stage[1 + Math.floor(frame.elapsed / 5.8) % 4]!, aside: REACTIONS[Math.floor(frame.elapsed / 4.3) % REACTIONS.length]! };
}
