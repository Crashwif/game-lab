# MUMU Bull Run

Bears have a podcast. MUMU has horns. An enormous white bull charges through a satirical arena of flimsy FUD walls, smug podcasters, short-seller robots, cardboard chart gurus, copium kiosks and the fun police. The comedy comes from the characters' physical acting: planted hooves, compressing joints, a hinged head, trailing scarf, windup, impact and recovery.

The community reference is Pump mint `hf34pZHnV4entu9bdp4pFEmeKpivEUeSUhASgWopump`. The characters, artwork, organizations and dialogue are original fictional satire. This source pack does not represent a coin partnership or endorsement and contains no price feed or token transactions. A linked room still needs the platform's creator authorization and unlock checks.

## Play and presentation

**Join round** during betting, then **Cash out** while running. Space performs the available action unless another control has focus. The host owns betting when embedded. Credits have no monetary value.

The bull scuffs, snorts, tosses its head, rears and stomps while the next round is being prepared. The waiting animation uses the frame clock. Once running, each 6.8-second encounter has an approach, anticipation, a smash or close call, flying props and recovery. The sequence continues beyond 180 seconds, with recurring sponsors and antagonist variations. Every presentation beat derives from elapsed round time, so late entry and sequential playback share the same action. Gags, obstacles and character reactions do not choose or predict the round outcome.

Only the backend's `crashed` phase drops the giant bear stamp and opens the track. The bull is catapulted into a **LIVE SUPPORT** cubicle with a headset, printer, ringing phone and an unpaid internship. The punchline reaches its resting composition within 1.6 seconds and stays animated while the result is visible.

Confirmed `cashoutX100` summons a victory float carried by bears. The bull leaps onto it, puts on shades and showboats amid confetti. The accepted multiplier remains visible through the crash. A button click alone never starts the parade.

Desktop uses the full arena with a small stable HUD. Screens up to 600 CSS pixels wide use a tall acting composition with a large bull view, current opponent close-up, readable multiplier and gag. Reduced motion removes travel, particles, camera kicks and rig oscillation while preserving meaningful expressions, prop states and settled outcomes.

**Sound** cycles off, on and effects only. The canonical procedural helper supplies phonk, hoofbeats, impacts, crowd responses, a crash slam and the support phone. `clips.json` is empty. The complete game uses local code and needs no external assets, network calls or additional libraries.

## Preview and bundle

Use the repository's Node 24 and npm 11 toolchain:

```sh
npm run preview -- mumu-bull-run
```

The printed replay URL plays the verified example. Remove `?mode=replay` to play against the local emulator. **Restart replay** clears the round presentation. Stop and restart the preview after source edits.

`npm run build` produces `dist/mumu-bull-run/index.html`, `game.generated.js` and `style.css`. Upload those three files in Studio's **Your own renderer** flow with `index.html` as the entry. See the [integration guide](../../docs/integration.md) for the sandbox and host contract.

`motion.ts` defines the analytic encounter timeline and hoof targets. `rig.ts` draws the original articulated bull and bears. `acts.ts` owns the six physical gags; `arena.ts` the crowd, stage and outcome scenery; `portrait.ts` the tall composition. `scene.ts` connects presentation and audio to confirmed round state. `main.ts`, `audio.ts` and the shared CSS block are unchanged canonical copies. The replay retains the template's verified seed, hash and outcome with this game's ID. The gallery source is an open remix origin.
