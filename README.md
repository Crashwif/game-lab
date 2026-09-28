# Crashwif Games

Working game references and ideas for creators building beyond the graph. [**Game Lab**](https://devnet.crashwif.com/game-lab) in the Crashwif lobby is the companion gallery.

## Run Balloon Pump

Use Node 24.11 or later within 24.x, and npm 11. CI uses the version in `.nvmrc` (`nvm install` reads it):

```sh
git clone https://github.com/Crashwif/game-lab.git
cd game-lab
npm ci
npm run dev
```

Open **http://127.0.0.1:4500/bundle/balloon-pump/index.html**; `npm run dev` prints a live and a `?mode=replay` URL for every game. The local emulator supplies valueless credits and verified rounds. Join a round and cash out before the balloon bursts, with the buttons or Space. The `?mode=replay` URL plays the included recorded example without betting. Every game has a Sound button: music and effects are synthesised on the page, off until you turn them on, and the choice is remembered.

| Reference | What to study | Status |
| --- | --- | --- |
| [Balloon Pump](games/balloon-pump) | Two-bone joints, spring-lagged secondary motion, a buoyant balloon on a tether, a slingshot that winds up with the multiplier, a seeded burst with hit-stop and slow motion, meme captions | Playable |
| [Tower Tension](games/tower-tension) | An inter-storey spring chain, a pendulum crane hook and counterweight, residents in the windows, a sales office queue, camera tracking, a seeded collapse with hit-stop | Playable |
| [Boiler Room](games/boiler-room) | A slider-crank linkage, belt and governor, layered particles, a game's own sounds on the shared audio bus | Playable |
| [Thin Ice](games/thin-ice) | A stride rig, a spreading crack network, bagholders thawing under the ice, a liquidation drone that closes in, a reflection, a seeded shatter into floes | Playable |
| [King of the Hill](games/king-of-the-hill) | A bonding-curve hill, a coin that rolls back, a dev on a cloud throne with a SELL lever, an airdrop plane, a Lambo pick-up | Playable |
| [Exit Liquidity](games/exit-liquidity) | A pool that fills with holders, a helicopter airdrop, a whale, a drain-plug rug pull and a selfie with the empty pool | Playable |
| [Blanket Champ](games/blanket-champ) | A duvet on the beat, room props on springs, a live odds board, a news ticker, a cheering crowd | Playable |
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
| [Seed Round](games/seed-round) | Raw WebGL2 with no libraries: a tunnel bent onto its path in the vertex shader, instanced swimmers with travelling-wave tails, a translucent latex reveal, the HUD with a rumour feed in Canvas 2D on top | Playable |
| [Rug Coaster](docs/concepts.md#rug-coaster-3d-webgl) | A WebGL2 rollercoaster on the bonding curve: spline track, instanced rails, a rug-pull ending | Concept |

## Build your own

Read the [integration guide](docs/integration.md) for embedded games, direct SDK clients, emulator setup, and publishing. [Contributing](CONTRIBUTING.md) describes the example layout and how to add a game.

`npm run build` creates a self-contained bundle per game under `dist/`. Upload a game's three files through Studio with the custom renderer entry `index.html`. Assets and dependencies are bundled locally so the game's sandbox requires no network access.

`npm test` (after `npm run build`) also checks the shells and the contract the gallery and remixes rely on: `scripts/games.mjs` lists every game directory once; each `gallery.json` and source pack passes the platform's rules; each game bundles, and its own files import only source pack files beside them, named as the platform's remix bundler resolves them, `@crashwif/game-sdk` and `@crashwif/crash-math`; each `replay.json` names its game and verifies; and the reference table above lists the games in `scripts/games.mjs` order. `npm run check` lists every contract problem at once.

## The page shell

Every game's `main.ts` is the same file: the page shell. It connects to the room, or plays the recorded round, keeps the view the game's `scene.ts` draws from, and runs the controls. Every game's `audio.ts` is the same file too: the page's sound, which the game's scene flavours. Every `style.css` starts with the shell's block too; a game's own tokens and rules follow its `/* game */` line. The canonical copies are in `scripts/shell/`. Edit them there and run `npm run shell -- --write` to copy them into every game. `npm test` fails when a copy drifts or an `index.html` lacks an element the shell or the audio drives. The shell is copied rather than imported because a source pack holds only the game's own directory.

The shell:

- writes the status line in plain words: the betting window, your bet, a bet queued because the round is full, your cash-out and payout, the crash result, a lost connection and an ended session;
- shows a readout under it: the seconds left to join, what cashing out is worth now, the credits left (standalone only) and the Space hint;
- makes Space join during betting and cash out while a round runs, unless another control has focus;
- shows a room error or a refusal as a notice, and stops offering Cash out when no server frame has arrived for 2 s;
- framed by the platform, hides Join, keeps Cash out and reports the page's height so the host can size the frame (see [embedded mode](docs/integration.md#embedded-mode));
- in replay mode, plays `replay.json` by the frame clock, so slow frames and a hidden tab never make the recording drift.

The audio (`audio.ts`) is procedural Web Audio with no files, so a bundle stays self-contained and a source pack stays text. A scene calls `pageAudio({ style, crash })` once, with a genre from fifteen presets (phonk, chiptune, eurodance, trap, lofi, techno, synthwave, dnb, hardstyle, elevator, casino, ambient, military, club, hospital) and the stinger its crash makes, then feeds it the round each frame (`update(phase, tension)`) and its own cues (`fx(name)`, `milestone(index)`, `cashout()`, `crash()`). The music is a step sequencer scheduled ahead of the audio clock: the tempo, the filter, the layers (hats, arpeggio, lead, a riser) and snare rolls follow the tension, betting plays a thinned beat, the first running frame drops, a cash-out ducks the music under a register and a fanfare, and the crash tape-stops it into the stinger. The Sound button cycles off, on and effects only, remembers the choice, and a remembered choice starts with the next click or key (the user activation autoplay rules want). It goes quiet while the page is hidden or the picture is scrolled out of view. A game with its own sounds (Boiler Room's hiss, chuff, ping and blast) builds them on the engine's context and bus, so one button governs everything.

Recorded clips can stand in for any of it. Every game has a `clips.json` beside `audio.ts` (`{}` for none): clip names (`music`, `crash`, `cashout`, or any effect name such as `airhorn` or `scream`) to data URLs, which the engine decodes when sound is turned on and plays instead of the synthesised music loop, stinger, register or effect; a recorded loop still runs through the tension filter and hurries up to a tenth at the top. `pageAudio({ clips })` overrides the file. Base64 keeps the pack text-only, as the platform needs: a 12 s loop at 64 kb/s is about 130 KB, a stinger at 32 kb/s about 5 KB a second, and a game's `clips.json` must stay under the platform's 256 KB per source file.

### Generating clips with ElevenLabs

`scripts/audio/prompts.json` holds a prompt per clip per game (a music loop, the crash, the cash-out and a couple of signature effects each), and `npm run audio` turns it into every `clips.json`:

```sh
ELEVENLABS_API_KEY=… npm run audio                          # every game
npm run audio -- --game gas-fees --clip crash               # one clip
npm run audio -- --dry-run                                  # print the requests, call nothing
```

Music goes to the Music endpoint (`/v1/music`, instrumental, as long as the manifest's `seconds`) and everything else to Sound Effects (`/v1/sound-generation`, with `loop` for beds); a music request the plan refuses falls back to the effects model as a loop. Raw audio is kept under `scripts/audio/cache/`, keyed by the request and committed with the `clips.json` it produced, so every checkout has the MP3s to listen to or download and a re-run anywhere only pays for prompts that changed; `--force` regenerates. The script keeps each `clips.json` under 200 KB and fails otherwise; shorten the loop or lower the bit rate in the manifest. The key lives in the environment, never in the repository, and commercial use of the audio needs a paid ElevenLabs plan. Crashwif's Game Studio desktop runs this script for the selected game with a key pasted for that run, and imports a `clips.json` made in the browser Studio. Listen before committing: open the game with `npm run dev`, turn the sound on, and replace any clip whose prompt missed by editing the manifest and running that one clip again.

## Game Lab deploy

Every playable reference carries a `games/<slug>/gallery.json` with the copy the gallery shows: `name`, a one-line `hook` for the page intro, a `tagline`, three `tags`, the `renderer`, the `licence` under which the platform offers it as a remix origin (`open` for the platform's own games, which earn no royalty; `derivatives-royalty` with `royaltyBps` for a contributed game whose author should), and `poster.seconds` (at most 120), the moment after page load at which its poster is captured from replay mode. [Contributing](CONTRIBUTING.md#galleryjson) has the exact rules, and `npm test` checks them. The list and order come from `scripts/games.mjs`, which the build, the dev server, the checks and the export share.

`npm run gallery:export` builds the export the platform serves: `gallery-out/<short-commit>/<slug>/` with the three bundle files and `poster.png`, `gallery-out/sources/<slug>.json` with the game's own source files, `manifest.json` for the Game Lab page, and `SOURCE.json` with the source commit, each game's poster moment and a SHA-256 per file. A **source pack** holds the game's own `.ts`, `.json`, `.html` and `.css` files, except `gallery.json` (and the README, which is not source). The export reads the packs and each `gallery.json` from the commit, not the working tree, so untracked files and uncommitted edits never reach a pack; the bundles and posters come from `dist/`. Pass `--sources worktree --commit <full SHA>` for a copy without `.git`. The platform's Studio starts a remix from a source pack: a creator describes a change, a model edits the files, the platform bundles them against its own SDK and crash maths, and the result publishes as a derivative whose lineage points back at the game here.

Posters need Playwright's Chromium: Playwright is a dev dependency, so after `npm ci` run `npx playwright install chromium` (CI adds `--with-deps` for the system libraries). A game whose page throws or logs an error while it plays, or whose poster is a single colour, fails the export. `--skip-posters` leaves posters out, keeping any already exported for the same commit.

`node scripts/gallery/sync-platform.mjs --export gallery-out --platform <platform checkout>` applies an export to the platform repository. It checks the whole export before it changes anything, and refuses an export without a poster for every game unless you pass `--allow-missing-posters`. A game whose bundle files and poster moment match the previous release reuses that release's poster, so an unchanged game adds nothing new to the platform's history. Earlier versioned asset directories stay so pages opened before a gallery release can still load their previews: every release that was live within the last 7 days (`--keep-days`), never fewer than the last 3 to go live (`--keep-min`), and always the new release and the one it replaces. `apps/web/public/assets/game-lab/releases.json` there lists them, and other release directories are deleted. The first sync with no `releases.json` lists every release directory already there and deletes none, and re-syncing the live release leaves the list unchanged. The page manifest, `SOURCE.json`, remix catalog and origin sources describe the active release.

The **Deploy Game Lab** workflow (`.github/workflows/game-lab-deploy.yml`) runs those steps after CI passes on a push to `main`, or on a manual run from `main`, which may name an earlier `main` commit that passed CI to roll back to. Pull request runs, forks included, never start it. It has two jobs:

- `export` builds every game, captures the posters and uploads the export as an artifact. It holds no secrets and can only read this repository.
- `publish` applies the artifact to a fresh checkout of the platform repository with `sync-platform.mjs` from the workflow's own commit on `main`. It opens a pull request there with the new bundles, posters, `SOURCE.json`, manifest and source packs (`packages/game-lab` there), or reuses the open one for the same commit. It waits for the platform's checks on the pushed commit, merges it and closes the `game-lab/<short commit>` pull requests it supersedes. The platform's Railway workflow then deploys `main`. `publish` installs no packages and runs no code from the build, and only its last step sees the token.

It needs the repository secret `GAME_LAB_PLATFORM_TOKEN`: a fine-grained personal access token (resource owner Crashwif) or a GitHub App, limited to the platform repository, with Contents read and write, Pull requests read and write, Checks read, Commit statuses read, Actions read and Metadata read, and nothing else. An App's installation token lasts an hour, so it would be minted per run rather than stored. Never use a personal gh CLI token (`gh auth token`) or a classic PAT: those reach every repository their owner can. The optional variable `GAME_LAB_PLATFORM_REPOSITORY` names the platform repository (default `Crashwif/crashwif`). Without the secret the publish job skips with a notice.

## Repository boundaries

- `games/`: game presentation and interactions. Games never select crash points.
- `packages/game-sdk/`: the shared client, protocol, embedded bridge and replay support.
- `packages/crash-math/`: the SDK's verification dependency; the platform's outcome implementation.
- `apps/emulator/`: the local development server. Its development controls are not production endpoints.
- `scripts/`: the game list, the page shell, the build, the dev server, the checks and the gallery export.
- `docs/`: integration and design references.

The SDK, maths and emulator are pinned source snapshots from the platform. [UPSTREAM.json](UPSTREAM.json) records the commit and paths. Changes to those packages belong in the platform repository, then are synchronized here. Games develop here independently. The gallery serves a checked-in build of each recorded example, refreshed by the Deploy Game Lab workflow, and links to its source.

Credits have no monetary value. The real backend supplies the committed round; game code controls only its presentation and sends player intents.
