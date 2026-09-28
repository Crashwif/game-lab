# Blanket Champ

A stamina crash game starring a couple tucked under a quilt. Two expressive heads peek out on pillows: a red-sweatband champ who goes from smug to sweaty to exhausted, and a partner supplying the side-eye. Four distinct feet kick at the other end: striped red socks and bare feet with heels, arches and toes. The quilt has a turned-down edge, stitched folds and two broad moving rises, so the characters read as a couple in bed. A visible arm connects the champ to his grip on the headboard. Behind the bed, three rows of Wojak fans with foam fingers and signs, a commentary booth with a LIVE light, and a bookie. The quilt's tempo climbs with the displayed multiplier and the room reacts: the headboard knocks the wall and cracks it, the lamp wobbles, the glass of water walks off the nightstand, the cat leaves, the neighbour's fist comes through the wall, the bed legs buckle, the crowd does the wave, and past 10× the fire brigade is at the window. An accepted cashout walks your supporter to the bookie for the bag and the shades. The crash is the champ finishing: the quilt settles, the heads slump, the feet relax, a puff, an arm flops over the side and gives a thumbs-up, small falling confetti for a legendary number, and the fans still holding tickets put their heads in their hands.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `room.ts`: the bedroom, quilt with moving seams and a hanging hem, character layering, connected headboard grip, lamp, glass, cat, fist, cracks, buckling legs, the finish, puffs and confetti.
- `sleepers.ts`: pillows, expressive faces, sweatband, sweat drops, staggered socked and bare-foot kicks, and changing speech bubbles ("socks stay ON.", "bro is buffering", "was that it?").
- `crowd.ts`: the bleachers, the fans (bob, wave, hype, sulk), your supporter's walk to the bookie, the bookie and the bag, the commentary booth.
- `scene.ts`: composition, the fire brigade, the HUD (captions, commentary line, multiplier, stamina clock, the secured badge) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (10.31×) used by the gallery.

Everything below the faces and above the feet stays under the duvet; the humour is innuendo, expressions and the room. The result stamp sits on the quilt so it leaves both faces visible. Tempo, crowd noise, the props and the commentary all follow the displayed multiplier; nothing in the presentation changes the committed outcome. `prefers-reduced-motion` turns off the shake.

Run `npm run dev` from the repository root and open the Blanket Champ URL it prints. Join with 50 local credits, then cash out during a running round to collect. `npm run build` produces the three publishable files in `dist/blanket-champ/`.
