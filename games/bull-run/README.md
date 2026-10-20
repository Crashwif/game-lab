# Bull Run

A rodeo arena at Degen Rodeo, billed as `$BULL vs GRAVITY`. A rider in a lime shirt sits on a bull named `$BULL` in the chute while the crowd bobs behind the fence, a bear sits among them, and the sponsors' banners (No Stop Loss Saddlery, HODL Feed Co, 100× Leveraged Spurs) hang from the rails. During betting the bull bangs the chute and rattles the gate. The round slides the gate up: the bull trots out, its hooves stepping by distance travelled, then bucks on a cycle whose rate and height ease toward the tension (`1 - 1/x`, so 1×–3× covers most of the climb). The rider's lean, free arm and hat follow on springs, his pelvis and spurs stay pinned to the bull, and dust puffs at every landing.

Beats through the first fifteen seconds: `NO STOP LOSS` at 1.2×, the dev clown rising in his barrel from about 1.3×, `YEEHAW` at 1.4×, a ride ring that fills to the eight-second buzzer (`QUALIFIED RIDE`, the stands rise with their arms up), `8 SECONDS IS FOR JEETS` at 2×, the bull starting to travel at 12 s, and the bear standing up at 3× (`THE BEAR IS WATCHING`). Long rounds rotate bucking routines every 12 s and endurance acts from 42 s.

An accepted cash-out vaults the rider onto the fence rail with shades on (`JEETED BEFORE THE HORN` or `RODE IT. TOOK PROFITS.`) while the bull bucks on without him; the crash after it reads `DODGED THE BULL TRAP`. The crash throws a rider still aboard along a seeded arc that stays on screen (`BULL TRAP` for a player, `THE BULL WAS A BEAR` for a spectator), with a hit-stop, a 10% punch-in and slow motion: his hat flies off and lands in the dirt, he bounces once and topples flat, the bear vaults the fence, and the clown climbs onto his barrel, hops off and legs it with the bag. Between rounds the bull backs into the chute while the old rider fades out and the next one fades in.

Lightweight on purpose: a scene, one part file, the motion toolkit and the page, so the whole source pack fits the platform's browser Studio budget (see [the README](../../README.md#lightweight-games-for-the-browser-studio)) and a remix starts in the browser.

- `scene.ts`: the arena, the crowd, the bear, the fence and the gate, the clown, the round-phase logic, the dismount and the throw choreography, the audio cues and the HUD with the ride ring.
- `bull.ts`: the bull's bucking cycle and legs, the seat the rider follows, the rider's springs and legs, the vault, the seeded throw, the dust and the endurance acts.
- `motion.ts`: springs, easing and a seeded generator.
- `audio.ts`: the shared page audio (a copy of the shell's, never edited here). Phonk with the cowbell; the crash is a thud. Cues: the gate, a stomp at every landing, a milestone at each rung, the buzzer and a cheer at eight seconds, the register and a whoosh on a cash-out, a scream for the throw, the clown's laugh.
- `main.ts`: the shared page shell. `replay.json`: a verified 5.49× round for the gallery.

The bucking, the buzzer and every caption follow the displayed multiplier and the ride clock; nothing drawn here changes the committed outcome. A scene that opens mid-round or on a crashed round settles into place. The published game uses full animation regardless of browser motion preferences.

Run `npm run dev` from the repository root and open the Bull Run URL it prints. Join with 50 local credits, then cash out during a running round to dismount. `npm run build` produces the three publishable files in `dist/bull-run/`.
