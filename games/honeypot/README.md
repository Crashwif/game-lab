# Honeypot

A picnic by a beehive. A bear in a bucket hat has his paw in a jar labelled `$POT`. The honey level follows the displayed multiplier, the surface wobbles, drips run down the glass, and the lid turns by itself. The label's sell tax steps from 1% to 99% while buy tax stays at 0%. Other animals lean in and stick to a puddle on the blanket. The bees get louder as the tension climbs. An accepted cashout pulls the paw free: honey strings snap, shades drop, and he strolls off with a small jar while everyone else stays. The crash screws the lid shut, stamps CAN'T SELL, turns the honey to glue, swarms the picnic, and the beekeeper walks away with the hive.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `jar.ts`: the glass, the honey volume, drips and bubbles, the lid, the strings, the tax label and the stamp.
- `picnic.ts`: the blanket, the bear rig, the guests, the hive, the swarm and the beekeeper.
- `scene.ts`: composition, the glue grade, the HUD (captions, multiplier, the sell tax, the secured badge, the outcome) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

The level, the tax and the lid follow the displayed multiplier. Nothing drawn here changes the committed outcome. `prefers-reduced-motion` slows the ambient motion (the swarm and the drips too), holds the lid still at a tilt that follows the tension instead of turning it, and turns off the shake.

Run `npm run dev` from the repository root and open the Honeypot URL it prints. Join with 50 local credits, then cash out during a running round to pull the paw. `npm run build` produces the three publishable files in `dist/honeypot/`.
