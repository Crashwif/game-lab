# Bonding Curl

Balloon Pump, but the balloon is his arm. Gigachad, the only grayscale thing at Degen Fitness, curls a dumbbell in profile; the bicep swells along the curve of the displayed multiplier, puffs with every rep, goes veiny, then red, then shiny, tears its sleeve at 2.3×, and reads its own pressure on a cuff. His face never moves: the tension lives in the arm, the sweat, the cracking mirror and the crowd with their phones. Past 10× an arrow points at the legs he never trained. An accepted cashout drops the weight (it cracks the floor), turns his head to kiss the peak, drops the shades, and sends hearts up from the girls while the arm keeps growing. The crash is snap city: the bicep bursts into a seeded cloud of protein powder, the arm hangs like a noodle, the dumbbell sinks through the floor, the girls walk out, and one tear crosses the stone face.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `gym.ts`: the set shared with Pump & Dump: the mirror wall with the round's chart and its cracks, posters, rack, cooler, the crowd with heckles and hearts, and the live phone overlay.
- `curler.ts`: the profile rig with stick legs, the fixed face, the curling forearm, the bicep as a pressure volume with veins and sheen, the sleeve tear, the cuff gauge, the kiss and the shades, the seeded burst and the noodle.
- `scene.ts`: composition, milestone heckles, the leg-day arrow, the HUD (captions, multiplier, the peak readout, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (4.70×) used by the gallery.

Rep rate, radius, colour, veins, cracks and the crowd follow the displayed multiplier; nothing in the presentation changes the committed outcome. The burst is seeded from the crash point so a replay scatters the same way every time. `prefers-reduced-motion` turns off the screen shake.

Run `npm run dev` from the repository root and open the Bonding Curl URL it prints. Join with 50 local credits, then cash out during a running round to drop the weight. `npm run build` produces the three publishable files in `dist/bonding-curl/`.
