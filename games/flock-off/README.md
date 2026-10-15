# Flock Off

A man in all black on a BMX, a city of strip malls and HOA lawns, and a Flock camera on every other pole. The game rides the bike; you aim the gun. Shoot the cameras off their poles as they scroll past, keep a streak, and get in the Kia before the police get him. The round's crash is the bust.

The lab's fifth skill game (`interactive: true`), after Rug Rails, Up Only, Rug Piste and Gays of Hormuz. It is satire: the cameras are property, nobody in it gets hurt, and the one thing the gun cannot point at is a person.

## Preview

From the repository root, with Node 24 from `.nvmrc` and npm 11:

```sh
npm ci --include=dev --bin-links=true
npm run preview -- flock-off
```

- Recorded round: <http://127.0.0.1:4500/bundle/flock-off/index.html?mode=replay>
- Live emulator: <http://127.0.0.1:4500/bundle/flock-off/index.html>

**Ride** joins the round during betting and **Cash out · the Kia** leaves it while he rides. **Restart replay** plays the recorded round again; the recording rides a fixed city and the aimbot shoots it until you do. **Sound** cycles off, on and effects only.

## Controls

| Action | Keyboard | Mouse / touch |
| --- | --- | --- |
| Aim | Arrow keys or WASD move the reticle | Move the mouse over the picture, or drag on a touch screen |
| Fire at the reticle | F, Enter, J, K or X | Click, or tap a camera; the **FIRE** button |
| Reload early | R | The **RELOAD** button |
| Join the next ride | Space during betting | Ride |
| Get in the Kia | Space while he rides | Cash out · the Kia |

The gun belongs to the aimbot ("free trial") until the first click, tap, fire key or aim key, and then to the player for the rest of the page (a replaced scene keeps it). Hovering before that shows a faint second crosshair that says so. Clicking a gun button never takes focus, so Space still cashes out; the picture says **SPACE = CASH OUT = THE KIA** (or **TAP CASH OUT** on touch screens) while your bet is on the bike. Space belongs to the shared shell and never fires.

## How the city plays

The picture is a side view: he rides to the right at a speed set by the multiplier (190 px/s at 1×, 270 at 2×, capped at 350 from about 4×) and the city scrolls past. The game owns the travel, including the bunny hops over the potholes. The reticle lives in screen space; a shot is point-and-click, lands wherever the reticle is, and the first live camera within its radius takes the hit. A miss leaves a bullet hole in whatever was behind it. The magazine holds eight; it reloads itself in under a second when empty, or sooner on R.

Cameras are laid ahead in 300 px segments from a local seed and the multiplier at the time (never the crash point): poles with a solar panel from the start, cameras bolted under street lamps from 1.15×, doorbells on posts from 1.3×, signal arms over the road from 1.5×, speed boxes from 1.8×, a **Flock mobile unit** trailer with three heads (three hits) every seventh segment from 2.5×, and pigeons that are, on inspection, drones from 1.2×. From 2× a segment can carry two. The city around them is a pure function of the segment: strip malls with neon signs, houses with porch lights and lawn signs, warehouses with graffiti, a church with a letter board, a gas station, empty lots behind chain link, billboards every fifth lot, bus stops, hydrants, a dumped scooter and the potholes.

A camera that passes unshot **reads** him: an IR flash, a SEEN tally, a toast ("PLATE READ: NO PLATE?? (IT IS A BMX)"), the streak reset and the cruisers lunging closer for a second. A read is presentation only. It never touches the round, the bet or the payout. **DEFLOCKED**, **SEEN** and the streak are arcade counts with no value of any kind.

The aimbot picks the soonest camera to pass that is still ahead of the muzzle, takes a moment to react to a new target, and looks at its phone for about one camera in seven: it aims wide of those, fires twice, and lets them read him, so the demo gets seen now and then.

## The round, keyed to the multiplier

- **The pursuit** escalates with the multiplier: one cruiser noses in at the edge of the picture at 1.2×, a second at 1.7×, Channel 4's chopper with a spotlight at 2.6×, a SWAT truck (for a bicycle) at 3.5×, a police chopper at 4.2×, a Flock drone that hovers over his shoulder reading him at 6×, the feds in the near lane at 9×, and at 30× something that is not a news helicopter. The lead cruiser closes from 380 px behind him to 160 as the heat (1 − 1/x) rises and never reaches him: only the backend's crash ends the ride.
- **The chyron** runs a ladder of lines from the narrator, the group chat, Karen on Nextdoor, dispatch, Flock HQ, Channel 4, city council and the feds, a few seconds apart through 1× to 3× and on to 22×, then an overtime line every 1.35× for as long as the ride lasts.
- **The Nextdoor feed** at the foot of the picture recombines names, places and takes so it never repeats for long, and posts faster with the tension.
- **The light** goes from golden hour to night by about 6×: stars, a moon, lit windows, neon that flickers, lamps with cones of light, the choppers' spotlights.
- **A heartbeat** under the phonk quickens with the multiplier while your bet is on the bike; milestone stingers mark 1.5×, 2×, 3×, 5×, 10× and on.

## The getaway and the bust

Only a cash-out the backend confirms brings the Kia. It pulls alongside in the near lane, the door opens, he bails in, and an identical man in black bails out onto the bike: **the decoy**, who has the aimbot. The Kia leaves with you in it, tagged **YOU · IN THE KIA · GONE**, and a card under the heat meter keeps backing your exit ("DOUBLE WITHOUT YOU. STILL FREE. STILL UNPERCEIVED.").

The crash is the backend's alone and is decided from the crash point with a seeded generator: what gets him (a PIT manoeuvre from the lead cruiser, a spike strip, Officer Hedge bursting from a hedge, a taser from a cruiser window, or a Flock drone with a net) and how they found him (Strava, a Ring doorbell, his mom, an AirTag on the BMX, the one camera he missed, Nextdoor). A 0.14 s hit-stop and 0.45 s of slow motion with a punch-in and a shake; the cruiser or the strip lunges in through the freeze; then the bike flips, pitches over the bars, rolls on riderless or tips over as a pure function of crash time, and he is thrown on a closed-form flight that lands him lying down. Officers run in from the cruiser and pile on. One arm stays out of the pile, phone up, **POSTED**. The cards read the cause, **CRASHED OUT AT x.xx×**, what it meant for you, and how they found him; a mugshot polaroid slides in with the mask still on ("SUSPECT DECLINED TO REMOVE MASK"), the charges (criminal mischief × the cameras you deflocked, no helmet, vibes), and a note if it was the decoy.

The ending takes about 5.6 seconds. If the host opens betting sooner it finishes under a **NEXT RIDE · BETTING OPEN** banner while the shell already offers the new round, and the next ride fades up at the kerb. A new running round or a replay restart cuts it short. A scene opened after the crash settles the same frame from crash time and plays the quiet crash; a scene opened mid-round rebuilds the city at the right distance with nothing live at the kerb, the pursuit already on the road and a fresh arcade score, and one replaced after a short hidden-tab gap gets its ride back.

## Files

| File | What it holds |
| --- | --- |
| `city.ts` | The course: the ride's speed and distance from the multiplier, segments laid from the seed, the cameras and the scenery as functions of the segment, the bunny hop, the gun (magazine, reload, point-and-click hit test), reads, and the aimbot. No stake, payout or crash point enters it. |
| `rider.ts` | The BMX and the man in black: wheels and crank on distance, legs pedalling on two-bone IK, the bar hand and the gun arm aimed at the reticle in screen space, lean, squat, nod and recoil springs, and the drawing. |
| `cops.ts` | The pursuit roster and its vehicles, choppers, drone and feds; the bust decided from the crash point and drawn from crash time; the thrown figure; the dogpile; the getaway swap. |
| `art.ts` | The sky and the time of day, the far skyline, the lots and their signs, the road, every camera kind live, reading and shot, the pigeon-drone, bullet holes, tracers, the reticle, the Kia, and text helpers. |
| `script.ts` | The chyron ladder and overtime lines, the Nextdoor feed, the toasts, the regret ladder, the causes, how they found him, the charges and the last word. |
| `scene.ts` | Phases, clocks and cues; the picture back to front; the getaway; the bust cards and the mugshot; the HUD. |
| `input.ts` | Pointer aim, click and tap to fire, the keys and the on-page buttons, wired from the game's own files. |
| `kinematics.ts`, `motion.ts` | The two-bone solver (Blanket Champ's) and the shared spring toolkit (Boiler Room's copy). |
| `*.test.mjs` | Headless tests for the course, the gun, the rig and the bust. Not part of the source pack or `npm test`. |
| `main.ts`, `audio.ts`, the start of `style.css` | Unmodified copies of the shared shell in `scripts/shell/`. |
| `replay.json` | Hello World's verified 9.07× round with this game's ID. |
| `clips.json` | Empty: the sound is the shared helper's procedural phonk and effects. |

## Validation

From the repository root, in this order:

```sh
npm run build
npm run typecheck
npm run check
npm test
node --test games/flock-off/*.test.mjs
```

The game's own tests check that every segment lays spaced cameras, that the aimbot deflocks most of the city and still gets read now and then, that a gun nobody fires is read by every camera for ten minutes with bounded memory, that the closed-form distance matches riding at 30, 60 and 144 Hz, that a late arrival finds nothing live at the kerb, that a shot inside a camera's radius kills it and a wide one leaves a hole, that the magazine reloads, that the hop is a bounded continuous function of distance, that the rig keeps its bone lengths with the feet on the pedals and the hand on the line to the reticle, that the springs agree across frame rates, that the thrown figure keeps its bones, and that the pursuit arrives, settles and resets.

Build output is `dist/flock-off/index.html`, `game.generated.js` and `style.css`, the three files Studio's **Your own renderer** takes. Published frames use only these files and the platform bridge.

## Credits and boundaries

All artwork is original Canvas 2D drawing; the sound is the repository's shared procedural helper, and `scripts/audio/prompts.json` holds an optional music request. No external images, fonts, recordings, scripts or API keys. Flock, Ring, Nextdoor and the rest are named as the butt of the joke, not as sponsors; nothing here is affiliated with them. The game is an open remix origin (`gallery.json`).

The game presents the shared round and sends the player's intents through the SDK; it never selects, predicts or influences the crash. Aiming, hits, reads, streaks and the pursuit are arcade play and presentation, and never change the round, a bet or a payout. Credits have no monetary value.
