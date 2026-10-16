# TROLLEY.EXE

*An ethics simulator. God is watching. He has notes.*

The trolley problem as a Game Lab round. Five people are tied to the main track, one to the side track, and the player's hand is on the lever. While the round runs, the trolley creeps toward the fork as the displayed multiplier climbs, labelled on the picture as the **hesitation bonus**: the longer you hold your nerve, the more you walk away with. God's patience bar drains with the same tension, and His commentary comes due rung by rung of the multiplier, from "the trolley is moving" through the sweating hand, the paperwork and the trolley's lawyer, until at 30× He leaves the building and the intern covers, wet manual and all.

**Pulling the lever is the cash-out.** On the backend's confirmation the lever swings, the trolley runs through the fork onto the side track and over the one tied there, a `PULLED AT` stamp goes up, God notes the wet hands, and the round keeps running without you while He points out what you could have had. **The crash is the program crashing.** The trolley lunges from the fork and takes the five one by one with hit-stop and a shake, the picture tears into shifted strips, and a blue screen slides down with a stop code, the multiplier it crashed at, `you.sys`, and a divine trace of the last things God said. A player who pulled in time sees the same blue screen read `LEVER_PULLED_IN_TIME` with the five still standing; a spectator gets `SPECTATOR_COMPLICITY`.

Everything in it is fictional, including the crash. Especially the crash.

## Run it

From the repository root, using the Node 24 version in `.nvmrc` and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- trolley-exe
```

- Replay: <http://127.0.0.1:4500/bundle/trolley-exe/index.html?mode=replay>
- Live: <http://127.0.0.1:4500/bundle/trolley-exe/index.html>

**Take the lever** during betting, then **Pull the lever** while the round runs. Space performs the available action unless another control has focus. **Sound** cycles off, on and effects only. Credits have no monetary value.

## What to study

| File | What it holds |
| --- | --- |
| `scene.ts` | The composition: phases, the pull, the crash clock, the encore, the cues and the HUD. |
| `world.ts` | The drawing: the CRT, the track and its fork, the tied figures, the trolley, the lever, God's panel, the readout, the glitch and the blue screen. |
| `script.ts` | The dialogue scheduler: a ladder keyed to the displayed multiplier, one line typed at a time, an overtime cycle, late-entry settling. |
| `lines.ts` | What God and the intern say, the regret ladder after a pull, the crash lines and the stop codes by outcome. |
| `main.ts`, `audio.ts` | Unmodified copies of the shared shell and audio helper. |
| `replay.json` | A verified 9.07× recorded round, copied from the starter with this game's ID. |

### States

- **Waiting**: the trolley rests at the start of the approach; God suggests you stretch.
- **Betting**: the opening lines; the foot line tells a player with a stake ("hand on the lever") from a spectator.
- **Running**: the trolley creeps toward the fork on `1 − 1/x`, so most of its travel happens before 3×, where most rounds end; the five wriggle harder as it nears; the bell ticks faster; rungs ring a milestone.
- **Pulled** (confirmed cash-out): the lever, the run onto the side track, the one who falls, the stamp, the regret lines keyed to how far the round climbs past the pull.
- **Crashed**: a 0.15 s freeze, the lunge, the five falling, a shake, the tear, the blue screen typing its findings. Seen live, the ending plays on for up to 3.5 s into the next betting phase; met late, the aftermath draws settled and silent.
- **Late entry**: the script settles to the lines already due, the rungs already rung, and the lever as it stands.

Tension is presentation only. The trolley never reaches the fork while the round runs, so no pose ever implies when the crash will come; the crash point arrives from the backend and the scene draws from the crash clock alone.

### Sound

Procedural: `pageAudio({ style: 'chiptune', crash: 'static' })`. Lines tick as they start (a beep for the intern), the bell quickens with tension, rungs ring milestones, the pull rings and ratchets, the fall thuds, and the crash is a tape stop into static with a buzz. `clips.json` is empty; no recordings are included.

## Content

Dark comedy about death, deities, insurance and the player's own reflexes. No real people are depicted. Nobody is harmed, including the trolley, which has a lawyer. All visuals are original Canvas 2D shapes and text; no third-party assets. The game is an open remix origin (`gallery.json`).

See [integration](../../docs/integration.md), [animation](../../docs/animation.md) and [contributing](../../CONTRIBUTING.md).
