# @crashwif/game-sdk

Everything a game needs to play a Crashwif room, whether it is the platform's own page, a creator's custom renderer or a test. Crash points never come from a game: every round is the room's committed hash chain, and the SDK carries the same integrity checks as the platform page (one snapshot per connection, seeds hashed back to the chain, crash points re-derived from seeds, chains that never change or go backwards). Credits have no value.

The SDK is the workspace `@crashwif/game-sdk` of this repository (a private package, not published to npm). Other workspaces depend on it by name and import its built output, so build it first:

```
npm run build -w @crashwif/crash-math && npm run build -w @crashwif/game-sdk
```

| Entry | What it gives you |
| --- | --- |
| `@crashwif/game-sdk` | Everything below |
| `@crashwif/game-sdk/protocol` | The wire types: `ServerMessage`, `ClientMessage`, `RoomInfo`, `PublicRoundState`, `RoundResult`, `RoomPlayer`, `YouState` |
| `@crashwif/game-sdk/state` | `applyMessage`, `emptyRoomState`, `RoomState` (the reducer the platform page uses), `playerOutcome` (where a listed bet stands: queued, placed, riding, won or lost), `formatX`, `ROOM_ERRORS`, and the socket helpers `ROOM_PROTOCOL`, `roomSocketUrl`, `roomSocketProtocols`, `roomTokenFromProtocols` |
| `@crashwif/game-sdk/embed` | `connectEmbedded` for custom renderers, `hostGame` for hosts |
| `@crashwif/game-sdk/replay` | `verifyReplay`, `replayTimeline`, `ReplayPlayer` |
| `@crashwif/game-sdk/manifest` | `validateManifest`, `canonicalManifest`, the slots, renderers and licences |
| `@crashwif/game-sdk/progression` | `levelFor`, `xpFor`, formula v1 |

## A client

`GameClient` connects a game renderer to a room. Its `gameId` option and the `RoomInfo.gameId` protocol field contain the **room UUID**, shared by the coin link, passes and fairness history. A Studio `projectId` identifies an editable game draft, and a `bundleId` identifies a versioned publication. See [Rooms and game identifiers](../../docs/architecture/data-model.md#rooms-and-game-identifiers).

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

The room announces the multiplier curve its chain runs on (`state.room.curve`: how fast the multiplier climbs, and so when each crash point arrives). Pass it to the maths whenever you draw between the server's ticks; the maths refuse to run without a curve, so a game never carries a pace of its own that a room could outgrow:

```ts
import { free } from '@crashwif/crash-math';

function multiplierNow(state: RoomState, now = Date.now()): number {
  const { room, round } = state;
  if (!room || !round || round.phase !== 'running' || round.runningSince === null) return round?.multiplierX100 ?? 100;
  return Math.max(round.multiplierX100, free.multiplierAtX100(now + state.clockOffsetMs - round.runningSince, room.curve));
}
```

The token comes from the platform (`GET /v1/me/sessions`) and belongs to the player's pass; the SDK never invents one. It offers the token as the subprotocol `crashwif.token.<token>` next to `crashwif.room.v1` in the `Sec-WebSocket-Protocol` header, never in the socket URL, so proxy and access logs never see it: `roomSocketUrl(base, gameId)` builds the URL and `roomSocketProtocols(token)` the protocol list (`ROOM_PROTOCOL` alone for a spectator), and a custom `makeSocket` option has the shape `(url, protocols) => WebSocket-like`. A server reads the token back with `roomTokenFromProtocols(header)`.

## A custom renderer

A creator's renderer is HTML, JS and CSS published in a bundle and served by the API under a strict Content-Security-Policy. The platform frames it with `sandbox="allow-scripts"`, `credentialless` and no referrer: no origin, no credentials, no network, no access to the page, no token. The host blanks the player's session id in everything it forwards (`you.sessionId` is an empty string in the init state and in every `state` and `you` frame). It talks to the page through the embed bridge, sees the same server frames the page does, and can ask to bet, cancel or cash out. Bet intents require the page's anchor and integrity checks and a live pass; while the host is not taking bets, `game.betsBlockedBecause` carries the host's reason ("get a play pass to bet", "the chain is still being checked"), so a game can print it. A bet is also bounded by the player: `game.maxStake` is the most credits one bet may stake, the stake the player set on the page's own controls, and a bet above it is refused with `stake above your limit of N credits` and never reaches the room (`null` means no bound; the `allow` event carries `(allowed, reason, maxStake)` when any of them changes). A cashout intent requires an active bet in a running round, and the server decides whether it arrived before the crash or auto target.

```ts
import { connectEmbedded } from '@crashwif/game-sdk/embed';

const game = connectEmbedded();
game.on('init', (manifest) => setup(manifest));
game.on('change', (state) => render(state));
game.on('refused', (intent, reason) => explain(reason));
game.on('allow', (allowed, reason, maxStake) => showLimit(allowed ? maxStake : reason));
button.onclick = () => game.canBet && game.bet(Math.min(100, game.maxStake ?? 100), 250);
cashoutButton.onclick = () => game.canCashout && game.cashout();
new ResizeObserver(() => game.resize(document.body.scrollHeight)).observe(document.body);
```

The room's frame never scrolls, so report your height whenever it changes. The frame takes the room's width, lays your page out at most 1,100 px wide (scaled up in a wider room) and takes the height you last reported, from 200 to 1,200 px, showing at most 60% of the viewport's height. Until you report, it assumes a 16:9 picture over one row of controls.

Once your game has said it is ready, the host pings it every 5 seconds (`{proto, type: 'ping', at}`) and expects `{proto, type: 'pong', at}` back with the same `at`. A game declares that it answers by sending `{proto, type: 'ready', pongs: true}`; `connectEmbedded()` declares it and answers on its own. The host watches a game that declared pongs or has answered a ping, and counts the pings sent since the game's last message of any kind: a watched game that leaves three in a row unanswered is stopped by the host frame (the player gets a "Reload game" button), about 20 seconds after its last message. A game that neither declares nor answers is left alone. Liveness is counted in pings, not in wall-clock time, so a throttled or suspended tab never stops a healthy game: after a suspension the first tick sends one ping, and its answer resets the count. A renderer speaking the protocol by hand declares `pongs: true` in its ready message and answers a ping in its message handler, as the example does. A game that navigates its frame elsewhere is stopped the same way.

Load your own files with relative paths (`./sprite.png`); the CSP allows only the bundle's files. Everything else (external scripts, fonts from a CDN, `fetch` or `XMLHttpRequest` to anything but a `data:` URL) is blocked by design, and the publish checks refuse WebRTC. `examples/custom-renderer` is the smallest working renderer: three files, no build step, the embed protocol spoken by hand (it declares `pongs: true` and answers pings), ready to publish as a bundle through `POST /v1/studio/bundles` with entry `index.html` (the studio itself publishes a custom renderer only as a Game Lab remix).

## The manifest

A bundle is a manifest plus files. The manifest names the theme (category, mood, CSS colours by role), the asset slots (`background`, `character`, `effect`, `ui`, `icon`, `logo`), the audio preset and any recorded clips (`audio.clips`: a bundle path per cue, `music` or a game event, played instead of the synthesised sound), the renderer (`builtin-curve` for a character riding the curve, `builtin-balloon` for the floor-pump balloon scene, or `custom` with an HTML entry), the licence (`all-rights-reserved`, `derivatives-royalty` with `royaltyBps`, `open`) and, when you built on another creator's published game, `derivativeOf`. `validateManifest` runs in the studio and on the API, so a bundle the studio accepts is one the API accepts.

Publishing (`POST /v1/studio/bundles`) fingerprints every image and the bundle's words and compares them with other creators' published games (`@crashwif/game-fingerprint`). Originals go live at once; a declared derivative goes live under the parent's licence; an undeclared look-alike is held for review. A custom renderer also passes a safety review ([creator-games.md](../../docs/architecture/creator-games.md#safety-review-of-custom-renderers)): it waits for the review when its creator's latest decided review is not a pass or the publish checks flag it, and otherwise goes live at once and is reviewed behind.

## Replays

A settled round carries its seed, salt, edge, the curve its chain ran on, bets and any manual cashout accepted by the server, so a replay is data, not a recording (`replayCurve(round)` gives the curve to draw it on; a recorded round naming none ran on `free.FIRST_CURVE`):

```ts
import { ReplayPlayer, verifyReplay } from '@crashwif/game-sdk/replay';

const round = await (await fetch(`${api}/v1/games/${gameId}/replay/${chain}/${index}`)).json();
console.log(verifyReplay(round)); // { ok: true, problems: [] }
const player = new ReplayPlayer(round, { speed: 2 });
player.on((event) => render(event)); // round.betting, bet, round.locked, tick, cashout, round.crashed
player.play();
```

## Testing offline

`apps/emulator` is a local game server with the same protocol: `npx crashwif-emulator --scenario edge --bots 3`, then point the client at `ws://127.0.0.1:4500`, mint a session with `POST /dev/sessions` (it answers with `socketUrl` and the `protocols` list that carries the token, so `new WebSocket(socketUrl, protocols)` connects as that session) and read the upcoming crash points from `GET /dev/upcoming` to write assertions. `--serve ./my-game` serves a bundle under development at `/bundle/`.
