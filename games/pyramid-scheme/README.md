# Pyramid Scheme

A wealth summit in a hotel ballroom: velvet curtains, a banner that reads EVERYONE WINS (*early), spotlights, and the founder pitching at a `$PONZI` lectern. Your degen stands on the stage with a bag over his head and a CEO sash. Every time the multiplier grows by a third, a row of recruits walks in from the wings underneath and the whole pyramid rises on a spring, so you climb without moving; the recruits' knees wobble and their smiles turn into grimaces, the strain gathering at the base. An accepted cash-out jumps you off the top to the stage floor, where you stand with shades on while the pyramid holds without you. The crash gives the base away: a hit-stop, then everyone tumbles along the crash's seed, bounces once on the stage and lies dazed, and the founder runs off with the money.

Lightweight on purpose: a scene, one part file, the motion toolkit and the page, so the whole source pack fits the platform's browser Studio budget (see [the README](../README.md#lightweight-games-for-the-browser-studio)) and a remix starts in the browser.

- `scene.ts`: the ballroom, the round-phase logic, the rows that join, the jump and the collapse choreography, the audio cues and the HUD.
- `pyramid.ts`: the pyramid's layout (rows, heights, places), the recruit rig, the founder, the seeded collapse and its bodies.
- `motion.ts`: springs, easing, deterministic noise and a seeded generator.
- `audio.ts`: the shared page audio (a copy of the shell's, never edited here). Casino lounge that tightens with the multiplier; the crash is a gasp and boos. Cues: a pop and a milestone as each row joins, the base creaking near the top, the register and a whoosh on a cash-out, thuds as bodies land, the founder's laugh.
- `main.ts`: the shared page shell. `replay.json`: a verified 7.67× round for the gallery.

The rows follow the displayed multiplier; nothing drawn here changes the committed outcome. A scene that opens mid-round or on a crashed round settles into place. `prefers-reduced-motion` removes the shake and the collapse's hit-stop.

Run `npm run dev` from the repository root and open the Pyramid Scheme URL it prints. Join with 50 local credits, then cash out during a running round to jump off. `npm run build` produces the three publishable files in `dist/pyramid-scheme/`.
