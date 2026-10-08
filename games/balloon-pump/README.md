# Balloon Pump Test

A complete Canvas 2D reference with meme energy: a pale, increasingly worried dev in a pink knitted hat pumps his own memecoin with a floor pump. The coin is `$HOTAIR`, a balloon with a face of its own that fills with the displayed multiplier, and the crash event blows it up in his face and knocks him over. An accepted cashout drops a pair of sunglasses on him. An SEC intern rises out of the bush on the right once there is something to aim at, draws a slingshot back further with every multiple and trembles near the top; the crash is his shot, and the balloon goes a few frames after the stone leaves the pouch, with a hit-stop, a punch of the camera and a moment of slow motion for the shreds.

- `motion.ts`: exact closed-form damped springs, the asymmetric pump stroke (push, squeeze, lift, regrip), easing and a seeded generator.
- `pumper.ts`: the rig. The hands are pinned to the handle, two-bone joints solve the arms and legs, and the torso, head and pom-pom trail the stroke on springs of different stiffness. Also the pump with its `PUMP` label and gauge, and the face: sweat, laser eyes, tears, shades.
- `balloon.ts`: the balloon on its tether. Limp on the grass until the first strokes lift it, then buoyant sway, a puff with every gulp of air, squash and stretch, the `$HOTAIR` ticker printed on the rubber (it widens as the rubber thins), a scared face, and a seeded burst of rubber shreds.
- `sniper.ts`: the SEC intern in the bush: the rise, the aim that tracks the balloon, the draw and the tremble that follow the multiplier, the shot and the stone's flight.
- `audio.ts`: the page's shared procedural music and effects (the same file in every game). Balloon Pump plays chiptune that speeds up and fills out with the multiplier, chuffs and squeaks with every stroke, zaps when the laser eyes come on, ratchets as the slingshot draws, rings a register on the cash-out, and tape-stops into the pop.
- `scene.ts`: composition and the meme layer: dusk sky and moon, the round's own "stonks" chart, the hose with air packets travelling down it, captions, the multiplier readout and the burst text.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

The pump cadence, the gauge, the sweat, the lasers and both faces follow the displayed multiplier; nothing in the presentation changes the committed outcome. All motion is stepped with the real frame time, so a slow tab and a fast one draw the same trajectories. The published game uses full animation regardless of browser motion preferences. Sound stays off until the player turns it on with the Sound button.

Run `npm run dev` from the repository root. Join with 50 local credits, then cash out during a running round. The backend decides whether the exit arrives before the crash. `npm run build` produces the three publishable files in `dist/balloon-pump/`.
