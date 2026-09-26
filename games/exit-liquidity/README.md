# Exit Liquidity

The liquidity pool is an actual pool. A backyard party at golden hour: a DJ Wojak, an LP booth, loungers, and the dev on his lounger with the plug chain round his wrist. Your degen floats on an inflatable flamingo. As the displayed multiplier rises the water rises with it and turns murkier, more degens cannonball in, the holder count ticks up, the chain goes taut and the dev's grin widens; past 5× a whale surfaces under the crowd. An accepted cashout paddles you to the ladder, out onto the deck and onto a lounger with a towel, a cocktail and shades. The crash is the dev pulling the plug: the water funnels down the drain, everyone still floating spins down with it, one sad Wojak is left in the puddle, and the dev strolls off with a bag.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `pool.ts`: the cutaway water body with its level, slosh, murk, whale, drain funnel and splashes; the rim, ladder, plug and chain.
- `party.ts`: holders (cannonball arcs, floating, the drain spiral), your avatar's paddle, climb, walk and lounge, the dev's grin, yank and exit, the DJ booth and loungers, and the Wojak busts.
- `scene.ts`: the sunset yard, composition, the HUD (captions, multiplier, holders and LP readout, the secured badge) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (5.68×) used by the gallery.

Water level, holder count, slosh, murk, the chain and the whale all follow the displayed multiplier; nothing in the presentation changes the committed outcome. `prefers-reduced-motion` turns off the screen shake.

Run `npm run dev` from the repository root and open the Exit Liquidity URL it prints. Join with 50 local credits, then cash out during a running round to climb out. `npm run build` produces the three publishable files in `dist/exit-liquidity/`.
