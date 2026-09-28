# King of the Hill

Sisyphus, but the boulder is your token. A degen ape pushes a giant coin up a hill whose profile is the bonding curve, so the slope steepens exactly as the market cap grows. The coin swells with the displayed multiplier, holders cling to its rim and bail at milestones, a crown lands on it at King of the Hill, a cap and gown at graduation and a Raydium flag after that, and the sky drains from dawn to space as the moon fills the frame. An accepted cashout brings a Lambo; the crash is the dev selling: the coin rolls back down the hill over the ape.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `hill.ts`: the slope as a function of distance (integrated for height), the camera mapping, the altitude sky with stars and a growing moon, and the hill body with contours, rocks and wooden roadside signs planted up the curve (BONDING CURVE → at the foot, WELCOME TO VALHALLA near the top).
- `coin.ts`: the coin: radius from the market cap, rolling from the distance pushed, rollbacks and wobble on bumps, clingers on the rim and jeets that tumble off, milestone gear, and the crash roll with dust.
- `ape.ts`: the ape rig: uphill-bending knees, soles aligned to the ground, hands on the rim through two-bone arms, a lean that grows with fear, bracing on bumps, the hop into the Lambo with feet following the hips, and the pancake.
- `gait.ts`: alternating uphill steps driven by actual travel. Support feet stay planted in world space while the other foot lifts and swings forward; a stopped ape finishes its step and stands still. Round resets and large position jumps replant the feet.
- `scene.ts`: composition, the Lambo pick-up and the community that pushes on after the ape leaves, camera following, HUD (captions, multiplier, market cap, the secured badge, and a flash over each holder who bails: JEETED, PAPER HANDS, SEE YA NERD, SOLD FOR A SANDWICH, NGMI) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (5.09×) used by the gallery.

Distance up the hill, coin size, bump cadence, the market-cap readout and the milestones all follow the displayed multiplier; nothing in the presentation changes the committed outcome. `prefers-reduced-motion` turns off the screen shake and twinkle.

Run `npm run dev` from the repository root and open the King of the Hill URL it prints. Join with 50 local credits, then cash out during a running round to call the Lambo. `npm run build` produces the three publishable files in `dist/king-of-the-hill/`.
