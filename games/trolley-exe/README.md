# TROLLEY.EXE

*An ethics simulator. God is counting. He has notes.*

The trolley problem as a Game Lab skill game. The line forks again and again under a trolley that stays put on the screen, and someone is tied to both branches of every fork. At each one the player sets the switch (up or down) or leaves it to **AUTO-ETHICS.DLL**, the machine that throws the lever until the player does: fewest bodies, decided from a spreadsheet, with the occasional misread. The displayed multiplier is the **hesitation bonus**: the longer the round runs, the faster the forks arrive and the more credits are riding. God's patience drains with the same tension while He comments on every switch, and past 30× He leaves the building and the intern covers.

The ladder of forks climbs from the control group (five strangers above, one below) through a robot that learned to pray, your mother, the professor who invented the scenario and his students, a billionaire and the people he promised to feed, a cow and five podcasters, the trolley's lawyer and its inventor, the intern and your insurance adjuster, a politician and five undecided voters, a crypto bro, God Himself tied to the top track, five better versions of you, and finally everyone from the forks so far against an empty track. Past the ladder an overtime generator keeps composing forks from the cast, the same for a seed.

**Cashing out is walking away from the lever.** On the backend's confirmation a stamp goes up, God notes it, and the machine throws every switch after that while He points out what you could have had. **The crash is the program crashing.** A 0.15 s freeze, then the trolley lunges through the next fork on both branches at once, the picture tears into shifted strips, and a blue screen slides down with a stop code, the crash multiplier, `you.sys` (or `auto_ethics.dll` when the machine threw every switch) and a divine trace of the last switches in the Book. Walking away in time reads `LEVER_ABANDONED_IN_TIME`; spectating reads `SPECTATOR_COMPLICITY`; twenty-five bodies read `BODY_COUNT_OVERFLOW`.

No switch moves the credits or the crash point. The switches decide who falls, what God says and what the Book records.

## Run it

From the repository root, using the Node 24 version in `.nvmrc` and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- trolley-exe
```

- Replay: <http://127.0.0.1:4500/bundle/trolley-exe/index.html?mode=replay>
- Live: <http://127.0.0.1:4500/bundle/trolley-exe/index.html>

**Take the lever** during betting, then set each switch with **↑ ↓** or **W S**, a tap on the top or bottom half of the picture, or a vertical swipe; the switch locks when the trolley reaches the split. **Auto-ethics** hands the lever to the machine or takes it back. **Walk away** cashes out. Space performs the shell's action (join, then cash out) and never throws a switch. **Sound** cycles off, on and effects only. Credits have no monetary value.

## What to study

| File | What it holds |
| --- | --- |
| `scene.ts` | The composition: phases, the machine or the hand on the lever, the walk-away, the crash clock, the encore, the cues and the HUD. |
| `course.ts` | The course: forks laid on the distance run, the lever and its lock at the split, who falls as the trolley passes, the ledger, the machine's choices decided when a fork is laid, and a closed-form settle for late entry. |
| `cast.ts` | Every character as a few strokes on a stick figure, standing in rope or fallen, with the captions. |
| `lines.ts` | The ladder of dilemmas with God's line for each switch by whose hand threw it, the overtime pools, the rung lines, the walk-away and crash lines. |
| `input.ts` | The lever's controls, wired from the game's own files, with `dispose()`. |
| `world.ts` | The drawing: the CRT, the scrolling line and its forks, the levers, the trolley and its ghost, God's panel, the fork card, the readout, the glitch and the blue screen. |
| `script.ts` | The dialogue scheduler: one line typed at a time, keyed to the displayed multiplier, with late-entry settling. |
| `main.ts`, `audio.ts` | Unmodified copies of the shared shell and audio helper. |
| `replay.json` | A verified 9.07× recorded round, copied from the starter with this game's ID. |

### States

- **Waiting** and **betting**: the trolley rests at the start of the line, the first fork in view, the opening lines; the foot line tells a player with a stake from a spectator.
- **Running**: the line scrolls at a crawl that hurries on `1 − 1/x`; the fork card names the next question and its two branches, shows whose hand set the lever, and counts down to the split; the people wriggle as the trolley nears; the bell ticks faster; rungs ring milestones.
- **A switch**: the lever swings to the branch, locks at the split, the trolley follows the branch, the people on it fall, God speaks, the Book gains a line.
- **Walked away** (confirmed cash-out): the stamp, the machine at the lever, the regret lines keyed to how far the round climbs past the walk.
- **Crashed**: the freeze, the lunge through both branches, the tear, the blue screen typing its findings. Seen live, the ending plays on for up to 3.5 s into the next betting phase; met late, the lunge is run in one step and the aftermath draws settled and silent.
- **Late entry**: the course settles from a closed-form distance, the forks behind count as the machine's with their fallen, the lines already due are said, and a scene recreated mid-round on the same page picks its own course back up when the clocks agree.

### Sound

Procedural: `pageAudio({ style: 'chiptune', crash: 'static' })`. A switch clicks (a beep for the machine), the lock ratchets, a fall thuds, a cleared fork rings the bell, the walk-away is a door, the crash is a tape stop into static with a buzz. `clips.json` is empty; no recordings are included.

## Content

Dark comedy about death, deities, insurance, institutions and the player's own reflexes. The people on the tracks are adult archetypes, machines, animals and the player's own doubles; no real people are depicted and nobody is harmed, including the trolley, which has a lawyer. All visuals are original Canvas 2D shapes and text; no third-party assets. The game is an open remix origin (`gallery.json`).

See [integration](../../docs/integration.md), [animation](../../docs/animation.md) and [contributing](../../CONTRIBUTING.md).
