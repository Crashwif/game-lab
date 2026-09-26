# Connect a game

## The same game in two hosts

Balloon Pump uses `GameClient` when opened locally and `connectEmbedded()` when framed by the platform. Both expose the same room state: `round.phase`, `round.runningSince`, `round.multiplierX100`, `round.crashX100`, and `you`. The scene accepts that state and draws it. It does not determine the round's outcome.

1. `betting`: prepare the scene and accept a bet intent.
2. `running`: animate from the server start time, accounting for `clockOffsetMs`. The shared `free.multiplierAtContinuousX100()` helper smooths the display between ticks.
3. `crashed`: use the backend's final multiplier, stop pumping, and play the burst.
4. `waiting`: hold a resting pose until the next round.

`games/balloon-pump/main.ts` is the integration reference. `scene.ts` and `pumper.ts` are ordinary Canvas 2D drawing code; another game can use WebGL, a 3D engine, or DOM elements with the same adapter.

## Drop-in SDK

The packages are included as npm workspaces; no registry access or platform repository access is needed beyond installing their public dependencies. To use the SDK in another project:

```sh
# In this repository
npm ci
npm run build
npm run pack:sdk
# In your own project (adjust the paths)
npm install /path/to/crashwif-games/crashwif-crash-math-0.1.0.tgz /path/to/crashwif-games/crashwif-game-sdk-0.1.0.tgz
```

Bundle the SDK with your game. It is not published on npm under these names.

```ts
import { connectEmbedded } from '@crashwif/game-sdk/embed';
const game = connectEmbedded();
game.on('change', state => render(state));
join.onclick = () => { if (game.canBet) game.bet(50, null); };
exit.onclick = () => { if (game.canCashout) game.cashout(); };
```

The host retains session tokens, verifies the room and permits or refuses intents. Listen for `refused` to explain rejected actions. Use `game.close()` when disposing the scene.

## Emulator

`npm run dev` builds and starts the emulator on port 4500. `GameClient` connects to `ws://127.0.0.1:4500`, room `emulator-game`. The example gets a local session from `POST /dev/sessions`. Only the emulator offers that endpoint. Its `edge` scenario exercises short and long rounds. See [the emulator guide](../apps/emulator/README.md) for other scenarios.

## Direct backend connections

A standalone host can use the same client with the deployed game-server URL, a real room ID, and a session token supplied by your authenticated platform integration:

```ts
import { GameClient } from '@crashwif/game-sdk';
const client = new GameClient({ baseUrl: gameServerUrl });
client.on('change', state => render(state));
client.connect(roomId, async () => sessionTokenFromPlatform());
// Or client.connect(roomId, null) to spectate.
```

Production sessions come from the platform's pass flow, not the emulator. Never include tokens in source code or URLs. The client verifies protocol integrity; an independent production host must also perform the platform's Solana anchor checks before allowing bets. The embedded path uses those checks in the platform host.

## Publish through Studio

1. Run `npm run build`.
2. Open Studio, start a blank project, and choose **Your own renderer**.
3. Upload `index.html`, `game.generated.js`, and `style.css` from `dist/balloon-pump/`; set the entry to `index.html`.
4. Save and publish to a room you own.

Published frames have an opaque origin and no network access. Keep scripts, fonts, images and audio inside the bundle and use relative paths. The production URL has no `mode=replay` query: the game connects to the platform bridge automatically. The explicit replay mode is for the inspiration gallery only and has no bet controls.
