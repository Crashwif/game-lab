# OnlyFrens

A coin launched on a livestream. The queen sits in a hoodie and cat-ear headset under LED strips and a ring light; the chat column scrolls faster with the displayed multiplier, tips light up in purple, money bags stack on her desk, and a tip goal promises a reveal at a multiplier that moves up every time it is reached ("one more milestone frens"). Tension: the mods nod off, her eyes flick to the door behind her, the handle starts turning, a shadow gathers under it, and the front row of simps under the video waves roses and cards harder. An accepted cashout is your simp closing the tab: an UNSUBSCRIBED badge, shades, and a walk out of frame toward the grass. The crash is the boyfriend reveal: the door opens, a grayscale gigachad walks through carrying the bag, the feed cuts to static and STREAM ENDED, the goal bar drains, the chat floods with RUGGED and the simps put their heads in their hands.

- `motion.ts`: the shared toolkit: exact damped springs, easing, deterministic noise, a seeded generator.
- `stream.ts`: the video feed: the room, the queen's rig (wave, kiss, glance, shock), the bags, the door and the boyfriend, the hearts, the static and the end card.
- `chat.ts`: the chat panel with its message flow, the mods, the moving tip goal, the crash flood, and the front row of simps with your simp's exit.
- `scene.ts`: composition, the HUD over the video (captions, multiplier, the bag count, the secured badge, the outcome pop) and the round-phase logic.
- `main.ts`: SDK connection, round lifecycle, the player's bet and cashout, input controls and the animation loop.
- `replay.json`: a verifiable settled example round (10.12×) used by the gallery.

Chat rate, tips, the goal ladder, the door and the viewer count all follow the displayed multiplier; nothing in the presentation changes the committed outcome. Innuendo only: nothing is ever revealed but him. `prefers-reduced-motion` turns off the shake, the LED pulse and the static.

Run `npm run dev` from the repository root and open the OnlyFrens URL it prints. Join with 50 local credits, then cash out during a running round to unsubscribe. `npm run build` produces the three publishable files in `dist/onlyfrens/`.
