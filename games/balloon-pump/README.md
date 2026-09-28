# Balloon Pump

A complete Canvas 2D reference with meme energy: a pale, increasingly worried dev in a pink knitted hat pumps his own memecoin with a floor pump. The coin is `$HOTAIR`, a balloon with a face of its own that fills with the displayed multiplier, and the crash event blows it up in his face and knocks him over. An accepted cashout drops a pair of sunglasses on him.

- `motion.ts`: exact closed-form damped springs, the asymmetric pump stroke (push, squeeze, lift, regrip), easing and a seeded generator.
- `pumper.ts`: the rig. The hands are pinned to the handle, two-bone joints solve the arms and legs, and the torso, head and pom-pom trail the stroke on springs of different stiffness. Also the pump with its `PUMP` label and gauge, and the face: sweat, laser eyes, tears, shades.
- `balloon.ts`: the balloon on its tether. Limp on the grass until the first strokes lift it, then buoyant sway, a puff with every gulp of air, squash and stretch, the `$HOTAIR` ticker printed on the rubber (it widens as the rubber thins), a scared face, and a seeded burst of rubber shreds.
- `scene.ts`: composition and the meme layer: dusk sky and moon, the round's own "stonks" chart, the hose with air packets travelling down it, captions, the multiplier readout and the burst text.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

The pump cadence, the gauge, the sweat, the lasers and both faces follow the displayed multiplier; nothing in the presentation changes the committed outcome. All motion is stepped with the real frame time, so a slow tab and a fast one draw the same trajectories. `prefers-reduced-motion` turns off the screen shake, flicker and twinkle.

Run `npm run dev` from the repository root. Join with 50 local credits, then cash out during a running round. The backend decides whether the exit arrives before the crash. `npm run build` produces the three publishable files in `dist/balloon-pump/`.
