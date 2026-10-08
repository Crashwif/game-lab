# Wen Moon

A `$MOON` rocket on its pad, a frog in the porthole, a gantry arm on the hull. The round lifts it off: the flame lengthens with the tension, the pad and the gantry drop away, the clouds scroll past, the sky goes to space and the stars come out, and the moon in the corner grows without ever getting closer. The booster separates at the third rung and tumbles away; from the second rung a jeet bails out under a parachute at every milestone. An accepted cash-out ejects the pilot's escape pod: it pops off the nose, the chute opens, and it drifts down out of the picture with shades on while the rocket carries on without him. The crash bursts the rocket with a hit-stop, a flash and a fireball, and its seeded pieces (fins, hull chunks, the nose and the pilot if he was still aboard) fall out of the sky.

Lightweight on purpose: a scene, one part file, the motion toolkit and the page, so the whole source pack fits the platform's browser Studio budget (see [the README](../../README.md#lightweight-games-for-the-browser-studio)) and a remix starts in the browser.

- `scene.ts`: composition, the round-phase logic, the rungs (captions, jeets, the separation), the pod and the burst choreography, the audio cues and the HUD.
- `rocket.ts`: the world (sky, stars, moon, clouds, the pad and gantry), the rocket and its frog, the pod, the jeets and the seeded pieces.
- `motion.ts`: springs, easing, deterministic noise and a seeded generator.
- `audio.ts`: the shared page audio (a copy of the shell's, never edited here). Synthwave that tightens with the multiplier; the crash is a boom. Cues: the engine at liftoff, a milestone at each rung, a scream as a jeet bails, a whoosh for the separation and the chute, a pop for the pod, the register on a cash-out.
- `main.ts`: the shared page shell. `replay.json`: a verified 9.07× round for the gallery.

The altitude, the flame and the moon follow the displayed multiplier; nothing drawn here changes the committed outcome. A scene that opens mid-round or on a crashed round settles into place. The published game uses full animation regardless of browser motion preferences.

Run `npm run dev` from the repository root and open the Wen Moon URL it prints. Join with 50 local credits, then cash out during a running round to eject. `npm run build` produces the three publishable files in `dist/wen-moon/`.
