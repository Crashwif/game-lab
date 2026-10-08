# MUMU Bull Run

An original cartoon crash game for the MUMU community: a chunky white bull with a green scarf charges up an endless run of emerald ramps while a bear construction crew hangs a ridiculous blockade over the course. Its heavy outlined characters, golden stadium signs, city silhouettes and cheering spectators use a cream, emerald and black comic palette.

The community reference is the Pump mint `hf34pZHnV4entu9bdp4pFEmeKpivEUeSUhASgWopump`. The artwork is an original interpretation; this source pack does not represent an endorsement or a coin partnership. It contains no token transactions or market-price feed. A linked room still requires the platform's creator authorization and unlock checks.

## Play and presentation

**Join round** during betting, then **Cash out** while running. Space performs the available action unless a different control has focus. The host owns betting when embedded. Credits have no monetary value.

The bull's opposing diagonal leg pairs alternate ground contact and lifted return, with body compression, trailing scarf and tail motion. A scrolling uphill track, dust and stadium chapters continue through long rounds; each 150-second lap cycles through six presentation chapters. Those chapters do not predict a crash.

Only `view.phase === 'crashed'` drops the bear blockade and folds the ramps. The bull makes a harmless landing on a padded cushion. Confirmed `cashoutX100` takes the bull into the safe grandstand; that confirmation and its multiplier persist through the crash. A button intent does not trigger the exit.

The scene derives its course, stride and chapter from elapsed round time, so a late entry and replay restart show coherent poses. Reduced motion holds the course and character travel still, removes dust and snort effects, and shows the settled cash-out or crash pose. The shared shell owns round data, timing, replay, controls, resizing, stale-host handling and SDK connections.

**Sound** cycles off, on and effects only. The shared procedural audio helper supplies an opt-in phonk rhythm, soft hoofbeats, crowd cues and the blockade's thud and clang. `clips.json` is empty; no external images, fonts, recordings or network resources are required.

## Preview and bundle

Use the repository's Node 24 and npm 11 toolchain:

```sh
npm run preview -- mumu-bull-run
```

The printed replay URL plays the verified sample round. Remove `?mode=replay` to play against the local emulator. **Restart replay** clears the round presentation. Stop and restart the preview after source edits.

`npm run build` produces `dist/mumu-bull-run/index.html`, `game.generated.js` and `style.css`. Upload those three files through Studio's **Your own renderer** flow and select `index.html` as the entry. See the [integration guide](../../docs/integration.md) for the sandbox and the host contract.

`art.ts` contains the original vector character rigs and drawing helpers; `scene.ts` composes the environment, outcomes and phase-driven sound. `main.ts`, `audio.ts` and the shared CSS block are canonical shell copies. The replay fixture retains the template's verified seed, hash and outcome with this game's ID. The gallery source is offered as an open remix origin.
