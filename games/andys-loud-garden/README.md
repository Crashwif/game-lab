# Andy's Loud Garden

Andy grows a very conspicuous ganja garden behind his house. The patch grows with the room's displayed multiplier, from little seedlings to a leafy jungle. Water droplets, swaying plants, warm garden lights and Andy's changing expressions bring the scene to life. At the crash, a patrol car pulls up, two officers enter, leaves scatter and a **BUSTED** stamp and garden-closure tape fill the scene.

An accepted cashout puts Andy in sunglasses with a harvest basket and sends him home. The police still close the patch when the round crashes; the player's accepted exit stays visible. The harvest is a visual celebration only. Credits have no monetary value, and the scene never determines or changes a crash or cashout result.

![Andy watering the growing garden](preview.png)

![The police close the garden at the crash](busted.png)

## Play and preview

From the repository root, use Node 24 and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- andys-loud-garden
```

The preview prints the replay address. Remove `?mode=replay` to join the emulator with local credits. Use **Join round**, then **Cash out**, or press **Space** while the game has focus. Embedded play uses the host's stake and credit controls. **Restart replay** repeats the verified fixture. **Sound** enables the procedural lo-fi loop, watering cues, cashout chime and police siren; audio starts muted.

The shared shell handles waiting, betting, running, crash, reconnect and replay. The scene reads only its `SceneView`; plant size is a visual response to the supplied multiplier. With reduced motion, Andy's bobbing, water particles, plant sway, flashing lights and screen shake are suppressed, and the police arrive in their settled positions.

`npm run build` writes the publishable HTML, JavaScript and CSS to `dist/andys-loud-garden/`. Validate with `npm run typecheck`, `npm run check` and `npm test`. The contribution slug and replay game ID are both `andys-loud-garden`; `gallery.json` registers this game independently of Balloon Pump.

## Source and artwork

- `scene.ts` composes Andy, the growth stages, the harvest exit, captions and audio cues.
- `drawing.ts` supplies Canvas 2D shapes and serrated leaves.
- `garden.ts` draws the dusk backyard, plants, raised beds and scattered leaves.
- `police.ts` draws the patrol car, officers, flashlights and closure tape.
- `andy-sprites.png` is the transparent 1536 × 1024 artwork master: six 512 × 512 poses in a three-column, two-row atlas. `andy-sprites.webp` is the 1152 × 768 runtime atlas, encoded at WebP quality 0.2. `sprites.ts` and `sprite-data-0.ts` embed that WebP as a data URL within the source-pack file and browser-remix input limits. The game makes no artwork requests.
- `main.ts`, `audio.ts` and the base styles are the canonical Game Lab shell. All music and effects are synthesized by its audio engine; there are no recorded clips.
- `replay.json` uses the repository's verified example round with this game's ID.

Andy is a character from Matt Furie's **Boys Club**. The character's appearance references the [Andy project website](https://boysclubandy.com/) and its [Andy illustration](https://boysclubandy.com/images/slider34/asset11.png). The six gardening poses were generated for this game with OpenAI's built-in image generation tool using that illustration as an identity reference. The backyard, plants, officers and car are drawn in code. No affiliation with or endorsement by the character's creator or the Andy project is implied.

The gallery's `open` setting permits Game Lab remixing with no derivative royalty. Character rights remain with their respective owners.

### Artwork prompt

```text
Use case: illustration-story.
Asset type: ONE transparent PNG sprite atlas for a polished 2D cartoon browser game, Andy's Loud Garden.
Reference image: the attached yellow Andy head is an identity reference only. Create original full-body illustrations of the same recognizable Andy from Boys Club: golden yellow skin, floppy doglike ears, big droopy half-lidded blue eyes, broad muzzle and huge mischievous grin. Do not reproduce the logo text.
Composition: exactly THREE equal columns by TWO equal rows, landscape 1536x1024 canvas; six distinct full-body cutouts, ONE figure wholly inside each 512x512 cell, generous transparent margins, all feet at a consistent baseline, consistent character size, no overlap between cells. Every cutout includes the whole head, hands, feet and props.
Character: stocky, cheerful Andy wearing teal gardening overalls over a cream T-shirt and purple rubber boots. Warm clean cel shading, chunky dark plum ink outlines, expressive comic poses, tactile indie-game art, readable at 240 pixels tall.
Top left: idle Andy grins at the viewer, holding a mint-green watering can at his side.
Top middle: Andy leans slightly forward facing right, pouring the watering can toward a plant below and to the right; one relaxed watering pose, no actual plant.
Top right: same watering action in a second frame, lifted elbow and gently bobbed head, identical clothing and can.
Bottom left: Andy looks nervous and sweaty, eyes wide, still gripping the watering can.
Bottom middle: Andy has been caught, both empty hands raised, startled bulging eyes and mouth open, no restraints, no weapons.
Bottom right: smug Andy in sunglasses carrying a wicker basket with stylized green seven-finger cannabis leaves peeking out, ready to stroll home.
Only six Andy cutouts with the described props. Absolutely no background, no floor, no ground shadows, no grid lines, no captions, no logos, no text, no extra characters. True alpha transparency.
```
