# Insider Wallets

A coin launched at a rally. A fictional candidate in a red tie and hair that does not move announces the token from a podium in front of flags, a seal and a teleprompter; the crowd swells with the displayed multiplier, confetti cannons fire at milestones, and a wallet tracker beside the stage lists INSIDER 1 to INSIDER 8 with balances that bloat on the same curve. Tension: the insider rows blink PENDING, the teleprompter scrolls from the pitch to "I HAVE NEVER HEARD OF THIS COIN", a helicopter's downdraft builds behind the flags, the press pool raises more cameras and the thumbs-up hand starts to shake. An accepted cashout is you leaving the rally: your seat in the front row empties and a LEFT EARLY badge appears. The crash is the dump: every insider row flashes SOLD in the same frame, the candidate is lifted off by the helicopter mid-sentence, the podium falls over, the flags drop, the crowd surges at the stage and the tracker total reads RUGGED. The candidate is a generic cartoon with no likeness of any real person, party or campaign.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `rally.ts`: the stage: flags, seal, podium, teleprompter, the candidate's rig (thumbs-up, point, lean, the shake), the crowd field, the press pool and its flashes, the confetti cannons, the helicopter and the lift-off, your seat and the LEFT EARLY badge.
- `tracker.ts`: the wallet tracker: insider rows on the multiplier curve, PENDING blinks, the same-frame SOLD flash, the RUGGED total, the cannon count and your row.
- `scene.ts`: composition, the HUD over the stage (captions, multiplier, the cannon count, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round used by the gallery.
