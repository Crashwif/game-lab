# I Got Hacked

A washed celebrity launches a coin from a mansion balcony. A fictional star in a bathrobe and shades types the launch post on a gold phone; the pool party below fills with fans on the multiplier curve, the follower ticker spins, the manager whispers in his ear and the yacht in the bay gets bigger. Tension: the whispers get faster, the phone's close-up shows a draft that reads "i got hacked", the fans lean, the yacht starts its engine, the assistant packs bags behind the curtains and the PR crisis team in suits arrives at the gate. An accepted cashout is your fan leaving the party: a towel, a walk off to a rental Lambo, and a NOT HACKED badge. The crash is the post: I GOT HACKED goes out, the chart on the phone falls, the star shrugs on the balcony, the yacht leaves with the manager, the pool drains and the fans stand in a dry pool. The star is a generic cartoon with no likeness of anyone.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `mansion.ts`: the sky and the bay, the yacht, the house, the balcony rig (typing, wave, shrug, glance), the manager, the assistant behind the curtains, the PR team at the gate and the phone close-up with its draft.
- `party.ts`: the lawn and the pool: the fans on the curve, the water that drains, the follower ticker, the champagne pops at milestones, and your fan's exit.
- `scene.ts`: composition, the HUD (captions, multiplier, the pop count, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

Fans, followers, the yacht, the whispers and the draft post all follow the displayed multiplier; nothing in the presentation changes the committed outcome. `prefers-reduced-motion` turns off the shake, the party bounce and the champagne particles.

Run `npm run dev` from the repository root and open the I Got Hacked URL it prints. Join with 50 local credits, then cash out during a running round to leave the party. `npm run build` produces the three publishable files in `dist/i-got-hacked/`.
