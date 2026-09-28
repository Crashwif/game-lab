# Gas Fees

A man in a suit holds one in inside a packed glass lift. The floor indicator is the multiplier. Every milestone the doors open and someone else squeezes in from a fixed roster: a Chad, a grandma with a pug, a Shiba in the wif hat, a Karen, a bro filming vertical, a nun, a whale in a suit that shoves everyone toward the middle, a bride, a delivery guy with a stack of boxes, until the load plaque flashes red. His face goes from pale to red to purple, his cheeks puff, his knees buckle, he trembles, a vein appears, the cable creaks, the light flickers, and past 5× a green haze gathers at the ankles while the pug sniffs first. An accepted cashout is his floor: the doors open, he strides out into the lobby, shades drop, and the doors close on everyone else. The crash is the release: a green cloud fills the cabin, the glass fogs, the light dies, the cabin bounces on its cable, the pug faints, the wig lifts, the nun crosses herself, the whale blows, and everyone stares at him. If he had already got off, the cabin is crop-dusted behind him.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `cabin.ts`: the shaft and cables, the cabin shell with its doors and the lobby behind them, the indicator and load plaque, the haze, the seeded gas cloud, the fogged glass, the flicker and the bounce.
- `riders.ts`: the suit (colour, cheeks, tremble, knees, sweat, the walk out, the relief and the innocent whistle) and the passenger roster with their arrivals, glances and crash reactions.
- `scene.ts`: composition in depth order (lobby, doors, riders, air), the HUD (captions, multiplier, GWEI readout, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (11.62×) used by the gallery.

Arrivals, colour, haze, flicker and the indicator all follow the displayed multiplier; nothing in the presentation changes the committed outcome. The burst is seeded from the crash point so a replay fills the cabin the same way every time. `prefers-reduced-motion` turns off the shake and the flicker.

Run `npm run dev` from the repository root and open the Gas Fees URL it prints. Join with 50 local credits, then cash out during a running round to get off at your floor. `npm run build` produces the three publishable files in `dist/gas-fees/`.
