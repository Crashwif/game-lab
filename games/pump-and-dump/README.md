# Pump & Dump

A bench press at Degen Fitness, seen from the feet. A shirtless, oiled, square-jawed lifter works reps whose cadence follows the displayed multiplier; at each milestone an arm reaches in from the edge of the frame and slides another plate onto the bar. The bar bends and shakes, the arms tremble, the face reddens and grits, veins show, sweat flies, the spotter behind his head stays on his phone, and the crowd along the mirror films vertical and heckles. An accepted cashout racks the bar: the spotter helps, a chalk cloud, the lifter sits up in shades and flexes for the phones, then the spotter takes the bench with nobody spotting him. The crash drops the bar on whoever is under it and sends the plates bouncing and rolling out of frame; the spotter, if he was still spotting, looks up too late.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `gym.ts`: the set shared with Bonding Curl: the mirror wall that shows the round's chart, posters, rack, cooler, the crowd with heckles and hearts, and the live phone overlay.
- `bench.ts`: the bench, the bent bar and the edge-on plates, the lying rig and its face, the standing figures (spotter, the chad flexing), plate arrivals, the re-rack and hand-over, and the seeded dump.
- `scene.ts`: composition, the HUD (captions, multiplier, the load readout, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (4.35×) used by the gallery.

Rep rate, plates, bend, tremor, the face and the crowd all follow the displayed multiplier; nothing in the presentation changes the committed outcome. The plates scatter from a generator seeded with the crash point so a replay dumps the same way every time. `prefers-reduced-motion` turns off the screen shake.

Run `npm run dev` from the repository root and open the Pump & Dump URL it prints. Join with 50 local credits, then cash out during a running round to re-rack. `npm run build` produces the three publishable files in `dist/pump-and-dump/`.
