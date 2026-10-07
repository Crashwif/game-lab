# Add a game

For a minimal foundation, start with [Hello World](games/hello-world). Its README walks through copying the template and registering your game; its commented `scene.ts` contains just a greeting, a multiplier and a circle.

1. Copy the game closest to yours to `games/<slug>/` (lower-case letters, digits and hyphens). Keep its `main.ts` and `audio.ts` as they are: those are the shared page shell and the page's sound, copies of `scripts/shell/main.ts` and `scripts/shell/audio.ts` (see [the page shell](README.md#the-page-shell)). Keep the start of `style.css` down to the `/* game */` line, and put your own tokens and rules after it. Keep the elements `index.html` gives the shell: the `#status`, `#readout` and `#notice` lines, the `#bet`, `#cashout`, `#restart` and `#sound` buttons, a canvas with an `aria-label`, and the `./style.css` and `./game.generated.js` tags. Keep a `clips.json` beside `audio.ts` too (`{}` until you generate recorded clips for the game with `npm run audio`; see [generating clips](README.md#generating-clips-with-elevenlabs)). A change the shell or the audio needs belongs in `scripts/shell/`, copied into every game with `npm run shell -- --write`.
2. Write the game in `scene.ts` and the files beside it. The shell imports `createScene` and the `SceneView` type from `./scene`; each frame the scene draws the view onto a 960 × 540 Canvas 2D context, and a scene that holds resources gives a `dispose()`. Seed Round renders WebGL2 offscreen and copies each frame in. The scene flavours the sound: it calls `pageAudio` from `./audio` once with a style and a crash stinger, feeds it the phase and a tension each frame, and fires its own cues; a game's own sounds build on the engine's context and bus, as Boiler Room's `sound.ts` does. A control of the game's own is wired from the game's files, never from `main.ts`. `replay.json` is a settled round whose `gameId` is the slug; the gallery, the posters and the Studio preview play it, and the tests check it with the SDK's `verifyReplay`.
3. Add a short README and a `gallery.json` (below).
4. Add the slug to `scripts/games.mjs` in gallery order, and a row at the same place in the README's reference table. A game meant to remix in the browser Studio goes in `BROWSER_REMIX` there too, which holds it to the platform's input budget (see [the README](README.md#lightweight-games-for-the-browser-studio)).
5. Run `npm run build`, `npm run typecheck` and `npm test`. The tests check the shell copies, the game list against `games/` and the README table, `gallery.json`, the source pack, the imports and the replay; `npm run check` lists every contract problem at once.

Keep game-specific presentation here. Use the shared SDK for room state and player intents, and the emulator for local rounds. Do not add outcome calculations or production development controls.

Document the visual idea, supported inputs, asset attribution, and build/publish steps. Label incomplete concepts clearly. Keep credentials and environment files out of commits. Dispose listeners, sockets and animation frames on exit.

Exercise instant crash, normal play, accepted cashout, and a disconnected host. Once a change reaches `main` and CI passes, the Deploy Game Lab workflow builds and captures affected games, reuses verified outputs for unchanged games, and publishes the complete gallery and source packs to the platform, pinning the source commit. [Submitting from a fork](#submit-a-game-from-a-fork) describes how a contribution gets there. Keep a game's sources self-contained: its own files import only files beside them, `@crashwif/game-sdk` and `@crashwif/crash-math`, with no subdirectories, `../` paths or other packages. A file beside it is one of the game's `.ts`, `.json`, `.html` and `.css` files other than `gallery.json`, named with its extension, or a `.ts` file as `./name` or `./name.js`. That is what a remix on the platform starts from and builds with. The platform also limits a pack to 40 files of 1 byte to 256 KB each, 2 MB in all, and a bundled script of at most 1.5 MB. The gallery serves every game's bundle from the platform's own origin, so review a contributed game's code as you would the platform's.

SDK, crash-math and emulator edits originate in the platform repository. Refresh their snapshots together and update `UPSTREAM.json` so protocol changes remain traceable.

## Submit a game from a fork

You need no access to this repository: fork it, add the game on a branch and open a pull request against `main`.

1. Fork `Crashwif/game-lab` and clone your fork. Create a branch for the game (`git switch -c <slug>`), follow [Add a game](#add-a-game), commit, and push the branch to your fork.
2. Open a pull request into `main`. The template asks for the slug, what the game shows and the checks you ran; keep the pull request to the game's own directory, its row in `scripts/games.mjs` and the README table, and the docs. A game alone is what merges on approval.
3. CI runs on the pull request: the build, the typecheck and the tests, plus a **contribution** job whose summary sorts the changed paths into the game, the game list and docs, and platform files. A first pull request from a new account waits for a maintainer to allow its workflows to run. Fix anything red and push again; each push restarts the checks.
4. A maintainer reviews the game as the platform's own code, since the gallery serves the bundle from the platform's origin: they read it, run `npm run preview -- <slug>` for the live and the replay page, and check waiting, running, crash, accepted cashout and a small screen.
5. Once CI is green and a maintainer approves the head commit, the **Merge approved games** workflow (`.github/workflows/game-lab-merge.yml`) merges the pull request. A push after the approval needs a new approval: the workflow compares the review's commit with the head and merges nothing else. It then makes sure CI runs on the merge commit, and **Deploy Game Lab** exports every game and publishes the gallery to the platform. Nothing else is needed from you; the gallery entry links back to the source commit.

A pull request from a fork that changes platform files (the shell under `scripts/shell/`, the build, the checks, the workflows, `packages/`, `apps/`, the lockfile) is not merged on approval: the contribution job says so, and a maintainer merges it by hand after reviewing those changes. The SDK, the crash maths and the emulator change only with `UPSTREAM.json`, and the contribution job fails when they change without it.

Your game stays yours: `gallery.json` names the licence the platform offers it under, and `derivatives-royalty` with `royaltyBps` marks a game whose remixes owe its author a share. The platform's lineage points every remix back at the game's source commit here.

## Repository settings

The workflows rely on settings a maintainer makes once on `Crashwif/game-lab`; the files here cannot set them.

- **Branch protection or a ruleset on `main`**: require the CI `check` and `contribution` jobs to pass, require one approving review, dismiss stale approvals on a new push, and require review from code owners. [`.github/CODEOWNERS`](.github/CODEOWNERS) owns the platform files and leaves `games/` and `scripts/games.mjs` unowned, so a game needs any maintainer's approval and a platform change needs an owner's. Merge approved games checks the approval, its commit and CI itself, so these settings guard merges made by hand; they do not change what it merges.
- **Pull requests**: allow merge commits (the workflow merges with one, as `main`'s history does). Squash and rebase merging may stay on for merges by hand.
- **Actions**: under *Fork pull request workflows*, require approval for first-time contributors, so a stranger's first pull request runs CI only once a maintainer has looked at it; keep the default `GITHUB_TOKEN` permissions at read, since every workflow here declares what it needs. Allow Actions to create and approve pull requests is not needed.
- **Maintainers** are the users with write, maintain or admin permission on this repository; only their approvals merge. Grant that role to whoever reviews games.
- **Deploy**: the secret `GAME_LAB_PLATFORM_TOKEN` and the optional variable `GAME_LAB_PLATFORM_REPOSITORY`, as [the README](README.md#game-lab-deploy) describes. Without the secret, approved games merge and the export builds, but the publish job skips with a notice.

## gallery.json

- `name`, `hook`, `tagline` and `renderer` are non-empty strings, and `tags` is a list of exactly three non-empty strings.
- `interactive` is `true` for a game the player steers during the round (a skill game, with its controls wired from the game's own files); left out, the game is one to watch and cash out of. The gallery filters on it and badges the card.
- `licence` is `open`, `derivatives-royalty` or `all-rights-reserved`. Only `derivatives-royalty` sets `royaltyBps`, a whole number from 0 to 1000 (basis points); the others leave it out or at 0.
- `poster.seconds` is a number above 0 and at most 120: the moment after page load at which the poster is captured from replay mode.

## Line endings

Text files are committed with LF: `.gitattributes` sets `* text=auto`, and CI fails on any file committed with CRLF (`git add --renormalize .` fixes them). A Windows checkout may still show CRLF on disk (`core.autocrlf`); git stores LF either way, and the shell and gallery checks read through it.
