# Blanket Champ

A stamina crash game played entirely under a duvet. A couple is in bed, fully covered: the only things visible are the lump, two pairs of feet at the foot of the bed and a hand gripping the headboard. Behind the bed, three rows of Wojak fans with foam fingers and signs, a commentary booth with a LIVE light, and a bookie. The lump's tempo climbs with the displayed multiplier and the room reacts: the headboard knocks the wall and cracks it, the lamp wobbles, the glass of water walks off the nightstand, the cat leaves, the neighbour's fist comes through the wall, the bed legs buckle, the crowd does the wave, and past 10× the fire brigade is at the window. An accepted cashout walks your supporter to the bookie for the bag and the shades. The crash is the champ finishing: the lump goes flat, a puff, an arm flops over the side and gives a thumbs-up, confetti for a legendary number, and the fans still holding tickets put their heads in their hands.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `room.ts`: the bedroom and everything that reacts to the beat: the duvet lump with shifting folds, the feet, the knuckles, the headboard, lamp, glass, cat, fist, cracks, buckling legs, the finish, puffs and confetti.
- `crowd.ts`: the bleachers, the fans (bob, wave, hype, sulk), your supporter's walk to the bookie, the bookie and the bag, the commentary booth.
- `scene.ts`: composition, the fire brigade, the HUD (captions, commentary line, multiplier, stamina clock, the secured badge) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (10.31×) used by the gallery.

Nothing under the duvet is ever drawn; the humour is innuendo and the room. Tempo, crowd noise, the props and the commentary all follow the displayed multiplier; nothing in the presentation changes the committed outcome. `prefers-reduced-motion` turns off the shake.

Run `npm run dev` from the repository root and open the Blanket Champ URL it prints. Join with 50 local credits, then cash out during a running round to collect. `npm run build` produces the three publishable files in `dist/blanket-champ/`.
