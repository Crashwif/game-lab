# Thin Ice

A skater crosses a frozen lake under the aurora on 100× leverage: the ice is thin liquidity, and the lake is full of frozen bagholders who went through before her. Her strokes quicken with the displayed multiplier, her reflection glides beneath her, and the ice around her fails faster and faster: water shows through, and cracks spread from her skates. An accepted cashout closes the long and carves her toward the far shore, where she climbs onto the snow by an `EXIT` / `LIQUIDITY` signpost. The crash breaks the ice around her along seeded rays and rings into floes that tilt and drift on open water, with her in the hole if she was still out there.

- `motion.ts`: the same toolkit as the other games: exact damped springs, easing, deterministic noise, a seeded generator.
- `ice.ts`: the lake. The foreshortened plane with frozen-in streaks and a sweeping sheen, the bagholders frozen under it (seeded by index at fixed world positions, each with its own pose and tilt), skate trails, a crack network of seeded random walks with branches that grow in, the thinning under her, and the shatter: floes cut from rays and rings that separate, tip and bob over rippling water.
- `skater.ts`: the stride rig. Each stroke pushes off the back skate and glides on the front one through two-bone legs that stay on the ice, arms swing opposite, the torso leans into the speed, a scarf trails on a chain of eased links; the carve to shore, the shades, the plunge and the shivering swim.
- `scene.ts`: the sky with stars, aurora and moon, parallax mountains and the pine-lined shore with the exit sign that springs up where she climbs out, the camera that follows her, spray, breath and splash particles, snow, the HUD (captions, multiplier, distance, the secured badge) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (5.07×) used by the gallery.

Stroke rate, speed, the crack cadence and the thinning all follow the displayed multiplier; nothing in the presentation changes the committed outcome. `prefers-reduced-motion` turns off the screen shake and twinkle.

Run `npm run dev` from the repository root and open the Thin Ice URL it prints. Join with 50 local credits, then cash out during a running round to close the long and head for the shore. `npm run build` produces the three publishable files in `dist/thin-ice/`.
