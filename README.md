# Crashwif Games

Working game references and ideas for creators building beyond the graph. [**Game Lab**](https://web-production-d0ea6.up.railway.app/game-lab) in the Crashwif lobby is the companion gallery.

## Run Balloon Pump

Use Node 24 and npm 11:

```sh
git clone https://github.com/Crashwif/game-lab.git
cd game-lab
npm ci
npm run dev
```

Open **http://127.0.0.1:4500/bundle/balloon-pump/index.html** (or `tower-tension` in place of `balloon-pump`). The local emulator supplies valueless credits and verified rounds. Join a round and cash out before the balloon bursts. Add `?mode=replay` to watch the included recorded example without betting.

| Reference | What to study | Status |
| --- | --- | --- |
| [Balloon Pump](games/balloon-pump) | Two-bone joints, spring-lagged secondary motion, a buoyant balloon on a tether, a seeded burst, meme captions | Playable |
| [Tower Tension](games/tower-tension) | An inter-storey spring chain, a pendulum crane hook, camera tracking, a seeded collapse | Playable |
| [Boiler Room](games/boiler-room) | A slider-crank linkage, belt and governor, layered particles, opt-in procedural sound | Playable |
| [Thin Ice](games/thin-ice) | A stride rig, a spreading crack network, a reflection, a seeded shatter into floes | Playable |
| [King of the Hill](games/king-of-the-hill) | A bonding-curve hill, a coin that rolls back, a Lambo pick-up | Playable |
| [Exit Liquidity](games/exit-liquidity) | A pool that fills with holders, a whale, a drain-plug rug pull | Playable |
| [Blanket Champ](games/blanket-champ) | A duvet on the beat, room props on springs, a cheering crowd | Playable |
| [Rug Coaster](docs/concepts.md#rug-coaster-3d-webgl) | A WebGL2 rollercoaster on the bonding curve: spline track, instanced rails, a rug-pull ending | Concept |

## Build your own

Read the [integration guide](docs/integration.md) for embedded games, direct SDK clients, emulator setup, and publishing. [Contributing](CONTRIBUTING.md) describes the example layout and how to add a game.

`npm run build` creates a self-contained bundle per game under `dist/`. Upload a game's three files through Studio with the custom renderer entry `index.html`. Assets and dependencies are bundled locally so the game's sandbox requires no network access.

## Game Lab deploy

Every playable reference carries a `games/<slug>/gallery.json` with the copy the gallery shows: `name`, a one-line `hook` for the page intro, a `tagline`, three `tags`, the `renderer`, and `poster.seconds`, the moment after page load at which its poster is captured from replay mode. The list and order come from `scripts/games.mjs`, which the build, the dev server and the export share.

`npm run gallery:export` builds the export the platform serves: `gallery-out/<short-commit>/<slug>/` with the three bundle files and `poster.png`, `manifest.json` for the Game Lab page, and `SOURCE.json` with the source commit and a SHA-256 per file. Posters need Playwright's Chromium (`npm install --no-save playwright && npx playwright install chromium`); pass `--skip-posters` to leave them out. `node scripts/gallery/sync-platform.mjs --export gallery-out --platform <platform checkout>` applies an export to the platform repository.

The **Deploy Game Lab** workflow (`.github/workflows/game-lab-deploy.yml`) runs those two steps after CI passes on `main`, or on demand. It opens a pull request on the platform repository with the new bundles, posters, `SOURCE.json` and manifest, waits for the platform's checks, merges it, and the platform's Railway workflow deploys `main`. It needs the repository secret `GAME_LAB_PLATFORM_TOKEN` (a token with contents and pull-request write access to the platform repository) and optionally the variable `GAME_LAB_PLATFORM_REPOSITORY` (default `Crashwif/crashwif`); without the secret it skips with a notice.

## Repository boundaries

- `games/`: game presentation and interactions. Games never select crash points.
- `packages/game-sdk/`: the shared client, protocol, embedded bridge and replay support.
- `packages/crash-math/`: the SDK's verification dependency; the platform's outcome implementation.
- `apps/emulator/`: the local development server. Its development controls are not production endpoints.
- `docs/`: integration and design references.

The SDK, maths and emulator are pinned source snapshots from the platform. [UPSTREAM.json](UPSTREAM.json) records the commit and paths. Changes to those packages belong in the platform repository, then are synchronized here. Games develop here independently. The gallery serves a checked-in build of each recorded example, refreshed by the Deploy Game Lab workflow, and links to its source.

Credits have no monetary value. The real backend supplies the committed round; game code controls only its presentation and sends player intents.
