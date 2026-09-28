# Tower Tension

A crane stacks prefab floors onto Ponzi Towers, a condo tower that sways more the higher it gets: the developer's billboard on the site fence reads `PONZI TOWERS` / `LUXURY CONDOS · PAY IN $FLOOR`, the crane's counterweight is painted `100X`, and the floor count is the floor price. The worker on top is the player: an accepted cashout sells the penthouse to the next guy, calls the hoist and rides him down to safety, and the crash releases every joint so the stack tips and breaks apart with him still up there if he waited too long.

- `motion.ts`: the same toolkit as Balloon Pump: exact damped springs, easing, deterministic noise, a seeded generator.
- `tower.ts`: the stack as a shear building: each floor is joined to the one below by a lateral spring with inter-storey damping, integrated with fixed substeps. Landing floors arrive with the hook's swing, wind pushes harder with height, and the bending modes (slower and wider as the tower grows) come out of those springs. The collapse tips the attached part about the base like a rigid rod and sheds floors from the top down into a seeded debris fall with ground bounces, dust and rubble.
- `crane.ts`: the tower crane (its counterweight marked `100X`) and its cycle (hook to the pile, lift, trolley out, lower, set, release). The block hangs as a real pendulum under the trolley, so starts and stops leave it swinging and it lands slightly off centre. The crane climbs with the stack.
- `worker.ts`: the worker. He climbs onto each block as it comes down, leans against the sway and flails when it gets bad, calls the hoist on an accepted exit, rides it down and stands clear, or falls with the floors.
- `scene.ts`: the camera (pans and zooms to keep the top in view, follows the hoist down, pulls back for the collapse), the altitude sky (hazy horizon to stars and the moon), parallax skyline and clouds, the site and its billboard, the HUD (captions, multiplier, the floor price, which drops to 0 once the tower is down, the secured badge) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (7.27×, seventeen floors) used by the gallery.

One floor lands per sixth of a doubling of the displayed multiplier, so the crane keeps a steady rhythm while the tower's height, sway period, wind and the worker's nerves all follow the multiplier. Nothing in the presentation changes the committed outcome. `prefers-reduced-motion` turns off the screen shake and twinkle.

Run `npm run dev` from the repository root and open the Tower Tension URL it prints. Join with 50 local credits, then cash out during a running round to send the worker down. `npm run build` produces the three publishable files in `dist/tower-tension/`.
