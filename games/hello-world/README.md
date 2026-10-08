# Hello World

A minimal, working foundation for a Game Lab game: “Hello, world!”, the round's multiplier, a circle that grows and bobs faster as the round climbs, a label that calls out milestones, and a line that tells a player (“You're in”) from a spectator (“Watching”). The crash pops the circle; an accepted cash-out stays visible through the crash, which then reads as dodged. Replace the drawing in `scene.ts` to build your own game.

## Run it

From the repository root, using the Node 24 version in `.nvmrc` and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- hello-world
```

Open the printed URL for the recorded preview. Remove `?mode=replay` for live play against the local emulator:

- Replay: <http://127.0.0.1:4500/bundle/hello-world/index.html?mode=replay>
- Live: <http://127.0.0.1:4500/bundle/hello-world/index.html>

Click **Join round** during betting, then **Cash out** while running. Space performs the available action unless another control has focus. **Sound** cycles off, on and effects only; **Restart replay** restarts the recording. Stop and restart the preview after edits. Credits have no monetary value.

## Make it yours

For a first edit, change `GREETING`, `COLOURS` or the `MILESTONES` captions in `scene.ts`, then restart the preview. The commented `draw()` function is the entire visual example; it draws into a 960 × 540 coordinate space that the shell scales for the screen. No art, fonts, recordings, extra rendering libraries or API keys are required.

To add a separate game in this repository:

1. Copy `games/hello-world/` to `games/my-game/` (for example, `cp -R games/hello-world games/my-game`).
2. Update the title and canvas description in `index.html`, the copy in `gallery.json`, and your game's README. Edit `scene.ts` and the rules after `/* game */` in `style.css`.
3. Change only `gameId` in the copied `replay.json` to `my-game`. Keep the recorded seed, hash and result together so the recording still verifies. This fixture does not set live outcomes.
4. Add `my-game` to `GAMES` in `scripts/games.mjs` and a matching row in the root README's reference table at the same position. Add it to `BROWSER_REMIX` if it stays within that budget.
5. Add a distinct music prompt under your slug in `scripts/audio/prompts.json` for the catalog's audio tooling. Recordings are optional: leave `clips.json` as `{}` to use procedural sound. The template's prompt is an example; nothing is generated when you build or preview.
6. Run `npm run build`, `npm run typecheck`, `npm run check` and `npm test`, then `npm run preview -- my-game`.

## Where to work

| File | Purpose |
| --- | --- |
| `scene.ts` | Your drawing, animation and sound cues. Start here. |
| `index.html` | Page title, canvas description and control labels; preserve the shell's IDs and elements. |
| `style.css` | Your colours and page styles after `/* game */`; preserve the shared block above it. |
| `gallery.json` | Gallery name, description, tags, licence and poster time. |
| `replay.json` | A verified 9.07× recorded round, copied from Wen Moon with this game's ID. |
| `clips.json` | Optional embedded audio. Empty by default; sound is generated locally. |
| `main.ts`, `audio.ts` | Unmodified copies of the shared shell and audio helper. Shared changes belong in `scripts/shell/`. |

`SceneView` documents the data you receive each frame. Render `waiting`, `betting`, `running` and `crashed` from `view.phase`. Use `view.currentX100` for the multiplier (150 means 1.50×), `view.elapsed` for running animation and `view.crashAge` for an ending animation. `view.cashoutX100` is present only after backend confirmation; do not treat a click as a successful cash-out. The shell owns SDK connections, intents, interpolation, replay, resizing and the frame loop.

Pacing matters more than anything else in a crash game: about half of all rounds end before 2× (9 seconds in) and two in three before 3×. So the template's `tension` is `1 − 1/x` (0.5 at 2×, 0.67 at 3×) rather than a slow logarithm, its milestones arrive every few seconds through 3×, and a slower `log10` driver keeps rounds past 10× changing. The same tension drives `audio.update()`, so the music opens up as it rises, and a soft tick marks each landing of the bob until the player cashes out. Tension is presentation only: never derive it from the crash point.

Every animation is a pure function of the view, so replays, seeks and late entries draw the same frame. The bob's phase is the integral of its rising rate, never `sin(elapsed * rate)`; its swing grows from rest as the round starts, and its position and velocity carry into the crash's damped landing. The crash keys off `view.crashAge`: the number holds 25% larger for 0.12 s and settles, a 6 px shake dies within 0.4 s, a ring bursts from the circle, and the circle deflates before the next betting phase. Reduced motion holds the circle still and skips the shake, punch, ring and text pops. The scene draws any phase directly, including a late entry or instant crash, and keeps its animation bounded in long rounds. If you add listeners or other resources, return a `dispose()` that cleans them up when the shell replaces the scene. The page audio helper manages its own lifecycle.

## Build and publish

`npm run build` produces `dist/hello-world/index.html`, `game.generated.js` and `style.css`. Upload those three files through Studio's **Your own renderer** flow with `index.html` as the entry. For a copy, use `dist/my-game/`. In a published frame the host owns betting, and the shell offers cash-out through the SDK bridge. Keep assets local and relative; published frames cannot make network requests.

Before publishing, check waiting, betting, normal play, an instant crash, a confirmed cash-out, a disconnected host, replay/restart and a small screen. See the [integration guide](../../docs/integration.md) and [contributing guide](../../CONTRIBUTING.md) for the full contract.

All visuals are original Canvas 2D text and shapes; sound uses the repository's shared procedural helper. No third-party assets are included. The template is an open remix origin (`gallery.json`).
