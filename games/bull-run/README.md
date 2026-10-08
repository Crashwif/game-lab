# Bull Run

A rodeo arena at Degen Rodeo, billed as `$BULL vs GRAVITY`. A rider in a lime shirt sits on a bull named `$BULL` in the chute while the crowd bobs behind the fence and the sponsors' banners (No Stop Loss Saddlery, HODL Feed Co) hang from the rails. The round slides the gate up: the bull runs out and bucks on a cycle whose rate and height follow the tension, the rider's lean, free arm and hat lag it on springs, dust puffs at every landing, and the dev clown peeks out of his barrel as the ride gets wild. An accepted cash-out vaults the rider onto the fence rail with shades on while the bull bucks on without him. The crash throws whoever is still aboard along a seeded arc with a hit-stop and slow motion, one bounce in the dirt, and the clown legs it with the bag.

Lightweight on purpose: a scene, one part file, the motion toolkit and the page, so the whole source pack fits the platform's browser Studio budget (see [the README](../../README.md#lightweight-games-for-the-browser-studio)) and a remix starts in the browser.

- `scene.ts`: the arena, the crowd, the fence and the gate, the clown, the round-phase logic, the dismount and the throw choreography, the audio cues and the HUD.
- `bull.ts`: the bull's bucking cycle, the seat the rider follows, the rider's springs, the vault, the seeded throw, the dust.
- `motion.ts`: springs, easing, deterministic noise and a seeded generator.
- `audio.ts`: the shared page audio (a copy of the shell's, never edited here). Phonk with the cowbell; the crash is a thud. Cues: the gate, a stomp at every landing, a milestone at each rung, the register and a whoosh on a cash-out, a scream for the throw, the clown's laugh.
- `main.ts`: the shared page shell. `replay.json`: a verified 5.49× round for the gallery.

The bucking follows the displayed multiplier; nothing drawn here changes the committed outcome. A scene that opens mid-round or on a crashed round settles into place. The published game uses full animation regardless of browser motion preferences.

Run `npm run dev` from the repository root and open the Bull Run URL it prints. Join with 50 local credits, then cash out during a running round to dismount. `npm run build` produces the three publishable files in `dist/bull-run/`.
