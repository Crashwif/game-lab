# Rug Piste

A SkiFree-inspired downhill arcade game with a degen memecoin makeover: steer a neon skier with a frog backpack across a scrolling snowfield, dodge pines, jump rugs and gather $SLOPE coins. A retro desktop window, pixel characters, ski tracks and local chiptune audio frame the run. The run picks up speed as the multiplier climbs, and the slope warns of what lives under it: signs, giant footprints from 1.5×, a "YETI SIGHTING: PROBABLY NOTHING" board at 2× and a tremor at 3×. When the backend reports a crash, an abominable snowman with a DEV jersey bursts out of a hole and gobbles the skier. A confirmed cash-out sends a ski lift, with a KOL still shilling on the chair, to carry the skier away while a pink still-in degen keeps skiing.

## Preview

From the repository root, with Node 24 from `.nvmrc` and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- rug-piste
```

- Recorded round: <http://127.0.0.1:4500/bundle/rug-piste/index.html?mode=replay>
- Live emulator: <http://127.0.0.1:4500/bundle/rug-piste/index.html>

Stop and restart the preview after edits. **Restart replay** starts the recorded round again. Replay supports skiing but hides betting and cash-out. **Sound** cycles between off, on, and effects only.

## Controls

| Action | Keyboard | Touch / pointer |
| --- | --- | --- |
| Steer | Left / Right arrows or A / D | Hold the Left / Right buttons, or drag across the slope |
| Jump | Up arrow or W | Jump button |
| Join the next round | Space during betting | Ape in |
| Request cash-out | Space during the round | Cash out · ski lift |

The skier auto-carves in **DEMO** until the first steering or jump input switches to **MANUAL**. Click or tap the slope to focus keyboard play. Space belongs to the shared round controls; it does not jump, and the frame shows **SPACE = CASH OUT** (on touch screens, **TAP CASH OUT**) while your bag is in a running round. Spectators get their own copy. Clicking a ski button never takes keyboard focus, so Space still cashes out. When a button has keyboard focus, Space activates that button instead; a keyboard or assistive press of Left or Right moves one lane, never into the edge trees. The steering choice survives a scene replacement. Small screens use a taller slope and large touch controls.

Pines, rocks and rugs cause temporary stumbles that spill a quarter of the coin bag, and jumps let the skier clear low obstacles; a jump pressed up to 0.12 s before landing still fires. Each round lays out a fresh slope from a local seed. From 1.5× a second blocker joins each row and every third coin line needs a hop. Collecting coins, taking ramps and clearing obstacles adds arcade score. The lift banks the bag (worth nothing); the yeti eats an unbanked one. These local actions never determine the crash, multiplier, bet or cash-out result: skiing never moves the rug. Speed, signs, footprints, tremors and the heartbeat follow the current multiplier only, never the coming crash. Coins and style points have no monetary value, cannot be exchanged for credits, and are separate from the backend's valueless credits. The yeti appears only when `SceneView.phase` becomes `crashed`; the ski lift appears only after `cashoutX100` contains a backend-confirmed result.

## Implementation and validation

The game's scene and controller own skiing, collision feedback and presentation. The compact yeti uses two-bone inverse kinematics in `yeti-rig.ts`: it emerges facing up the slope, closes its hands on the skier's jacket, turns through a side view to face the camera, then raises the full-size skier high above its mouth. After a brief hold it lowers the skier into its mouth; teeth and the lower jaw hide the swallowed parts. The arm bones keep their lengths and both hands stay attached throughout the turn and lift.

The crash lands with a 0.14 s hit-stop, a 10% punch-in and a decaying shake; the run brakes into the yeti's arms with a snow spray, and a "DEV WALLET: AWAKE" banner names the multiplier about a third of a second after impact. After a cash-out the slope keeps scrolling, a regret ladder compares your exit with the still-in degen, and the yeti eats him instead. The ending lasts 5.25 seconds. If the host opens betting sooner, the canvas labels the animation **Previous round**, shows **NEXT RUN OPEN** and finishes it while the shared shell already offers the new round's controls; the fresh slope then fades in. A new running round or a replay restart interrupts the old ending immediately. Crash age reconstructs late-entry poses. Reduced Motion presents the same pop, grab, turn, lift and feeding sequence as held poses rather than skipping straight to the aftermath, and drops the punch-in, shakes, falling snow and spilled-coin arcs; the lift is shown parked, then gone. Long rounds keep changing: snow starts falling after 3×, the light turns to night skiing from 10×, and past 10× a new beat arrives every 1.6×.

`main.ts` and `audio.ts` are unmodified copies of `scripts/shell/`; the canonical CSS block is preserved above `/* game */`. The shared SDK owns round state and intents. `replay.json` keeps Hello World's verified 9.07× fixture unchanged except for `gameId`. It is a preview recording, not a live outcome generator.

Run from the repository root, in this order:

```sh
npm run build
npm run typecheck
npm run check
npm test
node --test games/rug-piste/*.test.mjs
```

Exercise waiting, betting, skiing, instant crash, the full yeti sequence, confirmed cash-out, replay/restart, a disconnected host, reduced motion and small screens. Build output is `dist/rug-piste/index.html`, `game.generated.js`, and `style.css`. Those three files are the Studio bundle; see the [integration guide](../../docs/integration.md) for publishing. A published frame uses only local assets and the shared platform bridge.

All visual artwork is original Canvas 2D pixel-style drawing. This is an independent homage to the classic downhill-skiing idea: no SkiFree code, graphics, music or other assets are included. Sound is generated locally by the repository's shared procedural audio helper; `clips.json` is empty. No external fonts, scripts, recordings or API keys are required. The game is an open remix origin.
