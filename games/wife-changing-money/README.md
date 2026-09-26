# Wife Changing Money

A kitchen at 3:07 am. A degen in a dressing gown hunches over a laptop lit only by the chart. Mugs multiply, the cat watches, texts from bed stack on the phone, and an open suitcase by the door fills with gold: the wife-changing-money meter, with LAMBO, LAWYER and BOAT showing up as it fills. The stair light comes on, the ceiling thumps, and a silhouette appears at the top of the stairs. An accepted cashout closes the lid, freezes the meter, and tiptoes him upstairs: SHE NEVER KNEW. The crash is her on the stairs. The ring hits the table, the cat rides the suitcase out the door, the dog follows, a card from Split & Co slides in, and the chart goes to zero.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `kitchen.ts`: the room, the laptop chart, the text stack, the stair light and ceiling thump, the suitcase meter, the wife, the ring, the cat and the card.
- `trader.ts`: the hunched rig, the lid, the tiptoe up the stairs, the caught pose.
- `scene.ts`: composition, the screen glow, the HUD (captions, multiplier, the meter, the secured badge, the outcome) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

She is dressed, the joke is the chart, and nothing in the presentation changes the committed outcome. `prefers-reduced-motion` turns off the screen shake.

Run `npm run dev` from the repository root and open the Wife Changing Money URL it prints. Join with 50 local credits, then cash out during a running round to close the lid. `npm run build` produces the three publishable files in `dist/wife-changing-money/`.
