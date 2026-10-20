# Seize the Drip

**Eat the rich. Wear the evidence.** A masked adult revolutionary enters Maison du Capital to dismantle capitalism and discovers a very flattering silhouette. Choose the next luxury item while the haul, outfit and excuses grow. A confirmed cash-out summons Papa's SUV; a revealed crash turns the collection into police evidence.

## Play

From the repository root with Node 24 and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- seize-the-drip
```

Open the printed replay URL, or its live URL to join the local emulator. Join during betting and cash out while running. Credits have no monetary value.

| Input | Action |
| --- | --- |
| Bag / Watch / Trainers / Coat, or keys 1–4 | Choose the next cosmetic pickup |
| Tap a display card | Choose that item |
| Auto, or key 0 | Cycle through all four categories |
| Cash out, or Space with the canvas focused | Ask the host to cash out |
| Sound | Cycle off / on / effects only |

Loot selection never changes stake, payout, crash probability or the cash-out window. A pickup occurs every 2.2 seconds of displayed running time. The twelve visible accessories are a bounded illustration of the haul; the latest selections replace older props on long rounds. Auto works without player input, including in the gallery. The host retains all financial and round authority.

## The spectacle

- Eight multiplier-driven acts, 32 act lines, 24 rotating overtime lines, five supporting-character asides and separate outcome scripts. From "No gods. No masters. No receipts" to "Who touched MY bag? Suddenly I understand the police."
- Original Canvas 2D art: cream marble, burgundy carpet, brass-framed merchandise, a Paris doorway, hanging price tags and fake luxury labels Louis Vandal, Yves Saint Loot and Karl Marks-Up.
- A fixed-limb masked character with blinking eyes, talking poses, swinging accessories, designer trainers, a gold chain, a watch, cashmere puffer, fur collar, COMRADE VIP sash and eventual crown. A placard gradually changes from EAT THE RICH to HANDS OFF MY STUFF.
- An employee with a broom, a theory guy carrying unread Capital, an influencer taking selfies, an opportunistic owner and a broke student carrying everyone else's bags.
- Accepted exit: distance-driven walk, revolving door, chauffeur SUV with a PAPA plate and VIVE LA TRUST FUND banner.
- Revealed crash: brief anticipation, raised hands, seeded falling accessories, police with RETURNS DESK shields, evidence trolley and an unfurling returns receipt. "Can I at least keep the outfit for the mugshot?"
- Procedural club music, pickup chimes, escalation cues and a siren. `clips.json` is empty, so playback requires no downloaded audio. The prompt manifest includes a distinct full-score recipe for optional future generation.
- Separate landscape and 540×800 portrait compositions. Accessible DOM choices, visible keyboard focus, an announced story caption and preserved shared-shell controls.

The characters, boutique, brands and dialogue are original fiction. This is a satire of luxury consumption and class hypocrisy, not a reconstruction of a specific real riot. Police action is cartoon confiscation.

## Round and lifecycle contract

`main.ts`, `audio.ts` and the CSS prefix remain exact canonical copies. `presentation.ts` observes only `SceneView`; no scene module reads or invents a future outcome. Police cannot appear before the host reveals a crash. Cash-out starts only after a non-null confirmed `cashoutX100`, and a later room crash cannot overwrite that success.

Live endings can finish briefly during waiting/betting, labelled LAST ROUND. New running rounds and instant crashes override that encore. Late entry reconstructs the proper pose and a bounded haul without replaying missed cues. Late crashes stay quiet, including through the collection impact. All animation remains enabled regardless of browser motion preference, following the repository contract.

Input ignores modified keys, key repeat and editable controls; Space belongs to the shared shell. Scene disposal removes all game listeners. The `canvas.gameScene` diagnostic contains copied observations, with no mutable controller, intents or future result.

## Files and validation

| File | Responsibility |
| --- | --- |
| `scene.ts` | Rendering adapter, HUD, accessibility and sound cues |
| `presentation.ts` | Confirmed outcomes, stages and ending encore |
| `loot.ts`, `input.ts`, `layout.ts` | Bounded cosmetic inventory, disposable controls and responsive hit areas |
| `content.ts` | Acts, excuses, asides and outcome scripts |
| `art.ts`, `characters.ts`, `props.ts`, `ink.ts` | Boutique, cast, fixed-length rigs, held items and endings |
| `presentation.test.mjs` | Outcome isolation, long rounds, geometry, cues and inventory |
| `browser.test.mjs` | Built bundle, real shell/host bridge, interaction, responsive states and replay |
| `gallery.json`, `replay.json`, `clips.json` | Gallery metadata, verified recording and procedural audio fallback |

```sh
npm run build
npm run typecheck
npm run check
npm test
node --test games/seize-the-drip/presentation.test.mjs
node --test games/seize-the-drip/browser.test.mjs
npm run test:browser
```

Browser tests require the repository's Playwright Chromium installation. Optional `GAME_QA_SHOTS=/absolute/path` saves QA screenshots; these are not published gallery captures. Inspect waiting, betting, early and late crashes, accepted exits, restart, both screen orientations and three-minute rounds. The game-specific tests are separate from `npm test`.

The bundled 9.07× replay preserves the template's verified seed/hash/result and changes only the game ID. All runtime code and assets are self-contained, with no new dependencies or runtime network services. Build output is `dist/seize-the-drip/`. See [integration](../../docs/integration.md) and [animation](../../docs/animation.md).
