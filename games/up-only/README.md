# Up Only

The lab's second skill game, with one control. A shiba in a wif hat, with wings he was not born with, flaps through a live candlestick chart seen from the side. A tap on the picture (or ArrowUp, W, X or Enter) is a flap against gravity; green candles stand on the SUPPORT line, red candles hang from the RESISTANCE line, and the gaps between them shrink and come faster as the multiplier climbs, so the risk of the round and the skill of the flight climb together. $COPE, $WAGMI and $LAMBO coins run down the middle of each gap and in arcs in the open and fill the bag on his back; an INSIDER TIP pulls coins in for six seconds, a ROCKET smashes through candles for five, a HONEYPOT drains a fifth of the bag, and every twenty-fifth coin in a row pays a bonus. A clip of a candle, the floor or the ceiling spills a quarter of the bag and brings the FUD cloud in behind him; a second clip while it is close and its lightning takes the lot.

Cashing out calls the private jet: it slides in under him, he lands on it with the bag, which is **banked**, and it carries him to a berth above the chart. The crash is the rug pull: a red edge sweeps in from the right, every candle it passes flips red and falls out of the chart, the support line breaks and he drops through the floor with his unrealized bag. A copy-trading bot (mid) flaps the recorded round and any live round until the player's first flap, so a bettor who never touches the picture still sees a flight.

## The bag and the stash

The coins are a skill score and nothing else. A bag is only banked by a cash-out accepted before the crash; a banked bag goes into the **stash**, which this browser keeps (`localStorage`, when the frame has one; a sandboxed frame keeps it for the page). The stash sets a rank title (EXIT LIQUIDITY up to GOD CANDLE) and unlocks cosmetic drip on the shiba (deal-with-it shades, a gold chain, laser eyes, a crown). It is recognition only: never bought, never traded, never paid out, and it never touches a bet, a credit or a round. The HUD says so ("WORTH: NOTHING").

- `sky.ts`: the chart in picture px: the candle generator (gaps that stay reachable, coins down each gap, arcs, traps and power-ups in the open), the shiba's physics (a flap, gravity, the floor and the ceiling), pickups and the magnet, collisions and what each costs the bag, the FUD's heat, and the copy-trading bot.
- `chart.ts`: the night (stars, the moon, two skylines, price lines, a line chart), the support band with its ticker tape, the resistance line, the launchpad, every candle (standing, cracked, smashed or falling), every pickup, the FUD cloud and the rug pull's edge.
- `shiba.ts`: the shiba rig (the wing beat, the tilt, the spin of a clip, the rocket's flame, the fall, the drip) and the private jet.
- `input.ts`: the one control, wired from the game's own files: a tap or click on the picture, ArrowUp, W, X or Enter. Space stays the shell's.
- `stash.ts`: the stash, the ranks and the drip thresholds.
- `scene.ts`: composition, the round-phase logic, the crash and cash-out choreography, the HUD (caption ladder, multiplier, bag, power-up timers, stash and rank, toasts, the outcome) and the sound cues.
- `art.ts` and `motion.ts`: Canvas helpers and the shared spring toolkit.
- `main.ts`, `audio.ts` and the first part of `style.css` are the canonical shared shell copies. The sound is chiptune that quickens with the round, with coins, flaps, thuds, the FUD's zap, the jet's engine and the sad trombone of the rug on top. `clips.json` is empty: everything is synthesised.
- `replay.json` is a verified 7.67× example the gallery plays.

Join with **Ape in**, flap, then **Cash out** before the chart goes. Space triggers the currently available shell action; the flap keys never do. The embedded host owns joining and credits; only the cash-out is offered inside the frame. Flapping, the bag and the bot change nothing about the committed result. Credits have no monetary value.

The published game uses full animation regardless of browser motion preferences. A round met mid-way (a hidden tab, a late join) settles straight into its phase; a tab hidden a moment mid-round gets its chart and bag back.

All visuals are procedural Canvas drawings with no external image, font or network dependencies. The shiba is an original cartoon dog in a knitted hat.

From the repository root, run `npm ci`, then `npm run dev`. Open `http://127.0.0.1:4500/bundle/up-only/index.html`; add `?mode=replay` for the recorded preview. `npm run build` creates the self-contained `index.html`, `style.css` and `game.generated.js` in `dist/up-only/`, ready for Studio import.
