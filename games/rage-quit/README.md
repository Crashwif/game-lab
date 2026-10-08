# Rage Quit

An original ink comic for a RAGEGUY community game concept. A desk worker meets an endless procession of pop-ups, forgotten passwords and disconnected keyboards. His expression, frantic typing and comic-panel mood follow the round multiplier. Only the backend's crash flips the desk and shatters the CRT. A confirmed cash-out gives the character a peaceful cup of tea that persists through the crash.

The mood meter is cosmetic; it gives no information about when a crash occurs. Credits have no monetary value. The game does not claim an official community partnership or link a token or room.

## Preview and controls

From the repository root with Node 24 and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- rage-quit
```

Open the printed recorded-preview URL. Remove `?mode=replay` for live emulator play. Join during betting, then cash out while running; Space performs the available action unless another control has focus. Sound cycles off, on and effects only. Restart replay plays the verified recording again.

The 960 × 540 drawing fits the shared responsive shell. All illustrations are original Canvas 2D code in `ink.ts` and `room.ts`. Sound uses the shared chiptune synthesizer and slam stinger; no external assets, fonts, libraries, recordings or requests are required. The four comic panels form the visual ending; the game does not include an image-export control.

## Integration

`main.ts`, `audio.ts` and the CSS before `/* game */` are canonical shell copies. `scene.ts` consumes the verified `SceneView`; timing, room-curve interpolation, controls and replay stay with the shared SDK shell. `replay.json` preserves the template's verified seed, hash and result with this game's ID.

Every pose comes directly from elapsed round time, final crash age and confirmed cash-out state. Annoyance episodes repeat in bounded cycles through long rounds. Late entry reconstructs the current pose without replaying earlier sounds. Reduced motion holds the character and props still, removes shake and flying debris, and presents the settled crash pose with all round labels intact.

Build from the repository root and upload `dist/rage-quit/index.html`, `game.generated.js` and `style.css` through Studio's **Your own renderer** flow. Published frames use the platform bridge; the host owns betting and the shared shell offers cash-out. Publishing and room linking remain separate actions.

Community context: the intended research prospect is RAGEGUY, mint `GvV7sFu6FHJsSVXfpG7xqFnWar3c7YkcC74rqe7Bpump`. This identifier is documentation only and does not configure runtime transactions or establish eligibility, ownership or endorsement.

See the [integration guide](../../docs/integration.md) for the host contract and validation states.
