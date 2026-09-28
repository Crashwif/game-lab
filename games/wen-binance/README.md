# Wen Binance

A queue outside a nightclub called THE EXCHANGE. A coin in a hoodie waits in a velvet-rope line behind a bouncer with a clipboard; the line advances and the hype meter on the marquee climbs with the multiplier, the DJ's bass shakes the doors, insiders in suits are waved past, and the marquee reads LISTING SOON. Tension: the bouncer looks at his clipboard longer, the bass gets louder, the doors crack open to show the dance floor, the suits inside head for the back exit, and the marquee flickers between LISTING and DELISTING. An accepted exit is leaving the line with your bag: a taxi pulls up and the badge reads LEFT THE QUEUE. The crash is sell the news: the doors open, the suits pour out with bags, the marquee reads DELISTED, the coin is let in to an empty club with the lights on, and the bouncer flips the sign to DELISTED.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `club.ts`: the club front: the marquee and its flicker, the doors on springs with the dance floor behind them, the bouncer's rig (look-down, head-shake, wave-through), the suits waved in and pouring out, the taxi and the sign flip.
- `queue.ts`: the velvet-rope queue of coins that advances on the curve, their chatter, your coin's exit to the taxi, the panic run and the suit count.
- `scene.ts`: composition, the HUD (captions, multiplier, the suit count, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

The queue's advance, the marquee meter, the bass, the bouncer and the suits all follow the displayed multiplier; nothing in the presentation changes the committed outcome. The club is fictional. `prefers-reduced-motion` turns off the bass shake, the marquee flicker and the strobe.

Run `npm run dev` from the repository root and open the Wen Binance URL it prints. Join with 50 local credits, then cash out during a running round to leave the queue. `npm run build` produces the three publishable files in `dist/wen-binance/`.
