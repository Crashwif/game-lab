# Rug Rails

The lab's first skill game. A frog in a hoodie sprints down three neon subway lanes seen from behind, on the Trenches Line, where the walls are tagged WAGMI and NGMI and the billboards say MIND THE GAP (IN YOUR PORTFOLIO). Arrows, WASD or swipes swerve, jump and slide him past sell walls, KYC gates, rolled-up rugs and the Exit Scam Express (a ramped car is a road onto its roof and the coins up there); every $COPE, $WAGMI and $LAMBO coin he runs through swells the bag on his back, an INSIDER TIP pulls the coins in, 2× LEVERAGE doubles them, a HONEYPOT drains a fifth of the bag, and a streak pays a bonus. A stumble spills a quarter of the bag and brings the Taxman in on his heels; a second stumble while he is close and he takes the lot; a rug or a car head-on is REKT, the whole bag gone and a roll along the rails. The course speeds up with the multiplier, so the risk of the round and the skill of the run climb together.

Cashing out summons the golden EXIT LIQUIDITY hoverboard: the frog lifts off the rails with the bag, which is **banked**. The crash is the rug pull: the rails roll up like a carpet from the far end of the tunnel and everyone still running drops into the void with their unrealized bag. A copy-trading bot (mid) steers the recorded round and any live round until the player's first input, so a bettor who never touches the keys still sees a run.

## The bag and the stash

The coins are a skill score and nothing else. A bag is only banked by a cash-out accepted before the crash; a banked bag goes into the **stash**, which this browser keeps (`localStorage`, when the frame has one; a sandboxed frame keeps it for the page). The stash sets a rank title (EXIT LIQUIDITY up to DEITY OF DEGENERACY) and unlocks cosmetic drip on the frog (a gm cap, diamond gloves, a WAGMI cape, a crown). It is recognition only: it is never bought, never traded, never paid out, and never touches a bet, a credit or a round. The HUD says so ("WORTH: NOTHING").

- `course.ts`: the course in lane widths: the generator (patterns of walls, gates, rugs, trains, coin zigzags, traps and power-ups, always leaving a lane within one swerve), the runner's physics (lanes, jumps, slides, ramps and roofs), pickups and the magnet, collisions and what each costs the bag, and the copy-trading bot.
- `track.ts`: the tunnel projected onto the picture: walls with graffiti and billboards, ceiling ribs and lights, sleepers and rails, the station, every obstacle and pickup, the void and the rug roll, all in depth order around the runner.
- `runner.ts`: the frog rig (stride, lean, jump, slide, stumble, the knockdown roll, the grab, the hoverboard, the fall, the drip) and the Taxman rig.
- `input.ts`: the controls, wired from the game's own files: arrows or WASD, swipes and a tap on the picture. Space stays the shell's.
- `stash.ts`: the stash, the ranks and the drip thresholds.
- `scene.ts`: composition, the round-phase logic, the crash and cash-out choreography, the HUD (caption ladder, multiplier, bag, power-up timers, stash and rank, toasts, the outcome) and the sound cues.
- `art.ts` and `motion.ts`: Canvas helpers and the shared spring toolkit.
- `main.ts`, `audio.ts` and the first part of `style.css` are the canonical shared shell copies. The sound is drum and bass that quickens with the round, with coins, whooshes, thuds, the Taxman's siren and the rails' boom on top. `clips.json` is empty: everything is synthesised.
- `replay.json` is a verified 8.07× example the gallery plays.

Join with **Ape in**, steer, then **Cash out** before the rails go. Space triggers the currently available shell action; the arrows never do. The embedded host owns joining and credits; only the cash-out is offered inside the frame. Steering, the bag and the bot change nothing about the committed result. Credits have no monetary value.

The published game uses full animation regardless of browser motion preferences. A round met mid-way (a hidden tab, a late join) settles straight into its phase; a tab hidden a moment mid-round gets its course and bag back.

All visuals are procedural Canvas drawings with no external image, font or network dependencies. The runner is an original cartoon frog.

From the repository root, run `npm ci`, then `npm run dev`. Open `http://127.0.0.1:4500/bundle/rug-rails/index.html`; add `?mode=replay` for the recorded preview. `npm run build` creates the self-contained `index.html`, `style.css` and `game.generated.js` in `dist/rug-rails/`, ready for Studio import.
