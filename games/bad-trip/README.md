# Bad Trip

**The bass has a digestive system.** An adult raver keeps taking fictional party drugs while the room turns into a predatory wellness festival. Leave on a confirmed cash-out, or become the drop, the monster's dinner, or the collective consciousness's newest unpaid moderator.

## Play and preview

Use the repository's Node 24 and npm 11, then run from its root:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- bad-trip
```

Open the printed replay URL. Remove `?mode=replay` for live play against the local emulator. Join during betting; cash out while running. Space performs the available shared-shell action. Sound cycles through off, on and effects only. Credits have no monetary value.

The bundled 9.07× recording keeps the template's verified seed/hash/result together; only its game ID changes. Its final multiplier selects the monster's cosmetic ending. Other revealed crash multipliers show the music and collective variants.

## The second pass

- Eight escalating acts, 32 act lines, 24 overtime lines, crowd reactions and separate payoff scripts. The jokes target wellness grift, festival commerce, influencer spirituality and the protagonist's ego.
- A huge speaker-mouth with a gold tooth, moving tongue, eye-covered speakers, sound tentacles, a tracking-pixel angel and increasingly intrusive spiritual subscriptions.
- A conspicuously adult protagonist with stubble, an exhausted face, fixed-length arm joints, a repeated consumption gesture, ghost selves and a third eye that should have remained closed.
- Three distinct crash sequences: pulled into a giant mouth, dissolved into a waveform, or assimilated into the crowd. A confirmed exit opens a portal to outside and a sober friend.
- Original Canvas 2D illustration, violet/acid typography, procedural hardstyle audio and a separate 540×800 phone composition. No downloaded art, fonts, music, runtime services or additional dependencies.

## Outcome contract

`main.ts`, `audio.ts` and the shared CSS prefix are canonical copies. The host and SDK own betting, verification, replay and outcomes. `presentation.ts` observes `SceneView`; elapsed time and the displayed multiplier affect presentation only. An exit starts only after `cashoutX100` is confirmed. A later room crash cannot replace a successful exit.

The final revealed multiplier chooses among three visual crash variants; it never chooses whether or when a crash happens. Live crash endings can finish briefly during the next waiting/betting phase. A new round overrides that encore. Late entry renders the settled result quietly. Motion stays enabled regardless of browser motion preference, following the repository's animation contract.

`canvas.gameScene` exposes read-only diagnostic observations for QA, with no intents, mutable controls or future outcome data. The `story` live region mirrors each changed dialogue line for assistive technology.

## Files and checks

| File | Purpose |
| --- | --- |
| `scene.ts` | Shared-shell scene adapter, HUD and audio cues |
| `presentation.ts` | Confirmed outcome transitions, encore and stage selection |
| `content.ts` | Dialogue, acts, reactions and three ending scripts |
| `art.ts`, `setpieces.ts`, `ink.ts` | Vector characters, environment, effects and fixed-length arm solver |
| `presentation.test.mjs` | Outcome transitions, long rounds, frame rates, rigs, geometry and audio cues |
| `gallery.json`, `replay.json`, `clips.json` | Source-pack metadata, verified recording and procedural audio fallback |

```sh
npm run build
npm run typecheck
npm run check
npm test
node --test games/bad-trip/presentation.test.mjs
node --test games/bad-trip/browser.test.mjs
npm run test:browser
```

Browser tests need the repository's Playwright Chromium installed. Also inspect the selected preview at 375px and desktop widths: waiting, betting, 1× crash, all three endings, a confirmed exit followed by a room crash, replay/restart, short embedded frames and three-minute rounds. The game-specific tests are separate from the repository-wide `npm test` command.

All dialogue and artwork are original fiction. The game uses the shared procedural audio helper; `clips.json` is intentionally empty. Build output is under `dist/bad-trip/`. See [integration](../../docs/integration.md), [animation](../../docs/animation.md) and [contributing](../../CONTRIBUTING.md) for the host and source-pack contracts.
