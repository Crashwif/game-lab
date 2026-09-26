# The Trenches

A launch seen from a trench. Frog soldiers in helmets crouch in the mud under a sky of shell bursts and a chart-shaped ridge line; the whistle blows, the squad goes over the top and advances with the multiplier while the loot on the ridge (bags, a Lambo, a moon) gets closer. Tension: the ridge steepens, the mud sucks at boots, a scope glint appears in the shell holes, the artillery whistles get closer, rats and jeet-frogs run back past the line, and the sergeant's field phone rings with "buy the dip". An accepted cashout is your frog diving back into the trench with a bag: a helmet clang, a cigar, a SURVIVED THE TRENCHES badge. The crash is the nuke: a seeded mushroom cloud on the ridge, the frogs flung back into the trench in silhouette, helmets raining down, the ridge a crater and the field phone reading DEV SOLD.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `field.ts`: the battlefield: the parallax sky and shell bursts, the ridge line, the loot, the mud and shell holes, the rats and jeets, and the nuke with its shockwave, silhouettes, helmet rain and crater.
- `squad.ts`: the trench and the squad: the frog marching rig, the sergeant and his field phone, the whistle, your frog's dive back, and the KIA state.
- `scene.ts`: composition, the HUD (captions, multiplier, metres advanced, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

March cadence, ridge steepness, the whistles, the rats and the scope glint all follow the displayed multiplier; nothing in the presentation changes the committed outcome. Comedy only: no insignia, no gore. `prefers-reduced-motion` turns off the shake, the shockwave flash and the shell flicker.

Run `npm run dev` from the repository root and open the Trenches URL it prints. Join with 50 local credits, then cash out during a running round to dive back into the trench. `npm run build` produces the three publishable files in `dist/the-trenches/`.
