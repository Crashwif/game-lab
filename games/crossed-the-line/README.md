# Crossed the Line

**Keep preaching. Heaven is taking notes.** Father Les Morals turns a sermon into an increasingly shameless pitch for subscription salvation. A confirmed cash-out lets him say a timely amen. A revealed crash sends the enormous crucifix through his pulpit in a cartoon act of divine feedback.

## Play and preview

Use the repository's Node 24 and npm 11, then run from its root:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- crossed-the-line
```

Open the printed replay URL. Remove `?mode=replay` for live play against the local emulator. Join during betting; cash out while running. Space performs the available shared-shell action. Sound cycles through off, on and effects only. Credits have no monetary value.

The bundled 9.07× recording keeps the template's verified seed/hash/result together; only its game ID changes.

## The second pass

- Eight increasingly outrageous acts, 32 act lines, 24 overtime lines, congregation reactions and separate cash-out/crash scripts. Father Les Morals pitches outsourced confession, enterprise sin, AI absolution and a paywall at the pearly gates.
- An illustrated luxury-grift church with stained glass, a gold private jet, a Holy Fans ring light, a leased verification halo and an endlessly printing tap-to-repent terminal.
- A smug priest with talking expressions, expressive gestures, fixed-length arm joints, a gold chain and a self-preserving exit walk. The congregation records the scandal on a phone.
- An irritated heavenly face, a falling crucifix, pulpit demolition, ballistic coins and receipts, a flying hairpiece and verification badge, and a one-star review from Heavenly HR. The priest's shoe keeps moving; the terminal keeps asking for donations.
- Original Canvas 2D artwork, cream/gold/burgundy styling, procedural organ-like ambience and a separate 540×800 phone composition. The outcome is non-graphic cartoon slapstick.

The priest, congregation, church and dialogue are fictional. The satire targets a character's greed, hypocrisy and monetisation of belief. No real person's likeness, quotations, footage or alleged death are reproduced.

## Outcome contract

`main.ts`, `audio.ts` and the shared CSS prefix are canonical copies. The host and SDK own betting, verification, replay and outcomes. `presentation.ts` observes `SceneView`; speech and spectacle escalate with the displayed multiplier, without setting a crash point.

The crucifix cannot fall while the host is running. Its fall begins only after `phase === 'crashed'`, landing at 1.08 seconds of revealed crash age. An exit starts only after `cashoutX100` is confirmed. A subsequent room crash cannot overwrite that successful exit.

Live endings can finish briefly during the next waiting/betting phase, with the HUD labelled last round. A new running round or instant crash overrides the old encore. Late entry renders the settled result quietly. Motion stays enabled regardless of browser motion preference, following the repository's animation contract.

`canvas.gameScene` exposes read-only diagnostic observations for QA, with no intents, mutable controls or future outcome data. The `story` live region mirrors each changed dialogue line for assistive technology.

## Files and checks

| File | Purpose |
| --- | --- |
| `scene.ts` | Shared-shell scene adapter, HUD and audio cues |
| `presentation.ts` | Confirmed outcome transitions, encore and stage selection |
| `content.ts` | Sermons, acts, congregation reactions and payoff scripts |
| `art.ts`, `setpieces.ts`, `ink.ts` | Church, characters, crucifix, debris and fixed-length arm solver |
| `presentation.test.mjs` | Outcome transitions, long rounds, frame rates, rigs, geometry and audio cues |
| `gallery.json`, `replay.json`, `clips.json` | Source-pack metadata, verified recording and procedural audio fallback |

```sh
npm run build
npm run typecheck
npm run check
npm test
node --test games/crossed-the-line/presentation.test.mjs
node --test games/crossed-the-line/browser.test.mjs
npm run test:browser
```

Browser tests need the repository's Playwright Chromium installed. Also inspect the selected preview at 375px and desktop widths: waiting, betting, early and late crashes, a confirmed exit followed by a room crash, replay/restart, short embedded frames and three-minute rounds. The game-specific tests are separate from the repository-wide `npm test` command.

All artwork and dialogue are original fiction. Sound uses the shared procedural audio helper; `clips.json` is intentionally empty. No downloaded assets, runtime services or new dependencies are required. Build output is under `dist/crossed-the-line/`. See [integration](../../docs/integration.md), [animation](../../docs/animation.md) and [contributing](../../CONTRIBUTING.md).
