# Crashwif Games

Build a game from the [Hello World template](games/hello-world), or study the playable references below. [Game Lab](https://devnet.crashwif.com/game-lab) in the Crashwif lobby is the companion gallery.

Game code controls presentation and sends player intents; the backend supplies the committed round outcome. Credits have no monetary value.

## Start with Hello World

Use the Node 24 version pinned in [`.nvmrc`](.nvmrc) and npm 11. If you use nvm, run `nvm install` and `nvm use` after cloning.

```sh
git clone https://github.com/Crashwif/game-lab.git
cd game-lab
npm ci --include=dev --bin-links=true
npm run preview -- hello-world
```

The preview builds only Hello World and the shared packages, starts the local emulator, and prints the recorded-preview URL:

- [Recorded preview](http://127.0.0.1:4500/bundle/hello-world/index.html?mode=replay): watch the verified example and use **Restart replay** to play it again. Betting is hidden.
- [Live play](http://127.0.0.1:4500/bundle/hello-world/index.html): **Join round** during betting, then **Cash out** while running. Space performs the available action unless another control has focus.

Change `GREETING` or `COLOURS` in [`games/hello-world/scene.ts`](games/hello-world/scene.ts) for your first edit. The template draws a greeting, a multiplier and a circle; joining, confirmed cash-outs, replay and optional sound already work. No artwork or API keys are needed. **Sound** cycles off, on and effects only, and remembers your choice.

Stop and restart the preview after edits; it does not reload changes automatically. To explore another reference, replace `hello-world` with a slug from [`scripts/games.mjs`](scripts/games.mjs). `npm run dev` builds the entire catalog and prints each game's live and replay URLs. Both commands use port 4500, so stop one before starting the other.

Keep Windows checkouts outside OneDrive. Stop preview/dev processes before reinstalling dependencies and resolve installation errors before building. TypeScript is installed locally with the development dependencies; no global install is needed.

## Build your own

Copy `games/hello-world/` to `games/<your-slug>/` and follow the [template's guide](games/hello-world/README.md#make-it-yours) to rename it, update its replay ID and register it in the catalog. Start with `scene.ts`; customize the page in `index.html` and the styles after `/* game */` in `style.css`. Keep `main.ts`, `audio.ts` and the shared CSS block in sync with [the page shell](#the-page-shell).

Read the [integration guide](docs/integration.md) for embedded games, direct SDK clients, emulator setup and publishing. [Contributing](CONTRIBUTING.md) describes the source-pack rules, gallery metadata and [submitting a game from a fork](CONTRIBUTING.md#submit-a-game-from-a-fork).

`npm run build` writes three publishable files per game to `dist/<slug>/`: `index.html`, `game.generated.js` and `style.css`. In Studio, choose **Your own renderer**, upload those three files and set the entry to `index.html`. For the unchanged template, use `dist/hello-world/`.

Published frames have no network access. Embed runtime assets in the game's supported source files and use relative script and stylesheet paths. The selected-game preview can serve extra local media, but the build and gallery export do not copy arbitrary media files into the three-file bundle.

## Validate your game

Run these commands from the repository root. Build first because the workspaces import each other's compiled output.

```sh
npm run build
npm run typecheck
npm run check
npm test
```

`npm run check` reports all gallery-contract problems together: game registration and README order, metadata, source-pack size and imports, browser remix budgets, verified replays and game-label rules. `npm test` includes those checks, shared-shell consistency, gallery tooling and the SDK, crash-math and emulator tests.

For browser checks, install Chromium once, then run:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite covers catalog replay/crash/restart on a small screen, the shell's room-curve handling and audio playback. Also exercise live waiting, betting, normal play, instant crash, accepted cash-out, a disconnected host and reduced motion. The [integration guide](docs/integration.md#long-round-presentation) includes fixtures for reviewing long rounds and late entry.

## Reference games

The table follows the gallery order in `scripts/games.mjs`. Use these examples to study richer presentation after starting with Hello World; [the idea shelf](docs/concepts.md) also contains unfinished concepts.

| Reference | What to study | Status |
| --- | --- | --- |
| [Seed Round](games/seed-round) | Raw WebGL2 with no libraries: a tunnel bent onto its path in the vertex shader, instanced swimmers with travelling-wave tails, a translucent latex reveal, the HUD with a rumour feed in Canvas 2D on top | Playable |
| [Blanket Champ](games/blanket-champ) | A duvet on the beat, room props on springs, a live odds board, a news ticker, a cheering crowd | Playable |
| [Balloon Pump](games/balloon-pump) | Two-bone joints, spring-lagged secondary motion, a buoyant balloon on a tether, a slingshot that winds up with the multiplier, a seeded burst with hit-stop and slow motion, meme captions | Playable |
| [Andy’s Loud Garden](games/andys-loud-garden) | Andy character sprites, layered cannabis growth, a watering loop, a harvest walk-off, a police arrival and garden closure tied to the crash | Playable |
| [Tower Tension](games/tower-tension) | An inter-storey spring chain, a pendulum crane hook and counterweight, semis that deliver each floor on a flatbed, residents in the windows, a sales office queue, camera tracking, a seeded collapse with hit-stop | Playable |
| [Boiler Room](games/boiler-room) | A slider-crank linkage, belt and governor, layered particles, a game's own sounds on the shared audio bus | Playable |
| [Thin Ice](games/thin-ice) | A stride rig, a spreading crack network, bagholders thawing under the ice, a liquidation drone that closes in, a reflection, a seeded shatter into floes | Playable |
| [King of the Hill](games/king-of-the-hill) | A bonding-curve hill, a coin that rolls back, a dev on a cloud throne with a SELL lever, an airdrop plane, a Lambo pick-up | Playable |
| [Exit Liquidity](games/exit-liquidity) | A pool that fills with holders, a helicopter airdrop, a whale, a drain-plug rug pull and a selfie with the empty pool | Playable |
| [Gas Fees](games/gas-fees) | A packed lift in depth order, a roster of arrivals, a canary that reels with the multiplier, an air quality readout, a seeded gas cloud, muzak that speeds up | Playable |
| [OnlyFrens](games/onlyfrens) | A livestream layout, a scrolling chat, a tip menu and a goal that keep moving, a second monitor shorting her own coin, a boyfriend reveal | Playable |
| [Pump & Dump](games/pump-and-dump) | A bench press from the feet, a bar that bends, plates named after memecoins, a NATTY? poll, a spotter on his phone, a dropped bar with hit-stop | Playable |
| [Bonding Curl](games/bonding-curl) | A bicep as a pressure volume, veins and sheen, a cuff that reads market cap, a sleeve that tears, a paramedic at the door, a seeded burst | Playable |
| [Wife Changing Money](games/wife-changing-money) | A 3 am kitchen lit by a laptop, a hunched seated rig, a cursor that drifts toward SELL, a wedding photo that tilts, a text stack, a stair light and a ceiling thump, a suitcase meter | Playable |
| [Not Financial Advice](games/not-financial-advice) | A green screen that tears, a rental sticker that peels, a sponsor read at every milestone, a wallet feed with a cousin dumping, a disclosure that shrinks with the odds | Playable |
| [Honeypot](games/honeypot) | A filling jar with meniscus and drips, honey strings, a fox auditor with a stamp, a bee swarm on the tension, a lid that screws shut | Playable |
| [Insider Wallets](games/insider-wallets) | A wallet tracker on the multiplier curve with an allocation pie, a tie that grows into the crowd, a press pool that escalates, confetti cannons, a helicopter exit | Playable |
| [The Trenches](games/the-trenches) | A marching squad with squash on each step, a parallax ridge, a DAYS SINCE LAST RUG sign, a white flag the sergeant glares down, a seeded nuke and shockwave, a field phone that rings | Playable |
| [Hopium Drip](games/hopium-drip) | An EKG trace driven by the multiplier with a heartbeat to match, a draining IV bag, a bed rig, a curtain that pulls, a crash cart that shocks the laptop, a flatline | Playable |
| [I Got Hacked](games/i-got-hacked) | A balcony rig with a phone that cycles excuses, a paparazzi drone, a party crowd on a curve, a pool that drains, a yacht that leaves | Playable |
| [Wen Binance](games/wen-binance) | A queue that advances on the curve, a marquee whose letters loosen and drop, a ticket scalper, a bass shake, doors that open on a spring | Playable |
| [Liquidation Lane](games/liquidation-lane) | A first-person Lambo cockpit, sunglasses Pepe in the mirror, perspective highway traffic, climbing instruments, an offshore exit and a windshield-shattering wreck | Playable |
| [Moon Boys](games/moon-boys) | Raw WebGL2 again: a rocket with stage separations and ninety-six instanced holders clinging to the outside, a flat earth prop and a moon prop that faces the camera and grows, a boom mic and a stagehand's glove in camera space, wires that glint, a parachute bail-out, and a crash that cuts to the soundstage | Playable |
| [Rug Rails](games/rug-rails) | The lab's first skill game: three perspective lanes with a runner rig seen from behind, a seeded course of walls, gates, rugs and trains with ramps onto their roofs, coins that swell a bag on the runner's back, a chaser that closes on stumbles, swipe and keyboard controls with a copy-trading bot that steers until the player does, a stash with ranks and cosmetic drip, a hoverboard cash-out and a rug-pull crash that rolls the rails up | Playable |
| [Rug Piste](games/rug-piste) | A retro desktop ski game: steer a neon skier with a frog backpack through a scrolling snowfield, dodge trees, hop rugs and collect arcade memecoins; a ski-lift escape on confirmed cash-out, and an abominable snowman that bursts from a hole and gobbles the skier on the backend crash | Playable |
| [Wen Moon](games/wen-moon) | Lightweight, remixable in the browser: a world that scrolls under the rocket with its altitude, a booster that separates, jeets bailing out on chutes, an escape pod, a seeded burst | Playable |
| [Bull Run](games/bull-run) | Lightweight, remixable in the browser: a bucking cycle on springs, a rider rig that lags the bull, a chute gate, a dev clown in a barrel, a vault to the fence, a seeded throw | Playable |
| [Pyramid Scheme](games/pyramid-scheme) | Lightweight, remixable in the browser: rows of recruits that lift the pyramid on a spring, strain that gathers at the base, a jump off the top, a seeded collapse | Playable |
| [Up Only](games/up-only) | The lab's second skill game, one tap: a side-view flap against gravity between a support line and a resistance line, candles laid from a seeded generator with coins down their gaps, traps and power-ups in the open, a FUD cloud that closes in on every clip and strikes on the second, a copy-trading bot that flaps until the player does, a private jet on cash-out and a crash that flips every candle red and pulls the floor | Playable |
| [Family Meeting](games/family-meeting) | A suburban kitchen at dinner: two parents facing the camera whose colour, brows, veins, steam and swelling follow the multiplier, a daughter seen from behind with rainbow hair who explains with her hands, a dialogue keyed to the curve, a cross that rattles on its nail, a kettle that joins in, a seeded double head burst that drops the cross in the casserole | Playable |
| [Thanksgiving Uncle](games/thanksgiving-uncle) | The other side of the table: an uncle seen from behind whose theories deepen with the curve, a dad whose smile freezes wider and a niece whose eyes roll further, a smart speaker that mishears and orders, a sign that flips to zero, a dog revving the truck in the window, Grandma's grace on a cash-out, a seeded truck through the wall with the turkey on the hood | Playable |
| [Hello World](games/hello-world) | A minimal creator template: a commented scene, a greeting, a multiplier and a circle, with the shared controls and replay already connected | Playable |
| [Know Your Clown](games/know-your-clown) | A Ministry of Airdrops conveyor, articulated scanners, an expressive applicant, eight timed verification acts and endless audits, a tinfoil escape, a crated identity and a single peanut; ElevenLabs music and effects | Playable |
| [Rug Coaster](docs/concepts.md#rug-coaster-3d-webgl) | A WebGL2 rollercoaster on the bonding curve: spline track, instanced rails, a rug-pull ending | Concept |

### Lightweight games for the browser Studio

Hello World, Wen Moon, Bull Run and Pyramid Scheme are listed in `BROWSER_REMIX` in `scripts/games.mjs` and checked against a 120,000-token input budget. Every catalog game must also fit the platform's 330,000-token limit with 15% headroom for edits.

These are conservative input bounds calculated from UTF-8 source bytes, the system prompt and an allowance; `clips.json` counts by clip names rather than embedded audio. Artwork embedded in source does count. Run `npm run check` for the current totals instead of estimating from file count. See [`scripts/gallery/check.mjs`](scripts/gallery/check.mjs) for the calculation and [`CONTRIBUTING.md`](CONTRIBUTING.md) for source-pack limits.

## The page shell

Every game's `main.ts` and `audio.ts` are copies of the canonical files in [`scripts/shell/`](scripts/shell/). Each `style.css` starts with the canonical CSS block; game-specific rules follow `/* game */`. Copies keep a game's source pack self-contained. Make shared changes under `scripts/shell/`, then run `npm run shell -- --write`. `npm test` detects drift and missing HTML elements.

The shell connects to the local emulator or the platform's embedded bridge, drives `scene.ts` from room state, and handles controls, status, notices, resizing and replay. It stops offering cash-out after two seconds without a server frame. Embedded games hide Join because the host owns betting, keep Cash out, and report their height to the host. Replay uses the frame clock and pauses while the picture is hidden. See [embedded mode](docs/integration.md#embedded-mode) for the host contract.

A scene calls `pageAudio({ style, crash })` from `./audio`, then `update(phase, tension)` each frame and cues such as `cashout()`, `crash()` and `fx(name)` when appropriate. [`audio.ts`](scripts/shell/audio.ts) lists the available styles, effects and options. The helper owns the Sound button and page lifecycle, and goes quiet while the page or picture is hidden.

Every game has a `clips.json`: `{}` uses procedural sound, as Hello World does. Optional `music`, `crash`, `cashout` and named-effect entries contain audio data URLs that replace the corresponding synthesized sounds. The other references include recorded 150-second scores, which restart when a round starts running and repeat only after the full track.

### Generating clips with ElevenLabs

Audio generation is optional. [`scripts/audio/prompts.json`](scripts/audio/prompts.json) contains the requests; Hello World's music prompt is ready to use, but the template ships without a recording. Supply `ELEVENLABS_API_KEY` through your environment only. Music packing also needs FFmpeg with libopus on PATH, or `FFMPEG_PATH` pointing to it.

```sh
# Inspect the template's request without calling the API or writing files.
npm run audio -- --game hello-world --clip music --dry-run

# Generate the selected recording; requires ELEVENLABS_API_KEY in the environment.
npm run audio -- --game hello-world --clip music

# Verify recordings that already have cached Music masters.
node scripts/audio/verify.mjs --available
```

Music uses ElevenLabs Music, with 150 seconds by default; effects use Sound Effects. A refused music request fails without substituting an effects loop. The generator preserves other clips, keeps masters and request metadata under `scripts/audio/cache/<slug>/`, and reuses matching masters. `--cached-only` requires an existing matching master and makes no API calls; `--force` regenerates. Omitting `--game` selects the whole prompt catalog.

Complete music is packed as mono Opus at 8 kb/s. `clips.json` must fit the 256 KiB source-file limit; higher-quality MP3 masters stay in the cache. The verifier's `--available` flag skips games without generated masters, including the unmodified template. Add `--report scripts/audio/generation-status.json` to refresh the audio audit. Preview and listen after changing recordings.

## Game Lab deploy

This section is for gallery maintainers. Creators can publish their own renderer through Studio or [submit a game from a fork](CONTRIBUTING.md#submit-a-game-from-a-fork).

Each game's `gallery.json` supplies the gallery copy, three tags, renderer, remix licence and poster time; `interactive: true` marks a game the player steers. [Contributing](CONTRIBUTING.md#galleryjson) defines the fields. The catalog order comes from `scripts/games.mjs`.

### Export locally

Use a clean checkout of the commit being exported, with dependencies installed. The default exporter reads an existing `dist/` build; it does not build games itself:

```sh
npm run build
npx playwright install chromium
npm run gallery:export
```

The export writes versioned bundles and posters to `gallery-out/<short-commit>/<slug>/`, source packs to `gallery-out/sources/<slug>.json`, and catalog/provenance records to `manifest.json` and `SOURCE.json` under `gallery-out/`. Source packs contain the game's own flat `.ts`, `.json`, `.html` and `.css` files except `gallery.json`; READMEs and arbitrary media are excluded.

By default, source packs and gallery metadata come from the selected git commit (`HEAD` unless `--commit` is supplied), while bundles come from `dist/`. Build from the same commit so they agree. For a source export without `.git`, pass `--sources worktree --commit <full SHA>` using the commit the copy came from. Posters are captured from verified replay mode at `poster.seconds`; browser errors and single-colour posters fail the export.

For incremental export, first plan the work:

```sh
node scripts/gallery/export.mjs --cache .game-lab-cache --plan
```

This requires a clean checkout of the selected commit. If the plan needs builds, install dependencies and build `@crashwif/crash-math` then `@crashwif/game-sdk`; if it needs captures, install Playwright's Chromium too. Run the same command without `--plan` to build missing or changed games and write a complete export using verified cached outputs for the rest. Shared build inputs invalidate the cache; README changes and gallery copy do not. A poster-time change recaptures only that poster. Missing or corrupt outputs are rebuilt.

The non-cached exporter accepts `--skip-posters`, preserving posters already exported for that commit and reporting missing ones. It cannot be combined with `--cache`. Platform sync requires every poster unless `--allow-missing-posters` is explicitly passed.

[`scripts/gallery/sync-platform.mjs`](scripts/gallery/sync-platform.mjs) applies a checked export to a platform checkout:

```sh
node scripts/gallery/sync-platform.mjs --export gallery-out --platform <platform-checkout>
```

It reuses unchanged posters and retains releases for open previews: by default, releases live within the last seven days, at least the last three releases, and the active and immediately previous releases. `--keep-days` and `--keep-min` adjust retention.

### Automated publishing

The [Deploy Game Lab workflow](.github/workflows/game-lab-deploy.yml) follows successful CI on `main`, or a manual run from `main` selecting a commit on `main` that passed CI. Pull-request CI does not deploy.

- `export` plans, builds and captures affected games, reuses verified cached outputs, and uploads the complete export. It has read access to this repository and no platform token.
- `publish` applies the artifact using the workflow's trusted sync script, opens or reuses a platform pull request, waits for its checks, then merges it. The platform's Railway workflow handles deployment. The platform token is used only in this job, including its configuration check, platform checkout and push/PR step.

Publishing requires the `GAME_LAB_PLATFORM_TOKEN` repository secret: a token scoped to the platform repository with Contents and Pull requests read/write, and Checks, Commit statuses, Actions and Metadata read. Use a fine-grained token or mint a scoped GitHub App installation token for the run; do not copy a broad personal gh CLI token or classic PAT. `GAME_LAB_PLATFORM_REPOSITORY` optionally selects the target repository (default `Crashwif/crashwif`). Without the secret, publishing skips with a notice.

The [Merge approved games workflow](.github/workflows/game-lab-merge.yml) can merge eligible game contributions after CI and a maintainer's approval of the current head commit. Changes to platform files require manual review and merging. See [Contributing](CONTRIBUTING.md#submit-a-game-from-a-fork) and [repository settings](CONTRIBUTING.md#repository-settings) for the exact scope and setup.

## Repository boundaries

- `games/`: game presentation and interactions. Games never select crash points.
- `packages/game-sdk/`: shared client, protocol, embedded bridge and replay support.
- `packages/crash-math/`: verification dependency and outcome implementation.
- `apps/emulator/`: local development server; its development controls are not production endpoints.
- `scripts/`: catalog, shared shell, build, preview, checks, audio generation and gallery export.
- `docs/`: integration and design references.

The SDK, crash maths and emulator are pinned platform snapshots recorded in [UPSTREAM.json](UPSTREAM.json). Changes to them originate in the platform repository and are synchronized here; games develop here independently.

## Coding assistants

[AGENTS.md](AGENTS.md) gives coding assistants the remix boundaries and validation commands; [CLAUDE.md](CLAUDE.md) imports those instructions for Claude Code.
