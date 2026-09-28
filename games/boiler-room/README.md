# Boiler Room

The boiler is a money printer at a shady brokerage (a brass `MONEY PRINTER` / `MODEL BRRR-3000` plate on the barrel, `NO KYC` / `NO REFUNDS` on the wall), and the stoker shovels retail into it: the coal pile has a `RETAIL` sign stuck in it. Its pressure climbs with the displayed multiplier. The engine it drives runs faster, the belt and fan speed up, the governor's weights lift, rivets pop into hissing leaks, the safety valve starts to vent, and the needle heads into the red. An accepted cashout has him drop the shovel and duck behind the `OFF` / `SHORE` shield with his goggles down, hiding offshore; the crash blows the valve clean off and fills the room with steam, with him in it if he stayed at the door.

- `motion.ts`: the same toolkit as the other games: exact damped springs, easing, deterministic noise, a seeded generator.
- `engine.ts`: the boiler, its maker's plate and its machinery. An exact slider-crank moves the crosshead and piston from the crank angle, the flywheel drives a belt (true external tangents, dashes running at surface speed) to a fan, and a flyball governor lifts its weights with speed. Pressure moves the gauge with jitter, feeds the fire, pops rivets into leaks at fixed multipliers, lifts the safety valve, and the blow-out sends the cap and rivets flying with a seeded steam burst.
- `particles.ts`: two-layer particles: steam and smoke that swell and drift, sparks and embers from the fire, coal off the shovel, soot, and bouncing debris.
- `stoker.ts`: the stoker. A shovel cycle (scoop, swing, throw, return) at a pace that follows the multiplier, both hands on the shovel through two-bone arms, torso and head on springs; sweat and soot with the pressure; the run to the offshore shield, the crouch with goggles down, and the blast that throws him across the room.
- `sound.ts`: opt-in procedural audio with no files: a noise bed that hisses with the pressure, a whistle in the red, a chuff on every piston reversal, a ping when a seam gives, and the swept blast. It also wires the Sound button, and suspends the audio while the page is hidden or the picture is scrolled out of view.
- `scene.ts`: the engine room with its wall sign and the retail coal pile, the blow-out whiteout, vibration and shake, the HUD (captions, multiplier, pressure, the secured badge) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (8.74×) used by the gallery.

Everything follows the displayed multiplier; nothing in the presentation changes the committed outcome. Sound stays off until the player turns it on, which is also the user gesture autoplay rules require. `prefers-reduced-motion` turns off the shake and vibration and softens the blow-out whiteout.

Run `npm run dev` from the repository root and open the Boiler Room URL it prints. Join with 50 local credits, then cash out during a running round to go offshore. `npm run build` produces the three publishable files in `dist/boiler-room/`.
