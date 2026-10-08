# Beyond the Colony

A large, scarfed penguin quits the huddle and discovers that even the forbidden mountain has an HR department. Broad waddles, crouched takeoffs, belly slides, windmilling flippers, airborne rolls and a travelling-wave scarf turn its existential crisis into an action comedy. The midnight Antarctic scene has luminous jade aurora, layered icy peaks and an increasingly absurd office economy.

This is an independent Nietzschean Penguin community game concept, targeting Solana mint `8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump`. All illustration is original Canvas 2D code. There are no project logos, documentary footage or external recordings, and no claim of official affiliation, creator approval or room/token linking. The satire contains profanity. Credits have no monetary value.

## Play and preview

From the repository root with Node 24 and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- beyond-the-colony
```

The recorded-preview URL includes `?mode=replay`; remove the query for live emulator play. Join during betting and use **Cash out** during the round. Space performs the available action unless another control has focus. **Sound** cycles off, on and effects only.

A seven-second scene has anticipation, a confrontation, a large physical response and a recovery. Twenty-four scripted beats span 168 seconds, then continue with rotating dialogue and tier-dependent props:

- The colony demands a return to work while the penguin leaps away and waves its resignation.
- A compliance drone scans the ice; the penguin belly-slides beneath it and hops upright.
- A seal boss slams a performance review; the penguin recoils, winds up and rejects it with a slap.
- An enlightenment booth requests a card; the penguin jumps past the paywall.
- A giant feedback fan drives a sliding, flailing struggle into a recovery hop.
- A cosmic overman transformation lifts the penguin into an aurora with outstretched wings and a golden scarf.
- Summit HR opens a paperwork portal; the penguin ducks, vaults and rejects the forms.
- A flying urgent fish sends the penguin into a panicked airborne roll.

Later scenes add workplace committees, drone supervision, a crowned seal board, subscription tiers and increasingly personal fish correspondence. Waiting and betting use the page clock for breathing, head turns, flipper fidgets, scarf motion, weather and colony acting.

Only backend-confirmed cash-out launches a smug escape to a floating cloud lounge. Sunglasses, a resignation letter and a parasol persist through the round's crash. The backend crash alone fractures the shelves and triggers the avalanche: the penguin tumbles into a cubicle, with the office-return punchline visible within 1.4 seconds. The ending remains visible for late entry. No prop, visual tension or action selects or forecasts the crash point.

## Structure and presentation

- `scene.ts` composes authoritative phases, outcomes, effects and the compact HUD.
- `choreography.ts` reconstructs pose, terrain travel, contacts, takeoffs and landings directly from elapsed round time.
- `motion.ts` supplies analytic easing, deterministic decorative noise and the timed comedy script.
- `penguin.ts` articulates two-bone legs, flippers, body, head, expression, pack and scarf.
- `actors.ts` draws the colony, drones, seal boss, kiosks, fan, cosmic effects and airborne fish.
- `landscape.ts` draws the sky, shelves, snow, avalanche, cubicle and cloud lounge.
- `portrait.ts` composes narrow screens as a large acting close-up, readable captions and multiplier, plus a wide inset retaining secondary actors and surrounding danger.

The mobile stage selects portrait composition by viewport width, including short embedded frames. The desktop scene uses 960 × 540 coordinates; portrait uses 540 × 752. Late entry, replay restart and instant crashes reconstruct from supplied state. Reduced motion removes camera shake, parallax, particles, fast travel, spinning and continuously animated joints, while retaining the current confrontation, expression and settled outcome.

`main.ts`, `audio.ts` and the CSS before `/* game */` remain canonical shell copies. `clips.json` is empty: an opt-in drum-and-bass score and timed slips, impacts, drone cues, stamps and transformation stingers use the shared audio helper. Replay preserves the template's verified seed, hash and result with this game's ID.

Build output is `dist/beyond-the-colony/index.html`, `game.generated.js` and `style.css` for Studio's **Your own renderer** flow. The source pack has no runtime network requests or external assets. Publication and room eligibility/linking follow the platform's creator process.
