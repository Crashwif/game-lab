# Andy's Loud Garden

Andy grows a very conspicuous ganja garden behind his house. The patch grows with the room's displayed multiplier, from little seedlings to a leafy jungle. Andy is a rig built from shapes: two-bone arms and legs solve toward hand and foot targets, the torso and head follow on springs, his floppy ears trail every move, and the watering can tips over the bed on its own cycle with the water arcing from the rose into the soil. He breathes and shifts his weight while he waits, pours faster and sweats as the garden gets louder, and glances over his shoulder at the street. At the crash, a frozen beat, then he drops the can, jumps and throws his hands up, a patrol car pulls up, two officers enter, leaves scatter and a **BUSTED** stamp and garden-closure tape fill the scene.

An accepted cashout drops the can, lowers the shades, hands him a harvest basket and turns him for home with a stride that follows his speed. The police still close the patch when the round crashes; the player's accepted exit stays visible. The harvest is a visual celebration only. Credits have no monetary value, and the scene never determines or changes a crash or cashout result.

![Andy watering the growing garden](preview.png)

![The police close the garden at the crash](busted.png)

## Play and preview

From the repository root, use Node 24 and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- andys-loud-garden
```

The preview prints the replay address. Remove `?mode=replay` to join the emulator with local credits. Use **Join round**, then **Cash out**, or press **Space** while the game has focus. Embedded play uses the host's stake and credit controls. **Restart replay** repeats the verified fixture. **Sound** enables the procedural lo-fi loop, watering cues, cashout chime and police siren; audio starts muted.

The shared shell handles waiting, betting, running, crash, reconnect and replay. The scene reads only its `SceneView`; plant size is a visual response to the supplied multiplier, and the rig only presents what the round already decided. A round met late (a hidden tab, a page opened mid-round) settles the rig straight into its pose. With reduced motion, the springs settle instead of swinging, so there is no bobbing, pouring cycle, water or ear flap, the plant sway, flashing lights and screen shake are suppressed, and the police arrive in their settled positions.

`npm run build` writes the publishable HTML, JavaScript and CSS to `dist/andys-loud-garden/`. Validate with `npm run typecheck`, `npm run check` and `npm test`. The contribution slug and replay game ID are both `andys-loud-garden`; `gallery.json` registers this game independently of Balloon Pump.

## Source and artwork

- `scene.ts` composes the backyard, the growth stages, Andy's drive (idle, watering, harvest, busted), the water stream, captions and audio cues.
- `andy.ts` is Andy: the rig state and its springs, the pose solver, the mode changes (the can leaving his hand, the startled hop, the turn for home), the face with its moods, the can, the basket and the water stream.
- `motion.ts` is the motion toolkit shared with the other rigged references: exact damped springs, easing and deterministic noise.
- `drawing.ts` supplies Canvas 2D shapes and serrated leaves.
- `garden.ts` draws the dusk backyard, plants, raised beds and scattered leaves.
- `police.ts` draws the patrol car, officers, flashlights and closure tape.
- `main.ts`, `audio.ts` and the base styles are the canonical Game Lab shell. All music and effects are synthesized by its audio engine; there are no recorded clips. The rig's events (a pour starting, the can hitting the ground, a footfall) cue the effects.
- `replay.json` uses the repository's verified example round with this game's ID.

Everything on the page is drawn in code; the game ships no images and makes no artwork requests. Andy is a character from Matt Furie's **Boys Club**; the rig's look (golden yellow, floppy ears, heavy-lidded blue eyes, the broad muzzle and grin, teal overalls over a cream T-shirt, purple boots) references the [Andy project website](https://boysclubandy.com/). No affiliation with or endorsement by the character's creator or the Andy project is implied.

The gallery's `open` setting permits Game Lab remixing with no derivative royalty. Character rights remain with their respective owners.

## Visual direction and small screens

The scene now introduces physical presentation acts at 32, 52, 75, 100, 125 and 145 seconds, followed by bounded recurring acts for unusually long rounds. New props accompany changes in character effort, with a short easing of tension before renewed activity. `acts.ts` reads elapsed time only; it cannot choose an outcome or promise that a round will last this long.

On narrow screens, `portrait.ts` presents an enlarged character/detail view, a small overview that preserves the location, and a readable current line from the actual dialogue/chat/monitor state. The canonical shell still owns controls, round state and accepted cashouts. Reduced motion removes the new prop oscillation.
