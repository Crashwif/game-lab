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

## Repository boundaries

- `games/`: game presentation and interactions. Games never select crash points.
- `packages/game-sdk/`: the shared client, protocol, embedded bridge and replay support.
- `packages/crash-math/`: the SDK's verification dependency; the platform's outcome implementation.
- `apps/emulator/`: the local development server. Its development controls are not production endpoints.
- `docs/`: integration and design references.

The SDK, maths and emulator are pinned source snapshots from the platform. [UPSTREAM.json](UPSTREAM.json) records the commit and paths. Changes to those packages belong in the platform repository, then are synchronized here. Games develop here independently. The gallery serves a checked-in build of a recorded example and links to its source.

Credits have no monetary value. The real backend supplies the committed round; game code controls only its presentation and sends player intents.
