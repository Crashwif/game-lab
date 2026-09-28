# Add a game

1. Copy the game closest to yours to `games/<slug>/` (lower-case letters, digits and hyphens). Keep its `main.ts` and `audio.ts` as they are: those are the shared page shell and the page's sound, copies of `scripts/shell/main.ts` and `scripts/shell/audio.ts` (see [the page shell](README.md#the-page-shell)). Keep the start of `style.css` down to the `/* game */` line, and put your own tokens and rules after it. Keep the elements `index.html` gives the shell: the `#status`, `#readout` and `#notice` lines, the `#bet`, `#cashout`, `#restart` and `#sound` buttons, a canvas with an `aria-label`, and the `./style.css` and `./game.generated.js` tags. A change the shell or the audio needs belongs in `scripts/shell/`, copied into every game with `npm run shell -- --write`.
2. Write the game in `scene.ts` and the files beside it. The shell imports `createScene` and the `SceneView` type from `./scene`; each frame the scene draws the view onto a 960 × 540 Canvas 2D context, and a scene that holds resources gives a `dispose()`. Seed Round renders WebGL2 offscreen and copies each frame in. The scene flavours the sound: it calls `pageAudio` from `./audio` once with a style and a crash stinger, feeds it the phase and a tension each frame, and fires its own cues; a game's own sounds build on the engine's context and bus, as Boiler Room's `sound.ts` does. A control of the game's own is wired from the game's files, never from `main.ts`. `replay.json` is a settled round whose `gameId` is the slug; the gallery, the posters and the Studio preview play it, and the tests check it with the SDK's `verifyReplay`.
3. Add a short README and a `gallery.json` (below).
4. Add the slug to `scripts/games.mjs` in gallery order, and a row at the same place in the README's reference table.
5. Run `npm run build`, `npm run typecheck` and `npm test`. The tests check the shell copies, the game list against `games/` and the README table, `gallery.json`, the source pack, the imports and the replay; `npm run check` lists every contract problem at once.

Keep game-specific presentation here. Use the shared SDK for room state and player intents, and the emulator for local rounds. Do not add outcome calculations or production development controls.

Document the visual idea, supported inputs, asset attribution, and build/publish steps. Label incomplete concepts clearly. Keep credentials and environment files out of commits. Dispose listeners, sockets and animation frames on exit.

Exercise instant crash, normal play, accepted cashout, and a disconnected host. Once a change reaches `main` and CI passes, the Deploy Game Lab workflow exports every game, captures posters and publishes the gallery and the source packs to the platform, pinning the source commit. Keep a game's sources self-contained: its own files import only files beside them, `@crashwif/game-sdk` and `@crashwif/crash-math`, with no subdirectories, `../` paths or other packages. A file beside it is one of the game's `.ts`, `.json`, `.html` and `.css` files other than `gallery.json`, named with its extension, or a `.ts` file as `./name` or `./name.js`. That is what a remix on the platform starts from and builds with. The platform also limits a pack to 40 files of 1 byte to 256 KB each, 2 MB in all, and a bundled script of at most 1.5 MB. The gallery serves every game's bundle from the platform's own origin, so review a contributed game's code as you would the platform's.

SDK, crash-math and emulator edits originate in the platform repository. Refresh their snapshots together and update `UPSTREAM.json` so protocol changes remain traceable.

## gallery.json

- `name`, `hook`, `tagline` and `renderer` are non-empty strings, and `tags` is a list of exactly three non-empty strings.
- `licence` is `open`, `derivatives-royalty` or `all-rights-reserved`. Only `derivatives-royalty` sets `royaltyBps`, a whole number from 0 to 1000 (basis points); the others leave it out or at 0.
- `poster.seconds` is a number above 0 and at most 120: the moment after page load at which the poster is captured from replay mode.

## Line endings

Text files are committed with LF: `.gitattributes` sets `* text=auto`, and CI fails on any file committed with CRLF (`git add --renormalize .` fixes them). A Windows checkout may still show CRLF on disk (`core.autocrlf`); git stores LF either way, and the shell and gallery checks read through it.
