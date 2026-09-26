# Hopium Drip

A ward at Degen General. A patient in a hospital gown sits up in bed with a laptop; an IV bag labelled HOPIUM drips into his arm and drains on the multiplier curve, and the monitor beside the bed draws the chart as his heartbeat, faster with every multiple. Tension: the bag empties, the doctor's clipboard notes get worse, the flowers wilt, the nurse swaps the bag for COPIUM, the roommate behind the curtain flatlines first and is wheeled out, and the patient's pupils grow. An accepted cashout is a discharge: the drip is pulled, the gown swaps for a suit, he walks out of the ward with a GAINS balloon and the badge reads DISCHARGED. The crash is the flatline: a seeded scribble on the monitor, then the long flat line, the bag relabelled RUGGED, the sheet pulled over the laptop and the doctor calling time of death at the crash multiplier.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `ward.ts`: the ward set: the bed rig (lean, twitch, pupils), the IV stand and its draining bag, the doctor and the clipboard, the flowers, the roommate behind the curtain, the discharge walk and the time-of-death sequence.
- `monitor.ts`: the bedside monitor: the EKG trace driven by the displayed multiplier, the vitals, the dose ladder with its milestone pulses, the seeded flatline scribble and the long flat line.
- `scene.ts`: composition, the HUD (captions, multiplier, the dose count, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.

The heartbeat, the bag level, the notes, the curtain and the pupils all follow the displayed multiplier; nothing in the presentation changes the committed outcome. Comedy only. `prefers-reduced-motion` turns off the shake, the monitor flicker and the pulse flashes.

Run `npm run dev` from the repository root and open the Hopium Drip URL it prints. Join with 50 local credits, then cash out during a running round to be discharged. `npm run build` produces the three publishable files in `dist/hopium-drip/`.
