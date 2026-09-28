# Connect a game

## The same game in two hosts

Every game's `main.ts` is the same page shell (canonical copy: `scripts/shell/main.ts`). It uses `GameClient` when opened locally and `connectEmbedded()` when framed by the platform. Both expose the same room state: `round.phase`, `round.runningSince`, `round.multiplierX100`, `round.crashX100`, and `you`. The shell turns that state into a view, and the game's scene draws it. Neither determines the round's outcome.

1. `betting`: prepare the scene and accept a bet intent.
2. `running`: animate from the server start time, accounting for `clockOffsetMs`. The shared `free.multiplierAtContinuousX100()` helper smooths the display between ticks. The shell's multiplier runs at most a second ahead of the last server frame, and after 2 s without one it treats the link as lost and stops offering Cash out.
3. `crashed`: use the backend's final multiplier, stop pumping, and play the burst.
4. `waiting`: hold a resting pose until the next round.

`scripts/shell/main.ts` is the integration reference. Balloon Pump's `scene.ts` and `pumper.ts` are ordinary Canvas 2D drawing code; another game can use WebGL (Seed Round renders WebGL2 offscreen and copies each frame in), a 3D engine, or DOM elements with the same shell.

## Drop-in SDK

The packages are included as npm workspaces; no registry access or platform repository access is needed beyond installing their public dependencies. To use the SDK in another project:

```sh
# In this repository
npm ci
npm run build
npm run pack:sdk
# In your own project (adjust the paths)
npm install /path/to/game-lab/crashwif-crash-math-0.1.0.tgz /path/to/game-lab/crashwif-game-sdk-0.1.0.tgz
```

Install both tarballs in one command: the SDK depends on the crash maths, and on its own it would send npm to the registry for it. Bundle the SDK with your game. It is not published on npm under these names.

```ts
import { connectEmbedded } from '@crashwif/game-sdk/embed';
const game = connectEmbedded();
game.on('change', state => render(state));
// 'allow' changes game.canBet and game.betsBlockedBecause without a 'change'.
game.on('allow', () => render(game.state));
game.on('refused', (_intent, reason) => showNotice(reason));
// The host's bet panel sets the stake, so the frame offers Cash out only.
exit.onclick = () => { if (game.canCashout) game.cashout(); };
const main = document.querySelector('main')!;
new ResizeObserver(() => game.resize(Math.ceil(main.getBoundingClientRect().height))).observe(main);
```

The host retains session tokens, verifies the room and permits or refuses intents. Use `game.close()` when disposing the scene.

## Embedded mode

Framed by the platform, the page runs beside the host's own console, which owns the socket, the stake picker and the credit bank. The shell follows that:

- It hides its Join button, because the host's bet panel sets the stake.
- It keeps Cash out: that takes no stake, and relays the same room action as the host's button.
- It reports its height with `game.resize()` from a `ResizeObserver` on `<main>`, so the host can size the frame to the picture and the controls at any width.
- Its buttons grey out with `aria-disabled` rather than `disabled`, so a focused button keeps focus through a round.
- Once the player has clicked into the frame, Space cashes out while a round runs, unless another control has focus.
- It leaves the credit balance to the host's credit bank.

The host's verdict on betting arrives as `allow`, which emits no `change`, so the shell re-renders on it. While the host is not taking bets, `game.betsBlockedBecause` gives the reason, and the status line shows it during betting as "Betting is paused · <reason>". A refused intent arrives as `refused` with the host's reason; the shell shows it as a notice for 4 s and offers the button again.

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

Published frames have an opaque origin and no network access. Keep scripts, fonts, images and audio inside the bundle and use relative paths. The production URL has no `mode=replay` query: the game connects to the platform bridge automatically. The explicit replay mode is for the gallery and the Studio preview only and has no bet controls.
