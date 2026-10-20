<!-- A game contribution from a fork merges on its own once CI passes and a maintainer approves it, and the Deploy Game Lab workflow then publishes it. See CONTRIBUTING.md#submit-a-game-from-a-fork. Delete the section that does not apply. -->

## Game

Slug: `games/<slug>`

What the game shows, and what the player does:

- [ ] `npm run build`, `npm run typecheck` and `npm test` pass locally, and `npm run check` lists no problem.
- [ ] The game's own files import only files beside them, `@crashwif/game-sdk` and `@crashwif/crash-math`; `main.ts` and `audio.ts` are the shared shell copies.
- [ ] `gallery.json` names the licence the game is offered under, and `replay.json` is a settled round whose `gameId` is the slug.
- [ ] The game only presents the round: no outcome calculation, no network call, no external script, no credential.
- [ ] Waiting, running, crash, accepted cashout, replay and a small screen all look right (`npm run preview -- <slug>`).
- [ ] The README credits every asset that is not the author's own.

## Platform change

<!-- The shell, the build, the checks, the workflows, the packages. A maintainer merges these by hand after review. SDK, crash-math and emulator changes come from the platform repository with UPSTREAM.json updated. -->

What changes and why:
