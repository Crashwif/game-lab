# crashwif-emulator

A local stand-in for the game server so creator games can be built and tested without the platform: the same wire protocol, committed hash chains from `@crashwif/crash-math`, free credit sessions, deterministic scenarios and dev controls. What plays here plays on the platform, because both fold the same frames through `@crashwif/game-sdk`.

```
npm run build
npx crashwif-emulator [--port 4500] [--scenario basic|fixed|edge|stress] [--seed <hex>] [--salt <text>]
                      [--betting-ms 5000] [--round-delay-ms 2000] [--time-scale 1] [--bots 0]
                      [--credits 1000] [--game emulator-game] [--serve <dir>] [--quiet]
```

| Scenario | What it does |
| --- | --- |
| `basic` | A random-looking chain from a fixed top seed; rounds every few seconds |
| `fixed` | The same chain every run, so tests can assert exact crash points |
| `edge` | A chain whose first rounds include an instant crash (1.00x) and a high multiplier |
| `stress` | Fast rounds with bots betting, for load and rendering tests |

Endpoints: `GET /health`, `GET /rooms/:id`, `GET /rooms/:id/chains`, `GET /rooms/:id/chains/:c/rounds`, `POST /dev/sessions` (mints a session token with free credits), `GET /dev/upcoming` (the next crash points, so assertions know the answer before the round), `POST /dev/control/pause|resume|bots`, `GET /bundle/*` (the directory given with `--serve`), and the socket at `/ws?game=<id>&token=<session>`.

The socket accepts `bet {stake, targetX100}` with `null` for a manual-only bet, `cancel` before betting closes, and `cashout` during a live round. The crash formula is the platform's (`free.crashFromSeed` at the committed edge), so a round the emulator plays verifies with the same maths as a live one. There is no Solana anchor: the platform page's on-chain check is skipped here, which is the one difference from production.
