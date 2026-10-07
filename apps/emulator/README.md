# crashwif-emulator

A local stand-in for the game server so creator games can be built and tested without the platform: the same wire protocol, committed hash chains from `@crashwif/crash-math`, free credit sessions, deterministic scenarios and dev controls. What plays here plays on the platform, because both fold the same frames through `@crashwif/game-sdk`.

Pausing preserves each live session's remaining time, including sessions created during the pause. Resume adds the paused interval to expiry once. The `you` frame's `pausedAt` holds the saved clock position in epoch milliseconds.

```
npm run build
npx crashwif-emulator [--port 4500] [--scenario basic|fixed|edge|stress] [--seed <hex>] [--salt <text>]
                      [--betting-ms 5000] [--round-delay-ms 2000] [--time-scale 1] [--bots 0]
                      [--credits 1000] [--game emulator-game] [--serve <dir>] [--quiet]
```

| Scenario | What it does |
| --- | --- |
| `basic` | A fresh random chain and salt every run (or the `--seed` and `--salt` given); rounds every few seconds |
| `fixed` | The same chain every run, so tests can assert exact crash points |
| `edge` | A chain whose first rounds include an instant crash (1.00x) and a high multiplier |
| `stress` | The fixed chain with 200 bots betting (unless `--bots` says otherwise), for load and rendering tests |

Endpoints: `GET /health`, `GET /rooms/:id`, `GET /rooms/:id/chains` (every chain committed since start, oldest first, retired ones included), `GET /rooms/:id/chains/:c/rounds?from=0&limit=1000` (`{chain, rounds: [{roundIndex, seed, crashX100, settledAt}], next}`, where `next` is the index after a full page and `null` after a short one), `POST /dev/sessions` (mints a session token with free credits and answers `{sessionId, handle, token, credits, rounds, expiresAt, socketUrl, protocols}`; a body's `handle`, when it is a valid ranking name, names the session in the room's player list, and bots are named `bot_<n>`; `expiresAt` is in epoch milliseconds as in the socket's `you` state: `socketUrl` is `ws://127.0.0.1:<port>/ws?game=<id>` with no token in it, and `protocols` is the ready-made subprotocol list, so `new WebSocket(socketUrl, protocols)` connects as that session), `GET /dev/upcoming` (the next crash points, so assertions know the answer before the round), `POST /dev/control/pause|resume|bots`, `GET /bundle/*` (the directory given with `--serve`), and the socket at `/ws?game=<id>`, with the session token offered as the subprotocol `crashwif.token.<session>` next to `crashwif.room.v1` in the `Sec-WebSocket-Protocol` header, exactly as on the game server (the SDK does this; a `token` query parameter is ignored).

The socket accepts `bet {stake, targetX100}` with `null` for a manual-only bet, `cancel` before betting closes, and `cashout` during a live round. The crash formula is the platform's (`free.crashFromSeed` at the committed edge), so a round the emulator plays verifies with the same maths as a live one. The room, chain and rounds endpoints answer in the game server's shapes and paging, so `verifyRoomChain` from `@crashwif/crash-math/verify` checks an emulator chain's rounds exactly as it checks a live room's. There is no Solana anchor and nothing is stored: the chain is committed in memory (`saltSlot` 0, `anchorSignature` and `anchorSlot` null), so run the verifier without `rpcUrl` and `anchorKey`, which leaves the salt, anchor and history checks not checked, and the platform's fairness page shows the chain as not anchored on Solana. The game server's room list (`GET /rooms`) and per-round check (`GET /rooms/:id/verify/:chainId/:roundIndex`) are not served. Room IDs are lowercase letters, digits and hyphens, as the game server's are and as the verifier requests them, and the emulator refuses one with capitals. The fairness page takes only a room UUID, so it verifies an emulator room started with `--game <uuid>`, not the default `emulator-game`.
