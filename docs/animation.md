# Animation and rig reference

How the catalog games animate: the shared motion toolkit, the two-bone IK and gait helpers, the controller pattern every rig follows, seeded crashes with hit-stop, late entry, long rounds, portrait mode, custom audio, WebGL, and the tests that hold it all together. Read it with `README.md`, `docs/integration.md` and the selected game's source before changing a rig or adding one. Everything here is presentation: nothing in a rig reads, predicts or changes the committed crash point.

The games share these conventions by copying, not importing: a source pack holds only the game's own flat files (`CONTRIBUTING.md`, "Add a game"), so each game carries its own `motion.ts`, `kinematics.ts`, `endurance.ts` or `portrait.ts`. Copy the helper closest to your need from the game named below, keep its exports, and leave the shell files (`main.ts`, `audio.ts`, the CSS block) to `scripts/shell/`.

## Contents

1. [The frame contract](#1-the-frame-contract)
2. [The motion toolkit (`motion.ts`)](#2-the-motion-toolkit-motionts)
3. [Two-bone IK and gaits (`kinematics.ts`)](#3-two-bone-ik-and-gaits-kinematicsts)
4. [The controller pattern](#4-the-controller-pattern)
5. [Stateless acting rigs: pose as a function of time](#5-stateless-acting-rigs-pose-as-a-function-of-time)
6. [Physical rigs: chains, pendulums, volumes, mechanisms](#6-physical-rigs-chains-pendulums-volumes-mechanisms)
7. [Acting ensembles: skeletons, dialogue, crowds](#7-acting-ensembles-skeletons-dialogue-crowds)
8. [Skill games: input, autopilot, seeded courses, stash](#8-skill-games-input-autopilot-seeded-courses-stash)
9. [Lightweight games (browser remix budget)](#9-lightweight-games-browser-remix-budget)
10. [WebGL2 games (Seed Round, Moon Boys)](#10-webgl2-games-seed-round-moon-boys)
11. [Fluids, particles and mechanisms](#11-fluids-particles-and-mechanisms)
12. [Endless content: feeds, tickers, chats, captions](#12-endless-content-feeds-tickers-chats-captions)
13. [Portrait mode (`portrait.ts`)](#13-portrait-mode-portraitts)
14. [Sound cues](#14-sound-cues)
15. [Custom audio on the shared bus](#15-custom-audio-on-the-shared-bus)
16. [Testing a rig](#16-testing-a-rig)
17. [Reviewing motion in a browser](#17-reviewing-motion-in-a-browser)
18. [Checklist for a new or changed rig](#18-checklist-for-a-new-or-changed-rig)
19. [Where to look: an index by technique](#19-where-to-look-an-index-by-technique)

## 1. The frame contract

The shell (`scripts/shell/main.ts`) calls `createScene()` once and `scene.draw(ctx, view, now)` every animation frame on a 960 × 540 Canvas 2D context that it scales to the screen (`scripts/shell/main.ts:446`). `view` is the whole input a scene gets:

| Field | Meaning | Use it for |
| --- | --- | --- |
| `phase` | `waiting`, `betting`, `running`, `crashed` | the pose family and the cue edges |
| `currentX100` | the displayed multiplier in hundredths; the crash point once crashed | tension, growth, milestones, the readout |
| `elapsed` | ms since the round started running; held at the crash time afterwards (`main.ts:195`) | anything that must be a pure function of round time (acts, charts, gait distance on late entry) |
| `crashAge` | ms since the crash | the whole ending animation, so a replay or a late entry draws the same frame |
| `stake`, `cashoutX100`, `payout` | the player's bet; `cashoutX100` is non-null only after the backend confirms the exit | the exit choreography and the ending's flavour (`rekt` / `called` / `pop`) |

`now` is `performance.now()`. Scenes derive `dt` from it and clamp it: `const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1)` (`games/balloon-pump/scene.ts:388`). A long gap (a hidden tab) therefore steps at most 0.1 s, and the frame-rate-independent springs land on the same trajectory as many short frames would. The shell replaces the scene after a 1.5 s gap without a frame (`FRAME_GAP_MS`) and calls `dispose()` on the old one, so a scene that owns listeners, offscreen canvases, a WebGL context or an AudioNode returns `dispose()`.

Three rules follow from the contract and the tests enforce them:

- **Every pose is reachable from any first frame.** A scene may be created mid-round, after the crash, or after a cash-out. The first `draw` settles every spring to the pose the view calls for (`settleX`, below) instead of animating from rest; `view.elapsed` and `view.crashAge` are the only clocks allowed to reconstruct history.
- **Cues fire on edges you saw.** Keep `previous` phase and cash-out values; fire `audio.cashout()`, `audio.crash()`, `audio.fx()` and milestone stingers only when the edge happens while the scene is live. A crash met more than ~1.5 s late plays `audio.crash(kind, true)` (quiet) and settles the aftermath (`games/balloon-pump/scene.ts:436-447`, `games/hello-world/scene.ts:120`).
- **Animation stays bounded past 150 s.** Rounds have no duration limit; the default curve reaches 1,000,000× at 180 s. Loops must keep acting and keep memory flat (caps on bubbles, particles, course objects); `scripts/gallery/long-round-*.test.mjs` run the controllers for 180 s at 60 fps and assert it.

### Tension

Tension is a presentation parameter derived from the displayed multiplier only. Nearly every scene uses the hyperbola `tension = 1 - 1 / multiplier` (0.33 at 1.5×, 0.5 at 2×, 0.67 at 3×, 0.9 at 10×) because half of all rounds end before 2× and two in three before 3×, so a logarithm would barely move while most rounds live and die. The slower drivers for long rounds are `growth = log2(multiplier)` (used for sizes that keep growing) and `strain = smoothstep(3.3, 10, growth)` (10× to 1000×). Beyond the Colony and MUMU Bull Run use `clamp(log2(x) / 10)` instead, a slower ramp that suits their long staged encounters. `i-got-hacked/motion.ts:18` exports it as `tensionAt`. Pass the same tension to `audio.update(phase, tension)` so the music tightens with the picture.

## 2. The motion toolkit (`motion.ts`)

Thirty-four games carry a copy of the toolkit (Hello World, Rage Quit, Know Your Clown and Rug Piste do without: their rigs are closed-form functions of time); the 21 identical copies (`games/boiler-room/motion.ts` is one) are the canonical form. It is 74 lines and frame-rate independent throughout.

| Export | What it is |
| --- | --- |
| `clamp`, `mix`, `fract`, `smoothstep(e0, e1, x)` | the usual; `smoothstep` is the Hermite ramp used for every ease-in/out and window |
| `noise(n)` | hash noise in [0, 1): the same input always gives the same value, so `noise(i * 3.1)` scatters stars without an RNG |
| `gust(t, seed)` | three incommensurate sines in about [−1, 1]: slow, smooth wandering for wind, flicker, sway |
| `Spring { x, v }`, `spring(x0)` | position and velocity |
| `stepSpring(s, target, omega, zeta, dt)` | the closed-form damped oscillator: exact for any `dt`, never explodes |
| `settleSpring(s, target)` | jump to the target at rest (first frame, reset, late entry) |
| `mulberry32(seed)` | a 32-bit seeded generator, so a replayed crash scatters the same way |

### Springs are the whole secondary-motion system

`stepSpring` solves the oscillator analytically (`motion.ts:36-55`), so it is stable at any step size and can be called with `dt = 0` during a hit-stop. Parameters: `omega` is the undamped angular frequency in rad/s (how fast it reacts; 2π rad/s is one bounce per second), `zeta` the damping ratio (below 1 overshoots and rings, 1 settles without overshoot). Values the games actually use:

| Feel | omega | zeta | Example |
| --- | --- | --- | --- |
| Snappy follow (torso chasing a handle) | 20-26 | 0.7-0.9 | `pumper.ts:135` lean 22/0.7, knees 20/0.8 |
| Loose, nodding secondary (head, pom-pom) | 13-24 | 0.2-0.4 | `pumper.ts:136` nod 13/0.4, pom-pom 24/0.22 |
| Face blends (eyes, mouth, brow) | 10-26 | 0.75-0.9 | `pumper.ts:148-151` |
| Mode blends 0..1 (shades on, badge in, fallen) | 9-16 | 0.45-0.5 | `pumper.ts:140`, `scene.ts:532` pop 16/0.45 |
| Critically damped fades (idle breath, effort) | 4-8 | 1 | `pumper.ts:120` idle 6/1 |

Idioms that recur in every rig:

- **A spring per blend, targets from the drive.** Each 0..1 state (`fall`, `shades`, `idle`, `badge`) is a spring whose target is a boolean from the drive; the overshoot past 1 is free squash (`pumper.ts:218-219`: `fall = clamp(rig.fall.x, 0, 1)`, `squash = clamp(rig.fall.x - 1, 0, 0.25)`).
- **Different omegas for different body parts** give the lag chain for free: the lean, nod and knees springs all chase the same stroke compression `c` at 22, 13 and 20 rad/s, so the head trails the torso (`pumper.ts:134-137`).
- **Exponential smoothing** for a scalar you do not want to ring: `effort += (target - effort) * (1 - Math.exp(-3 * dt))` (`balloon-pump/scene.ts:479`).
- **A tethered spring**: step x and y springs toward a rest point, then if the distance from the anchor exceeds the tether, project back onto the circle and kill the outward velocity (`pumper.ts:157-172`, the pom-pom). This is the cheapest rope.
- **`settleSpring` on the first frame, on `view.phase` changes you missed, and on `reset`**; never let a spring animate in from zero when the view already calls for a pose.

### Determinism

- `mulberry32(seed)` seeds every crash: `mulberry32(crashX100)` (`bull-run/bull.ts:43`, `pyramid-scheme/pyramid.ts:131`, `hopium-drip/ward.ts:203`), or a salted form so two generators in one game do not correlate: `crashX100 * 7919 + 17` (`seed-round/crash.ts:51`), `crashX100 * 7 + 1` (`family-meeting/kitchen.ts:209`). Ambient generators use fixed seeds (`0x5eed`, `0xfeed`, `0xcafe`) and reset them in `resetX` so every round's crowd is the same.
- Deterministic per-second scatter without state: `mulberry32(Math.floor(time * 60) + 11)` (`family-meeting/kitchen.ts:406`) gives a fresh but reproducible pattern each tick.
- Phase accumulators, not `sin(t * rate)`: when a rate changes, integrate it (`rig.phase += drive.rate * dt`, `pumper.ts:118`) or use a closed form of the integral (`hello-world/scene.ts:67`, `bobAngle`), otherwise the whole history jumps when the rate does.

### Variants worth knowing

- `balloon-pump/motion.ts` adds `STROKE`, `strokeCompression(phase)` (a weighted push, a squeeze at the bottom, a lighter lift, a regrip) and `airPacket(phase)`: a reusable asymmetric cycle for any pumping, rowing or hammering motion.
- `bonding-curl/motion.ts:69` adds `footAt(cycle, stride, lift)`: a distance-driven foot (stance slides back exactly as far as the body moves on; swing lifts on a sine).
- `i-got-hacked/motion.ts:18` adds `tensionAt`.
- `beyond-the-colony/motion.ts` is a different toolkit: `TAU`, `smooth`, `between(a, b, n)`, `windowAt(n, a, b, edge)`, `recoil(age, strength)` (`sin(age*18) * exp(-age*4.5)`: an overshoot that rings down as a pure function of age, no accumulated error), `limb()` two-bone IK, `turn(from, to)` shortest signed angle, and `actAt(seconds)` with a 24-line script.

## 3. Two-bone IK and gaits (`kinematics.ts`)

Eight games carry `kinematics.ts` (Alignment Check, Blanket Champ, Family Meeting, Gas Fees, Hopium Drip, I Got Hacked, OnlyFrens, Thanksgiving Uncle); others inline the same solver under another name (`bendJoint` in `balloon-pump/pumper.ts:12`, `limb` in `beyond-the-colony/motion.ts:16`, `solveArm` in `rug-piste/yeti-rig.ts`, `mechanicalElbow` in `know-your-clown/ministry.ts`, `sleeveElbow` in `onlyfrens/stream.ts`, `heroLimb` in 3D in `moon-boys/rocket.ts`). The solver is the law-of-cosines closed form; there is no iterative IK anywhere in the catalog.

```ts
// games/blanket-champ/kinematics.ts:3 (identical in gas-fees, onlyfrens, thanksgiving-uncle)
export function solveLimb(root: Joint, target: Joint, upper: number, lower: number, pole: number): { joint: Joint; end: Joint } {
  const dx = target.x - root.x, dy = target.y - root.y;
  const distance = Math.max(.0001, Math.hypot(dx, dy));
  const reach = Math.max(Math.abs(upper - lower) + .001, Math.min(upper + lower - .001, distance));
  const ux = dx / distance, uy = dy / distance;
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * (pole < 0 ? -1 : 1);
  return { joint: { x: root.x + ux * along - uy * bend, y: root.y + uy * along + ux * bend }, end: { x: root.x + ux * reach, y: root.y + uy * reach } };
}
```

What it guarantees, and what the tests check (`scripts/gallery/kinematics-acting.test.mjs:20`, `games/andys-loud-garden/andy.test.mjs`, `games/rug-piste/yeti-rig.test.mjs`):

- Both bone lengths are exact for every target, including a coincident one (`distance` floored at 0.0001) and an unreachable one (`reach` clamped inside `[|upper − lower|, upper + lower]`, so the chain straightens but never stretches). The returned `end` is the clamped endpoint: draw the hand or foot at `end`, not at `target`, or the hand floats off the forearm.
- `pole` picks the bend side (the sign of the cross product of root→end and root→joint). Keep it fixed per limb per character: elbows out, knees forward. A pole that flips frame to frame is the classic IK pop, and the tests assert the elbow moves less than a few pixels per frame.
- The Family Meeting and Hopium Drip variant (`family-meeting/kinematics.ts:13`) takes a continuous `pole` in [−1, 1]: scaling `bend` by it swings the joint through depth, so a limb crossing the body foreshortens instead of flipping.

Targets come from the world, not from angles: a hand on a handle (`pumper.ts:222`, the handle's y), a foot on the ground, a paw through a jar neck (`honeypot/picnic.ts`, `visual-worlds.test.mjs:15` asserts the whole arm stays inside the opening). Where a hand must stay within reach of a fixed shoulder without IK, project the target onto the reach disc first (`pumper.ts:229-235`, `constrain`).

### Distance-driven gaits

A walking foot is a function of **distance travelled**, never of time, so a character that stops mid-stride holds the pose and a late entry reconstructs the stride from `view.elapsed`:

```ts
// games/blanket-champ/kinematics.ts:13
/** During stance x cancels root travel exactly; swing returns the foot with zero endpoint velocity. */
export function stepFoot(distance: number, stride: number, offset: number, lift: number): Joint {
  const phase = ((distance / stride + offset) % 1 + 1) % 1;
  const half = stride * .58 / 2;
  if (phase < .58) return { x: half - phase * stride, y: 0 };              // stance: slides back at the body's speed
  const u = (phase - .58) / .42;
  return { x: -half - u * stride * .42 + stride * u * u * (3 - 2 * u), y: -lift * Math.sin(Math.PI * u) ** 2 };  // swing
}
```

The foot's x is relative to the hip. Add the hip's world x and the stance foot stays planted in world space (the tests differentiate `d + stepFoot(d).x` and assert it is constant through stance and has zero velocity at the swing ends). Offsets of 0 and 0.5 give the two feet; 0.58 is the stance fraction (feet spend more time down than up).

Starting from standing needs care: `stepFoot(0)` puts one foot mid-stride. Three answers exist:

- `walkingFoot` (`alignment-check/kinematics.ts:22`): scale the whole foot offset by `smoothstep(0, 26 px)` of distance, so the first step grows out of the standing pose.
- `walkingFoot` (`family-meeting/kinematics.ts:29`): offset the gait by 0.29 so one foot starts planted under the hip at mid-stance, and blend x over 4 px and y over 10 px.
- `walkingFoot` (`hopium-drip/kinematics.ts:28`): keep each foot where it stood until its first swing and shed the gait's offset only while it is in the air, so neither sole skates. Wife Changing Money solves the same problem for a seated character who stands up: `traderFoot(age, side)` unfolds into the first cycle at exactly the contact it stood on, and `kinematics-acting.test.mjs:216` asserts the planted soles do not move at the handover.

Two other gait designs are in the catalog:

- **Planted footsteps as state** (`king-of-the-hill/gait.ts`): each foot is `{ x, fromX, toX, phase, duration, lift }`. The trailing foot starts a swing only when the hip has moved more than 18 px past it; the swing's duration shrinks with pace, and `plant()` re-plants both feet when the hip jumps more than 70 px (a late entry) so legs never stretch. Feet are world positions, so the hill slope is read per foot with `heightAt(x)`. This is the design for a walker on uneven ground or one that reverses.
- **`footAt(cycle, stride, lift)`** (`bonding-curl/motion.ts:69`): the simplest, with a symmetric 50/50 stance and a smoothstep swing.

Body bob and lean are derived from the same phase: `Math.sin(phase * 2π)` on the hip height for a two-beat bob, lean from the signed speed, and a squash on each contact (the Trenches squad). The `visual-physical.test.mjs:78` test counts contacts to assert a readable cadence.

## 4. The controller pattern

Every rig and prop module follows one shape, and the cross-game tests depend on it (they drive the modules headlessly for 180 s at 30, 60 and 120 Hz):

```ts
export interface XDrive { running: boolean; tension: number; multiplier?: number; seconds?: number; /* what the scene wants */ }
export interface XRig { time: number; /* springs, phases, counters */ events: { push: boolean; bottom: boolean } }
export function createX(): XRig                               // springs at rest, generators seeded
export function settleX(rig: XRig, drive: XDrive, age?: number): void   // jump to the pose the drive calls for (first frame, late entry)
export function stepX(rig: XRig, drive: XDrive, dt: number): void       // advance by real seconds; set rig.events edges
export function resetX(rig: XRig): void                        // a new betting phase: reseed, clear the crash
export function computePose / xPose(rig, drive): Pose          // pure: springs → joints (IK solved here)
export function drawX(ctx, rig, drive): void                   // reads the pose; no state changes
```

- **Drive objects** are plain data the scene builds each frame from the view (`PumperDrive`, `BalloonDrive`, `SniperDrive` in Balloon Pump). The rig never sees `SceneView`, so it can be tested without a shell.
- **Events** are booleans the step sets for one frame (`rig.events.push`, `.bottom`, `.bump`, `.jeet`, `.bailed`); the scene turns them into `audio.fx()` calls and cues (`balloon-pump/scene.ts:514-522`). A module that needs several in one frame uses `events.line` or an array.
- **`settleX` takes the age** when the pose depends on how long ago something happened (`settlePumper(rig, drive, view.crashAge / 1000)`, `pumper.ts:97`).
- **Pose is pure.** `computePose(rig)` / `pumperPose(rig, drive)` turns spring values into joints and a `toWorld(lx, ly)` closure for parts drawn in a local frame (`pumper.ts:206-247`); the IK is solved there, the drawing only strokes segments. Tests call the pose function directly and assert bone lengths, planted feet and continuity.
- **Caps everywhere**: particle arrays, bubble lists and course objects are trimmed in `step` (`state.bubbles.length <= 8`, `obstacles.length < 100`, `messages.length <= 18`), because long rounds are unbounded.

### The scene skeleton

`scene.ts` owns the clocks, the phase edges, the cues and the draw order. The reference shape (`games/balloon-pump/scene.ts:387-480`) is:

1. `real = clamp((now - last) / 1000, 0, 0.1)`; `dt = real`, or `0` during a hit-stop freeze, or `real * SLOW_RATE` during slow motion. Shake and camera punch run on `real` so the camera still rattles through the freeze (`scene.ts:340`, `shakeClock`).
2. Derive `multiplier`, `growth`, `tension`, `fear`, `strain`, `running`, `crashed`, the endurance act.
3. Confirm the exit once: `if (view.cashoutX100 !== null && !secured) { secured = {...}; if (running && previous !== null) audio.cashout(); }`.
4. Phase edges: `if (previous === null)` settle everything and, if already crashed, play the quiet burst; `else if (view.phase !== previous)` play the live crash (settling instead when `view.crashAge > 1500`), and on `betting` call every `resetX`, clear the outcome and the clocks.
5. `time += dt; audio.update(view.phase, tension);` build the drives; `settleX` if settling, `stepX` otherwise; convert `events` into `audio.fx`.
6. Milestones: count the rungs passed (`RUNGS.filter(r => multiplier >= r).length`) and fire `audio.milestone(n)` only when the count rises and the frame is not a settle (`scene.ts:524`).
7. Draw back to front; HUD and captions last; `ctx.save()/restore()` around any camera transform.

Hello World (`games/hello-world/scene.ts`) is the same skeleton with no module split and shows the closed-form alternative to springs: `circleBob` carries position and velocity into a damped landing as a pure function of `elapsed` and `crashAge` (`scene.ts:71-86`), which `kinematics-detail.test.mjs:26` checks for a velocity jump at impact.

### Hit-stop and slow motion

The crash feel comes from warping the scene clock, never the shell's:

```ts
// games/balloon-pump/scene.ts:51-54, 387-396
const FREEZE_S = 0.15, SLOW_S = 0.4, SLOW_RATE = 0.3;
let dt = real;
if (freeze > 0) { freeze -= real; dt = 0; }            // a freeze you can feel
else if (slow > 0) { slow -= real; dt = real * SLOW_RATE; }  // the shreds fly at a third speed
```

`burst()` sets `freeze`, `slow`, a shake of 1, `settleSpring(punch, 1)` for a camera punch-in that holds `PUNCH_HOLD_S` then eases out, and `pop.v = 16` to kick the readout's spring. The burst's own frame is the first frame of the freeze (`scene.ts:466-469`). Because the springs are closed-form, `dt = 0` is a no-op rather than a division by zero. Debris (`Shred`, `Puff` in `balloon.ts`) is integrated with the warped `dt`, so it slows too; the seeded RNG decides its directions once, in `burstBalloon(balloon, crashX100)`.

A crash met late (`view.crashAge > 1500` on the edge, or crashed on the first frame) skips all of this: the aftermath settles into its final pose from `crashAge` and the audio plays the quiet crash (tape stop, no stinger).

## 5. Stateless acting rigs: pose as a function of time

Rage Quit, Beyond the Colony, MUMU Bull Run and Know Your Clown take the opposite approach to springs: nothing is integrated, every pose is `f(elapsed, crashAge, now)`. Late entry, seek and replay then reconstruct for free, and the pose is trivially testable (`rug-piste/yeti-rig.test.mjs` asserts idempotence). Yes Men and Rug Piste mix the two. Use this style when the character performs a scripted routine rather than reacting to physics.

- **A pose is a bag of world-space targets**, not angles: `ActorPose` (`rage-quit/acting.ts:84-105`) holds hip, shoulder, head, hands, feet and scalars (mouth, eye, exit, collapsed); `rigFor(pose)` (`know-your-clown/character.ts:360-453`) returns hip, chest, head, shoulders, wrists, feet. The draw function solves the limbs from those targets.
- **Layered lerps for blending**: a base pose from the stroke, then per-act targets `blend(a, b, act.weight)`, then the cash-out blend, then the crash blend; last writer wins (`rage-quit/acting.ts:114-233`). Know Your Clown snapshots the previously drawn rig on a mode change and lerps from it for 0.35 s (`character.ts:456-480`, `scene.ts:160-166`) so an appointment change never pops.
- **Envelopes instead of state machines**: `windowAt(age, a, b, edge)` and `between(a, b, n)` (`beyond-the-colony/motion.ts:6-7`) turn an act's age into 0..1 weights; an encounter is `enter = between(0, .9, age) * (1 - between(5.5, 7, age))` (`actors.ts:38`) sliding in from x = 1030 and out again.
- **Impacts without springs**: `recoil(age) = sin(age * 18) * exp(-age * 4.5)` (`beyond-the-colony/motion.ts:10`), or the phase-wrapped ring `after = ((beats - .55) % .5 + .5) % .5; impact = exp(-after * 18) * cos(after * 29)` (`rage-quit/acting.ts:57-62`) that one `impact` scalar fans out to the desk, chair, plant, fan, keyboard and camera. Nothing accumulates, so a long round cannot drift.
- **Follow-through from two samples**: evaluate the pose at `t` and `t - 0.07`, and derive head lag and scarf stream from the difference (`beyond-the-colony/choreography.ts:6-15`). No velocity is stored.
- **Alternating strokes**: `fistLift(t)` is a piecewise wind-up, fast contact, recoil and hold; the second fist is `fistLift(beats + 0.5)` (`rage-quit/acting.ts:41-64`); torso follow-through is `shoulder.x += 26 * (1 - stroke)`.
- **A gallop** (`mumu-bull-run/motion.ts:51-74, 95-114`): `cycle = s * 2.1 + .1 * sin(s * .7)`; body height from a suspension cosine, pitch from a sine, head lagging the cycle; hooves are targets in the ground frame (stance slides back linearly, swing returns on a cosine with a sine lift scaled by effort) while hips ride the pitching body, which keeps feet planted under a bouncing torso. Fore knees bend forward and hind hocks back by the sign of the hip x (`rig.ts:28`).
- **A waddle, a leap and a belly slide** (`beyond-the-colony/penguin.ts:14-21, 44-50`, `choreography.ts:42-69`): the pelvis transform is `translate → rotate(angle + waddle) → scale(squash, 1/squash)` so every joint inherits it; the leap closure adds `-sin(πu) * height` and `forward * smooth(u)`; the slide drops the pivot and raises `angle` to 1.5 rad; foot phase and ground scroll share one `route` distance so feet never skate.
- **Pole tricks**: a hand-height-dependent pole `backPole = 1 - 2 * clamp((root.y - target.y - 10) / 70)` lets the far elbow hang when the hand is low and swing over the shoulder as it rises (`rage-quit/actor.ts:23`); `outward(root, end, out, down)` (`know-your-clown/character.ts:95-99`) derives a continuous pole from the limb direction so elbows and knees never fold through the body; a hip `settle` lowers the pelvis when a leg would overreach (`character.ts:393-396`).

Timelines in these games are time-driven: 6 s acts with a 48 s caption cycle (`rage-quit/acting.ts:49-67`), 7 s acts on a 24-line script (`beyond-the-colony/motion.ts:63-67`), 6.8 s beats with a contact at 2.55 s (`mumu-bull-run/motion.ts:38-49`), checks at fixed seconds then audits every 12 s forever (`know-your-clown/direction.ts:57-74`). Act transitions and contact beats fire audio by comparing the act at the previous frame's `elapsed` with the current one, never by counting frames; Know Your Clown keys each cue by `${serial}:${cycle}:${quarter}` so a seek never replays one (`direction.ts:108-116`).

Yes Men is the counter-example worth reading for a **multiplier-keyed script**: `LINES[{ at, who, text, ... }]` consumed with `while (multiplier >= LINES[next].at)` (`court.ts:24-86, 342-348`), a 6 s ambient cycle afterwards, and ministers whose nod and clap are integrated phases `nod += dt * 2π * (.4 + 2.2 * zeal)` so a change of zeal never pops (`cast.ts:469-470`); zeal thresholds (clap > 0.2, stand > 0.5, kneel > 0.8, tears > 0.68) stage the escalation (`cast.ts:466-479`).

## 6. Physical rigs: chains, pendulums, volumes, mechanisms

These games keep real state and integrate it. Each solves one physical idea well; copy the idea, not the file.

- **Hands pinned, body on springs** (Balloon Pump, `pumper.ts`): the hands sit on the handle at `handleY = handleTop + c * travel` where `c = strokeCompression(phase)`; lean, nod and knees springs chase `c` at different rates (22/0.7, 13/0.4, 20/0.8) and the arms are solved from the resulting shoulder to the pinned hands. Side −1 for legs, +1 for arms, fixed. The stroke's rate is `0.85 + 1.25 * tension` strokes per second (`scene.ts:494`). The same file shows a face as springs toward a `FACES[mood]` table (`pumper.ts:78-86, 141-151`) with blinks scheduled by `noise`.
- **A buoyant body on a tether** (`balloon-pump/balloon.ts:132-148`): radius spring (7/0.95), a `puff` impulse per gulp of air, `jiggle` squash-and-stretch (13/0.16), `rise` from limp to floating (3.2/0.7), and a sway whose frequency falls as the balloon grows, `omega = clamp(4 * sqrt(40 / r), 1.6, 6)` with `zeta = mix(.75, .13, rise)`. The hose is a cubic Bézier with a Gaussian bulge at `airPacket(phase)` (`scene.ts:63-70, 234-252`).
- **A slingshot that winds up** (`balloon-pump/sniper.ts:118-141`): rise, draw and aim springs, the aim steered through the shortest angle with `atan2(sin, cos)`, and `within()` (`:162-168`) keeps a hand inside shoulder reach by ray/circle intersection.
- **Inter-storey spring chain** (`tower-tension/tower.ts:237-246`): each storey is a shear spring `F_i = k_i (x_i − x_{i−1}) + c_i (v_i − v_{i−1})`, integrated with fixed substeps `h = 1/240`; `k` softens with tension, stiffens with the floors carried, and the base is 1.5× stiffer (`:230-231, 258`). The wind push is normalised by the chain's compliance and the sway phase runs at 0.7 of the first mode's Rayleigh estimate (`:260-267`), so a 99-floor tower sways like a tower rather than a whip. The collapse tips a rigid rod (`ω' += 1.5 g / h · sin θ`, `:410`) and releases floors top-down at staggered times.
- **A steered pendulum** (`tower-tension/crane.ts:157-185`): the hook is `θ'' = −(g/L) sin θ − (0.25 accel / L) cos θ − 2.4 θ' + (wind · 0.15 + steer · cos θ) / L`, substepped at 1/240 and clamped to ±0.35 rad; `steer` is a PD controller toward the swaying tower top whose gain fades in with `smoothstep(.7, .9, u)` as the load arrives, so the crane visibly aims. Release records the load's offset and velocity relative to the top. A counterweight spring (5/0.06) is kicked by `−accel · 0.0025`.
- **A bar that bends, a spotter whose elbow faces the camera** (`pump-and-dump/bench.ts`): `barAt = barY + bend.x * 4 (t − .5)² + tremor + tilt` with the bend spring (28/0.22) chasing a sag per plate pair (`:134-137, 376-384`); the spotter's elbow is a mix of the two mirror IK solutions weighted by an `elbows[i]` spring, so both bones foreshorten as the elbow points at the camera instead of flipping (`:576-590`), and the side flips with ±0.1 hysteresis (`:566-570`). The spotter bends exactly as far as reach requires: `drop = (hand.y − shoulder.y − sqrt(span² − dx²)) / reach` (`:535-541`). Plates fall at 900 px/s², bounce at `−0.35`, and settle flat or on the rim by a rest-angle spring (`:312-342`).
- **A muscle as a pressure volume** (`bonding-curl/curler.ts`): radius `16 + 94 (1 − e^{−g/2.6})` (`:120`), a throb phase integrated at `dt / mix(1.4, .35, tension)` (`:234, 340`), an ellipse whose centre moves with its radius (`:192-195`), and a forearm that stops where it meets the bicep: `pressAt` measures the fist's depth into the ellipse and `curlAtPress` scans 50 samples for the first crossing (`:198-225`), so the pose is collision-limited rather than keyframed. `visual-physical.test.mjs:33` asserts the muscle never covers the jaw at full growth plus spring overshoot.
- **A stride on ice** (`thin-ice/skater.ts:169-178, 303-324`): `legPose(u)` is glide (45%), push (20%) and swing with lift (35%); `stride += speed · dt / strideLength(speed)`; the hip bobs with `|sin 2π·stride|` and is lowered so neither leg exceeds its reach; `standStride` finishes a swing forward-only into a two-blade stance (`:200-204`). The scarf is a chain of eased points `k = 1 − exp(−dt (22 − 2i))` (`:334-345`). Cracks are seeded random walks that branch (`ice.ts:113-133`), and `journeyDistance` is the integral of the speed curve so a late entry reconstructs how far the skater got and which cracks exist (`ice.ts:100-110`).
- **A squad with squash on each step** (`the-trenches/squad.ts`): cadence is time-driven but the field scrolls to match, `scroll += dt · over · cadence · STRIDE` (`:354`), and each foot's stance reach is set so the planted foot keeps pace with the mud lines; each plant kicks `squash.v += 3 + 5 · tension` on an 18/0.35 spring and the body draws `scale(sq, 1/sq)` (`:372-377, 540-565`). Arm elbows flip side at full reach so the flip never shows (`swingArm`, `:513-527`). A crash launches each frog from its last drawn pose with `launch`/`flight`/`anchor` (`:219-279`): snapshot the pose, then fly ballistically to a rest.
- **A walker on a curve** (`king-of-the-hill/ape.ts:145-177`, `gait.ts`): the hill is `heightAt(x)` with `slopeAt` its derivative; the base point sits `(r + 44 + slip) · cos(slope)` behind the coin's contact; feet are world positions from `stepGait` (see Two-bone IK and gaits), lifted along the local normal; the pelvis is pulled in over four passes until both legs reach (`:170-174`); the coin rolls by `Δx / cos(slope) / r`. The crash tests first contact with a segment/circle `apeGap` (`:204-211`) before the pancake.
- **A can that a hand actually holds** (`andys-loud-garden/andy.ts`): the back hand is placed relative to the front hand rotated by the can's tilt (`:254-257`), feet are planted in world space with the pelvis yielding per foot (`:232-236`), and the water is an analytic parabola with a solved flight time (`:844-887`). `andy.test.mjs` is the model for testing a rig of this kind (see Testing a rig).

## 7. Acting ensembles: skeletons, dialogue, crowds

The eight `kinematics.ts` games (and Yes Men) are ensemble scenes: several characters, a dialogue system, acts, and a crash that breaks the set. Their conventions:

- **One full skeleton** exists in the catalog, Alignment Check's `rigs.ts:33-34`: a `Skeleton` of pelvis, chest, neck, head, shoulders, elbows, hands, hips, knees and feet; a `Pose` of pelvis offset, three chained angles, hand targets that are shoulder-local or world, feet local to a feet origin, and a `knee` hint. `torsoOf` (`:690`) is forward kinematics, `solve` (`:720`) runs IK for arms and legs, and `limb` (`:714`) picks the pole as the sign of the cross product between the limb direction and an authored hint. `mixPose` (`:708`) converts hands to world space before blending, and grips and stances crossfade per rung over 0.4 s (`GRIP_BY_RUNG`, `STANCE_BY_RUNG`). Use this when a character has to hold many authored poses; per-limb IK (below) is enough for most games.
- **Per-limb IK with pole tricks**: a pole that swings through depth as a hand rises, `1 − 2 · smoothstep(.55, .95, clutch)` (`family-meeting/family.ts:455`), or crossfades through 0 as a seated patient stands (`hopium-drip/ward.ts:866`); an elbow hint as a point whose cross product picks the side (`thanksgiving-uncle/folks.ts:216-218`); an angular blend of two solved poses by shoulder and forearm headings so a hand dropping past the shoulder never flips the elbow (`folks.ts:229-236`, `swing`); a polar hand target so a raised arm swings out rather than through the shoulder (`i-got-hacked/party.ts:248`, `armTarget`); a free hand placed at `solveLimb(...).end` so it is always reachable (`i-got-hacked/mansion.ts:435`); seated legs with lengths mixed from 19 to 56 so they foreshorten while sitting (`family-meeting/family.ts:941-955`).
- **Walkers**: `walkingFoot` for a daughter leaving the table (`family.ts:944`, stride 170), a wife whose stride divides the span so she stops in double support (`ward.ts:46, 566`), a boyfriend and a simp (`onlyfrens/stream.ts:321-327`, `chat.ts:304`), fans (`party.ts:590`); `plantedStep` rounds the span to whole strides and fades the lift at both ends (`mansion.ts:223`); `walkTo` is an acceleration-limited mover with a braking curve `min(top, sqrt(2 · accel · gap))` (`ward.ts:233-239`; the same curve in `blanket-champ/crowd.ts:138-142`).
- **Crowds in depth**: riders are drawn feet-at-origin with `depthScale = mix(1, .74, depth)` and a depth floor, sorted by depth each frame (`gas-fees/riders.ts:36-37`); a per-seed sway and breath keep forty bodies from moving in unison (`:516-520`). Blanket Champ's bleachers bob on an integrated `c.bob += dt * (4 + 6 * cheer)` and run a wave every 9 s from 3×.
- **Dialogue and bubbles**: a ladder of lines keyed to rungs with a delayed `pending`, one bubble per speaker and at most two live (`alignment-check/lines.ts:215-232`), a placement search over obstacle boxes with cost `|dx| + 1.2 · dy` fixed on first draw (`gas-fees/riders.ts:884-892`), a caption queue with a `seen` set and a 1.1 s beat (`family-meeting/scene.ts:156-160`), a scrolling message stack (`onlyfrens/chat.ts:95`, `post`). Long rounds keep talking: `long-round-content.test.mjs:31` requires at least six distinct lines in the third minute and at most eight live bubbles.
- **Beat metronomes**: a phase integrated at a tempo from the multiplier, `tempoAt(g) = .8 + 2.2 (1 − e^{−g/2})`, emitting one event per beat that kicks the headboard, the lamp and the glass (`blanket-champ/room.ts:39, 194`); the glass walks off the nightstand because its target advances per beat. `settleRoom` reconstructs the glass from `elapsed · tempo` on late entry (`room.ts:249`).
- **Burst schedulers without state**: `fract(doorPhase) / (.3 + .25 · deep)` gives a damped burst per cycle (`onlyfrens/stream.ts:186-190`); hearts and petals spawn on integer ticks of `time * 6` (`hopium-drip/ward.ts:321-326`); `kinematics-acting.test.mjs:77` asserts OnlyFrens' hearts follow an 8 Hz clock rather than the frame count.
- **Acts** (`acts.ts`, identical structure in the group): `STARTS = [0, 32, 52, 75, 100, 125, 145]` seconds, then from 170 s a stage `1 + (cycle % 6)` every 24 s, with `effort = min(1, .3 + .03 · stage + (1 − release) · .52)` (`alignment-check/acts.ts:8-21`). Props crossfade over 0.5 s with `actBlend`/`actFade` and acts carry `prev`/`fresh` so each prop eases in and out (`i-got-hacked/acts.ts:33-56`); Andy's Loud Garden drops the hero to `idle` during the 5 s effort dip (`andys-loud-garden/scene.ts:163`).
- **The crash breaks the set**: `burstHead` throws 16 chunks, 6 tufts, 5 teeth and the glasses, deciding each piece's landing surface on arrival (`family-meeting/kitchen.ts:250-305`); `breakWall` launches drywall, splinters and glass and picks the landing floor at throw time (`thanksgiving-uncle/room.ts:301-325`); a cross on a 14/0.3 spring falls with the nearest lie-angle wrap (`kitchen.ts:360-368`). A late entry settles the debris by running the physics 360 times at 1/60 s (`kitchen.ts:475`, `room.ts:293`), which is cheaper than a closed form and exactly what a live viewer saw.
- **Round transitions**: a snapshot of the last crash frame dissolves over the next betting phase (`gas-fees/scene.ts:206-210, 368-375`; `i-got-hacked/scene.ts:189-194`), or a dark `wipe` (`family-meeting/scene.ts:255, 375`), or springs that ease back instead of jumping (`blanket-champ/room.ts:114`, `resetRoom(soft)`).
- **Cue hygiene**: `fx()` dedupes the same effect within 0.04 s and queues at most 24 cues (`alignment-check/scene.ts:101-109`); thuds are throttled (`family-meeting/scene.ts`, 0.09 s); `muted` after a quiet crash silences the aftermath; `live = previous !== null && delta < .3` gates cues after a gap (`andys-loud-garden/scene.ts:101-103`).

## 8. Skill games: input, autopilot, seeded courses, stash

Rug Rails, Up Only and Rug Piste are the `interactive: true` games. Their controls are wired from the game's own files (`input.ts`), never from `main.ts`, and the backend crash still ends the round: collisions are presentation (a stumble, spilled coins, a slower pace) and never a loss of the bet.

- **`createInput(canvas, onFirst)`** (`rug-rails/input.ts:27-101`) attaches keyboard (arrows and WASD; `ownsKey` ignores INPUT/TEXTAREA/SELECT and leaves Space to the shell's cash-out), pointer down/move/up with `setPointerCapture` in a try/catch, swipe (≥ 24 px) and tap (< 320 ms); commands are edge-triggered booleans that `take()` returns and clears; `dispose()` removes every listener and the scene's `dispose()` calls it. Rug Piste adds held-key continuous steering, a pointer drag target and on-page buttons with `mousedown.preventDefault` so focus stays off them and Space still cashes out (`rug-piste/input.ts:45-74`); it clears everything on blur and visibilitychange.
- **The copy-trading bot** steers until the player does: `playerSteers` is module-level so a recreated scene stays manual (`rug-rails/scene.ts:88, 108`), and each frame `cmd = playerSteers ? input.take() : autopilot(world, dt)` (`scene.ts:372`). The autopilot reads the course every 0.1 s with a seeded reaction delay, occasionally "looks at its phone", and uses its own RNG (`mulberry32(seed ^ 0x5bd1e995)`, `course.ts:215`) so polling never reshapes the course (`course.ts:682-732`; Up Only `sky.ts:448-470`; Rug Piste `course.ts:87-110`).
- **Seeded course**: `seedFor = replay ? 1 : (Date.now() ^ Math.imul(rounds + 1, 2654435761)) >>> 0` (`rug-rails/scene.ts:97`); `resetWorld` reseeds and lays obstacles ahead; difficulty forecasts the public curve from the current pace (`course.ts:295-301`) and `block()` always leaves a lane open within one swerve (`course.ts:274-286`). Up Only's candle gaps narrow with tension (`sky.ts:227-252`). Rug Piste hashes `noise(row * 8 + k, seed)` per row instead of a stateful RNG (`course.ts:29-33, 62-85`), which is why its tests can assert determinism from the seed alone.
- **Late entry for a stepped world**: a module-level `live` record (`world`, `elapsed`, wall time) is restored if the new scene's `view.elapsed` kept pace with the wall clock; otherwise `resetWorld` plus `settleRunning(world, multiplier, seconds)` reconstructs distance and stride from `elapsed` (`rug-rails/scene.ts:312-325`, `course.ts:229-234`; Rug Piste's `slopeDistance(seconds)` is a closed form, `course.ts:42-46`).
- **Substeps**: the world steps at ≤ 1/120 s with commands applied on the first substep (`rug-rails/course.ts:182, 516-520`); the jump uses the exact `h += v·dt − ½g·dt²`; Up Only's flap integrates `y += (v0 + v1) / 2 · dt` so a flap is 67 px at any frame rate (`sky.ts:370-373`); jump and slide buffers (0.15 s) and coyote time (0.1 s) live in the world, not the input.
- **Stash** (`rug-rails/stash.ts`, `up-only/stash.ts`): `{ coins, best, banked }` under one localStorage key, loaded and saved in try/catch with sanitised numbers, ranks and cosmetic drip derived from totals; banked only on a confirmed cash-out and never in replay (`scene.ts:99, 226-235`).
- **Cash-out exits** inherit motion: the hoverboard spring lifts the runner off the rails and pickups stop (`rug-rails/scene.ts:546-548`); the jet slides under the bird and hovers it on a closed-form damped fall (`up-only/sky.ts:364-368`); the ski lift's `liftPose(seconds)` boards the skier at arrival (`rug-piste/lift-rig.ts:5-18`).
- **The crash** rolls the rails up with `rugZ = mix(FAR, RUNNER_Z - .45, smoothstep(0, .75, crashAge))` and knocks the runner down when the roll reaches him (`rug-rails/scene.ts:479-492`); Up Only's rug edge does the same along x, candles falling as it passes, and a fall that carries the current velocity into `fallY + fallV·age + ½g·age²` (`scene.ts:441-459`); Rug Piste keeps a crashed `ending` view through the next betting phase for 5.25 s and drives the yeti from `crashAge` alone (`scene.ts:125-129`, `yeti-rig.ts:64-112`).

Perspective lanes: `project(x, z, h, cam)` with `s = FOCAL / z`, `X = W/2 + (x - cam.x) * s`, `Y = HORIZON + (CAM_H - h) * s` (`rug-rails/track.ts:30-33`); `drawWorld` sorts by z, draws what is behind the runner, calls back for the runner, then what is ahead (`track.ts:623-657`); `onPlane()` fits lettering to a projected wall (`track.ts:95-100`).

## 9. Lightweight games (browser remix budget)

Wen Moon, Bull Run and Pyramid Scheme draw straight from the multiplier with a few springs and a short `scene.ts`, so they fit the browser Studio's 120,000-token budget (`npm run check` prints each game's bound). Their tricks are the cheapest versions of the catalog's patterns:

- **Altitude from the multiplier**: `alt = log2(m) * 520` px per doubling, a camera that lifts the rocket to a hover height then scrolls the world (`wen-moon/scene.ts:37-40, 78`); the booster drops at the second rung and jeets bail from the third (`:105-115`).
- **A bucking cycle on an integrated phase**: rate eased toward `.9 + 1.7 * tension`, amplitude on a spring, `hop = max(0, sin(phase * 2π)) * amp`, `landed` when the half-phase floor changes, pitch on a spring (`bull-run/bull.ts:18-35`). The rider's pelvis is pinned to `seat(b)` and its lean, arm and hat springs (22/0.6, 12/0.5, 16/0.3) chase the bull's pitch and hop, which is the whole "rider lags the bull" effect (`bull.ts:57-60`); the rope arm is two-bone IK from the shoulder to `ropeGrip(b)` and `hold()` freezes the grip in the rider's frame at release (`bull.ts:160-161`). The first frame steps with `dt = 9` so every spring starts settled (`scene.ts:119`).
- **Rows from the multiplier**: `rowsFor = 1 + floor(log(m) / log(1.35))`, at most 9 (`pyramid-scheme/pyramid.ts:10`); recruits walk in on `smoothstep(0, .8, age)` with distance-driven feet that blend to planted (`scene.ts:91-99`); supports plant their feet on the hands below (`pyramid.ts:27-36`); the collapse is seeded by `crashX100` with a per-level delay and bodies bounce then topple to the nearest right angle (`pyramid.ts:130-157`). The jump off the top is an exact parabola with the landing time solved analytically (`scene.ts:100-104, 199`).
- **A smaller portrait**: `portrait.ts` wraps `draw` to render 960 × 540 offscreen and crop to 540 × 752 with an inset (`bull-run/portrait.ts`, `pyramid-scheme/portrait.ts`).

## 10. WebGL2 games (Seed Round, Moon Boys)

Two games render WebGL2 to an offscreen canvas and copy each frame into the shell's 2D context, so the shell, the HUD and replay are unchanged. They share `math3d.ts` verbatim and the same file layout; Seed Round is the smaller one to read first.

- **`gl.ts`**: fixed attribute slots (`gl.ts:11`), 28 floats per instance (a mat4, a tint, params and more, `:13`), `createProgram` binds locations before linking (`:38-50`), `uploadMesh` builds one VAO with static attribute buffers, an index buffer and a `DYNAMIC_DRAW` instance buffer with `vertexAttribDivisor(…, 1)` (`:68-95`), `drawInstances` is `bufferSubData` plus `drawElementsInstanced` (`:98-105`), and `putInstance` writes a scaled basis matrix (`:112-128`). One draw call per mesh, however many swimmers or holders.
- **`math3d.ts`**: tuple `Vec3`, column-major `Mat4`, `perspective`, `lookAt`, `multiply`, Rodrigues `rotateAbout` (`:27`), `basisFrom(forward, up, roll)` (`:85`) and `projectToScreen` (`:99-105`) for HUD labels drawn in Canvas 2D over the copied frame (`seed-round/hud.ts:50-67`).
- **`meshes.ts`**: a `Builder` that accumulates face normals into smooth normals (`:48-68`), a `lathe` with super-ellipse cross-sections (`:77-97`), a swimmer with a per-vertex `wave` weight for the tail (`:125-144`), a tunnel grid (`:324-339`); Moon Boys uses a `box` mesh 700 times as the generic segment, wire and prop primitive (`moon-boys/render.ts:90-125`).
- **`shaders.ts`**: the work that would be too slow on the CPU. Seed Round bends an (angle, ring) grid onto the path in the vertex shader with a travelling contraction `pow(max(0, sin(uBeat − s · 0.045)), 6)` (`:36-63`), gives each swimmer a travelling-wave tail `p.x += sin(w · 11 − phase) · amp · w` with per-instance phase and amplitude (`:138-158`), and reads faces and prints from an atlas; the path is written once in TypeScript and emitted as the same GLSL (`path.ts:46-54`). Moon Boys reconstructs a sky ray from the view matrix rows (`:170-205`), kicks the holders' legs in the vertex shader from a negative `iParams.z` (`:43`), and flutters a flag with `sin(w · 6 − t · 7) · flex · w²` (`:38-42`).
- **`atlas.ts`**: one 1024 × 512 Canvas 2D texture with faces in 128 px cells and prints (`seed-round/atlas.ts:119-135`); Moon Boys encodes a 2 × 2 cell span in the cell code (`shaders.ts:86-96`).
- **`render.ts`**: the offscreen `webgl2` context (`:83-85`), a mesh table with capacities (`:99-113`), `begin()` clearing to the fog colour (`:159-174`), blend and cull helpers, sprite batching, `end()`, a `lost` getter (`:149`) and `dispose()` that deletes everything and calls `WEBGL_lose_context` (`:302-313`).
- **The scene**: copies with `ctx.drawImage(r.canvas, 0, 0, W, H)` after sizing the GL canvas to at most 1.5 × the 2D canvas (`seed-round/scene.ts:497-501`); draws `fallback.ts` (a seeded Canvas 2D side view) when WebGL2 is missing or lost (`:502-504`); handles `webglcontextlost` with `preventDefault` and rebuilds the renderer on `webglcontextrestored` (`:114-126, 486-494`); `dispose()` unhooks those listeners first so the loss it causes is not prevented (`:601-609`). The frame clamp is 0.2 s here, not 0.1.
- **3D rigs**: swimmers live in bore coordinates `{ rel, rho, theta }` relative to the pack anchor (`pack.ts:29-50`); a whale's jaw is hinged by rotating basis vectors about its axis (`pack.ts:491-494`). Moon Boys estimates the rocket's angular velocity from frame deltas (`rocket.ts:222`) so detached stages and holders inherit `v + ω × r` (`:158-175`), and a stage's later pose is the closed form `vel · t − ½ g t² + out · 2.5 t` with a roll (`:293-296`). Ninety-six holders sit on a staggered 9 × 11 grid with shuffled quit waves (`:98-117`); the hero astronaut's limbs are box segments solved by `heroLimb`, a 3D two-bone solver with a `grip` blend from hull to free (`:448-477`), tested at `kinematics-worlds.test.mjs:51`. The moon is a camera-facing plate whose pupils follow `dot(toRocket, xAxis)` (`world.ts:216-257`).
- **Camera**: springs for orbit versus chase, tracking, a pull-back `60t + 260t²` at the crash, gust roll and a field of view `62 + kick` where the kick includes the punch (`seed-round/scene.ts:252-291`); Moon Boys adds a floor clamp on the eye and roll from sway velocity (`scene.ts:219-259`). Tests assert the camera keeps the hero and the open canopy in frame through the exit (`visual-worlds.test.mjs:119, 129`).
- **Particles**: emitters with fractional accumulators per cluster so emission density is equal at 30 and 144 fps (`moon-boys/rocket.ts:261-273`, `kinematics-worlds.test.mjs:63`), a cap of 900, additive flame sprites stretched along view-space velocity (`shaders.ts:271-283`) and smoke in a second flush.
- **The ending**: beats as named seconds (`crash.ts:20-28` in both), a reveal held into the next betting phase for `REVEAL_HOLD` seconds, and a seeded `mulberry32(crashX100 * 7919 + 17)`.

## 11. Fluids, particles and mechanisms

- **A filling jar** (`honeypot/jar.ts`): level `0.16 + 0.8 (1 − e^{−g/2.3})` on a 4/0.9 spring; a rect from the surface with a translucent meniscus ellipse whose ry breathes `8 + 2 sin 3t` (`:233-238`); bubbles rise on `(i · 53 + time · 30) % height` (`:241-247`); drips are three phase-offset ellipses on a `drip` phase that advances `(0.4 + tension) · dt`; honey strings are points pushed from the paw and drawn as quadratics back to the surface (`:179-184, 313-321`); the jar squashes about its base on an 18/0.32 spring kicked by knocks (`:106-108, 221-224`). The bear's arm is drawn between the honey and the glass through a `drawReach` callback that un-applies the squash (`picnic.ts:671-686`).
- **A pool that fills and drains** (`exit-liquidity/pool.ts:63-78, 177-240`): `surfaceY(x)` = level + two slosh sines (amplitude `2 + 9 · tension`) + a Gaussian funnel at the drain − a whale bump; the water is a polygon sampled every 8 px, gradient-filled and tinted by `murk`, clipped for caustics and the whale, with a foam line, whirl ellipses and splashes; `drainPull` gives per-x suction for the floaters (`:143-148`). The plug chain is a dashed quadratic whose sag is `(1 − tension) · 60 · (1 − plug)` (`:243-275`).
- **A particle pool** (`boiler-room/particles.ts`): one array capped at 900 with `shift()` (`:37-49`); kinds steam, smoke, spark, ember, coal, soot, rivet, cap, note and tag with per-kind integration (steam grows, notes flutter, rivets bounce on the floor at 0.35 restitution, `:77-140`); two layers drawn behind and in front of the machinery (`:142-223`); `fadeOut` retires leftovers over 0.6 s on reset; puffs and sparks are seeded with `noise(seed + i · k)`. Other games keep ad-hoc arrays of shreds, puffs, confetti or debris; all cap them.
- **A slider-crank, belt and governor** (`boiler-room/engine.ts`): the exact linkage `pin = CRANK + R (cos θ, sin θ)`, `crosshead = pin.x − sqrt(ROD² − dy²)`, `piston = crosshead − 109` (`:287-293`), with dead centres where the guide offset puts them; `strokes(θ)` counts reversals to fire chuffs (`:106-110`); crank speed approaches `2π (0.6 + 2.8 (1 − e^{−g/2}))` with `exp(−dt/τ)` (`:140-156`); belt tangents `β = asin((68 − r) / D)` with a dash offset capped at 12 px per frame so it never strobes backwards (`:498-512`); fan and flywheel cross-fade to a blurred disc past 20° per frame (`:530-581`); governor balls at `arm · sin α` with `α = 0.25 + 0.95 · smoothstep(2, 20, ω)`, depth-sorted by `sin(spin)` (`:598-615`). The stoker's dropped shovel takes its velocity from a finite difference of the cycle and runs fixed-step 1/240 physics with an end pivot (`stoker.ts:255-307`).
- **A marquee whose letters loosen and drop** (`wen-binance/club.ts`): per-letter loose and drop multipliers (`:32`), loose letters hanging from a corner on a 4/0.14 swing spring kicked by the bass (`:352-353, 897-904`), `dropLetter` with drift toward the door, gravity 1100 and 0.3 restitution (`:197-207, 357-368`), and at the crash every remaining letter gets `dropAt = 0.1 + n · 0.07` (`:311-315`).
- **A queue that advances on the curve** (`wen-binance/queue.ts:13-22, 80-88`): nine coins, each on a critically damped 7/1 spring toward a progress `log2(m) / 4.2` quantised to half strides and lagged by `i · LAG`, so a ripple runs down the line; feet step on `stride = x − home`.
- **A perspective road** (`liquidation-lane/road.ts:134-194`): `s = 1 / (1 + max(−30, z) / 90)`, `x = 480 + curve (1 − s)² + lateral · s + side · 540 · s`, `y = HORIZON + 221 s`; road strips loop over 70 slices with `advance = distance % 30`; every object goes into one array sorted far to near. Instruments and a drivetrain with log-interpolated rpm per gear live in `cockpit.ts` and `scene.ts:47-54`.
- **A bee swarm** (`honeypot/picnic.ts:131-138, 1035-1061`): 28 bees seeded once, each with its own speed and wobble on a squashed orbit ring, with `8 + 20 · tension` of them faded in.
- **A tie that grows into the crowd** (`insider-wallets/rally.ts:281-285, 539-594`): length, sway and lag springs (1.6/0.9, 5/0.35, 3.2/0.45) drawn as a quadratic with the tip pooled sideways on the floor; the crowd is a 5 × 14 grid with a join order, cubic-overshoot pop-in and a nod ripple (`:16-29, 646-712`).
- **An EKG** (`hopium-drip/monitor.ts:131-180`): a ring buffer with pixel speed `90 + bpm · 0.6` and a target `bpm = 72 + 80 · tension + 50 · log10/3`; the flatline scribble is seeded (`:121-123`).

## 12. Endless content: feeds, tickers, chats, captions

Long rounds need text that never runs out and never repeats back to back:

- **Caption ladders**: `[multiplier, text]` pairs read with `find(([top]) => x < top)` (`balloon-pump/scene.ts:101-111`), a regret ladder keyed to `multiplier / secured` after a cash-out, and `OVERTIME_CAPTIONS[floor((elapsed − 45 s) / 12 s) % n]` past 45 s. Yes Men's `REGRET` ladder is the same idea (`court.ts:103-108`).
- **Seeded feeds** with their own generator (`mulberry32(0xfeed)`), rumours at fixed multipliers, `settleFeed` skipping what a late entry already missed, and a cadence `0.9 − 0.65 · tension + r() · 0.3` (`seed-round/feed.ts:40-80`; `moon-boys/feed.ts`).
- **A comment column** that scrolls at `22 + tension · 90` and refills from a cursor so lines never repeat consecutively, with `postComment` for your own line and `floodOverlay` to replace the queue at the crash (`not-financial-advice/overlay.ts:121-156`).
- **A wallet tracker** whose rows flip at their own multipliers with a flash keyed to `log(m / at) / 0.04` so replays agree (`insider-wallets/tracker.ts:13-27`), balances `900 · salt · m^1.32`, and a compact two-row layout when the canvas is narrower than 600 px (`:76-94`).
- **Texts and threats by multiplier**, overtime lines every 8 s, capped at 6 live (`wife-changing-money/kitchen.ts:14-28, 508-528`); a `crossed(at)` helper on the last multiplier fires each threshold once (`:472-487`).

`long-round-scenes-a.test.mjs` and `long-round-content.test.mjs` hold these to bounded memory and continued novelty in the third minute, including with the multiplier held constant at 100,000×.

## 13. Portrait mode (`portrait.ts`)

Eleven games recompose for a tall canvas with the same 48-line `portrait.ts` (`games/alignment-check/portrait.ts` is the canonical copy, and Yes Men carries a 52-line variant of it; Rage Quit, Beyond the Colony, MUMU Bull Run, Know Your Clown, Bull Run, Pyramid Scheme, Thin Ice, King of the Hill and The Trenches have shorter designs of their own, below). It is a compositor, not a second scene: the landscape frame is drawn as usual, captured, and re-presented as a close-up plus an overview.

```ts
const { capture, present } = createPortrait('FAMILY MEETING', [205, 150, 545, 360], '#f0d99c');  // scene.ts: title, focus crop [x, y, w, h] in 960×540, accent
// at the end of draw():
capture(ctx);                                   // copies the finished landscape frame when the canvas is taller than wide
present(ctx, view, caption, label, content, detail?);  // repaints 540×800: title, multiplier, caption, the crop, the full frame as an inset, a status line
```

- `isPortrait(canvas)` reads `clientWidth`/`clientHeight`, not the device transform, so the choice follows the CSS box; the shell's `ResizeObserver` resizes the canvas and `scripts/qa/portrait.test.mjs` checks a short mobile host still gets the portrait composition.
- `detail` overrides the focus crop for a moment that needs a different close-up (the crash, the exit); the overview inset keeps the location and the payoff visible.
- `present` returns early on a landscape canvas, so calling both every frame costs nothing in the usual case. Nothing in the scene branches on orientation; the rig does not know it is being cropped.

The canvas only becomes taller than wide because the game's own CSS says so: after the `/* game */` marker, the portrait games add a media query that gives `.stage` and the canvas a `540/800` aspect ratio on narrow screens (`games/family-meeting/style.css`, the block after the marker). The shell's bitmap stays 960 × 540; `present` maps 540 × 800 onto it with `setTransform`, and the CSS stretch cancels out.

Other portrait designs in the catalog, for when the capture-and-crop compositor does not fit:

- **Offscreen re-render**: draw the scene again with `close = true` (no HUD) into a 960 × 540 offscreen canvas and crop state-aware regions from it, with a gag detail as the inset instead of an overview (`rage-quit/portrait.ts:5-44` wraps the scene's `render(c, view, now, close)`; `beyond-the-colony/portrait.ts:6-31` follows the hero's x; `mumu-bull-run/portrait.ts:9-36` takes a `Framing` with a second crop that follows the current antagonist).
- **A `portrait(draw, title, crop, caption)` wrapper** around the scene's own `draw` that renders 960 × 540 offscreen and crops to 540 × 752 with an inset (`king-of-the-hill`, `thin-ice`, `the-trenches`, `bull-run`, `pyramid-scheme`); `draw` takes a `close` flag that drops HUD parts in the close-up.
- **Component recomposition**: no capture at all; the portrait function re-places the scene's components in a 540 × 752 space and passes a `figure` callback so the same rig draws in both layouts (`know-your-clown/portrait.ts:26-79`).

`scripts/qa/portrait.test.mjs` lists the games expected to recompose and checks each inside a 100 px-tall host frame.

## 14. Sound cues

`pageAudio({ style, crash, bpm?, tempoRise?, music?, effects? })` from `./audio` is called once per scene; it returns the page's single `Audio` whose options come from the first call (`scripts/shell/audio.ts:84`). Each frame the scene calls `audio.update(view.phase, tension)`. Cues:

| Call | When the games fire it |
| --- | --- |
| `audio.fx(name, strength)` | from rig `events` (`push` → `chuff`, `bottom` → `squeak`, `up` → `creak`, `notch` → `ratchet`), with `strength` scaled by tension (`balloon-pump/scene.ts:514-522`) |
| `audio.milestone(n)` | when the count of rungs passed rises during a live frame, never on a settle |
| `audio.cashout()` | once, when `view.cashoutX100` turns non-null while running and the scene saw the edge |
| `audio.crash(kind, quiet)` | on the `crashed` edge; `quiet` when met late (`crashAge > 1500`) or on a first frame already crashed |

Styles (`phonk`, `chiptune`, `eurodance`, `trap`, `lofi`, `techno`, `synthwave`, `dnb`, `hardstyle`, `elevator`, `casino`, `ambient`, `military`, `club`, `hospital`) and stingers (`boom`, `pop`, `splash`, `shatter`, `thud`, `flatline`, `trombone`, `scratch`, `crowd`, `static`, `slam`, `siren`) are typed in `audio.ts:22-26`; the 40-odd one-shot `Effect` names are listed beside them. A game's own synthesis builds on `audio.context` and `audio.bus` once they exist (they are `null` until the player turns sound on), so one button governs everything; see Custom audio on the shared bus.

## 15. Custom audio on the shared bus

Three games synthesise their own sound on top of the page's `Audio`. The helper exposes `context`, `bus` and `enabled` (`audio.ts:54-61`); both are `null` until the player turns sound on, so a module builds lazily and rebuilds when the context changes:

- `boiler-room/sound.ts`: `ensure()` creates a white-noise bed → highpass 1800 Hz → `hiss` gain and a triangle whistle oscillator on `audio.context`/`audio.bus` (`:47-73`); `burst()` plays filtered noise with an exponential decay and an optional cutoff sweep (`:76-93`); `chuff`, `ping` and `blast` are one-shots (`:109-144`); `update(pressure, running, shriek)` runs every frame (`:99-108`).
- `moon-boys/sound.ts`: a page singleton `pageSound(audio)` (`:21-25`); brown noise → lowpass 160 Hz → gain → bus for the engine, `setTargetAtTime` from thrust and tension (`:49-81`); `twang` is a sawtooth sweep 1400 → 180 Hz frequency-modulated by an 18 Hz sine (`:82-104`).
- `liquidation-lane/sound.ts`: `engineSound(audio)` builds sawtooth and triangle oscillators → lowpass → gain → bus when the context appears (`:14-24`), maps rpm to frequency, cutoff and gain (`:26-29`), and returns `dispose()` that stops and disconnects the voices; the scene returns it as its own `dispose` (`scene.ts:307`).

Everything routes through the shared bus, so the one Sound button, the hidden-page muting and `pagehide` close govern a game's own sounds too. The procedural effects (`audio.fx`) are usually enough; add a module only for a continuous sound the one-shots cannot make.

## 16. Testing a rig

The controller pattern exists so rigs can be driven headlessly. Two test styles are in the repository and both run under `node --test` with esbuild bundling the TypeScript in memory:

```js
// scripts/gallery/kinematics-acting.test.mjs:6
const modules = new Map();
async function source(path) {
  if (!modules.has(path)) modules.set(path, build({ absWorkingDir: ROOT, entryPoints: [`games/${path}.ts`], bundle: true, format: 'esm', platform: 'node', write: false })
    .then(r => import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`)));
  return modules.get(path);
}
```

- **Per-game tests beside the game** (`games/andys-loud-garden/andy.test.mjs`, `games/rug-piste/*.test.mjs`) bundle a single module the same way, or import the `.ts` directly under Node's type stripping (`import { solveArm } from './yeti-rig.ts'`). They are excluded from the source pack (only `.ts`, `.json`, `.html`, `.css` ship) and are not picked up by `npm test`; run them with `node --test games/<slug>/*.test.mjs`.
- **Catalog regression tests** in `scripts/gallery/` (`kinematics-*.test.mjs`, `visual-*.test.mjs`, `long-round-*.test.mjs`) run in `npm test`. When a rig changes, read the tests that name it before editing; they encode the contract reviewers expect.

What they assert, and what a new rig should satisfy:

- **Bone lengths** at every target including coincident and unreachable ones; the drawn hand or foot sits at the solved endpoint (`kinematics-locomotion.test.mjs:38`: the rider's `lineTo` reaches `ropeGrip(b)` in the actual draw commands, recorded through a proxy canvas that tracks the transform).
- **Pole continuity**: the elbow moves a few pixels per frame at most and never crosses to the other side mid-motion.
- **Planted feet**: stance contacts stay still in world space; swings begin and end with zero velocity; a first step from standing does not move a planted sole.
- **Frame-rate independence**: the same drive at 30, 60 and 120 Hz lands within tolerance (`visual-physical.test.mjs:17`, 180 s of bucking at three rates).
- **Continuity at phase boundaries**: a cash-out or crash inherits the current position and velocity (`kinematics-worlds.test.mjs:18`: the bail position equals the contact point, and a later crash does not move it); no teleport on an accepted exit.
- **Late entry**: `settleX` at `elapsed = 150 s` reproduces a bounded, sensible pose (`visual-physical.test.mjs:100`); a scene opened after the crash settles quietly with no cues (`know-your-clown.test.mjs:163, 175`).
- **Long rounds**: 180 s at 60 fps with bounded arrays and continued action (`long-round-content.test.mjs`); the course of a skill game keeps generating (`:134`).
- **No device coordinates**: the proxy canvas throws if a rig calls `getTransform()` (`kinematics-acting.test.mjs:16`); rigs work in the 960 × 540 space and let the shell scale.

A proxy canvas for drawing assertions, with transform tracking, is at `kinematics-locomotion.test.mjs:22-36`; a stub for `./audio` that records cues is at `know-your-clown.test.mjs:17-35` and a simpler `pageAudio = () => new Proxy({}, { get: () => () => {} })` at `kinematics-locomotion.test.mjs:12`.

## 17. Reviewing motion in a browser

- `npm run preview -- <slug>` serves the live page and the replay page on port 4500. Check waiting, betting, running, an instant crash (the emulator's `edge` scenario), an accepted cash-out, a disconnected host and a small screen.
- `node scripts/qa/scene-review.mjs` after a build serves every scene at `http://127.0.0.1:4511/<slug>/index.html` with a fixture that steps the scene at 30 fps on the default curve (`?seconds=150&late=1` for a settled late entry, `&crash=1`, `&cashout=1`, `&reduced=1`). With `?seconds=0`, drive it from the console: `sceneReview.advance(15)`, `.tick(0.125)`, `.tick(0.1, 'crashed')`, `.cashout()`, `.seek(150)` (`scripts/qa/scene-review.mjs:12-60`). `REVIEW_GAMES=a,b` limits the build.
- `REVIEW_SEQUENCE=1 node scripts/qa/capture.mjs <dir>` screenshots the continuous run through 180 s plus responsive and outcome states (`scripts/qa/capture.mjs`); it needs the gstack browser.
- `npm run test:browser` (Playwright Chromium) covers the shell on room curves, portrait recomposition in a short host, and that the community scenes keep acting during betting and late running rounds by sampling pixel change between frames (`scripts/qa/community-motion.test.mjs`).

## 18. Checklist for a new or changed rig

1. Copy `motion.ts` from Boiler Room (or the variant you need) and `kinematics.ts` from Family Meeting (continuous pole, `walkingFoot`) or Blanket Champ (the 19-line core). Keep the game's own files flat and importing only each other, the SDK and crash-math.
2. Model the character as a `create/settle/step/reset/pose/draw` module with a plain `Drive` and one-frame `events`. Solve limbs in the pose function from world targets with a fixed pole per limb; draw the solved endpoint.
3. Put every lagging part on a spring with its own omega; use `settleSpring` on the first frame, on a missed phase edge and in `reset`. Clamp `dt` to 0.1 s; warp it for hit-stop, never the shell clock.
4. Drive gaits by distance; derive bob, lean and squash from the same phase; start from standing without skating.
5. Key the ending to `view.crashAge` and seed it with `mulberry32(crashX100)`; settle the aftermath when met late and play the quiet crash. Make the accepted exit inherit the current position and velocity.
6. Keep loops bounded and content endless past 150 s; cap arrays in `step`.
7. Add a headless test beside the game (bone lengths, planted feet, three frame rates, late entry) and run the catalog tests that name your game.
8. `npm run build`, `npm run typecheck`, `npm run check`, `npm test`, then `npm run preview -- <slug>` in both modes and a narrow window.

## 19. Where to look: an index by technique

Every game's own files are flat in `games/<slug>/`. The second column names the files that carry the technique; the rest of the game is the usual `scene.ts` skeleton.

| Game | Files | Study it for |
| --- | --- | --- |
| hello-world | `scene.ts` | the minimal scene; closed-form bob and damped landing; cue edges |
| balloon-pump | `pumper.ts`, `balloon.ts`, `sniper.ts`, `motion.ts` | the reference Canvas rig: hands pinned, springs with per-part lag, a face table, a tethered spring, a buoyant body, the asymmetric stroke, hit-stop |
| boiler-room | `engine.ts`, `stoker.ts`, `particles.ts`, `sound.ts` | slider-crank, belt and governor; a layered particle pool; mode-blended limb targets; a game's own synthesis on the bus |
| tower-tension | `tower.ts`, `crane.ts`, `worker.ts`, `truck.ts`, `office.ts` | a shear spring chain with substeps; a PD-steered pendulum; camera tracking and collapse framing |
| thin-ice | `skater.ts`, `ice.ts`, `engine.ts` | a stride rig; a scarf chain; seeded crack networks; late-entry journey reconstruction; floes; an offscreen tinted ghost |
| king-of-the-hill | `ape.ts`, `gait.ts`, `hill.ts`, `coin.ts`, `dev.ts`, `airdrop.ts` | planted footsteps as state on a slope; pelvis pull-in; rolling contact; a vehicle pick-up |
| the-trenches | `squad.ts`, `field.ts` | marching squash per step; elbow flip at full reach; snapshot-and-launch at the crash |
| pump-and-dump | `bench.ts`, `gym.ts` | a bench press seen from the feet; a bending bar; elbow that faces the camera by mixing mirror solutions with hysteresis; plate settling |
| bonding-curl | `curler.ts`, `gym.ts`, `medic.ts`, `motion.ts` | a muscle as a pressure volume; collision-limited pose; `footAt` gait; a walking medic with braking |
| andys-loud-garden | `andy.ts`, `police.ts`, `acts.ts`, `andy.test.mjs` | a rig test beside the game; a supported prop (the can); feet planted per step; everything from `elapsed` and `crashAge` |
| alignment-check | `rigs.ts`, `roof.ts`, `city.ts`, `lines.ts`, `acts.ts` | the only full skeleton with pose blending; authored pole hints; a dialogue ladder with bubble layout; loose-prop physics; a tilt-down camera |
| family-meeting | `family.ts`, `kitchen.ts`, `kinematics.ts` | continuous pole through depth; seated legs that foreshorten; `walkingFoot`; a head burst with per-piece landing surfaces; 360-step aftermath settle |
| thanksgiving-uncle | `folks.ts`, `room.ts` | elbow hints by cross product; the `swing()` angular blend; a wall break; a rug transform under a chair |
| gas-fees | `riders.ts`, `cabin.ts` | a crowd packed in depth order; bubble placement search; a cable bounce; a snapshot dissolve |
| hopium-drip | `ward.ts`, `monitor.ts`, `kinematics.ts` | pole crossfading through zero; `walkTo` braking mover; an EKG ring buffer; a non-skating `walkingFoot` |
| i-got-hacked | `mansion.ts`, `party.ts`, `acts.ts` | `plantedStep`; polar arm targets; a smooth hit-stop ramp; chart decimation; acts with per-prop crossfade |
| onlyfrens | `stream.ts`, `chat.ts` | equal-bone `sleeveElbow`; head lag springs; `fract`-phase burst scheduler; a scrolling message stack and goal ladder |
| blanket-champ | `room.ts`, `sleepers.ts`, `crowd.ts` | a beat metronome emitting events; props on springs kicked per beat; a braking-curve walker; soft spring reset |
| wife-changing-money | `trader.ts`, `kitchen.ts` | a hunched seated rig that stands and climbs stairs; a cursor that drifts; a text stack; a 240-step mug pre-roll on late entry |
| not-financial-advice | `studio.ts`, `overlay.ts`, `acts.ts` | a green-screen tear; sponsor-read springs; a comment column that never repeats; saturation composite at the crash |
| honeypot | `jar.ts`, `picnic.ts` | a liquid with meniscus, drips and strings; a bear arm through a jar neck; a fox with a stamp; a bee swarm |
| exit-liquidity | `pool.ts`, `party.ts` | a water surface with slosh and a drain funnel; a plug chain; holders in depth rows; ladder climbing on rungs; a helicopter |
| insider-wallets | `rally.ts`, `tracker.ts` | a tie on three springs; a crowd grid with a join order; press flashes; a tracker and pie |
| wen-binance | `club.ts`, `queue.ts` | a queue on lagged springs; marquee letters that loosen and drop; doors on a spring; a beat grid |
| liquidation-lane | `cockpit.ts`, `road.ts`, `sound.ts` | a perspective road with depth sort; a head that lags on springs; hands kept on the wheel; an engine voice with `dispose()` |
| seed-round | `gl.ts`, `render.ts`, `shaders.ts`, `meshes.ts`, `pack.ts`, `path.ts`, `crash.ts`, `fallback.ts` | the WebGL2 reference: instancing, a path bent in the vertex shader, travelling-wave tails, an atlas, context loss, a Canvas fallback |
| moon-boys | `rocket.ts`, `world.ts`, `crash.ts`, `shaders.ts`, `sound.ts` | stage separation with inherited angular velocity; 96 instanced holders; a 3D two-bone limb; camera-space props; frame-rate-independent emitters |
| rug-rails | `runner.ts`, `course.ts`, `track.ts`, `input.ts`, `stash.ts` | perspective lanes; a runner from behind with symmetric IK; seeded course generation; input with an autopilot; substeps; a stash |
| rug-piste | `yeti-rig.ts`, `lift-rig.ts`, `course.ts`, `input.ts`, `*.test.mjs` | a pure crashAge-driven rig with tests; hashed course rows; held keys and on-page buttons; a Playwright scene test |
| up-only | `shiba.ts`, `sky.ts`, `chart.ts`, `input.ts` | forward-kinematic wings with spring follow-through; exact flap integration; a velocity-kicked squash; candle gaps from tension |
| wen-moon | `rocket.ts`, `scene.ts` | log2 altitude with a lift-then-scroll camera; a pod inheriting angular velocity; a seeded shred |
| bull-run | `bull.ts`, `scene.ts`, `portrait.ts` | a bucking oscillator on an integrated phase; a rider pinned to the seat and lagging on springs; grip hold at release |
| pyramid-scheme | `pyramid.ts`, `scene.ts` | rows from the multiplier; recruits that walk in and plant; a seeded staggered collapse; an analytic jump |
| rage-quit | `acting.ts`, `actor.ts`, `ink.ts`, `room.ts`, `portrait.ts` | stateless pose bag with layered lerps; alternating fist strokes; a phase-wrapped impact ring; a height-dependent pole; an offscreen re-render portrait |
| beyond-the-colony | `penguin.ts`, `choreography.ts`, `actors.ts`, `motion.ts` | waddle, leap and belly slide from envelopes; `recoil`; two-sample follow-through; a 7 s act script |
| mumu-bull-run | `rig.ts`, `motion.ts`, `acts.ts`, `art.ts` | a jointed gallop with hooves in the ground frame; time-driven encounters with a contact beat; a two-crop portrait |
| yes-men | `cast.ts`, `court.ts`, `ink.ts` | a multiplier-keyed script; integrated nod and clap phases; zeal thresholds; an escort state machine; velocity-kicked springs |
| know-your-clown | `character.ts`, `direction.ts`, `ministry.ts`, `ink.ts` | `outward()` poles with hip settle; rig snapshots blended on mode change; a scale-aware `walked()` stride; an expressive face from windows; cue keys that survive seeks |
