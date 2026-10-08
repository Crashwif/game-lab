# Liquidation Lane

A first-person Lambo ride through a sunset neon city. The acid-yellow hood, angular carbon dashboard, green hands on the wheel, and sunglasses Pepe in the rear-view mirror put the player in the driver's seat. A leverage dial, speed readout, shift lights, gear indicator, G-force accelerometer, GAS gauge in gwei and a LIQ PRICE sensor climb together. Road markings, traffic with its own speeds, billboards and streetlights rush past in perspective; SEC cars and a helicopter show up, a rocket goes off, Mom keeps calling, and the financial advice gets progressively worse.

Tension follows 1 − 1/multiplier, so the 1×–3× window where most rounds end escalates every couple of seconds: short gear shifts with a head nod, Mom calling at 1.15×, SEC lights fading into the mirror from 1.3×, the helicopter flying in around 1.5–1.7×, a scripted near miss at 9 s and every 12 s after, the margin call and a rocket from 2.5×. The LIQ PRICE sensor ticks faster as the multiplier climbs. Every beat is keyed to the live multiplier or elapsed time, never to the crash point. Long rounds keep changing: top gear revs into the limiter at 25×, captions run to 2000×, and tunnels arrive from 60 s.

An accepted cashout takes the offshore exit and decelerates to the valet: paper hands, car intact. Traffic keeps sending past you while a regret caption follows how far the round runs past your exit. If the round then crashes, the NGMI car spins into a STOP LOSS barrier ahead: dodged. The server's crash sends a driver who stayed in into a skid onto the STOP LOSS barrier, which is hit 0.42 s later with a hit-stop and punch-in, a cracked windshield, a NOT FINANCIAL ADVICE airbag, and a denied insurance claim. Spectators ride as the passenger princess and get their own crash copy. In the next lobby a tow truck wipes the wreck away. Pepe keeps his sunglasses on. There are no graphic injuries.

- `scene.ts` maps shared room phases and accepted cashouts to the driving, exit and wreck choreography. It never chooses outcomes.
- `road.ts` projects an animated highway, traffic, near misses, roadside satire, skyline and the tow truck.
- `cockpit.ts` draws the interior, Pepe reflection, instruments, hands, phone, windshield damage and airbag.
- `art.ts` and `motion.ts` supply Canvas helpers and damped springs.
- `sound.ts` adds an engine that changes pitch with RPM and gear shifts to the shared, opt-in phonk audio. It disposes its oscillators when the scene ends.
- `main.ts`, `audio.ts` and the first part of `style.css` are the canonical shared shell copies.
- `replay.json` is a verified 10.31× example. `clips.json` holds the recorded score; the engine and effects are synthesised locally.

Join with **Full send**, then **Cash out** before the server's crash. Space triggers the currently available action. Sound cycles off, on, and effects only. The embedded host owns joining and credits; only the exit is offered inside the frame. Steering is automatic presentation, not a way to change the committed result. Credits have no monetary value.

Reduced motion removes camera shake, the impact punch-in, gear-shift kicks, the near-miss sidestep, caption punch-ins, speed streaks, rotor flicker, blinking lights, the phone buzz and the crash roll (the STOP LOSS barrier stops a little further off instead), swaps the tow truck for a soft dip, and softens the single impact flash. Late joins and missed crashes settle directly into the current state without replaying stingers. Cashout protection persists through the crash.

All visuals are procedural Canvas drawings with no external image, font or network dependencies. Pepe the Frog is a character created by Matt Furie; Lamborghini is a third-party vehicle brand. This is an unofficial satirical depiction.

From the repository root, run `npm ci`, then `npm run dev`. Open `http://127.0.0.1:4500/bundle/liquidation-lane/index.html`; add `?mode=replay` for the recorded preview. `npm run build` creates the self-contained `index.html`, `style.css` and `game.generated.js` in `dist/liquidation-lane/`, ready for Studio import.
