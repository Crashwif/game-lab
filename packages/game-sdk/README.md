# @crashwif/game-sdk

Everything a game needs to play a Crashwif room, whether it is the platform's own page, a creator's custom renderer or a test. Crash points never come from a game: every round is the room's committed hash chain, and the SDK carries the same integrity checks as the platform page (one snapshot per connection, seeds hashed back to the chain, crash points re-derived from seeds, chains that never change or go backwards). Credits have no value.

```
npm install @crashwif/game-sdk        # inside this repository it is a workspace
```

| Entry | What it gives you |
| --- | --- |
| `@crashwif/game-sdk` | Everything below |
| `@crashwif/game-sdk/protocol` | The wire types: `ServerMessage`, `ClientMessage`, `RoomInfo`, `PublicRoundState`, `RoundResult`, `YouState` |
| `@crashwif/game-sdk/state` | `applyMessage`, `emptyRoomState`, `RoomState` (the reducer the platform page uses), `formatX`, `ROOM_ERRORS` |
| `@crashwif/game-sdk/embed` | `connectEmbedded` for custom renderers, `hostGame` for hosts |
| `@crashwif/game-sdk/replay` | `verifyReplay`, `replayTimeline`, `ReplayPlayer` |
| `@crashwif/game-sdk/manifest` | `validateManifest`, `canonicalManifest`, the slots, renderers and licences |
| `@crashwif/game-sdk/progression` | `levelFor`, `xpFor`, formula v1 |

## A client

```ts
import { GameClient, formatX } from '@crashwif/game-sdk';

const client = new GameClient({ baseUrl: 'wss://play.crashwif.com' });
client.on('change', (state) => {
  if (state.round?.phase === 'running') draw(formatX(state.round.multiplierX100));
  if (state.integrity.length) showProblem(state.integrity); // the room did something wrong; betting is off
});
client.connect(gameId, async () => tokenFromYourSession()); // null to spectate
if (client.canBet) client.bet(100, null); // 100 credits, manual cashout only
// During a live round, client.cashout() requests the server's current multiplier.
```

The token comes from the platform (`GET /v1/me/sessions`) and belongs to the player's pass; the SDK never invents one.

## A custom renderer

A creator's renderer is HTML, JS and CSS published in a bundle and served by the API under a strict Content-Security-Policy. The platform frames it with `sandbox="allow-scripts"`: no origin, no network, no access to the page, no token. It talks to the page through the embed bridge, sees the same server frames the page does, and can ask to bet, cancel or cash out. Bet intents require the page's anchor and integrity checks. A cashout intent requires an active bet in a running round, and the server decides whether it arrived before the crash or auto target.

```ts
import { connectEmbedded } from '@crashwif/game-sdk/embed';

const game = connectEmbedded();
game.on('init', (manifest) => setup(manifest));
game.on('change', (state) => render(state));
game.on('refused', (intent, reason) => explain(reason));
button.onclick = () => game.canBet && game.bet(100, 250);
cashoutButton.onclick = () => game.canCashout && game.cashout();
game.resize(document.body.scrollHeight);
```

Load your own files with relative paths (`./sprite.png`); the CSP allows only the bundle's files. Everything else (`fetch`, external scripts, fonts from a CDN) is blocked by design. `examples/custom-renderer` is the smallest working renderer: three files, no build step, the embed protocol spoken by hand, ready to publish from the studio (choose "your own renderer", pick the three files, entry `index.html`).

## The manifest

A bundle is a manifest plus files. The manifest names the theme (category, mood, CSS colours by role), the asset slots (`background`, `character`, `effect`, `ui`, `icon`, `logo`), the audio preset, the renderer (`builtin-curve` for a character riding the curve, `builtin-balloon` for the floor-pump balloon scene, or `custom` with an HTML entry), the licence (`all-rights-reserved`, `derivatives-royalty` with `royaltyBps`, `open`) and, when you built on another creator's published game, `derivativeOf`. `validateManifest` runs in the studio and on the API, so a bundle the studio accepts is one the API accepts.

Publishing (`POST /v1/studio/bundles`) fingerprints every image and the bundle's words and compares them with other creators' published games (`@crashwif/game-fingerprint`). Originals go live at once; a declared derivative goes live under the parent's licence; an undeclared look-alike is held for review.

## Replays

A settled round carries its seed, salt, edge, bets and any manual cashout accepted by the server, so a replay is data, not a recording:

```ts
import { ReplayPlayer, verifyReplay } from '@crashwif/game-sdk/replay';

const round = await (await fetch(`${api}/v1/games/${gameId}/replay/${chain}/${index}`)).json();
console.log(verifyReplay(round)); // { ok: true, problems: [] }
const player = new ReplayPlayer(round, { speed: 2 });
player.on((event) => render(event)); // round.betting, bet, round.locked, tick, cashout, round.crashed
player.play();
```

## Testing offline

`apps/emulator` is a local game server with the same protocol: `npx crashwif-emulator --scenario edge --bots 3`, then point the client at `ws://127.0.0.1:4500`, mint a session with `POST /dev/sessions` and read the upcoming crash points from `GET /dev/upcoming` to write assertions. `--serve ./my-game` serves a bundle under development at `/bundle/`.
