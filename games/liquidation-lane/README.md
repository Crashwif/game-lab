# Liquidation Lane

A first-person Lambo ride through a sunset neon city. The acid-yellow hood, angular carbon dashboard, green hands on the wheel, and sunglasses Pepe in the rear-view mirror put the player in the driver's seat. A leverage dial, speed readout, gear indicator and G-force accelerometer climb together. Road markings, traffic, billboards and streetlights rush past in perspective; SEC cars and a helicopter show up, a rocket goes off, Mom keeps calling, and the financial advice gets progressively worse.

An accepted cashout takes the offshore exit and decelerates to the valet: paper hands, car intact. The server's crash sends a driver who stayed in into a skid, cracks the windshield, deploys a NOT FINANCIAL ADVICE airbag, and gets the insurance claim denied. Pepe keeps his sunglasses on. There are no graphic injuries.

- `scene.ts` maps shared room phases and accepted cashouts to the driving, exit and wreck choreography. It never chooses outcomes.
- `road.ts` projects an animated highway, traffic, roadside satire and skyline.
- `cockpit.ts` draws the interior, Pepe reflection, instruments, hands, phone, windshield damage and airbag.
- `art.ts` and `motion.ts` supply Canvas helpers and damped springs.
- `sound.ts` adds an engine that changes pitch with RPM and gear shifts to the shared, opt-in phonk audio. It disposes its oscillators when the scene ends.
- `main.ts`, `audio.ts` and the first part of `style.css` are the canonical shared shell copies.
- `replay.json` is a verified 10.31× example. `clips.json` is empty; all sound is synthesised locally.

Join with **Full send**, then **Cash out** before the server's crash. Space triggers the currently available action. Sound cycles off, on, and effects only. The embedded host owns joining and credits; only the exit is offered inside the frame. Steering is automatic presentation, not a way to change the committed result. Credits have no monetary value.

Reduced motion removes camera shake, speed streaks, rotor flicker and the crash roll, and softens the single impact flash. Late joins and missed crashes settle directly into the current state. Cashout protection persists through the crash.

All visuals are procedural Canvas drawings with no external image, font or network dependencies. Pepe the Frog is a character created by Matt Furie; Lamborghini is a third-party vehicle brand. This is an unofficial satirical depiction.

From the repository root, run `npm ci`, then `npm run dev`. Open `http://127.0.0.1:4500/bundle/liquidation-lane/index.html`; add `?mode=replay` for the recorded preview. `npm run build` creates the self-contained `index.html`, `style.css` and `game.generated.js` in `dist/liquidation-lane/`, ready for Studio import.
